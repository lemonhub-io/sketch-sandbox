/* worker.js — workerpool worker: terrain generation + meshing, off-thread */

importScripts('vendor/fastnoise-lite.js', 'vendor/workerpool.js', 'worldcore.js');

workerpool.worker({
  gen: (a) => {
    const data = WC.genChunk(a.cx, a.cz, a.edits);
    return new workerpool.Transfer({ cx: a.cx, cz: a.cz, data }, [data.buffer]);
  },

  mesh: (a) => {
    const r = WC.meshChunk(a.cx, a.cz, a.self, a.px, a.nx, a.pz, a.nz);
    return new workerpool.Transfer(r, [
      r.pos.buffer, r.nor.buffer, r.uv.buffer,
      r.index.buffer, r.lp.buffer, r.ls.buffer,
    ]);
  },
});
