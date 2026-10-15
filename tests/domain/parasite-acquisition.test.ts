import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { MARAUDER_ABILITY_IDS } from '../../src/domain/marauder/types.js';
import { SWINDLER_ABILITY_IDS } from '../../src/domain/swindler/types.js';
import { CRYPTOLOGIST_ABILITY_IDS } from '../../src/domain/cryptologist/types.js';
import { FIRE_THIEF_ABILITY_IDS } from '../../src/domain/fire-thief/types.js';
import { DREAM_STEALER_ABILITY_IDS } from '../../src/domain/dream-stealer/types.js';
import { applyParasiteCommand, createParasiteState, isParasite, isParasiteAcquisitionCommand, projectParasite, validateParasiteCommand, validateParasiteState } from '../../src/domain/parasite/index.js';
import { PARASITE_ABILITIES, PARASITE_CONSUMPTION_RISK, PARASITE_FORMULA_STATUS, PARASITE_PRICES, PARASITE_SOURCE_STATUS } from '../../src/domain/parasite/content.js';
import { PARASITE_ABILITY_IDS, type ParasiteCommand } from '../../src/domain/parasite/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed unit fixtures start from the real continuing S5 run. Resource/top-up edits are not natural-play evidence.
function dreamStealer(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/dream-stealer-v01060/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.parasite = createParasiteState(); s.week = s.dreamStealer.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: ParasiteCommand, roll = 1) {
  const c = context(s, roll); applyParasiteCommand(s, command, c); return c;
}
function taught(s = dreamStealer()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.parasite.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.parasite.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyParasiteCommand(s, command as ParasiteCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}
const oldIds = [...MARAUDER_ABILITY_IDS, ...SWINDLER_ABILITY_IDS, ...CRYPTOLOGIST_ABILITY_IDS, ...FIRE_THIEF_ABILITY_IDS, ...DREAM_STEALER_ABILITY_IDS];

describe('Parasite S4 source-bound finished bottles and recoverable G medicine', () => {
  it('hides the future channel and builds independent nested state', () => {
    const s = createSliceRun('parasite-hidden', sliceDefaultCreationSelection, 'parasite-hidden');
    expect(validateParasiteState(s)).toBe(true);
    expect(projectParasite(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectParasite(s).story).toBeUndefined();
    const other = createParasiteState(); other.life.player.location = 'ROUTE_END'; other.bottles[0]!.labourSteps = 5; other.encounter.enemySpirituality = 0;
    expect(s.parasite.life.player.location).toBe('DESK'); expect(s.parasite.bottles[0]!.labourSteps).toBe(0); expect(s.parasite.encounter.enemySpirituality).toBe(32);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('uses the original guide and charges 540 plus one action without inventing a recipe or ritual', () => {
    const s = dreamStealer(), old = structuredClone([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer]);
    expect(validateParasiteState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer]).toEqual(old);
    expect(PARASITE_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    expect(PARASITE_FORMULA_STATUS).toContain('完整配方与晋升仪式细节尚未核实');
    expect(PARASITE_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(PARASITE_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    expect(projectParasite(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(c.note).toHaveBeenCalledWith('听取寄生者用药说明', expect.stringContaining('实际核对原瓶、准备原练习室安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual actions for a nontransferable 5300 credit and 1500 payment on one original', () => {
    const s = taught(), b = s.parasite.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([37960, 94, 'PLAYER']);
    const second = s.parasite.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(6800); expect(validateParasiteState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 6799; reject(s, { type: 'BUY_POTION', bottleId: s.parasite.bottles[2]!.id });
  });
  it('allows early guidance but needs actual S5 digestion100 and twelve complete promotion weeks', () => {
    const s = dreamStealer(); s.week = 71; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateParasiteState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.dreamStealer.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectParasite(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isParasite(s)).toBe(true); expect(s.parasite.dreamStealerActingAtPromotion).toBe(100);
  });
  it('consumes only the selected original and applies each of four real fixed medicine outcomes', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.parasite.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect(c.note).toHaveBeenCalledWith('导师完成本次寄生者服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.parasite.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 5) expect(s.progression.acting).toBe(100);
      expect(validateParasiteState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps a low-health severe medicine failure recoverable without reviving the consumed bottle', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    const b = s.parasite.bottles[0]!; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.progression.acting, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100, 100]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' }); expect(validateParasiteState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(PARASITE_CONSUMPTION_RISK).toContain('保护不适用于战斗');
  });
  it('blocks at health20 or mind40 before rolling and caps successful spiritual cost at zero', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.parasite.bottles[0]!.id, confirmed: true });
      expect(s.parasite.bottles[0]!.status).toBe('PLAYER');
      expect(projectParasite(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
    const s = prepared(); s.spirituality = 3;
    act(s, { type: 'CONSUME', bottleId: s.parasite.bottles[0]!.id, confirmed: true }, 30);
    expect(s.spirituality).toBe(0); expect(s.mind).toBe(92);
  });
  it('inherits exact old abilities, gender, people, original objects, loans and enemy outcomes', () => {
    const s = prepared(), old = structuredClone([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer, s.combatHistory]), stats = { ...s.character.coreStats }, gender = s.character.gender;
    const mastery = { ...s.progression.mastery };
    act(s, { type: 'CONSUME', bottleId: s.parasite.bottles[0]!.id, confirmed: true });
    expect([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer, s.combatHistory]).toEqual(old);
    expect(s.character.gender).toBe(gender); expect(gender).toBe('FEMALE');
    expect(s.dreamStealer.practice).toMatchObject({ token: 'TARGET_DESK', thefts: 2, executions: 2, recoveries: 2, tokenMoves: 2 });
    expect(s.dreamStealer.encounter.status).toBe('RESOLVED');
    expect(Object.keys(s.progression.mastery)).toEqual([...oldIds, ...PARASITE_ABILITY_IDS]);
    for (const id of oldIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    expect(PARASITE_ABILITY_IDS).toEqual(['error.s4.parasitism', 'error.s4.deferred-thought']);
    for (const id of PARASITE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(s.parasite.encounter.borrowed).toEqual([]);
    expect(projectParasite(s).digestion).toContain('寄生者扮演0/100'); expect(validateParasiteState(s)).toBe(true);
  });
  it('preserves all failed bottles and requires the next actual week for another paid batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.parasite.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.parasite.bottles.slice(0, 3)).toEqual(originals); expect(s.parasite.bottles).toHaveLength(6);
    expect(s.parasite.bottles[3]).toMatchObject({ id: 'parasite-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectParasite(s).actions.find(a => a.id === 'buy-parasite-potion-4')!.cost).toContain('6800便士');
    expect(validateParasiteState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('supports zero-action purchase and separately confirmed consumption of the selected second bottle', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.parasite.bottles[0]), second = buy(s, 1);
    reject(s, { type: 'CONSUME', bottleId: second.id });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.parasite.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateParasiteState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.parasite.bottles[2]!.id });
  });
  it('atomically enforces action, cash, city, battle and finished-run gates', () => {
    const withoutAction = dreamStealer(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = dreamStealer(); withoutCash.cash = 539; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.parasite.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.parasite.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.parasite.bottles[0]!.id });
  });
  it('blocks medicine during real old practice and uncompleted old preparation', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.dreamStealer.cases['announced-seat']!.contactOpen = true; },
      s => { s.dreamStealer.practice.playerPose = 'SEATED'; },
      s => { s.dreamStealer.practice.targetPaused = true; },
      s => { s.dreamStealer.practice.token = 'TARGET_HAND'; },
      s => { s.fireThief.cases['borrowed-flash']!.contactOpen = true; },
      s => { s.dreamStealer.cases['empty-performance']!.status = 'PREPARED'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.parasite.bottles[0]!.id, confirmed: true }); }
  });
  it('rejects invented bottle, recipe, identity and unconfirmed commands without mutation', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'parasite-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'dream-stealer-potion-1' }, { type: 'CONSUME', bottleId: 'parasite-potion-1', confirmed: true, target: 'anyone' }, { type: 'REFLECT', extra: true }, { type: 'STEAL_IDENTITY' }, { type: 'PARASITIZE', target: 'anyone' }];
    for (const command of malformed) { expect(validateParasiteCommand(command)).toBe(false); expect(isParasiteAcquisitionCommand(command)).toBe(false); reject(prepared(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'parasite-potion-999' });
  });
  it('routes exact life and encounter commands through the same public domain entry point', () => {
    const s = promoted();
    expect(validateParasiteCommand({ type: 'OBSERVE', caseId: 'shared-senses' })).toBe(true);
    expect(isParasiteAcquisitionCommand({ type: 'OBSERVE', caseId: 'shared-senses' })).toBe(false);
    act(s, { type: 'OBSERVE', caseId: 'shared-senses' }); expect(s.parasite.life.cases['shared-senses'].status).toBe('OBSERVED');
    act(s, { type: 'ENCOUNTER_TALK' }); expect(s.parasite.encounter.status).toBe('RESOLVED');
    expect(validateParasiteState(s)).toBe(true);
  });
  it('rejects forged source, bottle chronology, promotion snapshots and nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.parasite.bottles[0]!.source = 'invented'; },
      t => { t.parasite.bottles[0]!.consumedWeek = t.parasite.promotionWeek! - 1; },
      t => { t.parasite.dreamStealerActingAtPromotion = 99; },
      t => { delete t.progression.mastery[MARAUDER_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['error.s4.free-power'] = 0; },
      t => { t.parasite.bottles[1]!.labourSteps = 6; },
      t => { t.parasite.bottles[1]!.id = 'parasite-potion-1'; },
      t => { (t.parasite.bottles as unknown[])[0] = null; },
      t => { (t.parasite as unknown as Record<string, unknown>).life = null; },
      t => { (t.parasite.life as unknown as Record<string, unknown>).host = null; },
      t => { (t.parasite as unknown as Record<string, unknown>).encounter = null; },
      t => { t.parasite.life.host.token = 'HOST_HAND'; },
      t => { t.parasite.life.player.presence = 'INSIDE_HOST'; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateParasiteState(t)).not.toThrow(); expect(validateParasiteState(t)).toBe(false); }
  });
  it('projects only two real new zero-masteries and does not mutate originals', () => {
    const s = promoted(), before = structuredClone(s), p = projectParasite(s);
    expect(p.abilities.map(x => x.id)).toEqual([...PARASITE_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false });
    expect(p.cases).toHaveLength(3); expect(p.actions.some(a => a.command.type === 'OBSERVE')).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[PARASITE_ABILITY_IDS[0]]).toBe(0); expect(s).toEqual(before);
    expect(PARASITE_ABILITIES).toHaveLength(2);
    expect(PARASITE_SOURCE_STATUS).toContain('不能直接读取或干涉宿主思想');
    expect(PARASITE_SOURCE_STATUS).toContain('每次只偷一种');
    expect(PARASITE_SOURCE_STATUS).toContain('没有自身心智的秘偶');
    expect(PARASITE_SOURCE_STATUS).toContain('欺瞒导师');
  });
  it('migrates the real S5 continuing run without altering any old original or outcome', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/dream-stealer-v01060/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'combatHistory', 'progression', 'character'] as const) expect(s[key]).toEqual(previous[key]);
    expect([s.week, s.status, s.progression.sequence, s.progression.acting]).toEqual([71, 'ACTIVE', 5, 100]);
    expect(s.parasite).toEqual(createParasiteState()); expect(validateParasiteState(s)).toBe(true);
  });
});
