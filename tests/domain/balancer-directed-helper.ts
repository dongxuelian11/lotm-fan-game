import { expect } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { BALANCER_PREPARATION_IDS, type BalancerCommand } from '../../src/domain/balancer/types.js';

export const recoveryNaturalPath = 'tests/fixtures/recovery-v01620/natural.json';
export const chaosHunterNaturalPath = 'tests/fixtures/chaos-hunter-v01600/natural.json';
export const justiciarLegacyKeys = ['arbiter', 'sheriff', 'interrogator', 'judge', 'punishmentKnight', 'imperativeMage', 'chaosHunter'] as const;
let originalCache: SliceState | undefined;
/** The entire actual483-command recovery campaign, replayed through current
 * public intents. The separate complete477-command death is never truncated,
 * revived, edited or treated as this continuation's initial state. */
export function originalChaosHunter(): SliceState {
  if (!originalCache) {
    const commands = readObjectEntry<SliceIntent[]>(recoveryNaturalPath, 'commands');
    const original = readObjectEntry<SliceState>(recoveryNaturalPath, 'final');
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(recoveryNaturalPath, 'creation');
    const seed = readObjectEntry<string>(recoveryNaturalPath, 'seed');
    expect(commands).toHaveLength(483); expect(original.status).toBe('ACTIVE');
    let replay = createSliceRun(original.runId, creation, seed);
    for (const command of commands) replay = applySliceIntent(replay, command);
    expect(replay).toMatchObject({ revision: 484, week: 115, status: 'ACTIVE', health: 70, mind: 100, spirituality: 116,
      cash: 400, actionsRemaining: 1, injuryRisk: 0, random: { seed: 'arbiter-natural-v066', cursor: 310 },
      progression: { pathwayId: 'justiciar', sequence: 3, acting: 100, promotionWeek: 9 } });
    expect(replay.injuries).toEqual(original.injuries); expect(replay.injuries).toHaveLength(1);
    expect(replay.injuries[0]).toMatchObject({ acquiredRevision: 482, severity: 'HEAVY', treatedRevision: null });
    expect(Object.keys(replay.progression.mastery)).toHaveLength(15); expect(replay.progression.mastery).toEqual(original.progression.mastery);
    expect(replay.chaosHunter.promotionWeek).toBe(106);
    expect(replay.chaosHunter.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'CH3-EDRIC', enemyStatus: 'SURRENDERED', enemyHealth: 70 });
    for (const key of justiciarLegacyKeys) expect(replay[key], key).toEqual(original[key]);
    originalCache = replay; assertValidSliceState(originalCache);
  }
  return structuredClone(originalCache);
}
export const oldJusticiarRoots = (s: SliceState) => justiciarLegacyKeys.map(key => s[key]);
export type DirectedKind = 'SUCCESS' | 'GREAT_SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | 'THREE_FAILURES';
const cursors = new Map<string, number>();
/** DECLARED UNIT-only pre-journal cursor selection. It never changes an old
 * roll, source history or seed; the chosen next check is still a real d100. */
export function directedInitialCursor(s: SliceState, kind: DirectedKind): number {
  const key = `${s.random.seed}:${s.random.cursor}:${s.character.coreStats.will}:${kind}`;
  const cached = cursors.get(key); if (cached !== undefined) return cached;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const ordinaryFailure = (roll: number) => roll > chance && roll < 96;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 512; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor);
    const rolls = Array.from({ length: 3 }, () => rng.nextInt(1, 100)), roll = rolls[0]!;
    const matches = kind === 'SUCCESS' ? roll > 5 && roll <= chance : kind === 'GREAT_SUCCESS' ? roll <= 5
      : kind === 'FAILURE' ? ordinaryFailure(roll) : kind === 'GREAT_FAILURE' ? roll >= 96 : rolls.every(ordinaryFailure);
    if (matches) { cursors.set(key, cursor); return cursor; }
  }
  throw new Error(`No declared ${kind} source among 512 original-seed cursors.`);
}
/** DECLARED directed unit inputs only, before the first Balancer journal:
 * W118/date+21days, cash100000, AP/budget100 and chosen original-seed cursor.
 * Keeps actual H70/M100/S116, original482 untreated HEAVY injury, risk0,
 * all seven complete old histories and all15 old mastery values including0.
 * This is isolated unit coverage, never natural campaign-completion evidence. */
export function directedInitial3(kind: DirectedKind = 'SUCCESS', mature = true): SliceState {
  const s = originalChaosHunter(), weeks = mature ? Math.max(0, s.chaosHunter.promotionWeek! + 12 - s.week) : 0;
  s.week += weeks; s.date = addGameDays(s.date, weeks * 7); s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100;
  s.random.cursor = directedInitialCursor(s, kind); assertValidSliceState(s); return s;
}
export function step(s: SliceState, intent: SliceIntent, commands?: SliceIntent[]): SliceState {
  const next = applySliceIntent(s, intent); commands?.push(structuredClone(intent)); return next;
}
export const ba = (s: SliceState, command: BalancerCommand, commands?: SliceIntent[]) => step(s, { type: 'BALANCER', command }, commands);
export function rejectIntent(s: SliceState, intent: SliceIntent): void {
  const before = structuredClone(s), payload = structuredClone(intent);
  expect(() => applySliceIntent(s, intent), JSON.stringify(intent)).toThrow(); expect(s).toEqual(before); expect(intent).toEqual(payload);
}
export const rejectBalancer = (s: SliceState, command: unknown) => rejectIntent(s, { type: 'BALANCER', command } as SliceIntent);
export const taught = (kind: DirectedKind = 'SUCCESS', mature = true) => ba(directedInitial3(kind, mature), { type: 'LEARN_GUIDANCE' });
export function prepared(kind: DirectedKind = 'SUCCESS', labour = false): SliceState {
  let s = taught(kind); for (const taskId of BALANCER_PREPARATION_IDS) s = ba(s, { type: 'PREPARE_TASK', taskId });
  if (labour) for (let n = 0; n < 5; n++) s = ba(s, { type: 'POTION_WORK', bottleId: 'balancer-potion-1' });
  s = ba(s, { type: 'BUY_POTION', bottleId: 'balancer-potion-1' }); return ba(s, { type: 'PREPARE_PROMOTION' });
}
export const dose = { type: 'CONSUME', bottleId: 'balancer-potion-1', confirmed: true } as const;
const promotedCache = new Map<DirectedKind, SliceState>();
export function promoted(kind: DirectedKind = 'SUCCESS'): SliceState {
  if (!promotedCache.has(kind)) { const s = ba(prepared(kind), dose); expect(s.progression.sequence).toBe(2); assertValidSliceState(s); promotedCache.set(kind, s); }
  return structuredClone(promotedCache.get(kind)!);
}
function actualRecovery(s: SliceState, treat: boolean, commands?: SliceIntent[]): SliceState {
  for (let n = 0; n < 64; n++) {
    if (s.activeEvent) {
      if (s.activeEvent.id !== 'LIFE-CARE-01') throw new Error(`Unexpected recovery event ${s.activeEvent.id}`);
      s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: treat ? 'PAY' : 'DECLINE' }, commands); continue;
    }
    if (s.health === 100 && s.mind === 100 && s.spirituality === 120 && (!treat || s.injuries.length === 0)) return s;
    s = step(s, { type: 'ACTION', action: 'REST' }, commands);
  }
  throw new Error('Finite public clinic/rest recovery did not complete.');
}
/** Actual REST, real medical PAY60, later REST. No injury or resource edits. */
export const recover = (s: SliceState, commands?: SliceIntent[]) => actualRecovery(s, true, commands);
/** Resource-only comparison uses the real DECLINE choice, retaining the injury. */
export const recoverResources = (s: SliceState, commands?: SliceIntent[]) => actualRecovery(s, false, commands);
