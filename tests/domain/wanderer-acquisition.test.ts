import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyWandererAcquisition, applyWandererCommand, createWandererState, hasWandererLock, isWandererAcquisitionCommand, projectWanderer, validateWandererCommand, validateWandererState, wandererAcquisitionBlock } from '../../src/domain/wanderer/index.js';
import { WANDERER_CONSUMPTION_RISK, WANDERER_FORMULA_STATUS, WANDERER_PRICES, WANDERER_SOURCE_STATUS } from '../../src/domain/wanderer/content.js';
import { WANDERER_ABILITY_IDS, WANDERER_PREPARATION_IDS, type WandererAcquisitionCommand } from '../../src/domain/wanderer/types.js';

/** The original explicitly directed S4 start plus its 60 public commands. Later resource edits are unit setup, never natural-play evidence. */
function secretsSorcerer(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/secrets-sorcerer-v01270/directed.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.wanderer = createWandererState();
  s.week = Math.max(s.week, s.secretsSorcerer.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 30;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: WandererAcquisitionCommand, roll = 1) { const c = context(s, roll); applyWandererAcquisition(s, command, c); return c; }
function taught(s = secretsSorcerer()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of WANDERER_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const b = s.wanderer.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.wanderer.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyWandererAcquisition(s, command as WandererAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Wanderer S3 original bottles and explicitly G professional preparation', () => {
  it('reads the explicitly directed original S4 plus60-command living W92 baseline without calling it natural promotion', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/secrets-sorcerer-v01270/directed.json', 'utf8'));
    expect(fixture.commands).toHaveLength(60); expect(fixture.provenance.kind).toBe('DIRECTED_PROMOTION_THEN_PUBLIC_COMMANDS');
    expect(fixture.provenance.originalRandom).toEqual({ seed: 'apprentice-natural-v035', cursor: 219 });
    expect(fixture.provenance.directedRandom).toEqual({ seed: 'secrets-sorcerer-directed-24', cursor: 0 });
    expect(fixture.final).toMatchObject({ week: 92, status: 'ACTIVE', cash: 560, actionsRemaining: 3, health: 40, mind: 100, spirituality: 120, secretsSorcerer: { promotionWeek: 80 }, progression: { sequence: 4, acting: 100 } });
    const state = migrateSliceState(fixture.final); expect(validateWandererState(state)).toBe(true);
    for (const key of ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer'] as const) expect(state[key]).toEqual(fixture.final[key]);
    expect(projectWanderer(state).digestion).toContain('12/12');
  });
  it('creates independent originals and hides the source before Door S4', () => {
    const s = createSliceRun('wanderer-hidden', sliceDefaultCreationSelection, 'wanderer-hidden');
    expect(validateWandererState(s)).toBe(true);
    expect(projectWanderer(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], supplies: '', resources: null });
    expect(projectWanderer(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createWandererState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'VERIFY_DESTINATION', completedWeek: 1 });
    expect(s.wanderer.bottles[0]!.labourSteps).toBe(0); expect(s.wanderer.preparations).toEqual([]);
  });
  it('does not open this S3 channel for any other pathway or unsupported Door sequence', () => {
    const s = secretsSorcerer();
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'error', 'warrior', 'demoness', 'hermit', 'hanged-man', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar', 'mother'] as const) {
      const other = structuredClone(s); other.progression.pathwayId = pathwayId;
      expect(projectWanderer(other).discovered).toBe(false); expect(projectWanderer(other).actions).toEqual([]); reject(other, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 1, 0]) { const other = structuredClone(s); other.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectWanderer(other).discovered).toBe(false); }
    const inherited = structuredClone(s); inherited.progression.sequence = 2;
    expect(projectWanderer(inherited).discovered).toBe(true);
    reject(inherited, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action while separating verifiedS3 from unknown full recipe and rite', () => {
    const s = secretsSorcerer(), old = structuredClone([s.apprentice, s.trickmaster, s.astrologer, s.recorder, s.traveler, s.secretsSorcerer]);
    apply(s, { type: 'LEARN_GUIDANCE' }); expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]);
    expect([s.apprentice, s.trickmaster, s.astrologer, s.recorder, s.traveler, s.secretsSorcerer]).toEqual(old);
    expect(WANDERER_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    expect(WANDERER_FORMULA_STATUS).toContain('完整配方与晋升仪式尚未核实'); expect(WANDERER_FORMULA_STATUS).toContain('不复用秘法师4的旧敌意半神封印仪式');
    expect(WANDERER_SOURCE_STATUS).toContain('第五部第130章'); expect(WANDERER_SOURCE_STATUS).toContain('第七部第68章');
    expect(WANDERER_SOURCE_STATUS).toContain('第六部第58章'); expect(WANDERER_SOURCE_STATUS).toContain('均为原创G');
    expect(WANDERER_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectWanderer(s)).toMatchObject({ title: '漫游者·门序列3（有限离世往返G）', formulaKnown: false, formula: [], preparations: WANDERER_PREPARATION_IDS.map(taskId => ({ taskId, completedWeek: null })) });
    expect(JSON.stringify(projectWanderer(s))).not.toContain('sourceEpoch');
    reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateWandererState(s)).toBe(true);
  });
  it('five actual bottle-specific jobs yield only that original900 price, never free preparation', () => {
    const s = taught(), b = s.wanderer.bottles[0]!, oldHistory = structuredClone(s.secretsSorcerer);
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status, b.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.wanderer.bottles[1]!.labourSteps).toBe(0); expect(s.wanderer.preparations).toEqual([]); expect(s.wanderer.preparedWeek).toBeNull();
    expect(s.secretsSorcerer).toEqual(oldHistory); expect(validateWandererState(s)).toBe(true); reject(s, { type: 'BUY_POTION', bottleId: b.id });
  });
  it('does not partially discount or transfer one bottle’s labour', () => {
    const s = taught(), b = s.wanderer.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: b.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.wanderer.bottles[1]!.id });
  });
  it('requires three distinct real professional tasks and separate current-week paid preparation', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of WANDERER_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId });
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.wanderer.preparations[index]).toEqual({ taskId, completedWeek: s.week });
      reject(s, { type: 'PREPARE_TASK', taskId });
      if (index < 2) reject(s, { type: 'PREPARE_PROMOTION' });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.cash, s.actionsRemaining, s.wanderer.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasWandererLock(s)).toBe(true); expect(projectWanderer(s).insideCase).toBe(true); expect(validateWandererState(s)).toBe(true);
  });
  it('preserves the last action as a real zero-action confirmation or non-refunding exit', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1;
    const week = s.week, cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]); reject(s, { type: 'PREPARE_PROMOTION' });
    applyWandererCommand(s, { type: 'LEAVE_PREPARATION' }, context(s));
    expect([s.actionsRemaining, s.cash, s.wanderer.preparedWeek]).toEqual([0, cash - 140, null]);
    expect(s.wanderer.bottles[0]!.status).toBe('PLAYER'); expect(hasWandererLock(s)).toBe(false); reject(s, dose(s));
    expect(validateWandererState(s)).toBe(true);
  });
  it('requires exact independent confirmation before any result draw', () => {
    const s = prepared();
    for (const command of [{ type: 'CONSUME', bottleId: dose(s).bottleId }, { ...dose(s), confirmed: false }, { ...dose(s), acceptBodyChange: true }]) {
      expect(validateWandererCommand(command)).toBe(false); reject(s, command);
    }
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles exact tier%s while preserving original S4 history and original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), b = s.wanderer.bottles[0]!, original = structuredClone([s.apprentice, s.trickmaster, s.astrologer, s.recorder, s.traveler, s.secretsSorcerer]);
    const oldMastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, gender = s.character.gender, tasks = structuredClone(s.wanderer.preparations);
    s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(b).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.wanderer.preparedWeek).toBeNull();
    expect([s.apprentice, s.trickmaster, s.astrologer, s.recorder, s.traveler, s.secretsSorcerer]).toEqual(original);
    expect(s.wanderer.preparations).toEqual(tasks); expect(s.character.gender).toBe(gender);
    for (const [id, value] of Object.entries(oldMastery)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 3) {
      expect(s.wanderer.secretsSorcererActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(WANDERER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
      expect(projectWanderer(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateWandererState(s)).toBe(true); reject(s, dose(s));
  });
  it('floors only guided potion rejection to1 and never reopens a dead run', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100);
    expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    expect(validateWandererState(s)).toBe(true);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead));
  });
  it('keeps the failed bottle consumed, requires paid re-preparation, and permits recovery then retry', () => {
    const s = prepared(); apply(s, dose(s), 100);
    const first = structuredClone(s.wanderer.bottles[0]), oldHistory = structuredClone(s.secretsSorcerer), tasks = structuredClone(s.wanderer.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100;
    const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 140, ap - 1]); apply(s, dose(s, 1));
    expect(s.wanderer.bottles[0]).toEqual(first); expect(s.secretsSorcerer).toEqual(oldHistory); expect(s.wanderer.preparations).toEqual(tasks);
    expect(validateWandererState(s)).toBe(true);
  });
  it('retains all failed originals and waits a true week for a new priced batch', () => {
    const s = qualify(taught());
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const originals = structuredClone(s.wanderer.bottles), oldHistory = structuredClone(s.secretsSorcerer), ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.wanderer.bottles.slice(0, 3)).toEqual(originals); expect(s.wanderer.bottles).toHaveLength(6);
    expect(s.wanderer.bottles[3]).toMatchObject({ id: 'wanderer-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(s.secretsSorcerer).toEqual(oldHistory);
    expect(projectWanderer(s).actions.find(a => a.id === 'buy-wanderer-potion-4')!.cost).toContain('6400便士');
    expect(validateWandererState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('checks prior digestion, twelve full weeks, vitality and stale preparation before drawing', () => {
    const s = prepared();
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100;
    const oldPromotion = s.secretsSorcerer.promotionWeek; s.secretsSorcerer.promotionWeek = s.week - 11; reject(s, dose(s)); s.secretsSorcerer.promotionWeek = oldPromotion;
    s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateWandererState(s)).toBe(false);
    apply(s, { type: 'LEAVE_PREPARATION' }); expect(s.wanderer.preparedWeek).toBeNull();
  });
  it('measures twelve full weeks from actual secrets-sorcerer promotionW80 rather than original apprenticeW5', () => {
    const s = qualify(taught()); buy(s); expect(s.secretsSorcerer.promotionWeek).toBe(80); expect(s.progression.promotionWeek).toBe(5);
    s.week = 88; expect(wandererAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('8/12');
    expect(projectWanderer(s).digestion).toContain('8/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = 91; reject(s, { type: 'PREPARE_PROMOTION' }); s.week = 92; apply(s, { type: 'PREPARE_PROMOTION' });
    expect(s.wanderer.preparedWeek).toBe(92); expect(s.progression.promotionWeek).toBe(5);
  });
  it('lets an alive depleted character cancel at zero actions without healing, refund or a result draw', () => {
    const s = prepared(); s.actionsRemaining = 0; s.health = 1; s.mind = 1;
    const cash = s.cash, spirit = s.spirituality, bottles = structuredClone(s.wanderer.bottles), old = structuredClone(s.secretsSorcerer);
    reject(s, dose(s));
    expect(projectWanderer(s).actions.find(a => a.command.type === 'LEAVE_PREPARATION')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect(c.check).not.toHaveBeenCalled(); expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, spirit, cash, 0]);
    expect(s.wanderer.bottles).toEqual(bottles); expect(s.secretsSorcerer).toEqual(old); expect(hasWandererLock(s)).toBe(false);
    reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateWandererState(s)).toBe(true);
  });
  it.each([1, 100])('leaves the real preparation scene after consumption%s even with no remaining actions', roll => {
    const s = prepared(); s.actionsRemaining = 0; const c = apply(s, dose(s), roll);
    expect(s.wanderer.preparedWeek).toBeNull(); expect(hasWandererLock(s)).toBe(false);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('沿原出口实际离开'));
    expect(projectWanderer(s).insideCase).toBe(false); expect(validateWandererState(s)).toBe(true);
  });
  it('preserves sealed original A, living injured B, actual records and original pocket objects across S3', () => {
    const s = prepared(), history = structuredClone(s.combatHistory), injuries = structuredClone(s.injuries), town = structuredClone(s.town);
    const originalPromotion = s.progression.promotionWeek, random = structuredClone(s.random);
    expect(s.secretsSorcerer.ritual.phase).toBe('CLOSED');
    expect(s.secretsSorcerer.ritual.targets.find(target => target.id === 'SS4-ARCH-A')).toMatchObject({ status: 'SEALED' });
    expect(s.secretsSorcerer.ritual.targets.find(target => target.id === 'SS4-ARCH-B')).toMatchObject({ status: 'LEFT_ALIVE' });
    const originals = structuredClone([s.apprentice, s.trickmaster, s.astrologer, s.recorder, s.traveler, s.secretsSorcerer]), newScenes = structuredClone([s.wanderer.life, s.wanderer.encounter]);
    apply(s, dose(s)); expect(s.combatHistory).toEqual(history); expect(s.injuries).toEqual(injuries); expect(s.town).toEqual(town);
    expect(s.progression.promotionWeek).toBe(originalPromotion); expect(s.random).toEqual(random); expect(s.character.gender).toBe('FEMALE');
    expect([s.apprentice, s.trickmaster, s.astrologer, s.recorder, s.traveler, s.secretsSorcerer]).toEqual(originals); expect([s.wanderer.life, s.wanderer.encounter]).toEqual(newScenes);
    expect(s.progression.mastery['door.s4.space-pocket']).toBe(0);
    const visible = projectWanderer(s).inheritedHistory.join(' ');
    expect(visible).toContain('SS4-BEAST-A'); expect(visible).toContain('SEALED'); expect(visible).toContain('SS4-BEAST-B'); expect(visible).toContain('LEFT_ALIVE');
    expect(visible).toContain('SS4-BAG-1'); expect(visible).toContain('SS4-SEALED-STONE-1'); expect(visible).toContain('ARCHIVE');
  });
  it('rejects guidance without the actual S4 promotion and cannot borrow any old material batch', () => {
    const s = secretsSorcerer(); s.secretsSorcerer.promotionWeek = null;
    expect(projectWanderer(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught();
    for (const bottleId of ['secrets-sorcerer-potion-1', 'traveler-potion-2', 'recorder-potion-2']) reject(t, { type: 'BUY_POTION', bottleId });
    expect(t.secretsSorcerer.bottles[0]!.status).toBe('CONSUMED');
  });
  it('rejects missing action points before charging tasks, work, guidance or preparation', () => {
    const s = secretsSorcerer(); s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0;
    reject(t, { type: 'PREPARE_TASK', taskId: 'VERIFY_DESTINATION' }); reject(t, { type: 'POTION_WORK', bottleId: t.wanderer.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.actionsRemaining = 0; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it('blocks open old ritual, hidden body, live pocket link and all older prepared scenes', () => {
    const s = qualify(taught()); buy(s); expect(s.secretsSorcerer.ritual.phase).toBe('CLOSED');
    expect(wandererAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toBeNull();
    const changes: ((state: SliceState) => void)[] = [
      t => { t.secretsSorcerer.ritual.phase = 'SEALED'; }, t => { t.secretsSorcerer.life.room.position = 'INSIDE'; },
      t => { t.secretsSorcerer.life.room.hidden = true; }, t => { t.secretsSorcerer.life.pocket.linked = true; },
      t => { t.secretsSorcerer.life.pocket.mode = 'ORDINARY'; }, t => { t.secretsSorcerer.life.cases['original-pocket'].suspended = true; },
      t => { t.secretsSorcerer.life.banishment.location = 'AWAY'; }, t => { t.secretsSorcerer.life.banishment.restrained = true; },
      t => { t.secretsSorcerer.life.cases['hidden-room'].status = 'PREPARED'; }, t => { t.traveler.practice.consent = true; },
      t => { Object.values(t.apprentice.cases)[0]!.position = 'INSIDE'; }, t => { Object.values(t.recorder.cases)[0]!.status = 'PREPARED'; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'BUY_POTION', bottleId: 'secretsSorcerer-potion-3' }, { type: 'PREPARE_TASK', taskId: 'MASS_RESONANCE' }, { type: 'LEARN_GUIDANCE', grantOmniscience: true }, { type: 'CONSUME', bottleId: 'wanderer-potion-1', confirmed: false }])('rejects nonexact commands%# without mutation', command => {
    expect(validateWandererCommand(command)).toBe(false); expect(isWandererAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects malformed shape, copied bottle provenance, duplicate preparation and forged chronology', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.wanderer.secretsSorcererActingAtPromotion = 99; }, t => { t.wanderer.bottles[0]!.source = 'old S4 bottle'; },
      t => { t.wanderer.bottles[0]!.preparationWeek = t.wanderer.bottles[0]!.preparationWeek! - 1; }, t => { t.wanderer.bottles[1]!.id = t.wanderer.bottles[0]!.id; },
      t => { t.wanderer.preparations[1]!.taskId = t.wanderer.preparations[0]!.taskId; },
      t => { t.wanderer.preparations[0]!.completedWeek = t.week + 1; }, t => { t.wanderer.preparedWeek = t.week; },
      t => { delete t.progression.mastery[WANDERER_ABILITY_IDS[0]]; },
      t => { (t.wanderer as unknown as Record<string, unknown>).life = null; },
      t => { (t.wanderer as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateWandererState(t)).not.toThrow(); expect(validateWandererState(t)).toBe(false); }
  });
  it('keeps validation independent of serialized object key order', () => {
    const s = prepared(); apply(s, dose(s));
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, reorder(x)])) : v;
    expect(validateWandererState(reorder(s) as SliceState)).toBe(true);
    expect(projectWanderer(reorder(s) as SliceState).inheritedHistory).toEqual(projectWanderer(s).inheritedHistory);
  });

  it('returns explicit preparation blockers without consuming the next original bottle', () => {
    const s = qualify(taught()); buy(s); s.cash = 139;
    expect(wandererAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('140'); reject(s, { type: 'PREPARE_PROMOTION' });
    expect(s.wanderer.bottles[0]!.status).toBe('PLAYER');
  });
  it('prepares only the current promotion and never grants future life consent or moves an original object', () => {
    const s = taught(), scenes = structuredClone([s.wanderer.life, s.wanderer.encounter]);
    qualify(s); buy(s); apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.wanderer.life, s.wanderer.encounter]).toEqual(scenes);
    expect(s.wanderer.preparations.map(p => p.taskId)).toEqual(['VERIFY_DESTINATION', 'CHECK_PROTECTION', 'PLAN_RETURN']);
    reject(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_DESTINATION' });
    reject(s, { type: 'BUY_POTION', bottleId: s.wanderer.bottles[1]!.id });
    apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.wanderer.life, s.wanderer.encounter]).toEqual(scenes);
  });
  it('does not promise same-week supply, duplicate deliveries or repricing of old failed bottles', () => {
    const s = qualify(taught());
    reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; }
    apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    const pending = structuredClone(s); pending.wanderer.resupply.requestedWeek = pending.week + 1;
    expect(validateWandererState(pending)).toBe(false);
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    const before = structuredClone(s.wanderer.bottles.slice(0, 3));
    buy(s, 3); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 3));
    expect(s.wanderer.bottles.slice(0, 3)).toEqual(before);
    expect(validateWandererState(s)).toBe(true);
    const bad = structuredClone(s); bad.wanderer.bottles[4]!.stockedWeek = bad.wanderer.bottles[4]!.stockedWeek! - 1;
    expect(validateWandererState(bad)).toBe(false);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
  });
  it('rejects unavailable guidance, foreign locations and unresolved original encounters without charges', () => {
    const s = secretsSorcerer(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.secretsSorcerer.ritual.phase = 'SURVEYED'; reject(t, { type: 'PREPARE_TASK', taskId: 'VERIFY_DESTINATION' });
    t.secretsSorcerer.ritual.phase = 'CLOSED'; t.status = 'DEAD'; reject(t, { type: 'PREPARE_TASK', taskId: 'VERIFY_DESTINATION' });
    t.status = 'ACTIVE'; t.world.city = 'ELSEWHERE'; reject(t, { type: 'PREPARE_TASK', taskId: 'VERIFY_DESTINATION' });
  });

  it('never imports infinite survival, free records, arbitrary coordinates or angel-level rituals', () => {
    const s = prepared(); apply(s, dose(s));
    for (const command of [{ type: 'REFILL_AIR' }, { type: 'GRANT_RECORD' }, { type: 'TELEPORT_ANYWHERE' }, { type: 'NINE_PLANET_RITUAL' }, { type: 'CONCEPTUALIZE' }]) expect(validateWandererCommand(command)).toBe(false);
    expect(projectWanderer(s).actions.some(action => (action.command as { type: string }).type === 'REFILL_AIR')).toBe(false);
    expect(Object.keys(s.wanderer).sort()).toEqual(['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'secretsSorcererActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter'].sort());
  });
});
