import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyMonsterCommand, projectMonster, validateMonsterState } from '../../src/domain/monster/index.js';
import { applyMachineCommand, projectMachine, validateMachineState } from '../../src/domain/machine/index.js';
import { applyLuckyCommand, projectLucky, validateLuckyState } from '../../src/domain/lucky/index.js';
import { applyCalamityPriestCommand, projectCalamityPriest, validateCalamityPriestState } from '../../src/domain/calamity-priest/index.js';
import { applyWinnerCommand, projectWinner, validateWinnerState } from '../../src/domain/winner/index.js';
import { applyMisfortuneMageCommand, projectMisfortuneMage, validateMisfortuneMageState } from '../../src/domain/misfortune-mage/index.js';
import { applyChaosWalkerAcquisition, hasChaosWalkerHistory, isChaosWalker, projectChaosWalker, validateChaosWalkerLuckHistory, validateChaosWalkerState } from '../../src/domain/chaos-walker/index.js';
import { applyChaosWalkerActivity, chaosWalkerLifeActions, hasChaosWalkerLifeLock, validateChaosWalkerLife } from '../../src/domain/chaos-walker/life.js';
import { applyChaosWalkerEncounterCommand, projectChaosWalkerEncounter, validateChaosWalkerEncounter } from '../../src/domain/chaos-walker/encounter.js';
import { validateMisfortuneMageEncounter } from '../../src/domain/misfortune-mage/encounter.js';
import { createFateProphetState } from '../../src/domain/fate-prophet/index.js';
import { FATE_PROPHET_ABILITY_IDS, FATE_PROPHET_PREPARATION_IDS } from '../../src/domain/fate-prophet/types.js';
import { directedInitial3, dose, fp, promoted as promotedByPublicCommands } from './fate-prophet-directed-helper.js';

const captured = JSON.parse(readFileSync('tests/fixtures/chaos-walker-v01580/natural.json', 'utf8'));
const roots = ['monster', 'machine', 'lucky', 'calamityPriest', 'winner', 'misfortuneMage', 'chaosWalker'] as const;
const validators = [validateMonsterState, validateMachineState, validateLuckyState, validateCalamityPriestState, validateWinnerState, validateMisfortuneMageState, validateChaosWalkerState];
const projectors = [projectMonster, projectMachine, projectLucky, projectCalamityPriest, projectWinner, projectMisfortuneMage, projectChaosWalker];
const original = (): SliceState => structuredClone(captured.final) as SliceState;
/** Directed inheritance-only setup, never evidence of a naturally completed S2 promotion. */
function inherited(): SliceState {
  const s = original(); s.fateProphet = createFateProphetState();
  s.fateProphet.promotionWeek = s.week; s.fateProphet.chaosWalkerActingAtPromotion = s.progression.acting;
  s.progression.sequence = 2; s.progression.acting = 0;
  for (const id of FATE_PROPHET_ABILITY_IDS) s.progression.mastery[id] = 0;
  return s;
}
function context(s: SliceState): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 1 })) };
}
function expectOldValid(s: SliceState) { for (const validate of validators) expect(validate(s), validate.name).toBe(true); }
function rejectWithoutMutation(s: SliceState, action: () => void) { const before = structuredClone(s); expect(action).toThrow(); expect(s).toEqual(before); }

describe('FateProphet2 retains the real Wheel9–3 lineage', () => {
  it('keeps the 551-command W140 body, all seven old roots and fifteen old masteries exactly', () => {
    const prior = original(), s = inherited(); expect(captured.commands).toHaveLength(551); expectOldValid(prior); expectOldValid(s);
    expect(prior).toMatchObject({ week: 140, status: 'ACTIVE', health: 60, mind: 100, spirituality: 120, progression: { sequence: 3, acting: 100 } });
    expect(prior.injuries.map(i => i.severity)).toEqual(['HEAVY', 'HEAVY', 'LIGHT']);
    expect(Object.keys(prior.progression.mastery)).toHaveLength(15); expect(Object.keys(s.progression.mastery)).toHaveLength(17);
    for (const root of roots) expect(s[root]).toEqual(prior[root]);
    for (const [id, mastery] of Object.entries(prior.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
    for (const id of ['wheel.s7.passive-luck', 'wheel.s6.disaster-awareness', 'wheel.s6.disaster-attraction', 'wheel.s5.luck-reserve', 'wheel.s5.ill-fortune']) expect(s.progression.mastery[id]).toBe(0);
    for (const key of ['health', 'mind', 'spirituality', 'injuries', 'injuryRisk', 'cash', 'character', 'combatHistory', 'random'] as const) expect(s[key]).toEqual(prior[key]);
    expect(s.winner.luck).toEqual({ stored: 0, accumulated: 12, spent: 12, lastAccumulateWeek: 138 });
    expect(s.misfortuneMage.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 70 });
    expect(s.chaosWalker.encounter).toMatchObject({ enemyStatus: 'DEAD', enemyHealth: 0, enemySpirituality: 57, weaponLocation: 'COURT' });
    expect(Object.hasOwn(s.fateProphet, 'luck')).toBe(false);
  });
  it('projects old digestion at100 and preserves the dead original enemy without reopening old actions', () => {
    const s = inherited(); expect(isChaosWalker(s)).toBe(false); expect(hasChaosWalkerHistory(s)).toBe(true);
    for (const project of projectors) expect(project(s)).toMatchObject({ promoted: true, acting: 100 });
    s.progression.acting = 25; expect(projectChaosWalker(s).acting).toBe(100); expect(validateChaosWalkerLife(s)).toBe(true);
    expect(projectChaosWalkerEncounter(s)).toMatchObject({ enemy: { status: 'DEAD', health: 0, spirituality: 57 }, actions: [], luck: { stored: 0, capacity: 3 } });
    s.fateProphet.chaosWalkerActingAtPromotion = 99; expect(validateChaosWalkerLife(s)).toBe(false); expect(validateChaosWalkerState(s)).toBe(false);
  });
  it('requires exactly all fifteen inherited IDs and both S2 IDs with finite bounded mastery', () => {
    for (const id of Object.keys(inherited().progression.mastery)) {
      const s = inherited(); delete s.progression.mastery[id];
      for (const validate of validators) expect(validate(s), `${validate.name}: missing ${id}`).toBe(false);
    }
    for (const value of [-1, 501, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const s = inherited(); s.progression.mastery[FATE_PROPHET_ABILITY_IDS[0]] = value;
      for (const validate of validators) expect(validate(s), validate.name).toBe(false);
    }
    const invented = inherited(); invented.progression.mastery['wheel.s2.invented'] = 0;
    for (const validate of validators) expect(validate(invented), validate.name).toBe(false);
    const premature = original(); premature.progression.mastery[FATE_PROPHET_ABILITY_IDS[0]] = 0;
    for (const validate of validators) expect(validate(premature), `${validate.name}: premature S2 ID`).toBe(false);
    const serpent = inherited(); serpent.progression.sequence = 1;
    for (const validate of validators) expect(validate(serpent), `${validate.name}: unsupported S1`).toBe(false);
  });
  it('rejects old bottle rewrites, revival, false stored acting, free luck and unreceipted original-object changes', () => {
    for (const [i, root] of roots.entries()) { const s = inherited(); s[root].bottles[0]!.source += ' rewritten'; expect(validators[i]!(s), root).toBe(false); }
    const gareth = inherited(); gareth.chaosWalker.encounter.enemyHealth = 100; expect(validateChaosWalkerEncounter(gareth)).toBe(false);
    const ferris = inherited(); ferris.misfortuneMage.encounter.enemyStatus = 'RESISTING'; expect(validateMisfortuneMageEncounter(ferris)).toBe(false);
    const freeLuck = inherited(); freeLuck.winner.luck.stored = 1; freeLuck.winner.luck.accumulated++; expect(validateChaosWalkerLuckHistory(freeLuck)).toBe(false);
    const moved = inherited(); moved.chaosWalker.life.cart.location = 'B'; expect(validateChaosWalkerLife(moved)).toBe(false);
    const rewrite = inherited(); rewrite.chaosWalker.life.cases['cart-fork'].attempts[0]!.playerTravelMetres++; expect(validateChaosWalkerLife(rewrite)).toBe(false);
    const acting = inherited(); acting.chaosWalker.misfortuneMageActingAtPromotion = 99; expect(validateMisfortuneMageState(acting)).toBe(false);
  });
  it('retains the S2 spirituality120 cap through an actual REST, new week and HUD projection', () => {
    let s = directedInitial3();
    // The six-action budget is explicit pre-journal unit setup, never a natural-play claim.
    s.actionsRemaining = s.weeklyBudget = 6; assertValidSliceState(s);
    s = fp(s, { type: 'LEARN_GUIDANCE' });
    for (const taskId of FATE_PROPHET_PREPARATION_IDS) s = fp(s, { type: 'PREPARE_TASK', taskId });
    s = fp(s, { type: 'BUY_POTION', bottleId: 'fate-prophet-potion-1' });
    s = fp(s, { type: 'PREPARE_PROMOTION' }); s = fp(s, dose);
    expect(s.progression.sequence).toBe(2); expect(s.actionsRemaining).toBe(1); expect(s.spirituality).toBe(120);
    const before = structuredClone(s); s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(before.week + 1); expect(s.spirituality).toBe(120); assertValidSliceState(s); expectOldValid(s);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
    expect(projectSliceState(s).fateProphet.resources).toMatchObject({ spirituality: 120, maxSpirituality: 120 });
    expect(s.winner.luck).toEqual(before.winner.luck); expect(s.progression.mastery).toEqual(before.progression.mastery);
    expect(s.misfortuneMage.encounter).toEqual(before.misfortuneMage.encounter); expect(s.chaosWalker.encounter).toEqual(before.chaosWalker.encounter);
  });
  it('continues only the one original luck ledger through a paid S2 receipt', () => {
    const prior = promotedByPublicCommands(), s = fp(prior, { type: 'ACCUMULATE' });
    expect(s.winner.luck).toEqual({ stored: 1, accumulated: 13, spent: 12, lastAccumulateWeek: s.week });
    expect(s.actionsRemaining).toBe(prior.actionsRemaining - 1); expect(s.spirituality).toBe(prior.spirituality); expect(s.health).toBe(prior.health);
    expect(s.chaosWalker.life.accumulations).toEqual(prior.chaosWalker.life.accumulations);
    expect(s.chaosWalker.life.clockSeconds).toBe(prior.chaosWalker.life.clockSeconds + 4);
    for (const root of ['monster', 'machine', 'lucky', 'calamityPriest', 'misfortuneMage'] as const) expect(s[root]).toEqual(prior[root]);
    expect(s.chaosWalker.encounter).toEqual(prior.chaosWalker.encounter); expectOldValid(s);
    const unreceipted = structuredClone(s); unreceipted.winner.luck.stored++; unreceipted.winner.luck.accumulated++; expect(validateChaosWalkerLuckHistory(unreceipted)).toBe(false);
  });
  it('accepts only replay-proven movement of the original workshop and keeps private preparation out of old projections', () => {
    let s = promotedByPublicCommands(); const before = structuredClone(s.chaosWalker.life);
    s = fp(s, { type: 'OBSERVE', caseId: 'cart-omen' });
    s = fp(s, { type: 'PREPARE', caseId: 'cart-omen', method: 'ORDINARY' });
    expect(s.chaosWalker.life.playerTravelMetres).toBe(before.playerTravelMetres + 4);
    expect(s.chaosWalker.life.cases).toEqual(before.cases); expectOldValid(s); expect(hasChaosWalkerLifeLock(s)).toBe(false);
    const visible = JSON.stringify(projectSliceState(s));
    for (const privateKey of ['preparationRoll', 'originalBias', 'mechanicalState', 'inheritedScene']) expect(visible).not.toContain(`"${privateKey}"`);
    const freeMove = structuredClone(s); freeMove.chaosWalker.life.playerLocation = 'START'; expect(validateChaosWalkerLife(freeMove)).toBe(false);
    const rewritten = structuredClone(s), source = rewritten.fateProphet.life.source!;
    source.snapshot.cases['cart-fork'].attempts[0]!.playerTravelMetres++;
    rewritten.fateProphet.life.journal[0]!.inheritedScene = structuredClone(source);
    rewritten.chaosWalker.life.cases = structuredClone(source.snapshot.cases);
    expect(validateChaosWalkerLife(rewritten)).toBe(false);
    const gifted = structuredClone(s), oldLuck = gifted.fateProphet.life.source!.luck;
    oldLuck.stored++; oldLuck.accumulated++; gifted.fateProphet.life.journal[0]!.inheritedScene = structuredClone(gifted.fateProphet.life.source);
    expect(validateChaosWalkerLuckHistory(gifted)).toBe(false);
  });
  it('blocks all old potion work, cases, old accumulation and old combat without a partial mutation', () => {
    const s = inherited(), c = context(s);
    const apply = [applyMonsterCommand, applyMachineCommand, applyLuckyCommand, applyCalamityPriestCommand, applyWinnerCommand, applyMisfortuneMageCommand, applyChaosWalkerAcquisition];
    for (const [i, action] of apply.entries()) {
      const bottleId = s[roots[i]!].bottles[0]!.id;
      rejectWithoutMutation(s, () => action(s, { type: 'BUY_POTION', bottleId }, c));
      rejectWithoutMutation(s, () => action(s, { type: 'CONSUME', bottleId, confirmed: true }, c));
    }
    expect(chaosWalkerLifeActions(s)).toEqual([]); expect(hasChaosWalkerLifeLock(s)).toBe(false);
    rejectWithoutMutation(s, () => applyChaosWalkerActivity(s, { type: 'OBSERVE', caseId: 'cart-fork' }, c));
    rejectWithoutMutation(s, () => applyChaosWalkerActivity(s, { type: 'ACCUMULATE' }, c));
    rejectWithoutMutation(s, () => applyChaosWalkerEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, c));
    expect(c.check).not.toHaveBeenCalled(); expect(c.roll).not.toHaveBeenCalled();
  });
});
