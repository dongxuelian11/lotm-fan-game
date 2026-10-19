import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyFrenzyMageAcquisition, createFrenzyMageState, hasFrenzyMageLock, isFrenzyMageAcquisitionCommand, projectFrenzyMage, frenzyMageAcquisitionBlock, validateFrenzyMageCommand, validateFrenzyMageState } from '../../src/domain/frenzy-mage/index.js';
import { FRENZY_MAGE_CONSUMPTION_RISK, FRENZY_MAGE_FORMULA_STATUS, FRENZY_MAGE_PRICES, FRENZY_MAGE_SOURCE_STATUS } from '../../src/domain/frenzy-mage/content.js';
import { FRENZY_MAGE_ABILITY_IDS, FRENZY_MAGE_PREPARATION_IDS, type FrenzyMageAcquisitionCommand } from '../../src/domain/frenzy-mage/types.js';

const prior = () => JSON.parse(readFileSync('tests/fixtures/fallen-earl-v01360/natural.json', 'utf8'));
const roots = ['lawyer', 'barbarian', 'briber', 'corruptionBaron', 'mentorDisorder', 'fallenEarl'] as const;
/** Actual438-command baseline; resource/time edits below are isolated unit setup, never natural-play evidence. */
function fallenEarl(): SliceState {
  const s = migrateSliceState(prior().final); s.frenzyMage = createFrenzyMageState();
  s.week = Math.max(s.week, s.fallenEarl.promotionWeek! + 12); s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.seer.pollution = 0; s.character.coreStats.will = 30; return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: FrenzyMageAcquisitionCommand, roll = 1) { const c = context(s, roll); applyFrenzyMageAcquisition(s, command, c); return c; }
function taught(s = fallenEarl()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of FRENZY_MAGE_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.frenzyMage.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.frenzyMage.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const original = structuredClone(s), c = context(s);
  expect(() => applyFrenzyMageAcquisition(s, command as FrenzyMageAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(original); expect(c.check).not.toHaveBeenCalled();
}
function originals(s: SliceState, before: SliceState) { for (const root of roots) expect(s[root]).toEqual(before[root]); }

describe('FrenzyMage3 original bottles and bounded G preparation', () => {
  it('reads the actual438-command W115 baseline without rewriting RNG, original choices or the original six roots', () => {
    const capture = prior(), s = migrateSliceState(capture.final);
    expect(capture.commands).toHaveLength(438); expect(capture.seed).toBe('lawyer-natural-v063');
    expect(s).toMatchObject({ week: 115, status: 'ACTIVE', cash: 300, actionsRemaining: 2, health: 70, mind: 100, spirituality: 116, progression: { sequence: 4, acting: 100 }, random: { seed: 'lawyer-natural-v063', cursor: 184 } });
    expect(s.fallenEarl.promotionWeek).toBe(108);
    expect(s.fallenEarl.encounter).toMatchObject({ targetId: 'FE4-MARLOW-VENN', enemyStatus: 'DEAD', enemyHealth: 0, enemyMind: 100, enemySpirituality: 8, powerUses: { ARC_BOLT: 4, WARD: 1, COMPOSE: 3 } });
    expect(s.fallenEarl.encounter.enemyInjuries.map(i => i.severity)).toEqual(['LIGHT']);
    expect(s.briber.gifts).toHaveLength(15); expect(s.briber.gifts.slice(0, 10).every(g => g.location === 'GIVEN')).toBe(true);
    expect(s.briber.gifts.slice(10).every(g => g.location === 'PLAYER' && g.destination === null && g.givenWeek === null)).toBe(true);
    expect(s.fallenEarl.life.crate).toMatchObject({ id: 'FE4-CRATE-1', owner: 'GUIDE', holder: 'GUIDE', positionMetres: 0 });
    originals(s, capture.final); expect(validateFrenzyMageState(s)).toBe(true); expect(projectFrenzyMage(s).digestion).toContain('7/12');
  });
  it('creates independent originals and hides this source before actual FallenEarl4', () => {
    const s = createSliceRun('frenzy-mage-hidden', sliceDefaultCreationSelection, 'frenzy-mage-hidden');
    expect(validateFrenzyMageState(s)).toBe(true);
    expect(projectFrenzyMage(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null, inheritedTools: '' });
    expect(projectFrenzyMage(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createFrenzyMageState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'REVIEW_RECORDS', completedWeek: 1 });
    expect(s.frenzyMage.bottles[0]!.labourSteps).toBe(0); expect(s.frenzyMage.preparations).toEqual([]);
  });
  it('does not open this source for another path, an unsupported sequence, or a missing real S4 promotion', () => {
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'door', 'warrior', 'error', 'demoness', 'hanged-man', 'hermit', 'abyss', 'chained', 'wheel', 'justiciar', 'mother'] as const) {
      const s = fallenEarl(); s.progression.pathwayId = pathwayId; expect(projectFrenzyMage(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 2, 1, 0]) { const s = fallenEarl(); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectFrenzyMage(s).discovered).toBe(false); }
    const s = fallenEarl(); s.fallenEarl.promotionWeek = null; reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without turning the unknown recipe, ritual or high-level information into facts', () => {
    const s = fallenEarl(), before = structuredClone(s); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); originals(s, before);
    expect(FRENZY_MAGE_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    for (const text of ['晋升仪式尚未披露', '3狂乱法师', '直接确认', '米蕾·沃德']) expect(FRENZY_MAGE_FORMULA_STATUS).toContain(text);
    for (const text of ['L58310', 'L58322', 'L58340', 'L158935', '序列2熵之公爵', '序列1弑序亲王', '均为原创G', '属于船']) expect(FRENZY_MAGE_SOURCE_STATUS).toContain(text);
    expect(FRENZY_MAGE_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectFrenzyMage(s).formula).toEqual([]); reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateFrenzyMageState(s)).toBe(true);
  });
  it('five actual jobs reduce only that unique bottle to900 and do not pay for preparations', () => {
    const s = taught(), bottle = s.frenzyMage.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect([bottle.labourSteps, bottle.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]); reject(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s); expect([s.cash, bottle.status, bottle.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.frenzyMage.bottles[1]!.labourSteps).toBe(0); expect(s.frenzyMage.preparations).toEqual([]); expect(s.frenzyMage.preparedWeek).toBeNull();
    reject(s, { type: 'BUY_POTION', bottleId: bottle.id }); expect(validateFrenzyMageState(s)).toBe(true);
  });
  it('does not partially discount jobs, borrow an old original bottle or spend unavailable funds', () => {
    const s = taught(), bottle = s.frenzyMage.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.frenzyMage.bottles[1]!.id });
    for (const bottleId of ['fallen-earl-potion-1', 'mentor-disorder-potion-1', 'corruption-baron-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
  });
  it('requires three distinct one-action preparations and a separate current-week140 check', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of FRENZY_MAGE_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.frenzyMage.preparations[index]).toEqual({ taskId, completedWeek: s.week }); reject(s, { type: 'PREPARE_TASK', taskId });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.frenzyMage.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasFrenzyMageLock(s)).toBe(true); expect(projectFrenzyMage(s).insideCase).toBe(true); expect(validateFrenzyMageState(s)).toBe(true);
  });
  it('leaves a real zero-action nonrefunding exit after the last preparation action', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1; const cash = s.cash, week = s.week;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]);
    reject(s, { type: 'PREPARE_PROMOTION' }); s.health = 1; s.mind = 1; const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, 31, cash - 140, 0]); expect(c.check).not.toHaveBeenCalled();
    expect(s.frenzyMage.preparedWeek).toBeNull(); expect(s.frenzyMage.bottles[0]!.status).toBe('PLAYER'); expect(hasFrenzyMageLock(s)).toBe(false);
    reject(s, dose(s)); reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateFrenzyMageState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles roll%s honestly without resource refills or rewriting original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), before = structuredClone(s), bottle = s.frenzyMage.bottles[0]!; s.actionsRemaining = 0;
    const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([bottle.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(bottle).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.frenzyMage.preparedWeek).toBeNull();
    originals(s, before); expect(s.character.age).toBe(26); expect(s.character.gender).toBe('FEMALE'); expect(s.random).toEqual(before.random);
    expect(s.combatHistory).toEqual(before.combatHistory); expect(s.injuries).toEqual(before.injuries); expect(s.town).toEqual(before.town);
    expect(s.frenzyMage.life).toEqual(before.frenzyMage.life); expect(s.frenzyMage.encounter).toEqual(before.frenzyMage.encounter);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    if (sequence === 3) {
      expect(s.frenzyMage.fallenEarlActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(before.progression.mastery, id))).toEqual([...FRENZY_MAGE_ABILITY_IDS]);
      expect(s.progression.mastery['black-emperor.s3.ordered-deviation']).toBe(0);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
      expect(projectFrenzyMage(s).inheritedHistory.join(' ')).toContain('FE4-MARLOW-VENN'); expect(projectFrenzyMage(s).inheritedTools).toContain('原FE4-CRATE-1箱由GUIDE');
      expect(projectFrenzyMage(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateFrenzyMageState(s)).toBe(true); reject(s, dose(s));
  });
  it('protects only guided potion rejection and never revives a dead body', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead)); expect(validateFrenzyMageState(s)).toBe(true);
  });
  it('retains failed originals and requires another140 check for recovery and retry', () => {
    const s = prepared(); apply(s, dose(s), 100); const failed = structuredClone(s.frenzyMage.bottles[0]), tasks = structuredClone(s.frenzyMage.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100; const cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 1));
    expect(s.cash).toBe(cash - 140); expect(s.frenzyMage.bottles[0]).toEqual(failed); expect(s.frenzyMage.preparations).toEqual(tasks); expect(validateFrenzyMageState(s)).toBe(true);
  });
  it('waits an actual next week for three new priced bottles after all current originals fail', () => {
    const s = qualify(taught()); reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const bottles = structuredClone(s.frenzyMage.bottles); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.frenzyMage.bottles.slice(0, 3)).toEqual(bottles); expect(s.frenzyMage.bottles).toHaveLength(6);
    expect(s.frenzyMage.bottles[3]).toMatchObject({ id: 'frenzy-mage-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectFrenzyMage(s).actions.find(a => a.id === 'buy-frenzy-mage-potion-4')!.cost).toContain('6400'); expect(validateFrenzyMageState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('measures twelve full weeks from original FallenEarlW108, then rejects stale checks and unmet digestion', () => {
    const s = fallenEarl(); s.week = s.fallenEarl.promotionWeek! + 11; qualify(taught(s)); buy(s); const originalPromotion = s.progression.promotionWeek;
    expect(frenzyMageAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('11/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = s.fallenEarl.promotionWeek! + 12; apply(s, { type: 'PREPARE_PROMOTION' }); expect(s.progression.promotionWeek).toBe(originalPromotion);
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100; s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateFrenzyMageState(s)).toBe(false); apply(s, { type: 'LEAVE_PREPARATION' });
  });
  it('blocks unfinished old originals and practice without charging', () => {
    const s = qualify(taught()); buy(s);
    const changes: ((state: SliceState) => void)[] = [
      ...(['lawyer', 'barbarian', 'briber', 'corruptionBaron', 'mentorDisorder'] as const).flatMap(root => [
        (t: SliceState) => { Object.values(t[root].cases)[0]!.contactOpen = true; },
        (t: SliceState) => { Object.values(t[root].cases)[0]!.status = 'PREPARED'; },
      ]),
      t => { Object.values(t.fallenEarl.life.cases)[0]!.contactOpen = true; }, t => { Object.values(t.fallenEarl.life.cases)[0]!.status = 'PREPARED'; },
      t => { t.corruptionBaron.practice.clauseOrder = 'PENDING'; }, t => { t.corruptionBaron.practice.clauseOrder = 'ADJUSTED'; },
      t => { t.corruptionBaron.practice.marker = 'ROLLING'; }, t => { t.corruptionBaron.practice.marker = 'SIDE_POCKET'; },
      t => { t.corruptionBaron.practice.route = 'MOVING'; }, t => { t.corruptionBaron.practice.route = 'DIVERTED'; },
      t => { t.mentorDisorder.practice.markers = 'MIXED'; }, t => { t.mentorDisorder.practice.markers = 'COLLECTED'; },
      t => { t.mentorDisorder.practice.route = 'MARKED'; }, t => { t.mentorDisorder.practice.note = 'WRITTEN'; },
      t => { t.corruptionBaron.encounter.status = 'FIGHTING'; }, t => { t.mentorDisorder.encounter.status = 'FIGHTING'; },
      t => { t.fallenEarl.life.clerk.consented = true; }, t => { t.fallenEarl.life.clerk.effect = 'LACK_ENTHUSIASM'; },
      t => { t.fallenEarl.life.clerk.remainingSeconds = 30; }, t => { t.fallenEarl.life.crate.holder = 'FLOOR'; },
      t => { t.fallenEarl.life.crate.positionMetres = 1; }, t => { t.fallenEarl.life.pad.holder = 'FLOOR'; },
      t => { t.fallenEarl.life.pad.bodyState = 'IN_AIR_EXTENDED'; }, t => { t.fallenEarl.life.pad.remainingSeconds = 4; },
      t => { t.fallenEarl.encounter.status = 'FIGHTING'; }, t => { t.fallenEarl.encounter.bestowReady = true; },
      t => { t.fallenEarl.encounter.composureReady = true; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it('rejects unavailable guidance, foreign locations, no actions and insufficient current preparation funds', () => {
    const s = fallenEarl(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' }); s.cash = 100000; s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0; reject(t, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.frenzyMage.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.cash = 139; reject(u, { type: 'PREPARE_PROMOTION' }); u.cash = 140; u.world.city = 'ELSEWHERE'; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'ALWAYS_SUCCEED' }, { type: 'BUY_GIFTS' }, { type: 'REROLL' }, { type: 'REWRITE_HISTORY' }, { type: 'REVIVE_MARLOW' }, { type: 'SHIP_TELEPORT' }, { type: 'BUY_POTION', bottleId: 'fallen-earl-potion-1' }, { type: 'PREPARE_TASK', taskId: 'GATHER_BELIEVERS' }, { type: 'LEARN_GUIDANCE', forceConsent: true }, { type: 'CONSUME', bottleId: 'frenzy-mage-potion-1', confirmed: false }])('rejects exact unauthorized command shape%# before mutation', command => {
    expect(validateFrenzyMageCommand(command)).toBe(false); expect(isFrenzyMageAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects forged chronology, duplicated bottles or tasks, missing mastery and malformed scene data', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.frenzyMage.fallenEarlActingAtPromotion = 99; }, t => { t.frenzyMage.bottles[0]!.source = 'old original'; },
      t => { t.frenzyMage.bottles[0]!.preparationWeek = t.frenzyMage.bottles[0]!.preparationWeek! - 1; }, t => { t.frenzyMage.bottles[1]!.id = t.frenzyMage.bottles[0]!.id; },
      t => { t.frenzyMage.preparations[1]!.taskId = t.frenzyMage.preparations[0]!.taskId; }, t => { t.frenzyMage.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.frenzyMage.preparedWeek = t.week; }, t => { delete t.progression.mastery['black-emperor.s3.ordered-deviation']; },
      t => { (t.frenzyMage as unknown as Record<string, unknown>).life = null; }, t => { (t.frenzyMage as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateFrenzyMageState(t)).not.toThrow(); expect(validateFrenzyMageState(t)).toBe(false); }
  });
  it('keeps key order irrelevant and preserves actual prior choices, original objects and permanently dead Marlow', () => {
    const s = prepared(), before = structuredClone(s); apply(s, dose(s));
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorder(v)])) : value;
    expect(validateFrenzyMageState(reorder(s) as SliceState)).toBe(true);
    const history = projectFrenzyMage(s).inheritedHistory.join(' ');
    for (const text of ['FE4-MARLOW-VENN', 'DEAD', '健康0/100', '灵性8', '原伤势1处', '唯一briber.gifts', 'BR7-GIFT-10', 'BATTLE:FALLEN_EARL_DISPUTE:GROUND']) expect(history).toContain(text);
    originals(s, before); expect(s.fallenEarl.life.crate.holder).toBe('GUIDE'); expect(s.fallenEarl.life.pad).toEqual(before.fallenEarl.life.pad);
    expect(s.briber.gifts).toEqual(before.briber.gifts); expect(Object.hasOwn(s.frenzyMage, 'gifts')).toBe(false); expect(Object.hasOwn(s.frenzyMage, 'luck')).toBe(false);

  });
});
