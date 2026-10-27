# Arte provisional y assets necesarios

Regla del proyecto: nada de formas primitivas como arte final. Mientras falte un asset real se usa un **marcador provisional**, marcado como tal en el código y en el registro (`[PROVISIONAL]`), y aquí se apunta qué hay que conseguir.

El código no puede generar arte fotorrealista: personajes, vegetación, edificios, animaciones y sonido tienen que venir de bibliotecas de assets o de un artista. Lo que sí hace el código es usar bien esos assets (Nanite, Lumen, materiales PBR, PCG para repartir la vegetación).

## Estado actual

| Elemento | Ahora | Asset real | Dónde conseguirlo |
|---|---|---|---|
| Personaje | Maniquí de Epic (paquete "Tercera persona") | MetaHuman con ropa propia | MetaHuman Creator (gratis para Unreal) |
| Animaciones de andar, agacharse, tumbarse | Las del maniquí (sin tumbado) | Locomoción completa con motion matching | *Game Animation Sample Project* de Epic (gratis, en Fab) |
| Terreno | Nivel "Open World" vacío | Paisaje de 10-20 km² con mapa de alturas real | Mapa de alturas propio o de datos públicos (p. ej. modelos digitales del terreno), esculpido en Landscape |
| Vegetación (pinos, abedules, hierba, matorral) | Ninguna | Árboles y hierba Nanite con viento | Fab: colecciones de Megascans de vegetación y bosque (revisa el precio y la licencia actuales) |
| Rocas y suelos | Ninguno | Escaneados PBR | Fab / Megascans |
| Edificios de pueblo y granjas | Ninguno | Kit modular de casas rurales de Europa del Este | Fab (kits modulares) o modelado propio |
| Objetos del suelo (latas, vendas...) | Sin malla (columna `Mesh` vacía en la tabla) | Mallas de baja escala con texturas PBR | Fab / Megascans "3D assets"; o un artista |
| Cielo y nubes | El del nivel por defecto | Sky Atmosphere + Volumetric Clouds (incluidos en Unreal) | Ya están en el motor; solo hay que ajustarlos |
| Sonido (viento, pasos, lluvia, armas) | Ninguno | Bibliotecas de efectos de campo | Fab, o bibliotecas de sonido con licencia comercial |
| Interfaz | Panel de texto de pruebas | Menús, inventario y HUD minimalistas (ver plan, sección 8) | Diseño propio en UMG |

## Orden recomendado para conseguirlos

1. *Game Animation Sample Project*: da locomoción realista de inmediato.
2. Un pack de vegetación de bosque templado (pinos y abedules) más hierba alta.
3. MetaHuman para el superviviente (y 4-5 variantes para los infectados).
4. Kit modular de casas rurales.
5. Sonido ambiente.

Cuando tengas cualquiera de ellos en el proyecto, dímelo y lo conecto en el código.
