import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

// NEW217 only. Import and --preflight never import the producer/game, open
// SQLite, execute commands or write files. Runtime verification requires a
// separately reviewed complete capture manifest and the exact frozen checkout.
// Selected actual beforeLast -> intent -> final transitions only; no historical
// replay, alternate runtime, injected roll, invented outcome or older32/34 proof.
const SELF = fileURLToPath(import.meta.url);
export const FORMAT = 'DEATH217_SELECTED_SQLITE_AUDIT_V1';
export const INPUT_FORMAT = 'DEATH217_CAPTURE_FILES_V1';
const PRODUCER = 'scripts/play/death-stage.mjs';
const PRODUCER_TEST = 'scripts/play/death-stage.test.mjs';
const VERIFIER_TEST = 'scripts/verify/death-save.test.mjs';
const SOURCE = 'tests/fixtures/pale-emperor-v01950/natural.json';
const SOURCE_SHA = '14be49645e7fa18b4127c7ec34b39875eff1302fbba8052b9037ed149a42d66c';
const SOURCE_STATE_SHA = '171748e310a3f2f52f96d710d01610fa3aa296e516e87fe29f2d0ca7d1709276';
const PREFIX_SHA = '7441863b7eef57b05b2ee7f35f7f9f0d052555b82a2727ef4c1d54219973a9a4';
const CAPTURE_FORMAT = 'NEW217_RESTORED195_LIVING1038_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
const PREFIX_ENCODING = 'JSON_STRINGIFY_UTF8_ORIGINAL_OBJECT_KEY_ORDER';
const STATE_ENCODING = 'STABLE_STRINGIFY_CANONICAL_JSON_UTF8';
const PREFIX = 1038, LIMIT = 64;
const INITIAL_TIME = '2026-10-18T00:00:00.000Z', COMMIT_TIME = '2026-10-18T00:00:01.000Z';
const CHECKS = ['strict-before-save', 'read-only-bootstrap-no-write-hook', 'beforeWrite-rollback', 'COMMIT-rollback',
  'private-head-rng-receipts-selection-timestamps-backups-unchanged', 'rollback-reopen', 'exact-same-intent-retry',
  'exact-private-rng-chapter-and-whole-player-public', 'commit-reopen-load', 'duplicate-idempotent', 'final-reopen'];
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const whole = value => Number.isSafeInteger(value) && value >= 0;
const sha = value => createHash('sha256').update(value).digest('hex');
const compactHash = value => sha(JSON.stringify(value));
export function stable(value) {
  const canonical = node => {
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return node;
    if (typeof node === 'number') { assert(Number.isFinite(node), 'Non-finite canonical number'); return Object.is(node, -0) ? 0 : node; }
    if (Array.isArray(node)) return node.map(canonical);
    assert(node && typeof node === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(node)), 'Non-JSON canonical value');
    return Object.fromEntries(Object.keys(node).sort().map(key => [key, canonical(node[key])]));
  };
  return JSON.stringify(canonical(value));
}
export const stateHash = value => sha(stable(value));
const json = path => JSON.parse(readFileSync(path, 'utf8'));
function keys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), label);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
}
function regular(path) {
  assert.equal(realpathSync(path), path, `No symlink input or output: ${path}`);
  assert(lstatSync(path).isFile(), `Expected regular file: ${path}`); return path;
}
function directory(path) {
  const result = resolve(path); assert.equal(realpathSync(result), result, 'No directory symlinks');
  assert(lstatSync(result).isDirectory()); return result;
}
function contains(root, path) { const r = relative(root, path); return r === '' || r !== '..' && !r.startsWith(`..${sep}`) && !r.startsWith(sep); }
export function safeRelativeFile(file) {
  assert(typeof file === 'string' && file.length > 0 && !file.includes('\\') && !file.includes('\0'));
  assert(!file.startsWith('/') && !/^[A-Za-z]:/.test(file));
  assert(file.split('/').every(part => part && part !== '.' && part !== '..'), 'Only normalized relative file paths'); return file;
}
export function fileEvidence(path) {
  regular(path); const before = lstatSync(path, { bigint: true }), fd = openSync(path, 'r'), h = createHash('sha256'), buffer = Buffer.allocUnsafe(65536); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; h.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  const after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(after[key], before[key], 'Input changed while hashing');
  assert.equal(BigInt(bytes), after.size); return { bytes, sha256: h.digest('hex') };
}
export function inspectCaptureInputs(root) {
  root = directory(root); const files = [];
  const walk = name => {
    const path = join(root, name), stat = lstatSync(path); assert(!stat.isSymbolicLink(), 'No capture symlinks');
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(name ? `${name}/${child}` : child);
    else { assert(stat.isFile(), 'Only regular capture files'); files.push({ file: safeRelativeFile(name), ...fileEvidence(path) }); }
  };
  walk(''); return { format: INPUT_FORMAT, files: files.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0) };
}
export function assertInputManifest(actual, expected) {
  for (const manifest of [actual, expected]) {
    keys(manifest, ['format', 'files'], 'Exact capture manifest'); assert.equal(manifest.format, INPUT_FORMAT);
    assert(Array.isArray(manifest.files) && manifest.files.length > 0, 'Empty capture is not evidence'); const names = [];
    for (const row of manifest.files) {
      keys(row, ['file', 'bytes', 'sha256'], 'Capture file evidence'); names.push(safeRelativeFile(row.file));
      assert(whole(row.bytes) && digest(row.sha256));
    }
    assert.equal(new Set(names).size, names.length, 'Duplicate capture filename'); assert.deepEqual(names, [...names].sort());
  }
  assert.deepEqual(actual, expected, 'Exact complete capture file/hash set changed');
}
export function assertFreeze(captured, current) {
  for (const freeze of [captured, current]) {
    keys(freeze, ['sha256', 'nodeVersion', 'files'], 'Exact frozen runtime'); assert(digest(freeze.sha256)); assert(/^v\d+\.\d+\.\d+$/.test(freeze.nodeVersion));
    assert(Array.isArray(freeze.files) && freeze.files.length > 0); const names = new Set();
    for (const row of freeze.files) {
      keys(row, ['file', 'bytes', 'sha256'], 'Frozen file');
      if (row.file !== '$natural-producer') safeRelativeFile(row.file);
      assert(!names.has(row.file), 'Duplicate frozen file'); names.add(row.file); assert(whole(row.bytes) && digest(row.sha256));
    }
    assert.equal(compactHash(freeze.files), freeze.sha256);
  }
  assert.deepEqual(current, captured, 'Source, compiled runtime, producer and dependencies must match exactly');
}
function inspectFreeze(repo) {
  const files = [], walk = file => {
    const path = join(repo, file), stat = lstatSync(path); assert(!stat.isSymbolicLink());
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(join(file, child));
    else { assert(stat.isFile()); files.push({ file: file.split(sep).join('/'), ...fileEvidence(path) }); }
  };
  assert(existsSync(join(repo, 'dist/domain/death/owned-session.js')), 'Build and freeze the reviewed Death runtime before auditing');
  for (const file of ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution',
    'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation', 'node_modules/@noble/hashes']) walk(file);
  files.push({ file: '$natural-producer', ...fileEvidence(join(repo, PRODUCER)) },
    { file: PRODUCER_TEST, ...fileEvidence(join(repo, PRODUCER_TEST)) });
  return { sha256: compactHash(files), nodeVersion: process.version, files };
}
export function assertResumeManifest(saved, current) {
  assert.deepEqual(saved, current, 'Resume requires the exact capture, selection, source, runtime, Node and verifier/test bytes');
}
const ACTION_FIELDS = ['commandCount', 'beforeLast', 'lastIntent', 'final', 'randomBefore', 'randomAfter', 'publicBefore',
  'public', 'globalPublicBefore', 'globalPublic', 'policyBefore', 'policyAfter', 'audit'];
function gzipBytes(path) { regular(path); return gunzipSync(readFileSync(path)); }
function capturedJson(path) { return JSON.parse(gzipBytes(path).toString('utf8')); }
export function selectBoundaries(index, readBoundary) {
  assert(Array.isArray(index) && index.length > 0 && index.length <= LIMIT, 'Require 1..64 actual named boundaries');
  const selected = new Map(), identities = new Set();
  for (const item of index) {
    keys(item, ['file', 'kind', 'commandCount', 'bytes', 'sha256'], 'Captured boundary index'); safeRelativeFile(item.file);
    assert(typeof item.kind === 'string' && /^[A-Za-z0-9_.:-]+$/.test(item.kind), 'Actual named semantic boundary');
    assert(whole(item.commandCount) && item.commandCount > PREFIX && whole(item.bytes) && item.bytes > 0 && digest(item.sha256));
    assert.equal(item.file, `action-${item.commandCount}.json.gz`, 'Every selected case is the original complete action capture');
    const identity = `${item.commandCount}:${item.kind}`;
    assert(!identities.has(identity), 'Duplicate boundary alias'); identities.add(identity);
    const boundary = readBoundary(item); keys(boundary, ACTION_FIELDS, 'Actual full producer action');
    assert.equal(boundary.commandCount, item.commandCount);
    const hash = stateHash(boundary), prior = selected.get(item.commandCount);
    if (prior) {
      assert.equal(prior.boundarySha256, hash, 'One command count must identify the identical actual transition');
      if (!prior.files.includes(item.file)) prior.files.push(item.file); prior.kinds.push(item.kind);
    } else selected.set(item.commandCount, { commandCount: item.commandCount, kinds: [item.kind], files: [item.file], boundarySha256: hash });
  }
  return [...selected.values()].map(item => ({ ...item, kinds: item.kinds.sort(), files: item.files.sort() })).sort((a, b) => a.commandCount - b.commandCount);
}
// Independent bounded taxonomy. It does not require an outcome to have occurred.
export function assertBoundarySelection(rows, selected) {
  const expected = [], seen = new Set();
  for (const row of rows) {
    assert.equal(row.intent.type, 'DEATH'); const c = row.intent.command, outcome = row.selectionOutcome;
    assert(outcome && ['ACTIVE', 'DEAD', 'SLICE_COMPLETE', 'REVIVAL_PENDING'].includes(outcome.status)); let kind = null;
    if (['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','STABILIZE_PROMOTION','START_EPILOGUE','RETURN_ON_FOOT'].includes(c.type)) kind = `death-${c.type.toLowerCase()}`;
    if (c.type === 'TRAVEL') kind = `death-travel-${c.to}`;
    if (c.type === 'SERVICE') {
      assert(['residue-sealing', 'old-wharf-exit'].includes(c.command.serviceId));
      kind = `service-${c.command.serviceId}-${c.command.type.toLowerCase()}`;
    }
    if (c.type === 'MATERIAL') kind = `material-${c.command.type.toLowerCase()}-${c.command.bottleId ?? c.command.step ?? c.command.batchId ?? c.command.compoundId ?? 'unique'}`;
    if (c.type === 'CONSUME') kind = outcome.status !== 'ACTIVE' ? 'death-actual-terminal-dose' : outcome.promoted ? 'death-actual-promotion' : `death-failed-dose-${c.compoundId}`;
    if (c.type === 'EPILOGUE') kind = `epilogue-${c.command.type.toLowerCase()}`;
    if (outcome.status !== 'ACTIVE') kind = 'death-actual-terminal';
    const ordinaryCount = expected.filter(item => !item.kinds.includes('death-actual-terminal')).length;
    if (kind && !seen.has(kind) && expected.length < LIMIT && (outcome.status !== 'ACTIVE' || ordinaryCount < LIMIT - 1)) {
      seen.add(kind); expected.push({ commandCount: row.commandCount, kinds: [kind] });
    }
  }
  assert.deepEqual(selected.map(({ commandCount, kinds }) => ({ commandCount, kinds })), expected,
    'Exactly the first 63 ordinary names plus one reserved actual terminal, capped at 64, with no invented outcome');
}
export function assertActionCapture(content, row) {
  keys(content, ACTION_FIELDS, 'Exact full actual action capture');
  assert.equal(content.commandCount, row.commandCount); assert.deepEqual(content.lastIntent, row.intent);
  const { capture: ignored, ...audit } = row; assert.deepEqual(content.audit, { ...audit, elapsedMilliseconds: null });
  for (const [field, hash] of [['beforeLast','beforeStateSha256'], ['final','afterStateSha256'], ['publicBefore','publicBeforeSha256'],
    ['public','publicAfterSha256'], ['globalPublicBefore','globalPublicBeforeSha256'], ['globalPublic','globalPublicAfterSha256'],
    ['policyBefore','policyBeforeSha256'], ['policyAfter','policyAfterSha256']]) assert.equal(stateHash(content[field]), row[hash]);
  assert.deepEqual(content.randomBefore, row.randomBefore); assert.deepEqual(content.randomAfter, row.randomAfter);
  assert.deepEqual(content.beforeLast.random, row.randomBefore); assert.deepEqual(content.final.random, row.randomAfter);
  for (const state of [content.beforeLast, content.final]) {
    assert.equal(state.schemaVersion, 214); assert.equal(state.contentVersion, 'death-v214');
    assert.equal(state.runId, 'corpsecollector-rebuild-natural');
  }
  assert.equal(content.beforeLast.status, 'ACTIVE'); assert.equal(content.beforeLast.revision, row.commandCount);
  assert.equal(content.final.revision, row.commandCount + 1);
  // The producer records selectionOutcome(content.public). DeathState owns
  // promotionWeek; promoted is a required boolean on the captured projection.
  assert.equal(typeof content.public.death.promoted, 'boolean', 'Captured public promoted must be boolean');
  assert.equal(content.public.status, content.final.status);
  assert.equal(content.public.progression.sequence, content.final.progression.sequence);
  assert.equal(content.public.death.guidanceKnown, content.final.death.guidanceKnown);
  assert.deepEqual(row.selectionOutcome, { status: content.public.status, sequence: content.public.progression.sequence,
    promoted: content.public.death.promoted, guidance: content.public.death.guidanceKnown });
}
function readCapture(root, repo, freeze, inputs) {
  for (const row of inputs.files) assert(!row.file.endsWith('.next') && !row.file.endsWith('.derived-next'),
    'Unresolved producer successor is not a frozen closed capture; preserve and recover it first');
  const sourceBytes = readFileSync(regular(join(repo, SOURCE))); assert.equal(sha(sourceBytes), SOURCE_SHA);
  assert(gzipBytes(join(root, 'archived-original195-natural.json.gz')).equals(sourceBytes), 'Original195 bytes must be retained exactly');
  const history = JSON.parse(sourceBytes), source = history.final;
  assert.equal(stateHash(source), SOURCE_STATE_SHA); assert.equal(history.commands.length, PREFIX); assert.equal(compactHash(history.commands), PREFIX_SHA);
  assert.equal(source.schemaVersion, 192); assert.equal(source.contentVersion, 'pale-emperor-v192');
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.revision, PREFIX + 1); assert.equal(source.week, 3323);
  assert.equal(source.runId, 'corpsecollector-rebuild-natural'); assert.equal(history.seed, source.random.seed);
  assert.deepEqual(source.random, { seed: 'corpsecollector-natural-v032', cursor: 490 });
  const inputFiles = [{ file: SOURCE, sha256: SOURCE_SHA, bytes: sourceBytes.length }];
  const inputFreeze = json(join(root, 'input-freeze.json'));
  assert.deepEqual(inputFreeze, { format: 'NEW217_RESTORED195_HISTORICAL_INPUTS_V1', sha256: compactHash(inputFiles), files: inputFiles,
    originalStateSha256: SOURCE_STATE_SHA, stateHashEncoding: STATE_ENCODING, sourceRoot: 'final', prefixSha256: PREFIX_SHA,
    prefixHashEncoding: PREFIX_ENCODING, archivedCommandCount: PREFIX });
  const wrapped = capturedJson(join(root, 'checkpoint.json.gz')), cp = wrapped.payload;
  keys(wrapped, ['sha256', 'payload'], 'Durable checkpoint'); assert.equal(wrapped.sha256, stateHash(cp));
  keys(cp, ['format','source','sourceSha256','prefixSha256','prefixHashEncoding','stateHashEncoding','inputFreezeSha256','runtimeFreezeSha256',
    'policyDefinition','policy','migration','createdAt','commandCount','commands','rows','boundaries','state','initialStateSha256',
    'finalStateSha256','initialPublicSha256','publicStateSha256','initialGlobalPublicSha256','globalPublicStateSha256',
    'initialRandomSha256','pending','terminal','predecessorSha256'], 'Exact durable producer checkpoint');
  assert.equal(cp.format, CAPTURE_FORMAT); assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_SHA);
  assert.equal(cp.prefixSha256, PREFIX_SHA); assert.equal(cp.prefixHashEncoding, PREFIX_ENCODING); assert.equal(cp.stateHashEncoding, STATE_ENCODING);
  assert.equal(cp.inputFreezeSha256, inputFreeze.sha256); assert.equal(cp.runtimeFreezeSha256, freeze.sha256);
  assert.equal(cp.policyDefinition.selectedBoundaryLimit, LIMIT); assert.equal(cp.policyDefinition.selectedBoundaryTerminalReserve, 1);
  assert.equal(cp.pending, null, 'Pending natural command must be resolved by the original producer first');
  assert(Number.isFinite(Date.parse(cp.createdAt))); assert(digest(cp.predecessorSha256));
  assert(Array.isArray(cp.commands) && cp.commands.length > 0 && Array.isArray(cp.rows));
  assert.equal(cp.commandCount, PREFIX + cp.commands.length); assert.equal(cp.rows.length, cp.commands.length);
  assert.equal(cp.finalStateSha256, stateHash(cp.state));
  const initial = capturedJson(join(root, 'migration-initial.json.gz'));
  keys(initial, ['originalStateSha256','migratedStateSha256','publicSha256','globalPublicSha256','final','random','public','globalPublic'], 'Migration evidence');
  assert.deepEqual(cp.migration, { originalStateSha256: SOURCE_STATE_SHA, migratedStateSha256: cp.initialStateSha256, fromSchema: 192, toSchema: 214 });
  assert.equal(initial.originalStateSha256, SOURCE_STATE_SHA); assert.equal(initial.migratedStateSha256, cp.initialStateSha256);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key)) assert.deepEqual(initial.final[key], value, `Original living1038 migration preserves ${key}`);
  assert.equal(initial.final.schemaVersion, 214); assert.equal(initial.final.contentVersion, 'death-v214');
  assert.equal(stateHash(initial.final), cp.initialStateSha256); assert.deepEqual(initial.random, source.random);
  assert.equal(stateHash(initial.public), cp.initialPublicSha256); assert.equal(initial.publicSha256, cp.initialPublicSha256);
  assert.equal(stateHash(initial.globalPublic), cp.initialGlobalPublicSha256); assert.equal(initial.globalPublicSha256, cp.initialGlobalPublicSha256);
  assert.equal(stateHash(initial.random), cp.initialRandomSha256);
  const capture = capturedJson(join(root, 'natural.json.gz')), summary = json(join(root, 'summary.json'));
  keys(capture, ['provenance','creation','seed','prefixCount','commands','policy','stage','reason','pendingIntent','boundaries','final'], 'Exact NEW217 natural capture');
  assert.deepEqual(capture.commands, [...history.commands, ...cp.commands]); assert.deepEqual(capture.final, cp.state);
  assert.equal(capture.prefixCount, PREFIX); assert.equal(capture.seed, history.seed); assert.deepEqual(capture.creation, history.creation);
  assert.deepEqual(capture.policy, cp.policyDefinition); assert.equal(capture.pendingIntent, null); assert.deepEqual(capture.boundaries, cp.boundaries);
  const p = capture.provenance;
  assert.deepEqual(p, { kind: 'NEW217_FROM_RESTORED195_LIVING1038_PUBLIC_DEATH_CONTINUATION', format: 'NEW217_REBUILD_PROVENANCE_V1',
    newNatural217: true, rebuiltFromRestoredVolume195: true, source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final',
    originalStateSha256: SOURCE_STATE_SHA, originalEvidence: ['archived-original195-natural.json.gz'], prefixCommandsSha256: PREFIX_SHA,
    prefixCommandsHashEncoding: PREFIX_ENCODING, stateHashEncoding: STATE_ENCODING, inputFreezeSha256: inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256,
    historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, completeOriginalSourceRetainedExactly: true,
    alternateSourceUsed: false, privateAudit: true, seedChanged: false, randomOverridden: false, futureDrawInspected: false,
    selectedFromEnabledPublicActionsOnly: true, everyActionEvidence: 'FULL_PRIVATE_RNG_CHAPTER_PUBLIC_AND_GLOBAL_PUBLIC_BEFORE_AND_AFTER_GZIP',
    selectedSQLiteBoundaries: 'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER',
    globalPublicScope: 'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH', projectionScope: 'POSITIVE_DEATH_AND_ORDINARY_PUBLIC_DASHBOARD' });
  assert(['MANUAL_PAUSE','PUBLIC_ACTION_BLOCKED','PUBLIC_NO_PROGRESS_DIAGNOSTIC','NATURAL_ACTUAL_TERMINAL','NATURAL_FINITE_DEATH_REPORTED'].includes(capture.stage));
  assert.equal(typeof capture.reason, 'string');
  const paused = capture.stage === 'MANUAL_PAUSE', diagnostic = capture.stage.startsWith('PUBLIC_');
  assert.deepEqual(summary, { stage: capture.stage, reason: capture.reason, commands: cp.commandCount, originalCommands: PREFIX,
    newCommands: cp.commands.length, rebuild: 'NEW217', newNatural217: true, controlledStop: paused, week: cp.policy.week,
    paused, diagnostic, strictFinalValidation: true, sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', packageReopenValidation: 'NOT_RUN_BY_PRODUCER',
    recoveryManifest: 'recovery-manifest.json', checkpoint: 'checkpoint.json.gz', public: summary.public });
  assert.equal(stateHash(summary.public), cp.publicStateSha256);
  assert.deepEqual(cp.terminal, paused || diagnostic ? null : { stage: capture.stage, reason: capture.reason });
  assert.equal(gzipBytes(join(root, 'commands.ndjson.gz')).toString('utf8'), cp.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  assert.deepEqual(json(join(root, 'boundaries.index.json')), cp.boundaries);
  for (const [captured, frozen] of [['producer.mjs', '$natural-producer'], ['producer-tests.mjs', PRODUCER_TEST]]) {
    const row = freeze.files.find(file => file.file === frozen); assert(row); assert.deepEqual(fileEvidence(join(root, captured)), { bytes: row.bytes, sha256: row.sha256 });
  }
  const recovery = json(join(root, 'recovery-manifest.json'));
  keys(recovery, ['sha256','payload'], 'Recovery manifest envelope'); assert.equal(recovery.sha256, stateHash(recovery.payload));
  assert.deepEqual(recovery.payload, { format: `${CAPTURE_FORMAT}_RECOVERY`, commandCount: cp.commandCount, checkpointSha256: wrapped.sha256,
    inputFreezeSha256: inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256, runtimeRequirement: 'SEPARATE_EXACT_FROZEN_CHECKOUT_AND_NODE_VERSION',
    files: inputs.files.filter(row => row.file !== 'recovery-manifest.json') });
  let previous = { state: cp.initialStateSha256, public: cp.initialPublicSha256, global: cp.initialGlobalPublicSha256,
    random: cp.initialRandomSha256, policy: null };
  const actionNames = [];
  for (const [i, row] of cp.rows.entries()) {
    assert.equal(row.commandCount, PREFIX + i + 1); assert.equal(row.revision, row.commandCount + 1);
    assert.equal(row.intent.type, 'DEATH'); assert.deepEqual(row.intent, cp.commands[i]); assert.equal(row.commandSha256, compactHash(row.intent));
    assert.equal(row.beforeStateSha256, previous.state); assert.equal(row.publicBeforeSha256, previous.public);
    assert.equal(row.globalPublicBeforeSha256, previous.global); assert.equal(row.randomBeforeSha256, previous.random);
    if (previous.policy) assert.equal(row.policyBeforeSha256, previous.policy);
    assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore)); assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    assert.equal(row.randomBefore.seed, source.random.seed); assert.equal(row.randomAfter.seed, source.random.seed);
    assert(row.randomAfter.cursor >= row.randomBefore.cursor); assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
    keys(row.capture, ['file','bytes','sha256'], 'Actual action file fingerprint');
    const path = join(root, row.capture.file); assert.deepEqual(fileEvidence(path), { bytes: row.capture.bytes, sha256: row.capture.sha256 });
    const content = capturedJson(path); assertActionCapture(content, row); actionNames.push(row.capture.file);
    previous = { state: row.afterStateSha256, public: row.publicAfterSha256, global: row.globalPublicAfterSha256,
      random: row.randomAfterSha256, policy: row.policyAfterSha256 };
  }
  assert.deepEqual(inputs.files.filter(row => /^action-.*\.json\.gz$/.test(row.file)).map(row => row.file).sort(), actionNames.sort(), 'No unindexed full action');
  assert.equal(previous.state, cp.finalStateSha256); assert.equal(previous.public, cp.publicStateSha256);
  assert.equal(previous.global, cp.globalPublicStateSha256); assert.equal(previous.random, stateHash(cp.state.random));
  assert.equal(previous.policy, stateHash(cp.policy));
  const selected = selectBoundaries(cp.boundaries, item => {
    const row = cp.rows[item.commandCount - PREFIX - 1]; assert(row, 'Boundary outside actual ledger');
    assert.deepEqual({ file: item.file, bytes: item.bytes, sha256: item.sha256 }, row.capture);
    return capturedJson(join(root, item.file));
  });
  assertBoundarySelection(cp.rows, selected); assert.equal(selected[0].commandCount, PREFIX + 1);
  assert.deepEqual(cp.commands[0], { type: 'DEATH', command: { type: 'LEARN_GUIDANCE' } });
  return { cp, source, history, capture, selected, initial, inputFreeze };
}

function sync(path) { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } }
function atomic(path, value) {
  writeFileSync(`${path}.next`, JSON.stringify(value), { flag: 'wx' }); sync(`${path}.next`); renameSync(`${path}.next`, path); sync(dirname(path));
}
export function assertOutputPath(output, forbidden) {
  const target = resolve(output);
  for (const path of forbidden.map(resolvePath => resolve(resolvePath))) assert(!contains(path, target) && !contains(target, path), 'Output overlaps immutable input');
  let existing = target; while (!existsSync(existing)) { const parent = dirname(existing); assert.notEqual(existing, parent); existing = parent; }
  directory(existing); return target;
}
export function claimAuditLock(out, manifestSha256, approvedPid) {
  const path = join(out, 'audit.lock.json'), owner = { format: FORMAT, manifestSha256, pid: process.pid };
  if (existsSync(path)) {
    const prior = json(regular(path)); keys(prior, ['format', 'manifestSha256', 'pid'], 'Audit lock');
    assert.equal(prior.format, FORMAT); assert.equal(prior.manifestSha256, manifestSha256);
    assert(whole(prior.pid) && prior.pid > 0); assert.equal(prior.pid, approvedPid, 'Stale lock removal requires --remove-stale-lock-pid EXACT_PID');
    let dead = false; try { process.kill(prior.pid, 0); } catch (error) { if (error.code === 'ESRCH') dead = true; else throw error; }
    assert(dead, 'Never take over a live or uncertain PID'); rmSync(path);
  } else assert.equal(approvedPid, undefined, 'Approved stale lock does not exist');
  writeFileSync(path, JSON.stringify(owner), { flag: 'wx' }); sync(path); sync(out);
  return () => { assert.deepEqual(json(regular(path)), owner); rmSync(path); sync(out); };
}
function databaseRows(DatabaseSync, path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const result = {};
    for (const [key, sql] of Object.entries({ runs: 'SELECT id,current_json,backup_json,terminal,updated_at FROM slice_runs ORDER BY id',
      receipts: 'SELECT id,fingerprint,receipt_json FROM slice_receipts ORDER BY id', meta: 'SELECT key,value FROM slice_meta ORDER BY key' })) {
      const rows = db.prepare(sql).all(); result[key] = { count: rows.length, sha256: compactHash(rows) };
    }
    assert.equal(Object.values(db.prepare('PRAGMA quick_check').get())[0], 'ok'); return result;
  } finally { db.close(); }
}
function databaseFiles(work) {
  const result = {};
  for (const file of readdirSync(directory(work)).sort()) {
    assert(['phase.json', 'phase.json.next', 'archive.json', 'archive.json.next', 'case.sqlite', 'case.sqlite.bak', 'case.sqlite.sealed',
      'case.sqlite.gz', 'case.sqlite.bak.gz', 'case.sqlite.sealed.gz', 'case.sqlite-journal', 'case.sqlite.bak.tmp', 'case.sqlite.sealed.tmp', 'case.sqlite.sealed.rollback.tmp'].includes(file), `Unknown case artifact retained: ${file}`);
    regular(join(work, file)); if (file.startsWith('case.sqlite') && !file.endsWith('.gz')) result[file] = fileEvidence(join(work, file));
  }
  return result;
}
export function archiveCompletedCase(work, result, completedIndexPath) {
  // The fsynced completed index, VERIFIED phase and exact generated paths are
  // prerequisites. This function cannot discard an unfinished transaction DB.
  work = directory(work); completedIndexPath = regular(resolve(completedIndexPath));
  assert(!existsSync(join(work, 'phase.json.next')), 'Unresolved phase successor must remain raw for inspection');
  const index = json(completedIndexPath), phase = json(regular(join(work, 'phase.json')));
  assert(whole(result.commandCount) && result.commandCount > PREFIX, 'Only actual completed Death transition results');
  const saved = index.results.find(row => row.commandCount === result.commandCount);
  assert.deepEqual(saved, result, 'Only a durable completed-index result authorizes lossless archival');
  assert.equal(work, join(dirname(completedIndexPath), `case-${result.commandCount}`));
  assert.equal(phase.phase, 'VERIFIED', 'Incomplete case stays raw'); assert.equal(phase.input.manifestSha256, index.manifestSha256);
  const present = databaseFiles(work), expected = result.databaseFiles, names = Object.keys(expected).sort();
  assert(names.includes('case.sqlite') && names.includes('case.sqlite.bak'));
  assert(names.every(name => ['case.sqlite', 'case.sqlite.bak', 'case.sqlite.sealed'].includes(name)), 'No unfinished sidecar may be archived');
  for (const name of Object.keys(present)) assert(Object.hasOwn(expected, name), 'Unindexed raw evidence retained');
  for (const name of readdirSync(work).filter(file => file.endsWith('.gz'))) assert(Object.hasOwn(expected, name.slice(0, -3)), 'Unindexed compressed evidence retained');
  const archivePath = join(work, 'archive.json'), recorded = existsSync(archivePath) ? json(regular(archivePath)) : null;
  const archive = { format: 'DEATH217_COMPLETED_SQLITE_GZIP_V1', manifestSha256: index.manifestSha256, files: {} };
  for (const name of names) {
    const rawPath = join(work, name), gzipPath = `${rawPath}.gz`, hasRaw = existsSync(rawPath);
    let raw;
    if (hasRaw) { assert.deepEqual(fileEvidence(rawPath), expected[name]); raw = readFileSync(rawPath); }
    else assert(recorded, 'Missing raw bytes require the already-durable archive manifest');
    if (!existsSync(gzipPath)) {
      assert(raw, 'Missing both original and compressed evidence');
      writeFileSync(gzipPath, gzipSync(raw, { level: 9 }), { flag: 'wx' }); sync(gzipPath); sync(work);
    }
    const compressed = fileEvidence(gzipPath), restored = gunzipSync(readFileSync(gzipPath));
    assert.deepEqual({ bytes: restored.length, sha256: sha(restored) }, expected[name], 'Every decompressed original byte must match');
    if (raw) assert(restored.equals(raw), 'Full gunzip round-trip must be byte-identical');
    archive.files[name] = { original: expected[name], gzip: { file: `${name}.gz`, ...compressed } };
  }
  if (recorded) assert.deepEqual(recorded, archive, 'Compressed evidence or original fingerprint changed');
  if (result.databaseArchives) assert.deepEqual(result.databaseArchives, archive);
  if (existsSync(`${archivePath}.next`)) {
    assert.deepEqual(json(regular(`${archivePath}.next`)), archive, 'Unknown interrupted archive manifest retained');
    renameSync(`${archivePath}.next`, archivePath); sync(work);
  } else if (!recorded) atomic(archivePath, archive);
  // No deletion precedes durable index + archive and complete round-trip checks.
  for (const name of names) if (existsSync(join(work, name))) {
    assert.deepEqual(fileEvidence(join(work, name)), expected[name]); rmSync(join(work, name));
  }
  sync(work); return archive;
}
function equalState(actual, expected) { assert.equal(stateHash(actual), stateHash(expected), 'Exact complete private state'); }
function checkSqlite(runtime, DatabaseSync, work, manifestSha256, transition, boundary) {
  const { beforeLast: before, lastIntent: intent, final: after } = boundary, producer = runtime.producer;
  runtime.assertValidSliceState(before); runtime.assertValidSliceState(after); assert.equal(before.status, 'ACTIVE');
  const publicBefore = runtime.projectSliceState(before), publicAfter = runtime.projectSliceState(after);
  assert.deepEqual(publicBefore, boundary.globalPublicBefore, 'Whole original before-public must match');
  assert.deepEqual(publicAfter, boundary.globalPublic, 'Whole original after-public must match');
  producer.assertGlobalPublic(publicBefore, before); producer.assertGlobalPublic(publicAfter, after);
  assert.deepEqual(producer.capturePublic(publicBefore), boundary.publicBefore);
  assert.deepEqual(producer.capturePublic(publicAfter), boundary.public);
  const beforeSession = before.death.guidanceKnown ? runtime.openDeathRuntimeSession(before) : null;
  const afterSession = runtime.openDeathRuntimeSession(after);
  if (beforeSession) { equalState(beforeSession.snapshot(), before); assert.deepEqual(beforeSession.project(), publicBefore); }
  equalState(afterSession.snapshot(), after); assert.deepEqual(afterSession.project(), publicAfter);
  const decision = producer.chooseAction(boundary.publicBefore, boundary.policyBefore);
  assert(!decision.stop && producer.publicActionStillAvailable(boundary.publicBefore, decision.action));
  assert.deepEqual(decision.action.intent, intent); assert.equal(decision.action.label, boundary.audit.publicLabel);
  assert.equal(decision.action.cost, boundary.audit.publicCost);
  assert.deepEqual(producer.actualReceipts(after, before), boundary.audit.receipts);
  assert.deepEqual(runtime.projectPlayerText(structuredClone(afterSession.projectDeath()), after.character.name), publicAfter.death,
    'Authored Death text follows the same global player-text projection');
  const authoredAfter = afterSession.projectDeath();
  const input = { manifestSha256, transition, beforeStateSha256: stateHash(before), stateSha256: stateHash(after), publicStateSha256: stateHash(publicAfter) };
  const path = join(work, 'case.sqlite'), phasePath = join(work, 'phase.json'); let pending;
  if (!existsSync(work)) { mkdirSync(work); atomic(phasePath, { input, phase: 'ALLOCATED', beforeRows: null, beforeFiles: null, committedRows: null }); }
  else { directory(work); databaseFiles(work); assert(!readdirSync(work).some(file => file.endsWith('.gz') || file.startsWith('archive.json')), 'An unindexed case may not contain archived databases'); }
  assert(!existsSync(`${phasePath}.next`), 'Interrupted phase write retained; inspect before resuming');
  pending = json(regular(phasePath)); keys(pending, ['input', 'phase', 'beforeRows', 'beforeFiles', 'committedRows'], 'Case phase');
  assert.deepEqual(pending.input, input); assert(['ALLOCATED', 'BEFORE_SAVED', 'WRITE_ROLLBACK_VERIFIED', 'COMMIT_ROLLBACK_VERIFIED', 'COMMITTED', 'VERIFIED'].includes(pending.phase));
  const checkpoint = phase => { pending.phase = phase; atomic(phasePath, pending); };
  const envelope = { intentId: `death217:${transition.commandCount}`, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const receipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision, newRevision: after.revision, committedAt: COMMIT_TIME, replayed: false, state: publicAfter };
  const rows = () => databaseRows(DatabaseSync, path);
  let app, injection = null, injected = 0, hooks = 0, beforeHead;
  const expectedHead = state => state.death.guidanceKnown ? { runId: state.runId, revision: state.revision, status: state.status } : null;
  const checkHead = expected => {
    assert.deepEqual(app.repository.ownedHead(before.runId), expected);
    if (expected) assert.deepEqual(app.repository.projectFoolRun(before.runId), expected.revision === before.revision ? publicBefore : publicAfter, 'Private owned head projection is unchanged until COMMIT');
  };
  const exact = (expected, committed) => {
    const saved = app.repository.get(expected.runId); equalState(saved.state, expected); assert.deepEqual(saved.state.random, expected.random);
    assert.equal(saved.updatedAt, committed ? COMMIT_TIME : INITIAL_TIME); assert.equal(app.repository.activeRun(), expected.runId);
    assert.deepEqual(app.repository.receipt(envelope.intentId), committed ? { fingerprint: stable(envelope), receipt } : null);
  };
  const fault = () => { exact(after, true); checkHead(beforeHead); injected++; throw Error(`Injected ${injection} after actual state, receipt and selection`); };
  const open = () => {
    const store = new runtime.SqliteSliceStore(path, { now: () => COMMIT_TIME, beforeWrite: () => { hooks++; if (injection === 'beforeWrite') fault(); } });
    const db = store.repository.db; assert(db instanceof DatabaseSync, 'Use the actual repository SQLite connection'); const exec = db.exec;
    db.exec = function (sql) { if (injection === 'COMMIT' && sql === 'COMMIT') fault(); return exec.call(this, sql); };
    return store;
  };
  const close = () => { app?.close(); app = undefined; };
  const bootstrap = expected => {
    const beforeHooks = hooks, beforeRows = rows(), beforeFiles = databaseFiles(work), boot = app.getBootstrap();
    assert.equal(boot.ok, true); assert.deepEqual(boot.value.activeState, expected); assert.equal(hooks, beforeHooks, 'Bootstrap is a read transaction without write-fault hooks');
    assert.deepEqual(rows(), beforeRows); assert.deepEqual(databaseFiles(work), beforeFiles);
  };
  const assertBefore = () => { exact(before, false); checkHead(expectedHead(before)); assert.deepEqual(rows(), pending.beforeRows); assert.deepEqual(databaseFiles(work), pending.beforeFiles); };
  try {
    app = open();
    if (pending.phase === 'ALLOCATED') {
      if (!app.repository.get(before.runId)) {
        assert.deepEqual(Object.fromEntries(Object.entries(rows()).map(([key, value]) => [key, value.count])), { runs: 0, receipts: 0, meta: 0 });
        app.repository.transaction(() => { app.repository.put({ state: before, updatedAt: INITIAL_TIME }); app.repository.selectRun(before.runId); });
      }
      exact(before, false); close(); app = open(); exact(before, false); bootstrap(publicBefore);
      pending.beforeRows = rows(); pending.beforeFiles = databaseFiles(work); checkpoint('BEFORE_SAVED');
    }
    for (const [phase, mode, next] of [['BEFORE_SAVED', 'beforeWrite', 'WRITE_ROLLBACK_VERIFIED'], ['WRITE_ROLLBACK_VERIFIED', 'COMMIT', 'COMMIT_ROLLBACK_VERIFIED']]) {
      if (pending.phase !== phase) continue;
      assertBefore(); beforeHead = app.repository.ownedHead(before.runId); injected = 0; injection = mode;
      let rejected; try { rejected = app.submitIntent(envelope); } finally { injection = null; }
      assert.equal(rejected.ok, false); assert.equal(rejected.error.code, 'SAVE_FAILED'); assert.equal(injected, 1);
      assertBefore(); close(); app = open(); assertBefore(); bootstrap(publicBefore); checkpoint(next);
    }
    if (pending.phase === 'COMMIT_ROLLBACK_VERIFIED') {
      // A crash can occur after durable COMMIT but before the phase fsync.
      // Reconcile an exact saved receipt; never submit an already committed ID.
      if (app.repository.receipt(envelope.intentId) === null) {
        assertBefore(); const committed = app.submitIntent(envelope); assert.equal(committed.ok, true); assert.deepEqual(committed.value, receipt);
      }
      exact(after, true); checkHead(expectedHead(after)); pending.committedRows = rows(); checkpoint('COMMITTED');
    }
    if (pending.phase === 'COMMITTED') {
      exact(after, true); assert.deepEqual(rows(), pending.committedRows); close(); app = open(); exact(after, true); bootstrap(publicAfter);
      const loaded = app.loadRun(after.runId); assert.equal(loaded.ok, true); assert.deepEqual(loaded.value, publicAfter); assert.deepEqual(rows(), pending.committedRows);
      const duplicateFiles = databaseFiles(work);
      const duplicate = app.submitIntent(envelope); assert.equal(duplicate.ok, true); assert.deepEqual(duplicate.value, { ...receipt, replayed: true });
      exact(after, true); checkHead(expectedHead(after)); assert.deepEqual(rows(), pending.committedRows);
      assert.deepEqual(databaseFiles(work), duplicateFiles, 'Idempotent duplicate cannot alter DB, backup or seal bytes');
      if (after.status === 'DEAD') {
        assert.deepEqual(json(`${path}.sealed`), [after.runId]); assert.equal(publicAfter.canAct, false);
        const blocked = app.submitIntent({ ...envelope, intentId: `${envelope.intentId}:archived`, expectedRevision: after.revision, payload: { type: 'DEATH', command: { type: 'REST' } } });
        assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.deepEqual(rows(), pending.committedRows);
        assert.deepEqual(databaseFiles(work), duplicateFiles, 'Archived rejection retains DB, backup and terminal seal bytes');
      } else assert.equal(existsSync(`${path}.sealed`), false);
      close(); app = open(); exact(after, true); bootstrap(publicAfter); assert.deepEqual(rows(), pending.committedRows); close(); checkpoint('VERIFIED');
    } else { assert.equal(pending.phase, 'VERIFIED'); exact(after, true); assert.deepEqual(rows(), pending.committedRows); close(); }
    return { ...transition, beforeStateSha256: input.beforeStateSha256, stateSha256: input.stateSha256, publicStateSha256: input.publicStateSha256,
      chapterPublicSha256: stateHash(boundary.public), authoredDeathSha256: stateHash(authoredAfter),
      playerChapterSha256: stateHash(publicAfter.death), deathSealed: after.status === 'DEAD' ? 'VERIFIED' : 'NOT_OBSERVED_THIS_TRANSITION', random: after.random,
      revision: after.revision, status: after.status, checks: CHECKS, databaseRows: pending.committedRows, databaseFiles: databaseFiles(work) };
  } finally { injection = null; close(); }
}
export async function verifyDeathCapture(options) {
  const repo = directory(options.repo ?? process.cwd()), root = directory(options.sourceDirectory);
  for (const key of ['freezeSha256', 'verifierSha256', 'inputManifestSha256']) assert(digest(options[key]), `Required reviewed ${key}`);
  assert.equal(resolve(repo, 'scripts/verify/death-save.mjs'), SELF, 'Use the matching reviewed verifier checkout');
  assert.equal(fileEvidence(SELF).sha256, options.verifierSha256);
  const manifestPath = regular(resolve(options.inputManifest)); assert(!contains(root, manifestPath), 'Reviewed manifest must be outside its capture');
  assert.equal(fileEvidence(manifestPath).sha256, options.inputManifestSha256);
  const inputManifest = json(manifestPath); assertInputManifest(inspectCaptureInputs(root), inputManifest);
  const freeze = json(join(root, 'runtime-freeze.json')); assert.equal(freeze.sha256, options.freezeSha256); assertFreeze(freeze, inspectFreeze(repo));
  const data = readCapture(root, repo, freeze, inputManifest);
  if (options.expectedBoundaries !== undefined) assert.equal(data.selected.length, options.expectedBoundaries, 'Unique actual transition count');
  const manifest = { format: FORMAT, databaseRetention: 'VERIFIED_COMPLETED_CASE_GZIP_V1', sourceDirectory: root, repo,
    inputs: inputManifest, inputManifest: { path: manifestPath, ...fileEvidence(manifestPath) }, source: fileEvidence(join(repo, SOURCE)),
    freeze, verifier: fileEvidence(SELF), verifierTests: fileEvidence(join(repo, VERIFIER_TEST)), selected: data.selected, node: process.version };
  const manifestSha256 = stateHash(manifest);
  const recheck = () => {
    assertInputManifest(inspectCaptureInputs(root), inputManifest); assertFreeze(freeze, inspectFreeze(repo));
    assert.deepEqual(fileEvidence(SELF), manifest.verifier); assert.deepEqual(fileEvidence(join(repo, VERIFIER_TEST)), manifest.verifierTests);
    assert.deepEqual(fileEvidence(join(repo, SOURCE)), manifest.source);
    assert.deepEqual({ path: manifestPath, ...fileEvidence(manifestPath) }, manifest.inputManifest);
  };
  if (options.preflight) {
    recheck(); return { preflight: 'PASSED_NO_GAME_NO_PRODUCER_NO_SQLITE_NO_WRITES', manifestSha256,
      stage: data.capture.stage, runtimeFreezeSha256: freeze.sha256, newCommands: data.cp.commands.length,
      uniqueTransitions: data.selected.length, boundaryAliases: data.cp.boundaries.length - data.selected.length,
      naturalOutcome: 'UNCHANGED_CAPTURED_OUTCOME_ONLY', sqlite: 'NOT_RUN' };
  }
  assert(options.outputDirectory || options.resumeDirectory, 'Choose one explicit output or resume directory'); recheck();
  const forbidden = [root, manifestPath, ...['src', 'dist', 'scripts', 'tests', 'test-inputs', 'docs', 'node_modules', '.git'].map(file => join(repo, file))];
  const out = assertOutputPath(options.resumeDirectory ?? options.outputDirectory, forbidden);
  if (options.resumeDirectory) directory(out);
  else { if (existsSync(out)) assert.equal(readdirSync(directory(out)).length, 0, 'New audit output must be empty'); else mkdirSync(out, { recursive: true }); }
  const unlock = claimAuditLock(out, manifestSha256, options.removeStaleLockPid), manifestFile = join(out, 'manifest.json'), indexFile = join(out, 'completed.json');
  let index;
  try {
    if (options.resumeDirectory) { assertResumeManifest(json(regular(manifestFile)), manifest); recheck(); index = json(regular(indexFile)); }
    else { atomic(manifestFile, manifest); index = { manifestSha256, results: [], complete: false }; atomic(indexFile, index); }
    keys(index, ['manifestSha256', 'results', 'complete'], 'Completed audit index'); assert.equal(index.manifestSha256, manifestSha256);
    assert(Array.isArray(index.results) && index.results.length <= data.selected.length); assert.equal(typeof index.complete, 'boolean');
    const expectedFiles = new Set(['manifest.json', 'completed.json', 'audit.lock.json', 'report.json', 'failure.json', ...data.selected.map(item => `case-${item.commandCount}`)]);
    for (const file of readdirSync(out)) assert(expectedFiles.has(file), `Unknown or interrupted audit artifact retained: ${file}`);
    if (index.complete) assert.equal(index.results.length, data.selected.length);
    for (const selected of data.selected.slice(index.results.length + 1)) assert(!existsSync(join(out, `case-${selected.commandCount}`)), 'Only the first incomplete case may have unindexed evidence');
    for (const [i, result] of index.results.entries()) {
      const selected = data.selected[i]; assert.equal(result.commandCount, selected.commandCount); assert.deepEqual(result.files, selected.files);
      assert.deepEqual(result.kinds, selected.kinds); assert.equal(result.boundarySha256, selected.boundarySha256);
      const row = data.cp.rows[result.commandCount - PREFIX - 1]; assert.equal(result.beforeStateSha256, row.beforeStateSha256);
      assert.equal(result.stateSha256, row.afterStateSha256); assert.equal(result.publicStateSha256, row.globalPublicAfterSha256);
      assert.equal(result.chapterPublicSha256, row.publicAfterSha256); assert.equal(result.revision, row.revision);
      assert.deepEqual(result.random, row.randomAfter); assert.deepEqual(result.checks, CHECKS);
      assert.equal(result.status, row.selectionOutcome.status);
      const original = capturedJson(join(root, selected.files[0]));
      assert.equal(result.playerChapterSha256, stateHash(original.globalPublic.death));
      assert.equal(result.deathSealed, result.status === 'DEAD' ? 'VERIFIED' : 'NOT_OBSERVED_THIS_TRANSITION');
      const work = join(out, `case-${result.commandCount}`), phase = json(regular(join(work, 'phase.json')));
      assert.equal(phase.phase, 'VERIFIED'); assert.equal(phase.input.manifestSha256, manifestSha256); assert.deepEqual(phase.input.transition, selected);
      assert.equal(phase.input.beforeStateSha256, result.beforeStateSha256); assert.equal(phase.input.stateSha256, result.stateSha256);
      assert.equal(phase.input.publicStateSha256, result.publicStateSha256); assert.deepEqual(phase.committedRows, result.databaseRows);
      const archive = archiveCompletedCase(work, result, indexFile);
      if (!result.databaseArchives) { result.databaseArchives = archive; atomic(indexFile, index); }
    }
    // Imports happen only after every input byte, manifest, output and resume
    // contract has passed. No game command is run to create audit input.
    const [slice, migration, store, playerText, session, producer, sqlite] = await Promise.all([
      'dist/domain/slice/index.js', 'dist/domain/slice/migration.js', 'dist/persistence/slice-store.js',
      'dist/shared/player-text.js', 'dist/domain/death/owned-session.js', PRODUCER
    ].map(file => import(pathToFileURL(join(repo, file)).href)).concat(import('node:sqlite')));
    const runtime = { ...slice, ...migration, ...store, ...playerText, ...session, producer };
    assert.equal(producer.PREFIX_COUNT, PREFIX); assert.equal(producer.SOURCE_SHA256, SOURCE_SHA); assert.equal(producer.FORMAT, CAPTURE_FORMAT);
    assert.equal(producer.POLICY.selectedBoundaryLimit, LIMIT); assert.equal(producer.POLICY.selectedBoundaryTerminalReserve, 1);
    producer.verifyRecoveryManifest(root);
    const old = producer.readSource(repo); assert.deepEqual(old.inputFreeze, data.inputFreeze);
    const initial = producer.migrate(runtime, data.source); equalState(initial, data.initial.final);
    producer.verifyCheckpoint(data.cp, freeze, stateHash(initial), data.inputFreeze);
    const globalInitial = runtime.projectSliceState(initial); producer.assertGlobalPublic(globalInitial, initial);
    assert.deepEqual(globalInitial, data.initial.globalPublic);
    assert.deepEqual(producer.capturePublic(globalInitial), data.initial.public);
    runtime.assertValidSliceState(data.cp.state);
    const finalSession = runtime.openDeathRuntimeSession(data.cp.state); equalState(finalSession.snapshot(), data.cp.state);
    const finalGlobal = finalSession.project(); producer.assertGlobalPublic(finalGlobal, data.cp.state);
    assert.equal(stateHash(finalGlobal), data.cp.globalPublicStateSha256);
    assert.equal(stateHash(producer.capturePublic(finalGlobal)), data.cp.publicStateSha256);
    for (const row of data.cp.rows) {
      const actual = capturedJson(join(root, row.capture.file)); producer.verifyActionCapture(actual, row);
      producer.checkOriginals(actual.final, data.source, actual.beforeLast);
    }
    const first = capturedJson(join(root, data.selected[0].files[0])); equalState(first.beforeLast, initial);
    for (const transition of data.selected.slice(index.results.length)) {
      const boundary = capturedJson(join(root, transition.files[0])); assert.equal(stateHash(boundary), transition.boundarySha256);
      const result = checkSqlite(runtime, sqlite.DatabaseSync, join(out, `case-${transition.commandCount}`), manifestSha256, transition, boundary);
      index.results.push(result); atomic(indexFile, index);
      result.databaseArchives = archiveCompletedCase(join(out, `case-${transition.commandCount}`), result, indexFile); atomic(indexFile, index);
      console.log(JSON.stringify({ event: 'SQLITE_CASE_VERIFIED', commandCount: transition.commandCount, completed: index.results.length, total: data.selected.length })); global.gc?.();
    }
    recheck(); assert.equal(index.results.length, data.selected.length); index.complete = true; atomic(indexFile, index);
    const report = { format: FORMAT, passed: true, complete: true, exitCode: 0, manifestSha256, stage: data.capture.stage,
      runtimeFreezeSha256: freeze.sha256, completedTransitions: index.results.length, selectedUniqueTransitions: data.selected.length,
      aliases: data.cp.boundaries.length - data.selected.length, actualCapturedCommands: data.cp.commands.length,
      original1038HistoricalReplay: 'NOT_RUN', newTailSequentialReplay: 'NOT_RUN_SELECTED_CAPTURED_TRANSITIONS_ONLY',
      syntheticTransitions: 'NONE', legacy32Or34Evidence: 'NOT_ACCEPTED_AS_NEW217', naturalOutcome: 'UNCHANGED_CAPTURED_OUTCOME_ONLY',
      deathSealed: index.results.some(result => result.deathSealed === 'VERIFIED') ? 'VERIFIED_ACTUAL_CAPTURED_DEATH' : 'NOT_OBSERVED_IN_SELECTED_CAPTURE',
      retainedDatabases: 'LOSSLESS_GZIP_ORIGINAL_AND_COMPRESSED_SHA256',
      restoreDatabase: 'Restore every archive.json member with gunzip; verify original bytes and SHA256; retain .bak and actual .sealed alongside the database.',
      desktop: 'NOT_RUN', results: index.results };
    atomic(join(out, 'report.json'), report); return report;
  } catch (error) {
    try {
      if (!existsSync(join(out, 'failure.json.next'))) atomic(join(out, 'failure.json'), { format: FORMAT, complete: false, exitCode: 1, manifestSha256,
        completedTransitions: index?.results.length ?? 0, selectedUniqueTransitions: data.selected.length, error: String(error), databasesRetained: true });
    } catch { /* Keep the original error and every incomplete database. */ }
    throw error;
  } finally { unlock(); }
}
export function parseOptions(args) {
  const result = {}, seen = new Set(), fields = { '--source-directory': 'sourceDirectory', '--input-manifest': 'inputManifest',
    '--input-manifest-sha256': 'inputManifestSha256', '--freeze-sha256': 'freezeSha256', '--verifier-sha256': 'verifierSha256',
    '--output-directory': 'outputDirectory', '--resume-directory': 'resumeDirectory', '--expected-boundaries': 'expectedBoundaries',
    '--remove-stale-lock-pid': 'removeStaleLockPid' };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]; assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--preflight' || flag === '--help') { result[flag.slice(2)] = true; continue; }
    const key = fields[flag]; assert(key, `Unsupported ${flag}`); const value = args[++i]; assert(value && !value.startsWith('--'), `Missing value for ${flag}`);
    if (key === 'expectedBoundaries' || key === 'removeStaleLockPid') {
      assert(/^[1-9]\d*$/.test(value)); result[key] = Number(value); assert(Number.isSafeInteger(result[key]));
      if (key === 'expectedBoundaries') assert(result[key] <= LIMIT);
    } else result[key] = value;
  }
  assert(!(result.outputDirectory && result.resumeDirectory), 'Use one exact output directory');
  assert(!result.preflight || !result.outputDirectory && !result.resumeDirectory && !result.removeStaleLockPid, 'Preflight never writes or alters a lock');
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log('node --expose-gc scripts/verify/death-save.mjs --source-directory CAPTURE --input-manifest EXTERNAL_REVIEWED_MANIFEST --input-manifest-sha256 SHA --freeze-sha256 SHA --verifier-sha256 SHA [--preflight | --output-directory EMPTY_DIR | --resume-directory EXACT_SAME_DIR] [--expected-boundaries 1..64] [--remove-stale-lock-pid EXACT_DEAD_PID]. Original1038 is the exact restored195 living final; retain all original evidence without historical replay. Only actual NEW217 selected action gzip captures may seed SQLite. Preflight has no game, producer or SQLite import and no writes. Resume requires unchanged complete capture/recovery manifest, source bytes, frozen runtime/producer/test/dependencies and Node, verifier/test, reviewed external manifest and original absolute paths. Preserve all audit artifacts. Pending .next, corrupt gzip, unknown files and uncertain/live locks stop for inspection; never delete them to force resume. Completed closed indexed DBs alone are compressed with gunzip byte equality, original and compressed SHA256. Restore ALL archive members including .bak and an actual .sealed; an alive capture does not prove death sealing. No old32/34 evidence counts as NEW217.');
    else { const report = await verifyDeathCapture(options); console.log(JSON.stringify(options.preflight ? report : { passed: report.passed, complete: report.complete, exitCode: 0, completedTransitions: report.completedTransitions, selectedUniqueTransitions: report.selectedUniqueTransitions, deathSealed: report.deathSealed })); }
  } catch (error) { console.error(JSON.stringify({ passed: false, complete: false, exitCode: 1, error: String(error) })); process.exitCode = 1; }
}
