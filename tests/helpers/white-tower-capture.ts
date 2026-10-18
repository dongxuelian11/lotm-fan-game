import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { createTyrantState } from '../../src/domain/tyrant/index.js';
import { createSunState } from '../../src/domain/sun/index.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { assertEmptyErrorAscentState, assertEmptyErrorAscentPublic } from './empty-error-ascent-capture.js';
import { assertEmptyDeathState, assertEmptyDeathPublic, assertEmptyDoorState, assertEmptyDoorPublic } from './empty-death-capture.js';

/** Read-only consumer of the original complete137-action capture. Never imports
 * a producer, verifier, controlled-success helper, compiled runtime or RNG seam. */
export const ROOT = 'tests/fixtures/white-tower-v02140';
export const INPUT_MANIFEST = 'tests/fixtures/white-tower-v02140-integrity.json';
export const INPUT_MANIFEST_SHA = '9ae333f71703263f2bf91643924bcadb23ba509e5089c43c0bee4ed1e73c23f1';
export const SOURCE = 'tests/fixtures/all-knowing-eye-v01920/natural.json';
export const SOURCE_SHA = 'b838bff34dbf49f3df9968bcfef684a24c184e8320f9b8e6d7a1431bfc75a58f';
export const PREFIX = 666, NEW_COMMANDS = 137;
export const PINS = {
  naturalSha256: '88dd96c060602633522cbcd8671caa86e2dd1347af683a12b61cf6e334b819bd',
  originalStateSha256: '08106a9cd35089fd9df5addb9d9425aa5abe93618bfaaa359c6731a734e09c11',
  prefixSha256: '8ef19a15574807a0dacdf1e7a1c20ce0185fbc90c7002327825fd6553a5abd20',
  inputFreezeSha256: '0d8b9173a71559e6045d25ef57712f6d45bf4774132f555a1649e18210b5905f',
  runtimeFreezeSha256: '344cc77b0a26225acc078a44f1aeb11559333a85ee0c6a52cb3da948e2061505',
  initialStateSha256: 'ce8a40d097f49ac32cfeea6fb1e806fd88c1f968af6f2c0b015f51e1ba32a822',
  finalStateSha256: 'b9f30051948cf8db5d8b75388b44996eb8a8bc87842133ebe3573b5bee66e031',
  initialPublicSha256: '363127360ead4e6439e9c768ba15fc68879610a21fceff3a05947c2b2cf5ec47',
  finalPublicSha256: '8f67314fac2fb13e80f58d03d52d35043b41717212727bef9c490a6192a88c9a',
  initialGlobalPublicSha256: '6069fa446cdafa60c18c7d3a678a35836ea14a1f88b443a7d9856ec4c98a0754',
  finalGlobalPublicSha256: 'e4887bf6d73eb1c9fa81553efe1f1c4d8deb0339040d8eb8845a126ff3136b46',
  initialRandomSha256: '923684f9800fc7bb3f6050de871fc6488b1d6988a383a07ccec11a0421d21f46',
  finalRandomSha256: '47667e86d3a59d3465ce99f1b47c4b838d85e9860099c16a493d2b7b1fd61f99',
  initialPolicySha256: 'bf47f74d3ec27167d798cfa327c1762e317354c65689f763a5deb0fdd9309255',
  stage: 'NATURAL_FINITE_WHITE_TOWER_REPORTED',
  reason: 'The finite actual mechanical incident was honestly reported; no successful skill is forced',
  sqliteCommandCounts: [667, 775, 803] as const,
};
export interface FilePin { bytes: number; sha256: string }
export interface Member extends FilePin { file: string; originalBytes?: number; originalSha256?: string }
export interface Manifest { format: string; files: Member[] }
export interface Freeze { sha256: string; nodeVersion: string; files: Array<FilePin & { file: string }> }
export interface BoundaryIndex extends FilePin { file: string; kind: string; commandCount: number }
export interface Outcome { status: SliceState['status']; promoted: boolean; passages: number; reviews: number }
/** Raw211 evidence is immutable and has none of the Tyrant, Sun, Death, Door or Error roots. */
export type HistoricalWhiteTowerState = Omit<SliceState, 'schemaVersion' | 'contentVersion' | 'tyrant' | 'sun' | 'death' | 'door' | 'errorAscent'> & {
  schemaVersion: 211; contentVersion: 'white-tower-v211';
};
export type HistoricalWhiteTowerPublic = Omit<SliceProjection, 'tyrant' | 'sun' | 'death' | 'door' | 'errorAscent'>;
export interface Row {
  commandCount: number; intent: SliceIntent; commandSha256: string; reason: string; publicLabel: string; publicCost: string;
  startedAt: string; elapsedMilliseconds: number; revision: number; week: number;
  beforeStateSha256: string; afterStateSha256: string; publicBeforeSha256: string; publicAfterSha256: string;
  globalPublicBeforeSha256: string; globalPublicAfterSha256: string;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; randomBeforeSha256: string; randomAfterSha256: string;
  policyBeforeSha256: string; policyAfterSha256: string; selectionOutcome: Outcome;
  receipts: { checks: unknown[]; finance: unknown[]; notes: unknown[] }; capture: FilePin & { file: string };
}
export interface Checkpoint {
  format: string; source: string; sourceSha256: string; prefixSha256: string; inputFreezeSha256: string; runtimeFreezeSha256: string;
  migration: { originalStateSha256: string; migratedStateSha256: string; fromSchema: number; toSchema: number };
  policyDefinition: Record<string, unknown>; policy: { week: number; doses: number; carriers: string[]; epilogueAttempted: string[]; reported: boolean };
  commandCount: number; commands: SliceIntent[]; rows: Row[]; boundaries: BoundaryIndex[]; state: HistoricalWhiteTowerState;
  initialStateSha256: string; finalStateSha256: string; initialPublicSha256: string; publicStateSha256: string;
  initialGlobalPublicSha256: string; globalPublicStateSha256: string; initialRandomSha256: string;
  pending: unknown | null; terminal: { stage: string; reason: string } | null;
}
export interface Action {
  commandCount: number; beforeLast: HistoricalWhiteTowerState; lastIntent: SliceIntent; final: HistoricalWhiteTowerState;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; publicBefore: CapturedPublic; public: CapturedPublic;
  globalPublicBefore: HistoricalWhiteTowerPublic; globalPublic: HistoricalWhiteTowerPublic;
  audit: Omit<Row, 'elapsedMilliseconds' | 'capture'> & { elapsedMilliseconds: null };
}
export type HistoricalSource = Omit<SliceState, 'schemaVersion' | 'contentVersion'> & { schemaVersion: 189; contentVersion: 'all-knowing-eye-v189' };
interface History { commands: SliceIntent[]; final: HistoricalSource; creation: unknown; seed: string }
interface Natural extends Omit<History, 'final'> {
  final: HistoricalWhiteTowerState; provenance: Record<string, unknown>; prefixCount: number; policy: Record<string, unknown>;
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
export const decoded = (path: string): Buffer => path.endsWith('.gz') ? gunzipSync(bytes(path)) : bytes(path);
export const filePin = (path: string): FilePin => { const raw = bytes(path); return { bytes: raw.length, sha256: sha(raw) }; };
export const json = <T>(file: string): T => JSON.parse(decoded(join(ROOT, relativeFile(file))).toString('utf8')) as T;
export function assertCaptureManifest(manifest: Manifest, actualFiles: readonly string[]): void {
  exactKeys(manifest, ['format', 'files']); assert.equal(manifest.format, 'WHITE_TOWER214_CAPTURE_FILES_V1');
  assert.equal(manifest.files.length, 147);
  const names = manifest.files.map(row => relativeFile(row.file));
  assert.equal(new Set(names).size, names.length); assert.deepEqual(names, [...names].sort());
  assert.deepEqual(actualFiles, names, 'All147 original members are mandatory, without omissions or additions');
  assert.deepEqual(names.filter(name => /^action-\d+\.json\.gz$/.test(name)),
    Array.from({ length: NEW_COMMANDS }, (_, index) => `action-${PREFIX + index + 1}.json.gz`));
  for (const row of manifest.files) {
    exactKeys(row, row.file.endsWith('.gz') ? ['file', 'bytes', 'sha256', 'originalBytes', 'originalSha256'] : ['file', 'bytes', 'sha256']);
    assert(Number.isSafeInteger(row.bytes) && row.bytes > 0); assert(/^[a-f0-9]{64}$/.test(row.sha256));
  }
}
export function assertCaptureFreeze(freeze: Freeze): void {
  exactKeys(freeze, ['sha256', 'nodeVersion', 'files']); assert.equal(freeze.sha256, PINS.runtimeFreezeSha256);
  assert.equal(compactHash(freeze.files), freeze.sha256); assert.equal(freeze.files.length, 4500);
  assert.equal(new Set(freeze.files.map(row => row.file)).size, freeze.files.length);
  const producer = freeze.files.find(row => row.file === '$natural-producer')!; assert(producer);
  assert.deepEqual(filePin(join(ROOT, 'producer.mjs')), { bytes: producer.bytes, sha256: producer.sha256 });
}
export function authenticateInputs(): void {
  assert.equal(filePin(INPUT_MANIFEST).sha256, INPUT_MANIFEST_SHA);
  const manifest = JSON.parse(bytes(INPUT_MANIFEST).toString('utf8')) as Manifest;
  assertCaptureManifest(manifest, readdirSync(ROOT).sort());
  for (const row of manifest.files) {
    const path = join(ROOT, row.file); assert.deepEqual(filePin(path), { bytes: row.bytes, sha256: row.sha256 });
    if (row.file.endsWith('.gz')) { const plain = decoded(path); assert.equal(plain.length, row.originalBytes); assert.equal(sha(plain), row.originalSha256); }
  }
  assert.equal(filePin(join(ROOT, 'natural.json.gz')).sha256, PINS.naturalSha256);
  const source = bytes(SOURCE); assert.equal(source.length, 4592916); assert.equal(sha(source), SOURCE_SHA);
  assert(decoded(join(ROOT, 'archived-original666.json.gz')).equals(source), 'Original666 retained byte for byte');
  assertCaptureFreeze(json<Freeze>('runtime-freeze.json'));
  const frozen = json<{ sha256: string; files: Member[] }>('input-freeze.json');
  assert.equal(frozen.sha256, PINS.inputFreezeSha256); assert.equal(compactHash(frozen.files), frozen.sha256);
  assert.deepEqual(frozen.files, [{ file: SOURCE, sha256: SOURCE_SHA, bytes: 4592916 }]);
}
const PUBLIC_FIELDS = ['runId', 'revision', 'status', 'week', 'date', 'actionsRemaining', 'weeklyBudget', 'cash', 'weeklyWage', 'wagePaid',
  'health', 'mind', 'spirituality', 'maxHealth', 'maxMind', 'maxSpirituality', 'pollution', 'injuries', 'injuryRisk',
  'debtTotal', 'debts', 'canAct', 'actionBlockedReason', 'activeEvent', 'combat'] as const;
export function capturePublic(projection: Pick<SliceProjection, typeof PUBLIC_FIELDS[number] | 'progression' | 'whiteTower'>) {
  const ordinary = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, structuredClone(projection[key])])) as Pick<SliceProjection, typeof PUBLIC_FIELDS[number]>;
  return { ...ordinary, progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
    mastery: structuredClone(projection.progression.mastery) }, whiteTower: structuredClone(projection.whiteTower) };
}
export type CapturedPublic = ReturnType<typeof capturePublic>;
export function assertGlobalPublic(projection: SliceProjection, state: SliceState): void {
  const forbidden = /^(?:random|seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|cursorBefore|cursorAfter|randomBefore|randomAfter|randomReceipts|preparedRoll|futureRoll|futureRolls|nextRoll|unrolledResult|sourceDigest|historyDigest|originalWorldDigest|combatHistoryDigest|originalsDigest|originalPracticeDigest|acquisitionDigest|compoundDigest|beforeDigest|afterDigest|actorId|predecessorActorId|incumbentActorId|custodianActorId)$/;
  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      const next = `${path}.${key}`, inactive = key === 'actorId' && value === null &&
        ['$.divineHand.life.site.guard.actorId', '$.glory.life.site.guard.actorId'].includes(next);
      assert(!(forbidden.test(key) && !inactive), `Private field ${next}`);
      assert(!(key === 'source' && value !== null && typeof value === 'object'), `Private source ${next}`); visit(value, next);
    }
  }
  visit(projection, '$'); const text = JSON.stringify(projection), secrets = new Set([state.random.seed]);
  function collect(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'actorId' || key.endsWith('Digest')) && typeof value === 'string' && value) secrets.add(value);
      else if (value && typeof value === 'object') collect(value);
    }
  }
  collect(state); for (const secret of secrets) assert(!text.includes(secret), 'Actual private value leaked into global public projection');
}
export function outcome(view: CapturedPublic): Outcome {
  const lines = view.whiteTower.sections.find(section => section.id === 'white-tower-passages')?.lines ?? [];
  return { status: view.status, promoted: view.whiteTower.promoted,
    passages: lines.filter(line => /已实际通过|已实走复核/.test(line)).length, reviews: lines.filter(line => /已实走复核/.test(line)).length };
}
export function assertPublicAction(view: CapturedPublic, row: Pick<Row, 'intent' | 'publicLabel' | 'publicCost'>): void {
  assert(row.intent.type === 'WHITE_TOWER'); const command = row.intent.command;
  const offered = view.whiteTower.actions.filter(action => stable(action.command) === stable(command));
  assert.equal(offered.length, 1); assert.equal(offered[0]!.enabled, true);
  assert.equal(row.publicLabel, offered[0]!.label); assert.equal(row.publicCost, offered[0]!.cost);
}
export function actualReceipts(after: SliceState, before: SliceState): Row['receipts'] {
  const latest = after.whiteTower.journal.at(-1);
  return latest?.revision === after.revision ? { checks: latest.randomReceipts, finance: latest.financeReceipts, notes: latest.notes }
    : { checks: [], finance: [], notes: after.chronicle.slice(before.chronicle.length) };
}
const EMPTY_TYRANT: SliceState['tyrant'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  coasts: null, challenge: null, materials: null, epilogue: null, seaVoyages: [], assembly: null,
  journal: [], promotionStability: { preparations: [] },
};
const EMPTY_SUN: SliceState['sun'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
/** Detached comparison only: verify and remove exactly the introduced empty roots.
 * Every original field and any unexpected future root stays in the full hash. */
export function historicalWhiteTowerState(state: SliceState): HistoricalWhiteTowerState {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assert.deepEqual(createTyrantState(), EMPTY_TYRANT); assert.deepEqual(createSunState(), EMPTY_SUN);
  assert.deepEqual(state.tyrant, EMPTY_TYRANT); assert.deepEqual(state.sun, EMPTY_SUN);
  assertEmptyDeathState(state); assertEmptyDoorState(state); assertEmptyErrorAscentState(state);
  const { tyrant: _emptyTyrant, sun: _emptySun, death: _emptyDeath, door: _emptyDoor, errorAscent: _emptyErrorAscent, ...originalFields } = state;
  return { ...originalFields, schemaVersion: 211, contentVersion: 'white-tower-v211' };
}
/** Pin all five entire inactive public additions before removing only those roots.
 * No old prose, chronicle, command, resource or unknown root is normalized. */
export function historicalWhiteTowerPublic(projection: SliceProjection, state: SliceState): HistoricalWhiteTowerPublic {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assert.deepEqual(state.tyrant, EMPTY_TYRANT); assert.deepEqual(state.sun, EMPTY_SUN);
  assertEmptyDeathState(state); assertEmptyDoorState(state); assertEmptyErrorAscentState(state);
  assert.equal(state.progression.pathwayId, 'white-tower');
  assert.equal(Object.hasOwn(projection, 'tyrant'), true);
  assert.deepEqual(projection.tyrant, {
    title: '序列0 暴君', guidanceKnown: false, promoted: false,
    story: '原小湾与旧人原物继续保留。三岸共二十七万原居民各有当前意愿与有限粮食；履约、隔周复核和真实航运不能用证书代替。另一位太阳真神独立敌对，单独挑战并真实存活才计入晋升经历。',
    nextStep: state.progression.sequence === 1
      ? '维持至少二十万同一在世居民同时恐惧、服从并信仰；本人单独挑战另一位真神后存活，取得原三份特性与同一唯一性，在当前氛围中完成同瓶付费准备。'
      : '先继续雷神的真实原三份续筹、晋升和三案反思；历史独立第四份不能改写为同根回收件。',
    risk: '晋升成功率按当前意志与本次付费准备计算；失败实际重伤、污染或死亡，没有免费重试。药液与普通载体耗用，原特性仍守恒，回收必须按真实原处和隔周条件完成。',
    resources: { health: state.health, mind: state.mind, spirituality: state.spirituality,
      cash: `${state.cash}便士`, actionsRemaining: state.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'tyrant:0:LEARN_GUIDANCE', label: '听取暴君晋升与三岸原人群指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的雷神本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  assert.equal(Object.hasOwn(projection, 'sun'), true);
  assert.deepEqual(projection.sun, {
    title: '序列0 太阳', guidanceKnown: false, promoted: false,
    story: '玛拉与芦影、原采光廊和投降的西拉斯都留在原处，旧许可、伤势和耗料继续保留。街区接待处有洗衣房与邻楼后阶两件居民求助；须亲自问清情况、处理实际原物并完成交接，普通手段也能完成。',
    nextStep: '完成两件居民服务与现场核验；核清本人已有的一份和另外两份原特性，实地确认同一太阳唯一性空位，再为同一本人的同一瓶付费准备。实际晋1满十二周才可服药。',
    risk: '成功率按本人实际意志与本瓶付费准备计算，不重掷。失败留下真实重伤和污染并可能死亡。幸存者只能在原处封存同一残余，隔周付费回收，再用剩余有价载体重配；总共只有三件载体。',
    resources: { health: state.health, mind: state.mind, spirituality: state.spirituality,
      cash: `${state.cash}便士`, actionsRemaining: state.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'sun:0:LEARN_GUIDANCE', label: '听取两件服务与三份原特性指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的纯白天使本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  assertEmptyDeathPublic(projection, state); assertEmptyDoorPublic(projection, state); assertEmptyErrorAscentPublic(projection, state);
  const { tyrant: _emptyTyrant, sun: _emptySun, death: _emptyDeath, door: _emptyDoor, errorAscent: _emptyErrorAscent, ...originalFields } = projection;
  return originalFields;
}
export function migrateCapturedWhiteTowerState(raw: HistoricalWhiteTowerState): SliceState {
  assert.deepEqual([raw.schemaVersion, raw.contentVersion], [211, 'white-tower-v211']);
  assert.equal(Object.hasOwn(raw, 'tyrant'), false); assert.equal(Object.hasOwn(raw, 'sun'), false); assert.equal(Object.hasOwn(raw, 'death'), false); assert.equal(Object.hasOwn(raw, 'door'), false); assert.equal(Object.hasOwn(raw, 'errorAscent'), false);
  const before = hash(raw), current = migrateSliceState(raw);
  assert.deepEqual([current.schemaVersion, current.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assertValidSliceState(current); exactKeys(current, [...Object.keys(raw), 'tyrant', 'sun', 'death', 'door', 'errorAscent']);
  same(historicalWhiteTowerState(current), raw, 'Strict current ingress changed full original capture');
  assert.equal(hash(raw), before); return current;
}
export function readAction(row: Row): Action {
  assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
  assert.deepEqual(filePin(join(ROOT, relativeFile(row.capture.file))), { bytes: row.capture.bytes, sha256: row.capture.sha256 });
  const action = json<Action>(row.capture.file);
  exactKeys(action, ['commandCount', 'beforeLast', 'lastIntent', 'final', 'randomBefore', 'randomAfter', 'publicBefore', 'public', 'globalPublicBefore', 'globalPublic', 'audit']);
  const { capture: _capture, ...audit } = row;
  same(action.audit, { ...audit, elapsedMilliseconds: null }); assert.equal(action.commandCount, row.commandCount); same(action.lastIntent, row.intent);
  for (const [value, expected] of [[action.beforeLast, row.beforeStateSha256], [action.final, row.afterStateSha256],
    [action.publicBefore, row.publicBeforeSha256], [action.public, row.publicAfterSha256],
    [action.globalPublicBefore, row.globalPublicBeforeSha256], [action.globalPublic, row.globalPublicAfterSha256]] as const) assert.equal(hash(value), expected);
  assert.deepEqual(action.randomBefore, row.randomBefore); assert.deepEqual(action.randomAfter, row.randomAfter);
  assert.deepEqual(action.beforeLast.random, row.randomBefore); assert.deepEqual(action.final.random, row.randomAfter);
  same(capturePublic(action.globalPublicBefore), action.publicBefore); same(capturePublic(action.globalPublic), action.public);
  assert.deepEqual(outcome(action.public), row.selectionOutcome); return action;
}
export interface LoadedCapture { original: HistoricalSource; archived: History; initial: SliceState; checkpoint: Checkpoint; rows: Row[]; summary: Summary }
export function loadCapture(): LoadedCapture {
  authenticateInputs();
  const archived = json<History>('archived-original666.json.gz'), original = archived.final;
  assert.equal(archived.commands.length, PREFIX); assert.equal(compactHash(archived.commands), PINS.prefixSha256);
  assert.deepEqual([original.schemaVersion, original.contentVersion], [189, 'all-knowing-eye-v189']);
  assert.equal(compactHash(original), PINS.originalStateSha256);
  const initial = migrateSliceState(original); assertValidSliceState(initial);
  assert.equal(compactHash(original), PINS.originalStateSha256); assert.equal(hash(historicalWhiteTowerState(initial)), PINS.initialStateSha256);
  for (const [key, value] of Object.entries(original)) if (!['schemaVersion', 'contentVersion'].includes(key))
    same(initial[key as keyof SliceState], value, `Migration altered original666 field ${key}`);
  const migrated = json<{ final: HistoricalWhiteTowerState; random: SliceState['random']; public: CapturedPublic; globalPublic: HistoricalWhiteTowerPublic }>('migration-initial.json.gz');
  assert.equal(hash(migrated.final), PINS.initialStateSha256);
  assert.deepEqual([migrated.final.schemaVersion, migrated.final.contentVersion], [211, 'white-tower-v211']);
  assert.equal(Object.hasOwn(migrated.final, 'tyrant'), false); assert.equal(Object.hasOwn(migrated.final, 'sun'), false); assert.equal(Object.hasOwn(migrated.final, 'death'), false); assert.equal(Object.hasOwn(migrated.final, 'door'), false); assert.equal(Object.hasOwn(migrated.final, 'errorAscent'), false);
  exactKeys(initial, [...Object.keys(migrated.final), 'tyrant', 'sun', 'death', 'door', 'errorAscent']);
  same(historicalWhiteTowerState(initial), migrated.final); same(migrated.random, initial.random);
  const initialGlobal = projectSliceState(initial); assertGlobalPublic(initialGlobal, initial);
  same(historicalWhiteTowerPublic(initialGlobal, initial), migrated.globalPublic); same(capturePublic(initialGlobal), migrated.public);
  assert.equal(hash(migrated.globalPublic), PINS.initialGlobalPublicSha256); assert.equal(hash(migrated.public), PINS.initialPublicSha256);
  const wrapper = json<{ sha256: string; payload: Checkpoint }>('checkpoint.json.gz');
  assert.equal(wrapper.sha256, hash(wrapper.payload)); const cp = wrapper.payload;
  assert.equal(cp.format, 'WHITE_TOWER666_DURABLE_PUBLIC_ACTION_BOUNDARY_V1'); assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_SHA);
  for (const key of ['prefixSha256', 'inputFreezeSha256', 'runtimeFreezeSha256', 'initialStateSha256', 'finalStateSha256', 'initialPublicSha256', 'initialGlobalPublicSha256', 'initialRandomSha256'] as const) assert.equal(cp[key], PINS[key]);
  assert.equal(cp.publicStateSha256, PINS.finalPublicSha256); assert.equal(cp.globalPublicStateSha256, PINS.finalGlobalPublicSha256);
  assert.equal(hash(cp.state), PINS.finalStateSha256); assert.equal(hash(cp.state.random), PINS.finalRandomSha256);
  assert.deepEqual(cp.migration, { originalStateSha256: PINS.originalStateSha256, migratedStateSha256: PINS.initialStateSha256, fromSchema: 189, toSchema: 211 });
  assert.equal(cp.commandCount, 803); assert.equal(cp.commands.length, NEW_COMMANDS); assert.equal(cp.pending, null);
  assert.deepEqual(cp.terminal, { stage: PINS.stage, reason: PINS.reason });
  const natural = json<Natural>('natural.json.gz'), summary = json<Summary>('summary.json');
  same(natural.final, cp.state); same(natural.creation, archived.creation); assert.equal(natural.seed, archived.seed);
  assert.equal(natural.prefixCount, PREFIX); same(natural.commands, [...archived.commands, ...cp.commands]);
  same(natural.policy, cp.policyDefinition); same(natural.boundaries, cp.boundaries);
  assert.equal(natural.pendingIntent, null); assert.equal(natural.stage, PINS.stage); assert.equal(natural.reason, PINS.reason);
  assert.deepEqual(summary, { stage: PINS.stage, reason: PINS.reason, commands: 803, originalCommands: PREFIX, newCommands: NEW_COMMANDS,
    week: 174, paused: false, diagnostic: false, strictFinalValidation: true, sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', checkpoint: 'checkpoint.json.gz', public: summary.public });
  assert.equal(hash(summary.public), PINS.finalPublicSha256);
  const ledger = decoded(join(ROOT, 'commands.ndjson.gz')).toString('utf8');
  assert.equal(ledger, cp.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const rows = cp.rows; assert.equal(rows.length, NEW_COMMANDS);
  let privateHash = PINS.initialStateSha256, publicHash = PINS.initialPublicSha256, globalHash = PINS.initialGlobalPublicSha256,
    randomHash = PINS.initialRandomSha256, policyHash = PINS.initialPolicySha256;
  for (const [index, row] of rows.entries()) {
    assert.equal(row.commandCount, PREFIX + index + 1); assert.equal(row.revision, row.commandCount + 1);
    same(row.intent, cp.commands[index]); assert.equal(row.intent.type, 'WHITE_TOWER'); assert.equal(row.commandSha256, compactHash(row.intent));
    assert.equal(row.beforeStateSha256, privateHash); assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.globalPublicBeforeSha256, globalHash);
    assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(hash(row.randomBefore), row.randomBeforeSha256); assert.equal(hash(row.randomAfter), row.randomAfterSha256);
    assert.equal(row.randomBefore.seed, original.random.seed); assert.equal(row.randomAfter.seed, original.random.seed);
    assert(row.randomAfter.cursor >= row.randomBefore.cursor); assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
    privateHash = row.afterStateSha256; publicHash = row.publicAfterSha256; globalHash = row.globalPublicAfterSha256;
    randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(privateHash, PINS.finalStateSha256); assert.equal(publicHash, PINS.finalPublicSha256); assert.equal(globalHash, PINS.finalGlobalPublicSha256);
  assert.equal(randomHash, PINS.finalRandomSha256); assert.equal(policyHash, hash(cp.policy));
  same(json<BoundaryIndex[]>('boundaries.index.json'), cp.boundaries); assert.equal(cp.boundaries.length, 26);
  assert.equal(new Set(cp.boundaries.map(item => item.commandCount)).size, 26);
  for (const { commandCount, kind, ...pin } of cp.boundaries) { assert(kind); assert.deepEqual(pin, rows[commandCount - PREFIX - 1]!.capture); }
  return { original, archived, initial, checkpoint: cp, rows, summary };
}
