import * as THREE from './vendor/three.module.js';

/* ============================== config ============================== */

const { H, CS, B, T, BLOCKS } = self.WC;    // shared world core (worldcore.js)
const EYE = 1.62, PH = 1.8, PR = 0.3;       // eye height, player height, half-width
const REACH = 6;

const PALETTE = [B.GRASS, B.DIRT, B.STONE, B.LOG, B.PLANK, B.BRICK, B.SAND, B.LEAF];

const INK = 'rgba(58,48,38,'; // pencil ink color prefix

/* ============================== helpers ============================== */

function rng(seed) {
  let t = seed + 0x6D2B79F5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// wobbly hand line between two points
function wline(c, x1, y1, x2, y2, wob, r) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const l = Math.hypot(dx, dy) || 1;
  const off = (r() * 2 - 1) * wob;
  c.beginPath();
  c.moveTo(x1, y1);
  c.quadraticCurveTo(mx - dy / l * off, my + dx / l * off, x2, y2);
  c.stroke();
}

function blot(c, x, y, rad, r) {
  c.beginPath();
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = rad * (0.8 + r() * 0.4);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath();
  c.fill();
}

/* ============================== tile painting ============================== */

// every tile is painted in a 128x128 local space
function drawTile(c, tile, r) {
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const base = (col) => { c.fillStyle = col; c.fillRect(0, 0, 128, 128); };
  const ink  = (a, w = 2.5) => { c.strokeStyle = INK + a + ')'; c.lineWidth = w; };

  // scatter short wobbly strokes
  const hatch = (n, len, col, w = 2.5) => {
    ink(col, w);
    for (let i = 0; i < n; i++) {
      const x = r() * 128, y = r() * 128, a = r() * Math.PI;
      wline(c, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, 2, r);
    }
  };
  const speckle = (n, rad, col) => {
    c.fillStyle = col;
    for (let i = 0; i < n; i++) blot(c, r() * 128, r() * 128, rad * (0.6 + r() * 0.8), r);
  };

  switch (tile) {
    case T.GRASS_TOP:
      base('#93c178');
      speckle(24, 5, 'rgba(110,161,79,.5)');
      hatch(40, 9, .25, 2);
      ink(.3, 2);
      for (let i = 0; i < 26; i++) {          // little grass blades
        const x = r() * 128, y = r() * 128;
        wline(c, x, y, x + (r() * 6 - 3), y - 5 - r() * 5, 1.4, r);
      }
      break;

    case T.GRASS_SIDE:
      base('#a9835f');
      speckle(20, 4, 'rgba(125,92,64,.5)');
      hatch(16, 10, .2, 2);
      c.fillStyle = '#93c178';                 // wavy grass band on top
      c.beginPath();
      c.moveTo(0, 0); c.lineTo(128, 0);
      for (let x = 128; x >= 0; x -= 16) c.lineTo(x, 26 + Math.sin(x * .15) * 5 + (r() * 6 - 3));
      c.closePath(); c.fill();
      ink(.4, 2.5);
      for (let x = 0; x <= 128; x += 16) wline(c, x, 24 + Math.sin(x * .15) * 5, x + 14, 24 + Math.sin((x + 14) * .15) * 5, 3, r);
      break;

    case T.DIRT:
      base('#a9835f');
      speckle(26, 4.5, 'rgba(125,92,64,.55)');
      speckle(10, 2.5, 'rgba(58,48,38,.35)');
      hatch(20, 9, .22, 2);
      break;

    case T.STONE:
      base('#b3ada3');
      speckle(18, 5, 'rgba(141,134,124,.5)');
      ink(.28, 2.5);                            // wavy strata
      for (const y of [30, 62, 96]) wline(c, 4, y, 124, y + (r() * 10 - 5), 4, r);
      ink(.35, 2);                              // cracks
      wline(c, 30 + r() * 60, 10, 40 + r() * 50, 55, 5, r);
      wline(c, 20 + r() * 70, 80, 30 + r() * 60, 120, 5, r);
      break;

    case T.LOG_SIDE:
      base('#9a6f4a');
      ink(.35, 2.5);                            // vertical grain
      for (let x = 10; x < 128; x += 15 + r() * 8)
        wline(c, x, 2, x + (r() * 8 - 4), 126, 3, r);
      speckle(10, 3, 'rgba(116,81,47,.6)');
      break;

    case T.LOG_TOP:
      base('#c8a06e');
      ink(.4, 2);                               // growth rings
      for (let rad = 14; rad < 70; rad += 13 + r() * 5) {
        c.beginPath();
        for (let i = 0; i <= 20; i++) {
          const a = (i / 20) * Math.PI * 2, rr = rad * (0.92 + r() * 0.16);
          const px = 64 + Math.cos(a) * rr, py = 64 + Math.sin(a) * rr;
          i ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath(); c.stroke();
      }
      speckle(8, 2.5, 'rgba(138,106,68,.5)');
      break;

    case T.LEAF:
      base('#7fae62');
      speckle(20, 7, 'rgba(93,138,69,.55)');
      ink(.3, 2);                               // scribble leaves
      for (let i = 0; i < 14; i++) {
        const x = r() * 110 + 9, y = r() * 110 + 9, rad = 4 + r() * 5;
        c.beginPath();
        for (let k = 0; k <= 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const px = x + Math.cos(a) * rad * (0.7 + r() * 0.5);
          const py = y + Math.sin(a) * rad * (0.7 + r() * 0.5);
          k ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.stroke();
      }
      break;

    case T.SAND:
      base('#e3d3a1');
      speckle(30, 3, 'rgba(196,176,120,.6)');
      speckle(8, 2, 'rgba(58,48,38,.25)');
      break;

    case T.PLANK:
      base('#c69a63');
      ink(.45, 2.5);                            // board seams
      for (const y of [32, 64, 96]) wline(c, 0, y, 128, y + (r() * 4 - 2), 2.5, r);
      ink(.2, 1.8);                             // grain
      for (let i = 0; i < 10; i++) wline(c, r() * 128, r() * 128, r() * 128, r() * 128, 3, r);
      c.fillStyle = 'rgba(58,48,38,.5)';        // nails
      for (const [nx, ny] of [[12, 18], [116, 18], [12, 50], [116, 50], [12, 82], [116, 82], [12, 114], [116, 114]])
        blot(c, nx, ny, 2.5, r);
      break;

    case T.BRICK:
      base('#d8c9b0');                          // mortar
      c.fillStyle = '#b9745a';
      for (let row = 0; row < 4; row++) {
        const y = row * 32, off = (row % 2) * 32;
        for (let x = -1; x < 3; x++) {
          const bx = x * 64 + off;
          c.beginPath();                        // wobbly brick rect
          c.moveTo(bx + 4 + r() * 3, y + 4 + r() * 3);
          c.lineTo(bx + 60 + r() * 3, y + 4 + r() * 3);
          c.lineTo(bx + 60 + r() * 3, y + 28 + r() * 3);
          c.lineTo(bx + 4 + r() * 3, y + 28 + r() * 3);
          c.closePath(); c.fill();
        }
      }
      ink(.3, 2);
      for (const y of [32, 64, 96]) wline(c, 0, y, 128, y, 2, r);
      break;
  }

  // sketchy frame around every tile
  ink(.5, 3);
  wline(c, 2, 2, 126, 3, 2.5, r); wline(c, 126, 3, 125, 126, 2.5, r);
  wline(c, 125, 126, 3, 125, 2.5, r); wline(c, 3, 125, 2, 2, 2.5, r);
}

/* ============================== atlas ============================== */

const ATLAS = 4, TS = 128, PAD = 3;
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlasCanvas.height = ATLAS * TS;
{
  const c = atlasCanvas.getContext('2d');
  c.fillStyle = '#fff';
  c.fillRect(0, 0, atlasCanvas.width, atlasCanvas.height);
  for (let i = 0; i < ATLAS * ATLAS; i++) {
    c.save();
    c.translate((i % ATLAS) * TS, Math.floor(i / ATLAS) * TS);
    drawTile(c, i, rng(i * 991 + 7));
    c.restore();
  }
}
const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.colorSpace = THREE.SRGBColorSpace;
atlasTex.magFilter = THREE.LinearFilter;
atlasTex.minFilter = THREE.LinearMipmapLinearFilter;

/* ============================== infinite voxel world ==============================
   Voxels live per-chunk (16x16 columns, full height). Terrain + meshing run
   in a worker pool; the main thread keeps the voxel map for physics/raycast
   and applies geometry results. Chunks stream in/out around the player. */

const R = 4;                          // view radius in chunks
const MAXTASKS = 8;                   // in-flight worker jobs cap
const store = new Map();              // "cx,cz" -> {cx,cz,vox,mesh,lines,genIn,meshIn,dirty}
const edits = new Map();              // "cx,cz" -> Map<lidx, block> (player edits, kept on unload)
const ckey = (cx, cz) => cx + ',' + cz;
const lidx = (x, y, z) => (x & (CS - 1)) + (z & (CS - 1)) * CS + y * CS * CS;

const chunkAt = (x, z) => store.get(ckey(Math.floor(x / CS), Math.floor(z / CS)));

const get = (x, y, z) => {
  if (y < 0 || y >= H) return 0;
  const c = chunkAt(x, z);
  return c && c.vox ? c.vox[lidx(x, y, z)] : 0;
};
const inB = (x, y, z) => y >= 0 && y < H;
// not-yet-loaded chunks act as walls so the player can't fall into the void
const psolid = (x, y, z) => {
  if (y < 0 || y >= H) return false;
  const c = chunkAt(x, z);
  return !c || !c.vox ? true : c.vox[lidx(x, y, z)] !== 0;
};

let pool = null;
try { pool = self.workerpool.pool('worker.js', { minWorkers: 'max', maxWorkers: 4 }); } catch (e) {}
let inflight = 0;

function chunkState(cx, cz) {
  const k = ckey(cx, cz);
  let c = store.get(k);
  if (!c) { c = { cx, cz, vox: null, mesh: null, lines: null, genIn: false, meshIn: false, dirty: false }; store.set(k, c); }
  return c;
}

function onVox(c, data) {
  if (store.get(ckey(c.cx, c.cz)) !== c) return;      // unloaded meanwhile
  c.vox = data;
  c.dirty = true;
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const n = store.get(ckey(c.cx + dx, c.cz + dz));
    if (n && n.vox && n.mesh) n.dirty = true;          // its border faces changed
  }
  ensureSpawn();
}

function runGen(c) {
  c.genIn = true; inflight++;
  const e = edits.get(ckey(c.cx, c.cz));
  const ed = e ? [...e] : null;
  const done = data => { inflight--; c.genIn = false; onVox(c, data); };
  if (pool) pool.exec('gen', [{ cx: c.cx, cz: c.cz, edits: ed }]).then(r => done(r.data), () => done(WC.genChunk(c.cx, c.cz, ed)));
  else done(WC.genChunk(c.cx, c.cz, ed));
}

function runMesh(c) {
  c.meshIn = true; c.dirty = false; inflight++;
  const nb = (dx, dz) => { const n = store.get(ckey(c.cx + dx, c.cz + dz)); return n ? n.vox : null; };
  const args = { cx: c.cx, cz: c.cz, self: c.vox, px: nb(1, 0), nx: nb(-1, 0), pz: nb(0, 1), nz: nb(0, -1) };
  const apply = r => {
    inflight--; c.meshIn = false;
    if (store.get(ckey(c.cx, c.cz)) !== c || !c.vox) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(r.nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(r.uv, 2));
    g.setIndex(new THREE.BufferAttribute(r.index, 1));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(r.lp, 3));
    lg.setAttribute('aSeed', new THREE.BufferAttribute(r.ls, 1));
    if (!c.mesh) {
      c.mesh = new THREE.Mesh(g, blockMat);
      c.lines = new THREE.LineSegments(lg, lineMat);
      c.mesh.matrixAutoUpdate = c.lines.matrixAutoUpdate = false;
      scene.add(c.mesh, c.lines);
    } else {
      c.mesh.geometry.dispose(); c.mesh.geometry = g;
      c.lines.geometry.dispose(); c.lines.geometry = lg;
    }
  };
  const sync = () => apply(WC.meshChunk(c.cx, c.cz, args.self, args.px, args.nx, args.pz, args.nz));
  if (pool) pool.exec('mesh', [args]).then(apply, sync);
  else sync();
}

function unload(c) {
  if (c.mesh) { scene.remove(c.mesh, c.lines); c.mesh.geometry.dispose(); c.lines.geometry.dispose(); }
  store.delete(ckey(c.cx, c.cz));
}

let lastCX = null, lastCZ = null;
function updateChunks() {
  const pcx = Math.floor(p.x / CS), pcz = Math.floor(p.z / CS);
  if (pcx !== lastCX || pcz !== lastCZ) {
    lastCX = pcx; lastCZ = pcz;
    for (let dz = -R; dz <= R; dz++)
      for (let dx = -R; dx <= R; dx++)
        chunkState(pcx + dx, pcz + dz);
    for (const c of [...store.values()])
      if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > R + 1) unload(c);
  }
  const needGen = [], needMesh = [];
  for (const c of store.values()) {
    const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
    if (!c.vox && !c.genIn) needGen.push([d, c]);
    else if (c.vox && c.dirty && !c.meshIn) needMesh.push([d, c]);
  }
  needGen.sort((a, b) => a[0] - b[0]);
  needMesh.sort((a, b) => a[0] - b[0]);
  for (const [, c] of needGen)  { if (inflight >= MAXTASKS) break; runGen(c); }
  for (const [, c] of needMesh) { if (inflight >= MAXTASKS) break; runMesh(c); }
}

// set a voxel, persist the edit, and remesh the affected chunk(s)
function edit(wx, wy, wz, b) {
  const cx = Math.floor(wx / CS), cz = Math.floor(wz / CS);
  const c = store.get(ckey(cx, cz));
  if (!c || !c.vox) return;
  const i = lidx(wx, wy, wz);
  c.vox[i] = b;
  const k = ckey(cx, cz);
  let e = edits.get(k);
  if (!e) edits.set(k, e = new Map());
  e.set(i, b);
  c.dirty = true;
  const lx = wx - cx * CS, lz = wz - cz * CS;
  const mark = (dx, dz) => { const n = store.get(ckey(cx + dx, cz + dz)); if (n && n.vox) n.dirty = true; };
  if (lx === 0) mark(-1, 0);
  if (lx === CS - 1) mark(1, 0);
  if (lz === 0) mark(0, -1);
  if (lz === CS - 1) mark(0, 1);
}

/* ============================== sketch materials ============================== */

const timeU = { value: 0 };

// injects stepped vertex jitter -> "line boil" like hand-drawn animation
function addWobble(mat, amp) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.uniforms.uAmp = { value: amp };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uAmp; attribute float aSeed;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float t = mod(floor(uTime * 5.0), 512.0);
          vec3 sp = position * 0.9 + vec3(aSeed * 37.7, t * 0.913, t * 1.71);
          float h = fract(sin(dot(sp, vec3(127.1, 311.7, 74.7))) * 43758.5453);
          transformed += (fract(h * vec3(13.13, 71.7, 31.31)) - 0.5) * uAmp;
        }`);
  };
}

const blockMat = new THREE.MeshLambertMaterial({ map: atlasTex });
addWobble(blockMat, 0.03);
const lineMat = new THREE.LineBasicMaterial({ color: 0x3a3026, transparent: true, opacity: 0.8 });
addWobble(lineMat, 0.06);

/* ============================== scene ============================== */

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe3ee);
scene.fog = new THREE.Fog(0xcfe3ee, 45, 120);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 300);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0xfff6e0, 0x9a8f7a, 0.95));
const sunLight = new THREE.DirectionalLight(0xfff0d0, 0.9);
sunLight.position.set(30, 60, 20);
scene.add(sunLight);

/* ------- doodle sprites: sun + drifting clouds ------- */

function spriteCanvas(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const sunTex = spriteCanvas(160, 160, c => {
  const r = rng(5);
  c.fillStyle = '#f2d267';
  blot(c, 80, 80, 52, r);
  c.strokeStyle = INK + '.7)'; c.lineWidth = 4;
  for (let i = 0; i < 8; i++) {                 // sun rays
    const a = i / 8 * Math.PI * 2 + .3;
    wline(c, 80 + Math.cos(a) * 62, 80 + Math.sin(a) * 62,
             80 + Math.cos(a) * 74, 80 + Math.sin(a) * 74, 3, r);
  }
});
const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true }));
sun.scale.set(14, 14, 1);
sun.position.set(-25, 38, -30);
scene.add(sun);

const cloudTex = spriteCanvas(220, 110, c => {
  const r = rng(9);
  c.fillStyle = 'rgba(252,250,242,.95)';
  blot(c, 70, 66, 34, r); blot(c, 120, 52, 40, r); blot(c, 165, 68, 30, r);
  c.strokeStyle = INK + '.5)'; c.lineWidth = 3;
  wline(c, 36, 86, 190, 84, 4, r);              // flat bottom stroke
});
const clouds = [];
for (let i = 0; i < 9; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: .92 }));
  const sc = 10 + hash2(i, 3) * 10;
  s.scale.set(sc, sc * 0.5, 1);
  s.position.set(hash2(i, 7) * 140 - 45, 26 + hash2(i, 11) * 10, hash2(i, 17) * 120 - 35);
  s.userData.v = 0.3 + hash2(i, 23) * 0.5;
  clouds.push(s); scene.add(s);
}

/* ------- target highlight: sketchy box ------- */

const hlGeo = new THREE.BufferGeometry();
{
  const e = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02));
  const p = e.getAttribute('position').array;
  const pp = [], ss = [];
  for (let i = 0; i < p.length; i += 6) {
    pp.push(p[i], p[i+1], p[i+2], p[i+3], p[i+4], p[i+5]); ss.push(0, 0);
    pp.push(p[i], p[i+1], p[i+2], p[i+3], p[i+4], p[i+5]); ss.push(1, 1);
  }
  hlGeo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  hlGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(ss, 1));
}
const highlight = new THREE.LineSegments(hlGeo, lineMat);
highlight.visible = false;
scene.add(highlight);

/* ============================== player ============================== */

const p = new THREE.Vector3(0.5, H + 4, 0.5);   // feet position (hovering until spawn chunk arrives)
const v = new THREE.Vector3();
let yaw = -0.6, pitch = -0.15, onGround = false, fly = false;
let spawned = false;

// drop the player onto real terrain once the spawn chunk has generated
function ensureSpawn() {
  if (spawned) return;
  const c = store.get('0,0');
  if (!c || !c.vox) return;
  spawned = true;
  let y = H - 1;
  while (y > 0 && !get(0, y, 0)) y--;
  p.set(0.5, y + 1.01, 0.5);
}

const keys = {};
const joy = { x: 0, y: 0 };                 // analog stick vector, -1..1
const isActive = () => locked || touchMode;

function toggleFly() {
  fly = !fly; v.y = 0;
  document.body.classList.toggle('fly', fly);
}

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyF' && isActive()) toggleFly();
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n >= 1 && n <= PALETTE.length) select(n - 1);
  }
  if (isActive() && ['Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys[e.code] = false);

const EPS = 1e-4;
function sweep(axis, d) {
  if (!d) return;
  p[axis] += d;
  const x0 = Math.floor(p.x - PR), x1 = Math.floor(p.x + PR - 1e-9);
  const y0 = Math.floor(p.y),     y1 = Math.floor(p.y + PH - 1e-9);
  const z0 = Math.floor(p.z - PR), z1 = Math.floor(p.z + PR - 1e-9);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (!psolid(x, y, z)) continue;
    if (axis === 'x') { p.x = d > 0 ? Math.min(p.x, x - PR - EPS) : Math.max(p.x, x + 1 + PR + EPS); v.x = 0; }
    if (axis === 'y') { p.y = d > 0 ? Math.min(p.y, y - PH - EPS) : Math.max(p.y, y + 1 + EPS); if (d < 0) onGround = true; v.y = 0; }
    if (axis === 'z') { p.z = d > 0 ? Math.min(p.z, z - PR - EPS) : Math.max(p.z, z + 1 + PR + EPS); v.z = 0; }
  }
}

const blockAtPlayer = (bx, by, bz) =>
  bx + 1 > p.x - PR && bx < p.x + PR &&
  by + 1 > p.y      && by < p.y + PH &&
  bz + 1 > p.z - PR && bz < p.z + PR;

function step(dt) {
  camera.position.set(p.x, p.y + EYE, p.z);
  camera.rotation.set(pitch, yaw, 0);
  if (!spawned) return;                     // world hasn't streamed in yet
  const fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + joy.y;
  const st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x;
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  let tx = (-sy * fw + cy * st), tz = (-cy * fw - sy * st);
  const l = Math.hypot(tx, tz);
  if (l > 1) { tx /= l; tz /= l; }          // clamp, keep analog tilt
  const speed = fly ? 9 : 4.6;
  tx *= speed; tz *= speed;
  const k = Math.min(1, dt * (fly || onGround ? 11 : 3.5));
  v.x += (tx - v.x) * k; v.z += (tz - v.z) * k;

  if (fly) {
    const ty = ((keys.Space ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0)) * speed;
    v.y += (ty - v.y) * Math.min(1, dt * 10);
  } else {
    v.y -= 24 * dt;
    if (v.y < -42) v.y = -42;
    if (keys.Space && onGround) { v.y = 8.6; onGround = false; }
  }

  onGround = false;
  sweep('x', v.x * dt);
  sweep('z', v.z * dt);
  sweep('y', v.y * dt);

  if (p.y < -14) { p.set(0.5, H + 4, 0.5); v.set(0, 0, 0); spawned = false; ensureSpawn(); }
}

/* ============================== digging / placing ============================== */

function raycast(o, d, maxD) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), syy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = sx ? Math.abs(1 / d.x) : Infinity;
  const tdy = syy ? Math.abs(1 / d.y) : Infinity;
  const tdz = sz ? Math.abs(1 / d.z) : Infinity;
  let tmx = sx ? (sx > 0 ? x + 1 - o.x : o.x - x) * tdx : Infinity;
  let tmy = syy ? (syy > 0 ? y + 1 - o.y : o.y - y) * tdy : Infinity;
  let tmz = sz ? (sz > 0 ? z + 1 - o.z : o.z - z) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  for (let i = 0; i < 200; i++) {
    if (get(x, y, z)) return { x, y, z, nx, ny, nz };
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = nz = 0; }
    else if (tmy < tmz)         { y += syy; t = tmy; tmy += tdy; ny = -syy; nx = nz = 0; }
    else                        { z += sz; t = tmz; tmz += tdz; nz = -sz; nx = ny = 0; }
    if (t > maxD) return null;
  }
  return null;
}

let AC;
function blip(f) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.06, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(1e-4, AC.currentTime + 0.08);
    o.connect(g).connect(AC.destination);
    o.start(); o.stop(AC.currentTime + 0.09);
  } catch (_) {}
}

let selected = 0;
let aim = null;
const _dir = new THREE.Vector3();

function updateAim() {
  if (!isActive()) { highlight.visible = false; aim = null; return; }
  camera.getWorldDirection(_dir);
  aim = raycast(camera.position, _dir, REACH);
  highlight.visible = !!aim;
  if (aim) highlight.position.set(aim.x + 0.5, aim.y + 0.5, aim.z + 0.5);
}

function dig() {
  if (!aim) return;
  edit(aim.x, aim.y, aim.z, 0);
  blip(190);
}

function place() {
  if (!aim) return;
  const x = aim.x + aim.nx, y = aim.y + aim.ny, z = aim.z + aim.nz;
  if (!inB(x, y, z) || blockAtPlayer(x, y, z)) return;
  edit(x, y, z, PALETTE[selected]);
  blip(520);
}

function pick() {
  if (!aim) return;
  const i = PALETTE.indexOf(get(aim.x, aim.y, aim.z));
  if (i >= 0) select(i);
}

/* ============================== input / HUD ============================== */

const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');
const hint = document.getElementById('hint');
const hotbar = document.getElementById('hotbar');
let locked = false;

PALETTE.forEach((b, i) => {
  const slot = document.createElement('div');
  slot.className = 'slot';
  const icon = document.createElement('canvas');
  icon.width = icon.height = 68;
  const c = icon.getContext('2d');
  c.scale(68 / 128, 68 / 128);
  drawTile(c, BLOCKS[b].t[0] === BLOCKS[b].t[2] ? BLOCKS[b].t[0] : BLOCKS[b].t[2], rng(b * 31 + 3));
  const key = document.createElement('span');
  key.className = 'key'; key.textContent = i + 1;
  const name = document.createElement('span');
  name.textContent = BLOCKS[b].n;
  slot.append(key, icon, name);
  slot.addEventListener('pointerdown', e => { e.preventDefault(); select(i); });
  hotbar.appendChild(slot);
});
function select(i) {
  selected = i;
  [...hotbar.children].forEach((s, k) => s.classList.toggle('sel', k === i));
}
select(0);

let touchMode = false;
let unlockAt = -1e9;   // last pointer-lock exit, to spot Esc-cooldown rejections
const tui = document.getElementById('touchui');

function startTouch() {
  touchMode = true;
  document.body.classList.add('touch');
  overlay.style.display = 'none';
  crosshair.style.display = 'block';
  hint.style.display = 'block';
  hint.textContent = 'drag to look · stick walks · tap a block to dig';
  tui.style.display = 'block';
}

// pointer lock unavailable/denied -> still get in, with drag-look + buttons
function failSafe() {
  if (locked || touchMode) return;
  if (document.pointerLockElement || document.webkitPointerLockElement) return;
  if (performance.now() - unlockAt < 1600) return;  // Esc cooldown: stay on menu
  startTouch();
}

function enter(viaTouch) {
  if (locked || touchMode) return;
  if (viaTouch) return startTouch();
  const el = renderer.domElement;
  const req = (el.requestPointerLock || el.webkitRequestPointerLock || el.mozRequestPointerLock)?.bind(el);
  if (!req) return startTouch();
  try {
    const r = req();
    if (r && r.catch) r.catch(() => failSafe());
    setTimeout(failSafe, 1200);                       // backstop for silent failures
  } catch { failSafe(); }
}

overlay.addEventListener('pointerdown', e => enter(e.pointerType !== 'mouse'));
overlay.addEventListener('click', () => enter(false));   // keyboard / no-PointerEvent browsers
renderer.domElement.addEventListener('click', () => enter(false));

if (matchMedia('(pointer: coarse)').matches)
  document.getElementById('play').textContent = 'tap to draw yourself in';

function onLockChange() {
  locked = !!(document.pointerLockElement || document.webkitPointerLockElement);
  if (!locked) unlockAt = performance.now();
  overlay.style.display = locked ? 'none' : 'flex';
  crosshair.style.display = locked || touchMode ? 'block' : 'none';
  hint.style.display = locked || touchMode ? 'block' : 'none';
  if (locked) tui.style.display = 'none';
}
document.addEventListener('pointerlockchange', onLockChange);
document.addEventListener('webkitpointerlockchange', onLockChange);
document.addEventListener('pointerlockerror', () => setTimeout(failSafe, 250));
document.addEventListener('webkitpointerlockerror', () => setTimeout(failSafe, 250));

addEventListener('mousemove', e => {
  if (!locked) return;
  yaw -= e.movementX * 0.0022;
  pitch = Math.max(-1.55, Math.min(1.55, pitch - e.movementY * 0.0022));
});

addEventListener('mousedown', e => {
  if (!locked) return;
  if (e.button === 0) dig();
  else if (e.button === 2) place();
  else if (e.button === 1) { pick(); e.preventDefault(); }
});
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => {
  if (!locked) return;
  select((selected + (e.deltaY > 0 ? 1 : -1) + PALETTE.length) % PALETTE.length);
}, { passive: true });

/* ============================== touch controls ============================== */

const stick = document.getElementById('stick');
const nub = document.getElementById('nub');
let stickId = null;

function joyMove(e) {
  const r = stick.getBoundingClientRect();
  let dx = (e.clientX - (r.left + r.width / 2)) / 38;
  let dy = (e.clientY - (r.top + r.height / 2)) / 38;
  const l = Math.hypot(dx, dy);
  if (l > 1) { dx /= l; dy /= l; }
  joy.x = dx; joy.y = -dy;
  nub.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
}
stick.addEventListener('pointerdown', e => {
  e.preventDefault();
  stickId = e.pointerId;
  stick.setPointerCapture(stickId);
  joyMove(e);
});
stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) joyMove(e); });
const joyEnd = e => {
  if (e.pointerId !== stickId) return;
  stickId = null; joy.x = joy.y = 0;
  nub.style.transform = '';
};
stick.addEventListener('pointerup', joyEnd);
stick.addEventListener('pointercancel', joyEnd);

// look-drag on the canvas; a quick tap = dig
let lookId = null, lx = 0, ly = 0, tapX = 0, tapY = 0, tapT = 0;
renderer.domElement.addEventListener('pointerdown', e => {
  if (!touchMode || locked || lookId !== null) return;
  lookId = e.pointerId;
  lx = tapX = e.clientX; ly = tapY = e.clientY;
  tapT = performance.now();
});
addEventListener('pointermove', e => {
  if (e.pointerId !== lookId) return;
  yaw -= (e.clientX - lx) * 0.0055;
  pitch = Math.max(-1.55, Math.min(1.55, pitch - (e.clientY - ly) * 0.0055));
  lx = e.clientX; ly = e.clientY;
});
const endLook = e => {
  if (e.pointerId !== lookId) return;
  lookId = null;
  const moved = Math.hypot(e.clientX - tapX, e.clientY - tapY);
  if (moved < 9 && performance.now() - tapT < 300) dig();
};
addEventListener('pointerup', endLook);
addEventListener('pointercancel', endLook);

// holdable buttons (dig/put repeat while held; hop/down hold a key)
function holdKey(el, code) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); keys[code] = true;
    el.setPointerCapture(e.pointerId);
  });
  const up = () => keys[code] = false;
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
function holdAction(el, fn) {
  let iv = null;
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); fn();
    iv = setInterval(fn, 240);
    el.setPointerCapture(e.pointerId);
  });
  const up = () => { clearInterval(iv); iv = null; };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
holdKey(document.getElementById('t-jump'), 'Space');
holdKey(document.getElementById('t-down'), 'ShiftLeft');
holdAction(document.getElementById('t-dig'), dig);
holdAction(document.getElementById('t-place'), place);
document.getElementById('t-fly').addEventListener('pointerdown', e => {
  e.preventDefault(); toggleFly();
});
document.getElementById('t-menu').addEventListener('pointerdown', e => {
  e.preventDefault();
  overlay.style.display = 'flex';
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---- paper grain overlay ---- */
{
  const g = document.createElement('canvas');
  g.width = g.height = 220;
  const c = g.getContext('2d'), r = rng(77);
  const img = c.createImageData(220, 220);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 200 + r() * 55;
    img.data[i] = img.data[i+1] = img.data[i+2] = n; img.data[i+3] = 255;
  }
  c.putImageData(img, 0, 0);
  document.getElementById('grain').style.backgroundImage = `url(${g.toDataURL()})`;
}

/* ============================== loop ============================== */

window.__game = { renderer, camera, scene, p, v, edit, get, store, spawned: () => spawned };

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  timeU.value += dt;
  updateChunks();
  step(dt);
  updateAim();
  for (const s of clouds) {
    s.position.x += s.userData.v * dt;
    if (s.position.x > 110) s.position.x = -55;
  }
  renderer.render(scene, camera);
});
