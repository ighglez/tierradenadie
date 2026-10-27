# Tierra de Nadie

Juego de supervivencia en mundo abierto, en primera persona, inspirado en el género de DayZ.
Es un proyecto original: todo el código, el mapa, los modelos y los sonidos están generados por el propio juego.
No contiene contenido de DayZ ni está afiliado a Bohemia Interactive.

## Cómo jugar en local

1. Descomprime la carpeta donde quieras.
2. Haz doble clic en **index.html**. Se abre en tu navegador (Chrome, Edge o Firefox actualizados).
3. Pulsa **Nueva partida** y haz clic en la pantalla para capturar el ratón.

No necesita internet, instalación ni servidor.
Si va lento en tu ordenador, abre **Jugar en calidad baja.html** (sin sombras y menos resolución).

La partida se guarda sola cada 30 segundos y al cerrar la pestaña. Si mueres, el guardado se borra y vuelves a empezar en la costa, como en el género.

## Controles

| Tecla | Acción |
|---|---|
| WASD | Moverse (por defecto trotas) |
| Mayús | Esprintar (gasta resistencia) |
| Bloq Mayús | Alternar caminar / trotar |
| C | Agacharse |
| Z | Tumbarse (cuerpo a tierra) |
| Q / E | Asomarse a izquierda / derecha |
| Espacio | Saltar (gasta resistencia) |
| Clic izquierdo | Golpear / disparar |
| Clic derecho | Apuntar; con Mayús, contener la respiración |
| R | Recargar o desencasquillar |
| 1 / 2 / 3 | Arma larga / pistola / arma cuerpo a cuerpo |
| X | Guardar el arma |
| F | Interactuar: coger, beber, despiezar, romper ramas, cocinar |
| G | Llenar una botella |
| Tab o I | Inventario (usar, equipar, reparar, fabricar) |
| M | Mapa de papel (solo marca tu posición si llevas GPS) |
| K / J | Mirar la brújula / el reloj |
| H | Mostrar todos los iconos de estado |
| L | Linterna |
| Esc | Pausa |

## Qué hay en el juego

- **Mapa de 1,6 × 1,6 km**: costa sur, montañas al norte, lagos, bosques de abetos y frondosos con colores de otoño, prados de hierba alta, carreteras, 5 pueblos, 3 granjas y la base militar Volk.
- **Clima dinámico**: despejado, nuboso, cubierto, lluvia, tormenta y niebla, con nubes en el cielo. La lluvia te empapa (el chubasquero lo evita) y la niebla reduce la visión, también la de los infectados.
- **Noches oscuras**: sin linterna apenas se ve.
- **HUD mínimo**: los iconos solo aparecen cuando algo va mal. Sin minimapa ni marcadores.
- **Resistencia realista**: trotar no cansa, esprintar sí. La carga reduce la resistencia máxima; con más de 32 kg no puedes esprintar. Si te agotas, jadeas y tienes que recuperarte. Al apuntar el arma se balancea más cuanto más cansado estés; contener la respiración la estabiliza.
- **Cuerpo**: salud, sangre, shock (te desmayas si llega al límite), comida, agua, temperatura, humedad.
- **Lesiones y enfermedades**: sangrado, fracturas (caídas y golpes; entablillado o morfina), intoxicación (carne cruda, agua sucia; carbón activado), resfriado por frío (la tos atrae infectados; vitaminas), infección de heridas sin desinfectar (fiebre; antibióticos).
- **Desgaste**: armas, herramientas y ropa pasan de Impecable a Destruido. Las armas en mal estado se encasquillan. Se reparan con kit de costura o kit de limpieza.
- **Loot por tipo de edificio** y **peso** de cada objeto; el inventario lo marcan la chaqueta y la mochila.
- **Infectados** que te oyen (más si corres o toses) y te ven (menos si vas agachado o tumbado en la hierba), te persiguen y pueden hacerte sangrar, romperte un hueso o infectarte.
- **Armas**: puños, cuchillo, bate, hacha, pistola, escopeta, rifle de cerrojo con mira y fusil de asalto, con su munición.
- **Supervivencia**: ramas, hogueras, caza de ciervos, cocinar, pozos y lagos, pastillas potabilizadoras.
- **Muerte permanente**: tus cosas se quedan donde caíste y reapareces en la costa.

## Consejos

- Lo primero: encuentra agua, comida y algo para defenderte. Un cuchillo sirve para abrir latas y despiezar.
- Si sangras, véndate cuanto antes con trapos o vendas (desde el inventario).
- Muévete agachado cerca de los pueblos y evita correr junto a los infectados.
- La base militar tiene el mejor equipo, pero también muchos más infectados.

## Estructura

```
index.html            página del juego
style.css             interfaz
lib/three.min.js      motor 3D (three.js r149, licencia MIT)
js/util.js            ruido procedural y utilidades
js/gfx.js             texturas, cielo, hierba, lluvia y clima
js/world.js           terreno, pueblos, edificios, árboles, día/noche
js/items.js           objetos y tablas de loot
js/player.js          jugador, estado vital, inventario, acciones
js/combat.js          armas, disparos y cuerpo a cuerpo
js/ai.js              infectados y ciervos
js/fx.js              hogueras y partículas
js/audio.js           sonido sintetizado
js/ui.js              HUD, inventario y mapa
js/main.js            bucle principal, guardado y menús
```
