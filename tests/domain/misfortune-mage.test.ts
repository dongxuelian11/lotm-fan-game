import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { MONSTER_ABILITY_IDS } from '../../src/domain/monster/types.js';
import { MACHINE_ABILITY_IDS } from '../../src/domain/machine/types.js';
import { LUCKY_ABILITY_IDS } from '../../src/domain/lucky/types.js';
import { CALAMITY_PRIEST_ABILITY_IDS } from '../../src/domain/calamity-priest/types.js';
import { WINNER_ABILITY_IDS } from '../../src/domain/winner/types.js';
import { applyMisfortuneMageCommand, createMisfortuneMageState, isMisfortuneMage, isMisfortuneMageAcquisitionCommand, projectMisfortuneMage, validateMisfortuneMageCommand, validateMisfortuneMageState } from '../../src/domain/misfortune-mage/index.js';
import { MISFORTUNE_MAGE_ABILITIES, MISFORTUNE_MAGE_CONSUMPTION_RISK, MISFORTUNE_MAGE_FORMULA_STATUS, MISFORTUNE_MAGE_PRICES, MISFORTUNE_MAGE_SOURCE_STATUS } from '../../src/domain/misfortune-mage/content.js';
import { MISFORTUNE_MAGE_ABILITY_IDS, type MisfortuneMageCommand } from '../../src/domain/misfortune-mage/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed fixtures continue the real Winner save. Test resources and prescribed rolls are not natural-play evidence.
function winner(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/winner-v01130/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.misfortuneMage = createMisfortuneMageState(); s.week = Math.max(s.week, s.winner.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: MisfortuneMageCommand, roll = 1) {
  const c = context(s, roll); applyMisfortuneMageCommand(s, command, c); return c;
}
function taught(s = winner()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.misfortuneMage.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.misfortuneMage.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyMisfortuneMageCommand(s, command as MisfortuneMageCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
const oldIds = [...MONSTER_ABILITY_IDS, ...MACHINE_ABILITY_IDS, ...LUCKY_ABILITY_IDS, ...CALAMITY_PRIEST_ABILITY_IDS, ...WINNER_ABILITY_IDS];
const oldStages = (s: SliceState) => [s.monster, s.machine, s.lucky, s.calamityPriest, s.winner, s.town, s.combatHistory];

describe('Misfortune Mage candidate S4 independent bottles and recoverable G medicine', () => {
  it('keeps the unvisited channel dormant and every new run independent, with no second luck pool', () => {
    const s = createSliceRun('misfortune-hidden', sliceDefaultCreationSelection, 'misfortune-hidden');
    expect(validateMisfortuneMageState(s)).toBe(true);
    expect(projectMisfortuneMage(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '' });
    expect(projectMisfortuneMage(s).story).toBeUndefined();
    const other = createMisfortuneMageState(); other.bottles[0]!.labourSteps = 5; other.resupply.deliveries = 1;
    expect(s.misfortuneMage).toEqual(createMisfortuneMageState()); expect(other.life).not.toBe(s.misfortuneMage.life); expect(other.encounter).not.toBe(s.misfortuneMage.encounter);
    expect(Object.hasOwn(s.misfortuneMage, 'luck')).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 540 and one action to the same guide without granting a formula or touching the old five stages', () => {
    const s = winner(), old = structuredClone(oldStages(s));
    expect(validateMisfortuneMageState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(c.check).not.toHaveBeenCalled(); expect(oldStages(s)).toEqual(old);
    expect(MISFORTUNE_MAGE_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    for (const phrase of ['完整配方与晋升仪式细节尚未核实', '不能据未知细节断言无需仪式', '不冒充已还原原著仪式']) expect(MISFORTUNE_MAGE_FORMULA_STATUS).toContain(phrase);
    expect(projectMisfortuneMage(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(c.note).toHaveBeenCalledWith('听取厄运法师用药说明', expect.stringContaining('实际核对原瓶、准备原报时铺安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real jobs, a bottle-specific 5300 credit, and the remaining 1500 payment', () => {
    const s = taught(), b = s.misfortuneMage.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([37960, 94, 'PLAYER']);
    const second = s.misfortuneMage.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(6800); expect(validateMisfortuneMageState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 6799; reject(s, { type: 'BUY_POTION', bottleId: s.misfortuneMage.bottles[2]!.id });
  });
  it('permits advance preparation but needs Winner digestion100 and twelve complete actual weeks', () => {
    const s = winner(); s.week = s.winner.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateMisfortuneMageState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.winner.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectMisfortuneMage(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isMisfortuneMage(s)).toBe(true); expect(s.misfortuneMage.winnerActingAtPromotion).toBe(100);
  });
  it('consumes only the selected original and executes all four medicine outcomes without altering any old ledger', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = structuredClone(oldStages(s)), mastery = { ...s.progression.mastery }, b = s.misfortuneMage.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect(c.note).toHaveBeenCalledWith('导师完成本次厄运法师服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence, 'ACTIVE']);
      expect(oldStages(s)).toEqual(old); for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.misfortuneMage.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 5) expect(s.progression.acting).toBe(100);
      expect(validateMisfortuneMageState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('leaves severe medicine failure recoverable, but does not restore bottles or extend protection to battle', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    const b = s.misfortuneMage.bottles[0]!; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.progression.acting, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100, 100]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' }); expect(validateMisfortuneMageState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(MISFORTUNE_MAGE_CONSUMPTION_RISK).toContain('保护不适用于战斗');
  });
  it('blocks health20 and mind40 before rolling and floors actual successful spirituality at zero', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.misfortuneMage.bottles[0]!.id, confirmed: true });
      expect(s.misfortuneMage.bottles[0]!.status).toBe('PLAYER');
      expect(projectMisfortuneMage(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
    const s = prepared(); s.spirituality = 3;
    act(s, { type: 'CONSUME', bottleId: s.misfortuneMage.bottles[0]!.id, confirmed: true }, 30);
    expect(s.spirituality).toBe(0); expect(isMisfortuneMage(s)).toBe(true); expect(validateMisfortuneMageState(s)).toBe(true);
  });
  it('adds only the two G practices, preserving old originals, mastery, body, enemy and real luck2/5/3', () => {
    const s = prepared(), old = structuredClone(oldStages(s)), stats = { ...s.character.coreStats }, gender = s.character.gender, mastery = { ...s.progression.mastery };
    const sameLuck = s.winner.luck;
    act(s, { type: 'CONSUME', bottleId: s.misfortuneMage.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.gender).toBe(gender); expect(s.winner.luck).toBe(sameLuck);
    expect(s.winner.luck).toEqual({ stored: 2, accumulated: 5, spent: 3, lastAccumulateWeek: 67 });
    expect(s.winner.encounter.status).toBe('RESOLVED'); expect(s.winner.practice).toEqual({ counter: 'GUIDE', ring: 'OWNER', note: 'HANDED_OVER' });
    expect(Object.keys(s.progression.mastery).sort()).toEqual([...oldIds, ...MISFORTUNE_MAGE_ABILITY_IDS].sort());
    for (const id of oldIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    expect(MISFORTUNE_MAGE_ABILITY_IDS).toEqual(['wheel.s4.precaution-practice', 'wheel.s4.bounded-misfortune']);
    for (const id of MISFORTUNE_MAGE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    const initial = createMisfortuneMageState(); expect(s.misfortuneMage.life).toEqual(initial.life); expect(s.misfortuneMage.encounter).toEqual(initial.encounter);
    expect(projectMisfortuneMage(s).digestion).toContain('厄运法师扮演0/100'); expect(validateMisfortuneMageState(s)).toBe(true);
  });
  it('keeps the real reserve untouched even when zero or capped, and caps actual stat growth at500', () => {
    for (const stored of [0, 3]) {
      const s = prepared(); s.winner.luck.stored = stored; s.winner.luck.accumulated = s.winner.luck.spent + stored;
      const ledger = structuredClone(s.winner.luck); s.character.coreStats.physique = 500;
      act(s, { type: 'CONSUME', bottleId: s.misfortuneMage.bottles[0]!.id, confirmed: true });
      expect(s.winner.luck).toEqual(ledger); expect(s.character.coreStats.physique).toBe(500); expect(Object.hasOwn(s.misfortuneMage, 'luck')).toBe(false);
    }
  });
  it('keeps failed originals and waits for the next actual week before receiving another independently paid batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.misfortuneMage.bottles), old = structuredClone(oldStages(s)), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.misfortuneMage.bottles.slice(0, 3)).toEqual(originals); expect(s.misfortuneMage.bottles).toHaveLength(6); expect(oldStages(s)).toEqual(old);
    expect(s.misfortuneMage.bottles[3]).toMatchObject({ id: 'misfortune-mage-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectMisfortuneMage(s).actions.find(a => a.id === 'buy-misfortune-mage-potion-4')!.cost).toContain('6800便士');
    expect(validateMisfortuneMageState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.health = 100; s.mind = 100; const next = buy(s, 3); act(s, { type: 'CONSUME', bottleId: next.id, confirmed: true });
    expect(s.misfortuneMage.bottles.slice(0, 3)).toEqual(originals); expect(validateMisfortuneMageState(s)).toBe(true);
  });
  it('supports zero-action purchase and separately confirmed consumption of the selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.misfortuneMage.bottles[0]), second = buy(s, 1);
    reject(s, { type: 'CONSUME', bottleId: second.id });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.misfortuneMage.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateMisfortuneMageState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.misfortuneMage.bottles[2]!.id });
  });
  it('enforces action, cash, city, combat and finished-run gates before mutation', () => {
    const noAction = winner(); noAction.actionsRemaining = 0; reject(noAction, { type: 'LEARN_GUIDANCE' });
    const noCash = winner(); noCash.cash = 539; reject(noCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.misfortuneMage.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.misfortuneMage.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.misfortuneMage.bottles[0]!.id });
  });
  it('blocks drinking while any old contact, held original, mental focus or unfinished preparation remains', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.monster.cases['falling-sign']!.contactOpen = true; },
      s => { s.machine.cases['timing-board']!.contactOpen = true; },
      s => { s.lucky.cases['next-carriage']!.contactOpen = true; },
      s => { s.calamityPriest.cases['rain-rack']!.contactOpen = true; },
      s => { s.calamityPriest.practice.board = 'UNSTABLE'; },
      s => { s.calamityPriest.practice.board = 'FALLEN'; },
      s => { s.calamityPriest.practice.contact = 'FOCUSED'; },
      s => { s.winner.cases['falling-counter']!.contactOpen = true; },
      s => { s.winner.practice.counter = 'CAUGHT'; },
      s => { s.winner.practice.ring = 'MAT'; },
      s => { s.winner.practice.note = 'WRITTEN'; },
      s => { s.winner.cases['honest-account']!.status = 'PREPARED'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.misfortuneMage.bottles[0]!.id, confirmed: true }); }
  });
  it('rejects invented recipes, free fortune, rewinds, forced dice and unconfirmed or foreign originals', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'misfortune-mage-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'winner-potion-1' }, { type: 'CONSUME', bottleId: 'misfortune-mage-potion-1', confirmed: true, target: 'anyone' }, { type: 'REFLECT', extra: true }, { type: 'REFILL_LUCK' }, { type: 'CREATE_PROBABILITY_DICE' }, { type: 'REWIND' }, { type: 'FORCE_SUCCESS' }, { type: 'PERMANENT_CURSE' }, { type: 'MERCURY_BODY' }];
    for (const command of malformed) { expect(validateMisfortuneMageCommand(command)).toBe(false); expect(isMisfortuneMageAcquisitionCommand(command)).toBe(false); reject(prepared(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'misfortune-mage-potion-999' });
  });
  it('routes exact life commands and encounters through the unified domain entry point', () => {
    const s = promoted();
    expect(validateMisfortuneMageCommand({ type: 'OBSERVE', caseId: 'uncertain-weight' })).toBe(true);
    expect(isMisfortuneMageAcquisitionCommand({ type: 'OBSERVE', caseId: 'uncertain-weight' })).toBe(false);
    expect(validateMisfortuneMageCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateMisfortuneMageCommand({ type: 'ACCUMULATE' })).toBe(true);
    act(s, { type: 'OBSERVE', caseId: 'uncertain-weight' });
    expect(s.misfortuneMage.life.cases['uncertain-weight'].status).toBe('OBSERVED'); expect(validateMisfortuneMageState(s)).toBe(true);
  });
  it('rejects forged sources, dates, snapshots, duplicate reserves and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.misfortuneMage.bottles[0]!.source = 'invented'; },
      t => { t.misfortuneMage.bottles[0]!.consumedWeek = t.misfortuneMage.promotionWeek! - 1; },
      t => { t.misfortuneMage.winnerActingAtPromotion = 99; },
      t => { delete t.progression.mastery[MONSTER_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['wheel.s4.free-power'] = 0; },
      t => { t.misfortuneMage.bottles[1]!.labourSteps = 6; },
      t => { t.misfortuneMage.bottles[1]!.id = 'misfortune-mage-potion-1'; },
      t => { (t.misfortuneMage.bottles as unknown[])[0] = null; },
      t => { (t.misfortuneMage as unknown as Record<string, unknown>).life = null; },
      t => { (t.misfortuneMage as unknown as Record<string, unknown>).encounter = null; },
      t => { t.misfortuneMage.resupply.requestedWeek = t.week; },
      t => { (t.misfortuneMage as unknown as Record<string, unknown>).luck = structuredClone(t.winner.luck); },
      t => { (t.misfortuneMage as unknown as Record<string, unknown>).freeMythicForm = true; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateMisfortuneMageState(t)).not.toThrow(); expect(validateMisfortuneMageState(t)).toBe(false); }
  });
  it('returns a read-only projection and visibly distinguishes uncertain source claims from the two G practices', () => {
    const s = promoted(), before = structuredClone(s), p = projectMisfortuneMage(s);
    expect(p.abilities.map(x => x.id)).toEqual([...MISFORTUNE_MAGE_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false });
    expect(p.cases).toHaveLength(3); expect(p.actions.some(a => a.command.type === 'OBSERVE')).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[MISFORTUNE_MAGE_ABILITY_IDS[0]]).toBe(0); expect(s).toEqual(before);
    expect(p.title).toContain('候选'); expect(MISFORTUNE_MAGE_ABILITIES).toHaveLength(2);
    for (const boundary of ['第六部第77章', '混乱行者', '尚未直接核实', '混合特性', '唯一幸运账本', '等量厄运债', '重掷', '普通方法', '不是无风险消化']) expect(MISFORTUNE_MAGE_SOURCE_STATUS).toContain(boundary);
    expect(MISFORTUNE_MAGE_ABILITIES.every(a => a.label.includes('原创G') && a.description.includes('尚未核实为原著序列4新增职业能力'))).toBe(true);
  });
  it('accepts canonical SQLite JSON key order without changing promotion behavior or original state', () => {
    for (const s of [winner(), taught(), prepared(), promoted()]) {
      const reordered = JSON.parse(stableStringify(s)) as SliceState;
      expect(validateMisfortuneMageState(reordered)).toBe(true); expect(projectMisfortuneMage(reordered)).toEqual(projectMisfortuneMage(s));
    }
    const s = prepared(), reordered = JSON.parse(stableStringify(s)) as SliceState;
    const command = JSON.parse(stableStringify({ type: 'CONSUME', bottleId: s.misfortuneMage.bottles[0]!.id, confirmed: true }));
    expect(validateMisfortuneMageCommand(command)).toBe(true); act(reordered, command);
    expect(isMisfortuneMage(reordered)).toBe(true); expect(validateMisfortuneMageState(JSON.parse(stableStringify(reordered)))).toBe(true);
  });
  it('migrates the actual261-command continuing Winner route without changing any old original or luck history', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/winner-v01130/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(261); expect(fixture.seed).toBe('monster-natural-v060');
    const previous = fixture.final, s = migrateSliceState(previous);
    for (const key of ['monster', 'machine', 'lucky', 'calamityPriest', 'winner', 'combatHistory', 'progression', 'character'] as const) expect(s[key]).toEqual(previous[key]);
    expect([s.week, s.status, s.progression.sequence, s.progression.acting, s.health, s.mind, s.spirituality]).toEqual([67, 'ACTIVE', 5, 100, 100, 100, 92]);
    expect(s.winner.luck).toEqual({ stored: 2, accumulated: 5, spent: 3, lastAccumulateWeek: 67 });
    expect(s.misfortuneMage).toEqual(createMisfortuneMageState()); expect(validateMisfortuneMageState(s)).toBe(true);
  });
});
