import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { CRIMINAL_ABILITY_IDS } from '../../src/domain/criminal/types.js';
import { UNWINGED_ABILITY_IDS } from '../../src/domain/unwinged/types.js';
import { SERIAL_KILLER_ABILITY_IDS } from '../../src/domain/serial-killer/types.js';
import { DEMON_ABILITY_IDS } from '../../src/domain/demon/types.js';
import { DESIRE_APOSTLE_ABILITY_IDS } from '../../src/domain/desire-apostle/types.js';
import { applyDevilCommand, createDevilState, isDevil, isDevilAcquisitionCommand, projectDevil, validateDevilCommand, validateDevilState } from '../../src/domain/devil/index.js';
import { DEVIL_ABILITIES, DEVIL_CONSUMPTION_RISK, DEVIL_FORMULA_STATUS, DEVIL_PRICES, DEVIL_SOURCE_STATUS } from '../../src/domain/devil/content.js';
import { DEVIL_ABILITY_IDS, type DevilCommand } from '../../src/domain/devil/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed fixtures continue the real S5 save. Test resources and prescribed rolls are not natural-play evidence.
function desireApostle(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/desire-apostle-v01110/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.devil = createDevilState(); s.week = s.desireApostle.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: DevilCommand, roll = 1) {
  const c = context(s, roll); applyDevilCommand(s, command, c); return c;
}
function taught(s = desireApostle()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.devil.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.devil.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDevilCommand(s, command as DevilCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
const oldIds = [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS, ...DEMON_ABILITY_IDS, ...DESIRE_APOSTLE_ABILITY_IDS];
const oldStages = (s: SliceState) => [s.criminal, s.unwinged, s.serialKiller, s.demon, s.desireApostle, s.town, s.combatHistory];

describe('Devil S4 original ready bottles and recoverable G medicine', () => {
  it('keeps the future channel dormant and creates independent original state', () => {
    const s = createSliceRun('devil-hidden', sliceDefaultCreationSelection, 'devil-hidden');
    expect(validateDevilState(s)).toBe(true);
    expect(projectDevil(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectDevil(s).story).toBeUndefined();
    const other = createDevilState(); other.bottles[0]!.labourSteps = 5; other.resupply.deliveries = 1;
    expect(s.devil).toEqual(createDevilState()); expect(other.life).not.toBe(s.devil.life); expect(other.encounter).not.toBe(s.devil.encounter);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 540 and one action to the existing guide without granting a formula or changing any old stage', () => {
    const s = desireApostle(), old = structuredClone(oldStages(s));
    expect(validateDevilState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(c.check).not.toHaveBeenCalled(); expect(oldStages(s)).toEqual(old);
    expect(DEVIL_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    expect(DEVIL_FORMULA_STATUS).toContain('完整配方与晋升仪式细节尚未核实');
    expect(DEVIL_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(DEVIL_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    expect(projectDevil(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(c.note).toHaveBeenCalledWith('听取魔鬼用药说明', expect.stringContaining('实际核对原瓶、准备原旧货库练习室安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions, a nontransferable 5300 credit and 1500 payment for that bottle', () => {
    const s = taught(), b = s.devil.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([37960, 94, 'PLAYER']);
    const second = s.devil.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(6800); expect(validateDevilState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 6799; reject(s, { type: 'BUY_POTION', bottleId: s.devil.bottles[2]!.id });
  });
  it('allows early guidance but needs Desire Apostle digestion100 and twelve complete real weeks before drinking', () => {
    const s = desireApostle(); s.week = s.desireApostle.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateDevilState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.desireApostle.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectDevil(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isDevil(s)).toBe(true); expect(s.devil.desireApostleActingAtPromotion).toBe(100);
  });
  it('consumes only the selected original and executes each of the four fixed medicine outcomes', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.devil.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect(c.note).toHaveBeenCalledWith('导师完成本次魔鬼服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.devil.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 5) expect(s.progression.acting).toBe(100);
      expect(validateDevilState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('leaves severe medicine failure recoverable without reviving bottles or granting battle protection', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    const b = s.devil.bottles[0]!; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.progression.acting, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100, 100]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' }); expect(validateDevilState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(DEVIL_CONSUMPTION_RISK).toContain('保护不适用于战斗');
  });
  it('blocks at health20 or mind40 before rolling and bounds actual successful spiritual cost at zero', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.devil.bottles[0]!.id, confirmed: true });
      expect(s.devil.bottles[0]!.status).toBe('PLAYER');
      expect(projectDevil(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
    const s = prepared(); s.spirituality = 3;
    act(s, { type: 'CONSUME', bottleId: s.devil.bottles[0]!.id, confirmed: true }, 30);
    expect(s.spirituality).toBe(0); expect(s.mind).toBe(92);
  });
  it('preserves every old Abyss domain, strain, original and outcome while adding exactly two zero G IDs', () => {
    const s = prepared(); s.demon.strain = 2;
    const old = structuredClone(oldStages(s)), stats = { ...s.character.coreStats }, gender = s.character.gender, mastery = { ...s.progression.mastery };
    act(s, { type: 'CONSUME', bottleId: s.devil.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.gender).toBe(gender);
    expect(s.desireApostle.encounter.status).toBe('RESOLVED');
    expect(s.desireApostle.practice).toMatchObject({ emotion: 'CALM', seed: 'SPENT', ledger: 'GUIDE', note: 'HANDED_OVER' });
    expect(Object.keys(s.progression.mastery)).toEqual([...oldIds, ...DEVIL_ABILITY_IDS]);
    for (const id of oldIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    expect(DEVIL_ABILITY_IDS).toEqual(['abyss.s4.desire-focus', 'abyss.s4.catalytic-pressure']);
    for (const id of DEVIL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting, s.demon.strain]).toEqual([31, 0, 2]);
    expect(s.devil.life).toEqual(createDevilState().life); expect(s.devil.encounter).toEqual(createDevilState().encounter);
    expect(projectDevil(s).digestion).toContain('魔鬼扮演0/100'); expect(validateDevilState(s)).toBe(true);
  });
  it('preserves all failed bottles and waits for the next actual week before another independent paid batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.devil.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.devil.bottles.slice(0, 3)).toEqual(originals); expect(s.devil.bottles).toHaveLength(6);
    expect(s.devil.bottles[3]).toMatchObject({ id: 'devil-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectDevil(s).actions.find(a => a.id === 'buy-devil-potion-4')!.cost).toContain('6800便士');
    expect(validateDevilState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.health = 100; s.mind = 100; const next = buy(s, 3); act(s, { type: 'CONSUME', bottleId: next.id, confirmed: true });
    expect(s.devil.bottles.slice(0, 3)).toEqual(originals); expect(validateDevilState(s)).toBe(true);
  });
  it('supports zero-action purchase and separately confirmed consumption of a selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.devil.bottles[0]), second = buy(s, 1);
    reject(s, { type: 'CONSUME', bottleId: second.id });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.devil.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateDevilState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.devil.bottles[2]!.id });
  });
  it('atomically enforces action, cash, city, combat and finished-run gates', () => {
    const withoutAction = desireApostle(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = desireApostle(); withoutCash.cash = 539; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.devil.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.devil.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.devil.bottles[0]!.id });
  });
  it('blocks medicine while any old contact, original object or unfinished preparation remains', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.criminal.cases['found-pay']!.holding = true; },
      s => { s.unwinged.cases['cold-grip']!.urgeOpen = true; },
      s => { s.serialKiller.cases['false-dedication']!.contactOpen = true; },
      s => { s.demon.cases['loading-lane']!.contactOpen = true; },
      s => { s.demon.practice.body = 'ENLARGED'; },
      s => { s.demon.practice.flame = 'LIT'; },
      s => { s.desireApostle.cases['eager-rehearsal']!.contactOpen = true; },
      s => { s.desireApostle.practice.ledger = 'PLAYER'; },
      s => { s.desireApostle.practice.note = 'WRITTEN'; },
      s => { s.desireApostle.practice.seed = 'PLANTED'; },
      s => { s.desireApostle.cases['honest-account']!.status = 'PREPARED'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.devil.bottles[0]!.id, confirmed: true }); }
  });
  it('rejects invented recipes, free contracts, flute effects and unconfirmed or foreign original bottles', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'devil-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'desire-apostle-potion-1' }, { type: 'CONSUME', bottleId: 'devil-potion-1', confirmed: true, target: 'anyone' }, { type: 'REFLECT', extra: true }, { type: 'TRANSFORM_MYTHIC' }, { type: 'BLOW_FALLEN_FLUTE' }, { type: 'SIGN_SOUL_CONTRACT' }, { type: 'CREATE_EMOTION' }, { type: 'OWN_SOUL', targetId: 'DV4-ORRICK-FANE' }];
    for (const command of malformed) { expect(validateDevilCommand(command)).toBe(false); expect(isDevilAcquisitionCommand(command)).toBe(false); reject(prepared(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'devil-potion-999' });
  });
  it('recognizes exact life and encounter commands and routes observation through the unified domain entry point', () => {
    const s = promoted();
    expect(validateDevilCommand({ type: 'OBSERVE', caseId: 'stage-decision' })).toBe(true);
    expect(isDevilAcquisitionCommand({ type: 'OBSERVE', caseId: 'stage-decision' })).toBe(false);
    expect(validateDevilCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    act(s, { type: 'OBSERVE', caseId: 'stage-decision' });
    expect(s.devil.life.cases['stage-decision'].status).toBe('OBSERVED'); expect(validateDevilState(s)).toBe(true);
  });
  it('rejects forged sources, bottle chronology, snapshots and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.devil.bottles[0]!.source = 'invented'; },
      t => { t.devil.bottles[0]!.consumedWeek = t.devil.promotionWeek! - 1; },
      t => { t.devil.desireApostleActingAtPromotion = 99; },
      t => { delete t.progression.mastery[CRIMINAL_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['abyss.s4.free-power'] = 0; },
      t => { t.devil.bottles[1]!.labourSteps = 6; },
      t => { t.devil.bottles[1]!.id = 'devil-potion-1'; },
      t => { (t.devil.bottles as unknown[])[0] = null; },
      t => { (t.devil as unknown as Record<string, unknown>).life = null; },
      t => { (t.devil as unknown as Record<string, unknown>).encounter = null; },
      t => { t.devil.resupply.requestedWeek = t.week; },
      t => { (t.devil as unknown as Record<string, unknown>).freeMythicForm = true; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateDevilState(t)).not.toThrow(); expect(validateDevilState(t)).toBe(false); }
  });
  it('keeps public projection read-only and explicitly bounds the unverified S4 ability list', () => {
    const s = promoted(), before = structuredClone(s), p = projectDevil(s);
    expect(p.abilities.map(x => x.id)).toEqual([...DEVIL_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, strain: s.demon.strain });
    expect(p.cases).toHaveLength(3); expect(p.actions.some(a => a.command.type === 'OBSERVE')).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[DEVIL_ABILITY_IDS[0]]).toBe(0); expect(s).toEqual(before);
    expect(DEVIL_ABILITIES).toHaveLength(2);
    for (const boundary of ['呓语者', '人物推断', '完整技能表', '原创G训练名称', '强烈情绪', '长生泉', '堕落之笛', '灵魂所有权', '普通方法']) expect(DEVIL_SOURCE_STATUS).toContain(boundary);
    expect(DEVIL_ABILITIES.every(ability => ability.label.includes('原创G'))).toBe(true);
  });
  it('validates canonical SQLite JSON ordering before promotion and after promotion without depending on insertion order', () => {
    for (const s of [desireApostle(), taught(), prepared(), promoted()]) {
      const reordered = JSON.parse(stableStringify(s)) as SliceState;
      expect(validateDevilState(reordered)).toBe(true);
      expect(projectDevil(reordered)).toEqual(projectDevil(s));
    }
    const s = prepared(), reordered = JSON.parse(stableStringify(s)) as SliceState;
    const command = JSON.parse(stableStringify({ type: 'CONSUME', bottleId: s.devil.bottles[0]!.id, confirmed: true }));
    expect(validateDevilCommand(command)).toBe(true); act(reordered, command);
    expect(isDevil(reordered)).toBe(true); expect(validateDevilState(JSON.parse(stableStringify(reordered)))).toBe(true);
  });
  it('migrates the real continuing Desire Apostle save without changing any old original or outcome', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/desire-apostle-v01110/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['criminal', 'unwinged', 'serialKiller', 'demon', 'desireApostle', 'combatHistory', 'progression', 'character'] as const) expect(s[key]).toEqual(previous[key]);
    expect([s.week, s.status, s.progression.sequence, s.progression.acting]).toEqual([77, 'ACTIVE', 5, 100]);
    expect(s.devil).toEqual(createDevilState()); expect(validateDevilState(s)).toBe(true);
  });
});
