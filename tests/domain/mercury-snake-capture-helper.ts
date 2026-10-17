import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateMercurySnakeSource } from '../../src/domain/mercury-snake/index.js';
import { MERCURY_SNAKE_SOURCE_KEYS, MERCURY_SNAKE_ABILITY_IDS } from '../../src/domain/mercury-snake/types.js';
import { MERCURY_SNAKE_CASE_IDS, getMercurySnakeCurrentSite, mercurySnakeLifeMasteryGains, validateMercurySnakeCurrentSite } from '../../src/domain/mercury-snake/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { MERCURY_SNAKE_CAPTURE_EVIDENCE, type MercurySnakeObservedCapture } from './mercury-snake-capture-evidence.js';

export const MERCURY_SNAKE_ROOT = 'tests/fixtures/mercury-snake-v02040';
export const MERCURY_SNAKE_SOURCE = 'tests/fixtures/fate-prophet-v01820/natural.json';
export const MERCURY_SNAKE_PRIOR = 'tests/fixtures/chaos-walker-v01580/natural.json';
export const MERCURY_SNAKE_PREFIX_COUNT = 703;
export const MERCURY_SNAKE_INHERITED_COUNT = 551;
export const MERCURY_SNAKE_SEED = 'monster-natural-v060';
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Compare digests, never ask Vitest to retain/render two multi-megabyte trees. */
export const sameCaptureValue = (actual: unknown, expected: unknown): void => expect(captureValueHash(actual)).toBe(captureValueHash(expected));
export function observedCapture(): MercurySnakeObservedCapture {
  if (!MERCURY_SNAKE_CAPTURE_EVIDENCE.observed) throw new Error('PENDING: no coordinator-frozen stage204 capture.');
  return MERCURY_SNAKE_CAPTURE_EVIDENCE.observed;
}
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${MERCURY_SNAKE_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(MERCURY_SNAKE_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${MERCURY_SNAKE_ROOT}/summary.json`, key);
export function captureMetadata() {
  observedCapture();
  return {
    boundaries: JSON.parse(readFileSync(`${MERCURY_SNAKE_ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>,
    steps: JSON.parse(readFileSync(`${MERCURY_SNAKE_ROOT}/boundaries.steps.json`, 'utf8')) as Record<string, number>,
    snapshots: naturalEntry<Record<string, string>>('snapshots'), commands: naturalEntry<SliceIntent[]>('commands'),
  };
}
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${MERCURY_SNAKE_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${MERCURY_SNAKE_ROOT}/${name}`, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of lines) { expect(line.length).toBeGreaterThan(0); yield JSON.parse(line) as T; } }
  finally { lines.close(); input.destroy(); }
}
export function currentCapture(value: unknown): SliceState {
  const state = migrateSliceState(value);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
export function originalLivingPrefix(): SliceState { return currentCapture(sourceEntry<unknown>('final')); }
export function capturedState(key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final'): SliceState {
  observedCapture(); return currentCapture(naturalEntry<unknown>(key));
}
export function capturedSnapshot(name: string): SliceState {
  const filename = captureMetadata().snapshots[name];
  if (!filename) throw new Error(`No actual Mercury Snake snapshot: ${name}`);
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function namedBoundary(name: string) {
  const filename = captureMetadata().boundaries[name];
  if (!filename) throw new Error(`No actual Mercury Snake boundary: ${name}`);
  const path = capturePath(filename);
  return { path, count: readObjectEntry<number>(path, 'commandCount'), before: currentCapture(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: currentCapture(readObjectEntry<unknown>(path, 'final')) };
}
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'CONTINUE_LIFE') {
    expect(state.status).toBe('SLICE_COMPLETE'); expect(state.ending?.kind).not.toBe('DEATH'); expect(state.caseArchive).toHaveLength(0); return;
  }
  expect(state.status).toBe('ACTIVE');
  if (intent.type === 'MERCURY_SNAKE') {
    const offered = view.mercurySnake.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    expect(offered, `Missing actual public control: ${JSON.stringify(intent)}`).toBeDefined();
    expect(offered!.enabled, offered!.reason ?? JSON.stringify(intent)).toBe(true);
    const life = view.mercurySnake.life.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    if (life) {
      if ('caseId' in intent.command) expect(intent.command.caseId).toBe(MERCURY_SNAKE_CASE_IDS.find(id => state.mercurySnake.life.cases[id].status !== 'RESOLVED'));
      if (!['OBSERVE', 'REPORT', 'REFLECT'].includes(intent.command.type)) expect(life.preferredAction).toBe(true);
      if (intent.command.type === 'PREPARE') expect(intent.command.method).toBe('ABILITY');
    }
    if (intent.command.type === 'SET_COMBAT_POLICY') expect(intent.command.policy).toBe('ALL');
  } else if (intent.type === 'ACTION') {
    expect(['WORK', 'REST']).toContain(intent.action); expect(view.canAct, view.actionBlockedReason ?? '').toBe(true);
    expect(view.mercurySnake.insideCase).toBe(false); expect(state.combat).toBeNull(); expect(state.mercurySnake.preparedWeek).toBeNull();
  } else if (intent.type === 'EVENT_CHOICE') {
    expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId);
    expect(view.activeEvent?.choices.find(row => row.id === intent.choiceId)?.enabled).toBe(true);
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(view.activeEvent).toBeNull(); expect(intent.stance).toBe('CONTROL'); expect(intent.winnerPolicy).toBe('HOLD');
    expect(view.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
    expect(state.combat?.encounterId).toBe('MERCURY_SNAKE_DISPUTE'); expect(state.mercurySnake.encounter.policy).toBe('ALL');
  } else throw new Error(`Unexpected continuation command: ${JSON.stringify(intent)}`);
}
export function replayCaptureBoundary(name: string) {
  const save = namedBoundary(name);
  if (save.count > MERCURY_SNAKE_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
  sameCaptureValue(applySliceIntent(save.before, save.intent), save.final); return save;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery,
  sequence: s.progression.sequence, acting: s.progression.acting,
  finance: { weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier,
    nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit, pulse: s.pulse, billAmount: s.billAmount } });
export const sourceOriginals = (s: SliceState) => ({ site: s.chaosWalker.life, operation: s.fateProphet.life.operation, luck: s.winner.luck });
export const currentOriginals = (s: SliceState) => ({
  site: s.mercurySnake.promotionWeek === null ? s.chaosWalker.life : getMercurySnakeCurrentSite(s),
  operation: s.mercurySnake.promotionWeek === null ? s.fateProphet.life.operation : s.mercurySnake.life.operation,
  luck: s.mercurySnake.guidanceKnown ? s.mercurySnake.luck : s.winner.luck,
});
export const capturePublicBody = (s: SliceState) => {
  const life = s.mercurySnake.life, e = s.mercurySnake.encounter;
  return { ...captureBody(s), activeEvent: s.activeEvent?.instanceId ?? null, current: currentOriginals(s),
    life: { activeCase: life.activeCase, conditionVersion: life.conditionVersion, captured: life.captured, pending: life.pending,
      pieces: life.pieces, volunteerMindSpent: life.volunteerMindSpent, currentAttempt: life.activeCase ? life.cases[life.activeCase].attempts[0] ?? null : null },
    encounter: { status: e.status, policy: e.policy, currentSite: e.currentSite, piece: e.piece, plates: e.plates,
      restart: e.restart, anchor: e.anchor, conditionVersion: e.conditionVersion, playerLocalMetres: e.playerLocalMetres, terminal: e.terminal } };
};
export function actualLifeAbilityUse(s: SliceState) {
  const life = s.mercurySnake.life, attempts = MERCURY_SNAKE_CASE_IDS.flatMap(id => life.cases[id].attempts);
  return Object.fromEntries(MERCURY_SNAKE_ABILITY_IDS.map((id, index) => {
    const field = index === 0 ? 'restartTier' : 'anchorTier';
    return [id, { paidAttempts: attempts.filter(a => a[field] !== null).length,
      castingSuccesses: attempts.filter(a => a[field] === 'SUCCESS' || a[field] === 'GREAT_SUCCESS').length,
      actualApplications: attempts.filter(a => a.appliedAbilityIds.includes(id)).length,
      reportedApplications: MERCURY_SNAKE_CASE_IDS.filter(key => life.cases[key].status === 'RESOLVED').flatMap(key => life.cases[key].attempts).filter(a => a.appliedAbilityIds.includes(id)).length }];
  }));
}
export function actualCombatAbilityUse(s: SliceState, original: SliceState) {
  const actions = s.combatHistory.slice(original.combatHistory.length).flatMap(round => {
    expect(round.mercurySnakeOutcome).toBeDefined(); return [...round.mercurySnakeOutcome!.playerActions, ...round.mercurySnakeOutcome!.enemyActions];
  });
  return Object.fromEntries(MERCURY_SNAKE_ABILITY_IDS.map((id, index) => {
    const selected = actions.filter(a => a.actor === 'PLAYER' && a.id === id), kind = index === 0 ? 'RESTART' : 'ANCHOR';
    const applied = actions.flatMap(a => a.windowsApplied).filter(w => w.kind === kind);
    return [id, { selectedSlots: selected.length, paidAttempts: selected.filter(a => a.attempted).length,
      castingSuccesses: selected.filter(a => a.succeeded).length, preparedWindows: selected.filter(a => a.windowGranted?.kind === kind).length,
      actualApplications: applied.length, contributionReduction: applied.reduce((n, a) => n + a.amount, 0),
      masteryApplications: actions.filter(a => a.masteryApplied.includes(id)).length,
      spiritualitySpent: selected.reduce((n, a) => n + a.paidCost, 0), mindSpent: selected.reduce((n, a) => n + a.mindCost, 0) }];
  }));
}
/** Eight historical roots remain evidence. Only one continued site/luck is live. */
export function assertOriginalContinuity(state: SliceState, original: SliceState): void {
  for (const key of MERCURY_SNAKE_SOURCE_KEYS) sameCaptureValue(state[key], original[key]);
  const old = sourceOriginals(original), now = currentOriginals(state), life = state.mercurySnake.life;
  if (state.mercurySnake.guidanceKnown) {
    sameCaptureValue(state.mercurySnake.sourceHistory, Object.fromEntries(MERCURY_SNAKE_SOURCE_KEYS.map(key => [key, original[key]])));
    sameCaptureValue(state.mercurySnake.sourceScene!.originals, old); expect(validateMercurySnakeSource(state)).toBe(true);
  }
  if (state.mercurySnake.promotionWeek !== null) {
    expect(life.sourceWeek).toBe(state.mercurySnake.promotionWeek); expect(validateMercurySnakeCurrentSite(now.site, old)).toBe(true);
  }
  sameCaptureValue(now.operation, old.operation); sameCaptureValue(now.luck, old.luck);
  expect(Object.hasOwn(now.site, 'playerEnergy')).toBe(false); expect(Object.hasOwn(now.site.volunteer, 'energy')).toBe(false);
  expect(now.site.playerTravelMetres).toBeGreaterThanOrEqual(old.site.playerTravelMetres); expect(now.site.clockSeconds).toBeGreaterThanOrEqual(old.site.clockSeconds);
  expect(life.volunteerMindSpent).toBe(MERCURY_SNAKE_CASE_IDS.flatMap(id => life.cases[id].attempts).reduce((n, a) => n + a.volunteerMindSpent, 0));
  expect(now.site.volunteer.mind).toBe(old.site.volunteer.mind - life.volunteerMindSpent);
  expect(state.fateProphet.encounter).toMatchObject({ targetId: 'FP2-ROWAN', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 83 });
  sameCaptureValue(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  sameCaptureValue(state.seer.completedSources.slice(0, original.seer.completedSources.length), original.seer.completedSources);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of MERCURY_SNAKE_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(mercurySnakeLifeMasteryGains(state))) mastery[id] = Math.min(500, mastery[id]! + gain);
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    expect(round.mercurySnakeOutcome).toBeDefined(); expect(round.mercurySnakeOutcome!.winnerPolicy).toBe('HOLD');
    for (const action of [...round.mercurySnakeOutcome!.playerActions, ...round.mercurySnakeOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
  }
  sameCaptureValue(state.progression.mastery, mastery);
  const { coreStats, ...identity } = state.character, { coreStats: oldStats, ...oldIdentity } = original.character;
  sameCaptureValue(identity, oldIdentity);
  for (const key of Object.keys(oldStats) as (keyof typeof oldStats)[]) expect(coreStats[key]).toBe(Math.min(500, oldStats[key] + (state.progression.sequence === 1 ? 1 : 0)));
  expect(state.runId).toBe(original.runId); expect(state.random.seed).toBe(MERCURY_SNAKE_SEED);
  expect(state.progression.promotionWeek).toBe(original.progression.promotionWeek);
}
