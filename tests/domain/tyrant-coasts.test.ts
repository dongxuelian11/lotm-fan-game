import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  TYRANT_COASTS, applyTyrantCoast, canLeaveTyrantCoasts, carriedTyrantParcel, createTyrantCoasts,
  getTyrantCoastActions, loseTyrantCargo, projectTyrantCoasts, tyrantCoastBlock, tyrantCoastEvidence,
  tyrantCoastNeedsCheck, validateTyrantCoastCommand, type TyrantCoastCommand, type TyrantCoastId, type TyrantHost,
} from '../../src/domain/tyrant/coasts.js';

/** Directed reducer fixture, not natural-campaign or admitted-save evidence.
 * Time, travel and budgets here are explicit host inputs. */
function scene() {
  const h: TyrantHost = { actorId: 'original-player', eventId: 'coast-1', revision: 1, status: 'ACTIVE', sequence: 1,
    week: 200, weekAnchor: 0, nowSecond: 36000, location: 'TYRANT0-NORTH', cash: 2000, actions: 50,
    health: 100, mind: 100, spirituality: 200, check: null, seaVoyages: [] };
  let state = createTyrantCoasts('directed-coasts', h.actorId, h.week, h.nowSecond);
  const step = (type: TyrantCoastCommand['type'], coastId: TyrantCoastId = 'north', roll = 20) => {
    const c = { type, coastId }, before = structuredClone(state);
    h.check = tyrantCoastNeedsCheck(c) ? resolveNormalCheck({ ability: 'will', baseAbility: 60, difficulty: 40, modifiers: [], roll }) : null;
    const result = applyTyrantCoast(state, c, h); expect(state).toEqual(before);
    state = result.state; h.cash -= result.effect.cashCost; h.actions -= result.effect.actions;
    h.spirituality -= result.effect.spirituality; h.health = Math.max(0, h.health - result.effect.health); h.nowSecond += result.effect.seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; }
    if (h.health === 0) h.status = 'DEAD';
    h.eventId = `coast-${++h.revision}`; h.check = null; return result;
  };
  const go = (id: TyrantCoastId) => { h.location = TYRANT_COASTS.find(c => c.id === id)!.location; };
  const nextWeek = () => { h.nowSecond = h.weekAnchor + 604800; h.weekAnchor += 604800; h.week++; };
  const block = (type: TyrantCoastCommand['type'], coastId: TyrantCoastId = 'north') => tyrantCoastBlock(state, { type, coastId }, h);
  const fulfill = (id: TyrantCoastId = 'north', roll = 20) => { go(id); step('SURVEY', id); step('ASK_PERMISSION', id); step('FULFILL', id, roll); step('RETURN_TO_HARBOR', id); };
  const review = (id: TyrantCoastId = 'north') => { go(id); step('REVIEW_NEXT_WEEK', id); step('RETURN_TO_HARBOR', id); };
  const voyage = () => {
    const p = carriedTyrantParcel(state)!; const departWeek = h.week, departSecond = h.nowSecond, from = h.location;
    h.cash -= 60; h.actions--; h.nowSecond += 604800; h.week++; h.weekAnchor += 604800; h.location = 'TYRANT0-SOUTH';
    h.seaVoyages!.push({ eventId: `voyage-${h.revision++}`, from, to: h.location, departWeek, arriveWeek: h.week, departSecond, arriveSecond: h.nowSecond, cashCost: 60, actions: 1, cargoId: p.id });
    h.eventId = `coast-${h.revision}`;
  };
  return { h, step, go, nextWeek, block, fulfill, review, voyage, get state() { return state; } };
}

describe('Tyrant three original coast cohorts', () => {
  it('starts with exactly 36 finite grain, three disjoint 90000-person original populations and no faith', () => {
    const r = scene(); expect(r.state.coasts.map(c => c.grain)).toEqual([15, 15, 6]);
    expect(r.state.coasts.map(c => c.cohorts.reduce((n, g) => n + g.living, 0))).toEqual([90000, 90000, 90000]);
    expect(new Set(r.state.coasts.flatMap(c => c.cohorts.map(g => g.id))).size).toBe(9);
    expect(tyrantCoastEvidence(r.state, r.h.week).intersection).toBe(0);
    for (let n = 0; n < 50; n++) r.nextWeek();
    expect(r.state.coasts.reduce((n, c) => n + c.grain, 0)).toBe(36);
  });
  it('rejects client-supplied population, permission, grain, travel and success flags', () => {
    const c = { type: 'SURVEY', coastId: 'north' };
    expect(validateTyrantCoastCommand(c)).toBe(true);
    for (const extra of [{ population: 200000 }, { permission: true }, { grain: 500 }, { success: true }, { voyageEventId: 'fake' }, { week: 999 }]) expect(validateTyrantCoastCommand({ ...c, ...extra })).toBe(false);
    expect(validateTyrantCoastCommand({ type: 'WAIT_REFILL', coastId: 'north' })).toBe(false);
    expect(validateTyrantCoastCommand({ type: 'SURVEY', coastId: 'invented' })).toBe(false);
  });
  it('requires actual place, same living S1 actor, survey, current permission and 3-grain fulfillment', () => {
    const r = scene(); expect(r.block('FULFILL')).not.toBeNull();
    r.h.sequence = 2; expect(r.block('SURVEY')).not.toBeNull(); r.h.sequence = 1;
    r.h.actorId = 'other'; expect(r.block('SURVEY')).not.toBeNull(); r.h.actorId = r.state.actorId;
    r.go('east'); expect(r.block('SURVEY')).not.toBeNull(); r.go('north');
    r.step('SURVEY'); r.step('ASK_PERMISSION'); expect(r.block('ASK_PERMISSION')).not.toBeNull();
    r.nextWeek(); expect(r.block('FULFILL')).not.toBeNull(); r.step('ASK_PERMISSION');
    const result = r.step('FULFILL'); expect(result.effect).toMatchObject({ actions: 1, spirituality: 6, seconds: 600 });
    expect(r.state.coasts[0]!.grain).toBe(12); expect(r.state.coasts[0]!.playerPosition).toBe(30);
    expect(canLeaveTyrantCoasts(r.state, r.h.location)).toBe(false); expect(r.block('REVIEW_NEXT_WEEK')).not.toBeNull();
    expect(getTyrantCoastActions(r.state, r.h).find(a => a.preferredAction)?.command.type).toBe('RETURN_TO_HARBOR');
    expect(r.step('RETURN_TO_HARBOR').effect).toMatchObject({ cashCost: 0, actions: 0, spirituality: 0, seconds: 60 });
    expect(canLeaveTyrantCoasts(r.state)).toBe(true); expect(r.block('REVIEW_NEXT_WEEK')).not.toBeNull();
    r.nextWeek(); r.review(); expect(tyrantCoastEvidence(r.state, r.h.week).intersection).toBe(90000);
  });
  it('counts the same current living members in all three relations, never marginal population sums', () => {
    const r = scene(); for (const id of ['north', 'east', 'south'] as const) r.fulfill(id);
    r.nextWeek(); for (const id of ['north', 'east', 'south'] as const) r.review(id);
    expect(tyrantCoastEvidence(r.state, r.h.week)).toMatchObject({ intersection: 270000, ready: true });
    const mixed = structuredClone(r.state);
    for (const c of mixed.coasts) { c.cohorts[0]!.obeys = false; c.cohorts[1]!.believes = false; c.cohorts[2]!.fears = false; }
    expect(tyrantCoastEvidence(mixed, r.h.week)).toMatchObject({ intersection: 0, ready: false });
    const mortality = structuredClone(r.state); mortality.coasts[0]!.cohorts[0]!.living = 0;
    expect(tyrantCoastEvidence(mortality, r.h.week).intersection).toBe(240000);
    mortality.coasts[0]!.cohorts[1]!.living = 0; mortality.coasts[0]!.cohorts[2]!.living = 0;
    expect(tyrantCoastEvidence(mortality, r.h.week).ready).toBe(false);
  });
  it('fits three real coastal reviews into one twelve-week window using three weekly AP and paid adjacent voyages', () => {
    const r = scene(); r.h.actions = 3;
    const week = () => { r.nextWeek(); r.h.actions = 3; };
    const sea = (to: TyrantCoastId) => {
      const from = r.h.location, departWeek = r.h.week, departSecond = r.h.nowSecond;
      expect(r.h.actions).toBeGreaterThanOrEqual(1); expect(r.h.cash).toBeGreaterThanOrEqual(60);
      r.h.actions--; r.h.cash -= 60; r.h.nowSecond += 604800; r.h.week++; r.h.weekAnchor += 604800;
      r.go(to); r.h.actions = 3; r.h.seaVoyages!.push({ eventId: `coastal-route-${r.h.revision++}`, from, to: r.h.location,
        departWeek, arriveWeek: r.h.week, departSecond, arriveSecond: r.h.nowSecond, cashCost: 60, actions: 1, cargoId: null });
      r.h.eventId = `coast-${r.h.revision}`;
    };
    r.fulfill('north'); week(); r.review('north'); sea('south');
    r.fulfill('south'); week(); r.review('south'); sea('east');
    r.fulfill('east'); week(); r.review('east'); sea('south');
    expect(r.h.week).toBe(206); expect(r.h.cash).toBe(1820); expect(r.h.spirituality).toBe(182);
    expect(tyrantCoastEvidence(r.state, r.h.week)).toMatchObject({ ready: true, intersection: 270000 });
    expect(Math.min(...r.state.coasts.map(c => c.review!.expiresWeek)) - r.h.week).toBe(7);
    expect(r.state.coasts.reduce((n, c) => n + c.grain, 0)).toBe(27);
  });
  it('rejects appended or overlapping ghost cohorts and unsupported review certificates', () => {
    const r = scene(); for (const id of ['north', 'east', 'south'] as const) r.fulfill(id);
    r.nextWeek(); for (const id of ['north', 'east', 'south'] as const) r.review(id);
    const duplicate = structuredClone(r.state); duplicate.coasts.push(structuredClone(duplicate.coasts[0]!));
    expect(tyrantCoastEvidence(duplicate, r.h.week)).toMatchObject({ validRoster: false, ready: false, intersection: 0 });
    const overlap = structuredClone(r.state); overlap.coasts[0]!.cohorts[1]!.firstMember = 1;
    expect(tyrantCoastEvidence(overlap, r.h.week).ready).toBe(false);
    const certificate = structuredClone(r.state); certificate.journal = certificate.journal.filter(j => j.command.type !== 'REVIEW_NEXT_WEEK');
    expect(tyrantCoastEvidence(certificate, r.h.week).intersection).toBe(0);
  });
  it('expires exactly twelve real weeks after review and recommends actual paid renewal then rereview', () => {
    const r = scene(); r.fulfill(); r.nextWeek(); r.review(); const reviewedWeek = r.h.week;
    expect(tyrantCoastEvidence(r.state, reviewedWeek + 11).intersection).toBe(90000);
    expect(tyrantCoastEvidence(r.state, reviewedWeek + 12).intersection).toBe(0);
    for (let n = 0; n < 12; n++) r.nextWeek();
    expect(r.state.coasts[0]!.status).toBe('RESOLVED'); expect(r.block('FULFILL')).not.toBeNull();
    expect(getTyrantCoastActions(r.state, r.h).find(a => a.preferredAction)?.command.type).toBe('ASK_PERMISSION');
    r.step('ASK_PERMISSION'); expect(getTyrantCoastActions(r.state, r.h).find(a => a.preferredAction)?.command.type).toBe('RENEW');
    r.step('RENEW'); expect(r.state.coasts[0]!.grain).toBe(9); expect(tyrantCoastEvidence(r.state, r.h.week).intersection).toBe(0);
    r.step('RETURN_TO_HARBOR'); r.nextWeek(); r.review(); expect(tyrantCoastEvidence(r.state, r.h.week).intersection).toBe(90000);
  });
  it('preserves failed provisions, real injuries and resident refusal instead of granting faith', () => {
    const r = scene(); r.fulfill('north', 100); expect(r.state.coasts[0]!.grain).toBe(12); expect(r.h.health).toBe(92);
    r.nextWeek(); r.review(); expect(r.state.coasts[0]!.status).toBe('REFUSED'); expect(r.block('ASK_PERMISSION')).not.toBeNull();
    expect(tyrantCoastEvidence(r.state, r.h.week).intersection).toBe(0);
    r.nextWeek(); r.step('ASK_PERMISSION'); r.step('RENEW'); r.step('RETURN_TO_HARBOR');
    r.nextWeek(); r.review(); expect(r.state.coasts[0]!.grain).toBe(9); expect(tyrantCoastEvidence(r.state, r.h.week).intersection).toBe(90000);
  });
  it('excludes coerced groups permanently and permits honest withdrawal of prior agreement', () => {
    const r = scene(); r.fulfill(); r.nextWeek(); r.review(); r.step('REFUSE'); expect(tyrantCoastEvidence(r.state, r.h.week).intersection).toBe(0);
    r.step('COERCE'); expect(r.state.coasts[0]!.cohorts.every(g => g.fears && g.obeys && !g.believes)).toBe(true);
    r.nextWeek(); expect(r.block('ASK_PERMISSION')).not.toBeNull(); expect(r.block('RENEW')).not.toBeNull();
  });
  it('fails closed at the permission week boundary and on insufficient real budgets', () => {
    const r = scene(); r.step('SURVEY'); r.step('ASK_PERMISSION'); r.h.nowSecond = r.h.weekAnchor + 604799;
    expect(r.block('FULFILL')).not.toBeNull();
    r.nextWeek(); r.step('ASK_PERMISSION'); r.h.spirituality = 5; expect(r.block('FULFILL')).not.toBeNull();
    r.h.spirituality = 6; r.h.actions = 0; expect(r.block('FULFILL')).not.toBeNull();
  });
});

describe('Tyrant finite physical grain transfer', () => {
  it('pays 240p and 3AP plus real sea week and delivers the same single parcel without duplication', () => {
    const r = scene(); r.step('SURVEY'); r.step('ASK_TRANSFER'); const cash = r.h.cash, ap = r.h.actions, second = r.h.nowSecond;
    r.step('LOAD_TRANSFER'); const parcel = carriedTyrantParcel(r.state)!;
    expect(r.state.coasts[0]!.grain).toBe(12); expect(r.block('LOAD_TRANSFER')).not.toBeNull();
    r.go('south'); expect(r.block('DELIVER_TRANSFER', 'south')).not.toBeNull(); r.go('north');
    r.voyage(); r.step('DELIVER_TRANSFER', 'south');
    expect(r.state.coasts[2]!.grain).toBe(9); expect(r.h.cash).toBe(cash - 240); expect(r.h.actions).toBe(ap - 3); expect(r.h.nowSecond).toBe(second + 604800 + 1200);
    expect(r.state.parcels).toHaveLength(1); expect(r.state.parcels[0]).toMatchObject({ id: parcel.id, status: 'DELIVERED', grain: 3 });
    expect(carriedTyrantParcel(r.state)).toBeNull(); expect(r.block('DELIVER_TRANSFER', 'south')).not.toBeNull();
    r.go('north'); expect(r.block('LOAD_TRANSFER')).not.toBeNull();
  });
  it('requires original-owner current permission and refuses to take the last three grain', () => {
    const r = scene(); r.step('SURVEY'); expect(r.block('LOAD_TRANSFER')).not.toBeNull(); r.step('ASK_TRANSFER'); r.nextWeek(); expect(r.block('LOAD_TRANSFER')).not.toBeNull();
    r.step('ASK_TRANSFER'); r.step('LOAD_TRANSFER'); r.step('DISCARD_CARGO'); expect(r.block('LOAD_TRANSFER')).not.toBeNull();
    for (let n = 0; n < 3; n++) { r.nextWeek(); r.step('ASK_TRANSFER'); r.step('LOAD_TRANSFER'); r.step('DISCARD_CARGO'); }
    expect(r.state.coasts[0]!.grain).toBe(3); r.nextWeek(); r.step('ASK_TRANSFER');
    expect(r.state.coasts[0]!.transferPermission!.answer).toBe('REFUSE'); expect(r.block('LOAD_TRANSFER')).not.toBeNull();
    expect(r.state.coasts.reduce((n, c) => n + c.grain, 0)).toBe(24);
  });
  it('revokes an otherwise-current export permission after coercion', () => {
    const r = scene(); r.step('SURVEY'); r.step('ASK_TRANSFER'); r.step('COERCE');
    expect(r.state.coasts[0]!.transferPermission!.answer).toBe('ACCEPT');
    expect(r.block('LOAD_TRANSFER')).not.toBeNull();
  });
  it('loses actual cargo on discard or death with no refund, duplicate delivery or wait refill', () => {
    const r = scene(); r.step('SURVEY'); r.step('ASK_TRANSFER'); r.step('LOAD_TRANSFER');
    const dead = loseTyrantCargo(r.state, 'death-event', 'DEATH'); expect(carriedTyrantParcel(dead)).toBeNull(); expect(dead.coasts[0]!.grain).toBe(12);
    expect(dead.parcels[0]).toMatchObject({ status: 'LOST', lostEventId: 'death-event:DEATH' });
    expect(loseTyrantCargo(dead, 'death-event', 'DEATH')).toEqual(dead);
    r.step('DISCARD_CARGO'); expect(r.state.parcels[0]!.status).toBe('LOST'); expect(r.block('DISCARD_CARGO')).not.toBeNull();
    for (let n = 0; n < 30; n++) r.nextWeek(); expect(r.state.coasts[0]!.grain).toBe(12);
  });
  it('rejects fake shortcut voyages, wrong cargo, wrong origin and reused transit', () => {
    const r = scene(); r.step('SURVEY'); r.step('ASK_TRANSFER'); r.step('LOAD_TRANSFER'); r.voyage();
    const original = structuredClone(r.h.seaVoyages![0]!);
    for (const patch of [{ cargoId: 'other' }, { cashCost: 0 }, { actions: 0 }, { arriveSecond: original.departSecond + 1 }, { from: 'TYRANT0-EAST' }]) {
      r.h.seaVoyages![0] = { ...original, ...patch }; expect(r.block('DELIVER_TRANSFER', 'south')).not.toBeNull();
    }
    r.h.seaVoyages![0] = original; expect(r.block('DELIVER_TRANSFER', 'south')).toBeNull();
    expect(projectTyrantCoasts(r.state, r.h.week).lines.join('\n')).toContain('240便士');
  });
});
