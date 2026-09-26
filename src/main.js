import * as THREE from 'three';

// PWA: offline service worker — production only, so dev never sees stale
// caches. On a deploy, the updated worker claims the page and we reload once.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js');
  if (hadController) {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  }
}

await self.WC_READY;                        // Rust/WASM world core (wasm/wc.*)

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
   Voxel data, the streaming scheduler, terrain generation and meshing all live
   in the Rust/WASM world core (worldcore.js -> wasm/wc.*). What remains here is
   render-side state: THREE geometry per chunk and a budgeted apply queue, plus
   the worker pool that runs the same WASM code off-thread. */

const R = 4;                            // view radius in chunks
const MAXTASKS = 8;                     // in-flight worker jobs cap
const world = new self.WC.World(R, MAXTASKS);   // WASM: chunk store, edits, scheduler
const render = new Map();               // "cx,cz" -> {mesh, lines}
const meshQ = [];                       // worker results awaiting geometry upload
const MAXAPPLY = 4;                     // geometry builds per frame — no burst stalls
const ckey = (cx, cz) => cx + ',' + cz;

const get = (x, y, z) => world.get(x, y, z);
const inB = (x, y, z) => y >= 0 && y < H;
// not-yet-loaded chunks act as walls so the player can't fall into the void
const psolid = (x, y, z) => world.solid(x, y, z);

let pool = null;
try { pool = self.workerpool.pool('worker.js', { minWorkers: 'max', maxWorkers: 4 }); } catch (e) {}
let poolFails = 0;
// if workers keep dying (missing script, wasm init failure...) stop paying
// the spawn-fail-reject round-trip per task and run everything on-thread
function poolFail() {
  if (pool && ++poolFails >= 3) {
    const p = pool; pool = null;
    try { p.terminate(); } catch (e) {}
  }
}

function runGen(cx, cz, tok) {
  const done = data => { world.gen_done(cx, cz, tok, data); ensureSpawn(); };
  const sync = () => setTimeout(() => done(self.WC.gen_chunk(cx, cz, world.edits_flat(cx, cz))), 0);
  if (pool) pool.exec('gen', [{ cx, cz, edits: world.edits_flat(cx, cz) }]).then(r => done(r.data), () => { poolFail(); sync(); });
  else sync();
}

function runMesh(cx, cz, tok) {
  const done = r => { world.mesh_done(cx, cz, tok); if (r) meshQ.push({ cx, cz, tok, r }); };
  const sync = () => setTimeout(() => {
    const m = world.mesh_chunk(cx, cz);   // WASM reads neighbours straight from its store
    done(m ? { pos: m.pos, nor: m.nor, uv: m.uv, index: m.index, lp: m.lp, ls: m.ls } : null);
    if (m) m.free();
  }, 0);
  const args = {
    cx, cz,
    self: world.voxels(cx, cz),
    px: world.voxels(cx + 1, cz), nx: world.voxels(cx - 1, cz),
    pz: world.voxels(cx, cz + 1), nz: world.voxels(cx, cz - 1),
  };
  if (pool) pool.exec('mesh', [args]).then(done, () => { poolFail(); sync(); });
  else sync();
}

// main-thread geometry build — budgeted from frame() via meshQ
function applyMesh(cx, cz, tok, r) {
  if (!world.mesh_valid(cx, cz, tok)) return;   // stale / unloaded / re-dirtied
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(r.nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(r.uv, 2));
  g.setIndex(new THREE.BufferAttribute(r.index, 1));
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(r.lp, 3));
  lg.setAttribute('aSeed', new THREE.BufferAttribute(r.ls, 1));
  const k = ckey(cx, cz);
  let e = render.get(k);
  if (!e) {
    e = { mesh: new THREE.Mesh(g, blockMat), lines: new THREE.LineSegments(lg, lineMat) };
    e.mesh.matrixAutoUpdate = e.lines.matrixAutoUpdate = false;
    render.set(k, e);
    scene.add(e.mesh, e.lines);
  } else {
    e.mesh.geometry.dispose(); e.mesh.geometry = g;
    e.lines.geometry.dispose(); e.lines.geometry = lg;
  }
}

function unloadRender(cx, cz) {
  const e = render.get(ckey(cx, cz));
  if (!e) return;
  scene.remove(e.mesh, e.lines);
  e.mesh.geometry.dispose(); e.lines.geometry.dispose();
  render.delete(ckey(cx, cz));
}

function updateChunks() {
  const jobs = world.update(p.x, p.z);    // flat [tag, cx, cz, tok, ...]
  for (let i = 0; i + 3 < jobs.length; i += 4) {
    const cx = jobs[i + 1], cz = jobs[i + 2], tok = jobs[i + 3];
    if (jobs[i] === self.WC.JOB_GEN) runGen(cx, cz, tok);
    else if (jobs[i] === self.WC.JOB_MESH) runMesh(cx, cz, tok);
    else unloadRender(cx, cz);
  }
}

// set a voxel, persist the edit, and remesh the affected chunk(s)
function edit(wx, wy, wz, b) {
  world.edit(wx, wy, wz, b);
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

/* ------- pencil-dash particles: dig/place bursts ------- */

const PN = 96;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 6);          // one 2-vert dash per particle
const pCol = new Float32Array(PN * 6);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
addWobble(pMat, 0.05);
const plines = new THREE.LineSegments(pGeo, pMat);
plines.frustumCulled = false;
plines.renderOrder = 2;
scene.add(plines);

const parts = new Array(PN).fill(null);          // {vx,vy,vz, life, ttl}
const INKCOLS = {                                // dust tint per block dug
  [B.GRASS]: 0x5c7a40, [B.DIRT]: 0x71543a, [B.STONE]: 0x7c7c88,
  [B.LOG]: 0x71543a,   [B.LEAF]: 0x4f7434, [B.SAND]: 0xbfa160,
  [B.PLANK]: 0xa8834f, [B.BRICK]: 0x9a5540,
};
const _pc = new THREE.Color();

function burst(x, y, z, bid, n = 10) {
  _pc.setHex(INKCOLS[bid] || 0x3a3026);
  let made = 0;
  for (let i = 0; i < PN && made < n; i++) {
    if (parts[i] && parts[i].life < parts[i].ttl) continue;
    const o = i * 6;
    const px = x + Math.random(), py = y + Math.random(), pz = z + Math.random();
    const dx = Math.random() - 0.5, dy = Math.random() - 0.5, dz = Math.random() - 0.5;
    const dl = Math.hypot(dx, dy, dz) || 1, hl = 0.05 + Math.random() * 0.07;
    pPos[o]     = px - dx / dl * hl; pPos[o + 1] = py - dy / dl * hl; pPos[o + 2] = pz - dz / dl * hl;
    pPos[o + 3] = px + dx / dl * hl; pPos[o + 4] = py + dy / dl * hl; pPos[o + 5] = pz + dz / dl * hl;
    pCol[o] = pCol[o + 3] = _pc.r; pCol[o + 1] = pCol[o + 4] = _pc.g; pCol[o + 2] = pCol[o + 5] = _pc.b;
    parts[i] = {
      vx: (Math.random() - 0.5) * 3.6,
      vy: Math.random() * 3.4 + 1.4,
      vz: (Math.random() - 0.5) * 3.6,
      life: 0, ttl: 0.32 + Math.random() * 0.28,
    };
    made++;
  }
  pGeo.attributes.color.needsUpdate = true;
}

function stepParts(dt) {
  let any = false;
  for (let i = 0; i < PN; i++) {
    const s = parts[i];
    if (!s) continue;
    if (s.life >= s.ttl) {                       // parked dead
      if (pPos[i * 6 + 1] > -900) { pPos[i * 6 + 1] = pPos[i * 6 + 4] = -999; any = true; }
      continue;
    }
    any = true;
    s.life += dt;
    s.vy -= 17 * dt;
    const o = i * 6;
    for (let k = 0; k < 2; k++) {
      pPos[o + k * 3] += s.vx * dt;
      pPos[o + k * 3 + 1] += s.vy * dt;
      pPos[o + k * 3 + 2] += s.vz * dt;
    }
    if (s.life >= s.ttl) { pPos[o + 1] = pPos[o + 4] = -999; }
  }
  if (any) pGeo.attributes.position.needsUpdate = true;
}

/* ============================== player ============================== */

const p = new THREE.Vector3(0.5, H + 4, 0.5);   // feet position (hovering until spawn chunk arrives)
const v = new THREE.Vector3();
let yaw = -0.6, pitch = -0.15, onGround = false, fly = false;
let spawned = false;

// drop the player onto real terrain once the spawn chunk has generated
function ensureSpawn() {
  if (spawned) return;
  if (!world.has_voxels(0, 0)) return;
  spawned = true;
  let y = H - 1;
  while (y > 0 && !get(0, y, 0)) y--;
  p.set(0.5, y + 1.01, 0.5);
  if (!welcomed) { welcomed = true; toast('you have been drawn in'); }
}
let welcomed = false;

const keys = {};
const joy = { x: 0, y: 0 };                 // analog stick vector, -1..1
const isActive = () => screen === 'play' && (locked || touchMode);

function toggleFly() {
  fly = !fly; v.y = 0;
  document.body.classList.toggle('fly', fly);
  toast(fly ? 'flying — Space up · Shift down' : 'walking');
  sfx('fly');
}

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyF' && isActive()) toggleFly();
  if (e.code === 'KeyM') setSound(!soundOn);
  if (e.code === 'Enter' && screen !== 'play') {   // Enter starts / resumes
    if (screen === 'pause' && touchMode) setScreen('play'); else enter(false);
  }
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
    if (keys.Space && onGround) { v.y = 8.6; onGround = false; sfx('jump'); }
  }

  const vyBefore = v.y;
  onGround = false;
  sweep('x', v.x * dt);
  sweep('z', v.z * dt);
  sweep('y', v.y * dt);
  if (onGround && vyBefore < -11) { sfx('thud'); burst(p.x, p.y + 0.05, p.z, B.DIRT, 6); }

  if (p.y < -14) { p.set(0.5, H + 4, 0.5); v.set(0, 0, 0); spawned = false; ensureSpawn(); toast('back to the page'); }
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

/* ------- tiny procedural sfx (WebAudio, no assets) ------- */
let AC = null, noiseBuf = null;
let soundOn = true;

function audio() {
  if (!soundOn) return null;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    if (!noiseBuf) {
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.12 | 0, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return AC;
  } catch (_) { return null; }
}

function blip(f, dur = 0.08, type = 'triangle', vol = 0.06, slide = 0) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(1e-4, ac.currentTime + dur);
  o.connect(g).connect(ac.destination);
  o.start(); o.stop(ac.currentTime + dur + 0.01);
}

function scratch(dur = 0.09, vol = 0.1, freq = 800) {
  const ac = audio(); if (!ac) return;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(1e-4, ac.currentTime + dur);
  s.connect(f).connect(g).connect(ac.destination);
  s.start(); s.stop(ac.currentTime + dur + 0.01);
}

function sfx(kind) {
  switch (kind) {
    case 'dig':   scratch(0.09, 0.13, 650); blip(140, 0.08, 'triangle', 0.06, -50); break;
    case 'place': blip(520, 0.07, 'triangle', 0.07); break;
    case 'pick':  blip(660, 0.05, 'sine', 0.05); break;
    case 'ui':    blip(780, 0.05, 'sine', 0.035); break;
    case 'jump':  blip(310, 0.07, 'sine', 0.04, 140); break;
    case 'fly':   blip(430, 0.1, 'sine', 0.05, 300); break;
    case 'thud':  blip(85, 0.11, 'sine', 0.1, -25); scratch(0.06, 0.07, 300); break;
    case 'ready': blip(392, 0.1, 'triangle', 0.05); setTimeout(() => blip(523, 0.16, 'triangle', 0.045), 90); break;
  }
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
  const bid = get(aim.x, aim.y, aim.z);
  edit(aim.x, aim.y, aim.z, 0);
  burst(aim.x, aim.y, aim.z, bid, 12);
  sfx('dig');
}

function place() {
  if (!aim) return;
  const x = aim.x + aim.nx, y = aim.y + aim.ny, z = aim.z + aim.nz;
  if (!inB(x, y, z) || blockAtPlayer(x, y, z)) return;
  edit(x, y, z, PALETTE[selected]);
  burst(x, y, z, PALETTE[selected], 5);
  sfx('place');
}

function pick() {
  if (!aim) return;
  const i = PALETTE.indexOf(get(aim.x, aim.y, aim.z));
  if (i >= 0) { select(i); sfx('pick'); }
}

/* ============================== input / HUD ============================== */

const overlay = document.getElementById('overlay');
const pauseEl = document.getElementById('pause');
const crosshair = document.getElementById('crosshair');
const hint = document.getElementById('hint');
const hotbar = document.getElementById('hotbar');
const toastsEl = document.getElementById('toasts');
const pickname = document.getElementById('pickname');
const loadwrap = document.getElementById('loadbar');
const loadfill = document.querySelector('#loadbar i');
const loadmsg = document.getElementById('loadmsg');
let locked = false;

/* ------- screen state machine: menu -> play -> pause ------- */
let screen = 'menu';

function setScreen(s) {
  screen = s;
  overlay.style.display = s === 'menu' ? 'flex' : 'none';
  pauseEl.style.display = s === 'pause' ? 'flex' : 'none';
  const playing = s === 'play';
  crosshair.style.display = playing ? 'block' : 'none';
  hint.style.display = playing ? 'block' : 'none';
  tui.style.display = playing && touchMode ? 'block' : 'none';
  if (!playing) {                                // drop held input so nothing sticks
    for (const k in keys) keys[k] = false;
    joy.x = joy.y = 0; stickId = lookId = null; nub.style.transform = '';
  }
  if (playing) {                                 // hint fades once you've settled in
    hint.style.opacity = '';
    clearTimeout(hintT);
    hintT = setTimeout(() => hint.style.opacity = '.35', 9000);
  }
}
let hintT = 0;

function toast(msg, ms = 1700) {
  while (toastsEl.children.length > 3) toastsEl.firstChild.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  toastsEl.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms - 400);
  setTimeout(() => t.remove(), ms);
}

/* ------- settings (persisted) ------- */
const cfg = (() => { try { return JSON.parse(localStorage.getItem('ssb_cfg')) || {}; } catch (_) { return {}; } })();
let sens = typeof cfg.sens === 'number' ? cfg.sens : 1;
soundOn = cfg.sound !== false;
const saveCfg = () => { try { localStorage.setItem('ssb_cfg', JSON.stringify({ sens, sound: soundOn })); } catch (_) {} };

const sensEl = document.getElementById('sens');
const sensv = document.getElementById('sensv');
const soundEl = document.getElementById('sound');
function syncSettings() {
  sensEl.value = sens;
  sensv.textContent = sens.toFixed(1) + '×';
  soundEl.textContent = soundOn ? 'on' : 'off';
  soundEl.classList.toggle('off', !soundOn);
}
syncSettings();
sensEl.addEventListener('input', () => { sens = +sensEl.value; sensv.textContent = sens.toFixed(1) + '×'; saveCfg(); });
function setSound(on) {
  soundOn = on; saveCfg(); syncSettings();
  if (on) sfx('ui');
  toast('sound ' + (on ? 'on' : 'off'));
}
soundEl.addEventListener('click', e => { e.stopPropagation(); setSound(!soundOn); });

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
  if (screen === 'play') {                       // flash the block name above the hotbar
    pickname.textContent = BLOCKS[PALETTE[i]].n;
    pickname.classList.remove('show');
    void pickname.offsetWidth;
    pickname.classList.add('show');
  }
}
select(0);

let touchMode = false;
let unlockAt = -1e9;   // last pointer-lock exit, to spot Esc-cooldown rejections
const tui = document.getElementById('touchui');

function startTouch() {
  touchMode = true;
  document.body.classList.add('touch');
  hint.textContent = 'drag to look · stick walks · tap a block to dig';
  setScreen('play');
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
  sfx('ui');                                     // also unlocks AudioContext on this gesture
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
  if (locked) setScreen('play');
  else if (screen === 'play' && !touchMode) setScreen('pause');   // Esc -> pause card
}
document.addEventListener('pointerlockchange', onLockChange);
document.addEventListener('webkitpointerlockchange', onLockChange);
document.addEventListener('pointerlockerror', () => setTimeout(failSafe, 250));
document.addEventListener('webkitpointerlockerror', () => setTimeout(failSafe, 250));

addEventListener('mousemove', e => {
  if (!locked) return;
  yaw -= e.movementX * 0.0022 * sens;
  pitch = Math.max(-1.55, Math.min(1.55, pitch - e.movementY * 0.0022 * sens));
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
  yaw -= (e.clientX - lx) * 0.0055 * sens;
  pitch = Math.max(-1.55, Math.min(1.55, pitch - (e.clientY - ly) * 0.0055 * sens));
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
  sfx('ui');
  setScreen('pause');
});
document.getElementById('resume').addEventListener('click', e => {
  e.stopPropagation();
  sfx('ui');
  if (touchMode) setScreen('play');
  else enter(false);
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

// start-card progress: how much of the visible world has been sketched
let lastPct = -1, lastMsg = '';
function updateLoad() {
  if (screen !== 'menu') return;
  const meshed = render.size;
  const total = world.chunk_count() || 1;
  const pct = Math.min(100, Math.round(meshed / total * 100));
  if (pct !== lastPct) { lastPct = pct; loadfill.style.width = pct + '%'; }
  const ready = spawned && meshed >= total;
  const msg = ready ? 'the world is drawn — come on in'
            : spawned ? 'a few more strokes…'
            : `sketching the world… ${pct}%`;
  if (msg !== lastMsg) { lastMsg = msg; loadmsg.textContent = msg; }
  loadwrap.classList.toggle('full', ready);
}

const clock = new THREE.Clock();
const frame = () => {
  const dt = Math.min(clock.getDelta(), 0.05);
  timeU.value += dt;
  updateChunks();
  updateLoad();
  for (let i = 0; i < MAXAPPLY && meshQ.length; i++) {
    const m = meshQ.shift();
    applyMesh(m.cx, m.cz, m.tok, m.r);
  }
  step(dt);
  stepParts(dt);
  updateAim();
  for (const s of clouds) {
    s.position.x += s.userData.v * dt;
    if (s.position.x > 110) s.position.x = -55;
  }
  renderer.render(scene, camera);
};
renderer.setAnimationLoop(frame);

window.__game = { renderer, camera, scene, p, v, edit, get, world, render, spawned: () => spawned, frame, pool: () => pool, screen: () => screen, parts, dig };
