import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { ASSASSIN_ABILITY_IDS } from '../../src/domain/assassin/types.js';
import { INSTIGATOR_ABILITY_IDS } from '../../src/domain/instigator/types.js';
import { WITCH_ABILITY_IDS } from '../../src/domain/witch/types.js';
import { PLEASURE_ABILITY_IDS } from '../../src/domain/pleasure/types.js';
import { PAIN_ABILITY_IDS } from '../../src/domain/pain/types.js';
import { applyDespairCommand, createDespairState, isDespair, isDespairAcquisitionCommand, projectDespair, validateDespairCommand, validateDespairState } from '../../src/domain/despair/index.js';
import { DESPAIR_ABILITIES, DESPAIR_CONSUMPTION_RISK, DESPAIR_FORMULA_STATUS, DESPAIR_PRICES, DESPAIR_SOURCE_STATUS } from '../../src/domain/despair/content.js';
import { DESPAIR_ABILITY_IDS, type DespairCommand } from '../../src/domain/despair/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed fixtures continue the real S5 save. Test resources and prescribed rolls are not natural-play evidence.
function pain(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/pain-v01080/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.despair = createDespairState(); s.week = s.pain.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: DespairCommand, roll = 1) {
  const c = context(s, roll); applyDespairCommand(s, command, c); return c;
}
function taught(s = pain()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.despair.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.despair.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDespairCommand(s, command as DespairCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
const oldIds = [...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS, ...WITCH_ABILITY_IDS, ...PLEASURE_ABILITY_IDS, ...PAIN_ABILITY_IDS];
const oldStages = (s: SliceState) => [s.assassin, s.instigator, s.witch, s.pleasure, s.pain, s.town, s.combatHistory];

describe('Despair Demoness S4 original ready bottles and recoverable G medicine', () => {
  it('keeps the future channel dormant and creates independent original state', () => {
    const s = createSliceRun('despair-hidden', sliceDefaultCreationSelection, 'despair-hidden');
    expect(validateDespairState(s)).toBe(true);
    expect(projectDespair(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectDespair(s).story).toBeUndefined();
    const other = createDespairState(); other.bottles[0]!.labourSteps = 5; other.resupply.deliveries = 1;
    expect(s.despair).toEqual(createDespairState()); expect(other.life).not.toBe(s.despair.life); expect(other.encounter).not.toBe(s.despair.encounter);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 540 and one action to the existing guide without granting a formula or changing any old stage', () => {
    const s = pain(), old = structuredClone(oldStages(s));
    expect(validateDespairState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(c.check).not.toHaveBeenCalled(); expect(oldStages(s)).toEqual(old);
    expect(DESPAIR_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    expect(DESPAIR_FORMULA_STATUS).toContain('完整配方与晋升仪式细节尚未核实');
    expect(DESPAIR_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(DESPAIR_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    expect(projectDespair(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(c.note).toHaveBeenCalledWith('听取绝望魔女用药说明', expect.stringContaining('实际核对原瓶、准备原独立练习场安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions, a nontransferable 5300 credit and 1500 payment for that bottle', () => {
    const s = taught(), b = s.despair.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([37960, 94, 'PLAYER']);
    const second = s.despair.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(6800); expect(validateDespairState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 6799; reject(s, { type: 'BUY_POTION', bottleId: s.despair.bottles[2]!.id });
  });
  it('allows early guidance but needs Pain digestion100 and twelve complete real weeks before drinking', () => {
    const s = pain(); s.week = s.pain.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateDespairState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.pain.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectDespair(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isDespair(s)).toBe(true); expect(s.despair.painActingAtPromotion).toBe(100);
  });
  it('consumes only the selected original and executes each of the four fixed medicine outcomes', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.despair.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect(c.note).toHaveBeenCalledWith('导师完成本次绝望魔女服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.despair.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 5) expect(s.progression.acting).toBe(100);
      expect(validateDespairState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('leaves severe medicine failure recoverable without reviving bottles or granting battle protection', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    const b = s.despair.bottles[0]!; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.progression.acting, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100, 100]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' }); expect(validateDespairState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(DESPAIR_CONSUMPTION_RISK).toContain('保护不适用于战斗');
  });
  it('blocks at health20 or mind40 before rolling and bounds actual successful spiritual cost at zero', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.despair.bottles[0]!.id, confirmed: true });
      expect(s.despair.bottles[0]!.status).toBe('PLAYER');
      expect(projectDespair(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
    const s = prepared(); s.spirituality = 3;
    act(s, { type: 'CONSUME', bottleId: s.despair.bottles[0]!.id, confirmed: true }, 30);
    expect(s.spirituality).toBe(0); expect(s.mind).toBe(92);
  });
  it('preserves all old mastery, people, borrowed originals, actual injuries and enemy outcomes while adding only one zero ID without a second body change', () => {
    const s = prepared(), old = structuredClone(oldStages(s)), stats = { ...s.character.coreStats }, gender = s.character.gender, mastery = { ...s.progression.mastery };
    act(s, { type: 'CONSUME', bottleId: s.despair.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.gender).toBe(gender); expect(gender).toBe('FEMALE');
    expect(s.witch.previousGender).toBe('MALE');
    expect(s.pain.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'DEAD', enemyHealth: 0, enemyDisease: 1 });
    expect(s.witch.tools).toMatchObject({ kitsBought: 4, powderHeld: 7, powderUsed: 5, mirrorsHeld: 0, mirrorsUsed: 4 });
    expect(Object.keys(s.progression.mastery)).toEqual([...oldIds, ...DESPAIR_ABILITY_IDS]);
    for (const id of oldIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    expect(DESPAIR_ABILITY_IDS).toEqual(['assassin.s4.plague']);
    for (const id of DESPAIR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(s.despair.life).toEqual(createDespairState().life); expect(s.despair.encounter).toEqual(createDespairState().encounter);
    expect(projectDespair(s).digestion).toContain('绝望魔女扮演0/100'); expect(validateDespairState(s)).toBe(true);
  });
  it('preserves all failed bottles and waits for the next actual week before another independent paid batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.despair.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.despair.bottles.slice(0, 3)).toEqual(originals); expect(s.despair.bottles).toHaveLength(6);
    expect(s.despair.bottles[3]).toMatchObject({ id: 'despair-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectDespair(s).actions.find(a => a.id === 'buy-despair-potion-4')!.cost).toContain('6800便士');
    expect(validateDespairState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.health = 100; s.mind = 100; const next = buy(s, 3); act(s, { type: 'CONSUME', bottleId: next.id, confirmed: true });
    expect(s.despair.bottles.slice(0, 3)).toEqual(originals); expect(validateDespairState(s)).toBe(true);
  });
  it('supports zero-action purchase and separately confirmed consumption of a selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.despair.bottles[0]), second = buy(s, 1);
    reject(s, { type: 'CONSUME', bottleId: second.id });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.despair.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateDespairState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.despair.bottles[2]!.id });
  });
  it('atomically enforces action, cash, city, combat and finished-run gates', () => {
    const withoutAction = pain(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = pain(); withoutCash.cash = 539; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.despair.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.despair.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.despair.bottles[0]!.id });
  });
  it('blocks medicine while old contact, a real route, restraints or unfinished preparation remains', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.pain.cases['exit-markers']!.contactOpen = true; },
      s => { s.pain.practice.playerNode = 'SAFE_MARK'; },
      s => { s.pain.practice.marker = 'DOOR_MARK'; },
      s => { s.pleasure.practice.wrist = 'SILK'; },
      s => { s.pleasure.practice.fireSilk = 'ON_FRAME'; },
      s => { s.assassin.cases['upper-draft']!.position = 'UPPER'; },
      s => { s.instigator.cases['stage-rivalry']!.tension = 'HEATED'; },
      s => { s.witch.cases['shade-test']!.status = 'PREPARED'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.despair.bottles[0]!.id, confirmed: true }); }
  });
  it('rejects invented recipes, bottle identities and unconfirmed commands without mutation', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'despair-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'pain-potion-1' }, { type: 'CONSUME', bottleId: 'despair-potion-1', confirmed: true, target: 'anyone' }, { type: 'REFLECT', extra: true }, { type: 'TRANSFORM_MYTHIC' }, { type: 'SPREAD_PLAGUE', target: 'volunteer' }, { type: 'SMOG_RITUAL' }];
    for (const command of malformed) { expect(validateDespairCommand(command)).toBe(false); expect(isDespairAcquisitionCommand(command)).toBe(false); reject(prepared(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'despair-potion-999' });
  });
  it('recognizes exact life and encounter commands and routes observation through the unified domain entry point', () => {
    const s = promoted();
    expect(validateDespairCommand({ type: 'OBSERVE', caseId: 'room-clearance' })).toBe(true);
    expect(isDespairAcquisitionCommand({ type: 'OBSERVE', caseId: 'room-clearance' })).toBe(false);
    expect(validateDespairCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateDespairCommand({ type: 'ENCOUNTER_AID' })).toBe(true);
    act(s, { type: 'OBSERVE', caseId: 'room-clearance' });
    expect(s.despair.life.cases['room-clearance'].status).toBe('OBSERVED'); expect(validateDespairState(s)).toBe(true);
  });
  it('rejects forged sources, bottle chronology, snapshots and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.despair.bottles[0]!.source = 'invented'; },
      t => { t.despair.bottles[0]!.consumedWeek = t.despair.promotionWeek! - 1; },
      t => { t.despair.painActingAtPromotion = 99; },
      t => { delete t.progression.mastery[ASSASSIN_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['assassin.s4.free-power'] = 0; },
      t => { t.despair.bottles[1]!.labourSteps = 6; },
      t => { t.despair.bottles[1]!.id = 'despair-potion-1'; },
      t => { (t.despair.bottles as unknown[])[0] = null; },
      t => { (t.despair as unknown as Record<string, unknown>).life = null; },
      t => { (t.despair as unknown as Record<string, unknown>).encounter = null; },
      t => { t.despair.resupply.requestedWeek = t.week; },
      t => { (t.despair as unknown as Record<string, unknown>).freeMythicForm = true; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateDespairState(t)).not.toThrow(); expect(validateDespairState(t)).toBe(false); }
  });
  it('keeps projection read-only and separates fictional rehearsal, active withdrawal and higher-rank powers', () => {
    const s = promoted(), before = structuredClone(s), p = projectDespair(s);
    expect(p.abilities.map(x => x.id)).toEqual([...DESPAIR_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false });
    expect(p.cases).toHaveLength(3); expect(p.actions.some(a => a.command.type === 'OBSERVE')).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[DESPAIR_ABILITY_IDS[0]]).toBe(0); expect(s).toEqual(before);
    expect(DESPAIR_ABILITIES).toHaveLength(1);
    for (const boundary of ['不完整神话形态', '不老魔女', '友军天然免疫', '已有感染', '风雨', '潘娜蒂亚', '纸面虚构']) expect(DESPAIR_SOURCE_STATUS).toContain(boundary);
  });
  it('validates canonical SQLite JSON ordering before promotion and after promotion without depending on insertion order', () => {
    for (const s of [pain(), taught(), prepared(), promoted()]) {
      const reordered = JSON.parse(stableStringify(s)) as SliceState;
      expect(validateDespairState(reordered)).toBe(true);
      expect(projectDespair(reordered)).toEqual(projectDespair(s));
    }
    const s = prepared(), reordered = JSON.parse(stableStringify(s)) as SliceState;
    const command = JSON.parse(stableStringify({ type: 'CONSUME', bottleId: s.despair.bottles[0]!.id, confirmed: true }));
    expect(validateDespairCommand(command)).toBe(true); act(reordered, command);
    expect(isDespair(reordered)).toBe(true); expect(validateDespairState(JSON.parse(stableStringify(reordered)))).toBe(true);
  });
  it('migrates the real continuing Pain save without changing any old original or outcome', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/pain-v01080/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'combatHistory', 'progression', 'character'] as const) expect(s[key]).toEqual(previous[key]);
    expect([s.week, s.status, s.progression.sequence, s.progression.acting]).toEqual([77, 'ACTIVE', 5, 100]);
    expect(s.despair).toEqual(createDespairState()); expect(validateDespairState(s)).toBe(true);
  });
});
