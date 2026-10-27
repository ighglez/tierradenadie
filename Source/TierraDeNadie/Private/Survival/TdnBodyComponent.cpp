#include "Survival/TdnBodyComponent.h"
#include "TierraDeNadie.h"
#include "GameFramework/Pawn.h"
#include "Net/UnrealNetwork.h"

UTdnBodyComponent::UTdnBodyComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PrePhysics;
	SetIsReplicatedByDefault(true);
}

void UTdnBodyComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UTdnBodyComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);

	DOREPLIFETIME_CONDITION(UTdnBodyComponent, Health, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, Blood, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, Shock, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, Energy, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, Water, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, Temperature, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, Wetness, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, Stamina, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, CarriedKg, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, Bleeds, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, bExhausted, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, bSplinted, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, bInfected, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, Flu, COND_OwnerOnly);
	DOREPLIFETIME_CONDITION(UTdnBodyComponent, MorphineTime, COND_OwnerOnly);

	DOREPLIFETIME(UTdnBodyComponent, bUnconscious);
	DOREPLIFETIME(UTdnBodyComponent, bFracture);
	DOREPLIFETIME(UTdnBodyComponent, bDead);
}

void UTdnBodyComponent::SetActivity(ETdnGait InGait, ETdnStance InStance, bool bInHoldingBreath, float InCarriedKg)
{
	Gait = InGait;
	Stance = InStance;
	bHoldingBreath = bInHoldingBreath;
	CarriedKg = InCarriedKg;
}

float UTdnBodyComponent::GetMaxStamina() const
{
	float M = 100.f - FMath::Max(0.f, CarriedKg - 12.f) * 2.4f;
	if (Flu > 0.f)
	{
		M -= 20.f;
	}
	if (Energy < 15.f)
	{
		M -= 20.f;
	}
	return FMath::Clamp(M, 15.f, 100.f);
}

bool UTdnBodyComponent::CanSprint() const
{
	return !bDead && !bUnconscious && !IsLegBroken() && !bSplinted && CarriedKg < 32.f && !bExhausted && Stamina > 1.f;
}

float UTdnBodyComponent::GetAimSway() const
{
	return 0.004f + (1.f - Stamina / 100.f) * 0.018f + (bExhausted ? 0.012f : 0.f) + (Temperature < 35.5f ? 0.01f : 0.f) + (bFracture ? 0.004f : 0.f);
}

void UTdnBodyComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	if (GetOwner() && GetOwner()->HasAuthority() && !bDead)
	{
		SimulateServer(FMath::Min(DeltaTime, 0.1f));
	}

	// los avisos se calculan donde se conocen los valores: servidor y cliente dueño
	const APawn* Pawn = Cast<APawn>(GetOwner());
	if (Pawn && (Pawn->HasAuthority() || Pawn->IsLocallyControlled()))
	{
		EvaluateHints();
	}
}

void UTdnBodyComponent::SimulateServer(float Dt)
{
	const float Sprint = Gait == ETdnGait::Sprint ? 1.f : 0.f;
	const float Jog = Gait == ETdnGait::Jog ? 1.f : 0.f;

	// hambre y sed: más rápido corriendo, enfermo o con frío
	Energy -= (0.04f + 0.015f * Jog + 0.06f * Sprint + (Poisoned > 0.f ? 0.04f : 0.f) + (Temperature < 36.f ? 0.02f : 0.f)) * Dt;
	Water -= (0.065f + 0.015f * Jog + 0.07f * Sprint + (Poisoned > 0.f ? 0.12f : 0.f) + (bInfected ? 0.04f : 0.f)) * Dt;
	Energy = FMath::Max(0.f, Energy);
	Water = FMath::Max(0.f, Water);

	// resistencia: se gasta esprintando y aguantando la respiración; se recupera tras una pausa
	const float MaxS = GetMaxStamina();
	const bool bDraining = Gait == ETdnGait::Sprint || bHoldingBreath;
	if (Gait == ETdnGait::Sprint)
	{
		Stamina -= 9.f * (1.f + FMath::Max(0.f, CarriedKg - 20.f) / 25.f) * Dt;
	}
	if (bHoldingBreath)
	{
		Stamina -= 14.f * Dt;
	}
	if (Environment.bSwimming && Gait != ETdnGait::Idle)
	{
		Stamina -= 2.f * Dt;
	}
	if (bDraining)
	{
		StaminaDelay = 1.2f;
	}
	else
	{
		StaminaDelay = FMath::Max(0.f, StaminaDelay - Dt);
		if (StaminaDelay <= 0.f)
		{
			const float Rate = (Energy > 20.f ? 8.f : 3.5f) * (Gait == ETdnGait::Jog ? 0.6f : 1.f) * (Stance != ETdnStance::Stand ? 1.2f : 1.f);
			Stamina += Rate * Dt;
		}
	}
	Stamina = FMath::Clamp(Stamina, 0.f, MaxS);
	if (Stamina < 2.f && !bExhausted)
	{
		bExhausted = true;
	}
	if (bExhausted && Stamina > MaxS * 0.35f)
	{
		bExhausted = false;
	}

	// sangrado
	if (Bleeds > 0)
	{
		Blood -= Bleeds * 11.f * Dt;
	}

	// shock: baja solo; al llegar a 100 te desmayas; la falta de sangre lo sube
	if (bUnconscious)
	{
		UnconsciousTime -= Dt;
		if (UnconsciousTime <= 0.f)
		{
			bUnconscious = false;
			Shock = 40.f;
			OnRep_Unconscious();
		}
	}
	else
	{
		if (Shock >= 100.f)
		{
			KnockOut(8.f + FMath::FRand() * 12.f);
		}
		Shock = FMath::Max(0.f, Shock - (Health > 50.f ? 4.f : 1.5f) * Dt);
		if (Blood < 2800.f)
		{
			Shock = FMath::Min(100.f, Shock + (2800.f - Blood) / 400.f * Dt * 3.f);
		}
	}

	// recuperación con el estómago lleno y sin heridas
	if (Energy > 45.f && Water > 45.f && Bleeds == 0 && Poisoned <= 0.f && !bInfected)
	{
		Blood = FMath::Min(MaxBlood, Blood + 7.f * Dt);
		if (Blood > 4000.f && Temperature > 35.5f)
		{
			Health = FMath::Min(100.f, Health + 0.12f * Dt);
		}
	}
	if (Energy <= 0.f) { Health -= 0.35f * Dt; LastCause = TEXT("inanición"); }
	if (Water <= 0.f) { Health -= 0.55f * Dt; LastCause = TEXT("deshidratación"); }
	if (Blood < 2500.f) { Health -= 0.5f * Dt; }

	// medicinas y fracturas
	MorphineTime = FMath::Max(0.f, MorphineTime - Dt);
	PainkillerTime = FMath::Max(0.f, PainkillerTime - Dt);
	if (bFracture && bSplinted)
	{
		SplintHealTime -= Dt;
		if (SplintHealTime <= 0.f)
		{
			bFracture = false;
			bSplinted = false;
		}
	}

	// humedad: la lluvia empapa según la prenda exterior; se seca a cubierto o junto al fuego
	if (Environment.bSwimming)
	{
		Wetness = FMath::Min(1.f, Wetness + Dt * 0.5f);
	}
	else if (Environment.Rain > 0.15f && !Environment.bSheltered)
	{
		Wetness = FMath::Min(1.f, Wetness + Environment.Rain * 0.006f * (1.f - Environment.ClothingWaterproof) * Dt);
	}
	else
	{
		Wetness = FMath::Max(0.f, Wetness - Dt * (Environment.bNearFire ? 0.05f : 0.005f));
	}

	// temperatura corporal: tiende a un objetivo según el calor total
	float Warmth = Environment.AmbientWarmth - Wetness * 10.f - Environment.Rain * 3.f + 4.f + Environment.ClothingWarmth;
	if (Environment.bNearFire) { Warmth += 22.f; }
	if (Environment.bSheltered) { Warmth += 5.f; }
	if (Gait == ETdnGait::Sprint) { Warmth += 5.f; }
	else if (Gait == ETdnGait::Jog) { Warmth += 2.f; }
	if (bInfected) { Warmth += 8.f; } // fiebre
	const float Target = Warmth >= 19.f ? (bInfected ? 38.4f : 36.8f) : FMath::Clamp(36.8f - (19.f - Warmth) * 0.3f, 33.5f, 36.8f);
	const float Rate = Target > Temperature ? 0.02f : 0.006f;
	Temperature += FMath::Clamp(Target - Temperature, -Rate * Dt, Rate * Dt);
	if (Temperature < 35.f) { Health -= 0.3f * Dt; LastCause = TEXT("hipotermia"); }
	if (Temperature > 38.f) { Water = FMath::Max(0.f, Water - 0.05f * Dt); }

	// intoxicación: vómitos
	if (Poisoned > 0.f)
	{
		Poisoned -= Dt;
		if (FMath::FRand() < Dt / 40.f)
		{
			Energy = FMath::Max(0.f, Energy - 10.f);
			Water = FMath::Max(0.f, Water - 12.f);
		}
	}

	// resfriado: el frío prolongado lo provoca; la tos hace ruido
	if (Temperature < 35.9f && Flu <= 0.f && FMath::FRand() < Dt / 240.f)
	{
		Flu = 900.f;
	}
	if (Flu > 0.f)
	{
		Flu = FMath::Max(0.f, Flu - Dt * (Temperature > 36.4f ? 1.5f : 1.f));
		if (FMath::FRand() < Dt / 25.f)
		{
			OnNoise.Broadcast(GetOwner()->GetActorLocation(), 22.f);
		}
	}

	// heridas sucias: si no se desinfectan, acaban infectándose
	if (DirtyWoundTime > 0.f)
	{
		DirtyWoundTime -= Dt;
		if (DirtyWoundTime <= 0.f && !bInfected && FMath::FRand() < 0.6f)
		{
			bInfected = true;
		}
	}
	if (bInfected) { Health -= 0.08f * Dt; LastCause = TEXT("una infección"); }

	if (Health <= 0.f || Blood <= 0.f)
	{
		if (Blood <= 0.f)
		{
			LastCause = TEXT("desangrado");
		}
		Die();
	}
}

void UTdnBodyComponent::ApplyDamage(const FTdnDamage& Damage)
{
	if (bDead || !GetOwner() || !GetOwner()->HasAuthority())
	{
		return;
	}
	Health -= Damage.Amount;
	Blood -= Damage.Amount * 8.f;
	Shock = FMath::Min(100.f, Shock + (Damage.Shock >= 0.f ? Damage.Shock : Damage.Amount * 1.2f));
	if (FMath::FRand() < Damage.BleedChance)
	{
		++Bleeds;
		if (Damage.bDirty)
		{
			DirtyWoundTime = 90.f;
		}
	}
	if (!bFracture && Damage.FractureChance > 0.f && FMath::FRand() < Damage.FractureChance)
	{
		bFracture = true;
		bSplinted = false;
	}
	LastCause = Damage.Cause.IsEmpty() ? TEXT("heridas") : Damage.Cause;
	if (Health <= 0.f || Blood <= 0.f)
	{
		Die();
	}
}

void UTdnBodyComponent::ConsumeStamina(float Amount, float RegenDelay)
{
	Stamina = FMath::Max(0.f, Stamina - Amount);
	StaminaDelay = FMath::Max(StaminaDelay, RegenDelay);
}

void UTdnBodyComponent::Eat(float InEnergy, float InWater, float FoodPoisonChance)
{
	Energy = FMath::Clamp(Energy + InEnergy, 0.f, 100.f);
	Water = FMath::Clamp(Water + InWater, 0.f, 100.f);
	if (FoodPoisonChance > 0.f && FMath::FRand() < FoodPoisonChance)
	{
		Poisoned = 120.f;
	}
}

bool UTdnBodyComponent::Splint()
{
	if (!bFracture || bSplinted)
	{
		return false;
	}
	bSplinted = true;
	SplintHealTime = 600.f;
	return true;
}

void UTdnBodyComponent::KnockOut(float Seconds)
{
	bUnconscious = true;
	UnconsciousTime = Seconds;
	OnRep_Unconscious();
}

void UTdnBodyComponent::OnRep_Unconscious()
{
	OnConsciousnessChanged.Broadcast(bUnconscious);
}

void UTdnBodyComponent::Die()
{
	if (bDead)
	{
		return;
	}
	bDead = true;
	UE_LOG(LogTdn, Log, TEXT("%s ha muerto: %s"), *GetNameSafe(GetOwner()), *LastCause);
	OnDied.Broadcast(LastCause);
}

void UTdnBodyComponent::EvaluateHints()
{
	UpdateHint(TEXT("Hungry"), Energy < 25.f);
	UpdateHint(TEXT("Starving"), Energy <= 0.f);
	UpdateHint(TEXT("Thirsty"), Water < 25.f);
	UpdateHint(TEXT("Parched"), Water <= 0.f);
	UpdateHint(TEXT("Cold"), Temperature < 36.f);
	UpdateHint(TEXT("Freezing"), Temperature < 35.f);
	UpdateHint(TEXT("Fever"), Temperature > 38.f);
	UpdateHint(TEXT("Wet"), Wetness > 0.5f);
	UpdateHint(TEXT("Dizzy"), Blood < 3200.f);
	UpdateHint(TEXT("Bleeding"), Bleeds > 0);
	UpdateHint(TEXT("Heavy"), CarriedKg > 32.f);
	UpdateHint(TEXT("Exhausted"), bExhausted);
	UpdateHint(TEXT("Fracture"), bFracture);
	UpdateHint(TEXT("Sick"), Flu > 0.f || bInfected);
}

void UTdnBodyComponent::UpdateHint(FName Hint, bool bActive)
{
	const bool bWas = ActiveHints.Contains(Hint);
	if (bActive == bWas)
	{
		return;
	}
	if (bActive)
	{
		ActiveHints.Add(Hint);
	}
	else
	{
		ActiveHints.Remove(Hint);
	}
	OnHint.Broadcast(Hint, bActive);
}
