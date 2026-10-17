import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { ASSASSIN_ABILITY_IDS } from '../../src/domain/assassin/types.js';
import { INSTIGATOR_ABILITY_IDS } from '../../src/domain/instigator/types.js';
import { WITCH_ABILITY_IDS } from '../../src/domain/witch/types.js';
import { PLEASURE_ABILITY_IDS } from '../../src/domain/pleasure/types.js';
import { PLEASURE_GUIDE } from '../../src/domain/pleasure/content.js';
import { applyPainCommand, createPainState, freshPainPractice, isPainAcquisitionCommand, projectPain, validatePainCommand, validatePainState } from '../../src/domain/pain/index.js';
import { PAIN_ABILITIES, PAIN_FORMULA_STATUS, PAIN_GUIDE, PAIN_PRICES, PAIN_SOURCE_STATUS, PAIN_VOLUNTEER } from '../../src/domain/pain/content.js';
import { PAIN_ABILITY_IDS, PAIN_CASE_IDS, type PainAcquisitionCommand } from '../../src/domain/pain/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function pleasure(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/pleasure-v0860/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.pain = createPainState(); s.week = Math.max(s.week, s.pleasure.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: PainAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyPainCommand(s, command, c); return c;
}
function taught(s = pleasure()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.pain.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.pain.bottles[0]!.id, confirmed: true }); return s;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyPainCommand(s, command as PainAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Pain S5 actual finished bottles and bounded promotion', () => {
  it('hides the future channel and creates independent originals, disease-free practice and unused encounter', () => {
    const s = createSliceRun('pain-hidden', sliceDefaultCreationSelection, 'pain-hidden');
    expect(validatePainState(s)).toBe(true);
    expect(projectPain(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null, diseaseState: { fieldActive: false, enemyDisease: 0, diseaseApplications: 0, care: 'NONE', enemyHealth: 100, enemyStatus: 'NOT_MET' } });
    expect(projectPain(s).story).toBeUndefined();
    const other = createPainState(); other.practice.playerNode = 'SAFE_MARK'; other.practice.tableRows = 3; other.bottles[0]!.labourSteps = 5; other.encounter.fieldActive = true;
    expect(s.pain.practice).toEqual(freshPainPractice()); expect(s.pain.bottles[0]!.labourSteps).toBe(0); expect(s.pain.encounter.fieldActive).toBe(false);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('uses the original Noella channel and charges 460 plus one action without a false complete recipe', () => {
    const s = pleasure(), old = structuredClone([s.assassin, s.instigator, s.witch, s.pleasure]);
    expect(validatePainState(s)).toBe(true);
    expect(projectPain(s)).toMatchObject({ discovered: true, promoted: false, acting: 0, practice: null });
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.assassin, s.instigator, s.witch, s.pleasure]).toEqual(old);
    expect(PAIN_GUIDE).toBe(PLEASURE_GUIDE); expect(PAIN_VOLUNTEER).toBe('成年演员拉维妮');
    expect(PAIN_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(projectPain(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(PAIN_FORMULA_STATUS).toContain('完整配方');
    expect(PAIN_FORMULA_STATUS).toContain('细节尚未核实');
    expect(PAIN_FORMULA_STATUS).toContain('欢愉魔女七项已知配方');
    expect(PAIN_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取痛苦魔女用药说明', expect.stringContaining('实际核对原瓶、准备原独立练习场安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions and 600 payment for the selected bottle only', () => {
    const s = taught(), b = s.pain.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.pain.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validatePainState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.pain.bottles[2]!.id });
  });
  it('allows early preparation but requires old digestion100 and twelve complete weeks to drink', () => {
    const s = pleasure(); s.week = s.pleasure.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validatePainState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectPain(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(s.progression.sequence).toBe(5);
  });
  it('consumes the selected original and applies all four public risk tiers with will26', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.pain.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次痛苦魔女服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.pain.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validatePainState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps health20 and mind40 boundaries atomic without rolling or consuming', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.pain.bottles[0]!.id, confirmed: true });
      expect(s.pain.bottles[0]!.status).toBe('PLAYER');
      expect(projectPain(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves lower sequences, original body change, materials, bottles, tools and resolved Malen history', () => {
    const s = prepared(), old = structuredClone([s.assassin, s.instigator, s.witch, s.pleasure, s.combatHistory]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.pain.bottles[0]!.id, confirmed: true });
    expect([s.assassin, s.instigator, s.witch, s.pleasure, s.combatHistory]).toEqual(old);
    expect(s.pain.pleasureActingAtPromotion).toBe(100);
    expect(s.witch.previousGender).toBe('MALE');
    expect(s.character).toMatchObject({ gender: 'FEMALE' });
    expect(s.pleasure.practice).toMatchObject({ wrist: 'FREE', fireSilk: 'CLEARED', fireBreak: 'BLACK_FLAME' });
    expect(s.pleasure.cases['refused-invitation']).toMatchObject({ notes: 1, revised: true });
    expect(s.witch.tools).toMatchObject({ mirrorsHeld: 0, mirrorsUsed: 3, powderHeld: 6 });
    expect(s.pleasure.batches).toHaveLength(3); expect(s.pleasure.bottles).toHaveLength(2);
    expect(s.pleasure.formulaKnown).toBe(true);
    expect(projectPain(s).bodyChange).toContain('不发生第二次身体转变');
    expect(s.pleasure.encounter.status).toBe('RESOLVED');
    expect(Object.keys(s.progression.mastery)).toEqual([...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS, ...WITCH_ABILITY_IDS, ...PLEASURE_ABILITY_IDS, ...PAIN_ABILITY_IDS]);
    expect(PAIN_ABILITY_IDS).toEqual(['assassin.s5.disease']);
    for (const id of PAIN_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.pain.practice).toEqual(freshPainPractice());
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    expect(projectPain(s).digestion).toContain('痛苦魔女扮演0/100');
    expect(validatePainState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for a separately purchased finite batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.pain.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.pain.bottles.slice(0, 3)).toEqual(originals); expect(s.pain.bottles).toHaveLength(6);
    expect(s.pain.bottles[3]).toMatchObject({ id: 'pain-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectPain(s).actions.find(a => a.id === 'buy-pain-potion-4')!.cost).toContain('4800便士');
    expect(validatePainState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for purchase and separately confirmed consumption at the last-action boundary', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.pain.bottles[0]), second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.pain.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' });
    expect(validatePainState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.pain.bottles[2]!.id });
  });
  it('keeps costs, events, location and ended-run boundaries atomic', () => {
    const withoutAction = pleasure(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = pleasure(); withoutCash.cash = 459; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.pain.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.pain.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.pain.bottles[0]!.id });
  });
  it('rejects forged sources, snapshots, mastery and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.pain.bottles[0]!.source = 'invented'; },
      t => { t.pain.bottles[0]!.consumedWeek = t.pain.promotionWeek! - 1; },
      t => { t.pain.pleasureActingAtPromotion = 99; },
      t => { delete t.progression.mastery[ASSASSIN_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['assassin.s5.free-power'] = 0; },
      t => { t.pain.bottles[1]!.labourSteps = 6; },
      t => { (t.pain as unknown as Record<string, unknown>).practice = null; },
      t => { t.pain.practice.playerNode = 'SAFE_MARK'; },
      t => { t.pain.practice.companionNode = 'SAFE_MARK'; },
      t => { t.pain.practice.tableRows = 1; },
      t => { t.pain.practice.careNote = 'HANDED_OVER'; },
      t => { t.pain.encounter.enemyDisease = 1; },
      t => { (t.pain.practice as unknown as Record<string, unknown>).simulatedOnly = false; },
      t => { (t.pain.practice as unknown as Record<string, unknown>).summonedAlly = true; },
      t => { (t.pain.cases as unknown as Record<string, unknown>)['exit-markers'] = null; },
      t => { (t.pain as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t); expect(() => validatePainState(t)).not.toThrow(); expect(validatePainState(t)).toBe(false);
    }
  });
  it('projects exactly one new mastery and detached disease state without inventing disease use', () => {
    const s = promoted(), p = projectPain(s);
    expect(p.practice).toBeNull(); expect(p.abilities.map(x => x.id)).toEqual([...PAIN_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.actions.every(a => !a.enabled)).toBe(true);
    p.abilities[0]!.mastery = 99; p.diseaseState.enemyDisease = 3;
    expect(s.progression.mastery[PAIN_ABILITY_IDS[0]]).toBe(0); expect(s.pain.encounter.enemyDisease).toBe(0);
    const before = structuredClone(s); projectPain(s); expect(s).toEqual(before);
  });
  it('accepts only exact finite-case commands and rejects invented recipes, summons or future abilities', () => {
    for (const caseId of PAIN_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW']) {
        expect(validatePainCommand({ type, caseId })).toBe(true); expect(isPainAcquisitionCommand({ type, caseId })).toBe(false);
        expect(validatePainCommand({ type, caseId, target: 'invented' })).toBe(false);
      }
      expect(validatePainCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
      expect(validatePainCommand({ type: 'PREPARE', caseId, method: 'ABILITY' })).toBe(false);
    }
    for (const type of ['BUY_SUPPLIES', 'PREPARE_MIRROR', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'ENCOUNTER_AID']) {
      expect(validatePainCommand({ type })).toBe(true); expect(isPainAcquisitionCommand({ type })).toBe(false);
    }
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'pain-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'pleasure-batch-1:bottle' }, { type: 'APPLY_DISEASE', caseId: 'exit-markers' }, { type: 'TREAT_DISEASE' }, { type: 'MYTHICAL_FORM' }, { type: 'REFLECT', extra: true }]) {
      expect(validatePainCommand(command)).toBe(false); expect(isPainAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
  });
  it('states progressive supernatural disease and unknown recipe boundaries without friend immunity or instant cure', () => {
    expect(PAIN_ABILITIES).toHaveLength(1);
    expect(PAIN_SOURCE_STATUS).toContain('持续加深'); expect(PAIN_SOURCE_STATUS).toContain('不作为所有新晋序列5统一半径或必死计时');
    expect(PAIN_SOURCE_STATUS).toContain('友军免疫没有核实'); expect(PAIN_SOURCE_STATUS).toContain('不等于已感染者自动痊愈');
    expect(PAIN_SOURCE_STATUS).toContain('序列4绝望'); expect(PAIN_SOURCE_STATUS).toContain('不向她施加疾病');
    expect(PAIN_SOURCE_STATUS).toContain('不冒充治疗或实际疾病能力掌握'); expect(PAIN_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    expect(PAIN_SOURCE_STATUS).toContain('不再发生第二次身体转变');
  });
  it('blocks acquisition during actual new or inherited unfinished practice contact', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.pain.cases['exit-markers']!.contactOpen = true; },
      s => { s.pain.practice.playerNode = 'SAFE_MARK'; },
      s => { s.pain.practice.companionNode = 'SAFE_MARK'; },
      s => { s.pleasure.cases['silk-release']!.contactOpen = true; },
      s => { s.pleasure.practice.wrist = 'SILK'; },
      s => { s.pleasure.practice.fireSilk = 'ON_FRAME'; },
    ];
    for (const mutate of mutations) {
      const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.pain.bottles[0]!.id, confirmed: true });
      expect(projectPain(s).insideCase).toBe(true);
    }
  });
  it('rejects forged early resupply, duplicate originals and unknown complete formulas', () => {
    const s = taught();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.pain.resupply.requestedWeek = t.week; },
      t => { t.pain.resupply.deliveries = 1; },
      t => { t.pain.bottles[1]!.id = t.pain.bottles[0]!.id; },
      t => { t.pain.bottles[1]!.source = t.pleasure.bottles[0]!.id; },
      t => { (t.pain as unknown as Record<string, unknown>).formulaKnown = true; },
      t => { t.pleasure.formulaKnown = false; },
    ];
    for (const change of changes) {
      const t = structuredClone(s); change(t);
      expect(() => validatePainState(t)).not.toThrow(); expect(validatePainState(t)).toBe(false);
    }
    for (const command of [{ type: 'LEARN_FORMULA' }, { type: 'BUY_MATERIALS', batchId: 'pain-batch-1' }, { type: 'BREW', batchId: 'pain-batch-1' }]) reject(s, command);
  });
  it('keeps unused purchased originals after promotion and caps base stats without filling spirituality', () => {
    const s = taught(); const first = buy(s), second = buy(s, 1);
    s.character.coreStats.physique = 500; s.character.coreStats.knowledge = 499;
    const preserved = structuredClone(second);
    act(s, { type: 'CONSUME', bottleId: first.id, confirmed: true });
    expect(second).toEqual(preserved); expect(s.character.coreStats.physique).toBe(500);
    expect(s.character.coreStats.knowledge).toBe(500); expect(s.spirituality).toBe(31);
    expect(projectPain(s).actions.find(a => a.command.type === 'CONSUME' && a.command.bottleId === second.id)).toMatchObject({ enabled: false });
    reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(validatePainState(s)).toBe(true);
  });
  it('preserves old natural history through migration before new activity', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/pleasure-v0860/natural.json', 'utf8')).final;
    const s = migrateSliceState(previous);
    for (const key of ['assassin', 'instigator', 'witch', 'pleasure', 'combatHistory', 'progression'] as const) expect(s[key]).toEqual(previous[key]);
    expect(s.pain).toEqual(createPainState()); expect(validatePainState(s)).toBe(true);
  });
});
