import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyApothecaryCommand } from '../../src/domain/apothecary/index.js';
import { APOTHECARY_ABILITY_IDS } from '../../src/domain/apothecary/types.js';
import { applyTamerCommand } from '../../src/domain/tamer/index.js';
import { TAMER_ABILITY_IDS } from '../../src/domain/tamer/types.js';
import { applyVampireCommand } from '../../src/domain/vampire/index.js';
import { VAMPIRE_ABILITY_IDS } from '../../src/domain/vampire/types.js';
import { applyPotionProfessorCommand, createPotionProfessorState, projectPotionProfessor, validatePotionProfessorCommand, validatePotionProfessorState } from '../../src/domain/potion-professor/index.js';
import { applyPotionProfessorActivity, potionProfessorActions, potionProfessorCases, potionProfessorInside, validatePotionProfessorLife } from '../../src/domain/potion-professor/life.js';
import { settlePotionProfessorEncounter } from '../../src/domain/potion-professor/encounter.js';
import { POTION_PROFESSOR_FORMULA_STATUS, POTION_PROFESSOR_PRICES, POTION_PROFESSOR_SOURCE_STATUS } from '../../src/domain/potion-professor/content.js';
import { POTION_PROFESSOR_ABILITY_IDS, POTION_PROFESSOR_CASE_IDS, type PotionProfessorAcquisitionCommand, type PotionProfessorActivityCommand, type PotionProfessorCaseId, type PotionProfessorAssistanceKind } from '../../src/domain/potion-professor/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('potionProfessor-domain', sliceDefaultCreationSelection, 'potionProfessor-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.potionProfessor = createPotionProfessorState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[POTION_PROFESSOR_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function vampire(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyApothecaryCommand(s, { type: 'DISCOVER' }, c);
  applyApothecaryCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyApothecaryCommand(s, { type: 'BUY_POTION', bottleId: s.apothecary.bottles[0]!.id }, c);
  applyApothecaryCommand(s, { type: 'CONSUME', bottleId: s.apothecary.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyTamerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyTamerCommand(s, { type: 'BUY_POTION', bottleId: s.tamer.bottles[0]!.id }, c);
  applyTamerCommand(s, { type: 'CONSUME', bottleId: s.tamer.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyVampireCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyVampireCommand(s, { type: 'BUY_POTION', bottleId: s.vampire.bottles[0]!.id }, c);
  applyVampireCommand(s, { type: 'CONSUME', bottleId: s.vampire.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS, ...VAMPIRE_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: PotionProfessorAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyPotionProfessorCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: PotionProfessorActivityCommand, roll = 1) { const ctx = context(s, roll); applyPotionProfessorActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = vampire()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const b = s.potionProfessor.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: b.id }); return b; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.potionProfessor.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyPotionProfessorCommand(s, command as PotionProfessorAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyPotionProfessorActivity(s, command as PotionProfessorActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: PotionProfessorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function brew(s: SliceState, kind: PotionProfessorAssistanceKind, roll = 1) {
  if (s.potionProfessor.laboratory.materials === 0) activity(s, { type: 'BUY_KIT' });
  return activity(s, { type: 'BREW_ASSISTANCE', kind }, roll);
}
function complete(s: SliceState, caseId: PotionProfessorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  for (const kind of caseId === 'quiet-passage' ? ['QUIET_STEP'] as const : caseId === 'separate-signals' ? ['BODY_VEIL', 'CLOTH_VEIL', 'ODOR_VEIL'] as const : []) brew(s, kind);
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId }); activity(s, { type: 'REPORT', caseId });
}
function quiet() { const s = promoted(); complete(s, 'quiet-passage'); return s; }
function signals() { const s = quiet(); complete(s, 'separate-signals'); return s; }

describe('PotionProfessor S6 finite original bottles and inherited promotion', () => {
  it('hides the future channel and creates independent original stocks', () => {
    const s = ordinary(), p = projectPotionProfessor(s), other = createPotionProfessorState();
    expect(validatePotionProfessorState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], supplies: '' });
    expect(p.story).toBeUndefined(); other.bottles[0]!.labourSteps = 5; other.laboratory.kitsBought = 1;
    expect(s.potionProfessor.bottles[0]!.labourSteps).toBe(0); expect(s.potionProfessor.laboratory.kitsBought).toBe(0);
    rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('charges 360 and one action for guidance without inventing a formula', () => {
    const s = vampire(), before = structuredClone([s.apothecary, s.tamer, s.vampire]), c = acquisition(s, { type: 'LEARN_GUIDANCE' });
    expect([s.cash, s.actionsRemaining]).toEqual([19640, 99]); expect([s.apothecary, s.tamer, s.vampire]).toEqual(before);
    expect(projectPotionProfessor(s)).toMatchObject({ guidanceKnown: true, formulaKnown: false, formula: [] });
    expect(POTION_PROFESSOR_FORMULA_STATUS).toContain('尚未核实'); expect(POTION_PROFESSOR_PRICES).toEqual({ guidance: 360, potion: 3320, labourCredit: 3000 });
    expect(c.c.check).not.toHaveBeenCalled(); rejectAcquisition(s, { type: 'LEARN_GUIDANCE' });
  });
  it('requires five actual labour actions per original bottle and still takes 320 cash', () => {
    const s = taught(), b = s.potionProfessor.bottles[0]!;
    for (let i = 0; i < 5; i++) acquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect([b.status, b.labourSteps, s.actionsRemaining]).toEqual(['SUPPLIER', 5, 94]);
    rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id }); buy(s);
    expect([s.cash, s.actionsRemaining, b.status]).toEqual([19320, 94, 'PLAYER']);
    expect(projectPotionProfessor(s).actions.find(a => a.id === 'buy-potion-professor-potion-2')!.cost).toContain('3320便士');
    rejectAcquisition(s, { type: 'BUY_POTION', bottleId: b.id }); rejectAcquisition(s, { type: 'POTION_WORK', bottleId: b.id });
    expect(validatePotionProfessorState(s)).toBe(true);
  });
  it('does not discount partial labour or transfer credit to another original', () => {
    const s = taught(); acquisition(s, { type: 'POTION_WORK', bottleId: s.potionProfessor.bottles[0]!.id });
    const cash = s.cash; buy(s); expect(cash - s.cash).toBe(3320); expect(s.potionProfessor.bottles[1]!.labourSteps).toBe(0);
    s.cash = 3319; rejectAcquisition(s, { type: 'BUY_POTION', bottleId: s.potionProfessor.bottles[1]!.id });
  });
  it('allows early preparation but checks acting100 and twelve complete S7 weeks at the separate drink', () => {
    const s = vampire(); s.week = 19; s.progression.acting = 0; taught(s); const b = buy(s);
    expect(validatePotionProfessorState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 30; s.progression.acting = 100;
    expect(projectPotionProfessor(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('11/12');
    rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.week = 31; s.progression.acting = 99; rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
    s.progression.acting = 100; acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }); expect(s.progression.sequence).toBe(6);
  });
  it.each([[1, 'GREAT_SUCCESS', 95, 100, 0, 6], [30, 'SUCCESS', 90, 100, 0, 6], [85, 'FAILURE', 80, 90, 25, 7], [100, 'GREAT_FAILURE', 60, 80, 50, 7]] as const)('records recoverable four-tier drinking roll %s', (roll, tier, mind, health, pollution, sequence) => {
    const s = prepared(), old = structuredClone(s.progression.mastery), b = s.potionProfessor.bottles[0]!;
    const ctx = acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledWith('will', 24);
    expect([b.status, b.outcome, s.mind, s.health, s.seer.pollution, s.progression.sequence, s.status]).toEqual(['CONSUMED', tier, mind, health, pollution, sequence, 'ACTIVE']);
    for (const [id, value] of Object.entries(old)) expect(s.progression.mastery[id]).toBe(value);
    if (sequence === 7) expect(s.progression.acting).toBe(100);
    expect(validatePotionProfessorState(s)).toBe(true); rejectAcquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true });
  });
  it('inherits every original Apothecary family ID, adds two zero masteries and four +1 stats without refilling spirituality', () => {
    const s = prepared(), old = structuredClone([s.apothecary, s.tamer, s.vampire]), stats = { ...s.character.coreStats };
    acquisition(s, { type: 'CONSUME', bottleId: s.potionProfessor.bottles[0]!.id, confirmed: true });
    expect([s.apothecary, s.tamer, s.vampire]).toEqual(old); expect(s.potionProfessor.vampireActingAtPromotion).toBe(100);
    expect(Object.keys(s.progression.mastery)).toEqual([...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS, ...VAMPIRE_ABILITY_IDS, ...POTION_PROFESSOR_ABILITY_IDS]);
    expect(POTION_PROFESSOR_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + 1);
    expect([s.spirituality, s.progression.acting]).toEqual([31, 0]); expect(POTION_PROFESSOR_SOURCE_STATUS).toContain('序列5');
  });
  it('keeps failed originals and waits for the next real week before delivering fresh priced stock', () => {
    const s = taught();
    for (let i = 0; i < 3; i++) { const b = buy(s, i); acquisition(s, { type: 'CONSUME', bottleId: b.id, confirmed: true }, 85); }
    const originals = structuredClone(s.potionProfessor.bottles);
    acquisition(s, { type: 'REQUEST_SUPPLY' }); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' }); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.potionProfessor.bottles.slice(0, 3)).toEqual(originals); expect(s.potionProfessor.bottles).toHaveLength(6);
    expect(s.potionProfessor.bottles[3]).toMatchObject({ id: 'potion-professor-potion-4', status: 'SUPPLIER', labourSteps: 0 });
    expect(validatePotionProfessorState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it.each([null, {}, { type: 'BREW', batchId: 'potionProfessor-batch-1' }, { type: 'CONSUME', bottleId: 'potion-professor-potion-1', confirmed: false }, { type: 'PREPARE', caseId: 'quiet-passage', method: 'MIND_CONTROL' }, { type: 'REFLECT', extra: true }, { type: 'OBSERVE', caseId: 'invented' }])('rejects malformed or invented public commands %# without mutation', command => {
    expect(validatePotionProfessorCommand(command)).toBe(false); rejectAcquisition(prepared(), command); rejectActivity(promoted(), command);
  });
  it('rejects forged bottle identity, sources, chronology and inherited mastery in saves', () => {
    const s = promoted();
    for (const change of [(t: SliceState) => { t.potionProfessor.bottles[0]!.source = 'invented'; }, (t: SliceState) => { t.potionProfessor.bottles[0]!.consumedWeek = 30; }, (t: SliceState) => { t.potionProfessor.vampireActingAtPromotion = 99; }, (t: SliceState) => { delete t.progression.mastery[APOTHECARY_ABILITY_IDS[0]]; }, (t: SliceState) => { t.potionProfessor.bottles[1]!.labourSteps = 6; }]) { const t = structuredClone(s); change(t); expect(validatePotionProfessorState(t)).toBe(false); }
  });
});


describe('PotionProfessor actual preparation and separate finite effects', () => {
  it('hides laboratory assets before promotion and permits no ordinary proxy for actual potions', () => {
    expect(potionProfessorCases(vampire())).toEqual([]);
    expect(projectPotionProfessor(vampire()).laboratory).toEqual({ summary: '', materials: '', potions: [], effects: { quietStep: false, odorVeil: false, bodyVeil: false, clothVeil: false } });
    const s = promoted(); activity(s, { type: 'OBSERVE', caseId: 'quiet-passage' });
    expect(potionProfessorActions(s).filter(x => x.command.type === 'PREPARE' && x.command.caseId === 'quiet-passage').map(x => x.command)).toEqual([{ type: 'PREPARE', caseId: 'quiet-passage', method: 'ABILITY' }]);
    rejectActivity(s, { type: 'PREPARE', caseId: 'quiet-passage', method: 'ORDINARY' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'quiet-passage', method: 'ABILITY' });
  });
  it('buys four real G portions for 100 with zero AP and cannot stockpile kits', () => {
    const s = promoted(); s.actionsRemaining = 0; s.cash = 99; rejectActivity(s, { type: 'BUY_KIT' }); s.cash = 100;
    const ctx = activity(s, { type: 'BUY_KIT' });
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
    expect(s.potionProfessor.laboratory).toMatchObject({ kitsBought: 1, kitStock: 2, materials: 4, potions: [] });
    expect(ctx.c.check).not.toHaveBeenCalled(); rejectActivity(s, { type: 'BUY_KIT' }); expect(validatePotionProfessorState(s)).toBe(true);
  });
  it.each([1, 100])('spends material and 2 spirituality on successful and failed preparation, roll %s', roll => {
    const s = promoted(), before = [s.actionsRemaining, s.spirituality, s.cash];
    const ctx = brew(s, 'BODY_VEIL', roll);
    expect(ctx.c.check).toHaveBeenCalledWith('knowledge', 12);
    expect([s.actionsRemaining, s.spirituality, s.cash]).toEqual([before[0]! - 1, before[1]! - 2, before[2]! - 100]);
    expect(s.potionProfessor.laboratory).toMatchObject({ materials: 3, brewAttempts: 1, brewFailures: roll === 1 ? 0 : 1 });
    expect(s.potionProfessor.laboratory.potions).toHaveLength(roll === 1 ? 1 : 0);
    if (roll === 1) { expect(s.potionProfessor.laboratory.potions[0]).toMatchObject({ id: 'potion-professor-assistance-1', kind: 'BODY_VEIL', status: 'PLAYER', usedWeek: null }); rejectActivity(s, { type: 'BREW_ASSISTANCE', kind: 'BODY_VEIL' }); }
    expect(validatePotionProfessorState(s)).toBe(true);
  });
  it('rejects fabricated kinds, extra fields, missing materials and insufficient spirituality without mutation', () => {
    const s = promoted(); rejectActivity(s, { type: 'BREW_ASSISTANCE', kind: 'QUIET_STEP' });
    for (const command of [{ type: 'BREW_ASSISTANCE', kind: 'SUN_WATER' }, { type: 'BUY_KIT', quantity: 2 }, { type: 'BREW_ASSISTANCE', kind: 'QUIET_STEP', free: true }]) { expect(validatePotionProfessorCommand(command)).toBe(false); rejectActivity(s, command); }
    activity(s, { type: 'BUY_KIT' }); s.spirituality = 1; rejectActivity(s, { type: 'BREW_ASSISTANCE', kind: 'QUIET_STEP' });
  });
  it('preserves failed brews and replenishes the local three-kit batch only after a real week', () => {
    const s = promoted(); s.spirituality = 80; const cash = s.cash;
    for (let kit = 0; kit < 3; kit++) { activity(s, { type: 'BUY_KIT' }); for (let i = 0; i < 4; i++) activity(s, { type: 'BREW_ASSISTANCE', kind: 'QUIET_STEP' }, 100); }
    expect(s.potionProfessor.laboratory).toMatchObject({ kitsBought: 3, kitStock: 0, restockAfterWeek: s.week, materials: 0, brewAttempts: 12, brewFailures: 12, potions: [] });
    expect(s.cash).toBe(cash - 300); rejectActivity(s, { type: 'BUY_KIT' }); expect(validatePotionProfessorState(s)).toBe(true);
    s.week += 1; const ctx = activity(s, { type: 'BUY_KIT' });
    expect(s.potionProfessor.laboratory).toMatchObject({ kitsBought: 4, kitStock: 2, restockAfterWeek: null, materials: 4, brewFailures: 12 });
    expect(ctx.c.note).toHaveBeenCalledWith('原药房下一批三包材料实际到货', expect.stringContaining('实际补进3包'));
    brew(s, 'QUIET_STEP'); expect(s.potionProfessor.laboratory.potions[0]!.id).toBe('potion-professor-assistance-1'); expect(validatePotionProfessorState(s)).toBe(true);
  });
  it('uses a real quiet original and ends its short effect with zero AP rather than refunding it', () => {
    const s = promoted(); brew(s, 'QUIET_STEP'); begin(s, 'quiet-passage'); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'quiet-passage' });
    expect(s.potionProfessor.laboratory).toMatchObject({ effects: { quietStep: true, bodyVeil: false, clothVeil: false, odorVeil: false }, potions: [{ status: 'USED', usedWeek: s.week }] });
    expect(potionProfessorInside(s)).toBe(true); expect(validatePotionProfessorState(s)).toBe(true);
    for (const command of [{ type: 'REPORT', caseId: 'quiet-passage' }, { type: 'BUY_KIT' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'BREW_ASSISTANCE', kind: 'ODOR_VEIL' }]) rejectActivity(s, command);
    const forged = structuredClone(s); forged.week += 1; expect(validatePotionProfessorLife(forged)).toBe(false);
    s.actionsRemaining = 0; s.health = 42; s.mind = 0; const bottles = structuredClone(s.potionProfessor.laboratory.potions);
    activity(s, { type: 'CLOSE', caseId: 'quiet-passage' });
    expect([s.actionsRemaining, s.health, s.mind, s.spirituality]).toEqual([0, 42, 0, spirit]);
    expect(Object.values(s.potionProfessor.laboratory.effects)).toEqual([false, false, false, false]);
    expect(s.potionProfessor.laboratory.potions).toEqual(bottles); expect(potionProfessorInside(s)).toBe(false); expect(validatePotionProfessorState(s)).toBe(true);
  });
  it('preserves a failed practice original and requires next-week paid preparation before retry', () => {
    const s = promoted(); brew(s, 'QUIET_STEP'); begin(s, 'quiet-passage'); activity(s, { type: 'PERFORM', caseId: 'quiet-passage' }, 100);
    activity(s, { type: 'CLOSE', caseId: 'quiet-passage' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'quiet-passage', method: 'ABILITY' }); rejectActivity(s, { type: 'BREW_ASSISTANCE', kind: 'QUIET_STEP' });
    expect(s.potionProfessor.laboratory.potions[0]!.status).toBe('USED'); expect(validatePotionProfessorState(s)).toBe(true);
    s.week += 1; rejectActivity(s, { type: 'PREPARE', caseId: 'quiet-passage', method: 'ABILITY' }); brew(s, 'QUIET_STEP');
    activity(s, { type: 'PREPARE', caseId: 'quiet-passage', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'quiet-passage' }); activity(s, { type: 'CLOSE', caseId: 'quiet-passage' }); activity(s, { type: 'REPORT', caseId: 'quiet-passage' });
    expect(s.potionProfessor.laboratory.potions.map(p => p.id)).toEqual(['potion-professor-assistance-1', 'potion-professor-assistance-2']); expect(validatePotionProfessorState(s)).toBe(true);
  });
  it('consumes body, clothes and odor originals separately in the exact public order', () => {
    const s = quiet(); for (const kind of ['BODY_VEIL', 'CLOTH_VEIL', 'ODOR_VEIL'] as const) brew(s, kind);
    begin(s, 'separate-signals'); const ctx = activity(s, { type: 'PERFORM', caseId: 'separate-signals' });
    const calls = vi.mocked(ctx.c.note).mock.calls;
    expect(calls.slice(0, 3).map(c => c[0])).toEqual(['第一瓶：身体透明，衣物和气味仍在', '第二瓶：另行处理普通衣物', '第三瓶：另行处理自身气味']);
    expect(calls[0]![1]).toContain('普通衣物仍可见，气味仍在');
    expect(s.potionProfessor.laboratory.potions.filter(p => p.status === 'USED')).toHaveLength(4);
    expect(s.potionProfessor.laboratory.effects).toEqual({ quietStep: false, odorVeil: true, bodyVeil: true, clothVeil: true });
    expect(validatePotionProfessorState(s)).toBe(true);
    activity(s, { type: 'CLOSE', caseId: 'separate-signals' }); activity(s, { type: 'REPORT', caseId: 'separate-signals' }); expect(validatePotionProfessorState(s)).toBe(true);
  });
  it('requires all three original bottles and consumes all three even when comparison fails', () => {
    const s = quiet(); brew(s, 'BODY_VEIL'); activity(s, { type: 'OBSERVE', caseId: 'separate-signals' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'separate-signals', method: 'ABILITY' });
    brew(s, 'CLOTH_VEIL'); brew(s, 'ODOR_VEIL'); activity(s, { type: 'PREPARE', caseId: 'separate-signals', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'separate-signals' }, 100);
    activity(s, { type: 'CLOSE', caseId: 'separate-signals' }); expect(s.potionProfessor.laboratory.potions.every(p => p.status === 'USED')).toBe(true);
    rejectActivity(s, { type: 'BREW_ASSISTANCE', kind: 'BODY_VEIL' }); rejectActivity(s, { type: 'REPORT', caseId: 'separate-signals' }); expect(validatePotionProfessorState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('teaches by %s using existing results, preserving refusal and never producing new medicines', method => {
    const s = signals(), original = structuredClone(s.potionProfessor.laboratory); begin(s, 'willing-student', method);
    activity(s, { type: 'PERFORM', caseId: 'willing-student' }, 100); activity(s, { type: 'CLOSE', caseId: 'willing-student' });
    expect(s.potionProfessor.laboratory).toEqual(original); rejectActivity(s, { type: 'REPORT', caseId: 'willing-student' }); expect(validatePotionProfessorState(s)).toBe(true);
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'willing-student', method }); activity(s, { type: 'PERFORM', caseId: 'willing-student' }); activity(s, { type: 'CLOSE', caseId: 'willing-student' }); activity(s, { type: 'REPORT', caseId: 'willing-student' });
    expect(s.potionProfessor.laboratory).toEqual(original); expect(validatePotionProfessorState(s)).toBe(true);
  });
  it('reaches peaceful 100 with three reports and reflection without combat, gifted potions or hidden handover', () => {
    const s = signals(); complete(s, 'willing-student', 'ORDINARY'); expect(s.progression.acting).toBe(75);
    activity(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[POTION_PROFESSOR_ABILITY_IDS[0]]).toBe(24);
    expect(s.potionProfessor.laboratory).toMatchObject({ kitsBought: 1, materials: 0, brewAttempts: 4, brewFailures: 0 }); expect(s.potionProfessor.laboratory.potions).toHaveLength(4);
    expect(s.combat).toBeNull(); rejectActivity(s, { type: 'REFLECT' }); expect(validatePotionProfessorState(s)).toBe(true);
  });
  it('rejects forged material balances, duplicate originals, kinds, sources, use chronology, effects and awards', () => {
    const s = signals(); complete(s, 'willing-student');
    const changes: ((t: SliceState) => void)[] = [
      t => { t.potionProfessor.laboratory.materials = 1; }, t => { t.potionProfessor.laboratory.brewAttempts = 5; }, t => { t.potionProfessor.laboratory.brewFailures = 1; },
      t => { t.potionProfessor.laboratory.potions[1]!.id = t.potionProfessor.laboratory.potions[0]!.id; }, t => { t.potionProfessor.laboratory.potions[0]!.source = 'free'; },
      t => { t.potionProfessor.laboratory.potions[0]!.usedWeek = null; }, t => { t.potionProfessor.laboratory.potions[0]!.brewedWeek -= 1; },
      t => { t.potionProfessor.laboratory.potions[1]!.kind = 'QUIET_STEP'; }, t => { t.potionProfessor.laboratory.effects.bodyVeil = true; },
      t => { t.potionProfessor.cases['separate-signals']!.method = 'ORDINARY'; }, t => { t.seer.completedSources.push('potion-professor-case:quiet-passage'); },
      t => { Object.assign(t.potionProfessor.laboratory, { endlessPotions: true }); },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(validatePotionProfessorState(t)).toBe(false); }
    expect(validatePotionProfessorState(s)).toBe(true);
  });
});
describe('PotionProfessor original courtyard encounter remains optional and physical', () => {
  it('requires one real report, an actual visit, and permits failed talk followed by a later clarification', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'quiet-passage');
    const ap = s.actionsRemaining, acting = s.progression.acting; activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect([s.actionsRemaining, s.progression.acting]).toEqual([ap - 1, acting]); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.potionProfessor.encounter.status).toBe('RESOLVED'); expect(s.combat).toBeNull();
    expect(validatePotionProfessorState(s)).toBe(true);
  });
  it('retreats through the original exit without pursuit, item transfer, rewards or injury healing', () => {
    const s = signals(), original = structuredClone(s.potionProfessor.laboratory); activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.combat?.encounterId).toBe('POTION_PROFESSOR_DISPUTE'); s.health = 43; s.mind = 62;
    const ctx = context(s); settlePotionProfessorEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect([s.health, s.mind, s.combat, s.potionProfessor.encounter.status]).toEqual([43, 62, null, 'RETREATED']);
    expect(s.potionProfessor.laboratory).toEqual(original); expect(ctx.award).not.toHaveBeenCalled(); expect(validatePotionProfessorState(s)).toBe(true);
  });
  it('awards one mastery25 only for an actual effective resolved fight and leaves acting and potions untouched', () => {
    const s = signals(), original = structuredClone(s.potionProfessor.laboratory), acting = s.progression.acting;
    activity(s, { type: 'ENCOUNTER_FIGHT' });
    s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [{ actor: 'PLAYER', label: '实际原地攻势', selfGain: 1, enemyReduction: 0 }], playerAdvantage: 1, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
    const ctx = context(s); settlePotionProfessorEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('potion-professor-dispute', 25); expect(s.progression.acting).toBe(acting); expect(s.potionProfessor.laboratory).toEqual(original);
    expect(validatePotionProfessorState(s)).toBe(true); expect(() => settlePotionProfessorEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory[0]!.moves[0]!.selfGain = 0; expect(validatePotionProfessorState(forged)).toBe(false);
  });
  it('preserves true death without revival, stolen items or an award', () => {
    const s = quiet(); activity(s, { type: 'ENCOUNTER_FIGHT' }); s.status = 'DEAD';
    const ctx = context(s); settlePotionProfessorEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.potionProfessor.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled();
  });
});
