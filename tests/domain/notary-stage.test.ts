import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyBardCommand } from '../../src/domain/bard/index.js';
import { BARD_ABILITY_IDS } from '../../src/domain/bard/types.js';
import { applyLightprayerCommand } from '../../src/domain/lightprayer/index.js';
import { LIGHTPRAYER_ABILITY_IDS } from '../../src/domain/lightprayer/types.js';
import { applySunpriestCommand } from '../../src/domain/sunpriest/index.js';
import { SUNPRIEST_ABILITY_IDS } from '../../src/domain/sunpriest/types.js';
import { applyNotaryCommand, createNotaryState, projectNotary, validateNotaryCommand, validateNotaryState } from '../../src/domain/notary/index.js';
import { applyNotaryActivity, notaryActions, notaryCases, notaryInside, validateNotaryLife } from '../../src/domain/notary/life.js';
import { settleNotaryEncounter } from '../../src/domain/notary/encounter.js';
import { NOTARY_AGREEMENT, NOTARY_FORMULA, NOTARY_FORMULA_SOURCE, NOTARY_PRICES, NOTARY_SOURCE_STATUS, NOTARY_TOOL_SOURCE } from '../../src/domain/notary/content.js';
import { NOTARY_ABILITY_IDS, NOTARY_CASE_IDS, type NotaryAcquisitionCommand, type NotaryActivityCommand, type NotaryCaseId } from '../../src/domain/notary/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('notary-domain', sliceDefaultCreationSelection, 'notary-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.notary = createNotaryState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[NOTARY_ABILITY_IDS[0]]! += amount;
  });
  return { c, award };
}
function sunpriest(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyBardCommand(s, { type: 'DISCOVER' }, c);
  applyBardCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyBardCommand(s, { type: 'BUY_POTION', bottleId: s.bard.bottles[0]!.id }, c);
  applyBardCommand(s, { type: 'CONSUME', bottleId: s.bard.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyLightprayerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyLightprayerCommand(s, { type: 'BUY_POTION', bottleId: s.lightprayer.bottles[0]!.id }, c);
  applyLightprayerCommand(s, { type: 'CONSUME', bottleId: s.lightprayer.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applySunpriestCommand(s, { type: 'LEARN_FORMULA' }, c);
  applySunpriestCommand(s, { type: 'BUY_MATERIALS', batchId: s.sunpriest.batches[0]!.id }, c);
  applySunpriestCommand(s, { type: 'BREW', batchId: s.sunpriest.batches[0]!.id }, c);
  applySunpriestCommand(s, { type: 'CONSUME', bottleId: s.sunpriest.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS, ...SUNPRIEST_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 50000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25;
  return s;
}
function acquisition(s: SliceState, command: NotaryAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyNotaryCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: NotaryActivityCommand, roll = 1) { const ctx = context(s, roll); applyNotaryActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = sunpriest()) { acquisition(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const b = s.notary.batches[index]!;
  acquisition(s, { type: 'BUY_MATERIALS', batchId: b.id }); acquisition(s, { type: 'BREW', batchId: b.id }); return s.notary.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.notary.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyNotaryCommand(s, command as NotaryAcquisitionCommand, ctx.c)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled();
}
function rejectActivity(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = context(s);
  expect(() => applyNotaryActivity(s, command as NotaryActivityCommand, ctx.c, ctx.award)).toThrow();
  expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: NotaryCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: NotaryCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method);
  if (caseId === 'signed-tool' && method === 'ABILITY') activity(s, { type: 'SIGN', caseId });
  activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  if (caseId === 'rejected-terms') {
    s.week += 1; activity(s, { type: 'PREPARE', caseId, method }); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  }
  activity(s, { type: 'REPORT', caseId });
}

describe('Notary original full formula and independent promotion', () => {
  it('hides undiscovered acquisition and independently initializes six real materials per batch', () => {
    const s = ordinary(), p = projectNotary(s);
    expect(validateNotaryState(s)).toBe(true); expect([p.discovered, p.formulaKnown, p.promoted]).toEqual([false, false, false]);
    expect([p.formula, p.actions, p.bottles, p.abilities, p.cases]).toEqual([[], [], [], [], []]); expect(p.story).toBeUndefined(); expect(p.supplies).toBe('');
    const other = createNotaryState(); other.batches[0]!.materials[0]!.quantity = 0; other.contract.signed = true;
    expect(s.notary.batches[0]!.materials[0]!.quantity).toBe(1); expect(s.notary.contract.signed).toBe(false); rejectAcquisition(s, { type: 'LEARN_FORMULA' });
  });
  it('uses the original sun mentor channel and rejects other paths or absent earlier guidance', () => {
    for (const change of [
      (s: SliceState) => { s.progression.sequence = 8; }, (s: SliceState) => { s.progression.pathwayId = 'diviner'; },
      (s: SliceState) => { s.bard.discovered = false; }, (s: SliceState) => { s.bard.guidanceKnown = false; },
      (s: SliceState) => { s.lightprayer.guidanceKnown = false; }, (s: SliceState) => { s.sunpriest.formulaKnown = false; },
    ]) { const s = sunpriest(); change(s); expect(projectNotary(s).actions).toEqual([]); rejectAcquisition(s, { type: 'LEARN_FORMULA' }); }
  });
  it('records B3ch233 six exact quantities without fabricating a canonical mixing order', () => {
    expect(NOTARY_FORMULA.map(m => [m.name, m.quantity, m.unit])).toEqual([
      ['长者之树根茎结晶', 1, '份'], ['契灵鸟尾羽', 5, '根'], ['光辉契灵树汁', 100, 'mL'], ['金边太阳花', 1, '朵'], ['白边太阳花', 1, '朵'], ['水蕨汁', 5, '滴'],
    ]);
    expect(NOTARY_FORMULA_SOURCE).toContain('第三部第233章'); expect(NOTARY_FORMULA_SOURCE).toContain('不声称材料排列就是原著投料顺序');
    expect(NOTARY_SOURCE_STATUS).toContain('第四部第35章'); expect(NOTARY_SOURCE_STATUS).toContain('第四部第205章');
    const s = sunpriest(), cash = s.cash, ap = s.actionsRemaining, previous = structuredClone([s.bard, s.lightprayer, s.sunpriest]); taught(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 360, ap - 1]); expect([s.bard, s.lightprayer, s.sunpriest]).toEqual(previous);
    expect(projectNotary(s).formula).toEqual(NOTARY_FORMULA.map(({ name, quantity, unit }) => ({ name, quantity, unit })));
  });
  it('consumes the actual six held materials into exactly one independent original bottle', () => {
    const s = taught(), cash = s.cash, ap = s.actionsRemaining, b = s.notary.batches[0]!;
    rejectAcquisition(s, { type: 'BREW', batchId: b.id }); brew(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - NOTARY_PRICES.mainMaterials - NOTARY_PRICES.auxiliaryMaterials - NOTARY_PRICES.brewing, ap - 1]);
    expect(b.materials.every(m => m.holder === 'CONSUMED' && m.quantity === 0)).toBe(true);
    expect(s.notary.bottles[0]).toEqual({ id: b.id + ':bottle', batchId: b.id, inputIds: b.materials.map(m => m.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
    expect(s.notary.batches[1]!.materials.every(m => m.holder === 'SUPPLIER')).toBe(true); expect(validateNotaryState(s)).toBe(true);
    rejectAcquisition(s, { type: 'BREW', batchId: b.id }); rejectAcquisition(s, { type: 'BUY_MATERIALS', batchId: b.id });
  });
  it('requires five actual labour actions per batch and only waives the main-material price', () => {
    const s = taught(), b = s.notary.batches[0]!, ap = s.actionsRemaining, cash = s.cash;
    for (let i = 0; i < 5; i += 1) acquisition(s, { type: 'MATERIAL_WORK', batchId: b.id });
    expect([s.actionsRemaining, s.cash, b.labourSteps]).toEqual([ap - 5, cash, 5]); expect(b.materials.every(m => m.holder === 'SUPPLIER')).toBe(true);
    rejectAcquisition(s, { type: 'MATERIAL_WORK', batchId: b.id }); acquisition(s, { type: 'BUY_MATERIALS', batchId: b.id });
    expect(s.cash).toBe(cash - 240); expect(s.notary.batches[1]!.labourSteps).toBe(0); expect(validateNotaryState(s)).toBe(true);
    rejectAcquisition(s, { type: 'MATERIAL_WORK', batchId: b.id });
  });
  it('requires prior acting100 and twelve actual elapsed weeks before independent confirmation', () => {
    const s = prepared(), cmd = { type: 'CONSUME', bottleId: s.notary.bottles[0]!.id, confirmed: true } as const;
    s.progression.acting = 99; rejectAcquisition(s, cmd); s.progression.acting = 100; s.week = 30; rejectAcquisition(s, cmd);
    s.week = 31; expect(validateNotaryCommand({ ...cmd, confirmed: false })).toBe(false); rejectAcquisition(s, { ...cmd, confirmed: false });
    acquisition(s, cmd); expect(s.notary.promotionWeek).toBe(31); rejectAcquisition(s, cmd);
  });
  it.each([[1, 'GREAT_SUCCESS', 5], [20, 'SUCCESS', 10]] as const)('inherits exact IDs and pays real success cost for roll%s', (roll, tier, mindCost) => {
    const s = prepared(), previous = structuredClone([s.bard, s.lightprayer, s.sunpriest]), mastery = { ...s.progression.mastery }, stats = { ...s.character.coreStats }, spirit = s.spirituality;
    const ctx = acquisition(s, { type: 'CONSUME', bottleId: s.notary.bottles[0]!.id, confirmed: true }, roll);
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('will', 24); expect(s.notary.bottles[0]!.outcome).toBe(tier);
    expect([s.progression.sequence, s.progression.acting, s.notary.sunpriestActingAtPromotion, s.spirituality, s.mind]).toEqual([6, 0, 100, spirit, 100 - mindCost]);
    expect(s.progression.mastery).toEqual({ ...mastery, 'sun.s6.notarization': 0, 'sun.s6.signed-contract': 0 });
    for (const key of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[key]).toBe(stats[key] + 1);
    expect([s.bard, s.lightprayer, s.sunpriest]).toEqual(previous); expect(validateNotaryState(s)).toBe(true);
  });
  it.each([[80, 'FAILURE', 20, 10, 25], [100, 'GREAT_FAILURE', 40, 20, 50]] as const)('retains recoverable failed bottle and all earlier history for roll%s', (roll, tier, mindCost, healthCost, pollution) => {
    const s = prepared(), previous = structuredClone([s.bard, s.lightprayer, s.sunpriest, s.progression]), oldPollution = s.seer.pollution;
    acquisition(s, { type: 'CONSUME', bottleId: s.notary.bottles[0]!.id, confirmed: true }, roll);
    expect(s.notary.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect([s.mind, s.health, s.seer.pollution, s.status]).toEqual([100 - mindCost, 100 - healthCost, oldPollution + pollution, 'ACTIVE']);
    expect([s.bard, s.lightprayer, s.sunpriest, s.progression]).toEqual(previous); expect(validateNotaryState(s)).toBe(true);
    rejectAcquisition(s, { type: 'CONSUME', bottleId: s.notary.bottles[0]!.id, confirmed: true });
  });
  it('resupplies only after three real failures and a following real week without restoring consumed originals', () => {
    const s = taught(); rejectAcquisition(s, { type: 'REQUEST_SUPPLY' });
    for (let i = 0; i < 3; i += 1) acquisition(s, { type: 'CONSUME', bottleId: brew(s, i).id, confirmed: true }, 80);
    const originals = structuredClone([s.notary.batches, s.notary.bottles]), ap = s.actionsRemaining;
    acquisition(s, { type: 'REQUEST_SUPPLY' }); expect(s.actionsRemaining).toBe(ap - 1); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateNotaryState(s)).toBe(true); s.week += 1; acquisition(s, { type: 'RECEIVE_SUPPLY' });
    expect([s.notary.batches.slice(0, 3), s.notary.bottles]).toEqual(originals); expect(s.notary.batches).toHaveLength(6);
    expect(s.notary.batches.slice(3).every(b => !b.acquired && !b.brewed && b.materials.every(m => m.holder === 'SUPPLIER'))).toBe(true);
    expect(s.notary.resupply).toEqual({ requestedWeek: null, deliveries: 1 }); expect(validateNotaryState(s)).toBe(true); rejectAcquisition(s, { type: 'RECEIVE_SUPPLY' });
  });
  it('rejects unknown commands, altered originals, duplicated bottles and forged promotion history', () => {
    for (const command of [{ type: 'INVENT' }, { type: 'SIGN', caseId: 'limited-light' }, { type: 'SIGN', caseId: 'signed-tool', signer: '布伦' }, { type: 'BREW', batchId: 'notary-batch-0' }, { type: 'PERFORM', caseId: 'signed-tool', signed: true }]) expect(validateNotaryCommand(command)).toBe(false);
    const s = promoted();
    for (const change of [
      (t: SliceState) => { t.notary.batches[0]!.materials[0]!.quantity = 1; }, (t: SliceState) => { t.notary.bottles.push({ ...t.notary.bottles[0]! }); },
      (t: SliceState) => { t.notary.bottles[0]!.inputIds[0] = 'foreign:material'; }, (t: SliceState) => { t.notary.sunpriestActingAtPromotion = 99; },
      (t: SliceState) => { delete t.progression.mastery[BARD_ABILITY_IDS[0]]; }, (t: SliceState) => { t.notary.batches[1]!.labourSteps = 6; },
      (t: SliceState) => { Object.assign(t.notary.contract, { signForEveryone: true }); },
    ]) { const t = structuredClone(s); change(t); expect(validateNotaryState(t)).toBe(false); }
  });
});

describe('Notary finite existing light and original refused terms', () => {
  it('exposes three original cases only after promotion and facts only after actual observation', () => {
    expect(notaryCases(sunpriest())).toEqual([]); const s = promoted();
    expect(notaryCases(s).map(r => r.id)).toEqual([...NOTARY_CASE_IDS]); expect(notaryCases(s).every(r => r.observations.length === 0)).toBe(true);
    activity(s, { type: 'OBSERVE', caseId: 'limited-light' }); expect(notaryCases(s)[0]!.observations.join(' ')).toContain('原靶');
  });
  it.each([['ABILITY', 'LIGHT_NOTARIZED', 14, 3], ['ORDINARY', 'LAMP_COMPARED', 10, 0]] as const)('uses actual %s effect, pays its cost and preserves pollution', (method, outcome, difficulty, spiritCost) => {
    const s = promoted(), spirit = s.spirituality, pollution = s.seer.pollution = 33;
    begin(s, 'limited-light', method); const ap = s.actionsRemaining, ctx = activity(s, { type: 'PERFORM', caseId: 'limited-light' });
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', difficulty);
    expect([s.spirituality, s.actionsRemaining, s.seer.pollution, s.notary.cases['limited-light'].outcome]).toEqual([spirit - spiritCost, ap - 1, pollution, outcome]);
    expect(notaryInside(s)).toBe(true); rejectActivity(s, { type: 'REPORT', caseId: 'limited-light' }); rejectActivity(s, { type: 'OBSERVE', caseId: 'signed-tool' });
    activity(s, { type: 'CLOSE', caseId: 'limited-light' }); activity(s, { type: 'REPORT', caseId: 'limited-light' });
    expect([s.progression.acting, s.progression.mastery[NOTARY_ABILITY_IDS[0]]]).toEqual([25, 8]); expect(validateNotaryState(s)).toBe(true);
    rejectActivity(s, { type: 'REPORT', caseId: 'limited-light' });
  });
  it('allows zero-action real stopping after paid failure and only retries after a real week', () => {
    const s = promoted(); begin(s, 'limited-light', 'ABILITY'); const spirit = s.spirituality, mind = s.mind;
    activity(s, { type: 'PERFORM', caseId: 'limited-light' }, 100); s.actionsRemaining = 0;
    expect([s.spirituality, s.mind, s.notary.cases['limited-light'].contactOpen]).toEqual([spirit - 3, mind - 5, true]);
    expect(notaryActions(s).find(a => a.command.type === 'CLOSE')!.enabled).toBe(true);
    activity(s, { type: 'CLOSE', caseId: 'limited-light' }); expect(s.actionsRemaining).toBe(0); s.actionsRemaining = 5;
    rejectActivity(s, { type: 'PREPARE', caseId: 'limited-light', method: 'ORDINARY' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'limited-light', method: 'ORDINARY' }); expect(validateNotaryState(s)).toBe(true);
  });
  it('cancels an unaffordable ability preparation without refund and provides ordinary comparison', () => {
    const s = promoted(); begin(s, 'limited-light', 'ABILITY'); s.spirituality = 2; const ap = s.actionsRemaining;
    rejectActivity(s, { type: 'PERFORM', caseId: 'limited-light' }); activity(s, { type: 'WITHDRAW', caseId: 'limited-light' });
    expect(s.actionsRemaining).toBe(ap); activity(s, { type: 'PREPARE', caseId: 'limited-light', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'limited-light' });
    expect(s.spirituality).toBe(2); expect(s.notary.cases['limited-light'].outcome).toBe('LAMP_COMPARED');
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('retains real first refusal for %s, charges the chosen method and never rolls or binds', method => {
    const s = promoted(); begin(s, 'rejected-terms', method); const spirit = s.spirituality, ap = s.actionsRemaining;
    const ctx = activity(s, { type: 'PERFORM', caseId: 'rejected-terms' });
    expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); expect([s.spirituality, s.actionsRemaining]).toEqual([spirit - (method === 'ABILITY' ? 3 : 0), ap - 1]);
    expect(s.notary.cases['rejected-terms']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', notes: 1, revised: false, contactOpen: true });
    expect(s.notary.contract).toEqual({ signed: false, active: false, tool: 'TABLE', fulfilled: false }); expect(validateNotaryState(s)).toBe(true);
    activity(s, { type: 'CLOSE', caseId: 'rejected-terms' }); rejectActivity(s, { type: 'PREPARE', caseId: 'rejected-terms', method });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'rejected-terms', method }); expect(s.notary.cases['rejected-terms'].revised).toBe(true);
    const retry = activity(s, { type: 'PERFORM', caseId: 'rejected-terms' }); expect(retry.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', method === 'ABILITY' ? 14 : 10);
    activity(s, { type: 'CLOSE', caseId: 'rejected-terms' }); activity(s, { type: 'REPORT', caseId: 'rejected-terms' });
    expect(notaryCases(s).find(r => r.id === 'rejected-terms')!.observations.join(' ')).toContain('明确拒绝'); expect(validateNotaryState(s)).toBe(true);
  });
  it('keeps a rejected revised attempt costly and retries the same narrow task on another actual week', () => {
    const s = promoted(); begin(s, 'rejected-terms', 'ABILITY'); activity(s, { type: 'PERFORM', caseId: 'rejected-terms' }); activity(s, { type: 'CLOSE', caseId: 'rejected-terms' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: 'rejected-terms', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'rejected-terms' }, 100);
    activity(s, { type: 'CLOSE', caseId: 'rejected-terms' }); expect(s.notary.cases['rejected-terms']).toMatchObject({ notes: 1, revised: true, status: 'OBSERVED', closes: 2 });
    rejectActivity(s, { type: 'PREPARE', caseId: 'rejected-terms', method: 'ORDINARY' }); s.week += 1;
    activity(s, { type: 'PREPARE', caseId: 'rejected-terms', method: 'ORDINARY' }); expect(validateNotaryState(s)).toBe(true);
  });
  it('can reach peaceful100 with original ordinary light, revised terms, and actual ordinary tool return', () => {
    const s = promoted(), spirit = s.spirituality; for (const id of NOTARY_CASE_IDS) complete(s, id);
    expect(s.progression.acting).toBe(75); activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.notary.encounter.status]).toEqual([100, spirit, 'AVAILABLE']);
    expect(s.notary.contract).toEqual({ signed: false, active: false, tool: 'TABLE', fulfilled: false }); expect(validateNotaryState(s)).toBe(true); rejectActivity(s, { type: 'REFLECT' });
  });
});

describe('Notary explicit own signature and actual original tool return', () => {
  it('requires observation and explicit public signature without presuming consent from preparation', () => {
    const s = promoted(); rejectActivity(s, { type: 'SIGN', caseId: 'signed-tool' }); begin(s, 'signed-tool', 'ABILITY');
    rejectActivity(s, { type: 'PERFORM', caseId: 'signed-tool' });
    const projection = notaryCases(s).find(r => r.id === 'signed-tool')!;
    expect(projection.story).toContain(NOTARY_AGREEMENT); expect(projection.observations.join(' ')).toContain('米菈在场并已明确同意'); expect(projection.observations.join(' ')).toContain('NT6-MEASURE-1');
    expect(NOTARY_TOOL_SOURCE).toContain('属于原工房');
    const ap = s.actionsRemaining, spirit = s.spirituality, ctx = activity(s, { type: 'SIGN', caseId: 'signed-tool' });
    expect(ctx.c.check).not.toHaveBeenCalled(); expect([s.actionsRemaining, s.spirituality]).toEqual([ap, spirit]);
    expect(s.notary.contract).toEqual({ signed: true, active: false, tool: 'TABLE', fulfilled: false }); expect(validateNotaryState(s)).toBe(true);
    rejectActivity(s, { type: 'SIGN', caseId: 'signed-tool' });
  });
  it('success actually loans the same original, activates only the signed finite contract, and CLOSE fulfils it', () => {
    const s = promoted(); begin(s, 'signed-tool', 'ABILITY'); activity(s, { type: 'SIGN', caseId: 'signed-tool' });
    const cash = s.cash, spirit = s.spirituality; activity(s, { type: 'PERFORM', caseId: 'signed-tool' });
    expect(s.notary.contract).toEqual({ signed: true, active: true, tool: 'PLAYER', fulfilled: false }); expect(s.spirituality).toBe(spirit - 3); expect(validateNotaryState(s)).toBe(true);
    rejectActivity(s, { type: 'WITHDRAW', caseId: 'signed-tool' }); rejectActivity(s, { type: 'REPORT', caseId: 'signed-tool' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    s.actionsRemaining = 0; s.spirituality = 0; const ctx = activity(s, { type: 'CLOSE', caseId: 'signed-tool' });
    expect(ctx.c.check).not.toHaveBeenCalled(); expect([s.actionsRemaining, s.spirituality, s.cash]).toEqual([0, 0, cash]);
    expect(s.notary.contract).toEqual({ signed: true, active: false, tool: 'TABLE', fulfilled: true }); expect(notaryInside(s)).toBe(false); expect(validateNotaryState(s)).toBe(true);
    rejectActivity(s, { type: 'CLOSE', caseId: 'signed-tool' }); s.actionsRemaining = 1; activity(s, { type: 'REPORT', caseId: 'signed-tool' }); expect(validateNotaryState(s)).toBe(true);
  });
  it('permits an unsigned ordinary paper loan and same-tool return without supernatural binding', () => {
    const s = promoted(); begin(s, 'signed-tool', 'ORDINARY'); const spirit = s.spirituality;
    rejectActivity(s, { type: 'SIGN', caseId: 'signed-tool' }); const ctx = activity(s, { type: 'PERFORM', caseId: 'signed-tool' });
    expect(ctx.c.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.notary.contract).toEqual({ signed: false, active: false, tool: 'PLAYER', fulfilled: false });
    expect(s.spirituality).toBe(spirit); activity(s, { type: 'CLOSE', caseId: 'signed-tool' });
    expect(s.notary.contract).toEqual({ signed: false, active: false, tool: 'TABLE', fulfilled: false }); expect(validateNotaryState(s)).toBe(true);
  });
  it('withdraws an unused signature without refunds, movement or background penalties before ordinary preparation', () => {
    const s = promoted(); activity(s, { type: 'OBSERVE', caseId: 'signed-tool' }); activity(s, { type: 'SIGN', caseId: 'signed-tool' });
    rejectActivity(s, { type: 'PREPARE', caseId: 'signed-tool', method: 'ORDINARY' }); const cash = s.cash, spirit = s.spirituality, ap = s.actionsRemaining;
    activity(s, { type: 'WITHDRAW', caseId: 'signed-tool' }); expect([s.cash, s.spirituality, s.actionsRemaining]).toEqual([cash, spirit, ap]);
    expect(s.notary.contract).toEqual({ signed: false, active: false, tool: 'TABLE', fulfilled: false });
    activity(s, { type: 'PREPARE', caseId: 'signed-tool', method: 'ORDINARY' }); expect(validateNotaryState(s)).toBe(true);
  });
  it('keeps failed signed performance unloaned and inactive until real close and next-week retry', () => {
    const s = promoted(); begin(s, 'signed-tool', 'ABILITY'); activity(s, { type: 'SIGN', caseId: 'signed-tool' }); const spirit = s.spirituality;
    activity(s, { type: 'PERFORM', caseId: 'signed-tool' }, 100);
    expect([s.spirituality, s.notary.cases['signed-tool'].contactOpen]).toEqual([spirit - 3, true]);
    expect(s.notary.contract).toEqual({ signed: true, active: false, tool: 'TABLE', fulfilled: false }); expect(validateNotaryState(s)).toBe(true);
    activity(s, { type: 'CLOSE', caseId: 'signed-tool' }); rejectActivity(s, { type: 'PREPARE', caseId: 'signed-tool', method: 'ABILITY' });
    activity(s, { type: 'WITHDRAW', caseId: 'signed-tool' }); s.week += 1; activity(s, { type: 'PREPARE', caseId: 'signed-tool', method: 'ABILITY' });
    expect(validateNotaryState(s)).toBe(true); rejectActivity(s, { type: 'PERFORM', caseId: 'signed-tool' });
    activity(s, { type: 'SIGN', caseId: 'signed-tool' }); activity(s, { type: 'PERFORM', caseId: 'signed-tool' }); activity(s, { type: 'CLOSE', caseId: 'signed-tool' });
    expect(s.notary.contract.fulfilled).toBe(true); expect(s.notary.cases['signed-tool'].closes).toBe(2); expect(validateNotaryState(s)).toBe(true);
  });
  it('never clears a completed signature and fulfillment when another case prepares, fails or closes', () => {
    const s = promoted(); complete(s, 'signed-tool', 'ABILITY'); const original = structuredClone(s.notary.contract);
    begin(s, 'limited-light', 'ABILITY'); activity(s, { type: 'WITHDRAW', caseId: 'limited-light' }); expect(s.notary.contract).toEqual(original);
    activity(s, { type: 'PREPARE', caseId: 'limited-light', method: 'ABILITY' }); activity(s, { type: 'PERFORM', caseId: 'limited-light' }, 100); activity(s, { type: 'CLOSE', caseId: 'limited-light' });
    expect(s.notary.contract).toEqual(original); expect(validateNotaryState(s)).toBe(true);
  });
  it('rejects forged unsigned binding, early fulfillment, missing original tool, missing contact and stale open weeks', () => {
    const s = promoted(); begin(s, 'signed-tool', 'ABILITY'); activity(s, { type: 'SIGN', caseId: 'signed-tool' }); activity(s, { type: 'PERFORM', caseId: 'signed-tool' });
    for (const change of [
      (t: SliceState) => { t.notary.contract.signed = false; }, (t: SliceState) => { t.notary.contract.active = false; },
      (t: SliceState) => { t.notary.contract.fulfilled = true; }, (t: SliceState) => { t.notary.contract.tool = 'TABLE'; },
      (t: SliceState) => { t.notary.cases['signed-tool'].contactOpen = false; }, (t: SliceState) => { t.week += 1; },
      (t: SliceState) => { t.notary.cases['signed-tool'].outcome = 'ORDINARY_LOAN'; },
    ]) { const t = structuredClone(s); change(t); expect(validateNotaryState(t)).toBe(false); }
  });
  it('rejects fabricated cases, duplicate report rewards and unearned pre-promotion signature', () => {
    const s = promoted(); complete(s, 'limited-light');
    for (const change of [
      (t: SliceState) => { t.notary.cases['limited-light'].closes = 0; }, (t: SliceState) => { t.seer.completedSources.push('notary-case:limited-light'); },
      (t: SliceState) => { t.notary.cases['limited-light'].notes = 1; }, (t: SliceState) => { t.notary.cases['rejected-terms'].revised = true; },
    ]) { const t = structuredClone(s); change(t); expect(validateNotaryLife(t)).toBe(false); }
    const early = sunpriest(); early.notary.contract.signed = true; expect(validateNotaryState(early)).toBe(false);
  });
});

function effectiveRound(s: SliceState) {
  s.combatHistory.push({ round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'PLAYER', label: '本人对原敌的实际有限攻势', selfGain: 3, enemyReduction: 0 }], playerAdvantage: 3, enemyAdvantage: 0, winChance: 60, winner: 'PLAYER', consequence: '抵抗结束', consequenceWeights: null, retreat: 'NONE' });
}
describe('Notary original empty-court dispute', () => {
  it('requires one report and one actual arrival action, permits peaceful clarification without rewards', () => {
    const s = promoted(); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' }); complete(s, 'limited-light');
    const acting = s.progression.acting, ap = s.actionsRemaining, cash = s.cash, mastery = { ...s.progression.mastery };
    const ctx = activity(s, { type: 'ENCOUNTER_TALK' });
    expect([s.notary.encounter.status, s.actionsRemaining, s.progression.acting, s.cash]).toEqual(['RESOLVED', ap - 1, acting, cash]);
    expect(s.progression.mastery).toEqual(mastery); expect(ctx.award).not.toHaveBeenCalled(); expect(validateNotaryState(s)).toBe(true);
    expect(ctx.c.note).toHaveBeenCalledWith('实际走到原外院并核对现场', expect.stringContaining('布伦')); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
  });
  it('keeps real refusal and retries peaceful talk only in the following week', () => {
    const s = promoted(); complete(s, 'limited-light'); activity(s, { type: 'ENCOUNTER_TALK' }, 100);
    expect(s.notary.encounter.status).toBe('AVAILABLE'); rejectActivity(s, { type: 'ENCOUNTER_TALK' }); expect(validateNotaryState(s)).toBe(true);
    s.week += 1; activity(s, { type: 'ENCOUNTER_TALK' }); expect(s.notary.encounter.status).toBe('RESOLVED');
  });
  it('prevents arriving with a prepared matter, open contact, held original or active contract', () => {
    const s = promoted(); complete(s, 'limited-light'); begin(s, 'signed-tool', 'ABILITY'); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    activity(s, { type: 'SIGN', caseId: 'signed-tool' }); activity(s, { type: 'PERFORM', caseId: 'signed-tool' });
    rejectActivity(s, { type: 'ENCOUNTER_TALK' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    activity(s, { type: 'CLOSE', caseId: 'signed-tool' }); activity(s, { type: 'ENCOUNTER_FIGHT' });
    expect(s.combat?.encounterId).toBe('NOTARY_DISPUTE'); expect(s.notary.contract.fulfilled).toBe(true); expect(validateNotaryState(s)).toBe(true);
  });
  it('preserves original ownership, earlier sun stages and injuries when leaving through the ordinary exit', () => {
    const s = promoted(); complete(s, 'limited-light'); const previous = structuredClone([s.bard, s.lightprayer, s.sunpriest, s.world]), cash = s.cash;
    activity(s, { type: 'ENCOUNTER_FIGHT' }); const ctx = context(s); settleNotaryEncounter(s, 'RETREATED', ctx.c, ctx.award);
    expect([s.bard, s.lightprayer, s.sunpriest, s.world]).toEqual(previous); expect([s.combat, s.cash, s.notary.encounter.status]).toEqual([null, cash, 'RETREATED']);
    expect(ctx.award).not.toHaveBeenCalled(); expect(validateNotaryState(s)).toBe(true);
  });
  it('excludes previous unrelated combat from a nominal victory', () => {
    const s = promoted(); complete(s, 'limited-light'); effectiveRound(s); activity(s, { type: 'ENCOUNTER_FIGHT' });
    const ctx = context(s); settleNotaryEncounter(s, 'ENEMY_SURRENDERED', ctx.c, ctx.award); expect(ctx.award).not.toHaveBeenCalled(); expect(validateNotaryState(s)).toBe(true);
  });
  it.each(['ENEMY_SURRENDERED', 'ENEMY_DEAD'])('awards one mastery25 only for alive effective participation: %s', outcome => {
    const s = promoted(); complete(s, 'limited-light'); activity(s, { type: 'ENCOUNTER_FIGHT' }); effectiveRound(s);
    const ctx = context(s), acting = s.progression.acting, cash = s.cash; settleNotaryEncounter(s, outcome, ctx.c, ctx.award);
    expect(ctx.award).toHaveBeenCalledExactlyOnceWith('notary-dispute', 25); expect([s.progression.acting, s.cash]).toEqual([acting, cash]); expect(validateNotaryState(s)).toBe(true);
    expect(() => settleNotaryEncounter(s, outcome, ctx.c, ctx.award)).toThrow();
    const forged = structuredClone(s); forged.combatHistory.at(-1)!.moves[0]!.selfGain = 0; expect(validateNotaryState(forged)).toBe(false);
  });
  it('preserves actual player death and awards no effective dead participant', () => {
    const s = promoted(); complete(s, 'limited-light'); activity(s, { type: 'ENCOUNTER_FIGHT' }); effectiveRound(s); s.status = 'DEAD';
    const ctx = context(s); settleNotaryEncounter(s, 'PLAYER_DEAD', ctx.c, ctx.award);
    expect([s.status, s.notary.encounter.status, s.combat]).toEqual(['DEAD', 'LOST', null]); expect(ctx.award).not.toHaveBeenCalled(); expect(validateNotaryState(s)).toBe(true);
  });
  it('rejects unknown terminal outcomes atomically and forged encounter chronology', () => {
    const s = promoted(); complete(s, 'limited-light'); activity(s, { type: 'ENCOUNTER_FIGHT' }); const ctx = context(s), before = structuredClone(s);
    expect(() => settleNotaryEncounter(s, 'INVENTED', ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before);
    for (const change of [
      (t: SliceState) => { t.week += 1; }, (t: SliceState) => { t.notary.encounter.startHistoryIndex = null; },
      (t: SliceState) => { Object.assign(t.notary.encounter, { compelledUnsigned: true }); }, (t: SliceState) => { t.notary.contract.tool = 'PLAYER'; },
    ]) { const t = structuredClone(s); change(t); expect(validateNotaryState(t)).toBe(false); }
  });
});
