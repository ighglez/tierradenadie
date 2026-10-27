#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "Engine/StaticMesh.h"
#include "Engine/Texture2D.h"
#include "TdnItemTypes.generated.h"

UENUM(BlueprintType)
enum class ETdnItemCategory : uint8
{
	Food,
	Drink,
	Medical,
	Tool,
	Melee,
	Firearm,
	Ammo,
	Clothing,
	Misc
};

UENUM(BlueprintType)
enum class ETdnLootZone : uint8
{
	Coast,
	Town,
	Farm,
	Industrial,
	Medical,
	Hunting,
	Military
};

/**
 * Una fila de la tabla de objetos (DataTable). Se rellena importando Datos/Objetos.csv.
 * Pesos en kg; energía y agua en las mismas unidades que el prototipo (0-100).
 */
USTRUCT(BlueprintType)
struct FTdnItemRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objeto")
	FText DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objeto")
	ETdnItemCategory Category = ETdnItemCategory::Misc;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objeto", meta = (ClampMin = "0"))
	float WeightKg = 0.2f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objeto", meta = (ClampMin = "1"))
	int32 MaxStack = 1;

	/** Usos (botella, cerillas, spray...). 0 si no tiene. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objeto")
	int32 Charges = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Consumo")
	float Energy = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Consumo")
	float Water = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ropa")
	float Warmth = 0.f;

	/** 0 = se empapa, 1 = impermeable. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ropa", meta = (ClampMin = "0", ClampMax = "1"))
	float Waterproof = 0.f;

	/** Huecos de carga que aporta (ropa y mochilas). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ropa")
	int32 CargoSlots = 0;

	/** Ranura donde se equipa: None, jacket, backpack, helmet, shoulder, belt, melee. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objeto")
	FName EquipSlot = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objeto", meta = (MultiLine = true))
	FText Description;

	/** Malla del objeto en el suelo. Vacía = marcador provisional (ver Docs/ASSETS.md). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Arte")
	TSoftObjectPtr<UStaticMesh> Mesh;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Arte")
	TSoftObjectPtr<UTexture2D> Icon;
};

/** Reglas de aparición de un objeto en el mundo (equivalente a la economía central del género). */
USTRUCT(BlueprintType)
struct FTdnLootRow : public FTableRowBase
{
	GENERATED_BODY()

	/** Nombre de fila en la tabla de objetos. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Botín")
	FName ItemId;

	/** Cuántos debería haber en todo el mapa. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Botín")
	int32 Nominal = 10;

	/** Por debajo de este número se repone. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Botín")
	int32 Min = 5;

	/** Segundos que dura en el suelo sin que nadie lo toque. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Botín")
	int32 LifetimeSeconds = 3600;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Botín")
	int32 RestockSeconds = 1800;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Botín")
	TArray<ETdnLootZone> Zones;
};

/** Un objeto concreto que alguien lleva encima. */
USTRUCT(BlueprintType)
struct FTdnItemStack
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objeto")
	FName ItemId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objeto")
	int32 Quantity = 1;

	/** Estado de 1 (impecable) a 0 (destruido). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objeto")
	float Condition = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Objeto")
	int32 Charges = 0;
};
