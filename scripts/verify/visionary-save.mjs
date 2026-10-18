import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

// Import-safe, selected actual boundaries only. No natural play, game import,
// SQLite open or write on import/preflight. Completed, indexed case databases
// are retained losslessly as verified gzip; incomplete databases stay raw.
const SELF = fileURLToPath(import.meta.url);
export const FORMAT = 'VISIONARY210_SELECTED_SQLITE_AUDIT_V1';
export const INPUT_FORMAT = 'VISIONARY210_CAPTURE_FILES_V1';
const PRODUCER = 'scripts/play/visionary-stage.mjs';
const SOURCE = 'tests/fixtures/writer-v01880/snapshot-practiced.json';
const HISTORY = 'tests/fixtures/writer-v01880/natural.json';
const SOURCE_SHA = '49e6d09f367fab24667093f32a1a887aef5b000a2fe505a56cb3190276e3a0bc';
const HISTORY_SHA = '7b4a0998bd36ba06108ddb5c8dd7884f474d99145e9f9edbe1b56ba811f35399';
const PREFIX_SHA = '3176e2d31a990a18b0d1256d3d008da7a04ff246bfa1e02ace695c54da8cca1b';
const PREFIX = 659, INITIAL_TIME = '2026-10-17T00:00:00.000Z', COMMIT_TIME = '2026-10-17T00:00:01.000Z';
const CHECKS = ['strict-before-save', 'read-only-bootstrap-no-write-hook', 'beforeWrite-rollback', 'COMMIT-rollback',
  'private-head-rng-receipts-selection-timestamps-backups-unchanged', 'rollback-reopen', 'exact-same-intent-retry',
  'exact-private-rng-authored-and-player-public', 'commit-reopen-load', 'duplicate-idempotent', 'final-reopen'];
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const whole = value => Number.isSafeInteger(value) && value >= 0;
const sha = value => createHash('sha256').update(value).digest('hex');
const compactHash = value => sha(JSON.stringify(value));
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
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
  for (const file of ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation', 'node_modules/@noble/hashes', SOURCE, HISTORY]) walk(file);
  files.push({ file: '$natural-producer', ...fileEvidence(join(repo, PRODUCER)) }); return { sha256: compactHash(files), nodeVersion: process.version, files };
}
export function assertResumeManifest(saved, current) { assert.deepEqual(saved, current, 'Resume requires the exact capture, selection, source, runtime and verifier'); }
export function assertProducerOnlyFreezeChange(before, after) {
  assertFreeze(before, before); assertFreeze(after, after); assert.equal(before.nodeVersion, after.nodeVersion);
  assert.deepEqual(before.files.map(row => row.file), after.files.map(row => row.file));
  const changes = before.files.filter((row, i) => row.sha256 !== after.files[i].sha256 || row.bytes !== after.files[i].bytes);
  assert.deepEqual(changes.map(row => row.file), ['$natural-producer'], 'Only the approved temporary-port-wait producer change');
}
export function assertPortComparisonRows(comparisons, rows) {
  assert.equal(comparisons.length, 97); assert.equal(rows.length, 97);
  for (const [i, row] of rows.entries()) {
    assert.equal(row.commandCount, 660 + i);
    assert.deepEqual(comparisons[i], { commandCount: row.commandCount, privateSha256: row.afterStateSha256, publicSha256: row.publicAfterSha256, randomSha256: row.randomAfterSha256 });
  }
}
export function selectBoundaries(index, readBoundary) {
  assert(Array.isArray(index) && index.length > 0, 'No actual captured transition'); const selected = new Map(), filenames = new Set();
  for (const item of index) {
    keys(item, ['file', 'kind', 'commandCount', 'bytes', 'sha256'], 'Captured boundary index'); safeRelativeFile(item.file);
    assert(typeof item.kind === 'string' && /^[a-z0-9_-]+$/.test(item.kind), 'Named actual semantic boundary');
    assert(!filenames.has(item.file), 'Repeated boundary filename'); filenames.add(item.file);
    assert(whole(item.commandCount) && item.commandCount > PREFIX && whole(item.bytes) && digest(item.sha256));
    const boundary = readBoundary(item);
    keys(boundary, ['commandCount', 'beforeLast', 'lastIntent', 'final', 'public', 'audit'], 'Actual producer boundary');
    assert.equal(boundary.commandCount, item.commandCount);
    const hash = stateHash(boundary), prior = selected.get(item.commandCount);
    if (prior) { assert.equal(prior.boundarySha256, hash, 'Same command count must identify the identical actual transition'); prior.files.push(item.file); if (!prior.kinds.includes(item.kind)) prior.kinds.push(item.kind); }
    else selected.set(item.commandCount, { commandCount: item.commandCount, kinds: [item.kind], files: [item.file], boundarySha256: hash });
  }
  return [...selected.values()].sort((a, b) => a.commandCount - b.commandCount);
}
function readCapture(root, repo, freeze) {
  assert(!existsSync(join(root, 'checkpoint.json.next')), 'Unresolved producer checkpoint successor is not a frozen completed capture');
  for (const file of readdirSync(root)) assert(!file.endsWith('.derived-next'), 'Unresolved derived producer output must be inspected');
  const source = json(join(repo, SOURCE)), history = json(join(repo, HISTORY));
  assert.equal(fileEvidence(join(repo, SOURCE)).sha256, SOURCE_SHA); assert.equal(fileEvidence(join(repo, HISTORY)).sha256, HISTORY_SHA);
  assert.equal(history.commands.length, 667); assert.equal(history.final.status, 'DEAD'); assert.equal(history.final.revision, 668);
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.revision, 660); assert.equal(compactHash(history.commands.slice(0, PREFIX)), PREFIX_SHA);
  const wrapped = json(join(root, 'checkpoint.json')), cp = wrapped.payload;
  keys(wrapped, ['sha256', 'payload'], 'Durable checkpoint'); assert.equal(wrapped.sha256, stateHash(cp));
  keys(cp, ['format', 'source', 'sourceSha256', 'historySha256', 'prefixSha256', 'freezeSha256', 'policyDefinition', 'policy', 'createdAt', 'commandCount',
    'commands', 'rows', 'boundaries', 'state', 'initialStateSha256', 'finalStateSha256', 'initialPublicSha256', 'publicStateSha256', 'initialRandomSha256',
    'pending', 'terminal', 'predecessorSha256', ...(Object.hasOwn(cp, 'continuationProofSha256') ? ['continuationProofSha256'] : [])], 'Exact durable producer checkpoint fields');
  assert.equal(cp.format, 'VISIONARY659_DURABLE_PUBLIC_ACTION_BOUNDARY_V1'); assert.equal(cp.source, SOURCE);
  assert.equal(cp.sourceSha256, SOURCE_SHA); assert.equal(cp.historySha256, HISTORY_SHA); assert.equal(cp.prefixSha256, PREFIX_SHA);
  assert.equal(cp.freezeSha256, freeze.sha256); assert.equal(cp.pending, null, 'Pending action is not completed evidence');
  assert.equal(cp.commandCount, PREFIX + cp.commands.length); assert(cp.commands.length > 0, 'No new completed command');
  assert.equal(cp.rows.length, cp.commands.length); assert.equal(cp.finalStateSha256, stateHash(cp.state));
  const capture = json(join(root, 'natural.json')), summary = json(join(root, 'summary.json')), prefix = json(join(root, 'prefix-original659.json'));
  assert.equal(capture.prefixCount, PREFIX); assert.deepEqual(capture.final, cp.state); assert.deepEqual(capture.policy, cp.policyDefinition);
  assert.deepEqual(capture.commands, [...history.commands.slice(0, PREFIX), ...cp.commands]); assert.deepEqual(capture.prefixFinal, source);
  assert.deepEqual(capture.creation, history.creation); assert.deepEqual(capture.initial, history.initial);
  assert.equal(capture.pendingIntent, null); assert.deepEqual(capture.boundaries, cp.boundaries); assert.equal(capture.seed, source.random.seed);
  assert.deepEqual(capture.provenance, { kind: 'EXACT_ORIGINAL_LIVING_WRITER659_PUBLIC_VISIONARY_CONTINUATION', source: SOURCE, sourceSha256: SOURCE_SHA,
    originalHistory: HISTORY, originalHistorySha256: HISTORY_SHA, prefixCommandsSha256: PREFIX_SHA, runtimeFreezeSha256: freeze.sha256,
    historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, separateOriginal667DeathUnchanged: true,
    privateAudit: true, seedChanged: false, randomOverridden: false, selectedFromEnabledPublicActionsOnly: true });
  assert.deepEqual(prefix, { source: SOURCE, sourceSha256: SOURCE_SHA, history: HISTORY, historySha256: HISTORY_SHA, prefixCount: PREFIX,
    prefixSha256: PREFIX_SHA, commands: history.commands.slice(0, PREFIX), initial: history.initial, final: source, historicalPrefixReplayedHere: false, separate667DeathRetained: true });
  assert.deepEqual(summary, { stage: capture.stage, reason: capture.reason, commands: cp.commandCount, originalCommands: PREFIX,
    newCommands: cp.commands.length, week: cp.policy.week, paused: capture.stage === 'MANUAL_PAUSE', strictFinalValidation: true, public: summary.public });
  assert.equal(stateHash(summary.public), cp.publicStateSha256);
  assert.deepEqual(cp.terminal, summary.paused ? null : { stage: capture.stage, reason: capture.reason });
  assert.equal(readFileSync(join(root, 'commands.ndjson'), 'utf8'), cp.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  assert.deepEqual(json(join(root, 'boundaries.index.json')), cp.boundaries);
  const producer = freeze.files.find(row => row.file === '$natural-producer'); assert(producer);
  assert.deepEqual(fileEvidence(join(root, 'producer.mjs')), { bytes: producer.bytes, sha256: producer.sha256 });
  let state = cp.initialStateSha256, publicHash = cp.initialPublicSha256, random = cp.initialRandomSha256;
  for (const [i, row] of cp.rows.entries()) {
    assert.equal(row.commandCount, PREFIX + i + 1); assert.equal(row.revision, row.commandCount + 1);
    assert.deepEqual(row.intent, cp.commands[i]); assert.equal(row.intent.type, 'VISIONARY'); assert.equal(row.commandSha256, compactHash(row.intent));
    assert.equal(row.beforeStateSha256, state); assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.randomBeforeSha256, random);
    assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore)); assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    assert.equal(row.randomBefore.seed, source.random.seed); assert.equal(row.randomAfter.seed, source.random.seed);
    assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    for (const hash of [row.afterStateSha256, row.publicAfterSha256, row.policyBeforeSha256, row.policyAfterSha256]) assert(digest(hash));
    if (i) assert.equal(row.policyBeforeSha256, cp.rows[i - 1].policyAfterSha256);
    state = row.afterStateSha256; publicHash = row.publicAfterSha256; random = row.randomAfterSha256;
  }
  assert.equal(state, cp.finalStateSha256); assert.equal(publicHash, cp.publicStateSha256); assert.equal(random, stateHash(cp.state.random));
  assert.equal(cp.rows.at(-1).policyAfterSha256, stateHash(cp.policy));
  assert.equal(cp.policy.week, cp.state.week);
  const selected = selectBoundaries(cp.boundaries, item => {
    const path = join(root, item.file); assert.deepEqual(fileEvidence(path), { bytes: item.bytes, sha256: item.sha256 });
    const b = json(path), row = cp.rows[item.commandCount - PREFIX - 1]; assert(row, 'Boundary lies outside completed ledger');
    assert.deepEqual(b.audit, { ...row, elapsedMilliseconds: null }); assert.deepEqual(b.lastIntent, row.intent);
    assert.equal(stateHash(b.beforeLast), row.beforeStateSha256); assert.equal(stateHash(b.final), row.afterStateSha256);
    assert.equal(stateHash(b.public), row.publicAfterSha256); assert.deepEqual(b.beforeLast.random, row.randomBefore); assert.deepEqual(b.final.random, row.randomAfter);
    assert.equal(b.beforeLast.revision, item.commandCount); assert.equal(b.final.revision, item.commandCount + 1);
    return b;
  });
  assert.equal(selected[0].commandCount, PREFIX + 1, 'First valid guidance must be independently verified');
  assert.deepEqual(cp.commands[0], { type: 'VISIONARY', command: { type: 'LEARN_GUIDANCE' } });
  let continuation = null;
  if (Object.hasOwn(cp, 'continuationProofSha256')) {
    const proof = json(regular(join(root, 'continuation-proof.json'))), priorRoot = directory(join(root, 'prior-segment'));
    keys(proof, ['kind', 'originalCheckpoint', 'originalFreeze', 'currentFreeze', 'changedFrozenFiles', 'originalTerminal', 'completedCommandsCompared', 'comparisons', 'originalFiles', 'productChanged', 'randomOverridden', 'oldArtifactsPreserved'], 'One approved public-port continuation proof');
    assert.equal(proof.kind, 'SAME_COMPLETED756_CONTINUATION_AFTER_PUBLIC_TEMPORARY_PORT_CLOSURE'); assert.equal(stateHash(proof), cp.continuationProofSha256);
    assert.equal(proof.currentFreeze, freeze.sha256); assert.deepEqual(proof.changedFrozenFiles, ['$natural-producer']);
    assert.equal(proof.productChanged, false); assert.equal(proof.randomOverridden, false); assert.equal(proof.oldArtifactsPreserved, true); assert.equal(proof.completedCommandsCompared, 97);
    assertInputManifest(inspectCaptureInputs(priorRoot), { format: INPUT_FORMAT, files: proof.originalFiles });
    const priorWrapped = json(join(priorRoot, 'checkpoint.json')); assert.equal(priorWrapped.sha256, proof.originalCheckpoint);
    assert.equal(priorWrapped.payload.continuationProofSha256, undefined, 'No generic or nested continuation lineage');
    const priorFreeze = json(join(priorRoot, 'freeze.json')); assert.equal(priorFreeze.sha256, proof.originalFreeze); assertProducerOnlyFreezeChange(priorFreeze, freeze);
    const prior = readCapture(priorRoot, repo, priorFreeze).cp;
    assert.equal(prior.commandCount, 756); assert.equal(prior.pending, null); assert.equal(prior.state.status, 'ACTIVE');
    assert.equal(prior.terminal.stage, 'PUBLIC_ACTION_BLOCKED'); assert(prior.terminal.reason.includes('目的港正执行原封港规则')); assert.deepEqual(proof.originalTerminal, prior.terminal);
    assertPortComparisonRows(proof.comparisons, prior.rows);
    assert.deepEqual(cp.policyDefinition, prior.policyDefinition); assert.deepEqual(cp.commands.slice(0, 97), prior.commands); assert.deepEqual(cp.rows.slice(0, 97), prior.rows);
    assert.deepEqual(cp.boundaries.slice(0, prior.boundaries.length), prior.boundaries); assert.equal(cp.initialStateSha256, prior.initialStateSha256);
    const originalLedger = readFileSync(join(priorRoot, 'commands.ndjson')), currentLedger = readFileSync(join(root, 'commands.ndjson'));
    assert(currentLedger.subarray(0, originalLedger.length).equals(originalLedger), 'The original completed ledger is the exact byte prefix');
    assert(cp.commandCount > 756, 'A continuation proof alone is not a completed new action');
    assert.deepEqual(cp.commands[97], { type: 'VISIONARY', command: { type: 'NEXT_WEEK' } }, 'Same living756 waits through the real public closure');
    assert.equal(cp.rows[97].beforeStateSha256, prior.finalStateSha256); assert.equal(cp.rows[97].publicBeforeSha256, prior.publicStateSha256);
    assert.equal(cp.rows[97].policyBeforeSha256, stateHash(prior.policy));
    continuation = { kind: proof.kind, proofSha256: cp.continuationProofSha256, originalCheckpoint: proof.originalCheckpoint,
      originalCommandCount: 756, independentlyRecordedComparisons: 97, replayedByThisAudit: false, onlyProducerChanged: true };
  } else {
    assert(!existsSync(join(root, 'continuation-proof.json')) && !existsSync(join(root, 'prior-segment')), 'Unrecognized extra continuation evidence');
  }
  return { cp, source, history, capture, selected, continuation };
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
  const index = json(completedIndexPath), phase = json(regular(join(work, 'phase.json')));
  const saved = result.commandCount === undefined ? index.original667 : index.results.find(row => row.commandCount === result.commandCount);
  assert.deepEqual(saved, result, 'Only a durable completed-index result authorizes lossless archival');
  assert.equal(work, join(dirname(completedIndexPath), result.commandCount === undefined ? 'original667' : `case-${result.commandCount}`));
  assert.equal(phase.phase, 'VERIFIED', 'Incomplete case stays raw'); assert.equal(phase.input.manifestSha256, index.manifestSha256);
  const present = databaseFiles(work), expected = result.databaseFiles, names = Object.keys(expected).sort();
  assert(names.includes('case.sqlite') && names.includes('case.sqlite.bak'));
  assert(names.every(name => ['case.sqlite', 'case.sqlite.bak', 'case.sqlite.sealed'].includes(name)), 'No unfinished sidecar may be archived');
  for (const name of Object.keys(present)) assert(Object.hasOwn(expected, name), 'Unindexed raw evidence retained');
  for (const name of readdirSync(work).filter(file => file.endsWith('.gz'))) assert(Object.hasOwn(expected, name.slice(0, -3)), 'Unindexed compressed evidence retained');
  const archivePath = join(work, 'archive.json'), recorded = existsSync(archivePath) ? json(regular(archivePath)) : null;
  const archive = { format: 'VISIONARY210_COMPLETED_SQLITE_GZIP_V1', manifestSha256: index.manifestSha256, files: {} };
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
  const { beforeLast: before, lastIntent: intent, final: after } = boundary;
  runtime.assertValidSliceState(before); runtime.assertValidSliceState(after); assert.equal(before.status, 'ACTIVE');
  const publicBefore = runtime.projectSliceState(before), publicAfter = runtime.projectSliceState(after);
  const authoredBefore = before.visionary.guidanceKnown ? runtime.openVisionaryRuntimeSession(before).projectVisionary() : publicBefore.visionary;
  const authoredAfter = runtime.openVisionaryRuntimeSession(after).projectVisionary();
  assert.equal(stateHash(authoredBefore), boundary.audit.publicBeforeSha256);
  const offered = authoredBefore.actions.find(action => stable(action.command) === stable(intent.command));
  assert.equal(offered?.enabled, true, 'The captured command was an enabled public action');
  assert.equal(offered.label, boundary.audit.publicLabel); assert.equal(offered.cost, boundary.audit.publicCost);
  assert.deepEqual(authoredAfter, boundary.public);
  const event = after.visionary.journal.at(-1);
  if (intent.command.type === 'LEARN_GUIDANCE') {
    assert(event?.revision !== after.revision);
    assert.deepEqual(boundary.audit.receipts, { checks: [], finance: [], notes: ['Actual guidance paid: 100 pennies and one action.'] });
  } else {
    assert.equal(event?.revision, after.revision); assert.deepEqual(event.command, intent.command);
    assert.deepEqual(boundary.audit.receipts, { checks: event.randomReceipts, finance: event.financeReceipts, notes: event.notes });
  }
  assert.deepEqual(runtime.projectPlayerText(structuredClone(authoredAfter), after.character.name), publicAfter.visionary);
  const input = { manifestSha256, transition, beforeStateSha256: stateHash(before), stateSha256: stateHash(after), publicStateSha256: stateHash(publicAfter) };
  const path = join(work, 'case.sqlite'), phasePath = join(work, 'phase.json'); let pending;
  if (!existsSync(work)) { mkdirSync(work); atomic(phasePath, { input, phase: 'ALLOCATED', beforeRows: null, beforeFiles: null, committedRows: null }); }
  else { directory(work); databaseFiles(work); assert(!readdirSync(work).some(file => file.endsWith('.gz') || file.startsWith('archive.json')), 'An unindexed case may not contain archived databases'); }
  assert(!existsSync(`${phasePath}.next`), 'Interrupted phase write retained; inspect before resuming');
  pending = json(regular(phasePath)); keys(pending, ['input', 'phase', 'beforeRows', 'beforeFiles', 'committedRows'], 'Case phase');
  assert.deepEqual(pending.input, input); assert(['ALLOCATED', 'BEFORE_SAVED', 'WRITE_ROLLBACK_VERIFIED', 'COMMIT_ROLLBACK_VERIFIED', 'COMMITTED', 'VERIFIED'].includes(pending.phase));
  const checkpoint = phase => { pending.phase = phase; atomic(phasePath, pending); };
  const envelope = { intentId: `visionary210:${transition.commandCount}`, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const receipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision, newRevision: after.revision, committedAt: COMMIT_TIME, replayed: false, state: publicAfter };
  const rows = () => databaseRows(DatabaseSync, path);
  let app, injection = null, injected = 0, hooks = 0, beforeHead;
  const expectedHead = state => state.visionary.guidanceKnown ? { runId: state.runId, revision: state.revision, status: state.status } : null;
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
      const duplicate = app.submitIntent(envelope); assert.equal(duplicate.ok, true); assert.deepEqual(duplicate.value, { ...receipt, replayed: true });
      exact(after, true); checkHead(expectedHead(after)); assert.deepEqual(rows(), pending.committedRows);
      if (after.status === 'DEAD') {
        assert.deepEqual(json(`${path}.sealed`), [after.runId]); assert.equal(publicAfter.canAct, false);
        const blocked = app.submitIntent({ ...envelope, intentId: `${envelope.intentId}:archived`, expectedRevision: after.revision, payload: { type: 'VISIONARY', command: { type: 'REST' } } });
        assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.deepEqual(rows(), pending.committedRows);
      } else assert.equal(existsSync(`${path}.sealed`), false);
      close(); app = open(); exact(after, true); bootstrap(publicAfter); assert.deepEqual(rows(), pending.committedRows); close(); checkpoint('VERIFIED');
    } else { assert.equal(pending.phase, 'VERIFIED'); exact(after, true); assert.deepEqual(rows(), pending.committedRows); close(); }
    return { ...transition, beforeStateSha256: input.beforeStateSha256, stateSha256: input.stateSha256, publicStateSha256: input.publicStateSha256,
      authoredPublicSha256: stateHash(authoredAfter), playerChapterSha256: stateHash(publicAfter.visionary), random: after.random,
      revision: after.revision, status: after.status, checks: CHECKS, databaseRows: pending.committedRows, databaseFiles: databaseFiles(work) };
  } finally { injection = null; close(); }
}
function checkOriginalDeath(runtime, DatabaseSync, work, original, manifestSha256) {
  const after = runtime.migrateSliceState(original); runtime.assertValidSliceState(after); assert.equal(after.status, 'DEAD'); assert.equal(after.revision, 668);
  for (const [key, value] of Object.entries(original)) if (!['schemaVersion', 'contentVersion'].includes(key)) assert.deepEqual(after[key], value);
  const path = join(work, 'case.sqlite'), phasePath = join(work, 'phase.json'), input = { manifestSha256, historySha256: HISTORY_SHA, stateSha256: stateHash(after) };
  if (!existsSync(work)) { mkdirSync(work); atomic(phasePath, { input, phase: 'ALLOCATED' }); }
  else assert(!readdirSync(directory(work)).some(file => file.endsWith('.gz') || file.startsWith('archive.json')), 'Unindexed archival case cannot contain compressed evidence');
  assert(!existsSync(`${phasePath}.next`), 'Interrupted original-death phase retained'); const phase = json(regular(phasePath)); assert.deepEqual(phase.input, input);
  assert(['ALLOCATED', 'VERIFIED'].includes(phase.phase)); let app;
  const expected = runtime.projectSliceState(after), exact = () => { equalState(app.repository.get(after.runId).state, after); assert.equal(app.repository.activeRun(), after.runId); assert.deepEqual(json(`${path}.sealed`), [after.runId]); };
  try {
    app = new runtime.SqliteSliceStore(path, { now: () => COMMIT_TIME });
    if (!app.repository.get(after.runId)) { assert.equal(phase.phase, 'ALLOCATED'); app.repository.transaction(() => { app.repository.put({ state: after, updatedAt: INITIAL_TIME }); app.repository.selectRun(after.runId); }); }
    exact(); const beforeRows = databaseRows(DatabaseSync, path); app.close(); app = new runtime.SqliteSliceStore(path, { now: () => COMMIT_TIME }); exact();
    const boot = app.getBootstrap(); assert.equal(boot.ok, true); assert.deepEqual(boot.value.activeState, expected); assert.equal(expected.canAct, false);
    const loaded = app.loadRun(after.runId); assert.equal(loaded.ok, true); assert.deepEqual(loaded.value, expected);
    for (const payload of [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' }, { type: 'VISIONARY', command: { type: 'LEARN_GUIDANCE' } }]) {
      const blocked = app.submitIntent({ intentId: `old667:${payload.type}`, runId: after.runId, expectedRevision: after.revision, payload });
      assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED');
    }
    assert.deepEqual(databaseRows(DatabaseSync, path), beforeRows); exact(); app.close(); app = undefined;
    if (phase.phase !== 'VERIFIED') atomic(phasePath, { input, phase: 'VERIFIED' });
    return { kind: 'SEPARATE_ORIGINAL667_DEAD_SNAPSHOT_NOT_TRANSITION_REPLAY', stateSha256: input.stateSha256,
      sourceSha256: HISTORY_SHA, status: 'DEAD', revision: 668, checks: ['original-migration-preserves-history', 'sealed-save-reopen-load', 'all-submitted-actions-archived'],
      databaseRows: beforeRows, databaseFiles: databaseFiles(work) };
  } finally { app?.close(); }
}
export async function verifyVisionaryCapture(options) {
  const repo = directory(options.repo ?? process.cwd()), root = directory(options.sourceDirectory);
  for (const key of ['freezeSha256', 'verifierSha256', 'inputManifestSha256']) assert(digest(options[key]), `Required reviewed ${key}`);
  assert.equal(fileEvidence(SELF).sha256, options.verifierSha256);
  const manifestPath = regular(resolve(options.inputManifest)); assert(!contains(root, manifestPath), 'Reviewed input manifest lives outside its own capture');
  assert.equal(fileEvidence(manifestPath).sha256, options.inputManifestSha256);
  const inputManifest = json(manifestPath); assertInputManifest(inspectCaptureInputs(root), inputManifest);
  const freeze = json(join(root, 'freeze.json')); assert.equal(freeze.sha256, options.freezeSha256); assertFreeze(freeze, inspectFreeze(repo));
  const data = readCapture(root, repo, freeze);
  if (options.expectedBoundaries !== undefined) assert.equal(data.selected.length, options.expectedBoundaries, 'Unique actual transition count');
  const manifest = { format: FORMAT, databaseRetention: 'VERIFIED_COMPLETED_CASE_GZIP_V1', sourceDirectory: root, repo, inputs: inputManifest, inputManifest: fileEvidence(manifestPath),
    freeze, verifier: fileEvidence(SELF), selected: data.selected, continuation: data.continuation, node: process.version };
  const manifestSha256 = stateHash(manifest);
  if (options.preflight) return { preflight: 'PASSED_NO_GAME_NO_SQLITE_NO_WRITES', manifestSha256, stage: data.capture.stage,
    newCommands: data.cp.commands.length, uniqueTransitions: data.selected.length, boundaryAliases: data.cp.boundaries.length - data.selected.length, continuation: data.continuation };
  assert(options.outputDirectory || options.resumeDirectory, 'Choose an explicit output or resume directory');
  const forbidden = [root, manifestPath, ...['src', 'dist', 'scripts', 'tests', 'docs', 'node_modules', '.git'].map(file => join(repo, file))];
  const out = assertOutputPath(options.resumeDirectory ?? options.outputDirectory, forbidden);
  if (options.resumeDirectory) directory(out);
  else { if (existsSync(out)) assert.equal(readdirSync(directory(out)).length, 0, 'New output directory must be empty'); else mkdirSync(out, { recursive: true }); }
  const unlock = claimAuditLock(out, manifestSha256, options.removeStaleLockPid), manifestFile = join(out, 'manifest.json'), indexFile = join(out, 'completed.json');
  let index;
  try {
    if (options.resumeDirectory) { assertResumeManifest(json(regular(manifestFile)), manifest); index = json(regular(indexFile)); }
    else { atomic(manifestFile, manifest); index = { manifestSha256, results: [], original667: null, complete: false }; atomic(indexFile, index); }
    keys(index, ['manifestSha256', 'results', 'original667', 'complete'], 'Completed audit index'); assert.equal(index.manifestSha256, manifestSha256);
    assert(Array.isArray(index.results) && index.results.length <= data.selected.length); assert.equal(typeof index.complete, 'boolean');
    const expectedFiles = new Set(['manifest.json', 'completed.json', 'audit.lock.json', 'report.json', 'failure.json', 'original667', ...data.selected.map(item => `case-${item.commandCount}`)]);
    for (const file of readdirSync(out)) assert(expectedFiles.has(file), `Unknown or interrupted audit artifact retained: ${file}`);
    if (index.complete) { assert.equal(index.results.length, data.selected.length); assert(index.original667, 'Completed index must include separate archived death'); }
    for (const selected of data.selected.slice(index.results.length + 1)) assert(!existsSync(join(out, `case-${selected.commandCount}`)), 'Only the first incomplete case can have unindexed evidence');
    for (const [i, result] of index.results.entries()) {
      const selected = data.selected[i]; assert.equal(result.commandCount, selected.commandCount); assert.deepEqual(result.files, selected.files); assert.deepEqual(result.kinds, selected.kinds); assert.equal(result.boundarySha256, selected.boundarySha256);
      const row = data.cp.rows[result.commandCount - PREFIX - 1]; assert.equal(result.beforeStateSha256, row.beforeStateSha256); assert.equal(result.stateSha256, row.afterStateSha256);
      assert.equal(result.authoredPublicSha256, row.publicAfterSha256); assert.equal(result.revision, row.revision); assert.deepEqual(result.random, row.randomAfter); assert.deepEqual(result.checks, CHECKS);
      const work = join(out, `case-${result.commandCount}`), phase = json(regular(join(work, 'phase.json')));
      assert.equal(phase.phase, 'VERIFIED'); assert.equal(phase.input.manifestSha256, manifestSha256); assert.deepEqual(phase.input.transition, selected);
      assert.equal(phase.input.beforeStateSha256, result.beforeStateSha256); assert.equal(phase.input.stateSha256, result.stateSha256); assert.equal(phase.input.publicStateSha256, result.publicStateSha256);
      assert.deepEqual(phase.committedRows, result.databaseRows);
      const archive = archiveCompletedCase(work, result, indexFile);
      if (!result.databaseArchives) { result.databaseArchives = archive; atomic(indexFile, index); }
    }
    const [slice, migration, store, playerText, sqlite] = await Promise.all(['dist/domain/slice/index.js', 'dist/domain/slice/migration.js', 'dist/persistence/slice-store.js', 'dist/shared/player-text.js']
      .map(file => import(pathToFileURL(join(repo, file)).href)).concat(import('node:sqlite')));
    const runtime = { ...slice, ...migration, ...store, ...playerText };
    runtime.assertValidSliceState(data.cp.state);
    assert.equal(stateHash(runtime.openVisionaryRuntimeSession(data.cp.state).projectVisionary()), data.cp.publicStateSha256);
    const initial = runtime.migrateSliceState(data.source); assert.equal(stateHash(initial), data.cp.initialStateSha256);
    assert.equal(stateHash(runtime.projectSliceState(initial).visionary), data.cp.initialPublicSha256); assert.equal(stateHash(initial.random), data.cp.initialRandomSha256);
    const guidance = json(join(root, data.selected[0].files[0])); equalState(guidance.beforeLast, initial);
    assert.deepEqual(guidance.final.random, initial.random); assert.equal(guidance.final.cash, initial.cash - 100); assert.equal(guidance.final.actionsRemaining, initial.actionsRemaining - 1);
    for (const transition of data.selected.slice(index.results.length)) {
      const boundary = json(join(root, transition.files[0])); assert.equal(stateHash(boundary), transition.boundarySha256);
      const result = checkSqlite(runtime, sqlite.DatabaseSync, join(out, `case-${transition.commandCount}`), manifestSha256, transition, boundary);
      index.results.push(result); atomic(indexFile, index);
      result.databaseArchives = archiveCompletedCase(join(out, `case-${transition.commandCount}`), result, indexFile); atomic(indexFile, index);
      console.log(JSON.stringify({ event: 'SQLITE_CASE_VERIFIED', commandCount: transition.commandCount, completed: index.results.length, total: data.selected.length })); global.gc?.();
    }
    if (index.original667) {
      const phase = json(regular(join(out, 'original667', 'phase.json'))); assert.equal(phase.phase, 'VERIFIED');
      assert.deepEqual(phase.input, { manifestSha256, historySha256: HISTORY_SHA, stateSha256: stateHash(runtime.migrateSliceState(data.history.final)) });
      assert.equal(index.original667.stateSha256, phase.input.stateSha256); assert.equal(index.original667.sourceSha256, HISTORY_SHA);
      assert.equal(index.original667.kind, 'SEPARATE_ORIGINAL667_DEAD_SNAPSHOT_NOT_TRANSITION_REPLAY'); assert.equal(index.original667.status, 'DEAD'); assert.equal(index.original667.revision, 668);
      const archive = archiveCompletedCase(join(out, 'original667'), index.original667, indexFile);
      if (!index.original667.databaseArchives) { index.original667.databaseArchives = archive; atomic(indexFile, index); }
    }
    else {
      index.original667 = checkOriginalDeath(runtime, sqlite.DatabaseSync, join(out, 'original667'), data.history.final, manifestSha256); atomic(indexFile, index);
      index.original667.databaseArchives = archiveCompletedCase(join(out, 'original667'), index.original667, indexFile); atomic(indexFile, index);
    }
    assertInputManifest(inspectCaptureInputs(root), inputManifest); assertFreeze(freeze, inspectFreeze(repo)); assert.equal(fileEvidence(SELF).sha256, options.verifierSha256);
    assert.deepEqual(fileEvidence(manifestPath), manifest.inputManifest, 'Reviewed manifest changed during audit');
    assert.equal(index.results.length, data.selected.length); index.complete = true; atomic(indexFile, index);
    const report = { format: FORMAT, passed: true, complete: true, exitCode: 0, manifestSha256, stage: data.capture.stage,
      completedTransitions: index.results.length, selectedUniqueTransitions: data.selected.length, aliases: data.cp.boundaries.length - data.selected.length,
      original659HistoricalReplay: 'NOT_RUN', newTailSequentialReplay: 'NOT_RUN_SELECTED_CAPTURED_TRANSITIONS_ONLY', continuation: data.continuation, original667SnapshotCases: 1, original667: index.original667,
      syntheticTransitions: 'NONE', retainedDatabases: 'LOSSLESS_GZIP_ORIGINAL_AND_COMPRESSED_SHA256', restoreDatabase: 'gunzip -c case.sqlite.gz > restored.sqlite', desktop: 'NOT_RUN', results: index.results };
    atomic(join(out, 'report.json'), report); return report;
  } catch (error) {
    try {
      if (!existsSync(join(out, 'failure.json.next'))) atomic(join(out, 'failure.json'), { format: FORMAT, complete: false, exitCode: 1, manifestSha256,
        completedTransitions: index?.results.length ?? 0, selectedUniqueTransitions: data.selected.length, error: String(error), databasesRetained: true });
    } catch { /* Preserve the original error and evidence if storage is exhausted. */ }
    throw error;
  } finally { unlock(); }
}
export function parseOptions(args) {
  const result = {}, seen = new Set(), fields = { '--source-directory': 'sourceDirectory', '--input-manifest': 'inputManifest',
    '--input-manifest-sha256': 'inputManifestSha256', '--freeze-sha256': 'freezeSha256', '--verifier-sha256': 'verifierSha256',
    '--output-directory': 'outputDirectory', '--resume-directory': 'resumeDirectory', '--expected-boundaries': 'expectedBoundaries', '--remove-stale-lock-pid': 'removeStaleLockPid' };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]; assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--preflight' || flag === '--help') { result[flag.slice(2)] = true; continue; }
    const key = fields[flag]; assert(key, `Unsupported ${flag}`); const value = args[++i]; assert(value && !value.startsWith('--'), `Missing value for ${flag}`);
    if (key === 'expectedBoundaries' || key === 'removeStaleLockPid') { assert(/^[1-9]\d*$/.test(value)); result[key] = Number(value); assert(Number.isSafeInteger(result[key])); }
    else result[key] = value;
  }
  assert(!(result.outputDirectory && result.resumeDirectory), 'Use one exact output directory');
  assert(!result.preflight || !result.outputDirectory && !result.resumeDirectory && !result.removeStaleLockPid, 'Preflight never writes or alters a lock'); return result;
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log('node --expose-gc scripts/verify/visionary-save.mjs --source-directory CAPTURE --input-manifest EXTERNAL_REVIEWED_MANIFEST --input-manifest-sha256 SHA --freeze-sha256 SHA --verifier-sha256 SHA [--preflight | --output-directory NEW_DIR | --resume-directory SAME_DIR] [--expected-boundaries N] [--remove-stale-lock-pid DEAD_PID]. Exact complete input set and runtime freeze required. Only actual selected producer boundaries use SQLite. Completed, closed, durably indexed DBs are retained as byte-verified gzip with original/compressed hashes; incomplete DBs remain raw. Ordinary recovery: gunzip -c case.sqlite.gz > restored.sqlite. Original667 death is a separate sealed snapshot check, never a revived continuation or a claimed death replay.');
    else { const report = await verifyVisionaryCapture(options); console.log(JSON.stringify(options.preflight ? report : { passed: report.passed, complete: report.complete, exitCode: 0, completedTransitions: report.completedTransitions, selectedUniqueTransitions: report.selectedUniqueTransitions })); }
  } catch (error) { console.error(JSON.stringify({ passed: false, complete: false, exitCode: 1, error: String(error) })); process.exitCode = 1; }
}
