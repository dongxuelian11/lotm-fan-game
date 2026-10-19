import { expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateDarkAngelSource } from '../../src/domain/dark-angel/index.js';
import { DARK_ANGEL_SOURCE_KEYS, DARK_ANGEL_ABILITY_IDS } from '../../src/domain/dark-angel/types.js';
import { getDarkAngelCurrentSite, darkAngelLifeMasteryGains } from '../../src/domain/dark-angel/life.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

export const DARK_ANGEL_ROOT = 'tests/fixtures/dark-angel-v02010';
export const DARK_ANGEL_SOURCE = 'tests/fixtures/elder-v01790/natural.json';
export const DARK_ANGEL_PRIOR = 'tests/fixtures/three-headed-templar-v01550/natural.json';
export const DARK_ANGEL_PREFIX_COUNT = 615;
export const DARK_ANGEL_INHERITED_COUNT = 500;
export const DARK_ANGEL_SEED = 'secret-supplicant-natural-v051';
export const captureValueHash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
export const insertionOrderHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Digest comparisons avoid huge state diffs while preserving complete equality.
export const sameCaptureValue = (actual: unknown, expected: unknown): void => expect(captureValueHash(actual)).toBe(captureValueHash(expected));
export const naturalEntry = <T>(key: string): T => readObjectEntry<T>(`${DARK_ANGEL_ROOT}/natural.json`, key);
export const sourceEntry = <T>(key: string): T => readObjectEntry<T>(DARK_ANGEL_SOURCE, key);
export const summaryEntry = <T>(key: string): T => readObjectEntry<T>(`${DARK_ANGEL_ROOT}/summary.json`, key);

// Keep small metadata resident. Read large capture states one entry at a time.
export const boundaryIndex = JSON.parse(readFileSync(`${DARK_ANGEL_ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
export const boundarySteps = JSON.parse(readFileSync(`${DARK_ANGEL_ROOT}/boundaries.steps.json`, 'utf8')) as Record<string, number>;
export const snapshotIndex = naturalEntry<Record<string, string>>('snapshots');
export const captureCommands = naturalEntry<SliceIntent[]>('commands');
export function capturePath(filename: string): string {
  if (filename !== basename(filename) || !filename.endsWith('.json')) throw new Error(`Nonlocal capture reference: ${filename}`);
  return `${DARK_ANGEL_ROOT}/${filename}`;
}
export async function captureFileHash(path: string): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
export async function* captureJsonLines<T>(name: 'commands.jsonl' | 'public.jsonl'): AsyncGenerator<T> {
  const input = createReadStream(`${DARK_ANGEL_ROOT}/${name}`, { encoding: 'utf8' });
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
  if (!filename) throw new Error(`Missing actual Dark Angel snapshot: ${name}`);
  return currentCapture(JSON.parse(readFileSync(capturePath(filename), 'utf8')));
}
export function namedBoundary(name: string) {
  const filename = boundaryIndex[name];
  if (!filename) throw new Error(`Missing actual Dark Angel boundary: ${name}`);
  const path = capturePath(filename);
  return { path, count: readObjectEntry<number>(path, 'commandCount'), before: currentCapture(readObjectEntry<unknown>(path, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(path, 'lastIntent'), final: currentCapture(readObjectEntry<unknown>(path, 'final')) };
}
export function assertPublicCaptureControl(state: SliceState, intent: SliceIntent): void {
  expect(validateSlicePayload(intent), JSON.stringify(intent)).toBe(true);
  const view = projectSliceState(state);
  if (intent.type === 'DARK_ANGEL') {
    const offered = view.darkAngel.actions.find(row => stableStringify(row.command) === stableStringify(intent.command));
    expect(offered, `Missing current public control: ${JSON.stringify(intent)}`).toBeDefined();
    expect(offered!.enabled, offered!.reason ?? JSON.stringify(intent)).toBe(true);
  } else if (intent.type === 'ACTION') {
    expect(intent.action === 'WORK' || intent.action === 'REST').toBe(true);
    expect(view.canAct, view.actionBlockedReason ?? '').toBe(true);
    expect(view.darkAngel.insideCase).toBe(false); expect(state.combat).toBeNull(); expect(state.darkAngel.preparedWeek).toBeNull();
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
  if (save.count > DARK_ANGEL_PREFIX_COUNT) assertPublicCaptureControl(save.before, save.intent);
  sameCaptureValue(applySliceIntent(save.before, save.intent), save.final);
  return save;
}
export const captureBody = (s: SliceState) => ({ status: s.status, revision: s.revision, week: s.week, date: s.date,
  H: s.health, M: s.mind, S: s.spirituality, cash: s.cash, AP: s.actionsRemaining, pollution: s.seer.pollution,
  injuries: s.injuries, injuryRisk: s.injuryRisk, random: s.random, mastery: s.progression.mastery,
  sequence: s.progression.sequence, acting: s.progression.acting,
  finance: { weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier,
    nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit,
    pulse: s.pulse, billAmount: s.billAmount } });

export const sourceOriginals = (s: SliceState) => ({ site: s.threeHeadedTemplar.life,
  operation: s.elder.life.operation, grazing: s.shepherd.grazing, reserve: s.roseBishop.reserve,
  shepherdPromotionWeek: s.shepherd.promotionWeek });
export const currentOriginals = (s: SliceState) => ({ site: getDarkAngelCurrentSite(s),
  operation: s.darkAngel.promotionWeek === null ? s.elder.life.operation : s.darkAngel.life.operation,
  grazing: s.darkAngel.encounter.grazing ?? s.shepherd.grazing,
  reserve: s.darkAngel.encounter.reserve ?? s.roseBishop.reserve,
  shepherdPromotionWeek: s.shepherd.promotionWeek });

/** Old roots are immutable evidence. Actual spending and movement continue in
 * the new roots without refilling returned kits, released souls or original spirits. */
export function assertOriginalContinuity(state: SliceState, original: SliceState): void {
  for (const key of DARK_ANGEL_SOURCE_KEYS) sameCaptureValue(state[key], original[key]);
  const old = original.threeHeadedTemplar.life, now = currentOriginals(state), site = now.site;
  if (state.darkAngel.guidanceKnown) {
    sameCaptureValue(state.darkAngel.sourceHistory, Object.fromEntries(DARK_ANGEL_SOURCE_KEYS.map(key => [key, original[key]])));
    sameCaptureValue(state.darkAngel.sourceScene!.originals, sourceOriginals(original));
    expect(validateDarkAngelSource(state)).toBe(true);
  }
  expect(Object.hasOwn(site, 'playerEnergy')).toBe(false);
  sameCaptureValue(now.operation.materials, original.elder.life.operation.materials);
  expect(now.operation).toMatchObject({ residualPressure: 3, contained: true });
  expect(now.operation.sealWear).toBeGreaterThanOrEqual(original.elder.life.operation.sealWear);
  for (const key of ['leftBox', 'rightBox', 'farSeal'] as const) sameCaptureValue(site[key], old[key]);
  for (const key of ['id', 'owner', 'quantity'] as const) sameCaptureValue(site.card[key], old.card[key]);
  for (const key of ['id', 'name', 'age', 'alive', 'willing'] as const) sameCaptureValue(site.owner[key], old.owner[key]);
  expect(site.playerTravelMetres).toBeGreaterThanOrEqual(old.playerTravelMetres);
  expect(Object.keys(site.spirits)).toEqual(Object.keys(old.spirits));
  for (const id of ['THT3-HELENA', 'THT3-ROLAND'] as const) {
    const prior = old.spirits[id], spirit = site.spirits[id];
    expect(spirit.spirituality).toBeLessThanOrEqual(prior.spirituality);
    expect(spirit.integrity).toBeLessThanOrEqual(prior.integrity);
    sameCaptureValue(spirit.history.slice(0, prior.history.length), prior.history);
    sameCaptureValue(spirit.selectedAbilities, prior.selectedAbilities);
    expect(spirit.deathRecordId).toBe(prior.deathRecordId); expect(spirit.casketId).toBe(prior.casketId);
    if (prior.interrupted) expect(spirit.interrupted).toBe(true);
  }
  sameCaptureValue(now.grazing, original.shepherd.grazing);
  sameCaptureValue({ ...now.reserve, points: original.roseBishop.reserve.points }, original.roseBishop.reserve);
  expect(now.reserve.points).toBeLessThanOrEqual(original.roseBishop.reserve.points);
  sameCaptureValue(state.combatHistory.slice(0, original.combatHistory.length), original.combatHistory);
  const mastery = { ...original.progression.mastery };
  if (state.progression.sequence === 1) {
    for (const id of DARK_ANGEL_ABILITY_IDS) mastery[id] = 0;
    for (const [id, gain] of Object.entries(darkAngelLifeMasteryGains(state))) mastery[id] = Math.min(500, mastery[id]! + gain);
  }
  for (const round of state.combatHistory.slice(original.combatHistory.length)) {
    expect(round.darkAngelOutcome).toBeDefined();
    for (const action of [...round.darkAngelOutcome!.playerActions, ...round.darkAngelOutcome!.enemyActions]) {
      for (const id of action.masteryApplied) { expect(Object.hasOwn(mastery, id)).toBe(true); mastery[id] = Math.min(500, mastery[id]! + 8); }
    }
  }
  sameCaptureValue(state.progression.mastery, mastery);
  const { coreStats, ...identity } = state.character, { coreStats: oldStats, ...oldIdentity } = original.character;
  sameCaptureValue(identity, oldIdentity);
  for (const key of Object.keys(oldStats) as (keyof typeof oldStats)[]) expect(coreStats[key]).toBe(Math.min(500, oldStats[key] + (state.progression.sequence === 1 ? 1 : 0)));
  expect(state.runId).toBe(original.runId); expect(state.random.seed).toBe(DARK_ANGEL_SEED);
  expect(state.progression.promotionWeek).toBe(original.progression.promotionWeek);
}
