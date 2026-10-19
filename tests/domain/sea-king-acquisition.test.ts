import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { hasCataclysmPriestRitualLock, validateCataclysmPriestRitualState } from '../../src/domain/cataclysm-priest/ritual.js';
import { applySeaKingAcquisition, applySeaKingCommand, createSeaKingState, hasSeaKingLock, isSeaKingAcquisitionCommand, projectSeaKing, validateSeaKingCommand, validateSeaKingState, seaKingAcquisitionBlock } from '../../src/domain/sea-king/index.js';
import { SEA_KING_CONSUMPTION_RISK, SEA_KING_FORMULA_STATUS, SEA_KING_PRICES, SEA_KING_SOURCE_STATUS } from '../../src/domain/sea-king/content.js';
import { SEA_KING_ABILITY_IDS, SEA_KING_PREPARATION_IDS, type SeaKingAcquisitionCommand } from '../../src/domain/sea-king/types.js';

/** Genuine 345-command cataclysm-priest-v01240 end-state; later time/resources are explicit unit setup, never natural-play evidence. */
function cataclysmPriest(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/cataclysm-priest-v01240/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.seaKing = createSeaKingState();
  s.week = Math.max(s.week, s.cataclysmPriest.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: SeaKingAcquisitionCommand, roll = 1) { const c = context(s, roll); applySeaKingAcquisition(s, command, c); return c; }
function taught(s = cataclysmPriest()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of SEA_KING_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.seaKing.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.seaKing.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applySeaKingAcquisition(s, command as SeaKingAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Sea King S3 original bottles and explicitly G professional preparation', () => {
  it('reads the genuine345-command living W90 baseline without treating unit boosts as natural play', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/cataclysm-priest-v01240/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(345); expect(fixture.seed).toBe('sailor-natural-v026'); expect(fixture.seed).toBe(fixture.final.random.seed);
    expect(fixture.final).toMatchObject({ week: 90, status: 'ACTIVE', cash: 590, actionsRemaining: 1, health: 100, mind: 100, spirituality: 110, character: { age: 26, gender: 'FEMALE', coreStats: { physique: 32, perception: 25, will: 25, knowledge: 19 } }, cataclysmPriest: { promotionWeek: 84 }, progression: { sequence: 4, acting: 100 } });
    const state = migrateSliceState(fixture.final); expect(validateSeaKingState(state)).toBe(true);
    expect([state.sailor, state.rager, state.navigator, state.windBlessed, state.oceanSinger, state.cataclysmPriest]).toEqual([fixture.final.sailor, fixture.final.rager, fixture.final.navigator, fixture.final.windBlessed, fixture.final.oceanSinger, fixture.final.cataclysmPriest]);
    expect(projectSeaKing(state).digestion).toContain('6/12');
  });
  it('creates independent originals and hides the source before tyrant S4', () => {
    const s = createSliceRun('sea-king-hidden', sliceDefaultCreationSelection, 'sea-king-hidden');
    expect(validateSeaKingState(s)).toBe(true);
    expect(projectSeaKing(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '', resources: null });
    expect(projectSeaKing(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createSeaKingState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'CHECK_CHART', completedWeek: 1 });
    expect(s.seaKing.bottles[0]!.labourSteps).toBe(0); expect(s.seaKing.preparations).toEqual([]);
  });
  it('does not open this S3 channel for any other pathway or unsupported tyrant sequence', () => {
    const s = cataclysmPriest();
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'sun', 'death', 'door', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const other = structuredClone(s); other.progression.pathwayId = pathwayId;
      expect(projectSeaKing(other).discovered).toBe(false); expect(projectSeaKing(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
    const forgedS1=cataclysmPriest(); forgedS1.progression.sequence=1;
    expect(projectSeaKing(forgedS1).actions).toEqual([]); reject(forgedS1, {type:'LEARN_GUIDANCE'});
    expect(()=>assertValidSliceState(forgedS1)).toThrow();
    for (const sequence of [9, 8, 7, 6, 5, 0]) { const other = structuredClone(s); other.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectSeaKing(other).discovered).toBe(false); }
  });
  it('charges500 and one action while separating verifiedS3 from unknown full recipe and rite', () => {
    const s = cataclysmPriest(), old = structuredClone([s.sailor, s.rager, s.navigator, s.windBlessed, s.oceanSinger, s.cataclysmPriest]);
    apply(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.sailor, s.rager, s.navigator, s.windBlessed, s.oceanSinger, s.cataclysmPriest]).toEqual(old);
    expect(SEA_KING_PRICES).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, preparation: 120 });
    expect(SEA_KING_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实'); expect(SEA_KING_FORMULA_STATUS).toContain('不复用灾难主祭的旧地震海啸');
    expect(SEA_KING_SOURCE_STATUS).toContain('第三部58章明确序列3海王'); expect(SEA_KING_SOURCE_STATUS).toContain('灾难主祭4→海王3→天灾2');
    expect(SEA_KING_SOURCE_STATUS).toContain('下一天灾2本阶段不开放'); expect(SEA_KING_SOURCE_STATUS).toContain('均为原创G');
    expect(SEA_KING_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectSeaKing(s)).toMatchObject({ title: '海王·暴君序列3（有限海域G）', formulaKnown: false, formula: [], preparations: SEA_KING_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    expect(JSON.stringify(projectSeaKing(s))).not.toContain('BLUE_CLOTH'); expect(JSON.stringify(projectSeaKing(s))).not.toContain('ONE_BELL');
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateSeaKingState(s)).toBe(true);
  });
  it('five actual bottle-specific jobs yield only that original800 price, never free preparation', () => {
    const s = taught(), b = s.seaKing.bottles[0]!, oldHistory = structuredClone(s.cataclysmPriest);
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98700, 'PLAYER', s.week]);
    expect(s.seaKing.bottles[1]!.labourSteps).toBe(0); expect(s.seaKing.preparations).toEqual([]); expect(s.seaKing.preparedWeek).toBeNull();
    expect(s.cataclysmPriest).toEqual(oldHistory); expect(validateSeaKingState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one bottle’s labour', () => {
    const s = taught(), b = s.seaKing.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6200);
    s.cash = 6199; reject(s, { type: 'BUY_POTION', bottleId: s.seaKing.bottles[1]!.id });
  });
  it('requires three distinct real professional tasks and separate current-week paid preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of SEA_KING_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId });
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.seaKing.preparations[index]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.seaKing.preparedWeek]).toEqual([cash - 120, ap - 1, s.week]);
    expect(hasSeaKingLock(s)).toBe(true); expect(projectSeaKing(s).insideCase).toBe(true); expect(validateSeaKingState(s)).toBe(true);
  });
  it('preserves the last action as a real zero-action confirmation or non-refunding exit', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 120]); reject(s, { type: 'PREPARE_PROMOTION' });
    applySeaKingCommand(s, { type: 'LEAVE_PREPARATION' }, context(s));
    expect([s.actionsRemaining, s.cash, s.seaKing.preparedWeek]).toEqual([0, cash - 120, null]);
    expect(s.seaKing.bottles[0]!.status).toBe('PLAYER'); expect(hasSeaKingLock(s)).toBe(false); reject(s, dose(s));
    expect(validateSeaKingState(s)).toBe(true);
  });
  it('requires exact independent confirmation before any result draw', () => {
    const s = prepared();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }]) {
      expect(validateSeaKingCommand(command)).toBe(false); reject(s, command);
    }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact tier%s while preserving original S4 history and original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), b = s.seaKing.bottles[0]!, original = structuredClone([s.sailor, s.rager, s.navigator, s.windBlessed, s.oceanSinger, s.cataclysmPriest]);
    const oldMastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender, tasks = structuredClone(s.seaKing.preparations);
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.seaKing.preparedWeek).toBeNull();
    expect([s.sailor, s.rager, s.navigator, s.windBlessed, s.oceanSinger, s.cataclysmPriest]).toEqual(original);
    expect(s.seaKing.preparations).toEqual(tasks); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) {
      expect(s.seaKing.cataclysmPriestActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(SEA_KING_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
      expect(projectSeaKing(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateSeaKingState(s)).toBe(true); reject(s, dose(s));
  });
  it('floors only guided potion rejection to1 and never reopens a dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    expect(validateSeaKingState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('keeps the failed bottle consumed, requires paid re-preparation, and permits recovery then retry', () => {
    const s = prepared(); apply(s, dose(s), 100);
    const first = structuredClone(s.seaKing.bottles[0]), oldHistory = structuredClone(s.cataclysmPriest), tasks = structuredClone(s.seaKing.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100;
    const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 120, ap - 1]); apply(s, dose(s, 1));
    expect(s.seaKing.bottles[0]).toEqual(first); expect(s.cataclysmPriest).toEqual(oldHistory); expect(s.seaKing.preparations).toEqual(tasks);
    expect(validateSeaKingState(s)).toBe(true);
  });
  it('retains all failed originals and waits a true week for a new priced batch', () => {
    const s = qualify(taught());
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const originals = structuredClone(s.seaKing.bottles), oldHistory = structuredClone(s.cataclysmPriest), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.seaKing.bottles.slice(0, 3)).toEqual(originals); expect(s.seaKing.bottles).toHaveLength(6);
    expect(s.seaKing.bottles[3]).toMatchObject({ id: 'sea-king-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(s.cataclysmPriest).toEqual(oldHistory);
    expect(projectSeaKing(s).actions.find(a => a.id === 'buy-sea-king-potion-4')!.cost).toContain('6200便士');
    expect(validateSeaKingState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, vitality and stale preparation before drawing', () => {
    const s = prepared();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.cataclysmPriest.promotionWeek; s.cataclysmPriest.promotionWeek = s.week - 11; reject(s, dose(s)); s.cataclysmPriest.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateSeaKingState(s)).toBe(false);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(s.seaKing.preparedWeek).toBeNull();
  });
  it('measures twelve full weeks from actual cataclysm priest promotionW84 rather than original sailorW7', () => {
    const s = qualify(taught()); buy(s); expect(s.cataclysmPriest.promotionWeek).toBe(84); expect(s.progression.promotionWeek).toBe(7);
    s.week = 92; expect(seaKingAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    expect(projectSeaKing(s).digestion).toContain('8/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 95; reject(s, { type: 'PREPARE_PROMOTION' }); s.week = 96; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.seaKing.preparedWeek).toBe(96); expect(s.progression.promotionWeek).toBe(7);
  });
  it('lets an alive depleted character cancel at zero actions without healing, refund or a result draw', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.seaKing.bottles), old = structuredClone(s.cataclysmPriest);
    reject(s, dose(s));
    expect(projectSeaKing(s).actions.find(a => a.command.type === 'LEAVE_PREPARATION')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect(c.check).not.toHaveBeenCalled(); expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.seaKing.bottles).toEqual(bottles); expect(s.cataclysmPriest).toEqual(old); expect(hasSeaKingLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateSeaKingState(s)).toBe(true);
  });
  it.each([1, 100])('leaves the real preparation scene after consumption%s even with no remaining actions', roll => {
    const s = prepared(); s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(s.seaKing.preparedWeek).toBeNull(); expect(hasSeaKingLock(s)).toBe(false);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('沿原出口实际离开'));
    expect(projectSeaKing(s).insideCase).toBe(false); expect(validateSeaKingState(s)).toBe(true);
  });
  it('preserves dead Benedict, all original seawater objects and the same female body acrossS3', () => {
    const s = prepared(), history = structuredClone(s.combatHistory), injuries = structuredClone(s.injuries), town = structuredClone(s.town);
    const originalPromotion = s.progression.promotionWeek, random = structuredClone(s.random);
    expect(s.cataclysmPriest.encounter.enemy).toMatchObject({ id: 'CP4-BENEDICT', health: 0, mind: 100, status: 'DEAD', weaponId: 'CP4-BENEDICT-CLUB', weaponLocation: 'QUAY' });
    expect(s.cataclysmPriest.life).toMatchObject({ float: { location: 'BANK' }, rope: { durability: 90 }, tarp: { deployed: false }, tray: { capturedUnits: 1 }, stone: { scorchMarks: 1 } });
    expect(s.cataclysmPriest.ritual.visits[0]!.site).toMatchObject({ gauge: 'BROKEN', lowerWalkway: 'WASHED_OUT' });
    const originals = structuredClone([s.sailor, s.rager, s.navigator, s.windBlessed, s.oceanSinger, s.cataclysmPriest]), newScenes = structuredClone([s.seaKing.life, s.seaKing.encounter]);
    apply(s, dose(s)); expect(s.combatHistory).toEqual(history); expect(s.injuries).toEqual(injuries); expect(s.town).toEqual(town);
    expect(s.progression.promotionWeek).toBe(originalPromotion); expect(s.random).toEqual(random); expect(s.character.gender).toBe('FEMALE');
    expect([s.sailor, s.rager, s.navigator, s.windBlessed, s.oceanSinger, s.cataclysmPriest]).toEqual(originals); expect([s.seaKing.life, s.seaKing.encounter]).toEqual(newScenes);
    const visible = projectSeaKing(s).inheritedHistory.join(' ');
    expect(visible).toContain('健康0/100、精神100/100'); expect(visible).toContain('已死亡，不会复活'); expect(visible).toContain('原码头QUAY地面');
    expect(visible).toContain('CP4-FLOAT仍在BANK'); expect(visible).toContain('CP4-ROPE耐久90'); expect(visible).toContain('CP4-TRAY实存1水单位');
    expect(visible).toContain('CP4-STONE保留1处焦痕'); expect(visible).toContain('BROKEN'); expect(visible).toContain('WASHED_OUT');
  });
  it('rejects guidance without the actual S4 promotion and cannot borrow any old material batch', () => {
    const s = cataclysmPriest(); s.cataclysmPriest.promotionWeek = null;
    expect(projectSeaKing(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught();
    for (const bottleId of ['cataclysm-priest-potion-1', 'ocean-singer-potion-2', 'wind-blessed-potion-2']) reject(t, { type: 'BUY_POTION', bottleId });
    expect(t.cataclysmPriest.bottles[2]!.status).toBe('SUPPLIER');
  });
  it('rejects missing action points before charging tasks, work, guidance or preparation', () => {
    const s = cataclysmPriest(); s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0;
    reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_CHART' }); reject(t, { type: 'POTION_WORK', bottleId: t.seaKing.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.actionsRemaining = 0; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it('requires old rituals and prepared or open original scenes to close while allowing the real completed ridge', { tags: ['historical-replay'] }, () => {
    const s = qualify(taught()); buy(s);
    expect(s.cataclysmPriest.ritual.playerLocation).toBe('RIDGE'); expect(s.cataclysmPriest.ritual.activeVisitId).toBeNull();
    expect(seaKingAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toBeNull();
    const malformed = structuredClone(s); malformed.cataclysmPriest.ritual.playerLocation = 'PLATFORM'; expect(validateCataclysmPriestRitualState(malformed)).toBe(false);
    const fixture = JSON.parse(readFileSync('tests/fixtures/cataclysm-priest-v01240/natural.json', 'utf8'));
    let openRitual = createSliceRun(fixture.final.runId, fixture.creation, fixture.seed);
    for (const intent of fixture.commands as SliceIntent[]) { if (intent.type === 'CATACLYSM_PRIEST' && intent.command.type === 'CONSUME') break; openRitual = applySliceIntent(openRitual, intent); }
    assertValidSliceState(openRitual); expect(hasCataclysmPriestRitualLock(openRitual)).toBe(true); reject(openRitual, { type: 'PREPARE_PROMOTION' });
    const changes: ((state: SliceState) => void)[] = [
      t => { t.cataclysmPriest.life.playerLocation = 'SHORE'; }, t => { t.cataclysmPriest.life.float.location = 'MARK'; },
      t => { t.cataclysmPriest.life.cases['sea-eddy'].status = 'PREPARED'; }, t => { t.oceanSinger.practice.songOpen = true; },
      t => { t.oceanSinger.practice.allyPosition = 'SHELTER'; }, t => { Object.values(t.oceanSinger.cases)[0]!.status = 'PREPARED'; },
      t => { Object.values(t.windBlessed.cases)[0]!.contactOpen = true; }, t => { t.cataclysmPriest.ritual.activeVisitId = 'CP4-RITUAL-1'; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'cataclysm-priest-potion-3' }, { type: 'PREPARE_TASK', taskId: 'MASS_RESONANCE' }, { type: 'LEARN_GUIDANCE', grantOmniscience: true }, { type: 'CONSUME', bottleId: 'sea-king-potion-1', confirmed: false }])('rejects nonexact commands%# without mutation', command => {
    expect(validateSeaKingCommand(command)).toBe(false); expect(isSeaKingAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects malformed shape, copied bottle provenance, duplicate preparation and forged chronology', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.seaKing.cataclysmPriestActingAtPromotion = 99; }, t => { t.seaKing.bottles[0]!.source = 'old S4 bottle'; },
      t => { t.seaKing.bottles[0]!.preparationWeek = t.seaKing.bottles[0]!.preparationWeek! - 1; }, t => { t.seaKing.bottles[1]!.id = t.seaKing.bottles[0]!.id; },
      t => { t.seaKing.preparations[1]!.taskId = t.seaKing.preparations[0]!.taskId; },
      t => { t.seaKing.preparations[0]!.completedWeek = t.week + 1; }, t => { t.seaKing.preparedWeek = t.week; },
      t => { delete t.progression.mastery[SEA_KING_ABILITY_IDS[0]]; },
      t => { (t.seaKing as unknown as Record<string, unknown>).life = null; },
      t => { (t.seaKing as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateSeaKingState(t)).not.toThrow(); expect(validateSeaKingState(t)).toBe(false); }
  });
  it('keeps validation independent of serialized object key order', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, reorder(x)])) : v;
    expect(validateSeaKingState(reorder(s) as SliceState)).toBe(true);
    expect(projectSeaKing(reorder(s) as SliceState).inheritedHistory).toEqual(projectSeaKing(s).inheritedHistory);
  });

  it('returns explicit preparation blockers without consuming the next original bottle', () => {
    const s = qualify(taught()); buy(s); s.cash = 119;
    expect(seaKingAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('120'); reject(s, { type: 'PREPARE_PROMOTION' });
    expect(s.seaKing.bottles[0]!.status).toBe('PLAYER');
  });
  it('prepares only the current promotion and never grants future life consent or moves an original object', () => {
    const s = taught(), scenes = structuredClone([s.seaKing.life, s.seaKing.encounter]);
    qualify(s); buy(s); apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.seaKing.life, s.seaKing.encounter]).toEqual(scenes);
    expect(s.seaKing.preparations.map(p => p.taskId)).toEqual(['CHECK_CHART', 'SET_BOUNDARY', 'PLAN_RETURN']);
    reject(s, { type: 'PREPARE_TASK', taskId: 'CHECK_CHART' });
    reject(s, { type: 'BUY_POTION', bottleId: s.seaKing.bottles[1]!.id });
    apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.seaKing.life, s.seaKing.encounter]).toEqual(scenes);
  });
  it('does not promise same-week supply, duplicate deliveries or repricing of old failed bottles', () => {
    const s = qualify(taught());
    reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; }
    apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    const pending = structuredClone(s); pending.seaKing.resupply.requestedWeek = pending.week + 1;
    expect(validateSeaKingState(pending)).toBe(false);
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    const before = structuredClone(s.seaKing.bottles.slice(0, 3));
    buy(s, 3); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 3));
    expect(s.seaKing.bottles.slice(0, 3)).toEqual(before);
    expect(validateSeaKingState(s)).toBe(true);
    const bad = structuredClone(s); bad.seaKing.bottles[4]!.stockedWeek = bad.seaKing.bottles[4]!.stockedWeek! - 1;
    expect(validateSeaKingState(bad)).toBe(false);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unavailable guidance, foreign locations and unresolved original encounters without charges', () => {
    const s = cataclysmPriest(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.cataclysmPriest.encounter.status = 'READY'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_CHART' });
    t.cataclysmPriest.encounter.status = 'RESOLVED'; t.status = 'DEAD'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_CHART' });
    t.status = 'ACTIVE'; t.world.city = 'ELSEWHERE'; reject(t, { type: 'PREPARE_TASK', taskId: 'CHECK_CHART' });
  });

  it('never imports the unrelated reader crafting command or grants a free artifact or creature inventory', () => {
    const s = prepared(); apply(s, dose(s));
    for (const command of [{ type: 'MAKE_INHERITED_FLASH' }, { type: 'CREATE_CREATURES' }, { type: 'GRANT_SCEPTER' }, { type: 'READ_ALL_HISTORY' }]) expect(validateSeaKingCommand(command)).toBe(false);
    expect(projectSeaKing(s).actions.some(action => (action.command as { type: string }).type === 'MAKE_INHERITED_FLASH')).toBe(false);
    expect(Object.keys(s.seaKing).sort()).toEqual(['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'cataclysmPriestActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter'].sort());
  });
});
