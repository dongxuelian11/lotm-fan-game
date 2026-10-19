import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyPerfecterEpilogue, createPerfecterEpilogue, perfecterEpilogueBlock, projectPerfecterEpilogue, validatePerfecterEpilogueState, type PerfecterEpilogueCommand } from '../../src/domain/perfecter/epilogue.js';
import type { PerfecterBudget } from '../../src/domain/perfecter/source.js';
import { perfecterWorksRunner } from '../helpers/perfecter-works.js';
const check = (roll: number) => resolveNormalCheck({ ability: 'will', baseAbility: 25, difficulty: 45, modifiers: [{ source: '已测实物与有偿准备', value: 30 }], roll });
function scene() {
  const mission = perfecterWorksRunner(); mission.complete();
  const b: PerfecterBudget = { week: mission.host.week, date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 6, day: 1 }, actions: 3, cash: 100,
    health: 100, mind: 100, spirituality: 120, pollution: 0, injuries: [], injuryRisk: 0, status: 'ACTIVE', sequence: 0, acting: 0,
    mastery: { 'paragon.s0.civilization-page': 0, 'paragon.s0.finite-reconstruction': 0 }, coreStats: { physique: 25, perception: 25, will: 25, knowledge: 25 }, completedSources: [] };
  let state = createPerfecterEpilogue(mission.state.epilogueOrigin, { eventId: 'ep-start', week: b.week, revision: 900 }), revision = 901;
  const step = (type: PerfecterEpilogueCommand['type'], roll?: number) => { state = applyPerfecterEpilogue(state, { type }, b, { eventId: `ep-${revision}`, revision: revision++, check: roll === undefined ? null : check(roll) }); return state; };
  return { mission, b, get state() { return state; }, step };
}
describe('Perfecter bounded archive overflow and real original device', () => {
  it('actually contains one nonliving flow and aids the already measured original apparatus', () => {
    const r = scene(), original = structuredClone(r.mission.state.epilogueOrigin);
    expect(check(50).chance).toBe(70); r.step('OBSERVE'); r.step('CONTAIN_FLOW', 20);
    expect(r.state.page).toMatchObject({ capacity: 6, containedUnits: 6, containedFlowId: original.flow.id, status: 'CONTAINING' });
    expect(r.state.flow.looseUnits).toBe(0); expect(r.state.apparatus.id).toBe(original.apparatus.id);
    expect(perfecterEpilogueBlock(r.state, { type: 'CONTAIN_FLOW' }, r.b)).not.toBeNull();
    r.step('RECONSTRUCT_MODEL', 50);
    expect(r.state.apparatus).toMatchObject({ durability: 88, sparePartsPurchased: 1, sparePartsInstalled: 1, sparePartsDamaged: 0, supplierPartsStock: 2 });
    expect(r.state.flow).toMatchObject({ looseUnits: 0, quietedUnits: 6 }); expect(r.state.page.containedUnits).toBe(0);
    expect([r.b.cash, r.b.actions, r.b.spirituality, r.b.mind]).toEqual([86, 1, 98, 84]);
    r.step('EVACUATE'); expect(r.state.status).toBe('RESOLVED');
    expect(r.state.patients.every(p => p.status === 'EVACUATED' && p.location.endsWith(':courtyard-aid-post'))).toBe(true);
    r.step('REPORT'); expect(r.b.mastery).toEqual({ 'paragon.s0.civilization-page': 10, 'paragon.s0.finite-reconstruction': 10 });
    expect(r.mission.state.epilogueOrigin).toEqual(original);
  });
  it('retains two failed checks, real costs and damage while ordinary isolation and rescue work', () => {
    const r = scene(); r.step('OBSERVE'); r.step('CONTAIN_FLOW', 85); r.step('RECONSTRUCT_MODEL', 85);
    expect([r.b.cash, r.b.actions, r.b.health, r.b.spirituality, r.b.mind]).toEqual([86, 1, 84, 98, 78]);
    expect(r.state.apparatus).toMatchObject({ durability: 72, sparePartsDamaged: 1, supplierPartsStock: 2 });
    expect(r.b.injuries).toHaveLength(2); expect(r.state.patients[0]!.additionalInjuries).toHaveLength(2);
    r.step('ISOLATE'); expect(r.b.actions).toBe(1); r.step('EVACUATE'); expect(r.state.status).toBe('RESOLVED');
    r.step('REPORT'); expect(r.state.apparatus.durability).toBe(72); expect(r.state.patients[0]!.injury).toContain('腕伤');
    expect(r.state.patients[0]!.additionalInjuries).toHaveLength(2);
  });
  it('keeps unrescued people at their real location after zero-action withdrawal', () => {
    const r = scene(); r.step('OBSERVE'); r.step('CONTAIN_FLOW', 85); r.b.actions = 0;
    expect(perfecterEpilogueBlock(r.state, { type: 'WITHDRAW' }, r.b)).toBeNull(); r.step('WITHDRAW'); r.step('REPORT');
    expect(r.state.status).toBe('WITHDRAWN'); expect(r.state.patients.every(p => p.status === 'SHELTERED' && p.location.endsWith(':sheltered-reading-room'))).toBe(true);
    expect(r.state.flow.looseUnits).toBe(6); expect(r.state.apparatus.durability).toBe(76);
    expect(perfecterEpilogueBlock(r.state, { type: 'CONTAIN_FLOW' }, r.b)).not.toBeNull();
  });
  it('supports paid repair after withdrawal without resetting the scene or moving patients', () => {
    const r = scene(); r.step('OBSERVE'); r.step('CONTAIN_FLOW', 85); r.step('RECONSTRUCT_MODEL', 85); r.step('WITHDRAW');
    const patients = structuredClone(r.state.patients), priorInjuries = structuredClone(r.b.injuries);
    r.b.week++; r.b.actions = 3; r.b.cash += 180; // explicit unit host: a later ordinary paid work week
    const cash = r.b.cash; r.step('REPAIR_DEVICE');
    expect(r.state.status).toBe('WITHDRAWN'); expect(r.state.patients).toEqual(patients); expect(r.b.injuries).toEqual(priorInjuries);
    expect(r.b.cash).toBe(cash - 12); expect(r.state.apparatus).toMatchObject({ durability: 92, supplierPartsStock: 0, sparePartsPurchased: 3, sparePartsInstalled: 2, sparePartsDamaged: 1 });
    expect(r.state.pageAttempted && r.state.modelAttempted).toBe(true); r.step('REPORT');
    expect(r.state.reported).toBe(true); expect(perfecterEpilogueBlock(r.state, { type: 'REPAIR_DEVICE' }, r.b)).not.toBeNull();
  });
  it('returns captured information to the same archive on withdrawal and never awards an artifact', () => {
    const r = scene(); r.step('OBSERVE'); r.step('CONTAIN_FLOW', 20); r.step('WITHDRAW');
    expect(r.state.page).toMatchObject({ containedUnits: 0, status: 'RELEASED' }); expect(r.state.flow.looseUnits).toBe(6);
    expect(r.state.objectIds).toEqual(r.mission.state.epilogueOrigin.objects.map(o => o.id));
    const publicView = projectPerfecterEpilogue(r.state); expect(Object.keys(publicView).sort()).toEqual(['lines', 'nextStep', 'story']);
    expect(JSON.stringify(publicView)).not.toMatch(/seed|cursor|beforeDigest|afterDigest|modelId|containedFlowId|eventId/);
  });
  it('rejects injected spare parts and flow loss instead of quietly healing state', () => {
    const r = scene(); expect(validatePerfecterEpilogueState(r.state)).toBe(true);
    const a = structuredClone(r.state); a.apparatus.supplierPartsStock++; expect(validatePerfecterEpilogueState(a)).toBe(false);
    const b = structuredClone(r.state); b.flow.looseUnits--; expect(validatePerfecterEpilogueState(b)).toBe(false);
    const c = structuredClone(r.state); c.patients[0]!.location = 'somewhere-else'; expect(validatePerfecterEpilogueState(c)).toBe(false);
  });
});
