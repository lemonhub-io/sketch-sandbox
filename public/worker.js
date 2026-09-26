/* worker.js — workerpool worker: terrain generation + meshing, off-thread.
   Both run in the Rust/WASM world core. Synchronous init (sync XHR is legal
   in workers) keeps the pool methods sync so workerpool.Transfer works. */

importScripts('vendor/workerpool.js', 'wasm/wc.js');

{
  const req = new XMLHttpRequest();
  req.open('GET', 'wasm/wc_bg.wasm', false);
  req.responseType = 'arraybuffer';
  req.send();
  wasm_bindgen.initSync({ module: req.response });
}

const genChunk = wasm_bindgen.gen_chunk;
const meshChunkRaw = wasm_bindgen.mesh_chunk_raw;

workerpool.worker({
  gen: (a) => {
    const data = genChunk(a.cx, a.cz, a.edits || null);
    return new workerpool.Transfer({ cx: a.cx, cz: a.cz, data }, [data.buffer]);
  },

  mesh: (a) => {
    const m = meshChunkRaw(a.cx, a.cz, a.self, a.px, a.nx, a.pz, a.nz);
    const r = {
      cx: a.cx, cz: a.cz,
      pos: m.pos, nor: m.nor, uv: m.uv,
      index: m.index, lp: m.lp, ls: m.ls,
    };
    m.free();
    return new workerpool.Transfer(r, [
      r.pos.buffer, r.nor.buffer, r.uv.buffer,
      r.index.buffer, r.lp.buffer, r.ls.buffer,
    ]);
  },
});
