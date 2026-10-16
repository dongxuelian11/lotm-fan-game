import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import { SEER_ABILITY_IDS } from '../../src/domain/seer/types.js';
import { applyClownCommand } from '../../src/domain/clown/index.js';
import { CLOWN_ABILITY_IDS } from '../../src/domain/clown/types.js';
import { applyMagicianCommand } from '../../src/domain/magician/index.js';
import { MAGICIAN_ABILITY_IDS } from '../../src/domain/magician/types.js';
import { applyFacelessAcquisition, createFacelessState, isFacelessAcquisitionCommand, projectFaceless, validFacelessCommand, validFacelessState } from '../../src/domain/faceless/index.js';
import { applyFacelessActivity, facelessInside, validateFacelessPractice } from '../../src/domain/faceless/practice.js';
import { FACELESS_FORMULA, FACELESS_FORMULA_SOURCE, FACELESS_PRICES, FACELESS_SOURCE_STATUS } from '../../src/domain/faceless/content.js';
import { FACELESS_ABILITY_IDS, FACELESS_CASE_IDS, type FacelessAcquisitionCommand, type FacelessActivityCommand, type FacelessCaseId } from '../../src/domain/faceless/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('faceless-domain', sliceDefaultCreationSelection, 'faceless-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 80; s.weeklyBudget = 80; s.health = 100; s.mind = 100;
  s.faceless = createFacelessState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[FACELESS_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function magician(): SliceState {
  const s = ordinary(), c = context(s).c;
  applySeerCommand(s, { type: 'DISCOVER' }, c);
  applySeerCommand(s, { type: 'LEARN_FORMULA' }, c);
  applySeerCommand(s, { type: 'BUY_MATERIALS', batchId: s.seer.batches[0]!.id }, c);
  applySeerCommand(s, { type: 'BREW', batchId: s.seer.batches[0]!.id }, c);
  applySeerCommand(s, { type: 'CONSUME', bottleId: s.seer.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyClownCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyClownCommand(s, { type: 'BUY_MATERIALS', batchId: s.clown.batches[0]!.id }, c);
  applyClownCommand(s, { type: 'BREW', batchId: s.clown.batches[0]!.id }, c);
  applyClownCommand(s, { type: 'CONSUME', bottleId: s.clown.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyMagicianCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyMagicianCommand(s, { type: 'BUY_MATERIALS', batchId: s.magician.batches[0]!.id }, c);
  applyMagicianCommand(s, { type: 'BREW', batchId: s.magician.batches[0]!.id }, c);
  applyMagicianCommand(s, { type: 'CONSUME', bottleId: s.magician.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SEER_ABILITY_IDS, ...CLOWN_ABILITY_IDS, ...MAGICIAN_ABILITY_IDS].map((id, index) => [id, 20 + index]));
  s.cash = 20000; s.actionsRemaining = 80; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: FacelessAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyFacelessAcquisition(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: FacelessActivityCommand, roll = 1) { const ctx = context(s, roll); applyFacelessActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = magician()) { acquisition(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const batchId = s.faceless.batches[index]!.id;
  acquisition(s, { type: 'BUY_MATERIALS', batchId }); acquisition(s, { type: 'BREW', batchId }); return s.faceless.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.faceless.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyFacelessAcquisition(s, command as FacelessAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyFacelessActivity(s, command as FacelessActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: FacelessCaseId, method: 'ABILITY' | 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
  if (method === 'ABILITY') {
    const templateId = caseId === 'stage-double' ? 'STAGE_DOUBLE' : 'PORTER_PART';
    if (s.faceless.appearance.templateId !== templateId) activity(s, { type: 'CHANGE_APPEARANCE', templateId });
    activity(s, { type: 'BORROW_OUTFIT', caseId });
  }
}
function completeOrdinary(s: SliceState, caseId: FacelessCaseId) {
  begin(s, caseId, 'ORDINARY'); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId });
}

describe('Faceless six original materials and independent S6 promotion', () => {
  it('keeps three fresh finite stocks independent and hides acquisition from ordinary people', () => {
    const s = ordinary(), p = projectFaceless(s);
    expect(validFacelessState(s)).toBe(true);
    expect([p.discovered, p.formulaKnown, p.promoted]).toEqual([false, false, false]);
    expect([p.formula, p.actions, p.bottles, p.abilities, p.cases]).toEqual([[], [], [], [], []]);
    expect(p.story).toBeUndefined(); expect(p.supplies).toBe('');
    const other = createFacelessState(); other.batches[0]!.materials[0]!.quantity = 0; other.appearance.changes = 1;
    expect(s.faceless.batches[0]!.materials[0]!.quantity).toBe(1); expect(s.faceless.appearance.changes).toBe(0);
    rejectAcquisition(s, { type: 'LEARN_FORMULA' });
  });
  it('records two unknown canonical weights, exact four auxiliaries and no pure water', () => {
    const s = taught(), p = projectFaceless(s);
    expect([s.cash, s.actionsRemaining]).toEqual([19640, 79]);
    expect(p.formula.map(x => [x.name, x.quantity])).toEqual([
      ['千面狩猎者脑部异变垂体', null], ['人皮幽影特性', null], ['千面狩猎者的血液', 80],
      ['黑色曼陀罗汁', 5], ['龙牙草粉末', 10], ['深海娜迦的头发', 3],
    ]);
    expect(FACELESS_FORMULA_SOURCE).toContain('第二部第238章'); expect(FACELESS_FORMULA_SOURCE).toContain('无纯水');
    expect(FACELESS_FORMULA.filter(x => x.quantity === null)).toHaveLength(2);
    expect(s.faceless.batches[0]!.materials.map(x => x.quantity)).toEqual([1, 1, 80, 5, 10, 3]);
    expect(validFacelessState(s)).toBe(true);
  });
  it('takes five actual actions per batch to offset only the 3000 main-material fee', () => {
    const s = taught(), batchId = s.faceless.batches[0]!.id;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'MATERIAL_WORK', batchId });
    expect(s.faceless.batches[0]!.materials.every(x => x.holder === 'SUPPLIER')).toBe(true);
    expect(projectFaceless(s).actions.find(x => x.id === `buy-${batchId}`)!.cost).toContain('240便士');
    rejectAcquisition(s, { type: 'MATERIAL_WORK', batchId });
    acquisition(s, { type: 'BUY_MATERIALS', batchId }); acquisition(s, { type: 'BREW', batchId });
    expect([s.cash, s.actionsRemaining]).toEqual([19320, 73]);
    expect(FACELESS_PRICES).toEqual({ formula: 360, mainMaterials: 3000, auxiliaryMaterials: 240, brewing: 80 });
    expect(projectFaceless(s).actions.find(x => x.id === 'buy-faceless-batch-2')!.cost).toContain('3240便士');
    expect(s.faceless.batches[0]!.materials.every(x => x.holder === 'CONSUMED' && x.quantity === 0)).toBe(true);
    expect(s.faceless.bottles[0]!.inputIds).toEqual(FACELESS_FORMULA.map(x => `${batchId}:${x.id}`));
    rejectAcquisition(s, { type: 'BREW', batchId }); expect(validFacelessState(s)).toBe(true);
  });
  it('does not discount partial labour and rejects forged origins, missing materials and funds without mutation', () => {
    const s = taught(), batchId = s.faceless.batches[0]!.id;
    acquisition(s, { type: 'MATERIAL_WORK', batchId }); const cash = s.cash;
    acquisition(s, { type: 'BUY_MATERIALS', batchId }); expect(cash - s.cash).toBe(3240);
    const material = s.faceless.batches[0]!.materials[0]!, source = material.source;
    material.source = 'made up'; rejectAcquisition(s, { type: 'BREW', batchId }); expect(validFacelessState(s)).toBe(false);
    material.source = source; material.quantity = 9; rejectAcquisition(s, { type: 'BREW', batchId });
    material.quantity = 1; s.cash = 79; rejectAcquisition(s, { type: 'BREW', batchId });
  });
  it('allows early preparation but requires acting100 and twelve complete magician weeks for the separate drink', () => {
    const s = magician(); s.week = 19; s.progression.acting = 0; taught(s); const bottle = brew(s);
    expect(validFacelessState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 30; s.progression.acting = 100;
    expect(projectFaceless(s).actions.find(x => x.command.type === 'CONSUME')!.reason).toContain('11/12');
    rejectAcquisition(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.progression.acting = 100; s.actionsRemaining = 0; acquisition(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect([s.progression.sequence, s.faceless.promotionWeek, s.actionsRemaining]).toEqual([6, 31, 0]);
  });
  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('checks will24 once for roll %i and keeps its %s original-bottle result', (roll, tier, mindCost, healthCost, pollution, success) => {
    const s = prepared(), old = structuredClone(s), ctx = acquisition(s, { type: 'CONSUME', bottleId: s.faceless.bottles[0]!.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('will', 24); expect(ctx.c.roll).not.toHaveBeenCalled();
    expect([s.mind, s.health, s.seer.pollution, s.spirituality, s.status]).toEqual([100 - mindCost, 100 - healthCost, pollution, 31, 'ACTIVE']);
    expect([s.cash, s.actionsRemaining]).toEqual([old.cash, old.actionsRemaining]);
    expect([s.progression.sequence, s.progression.acting, s.faceless.magicianActingAtPromotion]).toEqual(success ? [6, 0, 100] : [7, 100, null]);
    expect([s.seer.batches, s.clown, s.magician]).toEqual([old.seer.batches, old.clown, old.magician]);
    expect(s.progression.mastery).toEqual(success ? { ...old.progression.mastery, ...Object.fromEntries(FACELESS_ABILITY_IDS.map(id => [id, 0])) } : old.progression.mastery);
    for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(old.character.coreStats[key] + (success ? 1 : 0));
    expect(s.faceless.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect(validFacelessState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: s.faceless.bottles[0]!.id, confirmed: true });
  });
  it('retains exhausted batches and accepts new stock only after all three failed bottles and a real week', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i++) acquisition(s, { type: 'CONSUME', bottleId: brew(s, i).id, confirmed: true }, 80);
    const old = structuredClone([s.faceless.batches, s.faceless.bottles]);
    acquisition(s, { type: 'REQUEST_SUPPLY' }); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    s.week++; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.faceless.batches).toHaveLength(6); expect(s.faceless.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect([s.faceless.batches.slice(0, 3), s.faceless.bottles]).toEqual(old);
    expect(s.faceless.batches[3]!.materials[0]!.holder).toBe('SUPPLIER'); expect(validFacelessState(s)).toBe(true);
    rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
});

describe('Faceless bounded appearance, source evidence and real original costume', () => {
  it('rejects arbitrary NPCs, extra fields, false confirmation and impossible commands', () => {
    for (const command of [
      { type: 'CHANGE_APPEARANCE', templateId: 'KLEIN' }, { type: 'CHANGE_APPEARANCE', templateId: 'SELF' },
      { type: 'CHANGE_APPEARANCE', templateId: 'STAGE_DOUBLE', height: 100 }, { type: 'RESTORE_SELF', free: true },
      { type: 'OBSERVE', caseId: 'unknown-person' }, { type: 'PREPARE', caseId: 'stage-double', method: 'MIND_CONTROL' },
      { type: 'CONSUME', bottleId: 'faceless-batch-1:bottle', confirmed: false },
      { type: 'BORROW_OUTFIT', caseId: 'stage-double', id: 'copied-coat' }, { type: 'ENCOUNTER_FIGHT', force: true },
    ]) expect(validFacelessCommand(command)).toBe(false);
    expect(validFacelessCommand({ type: 'ENCOUNTER_TALK' })).toBe(true);
    expect(isFacelessAcquisitionCommand({ type: 'RESTORE_SELF' })).toBe(false);
    const s = promoted(); rejectActivity(s, { type: 'CHANGE_APPEARANCE', templateId: 'KLEIN' });
    rejectActivity(s, { type: 'CHANGE_APPEARANCE', templateId: 'STAGE_DOUBLE' });
  });
  it('requires current observed source and actual original outfit instead of silently changing or generating clothes', () => {
    const s = promoted(); activity(s, { type: 'OBSERVE', caseId: 'stage-double' }); activity(s, { type: 'PREPARE', caseId: 'stage-double', method: 'ABILITY' });
    rejectActivity(s, { type: 'PERFORM', caseId: 'stage-double' });
    const before = structuredClone(s.character), spirit = s.spirituality, actions = s.actionsRemaining;
    activity(s, { type: 'CHANGE_APPEARANCE', templateId: 'STAGE_DOUBLE' });
    expect([s.spirituality, s.actionsRemaining]).toEqual([spirit - 2, actions]); expect(s.character).toEqual(before);
    expect(projectFaceless(s).appearance).toMatchObject({ templateId: 'STAGE_DOUBLE', heightOffsetCm: 5, persistent: true });
    expect(projectFaceless(s).appearance.voice).toContain('亲耳听过');
    expect(s.faceless.outfit.location).toBe('WARDROBE'); rejectActivity(s, { type: 'PERFORM', caseId: 'stage-double' });
    activity(s, { type: 'BORROW_OUTFIT', caseId: 'stage-double' });
    expect(s.faceless.outfit).toMatchObject({ id: 'FC6-PROP-COAT-1', loans: 1, returns: 0, location: 'PLAYER' });
    activity(s, { type: 'PERFORM', caseId: 'stage-double' });
    expect(s.faceless.cases['stage-double']).toMatchObject({ voiceImitated: true, appearanceAtPerformance: 'STAGE_DOUBLE', outfitLoanAtPerformance: 1 });
    expect(validateFacelessPractice(s)).toBe(true); expect(validFacelessState(s)).toBe(true);
  });
  it('preserves transformation and the same coat through zero-resource CLOSE and waits for explicit return/restoration', () => {
    const s = promoted(); begin(s, 'stage-double', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'stage-double' });
    s.spirituality = 0; s.mind = 0; s.actionsRemaining = 0;
    rejectActivity(s, { type: 'RESTORE_SELF' }); rejectActivity(s, { type: 'RETURN_OUTFIT' });
    const before = structuredClone([s.character, s.faceless.appearance, s.faceless.outfit, s.progression, s.random]);
    const ctx = activity(s, { type: 'CLOSE', caseId: 'stage-double' });
    expect(facelessInside(s)).toBe(false); expect([s.character, s.faceless.appearance, s.faceless.outfit, s.progression, s.random]).toEqual(before);
    expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
    activity(s, { type: 'RETURN_OUTFIT' }); expect(s.faceless.appearance.templateId).toBe('STAGE_DOUBLE');
    s.spirituality = 1; activity(s, { type: 'RESTORE_SELF' });
    expect([s.spirituality, s.faceless.appearance.templateId, s.faceless.outfit.returns]).toEqual([0, 'SELF', 1]);
    expect(validFacelessState(s)).toBe(true);
  });
  it('can restore inside the scene but restoration neither ends the contact nor returns the original coat', () => {
    const s = promoted(); begin(s, 'stage-double', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'stage-double' });
    const spirit = s.spirituality; activity(s, { type: 'RESTORE_SELF' });
    expect([s.spirituality, facelessInside(s), s.faceless.outfit.location, s.faceless.appearance.templateId]).toEqual([spirit - 1, true, 'PLAYER', 'SELF']);
    rejectActivity(s, { type: 'REPORT', caseId: 'stage-double' }); rejectActivity(s, { type: 'CHANGE_APPEARANCE', templateId: 'STAGE_DOUBLE' });
    activity(s, { type: 'CLOSE', caseId: 'stage-double' }); rejectActivity(s, { type: 'REPORT', caseId: 'stage-double' });
    activity(s, { type: 'RETURN_OUTFIT' }); activity(s, { type: 'REPORT', caseId: 'stage-double' }); expect(validFacelessState(s)).toBe(true);
  });
  it('cancels preparation without refunding or resetting already borrowed clothes and the chosen form', () => {
    const s = promoted(); begin(s, 'stage-double', 'ABILITY'); const before = structuredClone([s.faceless.appearance, s.faceless.outfit, s.spirituality, s.actionsRemaining]);
    activity(s, { type: 'WITHDRAW', caseId: 'stage-double' });
    expect([s.faceless.appearance, s.faceless.outfit, s.spirituality, s.actionsRemaining]).toEqual(before);
    expect(s.faceless.cases['stage-double']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1 });
    expect(validFacelessState(s)).toBe(true); rejectActivity(s, { type: 'WITHDRAW', caseId: 'stage-double' });
  });
  it('keeps a failed actual role attempt, closes it, and permits an ordinary retry only in the next week', () => {
    const s = promoted(); begin(s, 'stage-double', 'ABILITY'); const mind = s.mind; activity(s, { type: 'PERFORM', caseId: 'stage-double' }, 100);
    expect(s.mind).toBe(mind - 5); expect(s.faceless.cases['stage-double']).toMatchObject({ status: 'OBSERVED', contactOpen: true, outcome: 'NONE', voiceImitated: true });
    activity(s, { type: 'CLOSE', caseId: 'stage-double' }); activity(s, { type: 'RETURN_OUTFIT' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'stage-double', method: 'ORDINARY' });
    s.week++; activity(s, { type: 'PREPARE', caseId: 'stage-double', method: 'ORDINARY' });
    rejectActivity(s, { type: 'PERFORM', caseId: 'stage-double' }); activity(s, { type: 'RESTORE_SELF' });
    activity(s, { type: 'PERFORM', caseId: 'stage-double' }); activity(s, { type: 'CLOSE', caseId: 'stage-double' }); activity(s, { type: 'REPORT', caseId: 'stage-double' });
    expect(s.faceless.cases['stage-double']).toMatchObject({ method: 'ORDINARY', voiceImitated: false, closes: 2 }); expect(validFacelessState(s)).toBe(true);
  });
  it('allows all three ordinary paths and reflection to reach100 without magic, borrowed costumes or fighting', () => {
    const s = promoted(), spirit = s.spirituality;
    for (const caseId of FACELESS_CASE_IDS) completeOrdinary(s, caseId);
    expect(s.progression.acting).toBe(75); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.faceless.outfit.loans, s.faceless.appearance.changes]).toEqual([100, spirit, 0, 0]);
    expect(s.faceless.encounter.status).toBe('AVAILABLE'); expect(validFacelessState(s)).toBe(true);
    rejectActivity(s, { type: 'REFLECT' }); rejectActivity(s, { type: 'REPORT', caseId: 'stage-double' });
  });
  it('records recognition by a familiar adult and requires a post-performance restoration for the self report', () => {
    const s = promoted(), originalCharacter = structuredClone(s.character);
    for (const caseId of ['stage-double', 'familiar-manner'] as const) {
      begin(s, caseId, 'ABILITY'); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'RETURN_OUTFIT' }); activity(s, { type: 'REPORT', caseId });
    }
    expect(projectFaceless(s).cases.find(x => x.id === 'familiar-manner')!.result).toContain('熟人仍能识破习惯');
    expect(projectFaceless(s).appearance.heightOffsetCm).toBe(-5);
    begin(s, 'remember-self', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'remember-self' }); activity(s, { type: 'CLOSE', caseId: 'remember-self' }); activity(s, { type: 'RETURN_OUTFIT' });
    rejectActivity(s, { type: 'REPORT', caseId: 'remember-self' }); activity(s, { type: 'RESTORE_SELF' }); activity(s, { type: 'REPORT', caseId: 'remember-self' }); activity(s, { type: 'REFLECT' });
    expect(s.character).toEqual(originalCharacter); expect(s.progression.acting).toBe(100); expect(s.faceless.outfit).toMatchObject({ loans: 3, returns: 3 });
    expect(validFacelessState(s)).toBe(true); expect(FACELESS_SOURCE_STATUS).toContain('不开放序列5');
  });
  it('routes encounter actions once and gives peaceful resolution no extra acting or copied property', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); completeOrdinary(s, 'stage-double');
    const before = structuredClone([s.progression, s.faceless.outfit, s.faceless.appearance]), actions = s.actionsRemaining;
    activity(s, { type: 'ENCOUNTER_TALK' });
    expect(s.actionsRemaining).toBe(actions - 1); expect(s.faceless.encounter.status).toBe('RESOLVED');
    expect([s.progression, s.faceless.outfit, s.faceless.appearance]).toEqual(before); expect(validFacelessState(s)).toBe(true);
  });
  it('requires observed template evidence even after restoration and in past voice-imitation records', () => {
    const restored = promoted();
    activity(restored, { type: 'OBSERVE', caseId: 'stage-double' });
    activity(restored, { type: 'CHANGE_APPEARANCE', templateId: 'STAGE_DOUBLE' });
    activity(restored, { type: 'RESTORE_SELF' });
    restored.faceless.cases['stage-double'] = createFacelessState().cases['stage-double'];
    expect(validFacelessState(restored)).toBe(false);
    const history = promoted();
    activity(history, { type: 'OBSERVE', caseId: 'stage-double' });
    activity(history, { type: 'OBSERVE', caseId: 'familiar-manner' });
    begin(history, 'remember-self', 'ABILITY');
    activity(history, { type: 'PERFORM', caseId: 'remember-self' });
    activity(history, { type: 'RESTORE_SELF' });
    activity(history, { type: 'CLOSE', caseId: 'remember-self' });
    activity(history, { type: 'RETURN_OUTFIT' });
    activity(history, { type: 'REPORT', caseId: 'remember-self' });
    expect(validFacelessState(history)).toBe(true);
    history.faceless.cases['familiar-manner'] = createFacelessState().cases['familiar-manner'];
    expect(validFacelessState(history)).toBe(false);
  });
  it('rejects malformed saved form sources, invented clothes, changed canonical quantities and fake reports without throwing', () => {
    const source = promoted(); begin(source, 'stage-double', 'ABILITY');
    const mutations: ((s: SliceState) => void)[] = [
      s => { (s.faceless as unknown as Record<string, unknown>).appearance = null; },
      s => { (s.faceless.appearance as unknown as Record<string, unknown>).templateId = 'KLEIN'; },
      s => { s.faceless.appearance.sourceCaseId = 'remember-self'; },
      s => { (s.faceless.outfit as unknown as Record<string, unknown>).id = 'copied-coat'; },
      s => { s.faceless.outfit.returns = 2; },
      s => { s.faceless.cases['stage-double'].observedWeek = null; },
      s => { (s.faceless.cases as unknown as Record<string, unknown>)['familiar-manner'] = null; },
      s => { s.faceless.batches[0]!.materials[0]!.quantity = 1; },
      s => { s.faceless.bottles[0]!.inputIds.reverse(); },
      s => { s.seer.completedSources.push('faceless-case:remember-self'); },
      s => { s.faceless.encounter.status = 'FIGHTING'; },
    ];
    for (const mutate of mutations) { const s = structuredClone(source); mutate(s); expect(() => validFacelessState(s)).not.toThrow(); expect(validFacelessState(s)).toBe(false); }
  });
});
