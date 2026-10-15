import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';

// Static candidate only. The serial lead compiles, then runs from the repository root:
// node --max-old-space-size=512 scripts/play/glory-stage.mjs
// The source S3 setup is DIRECTED. Replay its exact startingState and all 70 public
// commands, verify full migrated equality, then continue with public commands only.
// Never change seed/cursor, reload for success, resurrect an old death, refill an
// object, or claim a natural S9-to-S2 route. Output stays unique until lead review.
const load = name => import(pathToFileURL(resolve(`dist/domain/${name}.js`)).href);
const { applySliceIntent, projectSliceState, assertValidSliceState } = await load('slice/index');
const { migrateSliceState } = await load('slice/migration');
const { validateSlicePayload } = await load('slice/validation');
const { projectGlory } = await load('glory/index');
const sourceFixture = 'tests/fixtures/silver-knight-v01520/directed.json';
const preservedSourceFixtures = [
  'tests/fixtures/silver-knight-v01520/natural.json',
  'tests/fixtures/preparation-audit-v01630/silver-natural.json',
  'tests/fixtures/preparation-audit-v01630/silver-v2-natural.json',
];
const old = Object.fromEntries(['provenance', 'startingState', 'commands', 'final'].map(key => [key, readObjectEntry(sourceFixture, key)]));
const provenance = old.provenance, seed = old.startingState.random.seed, prefixCount = old.commands.length;
const continuation = {
  kind: 'DIRECTED_SILVER_KNIGHT_PREFIX_THEN_PUBLIC_GLORY', sourceFixture, preservedSourceFixtures,
  prefixStartingPoint: 'Original directed startingState', exactPublicPrefixCommands: 70,
  sourceS3Setup: 'DIRECTED', fullNaturalS9ToS2: false, newRandomChanges: false,
  policy: 'One public continuation from the original directed S3 history. Actual clinic and later rest; finite ordinary work/rest and independent bottles. Three one-shot cases with ordinary fallback; one optional fight, DEFEND/CONTROL/ATTACK cycle, permanent RETREAT at H<=40 or first new HEAVY injury, at most 90 rounds. No rerun for a better outcome.',
};
const sourcePreservation = [sourceFixture, ...preservedSourceFixtures].map(file => ({ file, sha256: fileDigest(file) }));
const preservedSourceFacts = preservedSourceFixtures.map(file => {
  const final = readObjectEntry(file, 'final');
  return { file, commands: readObjectEntry(file, 'commands').length, status: final.status, week: final.week,
    health: final.health, sequence: final.progression.sequence, random: final.random };
});
const CASES = ['armor-temper', 'close-guard', 'revoked-crossing'];
const NEW_IDS = ['warrior.s2.armor-temper', 'warrior.s2.close-guard'];
const OLD_ROOTS = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter', 'silverKnight'];
const MAX_COMMANDS = 3500, MAX_BOTTLES = 12, MAX_ROUNDS = 90;
const commands = [], boundaries = {}, boundarySteps = {}, snapshots = {}, treatments = [];
const capturedSteps = new Map(), uniqueTransitions = [];
let s = null, initial = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false;
let legacy = null, attemptedState = null;
const combatEvidence = [];
let retreatCommitted = false;
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/glory-01760-');
const commandsFile = `${outputDir}/commands.jsonl`, publicFile = `${outputDir}/public-compact.jsonl`;
writeFileSync(commandsFile, '', { flag: 'wx' }); writeFileSync(publicFile, '', { flag: 'wx' });
const write = (path, value) => writeFileSync(path, JSON.stringify(value), { flag: 'wx' });
const append = (path, value) => appendFileSync(path, `${JSON.stringify(value)}\n`);
const pub = () => projectSliceState(s), view = () => projectGlory(s);
const life = () => s.glory.life, attempt = id => life().cases[id].attempts.at(-1);
const success = tier => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
function snapshot(key) {
  assert(!snapshots[key], `Snapshot already captured: ${key}`);
  const path = `${outputDir}/snapshot-${key}.json`; write(path, s); snapshots[key] = path;
}
function compact() {
  const p = view(), a = p.life.currentAttempt, site = life().site;
  const round = s.combat?.lastRound ?? s.lastCombatRound, result = round?.gloryOutcome;
  return { revision: s.revision, week: s.week, date: s.date, status: s.status, H: s.health, M: s.mind, S: s.spirituality,
    pollution: s.seer.pollution, cash: s.cash, AP: s.actionsRemaining, sequence: s.progression.sequence, acting: s.progression.acting,
    activeEvent: s.activeEvent?.instanceId ?? null, injuryRisk: s.injuryRisk, injuries: s.injuries,
    life: { activeCase: life().activeCase, location: site.playerLocation, energy: site.playerEnergy, travelMetres: site.playerTravelMetres, clockSeconds: site.clockSeconds,
      tier: a?.abilityTier ?? null, applied: a?.appliedAbilityIds ?? [], oldHistoricalArmor: s.silverKnight.life.armor,
      sameCurrentArmor: site.armor, armorWorn: site.armorWorn, pads: site.pads, load: site.load, bridge: site.bridge, guard: site.guard,
      adults: { celia: site.celia, evan: site.evan } },
    encounter: { status: p.encounter.status, enemy: p.encounter.enemy, lastRound: round ? { round: round.round, stance: round.stance, winner: round.winner, retreat: round.retreat,
      glory: result ? { playerHealthAfter: result.playerHealthAfter, enemyHealth: result.enemyHealth, playerSpiritualityAfter: result.playerSpiritualityAfter,
        enemySpirituality: result.enemySpirituality, continuing: result.continuing, armorWear: result.armorWear, armorIntegrityAfter: result.armorIntegrityAfter,
        healthPaid: result.healthPaid, armorApplications: result.playerActions.filter(x => x.id === NEW_IDS[0]).map(x => ({ attempted: x.attempted, succeeded: x.succeeded,
          applied: x.applied, appliedAmount: x.appliedAmount, consumedByOrder: x.chargeConsumedByOrder, cancelledByOrder: x.chargeCancelledByOrder })),
        expiredArmorOrder: result.expiredArmorOrder, expiredGuardOrder: result.expiredGuardOrder } : null } : null } };
}
function capture(key) {
  assert(prefixVerified, 'New boundaries require the verified complete 70-command directed original prefix');
  let unique = key, suffix = 2; while (boundaries[unique]) unique = `${key}-${suffix++}`;
  let name = capturedSteps.get(commands.length);
  if (!name) {
    name = `${unique}.json`; write(`${outputDir}/${name}`, { beforeLast, lastIntent, final: s });
    capturedSteps.set(commands.length, name);
    uniqueTransitions.push({ key: unique, file: name, commandIndex: commands.length, beforeRevision: beforeLast.revision, afterRevision: s.revision });
  }
  boundaries[unique] = name; boundarySteps[unique] = commands.length;
}
function go(intent, boundary = null) {
  pendingIntent = structuredClone(intent);
  assert(validateSlicePayload(intent), `Strict public payload rejected: ${JSON.stringify(intent)}`);
  assert(commands.length < MAX_COMMANDS, 'Finite public strategy exhausted; retain the actual state and pending command');
  if (prefixVerified && intent.type === 'ACTION') {
    const p = pub(); assert(p.canAct, p.actionBlockedReason ?? 'Ordinary world action unavailable');
    assert(!view().insideCase && !s.combat, 'Never perform world WORK/REST inside a locked current scene');
    if (intent.action === 'INVESTIGATE') assert(p.investigateTargets.some(t => t.id === intent.targetId), `Missing public investigation ${intent.targetId}`);
  }
  if (prefixVerified && intent.type === 'EVENT_CHOICE') {
    const event = pub().activeEvent;
    assert(event && s.activeEvent.instanceId === intent.eventInstanceId, 'Only the actual current public event may be chosen');
    assert(event.choices.some(c => c.id === intent.choiceId && c.enabled), `Disabled public event choice ${event.id}/${intent.choiceId}`);
  }
  if (prefixVerified && intent.type === 'COMBAT_ROUND') {
    assert(pub().combat?.stances.some(stance => stance.id === intent.stance), `Missing public combat stance ${intent.stance}`);
  }
  beforeLast = s; lastIntent = structuredClone(intent);
  const next = applySliceIntent(s, intent); attemptedState = next; assertValidSliceState(next);
  assert.equal(next.random.seed, seed); assert(next.random.cursor >= s.random.cursor);
  assert.equal(next.revision, s.revision + 1);
  s = next; commands.push(structuredClone(intent)); pendingIntent = null; attemptedState = null;
  append(commandsFile, { index: commands.length, prefix: !prefixVerified, intent, revisionBefore: beforeLast.revision, revisionAfter: s.revision, randomBefore: beforeLast.random, randomAfter: s.random });
  if (prefixVerified) {
    const record = { index: commands.length, intent, public: compact() }; append(publicFile, record);
    if (boundary) capture(boundary);
    if (boundary || intent.type === 'ACTION' || intent.type === 'COMBAT_ROUND') console.log(JSON.stringify(record));
  }
}
function gl(command, boundary = null) {
  pendingIntent = { type: 'GLORY', command: structuredClone(command) };
  const action = view().actions.find(a => isDeepStrictEqual(a.command, command));
  assert(action, `Not a current public GLORY action: ${JSON.stringify(command)}`); assert(action.enabled, action.reason);
  go({ type: 'GLORY', command }, boundary);
}
function clear() {
  for (let count = 0; s.activeEvent && count < 30; count++) {
    const event = pub().activeEvent;
    const choiceId = event.id.startsWith('ORIGIN') ? '.decline' : event.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : event.id === 'DEBT-NOTICE-01' ? 'DECLINE' : event.id === 'DEBT-SETTLE-01' ? 'DEFER'
      : event.id === 'LIFE-CARE-01' ? 'PAY' : event.id === 'CARE-WORK-OFFER' ? 'DECLINE' : null;
    assert(choiceId, `Unexpected current public event ${event.id}; preserve its actual pending choices`);
    assert(event.choices.some(c => c.id === choiceId && c.enabled), `Unavailable public choice ${event.id}/${choiceId}`);
    const before = event.id === 'LIFE-CARE-01' ? { cash: s.cash, health: s.health, risk: s.injuryRisk, week: s.week, revision: s.revision, injuries: structuredClone(s.injuries) } : null;
    go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId }, before ? 'clinic-actual-pay60' : null);
    if (before) {
      assert(s.cash <= before.cash - 60, 'The actual treatment fee and any actual weekly charge must remain paid');
      assert.equal(s.health, before.health, 'Paying the doctor does not heal the body'); assert.equal(s.injuryRisk, before.risk);
      for (const injury of before.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) {
        const treated = s.injuries.find(i => i.id === injury.id); assert(treated, 'Original wound must remain immediately after treatment');
        assert.equal(treated.treatedRevision, before.revision + 1); assert.equal(treated.acquiredRevision, injury.acquiredRevision);
      }
      treatments.push({ paidPennies: 60, before, cashAfter: s.cash, healthAfter: s.health, injuriesAfter: structuredClone(s.injuries) });
      assertLegacyPreserved();
    }
  }
  assert.equal(s.activeEvent, null, 'Actual shared event chain still pending'); assert.equal(s.pulse, 'NONE');
}
function ordinary(boundary = null, forceRest = false) {
  clear(); assert.equal(s.status, 'ACTIVE', 'Ordinary death is final');
  assert(!s.combat && !view().insideCase, 'No world rest while a real scene is locked');
  assert(s.actionsRemaining > 0, 'No ordinary AP or unresolved weekly settlement');
  // This inherited route still uses the ordinary shared world week. Do not use
  // a post-cycle ERA or synthetic NEXT_WEEK command.
  go({ type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week ? 'REST' : 'WORK' }, boundary); clear();
}
function ready({ cash = 0, ap = 1, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
  clear(); assert(ap <= s.weeklyBudget, `Need ${ap} AP but actual weekly budget is ${s.weeklyBudget}`);
  let count = 0;
  while (s.cash < cash || s.actionsRemaining < ap || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek) {
    assert(count++ < 1000, 'Finite ordinary work/rest preparation exhausted'); ordinary();
  }
}
function action(command, boundary = null) { ready(); gl(command, boundary); clear(); }
function assertLegacyPreserved() {
  assert(legacy, 'Original directed prefix must be verified first');
  assert.equal(s.runId, old.final.runId); assert.equal(s.random.seed, seed);
  for (const field of ['name', 'gender', 'age']) assert.equal(s.character[field], old.final.character[field], `Original player ${field}`);
  assert.equal(s.progression.promotionWeek, old.final.progression.promotionWeek, 'Earliest original promotion date is history');
  for (const key of OLD_ROOTS) assert.deepEqual(s[key], legacy[key], `Keep every original ${key} history/person/object fact`);
  assert.deepEqual(s.combatHistory.slice(0, old.final.combatHistory.length), old.final.combatHistory, 'Original wounds, deaths and combat rounds remain history');
  assert.deepEqual(s.seer.completedSources.slice(0, old.final.seer.completedSources.length), old.final.seer.completedSources);
  for (const [id, mastery] of Object.entries(old.final.progression.mastery)) assert.equal(s.progression.mastery[id], mastery, `Original mastery ${id}`);
  assert.equal(Object.keys(s.progression.mastery).length, s.progression.sequence === 2 ? 20 : 18);
  assert.equal(s.silverKnight.life.armor.id, 'SK3-LIFE-ARMOR'); assert.equal(s.silverKnight.life.armor.integrity, 65);
  if (life().site.armorSource) {
    assert.deepEqual(life().site.armorSource.snapshot, old.final.silverKnight.life.armor);
    assert.equal(life().site.armor.id, 'SK3-LIFE-ARMOR'); assert.equal(life().site.armor.owner, 'PLAYER');
    assert(life().site.armor.integrity <= 65, 'Subsequent wear cannot repair the old armor');
  }
}
function recoverOriginalInjuries() {
  assert.equal(s.health, 30); assert.equal(s.injuryRisk, 2); assert.equal(s.careKnown, false);
  assert.equal(s.injuries.length, 3); assert.equal(s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length, 2);
  assert.equal(s.injuries.filter(i => i.severity === 'LIGHT').length, 1);
  ready({ cash: 60, ap: 2 });
  const before = { health: s.health, cash: s.cash, injuries: structuredClone(s.injuries) };
  go({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, 'clinic-actual-discovery');
  assert.equal(s.careKnown, true); assert.equal(s.health, before.health); assert.equal(s.cash, before.cash); assert.deepEqual(s.injuries, before.injuries); clear();
  let count = 0;
  while (s.injuries.length) {
    assert(count++ < 20, 'Actual treatment/recovery did not finish; never silently remove original wounds');
    const untreated = s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null);
    ready({ cash: untreated ? 60 : 0 });
    ordinary(untreated ? 'clinic-invitation-actual-rest' : 'treated-injuries-subsequent-rest', true);
  }
  assert.equal(treatments.length, 1);
  assert.equal(treatments[0].before.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length, 2);
  assert.equal(s.injuryRisk, 0); assert(s.health >= 80); assertLegacyPreserved(); capture('clinic-all-three-original-wounds-healed');
}
function assertOriginalSiteIdentities(original) {
  const p = life().site;
  assert.equal(p.siteId, original.siteId);
  if (original.introducedWeek !== null) { assert.equal(p.introducedWeek, original.introducedWeek); assert.deepEqual(p.introducedDate, original.introducedDate); }
  for (const actor of ['celia', 'evan']) for (const field of ['id', 'name', 'age', 'alive']) assert.deepEqual(p[actor][field], original[actor][field], `Original ${actor}/${field}`);
  for (const object of ['pads', 'load']) for (const field of ['id', 'ownerId']) assert.deepEqual(p[object][field], original[object][field], `Original ${object}/${field}`);
  for (const field of ['id', 'from', 'to', 'metres', 'sidePathMetres', 'ordinaryPath']) assert.equal(p.bridge[field], original.bridge[field]);
  if (original.armorSource) assert.deepEqual(p.armorSource, original.armorSource);
  assert(p.playerEnergy <= original.playerEnergy, 'Changing cases or ordinary weekly rest cannot refill finite room energy');
  assert(p.pads.consumed >= original.pads.consumed); assert(p.load.remainingLoads <= original.load.remainingLoads);
}
function practice(caseId) {
  const original = structuredClone(life().site);
  action({ type: 'OBSERVE', caseId }, `${caseId}-actual-original-observation`);
  assert.equal(life().site.playerLocation, 'ENTRY'); assert.equal(life().site.playerTravelMetres, original.playerTravelMetres + 4);
  assert.equal(life().site.playerEnergy, original.playerEnergy - 4);
  assert.deepEqual(life().site.armorSource.snapshot, old.final.silverKnight.life.armor);
  // Observation is unlocked. Restore ordinary AP before new same-week consent;
  // never change the finite room energy or the same original armor to do so.
  ready({ cash: 20, ap: 2, health: 100, mind: 100, spirituality: 12, pollution: 0 });
  const step = (type, boundary = null) => gl({ type, caseId }, boundary);
  const walk = (to, boundary = null) => gl({ type: 'WALK', caseId, to }, boundary);
  step('CONSENT_OPERATOR'); step('CONSENT_OWNER', `${caseId}-both-current-consents`);
  assert.equal(life().cases[caseId].operatorConsentWeek, s.week); assert.equal(life().cases[caseId].ownerConsentWeek, s.week);
  const prep = { cash: s.cash, ap: s.actionsRemaining, week: s.week, energy: life().site.playerEnergy, plates: life().site.plates.length };
  gl({ type: 'PREPARE', caseId, method: 'ABILITY' }, `${caseId}-paid20-original-plate`);
  assert.equal(s.cash, prep.cash - 20); assert.equal(s.actionsRemaining, prep.ap - 1); assert.equal(s.week, prep.week);
  assert.equal(life().site.playerLocation, 'BENCH'); assert.equal(life().site.playerEnergy, prep.energy - 2);
  assert.equal(life().site.plates.length, prep.plates + 1); assert.equal(attempt(caseId).operatorConsent, 'GRANTED'); assert.equal(attempt(caseId).ownerConsent, 'GRANTED');
  if (caseId === 'armor-temper') {
    assert.equal(life().site.pads.remaining, 2); assert.equal(life().site.pads.consumed, 0); assert.equal(life().site.load.remainingLoads, 1);
    step('WEAR_PAD', 'armor-actual-original-pads-and-same-armor-worn');
    const cost = { S: s.spirituality, ap: s.actionsRemaining, cursor: s.random.cursor, armor: life().site.armor.integrity };
    step('TEMPER_ARMOR', 'armor-paid6-single-actual-check');
    assert.equal(s.spirituality, cost.S - 6); assert.equal(s.actionsRemaining, cost.ap - 1); assert.equal(s.random.cursor, cost.cursor + 1);
    assert.equal(life().site.armor.integrity, cost.armor, 'A successful preparation has not yet taken a physical load');
    const applied = success(attempt(caseId).abilityTier);
    step('APPLY_LOAD', applied ? 'armor-actual-load-wear5-and-pad-consumption' : 'armor-failed-check-ordinary-pad-load');
    assert.equal(life().site.pads.remaining, 1); assert.equal(life().site.pads.consumed, 1); assert.equal(life().site.load.remainingLoads, 0); assert.equal(life().site.load.appliedLoads, 1);
    assert.equal(life().site.armor.integrity, cost.armor - (applied ? 5 : 0)); assert.equal(attempt(caseId).armorWear, applied ? 5 : 0);
    assert.deepEqual(attempt(caseId).appliedAbilityIds, applied ? [NEW_IDS[0]] : []);
    step('STOP'); step('REMOVE_PAD', 'armor-actual-pad-return-no-free-refill');
    assert.equal(life().site.pads.location, 'BENCH'); assert.equal(life().site.armorWorn, false);
  } else if (caseId === 'close-guard') {
    const cost = { S: s.spirituality, H: s.health, ap: s.actionsRemaining, cursor: s.random.cursor, energy: life().site.playerEnergy,
      playerTravel: life().site.playerTravelMetres, actorEnergy: life().site.evan.energy, actorTravel: life().site.evan.travelMetres };
    step('RAISE_GUARD', 'guard-paid6-single-actual-check');
    assert.equal(s.spirituality, cost.S - 6); assert.equal(s.actionsRemaining, cost.ap - 1); assert.equal(s.random.cursor, cost.cursor + 1);
    assert.equal(s.health, cost.H, 'Preparation alone does not fabricate a personal burden');
    const applied = success(attempt(caseId).abilityTier);
    step(applied ? 'CROSS_BRIDGE' : 'ORDINARY_CROSS', applied ? 'guard-actual-six-metre-crossing-personal5H5energy' : 'guard-failed-check-ordinary-eight-metre-crossing');
    assert.equal(s.health, cost.H - (applied ? 5 : 0)); assert.equal(life().site.playerEnergy, cost.energy - (applied ? 11 : 8));
    assert.equal(life().site.playerTravelMetres, cost.playerTravel + (applied ? 6 : 8)); assert.equal(life().site.evan.travelMetres, cost.actorTravel + (applied ? 6 : 8));
    assert.equal(life().site.evan.energy, cost.actorEnergy - (applied ? 6 : 8)); assert.equal(life().site.evan.location, 'BRIDGE'); assert.equal(life().site.playerLocation, 'BRIDGE');
    assert.equal(attempt(caseId).healthSpent, applied ? 5 : 0); assert.equal(life().site.guard.sharedHealth, applied ? 5 : 0); assert.equal(life().site.guard.sharedEnergy, applied ? 5 : 0);
    assert.deepEqual(attempt(caseId).appliedAbilityIds, applied ? [NEW_IDS[1]] : []);
    step('RETURN_ACTOR', 'guard-original-adult-and-player-actual-eight-metre-return'); step('STOP');
    assert.equal(life().site.evan.location, 'BENCH'); assert.equal(life().site.evan.travelMetres, cost.actorTravel + (applied ? 14 : 16));
  } else {
    const before = { random: structuredClone(s.random), S: s.spirituality, H: s.health, energy: life().site.playerEnergy,
      actorEnergy: life().site.celia.energy, actorTravel: life().site.celia.travelMetres, armor: structuredClone(life().site.armor), pads: structuredClone(life().site.pads) };
    step('WITHDRAW_PERMISSION', 'revoked-current-owner-withdrawal-after-paid-preparation'); step('STOP', 'revoked-actual-stop-no-forced-ability');
    assert.equal(attempt(caseId).ownerConsent, 'WITHDRAWN'); assert.equal(attempt(caseId).routeConsent, 'GRANTED');
    step('ORDINARY_CROSS', 'revoked-consenting-original-adult-ordinary-sidepath'); step('RETURN_ACTOR', 'revoked-actual-original-adult-return');
    assert.equal(attempt(caseId).abilityTier, null); assert.deepEqual(attempt(caseId).appliedAbilityIds, []);
    assert.equal(s.spirituality, before.S); assert.equal(s.health, before.H); assert.deepEqual(s.random, before.random);
    assert.equal(life().site.playerEnergy, before.energy - 16); assert.equal(life().site.celia.energy, before.actorEnergy - 16); assert.equal(life().site.celia.travelMetres, before.actorTravel + 16);
    assert.deepEqual(life().site.armor, before.armor); assert.deepEqual(life().site.pads, before.pads);
    assert.equal(life().site.plates.find(p => p.caseId === caseId).charges, 1, 'Withdrawn original plate remains unused');
  }
  step('RETURN_PLATE', `${caseId}-actual-original-plate-return`); walk('ENTRY', `${caseId}-actual-ordinary-return`);
  step('INSPECT'); step('LEAVE', `${caseId}-closed-original-site`); clear();
  const beforeMastery = structuredClone(s.progression.mastery), acting = s.progression.acting;
  action({ type: 'REPORT', caseId }, `${caseId}-report-actual-application-only`);
  assert.equal(life().cases[caseId].status, 'RESOLVED'); assert.equal(attempt(caseId).closed, true); assert.equal(s.progression.acting, acting + 25);
  assert.equal(life().site.playerLocation, 'ENTRY'); assert.equal(life().site.celia.location, 'BENCH'); assert.equal(life().site.evan.location, 'BENCH');
  assert(life().site.plates.every(plate => plate.location === 'BENCH')); assert.equal(life().site.temper.active, false); assert.equal(life().site.guard.active, false);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], beforeMastery[id] + (attempt(caseId).appliedAbilityIds.includes(id) ? 8 : 0));
  assertLegacyPreserved(); assertOriginalSiteIdentities(original);
}
function recordCombatEvidence() {
  const round = s.lastCombatRound, o = round.gloryOutcome; assert(o, 'Actual combat must expose its own Glory outcome');
  assert.equal(round.consequenceDomain, 'BODY'); assert.equal(o.targetId, 'GL2-MARTIN'); assert.equal(o.source.thirdPartiesInArea, 0);
  assert.equal(o.source.randomSeed, seed); assert.equal(o.source.randomCursor, beforeLast.random.cursor);
  assert.equal(o.pendingArmorAfter, false); assert.equal(o.pendingGuardAfter, false);
  assert.equal(o.armorWear, o.enemyActions.reduce((n, a) => n + a.armorWear, 0));
  assert.equal(o.armorIntegrityAfter, o.source.armorIntegrity - o.armorWear); assert.equal(life().site.armor.integrity, o.armorIntegrityAfter);
  assert.equal(o.healthPaid, o.playerActions.reduce((n, a) => n + a.healthPaid, 0));
  assert.equal(o.playerSpiritualityAfter, o.playerSpiritualityBefore - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
  assert.equal(o.enemySpirituality, o.enemySpiritualityBefore - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
  const armor = o.playerActions.filter(a => a.id === NEW_IDS[0]), bearing = o.playerActions.filter(a => a.id === NEW_IDS[1]);
  for (const a of armor) {
    if (a.chargeConsumedByOrder !== null) {
      const hit = o.enemyActions.find(x => x.order === a.chargeConsumedByOrder);
      assert(hit && hit.order > a.order && hit.attackKind === 'BODY' && hit.consumedArmorOrder === a.order);
      assert.equal(a.appliedAmount, 45); assert.equal(hit.armorWear, 5);
    } else { assert.equal(a.appliedAmount, 0); assert.equal(a.applied, false); }
    if (a.chargeCancelledByOrder !== null) {
      const cancellation = o.enemyActions.find(x => x.order === a.chargeCancelledByOrder);
      assert(cancellation && cancellation.order > a.order && cancellation.actual === 'DISCERN');
      assert.equal(a.chargeConsumedByOrder, null); assert.equal(a.appliedAmount, 0);
    }
  }
  for (const a of bearing) { assert.equal(a.threatens, false); assert.equal(a.healthPaid, a.applied ? 5 : 0); assert.equal(a.appliedAmount, a.applied ? 30 : 0); }
  if (round.stance === 'DEFEND') for (const a of o.playerActions) assert.equal(a.threatens, false, 'Whole DEFEND round cannot attack');
  combatEvidence.push({ round: round.round, stance: round.stance, winner: round.winner, retreat: round.retreat, continuing: o.continuing,
    playerH: o.playerHealthAfter, playerS: o.playerSpiritualityAfter, enemyH: o.enemyHealth, enemyS: o.enemySpirituality,
    armorAttempts: armor.filter(a => a.attempted).length, armorSuccesses: armor.filter(a => a.succeeded).length,
    armorApplications: armor.filter(a => a.applied).map(a => ({ order: a.order, consumedByOrder: a.chargeConsumedByOrder, actualReduction: a.appliedAmount })),
    armorCancelled: armor.filter(a => a.chargeCancelledByOrder !== null).map(a => ({ order: a.order, cancelledByOrder: a.chargeCancelledByOrder })),
    armorExpiredOrder: o.expiredArmorOrder, armorWear: o.armorWear, armorIntegrity: o.armorIntegrityAfter,
    bearingAttempts: bearing.filter(a => a.attempted).length, bearingSuccesses: bearing.filter(a => a.succeeded).length,
    actualPersonalBurdenHealth: o.healthPaid, actualDefensiveAdvantage: bearing.reduce((n, a) => n + a.appliedAmount, 0),
    guardConsumptions: o.enemyActions.filter(a => a.chargeConsumedByOrder !== null).map(a => ({ order: a.order, consumedByOrder: a.chargeConsumedByOrder, actualReduction: a.appliedAmount })),
    guardExpiredOrder: o.expiredGuardOrder, playerPaidS: o.playerActions.reduce((n, a) => n + a.paidCost, 0), enemyPaidS: o.enemyActions.reduce((n, a) => n + a.paidCost, 0),
    ordinaryFallbacks: o.playerActions.filter(a => a.fallback !== 'NONE').map(a => ({ order: a.order, id: a.id, fallback: a.fallback })) });
}
function appendFileBytes(destination, source) {
  const fd = openSync(source, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; appendFileSync(destination, buffer.subarray(0, count)); } } finally { closeSync(fd); }
}
function writeNatural(stage, error = null) {
  const path = `${outputDir}/${error ? 'blocker' : 'natural'}.json`;
  writeFileSync(path, '{', { flag: 'wx' }); let first = true;
  const property = (key, value, file = null) => { appendFileSync(path, `${first ? '' : ','}${JSON.stringify(key)}:`); first = false; if (file) appendFileBytes(path, file); else appendFileSync(path, JSON.stringify(value)); };
  for (const [key, value] of Object.entries({ provenance, continuation, seed, startingState: old.startingState, initial, commands, prefixCount, stage,
    sourceFixture, preservedSourceFixtures, sourcePreservation, preservedSourceFacts, prefixVerified })) property(key, value);
  for (const key of ['departureStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart']) property(key, null, snapshots[key] ?? null);
  property('beforeLast', beforeLast); property('lastIntent', lastIntent); property('final', s); property('treatments', treatments); property('combatEvidence', combatEvidence);
  property('boundaryIndex', 'boundaries.index.json'); property('uniqueTransitions', 'boundaries.unique.json');
  if (error) { property('pendingIntent', pendingIntent); property('attemptedState', attemptedState); property('error', String(error)); property('stack', error.stack ?? null); }
  appendFileSync(path, '}'); return path;
}
function writeIndices(prefix = '') {
  write(`${outputDir}/${prefix}boundaries.index.json`, boundaries); write(`${outputDir}/${prefix}boundaries.steps.json`, boundarySteps);
  write(`${outputDir}/${prefix}boundaries.unique.json`, uniqueTransitions);
}
function save(stage) {
  const naturalPath = writeNatural(stage); writeIndices();
  const summary = { stage, outputDir, sourceFixture, preservedSourceFixtures, provenance, continuation, sourcePreservation, preservedSourceFacts,
    prefixCount, commands: commands.length, prefixVerified, week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution, cash: s.cash, actionsRemaining: s.actionsRemaining,
    random: s.random, injuries: s.injuries, injuryRisk: s.injuryRisk, mastery: s.progression.mastery, treatments,
    bottles: s.glory.bottles.map(b => ({ id: b.id, status: b.status, labourSteps: b.labourSteps, outcome: b.outcome, acquiredWeek: b.acquiredWeek, consumedWeek: b.consumedWeek })),
    cases: CASES.map(id => ({ id, ...life().cases[id] })), lifeActuals: { abilityAttempts: CASES.filter(id => attempt(id).abilityTier !== null).length,
      abilitySuccesses: CASES.filter(id => success(attempt(id).abilityTier)).length, applications: CASES.flatMap(id => attempt(id).appliedAbilityIds),
      armorHistoricalIntegrity: old.final.silverKnight.life.armor.integrity, armorLifeWear: CASES.reduce((n, id) => n + attempt(id).armorWear, 0),
      personalBurdenHealth: life().site.guard.sharedHealth, personalBurdenEnergy: life().site.guard.sharedEnergy, padsConsumed: life().site.pads.consumed,
      padsRemaining: life().site.pads.remaining, bridgeCrossings: life().site.bridge.crossings, ordinaryCrossings: life().site.bridge.ordinaryCrossings },
    site: life().site, encounter: s.glory.encounter, combatEvidence, combatActuals: { rounds: combatEvidence.length,
      armorApplications: combatEvidence.reduce((n, r) => n + r.armorApplications.length, 0), actualArmorReduction: combatEvidence.reduce((n, r) => n + r.armorApplications.reduce((m, a) => m + a.actualReduction, 0), 0),
      armorWear: combatEvidence.reduce((n, r) => n + r.armorWear, 0), personalBurdenHealth: combatEvidence.reduce((n, r) => n + r.actualPersonalBurdenHealth, 0),
      personalDefensiveAdvantage: combatEvidence.reduce((n, r) => n + r.actualDefensiveAdvantage, 0) },
    boundaries: Object.keys(boundaries).length, uniqueTransitions: uniqueTransitions.length, legacyPreserved: true, originalSourcesBytePreserved: true };
  write(`${outputDir}/summary.json`, summary);
  // The producer does not publish or replace authoritative fixtures. Only the
  // serial lead may review and copy this exact successful directory afterward.
  console.log(JSON.stringify({ passed: true, stage, outputDir, naturalPath, commands: commands.length, prefixCount,
    boundaries: Object.keys(boundaries).length, uniqueTransitions: uniqueTransitions.length, summary: `${outputDir}/summary.json` }));
}
try {
  assert.equal(prefixCount, 70); assert.equal(old.final.status, 'ACTIVE'); assert.equal(seed, 'warrior-natural-v042');
  assert.equal(typeof provenance, 'string'); assert(provenance.startsWith('DIRECTED:'), 'Never relabel the original selected S3 setup as natural');
  assert.deepEqual(preservedSourceFacts.map(f => f.commands), [380, 425, 476]);
  assert.deepEqual(preservedSourceFacts.map(f => f.status), ['ACTIVE', 'DEAD', 'DEAD']);
  assert(preservedSourceFacts.every(f => f.random.seed === seed && f.sequence === 4));
  s = migrateSliceState(old.startingState); initial = s; assertValidSliceState(s);
  for (const command of old.commands) go(command);
  assert.deepEqual(commands, old.commands);
  assert.deepEqual(s, migrateSliceState(old.final), 'Entire migrated directed final must match BEFORE any new action');
  assert.deepEqual(s.random, old.final.random); assert.equal(s.random.cursor, 440);
  assert.equal(s.week, 128); assert.equal(s.cash, 900); assert.equal(s.actionsRemaining, 3); assert.equal(s.weeklyBudget, 3);
  assert.equal(s.health, 30); assert.equal(s.mind, 100); assert.equal(s.spirituality, 120);
  assert.equal(s.progression.pathwayId, 'warrior'); assert.equal(s.progression.sequence, 3); assert.equal(s.progression.acting, 100);
  assert.equal(s.character.gender, 'FEMALE'); assert.equal(Object.keys(s.progression.mastery).length, 18); assert.equal(s.silverKnight.promotionWeek, 120);
  for (const key of OLD_ROOTS) assert.deepEqual(s[key], old.final[key], `Original ${key} history is unchanged by migration`);
  prefixVerified = true; legacy = Object.fromEntries(OLD_ROOTS.map(key => [key, structuredClone(old.final[key])]));
  snapshot('departureStart'); capture('inherited-full-70-directed-final'); assertLegacyPreserved();
  recoverOriginalInjuries(); ready({ cash: 500, ap: 2 }); snapshot('guidanceStart');
  const guidanceCash = s.cash; gl({ type: 'LEARN_GUIDANCE' }, 'independent-guidance-paid500');
  assert.equal(s.cash, guidanceCash - 500); assert.equal(s.glory.guidanceKnown, true); clear();
  for (const taskId of ['TRACE_ARMOR', 'PLAN_LOAD', 'CHECK_EXIT']) action({ type: 'PREPARE_TASK', taskId }, `professional-${taskId.toLowerCase()}`);
  for (let count = 0; s.progression.sequence === 3 && count < MAX_BOTTLES; count++) {
    let bottle = s.glory.bottles.find(b => b.status === 'PLAYER') ?? s.glory.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      const length = s.glory.bottles.length; action({ type: 'REQUEST_SUPPLY' }, 'request-independent-new-batch');
      const requestedWeek = s.glory.resupply.requestedWeek; assert.notEqual(requestedWeek, null); assert.equal(s.glory.bottles.length, length);
      ready({ afterWeek: requestedWeek }); gl({ type: 'RECEIVE_SUPPLY' }, 'actual-next-week-new-batch');
      assert.equal(s.glory.bottles.length, length + 3); assert(s.week > requestedWeek);
      bottle = s.glory.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'An independent original bottle must actually exist'); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.glory.bottles.find(b => b.id === bottleId).labourSteps < 5) {
        const fifth = s.glory.bottles.find(b => b.id === bottleId).labourSteps === 4;
        action({ type: 'POTION_WORK', bottleId }, fifth ? `${bottleId}-fifth-real-labour` : null);
      }
      ready({ cash: 1040 }); const cash = s.cash; gl({ type: 'BUY_POTION', bottleId }, `${bottleId}-independent-purchase900`);
      assert.equal(s.cash, cash - 900);
    }
    ready({ cash: 140, ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.silverKnight.promotionWeek + 11 });
    assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0); assert.equal(s.progression.acting, 100);
    const prep = { cash: s.cash, ap: s.actionsRemaining, week: s.week };
    gl({ type: 'PREPARE_PROMOTION' }, `${bottleId}-actual-current-week-preparation140`);
    assert.equal(s.cash, prep.cash - 140); assert.equal(s.actionsRemaining, prep.ap - 1); assert.equal(s.week, prep.week);
    assert.equal(s.glory.preparedWeek, s.week); assert.equal(s.glory.bottles.find(b => b.id === bottleId).labourSteps, 5);
    if (!boundaries['consume-ready']) capture('consume-ready');
    const before = { mastery: structuredClone(s.progression.mastery), stats: structuredClone(s.character.coreStats), H: s.health, M: s.mind, S: s.spirituality,
      pollution: s.seer.pollution, injuries: structuredClone(s.injuries), risk: s.injuryRisk, cursor: s.random.cursor };
    gl({ type: 'CONSUME', bottleId, confirmed: true }); capture(s.progression.sequence === 2 ? 'actual-promotion' : `${bottleId}-actual-potion-failure`);
    const used = s.glory.bottles.find(b => b.id === bottleId);
    assert.equal(used.status, 'CONSUMED'); assert.equal(used.preparationWeek, prep.week); assert.equal(used.consumedWeek, prep.week); assert.equal(s.glory.preparedWeek, null);
    assert.equal(s.random.cursor, before.cursor + 1); assert.equal(s.spirituality, before.S); assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.risk);
    const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[used.outcome]; assert(costs);
    assert.equal(s.health, Math.max(1, before.H - costs[0])); assert.equal(s.mind, Math.max(1, before.M - costs[1])); assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2]));
    for (const [id, mastery] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], mastery);
    for (const [id, stat] of Object.entries(before.stats)) assert.equal(s.character.coreStats[id], Math.min(500, stat + (s.progression.sequence === 2 ? 1 : 0)));
    assertLegacyPreserved(); clear();
    if (s.progression.sequence === 3) ready({ health: 100, mind: 100, spirituality: 120, pollution: 0 });
  }
  assert.equal(s.progression.sequence, 2, 'Finite real bottle allowance exhausted; keep failures rather than force promotion');
  assert.equal(s.glory.silverKnightActingAtPromotion, 100); assert.equal(s.progression.acting, 0);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted');
  for (const id of CASES) practice(id);
  action({ type: 'REFLECT' }, 'three-actual-practices-reflection'); assert.equal(s.progression.acting, 100);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], CASES.reduce((total, caseId) => total + (attempt(caseId).appliedAbilityIds.includes(id) ? 8 : 0), 0));
  assert.equal(life().site.pads.consumed, 1); assert.equal(life().site.pads.remaining, 1); assert.equal(life().site.load.remainingLoads, 0);
  assert.equal(life().site.plates.length, 3); assert.equal(life().site.plates.find(plate => plate.caseId === 'revoked-crossing').charges, 1);
  assert.equal(life().site.armor.integrity, 65 - attempt('armor-temper').armorWear);
  assert.equal(life().site.guard.sharedHealth, attempt('close-guard').appliedAbilityIds.includes(NEW_IDS[1]) ? 5 : 0);
  assert.equal(life().site.playerEnergy + life().site.playerTravelMetres + life().site.guard.sharedEnergy, 100);
  assertLegacyPreserved(); snapshot('practiced');
  ready({ ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0 });
  assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0); const closedSite = structuredClone(life().site);
  gl({ type: 'ENCOUNTER_TALK' }, 'original-martin45-adults-clear-and-player-actual-walk');
  assert.deepEqual(s.glory.encounter.startSite, closedSite); assert.equal(life().site.playerLocation, 'YARD');
  for (const actor of ['celia', 'evan']) {
    assert.equal(life().site[actor].location, 'OUTSIDE'); assert.equal(life().site[actor].travelMetres, closedSite[actor].travelMetres + 4);
    assert.equal(life().site[actor].energy, closedSite[actor].energy - 4);
  }
  assert.equal(life().site.playerEnergy, closedSite.playerEnergy - 4); assert.equal(life().site.playerTravelMetres, closedSite.playerTravelMetres + 4);
  assert.equal(life().site.clockSeconds, closedSite.clockSeconds + 16); assert.equal(life().site.armorWorn, true);
  assert.deepEqual(life().site.armor, closedSite.armor); assert(life().site.playerEnergy >= 2, 'Actual exit energy remains reserved');
  gl({ type: 'ENCOUNTER_FIGHT' }, 'original-martin45-optional-fight'); snapshot('combatStart');
  assert.equal(s.combat.encounterId, 'GLORY_DISPUTE'); assert.equal(s.glory.encounter.targetId, 'GL2-MARTIN'); assert.equal(view().encounter.enemy.age, 45);
  assert.equal(s.glory.encounter.enemySpirituality, 120); assert.equal(view().encounter.enemy.weaponId, 'GL2-MARTIN-CLUB');
  const masteryBeforeCombat = structuredClone(s.progression.mastery), combatInitialInjuries = new Set(s.injuries.map(i => i.id));
  for (let round = 0; s.combat && round < MAX_ROUNDS; round++) {
    retreatCommitted ||= s.health <= 40 || s.injuries.some(i => i.severity === 'HEAVY' && !combatInitialInjuries.has(i.id));
    const stance = retreatCommitted ? 'RETREAT' : ['DEFEND', 'CONTROL', 'ATTACK'][round % 3];
    go({ type: 'COMBAT_ROUND', stance }, `combat-round-${round + 1}`);
    recordCombatEvidence();
    if (s.lastCombatRound.consequenceWeights && !boundaries['combat-body-consequence']) capture('combat-body-consequence');
    assertLegacyPreserved(); assert.deepEqual(s.progression.mastery, masteryBeforeCombat);
    assert.deepEqual(s.glory.encounter.startSite, closedSite);
    for (const key of ['pads', 'load', 'bridge', 'temper', 'guard', 'plates', 'armorSource']) assert.deepEqual(life().site[key], closedSite[key], `Combat preserves room ${key}`);
    assert.equal(life().site.celia.location, 'OUTSIDE'); assert.equal(life().site.evan.location, 'OUTSIDE');
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Finite 90-round strategy stopped with actual unresolved combat; preserve blocker, never rerun for a win');
  assert(s.glory.encounter.terminal);
  if (s.status === 'ACTIVE') {
    assert.equal(life().site.playerLocation, 'OUTSIDE'); assert.equal(s.glory.encounter.terminal.exitMetres, 2);
    assert.equal(life().site.playerTravelMetres, closedSite.playerTravelMetres + 6); assert.equal(life().site.playerEnergy, closedSite.playerEnergy - 6);
    ordinary('ordinary-life-after-actual-exit');
  } else { assert.equal(s.status, 'DEAD'); assert.equal(s.health, 0); assert.equal(life().site.playerLocation, 'YARD'); assert.equal(s.glory.encounter.terminal.exitMetres, 0); }
  assertLegacyPreserved(); assertOriginalSiteIdentities(closedSite);
  for (const source of sourcePreservation) assert.equal(fileDigest(source.file), source.sha256, `Entire original source remains byte-for-byte unchanged: ${source.file}`);
  save(s.status === 'ACTIVE' ? 'DIRECTED_SILVER_KNIGHT_PREFIX_THEN_PUBLIC_GLORY' : 'DIRECTED_SILVER_KNIGHT_PREFIX_THEN_PUBLIC_GLORY_ACTUAL_COMBAT_DEATH');
} catch (error) {
  const blocker = writeNatural('ACTUAL_BLOCKER', error); writeIndices('blocker.');
  console.error(JSON.stringify({ passed: false, outputDir, blocker, commands: commands.length, prefixVerified, pendingIntent, error: String(error) })); throw error;
}
function fileDigest(path) {
  const hash = createHash('sha256'), fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; hash.update(buffer.subarray(0, count)); } }
  finally { closeSync(fd); }
  return hash.digest('hex');
}
// Streaming top-level entry reader: skipped historical snapshot trees are never
// retained or parsed. StringDecoder preserves UTF-8 across 64KiB chunks.
function readObjectEntry(path, wanted) {
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
