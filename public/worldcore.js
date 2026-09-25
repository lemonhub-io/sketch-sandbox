/* worldcore.js — world constants, terrain generation and meshing.
   Plain script (no DOM/THREE) so it can run in the page AND inside
   workers via importScripts. Everything hangs off self.WC. */

self.WC = (() => {

const H = 24, CS = 16;            // world height, chunk size (x/z)

const B = { GRASS: 1, DIRT: 2, STONE: 3, LOG: 4, LEAF: 5, SAND: 6, PLANK: 7, BRICK: 8 };
const T = { GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, LOG_SIDE: 4, LOG_TOP: 5, LEAF: 6, SAND: 7, PLANK: 8, BRICK: 9 };

//             name          tiles: [top, bottom, sides]
const BLOCKS = [null,
  { n: 'Grass',  t: [T.GRASS_TOP, T.DIRT,  T.GRASS_SIDE] },
  { n: 'Dirt',   t: [T.DIRT,      T.DIRT,  T.DIRT]      },
  { n: 'Stone',  t: [T.STONE,     T.STONE, T.STONE]     },
  { n: 'Log',    t: [T.LOG_TOP,   T.LOG_TOP, T.LOG_SIDE] },
  { n: 'Leaf',   t: [T.LEAF,      T.LEAF,  T.LEAF]      },
  { n: 'Sand',   t: [T.SAND,      T.SAND,  T.SAND]      },
  { n: 'Plank',  t: [T.PLANK,     T.PLANK, T.PLANK]     },
  { n: 'Brick',  t: [T.BRICK,     T.BRICK, T.BRICK]     },
];

const FACES = [
  { n: [ 1, 0, 0], c: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
  { n: [-1, 0, 0], c: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },
  { n: [ 0, 1, 0], c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { n: [ 0,-1, 0], c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { n: [ 0, 0, 1], c: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
  { n: [ 0, 0,-1], c: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },
];

const ATLAS = 4, TS = 128, PAD = 3;

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function tileUV(t) {  // [u0, v0, u1, v1] inset to avoid bleeding
  const col = t % ATLAS, row = Math.floor(t / ATLAS);
  const u0 = (col * TS + PAD) / (ATLAS * TS), u1 = ((col + 1) * TS - PAD) / (ATLAS * TS);
  const v1 = 1 - (row * TS + PAD) / (ATLAS * TS), v0 = 1 - ((row + 1) * TS - PAD) / (ATLAS * TS);
  return [u0, v0, u1, v1];
}

/* ---------------- terrain ---------------- */

// FastNoiseLite (vendored, MIT) — 3D OpenSimplex2S.
// Fixed seeds => identical results on main thread and in every worker.
let nBase = null, nDetail = null;
if (typeof FastNoiseLite !== 'undefined') {
  nBase = new FastNoiseLite(1337);
  nBase.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S);
  nBase.SetFractalType(FastNoiseLite.FractalType.FBm);
  nBase.SetFractalOctaves(4);
  nBase.SetFrequency(0.012);          // continental scale

  nDetail = new FastNoiseLite(9449);
  nDetail.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2S);
  nDetail.SetFrequency(0.085);        // small bumps
}

// surface height at world column (wx, wz) — pure function, infinite
function height(wx, wz) {
  if (nBase) {
    const t0 = nBase.GetNoise(wx, 0, wz) * 0.5 + 0.5;      // [-1,1] -> [0,1]
    const t = t0 * t0 * (3 - 2 * t0);                      // widen the range
    const d = nDetail.GetNoise(wx, 0, wz);                 // [-1,1]
    return Math.max(1, Math.min(H - 6, Math.floor(2 + t * 13 + d * 2)));
  }
  // fallback if FastNoiseLite failed to load
  const n = Math.sin(wx * 0.31) * Math.cos(wz * 0.28) * 1.7
          + Math.sin(wx * 0.11 + 2.1) * Math.cos(wz * 0.13 + 1.3) * 2.6
          + hash2(wx, wz) * 1.4;
  return Math.max(1, Math.floor(5 + n));
}

function isTree(wx, wz) {
  return hash2(wx * 1.71 + 13.7, wz * 0.97 + 7.3) < 0.008;
}

// chunk-local write; x/z are chunk-local coords
function put(d, x, y, z, b, airOnly) {
  if (x < 0 || x >= CS || z < 0 || z >= CS || y < 0 || y >= H) return;
  const i = x + z * CS + y * CS * CS;
  if (!airOnly || !d[i]) d[i] = b;
}

function genChunk(cx, cz, ed) {
  const data = new Uint8Array(CS * CS * H);
  const x0 = cx * CS, z0 = cz * CS;

  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const h = height(x0 + x, z0 + z);
    for (let y = 0; y <= h; y++) {
      let b;
      if (h <= 3) b = B.SAND;
      else b = y === h ? B.GRASS : y < h - 2 ? B.STONE : B.DIRT;
      data[x + z * CS + y * CS * CS] = b;
    }
  }

  // trees: scan origins inside a 2-block margin so canopies that cross
  // chunk borders are drawn identically by both chunks
  for (let oz = z0 - 2; oz < z0 + CS + 2; oz++) for (let ox = x0 - 2; ox < x0 + CS + 2; ox++) {
    if (!isTree(ox, oz)) continue;
    const h = height(ox, oz);
    if (h <= 3) continue;
    const th = h + 3 + (hash2(ox * 1.3 + 9, oz * 1.7 + 4) < 0.5 ? 1 : 0);
    for (let y = h + 1; y <= th; y++) put(data, ox - x0, y, oz - z0, B.LOG, false);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 3) continue;
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          put(data, ox + dx - x0, th + dy, oz + dz - z0, B.LEAF, true);
        }
    put(data, ox - x0, th + 1, oz - z0, B.LEAF, true);
  }

  if (ed) for (const [i, b] of ed) data[i] = b;   // player edits overlay
  return data;
}

/* ---------------- meshing ---------------- */

const YS = CS * CS;
// sample voxel in chunk-local coords, reading the 4 neighbors across borders
function sample(self, px, nx, pz, nz, x, y, z) {
  if (y < 0 || y >= H) return 0;
  if (x < 0)    return nx ? nx[x + CS + z * CS + y * YS] : 0;
  if (x >= CS)  return px ? px[x - CS + z * CS + y * YS] : 0;
  if (z < 0)    return nz ? nz[x + (z + CS) * CS + y * YS] : 0;
  if (z >= CS)  return pz ? pz[x + (z - CS) * CS + y * YS] : 0;
  return self[x + z * CS + y * YS];
}

function meshChunk(cx, cz, self, px, nx, pz, nz) {
  const pos = [], nor = [], uv = [], index = [];
  const lp = [], ls = [];
  const x0 = cx * CS, z0 = cz * CS;

  for (let y = 0; y < H; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const b = self[x + z * CS + y * YS];
    if (!b) continue;
    const def = BLOCKS[b];
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      if (sample(self, px, nx, pz, nz, x + F.n[0], y + F.n[1], z + F.n[2])) continue;
      const tile = f === 2 ? def.t[0] : f === 3 ? def.t[1] : def.t[2];
      const uvr = tileUV(tile);
      const q0 = F.c[0], q1 = F.c[1], q2 = F.c[2], q3 = F.c[3];
      const ax = x0 + x + q0[0], ay = y + q0[1], az = z0 + z + q0[2];
      const bx = x0 + x + q1[0], by = y + q1[1], bz = z0 + z + q1[2];
      const cxv = x0 + x + q2[0], cyv = y + q2[1], czv = z0 + z + q2[2];
      const dx = x0 + x + q3[0], dy = y + q3[1], dz = z0 + z + q3[2];
      pos.push(ax, ay, az, bx, by, bz, cxv, cyv, czv, dx, dy, dz);
      for (let k = 0; k < 4; k++) nor.push(F.n[0], F.n[1], F.n[2]);
      uv.push(uvr[0], uvr[1], uvr[2], uvr[1], uvr[2], uvr[3], uvr[0], uvr[3]);
      const base = pos.length / 3 - 4;
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
      lp.push(ax, ay, az, bx, by, bz);     ls.push(0, 0);
      lp.push(ax, ay, az, bx, by, bz);     ls.push(1, 1);
      lp.push(bx, by, bz, cxv, cyv, czv);  ls.push(0, 0);
      lp.push(bx, by, bz, cxv, cyv, czv);  ls.push(1, 1);
      lp.push(cxv, cyv, czv, dx, dy, dz);  ls.push(0, 0);
      lp.push(cxv, cyv, czv, dx, dy, dz);  ls.push(1, 1);
      lp.push(dx, dy, dz, ax, ay, az);     ls.push(0, 0);
      lp.push(dx, dy, dz, ax, ay, az);     ls.push(1, 1);
    }
  }

  return {
    cx, cz,
    pos: new Float32Array(pos),
    nor: new Float32Array(nor),
    uv: new Float32Array(uv),
    index: new Uint32Array(index),
    lp: new Float32Array(lp),
    ls: new Float32Array(ls),
  };
}

return { H, CS, B, T, BLOCKS, FACES, ATLAS, TS, PAD, hash2, tileUV, height, isTree, genChunk, meshChunk };

})();
