"""Busca el centro de los cubos circulares de cada articulación para ubicar su eje.

Para cada eje candidato (X, Y, Z) proyecta los vértices de las dos piezas que se unen y busca el centro
con más vértices a la misma distancia (anillos de tornillos y cubos). Parte de los pivotes del archivo de Blender."""
import pathlib, numpy as np
HERE = pathlib.Path(__file__).resolve().parent
P={k:np.load(HERE / "partes" / f"{k}.npz") for k in ["base_d","Join1","join2","join3","join4","join5","l6body_d"]}
def score(V, c, rmin, rmax, bw=0.2):
    r=np.hypot(V[:,0]-c[0], V[:,1]-c[1])
    r=r[(r>rmin)&(r<rmax)]
    if len(r)<50: return 0
    h=np.bincount((r/bw).astype(int))
    return (h.astype(float)**2).sum()/len(r)
def fit(name, axis, p, rmin=8, rmax=45, span=6.0, slab=None):
    V=P[name]["v"].astype(float)
    ax={'X':0,'Y':1,'Z':2}[axis]; o=[i for i in range(3) if i!=ax]
    if slab: V=V[np.abs(V[:,ax]-slab[0])<slab[1]] if False else V
    V2=V[:,o]; p2=np.array([p[o[0]],p[o[1]]])
    # keep only verts within rmax of approx center
    keep=np.hypot(*(V2-p2).T)<rmax+span
    V2=V2[keep]
    best=(0,p2)
    for step,rng in [(0.5,span),(0.1,1.0),(0.02,0.2)]:
        c0=best[1]
        g=np.arange(-rng,rng+1e-9,step)
        for du in g:
            for dv in g:
                c=c0+np.array([du,dv]); s=score(V2,c,rmin,rmax)
                if s>best[0]: best=(s,c)
    base=score(V2,p2,rmin,rmax)
    out=np.array(p,float); out[o[0]],out[o[1]]=best[1]
    return best[0],base,out
rig={ # STL frame (Y up), from Blender rig
 "J1":("Y",(3.236,85.097,-2.270),["base_d","Join1"]),
 "J2":("X",(0.017,122.619,20.740),["Join1","join2"]),
 "J3":("X",(-0.252,238.724,20.740),["join2","join3"]),
 "J4":("Z",(-0.252,300.208,19.506),["join3","join4"]),
 "J5":("X",(0.222,378.005,19.506),["join4","join5"]),
 "J6":("Z",(0.999,444.347,2.074),["join5","l6body_d"]),
}
for j,(axis,p,links) in rig.items():
    print(j, "rig axis",axis,"pivot",p)
    for cand in "XYZ":
        for ln in links:
            s,base,c=fit(ln,cand,p)
            mark="  <== rig" if cand==axis else ""
            print(f"   axis {cand} {ln:13s} score {s:8.1f} (at rig pivot {base:7.1f}) center {np.round(c,2)}{mark}")
