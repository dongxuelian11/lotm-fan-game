import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

/** Independent read-only evidence consumer. No producer, compiled runtime,
 * controlled-success helper, output fallback, RNG seam or fixture writes. */
export const ROOT = 'tests/fixtures/darkness-v02130';
export const INPUT_MANIFEST = 'test-inputs/darkness-v02130-capture-files.json';
export const INPUT_MANIFEST_SHA = 'f736518013838d8a9ac3851ac8591dd7e66cc473bc84229b3523f658c286a0e5';
export const PREFIX = 679, NEW_COMMANDS = 155, BOUNDARY_LIMIT = 25;
export const SOURCE = 'tests/fixtures/misfortune-knight-v01910/boundary-three-honest-reports-reflected.json';
export const SNAPSHOT = 'tests/fixtures/misfortune-knight-v01910/snapshot-practiced.json';
export const ARCHIVE = 'tests/fixtures/misfortune-knight-v01910/natural.json';
export const SOURCE_PINS = [
  [SOURCE, 'source-boundary679.json.gz', 2431880, '6e5889192d3a0c697640fc0bc1fadd680c7b8526088a11d8f920b602cf34b79f'],
  [SNAPSHOT, 'source-state679.json.gz', 1217515, '470d3ae9700186d8488b27663a9c64060053a011cd57bed3a5054a275bf7b6ee'],
  [ARCHIVE, 'archived-original694.json.gz', 3329692, '597112414e673dbb446dd17d860bd88541ca5007f6310d552c41f96b12462ae8'],
] as const;
export const PINS = {
  naturalSha256: '0ea275612c843ada95566cd92fef8e83910dea6602469a51bc3d727d96680501',
  prefixSha256: 'c34fb277dcd19280ebd2b3d31069dddb46619d20d12fed7710b0605af61d60c3',
  inputFreezeSha256: '295596207b76de8a8db40120e28950e32b0cb68e72446dcdfb20a58987c21a0c',
  runtimeFreezeSha256: 'dfad269362adafca13e837e0794a66c7599e19605add47e405a021dd711d254e',
  initialStateSha256: 'a4565978aa472df1873fcd3e0626a6281c8488b4efe8849151086b345bfb9040',
  finalStateSha256: '1dbdf0bdfb56ebf85252246c8f7defd5da031569116cd1dd355eb3d0666041f4',
  initialPublicSha256: '74104b09d17c65c923a2cee879d9ea56ee7595ed2b58fa20f6befda9173a5bfa',
  finalPublicSha256: 'd54a2babfa91e8115e87b29590586b87201260276e0a0154b084d3c2189e96a2',
  initialGlobalPublicSha256: '3bf77d54838befe8b6b4154f116db01a25f277a79c7cd7ed92c133ea70c841a7',
  finalGlobalPublicSha256: 'd714aea09577cbf42aff68c3d4837122155c0a7a1ded27a0607f6082135ad1af',
  initialRandomSha256: '0d4bbcd6919490a15c46f6b1490a649c6639c083f66faabfe21a00b8ec5954cb',
  finalRandomSha256: '4df087e90fca818c6242a20bd460c9ae0a92136d90710c54222cd166306c27c6',
  stage: 'NATURAL_FINITE_DARKNESS_REPORTED',
  reason: 'The finite original-resident incident was honestly reported; no successful skill is forced',
  sqliteCommandCounts: [680, 814, 834] as const,
};
export const POLICY = {
  id: 'DARKNESS679_SAME_ORIGINAL_FOUR_REAL_EVACUEES_V1', startWeek: 158, wage: 180, weeklyLiving: 30,
  operatingReserve: 1500, defaultObservationActions: 500, selectedBoundaryLimit: 25, carrierLimit: 3,
  evacuation: 'FOUR_CONSENTING_ORIGINAL_ADULTS_REAL_DAY_SURVEY_NIGHT_ARRIVALS_AND_WALKED_RETURN',
  materials: 'THREE_SAME_ORIGINALS_DATED_1353_UNIQUENESS_ORDINARY_WAGES_AND_FINANCE',
  promotion: 'SAME_COMPOUND_PAID100P_70PERCENT_PREPARATION_INDEPENDENT_CONSUMPTION',
  failure: 'LIVING_SEAL_LATER_WEEK_PAID_RECOVERY_THREE_FINITE_CARRIERS_DEATH_ARCHIVED',
  epilogue: 'TWO_FINITE_ATTEMPTS_ACTUAL_APPLICATION_OR_ORDINARY_SIDE_EXIT_AND_HONEST_REPORT', noReroll: true,
};
export const INITIAL_POLICY = { phase: 'DARKNESS_ENTRY', week: 158, doses: 0, carriers: [] as string[],
  epilogueAttempted: [] as string[], reported: false, ordinaryExitReason: null as string | null,
  loop: { key: null as string | null, repetitions: 0 } };
export interface FilePin { bytes: number; sha256: string }
export interface Member extends FilePin { file: string; originalBytes?: number; originalSha256?: string }
export interface Manifest { format: string; files: Member[] }
export interface Freeze { sha256: string; nodeVersion: string; files: Array<FilePin & { file: string }> }
export interface BoundaryIndex extends FilePin { file: string; kind: string; commandCount: number }
export interface Outcome { status: SliceState['status']; promoted: boolean; arrivals: number }
export interface Row {
  commandCount: number; intent: SliceIntent; commandSha256: string; reason: string; publicLabel: string; publicCost: string;
  startedAt: string; elapsedMilliseconds: number; revision: number; week: number;
  beforeStateSha256: string; afterStateSha256: string; publicBeforeSha256: string; publicAfterSha256: string;
  globalPublicBeforeSha256: string; globalPublicAfterSha256: string;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; randomBeforeSha256: string; randomAfterSha256: string;
  policyBeforeSha256: string; policyAfterSha256: string; selectionOutcome: Outcome;
  receipts: { checks: unknown[]; finance: unknown[]; notes: unknown[] };
}
export interface Checkpoint {
  format: string; source: string; sourceSha256: string; prefixSha256: string; inputFreezeSha256: string; runtimeFreezeSha256: string;
  policyDefinition: typeof POLICY; policy: typeof INITIAL_POLICY;
  migration: { originalStateSha256: string; migratedStateSha256: string; fromSchema: number; toSchema: number };
  createdAt: string; commandCount: number; commands: SliceIntent[]; rows: Row[]; boundaries: BoundaryIndex[]; state: SliceState;
  initialStateSha256: string; finalStateSha256: string; initialPublicSha256: string; publicStateSha256: string;
  initialGlobalPublicSha256: string; globalPublicStateSha256: string; initialRandomSha256: string;
  pending: unknown | null; terminal: { stage: string; reason: string } | null; predecessorSha256: string;
}
export interface Boundary {
  commandCount: number; beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState;
  public: CapturedPublic; globalPublicSha256: string; audit: Omit<Row, 'elapsedMilliseconds'> & { elapsedMilliseconds: null };
}
/** Historical inputs are kept separate; no cast pretends the188 file is current. */
export type HistoricalSource = Omit<SliceState, 'schemaVersion' | 'contentVersion'> & { schemaVersion: 188; contentVersion: 'misfortune-knight-v188' };
interface History { commands: SliceIntent[]; final: HistoricalSource; creation: unknown; seed: string }
interface Natural extends Omit<History, 'final'> {
  final: SliceState; provenance: Record<string, unknown>; prefixCount: number; policy: typeof POLICY;
  stage: string; reason: string; pendingIntent: null; boundaries: BoundaryIndex[];
}
export interface Summary {
  stage: string; reason: string; commands: number; originalCommands: number; newCommands: number; week: number;
  paused: boolean; diagnostic: boolean; strictFinalValidation: boolean; sqliteReopenValidation: string;
  checkpoint: string; public: CapturedPublic;
}
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stable(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value)!;
}
export const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const hash = (value: unknown): string => sha(stable(value));
export const compactHash = (value: unknown): string => sha(JSON.stringify(value));
export const same = (a: unknown, b: unknown, message?: string): void => assert.equal(hash(a), hash(b), message);
const exactKeys = (value: object, keys: string[]): void => assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
const digest = (value: unknown): void => assert(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value));
const whole = (value: number): void => assert(Number.isSafeInteger(value) && value >= 0);
function relativeFile(file: string): string {
  assert(file && !file.includes('\\') && !file.includes('\0') && !file.startsWith('/') && !/^[A-Za-z]:/.test(file));
  assert(file.split('/').every(part => part && part !== '.' && part !== '..')); return file;
}
export function bytes(path: string): Buffer {
  assert.equal(realpathSync(path), resolve(path), 'No symlink evidence');
  const before = lstatSync(path, { bigint: true }); assert(before.isFile() && !before.isSymbolicLink());
  const result = readFileSync(path), after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino'] as const) assert.equal(after[key], before[key]);
  assert.equal(BigInt(result.length), before.size); return result;
}
export function decoded(path: string): Buffer {
  const raw = bytes(path); if (!path.endsWith('.gz')) return raw;
  assert.equal(raw[0], 0x1f); assert.equal(raw[1], 0x8b); return gunzipSync(raw);
}
export const filePin = (path: string): FilePin => { const raw = bytes(path); return { bytes: raw.length, sha256: sha(raw) }; };
export const json = <T>(file: string): T => JSON.parse(decoded(join(ROOT, relativeFile(file))).toString('utf8')) as T;
function inventory(root: string, prefix = ''): string[] {
  assert.equal(realpathSync(join(root, prefix)), resolve(root, prefix));
  return readdirSync(join(root, prefix)).sort().flatMap(name => {
    const file = prefix ? `${prefix}/${name}` : name, stat = lstatSync(join(root, file));
    assert(!stat.isSymbolicLink()); if (stat.isDirectory()) return inventory(root, file);
    assert(stat.isFile()); return [file];
  });
}
export function assertCaptureManifest(manifest: Manifest, actualFiles: readonly string[]): void {
  exactKeys(manifest, ['format', 'files']); assert.equal(manifest.format, 'DARKNESS213_CAPTURE_FILES_V1');
  assert.equal(manifest.files.length, 34);
  const names = manifest.files.map(row => relativeFile(row.file));
  assert.equal(new Set(names).size, names.length); assert.deepEqual(names, [...names].sort());
  for (const row of manifest.files) {
    const compressed = row.file.endsWith('.gz');
    exactKeys(row, compressed ? ['file', 'bytes', 'sha256', 'originalBytes', 'originalSha256'] : ['file', 'bytes', 'sha256']);
    whole(row.bytes); digest(row.sha256);
    if (compressed) { whole(row.originalBytes!); digest(row.originalSha256); }
  }
  assert.deepEqual(actualFiles, names, 'The whole34-file capture is mandatory, with no additions or omissions');
}
const RUNTIME_ROOTS = ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution',
  'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation', 'node_modules/@noble/hashes', 'scripts/play/darkness-stage.test.mjs'];
const under = (file: string, root: string): boolean => file === root || file.startsWith(`${root}/`);
export function assertCaptureFreeze(freeze: Freeze): void {
  exactKeys(freeze, ['sha256', 'nodeVersion', 'files']); assert.equal(freeze.sha256, PINS.runtimeFreezeSha256);
  assert.equal(compactHash(freeze.files), freeze.sha256); assert.equal(freeze.nodeVersion, 'v24.19.0');
  const names = freeze.files.map(row => row.file); assert.equal(new Set(names).size, names.length);
  assert(names.includes('$natural-producer'));
  for (const root of RUNTIME_ROOTS) assert(names.some(file => under(file, root)), `Missing captured runtime ${root}`);
  for (const { file, ...pin } of freeze.files) {
    exactKeys(pin, ['bytes', 'sha256']); whole(pin.bytes); digest(pin.sha256);
    if (file !== '$natural-producer') { relativeFile(file); assert(RUNTIME_ROOTS.some(root => under(file, root))); }
  }
  const producer = freeze.files.find(row => row.file === '$natural-producer')!;
  assert.deepEqual(filePin(join(ROOT, 'producer.mjs')), { bytes: producer.bytes, sha256: producer.sha256 });
}
export function authenticateInputs(): void {
  assert.equal(filePin(INPUT_MANIFEST).sha256, INPUT_MANIFEST_SHA);
  const manifest = JSON.parse(bytes(INPUT_MANIFEST).toString('utf8')) as Manifest;
  assertCaptureManifest(manifest, inventory(ROOT));
  for (const row of manifest.files) {
    const path = join(ROOT, row.file); assert.deepEqual(filePin(path), { bytes: row.bytes, sha256: row.sha256 });
    if (row.file.endsWith('.gz')) { const plain = decoded(path); assert.equal(plain.length, row.originalBytes); assert.equal(sha(plain), row.originalSha256); }
  }
  assert.equal(filePin(join(ROOT, 'natural.json.gz')).sha256, PINS.naturalSha256);
  for (const [source, retained, size, sourceSha] of SOURCE_PINS) {
    const original = bytes(source); assert.deepEqual({ bytes: original.length, sha256: sha(original) }, { bytes: size, sha256: sourceSha });
    assert(decoded(join(ROOT, retained)).equals(original), `Retain every original byte of ${source}`);
  }
  assertCaptureFreeze(json<Freeze>('runtime-freeze.json'));
  const frozenInputs = json<{ format: string; sha256: string; files: Array<FilePin & { file: string }>; peacefulStateSha256: string; prefixSha256: string; archivedCommandCount: number }>('input-freeze.json');
  assert.deepEqual(frozenInputs, { format: 'DARKNESS679_HISTORICAL_INPUTS_V1', sha256: PINS.inputFreezeSha256,
    files: SOURCE_PINS.map(([file, , size, sourceSha]) => ({ file, sha256: sourceSha, bytes: size })),
    peacefulStateSha256: SOURCE_PINS[1][3], prefixSha256: PINS.prefixSha256, archivedCommandCount: 694 });
  assert.equal(compactHash(frozenInputs.files), PINS.inputFreezeSha256);
}
const PUBLIC_FIELDS = ['runId', 'revision', 'status', 'week', 'date', 'actionsRemaining', 'weeklyBudget', 'cash', 'weeklyWage', 'wagePaid',
  'health', 'mind', 'spirituality', 'maxHealth', 'maxMind', 'maxSpirituality', 'pollution', 'injuries', 'injuryRisk',
  'debtTotal', 'debts', 'canAct', 'actionBlockedReason', 'activeEvent', 'combat'] as const;
export function capturePublic(projection: SliceProjection) {
  const ordinary = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, structuredClone(projection[key])])) as Pick<SliceProjection, typeof PUBLIC_FIELDS[number]>;
  return { ...ordinary, progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
    mastery: structuredClone(projection.progression.mastery) }, darkness: structuredClone(projection.darkness) };
}
export type CapturedPublic = ReturnType<typeof capturePublic>;
export function assertGlobalPublic(projection: SliceProjection, state: SliceState): void {
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter',
    'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'randomReceipts', 'sourceDigest', 'historyDigest', 'originalsDigest',
    'originalPracticeDigest', 'acquisitionDigest', 'beforeDigest', 'afterDigest', 'actorId', 'predecessorActorId', 'incumbentActorId',
    'custodianActorId', 'futureRoll', 'futureRolls', 'nextRoll', 'unrolledResult']);
  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      const next = `${path}.${key}`, inactive = key === 'actorId' && value === null &&
        ['$.divineHand.life.site.guard.actorId', '$.glory.life.site.guard.actorId'].includes(next);
      assert(!(forbidden.has(key) && !inactive), `Private field ${next}`);
      assert(!(key === 'source' && value !== null && typeof value === 'object'), `Private source ${next}`); visit(value, next);
    }
  }
  visit(projection, '$');
  const text = JSON.stringify(projection);
  for (const secret of [state.random.seed, state.darkness.source?.actorId, state.darkness.source?.historyDigest])
    if (secret) assert(!text.includes(secret), 'An actual private value leaked into the global public projection');
}
export const outcome = (view: CapturedPublic): Outcome => ({ status: view.status, promoted: view.darkness.promoted,
  arrivals: Number(view.darkness.sections.find(section => section.id === 'darkness-evacuation')?.lines
    .map(line => line.match(/^已到达(\d)\/4/)?.[1]).find(Boolean) ?? 0) });
export function assertPublicAction(view: CapturedPublic, row: Pick<Row, 'intent' | 'publicLabel' | 'publicCost'>): void {
  assert.equal(row.intent.type, 'DARKNESS'); if (row.intent.type !== 'DARKNESS') throw Error('Unexpected chapter command');
  const command = row.intent.command, offered = view.darkness.actions.filter(action => stable(action.command) === stable(command));
  assert.equal(offered.length, 1); assert.equal(offered[0]!.enabled, true);
  assert.equal(row.publicLabel, offered[0]!.label); assert.equal(row.publicCost, offered[0]!.cost);
}
export function actualReceipts(after: SliceState, before: SliceState): Row['receipts'] {
  const latest = after.darkness.journal.at(-1);
  return latest?.revision === after.revision ? { checks: latest.randomReceipts, finance: latest.financeReceipts, notes: latest.notes }
    : { checks: [], finance: [], notes: after.chronicle.slice(before.chronicle.length) };
}
/** Exact current ingress; no removed roots, altered tags or filtered fields. */
export function migrateCapturedDarknessState(raw: SliceState): SliceState {
  assert.deepEqual([raw.schemaVersion, raw.contentVersion], [210, 'darkness-v210']);
  const before = hash(raw), current = migrateSliceState(raw);
  assert.deepEqual([current.schemaVersion, current.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assertValidSliceState(current); same(current, raw, 'Current ingress changed complete captured state');
  assert.equal(hash(raw), before, 'Ingress mutated immutable input'); return current;
}
export function boundaryKind(intent: SliceIntent, result: Outcome): string | null {
  assert(intent.type === 'DARKNESS'); const c = intent.command;
  if (['LEARN_GUIDANCE', 'STABILIZE_PROMOTION', 'START_EPILOGUE'].includes(c.type)) return `darkness-${c.type.toLowerCase()}`;
  if (c.type === 'EVACUATION') {
    if (['SHIELD_FALSE_LIGHT', 'RELAY_INSTRUCTIONS', 'REPORT'].includes(c.command.type)) return `evacuation-${c.command.type.toLowerCase()}`;
    if (c.command.type === 'WALK' && c.command.to === 110 && result.arrivals > 0) return `evacuation-actual-arrival-${result.arrivals}`;
  }
  if (c.type === 'MATERIAL') {
    const m = c.command;
    if (m.type === 'INVESTIGATE_LEGACY_REMAINS' || m.type === 'RECOVER_LEGACY_REMAINS') return `material-${m.type.toLowerCase()}-${m.bottleId}`;
    if (['ACQUIRE_UNIQUENESS', 'COMPOSE_POTION', 'SEAL_REMAINS', 'RECOVER_SEALED'].includes(m.type)) return `material-${m.type.toLowerCase()}`;
    if (m.type === 'VERIFY_UNIQUENESS') return `uniqueness-${m.step.toLowerCase()}`;
  }
  if (c.type === 'CONSUME') return result.status !== 'ACTIVE' ? 'darkness-actual-terminal-dose' : result.promoted ? 'darkness-actual-promotion' : 'darkness-first-failed-dose';
  if (c.type === 'EPILOGUE' && ['SHORT_CONCEALMENT', 'BOUNDED_MISFORTUNE_DIVERSION', 'REPORT'].includes(c.command.type)) return `epilogue-${c.command.type.toLowerCase()}`;
  return null;
}
export function readBoundary(item: BoundaryIndex, row: Row): Boundary {
  assert.equal(item.file, `boundary-${item.commandCount}-${item.kind}.json.gz`);
  assert.deepEqual(filePin(join(ROOT, relativeFile(item.file))), { bytes: item.bytes, sha256: item.sha256 });
  const boundary = json<Boundary>(item.file);
  exactKeys(boundary, ['commandCount', 'beforeLast', 'lastIntent', 'final', 'public', 'globalPublicSha256', 'audit']);
  assert.equal(boundary.commandCount, row.commandCount); same(boundary.lastIntent, row.intent);
  same(boundary.audit, { ...row, elapsedMilliseconds: null });
  assert.equal(hash(boundary.beforeLast), row.beforeStateSha256); assert.equal(hash(boundary.final), row.afterStateSha256);
  assert.equal(hash(boundary.public), row.publicAfterSha256); assert.equal(boundary.globalPublicSha256, row.globalPublicAfterSha256);
  assert.deepEqual(outcome(boundary.public), row.selectionOutcome);
  for (const state of [boundary.beforeLast, boundary.final]) assert.deepEqual([state.schemaVersion, state.contentVersion], [210, 'darkness-v210']);
  assert.equal(boundary.beforeLast.status, 'ACTIVE'); assert.equal(boundary.beforeLast.revision, row.commandCount);
  assert.equal(boundary.final.revision, row.revision); assert.equal(boundary.final.week, row.week);
  assert.deepEqual(boundary.beforeLast.random, row.randomBefore); assert.deepEqual(boundary.final.random, row.randomAfter);
  return boundary;
}
export interface LoadedCapture { original: HistoricalSource; archived: History; initial: SliceState; checkpoint: Checkpoint; rows: Row[]; summary: Summary }
export function loadCapture(): LoadedCapture {
  authenticateInputs();
  const original = json<HistoricalSource>('source-state679.json.gz'), archived = json<History>('archived-original694.json.gz');
  const source = json<{ beforeLast: HistoricalSource; lastIntent: SliceIntent; final: HistoricalSource }>('source-boundary679.json.gz');
  same(source.final, original); assert.equal(compactHash(original), SOURCE_PINS[1][3]);
  assert.equal(archived.commands.length, 694); assert.equal(archived.final.status, 'DEAD'); assert.equal(archived.final.revision, 695);
  assert.deepEqual(archived.final.random, { seed: 'sleepless-natural-v020', cursor: 444 });
  assert.equal(compactHash(archived.commands.slice(0, PREFIX)), PINS.prefixSha256); same(archived.commands[PREFIX - 1], source.lastIntent);
  assert.deepEqual([original.schemaVersion, original.contentVersion, original.revision, original.status, original.week], [188, 'misfortune-knight-v188', 680, 'ACTIVE', 158]);
  assert.equal(original.runId, 'sleepless-rebuild-natural'); assert.equal(archived.seed, original.random.seed);
  assert.deepEqual(original.random, { seed: 'sleepless-natural-v020', cursor: 348 });
  assert.deepEqual(original.date, { epoch: 'FIFTH_EPOCH', year: 1352, month: 7, day: 1 });
  assert.deepEqual([original.health, original.mind, original.spirituality, original.cash, original.actionsRemaining, original.seer.pollution], [100, 97, 112, 400, 3, 0]);
  assert.deepEqual(original.injuries, []); assert.equal(original.character.coreStats.will, 31); assert.equal(original.character.weeklyWage, 180);
  assert.deepEqual([original.progression.pathwayId, original.progression.sequence, original.progression.acting], ['darkness', 1, 100]);
  const originalHash = hash(original), initial = migrateSliceState(original);
  assertValidSliceState(initial); assert.equal(hash(original), originalHash);
  assert.deepEqual([initial.schemaVersion, initial.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  for (const [key, value] of Object.entries(original)) if (!['schemaVersion', 'contentVersion'].includes(key))
    same((initial as unknown as Record<string, unknown>)[key], value, `Migration changed original679 ${key}`);
  // Complete hash authenticates every added default, without a permissive filter.
  assert.equal(hash(initial), PINS.initialStateSha256); assert.equal(hash(initial.random), PINS.initialRandomSha256);
  const initialPublic = projectSliceState(initial); assertGlobalPublic(initialPublic, initial);
  assert.equal(hash(initialPublic), PINS.initialGlobalPublicSha256); assert.equal(hash(capturePublic(initialPublic)), PINS.initialPublicSha256);
  const migrated = json<{ originalStateSha256: string; migratedStateSha256: string; publicSha256: string; globalPublicSha256: string; final: SliceState }>('migration-initial.json.gz');
  same(migrated, { originalStateSha256: SOURCE_PINS[1][3], migratedStateSha256: PINS.initialStateSha256,
    publicSha256: PINS.initialPublicSha256, globalPublicSha256: PINS.initialGlobalPublicSha256, final: initial });
  const wrapper = json<{ sha256: string; payload: Checkpoint }>('checkpoint.json.gz'); exactKeys(wrapper, ['sha256', 'payload']);
  assert.equal(wrapper.sha256, hash(wrapper.payload)); const cp = wrapper.payload;
  exactKeys(cp, ['format', 'source', 'sourceSha256', 'prefixSha256', 'inputFreezeSha256', 'runtimeFreezeSha256', 'policyDefinition', 'policy', 'migration',
    'createdAt', 'commandCount', 'commands', 'rows', 'boundaries', 'state', 'initialStateSha256', 'finalStateSha256', 'initialPublicSha256', 'publicStateSha256',
    'initialGlobalPublicSha256', 'globalPublicStateSha256', 'initialRandomSha256', 'pending', 'terminal', 'predecessorSha256']);
  assert.equal(cp.format, 'DARKNESS679_DURABLE_PUBLIC_ACTION_BOUNDARY_V1'); assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_PINS[0][3]);
  for (const key of ['prefixSha256', 'inputFreezeSha256', 'runtimeFreezeSha256', 'initialStateSha256', 'finalStateSha256', 'initialPublicSha256', 'initialGlobalPublicSha256', 'initialRandomSha256'] as const) assert.equal(cp[key], PINS[key]);
  assert.equal(cp.publicStateSha256, PINS.finalPublicSha256); assert.equal(cp.globalPublicStateSha256, PINS.finalGlobalPublicSha256);
  assert.equal(hash(cp.state), PINS.finalStateSha256); assert.equal(hash(cp.state.random), PINS.finalRandomSha256);
  assert.deepEqual([cp.state.schemaVersion, cp.state.contentVersion, cp.state.revision, cp.state.week, cp.state.status, cp.state.progression.sequence], [210, 'darkness-v210', 835, 192, 'ACTIVE', 0]);
  same(cp.policyDefinition, POLICY); assert.equal(cp.pending, null); digest(cp.predecessorSha256); assert(Number.isFinite(Date.parse(cp.createdAt)));
  assert.deepEqual(cp.migration, { originalStateSha256: SOURCE_PINS[1][3], migratedStateSha256: PINS.initialStateSha256, fromSchema: 188, toSchema: 210 });
  assert.equal(cp.commandCount, 834); assert.equal(cp.commands.length, NEW_COMMANDS);
  assert.deepEqual(cp.terminal, { stage: PINS.stage, reason: PINS.reason });
  const natural = json<Natural>('natural.json.gz'), summary = json<Summary>('summary.json');
  exactKeys(natural, ['provenance', 'creation', 'seed', 'prefixCount', 'commands', 'policy', 'stage', 'reason', 'pendingIntent', 'boundaries', 'final']);
  same(natural.final, cp.state); same(natural.creation, archived.creation); assert.equal(natural.seed, archived.seed);
  assert.equal(natural.prefixCount, PREFIX); assert.equal(natural.commands.length, 834);
  same(natural.commands, [...archived.commands.slice(0, PREFIX), ...cp.commands]); same(natural.policy, POLICY); same(natural.boundaries, cp.boundaries);
  assert.equal(natural.pendingIntent, null); assert.equal(natural.stage, PINS.stage); assert.equal(natural.reason, PINS.reason);
  assert.deepEqual(natural.provenance, { kind: 'EXACT_ORIGINAL_LIVING679_PUBLIC_DARKNESS_CONTINUATION', source: SOURCE, sourceSha256: SOURCE_PINS[0][3],
    peacefulStateSha256: SOURCE_PINS[1][3], originalEvidence: SOURCE_PINS.map(row => row[1]), prefixCommandsSha256: PINS.prefixSha256,
    inputFreezeSha256: PINS.inputFreezeSha256, runtimeFreezeSha256: PINS.runtimeFreezeSha256, historicalPrefixReplayedByThisProducer: false,
    originalPrefixRetainedExactly: true, independent694DeathRetainedExactly: true, independent694DeathUsedAsInput: false, privateAudit: true,
    seedChanged: false, randomOverridden: false, futureDrawInspected: false, selectedFromEnabledPublicActionsOnly: true,
    selectedSQLiteBoundaries: 'CAPTURED_FOR_LATER_REOPEN_CHECKS_NOT_EXECUTED_BY_PRODUCER',
    globalPublicScope: 'WHOLE_SLICE_EXACT_SENSITIVE_FIELD_SCAN_AND_SEPARATE_HASH', projectionScope: 'CURRENT_DARKNESS_AND_ORDINARY_PUBLIC_DASHBOARD' });
  assert.deepEqual(summary, { stage: PINS.stage, reason: PINS.reason, commands: 834, originalCommands: PREFIX, newCommands: NEW_COMMANDS,
    week: 192, paused: false, diagnostic: false, strictFinalValidation: true, sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', checkpoint: 'checkpoint.json.gz', public: summary.public });
  assert.equal(hash(summary.public), PINS.finalPublicSha256); assert.deepEqual(outcome(summary.public), { status: 'ACTIVE', promoted: true, arrivals: 4 });
  const ledger = decoded(join(ROOT, 'commands.ndjson.gz')).toString('utf8');
  assert.equal(ledger, cp.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const rows = ledger.trimEnd().split('\n').map(line => JSON.parse(line) as Row); assert.equal(rows.length, NEW_COMMANDS);
  let privateHash = PINS.initialStateSha256, publicHash = PINS.initialPublicSha256, globalHash = PINS.initialGlobalPublicSha256,
    randomHash = PINS.initialRandomSha256, policyHash = hash(INITIAL_POLICY);
  const expected: Array<{ kind: string; commandCount: number }> = [], seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    exactKeys(row, ['commandCount', 'intent', 'commandSha256', 'reason', 'publicLabel', 'publicCost', 'startedAt', 'elapsedMilliseconds', 'revision', 'week',
      'beforeStateSha256', 'afterStateSha256', 'publicBeforeSha256', 'publicAfterSha256', 'globalPublicBeforeSha256', 'globalPublicAfterSha256',
      'randomBefore', 'randomAfter', 'randomBeforeSha256', 'randomAfterSha256', 'policyBeforeSha256', 'policyAfterSha256', 'receipts', 'selectionOutcome']);
    assert.equal(row.commandCount, PREFIX + index + 1); assert.equal(row.revision, row.commandCount + 1); whole(row.week); whole(row.elapsedMilliseconds);
    assert(Number.isFinite(Date.parse(row.startedAt))); for (const key of ['reason', 'publicLabel', 'publicCost'] as const) assert.equal(typeof row[key], 'string');
    same(row.intent, cp.commands[index]); assert.equal(row.commandSha256, compactHash(row.intent));
    assert.equal(row.beforeStateSha256, privateHash); assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.globalPublicBeforeSha256, globalHash);
    assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(hash(row.randomBefore), row.randomBeforeSha256); assert.equal(hash(row.randomAfter), row.randomAfterSha256);
    for (const rng of [row.randomBefore, row.randomAfter]) { exactKeys(rng, ['seed', 'cursor']); assert.equal(rng.seed, original.random.seed); whole(rng.cursor); }
    assert(row.randomAfter.cursor >= row.randomBefore.cursor);
    for (const value of [row.afterStateSha256, row.publicAfterSha256, row.globalPublicAfterSha256, row.policyAfterSha256]) digest(value);
    exactKeys(row.selectionOutcome, ['status', 'promoted', 'arrivals']); assert.equal(row.selectionOutcome.status, 'ACTIVE');
    assert.equal(typeof row.selectionOutcome.promoted, 'boolean'); whole(row.selectionOutcome.arrivals); assert(row.selectionOutcome.arrivals <= 4);
    exactKeys(row.receipts, ['checks', 'finance', 'notes']); for (const value of Object.values(row.receipts)) assert(Array.isArray(value));
    const kind = boundaryKind(row.intent, row.selectionOutcome);
    if (kind && !seen.has(kind) && expected.length < BOUNDARY_LIMIT) { seen.add(kind); expected.push({ kind, commandCount: row.commandCount }); }
    privateHash = row.afterStateSha256; publicHash = row.publicAfterSha256; globalHash = row.globalPublicAfterSha256;
    randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(privateHash, PINS.finalStateSha256); assert.equal(publicHash, PINS.finalPublicSha256); assert.equal(globalHash, PINS.finalGlobalPublicSha256);
  assert.equal(randomHash, PINS.finalRandomSha256); assert.equal(policyHash, hash(cp.policy)); assert.equal(cp.policy.week, cp.state.week);
  same(json<BoundaryIndex[]>('boundaries.index.json'), cp.boundaries); assert.equal(cp.boundaries.length, 22);
  assert.deepEqual(cp.boundaries.map(({ kind, commandCount }) => ({ kind, commandCount })), expected);
  assert.equal(new Set(cp.boundaries.map(item => item.file)).size, 22); assert.equal(new Set(cp.boundaries.map(item => item.commandCount)).size, 22);
  for (const item of cp.boundaries) { exactKeys(item, ['file', 'kind', 'commandCount', 'bytes', 'sha256']); readBoundary(item, rows[item.commandCount - PREFIX - 1]!); }
  assert.deepEqual(cp.commands[0], { type: 'DARKNESS', command: { type: 'LEARN_GUIDANCE' } });
  for (const count of PINS.sqliteCommandCounts) assert(cp.boundaries.some(item => item.commandCount === count));
  return { original, archived, initial, checkpoint: cp, rows, summary };
}
