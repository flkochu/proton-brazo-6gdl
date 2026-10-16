// PROTÓN virtual: chasis aproximado a partir de fotos + brazo de 6 GDL con las piezas CAD reales.
// Uso: import { mountProton } from "./sim.js"; const sim = await mountProton(el, { glb: "proton/proton_arm.glb", lang: "es" });
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

/* ---------- Cinemática del brazo (metros, marco del CAD: Y arriba, Z al frente, X a la izquierda del robot) ----------
   Pivotes y ejes ajustados a los cubos circulares de cada pieza; límites de ±90° (servos de 180°). */
export const JOINTS = [
  { id: "J1", axis: [0, 1, 0], p: [0, 0.0682, 0] },
  { id: "J2", axis: [1, 0, 0], p: [0, 0.1219, 0.020] },
  { id: "J3", axis: [1, 0, 0], p: [0, 0.2384, 0.020] },
  { id: "J4", axis: [0, 0, 1], p: [0, 0.3006, 0.020] },
  { id: "J5", axis: [1, 0, 0], p: [0, 0.3779, 0.020] },
  { id: "J6", axis: [0, 0, 1], p: [0, 0.4452, 0.020] },
];
export const LIMIT = 90;
export const TCP = [0, 0.445, 0.0965]; // centro del frente de la cámara
const LINKS = ["l1", "l2", "l3", "l4", "l5", "l6"];

/* ---------- Chasis (aproximado de fotos y video) ---------- */
const CH = { W: 0.30, L: 0.40, H: 0.20, clear: 0.035, prof: 0.02, wheelR: 0.05, wheelW: 0.04, axleY: 0.05, wheelX: 0.225, wheelZ: 0.15, armZ: 0.03 };
CH.top = CH.clear + CH.H;
const TRACK = CH.wheelX * 2;

export const POSES = {
  home:   [0, 0, 0, 0, 0, 0],
  reach:  [0, 50, 45, 0, -25, 0],
  under:  [0, 60, -30, 0, -90, 0],
  side:   [65, 35, 40, 0, -35, 0],
  fold:   [0, -40, 85, 0, 45, 0],
  twist:  [-35, 25, 30, 55, -20, 40],
};

const T = {
  es: {
    arm: "Brazo de 6 GDL", chassis: "Chasis", view: "Vista",
    j: ["Base, giro", "Hombro", "Codo", "Muñeca, lateral", "Muñeca, cabeceo", "Cámara, giro"],
    poses: { home: "Recto", reach: "Alcance al frente", under: "Mirar el envés", side: "Hacia un lado", fold: "Plegado", twist: "Combinada" },
    demo: "Recorrer poses", stop: "Detener", reset: "Centrar robot",
    drive: "Manejar", keys: "Teclas W A S D o flechas",
    fwd: "Avanzar", back: "Retroceder", left: "Girar a la izquierda", right: "Girar a la derecha",
    ws: "Espacio de trabajo", axes: "Ejes de las articulaciones", fov: "Campo de visión de la cámara",
    tcp: "Cámara respecto a la base", wheels: "Ruedas", v: "v", w: "ω",
    wsNote: "Nube de 4000 configuraciones al azar dentro de ±90°. No revisa choques entre piezas.",
    reachLbl: "Alcance horizontal máx.", hLbl: "Altura de la cámara",
    loading: "Cargando modelo…", hint: "Arrastra para girar la vista, rueda o pellizco para acercar",
    approx: "Brazo: piezas CAD reales. Chasis: aproximado a partir de fotos.",
    err: "No se pudo cargar el modelo 3D. Revisa la conexión y recarga la página.",
  },
  en: {
    arm: "6-DOF arm", chassis: "Chassis", view: "View",
    j: ["Base, yaw", "Shoulder", "Elbow", "Wrist, lateral", "Wrist, pitch", "Camera, roll"],
    poses: { home: "Upright", reach: "Reach forward", under: "Look at leaf underside", side: "To the side", fold: "Folded", twist: "Combined" },
    demo: "Cycle poses", stop: "Stop", reset: "Recenter robot",
    drive: "Drive", keys: "W A S D or arrow keys",
    fwd: "Forward", back: "Reverse", left: "Turn left", right: "Turn right",
    ws: "Workspace", axes: "Joint axes", fov: "Camera field of view",
    tcp: "Camera relative to base", wheels: "Wheels", v: "v", w: "ω",
    wsNote: "Cloud of 4000 random configurations within ±90°. Self-collisions are not checked.",
    reachLbl: "Max. horizontal reach", hLbl: "Camera height",
    loading: "Loading model…", hint: "Drag to orbit, scroll or pinch to zoom",
    approx: "Arm: real CAD parts. Chassis: approximated from photos.",
    err: "The 3D model could not load. Check your connection and reload the page.",
  },
};

const CSS = `
.psim{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,320px);border:1px solid var(--ink,#172024);background:var(--sheet,#F4F7F4);color:var(--ink,#172024);font-family:inherit}
.psim-view{position:relative;min-width:0;height:clamp(380px,52vw,620px);border-right:1px solid var(--ink,#172024);overflow:hidden;touch-action:none}
.psim-view canvas{display:block;width:100%!important;height:100%!important}
.psim-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;transition:opacity .4s}
.psim-hud{position:absolute;left:12px;top:10px;right:12px;display:flex;justify-content:space-between;gap:10px;font-size:.75rem;color:var(--ink-2,#4C585E);pointer-events:none}
.psim-read{position:absolute;left:12px;bottom:10px;display:grid;grid-template-columns:auto auto;gap:2px 12px;font-size:.75rem;font-variant-numeric:tabular-nums;background:color-mix(in srgb,var(--sheet,#F4F7F4) 82%,transparent);padding:6px 9px;border:1px solid var(--rule,#A7B3AE)}
.psim-read b{font-weight:620;color:var(--ink,#172024)}
.psim-read span{color:var(--ink-2,#4C585E)}
.psim-msg{position:absolute;inset:0;display:grid;place-items:center;font-size:.9rem;color:var(--ink-2,#4C585E);text-align:center;padding:16px}
.psim-panel{display:flex;flex-direction:column;min-width:0;font-size:.8125rem;max-height:clamp(380px,52vw,620px);overflow:auto}
.psim-sec{padding:12px 14px;border-bottom:1px solid var(--rule,#A7B3AE);display:grid;gap:8px}
.psim-sec:last-child{border-bottom:0}
.psim-sec h4{margin:0;font-size:.875rem;font-weight:700}
.psim-j{display:grid;grid-template-columns:2.2em minmax(0,1fr) 3.4em;align-items:center;gap:2px 8px}
.psim-j label{grid-column:1 / 3;color:var(--ink-2,#4C585E);font-size:.75rem}
.psim-j .id{font-weight:650;font-variant-numeric:tabular-nums}
.psim-j output{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.psim-j input{grid-column:1 / -1;width:100%;accent-color:var(--blue,#2240C2);margin:0}
.psim-btns{display:flex;flex-wrap:wrap;gap:5px}
.psim button{font:inherit;font-size:.75rem;border:1px solid var(--rule,#A7B3AE);background:transparent;color:inherit;padding:4px 9px;cursor:pointer}
.psim button:hover{border-color:var(--ink,#172024)}
.psim button[aria-pressed="true"]{background:var(--ink,#172024);color:var(--sheet,#F4F7F4);border-color:var(--ink,#172024)}
.psim :focus-visible{outline:2px solid var(--blue,#2240C2);outline-offset:2px}
.psim-pad{display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,36px);gap:5px}
.psim-pad button{padding:0;font-size:1rem;touch-action:none;user-select:none}
.psim-pad .up{grid-column:2}
.psim-pad .lf{grid-column:1;grid-row:2}.psim-pad .dn{grid-column:2;grid-row:2}.psim-pad .rt{grid-column:3;grid-row:2}
.psim-drive{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.psim-small{font-size:.7rem;color:var(--ink-2,#4C585E)}
.psim-tg{display:flex;align-items:center;gap:8px;cursor:pointer}
.psim-tg input{accent-color:var(--blue,#2240C2);margin:0}
.psim-stats{display:grid;grid-template-columns:auto auto;gap:2px 10px;font-variant-numeric:tabular-nums}
.psim-stats b{font-weight:620}
@media (max-width:820px){.psim-read{font-size:.65rem;gap:1px 8px}.psim-read span:nth-of-type(n+2),.psim-read b:nth-of-type(n+2){display:none}.psim{grid-template-columns:minmax(0,1fr)}.psim-view{border-right:0;border-bottom:1px solid var(--ink,#172024);height:min(110vw,520px)}.psim-panel{max-height:none}}
`;

// Carga el .glb; si el servidor no lo entrega, intenta la copia en base64 (<archivo>.glb.json)
async function loadGLB(url) {
  const loader = new GLTFLoader();
  try { return await loader.loadAsync(url); }
  catch (e) {
    const r = await fetch(url + ".json");
    if (!r.ok) throw e;
    const { b64 } = await r.json();
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return await loader.parseAsync(bin.buffer, "");
  }
}

function tok(el, name, fb) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fb;
}
const deg = (d) => (d * Math.PI) / 180;

export async function mountProton(el, opts = {}) {
  let lang = opts.lang === "en" ? "en" : "es";
  if (!document.getElementById("psim-css")) {
    const s = document.createElement("style"); s.id = "psim-css"; s.textContent = CSS; document.head.appendChild(s);
  }
  el.innerHTML = "";
  const root = document.createElement("div"); root.className = "psim"; el.appendChild(root);
  const view = document.createElement("div"); view.className = "psim-view"; root.appendChild(view);
  const panel = document.createElement("div"); panel.className = "psim-panel"; root.appendChild(panel);
  if (opts.poster) { const im = new Image(); im.className = "psim-poster"; im.alt = ""; im.src = opts.poster; view.appendChild(im); }
  const msg = document.createElement("div"); msg.className = "psim-msg"; view.appendChild(msg);
  const hud = document.createElement("div"); hud.className = "psim-hud"; view.appendChild(hud);
  const read = document.createElement("div"); read.className = "psim-read"; view.appendChild(read);

  /* ---------- three.js ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opts.preserve });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  view.insertBefore(renderer.domElement, view.firstChild);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.01, 30);
  camera.position.set(1.05, 0.78, 1.25);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.36, 0); controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 0.45; controls.maxDistance = 4.5; controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f94, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(1.6, 2.6, 1.2); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -1; sun.shadow.camera.right = 1; sun.shadow.camera.top = 1; sun.shadow.camera.bottom = -1;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 6; sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.55); fill.position.set(-1.5, 1.2, -1); scene.add(fill);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  let grid = null;

  const M = {
    red: new THREE.MeshStandardMaterial({ color: 0xc8161d, roughness: 0.55, metalness: 0.02 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc3c9ce, roughness: 0.32, metalness: 0.75 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x24272a, roughness: 0.6, metalness: 0.2 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.92 }),
    hub: new THREE.MeshStandardMaterial({ color: 0x5b6166, roughness: 0.5, metalness: 0.4 }),
    acrylic: new THREE.MeshStandardMaterial({ color: 0xdbe8f0, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x1f6b45, roughness: 0.7 }),
    pcb2: new THREE.MeshStandardMaterial({ color: 0x1d4e8f, roughness: 0.7 }),
    batt: new THREE.MeshStandardMaterial({ color: 0x8e1b1f, roughness: 0.6 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.15, metalness: 0.4 }),
  };

  /* robot root: ground frame, heading about Y */
  const robot = new THREE.Group(); scene.add(robot);
  const cast = (o) => { o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };

  /* chassis */
  const chassis = new THREE.Group(); robot.add(chassis);
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); chassis.add(b); return b; };
  const { W, L, H, clear, prof } = CH, yb = clear + prof / 2, yt = clear + H - prof / 2, ym = clear + H / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(prof, H, prof, M.alu, sx * (W - prof) / 2, ym, sz * (L - prof) / 2);
  for (const y of [yb, yt]) {
    for (const sz of [-1, 1]) box(W, prof, prof, M.alu, 0, y, sz * (L - prof) / 2);
    for (const sx of [-1, 1]) box(prof, prof, L - 2 * prof, M.alu, sx * (W - prof) / 2, y, 0);
  }
  for (const sx of [-1, 1]) box(prof, H - 2 * prof, prof, M.alu, sx * (W - prof) / 2, ym, 0);
  const acr = 0.004;
  const ac1 = box(W - 0.004, acr, L - 0.004, M.acrylic, 0, clear + H + acr / 2, 0); ac1.castShadow = false;
  for (const sx of [-1, 1]) { const a = box(acr, H - 0.01, L - 0.01, M.acrylic, sx * (W / 2 + acr / 2), ym, 0); a.castShadow = false; }
  for (const sz of [-1, 1]) { const a = box(W - 0.01, H - 0.01, acr, M.acrylic, 0, ym, sz * (L / 2 + acr / 2)); a.castShadow = false; }
  box(W - 0.03, 0.004, L - 0.03, M.dark, 0, clear + 0.012, 0);
  box(0.16, 0.05, 0.07, M.batt, 0.03, clear + 0.04, -0.07);
  box(0.12, 0.012, 0.09, M.pcb, -0.06, clear + 0.10, 0.06);
  box(0.09, 0.012, 0.07, M.pcb2, 0.07, clear + 0.12, 0.08);
  box(0.07, 0.03, 0.05, M.dark, -0.07, clear + 0.03, -0.11);
  /* motors, shafts and wheels */
  const wheels = [];
  const cyl = (r, len, m) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 28), m);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const motor = cyl(0.018, 0.075, M.alu); motor.rotation.z = Math.PI / 2; motor.position.set(sx * (W / 2 - 0.06), CH.axleY, sz * CH.wheelZ); chassis.add(motor);
    const cap = cyl(0.02, 0.012, M.dark); cap.rotation.z = Math.PI / 2; cap.position.set(sx * (W / 2 - 0.104), CH.axleY, sz * CH.wheelZ); chassis.add(cap);
    const shaftLen = CH.wheelX - (W / 2 - 0.022);
    const shaft = cyl(0.006, shaftLen, M.alu); shaft.rotation.z = Math.PI / 2; shaft.position.set(sx * (W / 2 - 0.022 + shaftLen / 2), CH.axleY, sz * CH.wheelZ); chassis.add(shaft);
    const coup = cyl(0.011, 0.03, M.alu); coup.rotation.z = Math.PI / 2; coup.position.set(sx * (W / 2 + 0.03), CH.axleY, sz * CH.wheelZ); chassis.add(coup);
    const w = new THREE.Group(); w.position.set(sx * CH.wheelX, CH.axleY, sz * CH.wheelZ); chassis.add(w);
    const tire = cyl(CH.wheelR, CH.wheelW, M.rubber); tire.rotation.z = Math.PI / 2; w.add(tire);
    for (let k = 0; k < 10; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(CH.wheelW * 0.9, 0.006, 0.012), M.rubber); const a = (k / 10) * Math.PI * 2; t.position.set(0, Math.cos(a) * CH.wheelR, Math.sin(a) * CH.wheelR); t.rotation.x = -a; w.add(t); }
    const hub = cyl(CH.wheelR * 0.55, CH.wheelW + 0.004, M.hub); hub.rotation.z = Math.PI / 2; w.add(hub);
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(CH.wheelW + 0.006, 0.006, CH.wheelR * 0.5), M.dark); sp.rotation.x = (k / 5) * Math.PI * 2; w.add(sp); }
    wheels.push({ g: w, side: sx });
  }
  /* LiDAR */
  const lidar = new THREE.Group(); lidar.position.set(-0.095, CH.top + 0.004, 0.09); chassis.add(lidar);
  const lb = cyl(0.034, 0.035, M.red); lb.position.y = 0.0175; lidar.add(lb);
  const lt = cyl(0.028, 0.02, M.dark); lt.position.y = 0.045; lidar.add(lt);
  cast(chassis);

  /* arm */
  const armRoot = new THREE.Group(); armRoot.position.set(0, CH.top + 0.004 + 0.0068, CH.armZ); robot.add(armRoot);
  const jointG = []; let parent = armRoot, prev = [0, 0, 0];
  for (const J of JOINTS) {
    const g = new THREE.Group(); g.position.set(J.p[0] - prev[0], J.p[1] - prev[1], J.p[2] - prev[2]);
    g.userData.axis = new THREE.Vector3(...J.axis); parent.add(g); jointG.push(g); parent = g; prev = J.p;
  }
  const tcp = new THREE.Object3D(); tcp.position.set(TCP[0] - prev[0], TCP[1] - prev[1], TCP[2] - prev[2]); jointG[5].add(tcp);
  const q = [0, 0, 0, 0, 0, 0], qTarget = [0, 0, 0, 0, 0, 0];
  const applyQ = (qq) => { jointG.forEach((g, i) => g.quaternion.setFromAxisAngle(g.userData.axis, deg(qq[i]))); };

  /* axes helpers + FOV */
  const axesGroup = new THREE.Group(); axesGroup.visible = false;
  const lineMat = new THREE.LineBasicMaterial({ color: 0x2240c2 });
  jointG.forEach((g) => {
    const a = g.userData.axis.clone().multiplyScalar(0.09);
    const geo = new THREE.BufferGeometry().setFromPoints([a.clone().negate(), a]);
    const ln = new THREE.Line(geo, lineMat); g.add(ln); ln.visible = false; ln.userData.axisLine = true;
  });
  const fovMat = new THREE.LineBasicMaterial({ color: 0x2240c2, transparent: true, opacity: 0.5 });
  const fovG = new THREE.Group(); tcp.add(fovG);
  { const d = 0.2, hx = Math.tan(deg(87 / 2)) * d, hy = Math.tan(deg(58 / 2)) * d, c = [[hx, hy], [-hx, hy], [-hx, -hy], [hx, -hy]];
    const pts = []; c.forEach(([x, y]) => { pts.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, y, d)); });
    for (let i = 0; i < 4; i++) { const [x1, y1] = c[i], [x2, y2] = c[(i + 1) % 4]; pts.push(new THREE.Vector3(x1, y1, d), new THREE.Vector3(x2, y2, d)); }
    fovG.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), fovMat)); }

  /* trail */
  const trailN = 600, trailPos = new Float32Array(trailN * 3); let trailCount = 0;
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3)); trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.LineBasicMaterial({ color: 0x2240c2, transparent: true, opacity: 0.55 });
  const trail = new THREE.Line(trailGeo, trailMat); trail.frustumCulled = false; scene.add(trail);

  /* workspace cloud */
  let cloud = null, wsStats = null;
  function buildWorkspace() {
    const n = 4000, pos = new Float32Array(n * 3), save = q.slice(), v = new THREE.Vector3(), inv = new THREE.Matrix4();
    let rmax = 0, ymin = 1e9, ymax = -1e9; let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < n; i++) {
      const qq = q.map(() => (rnd() * 2 - 1) * LIMIT);
      applyQ(qq); armRoot.updateMatrixWorld(true); inv.copy(armRoot.matrixWorld).invert();
      tcp.getWorldPosition(v); v.applyMatrix4(inv);
      pos.set([v.x, v.y, v.z], i * 3);
      rmax = Math.max(rmax, Math.hypot(v.x, v.z)); ymin = Math.min(ymin, v.y); ymax = Math.max(ymax, v.y);
    }
    applyQ(save);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    cloud = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x2240c2, size: 0.006, transparent: true, opacity: 0.55, depthWrite: false }));
    armRoot.add(cloud); wsStats = { rmax, ymin, ymax };
  }

  /* ---------- UI ---------- */
  let demo = null, demoIdx = 0;
  const drive = { f: 0, t: 0, v: 0, w: 0, x: 0, z: 0, th: 0 };
  let ui = {};
  function buildPanel() {
    const t = T[lang];
    panel.innerHTML = "";
    const sec = (title) => { const s = document.createElement("section"); s.className = "psim-sec"; const h = document.createElement("h4"); h.textContent = title; s.appendChild(h); panel.appendChild(s); return s; };
    const sArm = sec(t.arm); ui.sl = []; ui.out = [];
    JOINTS.forEach((J, i) => {
      const row = document.createElement("div"); row.className = "psim-j";
      const id = `psim-${J.id}`;
      row.innerHTML = `<span class="id">${J.id}</span><label for="${id}">${t.j[i]}</label><output for="${id}">0°</output><input type="range" id="${id}" min="${-LIMIT}" max="${LIMIT}" step="1" value="${Math.round(qTarget[i])}">`;
      const inp = row.querySelector("input"), out = row.querySelector("output");
      inp.addEventListener("input", () => { stopDemo(); qTarget[i] = +inp.value; });
      ui.sl.push(inp); ui.out.push(out); sArm.appendChild(row);
    });
    const pb = document.createElement("div"); pb.className = "psim-btns"; sArm.appendChild(pb);
    for (const k of Object.keys(POSES)) { const b = document.createElement("button"); b.type = "button"; b.textContent = t.poses[k]; b.addEventListener("click", () => { stopDemo(); setPose(k); }); pb.appendChild(b); }
    ui.demo = document.createElement("button"); ui.demo.type = "button"; ui.demo.setAttribute("aria-pressed", demo ? "true" : "false"); ui.demo.textContent = demo ? t.stop : t.demo;
    ui.demo.addEventListener("click", () => (demo ? stopDemo() : startDemo())); pb.appendChild(ui.demo);

    const sCh = sec(t.chassis);
    const dr = document.createElement("div"); dr.className = "psim-drive"; sCh.appendChild(dr);
    const pad = document.createElement("div"); pad.className = "psim-pad"; pad.setAttribute("role", "group"); pad.setAttribute("aria-label", t.drive); dr.appendChild(pad);
    const mk = (cls, sym, label, f, tt) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = sym; b.setAttribute("aria-label", label);
      const on = (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); drive.f = f; drive.t = tt; b.setAttribute("aria-pressed", "true"); };
      const off = () => { if (drive.f === f && drive.t === tt) { drive.f = 0; drive.t = 0; } b.setAttribute("aria-pressed", "false"); };
      b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); b.addEventListener("lostpointercapture", off);
      b.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); drive.f = f; drive.t = tt; } });
      b.addEventListener("keyup", () => off());
      pad.appendChild(b); };
    mk("up", "▲", t.fwd, 1, 0); mk("lf", "◀", t.left, 0, 1); mk("dn", "▼", t.back, -1, 0); mk("rt", "▶", t.right, 0, -1);
    const side = document.createElement("div"); side.style.display = "grid"; side.style.gap = "6px"; dr.appendChild(side);
    const rb = document.createElement("button"); rb.type = "button"; rb.textContent = t.reset; rb.addEventListener("click", () => { drive.x = drive.z = drive.th = drive.v = drive.w = 0; trailCount = 0; }); side.appendChild(rb);
    const kh = document.createElement("span"); kh.className = "psim-small"; kh.textContent = t.keys; side.appendChild(kh);

    const sV = sec(t.view);
    const tg = (label, checked, fn, id) => { const l = document.createElement("label"); l.className = "psim-tg"; l.innerHTML = `<input type="checkbox" id="${id}" ${checked ? "checked" : ""}> <span>${label}</span>`; l.querySelector("input").addEventListener("change", (e) => fn(e.target.checked)); sV.appendChild(l); };
    tg(t.fov, fovG.visible, (v) => { fovG.visible = v; }, "psim-fov");
    tg(t.axes, axesGroup.visible, (v) => { axesGroup.visible = v; jointG.forEach((g) => g.children.forEach((c) => { if (c.userData.axisLine) c.visible = v; })); }, "psim-axes");
    tg(t.ws, !!(cloud && cloud.visible), (v) => { if (v && !cloud) buildWorkspace(); if (cloud) cloud.visible = v; renderStats(); }, "psim-ws");
    ui.stats = document.createElement("div"); sV.appendChild(ui.stats); renderStats();
    const ap = document.createElement("p"); ap.className = "psim-small"; ap.style.margin = "0"; ap.textContent = t.approx; sV.appendChild(ap);
    hud.innerHTML = `<span>${t.hint}</span>`;
  }
  function renderStats() {
    const t = T[lang];
    if (!ui.stats) return;
    if (cloud && cloud.visible && wsStats) {
      ui.stats.innerHTML = `<div class="psim-stats"><span>${t.reachLbl}</span><b>${Math.round(wsStats.rmax * 1000)} mm</b><span>${t.hLbl}</span><b>${Math.round(wsStats.ymin * 1000)} a ${Math.round(wsStats.ymax * 1000)} mm</b></div><p class="psim-small" style="margin:4px 0 0">${t.wsNote}</p>`;
      if (lang === "en") ui.stats.innerHTML = ui.stats.innerHTML.replace(" a ", " to ");
    } else ui.stats.innerHTML = "";
  }
  function setPose(k) { POSES[k].forEach((v, i) => (qTarget[i] = v)); }
  function startDemo() { const keys = Object.keys(POSES); demoIdx = 0; setPose(keys[0]); demo = setInterval(() => { demoIdx = (demoIdx + 1) % keys.length; setPose(keys[demoIdx]); }, 2600); buildPanelState(); }
  function stopDemo() { if (demo) { clearInterval(demo); demo = null; buildPanelState(); } }
  function buildPanelState() { if (ui.demo) { ui.demo.setAttribute("aria-pressed", demo ? "true" : "false"); ui.demo.textContent = demo ? T[lang].stop : T[lang].demo; } }

  const keys = new Set();
  const keyMap = { KeyW: [1, 0], ArrowUp: [1, 0], KeyS: [-1, 0], ArrowDown: [-1, 0], KeyA: [0, 1], ArrowLeft: [0, 1], KeyD: [0, -1], ArrowRight: [0, -1] };
  let hover = false;
  root.addEventListener("pointerenter", () => (hover = true)); root.addEventListener("pointerleave", () => (hover = false));
  const kd = (e) => { if (!keyMap[e.code]) return; const tg = e.target; if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA")) return; if (!hover && !root.contains(document.activeElement)) return; keys.add(e.code); e.preventDefault(); };
  const ku = (e) => keys.delete(e.code);
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

  /* ---------- theme ---------- */
  function applyTheme() {
    const sheet = new THREE.Color(tok(root, "--sheet", "#F4F7F4")), rule = new THREE.Color(tok(root, "--rule", "#A7B3AE")), rule2 = new THREE.Color(tok(root, "--rule-2", "#D3DBD7")), blue = new THREE.Color(tok(root, "--blue", "#2240C2"));
    scene.background = sheet;
    ground.material.color.copy(sheet).lerp(rule2, 0.35);
    if (grid) { scene.remove(grid); grid.geometry.dispose(); }
    grid = new THREE.GridHelper(12, 120, rule, rule2); grid.position.y = 0.0005; grid.material.transparent = true; grid.material.opacity = 0.9; scene.add(grid);
    lineMat.color.copy(blue); fovMat.color.copy(blue); trailMat.color.copy(blue); if (cloud) cloud.material.color.copy(blue);
  }
  const mq = window.matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener?.("change", applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  applyTheme();

  /* ---------- load meshes ---------- */
  msg.textContent = T[lang].loading;
  try {
    const gltf = await loadGLB(opts.glb || "proton_arm.glb");
    const get = (n) => { let found = null; gltf.scene.traverse((o) => { if (o.isMesh && (o.name === n || o.parent?.name === n) && !found) found = o; }); return found; };
    const prep = (n, mat) => { const m = get(n); if (!m) return null; let g = m.geometry; g.deleteAttribute("normal"); g = toCreasedNormals(g, deg(32)); const mesh = new THREE.Mesh(g, mat); mesh.castShadow = mesh.receiveShadow = true; return mesh; };
    const base = prep("base", M.red); if (base) armRoot.add(base);
    LINKS.forEach((n, i) => { const mesh = prep(n, M.red); if (!mesh) return; const p = JOINTS[i].p; mesh.position.set(-p[0], -p[1], -p[2]); jointG[i].add(mesh); });
    const cam = prep("cam", M.red); if (cam) { const p = JOINTS[5].p; cam.position.set(-p[0], -p[1], -p[2]); jointG[5].add(cam); }
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.026, 0.003), M.lens); face.position.set(TCP[0] - JOINTS[5].p[0], TCP[1] - JOINTS[5].p[1], TCP[2] - JOINTS[5].p[2] + 0.0015); jointG[5].add(face);
    for (const x of [-0.025, 0.025]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 20), M.dark); l.rotation.x = Math.PI / 2; l.position.copy(face.position).add(new THREE.Vector3(x, 0, 0.002)); jointG[5].add(l); }
    msg.remove();
    const po = view.querySelector(".psim-poster"); if (po) { po.style.opacity = "0"; setTimeout(() => po.remove(), 500); }
  } catch (e) {
    console.error(e); msg.textContent = T[lang].err;
  }
  buildPanel();

  /* ---------- loop ---------- */
  const clock = new THREE.Clock(); let visible = true, raf = 0;
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !raf) loop(); }, { threshold: 0 }); io.observe(view);
  function resize() { const r = view.getBoundingClientRect(); const w = Math.max(1, r.width), h = Math.max(1, r.height); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = camera.aspect < 1 ? 34 + (1 - camera.aspect) * 26 : 34; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(view); resize();
  const tmp = new THREE.Vector3(), inv = new THREE.Matrix4();
  let lastRead = 0;
  function step(dt) {
    for (let i = 0; i < 6; i++) { const d = qTarget[i] - q[i]; const mx = 90 * dt; q[i] += Math.abs(d) < mx ? d : Math.sign(d) * mx; }
    applyQ(q);
    let f = drive.f, tt = drive.t; for (const k of keys) { f += keyMap[k][0]; tt += keyMap[k][1]; }
    f = Math.max(-1, Math.min(1, f)); tt = Math.max(-1, Math.min(1, tt));
    const vT = f * 0.35, wT = tt * 1.1, aV = 0.6 * dt, aW = 2.5 * dt;
    drive.v += Math.max(-aV, Math.min(aV, vT - drive.v)); drive.w += Math.max(-aW, Math.min(aW, wT - drive.w));
    const thm = drive.th + (drive.w * dt) / 2;
    drive.x += drive.v * Math.sin(thm) * dt; drive.z += drive.v * Math.cos(thm) * dt; drive.th += drive.w * dt;
    const lim = 5; drive.x = Math.max(-lim, Math.min(lim, drive.x)); drive.z = Math.max(-lim, Math.min(lim, drive.z));
    robot.position.set(drive.x, 0, drive.z); robot.rotation.y = drive.th;
    const vl = drive.v - (drive.w * TRACK) / 2, vr = drive.v + (drive.w * TRACK) / 2;
    wheels.forEach((w) => { const vs = w.side > 0 ? vl : vr; w.g.rotation.x += (vs / CH.wheelR) * dt; });
    if (Math.abs(drive.v) > 1e-3 || Math.abs(drive.w) > 1e-3) {
      const last = trailCount ? [trailPos[(trailCount - 1) * 3], trailPos[(trailCount - 1) * 3 + 2]] : null;
      if (!last || Math.hypot(last[0] - drive.x, last[1] - drive.z) > 0.01) {
        if (trailCount >= trailN) { trailPos.copyWithin(0, 3); trailCount = trailN - 1; }
        trailPos.set([drive.x, 0.002, drive.z], trailCount * 3); trailCount++; trailGeo.attributes.position.needsUpdate = true; trailGeo.setDrawRange(0, trailCount);
      }
      const tgt = new THREE.Vector3(drive.x, 0.36, drive.z); const delta = tgt.clone().sub(controls.target).multiplyScalar(Math.min(1, dt * 3));
      controls.target.add(delta); camera.position.add(delta);
    }
    sun.position.set(drive.x + 1.6, 2.6, drive.z + 1.2); sun.target.position.set(drive.x, 0, drive.z);
    const now = performance.now();
    if (now - lastRead > 120) {
      lastRead = now;
      ui.sl?.forEach((s, i) => { if (document.activeElement !== s) s.value = Math.round(qTarget[i]); ui.out[i].textContent = `${Math.round(q[i])}°`; });
      robot.updateMatrixWorld(true); inv.copy(armRoot.matrixWorld).invert(); tcp.getWorldPosition(tmp); tmp.applyMatrix4(inv);
      const t = T[lang], wl = vl / CH.wheelR, wr = vr / CH.wheelR;
      read.innerHTML = `<span>${t.tcp}</span><b>x ${Math.round(tmp.x * 1000)} · y ${Math.round(tmp.y * 1000)} · z ${Math.round(tmp.z * 1000)} mm</b><span>${t.chassis}</span><b>${t.v} ${drive.v.toFixed(2)} m/s · ${t.w} ${drive.w.toFixed(2)} rad/s</b><span>${t.wheels}</span><b>L ${wl.toFixed(1)} · R ${wr.toFixed(1)} rad/s</b>`;
    }
  }
  function loop() {
    raf = 0; if (!visible) return;
    const dt = Math.min(0.05, clock.getDelta());
    step(dt); controls.update(); renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  return {
    setLang(l) { lang = l === "en" ? "en" : "es"; buildPanel(); },
    setPose, setQ(arr) { arr.forEach((v, i) => { q[i] = qTarget[i] = Math.max(-LIMIT, Math.min(LIMIT, v)); }); applyQ(q); },
    tcpLocal() { robot.updateMatrixWorld(true); inv.copy(armRoot.matrixWorld).invert(); tcp.getWorldPosition(tmp); return tmp.clone().applyMatrix4(inv).toArray(); },
    workspace() { if (!cloud) buildWorkspace(); return wsStats; },
    view(pos, target) { camera.position.set(...pos); controls.target.set(...target); controls.update(); },
    toggle(name, on) { const el2 = panel.querySelector(`#psim-${name}`); if (el2 && el2.checked !== on) el2.click(); },
    renderNow() { step(0); renderer.render(scene, camera); },
    destroy() { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); renderer.dispose(); el.innerHTML = ""; },
  };
}
