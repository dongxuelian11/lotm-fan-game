import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { NATURE_WALKER_CASE_IDS, blockNatureWalkerLife, getNatureWalkerCurrentSite, natureWalkerLifeClosed, natureWalkerLifeMasteryGains, hasNatureWalkerLifeLock, projectNatureWalkerLife, replayNatureWalkerLifeRoot, replayNatureWalkerLifeRootPad, validateNatureWalkerActivityCommand, validateNatureWalkerLifeState, type NatureWalkerActivityCommand, type NatureWalkerCaseId } from '../../src/domain/nature-walker/life.js';
import { nw, oldMotherRoots, originalBarrenMatriarch, promoted, promotedForLife, rejectNatureWalker, rejectIntent, type DirectedLifeKind } from './nature-walker-directed-helper.js';
const RESPONSE = 'mother.s1.living-response', BEARING = 'mother.s1.root-bearing';
const attempt = (s: SliceState, id: NatureWalkerCaseId) => s.natureWalker.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, command: NatureWalkerActivityCommand): SliceState { const next = nw(s, command); expect(validateNatureWalkerLifeState(next), JSON.stringify(command)).toBe(true); return next; }
function rented(kind: DirectedLifeKind = 'LIVING_RESPONSE'): SliceState { return act(act(promotedForLife(kind), { type: 'EXIT_ORIGINAL' }), { type: 'INITIALISE_WORKAREA' }); }
function begin(s: SliceState, caseId: NatureWalkerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', consent: 'CONSENT_OWNER' | 'DECLINE_PERMISSION' = 'CONSENT_OWNER'): SliceState {
  for (const command of [{ type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method }, { type: 'WALK', caseId, to: 'ANNEX_A' }, { type: 'CHECK_ORIGINALS', caseId }, { type: consent, caseId }, { type: 'SETUP_OBJECTS', caseId }, { type: 'WALK', caseId, to: 'ANNEX_B' }, { type: 'CHECK_SAMPLE', caseId }] as NatureWalkerActivityCommand[]) s = act(s, command); return s;
}
function finish(s: SliceState, caseId: NatureWalkerCaseId): SliceState {
  if (!attempt(s, caseId).resultRead) {
    if (caseId === 'withdrawn-care' && attempt(s, caseId).consent === 'GRANTED') s = act(s, { type: 'WITHDRAW_PERMISSION', caseId });
    s = act(s, { type: caseId === 'root-impact' ? 'ORDINARY_SUPPORT' : 'ORDINARY_CARE', caseId });
  }
  for (const command of [{ type: 'RETURN_OBJECTS', caseId }, { type: 'WALK', caseId, to: 'ANNEX_A' }, { type: 'WALK', caseId, to: 'OUTSIDE' }, { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId }] as NatureWalkerActivityCommand[]) s = act(s, command); return s;
}
const ordinary = (s: SliceState, id: NatureWalkerCaseId) => finish(begin(s, id, 'ORDINARY'), id);
function bearing(kind: DirectedLifeKind = 'ROOT_BEARING'): SliceState { let s = rented(kind); s = ordinary(s, 'living-response'); s = ordinary(s, 'withdrawn-care'); return act(begin(s, 'root-impact'), { type: 'ROOT_BEARING', caseId: 'root-impact' }); }

describe('Nature Walker original nursery and finite material continuity', () => {
  it('rejects spoofed targets, teleport destinations, refills and extra fields', () => {
    for (const command of [{ type: 'INITIALISE_WORKAREA', free: true }, { type: 'EXIT_ORIGINAL', metres: 0 }, { type: 'WALK', caseId: 'living-response', to: 'B' }, { type: 'LIVING_RESPONSE', caseId: 'living-response', target: 'DEAD_PLANT' }, { type: 'ROOT_BEARING', caseId: 'root-impact', target: 'LENA' }, { type: 'CARE_CHECK', caseId: 'living-response', response: 'FORCE' }, { type: 'REFILL_SUPPORT' }, { type: 'RESTORE_ROOT_PAD' }]) expect(validateNatureWalkerActivityCommand(command)).toBe(false);
    rejectNatureWalker(promoted(), { type: 'INITIALISE_WORKAREA' });
  });
  it('copies the authentic extended current site and exact used root pad, leaving eight roots immutable', () => {
    const original = originalBarrenMatriarch(), s = promoted(), l = s.natureWalker.life;
    expect(l.source!.originals.site).toEqual(original.coffinBearer.life); expect(l.site).toEqual(original.coffinBearer.life);
    expect(l.rootPad).toEqual(original.barrenMatriarch.life.rootPad); expect(l.rootPad!.integrity).toBe(50);
    expect(l.site).toMatchObject({ playerLocation: 'START', clockSeconds: 834, playerTravelMetres: 124, owner: { location: 'OUTSIDE' }, recipient: { location: 'OUTSIDE', mind: 100 } });
    expect(l.site!.samples.map(x => [x.alive, x.vitality])).toEqual([[true, 47], [true, 47], [false, 0]]);
    expect(l.site!.guard.segments.map(x => x.status)).toEqual(['SPENT', 'UNUSED', 'UNUSED']);
    expect(oldMotherRoots(s)).toEqual(oldMotherRoots(original)); expect(s.character.gender).toBe('FEMALE'); expect('energy' in l.site!.recipient).toBe(false);
    expect(getNatureWalkerCurrentSite(original)).toEqual(original.coffinBearer.life);
  });
  it('walks four metres first, then pays once and physically places two new marks', () => {
    const initial = promotedForLife(), outside = act(initial, { type: 'EXIT_ORIGINAL' }), s = act(outside, { type: 'INITIALISE_WORKAREA' });
    expect(outside.natureWalker.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 128, clockSeconds: 838 });
    expect(outside.cash - s.cash).toBe(40); expect(outside.actionsRemaining - s.actionsRemaining).toBe(1);
    expect(s.natureWalker.life.annex).toMatchObject({ supportPieces: 3, effortSpent: 0, ownerTravelMetres: 16, recipientTravelMetres: 8 });
    expect(s.natureWalker.life.annex.marks.map(x => [x.id, x.holder, x.location])).toEqual([['NW1-MARK-A', 'FLOOR', 'ANNEX_A'], ['NW1-MARK-B', 'FLOOR', 'ANNEX_B']]);
    expect(s.natureWalker.life.movements.some(x => x.actor === 'CB3-ADA' && x.from === 'ANNEX_A' && x.to === 'ANNEX_B' && x.itemIds.includes('NW1-MARK-B'))).toBe(true);
    expect(s.natureWalker.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 136, clockSeconds: 854 });
    expect(oldMotherRoots(s)).toEqual(oldMotherRoots(initial)); rejectNatureWalker(s, { type: 'RENT_ANNEX' });
  });
  it('charges actual adult cooperation and walks raw people, original samples and borrowed paper', () => {
    const initial = rented(), s = begin(initial, 'living-response');
    expect(hasNatureWalkerLifeLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.natureWalker.life.site).toMatchObject({ playerLocation: 'ANNEX_B', owner: { location: 'ANNEX_B', mind: 100 }, recipient: { location: 'ANNEX_B', mind: 99 }, paper: { holder: 'PLAYER', location: 'ANNEX_B' } });
    expect(s.natureWalker.life.annex.effortSpent).toBe(3); expect(attempt(s, 'living-response')).toMatchObject({ checkedAlive: true, checkedVitality: 47, effortSpent: 3, recipientMindSpent: 1 });
    expect(attempt(s, 'living-response').movements.some(x => x.actor === 'CB3-LENA' && x.itemIds.includes('CB3-LIVE-1') && x.to === 'ANNEX_B')).toBe(true);
    expect(s.natureWalker.life.site!.paper.records.slice(0, initial.natureWalker.life.site!.paper.records.length)).toEqual(initial.natureWalker.life.site!.paper.records);
    expect(oldMotherRoots(s)).toEqual(oldMotherRoots(initial));
  });
});
describe('Nature Walker paid response, independent next-care check and real withdrawal', () => {
  it('pays one cast and one finite material then uses +35 on one independent own care check', () => {
    let s = begin(rented(), 'living-response'); const before = structuredClone(s), cursor = s.random.cursor;
    s = act(s, { type: 'LIVING_RESPONSE', caseId: 'living-response' });
    expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 2); expect(s.natureWalker.life.annex.supportPieces).toBe(2);
    expect(s.random.cursor).toBe(cursor + 1); expect(s.progression.mastery[RESPONSE]).toBe(0);
    expect(s.natureWalker.life.operation.livingResponse).toMatchObject({ sampleId: 'CB3-LIVE-1', actor: 'PLAYER', target: 'PLAYER', remainingUses: 1 });
    s = act(s, { type: 'CARE_CHECK', caseId: 'living-response', response: 'COOPERATE' });
    expect(s.random.cursor).toBe(cursor + 2); expect(s.natureWalker.life.journal.at(-1)!.check!.modifiers).toEqual([{ source: '生机辨应：同一原活苗的本人下一次照料检查', value: 35 }]);
    expect(attempt(s, 'living-response').careAssisted).toBe(true); expect(s.natureWalker.life.operation.livingResponse).toBeNull();
    rejectNatureWalker(s, { type: 'CARE_CHECK', caseId: 'living-response', response: 'COOPERATE' });
    s = finish(s, 'living-response'); expect(s.progression.mastery[RESPONSE]).toBe(8); expect(s.natureWalker.life.site!.samples.map(x => x.vitality)).toEqual([47, 47, 0]);
    expect(oldMotherRoots(s)).toEqual(oldMotherRoots(before));
  });
  it('failed cast keeps costs and ordinary fallback without assistance, refill or mastery', () => {
    let s = begin(rented('LIVING_RESPONSE_FAIL'), 'living-response'); const before = structuredClone(s);
    s = act(s, { type: 'LIVING_RESPONSE', caseId: 'living-response' });
    expect(s.mind).toBe(before.mind - 4); expect(s.spirituality).toBe(before.spirituality - 8); expect(s.natureWalker.life.annex.supportPieces).toBe(2); expect(s.natureWalker.life.operation.livingResponse).toBeNull();
    rejectNatureWalker(s, { type: 'LIVING_RESPONSE', caseId: 'living-response' });
    s = finish(s, 'living-response'); expect(s.progression.mastery[RESPONSE]).toBe(0); expect(s.natureWalker.life.site!.samples[0]!.vitality).toBe(47);
  });
  it('actual adult resistance removes assistance without coercion or application reward', () => {
    let s = act(begin(rented(), 'living-response'), { type: 'LIVING_RESPONSE', caseId: 'living-response' });
    s = act(s, { type: 'CARE_CHECK', caseId: 'living-response', response: 'RESIST' });
    expect(s.natureWalker.life.journal.at(-1)!.check!.modifiers).toEqual([]); expect(attempt(s, 'living-response')).toMatchObject({ careAssisted: false, permissionWithdrawn: true, consent: 'WITHDRAWN' });
    s = finish(s, 'living-response'); expect(s.progression.mastery[RESPONSE]).toBe(0);
  });
  it('waiting consumes real20seconds, and withdrawal ends a paid window without refund', () => {
    let s = act(begin(rented(), 'living-response'), { type: 'LIVING_RESPONSE', caseId: 'living-response' }); const before = structuredClone(s);
    s = act(s, { type: 'WAIT_EFFECT', caseId: 'living-response' }); expect(s.natureWalker.life.site!.clockSeconds - before.natureWalker.life.site!.clockSeconds).toBe(20); expect(s.natureWalker.life.operation.livingResponse).toBeNull();
    expect([s.cash, s.spirituality, s.mind]).toEqual([before.cash, before.spirituality, before.mind]); s = finish(s, 'living-response');
    s = begin(s, 'withdrawn-care'); s = act(s, { type: 'LIVING_RESPONSE', caseId: 'withdrawn-care' }); const paid = [s.cash, s.spirituality, s.mind];
    s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: 'withdrawn-care' }); expect(s.natureWalker.life.operation.livingResponse).toBeNull(); expect([s.cash, s.spirituality, s.mind]).toEqual(paid);
    rejectNatureWalker(s, { type: 'LIVING_RESPONSE', caseId: 'withdrawn-care' }); s = finish(s, 'withdrawn-care'); expect(s.progression.mastery[RESPONSE]).toBe(0);
  });
});
describe('Nature Walker sole original pad and ordinary complete exit', () => {
  it('root-bearing consumes15of the actual50pad only at a real impact and awards no cast mastery', () => {
    let s = bearing(); expect(s.natureWalker.life.rootPad!.integrity).toBe(50); expect(s.progression.mastery[BEARING]).toBe(0); const beforeHealth = s.health;
    s = act(s, { type: 'APPLY_IMPACT', caseId: 'root-impact' }); expect(attempt(s, 'root-impact').impact).toMatchObject({ baseContribution: 45, contribution: 15, rootBearingApplied: true, healthLoss: 2, padWear: 15 });
    expect(s.health).toBe(beforeHealth - 2); expect(s.natureWalker.life.rootPad!.integrity).toBe(35); expect(s.natureWalker.life.operation.rootBearing).toBeNull();
    s = finish(s, 'root-impact'); expect(s.progression.mastery[BEARING]).toBe(8); expect(s.barrenMatriarch.life.rootPad.integrity).toBe(50);
    expect(s.natureWalker.life.site!.guard.segments.map(x => x.status)).toEqual(['SPENT', 'UNUSED', 'UNUSED']);
  }, 10000);
  it('ordinary support and failed bearing preserve real health/pad costs and zero new skill mastery', () => {
    const initial = rented('ROOT_BEARING_FAIL'); let s = ordinary(initial, 'living-response'); s = ordinary(s, 'withdrawn-care');
    s = act(begin(s, 'root-impact'), { type: 'ROOT_BEARING', caseId: 'root-impact' }); expect(s.natureWalker.life.operation.rootBearing).toBeNull(); const hp = s.health;
    s = act(s, { type: 'ORDINARY_SUPPORT', caseId: 'root-impact' }); expect(s.health).toBe(hp - 2); s = finish(s, 'root-impact'); s = act(s, { type: 'REFLECT' });
    expect(natureWalkerLifeClosed(s)).toBe(true); expect(hasNatureWalkerLifeLock(s)).toBe(false); expect(s.progression.acting).toBe(100); expect(natureWalkerLifeMasteryGains(s)).toEqual({ [RESPONSE]: 0, [BEARING]: 0 });
    expect(s.natureWalker.life.annex.effortSpent).toBe(9); expect(s.natureWalker.life.site!.recipient.mind).toBe(97); expect(s.natureWalker.life.rootPad!.integrity).toBe(35);
    expect(s.natureWalker.life.site!.samples.map(x => [x.location, x.vitality])).toEqual([['OUTSIDE', 47], ['OUTSIDE', 47], ['OUTSIDE', 0]]);
    expect(oldMotherRoots(s)).toEqual(oldMotherRoots(initial)); expect(projectNatureWalkerLife(s).actions).toEqual([]); expect(projectNatureWalkerLife(s).preferredActionId).toBeNull();
  }, 10000);
  it('can cancel before entry or any borrowing, then close without material, spirituality or health cost', () => {
    let s = rented(); const id = 'living-response' as const; s = act(s, { type: 'OBSERVE', caseId: id }); s = act(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); const before = structuredClone(s);
    for (const type of ['CANCEL_CASE', 'RETURN_OBJECTS', 'INSPECT', 'LEAVE'] as const) s = act(s, { type, caseId: id });
    expect([s.actionsRemaining, s.health, s.mind, s.spirituality, s.cash]).toEqual([before.actionsRemaining, before.health, before.mind, before.spirituality, before.cash]);
    expect(hasNatureWalkerLifeLock(s)).toBe(false); expect(s.natureWalker.life.site!.playerLocation).toBe('OUTSIDE'); expect(s.natureWalker.life.annex.supportPieces).toBe(3);
  });
  it('can cancel a real paid bearing without damage or wear, then actually carry original objects out', () => {
    let s = bearing(); const before = structuredClone(s); s = act(s, { type: 'CANCEL_IMPACT', caseId: 'root-impact' }); s = finish(s, 'root-impact');
    expect(s.health).toBe(before.health); expect(s.natureWalker.life.rootPad!.integrity).toBe(50); expect(s.progression.mastery[BEARING]).toBe(0);
    expect(s.natureWalker.life.site!.box).toMatchObject({ holder: 'OWNER', location: 'OUTSIDE', sampleId: null }); expect(s.natureWalker.life.site!.samples[2]).toMatchObject({ alive: false, vitality: 0, holder: 'OWNER', location: 'OUTSIDE' });
    expect(s.natureWalker.life.annex.clearance).toMatchObject({ ownerId: 'CB3-ADA', recipientId: 'CB3-LENA', ownerLocation: 'OUTSIDE', recipientLocation: 'OUTSIDE' });
  });
  it('whitelists public prose and rejects replay tampering with life, pad, records or RNG', () => {
    const s = act(begin(rented(), 'living-response'), { type: 'LIVING_RESPONSE', caseId: 'living-response' });
    const publicView = projectNatureWalkerLife(s), visible = JSON.stringify({ ...publicView, actions: [] });
    expect(visible).not.toMatch(/randomCursor|randomSeed|"roll"|"truth"|mechanicalpreparation|CB3-|BM2-|NW1-/);
    expect(replayNatureWalkerLifeRoot(s)).toEqual(s.natureWalker.life.site); expect(replayNatureWalkerLifeRootPad(s)).toEqual(s.natureWalker.life.rootPad);
    for (const mutate of [(x: SliceState) => { x.natureWalker.life.site!.samples[0]!.vitality++; }, (x: SliceState) => { x.natureWalker.life.rootPad!.integrity++; }, (x: SliceState) => { x.natureWalker.life.journal.at(-1)!.check!.roll = x.natureWalker.life.journal.at(-1)!.check!.roll % 100 + 1; }, (x: SliceState) => { x.natureWalker.life.site!.paper.records.push('未发生的记录'); }, (x: SliceState) => { x.natureWalker.life.site!.recipient.mind++; }]) {
      const forged = structuredClone(s); mutate(forged); expect(validateNatureWalkerLifeState(forged)).toBe(false); expect(() => assertValidSliceState(forged)).toThrow();
    }
    expect(blockNatureWalkerLife(s, { type: 'LIVING_RESPONSE', caseId: 'root-impact' })).not.toBeNull();
  });
});
