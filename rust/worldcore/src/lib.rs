#[cfg(target_feature = "simd128")]
use core::arch::wasm32::*;
use js_sys::{Array as JsArray, Float32Array, Int32Array, Object, Reflect, Uint32Array, Uint8Array};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

pub const H: i32 = 24;
pub const CS: i32 = 16;
const YS: i32 = CS * CS;
const VOL: usize = (YS * H) as usize;

const B_GRASS: u8 = 1;
const B_DIRT: u8 = 2;
const B_STONE: u8 = 3;
const B_LOG: u8 = 4;
const B_LEAF: u8 = 5;
const B_SAND: u8 = 6;

const ATLAS: i32 = 4;
const TS: f64 = 128.0;
const PAD: f64 = 3.0;

const JOB_GEN: i32 = 0;
const JOB_MESH: i32 = 1;
const JOB_UNLOAD: i32 = 2;

// block id -> [top, bottom, sides] tile ids
const BLOCK_TILES: [[u8; 3]; 9] = [
    [0, 0, 0],
    [0, 2, 1],
    [2, 2, 2],
    [3, 3, 3],
    [5, 5, 4],
    [6, 6, 6],
    [7, 7, 7],
    [8, 8, 8],
    [9, 9, 9],
];

const FACES: [([i32; 3], [[i32; 3]; 4]); 6] = [
    ([1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]),
    ([-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]),
    ([0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]),
    ([0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]),
    ([0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]),
    ([0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]),
];

/* ---------------- FastNoiseLite OpenSimplex2S (3D) ----------------
   Line-by-line port of the vendored fastnoise-lite.js paths used by the
   terrain: GetNoise -> DefaultOpenSimplex2 transform -> optional FBm ->
   _SingleOpenSimplex2SR3. All f64 to match JS number semantics. */

mod noise {
    const PRIME_X: i32 = 501_125_321;
    const PRIME_Y: i32 = 1_136_930_381;
    const PRIME_Z: i32 = 1_720_413_743;

    const GRADIENTS_3D: [f64; 256] = [
        0.0, 1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, -1.0, -1.0, 0.0,
        1.0, 0.0, 1.0, 0.0, -1.0, 0.0, 1.0, 0.0, 1.0, 0.0, -1.0, 0.0, -1.0, 0.0, -1.0, 0.0,
        1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, -1.0, -1.0, 0.0, 0.0,
        0.0, 1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, -1.0, -1.0, 0.0,
        1.0, 0.0, 1.0, 0.0, -1.0, 0.0, 1.0, 0.0, 1.0, 0.0, -1.0, 0.0, -1.0, 0.0, -1.0, 0.0,
        1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, -1.0, -1.0, 0.0, 0.0,
        0.0, 1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, -1.0, -1.0, 0.0,
        1.0, 0.0, 1.0, 0.0, -1.0, 0.0, 1.0, 0.0, 1.0, 0.0, -1.0, 0.0, -1.0, 0.0, -1.0, 0.0,
        1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, -1.0, -1.0, 0.0, 0.0,
        0.0, 1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, -1.0, -1.0, 0.0,
        1.0, 0.0, 1.0, 0.0, -1.0, 0.0, 1.0, 0.0, 1.0, 0.0, -1.0, 0.0, -1.0, 0.0, -1.0, 0.0,
        1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, -1.0, -1.0, 0.0, 0.0,
        0.0, 1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, -1.0, -1.0, 0.0,
        1.0, 0.0, 1.0, 0.0, -1.0, 0.0, 1.0, 0.0, 1.0, 0.0, -1.0, 0.0, -1.0, 0.0, -1.0, 0.0,
        1.0, 1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, -1.0, -1.0, 0.0, 0.0,
        1.0, 1.0, 0.0, 0.0, 0.0, -1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 0.0, 0.0, -1.0, -1.0, 0.0,
    ];

    fn hash3(seed: i32, xp: i32, yp: i32, zp: i32) -> i32 {
        (seed ^ xp ^ yp ^ zp).wrapping_mul(0x27d4eb2d)
    }

    fn grad3(seed: i32, xp: i32, yp: i32, zp: i32, xd: f64, yd: f64, zd: f64) -> f64 {
        let mut h = hash3(seed, xp, yp, zp);
        h ^= h >> 15;
        h &= 63 << 2;
        let i = h as usize;
        xd * GRADIENTS_3D[i] + yd * GRADIENTS_3D[i + 1] + zd * GRADIENTS_3D[i + 2]
    }

    pub struct OpenSimplex2S {
        seed: i32,
        freq: f64,
        octaves: u32,
        lacunarity: f64,
        gain: f64,
        bounding: f64,
    }

    impl OpenSimplex2S {
        pub fn new(seed: i32, freq: f64, octaves: u32) -> Self {
            let gain = 0.5f64;
            let mut amp = gain;
            let mut amp_fractal = 1.0;
            for _ in 1..octaves {
                amp_fractal += amp;
                amp *= gain;
            }
            OpenSimplex2S {
                seed,
                freq,
                octaves,
                lacunarity: 2.0,
                gain,
                bounding: 1.0 / amp_fractal,
            }
        }

        pub fn get(&self, mut x: f64, mut y: f64, mut z: f64) -> f64 {
            x *= self.freq;
            y *= self.freq;
            z *= self.freq;
            let r = (x + y + z) * (2.0 / 3.0);
            x = r - x;
            y = r - y;
            z = r - z;
            if self.octaves <= 1 {
                return self.single(self.seed, x, y, z);
            }
            let mut seed = self.seed;
            let mut sum = 0.0;
            let mut amp = self.bounding;
            for _ in 0..self.octaves {
                let n = self.single(seed, x, y, z);
                seed = seed.wrapping_add(1);
                sum += n * amp;
                x *= self.lacunarity;
                y *= self.lacunarity;
                z *= self.lacunarity;
                amp *= self.gain;
            }
            sum
        }

        fn single(&self, seed: i32, x: f64, y: f64, z: f64) -> f64 {
            let fi = x.floor();
            let fj = y.floor();
            let fk = z.floor();
            let xi = x - fi;
            let yi = y - fj;
            let zi = z - fk;

            let i = (fi as i32).wrapping_mul(PRIME_X);
            let j = (fj as i32).wrapping_mul(PRIME_Y);
            let k = (fk as i32).wrapping_mul(PRIME_Z);
            let seed2 = seed.wrapping_add(1293373);

            let xnm = (-0.5f64 - xi).trunc() as i32;
            let ynm = (-0.5f64 - yi).trunc() as i32;
            let znm = (-0.5f64 - zi).trunc() as i32;

            let x0 = xi + xnm as f64;
            let y0 = yi + ynm as f64;
            let z0 = zi + znm as f64;
            let a0 = 0.75 - x0 * x0 - y0 * y0 - z0 * z0;
            let mut value = a0
                * a0
                * (a0 * a0)
                * grad3(
                    seed,
                    i.wrapping_add(xnm & PRIME_X),
                    j.wrapping_add(ynm & PRIME_Y),
                    k.wrapping_add(znm & PRIME_Z),
                    x0,
                    y0,
                    z0,
                );

            let x1 = xi - 0.5;
            let y1 = yi - 0.5;
            let z1 = zi - 0.5;
            let a1 = 0.75 - x1 * x1 - y1 * y1 - z1 * z1;
            value += a1
                * a1
                * (a1 * a1)
                * grad3(
                    seed2,
                    i.wrapping_add(PRIME_X),
                    j.wrapping_add(PRIME_Y),
                    k.wrapping_add(PRIME_Z),
                    x1,
                    y1,
                    z1,
                );

            let xf0 = ((xnm | 1) << 1) as f64 * x1;
            let yf0 = ((ynm | 1) << 1) as f64 * y1;
            let zf0 = ((znm | 1) << 1) as f64 * z1;
            let xf1 = (-2 - (xnm << 2)) as f64 * x1 - 1.0;
            let yf1 = (-2 - (ynm << 2)) as f64 * y1 - 1.0;
            let zf1 = (-2 - (znm << 2)) as f64 * z1 - 1.0;

            let mut skip5 = false;
            let a2 = xf0 + a0;
            if a2 > 0.0 {
                let x2 = x0 - (xnm | 1) as f64;
                value += a2
                    * a2
                    * (a2 * a2)
                    * grad3(
                        seed,
                        i.wrapping_add(!xnm & PRIME_X),
                        j.wrapping_add(ynm & PRIME_Y),
                        k.wrapping_add(znm & PRIME_Z),
                        x2,
                        y0,
                        z0,
                    );
            } else {
                let a3 = yf0 + zf0 + a0;
                if a3 > 0.0 {
                    let x3 = x0;
                    let y3 = y0 - (ynm | 1) as f64;
                    let z3 = z0 - (znm | 1) as f64;
                    value += a3
                        * a3
                        * (a3 * a3)
                        * grad3(
                            seed,
                            i.wrapping_add(xnm & PRIME_X),
                            j.wrapping_add(!ynm & PRIME_Y),
                            k.wrapping_add(!znm & PRIME_Z),
                            x3,
                            y3,
                            z3,
                        );
                }
                let a4 = xf1 + a1;
                if a4 > 0.0 {
                    let x4 = (xnm | 1) as f64 + x1;
                    value += a4
                        * a4
                        * (a4 * a4)
                        * grad3(
                            seed2,
                            i.wrapping_add(xnm & (PRIME_X * 2)),
                            j.wrapping_add(PRIME_Y),
                            k.wrapping_add(PRIME_Z),
                            x4,
                            y1,
                            z1,
                        );
                    skip5 = true;
                }
            }

            let mut skip9 = false;
            let a6 = yf0 + a0;
            if a6 > 0.0 {
                let x6 = x0;
                let y6 = y0 - (ynm | 1) as f64;
                value += a6
                    * a6
                    * (a6 * a6)
                    * grad3(
                        seed,
                        i.wrapping_add(xnm & PRIME_X),
                        j.wrapping_add(!ynm & PRIME_Y),
                        k.wrapping_add(znm & PRIME_Z),
                        x6,
                        y6,
                        z0,
                    );
            } else {
                let a7 = xf0 + zf0 + a0;
                if a7 > 0.0 {
                    let x7 = x0 - (xnm | 1) as f64;
                    let y7 = y0;
                    let z7 = z0 - (znm | 1) as f64;
                    value += a7
                        * a7
                        * (a7 * a7)
                        * grad3(
                            seed,
                            i.wrapping_add(!xnm & PRIME_X),
                            j.wrapping_add(ynm & PRIME_Y),
                            k.wrapping_add(!znm & PRIME_Z),
                            x7,
                            y7,
                            z7,
                        );
                }
                let a8 = yf1 + a1;
                if a8 > 0.0 {
                    let x8 = x1;
                    let y8 = (ynm | 1) as f64 + y1;
                    value += a8
                        * a8
                        * (a8 * a8)
                        * grad3(
                            seed2,
                            i.wrapping_add(PRIME_X),
                            j.wrapping_add(ynm & (PRIME_Y << 1)),
                            k.wrapping_add(PRIME_Z),
                            x8,
                            y8,
                            z1,
                        );
                    skip9 = true;
                }
            }

            let mut skip_d = false;
            let aa = zf0 + a0;
            if aa > 0.0 {
                let xa = x0;
                let ya = y0;
                let za = z0 - (znm | 1) as f64;
                value += aa
                    * aa
                    * (aa * aa)
                    * grad3(
                        seed,
                        i.wrapping_add(xnm & PRIME_X),
                        j.wrapping_add(ynm & PRIME_Y),
                        k.wrapping_add(!znm & PRIME_Z),
                        xa,
                        ya,
                        za,
                    );
            } else {
                let ab = xf0 + yf0 + a0;
                if ab > 0.0 {
                    let xb = x0 - (xnm | 1) as f64;
                    let yb = y0 - (ynm | 1) as f64;
                    value += ab
                        * ab
                        * (ab * ab)
                        * grad3(
                            seed,
                            i.wrapping_add(!xnm & PRIME_X),
                            j.wrapping_add(!ynm & PRIME_Y),
                            k.wrapping_add(znm & PRIME_Z),
                            xb,
                            yb,
                            z0,
                        );
                }
                let ac = zf1 + a1;
                if ac > 0.0 {
                    let xc = x1;
                    let yc = y1;
                    let zc = (znm | 1) as f64 + z1;
                    value += ac
                        * ac
                        * (ac * ac)
                        * grad3(
                            seed2,
                            i.wrapping_add(PRIME_X),
                            j.wrapping_add(PRIME_Y),
                            k.wrapping_add(znm & (PRIME_Z << 1)),
                            xc,
                            yc,
                            zc,
                        );
                    skip_d = true;
                }
            }

            if !skip5 {
                let a5 = yf1 + zf1 + a1;
                if a5 > 0.0 {
                    let x5 = x1;
                    let y5 = (ynm | 1) as f64 + y1;
                    let z5 = (znm | 1) as f64 + z1;
                    value += a5
                        * a5
                        * (a5 * a5)
                        * grad3(
                            seed2,
                            i.wrapping_add(PRIME_X),
                            j.wrapping_add(ynm & (PRIME_Y << 1)),
                            k.wrapping_add(znm & (PRIME_Z << 1)),
                            x5,
                            y5,
                            z5,
                        );
                }
            }

            if !skip9 {
                let a9 = xf1 + zf1 + a1;
                if a9 > 0.0 {
                    let x9 = (xnm | 1) as f64 + x1;
                    let y9 = y1;
                    let z9 = (znm | 1) as f64 + z1;
                    value += a9
                        * a9
                        * (a9 * a9)
                        * grad3(
                            seed2,
                            i.wrapping_add(xnm & (PRIME_X * 2)),
                            j.wrapping_add(PRIME_Y),
                            k.wrapping_add(znm & (PRIME_Z << 1)),
                            x9,
                            y9,
                            z9,
                        );
                }
            }

            if !skip_d {
                let ad = xf1 + yf1 + a1;
                if ad > 0.0 {
                    let xd = (xnm | 1) as f64 + x1;
                    let yd = (ynm | 1) as f64 + y1;
                    value += ad
                        * ad
                        * (ad * ad)
                        * grad3(
                            seed2,
                            i.wrapping_add(xnm & (PRIME_X << 1)),
                            j.wrapping_add(ynm & (PRIME_Y << 1)),
                            k.wrapping_add(PRIME_Z),
                            xd,
                            yd,
                            z1,
                        );
                }
            }

            value * 9.046026385208288
        }
    }
}

/* ---------------- terrain ---------------- */

fn hash2(x: f64, z: f64) -> f64 {
    let s = (x * 127.1 + z * 311.7).sin() * 43758.5453;
    s - s.floor()
}

struct Terrain {
    base: noise::OpenSimplex2S,
    detail: noise::OpenSimplex2S,
}

impl Terrain {
    fn new() -> Self {
        Terrain {
            base: noise::OpenSimplex2S::new(1337, 0.012, 4),
            detail: noise::OpenSimplex2S::new(9449, 0.085, 1),
        }
    }

    fn height(&self, wx: i32, wz: i32) -> i32 {
        let t0 = self.base.get(wx as f64, 0.0, wz as f64) * 0.5 + 0.5;
        let t = t0 * t0 * (3.0 - 2.0 * t0);
        let d = self.detail.get(wx as f64, 0.0, wz as f64);
        ((2.0 + t * 13.0 + d * 2.0).floor() as i32).clamp(1, H - 6)
    }
}

fn is_tree(wx: i32, wz: i32) -> bool {
    hash2(wx as f64 * 1.71 + 13.7, wz as f64 * 0.97 + 7.3) < 0.008
}

fn put(d: &mut [u8], x: i32, y: i32, z: i32, b: u8, air_only: bool) {
    if x < 0 || x >= CS || z < 0 || z >= CS || y < 0 || y >= H {
        return;
    }
    let i = (x + z * CS + y * YS) as usize;
    if !air_only || d[i] == 0 {
        d[i] = b;
    }
}

fn gen_voxels(cx: i32, cz: i32, edits: Option<Vec<u32>>) -> Vec<u8> {
    let mut data = vec![0u8; VOL];
    let t = Terrain::new();
    let x0 = cx.wrapping_mul(CS);
    let z0 = cz.wrapping_mul(CS);

    let mut hmap = [0u8; (CS * CS) as usize];
    for z in 0..CS {
        for x in 0..CS {
            hmap[(x + z * CS) as usize] = t.height(x0 + x, z0 + z) as u8;
        }
    }

    #[cfg(target_feature = "simd128")]
    unsafe {
        let three = i8x16_splat(3);
        let sandv = i8x16_splat(B_SAND as i8);
        let grassv = i8x16_splat(B_GRASS as i8);
        let stonev = i8x16_splat(B_STONE as i8);
        let dirtv = i8x16_splat(B_DIRT as i8);
        for y in 0..H {
            let yv = i8x16_splat(y as i8);
            let yp2 = i8x16_splat((y + 2) as i8);
            for z in 0..CS {
                let row = (z * CS) as usize;
                let hv = v128_load(hmap.as_ptr().add(row) as *const v128);
                let solid = i8x16_ge(hv, yv);
                let pick = v128_bitselect(stonev, dirtv, i8x16_gt(hv, yp2));
                let pick = v128_bitselect(grassv, pick, i8x16_eq(hv, yv));
                let pick = v128_bitselect(sandv, pick, i8x16_le(hv, three));
                v128_store(
                    data.as_mut_ptr().add(row + (y * YS) as usize) as *mut v128,
                    v128_and(pick, solid),
                );
            }
        }
    }
    #[cfg(not(target_feature = "simd128"))]
    for z in 0..CS {
        for x in 0..CS {
            let h = hmap[(x + z * CS) as usize] as i32;
            for y in 0..=h {
                let b = if h <= 3 {
                    B_SAND
                } else if y == h {
                    B_GRASS
                } else if y < h - 2 {
                    B_STONE
                } else {
                    B_DIRT
                };
                data[(x + z * CS + y * YS) as usize] = b;
            }
        }
    }

    for oz in (z0 - 2)..(z0 + CS + 2) {
        for ox in (x0 - 2)..(x0 + CS + 2) {
            if !is_tree(ox, oz) {
                continue;
            }
            let h = t.height(ox, oz);
            if h <= 3 {
                continue;
            }
            let th = h + 3 + if hash2(ox as f64 * 1.3 + 9.0, oz as f64 * 1.7 + 4.0) < 0.5 {
                1
            } else {
                0
            };
            for y in (h + 1)..=th {
                put(&mut data, ox - x0, y, oz - z0, B_LOG, false);
            }
            for dy in -1i32..=1 {
                for dx in -2i32..=2 {
                    for dz in -2i32..=2 {
                        if dx.abs() + dz.abs() + dy.abs() > 3 {
                            continue;
                        }
                        if dx == 0 && dz == 0 && dy <= 0 {
                            continue;
                        }
                        put(&mut data, ox + dx - x0, th + dy, oz + dz - z0, B_LEAF, true);
                    }
                }
            }
            put(&mut data, ox - x0, th + 1, oz - z0, B_LEAF, true);
        }
    }

    if let Some(ed) = edits {
        for pair in ed.chunks_exact(2) {
            data[pair[0] as usize] = pair[1] as u8;
        }
    }
    data
}

#[wasm_bindgen]
pub fn gen_chunk(cx: i32, cz: i32, edits: Option<Uint32Array>) -> Uint8Array {
    let data = gen_voxels(cx, cz, edits.map(|e| e.to_vec()));
    let a = Uint8Array::new_with_length(data.len() as u32);
    a.copy_from(&data);
    a
}

/* ---------------- meshing ---------------- */

#[wasm_bindgen]
pub struct MeshResult {
    pos: Vec<f32>,
    nor: Vec<f32>,
    uv: Vec<f32>,
    index: Vec<u32>,
    lp: Vec<f32>,
    ls: Vec<f32>,
}

#[wasm_bindgen]
impl MeshResult {
    #[wasm_bindgen(getter)]
    pub fn pos(&self) -> Float32Array {
        let a = Float32Array::new_with_length(self.pos.len() as u32);
        a.copy_from(&self.pos);
        a
    }
    #[wasm_bindgen(getter)]
    pub fn nor(&self) -> Float32Array {
        let a = Float32Array::new_with_length(self.nor.len() as u32);
        a.copy_from(&self.nor);
        a
    }
    #[wasm_bindgen(getter)]
    pub fn uv(&self) -> Float32Array {
        let a = Float32Array::new_with_length(self.uv.len() as u32);
        a.copy_from(&self.uv);
        a
    }
    #[wasm_bindgen(getter)]
    pub fn index(&self) -> Uint32Array {
        let a = Uint32Array::new_with_length(self.index.len() as u32);
        a.copy_from(&self.index);
        a
    }
    #[wasm_bindgen(getter)]
    pub fn lp(&self) -> Float32Array {
        let a = Float32Array::new_with_length(self.lp.len() as u32);
        a.copy_from(&self.lp);
        a
    }
    #[wasm_bindgen(getter)]
    pub fn ls(&self) -> Float32Array {
        let a = Float32Array::new_with_length(self.ls.len() as u32);
        a.copy_from(&self.ls);
        a
    }
}

fn tile_uv(t: u8) -> [f32; 4] {
    let at = (ATLAS as f64) * TS;
    let col = (t as i32 % ATLAS) as f64;
    let row = (t as i32 / ATLAS) as f64;
    let u0 = (col * TS + PAD) / at;
    let u1 = ((col + 1.0) * TS - PAD) / at;
    let v1 = 1.0 - (row * TS + PAD) / at;
    let v0 = 1.0 - ((row + 1.0) * TS - PAD) / at;
    [u0 as f32, v0 as f32, u1 as f32, v1 as f32]
}

fn sample(
    selfv: &[u8],
    px: Option<&[u8]>,
    nx: Option<&[u8]>,
    pz: Option<&[u8]>,
    nz: Option<&[u8]>,
    x: i32,
    y: i32,
    z: i32,
) -> u8 {
    if y < 0 || y >= H {
        return 0;
    }
    if x < 0 {
        return nx.map_or(0, |n| n[(x + CS + z * CS + y * YS) as usize]);
    }
    if x >= CS {
        return px.map_or(0, |n| n[(x - CS + z * CS + y * YS) as usize]);
    }
    if z < 0 {
        return nz.map_or(0, |n| n[(x + (z + CS) * CS + y * YS) as usize]);
    }
    if z >= CS {
        return pz.map_or(0, |n| n[(x + (z - CS) * CS + y * YS) as usize]);
    }
    selfv[(x + z * CS + y * YS) as usize]
}

const LS_FACE: [f32; 16] = [0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0];

struct MeshOut {
    pos: Vec<f32>,
    nor: Vec<f32>,
    uv: Vec<f32>,
    index: Vec<u32>,
    lp: Vec<f32>,
    ls: Vec<f32>,
}

impl MeshOut {
    fn new() -> Self {
        MeshOut {
            pos: Vec::new(),
            nor: Vec::new(),
            uv: Vec::new(),
            index: Vec::new(),
            lp: Vec::new(),
            ls: Vec::new(),
        }
    }

    #[inline]
    fn face(&mut self, def: [u8; 3], f: usize, x0: i32, z0: i32, x: i32, y: i32, z: i32) {
        let (n, c) = &FACES[f];
        let tile = if f == 2 {
            def[0]
        } else if f == 3 {
            def[1]
        } else {
            def[2]
        };
        let uvr = tile_uv(tile);
        let q0 = c[0];
        let q1 = c[1];
        let q2 = c[2];
        let q3 = c[3];
        let ax = (x0 + x + q0[0]) as f32;
        let ay = (y + q0[1]) as f32;
        let az = (z0 + z + q0[2]) as f32;
        let bx = (x0 + x + q1[0]) as f32;
        let by = (y + q1[1]) as f32;
        let bz = (z0 + z + q1[2]) as f32;
        let cxv = (x0 + x + q2[0]) as f32;
        let cyv = (y + q2[1]) as f32;
        let czv = (z0 + z + q2[2]) as f32;
        let dx = (x0 + x + q3[0]) as f32;
        let dy = (y + q3[1]) as f32;
        let dz = (z0 + z + q3[2]) as f32;
        self.pos
            .extend_from_slice(&[ax, ay, az, bx, by, bz, cxv, cyv, czv, dx, dy, dz]);
        let (nx, ny, nzv) = (n[0] as f32, n[1] as f32, n[2] as f32);
        self.nor.extend_from_slice(&[
            nx, ny, nzv, nx, ny, nzv, nx, ny, nzv, nx, ny, nzv,
        ]);
        self.uv.extend_from_slice(&[
            uvr[0], uvr[1], uvr[2], uvr[1], uvr[2], uvr[3], uvr[0], uvr[3],
        ]);
        let base = (self.pos.len() / 3 - 4) as u32;
        self.index
            .extend_from_slice(&[base, base + 1, base + 2, base, base + 2, base + 3]);
        self.lp.extend_from_slice(&[
            ax, ay, az, bx, by, bz, ax, ay, az, bx, by, bz, bx, by, bz, cxv, cyv, czv, bx, by,
            bz, cxv, cyv, czv, cxv, cyv, czv, dx, dy, dz, cxv, cyv, czv, dx, dy, dz, dx, dy,
            dz, ax, ay, az, dx, dy, dz, ax, ay, az,
        ]);
        self.ls.extend_from_slice(&LS_FACE);
    }

    #[inline]
    fn voxel(
        &mut self,
        selfv: &[u8],
        px: Option<&[u8]>,
        nx: Option<&[u8]>,
        pz: Option<&[u8]>,
        nz: Option<&[u8]>,
        x0: i32,
        z0: i32,
        x: i32,
        y: i32,
        z: i32,
        b: u8,
    ) {
        let def = BLOCK_TILES[b as usize];
        for f in 0..6 {
            let (n, _) = &FACES[f];
            if sample(selfv, px, nx, pz, nz, x + n[0], y + n[1], z + n[2]) != 0 {
                continue;
            }
            self.face(def, f, x0, z0, x, y, z);
        }
    }

    fn row_scalar(
        &mut self,
        selfv: &[u8],
        px: Option<&[u8]>,
        nx: Option<&[u8]>,
        pz: Option<&[u8]>,
        nz: Option<&[u8]>,
        x0: i32,
        z0: i32,
        y: i32,
        z: i32,
    ) {
        for x in 0..CS {
            let b = selfv[(x + z * CS + y * YS) as usize];
            if b == 0 {
                continue;
            }
            self.voxel(selfv, px, nx, pz, nz, x0, z0, x, y, z, b);
        }
    }

    /// SIMD row: for interior (y,z) rows, one v128 load per direction gives the
    /// 16-lane "neighbour is air" masks; lanes with a solid block and at least
    /// one open in-chunk neighbour — or sitting on the x border — run the face
    /// emit directly off the mask bits (per-lane sample() calls skipped).
    #[cfg(target_feature = "simd128")]
    fn row_simd(
        &mut self,
        selfv: &[u8],
        px: Option<&[u8]>,
        nx: Option<&[u8]>,
        pz: Option<&[u8]>,
        nz: Option<&[u8]>,
        x0: i32,
        z0: i32,
        y: i32,
        z: i32,
    ) {
        if y < 1 || y >= H - 1 || z < 1 || z >= CS - 1 {
            return self.row_scalar(selfv, px, nx, pz, nz, x0, z0, y, z);
        }
        let base = (z * CS + y * YS) as usize;
        unsafe {
            let p = selfv.as_ptr();
            let ld = |o: isize| v128_load(p.offset(base as isize + o) as *const v128);
            let zero = i8x16_splat(0);
            let open = |o: isize| (i8x16_bitmask(i8x16_eq(ld(o), zero)) as u32) & 0xffff;
            let solid = (i8x16_bitmask(i8x16_ne(ld(0), zero)) as u32) & 0xffff;
            let mxm = open(-1);
            let mxp = open(1);
            let mym = open(-(YS as isize));
            let myp = open(YS as isize);
            let mzm = open(-(CS as isize));
            let mzp = open(CS as isize);
            let mut work = solid & (mxm | mxp | mym | myp | mzm | mzp | 0x8001);
            while work != 0 {
                let x = work.trailing_zeros();
                work &= work - 1;
                let b = selfv[base + x as usize];
                if x == 0 || x == (CS - 1) as u32 {
                    self.voxel(selfv, px, nx, pz, nz, x0, z0, x as i32, y, z, b);
                    continue;
                }
                let bits = ((mxp >> x) & 1)
                    | ((mxm >> x) & 1) << 1
                    | ((myp >> x) & 1) << 2
                    | ((mym >> x) & 1) << 3
                    | ((mzp >> x) & 1) << 4
                    | ((mzm >> x) & 1) << 5;
                let def = BLOCK_TILES[b as usize];
                for f in 0..6usize {
                    if bits & (1 << f) != 0 {
                        self.face(def, f, x0, z0, x as i32, y, z);
                    }
                }
            }
        }
    }
}

fn mesh_voxels(
    cx: i32,
    cz: i32,
    selfv: &[u8],
    px: Option<&[u8]>,
    nx: Option<&[u8]>,
    pz: Option<&[u8]>,
    nz: Option<&[u8]>,
) -> MeshResult {
    let mut out = MeshOut::new();
    let x0 = cx.wrapping_mul(CS);
    let z0 = cz.wrapping_mul(CS);

    for y in 0..H {
        for z in 0..CS {
            #[cfg(target_feature = "simd128")]
            out.row_simd(selfv, px, nx, pz, nz, x0, z0, y, z);
            #[cfg(not(target_feature = "simd128"))]
            out.row_scalar(selfv, px, nx, pz, nz, x0, z0, y, z);
        }
    }

    MeshResult {
        pos: out.pos,
        nor: out.nor,
        uv: out.uv,
        index: out.index,
        lp: out.lp,
        ls: out.ls,
    }
}

#[wasm_bindgen]
pub fn mesh_chunk_raw(
    cx: i32,
    cz: i32,
    selfv: Uint8Array,
    px: Option<Uint8Array>,
    nx: Option<Uint8Array>,
    pz: Option<Uint8Array>,
    nz: Option<Uint8Array>,
) -> MeshResult {
    let sv = selfv.to_vec();
    let p = px.as_ref().map(|a| a.to_vec());
    let n = nx.as_ref().map(|a| a.to_vec());
    let pz_ = pz.as_ref().map(|a| a.to_vec());
    let nz_ = nz.as_ref().map(|a| a.to_vec());
    mesh_voxels(
        cx,
        cz,
        &sv,
        p.as_deref(),
        n.as_deref(),
        pz_.as_deref(),
        nz_.as_deref(),
    )
}

/* ---------------- world / chunk streaming ---------------- */

fn key(cx: i32, cz: i32) -> i64 {
    ((cx as i64) << 32) | (cz as i64 & 0xffff_ffff)
}

fn lidx(x: i32, y: i32, z: i32) -> usize {
    ((x & (CS - 1)) + (z & (CS - 1)) * CS + y * YS) as usize
}

struct Chunk {
    vox: Option<Vec<u8>>,
    dirty: bool,
    gen_in: bool,
    gen_tok: i32,
    mesh_in: bool,
    mesh_tok: i32,
}

impl Chunk {
    fn new() -> Self {
        Chunk {
            vox: None,
            dirty: false,
            gen_in: false,
            gen_tok: 0,
            mesh_in: false,
            mesh_tok: 0,
        }
    }
}

#[wasm_bindgen]
pub struct World {
    radius: i32,
    max_tasks: i32,
    chunks: HashMap<i64, Chunk>,
    edits: HashMap<i64, HashMap<u32, u8>>,
    last: Option<(i32, i32)>,
    inflight: i32,
    tok: i32,
}

#[wasm_bindgen]
impl World {
    #[wasm_bindgen(constructor)]
    pub fn new(radius: i32, max_tasks: i32) -> World {
        World {
            radius,
            max_tasks,
            chunks: HashMap::new(),
            edits: HashMap::new(),
            last: None,
            inflight: 0,
            tok: 0,
        }
    }

    /// Per-frame scheduler. Returns a flat i32 list of jobs:
    /// [tag, cx, cz, tok, ...] where tag is JOB_GEN / JOB_MESH / JOB_UNLOAD.
    /// GEN/MESH jobs are already marked in-flight here; JS must finish them
    /// via gen_done / mesh_done. UNLOAD jobs mean "drop render resources".
    pub fn update(&mut self, px: f64, pz: f64) -> Int32Array {
        let pcx = (px / CS as f64).floor() as i32;
        let pcz = (pz / CS as f64).floor() as i32;
        let mut jobs: Vec<i32> = Vec::new();

        if self.last != Some((pcx, pcz)) {
            self.last = Some((pcx, pcz));
            for dz in -self.radius..=self.radius {
                for dx in -self.radius..=self.radius {
                    let (cx, cz) = (pcx + dx, pcz + dz);
                    self.chunks.entry(key(cx, cz)).or_insert_with(Chunk::new);
                }
            }
            let lim = self.radius + 1;
            let ks: Vec<i64> = self.chunks.keys().copied().collect();
            for k in ks {
                let cx = (k >> 32) as i32;
                let cz = k as i32;
                if (cx - pcx).abs().max((cz - pcz).abs()) > lim {
                    jobs.extend_from_slice(&[JOB_UNLOAD, cx, cz, 0]);
                    self.chunks.remove(&k);
                }
            }
        }

        let mut gens: Vec<(i32, i64)> = Vec::new();
        let mut meshs: Vec<(i32, i64)> = Vec::new();
        for (k, c) in &self.chunks {
            let cx = (*k >> 32) as i32;
            let cz = *k as i32;
            let d = (cx - pcx).abs().max((cz - pcz).abs());
            if c.vox.is_none() && !c.gen_in {
                gens.push((d, *k));
            } else if c.vox.is_some() && c.dirty && !c.mesh_in {
                meshs.push((d, *k));
            }
        }
        gens.sort_by_key(|g| g.0);
        meshs.sort_by_key(|g| g.0);

        for (_, k) in gens {
            if self.inflight >= self.max_tasks {
                break;
            }
            let c = self.chunks.get_mut(&k).unwrap();
            self.tok += 1;
            c.gen_in = true;
            c.gen_tok = self.tok;
            self.inflight += 1;
            jobs.extend_from_slice(&[JOB_GEN, (k >> 32) as i32, k as i32, c.gen_tok]);
        }
        for (_, k) in meshs {
            if self.inflight >= self.max_tasks {
                break;
            }
            let c = self.chunks.get_mut(&k).unwrap();
            self.tok += 1;
            c.mesh_in = true;
            c.dirty = false;
            c.mesh_tok = self.tok;
            self.inflight += 1;
            jobs.extend_from_slice(&[JOB_MESH, (k >> 32) as i32, k as i32, c.mesh_tok]);
        }

        let a = Int32Array::new_with_length(jobs.len() as u32);
        a.copy_from(&jobs);
        a
    }

    /// Finish a gen job: store the voxels, flag the chunk dirty, and dirty the
    /// four neighbours (their border faces may have changed).
    pub fn gen_done(&mut self, cx: i32, cz: i32, tok: i32, data: Option<Uint8Array>) {
        self.inflight -= 1;
        let k = key(cx, cz);
        let mut dirty_neighbours = false;
        if let Some(c) = self.chunks.get_mut(&k) {
            if c.gen_in && c.gen_tok == tok {
                c.gen_in = false;
                if let Some(d) = data {
                    c.vox = Some(d.to_vec());
                    c.dirty = true;
                    dirty_neighbours = true;
                }
            }
        }
        if dirty_neighbours {
            for (dx, dz) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                if let Some(n) = self.chunks.get_mut(&key(cx + dx, cz + dz)) {
                    if n.vox.is_some() {
                        n.dirty = true;
                    }
                }
            }
        }
    }

    pub fn mesh_done(&mut self, cx: i32, cz: i32, tok: i32) {
        self.inflight -= 1;
        if let Some(c) = self.chunks.get_mut(&key(cx, cz)) {
            if c.mesh_in && c.mesh_tok == tok {
                c.mesh_in = false;
            }
        }
    }

    /// May a queued mesh result for (cx,cz,tok) still be applied?
    pub fn mesh_valid(&self, cx: i32, cz: i32, tok: i32) -> bool {
        match self.chunks.get(&key(cx, cz)) {
            Some(c) => c.vox.is_some() && !c.dirty && c.mesh_tok == tok,
            None => false,
        }
    }

    /// Owned copy of a chunk's voxel data (for transfer to a mesh worker).
    pub fn voxels(&self, cx: i32, cz: i32) -> Option<Uint8Array> {
        let v = self.chunks.get(&key(cx, cz))?.vox.as_ref()?;
        let a = Uint8Array::new_with_length(v.len() as u32);
        a.copy_from(v);
        Some(a)
    }

    /// Flat [lidx, block, ...] edit list for a chunk (worker gen input).
    pub fn edits_flat(&self, cx: i32, cz: i32) -> Option<Uint32Array> {
        let e = self.edits.get(&key(cx, cz))?;
        if e.is_empty() {
            return None;
        }
        let mut flat = Vec::with_capacity(e.len() * 2);
        for (i, b) in e {
            flat.push(*i);
            flat.push(*b as u32);
        }
        let a = Uint32Array::new_with_length(flat.len() as u32);
        a.copy_from(&flat);
        Some(a)
    }

    /// Mesh a chunk straight from the store (main-thread path / fallback).
    pub fn mesh_chunk(&self, cx: i32, cz: i32) -> Option<MeshResult> {
        let c = self.chunks.get(&key(cx, cz))?;
        let v = c.vox.as_ref()?;
        let g = |dx: i32, dz: i32| {
            self.chunks
                .get(&key(cx + dx, cz + dz))
                .and_then(|n| n.vox.as_deref())
        };
        Some(mesh_voxels(cx, cz, v, g(1, 0), g(-1, 0), g(0, 1), g(0, -1)))
    }

    /// Player edit: set voxel, persist the edit, dirty affected chunk(s).
    pub fn edit(&mut self, wx: i32, wy: i32, wz: i32, b: u8) -> bool {
        let cx = wx.div_euclid(CS);
        let cz = wz.div_euclid(CS);
        let k = key(cx, cz);
        let i = lidx(wx, wy, wz);
        let (lx, lz) = (wx - cx * CS, wz - cz * CS);
        {
            let Some(c) = self.chunks.get_mut(&k) else { return false };
            let Some(vox) = c.vox.as_mut() else { return false };
            vox[i] = b;
            c.dirty = true;
        }
        self.edits.entry(k).or_default().insert(i as u32, b);
        let mut marks: [(i32, i32); 4] = [(0, 0); 4];
        let mut n = 0;
        if lx == 0 {
            marks[n] = (-1, 0);
            n += 1;
        }
        if lx == CS - 1 {
            marks[n] = (1, 0);
            n += 1;
        }
        if lz == 0 {
            marks[n] = (0, -1);
            n += 1;
        }
        if lz == CS - 1 {
            marks[n] = (0, 1);
            n += 1;
        }
        for &(dx, dz) in &marks[..n] {
            if let Some(c) = self.chunks.get_mut(&key(cx + dx, cz + dz)) {
                if c.vox.is_some() {
                    c.dirty = true;
                }
            }
        }
        true
    }

    pub fn get(&self, wx: i32, wy: i32, wz: i32) -> u8 {
        if wy < 0 || wy >= H {
            return 0;
        }
        match self.chunks.get(&key(wx.div_euclid(CS), wz.div_euclid(CS))) {
            Some(c) => c.vox.as_ref().map_or(0, |v| v[lidx(wx, wy, wz)]),
            None => 0,
        }
    }

    /// Physics solidity: unloaded chunks are solid so the player can't fall
    /// into not-yet-generated space.
    pub fn solid(&self, wx: i32, wy: i32, wz: i32) -> bool {
        if wy < 0 || wy >= H {
            return false;
        }
        match self.chunks.get(&key(wx.div_euclid(CS), wz.div_euclid(CS))) {
            Some(c) => c.vox.as_ref().map_or(true, |v| v[lidx(wx, wy, wz)] != 0),
            None => true,
        }
    }

    pub fn has_voxels(&self, cx: i32, cz: i32) -> bool {
        self.chunks
            .get(&key(cx, cz))
            .map_or(false, |c| c.vox.is_some())
    }

    pub fn chunk_count(&self) -> u32 {
        self.chunks.len() as u32
    }

    pub fn inflight(&self) -> i32 {
        self.inflight
    }
}

/* ---------------- constants shared with JS ---------------- */

#[wasm_bindgen]
pub fn world_consts() -> JsValue {
    let o = Object::new();
    let set = |o: &Object, k: &str, v: JsValue| {
        Reflect::set(o, &JsValue::from_str(k), &v).unwrap();
    };
    set(&o, "H", H.into());
    set(&o, "CS", CS.into());
    set(&o, "ATLAS", ATLAS.into());
    set(&o, "TS", (TS as i32).into());
    set(&o, "PAD", (PAD as i32).into());
    set(&o, "JOB_GEN", JOB_GEN.into());
    set(&o, "JOB_MESH", JOB_MESH.into());
    set(&o, "JOB_UNLOAD", JOB_UNLOAD.into());

    let b = Object::new();
    for (k, v) in [
        ("GRASS", 1),
        ("DIRT", 2),
        ("STONE", 3),
        ("LOG", 4),
        ("LEAF", 5),
        ("SAND", 6),
        ("PLANK", 7),
        ("BRICK", 8),
    ] {
        set(&b, k, v.into());
    }
    set(&o, "B", b.into());

    let t = Object::new();
    for (k, v) in [
        ("GRASS_TOP", 0),
        ("GRASS_SIDE", 1),
        ("DIRT", 2),
        ("STONE", 3),
        ("LOG_SIDE", 4),
        ("LOG_TOP", 5),
        ("LEAF", 6),
        ("SAND", 7),
        ("PLANK", 8),
        ("BRICK", 9),
    ] {
        set(&t, k, v.into());
    }
    set(&o, "T", t.into());

    let blocks = JsArray::new();
    blocks.push(&JsValue::NULL);
    for (n, tt) in [
        ("Grass", [0, 2, 1]),
        ("Dirt", [2, 2, 2]),
        ("Stone", [3, 3, 3]),
        ("Log", [5, 5, 4]),
        ("Leaf", [6, 6, 6]),
        ("Sand", [7, 7, 7]),
        ("Plank", [8, 8, 8]),
        ("Brick", [9, 9, 9]),
    ] {
        let d = Object::new();
        set(&d, "n", JsValue::from_str(n));
        let ta = JsArray::new();
        for v in tt {
            ta.push(&v.into());
        }
        set(&d, "t", ta.into());
        blocks.push(&d);
    }
    set(&o, "BLOCKS", blocks.into());

    o.into()
}
