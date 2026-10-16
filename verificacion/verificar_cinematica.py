"""Comprueba que el URDF y la simulación web usan la misma cinemática.

1. Cinemática directa propia (numpy) con los pivotes y ejes del CAD.
2. La misma cadena leída del URDF con yourdfpy.
Compara la posición de camera_link en 500 configuraciones al azar dentro de ±90°
y calcula el espacio de trabajo de la cámara.
"""
import pathlib, numpy as np, yourdfpy
HERE = pathlib.Path(__file__).resolve().parent
URDF = HERE.parent / "ros2/proton_brazo_description/urdf/proton_brazo.urdf"
J = [((0, 1, 0), (0, 68.2, 0)), ((1, 0, 0), (0, 121.9, 20.0)), ((1, 0, 0), (0, 238.4, 20.0)),
     ((0, 0, 1), (0, 300.6, 20.0)), ((1, 0, 0), (0, 377.9, 20.0)), ((0, 0, 1), (0, 445.2, 20.0))]
TCP = np.array((0, 445.0, 96.5))

def rot(a, t):
    a = np.array(a, float); K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + np.sin(t) * K + (1 - np.cos(t)) * K @ K

def fk_cad(qdeg):
    R, p, prev = np.eye(3), np.zeros(3), np.zeros(3)
    for (ax, pi), q in zip(J, np.radians(qdeg)):
        p = p + R @ (np.array(pi) - prev); R = R @ rot(ax, q); prev = np.array(pi, float)
    return p + R @ (TCP - prev), R

def cad2ros(v): return np.array([v[2], v[0], v[1]]) / 1000.0

def main():
    robot = yourdfpy.URDF.load(str(URDF), load_meshes=False, build_scene_graph=True)
    names = [j for j in robot.actuated_joint_names]
    assert names == ["j1", "j2", "j3", "j4", "j5", "j6"], names
    rng = np.random.default_rng(0)
    Q = rng.uniform(-90, 90, (500, 6))
    err = []
    for q in Q:
        robot.update_cfg(np.radians(q))
        T = robot.get_transform("camera_link", "base_link")
        err.append(np.linalg.norm(T[:3, 3] - cad2ros(fk_cad(q)[0])))
    err = np.array(err) * 1000
    print(f"URDF vs cinemática propia: {len(Q)} configuraciones, error máximo {err.max():.2e} mm")
    assert err.max() < 1e-6
    home = fk_cad([0] * 6)[0]
    print("Cámara en reposo (CAD, mm):", np.round(home, 1).tolist())
    W = rng.uniform(-90, 90, (100000, 6))
    P = np.array([fk_cad(q)[0] for q in W])
    r = np.hypot(P[:, 0], P[:, 2])
    print(f"Espacio de trabajo de la cámara (100 000 muestras, sin revisar choques):")
    print(f"  alcance horizontal máximo desde el eje J1: {r.max():.0f} mm")
    print(f"  altura sobre la base: {P[:, 1].min():.0f} a {P[:, 1].max():.0f} mm")
    above = P[:, 1] > 0
    print(f"  configuraciones con la cámara arriba de la base: {above.mean()*100:.0f} %")

if __name__ == "__main__":
    main()
