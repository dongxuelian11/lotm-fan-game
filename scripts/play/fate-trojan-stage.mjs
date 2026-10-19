import assert from 'node:assert/strict';
import { appendFileSync, closeSync, constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Candidate only. The serial runtime lead compiles, then runs from the repo root:
// node --max-old-space-size=512 scripts/play/fate-trojan-stage.mjs
// Replay the complete existing 451-command living branch from its original
// creation/seed. Never edit random state, reload a failure, resurrect the original
// 456-command dead branch, refill resources, or overwrite authoritative evidence.
const load = name => import(pathToFileURL(resolve(`dist/domain/${name}.js`)).href);
const { createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } = await load('slice/index');
const { migrateSliceState } = await load('slice/migration');
const { validateSlicePayload } = await load('slice/validation');
const { projectFateTrojan } = await load('fate-trojan/index');
const sourceFixture = 'tests/fixtures/deceit-mentor-v01510/peaceful.json';
const originalDeathFixture = 'tests/fixtures/deceit-mentor-v01510/natural.json';
const old = Object.fromEntries(['provenance', 'initial', 'creation', 'seed', 'commands', 'prefixCount', 'branch', 'final'].map(key => [key, readObjectEntry(sourceFixture, key)]));
const oldDeath = Object.fromEntries(['creation', 'seed', 'commands', 'final'].map(key => [key, readObjectEntry(originalDeathFixture, key)]));
const { creation, seed, provenance } = old, prefixCount = old.commands.length;
const continuation = { kind: 'EXACT_451_PUBLIC_LIVING_PREFIX_THEN_PUBLIC_FATE_TROJAN', sourceFixture, originalDeathFixture, newRandomChanges: false };
const CASES = ['identity-link', 'fate-assumption', 'revoked-link'];
const NEW_IDS = ['error.s2.identity-link', 'error.s2.fate-assumption'];
const OLD_ROOTS = ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'parasite', 'deceitMentor'];
const MAX_COMMANDS = 3500, MAX_BOTTLES = 12, MAX_ROUNDS = 100;
const commands = [], boundaries = {}, boundarySteps = {}, snapshots = {}, treatments = [];
const capturedSteps = new Map(), uniqueTransitions = [];
let s = null, initial = null, beforeLast = null, lastIntent = null, pendingIntent = null, prefixVerified = false;
let legacy = null, attemptedState = null;
mkdirSync('output/play', { recursive: true });
const outputDir = mkdtempSync('output/play/fate-trojan-01750-');
const commandsFile = `${outputDir}/commands.jsonl`, publicFile = `${outputDir}/public-compact.jsonl`;
writeFileSync(commandsFile, '', { flag: 'wx' }); writeFileSync(publicFile, '', { flag: 'wx' });
const write = (path, value) => writeFileSync(path, JSON.stringify(value), { flag: 'wx' });
const append = (path, value) => appendFileSync(path, `${JSON.stringify(value)}\n`);
const pub = () => projectSliceState(s), view = () => projectFateTrojan(s);
const life = () => s.fateTrojan.life, attempt = id => life().cases[id].attempts.at(-1);
const success = tier => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
function snapshot(key) {
  assert(!snapshots[key], `Snapshot already captured: ${key}`);
  const path = `${outputDir}/snapshot-${key}.json`; write(path, s); snapshots[key] = path;
}
function compact() {
  const p = view(), a = p.life.currentAttempt, site = life().site;
  const round = s.combat?.lastRound ?? s.lastCombatRound, result = round?.fateTrojanOutcome;
  return { revision: s.revision, week: s.week, date: s.date, status: s.status, H: s.health, M: s.mind, S: s.spirituality,
    pollution: s.seer.pollution, cash: s.cash, AP: s.actionsRemaining, sequence: s.progression.sequence, acting: s.progression.acting,
    activeEvent: s.activeEvent?.instanceId ?? null, injuryRisk: s.injuryRisk, injuries: s.injuries,
    life: { activeCase: life().activeCase, location: site.playerLocation, energy: site.playerEnergy, travelMetres: site.playerTravelMetres, clockSeconds: site.clockSeconds,
      tier: a?.abilityTier ?? null, applied: a?.appliedAbilityIds ?? [], link: site.link, cabinet: site.cabinet, parcel: site.parcel, fate: site.fate },
    encounter: { status: p.encounter.status, enemy: p.encounter.enemy, lastRound: round ? { round: round.round, stance: round.stance, winner: round.winner, retreat: round.retreat,
      fateTrojan: result ? { playerHealthAfter: result.playerHealthAfter, enemyHealth: result.enemyHealth, playerSpiritualityAfter: result.playerSpiritualityAfter,
        enemySpirituality: result.enemySpirituality, continuing: result.continuing } : null } : null } };
}
function capture(key) {
  assert(prefixVerified, 'New boundaries require the verified complete 451-command original prefix');
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
function ft(command, boundary = null) {
  pendingIntent = { type: 'FATE_TROJAN', command: structuredClone(command) };
  const action = view().actions.find(a => isDeepStrictEqual(a.command, command));
  assert(action, `Not a current public FATE_TROJAN action: ${JSON.stringify(command)}`); assert(action.enabled, action.reason);
  go({ type: 'FATE_TROJAN', command }, boundary);
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
function action(command, boundary = null) { ready(); ft(command, boundary); clear(); }
function assertLegacyPreserved() {
  assert(legacy, 'Original living prefix must be verified first');
  assert.equal(s.runId, old.final.runId); assert.equal(s.random.seed, seed); assert.equal(s.character.gender, old.final.character.gender);
  assert.equal(s.progression.promotionWeek, old.final.progression.promotionWeek, 'The earliest original promotion week is historical');
  for (const key of OLD_ROOTS) assert.deepEqual(s[key], legacy[key], `Keep every original ${key} history/person/object fact`);
  assert.deepEqual(s.combatHistory.slice(0, old.final.combatHistory.length), old.final.combatHistory, 'Original injuries, deaths and combat rounds remain historical');
  for (const [id, mastery] of Object.entries(old.final.progression.mastery)) assert.equal(s.progression.mastery[id], mastery, `Original mastery ${id}`);
  assert.equal(Object.keys(s.progression.mastery).length, s.progression.sequence === 2 ? 14 : 12);
}
function recoverOriginalInjuries() {
  assert.equal(s.health, 100); assert.equal(s.injuryRisk, 2); assert.equal(s.careKnown, false);
  assert.equal(s.injuries.length, 2); assert(s.injuries.every(i => i.severity === 'HEAVY' && i.treatedRevision === null));
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
  assert.equal(treatments.length, 1); assert.equal(treatments[0].before.injuries.length, 2);
  assert.equal(s.injuryRisk, 0); assert(s.health >= 80); assertLegacyPreserved(); capture('clinic-both-original-heavy-wounds-healed');
}
function assertOriginalSiteIdentities(original) {
  const p = life().site;
  assert.equal(p.siteId, original.siteId);
  if (original.introducedWeek !== null) { assert.equal(p.introducedWeek, original.introducedWeek); assert.deepEqual(p.introducedDate, original.introducedDate); }
  for (const actor of ['lina', 'victor']) for (const field of ['id', 'name', 'age', 'alive']) assert.deepEqual(p[actor][field], original[actor][field], `Original ${actor}/${field}`);
  for (const object of ['cabinet', 'parcel']) for (const field of ['id', 'ownerId', 'quantity']) assert.deepEqual(p[object][field], original[object][field], `Original ${object}/${field}`);
  for (const field of ['id', 'ownerId']) assert.equal(p.link[field], original.link[field]);
  for (const field of ['id', 'parcelId', 'originalDebtor', 'from', 'to', 'offeredPennies', 'burdenHealth', 'burdenEnergy']) assert.equal(p.fate[field], original.fate[field]);
}
function practice(caseId) {
  const original = structuredClone(life().site);
  action({ type: 'OBSERVE', caseId }, `${caseId}-actual-original-observation`);
  assert.equal(life().site.playerLocation, 'ENTRY'); assert.equal(life().site.playerTravelMetres, original.playerTravelMetres + 12);
  // Observation is unlocked. Restore AP before recording fresh, current-week
  // consent. The two AP are PREPARE and the one paid attempt; all actual cleanup
  // remains available at zero AP. REPORT can follow the real week settlement.
  ready({ cash: 20, ap: 2, health: 100, mind: 100, spirituality: 20, pollution: 0 });
  const step = (type, boundary = null) => ft({ type, caseId }, boundary);
  const walk = (to, boundary = null) => ft({ type: 'WALK', caseId, to }, boundary);
  step('CONSENT_OPERATOR'); step('CONSENT_OWNER', `${caseId}-both-current-consents`);
  assert.equal(life().cases[caseId].operatorConsentWeek, s.week); assert.equal(life().cases[caseId].ownerConsentWeek, s.week);
  const prep = { cash: s.cash, ap: s.actionsRemaining, week: s.week, energy: life().site.playerEnergy };
  ft({ type: 'PREPARE', caseId, method: 'ABILITY' }, `${caseId}-paid20-original-seal`);
  assert.equal(s.cash, prep.cash - 20); assert.equal(s.actionsRemaining, prep.ap - 1); assert.equal(s.week, prep.week);
  assert.equal(life().site.playerLocation, 'DESK'); assert.equal(life().site.playerEnergy, prep.energy - 2);
  assert.equal(attempt(caseId).operatorConsent, 'GRANTED'); assert.equal(attempt(caseId).ownerConsent, 'GRANTED');
  if (caseId === 'identity-link') {
    const cost = { S: s.spirituality, ap: s.actionsRemaining, cursor: s.random.cursor, ownerOpenings: life().site.cabinet.ownerOpenings, playerOpenings: life().site.cabinet.playerOpenings };
    step('TAKE_IDENTITY', 'identity-paid-check-and-actual-taken-state');
    assert.equal(s.spirituality, cost.S - 8); assert.equal(s.actionsRemaining, cost.ap - 1); assert.equal(s.random.cursor, cost.cursor + 1);
    assert.equal(attempt(caseId).identityTaken, success(attempt(caseId).abilityTier));
    if (attempt(caseId).identityTaken) {
      assert.equal(life().site.link.holder, 'PLAYER'); assert.equal(life().site.cabinet.recognitionHolder, 'PLAYER'); assert.equal(life().site.link.returnPending, true);
      assert.equal(view().life.ownerCanOpenCabinet, false);
    } else { assert.equal(life().site.link.holder, 'OWNER'); assert.equal(life().site.link.returnPending, false); }
    walk('CABINET', 'identity-actual-four-metre-cabinet-walk');
    step('OPEN_CABINET', attempt(caseId).identityTaken ? 'identity-actual-original-cabinet-use' : 'identity-failed-check-ordinary-owner-open');
    assert.equal(life().site.cabinet.open, true);
    assert.equal(attempt(caseId).identityUsed, attempt(caseId).identityTaken);
    assert.equal(life().site.cabinet.playerOpenings, cost.playerOpenings + (attempt(caseId).identityTaken ? 1 : 0));
    assert.equal(life().site.cabinet.ownerOpenings, cost.ownerOpenings + (attempt(caseId).identityTaken ? 0 : 1));
    step('CLOSE_CABINET'); walk('DESK');
    if (life().site.link.returnPending) {
      const S = s.spirituality; step('RETURN_LINK', 'identity-paid4-actual-return-to-original-owner');
      assert.equal(s.spirituality, S - 4); assert.equal(attempt(caseId).linkReturned, true);
    }
    assert.equal(life().site.link.holder, 'OWNER'); assert.equal(life().site.cabinet.recognitionHolder, 'OWNER'); assert.equal(life().site.link.returnPending, false);
    step('STOP');
  } else if (caseId === 'fate-assumption') {
    const cost = { S: s.spirituality, ap: s.actionsRemaining, cursor: s.random.cursor };
    step('TAKE_FATE', 'fate-paid-check-and-actual-assumption');
    assert.equal(s.spirituality, cost.S - 8); assert.equal(s.actionsRemaining, cost.ap - 1); assert.equal(s.random.cursor, cost.cursor + 1);
    assert.equal(attempt(caseId).fateTaken, success(attempt(caseId).abilityTier));
    assert.equal(life().site.fate.status, attempt(caseId).fateTaken ? 'ASSUMED' : 'PENDING');
    assert.equal(life().site.fate.debtor, attempt(caseId).fateTaken ? 'PLAYER' : 'OWNER');
    assert.equal(life().site.fate.ownerRelieved, attempt(caseId).fateTaken);
    assert.equal(life().site.fate.paidToPlayer, 0); assert.equal(life().site.fate.incurredHealth, 0);
    walk('CABINET'); step('OPEN_CABINET', 'fate-original-owner-ordinary-cabinet-open');
    const carry = { H: s.health, cash: s.cash, energy: life().site.playerEnergy, travel: life().site.playerTravelMetres, parcelMetres: life().site.parcel.ordinaryMetres };
    step('CARRY_PARCEL', attempt(caseId).fateTaken ? 'fate-actual-original-parcel-carry-and-cost' : 'fate-failed-check-actual-ordinary-carry-and-cost');
    assert.equal(s.health, carry.H - 5); assert.equal(s.cash, carry.cash + 12); assert.equal(life().site.playerEnergy, carry.energy - 13);
    assert.equal(life().site.playerTravelMetres, carry.travel + 8); assert.equal(life().site.parcel.ordinaryMetres, carry.parcelMetres + 8);
    assert.equal(life().site.playerLocation, 'OUTSIDE'); assert.equal(life().site.parcel.location, 'OUTSIDE'); assert.equal(life().site.fate.status, 'COMPLETED');
    assert.equal(life().site.fate.paidToPlayer, 12); assert.equal(life().site.fate.escrowPennies, 0);
    assert.equal(life().site.fate.incurredHealth, 5); assert.equal(life().site.fate.incurredEnergy, 5); assert.equal(attempt(caseId).parcelCarried, true);
    walk('CABINET', 'fate-actual-return-to-close-original-cabinet'); step('CLOSE_CABINET'); walk('DESK'); step('STOP');
  } else {
    const before = { random: structuredClone(s.random), spirituality: s.spirituality, link: structuredClone(life().site.link), fate: structuredClone(life().site.fate) };
    step('WITHDRAW_PERMISSION', 'revoked-current-owner-withdrawal-after-paid-preparation'); step('STOP');
    assert.equal(attempt(caseId).ownerConsent, 'WITHDRAWN'); assert.equal(attempt(caseId).abilityTier, null);
    assert.deepEqual(attempt(caseId).appliedAbilityIds, []); assert.equal(s.spirituality, before.spirituality); assert.deepEqual(s.random, before.random);
    assert.deepEqual(life().site.link, before.link); assert.deepEqual(life().site.fate, before.fate);
  }
  step('RETURN_SEAL', `${caseId}-actual-original-seal-return`); walk('ENTRY', `${caseId}-actual-ordinary-return`);
  step('INSPECT'); step('LEAVE', `${caseId}-closed-original-site`); clear();
  const beforeMastery = structuredClone(s.progression.mastery);
  action({ type: 'REPORT', caseId }, `${caseId}-report-actual-application-only`);
  assert.equal(life().cases[caseId].status, 'RESOLVED'); assert.equal(attempt(caseId).closed, true);
  assert.equal(life().site.playerLocation, 'ENTRY'); assert.equal(life().site.cabinet.open, false); assert.equal(life().site.link.holder, 'OWNER');
  assert(life().site.seals.every(seal => seal.location === 'DESK'));
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], beforeMastery[id] + (attempt(caseId).appliedAbilityIds.includes(id) ? 8 : 0));
  assertLegacyPreserved(); assertOriginalSiteIdentities(original);
}
function appendFileBytes(destination, source) {
  const fd = openSync(source, 'r'), buffer = Buffer.allocUnsafe(64 * 1024);
  try { for (;;) { const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break; appendFileSync(destination, buffer.subarray(0, count)); } } finally { closeSync(fd); }
}
function writeNatural(stage, error = null) {
  const path = `${outputDir}/${error ? 'blocker' : 'natural'}.json`;
  writeFileSync(path, '{', { flag: 'wx' }); let first = true;
  const property = (key, value, file = null) => { appendFileSync(path, `${first ? '' : ','}${JSON.stringify(key)}:`); first = false; if (file) appendFileBytes(path, file); else appendFileSync(path, JSON.stringify(value)); };
  for (const [key, value] of Object.entries({ provenance, continuation, creation, seed, initial, commands, prefixCount, inheritedPrefixCount: old.prefixCount, stage, sourceFixture, originalDeathFixture, prefixVerified })) property(key, value);
  for (const key of ['departureStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart']) property(key, null, snapshots[key] ?? null);
  property('beforeLast', beforeLast); property('lastIntent', lastIntent); property('final', s); property('treatments', treatments);
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
  const summary = { stage, outputDir, sourceFixture, originalDeathFixture, provenance, continuation, prefixCount, commands: commands.length, prefixVerified,
    week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting, health: s.health, mind: s.mind, spirituality: s.spirituality,
    pollution: s.seer.pollution, cash: s.cash, actionsRemaining: s.actionsRemaining, random: s.random, injuries: s.injuries, injuryRisk: s.injuryRisk,
    mastery: s.progression.mastery, treatments, bottles: s.fateTrojan.bottles.map(b => ({ id: b.id, status: b.status, labourSteps: b.labourSteps, outcome: b.outcome, acquiredWeek: b.acquiredWeek, consumedWeek: b.consumedWeek })),
    cases: CASES.map(id => ({ id, ...life().cases[id] })), site: life().site, encounter: s.fateTrojan.encounter,
    boundaries: Object.keys(boundaries).length, uniqueTransitions: uniqueTransitions.length, legacyPreserved: true, originalDeathPreserved: true };
  write(`${outputDir}/summary.json`, summary);
  // Only a completed actual route publishes. Any failed assertion leaves the
  // precise blocker/commands in this unique output folder; no old file changes.
  const fixtureDir = 'tests/fixtures/fate-trojan-v01750';
  assert(!existsSync(fixtureDir), `Refusing to replace existing authoritative fixture ${fixtureDir}`); mkdirSync(fixtureDir);
  const files = [[naturalPath, 'natural.json'], [`${outputDir}/summary.json`, 'summary.json'],
    ...['boundaries.index.json', 'boundaries.steps.json', 'boundaries.unique.json', 'commands.jsonl', 'public-compact.jsonl'].map(name => [`${outputDir}/${name}`, name]),
    ...Object.entries(snapshots).map(([key, path]) => [path, `snapshot-${key}.json`]), ...new Set(Object.values(boundaries))].map(file => typeof file === 'string' ? [`${outputDir}/${file}`, file] : file);
  for (const [source, target] of files) copyFileSync(source, `${fixtureDir}/${target}`, constants.COPYFILE_EXCL);
  console.log(JSON.stringify({ passed: true, stage, outputDir, fixtureDir, commands: commands.length, prefixCount, boundaries: Object.keys(boundaries).length, uniqueTransitions: uniqueTransitions.length, summary: 'summary.json' }));
}
try {
  assert.equal(prefixCount, 451); assert.equal(old.final.status, 'ACTIVE'); assert.equal(seed, 'marauder-natural-v038');
  assert.equal(oldDeath.commands.length, 456); assert.equal(oldDeath.final.status, 'DEAD'); assert.equal(oldDeath.seed, seed);
  s = createSliceRun(old.final.runId, creation, seed); initial = s; assertValidSliceState(s);
  for (const command of old.commands) go(command);
  assert.deepEqual(commands, old.commands);
  assert.deepEqual(s, migrateSliceState(old.final), 'Entire migrated original living final must match BEFORE any new action');
  assert.deepEqual(s.random, old.final.random); assert.equal(s.random.cursor, 253);
  assert.equal(s.week, 108); assert.equal(s.cash, 530); assert.equal(s.actionsRemaining, 1); assert.equal(s.weeklyBudget, 3);
  assert.equal(s.health, 100); assert.equal(s.mind, 100); assert.equal(s.spirituality, 120);
  assert.equal(s.progression.pathwayId, 'error'); assert.equal(s.progression.sequence, 3); assert.equal(s.progression.acting, 100);
  assert.equal(Object.keys(s.progression.mastery).length, 12); assert.equal(s.deceitMentor.promotionWeek, 101);
  for (const key of OLD_ROOTS) assert.deepEqual(s[key], old.final[key], `Original ${key} history is unchanged by migration`);
  prefixVerified = true; legacy = Object.fromEntries(OLD_ROOTS.map(key => [key, structuredClone(old.final[key])]));
  snapshot('departureStart'); capture('inherited-full-451-living-final'); assertLegacyPreserved();
  recoverOriginalInjuries(); ready({ cash: 500, ap: 2 }); snapshot('guidanceStart');
  const guidanceCash = s.cash; ft({ type: 'LEARN_GUIDANCE' }, 'independent-guidance-paid500');
  assert.equal(s.cash, guidanceCash - 500); assert.equal(s.fateTrojan.guidanceKnown, true); clear();
  for (const taskId of ['VERIFY_PERSON', 'TRACE_LINK', 'PLAN_RETURN']) action({ type: 'PREPARE_TASK', taskId }, `professional-${taskId.toLowerCase()}`);
  for (let count = 0; s.progression.sequence === 3 && count < MAX_BOTTLES; count++) {
    let bottle = s.fateTrojan.bottles.find(b => b.status === 'PLAYER') ?? s.fateTrojan.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      const length = s.fateTrojan.bottles.length; action({ type: 'REQUEST_SUPPLY' }, 'request-independent-new-batch');
      const requestedWeek = s.fateTrojan.resupply.requestedWeek; assert.notEqual(requestedWeek, null); assert.equal(s.fateTrojan.bottles.length, length);
      ready({ afterWeek: requestedWeek }); ft({ type: 'RECEIVE_SUPPLY' }, 'actual-next-week-new-batch');
      assert.equal(s.fateTrojan.bottles.length, length + 3); assert(s.week > requestedWeek);
      bottle = s.fateTrojan.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'An independent original bottle must actually exist'); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.fateTrojan.bottles.find(b => b.id === bottleId).labourSteps < 5) {
        const fifth = s.fateTrojan.bottles.find(b => b.id === bottleId).labourSteps === 4;
        action({ type: 'POTION_WORK', bottleId }, fifth ? `${bottleId}-fifth-real-labour` : null);
      }
      ready({ cash: 1040 }); const cash = s.cash; ft({ type: 'BUY_POTION', bottleId }, `${bottleId}-independent-purchase900`);
      assert.equal(s.cash, cash - 900);
    }
    ready({ cash: 140, ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0, afterWeek: s.deceitMentor.promotionWeek + 11 });
    assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0); assert.equal(s.progression.acting, 100);
    const prep = { cash: s.cash, ap: s.actionsRemaining, week: s.week };
    ft({ type: 'PREPARE_PROMOTION' }, `${bottleId}-actual-current-week-preparation140`);
    assert.equal(s.cash, prep.cash - 140); assert.equal(s.actionsRemaining, prep.ap - 1); assert.equal(s.week, prep.week);
    assert.equal(s.fateTrojan.preparedWeek, s.week); assert.equal(s.fateTrojan.bottles.find(b => b.id === bottleId).labourSteps, 5);
    const before = { mastery: structuredClone(s.progression.mastery), stats: structuredClone(s.character.coreStats), H: s.health, M: s.mind, S: s.spirituality,
      pollution: s.seer.pollution, injuries: structuredClone(s.injuries), risk: s.injuryRisk, cursor: s.random.cursor };
    ft({ type: 'CONSUME', bottleId, confirmed: true }); capture(s.progression.sequence === 2 ? 'actual-promotion' : `${bottleId}-actual-potion-failure`);
    const used = s.fateTrojan.bottles.find(b => b.id === bottleId);
    assert.equal(used.status, 'CONSUMED'); assert.equal(used.preparationWeek, prep.week); assert.equal(used.consumedWeek, prep.week); assert.equal(s.fateTrojan.preparedWeek, null);
    assert.equal(s.random.cursor, before.cursor + 1); assert.equal(s.spirituality, before.S); assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.risk);
    const costs = { GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60] }[used.outcome]; assert(costs);
    assert.equal(s.health, Math.max(1, before.H - costs[0])); assert.equal(s.mind, Math.max(1, before.M - costs[1])); assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2]));
    for (const [id, mastery] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], mastery);
    for (const [id, stat] of Object.entries(before.stats)) assert.equal(s.character.coreStats[id], Math.min(500, stat + (s.progression.sequence === 2 ? 1 : 0)));
    assertLegacyPreserved(); clear();
    if (s.progression.sequence === 3) ready({ health: 100, mind: 100, spirituality: 120, pollution: 0 });
  }
  assert.equal(s.progression.sequence, 2, 'Finite real bottle allowance exhausted; keep failures rather than force promotion');
  assert.equal(s.fateTrojan.deceitMentorActingAtPromotion, 100); assert.equal(s.progression.acting, 0);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0); snapshot('promoted');
  for (const id of CASES) practice(id);
  action({ type: 'REFLECT' }, 'three-actual-practices-reflection'); assert.equal(s.progression.acting, 100);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], CASES.reduce((total, caseId) => total + (attempt(caseId).appliedAbilityIds.includes(id) ? 8 : 0), 0));
  assert.equal(life().site.fate.incurredHealth, 5); assert.equal(life().site.fate.paidToPlayer, 12); assert.equal(life().site.parcel.ordinaryMetres, 8);
  assert.equal(life().site.seals.length, 3); assert.equal(life().site.seals.find(seal => seal.caseId === 'revoked-link').charges, 1);
  assertLegacyPreserved(); snapshot('practiced');
  ready({ ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0 });
  assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0); const closedSite = structuredClone(life().site);
  ft({ type: 'ENCOUNTER_TALK' }, 'original-elias46-actual-consented-approach');
  assert.deepEqual(s.fateTrojan.encounter.startSite, closedSite); assert.equal(life().site.playerLocation, 'YARD');
  assert.equal(life().site.lina.location, 'OUTSIDE'); assert.equal(life().site.victor.location, 'OUTSIDE');
  assert.equal(life().site.playerEnergy, closedSite.playerEnergy - 4); assert.equal(life().site.playerTravelMetres, closedSite.playerTravelMetres + 4);
  ft({ type: 'ENCOUNTER_FIGHT' }, 'original-elias46-optional-fight'); snapshot('combatStart');
  assert.equal(s.combat.encounterId, 'FATE_TROJAN_DISPUTE'); assert.equal(s.fateTrojan.encounter.targetId, 'FT2-ELIAS'); assert.equal(view().encounter.enemy.age, 46);
  const masteryBeforeCombat = structuredClone(s.progression.mastery);
  for (let round = 0; s.combat && round < MAX_ROUNDS; round++) {
    go({ type: 'COMBAT_ROUND', stance: s.health <= 40 ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK' }, `combat-round-${round + 1}`);
    assertLegacyPreserved(); assert.deepEqual(s.progression.mastery, masteryBeforeCombat);
    assert.deepEqual(s.fateTrojan.encounter.startSite, closedSite);
    for (const key of ['cabinet', 'parcel', 'link', 'fate', 'seals']) assert.deepEqual(life().site[key], closedSite[key], `Combat preserves registry ${key}`);
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'Actual optional combat has not terminated'); assert(s.fateTrojan.encounter.terminal);
  if (s.status === 'ACTIVE') { assert.equal(life().site.playerLocation, 'OUTSIDE'); ordinary('ordinary-life-after-actual-exit'); }
  else { assert.equal(s.status, 'DEAD'); assert.equal(s.health, 0); assert.equal(life().site.playerLocation, 'YARD'); }
  assertLegacyPreserved(); assertOriginalSiteIdentities(closedSite);
  for (const key of Object.keys(old)) assert.deepEqual(readObjectEntry(sourceFixture, key), old[key], `Original 451 living fixture ${key} unchanged`);
  for (const key of Object.keys(oldDeath)) assert.deepEqual(readObjectEntry(originalDeathFixture, key), oldDeath[key], `Original 456 death fixture ${key} unchanged`);
  save(s.status === 'ACTIVE' ? 'SAME_SEED_FULL_PUBLIC_FATE_TROJAN' : 'SAME_SEED_ACTUAL_FATE_TROJAN_COMBAT_DEATH');
} catch (error) {
  const blocker = writeNatural('ACTUAL_BLOCKER', error); writeIndices('blocker.');
  console.error(JSON.stringify({ passed: false, outputDir, blocker, commands: commands.length, prefixVerified, pendingIntent, error: String(error) })); throw error;
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
