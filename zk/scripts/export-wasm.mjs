import { copyFile } from 'fs/promises';

await copyFile('zk-build/memory_hash_js/memory_hash.wasm', 'zk-artifacts/memory_hash.wasm');

console.log('Exported memory_hash.wasm to zk-artifacts.');

