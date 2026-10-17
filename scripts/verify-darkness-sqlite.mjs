import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

/** README: run --help for exact pinned invocation and external-manifest preparation.
 * This audit proves only selected captured transitions and complete evidence
 * integrity. It never plays/replays a natural route or claims desktop coverage.
 * Capture freeze and any future migration proof are distinct; drift is rejected.
 */
// Import-safe, selected actual boundaries only. No natural play, game import,
// SQLite open or write on import/preflight. Completed, indexed case databases
// are retained losslessly as verified gzip; incomplete databases stay raw.
const SELF = fileURLToPath(import.meta.url);
export const FORMAT = 'DARKNESS213_SELECTED_SQLITE_AUDIT_V1';
export const INPUT_FORMAT = 'DARKNESS213_CAPTURE_FILES_V1';
const PRODUCER = 'scripts/play/darkness-stage.mjs';
export const SOURCE = 'tests/fixtures/misfortune-knight-v01910/boundary-three-honest-reports-reflected.json';
export const SOURCE_SHA256 = '6e5889192d3a0c697640fc0bc1fadd680c7b8526088a11d8f920b602cf34b79f';
export const SNAPSHOT = 'tests/fixtures/misfortune-knight-v01910/snapshot-practiced.json';
export const SNAPSHOT_SHA256 = '470d3ae9700186d8488b27663a9c64060053a011cd57bed3a5054a275bf7b6ee';
export const ARCHIVE = 'tests/fixtures/misfortune-knight-v01910/natural.json';
export const ARCHIVE_SHA256 = '597112414e673dbb446dd17d860bd88541ca5007f6310d552c41f96b12462ae8';
export const PREFIX = 679, BOUNDARY_LIMIT = 25;
export const PREFIX_SHA256 = 'c34fb277dcd19280ebd2b3d31069dddb46619d20d12fed7710b0605af61d60c3';
const CAPTURE_FORMAT = 'DARKNESS679_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
export const INPUTS = Object.freeze([{ file: SOURCE, sha256: SOURCE_SHA256 }, { file: SNAPSHOT, sha256: SNAPSHOT_SHA256 }, { file: ARCHIVE, sha256: ARCHIVE_SHA256 }]);
export const POLICY = Object.freeze({ id: 'DARKNESS679_SAME_ORIGINAL_FOUR_REAL_EVACUEES_V1', startWeek: 158,
  wage: 180, weeklyLiving: 30, operatingReserve: 1500, defaultObservationActions: 500, selectedBoundaryLimit: 25, carrierLimit: 3,
  evacuation: 'FOUR_CONSENTING_ORIGINAL_ADULTS_REAL_DAY_SURVEY_NIGHT_ARRIVALS_AND_WALKED_RETURN',
  materials: 'THREE_SAME_ORIGINALS_DATED_1353_UNIQUENESS_ORDINARY_WAGES_AND_FINANCE',
  promotion: 'SAME_COMPOUND_PAID100P_70PERCENT_PREPARATION_INDEPENDENT_CONSUMPTION',
  failure: 'LIVING_SEAL_LATER_WEEK_PAID_RECOVERY_THREE_FINITE_CARRIERS_DEATH_ARCHIVED',
  epilogue: 'TWO_FINITE_ATTEMPTS_ACTUAL_APPLICATION_OR_ORDINARY_SIDE_EXIT_AND_HONEST_REPORT', noReroll: true });
const SOURCE_SHA = SOURCE_SHA256, PREFIX_SHA = PREFIX_SHA256;
const INITIAL_TIME = '2026-10-17T00:00:00.000Z', COMMIT_TIME = '2026-10-17T00:00:01.000Z';
const INITIAL_POLICY = { phase: 'DARKNESS_ENTRY', week: 158, doses: 0, carriers: [], epilogueAttempted: [], reported: false, ordinaryExitReason: null, loop: { key: null, repetitions: 0 } };
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
    else { assert(stat.isFile(), 'Only regular capture files'); files.push({ file: safeRelativeFile(name), ...captureFileEvidence(path) }); }
  };
  walk(''); return { format: INPUT_FORMAT, files: files.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0) };
}
export function assertInputManifest(actual, expected) {
  for (const manifest of [actual, expected]) {
    keys(manifest, ['format', 'files'], 'Exact capture manifest'); assert.equal(manifest.format, INPUT_FORMAT);
    assert(Array.isArray(manifest.files) && manifest.files.length > 0, 'Empty capture is not evidence'); const names = [];
    for (const row of manifest.files) {
      const compressed = typeof row.file === 'string' && row.file.endsWith('.gz');
      keys(row, compressed ? ['file','bytes','sha256','originalBytes','originalSha256'] : ['file','bytes','sha256'], 'Capture file evidence'); names.push(safeRelativeFile(row.file));
      assert(whole(row.bytes) && digest(row.sha256));
      if (compressed) assert(whole(row.originalBytes) && digest(row.originalSha256));
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
  assert(existsSync(join(repo, 'dist/domain/darkness/owned-session.js')), 'The reviewed Darkness runtime must be built and frozen before auditing');
  for (const file of new Set(['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation', 'node_modules/@noble/hashes'])) walk(file);
  files.push({ file: '$natural-producer', ...fileEvidence(join(repo, PRODUCER)) });
  files.push({ file: 'scripts/play/darkness-stage.test.mjs', ...fileEvidence(join(repo, 'scripts/play/darkness-stage.test.mjs')) }); return { sha256: compactHash(files), nodeVersion: process.version, files };
}
export function assertResumeManifest(saved, current) { assert.deepEqual(saved, current, 'Resume requires the exact capture, selection, source, runtime and verifier'); }
/** Gzip is a transport only. Both stored bytes and every decoded byte are bound. */
export function readCaptureBytes(path) {
  const fingerprint = fileEvidence(path), bytes = readFileSync(path), compressed = path.endsWith('.gz');
  assert.equal(bytes.length, fingerprint.bytes); assert.equal(sha(bytes), fingerprint.sha256);
  const magic = bytes[0] === 0x1f && bytes[1] === 0x8b;
  assert.equal(magic, compressed, 'Capture encoding must match its explicit .gz filename');
  const decoded = compressed ? gunzipSync(bytes) : bytes;
  assert.deepEqual(fileEvidence(path), fingerprint, 'Capture changed while decoding');
  return decoded;
}
export const readCapture = path => JSON.parse(readCaptureBytes(path).toString('utf8'));
export function captureFileEvidence(path) {
  const evidence = fileEvidence(path);
  if (!path.endsWith('.gz')) return evidence;
  const decoded = readCaptureBytes(path);
  assert.deepEqual(fileEvidence(path), evidence, 'Compressed input changed during inspection');
  return { ...evidence, originalBytes: decoded.length, originalSha256: sha(decoded) };
}
export function assertSelectionOutcome(value) {
  keys(value, ['status','promoted','arrivals'], 'Exact public selection outcome');
  assert(['ACTIVE','DEAD','SLICE_COMPLETE','REVIVAL_PENDING'].includes(value.status));
  assert.equal(typeof value.promoted, 'boolean'); assert(whole(value.arrivals) && value.arrivals <= 4);
}
export const selectionOutcome = view => ({ status: view.status, promoted: view.darkness.promoted,
  arrivals: Number(view.darkness.sections.find(section => section.id === 'darkness-evacuation')?.lines.map(line => line.match(/^已到达(\d)\/4/)?.[1]).find(Boolean) ?? 0) });
// Independent, narrowly bounded taxonomy. Selection never executes a command.
export function boundaryKind(intent, outcome) {
  assertSelectionOutcome(outcome); assert.equal(intent.type, 'DARKNESS'); const c = intent.command;
  assert(c && typeof c.type === 'string');
  if (['LEARN_GUIDANCE','STABILIZE_PROMOTION','START_EPILOGUE'].includes(c.type)) return `darkness-${c.type.toLowerCase()}`;
  if (c.type === 'EVACUATION') {
    if (['SHIELD_FALSE_LIGHT','RELAY_INSTRUCTIONS','REPORT'].includes(c.command.type)) return `evacuation-${c.command.type.toLowerCase()}`;
    if (c.command.type === 'WALK' && c.command.to === 110 && outcome.arrivals > 0) return `evacuation-actual-arrival-${outcome.arrivals}`;
  }
  if (c.type === 'MATERIAL') {
    if (['INVESTIGATE_LEGACY_REMAINS','RECOVER_LEGACY_REMAINS'].includes(c.command.type)) {
      assert(/^misfortune-knight-potion-[123]$/.test(c.command.bottleId), 'Only three same original bottles');
      return `material-${c.command.type.toLowerCase()}-${c.command.bottleId}`;
    }
    if (['ACQUIRE_UNIQUENESS','COMPOSE_POTION','SEAL_REMAINS','RECOVER_SEALED'].includes(c.command.type)) return `material-${c.command.type.toLowerCase()}`;
    if (c.command.type === 'VERIFY_UNIQUENESS') {
      assert(['CHAIN','VACANCY'].includes(c.command.step), 'Known actual uniqueness verification');
      return `uniqueness-${c.command.step.toLowerCase()}`;
    }
  }
  if (c.type === 'CONSUME') return outcome.status !== 'ACTIVE' ? 'darkness-actual-terminal-dose' : outcome.promoted ? 'darkness-actual-promotion' : 'darkness-first-failed-dose';
  if (c.type === 'EPILOGUE' && ['SHORT_CONCEALMENT','BOUNDED_MISFORTUNE_DIVERSION','REPORT'].includes(c.command.type)) return `epilogue-${c.command.type.toLowerCase()}`;
  return null;
}
export function selectBoundaries(index, readBoundary) {
  assert(Array.isArray(index) && index.length > 0 && index.length <= BOUNDARY_LIMIT, 'One to25 actual selected transitions');
  const selected = [], filenames = new Set(), kinds = new Set(), commands = new Set(); let prior = PREFIX;
  for (const item of index) {
    keys(item, ['file', 'kind', 'commandCount', 'bytes', 'sha256'], 'Captured boundary index'); safeRelativeFile(item.file);
    assert(typeof item.kind === 'string' && /^[A-Za-z0-9_-]+$/.test(item.kind), 'Named actual semantic boundary');
    assert(!filenames.has(item.file) && !kinds.has(item.kind) && !commands.has(item.commandCount), 'Selected filenames, kinds and command counts must be unique');
    assert(whole(item.commandCount) && item.commandCount > prior && whole(item.bytes) && digest(item.sha256));
    assert.equal(item.file, `boundary-${item.commandCount}-${item.kind}.json.gz`, 'Exact producer gzip boundary filename');
    filenames.add(item.file); kinds.add(item.kind); commands.add(item.commandCount); prior = item.commandCount;
    const boundary = readBoundary(item);
    keys(boundary, ['commandCount', 'beforeLast', 'lastIntent', 'final', 'public', 'globalPublicSha256', 'audit'], 'Actual producer boundary');
    assert.equal(boundary.commandCount, item.commandCount);
    selected.push({ commandCount: item.commandCount, kinds: [item.kind], files: [item.file], boundarySha256: stateHash(boundary) });
  }
  return selected;
}
export function assertBoundarySelection(rows, selected) {
  assert(Array.isArray(rows) && rows.length > 0); const expected = [], seen = new Set();
  for (const [i, row] of rows.entries()) {
    assert.equal(row.commandCount, PREFIX + i + 1, 'Complete continuous command ledger');
    const kind = boundaryKind(row.intent, row.selectionOutcome);
    if (kind && !seen.has(kind) && expected.length < BOUNDARY_LIMIT) {
      seen.add(kind); expected.push({ commandCount: row.commandCount, kinds: [kind] });
    }
  }
  assert.deepEqual(selected.map(({ commandCount, kinds }) => ({ commandCount, kinds })), expected,
    'Exactly the first actual instance of each selected kind, in ledger order, bounded at25');
}
export function assertCaptureStatus(capture, cp, summary) {
  const paused = capture.stage === 'MANUAL_PAUSE';
  const diagnostic = ['PUBLIC_ACTION_BLOCKED','PUBLIC_STABILITY_BINDING_BLOCKED','PUBLIC_NO_PROGRESS_DIAGNOSTIC','PUBLIC_ORDINARY_EXIT_REACHED'].includes(capture.stage);
  assert(['MANUAL_PAUSE','PUBLIC_ACTION_BLOCKED','PUBLIC_STABILITY_BINDING_BLOCKED','PUBLIC_NO_PROGRESS_DIAGNOSTIC',
    'PUBLIC_ORDINARY_EXIT_REACHED','NATURAL_CARRIERS_UNAVAILABLE','NATURAL_ACTUAL_TERMINAL','NATURAL_FINITE_DARKNESS_REPORTED'].includes(capture.stage), 'Known actual producer stopping condition');
  assert.equal(summary.paused, paused); assert.equal(summary.diagnostic, diagnostic);
  assert.deepEqual(cp.terminal, paused || diagnostic ? null : { stage: capture.stage, reason: capture.reason });
  if (capture.stage === 'NATURAL_ACTUAL_TERMINAL') {
    assert(['DEAD', 'SLICE_COMPLETE', 'REVIVAL_PENDING'].includes(cp.state.status), 'A real terminal or paused-life status is retained, not rewritten as death');
    assert.equal(capture.reason, `Actual runtime status ${cp.state.status}`);
  } else assert.equal(cp.state.status, 'ACTIVE');
  if (capture.stage === 'NATURAL_FINITE_DARKNESS_REPORTED') assert.equal(cp.policy.reported, true);
}
export function assertCommandRows(cp, source) {
  assert(Array.isArray(cp.commands) && cp.commands.length > 0); assert(Array.isArray(cp.rows));
  assert.equal(cp.commandCount,PREFIX+cp.commands.length); assert.equal(cp.rows.length,cp.commands.length);
  assert.equal(cp.finalStateSha256,stateHash(cp.state));
  let state = cp.initialStateSha256, publicHash = cp.initialPublicSha256, globalPublicHash = cp.initialGlobalPublicSha256, random = cp.initialRandomSha256, policy = stateHash(INITIAL_POLICY);
  for (const [i, row] of cp.rows.entries()) {
    keys(row, ['commandCount','intent','commandSha256','reason','publicLabel','publicCost','startedAt','elapsedMilliseconds','revision','week',
      'beforeStateSha256','afterStateSha256','publicBeforeSha256','publicAfterSha256','globalPublicBeforeSha256','globalPublicAfterSha256','randomBefore','randomAfter','randomBeforeSha256','randomAfterSha256',
      'policyBeforeSha256','policyAfterSha256','receipts','selectionOutcome'], 'Exact completed command ledger row');
    assert.equal(row.commandCount, PREFIX+i+1); assert.equal(row.revision, row.commandCount+1); assert(whole(row.week));
    assert.deepEqual(row.intent, cp.commands[i]); assert.equal(row.intent.type, 'DARKNESS'); assert.equal(row.commandSha256, compactHash(row.intent));
    for (const key of ['reason','publicLabel','publicCost']) assert.equal(typeof row[key], 'string');
    assert(typeof row.startedAt === 'string' && Number.isFinite(Date.parse(row.startedAt))); assert(whole(row.elapsedMilliseconds));
    assert.equal(row.beforeStateSha256, state); assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.globalPublicBeforeSha256,globalPublicHash); assert.equal(row.randomBeforeSha256, random); assert.equal(row.policyBeforeSha256, policy);
    assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore)); assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    for (const rng of [row.randomBefore,row.randomAfter]) { keys(rng, ['seed','cursor'], 'Exact RNG'); assert.equal(rng.seed, source.random.seed); assert(whole(rng.cursor)); }
    assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    for (const hash of [row.beforeStateSha256,row.afterStateSha256,row.publicBeforeSha256,row.publicAfterSha256,row.globalPublicBeforeSha256,row.globalPublicAfterSha256,row.policyAfterSha256]) assert(digest(hash));
    assertSelectionOutcome(row.selectionOutcome);
    if (i < cp.rows.length-1) assert.equal(row.selectionOutcome.status, 'ACTIVE', 'No command beyond an actual terminal');
    keys(row.receipts, ['checks','finance','notes'], 'Actual completed receipts'); for (const value of Object.values(row.receipts)) assert(Array.isArray(value));
    state = row.afterStateSha256; publicHash = row.publicAfterSha256; globalPublicHash = row.globalPublicAfterSha256; random = row.randomAfterSha256; policy = row.policyAfterSha256;
  }
  assert.equal(state, cp.finalStateSha256); assert.equal(publicHash, cp.publicStateSha256); assert.equal(globalPublicHash,cp.globalPublicStateSha256); assert.equal(random, stateHash(cp.state.random));
  assert.equal(policy, stateHash(cp.policy)); assert.equal(cp.policy.week, cp.state.week);
}
export function inspectCapture(root, repo, freeze) {
  const retained = ['source-boundary679.json.gz','source-state679.json.gz','archived-original694.json.gz'];
  const buffers = INPUTS.map((pin, index) => {
    const bytes = readCaptureBytes(join(repo, pin.file)); assert.equal(sha(bytes), pin.sha256, 'Exact original historical input');
    assert(readCaptureBytes(join(root, retained[index])).equals(bytes), 'Every retained original byte must remain exact'); return bytes;
  });
  const history = JSON.parse(buffers[2]), originalBoundary = JSON.parse(buffers[0]), source = JSON.parse(buffers[1]);
  assert.deepEqual(originalBoundary.final, source); assert.equal(compactHash(source), SNAPSHOT_SHA256);
  assert.equal(history.commands.length, 694); assert.equal(history.final.status, 'DEAD'); assert.equal(history.seed, source.random.seed);
  const prefix = history.commands.slice(0, PREFIX); assert.equal(compactHash(prefix), PREFIX_SHA); assert.deepEqual(prefix.at(-1), originalBoundary.lastIntent);
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.revision, PREFIX+1); assert.equal(source.runId, 'sleepless-rebuild-natural');
  assert.equal(source.schemaVersion, 188); assert.equal(source.contentVersion, 'misfortune-knight-v188');
  assert.equal(source.week, 158); assert.deepEqual(source.random, { seed: 'sleepless-natural-v020', cursor: 348 });
  const inputFiles = INPUTS.map((pin,i) => ({ ...pin, bytes: buffers[i].length }));
  const inputFreeze = { format: 'DARKNESS679_HISTORICAL_INPUTS_V1', sha256: compactHash(inputFiles), files: inputFiles,
    peacefulStateSha256: SNAPSHOT_SHA256, prefixSha256: PREFIX_SHA, archivedCommandCount: 694 };
  assert.deepEqual(readCapture(join(root, 'input-freeze.json')), inputFreeze);
  const migration = readCapture(join(root, 'migration-initial.json.gz'));
  keys(migration, ['originalStateSha256','migratedStateSha256','publicSha256','globalPublicSha256','final'], 'Exact captured migration');
  assert.equal(migration.originalStateSha256, SNAPSHOT_SHA256); assert.equal(migration.migratedStateSha256, stateHash(migration.final));
  assert.equal(migration.final.schemaVersion, 210); assert.equal(migration.final.contentVersion, 'darkness-v210');
  for (const [key,value] of Object.entries(source)) if (!['schemaVersion','contentVersion'].includes(key)) assert.deepEqual(migration.final[key],value,`Historical migration preserves ${key}`);
  const wrapped = readCapture(join(root, 'checkpoint.json.gz')), cp = wrapped.payload;
  keys(wrapped, ['sha256','payload'], 'Durable checkpoint'); assert.equal(wrapped.sha256, stateHash(cp));
  keys(cp, ['format','source','sourceSha256','prefixSha256','inputFreezeSha256','runtimeFreezeSha256','policyDefinition','policy','migration','createdAt','commandCount',
    'commands','rows','boundaries','state','initialStateSha256','finalStateSha256','initialPublicSha256','publicStateSha256','initialGlobalPublicSha256','globalPublicStateSha256','initialRandomSha256',
    'pending','terminal','predecessorSha256'], 'Exact producer checkpoint');
  assert.equal(cp.format, CAPTURE_FORMAT); assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_SHA); assert.equal(cp.prefixSha256, PREFIX_SHA);
  assert.equal(cp.runtimeFreezeSha256, freeze.sha256); assert.equal(cp.inputFreezeSha256, inputFreeze.sha256); assert.deepEqual(cp.policyDefinition, POLICY);
  assert.deepEqual(cp.migration, { originalStateSha256: SNAPSHOT_SHA256, migratedStateSha256: migration.migratedStateSha256, fromSchema: 188, toSchema: 210 });
  assert.equal(cp.initialStateSha256, migration.migratedStateSha256); assert.equal(cp.initialPublicSha256,migration.publicSha256); assert.equal(cp.initialGlobalPublicSha256,migration.globalPublicSha256); assert.equal(cp.initialRandomSha256,stateHash(source.random));
  assert.equal(cp.pending, null, 'A pending command is not completed evidence');
  assert(typeof cp.createdAt === 'string' && Number.isFinite(Date.parse(cp.createdAt))); assert(digest(cp.predecessorSha256));
  for (const hash of [cp.initialStateSha256,cp.initialPublicSha256,cp.initialGlobalPublicSha256,cp.globalPublicStateSha256,cp.initialRandomSha256]) assert(digest(hash));
  assert(Array.isArray(cp.commands) && cp.commands.length > 0 && Array.isArray(cp.rows) && Array.isArray(cp.boundaries));
  assert.equal(cp.commandCount, PREFIX+cp.commands.length); assert.equal(cp.rows.length, cp.commands.length);
  assert.equal(cp.finalStateSha256, stateHash(cp.state)); assert.equal(cp.state.schemaVersion,210); assert.equal(cp.state.contentVersion,'darkness-v210');
  const capture = readCapture(join(root, 'natural.json.gz')), summary = readCapture(join(root, 'summary.json'));
  keys(capture, ['provenance','creation','seed','prefixCount','commands','policy','stage','reason','pendingIntent','boundaries','final'], 'Exact natural capture');
  assert(typeof capture.reason === 'string'); assert.equal(capture.prefixCount,PREFIX); assert.deepEqual(capture.final,cp.state);
  assert.deepEqual(capture.policy,POLICY); assert.deepEqual(capture.commands,[...prefix,...cp.commands]);
  assert.deepEqual(capture.creation,history.creation); assert.equal(capture.seed,history.seed); assert.equal(capture.pendingIntent,null); assert.deepEqual(capture.boundaries,cp.boundaries);
  assert.deepEqual(capture.provenance, { kind: 'EXACT_ORIGINAL_LIVING679_PUBLIC_DARKNESS_CONTINUATION',
    source: SOURCE, sourceSha256: SOURCE_SHA, peacefulStateSha256: SNAPSHOT_SHA256, originalEvidence: retained,
    prefixCommandsSha256: PREFIX_SHA, inputFreezeSha256: inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256,
    historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, independent694DeathRetainedExactly: true, independent694DeathUsedAsInput: false,
    privateAudit: true, seedChanged: false, randomOverridden: false, futureDrawInspected: false, selectedFromEnabledPublicActionsOnly: true,
    selectedSQLiteBoundaries: 'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER', globalPublicScope: 'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH', projectionScope: 'CURRENT_DARKNESS_AND_ORDINARY_PUBLIC_DASHBOARD' });
  assert.deepEqual(summary, { stage: capture.stage, reason: capture.reason, commands: cp.commandCount, originalCommands: PREFIX,
    newCommands: cp.commands.length, week: cp.policy.week, paused: capture.stage === 'MANUAL_PAUSE', diagnostic: capture.stage.startsWith('PUBLIC_'),
    strictFinalValidation: true, sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', checkpoint: 'checkpoint.json.gz', public: summary.public });
  assert.equal(stateHash(summary.public),cp.publicStateSha256); assertPublicOnly(summary.public); assertCaptureStatus(capture,cp,summary);
  const ledger = readCaptureBytes(join(root,'commands.ndjson.gz')).toString('utf8');
  assert.equal(ledger,cp.rows.map(row => JSON.stringify(row)).join('\n')+'\n','The complete tail, byte-for-byte, with no omissions or duplicate lines');
  assert.deepEqual(readCapture(join(root,'boundaries.index.json')),cp.boundaries);
  const producer = freeze.files.find(row => row.file === '$natural-producer'); assert(producer);
  assert.deepEqual(fileEvidence(join(root,'producer.mjs')),{bytes:producer.bytes,sha256:producer.sha256});
  assertCommandRows(cp,source); assert.deepEqual(cp.rows.at(-1).selectionOutcome,selectionOutcome(summary.public));
  const selected = selectBoundaries(cp.boundaries, item => {
    const path = join(root,item.file); assert.deepEqual(fileEvidence(path),{bytes:item.bytes,sha256:item.sha256});
    const b = readCapture(path), row = cp.rows[item.commandCount-PREFIX-1]; assert(row,'Boundary belongs to complete tail');
    assert.deepEqual(b.audit,{...row,elapsedMilliseconds:null}); assert.deepEqual(b.lastIntent,row.intent);
    assert.equal(stateHash(b.beforeLast),row.beforeStateSha256); assert.equal(stateHash(b.final),row.afterStateSha256);
    assert.equal(stateHash(b.public),row.publicAfterSha256); assert.equal(b.globalPublicSha256,row.globalPublicAfterSha256); assertPublicOnly(b.public); assert.deepEqual(selectionOutcome(b.public),row.selectionOutcome);
    assert.deepEqual(b.beforeLast.random,row.randomBefore); assert.deepEqual(b.final.random,row.randomAfter);
    for (const value of [b.beforeLast,b.final]) { assert.equal(value.schemaVersion,210); assert.equal(value.contentVersion,'darkness-v210'); }
    assert.equal(b.beforeLast.status,'ACTIVE'); assert.equal(b.beforeLast.revision,item.commandCount); assert.equal(b.final.revision,item.commandCount+1); return b;
  });
  assertBoundarySelection(cp.rows,selected); assert.equal(selected[0].commandCount,PREFIX+1);
  assert.deepEqual(cp.commands[0],{type:'DARKNESS',command:{type:'LEARN_GUIDANCE'}});
  const expectedFiles = new Set(['runtime-freeze.json','input-freeze.json','producer.mjs',...retained,'migration-initial.json.gz',
    'checkpoint.json.gz','commands.ndjson.gz','boundaries.index.json','natural.json.gz','summary.json','error.json',...cp.boundaries.map(b=>b.file)]);
  for (const file of readdirSync(root)) { assert(expectedFiles.has(file),`Unknown or unfinished capture artifact retained: ${file}`); regular(join(root,file)); }
  assert(whole(cp.policy.doses) && cp.policy.doses <= POLICY.carrierLimit); assert(Array.isArray(cp.policy.carriers) && cp.policy.carriers.length <= POLICY.carrierLimit);
  assert.equal(new Set(cp.policy.carriers).size,cp.policy.carriers.length);
  return { cp, source, history, inputFreeze, initial: migration.final, capture, selected };
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
  assert(!existsSync(join(work,'phase.json.next')), 'Unresolved phase successor retained before archive');
  const index = json(completedIndexPath), phase = json(regular(join(work, 'phase.json')));
  assert(whole(result.commandCount) && result.commandCount > PREFIX, 'Only actual completed Darkness transition results');
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
  const archive = { format: 'DARKNESS213_COMPLETED_SQLITE_GZIP_V1', manifestSha256: index.manifestSha256, files: {} };
  for (const name of names) {
    const rawPath = join(work, name), gzipPath = `${rawPath}.gz`, hasRaw = existsSync(rawPath);
    let raw;
    if (hasRaw) { assert.deepEqual(fileEvidence(rawPath), expected[name]); raw = readFileSync(rawPath); }
    else assert(recorded, 'Missing raw bytes require the already-durable archive manifest');
    if (!existsSync(gzipPath)) {
      assert(raw, 'Missing both original and compressed evidence');
      writeFileSync(gzipPath, gzipSync(raw, { level: 9 }), { flag: 'wx' }); sync(gzipPath); sync(work);
    }
    const compressed = fileEvidence(gzipPath), restored = readCaptureBytes(gzipPath);
    assert.deepEqual(fileEvidence(gzipPath), compressed, 'Compressed archive changed during verification');
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
    assert.deepEqual(fileEvidence(join(work, `${name}.gz`)),
      { bytes: archive.files[name].gzip.bytes, sha256: archive.files[name].gzip.sha256 }, 'Verified gzip changed before raw retirement');
    assert.deepEqual(fileEvidence(join(work, name)), expected[name]); rmSync(join(work, name));
  }
  sync(work); return archive;
}
function equalState(actual, expected) { assert.equal(stateHash(actual), stateHash(expected), 'Exact complete private state'); }
export function assertPublicOnly(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const labelSource = key === 'source' && /\.(?:(?:modifiers|debts|companions)\.\d+|companion|companionAfter|kit|expert)$/.test(path) && typeof child === 'string';
    assert(!['seed','cursor','randomSeed','randomCursor','random','rng','rngState','futureRoll','futureRolls','nextRoll','unrolledResult','privateSource','sourceState','frame','journal'].includes(key), `Private public field at ${path}.${key}`);
    assert(key !== 'source' || labelSource, `Private public source at ${path}.${key}`); assertPublicOnly(child, `${path}.${key}`);
  }
}
export function assertGlobalPublic(projection, state) {
  const forbidden = new Set(['random','seed','cursor','randomSeed','randomCursor','randomCursorBefore','randomCursorAfter',
    'cursorBefore','cursorAfter','randomBefore','randomAfter','randomReceipts','sourceDigest','historyDigest','originalsDigest',
    'originalPracticeDigest','acquisitionDigest','beforeDigest','afterDigest','actorId','predecessorActorId','incumbentActorId',
    'custodianActorId','futureRoll','futureRolls','nextRoll','unrolledResult']);
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    for (const [key,value] of Object.entries(node)) {
      const next = `${path}.${key}`, inactiveGuard = key === 'actorId' && value === null &&
        ['$.divineHand.life.site.guard.actorId','$.glory.life.site.guard.actorId'].includes(next);
      assert(!(forbidden.has(key) && !inactiveGuard) && !(key === 'source' && value !== null && typeof value === 'object'), `Private global field at ${next}`);
      visit(value, next);
    }
  };
  visit(projection, '$');
  const json = JSON.stringify(projection);
  for (const secret of [state.random.seed,state.darkness?.source?.actorId,state.darkness?.source?.historyDigest].filter(Boolean))
    assert(!json.includes(secret), 'Whole public projection contains an actual private seed or source identity');
}
export function capturePublic(projection) {
  const fields = ['runId','revision','status','week','date','actionsRemaining','weeklyBudget','cash','weeklyWage','wagePaid',
    'health','mind','spirituality','maxHealth','maxMind','maxSpirituality','pollution','injuries','injuryRisk',
    'debtTotal','debts','canAct','actionBlockedReason','activeEvent','combat'];
  const result = { ...Object.fromEntries(fields.map(key => [key, structuredClone(projection[key])])),
    progression: { sequence: projection.progression.sequence, acting: projection.progression.acting, mastery: structuredClone(projection.progression.mastery) },
    darkness: structuredClone(projection.darkness) };
  assertPublicOnly(result); return result;
}
export function assertPublicAction(view, intent, audit) {
  assert.equal(intent.type, 'DARKNESS');
  const offered = view.darkness.actions.find(action => stable(action.command) === stable(intent.command));
  assert.equal(offered?.enabled, true, 'Captured command must have been enabled publicly');
  assert.equal(offered.label, audit.publicLabel); assert.equal(offered.cost, audit.publicCost);
}
function checkSqlite(runtime, DatabaseSync, work, manifestSha256, transition, boundary) {
  const { beforeLast: before, lastIntent: intent, final: after } = boundary;
  runtime.assertValidSliceState(before); runtime.assertValidSliceState(after); assert.equal(before.status,'ACTIVE');
  runtime.checkOriginals(before,runtime.originalSource,before); runtime.checkOriginals(after,runtime.originalSource,before);
  const beforeSession = before.darkness.guidanceKnown ? runtime.openDarknessRuntimeSession(before) : null;
  const afterSession = after.darkness.guidanceKnown ? runtime.openDarknessRuntimeSession(after) : null;
  if (beforeSession) equalState(beforeSession.snapshot(),before); if (afterSession) equalState(afterSession.snapshot(),after);
  const publicBefore = beforeSession ? beforeSession.project() : runtime.projectSliceState(before);
  const publicAfter = afterSession ? afterSession.project() : runtime.projectSliceState(after);
  assert.deepEqual(publicBefore,runtime.projectSliceState(before)); assert.deepEqual(publicAfter,runtime.projectSliceState(after));
  const authoredBefore = capturePublic(publicBefore), authoredAfter = capturePublic(publicAfter);
  assert.equal(stateHash(authoredBefore),boundary.audit.publicBeforeSha256); assert.deepEqual(authoredAfter,boundary.public);
  assertPublicAction(authoredBefore,intent,boundary.audit); assert.deepEqual(selectionOutcome(authoredAfter),boundary.audit.selectionOutcome);
  const latest = after.darkness.guidanceKnown ? after.darkness.journal.at(-1) : null;
  const receipts = latest?.revision === after.revision ? { checks: latest.randomReceipts, finance: latest.financeReceipts, notes: latest.notes }
    : { checks: [], finance: [], notes: after.chronicle.slice(before.chronicle.length) };
  assert.deepEqual(boundary.audit.receipts,receipts,'Every actual RNG, finance and authored receipt stays exact');
  if (latest?.revision === after.revision) assert.deepEqual(latest.command,intent.command);
  assertGlobalPublic(publicBefore,before); assertGlobalPublic(publicAfter,after);
  assert.equal(stateHash(publicBefore),boundary.audit.globalPublicBeforeSha256); assert.equal(stateHash(publicAfter),boundary.audit.globalPublicAfterSha256); assert.equal(stateHash(publicAfter),boundary.globalPublicSha256);
  if (afterSession) assert.deepEqual(runtime.projectPlayerText(structuredClone(afterSession.projectDarkness()),after.character.name),publicAfter.darkness);
  const input = { manifestSha256, transition, beforeStateSha256: stateHash(before), stateSha256: stateHash(after), publicStateSha256: stateHash(publicAfter) };
  const path = join(work, 'case.sqlite'), phasePath = join(work, 'phase.json'); let pending;
  if (!existsSync(work)) { mkdirSync(work); atomic(phasePath, { input, phase: 'ALLOCATED', beforeRows: null, beforeFiles: null, committedRows: null }); }
  else { directory(work); databaseFiles(work); assert(!readdirSync(work).some(file => file.endsWith('.gz') || file.startsWith('archive.json')), 'An unindexed case may not contain archived databases'); }
  assert(!existsSync(`${phasePath}.next`), 'Interrupted phase write retained; inspect before resuming');
  pending = json(regular(phasePath)); keys(pending, ['input', 'phase', 'beforeRows', 'beforeFiles', 'committedRows'], 'Case phase');
  assert.deepEqual(pending.input, input); assert(['ALLOCATED', 'BEFORE_SAVED', 'WRITE_ROLLBACK_VERIFIED', 'COMMIT_ROLLBACK_VERIFIED', 'COMMITTED', 'VERIFIED'].includes(pending.phase));
  const checkpoint = phase => { pending.phase = phase; atomic(phasePath, pending); };
  const envelope = { intentId: `darkness213:${transition.commandCount}`, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const receipt = { intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision, newRevision: after.revision, committedAt: COMMIT_TIME, replayed: false, state: publicAfter };
  const rows = () => databaseRows(DatabaseSync, path);
  let app, injection = null, injected = 0, hooks = 0, beforeHead;
  const expectedHead = state => state.darkness.guidanceKnown ? { runId: state.runId, revision: state.revision, status: state.status } : null;
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
        const blocked = app.submitIntent({ ...envelope, intentId: `${envelope.intentId}:archived`, expectedRevision: after.revision, payload: { type: 'DARKNESS', command: { type: 'REST' } } });
        assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.deepEqual(rows(), pending.committedRows);
      } else {
        assert.equal(existsSync(`${path}.sealed`), false, 'SLICE_COMPLETE is not a death seal');
        if (after.status === 'SLICE_COMPLETE') assert.equal(publicAfter.canAct, false);
      }
      close(); app = open(); exact(after, true); bootstrap(publicAfter); assert.deepEqual(rows(), pending.committedRows); close(); checkpoint('VERIFIED');
    } else { assert.equal(pending.phase, 'VERIFIED'); exact(after, true); assert.deepEqual(rows(), pending.committedRows); close(); }
    return { ...transition, beforeStateSha256: input.beforeStateSha256, stateSha256: input.stateSha256, publicStateSha256: input.publicStateSha256,
      authoredPublicSha256: stateHash(authoredAfter), playerChapterSha256: stateHash(publicAfter.darkness), random: after.random,
      revision: after.revision, status: after.status, checks: CHECKS, databaseRows: pending.committedRows, databaseFiles: databaseFiles(work) };
  } finally { injection = null; close(); }
}
export function assertVerifyOptions(options) {
  assert(options && typeof options === 'object' && !Array.isArray(options));
  const allowed = new Set(['repo','sourceDirectory','inputManifest','inputManifestSha256','freezeSha256','verifierSha256',
    'outputDirectory','resumeDirectory','expectedBoundaries','removeStaleLockPid','preflight','help']);
  for (const key of Object.keys(options)) assert(allowed.has(key), `Unsupported verification option ${key}`);
  assert(!(options.outputDirectory && options.resumeDirectory), 'Use one exact output directory');
  if (options.preflight !== undefined) assert.equal(typeof options.preflight,'boolean');
  assert(!options.preflight || !options.outputDirectory && !options.resumeDirectory && !options.removeStaleLockPid, 'Preflight never writes or alters a lock');
  if (options.expectedBoundaries !== undefined) assert(whole(options.expectedBoundaries) && options.expectedBoundaries > 0 && options.expectedBoundaries <= BOUNDARY_LIMIT);
  if (options.removeStaleLockPid !== undefined) assert(whole(options.removeStaleLockPid) && options.removeStaleLockPid > 0);
}
export async function verifyDarknessCapture(options) {
  assertVerifyOptions(options);
  const repo = directory(options.repo ?? process.cwd()), root = directory(options.sourceDirectory);
  for (const key of ['freezeSha256', 'verifierSha256', 'inputManifestSha256']) assert(digest(options[key]), `Required reviewed ${key}`);
  assert.equal(fileEvidence(SELF).sha256, options.verifierSha256);
  const manifestPath = regular(resolve(options.inputManifest)); assert(!contains(root, manifestPath), 'Reviewed input manifest lives outside its own capture');
  assert.equal(fileEvidence(manifestPath).sha256, options.inputManifestSha256);
  const inputManifest = json(manifestPath); assertInputManifest(inspectCaptureInputs(root), inputManifest);
  const freeze = json(join(root, 'runtime-freeze.json')), runtimeFreeze = inspectFreeze(repo);
  assert.equal(freeze.sha256, options.freezeSha256); assertFreeze(freeze, runtimeFreeze);
  const data = inspectCapture(root, repo, freeze);
  if (options.expectedBoundaries !== undefined) assert.equal(data.selected.length, options.expectedBoundaries, 'Unique actual transition count');
  const manifest = { format: FORMAT, databaseRetention: 'VERIFIED_COMPLETED_CASE_GZIP_V1', sourceDirectory: root, repo, inputs: inputManifest, inputManifest: fileEvidence(manifestPath),
    freeze, runtimeFreeze, historicalInputFreeze: data.inputFreeze, verifier: fileEvidence(SELF), selected: data.selected, node: process.version };
  const manifestSha256 = stateHash(manifest);
  const recheck = () => {
    assertInputManifest(inspectCaptureInputs(root), inputManifest); assertFreeze(runtimeFreeze, inspectFreeze(repo));
    assert.equal(fileEvidence(SELF).sha256, options.verifierSha256);
    for (const pin of data.inputFreeze.files) assert.deepEqual(fileEvidence(join(repo,pin.file)),{bytes:pin.bytes,sha256:pin.sha256},'Historical source changed during audit');
    assert.deepEqual(fileEvidence(manifestPath), manifest.inputManifest, 'Reviewed manifest changed during audit');
  };
  if (options.preflight) {
    recheck();
    return { preflight: 'PASSED_NO_GAME_NO_SQLITE_NO_WRITES', manifestSha256, stage: data.capture.stage,
      captureFreezeSha256: freeze.sha256, runtimeFreezeSha256: runtimeFreeze.sha256,
      newCommands: data.cp.commands.length, uniqueTransitions: data.selected.length, boundaryAliases: data.cp.boundaries.length - data.selected.length };
  }
  assert(options.outputDirectory || options.resumeDirectory, 'Choose an explicit output or resume directory');
  recheck();
  const forbidden = [root, manifestPath, ...['src', 'dist', 'scripts', 'tests', 'docs', 'node_modules', '.git'].map(file => join(repo, file))];
  const out = assertOutputPath(options.resumeDirectory ?? options.outputDirectory, forbidden);
  if (options.resumeDirectory) directory(out);
  else { if (existsSync(out)) assert.equal(readdirSync(directory(out)).length, 0, 'New output directory must be empty'); else mkdirSync(out, { recursive: true }); }
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
    for (const selected of data.selected.slice(index.results.length + 1)) assert(!existsSync(join(out, `case-${selected.commandCount}`)), 'Only the first incomplete case can have unindexed evidence');
    for (const [i, result] of index.results.entries()) {
      keys(result, ['commandCount','kinds','files','boundarySha256','beforeStateSha256','stateSha256','publicStateSha256',
        'authoredPublicSha256','playerChapterSha256','random','revision','status','checks','databaseRows','databaseFiles',
        ...(Object.hasOwn(result,'databaseArchives') ? ['databaseArchives'] : [])], 'Exact completed transition result');
      const selected = data.selected[i]; assert.equal(result.commandCount, selected.commandCount); assert.deepEqual(result.files, selected.files); assert.deepEqual(result.kinds, selected.kinds); assert.equal(result.boundarySha256, selected.boundarySha256);
      const row = data.cp.rows[result.commandCount - PREFIX - 1]; assert.equal(result.beforeStateSha256, row.beforeStateSha256); assert.equal(result.stateSha256, row.afterStateSha256);
      assert.equal(result.authoredPublicSha256, row.publicAfterSha256); assert.equal(result.revision, row.revision); assert.deepEqual(result.random, row.randomAfter); assert.equal(result.status,row.selectionOutcome.status); assert.deepEqual(result.checks, CHECKS);
      assert.equal(result.publicStateSha256,row.globalPublicAfterSha256);
      const boundary = readCapture(join(root,selected.files[0])); assert.equal(result.playerChapterSha256,stateHash(boundary.public.darkness));
      const work = join(out, `case-${result.commandCount}`), phase = json(regular(join(work, 'phase.json')));
      assert.equal(phase.phase, 'VERIFIED'); assert.equal(phase.input.manifestSha256, manifestSha256); assert.deepEqual(phase.input.transition, selected);
      assert.equal(phase.input.beforeStateSha256, result.beforeStateSha256); assert.equal(phase.input.stateSha256, result.stateSha256); assert.equal(phase.input.publicStateSha256, result.publicStateSha256);
      assert.deepEqual(phase.committedRows, result.databaseRows);
      const archive = archiveCompletedCase(work, result, indexFile);
      if (!result.databaseArchives) { result.databaseArchives = archive; atomic(indexFile, index); }
    }
    let runtime, sqlite;
    if (index.results.length < data.selected.length) {
      const modules = await Promise.all(['dist/domain/slice/index.js','dist/domain/slice/migration.js','dist/persistence/slice-store.js',
        'dist/shared/player-text.js','dist/domain/darkness/owned-session.js',PRODUCER].map(file => import(pathToFileURL(join(repo,file)).href)).concat(import('node:sqlite')));
      const [slice,migration,store,playerText,session,producer,database] = modules; sqlite = database;
      runtime = { ...slice,...migration,...store,...playerText,...session, checkOriginals: producer.checkOriginals, originalSource: data.source };
      runtime.assertValidSliceState(data.cp.state);
      const finalSession = data.cp.state.darkness.guidanceKnown ? runtime.openDarknessRuntimeSession(data.cp.state) : null;
      if (finalSession) equalState(finalSession.snapshot(),data.cp.state);
      const finalPublic = finalSession ? finalSession.project() : runtime.projectSliceState(data.cp.state); assertGlobalPublic(finalPublic,data.cp.state);
      assert.equal(stateHash(capturePublic(finalPublic)),data.cp.publicStateSha256); assert.equal(stateHash(finalPublic),data.cp.globalPublicStateSha256);
      const initial = runtime.migrateSliceState(data.source); assert.equal(stateHash(initial),data.cp.initialStateSha256); equalState(initial,data.initial);
      assert.equal(initial.schemaVersion,210); assert.equal(initial.contentVersion,'darkness-v210'); runtime.assertValidSliceState(initial);
      for (const [key,value] of Object.entries(data.source)) if (!['schemaVersion','contentVersion'].includes(key)) assert.deepEqual(initial[key],value,`Original679 migration preserves ${key}`);
      producer.verifyCheckpoint(data.cp,freeze,stateHash(initial),data.inputFreeze);
      const initialPublic = runtime.projectSliceState(initial); assertGlobalPublic(initialPublic,initial);
      assert.equal(stateHash(initialPublic),data.cp.initialGlobalPublicSha256); assert.equal(stateHash(capturePublic(initialPublic)),data.cp.initialPublicSha256); assert.equal(stateHash(initial.random),data.cp.initialRandomSha256);
      const first = readCapture(join(root,data.selected[0].files[0])); equalState(first.beforeLast,initial);
      // Selection facts are cross-checked against genuine public states for each
      // selected transition. This audit does not claim full unselected-tail replay.
      assert.deepEqual(capturePublic(runtime.projectSliceState(initial)),producer.capturePublic(runtime.projectSliceState(initial)));
    }
    for (const transition of data.selected.slice(index.results.length)) {
      recheck(); const boundary = readCapture(join(root, transition.files[0])); assert.equal(stateHash(boundary), transition.boundarySha256);
      const result = checkSqlite(runtime, sqlite.DatabaseSync, join(out, `case-${transition.commandCount}`), manifestSha256, transition, boundary);
      recheck();
      index.results.push(result); atomic(indexFile, index);
      result.databaseArchives = archiveCompletedCase(join(out, `case-${transition.commandCount}`), result, indexFile); atomic(indexFile, index);
      console.log(JSON.stringify({ event: 'SQLITE_CASE_VERIFIED', commandCount: transition.commandCount, completed: index.results.length, total: data.selected.length })); global.gc?.();
    }
    recheck();
    assert.equal(index.results.length, data.selected.length); index.complete = true; atomic(indexFile, index);
    const report = { format: FORMAT, passed: true, complete: true, exitCode: 0, manifestSha256, stage: data.capture.stage,
      captureFreezeSha256: freeze.sha256, runtimeFreezeSha256: runtimeFreeze.sha256, historicalInputFreezeSha256: data.inputFreeze.sha256,
      capturedCommandCount: data.cp.commandCount, retainedTailCommands: data.cp.commands.length, finalStateSha256: data.cp.finalStateSha256,
      finalChapterPublicSha256: data.cp.publicStateSha256, finalGlobalPublicSha256: data.cp.globalPublicStateSha256,
      publicProjection: 'EXACT_CAPTURED_CHAPTER_AND_GLOBAL_HASHES_SELECTED_SQLITE_TRANSITIONS',
      completedTransitions: index.results.length, selectedUniqueTransitions: data.selected.length, aliases: data.cp.boundaries.length - data.selected.length,
      original679HistoricalReplay: 'NOT_RUN', independent694DeathUsedAsInput: false, originalSchema188To210: 'EXACT_RETAINED_MIGRATION', newTailSequentialReplay: 'NOT_RUN_SELECTED_CAPTURED_TRANSITIONS_ONLY',
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
  assert(!result.preflight || !result.outputDirectory && !result.resumeDirectory && !result.removeStaleLockPid, 'Preflight never writes or alters a lock');
  if (result.expectedBoundaries !== undefined) assert(result.expectedBoundaries <= BOUNDARY_LIMIT, 'At most25 selected transitions');
  assertVerifyOptions(result); return result;
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) console.log('node --expose-gc scripts/verify-darkness-sqlite.mjs --source-directory CAPTURE --input-manifest EXTERNAL_REVIEWED_MANIFEST --input-manifest-sha256 SHA --freeze-sha256 SHA --verifier-sha256 SHA [--preflight | --output-directory NEW_DIR | --resume-directory SAME_DIR] [--expected-boundaries N] [--remove-stale-lock-pid DEAD_PID]. Create and review the external manifest from exported inspectCaptureInputs(CAPTURE), then pin its file SHA. Original679 alive and independent694 DEAD bytes stay exact. The original capture runtime/input/producer freeze is immutable; future migration is not accepted as that capture freeze. Preflight imports no game or SQLite and writes nothing. At most25 unique actual captured transitions receive beforeWrite and COMMIT rollback, same-intent retry, reopen and duplicate-idempotency checks. Neither historical679 nor the unselected natural tail is replayed; no draw or seed is replaced. Completed closed and durably indexed databases are retained as byte-verified gzip; unfinished databases stay raw. Completed gzip resume does not rerun transactions. Restore with gunzip -c case.sqlite.gz > restored.sqlite. Unknown state or live locks stop without cleanup.');
    else { const report = await verifyDarknessCapture(options); console.log(JSON.stringify(options.preflight ? report : { passed: report.passed, complete: report.complete, exitCode: 0, completedTransitions: report.completedTransitions, selectedUniqueTransitions: report.selectedUniqueTransitions })); }
  } catch (error) { console.error(JSON.stringify({ passed: false, complete: false, exitCode: 1, error: String(error) })); process.exitCode = 1; }
}
