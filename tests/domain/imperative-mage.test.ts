import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { ARBITER_ABILITY_IDS } from '../../src/domain/arbiter/types.js';
import { SHERIFF_ABILITY_IDS } from '../../src/domain/sheriff/types.js';
import { INTERROGATOR_ABILITY_IDS } from '../../src/domain/interrogator/types.js';
import { JUDGE_ABILITY_IDS } from '../../src/domain/judge/types.js';
import { PUNISHMENT_KNIGHT_ABILITY_IDS } from '../../src/domain/punishment-knight/types.js';
import { applyImperativeMageCommand, createImperativeMageState, isImperativeMage, isImperativeMageAcquisitionCommand, projectImperativeMage, validateImperativeMageCommand, validateImperativeMageState } from '../../src/domain/imperative-mage/index.js';
import { IMPERATIVE_MAGE_ABILITIES, IMPERATIVE_MAGE_CONSUMPTION_RISK, IMPERATIVE_MAGE_FORMULA_STATUS, IMPERATIVE_MAGE_PRICES, IMPERATIVE_MAGE_SOURCE_STATUS } from '../../src/domain/imperative-mage/content.js';
import { IMPERATIVE_MAGE_ABILITY_IDS, type ImperativeMageCommand } from '../../src/domain/imperative-mage/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed fixtures continue the real Punishment Knight save. Test resources and prescribed rolls are not natural-play evidence.
function punishmentKnight(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/punishment-knight-v01150/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.imperativeMage = createImperativeMageState(); s.week = Math.max(s.week, s.punishmentKnight.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: ImperativeMageCommand, roll = 1) {
  const c = context(s, roll); applyImperativeMageCommand(s, command, c); return c;
}
function taught(s = punishmentKnight()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.imperativeMage.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.imperativeMage.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyImperativeMageCommand(s, command as ImperativeMageCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
const oldIds = [...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS, ...INTERROGATOR_ABILITY_IDS, ...JUDGE_ABILITY_IDS, ...PUNISHMENT_KNIGHT_ABILITY_IDS];
const oldStages = (s: SliceState) => [s.arbiter, s.sheriff, s.interrogator, s.judge, s.punishmentKnight, s.town, s.combatHistory];

describe('Imperative Mage S4 independent bottles and recoverable G medicine', () => {
  it('keeps the unvisited channel dormant and every new run independent, with independent original supplies', () => {
    const s = createSliceRun('imperative-mage-hidden', sliceDefaultCreationSelection, 'imperative-mage-hidden');
    expect(validateImperativeMageState(s)).toBe(true);
    expect(projectImperativeMage(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '' });
    expect(projectImperativeMage(s).story).toBeUndefined();
    const other = createImperativeMageState(); other.bottles[0]!.labourSteps = 5; other.resupply.deliveries = 1;
    expect(s.imperativeMage).toEqual(createImperativeMageState()); expect(other.life).not.toBe(s.imperativeMage.life); expect(other.encounter).not.toBe(s.imperativeMage.encounter);
    expect(s.imperativeMage.bottles.map(b => b.id)).toEqual(['imperative-mage-potion-1', 'imperative-mage-potion-2', 'imperative-mage-potion-3']); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 540 and one action to the same guide without granting a formula or touching the old five stages', () => {
    const s = punishmentKnight(), old = structuredClone(oldStages(s));
    expect(validateImperativeMageState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(c.check).not.toHaveBeenCalled(); expect(oldStages(s)).toEqual(old);
    expect(IMPERATIVE_MAGE_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    for (const phrase of ['完整配方与晋升仪式细节尚未核实', '不能据未知细节断言无需仪式', '不冒充已还原原著仪式']) expect(IMPERATIVE_MAGE_FORMULA_STATUS).toContain(phrase);
    expect(projectImperativeMage(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(c.note).toHaveBeenCalledWith('听取律令法师用药说明', expect.stringContaining('实际核对原瓶、准备原调解处安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real jobs, a bottle-specific 5300 credit, and the remaining 1500 payment', () => {
    const s = taught(), b = s.imperativeMage.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([37960, 94, 'PLAYER']);
    const second = s.imperativeMage.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(6800); expect(validateImperativeMageState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 6799; reject(s, { type: 'BUY_POTION', bottleId: s.imperativeMage.bottles[2]!.id });
  });
  it('permits advance preparation but needs Punishment Knight digestion100 and twelve complete actual weeks', () => {
    const s = punishmentKnight(); s.week = s.punishmentKnight.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateImperativeMageState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.punishmentKnight.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectImperativeMage(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isImperativeMage(s)).toBe(true); expect(s.imperativeMage.punishmentKnightActingAtPromotion).toBe(100);
  });
  it('consumes only the selected original and executes all four medicine outcomes without altering any old ledger', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = structuredClone(oldStages(s)), mastery = { ...s.progression.mastery }, b = s.imperativeMage.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect(c.note).toHaveBeenCalledWith('导师完成本次律令法师服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence, 'ACTIVE']);
      expect(oldStages(s)).toEqual(old); for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.imperativeMage.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 5) expect(s.progression.acting).toBe(100);
      expect(validateImperativeMageState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('leaves severe medicine failure recoverable, but does not restore bottles or extend protection to battle', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    const b = s.imperativeMage.bottles[0]!; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.progression.acting, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100, 100]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' }); expect(validateImperativeMageState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(IMPERATIVE_MAGE_CONSUMPTION_RISK).toContain('保护不适用于战斗');
  });
  it('blocks health20 and mind40 before rolling and floors actual successful spirituality at zero', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.imperativeMage.bottles[0]!.id, confirmed: true });
      expect(s.imperativeMage.bottles[0]!.status).toBe('PLAYER');
      expect(projectImperativeMage(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
    const s = prepared(); s.spirituality = 3;
    act(s, { type: 'CONSUME', bottleId: s.imperativeMage.bottles[0]!.id, confirmed: true }, 30);
    expect(s.spirituality).toBe(0); expect(isImperativeMage(s)).toBe(true); expect(validateImperativeMageState(s)).toBe(true);
  });
  it('adds exactly two zero masteries while retaining all five original domains, original props and resolved Dean', () => {
    const s = prepared(), old = structuredClone(oldStages(s)), stats = { ...s.character.coreStats }, gender = s.character.gender, mastery = { ...s.progression.mastery };
    act(s, { type: 'CONSUME', bottleId: s.imperativeMage.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.gender).toBe(gender);
    expect(s.punishmentKnight.encounter.status).toBe('RESOLVED');
    expect(s.punishmentKnight.practice).toEqual({ pad: 'STAND', partner: 'FREE', rule: 'NONE', note: 'HANDED_OVER' });
    expect(Object.keys(s.progression.mastery).sort()).toEqual([...oldIds, ...IMPERATIVE_MAGE_ABILITY_IDS].sort());
    for (const id of oldIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    expect(IMPERATIVE_MAGE_ABILITY_IDS).toEqual(['justiciar.s4.intimidation', 'justiciar.s4.deprivation']);
    for (const id of IMPERATIVE_MAGE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    const initial = createImperativeMageState(); expect(s.imperativeMage.life).toEqual(initial.life); expect(s.imperativeMage.encounter).toEqual(initial.encounter);
    expect(projectImperativeMage(s).digestion).toContain('律令法师扮演0/100'); expect(validateImperativeMageState(s)).toBe(true);
  });
  it('caps actual stat growth at500 without refilling spirituality or changing original records', () => {
    const s = prepared(), old = structuredClone(oldStages(s)); s.character.coreStats.physique = 500;
    act(s, { type: 'CONSUME', bottleId: s.imperativeMage.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.coreStats.physique).toBe(500); expect(s.spirituality).toBe(31);
    expect(s.punishmentKnight.encounter.status).toBe('RESOLVED');
  });
  it('retains exhausted failed originals and waits until the next actual week for three independently paid new bottles', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.imperativeMage.bottles), old = structuredClone(oldStages(s)), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.imperativeMage.bottles.slice(0, 3)).toEqual(originals); expect(s.imperativeMage.bottles).toHaveLength(6); expect(oldStages(s)).toEqual(old);
    expect(s.imperativeMage.bottles[3]).toMatchObject({ id: 'imperative-mage-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectImperativeMage(s).actions.find(a => a.id === 'buy-imperative-mage-potion-4')!.cost).toContain('6800便士');
    expect(validateImperativeMageState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.health = 100; s.mind = 100; const next = buy(s, 3); act(s, { type: 'CONSUME', bottleId: next.id, confirmed: true });
    expect(s.imperativeMage.bottles.slice(0, 3)).toEqual(originals); expect(validateImperativeMageState(s)).toBe(true);
  });
  it('supports zero-action purchase and separate confirmation of the selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.imperativeMage.bottles[0]), second = buy(s, 1);
    reject(s, { type: 'CONSUME', bottleId: second.id });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.imperativeMage.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateImperativeMageState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.imperativeMage.bottles[2]!.id });
  });
  it('enforces action, cash, city, combat and finished-run gates before mutation', () => {
    const noAction = punishmentKnight(); noAction.actionsRemaining = 0; reject(noAction, { type: 'LEARN_GUIDANCE' });
    const noCash = punishmentKnight(); noCash.cash = 539; reject(noCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.imperativeMage.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.imperativeMage.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.imperativeMage.bottles[0]!.id });
  });
  it('requires actual cleanup of old contact, physical originals and unfinished preparations', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { Object.values(s.arbiter.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.sheriff.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.interrogator.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.judge.cases)[0]!.contactOpen = true; },
      s => { s.judge.practice.audience = 'ATTENTIVE'; },
      s => { s.judge.practice.boundary = 'HELD'; },
      s => { s.judge.practice.token = 'OUTSIDE_TABLE'; },
      s => { s.punishmentKnight.cases['breach-and-pad']!.contactOpen = true; },
      s => { s.punishmentKnight.practice.pad = 'MAT'; },
      s => { s.punishmentKnight.practice.partner = 'HELD'; },
      s => { s.punishmentKnight.practice.rule = 'DECLARED'; },
      s => { s.punishmentKnight.practice.note = 'WRITTEN'; },
      s => { s.punishmentKnight.cases['wound-record']!.status = 'PREPARED'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.imperativeMage.bottles[0]!.id, confirmed: true }); }
  });
  it('rejects invented recipes, power commands, unconfirmed consumption and a foreign original', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'imperative-mage-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'punishment-knight-potion-1' }, { type: 'CONSUME', bottleId: 'imperative-mage-potion-1', confirmed: true, target: 'anyone' }, { type: 'REFLECT', extra: true }, { type: 'COPY_ABILITY' }, { type: 'DECLARE_DEATH' }, { type: 'WORLD_REWRITE' }, { type: 'FORCE_SUCCESS' }, { type: 'PERMANENT_DEPRIVATION' }, { type: 'FREE_MYTHIC_FORM' }];
    for (const command of malformed) { expect(validateImperativeMageCommand(command)).toBe(false); expect(isImperativeMageAcquisitionCommand(command)).toBe(false); reject(prepared(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'imperative-mage-potion-999' });
  });
  it('routes exact life and encounter commands through the unified entry point', () => {
    const s = promoted();
    expect(validateImperativeMageCommand({ type: 'OBSERVE', caseId: 'willing-attention' })).toBe(true);
    expect(isImperativeMageAcquisitionCommand({ type: 'OBSERVE', caseId: 'willing-attention' })).toBe(false);
    expect(validateImperativeMageCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateImperativeMageCommand({ type: 'PARTNER_REST' })).toBe(true);
    act(s, { type: 'OBSERVE', caseId: 'willing-attention' });
    expect(s.imperativeMage.life.cases['willing-attention'].status).toBe('OBSERVED'); expect(validateImperativeMageState(s)).toBe(true);
  });
  it('keeps valid bottle records and rejects malformed originals or missing prior mastery without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.imperativeMage.bottles[0]!.source = 'invented'; },
      t => { t.imperativeMage.bottles[0]!.consumedWeek = t.imperativeMage.promotionWeek! - 1; },
      t => { t.imperativeMage.punishmentKnightActingAtPromotion = 99; },
      t => { delete t.progression.mastery[ARBITER_ABILITY_IDS[0]]; },
      t => { t.imperativeMage.bottles[1]!.labourSteps = 6; },
      t => { t.imperativeMage.bottles[1]!.id = 'imperative-mage-potion-1'; },
      t => { (t.imperativeMage.bottles as unknown[])[0] = null; },
      t => { (t.imperativeMage as unknown as Record<string, unknown>).life = null; },
      t => { (t.imperativeMage as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateImperativeMageState(t)).not.toThrow(); expect(validateImperativeMageState(t)).toBe(false); }
  });
  it('projects the two known categories read-only and clearly states the finite G boundaries and unknown recipe', () => {
    const s = promoted(), before = structuredClone(s), p = projectImperativeMage(s);
    expect(p.abilities.map(x => x.id)).toEqual([...IMPERATIVE_MAGE_ABILITY_IDS]);
    expect(p).toMatchObject({ title: '律令法师 · 序列4', promoted: true, formulaKnown: false, formula: [], insideCase: false });
    expect(p.cases).toHaveLength(3); expect(p.actions.some(a => a.command.type === 'OBSERVE')).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[IMPERATIVE_MAGE_ABILITY_IDS[0]]).toBe(0); expect(s).toEqual(before);
    expect(IMPERATIVE_MAGE_ABILITIES).toHaveLength(2);
    for (const boundary of ['第八部第13章', '第八部第36章', '混乱猎手3', '0-08', '不推导', '世界法则', '本作原创G']) expect(IMPERATIVE_MAGE_SOURCE_STATUS).toContain(boundary);
    expect(p.inheritedTools).toContain('PK5-SOFT-PAD-1'); expect(p.inheritedTools).toContain('已解决的旧迪恩');
    expect(IMPERATIVE_MAGE_ABILITIES.every(a => a.description.includes('G'))).toBe(true);
  });
  it('accepts canonical SQLite JSON order without changing promotion behavior or old original state', () => {
    for (const s of [punishmentKnight(), taught(), prepared(), promoted()]) {
      const reordered = JSON.parse(stableStringify(s)) as SliceState;
      expect(validateImperativeMageState(reordered)).toBe(true); expect(projectImperativeMage(reordered)).toEqual(projectImperativeMage(s));
    }
    const s = prepared(), reordered = JSON.parse(stableStringify(s)) as SliceState;
    const command = JSON.parse(stableStringify({ type: 'CONSUME', bottleId: s.imperativeMage.bottles[0]!.id, confirmed: true }));
    expect(validateImperativeMageCommand(command)).toBe(true); act(reordered, command);
    expect(isImperativeMage(reordered)).toBe(true); expect(validateImperativeMageState(JSON.parse(stableStringify(reordered)))).toBe(true);
  });
  it('migrates the actual276-command Punishment Knight route with all five old domains, props and old Dean unchanged', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/punishment-knight-v01150/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(276); expect(fixture.seed).toBe('arbiter-natural-v066');
    const previous = fixture.final, s = migrateSliceState(previous);
    for (const key of ['arbiter', 'sheriff', 'interrogator', 'judge', 'punishmentKnight', 'combatHistory', 'progression', 'character'] as const) expect(s[key]).toEqual(previous[key]);
    expect([s.week, s.status, s.progression.sequence, s.progression.acting, s.health, s.mind, s.spirituality]).toEqual([71, 'ACTIVE', 5, 100, 100, 100, 88]);
    expect(s.punishmentKnight.promotionWeek).toBe(63); expect(s.punishmentKnight.encounter.status).toBe('RESOLVED');
    expect(s.punishmentKnight.practice).toEqual({ pad: 'STAND', partner: 'FREE', rule: 'NONE', note: 'HANDED_OVER' });
    expect(s.imperativeMage).toEqual(createImperativeMageState()); expect(validateImperativeMageState(s)).toBe(true);
  });
});
