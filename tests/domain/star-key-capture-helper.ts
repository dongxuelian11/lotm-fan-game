import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateStarKeySource } from '../../src/domain/star-key/index.js';
import { STAR_KEY_SOURCE_KEYS, STAR_KEY_ABILITY_IDS } from '../../src/domain/star-key/types.js';
import { starKeyExpectedOriginals, starKeyLifeMasteryGains } from '../../src/domain/star-key/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

export const STAR_KEY_ROOT = 'tests/fixtures/star-key-v01960';
export const STAR_KEY_SOURCE = 'tests/fixtures/planeswalker-v01740/natural.json';
export const STAR_KEY_PEACEFUL_SOURCE = 'tests/fixtures/planeswalker-v01740/original-enemy-approach.json';
export const STAR_KEY_WANDERER_DEATH_SOURCE = 'tests/fixtures/wanderer-v01500/continued.json';
export const STAR_KEY_SOURCE_SHA = '06e0bec9d3a72a41c27c96dbedafdddb023732f74a559471848f53163d144a78';
export const STAR_KEY_PEACEFUL_SHA = 'ef0fe46be50b3b8ad09b8ef8551b7fa7fe76542626ccf769a50e31f9babe73f9';
export const STAR_KEY_WANDERER_DEATH_SHA = 'aa074a2c14ca18d3199a667bbec61b47bab05b6796de83649949299c9f03ffa9';
export const STAR_KEY_PREFIX_COUNT = 701;
export const STAR_KEY_PREFIX_SHA = 'cef4fc68b02edf0328bb5b5345684f997fa4919427c5e1a4f962d454fad81a8e';
export const STAR_KEY_RAW_SOURCE_STATE_SHA = '8ae8728f0320f9ee21573321b165f5d883efc02b431f46ba612189eb6c10dfe8';
export const STAR_KEY_RAW_SOURCE_SORTED_SHA = '597c582724d70fe524a3edbc6276942fd556abbdd9b7686f1d781ad4e0a5b864';
export const CAPTURE_BOUNDARY_TIMEOUT = 180_000;
export const sameCaptureValue = (a: unknown, b: unknown): void => expect(stableStringify(a)).toBe(stableStringify(b));
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${STAR_KEY_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(STAR_KEY_SOURCE, key);
export const peacefulEntry = <T>(key: string): T => readObjectEntry<T>(STAR_KEY_PEACEFUL_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${STAR_KEY_ROOT}/summary.json`, key);

// Retain only small metadata. Large natural captures are read one top-level
// entry at a time; historical schema literals are asserted before migration.
export const boundaryIndex: Record<string, string> = JSON.parse(readFileSync(`${STAR_KEY_ROOT}/boundaries.index.json`, 'utf8'));
export const boundarySteps: Record<string, number> = JSON.parse(readFileSync(`${STAR_KEY_ROOT}/boundaries.steps.json`, 'utf8'));
export const snapshotIndex = naturalEntry<Record<string, string>>('snapshots');
export const captureCommands = naturalEntry<SliceIntent[]>('commands');
export const uniqueBoundaryFiles = [...new Set(Object.values(boundaryIndex))];
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${STAR_KEY_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${STAR_KEY_ROOT}/${name}`, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of lines) if (line.trim()) yield JSON.parse(line) as T; }
  finally { lines.close(); input.destroy(); }
}
export function currentCapture(value: unknown): SliceState {
  const state = migrateSliceState(value);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  return state;
}
export function capturedState(key: 'initial' | 'prefixFinal' | 'beforeLast' | 'final'): SliceState {
  return currentCapture(naturalEntry<unknown>(key));
}
export function capturedSnapshot(name: string): SliceState {
  const filename = snapshotIndex[name];
  if (!filename) throw new Error(`Missing actual Star Key snapshot: ${name}`);
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function boundaryFile(filename: string) {
  const path = capturePath(filename);
  return { count: readObjectEntry<number>(path, 'commandCount'),
    before: currentCapture(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: currentCapture(readObjectEntry<unknown>(path, 'final')) };
}
export function namedBoundary(name: string) {
  const filename = boundaryIndex[name];
  if (!filename) throw new Error(`Missing actual Star Key boundary: ${name}`);
  return boundaryFile(filename);
}
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'STAR_KEY') {
    const offered = view.starKey.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    expect(offered, `Missing current public control: ${JSON.stringify(intent)}`).toBeDefined();
    expect(offered!.enabled, offered!.reason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'ACTION') {
    expect(['WORK', 'REST']).toContain(intent.action); expect(view.canAct, view.actionBlockedReason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'EVENT_CHOICE') {
    expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId);
    const choice = view.activeEvent?.choices.find(row => row.id === intent.choiceId);
    expect(choice, `Missing public event choice: ${JSON.stringify(intent)}`).toBeDefined(); expect(choice!.enabled).toBe(true);
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(intent.stance).toBe('CONTROL');
    expect(view.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
  } else throw new Error(`Unexpected continuation command: ${JSON.stringify(intent)}`);
}
export function replayCaptureBoundary(name: string) {
  const save = namedBoundary(name);
  if (save.count > STAR_KEY_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
  sameCaptureValue(applySliceIntent(save.before, save.intent), save.final);
  return save;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery,
  sequence: s.progression.sequence, acting: s.progression.acting });

/** The frozen histories are exact. Only the existing PW2 room's authoritative
 * current physical fields change, and every such change must replay its journal. */
export function assertOriginalContinuity(state: SliceState, original: SliceState): void {
  for (const key of STAR_KEY_SOURCE_KEYS) {
    const current = structuredClone(state[key]);
    if (key === 'planeswalker') (current as SliceState['planeswalker']).life.site = structuredClone(original.planeswalker.life.site);
    sameCaptureValue(current, original[key]);
  }
  if (state.starKey.guidanceKnown) {
    sameCaptureValue(state.starKey.sourceHistory, Object.fromEntries(STAR_KEY_SOURCE_KEYS.map(key => [key, original[key]])));
    expect(validateStarKeySource(state)).toBe(true);
    sameCaptureValue({ site: state.planeswalker.life.site }, starKeyExpectedOriginals(state));
  } else sameCaptureValue(state.planeswalker.life.site, original.planeswalker.life.site);
  const site = state.planeswalker.life.site, old = original.planeswalker.life.site;
  for (const key of ['lamp', 'screen', 'kits', 'effect'] as const) sameCaptureValue(site[key], old[key]);
  expect(site.playerAstralLegs).toBe(old.playerAstralLegs); expect(site.parcel.astralLegs).toBe(old.parcel.astralLegs);
  sameCaptureValue({ ...site.parcel, location: old.parcel.location, ordinaryMetres: old.parcel.ordinaryMetres }, old.parcel);
  expect(state.wanderer.life.packet.location).toBe('REMOTE');
  sameCaptureValue(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of STAR_KEY_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(starKeyLifeMasteryGains(state))) mastery[id] = mastery[id]! + gain;
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    expect(round.starKeyOutcome).toBeDefined();
    for (const action of [...round.starKeyOutcome!.playerActions, ...round.starKeyOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
  }
  sameCaptureValue(state.progression.mastery, mastery);
  expect(state.random.seed).toBe(original.random.seed);
  const { coreStats, ...identity } = state.character, { coreStats: originalStats, ...originalIdentity } = original.character;
  sameCaptureValue(identity, originalIdentity);
  for (const id of Object.keys(originalStats) as (keyof typeof originalStats)[]) expect(coreStats[id]).toBe(Math.min(500, originalStats[id] + (state.progression.sequence === 1 ? 1 : 0)));
  expect(state.progression.promotionWeek).toBe(original.progression.promotionWeek);
}
