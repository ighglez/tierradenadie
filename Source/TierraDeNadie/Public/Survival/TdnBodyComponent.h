#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "TdnBodyComponent.generated.h"

UENUM(BlueprintType)
enum class ETdnGait : uint8
{
	Idle,
	Walk,
	Jog,
	Sprint
};

UENUM(BlueprintType)
enum class ETdnStance : uint8
{
	Stand,
	Crouch,
	Prone
};

/** Un golpe, disparo, caída... Todo el daño pasa por aquí. */
USTRUCT(BlueprintType)
struct FTdnDamage
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Daño")
	float Amount = 0.f;

	/** Probabilidad 0-1 de abrir una herida que sangra. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Daño")
	float BleedChance = 0.f;

	/** Shock que causa. Negativo = automático (1,2 x daño). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Daño")
	float Shock = -1.f;

	/** Probabilidad 0-1 de romper una pierna. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Daño")
	float FractureChance = 0.f;

	/** La herida puede infectarse si no se desinfecta (mordiscos, arañazos). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Daño")
	bool bDirty = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Daño")
	FString Cause;
};

/** Lo que rodea al personaje; lo rellena el sistema de clima y refugio. */
USTRUCT(BlueprintType)
struct FTdnEnvironment
{
	GENERATED_BODY()

	/** Calor ambiente en la escala del prototipo: 3 de noche, 17 a mediodía. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Entorno")
	float AmbientWarmth = 12.f;

	/** Lluvia de 0 a 1. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Entorno")
	float Rain = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Entorno")
	bool bSheltered = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Entorno")
	bool bNearFire = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Entorno")
	bool bSwimming = false;

	/** Abrigo de la ropa puesta (ya descontado su estado). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Entorno")
	float ClothingWarmth = 0.f;

	/** Impermeabilidad de la prenda exterior, 0-1. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Entorno")
	float ClothingWaterproof = 0.f;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FTdnBodyHint, FName, Hint, bool, bActive);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FTdnBodyDied, const FString&, Cause);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FTdnConsciousnessChanged, bool, bUnconscious);

/**
 * Estado del cuerpo: salud, sangre, shock, hambre, sed, temperatura, humedad, resistencia,
 * heridas, fracturas y enfermedades. Lo simula solo el servidor; los valores privados
 * (hambre, sed...) se replican solo al dueño, y lo visible (inconsciente, pierna rota, muerto) a todos.
 *
 * Reglas portadas del prototipo de navegador (Prototipo/js/player.js, updateVitals), mismas cifras.
 */
UCLASS(ClassGroup = (TierraDeNadie), meta = (BlueprintSpawnableComponent))
class TIERRADENADIE_API UTdnBodyComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UTdnBodyComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	// ---- Entradas (las pone el personaje cada fotograma, en el servidor) ----

	void SetActivity(ETdnGait InGait, ETdnStance InStance, bool bInHoldingBreath, float InCarriedKg);

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void SetEnvironment(const FTdnEnvironment& InEnvironment) { Environment = InEnvironment; }

	// ---- Acciones ----

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void ApplyDamage(const FTdnDamage& Damage);

	/** Gasto puntual de resistencia (saltar, golpear). */
	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void ConsumeStamina(float Amount, float RegenDelay = 1.5f);

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void Eat(float InEnergy, float InWater, float FoodPoisonChance = 0.f);

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void BandageOne() { Bleeds = FMath::Max(0, Bleeds - 1); }

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void BandageAll() { Bleeds = 0; Health = FMath::Min(100.f, Health + 8.f); }

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void Saline() { Blood = FMath::Min(MaxBlood, Blood + 1800.f); }

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void Painkillers() { PainkillerTime = 300.f; Shock = FMath::Max(0.f, Shock - 30.f); }

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void Morphine() { MorphineTime = 600.f; Shock = 0.f; }

	/** Devuelve false si no hay nada que entablillar. */
	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	bool Splint();

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void Charcoal() { Poisoned = 0.f; }

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void Vitamins() { if (Flu > 0.f) { Flu = FMath::Min(Flu, 60.f); } }

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void Antibiotics() { bInfected = false; DirtyWoundTime = 0.f; }

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Cuerpo")
	void Disinfect() { DirtyWoundTime = 0.f; }

	// ---- Consultas ----

	/** La carga y el estado reducen la resistencia máxima (15-100). */
	UFUNCTION(BlueprintPure, Category = "Cuerpo")
	float GetMaxStamina() const;

	UFUNCTION(BlueprintPure, Category = "Cuerpo")
	bool CanSprint() const;

	/** Pierna rota sin morfina. */
	UFUNCTION(BlueprintPure, Category = "Cuerpo")
	bool IsLegBroken() const { return bFracture && MorphineTime <= 0.f; }

	/** Temblor del arma: cansancio, frío y fractura. */
	UFUNCTION(BlueprintPure, Category = "Cuerpo")
	float GetAimSway() const;

	UFUNCTION(BlueprintPure, Category = "Cuerpo") float GetHealth() const { return Health; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") float GetBlood() const { return Blood; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") float GetShock() const { return Shock; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") float GetEnergy() const { return Energy; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") float GetWater() const { return Water; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") float GetTemperature() const { return Temperature; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") float GetWetness() const { return Wetness; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") float GetStamina() const { return Stamina; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") int32 GetBleeds() const { return Bleeds; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") bool IsExhausted() const { return bExhausted; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") bool IsUnconscious() const { return bUnconscious; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") bool HasFracture() const { return bFracture; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") bool IsSplinted() const { return bSplinted; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") bool HasFlu() const { return Flu > 0.f; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") bool IsInfected() const { return bInfected; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") bool IsDead() const { return bDead; }
	UFUNCTION(BlueprintPure, Category = "Cuerpo") float GetCarriedKg() const { return CarriedKg; }

	/** Avisos para la interfaz (en el servidor y en el cliente dueño): Hungry, Thirsty, Cold, Wet, Dizzy, Heavy, Exhausted, Bleeding... */
	UPROPERTY(BlueprintAssignable, Category = "Cuerpo")
	FTdnBodyHint OnHint;

	UPROPERTY(BlueprintAssignable, Category = "Cuerpo")
	FTdnBodyDied OnDied;

	UPROPERTY(BlueprintAssignable, Category = "Cuerpo")
	FTdnConsciousnessChanged OnConsciousnessChanged;

	/** Hace ruido (tos del resfriado). El sistema de infectados escucha este evento. */
	DECLARE_MULTICAST_DELEGATE_TwoParams(FTdnNoise, const FVector& /*Where*/, float /*RadiusMeters*/);
	FTdnNoise OnNoise;

	static constexpr float MaxBlood = 5000.f;

protected:
	virtual void BeginPlay() override;

	// Valores privados: solo los ve su dueño
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float Health = 100.f;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float Blood = MaxBlood;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float Shock = 0.f;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float Energy = 75.f;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float Water = 75.f;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float Temperature = 36.8f;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float Wetness = 0.f;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float Stamina = 100.f;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float CarriedKg = 0.f;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") int32 Bleeds = 0;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") bool bExhausted = false;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") bool bSplinted = false;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") bool bInfected = false;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float Flu = 0.f;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") float MorphineTime = 0.f;

	// Valores públicos: los ven todos (animaciones de cojera, cuerpo caído)
	UPROPERTY(ReplicatedUsing = OnRep_Unconscious, VisibleInstanceOnly, Category = "Cuerpo") bool bUnconscious = false;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") bool bFracture = false;
	UPROPERTY(Replicated, VisibleInstanceOnly, Category = "Cuerpo") bool bDead = false;

	UFUNCTION()
	void OnRep_Unconscious();

private:
	void SimulateServer(float Dt);
	void EvaluateHints();
	void UpdateHint(FName Hint, bool bActive);
	void KnockOut(float Seconds);
	void Die();

	// Solo servidor
	ETdnGait Gait = ETdnGait::Idle;
	ETdnStance Stance = ETdnStance::Stand;
	bool bHoldingBreath = false;
	FTdnEnvironment Environment;
	float StaminaDelay = 0.f;
	float UnconsciousTime = 0.f;
	float PainkillerTime = 0.f;
	float SplintHealTime = 0.f;
	float Poisoned = 0.f;
	float DirtyWoundTime = 0.f;
	FString LastCause;
	TSet<FName> ActiveHints;
};
