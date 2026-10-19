import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { TyrantHost } from '../../src/domain/tyrant/coasts.js';
import {
  TYRANT_CHALLENGE_LOCATION, applyTyrantChallenge, canLeaveTyrantChallenge, createTyrantChallenge,
  getTyrantChallengeActions, projectTyrantChallenge, tyrantChallengeBlock, tyrantChallengeComplete,
  tyrantChallengeReceipt, validateTyrantChallengeCommand, type TyrantChallengeCommand,
} from '../../src/domain/tyrant/challenge.js';

/** Explicit isolated component budgets and rolls; not a natural playthrough. */
function scene() {
  const h: TyrantHost = { actorId: 'original-player', eventId: 'challenge-1', revision: 1, status: 'ACTIVE', sequence: 1,
    week: 210, weekAnchor: 0, nowSecond: 36000, location: TYRANT_CHALLENGE_LOCATION, cash: 2000, actions: 3,
    health: 100, mind: 100, spirituality: 120, check: null };
  let state = createTyrantChallenge('directed-challenge', h.actorId, h.week, h.nowSecond);
  const step = (type: TyrantChallengeCommand['type'], roll = 20) => {
    h.check = resolveNormalCheck({ ability: 'will', baseAbility: 60, difficulty: 40, modifiers: [], roll });
    const before = structuredClone(state), result = applyTyrantChallenge(state, { type }, h); expect(state).toEqual(before);
    state = result.state; h.actions -= result.effect.actions; h.spirituality -= result.effect.spirituality;
    h.health = Math.max(0, h.health - result.effect.health); h.nowSecond += result.effect.seconds;
    while (h.nowSecond >= h.weekAnchor + 604800) { h.week++; h.weekAnchor += 604800; }
    if (h.health <= 0) h.status = 'DEAD'; h.eventId = `challenge-${++h.revision}`; h.check = null; return result;
  };
  const block = (type: TyrantChallengeCommand['type']) => tyrantChallengeBlock(state, { type }, h);
  return { h, step, block, get state() { return state; } };
}

describe('Tyrant genuinely hostile other-god challenge', () => {
  it('has a living independent hostile Sun0, not an actor occupying the vacant Tyrant uniqueness', () => {
    const r = scene(); expect(r.state.opponent).toMatchObject({ pathway: 'sun', sequence: 0, status: 'ACTIVE', health: 1000, spirituality: 10000, disposition: 'HOSTILE' });
    expect(r.state.opponent.id).not.toBe(r.h.actorId); expect(r.state.participants).toEqual([]);
    expect(tyrantChallengeReceipt(r.state)).toBeNull(); expect(canLeaveTyrantChallenge(r.state)).toBe(true);
  });
  it('rejects injected victory, companion, distance, opponent tier or damage', () => {
    expect(validateTyrantChallengeCommand({ type: 'BEGIN' })).toBe(true);
    for (const extra of [{ success: true }, { survived: true }, { distance: 60 }, { ally: 'friend' }, { sequence: 0 }, { damage: 9999 }]) expect(validateTyrantChallengeCommand({ type: 'BEGIN', ...extra })).toBe(false);
    expect(validateTyrantChallengeCommand({ type: 'AUTO_WIN' })).toBe(false);
  });
  it('requires living S1, original actor, actual place and a real independent exchange check', () => {
    const r = scene(); r.h.sequence = 2; expect(r.block('BEGIN')).not.toBeNull(); r.h.sequence = 1;
    r.h.actorId = 'replacement'; expect(r.block('BEGIN')).not.toBeNull(); r.h.actorId = r.state.actorId;
    r.h.location = 'TYRANT0-NORTH'; expect(r.block('BEGIN')).not.toBeNull(); r.h.location = TYRANT_CHALLENGE_LOCATION;
    r.h.health = 0; expect(r.block('BEGIN')).not.toBeNull(); r.h.health = 100;
    expect(() => applyTyrantChallenge(r.state, { type: 'BEGIN' }, r.h)).toThrow(/独立检定/);
    expect(r.block('RETREAT')).not.toBeNull(); expect(r.block('BREAK_CONTACT')).not.toBeNull();
  });
  it('makes the same genuine god retaliate and spend its own resources in the opening attack', () => {
    const r = scene(), result = r.step('BEGIN');
    expect(result.effect).toMatchObject({ actions: 1, spirituality: 12, seconds: 30, health: 8 });
    expect(r.state.opponent).toMatchObject({ health: 988, spirituality: 9988, pursuitCount: 1, disposition: 'HOSTILE' });
    expect(r.state.participants).toEqual([{ actorId: r.h.actorId, role: 'CHALLENGER' }, { actorId: r.state.opponent.id, role: 'HOSTILE_DEITY' }]);
    expect(r.state.exchanges[0]).toMatchObject({ playerAttack: 'LIGHTNING_CHALLENGE', enemyAction: 'SOLAR_LANCE', playerHealthLoss: 8, enemyHealthLoss: 12 });
    expect(r.block('BEGIN')).not.toBeNull(); expect(canLeaveTyrantChallenge(r.state)).toBe(false);
  });
  it('requires actual movement and separately surviving the final interception, without killing the god', () => {
    const r = scene(); r.step('BEGIN');
    for (let n = 0; n < 3; n++) r.step('RETREAT');
    expect(r.state.position).toBe(60); expect(r.state.totalWalkedMeters).toBe(60);
    expect(r.state.status).toBe('ENGAGED'); expect(tyrantChallengeReceipt(r.state)).toBeNull();
    expect(r.block('RETREAT')).not.toBeNull(); expect(getTyrantChallengeActions(r.state, r.h).find(a => a.preferredAction)?.command.type).toBe('BREAK_CONTACT');
    r.step('BREAK_CONTACT'); expect(r.state.status).toBe('ESCAPED'); expect(r.h.health).toBe(56);
    expect(r.state.opponent.health).toBe(988); expect(r.state.opponent.status).toBe('ACTIVE'); expect(canLeaveTyrantChallenge(r.state)).toBe(true);
    expect(tyrantChallengeReceipt(r.state)).toMatchObject({ actorId: r.h.actorId, opponentSequence: 0, opponentPathway: 'sun', walkedMeters: 60, hostileExchanges: 5, healthOnEscape: 56 });
    expect(r.block('BEGIN')).not.toBeNull(); expect(r.block('BREAK_CONTACT')).not.toBeNull();
  });
  it('does not award survival at a fixed exchange count; outcomes change movement and lethal risk', () => {
    const r = scene(); r.step('BEGIN', 100);
    r.step('WITHDRAW', 100); r.step('WITHDRAW', 100); r.step('WITHDRAW', 100);
    expect(r.state.exchanges).toHaveLength(4); expect(r.state.position).toBe(0); expect(r.h.health).toBe(14);
    expect(tyrantChallengeComplete(r.state)).toBe(false);
    r.step('RETREAT', 100); expect(r.state.status).toBe('DEAD'); expect(r.h.status).toBe('DEAD'); expect(r.h.health).toBe(0);
    expect(tyrantChallengeReceipt(r.state)).toBeNull(); expect(r.state.opponent.health).toBe(1000);
    expect(r.state.injuries.every(x => x.severity === 'HEAVY')).toBe(true); expect(r.block('RETREAT')).not.toBeNull();
  });
  it('allows ordinary paid-time retreat with zero remaining AP or spirituality, still exposing real injuries', () => {
    const r = scene(); r.h.actions = 1; r.h.spirituality = 12; r.step('BEGIN');
    expect(r.h.actions).toBe(0); expect(r.h.spirituality).toBe(0);
    expect(r.block('WITHDRAW')).not.toBeNull(); expect(r.block('STRIKE')).not.toBeNull(); expect(r.block('RETREAT')).toBeNull();
    const result = r.step('RETREAT'); expect(result.effect).toMatchObject({ actions: 0, spirituality: 0, seconds: 30, health: 10 });
    expect(result.injuries).toHaveLength(1); expect(r.state.position).toBe(20); expect(r.state.injuries).toEqual(result.injuries);
  });
  it('keeps a failed final escape active and makes the forced fifteen-metre return physical', () => {
    const r = scene(); r.step('BEGIN', 1); r.step('RETREAT', 1); r.step('RETREAT', 1);
    expect(r.state.position).toBe(60); const result = r.step('BREAK_CONTACT', 95);
    expect(r.state.status).toBe('ENGAGED'); expect(r.state.position).toBe(45); expect(r.state.totalWalkedMeters).toBe(75);
    expect(result.effect.health).toBe(12); expect(tyrantChallengeReceipt(r.state)).toBeNull();
    r.step('RETREAT', 1); expect(r.state.position).toBe(60); expect(r.state.totalWalkedMeters).toBe(90);
    r.step('BREAK_CONTACT', 1); expect(tyrantChallengeReceipt(r.state)?.walkedMeters).toBe(90);
  });
  it('records the real clock across a week boundary instead of treating rounds as weeks', () => {
    const r = scene(); r.h.nowSecond = 604790; r.step('BEGIN');
    expect(r.h.week).toBe(211); expect(r.state.exchanges[0]!.week).toBe(211); expect(r.state.startedWeek).toBe(210);
    expect(r.state.lastSecond).toBe(604820); expect(r.state.position).toBe(0);
  });
  it('fails closed for coerced, same-person, dead, wrong-pathway or non-solo enemy records', () => {
    const r = scene(); r.step('BEGIN');
    for (const change of [
      (s: typeof r.state) => { s.opponent.status = 'DEAD'; },
      (s: typeof r.state) => { s.opponent.health = 0; },
      (s: typeof r.state) => { s.participants.push({ actorId: 'helper', role: 'CHALLENGER' }); },
    ]) { const s = structuredClone(r.state); change(s); expect(tyrantChallengeBlock(s, { type: 'RETREAT' }, r.h)).not.toBeNull(); }
    expect(projectTyrantChallenge(r.state).lines.join('\n')).toContain('没有固定轮数自动胜利');
  });
  it('rejects duplicate event/revision even before the central idempotency guard', () => {
    const r = scene(); const old = structuredClone(r.h); r.step('BEGIN');
    expect(tyrantChallengeBlock(r.state, { type: 'RETREAT' }, { ...r.h, eventId: old.eventId })).not.toBeNull();
    expect(tyrantChallengeBlock(r.state, { type: 'RETREAT' }, { ...r.h, revision: old.revision })).not.toBeNull();
  });
});
