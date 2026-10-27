import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { getMercurySnakeCurrentSite, projectMercurySnakeLife } from '../../src/domain/mercury-snake/life.js';
import { MERCURY_SNAKE_ABILITY_IDS } from '../../src/domain/mercury-snake/types.js';
import type { MercurySnakeEncounterBudget } from '../../src/domain/mercury-snake/encounter.js';
import type { FateProphetOperationState } from '../../src/domain/fate-prophet/life.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { fp, promoted } from './fate-prophet-directed-helper.js';
import { capturedSnapshot, captureValueHash, namedBoundary, sameCaptureValue } from './mercury-snake-capture-helper.js';

const PRIVATE_PREPARATION_KEYS = ['preparationRoll', 'originalBias', 'mechanicalState', 'inheritedScene'] as const;
// Independent public receipt whitelist. In particular, operation.preparationRoll
// is private, while normal-check modifiers.source and debt source remain public.
const publicOperationExpectation = (operation: FateProphetOperationState) => ({
  door: operation.door,
  mechanical: operation.mechanical ? { objectId: operation.mechanical.objectId, caseId: operation.mechanical.caseId,
    preparedAt: operation.mechanical.preparedAt, bias: operation.mechanical.bias, version: operation.mechanical.version } : null,
  forecast: operation.forecast ? { objectId: operation.forecast.objectId, version: operation.forecast.version, bias: operation.forecast.bias,
    castAt: operation.forecast.castAt, expiresAt: operation.forecast.expiresAt, valid: operation.forecast.valid } : null,
  correction: operation.correction ? { objectId: operation.correction.objectId, version: operation.correction.version,
    castAt: operation.correction.castAt, expiresAt: operation.correction.expiresAt, percentagePoints: operation.correction.percentagePoints } : null,
});
const publicBudgetExpectation = (budget: MercurySnakeEncounterBudget) => ({
  cash: budget.cash, actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality,
  pollution: budget.pollution, gender: budget.gender, sequence: budget.sequence, acting: budget.acting, injuryRisk: budget.injuryRisk,
  coreStats: { physique: budget.coreStats.physique, perception: budget.coreStats.perception, will: budget.coreStats.will, knowledge: budget.coreStats.knowledge },
  mastery: budget.mastery, completedSources: budget.completedSources, injuries: budget.injuries,
  luck: { stored: budget.luck.stored, lastAccumulateWeek: budget.luck.lastAccumulateWeek, accumulated: budget.luck.accumulated, spent: budget.luck.spent },
});
function noPrivateFields(value: unknown, keys: readonly string[]): void {
  const text = JSON.stringify(value);
  for (const key of keys) expect(text).not.toContain(`"${key}":`);
}

describe('Mercury Snake public projection boundaries', () => {
  it.each(['ORDINARY', 'ABILITY'] as const)('keeps the current S2 %s preparation hidden through the whole slice projection', method => {
    // Existing UNIT source declares cash100000/AP100 before its first S2
    // receipt. Only these two public life commands follow; no capture is replayed.
    let state = promoted();
    state = fp(state, { type: 'OBSERVE', caseId: 'cart-omen' });
    state = fp(state, { type: 'PREPARE', caseId: 'cart-omen', method });
    assertValidSliceState(state);
    const digest = captureValueHash(state), attempt = state.fateProphet.life.cases['cart-omen'].attempts.at(-1)!;
    expect(state.fateProphet.life.operation.mechanical).toMatchObject({ preparationRoll: attempt.preparationRoll, bias: attempt.originalBias });
    expect(attempt.revealedBias).toBeNull(); expect(attempt.eventDraws).toBe(0);
    const projected = projectSliceState(state);
    noPrivateFields(projected, PRIVATE_PREPARATION_KEYS);
    expect(projected.fateProphet.life.currentAttempt!.clue).toBeNull();
    expect(projected.mercurySnake.life.operation).toEqual({ door: state.fateProphet.life.operation.door });
    expect(captureValueHash(state)).toBe(digest);
  }, 60_000);

  const captures: { name: string; load: () => SliceState; revision: number }[] = [
    { name: 'actual promoted snapshot', load: () => capturedSnapshot('promoted'), revision: 768 },
    { name: 'actual first life report', load: () => namedBoundary('cart-return-honest-report').final, revision: 788 },
    { name: 'actual terminal combat snapshot', load: () => capturedSnapshot('combatTerminal'), revision: 842 },
  ];
  it.each(captures)('projects $name with public originals and costs, without private preparation or canonical mutation', ({ load, revision }) => {
    // Read only three selected coordinator captures with CURRENT migration.
    // No producer, command-chain replay, source rewrite or outcome search runs.
    const state = load(), digest = captureValueHash(state), site = getMercurySnakeCurrentSite(state);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.revision).toBe(revision); expect(state.progression.sequence).toBe(1);
    expect(state.mercurySnake.life.operation.mechanical).toMatchObject({ preparationRoll: 41, bias: 'B' });
    const projected = projectSliceState(state).mercurySnake;
    // Historical combat source records elsewhere in SliceProjection are outside
    // this new-root regression. The current Mercury root must not re-export them.
    noPrivateFields(projected, [...PRIVATE_PREPARATION_KEYS, 'randomSeed']);
    expect(projected.life.operation).toEqual({ door: state.mercurySnake.life.operation.door });
    // The whole slice adapts authored display prose after the domain projection;
    // that existing copy conversion does not rewrite the saved original history.
    sameCaptureValue(projectMercurySnakeLife(state).site, site);
    const displaySite = projectPlayerText({ site: structuredClone(site) }, state.character.name).site;
    sameCaptureValue(projected.life.site, displaySite);
    expect(projected.life.site.cart).toEqual(displaySite.cart);
    expect(projected.life.site.parcel).toEqual(displaySite.parcel);
    expect(projected.life.site.cart).toMatchObject({ id: 'CW3-CART', owner: 'GUIDE', location: 'A' });
    expect(projected.life.site.parcel).toMatchObject({ id: 'CW3-PARCEL', owner: 'GUIDE', location: 'CW3-CART', massGrams: 400, sealed: true });
    expect([projected.life.playerLocation, projected.life.clockSeconds, projected.life.playerTravelMetres]).toEqual([site.playerLocation, site.clockSeconds, site.playerTravelMetres]);
    expect(projected.resources).toEqual({ health: state.health, maxHealth: 100, mind: state.mind, maxMind: 100,
      spirituality: state.spirituality, maxSpirituality: 120, cash: `${state.cash}便士`, actionsRemaining: state.actionsRemaining });
    expect(projected.abilities).toHaveLength(19);
    expect(Object.fromEntries(projected.abilities.map(ability => [ability.id, ability.mastery]))).toEqual(state.progression.mastery);
    if (revision === 768) for (const id of MERCURY_SNAKE_ABILITY_IDS) expect(state.progression.mastery[id]).toBe(0);

    expect(projected.life.ledger).toHaveLength(state.mercurySnake.life.journal.length);
    projected.life.ledger.forEach((receipt, index) => {
      const original = state.mercurySnake.life.journal[index]!;
      expect(receipt).toEqual(projectPlayerText({ week: original.week, date: original.date, revision: original.revision, command: original.command,
        paid: original.paid, elapsedSeconds: original.elapsedSeconds, moves: original.moves, check: original.check, outcome: original.outcome }, state.character.name));
    });
    if (revision === 788) {
      expect(projected.life.ledger.at(-1)!.command).toEqual({ type: 'REPORT', caseId: 'cart-return' });
      expect(projected.life.ledger.some(receipt => receipt.check !== null)).toBe(true);
    }
    const preparation = state.mercurySnake.encounter.preparation;
    if (preparation) {
      expect(preparation.randomSeed).toBe(state.random.seed);
      const { finance, originals } = preparation;
      expect(projected.encounter.preparation).toEqual(projectPlayerText({ week: preparation.week, date: preparation.date, revision: preparation.revision,
        pricePaid: preparation.pricePaid, actionsPaid: preparation.actionsPaid, lifeJournalLength: preparation.lifeJournalLength,
        lifeClockSeconds: preparation.lifeClockSeconds, before: publicBudgetExpectation(preparation.before), after: publicBudgetExpectation(preparation.after),
        finance: { weeklyBudget: finance.weeklyBudget, lifeTier: finance.lifeTier, nextLifeTier: finance.nextLifeTier, missedWeeks: finance.missedWeeks,
          credit: finance.credit, debts: finance.debts.map(debt => ({ id: debt.id, source: debt.source, remaining: debt.remaining,
            weeklyPayment: debt.weeklyPayment, createdWeek: debt.createdWeek })) },
        site: preparation.site, operation: publicOperationExpectation(preparation.operation),
        originals: { site: originals.site, operation: publicOperationExpectation(originals.operation),
          luck: { stored: originals.luck.stored, lastAccumulateWeek: originals.luck.lastAccumulateWeek,
            accumulated: originals.luck.accumulated, spent: originals.luck.spent } } }, state.character.name));
      noPrivateFields(projected.encounter.preparation, [...PRIVATE_PREPARATION_KEYS, 'runId', 'randomSeed', 'randomCursor']);
      expect(projected.encounter.operation).toEqual({ door: state.mercurySnake.life.operation.door });
      sameCaptureValue(projected.encounter.site, displaySite);
      expect(projected.encounter.enemy).toMatchObject({ status: 'SURRENDERED', health: 70, mind: 100, spirituality: 95 });
    } else expect(projected.encounter.preparation).toBeNull();
    expect(captureValueHash(state)).toBe(digest);
    // Returned public object graphs cannot mutate the authoritative save either.
    projected.life.site.cart.location = 'B'; projected.life.site.clockSeconds++;
    if (projected.life.ledger[0]) projected.life.ledger[0].paid.pennies++;
    if (projected.encounter.preparation) projected.encounter.preparation.site.cart.location = 'B';
    expect(captureValueHash(state)).toBe(digest);
  }, 120_000);
});
