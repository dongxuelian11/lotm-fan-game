import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyCoffinBearerAcquisition, createCoffinBearerState, hasCoffinBearerLock, isCoffinBearerAcquisitionCommand, projectCoffinBearer, coffinBearerAcquisitionBlock, validateCoffinBearerCommand, validateCoffinBearerState } from '../../src/domain/coffin-bearer/index.js';
import { COFFIN_BEARER_CONSUMPTION_RISK, COFFIN_BEARER_FORMULA_STATUS, COFFIN_BEARER_PRICES, COFFIN_BEARER_SOURCE_STATUS } from '../../src/domain/coffin-bearer/content.js';
import { COFFIN_BEARER_ABILITY_IDS, COFFIN_BEARER_PREPARATION_IDS, type CoffinBearerAcquisitionCommand } from '../../src/domain/coffin-bearer/types.js';

const prior = () => JSON.parse(readFileSync('tests/fixtures/ancient-alchemist-v01380/natural.json', 'utf8'));
const roots = ['cultivator', 'physician', 'harvestpriest', 'biologist', 'druid', 'ancientAlchemist'] as const;
/** Actual483-command baseline; resource/time edits below are isolated unit setup, never natural-play evidence. */
function ancientAlchemist(): SliceState {
  const s = migrateSliceState(prior().final); s.coffinBearer = createCoffinBearerState();
  s.week = Math.max(s.week, s.ancientAlchemist.promotionWeek! + 12); s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.seer.pollution = 0; s.character.coreStats.will = 30; return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: CoffinBearerAcquisitionCommand, roll = 1) { const c = context(s, roll); applyCoffinBearerAcquisition(s, command, c); return c; }
function taught(s = ancientAlchemist()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of COFFIN_BEARER_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.coffinBearer.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.coffinBearer.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const original = structuredClone(s), c = context(s);
  expect(() => applyCoffinBearerAcquisition(s, command as CoffinBearerAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(original); expect(c.check).not.toHaveBeenCalled();
}
function originals(s: SliceState, before: SliceState) { for (const root of roots) expect(s[root]).toEqual(before[root]); }

describe('CoffinBearer3 original bottles and bounded G preparation', () => {
  it('reads the actual483-command W130 baseline without rewriting RNG, original choices or any of the six old roots', () => {
    const capture = prior(), s = migrateSliceState(capture.final);
    expect(capture.commands).toHaveLength(483); expect(capture.seed).toBe('cultivator-natural-v069');
    expect(s).toMatchObject({ week: 130, status: 'ACTIVE', cash: 225, actionsRemaining: 1, health: 90, mind: 100, spirituality: 120, progression: { sequence: 4, acting: 100 }, random: { seed: 'cultivator-natural-v069', cursor: 136 } });
    expect(s.character.coreStats).toEqual({ physique: 26, perception: 22, will: 21, knowledge: 22 }); expect(s.ancientAlchemist.promotionWeek).toBe(119);
    expect(s.ancientAlchemist.encounter).toMatchObject({ targetId: 'AA4-OSRIC-VALE', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 24, enemyRisk: 0, guardAttempts: 0, powerUses: { ARC_BOLT: 2, WARD: 2, COMPOSE: 0 } });
    expect(s.ancientAlchemist.encounter.enemyInjuries.map(i => i.severity)).toEqual(['HEAVY']);
    expect(s.ancientAlchemist.life.stem).toMatchObject({ id: 'AA4-STEM-1', potId: 'AA4-POT-1', living: true, holder: 'GUIDE', damage: 'STABILIZED' });
    expect(s.ancientAlchemist.life.record).toMatchObject({ id: 'AA4-RECORD-1', holder: 'NORA', handovers: 1 });
    expect(s.ancientAlchemist.life.guards[0]).toMatchObject({ id: 'AA4-GUARD-1', holder: 'PLAYER', preparedWeek: 130 });
    expect(s.ancientAlchemist.life.guards[0]!.segments.every(segment => segment.spentWeek === null)).toBe(true);
    originals(s, capture.final); expect(validateCoffinBearerState(s)).toBe(true); expect(projectCoffinBearer(s).digestion).toContain('11/12');
  });
  it('creates independent originals and hides this source before actual AncientAlchemist4', () => {
    const s = createSliceRun('coffin-bearer-hidden', sliceDefaultCreationSelection, 'coffin-bearer-hidden');
    expect(validateCoffinBearerState(s)).toBe(true);
    expect(projectCoffinBearer(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null, inheritedTools: '' });
    expect(projectCoffinBearer(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createCoffinBearerState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'REVIEW_RECORDS', completedWeek: 1 });
    expect(s.coffinBearer.bottles[0]!.labourSteps).toBe(0); expect(s.coffinBearer.preparations).toEqual([]);
  });
  it('does not open this source for another path, an unsupported sequence, or a missing real S4 promotion', () => {
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'door', 'warrior', 'error', 'demoness', 'hanged-man', 'hermit', 'abyss', 'chained', 'wheel', 'black-emperor', 'justiciar'] as const) {
      const s = ancientAlchemist(); s.progression.pathwayId = pathwayId; expect(projectCoffinBearer(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 1, 0]) { const s = ancientAlchemist(); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectCoffinBearer(s).discovered).toBe(false); }
    const advanced = ancientAlchemist(); advanced.progression.sequence = 2; expect(projectCoffinBearer(advanced).discovered).toBe(true); reject(advanced, { type: 'LEARN_GUIDANCE' });
    const s = ancientAlchemist(); s.ancientAlchemist.promotionWeek = null; reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without turning the unknown recipe, ritual or high-level information into facts', () => {
    const s = ancientAlchemist(), before = structuredClone(s); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); originals(s, before);
    expect(COFFIN_BEARER_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    for (const text of ['晋升仪式尚未披露', '序列3抬棺人', '直接确认', '伊芙·莫兰']) expect(COFFIN_BEARER_FORMULA_STATUS).toContain(text);
    for (const text of ['L231911', '3抬棺人', '2荒芜主母', '1自然行者', '均为原创G', '新增能力未核', '棺材免死']) expect(COFFIN_BEARER_SOURCE_STATUS).toContain(text);
    expect(COFFIN_BEARER_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectCoffinBearer(s).formula).toEqual([]); reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateCoffinBearerState(s)).toBe(true);
  });
  it('five actual jobs reduce only that unique bottle to900 and do not pay for preparations', () => {
    const s = taught(), bottle = s.coffinBearer.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect([bottle.labourSteps, bottle.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]); reject(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s); expect([s.cash, bottle.status, bottle.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.coffinBearer.bottles[1]!.labourSteps).toBe(0); expect(s.coffinBearer.preparations).toEqual([]); expect(s.coffinBearer.preparedWeek).toBeNull();
    reject(s, { type: 'BUY_POTION', bottleId: bottle.id }); expect(validateCoffinBearerState(s)).toBe(true);
  });
  it('does not partially discount jobs, borrow an old original bottle or spend unavailable funds', () => {
    const s = taught(), bottle = s.coffinBearer.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.coffinBearer.bottles[1]!.id });
    for (const bottleId of ['ancient-alchemist-potion-1', 'druid-potion-1', 'biologist-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
  });
  it('requires three distinct one-action preparations and a separate current-week140 check', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of COFFIN_BEARER_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.coffinBearer.preparations[index]).toEqual({ taskId, completedWeek: s.week }); reject(s, { type: 'PREPARE_TASK', taskId });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.coffinBearer.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasCoffinBearerLock(s)).toBe(true); expect(projectCoffinBearer(s).insideCase).toBe(true); expect(validateCoffinBearerState(s)).toBe(true);
  });
  it('leaves a real zero-action nonrefunding exit after the last preparation action', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1; const cash = s.cash, week = s.week;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]);
    reject(s, { type: 'PREPARE_PROMOTION' }); s.health = 1; s.mind = 1; const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, 31, cash - 140, 0]); expect(c.check).not.toHaveBeenCalled();
    expect(s.coffinBearer.preparedWeek).toBeNull(); expect(s.coffinBearer.bottles[0]!.status).toBe('PLAYER'); expect(hasCoffinBearerLock(s)).toBe(false);
    reject(s, dose(s)); reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateCoffinBearerState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles roll%s honestly without resource refills or rewriting original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), before = structuredClone(s), bottle = s.coffinBearer.bottles[0]!; s.actionsRemaining = 0;
    const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([bottle.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(bottle).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.coffinBearer.preparedWeek).toBeNull();
    originals(s, before); expect(s.character.age).toBe(26); expect(s.character.gender).toBe('FEMALE'); expect(s.random).toEqual(before.random);
    expect(s.combatHistory).toEqual(before.combatHistory); expect(s.injuries).toEqual(before.injuries); expect(s.town).toEqual(before.town);
    expect(s.coffinBearer.life).toEqual(before.coffinBearer.life); expect(s.coffinBearer.encounter).toEqual(before.coffinBearer.encounter);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    if (sequence === 3) {
      expect(s.coffinBearer.ancientAlchemistActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(before.progression.mastery, id))).toEqual([...COFFIN_BEARER_ABILITY_IDS]);
      expect(s.progression.mastery['mother.s3.finite-preservation']).toBe(0);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
      expect(projectCoffinBearer(s).inheritedHistory.join(' ')).toContain('AA4-OSRIC-VALE'); expect(projectCoffinBearer(s).inheritedTools).toContain('AA4-GUARD-1由PLAYER持有，三原段已耗0/3');
      expect(projectCoffinBearer(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateCoffinBearerState(s)).toBe(true); reject(s, dose(s));
  });
  it('protects only guided potion rejection and never revives a dead body', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead)); expect(validateCoffinBearerState(s)).toBe(true);
  });
  it('retains failed originals and requires another140 check for recovery and retry', () => {
    const s = prepared(); apply(s, dose(s), 100); const failed = structuredClone(s.coffinBearer.bottles[0]), tasks = structuredClone(s.coffinBearer.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100; const cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 1));
    expect(s.cash).toBe(cash - 140); expect(s.coffinBearer.bottles[0]).toEqual(failed); expect(s.coffinBearer.preparations).toEqual(tasks); expect(validateCoffinBearerState(s)).toBe(true);
  });
  it('waits an actual next week for three new priced bottles after all current originals fail', () => {
    const s = qualify(taught()); reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const bottles = structuredClone(s.coffinBearer.bottles); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.coffinBearer.bottles.slice(0, 3)).toEqual(bottles); expect(s.coffinBearer.bottles).toHaveLength(6);
    expect(s.coffinBearer.bottles[3]).toMatchObject({ id: 'coffin-bearer-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectCoffinBearer(s).actions.find(a => a.id === 'buy-coffin-bearer-potion-4')!.cost).toContain('6400'); expect(validateCoffinBearerState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('measures twelve full weeks from original AncientAlchemistW119, then rejects stale checks and unmet digestion', () => {
    const s = ancientAlchemist(); s.week = s.ancientAlchemist.promotionWeek! + 11; qualify(taught(s)); buy(s); const originalPromotion = s.progression.promotionWeek;
    expect(coffinBearerAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('11/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = s.ancientAlchemist.promotionWeek! + 12; apply(s, { type: 'PREPARE_PROMOTION' }); expect(s.progression.promotionWeek).toBe(originalPromotion);
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100; s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateCoffinBearerState(s)).toBe(false); apply(s, { type: 'LEAVE_PREPARATION' });
  });
  it('blocks unfinished old originals and practice without charging', () => {
    const s = qualify(taught()); buy(s);
    const changes: ((state: SliceState) => void)[] = [
      ...(['cultivator', 'physician', 'harvestpriest', 'biologist', 'druid'] as const).flatMap(root => [
        (t: SliceState) => { Object.values(t[root].cases)[0]!.contactOpen = true; },
        (t: SliceState) => { Object.values(t[root].cases)[0]!.status = 'PREPARED'; },
      ]),
      t => { Object.values(t.ancientAlchemist.life.cases)[0]!.contactOpen = true; }, t => { Object.values(t.ancientAlchemist.life.cases)[0]!.status = 'PREPARED'; },
      t => { t.druid.practice.position = 'FAR'; }, t => { t.druid.practice.soil = 'SOFTENED'; },
      t => { t.druid.practice.marker = 'NEAR'; }, t => { t.druid.practice.seedlings = 'OBSERVED'; }, t => { t.druid.practice.note = 'WRITTEN'; },
      t => { t.biologist.encounter.status = 'FIGHTING'; }, t => { t.druid.encounter.status = 'FIGHTING'; },
      t => { t.ancientAlchemist.life.stem.holder = 'PLAYER'; }, t => { t.ancientAlchemist.life.stem.clips = 'PLAYER'; },
      t => { t.ancientAlchemist.life.matrices[0]!.holder = 'TRAY'; }, t => { t.ancientAlchemist.life.matrices[0]!.remainingSeconds = 1; },
      t => { t.ancientAlchemist.life.record.holder = 'PLAYER'; },
      t => { t.ancientAlchemist.encounter.status = 'FIGHTING'; },
      t => { t.ancientAlchemist.encounter.guardReady = { guardId: 'AA4-GUARD-1', segmentId: 'AA4-GUARD-1-SEGMENT-1' }; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it('rejects unavailable guidance, foreign locations, no actions and insufficient current preparation funds', () => {
    const s = ancientAlchemist(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' }); s.cash = 100000; s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0; reject(t, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.coffinBearer.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.cash = 139; reject(u, { type: 'PREPARE_PROMOTION' }); u.cash = 140; u.world.city = 'ELSEWHERE'; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'ALWAYS_SUCCEED' }, { type: 'BUY_GIFTS' }, { type: 'REROLL' }, { type: 'REWRITE_HISTORY' }, { type: 'RESET_OSRIC' }, { type: 'RESURRECT' }, { type: 'CREATE_SOUL' }, { type: 'COFFIN_IMMORTALITY' }, { type: 'BUY_POTION', bottleId: 'ancient-alchemist-potion-1' }, { type: 'PREPARE_TASK', taskId: 'GATHER_BELIEVERS' }, { type: 'LEARN_GUIDANCE', forceConsent: true }, { type: 'CONSUME', bottleId: 'coffin-bearer-potion-1', confirmed: false }])('rejects exact unauthorized command shape%# before mutation', command => {
    expect(validateCoffinBearerCommand(command)).toBe(false); expect(isCoffinBearerAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects forged chronology, duplicated bottles or tasks, missing mastery and malformed scene data', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.coffinBearer.ancientAlchemistActingAtPromotion = 99; }, t => { t.coffinBearer.bottles[0]!.source = 'old original'; },
      t => { t.coffinBearer.bottles[0]!.preparationWeek = t.coffinBearer.bottles[0]!.preparationWeek! - 1; }, t => { t.coffinBearer.bottles[1]!.id = t.coffinBearer.bottles[0]!.id; },
      t => { t.coffinBearer.preparations[1]!.taskId = t.coffinBearer.preparations[0]!.taskId; }, t => { t.coffinBearer.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.coffinBearer.preparedWeek = t.week; }, t => { delete t.progression.mastery['mother.s3.finite-preservation']; },
      t => { (t.coffinBearer as unknown as Record<string, unknown>).life = null; }, t => { (t.coffinBearer as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateCoffinBearerState(t)).not.toThrow(); expect(validateCoffinBearerState(t)).toBe(false); }
  });
  it('keeps key order irrelevant and freezes all six old roots including Osric and the original living stem', () => {
    const s = prepared(), before = structuredClone(s); apply(s, dose(s));
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorder(v)])) : value;
    expect(validateCoffinBearerState(reorder(s) as SliceState)).toBe(true);
    const history = projectCoffinBearer(s).inheritedHistory.join(' ');
    for (const text of ['AA4-OSRIC-VALE', 'SURRENDERED', '健康70/100', '灵性24', '原伤势1处', '轻伤0', '重伤1', '累计风险0', 'AA4-STEM-1', 'AA4-RECORD-1']) expect(history).toContain(text);
    originals(s, before); expect(s.ancientAlchemist.life.record.holder).toBe('NORA'); expect(s.ancientAlchemist.life.guards).toEqual(before.ancientAlchemist.life.guards);
    expect(s.ancientAlchemist.life.stem).toEqual(before.ancientAlchemist.life.stem); expect(Object.hasOwn(s.coffinBearer, 'gifts')).toBe(false); expect(Object.hasOwn(s.coffinBearer, 'luck')).toBe(false);
  });
});
