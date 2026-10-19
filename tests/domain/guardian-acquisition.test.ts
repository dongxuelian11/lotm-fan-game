import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { WARRIOR_ABILITY_IDS } from '../../src/domain/warrior/types.js';
import { GLADIATOR_ABILITY_IDS } from '../../src/domain/gladiator/types.js';
import { WEAPONMASTER_ABILITY_IDS } from '../../src/domain/weaponmaster/types.js';
import { DAWN_PALADIN_ABILITY_IDS } from '../../src/domain/dawn-paladin/types.js';
import { DAWN_PALADIN_GUIDE } from '../../src/domain/dawn-paladin/content.js';
import { applyGuardianCommand, createGuardianState, freshGuardianPractice, isGuardianAcquisitionCommand, projectGuardian, validateGuardianCommand, validateGuardianState } from '../../src/domain/guardian/index.js';
import { GUARDIAN_ABILITIES, GUARDIAN_FORMULA_STATUS, GUARDIAN_GUIDE, GUARDIAN_PRICES, GUARDIAN_SOURCE_STATUS } from '../../src/domain/guardian/content.js';
import { GUARDIAN_ABILITY_IDS, GUARDIAN_CASE_IDS, type GuardianAcquisitionCommand } from '../../src/domain/guardian/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function dawnPaladin(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/dawn-paladin-v0850/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.guardian = createGuardianState(); s.week = Math.max(s.week, s.dawnPaladin.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: GuardianAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyGuardianCommand(s, command, c); return c;
}
function taught(s = dawnPaladin()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.guardian.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.guardian.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyGuardianCommand(s, command as GuardianAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Guardian S5 actual finished bottles and bounded promotion', () => {
  it('hides the future channel and creates independent originals, practice and battle equipment', () => {
    const s = createSliceRun('guardian-hidden', sliceDefaultCreationSelection, 'guardian-hidden');
    expect(validateGuardianState(s)).toBe(true);
    expect(projectGuardian(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null, battleEquipment: { swordReady: false, swordLostRound: null, armorReady: false, armorExpiresRound: null } });
    expect(projectGuardian(s).story).toBeUndefined();
    const other = createGuardianState(); other.practice.guardActive = true; other.practice.allyHealth = 97; other.bottles[0]!.labourSteps = 5; other.encounter.swordReady = true;
    expect(s.guardian.practice).toEqual(freshGuardianPractice()); expect(s.guardian.bottles[0]!.labourSteps).toBe(0); expect(s.guardian.encounter.swordReady).toBe(false);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('uses the original Oswin channel and charges 460 plus one action without a false complete recipe', () => {
    const s = dawnPaladin(), old = structuredClone([s.warrior, s.gladiator, s.weaponmaster, s.dawnPaladin]);
    expect(validateGuardianState(s)).toBe(true);
    expect(projectGuardian(s)).toMatchObject({ discovered: true, promoted: false, acting: 0, practice: null });
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.warrior, s.gladiator, s.weaponmaster, s.dawnPaladin]).toEqual(old);
    expect(GUARDIAN_GUIDE).toBe(DAWN_PALADIN_GUIDE);
    expect(GUARDIAN_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(projectGuardian(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(GUARDIAN_FORMULA_STATUS).toContain('石巨人的核心');
    expect(GUARDIAN_FORMULA_STATUS).toContain('这一条目不是完整配方');
    expect(GUARDIAN_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取守护者用药说明', expect.stringContaining('实际核对原瓶、准备原训练场安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions and 600 payment for the selected bottle only', () => {
    const s = taught(), b = s.guardian.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.guardian.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateGuardianState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.guardian.bottles[2]!.id });
  });
  it('allows early preparation but requires old digestion100 and twelve complete weeks to drink', () => {
    const s = dawnPaladin(); s.week = s.dawnPaladin.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateGuardianState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectGuardian(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes the selected original and applies all four public risk tiers with will26', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.guardian.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次守护者服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.guardian.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateGuardianState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps health20 and mind40 boundaries atomic without rolling or consuming', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.guardian.bottles[0]!.id, confirmed: true });
      expect(s.guardian.bottles[0]!.status).toBe('PLAYER');
      expect(projectGuardian(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves all four lower sequences, borrowed club, old storm damage and resolved enemy history', () => {
    const s = prepared(), old = structuredClone([s.warrior, s.gladiator, s.weaponmaster, s.dawnPaladin, s.combatHistory]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.guardian.bottles[0]!.id, confirmed: true });
    expect([s.warrior, s.gladiator, s.weaponmaster, s.dawnPaladin, s.combatHistory]).toEqual(old);
    expect(s.guardian.dawnPaladinActingAtPromotion).toBe(100);
    expect(s.warrior.practiceClub).toMatchObject({ owner: '奥斯温·布莱克特', custodian: 'MENTOR', location: 'training-rack', version: 7 });
    expect(s.dawnPaladin.practice).toMatchObject({ stormTarget: 'DESTROYED', stormFrameScorched: true, stormSwordDispersed: true, stormArmorCracked: true });
    expect(s.dawnPaladin.encounter.status).toBe('RESOLVED');
    expect(Object.keys(s.progression.mastery)).toEqual([...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS, ...WEAPONMASTER_ABILITY_IDS, ...DAWN_PALADIN_ABILITY_IDS, ...GUARDIAN_ABILITY_IDS]);
    expect(GUARDIAN_ABILITY_IDS).toEqual(['warrior.s5.guard-state', 'warrior.s5.damage-sharing']);
    for (const id of GUARDIAN_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.guardian.practice).toEqual(freshGuardianPractice());
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(projectGuardian(s).digestion).toContain('守护者扮演0/100');
    expect(validateGuardianState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for a separately purchased finite batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.guardian.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.guardian.bottles.slice(0, 3)).toEqual(originals); expect(s.guardian.bottles).toHaveLength(6);
    expect(s.guardian.bottles[3]).toMatchObject({ id: 'guardian-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectGuardian(s).actions.find(a => a.id === 'buy-guardian-potion-4')!.cost).toContain('4800便士');
    expect(validateGuardianState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for purchase and separately confirmed consumption at the last-action boundary', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.guardian.bottles[0]), second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.guardian.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' });
    expect(validateGuardianState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.guardian.bottles[2]!.id });
  });
  it('keeps costs, events, location and ended-run boundaries atomic', () => {
    const withoutAction = dawnPaladin(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = dawnPaladin(); withoutCash.cash = 459; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.guardian.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.guardian.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.guardian.bottles[0]!.id });
  });
  it('rejects forged sources, snapshots, mastery and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.guardian.bottles[0]!.source = 'invented'; },
      t => { t.guardian.bottles[0]!.consumedWeek = t.guardian.promotionWeek! - 1; },
      t => { t.guardian.dawnPaladinActingAtPromotion = 99; },
      t => { delete t.progression.mastery[WARRIOR_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['warrior.s5.free-power'] = 0; },
      t => { t.guardian.bottles[1]!.labourSteps = 6; },
      t => { (t.guardian as unknown as Record<string, unknown>).practice = null; },
      t => { t.guardian.practice.allyPresent = true; },
      t => { t.guardian.practice.allyDistance = 2; },
      t => { t.guardian.practice.allyHealth = 97; },
      t => { t.guardian.practice.sharedDamage = 3; },
      t => { t.guardian.practice.probes = -1; },
      t => { (t.guardian.practice as unknown as Record<string, unknown>).summonedAlly = true; },
      t => { (t.guardian.cases as unknown as Record<string, unknown>)['guarded-load'] = null; },
      t => { (t.guardian as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validateGuardianState(t)).not.toThrow(); expect(validateGuardianState(t)).toBe(false);
    }
  });
  it('projects exactly two new masteries and detached temporary equipment without exposing internal practice', () => {
    const s = promoted(), p = projectGuardian(s);
    expect(p.practice).toBeNull(); expect(p.abilities.map(x => x.id)).toEqual([...GUARDIAN_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.abilities[0]!.mastery = 99; p.battleEquipment.swordReady = true;
    expect(s.progression.mastery[GUARDIAN_ABILITY_IDS[0]]).toBe(0); expect(s.guardian.encounter.swordReady).toBe(false);
    const before = structuredClone(s); projectGuardian(s); expect(s).toEqual(before);
  });
  it('accepts only exact finite-case commands and rejects invented recipes, summons or future abilities', () => {
    for (const caseId of GUARDIAN_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW']) {
        expect(validateGuardianCommand({ type, caseId })).toBe(true); expect(isGuardianAcquisitionCommand({ type, caseId })).toBe(false);
        expect(validateGuardianCommand({ type, caseId, target: 'invented' })).toBe(false);
      }
      expect(validateGuardianCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
    }
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'guardian-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'dawn-paladin-potion-1' }, { type: 'SUMMON_ALLY' }, { type: 'DETECT_EVIL' }, { type: 'MYTHICAL_FORM' }, { type: 'REFLECT', extra: true }]) {
      expect(validateGuardianCommand(command)).toBe(false); expect(isGuardianAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
  });
  it('states canon guard tradeoff, illusion clarity and nearby sharing without inventing S4 powers', () => {
    expect(GUARDIAN_ABILITIES).toHaveLength(2);
    expect(GUARDIAN_SOURCE_STATUS).toContain('放弃攻击'); expect(GUARDIAN_SOURCE_STATUS).toContain('主动攻击会降低防御');
    expect(GUARDIAN_SOURCE_STATUS).toContain('不被幻术迷惑'); expect(GUARDIAN_SOURCE_STATUS).toContain('替附近同伴承担伤害');
    expect(GUARDIAN_SOURCE_STATUS).toContain('原文未给出精确防御比例'); expect(GUARDIAN_SOURCE_STATUS).toContain('序列4猎魔者');
    expect(GUARDIAN_SOURCE_STATUS).toContain('维拉（Vera Edridge）'); expect(GUARDIAN_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
  });
  it('blocks acquisition during actual new or inherited unfinished practice contact', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.guardian.cases['guarded-load']!.contactOpen = true; },
      s => { s.guardian.practice.guardActive = true; },
      s => { s.guardian.practice.allyPresent = true; s.guardian.practice.allyDistance = 2; },
      s => { s.dawnPaladin.cases['armor-test']!.contactOpen = true; },
    ];
    for (const mutate of mutations) {
      const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.guardian.bottles[0]!.id, confirmed: true });
      expect(projectGuardian(s).insideCase).toBe(true);
    }
  });
  it('preserves old natural history through migration before new activity', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/dawn-paladin-v0850/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'combatHistory', 'progression'] as const) expect(s[key]).toEqual(previous[key]);
    expect(s.guardian).toEqual(createGuardianState()); expect(validateGuardianState(s)).toBe(true);
  });
});
