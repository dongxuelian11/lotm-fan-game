import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyChaosHunterAcquisition, createChaosHunterState, hasChaosHunterLock, isChaosHunterAcquisitionCommand, projectChaosHunter, chaosHunterAcquisitionBlock, validateChaosHunterCommand, validateChaosHunterState } from '../../src/domain/chaos-hunter/index.js';
import { CHAOS_HUNTER_CONSUMPTION_RISK, CHAOS_HUNTER_FORMULA_STATUS, CHAOS_HUNTER_PRICES, CHAOS_HUNTER_SOURCE_STATUS } from '../../src/domain/chaos-hunter/content.js';
import { CHAOS_HUNTER_ABILITY_IDS, CHAOS_HUNTER_PREPARATION_IDS, type ChaosHunterAcquisitionCommand } from '../../src/domain/chaos-hunter/types.js';

const prior = () => JSON.parse(readFileSync('tests/fixtures/imperative-mage-v01370/natural.json', 'utf8'));
const roots = ['arbiter', 'sheriff', 'interrogator', 'judge', 'punishmentKnight', 'imperativeMage'] as const;
/** Actual352-command baseline; resource/time edits below are isolated unit setup, never natural-play evidence. */
function imperativeMage(): SliceState {
  const s = migrateSliceState(prior().final); s.chaosHunter = createChaosHunterState();
  s.week = Math.max(s.week, s.imperativeMage.promotionWeek! + 12); s.activeEvent = null; s.eventQueue = []; s.combat = null;
  s.cash = 100000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 31;
  s.seer.pollution = 0; s.character.coreStats.will = 30; return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function apply(s: SliceState, command: ChaosHunterAcquisitionCommand, roll = 1) { const c = context(s, roll); applyChaosHunterAcquisition(s, command, c); return c; }
function taught(s = imperativeMage()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function qualify(s: SliceState) { for (const taskId of CHAOS_HUNTER_PREPARATION_IDS) apply(s, { type: 'PREPARE_TASK', taskId }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.chaosHunter.bottles[index]!; apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
const dose = (s: SliceState, index = 0) => ({ type: 'CONSUME', bottleId: s.chaosHunter.bottles[index]!.id, confirmed: true }) as const;
function prepared() { const s = qualify(taught()); buy(s); apply(s, { type: 'PREPARE_PROMOTION' }); return s; }
function reject(s: SliceState, command: unknown) {
  const original = structuredClone(s), c = context(s);
  expect(() => applyChaosHunterAcquisition(s, command as ChaosHunterAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(original); expect(c.check).not.toHaveBeenCalled();
}
function originals(s: SliceState, before: SliceState) { for (const root of roots) expect(s[root]).toEqual(before[root]); }

describe('ChaosHunter3 original bottles and bounded G preparation', () => {
  it('reads the actual352-command W89 baseline without rewriting RNG, original choices or any of the six old roots', () => {
    const capture = prior(), s = migrateSliceState(capture.final);
    expect(capture.commands).toHaveLength(352); expect(capture.seed).toBe('arbiter-natural-v066');
    expect(s).toMatchObject({ week: 89, status: 'ACTIVE', cash: 400, actionsRemaining: 2, health: 50, mind: 100, spirituality: 117, progression: { sequence: 4, acting: 100 }, random: { seed: 'arbiter-natural-v066', cursor: 269 } });
    expect(s.character.coreStats).toEqual({ physique: 28, perception: 23, will: 23, knowledge: 19 }); expect(s.imperativeMage.promotionWeek).toBe(82);
    expect(s.imperativeMage.encounter).toMatchObject({ targetId: 'IM4-ROWAN-KELL', enemyStatus: 'SURRENDERED', enemyHealth: 30, enemyMind: 100, enemySpirituality: 0, enemyRisk: 4, powerUses: { ARC_BOLT: 5, WARD: 3, COMPOSE: 2 } });
    expect(s.imperativeMage.encounter.enemyInjuries.map(i => i.severity)).toEqual(['LIGHT', 'LIGHT', 'LIGHT', 'LIGHT', 'HEAVY']);
    expect(s.imperativeMage.life.partner).toMatchObject({ id: 'IM4-ELDEN-VALE', spirituality: 8, maxSpirituality: 12, abilityAvailable: true, consented: false });
    expect(s.imperativeMage.life.light).toMatchObject({ cardId: 'IM4-CARD-1', hoodId: 'IM4-HOOD-1', owner: 'GUIDE', holder: 'GUIDE', positionMetres: 0 });
    expect(s.imperativeMage.life.line).toMatchObject({ id: 'IM4-LINE-1', tokenId: 'IM4-TOKEN-1', holder: 'GUIDE', tokenHolder: 'GUIDE', rule: 'NONE' });
    originals(s, capture.final); expect(validateChaosHunterState(s)).toBe(true); expect(projectChaosHunter(s).digestion).toContain('7/12');
  });
  it('creates independent originals and hides this source before actual ImperativeMage4', () => {
    const s = createSliceRun('chaos-hunter-hidden', sliceDefaultCreationSelection, 'chaos-hunter-hidden');
    expect(validateChaosHunterState(s)).toBe(true);
    expect(projectChaosHunter(s)).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], abilities: [], actions: [], resources: null, inheritedTools: '' });
    expect(projectChaosHunter(s).story).toBeUndefined(); reject(s, { type: 'LEARN_GUIDANCE' });
    const other = createChaosHunterState(); other.bottles[0]!.labourSteps = 5; other.preparations.push({ taskId: 'REVIEW_RECORDS', completedWeek: 1 });
    expect(s.chaosHunter.bottles[0]!.labourSteps).toBe(0); expect(s.chaosHunter.preparations).toEqual([]);
  });
  it('does not open this source for another path, an unsupported sequence, or a missing real S4 promotion', () => {
    for (const pathwayId of ['diviner', 'hunter', 'audience', 'paragon', 'moon', 'darkness', 'white-tower', 'tyrant', 'death', 'sun', 'door', 'warrior', 'error', 'demoness', 'hanged-man', 'hermit', 'abyss', 'chained', 'wheel', 'black-emperor', 'mother'] as const) {
      const s = imperativeMage(); s.progression.pathwayId = pathwayId; expect(projectChaosHunter(s).discovered).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
    }
    for (const sequence of [9, 8, 7, 6, 5, 2, 1, 0]) { const s = imperativeMage(); s.progression.sequence = sequence as NonNullable<SliceState['progression']['sequence']>; expect(projectChaosHunter(s).discovered).toBe(false); }
    const s = imperativeMage(); s.imperativeMage.promotionWeek = null; reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges500 and one action without turning the unknown recipe, ritual or high-level information into facts', () => {
    const s = imperativeMage(), before = structuredClone(s); apply(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([99500, 99]); originals(s, before);
    expect(CHAOS_HUNTER_PRICES).toEqual({ guidance: 500, potion: 6400, labourCredit: 5500, preparation: 140 });
    for (const text of ['晋升仪式尚未披露', '序列3混乱猎手', '直接确认', '薇娜·贝尔']) expect(CHAOS_HUNTER_FORMULA_STATUS).toContain(text);
    for (const text of ['L200622', 'L200624', 'L200996', 'L201014', 'L194714', 'L200569', '2平衡者', '均为原创G', '0—36']) expect(CHAOS_HUNTER_SOURCE_STATUS).toContain(text);
    expect(CHAOS_HUNTER_CONSUMPTION_RISK).toContain('不保护实际战斗');
    expect(projectChaosHunter(s).formula).toEqual([]); reject(s, { type: 'LEARN_GUIDANCE' }); expect(validateChaosHunterState(s)).toBe(true);
  });
  it('five actual jobs reduce only that unique bottle to900 and do not pay for preparations', () => {
    const s = taught(), bottle = s.chaosHunter.bottles[0]!;
    for (let i = 0; i < 5; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect([bottle.labourSteps, bottle.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]); reject(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s); expect([s.cash, bottle.status, bottle.acquiredWeek]).toEqual([98600, 'PLAYER', s.week]);
    expect(s.chaosHunter.bottles[1]!.labourSteps).toBe(0); expect(s.chaosHunter.preparations).toEqual([]); expect(s.chaosHunter.preparedWeek).toBeNull();
    reject(s, { type: 'BUY_POTION', bottleId: bottle.id }); expect(validateChaosHunterState(s)).toBe(true);
  });
  it('does not partially discount jobs, borrow an old original bottle or spend unavailable funds', () => {
    const s = taught(), bottle = s.chaosHunter.bottles[0]!;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: bottle.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(6400);
    s.cash = 6399; reject(s, { type: 'BUY_POTION', bottleId: s.chaosHunter.bottles[1]!.id });
    for (const bottleId of ['imperative-mage-potion-1', 'punishment-knight-potion-1', 'judge-potion-1']) reject(s, { type: 'BUY_POTION', bottleId });
  });
  it('requires three distinct one-action preparations and a separate current-week140 check', () => {
    const s = taught(); buy(s); reject(s, dose(s)); reject(s, { type: 'PREPARE_PROMOTION' });
    for (const [index, taskId] of CHAOS_HUNTER_PREPARATION_IDS.entries()) {
      const ap = s.actionsRemaining; apply(s, { type: 'PREPARE_TASK', taskId }); expect(s.actionsRemaining).toBe(ap - 1);
      expect(s.chaosHunter.preparations[index]).toEqual({ taskId, completedWeek: s.week }); reject(s, { type: 'PREPARE_TASK', taskId });
    }
    reject(s, dose(s)); const cash = s.cash, ap = s.actionsRemaining; apply(s, { type: 'PREPARE_PROMOTION' });
    expect([s.cash, s.actionsRemaining, s.chaosHunter.preparedWeek]).toEqual([cash - 140, ap - 1, s.week]);
    expect(hasChaosHunterLock(s)).toBe(true); expect(projectChaosHunter(s).insideCase).toBe(true); expect(validateChaosHunterState(s)).toBe(true);
  });
  it('leaves a real zero-action nonrefunding exit after the last preparation action', () => {
    const s = qualify(taught()); buy(s); s.actionsRemaining = 1; const cash = s.cash, week = s.week;
    apply(s, { type: 'PREPARE_PROMOTION' }); expect([s.week, s.actionsRemaining, s.cash]).toEqual([week, 0, cash - 140]);
    reject(s, { type: 'PREPARE_PROMOTION' }); s.health = 1; s.mind = 1; const c = apply(s, { type: 'LEAVE_PREPARATION' });
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([1, 1, 31, cash - 140, 0]); expect(c.check).not.toHaveBeenCalled();
    expect(s.chaosHunter.preparedWeek).toBeNull(); expect(s.chaosHunter.bottles[0]!.status).toBe('PLAYER'); expect(hasChaosHunterLock(s)).toBe(false);
    reject(s, dose(s)); reject(s, { type: 'LEAVE_PREPARATION' }); expect(validateChaosHunterState(s)).toBe(true);
  });
  it.each([[1, 'GREAT_SUCCESS', 92, 100, 0, 3], [30, 'SUCCESS', 85, 100, 0, 3], [90, 'FAILURE', 75, 85, 30, 4], [100, 'GREAT_FAILURE', 55, 75, 60, 4]] as const)('settles roll%s honestly without resource refills or rewriting original people', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), before = structuredClone(s), bottle = s.chaosHunter.bottles[0]!; s.actionsRemaining = 0;
    const c = apply(s, dose(s), roll); expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 30);
    expect([bottle.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.spirituality, s.actionsRemaining]).toEqual([tier, mind, health, pollution, sequence, 31, 0]);
    expect(bottle).toMatchObject({ status: 'CONSUMED', consumedWeek: s.week, preparationWeek: s.week }); expect(s.chaosHunter.preparedWeek).toBeNull();
    originals(s, before); expect(s.character.age).toBe(26); expect(s.character.gender).toBe('FEMALE'); expect(s.random).toEqual(before.random);
    expect(s.combatHistory).toEqual(before.combatHistory); expect(s.injuries).toEqual(before.injuries); expect(s.town).toEqual(before.town);
    expect(s.chaosHunter.life).toEqual(before.chaosHunter.life); expect(s.chaosHunter.encounter).toEqual(before.chaosHunter.encounter);
    for (const [id, mastery] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    if (sequence === 3) {
      expect(s.chaosHunter.imperativeMageActingAtPromotion).toBe(100); expect(s.progression.acting).toBe(0);
      expect(Object.keys(s.progression.mastery).filter(id => !Object.hasOwn(before.progression.mastery, id))).toEqual([...CHAOS_HUNTER_ABILITY_IDS]);
      expect(s.progression.mastery['justiciar.s3.bounded-order']).toBe(0);
      for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(before.character.coreStats[stat] + 1);
      expect(projectChaosHunter(s).inheritedHistory.join(' ')).toContain('IM4-ROWAN-KELL'); expect(projectChaosHunter(s).inheritedTools).toContain('原IM4-CARD-1卡与原IM4-HOOD-1罩由GUIDE');
      expect(projectChaosHunter(s).resources).toMatchObject({ maxSpirituality: 120, spirituality: 31 });
    } else expect(s.progression.acting).toBe(100);
    expect(validateChaosHunterState(s)).toBe(true); reject(s, dose(s));
  });
  it('protects only guided potion rejection and never revives a dead body', () => {
    const s = prepared(); s.health = 21; s.mind = 41; apply(s, dose(s), 100); expect([s.health, s.mind, s.status, s.progression.sequence]).toEqual([1, 1, 'ACTIVE', 4]);
    const dead = prepared(); dead.status = 'DEAD'; dead.health = 0; reject(dead, dose(dead)); expect(validateChaosHunterState(s)).toBe(true);
  });
  it('retains failed originals and requires another140 check for recovery and retry', () => {
    const s = prepared(); apply(s, dose(s), 100); const failed = structuredClone(s.chaosHunter.bottles[0]), tasks = structuredClone(s.chaosHunter.preparations);
    buy(s, 1); reject(s, dose(s, 1)); s.health = 100; s.mind = 100; const cash = s.cash; apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, 1));
    expect(s.cash).toBe(cash - 140); expect(s.chaosHunter.bottles[0]).toEqual(failed); expect(s.chaosHunter.preparations).toEqual(tasks); expect(validateChaosHunterState(s)).toBe(true);
  });
  it('waits an actual next week for three new priced bottles after all current originals fail', () => {
    const s = qualify(taught()); reject(s, { type: 'RECEIVE_SUPPLY' });
    for (let n = 0; n < 3; n++) { buy(s, n); apply(s, { type: 'PREPARE_PROMOTION' }); apply(s, dose(s, n), 100); s.health = 100; s.mind = 100; if (n < 2) reject(s, { type: 'REQUEST_SUPPLY' }); }
    const bottles = structuredClone(s.chaosHunter.bottles); apply(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; apply(s, { type: 'RECEIVE_SUPPLY' }); expect(s.chaosHunter.bottles.slice(0, 3)).toEqual(bottles); expect(s.chaosHunter.bottles).toHaveLength(6);
    expect(s.chaosHunter.bottles[3]).toMatchObject({ id: 'chaos-hunter-potion-4', status: 'SUPPLIER', labourSteps: 0, stockedWeek: s.week, acquiredWeek: null });
    expect(projectChaosHunter(s).actions.find(a => a.id === 'buy-chaos-hunter-potion-4')!.cost).toContain('6400'); expect(validateChaosHunterState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('measures twelve full weeks from original ImperativeMageW82, then rejects stale checks and unmet digestion', () => {
    const s = imperativeMage(); s.week = s.imperativeMage.promotionWeek! + 11; qualify(taught(s)); buy(s); const originalPromotion = s.progression.promotionWeek;
    expect(chaosHunterAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('11/12'); reject(s, { type: 'PREPARE_PROMOTION' });
    s.week = s.imperativeMage.promotionWeek! + 12; apply(s, { type: 'PREPARE_PROMOTION' }); expect(s.progression.promotionWeek).toBe(originalPromotion);
    s.progression.acting = 99; reject(s, dose(s)); s.progression.acting = 100; s.health = 20; reject(s, dose(s)); s.health = 100; s.mind = 40; reject(s, dose(s)); s.mind = 100;
    s.week++; reject(s, dose(s)); expect(validateChaosHunterState(s)).toBe(false); apply(s, { type: 'LEAVE_PREPARATION' });
  });
  it('blocks unfinished old originals and practice without charging', () => {
    const s = qualify(taught()); buy(s);
    const changes: ((state: SliceState) => void)[] = [
      ...(['arbiter', 'sheriff', 'interrogator', 'judge', 'punishmentKnight'] as const).flatMap(root => [
        (t: SliceState) => { Object.values(t[root].cases)[0]!.contactOpen = true; },
        (t: SliceState) => { Object.values(t[root].cases)[0]!.status = 'PREPARED'; },
      ]),
      t => { Object.values(t.imperativeMage.life.cases)[0]!.contactOpen = true; }, t => { Object.values(t.imperativeMage.life.cases)[0]!.status = 'PREPARED'; },
      t => { t.judge.practice.audience = 'ADDRESSED'; }, t => { t.judge.practice.boundary = 'HELD'; }, t => { t.judge.practice.token = 'OUTSIDE_TABLE'; },
      t => { t.punishmentKnight.practice.pad = 'MAT'; }, t => { t.punishmentKnight.practice.partner = 'HELD'; }, t => { t.punishmentKnight.practice.note = 'WRITTEN'; },
      t => { t.judge.encounter.status = 'FIGHTING'; }, t => { t.punishmentKnight.encounter.status = 'FIGHTING'; },
      t => { t.imperativeMage.life.attention.consented = true; }, t => { t.imperativeMage.life.attention.effect = 'ATTENTION_HELD'; },
      t => { t.imperativeMage.life.attention.remainingSeconds = 3; }, t => { t.imperativeMage.life.partner.consented = true; },
      t => { t.imperativeMage.life.partner.abilityAvailable = false; }, t => { t.imperativeMage.life.light.holder = 'TABLE'; },
      t => { t.imperativeMage.life.light.remainingSeconds = 10; }, t => { t.imperativeMage.life.light.hoodComparison = true; },
      t => { t.imperativeMage.life.line.holder = 'FLOOR'; }, t => { t.imperativeMage.life.line.tokenHolder = 'PLAYER'; },
      t => { t.imperativeMage.life.line.rule = 'NO_CROSSING'; }, t => { t.imperativeMage.life.line.playerPositionMetres = 2; }, t => { t.imperativeMage.life.line.partnerPositionMetres = 2; },
      t => { t.imperativeMage.encounter.status = 'FIGHTING'; }, t => { t.imperativeMage.encounter.intimidationReady = true; },
      t => { t.imperativeMage.encounter.deprivationReady = true; }, t => { t.imperativeMage.encounter.composureReady = true; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); reject(t, { type: 'PREPARE_PROMOTION' }); }
  });
  it('rejects unavailable guidance, foreign locations, no actions and insufficient current preparation funds', () => {
    const s = imperativeMage(); s.cash = 499; reject(s, { type: 'LEARN_GUIDANCE' }); s.cash = 100000; s.actionsRemaining = 0; reject(s, { type: 'LEARN_GUIDANCE' });
    const t = taught(); t.actionsRemaining = 0; reject(t, { type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }); reject(t, { type: 'POTION_WORK', bottleId: t.chaosHunter.bottles[0]!.id });
    const u = qualify(taught()); buy(u); u.cash = 139; reject(u, { type: 'PREPARE_PROMOTION' }); u.cash = 140; u.world.city = 'ELSEWHERE'; reject(u, { type: 'PREPARE_PROMOTION' });
  });
  it.each([null, {}, { type: 'BREW' }, { type: 'ALWAYS_SUCCEED' }, { type: 'BUY_GIFTS' }, { type: 'REROLL' }, { type: 'REWRITE_HISTORY' }, { type: 'RESET_ROWAN' }, { type: 'DEATH_VERDICT' }, { type: 'CHANGE_PAST_RULE' }, { type: 'BUY_POTION', bottleId: 'imperative-mage-potion-1' }, { type: 'PREPARE_TASK', taskId: 'GATHER_BELIEVERS' }, { type: 'LEARN_GUIDANCE', forceConsent: true }, { type: 'CONSUME', bottleId: 'chaos-hunter-potion-1', confirmed: false }])('rejects exact unauthorized command shape%# before mutation', command => {
    expect(validateChaosHunterCommand(command)).toBe(false); expect(isChaosHunterAcquisitionCommand(command)).toBe(false); reject(taught(), command);
  });
  it('rejects forged chronology, duplicated bottles or tasks, missing mastery and malformed scene data', () => {
    const s = prepared(); apply(s, dose(s));
    const changes: ((state: SliceState) => void)[] = [
      t => { t.chaosHunter.imperativeMageActingAtPromotion = 99; }, t => { t.chaosHunter.bottles[0]!.source = 'old original'; },
      t => { t.chaosHunter.bottles[0]!.preparationWeek = t.chaosHunter.bottles[0]!.preparationWeek! - 1; }, t => { t.chaosHunter.bottles[1]!.id = t.chaosHunter.bottles[0]!.id; },
      t => { t.chaosHunter.preparations[1]!.taskId = t.chaosHunter.preparations[0]!.taskId; }, t => { t.chaosHunter.preparations[0]!.completedWeek = t.week + 1; },
      t => { t.chaosHunter.preparedWeek = t.week; }, t => { delete t.progression.mastery['justiciar.s3.bounded-order']; },
      t => { (t.chaosHunter as unknown as Record<string, unknown>).life = null; }, t => { (t.chaosHunter as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateChaosHunterState(t)).not.toThrow(); expect(validateChaosHunterState(t)).toBe(false); }
  });
  it('keeps key order irrelevant and freezes all six old roots including Rowan and the autonomous originals', () => {
    const s = prepared(), before = structuredClone(s); apply(s, dose(s));
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, reorder(v)])) : value;
    expect(validateChaosHunterState(reorder(s) as SliceState)).toBe(true);
    const history = projectChaosHunter(s).inheritedHistory.join(' ');
    for (const text of ['IM4-ROWAN-KELL', 'SURRENDERED', '健康30/100', '灵性0', '原伤势5处', '轻伤4', '重伤1', '累计风险4', 'IM4-ELDEN-VALE', '原灵性8/12']) expect(history).toContain(text);
    originals(s, before); expect(s.imperativeMage.life.light.holder).toBe('GUIDE'); expect(s.imperativeMage.life.line).toEqual(before.imperativeMage.life.line);
    expect(s.imperativeMage.life.partner).toEqual(before.imperativeMage.life.partner); expect(Object.hasOwn(s.chaosHunter, 'gifts')).toBe(false); expect(Object.hasOwn(s.chaosHunter, 'luck')).toBe(false);
  });
});
