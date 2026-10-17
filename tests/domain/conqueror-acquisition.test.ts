import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CONQUEROR_INHERITED_ABILITY_IDS, createConquerorState, hasConquerorLock, projectConqueror, validateConquerorAcquisitionJournal, validateConquerorCommand, validateConquerorState } from '../../src/domain/conqueror/index.js';
import { CONQUEROR_ABILITY_IDS, CONQUEROR_PREPARATION_IDS } from '../../src/domain/conqueror/types.js';
import { cq, directedInitial2, dose, originalHunterRoots, originalWeatherWarlock, prepared, promoted, recoverResources, rejectConqueror, rejectIntent, step, taught, weatherWarlockNaturalPath } from './conqueror-directed-helper.js';

const journal = (s: SliceState) => s.conqueror.acquisitionJournal;
describe('Conqueror acquisition: actual658-command source and explicitly directed inputs', () => {
  it('retains original complete source, all21 masteries and depleted real five-person team', () => {
    const original = readObjectEntry<SliceState>(weatherWarlockNaturalPath, 'final'), s = originalWeatherWarlock();
    expect(s).toMatchObject({ revision: 659, week: 164, status: 'ACTIVE', health: 100, mind: 100, spirituality: 101, cash: 576, actionsRemaining: 2 });
    expect(s.progression.mastery).toEqual(original.progression.mastery); expect(Object.keys(s.progression.mastery)).toEqual([...CONQUEROR_INHERITED_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).filter(value => value === 0)).toHaveLength(6);
    expect(s.ironBloodKnight.team.members).toEqual(original.ironBloodKnight.team.members); expect(s.ironBloodKnight.team.members).toHaveLength(30);
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual([5, 5, 5, 5, 6]);
    expect(s.conqueror).toEqual(createConquerorState()); expect(s.injuries).toEqual(original.injuries); assertValidSliceState(s);
  }, 60_000);
  it('declares pre-journal unit budgets while preserving original roots, bodies and zero masteries', () => {
    const original = originalWeatherWarlock(), s = directedInitial2();
    expect(s).toMatchObject({ week: 167, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 100, mind: 100, spirituality: 101 });
    expect(s.date).toEqual(addGameDays(original.date, 21)); expect(originalHunterRoots(s)).toEqual(originalHunterRoots(original));
    expect(s.character).toEqual(original.character); expect(s.progression).toEqual(original.progression); expect(journal(s)).toEqual([]);
  });
  it('hides the stage from unrelated and earlier characters and creates independent defaults', () => {
    const s = createSliceRun('conqueror-hidden', sliceDefaultCreationSelection, 'conqueror-hidden');
    expect(projectConqueror(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    rejectConqueror(s, { type: 'LEARN_GUIDANCE' });
    const a = createConquerorState(); a.bottles[0]!.labourSteps = 5; expect(s.conqueror.bottles[0]!.labourSteps).toBe(0);
  });
  it('rejects malformed command fields and false or foreign confirmations', () => {
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'WAR' },
      { ...dose, confirmed: false }, { ...dose, acceptFeminization: true }, { ...dose, bottleId: 'weather-warlock-potion-1' }, { ...dose, bottleId: 'conqueror-potion-0' }]) expect(validateConquerorCommand(command)).toBe(false);
    expect(validateConquerorCommand(dose)).toBe(true);
  });
  it('requires exactly21 inherited skills and each original completed lineage before charging', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { delete s.progression.mastery['hunter.s2.frost']; }, s => { s.progression.mastery['hunter.s1.invented'] = 0; },
      s => { s.weatherWarlock.warBishopActingAtPromotion = 99; }, s => { s.warBishop.promotionWeek = null; },
      s => { s.hunter.bottles.find(b => b.outcome === 'SUCCESS')!.acquiredWeek = s.week + 1; }];
    for (const mutate of mutations) { const s = directedInitial2(); mutate(s); rejectConqueror(s, { type: 'LEARN_GUIDANCE' }); }
  });
  it('seals the actual WeatherWarlock root on first paid guidance without copying or healing the team', () => {
    const before = directedInitial2(), s = cq(before, { type: 'LEARN_GUIDANCE' }), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([500, 1]);
    expect(e.actor.sourceHistoryDigest).toMatch(/^[0-9a-f]{64}$/); expect(e.actor.sourceTeamDigest).toBeNull(); expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]);
    expect(s.conqueror.sourceWeatherWarlock).toEqual(before.weatherWarlock); expect(s.conqueror.sourceWeatherWarlock).not.toBe(s.weatherWarlock);
    expect(originalHunterRoots(s)).toEqual(originalHunterRoots(before)); expect(s.progression).toEqual(before.progression);
    rejectConqueror(s, { type: 'LEARN_GUIDANCE' }); expect(validateConquerorAcquisitionJournal(s)).toBe(true);
  });
  it('requires12 full weeks from real promotion155 and the old weather reports', () => {
    let s = taught('SUCCESS', false); expect(projectConqueror(s).digestion).toContain('9/12');
    for (const taskId of CONQUEROR_PREPARATION_IDS) s = cq(s, { type: 'PREPARE_TASK', taskId });
    s = cq(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); rejectConqueror(s, { type: 'PREPARE_PROMOTION' }); rejectConqueror(s, dose);
    expect(cq(prepared(), dose).conqueror.promotionWeek).toBe(167);
    for (const source of ['weather-warlock-case:fog-corridor', 'weather-warlock-case:frost-tray', 'weather-warlock-case:wind-rain', 'weather-warlock-reflection']) {
      const t = directedInitial2(); t.seer.completedSources = t.seer.completedSources.filter(id => id !== source); rejectConqueror(t, { type: 'LEARN_GUIDANCE' });
    }
  });
});

describe('Conqueror finite bottles, paid labour, actual preparations and four outcomes', () => {
  it('five real jobs discount only that bottle and still charge900', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = cq(s, { type: 'POTION_WORK', bottleId: 'conqueror-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]);
    rejectConqueror(s, { type: 'POTION_WORK', bottleId: 'conqueror-potion-2' });
    s = cq(s, { type: 'BUY_POTION', bottleId: 'conqueror-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    s = cq(s, { type: 'BUY_POTION', bottleId: 'conqueror-potion-1' }); expect(s.cash).toBe(before.cash - 900 - 6400);
    rejectConqueror(s, { type: 'BUY_POTION', bottleId: 'conqueror-potion-2' }); expect(validateConquerorAcquisitionJournal(s)).toBe(true);
  });
  it('four jobs have no partial or transferable credit', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = cq(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const cash = s.cash; s = cq(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(s.cash).toBe(cash - 6400);
    expect(prepared('SUCCESS', true)).toMatchObject({ cash: 98460, actionsRemaining: 90 });
  });
  it('requires all three distinct preparations and cancellation refunds no action or140', () => {
    let s = taught(); for (const taskId of CONQUEROR_PREPARATION_IDS) { rejectConqueror(s, { type: 'PREPARE_PROMOTION' }); s = cq(s, { type: 'PREPARE_TASK', taskId }); rejectConqueror(s, { type: 'PREPARE_TASK', taskId }); }
    rejectConqueror(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(); expect(hasConquerorLock(ready)).toBe(true); rejectIntent(ready, { type: 'ACTION', action: 'REST' });
    const left = cq(ready, { type: 'LEAVE_PREPARATION' }); expect(hasConquerorLock(left)).toBe(false);
    expect([left.cash, left.actionsRemaining, left.health, left.mind, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.mind, ready.spirituality]);
    expect(left.conqueror.bottles[0]!.status).toBe('PLAYER'); rejectConqueror(left, dose); expect(cq(left, { type: 'PREPARE_PROMOTION' }).cash).toBe(left.cash - 140);
  });
  it.each([['GREAT_SUCCESS', 1, 100, 92, 0], ['SUCCESS', 1, 100, 85, 0], ['FAILURE', 2, 85, 75, 30], ['GREAT_FAILURE', 2, 75, 55, 60]] as const)('commits actual %s once with correct resources and immutable inheritance', (kind, sequence, health, mind, pollution) => {
    const before = prepared(kind), s = cq(before, dose), e = journal(s).at(-1)!;
    expect(s).toMatchObject({ health, mind, spirituality: 101, progression: { sequence }, seer: { pollution } });
    expect(s.conqueror.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 167, preparationWeek: 167 });
    expect(s.conqueror.preparedWeek).toBeNull(); expect(originalHunterRoots(s)).toEqual(originalHunterRoots(before));
    expect(s.character.gender).toBe(before.character.gender); expect(s.character.age).toBe(before.character.age); expect(s.injuries).toEqual(before.injuries);
    for (const id of CONQUEROR_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id], id).toBe(before.progression.mastery[id]);
    expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.check!.tier).toBe(kind); expect(validateConquerorAcquisitionJournal(s)).toBe(true); expect(validateConquerorState(s)).toBe(true);
    if (sequence === 1) {
      expect(s.progression.acting).toBe(0); expect(s.conqueror.weatherWarlockActingAtPromotion).toBe(100); expect(Object.keys(s.progression.mastery)).toHaveLength(23);
      for (const id of CONQUEROR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
      expect(s.seer.completedSources.slice(-1)).toEqual(['hunter-s1']); expect(s.conqueror.life.sourceTeam).toEqual(before.ironBloodKnight.team);
      expect(e.actor.sourceTeamDigest).toMatch(/^[0-9a-f]{64}$/); expect(projectConqueror(s).abilities).toHaveLength(23);
      rejectConqueror(s, { type: 'PREPARE_PROMOTION' });
    } else { expect(s.progression.acting).toBe(100); expect(s.conqueror.life.sourceTeam).toBeNull(); expect(s.seer.completedSources).toEqual(before.seer.completedSources); }
    rejectConqueror(s, dose);
  });
  it('delivers paid new originals only after all three failures and one real later week', () => {
    let s = taught('THREE_FAILURES');
    for (const taskId of CONQUEROR_PREPARATION_IDS) s = cq(s, { type: 'PREPARE_TASK', taskId });
    const inherited = structuredClone(originalHunterRoots(s));
    for (const bottleId of ['conqueror-potion-1', 'conqueror-potion-2', 'conqueror-potion-3']) {
      s = recoverResources(s); s = cq(s, { type: 'BUY_POTION', bottleId }); s = cq(s, { type: 'PREPARE_PROMOTION' });
      s = cq(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.conqueror.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(s.cash).toBe(100000 - 500 - 3 * (6400 + 140));
    const originals = structuredClone(s.conqueror.bottles), ap = s.actionsRemaining;
    s = cq(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectConqueror(s, { type: 'RECEIVE_SUPPLY' });
    const requestWeek = s.week, requestDate = structuredClone(s.date), remaining = s.actionsRemaining;
    for (let n = 0; n < remaining; n++) s = step(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(requestWeek + 1); expect(s.date).toEqual(addGameDays(requestDate, 7));
    const before = structuredClone(s), received = cq(s, { type: 'RECEIVE_SUPPLY' });
    expect(received.conqueror.bottles.slice(0, 3)).toEqual(originals);
    expect(received.conqueror.bottles.slice(3).map(b => b.id)).toEqual(['conqueror-potion-4', 'conqueror-potion-5', 'conqueror-potion-6']);
    expect(received.conqueror.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === requestWeek + 1 && b.acquiredWeek === null && b.labourSteps === 0)).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([before.cash, before.actionsRemaining]);
    const bought = cq(received, { type: 'BUY_POTION', bottleId: 'conqueror-potion-4' }); expect(bought.cash).toBe(received.cash - 6400);
    expect(originalHunterRoots(bought)).toEqual(inherited); expect(validateConquerorAcquisitionJournal(bought)).toBe(true);
    rejectConqueror(received, { type: 'RECEIVE_SUPPLY' });
  }, 60_000);
  it('rejects free supply, same-week receipt, inventing labour, restored bottles, altered rolls and source history', () => {
    const base = promoted();
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.conqueror.bottles[0]!.status = 'PLAYER'; }, s => { s.conqueror.bottles[0]!.labourSteps = 5; },
      s => { journal(s).at(-1)!.check!.roll = 100; }, s => { journal(s).at(-1)!.randomAfter! += 1; },
      s => { journal(s)[0]!.after.cash += 1; }, s => { s.conqueror.sourceWeatherWarlock!.encounter.enemyHealth++; },
      s => { s.warBishop.bottles[0]!.source += '改'; }, s => { s.conqueror.life.sourceTeam!.members[0]!.energy = 20; },
      s => { s.ironBloodKnight.team.members[0]!.name = '替代成员'; },
    ];
    for (const change of mutations) { const s = structuredClone(base); change(s); expect(validateConquerorState(s)).toBe(false); }
    const before = taught(); rejectConqueror(before, { type: 'REQUEST_SUPPLY' }); rejectConqueror(before, { type: 'RECEIVE_SUPPLY' });
  });
  it('does not leak internal source labels or claim a body change in the player projection', () => {
    const view = projectConqueror(promoted()), text = JSON.stringify({ story: view.story, risk: view.risk, supplies: view.supplies, abilities: view.abilities, preparations: view.preparations, history: view.inheritedHistory });
    expect(text).not.toMatch(/原创G|本作G|候选|未核|acceptFeminization|大陆战争|主辅配方/);
    expect(view.appearanceRecord).toContain('本次晋升不改变角色性别'); expect(view.formula).toEqual([]);
  });
});
