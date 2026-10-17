import assert from 'node:assert/strict';
import { appendFileSync, closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Install both scripts and finish all source
// and compiled-module changes, then explicitly freeze those bytes BEFORE any
// natural command. --inspect-freeze only reads files; it does not import or run
// the game. Supply its reviewed hash with --freeze-sha256 for a natural run.
// No seed, cursor, strategy, resource, outcome, fixture-copy or packaging options.
// --replay DIR verifies the same complete strategy without writing any files.
export const SOURCE = 'tests/fixtures/balancer-v01840/natural.json';
export const SOURCE_SHA = 'e9437ca076c8f9779f8586970308b03032d4b67a13b0588809966818bda264e1';
export const PREDECESSOR = 'tests/fixtures/recovery-v01620/natural.json';
export const PREDECESSOR_SHA = '3589c7d792bc5974dc79452a9d9f10ae68832da565e97ad88f06f61915f07942';
export const ORIGINAL_DEATH = 'tests/fixtures/chaos-hunter-v01600/natural.json';
export const ORIGINAL_DEATH_SHA = '8e65fcb081f33b5714534acf7d5e47227247ed90e8aa20d00861dc51f2e43588';
export const INHERITED_SHA = '8b4f95f4e200366222296f0c2e37bae1d9ea19ada82bf0f35fdb2f39ac4be841';
export const PREFIX_SHA = '9f0b9d4f125eceb5796712ee310730fbf90f2adbb55e0a79b88f2eb9149bc163';
export const PREFIX_COUNT = 594, INHERITED_COUNT = 483, DEATH_COUNT = 477, COMMON_COUNT = 474, SEED = 'arbiter-natural-v066';
export const CASES = ['paired-handover', 'measured-aftermath', 'withdrawn-boundary'];
export const ROOTS = ['arbiter', 'sheriff', 'interrogator', 'judge', 'punishmentKnight', 'imperativeMage', 'chaosHunter', 'balancer'];
export const NEW_IDS = ['justiciar.s1.battlefield-division', 'justiciar.s1.aftermath-control'];
export const STAGES = ['NATURAL594_PREFIX_PUBLIC_HAND_OF_ORDER_CONTINUATION', 'SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2', 'ACTUAL_FINITE_ENCOUNTER_UNRESOLVED', 'ACTUAL_TERMINAL_WITH_NATURAL594_HISTORY'];
export const STRATEGY = deepFreeze({
  source: 'EXACT594_FULL_LIVING_BALANCER_FINAL', sourceSeed: SEED, sourceCursor: 367,
  caseMethod: 'ABILITY', caseRoute: 'CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS',
  encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90,
  potionAttemptCap: 12, maxCommands: 3500, ordinaryPreparationCap: 600, caseCommandCap: 80,
  sourceInjuryRecovery: 'CHECK_ACTUAL_CARE_KNOWN_THEN_REAL_REST_PAY60_AND_REST_UNTIL_ORIGINAL_WOUNDS_CLEAR_AND_HEALTH100', sourceRecoveryRestCap: 16,
  ordinaryActions: 'WORK_ONCE_PER_WEEK_THEN_REST_EXCEPT_SOURCE_WOUND_RECOVERY_REST', recovery: { health: 100, mind: 100, spirituality: 120, pollution: 0 },
  caseReadiness: { ap: 3, mind: 8, spirituality: 8 }, encounterReadiness: { ap: 2, cash: 30, mind: 3 },
  annexReadiness: { ap: 1, cash: 40 },
  afterCases: 'NO_OPTIONAL_MAXIMUM_RECOVERY_STOP_AFTER_ACTUAL_LIVING_EXIT_AND_DUE_SETTLEMENT',
  guardPlate: 'SOLE_LIVE_CONTINUATION_OF_ORIGINAL_BA2_GUARD_PLATE_INTEGRITY65_NO_RESTORE',
  eventChoices: { ORIGIN: '.decline', 'LIFE-BILL-01': 'PAY_PART', 'DEBT-NOTICE-01': 'DECLINE', 'DEBT-SETTLE-01': 'DEFER', 'LIFE-CARE-01': 'PAY', 'CARE-WORK-OFFER': 'DECLINE' },
});

export const json = path => JSON.parse(readFileSync(path, 'utf8'));
export const compactHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const stateHash = value => createHash('sha256').update(stable(value)).digest('hex');
function deepFreeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
export function fileEvidence(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024); let bytes = 0;
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); if (!n) break; bytes += n; hash.update(buffer.subarray(0, n)); } }
  finally { closeSync(fd); }
  assert.equal(bytes, lstatSync(path).size, `File changed while read: ${path}`);
  return { bytes, sha256: hash.digest('hex') };
}
export const fileHash = path => fileEvidence(path).sha256;
export function inspectFreeze() {
  const files = [];
  const walk = path => {
    const stat = lstatSync(path); assert(!stat.isSymbolicLink(), `Frozen inputs cannot be symlinks: ${path}`);
    if (stat.isDirectory()) { for (const name of readdirSync(path).sort()) walk(join(path, name)); }
    else if (stat.isFile()) files.push({ file: path.split(sep).join('/'), ...fileEvidence(path) });
  };
  // Include original mechanics, central migration/validation, the renderer, and
  // all compiled domain dependencies. A source-only change also breaks freeze.
  for (const path of ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation', 'scripts/play/hand-of-order-stage.mjs', 'scripts/play/hand-of-order-save.mjs']) walk(path);
  assert(existsSync('dist/domain/hand-of-order/index.js'), 'Coordinator must compile the final module before freeze');
  return { sha256: compactHash(files), files };
}
export async function loadRuntime({ sqlite = false } = {}) {
  const names = ['domain/slice/index', 'domain/slice/migration', 'domain/slice/validation', 'domain/hand-of-order/index', 'domain/hand-of-order/life', 'domain/hand-of-order/encounter', 'domain/hand-of-order/combat', 'domain/balancer/combat', 'domain/slice/weekly-finance', 'domain/game-calendar'];
  if (sqlite) names.push('persistence/slice-store');
  return Object.assign({}, ...await Promise.all(names.map(name => import(pathToFileURL(resolve(`dist/${name}.js`)).href))));
}
export function migrateCurrent(runtime, raw) {
  const state = runtime.migrateSliceState(raw);
  assert.equal(state.schemaVersion, 203, 'Use the explicit current-schema migration');
  assert.equal(state.contentVersion, 'hand-of-order-v203');
  for (const key of ['runId', 'revision', 'status', 'character', 'week', 'date', 'actionsRemaining', 'weeklyBudget', 'wagePaidWeek', 'cash', 'lifeTier', 'nextLifeTier', 'health', 'mind', 'spirituality', 'injuries', 'injuryRisk', 'debts', 'missedWeeks', 'credit', 'random', 'progression']) {
    if (Object.hasOwn(raw, key)) assert.deepEqual(state[key], raw[key], `Schema migration does not alter actual ${key}`);
  }
  runtime.assertValidSliceState(state); return state;
}
export function readSource() {
  assert.equal(fileHash(SOURCE), SOURCE_SHA); assert.equal(fileHash(PREDECESSOR), PREDECESSOR_SHA); assert.equal(fileHash(ORIGINAL_DEATH), ORIGINAL_DEATH_SHA);
  const old = Object.fromEntries(['provenance', 'creation', 'seed', 'initial', 'commands', 'prefixCount', 'prefixFinal', 'final'].map(k => [k, readObjectEntry(SOURCE, k)]));
  const recovery = Object.fromEntries(['provenance', 'creation', 'seed', 'initial', 'commands', 'final'].map(k => [k, readObjectEntry(PREDECESSOR, k)]));
  const death = Object.fromEntries(['creation', 'seed', 'initial', 'commands', 'final'].map(k => [k, readObjectEntry(ORIGINAL_DEATH, k)]));
  assert.equal(old.commands.length, PREFIX_COUNT); assert.equal(compactHash(old.commands), PREFIX_SHA);
  assert.equal(old.prefixCount, INHERITED_COUNT); assert.equal(old.seed, SEED);
  assert.deepEqual(old.provenance, { kind: 'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION', source: PREDECESSOR, sourceSha256: PREDECESSOR_SHA, newRandomChanges: false });
  assert.equal(recovery.commands.length, INHERITED_COUNT); assert.equal(compactHash(recovery.commands), INHERITED_SHA); assert.deepEqual(old.commands.slice(0, INHERITED_COUNT), recovery.commands);
  assert.equal(death.commands.length, DEATH_COUNT); assert.equal(death.final.status, 'DEAD'); assert.equal(death.final.health, 0); assert.equal(death.final.revision, 478); assert.deepEqual(death.final.random, { seed: SEED, cursor: 290 });
  assert.equal(recovery.provenance.originalDeathPreserved, true); assert.equal(recovery.provenance.prefixCommands, COMMON_COUNT); assert.equal(recovery.provenance.randomEdits, false); assert.equal(recovery.provenance.freeHealing, false);
  assert.deepEqual(recovery.commands.slice(0, COMMON_COUNT), death.commands.slice(0, COMMON_COUNT)); assert.notDeepEqual(recovery.commands[COMMON_COUNT], death.commands[COMMON_COUNT]);
  assert.deepEqual(recovery.creation, old.creation); assert.deepEqual(death.creation, old.creation); assert.equal(recovery.seed, SEED); assert.equal(death.seed, SEED);
  for (const raw of [old.initial, old.final]) { assert.equal(raw.schemaVersion, 181); assert.equal(raw.contentVersion, 'balancer-v181'); }
  for (const raw of [recovery.initial, recovery.final]) { assert.equal(raw.schemaVersion, 159); assert.equal(raw.contentVersion, 'coffin-bearer-v159'); }
  for (const raw of [death.initial, death.final]) { assert.equal(raw.schemaVersion, 158); assert.equal(raw.contentVersion, 'chaos-hunter-v158'); }
  const f = old.final; assert.equal(old.initial.progression.sequence, null); assert.equal(f.status, 'ACTIVE');
  assert.equal(f.runId, 'arbiter-rebuild-natural'); assert.equal(f.revision, 595); assert.equal(f.week, 135);
  assert.deepEqual(f.date, { epoch: 'FIFTH_EPOCH', year: 1352, month: 1, day: 22 });
  assert.deepEqual([f.health, f.mind, f.spirituality, f.cash, f.actionsRemaining], [60, 96, 120, 690, 3]);
  assert.deepEqual(f.random, { seed: SEED, cursor: 367 }); assert.equal(f.balancer.promotionWeek, 126); assert.equal(f.progression.promotionWeek, 9);
  assert.equal(f.progression.sequence, 2); assert.equal(f.progression.acting, 100); assert.deepEqual(f.character.coreStats, { physique: 30, perception: 25, will: 25, knowledge: 21 });
  assert.equal(f.character.name, '艾洛'); assert.equal(f.character.gender, 'FEMALE'); assert.equal(f.character.age, 26); assert.equal(f.character.weeklyWage, 180);
  assert.equal(Object.keys(f.progression.mastery).length, 17); assert.equal(Object.values(f.progression.mastery).filter(n => n === 0).length, 6);
  assert.equal(f.progression.mastery['justiciar.s2.imbalance-sensing'], 8); assert.equal(f.progression.mastery['justiciar.s2.measured-resistance'], 0);
  assert.deepEqual(f.injuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision]), [['LIGHT', 590, null], ['HEAVY', 593, null]]); assert.equal(f.injuryRisk, 1); assert.equal(f.careKnown, true); assert.equal(f.seer.pollution, 0);
  const site = f.chaosHunter.life;
  assert.equal(site.clockSeconds, 767); assert.equal(site.playerTravelMetres, 124); assert.equal(site.guideTravelMetres, 92); assert.equal(site.playerLocation, 'START');
  assert.equal(site.guide.name, '薇娜·贝尔'); assert.equal(site.guide.location, 'OUTSIDE'); assert.equal(site.volunteer.location, 'OUTSIDE'); assert.equal(site.volunteer.age, 43);
  assert.deepEqual([site.volunteer.health, site.volunteer.mind, site.volunteer.alive, site.volunteer.willing], [100, 100, true, false]); assert(!Object.hasOwn(site.volunteer, 'energy'));
  for (const object of [site.parcel, site.line, site.paper]) { assert.equal(object.owner, 'GUIDE'); assert.equal(object.holder, 'GUIDE'); assert.equal(object.location, 'OUTSIDE'); assert.equal(object.quantity, 1); }
  assert.equal(site.parcel.massGrams, 350); assert.equal(site.paper.text, '本次从A到B的越线'); assert.equal(site.table.id, 'CH3-TABLE-B'); assert.equal(site.table.location, 'B');
  assert.deepEqual(f.balancer.life.operation, { door: 'OPEN', truth: null, effect: null });
  assert.deepEqual(f.balancer.life.guardPlate, { id: 'BA2-GUARD-PLATE', owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 65, acquiredWeek: 126 });
  const caspar = f.balancer.encounter; assert.equal(caspar.status, 'RETREATED'); assert.equal(caspar.enemyStatus, 'RESISTING'); assert.equal(caspar.enemyPosition, 'BETWEEN_A_AND_B'); assert.equal(caspar.weaponLocation, 'HAND');
  assert.deepEqual([caspar.enemyHealth, caspar.enemyMind, caspar.enemySpirituality], [90, 100, 67]); assert.equal(caspar.enemyInjuries[0].severity, 'LIGHT');
  assert.equal(f.chaosHunter.encounter.enemyStatus, 'SURRENDERED');
  return { ...old, recovery, death };
}
export const originalResources = s => ({ site: s.chaosHunter.life, operation: s.balancer.life.operation, guardPlate: s.balancer.life.guardPlate });
export const currentSite = s => s.handOfOrder.life.site ?? s.chaosHunter.life;
export const currentPlate = s => s.handOfOrder.life.guardPlate ?? s.balancer.life.guardPlate;
export const currentResources = s => { const operation = s.handOfOrder.life.source ? s.handOfOrder.life.operation : s.balancer.life.operation; return { site: currentSite(s), operation: { door: operation.door, truth: operation.truth, effect: operation.effect }, guardPlate: currentPlate(s) }; };
export const body = s => ({ status: s.status, revision: s.revision, week: s.week, date: s.date, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining,
  pollution: s.seer.pollution, injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, sequence: s.progression.sequence, acting: s.progression.acting, mastery: s.progression.mastery,
  finance: { weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit, pulse: s.pulse, billAmount: s.billAmount } });
export function compact(s) {
  const life = s.handOfOrder.life, e = s.handOfOrder.encounter;
  return { ...body(s), activeEvent: s.activeEvent?.instanceId ?? null, current: currentResources(s),
    life: { activeCase: life.activeCase, operation: life.operation, annex: life.annex, currentAttempt: life.activeCase ? life.cases[life.activeCase].attempts[0] ?? null : null },
    encounter: { status: e.status, policy: e.policy, supportPieces: e.supportPieces, enemyCharges: e.enemyCharges, division: e.division, aftermath: e.aftermath,
      divisionApplications: e.divisionApplications, aftermathApplications: e.aftermathApplications, terminal: e.terminal } };
}
export function checkOriginals(runtime, s, original) {
  for (const key of ROOTS) assert.deepEqual(s[key], original[key], `Immutable original ${key} history`);
  assert.deepEqual(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  assert.deepEqual(s.seer.completedSources.slice(0, original.seer.completedSources.length), original.seer.completedSources);
  const old = originalResources(original), now = currentResources(s), l = s.handOfOrder.life;
  if (s.handOfOrder.guidanceKnown) {
    assert.deepEqual(s.handOfOrder.sourceHistory, Object.fromEntries(ROOTS.map(k => [k, original[k]])));
    assert.deepEqual(s.handOfOrder.sourceScene.originals, old); assert(runtime.validateHandOfOrderSource(s));
  }
  if (s.handOfOrder.promotionWeek === null) assert.deepEqual(l, runtime.createHandOfOrderLifeState());
  else { assert.equal(l.source.promotionWeek, s.handOfOrder.promotionWeek); assert.deepEqual(l.source.originals, old); }
  assert(runtime.validateHandOfOrderLifeState(s)); assert(runtime.validateHandOfOrderEncounterState(s));
  assert.deepEqual(now.operation, old.operation, 'The original door, truth and effect remain exact');
  assert.equal(Object.hasOwn(now.site, 'playerEnergy'), false); assert.equal(Object.hasOwn(now.site.volunteer, 'energy'), false);
  const attempts = CASES.flatMap(id => l.cases[id].attempts), mindSpent = attempts.reduce((n, a) => n + a.volunteerMindSpent, 0);
  assert.equal(l.annex.effortSpent, attempts.reduce((n, a) => n + a.effortSpent, 0)); assert(l.annex.effortSpent <= 9);
  assert.equal(now.site.volunteer.mind, old.site.volunteer.mind - mindSpent); assert.equal(now.site.volunteer.health, old.site.volunteer.health); assert.equal(now.site.volunteer.alive, true);
  assert.deepEqual(now.site.cases, old.site.cases); assert.deepEqual(now.site.table, old.site.table); assert.equal(now.site.paper.text, old.site.paper.text);
  for (const key of ['parcel', 'line', 'paper']) for (const field of ['id', 'owner', 'quantity']) assert.equal(now.site[key][field], old.site[key][field]);
  assert.equal(now.site.parcel.massGrams, 350); assert(now.site.clockSeconds >= old.site.clockSeconds); assert(now.site.playerTravelMetres >= old.site.playerTravelMetres);
  const mastery = { ...original.progression.mastery };
  if (s.progression.sequence === 1) { for (const id of NEW_IDS) mastery[id] = 0; for (const id of CASES) if (l.cases[id].status === 'RESOLVED') for (const a of l.cases[id].attempts) for (const ability of a.appliedAbilityIds) mastery[ability] = Math.min(500, mastery[ability] + 8); }
  let integrity = old.guardPlate.integrity - attempts.reduce((n, a) => n + (a.impact?.plateWear ?? 0), 0);
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const o = round.handOfOrderOutcome; assert(o); assert.equal(o.source.policy, STRATEGY.encounterPolicy); assert.equal(o.source.targetId, 'HO1-BRAM');
    assert.equal(o.source.guardPlate.integrity, integrity, 'One continuing original guard plate, never reused frozen stock');
    for (const a of [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order)) {
      assert.equal(a.guardPlateBefore.integrity, integrity); integrity -= a.plateWear; assert.equal(a.guardPlateAfter.integrity, integrity);
      for (const id of a.masteryApplied) { assert(Object.hasOwn(mastery, id)); mastery[id] = Math.min(500, mastery[id] + 8); }
    }
    assert.equal(o.guardPlateAfter.integrity, integrity);
  }
  assert.equal(now.guardPlate.integrity, integrity); for (const key of ['id', 'owner', 'holder', 'acquiredWeek']) assert.equal(now.guardPlate[key], old.guardPlate[key]);
  assert.equal(now.guardPlate.location, now.site.playerLocation); assert.deepEqual(s.progression.mastery, mastery, 'Only honest reports and actual applications grant mastery');
  const { coreStats, ...identity } = s.character, { coreStats: priorStats, ...priorIdentity } = original.character;
  assert.deepEqual(identity, priorIdentity); for (const [k, v] of Object.entries(priorStats)) assert.equal(coreStats[k], Math.min(500, v + (s.progression.sequence === 1 ? 1 : 0)));
  assert.equal(s.progression.promotionWeek, original.progression.promotionWeek); assert.equal(s.random.seed, SEED); assert.equal(s.runId, original.runId);
}
export function publicControl(runtime, s, intent) {
  assert(runtime.validateSlicePayload(intent), `Strict public payload: ${JSON.stringify(intent)}`);
  const p = runtime.projectSliceState(s);
  if (intent.type === 'CONTINUE_LIFE') {
    assert.equal(s.status, 'SLICE_COMPLETE'); assert(s.ending && s.ending.kind !== 'DEATH' && s.caseArchive.length === 0);
    return { kind: 'CONTINUE_LIFE', status: p.status, enabled: true };
  }
  assert.equal(s.status, 'ACTIVE', 'A sealed death never continues');
  if (intent.type === 'HAND_OF_ORDER') {
    const a = p.handOfOrder.actions.find(x => isDeepStrictEqual(x.command, intent.command)); assert(a, `Missing public control ${JSON.stringify(intent.command)}`); assert(a.enabled, a.reason);
    const l = p.handOfOrder.life.actions.find(x => isDeepStrictEqual(x.command, intent.command));
    if (l) {
      const nextCase = CASES.find(id => s.handOfOrder.life.cases[id].status !== 'RESOLVED');
      if ('caseId' in intent.command) assert.equal(intent.command.caseId, nextCase);
      if ('caseId' in intent.command && !['OBSERVE', 'REPORT'].includes(intent.command.type)) assert.equal(l.preferredAction, true, 'Use the actual recommended case route');
      if (['EXIT_ORIGINAL', 'RENT_ANNEX'].includes(intent.command.type)) assert.equal(l.id, p.handOfOrder.life.preferredActionId, 'Use the actual public entry step');
      if (intent.command.type === 'PREPARE') assert.equal(intent.command.method, STRATEGY.caseMethod);
    }
    if (intent.command.type === 'SET_COMBAT_POLICY') assert.equal(intent.command.policy, STRATEGY.encounterPolicy);
    if (intent.command.type === 'ENCOUNTER_FIGHT') assert.equal(s.handOfOrder.encounter.policy, STRATEGY.encounterPolicy);
    return structuredClone(a);
  }
  if (intent.type === 'ACTION') { assert(['WORK', 'REST', 'INVESTIGATE'].includes(intent.action)); if (intent.action === 'INVESTIGATE') { assert.equal(intent.targetId, 'CARE-ACCESS-01'); assert.equal(s.careKnown, false); assert(p.investigateTargets.some(t => t.id === intent.targetId)); } assert(p.canAct, p.actionBlockedReason); assert(!p.handOfOrder.insideCase && !s.combat && s.handOfOrder.preparedWeek === null); return { kind: 'ACTION', action: intent.action, enabled: true }; }
  if (intent.type === 'EVENT_CHOICE') {
    assert.equal(s.activeEvent?.instanceId, intent.eventInstanceId); const a = p.activeEvent?.choices.find(x => x.id === intent.choiceId); assert(a?.enabled);
    assert.equal(intent.choiceId, STRATEGY.eventChoices[p.activeEvent.id.startsWith('ORIGIN') ? 'ORIGIN' : p.activeEvent.id]); return structuredClone(a);
  }
  assert.equal(intent.type, 'COMBAT_ROUND'); assert.equal(intent.stance, STRATEGY.combatStance); assert.equal(Object.hasOwn(intent, 'winnerPolicy'), false, 'This pathway has no winner-policy payload');
  assert.equal(s.handOfOrder.encounter.policy, STRATEGY.encounterPolicy); assert(p.combat?.stances.some(x => x.id === intent.stance));
  assert.equal(s.combat.encounterId, 'HAND_OF_ORDER_DISPUTE');
  assert.deepEqual(p.combat.playerCountWheel, runtime.HAND_OF_ORDER_COUNT_WHEEL);
  assert.deepEqual(p.combat.enemyCountWheel, runtime.HAND_OF_ORDER_ENEMY_COUNT_WHEEL);
  assert.deepEqual(p.combat.playerCountWheel.map(w => [w.id, w.weight]), [['1', 10], ['2', 15], ['3', 25], ['4', 25], ['5', 15], ['6', 10]]);
  assert.deepEqual(p.combat.playerAbilityWheel, runtime.handOfOrderAbilityWheel(s, null));
  assert.deepEqual(p.combat.playerAbilityWheels[intent.stance], runtime.handOfOrderAbilityWheel(s, intent.stance));
  assert.deepEqual(p.combat.enemyAbilityWheel, runtime.HAND_OF_ORDER_ENEMY_ABILITY_WHEEL);
  const baseWeights = [30, 15, 25, 10, 15, 5, 20, 20];
  assert.deepEqual(p.combat.playerAbilityWheel.map(w => w.id), ['justiciar.s9.combat-training', 'justiciar.s5.wound-verdict', 'justiciar.s2.measured-resistance', 'justiciar.s2.imbalance-sensing', 'justiciar.s4.deprivation', 'ACCIDENT', ...NEW_IDS]);
  assert.deepEqual(p.combat.playerAbilityWheel.map(w => w.weight), baseWeights.map(w => w * 4 / 560 * 100));
  const source = runtime.currentHandOfOrderCombatSource(s); assert(source); assert.equal(source.maxActionCount, 6); assert.equal(source.targetId, 'HO1-BRAM'); assert.deepEqual(source.guardPlate, currentPlate(s));
  const inherited = runtime.balancerAbilityWheel(s, null); assert.deepEqual(inherited.map(a => a.id), p.combat.playerAbilityWheel.slice(0, 6).map(a => a.id)); for (let i = 0; i < 6; i++) assert(Math.abs(inherited[i].weight - p.combat.playerAbilityWheel[i].weight * 140 / 100) < 1e-10, 'Keep actual Balancer base weights');
  return { kind: 'COMBAT_ROUND', stance: intent.stance, round: s.combat.round, playerCountWheel: p.combat.playerCountWheel, enemyCountWheel: p.combat.enemyCountWheel,
    baseAbilityWheel: p.combat.playerAbilityWheel, actualStanceAbilityWheel: p.combat.playerAbilityWheels[intent.stance], enemyAbilityWheel: p.combat.enemyAbilityWheel };

}
export function lifeAbilityUse(s) {
  const l = s.handOfOrder.life;
  return Object.fromEntries(NEW_IDS.map((id, i) => {
    const ids = CASES.filter(key => i === 1 ? key === 'measured-aftermath' : key !== 'measured-aftermath');
    const attempts = ids.flatMap(key => l.cases[key].attempts), tier = a => i === 0 ? a.divisionTier : a.aftermathTier;
    return [id, { paidAttempts: attempts.filter(a => tier(a) !== null).length, castingSuccesses: attempts.filter(a => ['SUCCESS', 'GREAT_SUCCESS'].includes(tier(a))).length,
      actualApplications: attempts.filter(a => a.appliedAbilityIds.includes(id)).length,
      reportedApplications: ids.filter(key => l.cases[key].status === 'RESOLVED').flatMap(key => l.cases[key].attempts).filter(a => a.appliedAbilityIds.includes(id)).length,
      spiritualitySpent: attempts.reduce((n, a) => n + a.spiritualitySpent, 0), mindSpent: attempts.reduce((n, a) => n + a.mindSpent, 0) }];
  }));
}
export function combatAbilityUse(rounds) {
  const actions = rounds.flatMap(r => [...r.handOfOrderOutcome.playerActions, ...r.handOfOrderOutcome.enemyActions]);
  return Object.fromEntries(NEW_IDS.map((id, i) => { const selected = actions.filter(a => a.actor === 'PLAYER' && a.id === id), kind = i === 0 ? 'DIVISION' : 'AFTERMATH';
    return [id, { selectedSlots: selected.length, paidAttempts: selected.filter(a => a.paidCost > 0).length, castingSuccesses: selected.filter(a => ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check?.tier)).length, unresistedSuccesses: selected.filter(a => a.succeeded).length,
      resistedAttempts: selected.filter(a => a.resisted).length, preparedWindows: selected.filter(a => a.windowGranted?.kind === kind).length,
      actualApplications: actions.flatMap(a => a.windowsApplied).filter(w => w.kind === kind).length,
      contributionChange: actions.flatMap(a => a.windowsApplied).filter(w => w.kind === kind).reduce((n, w) => n + w.amount, 0),
      masteryApplications: actions.filter(a => a.masteryApplied.includes(id)).length, spiritualitySpent: selected.reduce((n, a) => n + a.paidCost, 0), mindSpent: selected.reduce((n, a) => n + a.mindCost, 0), supportWearPaid: selected.reduce((n, a) => n + a.supportWearPaid, 0) }]; }));
}
// Derive every alias from the actual observed transition, including failures.
export function boundaryAliases(before, intent, after) {
  const names = [], c = intent.type === 'HAND_OF_ORDER' ? intent.command : null;
  if (before.week !== after.week) names.push('actual-week-finance-settlement');
  if (before.actionsRemaining === 0) names.push('actual-zero-ap-command');
  if (after.status === 'SLICE_COMPLETE') names.push('living-slice-complete');
  if (intent.type === 'CONTINUE_LIFE') names.push('real-living-continue-life');
  if (after.status === 'DEAD') names.push('actual-sealed-player-death');
  if (intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01' && intent.choiceId === 'PAY') names.push('actual-clinic-pay60-same-heavy-wound');
  if (intent.type === 'ACTION' && intent.action === 'REST' && before.injuries.length > after.injuries.length) names.push('actual-rest-removes-treated-original-wounds');
  if (c?.type === 'CONSUME') names.push(after.progression.sequence === 1 ? 'promotion' : 'actual-potion-failure');
  if (c?.type === 'EXIT_ORIGINAL') names.push('actual-four-metre-original-room-exit');
  if (c?.type === 'RENT_ANNEX') names.push('actual-paid-annex-placed');
  if (c && 'caseId' in c) {
    const id = c.caseId, l = after.handOfOrder.life, a = l.cases[id].attempts[0];
    if (c.type === 'BATTLEFIELD_DIVISION') names.push(`${id}-division-${l.operation.division ? 'actual-window' : 'actual-failed-window'}`);
    if (c.type === 'AFTERMATH_CONTROL') names.push(`${id}-aftermath-${l.operation.aftermath ? 'actual-window' : 'actual-failed-window'}`);
    if (c.type === 'ATTEMPT_HANDOVER') names.push(`${id}-actual-crossing-${a.divisionOutcome.toLowerCase()}`);
    if (c.type === 'COMPLETE_HANDOVER') names.push(`${id}-actual-ordinary-handover`);
    if (['APPLY_IMPACT', 'ORDINARY_BRACE', 'CANCEL_IMPULSE'].includes(c.type)) names.push(`${id}-actual-impulse-${a.impact.aftermathApplied ? 'ability-applied' : a.impact.mode.toLowerCase()}`);
    if (c.type === 'WITHDRAW_PERMISSION') names.push(`${id}-fresh-permission-withdrawn-before-pending-action`);
    if (c.type === 'LEAVE') names.push(`${id}-ordinary-closure-${a.result.toLowerCase()}`);
    if (before.handOfOrder.life.annex.supportPieces > l.annex.supportPieces) names.push(`${id}-actual-paid-piece-consumption`);
  }
  if (intent.type === 'COMBAT_ROUND') {
    const o = after.combatHistory.at(-1)?.handOfOrderOutcome; assert(o); const actions = [...o.playerActions, ...o.enemyActions];
    if (actions.some(a => a.windowsApplied.some(w => w.kind === 'DIVISION'))) names.push('combat-actual-battlefield-division');
    if (actions.some(a => a.windowsApplied.some(w => w.kind === 'AFTERMATH'))) names.push('combat-actual-aftermath-control');
    if (currentPlate(after).integrity < currentPlate(before).integrity) names.push('combat-actual-original-guard-plate-wear');
    if (!after.combat && after.status !== 'DEAD') names.push('actual-ordinary-encounter-exit');
  }
  return names;
}

class ActualTerminalStop extends Error {}
class FiniteEncounterStop extends Error {}
export async function runNatural(options) {
  const frozen = inspectFreeze(); assert.equal(frozen.sha256, options.freezeSha256, 'Coordinator freeze mismatch; do not start gameplay');
  const runtime = await loadRuntime(), old = readSource(), originalExpected = migrateCurrent(runtime, old.final);
  const producerSha256 = fileHash(fileURLToPath(import.meta.url)), replayOnly = !!options.replay;
  if (!replayOnly) mkdirSync('output/play', { recursive: true });
  const outputDir = replayOnly ? realpathSync(options.replay) : mkdtempSync('output/play/hand-of-order-02060-');
  if (replayOnly) { const i = json(join(outputDir, 'capture-integrity.json')); assert.equal(i.producerSha256, producerSha256); assert.equal(i.freezeSha256, frozen.sha256); }
  const replayRows = replayOnly ? new Map(['commands.jsonl', 'public.jsonl'].map(name => [name, readJsonLines(join(outputDir, name))])) : null;
  const write = (name, value) => { if (replayOnly) assert.equal(fileHash(join(outputDir, name)), compactHash(value), `Capture-free replay differs: ${name}`); else writeFileSync(join(outputDir, name), JSON.stringify(value), { flag: 'wx' }); };
  const append = (name, value) => { if (replayOnly) { const row = replayRows.get(name).next(); assert.equal(row.done, false); assert.deepEqual(row.value, value, `${name}:${value.step}`); } else appendFileSync(join(outputDir, name), `${JSON.stringify(value)}\n`); };
  if (!replayOnly) for (const name of ['commands.jsonl', 'public.jsonl']) writeFileSync(join(outputDir, name), '', { flag: 'wx' });
  const commands = [], boundaries = {}, boundarySteps = {}, transitions = [], snapshots = {}, treatments = [], captured = new Map(), snapshotSteps = new Map();
  let s = runtime.createSliceRun(old.final.runId, old.creation, old.seed), original = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false, saved = false, failurePhase = 'INITIALIZATION';
  const initial = structuredClone(s), view = () => runtime.projectSliceState(s).handOfOrder;
  const unusedName = key => { let name = key, number = 2; while (Object.hasOwn(boundaries, name)) name = `${key}-${number++}`; return name; };
  function capture(key) {
    if (!prefixVerified) return; const name = unusedName(key);
    let file = captured.get(commands.length);
    if (!file) { file = `boundary-${name}.json`; write(file, { commandCount: commands.length, beforeLast, lastIntent, final: s }); captured.set(commands.length, file); transitions.push({ key: name, file, commandIndex: commands.length, beforeRevision: beforeLast.revision, afterRevision: s.revision }); }
    boundaries[name] = file; boundarySteps[name] = commands.length;
  }
  function snapshot(name) { assert(!snapshots[name]); let file = snapshotSteps.get(commands.length); if (!file) { file = `snapshot-${name}.json`; write(file, s); snapshotSteps.set(commands.length, file); } snapshots[name] = file; }
  function go(intent, key = null) {
    pendingIntent = structuredClone(intent); failurePhase = 'PUBLIC_PREFLIGHT'; assert(commands.length < STRATEGY.maxCommands); assert(runtime.validateSlicePayload(intent));
    const control = prefixVerified ? publicControl(runtime, s, intent) : { kind: 'IMMUTABLE594_SOURCE_PREFIX', enabled: true };
    const prior = s, beforePublic = prefixVerified ? compact(s) : null; beforeLast = s; lastIntent = structuredClone(intent); failurePhase = 'APPLY';
    s = runtime.applySliceIntent(s, intent); commands.push(structuredClone(intent)); pendingIntent = null; failurePhase = 'AFTER_APPLY_VALIDATION';
    const boundaryKey = prefixVerified ? unusedName(key ?? `step-${commands.length}-${intent.type === 'HAND_OF_ORDER' ? intent.command.type.toLowerCase() : intent.type.toLowerCase()}`) : null;
    append('commands.jsonl', { step: commands.length, intent, sourcePrefix: commands.length <= PREFIX_COUNT, boundaryKey, before: body(prior), after: body(s) });
    if (prefixVerified) append('public.jsonl', { step: commands.length, revision: prior.revision, command: intent, control, randomBefore: prior.random, randomAfter: s.random, before: beforePublic, after: compact(s) });
    runtime.assertValidSliceState(s); assert.equal(s.revision, prior.revision + 1); assert.equal(s.random.seed, SEED); assert(s.random.cursor >= prior.random.cursor);
    if (prefixVerified) { checkOriginals(runtime, s, original); capture(boundaryKey); for (const name of boundaryAliases(prior, intent, s)) capture(name); }
    failurePhase = 'IDLE'; if (prefixVerified && s.status === 'DEAD') throw new ActualTerminalStop('Actual player death; no continuation, rescue, reroll or state patch');
  }
  const ms = (command, key = null) => go({ type: 'HAND_OF_ORDER', command }, key);
  function clear() {
    for (let count = 0; (s.activeEvent || s.status === 'SLICE_COMPLETE') && count < 30; count++) {
      if (s.status === 'SLICE_COMPLETE') { go({ type: 'CONTINUE_LIFE' }, 'living-slice-real-continue'); continue; }
      const e = runtime.projectSliceState(s).activeEvent, choiceId = STRATEGY.eventChoices[e.id.startsWith('ORIGIN') ? 'ORIGIN' : e.id]; assert(choiceId, `Unplanned actual event: ${e.id}`);
      const prior = e.id === 'LIFE-CARE-01' ? structuredClone(body(s)) : null;
      go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId }, `actual-event-${e.id.toLowerCase()}`);
      if (prior) { assert(s.cash <= prior.cash - 60); assert.equal(s.health, prior.H); assert.equal(s.injuryRisk, prior.injuryRisk);
        for (const injury of prior.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) { const same = s.injuries.find(i => i.id === injury.id); assert(same); assert.equal(same.acquiredRevision, injury.acquiredRevision); assert.equal(same.treatedRevision, prior.revision + 1); }
        treatments.push({ paidPennies: 60, before: prior, after: structuredClone(body(s)) }); }
    }
    assert.equal(s.status, 'ACTIVE'); assert.equal(s.activeEvent, null); assert.equal(s.pulse, 'NONE');
  }
  function ordinary(forceRest = false) { clear(); assert(!view().insideCase && !s.combat && s.handOfOrder.preparedWeek === null); go({ type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week ? 'REST' : 'WORK' }); clear(); }
  function ready({ ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
    clear(); assert(!view().insideCase && !s.combat && s.handOfOrder.preparedWeek === null); assert(ap <= s.weeklyBudget);
    for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek; n++) { assert(n < STRATEGY.ordinaryPreparationCap, 'Finite real work/rest readiness limit'); ordinary(); }
  }
  function action(command, key = null) { ready(); ms(command, key); clear(); }
  function practice(caseId) {
    ready(STRATEGY.caseReadiness); const before = structuredClone(currentSite(s)); ms({ type: 'OBSERVE', caseId }, `${caseId}-observe-originals-and-new-annex`);
    for (let n = 0; s.handOfOrder.life.cases[caseId].status !== 'EXAMINED'; n++) {
      assert(n < STRATEGY.caseCommandCap, 'Finite preferred-case route exhausted');
      const l = view().life, next = l.actions.find(a => a.id === l.preferredActionId && a.preferredAction && a.enabled);
      assert(next, `No enabled public preferred step: ${l.nextStep}`); assert.equal(next.command.caseId, caseId);
      const suffix = 'permission' in next.command ? `-${next.command.permission.toLowerCase()}` : '';
      ms(next.command, `${caseId}-${next.command.type.toLowerCase()}${suffix}`);
    }
    clear(); const l = s.handOfOrder.life, a = l.cases[caseId].attempts[0];
    assert.equal(l.cases[caseId].attempts.length, 1); assert(a.closed && a.inspected && a.objectsReturned && a.resultRead && a.objectRetrieved);
    assert.equal(currentSite(s).playerLocation, 'OUTSIDE'); assert(currentSite(s).playerTravelMetres > before.playerTravelMetres);
    for (const object of [currentSite(s).parcel, currentSite(s).line, currentSite(s).paper]) { assert.equal(object.location, 'OUTSIDE'); assert.equal(object.holder, 'GUIDE'); }
    assert.equal(a.effortSpent, 3); assert.equal(a.volunteerMindSpent, 1);
    if (caseId === 'withdrawn-boundary') { assert(a.permissionWithdrawn); assert.equal(a.appliedAbilityIds.length, 0); assert.equal(a.result, 'ORDINARY'); }
    action({ type: 'REPORT', caseId }, `${caseId}-honest-report`); assert.equal(s.handOfOrder.life.cases[caseId].status, 'RESOLVED');
  }

  function consume(bottleId) {
    const prior = structuredClone(body(s)), resources = structuredClone(currentResources(s));
    ms({ type: 'CONSUME', bottleId, confirmed: true }, `consume-${bottleId}`);
    const b = s.handOfOrder.bottles.find(b => b.id === bottleId); assert.equal(b.status, 'CONSUMED'); assert.equal(s.random.cursor, prior.random.cursor + 1);
    assert.deepEqual(currentResources(s), resources); assert.deepEqual(s.injuries, prior.injuries); assert.equal(s.handOfOrder.preparedWeek, null);
    if (s.progression.sequence === 1) { assert.equal(s.health, prior.H); assert.equal(s.spirituality, prior.S); assert.deepEqual(s.progression.mastery, { ...prior.mastery, ...Object.fromEntries(NEW_IDS.map(id => [id, 0])) }); }
    clear();
  }
  function encounter() {
    ready(STRATEGY.encounterReadiness); snapshot('beforeEncounter'); ms({ type: 'PREPARE_ENCOUNTER' }, 'paid30-three-independent-combat-support-pieces');
    ms({ type: 'ENCOUNTER_TALK' }, 'original-adults-remain-outside-player-walks-to-new-yard');
    assert.equal(currentSite(s).guide.location, 'OUTSIDE'); assert.equal(currentSite(s).volunteer.location, 'OUTSIDE'); assert.equal(currentSite(s).playerLocation, 'ANNEX_A');
    if (s.handOfOrder.encounter.policy !== STRATEGY.encounterPolicy) ms({ type: 'SET_COMBAT_POLICY', policy: STRATEGY.encounterPolicy }, 'explicit-all-policy');
    ms({ type: 'ENCOUNTER_FIGHT' }, 'independent-optional-bram-fight'); snapshot('combatStart');
    while (s.combat && s.combat.round <= STRATEGY.combatRoundCap) go({ type: 'COMBAT_ROUND', stance: STRATEGY.combatStance }, `combat-round-${s.combat.round}`);
    if (s.combat) throw new FiniteEncounterStop('Actual encounter still running at the declared90-round limit; no outcome invented');
    assert(s.handOfOrder.encounter.terminal); assert.equal(currentSite(s).playerLocation, 'OUTSIDE'); snapshot('combatTerminal'); clear();
  }
  function save(stage, error = null) {
    assert(!saved); saved = true; assert.equal(fileHash(SOURCE), SOURCE_SHA); assert.equal(fileHash(PREDECESSOR), PREDECESSOR_SHA); assert.equal(fileHash(ORIGINAL_DEATH), ORIGINAL_DEATH_SHA); assert.deepEqual(inspectFreeze(), frozen, 'Frozen source/runtime changed during capture');
    const rounds = s.combatHistory.slice(original?.combatHistory.length ?? s.combatHistory.length);
    write('natural.json', { provenance: { kind: 'EXACT594_PUBLIC_BALANCER_THEN_PUBLIC_HAND_OF_ORDER', prior: old.provenance, source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final', inheritedDirectedPrefix: false, fullNaturalS9ToS1: s.progression.sequence === 1, newRandomChanges: false },
      producerSha256, freezeSha256: frozen.sha256, strategy: STRATEGY, creation: old.creation, seed: SEED, prefixCount: PREFIX_COUNT, inheritedPrefixCount: INHERITED_COUNT, prefixVerified,
      commands, initial, prefixFinal: original, beforeLast, lastIntent, pendingIntent, failurePhase, snapshots, treatments, stage, error: error ? String(error) : null, final: s });
    write('boundaries.index.json', boundaries); write('boundaries.steps.json', boundarySteps); write('transitions.json', transitions);
    write('summary.json', { stage, producerSha256, freezeSha256: frozen.sha256, strategy: STRATEGY, source: { prefixCount: PREFIX_COUNT, prefixVerified, sourceSha256: SOURCE_SHA, prefixCompactSha256: PREFIX_SHA, migratedWholeSourceSha256: original ? stateHash(original) : null },
      commands: commands.length, final: body(s), originalMastery: original?.progression.mastery ?? null, sourceOriginals: original ? originalResources(original) : null,
      currentOriginals: currentResources(s), life: s.handOfOrder.life, lifeAbilityUse: lifeAbilityUse(s), combatAbilityUse: combatAbilityUse(rounds), encounter: s.handOfOrder.encounter, rounds,
      bottles: s.handOfOrder.bottles, treatments, boundaries: Object.keys(boundaries), uniqueTransitions: transitions.length, snapshots });
    write('capture-integrity.json', { producerSha256, freezeSha256: frozen.sha256, frozenFiles: frozen.files,
      metadata: Object.fromEntries(['natural.json', 'commands.jsonl', 'public.jsonl', 'summary.json', 'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', ...(prefixVerified ? ['source-prefix.json', 'original-death-source.json'] : [])].map(name => [name, fileEvidence(join(outputDir, name))])),
      files: Object.fromEntries([...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].map(name => [name, fileEvidence(join(outputDir, name))])) });
    if (replayOnly) for (const [name, rows] of replayRows) assert.equal(rows.next().done, true, `Missing replay rows: ${name}`);
    console.log(JSON.stringify({ outputDir, replayOnly, replayMatched: replayOnly && stage !== 'ACTUAL_BLOCKER', stage, commands: commands.length, namedBoundaries: Object.keys(boundaries).length, uniqueTransitions: transitions.length, status: s.status, sequence: s.progression.sequence, week: s.week }));
  }
  try {
    assert.deepEqual(s, migrateCurrent(runtime, old.initial)); runtime.assertValidSliceState(s);
    for (const intent of old.commands) { go(intent); if (commands.length === INHERITED_COUNT) { assert.deepEqual(s, migrateCurrent(runtime, old.prefixFinal), 'The whole original483 living predecessor also replays exactly'); assert.deepEqual(s, migrateCurrent(runtime, old.recovery.final), 'The actual paid-recovery483 final is the inherited source'); } }
    assert.deepEqual(commands, old.commands); assert.deepEqual(s, originalExpected, 'Full594 replay equals the entire migrated actual living source');
    original = structuredClone(s); prefixVerified = true; checkOriginals(runtime, s, original);
    write('source-prefix.json', { source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final', prefixCount: PREFIX_COUNT, rawInitial: old.initial, rawFinal: old.final, rawInheritedFinal: old.prefixFinal, predecessorSource: PREDECESSOR, predecessorSha256: PREDECESSOR_SHA, inheritedCount: INHERITED_COUNT, inheritedCommandsSha256: INHERITED_SHA, commands: old.commands, rawCommandsSha256: PREFIX_SHA, migratedWholeStateSha256: stateHash(original), inheritedDirectedPrefix: false });
    write('original-death-source.json', { source: ORIGINAL_DEATH, sourceSha256: ORIGINAL_DEATH_SHA, commonPrefixCount: COMMON_COUNT, commands: old.death.commands, creation: old.death.creation, seed: old.death.seed, rawInitial: old.death.initial, rawFinal: old.death.final });
    snapshot('departure'); capture('exact-original594-living-source');
    // The actual source already knows the clinic. Access investigation is used
    // only if the current public state really needs it; it never treats a wound.
    clear(); assert(s.cash >= 60);
    if (!s.careKnown) { go({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, 'actual-clinic-access-only'); clear(); }
    for (let n = 0; s.injuries.length > 0 || s.health < 100; n++) { assert(n < STRATEGY.sourceRecoveryRestCap); ordinary(true); }
    assert.equal(treatments.length, 1); assert.equal(s.injuryRisk, 0); snapshot('treated');
    ready({ ap: 1, cash: 500 }); ms({ type: 'LEARN_GUIDANCE' }, 'paid500-guidance-freezes-eight-roots-and-original-guard-plate'); clear(); snapshot('guidance');
    for (const taskId of ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN']) action({ type: 'PREPARE_TASK', taskId }, `preparation-${taskId.toLowerCase()}`);
    for (let number = 0; s.progression.sequence === 2 && number < STRATEGY.potionAttemptCap; number++) {
      let bottle = s.handOfOrder.bottles.find(b => b.status === 'PLAYER') ?? s.handOfOrder.bottles.find(b => b.status === 'SUPPLIER');
      if (!bottle) { ready({ ap: 1, cash: 100 }); ms({ type: 'REQUEST_SUPPLY' }, 'paid100-after-all-original-bottles-failed'); const week = s.handOfOrder.resupply.requestedWeek; clear(); ready({ afterWeek: week }); ms({ type: 'RECEIVE_SUPPLY' }, 'next-real-week-three-new-bottle-identities'); bottle = s.handOfOrder.bottles.find(b => b.status === 'SUPPLIER'); }
      assert(bottle); const id = bottle.id;
      if (bottle.status === 'SUPPLIER') { while (s.handOfOrder.bottles.find(b => b.id === id).labourSteps < 5) action({ type: 'POTION_WORK', bottleId: id }, `${id}-actual-labour`); ready({ ap: 0, cash: 1200 }); ms({ type: 'BUY_POTION', bottleId: id }, `paid1200-${id}`); }
      ready({ ap: 1, cash: 180, ...STRATEGY.recovery, afterWeek: s.balancer.promotionWeek + 11 });
      ms({ type: 'PREPARE_PROMOTION' }, `paid180-current-week-prepare-${id}`); consume(id);
    }
    if (s.progression.sequence !== 1) save(STAGES[1]);
    else { snapshot('promoted'); ms({ type: 'EXIT_ORIGINAL' }, 'walk-four-metres-to-actual-outside'); ready(STRATEGY.annexReadiness); ms({ type: 'RENT_ANNEX' }, 'pay40-place-new-annex-with-three-finite-pieces'); clear(); for (const id of CASES) practice(id); action({ type: 'REFLECT' }, 'three-honest-reports-reflected'); assert.equal(s.progression.acting, 100); snapshot('practiced'); encounter(); checkOriginals(runtime, s, original); save(STAGES[0]); }
  } catch (error) {
    if (replayOnly && !(error instanceof ActualTerminalStop) && !(error instanceof FiniteEncounterStop)) throw error;
    if (saved) throw error;
    if (error instanceof ActualTerminalStop) { snapshot('actualTerminal'); save(STAGES[3]); }
    else if (error instanceof FiniteEncounterStop) save(STAGES[2], error);
    else { save('ACTUAL_BLOCKER', error); throw error; }
  } finally { for (const rows of replayRows?.values() ?? []) rows.return?.(); }
}

// Streaming top-level reader: no parsing/retaining unrelated snapshot trees.
export function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START', key = '', selected = false, quoted = false, escaped = false, depth = 0, kind = 'PRIMITIVE'; const pieces = [];
  try { for (;;) {
    const n = readSync(fd, buffer, 0, buffer.length, null), text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end(); let captureStart = selected && phase === 'VALUE' ? 0 : -1;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (phase === 'START') { if (/\s/.test(c)) continue; assert.equal(c, '{'); phase = 'KEY'; continue; }
      if (phase === 'KEY' || phase === 'AFTER') { if (/\s/.test(c) || c === ',') continue; if (c === '}') throw Error(`Missing JSON entry: ${wanted}`); assert.equal(c, '"'); key = '"'; escaped = false; phase = 'KEY_STRING'; continue; }
      if (phase === 'KEY_STRING') { key += c; if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') { selected = JSON.parse(key) === wanted; phase = 'COLON'; } continue; }
      if (phase === 'COLON') { if (/\s/.test(c)) continue; assert.equal(c, ':'); phase = 'VALUE_START'; continue; }
      if (phase === 'VALUE_START') { if (/\s/.test(c)) continue; if (selected) captureStart = i; depth = 0; quoted = false; escaped = false; kind = c === '{' || c === '[' ? 'CONTAINER' : c === '"' ? 'STRING' : 'PRIMITIVE'; phase = 'VALUE'; }
      if (phase === 'VALUE') {
        let done = false, end = i + 1;
        if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; } }
        else if (c === '"') quoted = true; else if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
        else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
        if (done) { if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); } phase = 'AFTER'; selected = false; captureStart = -1; }
      }
    }
    if (captureStart >= 0) pieces.push(text.slice(captureStart)); if (!n) break;
  } } finally { closeSync(fd); }
  throw Error(`Missing JSON entry: ${wanted}`);
}
export function* readJsonLines(path) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8'); let pending = '';
  try { for (;;) { const n = readSync(fd, buffer, 0, buffer.length, null); pending += n ? decoder.write(buffer.subarray(0, n)) : decoder.end(); let end;
    while ((end = pending.indexOf('\n')) !== -1) { const line = pending.slice(0, end); pending = pending.slice(end + 1); assert(line.length); yield JSON.parse(line); }
    if (!n) { assert.equal(pending, '', `Partial final ledger row: ${path}`); break; }
  } } finally { closeSync(fd); }
}
export function assertSafeOutput(output, protectedRoots) {
  const path = resolve(output); let ancestor = path; while (!existsSync(ancestor)) ancestor = resolve(ancestor, '..');
  const intended = resolve(realpathSync(ancestor), relative(ancestor, path));
  for (const root of protectedRoots.map(root => realpathSync(root))) { const inside = relative(root, intended); assert(inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside), 'Verification output must not overlap immutable inputs'); }
  mkdirSync(path, { recursive: true }); assert.equal(realpathSync(path), intended); return path;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = {}; const seen = new Set();
    for (let i = 0; i < args.length; i++) { const key = args[i]; assert(!seen.has(key)); seen.add(key);
      if (key === '--help' || key === '--inspect-freeze') options[key.slice(2)] = true;
      else { assert(['--freeze-sha256', '--replay'].includes(key), `Unknown option: ${key}`); assert(args[i + 1] && !args[i + 1].startsWith('--')); options[key === '--replay' ? 'replay' : 'freezeSha256'] = args[++i]; }
    }
    if (options.help) console.log('Coordinator only, after source and compiled mechanics freeze:\nnode scripts/play/hand-of-order-stage.mjs --inspect-freeze\nnode --max-old-space-size=768 scripts/play/hand-of-order-stage.mjs --freeze-sha256 REVIEWED_HASH\nnode --max-old-space-size=768 scripts/play/hand-of-order-stage.mjs --freeze-sha256 REVIEWED_HASH --replay EXISTING_CAPTURE_DIR');
    else if (options['inspect-freeze']) { assert.equal(args.length, 1); console.log(JSON.stringify(inspectFreeze())); }
    else { assert.match(options.freezeSha256 ?? '', /^[0-9a-f]{64}$/, 'Explicit coordinator freeze hash is required before natural gameplay'); assert.equal(realpathSync(fileURLToPath(import.meta.url)), realpathSync('scripts/play/hand-of-order-stage.mjs')); await runNatural(options); }
  } catch (error) { console.error(error); process.exitCode = 1; }
}
