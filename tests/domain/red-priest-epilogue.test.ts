import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCheckResult } from '../../src/shared/contracts.js';
import type { RedPriestBudget } from '../../src/domain/red-priest/source.js';
import { createRedPriestEpilogue, applyRedPriestEpilogue, redPriestEpilogueBlock,
  validateRedPriestEpilogueCommand, type RedPriestEpilogueCommand, type RedPriestEpilogueState } from '../../src/domain/red-priest/epilogue.js';

// Directed, isolated domain checks only. These small explicit test budgets and
// resolved checks are not a save, natural continuation, real promotion, or proof
// of military authorization. The central kernel alone dispatches and settles
// the actual original legion. No production seed or natural outcome is edited.
const initial = (): RedPriestEpilogueState => createRedPriestEpilogue({ eventId: 'directed:aftermath-start', week: 260,
  revision: 1001, legionId: 'loen-expedition', location: 'eastern-stores', detachmentId: 'directed:actual-dispatch' });
const budget = (patch: Partial<RedPriestBudget> = {}): RedPriestBudget => ({ week: 260,
  date: { epoch: 'FIFTH_EPOCH', year: 1354, month: 6, day: 15 }, actions: 2, cash: 40,
  health: 100, mind: 100, spirituality: 120, pollution: 0, injuries: [], injuryRisk: 0,
  status: 'ACTIVE', sequence: 0, acting: 0, mastery: { 'hunter.s0.shared-standard': 0, 'hunter.s0.bounded-flame': 0 },
  coreStats: { physique: 45, perception: 45, will: 45, knowledge: 45 }, completedSources: ['RED_PRIEST_ORIGINAL_SUCCESSION'], ...patch });
const check = (kind: 'SUCCESS' | 'FAILURE' | 'GREAT_FAILURE', ability: 'will' | 'physique' = 'will'): PublicCheckResult =>
  resolveNormalCheck({ ability, baseAbility: 45, difficulty: 42, modifiers: [], roll: kind === 'SUCCESS' ? 20 : kind === 'FAILURE' ? 90 : 99 });
const act = (state: RedPriestEpilogueState, command: RedPriestEpilogueCommand, b: RedPriestBudget, result: PublicCheckResult | null = null): RedPriestEpilogueState =>
  applyRedPriestEpilogue(state, command, b, { eventId: `directed:action:${state.journal.length + 1}`, revision: 1002 + state.journal.length, check: result });
const ownCounts = (state: RedPriestEpilogueState): void => {
  expect(state.personnel).toBe(6); expect(state.killed + state.wounded).toBeLessThanOrEqual(6);
  expect(state.patients).toHaveLength(3); expect(new Set(state.patients.map(p => p.id)).size).toBe(3);
  expect(state.originLegionId).toBe('loen-expedition'); expect(state.detachmentId).toBe('directed:actual-dispatch');
};

describe('Red Priest bounded aftermath, directed domain checks only', () => {
  it('keeps exactly the original six-person detachment and three stable wounded identities', () => {
    const state = initial(); ownCounts(state);
    expect(state.patients).toEqual([1, 2, 3].map(n => ({ id: `loen-expedition:war-wounded:${n}`, status: 'SHELTERED' })));
    expect(state.returned).toBe(0); expect(state.settlementEventId).toBeNull();
    expect(validateRedPriestEpilogueCommand({ type: 'COORDINATE', personnel: 1000 })).toBe(false);
    expect(validateRedPriestEpilogueCommand({ type: 'EVACUATE', patients: ['invented'] })).toBe(false);
    expect(validateRedPriestEpilogueCommand({ type: 'CONTAIN_FIRE', success: true })).toBe(false);
    expect(validateRedPriestEpilogueCommand({ type: 'REPORT', healed: true })).toBe(false);
  });

  it('uses real action, spirituality and mind for one successful coordination, without inventing people or free mastery', () => {
    const before = initial(), b = budget(), next = act(before, { type: 'COORDINATE' }, b, check('SUCCESS'));
    expect([b.actions, b.spirituality, b.mind, b.health, b.cash]).toEqual([1, 112, 92, 100, 40]);
    expect(next.coordinated).toBe(true); expect(next.coordinationAttempted).toBe(true);
    expect(b.mastery['hunter.s0.shared-standard']).toBe(8); expect(next.fire).toBe(70);
    ownCounts(next); expect(before.coordinationAttempted).toBe(false);
    const spent = structuredClone(b), recorded = structuredClone(next);
    expect(() => act(next, { type: 'COORDINATE' }, b, check('SUCCESS'))).toThrow();
    expect(b).toEqual(spent); expect(next).toEqual(recorded);
  });

  it('bounds one successful local fire-control attempt and pays its separate real resources', () => {
    const b = budget(), next = act(initial(), { type: 'CONTAIN_FIRE' }, b, check('SUCCESS'));
    expect([b.actions, b.spirituality, b.mind, b.health, b.cash]).toEqual([1, 108, 90, 100, 40]);
    expect(next.flameAttempted).toBe(true); expect(next.flameContained).toBe(true); expect(next.fire).toBe(5);
    expect(next.routeDamage).toBe(0); expect(b.mastery['hunter.s0.bounded-flame']).toBe(8); ownCounts(next);
    const spent = structuredClone(b);
    expect(() => act(next, { type: 'CONTAIN_FIRE' }, b, check('SUCCESS'))).toThrow(); expect(b).toEqual(spent);
  });

  it('retains failed coordination and severe fire resistance as actual player wounds and original detachment casualties', () => {
    const b = budget(), failure = act(initial(), { type: 'COORDINATE' }, b, check('FAILURE'));
    expect([b.actions, b.spirituality, b.mind, b.health]).toEqual([1, 112, 87, 88]);
    expect(failure.coordinated).toBe(false); expect([failure.killed, failure.wounded, failure.fire, failure.routeDamage]).toEqual([0, 1, 70, 12]);
    expect(b.injuries.map(i => i.severity)).toEqual(['LIGHT']); expect(b.mastery['hunter.s0.shared-standard']).toBe(3);
    expect(() => act(failure, { type: 'COORDINATE' }, b, check('SUCCESS'))).toThrow(); ownCounts(failure);
    const severeBudget = budget(), severe = act(initial(), { type: 'CONTAIN_FIRE' }, severeBudget, check('GREAT_FAILURE'));
    expect([severeBudget.actions, severeBudget.spirituality, severeBudget.mind, severeBudget.health]).toEqual([1, 108, 78, 70]);
    expect([severe.killed, severe.wounded, severe.flameContained]).toEqual([1, 0, false]);
    expect(severeBudget.injuries.map(i => i.severity)).toEqual(['HEAVY']); expect(severeBudget.injuryRisk).toBe(2); ownCounts(severe);
  });

  it('can coordinate then actually evacuate the same three wounded within two remaining actions and report only once', () => {
    const b = budget(), start = initial(), ids = start.patients.map(p => p.id);
    let state = act(start, { type: 'COORDINATE' }, b, check('SUCCESS'));
    state = act(state, { type: 'EVACUATE' }, b, check('SUCCESS', 'physique'));
    expect(b.actions).toBe(0); expect(state.status).toBe('RESOLVED');
    expect(state.patients.map(p => p.id)).toEqual(ids); expect(state.patients.every(p => p.status === 'EVACUATED')).toBe(true);
    expect(start.patients.every(p => p.status === 'SHELTERED')).toBe(true); ownCounts(state);
    // No patient receives a new health value or a healing operation; evacuation
    // changes only the status of these three existing wounded identities.
    expect(state.patients.every(p => Object.keys(p).sort().join('|') === 'id|status')).toBe(true);
    const savedBudget = structuredClone(b); state = act(state, { type: 'REPORT' }, b);
    expect(state.reported).toBe(true); expect(b).toEqual(savedBudget);
    const reported = structuredClone(state);
    expect(() => act(state, { type: 'REPORT' }, b)).toThrow(); expect(state).toEqual(reported); expect(b).toEqual(savedBudget);
  });

  it('still permits ordinary zero-action withdrawal after spending both techniques and never converts it into a rescue', () => {
    const b = budget(); let state = act(initial(), { type: 'COORDINATE' }, b, check('SUCCESS'));
    state = act(state, { type: 'CONTAIN_FIRE' }, b, check('SUCCESS')); expect(b.actions).toBe(0);
    expect(redPriestEpilogueBlock(state, { type: 'EVACUATE' }, b)).not.toBeNull();
    expect(redPriestEpilogueBlock(state, { type: 'WITHDRAW' }, b)).toBeNull();
    const spent = structuredClone(b), ids = state.patients.map(p => p.id);
    state = act(state, { type: 'WITHDRAW' }, b);
    expect(state.status).toBe('WITHDRAWN'); expect(state.patients.map(p => p.id)).toEqual(ids);
    expect(state.patients.every(p => p.status === 'SHELTERED')).toBe(true); expect(b).toEqual(spent); ownCounts(state);
    expect(() => act(state, { type: 'WITHDRAW' }, b)).toThrow(); expect(b).toEqual(spent);
    state = act(state, { type: 'REPORT' }, b); expect(state.reported).toBe(true); expect(b).toEqual(spent);
  });

  it('allows actual death under severe resistance and blocks every subsequent action without resurrection or extra personnel', () => {
    const b = budget({ health: 20 }), state = act(initial(), { type: 'CONTAIN_FIRE' }, b, check('GREAT_FAILURE'));
    expect(b.status).toBe('DEAD'); expect(b.health).toBe(0); expect(state.status).toBe('WITHDRAWN');
    expect(state.killed).toBe(1); expect(state.patients.every(p => p.status === 'SHELTERED')).toBe(true); ownCounts(state);
    const deadBudget = structuredClone(b), terminal = structuredClone(state);
    for (const type of ['COORDINATE', 'CONTAIN_FIRE', 'EVACUATE', 'WITHDRAW', 'REPORT'] as const)
      expect(() => act(state, { type }, b, check('SUCCESS'))).toThrow();
    expect(b).toEqual(deadBudget); expect(state).toEqual(terminal);
  });
});
