import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { gameDaysBetween } from '../game-calendar.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import { validateFoolSource, type FoolSource, type FoolBudget } from './source.js';
import { foolWorldDigest } from './world.js';
import { FOOL_ESCAPE_WORLD_RECORD } from './escape-content.js';
import {
  FOOL_ESCAPE_CASE_ID, createFoolEscapeState, applyFoolEscapeCommand, foolEscapeCheckInput,
  type FoolEscapeInitial, type FoolEscapeAuthority, type FoolEscapeBody, type FoolEscapeHost,
  type FoolEscapeCommand, type FoolEscapeState,
} from './escape.js';

// The constructor must live beside the private kernel reducer so no public
// unchecked-state or caller-supplied authority seam is needed for advancement.
export {
  createFoolEscapeReplayCursor as createFoolEscapeHostReplayCursor,
  type FoolEscapeHostReplayCursor,
} from './escape.js';

/** PRIVATE CENTRAL ADAPTER, candidate NOT_RUN.
 * Inputs are produced by the central full replay, never from a client/save's
 * claimed before-frame. The adapter creates no root state, draws no live RNG,
 * pays nothing, moves nobody and does not replace the central injury ledger.
 *
 * The central controller must reject START_ESCAPE when root.escape is non-null,
 * include FOOL_ESCAPE_WORLD_RECORD in source.worldDigest, and commit initial +
 * singleton registration only with that real START_ESCAPE transaction. The
 * optional `opening` capability is used only during replay of that same event.
 * Projections may announce the accident/participants using PUBLIC_PREVIEW, but
 * must not receive this registry, initial receipts, hosts or private intentions.
 */
export interface FoolEscapeStartFrame {
  eventId: string; revision: number; command: { type: 'START_ESCAPE' };
  before: FoolBudget; now: number; location: string;
}
export interface FoolEscapeReplayFrame {
  eventId: string; revision: number; before: FoolBudget; now: number;
  escapeBefore: FoolEscapeState; command: FoolEscapeCommand;
  environment: FoolEscapeHost['environment'];
  check: PublicCheckResult | null; randomBefore: number; randomAfter: number;
}
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const hash = (value: unknown): string => sha256Hex(stableStringify(value));
const whole = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
function requireFact(ok: unknown, reason: string): asserts ok { if (!ok) throw Error(reason); }
function requireBudget(source: FoolSource, before: FoolBudget): void {
  requireFact(before.status === 'ACTIVE' && before.sequence === 0 && whole(before.health) && before.health > 0 && before.health <= 100 &&
    whole(before.actions) && whole(before.mind) && whole(before.spirituality) && whole(before.week) && before.week >= source.budget.week &&
    gameDaysBetween(source.budget.date, before.date) === (before.week - source.budget.week) * 7, 'ESCAPE_REAL_LIVING_S0_BUDGET_REQUIRED');
}
function eventMatches(source: FoolSource, eventId: string, revision: number): boolean {
  return whole(revision) && revision > source.revision && eventId === `F208:${source.runId}:${revision}`;
}

/** Called only on the actual independently replayed START_ESCAPE action. Its
 * entry time is the actual host second, never a projection/registry timestamp. */
export function buildFoolEscapeInitial(source: FoolSource, start: FoolEscapeStartFrame): FoolEscapeInitial {
  requireBudget(source, start.before);
  requireFact(source.worldDigest === foolWorldDigest(source.materialsOrigin.checkpoint) &&
    same(start.command, { type: 'START_ESCAPE' }) && eventMatches(source, start.eventId, start.revision) &&
    whole(start.now) && start.location === FOOL_ESCAPE_WORLD_RECORD.location, 'ESCAPE_ORIGINAL_WORLD_ARRIVAL_REQUIRED');
  const world = FOOL_ESCAPE_WORLD_RECORD;
  requireFact(world.id === FOOL_ESCAPE_CASE_ID, 'ESCAPE_WORLD_CASE_MISMATCH');
  const originReceiptId = `F208-ESCAPE-ENTRY:${hash({ worldDigest: source.worldDigest, world, start, actorId: source.actorId, character: source.character })}`;
  const npc = (person: typeof world.messengerA | typeof world.messengerB | typeof world.guard, role: FoolEscapeBody['role']): FoolEscapeBody => ({
    id: person.id, role, name: person.name, age: person.age, sourceEra: 'CONTEMPORARY',
    health: person.health, injuries: [], place: person.place, walkedMetres: 0,
  });
  const actor: FoolEscapeBody = { id: source.actorId, role: 'ACTOR', name: source.character.name, age: source.character.age,
    sourceEra: 'CONTEMPORARY', health: start.before.health, place: 'DOOR', walkedMetres: 0,
    // A SliceInjury does not state a historical HP debit. Zero means no new
    // debit here, never cured. Full severity/acquired/treated bytes remain in
    // start.before.injuries and are bound by originReceiptId; central retains them.
    injuries: start.before.injuries.map(i => ({ id: i.id, kind: i.severity === 'HEAVY' ? '原有重伤' : '原有轻伤', healthLoss: 0 })) };
  return { version: 1, caseId: FOOL_ESCAPE_CASE_ID, runId: source.runId, actorId: source.actorId, originReceiptId,
    now: start.now, conditionId: world.conditionId,
    bodies: [actor, npc(world.messengerA, 'MESSENGER_A'), npc(world.messengerB, 'MESSENGER_B'), npc(world.guard, 'GUARD')],
    // These are the five independently registered scene originals. No player
    // possessions, spare medicine, duplicate body or reward item is generated.
    objects: [
      { id: world.doorId, role: 'ORIGINAL_DOOR', holderId: null, place: 'DOOR' },
      { id: world.sealedCrateId, role: 'SEALED_CRATE', holderId: null, place: 'DOOR' },
      { id: world.messengerA.satchelId, role: 'SATCHEL_A', holderId: world.messengerA.id, place: 'DOOR' },
      { id: world.messengerB.satchelId, role: 'SATCHEL_B', holderId: world.messengerB.id, place: 'DOOR' },
      { id: world.guard.batonId, role: 'BATON', holderId: world.guard.id, place: 'CORRIDOR' },
    ], consentReceiptIds: [`${originReceiptId}:consent-a`, `${originReceiptId}:consent-b`],
    guardIntentReceiptId: `${originReceiptId}:guard`, guardInstinctiveStop: world.guard.instinctiveStop };
}

/** Derive one exact host from the replayed real before-frame and root's original
 * percentile result. Independently recompute the original RNG/check; do not
 * accept a fabricated roll=1 preview or an ID-only signature. */
export function deriveFoolEscapeHost(source: FoolSource, frame: FoolEscapeReplayFrame): FoolEscapeHost {
  requireBudget(source, frame.before);
  requireFact(eventMatches(source, frame.eventId, frame.revision) && whole(frame.now) && frame.now >= frame.escapeBefore.scene.now &&
    whole(frame.randomBefore) && frame.randomBefore >= source.random.cursor && whole(frame.randomAfter) && frame.randomAfter >= frame.randomBefore &&
    frame.escapeBefore.initial.actorId === source.actorId && frame.escapeBefore.initial.runId === source.runId,
  'ESCAPE_REPLAY_FRAME_INVALID');
  const h: FoolEscapeHost = { id: `${frame.eventId}:escape-host`, eventId: frame.eventId, expectedRevision: frame.escapeBefore.revision,
    command: structuredClone(frame.command), actorId: source.actorId, alive: true, sequence: 0, now: frame.now,
    budget: { actions: frame.before.actions, spirituality: frame.before.spirituality, mind: frame.before.mind, health: frame.before.health },
    stats: structuredClone(frame.before.coreStats), environment: structuredClone(frame.environment), check: null, rngBeforeRef: null, rngAfterRef: null };
  const input = foolEscapeCheckInput(frame.escapeBefore, frame.command, h);
  if (input) {
    const rng = new DeterministicActionRandomStream(source.random.seed, frame.randomBefore);
    const expected = resolveNormalCheck({ ...input, roll: rng.nextInt(1, 100) });
    requireFact(same(expected, frame.check) && rng.cursor === frame.randomAfter, 'ESCAPE_ORIGINAL_RNG_CHECK_MISMATCH');
    h.check = expected;
    h.rngBeforeRef = `F208-ESCAPE-RNG:${hash({ seed: source.random.seed, cursor: frame.randomBefore })}`;
    h.rngAfterRef = `F208-ESCAPE-RNG:${hash({ seed: source.random.seed, cursor: frame.randomAfter })}`;
  } else requireFact(frame.check === null && frame.randomBefore === frame.randomAfter, 'ESCAPE_UNEXPECTED_RNG');
  return h;
}

/** Only independently replayed central frames are accepted. This builds the
 * expected initial and every host, then checks the exact kernel prefix itself.
 * It never grants authenticity from save-supplied IDs or a true-returning hook.
 * opening=true is solely for the central START_ESCAPE transition/replay, after
 * central has established that no instance existed before that exact event. */
export function createFoolEscapeAuthority(source: FoolSource, archivedS1: SliceState, start: FoolEscapeStartFrame,
  replayedFrames: readonly FoolEscapeReplayFrame[], opening = false): FoolEscapeAuthority {
  requireFact(validateFoolSource(archivedS1, source), 'ESCAPE_AUTHORITY_SOURCE_REPLAY_REQUIRED');
  const initial = buildFoolEscapeInitial(source, start), initialBytes = stableStringify(initial), hosts = new Map<string, string>();
  const idsMatch = (runId: string, caseId: string): boolean => runId === source.runId && caseId === initial.caseId;
  const authority: FoolEscapeAuthority = {
    verifyInitial: candidate => stableStringify(candidate) === initialBytes,
    verifyHost: candidate => hosts.get(candidate.id) === stableStringify(candidate),
    canStartCase: (runId, caseId) => opening && replayedFrames.length === 0 && idsMatch(runId, caseId),
  };
  // Internal reconstruction is tied to this exact original, not a public fresh
  // start. Only the returned authority controls the outer singleton admission.
  let expected = createFoolEscapeState(initial, { ...authority, canStartCase: idsMatch });
  let revision = start.revision, cursor = source.random.cursor;
  for (const frame of replayedFrames) {
    requireFact(frame.revision > revision && frame.randomBefore >= cursor && same(frame.escapeBefore, expected), 'ESCAPE_AUTHORITY_PREFIX_MISMATCH');
    const h = deriveFoolEscapeHost(source, frame);
    requireFact(!hosts.has(h.id), 'ESCAPE_AUTHORITY_DUPLICATE_HOST'); hosts.set(h.id, stableStringify(h));
    expected = applyFoolEscapeCommand(expected, frame.command, h, authority).state;
    revision = frame.revision; cursor = frame.randomAfter;
  }
  return authority;
}
