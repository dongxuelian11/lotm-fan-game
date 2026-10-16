import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { WRITER_INHERITED_ABILITY_IDS, createWriterState, hasWriterLock, projectWriter, validateWriterAcquisitionJournal, validateWriterCommand, validateWriterState } from '../../src/domain/writer/index.js';
import { WRITER_ABILITY_IDS, WRITER_PREPARATION_IDS } from '../../src/domain/writer/types.js';
import { wr, directedInitial2, dose, originalAudienceRoots, originalDiscerner, prepared, promoted, recoverResources, rejectWriter, rejectIntent, step, taught, discernerNaturalPath } from './writer-directed-helper.js';

const journal = (s: SliceState) => s.writer.acquisitionJournal;
describe('Writer acquisition: actual580-command source and explicitly directed inputs', () => {
  it('retains original complete source, all23 masteries and8 original zeros', () => {
    const original = readObjectEntry<SliceState>(discernerNaturalPath, 'final'), s = originalDiscerner();
    expect(s).toMatchObject({ revision: 581, week: 126, status: 'ACTIVE', health: 98, mind: 98, spirituality: 120, cash: 560, actionsRemaining: 1 });
    expect(s.progression.mastery).toEqual(original.progression.mastery); expect(Object.keys(s.progression.mastery)).toEqual([...WRITER_INHERITED_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).filter(value => value === 0)).toHaveLength(8);
    expect(s.character).toEqual(original.character); expect(s.discerner.encounter).toEqual(original.discerner.encounter);
    expect(s.writer).toEqual(createWriterState()); expect(s.injuries).toEqual(original.injuries); assertValidSliceState(s);
  }, 60_000);
  it('replays all580 original commands without repairing old histories, then agrees with migrated source', () => {
    const expected = originalDiscerner();
    const commands = readObjectEntry<SliceIntent[]>(discernerNaturalPath, 'commands');
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(discernerNaturalPath, 'creation');
    const seed = readObjectEntry<string>(discernerNaturalPath, 'seed');
    let replay = createSliceRun(expected.runId, creation, seed);
    for (const command of commands) replay = applySliceIntent(replay, command);
    expect(originalAudienceRoots(replay)).toEqual(originalAudienceRoots(expected));
    expect(replay.progression).toEqual(expected.progression); expect(replay.character).toEqual(expected.character);
    expect(replay.combatHistory).toEqual(expected.combatHistory); expect(replay.random).toEqual(expected.random);
    expect(replay).toMatchObject({ revision: 581, week: 126, health: 98, mind: 98, spirituality: 120, cash: 560, actionsRemaining: 1, injuries: [], injuryRisk: 0 });
  }, 60_000);
  it('declares pre-journal unit budgets while preserving original roots, bodies and zero masteries', () => {
    const original = originalDiscerner(), s = directedInitial2();
    expect(s).toMatchObject({ week: 129, cash: 100000, actionsRemaining: 100, weeklyBudget: 100, health: 98, mind: 98, spirituality: 120 });
    expect(s.date).toEqual(addGameDays(original.date, 21)); expect(originalAudienceRoots(s)).toEqual(originalAudienceRoots(original));
    expect(s.character).toEqual(original.character); expect(s.progression).toEqual(original.progression); expect(journal(s)).toEqual([]);
  });
  it('hides the stage from unrelated and earlier characters and creates independent defaults', () => {
    const s = createSliceRun('writer-hidden', sliceDefaultCreationSelection, 'writer-hidden');
    expect(projectWriter(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null });
    rejectWriter(s, { type: 'LEARN_GUIDANCE' });
    const a = createWriterState(); a.bottles[0]!.labourSteps = 5; expect(s.writer.bottles[0]!.labourSteps).toBe(0);
  });
  it('rejects malformed command fields and false or foreign confirmations', () => {
    for (const command of [null, {}, { type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'WAR' },
      { ...dose, confirmed: false }, { ...dose, acceptFeminization: true }, { ...dose, bottleId: 'discerner-potion-1' }, { ...dose, bottleId: 'writer-potion-0' }]) expect(validateWriterCommand(command)).toBe(false);
    expect(validateWriterCommand(dose)).toBe(true);
  });
  it('requires exactly23 inherited skills and each original completed lineage before charging', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { delete s.progression.mastery['audience.s2.insight-window']; }, s => { s.progression.mastery['audience.s1.invented'] = 0; },
      s => { s.discerner.dreamWeaverActingAtPromotion = 99; }, s => { s.dreamWeaver.promotionWeek = null; },
      s => { s.audience.bottles.find(b => b.outcome === 'SUCCESS')!.brewedWeek = s.week + 1; }];
    for (const mutate of mutations) { const s = directedInitial2(); mutate(s); rejectWriter(s, { type: 'LEARN_GUIDANCE' }); }
  });
  it('seals the actual Discerner root on first paid guidance without healing or altering inherited identities', () => {
    const before = directedInitial2(), s = wr(before, { type: 'LEARN_GUIDANCE' }), e = journal(s)[0]!;
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); expect([e.before.cash - e.after.cash, e.before.actions - e.after.actions]).toEqual([500, 1]);
    expect(e.actor.sourceHistoryDigest).toMatch(/^[0-9a-f]{64}$/); expect(e.actor.sourceIdentityDigest).toMatch(/^[0-9a-f]{64}$/); expect([e.check, e.randomBefore, e.randomAfter]).toEqual([null, null, null]);
    expect(s.writer.sourceDiscerner).toEqual(before.discerner); expect(s.writer.sourceDiscerner).not.toBe(s.discerner);
    expect(originalAudienceRoots(s)).toEqual(originalAudienceRoots(before)); expect(s.progression).toEqual(before.progression);
    rejectWriter(s, { type: 'LEARN_GUIDANCE' }); expect(validateWriterAcquisitionJournal(s)).toBe(true);
  });
  it('requires12 full weeks from real promotion117 and the original reports', () => {
    let s = taught('SUCCESS', false); expect(projectWriter(s).digestion).toContain('9/12');
    for (const taskId of WRITER_PREPARATION_IDS) s = wr(s, { type: 'PREPARE_TASK', taskId });
    s = wr(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); rejectWriter(s, { type: 'PREPARE_PROMOTION' }); rejectWriter(s, dose);
    expect(wr(prepared(), dose).writer.promotionWeek).toBe(129);
    for (const source of ['discerner-case:present-mark', 'discerner-case:covered-mark', 'discerner-case:withdrawn-mark', 'discerner-reflection']) {
      const t = directedInitial2(); t.seer.completedSources = t.seer.completedSources.filter(id => id !== source); rejectWriter(t, { type: 'LEARN_GUIDANCE' });
    }
  });
});

describe('Writer finite bottles, paid labour, actual preparations and four outcomes', () => {
  it('five real jobs discount only that bottle and still charge900', () => {
    let s = taught(); const before = structuredClone(s);
    for (let n = 0; n < 5; n++) s = wr(s, { type: 'POTION_WORK', bottleId: 'writer-potion-2' });
    expect([s.actionsRemaining, s.cash]).toEqual([before.actionsRemaining - 5, before.cash]);
    rejectWriter(s, { type: 'POTION_WORK', bottleId: 'writer-potion-2' });
    s = wr(s, { type: 'BUY_POTION', bottleId: 'writer-potion-2' }); expect(s.cash).toBe(before.cash - 900);
    s = wr(s, { type: 'BUY_POTION', bottleId: 'writer-potion-1' }); expect(s.cash).toBe(before.cash - 900 - 6400);
    rejectWriter(s, { type: 'BUY_POTION', bottleId: 'writer-potion-2' }); expect(validateWriterAcquisitionJournal(s)).toBe(true);
  });
  it('four jobs have no partial or transferable credit', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = wr(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const cash = s.cash; s = wr(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(s.cash).toBe(cash - 6400);
    expect(prepared('SUCCESS', true)).toMatchObject({ cash: 98460, actionsRemaining: 90 });
  });
  it('requires all three distinct preparations and cancellation refunds no action or140', () => {
    let s = taught(); for (const taskId of WRITER_PREPARATION_IDS) { rejectWriter(s, { type: 'PREPARE_PROMOTION' }); s = wr(s, { type: 'PREPARE_TASK', taskId }); rejectWriter(s, { type: 'PREPARE_TASK', taskId }); }
    rejectWriter(s, { type: 'PREPARE_PROMOTION' });
    const ready = prepared(); expect(hasWriterLock(ready)).toBe(true); rejectIntent(ready, { type: 'ACTION', action: 'REST' });
    const left = wr(ready, { type: 'LEAVE_PREPARATION' }); expect(hasWriterLock(left)).toBe(false);
    expect([left.cash, left.actionsRemaining, left.health, left.mind, left.spirituality]).toEqual([ready.cash, ready.actionsRemaining, ready.health, ready.mind, ready.spirituality]);
    expect(left.writer.bottles[0]!.status).toBe('PLAYER'); rejectWriter(left, dose); expect(wr(left, { type: 'PREPARE_PROMOTION' }).cash).toBe(left.cash - 140);
  });
  it.each([['GREAT_SUCCESS', 1, 98, 90, 0], ['SUCCESS', 1, 98, 83, 0], ['FAILURE', 2, 83, 73, 30], ['GREAT_FAILURE', 2, 73, 53, 60]] as const)('commits actual %s once with correct resources and immutable inheritance', (kind, sequence, health, mind, pollution) => {
    const before = prepared(kind), s = wr(before, dose), e = journal(s).at(-1)!;
    expect(s).toMatchObject({ health, mind, spirituality: 120, progression: { sequence }, seer: { pollution } });
    expect(s.writer.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: kind, consumedWeek: 129, preparationWeek: 129 });
    expect(s.writer.preparedWeek).toBeNull(); expect(originalAudienceRoots(s)).toEqual(originalAudienceRoots(before));
    expect(s.character.gender).toBe(before.character.gender); expect(s.character.age).toBe(before.character.age); expect(s.injuries).toEqual(before.injuries);
    for (const id of WRITER_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id], id).toBe(before.progression.mastery[id]);
    expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.check!.tier).toBe(kind); expect(validateWriterAcquisitionJournal(s)).toBe(true); expect(validateWriterState(s)).toBe(true);
    if (sequence === 1) {
      expect(s.progression.acting).toBe(0); expect(s.writer.discernerActingAtPromotion).toBe(100); expect(Object.keys(s.progression.mastery)).toHaveLength(25);
      for (const id of WRITER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
      expect(s.seer.completedSources.slice(-1)).toEqual(['audience-s1']);
      expect(e.actor.sourceIdentityDigest).toMatch(/^[0-9a-f]{64}$/); expect(projectWriter(s).abilities).toHaveLength(25);
      rejectWriter(s, { type: 'PREPARE_PROMOTION' });
    } else { expect(s.progression.acting).toBe(100); expect(s.seer.completedSources).toEqual(before.seer.completedSources); }
    rejectWriter(s, dose);
  });
  it('delivers paid new originals only after all three failures and one real later week', () => {
    let s = taught('THREE_FAILURES');
    for (const taskId of WRITER_PREPARATION_IDS) s = wr(s, { type: 'PREPARE_TASK', taskId });
    const inherited = structuredClone(originalAudienceRoots(s));
    for (const bottleId of ['writer-potion-1', 'writer-potion-2', 'writer-potion-3']) {
      s = recoverResources(s); s = wr(s, { type: 'BUY_POTION', bottleId }); s = wr(s, { type: 'PREPARE_PROMOTION' });
      s = wr(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(s.writer.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(s.cash).toBe(100000 - 500 - 3 * (6400 + 140));
    const originals = structuredClone(s.writer.bottles), ap = s.actionsRemaining;
    s = wr(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectWriter(s, { type: 'RECEIVE_SUPPLY' });
    const requestWeek = s.week, requestDate = structuredClone(s.date), remaining = s.actionsRemaining;
    for (let n = 0; n < remaining; n++) s = step(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(requestWeek + 1); expect(s.date).toEqual(addGameDays(requestDate, 7));
    const before = structuredClone(s), received = wr(s, { type: 'RECEIVE_SUPPLY' });
    expect(received.writer.bottles.slice(0, 3)).toEqual(originals);
    expect(received.writer.bottles.slice(3).map(b => b.id)).toEqual(['writer-potion-4', 'writer-potion-5', 'writer-potion-6']);
    expect(received.writer.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.stockedWeek === requestWeek + 1 && b.acquiredWeek === null && b.labourSteps === 0)).toBe(true);
    expect([received.cash, received.actionsRemaining]).toEqual([before.cash, before.actionsRemaining]);
    const bought = wr(received, { type: 'BUY_POTION', bottleId: 'writer-potion-4' }); expect(bought.cash).toBe(received.cash - 6400);
    expect(originalAudienceRoots(bought)).toEqual(inherited); expect(validateWriterAcquisitionJournal(bought)).toBe(true);
    rejectWriter(received, { type: 'RECEIVE_SUPPLY' });
  }, 60_000);
  it('rejects free supply, same-week receipt, inventing labour, restored bottles, altered rolls and source history', () => {
    const base = promoted();
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.writer.bottles[0]!.status = 'PLAYER'; }, s => { s.writer.bottles[0]!.labourSteps = 5; },
      s => { journal(s).at(-1)!.check!.roll = 100; }, s => { journal(s).at(-1)!.randomAfter! += 1; },
      s => { journal(s)[0]!.after.cash += 1; }, s => { s.writer.sourceDiscerner!.encounter.enemyHealth++; },
      s => { s.dreamWeaver.bottles[0]!.source += '改'; }, s => { s.character.traits[0]!.label = '替代特质'; },
      s => { s.character.name = '替代姓名'; },
    ];
    for (const change of mutations) { const s = structuredClone(base); change(s); expect(validateWriterState(s)).toBe(false); }
    const before = taught(); rejectWriter(before, { type: 'REQUEST_SUPPLY' }); rejectWriter(before, { type: 'RECEIVE_SUPPLY' });
  });
  it('does not leak internal source labels or claim a body change in the player projection', () => {
    const view = projectWriter(promoted()), text = JSON.stringify({ story: view.story, risk: view.risk, supplies: view.supplies, abilities: view.abilities, preparations: view.preparations, history: view.inheritedHistory });
    expect(text).not.toMatch(/原创G|本作G|候选|未核|acceptFeminization|大陆战争|主辅配方/);
    expect(view.characterName).toBe('莉娜'); expect(view.appearanceRecord).toContain('本次晋升不改变角色性别'); expect(view.formula).toEqual([]);
  });
});
