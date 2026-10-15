import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { WARRIOR_ABILITY_IDS } from '../../src/domain/warrior/types.js';
import { GLADIATOR_ABILITY_IDS } from '../../src/domain/gladiator/types.js';
import { WEAPONMASTER_ABILITY_IDS } from '../../src/domain/weaponmaster/types.js';
import { DAWN_PALADIN_ABILITY_IDS } from '../../src/domain/dawn-paladin/types.js';
import { GUARDIAN_ABILITY_IDS } from '../../src/domain/guardian/types.js';
import { applyDemonHunterCommand, createDemonHunterState, isDemonHunter, isDemonHunterAcquisitionCommand, projectDemonHunter, validateDemonHunterCommand, validateDemonHunterState } from '../../src/domain/demon-hunter/index.js';
import { DEMON_HUNTER_ABILITIES, DEMON_HUNTER_CONSUMPTION_RISK, DEMON_HUNTER_FORMULA_STATUS, DEMON_HUNTER_PRICES, DEMON_HUNTER_SOURCE_STATUS } from '../../src/domain/demon-hunter/content.js';
import { DEMON_HUNTER_ABILITY_IDS, type DemonHunterCommand } from '../../src/domain/demon-hunter/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed fixtures continue the real S5 save. Test resources and prescribed rolls are not natural-play evidence.
function guardian(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/guardian-v01070/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.demonHunter = createDemonHunterState(); s.week = s.guardian.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: DemonHunterCommand, roll = 1) {
  const c = context(s, roll); applyDemonHunterCommand(s, command, c); return c;
}
function taught(s = guardian()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.demonHunter.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.demonHunter.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDemonHunterCommand(s, command as DemonHunterCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
const oldIds = [...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS, ...WEAPONMASTER_ABILITY_IDS, ...DAWN_PALADIN_ABILITY_IDS, ...GUARDIAN_ABILITY_IDS];
const oldStages = (s: SliceState) => [s.warrior, s.gladiator, s.weaponmaster, s.dawnPaladin, s.guardian, s.town, s.combatHistory];

describe('Demon Hunter S4 original ready bottles and recoverable G medicine', () => {
  it('keeps the future channel dormant and creates independent original state', () => {
    const s = createSliceRun('demon-hunter-hidden', sliceDefaultCreationSelection, 'demon-hunter-hidden');
    expect(validateDemonHunterState(s)).toBe(true);
    expect(projectDemonHunter(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectDemonHunter(s).story).toBeUndefined();
    const other = createDemonHunterState(); other.bottles[0]!.labourSteps = 5; other.resupply.deliveries = 1;
    expect(s.demonHunter).toEqual(createDemonHunterState()); expect(other.life).not.toBe(s.demonHunter.life); expect(other.encounter).not.toBe(s.demonHunter.encounter);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 540 and one action to the existing guide without granting a formula or changing any old stage', () => {
    const s = guardian(), old = structuredClone(oldStages(s));
    expect(validateDemonHunterState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(c.check).not.toHaveBeenCalled(); expect(oldStages(s)).toEqual(old);
    expect(DEMON_HUNTER_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    expect(DEMON_HUNTER_FORMULA_STATUS).toContain('完整配方与晋升仪式细节尚未核实');
    expect(DEMON_HUNTER_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(DEMON_HUNTER_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    expect(projectDemonHunter(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(c.note).toHaveBeenCalledWith('听取猎魔者用药说明', expect.stringContaining('实际核对原瓶、准备原训练场安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions, a nontransferable 5300 credit and 1500 payment for that bottle', () => {
    const s = taught(), b = s.demonHunter.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([37960, 94, 'PLAYER']);
    const second = s.demonHunter.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(6800); expect(validateDemonHunterState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 6799; reject(s, { type: 'BUY_POTION', bottleId: s.demonHunter.bottles[2]!.id });
  });
  it('allows early guidance but needs Guardian digestion100 and twelve complete real weeks before drinking', () => {
    const s = guardian(); s.week = 58; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateDemonHunterState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.guardian.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectDemonHunter(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isDemonHunter(s)).toBe(true); expect(s.demonHunter.guardianActingAtPromotion).toBe(100);
  });
  it('consumes only the selected original and executes each of the four fixed medicine outcomes', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.demonHunter.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect(c.note).toHaveBeenCalledWith('导师完成本次猎魔者服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.demonHunter.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 5) expect(s.progression.acting).toBe(100);
      expect(validateDemonHunterState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('leaves severe medicine failure recoverable without reviving bottles or granting battle protection', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    const b = s.demonHunter.bottles[0]!; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.progression.acting, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100, 100]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' }); expect(validateDemonHunterState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(DEMON_HUNTER_CONSUMPTION_RISK).toContain('保护不适用于战斗');
  });
  it('blocks at health20 or mind40 before rolling and bounds actual successful spiritual cost at zero', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.demonHunter.bottles[0]!.id, confirmed: true });
      expect(s.demonHunter.bottles[0]!.status).toBe('PLAYER');
      expect(projectDemonHunter(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
    const s = prepared(); s.spirituality = 3;
    act(s, { type: 'CONSUME', bottleId: s.demonHunter.bottles[0]!.id, confirmed: true }, 30);
    expect(s.spirituality).toBe(0); expect(s.mind).toBe(92);
  });
  it('preserves all old mastery, people, borrowed originals, actual injuries and enemy outcomes while adding only three zero IDs', () => {
    const s = prepared(), old = structuredClone(oldStages(s)), stats = { ...s.character.coreStats }, gender = s.character.gender, mastery = { ...s.progression.mastery };
    act(s, { type: 'CONSUME', bottleId: s.demonHunter.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.gender).toBe(gender); expect(gender).toBe('FEMALE');
    expect(s.guardian.practice).toMatchObject({ probes: 4, playerDamageTaken: 7, allyHealth: 91, allyDamageTaken: 9, sharedDamage: 3, target: 'MARKED' });
    expect(s.guardian.encounter.status).toBe('RESOLVED'); expect(s.warrior.practiceClub).toMatchObject({ custodian: 'MENTOR', location: 'training-rack', version: 7 });
    expect(Object.keys(s.progression.mastery)).toEqual([...oldIds, ...DEMON_HUNTER_ABILITY_IDS]);
    for (const id of oldIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    expect(DEMON_HUNTER_ABILITY_IDS).toEqual(['warrior.s4.discern-corruption', 'warrior.s4.targeted-preparation', 'warrior.s4.veil-intent']);
    for (const id of DEMON_HUNTER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(s.demonHunter.life).toEqual(createDemonHunterState().life); expect(s.demonHunter.encounter).toEqual(createDemonHunterState().encounter);
    expect(projectDemonHunter(s).digestion).toContain('猎魔者扮演0/100'); expect(validateDemonHunterState(s)).toBe(true);
  });
  it('preserves all failed bottles and waits for the next actual week before another independent paid batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.demonHunter.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.demonHunter.bottles.slice(0, 3)).toEqual(originals); expect(s.demonHunter.bottles).toHaveLength(6);
    expect(s.demonHunter.bottles[3]).toMatchObject({ id: 'demon-hunter-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectDemonHunter(s).actions.find(a => a.id === 'buy-demon-hunter-potion-4')!.cost).toContain('6800便士');
    expect(validateDemonHunterState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.health = 100; s.mind = 100; const next = buy(s, 3); act(s, { type: 'CONSUME', bottleId: next.id, confirmed: true });
    expect(s.demonHunter.bottles.slice(0, 3)).toEqual(originals); expect(validateDemonHunterState(s)).toBe(true);
  });
  it('supports zero-action purchase and separately confirmed consumption of a selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.demonHunter.bottles[0]), second = buy(s, 1);
    reject(s, { type: 'CONSUME', bottleId: second.id });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.demonHunter.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateDemonHunterState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.demonHunter.bottles[2]!.id });
  });
  it('atomically enforces action, cash, city, combat and finished-run gates', () => {
    const withoutAction = guardian(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = guardian(); withoutCash.cash = 539; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.demonHunter.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.demonHunter.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.demonHunter.bottles[0]!.id });
  });
  it('blocks medicine while old real contact, armor, guarding, a companion or an unfinished preparation remains', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.guardian.cases['guarded-load']!.contactOpen = true; },
      s => { s.guardian.practice.guardActive = true; },
      s => { s.guardian.practice.allyPresent = true; s.guardian.practice.allyDistance = 2; },
      s => { s.dawnPaladin.practice.swordActive = true; },
      s => { s.dawnPaladin.practice.armorActive = true; },
      s => { s.dawnPaladin.cases['armor-test']!.contactOpen = true; },
      s => { s.weaponmaster.cases['weapon-fit']!.status = 'PREPARED'; },
      s => { s.gladiator.cases['agreed-stop']!.contact = 'ENGAGED'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.demonHunter.bottles[0]!.id, confirmed: true }); }
  });
  it('rejects invented recipes, bottle identities and unconfirmed commands without mutation', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'demon-hunter-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'guardian-potion-1' }, { type: 'CONSUME', bottleId: 'demon-hunter-potion-1', confirmed: true, target: 'anyone' }, { type: 'REFLECT', extra: true }, { type: 'TRANSFORM_GIANT' }, { type: 'JUDGE_EVIL', target: 'anyone' }];
    for (const command of malformed) { expect(validateDemonHunterCommand(command)).toBe(false); expect(isDemonHunterAcquisitionCommand(command)).toBe(false); reject(prepared(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'demon-hunter-potion-999' });
  });
  it('recognizes exact life and encounter commands and routes observation through the unified domain entry point', () => {
    const s = promoted();
    expect(validateDemonHunterCommand({ type: 'OBSERVE', caseId: 'sealed-sample' })).toBe(true);
    expect(isDemonHunterAcquisitionCommand({ type: 'OBSERVE', caseId: 'sealed-sample' })).toBe(false);
    expect(validateDemonHunterCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateDemonHunterCommand({ type: 'PREPARE_HUNT' })).toBe(true);
    act(s, { type: 'OBSERVE', caseId: 'sealed-sample' });
    expect(s.demonHunter.life.cases['sealed-sample'].status).toBe('OBSERVED'); expect(validateDemonHunterState(s)).toBe(true);
  });
  it('rejects forged sources, bottle chronology, snapshots and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.demonHunter.bottles[0]!.source = 'invented'; },
      t => { t.demonHunter.bottles[0]!.consumedWeek = t.demonHunter.promotionWeek! - 1; },
      t => { t.demonHunter.guardianActingAtPromotion = 99; },
      t => { delete t.progression.mastery[WARRIOR_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['warrior.s4.free-power'] = 0; },
      t => { t.demonHunter.bottles[1]!.labourSteps = 6; },
      t => { t.demonHunter.bottles[1]!.id = 'demon-hunter-potion-1'; },
      t => { (t.demonHunter.bottles as unknown[])[0] = null; },
      t => { (t.demonHunter as unknown as Record<string, unknown>).life = null; },
      t => { (t.demonHunter as unknown as Record<string, unknown>).encounter = null; },
      t => { t.demonHunter.resupply.requestedWeek = t.week; },
      t => { (t.demonHunter as unknown as Record<string, unknown>).freeMythicForm = true; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateDemonHunterState(t)).not.toThrow(); expect(validateDemonHunterState(t)).toBe(false); }
  });
  it('keeps projection read-only and clearly excludes invisible bodies, free forms, Silver Knight and artifact powers', () => {
    const s = promoted(), before = structuredClone(s), p = projectDemonHunter(s);
    expect(p.abilities.map(x => x.id)).toEqual([...DEMON_HUNTER_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false });
    expect(p.cases).toHaveLength(3); expect(p.actions.some(a => a.command.type === 'OBSERVE')).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[DEMON_HUNTER_ABILITY_IDS[0]]).toBe(0); expect(s).toEqual(before);
    expect(DEMON_HUNTER_ABILITIES).toHaveLength(3);
    for (const boundary of ['物理隐身', '全知的道德审判', '实际材料', '不完整巨人神话形态', '白银骑士', '荣耀之冠', '荣耀之证']) expect(DEMON_HUNTER_SOURCE_STATUS).toContain(boundary);
  });
  it('validates canonical SQLite JSON ordering before promotion and after promotion without depending on insertion order', () => {
    for (const s of [guardian(), taught(), prepared(), promoted()]) {
      const reordered = JSON.parse(stableStringify(s)) as SliceState;
      expect(validateDemonHunterState(reordered)).toBe(true);
      expect(projectDemonHunter(reordered)).toEqual(projectDemonHunter(s));
    }
    const s = prepared(), reordered = JSON.parse(stableStringify(s)) as SliceState;
    const command = JSON.parse(stableStringify({ type: 'CONSUME', bottleId: s.demonHunter.bottles[0]!.id, confirmed: true }));
    expect(validateDemonHunterCommand(command)).toBe(true); act(reordered, command);
    expect(isDemonHunter(reordered)).toBe(true); expect(validateDemonHunterState(JSON.parse(stableStringify(reordered)))).toBe(true);
  });
  it('migrates the real continuing Guardian save without changing any old original or outcome', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/guardian-v01070/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'combatHistory', 'progression', 'character'] as const) expect(s[key]).toEqual(previous[key]);
    expect([s.week, s.status, s.progression.sequence, s.progression.acting]).toEqual([58, 'ACTIVE', 5, 100]);
    expect(s.demonHunter).toEqual(createDemonHunterState()); expect(validateDemonHunterState(s)).toBe(true);
  });
});
