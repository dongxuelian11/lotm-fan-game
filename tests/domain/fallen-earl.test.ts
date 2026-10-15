import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { LAWYER_ABILITY_IDS } from '../../src/domain/lawyer/types.js';
import { BARBARIAN_ABILITY_IDS } from '../../src/domain/barbarian/types.js';
import { BRIBER_ABILITY_IDS } from '../../src/domain/briber/types.js';
import { CORRUPTION_BARON_ABILITY_IDS } from '../../src/domain/corruption-baron/types.js';
import { MENTOR_DISORDER_ABILITY_IDS } from '../../src/domain/mentor-disorder/types.js';
import { applyFallenEarlCommand, createFallenEarlState, isFallenEarl, isFallenEarlAcquisitionCommand, projectFallenEarl, validateFallenEarlCommand, validateFallenEarlState } from '../../src/domain/fallen-earl/index.js';
import { FALLEN_EARL_ABILITIES, FALLEN_EARL_CONSUMPTION_RISK, FALLEN_EARL_FORMULA_STATUS, FALLEN_EARL_PRICES, FALLEN_EARL_SOURCE_STATUS } from '../../src/domain/fallen-earl/content.js';
import { FALLEN_EARL_ABILITY_IDS, type FallenEarlCommand } from '../../src/domain/fallen-earl/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed fixtures continue the real Mentor Disorder save. Test resources and prescribed rolls are not natural-play evidence.
function mentorDisorder(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/mentor-disorder-v01140/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.fallenEarl = createFallenEarlState(); s.week = Math.max(s.week, s.mentorDisorder.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: FallenEarlCommand, roll = 1) {
  const c = context(s, roll); applyFallenEarlCommand(s, command, c); return c;
}
function taught(s = mentorDisorder()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.fallenEarl.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.fallenEarl.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyFallenEarlCommand(s, command as FallenEarlCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
const oldIds = [...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS, ...BRIBER_ABILITY_IDS, ...CORRUPTION_BARON_ABILITY_IDS, ...MENTOR_DISORDER_ABILITY_IDS];
const oldStages = (s: SliceState) => [s.lawyer, s.barbarian, s.briber, s.corruptionBaron, s.mentorDisorder, s.town, s.combatHistory];

describe('Fallen Earl S4 independent bottles and recoverable G medicine', () => {
  it('keeps the unvisited channel dormant and every new run independent, with no second gift inventory', () => {
    const s = createSliceRun('fallen-earl-hidden', sliceDefaultCreationSelection, 'fallen-earl-hidden');
    expect(validateFallenEarlState(s)).toBe(true);
    expect(projectFallenEarl(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '' });
    expect(projectFallenEarl(s).story).toBeUndefined();
    const other = createFallenEarlState(); other.bottles[0]!.labourSteps = 5; other.resupply.deliveries = 1;
    expect(s.fallenEarl).toEqual(createFallenEarlState()); expect(other.life).not.toBe(s.fallenEarl.life); expect(other.encounter).not.toBe(s.fallenEarl.encounter);
    expect(Object.hasOwn(s.fallenEarl, 'gifts')).toBe(false); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 540 and one action to the same guide without granting a formula or touching the old five stages', () => {
    const s = mentorDisorder(), old = structuredClone(oldStages(s));
    expect(validateFallenEarlState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(c.check).not.toHaveBeenCalled(); expect(oldStages(s)).toEqual(old);
    expect(FALLEN_EARL_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    for (const phrase of ['完整配方与晋升仪式细节尚未核实', '不能据未知细节断言无需仪式', '不冒充已还原原著仪式']) expect(FALLEN_EARL_FORMULA_STATUS).toContain(phrase);
    expect(projectFallenEarl(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(c.note).toHaveBeenCalledWith('听取堕落伯爵用药说明', expect.stringContaining('实际核对原瓶、准备原契约铺安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real jobs, a bottle-specific 5300 credit, and the remaining 1500 payment', () => {
    const s = taught(), b = s.fallenEarl.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([37960, 94, 'PLAYER']);
    const second = s.fallenEarl.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(6800); expect(validateFallenEarlState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 6799; reject(s, { type: 'BUY_POTION', bottleId: s.fallenEarl.bottles[2]!.id });
  });
  it('permits advance preparation but needs Mentor Disorder digestion100 and twelve complete actual weeks', () => {
    const s = mentorDisorder(); s.week = s.mentorDisorder.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateFallenEarlState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.mentorDisorder.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectFallenEarl(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isFallenEarl(s)).toBe(true); expect(s.fallenEarl.mentorDisorderActingAtPromotion).toBe(100);
  });
  it('consumes only the selected original and executes all four medicine outcomes without altering any old ledger', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = structuredClone(oldStages(s)), mastery = { ...s.progression.mastery }, b = s.fallenEarl.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect(c.note).toHaveBeenCalledWith('导师完成本次堕落伯爵服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence, 'ACTIVE']);
      expect(oldStages(s)).toEqual(old); for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.fallenEarl.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 5) expect(s.progression.acting).toBe(100);
      expect(validateFallenEarlState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('leaves severe medicine failure recoverable, but does not restore bottles or extend protection to battle', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    const b = s.fallenEarl.bottles[0]!; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.progression.acting, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100, 100]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' }); expect(validateFallenEarlState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(FALLEN_EARL_CONSUMPTION_RISK).toContain('保护不适用于战斗');
  });
  it('blocks health20 and mind40 before rolling and floors actual successful spirituality at zero', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.fallenEarl.bottles[0]!.id, confirmed: true });
      expect(s.fallenEarl.bottles[0]!.status).toBe('PLAYER');
      expect(projectFallenEarl(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
    const s = prepared(); s.spirituality = 3;
    act(s, { type: 'CONSUME', bottleId: s.fallenEarl.bottles[0]!.id, confirmed: true }, 30);
    expect(s.spirituality).toBe(0); expect(isFallenEarl(s)).toBe(true); expect(validateFallenEarlState(s)).toBe(true);
  });
  it('adds exactly three zero masteries while retaining all five original domains, gifts and resolved Rees', () => {
    const s = prepared(), old = structuredClone(oldStages(s)), stats = { ...s.character.coreStats }, gender = s.character.gender, mastery = { ...s.progression.mastery };
    const sameGifts = s.briber.gifts;
    act(s, { type: 'CONSUME', bottleId: s.fallenEarl.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.gender).toBe(gender); expect(s.briber.gifts).toBe(sameGifts);
    expect(s.mentorDisorder.encounter.status).toBe('RESOLVED');
    expect(s.mentorDisorder.practice).toEqual({ markers: 'SORTED', route: 'FREE', note: 'HANDED_OVER' });
    expect(s.briber.gifts.map(g => g.id)).toEqual(Array.from({ length: 12 }, (_, i) => `BR7-GIFT-${i + 1}`));
    expect(s.briber.gifts.map(g => g.location)).toEqual([...Array(7).fill('GIVEN'), ...Array(5).fill('PLAYER')]);
    expect(Object.keys(s.progression.mastery).sort()).toEqual([...oldIds, ...FALLEN_EARL_ABILITY_IDS].sort());
    for (const id of oldIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    expect(FALLEN_EARL_ABILITY_IDS).toEqual(['black-emperor.s4.bestow', 'black-emperor.s4.magnify', 'black-emperor.s4.exploit']);
    for (const id of FALLEN_EARL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    const initial = createFallenEarlState(); expect(s.fallenEarl.life).toEqual(initial.life); expect(s.fallenEarl.encounter).toEqual(initial.encounter);
    expect(projectFallenEarl(s).digestion).toContain('堕落伯爵扮演0/100'); expect(validateFallenEarlState(s)).toBe(true);
  });
  it('caps actual stat growth at500 without refilling spirituality or replacing the original gift inventory', () => {
    const s = prepared(), gifts = structuredClone(s.briber.gifts); s.character.coreStats.physique = 500;
    act(s, { type: 'CONSUME', bottleId: s.fallenEarl.bottles[0]!.id, confirmed: true });
    expect(s.briber.gifts).toEqual(gifts); expect(s.character.coreStats.physique).toBe(500); expect(s.spirituality).toBe(31);
    expect(Object.hasOwn(s.fallenEarl, 'gifts')).toBe(false);
  });
  it('retains exhausted failed originals and waits until the next actual week for three independently paid new bottles', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.fallenEarl.bottles), old = structuredClone(oldStages(s)), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.fallenEarl.bottles.slice(0, 3)).toEqual(originals); expect(s.fallenEarl.bottles).toHaveLength(6); expect(oldStages(s)).toEqual(old);
    expect(s.fallenEarl.bottles[3]).toMatchObject({ id: 'fallen-earl-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectFallenEarl(s).actions.find(a => a.id === 'buy-fallen-earl-potion-4')!.cost).toContain('6800便士');
    expect(validateFallenEarlState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.health = 100; s.mind = 100; const next = buy(s, 3); act(s, { type: 'CONSUME', bottleId: next.id, confirmed: true });
    expect(s.fallenEarl.bottles.slice(0, 3)).toEqual(originals); expect(validateFallenEarlState(s)).toBe(true);
  });
  it('supports zero-action purchase and separate confirmation of the selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.fallenEarl.bottles[0]), second = buy(s, 1);
    reject(s, { type: 'CONSUME', bottleId: second.id });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.fallenEarl.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateFallenEarlState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.fallenEarl.bottles[2]!.id });
  });
  it('enforces action, cash, city, combat and finished-run gates before mutation', () => {
    const noAction = mentorDisorder(); noAction.actionsRemaining = 0; reject(noAction, { type: 'LEARN_GUIDANCE' });
    const noCash = mentorDisorder(); noCash.cash = 539; reject(noCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.fallenEarl.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.fallenEarl.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.fallenEarl.bottles[0]!.id });
  });
  it('requires actual cleanup of old contact, physical originals and unfinished preparations', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { Object.values(s.lawyer.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.barbarian.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.briber.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.corruptionBaron.cases)[0]!.contactOpen = true; },
      s => { s.corruptionBaron.practice.clauseOrder = 'ADJUSTED'; },
      s => { s.corruptionBaron.practice.marker = 'SIDE_POCKET'; },
      s => { s.corruptionBaron.practice.route = 'DIVERTED'; },
      s => { s.mentorDisorder.cases['paired-trays']!.contactOpen = true; },
      s => { s.mentorDisorder.practice.markers = 'MIXED'; },
      s => { s.mentorDisorder.practice.route = 'MARKED'; },
      s => { s.mentorDisorder.practice.note = 'WRITTEN'; },
      s => { s.mentorDisorder.cases['honest-account']!.status = 'PREPARED'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.fallenEarl.bottles[0]!.id, confirmed: true }); }
  });
  it('rejects invented recipes, power commands, unconfirmed consumption and a foreign original', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'fallen-earl-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'mentor-disorder-potion-1' }, { type: 'CONSUME', bottleId: 'fallen-earl-potion-1', confirmed: true, target: 'anyone' }, { type: 'REFLECT', extra: true }, { type: 'CREATE_GIFTS' }, { type: 'BESTOW_DEATH' }, { type: 'TIME_FREEZE' }, { type: 'FORCE_SUCCESS' }, { type: 'MOON_JUMP' }, { type: 'FREE_MYTHIC_FORM' }];
    for (const command of malformed) { expect(validateFallenEarlCommand(command)).toBe(false); expect(isFallenEarlAcquisitionCommand(command)).toBe(false); reject(prepared(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'fallen-earl-potion-999' });
  });
  it('routes exact life and encounter commands through the unified entry point', () => {
    const s = promoted();
    expect(validateFallenEarlCommand({ type: 'OBSERVE', caseId: 'willing-pause' })).toBe(true);
    expect(isFallenEarlAcquisitionCommand({ type: 'OBSERVE', caseId: 'willing-pause' })).toBe(false);
    expect(validateFallenEarlCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateFallenEarlCommand({ type: 'BUY_GIFTS' })).toBe(true);
    act(s, { type: 'OBSERVE', caseId: 'willing-pause' });
    expect(s.fallenEarl.life.cases['willing-pause'].status).toBe('OBSERVED'); expect(validateFallenEarlState(s)).toBe(true);
  });
  it('keeps valid bottle records and rejects malformed originals or missing prior mastery without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.fallenEarl.bottles[0]!.source = 'invented'; },
      t => { t.fallenEarl.bottles[0]!.consumedWeek = t.fallenEarl.promotionWeek! - 1; },
      t => { t.fallenEarl.mentorDisorderActingAtPromotion = 99; },
      t => { delete t.progression.mastery[LAWYER_ABILITY_IDS[0]]; },
      t => { t.fallenEarl.bottles[1]!.labourSteps = 6; },
      t => { t.fallenEarl.bottles[1]!.id = 'fallen-earl-potion-1'; },
      t => { (t.fallenEarl.bottles as unknown[])[0] = null; },
      t => { (t.fallenEarl as unknown as Record<string, unknown>).life = null; },
      t => { (t.fallenEarl as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateFallenEarlState(t)).not.toThrow(); expect(validateFallenEarlState(t)).toBe(false); }
  });
  it('projects the three known categories read-only and clearly states the finite G boundaries and unknown recipe', () => {
    const s = promoted(), before = structuredClone(s), p = projectFallenEarl(s);
    expect(p.abilities.map(x => x.id)).toEqual([...FALLEN_EARL_ABILITY_IDS]);
    expect(p).toMatchObject({ title: '堕落伯爵 · 序列4', promoted: true, formulaKnown: false, formula: [], insideCase: false });
    expect(p.cases).toHaveLength(3); expect(p.actions.some(a => a.command.type === 'OBSERVE')).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[FALLEN_EARL_ABILITY_IDS[0]]).toBe(0); expect(s).toEqual(before);
    expect(FALLEN_EARL_ABILITIES).toHaveLength(3);
    for (const boundary of ['第二部第110章', '狂乱法师3', '独立心智', '自己的', '已经存在', '不免费开放神话形态', '本作原创G']) expect(FALLEN_EARL_SOURCE_STATUS).toContain(boundary);
    expect(p.inheritedTools).toContain('原briber.gifts库存');
    expect(FALLEN_EARL_ABILITIES.every(a => a.description.includes('G'))).toBe(true);
  });
  it('accepts canonical SQLite JSON order without changing promotion behavior or old original state', () => {
    for (const s of [mentorDisorder(), taught(), prepared(), promoted()]) {
      const reordered = JSON.parse(stableStringify(s)) as SliceState;
      expect(validateFallenEarlState(reordered)).toBe(true); expect(projectFallenEarl(reordered)).toEqual(projectFallenEarl(s));
    }
    const s = prepared(), reordered = JSON.parse(stableStringify(s)) as SliceState;
    const command = JSON.parse(stableStringify({ type: 'CONSUME', bottleId: s.fallenEarl.bottles[0]!.id, confirmed: true }));
    expect(validateFallenEarlCommand(command)).toBe(true); act(reordered, command);
    expect(isFallenEarl(reordered)).toBe(true); expect(validateFallenEarlState(JSON.parse(stableStringify(reordered)))).toBe(true);
  });
  it('migrates the actual326-command Mentor Disorder route with all five old domains, gift history and old Rees unchanged', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/mentor-disorder-v01140/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(326); expect(fixture.seed).toBe('lawyer-natural-v063');
    const previous = fixture.final, s = migrateSliceState(previous);
    for (const key of ['lawyer', 'barbarian', 'briber', 'corruptionBaron', 'mentorDisorder', 'combatHistory', 'progression', 'character'] as const) expect(s[key]).toEqual(previous[key]);
    expect([s.week, s.status, s.progression.sequence, s.progression.acting, s.health, s.mind, s.spirituality]).toEqual([84, 'ACTIVE', 5, 100, 100, 100, 100]);
    expect(s.mentorDisorder.promotionWeek).toBe(77); expect(s.mentorDisorder.encounter.status).toBe('RESOLVED');
    expect(s.briber.gifts).toEqual(previous.briber.gifts);
    expect(s.fallenEarl).toEqual(createFallenEarlState()); expect(validateFallenEarlState(s)).toBe(true);
  });
});
