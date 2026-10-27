#include "Items/TdnInventoryComponent.h"
#include "TierraDeNadie.h"
#include "Net/UnrealNetwork.h"

UTdnInventoryComponent::UTdnInventoryComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	SetIsReplicatedByDefault(true);
}

void UTdnInventoryComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME_CONDITION(UTdnInventoryComponent, Items, COND_OwnerOnly);
}

const FTdnItemRow* UTdnInventoryComponent::FindRow(FName ItemId) const
{
	return ItemTable ? ItemTable->FindRow<FTdnItemRow>(ItemId, TEXT("Inventario"), false) : nullptr;
}

bool UTdnInventoryComponent::AddItem(FName ItemId, int32 Quantity)
{
	if (!GetOwner() || !GetOwner()->HasAuthority() || Quantity <= 0)
	{
		return false;
	}
	const FTdnItemRow* Row = FindRow(ItemId);
	if (!Row)
	{
		UE_LOG(LogTdn, Warning, TEXT("Objeto desconocido '%s' (¿falta asignar la tabla de objetos?)"), *ItemId.ToString());
		return false;
	}

	// primero rellena montones que ya lleve
	for (FTdnItemStack& Stack : Items)
	{
		if (Quantity <= 0)
		{
			break;
		}
		if (Stack.ItemId == ItemId && Stack.Quantity < Row->MaxStack)
		{
			const int32 Add = FMath::Min(Quantity, Row->MaxStack - Stack.Quantity);
			Stack.Quantity += Add;
			Quantity -= Add;
		}
	}
	while (Quantity > 0)
	{
		FTdnItemStack& Stack = Items.AddDefaulted_GetRef();
		Stack.ItemId = ItemId;
		Stack.Quantity = FMath::Min(Quantity, Row->MaxStack);
		Stack.Charges = Row->Charges;
		Quantity -= Stack.Quantity;
	}
	OnRep_Items();
	return true;
}

bool UTdnInventoryComponent::RemoveItem(FName ItemId, int32 Quantity)
{
	if (!GetOwner() || !GetOwner()->HasAuthority() || Quantity <= 0)
	{
		return false;
	}
	for (int32 i = Items.Num() - 1; i >= 0 && Quantity > 0; --i)
	{
		if (Items[i].ItemId != ItemId)
		{
			continue;
		}
		const int32 Take = FMath::Min(Quantity, Items[i].Quantity);
		Items[i].Quantity -= Take;
		Quantity -= Take;
		if (Items[i].Quantity <= 0)
		{
			Items.RemoveAt(i);
		}
	}
	OnRep_Items();
	return Quantity == 0;
}

void UTdnInventoryComponent::OnRep_Items()
{
	RecalculateWeight();
	OnInventoryChanged.Broadcast();
}

void UTdnInventoryComponent::RecalculateWeight()
{
	float Kg = 0.f;
	for (const FTdnItemStack& Stack : Items)
	{
		if (const FTdnItemRow* Row = FindRow(Stack.ItemId))
		{
			Kg += Row->WeightKg * Stack.Quantity;
		}
	}
	CachedWeightKg = Kg;
}
