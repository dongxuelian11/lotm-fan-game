import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateKnowledgeEmperorSource } from '../../src/domain/knowledge-emperor/index.js';
import { KNOWLEDGE_EMPEROR_SOURCE_KEYS, KNOWLEDGE_EMPEROR_ABILITY_IDS } from '../../src/domain/knowledge-emperor/types.js';
import { getKnowledgeEmperorCurrentSite, knowledgeEmperorLifeMasteryGains } from '../../src/domain/knowledge-emperor/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { currentKnowledgeEmperorReplayExpectation } from '../helpers/knowledge-emperor-current-replay.js';

export const KNOWLEDGE_EMPEROR_ROOT = 'tests/fixtures/knowledge-emperor-v02000';
export const KNOWLEDGE_EMPEROR_SOURCE = 'tests/fixtures/sage-v01780/natural.json';
export const KNOWLEDGE_EMPEROR_PRIOR = 'tests/fixtures/prophecy-master-v01540/natural.json';
export const KNOWLEDGE_EMPEROR_PREFIX_COUNT = 651;
export const KNOWLEDGE_EMPEROR_INHERITED_COUNT = 507;
export const KNOWLEDGE_EMPEROR_SEED = 'pryer-natural-v048';
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Digest comparisons avoid huge state diffs while preserving complete equality.
export const sameCaptureValue = (actual: unknown, expected: unknown): void => expect(captureValueHash(actual)).toBe(captureValueHash(expected));
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${KNOWLEDGE_EMPEROR_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(KNOWLEDGE_EMPEROR_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${KNOWLEDGE_EMPEROR_ROOT}/summary.json`, key);

// Keep small metadata resident. Read large capture states one entry at a time.
export const boundaryIndex = JSON.parse(readFileSync(`${KNOWLEDGE_EMPEROR_ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
export const boundarySteps = JSON.parse(readFileSync(`${KNOWLEDGE_EMPEROR_ROOT}/boundaries.steps.json`, 'utf8')) as Record<string, number>;
export const snapshotIndex = naturalEntry<Record<string, string>>('snapshots');
export const captureCommands = naturalEntry<SliceIntent[]>('commands');
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${KNOWLEDGE_EMPEROR_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${KNOWLEDGE_EMPEROR_ROOT}/${name}`, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try { for await (const line of lines) { expect(line.length).toBeGreaterThan(0); yield JSON.parse(line) as T; } }
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
  if (!filename) throw new Error(`Missing actual Knowledge Emperor snapshot: ${name}`);
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function namedBoundary(name: string) {
  const filename = boundaryIndex[name];
  if (!filename) throw new Error(`Missing actual Knowledge Emperor boundary: ${name}`);
  const path = capturePath(filename);
  return { count: readObjectEntry<number>(path, 'commandCount'), before: currentCapture(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: currentCapture(readObjectEntry<unknown>(path, 'final')) };
}
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'KNOWLEDGE_EMPEROR') {
    const offered = view.knowledgeEmperor.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    expect(offered, `Missing current public control: ${JSON.stringify(intent)}`).toBeDefined();
    expect(offered!.enabled, offered!.reason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'ACTION') {
    const ordinary = intent.action === 'WORK' || intent.action === 'REST';
    const clinic = intent.action === 'INVESTIGATE' && intent.targetId === 'CARE-ACCESS-01' && !state.careKnown;
    expect(ordinary || clinic).toBe(true); expect(view.canAct, view.actionBlockedReason ?? '').toBe(true);
    expect(view.knowledgeEmperor.insideCase).toBe(false); expect(state.combat).toBeNull(); expect(state.knowledgeEmperor.preparedWeek).toBeNull();
  } else if (intent.type === 'EVENT_CHOICE') {
    expect(state.activeEvent?.instanceId).toBe(intent.eventInstanceId);
    expect(view.activeEvent?.choices.find(row => row.id === intent.choiceId)?.enabled).toBe(true);
  } else if (intent.type === 'COMBAT_ROUND') {
    expect(view.status).toBe('ACTIVE'); expect(view.activeEvent).toBeNull(); expect(intent.stance).toBe('CONTROL');
    expect(view.combat?.stances.some(stance => stance.id === intent.stance)).toBe(true);
  } else throw new Error(`Unexpected continuation command: ${JSON.stringify(intent)}`);
}
export function replayCaptureBoundary(name: string) {
  const save = namedBoundary(name);
  if (save.count > KNOWLEDGE_EMPEROR_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
  // Restored boundaries retain historical prose. Only replaying LEARN_GUIDANCE
  // itself creates the exact current guidance record.
  const expected = save.intent.type === 'KNOWLEDGE_EMPEROR' && save.intent.command.type === 'LEARN_GUIDANCE'
    ? currentKnowledgeEmperorReplayExpectation(save.final) : save.final;
  sameCaptureValue(applySliceIntent(save.before, save.intent), expected);
  return save;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery,
  sequence: s.progression.sequence, acting: s.progression.acting });

/** Old roots never become a live registry. Actual subsequent movement and costs
 * occur in the new life/encounter roots, preserving all eight source histories. */
export function assertOriginalContinuity(state: SliceState, original: SliceState): void {
  for (const key of KNOWLEDGE_EMPEROR_SOURCE_KEYS) sameCaptureValue(state[key], original[key]);
  const site = getKnowledgeEmperorCurrentSite(state), old = original.sage.encounter.currentSite!;
  if (state.knowledgeEmperor.guidanceKnown) {
    sameCaptureValue(state.knowledgeEmperor.sourceHistory, Object.fromEntries(KNOWLEDGE_EMPEROR_SOURCE_KEYS.map(key => [key, original[key]])));
    sameCaptureValue(state.knowledgeEmperor.sourceScene!.originals, { site: old, workshop: original.scrollProfessor.workshop });
    expect(validateKnowledgeEmperorSource(state)).toBe(true);
  }
  for (const key of ['source', 'conduit', 'materials'] as const) sameCaptureValue(site[key], old[key]);
  expect(site.archive.id).toBe(old.archive.id); expect(site.archive.location).toBe(old.archive.location);
  expect(site.record!.id).toBe(old.record!.id); expect(site.record!.location).toBe(old.record!.location);
  expect(site.body).toBe('SOLID'); expect(site.form.active).toBe(false);
  expect(site.iris!.id).toBe(old.iris!.id); expect(site.iris!.energy).toBeLessThanOrEqual(old.iris!.energy);
  expect(site.iris!.travelMetres).toBeGreaterThanOrEqual(old.iris!.travelMetres);
  expect(site.playerTravelMetres).toBeGreaterThanOrEqual(old.playerTravelMetres);
  sameCaptureValue(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of KNOWLEDGE_EMPEROR_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(knowledgeEmperorLifeMasteryGains(state))) mastery[id] = Math.min(500, mastery[id]! + gain);
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    expect(round.knowledgeEmperorOutcome).toBeDefined();
    for (const action of [...round.knowledgeEmperorOutcome!.playerActions, ...round.knowledgeEmperorOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
  }
  sameCaptureValue(state.progression.mastery, mastery);
  const { coreStats, ...identity } = state.character, { coreStats: oldStats, ...oldIdentity } = original.character;
  sameCaptureValue(identity, oldIdentity);
  for (const key of Object.keys(oldStats) as (keyof typeof oldStats)[]) expect(coreStats[key]).toBe(Math.min(500, oldStats[key] + (state.progression.sequence === 1 ? 1 : 0)));
  expect(state.runId).toBe(original.runId); expect(state.random.seed).toBe(KNOWLEDGE_EMPEROR_SEED);
  expect(state.progression.promotionWeek).toBe(original.progression.promotionWeek);
}
