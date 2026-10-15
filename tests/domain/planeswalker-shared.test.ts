import { describe, expect, it } from 'vitest';
import { assertValidSliceState, applySliceIntent, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { hasPlaneswalkerLock, validatePlaneswalkerState } from '../../src/domain/planeswalker/index.js';
import { taught, rejectIntent, rejectPW, routeAway, returnAndClose, oldDoorRoots } from './planeswalker-directed-helper.js';

import { actualSnapshot, actualBoundary } from './planeswalker-fixture-helper.js';

const unrelated: SliceIntent[] = [
  { type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'REST' },
  { type: 'ACTION', action: 'LEARN', targetId: 'learn.seer-notes' },
  { type: 'SET_LIFESTYLE', tier: 'LUXURIOUS' }, { type: 'REPAY', amount: 1 }, { type: 'CONTINUE_LIFE' },
  { type: 'WANDERER', command: { type: 'REFLECT' } }, { type: 'SECRETS_SORCERER', command: { type: 'LEARN_GUIDANCE' } },
  { type: 'FERRYMAN', command: { type: 'ERA_WORK' } }, { type: 'DEATH_CONSUL', command: { type: 'LEARN_GUIDANCE' } },
];
const states: [string, () => SliceState][] = [
  ['route preparation', () => actualBoundary('first-visit-check_route_return').final],
  ['actual offworld body', () => actualBoundary('first-actual-offworld-departure').final],
  ['returned unarchived kit', () => actualBoundary('first-actual-paid-return').final],
  ['paid dose preparation', () => actualBoundary('paid140-current-week-original-auxiliary-check').final],
  ['open S2 original practice', () => actualBoundary('symbolic-transit-prepared').final],
  ['ready contemporary encounter', () => actualBoundary('original-enemy-approach').final],
];
describe('Planeswalker shared body, acquisition, life and encounter locks', () => {
  it.each(states)('blocks unrelated public life and other-path shortcuts during%s', (_name, create) => {
    const s = create(), before = structuredClone(s); expect(hasPlaneswalkerLock(s)).toBe(true);
    for (const intent of unrelated) rejectIntent(s, intent);
    expect(s).toEqual(before); expect(validatePlaneswalkerState(s)).toBe(true); assertValidSliceState(s);
  }, 90_000);
  it('does not interpret cancellation, a different case, or acquisition as free offworld return', () => {
    const s = actualBoundary('first-actual-offworld-departure').final, before = structuredClone(s);
    for (const c of [{ type: 'LEAVE_PREPARATION' }, { type: 'LEARN_GUIDANCE' }, { type: 'BUY_POTION', bottleId: 'planeswalker-potion-1' },
      { type: 'CLOSE_ROUTE_KIT' }, { type: 'OBSERVE', caseId: 'symbolic-transit' }, { type: 'ENCOUNTER_TALK' }]) rejectPW(s, c);
    expect(s).toEqual(before); expect(s.planeswalker.ritual.playerLocation).toBe('PW2-COPPER');
  });
  it('restores ordinary work only after real return and archive, without resetting remote originals', () => {
    const before = routeAway(taught()), closed = returnAndClose(before), worked = applySliceIntent(closed, { type: 'ACTION', action: 'WORK' });
    expect(hasPlaneswalkerLock(closed)).toBe(false); expect(worked.planeswalker.ritual).toEqual(closed.planeswalker.ritual);
    expect(oldDoorRoots(worked)).toEqual(oldDoorRoots(before)); expect(worked.wanderer.life.packet.location).toBe('REMOTE'); assertValidSliceState(worked);
  });
  it('keeps S2 prior acquisition and practice read-only while retaining all thirteen original mastery values', () => {
    const s = actualSnapshot('promoted'), old = actualSnapshot('departureStart');
    for (const type of ['APPRENTICE', 'TRICKMASTER', 'ASTROLOGER', 'RECORDER', 'TRAVELER', 'SECRETS_SORCERER', 'WANDERER'] as const) {
      rejectIntent(s, { type, command: { type: 'LEARN_GUIDANCE' } } as SliceIntent);
    }
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(Object.keys(s.progression.mastery)).toHaveLength(15); expect(oldDoorRoots(s)).toEqual(oldDoorRoots(old));
    expect(projectSliceState(s).maxSpirituality).toBe(120); assertValidSliceState(s);
  });
  it('exposes typed live combat and blocks noncombat practice without mutating the original scene', () => {
    const s = actualSnapshot('combatStart'), before = structuredClone(s), p = projectSliceState(s);
    expect(p.combat?.planeswalker).toBeTruthy(); expect(s.combat?.encounterId).toBe('PLANESWALKER_DISPUTE');
    rejectPW(s, { type: 'OBSERVE', caseId: 'symbolic-transit' }); rejectPW(s, { type: 'LEAVE_ENCOUNTER' });
    rejectIntent(s, { type: 'ACTION', action: 'REST' }); expect(s).toEqual(before); assertValidSliceState(s);
  }, 90_000);
  it('rejects ordinary-death action attempts instead of reviving the body through its old channel', () => {
    const s = actualSnapshot(); expect(s.status).toBe('DEAD'); expect(s.health).toBe(0);
    for (const intent of [{ type: 'ACTION', action: 'REST' }, { type: 'PLANESWALKER', command: { type: 'ENCOUNTER_TALK' } },
      { type: 'PLANESWALKER', command: { type: 'OBSERVE', caseId: 'symbolic-transit' } }] as SliceIntent[]) rejectIntent(s, intent);
    expect(s.health).toBe(0); expect(s.status).toBe('DEAD');
  });
});
