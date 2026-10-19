import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync, gunzipSync } from 'node:zlib';
/** Static producer candidate. Invoke only after the parent freezes the reviewed
 * 214 build. Continue the exact living666 top-level final state, never replay
 * its old commands, inspect a future draw, replace a source or substitute a seed. */
export const SOURCE = 'tests/fixtures/all-knowing-eye-v01920/natural.json';
export const SOURCE_SHA256 = 'b838bff34dbf49f3df9968bcfef684a24c184e8320f9b8e6d7a1431bfc75a58f';
export const SOURCE_STATE_SHA256 = '08106a9cd35089fd9df5addb9d9425aa5abe93618bfaaa359c6731a734e09c11';
export const PREFIX_COUNT = 666;
export const PREFIX_SHA256 = '8ef19a15574807a0dacdf1e7a1c20ce0185fbc90c7002327825fd6553a5abd20';
export const FORMAT = 'WHITE_TOWER666_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
export const INPUTS = Object.freeze([{ file: SOURCE, sha256: SOURCE_SHA256 }]);
export const POLICY = Object.freeze({ id: 'WHITE_TOWER666_THREE_REAL_PASSAGES_SAME_ORIGINALS_V1', startWeek: 146,
  wage: 180, weeklyLiving: 30, operatingReserve: 1500, defaultObservationActions: 500, selectedBoundaryLimit: 40, carrierLimit: 3,
  injury: 'PAID60P_CLINIC_THEN_REAL_DESTITUTE_REST_70_78_86',
  passages: 'THREE_ORIGINAL_ADULTS_SURVEY_PERMISSION_PAID_BUILD_ACTUAL_PASS_NEXT_WEEK_REVIEW',
  construction: 'ONE_ACTUAL_PUBLIC_CHECK_PER_SITE_FAILURE_REQUIRES_FINITE_PAID_ORDINARY_REPAIR',
  materials: 'THREE_SAME_LATEST_ORIGINALS_OWN_ONE_SUPPLIER_TWO_EACH_FIVE_LABOUR_AND1100P_OR6600P',
  uniqueness: 'ACTUAL1352_07_08_TERMINATION_NEXT_DAY_CUSTODY_VERIFIED_AT_ORIGINAL_SITE',
  minimumS1Weeks: 12,
  promotion: 'SAME_COMPOUND_PAID100P_70PERCENT_PREPARATION_INDEPENDENT_CONSUMPTION',
  failure: 'LIVING_SEAL_LATER_WEEK_PAID_RECOVERY_THREE_FINITE_CARRIERS_DEATH_ARCHIVED',
  epilogue: 'TWO_FINITE_ATTEMPTS_ACTUAL_APPLICATION_OR_ORDINARY_SIDE_EXIT_AND_HONEST_REPORT',
  observationLimit: 'RESUMABLE_COMPLETED_ACTION_BOUNDARY_NOT_A_NATURAL_END', noReroll: true });
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
export function startingPolicy() { return { phase: 'WHITE_TOWER_ENTRY', week: POLICY.startWeek, doses: 0, carriers: [], epilogueAttempted: [], reported: false,
  loop: { key: null, repetitions: 0 } }; }
const actionOf = action => ({ ...clone(action), intent: { type: 'WHITE_TOWER', command: clone(action.command) } });
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
    'originalPracticeDigest','acquisitionDigest','originalWorldDigest','combatHistoryDigest','compoundDigest','beforeDigest','afterDigest','actorId','predecessorActorId','incumbentActorId',
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
  const secrets = new Set([state.random.seed]);
  const collect = node => {
    if (!node || typeof node !== 'object') return;
    for (const [key,value] of Object.entries(node)) {
      if ((key === 'actorId' || key.endsWith('Digest')) && typeof value === 'string' && value) secrets.add(value);
      else if (value && typeof value === 'object') collect(value);
    }
  };
  collect(state);
  for (const secret of secrets)
    assert(!json.includes(secret), 'Whole public projection contains an actual private seed or source identity');
}
export function capturePublic(projection) {
  const fields = ['runId','revision','status','week','date','actionsRemaining','weeklyBudget','cash','weeklyWage','wagePaid',
    'health','mind','spirituality','maxHealth','maxMind','maxSpirituality','pollution','injuries','injuryRisk',
    'debtTotal','debts','canAct','actionBlockedReason','activeEvent','combat'];
  const ordinary = Object.fromEntries(fields.map(key => [key, clone(projection[key])]));
  const result = { ...ordinary, progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
    mastery: clone(projection.progression.mastery) }, whiteTower: clone(projection.whiteTower) };
  assertPublicOnly(result); return result;
}
function whiteTowerAction(view, policy) {
  const d = view.whiteTower, actions = d.actions;
  const find = type => actions.find(a => a.command.type === type && a.enabled);
  const nested = (domain, type) => actions.find(a => a.command.type === domain && a.command.command.type === type && a.enabled);
  const select = (a, reason) => ({ action: actionOf(a), reason });
  const exit = reason => {
    const a = nested('PASSAGE', 'UNLOAD') ?? nested('PASSAGE', 'RETURN_ON_FOOT') ?? find('RETURN_ON_FOOT');
    return a ? select(a, `Unload or actually walk back before ordinary recovery: ${reason}`) : noProgress(`No enabled ordinary exit: ${reason}`);
  };
  const wait = (reason, reserve = POLICY.operatingReserve) => {
    if (d.insideCase) return exit(reason);
    if (find('WORK') && cash(d) < reserve) return select(find('WORK'), `Earn this real week's original180p wage: ${reason}`);
    if (find('NEXT_WEEK')) return select(find('NEXT_WEEK'), `Cross one actual week with living bills and old debts: ${reason}`);
    return noProgress(`No enabled ordinary work/week route: ${reason}`);
  };
  const recover = reason => find('CLINIC') ? select(find('CLINIC'), 'Pay the real60p ordinary treatment; keep the same injury until later rest')
    : find('REST') ? select(find('REST'), reason) : wait(reason);
  const needsRest = () => d.resources.health < 100 || d.resources.mind < 100 || d.resources.spirituality < (d.promoted ? 150 : 120) || view.pollution > 0 || view.injuries.length > 0;
  if (policy.reported) return { stop: 'NATURAL_FINITE_WHITE_TOWER_REPORTED', reason: 'The finite actual mechanical incident was honestly reported; no successful skill is forced' };
  if (!d.guidanceKnown) {
    policy.phase = 'WHITE_TOWER_ENTRY';
    const guidance = find('LEARN_GUIDANCE');
    return guidance ? select(guidance, 'Continue the exact living666 top-level final with actual100p guidance; preserve its untreated injury and all old outcomes')
      : noProgress('The exact666 public guidance is unavailable; do not replace its budget, injury, old history or source');
  }
  policy.phase = d.promoted ? 'WHITE_TOWER_EPILOGUE' : 'WHITE_TOWER_PASSAGES_MATERIALS';
  const seal = nested('MATERIAL', 'SEAL_REMAINS');
  if (seal) return select(seal, 'Seal the actual failed compound in place before wages, rest or travel; nothing is refunded');
  const dose = actions.find(a => a.enabled && a.preferredAction && a.command.type === 'CONSUME');
  if (dose) {
    const prep = actions.find(a => a.command.type === 'STABILIZE_PROMOTION' && a.command.compoundId === dose.command.compoundId);
    if (policy.doses >= POLICY.carrierLimit) return { stop: 'NATURAL_CARRIERS_UNAVAILABLE', reason: 'Three actual finite doses have been consumed; no fourth carrier or redraw is allowed' };
    if (!prep || prep.enabled || !section(d, 'promotion-stability').some(line => /实际成功率70%；同一现场七天准备仍有效/.test(line)))
      return { stop: 'PUBLIC_STABILITY_BINDING_BLOCKED', reason: 'The exact offered dose lacks visible same-compound paid70% preparation' };
    return select(dose, 'Consume the same paid prepared compound immediately; preserve the actual result, injuries, pollution or death');
  }
  const epilogue = actions.filter(a => a.command.type === 'EPILOGUE');
  if (epilogue.length) {
    const report = nested('EPILOGUE', 'REPORT');
    if (report) return select(report, 'Report only actual resident locations, damage, skill applications and ordinary returns');
    const next = epilogue.find(a => a.enabled && a.preferredAction && !policy.epilogueAttempted.includes(a.command.command.type));
    if (next) return select(next, 'Follow current public observation, independent test, renewed permission, finite technique or actual ordinary exit');
    for (const type of ['STOP_EFFECTS','UNLOAD_STRUT','SECURE_GATE','ORDINARY_SIDE_EXIT','WITHDRAW']) {
      const a = nested('EPILOGUE', type);
      if (a) return select(a, 'Use the real ordinary stop, unload, side path or personal return without requiring a magical success');
    }
    return noProgress('The finite incident offers neither its intended enabled action nor an ordinary exit');
  }
  // The chapter's public recommendation includes the real clinic, two DESTITUTE
  // rests, work and weekly costs. It is input, not a reconstructed private plan.
  const next = actions.find(a => a.preferredAction && a.command.type !== 'CONSUME');
  if (!next) {
    if (policy.doses >= POLICY.carrierLimit && section(d, 'materials').some(line => /三件普通载体尚有0件未使用/.test(line)) && !actions.some(a => a.command.type === 'MATERIAL' && ['SEAL_REMAINS','RECOVER_SEALED','COMPOSE_POTION'].includes(a.command.command.type)))
      return { stop: 'NATURAL_CARRIERS_UNAVAILABLE', reason: 'All three actual carriers are spent and the living same-original recovery is complete; no replacement supply exists' };
    return noProgress('No intended public progression step is marked; preserve this boundary instead of guessing a private prerequisite');
  }
  const c = next.command, cost = publicPrice(next);
  const handoff = c.type === 'MATERIAL' && c.command.type === 'ACQUIRE_UNIQUENESS';
  if (handoff && next.enabled) return select(next, 'Complete the already-verified same-week handoff before optional work or rest');
  if (c.type === 'PASSAGE') {
    if (next.enabled) return select(next, 'Follow the actual survey, permission, paid construction or ordinary repair, acceptance, resident walk and later-week review');
    if (d.insideCase) return exit(`${next.label}: ${next.reason}`);
  }
  if ((c.type === 'STABILIZE_PROMOTION' || c.type === 'START_EPILOGUE') && needsRest()) return recover('Recover this actual body, pollution and injuries before entering the paid risk or finite incident');
  if (c.type === 'STABILIZE_PROMOTION' && d.resources.actionsRemaining < 2) return wait('Reserve two real actions for paid preparation and its separate same-compound dose');
  if (c.type === 'START_EPILOGUE' && d.resources.actionsRemaining < 2) return wait('Reserve two real finite technique attempts; ordinary exits remain free');
  if (c.type === 'MATERIAL' && c.command.type === 'VERIFY_UNIQUENESS' && c.command.step === 'VACANCY') {
    const delivery = actions.find(a => a.command.type === 'MATERIAL' && a.command.command.type === 'ACQUIRE_UNIQUENESS');
    if (!delivery) return noProgress('The matching public same-week uniqueness handoff is missing');
    if (d.resources.actionsRemaining < cost.actions + publicPrice(delivery).actions || cash(d) < cost.cash + publicPrice(delivery).cash + POLICY.weeklyLiving)
      return wait('Reserve the displayed actual verification and same-week handoff costs plus this week\'s30p living bill');
  }
  if (next.enabled) return select(next, 'Follow the exact enabled city, same-original material, dated custody, paid preparation or finite incident action');
  if (d.resources.actionsRemaining < cost.actions || cash(d) < cost.cash) return wait(`${next.label}: ${next.reason}`, Math.max(cost.cash + POLICY.weeklyLiving, POLICY.operatingReserve));
  if (/下一真实周|下一实际周|隔周|至少到下一|真实日期尚未到达|尚未满12个实际周/.test(next.reason ?? '')) return wait(`${next.label}: ${next.reason}`);
  if (/健康|精神|灵性|伤势|休养/.test(next.reason ?? '') && needsRest()) return recover(`Recover actual resources for ${next.label}`);
  return noProgress(`${next.label}: ${next.reason ?? 'Unresolved public prerequisite'}`);
}
export function chooseAction(view, previous) {
  assertPublicOnly(view);
  const policy = clone(previous);
  if (view.status !== 'ACTIVE') return { stop: 'NATURAL_ACTUAL_TERMINAL', reason: `Actual runtime status ${view.status}`, policy };
  if (view.combat || view.activeEvent) return { ...noProgress('Unexpected old active scene; preserve the exact original rather than replaying or replacing it'), policy };
  return { ...whiteTowerAction(view, policy), policy };
}
export function loopDiagnostic(before, after, policy) {
  const semantic = v => ({ phase: policy.phase, sequence: v.progression.sequence, acting: v.progression.acting,
    health: v.health, mind: v.mind, spirituality: v.spirituality, pollution: v.pollution, cash: v.cash, debt: v.debtTotal,
    week: v.week, actions: v.whiteTower.actions.filter(a => a.preferredAction).map(a => [a.command,a.enabled,a.reason]),
    progress: v.whiteTower.sections.filter(s => !['clock','recent-action','finance'].includes(s.id)) });
  const key = stateHash(semantic(after)), unchanged = isDeepStrictEqual(semantic(before), semantic(after));
  return { key, repetitions: unchanged ? policy.loop.key === key ? policy.loop.repetitions + 1 : 1 : 0 };
}
export function advancePolicy(decision, after, before) {
  const p = clone(decision.policy), c = decision.action.intent.command; p.week = after.week;
  if (c.type === 'CONSUME') p.doses++;
  if (c.type === 'MATERIAL' && c.command.type === 'BUY_COMPOUND') { assert(!p.carriers.includes(c.command.batchId)); p.carriers.push(c.command.batchId); assert(p.carriers.length <= POLICY.carrierLimit); }
  if (c.type === 'EPILOGUE') {
    if (['STRUCTURAL_INSIGHT','BOUNDED_WEAK_POINT'].includes(c.command.type)) {
      assert(!p.epilogueAttempted.includes(c.command.type), 'A finite technique cannot be retried after its actual result');
      p.epilogueAttempted.push(c.command.type);
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
  assert(existsSync(join(root, 'dist/domain/white-tower/owned-session.js')), 'Build and freeze the reviewed runtime before capture; no game was loaded');
  for (const name of new Set(['package.json','package-lock.json','src','dist/domain','dist/content','dist/resolution','dist/persistence','dist/shared','dist/application','dist/simulation','node_modules/@noble/hashes'])) walk(name);
  files.push({ file: '$natural-producer', ...fileEvidence(SELF) });
  files.push({ file: 'scripts/play/white-tower-stage.test.mjs', ...fileEvidence(join(root, 'scripts/play/white-tower-stage.test.mjs')) });
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
  const archive = JSON.parse(buffers[0]), source = archive.final, commands = archive.commands;
  assert.equal(compactHash(source), SOURCE_STATE_SHA256, 'Use the exact already-living top-level final; no alternate boundary');
  assert.equal(commands.length, PREFIX_COUNT); assert.equal(compactHash(commands), PREFIX_SHA256);
  assert.equal(source.revision, 667); assert.equal(source.runId, 'reader-rebuild-natural');
  assert.equal(archive.seed, source.random.seed); assert.deepEqual(source.random, { seed: 'reader-natural-v023', cursor: 227 });
  assert.equal(source.schemaVersion, 189); assert.equal(source.contentVersion, 'all-knowing-eye-v189');
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.week, POLICY.startWeek);
  assert.deepEqual(source.date, { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 8 });
  assert.deepEqual([source.health,source.mind,source.spirituality,source.cash,source.actionsRemaining,source.seer.pollution], [70,86,120,1390,3,0]);
  assert.deepEqual(source.injuries, [{ id: 'reader-rebuild-natural:combat:2:PLAYER:664:0', severity: 'HEAVY', acquiredRevision: 664, treatedRevision: null }]);
  assert.equal(source.character.coreStats.will, 28); assert.equal(source.character.weeklyWage, 180);
  assert.equal(source.lifeTier, 'DESTITUTE'); assert.equal(source.progression.pathwayId, 'white-tower'); assert.equal(source.progression.sequence, 1);
  assert.equal(source.progression.acting, 100); assert.equal(source.allKnowingEye.life.reflected, true); assert.equal(source.allKnowingEye.promotionWeek, 136);
  assert.deepEqual(source.allKnowingEye.bottles.map(b => [b.id,b.status,b.outcome]), [1,2,3].map(n => [`all-knowing-eye-potion-${n}`,n === 1 ? 'CONSUMED' : 'SUPPLIER',n === 1 ? 'SUCCESS' : null]));
  assert.deepEqual(source.allKnowingEye.acquisitionJournal.filter(j => j.command.type === 'CONSUME').map(j => [j.check.chance,j.check.roll,j.check.tier]), [[44,12,'SUCCESS']]);
  assert.equal(Object.keys(source.progression.mastery).length, 21); assert.equal(source.combat, null); assert.equal(source.activeEvent, null);
  const files = INPUTS.map((pin, index) => ({ ...pin, bytes: buffers[index].length }));
  return { source, commands, creation: archive.creation, seed: archive.seed, buffers,
    inputFreeze: { format: 'WHITE_TOWER666_HISTORICAL_INPUTS_V1', sha256: compactHash(files), files,
      originalStateSha256: SOURCE_STATE_SHA256, sourceRoot: 'final', prefixSha256: PREFIX_SHA256, archivedCommandCount: PREFIX_COUNT } };
}
async function loadRuntime(root) {
  const [slice, migration, session] = await Promise.all(['domain/slice/index','domain/slice/migration','domain/white-tower/owned-session']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  return { ...slice, migrateSliceState: migration.migrateSliceState, openWhiteTowerRuntimeSession: session.openWhiteTowerRuntimeSession };
}
export function migrate(runtime, original) {
  const before = stateHash(original), state = runtime.migrateSliceState(original);
  assert.equal(stateHash(original), before, 'Migration mutated historical input');
  for (const [key,value] of Object.entries(original)) if (!['schemaVersion','contentVersion'].includes(key)) assert.deepEqual(state[key], value, `Migration changed original ${key}`);
  assert.equal(state.schemaVersion, 211); assert.equal(state.contentVersion, 'white-tower-v211');
  runtime.assertValidSliceState(state); return state;
}
export function checkOriginals(state, original, before) {
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, original.random.seed); assert(state.random.cursor >= before.random.cursor);
  const changingObjects = new Set(['date','random','character','progression','seer','injuries','debts','chronicle','lastResult','lastCheck','lastCombatRound','credit','ending']);
  for (const [key,value] of Object.entries(original)) if (value && typeof value === 'object' && !changingObjects.has(key))
    assert.deepEqual(state[key], value, `Frozen original history changed: ${key}`);
  assert.deepEqual(state.character, original.character, 'Original identity, wage and will cannot be replaced');
  for (const [id,value] of Object.entries(original.progression.mastery)) assert.equal(state.progression.mastery[id], value, `Original mastery changed: ${id}`);
  assert.equal(state.combat, null); assert.equal(state.activeEvent, null);
  if (before.whiteTower.guidanceKnown) assert.deepEqual(state.whiteTower.source, before.whiteTower.source, 'Frozen actual S1 handoff cannot be replaced');
}
export function selectionOutcome(after) {
  return { status: after.status, promoted: after.whiteTower.promoted,
    passages: section(after.whiteTower, 'white-tower-passages').filter(line => /已实际通过|已实走复核/.test(line)).length,
    reviews: section(after.whiteTower, 'white-tower-passages').filter(line => /已实走复核/.test(line)).length };
}
/** Only first occurrence of each actual transition is sampled for subsequent
 * SQLite save/reopen checks. Every other complete command remains in the chain. */
export function selectedBoundary(intent, after, previous) {
  if (previous.length >= POLICY.selectedBoundaryLimit) return null;
  const c = intent.command, outcome = 'whiteTower' in after ? selectionOutcome(after) : after; let key = null;
  if (['LEARN_GUIDANCE','CLINIC','STABILIZE_PROMOTION','START_EPILOGUE'].includes(c.type)) key = `white-tower-${c.type.toLowerCase()}`;
  if (c.type === 'PASSAGE') {
    if (['BUILD','REPAIR','PASS_RESIDENT','REVIEW_NEXT_WEEK'].includes(c.command.type)) key = `passage-${c.command.passageId}-${c.command.type.toLowerCase()}`;
  }
  if (c.type === 'MATERIAL') {
    if (['ACQUIRE_CHARACTERISTIC','INVESTIGATE_LEGACY_REMAINS','RECOVER_LEGACY_REMAINS'].includes(c.command.type)) key = `material-${c.command.type.toLowerCase()}-${c.command.bottleId}`;
    if (['ACQUIRE_UNIQUENESS','COMPOSE_POTION','SEAL_REMAINS','RECOVER_SEALED'].includes(c.command.type)) key = `material-${c.command.type.toLowerCase()}`;
    if (c.command.type === 'VERIFY_UNIQUENESS') key = `uniqueness-${c.command.step.toLowerCase()}`;
  }
  if (c.type === 'CONSUME') key = outcome.status !== 'ACTIVE' ? 'white-tower-actual-terminal-dose' : outcome.promoted ? 'white-tower-actual-promotion' : 'white-tower-first-failed-dose';
  if (c.type === 'EPILOGUE' && ['STRUCTURAL_INSIGHT','VERIFY_STRUCTURE','BOUNDED_WEAK_POINT','EXPLOIT_WEAK_POINT','ORDINARY_SIDE_EXIT','REPORT'].includes(c.command.type)) key = `epilogue-${c.command.type.toLowerCase()}`;
  return key && !previous.some(b => b.kind === key) ? key : null;
}
export function verifyCheckpoint(payload, freeze, initialStateSha256, inputFreeze) {
  assert.equal(payload.format, FORMAT); assert.equal(payload.source, SOURCE); assert.equal(payload.sourceSha256, SOURCE_SHA256);
  assert.equal(payload.prefixSha256, PREFIX_SHA256); assert.equal(payload.runtimeFreezeSha256, freeze.sha256);
  assert.equal(payload.inputFreezeSha256, inputFreeze.sha256); assert.deepEqual(payload.policyDefinition, POLICY);
  assert.equal(payload.initialStateSha256, initialStateSha256); assert.equal(payload.migration.originalStateSha256, SOURCE_STATE_SHA256);
  assert.equal(payload.migration.migratedStateSha256, initialStateSha256);
  assert.equal(payload.migration.fromSchema, 189); assert.equal(payload.migration.toSchema, 211);
  assert.equal(payload.commandCount, PREFIX_COUNT + payload.commands.length); assert.equal(payload.rows.length, payload.commands.length);
  assert.equal(payload.finalStateSha256, stateHash(payload.state));
  for (const key of ['initialGlobalPublicSha256','globalPublicStateSha256']) assert(/^[a-f0-9]{64}$/.test(payload[key] ?? ''), `Missing or invalid ${key}`);
  let state = initialStateSha256, publicHash = payload.initialPublicSha256, globalPublicHash = payload.initialGlobalPublicSha256, randomHash = payload.initialRandomSha256, policyHash = stateHash(startingPolicy());
  const selected = [];
  for (const [index,row] of payload.rows.entries()) {
    assert.equal(row.commandCount, PREFIX_COUNT + index + 1); assert.deepEqual(row.intent, payload.commands[index]);
    for (const key of ['globalPublicBeforeSha256','globalPublicAfterSha256']) assert(/^[a-f0-9]{64}$/.test(row[key] ?? ''), `Missing or invalid ${key}`);
    assert.equal(row.intent.type, 'WHITE_TOWER'); assert.equal(row.commandSha256, compactHash(row.intent)); assert.equal(row.beforeStateSha256, state);
    assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.globalPublicBeforeSha256, globalPublicHash); assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore)); assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    assert.equal(row.randomBefore.seed, row.randomAfter.seed); assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    assert.deepEqual(Object.keys(row.selectionOutcome).sort(), ['passages','promoted','reviews','status']);
    assert(Number.isInteger(row.selectionOutcome.passages) && row.selectionOutcome.passages >= 0 && row.selectionOutcome.passages <= 3);
    assert(Number.isInteger(row.selectionOutcome.reviews) && row.selectionOutcome.reviews >= 0 && row.selectionOutcome.reviews <= row.selectionOutcome.passages);
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
  assert(payload.policy.epilogueAttempted.every(type => ['STRUCTURAL_INSIGHT','BOUNDED_WEAK_POINT'].includes(type)));
  assert.equal(new Set(payload.policy.epilogueAttempted).size, payload.policy.epilogueAttempted.length);
  assert.deepEqual(payload.boundaries.map(({ kind,commandCount }) => ({ kind,commandCount })), selected, 'Selected evidence must rederive from actual public outcomes');
  assert(payload.boundaries.length <= POLICY.selectedBoundaryLimit); assert.equal(new Set(payload.boundaries.map(b => b.kind)).size, payload.boundaries.length);
  for (const boundary of payload.boundaries) {
    const row = payload.rows[boundary.commandCount - PREFIX_COUNT - 1];
    assert.deepEqual({ file: boundary.file, bytes: boundary.bytes, sha256: boundary.sha256 }, row.capture);
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
  assert.deepEqual(content.randomBefore, row.randomBefore); assert.deepEqual(content.randomAfter, row.randomAfter);
  assert.deepEqual(content.beforeLast.random, content.randomBefore); assert.deepEqual(content.final.random, content.randomAfter);
  assertGlobalPublic(content.globalPublicBefore, content.beforeLast); assertGlobalPublic(content.globalPublic, content.final);
  assert.deepEqual(capturePublic(content.globalPublicBefore), content.publicBefore); assert.deepEqual(capturePublic(content.globalPublic), content.public);
  assert.deepEqual(selectionOutcome(content.public), row.selectionOutcome);
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
      else { assert(number >= PREFIX_COUNT, 'A stop boundary cannot precede living666'); result.stopAfterCommand = number; }
    } else throw Error(`Unsupported ${flag}: no source, seed, roll, strategy, resources or outcome overrides`);
  }
  if (result.resume) { assert(!result.out || result.out === dirname(result.resume), 'Resume retains its exact output directory'); result.out = dirname(result.resume); }
  return result;
}
export function readCapture(path) {
  const bytes = readFileSync(path); return JSON.parse(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8'));
}
export function publicActionStillAvailable(view, action) {
  return action.intent.type === 'WHITE_TOWER' && view.whiteTower.actions.some(a => a.enabled && isDeepStrictEqual(a.command, action.intent.command) && isDeepStrictEqual(actionOf(a), action));
}
function actualReceipts(next, before) {
  const latest = next.whiteTower.journal.at(-1);
  return latest?.revision === next.revision ? { checks: clone(latest.randomReceipts), finance: clone(latest.financeReceipts), notes: clone(latest.notes) }
    : { checks: [], finance: [], notes: clone(next.chronicle.slice(before.chronicle.length)) };
}
export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), root = process.cwd();
  assert.equal(resolve(root, 'scripts/play/white-tower-stage.mjs'), SELF, 'Run from the matching reviewed frozen repository root');
  const old = readSource(root), freeze = inspectFreeze(root), stamps = stampFreeze(root, { files: [...freeze.files,...old.inputFreeze.files] });
  const runtime = await loadRuntime(root), initial = migrate(runtime, old.source), initialHash = stateHash(initial);
  const initialGlobal = runtime.projectSliceState(initial); assertGlobalPublic(initialGlobal, initial); const initialView = capturePublic(initialGlobal);
  if (!options.out) { mkdirSync(join(root, 'output/play'), { recursive: true }); options.out = mkdtempSync(join(root, 'output/play/white-tower-02140-')); }
  for (const name of ['src','dist','scripts','tests','docs','node_modules','.git']) {
    const protectedPath = join(root, name); assert(options.out !== protectedPath && !options.out.startsWith(protectedPath + sep), 'Output cannot modify frozen inputs or repository metadata');
  }
  assert.notEqual(options.out, root); mkdirSync(options.out, { recursive: true });
  const checkpointPath = options.resume ?? join(options.out, 'checkpoint.json.gz'), freezePath = join(options.out, 'runtime-freeze.json'), inputPath = join(options.out, 'input-freeze.json');
  const originals = ['archived-original666.json.gz'];
  const initialCapture = { originalStateSha256: SOURCE_STATE_SHA256, migratedStateSha256: initialHash,
    publicSha256: stateHash(initialView), globalPublicSha256: stateHash(initialGlobal),
    final: initial, random: initial.random, public: initialView, globalPublic: initialGlobal };
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
    durableCreate(join(options.out, 'migration-initial.json.gz'), gzipSync(JSON.stringify(initialCapture), { level: 6 })); syncDirectory(options.out);
    saved = saveCheckpoint(checkpointPath, { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, prefixSha256: PREFIX_SHA256,
      inputFreezeSha256: old.inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256, policyDefinition: POLICY, policy: startingPolicy(),
      migration: { originalStateSha256: SOURCE_STATE_SHA256, migratedStateSha256: initialHash, fromSchema: 189, toSchema: 211 },
      createdAt: new Date().toISOString(), commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state: initial,
      initialStateSha256: initialHash, finalStateSha256: initialHash, initialPublicSha256: stateHash(view), publicStateSha256: stateHash(view),
      initialGlobalPublicSha256: stateHash(globalView), globalPublicStateSha256: stateHash(globalView), initialRandomSha256: stateHash(initial.random), pending: null, terminal: null }, null);
  }
  try {
    assert.equal(saved.payload.initialPublicSha256, stateHash(initialView), 'Original current-chapter public hash changed');
    assert.equal(saved.payload.initialGlobalPublicSha256, stateHash(initialGlobal), 'Original whole-public hash changed');
    assert.deepEqual(readCapture(join(options.out, 'migration-initial.json.gz')), initialCapture, 'Retained migrated initial/public boundary changed');
    if (saved.payload.state.whiteTower.guidanceKnown) session = runtime.openWhiteTowerRuntimeSession(saved.payload.state);
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
      else { next = runtime.applySliceIntent(before, pending.intent); session = runtime.openWhiteTowerRuntimeSession(next); globalAfter = session.project(); }
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
        globalPublicBefore: beforeGlobal, globalPublic: globalAfter, audit: { ...row, elapsedMilliseconds: null } };
      row.capture = retainActionCapture(options.out, content); verifyActionCapture(content, row);
      if (selected) boundaries.push({ ...row.capture, kind: selected, commandCount: pending.commandCount });
      saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next, finalStateSha256: row.afterStateSha256, publicStateSha256: row.publicAfterSha256, globalPublicStateSha256: row.globalPublicAfterSha256,
        commandCount: pending.commandCount, commands: [...saved.payload.commands,pending.intent], rows: [...saved.payload.rows,row], boundaries, policy, pending: null }, saved.sha256);
      if (draft) session.commit(draft); count++;
      console.log(JSON.stringify({ completed: pending.commandCount, action: pending.decision.action.label, week: next.week, sequence: next.progression.sequence, milliseconds: row.elapsedMilliseconds }));
    }
    unchanged(stamps); assert.deepEqual(inspectFreeze(root), freeze, 'Frozen runtime bytes changed during capture'); assert.deepEqual(readSource(root).inputFreeze, old.inputFreeze);
    verifyCheckpoint(saved.payload, freeze, initialHash, old.inputFreeze); runtime.assertValidSliceState(saved.payload.state);
    if (saved.payload.state.whiteTower.guidanceKnown) {
      const strict = runtime.openWhiteTowerRuntimeSession(saved.payload.state); assert.equal(stateHash(strict.snapshot()), saved.payload.finalStateSha256);
      const strictGlobal = strict.project(); assertGlobalPublic(strictGlobal, saved.payload.state);
      assert.equal(stateHash(capturePublic(strictGlobal)), saved.payload.publicStateSha256); assert.equal(stateHash(strictGlobal), saved.payload.globalPublicStateSha256);
    }
    const paused = stage === 'MANUAL_PAUSE', diagnostic = stage.startsWith('PUBLIC_');
    if (!paused && !diagnostic && !saved.payload.terminal) saved = saveCheckpoint(checkpointPath, { ...saved.payload, terminal: { stage, reason } }, saved.sha256);
    const view = project();
    replaceDerived(join(options.out, 'commands.ndjson.gz'), gzipSync(saved.payload.rows.map(row => JSON.stringify(row)).join('\n') + (saved.payload.rows.length ? '\n' : ''), { level: 6 }));
    replaceDerived(join(options.out, 'boundaries.index.json'), JSON.stringify(saved.payload.boundaries));
    replaceDerived(join(options.out, 'natural.json.gz'), gzipSync(JSON.stringify({ provenance: { kind: 'EXACT_ORIGINAL_LIVING666_PUBLIC_WHITE_TOWER_CONTINUATION',
      source: SOURCE, sourceSha256: SOURCE_SHA256, sourceRoot: 'final', originalStateSha256: SOURCE_STATE_SHA256, originalEvidence: originals,
      prefixCommandsSha256: PREFIX_SHA256, inputFreezeSha256: old.inputFreeze.sha256, runtimeFreezeSha256: freeze.sha256,
      historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, completeOriginalSourceRetainedExactly: true, alternateSourceUsed: false,
      privateAudit: true, seedChanged: false, randomOverridden: false, futureDrawInspected: false, selectedFromEnabledPublicActionsOnly: true,
      everyActionEvidence: 'FULL_PRIVATE_RNG_CHAPTER_PUBLIC_AND_GLOBAL_PUBLIC_BEFORE_AND_AFTER_GZIP',
      selectedSQLiteBoundaries: 'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER', globalPublicScope: 'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH', projectionScope: 'CURRENT_WHITE_TOWER_AND_ORDINARY_PUBLIC_DASHBOARD' },
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
