import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { hasNightwatcherRitualLock, validateNightwatcherRitualState } from '../../src/domain/nightwatcher/ritual.js';
import { applyFearBishopAcquisition, applyFearBishopCommand, createFearBishopState, hasFearBishopLock, isFearBishopAcquisitionCommand, projectFearBishop, validateFearBishopCommand, validateFearBishopState, fearBishopAcquisitionBlock } from '../../src/domain/fear-bishop/index.js';
import { FEAR_BISHOP_CONSUMPTION_RISK, FEAR_BISHOP_FORMULA_STATUS, FEAR_BISHOP_PRICES, FEAR_BISHOP_SOURCE_STATUS } from '../../src/domain/fear-bishop/content.js';
import { FEAR_BISHOP_ABILITY_IDS, FEAR_BISHOP_PREPARATION_IDS, type FearBishopAcquisitionCommand } from '../../src/domain/fear-bishop/types.js';

/** Genuine 291-command nightwatcher-v01220 end-state; later time/resources are explicit unit setup, never natural-play evidence. */
function nightwatcher(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/nightwatcher-v01220/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.fearBishop = createFearBishopState();
  s.week = Math.max(s.week, s.nightwatcher.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: FearBishopAcquisitionCommand, roll = 1) { const c = context(s, roll); applyFearBishopAcquisition(s, command, c); return c; }
function taught(s = nightwatcher()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of FEAR_BISHOP_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.fearBishop.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.fearBishop.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyFearBishopAcquisition(s, command as FearBishopAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Fear Bishop S3 original bottles and explicitly G professional preparation', () => {
  it('reads the genuine291-command living W75 baseline without treating unit boosts as natural play', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/nightwatcher-v01220/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(291); expect(fixture.seed).toBe(fixture.final.random.seed);
    expect(fixture.final).toMatchObject({ week: 75, status: 'ACTIVE', cash: 780, actionsRemaining: 1, health: 70, mind: 100, spirituality: 120, character: { gender: 'FEMALE' }, nightwatcher: { promotionWeek: 68 }, progression: { sequence: 4, acting: 100 } });
    const state = migrateSliceState(fixture.final);
    expect(validateFearBishopState(state)).toBe(true);
    expect(state.nightwatcher).toEqual(fixture.final.nightwatcher); expect(state.nightmare).toEqual(fixture.final.nightmare); expect(state.midnight).toEqual(fixture.final.midnight);
    expect(projectFearBishop(state).digestion).toContain('7/12');
  });
  it('creates independent originals and hides the source before darkness S4', () => {
    const s = createSliceRun('fear-bishop-hidden', sliceDefaultCreationSelection, 'fear-bishop-hidden');
    expect(validateFearBishopState(s)).toBe(true);
    expect(projectFearBishop(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '', resources: null });
    expect(projectFearBishop(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createFearBishopState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'CHECK_RESIDUE', completedWeek: 1 });
    expect(s.fearBishop.bottles[0]!.labourSteps).toBe(0); expect(s.fearBishop.preparations).toEqual([]);
  });
  it('does not open this S3 channel for any other pathway or unsupported darkness sequence', () => {
    const s = nightwatcher();
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'white-tower', 'tyrant', 'sun', 'death', 'door', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const other = structuredClone(s); other.progression.pathwayId = pathwayId;
      expect(projectFearBishop(other).discovered).toBe(false); expect(projectFearBishop(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 0]) { const other = structuredClone(s); other.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectFearBishop(other).discovered).toBe(false); }
    const forgedS1 = nightwatcher(); forgedS1.progression.sequence = 1; expect(() => assertValidSliceState(forgedS1)).toThrow(TypeError); reject(forgedS1, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without inventing a canonical formula, rite or unverified canonical ability', () => {
    const s = nightwatcher(), old = structuredClone([s.sleepless, s.midnight, s.nightmare, s.soother, s.spiritWarlock, s.nightwatcher]);
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.sleepless, s.midnight, s.nightmare, s.soother, s.spiritWarlock, s.nightwatcher]).toEqual(old);
    expect(FEAR_BISHOP_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(FEAR_BISHOP_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(FEAR_BISHOP_FORMULA_STATUS).toContain('不复用守夜人的旧仪式包');
    expect(FEAR_BISHOP_SOURCE_STATUS).toContain('直接核实黑暗序列3恐惧主教');
    expect(FEAR_BISHOP_SOURCE_STATUS).toContain('并非隐秘权柄'); expect(FEAR_BISHOP_SOURCE_STATUS).toContain('天使表现');
    expect(FEAR_BISHOP_SOURCE_STATUS).toContain('阿蒙时钟能够减缓'); expect(FEAR_BISHOP_SOURCE_STATUS).toContain('序列2仅为人物关系推断');
    expect(FEAR_BISHOP_SOURCE_STATUS).toContain('均为明确原创G'); expect(FEAR_BISHOP_SOURCE_STATUS).toContain('恐惧女妖的物种技能不等于');
    expect(FEAR_BISHOP_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectFearBishop(s)).toMatchObject({ formulaKnown: false, formula: [], preparations: FEAR_BISHOP_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateFearBishopState(s)).toBe(true);
  });
  it('five actual bottle-specific jobs yield only that original800 price, never free preparation', () => {
    const s = taught(), b = s.fearBishop.bottles[0]!, oldHistory = structuredClone(s.nightwatcher);
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98700, 'PLAYER', s.week]);
    expect(s.fearBishop.bottles[1]!.labourSteps).toBe(0); expect(s.fearBishop.preparations).toEqual([]); expect(s.fearBishop.preparedWeek).toBeNull();
    expect(s.nightwatcher).toEqual(oldHistory); expect(validateFearBishopState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one bottle’s labour', () => {
    const s = taught(), b = s.fearBishop.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.fearBishop.bottles[1]!.id });
  });
  it('requires three distinct real professional tasks and separate current-week paid preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of FEAR_BISHOP_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId });
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.fearBishop.preparations[index]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.fearBishop.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect(hasFearBishopLock(s)).toBe(true); expect(projectFearBishop(s).insideCase).toBe(true); expect(validateFearBishopState(s)).toBe(true);
  });
  it('preserves the last action as a real zero-action confirmation or non-refunding exit', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 120]); reject(s, { type: 'PREPARE_PROMOTION' });
    applyFearBishopCommand(s, { type: 'LEAVE_PREPARATION' }, context(s));
    expect([s.actionsRemaining, s.cash, s.fearBishop.preparedWeek]).toEqual([0, cash - 120, null]);
    expect(s.fearBishop.bottles[0]!.status).toBe('PLAYER'); expect(hasFearBishopLock(s)).toBe(false); reject(s, dose(s));
    expect(validateFearBishopState(s)).toBe(true);
  });
  it('requires exact independent confirmation before any result draw', () => {
    const s = prepared();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }]) {
      expect(validateFearBishopCommand(command)).toBe(false); reject(s, command);
    }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact tier%s while preserving original S4 history and original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), b = s.fearBishop.bottles[0]!, original = structuredClone([s.sleepless, s.midnight, s.nightmare, s.soother, s.spiritWarlock, s.nightwatcher]);
    const oldMastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender, tasks = structuredClone(s.fearBishop.preparations);
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.fearBishop.preparedWeek).toBeNull();
    expect([s.sleepless, s.midnight, s.nightmare, s.soother, s.spiritWarlock, s.nightwatcher]).toEqual(original);
    expect(s.fearBishop.preparations).toEqual(tasks); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) {
      expect(s.fearBishop.nightwatcherActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(FEAR_BISHOP_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
      expect(projectFearBishop(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateFearBishopState(s)).toBe(true); reject(s, dose(s));
  });
  it('floors only guided potion rejection to1 and never reopens a dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    expect(validateFearBishopState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('keeps the failed bottle consumed, requires paid re-preparation, and permits recovery then retry', () => {
    const s = prepared(); apply(s, dose(s), 100);
    const first = structuredClone(s.fearBishop.bottles[0]), oldHistory = structuredClone(s.nightwatcher), tasks = structuredClone(s.fearBishop.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100;
    const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]); apply(s, dose(s, 1));
    expect(s.fearBishop.bottles[0]).toEqual(first); expect(s.nightwatcher).toEqual(oldHistory); expect(s.fearBishop.preparations).toEqual(tasks);
    expect(validateFearBishopState(s)).toBe(true);
  });
  it('retains all failed originals and waits a true week for a new priced batch', () => {
    const s = qualify(taught());
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const originals = structuredClone(s.fearBishop.bottles), oldHistory = structuredClone(s.nightwatcher), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.fearBishop.bottles.slice(0, 3)).toEqual(originals); expect(s.fearBishop.bottles).toHaveLength(6);
    expect(s.fearBishop.bottles[3]).toMatchObject({ id: 'fear-bishop-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(s.nightwatcher).toEqual(oldHistory);
    expect(projectFearBishop(s).actions.find(a => a.id === 'buy-fear-bishop-potion-4')!.cost).toContain('6200便士');
    expect(validateFearBishopState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, vitality and stale preparation before drawing', () => {
    const s = prepared();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.nightwatcher.promotionWeek; s.nightwatcher.promotionWeek = s.week - 11; reject(s, dose(s)); s.nightwatcher.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateFearBishopState(s)).toBe(false);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(s.fearBishop.preparedWeek).toBeNull();
  });
  it('measures twelve full weeks from actual nightwatcher promotion W68 rather than original sleepless W5', () => {
    const s = qualify(taught()); buy(s);
    expect(s.nightwatcher.promotionWeek).toBe(68); expect(s.progression.promotionWeek).toBe(5);
    s.week = 76;
    expect(fearBishopAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    expect(projectFearBishop(s).digestion).toContain('8/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 79; reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 80; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.fearBishop.preparedWeek).toBe(80); expect(s.progression.promotionWeek).toBe(5);
  });
  it('lets an alive depleted character cancel at zero actions without healing, refund or a result draw', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.fearBishop.bottles), old = structuredClone(s.nightwatcher);
    reject(s, dose(s));
    expect(projectFearBishop(s).actions.find(a => a.command.type === 'LEAVE_PREPARATION')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect(c.check).not.toHaveBeenCalled(); expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.fearBishop.bottles).toEqual(bottles); expect(s.nightwatcher).toEqual(old); expect(hasFearBishopLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateFearBishopState(s)).toBe(true);
  });
  it.each([1, 100])('leaves the real preparation scene after consumption%s even with no remaining actions', roll => {
    const s = prepared(); s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(s.fearBishop.preparedWeek).toBeNull(); expect(hasFearBishopLock(s)).toBe(false);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('沿原出口实际离开'));
    expect(projectFearBishop(s).insideCase).toBe(false); expect(validateFearBishopState(s)).toBe(true);
  });
  it('preserves the same dead Bram, sealed original Leaf, awakened people, old objects and female body across S3', () => {
    const s = prepared(), history = structuredClone(s.combatHistory), injuries = structuredClone(s.injuries), town = structuredClone(s.town);
    const originalPromotion = s.progression.promotionWeek, random = structuredClone(s.random);
    expect(s.character.gender).toBe('FEMALE');
    expect(s.nightwatcher.encounter.enemy).toMatchObject({ id: 'NW4-BRAM', health: 0, mind: 100, status: 'DEAD', weaponId: 'NW4-BRAM-CLUB', weaponLocation: 'YARD' });
    expect(s.spiritWarlock.companion).toEqual({ status: 'SEALED', invitedWeek: 53, acquiredWeek: 45, releases: 1, deployments: 10, recalls: 10, source: 'SW5-LEAF-1' });
    expect(s.nightwatcher.life.people.mason).toMatchObject({ id: 'SW5-MASON', alive: true, asleep: false });
    expect(s.nightwatcher.life.people.ilva).toMatchObject({ id: 'NW4-ILVA', alive: true, asleep: false });
    const originals = structuredClone([s.sleepless, s.midnight, s.nightmare, s.soother, s.spiritWarlock, s.nightwatcher]);
    const newScenes = structuredClone([s.fearBishop.life, s.fearBishop.encounter]);
    apply(s, dose(s));
    expect(s.combatHistory).toEqual(history); expect(s.injuries).toEqual(injuries); expect(s.town).toEqual(town);
    expect(s.progression.promotionWeek).toBe(originalPromotion); expect(s.random).toEqual(random); expect(s.character.gender).toBe('FEMALE');
    expect([s.sleepless, s.midnight, s.nightmare, s.soother, s.spiritWarlock, s.nightwatcher]).toEqual(originals);
    expect([s.fearBishop.life, s.fearBishop.encounter]).toEqual(newScenes);
    const visible = projectFearBishop(s).inheritedHistory.join(' ');
    expect(visible).toContain('健康0/100、精神100/100'); expect(visible).toContain('已死亡，不会复活'); expect(visible).toContain('原院地面');
    expect(visible).toContain('唯一原灵SW5-LEAF-1：当前SEALED'); expect(visible).toContain('原派出10次、实际召回10次、释放1次');
    expect(visible).toContain('最近邀请周53'); expect(visible).toContain('SW5-NOTE-1仍在TABLE'); expect(visible).toContain('NW4-NOTE-1仍在TABLE');
    expect(visible).toContain('NW4-CART仍在START'); expect(visible).toContain('原梅森SW5-MASON：仍活着、当前清醒');
  });
  it('never restores or creates a companion when the original Leaf remains released at promotion', () => {
    const s = prepared(); s.spiritWarlock.companion.status = 'RELEASED'; s.spiritWarlock.companion.releases++;
    const original = structuredClone(s.spiritWarlock.companion);
    apply(s, dose(s)); expect(s.spiritWarlock.companion).toEqual(original);
    expect(projectFearBishop(s).inheritedHistory.join(' ')).toContain('当前RELEASED');
    expect(validateFearBishopState(s)).toBe(true);
  });
  it('rejects guidance without the actual S4 promotion and cannot borrow any old material batch', () => {
    const s = nightwatcher(); s.nightwatcher.promotionWeek = null;
    expect(projectFearBishop(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught();
    for (const bottleId of ['nightwatcher-potion-1', 'spirit-warlock-potion-2', 'soother-potion-2']) reject(t, { type: 'BUY_POTION', bottleId });
    expect(t.nightwatcher.bottles[2]!.status).toBe('SUPPLIER');
  });
  it('rejects missing action points before charging tasks, work, guidance or preparation', () => {
    const s = nightwatcher(); s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0;
    reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_RESIDUE' }); reject(t, { type: 'POTION_WORK', bottleId: t.fearBishop.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.actionsRemaining = 0; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it('requires old rituals, dreams, prepared scenes, original objects and Leaf deployment to be closed', () => {
    const s = qualify(taught()); buy(s);
    // HALL alone with a closed visit is a malformed old save, not an active ritual.
    const malformed = structuredClone(s); malformed.nightwatcher.ritual.playerLocation = 'HALL';
    expect(validateNightwatcherRitualState(malformed)).toBe(false);
    // Replay the actual original route to its still-open, pre-consumption S5 window.
    const fixture = JSON.parse(readFileSync('tests/fixtures/nightwatcher-v01220/natural.json', 'utf8'));
    let openRitual = createSliceRun(fixture.final.runId, fixture.creation, fixture.seed);
    for (const intent of fixture.commands as SliceIntent[]) {
      if (intent.type === 'NIGHTWATCHER' && intent.command.type === 'CONSUME') break;
      openRitual = applySliceIntent(openRitual, intent);
    }
    assertValidSliceState(openRitual); expect(hasNightwatcherRitualLock(openRitual)).toBe(true);
    expect(fearBishopAcquisitionBlock(openRitual, { type: 'PREPARE_PROMOTION' })).toContain('旧守夜人准备室');
    reject(openRitual, { type: 'PREPARE_PROMOTION' });
    s.nightwatcher.life.practice.concentration = true; reject(s, { type: 'PREPARE_PROMOTION' }); s.nightwatcher.life.practice.concentration = false;
    s.nightwatcher.life.practice.note.location = 'RECIPIENT'; reject(s, { type: 'PREPARE_PROMOTION' }); s.nightwatcher.life.practice.note.location = 'TABLE';
    s.nightwatcher.life.cart.location = 'END'; reject(s, { type: 'PREPARE_PROMOTION' }); s.nightwatcher.life.cart.location = 'START';
    s.nightwatcher.life.people.mason.asleep = true; reject(s, { type: 'PREPARE_PROMOTION' }); s.nightwatcher.life.people.mason.asleep = false;
    s.nightwatcher.life.cases['leaf-signal'].status = 'PREPARED'; reject(s, { type: 'PREPARE_PROMOTION' }); s.nightwatcher.life.cases['leaf-signal'].status = 'RESOLVED';
    const first = Object.values(s.spiritWarlock.cases)[0]!; first.contactOpen = true; reject(s, { type: 'PREPARE_PROMOTION' }); first.contactOpen = false;
    s.spiritWarlock.practice.dreamOpen = true; reject(s, { type: 'PREPARE_PROMOTION' }); s.spiritWarlock.practice.dreamOpen = false;
    s.spiritWarlock.practice.note = 'RECIPIENT'; reject(s, { type: 'PREPARE_PROMOTION' }); s.spiritWarlock.practice.note = 'TABLE';
    s.spiritWarlock.companion.status = 'DEPLOYED'; reject(s, { type: 'PREPARE_PROMOTION' }); s.spiritWarlock.companion.status = 'SEALED';
    const oldSoother = Object.values(s.soother.cases)[0]!; oldSoother.contactOpen = true; reject(s, { type: 'PREPARE_PROMOTION' }); oldSoother.contactOpen = false;
    const oldDream = Object.values(s.nightmare.cases)[0]!; oldDream.status = 'DREAM_RECORDED'; reject(s, { type: 'PREPARE_PROMOTION' }); oldDream.status = 'RESOLVED';
    expect(fearBishopAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toBeNull();
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'nightwatcher-potion-3' }, { type: 'PREPARE_TASK', taskId: 'MASS_RESONANCE' }, { type: 'LEARN_GUIDANCE', grantArmy: true }, { type: 'CONSUME', bottleId: 'fear-bishop-potion-1', confirmed: false }])('rejects nonexact commands%# without mutation', command => {
    expect(validateFearBishopCommand(command)).toBe(false); expect(isFearBishopAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects malformed shape, copied bottle provenance, duplicate preparation and forged chronology', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.fearBishop.nightwatcherActingAtPromotion = 99; }, t => { t.fearBishop.bottles[0]!.source = 'old S4 bottle'; },
      t => { t.fearBishop.bottles[0]!.preparationWeek = t.fearBishop.bottles[0]!.preparationWeek! - 1; }, t => { t.fearBishop.bottles[1]!.id = t.fearBishop.bottles[0]!.id; },
      t => { t.fearBishop.preparations[1]!.taskId = t.fearBishop.preparations[0]!.taskId; },
      t => { t.fearBishop.preparations[0]!.completedWeek = t.week + 1; }, t => { t.fearBishop.preparedWeek = t.week; },
      t => { delete t.progression.mastery[FEAR_BISHOP_ABILITY_IDS[0]]; },
      t => { (t.fearBishop as unknown as Record<string, unknown>).life = null; },
      t => { (t.fearBishop as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateFearBishopState(t)).not.toThrow(); expect(validateFearBishopState(t)).toBe(false); }
  });
  it('keeps validation independent of serialized object key order', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, reorder(x)])) : v;
    expect(validateFearBishopState(reorder(s) as SliceState)).toBe(true);
    expect(projectFearBishop(reorder(s) as SliceState).inheritedHistory).toEqual(projectFearBishop(s).inheritedHistory);
  });

  it('returns explicit preparation blockers without consuming the next original bottle', () => {
    const s = qualify(taught()); buy(s); s.cash = 119;
    expect(fearBishopAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('120'); reject(s, { type: 'PREPARE_PROMOTION' });
    expect(s.fearBishop.bottles[0]!.status).toBe('PLAYER');
  });
  it('prepares only the current promotion and never grants future life consent or moves an original object', () => {
    const s = taught(), scenes = structuredClone([s.fearBishop.life, s.fearBishop.encounter]);
    qualify(s); buy(s); apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.fearBishop.life, s.fearBishop.encounter]).toEqual(scenes);
    expect(s.fearBishop.preparations.map(p => p.taskId)).toEqual(['CHECK_RESIDUE', 'AGREE_STOP', 'PLAN_EXIT']);
    reject(s, { type: 'PREPARE_TASK', taskId: 'CHECK_RESIDUE' });
    reject(s, { type: 'BUY_POTION', bottleId: s.fearBishop.bottles[1]!.id });
    apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.fearBishop.life, s.fearBishop.encounter]).toEqual(scenes);
  });
  it('does not promise same-week supply, duplicate deliveries or repricing of old failed bottles', () => {
    const s = qualify(taught());
    reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; }
    apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    const pending = structuredClone(s); pending.fearBishop.resupply.requestedWeek = pending.week + 1;
    expect(validateFearBishopState(pending)).toBe(false);
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    const before = structuredClone(s.fearBishop.bottles.slice(0, 3));
    buy(s, 3); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 3));
    expect(s.fearBishop.bottles.slice(0, 3)).toEqual(before);
    expect(validateFearBishopState(s)).toBe(true);
    const bad = structuredClone(s); bad.fearBishop.bottles[4]!.stockedWeek = bad.fearBishop.bottles[4]!.stockedWeek! - 1;
    expect(validateFearBishopState(bad)).toBe(false);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unavailable guidance, foreign locations and unresolved original encounters without charges', () => {
    const s = nightwatcher(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.nightwatcher.encounter.status = 'READY'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_RESIDUE' });
    t.nightwatcher.encounter.status = 'RESOLVED'; t.status = 'DEAD'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_RESIDUE' });
    t.status = 'ACTIVE'; t.world.city = 'ELSEWHERE'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_RESIDUE' });
  });

});
