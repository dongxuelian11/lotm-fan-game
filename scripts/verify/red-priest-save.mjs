import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, realpathSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Import-safe verifier: no producer/game import, SQLite, replay or writes here.
// One sequential NEW-tail replay per invocation; original795 is never replayed.
// SQLite covers unique selected real transitions, not every historical command.
// A completed index is durable before DB cleanup. Unknown interrupted cases
// are retained and stop, never reset or claimed passed. No replay checkpoints.
const SELF = fileURLToPath(import.meta.url), FORMAT = 'RED_PRIEST209_SELECTED_SQLITE_AUDIT_V1';
const SOURCE = 'tests/fixtures/conqueror-v01870/natural.json', PREFIX = 795;
const SOURCE_SHA = '469a6ac77052f92ac0dbd8e6ea39164592de6b4c8d8ea0405b080c1a015f7973';
const PREFIX_SHA = '88211e592c4714058c3e8b45eab02fa0f0ae73b35c2526288503329ec1d52f2e';
const PRODUCER = 'scripts/play/red-priest-stage.mjs';
const INPUTS = ['checkpoint.json', 'commands.ndjson', 'freeze.json', 'natural.json', 'summary.json'];
// Only the four reviewed living836, living915, living941 and living974 observations may continue.
const ORIGINAL_FREEZE = '2d833ab92f7ca3ca5ffc7ada05d8f0b62f5538b9d73c3533c2a5cac8256e43f0';
const ORIGINAL_INPUTS = {
  'checkpoint.json': { bytes: 1994679, sha256: '42548cdae14c82d40c066524d4e560d57597259b2914f949b99f572881fc24fd' },
  'commands.ndjson': { bytes: 37130, sha256: '7b4ca7fff4db7e24d7a882705d87e5c91138332f60427cf0dc37ef5ea7705247' },
  'freeze.json': { bytes: 549730, sha256: 'bc155d14878f26516e7c27e4248174b70c50c24b3713f1ee3db20688606ee11b' },
  'natural.json': { bytes: 3999700, sha256: '299852d1d271e33531db5456a60797c81cd43ca21a51df6ea72c64870a3ce988' },
  'summary.json': { bytes: 8904, sha256: 'ef0e44a4b747e608f91788d226cd95f4a1f75434680f85294499c0f22c513607' },
};
const AUTHORITY_INPUTS = {
  'checkpoint.json': { bytes: 2827692, sha256: '34b88f24f49b8977e8445d6b4b79c2213ca622e598054980b7ada3c663780beb' },
  'commands.ndjson': { bytes: 107858, sha256: '9c7895aeba9c4e210fb1c4842a6aee29758a4972e3bf1a4aabcc6e2f7b055f55' },
  'freeze.json': { bytes: 549730, sha256: '2f4779ed6fe48f8a1b5f11bfae7378160bba6eeff29eb95e136860230f0850a1' },
  'natural.json': { bytes: 4760983, sha256: 'de517f04ce6eec4e1c33f0b9678c478867d556d0923100708cd6fffc3caa4da1' },
  'summary.json': { bytes: 8957, sha256: '0fbe1a19830227cb35fbcfa0bd8db3ad987253cbe541bd4fb106535712cb7dca' },
};
const LOGISTICS_INPUTS = {
  'checkpoint.json': { bytes: 3151328, sha256: '287f4290b38649d7d90a1c87a9ee38c7e73dda40b5f2ca2c1621f873d286ee4f' },
  'commands.ndjson': { bytes: 130732, sha256: '4c9c8b2952d881c87c3595edc7d43b29e8a032fe18fe3b997475bf8d726521fe' },
  'freeze.json': { bytes: 549730, sha256: '842f0c30841178918294ebba9ebed4f76d907a4fc8c33fe2ed8b4e77ba047935' },
  'natural.json': { bytes: 5061123, sha256: '990b93bddb1374f35da9d5de2761eeb6867379d469f8e2edc8ae94ffbac0b71e' },
  'summary.json': { bytes: 9038, sha256: '2971902254edec100b6f0fe08595d675a69a9f17d6c523ffe65f351d72731db3' },
};
const RESTORATION_INPUTS = {
  'checkpoint.json': { bytes: 3553388, sha256: 'ea1d6d03ef8f129ea5c0d14300cd3dbe88a4a20c4d506b729443e54242089ec6' },
  'commands.ndjson': { bytes: 160040, sha256: 'f3c77f0a870584e2284cdf058b30d5a1171857611cfc3152a386f83dd3b895a7' },
  'freeze.json': { bytes: 549730, sha256: 'ef2df8da7cbfdb298ff2dfa5f13db5d8f8ad82f3a3e8017cbdac90a5a1e7eb59' },
  'natural.json': { bytes: 5433797, sha256: 'f8017e64be594512cce88c7c2c2ff0e25a001fa4943e15a1880ea9f034e1d7e3' },
  'summary.json': { bytes: 9030, sha256: '2a981d763de851b399f26064330eb2b8fe1c4aa4a13c3124ab706fe971ae311a' },
};
const RESTORATION_SHA = 'c5fa12707cde98bba0a775475d274c369f68267fe5d2991e5a04acaabb3ad201';
const PUBLIC_974_OLD = '89b59e830d4ca6bdfee64c6edc990fa8ea032b0ae553c313880679ef5ee7f3c4', PUBLIC_974_NEW = '2b45e65b382e3aaf98e945347ea752294cdc3a26899f867272388f96d5c3b205';
const TRANSITION_SHA = '3dbc170abff8c7310dd384677469a19d9f9e217a0653dfe8d6a78a18587b4b66';
const LOGISTICS_FILES = ['src/domain/red-priest/campaign.ts', 'src/domain/red-priest/index.ts', 'dist/domain/red-priest/campaign.js', 'dist/domain/red-priest/campaign.js.map', 'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map'];
const RESTORATION_FILES = ['src/domain/red-priest/campaign.ts', 'src/domain/red-priest/engine.ts', 'src/domain/red-priest/index.ts', 'src/domain/red-priest/types.ts', 'src/renderer/RedPriestPanel.tsx', 'src/renderer/SliceApp.tsx', 'dist/domain/red-priest/campaign.js', 'dist/domain/red-priest/campaign.js.map', 'dist/domain/red-priest/engine.js', 'dist/domain/red-priest/engine.js.map', 'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map'];
const PUBLIC_941_OLD = '86f1b384408032f77881fd95db91a22c36079cdd45fce3c57901047e4cda09f0', PUBLIC_941_NEW = 'c87ae3523ad27e645baf837a845579f7a223eb9b2c0c428562e0b0c6be9db5db';
const CHECKS = ['strict-before-put-and-reopen', 'beforeWrite-after-real-application', 'rollback-private-rng-receipts-backup-selection-timestamps-unchanged', 'rollback-reopen', 'same-envelope-retry-exact-private-public-rng', 'commit-reopen', 'duplicate-idempotent', 'final-reopen-status'];
const digest = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const sha = value => createHash('sha256').update(value).digest('hex');
const compactHash = value => sha(JSON.stringify(value));
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const stateHash = value => sha(stable(value));
const json = path => JSON.parse(readFileSync(path, 'utf8'));
function regular(path) { assert.equal(realpathSync(path), path, 'No symlinks'); assert(lstatSync(path).isFile()); return path; }
function directory(path) { const p = resolve(path); assert.equal(realpathSync(p), p, 'No directory symlinks'); assert(lstatSync(p).isDirectory()); return p; }
function evidence(path) {
  regular(path); const before = lstatSync(path, { bigint: true }), h = createHash('sha256'), fd = openSync(path, 'r'), b = Buffer.allocUnsafe(65536); let bytes = 0;
  try { for (;;) { const n = readSync(fd, b, 0, b.length, null); if (!n) break; bytes += n; h.update(b.subarray(0, n)); } } finally { closeSync(fd); }
  const after = lstatSync(path, { bigint: true }); for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(after[key], before[key]);
  assert.equal(BigInt(bytes), after.size); return { bytes, sha256: h.digest('hex') };
}
function sync(path) { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } }
function atomic(path, value) {
  // An existing .next means an unreviewed interruption, never permission to erase it.
  writeFileSync(`${path}.next`, JSON.stringify(value), { flag: 'wx' }); sync(`${path}.next`); renameSync(`${path}.next`, path); sync(dirname(path));
}
function contains(root, target) { const r = relative(root, target); return r === '' || r !== '..' && !r.startsWith(`..${sep}`) && !r.startsWith(sep); }
export function assertFreeze(captured, current) {
  for (const f of [captured, current]) {
    assert.deepEqual(Object.keys(f).sort(), ['files', 'sha256']); assert(Array.isArray(f.files) && digest(f.sha256)); const names = new Set();
    for (const row of f.files) {
      assert.deepEqual(Object.keys(row).sort(), ['bytes', 'file', 'sha256']); assert(typeof row.file === 'string' && row.file && !names.has(row.file));
      names.add(row.file); assert(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && digest(row.sha256));
    }
    assert.equal(compactHash(f.files), f.sha256);
  }
  assert.deepEqual(current, captured, 'Capture/runtime/source/producer freeze must match without exceptions');
}
export function assertProducerOnlyFreezeChange(before, after) {
  assertFreeze(before, before); assertFreeze(after, after);
  assert.deepEqual(before.files.map(r => r.file), after.files.map(r => r.file), 'No added, removed or reordered frozen input');
  const changes = before.files.filter((row, i) => row.bytes !== after.files[i].bytes || row.sha256 !== after.files[i].sha256);
  assert.deepEqual(changes.map(r => r.file), ['$natural-producer'], 'Only the specifically approved producer continuation changes');
}
export function assertContinuationPolicy(before, after) {
  assert.equal(before.attemptsPerMaterialOperation, 6); assert.equal(after.attemptsPerMaterialOperation, 12);
  assert.deepEqual(after, { ...before, attemptsPerMaterialOperation: 12 }, 'Only the explicit cumulative material limit 6 to 12 changes');
}
export function assertAuthorityContinuationPolicy(before, after) {
  assert.equal(before.authorityAttemptsPerPolity, 5); assert.equal(after.authorityAttemptsPerPolity, 12);
  assert.deepEqual(after, { ...before, authorityAttemptsPerPolity: 12 }, 'Only the explicit cumulative authority limit 5 to 12 changes');
}
export function assertLogisticsPolicy(before, after) {
  assert.equal(before.logisticsRecovery, undefined); assert.deepEqual(after, { ...before, logisticsRecovery: true });
}
export function assertRestorationPolicy(before, after) {
  for (const key of ['fieldArmyRecovery', 'finiteSupplyRecovery', 'postwarFootReturn', 'verifiedPersonnelExit']) assert.equal(before[key], undefined);
  assert.deepEqual(after, { ...before, fieldArmyRecovery: true, finiteSupplyRecovery: true, postwarFootReturn: true, verifiedPersonnelExit: '现有人员已经不足以完成剩余目标。继续交战不能补回损失，可以真实停战或保护撤离。' });
}
export function restoreBeforeLogistics(view) {
  const result = structuredClone(view), added = result.actions.filter(a => a.command.type === 'CAMPAIGN' && a.command.command.type === 'RETURN_TO_HEADQUARTERS');
  assert(added.length <= 1); if (added.length) { const a = added[0]; assert.deepEqual(a.command, { type: 'CAMPAIGN', command: { type: 'RETURN_TO_HEADQUARTERS' } });
    assert.equal(a.label, '沿原路回总部整备'); assert.equal(typeof a.enabled, 'boolean'); assert.equal(result.actions.at(-1), a); result.actions.pop(); }
  return result;
}
export function assertLogisticsReplayRows(proof, rows) {
  assert.equal(proof.replay.commands, 146); assert.equal(proof.replay.first, 796); assert.equal(proof.replay.last, 941); assert.equal(proof.replay.allPrivateAndRngEqual, true);
  assert.equal(proof.replay.publicDifference, 'Only appended RETURN_TO_HEADQUARTERS action'); assert.equal(proof.replay.addedProjectionChecks, 18);
  assert.equal(rows.length, 146); assert.equal(proof.replay.rows.length, 146);
  for (const [i, check] of proof.replay.rows.entries()) { const row = rows[i]; assert.equal(check.commandCount, 796 + i); assert.equal(row.commandCount, check.commandCount);
    assert.equal(check.stateSha256, row.afterStateSha256); assert.deepEqual(check.random, row.randomAfter); assert.equal(check.capturedPublicSha256, row.publicAfterSha256); assert(digest(check.publicSha256)); }
  assert.equal(proof.replay.rows.at(-1).publicSha256, proof.continuedPublicSha256);
}
export function restoreBeforeRestoration(view) {
  const result = structuredClone(view), added = [], orders = [], polities = { loen: '鲁恩', intis: '因蒂斯', feneport: '费内波特' };
  for (const [i, action] of result.actions.entries()) {
    const c = action.command, type = c.type === 'CAMPAIGN' ? c.command.type : c.type; let order;
    if (type === 'REST_FIELD_ARMIES') { assert.deepEqual(c, { type: 'CAMPAIGN', command: { type } }); assert.equal(action.label, '让总部原军休整'); order = 0; }
    else if (type === 'RETURN_ON_FOOT') { assert.deepEqual(c, { type }); assert.equal(action.label, '停战后沿原路步行返总部'); order = 1; }
    else if (type === 'SUPPLY_ONLY') { const id = c.command.polityId; assert(Object.hasOwn(polities, id)); assert.deepEqual(c, { type: 'CAMPAIGN', command: { type, polityId: id } }); assert.equal(action.label, `运输${polities[id]}原库存补给`); order = 2 + Object.keys(polities).indexOf(id); }
    else { assert.equal(added.length, 0, 'Only an appended recovery action suffix may be removed'); continue; }
    assert.equal(typeof action.enabled, 'boolean'); added.push(i); orders.push(order);
  }
  assert.deepEqual(orders, [...new Set(orders)].sort()); if (added.length) result.actions.splice(added[0]);
  const readiness = result.sections.filter(s => s.id === 'campaign-readiness'); assert(readiness.length <= 1);
  if (readiness.length) { const section = readiness[0]; assert.deepEqual(Object.keys(section).sort(), ['id', 'lines', 'title']); assert.equal(section.title, '胜算与有限兵员'); assert(Array.isArray(section.lines) && section.lines.every(line => typeof line === 'string'));
    result.sections = result.sections.filter(s => s.id !== 'campaign-readiness'); }
  return result;
}
export function assertRestorationReplayRows(proof, rows) {
  assert.equal(proof.replay.commands, 179); assert.equal(proof.replay.first, 796); assert.equal(proof.replay.last, 974); assert.equal(proof.replay.allPrivateAndRngEqual, true);
  assert.equal(proof.replay.publicDifference, 'Only appended recovery actions and campaign-readiness section; historical RETURN_TO_HEADQUARTERS projection preserved');
  assert.equal(proof.replay.addedProjectionChecks, 382, 'Diagnostic transformation-call count, never boundary coverage');
  assert.equal(rows.length, 179); assert.equal(proof.replay.rows.length, 179);
  for (const [i, check] of proof.replay.rows.entries()) { const row = rows[i]; assert.equal(check.commandCount, 796 + i); assert.equal(row.commandCount, check.commandCount);
    assert.equal(check.stateSha256, row.afterStateSha256); assert.deepEqual(check.random, row.randomAfter); assert.equal(check.capturedPublicSha256, row.publicAfterSha256); assert(digest(check.publicSha256)); }
  assert.equal(proof.replay.rows.at(-1).publicSha256, proof.continuedPublicSha256);
  assert.equal(proof.replay.rows.at(-1).priorRuntimePublicSha256, proof.originalPublicSha256);
  for (const [i, check] of proof.replay.rows.entries()) { assert(digest(check.priorRuntimePublicSha256)); if (check.commandCount > 941) assert.equal(check.priorRuntimePublicSha256, rows[i].publicAfterSha256); }
}
export function assertPublicChain(previous, row, lineage) {
  const seams = lineage?.original.commandCount === 974 ? [lineage.inheritedRuntimeTransition, lineage.runtimeTransition] : lineage?.original.commandCount === 941 ? [lineage.runtimeTransition] : [];
  const seam = seams.find(s => row.commandCount === s.commandCount + 1);
  if (seam) { const count = seam.commandCount; assert([941, 974].includes(count));
    assert.equal(seam.proofSha256, count === 941 ? TRANSITION_SHA : RESTORATION_SHA);
    assert.equal(seam.originalPublicSha256, count === 941 ? PUBLIC_941_OLD : PUBLIC_974_OLD); assert.equal(seam.continuedPublicSha256, count === 941 ? PUBLIC_941_NEW : PUBLIC_974_NEW);
    assert.equal(previous.publicAfterSha256, seam.originalPublicSha256); assert.equal(row.publicBeforeSha256, seam.continuedPublicSha256);
  } else assert.equal(row.publicBeforeSha256, previous.publicAfterSha256);
}
export const assertLogisticsFreeze = (before, after, changes) => assertRuntimeFreeze(before, after, changes, LOGISTICS_FILES);
export const assertRestorationFreeze = (before, after, changes) => assertRuntimeFreeze(before, after, changes, RESTORATION_FILES);
function assertRuntimeFreeze(before, after, changes, paths) {
  assertFreeze(before, before); assertFreeze(after, after); assert.deepEqual(changes.map(c => c.file), paths);
  assert.deepEqual(before.files.map(r => r.file), after.files.map(r => r.file)); const changed = [];
  for (const [i, row] of before.files.entries()) { const next = after.files[i], change = changes.find(c => c.file === row.file);
    if (row.bytes !== next.bytes || row.sha256 !== next.sha256) changed.push(row.file);
    if (change) { assert.deepEqual({ bytes: row.bytes, sha256: row.sha256 }, change.before); assert.deepEqual({ bytes: next.bytes, sha256: next.sha256 }, change.after); } }
  assert.deepEqual(changed.sort(), ['$natural-producer', ...paths].sort(), 'Only exact approved runtime files and producer may change');
}
export function assertOriginalLedgerPrefix(current, original) {
  assert(Buffer.isBuffer(current) && Buffer.isBuffer(original)); assert(original.length && original.at(-1) === 10);
  assert(current.subarray(0, original.length).equals(original), 'Every original completed row must remain the exact byte prefix');
}
function inspectFreeze(repo, producer = PRODUCER) {
  const files = [], walk = file => {
    const path = join(repo, file), stat = lstatSync(path); assert(!stat.isSymbolicLink());
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(join(file, child));
    else files.push({ file: file.split(sep).join('/'), ...evidence(path) });
  };
  for (const file of ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation']) walk(file);
  files.push({ file: '$natural-producer', ...evidence(join(repo, producer)) }, { file: SOURCE, ...evidence(join(repo, SOURCE)) });
  return { sha256: compactHash(files), files };
}
export function assertResumeManifest(saved, current) { assert.deepEqual(saved, current, 'Resume requires exact inputs, selection, source, producer, runtime and verifier bytes'); }
export function selectBoundaries(rows, journal, continuationSeams = []) {
  assert(rows.length > 0, 'No actual new transition to verify');
  const events = new Map(journal.map(e => [e.revision, e])); assert.equal(events.size, journal.length);
  const seen = new Set(), selected = new Map(), coverage = {};
  const add = (row, reason) => {
    coverage[reason] = (coverage[reason] ?? 0) + 1; if (seen.has(reason)) return; seen.add(reason);
    const item = selected.get(row.commandCount) ?? { commandCount: row.commandCount, names: [] };
    item.names.push(reason); selected.set(row.commandCount, item);
  };
  for (const row of rows) {
    assert.equal(row.intent.type, 'RED_PRIEST'); const c = row.intent.command, e = events.get(row.revision);
    if (c.type === 'LEARN_GUIDANCE') assert.equal(e, undefined);
    else { assert(e, 'Every non-guidance command has its real journal event'); assert.deepEqual(e.command, c); }
    add(row, `command:${c.type}${c.command ? `:${c.command.type}` : ''}`);
    if (c.type === 'CAMPAIGN' && ['BATTLE', 'PREPARED_BATTLE'].includes(c.command.type)) {
      const receipt = e.campaignHost?.receipt; assert.equal(receipt?.kind, 'BATTLE');
      assert(['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'SEVERE_FAILURE'].includes(receipt.result));
      add(row, `battle:${receipt.result.includes('SUCCESS') ? 'success' : 'failure'}`);
    }
    if (c.type === 'CAMPAIGN' && c.command.type === 'SEEK_ARMISTICE') {
      const receipt = e.campaignHost?.receipt; assert.equal(receipt?.kind, 'ARMISTICE');
      assert(['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'SEVERE_FAILURE'].includes(receipt.result));
      add(row, `armistice:${receipt.result.includes('SUCCESS') ? 'accepted' : 'refused'}`);
    }
    if (c.type === 'CAMPAIGN' && c.command.type === 'SELECT_BATTLE_PLAN') add(row, `plan:${c.command.stance}:${c.command.extraSupplies ? 'extra-supplies' : 'ordinary-supplies'}`);
    if (c.type === 'CONSUME') {
      const receipt = e.materialReceipt?.consumption; assert(receipt && ['SUCCESS', 'FAILURE'].includes(receipt.outcome));
      assert.equal(receipt.compoundId, c.compoundId); add(row, `consume:${receipt.outcome}`);
    }
  }
  assert.deepEqual(continuationSeams, [...new Set(continuationSeams)].sort((a, b) => a - b));
  for (const seam of continuationSeams) {
    assert(Number.isSafeInteger(seam));
    for (const count of [seam, seam + 1]) { const row = rows.find(row => row.commandCount === count); assert(row, 'Both actual continuation boundaries are required'); add(row, `continuation:${seam}:${count === seam ? 'last-original' : 'first-new'}`); }
  }
  add(rows.at(-1), 'final-actual-transition');
  return { selected: [...selected.values()].sort((a, b) => a.commandCount - b.commandCount), coverage };
}
function readCapture(root, repo, freeze) {
  const old = json(regular(join(repo, SOURCE))); assert.equal(evidence(join(repo, SOURCE)).sha256, SOURCE_SHA);
  assert.equal(old.commands.length, PREFIX); assert.equal(compactHash(old.commands), PREFIX_SHA);
  assert.equal(old.seed, 'hunter-rebuild-first'); assert.equal(old.final.runId, 'hunter-rebuild-natural');
  assert.equal(old.final.revision, 796); assert.equal(old.final.status, 'ACTIVE'); assert.equal(old.final.schemaVersion, 184);
  assert.deepEqual(old.final.random, { seed: old.seed, cursor: 376 });
  const capture = json(join(root, 'natural.json')), wrapped = json(join(root, 'checkpoint.json')), cp = wrapped.payload, report = json(join(root, 'summary.json'));
  assert.equal(wrapped.sha256, stateHash(cp), 'Complete durable checkpoint checksum');
  assert.equal(cp.format, 'RED_PRIEST_DURABLE_PUBLIC_ACTION_BOUNDARY_V1'); assert.equal(cp.source, SOURCE);
  assert.equal(cp.sourceSha256, SOURCE_SHA); assert.equal(cp.prefixSha256, PREFIX_SHA); assert.equal(cp.freezeSha256, freeze.sha256);
  assert.equal(cp.pending, null); assert(cp.terminal, 'Paused or interrupted producer captures are not terminal evidence');
  assert.deepEqual(cp.terminal, { stage: capture.stage, reason: capture.reason }); assert.equal(capture.pendingIntent, null);
  assert.deepEqual(capture.provenance, { kind: 'EXACT_ORIGINAL_LIVING_PUBLIC_RED_PRIEST_CONTINUATION', source: SOURCE,
    sourceSha256: SOURCE_SHA, prefixCommandsSha256: PREFIX_SHA, runtimeFreezeSha256: freeze.sha256, historicalPrefixReplayedByThisProducer: false,
    historicalPrefixRetainedExactly: true, originalCaptureMayNotChange: true, privateAudit: true, seedChanged: false, selectedFromEnabledPublicActionsOnly: true,
    ...(capture.lineage ? { continuation: { proofFile: capture.lineage.proofFile, proofSha256: capture.lineage.proofSha256, originalCommandCount: capture.lineage.original.commandCount } } : {}) });
  assert.deepEqual(cp.lineage, capture.lineage);
  for (const key of ['creation', 'seed', 'initial']) assert.deepEqual(capture[key], old[key]);
  assert.equal(capture.prefixCount, PREFIX); assert.deepEqual(capture.prefixFinal, old.final); assert.deepEqual(capture.commands.slice(0, PREFIX), old.commands);
  assert.deepEqual(capture.commands.slice(PREFIX), cp.commands); assert.deepEqual(capture.policy, cp.policyDefinition);
  assert.equal(capture.commands.length, cp.commandCount); assert.equal(cp.commands.length, cp.rows.length); assert(digest(cp.initialStateSha256));
  const text = readFileSync(join(root, 'commands.ndjson'), 'utf8'); assert(text.endsWith('\n'));
  const rows = text.slice(0, -1).split('\n').map(line => { assert(line); return JSON.parse(line); }); assert.deepEqual(rows, cp.rows);
  assert.equal(stateHash(capture.final), cp.finalStateSha256); assert.equal(stateHash(cp.state), cp.finalStateSha256);
  assert.equal(capture.final.revision, old.final.revision + rows.length); assert.equal(report.paused, false); assert.equal(report.strictFinalValidation, true);
  assert.equal(report.stage, capture.stage); assert.equal(report.reason, capture.reason); assert.equal(report.originalCommands, PREFIX);
  assert.equal(report.commands, cp.commandCount); assert.equal(report.newCommands, rows.length);
  for (const [i, row] of rows.entries()) {
    assert.equal(row.commandCount, PREFIX + i + 1); assert.equal(row.revision, old.final.revision + i + 1);
    assert.deepEqual(row.intent, cp.commands[i]); assert.equal(compactHash(row.intent), row.commandSha256);
    for (const key of ['beforeStateSha256', 'afterStateSha256', 'publicBeforeSha256', 'publicAfterSha256']) assert(digest(row[key]));
    if (i) { assert.equal(row.beforeStateSha256, rows[i - 1].afterStateSha256); assertPublicChain(rows[i - 1], row, cp.lineage); assert.deepEqual(row.randomBefore, rows[i - 1].randomAfter); }
    assert.equal(row.randomBefore.seed, old.seed); assert.equal(row.randomAfter.seed, old.seed);
    assert(Number.isSafeInteger(row.randomBefore.cursor) && row.randomBefore.cursor >= 376); assert(row.randomAfter.cursor >= row.randomBefore.cursor && Number.isSafeInteger(row.randomAfter.cursor));
  }
  assert.equal(rows[0].beforeStateSha256, cp.initialStateSha256); assert.deepEqual(rows[0].randomBefore, old.final.random);
  assert.equal(rows.at(-1).afterStateSha256, cp.finalStateSha256); assert.equal(rows.at(-1).publicAfterSha256, cp.publicStateSha256);
  assert.deepEqual(rows.at(-1).randomAfter, capture.final.random);
  return { old, capture, cp, rows, ...selectBoundaries(rows, capture.final.redPriest.journal) };
}
export function assertContinuationOrder(count, requiredOriginal = null) {
  assert([836, 915, 941, 974].includes(count), 'Only exact836,915,941,974 observations are approved'); if (requiredOriginal !== null) assert.equal(count, requiredOriginal);
}
function readContinuation(root, freeze, data, requiredOriginal = null) {
  if (!data.capture.lineage) { assert(!existsSync(join(root, 'prior-proof')) && !existsSync(join(root, 'prior-observation'))); return null; }
  const count = data.capture.lineage.original.commandCount; assertContinuationOrder(count, requiredOriginal);
  assert.deepEqual(readdirSync(directory(join(root, 'prior-proof'))).sort(), ['commands.ndjson', 'lineage.json', 'producer.mjs', ...([941, 974].includes(count) ? ['runtime-before', 'runtime-transition.json'] : [])].sort());
  const original = count === 974 ? { format: 'RED_PRIEST_APPROVED_EXACT_974_FIELD_ARMY_CONTINUATION_V1', commandCount: 974,
    checkpointPayloadSha256: '020a3b8e3cc38e071b01b20c94a74bf60ce240019787091e3a624443b2e08e8e', policyStateSha256: 'a6d727a990575227544231fe1bbd77770cfdba89f36dcffb550225b13ed7311b',
    terminal: { stage: 'FINITE_CAMPAIGN_REVIEW_REQUIRED', reason: 'No enabled forward route, objective or finite reinforcement remains' },
    stateSha256: '47b56cc7d857dd18d157628b55fb6de56fcb7d5b4c4097b34aa0a42df1a0d73a', publicSha256: PUBLIC_974_OLD,
    freezeSha256: 'bc9ab45457e5173f3b72adf6585c19d233f6b79b1be5f165981dd44e8b90d5f9',
    producer: { file: '$natural-producer', bytes: 65014, sha256: 'e6fc50ac046b9634870989968558cd21efcbbb7154caf86b15f54fcb963f445f' },
    originalFiles: Object.entries(RESTORATION_INPUTS).map(([file, value]) => ({ file, ...value })) } : count === 941 ? { format: 'RED_PRIEST_APPROVED_EXACT_941_LOGISTICS_CONTINUATION_V1', commandCount: 941,
    checkpointPayloadSha256: 'cf1675b04822d635b46931f1d5ff9b84c85b5279e080b670070f0cbb989834dd', policyStateSha256: 'd84ddb3e627b7633e6bad677fce5422b0d4a1a604a8029e728da1931ee7e0f7a',
    terminal: { stage: 'FINITE_PUBLIC_NO_PROGRESS', reason: 'Finite recovery limit reached: Recover actual resources for 在灰脊北关执行会战' },
    stateSha256: '5e92f155fbeadf38dd22722831489bf7176865858b58d3254e1025725bfe1751', publicSha256: PUBLIC_941_OLD,
    freezeSha256: '4fd9123b33f55edd661b3155b4cd645c46f2d8ee5f7c5b69c76bdb777e73cb62',
    producer: { file: '$natural-producer', bytes: 55887, sha256: '4811bb5c3b801c1b45a582a825094f4fb3ee9a43191baa4a5be4dc4279f47f65' },
    originalFiles: Object.entries(LOGISTICS_INPUTS).map(([file, value]) => ({ file, ...value })) } : count === 915 ? { format: 'RED_PRIEST_APPROVED_EXACT_915_CONTINUATION_V1', commandCount: 915,
    checkpointPayloadSha256: 'cf768632559c637fb2bafc94385eb6e3b141311bc218850776077e010280dea5',
    policyStateSha256: '53fe8c9290ad29304ce04e894cd6ac5f7c8b837079c74ebb393856a53f3d7dd1',
    terminal: { stage: 'FINITE_AUTHORITY_ATTEMPTS', reason: 'Actual coalition permission was not obtained within the finite public policy' },
    stateSha256: '040db02f43169b0e913c77c1adb39fff31293a2947f9d90c8fea06b61b7ecd4a', publicSha256: '4b9777b46c624336024dfa8472a677757fd5dedba887dbab588f296c9fd6cb70',
    freezeSha256: 'be967f07d9a912627b5c21fb1746247b4d2ba3797ee1dce532108748e1eeb11e',
    producer: { file: '$natural-producer', bytes: 52076, sha256: 'fa5afd4e7c6b6263d452d3aa59c34a43252d80b9269f851c7b1e7081f986ae02' },
    originalFiles: Object.entries(AUTHORITY_INPUTS).map(([file, value]) => ({ file, ...value })) }
    : { format: 'RED_PRIEST_APPROVED_EXACT_836_CONTINUATION_V1', commandCount: 836,
    checkpointPayloadSha256: '1e12bab7df3acdae9717e68f84cf2b4e2a95433437470ef5363a0a11c7478180',
    policyStateSha256: 'afc9f285472bfe3f0ef205cce4e3f188e9c77c82b6fe51cbca7f2e42f98f5844',
    terminal: { stage: 'FINITE_MATERIAL_ATTEMPTS', reason: 'Finite attempts exhausted for 净化已核验原残余' },
    stateSha256: 'ce66e5141b397cc89ef843a225d43f9cd5e04895fabdcdf9ecf520d58defd0a7',
    publicSha256: '19c8038ab331415db672c9efce5335f7f840f03a9d50771847cd09d4c7473189', freezeSha256: ORIGINAL_FREEZE,
    producer: { file: '$natural-producer', bytes: 41116, sha256: '1624ea7cd4cf7cfff738755a1d19a1b3bde2b041420828656be5df9aee79b7a3' },
    originalFiles: Object.entries(ORIGINAL_INPUTS).map(([file, value]) => ({ file, ...value })) };
  const pins = count === 974 ? RESTORATION_INPUTS : count === 941 ? LOGISTICS_INPUTS : count === 915 ? AUTHORITY_INPUTS : ORIGINAL_INPUTS, priorCount = count - PREFIX;
  const transitionSha = count === 974 ? RESTORATION_SHA : TRANSITION_SHA, publicAfter = count === 974 ? PUBLIC_974_NEW : PUBLIC_941_NEW;
  const changedPaths = count === 974 ? RESTORATION_FILES : LOGISTICS_FILES, cursor = count === 974 ? 426 : count === 941 ? 425 : count === 915 ? 420 : 392;
  let transition = null;
  if ([941, 974].includes(count)) { const path = regular(join(root, 'prior-proof/runtime-transition.json')); assert(digest(transitionSha), 'Reviewed runtime proof pin is required'); assert.equal(evidence(path).sha256, transitionSha); transition = json(path);
    assert.equal(transition.format, count === 974 ? 'RED_PRIEST974_FIELD_ARMY_TRANSITION_V1' : 'RED_PRIEST941_LOGISTICS_TRANSITION_V1'); assert.equal(transition.commandCount, count); assert.equal(transition.originalFreezeSha256, original.freezeSha256);
    assert.equal(transition.checkpointSha256, pins['checkpoint.json'].sha256); assert.equal(transition.stateSha256, original.stateSha256); assert.equal(transition.originalPublicSha256, original.publicSha256); assert.equal(transition.continuedPublicSha256, publicAfter);
    assert.deepEqual(transition.random, { seed: data.old.seed, cursor }); (count === 974 ? assertRestorationReplayRows : assertLogisticsReplayRows)(transition, data.rows.slice(0, priorCount));
    for (const change of transition.changedFiles) assert.deepEqual(evidence(join(root, 'prior-proof/runtime-before', change.file)), change.before); }
  // All evidence is portable and relative: preserve and independently read the
  // original five exact files alongside the small producer/ledger/control proof.
  const priorFreeze = { files: freeze.files.map(row => row.file === '$natural-producer' ? original.producer : transition?.changedFiles.some(c => c.file === row.file) ? { file: row.file, ...transition.changedFiles.find(c => c.file === row.file).before } : row), sha256: original.freezeSha256 };
  if (transition) (count === 974 ? assertRestorationFreeze : assertLogisticsFreeze)(priorFreeze, freeze, transition.changedFiles); else assertProducerOnlyFreezeChange(priorFreeze, freeze);
  const originalRoot = directory(join(root, 'prior-observation')); assert.deepEqual(readdirSync(originalRoot).sort(), [...INPUTS, ...(count > 836 ? ['prior-observation', 'prior-proof'] : [])].sort());
  for (const [file, expected] of Object.entries(pins)) assert.deepEqual(evidence(join(originalRoot, file)), expected, 'All five original raw inputs must match');
  assertFreeze(json(join(originalRoot, 'freeze.json')), priorFreeze); const prior = readCapture(originalRoot, process.cwd(), priorFreeze);
  assert.equal(json(join(originalRoot, 'checkpoint.json')).sha256, original.checkpointPayloadSha256);
  assert.equal(prior.cp.commandCount, count); assert.equal(prior.cp.state.status, 'ACTIVE'); assert.equal(prior.cp.state.revision, count + 1);
  assert.equal(prior.cp.finalStateSha256, original.stateSha256); assert.equal(prior.cp.publicStateSha256, original.publicSha256);
  assert.equal(data.cp.initialStateSha256, prior.cp.initialStateSha256);
  const nested = count > 836 ? readContinuation(originalRoot, priorFreeze, prior, count === 974 ? 941 : count === 941 ? 915 : 836) : null;
  if (count > 836) assert(nested); else assert.equal(prior.cp.lineage, undefined);
  if (count === 974) for (const [i, check] of nested.transition.replay.rows.entries()) assert.equal(transition.replay.rows[i].priorRuntimePublicSha256, check.publicSha256, '974 proof must preserve every941 runtime public hash');
  assert.deepEqual(evidence(join(root, 'prior-proof/producer.mjs')), { bytes: original.producer.bytes, sha256: original.producer.sha256 });
  assert.deepEqual(evidence(join(root, 'prior-proof/commands.ndjson')), pins['commands.ndjson']);
  const ledger = readFileSync(join(root, 'prior-proof/commands.ndjson')), priorRows = ledger.toString('utf8').trimEnd().split('\n').map(JSON.parse);
  assert.equal(priorRows.length, priorCount); const priorCommands = priorRows.map(row => row.intent), proof = json(regular(join(root, 'prior-proof/lineage.json')));
  assert.equal(stateHash(proof.priorPolicyState), original.policyStateSha256);
  assert.equal(stateHash(proof.previousPolicy), count === 974 ? 'ece2bc84ff8dc4ad9d5ee8692bb56298bf98318db77ecd7c98df2968319c879a' : count === 941 ? 'd1395f8c9f91623c4ea973a432a858cfcfb00a2bc220f107b7473d30cd4e6630' : count === 915 ? '5843cd6921d77d5a9d9d232a181af65075c72a13890508a46ddd4d24672e8ba0' : 'f3f35c3bee487ec29257f4d775311f1c9f79437071a01cd16a226764a0000640');
  assert.deepEqual(proof.priorPolicyState, prior.cp.policy); assert.deepEqual(proof.priorTerminal, prior.cp.terminal);
  assert.deepEqual(prior.cp.rows, priorRows); assert.deepEqual(prior.cp.commands, priorCommands);
  const expected = { original, newFreezeSha256: freeze.sha256, originalFilesDirectory: 'prior-observation', onlyAllowedFreezeChange: ['$natural-producer', ...(transition ? changedPaths : [])],
    producerFile: 'prior-proof/producer.mjs', ledgerFile: 'prior-proof/commands.ndjson', priorCommandsSha256: compactHash(priorCommands), priorRowsSha256: compactHash(priorRows),
    priorPolicyState: proof.priorPolicyState, priorTerminal: original.terminal, previousPolicy: proof.previousPolicy, continuedPolicy: data.cp.policyDefinition, ...(transition ? { runtimeTransition: { proofFile: 'prior-proof/runtime-transition.json', proofSha256: transitionSha, commandCount: count, originalPublicSha256: original.publicSha256, continuedPublicSha256: publicAfter, runtimeBeforeDirectory: 'prior-proof/runtime-before' } } : {}), ...(count === 974 ? { inheritedRuntimeTransition: prior.cp.lineage.runtimeTransition } : {}) };
  assert.deepEqual(proof, expected, 'Only the four exact approved observation proofs are accepted');
  (count === 974 ? assertRestorationPolicy : count === 941 ? assertLogisticsPolicy : count === 915 ? assertAuthorityContinuationPolicy : assertContinuationPolicy)(proof.previousPolicy, proof.continuedPolicy);
  const proofSha256 = evidence(join(root, 'prior-proof/lineage.json')).sha256; assert.equal(proofSha256, compactHash(proof));
  assert.deepEqual(data.capture.lineage, { ...proof, proofFile: 'prior-proof/lineage.json', proofSha256 });
  assertOriginalLedgerPrefix(readFileSync(join(root, 'commands.ndjson')), ledger);
  assert.deepEqual(data.cp.rows.slice(0, priorCount), priorRows); assert.deepEqual(data.cp.commands.slice(0, priorCount), priorCommands);
  const boundary = priorRows.at(-1); assert.equal(boundary.afterStateSha256, original.stateSha256); assert.equal(boundary.publicAfterSha256, original.publicSha256);
  assert.deepEqual(boundary.randomAfter, { seed: data.old.seed, cursor }); assert(data.rows.length > priorCount, 'Continuation must contain an actual new completed action');
  const next = data.rows[priorCount]; assert.equal(next.beforeStateSha256, original.stateSha256); assert.equal(next.publicBeforeSha256, transition ? publicAfter : original.publicSha256); assert.deepEqual(next.randomBefore, boundary.randomAfter);
  const attempts = {}; for (const row of data.rows) { const key = JSON.stringify(row.intent.command); attempts[key] = (attempts[key] ?? 0) + 1; }
  assert.deepEqual(data.cp.policy.attempts, attempts, 'Original cumulative attempt counters cannot reset');
  return { lineage: data.capture.lineage, nested, transition, originalCompletedRows: priorCount, productRuntimeSourceUnchanged: transition === null,
    evidenceScope: 'ALL_FIVE_BUNDLED_ORIGINAL_RAW_FILES_AND_PRODUCER_AND_LEDGER_VERIFIED_EXACT; EXACT_EACH_LAYER_FREEZE_WITH_ONLY_EXPLICIT_PINNED_CHANGES' };
}
function lock(out, manifestSha256, approvedPid) {
  const path = join(out, 'audit.lock.json');
  if (existsSync(path)) {
    const prior = json(regular(path)); assert.equal(prior.manifestSha256, manifestSha256);
    assert.equal(prior.pid, approvedPid, 'Stale lock requires main/operator approval with --remove-stale-lock-pid EXACT_PID');
    assert(Number.isSafeInteger(prior.pid) && prior.pid > 0); let dead = false;
    try { process.kill(prior.pid, 0); } catch (e) { if (e.code === 'ESRCH') dead = true; else throw e; }
    assert(dead, 'Never take over a live or uncertain owner'); rmSync(path);
  } else assert.equal(approvedPid, undefined, 'No stale lock exists for the approved PID');
  const owner = { manifestSha256, pid: process.pid }; writeFileSync(path, JSON.stringify(owner), { flag: 'wx' }); sync(path); sync(out);
  return () => { assert.deepEqual(json(path), owner); rmSync(path); sync(out); };
}
function dbFiles(work) {
  if (!existsSync(work)) return {}; const files = {};
  for (const name of readdirSync(directory(work)).sort()) {
    assert(['case.sqlite', 'case.sqlite.bak', 'case.sqlite.sealed'].includes(name), `Unknown SQLite artifact retained: ${name}`);
    files[name] = evidence(join(work, name));
  }
  return files;
}
function cleanCase(work, result) {
  if (!existsSync(work)) return;
  for (const [name, found] of Object.entries(dbFiles(work))) { assert.deepEqual(found, result.databaseFiles[name], 'Cleanup requires exact completed evidence'); rmSync(join(work, name)); }
  rmdirSync(work); sync(dirname(work));
}
function databaseRows(DatabaseSync, path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const result = {};
    for (const [key, sql] of Object.entries({ runs: 'SELECT id,current_json,backup_json,terminal,updated_at FROM slice_runs ORDER BY id', receipts: 'SELECT id,fingerprint,receipt_json FROM slice_receipts ORDER BY id', meta: 'SELECT key,value FROM slice_meta ORDER BY key' })) {
      const rows = db.prepare(sql).all(); result[key] = { count: rows.length, sha256: compactHash(rows) };
    }
    assert.equal(Object.values(db.prepare('PRAGMA quick_check').get())[0], 'ok'); return result;
  } finally { db.close(); }
}
function checkSqlite(runtime, DatabaseSync, work, transition, before, after, intent, publicBefore, publicAfter, phase, authoredAfter) {
  const started = performance.now(), path = join(work, 'case.sqlite'); assert(!existsSync(work)); mkdirSync(work);
  const envelope = { intentId: `red-priest209:${transition.commandCount}`, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const now = '2026-10-17T00:00:01.000Z', initialTime = '2026-10-17T00:00:00.000Z';
  const receipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision, newRevision: after.revision, committedAt: now, replayed: false, state: publicAfter };
  let app, inject = false, injected = 0;
  const exact = (expected, time, committed) => {
    const saved = app.repository.get(expected.runId); assert.equal(stateHash(saved.state), stateHash(expected));
    assert.deepEqual(saved.state.random, expected.random); assert.equal(saved.updatedAt, time); assert.equal(app.repository.activeRun(), expected.runId);
    assert.deepEqual(app.repository.receipt(envelope.intentId), committed ? { fingerprint: stable(envelope), receipt } : null);
  };
  const open = () => new runtime.SqliteSliceStore(path, { now: () => now, beforeWrite: () => {
    if (inject) { exact(after, now, true); injected++; throw Error('Injected beforeWrite after actual private state and receipt, before COMMIT'); }
  } });
  const close = () => { app?.close(); app = undefined; };
  const rows = () => databaseRows(DatabaseSync, path);
  const reopened = expected => { const boot = app.getBootstrap(); assert.equal(boot.ok, true); assert.deepEqual(boot.value.activeState, expected); };
  try {
    phase('PUT_BEFORE'); app = open(); assert.equal(before.status, 'ACTIVE');
    app.repository.transaction(() => { app.repository.put({ state: before, updatedAt: initialTime }); app.repository.selectRun(before.runId); });
    close(); app = open(); exact(before, initialTime, false); reopened(publicBefore); const initialRows = rows(), initialFiles = dbFiles(work);
    assert.deepEqual(Object.fromEntries(Object.entries(initialRows).map(([k, v]) => [k, v.count])), { runs: 1, receipts: 0, meta: 1 });
    phase('INJECT_BEFORE_WRITE'); inject = true; const failed = app.submitIntent(envelope); inject = false;
    assert.equal(failed.ok, false); assert.equal(failed.error.code, 'SAVE_FAILED'); assert.equal(injected, 1);
    exact(before, initialTime, false); assert.deepEqual(rows(), initialRows); assert.deepEqual(dbFiles(work), initialFiles);
    close(); app = open(); exact(before, initialTime, false); assert.deepEqual(rows(), initialRows);
    phase('RETRY_COMMIT_OUTCOME_UNKNOWN_UNTIL_VERIFIED'); const committed = app.submitIntent(envelope);
    assert.equal(committed.ok, true); assert.deepEqual(committed.value, receipt); exact(after, now, true);
    const committedRows = rows(); assert.equal(committedRows.receipts.count, 1);
    phase('COMMITTED_CHECK_REOPEN_AND_DUPLICATE'); close(); app = open(); exact(after, now, true); reopened(publicAfter); assert.deepEqual(rows(), committedRows);
    const duplicate = app.submitIntent(envelope); assert.equal(duplicate.ok, true); assert.deepEqual(duplicate.value, { ...receipt, replayed: true });
    exact(after, now, true); assert.deepEqual(rows(), committedRows);
    if (after.status === 'DEAD') {
      assert.deepEqual(json(`${path}.sealed`), [after.runId]); assert.equal(publicAfter.canAct, false);
      const blocked = app.submitIntent({ ...envelope, intentId: `${envelope.intentId}:archived`, expectedRevision: after.revision, payload: { type: 'RED_PRIEST', command: { type: 'REST' } } });
      assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.equal(app.repository.receipt(`${envelope.intentId}:archived`), null);
    } else assert.equal(existsSync(`${path}.sealed`), false);
    close(); app = open(); exact(after, now, true); assert.deepEqual(rows(), committedRows); close();
    return { ...transition, beforeStateSha256: stateHash(before), stateSha256: stateHash(after), publicStateSha256: stateHash(publicAfter), authoredPublicChapterSha256: stateHash(authoredAfter), playerPublicChapterSha256: stateHash(publicAfter.redPriest), random: after.random,
      revision: after.revision, status: after.status, checks: CHECKS, terminalCheck: after.status === 'DEAD' ? 'ACTUAL_DEAD_SEALED_ARCHIVED' : 'ACTUAL_LIVING_UNSEALED',
      databaseRows: committedRows, databaseFiles: dbFiles(work), elapsedMilliseconds: Math.round(performance.now() - started) };
  } finally { close(); }
}
function runtimeBeforeFiles(root, restoration) {
  const layout = { '': ['dist', 'src'], src: restoration ? ['domain', 'renderer'] : ['domain'], ...(restoration ? { 'src/renderer': ['RedPriestPanel.tsx', 'SliceApp.tsx'] } : {}), 'src/domain': ['red-priest'], 'src/domain/red-priest': restoration ? ['campaign.ts', 'engine.ts', 'index.ts', 'types.ts'] : ['campaign.ts', 'index.ts'],
    dist: ['domain'], 'dist/domain': ['red-priest'], 'dist/domain/red-priest': restoration ? ['campaign.js', 'campaign.js.map', 'engine.js', 'engine.js.map', 'index.js', 'index.js.map'] : ['campaign.js', 'campaign.js.map', 'index.js', 'index.js.map'] };
  for (const [dir, names] of Object.entries(layout)) assert.deepEqual(readdirSync(directory(join(root, dir))).sort(), names);
  const files = restoration ? RESTORATION_FILES : LOGISTICS_FILES; for (const file of files) regular(join(root, file)); return files;
}
function captureInputNames(root, prefix = '', depth = 0) {
  assert(depth <= 4, 'Only the four approved nested observations are supported'); const names = readdirSync(directory(join(root, prefix))).sort();
  assert(INPUTS.every(file => names.includes(file))); const files = [];
  for (const name of names) {
    const file = prefix ? `${prefix}/${name}` : name;
    if (name === 'prior-observation') files.push(...captureInputNames(root, file, depth + 1));
    else if (name === 'prior-proof') { const extra = existsSync(join(root, file, 'runtime-transition.json')); const count = json(join(root, prefix, 'checkpoint.json')).payload.lineage.original.commandCount; if (extra) assert([941, 974].includes(count), 'Only exact941 and974 own runtime transitions');
      assert.deepEqual(readdirSync(directory(join(root, file))).sort(), ['commands.ndjson', 'lineage.json', 'producer.mjs', ...(extra ? ['runtime-before', 'runtime-transition.json'] : [])].sort());
      for (const child of ['commands.ndjson', 'lineage.json', 'producer.mjs', ...(extra ? ['runtime-transition.json'] : [])]) files.push(`${file}/${child}`);
      if (extra) files.push(...runtimeBeforeFiles(join(root, file, 'runtime-before'), count === 974).map(child => `${file}/runtime-before/${child}`)); }
    else { assert(INPUTS.includes(name) || name === 'error.json', 'Unknown capture artifact'); regular(join(root, file)); files.push(file); }
  }
  return files;
}
export function assertPlanningReplayRows(proof, rows, restoration) {
  assert.equal(proof.replay.commands, 188); assert.equal(proof.replay.first, 796); assert.equal(proof.replay.last, 983);
  assert.equal(proof.replay.allPrivateAndRngEqual, true); assert.equal(proof.replay.allExistingPublicFieldsEqual, true);
  assert.deepEqual(proof.replay.allowedPublicChanges, ['APPENDED_ENABLE_PLANNING_CRISIS_ACTION']);
  assert.equal(rows.length, 188); assert.equal(proof.replay.rows.length, 188); assert.equal(restoration.replay.rows.length, 179);
  let priorPublic;
  for (const [i, check] of proof.replay.rows.entries()) {
    const row = rows[i], expectedAfter = i < 179 ? restoration.replay.rows[i].publicSha256 : row.publicAfterSha256;
    assert.equal(check.commandCount, 796 + i); assert.equal(row.commandCount, check.commandCount);
    assert.equal(check.beforeStateSha256, row.beforeStateSha256); assert.equal(check.stateSha256, row.afterStateSha256);
    assert.deepEqual(check.randomBefore, row.randomBefore); assert.deepEqual(check.random, row.randomAfter);
    assert.equal(check.capturedPublicBeforeSha256, row.publicBeforeSha256); assert.equal(check.capturedPublicSha256, row.publicAfterSha256);
    assert.equal(check.priorRuntimePublicBeforeSha256, priorPublic ?? row.publicBeforeSha256); assert.equal(check.priorRuntimePublicSha256, expectedAfter);
    assert(digest(check.publicBeforeSha256) && digest(check.publicSha256));
    if (i) assert.equal(check.publicBeforeSha256, proof.replay.rows[i - 1].publicSha256);
    assert.equal(check.privateAndRngEqual, true); assert.equal(check.allExistingPublicFieldsEqual, true); priorPublic = expectedAfter;
  }
}

const PLANNED_ROOT_SHA = '2ab728663f4ce0096a94e49279a5feadda378f64629dd4ec6ccff785db60c68b';
const PLANNED_RECONSTRUCTION_SHA = '398f3854fc323bc106f58b0133cf702cce1a9b234bca850ccc416a21570611c5';
const ORIGINAL983_MANIFEST_SHA = '24d971395d08ca7b031d51d79c17a75681ccf7e3fe78a076f79b84f917acf909';
const ORIGINAL983_FREEZE = 'd6fffde98a45d09615a74b8daded5cb41071eee1f26a74789d54660ca8ba8993';
const PLANNED_PRODUCER = 'scripts/play/red-priest-planned-stage.mjs';
const STABILITY_PRODUCER = 'scripts/play/red-priest-stable-continue.mjs';
const STABILITY_FIRST_PRODUCER = 'scripts/play/red-priest-stability-first-branch.mjs';
const PLANNING_EQUIVALENCE_SHA = '9f64e510ace5f5f484ad2869a8bc616c668231ac345383695740a4edd065a3c3';
const STORY_EQUIVALENCE_SHA = '81ff3aca0bbbfe1850ed7f79fd852c3f68bc9bf8cc062af64abf7363885c93c9';
const FINAL_UI_EQUIVALENCE_SHA = '36fee3fa8ff9d1edc229572fc0ea225c92c546b80dc84eccd154d50158282e04'; // Reviewed completed133 final UI proof.
const FINAL_UI_PUBLIC_CHANGES = ['EPILOGUE_ROOT_STORY_ACTUAL_PATIENTS_AND_REPORT', 'APPENDED_S1_HEADQUARTERS_ORIGINAL_GARRISON_TRAVEL_ACTION'];
const STORY_CHANGED_FILES = ['src/domain/red-priest/index.ts', 'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map'];
const STORY_PUBLIC_CHANGES = ['EPILOGUE_ROOT_STORY_ACTUAL_PATIENTS_AND_REPORT'];
const STABILITY_EQUIVALENCE_SHA = 'f7ae783e6592d8fe1d4c5fc41c2555b271c4ed2a3860140bee88b77073328dff';
const STABILITY_PRIOR_FREEZE = 'f0b74f904c2bdc58838d013daf1a9669462582af04d412c7d0e0d35308edac4a';
const STABILITY_PUBLIC_CHANGES = ['APPENDED_STABILIZE_PROMOTION_PREPARED_COMPOUND_ACTIONS', 'APPENDED_PROMOTION_STABILITY_PREPARED_COMPOUND_SECTION'];
// Exact additive stability source and generated runtime allowlist.
const STABILITY_CHANGED_FILES = [
  'src/domain/red-priest/types.ts', 'src/domain/red-priest/content.ts', 'src/domain/red-priest/engine.ts',
  'src/domain/red-priest/epilogue.ts', 'src/domain/red-priest/index.ts', 'src/renderer/RedPriestPanel.tsx',
  'dist/domain/red-priest/types.js', 'dist/domain/red-priest/types.js.map',
  'dist/domain/red-priest/content.js', 'dist/domain/red-priest/content.js.map',
  'dist/domain/red-priest/engine.js', 'dist/domain/red-priest/engine.js.map',
  'dist/domain/red-priest/epilogue.js', 'dist/domain/red-priest/epilogue.js.map',
  'dist/domain/red-priest/index.js', 'dist/domain/red-priest/index.js.map',
];
function plannedInputNames(root) {
  const names = readdirSync(directory(root)).sort();
  assert.deepEqual(names, [...INPUTS, 'runtime-transition.json', ...(existsSync(join(root, 'continuation.json')) ? ['continuation.json'] : []), ...(existsSync(join(root, 'stability-continuation.json')) ? ['stability-continuation.json'] : []), ...(existsSync(join(root, 'history-manifest.json')) ? ['history-manifest.json'] : [])].sort(), 'Planned branch stores only its own inputs and proof, no copied historical trees');
  names.forEach(file => regular(join(root, file))); return names;
}
export function assertPlannedContinuation(proof, prior, cp) {
  assert.equal(proof.format, 'RED_PRIEST1017_ARMISTICE_OBSERVATION_CONTINUATION_V1');
  assert.equal(prior.commandCount, 1017); assert.equal(prior.rows.length, 99); assert.equal(prior.commands.length, 99);
  assert.equal(prior.continuation, undefined); assert.equal(prior.policyDefinition.armisticeAttempts, 5);
  assert.deepEqual(cp.policyDefinition, { ...prior.policyDefinition, armisticeAttempts: 20 }, 'Only the cumulative armistice observation cap may change from5 to20');
  assert.deepEqual(proof.originalPolicyDefinition, prior.policyDefinition); assert.deepEqual(proof.continuedPolicyDefinition, cp.policyDefinition);
  assert.deepEqual(proof.originalPolicyState, prior.policy); assert.deepEqual(proof.originalTerminal, prior.terminal); assert.deepEqual(proof.priorFork, prior.fork);
  assert.deepEqual(proof.onlyAllowedFreezeChange, ['$natural-producer']); assert.equal(proof.newFreezeSha256, cp.freezeSha256);
  assert.equal(proof.originalRowsSha256, compactHash(prior.rows)); assert.equal(proof.originalCommandsSha256, compactHash(prior.commands));
  assert.deepEqual(cp.rows.slice(0, 99), prior.rows); assert.deepEqual(cp.commands.slice(0, 99), prior.commands);
  assert(cp.rows.length > 99, 'Continued observation requires an actual new completed command');
  const next = cp.rows[99]; assert.equal(next.commandCount, 1018); assert.equal(next.beforeStateSha256, prior.finalStateSha256);
  assert.equal(next.publicBeforeSha256, prior.publicStateSha256); assert.deepEqual(next.randomBefore, prior.state.random);
  assert.equal(cp.initialStateSha256, prior.initialStateSha256); assert.equal(cp.initialPublicStateSha256, prior.initialPublicStateSha256);
}
function readPlannedContinuation(root, options, freeze, data, transition, resolveArtifact, checked) {
  const { cp, capture, originalRoot, old, rows } = data;
  if (!cp.continuation) { assert(!existsSync(join(root, 'continuation.json'))); assert.equal(options.priorPlannedDirectory, undefined); return null; }
  assert(options.priorPlannedDirectory, 'Explicit --prior-planned-directory requires the immutable original1017 six-file observation');
  const priorRoot = directory(options.priorPlannedDirectory); assert(!contains(root, priorRoot) && !contains(priorRoot, root));
  const proofPath = join(root, 'continuation.json'), proofEvidence = checked(proofPath);
  assert.equal(proofEvidence.sha256, 'a99965211e755af3b18ab8165a14ad8e7297d30975c9c95552e5b8a94954c199');
  const proof = json(proofPath), reference = { proofFile: 'continuation.json', proofSha256: proofEvidence.sha256, originalCommandCount: 1017 };
  assert.deepEqual(cp.continuation, reference); assert.deepEqual(capture.provenance.continuation, reference);
  const manifestPath = resolveArtifact('ARTIFACT', 'original-1017-manifest.json', { bytes: 1576, sha256: 'e5d510ea1413d44c828341699bd03f1c1955d2c6e88a38a30f820f41fd577af3' });
  const pin = json(manifestPath); assert.deepEqual(proof.originalCapture, pin);
  assert.deepEqual(plannedInputNames(priorRoot).sort(), pin.files.map(row => row.file).sort());
  for (const row of pin.files) assert.deepEqual(checked(join(priorRoot, row.file)), { bytes: row.bytes, sha256: row.sha256 });
  resolveArtifact('FROZEN_RUNTIME', '$natural-producer', pin.producer);
  const wrapped = json(join(priorRoot, 'checkpoint.json')), prior = wrapped.payload, priorCapture = json(join(priorRoot, 'natural.json'));
  assert.equal(stateHash(prior), wrapped.sha256); assert.equal(wrapped.sha256, pin.checkpointPayloadSha256);
  assert.equal(prior.finalStateSha256, pin.stateSha256); assert.equal(prior.publicStateSha256, pin.publicSha256); assert.deepEqual(prior.state.random, pin.random);
  assert.equal(prior.state.status, 'ACTIVE'); assert.equal(prior.state.progression.sequence, 1); assert.equal(prior.state.redPriest.campaign.phase, 'WAR');
  assert.deepEqual(prior.terminal, { stage: 'FINITE_CAMPAIGN_REVIEW_REQUIRED', reason: 'Actual truce was refused within the finite negotiation policy' });
  assert.equal(prior.policy.stopAfterWithdrawal, null); assert.equal(prior.policy.attempts[JSON.stringify({ type: 'CAMPAIGN', command: { type: 'SEEK_ARMISTICE' } })], 5);
  assert.equal(compactHash(prior.policyDefinition), '600541b6b36634916a24180826a4fa5184516f51f14ad8ba23ff85896d2ee38a');
  const priorFreeze = json(join(priorRoot, 'freeze.json')); assert.equal(priorFreeze.sha256, pin.freezeSha256); assertProducerOnlyFreezeChange(priorFreeze, freeze);
  const priorTransitionPath = join(priorRoot, 'runtime-transition.json'), priorTransition = json(priorTransitionPath);
  assert.deepEqual(priorTransition, { ...transition, newRuntimeFreezeSha256: priorFreeze.sha256 });
  assertPlannedForkReference(prior.fork, { ...cp.fork, runtimeProofSha256: evidence(priorTransitionPath).sha256 });
  const priorBytes = readFileSync(join(priorRoot, 'commands.ndjson'));
  assertOriginalLedgerPrefix(readFileSync(join(root, 'commands.ndjson')), priorBytes);
  const priorRows = priorBytes.toString('utf8').trimEnd().split('\n').map(JSON.parse);
  assertPlannedRows(originalRoot, old, prior, priorCapture, priorRows, transition.continuedPublicSha256);
  assertPlannedContinuation(proof, prior, cp); assert.deepEqual(rows.slice(0, 99), priorRows);
  return { reference, original: pin, originalDirectory: priorRoot, proof, original99RowsRetainedByteExactly: true, original1017OutcomePreserved: prior.terminal };
}

export function assertStabilityPolicy(before, after) {
  assert.equal(before.id, 'RED_PRIEST_PREDECLARE918_COORDINATED_FULL_PREPARATION_V1');
  assert.deepEqual(after, { ...before, id: 'RED_PRIEST1137_STABLE_POSTWAR_CONTINUATION_V1',
    materialAttemptScope: 'SINCE_LAST_ACTUAL_CONSUMPTION', promotionPreparation: 'REQUIRE_SAME_COMPOUND_PAID_STABILITY',
    minimumMindBeforeStability: 78, preparedEpilogue: true });
}
export function stabilityMaterialCycle(commands, firstLimitedIndex = 219) {
  assert(Number.isSafeInteger(firstLimitedIndex) && firstLimitedIndex >= 0);
  let cycle = { startedAfterCommand: 918, attempts: {} };
  for (const [i, intent] of commands.entries()) {
    assert.equal(intent.type, 'RED_PRIEST'); const command = intent.command;
    if (command.type === 'CONSUME') cycle = { startedAfterCommand: 919 + i, attempts: {} };
    else if (command.type === 'MATERIAL' && command.command.type !== 'PREPARE_COMPOUND') {
      const key = JSON.stringify(command); cycle.attempts[key] = (cycle.attempts[key] ?? 0) + 1;
      if (i >= firstLimitedIndex) assert(cycle.attempts[key] <= 12, 'Each new actual material operation retains the finite12-attempt cycle bound');
    }
  }
  return cycle;
}
export function assertStabilityContinuation(proof, prior, cp, reviewedPolicy, continuedPublicSha256) {
  assert.equal(proof.format, 'RED_PRIEST1137_STABILITY_CONTINUATION_V1');
  assert.equal(prior.commandCount, 1137); assert.equal(prior.rows.length, 219); assert.equal(prior.commands.length, 219);
  assert.equal(prior.stabilityContinuation, undefined);
  assert.deepEqual(cp.policyDefinition, reviewedPolicy);
  assert.deepEqual(proof.originalPolicyDefinition, prior.policyDefinition); assert.deepEqual(proof.continuedPolicyDefinition, cp.policyDefinition);
  assert.deepEqual(proof.originalPolicyState, prior.policy); assert.deepEqual(proof.originalTerminal, prior.terminal);
  assert.deepEqual(proof.priorFork, prior.fork); assert.deepEqual(proof.priorContinuation, prior.continuation);
  assert.deepEqual(cp.fork, prior.fork); assert.deepEqual(cp.continuation, prior.continuation);
  assert.equal(proof.newFreezeSha256, cp.freezeSha256);
  assert.equal(proof.originalRowsSha256, compactHash(prior.rows)); assert.equal(proof.originalCommandsSha256, compactHash(prior.commands));
  assert.deepEqual(cp.rows.slice(0, 219), prior.rows); assert.deepEqual(cp.commands.slice(0, 219), prior.commands);
  assert(cp.rows.length > 219, 'Stability continuation requires a real new completed command');
  const next = cp.rows[219]; assert.equal(next.commandCount, 1138); assert.equal(next.beforeStateSha256, prior.finalStateSha256);
  assert.equal(next.publicBeforeSha256, continuedPublicSha256); assert.deepEqual(next.randomBefore, prior.state.random);
  assert.equal(cp.initialStateSha256, prior.initialStateSha256); assert.equal(cp.initialPublicStateSha256, prior.initialPublicStateSha256);
}
function readStabilityObservation(root, options, resolveArtifact, checked) {
  const cp = json(join(root, 'checkpoint.json')).payload;
  if (!cp.stabilityContinuation) {
    assert(!existsSync(join(root, 'stability-continuation.json')));
    for (const key of ['stabilityPriorDirectory', 'stabilityEquivalenceProof', 'stabilityEquivalenceSha256', 'failure1222Directory']) assert.equal(options[key], undefined);
    return null;
  }
  assert(options.stabilityPriorDirectory && options.stabilityEquivalenceProof && digest(options.stabilityEquivalenceSha256));
  assert.equal(options.stabilityEquivalenceSha256, STABILITY_EQUIVALENCE_SHA, 'Only the reviewed exact219 current-runtime proof is accepted');
  const priorRoot = directory(options.stabilityPriorDirectory); assert(!contains(root, priorRoot) && !contains(priorRoot, root));
  const pinPath = resolveArtifact('ARTIFACT', 'original-1137-manifest.json', { bytes: 993, sha256: '9964baf7e73d054affe8769111f28e780c574d63529770b93a7d5301b0a01217' });
  const files = json(pinPath); assert.equal(files.length, 7);
  assert.deepEqual(plannedInputNames(priorRoot), files.map(row => row.path).sort());
  for (const row of files) assert.deepEqual(checked(join(priorRoot, row.path)), { bytes: row.bytes, sha256: row.sha256 });
  const wrapped = json(join(priorRoot, 'checkpoint.json')), prior = wrapped.payload;
  const original = { format: 'RED_PRIEST1137_SEALED_CAPTURE_V1', commandCount: 1137,
    checkpointPayloadSha256: '0ab3ef4e30ca552ed16611439a270ac921f0d1763af3854b3d3cb58c95290a88',
    stateSha256: 'ef0a3d0bad112bb15156257e905d65c00dbadce7c79914d58fa097d52c8062bc',
    publicSha256: '5bfa25052d1fb2a01c8d0f1ce8424d0318477aabfe6f5baf0e778ce97490f354',
    random: { seed: 'hunter-rebuild-first', cursor: 477 }, freezeSha256: STABILITY_PRIOR_FREEZE, files,
    producer: { file: 'producer.mjs', bytes: 61731, sha256: 'd19b9b1181d3826c61a9cd8da412ed2ae8114d1645486944a91a493bf581d0ef' } };
  assert.equal(wrapped.sha256, original.checkpointPayloadSha256); assert.equal(stateHash(prior), wrapped.sha256);
  assert.equal(prior.commandCount, 1137); assert.equal(prior.finalStateSha256, original.stateSha256); assert.equal(stateHash(prior.state), original.stateSha256);
  assert.equal(prior.publicStateSha256, original.publicSha256); assert.deepEqual(prior.state.random, original.random);
  assert.equal(prior.state.status, 'ACTIVE'); assert.equal(prior.state.progression.sequence, 1); assert.equal(prior.state.redPriest.campaign.phase, 'ARMISTICE');
  assert.deepEqual(prior.terminal, { stage: 'FINITE_MATERIAL_ATTEMPTS', reason: 'Finite attempts exhausted for 完成原件保管交接' });
  assert.equal(compactHash(prior.policyDefinition), 'ede7fd7d9d30f8801e2dc62de271cb3e45e12d1b6145ece5d3a0aa37be7d3733');
  const freeze = json(join(priorRoot, 'freeze.json')); assert.equal(freeze.sha256, STABILITY_PRIOR_FREEZE); assertFreeze(freeze, freeze);
  resolveArtifact('FROZEN_RUNTIME', '$natural-producer', original.producer);
  for (const row of freeze.files) resolveArtifact('FROZEN_RUNTIME', row.file, row);
  for (const name of ['runtime-transition.json', 'continuation.json']) assert.deepEqual(checked(join(root, name)), evidence(join(priorRoot, name)), 'Existing918 and1017 proof bytes remain immutable');
  assertOriginalLedgerPrefix(readFileSync(join(root, 'commands.ndjson')), readFileSync(join(priorRoot, 'commands.ndjson')));
  const proofPath = join(root, 'stability-continuation.json'), proofEvidence = checked(proofPath), proof = json(proofPath);
  const reference = { proofFile: 'stability-continuation.json', proofSha256: proofEvidence.sha256, originalCommandCount: 1137 };
  assert.deepEqual(cp.stabilityContinuation, reference); assert.deepEqual(proof.originalCapture, original);
  return { priorRoot, prior, original, freeze, proof, reference, capture: json(join(priorRoot, 'natural.json')) };
}
function readStabilityEquivalence(observation, options, freeze, cp, resolveArtifact, checked) {
  assertStabilityPolicy(observation.prior.policyDefinition, cp.policyDefinition);
  assert.deepEqual(cp.policy.materialCycle, stabilityMaterialCycle(cp.commands));
  const path = regular(resolve(options.stabilityEquivalenceProof)); assert.equal(checked(path).sha256, options.stabilityEquivalenceSha256);
  const proof = json(path), reference = observation.proof.runtimeTransition;
  assert.equal(reference.proofSha256, options.stabilityEquivalenceSha256);
  assert.equal(resolveArtifact('ARTIFACT', reference.proofFile, evidence(path)), path);
  assertStabilityReplayRows(proof, observation.prior.rows, STABILITY_PUBLIC_CHANGES);
  assert.equal(proof.replay.addedActionChecks, 6); assert.equal(proof.replay.addedSectionChecks, 6);
  for (const check of proof.replay.rows) {
    const after = Number([1028, 1029, 1030, 1111, 1112, 1113].includes(check.commandCount));
    const before = Number([1029, 1030, 1031, 1112, 1113, 1114].includes(check.commandCount));
    assert.equal(check.stabilityActionsAddedBefore, before); assert.equal(check.stabilitySectionsAddedBefore, before);
    assert.equal(check.stabilityActionsAddedAfter, after); assert.equal(check.stabilitySectionsAddedAfter, after);
    assert(digest(check.publicAdditionBeforeSha256) && digest(check.publicAdditionSha256));
    assert.equal(check.priorRuntimePublicBeforeSha256, check.capturedPublicBeforeSha256);
    assert.equal(check.priorRuntimePublicSha256, check.capturedPublicSha256); assert.equal(check.enabledOriginalAction, true);
  }
  const consumptionChecks = [1031, 1114].map((count, i) => {
    const row = observation.prior.rows[count - 919], event = observation.prior.state.redPriest.journal.find(event => event.revision === row.revision);
    assert.equal(row.intent.command.type, 'CONSUME');
    return { commandCount: count, compoundId: row.intent.command.compoundId, chance: 5, roll: [42, 58][i], tier: 'FAILURE', outcome: 'FAILURE',
      randomBefore: row.randomBefore, randomAfter: row.randomAfter, stateSha256: row.afterStateSha256, unchangedHistoricalEventSha256: stateHash(event) };
  });
  assert.deepEqual(proof.unchangedHistoricalConsumptionChecks, consumptionChecks);
  assert.equal(proof.normalizerNegativeTests.commandCount, 1028); assert.equal(proof.normalizerNegativeTests.positiveControlPassed, true);
  assert.equal(proof.normalizerNegativeTests.noAdditionalReplay, true); assert.equal(proof.normalizerNegativeTests.rejectedMutations, 12);
  const negative = proof.normalizerNegativeTests, prepared = proof.replay.rows[1028 - 919];
  assert.equal(negative.observedStateSha256, prepared.stateSha256); assert.equal(negative.observedPublicSha256, prepared.publicSha256);
  assert.equal(negative.capturedPublicSha256, prepared.capturedPublicSha256);
  assert.deepEqual(negative.checks, ['missing-new-section', 'missing-new-action', 'extra-new-section', 'extra-new-action',
    'changed-preparation-cost', 'changed-preparation-section', 'changed-original-resource', 'changed-original-action-cost', 'removed-original-section',
    'misplaced-new-action', 'under-removal-rejected-by-complete-public-hash', 'over-removal-rejected-by-complete-public-hash'].map(name => ({ name, rejected: true })));
  assert.equal(proof.originalFreezeSha256, observation.freeze.sha256);
  for (const key of ['strictFinalValidation', 'originalInputsUnchanged', 'productionUnchangedDuringReplay']) assert.equal(proof[key], true);
  assert.equal(proof.inputStartSha256, stateHash(proof.inputFiles)); assert.equal(proof.inputEndSha256, proof.inputStartSha256);
  assert.equal(proof.currentRuntimeEndSha256, proof.currentRuntimeFreeze.sha256);
  assert.equal(proof.inputFiles.filter(row => row.sha256 === proof.scriptSha256).length, 1);
  assert.equal(proof.inputFiles.filter(row => row.sha256 === proof.normalizerSha256).length, 1);
  for (const row of proof.inputFiles) resolveArtifact('ARTIFACT', row.path, row);
  const currentFiles = freeze.files.filter(row => row.file !== '$natural-producer');
  assertFreeze(proof.currentRuntimeFreeze, { files: currentFiles, sha256: compactHash(currentFiles) });
  assert.deepEqual(proof.allowedChanges, STABILITY_CHANGED_FILES);
  const changedNames = proof.changedFiles.map(row => row.file);
  assert(changedNames.every(file => STABILITY_CHANGED_FILES.includes(file)));
  for (const file of STABILITY_CHANGED_FILES.filter(file => !['dist/domain/red-priest/types.js', 'dist/domain/red-priest/types.js.map', 'dist/domain/red-priest/epilogue.js', 'dist/domain/red-priest/epilogue.js.map'].includes(file))) assert(changedNames.includes(file));
  assertRuntimeFreeze(observation.freeze, freeze, proof.changedFiles, changedNames);
  assert.deepEqual(proof.originalRuntimeFiles.map(({ source, ...row }) => row), observation.freeze.files.filter(row => row.file !== '$natural-producer'));
  const source = proof.source1137, checkpoint = observation.original.files.find(row => row.path === 'checkpoint.json');
  assert.equal(source.commandCount, 1137); assert.equal(source.payloadSha256, observation.original.checkpointPayloadSha256);
  assert.deepEqual(source.checkpoint, { bytes: checkpoint.bytes, sha256: checkpoint.sha256 });
  assert.equal(source.stateSha256, observation.original.stateSha256); assert.equal(source.publicSha256, observation.original.publicSha256); assert.deepEqual(source.random, observation.original.random);
  assert.deepEqual(proof.original1137Capture.files, observation.original.files);
  assert.deepEqual(proof.original1137Capture.manifestEvidence, { bytes: 993, sha256: '9964baf7e73d054affe8769111f28e780c574d63529770b93a7d5301b0a01217' });
  assert.equal(proof.original1137Capture.freezeSha256, observation.freeze.sha256);
  assert.equal(proof.original1137Capture.payloadSha256, observation.original.checkpointPayloadSha256);
  assert.equal(proof.original983Replay.proofSha256, options.planningEquivalenceSha256);
  assert.equal(resolveArtifact('ARTIFACT', proof.original983Replay.proofFile, evidence(regular(resolve(options.planningEquivalenceProof)))), regular(resolve(options.planningEquivalenceProof)));
  assert.equal(proof.initialStateSha256, observation.prior.initialStateSha256);
  assert.equal(proof.stateSha256, observation.original.stateSha256); assert.equal(proof.originalPublicSha256, observation.original.publicSha256);
  assert.equal(proof.continuedPublicSha256, observation.original.publicSha256, 'No prepared compound exists at1137; its full public projection stays exact');
  assert.deepEqual(proof.random, observation.original.random);
  assert.equal(proof.replay.rows[0].publicBeforeSha256, observation.prior.initialPublicStateSha256);
  assert.equal(proof.replay.rows.at(-1).publicSha256, proof.continuedPublicSha256);
  assertStabilityContinuation(observation.proof, observation.prior, cp, cp.policyDefinition, proof.continuedPublicSha256);
  return { path, sha256: options.stabilityEquivalenceSha256, proof };
}

const safeArtifactPath = value => typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.includes('\0') && !value.startsWith('/') && !/^[A-Za-z]:/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..');
export function assertArtifactLocations(map) {
  assert.deepEqual(Object.keys(map).sort(), ['entries', 'format']);
  assert.equal(map.format, 'RED_PRIEST_PLANNED_VERIFIER_ARTIFACT_MAP_V1'); assert(Array.isArray(map.entries));
  const identities = new Set();
  for (const entry of map.entries) {
    assert.deepEqual(Object.keys(entry).sort(), ['bytes', 'kind', 'name', 'path', 'sha256']);
    assert(['ARTIFACT', 'FROZEN_RUNTIME'].includes(entry.kind));
    assert(typeof entry.name === 'string' && entry.name.length > 0 && !entry.name.includes('\0'));
    if (entry.kind === 'FROZEN_RUNTIME') assert(entry.name === '$natural-producer' || safeArtifactPath(entry.name));
    assert(safeArtifactPath(entry.path), 'Artifact locations must be safe root-relative paths, never absolute paths or traversal');
    assert(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 && digest(entry.sha256));
    const identity = JSON.stringify([entry.kind, entry.name, entry.sha256]); assert(!identities.has(identity), 'Duplicate artifact identity'); identities.add(identity);
  }
}
function artifactResolver(repo, options, checked) {
  assert(options.artifactMap && options.artifactRoot && digest(options.artifactMapSha256), 'Reviewed --artifact-map, --artifact-map-sha256 and --artifact-root are required');
  const root = directory(options.artifactRoot), path = regular(resolve(options.artifactMap)); assert(contains(root, path), 'Location map must be inside its explicit artifact root');
  assert.equal(checked(path).sha256, options.artifactMapSha256); const map = json(path); assertArtifactLocations(map);
  return (kind, name, expected) => {
    assert(digest(expected.sha256) && Number.isSafeInteger(expected.bytes));
    const entry = map.entries.find(row => row.kind === kind && row.name === name && row.sha256 === expected.sha256);
    if (entry) {
      assert.equal(entry.bytes, expected.bytes); const target = resolve(root, entry.path); assert(contains(root, target));
      assert.deepEqual(checked(target), { bytes: expected.bytes, sha256: expected.sha256 }); return target;
    }
    // Canonical unchanged repository inputs need no duplicate fixture copy.
    // An old absolute logical path is never treated as a filesystem path.
    const current = safeArtifactPath(name) ? join(repo, name) : null;
    assert(current && existsSync(current) && lstatSync(current).isFile(), `No explicit location for ${kind} ${name} at ${expected.sha256}`);
    assert.deepEqual(checked(current), { bytes: expected.bytes, sha256: expected.sha256 }); return current;
  };
}

function readPlannedCapture(root, repo, freeze, options) {
  assert(options.forkDirectory && options.archiveDirectory && options.planningEquivalenceProof && digest(options.planningEquivalenceSha256), 'Explicit reviewed fork/archive/equivalence inputs are required');
  assert.equal(options.planningEquivalenceSha256, PLANNING_EQUIVALENCE_SHA, 'Historical188 proof remains sealed');
  const forkDirectory = directory(options.forkDirectory), archiveDirectory = directory(options.archiveDirectory);
  assert(!contains(root, archiveDirectory) && !contains(archiveDirectory, root), 'The original983 archive and planned branch remain separate');
  const extras = [], checked = path => { const result = evidence(regular(resolve(path))); extras.push({ path: resolve(path), ...result }); return result; };
  const resolveArtifact = artifactResolver(repo, options, checked);
  const stability = readStabilityObservation(root, options, resolveArtifact, checked), planningFreeze = stability?.freeze ?? freeze;
  const rootPath = join(forkDirectory, 'original-918-checkpoint.json'), reconstructionPath = join(forkDirectory, 'reconstruction-proof.json');
  assert.equal(checked(rootPath).sha256, PLANNED_ROOT_SHA); assert.equal(checked(reconstructionPath).sha256, PLANNED_RECONSTRUCTION_SHA);
  const wrappedRoot = json(rootPath), originalRoot = wrappedRoot.payload, reconstruction = json(reconstructionPath);
  const archiveManifestPath = resolveArtifact('ARTIFACT', reconstruction.original983.manifest, reconstruction.original983.manifestEvidence);
  assert.equal(evidence(archiveManifestPath).sha256, ORIGINAL983_MANIFEST_SHA);
  const archivedInputs = json(archiveManifestPath); assert.equal(archivedInputs.length, 57);
  assert.deepEqual(captureInputNames(archiveDirectory).sort(), archivedInputs.map(row => row.path).sort());
  for (const row of archivedInputs) assert.deepEqual(checked(join(archiveDirectory, row.path)), { bytes: row.bytes, sha256: row.sha256 });
  const archivedFreeze = json(join(archiveDirectory, 'freeze.json')); assert.equal(archivedFreeze.sha256, ORIGINAL983_FREEZE); assertFreeze(archivedFreeze, archivedFreeze);
  const archivedProducer = evidence(resolveArtifact('ARTIFACT', reconstruction.original983.producer.path, reconstruction.original983.producer));
  assert.deepEqual(archivedProducer, { bytes: 75347, sha256: 'c1704c1d68a67bb5feec17bda5b3c11cceafbfc40743d93cd29c996b904a4e72' });
  const archivedVerifier = evidence(resolveArtifact('ARTIFACT', 'scripts/verify/red-priest-save.mjs', { bytes: 59568, sha256: 'c41ad58f57b646c14d5caad054067d5b8d6058b7a6fdd62f7cabc44c75757dab' }));
  assert.deepEqual(archivedVerifier, { bytes: 59568, sha256: 'c41ad58f57b646c14d5caad054067d5b8d6058b7a6fdd62f7cabc44c75757dab' });
  const archived = readCapture(archiveDirectory, repo, archivedFreeze), archivedContinuation = readContinuation(archiveDirectory, archivedFreeze, archived);
  assert.equal(archived.cp.commandCount, 983); assert.equal(archived.capture.stage, 'FINITE_CAMPAIGN_WITHDRAWN');
  assert.equal(archived.cp.finalStateSha256, 'c6f86247a2aef2057f1aa06f3810c80a2f765138991b5a94865fa719323eff3d');
  assert.equal(stateHash(originalRoot), wrappedRoot.sha256); assertPlannedForkPrefix(originalRoot, archived.old, archived.rows);
  assert.equal(originalRoot.finalStateSha256, '779ef84dfc74b9abbfe1e97c9bff206c683a9b18d3957d6603661f9748b38acd');
  assert.equal(originalRoot.publicStateSha256, '361cc87eba7713bdf66752b17fd298350d558e5be2f10e30e8419fb67f172d91');
  assert.deepEqual(originalRoot.random, { seed: archived.old.seed, cursor: 423 });
  assert.equal(reconstruction.allPrivatePublicAndRngEqual, true); assert.equal(reconstruction.strictFinalValidation, true);
  assert.equal(reconstruction.expectedStateSha256, originalRoot.finalStateSha256); assert.equal(reconstruction.expectedPublicSha256, originalRoot.publicStateSha256);
  const preflightPath = join(forkDirectory, 'reconstruction-preflight-final.json'); assert.equal(checked(preflightPath).sha256, reconstruction.preflightSha256);
  const reconstructionPreflight = json(preflightPath); assert.equal(checked(join(forkDirectory, 'reconstruct-918.mjs')).sha256, reconstruction.scriptSha256);
  const historicalFreeze = json(join(archiveDirectory, 'prior-observation/prior-observation/prior-observation/freeze.json'));
  assert.equal(historicalFreeze.sha256, originalRoot.originalRuntimeFreezeSha256);
  assert.deepEqual(reconstructionPreflight.originalSources.map(({ source, ...row }) => row), historicalFreeze.files);
  const historicalRuntimeSources = historicalFreeze.files.map(row => {
    const path = resolveArtifact('FROZEN_RUNTIME', row.file, row);
    return { file: row.file, path, bytes: row.bytes, sha256: row.sha256 };
  });
  const equivalencePath = regular(resolve(options.planningEquivalenceProof)); assert.equal(checked(equivalencePath).sha256, options.planningEquivalenceSha256);
  const equivalence = json(equivalencePath); assert.equal(equivalence.format, 'RED_PRIEST983_PLANNING_TRANSITION_V1');
  assert.equal(equivalence.originalFreezeSha256, ORIGINAL983_FREEZE);
  for (const key of ['strictFinalValidation', 'originalInputsUnchanged', 'productionUnchangedDuringReplay']) assert.equal(equivalence[key], true);
  assert.equal(equivalence.inputStartSha256, stateHash(equivalence.inputFiles)); assert.equal(equivalence.inputEndSha256, equivalence.inputStartSha256);
  assert.equal(equivalence.currentRuntimeEndSha256, equivalence.currentRuntimeFreeze.sha256);
  assert.equal(equivalence.stateSha256, archived.cp.finalStateSha256); assert.equal(equivalence.originalPublicSha256, archived.cp.publicStateSha256);
  assert.equal(equivalence.continuedPublicSha256, equivalence.replay.rows.at(-1).publicSha256); assert.deepEqual(equivalence.random, archived.cp.state.random);
  assert.equal(equivalence.inputFiles.filter(row => row.sha256 === equivalence.scriptSha256).length, 1);
  assert.equal(equivalence.inputFiles.filter(row => row.sha256 === equivalence.normalizerSha256).length, 1);
  for (const row of equivalence.inputFiles) {
    resolveArtifact('ARTIFACT', row.path, row);
  }
  const currentFiles = planningFreeze.files.filter(row => row.file !== '$natural-producer'); assertFreeze(equivalence.currentRuntimeFreeze, { files: currentFiles, sha256: compactHash(currentFiles) });
  assert.equal(equivalence.original983Capture.manifestEvidence.sha256, ORIGINAL983_MANIFEST_SHA);
  assertPlanningReplayRows(equivalence, archived.rows, archivedContinuation.transition);
  const transitionPath = join(root, 'runtime-transition.json'), transition = json(regular(transitionPath));
  const transitionEvidence = evidence(transitionPath);
  assert.equal(transition.format, 'RED_PRIEST918_PLANNING_TRANSITION_V1'); assert.equal(transition.commandCount, 918);
  assertPlannedFreezeSeparation(historicalFreeze, planningFreeze, transition);
  assert.equal(transition.stateSha256, originalRoot.finalStateSha256); assert.equal(transition.originalPublicSha256, originalRoot.publicStateSha256);
  assert.equal(transition.continuedPublicSha256, equivalence.replay.rows[122].publicSha256);
  assert.deepEqual(transition.random, originalRoot.random); assert.equal(transition.unchangedPrivateAndRng, true);
  assert.equal(transition.publicDifference, 'Only appended ENABLE_PLANNING action');
  assert.deepEqual(transition.allowedPublicChanges, ['APPENDED_ENABLE_PLANNING_CRISIS_ACTION']);
  assert.equal(transition.original983Replay.proofSha256, options.planningEquivalenceSha256);
  assert.equal(resolveArtifact('ARTIFACT', transition.original983Replay.proofFile, evidence(equivalencePath)), equivalencePath, 'Stored logical proof reference must resolve to the reviewed proof without rewriting historical JSON');
  const originalPublicPath = join(forkDirectory, 'original-918-public.json'); checked(originalPublicPath); const originalPublic = json(originalPublicPath);
  assert.equal(stateHash(originalPublic), originalRoot.publicStateSha256);
  const continuedPublic = { ...originalPublic, actions: [...originalPublic.actions, transition.addedAction] };
  assert.equal(transition.addedAction.enabled, true); assert.deepEqual(restoreBeforePlanning(continuedPublic), originalPublic);
  assert.equal(stateHash(continuedPublic), transition.continuedPublicSha256);
  const wrapped = json(join(root, 'checkpoint.json')), cp = wrapped.payload, capture = json(join(root, 'natural.json')), report = json(join(root, 'summary.json'));
  assert.equal(wrapped.sha256, stateHash(cp)); assert.equal(cp.freezeSha256, freeze.sha256);
  const fork = { rootFile: 'original-918-checkpoint.json', rootSha256: PLANNED_ROOT_SHA, proofFile: 'reconstruction-proof.json', proofSha256: PLANNED_RECONSTRUCTION_SHA, runtimeProofFile: 'runtime-transition.json', runtimeProofSha256: transitionEvidence.sha256 };
  assertPlannedForkReference(cp.fork, fork);
  const ledger = readFileSync(join(root, 'commands.ndjson'), 'utf8'); assert(ledger.endsWith('\n'));
  const rows = ledger.slice(0, -1).split('\n').map(line => { assert(line); return JSON.parse(line); });
  assertPlannedRows(originalRoot, archived.old, cp, capture, rows, transition.continuedPublicSha256);
  if (stability) assertPlannedRows(originalRoot, archived.old, stability.prior, stability.capture, stability.prior.rows, transition.continuedPublicSha256);
  const plannedContinuation = readPlannedContinuation(stability?.priorRoot ?? root, options, planningFreeze,
    { cp: stability?.prior ?? cp, capture: stability?.capture ?? capture, originalRoot, old: archived.old, rows: stability?.prior.rows ?? rows }, transition, resolveArtifact, checked);
  const stabilityEquivalence = stability ? readStabilityEquivalence(stability, options, freeze, cp, resolveArtifact, checked) : null;
  if (!plannedContinuation) assert.equal(compactHash(cp.policyDefinition), '600541b6b36634916a24180826a4fa5184516f51f14ad8ba23ff85896d2ee38a', 'Only the reviewed finite public preparation policy is accepted');
  assert(rows.length <= cp.policyDefinition.maximumNewCommands);
  const attempts = {}; for (const row of rows) { const key = JSON.stringify(row.intent.command); attempts[key] = (attempts[key] ?? 0) + 1; }
  assert.deepEqual(cp.policy.attempts, attempts, 'New branch attempts count exactly its own completed public commands');
  assert.deepEqual(capture.provenance, { kind: 'EXACT_ORIGINAL_PREDECLARE918_PLANNED_BRANCH', source: SOURCE, sourceSha256: SOURCE_SHA,
    prefixCommandsSha256: cp.prefixSha256, runtimeFreezeSha256: freeze.sha256, historicalPrefixRetainedExactly: true, original983BranchPreserved: true,
    notContinuationOf983: true, seedChanged: false, selectedFromEnabledPublicActionsOnly: true, fork, ...(plannedContinuation ? { continuation: plannedContinuation.reference } : {}), ...(stability ? { stabilityContinuation: stability.reference } : {}) });
  assert.equal(report.paused, false); assert.equal(report.strictFinalValidation, true); assert.equal(report.stage, capture.stage); assert.equal(report.reason, capture.reason);
  assert.equal(report.originalCommands, 918); assert.equal(report.commands, cp.commandCount); assert.equal(report.newCommands, rows.length);
  const manifest = { kind: 'INDEPENDENT_EXACT_PREDECLARE918_PLANNED_BRANCH', originalCommandCount: 918, original983Outcome: archived.capture.stage,
    original983CommandCount: 983, original983ManifestSha256: ORIGINAL983_MANIFEST_SHA, archivedProducer, archivedVerifier, historicalRuntimeFreezeSha256: historicalFreeze.sha256,
    newRuntimeFreezeSha256: freeze.sha256, planningRuntimeFreezeSha256: planningFreeze.sha256, rootPayloadSha256: wrappedRoot.sha256, fork, reconstruction, transition, plannedContinuation, ...(stability ? { stabilityContinuation: { reference: stability.reference, original: stability.original, originalDirectory: stability.priorRoot, proof: stability.proof }, stabilityEquivalence } : {}),
    legacyEquivalence: { path: equivalencePath, sha256: options.planningEquivalenceSha256, commands: 188, originalPrivateAndRngUnchanged: true, runtimeFreezeSha256: equivalence.currentRuntimeFreeze.sha256, scope: 'HISTORICAL_PRE_STABILITY_RUNTIME_ONLY' }, historicalRuntimeSources, inputs: extras };
  return { old: archived.old, capture, cp, rows, ...selectBoundaries(rows, capture.final.redPriest.journal, stability ? [1017, 1137] : plannedContinuation ? [1017] : []), planned: { root: originalRoot, manifest, stabilityEquivalence, legacyStart: json(join(archiveDirectory, 'prior-observation/checkpoint.json')).payload.state,
    legacyRows: archived.rows.slice(179), legacyProjectionRows: equivalence.replay.rows.slice(179), legacyInitialPublicSha256: equivalence.replay.rows[178].publicSha256,
    unchanged: () => { for (const row of extras) assert.deepEqual(evidence(row.path), { bytes: row.bytes, sha256: row.sha256 }); assert.deepEqual(captureInputNames(archiveDirectory).sort(), archivedInputs.map(row => row.path).sort()); if (plannedContinuation) assert.deepEqual(plannedInputNames(plannedContinuation.originalDirectory).sort(), plannedContinuation.original.files.map(row => row.file).sort()); if (stability) assert.deepEqual(plannedInputNames(stability.priorRoot), stability.original.files.map(row => row.path).sort()); } } };
}

export function assertIndependentCaptureFiles(names) {
  assert.deepEqual(names, [...INPUTS, 'runtime-transition.json', 'history-manifest.json'].sort(), 'Independent918 capture contains exactly its seven own files');
}
function readIndependentStabilityCapture(root, repo, freeze, options) {
  assertIndependentCaptureFiles(plannedInputNames(root));
  assert(options.failure1222Directory, 'Independent918 branch requires --failure-1222-directory with the complete immutable failed branch');
  const failureRoot = directory(options.failure1222Directory); assert(!contains(root, failureRoot) && !contains(failureRoot, root));
  const extras = [], checked = path => { const result = evidence(regular(resolve(path))); extras.push({ path: resolve(path), ...result }); return result; };
  const resolveArtifact = artifactResolver(repo, options, checked);
  const manifestEvidence = { bytes: 1441, sha256: '773f1169cadcb4694cc85ac73f19aa5ef445f02eb233e82b827fe723eafd0e03' };
  const manifestPath = resolveArtifact('ARTIFACT', 'original-1222-manifest.json', manifestEvidence), failureManifest = json(manifestPath);
  assert.equal(failureManifest.format, 'red-priest-209-immutable-capture-files-v1'); assert.equal(failureManifest.files.length, 8);
  assert.equal(failureManifest.totalBytes, failureManifest.files.reduce((total, row) => total + row.bytes, 0));
  assert.deepEqual(plannedInputNames(failureRoot), failureManifest.files.map(row => row.path).sort());
  for (const row of failureManifest.files) assert.deepEqual(checked(join(failureRoot, row.path)), { bytes: row.bytes, sha256: row.sha256 });
  const failureFreeze = json(join(failureRoot, 'freeze.json')); assert.equal(failureFreeze.sha256, '8e55c3f4a7f0e0d4105af5d237dc66ea31db628edcb1d9fc3302039c9faac61f');
  assertProducerOnlyFreezeChange(failureFreeze, freeze);
  const failureProducer = failureFreeze.files.find(row => row.file === '$natural-producer');
  resolveArtifact('FROZEN_RUNTIME', '$natural-producer', failureProducer);
  const failed = readPlannedCapture(failureRoot, repo, failureFreeze, options), originalRoot = failed.planned.root, historical = failed.planned.manifest;
  assert.equal(failed.cp.independentBranch, undefined); assert.equal(failed.cp.commandCount, 1222);
  assert.equal(failed.cp.finalStateSha256, '860dbc38a705a19021e6c3c43c28d2e6e342610d2c6db8c6e1aea1b45d5426ee');
  assert.equal(failed.cp.publicStateSha256, 'a736ce2018e86d2083bcde13fca8b89d7f9438762d41133a8064453a3023aeba');
  assert.deepEqual(failed.cp.state.random, { seed: 'hunter-rebuild-first', cursor: 501 });
  assert.equal(failed.cp.state.status, 'ACTIVE'); assert.equal(failed.cp.state.progression.sequence, 1);
  assert.deepEqual(failed.cp.terminal, { stage: 'ORIGINAL_MATERIAL_UNAVAILABLE', reason: 'An original material is publicly unavailable; no replacement, reset or reroll is permitted' });
  const failedDoses = failed.cp.state.redPriest.journal.filter(event => event.command.type === 'CONSUME');
  assert.equal(failedDoses.length, 3);
  assert.deepEqual(failedDoses.map(event => ({ commandCount: event.revision - 1, chance: event.randomReceipts[0].check.chance,
    roll: event.randomReceipts[0].check.roll, tier: event.randomReceipts[0].check.tier, outcome: event.materialReceipt.consumption.outcome })),
    [{ commandCount: 1031, chance: 5, roll: 42, tier: 'FAILURE', outcome: 'FAILURE' },
      { commandCount: 1114, chance: 5, roll: 58, tier: 'FAILURE', outcome: 'FAILURE' },
      { commandCount: 1211, chance: 68, roll: 90, tier: 'FAILURE', outcome: 'FAILURE' }]);
  const historyPath = join(root, 'history-manifest.json'), historyEvidence = checked(historyPath), history = json(historyPath);
  const wrapped = json(join(root, 'checkpoint.json')), cp = wrapped.payload, capture = json(join(root, 'natural.json')), report = json(join(root, 'summary.json'));
  assert.equal(wrapped.sha256, stateHash(cp)); assert.equal(cp.freezeSha256, freeze.sha256);
  const reference = assertIndependentStabilityBranch(cp, capture, originalRoot, failed.cp.policyDefinition, historyEvidence.sha256);
  assert.equal(history.format, 'RED_PRIEST918_STABILITY_FIRST_HISTORY_V1');
  assert.equal(history.independentRootCommandCount, 918); assert.equal(history.preservedFailureCommandCount, 1222);
  assert.equal(history.original918PrefixSha256, cp.prefixSha256); assert.equal(history.newFreezeSha256, freeze.sha256);
  assert.deepEqual(history.policyDefinition, cp.policyDefinition); assert.deepEqual(history.sameSeedAndCursor, originalRoot.random);
  assert.equal(history.selectedPromotionCheckpoint, false); assert.equal(history.original1222BranchPreserved, true);
  assert.deepEqual(Object.keys(history).sort(), ['additionalProofInputs', 'format', 'independentRootCommandCount', 'newFreezeSha256', 'original1222BranchPreserved', 'original918PrefixSha256', 'policyDefinition', 'preservedFailureCommandCount', 'proofs', 'sameSeedAndCursor', 'selectedPromotionCheckpoint', 'sources']);
  const pin = row => ({ bytes: row.bytes, sha256: row.sha256 });
  const used = new Set(), identities = new Set();
  const bind = (row, expected = pin(row)) => {
    assert.deepEqual(Object.keys(row).sort(), ['bytes', 'path', 'sha256']); assert(safeArtifactPath(row.path));
    assert(!used.has(row.path), 'Each logical historical input is referenced once'); used.add(row.path);
    assert.deepEqual(pin(row), expected); resolveArtifact('ARTIFACT', row.path, expected); identities.add(JSON.stringify(expected));
  };
  const sources = [
    { id: 'source918', commandCount: 918, files: [
      { path: 'original-918-checkpoint.json', ...evidence(regular(join(directory(options.forkDirectory), 'original-918-checkpoint.json'))) },
      { path: 'reconstruction-proof.json', ...evidence(regular(join(directory(options.forkDirectory), 'reconstruction-proof.json'))) }],
      stateSha256: originalRoot.finalStateSha256, publicSha256: originalRoot.publicStateSha256, random: originalRoot.random },
    { id: 'original983', commandCount: 983, files: historical.reconstruction.original983.files, producer: historical.archivedProducer,
      manifest: { bytes: 10326, sha256: ORIGINAL983_MANIFEST_SHA } },
    { id: 'planned1017', commandCount: 1017, files: historical.plannedContinuation.original.files.map(({ file, ...row }) => ({ path: file, ...row })), producer: pin(historical.plannedContinuation.original.producer) },
    { id: 'planned1137', commandCount: 1137, files: historical.stabilityContinuation.original.files, producer: pin(historical.stabilityContinuation.original.producer) },
    { id: 'stable1222', commandCount: 1222, files: failureManifest.files, producer: pin(failureProducer), manifest: manifestEvidence,
      checkpointPayloadSha256: '78903719a4e322bc6781b759ece4653e84546a3eb0e4fdf04809bc2abba41147',
      stateSha256: failed.cp.finalStateSha256, publicSha256: failed.cp.publicStateSha256, random: failed.cp.state.random, terminal: failed.cp.terminal },
  ];
  assert.equal(history.sources.length, 5);
  for (const [i, expected] of sources.entries()) {
    const source = history.sources[i]; assert(safeArtifactPath(source.directory));
    assert.deepEqual(source, { ...expected, directory: source.directory,
      ...(expected.producer ? { producer: { path: source.producer.path, ...expected.producer } } : {}),
      ...(expected.manifest ? { manifest: { path: source.manifest.path, ...expected.manifest } } : {}) });
    for (const row of source.files) bind({ ...row, path: `${source.directory}/${row.path}` });
    if (expected.producer) bind(source.producer, expected.producer);
    if (expected.manifest) bind(source.manifest, expected.manifest);
  }
  const proofs = [
    { id: 'historicalPlanning983', path: regular(resolve(options.planningEquivalenceProof)), sha256: PLANNING_EQUIVALENCE_SHA,
      scope: 'Original188 commands796-983 under the historical planning runtime only; not a current-stability188 replay' },
    { id: 'currentStability219', path: regular(resolve(options.stabilityEquivalenceProof)), sha256: STABILITY_EQUIVALENCE_SHA,
      scope: 'Original219 planned commands919-1137 under the exact current runtime, including the genuine918 initial private/RNG/public boundary' },
  ];
  assert.equal(history.proofs.length, 2);
  for (const [i, expected] of proofs.entries()) {
    const proof = history.proofs[i]; assert.deepEqual(proof, { id: expected.id, path: proof.path, ...evidence(expected.path), scope: expected.scope });
    bind({ path: proof.path, ...pin(proof) }); assert.equal(proof.sha256, expected.sha256);
  }
  assert(Array.isArray(history.additionalProofInputs));
  const inputIdentities = new Set(failed.planned.stabilityEquivalence.proof.inputFiles.map(row => JSON.stringify(pin(row))));
  for (const row of history.additionalProofInputs) { assert(inputIdentities.has(JSON.stringify(pin(row)))); bind(row); }
  for (const identity of inputIdentities) assert(identities.has(identity), 'Every219 proof input remains represented in the immutable history');
  const runtimePath = join(root, 'runtime-transition.json'), transition = json(runtimePath), runtimeEvidence = checked(runtimePath);
  const currentProof = failed.planned.stabilityEquivalence.proof;
  const expectedTransition = { format: 'RED_PRIEST918_STABILITY_FIRST_TRANSITION_V1', commandCount: 918,
    originalRuntimeFreezeSha256: originalRoot.originalRuntimeFreezeSha256, newRuntimeFreezeSha256: freeze.sha256,
    stateSha256: originalRoot.finalStateSha256, originalPublicSha256: originalRoot.publicStateSha256,
    continuedPublicSha256: currentProof.replay.rows[0].publicBeforeSha256, random: originalRoot.random,
    unchangedPrivateAndRng: true, publicDifference: 'Only appended ENABLE_PLANNING action at genuine918; full future stability strategy selected before919',
    allowedPublicChanges: historical.transition.allowedPublicChanges, addedAction: historical.transition.addedAction, independentBranch: reference,
    historicalPlanningReplay: { proofFile: transition.historicalPlanningReplay.proofFile, proofSha256: PLANNING_EQUIVALENCE_SHA,
      commands: 188, first: 796, last: 983, scope: 'Historical planning runtime only; this is not a current-stability188 replay' },
    currentStabilityReplay: { proofFile: transition.currentStabilityReplay.proofFile, proofSha256: STABILITY_EQUIVALENCE_SHA,
      commands: 219, first: 919, last: 1137, genuine918PrivateAndRngBound: true, currentRuntimeFreezeSha256: currentProof.currentRuntimeFreeze.sha256 } };
  assert.deepEqual(transition, expectedTransition);
  for (const [reference, path] of [[transition.historicalPlanningReplay, options.planningEquivalenceProof], [transition.currentStabilityReplay, options.stabilityEquivalenceProof]])
    assert.equal(resolveArtifact('ARTIFACT', reference.proofFile, evidence(regular(resolve(path)))), regular(resolve(path)));
  const fork = { ...failed.cp.fork, runtimeProofSha256: runtimeEvidence.sha256 }; assertPlannedForkReference(cp.fork, fork);
  const ledger = readFileSync(join(root, 'commands.ndjson'), 'utf8'); assert(ledger.endsWith('\n'));
  const rows = ledger.slice(0, -1).split('\n').map(line => { assert(line); return JSON.parse(line); });
  assertPlannedRows(originalRoot, failed.old, cp, capture, rows, transition.continuedPublicSha256);
  assert(rows.length <= cp.policyDefinition.maximumNewCommands);
  const attempts = {}; for (const row of rows) { const key = JSON.stringify(row.intent.command); attempts[key] = (attempts[key] ?? 0) + 1; }
  assert.deepEqual(cp.policy.attempts, attempts);
  assert.deepEqual(capture.provenance, { kind: 'EXACT_ORIGINAL_PREDECLARE918_STABILITY_FIRST_BRANCH', source: SOURCE, sourceSha256: SOURCE_SHA,
    prefixCommandsSha256: cp.prefixSha256, runtimeFreezeSha256: freeze.sha256, historicalPrefixRetainedExactly: true,
    original983BranchPreserved: true, notContinuationOf983: true, original1222BranchPreserved: true, notContinuationOf1222: true,
    seedChanged: false, selectedFromEnabledPublicActionsOnly: true, fork, independentBranch: reference });
  assert.equal(report.paused, false); assert.equal(report.strictFinalValidation, true); assert.equal(report.stage, capture.stage); assert.equal(report.reason, capture.reason);
  assert.equal(report.originalCommands, 918); assert.equal(report.commands, cp.commandCount); assert.equal(report.newCommands, rows.length);
  const manifest = { kind: 'INDEPENDENT_EXACT_PREDECLARE918_STABILITY_FIRST_BRANCH', originalCommandCount: 918, fork, transition, independentBranch: reference,
    history, historyEvidence, original983Outcome: 'FINITE_CAMPAIGN_WITHDRAWN', original1222Outcome: failed.capture.stage,
    currentRuntimeFreezeSha256: freeze.sha256, historical1222: { directory: failureRoot, manifestEvidence, files: failureManifest.files, freezeSha256: failureFreeze.sha256,
      finalStateSha256: failed.cp.finalStateSha256, publicStateSha256: failed.cp.publicStateSha256, random: failed.cp.state.random, newCommands: failed.rows.length,
      replayThisInvocation: 'NOT_RUN', sqliteThisInvocation: 'NOT_RUN', lineage: historical }, inputs: extras };
  return { old: failed.old, capture, cp, rows, ...selectBoundaries(rows, capture.final.redPriest.journal), planned: { root: originalRoot, manifest,
    independentBranch: reference, stabilityEquivalence: null, legacyStart: failed.planned.legacyStart, legacyRows: failed.planned.legacyRows,
    legacyProjectionRows: failed.planned.legacyProjectionRows, legacyInitialPublicSha256: failed.planned.legacyInitialPublicSha256,
    unchanged: () => { failed.planned.unchanged(); for (const row of extras) assert.deepEqual(evidence(row.path), pin(row));
      assert.deepEqual(plannedInputNames(failureRoot), failureManifest.files.map(row => row.path).sort()); } } };
}

export function assertIndependentStabilityBranch(cp, capture, originalRoot, failurePolicy, historySha256) {
  const reference = { proofFile: 'history-manifest.json', proofSha256: historySha256, rootCommandCount: 918, priorFailureCommandCount: 1222 };
  assert(digest(historySha256)); assert.deepEqual(cp.independentBranch, reference); assert.deepEqual(capture.provenance.independentBranch, reference);
  for (const key of ['continuation', 'stabilityContinuation']) { assert.equal(cp[key], undefined); assert.equal(capture.provenance[key], undefined); }
  assert.equal(cp.initialStateSha256, originalRoot.finalStateSha256); assert.equal(cp.prefixCount, 918);
  assert.equal(capture.provenance.kind, 'EXACT_ORIGINAL_PREDECLARE918_STABILITY_FIRST_BRANCH');
  assert.equal(failurePolicy.id, 'RED_PRIEST1137_STABLE_POSTWAR_CONTINUATION_V1');
  assert.deepEqual(cp.policyDefinition, { ...failurePolicy, id: 'RED_PRIEST918_STABILITY_FROM_FIRST_COMPOUND_V1' });
  assert.deepEqual(cp.policy.materialCycle, stabilityMaterialCycle(cp.commands, 0));
  return reference;
}

export function assertStoryFreeze(before, after, changes) {
  assertFreeze(before, before); assertFreeze(after, after);
  assert.deepEqual(before.files.map(row => row.file), after.files.map(row => row.file));
  assert.deepEqual(changes.map(row => row.file), STORY_CHANGED_FILES);
  const changed = [];
  for (const [i, row] of before.files.entries()) {
    const next = after.files[i], change = changes.find(item => item.file === row.file);
    if (row.bytes !== next.bytes || row.sha256 !== next.sha256) changed.push(row.file);
    if (change) {
      assert.deepEqual(Object.keys(change).sort(), ['after', 'before', 'file']);
      assert.deepEqual(change.before, { bytes: row.bytes, sha256: row.sha256 });
      assert.deepEqual(change.after, { bytes: next.bytes, sha256: next.sha256 });
    }
  }
  assert.deepEqual(changed.sort(), [...STORY_CHANGED_FILES].sort(), 'Exactly three projection files change; producer and all mechanics stay byte-identical');
}
export function assertStoryReplayRows(proof, rows) {
  assert.equal(proof.format, 'RED_PRIEST1051_STORY_TRANSITION_V1');
  assert.deepEqual(proof.allowedPublicChanges, STORY_PUBLIC_CHANGES);
  assert.equal(proof.replay.commands, 133); assert.equal(proof.replay.first, 919); assert.equal(proof.replay.last, 1051);
  assert.equal(rows.length, 133); assert.equal(proof.replay.rows.length, 133);
  assert.equal(proof.replay.allPrivateAndRngEqual, true); assert.equal(proof.replay.allOtherPublicFieldsEqual, true);
  for (const [i, check] of proof.replay.rows.entries()) {
    const row = rows[i]; assert.equal(row.commandCount, 919 + i); assert.equal(check.commandCount, row.commandCount);
    assert.equal(check.commandSha256, row.commandSha256);
    assert.equal(check.beforeStateSha256, row.beforeStateSha256); assert.equal(check.stateSha256, row.afterStateSha256);
    assert.deepEqual(check.randomBefore, row.randomBefore); assert.deepEqual(check.random, row.randomAfter);
    assert.equal(check.capturedPublicBeforeSha256, row.publicBeforeSha256); assert.equal(check.capturedPublicSha256, row.publicAfterSha256);
    assert(digest(check.publicBeforeSha256) && digest(check.publicSha256));
    for (const key of ['originalStoryBefore', 'originalStoryAfter', 'currentStoryBefore', 'currentStoryAfter']) assert.equal(typeof check[key], 'string');
    assert.equal(check.privateAndRngEqual, true); assert.equal(check.allOtherPublicFieldsEqual, true);
    assert.equal(check.originalStoryBefore !== check.currentStoryBefore, check.commandCount >= 1048, 'Only the four post-opening predecessor stories change');
    assert.equal(check.originalStoryAfter !== check.currentStoryAfter, check.commandCount >= 1047, 'Only the five actual epilogue result stories change');
    if (check.originalStoryBefore === check.currentStoryBefore) assert.equal(check.publicBeforeSha256, row.publicBeforeSha256);
    if (check.originalStoryAfter === check.currentStoryAfter) assert.equal(check.publicSha256, row.publicAfterSha256);
    if (i) {
      const previous = proof.replay.rows[i - 1]; assert.equal(check.publicBeforeSha256, previous.publicSha256);
      assert.equal(check.originalStoryBefore, previous.originalStoryAfter); assert.equal(check.currentStoryBefore, previous.currentStoryAfter);
    }
  }
}
export function assertStoryPublicBoundary(view, check, side) {
  assert(['before', 'after'].includes(side)); const before = side === 'before';
  assert.equal(view.story, check[before ? 'currentStoryBefore' : 'currentStoryAfter']);
  assert.equal(stateHash(view), check[before ? 'publicBeforeSha256' : 'publicSha256']);
  const original = { ...view, story: check[before ? 'originalStoryBefore' : 'originalStoryAfter'] };
  assert.equal(stateHash(original), check[before ? 'capturedPublicBeforeSha256' : 'capturedPublicSha256'], 'Replacing only the reviewed exact story must restore the complete original public hash');
}
function assertFinalUiTravel(action, snapshotCommandCount) {
  if (![1022, 1023, 1024].includes(snapshotCommandCount)) { assert.equal(action, null); return; }
  assert(action && /^red-priest-action-[1-9][0-9]*$/.test(action.id));
  const enabled = snapshotCommandCount === 1024;
  assert.deepEqual(action, { id: action.id, command: { type: 'TRAVEL', to: 'eastern-stores' }, label: '前往东南粮仓地',
    cost: '1行动；沿已行经大陆路线逐周结算旅费、生活费与旧还款', enabled, reason: enabled ? null : '实际行动、费用或灵性不足。' });
}
export function assertFinalUiReplayRows(proof, rows, priorStory) {
  assertStoryReplayRows(priorStory, rows);
  assert.equal(proof.format, 'RED_PRIEST1051_FINAL_UI_TRANSITION_V1'); assert.deepEqual(proof.allowedPublicChanges, FINAL_UI_PUBLIC_CHANGES);
  assert.equal(proof.replay.commands, 133); assert.equal(proof.replay.first, 919); assert.equal(proof.replay.last, 1051); assert.equal(proof.replay.rows.length, 133);
  for (const key of ['allPrivateAndRngEqual', 'allOtherPublicFieldsEqual', 'exactPlayerTextRelation']) assert.equal(proof.replay[key], true);
  assert.equal(proof.replay.appendedTravelChecks, 3);
  for (const [i, check] of proof.replay.rows.entries()) {
    const old = priorStory.replay.rows[i];
    for (const key of ['commandCount', 'commandSha256', 'beforeStateSha256', 'stateSha256', 'randomBefore', 'random', 'capturedPublicBeforeSha256', 'capturedPublicSha256',
      'originalStoryBefore', 'originalStoryAfter', 'currentStoryBefore', 'currentStoryAfter', 'privateAndRngEqual', 'allOtherPublicFieldsEqual']) assert.deepEqual(check[key], old[key]);
    assert.equal(check.priorRuntimePublicBeforeSha256, old.publicBeforeSha256); assert.equal(check.priorRuntimePublicSha256, old.publicSha256);
    assertFinalUiTravel(check.appendedTravelBefore, check.commandCount - 1); assertFinalUiTravel(check.appendedTravelAfter, check.commandCount);
    for (const key of ['publicBeforeSha256', 'publicSha256', 'publicSliceBeforeSha256', 'publicSliceSha256', 'playerChapterBeforeSha256', 'playerChapterSha256']) assert(digest(check[key]));
    assert.equal(check.exactPlayerTextRelation, true);
    if (check.appendedTravelBefore === null) assert.equal(check.publicBeforeSha256, old.publicBeforeSha256);
    if (check.appendedTravelAfter === null) assert.equal(check.publicSha256, old.publicSha256);
    if (i) {
      const previous = proof.replay.rows[i - 1];
      assert.equal(check.publicBeforeSha256, previous.publicSha256); assert.equal(check.publicSliceBeforeSha256, previous.publicSliceSha256);
      assert.equal(check.playerChapterBeforeSha256, previous.playerChapterSha256);
    }
  }
}
export function assertFinalUiPublicBoundary(view, playerSlice, check, side) {
  assert(['before', 'after'].includes(side)); const before = side === 'before';
  assert.equal(stateHash(view), check[before ? 'publicBeforeSha256' : 'publicSha256']);
  assert.equal(stateHash(playerSlice), check[before ? 'publicSliceBeforeSha256' : 'publicSliceSha256']);
  assert.equal(stateHash(playerSlice.redPriest), check[before ? 'playerChapterBeforeSha256' : 'playerChapterSha256']);
  const action = check[before ? 'appendedTravelBefore' : 'appendedTravelAfter']; assertFinalUiTravel(action, check.commandCount - Number(before));
  const prior = structuredClone(view);
  if (action !== null) {
    assert.equal(action.id, `red-priest-action-${view.actions.length}`); assert.deepEqual(prior.actions.at(-1), action);
    assert.equal(prior.actions.filter(item => item.command.type === 'TRAVEL' && item.command.to === 'eastern-stores').length, 1);
    prior.actions.pop();
  }
  assert.equal(stateHash(prior), check[before ? 'priorRuntimePublicBeforeSha256' : 'priorRuntimePublicSha256'], 'Removing only the reviewed trailing travel action restores the complete sealed story-only public hash');
  assertStoryPublicBoundary(prior, { ...check, publicBeforeSha256: check.priorRuntimePublicBeforeSha256, publicSha256: check.priorRuntimePublicSha256 }, side);
}

function readStoryEquivalence(repo, root, options, data, capturedFreeze, currentFreeze, inputs) {
  assert(options.plannedFork && data.planned?.independentBranch, 'Story correction applies only to the sealed independent1051 branch');
  assert(digest(STORY_EQUIVALENCE_SHA), 'Completed133 proof must be reviewed before this candidate may run');
  assert.equal(options.storyEquivalenceSha256, STORY_EQUIVALENCE_SHA);
  assert(digest(options.runtimeFreezeSha256)); assert.equal(currentFreeze.sha256, options.runtimeFreezeSha256);
  const extras = [], checked = path => { const result = evidence(regular(resolve(path))); extras.push({ path: resolve(path), ...result }); return result; };
  const resolveArtifact = artifactResolver(repo, options, checked), priorStoryPath = regular(resolve(options.storyEquivalenceProof));
  assert.equal(checked(priorStoryPath).sha256, STORY_EQUIVALENCE_SHA); const priorStory = json(priorStoryPath), finalUi = Boolean(options.finalUiEquivalenceProof);
  const expectedSha256 = finalUi ? FINAL_UI_EQUIVALENCE_SHA : STORY_EQUIVALENCE_SHA;
  if (finalUi) { assert(digest(FINAL_UI_EQUIVALENCE_SHA)); assert.equal(options.finalUiEquivalenceSha256, FINAL_UI_EQUIVALENCE_SHA); }
  const path = finalUi ? regular(resolve(options.finalUiEquivalenceProof)) : priorStoryPath;
  assert.equal(checked(path).sha256, expectedSha256); const proof = finalUi ? json(path) : priorStory, { cp, rows } = data;
  if (finalUi) {
    assertFinalUiReplayRows(proof, rows, priorStory);
    assert.deepEqual(proof.priorStoryProof, { proofFile: proof.priorStoryProof.proofFile, proofSha256: STORY_EQUIVALENCE_SHA });
    resolveArtifact('ARTIFACT', proof.priorStoryProof.proofFile, evidence(priorStoryPath));
    assert.equal(priorStory.currentRuntimeFreeze.sha256, 'a200ea4d82db1aa9d96512a699dad098892e503637e22aa3d740e069b7c192a5');
    for (const row of priorStory.inputFiles) resolveArtifact('ARTIFACT', row.path, row);
    for (const row of priorStory.currentRuntimeFreeze.files) resolveArtifact('FROZEN_RUNTIME', row.file, row);
  } else assertStoryReplayRows(proof, rows);
  assertStoryFreeze(capturedFreeze, currentFreeze, proof.changedFiles);
  assert.equal(proof.commandCount, 1051); assert.equal(proof.exactSourceEditVerified, true);
  assert.equal(proof.publicProjectionPath, 'redPriest'); assert.deepEqual(proof.publicFieldPaths, finalUi ? ['story', 'actions[last]'] : ['story']);
  assert.deepEqual(proof.allowedChanges, STORY_CHANGED_FILES); assert.deepEqual(proof.replay.allowedPublicChanges, finalUi ? FINAL_UI_PUBLIC_CHANGES : STORY_PUBLIC_CHANGES);
  assert.equal(proof.replay.storyChangedChecks, 5);
  for (const check of proof.replay.rows) { assert.equal(check.enabledOriginalAction, true); assert.equal(check.storyChangedBefore, check.commandCount >= 1048); assert.equal(check.storyChangedAfter, check.commandCount >= 1047); }
  const withoutProducer = freeze => { const files = freeze.files.filter(row => row.file !== '$natural-producer'); return { files, sha256: compactHash(files) }; };
  assertFreeze(proof.originalRuntimeFreeze, withoutProducer(capturedFreeze)); assertFreeze(proof.currentRuntimeFreeze, withoutProducer(currentFreeze));
  assert.equal(proof.originalCapture.freezeSha256, capturedFreeze.sha256);
  assert.deepEqual(proof.originalCapture.files7, inputs.map(({ file, ...row }) => ({ path: file, ...row })));
  const source = proof.source1051, checkpoint = evidence(join(root, 'checkpoint.json'));
  assert.equal(source.commandCount, 1051); assert.equal(source.checkpointPayloadSha256, json(join(root, 'checkpoint.json')).sha256);
  assert.deepEqual(source.checkpoint, checkpoint); resolveArtifact('ARTIFACT', source.checkpointFile, checkpoint);
  assert.equal(source.stateSha256, cp.finalStateSha256); assert.equal(source.publicSha256, cp.publicStateSha256); assert.deepEqual(source.random, cp.state.random);
  assert.equal(proof.stateSha256, cp.finalStateSha256); assert.equal(proof.originalPublicSha256, cp.publicStateSha256);
  assert.equal(proof.continuedPublicSha256, proof.replay.rows.at(-1).publicSha256); assert.deepEqual(proof.random, cp.state.random);
  assert.equal(proof.replay.rows[0].publicBeforeSha256, cp.initialPublicStateSha256, 'Pre-declaration918 public boundary remains unchanged');
  for (const key of ['strictFinalValidation', 'originalInputsUnchanged', 'productionUnchangedDuringReplay']) assert.equal(proof[key], true);
  assert.equal(proof.inputStartSha256, stateHash(proof.inputFiles)); assert.equal(proof.inputEndSha256, proof.inputStartSha256);
  assert.equal(proof.currentRuntimeEndSha256, proof.currentRuntimeFreeze.sha256);
  assert.equal(proof.inputFiles.filter(row => row.sha256 === proof.scriptSha256).length, 1);
  assert.equal(proof.inputFiles.filter(row => row.sha256 === proof.normalizerSha256).length, 1);
  for (const row of proof.inputFiles) resolveArtifact('ARTIFACT', row.path, row);
  for (const row of capturedFreeze.files) resolveArtifact('FROZEN_RUNTIME', row.file, row);
  const negative = proof.normalizerNegativeTests;
  assert.equal(negative.positiveControlPassed, true); assert.equal(negative.noAdditionalReplay, true);
  assert.equal(negative.commandCount, 1047); assert.equal(negative.rejectedMutations, 11);
  const observed = proof.replay.rows[1047 - 919];
  assert.equal(negative.observedStateSha256, observed.stateSha256); assert.equal(negative.observedPublicSha256, observed.publicSha256);
  assert.equal(negative.capturedPublicSha256, observed.capturedPublicSha256);
  assert.deepEqual(negative.checks, ['missing-story', 'wrong-story-text', 'stale-original-story', 'extra-story-copy',
    'changed-original-resource', 'changed-original-action-cost', 'missing-original-section', 'changed-seed', 'changed-rng-cursor',
    'under-normalization-full-public-hash-rejection', 'over-normalization-full-public-hash-rejection'].map(name => ({ name, rejected: true })));
  if (finalUi) {
    const travel = proof.travelNegativeTests, eligible = proof.replay.rows[1022 - 919];
    assert.equal(travel.commandCount, 1022); assert.equal(travel.positiveControlPassed, true); assert.equal(travel.noAdditionalReplay, true); assert.equal(travel.rejectedMutations, 15);
    assert.equal(travel.observedStateSha256, eligible.stateSha256); assert.equal(travel.observedPublicSha256, eligible.publicSha256); assert.equal(travel.capturedPublicSha256, eligible.capturedPublicSha256);
    assert.deepEqual(travel.checks, ['missing-travel', 'duplicate-travel', 'wrong-travel-target', 'wrong-travel-label', 'wrong-travel-cost', 'renumbered-travel', 'wrong-travel-enabled',
      'wrong-travel-reason', 'extra-preferred-action', 'reordered-original-actions', 'changed-original-resource', 'renumbered-original-action', 'changed-seed',
      'under-normalization-full-public-hash-rejection', 'over-normalization-full-public-hash-rejection'].map(name => ({ name, rejected: true })));
    assert.deepEqual(proof.ineligibleTravelNegativeTests, { commandCount: 918, observedStateSha256: cp.initialStateSha256, observedPublicSha256: cp.initialPublicStateSha256,
      capturedPublicSha256: cp.initialPublicStateSha256, positiveControlPassed: true, noAdditionalReplay: true, rejectedMutations: 1,
      checks: [{ name: 'injected-travel-outside-exact-availability', rejected: true }] });
    assert.equal(proof.publicSliceSha256, proof.replay.rows.at(-1).publicSliceSha256); assert.equal(proof.playerChapterSha256, proof.replay.rows.at(-1).playerChapterSha256);
  }
  return { proof, finalUi, manifest: { path, sha256: expectedSha256, captureFreezeSha256: capturedFreeze.sha256, runtimeFreezeSha256: currentFreeze.sha256,
    originalPublicSha256: proof.originalPublicSha256, continuedPublicSha256: proof.continuedPublicSha256,
    commands: 133, first: 919, last: 1051, allowedPublicChanges: finalUi ? FINAL_UI_PUBLIC_CHANGES : STORY_PUBLIC_CHANGES, changedFiles: proof.changedFiles,
    ...(finalUi ? { priorStoryProof: proof.priorStoryProof, travelNegativeTests: proof.travelNegativeTests, ineligibleTravelNegativeTests: proof.ineligibleTravelNegativeTests, publicSliceSha256: proof.publicSliceSha256, playerChapterSha256: proof.playerChapterSha256 } : {}),
    normalizerNegativeTests: negative, inputs: extras }, unchanged: () => { for (const row of extras) assert.deepEqual(evidence(row.path), { bytes: row.bytes, sha256: row.sha256 }); } };
}

export function assertRedPriestProjectionPair(authored, playerSlice, playerName, projectPlayerText) {
  const before = stateHash(authored);
  assert.deepEqual(playerSlice.redPriest, projectPlayerText({ redPriest: authored }, playerName).redPriest,
    'Full player-facing chapter must equal the exact frozen display-copy adapter of the captured authored chapter');
  assert.equal(stateHash(authored), before, 'Display-copy verification cannot mutate the authored projection');
}
export function assertPlannedInitialProjection(authored, playerSlice, rootPublicSha256, capturedInitialSha256, playerName, projectPlayerText) {
  assert.equal(stateHash(authored), capturedInitialSha256, 'Initial authored projection must match actual row919.publicBefore');
  assert.equal(stateHash(restoreBeforePlanning(authored)), rootPublicSha256, 'Only exact ENABLE opt-in separates the original918 public root');
  assertRedPriestProjectionPair(authored, playerSlice, playerName, projectPlayerText);
}

export function completedRedPriestSqliteCase(index, current, planned) {
  if (current.case === undefined) return index.results.find(row => row.commandCount === current.commandCount);
  assert(planned); assert.equal(current.case, 'original983-withdrawal'); assert.equal(current.commandCount, 983);
  return index.original983;
}
async function verifyOriginal983Sqlite(runtime, DatabaseSync, work, planned, completed, phase) {
  assert.equal(planned.legacyRows.length, 9); assert.equal(planned.legacyProjectionRows.length, 9);
  let state = structuredClone(planned.legacyStart), session = runtime.openRedPriestRuntimeSession(state), publicState = session.project(), view = session.projectRedPriest();
  assertRedPriestProjectionPair(view, publicState, state.character.name, runtime.projectPlayerText);
  assert.equal(state.revision, 975); assert.equal(stateHash(view), planned.legacyInitialPublicSha256);
  for (const [i, row] of planned.legacyRows.entries()) {
    const before = state, publicBefore = publicState, expected = planned.legacyProjectionRows[i];
    assert.equal(row.commandCount, 975 + i); assert.equal(stateHash(before), row.beforeStateSha256); assert.deepEqual(before.random, row.randomBefore);
    assert.equal(stateHash(view), expected.publicBeforeSha256);
    assertRedPriestProjectionPair(view, publicBefore, before.character.name, runtime.projectPlayerText);
    const offered = view.actions.find(action => stable(action.command) === stable(row.intent.command)); assert(offered?.enabled); assert.equal(offered.label, row.publicLabel);
    const draft = session.prepare(row.intent, before.revision); state = session.snapshotDraft(draft); publicState = session.projectDraft(draft); view = session.projectDraftRedPriest(draft); session.commit(draft);
    assert.equal(stateHash(before), row.beforeStateSha256); assert.equal(stateHash(state), row.afterStateSha256); assert.deepEqual(state.random, row.randomAfter);
    assert.equal(stateHash(view), expected.publicSha256);
    assertRedPriestProjectionPair(view, publicState, state.character.name, runtime.projectPlayerText);
    if (row.commandCount === 983) {
      assert.deepEqual(row.intent, { type: 'RED_PRIEST', command: { type: 'CAMPAIGN', command: { type: 'WITHDRAW_PROTECT' } } });
      const boundary = { commandCount: 983, names: ['original983:actual-protective-withdrawal'] };
      if (completed) {
        assert.equal(completed.beforeStateSha256, row.beforeStateSha256); assert.equal(completed.stateSha256, row.afterStateSha256);
        assert.equal(completed.publicStateSha256, stateHash(publicState)); assert.equal(completed.authoredPublicChapterSha256, stateHash(view)); assert.equal(completed.playerPublicChapterSha256, stateHash(publicState.redPriest)); assert.deepEqual(completed.random, row.randomAfter);
        assert.equal(completed.revision, state.revision); assert.equal(completed.status, state.status); return completed;
      }
      return checkSqlite(runtime, DatabaseSync, work, boundary, before, state, row.intent, publicBefore, publicState, phase, view);
    }
  }
  assert.fail('Original983 actual withdrawal transition is required');
}

export async function verifyRedPriestCapture(options) {
  const started = performance.now(), repo = directory(process.cwd()), root = directory(options.sourceDirectory);
  const basePrefix = options.plannedFork ? 918 : PREFIX, producer = options.plannedFork
    ? (json(regular(join(root, 'checkpoint.json'))).payload.independentBranch ? STABILITY_FIRST_PRODUCER : json(regular(join(root, 'checkpoint.json'))).payload.stabilityContinuation ? STABILITY_PRODUCER : json(regular(join(root, 'checkpoint.json'))).payload.continuation ? 'scripts/play/red-priest-planned-continue.mjs' : PLANNED_PRODUCER) : PRODUCER;
  const inputNamesFor = options.plannedFork ? plannedInputNames : captureInputNames;
  assert(digest(options.freezeSha256) && digest(options.verifierSha256), 'Reviewed --freeze-sha256 and --verifier-sha256 required');
  assert.equal(evidence(SELF).sha256, options.verifierSha256); const freeze = json(regular(join(root, 'freeze.json')));
  assert.equal(freeze.sha256, options.freezeSha256); const currentFreeze = inspectFreeze(repo, producer);
  if (options.storyEquivalenceProof) { assert(digest(options.runtimeFreezeSha256)); assert.equal(currentFreeze.sha256, options.runtimeFreezeSha256); }
  else { assert.equal(options.storyEquivalenceSha256, undefined); assert.equal(options.runtimeFreezeSha256, undefined); assertFreeze(freeze, currentFreeze); }
  const inputNames = inputNamesFor(root);
  const inputs = inputNames.map(file => ({ file, ...evidence(join(root, file)) }));
  const data = options.plannedFork ? (json(join(root, 'checkpoint.json')).payload.independentBranch ? readIndependentStabilityCapture(root, repo, freeze, options) : readPlannedCapture(root, repo, freeze, options)) : readCapture(root, repo, freeze);
  const { old, capture, cp, rows, selected, coverage, planned } = data, continuation = planned ? null : readContinuation(root, freeze, data);
  const story = options.storyEquivalenceProof ? readStoryEquivalence(repo, root, options, data, freeze, currentFreeze, inputs) : null;
  const projectionFiles = ['src/shared/player-text.ts', 'src/shared/player-text-copy.ts', 'dist/shared/player-text.js', 'dist/shared/player-text.js.map', 'dist/shared/player-text-copy.js', 'dist/shared/player-text-copy.js.map']
    .map(file => { const row = currentFreeze.files.find(row => row.file === file); assert(row); assert.deepEqual(row, freeze.files.find(row => row.file === file)); return row; });
  const projectionContracts = { capture: 'OWNED_AUTHORED_RED_PRIEST_PROJECTION', persistence: 'COMPLETE_PLAYER_FACING_SLICE_PROJECTION',
    relation: 'EXACT_FROZEN_PROJECT_PLAYER_TEXT_WITH_ORIGINAL_PLAYER_NAME', files: projectionFiles };
  if (story?.finalUi) assert.deepEqual(story.proof.projectionContracts, projectionContracts);
  const manifest = { kind: FORMAT, sourceDirectory: root, source: { file: SOURCE, ...evidence(join(repo, SOURCE)) }, prefixCommandsSha256: planned ? cp.prefixSha256 : PREFIX_SHA,
    freeze, projectionContracts, ...(story ? { runtimeFreeze: currentFreeze, storyTransition: story.manifest } : {}), verifier: evidence(SELF), inputs, continuation, ...(planned ? { planned: planned.manifest } : {}), selected, coverage, node: process.version };
  const manifestSha256 = stateHash(manifest);
  const unchanged = () => { assert.deepEqual(inputNamesFor(root), inputNames); planned?.unchanged(); story?.unchanged(); for (const row of inputs) assert.deepEqual(evidence(join(root, row.file)), { bytes: row.bytes, sha256: row.sha256 }); assertFreeze(currentFreeze, inspectFreeze(repo, producer)); assert.equal(evidence(SELF).sha256, options.verifierSha256); };
  if (options.preflight) return { preflight: 'PASSED_NO_RUNTIME_NO_SQLITE_NO_WRITES', manifestSha256, originalCommands: basePrefix, newCommands: rows.length, continuation, projectionContracts, ...(planned ? { planned: planned.manifest } : {}), ...(story ? { storyTransition: story.manifest } : {}), selected, coverage };
  const out = resolve(options.resumeDirectory ?? options.outputDirectory ?? ''); assert(options.resumeDirectory || options.outputDirectory, 'Explicit output directory required');
  assert(contains(join(repo, 'output'), out) && !contains(root, out) && !contains(out, root), 'Audit output must be separate inside repository output/');
  assert(!options.resumeDirectory || existsSync(out), 'Resume directory must already exist');
  if (!existsSync(out)) { let p = dirname(out); while (!existsSync(p)) p = dirname(p); directory(p); mkdirSync(out, { recursive: true }); }
  directory(out); if (!options.resumeDirectory) assert.equal(readdirSync(out).length, 0, 'Existing audit requires --resume-directory');
  const manifestPath = join(out, 'manifest.json'), indexPath = join(out, 'completed.json'), phasePath = join(out, 'current-phase.json'), work = join(out, 'current-sqlite');
  if (options.resumeDirectory) assertResumeManifest(json(regular(manifestPath)), manifest);
  const release = lock(out, manifestSha256, options.removeStaleLockPid); let index = { manifestSha256, results: [] }, current = null;
  try {
    for (const name of ['manifest.json.next', 'completed.json.next', 'current-phase.json.next', 'summary.json.next']) assert(!existsSync(join(out, name)), 'Unknown interrupted atomic update; preserve and inspect');
    if (existsSync(manifestPath)) assertResumeManifest(json(regular(manifestPath)), manifest); else { assert(!options.resumeDirectory); atomic(manifestPath, manifest); }
    if (existsSync(indexPath)) index = json(regular(indexPath)); else { assert(!options.resumeDirectory); atomic(indexPath, index); }
    assert.equal(index.manifestSha256, manifestSha256); assert(index.results.length <= selected.length);
    if (!planned) assert.equal(index.original983, undefined);
    for (const [i, result] of index.results.entries()) {
      const row = rows[selected[i].commandCount - basePrefix - 1]; assert.equal(result.commandCount, selected[i].commandCount); assert.deepEqual(result.names, selected[i].names);
      assert.equal(result.beforeStateSha256, row.beforeStateSha256); assert.equal(result.stateSha256, row.afterStateSha256); assert.deepEqual(result.random, row.randomAfter); assert.deepEqual(result.checks, CHECKS);
    }
    if (existsSync(phasePath)) current = json(regular(phasePath));
    if (current) { assert.equal(current.manifestSha256, manifestSha256);
      const completed = completedRedPriestSqliteCase(index, current, Boolean(planned));
      assert(completed, 'UNKNOWN_INTERRUPTION: current SQLite case has no durable completed result; retain evidence for main/operator inspection'); cleanCase(work, completed); atomic(phasePath, null); current = null;
    } else assert(!existsSync(work), 'Unknown unindexed database must be inspected');
    const [slice, migration, owned, store, playerText, sqlite] = await Promise.all(['dist/domain/slice/index.js', 'dist/domain/slice/migration.js', 'dist/domain/red-priest/owned-session.js', 'dist/persistence/slice-store.js', 'dist/shared/player-text.js']
      .map(file => import(pathToFileURL(join(repo, file)).href)).concat(import('node:sqlite')));
    const runtime = { ...slice, ...migration, ...owned, ...store, ...playerText }, restoration = continuation?.transition?.commandCount === 974 ? continuation.transition : null;
    const logistics = (restoration ? continuation.nested : continuation)?.transition ?? null; let logisticsProjectionChecks = 0, recoveryProjectionChecks = 0;
    const priorRuntime = (view, count = true) => { const previous = restoration ? restoreBeforeRestoration(view) : view;
      if (count && restoration) recoveryProjectionChecks += Number(previous.actions.length !== view.actions.length) + Number(previous.sections.length !== view.sections.length); return previous; };
    const beforeLogistics = view => { const previous = restoreBeforeLogistics(view); if (previous.actions.length !== view.actions.length) logisticsProjectionChecks++; return previous; };
    const capturedPublic = (view, commandCount) => { const previous = restoration && commandCount <= 974 ? priorRuntime(view) : view; return logistics && commandCount <= 941 ? beforeLogistics(previous) : previous; };
    let state = planned ? structuredClone(planned.root.state) : runtime.migrateSliceState(old.final), session = planned ? runtime.openRedPriestRuntimeSession(planned.root.state) : null;
    if (!planned) for (const [key, value] of Object.entries(old.final)) if (!['schemaVersion', 'contentVersion', 'redPriest', 'fool'].includes(key)) assert.deepEqual(state[key], value);
    runtime.assertValidSliceState(state); assert.equal(stateHash(state), cp.initialStateSha256); let publicState = session ? session.project() : runtime.projectSliceState(state), view = session ? session.projectRedPriest() : publicState.redPriest;
    if (planned) assertPlannedInitialProjection(view, publicState, planned.root.publicStateSha256, cp.initialPublicStateSha256, state.character.name, runtime.projectPlayerText);
    for (const row of rows) {
      const before = state, publicBefore = publicState; if (session) assertRedPriestProjectionPair(view, publicBefore, before.character.name, runtime.projectPlayerText); assert.equal(before.status, 'ACTIVE'); assert(runtime.validateSlicePayload(row.intent));
      assert.equal(stateHash(before), row.beforeStateSha256); assert.deepEqual(before.random, row.randomBefore);
      const historical = logistics && row.commandCount <= 941, recovery = restoration && row.commandCount <= 974;
      const stabilityCheck = planned?.stabilityEquivalence && row.commandCount <= 1137 ? planned.stabilityEquivalence.proof.replay.rows[row.commandCount - 919] : null;
      const storyCheck = story?.proof.replay.rows[row.commandCount - 919];
      if (story?.finalUi) assertFinalUiPublicBoundary(view, publicBefore, storyCheck, 'before');
      else if (storyCheck) assertStoryPublicBoundary(view, storyCheck, 'before');
      else assert.equal(stateHash(capturedPublic(view, row.commandCount)), stabilityCheck?.publicBeforeSha256 ?? row.publicBeforeSha256);
      if (row.commandCount > 796) {
        if (recovery) assert.equal(stateHash(view), restoration.replay.rows[row.commandCount - PREFIX - 2].publicSha256);
        if (historical) assert.equal(stateHash(priorRuntime(view, false)), logistics.replay.rows[row.commandCount - PREFIX - 2].publicSha256);
      }
      const action = view.actions.find(a => stable(a.command) === stable(row.intent.command)); assert(action?.enabled); assert.equal(action.label, row.publicLabel);
      let publicAfter;
      if (session) { const draft = session.prepare(row.intent, before.revision); state = session.snapshotDraft(draft); view = session.projectDraftRedPriest(draft); publicAfter = session.projectDraft(draft); session.commit(draft); }
      else { assert.deepEqual(row.intent.command, { type: 'LEARN_GUIDANCE' }); state = runtime.applySliceIntent(before, row.intent); session = runtime.openRedPriestRuntimeSession(state); view = session.projectRedPriest(); publicAfter = session.project(); }
      assert.equal(stateHash(before), row.beforeStateSha256, 'Replay cannot mutate predecessor'); assert.equal(stateHash(state), row.afterStateSha256);
      assert.equal(state.revision, row.revision); assert.deepEqual(state.random, row.randomAfter);
      if (story?.finalUi) assertFinalUiPublicBoundary(view, publicAfter, storyCheck, 'after');
      else if (storyCheck) assertStoryPublicBoundary(view, storyCheck, 'after');
      else assert.equal(stateHash(capturedPublic(view, row.commandCount)), stabilityCheck?.publicSha256 ?? row.publicAfterSha256);
      if (historical) assert.equal(stateHash(priorRuntime(view)), logistics.replay.rows[row.commandCount - PREFIX - 1].publicSha256);
      if (recovery) { const check = restoration.replay.rows[row.commandCount - PREFIX - 1]; assert.equal(stateHash(view), check.publicSha256); assert.equal(stateHash(priorRuntime(view)), check.priorRuntimePublicSha256); }
      if (historical && row.commandCount === 941) { assert.equal(stateHash(beforeLogistics(priorRuntime(view, false))), PUBLIC_941_OLD); assert.equal(logisticsProjectionChecks, logistics.replay.addedProjectionChecks); }
      if (recovery && row.commandCount === 974) { assert.equal(stateHash(priorRuntime(view)), PUBLIC_974_OLD); assert.equal(recoveryProjectionChecks, restoration.replay.addedProjectionChecks); }
      assertRedPriestProjectionPair(view, publicAfter, state.character.name, runtime.projectPlayerText); publicState = publicAfter;
      const boundary = selected.find(item => item.commandCount === row.commandCount);
      if (boundary) {
        const done = index.results.find(item => item.commandCount === row.commandCount);
        if (done) { assert.equal(done.publicStateSha256, stateHash(publicAfter)); assert.equal(done.authoredPublicChapterSha256, stateHash(view)); assert.equal(done.playerPublicChapterSha256, stateHash(publicAfter.redPriest)); assert.equal(done.status, state.status); assert.equal(done.revision, state.revision); }
        else {
          const phase = name => { current = { manifestSha256, commandCount: row.commandCount, phase: name }; atomic(phasePath, current); };
          phase('SELECTED_REAL_TRANSITION'); const result = checkSqlite(runtime, sqlite.DatabaseSync, work, boundary, before, state, row.intent, publicBefore, publicAfter, phase, view);
          index.results.push(result); atomic(indexPath, index); cleanCase(work, result); atomic(phasePath, null); current = null;
        }
      }
      global.gc?.();
    }
    assert.equal(index.results.length, selected.length);
    if (planned) {
      if (index.original983) {
        assert.equal(index.original983.commandCount, 983); assert.deepEqual(index.original983.names, ['original983:actual-protective-withdrawal']);
        assert.deepEqual(index.original983.checks, CHECKS);
      }
      const completed = await verifyOriginal983Sqlite(runtime, sqlite.DatabaseSync, work, planned, index.original983, name => {
        current = { manifestSha256, commandCount: 983, case: 'original983-withdrawal', phase: name }; atomic(phasePath, current);
      });
      if (!index.original983) { index.original983 = completed; atomic(indexPath, index); cleanCase(work, completed); atomic(phasePath, null); current = null; }
    }
    assert.equal(stateHash(state), cp.finalStateSha256); assert.equal(stateHash(state), stateHash(capture.final));
    runtime.assertValidSliceState(state); const strict = runtime.openRedPriestRuntimeSession(state); assert.equal(stateHash(strict.snapshot()), cp.finalStateSha256); assert.equal(stateHash(strict.projectRedPriest()), story?.proof.continuedPublicSha256 ?? cp.publicStateSha256);
    assertRedPriestProjectionPair(strict.projectRedPriest(), strict.project(), state.character.name, runtime.projectPlayerText);
    if (story?.finalUi) { assert.equal(stateHash(strict.project()), story.proof.publicSliceSha256); assert.equal(stateHash(strict.project().redPriest), story.proof.playerChapterSha256); }
    assert.deepEqual(json(join(root, 'summary.json')).public, { title: view.title, promoted: view.promoted, nextStep: view.nextStep, resources: view.resources, abilities: view.abilities, sections: view.sections });
    unchanged(); const summary = { passed: true, kind: FORMAT, manifestSha256, sourceDirectory: root, originalSourceSha256: SOURCE_SHA, prefixCommandsSha256: planned ? cp.prefixSha256 : PREFIX_SHA,
      captureFreezeSha256: freeze.sha256, runtimeFreezeSha256: currentFreeze.sha256, projectionContracts, ...(story ? { storyTransition: story.manifest } : {}), verifierSha256: options.verifierSha256, inputs, continuation,
      scope: { original795CommandsRetainedExactly: true, ...(planned ? { original796Through918RetainedExactly: true, historical796Through918ReplayThisInvocation: 'NOT_RUN', original983PrivateAndRngEquivalence: 'HISTORICAL_PRE_STABILITY_PROOF_VERIFIED_NOT_A_NEW_RUNTIME_188_REPLAY', original983OutcomePreserved: 'FINITE_CAMPAIGN_WITHDRAWN' } : {}), historical795Replay: 'NOT_RUN', newTail: story?.finalUi ? 'EVERY_CAPTURED_PRIVATE_RNG_BOUNDARY_VERIFIED; CURRENT_AUTHORED_AND_COMPLETE_PLAYER_PUBLIC_MATCH_REVIEWED133_PROOF; EXACT_TRAVEL_REMOVAL_RESTORES_STORY_ONLY_HASH_THEN_EXACT_STORY_REPLACEMENT_RESTORES_CAPTURED_HASH' : story ? 'EVERY_CAPTURED_PRIVATE_RNG_BOUNDARY_VERIFIED; CURRENT_PUBLIC_MATCHES_REVIEWED133_STORY_PROOF; EXACT_STORY_REPLACEMENT_RESTORES_EVERY_COMPLETE_CAPTURED_PUBLIC_HASH' : planned?.stabilityEquivalence ? 'EVERY_LEDGER_PRIVATE_RNG_VERIFIED; ORIGINAL219_PUBLIC_HASHES_RETAINED_AND_CURRENT_PUBLIC_MATCHES_REVIEWED_PROOF; POST1137_PUBLIC_MATCHES_CAPTURE_EXACTLY' : 'EVERY_LEDGER_PRIVATE_RNG_AND_EXACT_CAPTURED_PUBLIC_BOUNDARY_VERIFIED',
        ...(planned?.stabilityEquivalence ? { stability1137Transition: { proofSha256: planned.stabilityEquivalence.sha256, originalCommandsVerified: 219, originalPrivateAndRngUnchanged: true, currentPublic: 'EVERY_PINNED_BEFORE_AND_AFTER_HASH_MATCHED', allowedPublicChanges: STABILITY_PUBLIC_CHANGES } } : {}),
        public941Transition: logistics ? { proofSha256: TRANSITION_SHA, originalCommandsVerified: 146, addedProjectionChecks: logisticsProjectionChecks, restoredOriginalPublic: 'ONLY_EXACT_APPENDED_RETURN_ACTION_REMOVED_FOR_HASH_COMPARISON', runtimePublic: 'EVERY_PINNED_PROOF_HASH_MATCHED_AFTER_EXACT_974_RESTORATION_IF_PRESENT' } : null,
        public974Transition: restoration ? { proofSha256: RESTORATION_SHA, originalCommandsVerified: 179, addedProjectionChecks: recoveryProjectionChecks, counterMeaning: 'DIAGNOSTIC_TRANSFORM_CALLS_NOT_BOUNDARY_COVERAGE', restoredOriginalPublic: 'ONLY_EXACT_RECOVERY_SUFFIX_AND_READINESS_SECTION_REMOVED_THEN_HISTORICAL_941_RETURN_SEAM', currentAndPriorRuntimePublic: 'EVERY_PINNED_PROOF_HASH_MATCHED' } : null,
        newCommandsReplayedThisInvocation: rows.length, sqlite: 'SELECTED_UNIQUE_ACTUAL_TRANSITIONS_ONLY', allCommandSqlite: false, syntheticDeath: 'NOT_RUN', desktop: 'NOT_RUN' },
      ...(planned ? { planned: planned.manifest } : {}),
      originalCommands: basePrefix, newCommands: rows.length, finalCommandCount: capture.commands.length, captureStage: capture.stage,
      selectedNames: selected.reduce((n, r) => n + r.names.length, 0), sqliteTransitionsVerified: index.results.length, coverage, results: index.results,
      ...(planned ? { original983SqliteTransitionsVerified: 1, original983Sqlite: index.original983 } : {}),
      final: { status: state.status, revision: state.revision, random: state.random, stateSha256: cp.finalStateSha256, publicChapterSha256: story?.proof.continuedPublicSha256 ?? cp.publicStateSha256, ...(story ? { capturedPublicChapterSha256: cp.publicStateSha256 } : {}), publicStateSha256: stateHash(strict.project()) },
      elapsedMilliseconds: Math.round(performance.now() - started) };
    atomic(join(out, 'summary.json'), summary); return summary;
  } catch (error) {
    try { atomic(join(out, 'summary.json'), { passed: false, kind: FORMAT, manifestSha256, completedTransactions: index.results.length, completedOriginal983Transactions: index.original983 ? 1 : 0, currentPhase: current,
      error: String(error), interruptionMeaning: 'UNFINISHED_OR_UNKNOWN_IS_NOT_PASS; completed index retained; unfinished database must not be reset', elapsedMilliseconds: Math.round(performance.now() - started) }); } catch { /* preserve prior evidence */ }
    throw error;
  } finally { release(); }
}
// Independent918 branch helpers. These never import the game, replay or write.
// The read path additionally pins raw source/root/proof/archive bytes. Keeping
// these checks pure makes omission, insertion and RNG tampering cheap to test.
export function assertPlannedForkPrefix(root, original, historicalRows) {
  assert.equal(root.format, 'RED_PRIEST_EXACT_PREDECLARATION918_BRANCH_ROOT_V1');
  assert.equal(root.source, SOURCE); assert.equal(root.sourceSha256, SOURCE_SHA);
  assert.equal(root.commandCount, 918); assert.equal(original.commands.length, PREFIX);
  assert.equal(root.prefixSha256, compactHash(original.commands));
  assert.equal(root.rows.length, 123); assert.equal(root.commands.length, 123);
  assert(historicalRows.length >= 123); assert.deepEqual(root.rows, historicalRows.slice(0, 123));
  assert.deepEqual(root.commands, root.rows.map(row => row.intent));
  assert.equal(root.initialStateSha256, root.rows[0].beforeStateSha256);
  for (const [i, row] of root.rows.entries()) {
    assert.equal(row.commandCount, 796 + i); assert.equal(row.revision, 797 + i);
    assert.equal(row.commandSha256, compactHash(row.intent));
    assert.equal(row.randomBefore.seed, original.seed); assert.equal(row.randomAfter.seed, original.seed);
    assert(Number.isSafeInteger(row.randomBefore.cursor)); assert(Number.isSafeInteger(row.randomAfter.cursor));
    assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    if (i) { assert.equal(row.beforeStateSha256, root.rows[i - 1].afterStateSha256); assert.equal(row.publicBeforeSha256, root.rows[i - 1].publicAfterSha256); assert.deepEqual(row.randomBefore, root.rows[i - 1].randomAfter); }
  }
  assert.deepEqual(root.rows[0].randomBefore, original.final.random);
  const last = root.rows.at(-1); assert.equal(root.finalStateSha256, last.afterStateSha256);
  assert.equal(root.publicStateSha256, last.publicAfterSha256); assert.deepEqual(root.random, last.randomAfter);
  assert.equal(root.state.revision, 919); assert.equal(root.state.runId, original.final.runId);
  assert.equal(root.state.status, 'ACTIVE'); assert.deepEqual(root.state.random, root.random);
  assert.equal(stateHash(root.state), root.finalStateSha256);
  const campaign = root.state.redPriest.campaign;
  assert.equal(campaign.phase, 'CRISIS'); assert.equal(campaign.warStarted, null); assert.equal(campaign.declaration, null);
  assert.equal(campaign.planning, undefined, 'Activation must be a new public command, never a patched fork state');
}
export function assertPlannedForkReference(fork, reviewed) {
  assert.deepEqual(fork, reviewed, 'Only the reviewed independent918 root, reconstruction and runtime proofs are accepted');
  for (const key of ['rootSha256', 'proofSha256', 'runtimeProofSha256']) assert(digest(fork[key]));
  assert.equal(fork.rootFile, 'original-918-checkpoint.json'); assert.equal(fork.proofFile, 'reconstruction-proof.json');
  assert.equal(fork.runtimeProofFile, 'runtime-transition.json');
}
export function assertPlannedRows(root, original, cp, capture, rows, initialPublicSha256) {
  const prefix = [...original.commands, ...root.commands]; assert.equal(prefix.length, 918);
  assert.equal(cp.format, 'RED_PRIEST_DURABLE_PUBLIC_ACTION_BOUNDARY_V1');
  assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_SHA);
  assert.equal(cp.prefixCount, 918); assert.equal(capture.prefixCount, 918);
  assert.equal(cp.prefixSha256, compactHash(prefix)); assert.equal(cp.initialStateSha256, root.finalStateSha256);
  assert.equal(cp.initialPublicStateSha256, initialPublicSha256);
  assert.equal(cp.lineage, undefined); assert.equal(capture.lineage, undefined, 'New branch is not a974 continuation');
  assert.equal(capture.prefixFinal, undefined, 'The independent root is referenced, never silently replaced');
  assert.equal(cp.pending, null); assert.equal(capture.pendingIntent, null);
  assert(cp.terminal); assert.deepEqual(cp.terminal, { stage: capture.stage, reason: capture.reason });
  for (const key of ['creation', 'seed', 'initial']) assert.deepEqual(capture[key], original[key]);
  assert.deepEqual(cp.rows, rows); assert.deepEqual(cp.commands, rows.map(row => row.intent));
  assert.deepEqual(capture.commands, [...prefix, ...cp.commands], 'Every original prefix and new command appears exactly once');
  assert.equal(cp.commandCount, 918 + rows.length); assert.equal(capture.commands.length, cp.commandCount);
  assert(rows.length > 0); assert.deepEqual(rows[0].intent, { type: 'RED_PRIEST', command: { type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } } });
  let previous = { afterStateSha256: root.finalStateSha256, publicAfterSha256: initialPublicSha256, randomAfter: root.random };
  for (const [i, row] of rows.entries()) {
    assert.equal(row.commandCount, 919 + i); assert.equal(row.revision, 920 + i);
    assert.equal(row.commandSha256, compactHash(row.intent)); assert.equal(row.intent.type, 'RED_PRIEST');
    for (const key of ['beforeStateSha256', 'afterStateSha256', 'publicBeforeSha256', 'publicAfterSha256']) assert(digest(row[key]));
    assert.equal(row.beforeStateSha256, previous.afterStateSha256); assert.equal(row.publicBeforeSha256, previous.publicAfterSha256);
    assert.deepEqual(row.randomBefore, previous.randomAfter); assert.equal(row.randomAfter.seed, original.seed);
    assert(Number.isSafeInteger(row.randomBefore.cursor) && row.randomBefore.cursor >= 423);
    assert(Number.isSafeInteger(row.randomAfter.cursor) && row.randomAfter.cursor >= row.randomBefore.cursor);
    previous = row;
  }
  assert.equal(previous.afterStateSha256, cp.finalStateSha256); assert.equal(previous.publicAfterSha256, cp.publicStateSha256);
  assert.equal(stateHash(cp.state), cp.finalStateSha256); assert.deepEqual(capture.final, cp.state);
  assert.equal(cp.state.revision, cp.commandCount + 1); assert.deepEqual(cp.state.random, previous.randomAfter);
  assert.deepEqual(capture.policy, cp.policyDefinition); assert.deepEqual(capture.provenance?.fork ?? capture.fork, cp.fork);
}
export function restoreBeforePlanning(view) {
  const result = structuredClone(view), actions = result.actions.filter(a => a.command.type === 'CAMPAIGN' && a.command.command.type === 'ENABLE_PLANNING');
  assert(actions.length <= 1, 'At most the single explicit planning opt-in action may be appended');
  if (actions.length) {
    const action = actions[0]; assert.equal(result.actions.at(-1), action);
    assert.deepEqual(Object.keys(action).sort(), ['command', 'cost', 'enabled', 'id', 'label', 'reason']);
    assert.equal(action.id, `red-priest-action-${result.actions.length}`);
    assert.deepEqual(action.command, { type: 'CAMPAIGN', command: { type: 'ENABLE_PLANNING' } });
    assert.equal(action.label, '启用本场战争筹备');
    assert.equal(action.cost, '不花行动、时间或费用；须在签发发动命令前选择，之后每次侦察和保护性准备照实支付，不能补写过去战果');
    assert.equal(typeof action.enabled, 'boolean');
    if (action.enabled) assert.equal(action.reason, null); else assert(typeof action.reason === 'string' && action.reason.length > 0);
    result.actions.pop();
  }
  return result;
}

export function assertPlannedFreezeSeparation(historical, current, proof) {
  assertFreeze(historical, historical); assertFreeze(current, current);
  assert.notEqual(historical.sha256, current.sha256, 'New opt-in runtime has its own freeze');
  assert.equal(proof.originalRuntimeFreezeSha256, historical.sha256);
  assert.equal(proof.newRuntimeFreezeSha256, current.sha256);
}

// Exact additional1137 proof; old rows stay unchanged in the final ledger.
export function assertStabilityReplayRows(proof, rows, allowedPublicChanges) {
  assert.equal(proof.format, 'RED_PRIEST1137_STABILITY_TRANSITION_V1');
  assert.equal(rows.length, 219); assert.equal(proof.replay.rows.length, 219);
  assert.equal(proof.replay.commands, 219); assert.equal(proof.replay.first, 919); assert.equal(proof.replay.last, 1137);
  assert.equal(proof.replay.allPrivateAndRngEqual, true); assert.equal(proof.replay.allExistingPublicFieldsEqual, true);
  assert(Array.isArray(allowedPublicChanges) && allowedPublicChanges.length > 0);
  assert.deepEqual(allowedPublicChanges, [...new Set(allowedPublicChanges)]);
  assert.deepEqual(proof.replay.allowedPublicChanges, allowedPublicChanges);
  for (const [i, check] of proof.replay.rows.entries()) {
    const row = rows[i]; assert.equal(row.commandCount, 919 + i); assert.equal(check.commandCount, row.commandCount);
    assert.equal(check.commandSha256, row.commandSha256);
    assert.equal(check.beforeStateSha256, row.beforeStateSha256); assert.equal(check.stateSha256, row.afterStateSha256);
    assert.deepEqual(check.randomBefore, row.randomBefore); assert.deepEqual(check.random, row.randomAfter);
    assert.equal(check.capturedPublicBeforeSha256, row.publicBeforeSha256); assert.equal(check.capturedPublicSha256, row.publicAfterSha256);
    assert(digest(check.publicBeforeSha256) && digest(check.publicSha256));
    assert.equal(check.privateAndRngEqual, true); assert.equal(check.allExistingPublicFieldsEqual, true);
    if (i) assert.equal(check.publicBeforeSha256, proof.replay.rows[i - 1].publicSha256);
  }
}

export function argumentsForSave(args) {
  const out = {}, flags = { '--source-directory': 'sourceDirectory', '--output-directory': 'outputDirectory', '--resume-directory': 'resumeDirectory', '--freeze-sha256': 'freezeSha256', '--verifier-sha256': 'verifierSha256', '--remove-stale-lock-pid': 'removeStaleLockPid', '--fork-directory': 'forkDirectory', '--archive-directory': 'archiveDirectory', '--planning-equivalence-proof': 'planningEquivalenceProof', '--planning-equivalence-sha256': 'planningEquivalenceSha256', '--artifact-map': 'artifactMap', '--artifact-map-sha256': 'artifactMapSha256', '--artifact-root': 'artifactRoot', '--prior-planned-directory': 'priorPlannedDirectory', '--stability-prior-directory': 'stabilityPriorDirectory', '--stability-equivalence-proof': 'stabilityEquivalenceProof', '--stability-equivalence-sha256': 'stabilityEquivalenceSha256', '--failure-1222-directory': 'failure1222Directory', '--story-equivalence-proof': 'storyEquivalenceProof', '--story-equivalence-sha256': 'storyEquivalenceSha256', '--runtime-freeze-sha256': 'runtimeFreezeSha256', '--final-ui-equivalence-proof': 'finalUiEquivalenceProof', '--final-ui-equivalence-sha256': 'finalUiEquivalenceSha256' };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]; if (flag === '--preflight' || flag === '--help' || flag === '--planned-fork') { const key = flag === '--planned-fork' ? 'plannedFork' : flag.slice(2); assert(!out[key]); out[key] = true; continue; }
    const key = flags[flag]; assert(key && out[key] === undefined && args[i + 1] !== undefined, `Unknown/duplicate/missing option ${flag}`); out[key] = args[++i];
    if (key === 'removeStaleLockPid') { assert(/^[1-9]\d*$/.test(out[key])); out[key] = Number(out[key]); assert(Number.isSafeInteger(out[key])); }
  }
  assert(!(out.outputDirectory && out.resumeDirectory));
  if (!out.plannedFork) for (const key of ['forkDirectory', 'archiveDirectory', 'planningEquivalenceProof', 'planningEquivalenceSha256', 'artifactMap', 'artifactMapSha256', 'artifactRoot', 'priorPlannedDirectory', 'stabilityPriorDirectory', 'stabilityEquivalenceProof', 'stabilityEquivalenceSha256', 'failure1222Directory', 'storyEquivalenceProof', 'storyEquivalenceSha256', 'runtimeFreezeSha256', 'finalUiEquivalenceProof', 'finalUiEquivalenceSha256']) assert.equal(out[key], undefined, 'Planned inputs require explicit --planned-fork');
  const storyKeys = ['storyEquivalenceProof', 'storyEquivalenceSha256', 'runtimeFreezeSha256'];
  if (storyKeys.some(key => out[key] !== undefined)) assert(storyKeys.every(key => out[key] !== undefined), 'Story proof and exact current runtime freeze must be supplied together');
  if (out.finalUiEquivalenceProof !== undefined || out.finalUiEquivalenceSha256 !== undefined) assert(out.finalUiEquivalenceProof && out.finalUiEquivalenceSha256 && storyKeys.every(key => out[key] !== undefined), 'Final UI proof requires both reviewed hashes and the retained story proof/runtime bundle');
  return out;
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  try { const options = argumentsForSave(process.argv.slice(2));
    if (options.help) console.log('node --expose-gc --max-old-space-size=1024 scripts/verify/red-priest-save.mjs --source-directory EXACT_TERMINAL_CAPTURE --freeze-sha256 REVIEWED_FREEZE --verifier-sha256 REVIEWED_VERIFIER [--preflight | --output-directory output/qa-0209/sqlite | --resume-directory EXACT_AUDIT_DIR]. Explicit main/operator stale-lock approval only: --remove-stale-lock-pid DEAD_PID. Preflight performs no runtime import, SQLite, replay or write. Unknown interrupted SQLite cases stop for inspection. Original795 is retained, not replayed; new tail replays once; only selected actual transitions use SQLite. Independent planned branch additionally requires --planned-fork --fork-directory EXACT_918_ROOT_DIR --archive-directory IMMUTABLE_983_CAPTURE_DIR --planning-equivalence-proof REVIEWED_PROOF --planning-equivalence-sha256 REVIEWED_PROOF_SHA --artifact-root EXPLICIT_ARTIFACT_ROOT --artifact-map REVIEWED_LOCATION_MAP --artifact-map-sha256 REVIEWED_MAP_SHA; exact1017 continuation additionally requires --prior-planned-directory ORIGINAL_SIX_FILE_OBSERVATION. Independent first-bottle918 branch additionally requires --failure-1222-directory COMPLETE_FAILED_EIGHT_FILE_CAPTURE. Exact1137 stability history also requires --stability-prior-directory ORIGINAL_SEVEN_FILE_OBSERVATION --stability-equivalence-proof REVIEWED219_PROOF --stability-equivalence-sha256 REVIEWED219_SHA. It begins at918 and never continues974/983. Optional reviewed1051 story correction requires --story-equivalence-proof REVIEWED133_PROOF --story-equivalence-sha256 REVIEWED133_SHA --runtime-freeze-sha256 EXACT_CURRENT_FREEZE; --freeze-sha256 remains the immutable original capture freeze. Final appended garrison action additionally requires --final-ui-equivalence-proof REVIEWED_FINAL133_PROOF --final-ui-equivalence-sha256 REVIEWED_FINAL133_SHA; prior story proof stays required.');
    else console.log(JSON.stringify(await verifyRedPriestCapture(options)));
  } catch (error) { console.error(error); process.exitCode = 1; }
}
