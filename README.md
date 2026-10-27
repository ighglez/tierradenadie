# Tierra de Nadie

Juego de supervivencia realista en mundo abierto, hecho en **Unreal Engine 5**. Original e inspirado en el género: nombres, mapa y arte propios.

- Plan de diseño y arquitectura: https://claude.ai/artifact/BKJ1CgerNBJa11vG2eSZAm
- Cómo instalarlo y abrirlo: [Docs/GUIA-INSTALACION.md](Docs/GUIA-INSTALACION.md)
- Arte provisional y assets que hay que conseguir: [Docs/ASSETS.md](Docs/ASSETS.md)

## Estado

Fase 1, primer módulo en C++:

| Parte | Qué hace |
|---|---|
| `Survival/TdnBodyComponent` | Salud, sangre, shock y desmayo, hambre, sed, temperatura, humedad, resistencia y agotamiento, sangrados, fracturas, resfriado, intoxicación e infección. Lo calcula el servidor; tus valores privados solo los recibe tu propio cliente. |
| `Character/TdnCharacter` | Tercera persona por encima del hombro. De pie, agachado y tumbado; paso, trote y esprint (solo hacia delante); inclinarse; apuntar y aguantar la respiración; daño por caída. La carga y las heridas limitan la velocidad. |
| `Items/TdnItemTypes`, `TdnInventoryComponent` | Tabla de objetos (`Datos/Objetos.csv`, 50 objetos con su peso), reglas de aparición del botín e inventario básico que calcula la carga. |
| `Core/TdnGameMode` | El cadáver se queda en el suelo 15 minutos y el jugador reaparece desde cero. |

Las reglas y cifras vienen del prototipo de navegador (`Prototipo/`), que sirvió para probar las mecánicas. El prototipo **no** es el juego final.

## Controles por defecto

| Tecla | Acción |
|---|---|
| WASD / ratón | Moverse / mirar |
| Mayús | Esprintar (apuntando: aguantar la respiración) |
| Bloq Mayús | Alternar paso / trote |
| C / Z | Agacharse / tumbarse |
| Espacio | Saltar (agachado o tumbado: ponerse de pie) |
| Q / E | Inclinarse |
| Botón derecho | Apuntar |

En la consola (tecla º), `tdn.DebugCuerpo 0` oculta el panel de pruebas con el estado del cuerpo.

## Estructura

```
TierraDeNadie.uproject
Config/            ajustes del motor (Lumen, Nanite, sombras virtuales, Enhanced Input)
Source/            código C++ del juego
Datos/             tablas en CSV para importar como DataTable
Docs/              guías
Prototipo/         prototipo jugable en navegador (referencia de mecánicas)
```

Los assets binarios (`.uasset`, `.umap`, texturas, sonido) van por **Git LFS**.
