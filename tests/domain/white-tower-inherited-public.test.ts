import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { projectAllKnowingEyeLife, projectAllKnowingEyeLifeReceipt, projectAllKnowingEyeAttempt } from '../../src/domain/all-knowing-eye/life.js';
import { projectAllKnowingEyeCombat, projectAllKnowingEyeRoundOutcome, projectAllKnowingEyeAction } from '../../src/domain/all-knowing-eye/combat.js';
import { projectWisdomAngelCombat, projectWisdomAngelRoundOutcome, projectWisdomAngelPlayerAction, projectWisdomAngelEnemyAction } from '../../src/domain/wisdom-angel/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const fixtures = {
  living: ['tests/fixtures/all-knowing-eye-v01920/natural.json', 'b838bff34dbf49f3df9968bcfef684a24c184e8320f9b8e6d7a1431bfc75a58f'],
  s1: ['tests/fixtures/all-knowing-eye-v01920/boundary-combat-round-1.json', '4d43df33e156b1222e4d44581974f2ab1ca8db3b28252e4ec11cfb5157e5ef59'],
  s2: ['tests/fixtures/wisdom-angel-v01700/combat-first.json', '2f4967612940e7bbfc54e0da06fce289e9f2363fdfbc5ccca1d9178063c3c2be'],
} as const;
const hash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
function source(name: keyof typeof fixtures): SliceState {
  const [file, sha] = fixtures[name];
  expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(sha);
  return migrateSliceState(readObjectEntry<SliceState>(file, 'final'));
}
function keys(value: object, names: string) { expect(Object.keys(value).sort()).toEqual(names.split(' ').sort()); }
function inject(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) inject(child);
  if (!Array.isArray(value)) Object.assign(value, { futurePrivate: 'PRIVATE-FUTURE-FIELD', sourceDigest: 'PRIVATE-DIGEST', randomSeed: 'PRIVATE-SEED' });
}
function noSecrets(value: unknown): void {
  const text = JSON.stringify(value);
  for (const secret of ['"source":{', '"preparation":{', '"randomSeed"', '"randomCursor"', '"randomCursorBefore"', '"randomCursorAfter"', '"randomBefore"', '"randomAfter"', '"sourceDigest"', 'PRIVATE-FUTURE-FIELD', 'reader-natural-v023']) expect(text).not.toContain(secret);
}
const eyeActionKeys = 'order actor id planned selectedAbility fallbackReason label selfGain enemyReduction threatens mentalPressure attackKind rawContribution rawReduction paidCost mindCost physicalFactor resistanceRoll resistanceChance succeeded finiteResult consumedCraftId rodChargeSpent conditionVersionBefore conditionVersionAfter atSeconds elapsedSeconds travelMetres playerMindAfter playerSpiritualityAfter enemyMindAfter enemySpiritualityAfter check windowsBefore windowsAfter pendingBefore pendingAfter masteryApplied countered craftsBefore craftsAfter materialsBefore materialsAfter travelPath lateralTravelPath';
const eyeOutcomeKeys = 'targetId round stance continuing enemyHealth enemyMind enemySpirituality enemyStatus enemyRisk weaponLocation totalOwnerMindSpent boundedInsightAttempts boundedInsightChecks boundedInsightSuccesses pendingForecastAttempts pendingForecastChecks pendingForecastSuccesses playerHealthAfter playerMindAfter playerSpiritualityAfter playerRiskAfter elapsedSeconds enemyInjuries playerInjuriesAfter powerUses observations materialsAfter craftsAfter consumedCraftIds masteryAfter rootAfter playerActions enemyActions expiredWindows windowsAfter pendingEnemyActionAfter';
const wisdomCommonKeys = 'label selfGain enemyReduction threatens mentalPressure order atSeconds paidCost physicalFactor playerSpiritualityAfter enemySpiritualityAfter conditionVersionBefore conditionVersionAfter responseExpired rolls responseWindowBefore responseWindowAfter';
const wisdomOutcomeKeys = 'targetId round stance continuing enemyHealth enemyMind enemySpirituality enemyStatus playerSpiritualityBefore playerSpiritualityAfter playerHealthAfter playerMindAfter enemySpiritualityBefore playerRiskAfter enemyRiskAfter conditionVersion feintUsed elapsedSeconds playerLocationAfter playerTravelMetresAfter clockSecondsAfter playerInjuriesAfter enemyInjuriesAfter powerUses abilityUses observations craftsAfter consumedCraftIds responseWindowBeforeClose responseWindowAfter playerActions enemyActions';

describe('White Tower inherited S1/S2 positive public allowlists', () => {
  it('keeps the pinned real living journal intact and publishes only explicit receipt and attempt facts', () => {
    const state = source('living'), before = hash(state), life = projectAllKnowingEyeLife(state);
    expect(state).toMatchObject({ revision: 667, random: { seed: 'reader-natural-v023', cursor: 227 } });
    expect(life.ledger).toHaveLength(70);
    expect(life.rig.price).toBe(30);
    expect(typeof life.source).toBe('string');
    noSecrets({ prices: { preparation: 150 }, check: { modifiers: [{ source: '实际原片', value: 35 }] } });
    for (const [index, receipt] of life.ledger.entries()) {
      keys(receipt, 'week revision checkBase outcome elapsedSeconds playerWalkedMetres maraWalkedMetres irenaWalkedMetres date command check before after originalsBefore originalsAfter sliderTransitions');
      expect(receipt.check).toEqual(state.allKnowingEye.life.journal[index]!.check);
      expect(receipt.before).toEqual(state.allKnowingEye.life.journal[index]!.before);
      expect(receipt.after).toEqual(state.allKnowingEye.life.journal[index]!.after);
      expect(receipt.originalsAfter).toEqual(state.allKnowingEye.life.journal[index]!.originalsAfter);
    }
    const attempt = state.allKnowingEye.life.cases['original-paper-check'].attempts[0]!;
    const publicAttempt = projectAllKnowingEyeAttempt(attempt);
    keys(publicAttempt, 'week method closed result elapsedSeconds playerTravelMetres maraTravelMetres irenaTravelMetres spiritualitySpent mindSpent permissionVersion sourceRead returnAgreed entered exited papersTaken papersReturned readFirst readSecond handoverObserved handoverObservation handoverAttempted handoverTier handoverVerified manualCompared rigPlaced rigReturned sliderCocked catchAttempted catchTier catchSucceeded conditionChanged sightlineCleared handStopped sliderRetrieved permission observedVersions insight forecast');
    expect(publicAttempt).toEqual(attempt);
    noSecrets(life);
    expect(hash(state)).toBe(before);
    for (const receipt of state.allKnowingEye.life.journal) inject(receipt);
    for (const c of Object.values(state.allKnowingEye.life.cases)) for (const a of c.attempts) inject(a);
    inject(state.allKnowingEye.life.irena); inject(state.allKnowingEye.life.rig);
    for (const object of [state.wisdomAngel.life.room, state.wisdomAngel.life.mara, state.wisdomAngel.life.papers, state.wisdomAngel.life.device]) inject(object);
    expect(projectAllKnowingEyeLife(state)).toEqual(life);
    const checked = state.allKnowingEye.life.journal.find(r => r.check !== null)!;
    checked.check!.modifiers.push({ source: '实际原片', value: 35 });
    expect(projectAllKnowingEyeLifeReceipt(checked).check!.modifiers.at(-1)).toEqual({ source: '实际原片', value: 35 });
  }, 60_000);

  it('maps the real S1 round across last/history/active combat and the panel without touching private authority', () => {
    const state = source('s1'), before = hash(state), raw = state.lastCombatRound!.allKnowingEyeOutcome!;
    const expected = projectAllKnowingEyeRoundOutcome(raw), view = projectSliceState(state), panel = projectAllKnowingEyeCombat(state);
    keys(expected, eyeOutcomeKeys);
    for (const a of [...expected.playerActions, ...expected.enemyActions]) keys(a, eyeActionKeys);
    expect(expected.playerActions.map(a => a.check)).toEqual(raw.playerActions.map(a => a.check));
    expect(expected.rootAfter).toEqual(raw.rootAfter);
    expect(expected.materialsAfter).toEqual(raw.materialsAfter);
    expect(expected.masteryAfter).toEqual(raw.masteryAfter);
    expect(view.lastCombatRound!.allKnowingEyeOutcome).toEqual(expected);
    expect(view.combatHistory.at(-1)!.allKnowingEyeOutcome).toEqual(expected);
    expect(view.combat!.lastRound!.allKnowingEyeOutcome).toEqual(expected);
    expect(panel.lastActionSequence).toEqual([...raw.playerActions, ...raw.enemyActions].map(projectAllKnowingEyeAction).sort((a, b) => a.order - b.order));
    noSecrets([expected, panel]);
    expect(hash(state)).toBe(before);
    for (const round of [state.lastCombatRound!, state.combat!.lastRound!, ...state.combatHistory]) if (round.allKnowingEyeOutcome) inject(round.allKnowingEyeOutcome);
    for (const object of [state.allKnowingEye.encounter.scene, state.allKnowingEye.encounter.materials, state.allKnowingEye.encounter.powerUses, state.mysticismMagister.crafts, state.polymath.samples.FLASH]) inject(object);
    const injected = projectSliceState(state);
    expect(injected.lastCombatRound!.allKnowingEyeOutcome).toEqual(expected);
    expect(injected.combatHistory.at(-1)!.allKnowingEyeOutcome).toEqual(expected);
    expect(injected.combat!.lastRound!.allKnowingEyeOutcome).toEqual(expected);
    expect(projectAllKnowingEyeCombat(state)).toEqual(panel);
  }, 60_000);

  it('maps the real S2 round across all three entry points and the panel while retaining settled rolls and costs', () => {
    const state = source('s2'), before = hash(state), raw = state.lastCombatRound!.wisdomAngelOutcome!;
    const expected = projectWisdomAngelRoundOutcome(raw), view = projectSliceState(state), panel = projectWisdomAngelCombat(state);
    // The central projection applies the existing display-copy adapter to action labels.
    const displayExpected = projectPlayerText(expected, state.character.name);
    keys(expected, wisdomOutcomeKeys);
    for (const a of expected.playerActions) keys(a, `${wisdomCommonKeys} id consumedCraftId attempted succeeded applied requiredObservations`);
    for (const a of expected.enemyActions) keys(a, `${wisdomCommonKeys} planned actual changedCondition responseConsumed responseApplied responseInvalidated responseReduction observation`);
    expect(expected.playerActions.map(a => [a.rolls, a.paidCost, a.playerSpiritualityAfter])).toEqual(raw.playerActions.map(a => [a.rolls, a.paidCost, a.playerSpiritualityAfter]));
    expect(expected.observations).toEqual(raw.observations);
    expect(expected.craftsAfter).toEqual(raw.craftsAfter);
    expect(view.lastCombatRound!.wisdomAngelOutcome).toEqual(displayExpected);
    expect(view.combatHistory.at(-1)!.wisdomAngelOutcome).toEqual(displayExpected);
    expect(view.combat!.lastRound!.wisdomAngelOutcome).toEqual(displayExpected);
    expect(panel.lastWindowSequence).toEqual([...raw.playerActions.map(a => ({ ...projectWisdomAngelPlayerAction(a), actor: 'PLAYER' })), ...raw.enemyActions.map(a => ({ ...projectWisdomAngelEnemyAction(a), actor: 'ENEMY' }))].sort((a, b) => a.order - b.order));
    expect(panel).not.toHaveProperty('source');
    noSecrets([expected, panel]);
    expect(hash(state)).toBe(before);
    for (const round of [state.lastCombatRound!, state.combat!.lastRound!, ...state.combatHistory]) if (round.wisdomAngelOutcome) inject(round.wisdomAngelOutcome);
    for (const object of [state.wisdomAngel.encounter.room, state.wisdomAngel.encounter.powerUses, state.wisdomAngel.encounter.abilityUses, state.wisdomAngel.encounter.observations, state.mysticismMagister.crafts]) inject(object);
    const injected = projectSliceState(state);
    expect(injected.lastCombatRound!.wisdomAngelOutcome).toEqual(displayExpected);
    expect(injected.combatHistory.at(-1)!.wisdomAngelOutcome).toEqual(displayExpected);
    expect(injected.combat!.lastRound!.wisdomAngelOutcome).toEqual(displayExpected);
    expect(projectWisdomAngelCombat(state)).toEqual(panel);
  }, 60_000);
});
