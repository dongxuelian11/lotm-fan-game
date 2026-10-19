import assert from 'node:assert/strict';
import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { StringDecoder } from 'node:string_decoder';

// No game import or natural action at module load.
// Run from the matching repository root only after mechanics, runner and compiled
// bytes are reviewed and frozen. No seed/resource/outcome/strategy overrides.
// The old 1868 commands are retained verbatim, not replayed by this producer.
// New play starts at their exact raw final via migration 205. A separate full
// replay/SQLite audit must establish the historical prefix and persistence.
export const SOURCE = 'tests/fixtures/attendant-mysteries-v01860/natural-battle.json';
export const SOURCE_SHA = '31e1b112e8495aece7f3bf8dc0fc63384f90ef4f0fd98aac1b14de645f334ffa';
export const PREFIX_SHA = 'b4e076eaca66ac3edd38a20a338e96d833a22a29ed48bcd0f42d7a950693de17';
export const PREFIX_COUNT = 1868, SEED = 'seer-rebuild-first';
export const STATIONS = ['quarry', 'reed-cave', 'salt-vault', 'rain-ruin'];
export const STRATEGY = Object.freeze({
  id: 'FOOL208_SAME_ORIGINAL_PUBLIC_FINITE_V1',
  order: 'ORIGINAL_MATERIALS_THEN_FATE_THEN_FOUR_STATIONS_THEN_CONSUME_THEN_ESCAPE',
  maxNewCommands: 1600, receptionActionsPerNeed: 96, receptionActionsTotal: 1000,
  materialAttemptsPerOriginalAndOperation: 3, stationVisitsPerStation: 3,
  fateCommissions: 3, graftAttemptsPerCommission: 1, fateCommandsPerCommission: 16,
  potionAttempts: 3, circuitCommandsPerAttempt: 12, escapeCommands: 9,
  recovery: 'ONLY_REAL_PUBLIC_WORK_REST_NEXT_WEEK_AND_PAID_ORIGINAL_RECOVERY',
  fateFailure: 'PUBLIC_WITHDRAW_THROUGH_THIRD_BELL_THEN_LATER_WEEK_PREEXISTING_COMMISSION',
  escapeFailure: 'ONE_MAIN_PASSAGE_ATTEMPT_PER_LEG_THEN_PUBLIC_WITHDRAW_AND_REPORT',
  snapshots: 'ORIGINAL_RAW_INITIAL_AND_FINAL_PLUS_CURRENT_BEFORE_LAST_AND_FINAL_ONCE; NAMED_BOUNDARIES_ARE_HASHED_COMMAND_INDEXES',
});
const SELF = fileURLToPath(import.meta.url);
export const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const stateHash = value => createHash('sha256').update(stable(value)).digest('hex');
export function fileEvidence(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; hash.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  assert.equal(bytes, lstatSync(path).size, `File changed during read: ${path}`);
  return { bytes, sha256: hash.digest('hex') };
}
export const fileHash = path => fileEvidence(path).sha256;
export function inspectFreeze() {
  const files = [];
  const walk = path => {
    const stat = lstatSync(path); assert(!stat.isSymbolicLink(), `Frozen input cannot be a symlink: ${path}`);
    if (stat.isDirectory()) { for (const name of readdirSync(path).sort()) walk(join(path, name)); }
    else if (stat.isFile()) files.push({ file: path.split(sep).join('/'), ...fileEvidence(path) });
  };
  assert(existsSync('dist/domain/fool/index.js'), 'Compile the reviewed Fool mechanics before freezing; no runtime was loaded');
  for (const path of ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation']) walk(path);
  files.push({ file: '$natural-runner', ...fileEvidence(SELF) }, { file: SOURCE, ...fileEvidence(SOURCE) });
  return { sha256: compactHash(files), files };
}
export async function loadRuntime() {
  return Object.assign({}, ...await Promise.all(['domain/slice/index', 'domain/slice/migration', 'domain/fool/index', 'domain/fool/source', 'domain/fool/fate', 'domain/fool/fate-host', 'domain/fool/engine', 'domain/fool/fog', 'domain/fool/materials'].map(name => import(pathToFileURL(resolve(`dist/${name}.js`)).href))));
}
export function readSource() {
  assert.equal(fileHash(SOURCE), SOURCE_SHA, 'Use the exact frozen full natural-battle source');
  const old = Object.fromEntries(['provenance', 'creation', 'seed', 'prefixCount', 'commands', 'initial', 'final'].map(k => [k, readObjectEntry(SOURCE, k)]));
  assert.equal(old.commands.length, PREFIX_COUNT); assert.equal(compactHash(old.commands), PREFIX_SHA); assert.equal(old.seed, SEED);
  assert.equal(old.prefixCount, 1856); assert.equal(old.initial.revision, 1857);
  assert.equal(old.final.schemaVersion, 183); assert.equal(old.final.contentVersion, 'attendant-mysteries-v183');
  assert.equal(old.final.runId, 'seer-rebuild-natural'); assert.equal(old.final.status, 'ACTIVE'); assert.equal(old.final.revision, 1869);
  assert.equal(old.final.week, 15971); assert.deepEqual(old.final.date, { epoch: 'FIFTH_EPOCH', year: 1655, month: 7, day: 26 });
  assert.deepEqual([old.final.health, old.final.mind, old.final.spirituality, old.final.cash, old.final.actionsRemaining, old.final.random.cursor], [90, 95, 106, 25, 3, 932]);
  assert.equal(old.final.progression.sequence, 1); assert.equal(old.final.progression.acting, 100); assert.equal(Object.keys(old.final.progression.mastery).length, 34);
  assert.equal(old.final.combat, null); assert.equal(old.final.activeEvent, null);
  return old;
}
export function migrateCurrent(runtime, raw) {
  const s = runtime.migrateSliceState(raw);
  assert.equal(s.schemaVersion, 205); assert.equal(s.contentVersion, 'fool-v205');
  for (const key of ['runId', 'revision', 'status', 'character', 'week', 'date', 'actionsRemaining', 'cash', 'health', 'mind', 'spirituality', 'injuries', 'injuryRisk', 'random', 'progression', 'attendantMysteries', 'miracleWorker', 'combatHistory']) assert.deepEqual(s[key], raw[key], `Migration must preserve ${key}`);
  runtime.assertValidSliceState(s); return s;
}
class FiniteStop extends Error { constructor(code, message, detail = null) { super(message); this.code = code; this.detail = detail; } }
class ActualTerminal extends Error {}
class ManualPause extends Error {}
const textHash = text => createHash('sha256').update(text).digest('hex');
function durableText(path, text, flags = 'wx') {
  const fd = openSync(path, flags);
  try { writeFileSync(fd, text); fsyncSync(fd); } finally { closeSync(fd); }
}
function durableJsonReplacement(path, value) {
  const temporary = `${path}.next`;
  durableText(temporary, JSON.stringify(value));
  renameSync(temporary, path);
  const dir = openSync(resolve(path, '..'), 'r');
  try { fsyncSync(dir); } finally { closeSync(dir); }
}
function parseLedger(text) {
  assert(text.endsWith('\n'), 'Resume requires a complete durable ledger, including the final newline');
  return text.slice(0, -1).split('\n').map(JSON.parse);
}
export function readOriginalResume(directory) {
  const interruptionPath = join(directory, 'interruption.json');
  const interruption = JSON.parse(readFileSync(interruptionPath, 'utf8'));
  assert.equal(interruption.kind, 'EXPLICIT_MANUAL_INTERRUPTION_PARTIAL_CAPTURE');
  assert.equal(interruption.originalProcessTerminated, true);
  assert.equal(interruption.completePrivateStatePersisted, false);
  assert.equal(interruption.lastCompleteCommandCount, 1911);
  assert.equal(interruption.newCompleteCommandRows, 43);
  const ledgerPath = join(directory, 'terminated-commands.jsonl');
  assert.equal(fileHash(ledgerPath), interruption.files['terminated-commands.jsonl'].sha256);
  const ledgerText = readFileSync(ledgerPath, 'utf8'), rows = parseLedger(ledgerText);
  const originalFreezePath = join(directory, 'freeze-before-natural.json');
  assert.equal(fileHash(originalFreezePath), interruption.files['freeze-before-natural.json'].sha256);
  const originalFreeze = JSON.parse(readFileSync(originalFreezePath, 'utf8'));
  assert.equal(compactHash(originalFreeze.files), originalFreeze.sha256);
  assert.equal(originalFreeze.sha256, interruption.freezeSha256);
  const baseline = join(directory, 'baseline');
  const summary = JSON.parse(readFileSync(join(baseline, 'summary.json'), 'utf8'));
  assert.equal(summary.kind, 'RECONSTRUCTED_FROM_EXACT_COMPLETED_PARTIAL_LEDGER_NOT_ORIGINAL_FULL_STATE_CAPTURE');
  assert.equal(summary.mode, 'baseline'); assert.equal(summary.passed, true);
  assert.equal(summary.originalCapturedFullState, false);
  assert.equal(summary.allOriginalRecordedBudgetsControlsCursorsVerified, true);
  assert.equal(summary.freeze, originalFreeze.sha256);
  assert.equal(summary.ledgerHash, textHash(ledgerText));
  const statesPath = join(baseline, 'states.jsonl');
  const states = parseLedger(readFileSync(statesPath, 'utf8'));
  assert.equal(rows.length, 43); assert.equal(summary.newCommands, rows.length);
  assert.equal(states.length, rows.length + 1);
  for (const [index, state] of states.entries()) {
    assert.equal(state.index, index); assert.equal(state.commandCount, PREFIX_COUNT + index);
    assert.match(state.stateSha256, /^[a-f0-9]{64}$/);
    assert.match(state.publicSha256, /^[a-f0-9]{64}$/, 'Original reconstruction must include every full public projection');
    assert(state.budget && state.random, 'Original reconstruction must include every budget and RNG');
  }
  assert.equal(states.at(-1).stateSha256, summary.stateSha256);
  assert.equal(states.at(-1).publicSha256, summary.publicSha256);
  assert.equal(stateHash(JSON.parse(readFileSync(join(baseline, 'reconstructed-final.json'), 'utf8'))), summary.stateSha256);
  return { rows, ledgerText, states, checkpoint: null,
    provenance: { kind: 'EXACT_FINITE_STRATEGY_RECONSTRUCTION_OF_ORIGINAL_INTERRUPTED_PREFIX',
      originalCapture: { interruptionFile: interruptionPath, interruptionSha256: fileHash(interruptionPath),
        originalCaptureFreezeSha256: originalFreeze.sha256, originalCapturedFullState: false,
        completedNewCommands: rows.length, lastCompleteCommandCount: interruption.lastCompleteCommandCount,
        ledgerFile: ledgerPath, ledgerSha256: textHash(ledgerText),
        partialNextAction: interruption.partialNextAction },
      reconstruction: { kind: summary.kind, originalFrozenRuntimeBaselineStatesFile: statesPath,
        baselineStatesSha256: fileHash(statesPath), baselineFinalStateSha256: summary.stateSha256,
        baselineFreezeSha256: summary.freeze, originalBoundarySnapshotsCaptured: false,
        boundaryHashesMeaning: 'REGENERATED_BY_EXACT_STRATEGY_FROM_FULL_STATE_EQUIVALENT_RECONSTRUCTION' } } };
}
export function readCheckpointResume(path, freeze) {
  const checkpoint = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(checkpoint.format, 'FOOL208_DURABLE_ACTION_BOUNDARY_V1');
  assert.equal(checkpoint.resumable, true);
  assert.equal(checkpoint.reason, 'MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY');
  const directory = resolve(path, '..');
  const pause = JSON.parse(readFileSync(join(directory, 'pause.json'), 'utf8'));
  assert.equal(pause.stage, 'MANUAL_PAUSE_DURABLE_ACTION_BOUNDARY');
  assert.equal(pause.commands, checkpoint.commandCount);
  assert.equal(pause.checkpointSha256, fileHash(path));
  assert.equal(readFileSync(join(directory, 'commands.jsonl'), 'utf8'), checkpoint.ledgerText,
    'Checkpoint does not cover the complete ledger; reconstruct any later completed rows before resuming');
  assert.deepEqual(parseLedger(readFileSync(join(directory, 'states.jsonl'), 'utf8')), checkpoint.stateRows);
  assert.equal(checkpoint.pendingIntent, null);
  assert.equal(checkpoint.currentRuntimeFreezeSha256, freeze.sha256, 'Do not change runtime or runner between checkpoint and resume');
  assert.deepEqual(checkpoint.strategy, STRATEGY);
  assert.equal(checkpoint.sourceSha256, SOURCE_SHA); assert.equal(checkpoint.sourceCommandsSha256, PREFIX_SHA);
  assert.equal(checkpoint.finalStateSha256, stateHash(checkpoint.final));
  assert.equal(checkpoint.ledgerSha256, textHash(checkpoint.ledgerText));
  const rows = parseLedger(checkpoint.ledgerText);
  assert.deepEqual(rows, checkpoint.commandRows);
  assert.equal(checkpoint.commands.length, checkpoint.commandCount);
  assert.equal(compactHash(checkpoint.commands.slice(0, PREFIX_COUNT)), PREFIX_SHA);
  assert.equal(checkpoint.commandCount, PREFIX_COUNT + rows.length);
  return { rows, ledgerText: checkpoint.ledgerText, states: checkpoint.stateRows, checkpoint,
    provenance: { ...checkpoint.resumeProvenance,
      resumedCheckpoint: { file: path, sha256: fileHash(path), reason: checkpoint.reason,
        commandCount: checkpoint.commandCount, finalStateSha256: checkpoint.finalStateSha256,
        previousRuntimeFreezeSha256: checkpoint.currentRuntimeFreezeSha256 } } };
}

// One reviewed transition for this exact graceful pause. This is not an override
// for ordinary same-runtime checkpoint resumes or for caller-chosen differences.
export const RUNTIME_TRANSITION = Object.freeze({
  format: 'FOOL208_PINNED_RUNTIME_TRANSITION_V1',
  kind: 'CANONICAL_MATERIAL_REPLAY_AND_PREVIEW_AUDIT_WITH_SAME_ROOT_HISTORY_REUSE_ONLY',
  provenanceKind: 'EXACT_PAUSED_CHECKPOINT_REPLAY_WITH_APPROVED_RUNTIME_TRANSITION',
  manifestFile: 'output/qa-0208/canonical-pause-1937/runtime-transition.json',
  checkpointFile: 'output/play/fool-02080-3SBoW5/checkpoint.json',
  checkpointSha256: 'e981e113a494c18f50686374ebef6cc355ba6e8a92320a89457f8a8925817dd1',
  previousRuntimeFreezeSha256: '4fa64f7979b7cd079f694967bdb17830358d565ae405d021713de8257b160d4a',
  commandCount: 1936, rows: 68, privateStates: 69, originalPublicStates: 44,
  finalStateSha256: '06e4f43fe2044dcf68c800f8f5230256f0947821e3a570ed260b5a5cd350923b',
  controlSha256: '18ef3f7481066157c69b69f0041f352e25c94b3108d320bfc0c15f7a88bcbc4d',
  finalPublicSha256: 'b7aefa32cb51899969d44f5565392ed50d40536b0fde3cde8182877ea9f436f9',
  finalPublicEvidenceFile: 'output/qa-0208/canonical-pause-1937/benchmark-before.json',
  finalPublicEvidenceSha256: 'cb13195541cd40f1fa91039576dd15576276d2e6b6ba58dbb71e9923ebec826d',
  changedFiles: Object.freeze(['$natural-runner', 'dist/domain/fool/engine.js', 'dist/domain/fool/engine.js.map',
    'dist/domain/fool/materials.js', 'dist/domain/fool/materials.js.map',
    'dist/domain/slice/index.js', 'dist/domain/slice/index.js.map', 'src/domain/fool/engine.ts',
    'src/domain/fool/materials.ts', 'src/domain/slice/index.ts']),
});
export function checkpointTransitionControl(checkpoint) {
  const { commands, commandRows, ledgerText, stateRows, final, ...control } = checkpoint;
  return { ...control, commandsSha256: compactHash(commands), commandRowsSha256: compactHash(commandRows), stateRowsSha256: compactHash(stateRows) };
}
export function runtimeTransitionDifference(oldFreeze, newFreeze) {
  for (const freeze of [oldFreeze, newFreeze]) {
    assert.equal(compactHash(freeze.files), freeze.sha256, 'Transition freeze manifest digest mismatch');
    assert.equal(new Set(freeze.files.map(entry => entry.file)).size, freeze.files.length, 'Duplicate frozen path');
    for (const entry of freeze.files) { assert.match(entry.sha256, /^[a-f0-9]{64}$/); assert(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); }
  }
  assert.equal(oldFreeze.sha256, RUNTIME_TRANSITION.previousRuntimeFreezeSha256);
  assert.deepEqual(newFreeze.files.map(entry => entry.file), oldFreeze.files.map(entry => entry.file), 'No added/removed/reordered frozen files in this transition');
  const changed = oldFreeze.files.flatMap((before, index) => {
    const after = newFreeze.files[index];
    return same(before, after) ? [] : [{ file: before.file, before: { bytes: before.bytes, sha256: before.sha256 }, after: { bytes: after.bytes, sha256: after.sha256 } }];
  }).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  assert.deepEqual(changed.map(entry => entry.file), RUNTIME_TRANSITION.changedFiles, 'Only the ten exact reviewed files may differ');
  return changed;
}
export function validateRuntimeTransitionManifest(manifest, freeze) {
  assert.equal(manifest.format, RUNTIME_TRANSITION.format); assert.equal(manifest.kind, RUNTIME_TRANSITION.kind);
  assert.deepEqual(manifest.newFreeze, freeze, 'Transition must name this exact reviewed current freeze');
  assert.deepEqual(manifest.changedFiles, runtimeTransitionDifference(manifest.oldFreeze, manifest.newFreeze));
  const checkpoint = manifest.checkpoint;
  assert.equal(checkpoint.file, RUNTIME_TRANSITION.checkpointFile);
  assert.equal(checkpoint.sha256, RUNTIME_TRANSITION.checkpointSha256);
  assert(Number.isSafeInteger(checkpoint.bytes) && checkpoint.bytes > 0);
  assert.equal(compactHash(checkpoint.control), RUNTIME_TRANSITION.controlSha256, 'Only the exact paused counters/boundaries/control record are authorized');
  assert.equal(checkpoint.control.commandCount, RUNTIME_TRANSITION.commandCount);
  assert.equal(checkpoint.control.finalStateSha256, RUNTIME_TRANSITION.finalStateSha256);
  assert.equal(checkpoint.control.currentRuntimeFreezeSha256, RUNTIME_TRANSITION.previousRuntimeFreezeSha256);
  assert.equal(checkpoint.finalPublicSha256, RUNTIME_TRANSITION.finalPublicSha256);
  const evidence = checkpoint.finalPublicEvidence;
  assert.equal(evidence.kind, 'COMPUTED_FROM_EXACT_PAUSED_PRIVATE_STATE_WITH_FROZEN_PREVIOUS_RUNTIME');
  assert.equal(evidence.file, RUNTIME_TRANSITION.finalPublicEvidenceFile);
  assert.equal(evidence.sha256, RUNTIME_TRANSITION.finalPublicEvidenceSha256);
  assert.equal(evidence.bytes, Buffer.byteLength(evidence.rawText));
  assert.equal(evidence.sha256, textHash(evidence.rawText));
  const proof = JSON.parse(evidence.rawText);
  assert.equal(proof.mode, 'before'); assert.equal(proof.freeze, RUNTIME_TRANSITION.previousRuntimeFreezeSha256);
  assert.equal(proof.checkpoint, RUNTIME_TRANSITION.checkpointSha256); assert.equal(proof.initial, RUNTIME_TRANSITION.finalStateSha256);
  assert.equal(proof.public, RUNTIME_TRANSITION.finalPublicSha256);
  return manifest;
}
export function createRuntimeTransitionManifest(oldFreeze, freeze) {
  // This only prepares small evidence. It never imports the game or applies an action.
  const resume = readCheckpointResume(RUNTIME_TRANSITION.checkpointFile, oldFreeze);
  assert.equal(fileHash(RUNTIME_TRANSITION.checkpointFile), RUNTIME_TRANSITION.checkpointSha256);
  const rawText = readFileSync(RUNTIME_TRANSITION.finalPublicEvidenceFile, 'utf8');
  const manifest = { format: RUNTIME_TRANSITION.format, kind: RUNTIME_TRANSITION.kind,
    checkpoint: { file: RUNTIME_TRANSITION.checkpointFile, ...fileEvidence(RUNTIME_TRANSITION.checkpointFile),
      control: checkpointTransitionControl(resume.checkpoint), finalPublicSha256: RUNTIME_TRANSITION.finalPublicSha256,
      finalPublicEvidence: { kind: 'COMPUTED_FROM_EXACT_PAUSED_PRIVATE_STATE_WITH_FROZEN_PREVIOUS_RUNTIME',
        file: RUNTIME_TRANSITION.finalPublicEvidenceFile, bytes: Buffer.byteLength(rawText), sha256: textHash(rawText), rawText } },
    oldFreeze, newFreeze: freeze, changedFiles: runtimeTransitionDifference(oldFreeze, freeze) };
  return validateRuntimeTransitionManifest(manifest, freeze);
}
function readRuntimeTransitionEvidence(provenance, freeze) {
  assert.equal(provenance.kind, RUNTIME_TRANSITION.provenanceKind);
  assert.equal(provenance.manifestFile, RUNTIME_TRANSITION.manifestFile);
  assert.equal(fileHash(provenance.manifestFile), provenance.manifestSha256, 'Pinned transition evidence changed');
  const manifest = validateRuntimeTransitionManifest(JSON.parse(readFileSync(provenance.manifestFile, 'utf8')), freeze);
  assert.deepEqual(provenance, { kind: RUNTIME_TRANSITION.provenanceKind,
    manifestFile: RUNTIME_TRANSITION.manifestFile, manifestSha256: fileHash(provenance.manifestFile),
    checkpointFile: RUNTIME_TRANSITION.checkpointFile, checkpointSha256: RUNTIME_TRANSITION.checkpointSha256,
    previousRuntimeFreezeSha256: RUNTIME_TRANSITION.previousRuntimeFreezeSha256, currentRuntimeFreezeSha256: freeze.sha256,
    commandCount: RUNTIME_TRANSITION.commandCount, finalStateSha256: RUNTIME_TRANSITION.finalStateSha256 });
  return manifest;
}
export function readTransitionResume(path, freeze) {
  assert.equal(resolve(path), resolve(RUNTIME_TRANSITION.manifestFile), 'Use this transition\'s fixed reviewed manifest');
  const manifest = validateRuntimeTransitionManifest(JSON.parse(readFileSync(path, 'utf8')), freeze);
  assert.deepEqual(fileEvidence(manifest.checkpoint.file), { bytes: manifest.checkpoint.bytes, sha256: manifest.checkpoint.sha256 });
  // The original exact same-runtime reader remains unchanged. Only this pinned
  // transition supplies its cryptographically fixed previous freeze to that reader.
  const resume = readCheckpointResume(manifest.checkpoint.file, manifest.oldFreeze);
  assert.deepEqual(checkpointTransitionControl(resume.checkpoint), manifest.checkpoint.control);
  assert.equal(resume.rows.length, RUNTIME_TRANSITION.rows); assert.equal(resume.states.length, RUNTIME_TRANSITION.privateStates);
  assert.equal(resume.states.filter(row => row.publicSha256 !== undefined).length, RUNTIME_TRANSITION.originalPublicStates);
  for (const [index, state] of resume.states.entries()) {
    assert.equal(state.index, index); assert.equal(state.commandCount, PREFIX_COUNT + index);
    assert.match(state.stateSha256, /^[a-f0-9]{64}$/);
    if (index < RUNTIME_TRANSITION.originalPublicStates) assert.match(state.publicSha256, /^[a-f0-9]{64}$/);
  }
  const { resumedCheckpoint, ...provenance } = resume.provenance;
  return { ...resume, transitionRequested: true, transitionManifest: manifest,
    provenance: { ...provenance, runtimeTransition: { kind: RUNTIME_TRANSITION.provenanceKind,
      manifestFile: RUNTIME_TRANSITION.manifestFile, manifestSha256: fileHash(path),
      checkpointFile: RUNTIME_TRANSITION.checkpointFile, checkpointSha256: RUNTIME_TRANSITION.checkpointSha256,
      previousRuntimeFreezeSha256: RUNTIME_TRANSITION.previousRuntimeFreezeSha256, currentRuntimeFreezeSha256: freeze.sha256,
      commandCount: RUNTIME_TRANSITION.commandCount, finalStateSha256: RUNTIME_TRANSITION.finalStateSha256 } } };
}

const same = isDeepStrictEqual;
const commandKind = c => c.type === 'FATE' && c.command.type === 'CASE' ? `FATE.${c.command.action.type}` : c.command ? `${c.type}.${c.command.type}` : c.type;

export function runNatural(runtime, old, { outputDir, freeze, resume = null }) {
  let s = migrateCurrent(runtime, old.final), phase = 'EXACT_1868_PREFIX_FINAL', beforeLast = null, beforeLastCommandCount = null, lastIntent = null, pendingIntent = null;
  const commands = [...old.commands], boundaries = {}, commandRows = [], observations = [], checksums = new Map();
  const materialAttempts = new Map(), original = s, originalHash = stateHash(s), frozenHistory = runtime.foolFrozenSourceDigest(s);
  let receptionActions = 0;
  // The strategy is replayed, never restarted at a later game state. This rebuilds
  // every caller loop/counter, including receptionActions++ after go() returns.
  // Replayed applySliceIntent calls are pure in-memory evaluation; output is held
  // until every original row and reconstructed state has matched exactly.
  const pauseFile = join(outputDir, 'PAUSE_REQUESTED');
  const replayCount = resume?.rows.length ?? 0;
  assert(!resume || replayCount > 0, 'A resume must name at least one completed action');
  const stateRows = [{ index: 0, commandCount: PREFIX_COUNT, stateSha256: originalHash }];
  let replayVerified = !resume, ledgerText = '', verifiedReplayStates = 0, verifiedPublicReplayStates = 0, replayProgress = null;
  const replayStartedAt = Date.now();
  const resumeProvenance = resume ? { ...resume.provenance,
    currentRuntimeFreezeSha256: freeze.sha256, continuation: 'SAME_FINITE_STRATEGY_WITH_REPLAY_RESTORED_COUNTERS',
    replayEffects: 'IN_MEMORY_ONLY_NO_DUPLICATE_AUDIT_ROWS', verifiedCompletedRows: 0 } : null;
  if (resumeProvenance?.runtimeTransition) readRuntimeTransitionEvidence(resumeProvenance.runtimeTransition, freeze);
  assert(!existsSync(join(outputDir, 'commands.jsonl')) && !existsSync(join(outputDir, 'states.jsonl')),
    'Use a fresh output directory; never overwrite an original capture');
  const write = (name, data) => writeFileSync(join(outputDir, name), JSON.stringify(data), { flag: 'wx' });
  let projectedState = null, projectedView = null, projectedElapsedMs = 0, ownedRuntime = null;
  // The same opaque domain session is used by the desktop repository. Guidance
  // enters through the strict raw-state path; opening an established chapter
  // independently verifies its full source and history. Only detached snapshots
  // leave the session, and every actual command creates its own isolated draft.
  const currentRuntime = () => {
    if (!ownedRuntime && s.fool.guidanceKnown && s.fool.source !== null) ownedRuntime = runtime.openFoolRuntimeSession(s);
    if (ownedRuntime) assert.deepEqual(ownedRuntime.inspect(), { runId: s.runId, revision: s.revision, status: s.status });
    return ownedRuntime;
  };
  const fullPublic = () => currentRuntime()?.project() ?? runtime.projectSliceState(s);
  const view = () => { if (projectedState !== s) { const started = Date.now(); projectedView = currentRuntime()?.projectFool() ?? runtime.projectFool(s); projectedElapsedMs = Date.now() - started; projectedState = s; } return projectedView; };
  const actions = () => view().actions;
  const offered = command => actions().find(a => same(a.command, command));
  const budget = () => ({ revision: s.revision, week: s.week, date: s.date, status: s.status, sequence: s.progression.sequence, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actions: s.actionsRemaining, pollution: s.seer.pollution, cursor: s.random.cursor, second: s.fool.frame?.nowSecond ?? null, location: s.fool.frame?.location ?? 'base' });
  function invariant(full = false) {
    assert.equal(s.runId, original.runId); assert.equal(s.random.seed, SEED);
    assert.equal(s.character.name, original.character.name); assert.equal(s.character.gender, original.character.gender);
    assert(s.random.cursor >= original.random.cursor);
    for (const [id, mastery] of Object.entries(original.progression.mastery)) assert.equal(s.progression.mastery[id], mastery, `Old mastery changed: ${id}`);
    assert.deepEqual(s.miracleWorker.revival, original.miracleWorker.revival, 'Never consume/refill the old revival ledger');
    if (full) {
      assert.equal(runtime.foolFrozenSourceDigest(s), frozenHistory, 'Original town, wounds, acquisition, worm and life records remain frozen');
      assert.deepEqual(s.combatHistory, original.combatHistory);
      runtime.assertValidSliceState(s);
    }
  }
  function checksum(count, state) { if (!checksums.has(count)) checksums.set(count, stateHash(state)); return checksums.get(count); }
  function mark(name) {
    if (boundaries[name]) throw Error(`Duplicate boundary ${name}`);
    invariant(true);
    boundaries[name] = { phase, commandCount: commands.length, commandIndex0: commands.length - 1, revision: s.revision,
      stateSha256: checksum(commands.length, s),
      ...(beforeLast ? { beforeCommandCount: beforeLastCommandCount, beforeStateSha256: checksum(beforeLastCommandCount, beforeLast), intent: lastIntent, intentCommitted: pendingIntent === null } : {}),
      budget: budget(), replayFrom: { file: 'natural.json', key: 'prefixFinal', sourceCommandCount: PREFIX_COUNT, migrateToSchema: 205 },
      inclusiveTailRange0: [PREFIX_COUNT, commands.length - 1] };
  }
  function verifyReplayState(index, timing = {}) {
    const verificationStartedAt = Date.now();
    let publicProjectionAndHashMs = null;
    const expected = resume.states[index], actual = stateRows[index];
    assert(expected, `Missing reconstructed state ${index}`);
    assert.equal(expected.index, index); assert.equal(expected.commandCount, PREFIX_COUNT + index);
    assert.equal(actual.stateSha256, expected.stateSha256, `Full-state replay mismatch at ${PREFIX_COUNT + index}`);
    if (expected.publicSha256) {
      const publicStartedAt = Date.now();
      assert.equal(stateHash(fullPublic()), expected.publicSha256, `Public-state replay mismatch at ${PREFIX_COUNT + index}`);
      publicProjectionAndHashMs = Date.now() - publicStartedAt;
      actual.publicSha256 = expected.publicSha256;
      verifiedPublicReplayStates++;
    }
    if (expected.budget) assert.deepEqual(budget(), expected.budget);
    if (expected.random) assert.deepEqual(s.random, expected.random);
    assert.equal(index, verifiedReplayStates, 'Verify every reconstructed state in order');
    verifiedReplayStates++;
    const progress = { stage: 'RECONSTRUCTION_VERIFIED_STATE', mode: 'IN_MEMORY_REPLAY_ONLY',
      time: new Date().toISOString(), verifiedIndex: index, verifiedStates: verifiedReplayStates,
      totalStates: replayCount + 1, verifiedRows: index, totalRows: replayCount,
      commandCount: PREFIX_COUNT + index, phase, operation: index ? commandKind(lastIntent.command) : null,
      stateSha256: actual.stateSha256, publicSha256: actual.publicSha256 ?? null,
      projectionMs: timing.projectionMs ?? null, applyMs: timing.applyMs ?? null,
      recordStateHashMs: timing.recordStateHashMs ?? null, publicProjectionAndHashMs,
      stateVerificationMs: Date.now() - verificationStartedAt,
      actionElapsedMs: timing.startedAt === undefined ? null : Date.now() - timing.startedAt,
      replayElapsedMs: Date.now() - replayStartedAt, continuationGateOpen: false };
    replayProgress = progress;
    writeFileSync(join(outputDir, 'resume-progress.json'), JSON.stringify(progress));
    console.log(JSON.stringify(progress));
  }
  function checkpoint(reason) {
    assert.equal(pendingIntent, null);
    invariant(true);
    assert.equal(inspectFreeze().sha256, freeze.sha256, 'Frozen runtime changed before checkpoint');
    if (resumeProvenance?.runtimeTransition) readRuntimeTransitionEvidence(resumeProvenance.runtimeTransition, freeze);
    assert.equal(compactHash(commands.slice(0, PREFIX_COUNT)), PREFIX_SHA);
    const payload = { format: 'FOOL208_DURABLE_ACTION_BOUNDARY_V1', resumable: reason === 'MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY', reason,
      source: SOURCE, sourceSha256: SOURCE_SHA, sourceCommandsSha256: PREFIX_SHA,
      strategy: STRATEGY, currentRuntimeFreezeSha256: freeze.sha256,
      resumeProvenance, commandCount: commands.length, phase, commands, commandRows,
      ledgerText, ledgerSha256: textHash(ledgerText), stateRows,
      boundaries, observations, receptionActions, materialAttempts: [...materialAttempts],
      beforeLastCommandCount, beforeLastStateSha256: beforeLast ? checksum(beforeLastCommandCount, beforeLast) : null,
      lastIntent, pendingIntent, finalStateSha256: checksum(commands.length, s), final: s,
      continuationMeaning: 'INSIDE_GO_AFTER_COMMIT_BEFORE_CALLER_CONTINUES; REPLAY_THE_STRATEGY_TO_RESTORE_ALL_LOCALS' };
    durableJsonReplacement(join(outputDir, 'checkpoint.json'), payload);
  }
  function completeReplay() {
    assert.equal(verifiedReplayStates, replayCount + 1, 'Every recorded full state must pass before any new action');
    assert.equal(commandRows.length, replayCount);
    assert.equal(resume.states.length, replayCount + 1);
    assert.deepEqual(commandRows, resume.rows);
    const prior = resume.checkpoint;
    if (prior) {
      assert.deepEqual(commands, prior.commands); assert.equal(phase, prior.phase);
      assert.deepEqual(boundaries, prior.boundaries); assert.deepEqual(observations, prior.observations);
      assert.equal(receptionActions, prior.receptionActions); assert.deepEqual([...materialAttempts], prior.materialAttempts);
      assert.equal(beforeLastCommandCount, prior.beforeLastCommandCount);
      assert.equal(checksum(beforeLastCommandCount, beforeLast), prior.beforeLastStateSha256);
      assert.deepEqual(lastIntent, prior.lastIntent); assert.equal(checksum(commands.length, s), prior.finalStateSha256);
    }
    if (resume.transitionRequested) {
      assert.equal(verifiedReplayStates, RUNTIME_TRANSITION.privateStates);
      assert.equal(verifiedPublicReplayStates, RUNTIME_TRANSITION.originalPublicStates);
      assert.equal(commands.length, RUNTIME_TRANSITION.commandCount);
      assert.equal(stateHash(fullPublic()), resume.transitionManifest.checkpoint.finalPublicSha256,
        'The separately reconstructed previous-runtime endpoint public projection must also match');
    }
    // Preserve all original JSONL bytes once; none are appended during replay.
    ledgerText = resume.ledgerText;
    durableText(join(outputDir, 'commands.jsonl'), ledgerText);
    durableText(join(outputDir, 'states.jsonl'), stateRows.map(row => JSON.stringify(row) + '\n').join(''));
    resumeProvenance.verifiedCompletedRows = replayCount;
    resumeProvenance.verifiedStates = verifiedReplayStates;
    checkpoint('VERIFIED_REPLAY_RESUME_BOUNDARY');
    replayVerified = true;
    const progress = { ...replayProgress, stage: 'ORIGINAL_PREFIX_RECONSTRUCTION_VERIFIED', time: new Date().toISOString(), outputDir,
      commandCount: commands.length, verifiedRows: replayCount, verifiedStates: verifiedReplayStates, continuationGateOpen: true,
      ...(resume.transitionRequested ? { verifiedRecordedPublicStates: verifiedPublicReplayStates, separatelyComputedEndpointPublicSha256: resume.transitionManifest.checkpoint.finalPublicSha256 } : {}),
      originalCapturedFullState: resumeProvenance.originalCapture?.originalCapturedFullState ?? null,
      currentRuntimeFreezeSha256: freeze.sha256 };
    writeFileSync(join(outputDir, 'resume-progress.json'), JSON.stringify(progress));
    console.log(JSON.stringify(progress));
  }
  function persistAction(row, timing) {
    const hashStartedAt = Date.now();
    const index = commands.length - PREFIX_COUNT;
    stateRows.push({ index, commandCount: commands.length, stateSha256: checksum(commands.length, s) });
    const recordStateHashMs = Date.now() - hashStartedAt;
    if (!replayVerified) {
      assert.deepEqual(row, resume.rows[index - 1], `Exact strategy/recorded-row mismatch at ${commands.length}`);
      verifyReplayState(index, { ...timing, recordStateHashMs });
      if (index === replayCount) completeReplay();
      return;
    }
    const line = JSON.stringify(row) + '\n'; ledgerText += line;
    durableText(join(outputDir, 'commands.jsonl'), line, 'a');
    durableText(join(outputDir, 'states.jsonl'), JSON.stringify(stateRows.at(-1)) + '\n', 'a');
  }
  function pauseAtDurableBoundary() {
    if (!replayVerified || !existsSync(pauseFile)) return;
    // Detecting the request never stops play. First persist the complete state,
    // commands and counters, then honor the request at this completed boundary.
    checkpoint('MANUAL_PAUSE_COMPLETED_ACTION_BOUNDARY');
    throw new ManualPause('Paused after complete durable action boundary');
  }
  function go(action, key = null) {
    const replaying = !replayVerified;
    const startedAt = Date.now();
    if (commands.length - PREFIX_COUNT >= STRATEGY.maxNewCommands) throw new FiniteStop('COMMAND_BUDGET', 'Finite command budget exhausted with original state retained');
    const current = actions().find(a => same(a.command, action.command));
    if (!current?.enabled) throw new FiniteStop('PUBLIC_ACTION_UNAVAILABLE', 'The selected exact action is not currently offered and enabled', { requested: action.command, control: current ?? null });
    pendingIntent = { type: 'FOOL', command: structuredClone(current.command) };
    const projectionMs = projectedElapsedMs, applyStarted = Date.now();
    const before = budget(); beforeLast = s; beforeLastCommandCount = commands.length; lastIntent = structuredClone(pendingIntent);
    const activeRuntime = currentRuntime();
    if (activeRuntime) {
      const draft = activeRuntime.prepare(pendingIntent, s.revision);
      try {
        const next = activeRuntime.snapshotDraft(draft);
        activeRuntime.commit(draft);
        s = next;
      } catch (error) { try { activeRuntime.discard(draft); } catch { /* retain the actual action error */ } throw error; }
    } else s = runtime.applySliceIntent(s, pendingIntent);
    commands.push(structuredClone(pendingIntent)); pendingIntent = null;
    const applyMs = Date.now() - applyStarted;
    assert.equal(s.revision, before.revision + 1, 'A public action must actually commit once'); invariant();
    const event = s.fool.journal.at(-1);
    const row = { commandCount: commands.length, phase, intent: lastIntent, publicControl: { id: current.id, label: current.label, cost: current.cost, enabled: true }, before, after: budget(),
      journalEventId: event?.revision === s.revision ? event.id : null };
    commandRows.push(row);
    if (key) mark(key);
    persistAction(row, { projectionMs, applyMs, startedAt });
    const progress = { time: new Date().toISOString(), projectionMs, applyMs, commandCount: commands.length, newCommands: commands.length - PREFIX_COUNT, phase, operation: commandKind(lastIntent.command), elapsedMs: Date.now() - startedAt, revision: s.revision, week: s.week, status: s.status };
    if (replayVerified && !replaying) {
      writeFileSync(join(outputDir, 'active-progress.json'), JSON.stringify(progress));
      console.log(JSON.stringify(progress));
    }
    pauseAtDurableBoundary();
    if (s.status !== 'ACTIVE') { mark(`actual-terminal-${commands.length}`); throw new ActualTerminal(`Actual ${s.status}; no resurrection or continuation`); }
  }
  function act(command, key = null) {
    const action = offered(command);
    if (!action?.enabled) throw new FiniteStop('PUBLIC_ACTION_UNAVAILABLE', 'The required real action is unavailable', { command, control: action ?? null, public: view() });
    go(action, key);
  }
  function doKind(type, key = null) {
    const action = actions().find(a => a.enabled && commandKind(a.command) === type);
    if (!action) throw new FiniteStop('PUBLIC_KIND_UNAVAILABLE', `No enabled public ${type}`, { actions: actions() });
    go(action, key);
  }
  function returnBase() {
    if (s.fool.atFate) act({ type: 'LEAVE_FATE' });
    const cancel = actions().find(a => a.enabled && commandKind(a.command) === 'FOG.CANCEL_CIRCUIT');
    if (cancel) go(cancel);
    if (s.fool.frame.location !== 'base') act({ type: 'FOG', command: { type: 'TRAVEL', to: 'base' } });
    assert.equal(s.fool.frame.location, 'base');
  }
  function ready(needs = {}) {
    returnBase();
    const n = { ap: 1, cash: 0, health: 85, mind: 80, spirituality: 24, pollution: 20, afterWeek: -1, ...needs };
    assert(n.ap >= 0 && n.ap <= 4 && n.health <= 100 && n.mind <= 100 && n.spirituality <= 120 && n.pollution >= 0);
    const goodBody = () => s.health >= n.health && s.mind >= n.mind && s.spirituality >= n.spirituality && s.seer.pollution <= n.pollution;
    const enough = () => goodBody() && s.actionsRemaining >= n.ap && s.cash >= n.cash + 24 && s.week > n.afterWeek;
    for (let count = 0; !enough(); count++) {
      if (count >= STRATEGY.receptionActionsPerNeed || receptionActions >= STRATEGY.receptionActionsTotal) throw new FiniteStop('FINITE_RECEPTION_BUDGET', 'Real work/rest/week budget exhausted for this specific need', { needs: n, budget: budget(), count, receptionActions });
      let type;
      if (!s.actionsRemaining) type = s.cash < 24 ? 'RECEPTION_WORK' : 'RECEPTION_NEXT_WEEK';
      else if (s.cash < n.cash + 24 || !goodBody() && s.cash < 32) type = 'RECEPTION_WORK';
      else if (!goodBody()) type = 'RECEPTION_REST';
      else type = 'RECEPTION_WORK'; // Spend actual AP for a real later week / sufficient fresh AP.
      act({ type }); receptionActions++;
    }
  }
  function material(type, itemId, needs, key) {
    const command = { type: 'MATERIAL', command: { type, ...(itemId ? { itemId } : {}) } };
    ready(needs); act(command, key);
  }
  function obtainMaterials() {
    phase = 'PAID_SAME_ORIGINAL_MATERIALS'; returnBase();
    // Do all five actual labour tasks before the reduced 90-penny handoff.
    const supplier = s.fool.materials.items.find(i => i.disposition === 'SUPPLIER');
    if (supplier) {
      for (let step = supplier.supplierWork.length; step < 5; step++) material('SUPPLIER_WORK', supplier.id, {}, `supplier-real-work-${step + 1}`);
      material('SUPPLIER_HANDOFF', supplier.id, { cash: 90 }, 'third-original-paid-handoff');
    }
    const unique = s.fool.materials.items.find(i => i.kind === 'UNIQUENESS');
    if (unique.disposition === 'SEALED_EXTERNAL') {
      if (!unique.sealInspectedRecordId) material('INSPECT_UNIQUENESS', null, { cash: 80 }, 'uniqueness-independent-custody-inspected');
      material('TAKE_UNIQUENESS', null, { cash: 120 }, 'same-uniqueness-actually-received');
    }
    // Item order matches the public next-original selector; no fabricated source.
    for (const id of s.fool.materials.items.map(i => i.id)) {
      for (;;) {
        const item = s.fool.materials.items.find(i => i.id === id);
        if (['PLAYER_HELD', 'INTEGRATED_PLAYER'].includes(item.disposition)) break;
        const type = ({ UNLOCATED_REJECTION: 'TRACE_REJECTION', RESIDUE_LOCATED: 'EXTRACT_RESIDUE', PLAYER_DIRTY: 'SEAL_RESIDUE', LEGACY_HELD: 'TRANSFER_INHERITED', LEGACY_BOTTLED: 'TRANSFER_INHERITED' })[item.disposition];
        if (!type) throw new FiniteStop('ORIGINAL_MATERIAL_UNAVAILABLE', 'No approved recovery for this actual original disposition', { id, disposition: item.disposition });
        const attemptKey = `${id}:${type}`, attempt = (materialAttempts.get(attemptKey) ?? 0) + 1;
        if (attempt > STRATEGY.materialAttemptsPerOriginalAndOperation) throw new FiniteStop('FINITE_ORIGINAL_RECOVERY_EXHAUSTED', 'Three paid attempts for this original operation failed; no source replacement or refund', { id, type });
        const costs = runtime.FOOL_MATERIAL_COSTS[type];
        const destination = ['TRACE_REJECTION', 'EXTRACT_RESIDUE'].includes(type) ? item.locationId ?? item.lastKnownLocationId : 'base';
        if (!['base', 'new-alder-clearing'].includes(destination)) throw new FiniteStop('MATERIAL_ROUTE_NOT_PUBLIC', 'The original residue has no currently implemented public route', { id, destination });
        ready({ ap: destination === 'base' ? 1 : 2, cash: costs.cash, spirituality: Math.max(24, costs.spirituality), afterWeek: type === 'SEAL_RESIDUE' ? item.treatmentWeek : -1 });
        if (destination !== 'base') act({ type: 'FOG', command: { type: 'TRAVEL', to: destination } });
        materialAttempts.set(attemptKey, attempt);
        act({ type: 'MATERIAL', command: { type, itemId: id } }, `material-${s.fool.materials.compounds.length}-${id}-${type}-${attempt}`);
      }
    }
    returnBase();
    material('PREPARE_COMPOUND', null, { cash: 240, spirituality: 30 }, `same-original-compound-${s.fool.materials.compounds.length + 1}-prepared`);
    assert.equal(s.fool.materials.compounds.filter(c => c.status === 'PREPARED').length, 1);
  }
  function currentFate() { const f = s.fool.fate; return f.currentCaseId ? f.cases[f.currentCaseId].state : null; }
  function fateVerified() {
    // Read-only replay/evaluation from the central authentic receipt chain.
    return runtime.evaluateFoolFateRitual(s.fool.fate, runtime.foolFateAuthority(s.fool, s.fool.journal.flatMap(e => e.fateReceipts)));
  }
  function solveFate() {
    phase = 'THREE_PREEXISTING_ORIGINAL_FATE_COMMISSIONS';
    for (let ordinal = 1; ordinal <= STRATEGY.fateCommissions; ordinal++) {
      ready({ ap: 3, cash: 16, health: 100, mind: 100, spirituality: 40, pollution: 0 });
      act({ type: 'ENTER_FATE' }, `fate-${ordinal}-same-originals-entered`);
      let attemptedGraft = false;
      for (let n = 0; currentFate().phase !== 'CLOSED'; n++) {
        if (n >= STRATEGY.fateCommandsPerCommission) throw new FiniteStop('FINITE_FATE_ACTIONS', 'The current original commission did not settle within its bounded procedure', { ordinal });
        const list = actions();
        let a = list.find(a => a.enabled && a.preferredAction && a.command.type === 'FATE');
        if (attemptedGraft && list.some(a => a.preferredAction && commandKind(a.command) === 'FATE.GRAFT')) {
          // A failed cast offers GRAFT again. Do not loop it or create new luck;
          // use the actual ordinary escape and let its outstanding bell occur.
          a = list.find(a => a.enabled && commandKind(a.command) === 'FATE.WITHDRAW');
        }
        if (!a) throw new FiniteStop('FATE_PUBLIC_RECOVERY_UNAVAILABLE', 'The current case has no enabled public next step or ordinary withdrawal', { ordinal, actions: list });
        const kind = commandKind(a.command);
        if (kind === 'FATE.GRAFT') { attemptedGraft = true; mark(`fate-${ordinal}-before-one-graft`); }
        go(a, kind === 'FATE.GRAFT' ? `fate-${ordinal}-actual-graft` : kind === 'FATE.WITHDRAW' ? `fate-${ordinal}-ordinary-withdrawal-with-bell` : kind === 'FATE.ARRIVE_AND_VERIFY' ? `fate-${ordinal}-original-arrival-verified` : null);
      }
      mark(`fate-${ordinal}-settled`);
      const proof = fateVerified();
      act({ type: 'LEAVE_FATE' }, `fate-${ordinal}-actual-return`);
      if (proof) { observations.push({ kind: 'VERIFIED_FATE_CAUSAL_PROOF', commandCount: commands.length, proof }); return; }
      const next = actions().find(a => a.command.type === 'FATE' && a.command.command.type === 'INVESTIGATE_RECOVERY');
      if (!next || ordinal === STRATEGY.fateCommissions) throw new FiniteStop('THREE_ORIGINAL_COMMISSIONS_EXHAUSTED', 'The finite original commissions did not verify fate; no fourth case exists');
      const target = next.command.command.commissionId;
      ready({ ap: 0, cash: 18, health: 100, mind: 100, spirituality: 40, pollution: 0 });
      act({ type: 'FATE', command: { type: 'INVESTIGATE_RECOVERY', commissionId: target } }, `fate-${ordinal + 1}-paid-investigation`);
      const investigatedWeek = s.week;
      ready({ ap: 3, cash: 16, health: 100, mind: 100, spirituality: 40, pollution: 0, afterWeek: investigatedWeek });
      act({ type: 'FATE', command: { type: 'VERIFY_RECOVERY', commissionId: target } }, `fate-${ordinal + 1}-later-week-independent-originals`);
    }
  }
  function prepareStations() {
    phase = 'FOUR_PAID_ORIGINAL_STATIONS';
    for (const stationId of STATIONS) {
      for (let visit = 1; visit <= STRATEGY.stationVisitsPerStation; visit++) {
        const local = s.fool.fog.corridors.filter(c => c.stationId === stationId);
        if (local.every(c => c.proofAttemptId)) break;
        const lastAttempt = Math.max(-1, ...local.filter(c => !c.proofAttemptId).map(c => c.lastAttemptWeek ?? -1));
        ready({ ap: 4, cash: 56, mind: 100, spirituality: 120, pollution: 0, afterWeek: lastAttempt });
        for (const type of ['BUY_ANCHOR_KIT', 'BUY_MAINTENANCE']) {
          const a = offered({ type: 'FOG', command: { type, stationId } });
          if (a) { if (!a.enabled) throw new FiniteStop('FOG_PURCHASE_BLOCKED', 'Actual original pack is not available', a); go(a); }
        }
        act({ type: 'FOG', command: { type: 'TRAVEL', to: stationId } });
        const unload = offered({ type: 'FOG', command: { type: 'DELIVER_STATION', stationId } });
        if (unload?.enabled) go(unload);
        act({ type: 'FOG', command: { type: 'PREPARE_STATION', stationId } }, `station-${stationId}-paid-real-attempt-${visit}`);
        returnBase();
        if (s.fool.fog.corridors.filter(c => c.stationId === stationId).every(c => c.proofAttemptId)) break;
        if (visit === STRATEGY.stationVisitsPerStation) throw new FiniteStop('FINITE_STATION_PREPARATION_EXHAUSTED', 'Three paid visits left an original corridor unprepared; retain its actual trapped worm and damaged anchor', { stationId });
      }
    }
    mark('sixteen-original-corridors-prepared');
  }
  function maintenanceDelivery() {
    // A failed potion consumed the four maintenance packs, but never destroys or
    // resets all sixteen prepared originals. Deliver exactly the newly offered
    // paid packs; the same physical worms/anchors remain at their old endpoints.
    for (const stationId of STATIONS) {
      const existing = s.fool.fog.items.some(i => i.stationId === stationId && i.kind === 'MAINTENANCE' && i.condition === 'INTACT' && i.location.kind === 'STATION');
      if (existing) continue;
      ready({ ap: 1, cash: 8, mind: 100, spirituality: 120, pollution: 0 });
      act({ type: 'FOG', command: { type: 'BUY_MAINTENANCE', stationId } });
      act({ type: 'FOG', command: { type: 'TRAVEL', to: stationId } });
      act({ type: 'FOG', command: { type: 'DELIVER_STATION', stationId } }, `maintenance-${s.fool.materials.compounds.length}-${stationId}-delivered`);
      returnBase();
    }
  }
  function consume() {
    phase = 'FOCUSED_FOUR_STATION_CIRCUIT_AND_REAL_POTION';
    const attempt = s.fool.materials.compounds.length;
    const previousCircuitWeek = Math.max(-1, ...s.fool.fog.circuits.map(c => c.week));
    ready({ ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: previousCircuitWeek });
    act({ type: 'FOG', command: { type: 'START_CIRCUIT' } }, `potion-${attempt}-circuit-started`);
    for (let n = 0; n < STRATEGY.circuitCommandsPerAttempt; n++) {
      const a = actions().find(a => a.enabled && a.preferredAction);
      if (!a || !['FOG', 'CONSUME'].includes(a.command.type)) throw new FiniteStop('FOG_WINDOW_OR_CONSUMPTION_BLOCKED', 'The real common window or required potion action is unavailable', { actions: actions() });
      if (a.command.type === 'CONSUME') {
        const projection = view();
        observations.push({ kind: 'FOG_AT_POTION_START', attempt, commandCount: commands.length, section: projection.sections.find(s => s.id === 'fog'),
          actualUnits: runtime.controlUnits(s.fool.fog, runtime.foolFogHost(s.fool)), denominator: 4096, originalWormIds: s.fool.fog.worms.map(w => w.id) });
        mark(`potion-${attempt}-before-full-sixty-seconds`); go(a, `potion-${attempt}-actual-consumption`); return;
      }
      go(a);
    }
    throw new FiniteStop('FINITE_CIRCUIT_ROUTE', 'The finite four-station route did not reach a consumable original bottle');
  }
  function escape() {
    phase = 'FINITE_ORIGINAL_VAULT_ESCAPE';
    ready({ ap: 3, health: 100, mind: 100, spirituality: 48, pollution: 0 });
    act({ type: 'START_ESCAPE' }, 'escape-original-people-door-and-objects');
    doKind('ESCAPE.OPEN_DOOR');
    doKind('ESCAPE.MOMENTARY_BLINDNESS', 'escape-actual-blindness-attempt');
    doKind('ESCAPE.WALK', 'escape-first-actual-crossing');
    if (s.fool.escape.scene.status === 'ACTIVE' && actions().some(a => a.enabled && commandKind(a.command) === 'ESCAPE.PRIOR_PLACE')) {
      doKind('ESCAPE.PRIOR_PLACE', 'escape-actual-prior-place-attempt');
      doKind('ESCAPE.WALK', 'escape-second-actual-crossing');
    }
    if (s.fool.escape.scene.status === 'ACTIVE') doKind('ESCAPE.WITHDRAW', 'escape-ordinary-retreat-after-real-failure');
    doKind('ESCAPE.REPORT', 'escape-reported-actual-applications-only');
    assert(s.fool.escape.scene.reported); assert(s.fool.escape.journal.length <= STRATEGY.escapeCommands);
  }
  function buildReport(stage, error) {
    const f = s.fool, j = f.journal ?? [], materials = f.materials, fog = f.fog;
    const costs = {};
    for (const row of commandRows) {
      const key = commandKind(row.intent.command); costs[key] ??= { count: 0, cashPaid: 0, cashEarned: 0, actionsUsed: 0, spiritualityUsed: 0, mindUsed: 0 };
      const c = costs[key]; c.count++; c.cashPaid += Math.max(0, row.before.cash - row.after.cash); c.cashEarned += Math.max(0, row.after.cash - row.before.cash);
      c.actionsUsed += Math.max(0, row.before.actions - row.after.actions); c.spiritualityUsed += Math.max(0, row.before.spirituality - row.after.spirituality); c.mindUsed += Math.max(0, row.before.mind - row.after.mind);
    }
    const potions = j.filter(e => e.consumption).map(e => ({ commandCount: PREFIX_COUNT + 1 + j.indexOf(e) + 1, eventId: e.id, compoundId: e.consumption.compoundId, outcome: e.consumption.outcome,
      check: e.randomReceipts.find(r => r.kind === 'CHECK')?.check ?? null, before: e.before.budget, after: e.after.budget, materialIds: e.consumption.sourceMaterialIds, uniquenessId: e.consumption.uniquenessId,
      consumptionInterval: fog?.consumptionIntervals.find(i => i.startSecond === e.before.nowSecond) ?? null }));
    const fateCases = f.fate ? Object.values(f.fate.cases).map(({ state: c }) => ({ id: c.instance.id, commissionId: c.instance.initial.commissionId, phase: c.phase,
      originals: c.instance.initial.originals, binding: c.instance.initial.binding, finalScene: c.scene,
      causalEvents: c.journal.filter(e => ['BINDING_CREATED', 'ORIGINALS_INSPECTED', 'ORDINARY_INTERVENTION_ACTUALLY_PURSUED', 'CONSTRAINT_SEALED', 'ENDPOINTS_PREPARED', 'DEPARTURE_CLOCK_FIXED', 'TRANSIT', 'SOURCE_ACTIVATED', 'GRAFT_PAID_AND_CAST', 'GRAFT_FAILED', 'THIRD_BELL', 'FORCE_DELIVERED_TO_WELL', 'ORIGINAL_TARGET_INSPECTED', 'ORIGINALS_ARRIVED_AND_HANDED_OVER', 'ORIGINAL_STRUCTURE_BROKEN', 'ORDINARY_WITHDRAWAL'].includes(e.type)) })) : [];
    return { stage, error: error ? { name: error.name, code: error.code ?? null, message: error.message, detail: error.detail ?? null } : null, phase,
      prefixCount: PREFIX_COUNT, commands: commands.length, newCommands: commands.length - PREFIX_COUNT, final: budget(),
      original: { rawInitialCommandCount: old.prefixCount, sourceCash: old.final.cash, sourceCursor: old.final.random.cursor, sourceSeed: old.seed, masteredAbilities: Object.keys(old.final.progression.mastery).length,
        currentOriginalMasteries: Object.fromEntries(Object.keys(old.final.progression.mastery).map(id => [id, s.progression.mastery[id]])), revivalPreserved: same(s.miracleWorker.revival, old.final.miracleWorker.revival), frozenHistoryDigest: frozenHistory },
      potions: { prepared: materials?.compounds.length ?? 0, consumed: potions.length, succeeded: potions.filter(p => p.outcome === 'SUCCESS').length, failed: potions.filter(p => p.outcome === 'FAILURE').length, attempts: potions },
      materials: materials ? { origins: materials.items.map(i => ({ id: i.id, sourceBatchId: i.sourceBatchId, legacySourceId: i.legacySourceId, disposition: i.disposition, locationId: i.locationId, containerId: i.containerId })), compounds: materials.compounds,
        fees: materials.journal.reduce((n, e) => n + e.cost.cash, 0), transports: materials.journal.filter(e => e.transport).map(e => e.transport) } : null,
      feesAndResourcesByPublicOperation: costs, reception: f.reception, fate: { cases: fateCases, recovery: f.fate?.recovery.journal ?? [], verifiedProofs: observations.filter(o => o.kind === 'VERIFIED_FATE_CAUSAL_PROOF') },
      fog: fog ? { manifestId: fog.manifestId, denominator: 4096, sourceIds: fog.sourceOriginals, originalWorms: fog.worms, attempts: fog.attempts.map(({ traces, ...a }) => ({ ...a, traceCount: traces.length })), circuits: fog.circuits, maintenance: fog.maintenance, consumptionIntervals: fog.consumptionIntervals,
        atPotion: observations.filter(o => o.kind === 'FOG_AT_POTION_START') } : null,
      escape: f.escape ? { status: f.escape.scene.status, reported: f.escape.scene.reported, bodies: f.escape.scene.bodies, objects: f.escape.scene.objects, appliedAbilities: f.escape.scene.appliedAbilities,
        steps: f.escape.journal.map(e => ({ command: e.command, effect: e.effect, check: e.host.check })) } : null,
      boundaries: Object.keys(boundaries), historicalPrefixReplay: 'NOT_RUN_BY_PRODUCER', sqlite: 'NOT_RUN', desktop: 'NOT_RUN' };
  }
  function save(stage, error = null) {
    assert.equal(fileHash(SOURCE), SOURCE_SHA, 'Authoritative raw source must remain byte-for-byte unchanged');
    assert.equal(compactHash(commands.slice(0, PREFIX_COUNT)), PREFIX_SHA);
    let integrityError = null; try { invariant(true); } catch (e) { integrityError = e.message; }
    try {
      const frozenAfter = inspectFreeze();
      if (frozenAfter.sha256 !== freeze.sha256) integrityError = 'Frozen code/compiled/source bytes changed during this run';
      if (resumeProvenance?.runtimeTransition) readRuntimeTransitionEvidence(resumeProvenance.runtimeTransition, freeze);
    } catch (e) { integrityError = `Could not revalidate frozen bytes: ${e.message}`; }
    const report = buildReport(integrityError ? 'ACTUAL_CAPTURE_INTEGRITY_BLOCKER' : stage, error); report.integrityError = integrityError;
    report.resumeProvenance = resumeProvenance;
    write('boundaries.index.json', { format: 'FOOL208_HASHED_COMMAND_BOUNDARIES_V1', source: SOURCE, sourceSha256: SOURCE_SHA, prefixCount: PREFIX_COUNT, originalMigratedStateSha256: originalHash, boundaries });
    // Write endpoint trees only, once: two exact raw originals and the current
    // before/after transaction. Boundary rows never embed full snapshots.
    write('natural.json', { provenance: { kind: 'SAME_SEED_ORIGINAL_FULL1868_PUBLIC_FOOL_CONTINUATION', source: SOURCE, sourceSha256: SOURCE_SHA, sourcePrefixCount: PREFIX_COUNT, sourceCommandsSha256: PREFIX_SHA,
      sourceInitialCommandCount: old.prefixCount, sourceProvenance: old.provenance, initialMeans: 'EXACT_RAW_SOURCE_INITIAL_AT_COMMAND_1856', prefixFinalMeans: 'EXACT_RAW_SOURCE_FINAL_AT_COMMAND_1868', producerPrefixReplay: 'NOT_RUN', migration: 205, freezeSha256: freeze.sha256, strategy: STRATEGY, newRandomChanges: false, resumeProvenance },
      creation: old.creation, seed: old.seed, prefixCount: PREFIX_COUNT, commands, initial: old.initial, prefixFinal: old.final,
      stage: report.stage, phase, error: report.error, beforeLast, beforeLastCommandCount, lastIntent, pendingIntent,
      boundaries, reportFile: 'report.json', final: s });
    write('report.json', report); write('freeze.json', freeze);
    const small = { outputDir, stage: report.stage, commands: commands.length, final: report.final, potions: { prepared: report.potions.prepared, consumed: report.potions.consumed, failed: report.potions.failed, succeeded: report.potions.succeeded }, error: report.error, integrityError };
    console.log(JSON.stringify(small)); return { ...small, report, state: s };
  }
  try {
    mark('original-full1868-migrated-start');
    if (resume) verifyReplayState(0);
    else durableText(join(outputDir, 'states.jsonl'), JSON.stringify(stateRows[0]) + '\n');
    act({ type: 'LEARN_GUIDANCE' }, 'original-guidance-without-resource-or-rng-change');
    obtainMaterials(); solveFate(); prepareStations();
    for (let attempt = 1; attempt <= STRATEGY.potionAttempts; attempt++) {
      if (attempt > 1) { obtainMaterials(); maintenanceDelivery(); }
      consume();
      if (s.progression.sequence === 0) { escape(); return save('NATURAL_FULL1868_FOOL_PROMOTION_AND_FINITE_ESCAPE_COMPLETED'); }
      if (attempt === STRATEGY.potionAttempts) throw new FiniteStop('THREE_REAL_POTIONS_FAILED_ALIVE', 'Three real bottles failed on the unchanged random stream; preserve the living unpromoted result');
      // Reset only attempt accounting for the new real recovery episode. The
      // old material/potion journals, spent ordinary supplies and costs remain.
      materialAttempts.clear();
    }
    throw Error('Unreachable finite policy endpoint');
  } catch (e) {
    if (e instanceof ManualPause) {
      const result = { outputDir, stage: 'MANUAL_PAUSE_DURABLE_ACTION_BOUNDARY', commands: commands.length,
        final: budget(), checkpoint: join(outputDir, 'checkpoint.json'), checkpointSha256: fileHash(join(outputDir, 'checkpoint.json')), pauseFile,
        resumeProvenance, continuation: 'RESUME_CHECKPOINT_BY_EXACT_STRATEGY_REPLAY' };
      durableJsonReplacement(join(outputDir, 'pause.json'), result); console.log(JSON.stringify(result)); return result;
    }
    if (!replayVerified) {
      const result = { outputDir, stage: 'RECONSTRUCTION_BLOCKER_NO_NEW_ACTIONS',
        replayedCommandCount: commands.length, error: { name: e.name, message: e.message }, resumeProvenance };
      write('resume-blocker.json', result); process.exitCode = 1;
      console.log(JSON.stringify(result)); return result;
    }
    const result = save(e instanceof ActualTerminal ? 'NATURAL_ACTUAL_TERMINAL_NO_REVIVAL' : e instanceof FiniteStop ? 'NATURAL_FINITE_POLICY_STOP' : 'ACTUAL_UNEXPECTED_ENGINE_BLOCKER', e);
    if (!(e instanceof ActualTerminal) && !(e instanceof FiniteStop)) process.exitCode = 1;
    return result;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--inspect-source') {
    const old = readSource(); console.log(JSON.stringify({ source: SOURCE, sourceSha256: SOURCE_SHA, prefixCount: PREFIX_COUNT, commandsSha256: PREFIX_SHA, rawInitialCommandCount: old.prefixCount, finalRevision: old.final.revision, seed: old.seed, cursor: old.final.random.cursor, cash: old.final.cash })); return;
  }
  if (args.length === 1 && args[0] === '--inspect-freeze') { console.log(JSON.stringify(inspectFreeze())); return; }
  assert((args.length === 2 || args.length === 4 && ['--resume-original', '--resume-checkpoint', '--resume-transition'].includes(args[2])) && args[0] === '--freeze-sha256' && /^[a-f0-9]{64}$/.test(args[1]), 'Usage: node fool-stage.mjs --inspect-source | --inspect-freeze | --freeze-sha256 REVIEWED_HASH [--resume-original CAPTURE_DIRECTORY | --resume-checkpoint CHECKPOINT_JSON | --resume-transition REVIEWED_TRANSITION_JSON]');
  const freeze = inspectFreeze(); assert.equal(freeze.sha256, args[1], 'Review/freeze exactly these mechanics, compiled modules and runner before play');
  const resume = args[2] === '--resume-original' ? readOriginalResume(args[3]) : args[2] === '--resume-checkpoint' ? readCheckpointResume(args[3], freeze) : args[2] === '--resume-transition' ? readTransitionResume(args[3], freeze) : null;
  const old = readSource(), runtime = await loadRuntime();
  mkdirSync('output/play', { recursive: true }); const outputDir = mkdtempSync('output/play/fool-02080-');
  console.log(JSON.stringify({ outputDir, pauseFile: join(outputDir, 'PAUSE_REQUESTED'),
    replayRows: resume?.rows.length ?? 0, currentRuntimeFreezeSha256: freeze.sha256 }));
  runNatural(runtime, old, { outputDir, freeze, resume });
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();

export function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START';
  let key = '', selected = false, quoted = false, escaped = false, depth = 0;
  let kind = 'PRIMITIVE';
  const pieces = [];
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null);
      const text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let captureStart = selected && phase === 'VALUE' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (phase === 'START') { if (/\s/.test(c)) continue; if (c !== '{') throw new Error('Expected a top-level JSON object'); phase = 'KEY'; continue; }
        if (phase === 'KEY' || phase === 'AFTER') {
          if (/\s/.test(c) || c === ',') continue;
          if (c === '}') throw new Error(`Missing JSON object entry: ${wanted}`);
          if (c !== '"') throw new Error('Expected a JSON property name');
          key = '"'; escaped = false; phase = 'KEY_STRING'; continue;
        }
        if (phase === 'KEY_STRING') {
          key += c;
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
          else if (c === '"') { selected = JSON.parse(key) === wanted; phase = 'COLON'; }
          continue;
        }
        if (phase === 'COLON') { if (/\s/.test(c)) continue; if (c !== ':') throw new Error('Expected JSON colon'); phase = 'VALUE_START'; continue; }
        if (phase === 'VALUE_START') {
          if (/\s/.test(c)) continue;
          if (selected) captureStart = i;
          depth = 0; quoted = false; escaped = false;
          kind = c === '{' || c === '[' ? 'CONTAINER' : c === '"' ? 'STRING' : 'PRIMITIVE'; phase = 'VALUE';
        }
        if (phase === 'VALUE') {
          let done = false, end = i + 1;
          if (quoted) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; }
          } else if (c === '"') quoted = true;
          else if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
          else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
          if (done) {
            if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); }
            phase = 'AFTER'; selected = false; captureStart = -1;
          }
        }
      }
      if (captureStart >= 0) pieces.push(text.slice(captureStart));
      if (!n) break;
    }
  } finally { closeSync(fd); }
  throw new Error(`Missing JSON object entry: ${wanted}`);
}
