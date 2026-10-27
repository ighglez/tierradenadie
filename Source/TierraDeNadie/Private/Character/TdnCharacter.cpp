#include "Character/TdnCharacter.h"
#include "TierraDeNadie.h"
#include "Core/TdnGameMode.h"
#include "Items/TdnInventoryComponent.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/Engine.h"
#include "Engine/LocalPlayer.h"
#include "Engine/SkeletalMesh.h"
#include "Animation/AnimInstance.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "HAL/IConsoleManager.h"
#include "Misc/PackageName.h"
#include "Net/UnrealNetwork.h"
#include "UObject/SoftObjectPath.h"

static TAutoConsoleVariable<int32> CVarTdnDebugBody(
	TEXT("tdn.DebugCuerpo"),
	1,
	TEXT("Muestra en pantalla el estado del cuerpo del jugador (1 = sí, 0 = no)."));

namespace
{
	constexpr float CmPerM = 100.f;

	UInputAction* MakeAction(UObject* Outer, const TCHAR* Name, EInputActionValueType Type)
	{
		UInputAction* Action = NewObject<UInputAction>(Outer, FName(Name));
		Action->ValueType = Type;
		return Action;
	}

	const TCHAR* StanceName(ETdnStance S)
	{
		switch (S)
		{
		case ETdnStance::Crouch: return TEXT("agachado");
		case ETdnStance::Prone: return TEXT("tumbado");
		default: return TEXT("de pie");
		}
	}

	const TCHAR* GaitName(ETdnGait G)
	{
		switch (G)
		{
		case ETdnGait::Walk: return TEXT("paso");
		case ETdnGait::Jog: return TEXT("trote");
		case ETdnGait::Sprint: return TEXT("esprint");
		default: return TEXT("quieto");
		}
	}
}

ATdnCharacter::ATdnCharacter(const FObjectInitializer& ObjectInitializer)
	: Super(ObjectInitializer)
{
	PrimaryActorTick.bCanEverTick = true;

	GetCapsuleComponent()->InitCapsuleSize(35.f, 90.f);

	// el cuerpo gira hacia donde mira la cámara, sin brusquedad
	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	UCharacterMovementComponent* Move = GetCharacterMovement();
	Move->GetNavAgentPropertiesRef().bCanCrouch = true;
	Move->bOrientRotationToMovement = false;
	Move->bUseControllerDesiredRotation = true;
	Move->RotationRate = FRotator(0.f, 400.f, 0.f);
	Move->MaxWalkSpeed = JogSpeed * CmPerM;
	Move->MaxWalkSpeedCrouched = CrouchJogSpeed * CmPerM;
	Move->JumpZVelocity = 380.f;
	Move->AirControl = 0.1f;
	Move->BrakingDecelerationWalking = 1400.f;
	Move->GroundFriction = 7.f;
	Move->SetCrouchedHalfHeight(55.f);

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = DefaultArmLength;
	CameraBoom->SocketOffset = FVector(0.f, 45.f, 65.f);
	CameraBoom->bUsePawnControlRotation = true;
	CameraBoom->bEnableCameraLag = true;
	CameraBoom->CameraLagSpeed = 14.f;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;
	FollowCamera->FieldOfView = DefaultFOV;

	Body = CreateDefaultSubobject<UTdnBodyComponent>(TEXT("Body"));
	Inventory = CreateDefaultSubobject<UTdnInventoryComponent>(TEXT("Inventory"));

	GetMesh()->SetRelativeLocationAndRotation(FVector(0.f, 0.f, -90.f), FRotator(0.f, -90.f, 0.f));
}

void ATdnCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ATdnCharacter, Stance);
	DOREPLIFETIME(ATdnCharacter, bWantsSprint);
	DOREPLIFETIME(ATdnCharacter, bWalkMode);
	DOREPLIFETIME(ATdnCharacter, bAiming);
	DOREPLIFETIME(ATdnCharacter, bHoldingBreath);
	DOREPLIFETIME(ATdnCharacter, LeanTarget);
}

void ATdnCharacter::BeginPlay()
{
	Super::BeginPlay();
	ApplyPlaceholderMeshIfMissing();

	if (HasAuthority())
	{
		Body->OnDied.AddDynamic(this, &ATdnCharacter::HandleDeath);
	}
	Body->OnConsciousnessChanged.AddDynamic(this, &ATdnCharacter::HandleConsciousness);
}

// Mientras no haya personaje propio (MetaHuman), usa el maniquí de Epic si está en el proyecto.
// Es un marcador provisional: ver Docs/ASSETS.md.
void ATdnCharacter::ApplyPlaceholderMeshIfMissing()
{
	USkeletalMeshComponent* MeshComp = GetMesh();
	if (!MeshComp || MeshComp->GetSkeletalMeshAsset())
	{
		return;
	}

	static const TCHAR* MeshPaths[] = {
		TEXT("/Game/Characters/Mannequins/Meshes/SKM_Manny_Simple.SKM_Manny_Simple"),
		TEXT("/Game/Characters/Mannequins/Meshes/SKM_Manny.SKM_Manny"),
	};
	static const TCHAR* AnimPaths[] = {
		TEXT("/Game/Characters/Mannequins/Anims/Unarmed/ABP_Unarmed.ABP_Unarmed_C"),
		TEXT("/Game/Characters/Mannequins/Animations/ABP_Manny.ABP_Manny_C"),
	};

	for (const TCHAR* Path : MeshPaths)
	{
		if (!FPackageName::DoesPackageExist(FSoftObjectPath(Path).GetLongPackageName()))
		{
			continue;
		}
		if (USkeletalMesh* SkMesh = LoadObject<USkeletalMesh>(nullptr, Path, nullptr, LOAD_NoWarn | LOAD_Quiet))
		{
			MeshComp->SetSkeletalMeshAsset(SkMesh);
			UE_LOG(LogTdn, Log, TEXT("[PROVISIONAL] Usando el maniquí de Epic como personaje: %s"), Path);
			break;
		}
	}
	for (const TCHAR* Path : AnimPaths)
	{
		if (!FPackageName::DoesPackageExist(FSoftObjectPath(Path).GetLongPackageName()))
		{
			continue;
		}
		if (UClass* AnimClass = LoadClass<UAnimInstance>(nullptr, Path, nullptr, LOAD_NoWarn | LOAD_Quiet))
		{
			MeshComp->SetAnimInstanceClass(AnimClass);
			break;
		}
	}
	if (!MeshComp->GetSkeletalMeshAsset())
	{
		UE_LOG(LogTdn, Warning, TEXT("[PROVISIONAL] Sin malla de personaje. Añade el paquete 'Third Person' (ver Docs/ASSETS.md)."));
	}
}

// ---------------------------------------------------------------------------
// Controles
// ---------------------------------------------------------------------------

void ATdnCharacter::EnsureDefaultInput()
{
	if (DefaultMappingContext)
	{
		return;
	}

	// Controles por defecto, los mismos que el prototipo
	MoveAction = MakeAction(this, TEXT("IA_Mover"), EInputActionValueType::Axis2D);
	LookAction = MakeAction(this, TEXT("IA_Mirar"), EInputActionValueType::Axis2D);
	SprintAction = MakeAction(this, TEXT("IA_Esprintar"), EInputActionValueType::Boolean);
	WalkToggleAction = MakeAction(this, TEXT("IA_Caminar"), EInputActionValueType::Boolean);
	CrouchAction = MakeAction(this, TEXT("IA_Agacharse"), EInputActionValueType::Boolean);
	ProneAction = MakeAction(this, TEXT("IA_Tumbarse"), EInputActionValueType::Boolean);
	JumpAction = MakeAction(this, TEXT("IA_Saltar"), EInputActionValueType::Boolean);
	LeanLeftAction = MakeAction(this, TEXT("IA_InclinarIzq"), EInputActionValueType::Boolean);
	LeanRightAction = MakeAction(this, TEXT("IA_InclinarDer"), EInputActionValueType::Boolean);
	AimAction = MakeAction(this, TEXT("IA_Apuntar"), EInputActionValueType::Boolean);

	UInputMappingContext* Ctx = NewObject<UInputMappingContext>(this, TEXT("IMC_Superviviente"));

	// WASD -> eje 2D (X lateral, Y adelante)
	Ctx->MapKey(MoveAction, EKeys::W).Modifiers.Add(NewObject<UInputModifierSwizzleAxis>(Ctx));
	{
		FEnhancedActionKeyMapping& Back = Ctx->MapKey(MoveAction, EKeys::S);
		Back.Modifiers.Add(NewObject<UInputModifierSwizzleAxis>(Ctx));
		Back.Modifiers.Add(NewObject<UInputModifierNegate>(Ctx));
	}
	Ctx->MapKey(MoveAction, EKeys::A).Modifiers.Add(NewObject<UInputModifierNegate>(Ctx));
	Ctx->MapKey(MoveAction, EKeys::D);
	Ctx->MapKey(LookAction, EKeys::Mouse2D);
	Ctx->MapKey(SprintAction, EKeys::LeftShift);
	Ctx->MapKey(WalkToggleAction, EKeys::CapsLock);
	Ctx->MapKey(CrouchAction, EKeys::C);
	Ctx->MapKey(ProneAction, EKeys::Z);
	Ctx->MapKey(JumpAction, EKeys::SpaceBar);
	Ctx->MapKey(LeanLeftAction, EKeys::Q);
	Ctx->MapKey(LeanRightAction, EKeys::E);
	Ctx->MapKey(AimAction, EKeys::RightMouseButton);

	DefaultMappingContext = Ctx;
}

void ATdnCharacter::PawnClientRestart()
{
	EnsureDefaultInput();
	Super::PawnClientRestart();

	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* Subsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			Subsystem->RemoveMappingContext(DefaultMappingContext);
			Subsystem->AddMappingContext(DefaultMappingContext, 0);
		}
	}
}

void ATdnCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	EnsureDefaultInput();

	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!Input)
	{
		UE_LOG(LogTdn, Error, TEXT("Falta Enhanced Input en Config/DefaultInput.ini"));
		return;
	}
	Input->BindAction(MoveAction, ETriggerEvent::Triggered, this, &ATdnCharacter::Move);
	Input->BindAction(MoveAction, ETriggerEvent::Completed, this, &ATdnCharacter::MoveCompleted);
	Input->BindAction(LookAction, ETriggerEvent::Triggered, this, &ATdnCharacter::Look);
	Input->BindAction(SprintAction, ETriggerEvent::Started, this, &ATdnCharacter::SprintPressed);
	Input->BindAction(SprintAction, ETriggerEvent::Completed, this, &ATdnCharacter::SprintReleased);
	Input->BindAction(WalkToggleAction, ETriggerEvent::Started, this, &ATdnCharacter::WalkTogglePressed);
	Input->BindAction(CrouchAction, ETriggerEvent::Started, this, &ATdnCharacter::CrouchPressed);
	Input->BindAction(ProneAction, ETriggerEvent::Started, this, &ATdnCharacter::PronePressed);
	Input->BindAction(JumpAction, ETriggerEvent::Started, this, &ATdnCharacter::JumpPressed);
	Input->BindAction(JumpAction, ETriggerEvent::Completed, this, &ACharacter::StopJumping);
	Input->BindAction(LeanLeftAction, ETriggerEvent::Started, this, &ATdnCharacter::LeanLeftPressed);
	Input->BindAction(LeanLeftAction, ETriggerEvent::Completed, this, &ATdnCharacter::LeanLeftReleased);
	Input->BindAction(LeanRightAction, ETriggerEvent::Started, this, &ATdnCharacter::LeanRightPressed);
	Input->BindAction(LeanRightAction, ETriggerEvent::Completed, this, &ATdnCharacter::LeanRightReleased);
	Input->BindAction(AimAction, ETriggerEvent::Started, this, &ATdnCharacter::AimPressed);
	Input->BindAction(AimAction, ETriggerEvent::Completed, this, &ATdnCharacter::AimReleased);
}

void ATdnCharacter::Move(const FInputActionValue& Value)
{
	MoveInput = Value.Get<FVector2D>();
	UpdateSprintWish();
	if (!Controller || Body->IsUnconscious() || Body->IsDead())
	{
		return;
	}
	const FRotator YawRotation(0.f, Controller->GetControlRotation().Yaw, 0.f);
	const FRotationMatrix Basis(YawRotation);
	AddMovementInput(Basis.GetUnitAxis(EAxis::X), MoveInput.Y);
	AddMovementInput(Basis.GetUnitAxis(EAxis::Y), MoveInput.X);
}

void ATdnCharacter::MoveCompleted(const FInputActionValue& Value)
{
	MoveInput = FVector2D::ZeroVector;
	UpdateSprintWish();
}

void ATdnCharacter::Look(const FInputActionValue& Value)
{
	if (Body->IsUnconscious() || Body->IsDead())
	{
		return;
	}
	const FVector2D Axis = Value.Get<FVector2D>();
	AddControllerYawInput(Axis.X);
	AddControllerPitchInput(-Axis.Y);
}

void ATdnCharacter::SprintPressed(const FInputActionValue& Value)
{
	bSprintHeld = true;
	UpdateSprintWish();
	if (bAiming)
	{
		bHoldingBreath = true;
		ServerSetAim(bAiming, bHoldingBreath);
	}
}

void ATdnCharacter::SprintReleased(const FInputActionValue& Value)
{
	bSprintHeld = false;
	UpdateSprintWish();
	if (bHoldingBreath)
	{
		bHoldingBreath = false;
		ServerSetAim(bAiming, false);
	}
}

void ATdnCharacter::WalkTogglePressed(const FInputActionValue& Value)
{
	bWalkMode = !bWalkMode;
	ServerSetWalk(bWalkMode);
}

void ATdnCharacter::CrouchPressed(const FInputActionValue& Value)
{
	RequestStance(Stance == ETdnStance::Crouch ? ETdnStance::Stand : ETdnStance::Crouch);
}

void ATdnCharacter::PronePressed(const FInputActionValue& Value)
{
	RequestStance(Stance == ETdnStance::Prone ? ETdnStance::Stand : ETdnStance::Prone);
}

void ATdnCharacter::JumpPressed(const FInputActionValue& Value)
{
	// Espacio con el personaje agachado o tumbado lo pone de pie, como en el género
	if (Stance != ETdnStance::Stand)
	{
		RequestStance(ETdnStance::Stand);
		return;
	}
	Jump();
}

void ATdnCharacter::LeanLeftPressed(const FInputActionValue& Value) { bLeanLeftHeld = true; UpdateLeanTarget(); }
void ATdnCharacter::LeanLeftReleased(const FInputActionValue& Value) { bLeanLeftHeld = false; UpdateLeanTarget(); }
void ATdnCharacter::LeanRightPressed(const FInputActionValue& Value) { bLeanRightHeld = true; UpdateLeanTarget(); }
void ATdnCharacter::LeanRightReleased(const FInputActionValue& Value) { bLeanRightHeld = false; UpdateLeanTarget(); }

void ATdnCharacter::AimPressed(const FInputActionValue& Value)
{
	bAiming = true;
	bHoldingBreath = bSprintHeld;
	UpdateSprintWish();
	ServerSetAim(true, bHoldingBreath);
}

void ATdnCharacter::AimReleased(const FInputActionValue& Value)
{
	bAiming = false;
	bHoldingBreath = false;
	UpdateSprintWish();
	ServerSetAim(false, false);
}

// ---------------------------------------------------------------------------
// Estado y red
// ---------------------------------------------------------------------------

void ATdnCharacter::RequestStance(ETdnStance NewStance)
{
	if (Body->IsUnconscious() || Body->IsDead() || NewStance == Stance)
	{
		return;
	}
	Stance = NewStance;
	ApplyStance();
	ServerSetStance(NewStance);
}

void ATdnCharacter::ApplyStance()
{
	// Tumbado usa de momento la cápsula de agachado; la cápsula horizontal llega con las animaciones
	if (Stance == ETdnStance::Stand)
	{
		UnCrouch();
	}
	else
	{
		Crouch();
	}
}

void ATdnCharacter::OnRep_Stance()
{
	if (IsLocallyControlled())
	{
		ApplyStance();
	}
}

void ATdnCharacter::UpdateLeanTarget()
{
	const int8 NewTarget = (bLeanRightHeld ? 1 : 0) - (bLeanLeftHeld ? 1 : 0);
	if (NewTarget != LeanTarget)
	{
		LeanTarget = NewTarget;
		ServerSetLean(NewTarget);
	}
}

void ATdnCharacter::UpdateSprintWish()
{
	// solo se esprinta hacia delante
	const bool bWants = bSprintHeld && !bAiming && MoveInput.Y > 0.5f && FMath::Abs(MoveInput.X) < 0.75f;
	if (bWants != bWantsSprint)
	{
		bWantsSprint = bWants;
		ServerSetSprint(bWants);
	}
}

void ATdnCharacter::ServerSetStance_Implementation(ETdnStance NewStance)
{
	if (Body->IsUnconscious() || Body->IsDead())
	{
		return;
	}
	Stance = NewStance;
	if (IsLocallyControlled())
	{
		ApplyStance();
	}
}

void ATdnCharacter::ServerSetSprint_Implementation(bool bWants) { bWantsSprint = bWants; }
void ATdnCharacter::ServerSetWalk_Implementation(bool bWalk) { bWalkMode = bWalk; }
void ATdnCharacter::ServerSetAim_Implementation(bool bAim, bool bHoldBreath) { bAiming = bAim; bHoldingBreath = bAim && bHoldBreath; }
void ATdnCharacter::ServerSetLean_Implementation(int8 Target) { LeanTarget = FMath::Clamp<int8>(Target, -1, 1); }

void ATdnCharacter::HandleConsciousness(bool bUnconscious)
{
	if (bUnconscious && HasAuthority())
	{
		// al desmayarse cae al suelo
		Stance = ETdnStance::Prone;
		bWantsSprint = false;
		bAiming = false;
		bHoldingBreath = false;
		if (IsLocallyControlled())
		{
			ApplyStance();
		}
	}
}

void ATdnCharacter::HandleDeath(const FString& Cause)
{
	MulticastDeath();
	if (ATdnGameMode* GameMode = GetWorld()->GetAuthGameMode<ATdnGameMode>())
	{
		GameMode->OnSurvivorDied(GetController());
	}
}

void ATdnCharacter::MulticastDeath_Implementation()
{
	if (APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (IsLocallyControlled())
		{
			DisableInput(PC);
		}
	}
	GetCharacterMovement()->StopMovementImmediately();
	GetCharacterMovement()->DisableMovement();
	GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	USkeletalMeshComponent* MeshComp = GetMesh();
	if (MeshComp && MeshComp->GetSkeletalMeshAsset() && MeshComp->GetPhysicsAsset())
	{
		MeshComp->SetCollisionProfileName(TEXT("Ragdoll"));
		MeshComp->SetSimulatePhysics(true);
	}
}

// ---------------------------------------------------------------------------
// Movimiento
// ---------------------------------------------------------------------------

bool ATdnCharacter::CanJumpInternal_Implementation() const
{
	return Super::CanJumpInternal_Implementation()
		&& Stance == ETdnStance::Stand
		&& !Body->IsLegBroken()
		&& !Body->IsUnconscious()
		&& Body->GetStamina() > JumpStaminaCost;
}

void ATdnCharacter::OnJumped_Implementation()
{
	Super::OnJumped_Implementation();
	if (HasAuthority())
	{
		Body->ConsumeStamina(JumpStaminaCost, 1.5f);
	}
}

void ATdnCharacter::Landed(const FHitResult& Hit)
{
	Super::Landed(Hit);
	if (!HasAuthority())
	{
		return;
	}
	const float FallSpeed = -GetVelocity().Z / CmPerM;
	if (FallSpeed <= FallDamageSpeed)
	{
		return;
	}
	FTdnDamage Damage;
	Damage.Amount = (FallSpeed - FallDamageSpeed) * 12.f;
	Damage.BleedChance = Damage.Amount > 25.f ? 0.4f : 0.f;
	Damage.Shock = Damage.Amount * 1.5f;
	Damage.FractureChance = Damage.Amount > 14.f ? 0.8f : (Damage.Amount > 6.f ? 0.3f : 0.f);
	Damage.Cause = TEXT("una caída");
	Body->ApplyDamage(Damage);
}

void ATdnCharacter::UpdateMovementSpeed()
{
	UCharacterMovementComponent* Move = GetCharacterMovement();
	const bool bSprinting = bWantsSprint && Stance == ETdnStance::Stand && !bAiming && Body->CanSprint() && !Move->IsFalling();

	float Speed;
	if (Stance == ETdnStance::Prone)
	{
		Speed = ProneSpeed;
	}
	else if (Stance == ETdnStance::Crouch)
	{
		Speed = bWalkMode ? CrouchWalkSpeed : CrouchJogSpeed;
	}
	else if (bSprinting)
	{
		Speed = SprintSpeed;
	}
	else
	{
		Speed = bWalkMode ? WalkSpeed : JogSpeed;
	}

	// heridas y carga
	if (Body->IsLegBroken())
	{
		Speed = FMath::Min(Speed, Body->IsSplinted() ? 2.0f : 1.0f);
	}
	else if (Body->IsSplinted())
	{
		Speed = FMath::Min(Speed, 3.0f);
	}
	if (Body->GetCarriedKg() > 40.f)
	{
		Speed *= 0.8f;
	}
	if (bAiming)
	{
		Speed = FMath::Min(Speed, Stance == ETdnStance::Prone ? 0.4f : AimSpeedCap);
	}
	if (Body->GetHealth() < 25.f)
	{
		Speed *= 0.75f;
	}

	Move->MaxWalkSpeed = Speed * CmPerM;
	Move->MaxWalkSpeedCrouched = Speed * CmPerM;

	const float Ground = GetVelocity().Size2D() / CmPerM;
	Gait = Ground < 0.2f ? ETdnGait::Idle
		: (bSprinting && Ground > JogSpeed * 0.9f) ? ETdnGait::Sprint
		: Ground <= 1.7f ? ETdnGait::Walk
		: ETdnGait::Jog;
}

void ATdnCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (HasAuthority() || IsLocallyControlled())
	{
		UpdateMovementSpeed();
	}
	else
	{
		// otros jugadores: la forma de andar se deduce de la velocidad (para las animaciones)
		const float Ground = GetVelocity().Size2D() / CmPerM;
		Gait = Ground < 0.2f ? ETdnGait::Idle : Ground > JogSpeed * 1.1f ? ETdnGait::Sprint : Ground <= 1.7f ? ETdnGait::Walk : ETdnGait::Jog;
	}

	if (HasAuthority())
	{
		Body->SetActivity(Gait, Stance, bAiming && bHoldingBreath, Inventory->GetCarriedWeightKg());
	}

	Lean = FMath::FInterpTo(Lean, static_cast<float>(LeanTarget), DeltaSeconds, 8.f);

	if (IsLocallyControlled())
	{
		UpdateCamera(DeltaSeconds);
		DrawDebugBody();
	}
}

void ATdnCharacter::UpdateCamera(float DeltaSeconds)
{
	const float TargetFOV = bAiming ? AimFOV : DefaultFOV;
	const float TargetArm = bAiming ? AimArmLength : DefaultArmLength;
	FollowCamera->SetFieldOfView(FMath::FInterpTo(FollowCamera->FieldOfView, TargetFOV, DeltaSeconds, 10.f));
	CameraBoom->TargetArmLength = FMath::FInterpTo(CameraBoom->TargetArmLength, TargetArm, DeltaSeconds, 10.f);
	CameraBoom->SocketOffset.Y = 45.f + Lean * 40.f;

	// temblor al apuntar: cansancio, frío y heridas; aguantar la respiración lo reduce
	if (bAiming)
	{
		const float Time = GetWorld()->GetTimeSeconds();
		const float Amount = FMath::RadiansToDegrees(Body->GetAimSway()) * (bHoldingBreath ? 0.25f : 1.f);
		const float Yaw = (FMath::PerlinNoise1D(Time * 0.7f) + 0.5f * FMath::Sin(Time * 1.3f)) * Amount;
		const float Pitch = (FMath::PerlinNoise1D(Time * 0.9f + 17.f) + 0.5f * FMath::Sin(Time * 2.1f)) * Amount;
		FollowCamera->SetRelativeRotation(FRotator(Pitch, Yaw, Lean * -6.f));
	}
	else
	{
		FollowCamera->SetRelativeRotation(FRotator(0.f, 0.f, Lean * -6.f));
	}
}

void ATdnCharacter::DrawDebugBody() const
{
	if (!GEngine || CVarTdnDebugBody.GetValueOnGameThread() == 0)
	{
		return;
	}
	const FString Text = FString::Printf(
		TEXT("[PRUEBAS] Salud %.0f  Sangre %.0f  Shock %.0f\n")
		TEXT("Energía %.0f  Agua %.0f  Temp %.1f °C  Humedad %.0f%%\n")
		TEXT("Resistencia %.0f / %.0f%s  Carga %.1f kg\n")
		TEXT("%s, %s%s%s  Sangrados %d%s%s%s"),
		Body->GetHealth(), Body->GetBlood(), Body->GetShock(),
		Body->GetEnergy(), Body->GetWater(), Body->GetTemperature(), Body->GetWetness() * 100.f,
		Body->GetStamina(), Body->GetMaxStamina(), Body->IsExhausted() ? TEXT(" (agotado)") : TEXT(""), Body->GetCarriedKg(),
		StanceName(Stance), GaitName(Gait), bWalkMode ? TEXT(" (modo paso)") : TEXT(""), bAiming ? TEXT(", apuntando") : TEXT(""),
		Body->GetBleeds(),
		Body->HasFracture() ? TEXT("  Pierna rota") : TEXT(""),
		Body->HasFlu() ? TEXT("  Resfriado") : TEXT(""),
		Body->IsUnconscious() ? TEXT("  INCONSCIENTE") : TEXT(""));
	GEngine->AddOnScreenDebugMessage(9001, 0.f, FColor(230, 230, 210), Text);
}
