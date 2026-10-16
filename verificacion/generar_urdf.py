"""Genera el paquete ROS 2 proton_brazo_description a partir de las piezas CAD del brazo.

Marco del CAD: Y arriba, Z al frente, X a la izquierda (mm).  Marco de ROS (REP 103): X al frente, Y a la izquierda, Z arriba (m).
Conversión: ros = (z_cad, x_cad, y_cad) / 1000
"""
import pathlib, sys, numpy as np, trimesh
HERE = pathlib.Path(__file__).resolve().parent
PKG = HERE.parent / "ros2" / "proton_brazo_description"
PARTS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "partes"   # .npz exportados del CAD (v en mm, marco CAD)

JOINTS = [  # (nombre, eje CAD, pivote CAD en mm)
    ("j1", (0, 1, 0), (0, 68.2, 0)),
    ("j2", (1, 0, 0), (0, 121.9, 20.0)),
    ("j3", (1, 0, 0), (0, 238.4, 20.0)),
    ("j4", (0, 0, 1), (0, 300.6, 20.0)),
    ("j5", (1, 0, 0), (0, 377.9, 20.0)),
    ("j6", (0, 0, 1), (0, 445.2, 20.0)),
]
TCP = (0, 445.0, 96.5)  # centro del frente de la cámara
MESH = {"base_link": ["base_d"], "link1": ["Join1"], "link2": ["join2"], "link3": ["join3"],
        "link4": ["join4"], "link5": ["join5"], "link6": ["l6body_d", "cam_d"]}

def cad2ros(v):
    v = np.asarray(v, float); return np.stack([v[..., 2], v[..., 0], v[..., 1]], -1) / 1000.0

def load(names):
    ms = []
    for n in names:
        d = np.load(PARTS / f"{n}.npz"); ms.append(trimesh.Trimesh(d["v"].astype(float), d["f"], process=True))
    return trimesh.util.concatenate(ms)

def simplify(m, target):
    if len(m.faces) <= target: return m
    return m.simplify_quadric_decimation(face_count=target)

def main():
    (PKG / "meshes/visual").mkdir(parents=True, exist_ok=True); (PKG / "meshes/collision").mkdir(parents=True, exist_ok=True)
    origins = {"base_link": (0, 0, 0)}
    for i, (_, _, p) in enumerate(JOINTS): origins[f"link{i+1}"] = p
    for link, names in MESH.items():
        m = load(names)
        m.vertices = cad2ros(m.vertices - np.array(origins[link]))
        vis = simplify(m, 6000)
        vis.export(PKG / f"meshes/visual/{link}.stl")
        m.convex_hull.export(PKG / f"meshes/collision/{link}.stl")
    L = ['<?xml version="1.0"?>',
         '<!-- Generado por verificacion/generar_urdf.py a partir del CAD del brazo de PROTÓN. -->',
         '<!-- effort y velocity son valores de referencia: ajústalos a los servos reales. -->',
         '<robot name="proton_brazo">',
         '  <material name="rojo"><color rgba="0.78 0.09 0.11 1"/></material>']
    def link_xml(name):
        return [f'  <link name="{name}">',
                f'    <visual><geometry><mesh filename="package://proton_brazo_description/meshes/visual/{name}.stl"/></geometry><material name="rojo"/></visual>',
                f'    <collision><geometry><mesh filename="package://proton_brazo_description/meshes/collision/{name}.stl"/></geometry></collision>',
                '  </link>']
    L += link_xml("base_link")
    prev = np.zeros(3); parent = "base_link"
    for i, (jn, ax, p) in enumerate(JOINTS):
        child = f"link{i+1}"
        xyz = cad2ros(np.array(p) - prev); axis = cad2ros(np.array(ax, float)) * 1000.0
        L += link_xml(child)
        L += [f'  <joint name="{jn}" type="revolute">',
              f'    <parent link="{parent}"/><child link="{child}"/>',
              f'    <origin xyz="{xyz[0]:.5f} {xyz[1]:.5f} {xyz[2]:.5f}" rpy="0 0 0"/>',
              f'    <axis xyz="{axis[0]:.0f} {axis[1]:.0f} {axis[2]:.0f}"/>',
              '    <limit lower="-1.5708" upper="1.5708" effort="2.0" velocity="3.0"/>',
              '  </joint>']
        prev = np.array(p, float); parent = child
    t = cad2ros(np.array(TCP) - prev)
    L += ['  <link name="camera_link"/>',
          '  <joint name="camera_joint" type="fixed">',
          '    <parent link="link6"/><child link="camera_link"/>',
          f'    <origin xyz="{t[0]:.5f} {t[1]:.5f} {t[2]:.5f}" rpy="0 0 0"/>',
          '  </joint>', '</robot>', '']
    (PKG / "urdf/proton_brazo.urdf").write_text("\n".join(L), encoding="utf-8")
    print("URDF y mallas generados en", PKG)

if __name__ == "__main__":
    main()
