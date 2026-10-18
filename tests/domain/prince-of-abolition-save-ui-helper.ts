import { expect } from 'vitest';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { PRINCE_OF_ABOLITION_SOURCE_KEYS } from '../../src/domain/prince-of-abolition/types.js';
import { PRINCE_OF_ABOLITION_CAPTURE_EVIDENCE as evidence } from './prince-of-abolition-capture-evidence.js';
import { sameCaptureValue as same } from './prince-of-abolition-capture-helper.js';

// Only compact, literal coordinator observations are used at collection time.
// No reducer is invoked and no full saved state is retained between test cases.
export const GUIDANCE = 'paid500-guidance-freezes-eight-roots-and-original-gift-stock';
export const LIFE_REOPEN_CANDIDATES = [
  'directed-throw-prepare', 'directed-throw-directed_amplification', 'directed-throw-throw_ball',
  'maintained-flight-throw_ball', 'maintained-flight-effect_maintenance',
  'withdrawn-input-directed_amplification', 'withdrawn-input-withdraw_consent-ability',
  'withdrawn-input-throw_ball', 'directed-throw-return_objects', 'directed-throw-leave',
] as const;
export function observedNames(pattern: RegExp): string[] {
  return Object.keys(evidence.observed?.boundarySteps ?? {}).filter(name => pattern.test(name));
}
export function distinctObserved(names: readonly string[]): string[] {
  const steps = evidence.observed?.boundarySteps ?? {}, seen = new Set<number>();
  return names.filter(name => {
    const step = steps[name];
    if (step === undefined || seen.has(step)) return false;
    seen.add(step); return true;
  });
}
export const LIFE_REOPEN_NAMES = distinctObserved(LIFE_REOPEN_CANDIDATES);
export const UI_RETRY_NAMES = distinctObserved([
  GUIDANCE, ...observedNames(/^consume-prince-of-abolition-potion-\d+$/),
  'directed-throw-prepare', 'directed-throw-directed_amplification',
  'maintained-flight-effect_maintenance', 'withdrawn-input-withdraw_consent-ability',
]);
const roundNames = observedNames(/^combat-round-\d+$/);
export const SQLITE_REPRESENTATIVES = distinctObserved([
  'exact-original743-living-source', GUIDANCE,
  ...observedNames(/^paid1200-prince-of-abolition-potion-\d+$/),
  ...observedNames(/^consume-prince-of-abolition-potion-\d+$/),
  'walk-four-metres-to-actual-outside', 'pay40-place-new-annex-receiver',
  'directed-throw-prepare', 'directed-throw-directed_amplification', 'directed-throw-throw_ball',
  'maintained-flight-effect_maintenance', 'withdrawn-input-withdraw_consent-ability',
  'withdrawn-input-throw_ball', 'directed-throw-return_objects', 'directed-throw-leave',
  'three-honest-reports-reflected', 'paid30-three-independent-combat-support-pieces',
  'original-adults-remain-outside-player-walks-to-new-yard', 'independent-optional-edmund-fight',
  ...roundNames.slice(0, 1), ...roundNames.slice(-1),
  ...observedNames(/^combat-actual-(directed-amplification|effect-maintenance|original-gift-consumption)(-\d+)?$/),
  'actual-ordinary-encounter-exit', 'actual-sealed-player-death',
  ...Object.entries(evidence.observed?.boundarySteps ?? {}).filter(([, step]) => step === evidence.observed?.commands).map(([name]) => name),
]);

// Literal observations read from the immutable 924-command capture on 2026-10-16.
// These pins are assertions about this run, never desired outcomes or resampling rules.
export const OBSERVED_SQLITE_STEPS = {
  "exact-original743-living-source": 743,
  "paid500-guidance-freezes-eight-roots-and-original-gift-stock": 744,
  "paid1200-prince-of-abolition-potion-1": 772,
  "paid1200-prince-of-abolition-potion-2": 804,
  "paid1200-prince-of-abolition-potion-3": 841,
  "consume-prince-of-abolition-potion-1": 777,
  "consume-prince-of-abolition-potion-2": 809,
  "consume-prince-of-abolition-potion-3": 846,
  "walk-four-metres-to-actual-outside": 847,
  "pay40-place-new-annex-receiver": 848,
  "directed-throw-prepare": 853,
  "directed-throw-directed_amplification": 858,
  "directed-throw-throw_ball": 859,
  "maintained-flight-effect_maintenance": 882,
  "withdrawn-input-withdraw_consent-ability": 903,
  "withdrawn-input-throw_ball": 904,
  "directed-throw-return_objects": 865,
  "directed-throw-leave": 866,
  "three-honest-reports-reflected": 913,
  "paid30-three-independent-combat-support-pieces": 916,
  "original-adults-remain-outside-player-walks-to-new-yard": 917,
  "independent-optional-edmund-fight": 918,
  "combat-round-1": 919,
  "combat-round-6": 924,
  "combat-actual-original-gift-consumption": 922
} as const;
const OBSERVED_POTIONS = [
  { week: 195, health: 85, mind: 75, spirituality: 120, cash: 60, actionsRemaining: 1, cursor: 229, sequence: 2, pollution: 30, roll: 90, tier: 'FAILURE' },
  { week: 205, health: 85, mind: 75, spirituality: 120, cash: 0, actionsRemaining: 1, cursor: 230, sequence: 2, pollution: 30, roll: 71, tier: 'FAILURE' },
  { week: 216, health: 100, mind: 85, spirituality: 120, cash: 90, actionsRemaining: 1, cursor: 231, sequence: 1, pollution: 0, roll: 29, tier: 'SUCCESS' },
] as const;
export const OBSERVED_ROUNDS = [
  {"round": 1, "first": "PLAYER", "playerCount": 4, "enemyCount": 5, "playerCountRoll": 62, "enemyCountRoll": 81, "winner": "ENEMY", "consequenceDomain": "BODY", "consequenceRoll": 5, "outcome": {"playerHealthAfter": 90, "playerMindAfter": 91, "playerSpiritualityAfter": 94, "enemyHealth": 100, "enemyMind": 100, "enemySpirituality": 98, "enemyStatus": "RESISTING", "randomCursorAfter": 253, "continuing": true, "elapsedSeconds": 60, "directedApplications": 1, "maintenanceApplications": 0}},
  {"round": 2, "first": "ENEMY", "playerCount": 2, "enemyCount": 2, "playerCountRoll": 24, "enemyCountRoll": 19, "winner": "ENEMY", "consequenceDomain": "MENTAL", "outcome": {"playerHealthAfter": 90, "playerMindAfter": 79, "playerSpiritualityAfter": 94, "enemyHealth": 100, "enemyMind": 100, "enemySpirituality": 89, "enemyStatus": "RESISTING", "randomCursorAfter": 262, "continuing": true, "elapsedSeconds": 60, "directedApplications": 1, "maintenanceApplications": 0}},
  {"round": 3, "first": "PLAYER", "playerCount": 4, "enemyCount": 3, "playerCountRoll": 68, "enemyCountRoll": 49, "winner": "PLAYER", "consequenceDomain": "BODY", "consequenceRoll": 59, "outcome": {"playerHealthAfter": 90, "playerMindAfter": 74, "playerSpiritualityAfter": 87, "enemyHealth": 90, "enemyMind": 100, "enemySpirituality": 89, "enemyStatus": "RESISTING", "randomCursorAfter": 277, "continuing": true, "elapsedSeconds": 60, "directedApplications": 1, "maintenanceApplications": 0}},
  {"round": 4, "first": "ENEMY", "playerCount": 5, "enemyCount": 3, "playerCountRoll": 78, "enemyCountRoll": 45, "winner": "PLAYER", "consequenceDomain": "BODY", "consequenceRoll": 11, "outcome": {"playerHealthAfter": 90, "playerMindAfter": 73, "playerSpiritualityAfter": 85, "enemyHealth": 80, "enemyMind": 100, "enemySpirituality": 89, "enemyStatus": "RESISTING", "randomCursorAfter": 291, "continuing": true, "elapsedSeconds": 60, "directedApplications": 1, "maintenanceApplications": 0}},
  {"round": 5, "first": "PLAYER", "playerCount": 3, "enemyCount": 4, "playerCountRoll": 30, "enemyCountRoll": 73, "winner": "ENEMY", "consequenceDomain": "BODY", "consequenceRoll": 19, "outcome": {"playerHealthAfter": 80, "playerMindAfter": 72, "playerSpiritualityAfter": 91, "enemyHealth": 80, "enemyMind": 100, "enemySpirituality": 81, "enemyStatus": "RESISTING", "randomCursorAfter": 303, "continuing": true, "elapsedSeconds": 60, "directedApplications": 1, "maintenanceApplications": 0}},
  {"round": 6, "first": "ENEMY", "playerCount": 3, "enemyCount": 4, "playerCountRoll": 38, "enemyCountRoll": 57, "winner": "PLAYER", "consequenceDomain": "BODY", "consequenceRoll": 66, "outcome": {"playerHealthAfter": 80, "playerMindAfter": 71, "playerSpiritualityAfter": 97, "enemyHealth": 50, "enemyMind": 100, "enemySpirituality": 73, "enemyStatus": "SURRENDERED", "randomCursorAfter": 315, "continuing": false, "elapsedSeconds": 60, "directedApplications": 1, "maintenanceApplications": 0}},
] as const;
export function assertObservedBoundary(name: string, state: SliceState): void {
  const match = /^consume-prince-of-abolition-potion-(\d+)$/.exec(name);
  if (match) {
    const number = Number(match[1]), pin = OBSERVED_POTIONS[number - 1];
    expect(pin).toBeDefined(); if (!pin) throw new Error('Unexpected natural potion consumption.');
    const { cursor, sequence, pollution, roll, tier, ...body } = pin;
    expect(state).toMatchObject(body); expect(state.random.cursor).toBe(cursor);
    expect(state.progression.sequence).toBe(sequence); expect(state.seer.pollution).toBe(pollution);
    expect(state.princeOfAbolition.acquisitionJournal.at(-1)!.check).toMatchObject({ roll, tier, chance: 40, difficulty: 30 });
    expect(state.princeOfAbolition.bottles[number - 1]).toMatchObject({ status: 'CONSUMED', outcome: tier, consumedWeek: pin.week, preparationWeek: pin.week });
    expect(state.injuries).toEqual([]);
    if (sequence === 1) {
      expect(state.princeOfAbolition.promotionWeek).toBe(216);
      expect(state.progression.mastery['black-emperor.s1.directed-amplification']).toBe(0);
      expect(state.progression.mastery['black-emperor.s1.effect-maintenance']).toBe(0);
    }
  }
  const life = state.princeOfAbolition.life;
  if (name === 'directed-throw-directed_amplification') {
    expect(life.pending).toMatchObject({ createdAt: 488, expiresAt: 508, pieceId: 'PA1-PIECE-1' });
    expect(life.cases['directed-throw'].attempts[0]).toMatchObject({ thrown: false, amplification: 0, appliedAbilityIds: [] });
  }
  if (name === 'directed-throw-throw_ball') expect(life.cases['directed-throw'].attempts[0]).toMatchObject({ thrown: true, amplification: 35, appliedAbilityIds: ['black-emperor.s1.directed-amplification'] });
  if (name === 'maintained-flight-effect_maintenance') expect(life.flight).toMatchObject({ id: 'PA1-maintained-flight-OWN-THROW-FLIGHT', launchedAt: 527, originalLandAt: 531, landsAt: 551, positionMm: 166, maintenanceApplied: true });
  if (name === 'withdrawn-input-withdraw_consent-ability' || name === 'withdrawn-input-throw_ball') {
    expect(life.pending).toBeNull();
    expect(life.cases['withdrawn-input'].attempts[0]).toMatchObject({ withdrawn: true, amplification: 0, appliedAbilityIds: [], spiritualitySpent: 8, mindSpent: 2 });
    expect(life.pieces.find(piece => piece.caseId === 'withdrawn-input')).toMatchObject({ charges: 0, wear: 1 });
  }
  if (state.lastCombatRound?.princeOfAbolitionOutcome) assertObservedRound(state);
}
export function assertObservedRound(state: SliceState): void {
  const round = state.lastCombatRound!, value = round.princeOfAbolitionOutcome!;
  const pin = OBSERVED_ROUNDS[round.round - 1]; expect(pin).toBeDefined();
  if (!pin) throw new Error('Unexpected natural round.');
  const { outcome, ...roundPin } = pin; expect(round).toMatchObject(roundPin); expect(value).toMatchObject(outcome);
  expect(value.maintenanceApplications).toBe(0); expect(value.maintenance).toBeNull();
  if (round.round === 1) {
    const casts = value.playerActions.filter(action => action.id === 'black-emperor.s1.directed-amplification');
    expect(casts).toHaveLength(2);
    expect(casts[0]).toMatchObject({ order: 2, paidCost: 8, mindCost: 4, check: { roll: 71, tier: 'FAILURE' }, windowGranted: null, masteryApplied: [] });
    expect(casts[1]).toMatchObject({ order: 4, paidCost: 8, mindCost: 2, check: { roll: 14, tier: 'SUCCESS' }, masteryApplied: [] });
    expect(value.playerActions.find(action => action.order === 6)).toMatchObject({ id: 'BODY_FOLLOWUP', windowsApplied: [{ kind: 'DIRECTED', amount: 35, supportId: 'PA1-COMBAT-SUPPORT-2' }], masteryApplied: ['black-emperor.s1.directed-amplification'] });
  }
  if (round.round === 2) {
    expect(state.injuries).toHaveLength(1); expect(state.health).toBe(90);
    expect(round.consequenceRoll).toBeUndefined();
  }
  if (round.round === 3) {
    expect(value.playerActions.find(action => action.id === 'black-emperor.s1.effect-maintenance')).toMatchObject({ order: 2, check: { roll: 54, tier: 'SUCCESS' }, paidCost: 8, mindCost: 4, supportId: 'PA1-COMBAT-SUPPORT-3', resisted: true, windowGranted: null, windowsApplied: [], masteryApplied: [] });
  }
  if (round.round === 4) expect(value.playerActions.find(action => action.giftId !== null)).toMatchObject({ id: 'black-emperor.s7.bribery-weakening', giftId: 'BR7-GIFT-13', paidCost: 3, mindCost: 0 });
  expect(state.random.cursor).toBe(outcome.randomCursorAfter);
}
export function assertObservedFinal(state: SliceState): void {
  expect(state).toMatchObject({ status: 'ACTIVE', revision: 925, week: 222, health: 80, mind: 71, spirituality: 97, cash: 140, actionsRemaining: 1,
    injuryRisk: 1, random: { seed: 'lawyer-natural-v063', cursor: 315 }, combat: null, ending: null });
  expect(state.injuries.map(injury => injury.severity)).toEqual(['LIGHT', 'LIGHT']);
  expect(state.progression).toMatchObject({ sequence: 1, acting: 100, mastery: { 'black-emperor.s1.directed-amplification': 16, 'black-emperor.s1.effect-maintenance': 8 } });
  expect(state.seer.pollution).toBe(0); expect(state.princeOfAbolition.promotionWeek).toBe(216);
  expect(state.princeOfAbolition.bottles.map(bottle => [bottle.outcome, bottle.consumedWeek])).toEqual([['FAILURE', 195], ['FAILURE', 205], ['SUCCESS', 216]]);
  const encounter = state.princeOfAbolition.encounter;
  expect(encounter.terminal).toEqual({ outcome: 'ENEMY_SURRENDERED', round: 6, historyIndex: 21, enemyHealth: 50, enemyMind: 100, enemySpirituality: 73, enemyStatus: 'SURRENDERED', exitMetres: 4, exitSeconds: 4 });
  expect(encounter).toMatchObject({ status: 'RESOLVED', targetId: 'PA1-EDMUND', enemyHealth: 50, enemyMind: 100, enemySpirituality: 73, enemyRisk: 2, directedApplications: 1, maintenanceApplications: 0 });
  expect(encounter.supportPieces.map(piece => [piece.status, piece.wear])).toEqual([['SPENT', 1], ['SPENT', 1], ['SPENT', 1]]);
  expect(encounter.enemyCharges.map(piece => piece.status)).toEqual(['SPENT', 'SPENT', 'SPENT']);
  expect(state.princeOfAbolition.gifts.filter(gift => gift.location === 'PLAYER').map(gift => gift.id)).toEqual(['BR7-GIFT-14', 'BR7-GIFT-15']);
  expect(state.briber.gifts.filter(gift => gift.location === 'PLAYER').map(gift => gift.id)).toEqual(['BR7-GIFT-13', 'BR7-GIFT-14', 'BR7-GIFT-15']);
  expect(state.princeOfAbolition.life.cases['directed-throw'].attempts[0]).toMatchObject({ result: 'ABILITY', closed: true, amplification: 35, maintenanceSeconds: 0, spiritualitySpent: 8, mindSpent: 2, penniesSpent: 20, appliedAbilityIds: ['black-emperor.s1.directed-amplification'] });
  expect(state.princeOfAbolition.life.cases['maintained-flight'].attempts[0]).toMatchObject({ result: 'ABILITY', closed: true, amplification: 0, maintenanceSeconds: 20, spiritualitySpent: 8, mindSpent: 2, penniesSpent: 20, appliedAbilityIds: ['black-emperor.s1.effect-maintenance'] });
  expect(state.princeOfAbolition.life.cases['withdrawn-input'].attempts[0]).toMatchObject({ result: 'ORDINARY', closed: true, withdrawn: true, amplification: 0, maintenanceSeconds: 0, spiritualitySpent: 8, mindSpent: 2, penniesSpent: 20, appliedAbilityIds: [] });
  assertObservedRound(state);
}

/** Inspect actual receipts before any automatic wage/debt/week settlement. */
export function assertCapturedResources(before: SliceState, intent: SliceIntent, after: SliceState): void {
  expect(after.revision).toBe(before.revision + 1); expect(after.runId).toBe(before.runId);
  expect(after.random.seed).toBe(before.random.seed);
  for (const key of PRINCE_OF_ABOLITION_SOURCE_KEYS) same(after[key], before[key]);
  if (intent.type !== 'PRINCE_OF_ABOLITION') return;
  const c = intent.command, old = before.princeOfAbolition, now = after.princeOfAbolition;
  const acquisition = now.acquisitionJournal.length > old.acquisitionJournal.length ? now.acquisitionJournal.at(-1)! : null;
  const life = now.life.journal.length > old.life.journal.length ? now.life.journal.at(-1)! : null;
  if (acquisition) {
    same(acquisition.command, c); expect(acquisition.before.cash).toBe(before.cash);
    expect(acquisition.before.actions).toBe(before.actionsRemaining);
    const fee = c.type === 'LEARN_GUIDANCE' ? 500 : c.type === 'BUY_POTION' ? 1200 : c.type === 'PREPARE_PROMOTION' ? 180 : c.type === 'REQUEST_SUPPLY' ? 100 : 0;
    const ap = ['LEARN_GUIDANCE', 'PREPARE_TASK', 'POTION_WORK', 'PREPARE_PROMOTION', 'REQUEST_SUPPLY'].includes(c.type) ? 1 : 0;
    expect(acquisition.after.cash).toBe(acquisition.before.cash - fee);
    expect(acquisition.after.actions).toBe(acquisition.before.actions - ap);
    same(acquisition.after.gifts, acquisition.before.gifts);
    if (c.type === 'LEARN_GUIDANCE') {
      same(now.gifts, before.briber.gifts); same(now.sourceScene!.originals.operation, before.entropyDuke.life.operation);
      same(now.sourceScene!.originals.site, before.frenzyMage.life);
    }
    if (c.type === 'CONSUME') {
      expect(before.week - before.entropyDuke.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(old.preparedWeek).toBe(before.week); expect(now.preparedWeek).toBeNull();
      expect(after.random.cursor).toBe(before.random.cursor + 1);
      const bottle = now.bottles.find(row => row.id === c.bottleId)!;
      expect(bottle.status).toBe('CONSUMED'); expect(bottle.preparationWeek).toBe(bottle.consumedWeek);
      same(after.injuries, before.injuries); same(now.gifts, old.gifts);
      if (after.progression.sequence === 1) {
        expect(after.health).toBe(before.health); expect(after.spirituality).toBe(before.spirituality);
        expect(now.promotionWeek).toBe(before.week);
      }
    }
  }
  if (life) {
    same(life.command, c); same(life.siteBefore, old.life.site); same(life.siteAfter, now.life.site);
    expect(life.after.cash).toBe(life.before.cash - life.paid.pennies);
    expect(life.after.actions).toBe(life.before.actions - life.paid.actions);
    expect(life.after.spirituality).toBe(life.before.spirituality - life.paid.spirituality);
    expect(life.after.mind).toBe(life.before.mind - life.paid.mind);
    same(life.after.gifts, life.before.gifts); same(life.operationAfter, life.operationBefore);
    expect(life.siteAfter.clockSeconds - life.siteBefore.clockSeconds).toBe(life.elapsedSeconds);
    expect(life.siteAfter.playerTravelMetres - life.siteBefore.playerTravelMetres).toBe(life.moves.reduce((n, move) => n + move.metres, 0));
    same(life.siteAfter.parcel, life.siteBefore.parcel); same(life.siteAfter.pads, life.siteBefore.pads);
    if (c.type === 'PREPARE') {
      expect(life.paid).toMatchObject({ pennies: 20, actions: 1 });
      expect(now.life.pieces.find(piece => piece.caseId === c.caseId)).toMatchObject({ quantity: 1, charges: 1, wear: 0 });
    }
    if (c.type === 'DIRECTED_AMPLIFICATION' || c.type === 'EFFECT_MAINTENANCE') {
      expect(life.paid).toMatchObject({ spirituality: 8, mind: ['FAILURE', 'GREAT_FAILURE'].includes(life.outcome!) ? 4 : 2, actions: 0, pieceCharges: 1 });
      expect(now.life.pieces.find(piece => piece.caseId === c.caseId)).toMatchObject({ charges: 0, wear: 1 });
      expect(after.random.cursor).toBe(before.random.cursor + 1);
      const attempt = now.life.cases[c.caseId].attempts[0]!;
      if (c.type === 'DIRECTED_AMPLIFICATION') {
        expect(attempt.thrown).toBe(false); expect(attempt.amplification).toBe(0); expect(attempt.appliedAbilityIds).toEqual([]);
      } else {
        const prior = old.life.flight!, flight = now.life.flight!;
        expect(flight.id).toBe(prior.id); expect(flight.launchedAt).toBe(prior.launchedAt);
        expect(flight.originalLandAt).toBe(prior.originalLandAt); expect(flight.landsAt).toBe(prior.landsAt + attempt.maintenanceSeconds);
      }
    }
    if (c.type === 'THROW_BALL') {
      expect(life.siteAfter.ball.throws).toBe(life.siteBefore.ball.throws + 1);
      expect(after.random.cursor).toBe(before.random.cursor + 1); expect(now.life.flight).not.toBeNull();
    }
    if (c.type === 'WITHDRAW_CONSENT') {
      expect(now.life.pending).toBeNull(); expect(now.life.cases[c.caseId].attempts[0]!.withdrawn).toBe(true);
      if (old.life.flight && now.life.flight) {
        expect(now.life.flight.id).toBe(old.life.flight.id); expect(now.life.flight.landsAt).toBe(old.life.flight.landsAt);
      }
    }
  }
}

/** Verify real projected fields without copying private roots into assertions. */
export function assertPublicProjection(state: SliceState, view: SliceProjection): void {
  const value = view.princeOfAbolition;
  for (const key of ['sourceHistory', 'sourceScene', 'acquisitionJournal', 'random']) expect(Object.hasOwn(value, key), key).toBe(false);
  for (const root of [value.life, value.encounter]) {
    for (const key of ['journal', 'source', 'startSource', 'startSite', 'randomSeed', 'randomCursor']) {
      // The life projection has a public authored source description, never a replay object.
      if (root === value.life && key === 'source') { expect(typeof value.life.source).toBe('string'); continue; }
      expect(Object.hasOwn(root, key), key).toBe(false);
    }
  }
  // A continuing actual round must expose all three sanitized surfaces, while
  // preserving its independent private replay source and cursor in persistence.
  if (state.lastCombatRound?.princeOfAbolitionOutcome) {
    expect(Object.hasOwn(state.lastCombatRound.princeOfAbolitionOutcome, 'source')).toBe(true);
    expect(typeof state.lastCombatRound.princeOfAbolitionOutcome.randomCursorAfter).toBe('number');
    expect(view.lastCombatRound?.princeOfAbolitionOutcome).toBeDefined();
    same(view.combatHistory.at(-1), view.lastCombatRound);
    if (state.combat) {
      expect(view.combat?.lastRound?.princeOfAbolitionOutcome).toBeDefined();
      same(view.combat!.lastRound, view.lastCombatRound);
    }
  }
  for (const bottle of value.bottles) {
    expect(bottle.source).not.toContain(bottle.id);
    expect(state.princeOfAbolition.bottles.find(row => row.id === bottle.id)!.source).toContain(bottle.id);
  }
  const outcomes = [view.lastCombatRound?.princeOfAbolitionOutcome,
    view.combat?.lastRound?.princeOfAbolitionOutcome,
    ...view.combatHistory.map(round => round.princeOfAbolitionOutcome)].filter(outcome => outcome !== undefined);
  for (const outcome of outcomes) {
    expect(Object.hasOwn(outcome, 'source')).toBe(false); expect(Object.hasOwn(outcome, 'randomCursorAfter')).toBe(false);
    inspectOutcome(outcome);
    expect(JSON.stringify(outcome)).not.toContain(state.random.seed);
    for (const action of [...outcome.playerActions, ...outcome.enemyActions]) {
      expect(Object.hasOwn(action, 'randomCursorBefore')).toBe(false); expect(Object.hasOwn(action, 'randomCursorAfter')).toBe(false);
    }
  }
  for (const action of view.combat?.princeOfAbolition?.lastActionSequence ?? []) {
    expect(Object.hasOwn(action, 'randomCursorBefore')).toBe(false); expect(Object.hasOwn(action, 'randomCursorAfter')).toBe(false);
  }
  if (state.princeOfAbolition.guidanceKnown) {
    expect(value.gifts.held).toBe(state.princeOfAbolition.gifts.filter(gift => gift.location === 'PLAYER').length);
    expect(value.gifts.given).toBe(state.princeOfAbolition.gifts.filter(gift => gift.location === 'GIVEN').length);
    for (const key of PRINCE_OF_ABOLITION_SOURCE_KEYS) expect(view[key].actions.every(action => !action.enabled)).toBe(true);
  }
}

function inspectOutcome(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) { value.forEach((item, index) => inspectOutcome(item, [...path, String(index)])); return; }
  if (value === null || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    expect(key, `Public outcome key ${[...path, key].join('.')}`).not.toMatch(/seed|cursor|^(?:preparation|sourceHistory|sourceScene|acquisitionJournal|startSource|originals|finance)$/i);
    if (key === 'source') { expect(path.slice(-3, -1)).toEqual(['check', 'modifiers']); expect(typeof item).toBe('string'); }
    inspectOutcome(item, [...path, key]);
  }
}
