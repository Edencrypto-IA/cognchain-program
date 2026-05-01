import { mkdir } from 'fs/promises';

await mkdir('zk-artifacts', { recursive: true });
await mkdir('zk-build', { recursive: true });

console.log('Prepared zk-artifacts and zk-build directories.');

