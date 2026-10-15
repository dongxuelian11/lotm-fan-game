import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Historical rule-v1 observation runner: omitted huntBehaviorVersion intentionally replays the earlier public commands.
// Current UI and silver-preparation163-v2.mjs explicitly send version2 for new investigations.
// Run from the repository root after its normal build. Exactly one new hunt per
// species; living surrender/retreat is retained and never converted into remains.
const source = 'tests/fixtures/silver-knight-v01520/natural.json';
const fixtureRoot = 'tests/fixtures/preparation-audit-v01630';
const outputStem = 'output/play/preparation163-silver';
const prefixCount = 380;
const species = ['ROCK_HUSK', 'EMBER_WING', 'MIST_ANTLER', 'THORN_SHADOW', 'RESONANT_BONE', 'FROST_SPINE'];
const oldRoots = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter'];
const clone = value => structuredClone(value);
const boundaries = {}, commands = [], suffixCommands = [], huntResults = [], medical = [], completedBodies = [];
let sourceText, old, initial, branchInitial, originalResult, s, beforeLast = null, lastIntent = null;
let createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState, migrateSliceState;
let phase = 'LOAD', prefixVerified = false, preserved = null, medicalOrdinal = 0;
const provenance = {
  kind: 'SAME_SEED_PUBLIC_NATURAL_PREPARATION_CONTINUATION', source, prefixCount,
  originalFullCommandCount: 380, newRandomChanges: false,
  policy: 'Replay all original commands and verify the migrated living final. Keep both surrendered ROCK_HUSK bodies and six old pathway roots. Discover clinic once while clean. One finite pass: third ROCK_HUSK, then each remaining original species. Investigate, pay120 for one target-bound batch, actual WORK/REST preparation; CONTROL first round, then ATTACK, RETREAT at H<=40 or M<=20. Collect only actual unique death remains; retain living exits and continue if alive. Genuine later heavy injury receives actual PAY60 and later REST. Stop at death, six attempted species, or fully ready for a future ritual. No club purchase or promotion attempt.'
};
const write = (path, data) => writeFileSync(path, JSON.stringify(data));
function snapshot() {
  return { provenance, source, creation: old?.creation ?? null, seed: old?.seed ?? null,
    initial: initial ?? null, prefixCount, prefixVerified, branchInitial: branchInitial ?? null,
    originalResult: originalResult ?? null, phase, commands, allCommands: commands, suffixCommands,
    huntResults, medical, beforeLast, lastIntent, final: s ?? null };
}
function boundary(key) {
  assert(!boundaries[key], `Duplicate boundary ${key}`);
  boundaries[key] = { beforeLast: clone(beforeLast), lastIntent: clone(lastIntent), final: clone(s) };
}
function preserveHistory() {
  if (!preserved) return;
  for (const key of oldRoots) assert.deepEqual(s[key], preserved.roots[key], `Original ${key} history`);
  for (const b of [...preserved.surrendered, ...completedBodies])
    assert.deepEqual(s.silverKnight.encounter.hunts.find(h => h.id === b.id), b, `Retain original/finished body ${b.id}`);
  assert.deepEqual(s.silverKnight.ritual, preserved.ritual, 'No altar, blessing or promotion branch');
  assert.deepEqual(s.silverKnight.bottles, preserved.bottles, 'Original unconsumed bottles');
  assert.deepEqual(s.silverKnight.preparations, preserved.preparations, 'Original three ritual preparations');
  assert.deepEqual(s.town, preserved.town, 'No club purchase/equipment or bandage shortcut');
  assert.equal(s.progression.sequence, 4);
}
function go(intent, key = null) {
  assert.equal(s.status, 'ACTIVE', 'No automatic command after actual death');
  assert(suffixCommands.length < 1200, 'Finite six-hunt preparation safety guard');
  beforeLast = clone(s); lastIntent = clone(intent);
  s = applySliceIntent(s, intent); assertValidSliceState(s);
  commands.push(clone(intent)); suffixCommands.push(clone(intent));
  assert.equal(s.random.seed, old.seed); assert(s.random.cursor >= beforeLast.random.cursor);
  preserveHistory(); if (key) boundary(key);
  console.log(JSON.stringify({ step: commands.length, phase, intent, week: s.week,
    H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, status: s.status }));
}
function clear() {
  for (let n = 0; s.activeEvent && n < 20; n++) {
    const e = projectSliceState(s).activeEvent;
    if (e.id === 'LIFE-CARE-01') {
      const wounds = s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null);
      assert(wounds.length > 0, 'Never pay for an invented wound');
      assert(s.careKnown && s.world.careAvailable && s.cash >= 60, 'Actual clinic and PAY60 cash required');
      assert(e.choices.some(c => c.id === 'PAY' && c.enabled), 'Actual PAY choice must be enabled');
      const prior = clone(s), ordinal = ++medicalOrdinal;
      go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: 'PAY' }, `medical-${ordinal}-pay60`);
      assert.equal(s.health, prior.health, 'Treatment itself does not heal health');
      assert.equal(s.injuryRisk, prior.injuryRisk, 'Treatment itself does not erase risk');
      assert.equal(s.injuries.length, prior.injuries.length);
      for (const wound of wounds) {
        const after = s.injuries.find(i => i.id === wound.id);
        assert(after); assert.equal(after.treatedRevision, prior.revision + 1);
        assert.deepEqual({ ...after, treatedRevision: null }, wound);
      }
      assert(s.cash <= prior.cash - 60, 'Actual PAY60 debit, possibly followed by real week costs');
      medical.push({ ordinal, eventInstanceId: prior.activeEvent.instanceId, treatmentCostPence: 60,
        cashBefore: prior.cash, cashAfter: s.cash, weekBefore: prior.week, weekAfter: s.week,
        treatmentRevision: s.revision, woundIds: wounds.map(i => i.id), healedRevision: null });
      continue;
    }
    const choiceId = e.id.startsWith('ORIGIN') ? '.decline' : e.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : e.id === 'DEBT-NOTICE-01' ? 'DECLINE' : e.id === 'DEBT-SETTLE-01' ? 'DEFER' : null;
    assert(choiceId, `Unexpected real event ${e.id}; do not substitute credit/aid or erase wounds`);
    assert(e.choices.some(c => c.id === choiceId && c.enabled), `Unavailable event choice ${e.id}/${choiceId}`);
    go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId });
  }
  assert.equal(s.activeEvent, null);
}
function ordinary(forcedAction = null) {
  clear(); assert.equal(s.combat, null); assert.equal(projectSliceState(s).silverKnight.insideCase, false);
  const projection = projectSliceState(s);
  assert(projection.canAct, projection.actionBlockedReason ?? 'Ordinary action unavailable');
  const action = forcedAction ?? (s.wagePaidWeek === s.week ? 'REST' : 'WORK');
  const pending = medical.filter(m => m.healedRevision === null);
  const untreated = s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null);
  if (action === 'REST' && untreated) assert(s.cash >= 60, 'Preserve cash for actual treatment before triggering invitation');
  go({ type: 'ACTION', action });
  if (s.activeEvent && projectSliceState(s).activeEvent.id === 'LIFE-CARE-01') boundary(`medical-${medicalOrdinal + 1}-invite-rest`);
  for (const m of pending) if (m.woundIds.every(id => !s.injuries.some(i => i.id === id))) {
    assert.equal(action, 'REST'); assert(beforeLast.revision >= m.treatmentRevision);
    assert(s.health >= 80, 'Heavy wounds clear only on genuine later healthy REST');
    boundary(`medical-${m.ordinal}-later-rest`); m.healedRevision = s.revision;
  }
  clear();
}
function ready({ ap = 1, cash = 0, health = 0, mind = 0, spirituality = 0, pollution = 100, afterWeek = -1 } = {}) {
  clear();
  for (let n = 0; s.actionsRemaining < ap || s.cash < cash || s.health < health || s.mind < mind || s.spirituality < spirituality || s.seer.pollution > pollution || s.week <= afterWeek; n++) {
    assert(n < 200, 'Readiness blocked'); ordinary();
  }
}
function recoverActualWounds() {
  clear();
  for (let n = 0; s.injuries.length; n++) {
    assert(n < 200, 'Actual medical recovery remains blocked');
    assert.equal(s.status, 'ACTIVE');
    const untreated = s.injuries.some(i => i.severity === 'HEAVY' && i.treatedRevision === null);
    if (untreated) {
      assert(s.careKnown && s.world.careAvailable, 'Actual clinic is unavailable; retain the medical blocker');
      assert(s.cash >= 60, 'Actual PAY60 cash is insufficient; retain the medical blocker');
      assert.notEqual(s.lastMedicalInviteWeek, s.week, 'Already invited this week; retain the actual medical blocker rather than silently waiting');
    }
    ordinary('REST');
  }
  assert.equal(s.injuryRisk, 0);
}
function knight(command, key = null) {
  const a = projectSliceState(s).silverKnight.actions.find(a => JSON.stringify(a.command) === JSON.stringify(command) || command.type === 'INVESTIGATE_HUNT' && a.command.type === command.type && a.command.speciesId === command.speciesId);
  assert(a?.enabled, a?.reason ?? `Missing public silver-knight action ${JSON.stringify(command)}`);
  go({ type: 'SILVER_KNIGHT', command }, key);
}
const current = speciesId => s.silverKnight.encounter.hunts.filter(h => h.speciesId === speciesId).at(-1);
function hunt(speciesId) {
  const key = speciesId.toLowerCase();
  phase = `PREPARE_${speciesId}`;
  recoverActualWounds();
  const priorBody = clone(current(speciesId));
  if (speciesId === 'ROCK_HUSK') {
    assert.equal(priorBody.id, 'SK3-HUNT-ROCK_HUSK-2'); assert.equal(priorBody.status, 'SURRENDERED');
    ready({ afterWeek: priorBody.attempts.at(-1).week });
  } else { assert.equal(priorBody.instance, 1); assert.equal(priorBody.status, 'UNSEEN'); }
  ready(); knight({ type: 'INVESTIGATE_HUNT', speciesId }, `${key}-investigate`); clear();
  const bodyId = current(speciesId).id;
  assert.equal(bodyId, speciesId === 'ROCK_HUSK' ? 'SK3-HUNT-ROCK_HUSK-3' : priorBody.id);
  assert.equal(current(speciesId).attempts.length, 0, 'One new attempt only');
  if (current(speciesId).resources.preparationWeek === null) {
    // 120 coating + 60 genuine treatment reserve + 30 ordinary weekly expense.
    ready({ ap: 2, cash: 210 });
    const cash = s.cash, week = s.week;
    knight({ type: 'PREPARE_HUNT', speciesId }, `${key}-prepare`);
    assert.equal(s.week, week); assert.equal(s.cash, cash - 120);
    const resource = current(speciesId).resources;
    assert.equal(resource.preparationCostPence, 120); assert.equal(resource.coatings.length, 2);
    assert(resource.coatings.every(c => c.status === 'SEALED' && c.targetId === bodyId));
    clear();
  }
  ready({ cash: 90, health: 100, mind: 100, spirituality: 120, pollution: 0 });
  assert.deepEqual(s.injuries, []); assert.equal(s.injuryRisk, 0);
  assert.notEqual(s.town.clubLocation, 'HAND', 'Preserve the actual inherited dawn-sword route');
  phase = `ONE_${speciesId}_FIGHT`;
  knight({ type: 'HUNT_FIGHT', speciesId }, `${key}-fight`);
  for (let round = 0; s.combat; round++) {
    assert(round < 100, 'One actual hunt did not terminate');
    const stance = s.health <= 40 || s.mind <= 20 ? 'RETREAT' : round === 0 ? 'CONTROL' : 'ATTACK';
    go({ type: 'COMBAT_ROUND', stance }, round === 0 ? `${key}-first-round` : null);
    if (!s.combat) boundary(`${key}-terminal-round`);
  }
  let b = current(speciesId);
  assert.equal(b.id, bodyId); assert.equal(b.attempts.length, 1); assert(b.attempts[0].terminal);
  const result = { speciesId, targetId: bodyId, terminal: clone(b.attempts[0].terminal),
    bodyAtTerminal: clone(b), playerAtTerminal: { status: s.status, week: s.week, health: s.health,
      mind: s.mind, spirituality: s.spirituality, injuries: clone(s.injuries), injuryRisk: s.injuryRisk }, remains: null };
  huntResults.push(result);
  if (s.status !== 'ACTIVE') return;
  if (b.status === 'DEAD') {
    assert.equal(b.enemyHealth, 0); assert.equal(result.terminal.outcome, 'ENEMY_DEAD');
    ready(); knight({ type: 'COLLECT_REMAINS', speciesId }, `${key}-collect-unique-remains`); clear();
    b = current(speciesId);
    const matches = s.silverKnight.encounter.remains.filter(r => r.instanceId === bodyId);
    assert.equal(matches.length, 1); assert.equal(matches[0].id, b.remainsId);
    assert.equal(matches[0].killedBy, 'PLAYER'); assert.equal(matches[0].outcome, 'ENEMY_DEAD');
    result.remains = clone(matches[0]);
  } else {
    assert(['SURRENDERED', 'RETREATED'].includes(b.status)); assert(b.enemyHealth > 0);
    assert.equal(b.remainsId, null); assert(!s.silverKnight.encounter.remains.some(r => r.instanceId === bodyId));
  }
  completedBodies.push(clone(b));
  phase = `RECOVER_AFTER_${speciesId}`; recoverActualWounds();
}
try {
  mkdirSync(fixtureRoot, { recursive: true }); mkdirSync('output/play', { recursive: true });
  sourceText = readFileSync(source, 'utf8'); old = JSON.parse(sourceText);
  ({ createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } = await import(pathToFileURL(resolve('dist/domain/slice/index.js')).href));
  ({ migrateSliceState } = await import(pathToFileURL(resolve('dist/domain/slice/migration.js')).href));
  assert.equal(old.commands.length, prefixCount);
  phase = 'VERIFY_COMPLETE_ORIGINAL'; s = createSliceRun(old.final.runId, old.creation, old.seed); initial = clone(s);
  for (const intent of old.commands) {
    beforeLast = clone(s); lastIntent = clone(intent);
    s = applySliceIntent(s, intent); assertValidSliceState(s); commands.push(clone(intent));
  }
  originalResult = { commandCount: prefixCount, migratedFinalVerified: false, final: clone(s), beforeLast: clone(beforeLast), lastIntent: clone(lastIntent) };
  assert.deepEqual(s, migrateSliceState(old.final), 'All 380 original commands equal migrated original final');
  originalResult.migratedFinalVerified = true;
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.revision, 381); assert.equal(s.week, 106);
  assert.equal(s.health, 100); assert.equal(s.mind, 100); assert.equal(s.spirituality, 110);
  assert.equal(s.cash, 80); assert.equal(s.actionsRemaining, 3); assert.equal(s.seer.pollution, 0);
  assert.deepEqual(s.injuries, []); assert.equal(s.injuryRisk, 0); assert.equal(s.activeEvent, null); assert.equal(s.combat, null);
  assert.equal(s.silverKnight.encounter.status, 'AVAILABLE'); assert.equal(s.silverKnight.encounter.remains.length, 0);
  assert.equal(s.random.seed, old.seed); assert.equal(s.random.cursor, 167);
  branchInitial = clone(s); prefixVerified = true;
  preserved = { roots: Object.fromEntries(oldRoots.map(k => [k, clone(s[k])])),
    surrendered: clone(s.silverKnight.encounter.hunts.filter(h => h.status === 'SURRENDERED')),
    ritual: clone(s.silverKnight.ritual), bottles: clone(s.silverKnight.bottles),
    preparations: clone(s.silverKnight.preparations), town: clone(s.town) };
  assert.equal(preserved.surrendered.length, 2);
  assert.deepEqual(preserved.surrendered.map(b => b.id), ['SK3-HUNT-ROCK_HUSK-1', 'SK3-HUNT-ROCK_HUSK-2']);
  assert(preserved.surrendered.every(b => b.enemyHealth === 70 && b.remainsId === null));
  assert.equal(preserved.town.clubLocation, 'SHOP');
  phase = 'DISCOVER_CLINIC_NO_INITIAL_WOUND_TO_TREAT';
  if (!s.careKnown) {
    const projection = projectSliceState(s);
    assert(projection.investigateTargets.some(t => t.id === 'CARE-ACCESS-01'));
    go({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, 'discover-clinic'); clear();
  }
  assert(s.careKnown); assert.deepEqual(s.injuries, []); assert.equal(medical.length, 0);
  for (const speciesId of species) { hunt(speciesId); if (s.status !== 'ACTIVE') break; }
  const remains = s.silverKnight.encounter.remains.filter(r => r.status === 'OWNER_PLAYER');
  const allSix = species.every(id => remains.some(r => r.speciesId === id));
  if (s.status === 'ACTIVE' && allSix) ready({ ap: 2, cash: 140, health: 100, mind: 100, spirituality: 120, pollution: 0 });
  preserveHistory();
  const meetingAction = projectSliceState(s).silverKnight.actions.find(a => a.command.type === 'RITUAL_REQUEST_MEETING');
  const readiness = { allSixActuallyCollected: allSix, ownedRemainsIds: remains.map(r => r.id),
    missingSpecies: species.filter(id => !remains.some(r => r.speciesId === id)),
    alive: s.status === 'ACTIVE', sequence: s.progression.sequence, acting: s.progression.acting,
    elapsedDemonHunterWeeks: s.week - s.demonHunter.promotionWeek,
    actionsRemaining: s.actionsRemaining, cash: s.cash, health: s.health, mind: s.mind, spirituality: s.spirituality,
    originalAnchorId: s.silverKnight.ritual.anchor?.id ?? null, preparationTaskIds: s.silverKnight.preparations.map(p => p.taskId),
    ownedBottleIds: s.silverKnight.bottles.filter(b => b.status === 'PLAYER').map(b => b.id),
    publicMeetingEnabled: meetingAction?.enabled ?? false, publicMeetingReason: meetingAction?.reason ?? null,
    blessingObtained: false, altarPrepared: false, potionConsumed: false, promoted: false };
  if (allSix && s.status === 'ACTIVE') assert(readiness.publicMeetingEnabled, readiness.publicMeetingReason ?? 'Future ritual not ready');
  assert.deepEqual(commands.slice(0, prefixCount), old.commands); assert.deepEqual(commands.slice(prefixCount), suffixCommands);
  if (s.status === 'ACTIVE') assert.equal(huntResults.length, 6);
  else assert(huntResults.length >= 1 && huntResults.length <= 6);
  assert.equal(new Set(huntResults.map(h => h.speciesId)).size, huntResults.length);
  assert.equal(suffixCommands.filter(i => i.type === 'SILVER_KNIGHT' && i.command.type === 'HUNT_FIGHT').length, huntResults.length);
  assert.equal(readFileSync(source, 'utf8'), sourceText, 'Original fixture remains byte-for-byte untouched');
  phase = s.status === 'DEAD' ? 'ACTUAL_PREPARED_HUNT_DEATH' : allSix ? 'ALL_SIX_ACTUALLY_COLLECTED_READY_FOR_FUTURE_RITUAL' : 'FINITE_SIX_SPECIES_PASS_ACTUAL_MISSING_REMAINS';
  const data = { ...snapshot(), initialCare: 'NO_WOUNDS_NO_TREATMENT_INDICATED', stage: phase, readiness };
  write(`${fixtureRoot}/silver-natural.json`, data); write(`${fixtureRoot}/silver-boundaries.json`, boundaries);
  write(`${outputStem}-natural.json`, data); write(`${outputStem}-boundaries.json`, boundaries);
  for (const [key, value] of Object.entries(boundaries)) write(`${outputStem}-${key}-save-boundary.json`, value);
  console.log(JSON.stringify({ passed: true, stage: phase, commands: commands.length, prefixCount, readiness,
    hunts: huntResults.map(h => ({ speciesId: h.speciesId, targetId: h.targetId, terminal: h.terminal, remains: h.remains?.id ?? null })),
    medical, boundaries: Object.keys(boundaries) }));
} catch (error) {
  mkdirSync('output/play', { recursive: true });
  write(`${outputStem}-blocker.json`, { ...snapshot(), boundaries, error: String(error), stack: error.stack,
    originalSourceUnchanged: sourceText == null ? null : readFileSync(source, 'utf8') === sourceText });
  throw error;
}
