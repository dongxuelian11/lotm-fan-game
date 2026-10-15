import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { hasUnshadowedRitualLock, validateUnshadowedRitualState } from '../../src/domain/unshadowed/ritual.js';
import { applyJusticeMentorAcquisition, applyJusticeMentorCommand, createJusticeMentorState, hasJusticeMentorLock, isJusticeMentorAcquisitionCommand, projectJusticeMentor, validateJusticeMentorCommand, validateJusticeMentorState, justiceMentorAcquisitionBlock } from '../../src/domain/justice-mentor/index.js';
import { JUSTICE_MENTOR_CONSUMPTION_RISK, JUSTICE_MENTOR_FORMULA_STATUS, JUSTICE_MENTOR_PRICES, JUSTICE_MENTOR_SOURCE_STATUS } from '../../src/domain/justice-mentor/content.js';
import { JUSTICE_MENTOR_ABILITY_IDS, JUSTICE_MENTOR_PREPARATION_IDS, type JusticeMentorAcquisitionCommand } from '../../src/domain/justice-mentor/types.js';

/** Genuine 440-command unshadowed-v01250 end-state; later time/resources are explicit unit setup, never natural-play evidence. */
function unshadowed(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/unshadowed-v01250/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.justiceMentor = createJusticeMentorState();
  s.week = Math.max(s.week, s.unshadowed.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: JusticeMentorAcquisitionCommand, roll = 1) { const c = context(s, roll); applyJusticeMentorAcquisition(s, command, c); return c; }
function taught(s = unshadowed()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of JUSTICE_MENTOR_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.justiceMentor.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.justiceMentor.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyJusticeMentorAcquisition(s, command as JusticeMentorAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Justice Mentor S3 original bottles and explicitly G professional preparation', () => {
  it('reads the genuine440-command living W111 baseline without treating unit boosts as natural play', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/unshadowed-v01250/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(440); expect(fixture.seed).toBe('bard-natural-v029'); expect(fixture.seed).toBe(fixture.final.random.seed);
    expect(fixture.final).toMatchObject({ week: 111, status: 'ACTIVE', cash: 160, actionsRemaining: 1, health: 100, mind: 100, spirituality: 110, character: { age: 26, gender: 'FEMALE', coreStats: { physique: 28, perception: 24, will: 27, knowledge: 22 } }, unshadowed: { promotionWeek: 104 }, progression: { sequence: 4, acting: 100 } });
    const state = migrateSliceState(fixture.final); expect(validateJusticeMentorState(state)).toBe(true);
    expect([state.bard, state.lightprayer, state.sunpriest, state.notary, state.priestOfLight, state.unshadowed]).toEqual([fixture.final.bard, fixture.final.lightprayer, fixture.final.sunpriest, fixture.final.notary, fixture.final.priestOfLight, fixture.final.unshadowed]);
    expect(projectJusticeMentor(state).digestion).toContain('7/12');
  });
  it('creates independent originals and hides the source before sun S4', () => {
    const s = createSliceRun('justice-mentor-hidden', sliceDefaultCreationSelection, 'justice-mentor-hidden');
    expect(validateJusticeMentorState(s)).toBe(true);
    expect(projectJusticeMentor(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '', resources: null });
    expect(projectJusticeMentor(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createJusticeMentorState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'CHECK_TERMS', completedWeek: 1 });
    expect(s.justiceMentor.bottles[0]!.labourSteps).toBe(0); expect(s.justiceMentor.preparations).toEqual([]);
  });
  it('does not open this S3 channel for any other pathway or unsupported sun sequence', () => {
    const s = unshadowed();
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'door', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const other = structuredClone(s); other.progression.pathwayId = pathwayId;
      expect(projectJusticeMentor(other).discovered).toBe(false); expect(projectJusticeMentor(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 1, 0]) { const other = structuredClone(s); other.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectJusticeMentor(other).discovered).toBe(false); }
  });
  it('charges500 and one action while separating verifiedS3 from unknown full recipe and rite', () => {
    const s = unshadowed(), old = structuredClone([s.bard, s.lightprayer, s.sunpriest, s.notary, s.priestOfLight, s.unshadowed]);
    apply(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.bard, s.lightprayer, s.sunpriest, s.notary, s.priestOfLight, s.unshadowed]).toEqual(old);
    expect(JUSTICE_MENTOR_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(JUSTICE_MENTOR_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实'); expect(JUSTICE_MENTOR_FORMULA_STATUS).toContain('不复用无暗者的旧情感剥离回输仪式');
    expect(JUSTICE_MENTOR_SOURCE_STATUS).toContain('第五部第88章《收获》直接明确序列3正义导师'); expect(JUSTICE_MENTOR_SOURCE_STATUS).toContain('序列2逐光者、古称逐日者');
    expect(JUSTICE_MENTOR_SOURCE_STATUS).toContain('能力未核，本阶段不开放'); expect(JUSTICE_MENTOR_SOURCE_STATUS).toContain('均为原创G');
    expect(JUSTICE_MENTOR_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectJusticeMentor(s)).toMatchObject({ title: '正义导师·太阳序列3（合作与核实G）', formulaKnown: false, formula: [], preparations: JUSTICE_MENTOR_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    expect(JSON.stringify(projectJusticeMentor(s))).not.toContain('OLD_BAY'); expect(JSON.stringify(projectJusticeMentor(s))).not.toContain('SECOND_SHIFT');
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateJusticeMentorState(s)).toBe(true);
  });
  it('five actual bottle-specific jobs yield only that original800 price, never free preparation', () => {
    const s = taught(), b = s.justiceMentor.bottles[0]!, oldHistory = structuredClone(s.unshadowed);
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98700, 'PLAYER', s.week]);
    expect(s.justiceMentor.bottles[1]!.labourSteps).toBe(0); expect(s.justiceMentor.preparations).toEqual([]); expect(s.justiceMentor.preparedWeek).toBeNull();
    expect(s.unshadowed).toEqual(oldHistory); expect(validateJusticeMentorState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one bottle’s labour', () => {
    const s = taught(), b = s.justiceMentor.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.justiceMentor.bottles[1]!.id });
  });
  it('requires three distinct real professional tasks and separate current-week paid preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of JUSTICE_MENTOR_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId });
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.justiceMentor.preparations[index]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.justiceMentor.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect(hasJusticeMentorLock(s)).toBe(true); expect(projectJusticeMentor(s).insideCase).toBe(true); expect(validateJusticeMentorState(s)).toBe(true);
  });
  it('preserves the last action as a real zero-action confirmation or non-refunding exit', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 120]); reject(s, { type: 'PREPARE_PROMOTION' });
    applyJusticeMentorCommand(s, { type: 'LEAVE_PREPARATION' }, context(s));
    expect([s.actionsRemaining, s.cash, s.justiceMentor.preparedWeek]).toEqual([0, cash - 120, null]);
    expect(s.justiceMentor.bottles[0]!.status).toBe('PLAYER'); expect(hasJusticeMentorLock(s)).toBe(false); reject(s, dose(s));
    expect(validateJusticeMentorState(s)).toBe(true);
  });
  it('requires exact independent confirmation before any result draw', () => {
    const s = prepared();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }]) {
      expect(validateJusticeMentorCommand(command)).toBe(false); reject(s, command);
    }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact tier%s while preserving original S4 history and original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), b = s.justiceMentor.bottles[0]!, original = structuredClone([s.bard, s.lightprayer, s.sunpriest, s.notary, s.priestOfLight, s.unshadowed]);
    const oldMastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender, tasks = structuredClone(s.justiceMentor.preparations);
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.justiceMentor.preparedWeek).toBeNull();
    expect([s.bard, s.lightprayer, s.sunpriest, s.notary, s.priestOfLight, s.unshadowed]).toEqual(original);
    expect(s.justiceMentor.preparations).toEqual(tasks); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) {
      expect(s.justiceMentor.unshadowedActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(JUSTICE_MENTOR_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
      expect(projectJusticeMentor(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateJusticeMentorState(s)).toBe(true); reject(s, dose(s));
  });
  it('floors only guided potion rejection to1 and never reopens a dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    expect(validateJusticeMentorState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('keeps the failed bottle consumed, requires paid re-preparation, and permits recovery then retry', () => {
    const s = prepared(); apply(s, dose(s), 100);
    const first = structuredClone(s.justiceMentor.bottles[0]), oldHistory = structuredClone(s.unshadowed), tasks = structuredClone(s.justiceMentor.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100;
    const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]); apply(s, dose(s, 1));
    expect(s.justiceMentor.bottles[0]).toEqual(first); expect(s.unshadowed).toEqual(oldHistory); expect(s.justiceMentor.preparations).toEqual(tasks);
    expect(validateJusticeMentorState(s)).toBe(true);
  });
  it('retains all failed originals and waits a true week for a new priced batch', () => {
    const s = qualify(taught());
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const originals = structuredClone(s.justiceMentor.bottles), oldHistory = structuredClone(s.unshadowed), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.justiceMentor.bottles.slice(0, 3)).toEqual(originals); expect(s.justiceMentor.bottles).toHaveLength(6);
    expect(s.justiceMentor.bottles[3]).toMatchObject({ id: 'justice-mentor-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(s.unshadowed).toEqual(oldHistory);
    expect(projectJusticeMentor(s).actions.find(a => a.id === 'buy-justice-mentor-potion-4')!.cost).toContain('6200便士');
    expect(validateJusticeMentorState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, vitality and stale preparation before drawing', () => {
    const s = prepared();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.unshadowed.promotionWeek; s.unshadowed.promotionWeek = s.week - 11; reject(s, dose(s)); s.unshadowed.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateJusticeMentorState(s)).toBe(false);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(s.justiceMentor.preparedWeek).toBeNull();
  });
  it('measures twelve full weeks from actual unshadowed promotionW104 rather than original bardW5', () => {
    const s = qualify(taught()); buy(s); expect(s.unshadowed.promotionWeek).toBe(104); expect(s.progression.promotionWeek).toBe(5);
    s.week = 112; expect(justiceMentorAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    expect(projectJusticeMentor(s).digestion).toContain('8/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 115; reject(s, { type: 'PREPARE_PROMOTION' }); s.week = 116; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.justiceMentor.preparedWeek).toBe(116); expect(s.progression.promotionWeek).toBe(5);
  });
  it('lets an alive depleted character cancel at zero actions without healing, refund or a result draw', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.justiceMentor.bottles), old = structuredClone(s.unshadowed);
    reject(s, dose(s));
    expect(projectJusticeMentor(s).actions.find(a => a.command.type === 'LEAVE_PREPARATION')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect(c.check).not.toHaveBeenCalled(); expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.justiceMentor.bottles).toEqual(bottles); expect(s.unshadowed).toEqual(old); expect(hasJusticeMentorLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateJusticeMentorState(s)).toBe(true);
  });
  it.each([1, 100])('leaves the real preparation scene after consumption%s even with no remaining actions', roll => {
    const s = prepared(); s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(s.justiceMentor.preparedWeek).toBeNull(); expect(hasJusticeMentorLock(s)).toBe(false);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('沿原出口实际离开'));
    expect(projectJusticeMentor(s).insideCase).toBe(false); expect(validateJusticeMentorState(s)).toBe(true);
  });
  it('preserves surrendered Edmund, original emotion return and every old object across S3', () => {
    const s = prepared(), history = structuredClone(s.combatHistory), injuries = structuredClone(s.injuries), town = structuredClone(s.town);
    const originalPromotion = s.progression.promotionWeek, random = structuredClone(s.random);
    expect(s.unshadowed.encounter.enemy).toMatchObject({ id: 'UD4-EDMUND', health: 60, mind: 100, status: 'SURRENDERED', weaponId: 'UD4-EDMUND-CLUB', weaponLocation: 'COURTYARD' });
    expect(s.unshadowed.life).toMatchObject({ ally: { location: 'LOW', moves: 3, returns: 3 }, characteristic: { contamination: 0, containment: 'BENCH' }, tile: { scorchMarks: 1, coolingSeconds: 60, heat: 'COLD' } });
    expect(s.unshadowed.ritual).toMatchObject({ activeVisitId: null, playerLocation: 'OUTSIDE' });
    expect(s.unshadowed.ritual.visits[0]!).toMatchObject({ phase: 'RETURNED', anchor: { location: 'RETURNED', felt: true }, vessel: { id: 'UD4-VESSEL-1', status: 'EMPTY' } });
    const originals = structuredClone([s.bard, s.lightprayer, s.sunpriest, s.notary, s.priestOfLight, s.unshadowed]), newScenes = structuredClone([s.justiceMentor.life, s.justiceMentor.encounter]);
    apply(s, dose(s)); expect(s.combatHistory).toEqual(history); expect(s.injuries).toEqual(injuries); expect(s.town).toEqual(town);
    expect(s.progression.promotionWeek).toBe(originalPromotion); expect(s.random).toEqual(random); expect(s.character.gender).toBe('FEMALE');
    expect([s.bard, s.lightprayer, s.sunpriest, s.notary, s.priestOfLight, s.unshadowed]).toEqual(originals); expect([s.justiceMentor.life, s.justiceMentor.encounter]).toEqual(newScenes);
    expect(s.progression.mastery['sun.s4.purification']).toBe(0);
    const visible = projectJusticeMentor(s).inheritedHistory.join(' ');
    expect(visible).toContain('健康60/100、精神100/100'); expect(visible).toContain('已投降，原伤势保留'); expect(visible).toContain('原院COURTYARD地面');
    expect(visible).toContain('UD4-ALDEN'); expect(visible).toContain('退出/返回3/3'); expect(visible).toContain('污染0');
    expect(visible).toContain('UD4-TILE保留1处焦痕'); expect(visible).toContain('已实际冷却60秒'); expect(visible).toContain('UD4-EMOTION-1仍为RETURNED'); expect(visible).toContain('UD4-VESSEL-1为EMPTY');
  });
  it('rejects guidance without the actual S4 promotion and cannot borrow any old material batch', () => {
    const s = unshadowed(); s.unshadowed.promotionWeek = null;
    expect(projectJusticeMentor(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught();
    for (const bottleId of ['unshadowed-batch-1:bottle', 'priest-of-light-batch-2:bottle', 'notary-potion-2']) reject(t, { type: 'BUY_POTION', bottleId });
    expect(t.unshadowed.batches[2]!.acquired).toBe(false); expect(t.unshadowed.bottles[0]!.status).toBe('CONSUMED');
  });
  it('rejects missing action points before charging tasks, work, guidance or preparation', () => {
    const s = unshadowed(); s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0;
    reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_TERMS' }); reject(t, { type: 'POTION_WORK', bottleId: t.justiceMentor.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.actionsRemaining = 0; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it('requires old rituals and prepared or open original scenes to close while allowing the real returned emotion', () => {
    const s = qualify(taught()); buy(s);
    expect(s.unshadowed.ritual.playerLocation).toBe('OUTSIDE'); expect(s.unshadowed.ritual.activeVisitId).toBeNull();
    expect(justiceMentorAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toBeNull();
    const malformed = structuredClone(s); malformed.unshadowed.ritual.playerLocation = 'HALL'; expect(validateUnshadowedRitualState(malformed)).toBe(false);
    const fixture = JSON.parse(readFileSync('tests/fixtures/unshadowed-v01250/natural.json', 'utf8'));
    let openRitual = createSliceRun(fixture.final.runId, fixture.creation, fixture.seed);
    for (const intent of fixture.commands as SliceIntent[]) { if (intent.type === 'UNSHADOWED' && intent.command.type === 'CONSUME') break; openRitual = applySliceIntent(openRitual, intent); }
    assertValidSliceState(openRitual); expect(hasUnshadowedRitualLock(openRitual)).toBe(true); reject(openRitual, { type: 'PREPARE_PROMOTION' });
    const changes: ((state: SliceState) => void)[] = [
      t => { t.unshadowed.life.playerLocation = 'ROOM'; }, t => { t.unshadowed.life.ally.location = 'OUTSIDE'; },
      t => { t.unshadowed.life.cases['open-domain'].status = 'PREPARED'; }, t => { t.priestOfLight.practice.auraOpen = true; },
      t => { t.priestOfLight.practice.lanternPosition = 'SHELTER'; }, t => { Object.values(t.priestOfLight.cases)[0]!.status = 'PREPARED'; },
      t => { Object.values(t.notary.cases)[0]!.contactOpen = true; }, t => { t.unshadowed.ritual.activeVisitId = 'UD4-RITUAL-1'; },
      t => { t.notary.contract.active = true; }, t => { t.notary.contract.tool = 'PLAYER'; },
      t => { t.unshadowed.life.tile.heat = 'HOT'; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'unshadowed-potion-3' }, { type: 'PREPARE_TASK', taskId: 'MASS_RESONANCE' }, { type: 'LEARN_GUIDANCE', grantOmniscience: true }, { type: 'CONSUME', bottleId: 'justice-mentor-potion-1', confirmed: false }])('rejects nonexact commands%# without mutation', command => {
    expect(validateJusticeMentorCommand(command)).toBe(false); expect(isJusticeMentorAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects malformed shape, copied bottle provenance, duplicate preparation and forged chronology', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.justiceMentor.unshadowedActingAtPromotion = 99; }, t => { t.justiceMentor.bottles[0]!.source = 'old S4 bottle'; },
      t => { t.justiceMentor.bottles[0]!.preparationWeek = t.justiceMentor.bottles[0]!.preparationWeek! - 1; }, t => { t.justiceMentor.bottles[1]!.id = t.justiceMentor.bottles[0]!.id; },
      t => { t.justiceMentor.preparations[1]!.taskId = t.justiceMentor.preparations[0]!.taskId; },
      t => { t.justiceMentor.preparations[0]!.completedWeek = t.week + 1; }, t => { t.justiceMentor.preparedWeek = t.week; },
      t => { delete t.progression.mastery[JUSTICE_MENTOR_ABILITY_IDS[0]]; },
      t => { (t.justiceMentor as unknown as Record<string, unknown>).life = null; },
      t => { (t.justiceMentor as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateJusticeMentorState(t)).not.toThrow(); expect(validateJusticeMentorState(t)).toBe(false); }
  });
  it('keeps validation independent of serialized object key order', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, reorder(x)])) : v;
    expect(validateJusticeMentorState(reorder(s) as SliceState)).toBe(true);
    expect(projectJusticeMentor(reorder(s) as SliceState).inheritedHistory).toEqual(projectJusticeMentor(s).inheritedHistory);
  });

  it('returns explicit preparation blockers without consuming the next original bottle', () => {
    const s = qualify(taught()); buy(s); s.cash = 119;
    expect(justiceMentorAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('120'); reject(s, { type: 'PREPARE_PROMOTION' });
    expect(s.justiceMentor.bottles[0]!.status).toBe('PLAYER');
  });
  it('prepares only the current promotion and never grants future life consent or moves an original object', () => {
    const s = taught(), scenes = structuredClone([s.justiceMentor.life, s.justiceMentor.encounter]);
    qualify(s); buy(s); apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.justiceMentor.life, s.justiceMentor.encounter]).toEqual(scenes);
    expect(s.justiceMentor.preparations.map(p => p.taskId)).toEqual(['CHECK_TERMS', 'REVIEW_BOUNDARIES', 'PLAN_RETURN']);
    reject(s, { type: 'PREPARE_TASK', taskId: 'CHECK_TERMS' });
    reject(s, { type: 'BUY_POTION', bottleId: s.justiceMentor.bottles[1]!.id });
    apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.justiceMentor.life, s.justiceMentor.encounter]).toEqual(scenes);
  });
  it('does not promise same-week supply, duplicate deliveries or repricing of old failed bottles', () => {
    const s = qualify(taught());
    reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; }
    apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    const pending = structuredClone(s); pending.justiceMentor.resupply.requestedWeek = pending.week + 1;
    expect(validateJusticeMentorState(pending)).toBe(false);
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    const before = structuredClone(s.justiceMentor.bottles.slice(0, 3));
    buy(s, 3); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 3));
    expect(s.justiceMentor.bottles.slice(0, 3)).toEqual(before);
    expect(validateJusticeMentorState(s)).toBe(true);
    const bad = structuredClone(s); bad.justiceMentor.bottles[4]!.stockedWeek = bad.justiceMentor.bottles[4]!.stockedWeek! - 1;
    expect(validateJusticeMentorState(bad)).toBe(false);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unavailable guidance, foreign locations and unresolved original encounters without charges', () => {
    const s = unshadowed(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.unshadowed.encounter.status = 'READY'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_TERMS' });
    t.unshadowed.encounter.status = 'RESOLVED'; t.status = 'DEAD'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_TERMS' });
    t.status = 'ACTIVE'; t.world.city = 'ELSEWHERE'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_TERMS' });
  });

  it('never imports unrelated crafting, moral truth, compulsory contracts or a new emotion ritual', () => {
    const s = prepared(); apply(s, dose(s));
    for (const command of [{ type: 'MAKE_INHERITED_FLASH' }, { type: 'DETECT_EVIL' }, { type: 'FORCE_CONTRACT' }, { type: 'SEPARATE_EMOTION' }, { type: 'CREATE_EVIDENCE' }]) expect(validateJusticeMentorCommand(command)).toBe(false);
    expect(projectJusticeMentor(s).actions.some(action => (action.command as { type: string }).type === 'MAKE_INHERITED_FLASH')).toBe(false);
    expect(Object.keys(s.justiceMentor).sort()).toEqual(['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'unshadowedActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter'].sort());
  });
});
