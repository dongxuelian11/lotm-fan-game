import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyMarauderCommand } from '../../src/domain/marauder/index.js';
import { MARAUDER_ABILITY_IDS } from '../../src/domain/marauder/types.js';
import { applySwindlerCommand } from '../../src/domain/swindler/index.js';
import { SWINDLER_ABILITY_IDS } from '../../src/domain/swindler/types.js';
import { applyCryptologistCommand } from '../../src/domain/cryptologist/index.js';
import { CRYPTOLOGIST_ABILITY_IDS } from '../../src/domain/cryptologist/types.js';
import { applyFireThiefCommand, createFireThiefState, projectFireThief, validateFireThiefCommand, validateFireThiefState } from '../../src/domain/fire-thief/index.js';
import { applyFireThiefActivity, fireThiefActions, fireThiefCases, fireThiefInside, validateFireThiefLife } from '../../src/domain/fire-thief/life.js';
import { settleFireThiefEncounter, validateFireThiefEncounter } from '../../src/domain/fire-thief/encounter.js';
import { FIRE_THIEF_FORMULA_STATUS, FIRE_THIEF_PRICES, FIRE_THIEF_SOURCE_STATUS } from '../../src/domain/fire-thief/content.js';
import { FIRE_THIEF_ABILITY_IDS, FIRE_THIEF_CASE_IDS, type FireThiefAcquisitionCommand, type FireThiefActivityCommand, type FireThiefCaseId } from '../../src/domain/fire-thief/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('fireThief-domain', sliceDefaultCreationSelection, 'fireThief-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.fireThief = createFireThiefState(); return s;
}
function context(s: SliceState, checkRoll = 1, sampleRoll = 1) {
  const c: SeerContext = {
    roll: vi.fn(() => sampleRoll), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: checkRoll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[FIRE_THIEF_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function cryptologist(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyMarauderCommand(s, { type: 'DISCOVER' }, c);
  applyMarauderCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyMarauderCommand(s, { type: 'BUY_POTION', bottleId: s.marauder.bottles[0]!.id }, c);
  applyMarauderCommand(s, { type: 'CONSUME', bottleId: s.marauder.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applySwindlerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySwindlerCommand(s, { type: 'BUY_POTION', bottleId: s.swindler.bottles[0]!.id }, c);
  applySwindlerCommand(s, { type: 'CONSUME', bottleId: s.swindler.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyCryptologistCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCryptologistCommand(s, { type: 'BUY_POTION', bottleId: s.cryptologist.bottles[0]!.id }, c);
  applyCryptologistCommand(s, { type: 'CONSUME', bottleId: s.cryptologist.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...MARAUDER_ABILITY_IDS, ...SWINDLER_ABILITY_IDS, ...CRYPTOLOGIST_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: FireThiefAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyFireThiefCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: FireThiefActivityCommand, roll = 1, sample = 1) { const ctx = context(s, roll, sample); applyFireThiefActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = cryptologist()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.fireThief.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.fireThief.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyFireThiefCommand(s, command as FireThiefAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyFireThiefActivity(s, command as FireThiefActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.c.roll).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: FireThiefCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: FireThiefCaseId) {
  begin(s, caseId); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId });
}
function effectiveRound(s: SliceState) {
  s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'PLAYER', label: '本人对原敌的实际有限攻势', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
}

describe('Fire Thief S6 independent finished supply and inheritance', () => {
  it('starts hidden, with finite separate originals and no free loan or demonstration', () => {
    const s = ordinary(); expect(validateFireThiefState(s)).toBe(true);
    expect(projectFireThief(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], samples: [] });
    expect(fireThiefCases(s)).toEqual([]); expect(projectFireThief(s).story).toBeUndefined();
    const other = createFireThiefState(); other.bottles[0]!.labourSteps = 5; other.instructorSpirituality.SERE = 0;
    expect(s.fireThief.bottles[0]!.labourSteps).toBe(0); expect(s.fireThief.instructorSpirituality.SERE).toBe(20);
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360 guidance and five per-bottle work actions before a 320-penny handover', () => {
    const s = cryptologist(), old = structuredClone([s.marauder, s.swindler, s.cryptologist]);
    acquisition(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]);
    const b = s.fireThief.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect(b.status).toBe('SUPPLIER'); expect(s.cash).toBe(19640);
    buy(s); expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect([s.marauder, s.swindler, s.cryptologist]).toEqual(old); expect(validateFireThiefState(s)).toBe(true);
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially credit unfinished work and gates only consumption by maturity and digestion', () => {
    const s = cryptologist(); s.week = 20; s.progression.acting = 75; acquisition(s, { type: 'LEARN_GUIDANCE' });
    const b = s.fireThief.bottles[0]!; acquisition(s, { type: 'POTION_WORK', bottleId: b.id }); const cash = s.cash; buy(s);
    expect(cash - s.cash).toBe(FIRE_THIEF_PRICES.potion);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; s.week = 30; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it.each([[1, 6, 95, 100, 0], [20, 6, 90, 100, 0], [80, 7, 80, 90, 25], [100, 7, 60, 80, 50]])('keeps the four consumptive recoverable outcomes for roll %i', (roll, sequence, mind, health, pollution) => {
    const s = prepared(), inherited = { ...s.progression.mastery }, stats = { ...s.character.coreStats };
    const ctx = acquisition(s, { type: 'CONSUME', bottleId: s.fireThief.bottles[0]!.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledWith('will', 24); expect(s.progression.sequence).toBe(sequence);
    expect([s.mind, s.health, s.seer.pollution, s.spirituality]).toEqual([mind, health, pollution, 31]);
    expect(s.status).toBe('ACTIVE'); expect(s.fireThief.bottles[0]!.status).toBe('CONSUMED');
    for (const [id, mastery] of Object.entries(inherited)) expect(s.progression.mastery[id]).toBe(mastery);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (sequence === 6 ? 1 : 0));
    expect(s.progression.acting).toBe(sequence === 6 ? 0 : 100); expect(validateFireThiefState(s)).toBe(true);
  });
  it('requests a paid next-week batch only after three actual failures and preserves old records', () => {
    const s = taught();
    for (let index = 0; index < 3; index++) { const b = buy(s, index); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 80); }
    const old = structuredClone(s.fireThief.bottles), ap = s.actionsRemaining; acquisition(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.fireThief.bottles.slice(0, 3)).toEqual(old); expect(s.fireThief.bottles.slice(3).map(b => [b.id, b.status])).toEqual([['fire-thief-potion-4', 'SUPPLIER'], ['fire-thief-potion-5', 'SUPPLIER'], ['fire-thief-potion-6', 'SUPPLIER']]);
    expect(validateFireThiefState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects malformed commands, foreign bottle IDs and invented choice overrides atomically', () => {
    const s = promoted();
    for (const command of [{ type: 'USE', caseId: 'borrowed-flash', sample: 'FLASH' }, { type: 'WAIT', caseId: 'other' }, { type: 'PREPARE', caseId: 'borrowed-flash', method: 'DREAM' }, { type: 'CONSUME', bottleId: 'fire-thief-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'recorder-potion-1' }]) expect(validateFireThiefCommand(command)).toBe(false);
    rejectActivity(s, { type: 'USE', caseId: 'borrowed-flash', sample: 'FLASH' });
    rejectAcquisition(s, { type: 'CONSUME', bottleId: 'fire-thief-potion-2', confirmed: true });
    expect(FIRE_THIEF_FORMULA_STATUS).toContain('尚未核实'); expect(FIRE_THIEF_SOURCE_STATUS).toContain('物品');
  });
});

describe('Fire Thief finite actual sources and independent G scene windows', () => {
  it('observes real initial paid demonstrations once without creating a loan or refilling an instructor', () => {
    const s = promoted(); expect(projectFireThief(s).samples).toEqual([]);
    activity(s, { type: 'OBSERVE', caseId: 'borrowed-flash' }); expect(s.fireThief.instructorSpirituality).toEqual({ SERE: 16, NORTIN: 20 });
    expect(projectFireThief(s).samples.map(x => x.id)).toEqual(['FLASH', 'FROST']); expect(s.fireThief.loan.sample).toBeNull();
    rejectActivity(s, { type: 'OBSERVE', caseId: 'borrowed-flash' }); s.week += 1; expect(s.fireThief.instructorSpirituality.SERE).toBe(16);
    activity(s, { type: 'OBSERVE', caseId: 'separate-windows' }); expect(s.fireThief.instructorSpirituality.NORTIN).toBe(18); expect(validateFireThiefState(s)).toBe(true);
  });
  it.each([[70, 'FLASH'], [71, 'FROST']])('uses exactly one extra real draw after success at sample threshold %i', (roll, sample) => {
    const s = promoted(); begin(s, 'borrowed-flash', 'ABILITY'); const before = s.spirituality;
    const ctx = activity(s, { type: 'PERFORM', caseId: 'borrowed-flash' }, 1, roll as number);
    expect(ctx.c.roll).toHaveBeenCalledTimes(1); expect(ctx.c.roll).toHaveBeenCalledWith(1, 100); expect(ctx.c.check).toHaveBeenCalledWith('knowledge', 14);
    expect(s.spirituality).toBe(before - 3); expect(s.fireThief.loan).toMatchObject({ sample, playerSteps: 2, targetSteps: 3, uses: 0 });
    expect(s.fireThief.cases['borrowed-flash']!.outcome).toBe('NONE'); expect(validateFireThiefState(s)).toBe(true);
  });
  it('keeps a failed theft paid, opens required closure, draws no sample and retries next real week', () => {
    const s = promoted(); begin(s, 'borrowed-flash', 'ABILITY'); const before = s.spirituality;
    const ctx = activity(s, { type: 'PERFORM', caseId: 'borrowed-flash' }, 100);
    expect(ctx.c.roll).not.toHaveBeenCalled(); expect(s.spirituality).toBe(before - 3); expect(fireThiefInside(s)).toBe(true); expect(s.fireThief.loan.sample).toBeNull();
    rejectActivity(s, { type: 'USE', caseId: 'borrowed-flash' }); activity(s, { type: 'CLOSE', caseId: 'borrowed-flash' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'borrowed-flash', method: 'ABILITY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'borrowed-flash', method: 'ABILITY' }); expect(validateFireThiefState(s)).toBe(true);
  });
  it('really uses the wrong acquired frost sample twice without turning it into flash or permanent mastery', () => {
    const s = promoted(); begin(s, 'borrowed-flash', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'borrowed-flash' }, 1, 100);
    const mastery = { ...s.progression.mastery }, ap = s.actionsRemaining, sp = s.spirituality;
    const first = activity(s, { type: 'USE', caseId: 'borrowed-flash' }); expect(JSON.stringify(vi.mocked(first.c.note).mock.calls)).toContain('原杯');
    expect(s.fireThief.loan).toMatchObject({ sample: 'FROST', playerSteps: 1, targetSteps: 2, uses: 1 });
    activity(s, { type: 'USE', caseId: 'borrowed-flash' }); expect(s.fireThief.loan).toMatchObject({ playerSteps: 0, targetSteps: 1, uses: 2 });
    expect(s.fireThief.cases['borrowed-flash']).toMatchObject({ outcome: 'FROST_USED', sourceRestored: false, playerExpiredObserved: true });
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap, sp - 4]); expect(s.progression.mastery).toEqual(mastery); expect(validateFireThiefState(s)).toBe(true);
    rejectActivity(s, { type: 'USE', caseId: 'borrowed-flash' });
  });
  it('advances both independent clocks by real waiting and only restores the source at the third period', () => {
    const s = promoted(); begin(s, 'separate-windows', 'ABILITY'); const perform = activity(s, { type: 'PERFORM', caseId: 'separate-windows' }); expect(perform.c.roll).not.toHaveBeenCalled();
    activity(s, { type: 'USE', caseId: 'separate-windows' }); activity(s, { type: 'WAIT', caseId: 'separate-windows' });
    expect(s.fireThief.loan).toMatchObject({ playerSteps: 0, targetSteps: 1, uses: 1 });
    rejectActivity(s, { type: 'USE', caseId: 'separate-windows' }); activity(s, { type: 'WAIT', caseId: 'separate-windows' });
    expect(s.fireThief.cases['separate-windows']!.sourceRestored).toBe(true); rejectActivity(s, { type: 'WAIT', caseId: 'separate-windows' });
    expect(validateFireThiefState(s)).toBe(true);
  });
  it('close actually waits outstanding periods even at zero AP and never refunds or instantly restores', () => {
    const s = promoted(); begin(s, 'borrowed-flash', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'borrowed-flash' }); activity(s, { type: 'USE', caseId: 'borrowed-flash' });
    s.actionsRemaining = 0; const resources = [s.spirituality, s.cash, s.health, s.mind];
    const ctx = activity(s, { type: 'CLOSE', caseId: 'borrowed-flash' });
    expect(JSON.stringify(vi.mocked(ctx.c.note).mock.calls)).toContain('剩余2个'); expect([s.spirituality, s.cash, s.health, s.mind]).toEqual(resources);
    expect(s.fireThief.loan).toEqual({ caseId: null, sample: null, playerSteps: 0, targetSteps: 0, uses: 0, elapsedSteps: 0 });
    expect(s.fireThief.cases['borrowed-flash']).toMatchObject({ status: 'EXAMINED', sourceRestored: true, playerExpiredObserved: true, contactOpen: false }); expect(validateFireThiefState(s)).toBe(true);
  });
  it('refuses to report an unused successful loan after full expiry and requires a next-week attempt', () => {
    const s = promoted(); begin(s, 'borrowed-flash', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'borrowed-flash' });
    activity(s, { type: 'CLOSE', caseId: 'borrowed-flash' }); expect(s.fireThief.cases['borrowed-flash']).toMatchObject({ status: 'OBSERVED', usedCount: 0, sourceRestored: true });
    rejectActivity(s, { type: 'REPORT', caseId: 'borrowed-flash' }); rejectActivity(s, { type: 'PREPARE', caseId: 'borrowed-flash', method: 'ABILITY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'borrowed-flash', method: 'ORDINARY' }); expect(validateFireThiefState(s)).toBe(true);
  });
  it('cannot perform unknown power theft or submit invented desired sample values', () => {
    const s = promoted(); activity(s, { type: 'OBSERVE', caseId: 'unknown-power' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'unknown-power', method: 'ABILITY' });
    expect(fireThiefActions(s).some(a => a.id === 'unknown-power-ability')).toBe(false);
    begin(s, 'borrowed-flash', 'ABILITY'); rejectActivity(s, { type: 'PERFORM', caseId: 'borrowed-flash', preferred: 'COURAGE' });
  });
  it('does not spend or advance time on rejected low-spirituality use and still permits safe waiting', () => {
    const s = promoted(); begin(s, 'borrowed-flash', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'borrowed-flash' }); s.spirituality = 1;
    rejectActivity(s, { type: 'USE', caseId: 'borrowed-flash' }); expect(s.fireThief.loan.playerSteps).toBe(2);
    activity(s, { type: 'WAIT', caseId: 'borrowed-flash' }); expect(s.fireThief.loan.playerSteps).toBe(1); expect(s.spirituality).toBe(1);
  });
  it('keeps open practice exclusive and preparation withdrawal non-refundable', () => {
    const s = promoted(); begin(s, 'borrowed-flash', 'ABILITY'); const ap = s.actionsRemaining;
    rejectActivity(s, { type: 'OBSERVE', caseId: 'separate-windows' }); activity(s, { type: 'WITHDRAW', caseId: 'borrowed-flash' }); expect(s.actionsRemaining).toBe(ap);
    activity(s, { type: 'PREPARE', caseId: 'borrowed-flash', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'borrowed-flash' });
    rejectActivity(s, { type: 'OBSERVE', caseId: 'separate-windows' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
  });
  it('allows all three actual ordinary cases and reflection to reach peaceful 100 without player spirituality', () => {
    const s = promoted(); s.spirituality = 0;
    for (const id of FIRE_THIEF_CASE_IDS) { complete(s, id); expect(validateFireThiefState(s)).toBe(true); }
    activity(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.spirituality).toBe(0); expect(s.fireThief.loan.sample).toBeNull();
    expect(s.seer.completedSources.filter(x => x.startsWith('fire-thief-case:'))).toHaveLength(3); expect(validateFireThiefLife(s)).toBe(true);
    rejectActivity(s, { type: 'REFLECT' });
  });
  it('rejects invented source pools, free refills, contradictory clocks and forged reports', () => {
    const s = promoted(); begin(s, 'borrowed-flash', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'borrowed-flash' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.fireThief.demonstrations[0]!.samples.push('COURAGE'); },
      x => { x.fireThief.instructorSpirituality.SERE = 20; },
      x => { x.fireThief.loan.targetSteps = 0; },
      x => { x.fireThief.loan.sample = 'COURAGE'; },
      x => { x.fireThief.cases['borrowed-flash']!.sourceRestored = true; },
      x => { x.fireThief.cases['borrowed-flash']!.usedCount = 1; },
      x => { x.fireThief.cases['borrowed-flash']!.status = 'RESOLVED'; },
      x => { x.fireThief.bottles[0]!.source += ' forged'; },
    ];
    for (const mutate of mutations) { const bad = structuredClone(s); mutate(bad); expect(validateFireThiefState(bad)).toBe(false); }
  });
});

describe('Fire Thief original outer-court arrival and settlement', () => {
  it('requires an actual report and paid arrival, and peaceful refusal is not mind control', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'unknown-power'); const ap = s.actionsRemaining;
    activity(s, { type: 'ENCOUNTER_TALK' }, 100); expect(s.actionsRemaining).toBe(ap - 1); expect(s.fireThief.encounter.status).toBe('AVAILABLE');
    rejectActivity(s, { type: 'ENCOUNTER_TALK' }); s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' });
    expect(s.fireThief.encounter.status).toBe('RESOLVED'); expect(s.progression.acting).toBe(25); expect(validateFireThiefState(s)).toBe(true);
  });
  it.each(['RETREATED', 'ENEMY_SURRENDERED', 'ENEMY_DEAD', 'PLAYER_DEAD'])('actually waits outstanding source periods on %s without free healing or resurrection', outcome => {
    const s = promoted(); complete(s, 'unknown-power'); const originals = structuredClone(s.marauder.originals); activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.fireThief.encounter).toMatchObject({ enemySpirituality: 20, enemyCourageSeen: false }); effectiveRound(s);
    s.fireThief.encounter.enemySpirituality = 20; s.fireThief.encounter.enemyCourageSeen = true;
    s.fireThief.encounter.battleLoan = { playerRounds: 0, targetRounds: 2, startedRound: 1, uses: 1 };
    if (outcome === 'PLAYER_DEAD') { s.status = 'DEAD'; s.health = 0; }
    const sp = s.spirituality, health = s.health, ctx = context(s);
    settleFireThiefEncounter(s, outcome, ctx.c, ctx.award);
    expect(s.combat).toBeNull(); expect(s.fireThief.encounter.battleLoan).toMatchObject({ playerRounds: 0, targetRounds: 0, uses: 1 });
    expect(JSON.stringify(vi.mocked(ctx.c.note).mock.calls)).toContain('剩余2个'); expect([s.spirituality, s.health]).toEqual([sp, health]); expect(s.marauder.originals).toEqual(originals);
    expect(ctx.award).toHaveBeenCalledTimes(outcome === 'ENEMY_SURRENDERED' || outcome === 'ENEMY_DEAD' ? 1 : 0);
    expect(validateFireThiefState(s)).toBe(true);
  });
  it('validates consumed battle windows without reviving the once-used sector', () => {
    const s = promoted(); complete(s, 'unknown-power'); activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combat!.round = 3; s.fireThief.encounter.enemyCourageSeen = true; s.fireThief.encounter.enemySpirituality = 20;
    s.fireThief.encounter.battleLoan = { playerRounds: 0, targetRounds: 2, startedRound: 1, uses: 1 }; expect(validateFireThiefEncounter(s)).toBe(true);
    s.fireThief.encounter.battleLoan.playerRounds = 1; expect(validateFireThiefEncounter(s)).toBe(false);
  });
});
