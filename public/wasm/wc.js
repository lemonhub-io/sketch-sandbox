let wasm_bindgen = (function(exports) {
    let script_src;
    if (typeof document !== 'undefined' && document.currentScript !== null) {
        script_src = new URL(document.currentScript.src, location.href).toString();
    }

    class MeshResult {
        static __wrap(ptr) {
            const obj = Object.create(MeshResult.prototype);
            obj.__wbg_ptr = ptr;
            MeshResultFinalization.register(obj, obj.__wbg_ptr, obj);
            return obj;
        }
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            MeshResultFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_meshresult_free(ptr, 0);
        }
        /**
         * @returns {Uint32Array}
         */
        get index() {
            const ret = wasm.meshresult_index(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {Float32Array}
         */
        get lp() {
            const ret = wasm.meshresult_lp(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {Float32Array}
         */
        get ls() {
            const ret = wasm.meshresult_ls(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {Float32Array}
         */
        get nor() {
            const ret = wasm.meshresult_nor(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {Float32Array}
         */
        get pos() {
            const ret = wasm.meshresult_pos(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {Float32Array}
         */
        get tile() {
            const ret = wasm.meshresult_tile(this.__wbg_ptr);
            return ret;
        }
        /**
         * @returns {Float32Array}
         */
        get uv() {
            const ret = wasm.meshresult_uv(this.__wbg_ptr);
            return ret;
        }
    }
    if (Symbol.dispose) MeshResult.prototype[Symbol.dispose] = MeshResult.prototype.free;
    exports.MeshResult = MeshResult;

    class World {
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            WorldFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_world_free(ptr, 0);
        }
        /**
         * @returns {number}
         */
        chunk_count() {
            const ret = wasm.world_chunk_count(this.__wbg_ptr);
            return ret >>> 0;
        }
        /**
         * Player edit: set voxel, persist the edit, dirty affected chunk(s).
         * @param {number} wx
         * @param {number} wy
         * @param {number} wz
         * @param {number} b
         * @returns {boolean}
         */
        edit(wx, wy, wz, b) {
            const ret = wasm.world_edit(this.__wbg_ptr, wx, wy, wz, b);
            return ret !== 0;
        }
        /**
         * Flat [lidx, block, ...] edit list for a chunk (worker gen input).
         * @param {number} cx
         * @param {number} cz
         * @returns {Uint32Array | undefined}
         */
        edits_flat(cx, cz) {
            const ret = wasm.world_edits_flat(this.__wbg_ptr, cx, cz);
            return ret;
        }
        /**
         * Finish a gen job: store the voxels, flag the chunk dirty, and dirty the
         * four neighbours (their border faces may have changed).
         * @param {number} cx
         * @param {number} cz
         * @param {number} tok
         * @param {Uint8Array | null} [data]
         */
        gen_done(cx, cz, tok, data) {
            wasm.world_gen_done(this.__wbg_ptr, cx, cz, tok, isLikeNone(data) ? 0 : addToExternrefTable0(data));
        }
        /**
         * @param {number} wx
         * @param {number} wy
         * @param {number} wz
         * @returns {number}
         */
        get(wx, wy, wz) {
            const ret = wasm.world_get(this.__wbg_ptr, wx, wy, wz);
            return ret;
        }
        /**
         * @param {number} cx
         * @param {number} cz
         * @returns {boolean}
         */
        has_voxels(cx, cz) {
            const ret = wasm.world_has_voxels(this.__wbg_ptr, cx, cz);
            return ret !== 0;
        }
        /**
         * @returns {number}
         */
        inflight() {
            const ret = wasm.world_inflight(this.__wbg_ptr);
            return ret;
        }
        /**
         * Mesh a chunk straight from the store (main-thread path / fallback).
         * @param {number} cx
         * @param {number} cz
         * @returns {MeshResult | undefined}
         */
        mesh_chunk(cx, cz) {
            const ret = wasm.world_mesh_chunk(this.__wbg_ptr, cx, cz);
            return ret === 0 ? undefined : MeshResult.__wrap(ret);
        }
        /**
         * @param {number} cx
         * @param {number} cz
         * @param {number} tok
         */
        mesh_done(cx, cz, tok) {
            wasm.world_mesh_done(this.__wbg_ptr, cx, cz, tok);
        }
        /**
         * May a queued mesh result for (cx,cz,tok) still be applied?
         * @param {number} cx
         * @param {number} cz
         * @param {number} tok
         * @returns {boolean}
         */
        mesh_valid(cx, cz, tok) {
            const ret = wasm.world_mesh_valid(this.__wbg_ptr, cx, cz, tok);
            return ret !== 0;
        }
        /**
         * @param {number} radius
         * @param {number} max_tasks
         */
        constructor(radius, max_tasks) {
            const ret = wasm.world_new(radius, max_tasks);
            this.__wbg_ptr = ret;
            WorldFinalization.register(this, this.__wbg_ptr, this);
            return this;
        }
        /**
         * Physics solidity: unloaded chunks are solid so the player can't fall
         * into not-yet-generated space.
         * @param {number} wx
         * @param {number} wy
         * @param {number} wz
         * @returns {boolean}
         */
        solid(wx, wy, wz) {
            const ret = wasm.world_solid(this.__wbg_ptr, wx, wy, wz);
            return ret !== 0;
        }
        /**
         * Per-frame scheduler. Returns a flat i32 list of jobs:
         * [tag, cx, cz, tok, ...] where tag is JOB_GEN / JOB_MESH / JOB_UNLOAD.
         * GEN/MESH jobs are already marked in-flight here; JS must finish them
         * via gen_done / mesh_done. UNLOAD jobs mean "drop render resources".
         * @param {number} px
         * @param {number} pz
         * @returns {Int32Array}
         */
        update(px, pz) {
            const ret = wasm.world_update(this.__wbg_ptr, px, pz);
            return ret;
        }
        /**
         * Owned copy of a chunk's voxel data (for transfer to a mesh worker).
         * @param {number} cx
         * @param {number} cz
         * @returns {Uint8Array | undefined}
         */
        voxels(cx, cz) {
            const ret = wasm.world_voxels(this.__wbg_ptr, cx, cz);
            return ret;
        }
    }
    if (Symbol.dispose) World.prototype[Symbol.dispose] = World.prototype.free;
    exports.World = World;

    /**
     * @param {number} cx
     * @param {number} cz
     * @param {Uint32Array | null} [edits]
     * @returns {Uint8Array}
     */
    function gen_chunk(cx, cz, edits) {
        const ret = wasm.gen_chunk(cx, cz, isLikeNone(edits) ? 0 : addToExternrefTable0(edits));
        return ret;
    }
    exports.gen_chunk = gen_chunk;

    /**
     * @param {number} cx
     * @param {number} cz
     * @param {Uint8Array} selfv
     * @param {Uint8Array | null} [px]
     * @param {Uint8Array | null} [nx]
     * @param {Uint8Array | null} [pz]
     * @param {Uint8Array | null} [nz]
     * @returns {MeshResult}
     */
    function mesh_chunk_raw(cx, cz, selfv, px, nx, pz, nz) {
        const ret = wasm.mesh_chunk_raw(cx, cz, selfv, isLikeNone(px) ? 0 : addToExternrefTable0(px), isLikeNone(nx) ? 0 : addToExternrefTable0(nx), isLikeNone(pz) ? 0 : addToExternrefTable0(pz), isLikeNone(nz) ? 0 : addToExternrefTable0(nz));
        return MeshResult.__wrap(ret);
    }
    exports.mesh_chunk_raw = mesh_chunk_raw;

    /**
     * @returns {any}
     */
    function world_consts() {
        const ret = wasm.world_consts();
        return ret;
    }
    exports.world_consts = world_consts;
    function __wbg_get_imports() {
        const import0 = {
            __proto__: null,
            __wbg___wbindgen_debug_string_4687d8d8c2017d52: function(arg0, arg1) {
                const ret = debugString(arg1);
                const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
                const len1 = WASM_VECTOR_LEN;
                getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
                getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
            },
            __wbg___wbindgen_throw_41e9ee4f547fc59a: function(arg0, arg1) {
                throw new Error(getStringFromWasm0(arg0, arg1));
            },
            __wbg_length_0acba72356589f9c: function(arg0) {
                const ret = arg0.length;
                return ret;
            },
            __wbg_length_511b1f84719d3462: function(arg0) {
                const ret = arg0.length;
                return ret;
            },
            __wbg_length_58572db4c38f3c3e: function(arg0) {
                const ret = arg0.length;
                return ret;
            },
            __wbg_length_7f3c00c40364105e: function(arg0) {
                const ret = arg0.length;
                return ret;
            },
            __wbg_new_617a8cdb8bb1130e: function() {
                const ret = new Object();
                return ret;
            },
            __wbg_new_ee2291f50781bf1d: function() {
                const ret = new Array();
                return ret;
            },
            __wbg_new_with_length_31d0d732d07f3195: function(arg0) {
                const ret = new Uint32Array(arg0 >>> 0);
                return ret;
            },
            __wbg_new_with_length_3da0ad195f6f63ba: function(arg0) {
                const ret = new Uint8Array(arg0 >>> 0);
                return ret;
            },
            __wbg_new_with_length_42910c27ec097fc3: function(arg0) {
                const ret = new Int32Array(arg0 >>> 0);
                return ret;
            },
            __wbg_new_with_length_cc0362bfe8499e5a: function(arg0) {
                const ret = new Float32Array(arg0 >>> 0);
                return ret;
            },
            __wbg_prototypesetcall_06eb15da165dee8f: function(arg0, arg1, arg2) {
                Uint32Array.prototype.set.call(getArrayU32FromWasm0(arg0, arg1), arg2);
            },
            __wbg_prototypesetcall_bc27214492979395: function(arg0, arg1, arg2) {
                Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
            },
            __wbg_push_2baf45db356cf468: function(arg0, arg1) {
                const ret = arg0.push(arg1);
                return ret;
            },
            __wbg_set_070bd465f1c195a4: function(arg0, arg1, arg2) {
                arg0.set(getArrayF32FromWasm0(arg1, arg2));
            },
            __wbg_set_145a351398b48c65: function() { return handleError(function (arg0, arg1, arg2) {
                const ret = Reflect.set(arg0, arg1, arg2);
                return ret;
            }, arguments); },
            __wbg_set_448fbc824992c3fd: function(arg0, arg1, arg2) {
                arg0.set(getArrayU32FromWasm0(arg1, arg2));
            },
            __wbg_set_575d3ddb70fe831d: function(arg0, arg1, arg2) {
                arg0.set(getArrayU8FromWasm0(arg1, arg2));
            },
            __wbg_set_cc01fb9eb2df162b: function(arg0, arg1, arg2) {
                arg0.set(getArrayI32FromWasm0(arg1, arg2));
            },
            __wbindgen_generic_0000000000000001: function(arg0) {
                // Cast intrinsic for `F64 -> Externref`.
                const ret = arg0;
                return ret;
            },
            __wbindgen_generic_0000000000000002: function(arg0, arg1) {
                // Cast intrinsic for `Ref(String) -> Externref`.
                const ret = getStringFromWasm0(arg0, arg1);
                return ret;
            },
            __wbindgen_init_externref_table: function() {
                const table = wasm.__wbindgen_externrefs;
                const offset = table.grow(4);
                table.set(0, undefined);
                table.set(offset + 0, undefined);
                table.set(offset + 1, null);
                table.set(offset + 2, true);
                table.set(offset + 3, false);
            },
        };
        return {
            __proto__: null,
            "./wc_bg.js": import0,
        };
    }

    const MeshResultFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_meshresult_free(ptr, 1));
    const WorldFinalization = (typeof FinalizationRegistry === 'undefined')
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(ptr => wasm.__wbg_world_free(ptr, 1));

    function addToExternrefTable0(obj) {
        const idx = wasm.__externref_table_alloc();
        wasm.__wbindgen_externrefs.set(idx, obj);
        return idx;
    }

    function debugString(val) {
        // primitive types
        const type = typeof val;
        if (type == 'number' || type == 'boolean' || val == null) {
            return  `${val}`;
        }
        if (type == 'string') {
            return `"${val}"`;
        }
        if (type == 'symbol') {
            const description = val.description;
            if (description == null) {
                return 'Symbol';
            } else {
                return `Symbol(${description})`;
            }
        }
        if (type == 'function') {
            const name = val.name;
            if (typeof name == 'string' && name.length > 0) {
                return `Function(${name})`;
            } else {
                return 'Function';
            }
        }
        // objects
        if (Array.isArray(val)) {
            const length = val.length;
            let debug = '[';
            if (length > 0) {
                debug += debugString(val[0]);
            }
            for(let i = 1; i < length; i++) {
                debug += ', ' + debugString(val[i]);
            }
            debug += ']';
            return debug;
        }
        // Test for built-in
        const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
        let className;
        if (builtInMatches && builtInMatches.length > 1) {
            className = builtInMatches[1];
        } else {
            // Failed to match the standard '[object ClassName]'
            return toString.call(val);
        }
        if (className == 'Object') {
            // we're a user defined class or Object
            // JSON.stringify avoids problems with cycles, and is generally much
            // easier than looping through ownProperties of `val`.
            try {
                return 'Object(' + JSON.stringify(val) + ')';
            } catch (_) {
                return 'Object';
            }
        }
        // errors
        if (val instanceof Error) {
            return `${val.name}: ${val.message}\n${val.stack}`;
        }
        // TODO we could test for more things here, like `Set`s and `Map`s.
        return className;
    }

    function getArrayF32FromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
    }

    function getArrayI32FromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
    }

    function getArrayU32FromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
    }

    function getArrayU8FromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
    }

    let cachedDataViewMemory0 = null;
    function getDataViewMemory0() {
        if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
            cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
        }
        return cachedDataViewMemory0;
    }

    let cachedFloat32ArrayMemory0 = null;
    function getFloat32ArrayMemory0() {
        if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
            cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
        }
        return cachedFloat32ArrayMemory0;
    }

    let cachedInt32ArrayMemory0 = null;
    function getInt32ArrayMemory0() {
        if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
            cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
        }
        return cachedInt32ArrayMemory0;
    }

    function getStringFromWasm0(ptr, len) {
        return decodeText(ptr >>> 0, len);
    }

    let cachedUint32ArrayMemory0 = null;
    function getUint32ArrayMemory0() {
        if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
            cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
        }
        return cachedUint32ArrayMemory0;
    }

    let cachedUint8ArrayMemory0 = null;
    function getUint8ArrayMemory0() {
        if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
            cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
        }
        return cachedUint8ArrayMemory0;
    }

    function handleError(f, args) {
        try {
            return f.apply(this, args);
        } catch (e) {
            const idx = addToExternrefTable0(e);
            wasm.__wbindgen_exn_store(idx);
        }
    }

    function isLikeNone(x) {
        return x === undefined || x === null;
    }

    function passStringToWasm0(arg, malloc, realloc) {
        if (realloc === undefined) {
            const buf = cachedTextEncoder.encode(arg);
            const ptr = malloc(buf.length, 1) >>> 0;
            getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
            WASM_VECTOR_LEN = buf.length;
            return ptr;
        }

        let len = arg.length;
        let ptr = malloc(len, 1) >>> 0;

        const mem = getUint8ArrayMemory0();

        let offset = 0;

        for (; offset < len; offset++) {
            const code = arg.charCodeAt(offset);
            if (code > 0x7F) break;
            mem[ptr + offset] = code;
        }
        if (offset !== len) {
            if (offset !== 0) {
                arg = arg.slice(offset);
            }
            ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
            const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
            const ret = cachedTextEncoder.encodeInto(arg, view);

            offset += ret.written;
            ptr = realloc(ptr, len, offset, 1) >>> 0;
        }

        WASM_VECTOR_LEN = offset;
        return ptr;
    }

    let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    function decodeText(ptr, len) {
        return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
    }

    const cachedTextEncoder = new TextEncoder();

    if (!('encodeInto' in cachedTextEncoder)) {
        cachedTextEncoder.encodeInto = function (arg, view) {
            const buf = cachedTextEncoder.encode(arg);
            view.set(buf);
            return {
                read: arg.length,
                written: buf.length
            };
        };
    }

    let WASM_VECTOR_LEN = 0;

    let wasmModule, wasmInstance, wasm;
    function __wbg_finalize_init(instance, module) {
        wasmInstance = instance;
        wasm = instance.exports;
        wasmModule = module;
        cachedDataViewMemory0 = null;
        cachedFloat32ArrayMemory0 = null;
        cachedInt32ArrayMemory0 = null;
        cachedUint32ArrayMemory0 = null;
        cachedUint8ArrayMemory0 = null;
        wasm.__wbindgen_start();
        return wasm;
    }

    async function __wbg_load(module, imports) {
        if (typeof Response === 'function' && module instanceof Response) {
            if (!module.ok) {
                throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
            }

            if (typeof WebAssembly.instantiateStreaming === 'function') {
                try {
                    return await WebAssembly.instantiateStreaming(module, imports);
                } catch (e) {
                    const validResponse = expectedResponseType(module.type);

                    if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                        console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                    } else { throw e; }
                }
            }

            const bytes = await module.arrayBuffer();
            return await WebAssembly.instantiate(bytes, imports);
        } else {
            const instance = await WebAssembly.instantiate(module, imports);

            if (instance instanceof WebAssembly.Instance) {
                return { instance, module };
            } else {
                return instance;
            }
        }

        function expectedResponseType(type) {
            switch (type) {
                case 'basic': case 'cors': case 'default': return true;
            }
            return false;
        }
    }

    function initSync(module) {
        if (wasm !== undefined) return wasm;


        if (module !== undefined) {
            if (Object.getPrototypeOf(module) === Object.prototype) {
                ({module} = module)
            } else {
                console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
            }
        }

        const imports = __wbg_get_imports();
        if (!(module instanceof WebAssembly.Module)) {
            module = new WebAssembly.Module(module);
        }
        const instance = new WebAssembly.Instance(module, imports);
        return __wbg_finalize_init(instance, module);
    }

    async function __wbg_init(module_or_path) {
        if (wasm !== undefined) return wasm;


        if (module_or_path !== undefined) {
            if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
                ({module_or_path} = module_or_path)
            } else {
                console.warn('using deprecated parameters for the initialization function; pass a single object instead')
            }
        }

        if (module_or_path === undefined && script_src !== undefined) {
            module_or_path = script_src.replace(/\.js$/, "_bg.wasm");
        }
        const imports = __wbg_get_imports();

        if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
            module_or_path = fetch(module_or_path);
        }

        const { instance, module } = await __wbg_load(await module_or_path, imports);

        return __wbg_finalize_init(instance, module);
    }

    return Object.assign(__wbg_init, { initSync }, exports);
})({ __proto__: null });
