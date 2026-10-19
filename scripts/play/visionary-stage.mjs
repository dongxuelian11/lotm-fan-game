import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

/** Import-safe natural producer. Freeze/build first; this file never builds.
 * node scripts/play/visionary-stage.mjs --out output/play/visionary-natural
 * node scripts/play/visionary-stage.mjs --resume <out>/checkpoint.json --max-new-actions 40
 *
 * A single public itinerary, no seed/options/check-preview search. Only the
 * public Visionary projection and memory of committed public commands enter
 * chooseAction. Private snapshots and RNG are audit evidence, never strategy.
 * The source is the exact living Writer659 snapshot. The separate Writer667
 * death is sealed evidence, not a state from which this character is revived.
 *
 * checkpoint.json is the sole action-boundary authority: one rolling full state,
 * all small command/hash/receipt rows, complete policy, and exact pending intent.
 * Save pending BEFORE prepare, save the complete draft BEFORE in-memory commit.
 * A crash resumes the same pending command, including a losing result. A complete
 * .next is adopted; incomplete bytes are retained. No rollback or alternate pick.
 * Full snapshots are limited to selected milestones and the actual final state.
 */
export const SOURCE = 'tests/fixtures/writer-v01880/snapshot-practiced.json';
export const SOURCE_SHA256 = '49e6d09f367fab24667093f32a1a887aef5b000a2fe505a56cb3190276e3a0bc';
export const HISTORY = 'tests/fixtures/writer-v01880/natural.json';
export const HISTORY_SHA256 = '7b4a0998bd36ba06108ddb5c8dd7884f474d99145e9f9edbe1b56ba811f35399';
export const PREFIX_COUNT = 659;
export const PREFIX_SHA256 = '3176e2d31a990a18b0d1256d3d008da7a04ff246bfa1e02ace695c54da8cca1b';
export const FORMAT = 'VISIONARY659_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
const SELF = fileURLToPath(import.meta.url);
const HOME = 'backlund:public-relay-headquarters';
const SUPPLIER = 'backlund:professional-handoff';
const ARCHIVE = 'backlund:custody-archive';
const VAULT = 'backlund:sealed-vault';
const WORKSHOP = 'backlund:ritual-workshop';
const CITIES = ['BACKLUND', 'TINGEN', 'PRITZ', 'TRIER', 'EINHORN', 'FENEPOTTER'];
const GOVERNMENTS = { BACKLUND: 'LOEN', TRIER: 'INTIS', EINHORN: 'FUSAC', FENEPOTTER: 'FENEPOTTER' };
const LABOUR = ['SEAL_REGISTER', 'CRATE_AUDIT', 'SUPPLY_LIST', 'TRANSIT_RECEIPT', 'DELIVERY_REVIEW'];
export const POLICY = Object.freeze({
  id: 'VISIONARY659_INTERLEAVED_PUBLIC_QUARTER3_STABILITY_V1',
  startWeek: 144, wage: 180, weeklyLiving: 30, materialCost: 4200,
  tourReserve: 1200, stabilityReserve: 100, defaultObservationActions: 600,
  itinerary: 'SIX_CITY_SURVEY_THEN_LOCK_FORECAST_THEN_SIX_REAL_PILOTS_CONNECTIONS_FOUR_ADOPTIONS',
  materialSchedule: 'REAL_WEEKLY_WORK_THEN_AVAILABLE_MATERIAL_LABOUR_OR_PAID_ACTIONS',
  firstWindow: [209, 210], lastWindow: [222, 223],
  promotion: 'SAME_COMPOUND_PAID_STABILITY_BEFORE_EVERY_ACTUAL_DOSE',
  recovery: 'PROFESSIONAL_SEAL_SAME_REMAINS_RECOVER_CLINIC_REST_REAL_WAGES_NEW_CARRIER_NEXT_FIXED_WINDOW',
  rescue: 'ARRIVE_WITH_THREE_ACTIONS_OBSERVE_SUPPORT_GUIDE_EVACUATE_OR_ORDINARY_WITHDRAW_REPORT',
  noReroll: true,
});
const clone = value => structuredClone(value);
const sha = value => createHash('sha256').update(value).digest('hex');
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const stateHash = value => sha(stable(value));
const compactHash = value => sha(JSON.stringify(value));
const era = (type, extra = {}) => ({ type: 'ERA', command: { type, ...extra } });
const material = (type, extra = {}) => ({ type: 'MATERIAL', command: { type, ...extra } });
const travel = to => ({ type: 'TRAVEL', to });
const section = (view, id) => view.sections.find(item => item.id === id)?.lines ?? [];
const cash = view => Number(view.resources.cash.match(/^\d+/)?.[0] ?? NaN);
const publicInjuries = view => section(view, 'injuries').some(line => /^(重伤|轻伤)：/.test(line));
const price = action => ({ actions: Number(action.cost.match(/(\d+)行动/)?.[1] ?? 1),
  cash: Number(action.cost.match(/(\d+)便士/)?.[1] ?? 0), weeks: Number(action.cost.match(/实际(\d+)周/)?.[1] ?? 0) });

export const MATERIAL_PLAN = Object.freeze([
  era('ERA_SURVEY', { cityId: 'BACKLUND' }), travel(SUPPLIER),
  ...['writer-potion-2', 'writer-potion-3'].flatMap(bottleId => [
    ...LABOUR.map(taskId => material('MATERIAL_LABOUR', { bottleId, taskId })),
    material('ACQUIRE_CHARACTERISTIC', { bottleId }),
  ]),
  material('BUY_COMPOUND', { batchId: 'visionary-carrier-1' }),
  travel(ARCHIVE), material('VERIFY_UNIQUENESS', { step: 'CHAIN' }),
  travel(VAULT), material('VERIFY_UNIQUENESS', { step: 'VACANCY' }),
  material('VERIFY_UNIQUENESS', { step: 'SEAL' }), material('ACQUIRE_UNIQUENESS'),
  travel(WORKSHOP), material('COMPOSE_POTION', { batchId: 'visionary-carrier-1' }), travel(HOME),
]);
export const SURVEY_PLAN = Object.freeze([
  ...CITIES.slice(1).flatMap(cityId => [era('ERA_TRAVEL', { cityId }), era('ERA_SURVEY', { cityId })]),
  era('ERA_TRAVEL', { cityId: 'BACKLUND' }), era('ERA_FORECAST', { plan: 'PUBLIC_RELAY' }),
]);
export const DEPLOY_PLAN = Object.freeze([
  ...CITIES.flatMap((cityId, index) => [
    ...(index ? [era('ERA_TRAVEL', { cityId })] : []),
    era('ERA_PILOT', { cityId }), era('ERA_CONNECT', { cityId }),
    ...(GOVERNMENTS[cityId] ? [era('ERA_ADOPT', { governmentId: GOVERNMENTS[cityId] })] : []),
  ]), era('ERA_TRAVEL', { cityId: 'BACKLUND' }),
]);
const INCIDENTS = [
  { id: 'harbor-tide', release: 176, deadline: 179 }, { id: 'trier-water', release: 180, deadline: 183 },
  { id: 'einhorn-weather', release: 189, deadline: 192 }, { id: 'fenepotter-sluice', release: 193, deadline: 196 },
  { id: 'tingen-rail', release: 202, deadline: 205 }, { id: 'backlund-pump', release: 206, deadline: 209 },
  { id: 'pritz-beacon', release: 215, deadline: 218 }, { id: 'trier-cold', release: 219, deadline: 222 },
];
export function startingPolicy() {
  return { phase: 'GUIDANCE', step: 0, week: 144, location: HOME, resolved: [], verified: [],
    doses: 0, failedCompoundId: null, recoveryStep: 0, rescueReported: false };
}
const recoveryPlan = policy => [
  material('SEAL_REMAINS', { compoundId: policy.failedCompoundId, method: 'PROFESSIONAL' }),
  material('RECOVER_SEALED', { compoundId: policy.failedCompoundId }),
  { type: 'CLINIC' }, travel(SUPPLIER),
  material('BUY_COMPOUND', { batchId: `visionary-carrier-${policy.doses + 1}` }),
  travel(WORKSHOP), material('COMPOSE_POTION', { batchId: `visionary-carrier-${policy.doses + 1}` }), travel(HOME),
];

/** The only decision function. Inputs are a public projection and memory of
 * committed public commands. It never receives private state, RNG, or a draft.
 * Week/location memory follows the displayed travel cost of committed actions;
 * the audit separately rejects any disagreement with the actual runtime clock.
 */
export function chooseAction(view, previous) {
  const policy = clone(previous), r = view.resources, all = view.actions;
  const offered = command => all.find(action => isDeepStrictEqual(action.command, command));
  const enabled = command => { const action = offered(command); return action?.enabled ? action : null; };
  const ordinary = type => enabled({ type });
  const select = (action, reason, advanceStep = false) => {
    assert(action?.enabled, 'Only an enabled public command can be selected');
    return { action: clone(action), reason, policy, advanceStep };
  };
  const stop = (stage, reason) => ({ stop: stage, reason, policy });
  const wait = reason => ordinary('NEXT_WEEK') ? select(ordinary('NEXT_WEEK'), reason) : stop('PUBLIC_ACTION_BLOCKED', reason);
  const needsRest = () => r.health < 100 || r.mind < 100 || r.spirituality < 120 || publicInjuries(view);
  const restOrWait = reason => ordinary('REST') ? select(ordinary('REST'), reason) : wait(reason);
  const execute = (command, reason, advanceStep = false) => {
    const action = offered(command);
    if (!action) return stop('PUBLIC_ACTION_BLOCKED', `Missing public action: ${JSON.stringify(command)}`);
    const cost = price(action);
    if (action.enabled && cost.cash > 0 && cash(view) < cost.cash + POLICY.weeklyLiving)
      return wait(`Keep one real 30-penny living bill after paying for ${action.label}`);
    if (action.enabled) return select(action, reason, advanceStep);
    if (r.actionsRemaining < cost.actions || cash(view) < cost.cash) return wait(`Earn or replenish actual weekly resources for ${action.label}: ${action.reason}`);
    if (/健康|精神|灵性|伤势/.test(action.reason ?? '') && needsRest()) return restOrWait(`Recover actual body for ${action.label}`);
    if (command.type === 'ERA' && command.command.type === 'ERA_TRAVEL' && action.reason?.includes('目的港正执行原封港规则'))
      return wait('Wait through the actual temporary port closure, paying real weekly living costs and preserving the intended route');
    return stop('PUBLIC_ACTION_BLOCKED', `${action.label}: ${action.reason}`);
  };

  if (!view.guidanceKnown) return execute({ type: 'LEARN_GUIDANCE' }, 'Begin only from the exact original living Writer659 handoff');
  if (view.promoted) policy.phase = 'EPILOGUE';
  if (policy.phase === 'GUIDANCE') { policy.phase = 'MATERIALS'; policy.step = 0; }

  if (policy.phase === 'EPILOGUE') {
    if (policy.rescueReported) return stop('NATURAL_RESCUE_REPORTED', 'The actual short rescue and its consequences were reported');
    const ep = type => enabled({ type: 'EPILOGUE', command: { type } });
    if (ep('REPORT')) return select(ep('REPORT'), 'Report only the actual rescued people, remaining injuries, failed techniques and original damage');
    if (view.insideCase) {
      if (ep('OBSERVE')) return select(ep('OBSERVE'), 'Observe the same original people, structure and ordinary exit');
      if (r.actionsRemaining >= 3 && ep('SUPPORT_STRUCTURE')) return select(ep('SUPPORT_STRUCTURE'), 'One real support attempt, retaining two actions for guidance and ordinary evacuation');
      if (r.actionsRemaining >= 2 && ep('GUIDE_RESCUER')) return select(ep('GUIDE_RESCUER'), 'One real guidance attempt, retaining an action for ordinary evacuation');
      if (ep('EVACUATE')) return select(ep('EVACUATE'), 'Use the real stretcher and side route with whatever support actually succeeded');
      return execute({ type: 'EPILOGUE', command: { type: 'WITHDRAW' } }, 'Take the real zero-action exit; never reset this rescue to change its result');
    }
    if (needsRest()) {
      if (ordinary('CLINIC')) return select(ordinary('CLINIC'), 'Treat actual severe wounds before the single rescue');
      return restOrWait('Recover actual health, mind and spirituality before entering the short rescue');
    }
    if (policy.location !== 'tingen:relay-station') return execute(era('ERA_TRAVEL', { cityId: 'TINGEN' }), 'Travel physically to the previously registered original relay fault');
    if (r.actionsRemaining < 3) return wait('Begin the short rescue with three actual actions, including the ordinary exit plan');
    return execute({ type: 'START_EPILOGUE' }, 'Enter the one actual rescue without replenishing resources');
  }

  // These are the four fixed, existing windows, not an artificial action cap.
  if (policy.week > 223) return stop('NO_FUTURE_QUARTER_WINDOW', 'All four original quarterly windows have expired; this living state and every consequence remain intact');

  // Do not insert wages, travel, or a new preparation between an effective paid
  // preparation and its same-compound dose. Nothing chooses or previews a roll.
  const ready = all.find(a => a.command.type === 'CONSUME' && a.enabled && a.preferredAction === true);
  if (ready) {
    const prep = offered({ type: 'STABILIZE_PROMOTION', compoundId: ready.command.compoundId });
    if (!prep || prep.enabled || !section(view, 'promotion-stability').some(line => line.includes('当前准备仍有效'))) return stop('PUBLIC_STABILITY_BINDING_BLOCKED', 'A same-compound effective paid preparation is required before consumption');
    return select(ready, 'Consume this exact already-paid prepared dose within its actual verified window');
  }

  // Real current incidents take precedence over wage collection and recovery.
  // Old missed incidents can still be helped later, but cannot count retroactively.
  for (const incident of INCIDENTS.filter(item => item.release <= policy.week && policy.week <= item.deadline)) {
    const command = era('ERA_RESPOND', { incidentId: incident.id, mode: 'COORDINATED' });
    if (!policy.resolved.includes(incident.id) && enabled(command)) return select(enabled(command), `Timely real coordinated response before week ${incident.deadline}`);
  }
  if (ordinary('WORK')) return select(ordinary('WORK'), 'Earn the original 180-penny wage once this week; interleave real work with material and civic actions');

  if (policy.phase === 'MATERIALS') {
    if (policy.step >= MATERIAL_PLAN.length) { policy.phase = 'RESERVE'; policy.step = 0; }
    else {
      const target = MATERIAL_PLAN[policy.step];
      if (target.command?.type === 'VERIFY_UNIQUENESS' && target.command.step === 'SEAL' && (r.actionsRemaining < 2 || cash(view) < 1700 + POLICY.weeklyLiving))
        return wait('Retain two actual actions and 1730 pennies for this week’s final seal, same-week original uniqueness delivery and actual living bill');
      return execute(target, 'Complete the next distinct original material custody or labour action alongside weekly work', true);
    }
  }
  if (policy.phase === 'RESERVE') {
    if (cash(view) < POLICY.tourReserve + POLICY.stabilityReserve) return wait('Earn the 1200-penny travel/living reserve plus the 100-penny same-dose stability fee before touring');
    if (needsRest()) return restOrWait('Restore the actual body after paid composition before the two city circuits');
    policy.phase = 'SURVEY'; policy.step = 0;
  }
  if (policy.phase === 'SURVEY') {
    if (policy.step >= SURVEY_PLAN.length) { policy.phase = 'DEPLOY'; policy.step = 0; }
    else return execute(SURVEY_PLAN[policy.step], 'Survey all six actual stations in person before locking the forecast; do not implement changes during this circuit', true);
  }
  if (policy.phase === 'DEPLOY') {
    if (policy.step >= DEPLOY_PLAN.length) { policy.phase = 'WINDOW'; policy.step = 0; }
    else return execute(DEPLOY_PLAN[policy.step], 'Pay for real pilots, connect existing stations and obtain each government’s actual adoption', true);
  }
  if (policy.phase === 'RECOVERY') {
    // The last real failure is not undone even when no further window exists.
    const plan = recoveryPlan(policy);
    if (policy.recoveryStep < plan.length) {
      // Restore health/mind/spirituality with real rest after the actual clinic,
      // while continuing to work each week. No inherited skill is trained/reset.
      if (policy.recoveryStep >= 3 && needsRest()) return restOrWait('Recover the actual failed-dose wound and resources after paid treatment');
      return execute(plan[policy.recoveryStep], 'Pay for actual recovery of the same failed originals and a new ordinary carrier', true);
    }
    policy.phase = 'WINDOW'; policy.step = 0;
  }
  if (policy.phase === 'WINDOW') {
    const prepare = all.find(a => a.command.type === 'STABILIZE_PROMOTION' && a.enabled);
    if (prepare) {
      if (r.actionsRemaining < 2) return wait('Leave two actual actions for paid stability and its same-compound dose in the remaining real window');
      return select(prepare, 'Pay the same-compound, same-quarter stability preparation before taking the real approximately 70% risk');
    }
    const verification = all.find(a => a.command.type === 'ERA' && a.command.command.type === 'ERA_VERIFY' && a.enabled);
    if (verification) return select(verification, 'Verify the actual two incident receipts and institutional change at the original quarterly meeting');
    const activeNode = policy.verified.find(id => {
      const start = 144 + [39, 52, 65, 78][Number(id.split('-')[1]) - 1];
      return policy.week >= start && policy.week <= start + 1;
    });
    if (activeNode && policy.location !== WORKSHOP) return execute(travel(WORKSHOP), 'Carry this same prepared compound physically to the workshop during its real verified window');
    if (policy.location !== HOME && !activeNode) return execute(travel(HOME), 'Return physically for current incident dispatch and the next actual quarterly verification');
    if (needsRest()) return restOrWait('Restore actual body and spirituality while waiting for the next fixed incident and meeting');
    // Assist already-missed original incidents without pretending to undo the
    // departed residents, spoilage, deadlines or expired quarterly opportunity.
    const backlog = INCIDENTS.find(item => item.deadline < policy.week && !policy.resolved.includes(item.id) && enabled(era('ERA_RESPOND', { incidentId: item.id, mode: 'COORDINATED' })));
    if (backlog) return select(enabled(era('ERA_RESPOND', { incidentId: backlog.id, mode: 'COORDINATED' })), 'Assist the actual remaining residents; earlier losses and missed deadlines remain real');
    return wait('Let the existing calendar advance with actual living costs to the next original incident or quarterly meeting');
  }
  return stop('PUBLIC_ACTION_BLOCKED', `Unrecognized public strategy phase ${policy.phase}`);
}

export function advancePolicy(decision, after) {
  const policy = clone(decision.policy), c = decision.action.command;
  if (decision.advanceStep) {
    if (policy.phase === 'RECOVERY') policy.recoveryStep++;
    else policy.step++;
  }
  if (c.type === 'NEXT_WEEK') policy.week++;
  if (c.type === 'TRAVEL') policy.location = c.to;
  if (c.type === 'ERA' && c.command.type === 'ERA_TRAVEL') {
    policy.week += price(decision.action).weeks;
    policy.location = c.command.cityId === 'BACKLUND' ? HOME : `${c.command.cityId.toLowerCase()}:relay-station`;
  }
  if (c.type === 'ERA' && c.command.type === 'ERA_RESPOND') policy.resolved.push(c.command.incidentId);
  if (c.type === 'ERA' && c.command.type === 'ERA_VERIFY') policy.verified.push(c.command.nodeId);
  if (c.type === 'CONSUME') {
    policy.doses++; policy.failedCompoundId = after.promoted ? null : c.compoundId;
    policy.phase = after.promoted ? 'EPILOGUE' : 'RECOVERY'; policy.recoveryStep = 0;
  }
  if (c.type === 'EPILOGUE' && c.command.type === 'REPORT') policy.rescueReported = true;
  return policy;
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
  assert(existsSync(join(root, 'dist/domain/visionary/owned-session.js')), 'Build and freeze the reviewed runtime before capture; no game was loaded');
  for (const name of ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation', 'node_modules/@noble/hashes', SOURCE, HISTORY]) walk(name);
  files.push({ file: '$natural-producer', ...fileEvidence(SELF) });
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
export function readSource(root = process.cwd()) {
  const bytes = readFileSync(join(root, SOURCE)), historyBytes = readFileSync(join(root, HISTORY));
  assert.equal(sha(bytes), SOURCE_SHA256, 'Original living659 source bytes changed');
  assert.equal(sha(historyBytes), HISTORY_SHA256, 'Original separate667 history bytes changed');
  const source = JSON.parse(bytes), old = JSON.parse(historyBytes), commands = old.commands.slice(0, PREFIX_COUNT);
  assert.equal(old.commands.length, 667); assert.equal(old.final.status, 'DEAD'); assert.equal(old.final.revision, 668);
  assert.equal(compactHash(commands), PREFIX_SHA256); assert.equal(source.revision, PREFIX_COUNT + 1);
  assert.equal(source.runId, 'audience-rebuild-natural'); assert.equal(old.seed, source.random.seed);
  assert.deepEqual(source.random, { seed: 'audience-rebuild-first', cursor: 480 });
  assert.equal(source.schemaVersion, 185); assert.equal(source.contentVersion, 'writer-v185');
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.week, 144);
  assert.deepEqual([source.health, source.mind, source.spirituality, source.cash, source.actionsRemaining], [100, 100, 120, 400, 3]);
  assert.deepEqual(source.injuries, []); assert.equal(source.progression.sequence, 1); assert.equal(source.progression.acting, 100);
  assert.equal(source.character.weeklyWage, 180); assert.equal(source.lifeTier, 'DESTITUTE');
  assert.equal(source.debts.reduce((sum, debt) => sum + debt.remaining, 0), 0);
  assert.deepEqual(source.writer.bottles.map(b => [b.id, b.status, b.labourSteps]), [
    ['writer-potion-1', 'CONSUMED', 5], ['writer-potion-2', 'SUPPLIER', 0], ['writer-potion-3', 'SUPPLIER', 0],
  ]);
  return { source, commands, creation: old.creation, seed: old.seed, initial: old.initial };
}
async function loadRuntime(root) {
  const [slice, migration, session] = await Promise.all(['domain/slice/index', 'domain/slice/migration', 'domain/visionary/owned-session']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  return { ...slice, migrateSliceState: migration.migrateSliceState, openVisionaryRuntimeSession: session.openVisionaryRuntimeSession };
}
function migrate(runtime, original) {
  const state = runtime.migrateSliceState(original);
  for (const [key, value] of Object.entries(original)) {
    if (key === 'schemaVersion' || key === 'contentVersion') continue;
    assert.deepEqual(state[key], value, `Migration changed original ${key}`);
  }
  assert.equal(state.contentVersion, 'visionary-v207'); assert.equal(state.schemaVersion, 207);
  runtime.assertValidSliceState(state); return state;
}
function checkOriginals(state, original) {
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, original.random.seed);
  assert(state.random.cursor >= original.random.cursor);
  for (const key of ['audience', 'mindreader', 'psychologist', 'hypnotist', 'dreamwalker', 'manipulator', 'dreamWeaver', 'discerner', 'writer', 'world', 'combatHistory'])
    assert.deepEqual(state[key], original[key], `Original history changed: ${key}`);
  assert.deepEqual(state.character, original.character, 'Original identity and core skills must remain unchanged');
  for (const [id, value] of Object.entries(original.progression.mastery)) assert.equal(state.progression.mastery[id], value, `Original mastery changed: ${id}`);
  if (state.visionary.source) {
    assert.equal(state.visionary.source.revision, original.revision);
    assert.deepEqual(state.visionary.source.random, original.random);
    assert.deepEqual(state.visionary.source.budget.injuries, original.injuries);
    assert.equal(state.visionary.source.budget.cash, original.cash);
  }
}
const syncDirectory = path => { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } };
function durableCreate(path, value) {
  const fd = openSync(path, 'wx'); try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
}
export const encodeCheckpoint = payload => JSON.stringify({ sha256: stateHash(payload), payload });
export function decodeCheckpoint(bytes) {
  const envelope = JSON.parse(bytes); assert.equal(envelope.sha256, stateHash(envelope.payload), 'Checkpoint checksum mismatch');
  assert.equal(envelope.payload.format, FORMAT); return envelope;
}
export function recoverAtomicNext(path) {
  const candidate = `${path}.next`; if (!existsSync(candidate)) return;
  const current = existsSync(path) ? decodeCheckpoint(readFileSync(path, 'utf8')) : null;
  let next;
  try { next = decodeCheckpoint(readFileSync(candidate, 'utf8')); }
  catch {
    assert(!existsSync(`${path}.incomplete`), 'Preserve both incomplete boundaries and inspect before resume');
    renameSync(candidate, `${path}.incomplete`); syncDirectory(dirname(path)); return;
  }
  assert.equal(next.payload.predecessorSha256, current?.sha256 ?? null, 'Unknown checkpoint successor; do not discard it');
  renameSync(candidate, path); syncDirectory(dirname(path));
}
function saveCheckpoint(path, payload, predecessorSha256) {
  assert(!existsSync(`${path}.next`), 'Recover the pending atomic successor first');
  const text = encodeCheckpoint({ ...payload, predecessorSha256 }); durableCreate(`${path}.next`, text);
  renameSync(`${path}.next`, path); syncDirectory(dirname(path)); return decodeCheckpoint(text);
}
function replaceDerived(path, value) {
  const temporary = `${path}.derived-next`, fd = openSync(temporary, 'w');
  try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path); syncDirectory(dirname(path));
}
export function verifyCheckpoint(payload, freeze, initialStateSha256) {
  assert.equal(payload.source, SOURCE); assert.equal(payload.sourceSha256, SOURCE_SHA256);
  assert.equal(payload.historySha256, HISTORY_SHA256); assert.equal(payload.prefixSha256, PREFIX_SHA256);
  assert.equal(payload.freezeSha256, freeze.sha256); assert.deepEqual(payload.policyDefinition, POLICY);
  assert.equal(payload.initialStateSha256, initialStateSha256);
  assert.equal(payload.commandCount, PREFIX_COUNT + payload.commands.length); assert.equal(payload.rows.length, payload.commands.length);
  assert.equal(payload.finalStateSha256, stateHash(payload.state));
  let priorState = initialStateSha256, priorPublic = payload.initialPublicSha256, priorRandom = payload.initialRandomSha256;
  let priorPolicy = stateHash(startingPolicy());
  for (const [index, row] of payload.rows.entries()) {
    assert.equal(row.commandCount, PREFIX_COUNT + index + 1); assert.deepEqual(row.intent, payload.commands[index]);
    assert.equal(row.commandSha256, compactHash(row.intent)); assert.equal(row.beforeStateSha256, priorState);
    assert.equal(row.publicBeforeSha256, priorPublic); assert.equal(row.randomBeforeSha256, priorRandom);
    assert.equal(row.policyBeforeSha256, priorPolicy); assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore));
    assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    assert.equal(row.randomBefore.seed, row.randomAfter.seed); assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    priorState = row.afterStateSha256; priorPublic = row.publicAfterSha256; priorRandom = row.randomAfterSha256; priorPolicy = row.policyAfterSha256;
  }
  assert.equal(priorState, payload.finalStateSha256); assert.equal(priorPublic, payload.publicStateSha256);
  assert.equal(priorRandom, stateHash(payload.state.random)); assert.equal(priorPolicy, stateHash(payload.policy));
  assert.equal(payload.policy.week, payload.state.week);
  if (payload.pending) {
    assert.equal(payload.pending.commandCount, payload.commandCount + 1);
    assert.equal(payload.pending.beforeStateSha256, payload.finalStateSha256);
    assert.equal(payload.pending.publicBeforeSha256, payload.publicStateSha256);
    assert.equal(payload.pending.policyBeforeSha256, stateHash(payload.policy));
    assert.deepEqual(payload.pending.intent, { type: 'VISIONARY', command: payload.pending.decision.action.command });
  }
}
function selectedBoundary(command, after, previous) {
  const first = key => previous.some(item => item.kind === key) ? null : key;
  if (['LEARN_GUIDANCE', 'STABILIZE_PROMOTION', 'CONSUME', 'START_EPILOGUE'].includes(command.type)) return command.type.toLowerCase();
  if (['WORK', 'NEXT_WEEK', 'TRAVEL', 'REST', 'CLINIC'].includes(command.type)) return first(`first-${command.type.toLowerCase()}`);
  if (command.type === 'ERA' && ['ERA_FORECAST', 'ERA_VERIFY'].includes(command.command.type)) return command.command.type.toLowerCase();
  if (command.type === 'ERA') {
    const c = command.command;
    if (['ERA_SURVEY', 'ERA_PILOT', 'ERA_CONNECT'].includes(c.type) && ['BACKLUND', 'FENEPOTTER'].includes(c.cityId))
      return first(`${c.type.toLowerCase()}-${c.cityId.toLowerCase()}`);
    if (c.type === 'ERA_ADOPT' && c.governmentId === 'LOEN') return 'first-government-adopted';
    if (c.type === 'ERA_ADOPT' && section(after, 'era').some(line => line.includes('四方采用 4/4'))) return 'four-governments-adopted';
    if (c.type === 'ERA_RESPOND' && ['tingen-rail', 'backlund-pump', 'pritz-beacon', 'trier-cold'].includes(c.incidentId)) return `actual-response-${c.incidentId}`;
  }
  if (command.type === 'MATERIAL') {
    const c = command.command;
    if (['COMPOSE_POTION', 'SEAL_REMAINS', 'RECOVER_SEALED', 'BUY_COMPOUND'].includes(c.type)) return c.type.toLowerCase();
    if (c.type === 'VERIFY_UNIQUENESS') return `uniqueness-${c.step.toLowerCase()}`;
    if (['MATERIAL_LABOUR', 'ACQUIRE_CHARACTERISTIC', 'ACQUIRE_UNIQUENESS'].includes(c.type)) return first(`first-${c.type.toLowerCase()}`);
  }
  if (command.type === 'EPILOGUE') return `actual-rescue-${command.command.type.toLowerCase()}`;
  return null;
}
export function parseOptions(args) {
  const result = { out: null, resume: null, maxNewActions: POLICY.defaultObservationActions };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index], value = args[++index]; assert(value !== undefined, `Missing value for ${flag}`);
    assert(!seen.has(flag), `Duplicate ${flag}`); seen.add(flag);
    if (flag === '--out') result.out = resolve(value);
    else if (flag === '--resume') result.resume = resolve(value);
    else if (flag === '--max-new-actions') { assert(/^\d+$/.test(value)); result.maxNewActions = Number(value); assert(Number.isSafeInteger(result.maxNewActions)); }
    else throw Error(`Unsupported ${flag}: no source, seed, roll, strategy, resource or outcome overrides`);
  }
  if (result.resume) { assert(!result.out || result.out === dirname(result.resume), 'Resume retains its exact output directory'); result.out = dirname(result.resume); }
  return result;
}
export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), root = process.cwd();
  assert.equal(resolve(root, 'scripts/play/visionary-stage.mjs'), SELF, 'Run from the matching frozen repository root');
  const old = readSource(root), freeze = inspectFreeze(root), stamps = stampFreeze(root, freeze);
  const runtime = await loadRuntime(root), initial = migrate(runtime, old.source), initialHash = stateHash(initial);
  if (!options.out) { mkdirSync(join(root, 'output/play'), { recursive: true }); options.out = mkdtempSync(join(root, 'output/play/visionary-02100-')); }
  for (const name of ['src', 'dist', 'scripts', 'tests', 'docs', 'node_modules', '.git'])
    assert(![join(root, name), join(root, name) + sep].some((prefix, index) => index ? options.out.startsWith(prefix) : options.out === prefix), 'Output cannot modify a source, runtime, fixture, or repository metadata tree');
  assert.notEqual(options.out, root); mkdirSync(options.out, { recursive: true });
  const checkpointPath = options.resume ?? join(options.out, 'checkpoint.json'), freezePath = join(options.out, 'freeze.json');
  assert.equal(dirname(checkpointPath), options.out);
  let saved, session = null, stage = null, reason = null, count = 0;
  if (options.resume) {
    // Drift is rejected before adopting or executing any pending boundary.
    assert.deepEqual(JSON.parse(readFileSync(freezePath, 'utf8')), freeze, 'Frozen source/compiled/producer inputs changed; same-runtime resume rejected');
    recoverAtomicNext(checkpointPath); saved = decodeCheckpoint(readFileSync(checkpointPath, 'utf8'));
    verifyCheckpoint(saved.payload, freeze, initialHash);
    if (saved.payload.terminal) ({ stage, reason } = saved.payload.terminal);
  } else {
    assert(!existsSync(checkpointPath) && !existsSync(`${checkpointPath}.next`) && !existsSync(freezePath), 'Refuse to overwrite a capture; use --resume');
    const view = runtime.projectSliceState(initial).visionary;
    durableCreate(freezePath, JSON.stringify(freeze)); durableCreate(join(options.out, 'producer.mjs'), readFileSync(SELF));
    durableCreate(join(options.out, 'prefix-original659.json'), JSON.stringify({ source: SOURCE, sourceSha256: SOURCE_SHA256,
      history: HISTORY, historySha256: HISTORY_SHA256, prefixCount: PREFIX_COUNT, prefixSha256: PREFIX_SHA256,
      commands: old.commands, initial: old.initial, final: old.source, historicalPrefixReplayedHere: false, separate667DeathRetained: true }));
    syncDirectory(options.out);
    saved = saveCheckpoint(checkpointPath, { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256, historySha256: HISTORY_SHA256,
      prefixSha256: PREFIX_SHA256, freezeSha256: freeze.sha256, policyDefinition: POLICY, policy: startingPolicy(),
      createdAt: new Date().toISOString(), commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state: initial,
      initialStateSha256: initialHash, finalStateSha256: initialHash, initialPublicSha256: stateHash(view), publicStateSha256: stateHash(view),
      initialRandomSha256: stateHash(initial.random), pending: null, terminal: null }, null);
  }
  try {
    if (saved.payload.state.visionary.guidanceKnown) session = runtime.openVisionaryRuntimeSession(saved.payload.state);
    const project = () => session ? session.projectVisionary() : runtime.projectSliceState(saved.payload.state).visionary;
    assert.equal(stateHash(project()), saved.payload.publicStateSha256, 'Reopened public boundary changed');
    for (const boundary of saved.payload.boundaries) assert.deepEqual(fileEvidence(join(options.out, boundary.file)), { bytes: boundary.bytes, sha256: boundary.sha256 });
    while (!stage) {
      unchanged(stamps); const boundary = saved.payload;
      if (boundary.state.status !== 'ACTIVE') { stage = 'NATURAL_ACTUAL_TERMINAL'; reason = `Actual runtime status ${boundary.state.status}`; break; }
      // A requested/default observation limit is a resumable operator pause. It
      // never creates death, closes an event or declares the strategy exhausted.
      if (!boundary.pending && count >= options.maxNewActions) { stage = 'MANUAL_PAUSE'; reason = 'Observation limit reached at a durable completed-action boundary; resume the same frozen policy'; break; }
      let pending = boundary.pending;
      if (!pending) {
        const view = project(), decision = chooseAction(view, boundary.policy);
        if (decision.stop) { stage = decision.stop; reason = decision.reason; break; }
        pending = { commandCount: boundary.commandCount + 1, intent: { type: 'VISIONARY', command: clone(decision.action.command) }, decision,
          beforeStateSha256: boundary.finalStateSha256, publicBeforeSha256: stateHash(view), policyBeforeSha256: stateHash(boundary.policy), startedAt: new Date().toISOString() };
        saved = saveCheckpoint(checkpointPath, { ...boundary, pending }, saved.sha256);
      }
      const beforeView = project(), action = beforeView.actions.find(a => isDeepStrictEqual(a.command, pending.intent.command));
      assert(action?.enabled, `Exact pending action is unavailable: ${action?.reason ?? 'missing'}`);
      assert.deepEqual(action, pending.decision.action); assert.equal(stateHash(beforeView), pending.publicBeforeSha256);
      assert.deepEqual(chooseAction(beforeView, saved.payload.policy), pending.decision, 'Pending command must remain the exact frozen public-policy selection');
      const before = saved.payload.state, started = performance.now(); let draft = null, next, after;
      if (session) {
        draft = session.prepare(pending.intent, before.revision); next = session.snapshotDraft(draft); after = session.projectDraftVisionary(draft);
      } else {
        assert.deepEqual(pending.intent.command, { type: 'LEARN_GUIDANCE' });
        next = runtime.applySliceIntent(before, pending.intent); session = runtime.openVisionaryRuntimeSession(next); after = session.projectVisionary();
      }
      assert.equal(next.revision, before.revision + 1); checkOriginals(next, old.source);
      const policy = advancePolicy(pending.decision, after); assert.equal(policy.week, next.week, 'Displayed committed travel time must equal the actual clock');
      if (next.visionary.frame) assert.equal(policy.location, next.visionary.frame.location, 'Committed public location must equal the actual location');
      const latest = next.visionary.journal.at(-1), row = {
        commandCount: pending.commandCount, intent: clone(pending.intent), commandSha256: compactHash(pending.intent),
        reason: pending.decision.reason, publicLabel: action.label, publicCost: action.cost,
        startedAt: pending.startedAt, elapsedMilliseconds: Math.round(performance.now() - started), revision: next.revision, week: next.week,
        beforeStateSha256: pending.beforeStateSha256, afterStateSha256: stateHash(next),
        publicBeforeSha256: pending.publicBeforeSha256, publicAfterSha256: stateHash(after),
        randomBefore: clone(before.random), randomAfter: clone(next.random), randomBeforeSha256: stateHash(before.random), randomAfterSha256: stateHash(next.random),
        policyBeforeSha256: pending.policyBeforeSha256, policyAfterSha256: stateHash(policy),
        receipts: latest && latest.revision === next.revision ? { checks: clone(latest.randomReceipts), finance: clone(latest.financeReceipts), notes: clone(latest.notes) } : { checks: [], finance: [], notes: ['Actual guidance paid: 100 pennies and one action.'] },
      };
      const selected = selectedBoundary(pending.intent.command, after, saved.payload.boundaries), boundaries = [...saved.payload.boundaries];
      if (selected) {
        const file = `boundary-${pending.commandCount}-${selected}.json`, path = join(options.out, file);
        // Wall-clock timing may differ after a crash, but the prepared command,
        // state, public result, receipts and every hash must be identical.
        const bytes = JSON.stringify({ commandCount: pending.commandCount, beforeLast: before, lastIntent: pending.intent, final: next, public: after,
          audit: { ...row, elapsedMilliseconds: null } });
        if (existsSync(path)) assert.equal(readFileSync(path, 'utf8'), bytes, 'Existing selected boundary differs from the exact resumed draft');
        else { durableCreate(path, bytes); syncDirectory(options.out); }
        boundaries.push({ file, kind: selected, commandCount: pending.commandCount, ...fileEvidence(path) });
      }
      saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next, finalStateSha256: row.afterStateSha256, publicStateSha256: row.publicAfterSha256,
        commandCount: pending.commandCount, commands: [...saved.payload.commands, pending.intent], rows: [...saved.payload.rows, row], boundaries, policy, pending: null }, saved.sha256);
      if (draft) session.commit(draft); count++;
      console.log(JSON.stringify({ completed: pending.commandCount, action: action.label, week: next.week, sequence: next.progression.sequence, milliseconds: row.elapsedMilliseconds }));
    }
    unchanged(stamps); assert.deepEqual(inspectFreeze(root), freeze, 'Frozen bytes changed during capture');
    verifyCheckpoint(saved.payload, freeze, initialHash); runtime.assertValidSliceState(saved.payload.state);
    if (saved.payload.state.visionary.guidanceKnown) {
      const strict = runtime.openVisionaryRuntimeSession(saved.payload.state);
      assert.equal(stateHash(strict.snapshot()), saved.payload.finalStateSha256); assert.equal(stateHash(strict.projectVisionary()), saved.payload.publicStateSha256);
    }
    const paused = stage === 'MANUAL_PAUSE';
    if (!paused && !saved.payload.terminal) saved = saveCheckpoint(checkpointPath, { ...saved.payload, terminal: { stage, reason } }, saved.sha256);
    const view = project();
    replaceDerived(join(options.out, 'commands.ndjson'), saved.payload.rows.map(row => JSON.stringify(row)).join('\n') + (saved.payload.rows.length ? '\n' : ''));
    replaceDerived(join(options.out, 'boundaries.index.json'), JSON.stringify(saved.payload.boundaries));
    replaceDerived(join(options.out, 'natural.json'), JSON.stringify({ provenance: { kind: 'EXACT_ORIGINAL_LIVING_WRITER659_PUBLIC_VISIONARY_CONTINUATION',
      source: SOURCE, sourceSha256: SOURCE_SHA256, originalHistory: HISTORY, originalHistorySha256: HISTORY_SHA256,
      prefixCommandsSha256: PREFIX_SHA256, runtimeFreezeSha256: freeze.sha256, historicalPrefixReplayedByThisProducer: false,
      originalPrefixRetainedExactly: true, separateOriginal667DeathUnchanged: true, privateAudit: true, seedChanged: false, randomOverridden: false,
      selectedFromEnabledPublicActionsOnly: true }, creation: old.creation, seed: old.seed, prefixCount: PREFIX_COUNT,
      commands: [...old.commands, ...saved.payload.commands], initial: old.initial, prefixFinal: old.source, policy: POLICY,
      stage, reason, pendingIntent: saved.payload.pending?.intent ?? null, boundaries: saved.payload.boundaries, final: saved.payload.state }));
    // Public summary excludes private RNG, input manifests and internal receipts.
    replaceDerived(join(options.out, 'summary.json'), JSON.stringify({ stage, reason, commands: saved.payload.commandCount,
      originalCommands: PREFIX_COUNT, newCommands: saved.payload.commands.length, week: saved.payload.policy.week, paused,
      strictFinalValidation: true, public: view }));
    console.log(JSON.stringify({ outputDir: options.out, stage, commands: saved.payload.commandCount, paused }));
    return { outputDir: options.out, stage, commands: saved.payload.commandCount, paused };
  } catch (error) {
    try { replaceDerived(join(options.out, 'error.json'), JSON.stringify({ stage: 'CAPTURE_INTERRUPTED', error: String(error),
      commandCount: saved?.payload.commandCount ?? null, resumeExactPendingRequired: true, at: new Date().toISOString() })); }
    catch { /* Keep the original error and every durable boundary. */ }
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
