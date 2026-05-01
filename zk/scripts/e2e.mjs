const BASE_URL = process.env.ZK_E2E_BASE_URL || 'http://localhost:3000';
const MODEL = process.env.ZK_E2E_MODEL || 'gpt';

function endpoint(path) {
  return `${BASE_URL}${path}`;
}

async function post(path, body) {
  const response = await fetch(endpoint(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
}

async function get(path) {
  const response = await fetch(endpoint(path));
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const stamp = new Date().toISOString();
  const content = `CONGCHAIN ZK E2E memory ${stamp}`;

  console.log(`Running ZK E2E against ${BASE_URL}`);

  const save = await post('/api/save-memory', {
    content,
    model: MODEL,
    generateZkProof: true,
  });
  assert(save.ok, `save-memory failed (${save.status}): ${JSON.stringify(save.json)}`);
  assert(typeof save.json.hash === 'string', 'save-memory did not return hash');
  assert(save.json.zk, 'save-memory did not return zk bundle (check ZK_MVP_ENABLED)');

  const verifyFromSave = await post('/api/zk/verify', { zk: save.json.zk });
  assert(
    verifyFromSave.ok,
    `zk/verify (save bundle) failed (${verifyFromSave.status}): ${JSON.stringify(verifyFromSave.json)}`
  );
  assert(verifyFromSave.json.valid === true, 'zk/verify returned invalid for save-memory bundle');

  const proofByHash = await get(`/api/memory/${save.json.hash}/proof`);
  assert(
    proofByHash.ok,
    `memory proof endpoint failed (${proofByHash.status}): ${JSON.stringify(proofByHash.json)}`
  );
  assert(proofByHash.json.zk, 'memory proof endpoint did not return zk bundle');

  const verifyFromProof = await post('/api/zk/verify', { zk: proofByHash.json.zk });
  assert(
    verifyFromProof.ok,
    `zk/verify (proof endpoint bundle) failed (${verifyFromProof.status}): ${JSON.stringify(verifyFromProof.json)}`
  );
  assert(verifyFromProof.json.valid === true, 'zk/verify returned invalid for proof endpoint bundle');

  console.log('ZK E2E passed.');
  console.log(`Hash: ${save.json.hash}`);
  console.log(`Proof mode: ${proofByHash.json.zk?.proof?.mode || save.json.zk?.proof?.mode || 'unknown'}`);
}

main().catch((error) => {
  console.error(`ZK E2E failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

