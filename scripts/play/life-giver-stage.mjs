import assert from 'node:assert/strict';
import {appendFileSync, closeSync, copyFileSync, mkdirSync, mkdtempSync, openSync, readSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {StringDecoder} from 'node:string_decoder';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {splitLifeGiverBoundaries} from './life-giver-boundary-files.mjs';

// Verified public-route runner. Execute only after compiling the current domain.
// Usage from the repository root:
// node --max-old-space-size=512 scripts/play/life-giver-stage.mjs
// Fixed public-command strategy. No state edits, free healing, reseeding,
// cursor search, failed-check reloads or rerunning this route to obtain a win.
const moduleAt = name => import(pathToFileURL(resolve(`dist/domain/slice/${name}.js`)).href);
const {createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState} = await moduleAt('index');
const {migrateSliceState} = await moduleAt('migration');
const {validateSlicePayload} = await moduleAt('validation');
const sourceFixture = 'tests/fixtures/summoning-master-v01440/natural.json';
// Read only needed entries, never parse all historical snapshots together.
const old = Object.fromEntries(['creation','seed','commands','final','stage','prefixCount'].map(key => [key, readObjectEntry(sourceFixture, key)]));
const {creation, seed} = old, prefixCount = old.commands.length;
const CASES = ['tired-guest', 'withdrawn-consent', 'interrupted-link'];
const NEW_IDS = ['moon.s2.bounded-vitality', 'moon.s2.shared-shelter'];
const MAX_COMMANDS = 2200, MAX_BOTTLES = 12, MAX_ROUNDS = 100;
const commands = [], boundaryManifest = [], snapshots = {}, treatments = [];
const boundaryKeys = new Set();
let s = null, beforeLast = null, lastIntent = null, pendingIntent = null;
let prefixVerified = false, recovery = null;
mkdirSync('output/play', {recursive: true});
const outputDir = mkdtempSync('output/play/life-giver-01680-');
const streams = Object.fromEntries(['commands','public','private'].map(kind => [kind, `${outputDir}/${kind}.jsonl`]));
for (const path of Object.values(streams)) writeFileSync(path, '', {flag: 'wx'});
const append = (path, value) => appendFileSync(path, `${JSON.stringify(value)}\n`);
const write = (path, value) => writeFileSync(path, JSON.stringify(value));
const publicState = () => projectSliceState(s);
const view = () => publicState().lifeGiver;
const life = () => s.lifeGiver.life;
const guest = () => s.summoningMaster.life.partner;
const attempt = caseId => life().cases[caseId].attempts.at(-1);
const successful = tier => ['SUCCESS', 'GREAT_SUCCESS'].includes(tier);
function snapshot(key) { snapshots[key] = s; }
function capture(key) {
  assert(prefixVerified, 'Only verified complete-prefix continuation may create new boundaries');
  let unique = key, suffix = 2;
  while (boundaryKeys.has(unique)) unique = `${key}-${suffix++}`;
  const path = `${outputDir}/${unique}-save-boundary.json`;
  write(path, {beforeLast, lastIntent, final: s, public: publicState()});
  boundaryKeys.add(unique);
  boundaryManifest.push({key: unique, commandIndex: commands.length, revision: s.revision, path});
  // Keep only small metadata in memory. The canonical boundaries object is
  // assembled by byte-copying these independent files, not parsing all trees.
}
function go(intent, key = null) {
  pendingIntent = structuredClone(intent);
  assert(validateSlicePayload(intent), `Strict public payload rejected: ${JSON.stringify(intent)}`);
  assert(commands.length < MAX_COMMANDS, 'Bounded public route exhausted; retain the actual blocker');
  beforeLast = s; lastIntent = structuredClone(intent);
  const next = applySliceIntent(s, intent);
  assertValidSliceState(next);
  assert.equal(next.random.seed, seed, 'The inherited seed must never change');
  assert(next.random.cursor >= s.random.cursor, 'The inherited random cursor must never rewind');
  assert.equal(next.revision, s.revision + 1, 'Every successful public command commits one revision');
  assert.equal(next.weeklyBudget, 3, 'Every week retains its actual three-action budget');
  s = next; commands.push(structuredClone(intent)); pendingIntent = null;
  if (prefixVerified) {
    const index = commands.length;
    append(streams.commands, {index, intent, revisionBefore: beforeLast.revision, revisionAfter: s.revision,
      randomBefore: beforeLast.random, randomAfter: s.random});
    append(streams.private, {index, final: s});
    append(streams.public, {index, public: publicState()});
    if (key) capture(key);
    console.log(JSON.stringify({index, command: intent, week: s.week, status: s.status,
      H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining,
      sequence: s.progression.sequence, acting: s.progression.acting}));
  }
}
function publicAction(command) { return view().actions.find(a => isDeepStrictEqual(a.command, command)); }
function lg(command, key = null) {
  const entry = publicAction(command);
  assert(entry, `Command is not projected: ${JSON.stringify(command)}`);
  assert(entry.enabled, `Public action blocked: ${entry.reason}`);
  go({type: 'LIFE_GIVER', command}, key);
}
function clear() {
  for (let n = 0; s.activeEvent && n < 20; n++) {
    const event = publicState().activeEvent;
    const choiceId = event.id.startsWith('ORIGIN') ? '.decline'
      : event.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : event.id === 'DEBT-NOTICE-01' ? 'DECLINE'
      : event.id === 'DEBT-SETTLE-01' ? 'DEFER'
      : event.id === 'LIFE-CARE-01' ? 'PAY' : null;
    assert(choiceId, `Unexpected actual event ${event.id}; retain it for review`);
    assert(event.choices.some(c => c.id === choiceId && c.enabled), `Actual event choice unavailable: ${event.id}/${choiceId}`);
    const pay = event.id === 'LIFE-CARE-01';
    const before = pay ? {cash: s.cash, week: s.week, revision: s.revision, injuries: structuredClone(s.injuries)} : null;
    go({type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId}, pay ? 'clinic-actual-pay60' : null);
    if (pay) {
      assert(before.cash >= 60); assert(s.cash <= before.cash - 60, 'Retain PAY60 and any actual week-end charges');
      for (const injury of before.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)) {
        const after = s.injuries.find(i => i.id === injury.id);
        assert(after, 'PAY treats an existing wound; it does not heal/remove it');
        assert.notEqual(after.treatedRevision, null);
      }
      treatments.push({paidPennies: 60, before, cashAfter: s.cash, weekAfter: s.week, injuriesAfter: structuredClone(s.injuries)});
    }
  }
  assert.equal(s.activeEvent, null, 'Actual event chain has not been resolved');
}
function ordinary(key = null, forceRest = false) {
  clear();
  assert.equal(s.status, 'ACTIVE', 'Death ends this route, with no revival or ordinary continuation');
  assert(publicState().canAct && !view().insideCase && !s.combat, 'No work/rest through a locked case, encounter or preparation');
  go({type: 'ACTION', action: forceRest || s.wagePaidWeek === s.week ? 'REST' : 'WORK'}, key);
  clear();
}
function ready({cash = 0, ap = 1, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1} = {}) {
  assert(ap >= 0 && ap <= 3, 'Do not request more AP than the real weekly budget');
  clear();
  while (s.cash < cash || s.actionsRemaining < ap || s.health < health || s.mind < mind ||
      s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek) ordinary();
}
function action(command, key = null) { ready(); lg(command, key); clear(); }
function recoverOriginalInjuries(initial = false) {
  const originalWounds = structuredClone(s.injuries), initialRisk = s.injuryRisk;
  const treatmentsBefore = treatments.length;
  if (initial) {
    assert.equal(s.health, 30); assert.equal(initialRisk, 2);
    assert.equal(originalWounds.filter(i => i.severity === 'LIGHT').length, 1);
    assert.equal(originalWounds.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length, 2);
  }
  if (s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) && !s.careKnown) {
    ready({cash: 60, ap: 2});
    assert(publicState().investigateTargets.some(t => t.id === 'CARE-ACCESS-01'));
    const prior = structuredClone(s.injuries), health = s.health;
    go({type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01'}, 'clinic-discovery');
    assert.equal(s.health, health); assert.deepEqual(s.injuries, prior, 'Discovery never heals or treats'); clear();
  }
  while (s.injuries.length) {
    ready({cash: s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null) ? 60 : 0});
    ordinary(s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null)
      ? 'clinic-invitation-actual-rest' : 'treated-wounds-later-rest', true);
  }
  assert.equal(s.injuryRisk, 0, 'Risk clears only after the actual wounds have healed');
  if (initial) {
    assert(treatments.length > treatmentsBefore, 'Original untreated heavy wounds require an actual PAY60 invitation');
    recovery = {kind: 'ORIGINAL_HEAVY_WOUNDS_PAID_AND_RESTED', originalWounds, initialRisk,
      treatments: structuredClone(treatments.slice(treatmentsBefore)), finalHealth: s.health,
      finalRisk: s.injuryRisk, commandIndex: commands.length};
    capture('original-wounds-actually-recovered');
  }
}
function assertLegacyPreserved() {
  assert.equal(s.runId, old.final.runId); assert.equal(s.random.seed, seed);
  assert.equal(s.character.gender, old.final.character.gender);
  for (const key of ['apothecary','tamer','vampire','potionProfessor','crimsonScholar'])
    assert.deepEqual(s[key], old.final[key], `Retain all original ${key} bodies, resources and history`);
  const currentWitch = structuredClone(s.witchKing), oldWitch = old.final.witchKing;
  assert.deepEqual(currentWitch.life.papers.map(p => p.id), oldWitch.life.papers.map(p => p.id));
  for (const p of currentWitch.life.papers) {
    const before = oldWitch.life.papers.find(b => b.id === p.id);
    if (before.status === 'CONSUMED') assert.deepEqual(p, before, 'Spent original paper never returns');
    else for (const key of ['status','preparedWeek','consumedWeek','consumedBy','combatRound']) p[key] = before[key];
  }
  assert.deepEqual(currentWitch, oldWitch, 'Retain surrendered Dorian, broken target, originals and old ritual');
  const currentSummoning = structuredClone(s.summoningMaster), priorSummoning = old.final.summoningMaster;
  const p = currentSummoning.life.partner, original = priorSummoning.life.partner;
  assert.deepEqual(p.restHistory.slice(0, original.restHistory.length), original.restHistory);
  for (const key of ['location','health','mind','stamina','status','metWeek','ordinaryDistanceM','gateCrossings','restHistory']) p[key] = structuredClone(original[key]);
  assert.deepEqual(currentSummoning, priorSummoning, 'Only the same authoritative guest may change; Edwin, old consent, gate, token and all old cases stay');
  for (const id of Object.keys(old.final.progression.mastery)) assert(Object.hasOwn(s.progression.mastery, id), `Keep original ability ID ${id}, including zero values`);
}
function restGuest() {
  while (guest().status === 'ALIVE' && (guest().stamina < 100 || guest().mind < 100)) {
    assert.equal(guest().location, 'HOME', 'Paid rest requires the same original body to have physically returned');
    ready({cash: 30, ap: 2, afterWeek: guest().restHistory.at(-1)?.week ?? s.summoningMaster.promotionWeek});
    const prior = structuredClone(guest()), cash = s.cash;
    lg({type: 'REST_GUEST'}, 'original-guest-paid-rest');
    assert.equal(s.cash, cash - 30); assert.equal(guest().health, prior.health);
    assert.equal(guest().stamina, Math.min(100, prior.stamina + 30));
    assert.equal(guest().mind, Math.min(100, prior.mind + 10));
    assert.equal(guest().restHistory.length, prior.restHistory.length + 1); clear();
  }
}
function practice(caseId) {
  restGuest();
  ready({cash: 120, ap: 2, health: 90, mind: 85, spirituality: 20});
  const cmd = (type, key = null) => lg({type, caseId}, key);
  const cash = s.cash, beadsBefore = life().beads.length;
  lg({type: 'PREPARE', caseId, method: 'ABILITY'}, `${caseId}-paid-preparation`);
  assert.equal(s.cash, cash - 120);
  const paidIds = life().beads.slice(beadsBefore).map(b => b.id);
  assert.equal(paidIds.length, 2); assert.equal(new Set(paidIds).size, 2);
  assert(life().beads.slice(beadsBefore).every(b => b.paidPennies === 60 && b.caseId === caseId && b.purpose === 'LIFE'));
  cmd('PERFORM'); cmd('VISIT_HOME');
  cmd('CHECK_GUEST_ORIGIN', `${caseId}-actual-origin-inspection`); assert.equal(attempt(caseId).originChecked, true);
  cmd('CONSENT', `${caseId}-current-guest-consent`);
  assert.equal(attempt(caseId).consent, 'GRANTED');
  cmd('FETCH_GUEST'); assert.equal(guest().location, 'YARD');
  assert.equal(guest().id, 'SM3-LUMEN'); assert.equal(guest().bodyId, 'SM3-LUMEN-BODY');
  cmd('CONSENT_OWNER', `${caseId}-current-owner-consent`); cmd('BORROW_TOKEN');
  assert.equal(life().owner.id, 'LG2-MIRA41'); assert.equal(life().token.id, 'LG2-MIRA-TOKEN');
  assert.equal(life().token.massGrams, 200);
  if (caseId === 'tired-guest') {
    const stamina = guest().stamina;
    cmd('GUEST_CARRY'); cmd('GUEST_CARRY', 'tired-guest-real-two-trip-fatigue');
    assert.equal(guest().stamina, stamina - 16, 'Two actual unsheltered 2m trips cost 8 each');
    assert.equal(attempt(caseId).guestTrips, 2);
    const before = {guest: structuredClone(guest()), spirituality: s.spirituality,
      readyIds: life().beads.filter(b => paidIds.includes(b.id) && b.status === 'READY').map(b => b.id)};
    cmd('VITALITY', 'tired-guest-vitality-outcome');
    assert.equal(s.spirituality, before.spirituality - 6);
    assert.equal(guest().health, before.guest.health); assert.equal(guest().mind, before.guest.mind);
    assert.equal(life().beads.filter(b => paidIds.includes(b.id) && b.status === 'SPENT').length, 1);
    assert.equal(guest().stamina, before.guest.stamina + (successful(attempt(caseId).vitalityTier) ? Math.min(12, 100 - before.guest.stamina) : 0));
    // The approved natural case demonstrates exactly 16 real fatigue before
    // vitality. Applied shelter is independently covered by directed tests;
    // the natural obstruction case never claims an unapplied window as effect.
  } else if (caseId === 'withdrawn-consent') {
    const before = {guest: structuredClone(guest()), spirituality: s.spirituality};
    cmd('REVOKE_CONSENT', 'withdrawn-consent-actual-stop');
    assert.equal(attempt(caseId).consent, 'REVOKED');
    for (const type of ['VITALITY','SHELTER','GUEST_CARRY']) {
      const option = publicAction({type, caseId});
      assert(!option || !option.enabled, `Revoked permission must block ${type}`);
    }
    cmd('CARRY_TOKEN', 'withdrawn-consent-ordinary-fallback');
    assert.equal(s.spirituality, before.spirituality); assert.equal(guest().stamina, before.guest.stamina);
    assert.equal(attempt(caseId).vitalityTier, null); assert.equal(attempt(caseId).shelterTier, null);
  } else {
    const before = {health: s.health, spirituality: s.spirituality, guest: structuredClone(guest())};
    cmd('SHELTER', 'interrupted-link-shelter-outcome');
    assert.equal(s.spirituality, before.spirituality - 4);
    assert.equal(s.health, before.health, 'Opening a window without actual shared load must not charge health');
    cmd('BLOCK_PATH', 'interrupted-link-actual-obstruction');
    assert.equal(life().shutter.location, 'LOWERED');
    assert.notEqual(attempt(caseId).shelterStatus, 'ACTIVE');
    const carry = publicAction({type: 'GUEST_CARRY', caseId});
    assert(!carry || !carry.enabled, 'The actual shutter must block a carry');
    cmd('CLEAR_PATH'); cmd('CARRY_TOKEN', 'interrupted-link-ordinary-fallback');
    assert.equal(life().shutter.location, 'RAISED');
    assert.equal(attempt(caseId).shelterApplied, false);
    assert.equal(s.health, before.health); assert.equal(guest().stamina, before.guest.stamina);
  }
  cmd('RETURN_TOKEN'); assert.equal(life().token.custodian, 'LG2-MIRA41');
  cmd('RETURN_GUEST', `${caseId}-same-body-returned`);
  assert.equal(guest().location, 'HOME');
  cmd('RETURN_PLAYER'); cmd('RETURN_BEADS', `${caseId}-same-beads-returned`);
  assert(life().beads.filter(b => paidIds.includes(b.id)).every(b => b.location === 'RETURN_TRAY'));
  cmd('INSPECT'); cmd('CLOSE', `${caseId}-closed`); clear();
  assert.equal(life().cases[caseId].status, 'EXAMINED');
  assert.equal(life().playerLocation, 'YARD'); assert.equal(life().token.location, 'OWNER');
  assert.equal(attempt(caseId).closed, true); assertLegacyPreserved();
}
function startAndResolveEncounter() {
  assert.equal(s.lifeGiver.encounter.status, 'AVAILABLE');
  assert.equal(s.lifeGiver.encounter.guestPermit, null);
  lg({type: 'ENCOUNTER_TALK'}, 'adrian-actual-entry');
  assert.equal(s.lifeGiver.encounter.targetId, 'LG2-ADRIAN-VALE');
  const cash = s.cash, beforeGuest = structuredClone(guest()), beforeTravel = life().playerTravelMetres, beforeClock = life().clockSeconds;
  lg({type: 'SET_GUEST_POLICY', policy: 'ASK_HELP'}, 'new-current-battle-invitation');
  assert.equal(s.cash, cash - 20); assert.deepEqual(guest(), beforeGuest, 'Paid invitation does not move, heal or restore the guest');
  assert(s.lifeGiver.encounter.guestPermit);
  assert.equal(s.lifeGiver.encounter.guestPermit.encounterId, 'LIFE_GIVER_DISPUTE');
  assert.equal(s.lifeGiver.encounter.guestPermit.paidPence, 20);
  assert.equal(life().playerTravelMetres, beforeTravel + 60); assert.equal(life().clockSeconds, beforeClock + 60);
  assert.equal(s.lifeGiver.encounter.invitationHistory.length, 1);
  assert.equal(s.lifeGiver.encounter.guestPolicy, 'ASK_HELP');
  assert.notDeepEqual(s.lifeGiver.encounter.guestPermit, old.final.summoningMaster.encounter.guestPermit);
  lg({type: 'ENCOUNTER_FIGHT'}, 'combat-start'); snapshot('combatStart');
  assert.equal(s.combat.encounterId, 'LIFE_GIVER_DISPUTE');
  assert.equal(s.lifeGiver.encounter.enemyHealth, 100); assert.equal(s.lifeGiver.encounter.enemyMind, 100);
  assert.equal(s.lifeGiver.encounter.enemySpirituality, 120); assertLegacyPreserved();
  for (let round = 0; s.combat && round < MAX_ROUNDS; round++) {
    const danger = s.health <= 40 || s.injuries.some(i => i.severity === 'HEAVY') || s.injuryRisk >= 2 || guest().status === 'DEAD';
    const stance = danger ? 'RETREAT' : round < 2 ? 'CONTROL' : 'ATTACK';
    const before = {guest: structuredClone(guest()),
      papers: structuredClone(s.witchKing.life.papers), beads: structuredClone(life().beads)};
    go({type: 'COMBAT_ROUND', stance}, round === 0 ? 'combat-first' : null);
    const outcome = s.lastCombatRound.lifeGiverOutcome;
    assert(outcome && outcome.targetId === 'LG2-ADRIAN-VALE');
    assert.equal(outcome.source.randomSeed, seed);
    assert.equal(outcome.source.randomCursor, beforeLast.random.cursor);
    assert.equal(outcome.randomCursorAfter, s.random.cursor);
    if (outcome.playerActions.some(a => a.vitalityResult === 'FAILED' || a.shelterResult === 'FAILED')) capture('combat-support-failure-costs-retained');
    if (outcome.playerActions.some(a => a.shelterApplied)) capture('combat-actual-shared-load-health-cost');
    if (outcome.enemyActions.some(a => a.shelterDestroyed)) capture('combat-actual-support-interruption');
    for (const bead of life().beads) {
      const was = before.beads.find(b => b.id === bead.id);
      if (was?.status === 'READY' && bead.status === 'SPENT') capture(`combat-${bead.id.toLowerCase()}-spent`);
    }
    for (const paper of s.witchKing.life.papers) {
      const was = before.papers.find(p => p.id === paper.id);
      if (was?.status === 'PREPARED' && paper.status === 'CONSUMED') capture('combat-original-paper-consumed');
    }
    if (guest().health < before.guest.health || guest().status !== before.guest.status) capture('combat-same-guest-actual-consequence');
    if (!s.combat) capture('combat-terminal');
  }
  assert.equal(s.combat, null, 'The actual finite encounter has not reached a terminal outcome');
  assert(s.lifeGiver.encounter.terminal, 'Retain the true death, surrender or ordinary retreat');
  assertLegacyPreserved();
  if (s.status === 'ACTIVE') {
    assert.equal(s.lifeGiver.encounter.exitTravelMetres, 4); assert.equal(s.lifeGiver.encounter.exitSeconds, 4);
    assert(life().beads.filter(b => b.purpose === 'COMBAT').every(b => b.location === 'RETURN_TRAY'));
    if (guest().status === 'ALIVE') assert.equal(guest().location, 'HOME');
    else { assert.equal(guest().status, 'DEAD'); assert.equal(guest().health, 0); assert.equal(guest().location, 'YARD'); }
    capture('actual-live-exit-and-original-returns');
    ordinary('ordinary-life-after-actual-exit');
  } else {
    assert.equal(s.status, 'DEAD'); assert.equal(s.health, 0);
    assert.equal(s.lifeGiver.encounter.terminal.outcome, 'PLAYER_DEAD');
    assert.equal(s.lifeGiver.encounter.exitTravelMetres, 0); assert.equal(s.lifeGiver.encounter.exitSeconds, 0);
    assert(life().beads.filter(b => b.purpose === 'COMBAT').every(b => b.location === 'YARD'));
    capture('actual-death-no-exit');
  }
}
function saveBoundaryObject(path) {
  writeFileSync(path, '{');
  for (const [index, entry] of boundaryManifest.entries()) {
    appendFileSync(path, `${index ? ',' : ''}${JSON.stringify(entry.key)}:`);
    const fd = openSync(entry.path, 'r'), bytes = Buffer.allocUnsafe(64 * 1024);
    try { for (;;) { const n = readSync(fd, bytes, 0, bytes.length, null); if (!n) break; appendFileSync(path, bytes.subarray(0, n)); } }
    finally { closeSync(fd); }
  }
  appendFileSync(path, '}');
}
async function save(stage) {
  const summary = {stage, commands: commands.length, prefixCount, prefixVerified, sourceFixture,
    week: s.week, status: s.status, sequence: s.progression.sequence, acting: s.progression.acting,
    health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, injuries: s.injuries, injuryRisk: s.injuryRisk,
    bottles: s.lifeGiver.bottles.map(b => ({id: b.id, outcome: b.outcome, labourSteps: b.labourSteps, consumedWeek: b.consumedWeek})),
    cases: CASES.map(id => ({id, result: life().cases[id].result, attempts: life().cases[id].attempts})),
    beads: life().beads, guest: guest(), papers: s.witchKing.life.papers,
    encounter: s.lifeGiver.encounter, recovery, treatments, outputDir};
  const result = {creation, seed, runId: s.runId, commands, prefixCount, prefixVerified, stage,
    ...snapshots, beforeLast, lastIntent, final: s, public: publicState(), summary, streams, boundaryManifest};
  write(`${outputDir}/natural.json`, result); write(`${outputDir}/summary.json`, summary);
  write(`${outputDir}/boundary-manifest.json`, boundaryManifest);
  saveBoundaryObject(`${outputDir}/boundaries.json`);
  // Keep the unique output directory and all prior failed attempts intact.
  // The lead publishes these canonical current fixtures only after this route
  // has actually completed; a blocker never overwrites a valid natural result.
  mkdirSync('tests/fixtures/life-giver-v01680', {recursive: true});
  copyFileSync(`${outputDir}/natural.json`, 'output/play/life-giver-stage-natural.json');
  copyFileSync(`${outputDir}/natural.json`, 'tests/fixtures/life-giver-v01680/natural.json');
  await splitLifeGiverBoundaries(`${outputDir}/boundaries.json`, 'tests/fixtures/life-giver-v01680');
  copyFileSync(`${outputDir}/summary.json`, 'tests/fixtures/life-giver-v01680/summary.json');
  console.log(JSON.stringify({passed: true, stage, commands: commands.length, prefixCount, prefixVerified,
    week: s.week, status: s.status, sequence: s.progression.sequence, health: s.health, mind: s.mind,
    spirituality: s.spirituality, cash: s.cash, bottles: summary.bottles,
    cases: summary.cases.map(c => ({id: c.id, result: c.result})),
    encounter: {status:s.lifeGiver.encounter.status,terminal:s.lifeGiver.encounter.terminal,vitalityUses:s.lifeGiver.encounter.vitalityUses,vitalitySuccesses:s.lifeGiver.encounter.vitalitySuccesses,shelterUses:s.lifeGiver.encounter.shelterUses,shelterSuccesses:s.lifeGiver.encounter.shelterSuccesses,shelterEffects:s.lifeGiver.encounter.shelterEffects}, boundaries: boundaryManifest.map(b => b.key), outputDir}));
}
try {
  assert.equal(prefixCount, 444, 'Replay every original S3 command, never substitute the living 349-command S4 prefix');
  assert.equal(old.stage, 'FULL_NATURAL_BRANCH');
  assert.equal(old.prefixCount, 349, 'Retain the original 349-command S4 prefix within all 444 S3 commands');
  assert.equal(seed, 'apothecary-rebuild-first');
  s = createSliceRun(old.final.runId, creation, seed); assertValidSliceState(s);
  for (const command of old.commands) go(command);
  assert.deepEqual(commands, old.commands);
  assert.deepEqual(s, migrateSliceState(old.final), 'The entire migrated original terminal state must match before extension');
  assert.deepEqual(s.random, old.final.random, 'Historical replay and migration retain the exact inherited RNG cursor');
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.week, 108); assert.equal(s.cash, 514);
  assert.equal(s.actionsRemaining, 3); assert.equal(s.health, 30); assert.equal(s.mind, 100); assert.equal(s.spirituality, 120);
  assert.equal(s.progression.sequence, 3); assert.equal(s.progression.acting, 100);
  assert.equal(s.summoningMaster.promotionWeek, 100);
  assert.equal(s.summoningMaster.encounter.enemyStatus, 'RESISTING');
  assert.equal(s.summoningMaster.encounter.enemyHealth, 100); assert.equal(s.summoningMaster.encounter.enemyMind, 100);
  assert.equal(s.summoningMaster.encounter.enemySpirituality, 71);
  assert.equal(s.summoningMaster.encounter.status, 'RETREATED');
  assert.equal(guest().location, 'HOME'); assert.equal(guest().health, 100); assert.equal(guest().mind, 100); assert.equal(guest().stamina, 100);
  prefixVerified = true; snapshot('departureStart'); capture('inherited-full-s3-final');
  recoverOriginalInjuries(true); assertLegacyPreserved();
  ready({cash: 500, ap: 2}); snapshot('guidanceStart');
  const guideCash = s.cash; lg({type: 'LEARN_GUIDANCE'}, 'guidance'); assert.equal(s.cash, guideCash - 500); clear();
  for (const taskId of ['INSPECT_SOURCE','CHECK_ORIGINAL','PLAN_WITHDRAWAL'])
    action({type: 'PREPARE_TASK', taskId}, `preparation-${taskId.toLowerCase()}`);
  for (let count = 0; s.progression.sequence === 3 && count < MAX_BOTTLES; count++) {
    let bottle = s.lifeGiver.bottles.find(b => b.status === 'PLAYER') ?? s.lifeGiver.bottles.find(b => b.status === 'SUPPLIER');
    if (!bottle) {
      action({type: 'REQUEST_SUPPLY'}, 'request-real-next-week-supply');
      const requestedWeek = s.lifeGiver.resupply.requestedWeek;
      ready({afterWeek: requestedWeek}); assert(s.week > requestedWeek);
      lg({type: 'RECEIVE_SUPPLY'}, 'receive-real-next-week-supply');
      bottle = s.lifeGiver.bottles.find(b => b.status === 'SUPPLIER');
    }
    assert(bottle, 'A distinct real source bottle must exist'); const bottleId = bottle.id;
    if (bottle.status === 'SUPPLIER') {
      while (s.lifeGiver.bottles.find(b => b.id === bottleId).labourSteps < 5) {
        const n = s.lifeGiver.bottles.find(b => b.id === bottleId).labourSteps + 1;
        action({type: 'POTION_WORK', bottleId}, n === 5 ? `${bottleId}-five-real-work-steps` : null);
      }
      ready({cash: 920}); const cash = s.cash;
      lg({type: 'BUY_POTION', bottleId}, 'buy-independent-five-work-bottle'); assert.equal(s.cash, cash - 800);
    }
    ready({cash: 120, ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0,
      afterWeek: s.summoningMaster.promotionWeek + 11});
    const beforePreparation = {cash: s.cash, ap: s.actionsRemaining, week: s.week};
    lg({type: 'PREPARE_PROMOTION'}, 'paid-current-week-preparation');
    assert.equal(s.cash, beforePreparation.cash - 120); assert.equal(s.actionsRemaining, beforePreparation.ap - 1);
    assert.equal(s.week, beforePreparation.week); assert.equal(s.lifeGiver.preparedWeek, s.week);
    const before = {mastery: structuredClone(s.progression.mastery), spirituality: s.spirituality,
      health: s.health, mind: s.mind, pollution: s.seer.pollution,
      guest: structuredClone(guest()), injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk,
      gender: s.character.gender, stats: structuredClone(s.character.coreStats), cash: s.cash, ap: s.actionsRemaining};
    lg({type: 'CONSUME', bottleId, confirmed: true});
    capture(s.progression.sequence === 2 ? 'promotion' : 'consume-failure');
    assert.equal(s.lifeGiver.preparedWeek, null); assert.equal(s.lifeGiver.bottles.find(b => b.id === bottleId).status, 'CONSUMED');
    assert.equal(s.spirituality, before.spirituality); assert.deepEqual(guest(), before.guest);
    assert.deepEqual(s.injuries, before.injuries); assert.equal(s.injuryRisk, before.injuryRisk);
    assert.equal(s.cash, before.cash); assert.equal(s.actionsRemaining, before.ap);
    assert.equal(s.character.gender, before.gender);
    const tier = s.lifeGiver.bottles.find(b => b.id === bottleId).outcome;
    assert(['GREAT_SUCCESS','SUCCESS','FAILURE','GREAT_FAILURE'].includes(tier));
    const costs = {GREAT_SUCCESS: [0, 8, 0], SUCCESS: [0, 15, 0], FAILURE: [15, 25, 30], GREAT_FAILURE: [25, 45, 60]}[tier];
    assert.equal(s.health, Math.max(1, before.health - costs[0]));
    assert.equal(s.mind, Math.max(1, before.mind - costs[1]));
    assert.equal(s.seer.pollution, Math.min(100, before.pollution + costs[2]));
    for (const [id, value] of Object.entries(before.mastery)) assert.equal(s.progression.mastery[id], value);
    for (const [id, value] of Object.entries(before.stats)) assert.equal(s.character.coreStats[id], value + (s.progression.sequence === 2 ? 1 : 0));
    assertLegacyPreserved(); clear();
    if (s.progression.sequence === 3) ready({health: 100, mind: 100, spirituality: 120, pollution: 0});
  }
  assert.equal(s.progression.sequence, 2, 'All finite actual bottles failed; retain costs and blocker, never force promotion');
  assert.equal(s.progression.acting, 0); assert.equal(s.lifeGiver.summoningMasterActingAtPromotion, 100);
  for (const id of NEW_IDS) assert.equal(s.progression.mastery[id], 0);
  snapshot('promoted');
  for (const caseId of CASES) {
    action({type: 'OBSERVE', caseId}); practice(caseId);
    action({type: 'REPORT', caseId}, `${caseId}-report`); assert.equal(life().cases[caseId].status, 'RESOLVED');
  }
  action({type: 'REFLECT'}, 'reflection'); assert.equal(s.progression.acting, 100);
  for (const [id, value] of Object.entries(old.final.progression.mastery)) assert.equal(s.progression.mastery[id], value);
  assert.equal(s.progression.mastery[NEW_IDS[0]], attempt('tired-guest').vitalityRestored > 0 ? 8 : 0);
  assert.equal(s.progression.mastery[NEW_IDS[1]], 0, 'An unapplied shelter window earns no mastery');
  assert(life().beads.filter(b => b.purpose === 'LIFE').every(b => b.location === 'RETURN_TRAY'));
  snapshot('practiced');
  for (let n = 0; n < 3; n++) {
    ready({cash: 60, ap: 2}); const cash = s.cash, before = life().beads.length;
    lg({type: 'PREPARE_BATTLE_BEAD'}, `paid-battle-bead-${n + 1}`);
    assert.equal(s.cash, cash - 60); assert.equal(life().beads.length, before + 1);
    const b = life().beads.at(-1); assert.equal(b.purpose, 'COMBAT'); assert.equal(b.paidPennies, 60); assert.equal(b.status, 'READY'); clear();
  }
  restGuest();
  const held = s.witchKing.life.papers.find(p => p.status === 'HELD');
  if (held) {
    assert.equal(held.id, 'WK4-PAPER-1-3'); ready({ap: 2, spirituality: 3});
    const spirituality = s.spirituality; lg({type: 'PREPARE_PAPER', paperId: held.id}, 'original-held-paper-actually-prepared');
    assert.equal(s.witchKing.life.papers.find(p => p.id === held.id).status, 'PREPARED');
    assert.equal(s.spirituality, spirituality - 3); clear();
  }
  recoverOriginalInjuries();
  ready({cash: 20, ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0});
  assert.equal(s.injuries.length, 0); assert.equal(s.injuryRisk, 0); assertLegacyPreserved();
  // Only this original Adrian scene receives a newly paid invitation.
  startAndResolveEncounter();
  assertLegacyPreserved();
  await save(s.status === 'ACTIVE' ? 'FULL_NATURAL_BRANCH' : 'ACTUAL_COMBAT_DEATH');
} catch (error) {
  const blocker = {creation, seed, sourceFixture, commands, prefixCount, prefixVerified,
    ...snapshots, beforeLast, lastIntent, pendingIntent, final: s, public: s ? publicState() : null,
    recovery, treatments, streams, boundaryManifest, error: String(error), stack: error.stack};
  write(`${outputDir}/blocker.json`, blocker); write(`${outputDir}/boundary-manifest.json`, boundaryManifest);
  saveBoundaryObject(`${outputDir}/boundaries.json`);
  write('output/play/life-giver-stage-blocker.json', blocker);
  throw error;
}

/** Stream one top-level entry. Large boundary fixtures must not allocate the
 * complete UTF-16 document beside a renderer and its saved-state trees. */
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
