#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "TdnGameMode.generated.h"

/** Reglas de la partida. De momento: qué personaje se usa y reaparecer tras morir. */
UCLASS()
class TIERRADENADIE_API ATdnGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ATdnGameMode();

	/** El cuerpo se queda en el suelo (con lo que llevaba) y el jugador vuelve a empezar desde cero. */
	void OnSurvivorDied(AController* Controller);

protected:
	UPROPERTY(EditDefaultsOnly, Category = "Partida")
	float RespawnDelay = 8.f;

	/** Segundos que el cadáver permanece en el mundo. */
	UPROPERTY(EditDefaultsOnly, Category = "Partida")
	float CorpseLifeSpan = 900.f;
};
