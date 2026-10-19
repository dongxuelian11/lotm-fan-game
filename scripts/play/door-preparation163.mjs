import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run from the repository root after its normal build. This is one finite,
// same-seed public-command branch, never a continuation of the original death.
const source = 'tests/fixtures/secrets-sorcerer-v01270/natural-failure.json';
const fixtureRoot = 'tests/fixtures/preparation-audit-v01630';
const outputStem = 'output/play/preparation163-door';
const prefixCount = 353;
const targetId = 'SS4-ARCH-B';
const bottleId = 'secrets-sorcerer-potion-2';
const clone = value => structuredClone(value);
const boundaries = {}, commands = [], suffixCommands = [], teaching = [];
let sourceText, old, initial, branchInitial, originalResult, s, beforeLast = null, lastIntent = null;
let createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState, migrateSliceState;
let phase = 'LOAD', prefixVerified = false, preserved = null, combatStart = null, consumeBlockedReason = null;
const provenance = {
  kind: 'SAME_SEED_PUBLIC_NATURAL_PREPARATION_BRANCH', source, prefixCount,
  originalFullCommandCount: 359, newRandomChanges: false,
  branchOrigin: 'Separately captured living prefix 353 while replaying all 359 original commands; original death is verified and retained.',
  policy: 'Exactly FLASH, COURAGE, then FLASH in a later real week; WORK/REST to H100/M100/S100, AP3, cash>=300 and pollution0; original B only, CONTROL until current restraintMarks===2 then PREPARE, RETREAT at H<=40; consume only the bound original bottle if genuinely eligible; END_RITUAL if alive; stop.'
};
function write(path, data) { writeFileSync(path, JSON.stringify(data)); }
function snapshot() {
  return { provenance, source, creation: old?.creation ?? null, seed: old?.seed ?? null,
    initial: initial ?? null, prefixCount, prefixVerified, branchInitial: branchInitial ?? null,
    originalResult: originalResult ?? null, phase, commands, allCommands: commands, suffixCommands,
    teaching, combatStart, consumeBlockedReason, beforeLast, lastIntent, final: s ?? null };
}
function boundary(key) {
  assert(!boundaries[key], `Duplicate boundary ${key}`);
  boundaries[key] = { beforeLast: clone(beforeLast), lastIntent: clone(lastIntent), final: clone(s) };
}
function preserveHistory() {
  if (!preserved) return;
  const r = s.secretsSorcerer.ritual;
  assert.deepEqual(r.targets.find(t => t.id === 'SS4-ARCH-A'), preserved.targetA, 'Original living A capture');
  assert.deepEqual(r.targets.find(t => t.id === 'SS4-ARCH-C'), preserved.targetC, 'No alternative target');
  assert.deepEqual(r.cases.find(c => c.id === 'SS4-CASE-1'), preserved.caseA, 'Archived original frame');
  assert.deepEqual(r.attempts[0], preserved.attemptA, 'Original first attempt');
  assert.deepEqual(s.secretsSorcerer.bottles[0], preserved.bottleA, 'Original potion FAILURE');
  assert.deepEqual(s.secretsSorcerer.bottles[2], preserved.bottleC, 'Unused third original bottle');
  assert.deepEqual(s.recorder.records.slice(0, preserved.records.length), preserved.records, 'Already released records');
  assert.deepEqual(s.recorder.demonstrations.slice(0, preserved.demos.length), preserved.demos, 'Original teaching history');
}
function go(intent, key = null) {
  assert.equal(s.status, 'ACTIVE', 'No command after actual death');
  assert(suffixCommands.length < 500, 'Finite preparation/one-fight safety guard');
  beforeLast = clone(s); lastIntent = clone(intent);
  s = applySliceIntent(s, intent); assertValidSliceState(s);
  commands.push(clone(intent)); suffixCommands.push(clone(intent));
  assert.equal(s.random.seed, old.seed); assert(s.random.cursor >= beforeLast.random.cursor);
  preserveHistory();
  if (key) boundary(key);
  console.log(JSON.stringify({ step: commands.length, phase, intent, week: s.week, H: s.health,
    M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, status: s.status,
    ritual: s.secretsSorcerer.ritual.phase }));
}
function clear() {
  for (let n = 0; s.activeEvent && n < 20; n++) {
    const e = projectSliceState(s).activeEvent;
    const choiceId = e.id.startsWith('ORIGIN') ? '.decline' : e.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : e.id === 'DEBT-NOTICE-01' ? 'DECLINE' : e.id === 'DEBT-SETTLE-01' ? 'DEFER' : null;
    assert(choiceId, `Unexpected real event ${e.id}; stop rather than manufacture treatment or choices`);
    assert(e.choices.some(c => c.id === choiceId && c.enabled), `Unavailable event choice ${e.id}/${choiceId}`);
    go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId });
  }
  assert.equal(s.activeEvent, null);
}
function ordinary() {
  clear(); assert.equal(s.combat, null); assert.equal(projectSliceState(s).secretsSorcerer.insideCase, false);
  assert(projectSliceState(s).canAct, projectSliceState(s).actionBlockedReason ?? 'Ordinary action unavailable');
  go({ type: 'ACTION', action: s.wagePaidWeek === s.week ? 'REST' : 'WORK' }); clear();
}
function ready(predicate) { clear(); for (let n = 0; !predicate(); n++) { assert(n < 150, 'Readiness blocked'); ordinary(); } }
function sorcerer(command, key) {
  const a = projectSliceState(s).secretsSorcerer.actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  assert(a?.enabled, a?.reason ?? `Missing public sorcerer action ${JSON.stringify(command)}`);
  go({ type: 'SECRETS_SORCERER', command }, key);
}
function record(sample, key) {
  ready(() => s.actionsRemaining >= 2 && s.spirituality >= 3 && s.recorder.lastAttemptWeek[sample] !== s.week);
  const a = projectSliceState(s).traveler.actions.find(a => a.command.type === 'RECORD_SAMPLE' && a.command.sample === sample);
  assert(a?.enabled, a?.reason ?? `Original ${sample} teacher is unavailable`);
  const prior = clone(s), actorId = sample === 'FLASH' ? 'NORA' : 'SAFF';
  const actor = prior.recorder.instructorSpirituality[actorId];
  const expectedTeacher = Math.min(20, actor.spirituality + Math.max(0, prior.week - (actor.restWeek ?? prior.recorder.promotionWeek ?? prior.week)) * 2) - 2;
  assert(expectedTeacher >= 0, 'Actual original teacher must have 2S');
  go({ type: 'TRAVELER', command: { type: 'RECORD_SAMPLE', sample } }, key);
  assert.equal(s.week, prior.week); assert.equal(s.actionsRemaining, prior.actionsRemaining - 1);
  assert.equal(s.spirituality, prior.spirituality - 3);
  assert.equal(s.recorder.instructorSpirituality[actorId].spirituality, expectedTeacher);
  assert.equal(s.recorder.demonstrations.length, prior.recorder.demonstrations.length + 1);
  const demo = s.recorder.demonstrations.at(-1);
  assert.equal(demo.sample, sample); assert.equal(demo.actor, actorId); assert.equal(demo.week, prior.week);
  assert(s.lastCheck && s.random.cursor === prior.random.cursor + 1, 'Retain actual knowledge check and RNG advance');
  const added = s.recorder.records.slice(prior.recorder.records.length);
  assert.equal(added.length, demo.success ? 1 : 0);
  if (demo.success) { assert.equal(added[0].sourceDemoId, demo.id); assert.equal(added[0].status, 'STORED'); }
  teaching.push({ sample, week: prior.week, actorId, playerCostS: 3, teacherCostS: 2,
    instructorBefore: actor, instructorAfter: clone(s.recorder.instructorSpirituality[actorId]),
    check: clone(s.lastCheck), demonstration: clone(demo), addedRecords: clone(added) });
  clear();
}
try {
  mkdirSync(fixtureRoot, { recursive: true }); mkdirSync('output/play', { recursive: true });
  sourceText = readFileSync(source, 'utf8'); old = JSON.parse(sourceText);
  ({ createSliceRun, applySliceIntent, projectSliceState, assertValidSliceState } = await import(pathToFileURL(resolve('dist/domain/slice/index.js')).href));
  ({ migrateSliceState } = await import(pathToFileURL(resolve('dist/domain/slice/migration.js')).href));
  assert.equal(old.commands.length, 359);
  assert.deepEqual(old.commands[353], { type: 'SECRETS_SORCERER', command: { type: 'SURVEY_RITUAL', targetId } });
  phase = 'VERIFY_COMPLETE_ORIGINAL';
  let originalState = createSliceRun(old.final.runId, old.creation, old.seed), capturedLivingPrefix = null;
  initial = clone(originalState);
  for (const [i, intent] of old.commands.entries()) {
    beforeLast = clone(originalState); lastIntent = clone(intent);
    originalState = applySliceIntent(originalState, intent); assertValidSliceState(originalState);
    if (i + 1 === prefixCount) capturedLivingPrefix = clone(originalState);
  }
  originalResult = { commandCount: 359, migratedFinalVerified: false, final: clone(originalState),
    terminal: clone(originalState.combatHistory.at(-1)), beforeLast: clone(beforeLast), lastIntent: clone(lastIntent) };
  assert.deepEqual(originalState, migrateSliceState(old.final), 'All 359 original commands must match the migrated original death');
  assert.equal(originalState.status, 'DEAD'); assert.equal(originalState.health, 0);
  originalResult.migratedFinalVerified = true;
  // The dead originalState is never assigned to s or used for any new command.
  assert(capturedLivingPrefix); s = clone(capturedLivingPrefix); branchInitial = clone(s);
  assert.equal(s.status, 'ACTIVE'); assert.equal(s.revision, 354); assert.equal(s.week, 95);
  assert.equal(s.progression.sequence, 5); assert.equal(s.progression.acting, 100);
  assert.equal(s.health, 100); assert.equal(s.mind, 100); assert.equal(s.spirituality, 100);
  assert.equal(s.cash, 430); assert.equal(s.actionsRemaining, 3); assert.equal(s.seer.pollution, 0);
  assert.deepEqual(s.injuries, []); assert.equal(s.injuryRisk, 0); assert.equal(s.combat, null); assert.equal(s.activeEvent, null);
  assert.equal(s.secretsSorcerer.ritual.phase, 'CLOSED');
  assert.equal(s.random.seed, old.seed); assert.equal(s.random.cursor, 220);
  const r = s.secretsSorcerer.ritual;
  preserved = { targetA: clone(r.targets[0]), targetC: clone(r.targets[2]), caseA: clone(r.cases[0]),
    attemptA: clone(r.attempts[0]), bottleA: clone(s.secretsSorcerer.bottles[0]), bottleC: clone(s.secretsSorcerer.bottles[2]),
    records: clone(s.recorder.records), demos: clone(s.recorder.demonstrations) };
  assert.equal(preserved.targetA.status, 'SEALED'); assert(preserved.targetA.body.health > 0);
  assert.equal(preserved.caseA.location, 'ARCHIVE'); assert.equal(preserved.caseA.custody, 'ARCHIVE');
  assert.equal(preserved.bottleA.status, 'CONSUMED'); assert.equal(preserved.bottleA.outcome, 'FAILURE');
  assert(s.recorder.records.every(record => record.status === 'RELEASED'));
  assert.equal(s.secretsSorcerer.bottles.find(b => b.id === bottleId).status, 'PLAYER');
  commands.push(...clone(old.commands.slice(0, prefixCount))); prefixVerified = true;
  beforeLast = null; lastIntent = null;
  phase = 'REAL_TEACHING_NO_INITIAL_WOUND_TO_TREAT';
  record('FLASH', 'record-flash-1'); record('COURAGE', 'record-courage-1');
  const firstFlashWeek = teaching[0].week;
  ready(() => s.week > firstFlashWeek); record('FLASH', 'record-flash-2');
  assert.equal(teaching.length, 3); assert(teaching[2].week > firstFlashWeek);
  phase = 'RESTORE_BEFORE_ORIGINAL_B';
  ready(() => s.health === 100 && s.mind === 100 && s.spirituality === 100 && s.actionsRemaining === 3 && s.cash >= 300 && s.seer.pollution === 0);
  assert.deepEqual(s.injuries, []); assert.equal(s.injuryRisk, 0);
  phase = 'ONE_ORIGINAL_B_ATTEMPT';
  sorcerer({ type: 'SURVEY_RITUAL', targetId }, 'survey-original-b');
  assert.equal(s.secretsSorcerer.ritual.currentTargetId, targetId);
  const cashBeforeFrame = s.cash;
  sorcerer({ type: 'PREPARE_SEAL' }, 'prepare-original-b-frame');
  assert.equal(s.cash, cashBeforeFrame - 300); assert.equal(s.secretsSorcerer.ritual.phase, 'PREPARED');
  sorcerer({ type: 'START_RITUAL', bottleId, confirmed: true }, 'start-original-b'); combatStart = clone(s);
  assert.equal(s.secretsSorcerer.ritual.bottleId, bottleId);
  for (let n = 0; s.combat; n++) {
    assert(n < 100, 'One actual fight did not terminate');
    go({ type: 'COMBAT_ROUND', stance: s.health <= 40 ? 'RETREAT' : s.secretsSorcerer.ritual.restraintMarks === 2 ? 'PREPARE' : 'CONTROL' }, n === 0 ? 'first-round' : null);
    if (!s.combat) boundary('terminal-round');
  }
  if (s.status === 'ACTIVE' && s.secretsSorcerer.ritual.phase === 'SEALED') {
    const command = { type: 'CONSUME', bottleId, confirmed: true };
    const a = projectSliceState(s).secretsSorcerer.actions.find(a => a.command.type === 'CONSUME' && a.command.bottleId === bottleId);
    if (a?.enabled) sorcerer(command, 'consume-bound-original-bottle');
    else consumeBlockedReason = a?.reason ?? 'Bound original bottle is not exposed as an eligible public consume action';
  }
  if (s.status === 'ACTIVE') sorcerer({ type: 'END_RITUAL' }, 'actual-living-exit');
  preserveHistory();
  assert.deepEqual(commands.slice(0, prefixCount), old.commands.slice(0, prefixCount));
  assert.deepEqual(commands.slice(prefixCount), suffixCommands);
  assert.equal(readFileSync(source, 'utf8'), sourceText, 'Original fixture remains byte-for-byte untouched');
  phase = s.status === 'DEAD' ? 'ACTUAL_PREPARED_BRANCH_DEATH' : consumeBlockedReason ? 'ACTUAL_SEAL_CONSUME_BLOCKED_AND_EXITED'
    : s.progression.sequence === 4 ? 'ACTUAL_PROMOTION_AND_EXIT_STOPPED' : 'ACTUAL_SINGLE_ATTEMPT_AND_EXIT_STOPPED';
  const data = { ...snapshot(), initialCare: 'NO_WOUNDS_NO_TREATMENT_INDICATED',
    stage: phase, outcome: clone(s.secretsSorcerer.ritual.attempts.at(-1)) };
  write(`${fixtureRoot}/door-natural.json`, data); write(`${fixtureRoot}/door-boundaries.json`, boundaries);
  write(`${outputStem}-natural.json`, data); write(`${outputStem}-boundaries.json`, boundaries);
  for (const [key, value] of Object.entries(boundaries)) write(`${outputStem}-${key}-save-boundary.json`, value);
  console.log(JSON.stringify({ passed: true, stage: phase, commands: commands.length, prefixCount, teaching,
    status: s.status, sequence: s.progression.sequence, outcome: data.outcome, consumeBlockedReason, boundaries: Object.keys(boundaries) }));
} catch (error) {
  mkdirSync('output/play', { recursive: true });
  write(`${outputStem}-blocker.json`, { ...snapshot(), boundaries, error: String(error), stack: error.stack,
    originalSourceUnchanged: sourceText == null ? null : readFileSync(source, 'utf8') === sourceText });
  throw error;
}
