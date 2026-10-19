import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

/** Exact living200 / recovered827 continuation. Importing this module never loads the game.
 * Invoke only after the parent has validated and frozen existing src/dist.
 * Required: --source <original snapshot-recoveredBeforeEncounter.json> --out <new capture directory>.
 * --max-new-actions=0/1/N counts actions completed THIS invocation (default32).
 * --resume uses that same directory and frozen input/runtime/producer bytes.
 * Zero-action resume is read-only and requires a closed completed boundary.
 *
 * Persist chosen public intent -> prepare real owned draft -> atomically save
 * COMPLETE result checkpoint -> append lightweight JSONL receipt/key snapshots
 * -> commit owned draft. Resume repairs a missing last receipt from that full
 * checkpoint without executing its action again. Only an uncommitted pending
 * intent may continue unchanged from its exact state/RNG on nonzero resume.
 * Unknown/corrupt successors are retained and rejected, never rerolled.
 *
 * Retain the WHOLE directory, original input and separately frozen src/dist.
 * One rolling full checkpoint replaces per-action full-history copies. Gzip
 * key snapshots: initial, every16 new actions, CONSUME before/after, terminal.
 * No build, old831 replay, alternate policy, RNG seam, SQLite or upload here.
 */
export const FORMAT = 'NEW222_RESTORED200_LIVING827_COMPACT_OWNED_V1';
export const HASH_ENCODING = 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256';
export const SOURCE = 'tests/fixtures/knowledge-emperor-v02000/snapshot-recoveredBeforeEncounter.json';
export const HISTORY = 'tests/fixtures/knowledge-emperor-v02000/natural.json';
export const HISTORY_SHA256 = '1fd5f8c1fa3f29bb60925268851a597976904065c8b0ed66b95ce95258a92548';
export const PREFIX_SHA256 = 'c7399defd4dea35d147abe15d84fa3c3ff2ddcef101e30173a211208b183121f';
export const SOURCE_SHA256 = '7dfb8d05d6dfd262aa804fd6e8a4a1c0256dccffbdebdd0dcad4e77e830b0cb7';
export const SOURCE_STATE_SHA256 = 'bf23ffe532b8be8c33fd44d5e5408a1600a1e7a6173ef73482a52a4336596f4b';
export const PREFIX_COUNT = 827;
export const SOURCE_REVISION = 828;
export const SNAPSHOT_INTERVAL = 16;
export const FROZEN_SOURCE_KEYS = ['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'starMystic', 'mystic', 'prophecyMaster', 'sage', 'knowledgeEmperor'];
const SELF = fileURLToPath(import.meta.url), TEST = 'scripts/play/hermit-stage.test.mjs';
const HOME = 'HM222-ARCHIVE-OUTSIDE', clone = value => structuredClone(value);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function stable(value) {
  const canonical = node => {
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return node;
    if (typeof node === 'number') { assert(Number.isFinite(node)); return Object.is(node, -0) ? 0 : node; }
    if (Array.isArray(node)) return node.map(canonical);
    assert(node && typeof node === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(node)), 'Expected canonical JSON');
    return Object.fromEntries(Object.keys(node).sort().map(key => [key, canonical(node[key])]));
  };
  return JSON.stringify(canonical(value));
}
export const stateHash = value => sha(stable(value));
export function portableSourcePath(root, source) {
  const name = relative(resolve(root), resolve(root, source)).split(sep).join('/');
  assert(name && name !== '..' && !name.startsWith('../') && !isAbsolute(name), 'Source must remain inside the repository');
  assert.equal(name, SOURCE, 'Use the canonical living200 snapshot location');
  return name;
}
export function sealRow(payload) { return { ...payload, rowSha256: stateHash(payload) }; }
export function verifyRow(row) {
  const { rowSha256, ...payload } = row;
  assert.equal(rowSha256, stateHash(payload), 'Receipt checksum mismatch');
  assert.equal(row.commandSha256, stateHash(row.intent), 'Command checksum mismatch');
}
export function snapshotReasons({ newCount, beforeIntent = null, afterIntent = null, terminal = false }) {
  assert(Number.isSafeInteger(newCount) && newCount >= 0);
  const promotion = intent => intent?.type === 'HERMIT' && intent.command?.type === 'CONSUME';
  return [newCount === 0 && !beforeIntent && !afterIntent && !terminal ? 'initial' : null,
    newCount > 0 && newCount % SNAPSHOT_INTERVAL === 0 && afterIntent ? 'periodic' : null,
    promotion(beforeIntent) ? 'before-consume' : null, promotion(afterIntent) ? 'after-consume' : null,
    terminal ? 'terminal' : null].filter(Boolean);
}
export function chooseAction(view) {
  if (view.status !== 'ACTIVE') return { stop: 'NATURAL_TERMINAL', reason: `Actual runtime status ${view.status}` };
  if (view.activeEvent || view.combat) return { stop: 'PUBLIC_ACTION_BLOCKED', reason: 'An inherited event or combat cannot be bypassed' };
  const preferred = view.hermit.actions.filter(action => action.preferredAction === true);
  if (preferred.length !== 1) return { stop: 'PUBLIC_ACTION_BLOCKED', reason: `Expected exactly one public preferred action; found ${preferred.length}. ${view.hermit.nextStep ?? ''}` };
  const action = preferred[0];
  if (!action.enabled) return { stop: 'PUBLIC_ACTION_BLOCKED', reason: `${action.label}: ${action.reason ?? 'Public prerequisite unresolved'}` };
  if (!view.hermit.guidanceKnown && action.command.type !== 'LEARN_GUIDANCE')
    return { stop: 'PUBLIC_ACTION_BLOCKED', reason: 'The exact original must first learn guidance' };
  return { intent: { type: 'HERMIT', command: clone(action.command) }, publicAction: clone(action) };
}
/** Public physical bodies are admitted only at actual public movement/command
 * paths. An admission source identity is never a public actor reference. */
export function hermitPublicPhysicalActor(path, value) {
  if (/^\$\.hermit\.actions\.\d+\.command\.actorId$/.test(path))
    return ['PLAYER', 'HM222-MIRA', 'HM222-NILES'].includes(value);
  if (value === null && ['$.divineHand.life.site.guard.actorId', '$.glory.life.site.guard.actorId'].includes(path)) return true;
  const owner = value === 'PM3-IRIS', body = owner || value === 'PLAYER';
  if (/^\$\.(?:sage|knowledgeEmperor)\.(?:life\.(?:site|(?:currentAttempt|cases\.\d+\.attempts\.\d+)\.siteAt(?:Start|Close)|ledger\.\d+\.site(?:Before|After))|encounter\.(?:site|startSite))\.actorMoves\.\d+\.actorId$/.test(path)) return owner;
  if (/^\$\.sage\.life\.(?:currentAttempt|cases\.\d+\.attempts\.\d+)\.(?:playerMoves|actorMoves)\.\d+\.actorId$/.test(path)) return body;
  if (/^\$\.knowledgeEmperor\.life\.ledger\.\d+\.moves\.\d+\.actorId$/.test(path)) return body;
  return /^\$\.(?:lastCombatRound|combatHistory\.\d+)\.sageOutcome\.siteAfter\.actorMoves\.\d+\.actorId$/.test(path) && owner;
}
export function assertPublicOnly(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter',
    'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'randomReceipts', 'sourceDigest', 'historyDigest',
    'originalWorldDigest', 'combatHistoryDigest', 'originalsDigest', 'acquisitionDigest', 'compoundDigest', 'beforeDigest', 'afterDigest',
    'actorId', 'predecessorActorId', 'incumbentActorId', 'custodianActorId', 'preparationRoll', 'futureRoll', 'nextRoll', 'privateSource']);
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`, physicalActor = key === 'actorId' && hermitPublicPhysicalActor(next, child);
    const inactiveWriterRecord = next === '$.writer.life.practice.record.reportDigest' && child === null;
    assert(!((forbidden.has(key) || key.endsWith('Digest')) && !physicalActor && !inactiveWriterRecord) && !(key === 'source' && child !== null && typeof child === 'object'), `Private public field ${next}`);
    assertPublicOnly(child, next);
  }
}
export function auditPublic(view, state) {
  assertPublicOnly(view); const text = JSON.stringify(view), secrets = new Set([state.random.seed, state.hermit.source?.actorId].filter(Boolean));
  // These inherited on-screen body labels are not private identities. The
  // actual admission actor above is always secret, regardless of its spelling.
  const physicalBodies = new Set(['PLAYER', 'HM222-MIRA', 'HM222-NILES', 'PM3-IRIS']);
  const collect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'actorId' && !physicalBodies.has(child) || ['predecessorActorId', 'incumbentActorId', 'custodianActorId'].includes(key) || key.endsWith('Digest')) && typeof child === 'string' && child)
        secrets.add(child);
      collect(child);
    }
  };
  collect(state.hermit);
  for (const secret of secrets) assert(!text.includes(secret), 'Whole public projection leaked an actual private identity, digest or seed');
}
const anchor = (state, view) => ({ revision: state.revision, privateStateSha256: stateHash(state),
  publicStateSha256: stateHash(view), random: clone(state.random), randomSha256: stateHash(state.random) });

/** Integrity check only: no historical/new-action replay. Revision is separate
 * from archived command count. The first827 original commands stay in order; the separate full831 DEAD archive is never replayed. */
export function verifyCommandChain(rows, { prefixCommands, initial }) {
  let previous = null, current = initial, newCount = 0;
  for (const [index, row] of rows.entries()) {
    verifyRow(row); assert.equal(row.previousRowSha256, previous, 'Broken receipt chain');
    assert.equal(row.commandCount, index + 1, 'Non-contiguous command count');
    if (index < prefixCommands.length) {
      assert.equal(row.kind, 'HISTORICAL_COMMAND'); assert.deepEqual(row.intent, prefixCommands[index]);
    } else {
      newCount++; assert.equal(row.kind, 'HERMIT_ACTION'); assert.equal(row.newCount, newCount);
      assert.equal(row.intent.type, 'HERMIT'); assert.deepEqual(row.before, current, 'Broken private/public/RNG boundary');
      assert.equal(row.after.revision, initial.revision + newCount, 'Revision is not command count');
      assert.equal(row.after.randomSha256, stateHash(row.after.random)); assert.equal(row.before.randomSha256, stateHash(row.before.random));
      assert.equal(row.after.random.seed, row.before.random.seed);
      assert(Number.isSafeInteger(row.after.random.cursor) && row.after.random.cursor >= row.before.random.cursor);
      for (const side of [row.before, row.after]) for (const key of ['privateStateSha256', 'publicStateSha256', 'randomSha256'])
        assert(/^[a-f0-9]{64}$/.test(side[key]));
      assert.equal(row.publicAction.enabled, true); assert.equal(row.publicAction.preferredAction, true);
      assert.deepEqual(row.intent.command, row.publicAction.command); current = row.after;
    }
    previous = row.rowSha256;
  }
  assert(rows.length >= prefixCommands.length, 'Missing original command prefix');
  return { commandCount: rows.length, newCount, rowSha256: previous, anchor: current };
}
export function parseOptions(args, root = process.cwd()) {
  const result = { source: null, out: null, resume: false, maxNewActions: 32 }, seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const split = args[i].indexOf('='), flag = split < 0 ? args[i] : args[i].slice(0, split);
    assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--resume') { assert.equal(split, -1, '--resume takes no value'); result.resume = true; continue; }
    assert(['--source', '--out', '--max-new-actions'].includes(flag), `Unsupported ${flag}: no seed, roll, strategy or outcome overrides`);
    const value = split < 0 ? args[++i] : args[i].slice(split + 1); assert(value && !value.startsWith('--'), `Missing value for ${flag}`);
    if (flag === '--max-new-actions') { assert(/^\d+$/.test(value)); result.maxNewActions = Number(value); assert(Number.isSafeInteger(result.maxNewActions)); }
    else result[flag.slice(2)] = resolve(root, value);
  }
  assert(result.source && result.out, 'Explicit --source and --out are required'); return result;
}
function regular(path) { const stat = lstatSync(path); assert(stat.isFile() && !stat.isSymbolicLink(), `Expected regular file: ${path}`); }
function fileEvidence(path) {
  regular(path); const before = lstatSync(path, { bigint: true });
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(65536); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; hash.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  const after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(after[key], before[key], `File changed while hashing: ${path}`);
  assert.equal(BigInt(bytes), after.size); return { bytes, sha256: hash.digest('hex') };
}
function inspectFreeze(root, source) {
  const files = [], walk = name => {
    const path = join(root, name), stat = lstatSync(path); assert(!stat.isSymbolicLink(), `Frozen symlink: ${name}`);
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(join(name, child));
    else files.push({ file: name.split(sep).join('/'), ...fileEvidence(path) });
  };
  assert(existsSync(join(root, 'dist/domain/hermit/owned-session.js')), 'Build and freeze the reviewed runtime first; this producer never builds');
  for (const name of ['package.json', 'package-lock.json', 'src', 'dist', 'node_modules/@noble/hashes', 'scripts/play/hermit-stage.mjs', TEST]) walk(name);
  const payload = { nodeVersion: process.version, source: { path: portableSourcePath(root, source), ...fileEvidence(source) },
    history: { path: HISTORY, ...fileEvidence(join(root, HISTORY)) }, files };
  assert.equal(payload.source.sha256, SOURCE_SHA256); assert.equal(payload.history.sha256, HISTORY_SHA256);
  return { ...payload, sha256: stateHash(payload) };
}
function stamps(root, freeze) {
  return [...freeze.files.map(file => join(root, file.file)), join(root, freeze.source.path), join(root, freeze.history.path)].map(path => {
    const s = lstatSync(path, { bigint: true }); return { path, size: s.size, mtimeNs: s.mtimeNs, ctimeNs: s.ctimeNs, ino: s.ino };
  });
}
function unchanged(frozen) {
  for (const before of frozen) {
    const after = lstatSync(before.path, { bigint: true }); assert(after.isFile() && !after.isSymbolicLink());
    for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(after[key], before[key], `Frozen file changed: ${before.path}`);
  }
}
const syncDirectory = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
function durableWrite(path, bytes, mode = 'wx') {
  const fd = openSync(path, mode); try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
}
function unpack(path) { regular(path); return JSON.parse(gunzipSync(readFileSync(path)).toString('utf8')); }
function checkpointRead(path) {
  const saved = unpack(path); assert.equal(saved.sha256, stateHash(saved.payload), 'Full checkpoint checksum mismatch');
  assert.equal(saved.payload.format, FORMAT); return saved;
}
function checkpointSave(path, payload, predecessorSha256) {
  assert(!existsSync(`${path}.next`), 'Preserve and recover the checkpoint successor');
  const saved = { payload: { ...payload, predecessorSha256 } }; saved.sha256 = stateHash(saved.payload);
  durableWrite(`${path}.next`, gzipSync(JSON.stringify(saved), { level: 6 }));
  renameSync(`${path}.next`, path); syncDirectory(dirname(path)); return saved;
}
function checkpointRecover(path, validate) {
  if (!existsSync(`${path}.next`)) return;
  const current = existsSync(path) ? checkpointRead(path) : null, next = checkpointRead(`${path}.next`);
  assert.equal(next.payload.predecessorSha256, current?.sha256 ?? null, 'Unknown checkpoint successor; preserve for inspection');
  validate(next.payload, current?.payload ?? null);
  renameSync(`${path}.next`, path); syncDirectory(dirname(path));
}
/** No replay: exact bytes, the ordered living827 prefix and the separate
 * full831 terminal archive preserve the same fully natural S9-to-S1 history. */
export function verifySourceProvenance(source, archive) {
  assert.equal(stateHash(source), SOURCE_STATE_SHA256);
  assert.equal(archive.commands.length, 831); assert.equal(archive.final.status, 'DEAD');
  assert.equal(archive.snapshots.recoveredBeforeEncounter, 'snapshot-recoveredBeforeEncounter.json');
  assert.equal(archive.prefixCount, 651); assert.equal(archive.prefixFinal.revision, 652);
  assert.equal(archive.prefixVerified, true); assert.equal(archive.inheritedPrefixCount, 507);
  assert.equal(archive.provenance.inheritedDirectedPrefix, false); assert.equal(archive.provenance.fullNaturalS9ToS1, true);
  assert.equal(archive.provenance.newRandomChanges, false); assert.equal(archive.continuation.newRandomChanges, false);
  const prefixCommands = archive.commands.slice(0, PREFIX_COUNT);
  assert.equal(stateHash(prefixCommands), PREFIX_SHA256, 'Original827 prefix changed');
  assert.equal(source.revision, archive.prefixFinal.revision + PREFIX_COUNT - archive.prefixCount);
  assert.equal(archive.final.revision, source.revision + archive.commands.length - PREFIX_COUNT);
  assert.deepEqual(prefixCommands.at(-1), { type: 'ACTION', action: 'REST' });
  assert.deepEqual(archive.commands[PREFIX_COUNT], { type: 'KNOWLEDGE_EMPEROR', command: { type: 'PREPARE_ENCOUNTER' } });
  assert.equal(source.revision, SOURCE_REVISION); assert.equal(source.status, 'ACTIVE'); assert.equal(source.week, 194);
  assert.deepEqual([source.health, source.mind, source.spirituality, source.cash, source.actionsRemaining], [100, 100, 120, 645, 3]);
  assert.deepEqual(source.random, { seed: 'pryer-natural-v048', cursor: 346 }); assert.deepEqual(source.injuries, []);
  assert.equal(source.progression.pathwayId, 'hermit'); assert.equal(source.progression.sequence, 1); assert.equal(source.progression.acting, 100);
  assert.equal(source.knowledgeEmperor.promotionWeek, 185); assert.equal(source.knowledgeEmperor.life.reflected, true);
  assert.equal(Object.keys(source.progression.mastery).length, 15);
  return { prefixCommands, provenance: { kind: 'EXACT200_RECOVERED827_SNAPSHOT_WITH_NATURAL_S9_TO_S1_HISTORY',
    snapshotPath: SOURCE, snapshotSha256: SOURCE_SHA256, snapshotStateSha256: SOURCE_STATE_SHA256,
    historyPath: HISTORY, historySha256: HISTORY_SHA256, originalArchiveCommandCount: archive.commands.length,
    originalArchiveTerminalStatus: archive.final.status, prefixCommandCount: PREFIX_COUNT, prefixCommandsSha256: PREFIX_SHA256,
    sourceRevision: SOURCE_REVISION, nextCommandCount: PREFIX_COUNT + 1, nextRevision: SOURCE_REVISION + 1,
    originalProvenance: clone(archive.provenance), originalContinuation: clone(archive.continuation),
    historicalPrefixReplayed: false, inheritedDirectedPrefix: false, fullNaturalS9ToS1: true } };
}
function readSource(path, historyPath) {
  regular(path); regular(historyPath); const bytes = readFileSync(path), historyBytes = readFileSync(historyPath);
  assert.equal(sha(bytes), SOURCE_SHA256, 'Only the exact living200 snapshot is admitted');
  assert.equal(sha(historyBytes), HISTORY_SHA256, 'Preserve the exact separate831-command DEAD archive');
  const source = JSON.parse(bytes), archive = JSON.parse(historyBytes);
  return { source, bytes, historyBytes, ...verifySourceProvenance(source, archive) };
}
async function loadRuntime(root) {
  const [slice, migration, owned, source, materials] = await Promise.all(['domain/slice/index', 'domain/slice/migration',
    'domain/hermit/owned-session', 'domain/hermit/source', 'domain/hermit/materials']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  assert.equal(materials.HERMIT_HOME, HOME);
  assert.deepEqual(source.HERMIT_FROZEN_SOURCE_KEYS, FROZEN_SOURCE_KEYS);
  return { ...slice, migrateSliceState: migration.migrateSliceState, openHermitRuntimeSession: owned.openHermitRuntimeSession,
    frozenSourceKeys: [...source.HERMIT_FROZEN_SOURCE_KEYS] };
}
function migrate(runtime, original) {
  const state = runtime.migrateSliceState(original); assert.equal(stateHash(original), SOURCE_STATE_SHA256);
  for (const [key, value] of Object.entries(original)) if (!['schemaVersion', 'contentVersion'].includes(key))
    assert.deepEqual(state[key], value, `Migration changed original root ${key}`);
  assert.equal(state.schemaVersion, 219); assert.equal(state.contentVersion, 'hermit-v219');
  runtime.assertValidSliceState(state); return state;
}
export function assertOriginalRoots(state, original, sourceKeys) {
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, original.random.seed);
  for (const key of [...sourceKeys, 'world', 'combatHistory']) {
    assert(Object.hasOwn(original, key), `Missing inherited root: ${key}`);
    assert.deepEqual(state[key], original[key], `Inherited root changed: ${key}`);
  }
  // This actual engine does not increase core stats at S0 promotion.
  assert.deepEqual(state.character, original.character, 'Original live character changed');
  if (state.hermit.guidanceKnown) assert.deepEqual(state.hermit.source.character, original.character, 'Original character source changed');
  for (const [key, value] of Object.entries(original.progression.mastery)) assert.equal(state.progression.mastery[key], value, `Old mastery changed: ${key}`);
}
export function assertOriginals(state, original, before, sourceKeys, intent) {
  assertOriginalRoots(state, original, sourceKeys);
  assert(state.random.cursor >= before.random.cursor); assert.equal(state.revision, before.revision + 1);
  if (before.progression.sequence !== state.progression.sequence) {
    assert.equal(before.progression.sequence, 1); assert.equal(state.progression.sequence, 0);
    assert.equal(intent.type, 'HERMIT'); assert.equal(intent.command.type, 'CONSUME');
    assert.equal(state.hermit.promotionWeek, state.week);
  }
  if (state.status === 'DEAD') assert.equal(state.ending?.kind, 'DEATH');
}
function receipt(next, before) {
  const latest = next.hermit.journal.at(-1);
  if (latest?.revision === next.revision) return { id: latest.id, checks: clone(latest.randomReceipts), finance: clone(latest.financeReceipts), notes: clone(latest.notes), beforeDigest: latest.beforeDigest, afterDigest: latest.afterDigest };
  assert(!before.hermit.guidanceKnown && next.hermit.guidanceKnown, 'Missing actual owned-action receipt');
  return { id: null, checks: [], finance: [], notes: clone(next.chronicle.slice(before.chronicle.length)) };
}
function snapshotContent(cp, view, reasons) {
  return { format: FORMAT, commandCount: cp.commandCount, newCount: cp.newCount, reasons, anchor: cp.anchor,
    final: cp.state, random: cp.state.random, public: view };
}
function planSnapshot(cp, view, reasons) {
  if (!reasons.length || reasons.length === 1 && reasons[0] === 'terminal' && cp.snapshots.some(item => item.commandCount === cp.commandCount && item.reasons.includes('terminal'))) return cp;
  const file = `key-${cp.commandCount}-${reasons.join('-')}.json.gz`;
  if (cp.snapshots.some(item => item.file === file)) return cp;
  return { ...cp, snapshots: [...cp.snapshots, { file, commandCount: cp.commandCount, newCount: cp.newCount,
    reasons, stateSha256: cp.anchor.privateStateSha256, publicSha256: cp.anchor.publicStateSha256,
    contentSha256: stateHash(snapshotContent(cp, view, reasons)) }] };
}
function materializeSnapshots(out, cp, view, { readOnly = false, verifyAll = false } = {}) {
  for (const item of cp.snapshots) {
    assert.equal(item.file, `key-${item.commandCount}-${item.reasons.join('-')}.json.gz`);
    const path = join(out, item.file), present = existsSync(path);
    if (!present) {
      assert(!readOnly, 'Zero-action resume will not repair a missing snapshot');
      assert.equal(item.stateSha256, cp.anchor.privateStateSha256, 'An older required snapshot is missing; do not replay it');
      const content = snapshotContent(cp, view, item.reasons); assert.equal(stateHash(content), item.contentSha256);
      if (existsSync(`${path}.next`)) assert.equal(stateHash(unpack(`${path}.next`)), item.contentSha256, 'Unknown snapshot successor');
      else durableWrite(`${path}.next`, gzipSync(JSON.stringify(content), { level: 6 }));
      renameSync(`${path}.next`, path); syncDirectory(out);
    }
    assert(!existsSync(`${path}.next`), 'Unexpected extra snapshot successor');
    if (present && !verifyAll) continue;
    const content = unpack(path); assert.equal(stateHash(content), item.contentSha256);
    assert.equal(content.commandCount, item.commandCount); assert.equal(content.newCount, item.newCount);
    assert.equal(stateHash(content.final), item.stateSha256); assert.equal(stateHash(content.public), item.publicSha256);
    assert.deepEqual(content.random, content.final.random); auditPublic(content.public, content.final);
  }
}
function traceRead(path) {
  regular(path); const text = readFileSync(path, 'utf8'), end = text.lastIndexOf('\n');
  return { complete: text.slice(0, end + 1), tail: text.slice(end + 1), rows: end < 0 ? [] : text.slice(0, end).split('\n').filter(Boolean).map(line => JSON.parse(line)) };
}
function reconcileTrace(path, cp, prefixCommands, initial, readOnly) {
  let trace = traceRead(path), chain = verifyCommandChain(trace.rows, { prefixCommands, initial });
  if (trace.rows.length === cp.commandCount - 1 && cp.lastRow) {
    assert(!readOnly, 'Zero-action resume will not append a missing completed receipt');
    assert.equal(cp.lastRow.previousRowSha256, chain.rowSha256); assert.deepEqual(cp.lastRow.before, chain.anchor);
    const line = `${JSON.stringify(cp.lastRow)}\n`; assert(line.startsWith(trace.tail), 'Unknown trailing bytes; preserve without replay');
    const pending = `${path}.next`;
    if (trace.tail || existsSync(pending)) {
      const repaired = trace.complete + line;
      if (existsSync(pending)) assert.equal(readFileSync(pending, 'utf8'), repaired, 'Unknown repaired trace successor');
      else durableWrite(pending, repaired);
      renameSync(pending, path); syncDirectory(dirname(path));
    } else durableWrite(path, line, 'a');
    trace = traceRead(path); chain = verifyCommandChain(trace.rows, { prefixCommands, initial });
  }
  assert(!existsSync(`${path}.next`), 'Unknown extra trace successor');
  assert.equal(trace.tail, '', 'Incomplete/unknown receipt tail; preserve for inspection');
  assert.equal(chain.commandCount, cp.commandCount); assert.equal(chain.newCount, cp.newCount);
  assert.equal(chain.rowSha256, cp.rowSha256); assert.deepEqual(chain.anchor, cp.anchor); return trace.rows;
}
export function outcome(state) {
  const root = state.hermit, scene = root.scene;
  return { status: state.status, sequence: state.progression.sequence,
    promoted: state.progression.sequence === 0 && root.promotionWeek !== null,
    promotionWeek: root.promotionWeek, scenePhase: scene?.phase ?? null, sceneStatus: scene?.status ?? null,
    preparationReported: !!scene?.preparationReportEventId, reported: !!scene?.returnReportEventId,
    returnReportEventId: scene?.returnReportEventId ?? null,
    ordinaryExit: !!scene && scene.playerPosition === 'OUTSIDE' && scene.owner.position === 'OUTSIDE' &&
      scene.workers.every(worker => worker.position === 'OUTSIDE') && scene.body === 'SOLID' && !scene.window && !scene.contact,
    originalReturned: !!scene && scene.custody.holder === 'OWNER' && scene.custody.position === scene.owner.position && !!scene.custody.returnEventId,
    returnedHome: root.frame?.location === HOME, location: root.frame?.location ?? null,
    informationApplied: scene?.informationCompleted ?? false, transferApplied: scene?.transferCompleted ?? false,
    ordinaryCopyCompleted: scene?.manualCopyCompleted ?? false,
    week: state.week, health: state.health, mind: state.mind, spirituality: state.spirituality };
}
/** Observe the actual report/death boundary; never extend the route with a
 * synthetic action or demand successful abilities after an honest abort. */
export function terminal(state) {
  const actual = outcome(state);
  if (actual.status !== 'ACTIVE') return { stage: actual.status === 'DEAD' ? 'NATURAL_DEATH' : 'NATURAL_TERMINAL', reason: `Actual runtime status ${actual.status}` };
  if (actual.reported) return { stage: 'NATURAL_S0_RETURN_REPORTED', reason: 'Actual return report recorded; retain completed or aborted practice exactly as observed' };
  return null;
}
function safeOutput(root, options) {
  assert.notEqual(options.out, root); assert(!root.startsWith(options.out + sep), 'Output cannot contain the runtime');
  for (const name of ['src', 'dist', 'scripts', 'tests', 'test-inputs', 'docs', 'node_modules', '.git']) {
    const protectedPath = join(root, name); assert(options.out !== protectedPath && !options.out.startsWith(protectedPath + sep), 'Output overlaps a protected input');
  }
  assert(!options.source.startsWith(options.out + sep), 'Original source must remain outside the output');
  for (let path = options.out; ; path = dirname(path)) {
    if (existsSync(path)) assert(lstatSync(path).isDirectory() && !lstatSync(path).isSymbolicLink(), `Unsafe output ancestor: ${path}`);
    if (dirname(path) === path) break;
  }
  if (!existsSync(options.out)) { assert(!options.resume, 'Missing resume directory'); mkdirSync(options.out, { recursive: true }); }
  for (const file of readdirSync(options.out)) regular(join(options.out, file));
}
function writeSummary(out, summary) {
  const path = join(out, 'summary.json'), next = `${path}.next`;
  assert(!existsSync(next), 'Preserve the interrupted summary successor before continuing');
  durableWrite(next, JSON.stringify(summary, null, 2) + '\n'); renameSync(next, path); syncDirectory(out);
}
export async function main(args = process.argv.slice(2)) {
  const root = process.cwd(), options = parseOptions(args, root);
  assert.equal(resolve(root, 'scripts/play/hermit-stage.mjs'), SELF, 'Run the reviewed producer from its matching repository root');
  portableSourcePath(root, options.source);
  const old = readSource(options.source, join(root, HISTORY)), freeze = inspectFreeze(root, options.source), frozen = stamps(root, freeze);
  const runtime = await loadRuntime(root), initialState = migrate(runtime, old.source), initialView = runtime.projectSliceState(initialState);
  auditPublic(initialView, initialState); const initial = anchor(initialState, initialView); safeOutput(root, options);
  const checkpoint = join(options.out, 'checkpoint.json.gz'), tracePath = join(options.out, 'commands.jsonl');
  const readOnly = options.resume && options.maxNewActions === 0;
  let saved, session = null, count = 0, pauseRequested = false;
  if (options.resume) {
    assert.deepEqual(JSON.parse(readFileSync(join(options.out, 'runtime-freeze.json'), 'utf8')), freeze, 'Source/runtime/producer fingerprint drift');
    assert.equal(sha(gunzipSync(readFileSync(join(options.out, 'source-snapshot.json.gz')))), SOURCE_SHA256);
    assert.equal(sha(gunzipSync(readFileSync(join(options.out, 'original831-natural.json.gz')))), HISTORY_SHA256);
    for (const [retained, original] of [['producer.mjs', SELF], ['producer-tests.mjs', join(root, TEST)]])
      assert.deepEqual(readFileSync(join(options.out, retained)), readFileSync(original));
    if (readOnly) assert(!readdirSync(options.out).some(name => name.endsWith('.next')), 'Zero-action resume requires a closed boundary without successors');
    else checkpointRecover(checkpoint, (candidate, previous) => {
      assert.equal(candidate.sourceSha256, SOURCE_SHA256); assert.equal(candidate.sourceStateSha256, SOURCE_STATE_SHA256);
      assert.equal(candidate.historySha256, HISTORY_SHA256); assert.equal(candidate.prefixCommandsSha256, PREFIX_SHA256);
      assert.deepEqual(candidate.provenance, old.provenance); assert.deepEqual(candidate.frozenSourceKeys, runtime.frozenSourceKeys);
      assert.equal(candidate.freezeSha256, freeze.sha256); assert.deepEqual(candidate.initial, initial);
      assert(Number.isSafeInteger(candidate.newCount) && candidate.newCount >= 0);
      assert.equal(candidate.commandCount, PREFIX_COUNT + candidate.newCount); assert.equal(candidate.state.revision, SOURCE_REVISION + candidate.newCount);
      if (previous) {
        const advance = candidate.commandCount - previous.commandCount;
        assert(advance === 0 || advance === 1, 'Unknown successor action jump');
        if (advance) {
          assert(previous.pending, 'Completed successor lacks its durable intent');
          assert.deepEqual(candidate.lastRow.intent, previous.pending.intent); assert.deepEqual(candidate.lastRow.before, previous.anchor);
        } else assert.deepEqual(candidate.anchor, previous.anchor, 'Action-free successor changed state');
      }
      assertOriginalRoots(candidate.state, old.source, runtime.frozenSourceKeys);
      runtime.assertValidSliceState(candidate.state);
      const projection = runtime.projectSliceState(candidate.state); auditPublic(projection, candidate.state);
      assert.deepEqual(anchor(candidate.state, projection), candidate.anchor);
    });
    saved = checkpointRead(checkpoint);
  } else {
    assert.equal(readdirSync(options.out).length, 0, 'Refuse to overwrite old capture; use --resume');
    durableWrite(join(options.out, 'runtime-freeze.json'), JSON.stringify(freeze));
    durableWrite(join(options.out, 'source-snapshot.json.gz'), gzipSync(old.bytes, { level: 6 }));
    durableWrite(join(options.out, 'original831-natural.json.gz'), gzipSync(old.historyBytes, { level: 6 }));
    durableWrite(join(options.out, 'producer.mjs'), readFileSync(SELF)); durableWrite(join(options.out, 'producer-tests.mjs'), readFileSync(join(root, TEST)));
    let previous = null;
    const rows = old.prefixCommands.map((intent, index) => {
      const row = sealRow({ kind: 'HISTORICAL_COMMAND', commandCount: index + 1, intent, commandSha256: stateHash(intent), previousRowSha256: previous }); previous = row.rowSha256; return row;
    });
    durableWrite(tracePath, rows.map(row => JSON.stringify(row) + '\n').join(''));
    const cp = planSnapshot({ format: FORMAT, hashEncoding: HASH_ENCODING, sourceSha256: SOURCE_SHA256, sourceStateSha256: SOURCE_STATE_SHA256,
      historySha256: HISTORY_SHA256, prefixCommandsSha256: PREFIX_SHA256, provenance: old.provenance, frozenSourceKeys: runtime.frozenSourceKeys,
      freezeSha256: freeze.sha256, initial, state: initialState, anchor: initial, commandCount: PREFIX_COUNT, newCount: 0,
      rowSha256: previous, lastRow: null, pending: null, snapshots: [], terminal: null,
      migration: { fromSchema: old.source.schemaVersion, toSchema: initialState.schemaVersion, initialStateSha256: initial.privateStateSha256 } }, initialView, ['initial']);
    saved = checkpointSave(checkpoint, cp, null);
  }
  const checkHeader = () => {
    const cp = saved.payload;
    assert.equal(cp.sourceSha256, SOURCE_SHA256); assert.equal(cp.sourceStateSha256, SOURCE_STATE_SHA256); assert.equal(cp.hashEncoding, HASH_ENCODING);
    assert.equal(cp.historySha256, HISTORY_SHA256); assert.equal(cp.prefixCommandsSha256, PREFIX_SHA256);
    assert.deepEqual(cp.provenance, old.provenance); assert.deepEqual(cp.frozenSourceKeys, runtime.frozenSourceKeys);
    assert.equal(cp.freezeSha256, freeze.sha256); assert.deepEqual(cp.initial, initial);
    assert(Number.isSafeInteger(cp.newCount) && cp.newCount >= 0);
    assert.equal(cp.commandCount, PREFIX_COUNT + cp.newCount); assert.equal(cp.state.revision, SOURCE_REVISION + cp.newCount);
    assertOriginalRoots(cp.state, old.source, runtime.frozenSourceKeys);
    assert.equal(stateHash(cp.state), cp.anchor.privateStateSha256); assert.deepEqual(cp.state.random, cp.anchor.random);
    if (cp.pending) { assert.deepEqual(cp.pending.before, cp.anchor); assert.equal(cp.pending.commandCount, cp.commandCount + 1); }
  };
  checkHeader();
  if (saved.payload.state.hermit.guidanceKnown) session = runtime.openHermitRuntimeSession(saved.payload.state);
  const project = () => {
    const view = session ? session.project() : runtime.projectSliceState(saved.payload.state); auditPublic(view, saved.payload.state); return view;
  };
  let view = project(); assert.deepEqual(anchor(saved.payload.state, view), saved.payload.anchor);
  if (readOnly) assert.equal(saved.payload.pending, null, 'Zero-action resume cannot execute an uncommitted pending intent');
  reconcileTrace(tracePath, saved.payload, old.prefixCommands, initial, readOnly);
  materializeSnapshots(options.out, saved.payload, view, { readOnly, verifyAll: true }); unchanged(frozen);
  assert(!readdirSync(options.out).some(name => name.endsWith('.next')), 'Unrecognized/incomplete successor preserved; inspect before any new action');
  if (readOnly) {
    assert.deepEqual(inspectFreeze(root, options.source), freeze); runtime.assertValidSliceState(saved.payload.state);
    const result = { stage: 'STRICT_RESUME_VERIFIED_ZERO_ACTIONS', commandCount: saved.payload.commandCount, newActions: 0,
      revision: saved.payload.state.revision, changedCaptureBytes: false, actual: outcome(saved.payload.state) };
    console.log(JSON.stringify(result)); return result;
  }
  const requestPause = () => { pauseRequested = true; };
  process.on('SIGINT', requestPause); process.on('SIGTERM', requestPause);
  let stop = saved.payload.terminal;
  try {
    while (!stop) {
      await new Promise(resolve => setImmediate(resolve)); unchanged(frozen);
      const cp = saved.payload;
      stop = terminal(cp.state, view); if (stop) break;
      if (!cp.pending && (count >= options.maxNewActions || pauseRequested)) {
        stop = { stage: 'MANUAL_PAUSE', reason: 'Requested completed-action boundary; same frozen capture can resume' }; break;
      }
      if (!cp.pending) {
        const decision = chooseAction(view);
        if (decision.stop) { stop = { stage: decision.stop, reason: decision.reason }; break; }
        const pending = { ...decision, before: cp.anchor, commandCount: cp.commandCount + 1 };
        saved = checkpointSave(checkpoint, planSnapshot({ ...cp, pending }, view,
          snapshotReasons({ newCount: cp.newCount, beforeIntent: decision.intent })), saved.sha256);
        materializeSnapshots(options.out, saved.payload, view);
      }
      const before = saved.payload.state, pending = saved.payload.pending;
      assert.deepEqual(chooseAction(view), { intent: pending.intent, publicAction: pending.publicAction }, 'Pending command is no longer the exact public recommendation');
      assert.deepEqual(anchor(before, view), pending.before);
      let draft = null, next, afterView;
      if (session) {
        draft = session.prepare(pending.intent, before.revision); next = session.snapshotDraft(draft); afterView = session.projectDraft(draft);
      } else {
        next = runtime.applySliceIntent(before, pending.intent);
        assert(next.hermit.guidanceKnown, 'The first real command must open this owned chapter');
        session = runtime.openHermitRuntimeSession(next); afterView = session.project();
      }
      assertOriginals(next, old.source, before, runtime.frozenSourceKeys, pending.intent); auditPublic(afterView, next);
      const nextAnchor = anchor(next, afterView), newCount = saved.payload.newCount + 1;
      const row = sealRow({ kind: 'HERMIT_ACTION', commandCount: pending.commandCount, newCount,
        previousRowSha256: saved.payload.rowSha256, intent: pending.intent, commandSha256: stateHash(pending.intent),
        publicAction: pending.publicAction, before: pending.before, after: nextAnchor, receipt: receipt(next, before), actual: outcome(next) });
      const completed = planSnapshot({ ...saved.payload, state: next, anchor: nextAnchor, commandCount: pending.commandCount,
        newCount, rowSha256: row.rowSha256, lastRow: row, pending: null }, afterView,
      snapshotReasons({ newCount, afterIntent: pending.intent, terminal: next.status !== 'ACTIVE' }));
      saved = checkpointSave(checkpoint, completed, saved.sha256);
      // Result is durable now. A crash below is repaired from this checkpoint.
      reconcileTrace(tracePath, saved.payload, old.prefixCommands, initial, false);
      materializeSnapshots(options.out, saved.payload, afterView);
      if (draft) session.commit(draft);
      count++; view = afterView;
      console.log(JSON.stringify({ commandCount: saved.payload.commandCount, newCount, revision: next.revision, action: pending.publicAction.label, actual: outcome(next) }));
    }
    checkHeader(); unchanged(frozen); assert.deepEqual(inspectFreeze(root, options.source), freeze);
    runtime.assertValidSliceState(saved.payload.state);
    if (session) assert.equal(stateHash(session.snapshot()), saved.payload.anchor.privateStateSha256);
    if (stop.stage !== 'MANUAL_PAUSE') {
      const finished = planSnapshot({ ...saved.payload, terminal: stop.stage.startsWith('NATURAL_') ? stop : null }, view, ['terminal']);
      saved = checkpointSave(checkpoint, finished, saved.sha256);
    }
    materializeSnapshots(options.out, saved.payload, view, { verifyAll: true });
    reconcileTrace(tracePath, saved.payload, old.prefixCommands, initial, false);
    const summary = { format: FORMAT, hashEncoding: HASH_ENCODING, ...stop, commandCount: saved.payload.commandCount, originalCommandCount: PREFIX_COUNT,
      newCount: saved.payload.newCount, newActionsThisInvocation: count, revision: saved.payload.state.revision, actual: outcome(saved.payload.state),
      finalPrivateStateSha256: saved.payload.anchor.privateStateSha256, finalWholePublicSha256: saved.payload.anchor.publicStateSha256,
      sourceSha256: SOURCE_SHA256, historySha256: HISTORY_SHA256, prefixCommandsSha256: PREFIX_SHA256,
      provenance: old.provenance, frozenSourceKeys: runtime.frozenSourceKeys, runtimeFreezeSha256: freeze.sha256, strictFinalValidation: true,
      evidence: 'Exact living snapshot + separate full831 DEAD archive + original827 ordered prefix + new commands and per-action private/RNG/whole-public hash chain + sparse gzip full snapshots + one rolling full checkpoint',
      historicalPrefixReplayed: false, fullNaturalS9ToS0: outcome(saved.payload.state).promoted, randomOverridden: false, futureDrawInspected: false, selectedPublicPreferredOnly: true,
      sqliteReopen: 'NOT_RUN_BY_PRODUCER', packageReopen: 'NOT_RUN_BY_PRODUCER', keySnapshots: saved.payload.snapshots };
    writeSummary(options.out, summary); console.log(JSON.stringify({ outputDir: options.out, ...stop, commandCount: summary.commandCount, revision: summary.revision }));
    return summary;
  } finally { process.off('SIGINT', requestPause); process.off('SIGTERM', requestPause); }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
