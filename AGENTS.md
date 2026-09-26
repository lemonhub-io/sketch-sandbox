# sketch-sandbox

Three.js voxel sandbox. Terrain generation, chunk streaming, and greedy meshing
live in Rust compiled to WASM; rendering stays in JS/Three.js.

## Build

```bash
npm run build                 # vite build -> dist/ (copies public/ incl. wasm)
npm run dev                   # vite dev server
npx vite preview --port 4173  # serve production dist
```

## Rebuilding the WASM core

```bash
RUSTFLAGS="-C target-feature=+simd128" \
  wasm-pack build rust/worldcore --target no-modules \
  --out-dir public/wasm --out-name wc
```

Generated artifacts (`public/wasm/*`) MUST stay committed — the GitHub Pages
workflow only runs `vite build`, no Rust toolchain. `public/wasm/.gitignore`
contains `*`; the files are force-tracked, do not delete the dir.

## Testing

- Mesh/gen correctness: `/tmp/wctest2.mjs` style harness — loads old
  `worldcore.js` (from `git show <prev>:public/worldcore.js`) + new wasm,
  compares coverage sets (not bytes — greedy merging reorders quads).
- Browser: `npx playwright cli --config output/playwright/cli.config.json open <url>`,
  then `eval` against `window.__game` (renderer, world, render map, frame()).

## Gotchas

- `world.update()` early-outs via `needs_scan`; any new mutation entry point
  must set `self.needs_scan = true` or jobs never dispatch.
- Chunk geometry lives in one `THREE.BatchedMesh`; per-chunk records carry
  `geoId/instId` (+ fallback `mesh`). Outlines remain per-chunk LineSegments.
- Mesh UVs are in block units; `aTile` selects the atlas tile in-shader.
- Service worker is production-only (`import.meta.env.PROD`) and cache-first —
  after shipping a new build, stale SW caches serve old wasm until revalidate.
- Commit identity: pass `-c user.name=... -c user.email=...` inline; repo has
  no local git config.
