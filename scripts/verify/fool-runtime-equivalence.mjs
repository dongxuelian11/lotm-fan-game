import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Private, explicit audit only. Importing this module neither loads the game nor
// writes files. It does not alter or supplement the historical capture.
// Run private first, then public with the SAME supplied final-runtime freeze.
// Public mode independently repeats the private replay. Resume replays from the
// authentic root, skips only externally hash-pinned completed public checks,
// and never persists another whole-state snapshot.
const SELF = fileURLToPath(import.meta.url);
const FORMAT = 'FOOL208_OWNED_RUNTIME_EQUIVALENCE_V1';
const SOURCE = 'tests/fixtures/attendant-mysteries-v01860/natural-battle.json';
const FIXTURE = 'tests/fixtures/fool-v02080';
const PRODUCER = 'scripts/play/fool-stage.mjs';
const BASELINE = 'output/qa-0208/owned-runtime/baseline-terminal.json';
const CAPTURE_FREEZE = '01aaf426597581a0023ff659f00e54be6b27b35163038291c6e30000de8fcfdf';
const CAPTURE_PRODUCER = 'd8b99e799ab6d3ca46da7b522fdbfd30146b874dfcb78f02d030f149b1052ae4';
const PREFIX_HASH = 'b4e076eaca66ac3edd38a20a338e96d833a22a29ed48bcd0f42d7a950693de17';
const TAIL_HASH = '1f09c4c0f1c18d34b7dd76bc3aa221d518062537f54e73f8521280d52d5b8340';
const FINAL_HASH = '66b91d08d03b564d4e19d8acb8bcd47ead3233da1ba39561bc3d8945ca998d8a';
const FINAL_PUBLIC = 'ec688e8e9b558e8f2746fe1de94398a66dee887e454f867204f90119eda04561';
const PAUSED_PUBLIC = 'b7aefa32cb51899969d44f5565392ed50d40536b0fde3cde8182877ea9f436f9';
const SEED = 'seer-rebuild-first';
const PINNED_INPUTS = [
  ['natural.json', 37252637, '8bc3141286c3ecb603410d36c4f2111ea28b3a423b6f28c44127ef16aaf72959'],
  ['commands.jsonl', 183428, '479b9392dd928a3b5508541549e659ea87d7442c198bd92a34521df668c2a9f4'],
  ['states.jsonl', 28338, 'b72037d8bccf5f2c3bf38b361c79a1ef612c6d4618a5f5caad78f845047cdc46'],
  ['boundaries.index.json', 29432, '6dbb7c177bfcd665b2122cc3744e257db45f43f341166599f19f641efea0f669'],
  ['report.json', 67146, '0b7577b6d9343218288b69f9039a57386d48935d28b57bd2b4e8515f4c9c3955'],
  ['freeze.json', 544257, 'f0fe8a831fb2c4f68db3f9f8c610e5177ee75c6402556e1a6b8a5b4538fb1979'],
  ['runtime-transition.json', 1106614, '32efef5fcf1b49cd01f22ec9d04ffe0e8c9e0da534f2dfc8f3c6992febd6d26f'],
  ['resume-original/interruption.json', 2204, '04d80eeded74a63642e27941ee764b1ed1958f7397f9545c38abe8c86a96f048'],
  ['resume-original/terminated-commands.jsonl', 36122, '09ba77d6c0edde3b6df7f0a26c625808bef3b0ca20b01d173c32d420756604b1'],
  ['resume-original/freeze-before-natural.json', 544258, 'cb10464dcbdb5ff36ec26c4e5f4cf6db79d29e50ba510ae43d4215c1130d6689'],
  ['resume-original/baseline/summary.json', 848, '475e33e9f5de0b1e075bacd6ff233a506005bcd866c2a5881eed568848baf8ae'],
  ['resume-original/baseline/states.jsonl', 22268, '80bcbdde0ed4f4476420e8d156b2f34258981404712e1b24c32ce5d2e55c3853'],
].map(([file, bytes, sha256]) => ({ file, bytes, sha256 }));
const FROZEN_ROOTS = ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const compactHash = value => sha(JSON.stringify(value));
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const stateHash = value => sha(stable(value));
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const keys = (value, expected, label) => {
  assert(value && typeof value === 'object' && !Array.isArray(value), label);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
};
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const regular = path => {
  assert.equal(realpathSync(path), resolve(path), `No symlink inputs or outputs: ${path}`);
  assert(lstatSync(path).isFile(), `Expected regular file: ${path}`); return path;
};
const evidence = path => {
  const bytes = readFileSync(regular(path));
  assert.equal(bytes.length, lstatSync(path).size, `Input changed while reading: ${path}`);
  return { bytes: bytes.length, sha256: sha(bytes) };
};
function filesIn(root, base = root) {
  assert.equal(realpathSync(root), resolve(root), `No frozen symlinks: ${root}`);
  if (lstatSync(root).isFile()) return [relative(base, root).split(sep).join('/')];
  assert(lstatSync(root).isDirectory());
  return readdirSync(root).sort().flatMap(name => filesIn(join(root, name), base));
}
export function assertRuntimeFreeze(freeze, expectedSha256, actualRows) {
  keys(freeze, ['sha256', 'files'], 'Complete final-runtime freeze');
  assert(digest(expectedSha256)); assert.equal(freeze.sha256, expectedSha256);
  assert(Array.isArray(freeze.files) && freeze.files.length > 0);
  const paths = new Set();
  for (const row of freeze.files) {
    keys(row, ['file', 'bytes', 'sha256'], 'Frozen file');
    assert(typeof row.file === 'string' && row.file.length > 0 && !paths.has(row.file)); paths.add(row.file);
    assert(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && digest(row.sha256));
  }
  assert.equal(compactHash(freeze.files), freeze.sha256, 'Freeze digest binds the exact ordered file inventory');
  assert.deepEqual(actualRows, freeze.files, 'Final runtime, compiled files, producer or input drifted');
}
function inspectRuntime(repo) {
  const paths = FROZEN_ROOTS.flatMap(name => filesIn(join(repo, name), repo));
  return [...paths.map(file => ({ file, ...evidence(join(repo, file)) })),
    { file: '$natural-runner', ...evidence(join(repo, PRODUCER)) }, { file: SOURCE, ...evidence(join(repo, SOURCE)) }];
}
export function completeRows(text) {
  assert(typeof text === 'string' && text.length > 0 && text.endsWith('\n'), 'Complete JSONL requires final newline');
  return text.slice(0, -1).split('\n').map(line => { assert(line.length > 0, 'No blank JSONL rows'); return JSON.parse(line); });
}
export function budget(state) {
  return { revision: state.revision, week: state.week, date: state.date, status: state.status, sequence: state.progression.sequence,
    health: state.health, mind: state.mind, spirituality: state.spirituality, cash: state.cash, actions: state.actionsRemaining,
    pollution: state.seer.pollution, cursor: state.random.cursor, second: state.fool.frame?.nowSecond ?? null, location: state.fool.frame?.location ?? 'base' };
}
export function assertCaptureShape(states, rows, commands) {
  assert.equal(commands.length, 2083); assert.equal(rows.length, 215); assert.equal(states.length, 216);
  assert.equal(compactHash(commands.slice(0, 1868)), PREFIX_HASH);
  assert.equal(compactHash(commands.slice(1868)), TAIL_HASH);
  for (const [index, state] of states.entries()) {
    keys(state, ['index', 'commandCount', 'stateSha256', ...(index < 44 ? ['publicSha256'] : [])], 'Original captured state evidence');
    assert.equal(state.index, index); assert.equal(state.commandCount, 1868 + index); assert(digest(state.stateSha256));
    if (index < 44) assert(digest(state.publicSha256));
    if (index === 0) continue;
    const row = rows[index - 1];
    keys(row, ['commandCount', 'phase', 'intent', 'publicControl', 'before', 'after', 'journalEventId'], 'Original completed command');
    assert.equal(row.commandCount, state.commandCount); assert.deepEqual(row.intent, commands[state.commandCount - 1]); assert.equal(row.intent.type, 'FOOL');
    assert.equal(row.before.revision, state.commandCount); assert.equal(row.after.revision, state.commandCount + 1);
    if (index > 1) assert.deepEqual(row.before, rows[index - 2].after, 'Recorded budgets form one continuous chain');
  }
  assert.equal(states.at(-1).stateSha256, FINAL_HASH);
}
export function recordedPublicEvidence(index, states) {
  if (index < 44) return { kind: 'ORIGINAL_RECONSTRUCTED_44', sha256: states[index].publicSha256 };
  if (index === 1936 - 1868) return { kind: 'SEPARATE_PAUSED_1936_BASELINE', sha256: PAUSED_PUBLIC };
  if (index === 215) return { kind: 'SEPARATE_TERMINAL_2083_BASELINE', sha256: FINAL_PUBLIC };
  return null;
}
export function assertProof(proof, manifestSha256, mode, states, priorPublic = null) {
  assert(['private', 'public', 'redaction'].includes(mode));
  if (mode === 'redaction') assert.equal(priorPublic?.rows.length, 216, 'Redaction mode requires the externally pinned complete old public proof'); assert(digest(manifestSha256));
  keys(proof, ['format', 'manifestSha256', 'mode', 'rows'], 'Exact resume proof');
  assert.equal(proof.format, FORMAT); assert.equal(proof.manifestSha256, manifestSha256); assert.equal(proof.mode, mode);
  assert(Array.isArray(proof.rows) && proof.rows.length <= 216);
  for (const [index, row] of proof.rows.entries()) {
    keys(row, ['index', 'commandCount', 'stateSha256', 'budgetSha256', 'random', 'eventSha256', 'public'], 'Completed proof row');
    assert.equal(row.index, index); assert.equal(row.commandCount, 1868 + index); assert.equal(row.stateSha256, states[index].stateSha256);
    assert(digest(row.budgetSha256)); keys(row.random, ['seed', 'cursor'], 'Random evidence'); assert.equal(row.random.seed, SEED); assert(Number.isSafeInteger(row.random.cursor) && row.random.cursor >= 0);
    assert(index < 2 ? row.eventSha256 === null : digest(row.eventSha256));
    if (mode === 'private') { assert.equal(row.public, null); continue; }
    if (mode === 'redaction') {
      keys(row.public, ['currentSha256', 'sessionSha256', 'strictSha256', 'legacySha256', 'recorded'], 'Separate current-safe and restored historical public hashes');
      assert(digest(row.public.currentSha256));
      assert.equal(row.public.sessionSha256, index === 0 ? null : row.public.currentSha256);
      assert.equal(row.public.strictSha256, [0, 1, 215].includes(index) ? row.public.currentSha256 : null, 'Only initial/guidance/terminal strict checks were rerun');
      assert.equal(row.public.legacySha256, priorPublic.rows[index].public.strictSha256);
      assert.deepEqual(row.public.recorded, recordedPublicEvidence(index, states));
      if (row.public.recorded) assert.equal(row.public.legacySha256, row.public.recorded.sha256);
      const { public: ignored, ...privateRow } = row, { public: priorIgnored, ...priorRow } = priorPublic.rows[index];
      assert.deepEqual(privateRow, priorRow, 'All 216 private hashes, budgets, RNG and event receipts still equal the completed old public run');
      continue;
    }
    keys(row.public, ['strictSha256', 'sessionSha256', 'recorded'], 'Separate current and historical public proof');
    assert(digest(row.public.strictSha256));
    if (index === 0) assert.equal(row.public.sessionSha256, null, 'No session before guidance');
    else assert.equal(row.public.sessionSha256, row.public.strictSha256, 'Current strict and owned projections must match');
    assert.deepEqual(row.public.recorded, recordedPublicEvidence(index, states));
    if (row.public.recorded) assert.equal(row.public.strictSha256, row.public.recorded.sha256);
  }
}
export function assertRecordedTransition(runtime, before, after, row, expectedEvent) {
  assert.deepEqual(budget(before), row.before); assert.deepEqual(budget(after), row.after);
  assert.equal(after.revision, before.revision + 1); assert.equal(after.runId, before.runId);
  assert.equal(before.status, 'ACTIVE'); assert.equal(after.random.seed, before.random.seed);
  if (row.intent.command.type === 'LEARN_GUIDANCE') {
    assert.deepEqual(after.random, before.random); assert.equal(after.fool.journal.length, 0); assert.equal(row.journalEventId, null); assert.equal(expectedEvent, null); return null;
  }
  assert.equal(after.fool.journal.length, before.fool.journal.length + 1);
  const event = after.fool.journal.at(-1);
  assert.deepEqual(event, expectedEvent, 'Entire event, host/proof/check receipts and budget frames match the captured final journal');
  assert.equal(event.id, row.journalEventId); assert.equal(event.revision, after.revision); assert.deepEqual(event.command, row.intent.command);
  assert.deepEqual(event.before.random, before.random); assert.deepEqual(event.after.random, after.random);
  const stream = new runtime.DeterministicActionRandomStream(before.random.seed, before.random.cursor);
  for (const receipt of event.randomReceipts) {
    assert.equal(receipt.cursorBefore, stream.cursor);
    if (receipt.kind === 'CHECK') assert.equal(receipt.check.roll, stream.nextInt(1, 100));
    else { assert.equal(receipt.kind, 'ROLL'); assert.equal(receipt.value, stream.nextInt(receipt.min, receipt.max)); }
    assert.equal(receipt.cursorAfter, stream.cursor);
  }
  assert.equal(stream.cursor, after.random.cursor, 'Every RNG advance has its exact recorded receipt');
  return stateHash(event);
}
const sync = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
function atomic(path, value) {
  if (existsSync(path)) regular(path);
  const temporary = `${path}.next`; if (existsSync(temporary)) regular(temporary);
  writeFileSync(temporary, JSON.stringify(value)); sync(temporary); renameSync(temporary, path); sync(dirname(path));
}
function claim(directory, manifestSha256) {
  const path = join(directory, 'audit.lock.json'), lock = { format: FORMAT, manifestSha256, pid: process.pid };
  if (existsSync(path)) {
    const prior = json(regular(path)); keys(prior, ['format', 'manifestSha256', 'pid'], 'Audit lock');
    assert.equal(prior.format, FORMAT); assert.equal(prior.manifestSha256, manifestSha256); assert(Number.isSafeInteger(prior.pid) && prior.pid > 0);
    let alive = true; try { process.kill(prior.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
    assert.equal(alive, false, 'Audit output already has a live owner'); rmSync(path);
  }
  writeFileSync(path, JSON.stringify(lock), { flag: 'wx' }); sync(path); sync(directory);
  return () => { assert.deepEqual(json(regular(path)), lock); rmSync(path); sync(directory); };
}
export function argumentsForEquivalence(args) {
  const names = { '--mode': 'mode', '--runtime-freeze-file': 'runtimeFreezeFile', '--runtime-freeze-sha256': 'runtimeFreezeSha256', '--verifier-sha256': 'verifierSha256', '--output-directory': 'outputDirectory', '--resume-directory': 'resumeDirectory', '--resume-proof-sha256': 'resumeProofSha256', '--final-runtime-proof': 'finalRuntimeProof', '--final-runtime-proof-sha256': 'finalRuntimeProofSha256', '--public-audit-verifier-sha256': 'publicAuditVerifierSha256' };
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = names[args[i]]; assert(name && !Object.hasOwn(options, name), `Unknown or duplicate option: ${args[i]}`);
    assert(typeof args[i + 1] === 'string' && args[i + 1].length && !args[i + 1].startsWith('--'), `Missing value: ${args[i]}`); options[name] = args[i + 1];
  }
  assert(['private', 'public', 'redaction'].includes(options.mode), 'Explicit --mode private|public|redaction is required');
  if (options.mode === 'redaction') assert(options.finalRuntimeProof && digest(options.finalRuntimeProofSha256) && digest(options.publicAuditVerifierSha256), 'Redaction requires reviewed final proof and exact pure audit-helper verifier hash');
  else assert(!options.finalRuntimeProof && !options.finalRuntimeProofSha256 && !options.publicAuditVerifierSha256, 'Redaction inputs cannot silently change older audit modes');
  assert(options.runtimeFreezeFile && digest(options.runtimeFreezeSha256) && digest(options.verifierSha256), 'Supply reviewed final runtime and verifier pins');
  assert(!(options.outputDirectory && options.resumeDirectory));
  assert.equal(!!options.resumeDirectory, !!options.resumeProofSha256, 'Resume requires the exact externally supplied proof file SHA256');
  if (options.resumeProofSha256) assert(digest(options.resumeProofSha256));
  return options;
}

export async function verifyFoolRuntimeEquivalence(options) {
  // Validate programmatic calls through the same narrow CLI contract.
  const flags = { mode: '--mode', runtimeFreezeFile: '--runtime-freeze-file', runtimeFreezeSha256: '--runtime-freeze-sha256', verifierSha256: '--verifier-sha256', outputDirectory: '--output-directory', resumeDirectory: '--resume-directory', resumeProofSha256: '--resume-proof-sha256', finalRuntimeProof: '--final-runtime-proof', finalRuntimeProofSha256: '--final-runtime-proof-sha256', publicAuditVerifierSha256: '--public-audit-verifier-sha256' };
  options = argumentsForEquivalence(Object.entries(options).flatMap(([name, value]) => { assert(flags[name], `Unknown option: ${name}`); return [flags[name], value]; }));
  assert.notEqual(process.platform, 'win32', 'Private audit requires POSIX directory fsync');
  const repo = realpathSync(process.cwd()); assert.equal(SELF, join(repo, 'scripts/verify/fool-runtime-equivalence.mjs'));
  const fixture = join(repo, FIXTURE), freezePath = resolve(options.runtimeFreezeFile), freeze = json(regular(freezePath));
  const freezeFileEvidence = evidence(freezePath), selfEvidence = evidence(SELF);
  assert.equal(selfEvidence.sha256, options.verifierSha256);
  let redactionInput = null, redactionProof = null, publicAudit = null, publicAuditInput = null, priorPublic = null;
  if (options.mode === 'redaction') {
    const path = regular(resolve(options.finalRuntimeProof)); assert.equal(path, join(fixture, 'final-runtime-proof.json'));
    redactionInput = { path, ...evidence(path) }; assert.equal(redactionInput.sha256, options.finalRuntimeProofSha256);
    redactionProof = json(path);
    const helper = regular(join(repo, 'scripts/verify/fool-save.mjs'));
    publicAuditInput = { path: helper, ...evidence(helper) }; assert.equal(publicAuditInput.sha256, options.publicAuditVerifierSha256);
    publicAudit = await import(pathToFileURL(helper).href);
    assert.deepEqual(evidence(helper), { bytes: publicAuditInput.bytes, sha256: publicAuditInput.sha256 });
  }

  const inputRows = [...PINNED_INPUTS.map(row => ({ file: `${FIXTURE}/${row.file}`, bytes: row.bytes, sha256: row.sha256 })),
    { file: SOURCE, bytes: 19873527, sha256: '31e1b112e8495aece7f3bf8dc0fc63384f90ef4f0fd98aac1b14de645f334ffa' },
    { file: BASELINE, bytes: 962, sha256: 'f977b4eb7ac527c7ad72edfdeb80a22b4eebdfd583f4d9826669440a64976581' }];
  const checkPins = () => {
    assert.deepEqual(filesIn(fixture).sort(), [...PINNED_INPUTS.map(row => row.file), ...(redactionInput ? ['final-runtime-proof.json'] : [])].sort(), 'Exact immutable fixture members');
    for (const input of [redactionInput, publicAuditInput].filter(Boolean)) assert.deepEqual(evidence(input.path), { bytes: input.bytes, sha256: input.sha256 }, 'Reviewed redaction proof/helper cannot drift');
    for (const { file, bytes, sha256 } of inputRows) assert.deepEqual(evidence(join(repo, file)), { bytes, sha256 }, `Immutable input drift: ${file}`);
    assert.deepEqual(evidence(freezePath), freezeFileEvidence); assert.deepEqual(evidence(SELF), selfEvidence);
    assertRuntimeFreeze(freeze, options.runtimeFreezeSha256, inspectRuntime(repo));
  };
  checkPins();
  const historicalFreeze = json(join(fixture, 'freeze.json'));
  assertRuntimeFreeze(historicalFreeze, CAPTURE_FREEZE, historicalFreeze.files);
  assert.equal(historicalFreeze.files.find(row => row.file === '$natural-runner')?.sha256, CAPTURE_PRODUCER);
  // The producer is now authenticated by the final-runtime freeze. Its pure
  // streaming reader avoids repeated whole-capture JSON materialization.
  const { readObjectEntry } = await import(pathToFileURL(join(repo, PRODUCER)).href);
  const read = key => readObjectEntry(join(fixture, 'natural.json'), key);
  const commands = read('commands'), rows = completeRows(readFileSync(join(fixture, 'commands.jsonl'), 'utf8'));
  const states = completeRows(readFileSync(join(fixture, 'states.jsonl'), 'utf8'));
  assertCaptureShape(states, rows, commands);
  if (redactionProof) {
    publicAudit.assertFoolFinalRuntimeProof(redactionProof, historicalFreeze, freeze, [...PINNED_INPUTS].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
    priorPublic = publicAudit.assertFoolPublicRedactionEvidence(redactionProof.publicRedaction, states);
  }
  assert.equal(read('prefixCount'), 1868); assert.equal(read('seed'), SEED); assert.equal(read('pendingIntent'), null); assert.equal(read('error'), null);
  assert.equal(read('stage'), 'NATURAL_FULL1868_FOOL_PROMOTION_AND_FINITE_ESCAPE_COMPLETED');
  assert.deepEqual(read('lastIntent'), commands.at(-1)); assert.equal(read('beforeLastCommandCount'), 2082);
  assert.equal(stateHash(read('beforeLast')), states[214].stateSha256);
  let capturedFinal = read('final'); assert.equal(stateHash(capturedFinal), FINAL_HASH);
  const expectedJournal = capturedFinal.fool.journal, finalBudget = budget(capturedFinal); assert.equal(expectedJournal.length, 214);
  assert.equal(capturedFinal.progression.mastery['diviner.s0.momentary-blindness'], 0); assert.equal(capturedFinal.progression.mastery['diviner.s0.prior-place'], 0);
  capturedFinal = null;
  const baseline = json(join(repo, BASELINE)), transition = json(join(fixture, 'runtime-transition.json'));
  assert.equal(baseline.captureFreeze, CAPTURE_FREEZE); assert.equal(baseline.input, FINAL_HASH); assert.equal(baseline.public, FINAL_PUBLIC);
  assert.equal(transition.checkpoint.finalPublicSha256, PAUSED_PUBLIC);
  const outputRoot = join(repo, 'output/qa-0208/owned-runtime');
  assert.equal(realpathSync(outputRoot), outputRoot);
  let output = options.resumeDirectory ? resolve(options.resumeDirectory) : options.outputDirectory ? resolve(options.outputDirectory) : null;
  if (output) {
    assert.equal(dirname(output), outputRoot, 'Use a distinct direct child of the private owned-runtime audit directory');
    if (options.resumeDirectory) { assert.equal(realpathSync(output), output); assert(lstatSync(output).isDirectory()); }
    else { assert(!existsSync(output), 'Fresh output must not exist'); mkdirSync(output); }
  } else output = mkdtempSync(join(outputRoot, `${options.mode}-`));
  const manifest = { format: FORMAT, mode: options.mode, repo, output, inputs: inputRows,
    captureFreezeSha256: CAPTURE_FREEZE, captureProducerSha256: CAPTURE_PRODUCER,
    finalRuntimeFreeze: { path: freezePath, ...freezeFileEvidence, orderedFilesSha256: freeze.sha256 }, verifier: selfEvidence,
    ...(redactionInput ? { publicRedaction: { finalRuntimeProof: redactionInput, auditHelper: publicAuditInput, previousRuntimeFreezeSha256: redactionProof.publicRedaction.previousRuntimeFreezeSha256, priorPublicProofSha256: redactionProof.publicRedaction.priorPublicProof.sha256, strictRerunCommandCounts: [1868, 1869, 2083] } } : {}),
    node: process.version, versions: process.versions, platform: process.platform, arch: process.arch,
    commands: 215, states: 216, sessionOpensAfterStrictGuidance: true, fullHistoricalPrefixReplay: 'NOT_RUN',
    originalPublicEvidence: '44_RECONSTRUCTED_PLUS_SEPARATE_1936_AND_TERMINAL_BASELINES; NO_ORIGINAL_ALL_STATE_PUBLIC_CAPTURE' };
  const manifestSha256 = stateHash(manifest), manifestPath = join(output, 'manifest.json'), proofPath = join(output, 'proof.json');
  const progressPath = join(output, 'progress.jsonl'); if (existsSync(progressPath)) regular(progressPath);
  const release = claim(output, manifestSha256);
  let proof, completedBefore = 0, count = 1868;
  const log = entry => { const row = { at: new Date().toISOString(), mode: options.mode, ...entry }; appendFileSync(progressPath, `${JSON.stringify(row)}\n`); console.log(JSON.stringify(row)); };
  try {
    if (options.resumeDirectory) {
      assert.deepEqual(json(regular(manifestPath)), manifest, 'Resume cannot change any environment, input or runtime pin');
      assert.equal(evidence(proofPath).sha256, options.resumeProofSha256, 'Exact external resume proof pin');
      proof = json(regular(proofPath)); assertProof(proof, manifestSha256, options.mode, states, priorPublic); completedBefore = proof.rows.length;
    } else {
      writeFileSync(manifestPath, JSON.stringify(manifest), { flag: 'wx' }); sync(manifestPath);
      proof = { format: FORMAT, manifestSha256, mode: options.mode, rows: [] }; atomic(proofPath, proof);
    }
    checkPins();
    const runtime = Object.assign({}, ...await Promise.all(['domain/slice/index', 'domain/slice/migration', 'domain/fool/index', 'domain/fool/owned-session', 'resolution/deterministic-random', ...(priorPublic ? ['shared/player-text'] : [])].map(name => import(pathToFileURL(join(repo, `dist/${name}.js`)).href))));
    let state = runtime.migrateSliceState(read('prefixFinal')); runtime.assertValidSliceState(state);
    assert.equal(state.schemaVersion, 205); assert.equal(state.contentVersion, 'fool-v205'); assert.equal(state.random.seed, SEED);
    let session = null, eventSha256 = null;
    for (let index = 0; index <= 215; index++) {
      count = 1868 + index;
      const privateHash = stateHash(state); assert.equal(privateHash, states[index].stateSha256, `Whole private state at command ${count}`);
      const row = { index, commandCount: count, stateSha256: privateHash, budgetSha256: stateHash(budget(state)), random: { ...state.random }, eventSha256, public: null };
      let fool;
      if (options.mode === 'redaction' && index >= completedBefore) {
        const owned = session ? session.project() : null;
        const strict = [0, 1, 215].includes(index) ? runtime.projectSliceState(state) : null;
        const current = owned ?? strict; assert(current);
        publicAudit.assertFoolPublicProjection(runtime, current, SEED);
        if (strict) { publicAudit.assertFoolPublicProjection(runtime, strict, SEED); if (owned) assert.deepEqual(owned, strict, `Current redacted strict/owned projection at ${count}`); }
        const legacySha256 = stateHash(publicAudit.restoreFoolLegacyPublicProjection(state, current, runtime.projectPlayerText));
        publicAudit.assertFoolPublicRedactionRow(priorPublic, index, { stateSha256: privateHash, budgetSha256: row.budgetSha256, random: row.random, eventSha256, legacyPublicSha256: legacySha256 });
        const currentSha256 = stateHash(current);
        row.public = { currentSha256, sessionSha256: owned ? currentSha256 : null, strictSha256: strict ? currentSha256 : null, legacySha256, recorded: recordedPublicEvidence(index, states) };
        assert.equal(stateHash(state), privateHash, 'Both current projection and audit-only restoration preserve the full private state');
        fool = current.fool;
        log({ event: 'REDACTED_PUBLIC_MATCHED', commandCount: count, currentSha256, legacySha256, strictRerun: !!strict });
      } else if (options.mode === 'public' && index >= completedBefore) {
        log({ event: 'FULL_PUBLIC_STARTED', commandCount: count });
        const started = performance.now(), strict = runtime.projectSliceState(state), strictMs = performance.now() - started;
        const ownedStarted = performance.now(), owned = session ? session.project() : null, sessionMs = session ? performance.now() - ownedStarted : null;
        if (owned) assert.deepEqual(owned, strict, `Entire current production projection equals owned projection at ${count}`);
        row.public = { strictSha256: stateHash(strict), sessionSha256: owned ? stateHash(owned) : null, recorded: recordedPublicEvidence(index, states) };
        if (row.public.recorded) assert.equal(row.public.strictSha256, row.public.recorded.sha256, row.public.recorded.kind);
        assert.equal(stateHash(state), privateHash, 'Projection must not mutate its full-state input');
        fool = (owned ?? strict).fool;
        log({ event: 'FULL_PUBLIC_MATCHED', commandCount: count, strictMs, sessionMs, recordedKind: row.public.recorded?.kind ?? null });
      } else {
        // A pinned prior public row is evidence of the already finished check,
        // never a newly invented historical expected value.
        if (options.mode !== 'private') row.public = proof.rows[index].public;
      }
      if (index < completedBefore) assert.deepEqual(row, proof.rows[index], 'Replayed private evidence must exactly reproduce the pinned resume prefix');
      else { proof.rows.push(row); assertProof(proof, manifestSha256, options.mode, states, priorPublic); atomic(proofPath, proof); }
      log({ event: 'STATE_VERIFIED', commandCount: count, completedStates: index + 1, totalStates: 216, resumed: index < completedBefore, proofSha256: evidence(proofPath).sha256 });
      if (index === 215) break;
      const recorded = rows[index], intent = structuredClone(recorded.intent);
      if (!fool) fool = session ? session.projectFool() : runtime.projectFool(state);
      const control = fool.actions.find(action => stable(action.command) === stable(intent.command));
      assert(control?.enabled, `Recorded command ${count + 1} must still be publicly enabled`);
      assert.deepEqual({ id: control.id, label: control.label, cost: control.cost, enabled: control.enabled }, recorded.publicControl);
      assert(runtime.validateSlicePayload(intent));
      const before = state;
      if (index === 0) {
        assert.deepEqual(intent, { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } });
        state = runtime.applySliceIntent(before, intent); session = runtime.openFoolRuntimeSession(state);
        assert.equal(stateHash(session.snapshot()), stateHash(state), 'Strict session open retains exactly the genuine guidance result');
      } else {
        const prior = session.inspect(), draft = session.prepare(intent, before.revision);
        assert.deepEqual(session.inspect(), prior, 'Prepare cannot publish the candidate');
        state = session.snapshotDraft(draft);
        assert.deepEqual(session.inspectDraft(draft), { runId: state.runId, revision: state.revision, status: state.status });
        // Check the real candidate before publication; no mutated or forged
        // current state is substituted to manufacture an expected result.
        assert.equal(stateHash(state), states[index + 1].stateSha256);
        session.commit(draft);
      }
      assert.deepEqual(session.inspect(), { runId: state.runId, revision: state.revision, status: state.status });
      assert.equal(stateHash(before), privateHash, 'Preparing/committing never changes the previous detached state');
      eventSha256 = assertRecordedTransition(runtime, before, state, recorded, index === 0 ? null : expectedJournal[index - 1]);
    }
    assert.equal(stateHash(session.snapshot()), FINAL_HASH, 'Committed terminal head, not only the last draft, matches');
    assert.deepEqual(budget(state), finalBudget); assert.deepEqual(state.fool.journal, expectedJournal);
    checkPins(); assertProof(proof, manifestSha256, options.mode, states, priorPublic); assert.equal(proof.rows.length, 216);
    const summary = { format: FORMAT, passed: true, mode: options.mode, manifestSha256, proof: evidence(proofPath),
      privateStatesMatched: 216, recordedCommandsReplayed: 215, strictGuidanceTransitions: 1, ownedTransitions: 214, resumedCompletedStates: completedBefore,
      fullCurrentStrictVersusSessionProjections: options.mode === 'public' ? 215 : options.mode === 'redaction' ? 2 : 0,
      ...(priorPublic ? { currentSafeProjections: 216, restoredLegacyPublicHashesMatched: 216, priorFullStrictVersusOwnedProofSha256: redactionProof.publicRedaction.priorPublicProof.sha256, strictRerunCommandCounts: [1868, 1869, 2083], legacyProjectionPublished: false } : {}),
      originalReconstructedPublicHashesMatched: options.mode !== 'private' ? 44 : 0,
      separatePaused1936BaselineMatched: options.mode !== 'private', separateTerminalBaselineMatched: options.mode !== 'private',
      originalAllStatePublicEvidence: 'NOT_AVAILABLE', fullHistoricalPrefixReplay: 'NOT_RUN', sqlite: 'NOT_RUN',
      captureFreezeSha256: CAPTURE_FREEZE, finalRuntimeFreezeSha256: freeze.sha256,
      finalStateSha256: FINAL_HASH, final: finalBudget, completedAt: new Date().toISOString() };
    atomic(join(output, 'summary.json'), summary); log({ event: 'PASS_COMPLETE', output, summary }); return summary;
  } catch (error) {
    let drift = null; try { checkPins(); } catch (pinError) { drift = pinError.message; }
    log({ event: 'FAILED', commandCount: count, error: error.message, pinFailure: drift, proofSha256: existsSync(proofPath) ? evidence(proofPath).sha256 : null });
    throw error;
  } finally { release(); }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) {
  verifyFoolRuntimeEquivalence(argumentsForEquivalence(process.argv.slice(2))).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
