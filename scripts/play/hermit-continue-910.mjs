import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import * as current from './hermit-stage.mjs';
// One exact audit-only handoff. The durable pending911 is preserved, not executed.
const root = process.cwd(), oldDir = join(root, 'output/rebuild-0222/natural-current');
const out = join(root, 'output/rebuild-0222/natural-v2');
const sha = b => createHash('sha256').update(b).digest('hex');
const evidence = p => { const b = readFileSync(p); return { bytes: b.length, sha256: sha(b) }; };
const unpack = p => JSON.parse(gunzipSync(readFileSync(p)));
const inventory = () => readdirSync(oldDir).sort().map(file => ({ file, ...evidence(join(oldDir, file)) }));
assert(!existsSync(out));
assert.equal(evidence(join(oldDir, 'checkpoint.json.gz')).sha256, '2de9da2f8664988c7a68c1beb5eee0511a91664714b90d7203f3590d90551859');
const originalFiles = inventory(), freeze = JSON.parse(readFileSync(join(oldDir, 'runtime-freeze.json')));
const { sha256: oldHash, ...oldPayload } = freeze;
assert.equal(oldHash, '60605b89ab7c40a838e2ec109b3fe971985232f026a9169747739c61f594e9c9');
assert.equal(current.stateHash(oldPayload), oldHash);
const changed = new Map([
  ['scripts/play/hermit-stage.mjs', '424679f4b3595e2cdc763b441e61307b63d2a1e1b8e63439d8e02d25218f7c71'],
  ['scripts/play/hermit-stage.test.mjs', '310e2ad2812f7085d4f9a9978ffc21731268b1f162fe41f3980ba7bb5170445a'],
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
assert.equal(cp.payload.commandCount, 910); assert.equal(cp.payload.newCount, 83);
assert.equal(cp.payload.pending.commandCount, 911);
assert.deepEqual(cp.payload.pending.intent, { type: 'HERMIT', command: { type: 'BUY_SEAL' } });
assert.equal(cp.payload.terminal, null); assert.equal(cp.payload.freezeSha256, oldHash);
const source = unpack(join(oldDir, 'source-snapshot.json.gz'));
const history = unpack(join(oldDir, 'original831-natural.json.gz'));
const provenance = current.verifySourceProvenance(source, history);
const rows = readFileSync(join(oldDir, 'commands.jsonl'), 'utf8').trimEnd().split('\n').map(JSON.parse);
const chain = current.verifyCommandChain(rows, { prefixCommands: provenance.prefixCommands, initial: cp.payload.initial });
assert.deepEqual(chain.anchor, cp.payload.anchor); assert.equal(chain.commandCount, 910);
assert.equal(current.stateHash(cp.payload.state), cp.payload.anchor.privateStateSha256);
assert.deepEqual(cp.payload.state.random, cp.payload.anchor.random);
const runtime = await import(pathToFileURL(join(root, 'dist/domain/slice/index.js')).href);
runtime.assertValidSliceState(cp.payload.state);
const view = runtime.projectSliceState(cp.payload.state);
assert.equal(current.stateHash(view), cp.payload.anchor.publicStateSha256);
const previous = await import(pathToFileURL(join(oldDir, 'producer.mjs')).href);
assert.deepEqual(previous.chooseAction(view), current.chooseAction(view));
assert.deepEqual(current.chooseAction(view), { intent: cp.payload.pending.intent, publicAction: cp.payload.pending.publicAction });
current.auditPublic(view, cp.payload.state);
const payload = { ...cp.payload, freezeSha256: nextFreeze.sha256, predecessorSha256: cp.sha256 };
assert.deepEqual({ ...payload, freezeSha256: cp.payload.freezeSha256, predecessorSha256: cp.payload.predecessorSha256 }, cp.payload);
const proof = { format: 'NEW222_EXACT910_AUDIT_ONLY_HANDOFF', commandCount: 910, completedNewCommands: 83,
  commandChainChecked: true, historical827Replayed: false, newActionsReplayedHere: false,
  productRuntimeAndOriginalInputsByteEqual: true, completePrivatePublicRandomEqual: true,
  pendingIntentPreserved: cp.payload.pending, oldFreezeSha256: oldHash, newFreezeSha256: nextFreeze.sha256,
  originalCheckpointSha256: cp.sha256, originalFiles, changedFiles: [...changed].map(([file, sha256]) => ({ file, sha256 })),
  reason: 'OWNER is the actual physical custody role, not a private source identity; explicit private source.actorId remains forbidden.' };
mkdirSync(out);
for (const { file } of originalFiles) if (!['checkpoint.json.gz','runtime-freeze.json','producer.mjs','producer-tests.mjs','summary.json'].includes(file)) copyFileSync(join(oldDir,file),join(out,file));
writeFileSync(join(out,'runtime-freeze.json'),JSON.stringify(nextFreeze),{flag:'wx'});
writeFileSync(join(out,'checkpoint.json.gz'),gzipSync(JSON.stringify({payload,sha256:current.stateHash(payload)}),{level:6}),{flag:'wx'});
for (const [target,src] of [['producer.mjs','scripts/play/hermit-stage.mjs'],['producer-tests.mjs','scripts/play/hermit-stage.test.mjs']]) copyFileSync(join(root,src),join(out,target));
writeFileSync(join(out,'summary.json'),JSON.stringify({stage:'PENDING911_AUDIT_HANDOFF',commandCount:910,newCount:83,runtimeFreezeSha256:nextFreeze.sha256,continuation910:proof}),{flag:'wx'});
assert.deepEqual(inventory(),originalFiles);
writeFileSync(join(root,'output/rebuild-0222/continuation910-proof.json'),JSON.stringify(proof,null,2),{flag:'wx'});
console.log(JSON.stringify({stage:'EXACT910_HANDOFF_COMPLETE_NO_ACTIONS',out,newFreezeSha256:nextFreeze.sha256}));
