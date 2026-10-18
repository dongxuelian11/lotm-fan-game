import { expect } from 'vitest';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { NATURE_WALKER_ABILITY_IDS, NATURE_WALKER_SOURCE_KEYS } from '../../src/domain/nature-walker/types.js';
import { getNatureWalkerCurrentSite } from '../../src/domain/nature-walker/life.js';
import { observedCapture, captureBody, currentPad, sameCaptureValue as same } from './nature-walker-capture-helper.js';

// Collection reads only compact, finalized coordinator observations. It cannot
// manufacture a successful promotion, a living exit or an unobserved combat.
const ACTUAL = observedCapture();
export const GUIDANCE = 'paid500-guidance-freezes-eight-roots-and-original-pad50-guard';
export function observedNames(pattern: RegExp): string[] {
  return Object.keys(ACTUAL.boundarySteps).filter(name => pattern.test(name));
}
export function presentObserved(names: readonly string[]): string[] {
  return names.filter(name => Object.hasOwn(ACTUAL.boundarySteps, name));
}
export function distinctObserved(names: readonly string[]): string[] {
  const seen = new Set<number>();
  return names.filter(name => {
    const step = ACTUAL.boundarySteps[name];
    if (step === undefined) throw new Error(`Missing required actual capture boundary: ${name}`);
    if (seen.has(step)) return false;
    seen.add(step); return true;
  });
}
export const LIFE_REOPEN_NAMES = distinctObserved(observedNames(/^(living-response|withdrawn-care|root-impact)-(prepare|living_response|root_bearing|care_check|ordinary_care|apply_impact|ordinary_support|withdraw_permission|return_objects|leave)$/));
export const UI_RETRY_NAMES = distinctObserved([
  ...presentObserved([GUIDANCE]), ...observedNames(/^consume-nature-walker-potion-\d+$/),
  ...observedNames(/^(living-response|withdrawn-care|root-impact)-(prepare|living_response|root_bearing|withdraw_permission)$/),
]);
// Literal round selection from completed capture955: fallback, failed paid
// cast, resisted cast/no consequence, spent original guard, terminal exit.
export const UI_ROUND_NAMES = distinctObserved([1, 3, 5, 7, 9].map(number => `combat-round-${number}`));
export const SQLITE_REPRESENTATIVES = distinctObserved([
  'exact-original851-living-source', ...presentObserved([GUIDANCE]),
  ...observedNames(/^(paid1200-nature-walker-potion-\d+|consume-nature-walker-potion-\d+)$/),
  ...presentObserved(['paid100-after-all-original-bottles-failed', 'next-real-week-three-new-bottle-identities',
    'walk-four-metres-to-actual-outside', 'pay40-place-two-marks-and-three-finite-pieces']),
  ...LIFE_REOPEN_NAMES,
  ...observedNames(/^(living-response|withdrawn-care|root-impact)-(honest-report|response-actual-(failed-)?window|root-bearing-actual-(failed-)?window|actual-care-(ability-applied|ordinary)|actual-impact-.+)$/),
  ...presentObserved(['three-honest-reports-reflected', 'paid30-three-independent-combat-support-pieces',
    'original-adults-remain-outside-player-walks-to-new-yard', 'independent-optional-elias-fight']),
  ...UI_ROUND_NAMES,
  ...presentObserved(['actual-sealed-player-death', 'actual-one-public-retreat-at-declared-cap',
    'ordinary-life-after-actual-exit', 'actual-clinic-pay60-same-current-wound', 'actual-rest-removes-treated-current-wounds']),
  ...Object.entries(ACTUAL.boundarySteps).filter(([, step]) => step === ACTUAL.commands).map(([name]) => name),
]);

/** These are paid receipts before any legitimate weekly settlement. The full
 * captured after-state is separately compared to reducer and SQLite results. */
export function assertCapturedResources(before: SliceState, intent: SliceIntent, after: SliceState): void {
  expect(after.revision).toBe(before.revision + 1); expect(after.runId).toBe(before.runId);
  expect(after.random.seed).toBe(before.random.seed);
  for (const key of NATURE_WALKER_SOURCE_KEYS) same(after[key], before[key]);
  if (intent.type === 'EVENT_CHOICE' && before.activeEvent?.id === 'LIFE-CARE-01') {
    expect(intent.choiceId).toBe('PAY'); expect(after.cash).toBeLessThanOrEqual(before.cash - 60);
    expect(after.health).toBe(before.health); expect(after.injuryRisk).toBe(before.injuryRisk);
    for (const injury of before.injuries.filter(row => row.severity === 'HEAVY' && row.treatedRevision === null)) {
      expect(after.injuries.find(row => row.id === injury.id)).toEqual({ ...injury, treatedRevision: before.revision + 1 });
    }
    return;
  }
  if (intent.type === 'COMBAT_ROUND') { assertCapturedRoundResources(before, after); return; }
  if (intent.type !== 'NATURE_WALKER') return;
  const command = intent.command, old = before.natureWalker, now = after.natureWalker;
  const acquisition = now.acquisitionJournal.length > old.acquisitionJournal.length ? now.acquisitionJournal.at(-1)! : null;
  const life = now.life.journal.length > old.life.journal.length ? now.life.journal.at(-1)! : null;
  if (acquisition) {
    same(acquisition.command, command); expect(acquisition.before.cash).toBe(before.cash);
    expect(acquisition.before.actions).toBe(before.actionsRemaining);
    const fee = command.type === 'LEARN_GUIDANCE' ? 500 : command.type === 'BUY_POTION' ? 1200 : command.type === 'PREPARE_PROMOTION' ? 180 : command.type === 'REQUEST_SUPPLY' ? 100 : 0;
    const ap = ['LEARN_GUIDANCE', 'PREPARE_TASK', 'POTION_WORK', 'PREPARE_PROMOTION', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
    expect(acquisition.after.cash).toBe(acquisition.before.cash - fee); expect(acquisition.after.actions).toBe(acquisition.before.actions - ap);
    if (command.type === 'LEARN_GUIDANCE') same(now.sourceScene!.originals, {
      site: before.coffinBearer.life, operation: before.barrenMatriarch.life.operation, rootPad: before.barrenMatriarch.life.rootPad,
    });
    if (command.type === 'CONSUME') {
      expect(before.week - before.barrenMatriarch.promotionWeek!).toBeGreaterThanOrEqual(12);
      expect(old.preparedWeek).toBe(before.week); expect(now.preparedWeek).toBeNull(); expect(after.random.cursor).toBe(before.random.cursor + 1);
      const bottle = now.bottles.find(row => row.id === command.bottleId)!;
      expect(bottle.status).toBe('CONSUMED'); expect(bottle.preparationWeek).toBe(bottle.consumedWeek);
      same(after.injuries, before.injuries); same(currentPad(after), currentPad(before));
      if (after.progression.sequence === 1) {
        expect(after.health).toBe(before.health); expect(after.spirituality).toBe(before.spirituality); expect(now.promotionWeek).toBe(before.week);
        same(after.progression.mastery, { ...before.progression.mastery, ...Object.fromEntries(NATURE_WALKER_ABILITY_IDS.map(id => [id, 0])) });
      }
    }
  }
  if (life) {
    same(life.command, command); same(life.padBefore, currentPad(before)); same(life.padAfter, currentPad(after));
    const previousSite = getNatureWalkerCurrentSite(before), nextSite = getNatureWalkerCurrentSite(after);
    expect(life.clockBefore).toBe(previousSite.clockSeconds); expect(life.clockAfter).toBe(nextSite.clockSeconds);
    for (const key of ['cash', 'actions', 'spirituality', 'mind', 'health'] as const) {
      expect(life.after[key]).toBe(life.before[key] - life.paid[key === 'cash' ? 'pennies' : key]);
    }
    expect(nextSite.paper.text).toBe(previousSite.paper.text);
    for (const [i, sample] of nextSite.samples.entries()) {
      expect(sample.id).toBe(previousSite.samples[i]!.id); expect(sample.alive).toBe(previousSite.samples[i]!.alive);
      expect(sample.vitality).toBe(previousSite.samples[i]!.vitality);
    }
    if (command.type === 'EXIT_ORIGINAL') {
      expect(life.paid.actions).toBe(0); expect(life.clockAfter - life.clockBefore).toBe(4);
      expect(previousSite.playerLocation).toBe('START'); expect(nextSite.playerLocation).toBe('OUTSIDE');
      expect(nextSite.playerTravelMetres - previousSite.playerTravelMetres).toBe(4);
    }
    if (command.type === 'INITIALISE_WORKAREA' || command.type === 'RENT_ANNEX') {
      expect(life.paid).toMatchObject({ pennies: 40, actions: 1 }); expect(now.life.annex.supportPieces).toBe(3);
      expect(now.life.annex.marks).toHaveLength(2); expect(now.life.annex.placementConsent).toBe('GRANTED');
    }
    if (command.type === 'SETUP_OBJECTS') {
      expect(now.life.annex.effortSpent).toBe(old.life.annex.effortSpent + 3);
      expect(nextSite.recipient.mind).toBe(previousSite.recipient.mind - 1);
    }
    if (command.type === 'LIVING_RESPONSE' || command.type === 'ROOT_BEARING') {
      expect(life.paid).toMatchObject({ spirituality: 8, mind: ['FAILURE', 'GREAT_FAILURE'].includes(life.tier!) ? 4 : 2, actions: 1 });
      expect(now.life.annex.supportPieces).toBe(old.life.annex.supportPieces - 1);
      expect(after.random.cursor).toBe(before.random.cursor + 1); same(after.progression.mastery, before.progression.mastery);
      const effect = now.life.operation[command.type === 'LIVING_RESPONSE' ? 'livingResponse' : 'rootBearing'];
      if (effect) { expect(effect.expiresAt - effect.createdAt).toBe(20); expect(effect.remainingUses).toBe(1); expect(effect.sourceCaseId).toBe(command.caseId); }
    }
    if (command.type === 'CARE_CHECK') {
      expect(after.random.cursor).toBe(before.random.cursor + 1);
      expect(life.source!.assistance).toBe(now.life.cases[command.caseId].attempts[0]!.careAssisted ? 35 : 0);
    }
    if (command.type === 'ORDINARY_CARE') { expect(after.random.cursor).toBe(before.random.cursor); expect(life.source).toBeNull(); }
    if (command.type === 'APPLY_IMPACT' || command.type === 'ORDINARY_SUPPORT' || command.type === 'CANCEL_IMPACT') {
      const impact = now.life.cases[command.caseId].attempts[0]!.impact!;
      expect(impact).toMatchObject({ padId: 'BM2-ROOT-PAD', baseHealthLoss: 5 }); expect(after.health).toBe(before.health - impact.healthLoss);
      expect(currentPad(after).integrity).toBe(currentPad(before).integrity - impact.padWear);
      expect(impact.healthLoss).toBe(command.type === 'CANCEL_IMPACT' ? 0 : command.type === 'ORDINARY_SUPPORT' || impact.rootBearingApplied ? 2 : 5);
      expect(impact.padWear).toBe(command.type === 'CANCEL_IMPACT' ? 0 : 15);
    }
    if (command.type === 'WITHDRAW_PERMISSION') {
      expect(now.life.operation.livingResponse).toBeNull(); expect(now.life.operation.rootBearing).toBeNull(); same(after.progression.mastery, before.progression.mastery);
    }
  }
  if (command.type === 'PREPARE_ENCOUNTER') {
    const paid = now.encounter.preparation!; expect(paid).toMatchObject({ pricePaid: 30, mindPaid: 2, actionsPaid: 0 });
    expect(paid.after.cash).toBe(paid.before.cash - 30); expect(paid.after.mind).toBe(paid.before.mind - 2);
    expect(paid.after.actions).toBe(paid.before.actions); same(paid.rootPad, currentPad(before));
    expect(now.encounter.supportPieces).toHaveLength(3); expect(now.encounter.supportPieces.every(piece => piece.status === 'HELD' && piece.wear === 0)).toBe(true);
  }
}
export function assertCapturedRoundResources(before: SliceState, after: SliceState): void {
  const round = after.lastCombatRound!, outcome = round.natureWalkerOutcome!;
  expect(outcome).toBeDefined(); expect(outcome.source.policy).toBe('ALL'); expect(outcome.source.targetId).toBe('NW1-ELIAS');
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  expect(outcome.playerSpiritualityAfter).toBe(before.spirituality - outcome.playerActions.reduce((sum, action) => sum + action.paidCost, 0));
  const mentalLoss = round.winner === 'ENEMY' && round.consequenceDomain === 'MENTAL' ? 10 : 0;
  expect(outcome.playerMindAfter).toBe(Math.max(0, before.mind - outcome.playerActions.reduce((sum, action) => sum + action.mindCost, 0) - mentalLoss));
  expect(after.spirituality).toBe(outcome.continuing ? Math.min(120, outcome.playerSpiritualityAfter + 12) : outcome.playerSpiritualityAfter);
  expect(outcome.enemySpirituality).toBe(before.natureWalker.encounter.enemySpirituality - outcome.enemyActions.reduce((sum, action) => sum + action.paidCost, 0));
  let integrity = currentPad(before).integrity; const segments = structuredClone(getNatureWalkerCurrentSite(before).guard.segments);
  for (const action of actions) {
    expect(action.rootPadBefore.integrity).toBe(integrity); integrity -= action.padWear; expect(action.rootPadAfter.integrity).toBe(integrity);
    if (action.guardSegmentId) { const segment = segments.find(row => row.id === action.guardSegmentId)!; expect(segment.status).toBe('UNUSED'); segment.status = 'SPENT'; }
    if (action.id === 'mother.s1.living-response' && action.actor === 'PLAYER') {
      expect(action.paidCost).toBe(0); expect(action.mindCost).toBe(0); expect(action.windowGranted).toBeNull();
      expect(action.fallbackReason).toBe('NO_ORIGINAL_LIVING_PLANT_CARE_EVENT'); expect(action.masteryApplied).not.toContain('mother.s1.living-response');
    }
    for (const window of action.windowsApplied) {
      expect(window.kind).toBe('ROOT_BEARING'); expect(window.amount).toBeGreaterThan(0); expect(window.amount).toBeLessThanOrEqual(30);
      expect(['BODY', 'ARC']).toContain(action.attackKind);
    }
    if (action.attackKind === 'MIND') expect(action.windowsApplied).toHaveLength(0);
  }
  expect(currentPad(after).integrity).toBe(integrity); expect(outcome.rootPadAfter.integrity).toBe(integrity);
  same(getNatureWalkerCurrentSite(after).guard.segments, segments); same(outcome.siteAfter.guard.segments, segments);
  expect(outcome.supportPieces.filter(piece => piece.status === 'SPENT')).toHaveLength(outcome.source.body.supportPieces.filter(piece => piece.status === 'SPENT').length + actions.reduce((sum, action) => sum + action.supportWearPaid, 0));
  expect(outcome.enemyCharges.filter(piece => piece.status === 'SPENT')).toHaveLength(outcome.source.body.enemyCharges.filter(piece => piece.status === 'SPENT').length + actions.filter(action => action.enemyChargeId !== null).length);
  for (const [id, mastery] of Object.entries(outcome.source.mastery)) expect(outcome.masteryAfter[id]).toBe(Math.min(500, mastery + 8 * actions.filter(action => action.masteryApplied.includes(id)).length));
  same(after.random, { seed: before.random.seed, cursor: outcome.randomCursorAfter });
  expect(after.combatHistory).toHaveLength(before.combatHistory.length + 1); same(after.combatHistory.slice(0, -1), before.combatHistory);
}

/** lastCombatRound, combat.lastRound and every history entry use the public
 * shape. A check.modifiers[].source string remains a valid public label. */
export function assertPublicProjection(state: SliceState, view: SliceProjection): void {
  const value = view.natureWalker;
  for (const key of ['sourceHistory', 'sourceScene', 'acquisitionJournal', 'random']) expect(Object.hasOwn(value, key), key).toBe(false);
  for (const root of [value.life, value.encounter]) for (const key of ['journal', 'source', 'startSource', 'startSite', 'randomSeed', 'randomCursor']) expect(Object.hasOwn(root, key), key).toBe(false);
  if (state.lastCombatRound?.natureWalkerOutcome) {
    expect(Object.hasOwn(state.lastCombatRound.natureWalkerOutcome, 'source')).toBe(true);
    expect(typeof state.lastCombatRound.natureWalkerOutcome.randomCursorAfter).toBe('number');
    expect(view.lastCombatRound?.natureWalkerOutcome).toBeDefined(); same(view.combatHistory.at(-1), view.lastCombatRound);
    if (state.combat) { expect(view.combat?.lastRound?.natureWalkerOutcome).toBeDefined(); same(view.combat!.lastRound, view.lastCombatRound); }
  }
  const pairs = [
    [state.lastCombatRound?.natureWalkerOutcome, view.lastCombatRound?.natureWalkerOutcome],
    [state.combat?.lastRound?.natureWalkerOutcome, view.combat?.lastRound?.natureWalkerOutcome],
    ...state.combatHistory.map((round, index) => [round.natureWalkerOutcome, view.combatHistory[index]?.natureWalkerOutcome] as const),
  ] as const;
  for (const [raw, outcome] of pairs) {
    if (!raw) continue;
    expect(outcome).toBeDefined(); if (!outcome) throw new Error('Missing actual public NatureWalker round outcome.');
    inspectOutcome(outcome); expect(JSON.stringify(outcome)).not.toContain(state.random.seed);
    expect(outcome).not.toHaveProperty('operationAfter'); expect(outcome.siteAfter).not.toHaveProperty('cases');
    const rawActions = [...raw.playerActions, ...raw.enemyActions], publicActions = [...outcome.playerActions, ...outcome.enemyActions];
    expect(publicActions).toHaveLength(rawActions.length);
    publicActions.forEach((action, index) => expect(action.check?.modifiers).toEqual(rawActions[index]!.check?.modifiers.map(({ source, value }) => ({ source, value }))));
  }
  for (const action of view.combat?.natureWalker?.lastActionSequence ?? []) inspectOutcome(action);
}
function inspectOutcome(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) { value.forEach((item, index) => inspectOutcome(item, [...path, String(index)])); return; }
  if (value === null || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    expect(key, `Public outcome key ${[...path, key].join('.')}`).not.toMatch(/seed|cursor|^(?:preparationRoll|preparation|sourceHistory|sourceScene|acquisitionJournal|startSource|originals|finance|journal|operationAfter)$/i);
    if (key === 'source') { expect(path.slice(-3, -1)).toEqual(['check', 'modifiers']); expect(typeof item).toBe('string'); }
    inspectOutcome(item, [...path, key]);
  }
}
export function assertObservedFinal(state: SliceState): void {
  same(captureBody(state), ACTUAL.final); same(state.natureWalker.encounter.terminal, ACTUAL.terminal);
  same(state.natureWalker.bottles, ACTUAL.bottles); expect(state.natureWalker.promotionWeek).toBe(ACTUAL.promotionWeek);
  expect(state.combatHistory.filter(round => round.natureWalkerOutcome).map(round => round.round)).toEqual(ACTUAL.combatRounds);
  if (ACTUAL.stage === 'ACTUAL_TERMINAL_WITH_NATURAL851_HISTORY') { expect(state.status).toBe('DEAD'); expect(state.health).toBe(0); expect(state.ending?.kind).toBe('DEATH'); }
  else expect(state.status).toBe('ACTIVE');
  expect(state).toMatchObject({ status: 'ACTIVE', revision: 956, week: 228, health: 40, mind: 83, spirituality: 114, cash: 255, actionsRemaining: 3,
    injuryRisk: 3, random: { seed: 'cultivator-natural-v069', cursor: 349 }, combat: null,
    progression: { sequence: 1, acting: 100, mastery: { 'mother.s1.living-response': 8, 'mother.s1.root-bearing': 8 } } });
  expect(state.ending).toBeNull(); expect(state.natureWalker.promotionWeek).toBe(221);
  expect(state.injuries.map(injury => [injury.severity, injury.acquiredRevision, injury.treatedRevision])).toEqual([['LIGHT', 948, null], ['LIGHT', 949, null], ['HEAVY', 953, null], ['HEAVY', 954, null]]);
  expect(state.natureWalker.encounter.terminal).toEqual({ outcome: 'ENEMY_SURRENDERED', round: 9, historyIndex: 25, enemyHealth: 40, enemyMind: 100, enemySpirituality: 53, enemyStatus: 'SURRENDERED', exitMetres: 4, exitSeconds: 4 });
  expect(currentPad(state)).toMatchObject({ id: 'BM2-ROOT-PAD', integrity: 5, location: 'OUTSIDE' });
  expect(getNatureWalkerCurrentSite(state)).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 228, clockSeconds: 1522,
    owner: { alive: true, health: 100, mind: 100, location: 'OUTSIDE' }, recipient: { alive: true, health: 100, mind: 97, location: 'OUTSIDE' } });
  expect(getNatureWalkerCurrentSite(state).guard.segments.map(segment => segment.status)).toEqual(['SPENT', 'SPENT', 'SPENT']);
  expect(state.natureWalker.life.annex).toMatchObject({ supportPieces: 0, effortSpent: 9 });
  assertObservedRound(state);
}

// Literal observations of the sole finalized955-command capture, never targets.
export const OBSERVED_SQLITE_STEPS = {
  "exact-original851-living-source": 851,
  "paid500-guidance-freezes-eight-roots-and-original-pad50-guard": 852,
  "paid1200-nature-walker-potion-1": 877,
  "consume-nature-walker-potion-1": 883,
  "walk-four-metres-to-actual-outside": 884,
  "pay40-place-two-marks-and-three-finite-pieces": 888,
  "living-response-prepare": 891,
  "living-response-living_response": 898,
  "living-response-care_check": 899,
  "living-response-return_objects": 900,
  "living-response-leave": 904,
  "withdrawn-care-prepare": 907,
  "withdrawn-care-living_response": 914,
  "withdrawn-care-withdraw_permission": 915,
  "withdrawn-care-care_check": 916,
  "withdrawn-care-return_objects": 917,
  "withdrawn-care-leave": 921,
  "root-impact-prepare": 924,
  "root-impact-root_bearing": 931,
  "root-impact-apply_impact": 932,
  "root-impact-return_objects": 933,
  "root-impact-leave": 937,
  "living-response-honest-report": 905,
  "withdrawn-care-honest-report": 922,
  "root-impact-honest-report": 938,
  "three-honest-reports-reflected": 940,
  "paid30-three-independent-combat-support-pieces": 943,
  "original-adults-remain-outside-player-walks-to-new-yard": 944,
  "independent-optional-elias-fight": 945,
  "combat-round-1": 946,
  "combat-round-3": 948,
  "combat-round-5": 950,
  "combat-round-7": 952,
  "combat-round-9": 954,
  "ordinary-life-after-actual-exit": 955
} as const;
export const OBSERVED_ROUNDS = [
  {
    "round": 1,
    "stance": "CONTROL",
    "first": "PLAYER",
    "playerCount": 2,
    "enemyCount": 3,
    "playerCountRoll": 17,
    "enemyCountRoll": 36,
    "winner": "PLAYER",
    "consequenceDomain": "BODY",
    "outcome": {
      "playerHealthAfter": 100,
      "playerMindAfter": 98,
      "playerSpiritualityAfter": 108,
      "enemyHealth": 90,
      "enemyMind": 100,
      "enemySpirituality": 95,
      "randomCursorAfter": 253,
      "continuing": true
    }
  },
  {
    "round": 2,
    "stance": "CONTROL",
    "first": "ENEMY",
    "playerCount": 3,
    "enemyCount": 3,
    "playerCountRoll": 45,
    "enemyCountRoll": 26,
    "winner": "ENEMY",
    "consequenceDomain": "BODY",
    "outcome": {
      "playerHealthAfter": 90,
      "playerMindAfter": 98,
      "playerSpiritualityAfter": 120,
      "enemyHealth": 90,
      "enemyMind": 100,
      "enemySpirituality": 85,
      "randomCursorAfter": 263,
      "continuing": true
    }
  },
  {
    "round": 3,
    "stance": "CONTROL",
    "first": "PLAYER",
    "playerCount": 2,
    "enemyCount": 2,
    "playerCountRoll": 20,
    "enemyCountRoll": 15,
    "winner": "ENEMY",
    "consequenceDomain": "BODY",
    "outcome": {
      "playerHealthAfter": 80,
      "playerMindAfter": 94,
      "playerSpiritualityAfter": 112,
      "enemyHealth": 90,
      "enemyMind": 100,
      "enemySpirituality": 81,
      "randomCursorAfter": 272,
      "continuing": true
    }
  },
  {
    "round": 4,
    "stance": "CONTROL",
    "first": "ENEMY",
    "playerCount": 5,
    "enemyCount": 4,
    "playerCountRoll": 86,
    "enemyCountRoll": 67,
    "winner": "PLAYER",
    "consequenceDomain": "BODY",
    "outcome": {
      "playerHealthAfter": 90,
      "playerMindAfter": 90,
      "playerSpiritualityAfter": 108,
      "enemyHealth": 80,
      "enemyMind": 100,
      "enemySpirituality": 73,
      "randomCursorAfter": 286,
      "continuing": true
    }
  },
  {
    "round": 5,
    "stance": "CONTROL",
    "first": "PLAYER",
    "playerCount": 4,
    "enemyCount": 5,
    "playerCountRoll": 71,
    "enemyCountRoll": 90,
    "winner": "PLAYER",
    "consequenceDomain": null,
    "outcome": {
      "playerHealthAfter": 100,
      "playerMindAfter": 85,
      "playerSpiritualityAfter": 102,
      "enemyHealth": 80,
      "enemyMind": 100,
      "enemySpirituality": 69,
      "randomCursorAfter": 301,
      "continuing": true
    }
  },
  {
    "round": 6,
    "stance": "CONTROL",
    "first": "ENEMY",
    "playerCount": 2,
    "enemyCount": 4,
    "playerCountRoll": 13,
    "enemyCountRoll": 70,
    "winner": "PLAYER",
    "consequenceDomain": "BODY",
    "outcome": {
      "playerHealthAfter": 100,
      "playerMindAfter": 85,
      "playerSpiritualityAfter": 114,
      "enemyHealth": 70,
      "enemyMind": 100,
      "enemySpirituality": 61,
      "randomCursorAfter": 311,
      "continuing": true
    }
  },
  {
    "round": 7,
    "stance": "CONTROL",
    "first": "PLAYER",
    "playerCount": 3,
    "enemyCount": 5,
    "playerCountRoll": 42,
    "enemyCountRoll": 85,
    "winner": "ENEMY",
    "consequenceDomain": "BODY",
    "outcome": {
      "playerHealthAfter": 70,
      "playerMindAfter": 84,
      "playerSpiritualityAfter": 109,
      "enemyHealth": 70,
      "enemyMind": 100,
      "enemySpirituality": 53,
      "randomCursorAfter": 325,
      "continuing": true
    }
  },
  {
    "round": 8,
    "stance": "CONTROL",
    "first": "ENEMY",
    "playerCount": 3,
    "enemyCount": 2,
    "playerCountRoll": 39,
    "enemyCountRoll": 20,
    "winner": "ENEMY",
    "consequenceDomain": "BODY",
    "outcome": {
      "playerHealthAfter": 40,
      "playerMindAfter": 84,
      "playerSpiritualityAfter": 115,
      "enemyHealth": 70,
      "enemyMind": 100,
      "enemySpirituality": 53,
      "randomCursorAfter": 335,
      "continuing": true
    }
  },
  {
    "round": 9,
    "stance": "CONTROL",
    "first": "PLAYER",
    "playerCount": 4,
    "enemyCount": 5,
    "playerCountRoll": 68,
    "enemyCountRoll": 87,
    "winner": "PLAYER",
    "consequenceDomain": "BODY",
    "outcome": {
      "playerHealthAfter": 40,
      "playerMindAfter": 83,
      "playerSpiritualityAfter": 114,
      "enemyHealth": 40,
      "enemyMind": 100,
      "enemySpirituality": 53,
      "randomCursorAfter": 349,
      "continuing": false
    }
  }
] as const;
export function assertObservedRound(state: SliceState): void {
  const round = state.lastCombatRound!, actual = round.natureWalkerOutcome!;
  expect(actual).toBeDefined(); const pin = OBSERVED_ROUNDS.find(row => row.round === round.round);
  expect(pin).toBeDefined(); if (!pin) throw new Error('Unexpected uncaptured NatureWalker round.');
  const { outcome, consequenceDomain, ...header } = pin;
  expect(round).toMatchObject(header); expect(round.consequenceDomain ?? null).toBe(consequenceDomain); expect(actual).toMatchObject(outcome);
  expect(actual.livingResponseApplications).toBe(0); expect(actual.rootBearingApplications).toBe(0);
  if (round.round === 3 || round.round === 5) {
    const cast = actual.playerActions.find(action => action.id === 'mother.s1.root-bearing')!;
    expect(cast).toMatchObject({ paidCost: 8, mindCost: 4, succeeded: false, resisted: round.round === 5,
      check: { roll: round.round === 3 ? 91 : 28, tier: round.round === 3 ? 'FAILURE' : 'SUCCESS' }, windowGranted: null, masteryApplied: [] });
  }
  if (round.round === 5) { expect(round.consequenceRoll).toBeUndefined(); expect(round.consequenceWeights).toBeNull(); }
}
export function assertObservedBoundary(name: string, state: SliceState): void {
  if (name === 'consume-nature-walker-potion-1') {
    expect(state).toMatchObject({ revision: 884, week: 221, health: 100, mind: 85, spirituality: 120, cash: 0, actionsRemaining: 1,
      random: { seed: 'cultivator-natural-v069', cursor: 239 }, progression: { sequence: 1 } });
    expect(state.natureWalker.promotionWeek).toBe(221);
    expect(state.natureWalker.acquisitionJournal.at(-1)!.check).toMatchObject({ chance: 36, difficulty: 30, roll: 32, tier: 'SUCCESS' });
    expect(state.natureWalker.bottles.map(bottle => [bottle.status, bottle.outcome, bottle.consumedWeek])).toEqual([['CONSUMED', 'SUCCESS', 221], ['SUPPLIER', null, null], ['SUPPLIER', null, null]]);
    for (const id of NATURE_WALKER_ABILITY_IDS) expect(state.progression.mastery[id]).toBe(0);
  }
  if (name === 'living-response-living_response') {
    expect(state.natureWalker.life.cases['living-response'].attempts[0]).toMatchObject({ livingResponseTier: 'SUCCESS', careAssisted: false, spiritualitySpent: 8, mindSpent: 2, appliedAbilityIds: [] });
    expect(state.natureWalker.life.operation.livingResponse).toMatchObject({ remainingUses: 1 });
  }
  if (name === 'living-response-care_check') expect(state.natureWalker.life.cases['living-response'].attempts[0]).toMatchObject({ careTier: 'SUCCESS', careAssisted: true, appliedAbilityIds: ['mother.s1.living-response'] });
  if (name === 'withdrawn-care-withdraw_permission' || name === 'withdrawn-care-care_check') {
    expect(state.natureWalker.life.cases['withdrawn-care'].attempts[0]).toMatchObject({ permissionWithdrawn: true, livingResponseTier: 'SUCCESS', careAssisted: false, spiritualitySpent: 8, mindSpent: 2, appliedAbilityIds: [] });
    expect(state.natureWalker.life.operation.livingResponse).toBeNull(); expect(state.natureWalker.life.operation.rootBearing).toBeNull();
  }
  if (name === 'root-impact-root_bearing') {
    expect(state.natureWalker.life.cases['root-impact'].attempts[0]).toMatchObject({ rootBearingTier: 'SUCCESS', spiritualitySpent: 8, mindSpent: 2, appliedAbilityIds: [] });
    expect(state.natureWalker.life.operation.rootBearing).toMatchObject({ remainingUses: 1 });
  }
  if (name === 'root-impact-apply_impact') {
    expect(state.health).toBe(98); expect(currentPad(state).integrity).toBe(35);
    expect(state.natureWalker.life.cases['root-impact'].attempts[0]!.impact).toMatchObject({ mode: 'IMPACT', healthLoss: 2, padWear: 15, rootBearingApplied: true });
  }
  if (state.lastCombatRound?.natureWalkerOutcome) assertObservedRound(state);
}
