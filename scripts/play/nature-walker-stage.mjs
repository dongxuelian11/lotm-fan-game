import assert from 'node:assert/strict';
import { appendFileSync, closeSync, copyFileSync, linkSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, realpathSync, writeFileSync } from 'node:fs';
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
export const SOURCE = 'tests/fixtures/barren-matriarch-v01850/natural.json';
export const SOURCE_SHA = 'cd557e330303c6ce9efaf9960544f28eb8a4f9058182a1860a38f4edb7298caf';
export const PREDECESSOR = 'tests/fixtures/coffin-bearer-v01610/natural.json';
export const PREDECESSOR_SHA = '731c25059489305fc3699c1bdc6fb39489590f30a0f149417210ae4f6aef0fdc';
export const INHERITED_SHA = '27112c23acd8ec0a12397b2c1503f982f34ae9f6a0e2ace65b40a5e5e1001aa5';
export const PREFIX_SHA = 'aa8329a36876dbd7dd1f74011991da3f1c28eea916be77ae8d61738ff32c6d0a';
export const PREFIX_COUNT = 851, INHERITED_COUNT = 674, SEED = 'cultivator-natural-v069';
export const CASES = ['living-response', 'withdrawn-care', 'root-impact'];
export const ROOTS = ['cultivator', 'physician', 'harvestpriest', 'biologist', 'druid', 'ancientAlchemist', 'coffinBearer', 'barrenMatriarch'];
export const NEW_IDS = ['mother.s1.living-response', 'mother.s1.root-bearing'];
export const STAGES = ['NATURAL851_PREFIX_PUBLIC_NATURE_WALKER_CONTINUATION', 'SAME_SEED_FINITE_POTION_FAILURES_ALIVE_S2', 'ACTUAL_FINITE_ENCOUNTER_UNRESOLVED', 'ACTUAL_TERMINAL_WITH_NATURAL851_HISTORY'];
export const STRATEGY = deepFreeze({
  source: 'EXACT851_FULL_LIVING_BARREN_MATRIARCH_FINAL', sourceSeed: SEED, sourceCursor: 238,
  caseMethod: 'ABILITY', caseRoute: 'CURRENT_PUBLIC_PREFERRED_ACTION_ONCE_EACH_WITH_ORDINARY_COMPLETION_IF_POWER_FAILS',
  encounterPolicy: 'ALL', combatStance: 'CONTROL', combatRoundCap: 90, capExit: 'ONE_PUBLIC_RETREAT_IF_AVAILABLE_OTHERWISE_PRESERVE_UNRESOLVED',
  potionAttemptCap: 12, maxCommands: 3500, ordinaryPreparationCap: 600, caseCommandCap: 80,
  sourceInjuryRecovery: 'NONE_SOURCE_IS_HEALTH100_WITH_NO_INJURIES_NO_FORCED_CLINIC',
  ordinaryActions: 'WORK_ONCE_PER_WEEK_THEN_REST', recovery: { health: 100, mind: 100, spirituality: 120, pollution: 0 },
  caseReadiness: { ap: 3, mind: 8, spirituality: 8 }, encounterReadiness: { ap: 2, cash: 30, mind: 3 },
  annexReadiness: { ap: 1, cash: 40 }, afterCases: 'NO_OPTIONAL_MAXIMUM_RECOVERY_ONE_ACTUAL_ORDINARY_ACTION_AFTER_LIVING_EXIT_AND_DUE_SETTLEMENT',
  originalRootPad: 'SOLE_LIVE_CONTINUATION_OF_BM2_ROOT_PAD_INTEGRITY50_NO_RESTORE',
  originalGuard: 'SOLE_CB3_GUARD_WITH_ONE_SPENT_TWO_UNUSED_SEGMENTS_NO_RESTORE',
  livingResponseCombat: 'NO_TARGET_ORIGINAL_PLANTS_RETURNED_OUTSIDE_ZERO_COST_ORDINARY_FALLBACK',
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
  for (const path of ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution', 'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation', 'scripts/play/nature-walker-stage.mjs', 'scripts/play/nature-walker-save.mjs']) walk(path);
  assert(existsSync('dist/domain/nature-walker/index.js'), 'Coordinator must compile the final module before freeze');
  return { sha256: compactHash(files), files };
}
export async function loadRuntime({ sqlite = false } = {}) {
  const names = ['domain/slice/index', 'domain/slice/migration', 'domain/slice/validation', 'domain/nature-walker/index', 'domain/nature-walker/life', 'domain/nature-walker/encounter', 'domain/nature-walker/combat', 'domain/barren-matriarch/combat', 'domain/slice/weekly-finance', 'domain/game-calendar', 'shared/player-text'];
  if (sqlite) names.push('persistence/slice-store');
  return Object.assign({}, ...await Promise.all(names.map(name => import(pathToFileURL(resolve(`dist/${name}.js`)).href))));
}
export function migrateCurrent(runtime, raw) {
  const state = runtime.migrateSliceState(raw);
  assert.equal(state.schemaVersion, 204, 'Use the explicit current-schema migration');
  assert.equal(state.contentVersion, 'nature-walker-v204');
  for (const key of ['runId', 'revision', 'status', 'character', 'week', 'date', 'actionsRemaining', 'weeklyBudget', 'wagePaidWeek', 'cash', 'lifeTier', 'nextLifeTier', 'health', 'mind', 'spirituality', 'injuries', 'injuryRisk', 'debts', 'missedWeeks', 'credit', 'random', 'progression']) {
    if (Object.hasOwn(raw, key)) assert.deepEqual(state[key], raw[key], `Schema migration does not alter actual ${key}`);
  }
  runtime.assertValidSliceState(state); return state;
}
export function readSource() {
  assert.equal(fileHash(SOURCE), SOURCE_SHA); assert.equal(fileHash(PREDECESSOR), PREDECESSOR_SHA);
  const old = Object.fromEntries(['provenance', 'creation', 'seed', 'initial', 'commands', 'prefixCount', 'prefixFinal', 'final'].map(k => [k, readObjectEntry(SOURCE, k)]));
  const predecessor = Object.fromEntries(['provenance', 'creation', 'seed', 'initial', 'commands', 'final'].map(k => [k, readObjectEntry(PREDECESSOR, k)]));
  assert.equal(old.commands.length, PREFIX_COUNT); assert.equal(compactHash(old.commands), PREFIX_SHA);
  assert.equal(old.prefixCount, INHERITED_COUNT); assert.equal(old.seed, SEED);
  assert.deepEqual(old.provenance, { kind: 'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION', source: PREDECESSOR, sourceSha256: PREDECESSOR_SHA, newRandomChanges: false });
  assert.equal(predecessor.commands.length, INHERITED_COUNT); assert.equal(compactHash(predecessor.commands), INHERITED_SHA);
  assert.deepEqual(old.commands.slice(0, INHERITED_COUNT), predecessor.commands, 'All original674 commands, not an invented recovery/death branch');
  assert.deepEqual(predecessor.creation, old.creation); assert.equal(predecessor.seed, SEED); assert.equal(old.creation.sex, 'FEMALE');
  for (const raw of [old.initial, old.prefixFinal, old.final]) { assert.equal(raw.schemaVersion, 182); assert.equal(raw.contentVersion, 'barren-matriarch-v182'); }
  for (const raw of [predecessor.initial, predecessor.final]) { assert.equal(raw.schemaVersion, 159); assert.equal(raw.contentVersion, 'coffin-bearer-v159'); }
  const f = old.final; assert.equal(old.initial.progression.sequence, null); assert.equal(f.status, 'ACTIVE');
  assert.equal(f.runId, 'cultivator-rebuild-natural'); assert.equal(f.revision, 852); assert.equal(f.week, 212);
  assert.deepEqual(f.date, { epoch: 'FIFTH_EPOCH', year: 1353, month: 7, day: 14 });
  assert.deepEqual([f.health, f.mind, f.spirituality, f.cash, f.actionsRemaining], [100, 96, 114, 885, 3]);
  assert.deepEqual(f.random, { seed: SEED, cursor: 238 }); assert.equal(f.barrenMatriarch.promotionWeek, 202); assert.equal(f.progression.promotionWeek, 6);
  assert.equal(f.progression.pathwayId, 'mother'); assert.equal(f.progression.sequence, 2); assert.equal(f.progression.acting, 100);
  assert.deepEqual(f.character.coreStats, { physique: 28, perception: 24, will: 23, knowledge: 24 });
  assert.equal(f.character.name, '艾洛'); assert.equal(f.character.gender, 'FEMALE'); assert.equal(f.character.age, 26); assert.equal(f.character.weeklyWage, 180);
  assert.equal(Object.keys(f.progression.mastery).length, 15); assert.equal(Object.values(f.progression.mastery).filter(n => n === 0).length, 3);
  assert.equal(f.progression.mastery['mother.s2.bounded-dormancy'], 8); assert.equal(f.progression.mastery['mother.s2.root-buffer'], 8);
  assert.deepEqual(f.injuries, []); assert.equal(f.injuryRisk, 0); assert.equal(f.seer.pollution, 0);
  const site = f.coffinBearer.life; assert.equal(site.clockSeconds, 834); assert.equal(site.playerTravelMetres, 124); assert.equal(site.playerLocation, 'START');
  assert.equal(site.owner.id, 'CB3-ADA'); assert.equal(site.owner.age, 46); assert.equal(site.owner.location, 'OUTSIDE');
  assert.equal(site.recipient.id, 'CB3-LENA'); assert.equal(site.recipient.name, '莉娜·肖'); assert.equal(site.recipient.age, 39); assert.equal(site.recipient.location, 'OUTSIDE');
  for (const adult of [site.owner, site.recipient]) { assert.equal(adult.alive, true); assert.equal(adult.health, 100); assert.equal(adult.mind, 100); assert(!Object.hasOwn(adult, 'energy')); }
  assert.deepEqual(site.samples.map(x => [x.id, x.alive, x.vitality, x.location]), [['CB3-LIVE-1', true, 47, 'OUTSIDE'], ['CB3-LIVE-2', true, 47, 'OUTSIDE'], ['CB3-DRY-1', false, 0, 'OUTSIDE']]);
  for (const object of [site.paper, site.box, site.tag, ...site.pads]) { assert.equal(object.holder, 'OWNER'); assert.equal(object.location, 'OUTSIDE'); }
  assert.deepEqual(site.guard.segments.map(x => [x.id, x.status]), [['CB3-SEG1', 'SPENT'], ['CB3-SEG2', 'UNUSED'], ['CB3-SEG3', 'UNUSED']]);
  assert.deepEqual(f.barrenMatriarch.life.operation, { dormancy: null, buffer: null });
  assert.deepEqual(f.barrenMatriarch.life.rootPad, { id: 'BM2-ROOT-PAD', sourceId: 'BM2-ROOT-FIBRE-STOCK', material: 'PLANT_FIBRE', quantity: 1, owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 50, acquiredWeek: 202 });
  const martin = f.barrenMatriarch.encounter; assert.equal(martin.status, 'RESOLVED'); assert.equal(martin.enemyStatus, 'SURRENDERED');
  assert.deepEqual([martin.enemyHealth, martin.enemyMind, martin.enemySpirituality], [70, 100, 87]); assert.equal(martin.enemyInjuries.at(-1).severity, 'HEAVY');
  assert.equal(f.coffinBearer.encounter.enemyStatus, 'SURRENDERED'); return { ...old, predecessor };
}
export const originalResources = s => ({ site: s.coffinBearer.life, operation: s.barrenMatriarch.life.operation, rootPad: s.barrenMatriarch.life.rootPad });
export const currentSite = s => s.natureWalker.life.site ?? s.coffinBearer.life;
export const currentPad = s => s.natureWalker.life.rootPad ?? s.barrenMatriarch.life.rootPad;
export const currentResources = s => { const operation = s.natureWalker.life.source ? s.natureWalker.life.operation : s.barrenMatriarch.life.operation; return { site: currentSite(s), operation: { dormancy: operation.dormancy, buffer: operation.buffer }, rootPad: currentPad(s) }; };
export const body = s => ({ status: s.status, revision: s.revision, week: s.week, date: s.date, H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining,
  pollution: s.seer.pollution, injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, sequence: s.progression.sequence, acting: s.progression.acting, mastery: s.progression.mastery,
  finance: { weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit, pulse: s.pulse, billAmount: s.billAmount } });
export function compact(s) {
  const life = s.natureWalker.life, e = s.natureWalker.encounter;
  return { ...body(s), activeEvent: s.activeEvent?.instanceId ?? null, current: currentResources(s),
    life: { activeCase: life.activeCase, operation: life.operation, annex: life.annex, currentAttempt: life.activeCase ? life.cases[life.activeCase].attempts[0] ?? null : null },
    encounter: { status: e.status, policy: e.policy, supportPieces: e.supportPieces, enemyCharges: e.enemyCharges, rootBearing: e.rootBearing,
      livingResponseApplications: e.livingResponseApplications, rootBearingApplications: e.rootBearingApplications, terminal: e.terminal } };
}
export function checkOriginals(runtime, s, original) {
  for (const key of ROOTS) assert.deepEqual(s[key], original[key], `Immutable original ${key} history`);
  assert.deepEqual(s.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  assert.deepEqual(s.seer.completedSources.slice(0, original.seer.completedSources.length), original.seer.completedSources);
  const old = originalResources(original), now = currentResources(s), l = s.natureWalker.life;
  if (s.natureWalker.guidanceKnown) {
    assert.deepEqual(s.natureWalker.sourceHistory, Object.fromEntries(ROOTS.map(k => [k, original[k]])));
    assert.deepEqual(s.natureWalker.sourceScene.originals, old); assert(runtime.validateNatureWalkerSource(s));
  }
  if (s.natureWalker.promotionWeek === null) assert.deepEqual(l, runtime.createNatureWalkerLifeState());
  else { assert.equal(l.source.promotionWeek, s.natureWalker.promotionWeek); assert.deepEqual(l.source.originals, old); }
  assert(runtime.validateNatureWalkerLifeState(s)); assert(runtime.validateNatureWalkerEncounterState(s));
  assert.deepEqual(now.operation, old.operation, 'Inherited dormant/buffer input stays closed and exact');
  assert(!Object.hasOwn(now.site, 'playerEnergy')); for (const adult of [now.site.owner, now.site.recipient]) assert(!Object.hasOwn(adult, 'energy'));
  const attempts = CASES.flatMap(id => l.cases[id].attempts), mindSpent = attempts.reduce((n, a) => n + a.recipientMindSpent, 0);
  assert.equal(l.annex.effortSpent, attempts.reduce((n, a) => n + a.effortSpent, 0)); assert(l.annex.effortSpent <= 9);
  assert.equal(now.site.recipient.mind, old.site.recipient.mind - mindSpent);
  for (const role of ['owner', 'recipient']) { const a = now.site[role], b = old.site[role]; for (const key of ['id','name','age','alive','independentMind','health','injuries']) assert.deepEqual(a[key], b[key]); }
  assert.equal(now.site.owner.mind, old.site.owner.mind); assert.deepEqual(now.site.cases, old.site.cases); assert.deepEqual(now.site.kit, old.site.kit);
  assert.equal(now.site.paper.text, old.site.paper.text); assert.deepEqual(now.site.paper.sampleIds, old.site.paper.sampleIds);
  for (const key of ['box','tag','paper']) for (const field of ['id','owner']) assert.equal(now.site[key][field], old.site[key][field]);
  for (const [i, sample] of now.site.samples.entries()) for (const key of ['id','owner','origin','quantity','massGrams','originalAlive','originalVitality','alive','vitality','maximumVitality']) assert.equal(sample[key], old.site.samples[i][key], `Same actual sample ${key}`);
  assert.deepEqual(now.site.pads, old.site.pads.map((p, i) => ({ ...p, holder: now.site.pads[i].holder, location: now.site.pads[i].location })));
  assert(now.site.clockSeconds >= old.site.clockSeconds); assert(now.site.playerTravelMetres >= old.site.playerTravelMetres);
  const mastery = { ...original.progression.mastery };
  if (s.progression.sequence === 1) { for (const id of NEW_IDS) mastery[id] = 0; for (const id of CASES) if (l.cases[id].status === 'RESOLVED') for (const a of l.cases[id].attempts) for (const ability of a.appliedAbilityIds) mastery[ability] = Math.min(500, mastery[ability] + 8); }
  let integrity = old.rootPad.integrity - attempts.reduce((n, a) => n + (a.impact?.padWear ?? 0), 0);
  const guard = structuredClone(old.site.guard), consumedSegments = new Set();
  for (const round of s.combatHistory.slice(original.combatHistory.length)) {
    const o = round.natureWalkerOutcome; assert(o); assert.equal(o.source.policy, STRATEGY.encounterPolicy); assert.equal(o.source.targetId, 'NW1-ELIAS');
    assert.equal(o.source.rootPad.integrity, integrity, 'Use the single continuing original root pad'); assert.deepEqual(o.source.site.guard, guard);
    for (const a of [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order)) {
      assert.equal(a.rootPadBefore.integrity, integrity); integrity -= a.padWear; assert.equal(a.rootPadAfter.integrity, integrity); assert(integrity >= 0);
      if (a.guardSegmentId) { assert(!consumedSegments.has(a.guardSegmentId)); const segment = guard.segments.find(x => x.id === a.guardSegmentId); assert.equal(segment?.status, 'UNUSED'); segment.status = 'SPENT'; consumedSegments.add(segment.id); }
      if (a.actor === 'PLAYER' && a.selectedAbility === NEW_IDS[0]) { assert.equal(a.paidCost, 0); assert.equal(a.mindCost, 0); assert.equal(a.windowGranted, null); assert(!a.masteryApplied.includes(NEW_IDS[0])); }
      assert(a.windowsApplied.every(w => w.kind === 'ROOT_BEARING' && w.amount > 0 && w.amount <= 30));
      for (const id of a.masteryApplied) { assert(Object.hasOwn(mastery, id)); mastery[id] = Math.min(500, mastery[id] + 8); }
    }
    assert.equal(o.rootPadAfter.integrity, integrity); assert.deepEqual(o.siteAfter.guard, guard); assert.equal(o.livingResponseApplications, 0);
  }
  assert.equal(now.rootPad.integrity, integrity); assert.deepEqual({ ...now.rootPad, integrity: old.rootPad.integrity, location: old.rootPad.location }, old.rootPad);
  assert.equal(now.rootPad.location, now.site.playerLocation); assert.deepEqual(now.site.guard, guard);
  assert.deepEqual(s.progression.mastery, mastery, 'Only honest reports and actual applications grant mastery');
  const { coreStats, ...identity } = s.character, { coreStats: priorStats, ...priorIdentity } = original.character;
  assert.deepEqual(identity, priorIdentity); for (const [k, v] of Object.entries(priorStats)) assert.equal(coreStats[k], Math.min(500, v + (s.progression.sequence === 1 ? 1 : 0)));
  assert.equal(s.progression.promotionWeek, original.progression.promotionWeek); assert.equal(s.random.seed, SEED); assert.equal(s.runId, original.runId);
}
// Independent positive specification. These functions do not call production projectors.
const pick = (v, keys) => Object.fromEntries(keys.split(' ').map(k => [k, v[k]]));
const nullable = (v, project) => v === null ? null : project(v);
const publicInjury = v => pick(v, 'id severity acquiredRevision treatedRevision');
const publicPad = v => pick(v, 'id sourceId material quantity owner holder location integrity acquiredWeek');
const publicWindow = v => pick(v, 'kind round order castAt expiresAt remaining supportId');
const publicPending = v => pick(v, 'id owner kind createdAt expiresAt remaining guardSegmentId');
const publicCheck = v => ({ ...pick(v, 'ability baseAbility effectiveAbility difficulty chance roll tier'), modifiers: v.modifiers.map(m => pick(m, 'source value')) });
const publicGuard = v => ({ ...pick(v, 'id sourceId prepared owner location preparedWeek actionsSpent costPence spiritualitySpent'), segments: v.segments.map(p => pick(p, 'id status')) });
const publicAdult = v => ({ ...pick(v, 'id name age alive independentMind location health mind consent'), injuries: v.injuries.map(publicInjury) });
function publicSiteEvidence(p) {
  return { ...pick(p, 'siteId playerLocation playerTravelMetres clockSeconds externalSeconds'), owner: publicAdult(p.owner), recipient: publicAdult(p.recipient),
    samples: p.samples.map(v => pick(v, 'id caseId owner origin quantity massGrams originalAlive originalVitality alive vitality maximumVitality holder location care handovers returns')),
    paper: { ...pick(p.paper, 'id owner holder location text readings'), sampleIds: [...p.paper.sampleIds], records: [...p.paper.records] },
    kit: pick(p.kit, 'sourceId purchased purchasedWeek actionsSpent costPence'),
    box: pick(p.box, 'id owner holder location quantity maximumMassGrams capacity sampleId returns'),
    tag: pick(p.tag, 'id owner holder location quantity returns'),
    pads: p.pads.map(v => pick(v, 'id sourceId owner holder location quantity status caseId spentWeek')), guard: publicGuard(p.guard) };
}
export function expectedPublicAction(a) {
  return { ...pick(a, 'order actor id planned selectedAbility fallbackReason mode label selfGain enemyReduction threatens mentalPressure attackKind rawContribution rawReduction paidCost mindCost physicalFactor succeeded resisted pendingApplied masteryApplied padWear guardSegmentId playerHealthBefore playerHealthAfter recoveredHealth distanceBeforeMetres contactDistanceMetres distanceAfterMetres atSeconds elapsedSeconds travelMetres playerMindAfter playerSpiritualityAfter enemySpiritualityAfter supportId supportWearPaid enemyChargeId resistanceChance resistanceRoll'),
    check: nullable(a.check, publicCheck), pendingBefore: a.pendingBefore.map(publicPending), pendingAfter: a.pendingAfter.map(publicPending),
    rootPadBefore: publicPad(a.rootPadBefore), rootPadAfter: publicPad(a.rootPadAfter), windowGranted: nullable(a.windowGranted, publicWindow),
    windowsApplied: a.windowsApplied.map(w => pick(w, 'kind amount supportId')), windowsExpired: a.windowsExpired.map(publicWindow), windowsCancelled: a.windowsCancelled.map(publicWindow) };
}
export function expectedPublicOutcome(o, inheritedIds) {
  return { ...pick(o, 'enemyHealth enemyMind enemySpirituality enemyStatus enemyRisk weaponLocation pendingKind composureReady preservationAttempts rootBufferAttempts rootBufferApplications guardAttempts livingResponseAttempts rootBearingAttempts livingResponseApplications rootBearingApplications enemyTravelMetres targetId round stance continuing playerHealthAfter playerMindAfter playerSpiritualityAfter playerRiskAfter elapsedSeconds'),
    enemyInjuries: o.enemyInjuries.map(publicInjury), powerUses: pick(o.powerUses, 'ARC_BOLT WARD COMPOSE MENTAL_PRESSURE'),
    supportPieces: o.supportPieces.map(p => pick(p, 'id ownerId location quantity status wear usedRound usedOrder')),
    enemyCharges: o.enemyCharges.map(p => pick(p, 'id ownerId status usedRound usedOrder')),
    livingResponse: nullable(o.livingResponse, publicWindow), rootBearing: nullable(o.rootBearing, publicWindow), playerInjuriesAfter: o.playerInjuriesAfter.map(publicInjury),
    rootPadAfter: publicPad(o.rootPadAfter), masteryAfter: Object.fromEntries([...inheritedIds, ...NEW_IDS].map(id => [id, o.masteryAfter[id] ?? 0])),
    siteAfter: publicSiteEvidence(o.siteAfter),
    playerActions: o.playerActions.map(expectedPublicAction), enemyActions: o.enemyActions.map(expectedPublicAction),
    expiredPending: o.expiredPending.map(publicPending), expiredWindows: o.expiredWindows.map(publicWindow), cancelledWindows: o.cancelledWindows.map(publicWindow) };
}
export function expectedPublicRound(r, inheritedIds) {
  return { ...pick(r, 'round stance first playerCount enemyCount playerCountRoll enemyCountRoll playerAdvantage enemyAdvantage winChance winner consequence retreat'),
    moves: r.moves.map(m => pick(m, 'actor label selfGain enemyReduction')),
    consequenceWeights: r.consequenceWeights ? pick(r.consequenceWeights, 'light heavy death') : null,
    ...(r.consequenceDomain === undefined ? {} : { consequenceDomain: r.consequenceDomain }),
    ...(r.consequenceRoll === undefined ? {} : { consequenceRoll: r.consequenceRoll }),
    natureWalkerOutcome: expectedPublicOutcome(r.natureWalkerOutcome, inheritedIds) };
}
export function assertNoPrivateFields(value, path = [], combatOnly = false) {
  if (Array.isArray(value)) { value.forEach((v, i) => assertNoPrivateFields(v, [...path, String(i)], combatOnly)); return; }
  if (!value || typeof value !== 'object') return;
  const denied = ['truth','seed','cursor','random','randomSeed','randomCursor','randomCursorBefore','randomCursorAfter','randomBefore','randomAfter','cursorBefore','cursorAfter','preparationRoll','sourceHistory','sourceScene','journal','acquisitionJournal','mechanicalPreparation','originals','__privateCaptureProbe'];
  for (const [key, child] of Object.entries(value)) {
    assert(!denied.includes(key), `Private field at ${[...path, key].join('.')}`);
    if (key === 'preparation') {
      assert.equal(combatOnly, false);
      if (path.length === 1 && path[0] === 'prices') assert(Number.isSafeInteger(child) && child >= 0, 'Only the public preparation price is allowed');
      else { assert.deepEqual(path, ['encounter'], 'Preparation is only public at its exact encounter summary path'); if (child !== null) assert.deepEqual(Object.keys(child).sort(), ['week','pricePaid','mindPaid','actionsPaid'].sort(), 'Only the public paid-cost summary is allowed'); }
    }
    if (combatOnly && key === 'source') { assert.equal(path.at(-2), 'modifiers'); assert.equal(typeof child, 'string'); }
    assertNoPrivateFields(child, [...path, key], combatOnly);
  }
}
export function assertPublicEvidence(runtime, s, p = runtime.projectSliceState(s)) {
  assertNoPrivateFields(p.natureWalker);
  if (s.combat?.encounterId === 'NATURE_WALKER_DISPUTE') assertNoPrivateFields(p.combat, [], true);
  const ids = runtime.NATURE_WALKER_INHERITED_ABILITY_IDS; assert.equal(ids.length, 15);
  for (const [i, round] of s.combatHistory.entries()) if (round.natureWalkerOutcome) {
    const expected = runtime.projectPlayerText(expectedPublicRound(round, ids), s.character.name), actual = p.combatHistory[i]; assert.deepEqual(actual, expected, 'History uses the exact positive public whitelist'); assertNoPrivateFields(actual, [], true);
  }
  if (s.lastCombatRound?.natureWalkerOutcome) { assert.deepEqual(p.lastCombatRound, runtime.projectPlayerText(expectedPublicRound(s.lastCombatRound, ids), s.character.name), 'LAST uses the same exact public whitelist'); assertNoPrivateFields(p.lastCombatRound, [], true); }
  if (s.combat?.lastRound?.natureWalkerOutcome) { assert.deepEqual(p.combat.lastRound, runtime.projectPlayerText(expectedPublicRound(s.combat.lastRound, ids), s.character.name), 'Live combat.lastRound uses the same exact public whitelist'); assertNoPrivateFields(p.combat.lastRound, [], true); }
}
export function publicSnapshot(runtime, s) {
  const p = runtime.projectSliceState(s); assertPublicEvidence(runtime, s, p);
  // Public ledger never contains the private compact state or the RNG stream.
  return { status: p.status, week: s.week, date: structuredClone(s.date), health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, actionsRemaining: s.actionsRemaining,
    natureWalker: p.natureWalker, combat: s.combat?.encounterId === 'NATURE_WALKER_DISPUTE' ? p.combat : null,
    lastCombatRound: s.lastCombatRound?.natureWalkerOutcome ? p.lastCombatRound : null,
    combatHistory: p.combatHistory.filter(r => Object.hasOwn(r, 'natureWalkerOutcome')) };
}

export function publicControl(runtime, s, intent) {
  assert(runtime.validateSlicePayload(intent), `Strict public payload: ${JSON.stringify(intent)}`);
  const p = runtime.projectSliceState(s); assertPublicEvidence(runtime, s, p);
  if (intent.type === 'CONTINUE_LIFE') {
    assert.equal(s.status, 'SLICE_COMPLETE'); assert(s.ending && s.ending.kind !== 'DEATH' && s.caseArchive.length === 0);
    return { kind: 'CONTINUE_LIFE', status: p.status, enabled: true };
  }
  assert.equal(s.status, 'ACTIVE', 'A sealed death never continues');
  if (intent.type === 'NATURE_WALKER') {
    const a = p.natureWalker.actions.find(x => isDeepStrictEqual(x.command, intent.command)); assert(a, `Missing public control ${JSON.stringify(intent.command)}`); assert(a.enabled, a.reason);
    const l = p.natureWalker.life.actions.find(x => isDeepStrictEqual(x.command, intent.command));
    if (l) {
      const nextCase = CASES.find(id => s.natureWalker.life.cases[id].status !== 'RESOLVED');
      if ('caseId' in intent.command) assert.equal(intent.command.caseId, nextCase);
      if ('caseId' in intent.command && !['OBSERVE', 'REPORT'].includes(intent.command.type)) assert.equal(l.preferredAction, true, 'Use the actual recommended case route');
      if (['EXIT_ORIGINAL', 'INITIALISE_WORKAREA', 'RENT_ANNEX'].includes(intent.command.type)) assert.equal(l.id, p.natureWalker.life.preferredActionId, 'Use the actual public entry step');
      if (intent.command.type === 'PREPARE') assert(['ABILITY', 'ORDINARY'].includes(intent.command.method));
    }
    if (intent.command.type === 'SET_COMBAT_POLICY') assert.equal(intent.command.policy, STRATEGY.encounterPolicy);
    if (intent.command.type === 'ENCOUNTER_FIGHT') assert.equal(s.natureWalker.encounter.policy, STRATEGY.encounterPolicy);
    return structuredClone(a);
  }
  if (intent.type === 'ACTION') { assert(['WORK', 'REST'].includes(intent.action)); assert.equal(intent.action, s.wagePaidWeek === s.week ? 'REST' : 'WORK'); assert(p.canAct, p.actionBlockedReason); assert(!p.natureWalker.insideCase && !s.combat && s.natureWalker.preparedWeek === null); return { kind: 'ACTION', action: intent.action, enabled: true }; }
  if (intent.type === 'EVENT_CHOICE') {
    assert.equal(s.activeEvent?.instanceId, intent.eventInstanceId); const a = p.activeEvent?.choices.find(x => x.id === intent.choiceId); assert(a?.enabled);
    assert.equal(intent.choiceId, STRATEGY.eventChoices[p.activeEvent.id.startsWith('ORIGIN') ? 'ORIGIN' : p.activeEvent.id]); return structuredClone(a);
  }
  assert.equal(intent.type, 'COMBAT_ROUND'); assert.equal(intent.stance, s.combat.round > STRATEGY.combatRoundCap ? 'RETREAT' : STRATEGY.combatStance); assert.equal(Object.hasOwn(intent, 'winnerPolicy'), false, 'This pathway has no winner-policy payload');
  assert.equal(s.natureWalker.encounter.policy, STRATEGY.encounterPolicy); assert(p.combat?.stances.some(x => x.id === intent.stance));
  assert.equal(s.combat.encounterId, 'NATURE_WALKER_DISPUTE');
  assert.deepEqual(p.combat.playerCountWheel, runtime.NATURE_WALKER_COUNT_WHEEL);
  assert.deepEqual(p.combat.enemyCountWheel, runtime.NATURE_WALKER_ENEMY_COUNT_WHEEL);
  assert.deepEqual(p.combat.playerCountWheel.map(w => [w.id, w.weight]), [['1', 10], ['2', 15], ['3', 25], ['4', 25], ['5', 15], ['6', 10]]);
  assert.deepEqual(p.combat.playerAbilityWheel, runtime.natureWalkerAbilityWheel(s, null));
  if (intent.stance !== 'RETREAT') assert.deepEqual(p.combat.playerAbilityWheels[intent.stance], runtime.natureWalkerAbilityWheel(s, intent.stance));
  assert.deepEqual(p.combat.enemyAbilityWheel, runtime.NATURE_WALKER_ENEMY_ABILITY_WHEEL);
  const baseWeights = [30, 15, 25, 10, 15, 5, 20, 20];
  assert.deepEqual(p.combat.playerAbilityWheel.map(w => w.id), ['STRIKE', 'BODY_FOLLOWUP', 'mother.s2.root-buffer', 'mother.s3.finite-preservation', 'mother.s7.life-support', 'ACCIDENT', ...NEW_IDS]);
  assert.deepEqual(p.combat.playerAbilityWheel.map(w => w.weight), baseWeights.map(w => w * 4 / 560 * 100));
  const source = runtime.currentNatureWalkerCombatSource(s); assert(source); assert.equal(source.maxActionCount, 6); assert.equal(source.targetId, 'NW1-ELIAS'); assert.deepEqual(source.rootPad, currentPad(s));
  assert(source.site.samples.every(x => x.location === 'OUTSIDE')); assert.equal(source.site.owner.location, 'OUTSIDE'); assert.equal(source.site.recipient.location, 'OUTSIDE');
  const inherited = runtime.barrenMatriarchAbilityWheel(s, null); assert.deepEqual(inherited.map(a => a.id), p.combat.playerAbilityWheel.slice(0, 6).map(a => a.id)); for (let i = 0; i < 6; i++) assert(Math.abs(inherited[i].weight - p.combat.playerAbilityWheel[i].weight * 140 / 100) < 1e-10, 'Keep actual Mother predecessor base weights');
  return { kind: 'COMBAT_ROUND', stance: intent.stance, round: s.combat.round, playerCountWheel: p.combat.playerCountWheel, enemyCountWheel: p.combat.enemyCountWheel,
    baseAbilityWheel: p.combat.playerAbilityWheel, actualStanceAbilityWheel: p.combat.playerAbilityWheels[intent.stance], enemyAbilityWheel: p.combat.enemyAbilityWheel };

}
export function lifeAbilityUse(s) {
  const l = s.natureWalker.life;
  return Object.fromEntries(NEW_IDS.map((id, i) => {
    const ids = CASES.filter(key => i === 1 ? key === 'root-impact' : key !== 'root-impact');
    const attempts = ids.flatMap(key => l.cases[key].attempts), tier = a => i === 0 ? a.livingResponseTier : a.rootBearingTier;
    return [id, { paidAttempts: attempts.filter(a => tier(a) !== null).length, castingSuccesses: attempts.filter(a => ['SUCCESS', 'GREAT_SUCCESS'].includes(tier(a))).length,
      actualApplications: attempts.filter(a => a.appliedAbilityIds.includes(id)).length,
      reportedApplications: ids.filter(key => l.cases[key].status === 'RESOLVED').flatMap(key => l.cases[key].attempts).filter(a => a.appliedAbilityIds.includes(id)).length,
      spiritualitySpent: attempts.reduce((n, a) => n + a.spiritualitySpent, 0), mindSpent: attempts.reduce((n, a) => n + a.mindSpent, 0) }];
  }));
}
export function combatAbilityUse(rounds) {
  const actions = rounds.flatMap(r => [...r.natureWalkerOutcome.playerActions, ...r.natureWalkerOutcome.enemyActions]);
  return Object.fromEntries(NEW_IDS.map((id, i) => { const selected = actions.filter(a => a.actor === 'PLAYER' && a.id === id), kind = i === 0 ? 'LIVING_RESPONSE' : 'ROOT_BEARING';
    return [id, { selectedSlots: selected.length, paidAttempts: selected.filter(a => a.paidCost > 0).length, castingSuccesses: selected.filter(a => ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check?.tier)).length, unresistedSuccesses: selected.filter(a => a.succeeded).length,
      resistedAttempts: selected.filter(a => a.resisted).length, preparedWindows: selected.filter(a => a.windowGranted?.kind === kind).length,
      actualApplications: actions.flatMap(a => a.windowsApplied).filter(w => w.kind === kind).length,
      contributionChange: actions.flatMap(a => a.windowsApplied).filter(w => w.kind === kind).reduce((n, w) => n + w.amount, 0),
      masteryApplications: actions.filter(a => a.masteryApplied.includes(id)).length, spiritualitySpent: selected.reduce((n, a) => n + a.paidCost, 0), mindSpent: selected.reduce((n, a) => n + a.mindCost, 0), supportWearPaid: selected.reduce((n, a) => n + a.supportWearPaid, 0) }]; }));
}
// Derive every alias from the actual observed transition, including failures.
export function boundaryAliases(before, intent, after) {
  const names = [], c = intent.type === 'NATURE_WALKER' ? intent.command : null;
  if (before.week !== after.week) names.push('actual-week-finance-settlement');
  if (before.actionsRemaining === 0) names.push('actual-zero-ap-command');
  if (after.status === 'SLICE_COMPLETE') names.push('living-slice-complete');
  if (intent.type === 'CONTINUE_LIFE') names.push('real-living-continue-life');
  if (after.status === 'DEAD') names.push('actual-sealed-player-death');
  if (intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01' && intent.choiceId === 'PAY') names.push('actual-clinic-pay60-same-current-wound');
  if (intent.type === 'ACTION' && intent.action === 'REST' && before.injuries.length > after.injuries.length) names.push('actual-rest-removes-treated-current-wounds');
  if (c?.type === 'CONSUME') names.push(after.progression.sequence === 1 ? 'promotion' : 'actual-potion-failure');
  if (c?.type === 'EXIT_ORIGINAL') names.push('actual-four-metre-original-room-exit');
  if (['INITIALISE_WORKAREA', 'RENT_ANNEX'].includes(c?.type)) names.push('actual-paid-workarea-two-marks-three-pieces');
  if (c && 'caseId' in c) {
    const id = c.caseId, l = after.natureWalker.life, a = l.cases[id].attempts[0];
    if (c.type === 'LIVING_RESPONSE') names.push(`${id}-response-${l.operation.livingResponse ? 'actual-window' : 'actual-failed-window'}`);
    if (c.type === 'ROOT_BEARING') names.push(`${id}-root-bearing-${l.operation.rootBearing ? 'actual-window' : 'actual-failed-window'}`);
    if (['CARE_CHECK', 'ORDINARY_CARE'].includes(c.type)) names.push(`${id}-actual-care-${a.careAssisted ? 'ability-applied' : 'ordinary'}`);
    if (['APPLY_IMPACT', 'ORDINARY_SUPPORT', 'CANCEL_IMPACT'].includes(c.type)) names.push(`${id}-actual-impact-${a.impact.rootBearingApplied ? 'ability-applied' : a.impact.mode.toLowerCase()}`);
    if (c.type === 'WITHDRAW_PERMISSION') names.push(`${id}-fresh-permission-withdrawn-before-care`);
    if (c.type === 'CANCEL_CASE') names.push(`${id}-actual-affordable-cancellation`);
    if (c.type === 'LEAVE') names.push(`${id}-ordinary-closure-${a.result.toLowerCase()}`);
    if (before.natureWalker.life.annex.supportPieces > l.annex.supportPieces) names.push(`${id}-actual-paid-piece-consumption`);
    if (currentPad(after).integrity < currentPad(before).integrity) names.push(`${id}-actual-original-root-pad-wear`);
  }
  if (intent.type === 'COMBAT_ROUND') {
    const o = after.combatHistory.at(-1)?.natureWalkerOutcome; assert(o); const actions = [...o.playerActions, ...o.enemyActions];
    if (actions.some(a => a.selectedAbility === NEW_IDS[0])) names.push('combat-actual-living-response-ordinary-no-plant-fallback');
    if (actions.some(a => a.windowsApplied.some(w => w.kind === 'ROOT_BEARING'))) names.push('combat-actual-root-bearing');
    if (currentPad(after).integrity < currentPad(before).integrity) names.push('combat-actual-original-root-pad-wear');
    if (actions.some(a => a.guardSegmentId)) names.push('combat-actual-original-unused-guard-segment-spent');
    if (intent.stance === 'RETREAT') names.push('actual-script-cap-public-retreat');
    if (!after.combat && after.status !== 'DEAD') names.push('actual-ordinary-encounter-exit');
  }
  return names;
}

class ActualTerminalStop extends Error {}
class FiniteEncounterStop extends Error {}
// Resume only the recorded display-verifier interruption. No alternative state,
// strategy, RNG or gameplay input can be supplied through this recovery path.
export const DISPLAY_INTERRUPTION_SHA = '463f7efe24c8ac727243e868cf1ac297eb56c119bb17fccc63f099d511387bf0';
export function inspectDisplayInterruption(directory, frozen) {
  assert.equal(fileHash(join(directory, 'capture-integrity.json')), DISPLAY_INTERRUPTION_SHA, 'Not the reviewed display interruption');
  const integrity = json(join(directory, 'capture-integrity.json'));
  assert.equal(compactHash(integrity.frozenFiles), integrity.freezeSha256);
  const unchanged = files => files.filter(x => x.file !== 'scripts/play/nature-walker-stage.mjs');
  assert.deepEqual(unchanged(frozen.files), unchanged(integrity.frozenFiles), 'Mechanics or compiled inputs drifted');
  for (const [name, evidence] of Object.entries({ ...integrity.metadata, ...integrity.files })) {
    assert.equal(name, name.split('/').at(-1)); assert(!name.includes('\\')); assert(!lstatSync(join(directory, name)).isSymbolicLink());
    assert.deepEqual(fileEvidence(join(directory, name)), evidence, `Interrupted input changed: ${name}`);
  }
  const natural = json(join(directory, 'natural.json'));
  assert.equal(natural.stage, 'ACTUAL_BLOCKER'); assert.equal(natural.failurePhase, 'AFTER_APPLY_VALIDATION');
  assert.equal(natural.commands.length, 946); assert.equal(natural.pendingIntent, null);
  assert.deepEqual(natural.lastIntent, { type: 'COMBAT_ROUND', stance: 'CONTROL' });
  assert.deepEqual(natural.strategy, STRATEGY); assert.equal(natural.final.status, 'ACTIVE'); assert.equal(natural.final.combat.round, 2);
  assert.equal(stateHash(natural.final), 'c690e25db822a79047df7b6d9d5577ac484977bc5b58b018fd70d3b0db03fa8e');
  return { natural, integrity };
}
export async function runNatural(options) {
  const frozen = inspectFreeze(); assert.equal(frozen.sha256, options.freezeSha256, 'Coordinator freeze mismatch; do not start gameplay');
  const runtime = await loadRuntime(), old = readSource(), originalExpected = migrateCurrent(runtime, old.final);
  const producerSha256 = fileHash(fileURLToPath(import.meta.url)), replayOnly = !!options.replay;
  assert(!(options.resumeCapture && replayOnly));
  const recovery = options.resumeCapture ? inspectDisplayInterruption(realpathSync(options.resumeCapture), frozen) : null;
  if (!replayOnly) mkdirSync('output/play', { recursive: true });
  const outputDir = replayOnly ? realpathSync(options.replay) : mkdtempSync('output/play/nature-walker-02070-');
  if (replayOnly) { const i = json(join(outputDir, 'capture-integrity.json')); assert.equal(i.producerSha256, producerSha256); assert.equal(i.freezeSha256, frozen.sha256); }
  const replayRows = replayOnly ? new Map(['commands.jsonl', 'public.jsonl'].map(name => [name, readJsonLines(join(outputDir, name))])) : null;
  const write = (name, value) => { if (replayOnly) assert.equal(fileHash(join(outputDir, name)), compactHash(value), `Capture-free replay differs: ${name}`); else writeFileSync(join(outputDir, name), JSON.stringify(value), { flag: 'wx' }); };
  const append = (name, value) => { if (replayOnly) { const row = replayRows.get(name).next(); assert.equal(row.done, false); assert.deepEqual(row.value, value, `${name}:${value.step}`); } else appendFileSync(join(outputDir, name), `${JSON.stringify(value)}\n`); };
  if (!replayOnly) for (const name of ['commands.jsonl', 'public.jsonl']) writeFileSync(join(outputDir, name), '', { flag: 'wx' });
  const commands = [], boundaries = {}, boundarySteps = {}, transitions = [], snapshots = {}, treatments = [], captured = new Map(), snapshotSteps = new Map();
  let s = runtime.createSliceRun(old.final.runId, old.creation, old.seed), original = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false, saved = false, failurePhase = 'INITIALIZATION';
  const initial = structuredClone(s), view = () => runtime.projectSliceState(s).natureWalker;
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
    const control = prefixVerified ? publicControl(runtime, s, intent) : { kind: 'IMMUTABLE851_SOURCE_PREFIX', enabled: true };
    const prior = s, beforePublic = prefixVerified ? publicSnapshot(runtime, s) : null; beforeLast = s; lastIntent = structuredClone(intent); failurePhase = 'APPLY';
    s = runtime.applySliceIntent(s, intent); commands.push(structuredClone(intent)); pendingIntent = null; failurePhase = 'AFTER_APPLY_VALIDATION';
    const boundaryKey = prefixVerified ? unusedName(key ?? `step-${commands.length}-${intent.type === 'NATURE_WALKER' ? intent.command.type.toLowerCase() : intent.type.toLowerCase()}`) : null;
    append('commands.jsonl', { step: commands.length, intent, sourcePrefix: commands.length <= PREFIX_COUNT, boundaryKey, before: body(prior), after: body(s) });
    if (prefixVerified) append('public.jsonl', { step: commands.length, revision: prior.revision, command: intent, control, before: beforePublic, after: publicSnapshot(runtime, s) });
    runtime.assertValidSliceState(s); assert.equal(s.revision, prior.revision + 1); assert.equal(s.random.seed, SEED); assert(s.random.cursor >= prior.random.cursor);
    if (prefixVerified) { checkOriginals(runtime, s, original); capture(boundaryKey); for (const name of boundaryAliases(prior, intent, s)) capture(name); }
    failurePhase = 'IDLE'; if (prefixVerified && s.status === 'DEAD') throw new ActualTerminalStop('Actual player death; no continuation, rescue, reroll or state patch');
  }
  const ms = (command, key = null) => go({ type: 'NATURE_WALKER', command }, key);
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
  function ordinary(key = null) { clear(); assert(!view().insideCase && !s.combat && s.natureWalker.preparedWeek === null); go({ type: 'ACTION', action: s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, key); clear(); }
  function ready({ ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
    clear(); assert(!view().insideCase && !s.combat && s.natureWalker.preparedWeek === null); assert(ap <= s.weeklyBudget);
    for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek; n++) { assert(n < STRATEGY.ordinaryPreparationCap, 'Finite real work/rest readiness limit'); ordinary(); }
  }
  function action(command, key = null) { ready(); ms(command, key); clear(); }
  function practice(caseId) {
    ready(STRATEGY.caseReadiness); const before = structuredClone(currentSite(s)); ms({ type: 'OBSERVE', caseId }, `${caseId}-observe-originals-and-new-annex`);
    for (let n = 0; s.natureWalker.life.cases[caseId].status !== 'EXAMINED'; n++) {
      assert(n < STRATEGY.caseCommandCap, 'Finite preferred-case route exhausted');
      const l = view().life, next = l.actions.find(a => a.id === l.preferredActionId && a.preferredAction && a.enabled);
      assert(next, `No enabled public preferred step: ${l.nextStep}`); assert.equal(next.command.caseId, caseId);
      const suffix = 'permission' in next.command ? `-${next.command.permission.toLowerCase()}` : '';
      ms(next.command, `${caseId}-${next.command.type.toLowerCase()}${suffix}`);
    }
    clear(); const l = s.natureWalker.life, a = l.cases[caseId].attempts[0];
    assert.equal(l.cases[caseId].attempts.length, 1); assert(a.closed && a.inspected && a.objectsReturned && a.resultRead);
    assert.equal(currentSite(s).playerLocation, 'OUTSIDE'); assert(currentSite(s).playerTravelMetres > before.playerTravelMetres);
    for (const object of [currentSite(s).paper, currentSite(s).box, currentSite(s).tag, ...currentSite(s).pads]) { assert.equal(object.location, 'OUTSIDE'); assert.equal(object.holder, 'OWNER'); } assert(currentSite(s).samples.every(x => x.location === 'OUTSIDE')); assert.equal(currentSite(s).owner.location, 'OUTSIDE'); assert.equal(currentSite(s).recipient.location, 'OUTSIDE');
    assert.equal(a.effortSpent, 3); assert.equal(a.recipientMindSpent, 1);
    if (caseId === 'withdrawn-care') { assert(a.permissionWithdrawn); assert.equal(a.appliedAbilityIds.length, 0); assert.equal(a.result, 'ORDINARY'); }
    action({ type: 'REPORT', caseId }, `${caseId}-honest-report`); assert.equal(s.natureWalker.life.cases[caseId].status, 'RESOLVED');
  }

  function consume(bottleId) {
    const prior = structuredClone(body(s)), resources = structuredClone(currentResources(s));
    ms({ type: 'CONSUME', bottleId, confirmed: true }, `consume-${bottleId}`);
    const b = s.natureWalker.bottles.find(b => b.id === bottleId); assert.equal(b.status, 'CONSUMED'); assert.equal(s.random.cursor, prior.random.cursor + 1);
    assert.deepEqual(currentResources(s), resources); assert.deepEqual(s.injuries, prior.injuries); assert.equal(s.natureWalker.preparedWeek, null);
    if (s.progression.sequence === 1) { assert.equal(s.health, prior.H); assert.equal(s.spirituality, prior.S); assert.deepEqual(s.progression.mastery, { ...prior.mastery, ...Object.fromEntries(NEW_IDS.map(id => [id, 0])) }); }
    clear();
  }
  function encounter(continuing = false) {
    if (!continuing) { ready(STRATEGY.encounterReadiness); snapshot('beforeEncounter'); ms({ type: 'PREPARE_ENCOUNTER' }, 'paid30-three-independent-combat-support-pieces');
    ms({ type: 'ENCOUNTER_TALK' }, 'original-adults-remain-outside-player-walks-to-new-yard');
    assert.equal(currentSite(s).owner.location, 'OUTSIDE'); assert.equal(currentSite(s).recipient.location, 'OUTSIDE'); assert.equal(currentSite(s).playerLocation, 'ANNEX_A');
    if (s.natureWalker.encounter.policy !== STRATEGY.encounterPolicy) ms({ type: 'SET_COMBAT_POLICY', policy: STRATEGY.encounterPolicy }, 'explicit-all-policy');
    ms({ type: 'ENCOUNTER_FIGHT' }, 'independent-optional-elias-fight'); snapshot('combatStart'); }
    while (s.combat && s.combat.round <= STRATEGY.combatRoundCap) go({ type: 'COMBAT_ROUND', stance: STRATEGY.combatStance }, `combat-round-${s.combat.round}`);
    if (s.combat && runtime.projectSliceState(s).combat?.stances.some(a => a.id === 'RETREAT')) go({ type: 'COMBAT_ROUND', stance: 'RETREAT' }, 'actual-one-public-retreat-at-declared-cap');
    if (s.combat) throw new FiniteEncounterStop('Actual encounter still running at the declared90-round limit; no outcome invented');
    assert(s.natureWalker.encounter.terminal); assert.equal(currentSite(s).playerLocation, 'OUTSIDE'); snapshot('combatTerminal'); clear(); ordinary('ordinary-life-after-actual-exit'); snapshot('livingContinuation');
  }
  function save(stage, error = null) {
    assert(!saved); saved = true; assert.equal(fileHash(SOURCE), SOURCE_SHA); assert.equal(fileHash(PREDECESSOR), PREDECESSOR_SHA); assert.deepEqual(inspectFreeze(), frozen, 'Frozen source/runtime changed during capture');
    const rounds = s.combatHistory.slice(original?.combatHistory.length ?? s.combatHistory.length);
    write('natural.json', { provenance: { kind: 'EXACT851_PUBLIC_BARREN_MATRIARCH_THEN_PUBLIC_NATURE_WALKER', prior: old.provenance, source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final', inheritedDirectedPrefix: false, fullNaturalS9ToS1: s.progression.sequence === 1, newRandomChanges: false },
      producerSha256, freezeSha256: frozen.sha256, strategy: STRATEGY, creation: old.creation, seed: SEED, prefixCount: PREFIX_COUNT, inheritedPrefixCount: INHERITED_COUNT, prefixVerified,
      commands, initial, prefixFinal: original, beforeLast, lastIntent, pendingIntent, failurePhase, snapshots, treatments, stage, error: error ? String(error) : null, final: s });
    write('boundaries.index.json', boundaries); write('boundaries.steps.json', boundarySteps); write('transitions.json', transitions);
    write('summary.json', { stage, producerSha256, freezeSha256: frozen.sha256, strategy: STRATEGY, source: { prefixCount: PREFIX_COUNT, prefixVerified, sourceSha256: SOURCE_SHA, prefixCompactSha256: PREFIX_SHA, migratedWholeSourceSha256: original ? stateHash(original) : null },
      commands: commands.length, final: body(s), originalMastery: original?.progression.mastery ?? null, sourceOriginals: original ? originalResources(original) : null,
      currentOriginals: currentResources(s), life: s.natureWalker.life, lifeAbilityUse: lifeAbilityUse(s), combatAbilityUse: combatAbilityUse(rounds), encounter: s.natureWalker.encounter, rounds,
      bottles: s.natureWalker.bottles, treatments, boundaries: Object.keys(boundaries), uniqueTransitions: transitions.length, snapshots });
    write('capture-integrity.json', { producerSha256, freezeSha256: frozen.sha256, frozenFiles: frozen.files,
      metadata: Object.fromEntries(['natural.json', 'commands.jsonl', 'public.jsonl', 'summary.json', 'boundaries.index.json', 'boundaries.steps.json', 'transitions.json', ...(prefixVerified ? ['source-prefix.json'] : [])].map(name => [name, fileEvidence(join(outputDir, name))])),
      files: Object.fromEntries([...new Set([...Object.values(boundaries), ...Object.values(snapshots)])].map(name => [name, fileEvidence(join(outputDir, name))])) });
    if (replayOnly) for (const [name, rows] of replayRows) assert.equal(rows.next().done, true, `Missing replay rows: ${name}`);
    console.log(JSON.stringify({ outputDir, replayOnly, replayMatched: replayOnly && stage !== 'ACTUAL_BLOCKER', stage, commands: commands.length, namedBoundaries: Object.keys(boundaries).length, uniqueTransitions: transitions.length, status: s.status, sequence: s.progression.sequence, week: s.week }));
  }
  try {
    if (recovery) {
      const n = recovery.natural, from = realpathSync(options.resumeCapture);
      assert.deepEqual(n.initial, initial); assert.deepEqual(n.prefixFinal, originalExpected);
      assert.deepEqual(n.commands.slice(0, PREFIX_COUNT), old.commands);
      const recomputed = runtime.applySliceIntent(n.beforeLast, n.lastIntent);
      assert.deepEqual(recomputed, n.final, 'Interrupted applied round must replay with identical full state and RNG');
      runtime.assertValidSliceState(recomputed);
      commands.push(...n.commands); Object.assign(boundaries, json(join(from, 'boundaries.index.json')));
      Object.assign(boundarySteps, json(join(from, 'boundaries.steps.json')));
      transitions.push(...json(join(from, 'transitions.json'))); Object.assign(snapshots, n.snapshots); treatments.push(...n.treatments);
      for (const t of transitions) captured.set(t.commandIndex, t.file);
      for (const file of new Set(Object.values(snapshots))) snapshotSteps.set(json(join(from, file)).revision - 1, file);
      for (const file of [...Object.keys(recovery.integrity.files), 'source-prefix.json']) linkSync(join(from, file), join(outputDir, file));
      for (const file of ['commands.jsonl', 'public.jsonl']) copyFileSync(join(from, file), join(outputDir, file));
      const commandRows = [...readJsonLines(join(outputDir, 'commands.jsonl'))];
      assert.equal(commandRows.length, 946); assert.deepEqual(commandRows.map(x => x.intent), commands);
      const publicRows = [...readJsonLines(join(outputDir, 'public.jsonl'))];
      assert.equal(publicRows.at(-1).step, 945); assert.equal(publicRows.length, 945 - PREFIX_COUNT);
      s = n.final; original = n.prefixFinal; beforeLast = n.beforeLast; lastIntent = n.lastIntent; prefixVerified = true;
      checkOriginals(runtime, s, original);
      append('public.jsonl', { step: commands.length, revision: beforeLast.revision, command: lastIntent,
        control: publicControl(runtime, beforeLast, lastIntent), before: publicSnapshot(runtime, beforeLast), after: publicSnapshot(runtime, s) });
      capture(commandRows.at(-1).boundaryKey); for (const name of boundaryAliases(beforeLast, lastIntent, s)) capture(name);
      failurePhase = 'IDLE';
      encounter(true); checkOriginals(runtime, s, original); save(STAGES[0]); return;
    }
    assert.deepEqual(s, migrateCurrent(runtime, old.initial)); runtime.assertValidSliceState(s);
    for (const intent of old.commands) { go(intent); if (commands.length === INHERITED_COUNT) { assert.deepEqual(s, migrateCurrent(runtime, old.prefixFinal), 'The whole original674 living predecessor also replays exactly'); assert.deepEqual(s, migrateCurrent(runtime, old.predecessor.final), 'The actual living674 final is the inherited source'); } }
    assert.deepEqual(commands, old.commands); assert.deepEqual(s, originalExpected, 'Full851 replay equals the entire migrated actual living source');
    original = structuredClone(s); prefixVerified = true; checkOriginals(runtime, s, original);
    write('source-prefix.json', { source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final', prefixCount: PREFIX_COUNT, rawInitial: old.initial, rawFinal: old.final, rawInheritedFinal: old.prefixFinal, predecessorSource: PREDECESSOR, predecessorSha256: PREDECESSOR_SHA, inheritedCount: INHERITED_COUNT, inheritedCommandsSha256: INHERITED_SHA, commands: old.commands, rawCommandsSha256: PREFIX_SHA, migratedWholeStateSha256: stateHash(original), inheritedDirectedPrefix: false });
    snapshot('departure'); capture('exact-original851-living-source');
    assert.deepEqual(s.injuries, []); assert.equal(s.health, 100); clear();
    ready({ ap: 1, cash: 500 }); ms({ type: 'LEARN_GUIDANCE' }, 'paid500-guidance-freezes-eight-roots-and-original-pad50-guard'); clear(); snapshot('guidance');
    for (const taskId of ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN']) action({ type: 'PREPARE_TASK', taskId }, `preparation-${taskId.toLowerCase()}`);
    for (let number = 0; s.progression.sequence === 2 && number < STRATEGY.potionAttemptCap; number++) {
      let bottle = s.natureWalker.bottles.find(b => b.status === 'PLAYER') ?? s.natureWalker.bottles.find(b => b.status === 'SUPPLIER');
      if (!bottle) { ready({ ap: 1, cash: 100 }); ms({ type: 'REQUEST_SUPPLY' }, 'paid100-after-all-original-bottles-failed'); const week = s.natureWalker.resupply.requestedWeek; clear(); ready({ afterWeek: week }); ms({ type: 'RECEIVE_SUPPLY' }, 'next-real-week-three-new-bottle-identities'); bottle = s.natureWalker.bottles.find(b => b.status === 'SUPPLIER'); }
      assert(bottle); const id = bottle.id;
      if (bottle.status === 'SUPPLIER') { while (s.natureWalker.bottles.find(b => b.id === id).labourSteps < 5) action({ type: 'POTION_WORK', bottleId: id }, `${id}-actual-labour`); ready({ ap: 0, cash: 1200 }); ms({ type: 'BUY_POTION', bottleId: id }, `paid1200-${id}`); }
      ready({ ap: 1, cash: 180, ...STRATEGY.recovery, afterWeek: s.barrenMatriarch.promotionWeek + 11 });
      ms({ type: 'PREPARE_PROMOTION' }, `paid180-current-week-prepare-${id}`); consume(id);
    }
    if (s.progression.sequence !== 1) save(STAGES[1]);
    else { snapshot('promoted'); ms({ type: 'EXIT_ORIGINAL' }, 'walk-four-metres-to-actual-outside'); ready(STRATEGY.annexReadiness); ms({ type: 'INITIALISE_WORKAREA' }, 'pay40-place-two-marks-and-three-finite-pieces'); clear(); for (const id of CASES) practice(id); action({ type: 'REFLECT' }, 'three-honest-reports-reflected'); assert.equal(s.progression.acting, 100); snapshot('practiced'); encounter(); checkOriginals(runtime, s, original); save(STAGES[0]); }
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
      else { assert(['--freeze-sha256', '--replay', '--resume-capture'].includes(key), `Unknown option: ${key}`); assert(args[i + 1] && !args[i + 1].startsWith('--')); options[key === '--replay' ? 'replay' : key === '--resume-capture' ? 'resumeCapture' : 'freezeSha256'] = args[++i]; }
    }
    if (options.help) console.log('Coordinator only, after source and compiled mechanics freeze:\nnode scripts/play/nature-walker-stage.mjs --inspect-freeze\nnode --max-old-space-size=768 scripts/play/nature-walker-stage.mjs --freeze-sha256 REVIEWED_HASH\nnode --max-old-space-size=768 scripts/play/nature-walker-stage.mjs --freeze-sha256 REVIEWED_HASH --replay EXISTING_CAPTURE_DIR');
    else if (options['inspect-freeze']) { assert.equal(args.length, 1); console.log(JSON.stringify(inspectFreeze())); }
    else { assert.match(options.freezeSha256 ?? '', /^[0-9a-f]{64}$/, 'Explicit coordinator freeze hash is required before natural gameplay'); assert.equal(realpathSync(fileURLToPath(import.meta.url)), realpathSync('scripts/play/nature-walker-stage.mjs')); await runNatural(options); }
  } catch (error) { console.error(error); process.exitCode = 1; }
}
