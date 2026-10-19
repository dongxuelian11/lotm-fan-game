import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import * as current from './demoness-stage.mjs';

// Exact one-time policy handoff. All product/runtime bytes and the twenty
// completed actions remain unchanged. This does not execute action709.
const root = process.cwd(), oldDir = join(root, 'output/rebuild-0221/natural-v1');
const out = join(root, 'output/rebuild-0221/natural-v2');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const unpack = path => JSON.parse(gunzipSync(readFileSync(path)));
const evidence = path => { const bytes = readFileSync(path); return { bytes: bytes.length, sha256: sha(bytes) }; };
const inventory = () => readdirSync(oldDir).sort().map(file => ({ file, ...evidence(join(oldDir, file)) }));
assert(!existsSync(out), 'Never overwrite an existing continuation');
assert.equal(evidence(join(oldDir, 'checkpoint.json.gz')).sha256, '21c38d90e8721e94bab91080e760d0c5696d3126180483c7324b93f6847358a7');
const oldInventory = inventory(), freeze = read(join(oldDir, 'runtime-freeze.json'));
const { sha256: oldFreezeHash, ...oldPayload } = freeze;
assert.equal(oldFreezeHash, '0c93fd6545d8793bce0727a84b74fb02f150fd05e376d250cc95b91058b0eb18');
assert.equal(current.stateHash(oldPayload), oldFreezeHash);
const changed = new Map([
  ['scripts/play/demoness-stage.mjs', '28bfa3465ef8c8845e4ed5d5d72c8c7e07bab8a011a93987553ac6f3b6aaa396'],
  ['scripts/play/demoness-stage.test.mjs', '528ce1bc5065e8cc1496ee023d48f014ddefd60cad958cc354152c6edd033d7a'],
]);
const files = freeze.files.map(item => {
  const actual = evidence(join(root, item.file));
  if (changed.has(item.file)) assert.equal(actual.sha256, changed.get(item.file));
  else assert.deepEqual(actual, { bytes: item.bytes, sha256: item.sha256 }, `Unexpected runtime drift: ${item.file}`);
  return { file: item.file, ...actual };
});
for (const item of [freeze.source, freeze.history]) assert.deepEqual(evidence(join(root, item.path)), { bytes: item.bytes, sha256: item.sha256 });
const nextPayload = { ...oldPayload, files }, nextFreeze = { ...nextPayload, sha256: current.stateHash(nextPayload) };
const cp = unpack(join(oldDir, 'checkpoint.json.gz'));
assert.equal(current.stateHash(cp.payload), cp.sha256);
assert.equal(cp.payload.commandCount, 708); assert.equal(cp.payload.newCount, 20);
assert.equal(cp.payload.pending, null); assert.equal(cp.payload.terminal, null);
assert.equal(cp.payload.freezeSha256, oldFreezeHash);
const previous = await import(pathToFileURL(join(oldDir, 'producer.mjs')).href);
const runtime = await import(pathToFileURL(join(root, 'dist/domain/slice/index.js')).href);
const migration = await import(pathToFileURL(join(root, 'dist/domain/slice/migration.js')).href);
const source = unpack(join(oldDir, 'source-snapshot.json.gz'));
const history = unpack(join(oldDir, 'original854-natural.json.gz'));
assert.equal(current.stateHash(source.final), current.SOURCE_STATE_SHA256);
const provenance = current.verifySourceProvenance(source, history);
const rows = readFileSync(join(oldDir, 'commands.jsonl'), 'utf8').trimEnd().split('\n').map(JSON.parse);
current.verifyCommandChain(rows, { prefixCommands: provenance.prefixCommands, initial: cp.payload.initial });
const anchor = (state, view) => ({ revision: state.revision, privateStateSha256: current.stateHash(state),
  publicStateSha256: current.stateHash(view), random: structuredClone(state.random), randomSha256: current.stateHash(state.random) });
let state = migration.migrateSliceState(source.final), lastIntent = null;
runtime.assertValidSliceState(state);
assert.deepEqual(anchor(state, runtime.projectSliceState(state)), cp.payload.initial);
for (const row of rows.slice(688)) {
  const view = runtime.projectSliceState(state);
  assert.deepEqual(anchor(state, view), row.before);
  assert.deepEqual(previous.chooseAction(view, lastIntent), { intent: row.intent, publicAction: row.publicAction });
  assert.deepEqual(current.chooseAction(view, lastIntent), previous.chooseAction(view, lastIntent));
  state = runtime.applySliceIntent(state, row.intent);
  const after = runtime.projectSliceState(state); current.auditPublic(after, state);
  assert.deepEqual(anchor(state, after), row.after);
  lastIntent = row.intent;
  console.log(JSON.stringify({ verified: row.commandCount, privatePublicRandomEqual: true }));
}
assert.deepEqual(state, cp.payload.state);
const view = runtime.projectSliceState(state), beforeDecision = previous.chooseAction(view, lastIntent), nextDecision = current.chooseAction(view, lastIntent);
assert.equal(beforeDecision.stop, 'PUBLIC_ACTION_BLOCKED');
assert.equal(nextDecision.intent.type, 'APOCALYPSE_DEMONESS');
assert.equal(nextDecision.intent.command.type, 'STABILIZE_PROMOTION');
assert.equal(nextDecision.publicAction.enabled, true);
assert.equal(current.stateHash(state), cp.payload.anchor.privateStateSha256);
const proof = { format: 'NEW221_EXACT708_PRODUCER_ORDER_HANDOFF', sourceDirectory: 'natural-v1',
  commandCount: 708, actualNewCommandsVerified: 20, historical688Replayed: false,
  fullFinalPrivateStateEqual: true, everyNewPrivatePublicRandomAnchorEqual: true,
  originalFiles: oldInventory, oldFreezeSha256: oldFreezeHash, newFreezeSha256: nextFreeze.sha256,
  changedFiles: [...changed].map(([file, sha256]) => ({ file, sha256 })),
  originalCheckpointSha256: cp.sha256, nextPublicAction: nextDecision.intent,
  reason: 'Prepared same-bottle promotion controls precede the unrelated physical-scene guard; product rules unchanged.' };
const payload = { ...cp.payload, freezeSha256: nextFreeze.sha256, predecessorSha256: cp.sha256 };
assert.deepEqual({ ...payload, freezeSha256: cp.payload.freezeSha256, predecessorSha256: cp.payload.predecessorSha256 }, cp.payload);
mkdirSync(out);
for (const { file } of oldInventory) if (!['checkpoint.json.gz', 'runtime-freeze.json', 'producer.mjs', 'producer-tests.mjs', 'summary.json'].includes(file)) copyFileSync(join(oldDir, file), join(out, file));
writeFileSync(join(out, 'runtime-freeze.json'), JSON.stringify(nextFreeze), { flag: 'wx' });
writeFileSync(join(out, 'checkpoint.json.gz'), gzipSync(JSON.stringify({ payload, sha256: current.stateHash(payload) })), { flag: 'wx' });
for (const [target, src] of [['producer.mjs', 'scripts/play/demoness-stage.mjs'], ['producer-tests.mjs', 'scripts/play/demoness-stage.test.mjs']]) copyFileSync(join(root, src), join(out, target));
writeFileSync(join(out, 'summary.json'), JSON.stringify({ ...read(join(oldDir, 'summary.json')), stage: 'MANUAL_PAUSE',
  reason: proof.reason, runtimeFreezeSha256: nextFreeze.sha256, continuation708: proof }), { flag: 'wx' });
assert.deepEqual(inventory(), oldInventory);
writeFileSync(join(root, 'output/rebuild-0221/continuation708-proof.json'), JSON.stringify(proof, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ stage: 'EXACT708_HANDOFF_COMPLETE_NO_ACTIONS', out, nextFreezeSha256: nextFreeze.sha256, nextPublicAction: nextDecision.intent }));
