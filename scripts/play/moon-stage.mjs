import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gzipSync, gunzipSync } from 'node:zlib';
/** Exact original670 continuation. No replay/search/redraw or alternative seed.
 * Read-only public choices precede every genuine command. Atomic compressed
 * checkpoints retain the exact pending intent and every completed hash chain.
 * The archived912 independent-original run is deliberately not an input. */
export const SOURCE = 'tests/fixtures/beauty-goddess-v01900/script-blocker-first.json';
export const SOURCE_SHA256 = '195064d584c3fa6bb7c87584970ab5e2a43d5493613cb66afa3252902fc453eb';
export const PREFIX_COUNT = 670;
export const PREFIX_SHA256 = '40c5fe395855437d65c9c670916fe4bbc6a0db2fb683e8c9472de57e1cd409bc';
export const FORMAT = 'MOON670_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
export const POLICY = Object.freeze({ id: 'MOON670_SAME_ORIGINAL_RECOVERY_NIGHT_SERVICES_V1', startWeek: 160,
  wage: 180, weeklyLiving: 30, defaultObservationActions: 500, selectedBoundaryLimit: 30,
  recovery: 'SAME_FAILED_ORIGINAL_120P_1AP_LATER_WEEK_1AP_FIVE_FRESH_JOBS_90P_PREPARE_150P',
  practice: 'THREE_ACTUAL_BEAUTY_CASES_ORDINARY_RETURNS_REFLECTION_AND_ACTUAL_DATE',
  services: 'THREE_REAL_NIGHT_STATIONS_PAID_OIL_WINDOWS_CLOSURES_SHORE_RETURNS_REPAIR',
  promotion: 'THREE_CONSERVED_ORIGINALS_ONE_UNIQUENESS_PAID_SAME_COMPOUND_STABILITY',
  epilogue: 'FINITE_ACTUAL_TECHNIQUES_OR_ORDINARY_EVACUATION_REPORT', noReroll: true });
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
const section = (view, id) => view.sections?.find(item => item.id === id)?.lines ?? [];
const cash = view => Number(String(view.resources.cash).match(/^\d+/)?.[0] ?? NaN);
export const publicPrice = action => ({ actions: Number(action.cost.match(/(\d+)行动/)?.[1] ?? 0), cash: Number(action.cost.match(/(\d+)便士/)?.[1] ?? 0) });
export function startingPolicy() { return { phase: 'BEAUTY_RECOVERY', week: 160, recoveryTarget: 'beauty-goddess-potion-1',
  beautyDoses: 0, moonDoses: 0, epilogueAttempted: [], reported: false, loop: { key: null, repetitions: 0 } }; }
const commandOf = intent => intent.command ?? intent;
const actionOf = (domain, action) => ({ ...clone(action), intent: { type: domain, command: clone(action.command) } });
const noProgress = reason => ({ stop: 'PUBLIC_ACTION_BLOCKED', reason });

/** Extract only the currently displayed panel and ordinary public dashboard.
 * Private RNG, frozen-source handles and internal custody are never policy input. */
export function capturePublic(projection) {
  const fields = ['runId','revision','status','week','date','actionsRemaining','weeklyBudget','cash','weeklyWage','wagePaid',
    'health','mind','spirituality','maxHealth','maxMind','maxSpirituality','pollution','injuries','injuryRisk',
    'debtTotal','debts','canAct','actionBlockedReason','activeEvent','combat'];
  const ordinary = Object.fromEntries(fields.map(key => [key, clone(projection[key])]));
  return { ...ordinary, progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
    mastery: clone(projection.progression.mastery) }, beautyGoddess: clone(projection.beautyGoddess), moon: clone(projection.moon) };
}
function eventAction(view) {
  const e = view.activeEvent;
  const ids = e.id.startsWith('ORIGIN') ? ['.decline'] : ({
    'LIFE-BILL-01': ['PAY_PART'], 'DEBT-NOTICE-01': ['DECLINE'], 'DEBT-SETTLE-01': ['DEFER'],
    'LIFE-CARE-01': ['PAY', 'CREDIT', 'AID'], 'CARE-WORK-OFFER': ['DECLINE'],
  })[e.id];
  const choice = ids?.map(id => e.choices.find(c => c.id === id && c.enabled)).find(Boolean);
  if (!choice) return noProgress(`Unplanned or unavailable public event ${e.id}; retain its exact choices and checkpoint`);
  return { action: { id: `${e.id}:${choice.id}`, label: choice.label, cost: '按当前公开事件结算实际费用与旧债', enabled: true, reason: null,
    intent: { type: 'EVENT_CHOICE', eventInstanceId: e.instanceId, choiceId: choice.id } }, reason: 'Resolve the actual public living, debt or medical event without cancelling its costs' };
}
function ordinaryAction(view, reason) {
  if (!view.canAct) return noProgress(`${reason}: ${view.actionBlockedReason ?? 'No ordinary public action is available'}`);
  const action = view.wagePaid ? 'REST' : 'WORK';
  return { action: { id: `ordinary-${action}`, label: action === 'WORK' ? '做本周原职业工作' : '按实际生活档休养',
    cost: '1行动；真实工资、生活费与旧债照常结算', enabled: true, reason: null, intent: { type: 'ACTION', action } }, reason };
}
function beautyAction(view, policy) {
  const b = view.beautyGoddess, offered = b.actions;
  const find = type => offered.find(action => action.command.type === type);
  const select = (a, reason) => ({ action: actionOf('BEAUTY_GODDESS', a), reason });
  const recover = reason => ordinaryAction(view, reason);
  const full = () => view.health >= view.maxHealth && view.mind >= view.maxMind && view.spirituality >= view.maxSpirituality && view.pollution === 0 && view.injuries.length === 0;
  const take = (a, reason) => {
    if (!a) return noProgress(`${reason}: the required public action is missing`);
    if (a.enabled) return select(a, reason);
    const cost = publicPrice(a);
    if (view.actionsRemaining < cost.actions || view.cash < cost.cash || /隔一真实周|下一真实周|下一个真实周|隔一周|隔周/.test(a.reason ?? ''))
      return recover(`${reason}: ${a.reason}`);
    return noProgress(`${a.label}: ${a.reason ?? 'The public prerequisite is unresolved'}`);
  };
  if (!b.promoted) {
    policy.phase = 'BEAUTY_RECOVERY';
    // Preparation is a real lock. Consume this already-paid original before any
    // optional rest/work; never repeat the already accepted body decision.
    if (b.preparedWeek !== null) {
      const dose = offered.find(a => a.command.type === 'CONSUME' && a.enabled);
      return dose ? select(dose, 'Independently consume the actual paid prepared S1 vessel; retain the real44% result')
        : find('LEAVE_PREPARATION')?.enabled ? select(find('LEAVE_PREPARATION'), 'Leave an unusable actual preparation by its ordinary exit, retaining the fee')
        : noProgress('Paid S1 preparation has neither its exact available dose nor an ordinary exit');
    }
    if (!view.wagePaid && view.canAct) return recover('Earn the original180p wage once in this real week');
    const pendingRecovery = find('RECOVER_CHARACTERISTIC_V1');
    if (pendingRecovery) return take(pendingRecovery, 'Recover only the investigated same original after its required later real week');
    const labour = find('POTION_WORK');
    if (labour) return take(labour, 'Perform one of five new real jobs for this new ordinary carrier; old labour is not reused');
    const buy = find('BUY_POTION');
    if (buy) return take(buy, 'Pay90p after this carrier’s five fresh jobs and take custody of the same original');
    if (find('CONSUME')) {
      if (!full()) return recover('Recover the actual failed-dose body and pollution before paying for this attempt’s preparation');
      return take(find('PREPARE_PROMOTION'), 'Pay150p and one actual action for this S1 vessel’s current preparation');
    }
    const investigate = offered.find(a => a.command.type === 'REQUEST_RECOVERY_V1' && a.command.bottleId === policy.recoveryTarget);
    if (investigate) return take(investigate, 'Pay120p and one real action to investigate the exact failed same-original vessel');
    return noProgress('No same-original recovery, fresh carrier, or actual paid S1 dose is publicly available; never request new independent supply');
  }
  policy.phase = 'BEAUTY_PRACTICE';
  const preferred = offered.find(a => a.preferredAction && a.id.startsWith('beauty-goddess-life-'));
  if (!b.life.reflected) {
    if (!b.insideCase && !view.wagePaid && view.canAct) return recover('Earn this week’s actual original wage before entering a finite practice');
    const paused = preferred?.command.type === 'INVITE' ? b.life.cases?.find(c => c.id === preferred.command.caseId && c.status === 'PAUSED') : null;
    if (paused && (paused.attempts?.at(-1)?.invitedWeek ?? view.week) >= view.week)
      return recover('Continue the paused original case only after its required later real week, retaining the failed attempt');
    if (preferred?.command.type === 'INVITE' && (view.actionsRemaining < 2 || view.cash < 150 || !full()))
      return recover('Reserve two actual actions,150p and ordinary recovered resources for the finite original practice');
    if (preferred?.enabled) return select(preferred, 'Follow the current original practice, attempt its real finite skill, and retain ordinary failure/return outcomes');
    if (b.insideCase) {
      const exit = offered.find(a => a.enabled && a.command.type === 'ABORT');
      return exit ? select(exit, 'Use the original ordinary cleanup/exit when the current practice cannot proceed')
        : noProgress('An active original practice has no enabled public next step or ordinary exit');
    }
    return preferred ? take(preferred, 'Complete this real practice/report/reflection with ordinary resources')
      : noProgress('No public next practice/report/reflection remains before actual S1 digestion is complete');
  }
  policy.phase = 'MOON_ENTRY';
  if (view.progression.acting !== 100 || Object.keys(view.progression.mastery).length !== 23)
    return noProgress('Moon entry requires the actual21 inherited and2 S1 skills plus completed digestion; no state rewrite is permitted');
  const guidance = view.moon.actions.find(a => a.command.type === 'LEARN_GUIDANCE');
  if (guidance?.enabled) return { action: actionOf('MOON', guidance), reason: 'Pay Moon guidance only after actual S1 practice, ordinary exits and the dated future vacancy' };
  if (guidance && (/未来变故尚未发生/.test(guidance.reason ?? '') || view.cash < 100 || view.actionsRemaining < 1))
    return recover(`Wait through genuine ordinary work/rest, living bills and debts until entry is available: ${guidance.reason}`);
  return noProgress(`Moon entry remains publicly blocked: ${guidance?.reason ?? 'missing guidance'}`);
}
function moonAction(view, policy) {
  const m = view.moon, actions = m.actions, enabled = type => actions.find(a => a.command.type === type && a.enabled);
  const select = (a, reason) => ({ action: actionOf('MOON', a), reason });
  const ordinary = type => enabled(type);
  const wait = reason => ordinary('NEXT_WEEK') ? select(ordinary('NEXT_WEEK'), reason) : noProgress(reason);
  const needsRest = () => m.resources.health < 100 || m.resources.mind < 100 || m.resources.spirituality < (m.promoted ? 150 : 120) || [...section(m, 'body'), ...section(m, 'injuries')].some(l => /^(重伤|轻伤)：/.test(l));
  const recover = reason => ordinary('CLINIC') ? select(ordinary('CLINIC'), 'Pay the real ordinary60p treatment for the actual untreated heavy injury')
    : ordinary('REST') ? select(ordinary('REST'), reason) : wait(reason);
  const execute = (action, reason) => {
    if (action.enabled) return select(action, reason);
    const cost = publicPrice(action);
    if (m.resources.actionsRemaining < cost.actions || cash(m) < cost.cash) return wait(`Obtain the real weekly budget for ${action.label}: ${action.reason}`);
    if (/健康|精神|灵性|伤势|休养/.test(action.reason ?? '') && needsRest()) return recover(`Recover actual resources for ${action.label}`);
    if (/下一真实周|经过.*周|最早第|隔周|未来|下周|下一周/.test(action.reason ?? '')) return wait(`Wait the real required date for ${action.label}: ${action.reason}`);
    return noProgress(`${action.label}: ${action.reason ?? 'Unavailable public action'}`);
  };
  if (policy.reported) return { stop: 'NATURAL_FINITE_MOON_REPORTED', reason: 'The actual finite incident was reported; no rerun or successful skill is forced' };
  policy.phase = m.promoted ? 'MOON_EPILOGUE' : 'MOON_SERVICES_MATERIALS';
  const seal = actions.find(a => a.enabled && a.command.type === 'MATERIAL' && a.command.command.type === 'SEAL_REMAINS');
  if (seal) return select(seal, 'Contain the real failed compound in place before ordinary recovery; no refund or inventory gain');
  const dose = actions.find(a => a.enabled && a.command.type === 'CONSUME' && a.preferredAction === true);
  if (dose) {
    const prep = actions.find(a => a.command.type === 'STABILIZE_PROMOTION' && a.command.compoundId === dose.command.compoundId);
    if (!prep || prep.enabled || !section(m, 'promotion-stability').some(line => /当前准备仍有效|准备仍在原室和七天实际期限内有效/.test(line)))
      return { stop: 'PUBLIC_STABILITY_BINDING_BLOCKED', reason: 'The exact dose has no independently visible same-compound effective paid preparation' };
    return select(dose, 'Independently consume the same paid prepared S0 dose immediately; retain actual check, failure costs or death');
  }
  const report = actions.find(a => a.enabled && a.command.type === 'EPILOGUE' && a.command.command.type === 'REPORT');
  if (report) return select(report, 'Report the already-finished actual incident before optional work or healing');
  const handoff = actions.find(a => a.preferredAction && a.enabled && a.command.type === 'MATERIAL' && a.command.command.type === 'ACQUIRE_UNIQUENESS');
  if (handoff) return select(handoff, 'Complete the same-week handoff immediately after the actual final vacancy check');
  const appointment = actions.find(a => a.preferredAction && a.enabled && a.command.type === 'SERVICE' && ['WAIT','CONDUCT_SERVICE','VERIFY','SUSPEND','SHORE_RETURN'].includes(a.command.command.type));
  if (appointment) return select(appointment, 'Keep the actual booked night window and shore outcome ahead of optional eight-hour work or rest');
  if (m.insideCase) {
    const ep = type => actions.find(a => a.enabled && a.command.type === 'EPILOGUE' && a.command.command.type === type);
    if (ep('REPORT')) return select(ep('REPORT'), 'Report only the real people, positions, injuries and apparatus outcome');
    const preferred = actions.find(a => a.preferredAction && a.command.type === 'EPILOGUE' &&
      !(['MOONLIT_CHANNEL','GENTLE_CROSSING'].includes(a.command.command.type) && policy.epilogueAttempted.includes(a.command.command.type)));
    if (preferred?.enabled) return select(preferred, 'Perform this finite public step once, retaining actual skill success/failure and ordinary transfer');
    for (const type of ['EVACUATE','WITHDRAW','STOP_SERVICE']) if (ep(type)) return select(ep(type), 'Use the actual zero-resource ordinary shore exit without forcing magical success');
    return noProgress('The finite active incident has neither its intended enabled step nor an ordinary safety exit');
  }
  const next = actions.find(a => a.preferredAction && !['WORK','REST','CLINIC','NEXT_WEEK','CONSUME','RETURN_ON_FOOT'].includes(a.command.type));
  if (ordinary('WORK') && cash(m) < 3000 && !(next?.command.type === 'START_EPILOGUE' && cash(m) >= 20)) return select(ordinary('WORK'), 'Earn the original180p wage once this actual week; keep an ordinary finite operating reserve');
  if (needsRest()) return recover('Recover actual failed-dose injuries and resources through paid clinic and later ordinary rest');
  if (next) {
    if (next.command.type === 'SERVICE' && next.command.command.type === 'BOOK' && m.resources.actionsRemaining < 1)
      return wait('Reserve one actual service action before booking a night; do not knowingly miss it by exhausting this week’s budget');
    if (next.command.type === 'MATERIAL' && next.command.command.type === 'VERIFY_UNIQUENESS' && next.command.command.step === 'VACANCY') {
      const delivery = actions.find(a => a.command.type === 'MATERIAL' && a.command.command.type === 'ACQUIRE_UNIQUENESS');
      if (!delivery) return noProgress('The public same-week uniqueness handoff is missing');
      if (m.resources.actionsRemaining < publicPrice(next).actions + publicPrice(delivery).actions || cash(m) < publicPrice(next).cash + publicPrice(delivery).cash + POLICY.weeklyLiving)
        return wait('Reserve two actual actions and all270p fees plus the30p living bill for final vacancy verification and same-week unique-object handoff');
    }
    if (next.command.type === 'STABILIZE_PROMOTION' && m.resources.actionsRemaining < 2)
      return wait('Reserve two actual actions for this compound’s paid preparation and independent consumption');
    if (next.command.type === 'START_EPILOGUE' && m.resources.actionsRemaining < 3)
      return wait('Reserve three actual actions for finite skills and real transfer; ordinary exits remain free');
    return execute(next, 'Follow the public next real night-service, custody, paid preparation or finite incident step');
  }
  return noProgress('No intended public progression step is marked; preserve the exact boundary rather than guess a later state');
}
export function chooseAction(view, previous) {
  const policy = clone(previous);
  if (view.status !== 'ACTIVE') return { stop: 'NATURAL_ACTUAL_TERMINAL', reason: `Actual runtime status ${view.status}`, policy };
  if (view.combat) return { ...noProgress('Unexpected active combat must retain its real scene; this night-service policy does not invent combat choices'), policy };
  const result = view.activeEvent ? eventAction(view) : view.moon.guidanceKnown ? moonAction(view, policy) : beautyAction(view, policy);
  return { ...result, policy };
}
/** A repeated unchanged meaningful public boundary signals an actual loop.
 * Income/rest/week progression is counted as progress only when its public
 * prerequisite changes; growing chronicle IDs alone cannot defeat this guard. */
export function loopDiagnostic(before, after, policy) {
  const semantic = v => ({ phase: policy.phase, sequence: v.progression.sequence, acting: v.progression.acting,
    health: v.health, mind: v.mind, spirituality: v.spirituality, pollution: v.pollution, cash: v.cash, debt: v.debtTotal,
    week: v.week, activeEvent: v.activeEvent?.id ?? null, beautyNext: v.beautyGoddess.nextStep, moonNext: v.moon.nextStep,
    actions: [...v.beautyGoddess.actions, ...v.moon.actions].filter(a => a.preferredAction).map(a => [a.command,a.enabled,a.reason]) });
  const key = stateHash(semantic(after)), unchanged = isDeepStrictEqual(semantic(before), semantic(after));
  const repetitions = unchanged ? (policy.loop.key === key ? policy.loop.repetitions + 1 : 1) : 0;
  return { key, repetitions };
}
export function advancePolicy(decision, after, before) {
  const p = clone(decision.policy), i = decision.action.intent, c = commandOf(i);
  p.week = after.week;
  if (i.type === 'BEAUTY_GODDESS' && c.type === 'CONSUME') { p.beautyDoses++; p.recoveryTarget = c.bottleId; }
  if (i.type === 'MOON' && c.type === 'CONSUME') p.moonDoses++;
  if (i.type === 'MOON' && c.type === 'EPILOGUE') {
    if (!p.epilogueAttempted.includes(c.command.type)) p.epilogueAttempted.push(c.command.type);
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
  assert(existsSync(join(root, 'dist/domain/moon/owned-session.js')), 'Build and freeze the reviewed runtime before capture; no game was loaded');
  for (const name of new Set(['package.json','package-lock.json','src','dist/domain','dist/content','dist/resolution','dist/persistence','dist/shared','dist/application','dist/simulation','node_modules/@noble/hashes',SOURCE])) walk(name);
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
  const bytes = readFileSync(join(root, SOURCE));
  assert.equal(sha(bytes), SOURCE_SHA256, 'The original first-failure670 source bytes changed');
  const old = JSON.parse(bytes), source = old.final;
  assert.equal(old.commands.length, PREFIX_COUNT); assert.equal(compactHash(old.commands), PREFIX_SHA256);
  assert.equal(source.revision, 671); assert.equal(source.runId, 'apothecary-rebuild-natural');
  assert.equal(old.seed, source.random.seed); assert.deepEqual(source.random, { seed: 'apothecary-rebuild-first', cursor: 318 });
  assert.equal(source.schemaVersion, 187); assert.equal(source.contentVersion, 'beauty-goddess-v187');
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.week, 160);
  assert.deepEqual(source.date, { epoch: 'FIFTH_EPOCH', year: 1352, month: 7, day: 15 });
  assert.deepEqual([source.health, source.mind, source.spirituality, source.cash, source.actionsRemaining, source.seer.pollution], [85,75,120,14,1,30]);
  assert.deepEqual(source.injuries, []); assert.equal(source.wagePaidWeek, 160);
  assert.equal(source.progression.pathwayId, 'moon'); assert.equal(source.progression.sequence, 2); assert.equal(source.progression.acting, 100);
  assert.equal(source.character.weeklyWage, 180); assert.equal(source.lifeTier, 'DESTITUTE');
  assert.equal(source.beautyGoddess.transformation.decision, 'ACCEPTED');
  assert.deepEqual(source.beautyGoddess.bottles.map(b => [b.id,b.status,b.outcome]), [1,2,3].map(n => [`beauty-goddess-potion-${n}`,'CONSUMED','FAILURE']));
  assert.deepEqual(source.beautyGoddess.acquisitionJournal.filter(j => j.command.type === 'CONSUME').map(j => [j.check.chance,j.check.roll,j.check.tier]), [[44,48,'FAILURE'],[44,67,'FAILURE'],[44,86,'FAILURE']]);
  assert.equal(Object.keys(source.progression.mastery).length, 21);
  assert.equal(Object.values(source.progression.mastery).filter(v => v === 0).length, 7);
  return { source, commands: old.commands, creation: old.creation, seed: old.seed, initial: old.initial, originalObservation: { stage: old.stage, pendingIntent: old.pendingIntent, error: old.error }, bytes };
}
async function loadRuntime(root) {
  const [slice, migration, session] = await Promise.all(['domain/slice/index','domain/slice/migration','domain/moon/owned-session']
    .map(name => import(pathToFileURL(join(root, `dist/${name}.js`)).href)));
  return { ...slice, migrateSliceState: migration.migrateSliceState, openMoonRuntimeSession: session.openMoonRuntimeSession };
}
function migrate(runtime, original) {
  const state = runtime.migrateSliceState(original);
  for (const [key,value] of Object.entries(original)) if (!['schemaVersion','contentVersion'].includes(key))
    assert.deepEqual(state[key], value, `Migration changed original ${key}`);
  assert.equal(state.schemaVersion, 209); assert.equal(state.contentVersion, 'moon-v209');
  runtime.assertValidSliceState(state); return state;
}
export function checkOriginals(state, original, before) {
  assert.equal(state.runId, original.runId); assert.equal(state.random.seed, original.random.seed);
  assert(state.random.cursor >= original.random.cursor);
  for (const key of ['apothecary','tamer','vampire','potionProfessor','crimsonScholar','witchKing','summoningMaster','lifeGiver']) {
    const live = clone(state[key]), source = original[key];
    if (key === 'summoningMaster') live.life.partner = clone(source.life.partner);
    if (key === 'witchKing') live.life.papers = clone(source.life.papers);
    assert.deepEqual(live, source, `Earlier original history changed: ${key}`);
  }
  assert.deepEqual(state.beautyGoddess.bottles.slice(0, 3), original.beautyGoddess.bottles, 'Original three failures cannot be rewritten');
  assert.deepEqual(state.beautyGoddess.acquisitionJournal.slice(0, original.beautyGoddess.acquisitionJournal.length), original.beautyGoddess.acquisitionJournal, 'Original acquisition receipts changed');
  assert.deepEqual(state.combatHistory, original.combatHistory, 'Optional old combat is not part of this public night-service route');
  assert.deepEqual(state.beautyGoddess.encounter, original.beautyGoddess.encounter, 'The optional original opponent and scene stay untouched');
  for (const [id,value] of Object.entries(original.progression.mastery)) assert.equal(state.progression.mastery[id], value, `Original mastery changed: ${id}`);
  for (const key of ['name','age']) assert.equal(state.character[key], original.character[key]);
  const guest = state.summoningMaster.life.partner, oldGuest = original.summoningMaster.life.partner;
  for (const key of ['id','bodyId','homeId']) assert.equal(guest[key], oldGuest[key], `Original guest ${key} changed`);
  assert.deepEqual(guest.restHistory.slice(0, oldGuest.restHistory.length), oldGuest.restHistory);
  if (before.moon.guidanceKnown) {
    for (const key of ['apothecary','tamer','vampire','potionProfessor','crimsonScholar','witchKing','summoningMaster','lifeGiver','beautyGoddess','world','combatHistory'])
      assert.deepEqual(state[key], before[key], `Frozen actual S1 handoff changed: ${key}`);
    assert.deepEqual(state.moon.source, before.moon.source, 'Actual S1 source cannot be replaced after guidance');
  }
}
export function verifyCheckpoint(payload, freeze, initialStateSha256) {
  assert.equal(payload.format, FORMAT); assert.equal(payload.source, SOURCE); assert.equal(payload.sourceSha256, SOURCE_SHA256);
  assert.equal(payload.prefixSha256, PREFIX_SHA256); assert.equal(payload.freezeSha256, freeze.sha256);
  assert.deepEqual(payload.policyDefinition, POLICY); assert.equal(payload.initialStateSha256, initialStateSha256);
  assert.equal(payload.commandCount, PREFIX_COUNT + payload.commands.length); assert.equal(payload.rows.length, payload.commands.length);
  assert.equal(payload.finalStateSha256, stateHash(payload.state));
  let priorState = initialStateSha256, priorPublic = payload.initialPublicSha256, priorRandom = payload.initialRandomSha256;
  let priorPolicy = stateHash(startingPolicy());
  for (const [index,row] of payload.rows.entries()) {
    assert.equal(row.commandCount, PREFIX_COUNT + index + 1); assert.deepEqual(row.intent, payload.commands[index]);
    assert.equal(row.commandSha256, compactHash(row.intent)); assert.equal(row.beforeStateSha256, priorState);
    assert.equal(row.publicBeforeSha256, priorPublic); assert.equal(row.randomBeforeSha256, priorRandom);
    assert.equal(row.policyBeforeSha256, priorPolicy); assert.equal(row.randomBeforeSha256, stateHash(row.randomBefore));
    assert.equal(row.randomAfterSha256, stateHash(row.randomAfter));
    assert.deepEqual(Object.keys(row.selectionOutcome).sort(), ['beautyPromoted','moonPromoted','status']);
    assert.equal(typeof row.selectionOutcome.status, 'string');
    assert.equal(typeof row.selectionOutcome.beautyPromoted, 'boolean');
    assert.equal(typeof row.selectionOutcome.moonPromoted, 'boolean');
    assert.equal(row.randomBefore.seed, row.randomAfter.seed); assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    assert(!['REQUEST_SUPPLY','RECEIVE_SUPPLY'].includes(row.intent.command?.type), 'No future independent characteristic supply');
    priorState = row.afterStateSha256; priorPublic = row.publicAfterSha256; priorRandom = row.randomAfterSha256; priorPolicy = row.policyAfterSha256;
  }
  assert.equal(priorState, payload.finalStateSha256); assert.equal(priorPublic, payload.publicStateSha256);
  assert.equal(priorRandom, stateHash(payload.state.random)); assert.equal(priorPolicy, stateHash(payload.policy));
  assert.equal(payload.policy.week, payload.state.week);
  assert(payload.boundaries.length <= POLICY.selectedBoundaryLimit);
  assert.equal(new Set(payload.boundaries.map(b => b.kind)).size, payload.boundaries.length, 'Selected boundaries must be unique');
  if (payload.pending) {
    assert.equal(payload.pending.commandCount, payload.commandCount + 1);
    assert.equal(payload.pending.beforeStateSha256, payload.finalStateSha256);
    assert.equal(payload.pending.publicBeforeSha256, payload.publicStateSha256);
    assert.equal(payload.pending.policyBeforeSha256, stateHash(payload.policy));
    assert.deepEqual(payload.pending.intent, payload.pending.decision.action.intent);
  }
}
/** Minimal actual public outcome needed to independently rederive selection. */
export function selectionOutcome(after) {
  return { status: after.status, beautyPromoted: after.beautyGoddess.promoted, moonPromoted: after.moon.promoted };
}
/** At most30 distinct reusable SQLite samples; no duplicate boundary megafiles.
 * All non-selected commands remain in the complete durable hash/RNG chain. */
export function selectedBoundary(intent, after, previous) {
  if (previous.length >= POLICY.selectedBoundaryLimit) return null;
  const c = commandOf(intent); let key = null;
  if (intent.type === 'ACTION') key = `first-ordinary-${intent.action.toLowerCase()}`;
  if (intent.type === 'EVENT_CHOICE') key = 'first-original-finance-event';
  if (intent.type === 'BEAUTY_GODDESS') {
    if (['REQUEST_RECOVERY_V1','RECOVER_CHARACTERISTIC_V1','POTION_WORK','BUY_POTION','PREPARE_PROMOTION','REFLECT'].includes(c.type)) key = `s1-${c.type.toLowerCase()}`;
    if (c.type === 'CONSUME') key = after.beautyGoddess.promoted ? 's1-actual-promotion' : 's1-first-recovery-failure';
  }
  if (intent.type === 'MOON') {
    if (['LEARN_GUIDANCE','STABILIZE_PROMOTION','START_EPILOGUE'].includes(c.type)) key = `moon-${c.type.toLowerCase()}`;
    if (c.type === 'CONSUME') key = after.status !== 'ACTIVE' ? 'moon-actual-terminal-dose' : after.moon.promoted ? 'moon-actual-promotion' : 'moon-first-failed-dose';
    if (c.type === 'SERVICE' && ['CONDUCT_SERVICE','VERIFY','REPAIR_DAMAGE'].includes(c.command.type)) key = `night-${c.command.stationId}-${c.command.type.toLowerCase()}`;
    if (c.type === 'MATERIAL' && ['RECOVER_LEGACY_REMAINS','ACQUIRE_UNIQUENESS','COMPOSE_POTION','SEAL_REMAINS','RECOVER_SEALED'].includes(c.command.type)) key = `moon-${c.command.type.toLowerCase()}`;
    if (c.type === 'EPILOGUE' && c.command.type === 'REPORT') key = 'moon-finite-actual-report';
  }
  return key && !previous.some(item => item.kind === key) ? key : null;
}
export function parseOptions(args) {
  const result = { out: null, resume: null, maxNewActions: POLICY.defaultObservationActions }, seen = new Set();
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
export function readCapture(path) {
  const bytes = readFileSync(path); return JSON.parse(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8'));
}
function publicActionStillAvailable(view, action) {
  const i = action.intent;
  if (i.type === 'ACTION') return view.canAct && ['REST','WORK'].includes(i.action) && (i.action !== 'WORK' || !view.wagePaid);
  if (i.type === 'EVENT_CHOICE') return view.activeEvent?.instanceId === i.eventInstanceId && view.activeEvent.choices.some(c => c.id === i.choiceId && c.enabled);
  const panel = i.type === 'MOON' ? view.moon : i.type === 'BEAUTY_GODDESS' ? view.beautyGoddess : null;
  return !!panel?.actions.some(a => a.enabled && isDeepStrictEqual(a.command, i.command) && isDeepStrictEqual(actionOf(i.type, a), action));
}
function actualReceipts(next, before) {
  const journal = next.moon.guidanceKnown ? next.moon.journal : null, latest = journal?.at(-1);
  if (latest?.revision === next.revision) return { checks: clone(latest.randomReceipts), finance: clone(latest.financeReceipts), notes: clone(latest.notes) };
  const acquisition = next.beautyGoddess.acquisitionJournal.at(-1), practice = next.beautyGoddess.life.journal.at(-1);
  const matching = [acquisition,practice].filter(row => row?.revision === next.revision);
  return { checks: matching.filter(row => row.check).map(row => clone(row.check)), finance: [], notes: next.chronicle.slice(before.chronicle.length).map(row => clone(row)) };
}
export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args), root = process.cwd();
  assert.equal(resolve(root, 'scripts/play/moon-stage.mjs'), SELF, 'Run from the matching frozen repository root');
  const old = readSource(root), freeze = inspectFreeze(root), stamps = stampFreeze(root, freeze);
  const runtime = await loadRuntime(root), initial = migrate(runtime, old.source), initialHash = stateHash(initial);
  if (!options.out) { mkdirSync(join(root, 'output/play'), { recursive: true }); options.out = mkdtempSync(join(root, 'output/play/moon-02120-')); }
  for (const name of ['src','dist','scripts','tests','docs','node_modules','.git']) {
    const protectedPath = join(root, name);
    assert(options.out !== protectedPath && !options.out.startsWith(protectedPath + sep), 'Output cannot modify source, runtime, fixture, or repository metadata');
  }
  assert.notEqual(options.out, root); mkdirSync(options.out, { recursive: true });
  const checkpointPath = options.resume ?? join(options.out, 'checkpoint.json.gz'), freezePath = join(options.out, 'freeze.json');
  assert.equal(dirname(checkpointPath), options.out);
  let saved, session = null, stage = null, reason = null, count = 0;
  if (options.resume) {
    assert.deepEqual(readCapture(freezePath), freeze, 'Frozen source/runtime/producer drift; do not resume under changed rules');
    recoverAtomicNext(checkpointPath); saved = decodeCheckpoint(readFileSync(checkpointPath));
    verifyCheckpoint(saved.payload, freeze, initialHash);
    if (saved.payload.terminal) ({ stage, reason } = saved.payload.terminal);
  } else {
    assert(!existsSync(checkpointPath) && !existsSync(`${checkpointPath}.next`) && !existsSync(freezePath), 'Refuse to overwrite a capture; use --resume');
    const view = capturePublic(runtime.projectSliceState(initial));
    durableCreate(freezePath, JSON.stringify(freeze)); durableCreate(join(options.out, 'producer.mjs'), readFileSync(SELF));
    // One exact byte copy retains the historic first-failure observation and its
    // original pending/error record. No old history is replayed or reauthored.
    durableCreate(join(options.out, 'prefix-original670.json.gz'), gzipSync(old.bytes, { level: 6 })); syncDirectory(options.out);
    saved = saveCheckpoint(checkpointPath, { format: FORMAT, source: SOURCE, sourceSha256: SOURCE_SHA256,
      prefixSha256: PREFIX_SHA256, freezeSha256: freeze.sha256, policyDefinition: POLICY, policy: startingPolicy(),
      createdAt: new Date().toISOString(), commandCount: PREFIX_COUNT, commands: [], rows: [], boundaries: [], state: initial,
      initialStateSha256: initialHash, finalStateSha256: initialHash, initialPublicSha256: stateHash(view), publicStateSha256: stateHash(view),
      initialRandomSha256: stateHash(initial.random), pending: null, terminal: null }, null);
  }
  try {
    if (saved.payload.state.moon.guidanceKnown) session = runtime.openMoonRuntimeSession(saved.payload.state);
    const project = () => capturePublic(session ? session.project() : runtime.projectSliceState(saved.payload.state));
    assert.equal(stateHash(project()), saved.payload.publicStateSha256, 'Reopened public boundary changed');
    for (const boundary of saved.payload.boundaries) assert.deepEqual(fileEvidence(join(options.out, boundary.file)), { bytes: boundary.bytes, sha256: boundary.sha256 });
    while (!stage) {
      unchanged(stamps); const boundary = saved.payload;
      if (boundary.state.status !== 'ACTIVE') { stage = 'NATURAL_ACTUAL_TERMINAL'; reason = `Actual runtime status ${boundary.state.status}`; break; }
      if (!boundary.pending && count >= options.maxNewActions) { stage = 'MANUAL_PAUSE'; reason = 'Observation limit reached at a durable completed-action boundary; resume this same frozen policy'; break; }
      if (boundary.policy.loop.repetitions >= 3) { stage = 'PUBLIC_NO_PROGRESS_DIAGNOSTIC'; reason = 'Three actual accepted actions left the same meaningful public boundary unchanged; preserve state and inspect the reachable controls'; break; }
      let pending = boundary.pending;
      if (!pending) {
        const view = project(), decision = chooseAction(view, boundary.policy);
        if (decision.stop) { stage = decision.stop; reason = decision.reason; break; }
        assert(publicActionStillAvailable(view, decision.action), 'Selection must be an enabled exact public action');
        pending = { commandCount: boundary.commandCount + 1, intent: clone(decision.action.intent), decision,
          beforeStateSha256: boundary.finalStateSha256, publicBeforeSha256: stateHash(view), policyBeforeSha256: stateHash(boundary.policy), startedAt: new Date().toISOString() };
        saved = saveCheckpoint(checkpointPath, { ...boundary, pending }, saved.sha256);
      }
      const beforeView = project();
      assert(publicActionStillAvailable(beforeView, pending.decision.action), 'Exact pending public action is no longer available');
      assert.equal(stateHash(beforeView), pending.publicBeforeSha256);
      assert.deepEqual(chooseAction(beforeView, saved.payload.policy), pending.decision, 'Pending intent must remain the exact frozen public-policy choice');
      const before = saved.payload.state, started = performance.now(); let draft = null, next, after;
      if (session) {
        assert.equal(pending.intent.type, 'MOON');
        draft = session.prepare(pending.intent, before.revision); next = session.snapshotDraft(draft); after = capturePublic(session.projectDraft(draft));
      } else {
        next = runtime.applySliceIntent(before, pending.intent);
        if (next.moon.guidanceKnown) session = runtime.openMoonRuntimeSession(next);
        after = capturePublic(session ? session.project() : runtime.projectSliceState(next));
      }
      assert.equal(next.revision, before.revision + 1); checkOriginals(next, old.source, before);
      const policy = advancePolicy(pending.decision, after, beforeView);
      const row = { commandCount: pending.commandCount, intent: clone(pending.intent), commandSha256: compactHash(pending.intent),
        reason: pending.decision.reason, publicLabel: pending.decision.action.label, publicCost: pending.decision.action.cost,
        startedAt: pending.startedAt, elapsedMilliseconds: Math.round(performance.now() - started), revision: next.revision, week: next.week,
        beforeStateSha256: pending.beforeStateSha256, afterStateSha256: stateHash(next),
        publicBeforeSha256: pending.publicBeforeSha256, publicAfterSha256: stateHash(after), selectionOutcome: selectionOutcome(after),
        randomBefore: clone(before.random), randomAfter: clone(next.random), randomBeforeSha256: stateHash(before.random), randomAfterSha256: stateHash(next.random),
        policyBeforeSha256: pending.policyBeforeSha256, policyAfterSha256: stateHash(policy), receipts: actualReceipts(next, before) };
      const selected = selectedBoundary(pending.intent, after, saved.payload.boundaries), boundaries = [...saved.payload.boundaries];
      if (selected) {
        const file = `boundary-${pending.commandCount}-${selected}.json.gz`, path = join(options.out, file);
        const content = { commandCount: pending.commandCount, beforeLast: before, lastIntent: pending.intent, final: next, public: after,
          audit: { ...row, elapsedMilliseconds: null } };
        if (existsSync(path)) assert.deepEqual(readCapture(path), content, 'Existing selected boundary differs from exact resumed draft');
        else { durableCreate(path, gzipSync(JSON.stringify(content), { level: 6 })); syncDirectory(options.out); }
        boundaries.push({ file, kind: selected, commandCount: pending.commandCount, ...fileEvidence(path) });
      }
      saved = saveCheckpoint(checkpointPath, { ...saved.payload, state: next, finalStateSha256: row.afterStateSha256, publicStateSha256: row.publicAfterSha256,
        commandCount: pending.commandCount, commands: [...saved.payload.commands, pending.intent], rows: [...saved.payload.rows,row], boundaries, policy, pending: null }, saved.sha256);
      if (draft) session.commit(draft); count++;
      console.log(JSON.stringify({ completed: pending.commandCount, action: pending.decision.action.label, week: next.week, sequence: next.progression.sequence, milliseconds: row.elapsedMilliseconds }));
    }
    unchanged(stamps); assert.deepEqual(inspectFreeze(root), freeze, 'Frozen bytes changed during capture');
    verifyCheckpoint(saved.payload, freeze, initialHash); runtime.assertValidSliceState(saved.payload.state);
    if (saved.payload.state.moon.guidanceKnown) {
      const strict = runtime.openMoonRuntimeSession(saved.payload.state);
      assert.equal(stateHash(strict.snapshot()), saved.payload.finalStateSha256);
      assert.equal(stateHash(capturePublic(strict.project())), saved.payload.publicStateSha256);
    }
    const paused = stage === 'MANUAL_PAUSE', diagnostic = ['PUBLIC_ACTION_BLOCKED','PUBLIC_STABILITY_BINDING_BLOCKED','PUBLIC_NO_PROGRESS_DIAGNOSTIC'].includes(stage);
    if (!paused && !diagnostic && !saved.payload.terminal) saved = saveCheckpoint(checkpointPath, { ...saved.payload, terminal: { stage, reason } }, saved.sha256);
    const view = project();
    replaceDerived(join(options.out, 'commands.ndjson.gz'), gzipSync(saved.payload.rows.map(row => JSON.stringify(row)).join('\n') + (saved.payload.rows.length ? '\n' : ''), { level: 6 }));
    replaceDerived(join(options.out, 'boundaries.index.json'), JSON.stringify(saved.payload.boundaries));
    replaceDerived(join(options.out, 'natural.json.gz'), gzipSync(JSON.stringify({ provenance: { kind: 'EXACT_ORIGINAL_FAILED670_PUBLIC_MOON_CONTINUATION',
      source: SOURCE, sourceSha256: SOURCE_SHA256, rawOriginalEvidence: 'prefix-original670.json.gz', prefixCommandsSha256: PREFIX_SHA256,
      runtimeFreezeSha256: freeze.sha256, historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true,
      originalFirstFailureRetained: true, archived912Used: false, privateAudit: true, seedChanged: false, randomOverridden: false,
      selectedFromEnabledPublicActionsOnly: true, projectionScope: 'CURRENT_BEAUTY_MOON_AND_ORDINARY_PUBLIC_DASHBOARD' },
      creation: old.creation, seed: old.seed, prefixCount: PREFIX_COUNT, commands: [...old.commands,...saved.payload.commands],
      policy: POLICY, stage, reason, pendingIntent: saved.payload.pending?.intent ?? null, boundaries: saved.payload.boundaries, final: saved.payload.state }), { level: 6 }));
    replaceDerived(join(options.out, 'summary.json'), JSON.stringify({ stage, reason, commands: saved.payload.commandCount,
      originalCommands: PREFIX_COUNT, newCommands: saved.payload.commands.length, week: saved.payload.policy.week, paused, diagnostic,
      strictFinalValidation: true, checkpoint: 'checkpoint.json.gz', public: view }));
    console.log(JSON.stringify({ outputDir: options.out, stage, commands: saved.payload.commandCount, paused, diagnostic }));
    return { outputDir: options.out, stage, commands: saved.payload.commandCount, paused, diagnostic };
  } catch (error) {
    try { replaceDerived(join(options.out, 'error.json'), JSON.stringify({ stage: 'CAPTURE_INTERRUPTED', error: String(error),
      commandCount: saved?.payload.commandCount ?? null, resumeExactPendingRequired: true, at: new Date().toISOString() })); }
    catch { /* Retain the original error and every already durable boundary. */ }
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === SELF) await main();
