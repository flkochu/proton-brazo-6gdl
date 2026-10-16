"""Arma web/proton_arm.glb con las piezas de partes/ (en metros, sin jerarquía: la simulación arma la cadena)."""
import pathlib, numpy as np, trimesh, fast_simplification as fs, json
HERE = pathlib.Path(__file__).resolve().parent
def load(n):
    d=np.load(HERE / "partes" / f"{n}.npz"); return trimesh.Trimesh(d["v"].astype(np.float64),d["f"],process=True)
def dec(m, target):
    if len(m.faces)<=target: return m
    v,f=fs.simplify(m.vertices.astype(np.float32), m.faces.astype(np.int32), target_reduction=1-target/len(m.faces), agg=7)
    out=trimesh.Trimesh(v,f,process=True); return out
plan={"l1":("Join1",9000),"l2":("join2",13000),"l3":("join3",12000),"l4":("join4",10000),"l5":("join5",14000)}
meshes={}
for k,(n,t) in plan.items(): meshes[k]=dec(load(n),t)
meshes={"base":load("base_d"),**meshes,"l6":load("l6body_d"),"cam":load("cam_d")}
scene=trimesh.Scene()
stats={}
for k,m in meshes.items():
    m.apply_scale(0.001)
    m.visual=trimesh.visual.ColorVisuals(m)  # no colors; viewer assigns materials
    scene.add_geometry(m,node_name=k,geom_name=k)
    stats[k]=len(m.faces)
glb=scene.export(file_type="glb", include_normals=False)
open(HERE.parent / "web" / "proton_arm.glb","wb").write(glb)
print(stats, sum(stats.values()), "faces;", round(len(glb)/1e6,2),"MB")
