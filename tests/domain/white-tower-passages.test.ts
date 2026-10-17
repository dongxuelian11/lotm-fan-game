import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { WhiteTowerHost } from '../../src/domain/white-tower/ports.js';
import {
  WHITE_TOWER_PASSAGES, applyWhiteTowerPassages, canLeaveWhiteTowerPassages, createWhiteTowerPassages,
  getWhiteTowerPassageActions, projectWhiteTowerPassages, validateWhiteTowerPassageCommand,
  whiteTowerPassageVerifiedReceipts, whiteTowerPassagesBlock, whiteTowerPassagesComplete,
  type WhiteTowerPassageCommand, type WhiteTowerPassageId,
} from '../../src/domain/white-tower/passages.js';

/** Directed component inputs, not a natural campaign or an admitted save.
 * Paid materials, consent, injuries, physical crossings and reviews are all
 * produced by the actual reducer. This fixture supplies explicit host budgets,
 * location changes, week boundaries and controlled rolls. Parent owns execution. */
function scene() {
  const h: WhiteTowerHost = { eventId: 'passage-1', revision: 1, week: 200,
    date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 5, day: 1 }, actorId: 'same-actor', sourceDigest: 'component-source',
    location: 'WT0-MARKET', nowSecond: 36000, weekAnchor: 0, sequence: 1, status: 'ACTIVE',
    cash: 500, actions: 50, health: 100, mind: 100, spirituality: 120, check: null,
    passageReceipts: [], legacyAccess: null, succession: null };
  let state = createWhiteTowerPassages('passage-component', h.actorId, h.week, h.nowSecond);
  const step = (type: WhiteTowerPassageCommand['type'], passageId: WhiteTowerPassageId = 'market-steps', roll = 20) => {
    h.check = type === 'BUILD' ? resolveNormalCheck({ ability: 'knowledge', baseAbility: 31, difficulty: 44, modifiers: [{ source: 'directed ordinary preparation', value: 30 }], roll }) : null;
    const before = structuredClone(state), result = applyWhiteTowerPassages(state, { type, passageId }, h);
    expect(state).toEqual(before); expect(result.effect.cashGain).toBe(0);
    expect(result.effect.health).toBeGreaterThanOrEqual(0); expect(result.effect.spirituality).toBe(0); expect(result.effect.mind).toBe(0);
    state = result.state; h.cash -= result.effect.cashCost; h.actions -= result.effect.actions; h.health -= result.effect.health;
    h.nowSecond += result.effect.seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; }
    if (h.health <= 0) h.status = 'DEAD';
    h.revision++; h.eventId = `passage-${h.revision}`; h.check = null;
    return result;
  };
  const prepare = (id: WhiteTowerPassageId = 'market-steps', roll = 20) => {
    h.location = WHITE_TOWER_PASSAGES.find(p => p.id === id)!.location; // Explicit local host fixture.
    step('SURVEY', id); step('ASK_PERMISSION', id); step('BUY_MATERIALS', id); step('BUILD', id, roll);
  };
  const cross = (id: WhiteTowerPassageId = 'market-steps') => { step('ACCEPT_WORK', id); step('RETURN_ON_FOOT', id); step('PASS_RESIDENT', id); step('RETURN_ON_FOOT', id); };
  const nextWeek = () => { h.nowSecond = h.weekAnchor + 604800; h.weekAnchor += 604800; h.week++; };
  const block = (type: WhiteTowerPassageCommand['type'], passageId: WhiteTowerPassageId = 'market-steps') => whiteTowerPassagesBlock(state, { type, passageId }, h);
  return { h, step, prepare, cross, nextWeek, block, get state() { return state; } };
}

describe('White Tower three finite ordinary passages', () => {
  it('starts with three distinct original adults, independent ownership and no blanket permission or free tools', () => {
    const r = scene();
    expect(r.state.routes.map(p => [p.id, p.resident.id, p.resident.age, p.resident.position, p.resident.consent])).toEqual([
      ['market-steps', 'WT0-IVA', 34, 0, 'UNASKED'], ['canal-gallery', 'WT0-LEON', 46, 0, 'UNASKED'], ['apartment-alley', 'WT0-MINA', 29, 0, 'UNASKED'],
    ]);
    expect(new Set(r.state.routes.map(p => p.apparatus.id)).size).toBe(3);
    expect(r.state.routes.every(p => p.apparatus.ownerId === p.resident.id && p.materials.tool.holder === 'SUPPLIER')).toBe(true);
    expect(whiteTowerPassageVerifiedReceipts(r.state)).toEqual([]);
    expect(whiteTowerPassagesComplete(r.state)).toBe(false);
    expect(r.block('PASS_RESIDENT')).not.toBeNull();
    expect(r.block('SURVEY', 'canal-gallery')).not.toBeNull();
  });

  it('rejects public consent, check, inventory, position, time and certificate injection', () => {
    const command = { type: 'SURVEY', passageId: 'market-steps' } as const;
    expect(validateWhiteTowerPassageCommand(command)).toBe(true);
    for (const extra of [{ consent: 'ACCEPT' }, { roll: 1 }, { success: true }, { position: 24 }, { week: 999 }, { materialCount: 10 }, { verified: true }]) expect(validateWhiteTowerPassageCommand({ ...command, ...extra })).toBe(false);
    expect(validateWhiteTowerPassageCommand({ type: 'REPORT', passageId: 'market-steps' })).toBe(false);
    expect(validateWhiteTowerPassageCommand({ type: 'SURVEY', passageId: 'unbounded-city' })).toBe(false);
  });

  it('spends original materials, independently accepts work and moves the same person only by a real crossing', () => {
    const r = scene(); const initialCash = r.h.cash;
    r.prepare(); const route = () => r.state.routes[0]!;
    expect(initialCash - r.h.cash).toBe(42);
    expect(route()).toMatchObject({ playerPosition: 8, resident: { position: 0 }, apparatus: { loaded: true, fixed: false } });
    expect(route().materials).toMatchObject({ stock: 0, boughtEventId: expect.any(String), consumedEventId: expect.any(String), tool: { holder: 'SITE', condition: 95 } });
    expect(canLeaveWhiteTowerPassages(r.state, 'WT0-MARKET')).toBe(false);
    expect(r.block('PASS_RESIDENT')).not.toBeNull();
    r.step('ACCEPT_WORK'); expect(route().resident.position).toBe(0); expect(route().passage).toBeNull();
    r.step('RETURN_ON_FOOT'); const crossing = r.step('PASS_RESIDENT');
    expect(crossing.effect).toMatchObject({ actions: 0, cashCost: 0, seconds: 48 });
    expect(route()).toMatchObject({ playerPosition: 24, resident: { id: 'WT0-IVA', position: 24 }, passage: { walkedMeters: 24, from: 0, to: 24, week: 200 } });
    expect(r.state.routes.slice(1).every(p => p.resident.position === 0 && p.resident.consent === 'UNASKED')).toBe(true);
    const resident = structuredClone(route().resident); r.step('RETURN_ON_FOOT'); expect(route().resident).toEqual(resident);
    expect(whiteTowerPassageVerifiedReceipts(r.state)).toEqual([]);
    expect(r.block('BUY_MATERIALS')).not.toBeNull(); expect(r.block('BUILD')).not.toBeNull();
  });

  it('records a failed build, actual injury and withdrawn permission, then allows free safe retreat and one paid ordinary repair', () => {
    const r = scene(); r.prepare('market-steps', 90);
    const route = () => r.state.routes[0]!;
    expect(route().construction).toMatchObject({ passed: false, repairedEventId: null });
    expect(route().resident).toMatchObject({ position: 0, consent: 'WITHDRAWN' });
    expect(r.h.health).toBe(96); expect(r.state.playerInjuries).toHaveLength(1);
    const consumed = route().materials.consumedEventId;
    r.h.actions = 0; r.h.cash = 0; const exit = r.step('RETURN_ON_FOOT');
    expect(exit.effect).toMatchObject({ actions: 0, cashCost: 0, seconds: 76 });
    expect(route()).toMatchObject({ playerPosition: 0, resident: { position: 0, consent: 'WITHDRAWN' }, apparatus: { loaded: false }, materials: { tool: { holder: 'PLAYER' } } });
    expect(canLeaveWhiteTowerPassages(r.state, 'WT0-MARKET')).toBe(true);
    expect(r.block('BUILD')).not.toBeNull(); expect(r.block('PASS_RESIDENT')).not.toBeNull();
    r.h.cash = 18; r.h.actions = 1; // Explicit component repair budget, not an earned campaign wage.
    r.step('ASK_PERMISSION'); r.step('BUY_REPAIR'); const repaired = r.step('REPAIR');
    expect(repaired.injuries).toEqual([]); expect(repaired.effect).toMatchObject({ actions: 1, cashCost: 0 });
    expect(route().materials.consumedEventId).toBe(consumed); expect(route().materials.repair.consumedEventId).not.toBeNull();
    expect(route().construction).toMatchObject({ passed: false, repairedEventId: expect.any(String), check: { roll: 90 } });
    r.cross(); expect(r.h.cash).toBe(0); expect(r.h.actions).toBe(0); expect(r.h.health).toBe(96);
    expect(route().resident.position).toBe(24); expect(route().resident.permissionHistory.map(p => p.answer)).toEqual(['ACCEPT', 'WITHDRAWN', 'ACCEPT']);
    expect(r.block('BUY_REPAIR')).not.toBeNull(); expect(r.block('REPAIR')).not.toBeNull();
  });

  it('does not strand successful work when the player unloads and returns before acceptance', () => {
    const r = scene(); r.prepare(); r.step('RETURN_ON_FOOT');
    expect(r.state.routes[0]!.acceptance).toBeNull();
    expect(getWhiteTowerPassageActions(r.state, r.h).find(a => a.preferredAction)?.command.type).toBe('ACCEPT_WORK');
    const accept = r.step('ACCEPT_WORK'); expect(accept.effect.seconds).toBe(76);
    expect(r.state.routes[0]!.playerPosition).toBe(8);
    expect(r.state.journal.at(-1)!.walkedMeters).toBe(8);
    r.step('RETURN_ON_FOOT'); r.step('PASS_RESIDENT'); expect(r.state.routes[0]!.resident.position).toBe(24);
  });

  it('requires the next real week and a physical return before exposing any review receipt', () => {
    const r = scene(); r.prepare(); r.cross();
    expect(r.block('REVIEW_NEXT_WEEK')).not.toBeNull();
    r.nextWeek(); const result = r.step('REVIEW_NEXT_WEEK');
    expect(result.effect).toMatchObject({ actions: 1, cashCost: 0, seconds: 168 });
    expect(r.state.routes[0]!).toMatchObject({ playerPosition: 24, resident: { position: 24 }, review: { week: 201, walkedMeters: 24, residentPosition: 24 } });
    expect(whiteTowerPassageVerifiedReceipts(r.state)).toEqual([]);
    r.step('RETURN_ON_FOOT');
    expect(whiteTowerPassageVerifiedReceipts(r.state)).toEqual([{ passageId: 'market-steps', residentId: 'WT0-IVA', apparatusId: 'WT0-MARKET-RAIL', passedEventId: r.state.routes[0]!.passage!.eventId, passedWeek: 200, reviewedEventId: r.state.routes[0]!.review!.eventId, reviewedWeek: 201 }]);
    expect(r.block('REVIEW_NEXT_WEEK')).not.toBeNull();
  });

  it('uses the actual completion week when a physical crossing straddles a host week boundary', () => {
    const r = scene(); r.prepare(); r.step('ACCEPT_WORK'); r.step('RETURN_ON_FOOT');
    r.h.nowSecond = 604790; // Explicit ten seconds before the real host boundary.
    r.step('PASS_RESIDENT'); expect(r.h.week).toBe(201); expect(r.state.routes[0]!.passage!.week).toBe(201);
    r.step('RETURN_ON_FOOT'); expect(r.block('REVIEW_NEXT_WEEK')).not.toBeNull();
    r.nextWeek(); r.step('REVIEW_NEXT_WEEK'); r.step('RETURN_ON_FOOT');
    expect(whiteTowerPassageVerifiedReceipts(r.state)[0]!.reviewedWeek).toBe(202);
  });

  it('needs all three original crossings and all three later in-place reviews, each with separate original events', () => {
    const r = scene();
    for (const p of WHITE_TOWER_PASSAGES) { r.prepare(p.id); r.cross(p.id); }
    expect(r.h.cash).toBe(368); expect(whiteTowerPassageVerifiedReceipts(r.state)).toEqual([]);
    r.nextWeek();
    for (const p of WHITE_TOWER_PASSAGES) { r.h.location = p.location; r.step('REVIEW_NEXT_WEEK', p.id); r.step('RETURN_ON_FOOT', p.id); }
    const receipts = whiteTowerPassageVerifiedReceipts(r.state);
    expect(receipts).toHaveLength(3); expect(new Set(receipts.flatMap(r => [r.passedEventId, r.reviewedEventId])).size).toBe(6);
    expect(whiteTowerPassagesComplete(r.state)).toBe(true);
    expect(r.state.journal.reduce((n, j) => n + j.materialsConsumed.length, 0)).toBe(3);
    expect(projectWhiteTowerPassages(r.state).lines.join('')).toContain('第201周已实走复核');
  });

  it('preserves potentially lethal failure costs and rejects reusing a committed event', () => {
    const r = scene(); r.h.health = 8; r.prepare('market-steps', 99);
    expect(r.h.status).toBe('DEAD'); expect(r.state.playerInjuries[0]!.severity).toBe('HEAVY');
    expect(r.state.routes[0]!.resident.position).toBe(0); expect(r.block('RETURN_ON_FOOT')).not.toBeNull();
    const other = scene(); other.step('SURVEY'); const event = other.state.journal[0]!;
    other.h.revision = event.revision; other.h.eventId = event.id;
    expect(other.block('ASK_PERMISSION')).not.toBeNull();
  });
});
