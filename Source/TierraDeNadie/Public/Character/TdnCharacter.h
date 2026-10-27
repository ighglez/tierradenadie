#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "Survival/TdnBodyComponent.h"
#include "TdnCharacter.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UTdnInventoryComponent;
class UInputAction;
class UInputMappingContext;
struct FInputActionValue;

/**
 * El superviviente. Tercera persona por encima del hombro, posturas (de pie, agachado, tumbado),
 * paso / trote / esprint, inclinarse, apuntar y aguantar la respiración.
 * Velocidades en m/s iguales al prototipo; la carga y las heridas las limitan.
 *
 * Los controles se crean por código si no se asigna un Input Mapping Context, para que el
 * proyecto funcione nada más compilar. Más adelante se sustituyen por assets remapeables.
 */
UCLASS(Config = Game)
class TIERRADENADIE_API ATdnCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	ATdnCharacter(const FObjectInitializer& ObjectInitializer);

	virtual void Tick(float DeltaSeconds) override;
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void PawnClientRestart() override;
	virtual void Landed(const FHitResult& Hit) override;
	virtual void OnJumped_Implementation() override;

	UFUNCTION(BlueprintPure, Category = "Superviviente")
	UTdnBodyComponent* GetBody() const { return Body; }

	UFUNCTION(BlueprintPure, Category = "Superviviente")
	UTdnInventoryComponent* GetInventory() const { return Inventory; }

	UFUNCTION(BlueprintPure, Category = "Superviviente")
	ETdnStance GetStance() const { return Stance; }

	UFUNCTION(BlueprintPure, Category = "Superviviente")
	ETdnGait GetGait() const { return Gait; }

	/** -1 izquierda, 0 recto, 1 derecha (suavizado). */
	UFUNCTION(BlueprintPure, Category = "Superviviente")
	float GetLean() const { return Lean; }

	UFUNCTION(BlueprintPure, Category = "Superviviente")
	bool IsAiming() const { return bAiming; }

protected:
	virtual void BeginPlay() override;
	virtual bool CanJumpInternal_Implementation() const override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Componentes")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Componentes")
	TObjectPtr<UCameraComponent> FollowCamera;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Componentes")
	TObjectPtr<UTdnBodyComponent> Body;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Componentes")
	TObjectPtr<UTdnInventoryComponent> Inventory;

	// ---- Controles (opcionales: si están vacíos se crean por código) ----

	UPROPERTY(EditDefaultsOnly, Category = "Controles")
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY(EditDefaultsOnly, Category = "Controles") TObjectPtr<UInputAction> MoveAction;
	UPROPERTY(EditDefaultsOnly, Category = "Controles") TObjectPtr<UInputAction> LookAction;
	UPROPERTY(EditDefaultsOnly, Category = "Controles") TObjectPtr<UInputAction> SprintAction;
	UPROPERTY(EditDefaultsOnly, Category = "Controles") TObjectPtr<UInputAction> WalkToggleAction;
	UPROPERTY(EditDefaultsOnly, Category = "Controles") TObjectPtr<UInputAction> CrouchAction;
	UPROPERTY(EditDefaultsOnly, Category = "Controles") TObjectPtr<UInputAction> ProneAction;
	UPROPERTY(EditDefaultsOnly, Category = "Controles") TObjectPtr<UInputAction> JumpAction;
	UPROPERTY(EditDefaultsOnly, Category = "Controles") TObjectPtr<UInputAction> LeanLeftAction;
	UPROPERTY(EditDefaultsOnly, Category = "Controles") TObjectPtr<UInputAction> LeanRightAction;
	UPROPERTY(EditDefaultsOnly, Category = "Controles") TObjectPtr<UInputAction> AimAction;

	// ---- Movimiento (m/s, como en el prototipo) ----

	UPROPERTY(EditDefaultsOnly, Config, Category = "Movimiento") float WalkSpeed = 1.6f;
	UPROPERTY(EditDefaultsOnly, Config, Category = "Movimiento") float JogSpeed = 3.7f;
	UPROPERTY(EditDefaultsOnly, Config, Category = "Movimiento") float SprintSpeed = 6.2f;
	UPROPERTY(EditDefaultsOnly, Config, Category = "Movimiento") float CrouchWalkSpeed = 1.2f;
	UPROPERTY(EditDefaultsOnly, Config, Category = "Movimiento") float CrouchJogSpeed = 2.2f;
	UPROPERTY(EditDefaultsOnly, Config, Category = "Movimiento") float ProneSpeed = 0.75f;
	UPROPERTY(EditDefaultsOnly, Config, Category = "Movimiento") float AimSpeedCap = 1.6f;
	UPROPERTY(EditDefaultsOnly, Config, Category = "Movimiento") float JumpStaminaCost = 15.f;

	/** Velocidad de caída (m/s) a partir de la cual hace daño. */
	UPROPERTY(EditDefaultsOnly, Config, Category = "Movimiento") float FallDamageSpeed = 7.f;

	// ---- Cámara ----

	UPROPERTY(EditDefaultsOnly, Category = "Camara") float DefaultFOV = 80.f;
	UPROPERTY(EditDefaultsOnly, Category = "Camara") float AimFOV = 60.f;
	UPROPERTY(EditDefaultsOnly, Category = "Camara") float DefaultArmLength = 230.f;
	UPROPERTY(EditDefaultsOnly, Category = "Camara") float AimArmLength = 120.f;

private:
	// entrada
	void Move(const FInputActionValue& Value);
	void MoveCompleted(const FInputActionValue& Value);
	void Look(const FInputActionValue& Value);
	void SprintPressed(const FInputActionValue& Value);
	void SprintReleased(const FInputActionValue& Value);
	void WalkTogglePressed(const FInputActionValue& Value);
	void CrouchPressed(const FInputActionValue& Value);
	void PronePressed(const FInputActionValue& Value);
	void JumpPressed(const FInputActionValue& Value);
	void LeanLeftPressed(const FInputActionValue& Value);
	void LeanLeftReleased(const FInputActionValue& Value);
	void LeanRightPressed(const FInputActionValue& Value);
	void LeanRightReleased(const FInputActionValue& Value);
	void AimPressed(const FInputActionValue& Value);
	void AimReleased(const FInputActionValue& Value);

	void EnsureDefaultInput();
	void ApplyPlaceholderMeshIfMissing();
	void RequestStance(ETdnStance NewStance);
	void ApplyStance();
	void UpdateLeanTarget();
	void UpdateSprintWish();
	void UpdateMovementSpeed();
	void UpdateCamera(float DeltaSeconds);
	void DrawDebugBody() const;

	UFUNCTION()
	void HandleDeath(const FString& Cause);

	UFUNCTION()
	void HandleConsciousness(bool bUnconscious);

	// estado replicado
	UPROPERTY(ReplicatedUsing = OnRep_Stance)
	ETdnStance Stance = ETdnStance::Stand;

	UPROPERTY(Replicated)
	bool bWantsSprint = false;

	UPROPERTY(Replicated)
	bool bWalkMode = false;

	UPROPERTY(Replicated)
	bool bAiming = false;

	UPROPERTY(Replicated)
	bool bHoldingBreath = false;

	UPROPERTY(Replicated)
	int8 LeanTarget = 0;

	UFUNCTION()
	void OnRep_Stance();

	UFUNCTION(Server, Reliable) void ServerSetStance(ETdnStance NewStance);
	UFUNCTION(Server, Reliable) void ServerSetSprint(bool bWants);
	UFUNCTION(Server, Reliable) void ServerSetWalk(bool bWalk);
	UFUNCTION(Server, Reliable) void ServerSetAim(bool bAim, bool bHoldBreath);
	UFUNCTION(Server, Reliable) void ServerSetLean(int8 Target);

	UFUNCTION(NetMulticast, Reliable)
	void MulticastDeath();

	// local
	ETdnGait Gait = ETdnGait::Idle;
	float Lean = 0.f;
	FVector2D MoveInput = FVector2D::ZeroVector;
	bool bSprintHeld = false;
	bool bLeanLeftHeld = false;
	bool bLeanRightHeld = false;
};
