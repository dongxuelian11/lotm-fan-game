import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { CULTIVATOR_ABILITY_IDS } from '../../src/domain/cultivator/types.js';
import { PHYSICIAN_ABILITY_IDS } from '../../src/domain/physician/types.js';
import { HARVESTPRIEST_ABILITY_IDS } from '../../src/domain/harvestpriest/types.js';
import { BIOLOGIST_ABILITY_IDS } from '../../src/domain/biologist/types.js';
import { BIOLOGIST_GUIDE } from '../../src/domain/biologist/content.js';
import { applyDruidCommand, createDruidState, freshDruidPractice, isDruidAcquisitionCommand, projectDruid, validateDruidCommand, validateDruidState } from '../../src/domain/druid/index.js';
import { DRUID_ABILITIES, DRUID_FORMULA_STATUS, DRUID_GUIDE, DRUID_NOTEBOOK_ID, DRUID_PRICES, DRUID_STUDY_SOURCES } from '../../src/domain/druid/content.js';
import { DRUID_ABILITY_IDS, DRUID_CASE_IDS, DRUID_STUDY_SOURCE_IDS, type DruidAcquisitionCommand } from '../../src/domain/druid/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Directed acquisition fixture from the real ACTIVE practiced branch; never the later DEAD ending. */
function biologist(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/biologist-v0940/natural.json', 'utf8')).practiced;
  const s = migrateSliceState(previous);
  s.druid = createDruidState(); s.week = Math.max(s.week, s.biologist.promotionWeek! + 12);
  s.activeEvent = null; s.eventQueue = []; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 31; s.seer.pollution = 0;
  s.character.coreStats.will = 26; s.character.coreStats.knowledge = 14;
  return s;
}
function context(s: SliceState, roll = 1): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
}
function act(s: SliceState, command: DruidAcquisitionCommand, roll = 1) {
  const c = context(s, roll); applyDruidCommand(s, command, c); return c;
}
function taught(s = biologist()) { act(s, { type: 'LEARN_GUIDANCE' }); return s; }
function studied(s = taught()) {
  for (const sourceId of DRUID_STUDY_SOURCE_IDS) act(s, { type: 'STUDY', sourceId });
  return s;
}
function written(s = studied()) { act(s, { type: 'WRITE_RECORD' }); return s; }
function ready(s = written()) { act(s, { type: 'PREPARE_RITE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.druid.bottles[index]!; act(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = ready(); buy(s); return s; }
function promoted() { const s = prepared(); act(s, { type: 'CONSUME', bottleId: s.druid.bottles[0]!.id, confirmed: true }); return s; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDruidCommand(s, command as DruidAcquisitionCommand, c)).toThrow();
  expect(s).toEqual(before); expect(c.check).not.toHaveBeenCalled();
}

describe('Druid S5 original acquisition and actual known ritual component', () => {
  it('initializes independent originals and keeps the future channel hidden', () => {
    const s = createSliceRun('druid-hidden', sliceDefaultCreationSelection, 'druid-hidden');
    expect(validateDruidState(s)).toBe(true);
    expect(projectDruid(s)).toMatchObject({ discovered: false, promoted: false, formulaKnown: false, formula: [], actions: [], bottles: [], studies: [], abilities: [], cases: [], supplies: '', practice: freshDruidPractice() });
    expect(projectDruid(s).story).toBeUndefined();
    const other = createDruidState(); other.ritual.studies['ordinary-animals'].attemptWeek = 1; other.practice.position = 'FAR'; other.bottles[0]!.labourSteps = 5;
    expect(s.druid).toEqual(createDruidState()); reject(s, { type: 'LEARN_GUIDANCE' });
  });
  it('uses the ACTIVE original practiced branch and leaves the historical death unchanged', () => {
    const old = JSON.parse(readFileSync('tests/fixtures/biologist-v0940/natural.json', 'utf8'));
    expect([old.practiced.revision, old.practiced.status, old.final.status]).toEqual([171, 'ACTIVE', 'DEAD']);
    expect(biologist().status).toBe('ACTIVE');
    const dead = migrateSliceState(old.final); reject(dead, { type: 'LEARN_GUIDANCE' });
    expect(dead.status).toBe('DEAD'); expect(dead.biologist).toEqual(old.final.biologist);
  });
  it('charges the same Eve channel without granting a formula, knowledge, rite or resources', () => {
    const s = biologist(), old = structuredClone([s.cultivator, s.physician, s.harvestpriest, s.biologist]);
    const c = act(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([29540, 99, 31]); expect(c.check).not.toHaveBeenCalled();
    expect([s.cultivator, s.physician, s.harvestpriest, s.biologist]).toEqual(old);
    expect(DRUID_GUIDE).toBe(BIOLOGIST_GUIDE); expect(DRUID_PRICES).toEqual({ guidance: 460, potion: 4800, labourCredit: 4200, rite: 90 });
    expect(s.druid.ritual).toEqual(createDruidState().ritual);
    expect(DRUID_FORMULA_STATUS).toContain('三种超凡生物'); expect(DRUID_FORMULA_STATUS).toContain('完整晋升仪式细节尚未核实');
    expect(projectDruid(s)).toMatchObject({ formulaKnown: false, formula: [] }); expect(validateDruidState(s)).toBe(true);
    reject(s, { type: 'LEARN_GUIDANCE' }); reject(s, { type: 'WRITE_RECORD' }); reject(s, { type: 'PREPARE_RITE' });
  });
  it('studies four actual original references with three distinct supernatural creatures and returns each', () => {
    const s = taught(), ap = s.actionsRemaining, cash = s.cash;
    expect(DRUID_STUDY_SOURCES.map(source => source.creatures)).toEqual([['犬', '猫', '鼠'], ['拉瓦章鱼'], ['成年霍纳奇斯灰山羊'], ['六翼石像鬼']]);
    for (const source of DRUID_STUDY_SOURCES) {
      const c = act(s, { type: 'STUDY', sourceId: source.id });
      expect(c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
      expect(c.note).toHaveBeenCalledWith(`实际研习${source.title}`, expect.stringContaining(source.referenceId));
      expect(c.note).toHaveBeenCalledWith(`实际研习${source.title}`, expect.stringContaining(DRUID_NOTEBOOK_ID));
      expect(c.note).toHaveBeenCalledWith(`实际研习${source.title}`, expect.stringContaining('当次将参考册原位归还'));
      expect(s.druid.ritual.studies[source.id]).toEqual({ attemptWeek: s.week, completedWeek: s.week });
      reject(s, { type: 'STUDY', sourceId: source.id });
    }
    expect([s.actionsRemaining, s.cash, s.spirituality]).toEqual([ap - 4, cash, 31]);
    expect(s.druid.ritual.recordWrittenWeek).toBeNull(); expect(validateDruidState(s)).toBe(true);
  });
  it('retains paid failed study notes, blocks same-week rerolls and permits another source now or retry next week', () => {
    const s = taught(), ap = s.actionsRemaining;
    const c = act(s, { type: 'STUDY', sourceId: 'lava-octopus' }, 85);
    expect(s.druid.ritual.studies['lava-octopus']).toEqual({ attemptWeek: s.week, completedWeek: null });
    expect(s.actionsRemaining).toBe(ap - 1); expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('现有笔记保留'));
    reject(s, { type: 'STUDY', sourceId: 'lava-octopus' }); reject(s, { type: 'WRITE_RECORD' });
    act(s, { type: 'STUDY', sourceId: 'ordinary-animals' }); s.week++;
    act(s, { type: 'STUDY', sourceId: 'lava-octopus' });
    expect(s.druid.ritual.studies['lava-octopus'].completedWeek).toBe(s.week); expect(validateDruidState(s)).toBe(true);
  });
  it('requires all four studies then actual knowledge12 writing, retaining failed text until next-week completion', () => {
    const s = taught();
    for (const sourceId of DRUID_STUDY_SOURCE_IDS.slice(0, 3)) act(s, { type: 'STUDY', sourceId });
    reject(s, { type: 'WRITE_RECORD' }); act(s, { type: 'STUDY', sourceId: 'six-winged-gargoyle' });
    const ap = s.actionsRemaining, c = act(s, { type: 'WRITE_RECORD' }, 85);
    expect(c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 12);
    expect([s.actionsRemaining, s.druid.ritual.recordAttemptWeek, s.druid.ritual.recordWrittenWeek]).toEqual([ap - 1, s.week, null]);
    expect(c.note).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('已有文字留在原册中'));
    reject(s, { type: 'WRITE_RECORD' }); reject(s, { type: 'PREPARE_RITE' });
    s.week++; act(s, { type: 'WRITE_RECORD' });
    expect(s.druid.ritual.recordWrittenWeek).toBe(s.week); reject(s, { type: 'WRITE_RECORD' }); expect(validateDruidState(s)).toBe(true);
  });
  it('charges one action and 90p per preparation and cannot reuse it after a failed bottle', () => {
    const s = written(), b = buy(s), cash = s.cash, ap = s.actionsRemaining, learning = structuredClone(s.druid.ritual.studies);
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    act(s, { type: 'PREPARE_RITE' }); expect([s.cash, s.actionsRemaining, s.druid.ritual.attempts, s.druid.ritual.readyWeek]).toEqual([cash - 90, ap - 1, 1, s.week]);
    reject(s, { type: 'PREPARE_RITE' });
    act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85);
    expect(s.druid.ritual).toMatchObject({ studies: learning, recordWrittenWeek: s.week, readyWeek: null, attempts: 1 });
    const second = buy(s, 1); reject(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    const afterFailure = [s.health, s.mind, s.spirituality]; act(s, { type: 'PREPARE_RITE' });
    expect([s.health, s.mind, s.spirituality]).toEqual(afterFailure); expect(s.druid.ritual.attempts).toBe(2);
    act(s, { type: 'CONSUME', bottleId: second.id, confirmed: true });
    expect(s.druid.ritual.readyWeek).toBeNull(); expect(validateDruidState(s)).toBe(true);
  });
  it('requires five bottle-specific labour actions and actual 600p payment, with no partial credit', () => {
    const s = taught(), b = s.druid.bottles[0]!;
    for (let n = 0; n < 5; n++) act(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.labourSteps, b.status, s.actionsRemaining]).toEqual([5, 'SUPPLIER', 94]);
    reject(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, b.status]).toEqual([28940, 'PLAYER']);
    const second = s.druid.bottles[1]!; act(s, { type: 'POTION_WORK', bottleId: second.id }); const cash = s.cash; buy(s, 1);
    expect(cash - s.cash).toBe(4800); reject(s, { type: 'BUY_POTION', bottleId: b.id }); expect(validateDruidState(s)).toBe(true);
  });
  it('permits early study and original preparation but still requires digestion100 and twelve complete weeks', () => {
    const s = biologist(); s.week = s.biologist.promotionWeek! + 1; s.progression.acting = 0; ready(written(studied(taught(s)))); const b = buy(s);
    expect(validateDruidState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = s.biologist.promotionWeek! + 11; s.progression.acting = 100;
    expect(projectDruid(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); s.week++;
    s.progression.acting = 99; reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(validateDruidState(s)).toBe(true);
  });
  it('uses will26 for all four actual drink outcomes and spends one original plus its preparation', () => {
    const tiers = [[1, 'GREAT_SUCCESS', 95, 100, 0, 5], [30, 'SUCCESS', 90, 100, 0, 5], [85, 'FAILURE', 80, 90, 25, 6], [100, 'GREAT_FAILURE', 60, 80, 50, 6]] as const;
    for (const [roll, tier, mind, health, pollution, sequence] of tiers) {
      const s = prepared(), old = { ...s.progression.mastery }, b = s.druid.bottles[0]!;
      const c = act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
      expect(c.check).toHaveBeenCalledExactlyOnceWith('will', 26);
      expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
      expect(s.druid.ritual).toMatchObject({ readyWeek: null, attempts: 1, recordWrittenWeek: s.week });
      for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
      expect(validateDruidState(s)).toBe(true); reject(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    }
  });
  it('preserves all four previous stages, original histories and mastery, adding only ground passage with no refill', () => {
    const s = prepared(), old = structuredClone([s.cultivator, s.physician, s.harvestpriest, s.biologist, s.combatHistory]), stats = { ...s.character.coreStats };
    act(s, { type: 'CONSUME', bottleId: s.druid.bottles[0]!.id, confirmed: true });
    expect([s.cultivator, s.physician, s.harvestpriest, s.biologist, s.combatHistory]).toEqual(old);
    expect(s.druid.biologistActingAtPromotion).toBe(100); expect(s.biologist.encounter.status).toBe('AVAILABLE');
    expect(Object.keys(s.progression.mastery)).toEqual([...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS, ...HARVESTPRIEST_ABILITY_IDS, ...BIOLOGIST_ABILITY_IDS, ...DRUID_ABILITY_IDS]);
    expect(DRUID_ABILITY_IDS).toEqual(['mother.s5.ground-passage']); expect(DRUID_ABILITIES).toHaveLength(1);
    expect(s.progression.mastery['mother.s5.ground-passage']).toBe(0); expect(s.druid.practice).toEqual(freshDruidPractice());
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(validateDruidState(s)).toBe(true);
  });
  it('keeps low health, mind, action, cash, original contact, event and location refusals atomic', () => {
    for (const [health, mind] of [[20, 100], [100, 40]]) { const s = prepared(); s.health = health!; s.mind = mind!; reject(s, { type: 'CONSUME', bottleId: s.druid.bottles[0]!.id, confirmed: true }); }
    const poor = written(); poor.cash = 89; reject(poor, { type: 'PREPARE_RITE' }); poor.cash = 90; poor.actionsRemaining = 0; reject(poor, { type: 'PREPARE_RITE' });
    const last = written(); last.actionsRemaining = 1; act(last, { type: 'PREPARE_RITE' }); const b = buy(last); act(last, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(last.actionsRemaining).toBe(0);
    const open = taught(); open.biologist.cases['sample-record']!.contactOpen = true; reject(open, { type: 'STUDY', sourceId: 'ordinary-animals' });
    const elsewhere = taught(); elsewhere.world.city = 'ELSEWHERE'; reject(elsewhere, { type: 'STUDY', sourceId: 'ordinary-animals' });
    const battle = taught(); battle.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null }; reject(battle, { type: 'STUDY', sourceId: 'ordinary-animals' });
  });
  it('retains failures and waits a real week for another finite independently paid batch', () => {
    const s = written(); reject(s, { type: 'REQUEST_SUPPLY' });
    for (let n = 0; n < 3; n++) { ready(s); const b = buy(s, n); act(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.druid.bottles), learning = structuredClone(s.druid.ritual), ap = s.actionsRemaining;
    act(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); reject(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; act(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.druid.bottles.slice(0, 3)).toEqual(originals); expect(s.druid.ritual).toEqual(learning); expect(s.druid.bottles).toHaveLength(6);
    expect(s.druid.bottles[3]).toMatchObject({ id: 'druid-potion-4', status: 'SUPPLIER', acquiredWeek: null, labourSteps: 0 });
    expect(validateDruidState(s)).toBe(true); reject(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects forged knowledge, chronology, ritual reuse and malformed nested state without throwing', () => {
    const s = promoted();
    const changes: ((t: SliceState) => void)[] = [
      t => { t.druid.bottles[0]!.source = 'invented'; },
      t => { t.druid.ritual.studies['lava-octopus'].completedWeek = null; },
      t => { t.druid.ritual.studies['grey-goat'].attemptWeek = null; },
      t => { t.druid.ritual.recordWrittenWeek = null; },
      t => { t.druid.ritual.recordWrittenWeek = t.week + 1; },
      t => { t.druid.ritual.recordAttemptWeek = t.week - 1; },
      t => { t.druid.ritual.readyWeek = t.week; },
      t => { t.druid.ritual.attempts = 0; },
      t => { t.druid.biologistActingAtPromotion = 99; },
      t => { t.progression.mastery['mother.s5.bear-form'] = 0; },
      t => { delete t.progression.mastery[BIOLOGIST_ABILITY_IDS[0]]; },
      t => { (t.druid as unknown as Record<string, unknown>).ritual = null; },
      t => { (t.druid.ritual as unknown as Record<string, unknown>).studies = null; },
      t => { (t.druid.ritual.studies as unknown as Record<string, unknown>)['lava-octopus'] = null; },
      t => { (t.druid.ritual.studies as unknown as Record<string, unknown>)['ordinary-dog'] = { attemptWeek: t.week, completedWeek: t.week }; },
      t => { (t.druid.cases as unknown as Record<string, unknown>)['known-soil'] = null; },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(() => validateDruidState(t)).not.toThrow(); expect(validateDruidState(t)).toBe(false); }
  });
  it('projects detached study records, live command reasons, ritual costs and the single verified ability', () => {
    const s = written(), p = projectDruid(s), before = structuredClone(s);
    expect(p.studies).toHaveLength(4); expect(p.studies.every(study => study.completed && !study.action.enabled)).toBe(true);
    expect(p.ritual).toMatchObject({ notebook: DRUID_NOTEBOOK_ID, attempts: 0 }); expect(p.ritual.summary).toContain('90便士');
    expect(p.actions.find(a => a.id === 'prepare-druid-rite')).toMatchObject({ enabled: true, command: { type: 'PREPARE_RITE' } });
    p.studies[0]!.creatures.push('invented'); p.practice.position = 'FAR'; p.bottles[0]!.source = 'changed';
    expect(s).toEqual(before);
    const final = promoted(), q = projectDruid(final); expect(q.abilities.map(x => x.id)).toEqual([...DRUID_ABILITY_IDS]); expect(q.studies.every(study => !study.action.enabled)).toBe(true);
  });
  it('allows only the four named sources, exact preparation commands and honest ordinary practices', () => {
    for (const sourceId of DRUID_STUDY_SOURCE_IDS) expect(isDruidAcquisitionCommand({ type: 'STUDY', sourceId })).toBe(true);
    for (const type of ['WRITE_RECORD', 'PREPARE_RITE', 'LEARN_GUIDANCE']) expect(isDruidAcquisitionCommand({ type })).toBe(true);
    for (const caseId of DRUID_CASE_IDS) {
      expect(validateDruidCommand({ type: 'PREPARE', caseId, method: 'ORDINARY' })).toBe(true);
      expect(validateDruidCommand({ type: 'PREPARE', caseId, method: 'ABILITY' })).toBe(caseId === 'known-soil');
      expect(validateDruidCommand({ type: 'RETURN', caseId, method: 'ABILITY' })).toBe(caseId === 'known-soil');
    }
    for (const command of [null, {}, { type: 'STUDY', sourceId: 'dog' }, { type: 'STUDY', sourceId: 'ordinary-animals', free: true }, { type: 'WRITE_RECORD', complete: true }, { type: 'PREPARE_RITE', free: true }, { type: 'BEAR_FORM' }, { type: 'BREW' }, { type: 'CONSUME', bottleId: 'druid-potion-1', confirmed: false }, { type: 'BUY_POTION', bottleId: 'biologist-potion-1' }, { type: 'RETURN', caseId: 'known-soil', method: 'TELEPORT' }]) expect(validateDruidCommand(command)).toBe(false);
  });
});
