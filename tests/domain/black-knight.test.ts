import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../../src/domain/secret-supplicant/types.js';
import { LISTENER_ABILITY_IDS } from '../../src/domain/listener/types.js';
import { SHADOW_ASCETIC_ABILITY_IDS } from '../../src/domain/shadow-ascetic/types.js';
import { ROSE_BISHOP_ABILITY_IDS } from '../../src/domain/rose-bishop/types.js';
import { SHEPHERD_ABILITY_IDS } from '../../src/domain/shepherd/types.js';
import { applyBlackKnightCommand, createBlackKnightState, isBlackKnight, isBlackKnightAcquisitionCommand, projectBlackKnight, validateBlackKnightCommand, validateBlackKnightState } from '../../src/domain/black-knight/index.js';
import { BLACK_KNIGHT_ABILITIES, BLACK_KNIGHT_CONSUMPTION_RISK, BLACK_KNIGHT_FORMULA_STATUS, BLACK_KNIGHT_PRICES, BLACK_KNIGHT_SOURCE_STATUS } from '../../src/domain/black-knight/content.js';
import { BLACK_KNIGHT_ABILITY_IDS, type BlackKnightCommand } from '../../src/domain/black-knight/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed fixtures continue the real S5 save. Test resources and prescribed rolls are not natural-play evidence.
function shepherd(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/shepherd-v01100/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.blackKnight = createBlackKnightState(); s.week = s.shepherd.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: BlackKnightCommand, roll = 1) {
  const c = context(s, roll); applyBlackKnightCommand(s, command, c); return c;
}
function taught(s = shepherd()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.blackKnight.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.blackKnight.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyBlackKnightCommand(s, command as BlackKnightCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
const oldIds = [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS, ...SHADOW_ASCETIC_ABILITY_IDS, ...ROSE_BISHOP_ABILITY_IDS, ...SHEPHERD_ABILITY_IDS];
const oldStages = (s: SliceState) => [s.secretSupplicant, s.listener, s.shadowAscetic, s.roseBishop, s.shepherd, s.town, s.combatHistory];

describe('Black Knight S4 original ready bottles and recoverable G medicine', () => {
  it('keeps the future channel dormant and creates independent original state', () => {
    const s = createSliceRun('blackKnight-hidden', sliceDefaultCreationSelection, 'blackKnight-hidden');
    expect(validateBlackKnightState(s)).toBe(true);
    expect(projectBlackKnight(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectBlackKnight(s).story).toBeUndefined();
    const other = createBlackKnightState(); other.bottles[0]!.labourSteps = 5; other.resupply.deliveries = 1;
    expect(s.blackKnight).toEqual(createBlackKnightState()); expect(other.life).not.toBe(s.blackKnight.life); expect(other.encounter).not.toBe(s.blackKnight.encounter);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 540 and one action to the existing guide without granting a formula or changing any old stage', () => {
    const s = shepherd(), old = structuredClone(oldStages(s));
    expect(validateBlackKnightState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(c.check).not.toHaveBeenCalled(); expect(oldStages(s)).toEqual(old);
    expect(BLACK_KNIGHT_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    expect(BLACK_KNIGHT_FORMULA_STATUS).toContain('完整配方与晋升仪式细节尚未核实');
    expect(BLACK_KNIGHT_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(BLACK_KNIGHT_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    expect(projectBlackKnight(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(c.note).toHaveBeenCalledWith('听取黑骑士用药说明', expect.stringContaining('实际核对原瓶、准备原旧物间安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions, a nontransferable 5300 credit and 1500 payment for that bottle', () => {
    const s = taught(), b = s.blackKnight.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([37960, 94, 'PLAYER']);
    const second = s.blackKnight.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(6800); expect(validateBlackKnightState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 6799; reject(s, { type: 'BUY_POTION', bottleId: s.blackKnight.bottles[2]!.id });
  });
  it('allows early guidance but needs Shepherd digestion100 and twelve complete real weeks before drinking', () => {
    const s = shepherd(); s.week = 65; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateBlackKnightState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.shepherd.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectBlackKnight(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isBlackKnight(s)).toBe(true); expect(s.blackKnight.shepherdActingAtPromotion).toBe(100);
  });
  it('consumes only the selected original and executes each of the four fixed medicine outcomes', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.blackKnight.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect(c.note).toHaveBeenCalledWith('导师完成本次黑骑士服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.blackKnight.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 5) expect(s.progression.acting).toBe(100);
      expect(validateBlackKnightState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('leaves severe medicine failure recoverable without reviving bottles or granting battle protection', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    const b = s.blackKnight.bottles[0]!; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.progression.acting, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100, 100]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' }); expect(validateBlackKnightState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(BLACK_KNIGHT_CONSUMPTION_RISK).toContain('保护不适用于战斗');
  });
  it('blocks at health20 or mind40 before rolling and bounds actual successful spiritual cost at zero', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.blackKnight.bottles[0]!.id, confirmed: true });
      expect(s.blackKnight.bottles[0]!.status).toBe('PLAYER');
      expect(projectBlackKnight(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
    const s = prepared(); s.spirituality = 3;
    act(s, { type: 'CONSUME', bottleId: s.blackKnight.bottles[0]!.id, confirmed: true }, 30);
    expect(s.spirituality).toBe(0); expect(s.mind).toBe(92);
  });
  it('preserves all old mastery, people, borrowed originals, actual injuries and enemy outcomes while adding only three zero IDs without body changes', () => {
    const s = prepared(), old = structuredClone(oldStages(s)), stats = { ...s.character.coreStats }, gender = s.character.gender, mastery = { ...s.progression.mastery };
    act(s, { type: 'CONSUME', bottleId: s.blackKnight.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.gender).toBe(gender); expect(gender).toBe('FEMALE');
    expect(s.shepherd.encounter.status).toBe('RESOLVED');
    expect(s.shepherd.grazing.activeSpiritId).toBe('SH5-IRIS-1');
    expect(s.shepherd.grazing.spirits[0]).toMatchObject({ id: 'SH5-IRIS-1', status: 'GRAZED', selectedAbilities: ['light-touch', 'brief-ward', 'blur-mark'] });
    expect(s.shepherd.grazing.spirits[1]).toMatchObject({ id: 'SH5-CEDRIC-1', status: 'RELEASED', releasedWeek: 64 });
    expect(s.roseBishop.reserve).toMatchObject({ points: 1, max: 3, packetsBought: 6 });
    expect(Object.keys(s.progression.mastery)).toEqual([...oldIds, ...BLACK_KNIGHT_ABILITY_IDS]);
    for (const id of oldIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    expect(BLACK_KNIGHT_ABILITY_IDS).toEqual(['hanged-man.s4.flesh-soul-blade', 'hanged-man.s4.shadow-command', 'hanged-man.s4.fallen-shadow']);
    for (const id of BLACK_KNIGHT_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(s.blackKnight.life).toEqual(createBlackKnightState().life); expect(s.blackKnight.encounter).toEqual(createBlackKnightState().encounter);
    expect(projectBlackKnight(s).digestion).toContain('黑骑士扮演0/100'); expect(validateBlackKnightState(s)).toBe(true);
  });
  it('preserves all failed bottles and waits for the next actual week before another independent paid batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.blackKnight.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.blackKnight.bottles.slice(0, 3)).toEqual(originals); expect(s.blackKnight.bottles).toHaveLength(6);
    expect(s.blackKnight.bottles[3]).toMatchObject({ id: 'black-knight-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectBlackKnight(s).actions.find(a => a.id === 'buy-black-knight-potion-4')!.cost).toContain('6800便士');
    expect(validateBlackKnightState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.health = 100; s.mind = 100; const next = buy(s, 3); act(s, { type: 'CONSUME', bottleId: next.id, confirmed: true });
    expect(s.blackKnight.bottles.slice(0, 3)).toEqual(originals); expect(validateBlackKnightState(s)).toBe(true);
  });
  it('supports zero-action purchase and separately confirmed consumption of a selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.blackKnight.bottles[0]), second = buy(s, 1);
    reject(s, { type: 'CONSUME', bottleId: second.id });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.blackKnight.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateBlackKnightState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.blackKnight.bottles[2]!.id });
  });
  it('atomically enforces action, cash, city, combat and finished-run gates', () => {
    const withoutAction = shepherd(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = shepherd(); withoutCash.cash = 539; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.blackKnight.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.blackKnight.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.blackKnight.bottles[0]!.id });
  });
  it('blocks medicine while old contact, a real route, restraints or unfinished preparation remains', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.secretSupplicant.cases['ritual-ledger']!.contactOpen = true; },
      s => { s.listener.cases['wall-knock']!.contactOpen = true; },
      s => { Object.values(s.shadowAscetic.cases)[0]!.shadowOpen = true; },
      s => { Object.values(s.shadowAscetic.cases)[0]!.hidden = true; },
      s => { s.roseBishop.cases['ring-release']!.contactOpen = true; },
      s => { s.shepherd.cases['paper-guidance']!.contactOpen = true; },
      s => { s.shepherd.practice.paper = 'MARK'; },
      s => { s.shepherd.practice.playerNode = 'MARK'; },
      s => { s.shepherd.practice.chorusOpen = true; },
      s => { s.shepherd.practice.note = 'WRITTEN'; },
      s => { s.shepherd.cases['paper-guidance']!.status = 'PREPARED'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.blackKnight.bottles[0]!.id, confirmed: true }); }
  });
  it('rejects invented recipes, bottle identities and unconfirmed commands without mutation', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'black-knight-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'shepherd-potion-1' }, { type: 'CONSUME', bottleId: 'black-knight-potion-1', confirmed: true, target: 'anyone' }, { type: 'REFLECT', extra: true }, { type: 'TRANSFORM_MYTHIC' }, { type: 'EXTERNALIZE_SPIRIT', spiritId: 'SH5-IRIS-1' }, { type: 'COMMAND_SHADE' }, { type: 'GRAZE', spiritId: 'FREE-DEMIGOD', abilityIds: ['any'] }, { type: 'SPAWN_SHADE', confirmed: false }, { type: 'ACTIVATE_SPIRIT', spiritId: ['SH5-IRIS-1', 'SH5-CEDRIC-1'] }];
    for (const command of malformed) { expect(validateBlackKnightCommand(command)).toBe(false); expect(isBlackKnightAcquisitionCommand(command)).toBe(false); reject(prepared(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'black-knight-potion-999' });
  });
  it('recognizes exact life and encounter commands and routes observation through the unified domain entry point', () => {
    const s = promoted();
    expect(validateBlackKnightCommand({ type: 'OBSERVE', caseId: 'shadow-boundary' })).toBe(true);
    expect(isBlackKnightAcquisitionCommand({ type: 'OBSERVE', caseId: 'shadow-boundary' })).toBe(false);
    expect(validateBlackKnightCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    act(s, { type: 'OBSERVE', caseId: 'shadow-boundary' });
    expect(s.blackKnight.life.cases['shadow-boundary'].status).toBe('OBSERVED'); expect(validateBlackKnightState(s)).toBe(true);
  });
  it('routes inherited controls to the same original souls and never revives the permanently released Cedric', () => {
    const s = promoted(), souls = structuredClone(s.shepherd.grazing.spirits), reserve = structuredClone(s.roseBishop.reserve);
    const ap = s.actionsRemaining, spirituality = s.spirituality, mastery = { ...s.progression.mastery };
    expect(validateBlackKnightCommand({ type: 'ACTIVATE_SPIRIT', spiritId: null })).toBe(true);
    act(s, { type: 'ACTIVATE_SPIRIT', spiritId: null });
    expect(s.shepherd.grazing.activeSpiritId).toBeNull();
    act(s, { type: 'ACTIVATE_SPIRIT', spiritId: 'SH5-IRIS-1' });
    expect(s.shepherd.grazing.activeSpiritId).toBe('SH5-IRIS-1');
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap, spirituality]);
    expect(s.shepherd.grazing.spirits).toEqual(souls); expect(s.roseBishop.reserve).toEqual(reserve);
    expect(s.progression.mastery).toEqual(mastery);
    reject(s, { type: 'GRAZE', spiritId: 'SH5-CEDRIC-1', abilityIds: ['courage-song'] });
    reject(s, { type: 'ACTIVATE_SPIRIT', spiritId: 'SH5-CEDRIC-1' });
    reject(s, { type: 'RELEASE_SPIRIT', spiritId: 'SH5-CEDRIC-1', confirmed: true });
    reject(s, { type: 'MEET_SPIRITS' });
    expect(validateBlackKnightState(s)).toBe(true);
  });
  it('rejects forged sources, bottle chronology, snapshots and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.blackKnight.bottles[0]!.source = 'invented'; },
      t => { t.blackKnight.bottles[0]!.consumedWeek = t.blackKnight.promotionWeek! - 1; },
      t => { t.blackKnight.shepherdActingAtPromotion = 99; },
      t => { delete t.progression.mastery[SECRET_SUPPLICANT_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['hanged-man.s4.free-power'] = 0; },
      t => { t.blackKnight.bottles[1]!.labourSteps = 6; },
      t => { t.blackKnight.bottles[1]!.id = 'black-knight-potion-1'; },
      t => { (t.blackKnight.bottles as unknown[])[0] = null; },
      t => { (t.blackKnight as unknown as Record<string, unknown>).life = null; },
      t => { (t.blackKnight as unknown as Record<string, unknown>).encounter = null; },
      t => { t.blackKnight.resupply.requestedWeek = t.week; },
      t => { (t.blackKnight as unknown as Record<string, unknown>).freeMythicForm = true; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateBlackKnightState(t)).not.toThrow(); expect(validateBlackKnightState(t)).toBe(false); }
  });
  it('keeps projection read-only and separates own abilities, original inherited sources and unavailable higher-rank powers', () => {
    const s = promoted(), before = structuredClone(s), p = projectBlackKnight(s);
    expect(p.abilities.map(x => x.id)).toEqual([...BLACK_KNIGHT_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false });
    expect(p.cases).toHaveLength(3); expect(p.actions.some(a => a.command.type === 'OBSERVE')).toBe(true);
    expect(p.grazing).toMatchObject({ capacity: 7, activeSpiritId: 'SH5-IRIS-1' });
    expect(p.grazing!.spirits.find(spirit => spirit.id === 'SH5-CEDRIC-1')).toMatchObject({ status: 'RELEASED', releasedWeek: 64 });
    expect(p.reserve).toMatchObject({ points: 1, max: 3 });
    p.grazing!.spirits[0]!.selectedAbilities.push('forged-power');
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[BLACK_KNIGHT_ABILITY_IDS[0]]).toBe(0); expect(s).toEqual(before);
    expect(BLACK_KNIGHT_ABILITIES).toHaveLength(3);
    for (const boundary of ['三首圣堂', '必须实际命中', '不受本人控制', '7灵容量', '至多3项', '永久释放', '没有半神', '普通方法']) expect(BLACK_KNIGHT_SOURCE_STATUS).toContain(boundary);
  });
  it('validates canonical SQLite JSON ordering before promotion and after promotion without depending on insertion order', () => {
    for (const s of [shepherd(), taught(), prepared(), promoted()]) {
      const reordered = JSON.parse(stableStringify(s)) as SliceState;
      expect(validateBlackKnightState(reordered)).toBe(true);
      expect(projectBlackKnight(reordered)).toEqual(projectBlackKnight(s));
    }
    const s = prepared(), reordered = JSON.parse(stableStringify(s)) as SliceState;
    const command = JSON.parse(stableStringify({ type: 'CONSUME', bottleId: s.blackKnight.bottles[0]!.id, confirmed: true }));
    expect(validateBlackKnightCommand(command)).toBe(true); act(reordered, command);
    expect(isBlackKnight(reordered)).toBe(true); expect(validateBlackKnightState(JSON.parse(stableStringify(reordered)))).toBe(true);
  });
  it('migrates the real continuing Shepherd save without changing any old original or outcome', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/shepherd-v01100/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['secretSupplicant', 'listener', 'shadowAscetic', 'roseBishop', 'shepherd', 'combatHistory', 'progression', 'character'] as const) expect(s[key]).toEqual(previous[key]);
    expect([s.week, s.status, s.progression.sequence, s.progression.acting]).toEqual([65, 'ACTIVE', 5, 100]);
    expect(s.blackKnight).toEqual(createBlackKnightState()); expect(validateBlackKnightState(s)).toBe(true);
  });
});
