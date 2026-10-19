import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync, gunzipSync } from 'node:zlib';

/** NEW216 natural continuation of the exact restored194 living final.
 * Historical commands are retained, never replayed. Importing this module
 * never imports the game, builds it, opens SQLite, or starts a natural run.
 * The parent must finish controlled SQLite validation and freeze the reviewed
 * runtime before invoking main. No RNG seam, alternate source or policy override. */
export const SOURCE = 'tests/fixtures/pure-white-angel-v01940/natural.json';
export const SOURCE_SHA256 = '3f13d554046ecffe3512bda22fb4cd14747be2b06dd6dd47185c025d7d9855f1';
export const SOURCE_STATE_SHA256 = '98e3a20cedfe2fa9cec6be8645a6ea340592e497b6d4300b22d03f5476e4719a';
export const PREFIX_COUNT = 853;
export const PREFIX_SHA256 = '6a8dc284dffb34025d9709eb91328425420b4bd1417f61c5cfa091b66c0e65ce';
export const PREFIX_HASH_ENCODING = 'JSON_STRINGIFY_UTF8_ORIGINAL_OBJECT_KEY_ORDER';
export const STATE_HASH_ENCODING = 'STABLE_STRINGIFY_CANONICAL_JSON_UTF8';
export const CURRENT_SCHEMA_VERSION = 213;
export const CURRENT_CONTENT_VERSION = 'sun-v213';
export const FORMAT = 'NEW216_RESTORED194_LIVING853_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
export const OUTPUT = 'output/rebuild-0216/natural-v1';
export const INPUTS = Object.freeze([{ file: SOURCE, sha256: SOURCE_SHA256 }]);
export const POLICY = Object.freeze({ id: 'NEW216_SAME_THREE_ORIGINALS_OWNED_PUBLIC_V1', startWeek: 196,
  defaultObservationActions: 32, selectedBoundaryLimit: 64, carrierLimit: 3,
  selection: 'EXACT_ENABLED_RUNTIME_PREFERRED_SUN_CONTROL',
  ordinary: 'ACTUAL_WORK_REST_CLINIC_NEXT_WEEK_AND_PHYSICAL_EXITS',
  epilogue: 'TWO_FINITE_TECHNIQUE_ATTEMPTS_ACTUAL_APPLICATION_OR_ORDINARY_EXIT_HONEST_REPORT',
  failure: 'RETAIN_ACTUAL_COSTS_INJURIES_POLLUTION_REMAINS_AND_TERMINAL_DEATH',
  observationLimit: 'RESUMABLE_CONTROLLED_STOP_NEVER_PRODUCT_FAILURE', noReroll: true });
const SELF = fileURLToPath(import.meta.url);
const clone = value => structuredClone(value);
const sha = value => createHash('sha256').update(value).digest('hex');
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
const compactHash = value => sha(JSON.stringify(value));
export function startingPolicy() { return { phase: 'SUN_ENTRY', week: POLICY.startWeek,
  doses: 0, carriers: [], epilogueAttempted: [], reported: false, loop: { key: null, repetitions: 0 } }; }
const actionOf = action => ({ ...clone(action), intent: { type: 'SUN', command: clone(action.command) } });
const noProgress = reason => ({ stop: 'PUBLIC_ACTION_BLOCKED', reason });

/** Exact key/path rules match the inherited Sun public contract. Scalar source
 * labels, check.modifiers[].source and prices.preparation remain legitimate. */
export function assertPublicOnly(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  const forbidden = new Set(['random','seed','cursor','randomSeed','randomCursor','randomCursorBefore','randomCursorAfter',
    'cursorBefore','cursorAfter','randomBefore','randomAfter','randomReceipts','sourceDigest','historyDigest',
    'originalWorldDigest','combatHistoryDigest','originalsDigest','originalPracticeDigest','acquisitionDigest',
    'compoundDigest','beforeDigest','afterDigest','actorId','predecessorActorId','incumbentActorId','custodianActorId',
    'futureRoll','futureRolls','nextRoll','unrolledResult','privateSource','sourceState']);
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`, inactiveGuard = key === 'actorId' && child === null &&
      ['$.divineHand.life.site.guard.actorId','$.glory.life.site.guard.actorId'].includes(next);
    assert(!(forbidden.has(key) && !inactiveGuard) && !(key === 'source' && child !== null && typeof child === 'object'), `Private public field at ${next}`);
    assertPublicOnly(child, next);
  }
}
export function assertGlobalPublic(projection, state) {
  assertPublicOnly(projection);
  const json = JSON.stringify(projection), secrets = [state.random.seed, state.sun?.source?.actorId, state.sun?.source?.historyDigest];
  for (const secret of secrets.filter(value => typeof value === 'string' && value.length))
    assert(!json.includes(secret), 'Whole public projection contains an actual private seed or source identity');
}
export function capturePublic(projection) {
  const fields = ['runId','revision','status','week','date','actionsRemaining','weeklyBudget','cash','weeklyWage','wagePaid',
    'health','mind','spirituality','maxHealth','maxMind','maxSpirituality','pollution','injuries','injuryRisk',
    'debtTotal','debts','canAct','actionBlockedReason','activeEvent','combat'];
  const result = { ...Object.fromEntries(fields.map(key => [key, clone(projection[key])])),
    progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
      mastery: clone(projection.progression.mastery) }, sun: clone(projection.sun) };
  assertPublicOnly(result); return result;
}
/** The runtime already recommends real wages, rest, clinic care, weeks,
 * physical clean-up and finite ordinary exits. Do not improvise a fallback or
 * infer that a refusal expires. A disabled/missing recommendation is evidence. */
export function chooseAction(view, previous) {
  assertPublicOnly(view); const policy = clone(previous);
  if (view.status !== 'ACTIVE') return { stop: 'NATURAL_ACTUAL_TERMINAL', reason: `Actual runtime status ${view.status}`, policy };
  if (view.activeEvent || view.combat) return { ...noProgress('An inherited event or combat cannot be bypassed by the Sun chapter'), policy };
  if (policy.reported) return { stop: 'NATURAL_FINITE_SUN_REPORTED', reason: 'The finite actual incident was honestly reported; all failed attempts and costs remain', policy };
  const preferred = view.sun.actions.filter(action => action.preferredAction);
  if (preferred.length !== 1) return { ...noProgress(`Expected one intended public action, found ${preferred.length}; preserve this physical boundary`), policy };
  const action = preferred[0], c = action.command;
  if (!action.enabled) return { ...noProgress(`${action.label}: ${action.reason ?? 'Public prerequisite unresolved'}`), policy };
  if (!view.sun.guidanceKnown && c.type !== 'LEARN_GUIDANCE') return { ...noProgress('The exact living source must first learn Sun guidance'), policy };
  if (view.sun.guidanceKnown && c.type === 'LEARN_GUIDANCE') return { ...noProgress('Never restart the already-owned chapter'), policy };
  if (c.type === 'CONSUME' && policy.doses >= POLICY.carrierLimit) return { ...noProgress('No fourth ordinary carrier is allowed'), policy };
  if (c.type === 'MATERIAL' && c.command.type === 'BUY_COMPOUND' && (policy.carriers.includes(c.command.batchId) || policy.carriers.length >= POLICY.carrierLimit))
    return { ...noProgress('The same finite carrier cannot be duplicated'), policy };
  if (c.type === 'EPILOGUE' && policy.epilogueAttempted.includes(c.command.type))
    return { ...noProgress('A finite technique already attempted cannot be rerolled'), policy };
  policy.phase = !view.sun.guidanceKnown ? 'SUN_ENTRY' : view.sun.promoted ? 'SUN_EPILOGUE' : 'SUN_SERVICES_MATERIALS_PROMOTION';
  return { action: actionOf(action), reason: 'Follow the exact enabled runtime-preferred public action; retain its actual costs and outcome', policy };
}
export function publicActionStillAvailable(view, action) {
  return action.intent.type === 'SUN' && view.sun.actions.some(candidate => candidate.enabled &&
    isDeepStrictEqual(actionOf(candidate), action));
}
export function loopDiagnostic(before, after, policy) {
  const semantic = view => ({ phase: policy.phase, sequence: view.progression.sequence, acting: view.progression.acting,
    mastery: view.progression.mastery, progress: view.sun.sections.filter(section => !['clock','recent-action','finance','body'].includes(section.id)),
    intended: view.sun.actions.filter(action => action.preferredAction).map(action => action.command) });
  const gained = after.cash > before.cash || after.health > before.health || after.mind > before.mind ||
    after.spirituality > before.spirituality || after.pollution < before.pollution || after.injuries.length < before.injuries.length;
  return { key: stateHash(semantic(after)), repetitions: isDeepStrictEqual(semantic(before), semantic(after)) && !gained ? policy.loop.repetitions + 1 : 0 };
}
export function advancePolicy(decision, after, before) {
  const p = clone(decision.policy), c = decision.action.intent.command; p.week = after.week;
  if (c.type === 'CONSUME') { p.doses++; assert(p.doses <= POLICY.carrierLimit); }
  if (c.type === 'MATERIAL' && c.command.type === 'BUY_COMPOUND') {
    assert(!p.carriers.includes(c.command.batchId)); p.carriers.push(c.command.batchId); assert(p.carriers.length <= POLICY.carrierLimit);
  }
  if (c.type === 'EPILOGUE') {
    if (['DIRECTED_RADIANCE','RADIANCE_WARD'].includes(c.command.type)) {
      assert(!p.epilogueAttempted.includes(c.command.type)); p.epilogueAttempted.push(c.command.type);
    }
    if (c.command.type === 'REPORT') p.reported = true;
  }
  p.loop = loopDiagnostic(before, after, p); return p;
}
export function fileEvidence(path) {
  const before = lstatSync(path, { bigint: true });
  assert(before.isFile() && !before.isSymbolicLink(), `Not a frozen regular file: ${path}`);
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(65536); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; hash.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  const after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(before[key], after[key], `File changed while hashing: ${path}`);
  assert.equal(BigInt(bytes), after.size); return { bytes, sha256: hash.digest('hex') };
}
export function inspectFreeze(root = process.cwd()) {
  const files = [];
  const walk = name => {
    const path = join(root, name), stat = lstatSync(path);
    assert(!stat.isSymbolicLink(), `Frozen input cannot be a symlink: ${name}`);
    if (stat.isDirectory()) for (const child of readdirSync(path).sort()) walk(join(name, child));
    else if (stat.isFile()) files.push({ file: name.split(sep).join('/'), ...fileEvidence(path) });
  };
  assert(existsSync(join(root, 'dist/domain/sun/owned-session.js')), 'Build and freeze the reviewed runtime before capture; no game was loaded');
  for (const name of new Set(['package.json','package-lock.json','src','dist/domain','dist/content','dist/resolution','dist/persistence','dist/shared','dist/application','dist/simulation','node_modules/@noble/hashes'])) walk(name);
  files.push({ file: '$natural-producer', ...fileEvidence(SELF) });
  files.push({ file: 'scripts/play/sun-stage.test.mjs', ...fileEvidence(join(root, 'scripts/play/sun-stage.test.mjs')) });
  return { sha256: compactHash(files), nodeVersion: process.version, files };
}
const stampFreeze = (root, freeze) => freeze.files.map(file => {
  const path = file.file === '$natural-producer' ? SELF : join(root, file.file), stat = lstatSync(path, { bigint: true });
  return { path, size: stat.size, mtimeNs: stat.mtimeNs, ctimeNs: stat.ctimeNs, ino: stat.ino };
});
function unchanged(stamps) {
  for (const before of stamps) {
    const after = lstatSync(before.path, { bigint: true }); assert(after.isFile() && !after.isSymbolicLink());
    for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino']) assert.equal(before[key], after[key], `Frozen input drift: ${before.path}`);
  }
}
const syncDirectory = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
function durableCreate(path, value) {
  const fd = openSync(path, 'wx'); try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
}
export const encodeCheckpoint = payload => JSON.stringify({ sha256: stateHash(payload), payload });
export function decodeCheckpoint(bytes) {
  const envelope = JSON.parse(Buffer.isBuffer(bytes) && bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString('utf8') : String(bytes)); assert.equal(envelope.sha256, stateHash(envelope.payload), 'Checkpoint checksum mismatch');
  assert.equal(envelope.payload.format, FORMAT); return envelope;
}
export function recoverAtomicNext(path) {
  const candidate = `${path}.next`; if (!existsSync(candidate)) return;
  const current = existsSync(path) ? decodeCheckpoint(readFileSync(path)) : null;
  let next;
  try { next = decodeCheckpoint(readFileSync(candidate)); }
  catch {
    assert(!existsSync(`${path}.incomplete`), 'Preserve both incomplete boundaries and inspect before resume');
    renameSync(candidate, `${path}.incomplete`); syncDirectory(dirname(path)); return;
  }
  assert.equal(next.payload.predecessorSha256, current?.sha256 ?? null, 'Unknown checkpoint successor; do not discard it');
  renameSync(candidate, path); syncDirectory(dirname(path));
}
export function saveCheckpoint(path, payload, predecessorSha256) {
  assert(!existsSync(`${path}.next`), 'Recover the pending atomic successor first');
  const text = encodeCheckpoint({ ...payload, predecessorSha256 }); durableCreate(`${path}.next`, gzipSync(text, { level: 6 }));
  renameSync(`${path}.next`, path); syncDirectory(dirname(path)); return decodeCheckpoint(text);
}
function replaceDerived(path, value) {
  const temporary = `${path}.derived-next`, fd = openSync(temporary, 'w');
  try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path); syncDirectory(dirname(path));
}
export function readSource(root = process.cwd()) {
  const buffers = INPUTS.map(pin => { const path = join(root, pin.file), stat = lstatSync(path); assert(stat.isFile() && !stat.isSymbolicLink()); const bytes = readFileSync(path); assert.equal(sha(bytes), pin.sha256, `Frozen historical input changed: ${pin.file}`); return bytes; });
  const archive = JSON.parse(buffers[0]), source = archive.final, commands = archive.commands;
  assert.equal(stateHash(source), SOURCE_STATE_SHA256, 'Use the exact restored194 living final; no alternate boundary');
  assert.equal(commands.length, PREFIX_COUNT); assert.equal(compactHash(commands), PREFIX_SHA256);
  assert.equal(source.schemaVersion, 191); assert.equal(source.contentVersion, 'pure-white-angel-v191');
  assert.equal(source.runId, 'bard-rebuild-natural'); assert.equal(source.revision, PREFIX_COUNT + 1);
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.week, POLICY.startWeek); assert.equal(archive.seed, source.random.seed);
  assert.deepEqual([source.health, source.mind, source.spirituality, source.cash, source.actionsRemaining], [100,98,106,1250,3]);
  assert.deepEqual(source.injuries, []); assert.equal(source.progression.pathwayId, 'sun'); assert.equal(source.progression.sequence, 1);
  assert.equal(source.progression.acting, 100); assert.equal(source.pureWhiteAngel.life.reflected, true);
  assert.equal(source.pureWhiteAngel.promotionWeek, 186);
  assert.deepEqual(source.pureWhiteAngel.bottles.map(bottle => bottle.status), ['CONSUMED','SUPPLIER','SUPPLIER']);
  assert.equal(Object.keys(source.progression.mastery).length, 22); assert.equal(Object.values(source.progression.mastery).filter(value => value === 0).length, 6);
  assert.equal(source.combat, null); assert.equal(source.activeEvent, null);
  const files = INPUTS.map((pin, index) => ({ ...pin, bytes: buffers[index].length }));
  return { source, commands, creation: archive.creation, seed: archive.seed, buffers,
    inputFreeze: { format: 'NEW216_RESTORED194_HISTORICAL_INPUTS_V1', sha256: compactHash(files), files,
      originalStateSha256: SOURCE_STATE_SHA256, stateHashEncoding: STATE_HASH_ENCODING, sourceRoot: 'final',
      prefixSha256: PREFIX_SHA256, prefixHashEncoding: PREFIX_HASH_ENCODING, archivedCommandCount: PREFIX_COUNT } };
}
async function loadRuntime(root) {
  const [slice, migration, session] = await Promise.all(['domain/slice/index','domain/slice/migration','domain/sun/owned-session']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  return { ...slice, migrateSliceState: migration.migrateSliceState, openSunRuntimeSession: session.openSunRuntimeSession };
}
export function migrate(runtime, original) {
  const before = stateHash(original), state = runtime.migrateSliceState(original);
  assert.equal(stateHash(original), before, 'Migration mutated historical input');
  for (const [key,value] of Object.entries(original)) if (!['schemaVersion','contentVersion'].includes(key))
    assert.deepEqual(state[key], value, `Migration changed original ${key}`);
  assert.equal(state.schemaVersion, CURRENT_SCHEMA_VERSION); assert.equal(state.contentVersion, CURRENT_CONTENT_VERSION);
  runtime.assertValidSliceState(state); return state;
}
export function checkOriginals(state, original, before) {
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, original.random.seed); assert(state.random.cursor >= before.random.cursor);
  for (const key of ['bard','lightprayer','sunpriest','notary','priestOfLight','unshadowed','justiceMentor','lightSeeker','pureWhiteAngel','world','combatHistory'])
    assert.deepEqual(state[key], original[key], `Frozen original history changed: ${key}`);
  assert.deepEqual(state.character, original.character, 'Original identity, wage and core stats remain exact');
  for (const [id, value] of Object.entries(original.progression.mastery)) assert.equal(state.progression.mastery[id], value, `Original mastery changed: ${id}`);
  if (before.sun.guidanceKnown) assert.deepEqual(state.sun.source, before.sun.source, 'The authenticated source cannot be replaced');
  assert.equal(state.activeEvent, null); assert.equal(state.combat, null); assert.deepEqual(state.eventQueue, []); assert.equal(state.pulse, 'NONE');
}
export function selectionOutcome(after) {
  return { status: after.status, sequence: after.progression.sequence, promoted: after.sun.promoted, guidance: after.sun.guidanceKnown };
}
/** Sampling for later SQLite checks never removes any full action capture. */
export function selectedBoundary(intent, after, previous) {
  if (previous.length >= POLICY.selectedBoundaryLimit) return null;
  const c = intent.command, outcome = 'sun' in after ? selectionOutcome(after) : after; let key = null;
  if (['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','STABILIZE_PROMOTION','START_EPILOGUE','RETURN_ON_FOOT'].includes(c.type)) key = `sun-${c.type.toLowerCase()}`;
  if (c.type === 'SERVICE') key = `service-${c.command.serviceId}-${c.command.type.toLowerCase()}`;
  if (c.type === 'MATERIAL') key = `material-${c.command.type.toLowerCase()}-${c.command.bottleId ?? c.command.step ?? c.command.batchId ?? c.command.compoundId ?? 'unique'}`;
  if (c.type === 'CONSUME') key = outcome.status !== 'ACTIVE' ? 'sun-actual-terminal-dose' : outcome.promoted ? 'sun-actual-promotion' : `sun-failed-dose-${c.compoundId}`;
  if (c.type === 'EPILOGUE') key = `epilogue-${c.command.type.toLowerCase()}`;
  if (outcome.status !== 'ACTIVE') key = 'sun-actual-terminal';
  return key && !previous.some(boundary => boundary.kind === key) ? key : null;
}
export function verifyCheckpoint(payload, freeze, initialStateSha256, inputFreeze) {
  assert.equal(payload.format, FORMAT); assert.equal(payload.source, SOURCE); assert.equal(payload.sourceSha256, SOURCE_SHA256);
  assert.equal(payload.prefixHashEncoding, PREFIX_HASH_ENCODING); assert.equal(payload.stateHashEncoding, STATE_HASH_ENCODING);
  assert.equal(payload.prefixSha256, PREFIX_SHA256); assert.equal(payload.runtimeFreezeSha256, freeze.sha256);
  assert.equal(payload.inputFreezeSha256, inputFreeze.sha256); assert.deepEqual(payload.policyDefinition, POLICY);
  assert.equal(payload.initialStateSha256, initialStateSha256); assert.equal(payload.migration.originalStateSha256, SOURCE_STATE_SHA256);
  assert.equal(payload.migration.migratedStateSha256, initialStateSha256);
  assert.equal(payload.migration.fromSchema, 191); assert.equal(payload.migration.toSchema, CURRENT_SCHEMA_VERSION);
  assert.equal(payload.commandCount, PREFIX_COUNT + payload.commands.length); assert.equal(payload.rows.length, payload.commands.length);
  assert.equal(payload.finalStateSha256, stateHash(payload.state));
  for (const key of ['initialGlobalPublicSha256','globalPublicStateSha256']) assert(/^[a-f0-9]{64}$/.test(payload[key] ?? ''), `Missing or invalid ${key}`);
  let state = initialStateSha256, publicHash = payload.initialPublicSha256, globalPublicHash = payload.initialGlobalPublicSha256, randomHash = payload.initialRandomSha256, policyHash = stateHash(startingPolicy());
  const selected = [];
  for (const [index,row] of payload.rows.entries()) {
    assert.equal(row.commandCount, PREFIX_COUNT + index + 1); assert.deepEqual(row.intent, payload.commands[index]);
    for (const key of ['globalPublicBeforeSha256','globalPublicAfterSha256']) assert(/^[a-f0-9]{64}$/.test(row[key] ?? ''), `Missing or invalid ${key}`);
    assert.equal(row.intent.type, 'SUN'); assert.equal(row.commandSha256, compactHash(row.intent)); assert.equal(row.beforeStateSha256, state);
    assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.globalPublicBeforeSha256, globalPublicHash); assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore)); assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    assert.equal(row.randomBefore.seed, row.randomAfter.seed); assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    assert.deepEqual(Object.keys(row.selectionOutcome).sort(), ['guidance','promoted','sequence','status']);
    assert([0,1].includes(row.selectionOutcome.sequence));
    assert.equal(typeof row.selectionOutcome.guidance, 'boolean');
    assert.equal(typeof row.selectionOutcome.promoted, 'boolean'); assert.equal(typeof row.selectionOutcome.status, 'string');
    assert.equal(row.revision, row.commandCount + 1);
    assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
    assert(Number.isSafeInteger(row.capture.bytes) && row.capture.bytes > 0); assert(/^[a-f0-9]{64}$/.test(row.capture.sha256));
    const kind = selectedBoundary(row.intent, row.selectionOutcome, selected);
    if (kind) selected.push({ kind, commandCount: row.commandCount });
    state = row.afterStateSha256; publicHash = row.publicAfterSha256; globalPublicHash = row.globalPublicAfterSha256; randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(state, payload.finalStateSha256); assert.equal(publicHash, payload.publicStateSha256); assert.equal(globalPublicHash, payload.globalPublicStateSha256); assert.equal(randomHash, stateHash(payload.state.random)); assert.equal(policyHash, stateHash(payload.policy));
  assert.equal(payload.policy.week, payload.state.week); assert(Number.isInteger(payload.policy.doses) && payload.policy.doses >= 0 && payload.policy.doses <= POLICY.carrierLimit);
  assert(payload.policy.carriers.length <= POLICY.carrierLimit); assert.equal(new Set(payload.policy.carriers).size, payload.policy.carriers.length);
  assert(payload.policy.epilogueAttempted.every(type => ['DIRECTED_RADIANCE','RADIANCE_WARD'].includes(type)));
  assert.equal(new Set(payload.policy.epilogueAttempted).size, payload.policy.epilogueAttempted.length);
  assert.deepEqual(payload.boundaries.map(({ kind,commandCount }) => ({ kind,commandCount })), selected, 'Selected evidence must rederive from actual public outcomes');
  assert(payload.boundaries.length <= POLICY.selectedBoundaryLimit); assert.equal(new Set(payload.boundaries.map(b => b.kind)).size, payload.boundaries.length);
  for (const boundary of payload.boundaries) {
    const row = payload.rows[boundary.commandCount - PREFIX_COUNT - 1];
    assert.deepEqual({ file: boundary.file, bytes: boundary.bytes, sha256: boundary.sha256 }, row.capture);
  }
  assert.equal(typeof payload.policy.reported, 'boolean');
  if (payload.terminal) {
    assert.equal(payload.pending, null);
    assert(['NATURAL_ACTUAL_TERMINAL','NATURAL_FINITE_SUN_REPORTED'].includes(payload.terminal.stage));
    assert(payload.terminal.stage === 'NATURAL_ACTUAL_TERMINAL' ? payload.state.status !== 'ACTIVE' : payload.policy.reported);
  }
  if (payload.pending) {
    assert.equal(payload.pending.commandCount, payload.commandCount + 1); assert.equal(payload.pending.beforeStateSha256, payload.finalStateSha256);
    assert.equal(payload.pending.publicBeforeSha256, payload.publicStateSha256); assert.equal(payload.pending.globalPublicBeforeSha256, payload.globalPublicStateSha256); assert.equal(payload.pending.policyBeforeSha256, stateHash(payload.policy));
    assert.equal(payload.pending.randomBeforeSha256, stateHash(payload.state.random));
    assert.deepEqual(payload.pending.intent, payload.pending.decision.action.intent);
  }
}
/** Every actual action retains complete private, RNG, chapter-public and
 * whole-public boundaries. Selected SQLite samples refer to these same bytes. */
export function verifyActionCapture(content, row) {
  assert.equal(content.commandCount, row.commandCount); assert.deepEqual(content.lastIntent, row.intent);
  assert.equal(stateHash(content.beforeLast), row.beforeStateSha256); assert.equal(stateHash(content.final), row.afterStateSha256);
  assert.equal(stateHash(content.publicBefore), row.publicBeforeSha256); assert.equal(stateHash(content.public), row.publicAfterSha256);
  assert.equal(stateHash(content.globalPublicBefore), row.globalPublicBeforeSha256); assert.equal(stateHash(content.globalPublic), row.globalPublicAfterSha256);
  assert.deepEqual(actualReceipts(content.final, content.beforeLast), row.receipts);
  assert.deepEqual(content.randomBefore, row.randomBefore); assert.deepEqual(content.randomAfter, row.randomAfter);
  assert.deepEqual(content.beforeLast.random, content.randomBefore); assert.deepEqual(content.final.random, content.randomAfter);
  assertGlobalPublic(content.globalPublicBefore, content.beforeLast); assertGlobalPublic(content.globalPublic, content.final);
  assert.deepEqual(capturePublic(content.globalPublicBefore), content.publicBefore); assert.deepEqual(capturePublic(content.globalPublic), content.public);
  assert.deepEqual(selectionOutcome(content.public), row.selectionOutcome);
  assert.equal(stateHash(content.policyBefore), row.policyBeforeSha256); assert.equal(stateHash(content.policyAfter), row.policyAfterSha256);
  const decision = chooseAction(content.publicBefore, content.policyBefore);
  assert(!decision.stop, 'Retained action was not selected by the frozen public policy');
  assert(publicActionStillAvailable(content.publicBefore, decision.action), 'Retained action was not an exact enabled public control');
  assert.deepEqual(decision.action.intent, content.lastIntent); assert.equal(decision.reason, row.reason);
  assert.equal(decision.action.label, row.publicLabel); assert.equal(decision.action.cost, row.publicCost);
  assert.deepEqual(advancePolicy(decision, content.public, content.publicBefore), content.policyAfter);
  const { capture: _capture, ...audit } = row;
  assert.deepEqual(content.audit, { ...audit, elapsedMilliseconds: null });
}
export function retainActionCapture(directory, content) {
  const file = `action-${content.commandCount}.json.gz`, path = join(directory, file), candidate = `${path}.next`;
  if (existsSync(path)) {
    assert(!existsSync(candidate), 'Preserve the unexpected extra actual action successor for review');
    assert.deepEqual(readCapture(path), content, 'Existing actual action differs from the exact resumed draft');
  }
  else {
    if (existsSync(candidate)) {
      let recovered, decoded = false;
      try { recovered = readCapture(candidate); decoded = true; }
      catch {
        assert(!existsSync(`${path}.incomplete`), 'Preserve both incomplete action captures for review');
        renameSync(candidate, `${path}.incomplete`); syncDirectory(directory);
      }
      if (decoded) assert.deepEqual(recovered, content, 'Unknown actual action successor; preserve it without rerolling');
    }
    if (!existsSync(candidate)) durableCreate(candidate, gzipSync(JSON.stringify(content), { level: 6 }));
    renameSync(candidate, path); syncDirectory(directory);
  }
  return { file, ...fileEvidence(path) };
}
export function parseOptions(args, root = process.cwd()) {
  const out = resolve(root, OUTPUT), checkpoint = join(out, 'checkpoint.json.gz');
  const result = { out, resume: null, maxNewActions: POLICY.defaultObservationActions, stopAfterCommand: null, pauseFlag: join(out, 'PAUSE') }, seen = new Set();
  for (let index = 0; index < args.length; index++) {
    let flag = args[index]; if (flag === '--max-actions') flag = '--max-new-actions';
    const value = args[++index]; assert(value !== undefined, `Missing value for ${flag}`);
    assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--out') assert.equal(resolve(value), out, `The only authorized output is ${OUTPUT}`);
    else if (flag === '--resume') { assert.equal(resolve(value), checkpoint, 'Resume only the exact natural-v1 checkpoint'); result.resume = checkpoint; }
    else if (flag === '--max-new-actions' || flag === '--stop-after-command') {
      assert(/^\d+$/.test(value)); const number = Number(value); assert(Number.isSafeInteger(number));
      if (flag === '--max-new-actions') result.maxNewActions = number;
      else { assert(number >= PREFIX_COUNT, 'A stop boundary cannot precede living853'); result.stopAfterCommand = number; }
    } else throw Error(`Unsupported ${flag}: no source, seed, roll, strategy, resource or outcome overrides`);
  }
  return result;
}
export function readCapture(path) {
  const bytes = readFileSync(path); return JSON.parse(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8'));
}
export function actualReceipts(next, before) {
  const latest = next.sun.journal.at(-1);
  if (latest?.revision === next.revision) return { checks: clone(latest.randomReceipts), finance: clone(latest.financeReceipts), notes: clone(latest.notes) };
  assert(!before.sun.guidanceKnown && next.sun.guidanceKnown, 'An owned action must have its actual journal receipt');
  return { checks: [], finance: [], notes: clone(next.chronicle.slice(before.chronicle.length)) };
}
/** Pause limits count newly completed actions in this invocation. A durable
 * pending command is finished exactly once before a requested pause. */
export function observationPause(boundary, completed, options, requested = false) {
  return !boundary.pending && (requested || completed >= options.maxNewActions ||
    options.stopAfterCommand !== null && boundary.commandCount >= options.stopAfterCommand);
}
export function initialCheckpoint(initial, globalView, freeze, inputFreeze, createdAt) {
  const view = capturePublic(globalView), hash = stateHash(initial);
  return { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, prefixSha256: PREFIX_SHA256,
    prefixHashEncoding: PREFIX_HASH_ENCODING, stateHashEncoding: STATE_HASH_ENCODING,
    inputFreezeSha256: inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256, policyDefinition: POLICY, policy: startingPolicy(),
    migration: { originalStateSha256: SOURCE_STATE_SHA256, migratedStateSha256: hash, fromSchema: 191, toSchema: CURRENT_SCHEMA_VERSION },
    createdAt, commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state: initial,
    initialStateSha256: hash, finalStateSha256: hash, initialPublicSha256: stateHash(view), publicStateSha256: stateHash(view),
    initialGlobalPublicSha256: stateHash(globalView), globalPublicStateSha256: stateHash(globalView),
    initialRandomSha256: stateHash(initial.random), pending: null, terminal: null };
}
export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), root = process.cwd();
  assert.equal(resolve(root, 'scripts/play/sun-stage.mjs'), SELF, 'Run from the matching reviewed frozen repository root');
  const old = readSource(root), freeze = inspectFreeze(root), stamps = stampFreeze(root, { files: [...freeze.files,...old.inputFreeze.files] });
  const runtime = await loadRuntime(root), initial = migrate(runtime, old.source), initialHash = stateHash(initial);
  const initialGlobal = runtime.projectSliceState(initial); assertGlobalPublic(initialGlobal, initial); const initialView = capturePublic(initialGlobal);
  for (const name of ['src','dist','scripts','tests','test-inputs','docs','node_modules','.git']) {
    const protectedPath = join(root, name); assert(options.out !== protectedPath && !options.out.startsWith(protectedPath + sep), 'Output cannot modify frozen inputs or repository metadata');
  }
  assert.notEqual(options.out, root);
  let directory = root;
  for (const name of OUTPUT.split('/')) {
    directory = join(directory, name);
    if (!existsSync(directory)) mkdirSync(directory);
    const stat = lstatSync(directory); assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Capture output must not redirect through a symlink');
  }
  for (const file of readdirSync(options.out)) {
    const stat = lstatSync(join(options.out, file)); assert(stat.isFile() && !stat.isSymbolicLink(), 'Retained capture entries must be regular files');
  }
  const checkpointPath = options.resume ?? join(options.out, 'checkpoint.json.gz'), freezePath = join(options.out, 'runtime-freeze.json'), inputPath = join(options.out, 'input-freeze.json');
  const originals = ['archived-original194-natural.json.gz'];
  const initialCapture = { originalStateSha256: SOURCE_STATE_SHA256, migratedStateSha256: initialHash,
    publicSha256: stateHash(initialView), globalPublicSha256: stateHash(initialGlobal),
    final: initial, random: initial.random, public: initialView, globalPublic: initialGlobal };
  assert.equal(dirname(checkpointPath), options.out);
  let saved, session = null, stage = null, reason = null, count = 0, pauseRequested = false;
  const requestPause = () => { pauseRequested = true; };
  options.pauseFlag ??= join(options.out, 'PAUSE');
  if (options.resume) {
    assert.deepEqual(readCapture(freezePath), freeze, 'Frozen runtime/producer drift; never resume with changed rules');
    assert.deepEqual(readCapture(inputPath), old.inputFreeze, 'Frozen historical inputs drifted');
    assert.equal(sha(readFileSync(join(options.out, 'producer.mjs'))), freeze.files.find(file => file.file === '$natural-producer').sha256, 'Retained producer changed');
    for (const [index,file] of originals.entries()) assert.equal(sha(gunzipSync(readFileSync(join(options.out, file)))), INPUTS[index].sha256, 'Retained original evidence changed');
    recoverAtomicNext(checkpointPath); saved = decodeCheckpoint(readFileSync(checkpointPath)); verifyCheckpoint(saved.payload, freeze, initialHash, old.inputFreeze);
    if (saved.payload.terminal) ({ stage, reason } = saved.payload.terminal);
  } else {
    assert.equal(readdirSync(options.out).length, 0, 'Refuse to overwrite an existing capture; use exact --resume');
    durableCreate(freezePath, JSON.stringify(freeze)); durableCreate(inputPath, JSON.stringify(old.inputFreeze)); durableCreate(join(options.out, 'producer.mjs'), readFileSync(SELF));
    for (const [index,file] of originals.entries()) durableCreate(join(options.out, file), gzipSync(old.buffers[index], { level: 6 }));
    durableCreate(join(options.out, 'migration-initial.json.gz'), gzipSync(JSON.stringify(initialCapture), { level: 6 })); syncDirectory(options.out);
    saved = saveCheckpoint(checkpointPath, initialCheckpoint(initial, initialGlobal, freeze, old.inputFreeze, new Date().toISOString()), null);
  }
  process.on('SIGINT', requestPause); process.on('SIGTERM', requestPause);
  try {
    assert.equal(saved.payload.initialPublicSha256, stateHash(initialView), 'Original current-chapter public hash changed');
    assert.equal(saved.payload.initialGlobalPublicSha256, stateHash(initialGlobal), 'Original whole-public hash changed');
    assert.deepEqual(readCapture(join(options.out, 'migration-initial.json.gz')), initialCapture, 'Retained migrated initial/public boundary changed');
    unchanged(stamps);
    if (saved.payload.state.sun.guidanceKnown) session = runtime.openSunRuntimeSession(saved.payload.state);
    const projectGlobal = () => { const projection = session ? session.project() : runtime.projectSliceState(saved.payload.state); assertGlobalPublic(projection, saved.payload.state); return projection; };
    const project = () => capturePublic(projectGlobal()), reopened = projectGlobal();
    assert.equal(stateHash(capturePublic(reopened)), saved.payload.publicStateSha256, 'Reopened current-chapter public boundary changed');
    assert.equal(stateHash(reopened), saved.payload.globalPublicStateSha256, 'Reopened whole public boundary changed');
    for (const row of saved.payload.rows) {
      assert.deepEqual(fileEvidence(join(options.out, row.capture.file)), { bytes: row.capture.bytes, sha256: row.capture.sha256 });
      verifyActionCapture(readCapture(join(options.out, row.capture.file)), row);
    }
    for (const boundary of saved.payload.boundaries) assert.deepEqual(fileEvidence(join(options.out, boundary.file)), { bytes: boundary.bytes, sha256: boundary.sha256 });
    while (!stage) {
      await new Promise(resolve => setImmediate(resolve));
      unchanged(stamps); const boundary = saved.payload;
      if (boundary.state.status !== 'ACTIVE') { stage = 'NATURAL_ACTUAL_TERMINAL'; reason = `Actual runtime status ${boundary.state.status}`; break; }
      if (boundary.policy.reported) { stage = 'NATURAL_FINITE_SUN_REPORTED'; reason = 'The finite actual incident was honestly reported; all failed attempts and costs remain'; break; }
      if (observationPause(boundary, count, options, pauseRequested || existsSync(options.pauseFlag))) {
        stage = 'MANUAL_PAUSE'; reason = 'Paused at the requested durable completed-action boundary; resume the exact frozen policy'; break;
      }
      if (boundary.policy.loop.repetitions >= 6) { stage = 'PUBLIC_NO_PROGRESS_DIAGNOSTIC'; reason = 'Six accepted actions left the meaningful public boundary unchanged; retain the actual state for review'; break; }
      let pending = boundary.pending;
      if (!pending) {
        const globalView = projectGlobal(), view = capturePublic(globalView), decision = chooseAction(view, boundary.policy);
        if (decision.stop) { stage = decision.stop; reason = decision.reason; break; }
        assert(publicActionStillAvailable(view, decision.action), 'Selection must be an exact enabled public button');
        pending = { commandCount: boundary.commandCount + 1, intent: clone(decision.action.intent), decision,
          beforeStateSha256: boundary.finalStateSha256, publicBeforeSha256: stateHash(view), globalPublicBeforeSha256: stateHash(globalView),
          randomBeforeSha256: stateHash(boundary.state.random), policyBeforeSha256: stateHash(boundary.policy), startedAt: new Date().toISOString() };
        saved = saveCheckpoint(checkpointPath, { ...boundary, pending }, saved.sha256);
      }
      const beforeGlobal = projectGlobal(), beforeView = capturePublic(beforeGlobal); assert(publicActionStillAvailable(beforeView, pending.decision.action), 'Pending exact button is no longer enabled');
      assert.equal(stateHash(beforeView), pending.publicBeforeSha256); assert.equal(stateHash(beforeGlobal), pending.globalPublicBeforeSha256);
      assert.equal(stateHash(saved.payload.state.random), pending.randomBeforeSha256);
      assert.deepEqual(chooseAction(beforeView, saved.payload.policy), pending.decision, 'Retain the exact pending frozen policy choice');
      const before = saved.payload.state, started = performance.now(); let draft = null, next, globalAfter;
      if (session) { draft = session.prepare(pending.intent, before.revision); next = session.snapshotDraft(draft); globalAfter = session.projectDraft(draft); }
      else {
        next = runtime.applySliceIntent(before, pending.intent);
        if (next.sun.guidanceKnown) session = runtime.openSunRuntimeSession(next);
        globalAfter = session ? session.project() : runtime.projectSliceState(next);
      }
      assertGlobalPublic(globalAfter, next); const after = capturePublic(globalAfter);
      assert.equal(next.revision, before.revision + 1); checkOriginals(next, old.source, before);
      const policy = advancePolicy(pending.decision, after, beforeView);
      const row = { commandCount: pending.commandCount, intent: clone(pending.intent), commandSha256: compactHash(pending.intent),
        reason: pending.decision.reason, publicLabel: pending.decision.action.label, publicCost: pending.decision.action.cost,
        startedAt: pending.startedAt, elapsedMilliseconds: Math.round(performance.now() - started), revision: next.revision, week: next.week,
        beforeStateSha256: pending.beforeStateSha256, afterStateSha256: stateHash(next), publicBeforeSha256: pending.publicBeforeSha256, publicAfterSha256: stateHash(after),
        globalPublicBeforeSha256: pending.globalPublicBeforeSha256, globalPublicAfterSha256: stateHash(globalAfter), selectionOutcome: selectionOutcome(after), randomBefore: clone(before.random), randomAfter: clone(next.random), randomBeforeSha256: stateHash(before.random), randomAfterSha256: stateHash(next.random),
        policyBeforeSha256: pending.policyBeforeSha256, policyAfterSha256: stateHash(policy), receipts: actualReceipts(next, before) };
      const selected = selectedBoundary(pending.intent, after, saved.payload.boundaries), boundaries = [...saved.payload.boundaries];
      const content = { commandCount: pending.commandCount, beforeLast: before, lastIntent: pending.intent, final: next,
        randomBefore: row.randomBefore, randomAfter: row.randomAfter, publicBefore: beforeView, public: after,
        globalPublicBefore: beforeGlobal, globalPublic: globalAfter, policyBefore: clone(saved.payload.policy), policyAfter: clone(policy),
        audit: { ...row, elapsedMilliseconds: null } };
      row.capture = retainActionCapture(options.out, content); verifyActionCapture(content, row);
      if (selected) boundaries.push({ ...row.capture, kind: selected, commandCount: pending.commandCount });
      saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next, finalStateSha256: row.afterStateSha256, publicStateSha256: row.publicAfterSha256, globalPublicStateSha256: row.globalPublicAfterSha256,
        commandCount: pending.commandCount, commands: [...saved.payload.commands,pending.intent], rows: [...saved.payload.rows,row], boundaries, policy, pending: null }, saved.sha256);
      if (draft) session.commit(draft); count++;
      console.log(JSON.stringify({ completed: pending.commandCount, action: pending.decision.action.label, week: next.week, sequence: next.progression.sequence, milliseconds: row.elapsedMilliseconds }));
    }
    unchanged(stamps); assert.deepEqual(inspectFreeze(root), freeze, 'Frozen runtime bytes changed during capture'); assert.deepEqual(readSource(root).inputFreeze, old.inputFreeze);
    verifyCheckpoint(saved.payload, freeze, initialHash, old.inputFreeze); runtime.assertValidSliceState(saved.payload.state);
    if (saved.payload.state.sun.guidanceKnown) {
      const strict = runtime.openSunRuntimeSession(saved.payload.state); assert.equal(stateHash(strict.snapshot()), saved.payload.finalStateSha256);
      const strictGlobal = strict.project(); assertGlobalPublic(strictGlobal, saved.payload.state);
      assert.equal(stateHash(capturePublic(strictGlobal)), saved.payload.publicStateSha256); assert.equal(stateHash(strictGlobal), saved.payload.globalPublicStateSha256);
    }
    const paused = stage === 'MANUAL_PAUSE', diagnostic = stage.startsWith('PUBLIC_');
    if (!paused && !diagnostic && !saved.payload.terminal) saved = saveCheckpoint(checkpointPath, { ...saved.payload, terminal: { stage, reason } }, saved.sha256);
    const view = project();
    replaceDerived(join(options.out, 'commands.ndjson.gz'), gzipSync(saved.payload.rows.map(row => JSON.stringify(row)).join('\n') + (saved.payload.rows.length ? '\n' : ''), { level: 6 }));
    replaceDerived(join(options.out, 'boundaries.index.json'), JSON.stringify(saved.payload.boundaries));
    replaceDerived(join(options.out, 'natural.json.gz'), gzipSync(JSON.stringify({ provenance: { kind: 'NEW216_FROM_RESTORED194_LIVING853_PUBLIC_SUN_CONTINUATION',
      format: 'NEW216_REBUILD_PROVENANCE_V1', newNatural216: true, rebuiltFromRestoredVolume194: true,
      source: SOURCE, sourceSha256: SOURCE_SHA256, sourceRoot: 'final', originalStateSha256: SOURCE_STATE_SHA256, originalEvidence: originals,
      prefixCommandsSha256: PREFIX_SHA256, prefixCommandsHashEncoding: PREFIX_HASH_ENCODING, stateHashEncoding: STATE_HASH_ENCODING, inputFreezeSha256: old.inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256,
      historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, completeOriginalSourceRetainedExactly: true, alternateSourceUsed: false,
      privateAudit: true, seedChanged: false, randomOverridden: false, futureDrawInspected: false, selectedFromEnabledPublicActionsOnly: true,
      everyActionEvidence: 'FULL_PRIVATE_RNG_CHAPTER_PUBLIC_AND_GLOBAL_PUBLIC_BEFORE_AND_AFTER_GZIP',
      selectedSQLiteBoundaries: 'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER', globalPublicScope: 'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH', projectionScope: 'POSITIVE_SUN_AND_ORDINARY_PUBLIC_DASHBOARD' },
      creation: old.creation, seed: old.seed, prefixCount: PREFIX_COUNT, commands: [...old.commands,...saved.payload.commands],
      policy: POLICY, stage, reason, pendingIntent: saved.payload.pending?.intent ?? null, boundaries: saved.payload.boundaries, final: saved.payload.state }), { level: 6 }));
    replaceDerived(join(options.out, 'summary.json'), JSON.stringify({ stage, reason, commands: saved.payload.commandCount, originalCommands: PREFIX_COUNT,
      newCommands: saved.payload.commands.length, rebuild: 'NEW216', newNatural216: true, controlledStop: stage === 'MANUAL_PAUSE', week: saved.payload.policy.week, paused, diagnostic, strictFinalValidation: true,
      sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', checkpoint: 'checkpoint.json.gz', public: view }));
    console.log(JSON.stringify({ outputDir: options.out, stage, commands: saved.payload.commandCount, paused, diagnostic }));
    return { outputDir: options.out, stage, commands: saved.payload.commandCount, paused, diagnostic };
  } catch (error) {
    try { replaceDerived(join(options.out, 'error.json'), JSON.stringify({ stage: 'CAPTURE_INTERRUPTED', error: String(error), commandCount: saved?.payload.commandCount ?? null, resumeExactPendingRequired: true, at: new Date().toISOString() })); }
    catch { /* Keep the first error, exact pending command and every durable boundary. */ }
    throw error;
  } finally { process.off('SIGINT', requestPause); process.off('SIGTERM', requestPause); }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
