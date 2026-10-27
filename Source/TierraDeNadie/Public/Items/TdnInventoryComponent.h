#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Items/TdnItemTypes.h"
#include "TdnInventoryComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FTdnInventoryChanged);

/**
 * Lo que lleva encima el personaje. Primera versión: lista simple replicada solo a su dueño
 * (los demás jugadores no necesitan saber qué llevas en la mochila).
 * La rejilla de huecos y los contenedores anidados llegan en la fase de inventario.
 */
UCLASS(ClassGroup = (TierraDeNadie), meta = (BlueprintSpawnableComponent))
class TIERRADENADIE_API UTdnInventoryComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UTdnInventoryComponent();

	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	/** Tabla de objetos importada desde Datos/Objetos.csv (estructura FTdnItemRow). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Inventario")
	TObjectPtr<UDataTable> ItemTable;

	/** Solo en el servidor. Devuelve false si el objeto no existe en la tabla. */
	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Inventario")
	bool AddItem(FName ItemId, int32 Quantity = 1);

	UFUNCTION(BlueprintCallable, BlueprintAuthorityOnly, Category = "Inventario")
	bool RemoveItem(FName ItemId, int32 Quantity = 1);

	UFUNCTION(BlueprintPure, Category = "Inventario")
	float GetCarriedWeightKg() const { return CachedWeightKg; }

	UFUNCTION(BlueprintPure, Category = "Inventario")
	TArray<FTdnItemStack> GetItems() const { return Items; }

	const FTdnItemRow* FindRow(FName ItemId) const;

	UPROPERTY(BlueprintAssignable, Category = "Inventario")
	FTdnInventoryChanged OnInventoryChanged;

protected:
	UPROPERTY(ReplicatedUsing = OnRep_Items)
	TArray<FTdnItemStack> Items;

	UFUNCTION()
	void OnRep_Items();

private:
	void RecalculateWeight();

	float CachedWeightKg = 0.f;
};
