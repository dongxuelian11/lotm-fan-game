import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync, gunzipSync } from 'node:zlib';
/** Static producer candidate. Invoke only after the parent freezes the reviewed
 * 213 build. Continue the exact living679 state, never replay its old commands,
 * inspect a future draw, substitute a seed or use the independent694 death. */
export const SOURCE = 'tests/fixtures/misfortune-knight-v01910/boundary-three-honest-reports-reflected.json';
export const SOURCE_SHA256 = '6e5889192d3a0c697640fc0bc1fadd680c7b8526088a11d8f920b602cf34b79f';
export const SNAPSHOT = 'tests/fixtures/misfortune-knight-v01910/snapshot-practiced.json';
export const SNAPSHOT_SHA256 = '470d3ae9700186d8488b27663a9c64060053a011cd57bed3a5054a275bf7b6ee';
export const ARCHIVE = 'tests/fixtures/misfortune-knight-v01910/natural.json';
export const ARCHIVE_SHA256 = '597112414e673dbb446dd17d860bd88541ca5007f6310d552c41f96b12462ae8';
export const PREFIX_COUNT = 679;
export const PREFIX_SHA256 = 'c34fb277dcd19280ebd2b3d31069dddb46619d20d12fed7710b0605af61d60c3';
export const FORMAT = 'DARKNESS679_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
export const INPUTS = Object.freeze([{ file: SOURCE, sha256: SOURCE_SHA256 }, { file: SNAPSHOT, sha256: SNAPSHOT_SHA256 }, { file: ARCHIVE, sha256: ARCHIVE_SHA256 }]);
export const POLICY = Object.freeze({ id: 'DARKNESS679_SAME_ORIGINAL_FOUR_REAL_EVACUEES_V1', startWeek: 158,
  wage: 180, weeklyLiving: 30, operatingReserve: 1500, defaultObservationActions: 500, selectedBoundaryLimit: 25, carrierLimit: 3,
  evacuation: 'FOUR_CONSENTING_ORIGINAL_ADULTS_REAL_DAY_SURVEY_NIGHT_ARRIVALS_AND_WALKED_RETURN',
  materials: 'THREE_SAME_ORIGINALS_DATED_1353_UNIQUENESS_ORDINARY_WAGES_AND_FINANCE',
  promotion: 'SAME_COMPOUND_PAID100P_70PERCENT_PREPARATION_INDEPENDENT_CONSUMPTION',
  failure: 'LIVING_SEAL_LATER_WEEK_PAID_RECOVERY_THREE_FINITE_CARRIERS_DEATH_ARCHIVED',
  epilogue: 'TWO_FINITE_ATTEMPTS_ACTUAL_APPLICATION_OR_ORDINARY_SIDE_EXIT_AND_HONEST_REPORT', noReroll: true });
const SELF = fileURLToPath(import.meta.url);
const clone = value => structuredClone(value);
const sha = value => createHash('sha256').update(value).digest('hex');
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const stateHash = value => sha(stable(value));
const compactHash = value => sha(JSON.stringify(value));
const section = (panel, id) => panel.sections?.find(item => item.id === id)?.lines ?? [];
const cash = panel => Number(String(panel.resources.cash).match(/^\d+/)?.[0] ?? NaN);
export const publicPrice = action => ({ actions: Number(action.cost.match(/(\d+)行动/)?.[1] ?? 0), cash: Number(action.cost.match(/(\d+)便士/)?.[1] ?? 0) });
export function startingPolicy() { return { phase: 'DARKNESS_ENTRY', week: 158, doses: 0, carriers: [], epilogueAttempted: [], reported: false,
  ordinaryExitReason: null, loop: { key: null, repetitions: 0 } }; }
const actionOf = action => ({ ...clone(action), intent: { type: 'DARKNESS', command: clone(action.command) } });
const noProgress = reason => ({ stop: 'PUBLIC_ACTION_BLOCKED', reason });

/** Exact field names, not broad substring bans: public prices.preparation and
 * check.modifiers[].source are lawful. Neither exposes a private source state. */
export function assertPublicOnly(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const labelSource = key === 'source' && /\.(?:(?:modifiers|debts|companions)\.\d+|companion|companionAfter|kit|expert)$/.test(path) && typeof child === 'string';
    assert(!['seed','cursor','randomSeed','randomCursor','random','rng','rngState','futureRoll','futureRolls','nextRoll','unrolledResult','privateSource','sourceState','frame','journal'].includes(key), `Private field at ${path}.${key}`);
    assert(key !== 'source' || labelSource, `Private source at ${path}.${key}`);
    assertPublicOnly(child, `${path}.${key}`);
  }
}
/** Whole-dashboard audit is separate from the current-chapter policy view.
 * Public scalar source labels and prices.preparation are legitimate; only the
 * two exact inactive null guard targets are exceptions to private actor IDs. */
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
  const ordinary = Object.fromEntries(fields.map(key => [key, clone(projection[key])]));
  const result = { ...ordinary, progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
    mastery: clone(projection.progression.mastery) }, darkness: clone(projection.darkness) };
  assertPublicOnly(result); return result;
}
function darknessAction(view, policy) {
  const d = view.darkness, actions = d.actions;
  const find = type => actions.find(a => a.command.type === type && a.enabled);
  const nested = (domain, type) => actions.find(a => a.command.type === domain && a.command.command.type === type && a.enabled);
  const select = (a, reason) => ({ action: actionOf(a), reason });
  const exit = reason => {
    policy.ordinaryExitReason = reason;
    const a = nested('EVACUATION', 'RELEASE') ?? nested('EVACUATION', 'ORDINARY_RETURN');
    return a ? select(a, `Take the actual ordinary safety exit, then stop for review: ${reason}`) : noProgress(`No enabled ordinary exit: ${reason}`);
  };
  const wait = (reason, reserve = POLICY.operatingReserve) => {
    if (find('WORK') && cash(d) < reserve) return select(find('WORK'), `Earn this real week's original180p wage: ${reason}`);
    if (find('NEXT_WEEK')) return select(find('NEXT_WEEK'), `Cross one actual week with living bills and old debts: ${reason}`);
    return d.insideCase ? exit(reason) : noProgress(`No enabled ordinary work/week route: ${reason}`);
  };
  const recover = reason => find('CLINIC') ? select(find('CLINIC'), 'Pay the real60p ordinary treatment; keep the same injury until later rest')
    : find('REST') ? select(find('REST'), reason) : wait(reason);
  const needsRest = () => d.resources.health < 100 || d.resources.mind < 100 || d.resources.spirituality < (d.promoted ? 150 : 120) || view.pollution > 0 || view.injuries.length > 0;
  if (policy.reported) return { stop: 'NATURAL_FINITE_DARKNESS_REPORTED', reason: 'The finite original-resident incident was honestly reported; no successful skill is forced' };
  if (policy.ordinaryExitReason) {
    if (!d.insideCase) return { stop: 'PUBLIC_ORDINARY_EXIT_REACHED', reason: policy.ordinaryExitReason };
    return exit(policy.ordinaryExitReason);
  }
  if (!d.guidanceKnown) {
    policy.phase = 'DARKNESS_ENTRY';
    const guidance = find('LEARN_GUIDANCE');
    return guidance ? select(guidance, 'Continue the exact living679 body with actual100p guidance; do not replay or alter its past')
      : noProgress('The exact679 public guidance is unavailable; do not replace its budget, old history or source');
  }
  policy.phase = d.promoted ? 'DARKNESS_EPILOGUE' : 'DARKNESS_EVACUATION_MATERIALS';
  const seal = nested('MATERIAL', 'SEAL_REMAINS');
  if (seal) return select(seal, 'Seal the actual failed compound in place before wages, rest or travel; nothing is refunded');
  const dose = actions.find(a => a.enabled && a.preferredAction && a.command.type === 'CONSUME');
  if (dose) {
    const prep = actions.find(a => a.command.type === 'STABILIZE_PROMOTION' && a.command.compoundId === dose.command.compoundId);
    if (policy.doses >= POLICY.carrierLimit) return { stop: 'NATURAL_CARRIERS_UNAVAILABLE', reason: 'Three actual finite doses have been consumed; no fourth carrier or redraw is allowed' };
    if (!prep || prep.enabled || !section(d, 'promotion-stability').some(line => /成功率70%；准备仍在原室和七天期限内有效/.test(line)))
      return { stop: 'PUBLIC_STABILITY_BINDING_BLOCKED', reason: 'The exact offered dose lacks visible same-compound paid70% preparation' };
    return select(dose, 'Consume the same paid prepared compound immediately; preserve the actual result, injuries, pollution or death');
  }
  const epilogue = actions.filter(a => a.command.type === 'EPILOGUE');
  if (epilogue.length) {
    const report = nested('EPILOGUE', 'REPORT');
    if (report) return select(report, 'Report only actual resident locations, damage, skill applications and ordinary returns');
    const next = epilogue.find(a => a.enabled && a.preferredAction && !policy.epilogueAttempted.includes(a.command.command.type));
    if (next) return select(next, 'Follow the finite actual incident once per technique, keeping real failures and ordinary exits');
    for (const type of ['SECURE_LOAD','ORDINARY_SIDE_EXIT','WITHDRAW']) {
      const a = nested('EPILOGUE', type);
      if (a && (type !== 'SECURE_LOAD' || !policy.epilogueAttempted.includes(type))) return select(a, 'Use the real ordinary stop, side path or personal return without requiring a magical success');
    }
    return noProgress('The finite incident offers neither its intended enabled action nor an ordinary exit');
  }
  const next = actions.find(a => a.preferredAction && !['WORK','REST','CLINIC','NEXT_WEEK','CONSUME','RETURN_ON_FOOT'].includes(a.command.type));
  if (!next) {
    if (policy.doses >= POLICY.carrierLimit && section(d, 'materials').some(line => /有限普通载体剩余0件/.test(line)) && !actions.some(a => a.command.type === 'MATERIAL' && ['SEAL_REMAINS','RECOVER_SEALED','COMPOSE_POTION'].includes(a.command.command.type)))
      return { stop: 'NATURAL_CARRIERS_UNAVAILABLE', reason: 'All three actual carriers are spent and the living same-original recovery is complete; no replacement supply exists' };
    return noProgress('No intended public progression step is marked; preserve this boundary instead of guessing a private prerequisite');
  }
  const c = next.command, cost = publicPrice(next);
  const handoff = c.type === 'MATERIAL' && c.command.type === 'ACQUIRE_UNIQUENESS';
  if (handoff && next.enabled) return select(next, 'Complete the already-verified same-week handoff before optional work or rest');
  if (c.type === 'EVACUATION') {
    // Real night movement and handling must not lose their window to an8-hour
    // wage/rest. Only the public enabled costs and controls decide readiness.
    if (['WAIT_NIGHT','BEGIN_NIGHT'].includes(c.command.type) && d.resources.actionsRemaining < 2)
      return wait('Reserve two real actions for opening this night and reporting the four actual arrivals');
    if (next.enabled) return select(next, 'Follow the current real survey, consent, adjacent walk, night hazard, individual escort or walked return');
    if (d.insideCase) return exit(`${next.label}: ${next.reason}`);
    if (d.resources.actionsRemaining < cost.actions || cash(d) < cost.cash) return wait(`${next.label}: ${next.reason}`, Math.max(cost.cash + POLICY.weeklyLiving, POLICY.operatingReserve));
    // A daytime survey may become unavailable at midnight. The actual original
    // work or ordinary rest advances eight hours; no clock is written directly.
    if (c.command.type === 'SURVEY_DAY' && /白昼/.test(next.reason ?? '')) return find('WORK') ? select(find('WORK'), 'Do real work until daylight before the actual survey') : recover('Ordinary rest until daylight before the actual survey');
    return noProgress(`${next.label}: ${next.reason ?? 'No available public evacuation step'}`);
  }
  if ((c.type === 'STABILIZE_PROMOTION' || c.type === 'START_EPILOGUE') && needsRest()) return recover('Recover this actual body, pollution and injuries before entering the paid risk or finite incident');
  if (c.type === 'STABILIZE_PROMOTION' && d.resources.actionsRemaining < 2) return wait('Reserve two real actions for paid preparation and its separate same-compound dose');
  if (c.type === 'START_EPILOGUE' && d.resources.actionsRemaining < 2) return wait('Reserve two real finite technique attempts; ordinary exits remain free');
  if (c.type === 'MATERIAL' && c.command.type === 'VERIFY_UNIQUENESS' && c.command.step === 'VACANCY') {
    const delivery = actions.find(a => a.command.type === 'MATERIAL' && a.command.command.type === 'ACQUIRE_UNIQUENESS');
    if (!delivery) return noProgress('The matching public same-week uniqueness handoff is missing');
    if (d.resources.actionsRemaining < cost.actions + publicPrice(delivery).actions || cash(d) < cost.cash + publicPrice(delivery).cash + POLICY.weeklyLiving)
      return wait('Reserve two actual actions and270p plus this week\'s30p living bill for vacancy verification and same-week handoff');
  }
  if (next.enabled) return select(next, 'Follow the exact enabled city, same-original material, dated custody, paid preparation or finite incident action');
  if (d.resources.actionsRemaining < cost.actions || cash(d) < cost.cash) return wait(`${next.label}: ${next.reason}`, Math.max(cost.cash + POLICY.weeklyLiving, POLICY.operatingReserve));
  if (/下一真实周|下一实际周|隔周|至少到下一|真实日期尚未到达/.test(next.reason ?? '')) return wait(`${next.label}: ${next.reason}`);
  if (/健康|精神|灵性|伤势|休养/.test(next.reason ?? '') && needsRest()) return recover(`Recover actual resources for ${next.label}`);
  return noProgress(`${next.label}: ${next.reason ?? 'Unresolved public prerequisite'}`);
}
export function chooseAction(view, previous) {
  const policy = clone(previous);
  if (view.status !== 'ACTIVE') return { stop: 'NATURAL_ACTUAL_TERMINAL', reason: `Actual runtime status ${view.status}`, policy };
  if (view.combat || view.activeEvent) return { ...noProgress('Unexpected old active scene; preserve it rather than replaying the independent694 death line'), policy };
  return { ...darknessAction(view, policy), policy };
}
export function loopDiagnostic(before, after, policy) {
  const semantic = v => ({ phase: policy.phase, sequence: v.progression.sequence, acting: v.progression.acting,
    health: v.health, mind: v.mind, spirituality: v.spirituality, pollution: v.pollution, cash: v.cash, debt: v.debtTotal,
    week: v.week, actions: v.darkness.actions.filter(a => a.preferredAction).map(a => [a.command,a.enabled,a.reason]),
    progress: v.darkness.sections.filter(s => !['clock','recent-action','finance'].includes(s.id)) });
  const key = stateHash(semantic(after)), unchanged = isDeepStrictEqual(semantic(before), semantic(after));
  return { key, repetitions: unchanged ? policy.loop.key === key ? policy.loop.repetitions + 1 : 1 : 0 };
}
export function advancePolicy(decision, after, before) {
  const p = clone(decision.policy), c = decision.action.intent.command; p.week = after.week;
  if (c.type === 'CONSUME') p.doses++;
  if (c.type === 'MATERIAL' && c.command.type === 'BUY_COMPOUND') { assert(!p.carriers.includes(c.command.batchId)); p.carriers.push(c.command.batchId); assert(p.carriers.length <= POLICY.carrierLimit); }
  if (c.type === 'EPILOGUE') { if (!p.epilogueAttempted.includes(c.command.type)) p.epilogueAttempted.push(c.command.type); if (c.command.type === 'REPORT') p.reported = true; }
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
  assert(existsSync(join(root, 'dist/domain/darkness/owned-session.js')), 'Build and freeze the reviewed runtime before capture; no game was loaded');
  for (const name of new Set(['package.json','package-lock.json','src','dist/domain','dist/content','dist/resolution','dist/persistence','dist/shared','dist/application','dist/simulation','node_modules/@noble/hashes'])) walk(name);
  files.push({ file: '$natural-producer', ...fileEvidence(SELF) });
  files.push({ file: 'scripts/play/darkness-stage.test.mjs', ...fileEvidence(join(root, 'scripts/play/darkness-stage.test.mjs')) });
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
function saveCheckpoint(path, payload, predecessorSha256) {
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
  const buffers = INPUTS.map(pin => { const bytes = readFileSync(join(root, pin.file)); assert.equal(sha(bytes), pin.sha256, `Frozen historical input changed: ${pin.file}`); return bytes; });
  const boundary = JSON.parse(buffers[0]), source = boundary.final, snapshot = JSON.parse(buffers[1]), archive = JSON.parse(buffers[2]);
  assert.deepEqual(source, snapshot, 'Living679 boundary must equal the untouched practiced snapshot');
  assert.equal(compactHash(source), SNAPSHOT_SHA256); assert.equal(archive.commands.length, 694); assert.equal(archive.final.status, 'DEAD');
  const commands = archive.commands.slice(0, PREFIX_COUNT);
  assert.equal(compactHash(commands), PREFIX_SHA256); assert.deepEqual(commands.at(-1), boundary.lastIntent);
  assert.equal(source.revision, 680); assert.equal(source.runId, 'sleepless-rebuild-natural');
  assert.equal(archive.seed, source.random.seed); assert.deepEqual(source.random, { seed: 'sleepless-natural-v020', cursor: 348 });
  assert.equal(source.schemaVersion, 188); assert.equal(source.contentVersion, 'misfortune-knight-v188');
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.week, 158);
  assert.deepEqual(source.date, { epoch: 'FIFTH_EPOCH', year: 1352, month: 7, day: 1 });
  assert.deepEqual([source.health,source.mind,source.spirituality,source.cash,source.actionsRemaining,source.seer.pollution], [100,97,112,400,3,0]);
  assert.deepEqual(source.injuries, []); assert.equal(source.character.coreStats.will, 31); assert.equal(source.character.weeklyWage, 180);
  assert.equal(source.lifeTier, 'DESTITUTE'); assert.equal(source.progression.pathwayId, 'darkness'); assert.equal(source.progression.sequence, 1);
  assert.equal(source.progression.acting, 100); assert.equal(source.misfortuneKnight.life.reflected, true);
  assert.deepEqual(source.misfortuneKnight.bottles.map(b => [b.id,b.status,b.outcome]), [1,2,3].map(n => [`misfortune-knight-potion-${n}`,'CONSUMED',n === 3 ? 'SUCCESS' : 'FAILURE']));
  assert.deepEqual(source.misfortuneKnight.acquisitionJournal.filter(j => j.command.type === 'CONSUME').map(j => [j.check.chance,j.check.roll,j.check.tier]), [[50,75,'FAILURE'],[50,56,'FAILURE'],[50,37,'SUCCESS']]);
  assert.equal(Object.keys(source.progression.mastery).length, 20); assert.equal(source.combat, null); assert.equal(source.activeEvent, null);
  const files = INPUTS.map((pin, index) => ({ ...pin, bytes: buffers[index].length }));
  return { source, commands, creation: archive.creation, seed: archive.seed, buffers,
    inputFreeze: { format: 'DARKNESS679_HISTORICAL_INPUTS_V1', sha256: compactHash(files), files, peacefulStateSha256: SNAPSHOT_SHA256, prefixSha256: PREFIX_SHA256, archivedCommandCount: 694 } };
}
async function loadRuntime(root) {
  const [slice, migration, session] = await Promise.all(['domain/slice/index','domain/slice/migration','domain/darkness/owned-session']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  return { ...slice, migrateSliceState: migration.migrateSliceState, openDarknessRuntimeSession: session.openDarknessRuntimeSession };
}
function migrate(runtime, original) {
  const before = stateHash(original), state = runtime.migrateSliceState(original);
  assert.equal(stateHash(original), before, 'Migration mutated historical input');
  for (const [key,value] of Object.entries(original)) if (!['schemaVersion','contentVersion'].includes(key)) assert.deepEqual(state[key], value, `Migration changed original ${key}`);
  assert.equal(state.schemaVersion, 210); assert.equal(state.contentVersion, 'darkness-v210');
  runtime.assertValidSliceState(state); return state;
}
export function checkOriginals(state, original, before) {
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, original.random.seed); assert(state.random.cursor >= before.random.cursor);
  for (const key of ['sleepless','midnight','nightmare','soother','spiritWarlock','nightwatcher','fearBishop','concealmentServant','misfortuneKnight','world','combatHistory'])
    assert.deepEqual(state[key], original[key], `Frozen original history changed: ${key}`);
  assert.deepEqual(state.character, original.character, 'Original identity, wage and will cannot be replaced');
  for (const [id,value] of Object.entries(original.progression.mastery)) assert.equal(state.progression.mastery[id], value, `Original mastery changed: ${id}`);
  assert.equal(state.combat, null); assert.equal(state.activeEvent, null);
  if (before.darkness.guidanceKnown) assert.deepEqual(state.darkness.source, before.darkness.source, 'Frozen actual S1 handoff cannot be replaced');
}
export function selectionOutcome(after) {
  return { status: after.status, promoted: after.darkness.promoted,
    arrivals: Number(section(after.darkness, 'darkness-evacuation').map(line => line.match(/^已到达(\d)\/4/)?.[1]).find(Boolean) ?? 0) };
}
/** Only first occurrence of each actual transition is sampled for subsequent
 * SQLite save/reopen checks. Every other complete command remains in the chain. */
export function selectedBoundary(intent, after, previous) {
  if (previous.length >= POLICY.selectedBoundaryLimit) return null;
  const c = intent.command, outcome = 'darkness' in after ? selectionOutcome(after) : after; let key = null;
  if (['LEARN_GUIDANCE','STABILIZE_PROMOTION','START_EPILOGUE'].includes(c.type)) key = `darkness-${c.type.toLowerCase()}`;
  if (c.type === 'EVACUATION') {
    if (['SHIELD_FALSE_LIGHT','RELAY_INSTRUCTIONS','REPORT'].includes(c.command.type)) key = `evacuation-${c.command.type.toLowerCase()}`;
    if (c.command.type === 'WALK' && c.command.to === 110 && outcome.arrivals > 0) key = `evacuation-actual-arrival-${outcome.arrivals}`;
  }
  if (c.type === 'MATERIAL') {
    if (['INVESTIGATE_LEGACY_REMAINS','RECOVER_LEGACY_REMAINS'].includes(c.command.type)) key = `material-${c.command.type.toLowerCase()}-${c.command.bottleId}`;
    if (['ACQUIRE_UNIQUENESS','COMPOSE_POTION','SEAL_REMAINS','RECOVER_SEALED'].includes(c.command.type)) key = `material-${c.command.type.toLowerCase()}`;
    if (c.command.type === 'VERIFY_UNIQUENESS') key = `uniqueness-${c.command.step.toLowerCase()}`;
  }
  if (c.type === 'CONSUME') key = outcome.status !== 'ACTIVE' ? 'darkness-actual-terminal-dose' : outcome.promoted ? 'darkness-actual-promotion' : 'darkness-first-failed-dose';
  if (c.type === 'EPILOGUE' && ['SHORT_CONCEALMENT','BOUNDED_MISFORTUNE_DIVERSION','REPORT'].includes(c.command.type)) key = `epilogue-${c.command.type.toLowerCase()}`;
  return key && !previous.some(b => b.kind === key) ? key : null;
}
export function verifyCheckpoint(payload, freeze, initialStateSha256, inputFreeze) {
  assert.equal(payload.format, FORMAT); assert.equal(payload.source, SOURCE); assert.equal(payload.sourceSha256, SOURCE_SHA256);
  assert.equal(payload.prefixSha256, PREFIX_SHA256); assert.equal(payload.runtimeFreezeSha256, freeze.sha256);
  assert.equal(payload.inputFreezeSha256, inputFreeze.sha256); assert.deepEqual(payload.policyDefinition, POLICY);
  assert.equal(payload.initialStateSha256, initialStateSha256); assert.equal(payload.migration.originalStateSha256, SNAPSHOT_SHA256);
  assert.equal(payload.migration.migratedStateSha256, initialStateSha256);
  assert.equal(payload.commandCount, PREFIX_COUNT + payload.commands.length); assert.equal(payload.rows.length, payload.commands.length);
  assert.equal(payload.finalStateSha256, stateHash(payload.state));
  for (const key of ['initialGlobalPublicSha256','globalPublicStateSha256']) assert(/^[a-f0-9]{64}$/.test(payload[key] ?? ''), `Missing or invalid ${key}`);
  let state = initialStateSha256, publicHash = payload.initialPublicSha256, globalPublicHash = payload.initialGlobalPublicSha256, randomHash = payload.initialRandomSha256, policyHash = stateHash(startingPolicy());
  const selected = [];
  for (const [index,row] of payload.rows.entries()) {
    assert.equal(row.commandCount, PREFIX_COUNT + index + 1); assert.deepEqual(row.intent, payload.commands[index]);
    for (const key of ['globalPublicBeforeSha256','globalPublicAfterSha256']) assert(/^[a-f0-9]{64}$/.test(row[key] ?? ''), `Missing or invalid ${key}`);
    assert.equal(row.intent.type, 'DARKNESS'); assert.equal(row.commandSha256, compactHash(row.intent)); assert.equal(row.beforeStateSha256, state);
    assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.globalPublicBeforeSha256, globalPublicHash); assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore)); assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    assert.equal(row.randomBefore.seed, row.randomAfter.seed); assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    assert.deepEqual(Object.keys(row.selectionOutcome).sort(), ['arrivals','promoted','status']);
    assert(Number.isInteger(row.selectionOutcome.arrivals) && row.selectionOutcome.arrivals >= 0 && row.selectionOutcome.arrivals <= 4);
    assert.equal(typeof row.selectionOutcome.promoted, 'boolean'); assert.equal(typeof row.selectionOutcome.status, 'string');
    const kind = selectedBoundary(row.intent, row.selectionOutcome, selected);
    if (kind) selected.push({ kind, commandCount: row.commandCount });
    state = row.afterStateSha256; publicHash = row.publicAfterSha256; globalPublicHash = row.globalPublicAfterSha256; randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(state, payload.finalStateSha256); assert.equal(publicHash, payload.publicStateSha256); assert.equal(globalPublicHash, payload.globalPublicStateSha256); assert.equal(randomHash, stateHash(payload.state.random)); assert.equal(policyHash, stateHash(payload.policy));
  assert.equal(payload.policy.week, payload.state.week); assert(payload.policy.doses <= POLICY.carrierLimit); assert(payload.policy.carriers.length <= POLICY.carrierLimit);
  assert.deepEqual(payload.boundaries.map(({ kind,commandCount }) => ({ kind,commandCount })), selected, 'Selected evidence must rederive from actual public outcomes');
  assert(payload.boundaries.length <= POLICY.selectedBoundaryLimit); assert.equal(new Set(payload.boundaries.map(b => b.kind)).size, payload.boundaries.length);
  if (payload.pending) {
    assert.equal(payload.pending.commandCount, payload.commandCount + 1); assert.equal(payload.pending.beforeStateSha256, payload.finalStateSha256);
    assert.equal(payload.pending.publicBeforeSha256, payload.publicStateSha256); assert.equal(payload.pending.globalPublicBeforeSha256, payload.globalPublicStateSha256); assert.equal(payload.pending.policyBeforeSha256, stateHash(payload.policy));
    assert.deepEqual(payload.pending.intent, payload.pending.decision.action.intent);
  }
}
export function parseOptions(args) {
  const result = { out: null, resume: null, maxNewActions: POLICY.defaultObservationActions, stopAfterCommand: null }, seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index], value = args[++index]; assert(value !== undefined, `Missing value for ${flag}`);
    assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--out') result.out = resolve(value);
    else if (flag === '--resume') result.resume = resolve(value);
    else if (flag === '--max-new-actions' || flag === '--stop-after-command') {
      assert(/^\d+$/.test(value)); const number = Number(value); assert(Number.isSafeInteger(number));
      if (flag === '--max-new-actions') result.maxNewActions = number;
      else { assert(number >= PREFIX_COUNT, 'A stop boundary cannot precede living679'); result.stopAfterCommand = number; }
    } else throw Error(`Unsupported ${flag}: no source, seed, roll, strategy, resources or outcome overrides`);
  }
  if (result.resume) { assert(!result.out || result.out === dirname(result.resume), 'Resume retains its exact output directory'); result.out = dirname(result.resume); }
  return result;
}
export function readCapture(path) {
  const bytes = readFileSync(path); return JSON.parse(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8'));
}
export function publicActionStillAvailable(view, action) {
  return action.intent.type === 'DARKNESS' && view.darkness.actions.some(a => a.enabled && isDeepStrictEqual(a.command, action.intent.command) && isDeepStrictEqual(actionOf(a), action));
}
function actualReceipts(next, before) {
  const latest = next.darkness.journal.at(-1);
  return latest?.revision === next.revision ? { checks: clone(latest.randomReceipts), finance: clone(latest.financeReceipts), notes: clone(latest.notes) }
    : { checks: [], finance: [], notes: clone(next.chronicle.slice(before.chronicle.length)) };
}
export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), root = process.cwd();
  assert.equal(resolve(root, 'scripts/play/darkness-stage.mjs'), SELF, 'Run from the matching reviewed frozen repository root');
  const old = readSource(root), freeze = inspectFreeze(root), stamps = stampFreeze(root, { files: [...freeze.files,...old.inputFreeze.files] });
  const runtime = await loadRuntime(root), initial = migrate(runtime, old.source), initialHash = stateHash(initial);
  const initialGlobal = runtime.projectSliceState(initial); assertGlobalPublic(initialGlobal, initial); const initialView = capturePublic(initialGlobal);
  if (!options.out) { mkdirSync(join(root, 'output/play'), { recursive: true }); options.out = mkdtempSync(join(root, 'output/play/darkness-02130-')); }
  for (const name of ['src','dist','scripts','tests','docs','node_modules','.git']) {
    const protectedPath = join(root, name); assert(options.out !== protectedPath && !options.out.startsWith(protectedPath + sep), 'Output cannot modify frozen inputs or repository metadata');
  }
  assert.notEqual(options.out, root); mkdirSync(options.out, { recursive: true });
  const checkpointPath = options.resume ?? join(options.out, 'checkpoint.json.gz'), freezePath = join(options.out, 'runtime-freeze.json'), inputPath = join(options.out, 'input-freeze.json');
  const originals = ['source-boundary679.json.gz','source-state679.json.gz','archived-original694.json.gz'];
  assert.equal(dirname(checkpointPath), options.out);
  let saved, session = null, stage = null, reason = null, count = 0;
  if (options.resume) {
    assert.deepEqual(readCapture(freezePath), freeze, 'Frozen runtime/producer drift; never resume with changed rules');
    assert.deepEqual(readCapture(inputPath), old.inputFreeze, 'Frozen historical inputs drifted');
    for (const [index,file] of originals.entries()) assert.equal(sha(gunzipSync(readFileSync(join(options.out, file)))), INPUTS[index].sha256, 'Retained original evidence changed');
    recoverAtomicNext(checkpointPath); saved = decodeCheckpoint(readFileSync(checkpointPath)); verifyCheckpoint(saved.payload, freeze, initialHash, old.inputFreeze);
    if (saved.payload.terminal) ({ stage, reason } = saved.payload.terminal);
  } else {
    assert.equal(readdirSync(options.out).length, 0, 'Refuse to overwrite an existing capture; use exact --resume');
    const globalView = initialGlobal, view = initialView;
    durableCreate(freezePath, JSON.stringify(freeze)); durableCreate(inputPath, JSON.stringify(old.inputFreeze)); durableCreate(join(options.out, 'producer.mjs'), readFileSync(SELF));
    for (const [index,file] of originals.entries()) durableCreate(join(options.out, file), gzipSync(old.buffers[index], { level: 6 }));
    durableCreate(join(options.out, 'migration-initial.json.gz'), gzipSync(JSON.stringify({ originalStateSha256: SNAPSHOT_SHA256, migratedStateSha256: initialHash, publicSha256: stateHash(initialView), globalPublicSha256: stateHash(initialGlobal), final: initial }), { level: 6 })); syncDirectory(options.out);
    saved = saveCheckpoint(checkpointPath, { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, prefixSha256: PREFIX_SHA256,
      inputFreezeSha256: old.inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256, policyDefinition: POLICY, policy: startingPolicy(),
      migration: { originalStateSha256: SNAPSHOT_SHA256, migratedStateSha256: initialHash, fromSchema: 188, toSchema: 210 },
      createdAt: new Date().toISOString(), commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state: initial,
      initialStateSha256: initialHash, finalStateSha256: initialHash, initialPublicSha256: stateHash(view), publicStateSha256: stateHash(view),
      initialGlobalPublicSha256: stateHash(globalView), globalPublicStateSha256: stateHash(globalView), initialRandomSha256: stateHash(initial.random), pending: null, terminal: null }, null);
  }
  try {
    assert.equal(saved.payload.initialPublicSha256, stateHash(initialView), 'Original current-chapter public hash changed');
    assert.equal(saved.payload.initialGlobalPublicSha256, stateHash(initialGlobal), 'Original whole-public hash changed');
    assert.deepEqual(readCapture(join(options.out, 'migration-initial.json.gz')), { originalStateSha256: SNAPSHOT_SHA256, migratedStateSha256: initialHash, publicSha256: stateHash(initialView), globalPublicSha256: stateHash(initialGlobal), final: initial }, 'Retained migrated initial/public boundary changed');
    if (saved.payload.state.darkness.guidanceKnown) session = runtime.openDarknessRuntimeSession(saved.payload.state);
    const projectGlobal = () => { const projection = session ? session.project() : runtime.projectSliceState(saved.payload.state); assertGlobalPublic(projection, saved.payload.state); return projection; };
    const project = () => capturePublic(projectGlobal()), reopened = projectGlobal();
    assert.equal(stateHash(capturePublic(reopened)), saved.payload.publicStateSha256, 'Reopened current-chapter public boundary changed');
    assert.equal(stateHash(reopened), saved.payload.globalPublicStateSha256, 'Reopened whole public boundary changed');
    for (const boundary of saved.payload.boundaries) assert.deepEqual(fileEvidence(join(options.out, boundary.file)), { bytes: boundary.bytes, sha256: boundary.sha256 });
    while (!stage) {
      unchanged(stamps); const boundary = saved.payload;
      if (boundary.state.status !== 'ACTIVE') { stage = 'NATURAL_ACTUAL_TERMINAL'; reason = `Actual runtime status ${boundary.state.status}`; break; }
      if (!boundary.pending && (count >= options.maxNewActions || options.stopAfterCommand !== null && boundary.commandCount >= options.stopAfterCommand)) {
        stage = 'MANUAL_PAUSE'; reason = 'Paused at the requested durable completed-action boundary; resume the exact frozen policy'; break;
      }
      if (boundary.policy.loop.repetitions >= 3) { stage = 'PUBLIC_NO_PROGRESS_DIAGNOSTIC'; reason = 'Three accepted actions left the meaningful public boundary unchanged; retain the actual state for review'; break; }
      let pending = boundary.pending;
      if (!pending) {
        const globalView = projectGlobal(), view = capturePublic(globalView), decision = chooseAction(view, boundary.policy);
        if (decision.stop) { stage = decision.stop; reason = decision.reason; break; }
        assert(publicActionStillAvailable(view, decision.action), 'Selection must be an exact enabled public button');
        pending = { commandCount: boundary.commandCount + 1, intent: clone(decision.action.intent), decision,
          beforeStateSha256: boundary.finalStateSha256, publicBeforeSha256: stateHash(view), globalPublicBeforeSha256: stateHash(globalView), policyBeforeSha256: stateHash(boundary.policy), startedAt: new Date().toISOString() };
        saved = saveCheckpoint(checkpointPath, { ...boundary, pending }, saved.sha256);
      }
      const beforeGlobal = projectGlobal(), beforeView = capturePublic(beforeGlobal); assert(publicActionStillAvailable(beforeView, pending.decision.action), 'Pending exact button is no longer enabled');
      assert.equal(stateHash(beforeView), pending.publicBeforeSha256); assert.equal(stateHash(beforeGlobal), pending.globalPublicBeforeSha256);
      assert.deepEqual(chooseAction(beforeView, saved.payload.policy), pending.decision, 'Retain the exact pending frozen policy choice');
      const before = saved.payload.state, started = performance.now(); let draft = null, next, globalAfter;
      if (session) { draft = session.prepare(pending.intent, before.revision); next = session.snapshotDraft(draft); globalAfter = session.projectDraft(draft); }
      else { next = runtime.applySliceIntent(before, pending.intent); session = runtime.openDarknessRuntimeSession(next); globalAfter = session.project(); }
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
      if (selected) {
        const file = `boundary-${pending.commandCount}-${selected}.json.gz`, path = join(options.out, file);
        const content = { commandCount: pending.commandCount, beforeLast: before, lastIntent: pending.intent, final: next, public: after, globalPublicSha256: row.globalPublicAfterSha256, audit: { ...row, elapsedMilliseconds: null } };
        if (existsSync(path)) assert.deepEqual(readCapture(path), content, 'Existing selected boundary differs from the exact resumed draft');
        else { durableCreate(path, gzipSync(JSON.stringify(content), { level: 6 })); syncDirectory(options.out); }
        boundaries.push({ file, kind: selected, commandCount: pending.commandCount, ...fileEvidence(path) });
      }
      saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next, finalStateSha256: row.afterStateSha256, publicStateSha256: row.publicAfterSha256, globalPublicStateSha256: row.globalPublicAfterSha256,
        commandCount: pending.commandCount, commands: [...saved.payload.commands,pending.intent], rows: [...saved.payload.rows,row], boundaries, policy, pending: null }, saved.sha256);
      if (draft) session.commit(draft); count++;
      console.log(JSON.stringify({ completed: pending.commandCount, action: pending.decision.action.label, week: next.week, sequence: next.progression.sequence, milliseconds: row.elapsedMilliseconds }));
    }
    unchanged(stamps); assert.deepEqual(inspectFreeze(root), freeze, 'Frozen runtime bytes changed during capture'); assert.deepEqual(readSource(root).inputFreeze, old.inputFreeze);
    verifyCheckpoint(saved.payload, freeze, initialHash, old.inputFreeze); runtime.assertValidSliceState(saved.payload.state);
    if (saved.payload.state.darkness.guidanceKnown) {
      const strict = runtime.openDarknessRuntimeSession(saved.payload.state); assert.equal(stateHash(strict.snapshot()), saved.payload.finalStateSha256);
      const strictGlobal = strict.project(); assertGlobalPublic(strictGlobal, saved.payload.state);
      assert.equal(stateHash(capturePublic(strictGlobal)), saved.payload.publicStateSha256); assert.equal(stateHash(strictGlobal), saved.payload.globalPublicStateSha256);
    }
    const paused = stage === 'MANUAL_PAUSE', diagnostic = stage.startsWith('PUBLIC_');
    if (!paused && !diagnostic && !saved.payload.terminal) saved = saveCheckpoint(checkpointPath, { ...saved.payload, terminal: { stage, reason } }, saved.sha256);
    const view = project();
    replaceDerived(join(options.out, 'commands.ndjson.gz'), gzipSync(saved.payload.rows.map(row => JSON.stringify(row)).join('\n') + (saved.payload.rows.length ? '\n' : ''), { level: 6 }));
    replaceDerived(join(options.out, 'boundaries.index.json'), JSON.stringify(saved.payload.boundaries));
    replaceDerived(join(options.out, 'natural.json.gz'), gzipSync(JSON.stringify({ provenance: { kind: 'EXACT_ORIGINAL_LIVING679_PUBLIC_DARKNESS_CONTINUATION',
      source: SOURCE, sourceSha256: SOURCE_SHA256, peacefulStateSha256: SNAPSHOT_SHA256, originalEvidence: originals,
      prefixCommandsSha256: PREFIX_SHA256, inputFreezeSha256: old.inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256,
      historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, independent694DeathRetainedExactly: true, independent694DeathUsedAsInput: false,
      privateAudit: true, seedChanged: false, randomOverridden: false, futureDrawInspected: false, selectedFromEnabledPublicActionsOnly: true,
      selectedSQLiteBoundaries: 'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER', globalPublicScope: 'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH', projectionScope: 'CURRENT_DARKNESS_AND_ORDINARY_PUBLIC_DASHBOARD' },
      creation: old.creation, seed: old.seed, prefixCount: PREFIX_COUNT, commands: [...old.commands,...saved.payload.commands],
      policy: POLICY, stage, reason, pendingIntent: saved.payload.pending?.intent ?? null, boundaries: saved.payload.boundaries, final: saved.payload.state }), { level: 6 }));
    replaceDerived(join(options.out, 'summary.json'), JSON.stringify({ stage, reason, commands: saved.payload.commandCount, originalCommands: PREFIX_COUNT,
      newCommands: saved.payload.commands.length, week: saved.payload.policy.week, paused, diagnostic, strictFinalValidation: true,
      sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', checkpoint: 'checkpoint.json.gz', public: view }));
    console.log(JSON.stringify({ outputDir: options.out, stage, commands: saved.payload.commandCount, paused, diagnostic }));
    return { outputDir: options.out, stage, commands: saved.payload.commandCount, paused, diagnostic };
  } catch (error) {
    try { replaceDerived(join(options.out, 'error.json'), JSON.stringify({ stage: 'CAPTURE_INTERRUPTED', error: String(error), commandCount: saved?.payload.commandCount ?? null, resumeExactPendingRequired: true, at: new Date().toISOString() })); }
    catch { /* Keep the first error, exact pending command and every durable boundary. */ }
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
