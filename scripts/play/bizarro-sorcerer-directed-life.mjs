/** DIRECTED_RANDOM_NOT_NATURAL.
 * Legal starting point: the actual S4 promotion in the preserved natural route.
 * Only the first d100 check of CAPTURE_MOUSE, BEGIN_MOUSE_CONTROL and
 * COMPLETE_MOUSE_CONTROL is directed to its minimum. The original generator is
 * called first, so its actual cursor advances; all other draws and all later
 * actions retain the original RNG. No state, resource, week or outcome is edited.
 *
 * Purpose: cover the actual same-mouse conversion and finite one-worm/position
 * lifecycle that the preserved natural route did not reach. A subsequent failed
 * illusion remains failed and costs remain spent; the ordinary comparison then
 * completes that case. A failed swap returns physically and retries next real
 * week with the unchanged RNG. No later roll is changed to produce success.
 *
 * Independent SQLite tail-command inputs are emitted for worm assignment, use,
 * recall, successful outward swap and ordinary return. Those five tail commands
 * have NO injected draws. The separate three capture boundaries disclose their
 * directed draw and must not be replayed as if they were natural outcomes.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../dist/domain/slice/index.js';
import { DeterministicActionRandomStream } from '../../dist/resolution/deterministic-random.js';

const kind = 'DIRECTED_RANDOM_NOT_NATURAL';
const sourceFixture = 'tests/fixtures/bizarro-sorcerer-v01170/natural.json';
const route = JSON.parse(readFileSync(sourceFixture, 'utf8'));
assert(route.promoted, 'The actual natural promotion checkpoint must exist.');
let s = structuredClone(route.promoted);
assertValidSliceState(s);
assert.equal(s.status, 'ACTIVE');
assert.equal(s.progression.pathwayId, 'diviner');
assert.equal(s.progression.sequence, 4);
assert.equal(s.bizarroSorcerer.life.mouse.status, 'WILD');
assert(Object.values(s.bizarroSorcerer.life.cases).every(c => c.status === 'AVAILABLE'));
assert(s.bizarroSorcerer.ritual.attempts.some(a => a.killEvidence && a.consumedBottleId), 'Keep the actual witnessed kill and consumed original bottle.');
const initial = structuredClone(s), commands = [], records = [], boundaries = {}, directedChecks = [];
const oldMarionettist = structuredClone(s.marionettist);
let beforeLast = null, lastIntent = null, illusionSucceeded = false, actualSwapSucceeded = false;
mkdirSync('output/play', { recursive: true });

function directedMouseCheck(payload, operation) {
  assert.equal(payload.type, 'BIZARRO_SORCERER');
  assert(['CAPTURE_MOUSE', 'BEGIN_MOUSE_CONTROL', 'COMPLETE_MOUSE_CONTROL'].includes(payload.command.type));
  const original = DeterministicActionRandomStream.prototype.nextInt;
  const draws = [];
  DeterministicActionRandomStream.prototype.nextInt = function (minimum, maximum) {
    const cursorBefore = this.cursor;
    const natural = original.call(this, minimum, maximum);
    if (draws.length > 0) return natural;
    assert.equal(minimum, 1, 'The selected mouse check must be the first command draw.');
    assert.equal(maximum, 100, 'Only a d100 mouse check may be directed.');
    assert.equal(this.cursor, cursorBefore + 1, 'The real RNG cursor must advance normally.');
    draws.push({ command: payload.command.type, minimum, maximum, natural, returned: minimum, seed: this.seed, cursorBefore, cursorAfter: this.cursor });
    return minimum;
  };
  try {
    const result = operation();
    assert.equal(draws.length, 1, 'Exactly one selected mouse check must be consumed.');
    return { result, draws };
  } finally {
    DeterministicActionRandomStream.prototype.nextInt = original;
  }
}

function saveBoundary(key, injectedDraws = []) {
  assert(!boundaries[key], `Do not overwrite the first real ${key} boundary.`);
  const boundary = { kind, sourceFixture, sourceCheckpoint: 'promoted',
    injectedDraws, randomPolicy: injectedDraws.length ? 'ONLY_FIRST_MOUSE_D100_MINIMUM_WITH_REAL_CURSOR' : 'UNCHANGED_ORIGINAL_RNG',
    beforeLast: structuredClone(beforeLast), lastIntent: structuredClone(lastIntent), final: structuredClone(s) };
  boundaries[key] = boundary;
  writeFileSync(`output/play/bizarro-sorcerer-directed-${key}-save-boundary.json`, JSON.stringify(boundary));
}

function go(payload, options = {}) {
  assert(commands.length < 500, 'Finite directed lifecycle command budget exceeded; retain the blocker rather than edit the state.');
  assert.equal(s.status, 'ACTIVE', 'A real terminal outcome is not revived.');
  beforeLast = structuredClone(s); lastIntent = structuredClone(payload);
  const cursorBefore = s.random.cursor;
  let injected = [];
  try {
    if (options.directMouse) {
      const directed = directedMouseCheck(payload, () => applySliceIntent(s, payload));
      s = directed.result; injected = directed.draws;
    } else s = applySliceIntent(s, payload);
    assertValidSliceState(s);
    assert.deepEqual(s.marionettist, oldMarionettist, 'The old original Dorn history/body must not change.');
  } catch (error) {
    writeFileSync('output/play/bizarro-sorcerer-directed-life-blocker.json', JSON.stringify({ kind, sourceFixture,
      commands, records, directedChecks, beforeLast, lastIntent, error: String(error), stack: error.stack }));
    throw error;
  }
  commands.push(structuredClone(payload));
  directedChecks.push(...injected);
  records.push({ index: commands.length, payload: structuredClone(payload), randomCursorBefore: cursorBefore,
    randomCursorAfter: s.random.cursor, injectedDraws: injected, week: s.week });
  if (options.boundary) saveBoundary(options.boundary, injected.map(d => d.returned));
  console.log(JSON.stringify({ kind, step: commands.length, type: payload.type === 'BIZARRO_SORCERER' ? payload.command.type : payload.type,
    week: s.week, ap: s.actionsRemaining, health: s.health, spirituality: s.spirituality,
    mouse: s.bizarroSorcerer.life.mouse.status, directed: injected.length > 0 }));
}
const life = (command, options) => go({ type: 'BIZARRO_SORCERER', command }, options);

function clear() {
  while (s.activeEvent) {
    const event = projectSliceState(s).activeEvent;
    const choiceId = event.id.startsWith('ORIGIN') ? '.decline'
      : event.id === 'LIFE-BILL-01' ? 'PAY_PART'
      : event.id === 'DEBT-NOTICE-01' ? 'DECLINE'
      : event.id === 'DEBT-SETTLE-01' ? 'DEFER'
      : event.id === 'LIFE-CARE-01' ? 'DECLINE'
      : event.id === 'CARE-WORK-OFFER' ? 'DECLINE' : null;
    assert(choiceId, `Unexpected real event ${event.id}; do not fabricate a response.`);
    go({ type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId });
  }
}
function ordinary() {
  clear();
  go({ type: 'ACTION', action: s.wagePaidWeek === s.week ? 'REST' : 'WORK' });
  clear();
}
function readyForPractice() {
  clear();
  while (s.health < 90 || s.mind < 60 || s.spirituality < 30 || s.actionsRemaining < 1 || s.seer.pollution > 0) ordinary();
}
function observe(caseId) {
  clear();
  if (s.bizarroSorcerer.life.cases[caseId].status === 'AVAILABLE') { life({ type: 'OBSERVE', caseId }); clear(); }
}
function returnAndClose(caseId, boundary) {
  life({ type: 'RETURN_ORDINARY' }, boundary ? { boundary } : undefined);
  life({ type: 'CLOSE', caseId }); clear();
}
function report(caseId) {
  if (s.bizarroSorcerer.life.cases[caseId].status === 'EXAMINED') { life({ type: 'REPORT', caseId }); clear(); }
}
function completeOrdinary(caseId) {
  observe(caseId);
  while (s.bizarroSorcerer.life.cases[caseId].status !== 'RESOLVED') {
    const scene = s.bizarroSorcerer.life.cases[caseId];
    if (scene.status === 'OBSERVED') {
      while (s.bizarroSorcerer.life.cases[caseId].attemptWeek === s.week) ordinary();
      readyForPractice(); life({ type: 'PREPARE', caseId, method: 'ORDINARY' }); clear();
    }
    if (s.bizarroSorcerer.life.cases[caseId].status === 'PREPARED') {
      life({ type: 'PERFORM', caseId }); returnAndClose(caseId);
    }
    report(caseId);
  }
}

// Actual costs/recovery first; the old natural promotion and later released-mouse
// branch remain unchanged in their source file.
readyForPractice();
life({ type: 'CAPTURE_MOUSE' }, { directMouse: true, boundary: 'mouse-capture' });
assert.equal(s.bizarroSorcerer.life.mouse.status, 'HELD');
life({ type: 'BEGIN_MOUSE_CONTROL' }, { directMouse: true, boundary: 'mouse-initial' });
assert.equal(s.bizarroSorcerer.life.mouse.alive, true);
assert.equal(s.bizarroSorcerer.life.mouse.elapsedSeconds, 3);
life({ type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: true }, { directMouse: true, boundary: 'mouse-convert' });
assert.equal(s.bizarroSorcerer.life.mouse.status, 'CONTROLLED');
assert.equal(s.bizarroSorcerer.life.mouse.alive, false);
assert.equal(s.bizarroSorcerer.life.mouse.elapsedSeconds, 15);
assert.equal(directedChecks.length, 3);
clear();

// The first case is an honest ordinary comparison. This route is for the new
// actual mouse/worm/swap lifecycle; fire capability has its own natural evidence.
completeOrdinary('two-flames');
observe('one-way-gift'); readyForPractice();
life({ type: 'PREPARE', caseId: 'one-way-gift', method: 'ABILITY' }); clear();
life({ type: 'PERFORM', caseId: 'one-way-gift' });
const beforeGift = { spirituality: s.spirituality, mind: s.mind, mouseSpirituality: s.bizarroSorcerer.life.mouse.spirituality };
life({ type: 'ASSIGN_WORM' }, { boundary: 'worm-assign' });
assert.equal(s.bizarroSorcerer.life.worms.assigned, 1);
assert.equal(s.mind, beforeGift.mind - 2);
life({ type: 'PUPPET_ILLUSION' }, { boundary: 'puppet-use' });
illusionSucceeded = s.bizarroSorcerer.life.cases['one-way-gift'].result === 'ABILITY';
assert.equal(s.bizarroSorcerer.life.mouse.spirituality, beforeGift.mouseSpirituality - 3);
life({ type: 'RECALL_WORM' }, { boundary: 'worm-recall' });
assert.deepEqual(s.bizarroSorcerer.life.worms, { capacity: 50, split: 1, assigned: 0, recalled: 1, lost: 0 });
assert.equal(s.spirituality, beforeGift.spirituality - 7);
assert.equal(s.mind, beforeGift.mind - 2);
returnAndClose('one-way-gift', 'return');
report('one-way-gift');
if (!illusionSucceeded) completeOrdinary('one-way-gift');
assert.equal(s.bizarroSorcerer.life.cases['one-way-gift'].status, 'RESOLVED');

observe('paired-positions');
let swapAttempts = 0;
while (s.bizarroSorcerer.life.cases['paired-positions'].status !== 'RESOLVED') {
  while (s.bizarroSorcerer.life.cases['paired-positions'].attemptWeek === s.week) ordinary();
  readyForPractice();
  life({ type: 'PREPARE', caseId: 'paired-positions', method: 'ABILITY' }); clear();
  life({ type: 'PERFORM', caseId: 'paired-positions' });
  life({ type: 'WALK_MOUSE_FAR' });
  assert.equal(s.bizarroSorcerer.life.mouse.location, 'FAR');
  assert.equal(s.bizarroSorcerer.life.practice.ownerAt, 'NEAR');
  life({ type: 'SWAP_OUT' }); swapAttempts++;
  const swapped = s.bizarroSorcerer.life.practice.ownerAt === 'FAR';
  if (swapped) {
    actualSwapSucceeded = true; saveBoundary('swap');
    assert.equal(s.bizarroSorcerer.life.mouse.location, 'NEAR');
    assert.equal(s.bizarroSorcerer.life.practice.tag.holder, 'MOUSE');
    assert.equal(s.bizarroSorcerer.life.practice.carrier.holder, 'OWNER');
    life({ type: 'SWAP_BACK' }, { boundary: 'swap-back-attempt' });
  } else saveBoundary(`swap-failed-attempt-${swapAttempts}`);
  returnAndClose('paired-positions', swapped ? 'swap-return' : undefined);
  report('paired-positions');
}
assert(actualSwapSucceeded, 'A completed ability report requires an actual successful swap.');
assert.equal(s.bizarroSorcerer.life.practice.ownerAt, 'NEAR');
assert.equal(s.bizarroSorcerer.life.mouse.location, 'CARRIER');
assert.equal(s.bizarroSorcerer.life.practice.tag.holder, 'CARRIER');
assert.equal(s.bizarroSorcerer.life.mouse.alive, false);
life({ type: 'REFLECT' }); clear();
assert.equal(s.progression.acting, 100);
assert.equal(directedChecks.length, 3, 'No later check may be directed.');
assert.deepEqual(s.marionettist, initial.marionettist);
for (const key of ['worm-assign', 'puppet-use', 'worm-recall', 'swap', 'return']) {
  assert(boundaries[key]); assert.deepEqual(boundaries[key].injectedDraws, []);
}
const result = { kind, sourceFixture, sourceCheckpoint: 'promoted', initial, commands, records, directedChecks,
  beforeLast, lastIntent, final: s, boundaries: Object.keys(boundaries),
  outcome: { illusionSucceeded, actualSwapSucceeded, swapAttempts, acting: s.progression.acting,
    mouse: s.bizarroSorcerer.life.mouse, worms: s.bizarroSorcerer.life.worms,
    note: illusionSucceeded ? 'Original RNG produced the actual granted illusion.' : 'Original RNG illusion failed; costs and finite mouse spirituality remain spent, and ordinary comparison completed that case.' } };
writeFileSync('output/play/bizarro-sorcerer-directed-life.json', JSON.stringify(result));
console.log(JSON.stringify({ passed: true, kind, commands: commands.length, directedChecks: directedChecks.length,
  week: s.week, illusionSucceeded, actualSwapSucceeded, swapAttempts, boundaries: Object.keys(boundaries) }));
