import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../../src/domain/secret-supplicant/types.js';
import { LISTENER_ABILITY_IDS } from '../../src/domain/listener/types.js';
import { SHADOW_ASCETIC_ABILITY_IDS } from '../../src/domain/shadow-ascetic/types.js';
import { ROSE_BISHOP_ABILITY_IDS } from '../../src/domain/rose-bishop/types.js';
import { ROSE_BISHOP_GUIDE } from '../../src/domain/rose-bishop/content.js';
import { projectRoseBishop, validateRoseBishopCommand } from '../../src/domain/rose-bishop/index.js';
import { applyShepherdCommand, createShepherdState, freshShepherdPractice, isShepherdAcquisitionCommand, projectShepherd, validateShepherdCommand, validateShepherdState } from '../../src/domain/shepherd/index.js';
import { SHEPHERD_ABILITIES, SHEPHERD_FORMULA_STATUS, SHEPHERD_GUIDE, SHEPHERD_PRICES, SHEPHERD_SOURCE_STATUS, SHEPHERD_SPIRITS } from '../../src/domain/shepherd/content.js';
import { SHEPHERD_ABILITY_IDS, SHEPHERD_CASE_IDS, SHEPHERD_CAPACITY, SHEPHERD_SPIRIT_IDS, type ShepherdAcquisitionCommand } from '../../src/domain/shepherd/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function roseBishop(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/rose-bishop-v0880/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.shepherd = createShepherdState(); s.week = Math.max(s.week, s.roseBishop.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: ShepherdAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyShepherdCommand(s, command, c); return c;
}
function taught(s = roseBishop()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const b = s.shepherd.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.shepherd.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyShepherdCommand(s, command as ShepherdAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Shepherd S5 actual finished bottles and finite original soul sources', () => {
  it('hides the future channel and creates fresh independent originals without filling seven slots', () => {
    const s = createSliceRun('shepherd-hidden', sliceDefaultCreationSelection, 'shepherd-hidden');
    expect(validateShepherdState(s)).toBe(true);
    expect(projectShepherd(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null, grazing: null });
    expect(projectShepherd(s).story).toBeUndefined(); expect(projectShepherd(s).reserve).toBeUndefined();
    expect(SHEPHERD_CAPACITY).toBe(7); expect(s.shepherd.grazing.spirits).toHaveLength(2);
    expect(s.shepherd.grazing.spirits.map(x => x.id)).toEqual([...SHEPHERD_SPIRIT_IDS]);
    expect(s.shepherd.grazing.spirits.every(x => x.status === 'UNMET' && x.selectedAbilities.length === 0)).toBe(true);
    const other = createShepherdState(); other.practice.paper = 'MARK'; other.grazing.spirits[0]!.selectedAbilities.push('light-touch'); other.bottles[0]!.labourSteps = 5;
    expect(s.shepherd.practice).toEqual(freshShepherdPractice()); expect(s.shepherd.bottles[0]!.labourSteps).toBe(0);
    expect(s.shepherd.grazing.spirits[0]!.selectedAbilities).toEqual([]); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('uses the same Ethan channel and charges 460 plus one action without claiming a formula or ritual', () => {
    const s = roseBishop(), old = structuredClone([s.secretSupplicant, s.listener, s.shadowAscetic, s.roseBishop]);
    expect(validateShepherdState(s)).toBe(true); expect(projectShepherd(s).discovered).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([29540, 99]); expect(c.check).not.toHaveBeenCalled();
    expect([s.secretSupplicant, s.listener, s.shadowAscetic, s.roseBishop]).toEqual(old);
    expect(SHEPHERD_GUIDE).toBe(ROSE_BISHOP_GUIDE); expect(SHEPHERD_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200 });
    expect(projectShepherd(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(SHEPHERD_FORMULA_STATUS).toContain('细节尚未核实'); expect(SHEPHERD_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(c.note).toHaveBeenCalledWith('听取牧羊人用药说明', expect.stringContaining('实际核对原瓶、准备原旧物间安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions and 600 payment for the selected bottle only', () => {
    const s = taught(), b = s.shepherd.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([28940, 94, 'PLAYER']);
    const second = s.shepherd.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); expect(validateShepherdState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 4799; reject(s, { type: 'BUY_POTION', bottleId: s.shepherd.bottles[2]!.id });
  });
  it('allows early preparation but requires old digestion100 and twelve complete weeks to drink', () => {
    const s = roseBishop(); s.week = s.roseBishop.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateShepherdState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week += 11; s.progression.acting = 100;
    expect(projectShepherd(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(5);
  });
  it('consumes the selected original and applies all four public risk tiers with will26', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.shepherd.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect(c.note).toHaveBeenCalledWith('导师完成本次牧羊人服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.shepherd.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 6) expect(s.progression.acting).toBe(100);
      expect(validateShepherdState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('keeps health20 and mind40 boundaries atomic without rolling or consuming', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.shepherd.bottles[0]!.id, confirmed: true });
      expect(s.shepherd.bottles[0]!.status).toBe('PLAYER');
      expect(projectShepherd(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
  });
  it('preserves all lower identities, actual packets, reserve and resolved original enemy history', () => {
    const s = prepared(), old = structuredClone([s.secretSupplicant, s.listener, s.shadowAscetic, s.roseBishop, s.combatHistory]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.shepherd.bottles[0]!.id, confirmed: true });
    expect([s.secretSupplicant, s.listener, s.shadowAscetic, s.roseBishop, s.combatHistory]).toEqual(old);
    expect(s.shepherd.roseBishopActingAtPromotion).toBe(100); expect(s.roseBishop.encounter.status).toBe('RESOLVED');
    expect(s.roseBishop.reserve.packets).toHaveLength(6); expect(s.roseBishop.reserve.points).toBe(1);
    expect(Object.keys(s.progression.mastery)).toEqual([...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS, ...SHADOW_ASCETIC_ABILITY_IDS, ...ROSE_BISHOP_ABILITY_IDS, ...SHEPHERD_ABILITY_IDS]);
    expect(SHEPHERD_ABILITY_IDS).toEqual(['hanged-man.s5.grazing', 'hanged-man.s5.borrowed-arts']);
    for (const id of SHEPHERD_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    expect(s.shepherd.practice).toEqual(freshShepherdPractice()); expect(s.shepherd.grazing).toEqual(createShepherdState().grazing);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(validateShepherdState(s)).toBe(true);
  });
  it('retains failed originals and waits a real week for a separately purchased finite batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.shepherd.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.shepherd.bottles.slice(0, 3)).toEqual(originals); expect(s.shepherd.bottles).toHaveLength(6);
    expect(s.shepherd.bottles[3]).toMatchObject({ id: 'shepherd-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectShepherd(s).actions.find(a => a.id === 'buy-shepherd-potion-4')!.cost).toContain('4800便士');
    expect(validateShepherdState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('uses zero actions for purchase and separate confirmed consumption at the last-action boundary', () => {
    const s = taught(); s.actionsRemaining = 0; const first = structuredClone(s.shepherd.bottles[0]), second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.shepherd.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateShepherdState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.shepherd.bottles[2]!.id });
  });
  it('keeps cost, location, combat, ended-run and the closed S1 old-channel boundary atomic', () => {
    const withoutAction = roseBishop(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = roseBishop(); withoutCash.cash = 459; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.shepherd.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.shepherd.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.shepherd.bottles[0]!.id });
    const future = roseBishop(); future.progression.sequence = 1; reject(future, { type: 'LEARN_GUIDANCE' }); expect(projectShepherd(future).discovered).toBe(false);
  });
  it('rejects forged sources, snapshots, nested state, extra souls and permanent borrowed masteries without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.shepherd.bottles[0]!.source = 'invented'; },
      t => { t.shepherd.bottles[0]!.consumedWeek = t.shepherd.promotionWeek! - 1; },
      t => { t.shepherd.roseBishopActingAtPromotion = 99; },
      t => { delete t.progression.mastery[SECRET_SUPPLICANT_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['hanged-man.s4.flesh-soul-blade'] = 0; },
      t => { t.progression.mastery['light-touch'] = 0; },
      t => { t.shepherd.bottles[1]!.labourSteps = 6; },
      t => { (t.shepherd as unknown as Record<string, unknown>).practice = null; },
      t => { t.shepherd.practice.playerNode = 'MARK'; },
      t => { t.shepherd.practice.paper = 'MARK'; },
      t => { t.shepherd.practice.chorusOpen = true; },
      t => { t.shepherd.practice.note = 'WRITTEN'; },
      t => { t.shepherd.encounter.blurReady = true; },
      t => { (t.shepherd.encounter as unknown as Record<string, unknown>).freeSpell = true; },
      t => { (t.shepherd.practice as unknown as Record<string, unknown>).summonedAlly = true; },
      t => { (t.shepherd.cases as unknown as Record<string, unknown>)['paper-guidance'] = null; },
      t => { (t.shepherd as unknown as Record<string, unknown>).grazing = null; },
      t => { t.shepherd.grazing.spirits.push({ ...t.shepherd.grazing.spirits[0]!, id: 'SH5-FREE-3' }); },
      t => { t.shepherd.grazing.activeSpiritId = 'SH5-IRIS-1'; },
      t => { (t.shepherd as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateShepherdState(t)).not.toThrow(); expect(validateShepherdState(t)).toBe(false); }
  });
  it('projects only the two new masteries and a detached old reserve without exposing unmet sources', () => {
    const s = promoted(), p = projectShepherd(s);
    expect(p.practice).toBeNull(); expect(p.grazing).toBeNull(); expect(p.abilities.map(x => x.id)).toEqual([...SHEPHERD_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false, cases: [] });
    expect(p.reserve).toEqual(projectRoseBishop(s).reserve);
    expect(JSON.stringify(p)).not.toMatch(/伊芮斯|塞德里克|SH5-IRIS-1|SH5-CEDRIC-1|微力触动|短促防护|模糊标记|勇气歌声/);
    p.abilities[0]!.mastery = 99; p.reserve!.packets[0]!.status = 'HELD';
    expect(s.progression.mastery[SHEPHERD_ABILITY_IDS[0]]).toBe(0); expect(s.roseBishop.reserve.packets[0]!.status).toBe('CONSUMED');
    const before = structuredClone(s); projectShepherd(s); expect(s).toEqual(before);
  });
  it('accepts exact finite cases and leaves limited-account strictly ordinary', () => {
    for (const caseId of SHEPHERD_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW']) {
        expect(validateShepherdCommand({ type, caseId })).toBe(true); expect(isShepherdAcquisitionCommand({ type, caseId })).toBe(false);
        expect(validateShepherdCommand({ type, caseId, target: 'invented' })).toBe(false);
      }
      expect(validateShepherdCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
      expect(validateShepherdCommand({ type: 'PREPARE', caseId, method: 'ABILITY' })).toBe(caseId !== 'limited-account');
    }
    for (const type of ['MEET_SPIRITS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT']) expect(validateShepherdCommand({ type })).toBe(true);
    for (const command of [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'shepherd-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'rose-bishop-potion-1' }, { type: 'COPY_ALL_POWERS' }, { type: 'SUMMON_BODY' }, { type: 'REFLECT', extra: true }]) {
      expect(validateShepherdCommand(command)).toBe(false); expect(isShepherdAcquisitionCommand(command)).toBe(false); reject(prepared(), command);
    }
  });
  it('restricts grazing to one to three unique powers actually known by that exact original source', () => {
    for (const source of SHEPHERD_SPIRITS) {
      const command = { type: 'GRAZE', spiritId: source.id, abilityIds: source.knownAbilities.map(x => x.id) };
      expect(validateShepherdCommand(command)).toBe(true); expect(isShepherdAcquisitionCommand(command)).toBe(false);
      expect(validateShepherdCommand({ ...command, abilityIds: [source.knownAbilities[0]!.id] })).toBe(true);
      expect(validateShepherdCommand({ ...command, abilityIds: [] })).toBe(false);
      expect(validateShepherdCommand({ ...command, abilityIds: [source.knownAbilities[0]!.id, source.knownAbilities[0]!.id] })).toBe(false);
      expect(validateShepherdCommand({ ...command, abilityIds: [...command.abilityIds, 'all-powers'] })).toBe(false);
      expect(validateShepherdCommand({ ...command, spiritId: 'SH5-FREE-3' })).toBe(false);
    }
    expect(validateShepherdCommand({ type: 'GRAZE', spiritId: 'SH5-IRIS-1', abilityIds: ['courage-song'] })).toBe(false);
    expect(validateShepherdCommand({ type: 'GRAZE', spiritId: 'SH5-CEDRIC-1', abilityIds: ['light-touch'] })).toBe(false);
    for (const spiritId of [...SHEPHERD_SPIRIT_IDS, null]) expect(validateShepherdCommand({ type: 'ACTIVATE_SPIRIT', spiritId })).toBe(true);
    expect(validateShepherdCommand({ type: 'ACTIVATE_SPIRIT', spiritId: ['SH5-IRIS-1', 'SH5-CEDRIC-1'] })).toBe(false);
    expect(validateShepherdCommand({ type: 'RELEASE_SPIRIT', spiritId: 'SH5-IRIS-1', confirmed: true })).toBe(true);
    expect(validateShepherdCommand({ type: 'RELEASE_SPIRIT', spiritId: 'SH5-IRIS-1' })).toBe(false);
    expect(validateShepherdCommand({ type: 'RELEASE_SPIRIT', spiritId: 'SH5-IRIS-1', confirmed: false })).toBe(false);
  });
  it('reuses only the original ration command identities and explicitly bounds the supernatural source', () => {
    for (const command of [{ type: 'BUY_RATION' }, { type: 'TAKE_RATION', packetId: 'rose-bishop-ration-1' }]) {
      expect(validateShepherdCommand(command)).toBe(validateRoseBishopCommand(command)); expect(isShepherdAcquisitionCommand(command)).toBe(false);
    }
    for (const command of [{ type: 'BUY_RATION', quantity: 7 }, { type: 'TAKE_RATION', packetId: 'shepherd-ration-1' }, { type: 'LEARN_FORMULA' }, { type: 'BUY_MATERIALS' }]) expect(validateShepherdCommand(command)).toBe(false);
    expect(SHEPHERD_ABILITIES).toHaveLength(2); expect(SHEPHERD_SPIRITS.map(x => x.knownAbilities.length)).toEqual([3, 1]);
    expect(SHEPHERD_SOURCE_STATUS).toContain('瞬间切换'); expect(SHEPHERD_SOURCE_STATUS).toContain('最多放牧7个灵魂');
    expect(SHEPHERD_SOURCE_STATUS).toContain('同一时刻只驱使1灵'); expect(SHEPHERD_SOURCE_STATUS).toContain('黑骑士');
    expect(SHEPHERD_SOURCE_STATUS).toContain('物品饥饿不能移作职业规则');
    const wrongPath = roseBishop(); wrongPath.progression.pathwayId = 'hermit'; reject(wrongPath, { type: 'LEARN_GUIDANCE' });
  });
  it('blocks acquisition during new or inherited actual unfinished contact and physical return routes', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.shepherd.cases['paper-guidance']!.contactOpen = true; }, s => { s.shepherd.practice.paper = 'MARK'; },
      s => { s.shepherd.practice.chorusOpen = true; }, s => { s.shepherd.practice.note = 'WRITTEN'; },
      s => { s.shepherd.practice.playerNode = 'MARK'; }, s => { s.roseBishop.cases['ring-release']!.contactOpen = true; },
      s => { s.roseBishop.practice.shape = 'SLIM_HAND'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.shepherd.bottles[0]!.id, confirmed: true }); expect(projectShepherd(s).insideCase).toBe(true); }
  });
  it('rejects forged early resupply, duplicate originals and an invented complete formula', () => {
    const s = taught();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.shepherd.resupply.requestedWeek = t.week; }, t => { t.shepherd.resupply.deliveries = 1; },
      t => { t.shepherd.bottles[1]!.id = t.shepherd.bottles[0]!.id; }, t => { t.shepherd.bottles[1]!.source = t.roseBishop.bottles[0]!.id; },
      t => { (t.shepherd as unknown as Record<string, unknown>).formulaKnown = true; }, t => { t.roseBishop.guidanceKnown = false; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateShepherdState(t)).not.toThrow(); expect(validateShepherdState(t)).toBe(false); }
  });
  it('keeps unused purchased originals and caps base stats without filling spirituality', () => {
    const s = taught(), first = buy(s), second = buy(s, 1); s.character.coreStats.physique = 500; s.character.coreStats.knowledge = 499;
    act(s, { type: 'CONSUME', bottleId: first.id, confirmed: true });
    expect(second.status).toBe('PLAYER'); expect(second.consumedWeek).toBeNull();
    expect(s.character.coreStats.physique).toBe(500); expect(s.character.coreStats.knowledge).toBe(500);
    expect(s.spirituality).toBe(31); expect(validateShepherdState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
  });
  it('preserves the actual old natural record through migration before new activity', () => {
    const previous = JSON.parse(readFileSync('tests/fixtures/rose-bishop-v0880/natural.json', 'utf8')).final, s = migrateSliceState(previous);
    for (const key of ['secretSupplicant', 'listener', 'shadowAscetic', 'roseBishop', 'combatHistory', 'progression'] as const) expect(s[key]).toEqual(previous[key]);
    expect(s.shepherd).toEqual(createShepherdState()); expect(validateShepherdState(s)).toBe(true);
  });
});
