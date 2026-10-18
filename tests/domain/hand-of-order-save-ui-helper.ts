import { expect } from 'vitest';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { HAND_OF_ORDER_ABILITY_IDS, HAND_OF_ORDER_SOURCE_KEYS } from '../../src/domain/hand-of-order/types.js';
import { getHandOfOrderCurrentSite } from '../../src/domain/hand-of-order/life.js';
import { observedCapture, sameCaptureValue as same } from './hand-of-order-capture-helper.js';

// Collection uses compact coordinator observations only. No reducer, SQLite,
// full saved state or desired future result is evaluated at collection time.
const ACTUAL = observedCapture(); // Finalized evidence must exist before collecting any case.
export const GUIDANCE = 'paid500-guidance-freezes-eight-roots-and-original-guard-plate';
export function observedNames(pattern: RegExp): string[] {
  return Object.keys(ACTUAL.boundarySteps).filter(name => pattern.test(name));
}
export function distinctObserved(names: readonly string[]): string[] {
  const steps = ACTUAL.boundarySteps, seen = new Set<number>();
  return names.filter(name => {
    const step = steps[name];
    if (step === undefined) throw new Error(`Missing required actual capture boundary: ${name}`);
    if (seen.has(step)) return false;
    seen.add(step); return true;
  });
}
export const LIFE_REOPEN_NAMES = distinctObserved([
  'paired-handover-prepare', 'paired-handover-battlefield_division', 'paired-handover-attempt_handover',
  'measured-aftermath-aftermath_control', 'measured-aftermath-ordinary_brace',
  'withdrawn-boundary-withdraw_permission', 'withdrawn-boundary-complete_handover',
  'paired-handover-return_objects', 'paired-handover-leave',
]);
export const UI_RETRY_NAMES = distinctObserved([
  GUIDANCE, ...observedNames(/^consume-hand-of-order-potion-\d+$/),
  'paired-handover-prepare', 'paired-handover-battlefield_division',
  'measured-aftermath-aftermath_control', 'withdrawn-boundary-withdraw_permission',
]);
const rounds = observedNames(/^combat-round-\d+$/);
export const SQLITE_REPRESENTATIVES = distinctObserved([
  'exact-original594-living-source', 'actual-event-life-care-01', GUIDANCE,
  ...observedNames(/^paid1200-hand-of-order-potion-\d+$/),
  ...observedNames(/^consume-hand-of-order-potion-\d+$/),
  'paid100-after-all-original-bottles-failed', 'next-real-week-three-new-bottle-identities',
  'walk-four-metres-to-actual-outside', 'pay40-place-new-annex-with-three-finite-pieces',
  'paired-handover-prepare', 'paired-handover-battlefield_division', 'paired-handover-attempt_handover',
  'measured-aftermath-aftermath_control', 'measured-aftermath-ordinary_brace',
  'withdrawn-boundary-withdraw_permission', 'withdrawn-boundary-complete_handover',
  'paired-handover-return_objects', 'paired-handover-leave', 'paired-handover-honest-report', 'three-honest-reports-reflected',
  'paid30-three-independent-combat-support-pieces', 'original-adults-remain-outside-player-walks-to-new-yard',
  'independent-optional-bram-fight', ...rounds,
  ...observedNames(/^combat-actual-(battlefield-division|aftermath-control|original-guard-plate-wear)(-\d+)?$/),
  'actual-sealed-player-death',
  ...Object.entries(ACTUAL.boundarySteps).filter(([, step]) => step === ACTUAL.commands).map(([name]) => name),
]);
export const currentPlate = (s: SliceState) => s.handOfOrder.life.guardPlate ?? s.balancer.life.guardPlate;

/** Check paid receipts before ordinary weekly settlement. Full reducer/save
 * equality independently compares every resource, RNG and private history. */
export function assertCapturedResources(before: SliceState, intent: SliceIntent, after: SliceState): void {
  expect(after.revision).toBe(before.revision + 1); expect(after.runId).toBe(before.runId);
  expect(after.random.seed).toBe(before.random.seed);
  for (const key of HAND_OF_ORDER_SOURCE_KEYS) same(after[key], before[key]);
  if (intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') {
    expect(intent.choiceId).toBe('PAY'); expect(after.cash).toBeLessThanOrEqual(before.cash - 60);
    expect(after.health).toBe(before.health); expect(after.injuryRisk).toBe(before.injuryRisk);
    for (const injury of before.injuries.filter(row => row.severity === 'HEAVY' && row.treatedRevision === null)) {
      expect(after.injuries.find(row => row.id === injury.id)).toEqual({ ...injury, treatedRevision: before.revision + 1 });
    }
    return;
  }
  if (intent.type === 'COMBAT_ROUND') { assertCapturedRoundResources(before, after); return; }
  if (intent.type !== 'HAND_OF_ORDER') return;
  const command = intent.command, old = before.handOfOrder, now = after.handOfOrder;
  const acquisition = now.acquisitionJournal.length > old.acquisitionJournal.length ? now.acquisitionJournal.at(-1)! : null;
  const life = now.life.journal.length > old.life.journal.length ? now.life.journal.at(-1)! : null;
  if (acquisition) {
    same(acquisition.command, command); expect(acquisition.before.cash).toBe(before.cash);
    expect(acquisition.before.actions).toBe(before.actionsRemaining);
    const fee = command.type === 'LEARN_GUIDANCE' ? 500 : command.type === 'BUY_POTION' ? 1200 : command.type === 'PREPARE_PROMOTION' ? 180 : command.type === 'REQUEST_SUPPLY' ? 100 : 0;
    const ap = ['LEARN_GUIDANCE', 'PREPARE_TASK', 'POTION_WORK', 'PREPARE_PROMOTION', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
    expect(acquisition.after.cash).toBe(acquisition.before.cash - fee);
    expect(acquisition.after.actions).toBe(acquisition.before.actions - ap);
    if (command.type === 'LEARN_GUIDANCE') {
      same(now.sourceScene!.originals, { site: before.chaosHunter.life, operation: before.balancer.life.operation, guardPlate: before.balancer.life.guardPlate });
    }
    if (command.type === 'CONSUME') {
      expect(before.week - before.balancer.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(old.preparedWeek).toBe(before.week); expect(now.preparedWeek).toBeNull();
      expect(after.random.cursor).toBe(before.random.cursor + 1);
      const bottle = now.bottles.find(row => row.id === command.bottleId)!;
      expect(bottle.status).toBe('CONSUMED'); expect(bottle.preparationWeek).toBe(bottle.consumedWeek);
      same(after.injuries, before.injuries); same(currentPlate(after), currentPlate(before));
      if (after.progression.sequence === 1) {
        expect(after.health).toBe(before.health); expect(after.spirituality).toBe(before.spirituality);
        expect(now.promotionWeek).toBe(before.week);
        same(after.progression.mastery, { ...before.progression.mastery, ...Object.fromEntries(HAND_OF_ORDER_ABILITY_IDS.map(id => [id, 0])) });
      }
    }
  }
  if (life) {
    same(life.command, command); same(life.plateBefore, currentPlate(before)); same(life.plateAfter, currentPlate(after));
    const previousSite = getHandOfOrderCurrentSite(before), nextSite = getHandOfOrderCurrentSite(after);
    expect(life.clockBefore).toBe(previousSite.clockSeconds); expect(life.clockAfter).toBe(nextSite.clockSeconds);
    expect(life.after.cash).toBe(life.before.cash - life.paid.pennies);
    expect(life.after.actions).toBe(life.before.actions - life.paid.actions);
    expect(life.after.spirituality).toBe(life.before.spirituality - life.paid.spirituality);
    expect(life.after.mind).toBe(life.before.mind - life.paid.mind);
    expect(life.after.health).toBe(life.before.health - life.paid.health);
    same(nextSite.table, previousSite.table); expect(nextSite.paper.text).toBe(previousSite.paper.text);
    if (command.type === 'EXIT_ORIGINAL') {
      expect(life.paid.actions).toBe(0); expect(life.clockAfter - life.clockBefore).toBe(4);
      expect(previousSite.playerLocation).toBe('START'); expect(nextSite.playerLocation).toBe('OUTSIDE');
      expect(nextSite.playerTravelMetres - previousSite.playerTravelMetres).toBe(4);
    }
    if (command.type === 'RENT_ANNEX') {
      expect(life.paid).toMatchObject({ pennies: 40, actions: 1 }); expect(now.life.annex.supportPieces).toBe(3);
      expect(now.life.annex.placementConsent).toBe('GRANTED');
    }
    if (command.type === 'SETUP_OBJECTS') {
      expect(now.life.annex.effortSpent).toBe(old.life.annex.effortSpent + 3);
      expect(nextSite.volunteer.mind).toBe(previousSite.volunteer.mind - 1);
    }
    if (command.type === 'BATTLEFIELD_DIVISION' || command.type === 'AFTERMATH_CONTROL') {
      expect(life.paid).toMatchObject({ spirituality: 8, mind: ['FAILURE', 'GREAT_FAILURE'].includes(life.tier!) ? 4 : 2, actions: 1 });
      expect(now.life.annex.supportPieces).toBe(old.life.annex.supportPieces - 1);
      expect(after.random.cursor).toBe(before.random.cursor + 1); same(after.progression.mastery, before.progression.mastery);
      const effect = now.life.operation[command.type === 'BATTLEFIELD_DIVISION' ? 'division' : 'aftermath'];
      if (effect) { expect(effect.expiresAt - effect.createdAt).toBe(20); expect(effect.remainingUses).toBe(1); expect(effect.pendingId).toBe(now.life.operation.pending!.id); }
    }
    if (command.type === 'APPLY_IMPACT' || command.type === 'ORDINARY_BRACE' || command.type === 'CANCEL_IMPULSE') {
      const impact = now.life.cases[command.caseId].attempts[0]!.impact!;
      expect(impact).toMatchObject({ plateId: 'BA2-GUARD-PLATE', baseHealthLoss: 5 });
      expect(after.health).toBe(before.health - impact.healthLoss);
      expect(currentPlate(after).integrity).toBe(currentPlate(before).integrity - impact.plateWear);
      expect(impact.healthLoss).toBe(command.type === 'CANCEL_IMPULSE' ? 0 : command.type === 'ORDINARY_BRACE' || impact.aftermathApplied ? 2 : 5);
      expect(impact.plateWear).toBe(command.type === 'CANCEL_IMPULSE' ? 0 : 15);
    }
    if (command.type === 'WITHDRAW_PERMISSION') {
      expect(now.life.operation.division).toBeNull(); expect(now.life.operation.aftermath).toBeNull();
      expect(now.life.operation.pending!.status).toBe('PENDING'); same(after.progression.mastery, before.progression.mastery);
    }
  }
  if (command.type === 'PREPARE_ENCOUNTER') {
    const paid = now.encounter.preparation!;
    expect(paid).toMatchObject({ pricePaid: 30, mindPaid: 2, actionsPaid: 0 });
    expect(paid.after.cash).toBe(paid.before.cash - 30); expect(paid.after.mind).toBe(paid.before.mind - 2);
    expect(paid.after.actions).toBe(paid.before.actions); same(paid.guardPlate, currentPlate(before));
    expect(now.encounter.supportPieces).toHaveLength(3); expect(now.encounter.supportPieces.every(piece => piece.status === 'HELD' && piece.wear === 0)).toBe(true);
  }
}
export function assertCapturedRoundResources(before: SliceState, after: SliceState): void {
  const round = after.lastCombatRound!, outcome = round.handOfOrderOutcome!;
  expect(outcome).toBeDefined(); expect(outcome.source.policy).toBe('ALL'); expect(outcome.source.targetId).toBe('HO1-BRAM');
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  expect(outcome.playerSpiritualityAfter).toBe(before.spirituality - outcome.playerActions.reduce((sum, action) => sum + action.paidCost, 0));
  const mentalLoss = round.winner === 'ENEMY' && round.consequenceDomain === 'MENTAL' ? 10 : 0;
  expect(outcome.playerMindAfter).toBe(Math.max(0, before.mind - outcome.playerActions.reduce((sum, action) => sum + action.mindCost, 0) - mentalLoss));
  expect(after.spirituality).toBe(outcome.continuing ? Math.min(120, outcome.playerSpiritualityAfter + 12) : outcome.playerSpiritualityAfter);
  expect(outcome.enemySpirituality).toBe(before.handOfOrder.encounter.enemySpirituality - outcome.enemyActions.reduce((sum, action) => sum + action.paidCost, 0));
  let integrity = currentPlate(before).integrity;
  for (const action of actions) {
    expect(action.guardPlateBefore.integrity).toBe(integrity); integrity -= action.plateWear;
    expect(action.guardPlateAfter.integrity).toBe(integrity);
    if (action.attackKind === 'MIND') expect(action.windowsApplied.some(window => window.kind === 'AFTERMATH')).toBe(false);
  }
  expect(currentPlate(after).integrity).toBe(integrity); expect(outcome.guardPlateAfter.integrity).toBe(integrity);
  expect(outcome.supportPieces.filter(piece => piece.status === 'SPENT')).toHaveLength(outcome.source.body.supportPieces.filter(piece => piece.status === 'SPENT').length + actions.reduce((sum, action) => sum + action.supportWearPaid, 0));
  expect(outcome.enemyCharges.filter(piece => piece.status === 'SPENT')).toHaveLength(outcome.source.body.enemyCharges.filter(piece => piece.status === 'SPENT').length + actions.filter(action => action.enemyChargeId !== null).length);
  for (const [id, mastery] of Object.entries(outcome.source.mastery)) expect(outcome.masteryAfter[id]).toBe(Math.min(500, mastery + 8 * actions.filter(action => action.masteryApplied.includes(id)).length));
  same(after.random, { seed: before.random.seed, cursor: outcome.randomCursorAfter });
  expect(after.combatHistory).toHaveLength(before.combatHistory.length + 1); same(after.combatHistory.slice(0, -1), before.combatHistory);
}

/** All three public round entry points keep public modifier labels, while the
 * private deterministic source, cursors and histories remain in saved states. */
export function assertPublicProjection(state: SliceState, view: SliceProjection): void {
  const value = view.handOfOrder;
  for (const key of ['sourceHistory', 'sourceScene', 'acquisitionJournal', 'random']) expect(Object.hasOwn(value, key), key).toBe(false);
  for (const root of [value.life, value.encounter]) for (const key of ['journal', 'source', 'startSource', 'startSite', 'randomSeed', 'randomCursor']) expect(Object.hasOwn(root, key), key).toBe(false);
  if (state.lastCombatRound?.handOfOrderOutcome) {
    expect(Object.hasOwn(state.lastCombatRound.handOfOrderOutcome, 'source')).toBe(true);
    expect(typeof state.lastCombatRound.handOfOrderOutcome.randomCursorAfter).toBe('number');
    expect(view.lastCombatRound?.handOfOrderOutcome).toBeDefined(); same(view.combatHistory.at(-1), view.lastCombatRound);
    if (state.combat) { expect(view.combat?.lastRound?.handOfOrderOutcome).toBeDefined(); same(view.combat!.lastRound, view.lastCombatRound); }
  }
  const pairs = [
    [state.lastCombatRound?.handOfOrderOutcome, view.lastCombatRound?.handOfOrderOutcome],
    [state.combat?.lastRound?.handOfOrderOutcome, view.combat?.lastRound?.handOfOrderOutcome],
    ...state.combatHistory.map((round, index) => [round.handOfOrderOutcome, view.combatHistory[index]?.handOfOrderOutcome] as const),
  ] as const;
  for (const [raw, outcome] of pairs) {
    if (!raw) continue;
    expect(outcome).toBeDefined(); if (!outcome) throw new Error('Missing actual public round outcome.');
    inspectOutcome(outcome); expect(JSON.stringify(outcome)).not.toContain(state.random.seed);
    expect(outcome.operationAfter).toEqual({ door: raw.operationAfter.door }); expect(outcome.siteAfter).not.toHaveProperty('cases');
    const rawActions = [...raw.playerActions, ...raw.enemyActions], publicActions = [...outcome.playerActions, ...outcome.enemyActions];
    expect(publicActions).toHaveLength(rawActions.length);
    publicActions.forEach((action, index) => {
      expect(action.check?.modifiers).toEqual(rawActions[index]!.check?.modifiers.map(({ source, value }) => ({ source, value })));
    });
  }
  for (const action of view.combat?.handOfOrder?.lastActionSequence ?? []) inspectOutcome(action);
}
function inspectOutcome(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) { value.forEach((item, index) => inspectOutcome(item, [...path, String(index)])); return; }
  if (value === null || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    expect(key, `Public outcome key ${[...path, key].join('.')}`).not.toMatch(/seed|cursor|^(?:preparationRoll|preparation|sourceHistory|sourceScene|acquisitionJournal|startSource|originals|finance|journal)$/i);
    if (key === 'source') { expect(path.slice(-3, -1)).toEqual(['check', 'modifiers']); expect(typeof item).toBe('string'); }
    inspectOutcome(item, [...path, key]);
  }
}

// Literal observations from the immutable completed801-command capture.
// These are assertions about what happened, never success targets or new rolls.
export const OBSERVED_SQLITE_STEPS = {
  "exact-original594-living-source": 594,
  "actual-event-life-care-01": 596,
  "paid500-guidance-freezes-eight-roots-and-original-guard-plate": 601,
  "paid1200-hand-of-order-potion-1": 630,
  "paid1200-hand-of-order-potion-2": 667,
  "paid1200-hand-of-order-potion-3": 699,
  "paid1200-hand-of-order-potion-4": 735,
  "consume-hand-of-order-potion-1": 635,
  "consume-hand-of-order-potion-2": 672,
  "consume-hand-of-order-potion-3": 704,
  "consume-hand-of-order-potion-4": 740,
  "paid100-after-all-original-bottles-failed": 707,
  "next-real-week-three-new-bottle-identities": 709,
  "walk-four-metres-to-actual-outside": 741,
  "pay40-place-new-annex-with-three-finite-pieces": 744,
  "paired-handover-prepare": 747,
  "paired-handover-battlefield_division": 752,
  "paired-handover-attempt_handover": 753,
  "measured-aftermath-aftermath_control": 769,
  "measured-aftermath-ordinary_brace": 770,
  "withdrawn-boundary-withdraw_permission": 783,
  "withdrawn-boundary-complete_handover": 784,
  "paired-handover-return_objects": 758,
  "paired-handover-leave": 761,
  "paired-handover-honest-report": 762,
  "three-honest-reports-reflected": 793,
  "paid30-three-independent-combat-support-pieces": 796,
  "original-adults-remain-outside-player-walks-to-new-yard": 797,
  "independent-optional-bram-fight": 798,
  "combat-round-1": 799,
  "combat-round-2": 800,
  "combat-round-3": 801
} as const;
const OBSERVED_POTIONS = [
  {
    "week": 147,
    "health": 85,
    "mind": 75,
    "spirituality": 120,
    "cash": 10,
    "actionsRemaining": 1,
    "cursor": 368,
    "sequence": 2,
    "pollution": 30,
    "roll": 46,
    "tier": "FAILURE"
  },
  {
    "week": 158,
    "health": 85,
    "mind": 75,
    "spirituality": 120,
    "cash": 100,
    "actionsRemaining": 1,
    "cursor": 369,
    "sequence": 2,
    "pollution": 30,
    "roll": 61,
    "tier": "FAILURE"
  },
  {
    "week": 168,
    "health": 85,
    "mind": 75,
    "spirituality": 120,
    "cash": 40,
    "actionsRemaining": 1,
    "cursor": 370,
    "sequence": 2,
    "pollution": 30,
    "roll": 80,
    "tier": "FAILURE"
  },
  {
    "week": 179,
    "health": 100,
    "mind": 85,
    "spirituality": 120,
    "cash": 30,
    "actionsRemaining": 1,
    "cursor": 371,
    "sequence": 1,
    "pollution": 0,
    "roll": 22,
    "tier": "SUCCESS"
  }
] as const;
export const OBSERVED_ROUNDS = [
  {
    "round": 1,
    "stance": "CONTROL",
    "first": "PLAYER",
    "playerCount": 6,
    "enemyCount": 5,
    "playerCountRoll": 98,
    "enemyCountRoll": 79,
    "winner": "ENEMY",
    "consequenceDomain": "BODY",
    "consequenceRoll": 23,
    "outcome": {
      "playerHealthAfter": 90,
      "playerMindAfter": 88,
      "playerSpiritualityAfter": 84,
      "enemyHealth": 100,
      "enemyMind": 100,
      "enemySpirituality": 79,
      "enemyStatus": "RESISTING",
      "randomCursorAfter": 394,
      "continuing": true,
      "divisionApplications": 0,
      "aftermathApplications": 0
    }
  },
  {
    "round": 2,
    "stance": "CONTROL",
    "first": "ENEMY",
    "playerCount": 3,
    "enemyCount": 1,
    "playerCountRoll": 28,
    "enemyCountRoll": 9,
    "winner": "PLAYER",
    "outcome": {
      "playerHealthAfter": 90,
      "playerMindAfter": 88,
      "playerSpiritualityAfter": 92,
      "enemyHealth": 100,
      "enemyMind": 100,
      "enemySpirituality": 79,
      "enemyStatus": "RESISTING",
      "randomCursorAfter": 402,
      "continuing": true,
      "divisionApplications": 0,
      "aftermathApplications": 0
    }
  },
  {
    "round": 3,
    "stance": "CONTROL",
    "first": "PLAYER",
    "playerCount": 5,
    "enemyCount": 4,
    "playerCountRoll": 78,
    "enemyCountRoll": 59,
    "winner": "ENEMY",
    "consequenceDomain": "BODY",
    "consequenceRoll": 94,
    "outcome": {
      "playerHealthAfter": 0,
      "playerMindAfter": 88,
      "playerSpiritualityAfter": 100,
      "enemyHealth": 100,
      "enemyMind": 100,
      "enemySpirituality": 71,
      "enemyStatus": "RESISTING",
      "randomCursorAfter": 416,
      "continuing": false,
      "divisionApplications": 0,
      "aftermathApplications": 0
    }
  }
] as const;
export function assertObservedRound(state: SliceState): void {
  const round = state.lastCombatRound!, outcome = round.handOfOrderOutcome!, pin = OBSERVED_ROUNDS[round.round - 1];
  expect(pin).toBeDefined(); if (!pin) throw new Error('Unexpected actual round.');
  const { outcome: outcomePin, ...roundPin } = pin;
  expect(round).toMatchObject(roundPin); expect(outcome).toMatchObject(outcomePin);
  expect(outcome.guardPlateAfter.integrity).toBe(50); expect(outcome.divisionApplications).toBe(0); expect(outcome.aftermathApplications).toBe(0);
  expect([...outcome.playerActions, ...outcome.enemyActions].flatMap(action => action.windowsApplied)).toEqual([]);
  if (round.round === 1) {
    expect(outcome.playerActions.find(action => action.order === 0)).toMatchObject({ id: 'justiciar.s1.aftermath-control', paidCost: 8, mindCost: 2, check: { roll: 41, tier: 'SUCCESS' }, succeeded: true, windowGranted: { kind: 'AFTERMATH' }, masteryApplied: [] });
    expect(outcome.playerActions.find(action => action.order === 8)).toMatchObject({ id: 'justiciar.s1.battlefield-division', paidCost: 8, mindCost: 4, check: { roll: 16, tier: 'SUCCESS' }, resisted: true, windowGranted: null, masteryApplied: [] });
    expect(outcome.playerActions.find(action => action.order === 10)).toMatchObject({ id: 'justiciar.s1.aftermath-control', paidCost: 8, mindCost: 4, check: { roll: 85, tier: 'FAILURE' }, windowGranted: null, masteryApplied: [] });
    expect(outcome.supportPieces.every(piece => piece.status === 'SPENT')).toBe(true);
  }
  if (round.round === 2) { expect(round.consequenceDomain).toBeUndefined(); expect(round.consequenceRoll).toBeUndefined(); expect(round.consequenceWeights).toBeNull(); }
  if (round.round === 3) { expect(state.status).toBe('DEAD'); expect(state.health).toBe(0); expect(outcome.source.playerHealth).toBe(90); }
  expect(state.random.cursor).toBe(outcome.randomCursorAfter);
}
export function assertObservedBoundary(name: string, state: SliceState): void {
  const match = /^consume-hand-of-order-potion-(\d+)$/.exec(name);
  if (match) {
    const number = Number(match[1]), pin = OBSERVED_POTIONS[number - 1];
    expect(pin).toBeDefined(); if (!pin) throw new Error('Unexpected actual bottle consumption.');
    const { cursor, sequence, pollution, roll, tier, ...body } = pin;
    expect(state).toMatchObject(body); expect(state.random.cursor).toBe(cursor);
    expect(state.progression.sequence).toBe(sequence); expect(state.seer.pollution).toBe(pollution);
    expect(state.handOfOrder.acquisitionJournal.at(-1)!.check).toMatchObject({ roll, tier, chance: 40, difficulty: 30 });
    expect(state.handOfOrder.bottles[number - 1]).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: pin.week, preparationWeek: pin.week });
    expect(state.injuries).toEqual([]);
    if (sequence === 1) { expect(state.handOfOrder.promotionWeek).toBe(179); for (const id of HAND_OF_ORDER_ABILITY_IDS) expect(state.progression.mastery[id]).toBe(0); }
  }
  if (name === 'paired-handover-battlefield_division') {
    expect(state.handOfOrder.life.cases['paired-handover'].attempts[0]).toMatchObject({ divisionTier: 'GREAT_SUCCESS', divisionOutcome: null, appliedAbilityIds: [] });
    expect(state.handOfOrder.life.operation.division).toMatchObject({ remainingUses: 1 });
  }
  if (name === 'paired-handover-attempt_handover') expect(state.handOfOrder.life.cases['paired-handover'].attempts[0]).toMatchObject({ divisionOutcome: 'STOPPED', appliedAbilityIds: ['justiciar.s1.battlefield-division'] });
  if (name === 'paired-handover-honest-report') expect(state.progression.mastery['justiciar.s1.battlefield-division']).toBe(8);
  if (name === 'measured-aftermath-aftermath_control') expect(state.handOfOrder.life.cases['measured-aftermath'].attempts[0]).toMatchObject({ aftermathTier: 'FAILURE', spiritualitySpent: 8, mindSpent: 4, appliedAbilityIds: [] });
  if (name === 'measured-aftermath-ordinary_brace') {
    expect(state.handOfOrder.life.cases['measured-aftermath'].attempts[0]!.impact).toMatchObject({ mode: 'ORDINARY_BRACE', healthLoss: 2, plateWear: 15, aftermathApplied: false });
    expect(state.handOfOrder.life.guardPlate!.integrity).toBe(50); expect(state.progression.mastery['justiciar.s1.aftermath-control']).toBe(0);
  }
  if (name === 'withdrawn-boundary-withdraw_permission' || name === 'withdrawn-boundary-complete_handover') {
    expect(state.handOfOrder.life.cases['withdrawn-boundary'].attempts[0]).toMatchObject({ permissionWithdrawn: true, divisionTier: 'FAILURE', spiritualitySpent: 8, mindSpent: 4, appliedAbilityIds: [] });
    expect(state.handOfOrder.life.operation.division).toBeNull(); expect(state.handOfOrder.life.operation.aftermath).toBeNull();
  }
  if (state.lastCombatRound?.handOfOrderOutcome) assertObservedRound(state);
}
export function assertObservedFinal(state: SliceState): void {
  expect(state).toMatchObject({ status: 'DEAD', revision: 802, week: 185, health: 0, mind: 88, spirituality: 100, cash: 140, actionsRemaining: 1,
    injuryRisk: 1, random: { seed: 'arbiter-natural-v066', cursor: 416 }, combat: null,
    progression: { sequence: 1, acting: 100, mastery: { 'justiciar.s1.battlefield-division': 8, 'justiciar.s1.aftermath-control': 0 } } });
  expect(state.ending?.kind).toBe('DEATH'); expect(state.seer.pollution).toBe(0); expect(state.handOfOrder.promotionWeek).toBe(179);
  expect(state.injuries.map(injury => [injury.severity, injury.acquiredRevision, injury.treatedRevision])).toEqual([['LIGHT', 800, null]]);
  expect(state.handOfOrder.bottles.map(bottle => [bottle.outcome, bottle.consumedWeek])).toEqual([['FAILURE', 147], ['FAILURE', 158], ['FAILURE', 168], ['SUCCESS', 179], [null, null], [null, null]]);
  expect(state.handOfOrder.encounter.terminal).toEqual({ outcome: 'PLAYER_DEAD', round: 3, historyIndex: 29, enemyHealth: 100, enemyMind: 100, enemySpirituality: 71, enemyStatus: 'RESISTING', exitMetres: 0, exitSeconds: 0 });
  expect(state.handOfOrder.encounter).toMatchObject({ status: 'LOST', targetId: 'HO1-BRAM', enemyHealth: 100, enemyMind: 100, enemySpirituality: 71, enemyStatus: 'RESISTING', weaponLocation: 'HAND' });
  expect(state.handOfOrder.life.guardPlate).toEqual({ id: 'BA2-GUARD-PLATE', owner: 'PLAYER', holder: 'PLAYER', location: 'ANNEX_A', integrity: 50, acquiredWeek: 126 });
  expect(getHandOfOrderCurrentSite(state)).toMatchObject({ playerLocation: 'ANNEX_A', playerTravelMetres: 188, clockSeconds: 1110,
    guide: { location: 'OUTSIDE' }, volunteer: { alive: true, health: 100, mind: 97, location: 'OUTSIDE' } });
  expect(state.handOfOrder.life.annex).toMatchObject({ supportPieces: 0, effortSpent: 9 });
  expect(state.handOfOrder.encounter.supportPieces.map(piece => [piece.status, piece.wear])).toEqual([['SPENT', 1], ['SPENT', 1], ['SPENT', 1]]);
  assertObservedRound(state);
}
