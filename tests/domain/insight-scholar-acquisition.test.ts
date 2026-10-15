import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { hasProphetRitualLock, validateProphetRitualState } from '../../src/domain/prophet/ritual.js';
import { applyInsightScholarAcquisition, applyInsightScholarCommand, createInsightScholarState, hasInsightScholarLock, isInsightScholarAcquisitionCommand, projectInsightScholar, validateInsightScholarCommand, validateInsightScholarState, insightScholarAcquisitionBlock } from '../../src/domain/insight-scholar/index.js';
import { INSIGHT_SCHOLAR_CONSUMPTION_RISK, INSIGHT_SCHOLAR_FORMULA_STATUS, INSIGHT_SCHOLAR_PRICES, INSIGHT_SCHOLAR_SOURCE_STATUS } from '../../src/domain/insight-scholar/content.js';
import { INSIGHT_SCHOLAR_ABILITY_IDS, INSIGHT_SCHOLAR_PREPARATION_IDS, type InsightScholarAcquisitionCommand } from '../../src/domain/insight-scholar/types.js';

/** Genuine 329-command prophet-v01230 end-state; later time/resources are explicit unit setup, never natural-play evidence. */
function prophet(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/prophet-v01230/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.insightScholar = createInsightScholarState();
  s.week = Math.max(s.week, s.prophet.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: InsightScholarAcquisitionCommand, roll = 1) { const c = context(s, roll); applyInsightScholarAcquisition(s, command, c); return c; }
function taught(s = prophet()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of INSIGHT_SCHOLAR_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.insightScholar.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.insightScholar.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyInsightScholarAcquisition(s, command as InsightScholarAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Insight Scholar candidate S3 original bottles and explicitly G professional preparation', () => {
  it('reads the genuine329-command living W88 baseline without treating unit boosts as natural play', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/prophet-v01230/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(329); expect(fixture.seed).toBe('reader-natural-v023'); expect(fixture.seed).toBe(fixture.final.random.seed);
    expect(fixture.final).toMatchObject({ week: 88, status: 'ACTIVE', cash: 1360, actionsRemaining: 1, health: 100, mind: 100, spirituality: 114, character: { age: 26, gender: 'FEMALE', coreStats: { physique: 26, perception: 27, will: 25, knowledge: 28 } }, prophet: { promotionWeek: 78 }, progression: { sequence: 4, acting: 100 } });
    const state = migrateSliceState(fixture.final);
    expect(validateInsightScholarState(state)).toBe(true);
    expect([state.reader, state.reasoner, state.detective, state.polymath, state.mysticismMagister, state.prophet]).toEqual([fixture.final.reader, fixture.final.reasoner, fixture.final.detective, fixture.final.polymath, fixture.final.mysticismMagister, fixture.final.prophet]);
    expect(projectInsightScholar(state).digestion).toContain('10/12');
  });
  it('creates independent originals and hides the source before white-tower S4', () => {
    const s = createSliceRun('insight-scholar-hidden', sliceDefaultCreationSelection, 'insight-scholar-hidden');
    expect(validateInsightScholarState(s)).toBe(true);
    expect(projectInsightScholar(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '', resources: null });
    expect(projectInsightScholar(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createInsightScholarState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'CHECK_RECORDS', completedWeek: 1 });
    expect(s.insightScholar.bottles[0]!.labourSteps).toBe(0); expect(s.insightScholar.preparations).toEqual([]);
  });
  it('does not open this S3 channel for any other pathway or unsupported white-tower sequence', () => {
    const s = prophet();
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'tyrant', 'sun', 'death', 'door', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const other = structuredClone(s); other.progression.pathwayId = pathwayId;
      expect(projectInsightScholar(other).discovered).toBe(false); expect(projectInsightScholar(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 1, 0]) { const other = structuredClone(s); other.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectInsightScholar(other).discovered).toBe(false); }
  });
  it('charges500 and one action while exposing the unverified name, sequence, abilities, formula and rite', () => {
    const s = prophet(), old = structuredClone([s.reader, s.reasoner, s.detective, s.polymath, s.mysticismMagister, s.prophet]);
    apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.reader, s.reasoner, s.detective, s.polymath, s.mysticismMagister, s.prophet]).toEqual(old);
    expect(INSIGHT_SCHOLAR_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(INSIGHT_SCHOLAR_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实');
    expect(INSIGHT_SCHOLAR_FORMULA_STATUS).toContain('不复用预言家的旧仪式包');
    expect(INSIGHT_SCHOLAR_SOURCE_STATUS).toContain('未命中“洞悉者”');
    expect(INSIGHT_SCHOLAR_SOURCE_STATUS).toContain('尚无直接证据'); expect(INSIGHT_SCHOLAR_SOURCE_STATUS).toContain('序列2编号证据');
    expect(INSIGHT_SCHOLAR_SOURCE_STATUS).toContain('均为明确原创G'); expect(INSIGHT_SCHOLAR_SOURCE_STATUS).toContain('不因晋升成为全知');
    expect(INSIGHT_SCHOLAR_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectInsightScholar(s)).toMatchObject({ title: '洞悉者·阅读者序列3候选（G扩展）', formulaKnown: false, formula: [], preparations: INSIGHT_SCHOLAR_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateInsightScholarState(s)).toBe(true);
  });
  it('five actual bottle-specific jobs yield only that original800 price, never free preparation', () => {
    const s = taught(), b = s.insightScholar.bottles[0]!, oldHistory = structuredClone(s.prophet);
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98700, 'PLAYER', s.week]);
    expect(s.insightScholar.bottles[1]!.labourSteps).toBe(0); expect(s.insightScholar.preparations).toEqual([]); expect(s.insightScholar.preparedWeek).toBeNull();
    expect(s.prophet).toEqual(oldHistory); expect(validateInsightScholarState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one bottle’s labour', () => {
    const s = taught(), b = s.insightScholar.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.insightScholar.bottles[1]!.id });
  });
  it('requires three distinct real professional tasks and separate current-week paid preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of INSIGHT_SCHOLAR_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId });
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.insightScholar.preparations[index]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.insightScholar.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect(hasInsightScholarLock(s)).toBe(true); expect(projectInsightScholar(s).insideCase).toBe(true); expect(validateInsightScholarState(s)).toBe(true);
  });
  it('preserves the last action as a real zero-action confirmation or non-refunding exit', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 120]); reject(s, { type: 'PREPARE_PROMOTION' });
    applyInsightScholarCommand(s, { type: 'LEAVE_PREPARATION' }, context(s));
    expect([s.actionsRemaining, s.cash, s.insightScholar.preparedWeek]).toEqual([0, cash - 120, null]);
    expect(s.insightScholar.bottles[0]!.status).toBe('PLAYER'); expect(hasInsightScholarLock(s)).toBe(false); reject(s, dose(s));
    expect(validateInsightScholarState(s)).toBe(true);
  });
  it('requires exact independent confirmation before any result draw', () => {
    const s = prepared();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }]) {
      expect(validateInsightScholarCommand(command)).toBe(false); reject(s, command);
    }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact tier%s while preserving original S4 history and original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), b = s.insightScholar.bottles[0]!, original = structuredClone([s.reader, s.reasoner, s.detective, s.polymath, s.mysticismMagister, s.prophet]);
    const oldMastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender, tasks = structuredClone(s.insightScholar.preparations);
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.insightScholar.preparedWeek).toBeNull();
    expect([s.reader, s.reasoner, s.detective, s.polymath, s.mysticismMagister, s.prophet]).toEqual(original);
    expect(s.insightScholar.preparations).toEqual(tasks); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) {
      expect(s.insightScholar.prophetActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(INSIGHT_SCHOLAR_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
      expect(projectInsightScholar(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateInsightScholarState(s)).toBe(true); reject(s, dose(s));
  });
  it('floors only guided potion rejection to1 and never reopens a dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    expect(validateInsightScholarState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('keeps the failed bottle consumed, requires paid re-preparation, and permits recovery then retry', () => {
    const s = prepared(); apply(s, dose(s), 100);
    const first = structuredClone(s.insightScholar.bottles[0]), oldHistory = structuredClone(s.prophet), tasks = structuredClone(s.insightScholar.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100;
    const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]); apply(s, dose(s, 1));
    expect(s.insightScholar.bottles[0]).toEqual(first); expect(s.prophet).toEqual(oldHistory); expect(s.insightScholar.preparations).toEqual(tasks);
    expect(validateInsightScholarState(s)).toBe(true);
  });
  it('retains all failed originals and waits a true week for a new priced batch', () => {
    const s = qualify(taught());
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const originals = structuredClone(s.insightScholar.bottles), oldHistory = structuredClone(s.prophet), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.insightScholar.bottles.slice(0, 3)).toEqual(originals); expect(s.insightScholar.bottles).toHaveLength(6);
    expect(s.insightScholar.bottles[3]).toMatchObject({ id: 'insight-scholar-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(s.prophet).toEqual(oldHistory);
    expect(projectInsightScholar(s).actions.find(a => a.id === 'buy-insight-scholar-potion-4')!.cost).toContain('6200便士');
    expect(validateInsightScholarState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, vitality and stale preparation before drawing', () => {
    const s = prepared();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.prophet.promotionWeek; s.prophet.promotionWeek = s.week - 11; reject(s, dose(s)); s.prophet.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateInsightScholarState(s)).toBe(false);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(s.insightScholar.preparedWeek).toBeNull();
  });
  it('measures twelve full weeks from actual prophet promotion W78 rather than original reader W5', () => {
    const s = qualify(taught()); buy(s);
    expect(s.prophet.promotionWeek).toBe(78); expect(s.progression.promotionWeek).toBe(5);
    s.week = 86;
    expect(insightScholarAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    expect(projectInsightScholar(s).digestion).toContain('8/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 89; reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 90; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.insightScholar.preparedWeek).toBe(90); expect(s.progression.promotionWeek).toBe(5);
  });
  it('lets an alive depleted character cancel at zero actions without healing, refund or a result draw', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.insightScholar.bottles), old = structuredClone(s.prophet);
    reject(s, dose(s));
    expect(projectInsightScholar(s).actions.find(a => a.command.type === 'LEAVE_PREPARATION')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect(c.check).not.toHaveBeenCalled(); expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.insightScholar.bottles).toEqual(bottles); expect(s.prophet).toEqual(old); expect(hasInsightScholarLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateInsightScholarState(s)).toBe(true);
  });
  it.each([1, 100])('leaves the real preparation scene after consumption%s even with no remaining actions', roll => {
    const s = prepared(); s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(s.insightScholar.preparedWeek).toBeNull(); expect(hasInsightScholarLock(s)).toBe(false);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('沿原出口实际离开'));
    expect(projectInsightScholar(s).insideCase).toBe(false); expect(validateInsightScholarState(s)).toBe(true);
  });
  it('preserves the surrendered Harold, known originals, real samples and same female body across S3', () => {
    const s = prepared(), history = structuredClone(s.combatHistory), injuries = structuredClone(s.injuries), town = structuredClone(s.town);
    const originalPromotion = s.progression.promotionWeek, random = structuredClone(s.random);
    expect(s.character.gender).toBe('FEMALE');
    expect(s.prophet.encounter.enemy).toMatchObject({ id: 'PF4-HAROLD', health: 70, mind: 100, status: 'SURRENDERED', weaponId: 'PF4-HAROLD-CLUB', weaponLocation: 'YARD' });
    expect(s.polymath.samples.FLASH.learnedWeek).toBe(42); expect(s.polymath.samples.FROST.learnedWeek).toBe(44); expect(s.polymath.samples.COURAGE.learnedWeek).toBe(45);
    expect(s.mysticismMagister.crafts).toEqual([
      { id: 'MM5-FLASH-1', sourceKitId: 'MM5-KIT-1', createdWeek: 58, usedWeek: 58, status: 'CONSUMED', power: 0.65 },
      { id: 'MM5-FLASH-3', sourceKitId: 'MM5-KIT-3', createdWeek: 63, usedWeek: null, status: 'PLAYER', power: 0.65 },
    ]);
    expect(s.prophet.life.shutter.pin).toBe('SOUND'); expect(s.prophet.life.pages.location).toBe('TABLE'); expect(s.prophet.life.parcel.location).toBe('NORA'); expect(s.prophet.life.pliers.location).toBe('JONAS');
    const originals = structuredClone([s.reader, s.reasoner, s.detective, s.polymath, s.mysticismMagister, s.prophet]);
    const newScenes = structuredClone([s.insightScholar.life, s.insightScholar.encounter]);
    apply(s, dose(s));
    expect(s.combatHistory).toEqual(history); expect(s.injuries).toEqual(injuries); expect(s.town).toEqual(town);
    expect(s.progression.promotionWeek).toBe(originalPromotion); expect(s.random).toEqual(random); expect(s.character.gender).toBe('FEMALE');
    expect([s.reader, s.reasoner, s.detective, s.polymath, s.mysticismMagister, s.prophet]).toEqual(originals);
    expect([s.insightScholar.life, s.insightScholar.encounter]).toEqual(newScenes);
    const visible = projectInsightScholar(s).inheritedHistory.join(' ');
    expect(visible).toContain('健康70/100、精神100/100'); expect(visible).toContain('已投降，原伤势保留'); expect(visible).toContain('原院地面');
    expect(visible).toContain('MM5-FLASH-3：来自MM5-KIT-3、第63周实际制造，当前PLAYER'); expect(visible).toContain('MM5-FLASH-1：来自MM5-KIT-1、第58周实际制造，当前CONSUMED');
    expect(visible).toContain('PF4-SHUTTER销仍为SOUND'); expect(visible).toContain('PF4-PAGES仍在TABLE');
    expect(visible).toContain('PF4-PARCEL仍在NORA'); expect(visible).toContain('PF4-PLIERS仍归JONAS');
  });

  it('rejects guidance without the actual S4 promotion and cannot borrow any old material batch', () => {
    const s = prophet(); s.prophet.promotionWeek = null;
    expect(projectInsightScholar(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught();
    for (const bottleId of ['prophet-potion-1', 'mysticism-magister-potion-2', 'polymath-potion-2']) reject(t, { type: 'BUY_POTION', bottleId });
    expect(t.prophet.bottles[2]!.status).toBe('SUPPLIER');
  });
  it('rejects missing action points before charging tasks, work, guidance or preparation', () => {
    const s = prophet(); s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0;
    reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.insightScholar.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.actionsRemaining = 0; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it('requires old rituals, open fragments, prepared scenes and the actual contact cloth to be closed', () => {
    const s = qualify(taught()); buy(s);
    const malformed = structuredClone(s); malformed.prophet.ritual.playerLocation = 'HALL';
    expect(validateProphetRitualState(malformed)).toBe(false);
    const fixture = JSON.parse(readFileSync('tests/fixtures/prophet-v01230/natural.json', 'utf8'));
    let openRitual = createSliceRun(fixture.final.runId, fixture.creation, fixture.seed);
    for (const intent of fixture.commands as SliceIntent[]) {
      if (intent.type === 'PROPHET' && intent.command.type === 'CONSUME') break;
      openRitual = applySliceIntent(openRitual, intent);
    }
    assertValidSliceState(openRitual); expect(hasProphetRitualLock(openRitual)).toBe(true);
    expect(insightScholarAcquisitionBlock(openRitual, { type: 'PREPARE_PROMOTION' })).toContain('旧预言家准备室');
    reject(openRitual, { type: 'PREPARE_PROMOTION' });
    s.prophet.life.playerLocation = 'QUIET_ROOM'; reject(s, { type: 'PREPARE_PROMOTION' }); s.prophet.life.playerLocation = 'OUTSIDE';
    s.prophet.life.pages.location = 'FLOOR'; reject(s, { type: 'PREPARE_PROMOTION' }); s.prophet.life.pages.location = 'TABLE';
    s.prophet.life.cases['loose-shutter'].status = 'PREPARED'; reject(s, { type: 'PREPARE_PROMOTION' }); s.prophet.life.cases['loose-shutter'].status = 'RESOLVED';
    const first = Object.values(s.mysticismMagister.cases)[0]!; first.contactOpen = true; reject(s, { type: 'PREPARE_PROMOTION' }); first.contactOpen = false;
    s.mysticismMagister.practice.dreamOpen = true; reject(s, { type: 'PREPARE_PROMOTION' }); s.mysticismMagister.practice.dreamOpen = false;
    s.mysticismMagister.practice.token = 'PLAYER'; reject(s, { type: 'PREPARE_PROMOTION' }); s.mysticismMagister.practice.token = 'OWNER';
    const oldPolymath = Object.values(s.polymath.cases)[0]!; oldPolymath.contactOpen = true; reject(s, { type: 'PREPARE_PROMOTION' }); oldPolymath.contactOpen = false;
    expect(insightScholarAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toBeNull();
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'prophet-potion-3' }, { type: 'PREPARE_TASK', taskId: 'MASS_RESONANCE' }, { type: 'LEARN_GUIDANCE', grantOmniscience: true }, { type: 'CONSUME', bottleId: 'insight-scholar-potion-1', confirmed: false }])('rejects nonexact commands%# without mutation', command => {
    expect(validateInsightScholarCommand(command)).toBe(false); expect(isInsightScholarAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects malformed shape, copied bottle provenance, duplicate preparation and forged chronology', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.insightScholar.prophetActingAtPromotion = 99; }, t => { t.insightScholar.bottles[0]!.source = 'old S4 bottle'; },
      t => { t.insightScholar.bottles[0]!.preparationWeek = t.insightScholar.bottles[0]!.preparationWeek! - 1; }, t => { t.insightScholar.bottles[1]!.id = t.insightScholar.bottles[0]!.id; },
      t => { t.insightScholar.preparations[1]!.taskId = t.insightScholar.preparations[0]!.taskId; },
      t => { t.insightScholar.preparations[0]!.completedWeek = t.week + 1; }, t => { t.insightScholar.preparedWeek = t.week; },
      t => { delete t.progression.mastery[INSIGHT_SCHOLAR_ABILITY_IDS[0]]; },
      t => { (t.insightScholar as unknown as Record<string, unknown>).life = null; },
      t => { (t.insightScholar as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateInsightScholarState(t)).not.toThrow(); expect(validateInsightScholarState(t)).toBe(false); }
  });
  it('keeps validation independent of serialized object key order', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, reorder(x)])) : v;
    expect(validateInsightScholarState(reorder(s) as SliceState)).toBe(true);
    expect(projectInsightScholar(reorder(s) as SliceState).inheritedHistory).toEqual(projectInsightScholar(s).inheritedHistory);
  });

  it('returns explicit preparation blockers without consuming the next original bottle', () => {
    const s = qualify(taught()); buy(s); s.cash = 119;
    expect(insightScholarAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('120'); reject(s, { type: 'PREPARE_PROMOTION' });
    expect(s.insightScholar.bottles[0]!.status).toBe('PLAYER');
  });
  it('prepares only the current promotion and never grants future life consent or moves an original object', () => {
    const s = taught(), scenes = structuredClone([s.insightScholar.life, s.insightScholar.encounter]);
    qualify(s); buy(s); apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.insightScholar.life, s.insightScholar.encounter]).toEqual(scenes);
    expect(s.insightScholar.preparations.map(p => p.taskId)).toEqual(['CHECK_RECORDS', 'COMPARE_METHODS', 'PLAN_EXIT']);
    reject(s, { type: 'PREPARE_TASK', taskId: 'CHECK_RECORDS' });
    reject(s, { type: 'BUY_POTION', bottleId: s.insightScholar.bottles[1]!.id });
    apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.insightScholar.life, s.insightScholar.encounter]).toEqual(scenes);
  });
  it('does not promise same-week supply, duplicate deliveries or repricing of old failed bottles', () => {
    const s = qualify(taught());
    reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; }
    apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    const pending = structuredClone(s); pending.insightScholar.resupply.requestedWeek = pending.week + 1;
    expect(validateInsightScholarState(pending)).toBe(false);
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    const before = structuredClone(s.insightScholar.bottles.slice(0, 3));
    buy(s, 3); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 3));
    expect(s.insightScholar.bottles.slice(0, 3)).toEqual(before);
    expect(validateInsightScholarState(s)).toBe(true);
    const bad = structuredClone(s); bad.insightScholar.bottles[4]!.stockedWeek = bad.insightScholar.bottles[4]!.stockedWeek! - 1;
    expect(validateInsightScholarState(bad)).toBe(false);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unavailable guidance, foreign locations and unresolved original encounters without charges', () => {
    const s = prophet(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.prophet.encounter.status = 'READY'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_RECORDS' });
    t.prophet.encounter.status = 'RESOLVED'; t.status = 'DEAD'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_RECORDS' });
    t.status = 'ACTIVE'; t.world.city = 'ELSEWHERE'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_RECORDS' });
  });

  it.each([1, 100])('delegates paid original material production without changing existing originals: roll%s', roll => {
    const s = prepared(); apply(s, dose(s));
    const originalCrafts = structuredClone(s.mysticismMagister.crafts), originalProphet = structuredClone(s.prophet), oldActing = s.progression.acting, oldMastery = structuredClone(s.progression.mastery);
    const before = { cash: s.cash, spirit: s.spirituality, actions: s.actionsRemaining, kits: s.mysticismMagister.practice.kitsUsed };
    expect(validateInsightScholarCommand({ type: 'MAKE_INHERITED_FLASH' })).toBe(true);
    expect(projectInsightScholar(s).actions.find(a => a.command.type === 'MAKE_INHERITED_FLASH')).toMatchObject({ enabled: true, cost: expect.stringContaining('160便士') });
    const c = context(s, roll); applyInsightScholarCommand(s, { type: 'MAKE_INHERITED_FLASH' }, c);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 16);
    expect([s.cash, s.spirituality, s.actionsRemaining, s.mysticismMagister.practice.kitsUsed, s.mysticismMagister.craftAttemptWeek]).toEqual([before.cash - 160, before.spirit - 4, before.actions - 1, before.kits + 1, s.week]);
    expect(s.mysticismMagister.crafts.slice(0, 2)).toEqual(originalCrafts); expect(s.prophet).toEqual(originalProphet);
    expect(s.progression.acting).toBe(oldActing); expect(s.progression.mastery).toEqual(oldMastery);
    if (roll === 1) { expect(s.mysticismMagister.crafts[2]).toMatchObject({ id: 'MM5-FLASH-4', sourceKitId: 'MM5-KIT-4', createdWeek: s.week, usedWeek: null, status: 'PLAYER' }); expect(s.mysticismMagister.crafts[2]!.power).toBeCloseTo(0.6556); }
    else expect(s.mysticismMagister.crafts).toHaveLength(2);
    const once = structuredClone(s); expect(() => applyInsightScholarCommand(s, { type: 'MAKE_INHERITED_FLASH' }, context(s))).toThrow(); expect(s).toEqual(once);
    expect(validateInsightScholarState(s)).toBe(true);
  });
  it('never manufactures an inherited original without actual old knowledge, money, spirituality or an open workstation', () => {
    const source = prepared(); apply(source, dose(source));
    const changes: ((s: SliceState) => void)[] = [s => { s.cash = 159; }, s => { s.spirituality = 3; }, s => { s.actionsRemaining = 0; }, s => { s.polymath.samples.FLASH.learnedWeek = null; }, s => { s.insightScholar.encounter.status = 'READY'; }];
    for (const change of changes) { const s = structuredClone(source); change(s); const before = structuredClone(s), c = context(s); expect(() => applyInsightScholarCommand(s, { type: 'MAKE_INHERITED_FLASH' }, c)).toThrow(); expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); }
    expect(validateInsightScholarCommand({ type: 'MAKE_INHERITED_FLASH', free: true })).toBe(false);
  });
});
