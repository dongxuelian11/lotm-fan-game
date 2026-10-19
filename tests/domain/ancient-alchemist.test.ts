import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { CULTIVATOR_ABILITY_IDS } from '../../src/domain/cultivator/types.js';
import { PHYSICIAN_ABILITY_IDS } from '../../src/domain/physician/types.js';
import { HARVESTPRIEST_ABILITY_IDS } from '../../src/domain/harvestpriest/types.js';
import { BIOLOGIST_ABILITY_IDS } from '../../src/domain/biologist/types.js';
import { DRUID_ABILITY_IDS } from '../../src/domain/druid/types.js';
import { applyAncientAlchemistCommand, createAncientAlchemistState, isAncientAlchemist, isAncientAlchemistAcquisitionCommand, projectAncientAlchemist, validateAncientAlchemistCommand, validateAncientAlchemistState } from '../../src/domain/ancient-alchemist/index.js';
import { ANCIENT_ALCHEMIST_ABILITIES, ANCIENT_ALCHEMIST_CONSUMPTION_RISK, ANCIENT_ALCHEMIST_FORMULA_STATUS, ANCIENT_ALCHEMIST_PRICES, ANCIENT_ALCHEMIST_SOURCE_STATUS } from '../../src/domain/ancient-alchemist/content.js';
import { ANCIENT_ALCHEMIST_ABILITY_IDS, type AncientAlchemistCommand } from '../../src/domain/ancient-alchemist/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Directed fixtures continue the real Druid save. Test resources and prescribed rolls are not natural-play evidence.
function druid(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/druid-v01160/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous);
  s.ancientAlchemist = createAncientAlchemistState(); s.week = Math.max(s.week, s.druid.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 40000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: AncientAlchemistCommand, roll = 1) {
  const c = context(s, roll); applyAncientAlchemistCommand(s, command, c); return c;
}
function taught(s = druid()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.ancientAlchemist.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.ancientAlchemist.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyAncientAlchemistCommand(s, command as AncientAlchemistCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled(); expect(c.note).not.toHaveBeenCalled();
}
const oldIds = [...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS, ...HARVESTPRIEST_ABILITY_IDS, ...BIOLOGIST_ABILITY_IDS, ...DRUID_ABILITY_IDS];
const oldStages = (s: SliceState) => [s.cultivator, s.physician, s.harvestpriest, s.biologist, s.druid, s.town, s.combatHistory];

describe('Ancient Alchemist S4 independent bottles and recoverable G medicine', () => {
  it('keeps the unvisited channel dormant and every new run independent, with independent original supplies', () => {
    const s = createSliceRun('ancient-alchemist-hidden', sliceDefaultCreationSelection, 'ancient-alchemist-hidden');
    expect(validateAncientAlchemistState(s)).toBe(true);
    expect(projectAncientAlchemist(s)).toMatchObject({ discovered: false, promoted: false, guidanceKnown: false, formulaKnown: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '' });
    expect(projectAncientAlchemist(s).story).toBeUndefined();
    const other = createAncientAlchemistState(); other.bottles[0]!.labourSteps = 5; other.resupply.deliveries = 1;
    expect(s.ancientAlchemist).toEqual(createAncientAlchemistState()); expect(other.life).not.toBe(s.ancientAlchemist.life); expect(other.encounter).not.toBe(s.ancientAlchemist.encounter);
    expect(s.ancientAlchemist.bottles.map(b => b.id)).toEqual(['ancient-alchemist-potion-1', 'ancient-alchemist-potion-2', 'ancient-alchemist-potion-3']); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 540 and one action to the same guide without granting a formula or touching the old five stages', () => {
    const s = druid(), old = structuredClone(oldStages(s));
    expect(validateAncientAlchemistState(s)).toBe(true);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([39460, 99]); expect(c.check).not.toHaveBeenCalled(); expect(oldStages(s)).toEqual(old);
    expect(ANCIENT_ALCHEMIST_PRICES).toEqual({ guidance: 540, potion: 6800, labourCredit: 5300 });
    for (const phrase of ['完整配方与晋升仪式细节尚未核实', '不能据未知细节断言无需仪式', '不冒充已还原原著仪式']) expect(ANCIENT_ALCHEMIST_FORMULA_STATUS).toContain(phrase);
    expect(projectAncientAlchemist(s)).toMatchObject({ discovered: true, guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(c.note).toHaveBeenCalledWith('听取古代炼金师用药说明', expect.stringContaining('实际核对原瓶、准备原苗圃训练园安静场地'));
    reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five real jobs, a bottle-specific 5300 credit, and the remaining 1500 payment', () => {
    const s = taught(), b = s.ancientAlchemist.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([37960, 94, 'PLAYER']);
    const second = s.ancientAlchemist.bottles[1]!; expect(second.labourSteps).toBe(0);
    act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(6800); expect(validateAncientAlchemistState(s)).toBe(true);
    reject(s, { type: 'BUY_POTION', bottleId: b.id }); reject(s, { type: 'POTION_WORK', bottleId: b.id });
    s.cash = 6799; reject(s, { type: 'BUY_POTION', bottleId: s.ancientAlchemist.bottles[2]!.id });
  });
  it('permits advance preparation but needs Druid digestion100 and twelve complete actual weeks', () => {
    const s = druid(); s.week = s.druid.promotionWeek!; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validateAncientAlchemistState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.druid.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectAncientAlchemist(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week++; s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    expect(isAncientAlchemist(s)).toBe(true); expect(s.ancientAlchemist.druidActingAtPromotion).toBe(100);
  });
  it('consumes only the selected original and executes all four medicine outcomes without altering any old ledger', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 96, 100, 31, 0, 4], [30, 'SUCCESS', 92, 100, 16, 0, 4], [85, 'FAILURE', 75, 85, 31, 30, 5], [100, 'GREAT_FAILURE', 55, 75, 31, 60, 5]] as const;
    for (const [roll, tier, mind, health, spirit, pollution, sequence] of tiers) {
      const s = prepared(), old = structuredClone(oldStages(s)), mastery = { ...s.progression.mastery }, b = s.ancientAlchemist.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 28);
      expect(c.note).toHaveBeenCalledWith('导师完成本次古代炼金师服药准备', expect.stringContaining(b.id));
      expect([b.status, b.outcome, s.mind, s.health, s.spirituality, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, spirit, pollution, sequence, 'ACTIVE']);
      expect(oldStages(s)).toEqual(old); for (const [id, value] of Object.entries(mastery)) expect(s.progression.mastery[id]).toBe(value);
      expect(s.ancientAlchemist.bottles.slice(1).every(x => x.status === 'SUPPLIER')).toBe(true);
      if (sequence === 5) expect(s.progression.acting).toBe(100);
      expect(validateAncientAlchemistState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('leaves severe medicine failure recoverable, but does not restore bottles or extend protection to battle', () => {
    const s = prepared(); s.health = 21; s.mind = 41; s.seer.pollution = 90;
    const b = s.ancientAlchemist.bottles[0]!; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.status, s.progression.sequence, s.progression.acting, s.seer.pollution]).toEqual([1, 1, 'ACTIVE', 5, 100, 100]);
    expect(b).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_FAILURE' }); expect(validateAncientAlchemistState(s)).toBe(true);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(ANCIENT_ALCHEMIST_CONSUMPTION_RISK).toContain('保护不适用于战斗');
  });
  it('blocks health20 and mind40 before rolling and floors actual successful spirituality at zero', () => {
    for (const [health, mind] of [[20, 100], [100, 40], [1, 1]]) {
      const s = prepared(); s.health = health!; s.mind = mind!;
      reject(s, { type: 'CONSUME', bottleId: s.ancientAlchemist.bottles[0]!.id, confirmed: true });
      expect(s.ancientAlchemist.bottles[0]!.status).toBe('PLAYER');
      expect(projectAncientAlchemist(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('先休养');
    }
    const s = prepared(); s.spirituality = 3;
    act(s, { type: 'CONSUME', bottleId: s.ancientAlchemist.bottles[0]!.id, confirmed: true }, 30);
    expect(s.spirituality).toBe(0); expect(isAncientAlchemist(s)).toBe(true); expect(validateAncientAlchemistState(s)).toBe(true);
  });
  it('adds exactly two zero masteries while retaining all five original domains, original props and resolved Marlon', () => {
    const s = prepared(), old = structuredClone(oldStages(s)), stats = { ...s.character.coreStats }, gender = s.character.gender, mastery = { ...s.progression.mastery };
    act(s, { type: 'CONSUME', bottleId: s.ancientAlchemist.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.gender).toBe(gender);
    expect(s.druid.encounter.status).toBe('RESOLVED');
    expect(s.druid.practice).toEqual({ position: 'NEAR', soil: 'SETTLED', marker: 'BOX', seedlings: 'RESTING', note: 'HANDED_OVER', returnAttempted: true });
    expect(Object.keys(s.progression.mastery).sort()).toEqual([...oldIds, ...ANCIENT_ALCHEMIST_ABILITY_IDS].sort());
    for (const id of oldIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    expect(ANCIENT_ALCHEMIST_ABILITY_IDS).toEqual(['mother.s4.vital-knit', 'mother.s4.living-matrix']);
    for (const id of ANCIENT_ALCHEMIST_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]);
    const initial = createAncientAlchemistState(); expect(s.ancientAlchemist.life).toEqual(initial.life); expect(s.ancientAlchemist.encounter).toEqual(initial.encounter);
    expect(projectAncientAlchemist(s).digestion).toContain('古代炼金师扮演0/100'); expect(validateAncientAlchemistState(s)).toBe(true);
  });
  it('caps actual stat growth at500 without refilling spirituality or changing original records', () => {
    const s = prepared(), old = structuredClone(oldStages(s)); s.character.coreStats.physique = 500;
    act(s, { type: 'CONSUME', bottleId: s.ancientAlchemist.bottles[0]!.id, confirmed: true });
    expect(oldStages(s)).toEqual(old); expect(s.character.coreStats.physique).toBe(500); expect(s.spirituality).toBe(31);
    expect(s.druid.encounter.status).toBe('RESOLVED');
  });
  it('retains exhausted failed originals and waits until the next actual week for three independently paid new bottles', () => {
    const s = taught(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { s.health = 100; s.mind = 100; const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.ancientAlchemist.bottles), old = structuredClone(oldStages(s)), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1);
    reject(s, { type: 'RECEIVE_SUPPLY' }); reject(s, { type: 'REQUEST_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.ancientAlchemist.bottles.slice(0, 3)).toEqual(originals); expect(s.ancientAlchemist.bottles).toHaveLength(6); expect(oldStages(s)).toEqual(old);
    expect(s.ancientAlchemist.bottles[3]).toMatchObject({ id: 'ancient-alchemist-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(projectAncientAlchemist(s).actions.find(a => a.id === 'buy-ancient-alchemist-potion-4')!.cost).toContain('6800便士');
    expect(validateAncientAlchemistState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.health = 100; s.mind = 100; const next = buy(s, 3); act(s, { type: 'CONSUME', bottleId: next.id, confirmed: true });
    expect(s.ancientAlchemist.bottles.slice(0, 3)).toEqual(originals); expect(validateAncientAlchemistState(s)).toBe(true);
  });
  it('supports zero-action purchase and separate confirmation of the selected second original', () => {
    const s = taught(); s.actionsRemaining = 0;
    const first = structuredClone(s.ancientAlchemist.bottles[0]), second = buy(s, 1);
    reject(s, { type: 'CONSUME', bottleId: second.id });
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.actionsRemaining).toBe(0); expect(s.ancientAlchemist.bottles[0]).toEqual(first);
    expect(second).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS' }); expect(validateAncientAlchemistState(s)).toBe(true);
    reject(s, { type: 'REQUEST_SUPPLY' }); reject(s, { type: 'BUY_POTION', bottleId: s.ancientAlchemist.bottles[2]!.id });
  });
  it('enforces action, cash, city, combat and finished-run gates before mutation', () => {
    const noAction = druid(); noAction.actionsRemaining = 0; reject(noAction, { type: 'LEARN_GUIDANCE' });
    const noCash = druid(); noCash.cash = 539; reject(noCash, { type: 'LEARN_GUIDANCE' });
    const dead = prepared(); dead.status = 'DEAD'; reject(dead, { type: 'CONSUME', bottleId: dead.ancientAlchemist.bottles[0]!.id, confirmed: true });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'BUY_POTION', bottleId: elsewhere.ancientAlchemist.bottles[0]!.id });
    const blocked = taught(); blocked.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    reject(blocked, { type: 'POTION_WORK', bottleId: blocked.ancientAlchemist.bottles[0]!.id });
  });
  it('requires actual cleanup of old contact, physical originals and unfinished preparations', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { Object.values(s.cultivator.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.physician.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.harvestpriest.cases)[0]!.contactOpen = true; },
      s => { Object.values(s.biologist.cases)[0]!.contactOpen = true; },
      s => { s.druid.cases['known-soil']!.contactOpen = true; },
      s => { s.druid.practice.position = 'FAR'; },
      s => { s.druid.practice.soil = 'SOFTENED'; },
      s => { s.druid.practice.marker = 'FAR'; },
      s => { s.druid.practice.seedlings = 'OBSERVED'; },
      s => { s.druid.practice.note = 'WRITTEN'; },
      s => { s.druid.cases['known-soil']!.status = 'PREPARED'; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); reject(s, { type: 'CONSUME', bottleId: s.ancientAlchemist.bottles[0]!.id, confirmed: true }); }
  });
  it('rejects invented recipes, power commands, unconfirmed consumption and a foreign original', () => {
    const malformed = [null, {}, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'ancient-alchemist-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'druid-potion-1' }, { type: 'CONSUME', bottleId: 'ancient-alchemist-potion-1', confirmed: true, target: 'anyone' }, { type: 'REFLECT', extra: true }, { type: 'RESURRECT' }, { type: 'CREATE_SOUL' }, { type: 'CREATE_PERSON' }, { type: 'INFINITE_FOOD' }, { type: 'ANIMAL_FORM' }, { type: 'FREE_MYTHIC_FORM' }];
    for (const command of malformed) { expect(validateAncientAlchemistCommand(command)).toBe(false); expect(isAncientAlchemistAcquisitionCommand(command)).toBe(false); reject(prepared(), command); }
    reject(prepared(), { type: 'BUY_POTION', bottleId: 'ancient-alchemist-potion-999' });
  });
  it('routes exact life and encounter commands through the unified entry point', () => {
    const s = promoted();
    expect(validateAncientAlchemistCommand({ type: 'OBSERVE', caseId: 'living-stem' })).toBe(true);
    expect(isAncientAlchemistAcquisitionCommand({ type: 'OBSERVE', caseId: 'living-stem' })).toBe(false);
    expect(validateAncientAlchemistCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(validateAncientAlchemistCommand({ type: 'REQUEST_KITS' })).toBe(true);
    act(s, { type: 'OBSERVE', caseId: 'living-stem' });
    expect(s.ancientAlchemist.life.cases['living-stem'].status).toBe('OBSERVED'); expect(validateAncientAlchemistState(s)).toBe(true);
  });
  it('keeps valid bottle records and rejects malformed originals or missing prior mastery without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.ancientAlchemist.bottles[0]!.source = 'invented'; },
      t => { t.ancientAlchemist.bottles[0]!.consumedWeek = t.ancientAlchemist.promotionWeek! - 1; },
      t => { t.ancientAlchemist.druidActingAtPromotion = 99; },
      t => { delete t.progression.mastery[CULTIVATOR_ABILITY_IDS[0]]; },
      t => { t.ancientAlchemist.bottles[1]!.labourSteps = 6; },
      t => { t.ancientAlchemist.bottles[1]!.id = 'ancient-alchemist-potion-1'; },
      t => { (t.ancientAlchemist.bottles as unknown[])[0] = null; },
      t => { (t.ancientAlchemist as unknown as Record<string, unknown>).life = null; },
      t => { (t.ancientAlchemist as unknown as Record<string, unknown>).encounter = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateAncientAlchemistState(t)).not.toThrow(); expect(validateAncientAlchemistState(t)).toBe(false); }
  });
  it('projects two G prototypes read-only within the source-backed life-alchemy direction and unknown recipe', () => {
    const s = promoted(), before = structuredClone(s), p = projectAncientAlchemist(s);
    expect(p.abilities.map(x => x.id)).toEqual([...ANCIENT_ALCHEMIST_ABILITY_IDS]);
    expect(p).toMatchObject({ title: '古代炼金师 · 序列4', promoted: true, formulaKnown: false, formula: [], insideCase: false });
    expect(p.cases).toHaveLength(3); expect(p.actions.some(a => a.command.type === 'OBSERVE')).toBe(true);
    p.abilities[0]!.mastery = 99; expect(s.progression.mastery[ANCIENT_ALCHEMIST_ABILITY_IDS[0]]).toBe(0); expect(s).toEqual(before);
    expect(ANCIENT_ALCHEMIST_ABILITIES).toHaveLength(2);
    for (const boundary of ['第五部第143章', '第七部第55章', '抬棺人3', '隐匿贤者', '不推导', '生命手杖', '本作原创G']) expect(ANCIENT_ALCHEMIST_SOURCE_STATUS).toContain(boundary);
    expect(p.inheritedTools).toContain('DR5-MARKER-1'); expect(p.inheritedTools).toContain('旧马伦');
    expect(ANCIENT_ALCHEMIST_ABILITIES.every(a => a.description.includes('G'))).toBe(true);
  });
  it('accepts canonical SQLite JSON order without changing promotion behavior or old original state', () => {
    for (const s of [druid(), taught(), prepared(), promoted()]) {
      const reordered = JSON.parse(stableStringify(s)) as SliceState;
      expect(validateAncientAlchemistState(reordered)).toBe(true); expect(projectAncientAlchemist(reordered)).toEqual(projectAncientAlchemist(s));
    }
    const s = prepared(), reordered = JSON.parse(stableStringify(s)) as SliceState;
    const command = JSON.parse(stableStringify({ type: 'CONSUME', bottleId: s.ancientAlchemist.bottles[0]!.id, confirmed: true }));
    expect(validateAncientAlchemistCommand(command)).toBe(true); act(reordered, command);
    expect(isAncientAlchemist(reordered)).toBe(true); expect(validateAncientAlchemistState(JSON.parse(stableStringify(reordered)))).toBe(true);
  });
  it('migrates the actual304-command Druid route with all five old domains, props and old Marlon unchanged', () => {
    const fixture = JSON.parse(readFileSync('tests/fixtures/druid-v01160/natural.json', 'utf8'));
    expect(fixture.commands).toHaveLength(304); expect(fixture.seed).toBe('cultivator-natural-v069');
    const previous = fixture.final, s = migrateSliceState(previous);
    for (const key of ['cultivator', 'physician', 'harvestpriest', 'biologist', 'druid', 'combatHistory', 'progression', 'character'] as const) expect(s[key]).toEqual(previous[key]);
    expect([s.week, s.status, s.progression.sequence, s.progression.acting, s.health, s.mind, s.spirituality]).toEqual([82, 'ACTIVE', 5, 100, 100, 100, 100]);
    expect(s.druid.promotionWeek).toBe(75); expect(s.druid.encounter.status).toBe('RESOLVED');
    expect(s.druid.bottles.slice(0, 4).map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS']);
    expect(s.druid.practice).toEqual({ position: 'NEAR', soil: 'SETTLED', marker: 'BOX', seedlings: 'RESTING', note: 'HANDED_OVER', returnAttempted: true });
    expect(s.ancientAlchemist).toEqual(createAncientAlchemistState()); expect(validateAncientAlchemistState(s)).toBe(true);
  });
});
