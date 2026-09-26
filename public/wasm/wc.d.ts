declare namespace wasm_bindgen {
    /* tslint:disable */
    /* eslint-disable */

    export class MeshResult {
        private constructor();
        free(): void;
        [Symbol.dispose](): void;
        readonly index: Uint32Array;
        readonly lp: Float32Array;
        readonly ls: Float32Array;
        readonly nor: Float32Array;
        readonly pos: Float32Array;
        readonly uv: Float32Array;
    }

    export class World {
        free(): void;
        [Symbol.dispose](): void;
        chunk_count(): number;
        /**
         * Player edit: set voxel, persist the edit, dirty affected chunk(s).
         */
        edit(wx: number, wy: number, wz: number, b: number): boolean;
        /**
         * Flat [lidx, block, ...] edit list for a chunk (worker gen input).
         */
        edits_flat(cx: number, cz: number): Uint32Array | undefined;
        /**
         * Finish a gen job: store the voxels, flag the chunk dirty, and dirty the
         * four neighbours (their border faces may have changed).
         */
        gen_done(cx: number, cz: number, tok: number, data?: Uint8Array | null): void;
        get(wx: number, wy: number, wz: number): number;
        has_voxels(cx: number, cz: number): boolean;
        inflight(): number;
        /**
         * Mesh a chunk straight from the store (main-thread path / fallback).
         */
        mesh_chunk(cx: number, cz: number): MeshResult | undefined;
        mesh_done(cx: number, cz: number, tok: number): void;
        /**
         * May a queued mesh result for (cx,cz,tok) still be applied?
         */
        mesh_valid(cx: number, cz: number, tok: number): boolean;
        constructor(radius: number, max_tasks: number);
        /**
         * Physics solidity: unloaded chunks are solid so the player can't fall
         * into not-yet-generated space.
         */
        solid(wx: number, wy: number, wz: number): boolean;
        /**
         * Per-frame scheduler. Returns a flat i32 list of jobs:
         * [tag, cx, cz, tok, ...] where tag is JOB_GEN / JOB_MESH / JOB_UNLOAD.
         * GEN/MESH jobs are already marked in-flight here; JS must finish them
         * via gen_done / mesh_done. UNLOAD jobs mean "drop render resources".
         */
        update(px: number, pz: number): Int32Array;
        /**
         * Owned copy of a chunk's voxel data (for transfer to a mesh worker).
         */
        voxels(cx: number, cz: number): Uint8Array | undefined;
    }

    export function gen_chunk(cx: number, cz: number, edits?: Uint32Array | null): Uint8Array;

    export function mesh_chunk_raw(cx: number, cz: number, selfv: Uint8Array, px?: Uint8Array | null, nx?: Uint8Array | null, pz?: Uint8Array | null, nz?: Uint8Array | null): MeshResult;

    export function world_consts(): any;

}
declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_meshresult_free: (a: number, b: number) => void;
    readonly __wbg_world_free: (a: number, b: number) => void;
    readonly gen_chunk: (a: number, b: number, c: number) => any;
    readonly mesh_chunk_raw: (a: number, b: number, c: any, d: number, e: number, f: number, g: number) => number;
    readonly meshresult_index: (a: number) => any;
    readonly meshresult_lp: (a: number) => any;
    readonly meshresult_ls: (a: number) => any;
    readonly meshresult_nor: (a: number) => any;
    readonly meshresult_pos: (a: number) => any;
    readonly meshresult_uv: (a: number) => any;
    readonly world_chunk_count: (a: number) => number;
    readonly world_consts: () => any;
    readonly world_edit: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly world_edits_flat: (a: number, b: number, c: number) => any;
    readonly world_gen_done: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly world_get: (a: number, b: number, c: number, d: number) => number;
    readonly world_has_voxels: (a: number, b: number, c: number) => number;
    readonly world_inflight: (a: number) => number;
    readonly world_mesh_chunk: (a: number, b: number, c: number) => number;
    readonly world_mesh_done: (a: number, b: number, c: number, d: number) => void;
    readonly world_mesh_valid: (a: number, b: number, c: number, d: number) => number;
    readonly world_new: (a: number, b: number) => number;
    readonly world_solid: (a: number, b: number, c: number, d: number) => number;
    readonly world_update: (a: number, b: number, c: number) => any;
    readonly world_voxels: (a: number, b: number, c: number) => any;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

declare type SyncInitInput = BufferSource | WebAssembly.Module;

declare namespace wasm_bindgen {
    /**
     * Instantiates the given `module`, which can either be bytes or
     * a precompiled `WebAssembly.Module`.
     *
     * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
     *
     * @returns {InitOutput}
     */
    export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;
}

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
declare function wasm_bindgen (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
