import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState} from '../../dist/domain/slice/index.js';

// This is an explicitly different choice at the original pre-combat branch.
// Recreate and replay the common public prefix; never load/continue the dead
// terminal state, change the seed, or replace the actual natural death capture.
const sourcePath = 'tests/fixtures/war-bishop-v01410/natural.json';
const boundariesPath = 'tests/fixtures/war-bishop-v01410/boundaries.json';
const sourceText = readFileSync(sourcePath, 'utf8');
const boundariesText = readFileSync(boundariesPath, 'utf8');
const source = JSON.parse(sourceText), sourceBoundaries = JSON.parse(boundariesText);
const creation = source.creation, seed = source.seed, commands = [];
let s = null, beforeLast = null, lastIntent = null, branchPoint = null, peacefulExitBoundary = null;
let sourcePrefixCount = null;
mkdirSync('output/play', {recursive: true});

function go(intent) {
  beforeLast = structuredClone(s);
  lastIntent = structuredClone(intent);
  assert(commands.length < 560, 'Bounded replay and two explicit branch actions');
  s = applySliceIntent(s, intent);
  assertValidSliceState(s);
  commands.push(structuredClone(intent));
}
function assertOriginalPeopleAndThings() {
  assert.equal(s.runId, source.final.runId);
  assert.equal(s.random.seed, seed);
  assert.equal(s.character.gender, branchPoint.character.gender);
  assert.deepEqual(s.ironBloodKnight, branchPoint.ironBloodKnight, 'All old people, resources, history and original objects remain unchanged');
  assert.deepEqual(s.warBishop.life, branchPoint.warBishop.life, 'Do not reopen, heal or rewrite completed practice');
  assert.deepEqual(s.warBishop.bottles, branchPoint.warBishop.bottles);
  assert.deepEqual(s.combatHistory, branchPoint.combatHistory, 'No battle happened in this separate branch');
  assert.equal(s.combat, null);
  assert.equal(s.warBishop.encounter.enemyHealth, branchPoint.warBishop.encounter.enemyHealth);
  assert.equal(s.warBishop.encounter.enemyMind, branchPoint.warBishop.encounter.enemyMind);
  assert.equal(s.warBishop.encounter.enemySpirituality, branchPoint.warBishop.encounter.enemySpirituality);
  assert.equal(s.warBishop.encounter.weaponLocation, branchPoint.warBishop.encounter.weaponLocation);
  assert.deepEqual(s.warBishop.encounter.powerUses, branchPoint.warBishop.encounter.powerUses);
  assert.equal(s.warBishop.encounter.invitedWeek, null);
  assert.equal(s.warBishop.encounter.attemptWeek, null);
  assert.equal(s.warBishop.encounter.startHistoryIndex, null);
  assert.equal(s.warBishop.encounter.terminal, null);
  assert.deepEqual(s.warBishop.encounter.companionIds, []);
  assert(s.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME'));
}

try {
  assert.equal(source.commands.length, 550, 'Use the verified actual natural death capture');
  assert.equal(source.stage, 'ACTUAL_COMBAT_DEATH');
  assert.equal(source.final.status, 'DEAD');
  assert.equal(source.final.warBishop.encounter.terminal.outcome, 'PLAYER_DEAD');
  assert.equal(source.final.warBishop.encounter.terminal.round, 7);
  const talkIndex = source.commands.findIndex(c => c.type === 'WAR_BISHOP' && c.command.type === 'ENCOUNTER_TALK');
  assert(talkIndex >= 0, 'The original public encounter conversation must exist');
  sourcePrefixCount = talkIndex + 1;
  assert.equal(sourcePrefixCount, 541);
  assert.deepEqual(source.commands[sourcePrefixCount], {type: 'WAR_BISHOP', command: {type: 'CALL_COMPANIONS'}});
  s = createSliceRun(source.final.runId, creation, seed);
  for (const intent of source.commands.slice(0, sourcePrefixCount)) go(intent);
  assert.deepEqual(s, sourceBoundaries['encounter-original-five'].beforeLast,
    'Replay exactly to the real, living invitation-before boundary');
  assert.deepEqual(commands, source.commands.slice(0, sourcePrefixCount));
  assert.equal(s.status, 'ACTIVE');
  assert.equal(s.warBishop.encounter.status, 'READY');
  assert.equal(s.activeEvent, null);
  branchPoint = structuredClone(s);

  go({type: 'WAR_BISHOP', command: {type: 'LEAVE_ENCOUNTER'}});
  peacefulExitBoundary = {beforeLast, lastIntent, final: structuredClone(s)};
  assert.equal(s.warBishop.encounter.status, 'RESOLVED');
  assert.equal(s.actionsRemaining, branchPoint.actionsRemaining, 'Peaceful exit costs no additional AP');
  assert.equal(s.cash, branchPoint.cash, 'No invitation charge or refund');
  assert.equal(s.health, branchPoint.health);
  assert.equal(s.mind, branchPoint.mind);
  assert.equal(s.spirituality, branchPoint.spirituality);
  assert.equal(s.random.cursor, branchPoint.random.cursor, 'Peaceful exit is not a rerolled combat');
  assertOriginalPeopleAndThings();
  assert(projectSliceState(s).canAct, 'The ordinary exit must really restore ordinary life access');
  const action = s.wagePaidWeek === s.week ? 'REST' : 'WORK';
  go({type: 'ACTION', action});
  assert.equal(s.status, 'ACTIVE');
  assert.equal(s.activeEvent, null);
  assert.equal(s.week, branchPoint.week);
  assert.equal(s.actionsRemaining, branchPoint.actionsRemaining - 1);
  assert.equal(s.cash, branchPoint.cash + (action === 'WORK' ? s.character.weeklyWage : 0));
  assertOriginalPeopleAndThings();
  assert.equal(commands.length, sourcePrefixCount + 2);
  assert.equal(readFileSync(sourcePath, 'utf8'), sourceText, 'Keep the actual natural death file byte-for-byte');
  assert.equal(readFileSync(boundariesPath, 'utf8'), boundariesText, 'Keep the original key boundaries byte-for-byte');

  const result = {creation, seed, commands, branchCommands: commands,
    sourceFixture: sourcePath, sourceCommandCount: source.commands.length, sourcePrefixCount,
    differentChoiceFromDeathBranch: true, stage: 'SEPARATE_PRECOMBAT_PEACEFUL_EXIT',
    sourceFinalOutcome: source.final.warBishop.encounter.terminal.outcome,
    divergence: {commandNumber: sourcePrefixCount + 1, deathBranchIntent: source.commands[sourcePrefixCount],
      peacefulBranchIntent: commands[sourcePrefixCount]},
    explanation: '同seed从新建周目重放共同541条公开命令后，在仍活着的原交谈处选择和平退出；这是另一个明确选择分支，不是死亡存档继续，也未撤销原七轮死亡事实。',
    branchPoint, peacefulExit: peacefulExitBoundary.final, peacefulExitBoundary, beforeLast, lastIntent, final: s};
  writeFileSync('output/play/war-bishop-peaceful-exit-save-boundary.json', JSON.stringify(peacefulExitBoundary));
  writeFileSync('output/play/war-bishop-peaceful-exit.json', JSON.stringify(result));
  mkdirSync('tests/fixtures/war-bishop-v01410', {recursive: true});
  writeFileSync('tests/fixtures/war-bishop-v01410/peaceful-exit.json', JSON.stringify(result));
  console.log(JSON.stringify({passed: true, stage: result.stage, differentChoiceFromDeathBranch: true,
    sourcePrefixCount, commands: commands.length, week: s.week, status: s.status,
    sequence: s.progression.sequence, acting: s.progression.acting, health: s.health,
    mind: s.mind, spirituality: s.spirituality, cash: s.cash, actionsRemaining: s.actionsRemaining,
    encounterStatus: s.warBishop.encounter.status, combatOccurred: false, originalDeathCapturePreserved: true}));
} catch (error) {
  writeFileSync('output/play/war-bishop-peaceful-exit-blocker.json', JSON.stringify({creation, seed,
    sourceFixture: sourcePath, sourcePrefixCount, differentChoiceFromDeathBranch: true,
    commands, branchPoint, peacefulExitBoundary, beforeLast, lastIntent, final: s,
    error: String(error), stack: error.stack}));
  throw error;
}
