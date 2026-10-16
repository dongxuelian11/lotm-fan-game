import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyAssassinCommand } from '../../src/domain/assassin/index.js';
import { ASSASSIN_ABILITY_IDS } from '../../src/domain/assassin/types.js';
import { applyInstigatorCommand } from '../../src/domain/instigator/index.js';
import { INSTIGATOR_ABILITY_IDS } from '../../src/domain/instigator/types.js';
import { applyWitchCommand } from '../../src/domain/witch/index.js';
import { WITCH_ABILITY_IDS } from '../../src/domain/witch/types.js';
import { applyPleasureCommand, createPleasureState, projectPleasure, validatePleasureCommand, validatePleasureState } from '../../src/domain/pleasure/index.js';
import { applyPleasureActivity, pleasureActions, pleasureCases, pleasureInside, validatePleasureLife } from '../../src/domain/pleasure/life.js';
import { settlePleasureEncounter } from '../../src/domain/pleasure/encounter.js';
import { PLEASURE_FORMULA, PLEASURE_FORMULA_SOURCE, PLEASURE_PRICES, PLEASURE_SOURCE_STATUS } from '../../src/domain/pleasure/content.js';
import { PLEASURE_ABILITY_IDS, PLEASURE_CASE_IDS, type PleasureAcquisitionCommand, type PleasureActivityCommand, type PleasureCaseId } from '../../src/domain/pleasure/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

// Synthetic acquisition fixtures isolate domain transitions, not a natural playthrough.
function ordinary(): SliceState {
  const s = createSliceRun('pleasure-domain', sliceDefaultCreationSelection, 'pleasure-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.pleasure = createPleasureState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[PLEASURE_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function witch(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyAssassinCommand(s, { type: 'DISCOVER' }, c);
  applyAssassinCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyAssassinCommand(s, { type: 'BUY_POTION', bottleId: s.assassin.bottles[0]!.id }, c);
  applyAssassinCommand(s, { type: 'CONSUME', bottleId: s.assassin.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyInstigatorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyInstigatorCommand(s, { type: 'BUY_POTION', bottleId: s.instigator.bottles[0]!.id }, c);
  applyInstigatorCommand(s, { type: 'CONSUME', bottleId: s.instigator.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyWitchCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyWitchCommand(s, { type: 'BUY_MATERIALS', batchId: s.witch.batches[0]!.id }, c);
  applyWitchCommand(s, { type: 'BREW', batchId: s.witch.batches[0]!.id }, c);
  applyWitchCommand(s, { type: 'CONSUME', bottleId: s.witch.bottles[0]!.id, confirmed: true, bodyChangeAccepted: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS, ...WITCH_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 50000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: PleasureAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyPleasureCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: PleasureActivityCommand, roll = 1) { const ctx = context(s, roll); applyPleasureActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = witch()) { acquisition(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const b = s.pleasure.batches[index]!;
  acquisition(s, { type: 'BUY_MATERIALS', batchId: b.id }); acquisition(s, { type: 'BREW', batchId: b.id }); return s.pleasure.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.pleasure.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyPleasureCommand(s, command as PleasureAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyPleasureActivity(s, command as PleasureActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: PleasureCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: PleasureCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method);
  if (caseId === 'fire-break') activity(s, { type: 'SPIN_SILK', caseId });
  activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  if (caseId === 'refused-invitation') {
    s.week += 1; activity(s, { type: 'PREPARE', caseId, method }); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  }
  activity(s, { type: 'REPORT', caseId });
}

describe('Pleasure original full formula and independent promotion', () => {
  it('hides undiscovered acquisition and independently initializes seven real materials per batch', () => {
    const s = ordinary(), p = projectPleasure(s);
    expect(validatePleasureState(s)).toBe(true); expect([p.discovered, p.formulaKnown, p.promoted]).toEqual([false, false, false]);
    expect([p.formula, p.actions, p.bottles, p.abilities, p.cases]).toEqual([[], [], [], [], []]); expect(p.story).toBeUndefined(); expect(p.supplies).toBe('');
    const other = createPleasureState(); other.batches[0]!.materials[0]!.quantity = 0; other.practice.wristConsent = true;
    expect(s.pleasure.batches[0]!.materials[0]!.quantity).toBe(1); expect(s.pleasure.practice.wristConsent).toBe(false); rejectAcquisition(s, { type: 'LEARN_FORMULA' });
  });
  it('uses the original independent mentor channel and rejects other paths or absent earlier guidance', () => {
    for (const change of [
      (s: SliceState) => { s.progression.sequence = 8; }, (s: SliceState) => { s.progression.pathwayId = 'diviner'; },
      (s: SliceState) => { s.assassin.discovered = false; }, (s: SliceState) => { s.assassin.guidanceKnown = false; },
      (s: SliceState) => { s.instigator.guidanceKnown = false; }, (s: SliceState) => { s.witch.formulaKnown = false; },
    ]) { const s = witch(); change(s); expect(projectPleasure(s).actions).toEqual([]); rejectAcquisition(s, { type: 'LEARN_FORMULA' }); }
  });
  it('does not reveal the full formula through a visible but untaught source story', () => {
    const s = witch(), p = projectPleasure(s); expect(p.discovered).toBe(true); expect(p.formula).toEqual([]);
    expect(p.story).not.toContain('魅欲女妖眼睛'); expect(p.story).not.toContain('木乃伊骨灰');
    taught(s); expect(projectPleasure(s).story).toContain('魅欲女妖眼睛1对');
  });
  it('records B1ch200 seven source quantities and an unweighed full hair portion', () => {
    expect(PLEASURE_FORMULA.map(m => [m.name, m.quantity, m.unit])).toEqual([
      ['魅欲女妖眼睛', 1, '对'], ['成年寡妇巨蛛丝腺', 1, '个'], ['纯水', 100, 'mL'], ['黑色曼陀罗汁', 5, '滴'],
      ['魅欲女妖残留全部毛发', null, '全部'], ['费内波特苍蝇粉', 10, 'g'], ['真正木乃伊骨灰', 5, 'g'],
    ]);
    expect(PLEASURE_FORMULA_SOURCE).toContain('第一部第200章'); expect(PLEASURE_FORMULA_SOURCE).toContain('不编造重量');
    expect(PLEASURE_SOURCE_STATUS).toContain('魅惑不是同意'); expect(PLEASURE_SOURCE_STATUS).toContain('原创G替代路线');
    const s = witch(), cash = s.cash, ap = s.actionsRemaining, previous = structuredClone([s.assassin, s.instigator, s.witch]); taught(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 360, ap - 1]); expect([s.assassin, s.instigator, s.witch]).toEqual(previous);
    expect(projectPleasure(s).formula).toHaveLength(7); expect(projectPleasure(s).formula[4]).toMatchObject({ quantity: null, unit: '全部' });
    expect(s.pleasure.batches[0]!.materials[4]).toMatchObject({ quantity: 1, unit: '份' });
  });
  it('consumes the actual seven held materials into exactly one independent original bottle', () => {
    const s = taught(), cash = s.cash, ap = s.actionsRemaining, b = s.pleasure.batches[0]!;
    rejectAcquisition(s, { type: 'BREW', batchId: b.id }); brew(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - PLEASURE_PRICES.mainMaterials - PLEASURE_PRICES.auxiliaryMaterials - PLEASURE_PRICES.brewing, ap - 1]);
    expect(b.materials.every(m => m.holder === 'CONSUMED' && m.quantity === 0)).toBe(true);
    expect(s.pleasure.bottles[0]).toEqual({ id: b.id + ':bottle', batchId: b.id, inputIds: b.materials.map(m => m.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
    expect(s.pleasure.batches[1]!.materials.every(m => m.holder === 'SUPPLIER')).toBe(true); expect(validatePleasureState(s)).toBe(true);
    rejectAcquisition(s, { type: 'BREW', batchId: b.id }); rejectAcquisition(s, { type: 'BUY_MATERIALS', batchId: b.id });
  });
  it('requires five actual labour actions per batch and only waives the main-material price', () => {
    const s = taught(), b = s.pleasure.batches[0]!, ap = s.actionsRemaining, cash = s.cash;
    for (let i = 0; i < 5; i += 1) acquisition(s, { type: 'MATERIAL_WORK', batchId: b.id });
    expect([s.actionsRemaining, s.cash, b.labourSteps]).toEqual([ap - 5, cash, 5]); expect(b.materials.every(m => m.holder === 'SUPPLIER')).toBe(true);
    rejectAcquisition(s, { type: 'MATERIAL_WORK', batchId: b.id }); acquisition(s, { type: 'BUY_MATERIALS', batchId: b.id });
    expect(s.cash).toBe(cash - 240); expect(s.pleasure.batches[1]!.labourSteps).toBe(0); expect(validatePleasureState(s)).toBe(true);
    rejectAcquisition(s, { type: 'MATERIAL_WORK', batchId: b.id });
  });
  it('requires prior acting100 and twelve actual elapsed weeks before independent confirmation', () => {
    const s = prepared(), cmd = { type: 'CONSUME', bottleId: s.pleasure.bottles[0]!.id, confirmed: true } as const;
    s.progression.acting = 99; rejectAcquisition(s, cmd); s.progression.acting = 100; s.week = 30; rejectAcquisition(s, cmd);
    s.week = 31; expect(validatePleasureCommand({ ...cmd, confirmed: false })).toBe(false); rejectAcquisition(s, { ...cmd, confirmed: false });
    acquisition(s, cmd); expect(s.pleasure.promotionWeek).toBe(31); rejectAcquisition(s, cmd);
  });
  it.each([[1, 'GREAT_SUCCESS', 5], [20, 'SUCCESS', 10]] as const)('inherits exact IDs and pays real success cost for roll%s', (roll, tier, mindCost) => {
    const s = prepared(), previous = structuredClone([s.assassin, s.instigator, s.witch]), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, spirit = s.spirituality;
    const ctx = acquisition(s, { type: 'CONSUME', bottleId: s.pleasure.bottles[0]!.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('will', 24); expect(s.pleasure.bottles[0]!.outcome).toBe(tier);
    expect([s.progression.sequence, s.progression.acting, s.pleasure.witchActingAtPromotion, s.spirituality, s.mind]).toEqual([6, 0, 100, spirit, 100 - mindCost]);
    expect(s.progression.mastery).toEqual({ ...mastery, 'assassin.s6.silk-binding': 0, 'assassin.s6.charm': 0 });
    for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(stats[key] + 1);
    expect([s.assassin, s.instigator, s.witch]).toEqual(previous); expect(validatePleasureState(s)).toBe(true);
  });
  it.each([[80, 'FAILURE', 20, 10, 25], [100, 'GREAT_FAILURE', 40, 20, 50]] as const)('retains recoverable failed bottle and all earlier history for roll%s', (roll, tier, mindCost, healthCost, pollution) => {
    const s = prepared(), previous = structuredClone([s.assassin, s.instigator, s.witch, s.progression]), oldPollution = s.seer.pollution;
    acquisition(s, { type: 'CONSUME', bottleId: s.pleasure.bottles[0]!.id, confirmed: true }, roll);
    expect(s.pleasure.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect([s.mind, s.health, s.seer.pollution, s.status]).toEqual([100 - mindCost, 100 - healthCost, oldPollution + pollution, 'ACTIVE']);
    expect([s.assassin, s.instigator, s.witch, s.progression]).toEqual(previous); expect(validatePleasureState(s)).toBe(true);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: s.pleasure.bottles[0]!.id, confirmed: true });
  });
  it('resupplies only after three real failures and a following real week without restoring consumed originals', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i += 1) acquisition(s, { type: 'CONSUME', bottleId: brew(s, i).id, confirmed: true }, 80);
    const originals = structuredClone([s.pleasure.batches, s.pleasure.bottles]), ap = s.actionsRemaining;
    acquisition(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(validatePleasureState(s)).toBe(true); s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect([s.pleasure.batches.slice(0, 3), s.pleasure.bottles]).toEqual(originals); expect(s.pleasure.batches).toHaveLength(6);
    expect(s.pleasure.batches.slice(3).every(b => !b.acquired && !b.brewed && b.materials.every(m => m.holder === 'SUPPLIER'))).toBe(true);
    expect(s.pleasure.resupply).toEqual({ requestedWeek: null, deliveries: 1 }); expect(validatePleasureState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects unknown commands, altered originals, duplicated bottles and forged promotion history', () => {
    for (const command of [{ type: 'INVENT' }, { type: 'SIGN', caseId: 'limited-light' }, { type: 'SIGN', caseId: 'signed-tool', signer: '布伦' }, { type: 'BREW', batchId: 'pleasure-batch-0' }, { type: 'PERFORM', caseId: 'signed-tool', signed: true }]) expect(validatePleasureCommand(command)).toBe(false);
    const s = promoted();
    for (const change of [
      (t: SliceState) => { t.pleasure.batches[0]!.materials[0]!.quantity = 1; }, (t: SliceState) => { t.pleasure.bottles.push({ ...t.pleasure.bottles[0]! }); },
      (t: SliceState) => { t.pleasure.bottles[0]!.inputIds[0] = 'foreign:material'; }, (t: SliceState) => { t.pleasure.witchActingAtPromotion = 99; },
      (t: SliceState) => { delete t.progression.mastery[ASSASSIN_ABILITY_IDS[0]]; }, (t: SliceState) => { t.pleasure.batches[1]!.labourSteps = 6; },
      (t: SliceState) => { Object.assign(t.pleasure.practice, { charmIsConsent: true }); },
    ]) { const t = structuredClone(s); change(t); expect(validatePleasureState(t)).toBe(false); }
  });
});


describe('Pleasure real voluntary release and refusal boundaries', () => {
  it('exposes only observed facts after promotion and preserves the existing Witch body', () => {
    const s = prepared(), oldGender = s.character.gender, previous = s.witch.previousGender;
    expect(pleasureCases(s)).toEqual([]); acquisition(s, { type: 'CONSUME', bottleId: s.pleasure.bottles[0]!.id, confirmed: true });
    expect([s.character.gender, s.witch.previousGender]).toEqual([oldGender, previous]);
    expect(pleasureCases(s).map(r => r.id)).toEqual([...PLEASURE_CASE_IDS]); expect(pleasureCases(s).every(r => r.observations.length === 0)).toBe(true);
    activity(s, { type: 'OBSERVE', caseId: 'silk-release' }); expect(s.pleasure.practice.wristConsent).toBe(true);
    expect(pleasureCases(s)[0]!.observations.join(' ')).toContain('成年人'); expect(validatePleasureState(s)).toBe(true);
  });
  it.each([['ABILITY', 'SILK', 'SILK_BOUND', 'perception', 14, 3], ['ORDINARY', 'CORD', 'CORD_TIED', 'knowledge', 10, 0]] as const)('actually applies %s restraint and zero-action release after consent', (method, wrist, outcome, stat, difficulty, spiritCost) => {
    const s = promoted(), spirit = s.spirituality, pollution = s.seer.pollution = 33; begin(s, 'silk-release', method);
    const ap = s.actionsRemaining, ctx = activity(s, { type: 'PERFORM', caseId: 'silk-release' });
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith(stat, difficulty);
    expect([s.spirituality, s.actionsRemaining, s.seer.pollution, s.pleasure.cases['silk-release'].outcome, s.pleasure.practice.wrist]).toEqual([spirit - spiritCost, ap - 1, pollution, outcome, wrist]);
    expect(pleasureInside(s)).toBe(true); expect(validatePleasureState(s)).toBe(true);
    rejectActivity(s, { type: 'REPORT', caseId: 'silk-release' }); rejectActivity(s, { type: 'OBSERVE', caseId: 'fire-break' }); rejectActivity(s, { type: 'BUY_SUPPLIES' }); rejectActivity(s, { type: 'WITHDRAW', caseId: 'silk-release' });
    s.actionsRemaining = 0; s.spirituality = 0; expect(pleasureActions(s).find(a => a.command.type === 'CLOSE')!.enabled).toBe(true);
    const closed = activity(s, { type: 'CLOSE', caseId: 'silk-release' }); expect(closed.c.check).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, s.pleasure.practice.wrist, pleasureInside(s)]).toEqual([0, 0, 'FREE', false]);
    s.actionsRemaining = 1; activity(s, { type: 'REPORT', caseId: 'silk-release' }); expect([s.progression.acting, s.progression.mastery[PLEASURE_ABILITY_IDS[0]]]).toEqual([25, 8]);
    expect(validatePleasureState(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'silk-release' });
  });
  it('keeps failure costs, no fabricated binding, free close and next-week-only retry', () => {
    const s = promoted(); begin(s, 'silk-release', 'ABILITY'); const spirit = s.spirituality, mind = s.mind;
    activity(s, { type: 'PERFORM', caseId: 'silk-release' }, 100); s.actionsRemaining = 0;
    expect([s.spirituality, s.mind, s.pleasure.practice.wrist, pleasureInside(s)]).toEqual([spirit - 3, mind - 5, 'FREE', true]);
    activity(s, { type: 'CLOSE', caseId: 'silk-release' }); expect(s.actionsRemaining).toBe(0); s.actionsRemaining = 10;
    rejectActivity(s, { type: 'PREPARE', caseId: 'silk-release', method: 'ORDINARY' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'silk-release', method: 'ORDINARY' }); expect(validatePleasureState(s)).toBe(true);
  });
  it('allows a genuinely ordinary fallback after an unaffordable prepared ability', () => {
    const s = promoted(); begin(s, 'silk-release', 'ABILITY'); s.spirituality = 2; const ap = s.actionsRemaining;
    rejectActivity(s, { type: 'PERFORM', caseId: 'silk-release' }); activity(s, { type: 'WITHDRAW', caseId: 'silk-release' }); expect(s.actionsRemaining).toBe(ap);
    activity(s, { type: 'PREPARE', caseId: 'silk-release', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'silk-release' });
    expect(s.spirituality).toBe(2); expect(s.pleasure.practice.wrist).toBe('CORD');
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('retains initial real refusal for %s, charges real costs and never rolls away consent', method => {
    const s = promoted(); begin(s, 'refused-invitation', method); const spirit = s.spirituality, ap = s.actionsRemaining;
    const ctx = activity(s, { type: 'PERFORM', caseId: 'refused-invitation' });
    expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); expect([s.spirituality, s.actionsRemaining]).toEqual([spirit - (method === 'ABILITY' ? 3 : 0), ap - 1]);
    expect(s.pleasure.cases['refused-invitation']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', notes: 1, revised: false, contactOpen: true });
    expect(s.pleasure.practice.invitationWilling).toBe(false); expect(validatePleasureState(s)).toBe(true);
    activity(s, { type: 'CLOSE', caseId: 'refused-invitation' }); rejectActivity(s, { type: 'PREPARE', caseId: 'refused-invitation', method });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'refused-invitation', method }); expect(s.pleasure.cases['refused-invitation'].revised).toBe(true);
    expect(s.pleasure.practice.invitationWilling).toBe(false);
    const retry = activity(s, { type: 'PERFORM', caseId: 'refused-invitation' }); expect(retry.c.check).toHaveBeenCalledExactlyOnceWith(method === 'ABILITY' ? 'will' : 'knowledge', method === 'ABILITY' ? 14 : 10);
    expect(s.pleasure.practice.invitationWilling).toBe(true); expect(retry.c.note).toHaveBeenCalledWith('先听到本人真正愿意', expect.stringContaining('发生在任何本次魅惑表现之前'));
    activity(s, { type: 'CLOSE', caseId: 'refused-invitation' }); activity(s, { type: 'REPORT', caseId: 'refused-invitation' });
    expect(pleasureCases(s)[1]!.observations.join(' ')).toContain('明确拒绝'); expect(validatePleasureState(s)).toBe(true);
  });
  it('retains genuine willingness even when the later skill comparison fails', () => {
    const s = promoted(); begin(s, 'refused-invitation', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'refused-invitation' }); activity(s, { type: 'CLOSE', caseId: 'refused-invitation' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'refused-invitation', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'refused-invitation' }, 100);
    expect(s.pleasure.practice.invitationWilling).toBe(true); expect(s.pleasure.cases['refused-invitation'].outcome).toBe('NONE');
    activity(s, { type: 'CLOSE', caseId: 'refused-invitation' }); rejectActivity(s, { type: 'PREPARE', caseId: 'refused-invitation', method: 'ORDINARY' });
    expect(validatePleasureState(s)).toBe(true);
  });
  it('reaches peaceful100 through three finite reports and reflection with no required intimacy', () => {
    const s = promoted(), spirit = s.spirituality; for (const id of PLEASURE_CASE_IDS) complete(s, id);
    expect(s.progression.acting).toBe(75); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.pleasure.encounter.status]).toEqual([100, spirit - 3, 'AVAILABLE']);
    expect(projectPleasure(s).environment).toContain('不宣称完成原著完整亲密扮演'); expect(validatePleasureState(s)).toBe(true); rejectActivity(s, { type: 'REFLECT' });
  });
  it('keeps inherited real supply and original mirror preparation usable at sequence6', () => {
    const s = promoted(), cash = s.cash, ap = s.actionsRemaining;
    activity(s, { type: 'BUY_SUPPLIES' }); expect([s.cash, s.actionsRemaining, s.witch.tools.powderHeld, s.witch.tools.mirrorsHeld]).toEqual([cash - 60, ap - 1, 3, 1]);
    rejectActivity(s, { type: 'BUY_SUPPLIES' }); s.actionsRemaining = 0; s.spirituality = 0;
    activity(s, { type: 'PREPARE_MIRROR' }); expect([s.actionsRemaining, s.spirituality, s.witch.tools.mirrorPrepared, s.witch.tools.mirrorsHeld]).toEqual([0, 0, true, 1]);
    expect(validatePleasureState(s)).toBe(true); rejectActivity(s, { type: 'PREPARE_MIRROR' });
  });
});

describe('Pleasure real frame silk and separately performed spiritual flame', () => {
  it.each(['ABILITY', 'ORDINARY'] as const)('requires actual silk before %s break and separately pays both acts', method => {
    const s = promoted(); begin(s, 'fire-break', method); const spirit = s.spirituality, ap = s.actionsRemaining;
    rejectActivity(s, { type: 'PERFORM', caseId: 'fire-break' }); activity(s, { type: 'SPIN_SILK', caseId: 'fire-break' });
    expect([s.spirituality, s.actionsRemaining, s.pleasure.practice.fireSilk, pleasureInside(s)]).toEqual([spirit - 3, ap - 1, 'ON_FRAME', false]);
    expect(s.pleasure.practice.fireBreak).toBe('NONE'); expect(validatePleasureState(s)).toBe(true); rejectActivity(s, { type: 'SPIN_SILK', caseId: 'fire-break' });
    const ctx = activity(s, { type: 'PERFORM', caseId: 'fire-break' }); expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', method === 'ABILITY' ? 14 : 10);
    expect([s.spirituality, s.actionsRemaining, s.pleasure.practice.fireSilk, s.pleasure.practice.fireBreak]).toEqual([spirit - 3 - (method === 'ABILITY' ? 3 : 0), ap - 2, 'BROKEN', method === 'ABILITY' ? 'BLACK_FLAME' : 'SCISSORS']);
    expect(validatePleasureState(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'fire-break' }); s.actionsRemaining = 0; s.spirituality = 0;
    activity(s, { type: 'CLOSE', caseId: 'fire-break' }); expect([s.pleasure.practice.fireSilk, s.actionsRemaining, s.spirituality]).toEqual(['CLEARED', 0, 0]);
    s.actionsRemaining = 1; activity(s, { type: 'REPORT', caseId: 'fire-break' }); expect(validatePleasureState(s)).toBe(true);
  });
  it('requires real payment before creating silk and permits zero-action actual cancellation afterward', () => {
    const s = promoted(); begin(s, 'fire-break', 'ABILITY'); s.spirituality = 2; rejectActivity(s, { type: 'SPIN_SILK', caseId: 'fire-break' });
    s.spirituality = 3; activity(s, { type: 'SPIN_SILK', caseId: 'fire-break' }); rejectActivity(s, { type: 'PERFORM', caseId: 'fire-break' });
    s.actionsRemaining = 0; activity(s, { type: 'WITHDRAW', caseId: 'fire-break' });
    expect([s.spirituality, s.actionsRemaining, s.pleasure.practice.fireSilk, s.pleasure.practice.fireBreak]).toEqual([0, 0, 'CLEARED', 'NONE']);
    expect(validatePleasureState(s)).toBe(true);
  });
  it('keeps unbroken silk on paid failure until zero-action ordinary cleanup, then needs new real silk next week', () => {
    const s = promoted(); begin(s, 'fire-break', 'ABILITY'); activity(s, { type: 'SPIN_SILK', caseId: 'fire-break' }); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'fire-break' }, 100);
    expect([s.spirituality, s.pleasure.practice.fireSilk, s.pleasure.practice.fireBreak]).toEqual([spirit - 3, 'ON_FRAME', 'NONE']); expect(validatePleasureState(s)).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; activity(s, { type: 'CLOSE', caseId: 'fire-break' }); expect(s.pleasure.practice.fireSilk).toBe('CLEARED');
    s.actionsRemaining = 10; rejectActivity(s, { type: 'PREPARE', caseId: 'fire-break', method: 'ORDINARY' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'fire-break', method: 'ORDINARY' }); rejectActivity(s, { type: 'PERFORM', caseId: 'fire-break' });
    s.spirituality = 3; activity(s, { type: 'SPIN_SILK', caseId: 'fire-break' }); activity(s, { type: 'PERFORM', caseId: 'fire-break' }); activity(s, { type: 'CLOSE', caseId: 'fire-break' });
    expect(s.pleasure.practice.fireBreak).toBe('SCISSORS'); expect(validatePleasureState(s)).toBe(true);
  });
  it('rejects fabricated consent, absent actual silk, stale open contact and duplicated report rewards', () => {
    const wrist = promoted(); begin(wrist, 'silk-release', 'ABILITY'); activity(wrist, { type: 'PERFORM', caseId: 'silk-release' });
    for (const change of [(t: SliceState) => { t.pleasure.practice.wristConsent = false; }, (t: SliceState) => { t.pleasure.practice.wrist = 'FREE'; }, (t: SliceState) => { t.week += 1; }, (t: SliceState) => { t.pleasure.cases['silk-release'].contactOpen = false; }]) {
      const s = structuredClone(wrist); change(s); expect(validatePleasureState(s)).toBe(false);
    }
    const fire = promoted(); begin(fire, 'fire-break', 'ABILITY'); activity(fire, { type: 'SPIN_SILK', caseId: 'fire-break' }); activity(fire, { type: 'PERFORM', caseId: 'fire-break' });
    for (const change of [(t: SliceState) => { t.pleasure.practice.fireSilk = 'NONE'; }, (t: SliceState) => { t.pleasure.practice.fireBreak = 'SCISSORS'; }, (t: SliceState) => { t.pleasure.practice.invitationWilling = true; }]) {
      const s = structuredClone(fire); change(s); expect(validatePleasureState(s)).toBe(false);
    }
    activity(fire, { type: 'CLOSE', caseId: 'fire-break' }); activity(fire, { type: 'REPORT', caseId: 'fire-break' });
    fire.seer.completedSources.push('pleasure-case:fire-break'); expect(validatePleasureLife(fire)).toBe(false);
  });
});

function effectiveRound(s: SliceState) {
  s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'PLAYER', label: '本人对原敌的实际有限攻势', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
}
describe('Pleasure original empty-court dispute', () => {
  it('requires one report and one actual arrival action, permits peaceful clarification without rewards', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'silk-release');
    const acting = s.progression.acting, ap = s.actionsRemaining, cash = s.cash, mastery = { ...s.progression.mastery };
    const ctx = activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.pleasure.encounter.status, s.actionsRemaining, s.progression.acting, s.cash]).toEqual(['RESOLVED', ap - 1, acting, cash]);
    expect(s.progression.mastery).toEqual(mastery); expect(ctx.award).not.toHaveBeenCalled(); expect(validatePleasureState(s)).toBe(true);
    expect(ctx.c.note).toHaveBeenCalledWith('实际走到原外院并核对现场', expect.stringContaining('马伦')); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
  });
  it('keeps real refusal and retries peaceful talk only in the following week', () => {
    const s = promoted(); complete(s, 'silk-release'); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.pleasure.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); expect(validatePleasureState(s)).toBe(true);
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.pleasure.encounter.status).toBe('RESOLVED');
  });
  it('prevents arriving while practice is prepared, wrist bound, or actual frame silk remains', () => {
    const s = promoted(); complete(s, 'silk-release'); begin(s, 'fire-break', 'ABILITY'); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    activity(s, { type: 'SPIN_SILK', caseId: 'fire-break' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    activity(s, { type: 'PERFORM', caseId: 'fire-break' }); rejectActivity(s, { type: 'ENCOUNTER_TALK' });
    activity(s, { type: 'CLOSE', caseId: 'fire-break' }); activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.combat?.encounterId).toBe('PLEASURE_DISPUTE'); expect(s.pleasure.practice.fireSilk).toBe('CLEARED'); expect(validatePleasureState(s)).toBe(true);
  });
  it('preserves original ownership, earlier demoness stages and injuries when leaving through the ordinary exit', () => {
    const s = promoted(); complete(s, 'silk-release'); const previous = structuredClone([s.assassin, s.instigator, s.witch, s.world]), cash = s.cash;
    activity(s, { type: 'ENCOUNTER_FIGHT' }); const ctx = context(s); s.pleasure.encounter.silkPrepared = true; s.pleasure.encounter.boundRound = 1; s.health = 70; settlePleasureEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect([s.pleasure.encounter.silkPrepared, s.pleasure.encounter.boundRound, s.health]).toEqual([false, null, 70]);
    expect([s.assassin, s.instigator, s.witch, s.world]).toEqual(previous); expect([s.combat, s.cash, s.pleasure.encounter.status]).toEqual([null, cash, 'RETREATED']);
    expect(ctx.award).not.toHaveBeenCalled(); expect(validatePleasureState(s)).toBe(true);
  });
  it('excludes previous unrelated combat from a nominal victory', () => {
    const s = promoted(); complete(s, 'silk-release'); effectiveRound(s); activity(s, { type: 'ENCOUNTER_FIGHT' });
    const ctx = context(s); settlePleasureEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award); expect(ctx.award).not.toHaveBeenCalled(); expect(validatePleasureState(s)).toBe(true);
  });
  it.each(['ENEMY_SURRENDERED', 'ENEMY_DEAD'])('awards one mastery25 only for alive effective participation: %s', outcome => {
    const s = promoted(); complete(s, 'silk-release'); activity(s, { type: 'ENCOUNTER_FIGHT' }); effectiveRound(s);
    const ctx = context(s), acting = s.progression.acting, cash = s.cash; settlePleasureEncounter(s, outcome, ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('pleasure-dispute', 25); expect([s.progression.acting, s.cash]).toEqual([acting, cash]); expect(validatePleasureState(s)).toBe(true);
    expect(() => settlePleasureEncounter(s, outcome, ctx.c, ctx.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory.at(-1)!.moves[0]!.selfGain = 0; expect(validatePleasureState(forged)).toBe(false);
  });
  it('preserves actual player death and awards no effective dead participant', () => {
    const s = promoted(); complete(s, 'silk-release'); activity(s, { type: 'ENCOUNTER_FIGHT' }); effectiveRound(s); s.status = 'DEAD';
    const ctx = context(s); settlePleasureEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.pleasure.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled(); expect(validatePleasureState(s)).toBe(true);
  });
  it('rejects unknown terminal outcomes atomically and forged encounter chronology', () => {
    const s = promoted(); complete(s, 'silk-release'); activity(s, { type: 'ENCOUNTER_FIGHT' }); const ctx = context(s), before = structuredClone(s);
    expect(() => settlePleasureEncounter(s, 'INVENTED', ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before);
    for (const change of [
      (t: SliceState) => { t.week += 1; }, (t: SliceState) => { t.pleasure.encounter.startHistoryIndex = null; },
      (t: SliceState) => { Object.assign(t.pleasure.encounter, { compelledConsent: true }); }, (t: SliceState) => { t.pleasure.practice.wrist = 'SILK'; },
    ]) { const t = structuredClone(s); change(t); expect(validatePleasureState(t)).toBe(false); }
  });
});
