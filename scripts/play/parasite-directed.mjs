/**
 * DIRECTED_RNG_BRANCH, not a natural playthrough.
 * Starts with the exact combatStart captured by parasite-stage.mjs. A bounded
 * search changes only that starting state's random.seed and random.cursor.
 * Every battle and closure command then uses applySliceIntent and the complete
 * state gate. No roll injection, body/resource edit, enemy replacement, repaired
 * outcome or change to the preserved natural fixture is permitted here.
 *
 * Outputs are actual public-command before/after inputs for the serial SQLite
 * verification harness. This script does not claim that SQLite has been run.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../dist/domain/slice/index.js';

const provenance = 'DIRECTED_RNG_BRANCH';
const sourceFixture = 'tests/fixtures/parasite-v01280/natural.json';
const sourceCheckpoint = 'combatStart';
const route = JSON.parse(readFileSync(sourceFixture, 'utf8'));
assert(route.combatStart, 'The preserved natural combatStart is required.');
const naturalStart = structuredClone(route.combatStart);
assertValidSliceState(naturalStart);
assert.equal(naturalStart.status, 'ACTIVE');
assert.equal(naturalStart.progression.pathwayId, 'error');
assert.equal(naturalStart.progression.sequence, 4);
assert.equal(naturalStart.combat?.encounterId, 'PARASITE_DISPUTE');
assert.equal(naturalStart.combat.round, 1);
assert.equal(naturalStart.parasite.encounter.targetId, 'PR4-RALF-TOREN');
assert.equal(naturalStart.parasite.encounter.borrowed.length, 0);

const randomPolicy = 'ONLY_STARTING_SEED_AND_CURSOR_REPLACED';
const searchLimit = 128;
const attempts = [];
const boundaries = {};
const records = [];
const commands = [];
let selectedInitial = null;
let s = null;
let beforeLast = null;
let lastIntent = null;
let selectedAttempt = null;
mkdirSync('output/play', { recursive: true });

function failure(error, phase, state = s, intent = lastIntent) {
  writeFileSync('output/play/parasite-directed-blocker.json', JSON.stringify({
    provenance, sourceFixture, sourceCheckpoint, randomPolicy, phase,
    sourceRandom: naturalStart.random, selectedAttempt, attempts, commands,
    selectedInitial, beforeLast, lastIntent: intent, final: state,
    error: String(error), stack: error?.stack,
  }));
}
function transition(before, intent, phase) {
  try {
    assertValidSliceState(before);
    const after = applySliceIntent(before, intent);
    assertValidSliceState(after);
    return after;
  } catch (error) {
    failure(error, phase, before, intent);
    throw error;
  }
}
function saveBoundary(key, before, intent, after, branch = 'ACQUIRED_POWER') {
  assert(!boundaries[key], `Do not overwrite the first ${key} boundary.`);
  const boundary = {
    provenance, kind: provenance, sourceFixture, sourceCheckpoint, randomPolicy,
    sourceRandom: structuredClone(naturalStart.random),
    selectedRandom: structuredClone(selectedInitial.random), selectedAttempt, branch,
    beforeLast: structuredClone(before), lastIntent: structuredClone(intent), final: structuredClone(after),
  };
  boundaries[key] = boundary;
  writeFileSync(`output/play/parasite-directed-${key}-save-boundary.json`, JSON.stringify(boundary));
}
function go(intent) {
  beforeLast = structuredClone(s); lastIntent = structuredClone(intent);
  s = transition(s, intent, 'CONTINUE_SELECTED_BRANCH');
  commands.push(structuredClone(intent));
  records.push({ beforeLast, lastIntent, final: structuredClone(s) });
  return s;
}

// Stop at the first actual R success. Survival or a favorable victory is not a
// search criterion; a real death is retained and reported as unavailable cleanup.
const acquireIntent = { type: 'COMBAT_ROUND', stance: 'PREPARE' };
for (let attempt = 0; attempt < searchLimit; attempt++) {
  const candidate = structuredClone(naturalStart);
  candidate.random = { seed: `parasite-directed-power-v01280-${attempt}`, cursor: 0 };
  assert.deepEqual({ ...candidate, random: naturalStart.random }, naturalStart,
    'The directed starting state may differ only in its disclosed RNG state.');
  assertValidSliceState(candidate);
  const after = transition(candidate, acquireIntent, `SEARCH_ATTEMPT_${attempt}`);
  attempts.push({ attempt, random: structuredClone(candidate.random),
    acquired: after.parasite.encounter.borrowed.map(p => ({ id: p.id, sourceId: p.sourceId, abilityId: p.abilityId, status: p.status })),
    playerStatus: after.status, playerHealth: after.health, enemyStatus: after.parasite.encounter.enemyStatus,
    enemyHealth: after.parasite.encounter.enemyHealth, combatContinues: after.combat !== null });
  if (after.parasite.encounter.borrowed.length === 0) continue;
  assert(after.parasite.encounter.borrowed.every(p => p.sourceId === naturalStart.parasite.encounter.targetId));
  assert.equal(after.parasite.encounter.targetId, naturalStart.parasite.encounter.targetId);
  selectedAttempt = attempt; selectedInitial = structuredClone(candidate); s = after;
  beforeLast = structuredClone(candidate); lastIntent = structuredClone(acquireIntent);
  commands.push(structuredClone(acquireIntent));
  records.push({ beforeLast, lastIntent, final: structuredClone(after) });
  saveBoundary('borrow', candidate, acquireIntent, after);
  break;
}
if (!s) {
  const error = new Error(`No actual R success in the declared ${searchLimit}-seed search; no state or result was repaired.`);
  failure(error, 'SEARCH_EXHAUSTED', naturalStart, acquireIntent);
  throw error;
}

const acquired = structuredClone(s);
// Use actual reasonable stances and the selected RNG without further edits.
// After two further CONTROL rounds, choose the real ordinary exit. A failed
// retreat and every injury/death remain genuine results of that same stream.
let followingRounds = 0;
while (s.combat && s.status === 'ACTIVE' && followingRounds < 100) {
  const stance = s.health <= 40 || followingRounds >= 2 ? 'RETREAT' : 'CONTROL';
  go({ type: 'COMBAT_ROUND', stance }); followingRounds++;
  if (s.combat === null) saveBoundary('combat-end', beforeLast, lastIntent, s);
}
if (s.combat) {
  const error = new Error('The selected original combat did not end within its finite100-round continuation budget.');
  failure(error, 'COMBAT_STILL_OPEN');
  throw error;
}
const postCombat = structuredClone(s);
const branches = {};
const closureUnavailable = [];

// These are independent alternative public commands from the same acquired
// power checkpoint after the actual fight ends, never a reset of a world actor.
for (const [key, type] of [['return-powers', 'RETURN_POWERS'], ['expire-powers', 'WAIT_POWER_EXPIRY']]) {
  const before = structuredClone(postCombat);
  const action = before.status === 'ACTIVE'
    ? projectSliceState(before).parasite.actions.find(a => a.command.type === type && a.enabled) : null;
  if (!action) {
    closureUnavailable.push({ type, reason: before.status !== 'ACTIVE'
      ? 'The actual selected branch ended in player death; terminal G closure evidence is retained.'
      : 'No still-open original loan remains after the actual combat result.' });
    continue;
  }
  const after = transition(before, { type: 'PARASITE', command: action.command }, `CLOSURE_${type}`);
  const intent = { type: 'PARASITE', command: structuredClone(action.command) };
  assert(after.parasite.encounter.borrowed.every(p => p.closedSeconds !== null));
  assert.equal(after.parasite.encounter.targetId, postCombat.parasite.encounter.targetId);
  assert.equal(after.parasite.encounter.enemySpirituality, postCombat.parasite.encounter.enemySpirituality);
  assert.equal(after.parasite.encounter.enemyHealth, postCombat.parasite.encounter.enemyHealth);
  assert.deepEqual(after.parasite.encounter.terminal, postCombat.parasite.encounter.terminal);
  assert.deepEqual(after.parasite.encounter.borrowed.map(p => [p.id, p.sourceId, p.abilityId, p.uses]),
    postCombat.parasite.encounter.borrowed.map(p => [p.id, p.sourceId, p.abilityId, p.uses]));
  saveBoundary(key, before, intent, after, type);
  branches[type] = { commands: [...commands, intent], beforeLast: before, lastIntent: intent, final: after };
}
assert.deepEqual(JSON.parse(readFileSync(sourceFixture, 'utf8')), route,
  'The preserved natural route must remain unchanged.');
const capture = {
  provenance, sourceFixture, sourceCheckpoint, randomPolicy,
  sourceRandom: naturalStart.random, selectedAttempt, searchLimit, attempts,
  selectedInitial, commands, acquired, postCombat, records, branches, closureUnavailable,
  boundaries: Object.keys(boundaries), beforeLast, lastIntent, final: postCombat,
  verification: 'Public-command/state-gate capture only; SQLite rollback/reopen/replay is a separate serial check.',
};
writeFileSync('output/play/parasite-stage-directed.json', JSON.stringify(capture));
mkdirSync('tests/fixtures/parasite-v01280', { recursive: true });
writeFileSync('tests/fixtures/parasite-v01280/directed.json', JSON.stringify(capture));
writeFileSync('tests/fixtures/parasite-v01280/directed-boundaries.json', JSON.stringify(boundaries));
console.log(JSON.stringify({
  passed: true, provenance, selectedAttempt, attemptedSeeds: attempts.length,
  commands: commands.length, playerStatus: postCombat.status, playerHealth: postCombat.health,
  terminal: postCombat.parasite.encounter.terminal,
  borrowed: postCombat.parasite.encounter.borrowed.map(p => ({ abilityId: p.abilityId, status: p.status, uses: p.uses })),
  boundaries: Object.keys(boundaries), closureUnavailable,
}));
