import assert from 'node:assert/strict';
import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, realpathSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, basename, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';

// Candidate verifier. No game import, play, SQLite open, or file write on import.
// It consumes the producer's ORIGINAL format. It never rewrites a capture, plays
// a pending intent, invents boundary snapshots, or claims a 0 -> 1868 replay.
// The independently captured original1856 -> 1868 tail IS replayed first.
const SELF = fileURLToPath(import.meta.url);
const FORMAT = 'FOOL208_TAIL_AND_SQLITE_AUDIT_V1';
const CHECKS = ['save-before-reopen', 'injected-after-apply-rollback', 'rollback-rows-backup-selection-timestamps-unchanged', 'rollback-reopen-no-receipt', 'commit-exact-private-and-public-state', 'commit-reopen', 'same-intent-idempotent-after-reopen', 'same-id-conflicting-envelope-no-mutation', 'stale-revision-no-mutation', 'final-reopen'];
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const keys = (value, expected, label) => {
  assert(value && typeof value === 'object' && !Array.isArray(value), label);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
};
const whole = x => Number.isSafeInteger(x) && x >= 0;
const digest = x => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);
const sync = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
function atomic(path, value) {
  const temp = `${path}.next`;
  if (existsSync(temp)) assert.equal(realpathSync(temp), temp, 'No checkpoint symlinks');
  writeFileSync(temp, JSON.stringify(value)); sync(temp); renameSync(temp, path); sync(dirname(path));
}
function regular(path) {
  assert.equal(realpathSync(path), path, `No symlink input/output: ${path}`);
  assert(lstatSync(path).isFile(), `Expected regular file: ${path}`); return path;
}
function directory(path) {
  const absolute = resolve(path); assert.equal(realpathSync(absolute), absolute, 'No directory symlinks');
  assert(lstatSync(absolute).isDirectory()); return absolute;
}
function within(root, path) { const r = relative(root, path); return r === '' || r !== '..' && !r.startsWith(`..${sep}`) && !r.startsWith(sep); }
function safeOutput(path, forbidden) {
  const absolute = resolve(path);
  for (const input of forbidden) assert(!within(input, absolute) && !within(absolute, input), `Output overlaps immutable input: ${input}`);
  let cursor = absolute;
  while (!existsSync(cursor)) { const parent = dirname(cursor); assert.notEqual(parent, cursor); cursor = parent; }
  directory(cursor); mkdirSync(absolute, { recursive: true }); return directory(absolute);
}
function claimAudit(outputDir, manifestSha256) {
  const path = join(outputDir, 'audit.lock.json'), owner = { kind: FORMAT, manifestSha256, pid: process.pid };
  if (existsSync(path)) {
    const prior = json(regular(path)); keys(prior, ['kind', 'manifestSha256', 'pid'], 'Audit lock');
    assert.equal(prior.kind, FORMAT); assert.equal(prior.manifestSha256, manifestSha256); assert(whole(prior.pid) && prior.pid > 0);
    let alive = true;
    try { process.kill(prior.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
    assert.equal(alive, false, 'The verification directory already has a live audit process');
    rmSync(path); // This generated stale lock is not evidence or a database.
  }
  writeFileSync(path, JSON.stringify(owner), { flag: 'wx' }); sync(path); sync(outputDir);
  return () => { assert.deepEqual(json(regular(path)), owner); rmSync(path); sync(outputDir); };
}
export function assertFoolFreezeCompatibility(captured, current) {
  for (const f of [captured, current]) {
    keys(f, ['sha256', 'files'], 'Freeze shape'); assert(digest(f.sha256)); assert(Array.isArray(f.files));
    const paths = new Set();
    for (const row of f.files) { keys(row, ['file', 'bytes', 'sha256'], 'Freeze row'); assert(typeof row.file === 'string' && !paths.has(row.file)); paths.add(row.file); assert(whole(row.bytes) && digest(row.sha256)); }
    assert.equal(hash(f.files), f.sha256, 'Freeze digest must describe every ordered row');
  }
  assert.deepEqual(current, captured, 'No source, compiled, runner, dependency, or UI exception to this capture freeze');
}
export function assertFoolInputEvidence(actual, expected, label = 'input') {
  for (const e of [actual, expected]) { keys(e, ['bytes', 'sha256'], `Exact ${label} evidence`); assert(whole(e.bytes) && digest(e.sha256)); }
  assert.deepEqual(actual, expected, `Immutable input changed: ${label}`);
}
export function assertFoolResumeManifest(saved, current) { assert.deepEqual(saved, current, 'Resume is bound to the exact complete inputs, runtime, producer and verifier'); }

// The approved reconstruction is a distinct evidence source, never an exception
// to the CURRENT capture/runtime freeze. Keep these five original files exact;
// the original runtime archive and reconstructed full-state tree are not needed
// to independently compare all 44 states during the ordinary tail replay.
const ORIGINAL_RESUME_RECORDED_DIRECTORY = 'output/qa-0208/manual-pause-1851';
const ORIGINAL_RESUME_EVIDENCE = {
  'interruption.json': { bytes: 2204, sha256: '04d80eeded74a63642e27941ee764b1ed1958f7397f9545c38abe8c86a96f048' },
  'terminated-commands.jsonl': { bytes: 36122, sha256: '09ba77d6c0edde3b6df7f0a26c625808bef3b0ca20b01d173c32d420756604b1' },
  'freeze-before-natural.json': { bytes: 544258, sha256: 'cb10464dcbdb5ff36ec26c4e5f4cf6db79d29e50ba510ae43d4215c1130d6689' },
  'baseline/summary.json': { bytes: 848, sha256: '475e33e9f5de0b1e075bacd6ff233a506005bcd866c2a5881eed568848baf8ae' },
  'baseline/states.jsonl': { bytes: 22268, sha256: '80bcbdde0ed4f4476420e8d156b2f34258981404712e1b24c32ce5d2e55c3853' },
};
const textEvidence = text => ({ bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') });
function completeRows(text) {
  assert(typeof text === 'string' && text.length > 0 && text.endsWith('\n'), 'A complete JSONL input ends with a newline');
  return text.slice(0, -1).split('\n').map(line => { assert(line.length > 0, 'No blank ledger rows'); return JSON.parse(line); });
}
export function assertFoolCaptureProvenance(actual, base, resumeProvenance) {
  assert.deepEqual(actual, { ...base, resumeProvenance }, 'Exact producer provenance, including independently validated resume lineage');
}
export function assertFoolOriginalLedgerPrefix(captured, original) {
  assert(Buffer.isBuffer(captured) && Buffer.isBuffer(original));
  assert(original.length > 0 && original.at(-1) === 10, 'Original ledger must end at a complete line');
  assert(captured.subarray(0, original.length).equals(original), 'Original completed ledger bytes must be preserved once as the exact prefix');
}
export function assertFoolOriginalResumeProvenance(actual, texts, expectedEvidence, context) {
  // expectedEvidence is supplied by the verifier's reviewed constants in an
  // audit. Pure helper tests may supply tiny synthetic evidence, never a runtime.
  keys(texts, Object.keys(ORIGINAL_RESUME_EVIDENCE), 'Minimal original reconstruction evidence');
  keys(expectedEvidence, Object.keys(ORIGINAL_RESUME_EVIDENCE), 'Pinned original evidence manifest');
  for (const [name, text] of Object.entries(texts)) {
    assert.equal(typeof text, 'string'); assertFoolInputEvidence(textEvidence(text), expectedEvidence[name], name);
  }
  keys(actual, ['kind', 'originalCapture', 'reconstruction', 'currentRuntimeFreezeSha256', 'continuation', 'replayEffects', 'verifiedCompletedRows', 'verifiedStates'], 'Direct original resume provenance only; checkpoint lineage is not supported by this audit');
  keys(actual.originalCapture, ['interruptionFile', 'interruptionSha256', 'originalCaptureFreezeSha256', 'originalCapturedFullState', 'completedNewCommands', 'lastCompleteCommandCount', 'ledgerFile', 'ledgerSha256', 'partialNextAction'], 'Original interrupted capture provenance');
  const originPath = actual.originalCapture.interruptionFile;
  assert(typeof originPath === 'string' && originPath.length > 0 && !originPath.includes('\0'));
  // Recorded provenance is immutable POSIX text even when verification runs
  // on Windows. Never interpret it as an arbitrary local file-read target.
  const recordedDirectory = posix.dirname(originPath);
  assert.equal(recordedDirectory, ORIGINAL_RESUME_RECORDED_DIRECTORY, 'Only the approved original recorded directory is accepted');
  assert.equal(originPath, posix.join(recordedDirectory, 'interruption.json'), 'Recorded paths retain the exact POSIX producer sibling layout');
  const interruption = JSON.parse(texts['interruption.json']), originalFreeze = JSON.parse(texts['freeze-before-natural.json']);
  const summary = JSON.parse(texts['baseline/summary.json']);
  const rows = completeRows(texts['terminated-commands.jsonl']), states = completeRows(texts['baseline/states.jsonl']);
  assert.equal(context.prefixCount, 1868); assert(digest(context.freezeSha256));
  assert(whole(context.commandCount) && context.commandCount >= 1911);
  assert.equal(interruption.kind, 'EXPLICIT_MANUAL_INTERRUPTION_PARTIAL_CAPTURE');
  assert.equal(interruption.originalProcessTerminated, true); assert.equal(interruption.completePrivateStatePersisted, false);
  assert.equal(interruption.lastCompleteCommandCount, 1911); assert.equal(interruption.newCompleteCommandRows, 43);
  assert.equal(interruption.partialNextAction, 'UNKNOWN_NO_COMPLETED_LEDGER_ROW; not counted or claimed completed');
  for (const name of ['terminated-commands.jsonl', 'freeze-before-natural.json']) assertFoolInputEvidence(textEvidence(texts[name]), interruption.files[name], name);
  assertFoolFreezeCompatibility(originalFreeze, originalFreeze); assert.equal(originalFreeze.sha256, interruption.freezeSha256);
  assert.equal(originalFreeze.files.find(row => row.file === context.source)?.sha256, context.sourceSha256);
  assert.equal(rows.length, 43); assert.equal(states.length, 44);
  for (const [i, state] of states.entries()) {
    keys(state, ['index', 'commandCount', 'stateSha256', 'publicSha256', 'random', 'budget'], 'Complete reconstructed baseline state evidence');
    assert.equal(state.index, i); assert.equal(state.commandCount, context.prefixCount + i);
    assert(digest(state.stateSha256) && digest(state.publicSha256));
    keys(state.random, ['seed', 'cursor'], 'Baseline random evidence'); assert.equal(state.random.seed, context.seed); assert(whole(state.random.cursor));
    assert.equal(state.budget.revision, state.commandCount + 1); assert.equal(state.budget.cursor, state.random.cursor);
    if (i > 0) {
      const row = rows[i - 1];
      keys(row, ['commandCount', 'phase', 'intent', 'publicControl', 'before', 'after', 'journalEventId'], 'Original completed command row');
      assert.equal(row.commandCount, state.commandCount); assert.equal(typeof row.phase, 'string'); assert.equal(row.intent.type, 'FOOL');
      assert.equal(row.publicControl.enabled, true); assert.deepEqual(row.before, states[i - 1].budget); assert.deepEqual(row.after, state.budget);
      assert(state.random.cursor >= states[i - 1].random.cursor);
    }
  }
  assert.deepEqual(interruption.finalRecordedBudget, states.at(-1).budget);
  assert.deepEqual(summary, { kind: 'RECONSTRUCTED_FROM_EXACT_COMPLETED_PARTIAL_LEDGER_NOT_ORIGINAL_FULL_STATE_CAPTURE', mode: 'baseline', passed: true,
    newCommands: 43, final: states.at(-1).budget, stateSha256: states.at(-1).stateSha256, publicSha256: states.at(-1).publicSha256,
    ledgerHash: expectedEvidence['terminated-commands.jsonl'].sha256, freeze: originalFreeze.sha256, originalCapturedFullState: false,
    allOriginalRecordedBudgetsControlsCursorsVerified: true, optimizedStateByStateEquivalent: false }, 'Exact original-runtime reconstruction summary');
  const expected = { kind: 'EXACT_FINITE_STRATEGY_RECONSTRUCTION_OF_ORIGINAL_INTERRUPTED_PREFIX',
    originalCapture: { interruptionFile: originPath, interruptionSha256: expectedEvidence['interruption.json'].sha256,
      originalCaptureFreezeSha256: originalFreeze.sha256, originalCapturedFullState: false, completedNewCommands: 43, lastCompleteCommandCount: 1911,
      ledgerFile: posix.join(recordedDirectory, 'terminated-commands.jsonl'), ledgerSha256: expectedEvidence['terminated-commands.jsonl'].sha256,
      partialNextAction: interruption.partialNextAction },
    reconstruction: { kind: summary.kind, originalFrozenRuntimeBaselineStatesFile: posix.join(recordedDirectory, 'baseline', 'states.jsonl'),
      baselineStatesSha256: expectedEvidence['baseline/states.jsonl'].sha256, baselineFinalStateSha256: summary.stateSha256,
      baselineFreezeSha256: originalFreeze.sha256, originalBoundarySnapshotsCaptured: false,
      boundaryHashesMeaning: 'REGENERATED_BY_EXACT_STRATEGY_FROM_FULL_STATE_EQUIVALENT_RECONSTRUCTION' },
    currentRuntimeFreezeSha256: context.freezeSha256, continuation: 'SAME_FINITE_STRATEGY_WITH_REPLAY_RESTORED_COUNTERS',
    replayEffects: 'IN_MEMORY_ONLY_NO_DUPLICATE_AUDIT_ROWS', verifiedCompletedRows: 43, verifiedStates: 44 };
  assert.deepEqual(actual, expected, 'Exact independently bound original reconstruction provenance');
  return { provenance: expected, rows, states, ledgerText: texts['terminated-commands.jsonl'] };
}
export function assertFoolCapturedReplayState(captured, reconstructed, actual) {
  const { index, commandCount, stateSha256, publicSha256 } = actual;
  assert.deepEqual(captured, { index, commandCount, stateSha256, ...(reconstructed ? { publicSha256 } : {}) }, 'Every captured state hash matches sequential replay');
  if (reconstructed) assert.deepEqual(reconstructed, actual, 'Every baseline private/public hash, budget and RNG matches sequential replay');
}
function assertBundledOriginalEvidence(root) {
  assert.deepEqual(readdirSync(directory(root)).sort(), ['baseline', 'freeze-before-natural.json', 'interruption.json', 'terminated-commands.jsonl']);
  assert.deepEqual(readdirSync(directory(join(root, 'baseline'))).sort(), ['states.jsonl', 'summary.json']);
}
function readOriginalResumeEvidence(root, override, provenance, context, fileEvidence) {
  if (provenance === null) { assert(!override, 'No original evidence directory for a non-resumed capture'); return null; }
  assert(provenance && typeof provenance === 'object', 'Missing resume provenance');
  const bundled = join(root, 'resume-original');
  const evidenceRoot = directory(override ?? (existsSync(bundled) ? bundled : resolve(ORIGINAL_RESUME_RECORDED_DIRECTORY)));
  const isBundled = existsSync(bundled);
  if (isBundled) {
    assert.equal(evidenceRoot, directory(bundled), 'A bundled proof cannot be bypassed by an external override');
    assertBundledOriginalEvidence(evidenceRoot);
  }
  const texts = {}, inputs = [];
  for (const file of Object.keys(ORIGINAL_RESUME_EVIDENCE)) {
    const path = regular(resolve(evidenceRoot, file)), evidence = fileEvidence(path);
    assertFoolInputEvidence(evidence, ORIGINAL_RESUME_EVIDENCE[file], file);
    texts[file] = readFileSync(path, 'utf8'); inputs.push({ file, path, ...evidence });
  }
  return { ...assertFoolOriginalResumeProvenance(provenance, texts, ORIGINAL_RESUME_EVIDENCE, context), root: evidenceRoot, isBundled, inputs };
}

// This is one reviewed transition from one real durable checkpoint. It does not
// permit generic checkpoint resumes or relax the final capture/runtime freeze.
const TRANSITION_MANIFEST_FILE = 'output/qa-0208/canonical-pause-1937/runtime-transition.json';
const TRANSITION_CHANGED_FILES = ['$natural-runner', 'dist/domain/fool/engine.js', 'dist/domain/fool/engine.js.map', 'dist/domain/fool/materials.js', 'dist/domain/fool/materials.js.map', 'dist/domain/slice/index.js', 'dist/domain/slice/index.js.map', 'src/domain/fool/engine.ts', 'src/domain/fool/materials.ts', 'src/domain/slice/index.ts'];
const TRANSITION_CHECKPOINT = {
  file: 'output/play/fool-02080-3SBoW5/checkpoint.json', bytes: 9903656,
  sha256: 'e981e113a494c18f50686374ebef6cc355ba6e8a92320a89457f8a8925817dd1',
  controlSha256: '18ef3f7481066157c69b69f0041f352e25c94b3108d320bfc0c15f7a88bcbc4d',
  oldFreezeSha256: '4fa64f7979b7cd079f694967bdb17830358d565ae405d021713de8257b160d4a',
  finalStateSha256: '06e4f43fe2044dcf68c800f8f5230256f0947821e3a570ed260b5a5cd350923b',
  finalPublicSha256: 'b7aefa32cb51899969d44f5565392ed50d40536b0fde3cde8182877ea9f436f9',
  publicEvidenceFile: 'output/qa-0208/canonical-pause-1937/benchmark-before.json',
  publicEvidence: { bytes: 749, sha256: 'cb13195541cd40f1fa91039576dd15576276d2e6b6ba58dbb71e9923ebec826d' },
};
export function assertFoolTransitionFreeze(oldFreeze, newFreeze, currentFreeze) {
  assertFoolFreezeCompatibility(oldFreeze, oldFreeze);
  assertFoolFreezeCompatibility(newFreeze, currentFreeze); // No current-freeze exception.
  assert.deepEqual(oldFreeze.files.map(row => row.file), newFreeze.files.map(row => row.file), 'Transition cannot add, remove or reorder frozen files');
  const changes = [];
  for (let i = 0; i < oldFreeze.files.length; i++) {
    const { file, ...before } = oldFreeze.files[i], { file: afterFile, ...after } = newFreeze.files[i];
    assert.equal(afterFile, file);
    if (before.bytes !== after.bytes || before.sha256 !== after.sha256) changes.push({ file, before, after });
  }
  changes.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  assert.deepEqual(changes.map(row => row.file), TRANSITION_CHANGED_FILES, 'Only this exact ten-file approved transition is accepted');
  return changes;
}
function firstCompleteLines(buffer, count) {
  assert(Buffer.isBuffer(buffer)); let offset = 0;
  for (let i = 0; i < count; i++) { const next = buffer.indexOf(10, offset); assert(next >= 0, 'Missing complete paused ledger line'); offset = next + 1; }
  return buffer.subarray(0, offset);
}
export function assertFoolRuntimeTransition(manifest, actualResume, context, approved = TRANSITION_CHECKPOINT) {
  // Unit tests can supply synthetic approved evidence. The audit always uses
  // the exact reviewed checkpoint/control/old-public fingerprints above.
  keys(manifest, ['format', 'kind', 'checkpoint', 'oldFreeze', 'newFreeze', 'changedFiles'], 'Pinned runtime transition manifest');
  assert.equal(manifest.format, 'FOOL208_PINNED_RUNTIME_TRANSITION_V1');
  assert.equal(manifest.kind, 'CANONICAL_MATERIAL_REPLAY_AND_PREVIEW_AUDIT_WITH_SAME_ROOT_HISTORY_REUSE_ONLY');
  keys(manifest.checkpoint, ['file', 'bytes', 'sha256', 'control', 'finalPublicSha256', 'finalPublicEvidence'], 'Exact durable checkpoint proof');
  const cp = manifest.checkpoint, control = cp.control;
  assert.equal(cp.file, approved.file); assertFoolInputEvidence({ bytes: cp.bytes, sha256: cp.sha256 }, { bytes: approved.bytes, sha256: approved.sha256 }, 'Original private durable checkpoint');
  keys(control, ['format', 'resumable', 'reason', 'source', 'sourceSha256', 'sourceCommandsSha256', 'strategy', 'currentRuntimeFreezeSha256', 'resumeProvenance', 'commandCount', 'phase', 'ledgerSha256', 'boundaries', 'observations', 'receptionActions', 'materialAttempts', 'beforeLastCommandCount', 'beforeLastStateSha256', 'lastIntent', 'pendingIntent', 'finalStateSha256', 'continuationMeaning', 'commandsSha256', 'commandRowsSha256', 'stateRowsSha256'], 'Complete original small checkpoint-control fields');
  assert.equal(hash(control), approved.controlSha256, 'All small control values are bound to the original private checkpoint');
  assert.equal(control.format, 'FOOL208_DURABLE_ACTION_BOUNDARY_V1'); assert.equal(control.resumable, true); assert.equal(control.reason, 'MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY');
  assert.equal(control.source, context.source); assert.equal(control.sourceSha256, context.sourceSha256); assert.equal(control.sourceCommandsSha256, context.sourceCommandsSha256);
  assert.deepEqual(control.strategy, context.strategy); assert.deepEqual(control.resumeProvenance, context.originalProvenance);
  assert.equal(control.currentRuntimeFreezeSha256, approved.oldFreezeSha256); assert.equal(manifest.oldFreeze.sha256, approved.oldFreezeSha256);
  assert.deepEqual(manifest.changedFiles, assertFoolTransitionFreeze(manifest.oldFreeze, manifest.newFreeze, context.currentFreeze));
  assert.equal(control.commandCount, 1936); assert.equal(control.beforeLastCommandCount, 1935); assert.equal(control.pendingIntent, null);
  assert.equal(control.finalStateSha256, approved.finalStateSha256);
  assert.equal(control.continuationMeaning, 'INSIDE_GO_AFTER_COMMIT_BEFORE_CALLER_CONTINUES; REPLAY_THE_STRATEGY_TO_RESTORE_ALL_LOCALS');
  assert(context.commands.length >= 1936); assert.equal(hash(context.commands.slice(0, 1936)), control.commandsSha256);
  const prefixBytes = firstCompleteLines(context.ledgerBytes, 68);
  assert.equal(createHash('sha256').update(prefixBytes).digest('hex'), control.ledgerSha256, 'All original paused68 raw ledger lines remain the exact prefix');
  const rows = completeRows(prefixBytes.toString('utf8'));
  assert.equal(rows.length, 68); assert.equal(hash(rows), control.commandRowsSha256);
  for (const [i, row] of rows.entries()) { assert.equal(row.commandCount, 1869 + i); assert.deepEqual(row.intent, context.commands[1868 + i]); }
  assert.deepEqual(rows.at(-1).intent, control.lastIntent); assert.equal(rows.at(-1).phase, control.phase);
  assert(context.states.length >= 69); const states = context.states.slice(0, 69);
  assert.equal(hash(states), control.stateRowsSha256, 'All original paused69 state records, including only the first44 public hashes, remain exact');
  for (const [i, state] of states.entries()) {
    keys(state, ['index', 'commandCount', 'stateSha256', ...(i < 44 ? ['publicSha256'] : [])], 'Paused state evidence never invents later public hashes');
    assert.equal(state.index, i); assert.equal(state.commandCount, 1868 + i); assert(digest(state.stateSha256)); if (i < 44) assert(digest(state.publicSha256));
  }
  assert.equal(states.at(-2).stateSha256, control.beforeLastStateSha256); assert.equal(states.at(-1).stateSha256, control.finalStateSha256);
  for (const [name, boundary] of Object.entries(control.boundaries)) assert.deepEqual(context.boundaries[name], boundary, `Retain the exact paused named boundary: ${name}`);
  const publicEvidence = cp.finalPublicEvidence;
  keys(publicEvidence, ['kind', 'file', 'bytes', 'sha256', 'rawText'], 'Old endpoint public projection evidence');
  assert.equal(publicEvidence.kind, 'COMPUTED_FROM_EXACT_PAUSED_PRIVATE_STATE_WITH_FROZEN_PREVIOUS_RUNTIME'); assert.equal(publicEvidence.file, approved.publicEvidenceFile);
  assertFoolInputEvidence({ bytes: publicEvidence.bytes, sha256: publicEvidence.sha256 }, approved.publicEvidence, 'Old endpoint public evidence');
  assert.equal(typeof publicEvidence.rawText, 'string'); assertFoolInputEvidence(textEvidence(publicEvidence.rawText), approved.publicEvidence, 'Exact embedded old public evidence bytes');
  const priorPublic = JSON.parse(publicEvidence.rawText);
  assert.equal(priorPublic.mode, 'before'); assert.equal(priorPublic.freeze, approved.oldFreezeSha256); assert.equal(priorPublic.checkpoint, approved.sha256);
  assert.equal(priorPublic.initial, approved.finalStateSha256); assert.equal(priorPublic.public, approved.finalPublicSha256); assert.equal(cp.finalPublicSha256, priorPublic.public);
  assert(digest(context.manifestSha256));
  const transition = { kind: 'EXACT_PAUSED_CHECKPOINT_REPLAY_WITH_APPROVED_RUNTIME_TRANSITION',
    manifestFile: TRANSITION_MANIFEST_FILE, manifestSha256: context.manifestSha256, checkpointFile: approved.file, checkpointSha256: approved.sha256,
    previousRuntimeFreezeSha256: approved.oldFreezeSha256, currentRuntimeFreezeSha256: context.currentFreeze.sha256,
    commandCount: 1936, finalStateSha256: approved.finalStateSha256 };
  const provenance = { ...context.originalProvenance, currentRuntimeFreezeSha256: context.currentFreeze.sha256,
    verifiedCompletedRows: 68, verifiedStates: 69, runtimeTransition: transition };
  assert.deepEqual(actualResume, provenance, 'Only this exact one-time transition lineage is accepted; generic checkpoint resumes remain unsupported');
  return { provenance, checkpoint: cp, priorPublic };
}
export function assertFoolTransitionEndpoint(transition, commandCount, privateSha256, publicSha256, random) {
  if (transition && commandCount === 1936) {
    assert.equal(privateSha256, transition.checkpoint.control.finalStateSha256);
    assert.equal(publicSha256, transition.checkpoint.finalPublicSha256, 'One separately computed old endpoint public projection matches the new frozen runtime');
    assert.deepEqual(random, transition.priorPublic.random);
  }
}
function readRuntimeTransitionEvidence(root, options, resumeProvenance, fileEvidence) {
  const present = resumeProvenance && Object.hasOwn(resumeProvenance, 'runtimeTransition'), bundled = join(root, 'runtime-transition.json');
  if (!present) { assert(!options.runtimeTransitionFile && !options.runtimeTransitionSha256 && !existsSync(bundled), 'No unused transition proof or options'); return null; }
  assert(digest(options.runtimeTransitionSha256), '--runtime-transition-sha256 REVIEWED_MANIFEST_HASH is required');
  assert(options.runtimeTransitionFile || existsSync(bundled), 'Supply --runtime-transition-file or the exact bundled runtime-transition.json; recorded paths are never followed');
  const path = regular(resolve(options.runtimeTransitionFile ?? bundled));
  if (existsSync(bundled)) assert.equal(path, regular(bundled), 'A bundled transition proof cannot be bypassed');
  const evidence = fileEvidence(path); assert.equal(evidence.sha256, options.runtimeTransitionSha256, 'Use the separately reviewed exact transition manifest');
  const manifest = json(path);
  return { manifest, input: { path, ...evidence }, root: dirname(path) };
}


// The completed original capture stays immutable. This separately reviewed proof
// permits only the post-terminal private-session implementation, never gameplay,
// dependency, schema, content, or arbitrary source drift. Its SHA is a mandatory
// CLI review input, not a value trusted from the capture or from the proof itself.
const FINAL_CAPTURE_FREEZE = '01aaf426597581a0023ff659f00e54be6b27b35163038291c6e30000de8fcfdf';
const FINAL_CAPTURE_INPUTS = [
  {
    "file": "boundaries.index.json",
    "bytes": 29432,
    "sha256": "6dbb7c177bfcd665b2122cc3744e257db45f43f341166599f19f641efea0f669"
  },
  {
    "file": "commands.jsonl",
    "bytes": 183428,
    "sha256": "479b9392dd928a3b5508541549e659ea87d7442c198bd92a34521df668c2a9f4"
  },
  {
    "file": "freeze.json",
    "bytes": 544257,
    "sha256": "f0fe8a831fb2c4f68db3f9f8c610e5177ee75c6402556e1a6b8a5b4538fb1979"
  },
  {
    "file": "natural.json",
    "bytes": 37252637,
    "sha256": "8bc3141286c3ecb603410d36c4f2111ea28b3a423b6f28c44127ef16aaf72959"
  },
  {
    "file": "report.json",
    "bytes": 67146,
    "sha256": "0b7577b6d9343218288b69f9039a57386d48935d28b57bd2b4e8515f4c9c3955"
  },
  {
    "file": "resume-original/baseline/states.jsonl",
    "bytes": 22268,
    "sha256": "80bcbdde0ed4f4476420e8d156b2f34258981404712e1b24c32ce5d2e55c3853"
  },
  {
    "file": "resume-original/baseline/summary.json",
    "bytes": 848,
    "sha256": "475e33e9f5de0b1e075bacd6ff233a506005bcd866c2a5881eed568848baf8ae"
  },
  {
    "file": "resume-original/freeze-before-natural.json",
    "bytes": 544258,
    "sha256": "cb10464dcbdb5ff36ec26c4e5f4cf6db79d29e50ba510ae43d4215c1130d6689"
  },
  {
    "file": "resume-original/interruption.json",
    "bytes": 2204,
    "sha256": "04d80eeded74a63642e27941ee764b1ed1958f7397f9545c38abe8c86a96f048"
  },
  {
    "file": "resume-original/terminated-commands.jsonl",
    "bytes": 36122,
    "sha256": "09ba77d6c0edde3b6df7f0a26c625808bef3b0ca20b01d173c32d420756604b1"
  },
  {
    "file": "runtime-transition.json",
    "bytes": 1106614,
    "sha256": "32efef5fcf1b49cd01f22ec9d04ffe0e8c9e0da534f2dfc8f3c6992febd6d26f"
  },
  {
    "file": "states.jsonl",
    "bytes": 28338,
    "sha256": "b72037d8bccf5f2c3bf38b361c79a1ef612c6d4618a5f5caad78f845047cdc46"
  }
];
// This compatibility value is audit-only. Never publish or persist the restored
// projection: it intentionally contains the old leak solely to authenticate old hashes.
export const FOOL_PUBLIC_REDACTION = Object.freeze({
  format: 'FOOL208_ATTENDANT_PUBLIC_REDACTION_V1',
  previousRuntimeFreezeSha256: '702f0b1963f8a37f524f4c7241e78cd8cdade08a69c35ef63cff0125ec9c5502',
  priorProofBytes: 117592, priorProofSha256: 'fc4cb3c50a38b2be15e4df67355860c279ba4ab06e5a3f13f10439d40f0221db',
  priorManifestSha256: 'b7e1bf722000116c1eeb3d8bc4c3601aadc96e33ef391ceba1c643c461bd271c',
});
export function assertFoolPublicRedactionEvidence(evidence, capturedStates = null) {
  keys(evidence, ['format', 'previousRuntimeFreezeSha256', 'priorPublicProof'], 'Exact reviewed public-redaction evidence');
  assert.equal(evidence.format, FOOL_PUBLIC_REDACTION.format);
  assert.equal(evidence.previousRuntimeFreezeSha256, FOOL_PUBLIC_REDACTION.previousRuntimeFreezeSha256);
  const input = evidence.priorPublicProof;
  keys(input, ['bytes', 'sha256', 'rawText'], 'Original completed public proof, unchanged bytes');
  assert.equal(input.bytes, FOOL_PUBLIC_REDACTION.priorProofBytes); assert.equal(input.sha256, FOOL_PUBLIC_REDACTION.priorProofSha256);
  assert.equal(typeof input.rawText, 'string'); assert.equal(Buffer.byteLength(input.rawText), input.bytes);
  assert.equal(createHash('sha256').update(input.rawText).digest('hex'), input.sha256, 'Never regenerate or rewrite the old public baseline');
  const prior = JSON.parse(input.rawText);
  keys(prior, ['format', 'manifestSha256', 'mode', 'rows'], 'Pinned completed public proof');
  assert.equal(prior.format, 'FOOL208_OWNED_RUNTIME_EQUIVALENCE_V1'); assert.equal(prior.manifestSha256, FOOL_PUBLIC_REDACTION.priorManifestSha256);
  assert.equal(prior.mode, 'public'); assert.equal(prior.rows.length, 216);
  if (capturedStates) assert.equal(capturedStates.length, 216);
  for (const [index, row] of prior.rows.entries()) {
    assert.equal(row.index, index); assert.equal(row.commandCount, 1868 + index);
    assert(digest(row.stateSha256) && digest(row.budgetSha256) && digest(row.public.strictSha256));
    assert.equal(row.public.sessionSha256, index === 0 ? null : row.public.strictSha256);
    if (capturedStates) {
      assert.equal(row.stateSha256, capturedStates[index].stateSha256);
      if (index < 44) assert.equal(row.public.strictSha256, capturedStates[index].publicSha256);
    }
  }
  return prior;
}
export function restoreFoolLegacyPublicProjection(state, projection, projectPlayerText) {
  assert.equal(typeof projectPlayerText, 'function');
  assert.equal(state.combat, null, 'Only this completed original S1 lineage may restore historical evidence');
  assert.equal(projection.combat, null); assert.equal(state.combatHistory.length, 77); assert.equal(projection.combatHistory.length, 77);
  assert.equal(state.attendantMysteries.encounter.terminal.historyIndex, 76);
  assert.deepEqual(state.lastCombatRound, state.combatHistory[76], 'Last round is the very same original terminal round');
  for (const history of [state.combatHistory, projection.combatHistory]) {
    assert.deepEqual(history.flatMap((round, i) => Object.hasOwn(round, 'attendantMysteriesOutcome') ? [i] : []), [74, 75, 76]);
  }
  const restored = structuredClone(projection);
  const restore = (actualRound, rawRound, roundNumber) => {
    assert.equal(rawRound.round, roundNumber); assert.equal(actualRound.round, roundNumber);
    const raw = rawRound.attendantMysteriesOutcome;
    assert.equal(raw.round, roundNumber); assert.equal(raw.targetId, 'AM1-ELIAS-VALE');
    assert.equal(raw.source.round, roundNumber); assert.equal(raw.source.revision, 1863 + roundNumber);
    assert.equal(raw.source.runId, state.runId); assert.equal(raw.source.randomSeed, state.random.seed);
    // Use the same unchanged display adapter at the same field names. Applying
    // it to the entire already-adapted projection a second time is forbidden.
    const old = projectPlayerText({ attendantMysteriesOutcome: structuredClone(raw) }, state.character.name).attendantMysteriesOutcome;
    const expected = structuredClone(old); delete expected.source; delete expected.randomCursorAfter;
    for (const list of ['playerActions', 'enemyActions']) for (const action of expected[list]) {
      delete action.randomCursorBefore; delete action.randomCursorAfter;
    }
    const actual = actualRound.attendantMysteriesOutcome;
    assert.deepEqual(actual, expected, 'Exactly the reviewed S1 fields are removed; all other old outcome/action facts are unchanged');
    actual.source = structuredClone(old.source); actual.randomCursorAfter = old.randomCursorAfter;
    for (const list of ['playerActions', 'enemyActions']) for (const [i, action] of actual[list].entries()) {
      action.randomCursorBefore = old[list][i].randomCursorBefore; action.randomCursorAfter = old[list][i].randomCursorAfter;
    }
  };
  for (let i = 74; i <= 76; i++) restore(restored.combatHistory[i], state.combatHistory[i], i - 73);
  restore(restored.lastCombatRound, state.lastCombatRound, 3);
  return restored;
}
export function assertFoolPublicRedactionRow(prior, index, actual) {
  assert(Number.isSafeInteger(index) && index >= 0 && index < 216); assert.equal(prior.rows.length, 216);
  keys(actual, ['stateSha256', 'budgetSha256', 'random', 'eventSha256', 'legacyPublicSha256'], 'Current replay and audit-only restored hash');
  const old = prior.rows[index];
  for (const field of ['stateSha256', 'budgetSha256', 'random', 'eventSha256']) assert.deepEqual(actual[field], old[field], `Exact prior public-run private evidence: ${field}`);
  assert.equal(actual.legacyPublicSha256, old.public.strictSha256, 'The complete restored projection equals the pinned old strict/owned public hash');
  return actual.legacyPublicSha256;
}
const FINAL_CHANGED_SOURCES = [
  ...['engine', 'index', 'fog', 'materials', 'fate', 'fate-host', 'escape', 'escape-host'].map(name => `src/domain/fool/${name}.ts`),
  'src/domain/slice/index.ts', 'src/domain/slice/validation.ts', 'src/application/slice-application.ts',
  'src/persistence/slice-store.ts', 'src/simulation/slice-browser-bridge.ts',
];
const FINAL_ADDED_SOURCES = ['src/domain/fool/owned-session.ts', 'src/application/slice-owned-runtime.ts'];
const withCompiled = files => files.flatMap(file => [file, file.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js'), file.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js.map')]);
const FINAL_CHANGED_FILES = new Set(['$natural-runner', ...withCompiled(FINAL_CHANGED_SOURCES)]);
const FINAL_ADDED_FILES = new Set(withCompiled(FINAL_ADDED_SOURCES));
const ordered = rows => [...rows].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
function recordedPath(file) {
  assert(typeof file === 'string' && file.length > 0 && !file.includes('\\') && !file.includes('\0') && !file.includes(':') && !posix.isAbsolute(file));
  assert.equal(posix.normalize(file), file, 'Recorded paths are exact relative POSIX paths');
  assert(file !== '..' && !file.startsWith('../'));
}
export function assertFoolFinalRuntimeDifference(captured, current, publicRedaction = false) {
  const allowed = publicRedaction ? new Set([...FINAL_CHANGED_FILES, ...withCompiled(['src/domain/attendant-mysteries/combat.ts', 'src/domain/slice/types.ts'])]) : FINAL_CHANGED_FILES;
  assertFoolFreezeCompatibility(captured, captured); assertFoolFreezeCompatibility(current, current);
  for (const freeze of [captured, current]) for (const row of freeze.files) recordedPath(row.file);
  const oldRows = new Map(captured.files.map(row => [row.file, row])), newRows = new Map(current.files.map(row => [row.file, row]));
  assert.deepEqual(current.files.filter(row => oldRows.has(row.file)).map(row => row.file), captured.files.map(row => row.file), 'Final runtime cannot remove or reorder captured files');
  const changes = [];
  for (const { file, ...after } of current.files) {
    const old = oldRows.get(file);
    if (!old) {
      assert(FINAL_ADDED_FILES.has(file), `Unapproved final-runtime addition: ${file}`);
      changes.push({ file, before: null, after });
    } else {
      const { file: ignored, ...before } = old;
      if (before.bytes !== after.bytes || before.sha256 !== after.sha256) {
        assert(allowed.has(file), `Unapproved final-runtime change: ${file}`);
        changes.push({ file, before, after });
      }
    }
  }
  for (const file of oldRows.keys()) assert(newRows.has(file), `No removed captured file: ${file}`);
  return ordered(changes);
}
export function assertFoolFinalRuntimeProof(proof, captured, current, captureInputs, approved = { captureFreezeSha256: FINAL_CAPTURE_FREEZE, captureInputs: FINAL_CAPTURE_INPUTS }) {
  const redaction = proof.kind === 'POST_TERMINAL_PRIVATE_OWNED_SESSION_TRANSACTION_AND_ATTENDANT_PUBLIC_REDACTION';
  keys(proof, ['format', 'kind', 'captureFreezeSha256', 'captureInputs', 'finalRuntimeFreeze', 'changedFiles', ...(redaction ? ['publicRedaction'] : [])], 'Separately reviewed final-runtime proof');
  assert.equal(proof.format, 'FOOL208_CAPTURE_TO_FINAL_RUNTIME_V1');
  if (redaction) assertFoolPublicRedactionEvidence(proof.publicRedaction);
  else assert.equal(proof.kind, 'POST_TERMINAL_PRIVATE_OWNED_SESSION_AND_TRANSACTION_INTEGRATION_ONLY');
  assert.equal(proof.captureFreezeSha256, approved.captureFreezeSha256); assert.equal(captured.sha256, approved.captureFreezeSha256);
  for (const rows of [proof.captureInputs, captureInputs, approved.captureInputs]) {
    assert(Array.isArray(rows)); const names = new Set();
    for (const row of rows) { keys(row, ['file', 'bytes', 'sha256'], 'Exact original capture input'); recordedPath(row.file); assert(!names.has(row.file)); names.add(row.file); assert(whole(row.bytes) && digest(row.sha256)); }
    assert.deepEqual(rows, ordered(rows), 'Capture fingerprints use sorted exact POSIX relative paths');
  }
  assert.deepEqual(proof.captureInputs, approved.captureInputs, 'Only the twelve original completed capture files are accepted');
  assert.deepEqual(captureInputs, proof.captureInputs, 'Final-runtime review binds every original capture byte');
  assertFoolFreezeCompatibility(proof.finalRuntimeFreeze, current);
  const changes = assertFoolFinalRuntimeDifference(captured, current, redaction);
  assert.deepEqual(proof.changedFiles, changes, 'Every changed/added file and its exact bytes must be individually reviewed');
  assert(changes.length > 0, 'An unchanged runtime does not use a post-terminal transition proof');
  return { kind: proof.kind, captureFreezeSha256: captured.sha256, runtimeFreezeSha256: current.sha256, changedFiles: changes };
}
// These primitives are verifier-owned: a changed producer cannot redefine the
// fingerprint universe or execute before its separately reviewed bytes match.
function auditFileEvidence(path) {
  const fd = openSync(regular(path), 'r'), digest = createHash('sha256'), buffer = Buffer.allocUnsafe(64 * 1024); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; digest.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  assert.equal(bytes, lstatSync(path).size); return { bytes, sha256: digest.digest('hex') };
}
function inspectAuditFreeze(repo, producerPath, source) {
  const files = [];
  const walk = file => {
    const path = resolve(repo, file), stat = lstatSync(path); assert(!stat.isSymbolicLink(), 'No frozen symlink');
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) walk(posix.join(file, name));
    else { assert(stat.isFile()); files.push({ file, ...auditFileEvidence(path) }); }
  };
  for (const path of ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation']) walk(path);
  files.push({ file: '$natural-runner', ...auditFileEvidence(producerPath) }, { file: source, ...auditFileEvidence(resolve(repo, source)) });
  return { sha256: hash(files), files };
}
// Only the exact already-authenticated CLI proof may be carried beside the
// twelve immutable historical files. A matching basename is never authority.
export function foolCaptureInputMembers(root, members, verifiedProofInput) {
  const bundledName = 'final-runtime-proof.json', bundled = members.includes(bundledName);
  if (bundled) {
    assert(verifiedProofInput, 'A bundled final-runtime-proof.json requires explicit reviewed proof options');
    assert.equal(verifiedProofInput.path, resolve(root, bundledName), 'The reviewed proof must be this exact bundled file, not another file with the same name');
    assert(whole(verifiedProofInput.bytes) && digest(verifiedProofInput.sha256), 'Only an authenticated proof input can be separate from original capture evidence');
  }
  if (verifiedProofInput) assert.deepEqual([...members].sort(), [
    'natural.json', 'commands.jsonl', 'states.jsonl', 'boundaries.index.json', 'report.json', 'freeze.json', 'runtime-transition.json', 'resume-original',
    ...(bundled ? [bundledName] : []),
  ].sort(), 'A final-runtime capture contains only the original twelve files plus its optional explicitly reviewed bundled proof');
  return members.filter(file => file !== 'resume-original' && !(bundled && file === bundledName));
}
export function assertFoolFinalRuntimeOptions(options) {
  const present = [options.finalRuntimeProof, options.finalRuntimeProofSha256, options.runtimeFreezeSha256].some(value => value !== undefined);
  if (!present) return false;
  assert(typeof options.finalRuntimeProof === 'string' && options.finalRuntimeProof.length > 0 && digest(options.finalRuntimeProofSha256) && digest(options.runtimeFreezeSha256), 'Supply --final-runtime-proof, --final-runtime-proof-sha256 and --runtime-freeze-sha256 together');
  return true;
}
function readFinalRuntimeProof(options) {
  if (!assertFoolFinalRuntimeOptions(options)) return null;
  const path = regular(resolve(options.finalRuntimeProof)), input = { path, ...auditFileEvidence(path) };
  assert.equal(input.sha256, options.finalRuntimeProofSha256, 'Use the separately reviewed final-runtime proof bytes');
  const proof = json(path); assertFoolFreezeCompatibility(proof.finalRuntimeFreeze, proof.finalRuntimeFreeze);
  assert.equal(proof.finalRuntimeFreeze.sha256, options.runtimeFreezeSha256, 'Final-runtime freeze requires its separate reviewed CLI digest');
  return { proof, input };
}
export function advanceFoolAuditState(runtime, before, intent, session, ownedRuntime) {
  if (!ownedRuntime) assert.equal(session, null);
  if (!session) {
    // Initial LEARN_GUIDANCE still uses the strict public raw-state reducer.
    const state = runtime.applySliceIntent(before, intent); runtime.assertValidSliceState(state);
    if (ownedRuntime) { assert.equal(state.fool.guidanceKnown, true); session = runtime.openFoolRuntimeSession(state); }
    return { state, session, projection: session ? session.project() : runtime.projectSliceState(state) };
  }
  assert.deepEqual(session.inspect(), { runId: before.runId, revision: before.revision, status: before.status });
  const draft = session.prepare(intent, before.revision);
  try {
    const state = session.snapshotDraft(draft), projection = session.projectDraft(draft);
    assert.deepEqual(session.inspectDraft(draft), { runId: state.runId, revision: state.revision, status: state.status });
    session.commit(draft); return { state, session, projection };
  } catch (error) { session.discard(draft); throw error; }
}

// A user's exact name is public data. A marker is exempt only when its whole
// matched span lies inside that full name, never merely because it contains one
// of the name's letters. This preserves production's explicit name boundary.
function hasUnprotectedMatch(text, pattern, playerName) {
  for (const match of text.matchAll(pattern)) {
    const start = match.index, end = start + match[0].length;
    let protectedName = false;
    if (playerName && playerName.length >= match[0].length) {
      let at = text.indexOf(playerName, Math.max(0, end - playerName.length));
      while (at >= 0 && at <= start) {
        if (at + playerName.length >= end) { protectedName = true; break; }
        at = text.indexOf(playerName, at + 1);
      }
    }
    if (!protectedName) return true;
  }
  return false;
}
// Typed chapter whitelist plus targeted stream/private fields. Public modifier
// labels (*.modifiers[].source) and chapter prices.preparation remain legal.
export function assertFoolPublicProjection(runtime, projection, seed) {
  assert(projection && typeof projection === 'object');
  for (const key of ['source', 'frame', 'journal', 'sourceHistory', 'sourceScene', 'fateReceipts']) assert(!Object.hasOwn(projection, key), `Private raw state at root ${key}`);
  const playerName = typeof projection.character?.name === 'string' ? projection.character.name : '';
  const seedPattern = seed ? new RegExp(seed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : null;
  const denied = new Set(['seed', 'cursor', 'random', 'randomSeed', 'randomCursor', 'cursorBefore', 'cursorAfter', 'randomCursorBefore', 'randomCursorAfter', 'randomBefore', 'randomAfter', 'truth', 'hiddenTruth', 'worldFacts', 'worldDigest', 'originDigest', 'sourceHistoryDigest', 'beforeDigest', 'afterDigest', 'randomReceipts', 'checkReceipts', '__privateCaptureProbe']);
  const walk = (v, path = []) => {
    if (typeof v === 'string') { if (seedPattern) assert(!hasUnprotectedMatch(v, seedPattern, playerName), `Private seed value at ${path.join('.')}`); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, [...path, String(i)])); return; }
    if (!v || typeof v !== 'object') return;
    for (const [key, child] of Object.entries(v)) { assert(!denied.has(key), `Private field at ${[...path, key].join('.')}`); walk(child, [...path, key]); }
  };
  walk(projection);
  const f = projection.fool;
  keys(f, ['title', 'guidanceKnown', 'promoted', 'story', 'nextStep', 'risk', 'resources', 'abilities', 'actions', 'sections', 'insideCase'], 'Typed public fool');
  for (const k of ['title', 'story', 'nextStep', 'risk']) assert.equal(typeof f[k], 'string');
  for (const k of ['guidanceKnown', 'promoted', 'insideCase']) assert.equal(typeof f[k], 'boolean');
  keys(f.resources, ['health', 'mind', 'spirituality', 'cash', 'actionsRemaining'], 'Typed public fool.resources');
  assert.equal(typeof f.resources.cash, 'string');
  for (const k of ['health', 'mind', 'spirituality']) assert(Number.isFinite(f.resources[k]) && f.resources[k] >= 0);
  assert(whole(f.resources.actionsRemaining));
  assert(Array.isArray(f.abilities) && Array.isArray(f.actions) && Array.isArray(f.sections));
  for (const a of f.abilities) { keys(a, ['id', 'label', 'mastery', 'description'], 'Typed public ability'); for (const k of ['id', 'label', 'description']) assert.equal(typeof a[k], 'string'); assert(Number.isFinite(a.mastery) && a.mastery >= 0); }
  for (const a of f.actions) {
    keys(a, ['id', 'label', 'cost', 'enabled', 'reason', 'command', ...(Object.hasOwn(a, 'preferredAction') ? ['preferredAction'] : [])], 'Typed public action');
    for (const k of ['id', 'label', 'cost']) assert.equal(typeof a[k], 'string'); assert.equal(typeof a.enabled, 'boolean'); assert(a.reason === null || typeof a.reason === 'string');
    if (Object.hasOwn(a, 'preferredAction')) assert.equal(typeof a.preferredAction, 'boolean');
    assert(runtime.validateFoolCommand(a.command), 'The public action contains only a validated intent');
  }
  for (const s of f.sections) { keys(s, ['id', 'title', 'lines'], 'Typed public section'); assert.equal(typeof s.id, 'string'); assert.equal(typeof s.title, 'string'); assert(Array.isArray(s.lines) && s.lines.every(x => typeof x === 'string')); }
  const prose = [f.title, f.story, f.nextStep, f.risk, ...f.abilities.flatMap(a => [a.label, a.description]), ...f.actions.flatMap(a => [a.label, a.cost, a.reason ?? '']), ...f.sections.flatMap(s => [s.title, ...s.lines])].join('\n');
  assert(!hasUnprotectedMatch(prose, /\b(?:seed|cursor|receipt|digest|UNALTERED_BINDING|VERIFIED_DEVIATION|SHIELD_MAIN|SIDE_CHANNEL|TRAPPED|DORMANT)\b/ig, playerName), 'Private implementation data in authored chapter prose');
  if (projection.lastCheck !== null) {
    const c = projection.lastCheck;
    keys(c, ['ability', 'baseAbility', 'modifiers', 'effectiveAbility', 'difficulty', 'chance', 'roll', 'tier'], 'Typed public lastCheck');
    assert(Array.isArray(c.modifiers));
    for (const m of c.modifiers) { keys(m, ['source', 'value'], 'Typed public modifier'); assert.equal(typeof m.source, 'string'); assert(Number.isFinite(m.value)); }
  }
  return projection;
}
function budget(s) {
  return { revision: s.revision, week: s.week, date: s.date, status: s.status, sequence: s.progression.sequence, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining, pollution: s.seer.pollution, cursor: s.random.cursor, second: s.fool.frame?.nowSecond ?? null, location: s.fool.frame?.location ?? 'base' };
}
function publicCapture(p) {
  return { revision: p.revision, status: p.status, week: p.week, date: p.date, fool: p.fool, lastCheck: p.lastCheck };
}
function assertActualRandom(runtime, before, intent, after) {
  assert.equal(after.random.seed, before.random.seed);
  if (intent.command.type === 'LEARN_GUIDANCE') { assert.deepEqual(after.random, before.random); assert.equal(after.fool.journal.length, 0); return []; }
  assert.equal(after.fool.journal.length, before.fool.journal.length + 1);
  const e = after.fool.journal.at(-1); assert.equal(e.revision, after.revision); assert.deepEqual(e.command, intent.command);
  assert.deepEqual(e.before.random, before.random); assert.deepEqual(e.after.random, after.random);
  const stream = new runtime.DeterministicActionRandomStream(before.random.seed, before.random.cursor);
  for (const receipt of e.randomReceipts) {
    assert.equal(receipt.cursorBefore, stream.cursor);
    if (receipt.kind === 'CHECK') assert.equal(receipt.check.roll, stream.nextInt(1, 100));
    else { assert.equal(receipt.kind, 'ROLL'); assert.equal(receipt.value, stream.nextInt(receipt.min, receipt.max)); }
    assert.equal(receipt.cursorAfter, stream.cursor);
  }
  assert.equal(stream.cursor, after.random.cursor, 'Every actual RNG draw has exactly one current-command receipt');
  return e.randomReceipts;
}
async function* lines(path) {
  const stream = createReadStream(path, { encoding: 'utf8' }), reader = createInterface({ input: stream, crlfDelay: Infinity });
  try { for await (const line of reader) { assert(line.length > 0, 'No blank ledger rows'); yield JSON.parse(line); } }
  finally { reader.close(); stream.destroy(); }
}
export function describeFoolBoundaries(index, commands, prefixCount) {
  const byCount = new Map(), named = [], transitions = new Map();
  for (const [name, b] of Object.entries(index.boundaries)) {
    assert(name.length > 0 && b && typeof b === 'object');
    assert(whole(b.commandCount) && b.commandCount >= prefixCount && b.commandCount <= commands.length);
    assert.equal(b.commandIndex0, b.commandCount - 1); assert(whole(b.revision) && digest(b.stateSha256));
    assert.deepEqual(b.replayFrom, { file: 'natural.json', key: 'prefixFinal', sourceCommandCount: prefixCount, migrateToSchema: 205 });
    assert.deepEqual(b.inclusiveTailRange0, [prefixCount, b.commandCount - 1]);
    let kind;
    if (!Object.hasOwn(b, 'beforeCommandCount')) {
      assert.equal(name, 'original-full1868-migrated-start'); assert.equal(b.commandCount, prefixCount);
      for (const k of ['beforeStateSha256', 'intent', 'intentCommitted']) assert(!Object.hasOwn(b, k));
      kind = 'ORIGINAL_SNAPSHOT_NO_TRANSACTION';
    } else {
      assert(whole(b.beforeCommandCount) && digest(b.beforeStateSha256)); assert.equal(typeof b.intentCommitted, 'boolean');
      if (b.intentCommitted) {
        assert(b.commandCount > prefixCount); assert.equal(b.beforeCommandCount, b.commandCount - 1); assert.deepEqual(b.intent, commands[b.commandCount - 1]);
        kind = 'LAST_COMMITTED_TRANSITION';
        const t = transitions.get(b.commandCount) ?? { commandCount: b.commandCount, beforeCommandCount: b.beforeCommandCount, beforeStateSha256: b.beforeStateSha256, stateSha256: b.stateSha256, intent: b.intent, names: [] };
        assert.equal(t.beforeStateSha256, b.beforeStateSha256); assert.equal(t.stateSha256, b.stateSha256); assert.deepEqual(t.intent, b.intent); t.names.push(name); transitions.set(b.commandCount, t);
      } else {
        assert.equal(b.beforeCommandCount, b.commandCount); assert.equal(b.beforeStateSha256, b.stateSha256);
        kind = 'CURRENT_SNAPSHOT_PENDING_INTENT_NOT_COMMITTED';
      }
    }
    const row = { name, commandCount: b.commandCount, kind }; named.push(row);
    const list = byCount.get(b.commandCount) ?? []; list.push({ name, ...b }); byCount.set(b.commandCount, list);
  }
  assert.equal(named.filter(n => n.kind === 'ORIGINAL_SNAPSHOT_NO_TRANSACTION').length, 1);
  return { named, byCount, transitions };
}

function databaseRows(DatabaseSync, path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const columns = { runs: 'SELECT id,current_json,backup_json,terminal,updated_at FROM slice_runs ORDER BY id', receipts: 'SELECT id,fingerprint,receipt_json FROM slice_receipts ORDER BY id', meta: 'SELECT key,value FROM slice_meta ORDER BY key' };
    const evidence = {};
    for (const [key, sql] of Object.entries(columns)) {
      const rows = db.prepare(sql).all(); evidence[key] = { count: rows.length, sha256: hash(rows) };
    }
    assert.equal(Object.values(db.prepare('PRAGMA quick_check').get())[0], 'ok'); return evidence;
  } finally { db.close(); }
}
function dbFiles(work, fileEvidence) {
  const result = {};
  for (const name of readdirSync(work).sort()) {
    assert(['owner.json', 'pending.json', 'pending.json.next', 'verification.sqlite', 'verification.sqlite.bak', 'verification.sqlite.sealed', 'verification.sqlite-journal', 'verification.sqlite.bak.tmp', 'verification.sqlite.sealed.tmp', 'verification.sqlite.sealed.rollback.tmp'].includes(name), `Unknown verification artifact: ${name}`);
    regular(join(work, name));
    if (name.startsWith('verification.sqlite')) result[name] = fileEvidence(join(work, name));
  }
  return result;
}
function clearCompletedWork(work, result, fileEvidence) {
  if (!existsSync(work)) return;
  directory(work);
  const remaining = dbFiles(work, fileEvidence);
  // The completed index was fsynced before cleanup. Missing files can therefore
  // mean an interrupted cleanup; every remaining database byte must still match.
  for (const [name, evidence] of Object.entries(remaining)) assert.deepEqual(evidence, result.databaseEvidence[name], 'Only exact completed generated database files may be removed');
  if (existsSync(join(work, 'pending.json'))) assert.equal(json(join(work, 'pending.json')).phase, 'VERIFIED');
  for (const name of Object.keys(remaining)) rmSync(regular(join(work, name)));
  for (const name of ['pending.json.next', 'pending.json', 'owner.json']) if (existsSync(join(work, name))) rmSync(regular(join(work, name)));
  rmdirSync(work); sync(dirname(work));
}

// Crash-resumable one-DB protocol. A failed/incomplete database is NEVER reset.
// Each durable phase names the exact before/after rows. Resume either continues
// that same transaction check or stops with its database and logs intact.
function checkSqlite({ runtime, DatabaseSync, fileEvidence, stable, stateHash, work, manifestSha256, transition, before, intent, after, log }) {
  assert.equal(before.status, 'ACTIVE');
  // A session snapshot is an external SQLite import. Keep both raw boundaries strict.
  runtime.assertValidSliceState(before); runtime.assertValidSliceState(after);
  const database = join(work, 'verification.sqlite'), pendingPath = join(work, 'pending.json');
  const owner = { kind: FORMAT, manifestSha256, commandCount: transition.commandCount };
  const envelope = { intentId: `fool208:${transition.commandCount}`, runId: before.runId, expectedRevision: before.revision, payload: intent };
  const expectedPublic = assertFoolPublicProjection(runtime, runtime.projectSliceState(after), before.random.seed);
  const input = { ...owner, beforeStateSha256: stateHash(before), afterStateSha256: stateHash(after), envelopeSha256: hash(envelope), publicStateSha256: stateHash(expectedPublic) };
  let pending;
  if (existsSync(work)) {
    directory(work); dbFiles(work, fileEvidence); assert.deepEqual(json(regular(join(work, 'owner.json'))), owner);
    if (!existsSync(pendingPath)) { assert.deepEqual(readdirSync(work), ['owner.json'], 'A missing phase record cannot hide an existing database'); atomic(pendingPath, { input, phase: 'ALLOCATED', beforeRows: null, committedRows: null }); }
    pending = json(regular(pendingPath)); keys(pending, ['input', 'phase', 'beforeRows', 'committedRows'], 'Pending phase index'); assert.deepEqual(pending.input, input); assert(['ALLOCATED', 'BEFORE_SAVED', 'ROLLBACK_VERIFIED', 'COMMITTED', 'VERIFIED'].includes(pending.phase));
  } else {
    mkdirSync(work); writeFileSync(join(work, 'owner.json'), JSON.stringify(owner), { flag: 'wx' }); sync(join(work, 'owner.json'));
    pending = { input, phase: 'ALLOCATED', beforeRows: null, committedRows: null }; atomic(pendingPath, pending);
  }
  const checkpoint = phase => { pending.phase = phase; atomic(pendingPath, pending); log({ event: 'SQLITE_PHASE', commandCount: transition.commandCount, phase }); };
  const rows = () => databaseRows(DatabaseSync, database);
  const sameState = (actual, expected) => assert.equal(stateHash(actual), stateHash(expected), 'Exact private whole state');
  const beforeReceipt = () => ({ intentId: envelope.intentId, runId: after.runId, previousRevision: before.revision, newRevision: after.revision, committedAt: '2026-10-16T00:00:01.000Z', replayed: false, state: expectedPublic });
  const assertAfter = app => {
    sameState(app.repository.get(after.runId)?.state, after); assert.equal(app.repository.activeRun(), after.runId);
    assert.deepEqual(app.repository.receipt(envelope.intentId), { fingerprint: stable(envelope), receipt: beforeReceipt() });
    assert.deepEqual(runtime.projectSliceState(app.repository.get(after.runId).state), expectedPublic);
  };
  const assertBefore = app => {
    const saved = app.repository.get(before.runId); sameState(saved?.state, before); assert.equal(saved.updatedAt, '2026-10-16T00:00:00.000Z'); assert.equal(app.repository.activeRun(), before.runId);
    assert.equal(app.repository.receipt(envelope.intentId), null); assert.deepEqual(rows(), pending.beforeRows);
    assert.equal(existsSync(`${database}.sealed`), false, 'Uncommitted player death cannot be sealed');
  };
  let app, injecting = false, injected = 0;
  const open = () => new runtime.SqliteSliceStore(database, { now: () => '2026-10-16T00:00:01.000Z', beforeWrite: () => {
    if (!injecting) return;
    assertAfter(app); injected++; throw Error('Injected after real application, receipt and selection, before SQLite COMMIT');
  } });
  const close = () => { app?.close(); app = undefined; };
  try {
    app = open();
    if (pending.phase === 'ALLOCATED') {
      const stored = app.repository.get(before.runId);
      if (!stored) {
        const empty = rows(); assert.equal(empty.runs.count, 0); assert.equal(empty.receipts.count, 0); assert.equal(empty.meta.count, 0);
        app.repository.transaction(() => { app.repository.put({ state: before, updatedAt: '2026-10-16T00:00:00.000Z' }); app.repository.selectRun(before.runId); });
      } else { sameState(stored.state, before); assert.equal(app.repository.receipt(envelope.intentId), null); assert.equal(app.repository.activeRun(), before.runId); }
      pending.beforeRows = rows(); assert.equal(pending.beforeRows.runs.count, 1); assert.equal(pending.beforeRows.receipts.count, 0); assert.equal(pending.beforeRows.meta.count, 1);
      checkpoint('BEFORE_SAVED');
    }
    if (pending.phase === 'BEFORE_SAVED') {
      assertBefore(app); close(); app = open(); assertBefore(app);
      const physicalBefore = dbFiles(work, fileEvidence); injecting = true;
      const rejected = app.submitIntent(envelope); injecting = false;
      assert.equal(rejected.ok, false); assert.equal(rejected.error.code, 'SAVE_FAILED'); assert.equal(injected, 1);
      assertBefore(app);
      assert.deepEqual(dbFiles(work, fileEvidence), physicalBefore, 'Rollback preserves the database, physical backup and terminal sidecars');
      close(); app = open(); assertBefore(app); checkpoint('ROLLBACK_VERIFIED');
    }
    if (pending.phase === 'ROLLBACK_VERIFIED') {
      // COMMIT can have reached disk just before an interruption. Accept only
      // the exact genuine receipt/state; never reapply an already committed ID.
      if (app.repository.receipt(envelope.intentId) === null) {
        assertBefore(app); const committed = app.submitIntent(envelope);
        assert.equal(committed.ok, true, 'Real store must commit'); assert.deepEqual(committed.value, beforeReceipt());
      }
      assertAfter(app); pending.committedRows = rows(); assert.equal(pending.committedRows.runs.count, 1); assert.equal(pending.committedRows.receipts.count, 1); assert.equal(pending.committedRows.meta.count, 1); checkpoint('COMMITTED');
    }
    if (pending.phase === 'COMMITTED' || pending.phase === 'VERIFIED') {
      assertAfter(app); assert.deepEqual(rows(), pending.committedRows); close(); app = open(); assertAfter(app); assert.deepEqual(rows(), pending.committedRows);
      const replay = app.submitIntent(envelope); assert.equal(replay.ok, true); assert.deepEqual(replay.value, { ...beforeReceipt(), replayed: true }); assertAfter(app); assert.deepEqual(rows(), pending.committedRows);
      const collision = app.submitIntent({ ...envelope, expectedRevision: after.revision }); assert.equal(collision.ok, false); assert.equal(collision.error.code, 'DUPLICATE_INTENT_CONFLICT'); assert.deepEqual(rows(), pending.committedRows);
      const staleId = `${envelope.intentId}:stale`, stale = app.submitIntent({ ...envelope, intentId: staleId }); assert.equal(stale.ok, false); assert.equal(stale.error.code, 'REVISION_CONFLICT'); assert.equal(app.repository.receipt(staleId), null); assert.deepEqual(rows(), pending.committedRows);
      if (after.status === 'DEAD') {
        assert.deepEqual(json(`${database}.sealed`), [after.runId]); assert.equal(expectedPublic.canAct, false);
        for (const payload of [{ type: 'ACTION', action: 'REST' }, { type: 'CONTINUE_LIFE' }, { type: 'FOOL', command: { type: 'RECEPTION_WORK' } }]) {
          const id = `${envelope.intentId}:dead:${payload.type}`;
          const blocked = app.submitIntent({ ...envelope, intentId: id, expectedRevision: after.revision, payload });
          assert.equal(blocked.ok, false); assert.equal(blocked.error.code, 'ARCHIVED'); assert.equal(app.repository.receipt(id), null); assert.deepEqual(rows(), pending.committedRows);
        }
      } else assert.equal(existsSync(`${database}.sealed`), false);
      close(); app = open(); assertAfter(app); assert.deepEqual(rows(), pending.committedRows); close(); checkpoint('VERIFIED');
    }
    return { ...transition, beforeStateSha256: input.beforeStateSha256, stateSha256: input.afterStateSha256, publicStateSha256: input.publicStateSha256, status: after.status, revision: after.revision,
      checks: [...CHECKS, after.status === 'DEAD' ? 'dead-sealed-reopen-and-all-actions-archived' : 'living-unsealed'], databaseRows: pending.committedRows, databaseEvidence: dbFiles(work, fileEvidence) };
  } finally { close(); }
}

export async function verifyFoolCapture(options) {
  regular(SELF);
  assert(options.sourceDirectory, '--source-directory is required');
  assert(digest(options.freezeSha256), '--freeze-sha256 REVIEWED_HASH is required');
  assert(digest(options.verifierSha256), '--verifier-sha256 REVIEWED_VERIFIER_HASH is required');
  const repo = directory(process.cwd()), producerPath = regular(resolve('scripts/play/fool-stage.mjs'));
  assert.equal(auditFileEvidence(SELF).sha256, options.verifierSha256, 'Review verifier bytes before importing any producer');
  const root = directory(options.sourceDirectory), capturedFreeze = json(regular(join(root, 'freeze.json'))), finalRuntimeProof = readFinalRuntimeProof(options);
  assertFoolFreezeCompatibility(capturedFreeze, capturedFreeze); assert.equal(capturedFreeze.sha256, options.freezeSha256);
  const producerBeforeImport = auditFileEvidence(producerPath).sha256;
  const reviewedProducerFreeze = finalRuntimeProof?.proof.finalRuntimeFreeze ?? capturedFreeze;
  assert.equal(reviewedProducerFreeze.files.find(row => row.file === '$natural-runner')?.sha256, producerBeforeImport, 'Current producer must match reviewed runtime, independently of the immutable captured producer');
  const producer = await import(pathToFileURL(producerPath).href);
  const { SOURCE, SOURCE_SHA, PREFIX_SHA, PREFIX_COUNT, SEED, STRATEGY, compactHash, stateHash, stable, inspectFreeze, readObjectEntry, readSource, migrateCurrent } = producer;
  const fileEvidence = auditFileEvidence;
  assert.equal(fileEvidence(SELF).sha256, options.verifierSha256, 'Use the separately reviewed exact verifier bytes');
  assert.equal(fileEvidence(producerPath).sha256, producerBeforeImport, 'Producer bytes cannot change across module import');
  const members = readdirSync(root).sort();
  for (const name of ['natural.json', 'states.jsonl', 'boundaries.index.json', 'report.json', 'freeze.json']) assert(members.includes(name), `Missing producer output ${name}`);
  const inputs = foolCaptureInputMembers(root, members, finalRuntimeProof?.input ?? null).map(file => ({ file, ...fileEvidence(regular(join(root, file))) }));
  if (members.includes('resume-original')) directory(join(root, 'resume-original'));
  const originalSource = regular(resolve(SOURCE)); assert.equal(fileEvidence(originalSource).sha256, SOURCE_SHA);
  const currentFreeze = inspectAuditFreeze(repo, producerPath, SOURCE);
  assert.deepEqual(inspectFreeze(), currentFreeze, 'Producer cannot redefine the independently frozen input universe');
  if (!finalRuntimeProof) assertFoolFreezeCompatibility(capturedFreeze, currentFreeze);
  const sourceEvidence = fileEvidence(originalSource), index = json(join(root, 'boundaries.index.json')), report = json(join(root, 'report.json'));
  const natural = join(root, 'natural.json'), read = key => readObjectEntry(natural, key), commands = read('commands'), old = readSource();
  assert.equal(PREFIX_COUNT, 1868); assert.equal(read('prefixCount'), PREFIX_COUNT); assert.equal(read('seed'), SEED);
  assert.equal(commands.length, report.commands); assert(commands.length >= PREFIX_COUNT && commands.length <= PREFIX_COUNT + STRATEGY.maxNewCommands);
  assert.deepEqual(commands.slice(0, PREFIX_COUNT), old.commands); assert.equal(compactHash(commands.slice(0, PREFIX_COUNT)), PREFIX_SHA);
  assert.deepEqual(read('creation'), old.creation); assert.deepEqual(read('initial'), old.initial, 'Raw initial is the original command1856 state, NOT a new-game snapshot');
  assert.deepEqual(read('prefixFinal'), old.final, 'Raw prefixFinal is exact command1868 schema183, never overwritten with migrated state');
  const provenance = read('provenance');
  const transitionEvidence = readRuntimeTransitionEvidence(root, options, provenance.resumeProvenance, fileEvidence);
  const originalResume = readOriginalResumeEvidence(root, options.originalResumeDirectory, transitionEvidence?.manifest.checkpoint?.control?.resumeProvenance ?? provenance.resumeProvenance,
    { prefixCount: PREFIX_COUNT, freezeSha256: transitionEvidence ? TRANSITION_CHECKPOINT.oldFreezeSha256 : capturedFreeze.sha256, commandCount: commands.length, source: SOURCE, sourceSha256: SOURCE_SHA, seed: SEED }, fileEvidence);
  if (!originalResume) assert(!members.includes('resume-original'), 'Unused reconstruction evidence is not a capture input');
  const capturedStates = completeRows(readFileSync(join(root, 'states.jsonl'), 'utf8'));
  assert.equal(capturedStates.length, commands.length - PREFIX_COUNT + 1);
  const runtimeTransition = transitionEvidence ? assertFoolRuntimeTransition(transitionEvidence.manifest, provenance.resumeProvenance,
    { manifestSha256: transitionEvidence.input.sha256, currentFreeze: capturedFreeze, originalProvenance: originalResume.provenance, source: SOURCE, sourceSha256: SOURCE_SHA, sourceCommandsSha256: PREFIX_SHA,
      strategy: STRATEGY, commands, states: capturedStates, ledgerBytes: readFileSync(join(root, 'commands.jsonl')), boundaries: index.boundaries }) : null;
  const resumeProvenance = runtimeTransition?.provenance ?? originalResume?.provenance ?? null;
  const captureInputs = ordered([...inputs, ...(originalResume?.inputs ?? []).map(({ file, bytes, sha256 }) => ({ file: `resume-original/${file}`, bytes, sha256 }))]);
  const finalRuntime = finalRuntimeProof ? assertFoolFinalRuntimeProof(finalRuntimeProof.proof, capturedFreeze, currentFreeze, captureInputs) : null;
  const publicRedaction = finalRuntimeProof?.proof.publicRedaction ? assertFoolPublicRedactionEvidence(finalRuntimeProof.proof.publicRedaction, capturedStates) : null;
  assert.deepEqual(report.resumeProvenance, resumeProvenance, 'Natural and report resume lineage must agree exactly');
  if (originalResume) {
    assertFoolOriginalLedgerPrefix(readFileSync(join(root, 'commands.jsonl')), Buffer.from(originalResume.ledgerText));
    assert.deepEqual(commands.slice(PREFIX_COUNT, 1911), originalResume.rows.map(row => row.intent));
  }
  assertFoolCaptureProvenance(provenance, { kind: 'SAME_SEED_ORIGINAL_FULL1868_PUBLIC_FOOL_CONTINUATION', source: SOURCE, sourceSha256: SOURCE_SHA, sourcePrefixCount: PREFIX_COUNT, sourceCommandsSha256: PREFIX_SHA,
    sourceInitialCommandCount: old.prefixCount, sourceProvenance: old.provenance, initialMeans: 'EXACT_RAW_SOURCE_INITIAL_AT_COMMAND_1856', prefixFinalMeans: 'EXACT_RAW_SOURCE_FINAL_AT_COMMAND_1868', producerPrefixReplay: 'NOT_RUN', migration: 205, freezeSha256: capturedFreeze.sha256, strategy: STRATEGY, newRandomChanges: false }, resumeProvenance);
  assert.equal(index.format, 'FOOL208_HASHED_COMMAND_BOUNDARIES_V1'); assert.equal(index.source, SOURCE); assert.equal(index.sourceSha256, SOURCE_SHA); assert.equal(index.prefixCount, PREFIX_COUNT);
  assert.deepEqual(read('boundaries'), index.boundaries); assert.deepEqual(report.boundaries, Object.keys(index.boundaries));
  assert.equal(read('stage'), report.stage); assert.equal(read('phase'), report.phase); assert.deepEqual(read('error'), report.error); assert.equal(read('reportFile'), 'report.json');
  assert.equal(report.integrityError, null, 'Do not certify a producer integrity blocker'); assert.equal(report.historicalPrefixReplay, 'NOT_RUN_BY_PRODUCER');
  assert.equal(report.newCommands, commands.length - PREFIX_COUNT);
  if (commands.length > PREFIX_COUNT) assert(members.includes('commands.jsonl'));
  const { named, byCount, transitions } = describeFoolBoundaries(index, commands, PREFIX_COUNT);
  if (options.expectedBoundaries !== undefined) assert.equal(named.length, options.expectedBoundaries);
  const pendingIntent = read('pendingIntent'), lastIntent = read('lastIntent'), beforeLastCount = read('beforeLastCommandCount');
  if (pendingIntent !== null) { assert.deepEqual(lastIntent, pendingIntent); assert.equal(beforeLastCount, commands.length); }
  else if (commands.length > PREFIX_COUNT) { assert.deepEqual(lastIntent, commands.at(-1)); assert.equal(beforeLastCount, commands.length - 1); }
  else { assert.equal(lastIntent, null); assert.equal(beforeLastCount, null); assert.equal(read('beforeLast'), null); }
  const endpointOnly = pendingIntent === null && commands.length > PREFIX_COUNT && !transitions.has(commands.length);
  const transitionPlan = [...transitions.values()].map(t => ({ commandCount: t.commandCount, names: t.names, endpointOnly: false }));
  if (endpointOnly) transitionPlan.push({ commandCount: commands.length, names: [], endpointOnly: true });
  transitionPlan.sort((a, b) => a.commandCount - b.commandCount);
  const checkInputs = () => {
    assert.deepEqual(readdirSync(root).sort(), members);
    for (const row of inputs) assertFoolInputEvidence(fileEvidence(regular(join(root, row.file))), { bytes: row.bytes, sha256: row.sha256 }, row.file);
    if (transitionEvidence) assertFoolInputEvidence(fileEvidence(regular(transitionEvidence.input.path)), { bytes: transitionEvidence.input.bytes, sha256: transitionEvidence.input.sha256 }, 'runtime-transition.json');
    if (originalResume?.isBundled) assertBundledOriginalEvidence(originalResume.root);
    for (const row of originalResume?.inputs ?? []) assertFoolInputEvidence(fileEvidence(regular(row.path)), { bytes: row.bytes, sha256: row.sha256 }, row.file);
    if (finalRuntimeProof) assertFoolInputEvidence(auditFileEvidence(finalRuntimeProof.input.path), { bytes: finalRuntimeProof.input.bytes, sha256: finalRuntimeProof.input.sha256 }, 'final-runtime-proof');
    assertFoolInputEvidence(fileEvidence(originalSource), sourceEvidence, SOURCE);
    assert.deepEqual(inspectAuditFreeze(repo, producerPath, SOURCE), currentFreeze); assert.deepEqual(inspectFreeze(), currentFreeze);
    assert.equal(fileEvidence(SELF).sha256, options.verifierSha256);
  };
  checkInputs();
  if (options.preflight) {
    assert(!options.resumeDirectory);
    const result = { preflightPassed: true, sourceDirectory: root, captureStage: report.stage, namedBoundaries: named.length, uniqueNamedTransitions: transitions.size, sqliteTransitionsPlanned: transitionPlan.length, pendingIntent: pendingIntent !== null,
      historicalPrefixReplay: 'NOT_RUN', originalHistoricalTail1856To1868Replay: 'NOT_RUN', newTailReplay: 'NOT_RUN', sqlite: 'NOT_RUN', runtimeImported: false, outputWritten: false, captureFreezeSha256: capturedFreeze.sha256, runtimeFreezeSha256: currentFreeze.sha256, finalRuntimeProof: finalRuntime ? 'METADATA_VERIFIED_REPLAY_NOT_RUN' : 'NOT_APPLICABLE', originalInterruptedPrefixReconstruction: originalResume ? 'METADATA_VERIFIED_REPLAY_NOT_RUN' : 'NOT_APPLICABLE', runtimeTransition: runtimeTransition ? 'METADATA_VERIFIED_REPLAY_NOT_RUN' : 'NOT_APPLICABLE', freezeSha256: currentFreeze.sha256, verifierSha256: options.verifierSha256 };
    console.log(JSON.stringify(result)); return result;
  }
  assert.notEqual(process.platform, 'win32', 'This private audit requires POSIX directory fsync; Windows write-mode audit is NOT_SUPPORTED, not silently weakened');
  const outputRoot = safeOutput(options.outputDirectory ?? 'output/qa-0208/sqlite', [root, ...(originalResume ? [originalResume.root] : []), ...(transitionEvidence ? [transitionEvidence.root] : []), ...(finalRuntimeProof ? [finalRuntimeProof.input.path] : []), resolve('tests/fixtures'), resolve('scripts/play'), resolve('src'), resolve('dist')]);
  const outputDir = options.resumeDirectory ? directory(options.resumeDirectory) : mkdtempSync(join(outputRoot, `fool208-${options.tag ?? 'natural'}-`));
  assert.equal(dirname(outputDir), outputRoot); assert(/^fool208-[A-Za-z0-9_-]+-[A-Za-z0-9]{6}$/.test(basename(outputDir)));
  const manifest = { kind: FORMAT, repo, sourceDirectory: root, outputDirectory: outputDir, sourceEvidence, source: SOURCE, sourceCommandsSha256: PREFIX_SHA,
    inputs, originalResumeInputs: originalResume?.inputs ?? [], runtimeTransitionInput: transitionEvidence?.input ?? null, finalRuntimeProofInput: finalRuntimeProof?.input ?? null, finalRuntime, resumeProvenance, capturedProducerSha256: capturedFreeze.files.find(row => row.file === '$natural-runner').sha256, captureFreezeSha256: capturedFreeze.sha256, runtimeFreezeSha256: currentFreeze.sha256, producerSha256: fileEvidence(producerPath).sha256, verifierSha256: options.verifierSha256,
    node: process.version, versions: process.versions, platform: process.platform, arch: process.arch, commandCount: commands.length, named, transitionPlan,
    historicalPrefixReplay: 'NOT_RUN', replayStartsAtCommandCount: PREFIX_COUNT, initialSnapshotCommandCount: 1856 };
  const manifestPath = join(outputDir, 'verification-manifest.json'), indexPath = join(outputDir, 'completed.index.json'), manifestSha256 = hash(manifest), work = join(outputDir, 'working');
  const releaseLock = claimAudit(outputDir, manifestSha256);
  try {
  let completed;
  if (options.resumeDirectory) {
    assertFoolResumeManifest(json(regular(manifestPath)), manifest); completed = json(regular(indexPath));
    keys(completed, ['manifestSha256', 'completed'], 'Completed index'); assert.equal(completed.manifestSha256, manifestSha256); assert(Array.isArray(completed.completed));
    assert(completed.completed.length <= transitionPlan.length);
    for (const [i, row] of completed.completed.entries()) { keys(row, ['commandCount', 'names', 'endpointOnly', 'beforeStateSha256', 'stateSha256', 'publicStateSha256', 'status', 'revision', 'checks', 'databaseRows', 'databaseEvidence'], 'Completed transition'); assert.equal(row.commandCount, transitionPlan[i].commandCount); assert.deepEqual(row.names, transitionPlan[i].names); assert.equal(row.endpointOnly, transitionPlan[i].endpointOnly); }
  } else { writeFileSync(manifestPath, JSON.stringify(manifest), { flag: 'wx' }); sync(manifestPath); completed = { manifestSha256, completed: [] }; atomic(indexPath, completed); }
  const sourceTailPath = join(outputDir, 'original-tail12.jsonl');
  const logPath = join(outputDir, 'audit.log.jsonl'), replayPath = join(outputDir, 'replay.jsonl'), publicPath = join(outputDir, 'public-boundaries.jsonl');
  for (const path of [logPath, replayPath, publicPath, sourceTailPath]) if (existsSync(path)) regular(path);
  const attempt = readdirSync(outputDir).filter(n => /^attempt-[0-9]+\.json$/.test(n)).length + 1;
  writeFileSync(join(outputDir, `attempt-${attempt}.json`), JSON.stringify({ attempt, startedAt: new Date().toISOString(), manifestSha256, resumedCompleted: completed.completed.length }), { flag: 'wx' });
  const log = row => { const entry = { attempt, at: new Date().toISOString(), ...row }; appendFileSync(logPath, `${JSON.stringify(entry)}\n`); console.log(JSON.stringify(entry)); };
  let commandCount = PREFIX_COUNT, state, before, replayed = 0, checked = 0, originalTailReplayed = 0;
  let ledger;
  try {
    if (existsSync(work) && readdirSync(directory(work)).length === 0) { rmdirSync(work); sync(outputDir); }
    if (existsSync(work)) {
      const owner = json(regular(join(work, 'owner.json'))); assert.equal(owner.manifestSha256, manifestSha256);
      const finished = completed.completed.find(t => t.commandCount === owner.commandCount);
      if (finished) clearCompletedWork(work, finished, fileEvidence);
      else assert.equal(owner.commandCount, transitionPlan[completed.completed.length]?.commandCount, 'Only the next uncompleted generated database may be resumed');
    }
    checkInputs();
    const runtime = Object.assign(await producer.loadRuntime(), ...await Promise.all(['persistence/slice-store', 'resolution/deterministic-random', ...(finalRuntime ? ['domain/fool/owned-session', 'shared/player-text'] : [])].map(p => import(pathToFileURL(resolve(`dist/${p}.js`)).href))));
    const { DatabaseSync } = await import('node:sqlite');
    state = migrateCurrent(runtime, old.final);
    let historical = migrateCurrent(runtime, old.initial);
    assert.equal(old.prefixCount, 1856); assert.equal(historical.revision, 1857);
    old.initial = null; old.final = null;
    log({ event: 'ORIGINAL_TAIL12_STARTED', fromCommandCount: 1856, toCommandCount: PREFIX_COUNT, fullHistorical0To1868: 'NOT_RUN' });
    for (let i = 1856; i < PREFIX_COUNT; i++) {
      const historicalBefore = historical, intent = commands[i], beforeHash = stateHash(historicalBefore);
      assert(runtime.validateSlicePayload(intent));
      assert.equal(historicalBefore.status, 'ACTIVE');
      historical = runtime.applySliceIntent(historicalBefore, intent); runtime.assertValidSliceState(historical);
      assert.equal(historical.revision, historicalBefore.revision + 1); assert.equal(stateHash(historicalBefore), beforeHash);
      assert.equal(historical.random.seed, SEED); assert(historical.random.cursor >= historicalBefore.random.cursor);
      appendFileSync(sourceTailPath, `${JSON.stringify({ attempt, commandCount: i + 1, intent, beforeStateSha256: beforeHash, stateSha256: stateHash(historical), random: { cursorBefore: historicalBefore.random.cursor, cursorAfter: historical.random.cursor } })}\n`);
      originalTailReplayed++;
      log({ event: 'ORIGINAL_TAIL12_COMMAND_VERIFIED', commandCount: i + 1, cursor: historical.random.cursor });
    }
    assert.equal(originalTailReplayed, 12);
    assert.equal(stateHash(historical), stateHash(state), 'Original1856 -> 1868 tail reproduces the ENTIRE exact migrated raw final, including its RNG and private histories');
    assert.deepEqual(historical.random, state.random); historical = null; global.gc?.();
    log({ event: 'ORIGINAL_TAIL12_VERIFIED', commandsReplayed: originalTailReplayed, fullHistorical0To1868: 'NOT_RUN' });
    const origin = { runId: state.runId, character: { ...state.character, coreStats: null }, sourceDigest: runtime.foolFrozenSourceDigest(state), mastery: { ...state.progression.mastery }, revivalSha256: stateHash(state.miracleWorker.revival), combatHistorySha256: stateHash(state.combatHistory) };
    // Only the current state, preceding state, and small hash rows are retained.
    let previousHash = stateHash(state); assert.equal(previousHash, index.originalMigratedStateSha256);
    const assertOriginals = s => {
      assert.equal(s.runId, origin.runId); assert.deepEqual({ ...s.character, coreStats: null }, origin.character); assert.equal(s.random.seed, SEED);
      assert.equal(runtime.foolFrozenSourceDigest(s), origin.sourceDigest); assert.equal(stateHash(s.miracleWorker.revival), origin.revivalSha256); assert.equal(stateHash(s.combatHistory), origin.combatHistorySha256);
      for (const [id, value] of Object.entries(origin.mastery)) assert.equal(s.progression.mastery[id], value);
    };
    const verifyNames = (count, s, afterHash, beforeHash) => {
      for (const b of byCount.get(count) ?? []) {
        assert.equal(b.revision, s.revision); assert.equal(b.stateSha256, afterHash, `Actual named state: ${b.name}`); assert.deepEqual(b.budget, budget(s));
        if (b.intentCommitted === true) assert.equal(b.beforeStateSha256, beforeHash, `Actual named before: ${b.name}`);
        else if (b.intentCommitted === false) { assert.equal(b.beforeStateSha256, afterHash); assert(runtime.validateSlicePayload(b.intent)); }
      }
    };
    verifyNames(PREFIX_COUNT, state, previousHash, null); assertOriginals(state);
    let ownedSession = null;
    let currentPublic = assertFoolPublicProjection(runtime, runtime.projectSliceState(state), SEED);
    const verifyCapturedState = (count, s, privateHash, publicState) => {
      const reconstructed = originalResume?.states[count - PREFIX_COUNT] ?? null;
      const legacyHash = publicRedaction ? stateHash(restoreFoolLegacyPublicProjection(s, publicState, runtime.projectPlayerText)) : stateHash(publicState);
      if (publicRedaction) assertFoolPublicRedactionRow(publicRedaction, count - PREFIX_COUNT, { stateSha256: privateHash, budgetSha256: stateHash(budget(s)), random: s.random, eventSha256: count > 1869 ? stateHash(s.fool.journal.at(-1)) : null, legacyPublicSha256: legacyHash });
      const publicHash = reconstructed || runtimeTransition && count === 1936 ? legacyHash : null;
      assertFoolCapturedReplayState(capturedStates[count - PREFIX_COUNT], reconstructed,
        { index: count - PREFIX_COUNT, commandCount: count, stateSha256: privateHash, publicSha256: publicHash, random: s.random, budget: budget(s) });
      assertFoolTransitionEndpoint(runtimeTransition, count, privateHash, publicHash, s.random);
    };
    verifyCapturedState(PREFIX_COUNT, state, previousHash, currentPublic);
    appendFileSync(publicPath, `${JSON.stringify({ attempt, commandCount, names: (byCount.get(commandCount) ?? []).map(x => x.name), state: publicCapture(currentPublic) })}\n`);
    ledger = members.includes('commands.jsonl') ? lines(join(root, 'commands.jsonl')) : null;
    for (let i = PREFIX_COUNT; i < commands.length; i++) {
      commandCount = i + 1; const intent = commands[i], line = await ledger.next(); assert.equal(line.done, false); const row = line.value;
      if (originalResume && commandCount <= 1911) assert.deepEqual(row, originalResume.rows[i - PREFIX_COUNT], 'Every original completed row is preserved');
      before = state; assert.equal(before.status, 'ACTIVE', 'Never continue a terminal captured state'); assert(runtime.validateSlicePayload(intent)); assert.equal(intent.type, 'FOOL');
      assert.equal(row.commandCount, commandCount); assert.deepEqual(row.intent, intent); assert.deepEqual(row.before, budget(before));
      const control = currentPublic.fool.actions.find(a => stable(a.command) === stable(intent.command)); assert(control?.enabled, 'Actual intent must be currently public and enabled');
      assert.deepEqual(row.publicControl, { id: control.id, label: control.label, cost: control.cost, enabled: true });
      const advanced = advanceFoolAuditState(runtime, before, intent, ownedSession, !!finalRuntime);
      state = advanced.state; ownedSession = advanced.session; assert.equal(state.revision, before.revision + 1); assertOriginals(state);
      const receipts = assertActualRandom(runtime, before, intent, state), nextHash = stateHash(state);
      assert.equal(stateHash(before), previousHash, 'Applying the next intent never mutates the previous authoritative state');
      assert.deepEqual(row.after, budget(state)); const event = state.fool.journal.at(-1); assert.equal(row.journalEventId, event?.revision === state.revision ? event.id : null);
      verifyNames(commandCount, state, nextHash, previousHash);
      currentPublic = assertFoolPublicProjection(runtime, advanced.projection, SEED);
      verifyCapturedState(commandCount, state, nextHash, currentPublic);
      appendFileSync(replayPath, `${JSON.stringify({ attempt, commandCount, phase: row.phase, intent, beforeStateSha256: previousHash, stateSha256: nextHash, random: { cursorBefore: before.random.cursor, cursorAfter: state.random.cursor, receipts }, names: (byCount.get(commandCount) ?? []).map(x => x.name) })}\n`);
      if (byCount.has(commandCount)) appendFileSync(publicPath, `${JSON.stringify({ attempt, commandCount, names: byCount.get(commandCount).map(x => x.name), state: publicCapture(currentPublic) })}\n`);
      const plan = transitionPlan[checked];
      if (plan?.commandCount === commandCount) {
        const prior = completed.completed[checked];
        if (prior) {
          assert.equal(prior.beforeStateSha256, previousHash); assert.equal(prior.stateSha256, nextHash); assert.equal(prior.publicStateSha256, stateHash(currentPublic)); assert.equal(prior.status, state.status); assert.equal(prior.revision, state.revision);
          assert.deepEqual(prior.checks, [...CHECKS, state.status === 'DEAD' ? 'dead-sealed-reopen-and-all-actions-archived' : 'living-unsealed']);
        } else {
          const result = checkSqlite({ runtime, DatabaseSync, fileEvidence, stable, stateHash, work, manifestSha256, transition: plan, before, intent, after: state, log });
          completed.completed.push(result); atomic(indexPath, completed); clearCompletedWork(work, result, fileEvidence);
        }
        checked++; log({ event: 'SQLITE_BOUNDARY_VERIFIED', commandCount, names: plan.names, completed: checked, total: transitionPlan.length, resumed: !!prior });
      }
      replayed++; previousHash = nextHash;
      if (commandCount === commands.length && pendingIntent === null) assert.equal(stateHash(read('beforeLast')), stateHash(before));
      log({ event: 'TAIL_COMMAND_VERIFIED', commandCount, newCommandsReplayed: replayed, cursor: state.random.cursor, stateSha256: nextHash }); global.gc?.();
    }
    if (ledger) assert.equal((await ledger.next()).done, true, 'No extra committed ledger command');
    assert.equal(checked, transitionPlan.length); assert.equal(completed.completed.length, transitionPlan.length);
    assert.equal(stateHash(read('final')), stateHash(state), 'Whole captured endpoint equals exact sequential tail replay'); assert.deepEqual(report.final, budget(state));
    if (pendingIntent !== null) { assert(runtime.validateSlicePayload(pendingIntent)); assert.equal(stateHash(read('beforeLast')), stateHash(state), 'Pending last intent has no committed after-state'); }
    const actualPotions = state.fool.journal.flatMap((e, i) => e.consumption ? [{ commandCount: PREFIX_COUNT + i + 2, eventId: e.id, compoundId: e.consumption.compoundId, outcome: e.consumption.outcome }] : []);
    assert.equal(report.potions.prepared, state.fool.materials?.compounds.length ?? 0); assert.equal(report.potions.consumed, actualPotions.length);
    assert.equal(report.potions.succeeded, actualPotions.filter(p => p.outcome === 'SUCCESS').length); assert.equal(report.potions.failed, actualPotions.filter(p => p.outcome === 'FAILURE').length);
    if (report.stage === 'NATURAL_FULL1868_FOOL_PROMOTION_AND_FINITE_ESCAPE_COMPLETED') { assert.equal(state.status, 'ACTIVE'); assert.equal(state.progression.sequence, 0); assert.equal(state.fool.escape?.scene.reported, true); }
    if (report.stage === 'NATURAL_ACTUAL_TERMINAL_NO_REVIVAL') assert.notEqual(state.status, 'ACTIVE');
    checkInputs();
    const summary = { passed: true, kind: FORMAT, manifestSha256, sourceDirectory: root, outputDirectory: outputDir, captureStage: report.stage,
      originalSourceUnchanged: true, originalPrefixCommandsUnchanged: true, exactRawInitialAtCommand1856: true, exactRawPrefixFinalAtCommand1868: true,
      historicalPrefixReplay: 'NOT_RUN', historicalPrefixReplayCommandCount: 0, originalHistoricalTail1856To1868Replay: 'PASSED', originalHistoricalTailCommandsReplayed: originalTailReplayed, originalHistoricalTailSqlite: 'NOT_RUN_BY_THIS_AUDIT',
      originalTailValidation: true, originalTailValidationMeaning: 'The exact original12 commands1856-to1868 reproduce the entire migrated raw final, including RNG; full historical0-to1868 replay remains NOT_RUN.',
      originalInterruptedPrefixReconstruction: originalResume ? 'PASSED_43_ORIGINAL_ROWS_44_RECONSTRUCTED_STATES' : 'NOT_APPLICABLE',
      originalInterruptedFullStateCapture: originalResume ? false : null, originalFrozenRuntimeBaselineRerun: 'NOT_RUN_BY_THIS_AUDIT',
      runtimeTransition: runtimeTransition ? { status: 'PASSED', originalPausedRows: 68, privateStatesVerified: 69, originalCapturedPublicStatesVerified: 44, laterOriginalPublicStateHashes: 'NOT_CAPTURED', separatelyComputedOldEndpointPublicVerified: true, strategyCounters: 'PINNED_CHECKPOINT_AND_PRODUCER_REPLAY_GATE_NOT_INDEPENDENT_STRATEGY_EXECUTION', previousRuntimeRerun: 'NOT_RUN_BY_THIS_AUDIT' } : null,
      finalRuntimeProof: finalRuntime ? { status: 'PASSED', ...finalRuntime, sequentialDomainApi: 'STRICT_GUIDANCE_THEN_PRIVATE_OWNED_SESSION', capturedPrivateStatesVerified: capturedStates.length, fullSessionVersusStrictProjectionAudit: 'SEPARATE_AUDIT_NOT_RUN_HERE' } : null,
      captureFreezeSha256: capturedFreeze.sha256, runtimeFreezeSha256: currentFreeze.sha256, newTailReplay: 'PASSED', newTailReplayStartsAt: PREFIX_COUNT, newTailCommandsReplayed: replayed, finalCommandCount: commands.length, finalStateSha256: stateHash(state), final: budget(state),
      sqlite: 'PASSED', actualPotions, actualEscape: state.fool.escape ? { status: state.fool.escape.scene.status, reported: state.fool.escape.scene.reported } : null, namedBoundaries: named.length, uniqueNamedCommittedTransitions: transitions.size, sqliteTransitionsVerified: checked, additionalFinalEndpointTransition: endpointOnly,
      originalStartTransaction: 'NOT_APPLICABLE_SNAPSHOT_ONLY', pendingLastIntent: pendingIntent === null ? 'NONE' : 'PENDING_NOT_COMMITTED_NOT_APPLIED_BY_AUDIT',
      snapshotOnlyNamedBoundaries: named.filter(n => n.kind !== 'LAST_COMMITTED_TRANSITION'), aliasCount: named.filter(n => n.kind === 'LAST_COMMITTED_TRANSITION').length - transitions.size,
      attendantPublicRedaction: publicRedaction ? { currentSafeProjections: 216, restoredLegacyHashesMatched: 216, priorPublicProofSha256: FOOL_PUBLIC_REDACTION.priorProofSha256, legacyProjectionPublished: false } : null,
      publicProjection: 'PASSED_TYPED_FOOL_AND_PRIVATE_STREAM_FIELDS', privateStreamValueLeakDetected: false, publicPlayerNameProtected: true, desktop: 'NOT_RUN', fullCampaignFromCreation: 'NOT_RUN', freezeSha256: currentFreeze.sha256, verifierSha256: options.verifierSha256 };
    const summaryPath = join(outputDir, 'summary.json');
    if (existsSync(summaryPath)) assert.deepEqual(json(regular(summaryPath)), summary); else { writeFileSync(summaryPath, JSON.stringify(summary, null, 2), { flag: 'wx' }); sync(summaryPath); }
    log({ event: 'AUDIT_COMPLETE', newTailCommandsReplayed: replayed, sqliteTransitionsVerified: checked, outputDir }); for (const path of [logPath, replayPath, publicPath, sourceTailPath]) if (existsSync(path)) sync(path); return summary;
  } catch (error) {
    let workingDatabase = null;
    if (existsSync(work)) { try { workingDatabase = dbFiles(work, fileEvidence); } catch (inspectionError) { workingDatabase = { inspectionError: String(inspectionError), directory: work, retained: true }; } }
    const evidence = { attempt, passed: false, commandCount, originalTailReplayed, replayed, checked, completedTransitions: completed.completed.length, error: { name: error.name, message: error.message, stack: error.stack },
      workingDatabase, manifestSha256, historicalPrefixReplay: 'NOT_RUN', newTailReplay: 'INCOMPLETE', sqlite: 'INCOMPLETE' };
    const path = join(outputDir, `failure-${attempt}.json`); writeFileSync(path, JSON.stringify(evidence, null, 2), { flag: 'wx' }); sync(path);
    log({ event: 'AUDIT_FAILED_EVIDENCE_RETAINED', commandCount, completedTransitions: completed.completed.length, failureFile: basename(path) }); throw error;
  } finally { await ledger?.return?.(); }
  } finally { releaseLock(); }
}
export function argumentsForSave(args) {
  const options = {}, seen = new Set();
  const setters = { '--source-directory': 'sourceDirectory', '--original-resume-directory': 'originalResumeDirectory', '--final-runtime-proof': 'finalRuntimeProof', '--final-runtime-proof-sha256': 'finalRuntimeProofSha256', '--runtime-freeze-sha256': 'runtimeFreezeSha256', '--runtime-transition-file': 'runtimeTransitionFile', '--runtime-transition-sha256': 'runtimeTransitionSha256', '--output-directory': 'outputDirectory', '--resume-directory': 'resumeDirectory', '--freeze-sha256': 'freezeSha256', '--verifier-sha256': 'verifierSha256', '--tag': 'tag', '--expected-boundaries': 'expectedBoundaries' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]; assert(!seen.has(arg), `Duplicate option ${arg}`); seen.add(arg);
    if (['--help', '--preflight'].includes(arg)) { options[arg.slice(2)] = true; continue; }
    assert(setters[arg], `Unknown option ${arg}`); assert(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value ${arg}`); options[setters[arg]] = args[++i];
  }
  if (options.expectedBoundaries !== undefined) { options.expectedBoundaries = Number(options.expectedBoundaries); assert(whole(options.expectedBoundaries) && options.expectedBoundaries > 0); }
  if (options.tag !== undefined) assert(/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(options.tag)); assertFoolFinalRuntimeOptions(options); return options;
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  try {
    const options = argumentsForSave(process.argv.slice(2));
    if (options.help) console.log('Run from the matching repo root: node --expose-gc --max-old-space-size=1024 PATH/fool-save.mjs --source-directory EXACT_PRODUCER_CAPTURE --freeze-sha256 REVIEWED_PRODUCER_FREEZE --verifier-sha256 REVIEWED_VERIFIER_FILE_SHA [--preflight] [--final-runtime-proof EXACT_PROOF --final-runtime-proof-sha256 REVIEWED_PROOF_SHA --runtime-freeze-sha256 REVIEWED_FINAL_RUNTIME_SHA] [--original-resume-directory EXACT_FIVE_FILE_EVIDENCE_ROOT] [--runtime-transition-file EXACT_MANIFEST --runtime-transition-sha256 REVIEWED_MANIFEST_HASH] [--output-directory PRIVATE_ROOT] [--resume-directory EXACT_GENERATED_AUDIT_DIR] [--expected-boundaries OBSERVED_COUNT] [--tag NAME]. Preflight performs no runtime import, SQLite, replay or writes. Normal mode first verifies original1856-to1868 tail12, then the NEW tail from exact migrated command1868. Full historical0-to1868 remains NOT_RUN. Direct original resumes require the five exact evidence files. The one pinned checkpoint1936 runtime transition additionally requires its separately reviewed manifest. All other checkpoint-resumed producer captures are unsupported. The immutable --freeze-sha256 always identifies the original capture. A different post-terminal runtime requires a separately reviewed exact final-runtime proof; it never rewrites capture provenance. Its new tail uses strict guidance then the private owned session; every captured private hash and all raw SQLite ingress/reopen checks remain mandatory.');
    else await verifyFoolCapture(options);
  } catch (error) { console.error(error); process.exitCode = 1; }
}
