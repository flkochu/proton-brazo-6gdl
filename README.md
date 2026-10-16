# PROTÓN · Brazo de 6 GDL: simulación web y URDF

Modelo cinemático del brazo de PROTÓN (Plague Bot VR, **First Prize en la Huawei ICT Competition 2025–2026**) armado a partir de sus piezas CAD: una simulación 3D en el navegador y un paquete URDF para ROS 2.

**Simulación:** https://flkochu.github.io/proton/

**Autor:** Adán López Lozano

## Contenido

```
web/                                   simulación 3D (three.js): brazo con las piezas CAD y chasis aproximado de fotos
ros2/proton_brazo_description/         paquete ROS 2: URDF, mallas visuales y de colisión, launch para RViz
verificacion/                          scripts que generan el modelo y comprueban la cinemática
```

## Cinemática

Marco del CAD: Y arriba, Z al frente, X a la izquierda (mm). Todas las articulaciones giran ±90° (servos de 180°).

| Articulación | Eje (CAD) | Pivote (mm) | Movimiento |
|---|---|---|---|
| J1 | Y | (0, 68.2, 0) | Giro de la base |
| J2 | X | (0, 121.9, 20.0) | Hombro, cabeceo |
| J3 | X | (0, 238.4, 20.0) | Codo, cabeceo |
| J4 | Z | (0, 300.6, 20.0) | Muñeca, lateral |
| J5 | X | (0, 377.9, 20.0) | Muñeca, cabeceo |
| J6 | Z | (0, 445.2, 20.0) | Giro de la cámara |
| Cámara | | (0, 445.0, 96.5) | Centro del frente de la RealSense |

Los ejes salen de las restricciones de rotación del archivo de Blender del equipo. Los pivotes se corrigieron (hasta 4 mm) con el centro de los anillos de tornillos y cubos de cada pieza (`verificacion/ajustar_ejes.py`).

En el URDF (convención de ROS: X al frente, Y a la izquierda, Z arriba), J1 gira sobre z; J2, J3 y J5 sobre y; J4 y J6 sobre x.

## Qué se verificó

```bash
pip install numpy trimesh yourdfpy
python verificacion/verificar_cinematica.py
```

```
URDF vs cinemática propia: 500 configuraciones, error máximo 1.77e-13 mm
Cámara en reposo (CAD, mm): [0.0, 445.0, 96.5]
Espacio de trabajo de la cámara (100 000 muestras, sin revisar choques):
  alcance horizontal máximo desde el eje J1: 378 mm
  altura sobre la base: -115 a 479 mm
```

La simulación web se comparó con la misma cinemática en 200 configuraciones al azar: misma posición de la cámara (diferencia de 0 mm).

## Simulación web

Abre `web/index.html` desde un servidor local (`python -m http.server` dentro de `web/`).

- Seis sliders, uno por articulación, con el ángulo real.
- Poses: recto, alcance al frente, mirar el envés, hacia un lado, plegado y combinada.
- Manejo del chasis con flechas o W A S D (tracción diferencial, ruedas que giran con la velocidad de cada lado).
- Campo de visión de la cámara (87° × 58°, el de profundidad de la D435i), ejes de las articulaciones y nube del espacio de trabajo.
- Posición de la cámara respecto a la base en vivo.

El brazo usa las piezas CAD reales (simplificadas a ~90 000 triángulos). El chasis es una aproximación hecha a partir de fotos y videos del robot.

## ROS 2

```bash
cp -r ros2/proton_brazo_description ~/ros2_ws/src/
cd ~/ros2_ws && colcon build --packages-select proton_brazo_description && source install/setup.bash
ros2 launch proton_brazo_description display.launch.py
```

Abre RViz con sliders para cada articulación. Las mallas de colisión son cascos convexos de cada pieza, listas para MoveIt2. Los valores de `effort` y `velocity` del URDF son de referencia: ajústalos a los servos reales.

El URDF y las mallas se validaron con `yourdfpy`; el launch y la configuración de RViz no se ejecutaron aquí.

## Regenerar el modelo

```bash
pip install bpy fast-simplification numpy trimesh
python verificacion/exportar_partes_fbx.py Brazo6GDLINTEL.fbx   # requiere bpy; exporta las piezas en el marco del CAD
python verificacion/generar_urdf.py                            # URDF y mallas
python verificacion/armar_glb.py                               # modelo para la web
```
