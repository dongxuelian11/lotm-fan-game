import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { projectPureWhiteAngelLife, projectPureWhiteAngelLifeReceipt, projectPureWhiteAngelAttempt } from '../../src/domain/pure-white-angel/life.js';
import { projectPureWhiteAngelCombat, projectPureWhiteAngelRoundOutcome, projectPureWhiteAngelAction } from '../../src/domain/pure-white-angel/combat.js';
import { projectLightSeekerCombat, projectLightSeekerRoundOutcome, projectLightSeekerPlayerAction, projectLightSeekerEnemyAction } from '../../src/domain/light-seeker/combat.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const fixtures = {
  living: ['tests/fixtures/pure-white-angel-v01940/natural.json', '3f13d554046ecffe3512bda22fb4cd14747be2b06dd6dd47185c025d7d9855f1'],
  s1: ['tests/fixtures/pure-white-angel-v01940/boundary-combat-round-1.json', '769fe0b903a975afd5ad738c3ce9e606a9f0e91c517dab6be6445a91522347a9'],
  s2: ['tests/fixtures/light-seeker-v01720/natural.json', '0a06e9fa84a0b384aea3bf7bb79a7e72b2620ec113ad517bee2af14df35ae556'],
} as const;
const hash = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
function source(name: keyof typeof fixtures, entry = 'final'): SliceState {
  const [file, sha] = fixtures[name];
  expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(sha);
  const state = migrateSliceState(readObjectEntry<SliceState>(file, entry));
  assertValidSliceState(state);
  return state;
}
function keys(value: object, names: string) { expect(Object.keys(value).sort()).toEqual(names.split(' ').sort()); }
function inject(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) inject(child);
  if (!Array.isArray(value)) Object.assign(value, { futurePrivate: 'PRIVATE-FUTURE-FIELD', sourceDigest: 'PRIVATE-DIGEST', randomSeed: 'PRIVATE-SEED' });
}
function noSecrets(value: unknown): void {
  const text = JSON.stringify(value);
  for (const secret of ['"source":{', '"preparation":{', '"randomSeed"', '"randomCursor"', '"randomCursorBefore"', '"randomCursorAfter"', '"randomBefore"', '"randomAfter"', '"sourceDigest"', 'PRIVATE-FUTURE-FIELD', 'bard-natural-v029']) expect(text).not.toContain(secret);
}
const angelActionKeys = 'order actor id planned selectedAbility fallbackReason label selfGain enemyReduction threatens mentalPressure attackKind lightEffect rawContribution rawReduction paidCost mindCost physicalFactor resistanceRoll resistanceChance succeeded finiteResult rodChargeSpent chargePieceId conditionVersionBefore conditionVersionAfter atSeconds elapsedSeconds travelMetres playerMindAfter playerSpiritualityAfter enemyMindAfter enemySpiritualityAfter check windowsBefore windowsAfter pendingBefore pendingAfter masteryApplied countered materialsBefore materialsAfter travelPath lateralTravelPath';
const angelOutcomeKeys = 'targetId round stance continuing consequenceDomain enemyHealth enemyMind enemySpirituality enemyStatus enemyRisk weaponLocation screenReveals totalOwnerMindSpent focusedPurificationAttempts focusedPurificationChecks focusedPurificationSuccesses warmRadianceGuardAttempts warmRadianceGuardChecks warmRadianceGuardSuccesses playerHealthAfter playerMindAfter playerSpiritualityAfter playerRiskAfter elapsedSeconds enemyInjuries playerInjuriesAfter powerUses observations inheritedApplications materialsAfter masteryAfter rootAfter playerActions enemyActions expiredWindows windowsAfter pendingEnemyActionAfter';
const seekerCommonKeys = 'label selfGain enemyReduction threatens mentalPressure order atSeconds elapsedSeconds paidCost physicalFactor playerSpiritualityAfter enemySpiritualityAfter shutterOperationSeconds shutterWear chargeGranted chargeConsumedByOrder appliedAmount consumedLimitedOrder consumedWardOrder rolls siteBefore siteAfter';
const seekerOutcomeKeys = 'targetId round stance continuing enemyHealth enemyMind enemySpirituality enemyStatus playerSpiritualityBefore playerSpiritualityAfter playerHealthAfter playerMindAfter enemySpiritualityBefore playerRiskAfter enemyRiskAfter shutterUsed playerShutterOpened limitedAttempted expiredLimitedChargeOrder expiredWardChargeOrder elapsedSeconds playerInjuriesAfter enemyInjuriesAfter powerUses siteAfter playerActions enemyActions';

describe('Sun inherited S1/S2 positive public allowlists', () => {
  it('keeps the full authenticated 853-command living journal private and preserves public costs and checks', () => {
    const state = source('living'), before = hash(state), life = projectPureWhiteAngelLife(state);
    expect(readObjectEntry<unknown[]>(fixtures.living[0], 'commands')).toHaveLength(853);
    expect(state).toMatchObject({ revision: 854, week: 196, health: 100, mind: 98, spirituality: 106, cash: 1250,
      actionsRemaining: 3, random: { seed: 'bard-natural-v029', cursor: 385 } });
    expect(life.ledger).toHaveLength(67);
    expect(life.sample.price).toBe(40); expect(life.pad.price).toBe(20);
    expect(typeof life.source).toBe('string');
    noSecrets({ prices: { preparation: 150 }, check: { modifiers: [{ source: '实际原样本', value: 10 }] } });
    for (const [index, receipt] of life.ledger.entries()) {
      keys(receipt, 'week revision checkBase outcome elapsedSeconds playerWalkedMetres maraWalkedMetres ivanWalkedMetres ownerEnergySpent date command check before after finance originalsBefore originalsAfter transitions');
      const original = state.pureWhiteAngel.life.journal[index]!;
      expect(receipt.check).toEqual(original.check);
      expect(receipt.before).toEqual(original.before); expect(receipt.after).toEqual(original.after);
      expect(receipt.finance).toEqual(original.finance);
      expect(receipt.originalsBefore).toEqual(original.originalsBefore); expect(receipt.originalsAfter).toEqual(original.originalsAfter);
      expect(receipt.transitions).toEqual(original.transitions);
    }
    const attempt = state.pureWhiteAngel.life.cases['residue-trace'].attempts[0]!;
    expect(projectPureWhiteAngelAttempt(attempt)).toEqual(attempt);
    noSecrets(life); expect(hash(state)).toBe(before);
    for (const receipt of state.pureWhiteAngel.life.journal) inject(receipt);
    for (const c of Object.values(state.pureWhiteAngel.life.cases)) for (const a of c.attempts) inject(a);
    for (const object of [state.pureWhiteAngel.life.ivan, state.pureWhiteAngel.life.sample, state.pureWhiteAngel.life.pad, state.lightSeeker.life.site]) inject(object);
    expect(projectPureWhiteAngelLife(state)).toEqual(life);
    const checked = state.pureWhiteAngel.life.journal.find(r => r.check !== null)!;
    checked.check!.modifiers.push({ source: '实际原样本', value: 10 });
    expect(projectPureWhiteAngelLifeReceipt(checked).check!.modifiers.at(-1)).toEqual({ source: '实际原样本', value: 10 });
  }, 60_000);

  it('maps the real terminal S1 first round through last/history and the action panel', () => {
    const state = source('s1'), before = hash(state), raw = state.lastCombatRound!.pureWhiteAngelOutcome!;
    expect(state.combat).toBeNull(); expect(raw.round).toBe(1); expect(raw.continuing).toBe(false);
    expect(state.combatHistory[23]!.pureWhiteAngelOutcome).toEqual(raw);
    const expected = projectPureWhiteAngelRoundOutcome(raw), displayExpected = projectPlayerText(expected, state.character.name);
    const view = projectSliceState(state), panel = projectPureWhiteAngelCombat(state);
    keys(expected, angelOutcomeKeys);
    for (const action of [...expected.playerActions, ...expected.enemyActions]) keys(action, angelActionKeys);
    expect(expected.playerActions.map(a => [a.check, a.paidCost, a.mindCost, a.playerSpiritualityAfter])).toEqual(raw.playerActions.map(a => [a.check, a.paidCost, a.mindCost, a.playerSpiritualityAfter]));
    expect(expected.rootAfter).toEqual(raw.rootAfter); expect(expected.materialsAfter).toEqual(raw.materialsAfter);
    expect(expected.masteryAfter).toEqual(raw.masteryAfter); expect(expected.inheritedApplications).toEqual(raw.inheritedApplications);
    expect(view.lastCombatRound!.pureWhiteAngelOutcome).toEqual(displayExpected);
    expect(view.combatHistory[23]!.pureWhiteAngelOutcome).toEqual(displayExpected);
    expect(panel.lastActionSequence).toEqual([...raw.playerActions, ...raw.enemyActions].map(projectPureWhiteAngelAction).sort((a, b) => a.order - b.order));
    noSecrets([expected, panel]); expect(hash(state)).toBe(before);
    for (const round of [state.lastCombatRound!, ...state.combatHistory]) if (round.pureWhiteAngelOutcome) inject(round.pureWhiteAngelOutcome);
    for (const object of [state.pureWhiteAngel.encounter.scene, state.pureWhiteAngel.encounter.materials, state.pureWhiteAngel.encounter.powerUses]) inject(object);
    const injected = projectSliceState(state);
    expect(injected.lastCombatRound!.pureWhiteAngelOutcome).toEqual(displayExpected);
    expect(injected.combatHistory[23]!.pureWhiteAngelOutcome).toEqual(displayExpected);
    expect(projectPureWhiteAngelCombat(state)).toEqual(panel);

    // Projection-only stale-cache harness, not a valid save or a natural round:
    // the authenticated first round terminates immediately, so it cannot supply
    // a naturally active lastRound. The exact recorded outcome still must be
    // filtered if encountered through that third public entry point.
    const activeCache = source('s1', 'beforeLast');
    activeCache.combat!.lastRound = structuredClone(state.lastCombatRound);
    expect(projectSliceState(activeCache).combat!.lastRound!.pureWhiteAngelOutcome).toEqual(displayExpected);
  }, 60_000);

  it('replays the captured S2 first intent and filters all three public round paths without losing paid costs', () => {
    const captured = source('s2'), start = source('s2', 'combatStart');
    const command = readObjectEntry<SliceIntent[]>(fixtures.s2[0], 'commands')[start.revision - 1]!;
    expect(command).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    const state = applySliceIntent(start, command);
    expect(state.lastCombatRound).toEqual(captured.combatHistory[10]);
    assertValidSliceState(state);
    const before = hash(state), raw = state.lastCombatRound!.lightSeekerOutcome!;
    expect(raw.round).toBe(1); expect(raw.continuing).toBe(true);
    const expected = projectLightSeekerRoundOutcome(raw), displayExpected = projectPlayerText(expected, state.character.name);
    const view = projectSliceState(state), panel = projectLightSeekerCombat(state);
    keys(expected, seekerOutcomeKeys);
    for (const a of expected.playerActions) keys(a, `${seekerCommonKeys} id attempted succeeded applied fallback`);
    for (const a of expected.enemyActions) keys(a, `${seekerCommonKeys} planned actual shutterChanged`);
    expect(expected.playerActions.map(a => [a.rolls, a.paidCost, a.playerSpiritualityAfter, a.siteAfter])).toEqual(raw.playerActions.map(a => [a.rolls, a.paidCost, a.playerSpiritualityAfter, a.siteAfter]));
    expect(expected.enemyActions.map(a => [a.rolls, a.paidCost, a.enemySpiritualityAfter, a.shutterWear])).toEqual(raw.enemyActions.map(a => [a.rolls, a.paidCost, a.enemySpiritualityAfter, a.shutterWear]));
    expect(expected.siteAfter).toEqual(raw.siteAfter);
    expect(view.lastCombatRound!.lightSeekerOutcome).toEqual(displayExpected);
    expect(view.combatHistory.at(-1)!.lightSeekerOutcome).toEqual(displayExpected);
    expect(view.combat!.lastRound!.lightSeekerOutcome).toEqual(displayExpected);
    expect(panel.lastActionSequence).toEqual([...raw.playerActions.map(a => ({ ...projectLightSeekerPlayerAction(a), actor: 'PLAYER' })), ...raw.enemyActions.map(a => ({ ...projectLightSeekerEnemyAction(a), actor: 'ENEMY' }))].sort((a, b) => a.order - b.order));
    expect(panel).not.toHaveProperty('source'); noSecrets([expected, panel]); expect(hash(state)).toBe(before);
    for (const round of [state.lastCombatRound!, state.combat!.lastRound!, ...state.combatHistory]) if (round.lightSeekerOutcome) inject(round.lightSeekerOutcome);
    for (const object of [state.lightSeeker.life.site, state.lightSeeker.encounter.startSite, state.lightSeeker.encounter.powerUses]) inject(object);
    const injected = projectSliceState(state);
    expect(injected.lastCombatRound!.lightSeekerOutcome).toEqual(displayExpected);
    expect(injected.combatHistory.at(-1)!.lightSeekerOutcome).toEqual(displayExpected);
    expect(injected.combat!.lastRound!.lightSeekerOutcome).toEqual(displayExpected);
    expect(projectLightSeekerCombat(state)).toEqual(panel);
  }, 60_000);
});
