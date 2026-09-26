/* worldcore.js — bootstrap for the Rust/WASM world core.
   Source: rust/worldcore (terrain gen, meshing, chunk streaming scheduler),
   compiled to public/wasm/wc_bg.wasm + wc.js (wasm-bindgen no-modules glue).
   Resolves self.WC with the shared constants plus:
     World                               chunk store + streaming scheduler
     gen_chunk(cx, cz, edits) -> Uint8Array     pure terrain generation
     mesh_chunk_raw(cx, cz, s,px,nx,pz,nz)      pure chunk meshing
   The same pure fns run inside workerpool workers via importScripts. */

self.WC_READY = wasm_bindgen({ module_or_path: 'wasm/wc_bg.wasm' }).then(() => {
  self.WC = wasm_bindgen.world_consts();
  self.WC.World = wasm_bindgen.World;
  self.WC.gen_chunk = wasm_bindgen.gen_chunk;
  self.WC.mesh_chunk_raw = wasm_bindgen.mesh_chunk_raw;
});
