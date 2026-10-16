"""Importa el FBX del brazo con bpy y guarda cada pieza en partes/<nombre>.npz, en el marco del CAD (Y arriba, mm).

    python exportar_partes_fbx.py Brazo6GDLINTEL.fbx
"""
import bpy, sys, pathlib, numpy as np
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=sys.argv[1])
dg=bpy.context.evaluated_depsgraph_get()
for o in bpy.context.scene.objects:
    if o.type!='MESH': continue
    me=o.evaluated_get(dg).to_mesh()
    me.calc_loop_triangles()
    n=len(me.vertices)
    v=np.empty(n*3); me.vertices.foreach_get("co",v); v=v.reshape(-1,3)
    M=np.array(o.matrix_world)
    vw=(M[:3,:3]@v.T).T+M[:3,3]
    vs=np.column_stack([vw[:,0],vw[:,2],-vw[:,1]])   # Blender Z-up -> STL/glTF Y-up
    t=np.empty(len(me.loop_triangles)*3,dtype=np.int32); me.loop_triangles.foreach_get("vertices",t)
    name=o.name.replace(' ','_')
    OUT = pathlib.Path(__file__).resolve().parent / "partes"; OUT.mkdir(exist_ok=True); np.savez_compressed(OUT / f"{name}.npz",v=vs.astype(np.float32),f=t.reshape(-1,3))
    print(name, n, len(t)//3)
