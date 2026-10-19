import { historicalInactiveHermitPublic, type HistoricalInactiveHermitProjection } from './inactive-hermit-public-capture.js';
import { assertEmptyHermitState, assertEmptyHermitPublic } from './empty-hermit-capture.js';
import { assertEmptyHangedManState, assertEmptyHangedManPublic } from './empty-hanged-man-capture.js';
import { assertEmptyAbyssState, assertEmptyAbyssPublic } from './empty-abyss-capture.js';
import { assertEmptyChainedState, assertEmptyChainedPublic } from './empty-chained-capture.js';
import { assertEmptyDemonessState, assertEmptyDemonessPublic, historicalInactiveCalamitySourcePublic } from './empty-demoness-capture.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { assertEmptyErrorAscentState, assertEmptyErrorAscentPublic } from './empty-error-ascent-capture.js';
import { assertEmptyTwilightGiantState, assertEmptyTwilightGiantPublic } from './empty-twilight-giant-capture.js';
import { assertEmptyDoorState, assertEmptyDoorPublic } from './empty-death-capture.js';

/** Independent immutable NEW217 reader. Never imports/executes the producer,
 * gameplay replay, migration, SQLite or controlled scenario builders.
 * Current comparisons independently verify the named introduced empty roots. */
export const ROOT = process.env.DEATH_CAPTURE_ROOT ?? 'tests/fixtures/death-v02170';
export const SOURCE = 'tests/fixtures/pale-emperor-v01950/natural.json';
export const SOURCE_SHA = '14be49645e7fa18b4127c7ec34b39875eff1302fbba8052b9037ed149a42d66c';
export const PREFIX = 1038, NEW_COMMANDS = 103, FINAL_COMMAND = 1141;
export const CAPTURE_SCHEMA = 214, CAPTURE_CONTENT = 'death-v214';
export const MANIFEST = 'test-inputs/death-v02170-capture-files.json';
export const MANIFEST_SHA = '4e2232144263b7ae2272dd9518e3369de82db6c28b32c967bf3a1de12e860289';
export const FORMAT = 'NEW217_RESTORED195_LIVING1038_DURABLE_PUBLIC_ACTION_BOUNDARY_V1';
export const PREFIX_ENCODING = 'JSON_STRINGIFY_UTF8_ORIGINAL_OBJECT_KEY_ORDER';
export const STATE_ENCODING = 'STABLE_STRINGIFY_CANONICAL_JSON_UTF8';
export const PINS = {
  "prefixSha256": "7441863b7eef57b05b2ee7f35f7f9f0d052555b82a2727ef4c1d54219973a9a4",
  "inputFreezeSha256": "58823cd4d29105ecce6133ba9148bf30ec127dd1e0dd42ec5cce0c01fd1a522a",
  "runtimeFreezeSha256": "71f775b8764891e2441b000751701a6db53d5a5f42dbf19ab423e193a90577dd",
  "initialStateSha256": "1de3e8f4854fd69a48602d00f4dbace7523ec9a43c7daa93588cbd43d4ce4c73",
  "finalStateSha256": "5c0d46adcd4fef32385ffc25f53a7d31b712c72dec5b1c3473efb39e986bf7b4",
  "initialPublicSha256": "ab84ccde9a952fe6a6627d8a65f82e1471fa35d2e309275e3980ad43ecbde3e1",
  "initialGlobalPublicSha256": "662152aab887441335198b707d7ef390a486d203c171e381afa9dd788fb485e4",
  "initialRandomSha256": "214594149ce3eb78a3dd647eb0758be435836a8923a45bfff77a10a50f169b4d",
  "predecessorSha256": "3041b0b5c354d15e39bda7598974bda20eb4956e1f54cd5f94d5f5cda9bde1f9",
  "createdAt": "2026-10-18T09:12:02.498Z",
  "originalStateSha256": "171748e310a3f2f52f96d710d01610fa3aa296e516e87fe29f2d0ca7d1709276",
  "checkpointEnvelopeSha256": "aa13b369c23c105f5ec71a5f6174b68b9af565766ab046117a2b8ba9da250f9a",
  "finalPublicSha256": "223277c50a3fc4f5c0f99f61ac3459a24483cc7f0def62556ba22ec6b6260a24",
  "finalGlobalPublicSha256": "01f186eab9601a9564b04754612cf910365c52e06c4a6ced93dc887caa450a03",
  "finalRandomSha256": "1ff71f602e4f1018bddec845acb83721aed7f76b0d0745bd2115b266c867d063",
  "initialPolicySha256": "d5bd03c960132f8999b70b4191e4ad6cc77e1802ad3535a668dd4fb71c12114e",
  "finalPolicySha256": "a100bf81cddce76eccb81784a4ef4f879f5e889f88ec46a48fa2aeeaa3a21e3e",
  "stage": "NATURAL_FINITE_DEATH_REPORTED",
  "reason": "The finite actual incident was honestly reported; all failed attempts and costs remain",
  "sqliteCommandCounts": [
    1039,
    1128,
    1141
  ],
  "boundaryCommandCounts": [
    1039,
    1040,
    1041,
    1044,
    1047,
    1059,
    1060,
    1061,
    1062,
    1063,
    1064,
    1065,
    1066,
    1067,
    1068,
    1069,
    1070,
    1071,
    1072,
    1073,
    1074,
    1075,
    1078,
    1079,
    1080,
    1081,
    1086,
    1087,
    1088,
    1089,
    1095,
    1096,
    1097,
    1098,
    1099,
    1105,
    1106,
    1107,
    1108,
    1109,
    1110,
    1115,
    1116,
    1117,
    1118,
    1123,
    1127,
    1128,
    1130,
    1131,
    1132,
    1133,
    1134,
    1135,
    1136,
    1137,
    1138,
    1139,
    1140,
    1141
  ]
} as const;
export const POLICY_DEFINITION = {
  "id": "NEW217_SAME_THREE_ORIGINALS_OWNED_PUBLIC_V1",
  "startWeek": 3323,
  "defaultObservationActions": 32,
  "selectedBoundaryLimit": 64,
  "selectedBoundaryTerminalReserve": 1,
  "carrierLimit": 3,
  "selection": "EXACT_ENABLED_RUNTIME_PREFERRED_DEATH_CONTROL",
  "ordinary": "ACTUAL_WORK_REST_CLINIC_NEXT_WEEK_AND_PHYSICAL_EXITS",
  "epilogue": "TWO_FINITE_TECHNIQUE_ATTEMPTS_ACTUAL_APPLICATION_OR_ORDINARY_EXIT_HONEST_REPORT",
  "failure": "RETAIN_ACTUAL_COSTS_INJURIES_POLLUTION_REMAINS_AND_TERMINAL_DEATH",
  "observationLimit": "RESUMABLE_CONTROLLED_STOP_NEVER_PRODUCT_FAILURE",
  "noReroll": true
} as const;

export interface FilePin { bytes: number; sha256: string }
export interface CaptureManifest { format: string; files: Array<FilePin & { file: string }> }
export interface Policy {
  phase: string; week: number; doses: number; carriers: string[]; consumedCompounds: string[];
  epilogueAttempted: string[]; reported: boolean;
  loop: { key: string | null; repetitions: number; recent: string[]; cycleRepeats: number };
}
export interface Outcome {
  status: SliceState['status']; sequence: SliceProjection['progression']['sequence']; promoted: boolean; guidance: boolean;
}
export interface Row {
  commandCount: number; intent: SliceIntent; commandSha256: string; reason: string; publicLabel: string; publicCost: string;
  startedAt: string; elapsedMilliseconds: number; revision: number; week: number;
  beforeStateSha256: string; afterStateSha256: string; publicBeforeSha256: string; publicAfterSha256: string;
  globalPublicBeforeSha256: string; globalPublicAfterSha256: string;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; randomBeforeSha256: string; randomAfterSha256: string;
  policyBeforeSha256: string; policyAfterSha256: string; selectionOutcome: Outcome;
  receipts: { checks: unknown[]; finance: unknown[]; notes: unknown[] }; capture: FilePin & { file: string };
}
export interface Boundary extends FilePin { file: string; kind: string; commandCount: number }
export interface Action {
  commandCount: number; beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; publicBefore: CapturedPublic; public: CapturedPublic;
  globalPublicBefore: SliceProjection; globalPublic: SliceProjection; policyBefore: Policy; policyAfter: Policy;
  audit: Omit<Row, 'capture' | 'elapsedMilliseconds'> & { elapsedMilliseconds: null };
}
export interface Checkpoint {
  format: string; source: string; sourceSha256: string; prefixSha256: string; prefixHashEncoding: string; stateHashEncoding: string;
  inputFreezeSha256: string; runtimeFreezeSha256: string; policyDefinition: typeof POLICY_DEFINITION; policy: Policy;
  migration: { originalStateSha256: string; migratedStateSha256: string; fromSchema: number; toSchema: number };
  createdAt: string; predecessorSha256: string; commandCount: number; commands: SliceIntent[]; rows: Row[]; boundaries: Boundary[];
  state: SliceState; initialStateSha256: string; finalStateSha256: string; initialPublicSha256: string; publicStateSha256: string;
  initialGlobalPublicSha256: string; globalPublicStateSha256: string; initialRandomSha256: string;
  pending: unknown | null; terminal: { stage: string; reason: string } | null;
}
export type OriginalState = Omit<SliceState, 'schemaVersion' | 'contentVersion'> & {
  schemaVersion: 192; contentVersion: 'pale-emperor-v192';
};
export interface History { commands: SliceIntent[]; final: OriginalState; seed: string; creation: unknown }
export interface Initial {
  originalStateSha256: string; migratedStateSha256: string; publicSha256: string; globalPublicSha256: string;
  final: SliceState; random: SliceState['random']; public: CapturedPublic; globalPublic: SliceProjection;
}
export interface Natural {
  provenance: Record<string, unknown>; commands: SliceIntent[]; final: SliceState; seed: string; creation: unknown;
  prefixCount: number; policy: typeof POLICY_DEFINITION; boundaries: Boundary[]; stage: string; reason: string; pendingIntent: null;
}
export interface LoadedCapture {
  original: OriginalState; initial: SliceState; initialPublic: SliceProjection; checkpoint: Checkpoint; rows: Row[];
}

export function stable(value: unknown): string {
  function canonical(node: unknown): unknown {
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return node;
    if (typeof node === 'number') { assert(Number.isFinite(node)); return Object.is(node, -0) ? 0 : node; }
    if (Array.isArray(node)) return node.map(canonical);
    assert(node && typeof node === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(node)), 'Expected JSON value');
    const object = node as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map(key => [key, canonical(object[key])]));
  }
  return JSON.stringify(canonical(value));
}
export const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const hash = (value: unknown): string => sha(stable(value));
export const compactHash = (value: unknown): string => sha(JSON.stringify(value));
export const same = (actual: unknown, expected: unknown, message?: string): void => assert.equal(hash(actual), hash(expected), message);
export function exactKeys(value: object, expected: readonly string[]): void {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}
function relativeFile(file: string): string {
  assert(file && !file.includes('\\') && !file.includes('\0') && !file.startsWith('/') && !/^[A-Za-z]:/.test(file));
  assert(file.split('/').every(part => part && part !== '.' && part !== '..')); return file;
}
export function bytes(path: string): Buffer {
  assert.equal(realpathSync(path), resolve(path), 'Evidence must not be symlinked');
  const before = lstatSync(path, { bigint: true }); assert(before.isFile() && !before.isSymbolicLink());
  const value = readFileSync(path), after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino'] as const) assert.equal(after[key], before[key], 'Evidence changed while reading');
  assert.equal(BigInt(value.length), before.size); return value;
}
export const filePin = (path: string): FilePin => { const value = bytes(path); return { bytes: value.length, sha256: sha(value) }; };
export function readManifest(): CaptureManifest {
  const raw = bytes(MANIFEST); assert.equal(sha(raw), MANIFEST_SHA, 'Reviewed complete fixture manifest changed');
  const manifest = JSON.parse(raw.toString('utf8')) as CaptureManifest;
  exactKeys(manifest, ['format', 'files']); assert.equal(manifest.format, 'DEATH217_CAPTURE_FILES_V1');
  assert.equal(manifest.files.length, 115);
  const names = manifest.files.map(row => {
    exactKeys(row, ['file', 'bytes', 'sha256']); relativeFile(row.file); assert(!row.file.includes('/'));
    assert(Number.isSafeInteger(row.bytes) && row.bytes > 0 && /^[a-f0-9]{64}$/.test(row.sha256));
    assert(!row.file.endsWith('.next') && !row.file.endsWith('.derived-next')); return row.file;
  });
  assert.equal(new Set(names).size, names.length); assert.deepEqual(names, [...names].sort());
  assert.equal(manifest.files.reduce((total, row) => total + row.bytes, 0), 133515074);
  return manifest;
}
export const FILE_PINS: Readonly<Record<string, FilePin>> = Object.freeze(Object.fromEntries(readManifest().files
  .map(({ file, ...pin }) => [file, Object.freeze(pin)])));
export function decoded(file: string): Buffer {
  relativeFile(file); assert(Object.hasOwn(FILE_PINS, file), 'Unpinned capture member');
  const raw = bytes(join(ROOT, file)); assert.deepEqual({ bytes: raw.length, sha256: sha(raw) }, FILE_PINS[file], file);
  return file.endsWith('.gz') ? gunzipSync(raw) : raw;
}
export const json = <T>(file: string): T => JSON.parse(decoded(file).toString('utf8')) as T;
export function readCheckpoint(): Checkpoint {
  const wrapper = json<{ sha256: string; payload: Checkpoint }>('checkpoint.json.gz'); exactKeys(wrapper, ['sha256', 'payload']);
  assert.equal(wrapper.sha256, PINS.checkpointEnvelopeSha256); assert.equal(hash(wrapper.payload), wrapper.sha256);
  return wrapper.payload;
}
/** One compressed member at a time; never inflate/cache all103 full actions. */
export function authenticateInputs(): void {
  const manifest = readManifest();
  assert.deepEqual(readdirSync(ROOT).sort(), manifest.files.map(row => row.file), 'Missing or unindexed capture member');
  for (const { file, ...pin } of manifest.files) assert.deepEqual(filePin(join(ROOT, file)), pin, file);
  const original = bytes(SOURCE); assert.equal(original.length, 8904695); assert.equal(sha(original), SOURCE_SHA);
  assert(decoded('archived-original195-natural.json.gz').equals(original), 'Complete original195 bytes must remain exact');
  const freeze = json<{ sha256: string; nodeVersion: string; files: Array<FilePin & { file: string }> }>('runtime-freeze.json');
  exactKeys(freeze, ['sha256', 'nodeVersion', 'files']); assert.equal(freeze.sha256, PINS.runtimeFreezeSha256);
  assert.equal(compactHash(freeze.files), freeze.sha256); assert.equal(freeze.nodeVersion, 'v24.19.0'); assert.equal(freeze.files.length, 4626);
  assert.equal(new Set(freeze.files.map(row => row.file)).size, freeze.files.length);
  for (const [captured, name] of [['producer.mjs', '$natural-producer'], ['producer-tests.mjs', 'scripts/play/death-stage.test.mjs']])
    assert.deepEqual(freeze.files.find(row => row.file === name), { file: name, ...FILE_PINS[captured!] });
  for (const row of freeze.files) {
    exactKeys(row, ['file', 'bytes', 'sha256']); if (row.file !== '$natural-producer') relativeFile(row.file);
    assert(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && /^[a-f0-9]{64}$/.test(row.sha256));
  }
  const inputFiles = [{ file: SOURCE, sha256: SOURCE_SHA, bytes: original.length }];
  assert.equal(compactHash(inputFiles), PINS.inputFreezeSha256);
  same(json('input-freeze.json'), { format: 'NEW217_RESTORED195_HISTORICAL_INPUTS_V1', sha256: PINS.inputFreezeSha256,
    files: inputFiles, originalStateSha256: PINS.originalStateSha256, stateHashEncoding: STATE_ENCODING, sourceRoot: 'final',
    prefixSha256: PINS.prefixSha256, prefixHashEncoding: PREFIX_ENCODING, archivedCommandCount: PREFIX });
  const cp = readCheckpoint(), recovery = json<{ sha256: string; payload: unknown }>('recovery-manifest.json');
  exactKeys(recovery, ['sha256', 'payload']); assert.equal(recovery.sha256, hash(recovery.payload));
  same(recovery.payload, { format: `${FORMAT}_RECOVERY`, commandCount: FINAL_COMMAND, checkpointSha256: PINS.checkpointEnvelopeSha256,
    inputFreezeSha256: PINS.inputFreezeSha256, runtimeFreezeSha256: PINS.runtimeFreezeSha256,
    runtimeRequirement: 'SEPARATE_EXACT_FROZEN_CHECKOUT_AND_NODE_VERSION', files: manifest.files.filter(row => row.file !== 'recovery-manifest.json') });
  assert.equal(cp.pending, null);
}

const PUBLIC_FIELDS = ['runId', 'revision', 'status', 'week', 'date', 'actionsRemaining', 'weeklyBudget', 'cash', 'weeklyWage', 'wagePaid',
  'health', 'mind', 'spirituality', 'maxHealth', 'maxMind', 'maxSpirituality', 'pollution', 'injuries', 'injuryRisk',
  'debtTotal', 'debts', 'canAct', 'actionBlockedReason', 'activeEvent', 'combat'] as const;
export function capturePublic(projection: SliceProjection) {
  const ordinary = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, structuredClone(projection[key])])) as Pick<SliceProjection, typeof PUBLIC_FIELDS[number]>;
  return { ...ordinary, progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
    mastery: structuredClone(projection.progression.mastery) }, death: structuredClone(projection.death) };
}
export type CapturedPublic = ReturnType<typeof capturePublic>;
export function assertPublicOnly(value: unknown, state: Pick<SliceState, 'random' | 'death'>): void {
  const forbidden = /^(?:random|rng|rngState|seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|cursorBefore|cursorAfter|randomBefore|randomAfter|randomReceipts|preparedRoll|preparationRoll|futureRoll|futureRolls|nextRoll|unrolledResult|privateSource|sourceState|sourceDigest|historyDigest|originalWorldDigest|combatHistoryDigest|originalsDigest|originalPracticeDigest|acquisitionDigest|compoundDigest|beforeDigest|afterDigest|actorId|predecessorActorId|incumbentActorId|custodianActorId|sourceHistory|sourceScene|privateProbe|privateMastery|unexpectedField)$/;
  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      const next = `${path}.${key}`, inactive = key === 'actorId' && child === null &&
        ['.divineHand.life.site.guard.actorId', '.glory.life.site.guard.actorId'].some(suffix => next.endsWith(suffix));
      assert(!(forbidden.test(key) && !inactive), `Private field ${next}`);
      assert(!(key === 'source' && child !== null && typeof child === 'object'), `Private source ${next}`); visit(child, next);
    }
  }
  visit(value, '$'); const text = JSON.stringify(value);
  for (const secret of [state.random.seed, state.death.source?.actorId, state.death.source?.historyDigest])
    if (secret) assert(!text.includes(secret), 'An actual private value leaked');
}
export const assertGlobalPublic = (value: SliceProjection, state: SliceState): void => assertPublicOnly(value, state);
export const outcome = (view: CapturedPublic): Outcome => ({ status: view.status, sequence: view.progression.sequence,
  promoted: view.death.promoted, guidance: view.death.guidanceKnown });
export function assertPublicAction(view: CapturedPublic, row: Pick<Row, 'intent' | 'publicLabel' | 'publicCost'>): void {
  assert.equal(view.status, 'ACTIVE'); assert.equal(view.activeEvent, null); assert.equal(view.combat, null);
  assert(row.intent.type === 'DEATH');
  const preferred = view.death.actions.filter(action => action.preferredAction); assert.equal(preferred.length, 1);
  const action = preferred[0]!; assert.equal(action.enabled, true); same(action.command, row.intent.command);
  assert.equal(action.label, row.publicLabel); assert.equal(action.cost, row.publicCost);
}
export function actualReceipts(after: SliceState, before: SliceState): Row['receipts'] {
  const latest = after.death.journal.at(-1);
  if (latest?.revision === after.revision) return { checks: latest.randomReceipts, finance: latest.financeReceipts, notes: latest.notes };
  assert(!before.death.guidanceKnown && after.death.guidanceKnown);
  return { checks: [], finance: [], notes: after.chronicle.slice(before.chronicle.length) };
}
export type HistoricalDeathState = Omit<SliceState, 'schemaVersion' | 'contentVersion' | 'door' | 'errorAscent' | 'twilightGiant' | 'demoness' | 'hermit' | 'hangedMan' | 'abyss' | 'chained'> & {
  schemaVersion: 214; contentVersion: 'death-v214';
};
export type HistoricalDeathPublic = Omit<HistoricalInactiveHermitProjection, 'door' | 'errorAscent' | 'twilightGiant' | 'demoness' | 'hermit' | 'hangedMan' | 'abyss' | 'chained'>;
/** Exactly the schema215 Door, schema216 Error, schema217 Twilight Giant, schema218 Demoness,
 * schema219 Hermit, schema220 Hanged Man, schema221 Abyss and schema222 Chained defaults may be omitted. Every original field and
 * unknown root remains in the historical hash; raw schema/content never move. */
export function historicalDeathState(state: SliceState): HistoricalDeathState {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assertEmptyDoorState(state); assertEmptyErrorAscentState(state); assertEmptyTwilightGiantState(state); assertEmptyDemonessState(state);
  assertEmptyHermitState(state); assertEmptyHangedManState(state); assertEmptyAbyssState(state); assertEmptyChainedState(state);
  const { door: _emptyDoor, errorAscent: _emptyErrorAscent, twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness,
    hermit: _emptyHermit, hangedMan: _emptyHangedMan, abyss: _emptyAbyss, chained: _emptyChained, ...originalFields } = state;
  return { ...originalFields, schemaVersion: CAPTURE_SCHEMA, contentVersion: CAPTURE_CONTENT };
}
export function historicalDeathPublic(projection: SliceProjection, state: SliceState): HistoricalDeathPublic {
  historicalDeathState(state); assertEmptyDoorPublic(projection, state); assertEmptyErrorAscentPublic(projection, state); assertEmptyTwilightGiantPublic(projection, state); assertEmptyDemonessPublic(projection, state);
  assertEmptyHermitPublic(projection, state); assertEmptyHangedManPublic(projection, state); assertEmptyAbyssPublic(projection, state); assertEmptyChainedPublic(projection, state);
  const { door: _emptyDoor, errorAscent: _emptyErrorAscent, twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness,
    hermit: _emptyHermit, hangedMan: _emptyHangedMan, abyss: _emptyAbyss, chained: _emptyChained, ...originalFields } = historicalInactiveHermitPublic(historicalInactiveCalamitySourcePublic(projection, state), state);
  return originalFields;
}
/** Raw214 authentication stays independent of current projection admission. */
export function assertCapturedGlobal(actual: SliceProjection, action: Action, side: 'before' | 'after'): void {
  const state = side === 'before' ? action.beforeLast : action.final;
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
  assert.equal(state.revision, action.commandCount + (side === 'after' ? 1 : 0));
  assert.equal(Object.hasOwn(state, 'door'), false); assert.equal(Object.hasOwn(actual, 'door'), false);
  assert.equal(Object.hasOwn(state, 'errorAscent'), false); assert.equal(Object.hasOwn(state, 'twilightGiant'), false); assert.equal(Object.hasOwn(state, 'demoness'), false); assert.equal(Object.hasOwn(actual, 'errorAscent'), false); assert.equal(Object.hasOwn(actual, 'twilightGiant'), false); assert.equal(Object.hasOwn(actual, 'demoness'), false);
  const expected = side === 'before' ? action.globalPublicBefore : action.globalPublic;
  same(actual, expected, `Complete captured global public ${action.commandCount} ${side}`);
  assert.equal(hash(actual), side === 'before' ? action.audit.globalPublicBeforeSha256 : action.audit.globalPublicAfterSha256);
  same(capturePublic(actual), side === 'before' ? action.publicBefore : action.public); assertGlobalPublic(actual, state);
}
/** Current projection requires the exact empty Door, Error, Twilight Giant, Demoness,
 * Hermit, Hanged Man, Abyss and Chained roots before comparison of
 * every historical public leaf. Missing roots never select a permissive path. */
export function assertCurrentGlobal(actual: SliceProjection, action: Action, side: 'before' | 'after'): void {
  const state = side === 'before' ? action.beforeLast : action.final;
  assertEmptyDoorPublic(actual, state); assertEmptyErrorAscentPublic(actual, state); assertEmptyTwilightGiantPublic(actual, state); assertEmptyDemonessPublic(actual, state);
  assertEmptyHermitPublic(actual, state); assertEmptyHangedManPublic(actual, state); assertEmptyAbyssPublic(actual, state); assertEmptyChainedPublic(actual, state);
  const { door: _emptyDoor, errorAscent: _emptyErrorAscent, twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness,
    hermit: _emptyHermit, hangedMan: _emptyHangedMan, abyss: _emptyAbyss, chained: _emptyChained, ...historicalPublic } = historicalInactiveHermitPublic(historicalInactiveCalamitySourcePublic(actual, state), state);
  assertCapturedGlobal(historicalPublic as SliceProjection, action, side);
  assertGlobalPublic(actual, state);
}

function assertPolicyTransition(action: Action): void {
  const before = action.publicBefore, after = action.public, prior = action.policyBefore, next = structuredClone(prior);
  assert(action.lastIntent.type === 'DEATH'); const command = action.lastIntent.command;
  assert.equal(prior.reported, false);
  next.phase = !before.death.guidanceKnown ? 'DEATH_ENTRY' : before.death.promoted ? 'DEATH_EPILOGUE' : 'DEATH_SERVICES_MATERIALS_PROMOTION';
  next.week = after.week;
  if (command.type === 'CONSUME') {
    assert.equal(command.confirmed, true); assert(!next.consumedCompounds.includes(command.compoundId));
    next.consumedCompounds.push(command.compoundId); next.doses++; assert(next.doses <= 3);
  }
  if (command.type === 'MATERIAL' && command.command.type === 'BUY_COMPOUND') {
    const id = command.command.batchId; assert(['death-carrier-1', 'death-carrier-2', 'death-carrier-3'].includes(id));
    assert(!next.carriers.includes(id)); next.carriers.push(id); assert(next.carriers.length <= 3);
  }
  if (command.type === 'EPILOGUE') {
    const type = command.command.type;
    if (type === 'PARTIAL_SPIRIT_PASSAGE' || type === 'PROPAGATION_BARRIER') {
      assert(!next.epilogueAttempted.includes(type)); next.epilogueAttempted.push(type);
    }
    if (type === 'REPORT') next.reported = true;
  }
  const semantic = (view: CapturedPublic) => ({ phase: next.phase, sequence: view.progression.sequence,
    acting: view.progression.acting, mastery: view.progression.mastery,
    progress: view.death.sections.filter(section => !['clock', 'recent-action', 'finance', 'body'].includes(section.id)),
    intended: view.death.actions.filter(item => item.preferredAction).map(item => item.command) });
  const gained = after.cash > before.cash || after.health > before.health || after.mind > before.mind ||
    after.spirituality > before.spirituality || after.pollution < before.pollution || after.injuries.length < before.injuries.length;
  const key = hash(semantic(after)), cycle = hash({ ...semantic(after), cash: after.cash, actionsRemaining: after.actionsRemaining,
    health: after.health, mind: after.mind, spirituality: after.spirituality, pollution: after.pollution,
    injuries: after.injuries, injuryRisk: after.injuryRisk, debtTotal: after.debtTotal });
  const recent = [...prior.loop.recent, cycle].slice(-32);
  next.loop = { key, repetitions: hash(semantic(before)) === key && !gained ? prior.loop.repetitions + 1 : 0,
    recent, cycleRepeats: recent.filter(value => value === cycle).length - 1 };
  same(action.policyAfter, next, 'Exact independently derived public policy transition');
}
export function readAction(row: Row): Action {
  assert(Number.isSafeInteger(row.commandCount) && row.commandCount > PREFIX && row.commandCount <= FINAL_COMMAND);
  assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
  exactKeys(row.capture, ['file', 'bytes', 'sha256']);
  assert.deepEqual({ bytes: row.capture.bytes, sha256: row.capture.sha256 }, FILE_PINS[row.capture.file]);
  const action = json<Action>(row.capture.file);
  exactKeys(action, ['commandCount', 'beforeLast', 'lastIntent', 'final', 'randomBefore', 'randomAfter', 'publicBefore', 'public',
    'globalPublicBefore', 'globalPublic', 'policyBefore', 'policyAfter', 'audit']);
  const { capture: _capture, ...audit } = row;
  same(action.audit, { ...audit, elapsedMilliseconds: null }); assert.equal(action.commandCount, row.commandCount); same(action.lastIntent, row.intent);
  for (const [value, expected] of [[action.beforeLast, row.beforeStateSha256], [action.final, row.afterStateSha256],
    [action.publicBefore, row.publicBeforeSha256], [action.public, row.publicAfterSha256],
    [action.globalPublicBefore, row.globalPublicBeforeSha256], [action.globalPublic, row.globalPublicAfterSha256],
    [action.policyBefore, row.policyBeforeSha256], [action.policyAfter, row.policyAfterSha256]] as const) assert.equal(hash(value), expected);
  for (const state of [action.beforeLast, action.final]) {
    assert.deepEqual([state.schemaVersion, state.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
    assert.equal(state.runId, 'corpsecollector-rebuild-natural');
  }
  assert.equal(action.beforeLast.revision, row.commandCount); assert.equal(action.final.revision, row.commandCount + 1);
  same(action.randomBefore, row.randomBefore); same(action.randomAfter, row.randomAfter);
  same(action.beforeLast.random, row.randomBefore); same(action.final.random, row.randomAfter);
  assertCapturedGlobal(action.globalPublicBefore, action, 'before'); assertCapturedGlobal(action.globalPublic, action, 'after');
  same(actualReceipts(action.final, action.beforeLast), row.receipts); same(outcome(action.public), row.selectionOutcome);
  assertPublicAction(action.publicBefore, row);
  assert.equal(row.reason, 'Follow the exact enabled runtime-preferred public action; retain its actual costs and outcome');
  assertPolicyTransition(action); return action;
}
export function readActionAt(count: number): Action {
  assert(Number.isSafeInteger(count) && count > PREFIX && count <= FINAL_COMMAND);
  return readAction(readCheckpoint().rows[count - PREFIX - 1]!);
}

function selectedBoundaries(rows: Row[]): Array<{ kind: string; commandCount: number }> {
  const result: Array<{ kind: string; commandCount: number }> = [];
  for (const row of rows) {
    assert(row.intent.type === 'DEATH'); const command = row.intent.command; let kind: string | null = null;
    if (row.selectionOutcome.status !== 'ACTIVE') kind = 'death-actual-terminal';
    else {
      if (result.filter(item => item.kind !== 'death-actual-terminal').length >= 63) continue;
      if (['LEARN_GUIDANCE', 'WORK', 'REST', 'CLINIC', 'NEXT_WEEK', 'STABILIZE_PROMOTION', 'START_EPILOGUE', 'RETURN_ON_FOOT'].includes(command.type))
        kind = `death-${command.type.toLowerCase()}`;
      if (command.type === 'TRAVEL') kind = `death-travel-${command.to}`;
      if (command.type === 'SERVICE') kind = `service-${command.command.serviceId}-${command.command.type.toLowerCase()}`;
      if (command.type === 'MATERIAL') {
        const c = command.command;
        const suffix = 'bottleId' in c ? c.bottleId : 'step' in c ? c.step : 'batchId' in c ? c.batchId : 'compoundId' in c ? c.compoundId : 'unique';
        kind = `material-${c.type.toLowerCase()}-${suffix}`;
      }
      if (command.type === 'CONSUME') kind = row.selectionOutcome.promoted ? 'death-actual-promotion' : `death-failed-dose-${command.compoundId}`;
      if (command.type === 'EPILOGUE') kind = `epilogue-${command.command.type.toLowerCase()}`;
    }
    if (kind && result.length < 64 && !result.some(item => item.kind === kind)) result.push({ kind, commandCount: row.commandCount });
  }
  return result;
}
/** Full metadata/chain authentication; no gameplay. Full actions are consumed
 * lazily by replay or the few backend/UI representatives. */
export function loadCapture(): LoadedCapture {
  authenticateInputs();
  const history = json<History>('archived-original195-natural.json.gz'), source = history.final;
  assert.equal(history.commands.length, PREFIX); assert.equal(compactHash(history.commands), PINS.prefixSha256);
  assert.equal(hash(source), PINS.originalStateSha256);
  assert.deepEqual([source.schemaVersion, source.contentVersion], [192, 'pale-emperor-v192']);
  assert.equal(source.runId, 'corpsecollector-rebuild-natural'); assert.equal(source.revision, 1039);
  assert.equal(source.status, 'ACTIVE'); assert.equal(source.week, 3323); assert.equal(history.seed, source.random.seed);
  same(source.random, { seed: 'corpsecollector-natural-v032', cursor: 490 });
  const captured = json<Initial>('migration-initial.json.gz');
  exactKeys(captured, ['originalStateSha256', 'migratedStateSha256', 'publicSha256', 'globalPublicSha256', 'final', 'random', 'public', 'globalPublic']);
  assert.equal(captured.originalStateSha256, PINS.originalStateSha256); assert.equal(captured.migratedStateSha256, PINS.initialStateSha256);
  assert.equal(hash(captured.final), PINS.initialStateSha256); assert.equal(hash(captured.random), PINS.initialRandomSha256);
  assert.equal(hash(captured.public), PINS.initialPublicSha256); assert.equal(captured.publicSha256, PINS.initialPublicSha256);
  assert.equal(hash(captured.globalPublic), PINS.initialGlobalPublicSha256); assert.equal(captured.globalPublicSha256, PINS.initialGlobalPublicSha256);
  same(captured.random, source.random); same(captured.final.random, source.random);
  assert.deepEqual([captured.final.schemaVersion, captured.final.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
  exactKeys(captured.final, [...Object.keys(source), 'abomination', 'apocalypseDemoness', 'darkAngel', 'darkness', 'death',
    'divineHand', 'fool', 'handOfOrder', 'knowledgeEmperor', 'mercurySnake', 'moon', 'natureWalker', 'perfecter',
    'princeOfAbolition', 'redPriest', 'starKey', 'sun', 'timeWorm', 'tyrant', 'uncleanMonarch', 'visionary', 'whiteTower']);
  for (const [key, value] of Object.entries(source)) if (!['schemaVersion', 'contentVersion'].includes(key))
    same((captured.final as unknown as Record<string, unknown>)[key], value, `Original1038 field ${key}`);
  same(capturePublic(captured.globalPublic), captured.public); assertGlobalPublic(captured.globalPublic, captured.final);
  const cp = readCheckpoint();
  exactKeys(cp, ['format', 'source', 'sourceSha256', 'prefixSha256', 'prefixHashEncoding', 'stateHashEncoding', 'inputFreezeSha256',
    'runtimeFreezeSha256', 'policyDefinition', 'policy', 'migration', 'createdAt', 'commandCount', 'commands', 'rows', 'boundaries', 'state',
    'initialStateSha256', 'finalStateSha256', 'initialPublicSha256', 'publicStateSha256', 'initialGlobalPublicSha256',
    'globalPublicStateSha256', 'initialRandomSha256', 'pending', 'terminal', 'predecessorSha256']);
  assert.equal(cp.format, FORMAT); assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_SHA);
  assert.equal(cp.prefixHashEncoding, PREFIX_ENCODING); assert.equal(cp.stateHashEncoding, STATE_ENCODING);
  for (const key of ['prefixSha256', 'inputFreezeSha256', 'runtimeFreezeSha256', 'initialStateSha256', 'finalStateSha256',
    'initialPublicSha256', 'initialGlobalPublicSha256', 'initialRandomSha256', 'predecessorSha256', 'createdAt'] as const)
    assert.equal(cp[key], PINS[key]);
  assert.equal(cp.publicStateSha256, PINS.finalPublicSha256); assert.equal(cp.globalPublicStateSha256, PINS.finalGlobalPublicSha256);
  assert.equal(hash(cp.state), PINS.finalStateSha256); assert.equal(hash(cp.state.random), PINS.finalRandomSha256);
  assert.equal(hash(cp.policy), PINS.finalPolicySha256); same(cp.policyDefinition, POLICY_DEFINITION);
  assert.equal(cp.commandCount, FINAL_COMMAND); assert.equal(cp.commands.length, NEW_COMMANDS); assert.equal(cp.rows.length, NEW_COMMANDS);
  assert.equal(cp.pending, null); same(cp.terminal, { stage: PINS.stage, reason: PINS.reason });
  same(cp.migration, { originalStateSha256: PINS.originalStateSha256, migratedStateSha256: PINS.initialStateSha256, fromSchema: 192, toSchema: 214 });
  let privateHash: string = PINS.initialStateSha256, publicHash: string = PINS.initialPublicSha256,
    globalHash: string = PINS.initialGlobalPublicSha256, randomHash: string = PINS.initialRandomSha256, policyHash: string = PINS.initialPolicySha256;
  for (const [index, row] of cp.rows.entries()) {
    exactKeys(row, ['commandCount', 'intent', 'commandSha256', 'reason', 'publicLabel', 'publicCost', 'startedAt', 'elapsedMilliseconds',
      'revision', 'week', 'beforeStateSha256', 'afterStateSha256', 'publicBeforeSha256', 'publicAfterSha256', 'globalPublicBeforeSha256',
      'globalPublicAfterSha256', 'selectionOutcome', 'randomBefore', 'randomAfter', 'randomBeforeSha256', 'randomAfterSha256',
      'policyBeforeSha256', 'policyAfterSha256', 'receipts', 'capture']);
    assert.equal(row.commandCount, PREFIX + index + 1); assert.equal(row.revision, row.commandCount + 1); same(row.intent, cp.commands[index]);
    assert.equal(row.intent.type, 'DEATH'); assert.equal(row.commandSha256, compactHash(row.intent));
    assert.equal(row.beforeStateSha256, privateHash); assert.equal(row.publicBeforeSha256, publicHash);
    assert.equal(row.globalPublicBeforeSha256, globalHash); assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(hash(row.randomBefore), row.randomBeforeSha256); assert.equal(hash(row.randomAfter), row.randomAfterSha256);
    assert.equal(row.randomBefore.seed, history.seed); assert.equal(row.randomAfter.seed, history.seed);
    assert(row.randomAfter.cursor >= row.randomBefore.cursor); exactKeys(row.selectionOutcome, ['guidance', 'promoted', 'sequence', 'status']);
    assert.equal(row.selectionOutcome.status, 'ACTIVE'); assert.equal(row.selectionOutcome.guidance, true);
    assert.equal(row.selectionOutcome.sequence, row.commandCount < 1128 ? 1 : 0); assert.equal(row.selectionOutcome.promoted, row.commandCount >= 1128);
    assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`); exactKeys(row.capture, ['file', 'bytes', 'sha256']);
    assert.deepEqual({ bytes: row.capture.bytes, sha256: row.capture.sha256 }, FILE_PINS[row.capture.file]);
    assert(Number.isSafeInteger(row.elapsedMilliseconds) && row.elapsedMilliseconds >= 0); assert(Number.isFinite(Date.parse(row.startedAt)));
    privateHash = row.afterStateSha256; publicHash = row.publicAfterSha256; globalHash = row.globalPublicAfterSha256;
    randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(privateHash, PINS.finalStateSha256); assert.equal(publicHash, PINS.finalPublicSha256);
  assert.equal(globalHash, PINS.finalGlobalPublicSha256); assert.equal(randomHash, PINS.finalRandomSha256); assert.equal(policyHash, PINS.finalPolicySha256);
  same(cp.commands[0], { type: 'DEATH', command: { type: 'LEARN_GUIDANCE' } });
  assert.deepEqual(Object.keys(FILE_PINS).filter(name => /^action-.*\.json\.gz$/.test(name)).sort(), cp.rows.map(row => row.capture.file).sort());
  same(json<Boundary[]>('boundaries.index.json'), cp.boundaries);
  assert.deepEqual(cp.boundaries.map(row => row.commandCount), [...PINS.boundaryCommandCounts]); assert.equal(cp.boundaries.length, 60);
  same(cp.boundaries.map(({ kind, commandCount }) => ({ kind, commandCount })), selectedBoundaries(cp.rows));
  for (const boundary of cp.boundaries) {
    exactKeys(boundary, ['file', 'bytes', 'sha256', 'kind', 'commandCount']);
    const { kind: _kind, commandCount, ...pin } = boundary; same(pin, cp.rows[commandCount - PREFIX - 1]!.capture);
  }
  assert.equal(decoded('commands.ndjson.gz').toString('utf8'), cp.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const natural = json<Natural>('natural.json.gz');
  exactKeys(natural, ['provenance', 'creation', 'seed', 'prefixCount', 'commands', 'policy', 'stage', 'reason', 'pendingIntent', 'boundaries', 'final']);
  same(natural.final, cp.state); same(natural.creation, history.creation); assert.equal(natural.seed, history.seed);
  assert.equal(natural.prefixCount, PREFIX); same(natural.commands, [...history.commands, ...cp.commands]);
  same(natural.boundaries, cp.boundaries); same(natural.policy, cp.policyDefinition);
  assert.equal(natural.pendingIntent, null); assert.equal(natural.stage, PINS.stage); assert.equal(natural.reason, PINS.reason);
  same(natural.provenance, { kind: 'NEW217_FROM_RESTORED195_LIVING1038_PUBLIC_DEATH_CONTINUATION', format: 'NEW217_REBUILD_PROVENANCE_V1',
    newNatural217: true, rebuiltFromRestoredVolume195: true, source: SOURCE, sourceSha256: SOURCE_SHA, sourceRoot: 'final',
    originalStateSha256: PINS.originalStateSha256, originalEvidence: ['archived-original195-natural.json.gz'],
    prefixCommandsSha256: PINS.prefixSha256, prefixCommandsHashEncoding: PREFIX_ENCODING, stateHashEncoding: STATE_ENCODING,
    inputFreezeSha256: PINS.inputFreezeSha256, runtimeFreezeSha256: PINS.runtimeFreezeSha256,
    historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, completeOriginalSourceRetainedExactly: true,
    alternateSourceUsed: false, privateAudit: true, seedChanged: false, randomOverridden: false, futureDrawInspected: false,
    selectedFromEnabledPublicActionsOnly: true, everyActionEvidence: 'FULL_PRIVATE_RNG_CHAPTER_PUBLIC_AND_GLOBAL_PUBLIC_BEFORE_AND_AFTER_GZIP',
    selectedSQLiteBoundaries: 'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER',
    globalPublicScope: 'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH', projectionScope: 'POSITIVE_DEATH_AND_ORDINARY_PUBLIC_DASHBOARD' });
  const summary = json<Record<string, unknown> & { public: CapturedPublic }>('summary.json');
  same(summary, { stage: PINS.stage, reason: PINS.reason, commands: FINAL_COMMAND, originalCommands: PREFIX, newCommands: NEW_COMMANDS,
    rebuild: 'NEW217', newNatural217: true, controlledStop: false, week: 3331, paused: false, diagnostic: false,
    strictFinalValidation: true, sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', packageReopenValidation: 'NOT_RUN_BY_PRODUCER',
    recoveryManifest: 'recovery-manifest.json', checkpoint: 'checkpoint.json.gz', public: summary.public });
  assert.equal(hash(summary.public), PINS.finalPublicSha256); assertPublicOnly(summary.public, cp.state);
  return { original: source, initial: captured.final, initialPublic: captured.globalPublic, checkpoint: cp, rows: cp.rows };
}
