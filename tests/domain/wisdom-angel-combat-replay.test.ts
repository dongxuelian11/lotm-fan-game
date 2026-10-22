import { beforeAll, describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { baseAdvantage, consequenceWeights } from '../../src/domain/slice/combat.js';
import type { SliceState, SliceCombatRound } from '../../src/domain/slice/types.js';
import { validateWisdomAngelRoundOutcome, validateWisdomAngelCombatRound, projectWisdomAngelCombat,
  type WisdomAngelRoundOutcome } from '../../src/domain/wisdom-angel/combat.js';
import { validateWisdomAngelEncounter } from '../../src/domain/wisdom-angel/encounter.js';
import { wisdomAngelSnapshot, wisdomAngelBoundaryForIntent } from './wisdom-angel-helper.js';

let original: SliceState, naturalTerminal: SliceState, naturalRounds: SliceCombatRound[];
beforeAll(() => {
  original = wisdomAngelSnapshot('combatStart');
  naturalTerminal = wisdomAngelBoundaryForIntent(i => i.type === 'COMBAT_ROUND', b => b.final.wisdomAngel.encounter.terminal !== null).final;
  const encounter = naturalTerminal.wisdomAngel.encounter;
  naturalRounds = naturalTerminal.combatHistory.slice(encounter.startHistoryIndex!, encounter.terminal!.historyIndex + 1);
});
const outcome = (r: SliceCombatRound): WisdomAngelRoundOutcome => {
  if (!r.wisdomAngelOutcome) throw new Error('Expected real recorded Wisdom Angel outcome'); return r.wisdomAngelOutcome;
};
const sum = (xs: { selfGain: number; enemyReduction: number }[], key: 'selfGain' | 'enemyReduction') => xs.reduce((n, a) => n + a[key], 0);
const legacy = ['reader', 'reasoner', 'detective', 'polymath', 'prophet', 'insightScholar'] as const;
function assertAccounting(before: SliceState, after: SliceState, r: SliceCombatRound): void {
  const o = outcome(r), x = o.source, ordered = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order);
  expect(o.playerSpiritualityAfter).toBe(x.playerSpirituality - o.playerActions.reduce((n, a) => n + a.paidCost, 0));
  expect(o.enemySpirituality).toBe(x.enemySpirituality - o.enemyActions.reduce((n, a) => n + a.paidCost, 0));
  expect(after.spirituality).toBe(o.continuing ? Math.min(120, o.playerSpiritualityAfter + 12) : o.playerSpiritualityAfter);
  expect(after.wisdomAngel.encounter.enemySpirituality).toBe(o.enemySpirituality);
  expect(o.enemySpirituality).toBe(120 - o.powerUses.FLASH * 7 - o.powerUses.WARD * 6 - o.powerUses.FEINT * 3);
  let playerS = x.playerSpirituality, enemyS = x.enemySpirituality, version = x.conditionVersion;
  const observations = structuredClone(x.observations);
  for (const [i, a] of ordered.entries()) {
    expect(a.order).toBe(i); expect(a.atSeconds).toBe(i * 5); expect(a.conditionVersionBefore).toBe(version);
    if ('id' in a) {
      playerS -= a.paidCost;
      for (const seen of a.requiredObservations) {
        expect(observations).toContainEqual(seen);
        if (a.id === 'reader.s2.conditional-synthesis' || a.id === 'reader.s2.observed-response') expect(seen.conditionVersion).toBe(version);
      }
      if (a.id === 'reader.s2.conditional-synthesis' && a.succeeded) expect(a).toMatchObject({ selfGain: 65, threatens: false, paidCost: 5, applied: true });
      if (a.id === 'reader.s2.observed-response' && a.succeeded) {
        expect(a).toMatchObject({ selfGain: 0, enemyReduction: 0, paidCost: 6, applied: false });
        expect(a.responseWindowAfter?.observation).toEqual(observations.filter(v => v.conditionVersion === version).at(-1));
      }
    } else {
      enemyS -= a.paidCost;
      if (a.changedCondition) { expect(a.actual).toBe('FEINT'); expect(a.paidCost).toBe(3); version++; }
      if (a.observation) {
        expect(a.actual).toBe(a.observation.power); expect(a.observation.paidCost).toBe(a.paidCost);
        expect(a.observation.atSeconds).toBe(x.clockSeconds + a.atSeconds); observations.push(a.observation);
      }
      if (a.responseApplied) {
        expect(a.responseConsumed).toBe(true); expect(a.responseReduction).toBe(45); expect(a.paidCost).toBeGreaterThan(0);
        expect(a.responseWindowBefore?.targetPower).toBe(a.actual); expect(a.responseWindowBefore?.conditionVersion).toBe(a.conditionVersionBefore);
        expect(a.responseWindowBefore!.expiresAt).toBeGreaterThan(a.atSeconds);
      }
      if (a.responseConsumed) expect(a.responseWindowAfter).toBeNull();
    }
    expect(a.conditionVersionAfter).toBe(version); expect(a.playerSpiritualityAfter).toBe(playerS); expect(a.enemySpiritualityAfter).toBe(enemyS);
    expect(a.randomCursorAfter - a.randomCursorBefore).toBe(a.rolls.length);
    expect(a.label).toContain(`本人S${playerS}/120`); expect(a.label).toContain(`原敌S${enemyS}/120`);
  }
  expect(o.observations).toEqual(observations); expect(o.conditionVersion).toBe(version); expect(o.conditionVersion).toBe(o.powerUses.FEINT + 1);
  expect(o.enemyActions.filter(a => a.changedCondition).length).toBeLessThanOrEqual(1);
  for (const [key, id] of [['SYNTHESIS', 'reader.s2.conditional-synthesis'], ['RESPONSE', 'reader.s2.observed-response']] as const) {
    const actions = o.playerActions.filter(a => a.id === id);
    expect(o.abilityUses[key].attempts).toBe(x.abilityUses[key].attempts + actions.filter(a => a.attempted).length);
    expect(o.abilityUses[key].successes).toBe(x.abilityUses[key].successes + actions.filter(a => a.succeeded).length);
    expect(o.abilityUses[key].effects).toBe(x.abilityUses[key].effects + (key === 'SYNTHESIS' ? actions.filter(a => a.applied).length : o.enemyActions.filter(a => a.responseApplied).length));
  }
  for (const id of ['FLASH', 'WARD', 'FEINT'] as const) expect(o.powerUses[id]).toBe(x.powerUses[id] + o.enemyActions.filter(a => a.actual === id).length);
  const core = x.physique * .35 + x.perception * .25 + x.will * .25 + x.knowledge * .15;
  expect(r.playerAdvantage).toBe(Math.max(125, baseAdvantage(core, x.playerHealth, x.playerMind, x.playerSpirituality, 1250, 120) + sum(o.playerActions, 'selfGain') - sum(o.enemyActions, 'enemyReduction')));
  expect(r.enemyAdvantage).toBe(Math.max(125, baseAdvantage(24, x.enemyHealth, x.enemyMind, x.enemySpirituality, 1250, 120) + sum(o.enemyActions, 'selfGain') - sum(o.playerActions, 'enemyReduction')));
  expect(r.winChance).toBe(r.playerAdvantage / (r.playerAdvantage + r.enemyAdvantage) * 100);
  if (r.consequenceWeights) expect(r.consequenceWeights).toEqual(consequenceWeights(r.winner === 'PLAYER' ? o.enemyRiskAfter : o.playerRiskAfter));
  if (r.winner === 'PLAYER' && !o.playerActions.some(a => a.threatens)) {
    expect(r.consequenceWeights).toBeNull(); expect(r.consequenceRoll).toBeUndefined(); expect(o.enemyHealth).toBe(x.enemyHealth); expect(o.enemyInjuriesAfter).toEqual(x.enemyInjuries);
  }
  expect(o.responseWindowAfter).toBeNull(); expect(after.wisdomAngel.encounter.responseWindow).toBeNull();
  expect(after.random.seed).toBe(before.random.seed); expect(after.random.cursor).toBe(o.randomCursorAfter);
  expect(after.combatHistory.slice(0, -1)).toEqual(before.combatHistory); expect(after.progression.mastery).toEqual(before.progression.mastery);
  for (const key of legacy) expect(after[key]).toEqual(before[key]);
  expect(o.source.flashSample).toEqual(before.polymath.samples.FLASH); expect(o.source.crafts).toEqual(before.mysticismMagister.crafts);
  expect(new Set(o.consumedCraftIds).size).toBe(o.consumedCraftIds.length);
  const expectedCrafts = before.mysticismMagister.crafts.map(c => o.consumedCraftIds.includes(c.id) ? { ...c, status: 'CONSUMED', usedWeek: before.week } : c);
  expect(after.mysticismMagister).toEqual({ ...before.mysticismMagister, crafts: expectedCrafts }); expect(o.craftsAfter).toEqual(expectedCrafts);
  expect(o.playerTravelMetresAfter).toBe(x.playerTravelMetres + (!o.continuing && o.playerHealthAfter > 0 ? 2 : 0));
  expect(o.elapsedSeconds).toBe(!o.continuing && o.playerHealthAfter > 0 ? 62 : 60); expect(o.clockSecondsAfter).toBe(x.clockSeconds + o.elapsedSeconds);
}
function firstAction(o: WisdomAngelRoundOutcome) {
  const a = [...o.playerActions, ...o.enemyActions].sort((a, b) => a.order - b.order)[0];
  if (!a) throw new Error('Expected an actual non-retreat action'); return a;
}
function tamperRound(): SliceCombatRound {
  const round = naturalRounds.find(r => outcome(r).playerActions.length + outcome(r).enemyActions.length > 0);
  if (!round) throw new Error('Captured natural fight contains no actual action'); return structuredClone(round);
}

describe('Wisdom Angel actual public-command combat and exact deterministic replay', () => {
  it('replays every captured natural round with the original RNG and actual terminal, without assuming victory, death or a round count', () => {
    expect(naturalRounds.length).toBeGreaterThan(0); let state = original;
    for (const expected of naturalRounds) {
      const before = state, frozen = structuredClone(state); state = applySliceIntent(state, { type: 'COMBAT_ROUND', stance: expected.stance });
      expect(before).toEqual(frozen); expect(state.combatHistory.at(-1)).toEqual(expected);
      expect(validateWisdomAngelRoundOutcome(outcome(expected))).toBe(true); expect(validateWisdomAngelCombatRound(expected)).toBe(true);
      expect(validateWisdomAngelEncounter(state)).toBe(true); assertValidSliceState(state); assertAccounting(before, state, expected);
    }
    expect(state).toEqual(naturalTerminal); const e = state.wisdomAngel.encounter, last = outcome(naturalRounds.at(-1)!);
    expect(e.terminal).not.toBeNull(); expect(e.terminal!.round).toBe(naturalRounds.length); expect(e.terminal!.historyIndex).toBe(state.combatHistory.length - 1);
    expect(e.terminal).toMatchObject({ enemyHealth: last.enemyHealth, enemyMind: last.enemyMind, enemySpirituality: last.enemySpirituality, enemyStatus: last.enemyStatus });
    expect(e.playerLocation).toBe(state.status === 'DEAD' ? 'DOORSTEP' : 'OUTSIDE'); expect(state.spirituality).toBe(last.playerSpiritualityAfter);
    expect(state.combat).toBeNull(); expect(last.continuing).toBe(false);
    if (state.status === 'DEAD') { expect(state.health).toBe(0); expect(e.terminal!.outcome).toBe('PLAYER_DEAD'); expect(last.elapsedSeconds).toBe(60); }
    else { expect(state.health).toBeGreaterThan(0); expect(last.elapsedSeconds).toBe(62); expect(e.playerTravelMetres).toBe(4); }
  });
  it('projects only saved current evidence and the actual sorted sequence, never a new draw or an active end-of-round window', () => {
    const boundary = wisdomAngelBoundaryForIntent(i => i.type === 'COMBAT_ROUND'), state = boundary.final, frozen = structuredClone(state);
    const p = projectWisdomAngelCombat(state), o = outcome(state.combatHistory.at(-1)!);
    expect(p.responseWindow).toBeNull(); expect(p.responseRemainingSeconds).toBe(0);
    expect(p.observations).toEqual(o.observations); expect(p.currentObservations).toEqual(o.observations.filter(v => v.conditionVersion === o.conditionVersion));
    const expectedSequence = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' }))]
      .sort((a, b) => a.order - b.order)
      .map(({ randomCursorBefore, randomCursorAfter, ...visible }) => {
        expect(Number.isInteger(randomCursorBefore)).toBe(true);
        expect(Number.isInteger(randomCursorAfter)).toBe(true);
        return visible;
      });
    expect(p.lastWindowSequence).toEqual(expectedSequence);
    for (const action of p.lastWindowSequence) {
      expect(action).not.toHaveProperty('randomCursorBefore');
      expect(action).not.toHaveProperty('randomCursorAfter');
    }
    expect(p.playerSpirituality).toBe(state.spirituality); expect(p.enemySpirituality).toBe(o.enemySpirituality); expect(p.abilityUses).toEqual(o.abilityUses);
    expect(p.crafts).toEqual(o.craftsAfter); expect(state).toEqual(frozen);
  });
  it.each([
    ['target', (o: WisdomAngelRoundOutcome) => { o.targetId = 'IS3-ALTON' as never; }],
    ['original-body', (o: WisdomAngelRoundOutcome) => { o.source.actualOriginalBody = false as never; }],
    ['old-person-substitution', (o: WisdomAngelRoundOutcome) => { o.source.targetId = 'PF4-HAROLD' as never; }],
    ['original-club', (o: WisdomAngelRoundOutcome) => { o.source.enemyWeapon = 'IS3-ALTON-CLUB' as never; }],
    ['original-door', (o: WisdomAngelRoundOutcome) => { o.source.doorStatus = 'BLOCKED' as never; }],
    ['source-seed', (o: WisdomAngelRoundOutcome) => { o.source.randomSeed += '-forged'; }],
    ['source-cursor', (o: WisdomAngelRoundOutcome) => { o.source.randomCursor++; }],
    ['target-core', (o: WisdomAngelRoundOutcome) => { o.source.targetCore = 25 as never; }],
    ['target-age', (o: WisdomAngelRoundOutcome) => { o.source.targetAge = 50 as never; }],
    ['source-version', (o: WisdomAngelRoundOutcome) => { o.source.conditionVersion++; }],
    ['source-sample-chronology', (o: WisdomAngelRoundOutcome) => { o.source.flashSample.learnedWeek = 0; }],
    ['source-craft-kit', (o: WisdomAngelRoundOutcome) => { o.source.crafts[0]!.sourceKitId = 'MM5-KIT-999999'; }],
    ['source-craft-power', (o: WisdomAngelRoundOutcome) => { o.source.crafts[0]!.power = 2; }],
    ['slot-cost', (o: WisdomAngelRoundOutcome) => { firstAction(o).paidCost++; }],
    ['cost-and-final-pool', (o: WisdomAngelRoundOutcome) => { firstAction(o).paidCost++; o.playerSpiritualityAfter--; o.enemySpirituality--; }],
    ['check-roll', (o: WisdomAngelRoundOutcome) => { const a = [...o.playerActions, ...o.enemyActions].find(a => a.rolls.length) ?? firstAction(o); a.rolls[0] = a.rolls[0] === 100 ? 1 : 100; }],
    ['extra-check', (o: WisdomAngelRoundOutcome) => { firstAction(o).rolls.push(1); firstAction(o).randomCursorAfter++; }],
    ['order', (o: WisdomAngelRoundOutcome) => { firstAction(o).order++; }],
    ['slot-time', (o: WisdomAngelRoundOutcome) => { firstAction(o).atSeconds++; }],
    ['slot-before-cursor', (o: WisdomAngelRoundOutcome) => { firstAction(o).randomCursorBefore++; }],
    ['slot-after-cursor', (o: WisdomAngelRoundOutcome) => { firstAction(o).randomCursorAfter++; }],
    ['slot-version', (o: WisdomAngelRoundOutcome) => { firstAction(o).conditionVersionAfter++; }],
    ['slot-threat', (o: WisdomAngelRoundOutcome) => { firstAction(o).threatens = !firstAction(o).threatens; }],
    ['slot-effect', (o: WisdomAngelRoundOutcome) => { firstAction(o).selfGain++; }],
    ['retroactive-response', (o: WisdomAngelRoundOutcome) => { const a = o.enemyActions[0]!; a.responseConsumed = true; a.responseApplied = true; a.responseReduction = 45; a.selfGain -= 45; }],
    ['unearned-synthesis', (o: WisdomAngelRoundOutcome) => { o.abilityUses.SYNTHESIS.attempts++; o.abilityUses.SYNTHESIS.successes++; o.abilityUses.SYNTHESIS.effects++; }],
    ['unused-response-award', (o: WisdomAngelRoundOutcome) => { o.abilityUses.RESPONSE.effects++; }],
    ['future-observation', (o: WisdomAngelRoundOutcome) => { o.observations.push({ power: 'FLASH', round: o.round + 1, order: 0, atSeconds: o.clockSecondsAfter, conditionVersion: o.conditionVersion, paidCost: 7 }); }],
    ['forgotten-observation', (o: WisdomAngelRoundOutcome) => { o.observations.length ? o.observations.pop() : o.observations.push({ power: 'WARD', round: o.round, order: 0, atSeconds: o.source.clockSeconds, conditionVersion: 1, paidCost: 6 }); }],
    ['condition-version', (o: WisdomAngelRoundOutcome) => { o.conditionVersion++; }],
    ['feint-repeat', (o: WisdomAngelRoundOutcome) => { o.powerUses.FEINT++; o.conditionVersion++; o.enemySpirituality -= 3; }],
    ['forgotten-feint', (o: WisdomAngelRoundOutcome) => { o.feintUsed = !o.feintUsed; }],
    ['enemy-refill', (o: WisdomAngelRoundOutcome) => { o.enemySpirituality++; }],
    ['enemy-power-count', (o: WisdomAngelRoundOutcome) => { o.powerUses.FLASH++; }],
    ['player-health', (o: WisdomAngelRoundOutcome) => { o.playerHealthAfter++; }],
    ['enemy-health', (o: WisdomAngelRoundOutcome) => { o.enemyHealth++; }],
    ['injury', (o: WisdomAngelRoundOutcome) => { o.playerInjuriesAfter.push({ id: 'invented-injury', severity: 'HEAVY', acquiredRevision: o.source.revision, treatedRevision: null }); }],
    ['risk', (o: WisdomAngelRoundOutcome) => { o.playerRiskAfter++; }],
    ['free-player-refill', (o: WisdomAngelRoundOutcome) => { o.playerSpiritualityAfter++; }],
    ['craft-resurrection', (o: WisdomAngelRoundOutcome) => { o.craftsAfter[0]!.status = 'PLAYER'; o.craftsAfter[0]!.usedWeek = null; }],
    ['free-item', (o: WisdomAngelRoundOutcome) => { o.craftsAfter.push({ ...o.craftsAfter[0]!, id: 'MM5-FLASH-999', sourceKitId: 'MM5-KIT-999', status: 'PLAYER', usedWeek: null }); }],
    ['invented-consumption', (o: WisdomAngelRoundOutcome) => { o.consumedCraftIds.push('MM5-FLASH-999'); }],
    ['teleport', (o: WisdomAngelRoundOutcome) => { o.playerTravelMetresAfter += 2; }],
    ['clock', (o: WisdomAngelRoundOutcome) => { o.clockSecondsAfter++; }],
    ['final-cursor', (o: WisdomAngelRoundOutcome) => { o.randomCursorAfter++; }],
    ['unregistered-field', (o: WisdomAngelRoundOutcome) => { Object.assign(o, { freeKnowledge: true }); }],
  ] as const)('rejects %s tampering by full original-RNG replay', (label, mutate) => {
    const r = tamperRound(), o = outcome(r); expect(validateWisdomAngelRoundOutcome(o)).toBe(true); mutate(o);
    expect(validateWisdomAngelRoundOutcome(o), label).toBe(false); expect(validateWisdomAngelCombatRound(r), label).toBe(false);
  });
  it('rejects altered true window evidence wherever the natural run actually opened a window', () => {
    // The natural run may legitimately contain zero successful windows. Their directed
    // semantics are covered separately; this loop never invents a natural success.
    for (const r of naturalRounds) for (const side of ['playerActions', 'enemyActions'] as const) {
      for (const [i, a] of outcome(r)[side].entries()) for (const field of ['responseWindowBefore', 'responseWindowAfter'] as const) {
        if (!a[field]) continue;
        for (const key of ['openedOrder', 'expiresAt', 'conditionVersion'] as const) {
          const forged = structuredClone(r); outcome(forged)[side][i]![field]![key]++;
          expect(validateWisdomAngelRoundOutcome(outcome(forged))).toBe(false); expect(validateWisdomAngelCombatRound(forged)).toBe(false);
        }
        const forged = structuredClone(r), window = outcome(forged)[side][i]![field]!;
        window.targetPower = window.targetPower === 'FLASH' ? 'WARD' : 'FLASH';
        expect(validateWisdomAngelCombatRound(forged)).toBe(false);
      }
    }
  });
  it.each(['winner', 'count', 'enemy-count', 'count-roll', 'enemy-roll', 'chance', 'advantage', 'first', 'threat-wheel', 'injury-roll', 'moves'] as const)(
    'rejects forged public %s while retaining a genuine nested source outcome', field => {
      const r = tamperRound();
      if (field === 'winner') r.winner = r.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER';
      if (field === 'count') r.playerCount++; if (field === 'enemy-count') r.enemyCount++;
      if (field === 'count-roll') r.playerCountRoll++; if (field === 'enemy-roll') r.enemyCountRoll++;
      if (field === 'chance') r.winChance++; if (field === 'advantage') r.enemyAdvantage++;
      if (field === 'first') r.first = r.first === 'PLAYER' ? 'ENEMY' : 'PLAYER';
      if (field === 'threat-wheel') r.consequenceWeights = { light: 100, heavy: 0, death: 0 };
      if (field === 'injury-roll') r.consequenceRoll = (r.consequenceRoll ?? 0) + 1;
      if (field === 'moves') r.moves[0]!.selfGain++;
      expect(validateWisdomAngelRoundOutcome(outcome(r))).toBe(true); expect(validateWisdomAngelCombatRound(r)).toBe(false);
    });
  it('rejects a duplicated past S2 round after the actual terminal and preserves unrelated old histories', () => {
    const state = structuredClone(naturalTerminal); state.combatHistory.push(structuredClone(naturalRounds[0]!));
    expect(validateWisdomAngelEncounter(state)).toBe(false); expect(() => assertValidSliceState(state)).toThrow();
    expect(naturalTerminal.combatHistory.slice(0, original.combatHistory.length)).toEqual(original.combatHistory);
  });
  it.each(['playerTravelMetres', 'clockSeconds', 'enemySpirituality', 'conditionVersion'] as const)('rejects terminal %s edits', field => {
    const state = structuredClone(naturalTerminal); state.wisdomAngel.encounter[field]++;
    expect(validateWisdomAngelEncounter(state)).toBe(false); expect(() => assertValidSliceState(state)).toThrow();
  });
  it('keeps the actual final snapshot valid even if ordinary living play continued after the terminal', () => {
    const final = wisdomAngelSnapshot('final'); assertValidSliceState(final); expect(validateWisdomAngelEncounter(final)).toBe(true);
    expect(final.wisdomAngel.encounter).toEqual(naturalTerminal.wisdomAngel.encounter);
    const end = final.wisdomAngel.encounter.terminal!.historyIndex;
    expect(final.combatHistory.slice(original.combatHistory.length, end + 1)).toEqual(naturalRounds);
  });
});

/** Independent public-choice branch, never a replacement for the original natural
 * capture. Only the stance differs: DEFEND for up to8 rounds, then ordinary RETREAT.
 * Seed, cursor, stats, source, inventory and every original saved input stay intact. */
describe('Wisdom Angel fixed defensive public-choice branch with authentic wheel draws', () => {
  it('validates every actual result and genuine response window through the terminal without selecting a desired outcome', () => {
    let state = structuredClone(original), rounds = 0;
    while (state.combat) {
      if (rounds >= 100) throw new Error('Fixed public stance branch did not reach its actual terminal within the test safety bound');
      const before = state, frozen = structuredClone(state), stance = rounds < 8 ? 'DEFEND' as const : 'RETREAT' as const;
      state = applySliceIntent(state, { type: 'COMBAT_ROUND', stance }); rounds++;
      expect(before).toEqual(frozen); const round = state.combatHistory.at(-1)!, o = outcome(round);
      expect(validateWisdomAngelRoundOutcome(o)).toBe(true); expect(validateWisdomAngelCombatRound(round)).toBe(true);
      expect(validateWisdomAngelEncounter(state)).toBe(true); assertValidSliceState(state); assertAccounting(before, state, round);
      for (const side of ['playerActions', 'enemyActions'] as const) for (const [i, action] of o[side].entries()) {
        for (const field of ['responseWindowBefore', 'responseWindowAfter'] as const) {
          if (!action[field]) continue;
          for (const key of ['openedRound', 'openedOrder', 'expiresAt', 'conditionVersion'] as const) {
            const forged = structuredClone(round); outcome(forged)[side][i]![field]![key]++;
            expect(validateWisdomAngelRoundOutcome(outcome(forged))).toBe(false); expect(validateWisdomAngelCombatRound(forged)).toBe(false);
          }
          const forged = structuredClone(round), window = outcome(forged)[side][i]![field]!;
          window.observation.paidCost = window.observation.paidCost === 7 ? 6 : 7;
          expect(validateWisdomAngelCombatRound(forged)).toBe(false);
        }
      }
      for (const [i, action] of o.enemyActions.entries()) if (action.responseApplied || action.changedCondition) {
        const forged = structuredClone(round), changed = outcome(forged).enemyActions[i]!;
        if (action.responseApplied) { changed.responseApplied = false; changed.responseReduction = 0; }
        else { changed.changedCondition = false; changed.conditionVersionAfter--; }
        expect(validateWisdomAngelCombatRound(forged)).toBe(false);
      }
    }
    expect(rounds).toBeGreaterThan(0); expect(state.wisdomAngel.encounter.terminal).not.toBeNull();
    expect(state.random.seed).toBe(original.random.seed); expect(state.progression.mastery).toEqual(original.progression.mastery);
    expect(original).toEqual(wisdomAngelSnapshot('combatStart'));
    expect(state.wisdomAngel.encounter.playerLocation).toBe(state.status === 'DEAD' ? 'DOORSTEP' : 'OUTSIDE');
  });
});
