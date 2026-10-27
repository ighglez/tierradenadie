# Guía de instalación

Para un PC con Windows. Tu equipo (Ryzen 9 3900X, 64 GB de RAM, gráfica de 12 GB) va sobrado para desarrollar este proyecto. Pon el proyecto en el disco **D:**, que es donde tienes espacio: entre la caché de shaders y los assets de Megascans, el proyecto llegará a ocupar entre 100 y 300 GB.

## 1. Programas necesarios (una sola vez)

1. **Unreal Engine 5** (ya lo tienes). Sirve la versión 5.4 o posterior.
2. **Visual Studio 2022 Community** (gratis): https://visualstudio.microsoft.com/es/vs/community/
   En el instalador, marca la carga de trabajo **"Desarrollo de juegos con C++"** y, dentro de ella, en el panel de la derecha:
   - **Instalador de Unreal Engine** (Unreal Engine installer)
   - **MSVC v143** (las herramientas de compilación más recientes)
   - **Windows 11 SDK** (o Windows 10 SDK) más reciente
   - **.NET Framework 4.8** (si aparece como opción)
3. **Git para Windows**: https://git-scm.com/download/win (trae Git LFS incluido).
   Después, una sola vez, abre "Git Bash" y escribe:
   ```
   git lfs install
   ```

> Si Unreal se queja de que falta algún componente al compilar, abre "Visual Studio Installer", pulsa "Modificar" y revisa que estén marcados los cuatro puntos de arriba.

## 2. Descargar el proyecto

En Git Bash:

```
cd /d/
mkdir -p Proyectos && cd Proyectos
git clone https://github.com/ighglez/tierradenadie.git
```

Quedará en `D:\Proyectos\tierradenadie`.

## 3. Asociar el proyecto con tu versión de Unreal

1. Abre la carpeta `D:\Proyectos\tierradenadie` en el Explorador.
2. Haz clic derecho sobre **TierraDeNadie.uproject** → **Mostrar más opciones** → **Switch Unreal Engine version...** y elige la versión que has instalado.
3. Clic derecho otra vez → **Generate Visual Studio project files**. Aparecerá `TierraDeNadie.sln`.

## 4. Compilar y abrir

1. Haz doble clic en **TierraDeNadie.uproject**.
2. Dirá que faltan los módulos de TierraDeNadie y preguntará si quieres compilarlos: pulsa **Sí**. La primera vez tarda unos minutos.
3. Si en lugar de abrirse da un error de compilación, abre `TierraDeNadie.sln` con Visual Studio, elige arriba **Development Editor** y **Win64**, y pulsa **Compilar → Compilar solución**. Copia el error de la ventana de salida y pásamelo.

(La primera vez que se abre, el editor compila miles de shaders: puede tardar 10-30 minutos. Es normal y solo pasa una vez.)

## 5. Primera prueba dentro del editor

1. **Personaje provisional**: en el Explorador de contenido pulsa **+ Añadir → Añadir paquete de funciones o contenido → Tercera persona → Añadir al proyecto**. El código usa ese maniquí automáticamente mientras no tengamos el personaje real.
2. **Mapa de pruebas**: **Archivo → Nuevo nivel → Open World** (o "Basic" si va lento) y guárdalo como `Content/Mapas/L_Pruebas`.
3. **Editar → Configuración del proyecto → Mapas y modos**: pon `L_Pruebas` como *Editor Startup Map* y *Game Default Map*. El modo de juego ya es `TdnGameMode`.
4. Pulsa **Play** (Alt+P). Verás arriba a la izquierda el panel **[PRUEBAS]** con el estado del cuerpo: esprinta y verás bajar la resistencia, salta desde una altura y verás el shock o una pierna rota.

## 6. Tabla de objetos (opcional por ahora)

1. Arrastra `Datos/Objetos.csv` al Explorador de contenido, dentro de una carpeta `Content/Datos`.
2. En la ventana que sale, elige **DataTable** y como estructura **TdnItemRow**. Nómbrala `DT_Objetos`.

Se conectará al inventario cuando hagamos el personaje como Blueprint en el siguiente paso.

## Problemas comunes

| Síntoma | Solución |
|---|---|
| "Could not be compiled. Try rebuilding from source manually" | Paso 4.3: compila desde Visual Studio y pásame el error. |
| No aparece "Switch Unreal Engine version" | Abre Epic Games Launcher una vez (registra el motor) y vuelve a probar. |
| Git dice que el archivo es un "pointer" de LFS | Falta `git lfs install`; ejecútalo y luego `git lfs pull`. |
| Muy pocos FPS en el editor | En el viewport: **Escalabilidad → Alto** en lugar de Épico. |
