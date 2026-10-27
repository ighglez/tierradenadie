#include "Core/TdnGameMode.h"
#include "Character/TdnCharacter.h"
#include "TimerManager.h"

ATdnGameMode::ATdnGameMode()
{
	DefaultPawnClass = ATdnCharacter::StaticClass();
}

void ATdnGameMode::OnSurvivorDied(AController* Controller)
{
	if (!Controller)
	{
		return;
	}
	if (APawn* Corpse = Controller->GetPawn())
	{
		Corpse->SetLifeSpan(CorpseLifeSpan);
	}
	Controller->UnPossess();

	TWeakObjectPtr<AController> WeakController = Controller;
	FTimerHandle Handle;
	GetWorldTimerManager().SetTimer(Handle, FTimerDelegate::CreateWeakLambda(this, [this, WeakController]()
	{
		if (WeakController.IsValid())
		{
			RestartPlayer(WeakController.Get());
		}
	}), RespawnDelay, false);
}
