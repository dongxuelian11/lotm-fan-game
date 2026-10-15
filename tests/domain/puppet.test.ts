import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { PRISONER_ABILITY_IDS } from '../../src/domain/prisoner/types.js';
import { MADMAN_ABILITY_IDS } from '../../src/domain/madman/types.js';
import { WEREWOLF_ABILITY_IDS } from '../../src/domain/werewolf/types.js';
import { ZOMBIE_ABILITY_IDS } from '../../src/domain/zombie/types.js';
import { WRAITH_ABILITY_IDS } from '../../src/domain/wraith/types.js';
import { applyPuppetCommand, createPuppetState, isPuppet, isPuppetAcquisitionCommand, projectPuppet, validatePuppetCommand, validatePuppetState } from '../../src/domain/puppet/index.js';
import { PUPPET_ABILITIES, PUPPET_CONSUMPTION_RISK, PUPPET_FORMULA_STATUS, PUPPET_PRICES, PUPPET_SOURCE_STATUS } from '../../src/domain/puppet/content.js';
import { PUPPET_ABILITY_IDS, type PuppetCommand } from '../../src/domain/puppet/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed fixtures continue the real S5 save. Test resources and prescribed rolls are not natural-play evidence.
function wraith(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/wraith-v01120/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.puppet = createPuppetState(); s.week = Math.max(s.week, s.wraith.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: PuppetCommand, roll = 1) {
  const c = context(s, roll); applyPuppetCommand(s, command, c); return c;
}
function taught(s = wraith()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.puppet.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.puppet.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyPuppetCommand(s, command as PuppetCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
const oldIds = [...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS, ...WEREWOLF_ABILITY_IDS, ...ZOMBIE_ABILITY_IDS, ...WRAITH_ABILITY_IDS];
const oldStages = (s: SliceState) => [s.prisoner, s.madman, s.werewolf, s.zombie, s.wraith, s.town, s.combatHistory];

describe('Puppet S4 original ready bottles and recoverable G medicine', () => {
  it('keeps the future channel dormant and creates independent original state', () => {
    const s = createSliceRun('puppet-hidden', sliceDefaultCreationSelection, 'puppet-hidden');
    expect(validatePuppetState(s)).toBe(true);
    expect(projectPuppet(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', practice: null });
    expect(projectPuppet(s).story).toBeUndefined();
    const other = createPuppetState(); other.bottles[0]!.labourSteps = 5; other.resupply.deliveries = 1;
    expect(s.puppet).toEqual(createPuppetState()); expect(other.life).not.toBe(s.puppet.life); expect(other.encounter).not.toBe(s.puppet.encounter);
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 540 and one action to the existing guide without granting a formula or changing any old stage', () => {
    const s = wraith(), old = structuredClone(oldStages(s));
    expect(validatePuppetState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(c.check).not.toHaveBeenCalled(); expect(oldStages(s)).toEqual(old);
    expect(PUPPET_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    expect(PUPPET_FORMULA_STATUS).toContain('完整配方与晋升仪式细节尚未核实');
    expect(PUPPET_FORMULA_STATUS).toContain('不能据未知细节断言无需仪式');
    expect(PUPPET_FORMULA_STATUS).toContain('不冒充已还原原著仪式');
    expect(projectPuppet(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(c.note).toHaveBeenCalledWith('听取木偶用药说明', expect.stringContaining('实际核对原瓶、准备原旧工坊安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real labour actions, a nontransferable 5300 credit and 1500 payment for that bottle', () => {
    const s = taught(), b = s.puppet.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([37960, 94, 'PLAYER']);
    const second = s.puppet.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(6800); expect(validatePuppetState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 6799; reject(s, { type: 'BUY_POTION', bottleId: s.puppet.bottles[2]!.id });
  });
  it('allows early guidance but needs Wraith digestion100 and twelve complete real weeks before drinking', () => {
    const s = wraith(); s.week = s.wraith.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validatePuppetState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.wraith.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectPuppet(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isPuppet(s)).toBe(true); expect(s.puppet.wraithActingAtPromotion).toBe(100);
  });
  it('consumes only the selected original and executes each of the four fixed medicine outcomes', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.puppet.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect(c.note).toHaveBeenCalledWith('导师完成本次木偶服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence, 'ACTIVE']);
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.puppet.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 5) expect(s.progression.acting).toBe(100);
      expect(validatePuppetState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('leaves severe medicine failure recoverable without reviving bottles or granting battle protection', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    const b = s.puppet.bottles[0]!; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.progression.acting, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100, 100]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' }); expect(validatePuppetState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(PUPPET_CONSUMPTION_RISK).toContain('保护不适用于战斗');
  });
  it('blocks at health20 or mind40 before rolling and bounds actual successful spiritual cost at zero', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.puppet.bottles[0]!.id, confirmed: true });
      expect(s.puppet.bottles[0]!.status).toBe('PLAYER');
      expect(projectPuppet(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
    const s = prepared(); s.spirituality = 3;
    act(s, { type: 'CONSUME', bottleId: s.puppet.bottles[0]!.id, confirmed: true }, 30);
    expect(s.spirituality).toBe(0); expect(s.mind).toBe(92);
  });
  it('preserves all five old Chained domains and every original while adding exactly three zero IDs', () => {
    const s = prepared();
    const old = structuredClone(oldStages(s)), stats = { ...s.character.coreStats }, gender = s.character.gender, mastery = { ...s.progression.mastery };
    act(s, { type: 'CONSUME', bottleId: s.puppet.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.gender).toBe(gender);
    expect(s.wraith.encounter.status).toBe('RESOLVED');
    expect(s.wraith.practice).toEqual({ form: 'HUMAN', node: 'ROOM', mirror: 'COVERED', host: 'SELF', flag: 'TABLE', note: 'HANDED_OVER' });
    expect(Object.keys(s.progression.mastery)).toEqual([...oldIds, ...PUPPET_ABILITY_IDS]);
    for (const id of oldIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    expect(PUPPET_ABILITY_IDS).toEqual(['chained.s4.object-motion', 'chained.s4.cursed-form', 'chained.s4.curse-link']);
    for (const id of PUPPET_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    const initial = createPuppetState();
    expect(s.puppet.life.cases).toEqual(initial.life.cases); expect(s.puppet.life.practice).toEqual(initial.life.practice);
    expect(s.puppet.life.moon.notices).toHaveLength(2); expect(s.puppet.life.moon.history).toEqual([]);
    expect(s.puppet.encounter).toEqual(initial.encounter);
    expect(projectPuppet(s).digestion).toContain('木偶扮演0/100'); expect(validatePuppetState(s)).toBe(true);
  });
  it('posts the two new finite notices only after an actual successful original bottle and grants no combat props', () => {
    const s = prepared(), initialLife = structuredClone(s.puppet.life);
    expect(s.puppet.life.moon.notices).toEqual([]);
    act(s, { type: 'CONSUME', bottleId: s.puppet.bottles[0]!.id, confirmed: true }, 85);
    expect(s.puppet.life).toEqual(initialLife); expect(s.puppet.promotionWeek).toBeNull();
    s.health = 100; s.mind = 100; const second = buy(s, 1);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.puppet.life.moon.notices).toHaveLength(2);
    expect(s.puppet.life.moon.history).toEqual([]);
    expect(s.puppet.encounter).toMatchObject({ blocksPurchased: false, blocks: [], form: 'HUMAN', link: 'NONE' });
    const notices = structuredClone(s.puppet.life.moon.notices);
    reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.puppet.life.moon.notices).toEqual(notices); expect(validatePuppetState(s)).toBe(true);
  });
  it('preserves all failed bottles and waits for the next actual week before another independent paid batch', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.puppet.bottles), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.puppet.bottles.slice(0, 3)).toEqual(originals); expect(s.puppet.bottles).toHaveLength(6);
    expect(s.puppet.bottles[3]).toMatchObject({ id: 'puppet-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectPuppet(s).actions.find(a => a.id === 'buy-puppet-potion-4')!.cost).toContain('6800便士');
    expect(validatePuppetState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.health = 100; s.mind = 100; const next = buy(s, 3); act(s, { type: 'CONSUME', bottleId: next.id, confirmed: true });
    expect(s.puppet.bottles.slice(0, 3)).toEqual(originals); expect(validatePuppetState(s)).toBe(true);
  });
  it('supports zero-action purchase and separately confirmed consumption of a selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.puppet.bottles[0]), second = buy(s, 1);
    reject(s, { type: 'CONSUME', bottleId: second.id });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.puppet.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validatePuppetState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.puppet.bottles[2]!.id });
  });
  it('atomically enforces action, cash, city, combat and finished-run gates', () => {
    const withoutAction = wraith(); withoutAction.actionsRemaining = 0; reject(withoutAction, { type: 'LEARN_GUIDANCE' });
    const withoutCash = wraith(); withoutCash.cash = 539; reject(withoutCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.puppet.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.puppet.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.puppet.bottles[0]!.id });
  });
  it('blocks medicine while any old contact, original object or unfinished preparation remains', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.prisoner.cases['jammed-shutter']!.holding = true; },
      s => { s.madman.cases['stop-bell']!.burstOpen = true; },
      s => { s.werewolf.cases['night-route']!.sceneOpen = true; },
      s => { s.zombie.cases['willing-spirit']!.contactOpen = true; },
      s => { s.zombie.practice.body = 'BRACED'; },
      s => { s.zombie.practice.cold = 'ICED'; },
      s => { s.zombie.practice.spirit = 'PRESENT'; },
      s => { s.wraith.cases['willing-signal']!.contactOpen = true; },
      s => { s.wraith.practice.form = 'WRAITH'; },
      s => { s.wraith.practice.node = 'ALCOVE'; },
      s => { s.wraith.practice.mirror = 'OPEN'; },
      s => { s.wraith.practice.host = 'NOLAN'; },
      s => { s.wraith.practice.flag = 'RAISED'; },
      s => { s.wraith.practice.note = 'WRITTEN'; },
      s => { s.wraith.cases['honest-account']!.status = 'PREPARED'; },
      s => { s.werewolf.moon.pendingWeek = s.week; },
      s => { s.zombie.moon.pendingWeek = s.week; },
      s => { s.wraith.moon.pendingWeek = s.week; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.puppet.bottles[0]!.id, confirmed: true }); }
  });
  it('rejects invented recipes, compulsory mummies, marionette corpses and unconfirmed or foreign bottles', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'puppet-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'wraith-potion-1' }, { type: 'CONSUME', bottleId: 'puppet-potion-1', confirmed: true, target: 'anyone' }, { type: 'REFLECT', extra: true }, { type: 'BUY_REQUIRED_MUMMY' }, { type: 'OWN_ENEMY_ARTEFACT' }, { type: 'CREATE_MARIONETTE_CORPSE' }, { type: 'CONTROL_WOODEN_PERSON' }, { type: 'GRANT_CRESCENT_IMMUNITY' }];
    for (const command of malformed) { expect(validatePuppetCommand(command)).toBe(false); expect(isPuppetAcquisitionCommand(command)).toBe(false); reject(prepared(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'puppet-potion-999' });
  });
  it('recognizes exact life and encounter commands and routes observation through the unified domain entry point', () => {
    const s = promoted();
    expect(validatePuppetCommand({ type: 'OBSERVE', caseId: 'moving-token' })).toBe(true);
    expect(isPuppetAcquisitionCommand({ type: 'OBSERVE', caseId: 'moving-token' })).toBe(false);
    expect(validatePuppetCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    act(s, { type: 'OBSERVE', caseId: 'moving-token' });
    expect(s.puppet.life.cases['moving-token'].status).toBe('OBSERVED'); expect(validatePuppetState(s)).toBe(true);
  });
  it('rejects forged sources, bottle chronology, snapshots and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.puppet.bottles[0]!.source = 'invented'; },
      t => { t.puppet.bottles[0]!.consumedWeek = t.puppet.promotionWeek! - 1; },
      t => { t.puppet.wraithActingAtPromotion = 99; },
      t => { delete t.progression.mastery[PRISONER_ABILITY_IDS[0]]; },
      t => { t.progression.mastery['chained.s4.free-power'] = 0; },
      t => { t.puppet.bottles[1]!.labourSteps = 6; },
      t => { t.puppet.bottles[1]!.id = 'puppet-potion-1'; },
      t => { (t.puppet.bottles as unknown[])[0] = null; },
      t => { (t.puppet as unknown as Record<string, unknown>).life = null; },
      t => { (t.puppet as unknown as Record<string, unknown>).encounter = null; },
      t => { t.puppet.resupply.requestedWeek = t.week; },
      t => { (t.puppet as unknown as Record<string, unknown>).freeMythicForm = true; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validatePuppetState(t)).not.toThrow(); expect(validatePuppetState(t)).toBe(false); }
  });
  it('keeps projection read-only and distinguishes known categories from G and unknown ritual details', () => {
    const s = promoted(), before = structuredClone(s), p = projectPuppet(s);
    expect(p.abilities.map(x => x.id)).toEqual([...PUPPET_ABILITY_IDS]);
    expect(p).toMatchObject({ promoted: true, formulaKnown: false, formula: [], insideCase: false });
    expect(p.cases).toHaveLength(3); expect(p.actions.some(a => a.command.type === 'OBSERVE')).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[PUPPET_ABILITY_IDS[0]]).toBe(0); expect(s).toEqual(before);
    expect(PUPPET_ABILITIES).toHaveLength(3);
    for (const boundary of ['沉默门徒', '魔法纸人', '诅咒之源', '木乃伊', '尚未核实', '吞食人类灵魂', '绯红月冕', '普通方法', '双方承受程度不同']) expect(PUPPET_SOURCE_STATUS).toContain(boundary);
    expect(PUPPET_ABILITIES.every(ability => ability.description.includes('原创G'))).toBe(true);
  });
  it('validates canonical SQLite JSON ordering before promotion and after promotion without depending on insertion order', () => {
    for (const s of [wraith(), taught(), prepared(), promoted()]) {
      const reordered = JSON.parse(stableStringify(s)) as SliceState;
      expect(validatePuppetState(reordered)).toBe(true);
      expect(projectPuppet(reordered)).toEqual(projectPuppet(s));
    }
    const s = prepared(), reordered = JSON.parse(stableStringify(s)) as SliceState;
    const command = JSON.parse(stableStringify({ type: 'CONSUME', bottleId: s.puppet.bottles[0]!.id, confirmed: true }));
    expect(validatePuppetCommand(command)).toBe(true); act(reordered, command);
    expect(isPuppet(reordered)).toBe(true); expect(validatePuppetState(JSON.parse(stableStringify(reordered)))).toBe(true);
  });
  it('migrates the real continuing Wraith save without changing any old original or outcome', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/wraith-v01120/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(319); expect(fixture.seed).toBe('prisoner-natural-v057');
    const previous = fixture.final, s = migrateSliceState(previous);
    for (const key of ['prisoner', 'madman', 'werewolf', 'zombie', 'wraith', 'combatHistory', 'progression', 'character'] as const) expect(s[key]).toEqual(previous[key]);
    expect([s.week, s.status, s.progression.sequence, s.progression.acting]).toEqual([82, 'ACTIVE', 5, 100]);
    expect(s.puppet).toEqual(createPuppetState()); expect(validatePuppetState(s)).toBe(true);
  });
});
