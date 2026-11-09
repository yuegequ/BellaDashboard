/* Porcelain 3D background: a ribbed white-porcelain vase with relief motifs,
   porcelain strawberries and grape clusters drifting with scroll + cursor. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('bg3d');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => innerWidth < 760;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
} catch (e) {
  document.documentElement.classList.add('no3d');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall() ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const BG = new THREE.Color('#efebe2');
const scene = new THREE.Scene();
scene.background = BG;
scene.fog = new THREE.Fog(BG, 10, 26);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 11);

scene.add(new THREE.HemisphereLight('#fffaf0', '#d8ccb4', 0.7));
const key = new THREE.DirectionalLight('#fff4e2', 1.4); key.position.set(5, 7, 6); scene.add(key);
const rim = new THREE.DirectionalLight('#ffffff', 0.6); rim.position.set(-6, 2, -4); scene.add(rim);

/* ---------- textures (procedural relief, like incised/moulded porcelain) ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const vaseBump = canvasTex(2048, 1024, (g, w, h) => {
  g.lineCap = 'square'; g.lineJoin = 'miter';
  const band = (y, color) => { g.fillStyle = color; g.fillRect(0, y, w, 4); };
  // key-fret (回纹) band on the shoulder
  const fy = h * 0.2, u = 48;
  g.strokeStyle = '#c4c4c4'; g.lineWidth = 6;
  for (let x = 0; x < w; x += u) {
    g.beginPath();
    g.moveTo(x, fy + 40); g.lineTo(x, fy); g.lineTo(x + 34, fy); g.lineTo(x + 34, fy + 28);
    g.lineTo(x + 12, fy + 28); g.lineTo(x + 12, fy + 14); g.lineTo(x + 22, fy + 14);
    g.stroke();
  }
  band(fy - 18, '#bdbdbd'); band(fy + 56, '#bdbdbd');
  // drifting ruyi clouds on the body
  g.strokeStyle = '#a8a8a8'; g.lineWidth = 5;
  for (let i = 0; i < 9; i++) {
    const cx = (i + .5) * (w / 9) + (i % 2) * 40, cy = h * (0.42 + (i % 3) * 0.07);
    for (let k = 0; k < 3; k++) {
      g.beginPath(); g.arc(cx + (k - 1) * 30, cy - (k === 1 ? 12 : 0), 18, Math.PI * .1, Math.PI * 1.9, false); g.stroke();
      g.beginPath(); g.arc(cx + (k - 1) * 30 + 4, cy - (k === 1 ? 12 : 0) + 2, 7, 0, Math.PI * 1.6); g.stroke();
    }
    g.beginPath(); g.moveTo(cx - 50, cy + 18); g.bezierCurveTo(cx - 10, cy + 28, cx + 30, cy + 10, cx + 70, cy + 22); g.stroke();
  }
  // lotus petal panels (莲瓣) round the foot
  const py = h * 0.74, n = 18, pw = w / n;
  g.lineWidth = 6; g.strokeStyle = '#c8c8c8';
  for (let i = 0; i < n; i++) {
    const x = i * pw;
    g.beginPath(); g.moveTo(x + 6, py + 170); g.bezierCurveTo(x + 4, py + 60, x + pw / 2 - 10, py + 10, x + pw / 2, py);
    g.bezierCurveTo(x + pw / 2 + 10, py + 10, x + pw - 4, py + 60, x + pw - 6, py + 170); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(x + pw / 2, py + 30); g.lineTo(x + pw / 2, py + 150); g.stroke(); g.lineWidth = 6;
  }
  band(py + 186, '#bdbdbd');
});
const berryBump = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#3a3a3a';
  const cols = 14, rows = 12;
  for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c + (r % 2) * .5) * (w / cols), y = r * (h / rows);
    g.beginPath(); g.ellipse(x, y, 5, 9, 0, 0, Math.PI * 2); g.fill();
  }
});


const ROSETTE = [["M5 5H95V95H5ZM10.5 10.5V89.5H89.5V10.5Z", 0, "evenodd"], ["M50 50C38 43 37 24 50 13C63 24 62 43 50 50Z", 0, ""], ["M50 50C38 43 37 24 50 13C63 24 62 43 50 50Z", 45, ""], ["M50 50C38 43 37 24 50 13C63 24 62 43 50 50Z", 90, ""], ["M50 50C38 43 37 24 50 13C63 24 62 43 50 50Z", 135, ""], ["M50 50C38 43 37 24 50 13C63 24 62 43 50 50Z", 180, ""], ["M50 50C38 43 37 24 50 13C63 24 62 43 50 50Z", 225, ""], ["M50 50C38 43 37 24 50 13C63 24 62 43 50 50Z", 270, ""], ["M50 50C38 43 37 24 50 13C63 24 62 43 50 50Z", 315, ""], ["M50 50C44 45 43 35 50 28C57 35 56 45 50 50Z", 22.5, ""], ["M50 50C44 45 43 35 50 28C57 35 56 45 50 50Z", 67.5, ""], ["M50 50C44 45 43 35 50 28C57 35 56 45 50 50Z", 112.5, ""], ["M50 50C44 45 43 35 50 28C57 35 56 45 50 50Z", 157.5, ""], ["M50 50C44 45 43 35 50 28C57 35 56 45 50 50Z", 202.5, ""], ["M50 50C44 45 43 35 50 28C57 35 56 45 50 50Z", 247.5, ""], ["M50 50C44 45 43 35 50 28C57 35 56 45 50 50Z", 292.5, ""], ["M50 50C44 45 43 35 50 28C57 35 56 45 50 50Z", 337.5, ""], ["M11 11C25 12 31 21 29 31C20 29 13 22 11 11Z", 0, ""], ["M11 11C25 12 31 21 29 31C20 29 13 22 11 11Z", 90, ""], ["M11 11C25 12 31 21 29 31C20 29 13 22 11 11Z", 180, ""], ["M11 11C25 12 31 21 29 31C20 29 13 22 11 11Z", 270, ""], ["M57 50A7 7 0 1 1 43 50A7 7 0 1 1 57 50Z", 0, ""]];
const tileBump = canvasTex(1024, 1024, (g, w, h) => {
  const off = document.createElement('canvas'); off.width = w; off.height = h;
  const o = off.getContext('2d'); o.fillStyle = '#000'; o.fillRect(0, 0, w, h);
  o.scale(w / 100, h / 100); o.fillStyle = '#fff';
  for (const [d, rot, rule] of ROSETTE) { o.save(); o.translate(50, 50); o.rotate(rot * Math.PI / 180); o.translate(-50, -50); o.fill(new Path2D(d), rule || 'nonzero'); o.restore(); }
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.filter = 'blur(12px)'; g.drawImage(off, 0, 0);
  g.filter = 'blur(3px)'; g.globalAlpha = .5; g.drawImage(off, 0, 0); g.globalAlpha = 1; g.filter = 'none';
});

/* ---------- materials ---------- */
const porcelain = new THREE.MeshPhysicalMaterial({
  color: '#fbf8f1', roughness: .2, metalness: 0, clearcoat: 1, clearcoatRoughness: .06,
  sheen: .4, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: .5,
});
const vaseMat = porcelain.clone(); vaseMat.color.set('#f7f1e4'); vaseMat.bumpMap = vaseBump; vaseMat.bumpScale = 2.2;
const berryMat = porcelain.clone(); berryMat.color.set('#f7e8e4'); berryMat.bumpMap = berryBump; berryMat.bumpScale = 3;
const cream = porcelain.clone(); cream.color.set('#efe4cf'); cream.roughness = .3;
const grapeMat = porcelain.clone(); grapeMat.color.set('#dfe9ea');
const grapeIce = porcelain.clone(); grapeIce.color.set('#e9f0f0');
const GLAZES = ['#cfdfe1', '#eef3f3', '#f8f3e8', '#f5e4e0'];
const tileMats = GLAZES.map(c => { const m = porcelain.clone(); m.color.set(c); m.bumpMap = tileBump; m.bumpScale = 5; m.roughness = .16; return m; });
const tileGeo = new THREE.BoxGeometry(1.5, 1.5, 0.16);
function makeTile(i) { return new THREE.Mesh(tileGeo, tileMats[i % tileMats.length]); }

/* ---------- geometry ---------- */
const lathe = (pts, seg = 96) => {
  const curve = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.LatheGeometry(curve.getPoints(90), seg);
};
function makeVase() {
  const g = lathe([[0.001, -1.65], [0.56, -1.65], [0.6, -1.55], [0.72, -1.15], [0.98, -0.3], [1.1, 0.4], [1.02, 0.92], [0.74, 1.24], [0.4, 1.42], [0.3, 1.55], [0.35, 1.7], [0.33, 1.76], [0.001, 1.76]], 128);
  // melon ribs, a classic Song-dynasty shape
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const w = THREE.MathUtils.smoothstep(v.y, -1.45, -0.9) * (1 - THREE.MathUtils.smoothstep(v.y, 0.8, 1.2));
    const f = 1 + 0.035 * w * Math.cos(a * 12);
    p.setXYZ(i, v.x * f, v.y, v.z * f);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, vaseMat);
}
const berryGeo = lathe([[0.001, -1.0], [0.18, -0.92], [0.42, -0.62], [0.62, -0.15], [0.7, 0.25], [0.64, 0.55], [0.42, 0.72], [0.001, 0.76]], 64);
const leafGeo = new THREE.SphereGeometry(1, 20, 10);
function makeBerry() {
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(berryGeo, berryMat));
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(leafGeo, cream);
    l.scale.set(0.36, 0.04, 0.12);
    const a = i / 6 * Math.PI * 2;
    l.position.set(Math.cos(a) * 0.26, 0.74, Math.sin(a) * 0.26);
    l.rotation.y = -a; l.rotation.z = -0.35;
    grp.add(l);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.36, 12), cream);
  stem.position.y = 0.92; stem.rotation.z = 0.25; grp.add(stem);
  return grp;
}
const grapeGeo = new THREE.SphereGeometry(0.27, 32, 20);
function makeGrapes(seed = 1) {
  const grp = new THREE.Group(); let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const layers = [[0.9, 6, 0.48], [0.5, 6, 0.42], [0.1, 5, 0.34], [-0.28, 4, 0.26], [-0.62, 3, 0.16], [-0.92, 1, 0]];
  for (const [y, n, r] of layers) for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rnd();
    const m = new THREE.Mesh(grapeGeo, seed % 4 === 1 ? grapeIce : grapeMat);
    m.position.set(Math.cos(a) * r + (rnd() - .5) * .06, y + (rnd() - .5) * .08, Math.sin(a) * r);
    m.scale.setScalar(0.9 + rnd() * 0.2);
    grp.add(m);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.6, 10), cream);
  stem.position.y = 1.35; stem.rotation.z = -0.2; grp.add(stem);
  const tendril = new THREE.CatmullRomCurve3([...Array(24)].map((_, i) => {
    const t = i / 23; return new THREE.Vector3(0.05 + t * 0.55 + Math.cos(t * 12) * 0.12 * t, 1.5 + Math.sin(t * 12) * 0.12 * t + t * .1, Math.sin(t * 9) * 0.05);
  }));
  grp.add(new THREE.Mesh(new THREE.TubeGeometry(tendril, 60, 0.018, 6), cream));
  return grp;
}

/* ---------- composition ---------- */
const items = [];
function place(obj, x, y, z, s, spin, flat) {
  obj.position.set(x, y, z); obj.scale.setScalar(s);
  obj.rotation.set((Math.random() - .5) * .5, Math.random() * Math.PI * 2, (Math.random() - .5) * .5);
  obj.userData = { base: new THREE.Vector3(x, y, z), s, spin, phase: Math.random() * 10, flat };
  scene.add(obj); items.push(obj);
}
function build() {
  items.forEach(o => scene.remove(o)); items.length = 0;
  const sm = isSmall();
  if (sm) {
    place(makeVase(), 1.35, 1.5, -2, 0.8, .12);
    place(makeBerry(), -0.9, 2.5, 0.2, 0.42, .5);
    place(makeGrapes(3), 1.9, -0.4, 0.5, 0.36, .35);
    place(makeBerry(), -1.4, -6.5, -1, 0.45, .4);
    place(makeGrapes(7), 1.5, -10, -1.2, 0.42, .3);
    place(makeBerry(), 1.3, -15, -1, 0.42, .5);
    place(makeGrapes(11), -1.2, -19, -1, 0.42, .3);
    place(makeTile(0), -2.1, 0.2, -2.5, 0.55, .15, true);
    place(makeTile(3), 2.2, -4.5, -2.5, 0.55, -.15, true);
    place(makeTile(1), -1.6, -12, -1.5, 0.6, .15, true);
    place(makeTile(2), 1.6, -21, -1.5, 0.6, -.15, true);
  } else {
    place(makeVase(), 2.7, 0.15, -0.6, 1.25, .1);
    place(makeBerry(), 0.95, 1.55, 1.2, 0.48, .45);
    place(makeBerry(), 4.6, -1.5, 0.6, 0.4, -.5);
    place(makeGrapes(3), 4.9, 1.6, -0.2, 0.42, .3);
    place(makeGrapes(5), 1.15, -1.9, 0.8, 0.34, -.35);
    // further down the page, porcelain pieces drift by on the edges
    place(makeBerry(), -5.6, -6.5, -1.5, 0.55, .4);
    place(makeGrapes(7), 5.8, -9, -1.5, 0.5, -.3);
    place(makeVase(), -6.2, -13, -3, 0.9, .08);
    place(makeBerry(), 5.9, -16, -1.2, 0.5, .5);
    place(makeGrapes(11), -5.6, -20, -1.4, 0.5, .3);
    place(makeBerry(), 5.6, -24, -1.4, 0.55, -.4);
    place(makeTile(0), 5.3, 2.6, -2.2, 0.8, .12, true);
    place(makeTile(3), 0.4, -0.2, -2.6, 0.7, -.1, true);
    place(makeTile(1), 6.2, -4.5, -2.4, 0.8, .15, true);
    place(makeTile(2), -6.4, -10, -2.5, 0.8, -.12, true);
    place(makeTile(0), 6.3, -19.5, -2.4, 0.8, .1, true);
    place(makeTile(3), -6.3, -23, -2.4, 0.8, -.15, true);
  }
}
build();

/* ---------- interaction ---------- */
let mx = 0, my = 0, cmx = 0, cmy = 0;
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
const WORLD_DEPTH = 24;
const scrollTarget = () => {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  return -(scrollY / max) * WORLD_DEPTH;
};
let camY = 0;

let intro = 0, introStart = null;
addEventListener('berry:loaded', () => { introStart = performance.now(); canvas.classList.add('ready'); });
setTimeout(() => { if (introStart === null) { introStart = performance.now(); canvas.classList.add('ready'); } }, 4000);

let wasSmall = isSmall();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (isSmall() !== wasSmall) { wasSmall = isSmall(); build(); }
});

const clock = new THREE.Clock();
const ease = t => 1 - Math.pow(1 - t, 4);
function frame() {
  const t = clock.getElapsedTime();
  if (introStart !== null) intro = Math.min(1, (performance.now() - introStart) / 2200);
  const k = REDUCED ? 1 : ease(intro);

  camY += (scrollTarget() - camY) * (REDUCED ? 1 : 0.07);
  cmx += (mx - cmx) * 0.04; cmy += (my - cmy) * 0.04;
  camera.position.x = cmx * 0.9;
  camera.position.y = camY - cmy * 0.6;
  camera.lookAt(cmx * 0.3, camY, 0);

  const scrollSpin = scrollY * 0.0012;
  for (const o of items) {
    const u = o.userData;
    const bob = REDUCED ? 0 : Math.sin(t * 0.7 + u.phase) * 0.12;
    o.position.y = u.base.y + bob - (1 - k) * 1.2;
    o.position.x = u.base.x;
    if (u.flat) {
      o.rotation.y = Math.sin(t * 0.3 + u.phase) * 0.45 + scrollSpin * 0.4 * Math.sign(u.spin);
      o.rotation.x = Math.cos(t * 0.25 + u.phase) * 0.3;
      o.rotation.z = u.phase * 0.2 + t * u.spin * 0.1;
    } else {
      o.rotation.y = u.phase + t * u.spin * (REDUCED ? 0 : 0.25) + scrollSpin * Math.sign(u.spin || 1);
      o.rotation.x = Math.sin(t * 0.4 + u.phase) * 0.08;
    }
    o.scale.setScalar(u.s * (0.75 + 0.25 * k));
  }
  renderer.render(scene, camera);
}
let running = true;
function loop() { if (running) frame(); requestAnimationFrame(loop); }
document.addEventListener('visibilitychange', () => { running = document.visibilityState === 'visible'; });
loop();
