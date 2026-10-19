import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync, gunzipSync } from 'node:zlib';

/** NEW218 natural continuation of the exact restored196 living final.
 * Historical commands are retained, never replayed. Importing this module
 * never imports the game, builds it, opens SQLite, or starts a natural run.
 * The parent must finish the currently authorized targeted validation and freeze the reviewed
 * runtime before invoking main. No RNG seam, alternate source or policy override.
 * --max-new-actions 0/1 stops only at a fully persisted action boundary.
 * A zero-action resume verifies the closed capture without rewriting any bytes.
 * Resume requires the original source, exact runtime/producer/test bytes, Node
 * version and the complete natural-v1 directory, including every .json.gz,
 * pending .next and incomplete evidence file. Keep the old 823 commands as
 * original evidence; only the exact durable pending new action may be rebuilt.
 * SQLite reopen and tar/bundle verification are separate parent-owned checks. */
export const SOURCE = 'tests/fixtures/star-key-v01960/natural.json';
export const SOURCE_SHA256 = 'd9f23dd736ccf0a9fe4eb48e7ffbd79f86a87c6f6ad58dcd913d234c3251cc6d';
export const SOURCE_STATE_SHA256 = '56ecbdddfdbfa82116aa8ea466d4195be0b98e4ccbcc49bea07f3f2cabfd1a5b';
export const PREFIX_COUNT = 823;
// The inherited archive omits prior directed actions; revision is not prefix length + 1.
export const SOURCE_REVISION = 1131;
export const PREFIX_SHA256 = 'ac621af822eec1b364d0b98a9215beaa048942915b43e6718c56725d1e445385';
export const PREFIX_HASH_ENCODING = 'JSON_STRINGIFY_UTF8_ORIGINAL_OBJECT_KEY_ORDER';
export const STATE_HASH_ENCODING = 'STABLE_STRINGIFY_CANONICAL_JSON_UTF8';
export const CURRENT_SCHEMA_VERSION = 215;
export const CURRENT_CONTENT_VERSION = 'door-v215';
export const CARRIER_IDS = Object.freeze(['door-carrier-1','door-carrier-2','door-carrier-3']);
export const SERVICE_IDS = Object.freeze(['ledger-threshold','courtyard-stair','warehouse-gate']);
export const FROZEN_SOURCE_KEYS = Object.freeze(['apprentice','trickmaster','astrologer','recorder','traveler','secretsSorcerer','wanderer','planeswalker','starKey','world','combatHistory']);
export const TECHNIQUES = Object.freeze([
  Object.freeze({ id: 'door.s0.bounded-conceptual-escape', cast: 'CONCEPTUAL_ESCAPE', window: 'escape', impact: 'spring', outcome: 'AVOIDED' }),
  Object.freeze({ id: 'door.s0.single-exit-seal', cast: 'SEAL_EXIT', window: 'seal', impact: 'exit', outcome: 'HELD' }),
]);
export const FORMAT = 'NEW218_RESTORED196_LIVING823_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
export const OUTPUT = 'output/rebuild-0218/natural-v1';
export const INPUTS = Object.freeze([{ file: SOURCE, sha256: SOURCE_SHA256 }]);
export const POLICY = Object.freeze({ id: 'NEW218_SAME_THREE_ORIGINALS_OWNED_PUBLIC_V1', startWeek: 218,
  defaultObservationActions: 32, selectedBoundaryLimit: 64, selectedBoundaryTerminalReserve: 1, carrierLimit: 3, serviceLimit: 3,
  selection: 'EXACT_ENABLED_RUNTIME_PREFERRED_DOOR_CONTROL',
  ordinary: 'ACTUAL_WORK_REST_CLINIC_NEXT_WEEK_AND_PHYSICAL_EXITS',
  epilogue: 'TWO_FINITE_TECHNIQUE_ATTEMPTS_ACTUAL_APPLICATION_OR_ORDINARY_EXIT_HONEST_REPORT',
  failure: 'RETAIN_ACTUAL_COSTS_INJURIES_POLLUTION_REMAINS_AND_TERMINAL_DEATH',
  observationLimit: 'RESUMABLE_CONTROLLED_STOP_NEVER_PRODUCT_FAILURE', noReroll: true });
export const RECOVERY_MANIFEST = 'recovery-manifest.json';
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
export function startingPolicy() { return { phase: 'DOOR_ENTRY', week: POLICY.startWeek,
  doses: 0, carriers: [], consumedCompounds: [], epilogueAttempted: [], reported: false, loop: { key: null, repetitions: 0, recent: [], cycleRepeats: 0 } }; }
const actionOf = action => ({ ...clone(action), intent: { type: 'DOOR', command: clone(action.command) } });
const noProgress = reason => ({ stop: 'PUBLIC_ACTION_BLOCKED', reason });

/** Exact key/path rules match the inherited Door public contract. Scalar source
 * labels, check.modifiers[].source and prices.preparation remain legitimate. */
export function assertPublicOnly(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  const forbidden = new Set(['random','seed','cursor','randomSeed','randomCursor','randomCursorBefore','randomCursorAfter',
    'cursorBefore','cursorAfter','randomBefore','randomAfter','randomReceipts','sourceDigest','historyDigest',
    'originalWorldDigest','combatHistoryDigest','originalsDigest','originalPracticeDigest','acquisitionDigest',
    'compoundDigest','beforeDigest','afterDigest','actorId','predecessorActorId','incumbentActorId','custodianActorId',
    'futureRoll','futureRolls','nextRoll','unrolledResult','privateSource','sourceState',
    'preparationRoll','sourceHistory','sourceScene','privateProbe','privateMastery','unexpectedField']);
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`, inactiveGuard = key === 'actorId' && child === null &&
      ['$.divineHand.life.site.guard.actorId','$.glory.life.site.guard.actorId'].includes(next);
    assert(!(forbidden.has(key) && !inactiveGuard) && !(key === 'source' && child !== null && typeof child === 'object'), `Private public field at ${next}`);
    assertPublicOnly(child, next);
  }
}
export function assertGlobalPublic(projection, state) {
  assertPublicOnly(projection);
  const json = JSON.stringify(projection), secrets = [state.random.seed, state.door?.source?.actorId, state.door?.source?.historyDigest];
  for (const secret of secrets.filter(value => typeof value === 'string' && value.length))
    assert(!json.includes(secret), 'Whole public projection contains an actual private seed or source identity');
}
export function capturePublic(projection) {
  const fields = ['runId','revision','status','week','date','actionsRemaining','weeklyBudget','cash','weeklyWage','wagePaid',
    'health','mind','spirituality','maxHealth','maxMind','maxSpirituality','pollution','injuries','injuryRisk',
    'debtTotal','debts','canAct','actionBlockedReason','activeEvent','combat'];
  const result = { ...Object.fromEntries(fields.map(key => [key, clone(projection[key])])),
    progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
      mastery: clone(projection.progression.mastery) }, door: clone(projection.door) };
  assertPublicOnly(result); return result;
}
/** The runtime already recommends real wages, rest, clinic care, weeks,
 * physical clean-up and finite ordinary exits. Do not improvise a fallback or
 * infer that a refusal expires. A disabled/missing recommendation is evidence. */
export function chooseAction(view, previous) {
  assertPublicOnly(view); const policy = clone(previous);
  if (view.status !== 'ACTIVE') return { stop: 'NATURAL_ACTUAL_TERMINAL', reason: `Actual runtime status ${view.status}`, policy };
  if (view.activeEvent || view.combat) return { ...noProgress('An inherited event or combat cannot be bypassed by the Door chapter'), policy };
  if (policy.reported) return { stop: 'NATURAL_FINITE_DOOR_REPORTED', reason: 'The finite actual incident was honestly reported; all failed attempts and costs remain', policy };
  const preferred = view.door.actions.filter(action => action.preferredAction);
  if (preferred.length !== 1) return { ...noProgress(`Expected one intended public action, found ${preferred.length}; preserve this physical boundary`), policy };
  const action = preferred[0], c = action.command;
  if (!action.enabled) return { ...noProgress(`${action.label}: ${action.reason ?? 'Public prerequisite unresolved'}`), policy };
  if (!view.door.guidanceKnown && c.type !== 'LEARN_GUIDANCE') return { ...noProgress('The exact living source must first learn Door guidance'), policy };
  if (view.door.guidanceKnown && c.type === 'LEARN_GUIDANCE') return { ...noProgress('Never restart the already-owned chapter'), policy };
  if (c.type === 'SERVICE' && !SERVICE_IDS.includes(c.command.jobId)) return { ...noProgress('Only the same three ordinary service jobs are allowed'), policy };
  if (['START_EPILOGUE','EPILOGUE'].includes(c.type) && !view.door.promoted) return { ...noProgress('The separate epilogue requires actual living S0 promotion'), policy };
  if (c.type === 'CONSUME' && policy.doses >= POLICY.carrierLimit) return { ...noProgress('No fourth ordinary carrier is allowed'), policy };
  if (c.type === 'MATERIAL' && c.command.type === 'BUY_COMPOUND' && (!CARRIER_IDS.includes(c.command.batchId) || policy.carriers.includes(c.command.batchId) || policy.carriers.length >= POLICY.carrierLimit))
    return { ...noProgress('The same finite carrier cannot be duplicated'), policy };
  if (c.type === 'CONSUME' && (typeof c.compoundId !== 'string' || c.confirmed !== true || policy.consumedCompounds.includes(c.compoundId))) return { ...noProgress('The displayed actual-risk confirmation is missing or this exact compound was already consumed'), policy };
  if (c.type === 'EPILOGUE' && policy.epilogueAttempted.includes(c.command.type))
    return { ...noProgress('A finite technique already attempted cannot be rerolled'), policy };
  policy.phase = !view.door.guidanceKnown ? 'DOOR_ENTRY' : view.door.promoted ? 'DOOR_EPILOGUE' : 'DOOR_SERVICES_MATERIALS_PROMOTION';
  return { action: actionOf(action), reason: 'Follow the exact enabled runtime-preferred public action; retain its actual costs and outcome', policy };
}
export function publicActionStillAvailable(view, action) {
  return action.intent.type === 'DOOR' && view.door.actions.some(candidate => candidate.enabled &&
    isDeepStrictEqual(actionOf(candidate), action));
}
export function loopDiagnostic(before, after, policy) {
  const semantic = view => ({ phase: policy.phase, sequence: view.progression.sequence, acting: view.progression.acting,
    mastery: view.progression.mastery, progress: view.door.sections.filter(section => !['clock','recent-action','finance','body'].includes(section.id)),
    intended: view.door.actions.filter(action => action.preferredAction).map(action => action.command) });
  const gained = after.cash > before.cash || after.health > before.health || after.mind > before.mind ||
    after.spirituality > before.spirituality || after.pollution < before.pollution || after.injuries.length < before.injuries.length;
  const key = stateHash(semantic(after));
  const cycleKey = stateHash({ ...semantic(after), cash: after.cash, actionsRemaining: after.actionsRemaining,
    health: after.health, mind: after.mind, spirituality: after.spirituality, pollution: after.pollution,
    injuries: after.injuries, injuryRisk: after.injuryRisk, debtTotal: after.debtTotal });
  const recent = [...policy.loop.recent, cycleKey].slice(-32);
  return { key, repetitions: isDeepStrictEqual(semantic(before), semantic(after)) && !gained ? policy.loop.repetitions + 1 : 0,
    recent, cycleRepeats: recent.filter(value => value === cycleKey).length - 1 };
}
export function advancePolicy(decision, after, before) {
  const p = clone(decision.policy), c = decision.action.intent.command; p.week = after.week;
  if (c.type === 'CONSUME') {
    assert(!p.consumedCompounds.includes(c.compoundId)); p.consumedCompounds.push(c.compoundId);
    p.doses++; assert(p.doses <= POLICY.carrierLimit);
  }
  if (c.type === 'MATERIAL' && c.command.type === 'BUY_COMPOUND') {
    assert(CARRIER_IDS.includes(c.command.batchId)); assert(!p.carriers.includes(c.command.batchId)); p.carriers.push(c.command.batchId); assert(p.carriers.length <= POLICY.carrierLimit);
  }
  if (c.type === 'EPILOGUE') {
    if (['CONCEPTUAL_ESCAPE','SEAL_EXIT'].includes(c.command.type)) {
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
  assert(existsSync(join(root, 'dist/domain/door/owned-session.js')), 'Build and freeze the reviewed runtime before capture; no game was loaded');
  for (const name of new Set(['package.json','package-lock.json','src','dist/domain','dist/content','dist/resolution','dist/persistence','dist/shared','dist/application','dist/simulation','node_modules/@noble/hashes'])) walk(name);
  files.push({ file: '$natural-producer', ...fileEvidence(SELF) });
  files.push({ file: 'scripts/play/door-stage.test.mjs', ...fileEvidence(join(root, 'scripts/play/door-stage.test.mjs')) });
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
  assert.equal(stateHash(source), SOURCE_STATE_SHA256, 'Use the exact restored196 living final; no alternate boundary');
  assert.equal(commands.length, PREFIX_COUNT); assert.equal(compactHash(commands), PREFIX_SHA256);
  assert.equal(source.schemaVersion, 193); assert.equal(source.contentVersion, 'star-key-v193');
  assert.equal(source.runId, 'apprentice-rebuild-natural'); assert.equal(source.revision, SOURCE_REVISION);
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.week, POLICY.startWeek); assert.equal(archive.seed, source.random.seed);
  assert.deepEqual([source.health, source.mind, source.spirituality, source.cash, source.actionsRemaining], [80,98,120,3900,3]);
  assert.deepEqual(source.date, { epoch: 'FIFTH_EPOCH', year: 1353, month: 8, day: 25 });
  assert.deepEqual(source.random, { seed: 'secrets-sorcerer-directed-24', cursor: 205 });
  assert.deepEqual(source.injuries.map(({ severity, treatedRevision }) => ({ severity, treatedRevision })), [
    { severity: 'LIGHT', treatedRevision: null }, { severity: 'LIGHT', treatedRevision: null }]);
  assert.equal(source.injuryRisk, 1); assert.equal(source.progression.pathwayId, 'door'); assert.equal(source.progression.sequence, 1);
  assert.equal(source.progression.acting, 100); assert.equal(source.starKey.life.reflected, true);
  assert.equal(source.starKey.promotionWeek, 208);
  assert.deepEqual(source.starKey.bottles.map(bottle => bottle.outcome), ['FAILURE','SUCCESS',null]);
  assert.equal(source.starKey.encounter.enemyStatus, 'DEAD');
  assert.equal(source.combatHistory.length, 30);
  assert.deepEqual(source.starKey.bottles.map(bottle => bottle.status), ['CONSUMED','CONSUMED','SUPPLIER']);
  assert.equal(Object.keys(source.progression.mastery).length, 17); assert.equal(Object.values(source.progression.mastery).filter(value => value === 0).length, 8);
  assert.equal(source.combat, null); assert.equal(source.activeEvent, null);
  const files = INPUTS.map((pin, index) => ({ ...pin, bytes: buffers[index].length }));
  return { source, commands, creation: archive.creation, seed: archive.seed, buffers,
    inputFreeze: { format: 'NEW218_RESTORED196_HISTORICAL_INPUTS_V1', sha256: compactHash(files), files,
      originalStateSha256: SOURCE_STATE_SHA256, stateHashEncoding: STATE_HASH_ENCODING, sourceRoot: 'final',
      prefixSha256: PREFIX_SHA256, prefixHashEncoding: PREFIX_HASH_ENCODING, archivedCommandCount: PREFIX_COUNT } };
}
async function loadRuntime(root) {
  const [slice, migration, session] = await Promise.all(['domain/slice/index','domain/slice/migration','domain/door/owned-session']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  return { ...slice, migrateSliceState: migration.migrateSliceState, openDoorRuntimeSession: session.openDoorRuntimeSession };
}
export function migrate(runtime, original) {
  const before = stateHash(original), state = runtime.migrateSliceState(original);
  assert.equal(stateHash(original), before, 'Migration mutated historical input');
  for (const [key,value] of Object.entries(original)) if (!['schemaVersion','contentVersion'].includes(key))
    assert.deepEqual(state[key], value, `Migration changed original ${key}`);
  assert.equal(state.schemaVersion, CURRENT_SCHEMA_VERSION); assert.equal(state.contentVersion, CURRENT_CONTENT_VERSION);
  runtime.assertValidSliceState(state); return state;
}
/** Audit only after the real action. Never use private receipts to choose a
 * command or to grant mastery; a passed cast alone is not an application. */
export function checkFiniteMastery(state) {
  const epilogue = state.door.epilogue;
  for (const technique of TECHNIQUES) {
    const journal = epilogue?.journal ?? [], window = epilogue?.[technique.window], impact = epilogue?.impacts[technique.impact];
    const casts = journal.filter(event => event.command.type === technique.cast);
    assert(casts.length <= 1, 'A finite Door technique was repeated');
    let actual = 0;
    for (const event of journal) {
      const gain = event.masteryGains[technique.id] ?? 0;
      assert(Number.isSafeInteger(gain) && gain >= 0);
      if (gain) {
        assert.notEqual(event.command.type, technique.cast, 'Only an actual application can grant mastery');
        assert.equal(gain, 8, 'One finite impact grants exactly eight mastery');
        assert.equal(window?.applied, true, 'Mastery needs an actually applied window');
        assert.equal(window.passed, true); assert.equal(casts.length, 1);
        assert.equal(window.openedEventId, casts[0].eventId);
        assert.equal(window.appliedEventId, event.eventId, 'The actual settling event must own the gain');
        assert.equal(impact.status, technique.outcome, 'Mastery requires the actual specified impact to be handled');
        assert.equal(impact.resolvedEventId, event.eventId); assert.equal(impact.resolvedSecond, window.appliedSecond);
        assert.equal(window.targetId, technique.impact === 'spring' ? impact.id : epilogue.exit.id);
        actual += gain;
      }
    }
    assert(actual <= 8, 'A finite impact cannot grant mastery twice');
    assert.equal(Boolean(window?.applied), actual === 8, 'An actual application and its receipt must agree');
    assert.equal(state.progression.mastery[technique.id] ?? 0, actual, 'New mastery must equal actual finite application receipts');
  }
}
export function checkOriginals(state, original, before) {
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, original.random.seed); assert(state.random.cursor >= before.random.cursor);
  for (const key of FROZEN_SOURCE_KEYS)
    assert.deepEqual(state[key], original[key], `Frozen original history changed: ${key}`);
  assert.deepEqual(state.character, original.character, 'Original identity, wage and core stats remain exact');
  for (const [id, value] of Object.entries(original.progression.mastery)) assert.equal(state.progression.mastery[id], value, `Original mastery changed: ${id}`);
  assert.deepEqual(Object.keys(state.progression.mastery).sort(), [...Object.keys(original.progression.mastery), ...(state.progression.sequence === 0 ? TECHNIQUES.map(t => t.id) : [])].sort(), 'No extra old or new mastery keys');
  checkFiniteMastery(state);
  if (before.door.guidanceKnown) assert.deepEqual(state.door.source, before.door.source, 'The authenticated source cannot be replaced');
  if (state.status === 'DEAD') assert.equal(state.ending?.kind, 'DEATH', 'Terminal death keeps the global DEATH ending kind');
  assert.equal(state.activeEvent, null); assert.equal(state.combat, null); assert.deepEqual(state.eventQueue, []); assert.equal(state.pulse, 'NONE');
}
export function selectionOutcome(after) {
  return { status: after.status, sequence: after.progression.sequence, promoted: after.door.promoted, guidance: after.door.guidanceKnown };
}
/** Sampling never removes full captures. Reserve one of the 64 selected
 * boundaries for actual terminal status; ordinary named samples use at most 63. */
export function selectedBoundary(intent, after, previous) {
  if (previous.length >= POLICY.selectedBoundaryLimit) return null;
  const c = intent.command, outcome = 'door' in after ? selectionOutcome(after) : after; let key = null;
  if (outcome.status !== 'ACTIVE')
    return previous.some(boundary => boundary.kind === 'door-actual-terminal') ? null : 'door-actual-terminal';
  if (previous.filter(boundary => boundary.kind !== 'door-actual-terminal').length >=
      POLICY.selectedBoundaryLimit - POLICY.selectedBoundaryTerminalReserve) return null;
  if (['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','STABILIZE_PROMOTION','START_EPILOGUE','RETURN_ON_FOOT'].includes(c.type)) key = `door-${c.type.toLowerCase()}`;
  if (c.type === 'TRAVEL') key = `door-travel-${c.to}`;
  if (c.type === 'SERVICE') key = `service-${c.command.jobId}-${c.command.type.toLowerCase()}`;
  if (c.type === 'MATERIAL') key = `material-${c.command.type.toLowerCase()}-${c.command.bottleId ?? c.command.step ?? c.command.batchId ?? c.command.compoundId ?? 'unique'}`;
  if (c.type === 'CONSUME') key = outcome.promoted ? 'door-actual-promotion' : `door-failed-dose-${c.compoundId}`;
  if (c.type === 'EPILOGUE') key = `epilogue-${c.command.type.toLowerCase()}`;
  return key && !previous.some(boundary => boundary.kind === key) ? key : null;
}
export function verifyCheckpoint(payload, freeze, initialStateSha256, inputFreeze) {
  assert.equal(payload.format, FORMAT); assert.equal(payload.source, SOURCE); assert.equal(payload.sourceSha256, SOURCE_SHA256);
  assert.equal(payload.prefixHashEncoding, PREFIX_HASH_ENCODING); assert.equal(payload.stateHashEncoding, STATE_HASH_ENCODING);
  assert.equal(payload.prefixSha256, PREFIX_SHA256); assert.equal(payload.runtimeFreezeSha256, freeze.sha256);
  assert.equal(payload.inputFreezeSha256, inputFreeze.sha256); assert.deepEqual(payload.policyDefinition, POLICY);
  assert.equal(payload.initialStateSha256, initialStateSha256); assert.equal(payload.migration.originalStateSha256, SOURCE_STATE_SHA256);
  assert.equal(payload.migration.migratedStateSha256, initialStateSha256);
  assert.equal(payload.migration.fromSchema, 193); assert.equal(payload.migration.toSchema, CURRENT_SCHEMA_VERSION);
  assert.equal(payload.commandCount, PREFIX_COUNT + payload.commands.length); assert.equal(payload.rows.length, payload.commands.length);
  assert.equal(payload.finalStateSha256, stateHash(payload.state));
  assert.equal(payload.state.revision, SOURCE_REVISION + payload.commands.length);
  for (const key of ['initialGlobalPublicSha256','globalPublicStateSha256']) assert(/^[a-f0-9]{64}$/.test(payload[key] ?? ''), `Missing or invalid ${key}`);
  let state = initialStateSha256, publicHash = payload.initialPublicSha256, globalPublicHash = payload.initialGlobalPublicSha256, randomHash = payload.initialRandomSha256, policyHash = stateHash(startingPolicy());
  const selected = [];
  for (const [index,row] of payload.rows.entries()) {
    assert.equal(row.commandCount, PREFIX_COUNT + index + 1); assert.deepEqual(row.intent, payload.commands[index]);
    for (const key of ['globalPublicBeforeSha256','globalPublicAfterSha256']) assert(/^[a-f0-9]{64}$/.test(row[key] ?? ''), `Missing or invalid ${key}`);
    assert.equal(row.intent.type, 'DOOR'); assert.equal(row.commandSha256, compactHash(row.intent)); assert.equal(row.beforeStateSha256, state);
    assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.globalPublicBeforeSha256, globalPublicHash); assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore)); assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    assert.equal(row.randomBefore.seed, row.randomAfter.seed); assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    assert.deepEqual(Object.keys(row.selectionOutcome).sort(), ['guidance','promoted','sequence','status']);
    assert([0,1].includes(row.selectionOutcome.sequence));
    assert.equal(typeof row.selectionOutcome.guidance, 'boolean');
    assert.equal(typeof row.selectionOutcome.promoted, 'boolean'); assert.equal(typeof row.selectionOutcome.status, 'string');
    assert.equal(row.revision, SOURCE_REVISION + index + 1);
    assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
    assert(Number.isSafeInteger(row.capture.bytes) && row.capture.bytes > 0); assert(/^[a-f0-9]{64}$/.test(row.capture.sha256));
    const kind = selectedBoundary(row.intent, row.selectionOutcome, selected);
    if (kind) selected.push({ kind, commandCount: row.commandCount });
    state = row.afterStateSha256; publicHash = row.publicAfterSha256; globalPublicHash = row.globalPublicAfterSha256; randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(state, payload.finalStateSha256); assert.equal(publicHash, payload.publicStateSha256); assert.equal(globalPublicHash, payload.globalPublicStateSha256); assert.equal(randomHash, stateHash(payload.state.random)); assert.equal(policyHash, stateHash(payload.policy));
  assert(Array.isArray(payload.policy.loop.recent) && payload.policy.loop.recent.length <= 32);
  assert(payload.policy.loop.recent.every(value => /^[a-f0-9]{64}$/.test(value)));
  assert(Number.isSafeInteger(payload.policy.loop.repetitions) && payload.policy.loop.repetitions >= 0);
  assert(Number.isSafeInteger(payload.policy.loop.cycleRepeats) && payload.policy.loop.cycleRepeats >= 0);
  assert.equal(payload.policy.week, payload.state.week); assert(Number.isInteger(payload.policy.doses) && payload.policy.doses >= 0 && payload.policy.doses <= POLICY.carrierLimit);
  assert.equal(payload.policy.consumedCompounds.length, payload.policy.doses);
  assert.equal(new Set(payload.policy.consumedCompounds).size, payload.policy.doses);
  assert(payload.policy.carriers.every(id => CARRIER_IDS.includes(id)));
  assert(payload.policy.carriers.length <= POLICY.carrierLimit); assert.equal(new Set(payload.policy.carriers).size, payload.policy.carriers.length);
  assert(payload.policy.epilogueAttempted.every(type => ['CONCEPTUAL_ESCAPE','SEAL_EXIT'].includes(type)));
  assert.equal(new Set(payload.policy.epilogueAttempted).size, payload.policy.epilogueAttempted.length);
  assert.deepEqual(payload.boundaries.map(({ kind,commandCount }) => ({ kind,commandCount })), selected, 'Selected evidence must rederive from actual public outcomes');
  assert(payload.boundaries.length <= POLICY.selectedBoundaryLimit); assert.equal(new Set(payload.boundaries.map(b => b.kind)).size, payload.boundaries.length);
  for (const boundary of payload.boundaries) {
    const row = payload.rows[boundary.commandCount - PREFIX_COUNT - 1];
    assert.deepEqual({ file: boundary.file, bytes: boundary.bytes, sha256: boundary.sha256 }, row.capture);
  }
  assert.equal(typeof payload.policy.reported, 'boolean');
  assert.equal(payload.policy.reported, payload.state.door.epilogue?.reported ?? false, 'Report only the actual epilogue reported boolean');
  if (payload.state.door.epilogue) assert(['ACTIVE','RESOLVED','WITHDRAWN'].includes(payload.state.door.epilogue.status), 'Door epilogue status is separate from reported');
  if (payload.terminal) {
    assert.equal(payload.pending, null);
    assert(['NATURAL_ACTUAL_TERMINAL','NATURAL_FINITE_DOOR_REPORTED'].includes(payload.terminal.stage));
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
  const result = { out, resume: null, maxNewCommands: POLICY.defaultObservationActions, stopAfterCommand: null, pauseFlag: join(dirname(out), 'PAUSE') }, seen = new Set();
  for (let index = 0; index < args.length; index++) {
    let flag = args[index]; if (['--max-actions','--max-new-actions'].includes(flag)) flag = '--max-new-commands';
    const value = args[++index]; assert(value !== undefined, `Missing value for ${flag}`);
    assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--out') assert.equal(resolve(root, value), out, `The only authorized output is ${OUTPUT}`);
    else if (flag === '--resume') { assert.equal(resolve(root, value), checkpoint, 'Resume only the exact natural-v1 checkpoint'); result.resume = checkpoint; }
    else if (flag === '--max-new-commands' || flag === '--stop-after-command') {
      assert(/^\d+$/.test(value)); const number = Number(value); assert(Number.isSafeInteger(number));
      if (flag === '--max-new-commands') result.maxNewCommands = number;
      else { assert(number >= PREFIX_COUNT, 'A stop boundary cannot precede living823'); result.stopAfterCommand = number; }
    } else throw Error(`Unsupported ${flag}: no source, seed, roll, strategy, resource or outcome overrides`);
  }
  return result;
}
export function readCapture(path) {
  const bytes = readFileSync(path); return JSON.parse(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8'));
}
/** A portable byte manifest for a closed action boundary. This is a recovery
 * contract, not a claim that a tar upload or SQLite reopen has been tested.
 * Copy the WHOLE directory and reopen against the separately frozen checkout. */
export function writeRecoveryManifest(directory) {
  const interrupted = join(directory, `${RECOVERY_MANIFEST}.derived-next`);
  if (existsSync(interrupted)) {
    let preserved = `${interrupted}.incomplete`, suffix = 0;
    while (existsSync(preserved)) preserved = `${interrupted}.incomplete-${++suffix}`;
    renameSync(interrupted, preserved); syncDirectory(directory);
  }
  const checkpoint = decodeCheckpoint(readFileSync(join(directory, 'checkpoint.json.gz')));
  assert.equal(checkpoint.payload.pending, null, 'Package only a complete action boundary');
  const files = readdirSync(directory).filter(file => file !== RECOVERY_MANIFEST).sort()
    .map(file => ({ file, ...fileEvidence(join(directory, file)) }));
  const payload = { format: `${FORMAT}_RECOVERY`, commandCount: checkpoint.payload.commandCount,
    checkpointSha256: checkpoint.sha256, inputFreezeSha256: checkpoint.payload.inputFreezeSha256,
    runtimeFreezeSha256: checkpoint.payload.runtimeFreezeSha256,
    runtimeRequirement: 'SEPARATE_EXACT_FROZEN_CHECKOUT_AND_NODE_VERSION', files };
  replaceDerived(join(directory, RECOVERY_MANIFEST), JSON.stringify({ sha256: stateHash(payload), payload }));
  return payload;
}
export function verifyRecoveryManifest(directory) {
  const { sha256, payload } = readCapture(join(directory, RECOVERY_MANIFEST));
  assert.equal(sha256, stateHash(payload), 'Recovery manifest checksum mismatch');
  assert.equal(payload.format, `${FORMAT}_RECOVERY`);
  assert.equal(payload.runtimeRequirement, 'SEPARATE_EXACT_FROZEN_CHECKOUT_AND_NODE_VERSION');
  const names = payload.files.map(item => item.file);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(readdirSync(directory).filter(file => file !== RECOVERY_MANIFEST).sort(), names,
    'Recovery directory must retain every declared byte and no unknown entries');
  for (const item of payload.files) {
    assert(item.file && !/[\\/]/.test(item.file) && !['.','..'].includes(item.file), 'Unsafe recovery member');
    assert.deepEqual(fileEvidence(join(directory, item.file)), { bytes: item.bytes, sha256: item.sha256 }, `Recovery member changed: ${item.file}`);
  }
  const checkpoint = decodeCheckpoint(readFileSync(join(directory, 'checkpoint.json.gz')));
  assert.equal(checkpoint.sha256, payload.checkpointSha256); assert.equal(checkpoint.payload.pending, null);
  assert.equal(checkpoint.payload.commandCount, payload.commandCount);
  assert.equal(checkpoint.payload.inputFreezeSha256, payload.inputFreezeSha256);
  assert.equal(checkpoint.payload.runtimeFreezeSha256, payload.runtimeFreezeSha256);
  return payload;
}
export function actualReceipts(next, before) {
  const latest = next.door.journal.at(-1);
  if (latest?.revision === next.revision) return { checks: clone(latest.randomReceipts), finance: clone(latest.financeReceipts), notes: clone(latest.notes) };
  assert(!before.door.guidanceKnown && next.door.guidanceKnown, 'An owned action must have its actual journal receipt');
  return { checks: [], finance: [], notes: clone(next.chronicle.slice(before.chronicle.length)) };
}
/** Pause limits count newly completed actions in this invocation. A durable
 * pending command is finished exactly once before a nonzero pause; a zero-action
 * strict reopen rejects pending work instead of executing it. */
export function observationPause(boundary, completed, options, requested = false) {
  assert(options.maxNewCommands !== 0 || !boundary.pending, 'Zero-action strict resume requires a completed action boundary');
  return !boundary.pending && (requested || completed >= options.maxNewCommands ||
    options.stopAfterCommand !== null && boundary.commandCount >= options.stopAfterCommand);
}
export function initialCheckpoint(initial, globalView, freeze, inputFreeze, createdAt) {
  const view = capturePublic(globalView), hash = stateHash(initial);
  return { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, prefixSha256: PREFIX_SHA256,
    prefixHashEncoding: PREFIX_HASH_ENCODING, stateHashEncoding: STATE_HASH_ENCODING,
    inputFreezeSha256: inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256, policyDefinition: POLICY, policy: startingPolicy(),
    migration: { originalStateSha256: SOURCE_STATE_SHA256, migratedStateSha256: hash, fromSchema: 193, toSchema: CURRENT_SCHEMA_VERSION },
    createdAt, commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state: initial,
    initialStateSha256: hash, finalStateSha256: hash, initialPublicSha256: stateHash(view), publicStateSha256: stateHash(view),
    initialGlobalPublicSha256: stateHash(globalView), globalPublicStateSha256: stateHash(globalView),
    initialRandomSha256: stateHash(initial.random), pending: null, terminal: null };
}
export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), root = process.cwd();
  assert.equal(resolve(root, 'scripts/play/door-stage.mjs'), SELF, 'Run from the matching reviewed frozen repository root');
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
  const originals = ['archived-original196-natural.json.gz'];
  const initialCapture = { originalStateSha256: SOURCE_STATE_SHA256, migratedStateSha256: initialHash,
    publicSha256: stateHash(initialView), globalPublicSha256: stateHash(initialGlobal),
    final: initial, random: initial.random, public: initialView, globalPublic: initialGlobal };
  assert.equal(dirname(checkpointPath), options.out);
  let saved, session = null, stage = null, reason = null, count = 0, pauseRequested = false;
  const requestPause = () => { pauseRequested = true; };
  // The transient operator signal is outside the immutable full capture manifest.
  options.pauseFlag ??= join(dirname(options.out), 'PAUSE');
  if (options.resume) {
    assert.deepEqual(readCapture(freezePath), freeze, 'Frozen runtime/producer drift; never resume with changed rules');
    assert.deepEqual(readCapture(inputPath), old.inputFreeze, 'Frozen historical inputs drifted');
    assert.equal(sha(readFileSync(join(options.out, 'producer.mjs'))), freeze.files.find(file => file.file === '$natural-producer').sha256, 'Retained producer changed');
    assert.equal(sha(readFileSync(join(options.out, 'producer-tests.mjs'))), freeze.files.find(file => file.file === 'scripts/play/door-stage.test.mjs').sha256, 'Retained producer tests changed');
    for (const [index,file] of originals.entries()) assert.equal(sha(gunzipSync(readFileSync(join(options.out, file)))), INPUTS[index].sha256, 'Retained original evidence changed');
    if (options.maxNewCommands === 0) {
      assert(!existsSync(`${checkpointPath}.next`), 'Zero-action strict resume cannot adopt a pending checkpoint successor');
      assert.equal(decodeCheckpoint(readFileSync(checkpointPath)).payload.pending, null, 'Zero-action strict resume requires a completed action boundary');
      verifyRecoveryManifest(options.out);
    } else if (!existsSync(`${checkpointPath}.next`) && existsSync(join(options.out, RECOVERY_MANIFEST)) &&
      decodeCheckpoint(readFileSync(checkpointPath)).payload.pending === null) verifyRecoveryManifest(options.out);
    recoverAtomicNext(checkpointPath); saved = decodeCheckpoint(readFileSync(checkpointPath)); verifyCheckpoint(saved.payload, freeze, initialHash, old.inputFreeze);
    if (saved.payload.terminal) ({ stage, reason } = saved.payload.terminal);
  } else {
    assert.equal(readdirSync(options.out).length, 0, 'Refuse to overwrite an existing capture; use exact --resume');
    durableCreate(freezePath, JSON.stringify(freeze)); durableCreate(inputPath, JSON.stringify(old.inputFreeze)); durableCreate(join(options.out, 'producer.mjs'), readFileSync(SELF));
    durableCreate(join(options.out, 'producer-tests.mjs'), readFileSync(join(root, 'scripts/play/door-stage.test.mjs')));
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
    if (saved.payload.state.door.guidanceKnown) session = runtime.openDoorRuntimeSession(saved.payload.state);
    const projectGlobal = () => { const projection = session ? session.project() : runtime.projectSliceState(saved.payload.state); assertGlobalPublic(projection, saved.payload.state); return projection; };
    const project = () => capturePublic(projectGlobal()), reopened = projectGlobal();
    assert.equal(stateHash(capturePublic(reopened)), saved.payload.publicStateSha256, 'Reopened current-chapter public boundary changed');
    assert.equal(stateHash(reopened), saved.payload.globalPublicStateSha256, 'Reopened whole public boundary changed');
    for (const row of saved.payload.rows) {
      assert.deepEqual(fileEvidence(join(options.out, row.capture.file)), { bytes: row.capture.bytes, sha256: row.capture.sha256 });
      const content = readCapture(join(options.out, row.capture.file)); verifyActionCapture(content, row);
      checkOriginals(content.final, old.source, content.beforeLast);
    }
    for (const boundary of saved.payload.boundaries) assert.deepEqual(fileEvidence(join(options.out, boundary.file)), { bytes: boundary.bytes, sha256: boundary.sha256 });
    if (options.resume && options.maxNewCommands === 0) {
      unchanged(stamps); assert.deepEqual(inspectFreeze(root), freeze); assert.deepEqual(readSource(root).inputFreeze, old.inputFreeze);
      runtime.assertValidSliceState(saved.payload.state); verifyRecoveryManifest(options.out);
      if (session) { assert.equal(stateHash(session.snapshot()), saved.payload.finalStateSha256); }
      const result = { outputDir: options.out, stage: 'STRICT_RESUME_VERIFIED_ZERO_ACTIONS', commands: saved.payload.commandCount,
        newActions: 0, existingStage: stage, changedCaptureBytes: false };
      console.log(JSON.stringify(result)); return result;
    }
    while (!stage) {
      await new Promise(resolve => setImmediate(resolve));
      unchanged(stamps); const boundary = saved.payload;
      if (boundary.state.status !== 'ACTIVE') { stage = 'NATURAL_ACTUAL_TERMINAL'; reason = `Actual runtime status ${boundary.state.status}`; break; }
      if (boundary.policy.reported) { stage = 'NATURAL_FINITE_DOOR_REPORTED'; reason = 'The finite actual incident was honestly reported; all failed attempts and costs remain'; break; }
      if (observationPause(boundary, count, options, pauseRequested || existsSync(options.pauseFlag))) {
        stage = 'MANUAL_PAUSE'; reason = 'Paused at the requested durable completed-action boundary; resume the exact frozen policy'; break;
      }
      if (!boundary.pending && (boundary.policy.loop.repetitions >= 6 || boundary.policy.loop.cycleRepeats >= 3)) {
        stage = 'PUBLIC_NO_PROGRESS_DIAGNOSTIC'; reason = 'Accepted actions repeated the same meaningful public boundary without retained material progress; preserve every paid action and diagnose the exact public controls'; break;
      }
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
        if (next.door.guidanceKnown) session = runtime.openDoorRuntimeSession(next);
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
    if (saved.payload.state.door.guidanceKnown) {
      const strict = runtime.openDoorRuntimeSession(saved.payload.state); assert.equal(stateHash(strict.snapshot()), saved.payload.finalStateSha256);
      const strictGlobal = strict.project(); assertGlobalPublic(strictGlobal, saved.payload.state);
      assert.equal(stateHash(capturePublic(strictGlobal)), saved.payload.publicStateSha256); assert.equal(stateHash(strictGlobal), saved.payload.globalPublicStateSha256);
    }
    const paused = stage === 'MANUAL_PAUSE', diagnostic = stage.startsWith('PUBLIC_');
    if (!paused && !diagnostic && !saved.payload.terminal) saved = saveCheckpoint(checkpointPath, { ...saved.payload, terminal: { stage, reason } }, saved.sha256);
    const view = project();
    replaceDerived(join(options.out, 'commands.ndjson.gz'), gzipSync(saved.payload.rows.map(row => JSON.stringify(row)).join('\n') + (saved.payload.rows.length ? '\n' : ''), { level: 6 }));
    replaceDerived(join(options.out, 'boundaries.index.json'), JSON.stringify(saved.payload.boundaries));
    replaceDerived(join(options.out, 'natural.json.gz'), gzipSync(JSON.stringify({ provenance: { kind: 'NEW218_FROM_RESTORED196_LIVING823_PUBLIC_DOOR_CONTINUATION',
      format: 'NEW218_REBUILD_PROVENANCE_V1', newNatural218: true, rebuiltFromRestoredVolume196: true,
      source: SOURCE, sourceSha256: SOURCE_SHA256, sourceRoot: 'final', originalStateSha256: SOURCE_STATE_SHA256, originalEvidence: originals,
      prefixCommandsSha256: PREFIX_SHA256, prefixCommandsHashEncoding: PREFIX_HASH_ENCODING, stateHashEncoding: STATE_HASH_ENCODING, inputFreezeSha256: old.inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256,
      historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, completeOriginalSourceRetainedExactly: true, alternateSourceUsed: false,
      privateAudit: true, seedChanged: false, randomOverridden: false, futureDrawInspected: false, selectedFromEnabledPublicActionsOnly: true,
      everyActionEvidence: 'FULL_PRIVATE_RNG_CHAPTER_PUBLIC_AND_GLOBAL_PUBLIC_BEFORE_AND_AFTER_GZIP',
      selectedSQLiteBoundaries: 'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER', globalPublicScope: 'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH', projectionScope: 'POSITIVE_DOOR_AND_ORDINARY_PUBLIC_DASHBOARD' },
      creation: old.creation, seed: old.seed, prefixCount: PREFIX_COUNT, commands: [...old.commands,...saved.payload.commands],
      policy: POLICY, stage, reason, pendingIntent: saved.payload.pending?.intent ?? null, boundaries: saved.payload.boundaries, final: saved.payload.state }), { level: 6 }));
    replaceDerived(join(options.out, 'summary.json'), JSON.stringify({ stage, reason, commands: saved.payload.commandCount, originalCommands: PREFIX_COUNT,
      newCommands: saved.payload.commands.length, rebuild: 'NEW218', newNatural218: true, controlledStop: stage === 'MANUAL_PAUSE', week: saved.payload.policy.week, paused, diagnostic, strictFinalValidation: true,
      sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', packageReopenValidation: 'NOT_RUN_BY_PRODUCER',
      recoveryManifest: RECOVERY_MANIFEST, checkpoint: 'checkpoint.json.gz', public: view }));
    writeRecoveryManifest(options.out); verifyRecoveryManifest(options.out);
    console.log(JSON.stringify({ outputDir: options.out, stage, commands: saved.payload.commandCount, paused, diagnostic, recoveryManifest: RECOVERY_MANIFEST }));
    return { outputDir: options.out, stage, commands: saved.payload.commandCount, paused, diagnostic };
  } catch (error) {
    try { if (!(options.resume && options.maxNewCommands === 0)) replaceDerived(join(options.out, 'error.json'), JSON.stringify({ stage: 'CAPTURE_INTERRUPTED', error: String(error), commandCount: saved?.payload.commandCount ?? null, resumeExactPendingRequired: true, at: new Date().toISOString() })); }
    catch { /* Keep the first error, exact pending command and every durable boundary. */ }
    throw error;
  } finally { process.off('SIGINT', requestPause); process.off('SIGTERM', requestPause); }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
