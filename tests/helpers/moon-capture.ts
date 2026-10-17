import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { projectDarkness } from '../../src/domain/darkness/index.js';
import { projectWhiteTower } from '../../src/domain/white-tower/index.js';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

/** Read-only independent capture contract. Never imports or runs the producer,
 * a controlled-success helper, compiled runtime, or the SQLite verifier. */
export const ROOT = 'tests/fixtures/moon-v02120';
export const SOURCE = 'tests/fixtures/beauty-goddess-v01900/script-blocker-first.json';
export const SOURCE_SHA = '195064d584c3fa6bb7c87584970ab5e2a43d5493613cb66afa3252902fc453eb';
export const PREFIX_SHA = '40c5fe395855437d65c9c670916fe4bbc6a0db2fb683e8c9472de57e1cd409bc';
export const PREFIX = 670, BOUNDARY_LIMIT = 30;
export const POLICY = {
  id: 'MOON670_SAME_ORIGINAL_RECOVERY_NIGHT_SERVICES_V1', startWeek: 160,
  wage: 180, weeklyLiving: 30, defaultObservationActions: 500, selectedBoundaryLimit: 30,
  recovery: 'SAME_FAILED_ORIGINAL_120P_1AP_LATER_WEEK_1AP_FIVE_FRESH_JOBS_90P_PREPARE_150P',
  practice: 'THREE_ACTUAL_BEAUTY_CASES_ORDINARY_RETURNS_REFLECTION_AND_ACTUAL_DATE',
  services: 'THREE_REAL_NIGHT_STATIONS_PAID_OIL_WINDOWS_CLOSURES_SHORE_RETURNS_REPAIR',
  promotion: 'THREE_CONSERVED_ORIGINALS_ONE_UNIQUENESS_PAID_SAME_COMPOUND_STABILITY',
  epilogue: 'FINITE_ACTUAL_TECHNIQUES_OR_ORDINARY_EVACUATION_REPORT', noReroll: true,
};
export const INITIAL_POLICY = {
  phase: 'BEAUTY_RECOVERY', week: 160, recoveryTarget: 'beauty-goddess-potion-1',
  beautyDoses: 0, moonDoses: 0, epilogueAttempted: [] as string[], reported: false,
  loop: { key: null as string | null, repetitions: 0 },
};
export interface FilePin { bytes: number; sha256: string }
/** Immutable capture input format, distinct from the current runtime state. */
export type HistoricalMoonState = Omit<SliceState, 'schemaVersion' | 'contentVersion' | 'darkness' | 'whiteTower'> & {
  schemaVersion: 209; contentVersion: 'moon-v209';
};
export interface Member extends FilePin { file: string; originalBytes?: number; originalSha256?: string }
export interface BoundaryIndex extends FilePin { file: string; kind: string; commandCount: number }
export interface Outcome { status: SliceState['status']; beautyPromoted: boolean; moonPromoted: boolean }
export interface Row {
  commandCount: number; intent: SliceIntent; commandSha256: string; reason: string; publicLabel: string; publicCost: string;
  startedAt: string; elapsedMilliseconds: number; revision: number; week: number;
  beforeStateSha256: string; afterStateSha256: string; publicBeforeSha256: string; publicAfterSha256: string;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; randomBeforeSha256: string; randomAfterSha256: string;
  policyBeforeSha256: string; policyAfterSha256: string; selectionOutcome: Outcome;
  receipts: { checks: unknown[]; finance: unknown[]; notes: unknown[] };
}
export interface Checkpoint {
  format: string; source: string; sourceSha256: string; prefixSha256: string; freezeSha256: string;
  policyDefinition: typeof POLICY; policy: typeof INITIAL_POLICY; createdAt: string;
  commandCount: number; commands: SliceIntent[]; rows: Row[]; boundaries: BoundaryIndex[]; state: HistoricalMoonState;
  initialStateSha256: string; finalStateSha256: string; initialPublicSha256: string; publicStateSha256: string;
  initialRandomSha256: string; pending: unknown | null; terminal: { stage: string; reason: string } | null; predecessorSha256: string;
}
export interface Boundary {
  commandCount: number; beforeLast: HistoricalMoonState; lastIntent: SliceIntent; final: HistoricalMoonState;
  public: CapturedPublic; audit: Omit<Row, 'elapsedMilliseconds'> & { elapsedMilliseconds: null };
}
interface History { commands: SliceIntent[]; final: SliceState; creation: unknown; seed: string }
interface Natural extends Omit<History, 'final'> {
  final: HistoricalMoonState;
  provenance: Record<string, unknown>; prefixCount: number; policy: typeof POLICY; stage: string; reason: string;
  pendingIntent: null; boundaries: BoundaryIndex[];
}
interface Summary {
  stage: string; reason: string; commands: number; originalCommands: number; newCommands: number; week: number;
  paused: boolean; diagnostic: boolean; strictFinalValidation: boolean; checkpoint: string; public: CapturedPublic;
}
export interface Manifest { format: string; files: Member[] }
export interface Freeze { sha256: string; nodeVersion: string; files: Array<FilePin & { file: string }> }
export interface MoonCaptureEvidence {
  /** The verifier requires this reviewed complete-input manifest outside ROOT. */
  inputManifest: string; inputManifestSha256: string; freezeSha256: string;
  initialStateSha256: string; initialPublicSha256: string; initialRandomSha256: string;
  finalStateSha256: string; finalPublicSha256: string; finalRandomSha256: string;
  newCommands: number; selectedBoundaries: number; stage: string; reason: string; paused: boolean; diagnostic: boolean;
  finalOutcome: Outcome; finalRevision: number; finalWeek: number; finalSequence: number;
  /** Three distinct, reviewed actual indexed transitions; never fabricated. */
  sqliteCommandCounts: readonly [number, number, number];
}
/** Actual reviewed212 capture: original670 +254 genuine commands. The fifth
 * same-original S1 recovery dose promoted at763; the first Moon dose promoted
 * at903; the finite incident was actually reported at924. These are recorded
 * outcomes, never a target used to select a route, seed or replacement die. */
export const MOON_CAPTURE_EVIDENCE: MoonCaptureEvidence = {
  inputManifest: 'test-inputs/moon-v02120-capture-files.json',
  inputManifestSha256: '2a0184b5618aba7601e9a516b3a721b32b0dc58bfca34589209877f9093dd79c',
  freezeSha256: 'b69820c9a81ce5a39daa27a54c72fa5cd675ec595fbe5e382bfdc21c2d283604',
  initialStateSha256: '7ebf562b32e77de940017759860600a772e90c597b6ddee717c3259eaa5455b4',
  initialPublicSha256: 'c0a3371390de9a862abedb0fc305f5845567f09be58ed260bc8c471fe0fb635b',
  initialRandomSha256: '4f41b4b2441e38c361cb89f7f40f30825b75157c783eec01fd0c0e11da4f4153',
  finalStateSha256: 'c472ed58e854dc9456031cbb471c47d3f325f4ba3fcae506786038b58e70dd28',
  finalPublicSha256: 'f37e2442892d02446d4305e9c0d84628787326c68dd00f7d16e24ba2e23db4ea',
  finalRandomSha256: '42fdc5f5d59be95c84f5d6580edfae627b2512a718b8895f72adc1146fff1475',
  newCommands: 254, selectedBoundaries: 26,
  stage: 'NATURAL_FINITE_MOON_REPORTED',
  reason: 'The actual finite incident was reported; no rerun or successful skill is forced',
  paused: false, diagnostic: false,
  finalOutcome: { status: 'ACTIVE', beautyPromoted: true, moonPromoted: true },
  finalRevision: 925, finalWeek: 211, finalSequence: 0,
  sqliteCommandCounts: [763, 903, 924],
};
export const evidence = (): MoonCaptureEvidence => MOON_CAPTURE_EVIDENCE;
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
export const same = (actual: unknown, expected: unknown, message?: string): void => assert.equal(hash(actual), hash(expected), message);
const digest = (value: unknown): void => assert(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), 'Expected reviewed SHA256');
const whole = (value: number): void => assert(Number.isSafeInteger(value) && value >= 0);
const exactKeys = (value: object, expected: string[]): void => assert.deepEqual(Object.keys(value).sort(), expected.sort());
const EMPTY_DARKNESS: SliceState['darkness'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  evacuation: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
const EMPTY_WHITE_TOWER: SliceState['whiteTower'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  passages: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
/** Detached audit view only. Remove exactly the independently specified default
 * Darkness/White Tower roots and restore the capture's version tags. Every other field,
 * including any unexpected root, remains covered by the historical hash. */
export function historicalMoonState(state: SliceState): HistoricalMoonState {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assert.deepEqual(state.darkness, EMPTY_DARKNESS);
  assert.deepEqual(state.whiteTower, EMPTY_WHITE_TOWER);
  const { darkness: _emptyDarkness, whiteTower: _emptyWhiteTower, ...originalFields } = state;
  return { ...originalFields, schemaVersion: 209, contentVersion: 'moon-v209' };
}
/** Strict current ingress must preserve every original 209 field and may add
 * only the reviewed default Darkness/White Tower roots; it never rewrites the raw input. */
export function migrateCapturedMoonState(raw: HistoricalMoonState): SliceState {
  assert.deepEqual([raw.schemaVersion, raw.contentVersion], [209, 'moon-v209']);
  assert.equal(Object.hasOwn(raw, 'darkness'), false);
  assert.equal(Object.hasOwn(raw, 'whiteTower'), false);
  const before = hash(raw), current = migrateSliceState(raw);
  assertValidSliceState(current);
  exactKeys(current, [...Object.keys(raw), 'darkness', 'whiteTower']);
  same(historicalMoonState(current), raw, 'Migration changed the complete captured Moon state');
  assert.equal(hash(raw), before, 'Migration changed the raw Moon input');
  return current;
}
/** Verify both entire new inactive public roots before removing just those roots
 * from a detached historical view. Unknown fields are never filtered out. */
export function historicalMoonPublic(projection: SliceProjection, state: SliceState): Omit<SliceProjection, 'darkness' | 'whiteTower'> {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assert.deepEqual(state.darkness, EMPTY_DARKNESS);
  assert.deepEqual(state.whiteTower, EMPTY_WHITE_TOWER);
  assert.equal(state.progression.pathwayId, 'moon');
  assert.equal(Object.hasOwn(projection, 'darkness'), true);
  const root = projection.darkness;
  assert.deepEqual(root, projectPlayerText(projectDarkness(state), state.character.name));
  exactKeys(root, ['title', 'guidanceKnown', 'promoted', 'story', 'nextStep', 'risk', 'resources', 'abilities', 'actions', 'sections', 'insideCase']);
  assert.equal(root.guidanceKnown, false); assert.equal(root.promoted, false); assert.equal(root.insideCase, false);
  assert.deepEqual(root.abilities, []); assert.deepEqual(root.sections, []);
  assert(root.actions.every(action => !action.enabled));
  assert.deepEqual(root, {
    title: '序列0 黑暗', guidanceKnown: false, promoted: false,
    story: '原庭院里的人和物仍在原处。步行前往新街区，在白昼查路、问过四位成年人的意愿，入夜后用普通灯、原绳和亲身搀扶完成长夜撤离。',
    nextStep: '四人逐一在真实夜间抵达，再亲走返程；核清三份原特性，等待1353年真实事件后才交接同一唯一性，并为同一瓶付费准备。',
    risk: '完整准备按本人实际意志计算成功率，不改骰子。失败会留下伤势、污染并可能死亡。幸存者须原地封存、隔周付费回收，另购有限载体重新准备。',
    resources: { health: state.health, mind: state.mind, spirituality: state.spirituality,
      cash: `${state.cash}便士`, actionsRemaining: state.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'darkness:0:LEARN_GUIDANCE', label: '听取长夜撤离与三份原特性指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的厄难骑士继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  assert.equal(Object.hasOwn(projection, 'whiteTower'), true);
  assert.deepEqual(projection.whiteTower, projectPlayerText(projectWhiteTower(state), state.character.name));
  assert.deepEqual(projection.whiteTower, {
    title: '序列0 白塔', guidanceKnown: false, promoted: false,
    story: '原资料室、埃德温的庭院、两张原纸与停止的器材留在原处。街区接待处收到市场台阶、运河检修廊和公寓后巷三处阻路求助；分别亲自问过居民、实勘、修补和验收，再让本人真实通过，并于下一周回来复核。',
    nextStep: '完成三处原居民的真实通过与隔周复核；核清本人已有的一份和另外两份原特性，实地确认同一唯一性空位，再为同一本人的同一瓶付费准备。',
    risk: '成功率按本人实际意志与本瓶付费准备计算，不重掷。失败留下真实重伤和污染并可能死亡。幸存者只能在原处封存同一残余，隔周付费回收，再用剩余有价载体重配；总共只有三件载体。',
    resources: { health: state.health, mind: state.mind, spirituality: state.spirituality,
      cash: `${state.cash}便士`, actionsRemaining: state.actionsRemaining },
    abilities: [], sections: [], insideCase: false,
    actions: [{ id: 'white-tower:0:LEARN_GUIDANCE', label: '听取三条通路与三份原特性指导', cost: '1行动、100便士',
      command: { type: 'LEARN_GUIDANCE' }, enabled: false,
      reason: state.status === 'ACTIVE' ? '须由仍活着的全知之眼本人继续。' : '已经死亡或结束的角色不能继续行动。',
      preferredAction: true }],
  });
  const { darkness: _emptyDarkness, whiteTower: _emptyWhiteTower, ...originalFields } = projection;
  return originalFields;
}
function relativeFile(file: string): string {
  assert(file && !file.includes('\\') && !file.includes('\0') && !file.startsWith('/') && !/^[A-Za-z]:/.test(file));
  assert(file.split('/').every(part => part && part !== '.' && part !== '..')); return file;
}
export function bytes(path: string): Buffer {
  assert.equal(realpathSync(path), resolve(path), 'No symlink evidence');
  const stat = lstatSync(path, { bigint: true }); assert(stat.isFile() && !stat.isSymbolicLink());
  const result = readFileSync(path), after = lstatSync(path, { bigint: true });
  for (const key of ['size', 'mtimeNs', 'ctimeNs', 'ino'] as const) assert.equal(after[key], stat[key]);
  assert.equal(BigInt(result.length), stat.size); return result;
}
export function decoded(path: string): Buffer {
  const raw = bytes(path);
  if (!path.endsWith('.gz')) return raw;
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
const CAPTURED_RUNTIME_ROOTS = ['package.json', 'package-lock.json', 'src', 'dist/domain', 'dist/content', 'dist/resolution',
  'dist/persistence', 'dist/shared', 'dist/application', 'dist/simulation', 'node_modules/@noble/hashes', SOURCE];
const underRoot = (file: string, root: string): boolean => file === root || file.startsWith(`${root}/`);
/** Pure historical validation: a self-consistent rewritten freeze still fails
 * the independently reviewed pin. Current regression source is judged by strict
 * migration and every replayed private/RNG/public hash, not file-byte identity.
 * The separate actual SQLite verifier retains its full same-runtime freeze. */
export function assertCaptureFreeze(freeze: Freeze, pins: MoonCaptureEvidence): void {
  exactKeys(freeze, ['sha256', 'nodeVersion', 'files']); digest(freeze.sha256);
  assert.equal(freeze.sha256, pins.freezeSha256); assert.equal(compactHash(freeze.files), freeze.sha256);
  assert(/^v\d+\.\d+\.\d+$/.test(freeze.nodeVersion), 'Retain the recorded capture Node version');
  const names = freeze.files.map(row => row.file); assert.equal(new Set(names).size, names.length);
  assert(names.includes('$natural-producer'), 'Historical producer evidence is mandatory');
  for (const root of CAPTURED_RUNTIME_ROOTS) assert(names.some(file => underRoot(file, root)), `Missing historical freeze root ${root}`);
  for (const { file, ...pin } of freeze.files) {
    exactKeys(pin, ['bytes', 'sha256']); digest(pin.sha256); whole(pin.bytes);
    if (file !== '$natural-producer') {
      relativeFile(file); assert(CAPTURED_RUNTIME_ROOTS.some(root => underRoot(file, root)), `Unknown historical freeze input ${file}`);
    }
  }
  assert.equal(freeze.files.find(row => row.file === SOURCE)!.sha256, SOURCE_SHA);
}
/** Pure complete-set contract, also used with detached negative-test copies. */
export function assertCaptureManifest(manifest: Manifest, actualFiles: readonly string[]): void {
  exactKeys(manifest, ['format', 'files']); assert.equal(manifest.format, 'MOON212_CAPTURE_FILES_V1'); assert(manifest.files.length > 0);
  const names = manifest.files.map(row => relativeFile(row.file));
  assert.equal(new Set(names).size, names.length); assert.deepEqual(names, [...names].sort());
  for (const row of manifest.files) {
    const compressed = row.file.endsWith('.gz');
    exactKeys(row, compressed ? ['file', 'bytes', 'sha256', 'originalBytes', 'originalSha256'] : ['file', 'bytes', 'sha256']);
    whole(row.bytes); digest(row.sha256);
    if (compressed) { whole(row.originalBytes!); digest(row.originalSha256); }
  }
  assert.deepEqual(actualFiles, names, 'Exact complete capture input set, with no missing or extra file');
}
export function authenticateInputs(pins = evidence()): void {
  const manifestPath = resolve(pins.inputManifest), capturePath = resolve(ROOT);
  assert(manifestPath !== capturePath && !manifestPath.startsWith(`${capturePath}/`), 'Reviewed manifest must be outside capture');
  assert.equal(filePin(manifestPath).sha256, pins.inputManifestSha256);
  const manifest = JSON.parse(bytes(manifestPath).toString('utf8')) as Manifest;
  assertCaptureManifest(manifest, inventory(ROOT));
  for (const row of manifest.files) {
    const path = join(ROOT, row.file); assert.deepEqual(filePin(path), { bytes: row.bytes, sha256: row.sha256 });
    if (row.file.endsWith('.gz')) { const raw = decoded(path); assert.equal(raw.length, row.originalBytes); assert.equal(sha(raw), row.originalSha256); }
  }
  assert.equal(filePin(SOURCE).sha256, SOURCE_SHA);
  assert(decoded(join(ROOT, 'prefix-original670.json.gz')).equals(bytes(SOURCE)), 'Retain every original670 byte, including old pending/error');
  const freeze = json<Freeze>('freeze.json'); assertCaptureFreeze(freeze, pins);
  const producer = freeze.files.find(row => row.file === '$natural-producer')!;
  assert.deepEqual(filePin(join(ROOT, 'producer.mjs')), { bytes: producer.bytes, sha256: producer.sha256 });
}
const PUBLIC_FIELDS = ['runId', 'revision', 'status', 'week', 'date', 'actionsRemaining', 'weeklyBudget', 'cash', 'weeklyWage', 'wagePaid',
  'health', 'mind', 'spirituality', 'maxHealth', 'maxMind', 'maxSpirituality', 'pollution', 'injuries', 'injuryRisk',
  'debtTotal', 'debts', 'canAct', 'actionBlockedReason', 'activeEvent', 'combat'] as const;
export function capturePublic(projection: SliceProjection, state: SliceState) {
  const historical = historicalMoonPublic(projection, state);
  const ordinary = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, structuredClone(historical[key])])) as Pick<SliceProjection, typeof PUBLIC_FIELDS[number]>;
  return { ...ordinary, progression: { sequence: historical.progression.sequence, acting: historical.progression.acting,
    mastery: structuredClone(historical.progression.mastery) }, beautyGoddess: structuredClone(historical.beautyGoddess), moon: structuredClone(historical.moon) };
}
/** Full current public boundary, separate from the narrower immutable chapter
 * hash captured in 212. Check the entire inherited history before release. */
export function assertGlobalPublic(projection: SliceProjection, state: SliceState): void {
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore',
    'randomCursorAfter', 'cursorBefore', 'cursorAfter', 'preparedRoll', 'futureRoll', 'sourceDigest',
    'sourceIdentityDigest', 'beforeDigest', 'afterDigest', 'randomReceipts']);
  const paths: string[] = [];
  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      const next = Array.isArray(node) ? `${path}[${key}]` : `${path}.${key}`;
      if (forbidden.has(key)) paths.push(next);
      visit(child, next);
    }
  }
  visit(projection, '$'); assert.deepEqual(paths, [], 'Full public state must not expose private replay inputs');
  assert(!JSON.stringify(projection).includes(state.random.seed), 'Private random seed text must not leak');
}
export type CapturedPublic = ReturnType<typeof capturePublic>;
export const outcome = (view: CapturedPublic): Outcome => ({ status: view.status, beautyPromoted: view.beautyGoddess.promoted, moonPromoted: view.moon.promoted });
export function assertPublicAction(view: CapturedPublic, row: Pick<Row, 'intent' | 'publicLabel' | 'publicCost'>): void {
  const intent = row.intent;
  if (intent.type === 'ACTION') {
    assert(view.canAct && ['WORK', 'REST'].includes(intent.action)); if (intent.action === 'WORK') assert.equal(view.wagePaid, false);
    assert.equal(row.publicLabel, intent.action === 'WORK' ? '做本周原职业工作' : '按实际生活档休养');
    assert.equal(row.publicCost, '1行动；真实工资、生活费与旧债照常结算'); return;
  }
  if (intent.type === 'EVENT_CHOICE') {
    assert.equal(view.activeEvent?.instanceId, intent.eventInstanceId);
    const choice = view.activeEvent!.choices.find(item => item.id === intent.choiceId); assert(choice?.enabled);
    assert.equal(row.publicLabel, choice.label); assert.equal(row.publicCost, '按当前公开事件结算实际费用与旧债'); return;
  }
  assert(intent.type === 'BEAUTY_GODDESS' || intent.type === 'MOON');
  const actions = intent.type === 'MOON' ? view.moon.actions : view.beautyGoddess.actions;
  const offered = actions.filter(action => stable(action.command) === stable(intent.command));
  assert.equal(offered.length, 1); assert.equal(offered[0]!.enabled, true);
  assert.equal(row.publicLabel, offered[0]!.label); assert.equal(row.publicCost, offered[0]!.cost);
}
export function actualReceipts(after: SliceState, before: SliceState): Row['receipts'] {
  const latest = after.moon.guidanceKnown ? after.moon.journal.at(-1) : null;
  if (latest?.revision === after.revision) return { checks: latest.randomReceipts, finance: latest.financeReceipts, notes: latest.notes };
  const matching = [after.beautyGoddess.acquisitionJournal.at(-1), after.beautyGoddess.life.journal.at(-1)].filter(row => row?.revision === after.revision);
  return { checks: matching.filter(row => row?.check).map(row => row!.check), finance: [], notes: after.chronicle.slice(before.chronicle.length) };
}
/** Independent first-instance taxonomy; never requires a successful dose. */
export function boundaryKind(intent: SliceIntent, result: Outcome): string | null {
  if (intent.type === 'ACTION') { assert(['WORK', 'REST'].includes(intent.action)); return `first-ordinary-${intent.action.toLowerCase()}`; }
  if (intent.type === 'EVENT_CHOICE') return 'first-original-finance-event';
  assert(intent.type === 'BEAUTY_GODDESS' || intent.type === 'MOON'); const command = intent.command;
  if (intent.type === 'BEAUTY_GODDESS') {
    assert(!['REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(command.type), 'Never use archived912 independent supplies');
    if (['REQUEST_RECOVERY_V1', 'RECOVER_CHARACTERISTIC_V1', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'REFLECT'].includes(command.type)) return `s1-${command.type.toLowerCase()}`;
    if (command.type === 'CONSUME') return result.beautyPromoted ? 's1-actual-promotion' : 's1-first-recovery-failure';
  }
  if (intent.type === 'MOON') {
    const c = intent.command;
    if (['LEARN_GUIDANCE', 'STABILIZE_PROMOTION', 'START_EPILOGUE'].includes(c.type)) return `moon-${c.type.toLowerCase()}`;
    if (c.type === 'CONSUME') return result.status !== 'ACTIVE' ? 'moon-actual-terminal-dose' : result.moonPromoted ? 'moon-actual-promotion' : 'moon-first-failed-dose';
    if (c.type === 'SERVICE' && ['CONDUCT_SERVICE', 'VERIFY', 'REPAIR_DAMAGE'].includes(c.command.type)) return `night-${c.command.stationId}-${c.command.type.toLowerCase()}`;
    if (c.type === 'MATERIAL' && ['RECOVER_LEGACY_REMAINS', 'ACQUIRE_UNIQUENESS', 'COMPOSE_POTION', 'SEAL_REMAINS', 'RECOVER_SEALED'].includes(c.command.type)) return `moon-${c.command.type.toLowerCase()}`;
    if (c.type === 'EPILOGUE' && c.command.type === 'REPORT') return 'moon-finite-actual-report';
  }
  return null;
}
export function readBoundary(item: BoundaryIndex, row: Row): Boundary {
  assert.equal(item.file, `boundary-${item.commandCount}-${item.kind}.json.gz`);
  assert.deepEqual(filePin(join(ROOT, relativeFile(item.file))), { bytes: item.bytes, sha256: item.sha256 });
  const boundary = json<Boundary>(item.file); exactKeys(boundary, ['commandCount', 'beforeLast', 'lastIntent', 'final', 'public', 'audit']);
  assert.equal(boundary.commandCount, row.commandCount); same(boundary.lastIntent, row.intent);
  same(boundary.audit, { ...row, elapsedMilliseconds: null });
  assert.equal(hash(boundary.beforeLast), row.beforeStateSha256); assert.equal(hash(boundary.final), row.afterStateSha256);
  assert.equal(hash(boundary.public), row.publicAfterSha256); assert.deepEqual(outcome(boundary.public), row.selectionOutcome);
  for (const state of [boundary.beforeLast, boundary.final]) {
    assert.deepEqual([state.schemaVersion, state.contentVersion], [209, 'moon-v209']);
    assert.equal(Object.hasOwn(state, 'darkness'), false);
  }
  assert.equal(boundary.beforeLast.status, 'ACTIVE'); assert.equal(boundary.beforeLast.revision, row.commandCount);
  assert.equal(boundary.final.revision, row.revision); assert.equal(boundary.final.week, row.week);
  assert.deepEqual(boundary.beforeLast.random, row.randomBefore); assert.deepEqual(boundary.final.random, row.randomAfter);
  return boundary;
}
export interface LoadedCapture {
  pins: MoonCaptureEvidence; original: SliceState; prefixFinal: HistoricalMoonState; initial: SliceState;
  checkpoint: Checkpoint; rows: Row[]; summary: Summary;
}
export function loadCapture(): LoadedCapture {
  const pins = evidence(); authenticateInputs(pins);
  for (const name of ['inputManifestSha256', 'freezeSha256', 'initialStateSha256', 'initialPublicSha256', 'initialRandomSha256',
    'finalStateSha256', 'finalPublicSha256', 'finalRandomSha256'] as const) digest(pins[name]);
  whole(pins.newCommands); assert(pins.newCommands > 0); whole(pins.selectedBoundaries); assert(pins.selectedBoundaries <= BOUNDARY_LIMIT);
  assert.equal(pins.sqliteCommandCounts.length, 3); assert.equal(new Set(pins.sqliteCommandCounts).size, 3);
  assert(!existsSync(join(ROOT, 'checkpoint.json.gz.next'))); assert(!inventory(ROOT).some(file => file.endsWith('.derived-next')));
  assert(!existsSync(join(ROOT, 'continuation-proof.json')) && !existsSync(join(ROOT, 'prior-segment')), 'No changed-runtime branch');
  const history = JSON.parse(bytes(SOURCE).toString('utf8')) as History, original = history.final;
  assert.equal(history.commands.length, PREFIX); assert.equal(compactHash(history.commands), PREFIX_SHA);
  assert.deepEqual([original.schemaVersion, original.contentVersion, original.revision, original.status, original.week], [187, 'beauty-goddess-v187', 671, 'ACTIVE', 160]);
  assert.equal(original.runId, 'apothecary-rebuild-natural'); assert.deepEqual(original.random, { seed: 'apothecary-rebuild-first', cursor: 318 });
  assert.equal(history.seed, original.random.seed); assert.deepEqual(original.date, { epoch: 'FIFTH_EPOCH', year: 1352, month: 7, day: 15 });
  assert.deepEqual([original.health, original.mind, original.spirituality, original.cash, original.actionsRemaining, original.seer.pollution], [85, 75, 120, 14, 1, 30]);
  assert.equal(original.character.weeklyWage, 180); assert.equal(original.lifeTier, 'DESTITUTE'); assert.equal(original.wagePaidWeek, 160);
  assert.deepEqual(original.injuries, []); assert.equal(original.progression.pathwayId, 'moon'); assert.equal(original.progression.sequence, 2); assert.equal(original.progression.acting, 100);
  assert.equal(original.beautyGoddess.transformation.decision, 'ACCEPTED');
  assert.deepEqual(original.beautyGoddess.bottles.map(b => [b.id, b.status, b.outcome]), [1, 2, 3].map(n => [`beauty-goddess-potion-${n}`, 'CONSUMED', 'FAILURE']));
  assert.deepEqual(original.beautyGoddess.acquisitionJournal.filter(row => row.command.type === 'CONSUME').map(row => [row.check!.chance, row.check!.roll, row.check!.tier]), [[44, 48, 'FAILURE'], [44, 67, 'FAILURE'], [44, 86, 'FAILURE']]);
  assert.equal(Object.keys(original.progression.mastery).length, 21);
  assert.equal(Object.values(original.progression.mastery).filter(value => value === 0).length, 7);
  const originalHash = hash(original), initial = migrateSliceState(original);
  assert.equal(hash(original), originalHash);
  assert.deepEqual([initial.schemaVersion, initial.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  for (const [key, value] of Object.entries(original)) if (!['schemaVersion', 'contentVersion'].includes(key)) same((initial as unknown as Record<string, unknown>)[key], value, `Migration changed original670 ${key}`);
  // Strict current ingress validates the authentic original history; no old670 command replay.
  assertValidSliceState(initial); assert.equal(hash(historicalMoonState(initial)), pins.initialStateSha256);
  assert.equal(hash(initial.random), pins.initialRandomSha256);
  assert.equal(hash(capturePublic(projectSliceState(initial), initial)), pins.initialPublicSha256);
  const wrapped = json<{ sha256: string; payload: Checkpoint }>('checkpoint.json.gz'); exactKeys(wrapped, ['sha256', 'payload']);
  assert.equal(wrapped.sha256, hash(wrapped.payload)); const cp = wrapped.payload;
  exactKeys(cp, ['format', 'source', 'sourceSha256', 'prefixSha256', 'freezeSha256', 'policyDefinition', 'policy', 'createdAt', 'commandCount',
    'commands', 'rows', 'boundaries', 'state', 'initialStateSha256', 'finalStateSha256', 'initialPublicSha256', 'publicStateSha256', 'initialRandomSha256', 'pending', 'terminal', 'predecessorSha256']);
  assert.equal(cp.format, 'MOON670_DURABLE_PUBLIC_ACTION_BOUNDARY_V1'); assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_SHA); assert.equal(cp.prefixSha256, PREFIX_SHA);
  assert.equal(cp.freezeSha256, pins.freezeSha256); same(cp.policyDefinition, POLICY); assert.equal(cp.pending, null); digest(cp.predecessorSha256);
  assert(Number.isFinite(Date.parse(cp.createdAt))); assert.equal(cp.commands.length, pins.newCommands); assert.equal(cp.commandCount, PREFIX + pins.newCommands);
  assert.equal(cp.initialStateSha256, pins.initialStateSha256); assert.equal(cp.initialPublicSha256, pins.initialPublicSha256); assert.equal(cp.initialRandomSha256, pins.initialRandomSha256);
  assert.equal(cp.finalStateSha256, pins.finalStateSha256); assert.equal(cp.publicStateSha256, pins.finalPublicSha256);
  assert.equal(hash(cp.state), pins.finalStateSha256); assert.equal(hash(cp.state.random), pins.finalRandomSha256);
  assert.deepEqual([cp.state.schemaVersion, cp.state.contentVersion], [209, 'moon-v209']);
  assert.equal(Object.hasOwn(cp.state, 'darkness'), false);
  // The first captured predecessor is the exact 209 state at original670.
  // Read it from authenticated evidence rather than manufacturing old bytes
  // by treating today's migration output as the historical runtime's output.
  assert.equal(cp.boundaries[0]?.commandCount, PREFIX + 1);
  const prefixFinal = readBoundary(cp.boundaries[0]!, cp.rows[0]!).beforeLast;
  assert.equal(hash(prefixFinal), pins.initialStateSha256);
  same(initial, migrateCapturedMoonState(prefixFinal), 'Original670 and captured209 migrate to the same complete current state');
  const natural = json<Natural>('natural.json.gz'), summary = json<Summary>('summary.json');
  exactKeys(natural, ['provenance', 'creation', 'seed', 'prefixCount', 'commands', 'policy', 'stage', 'reason', 'pendingIntent', 'boundaries', 'final']);
  same(natural.final, cp.state); same(natural.creation, history.creation); assert.equal(natural.seed, history.seed);
  assert.equal(natural.prefixCount, PREFIX); assert.equal(compactHash(natural.commands.slice(0, PREFIX)), PREFIX_SHA);
  same(natural.commands, [...history.commands, ...cp.commands]); same(natural.policy, POLICY); same(natural.boundaries, cp.boundaries); assert.equal(natural.pendingIntent, null);
  assert.deepEqual(natural.provenance, { kind: 'EXACT_ORIGINAL_FAILED670_PUBLIC_MOON_CONTINUATION', source: SOURCE, sourceSha256: SOURCE_SHA,
    rawOriginalEvidence: 'prefix-original670.json.gz', prefixCommandsSha256: PREFIX_SHA, runtimeFreezeSha256: pins.freezeSha256,
    historicalPrefixReplayedByThisProducer: false, originalPrefixRetainedExactly: true, originalFirstFailureRetained: true,
    archived912Used: false, privateAudit: true, seedChanged: false, randomOverridden: false, selectedFromEnabledPublicActionsOnly: true,
    projectionScope: 'CURRENT_BEAUTY_MOON_AND_ORDINARY_PUBLIC_DASHBOARD' });
  assert.equal(natural.stage, pins.stage); assert.equal(natural.reason, pins.reason);
  const stages = ['MANUAL_PAUSE', 'PUBLIC_ACTION_BLOCKED', 'PUBLIC_STABILITY_BINDING_BLOCKED', 'PUBLIC_NO_PROGRESS_DIAGNOSTIC', 'NATURAL_ACTUAL_TERMINAL', 'NATURAL_FINITE_MOON_REPORTED'];
  assert(stages.includes(pins.stage)); assert.equal(pins.paused, pins.stage === 'MANUAL_PAUSE');
  assert.equal(pins.diagnostic, stages.slice(1, 4).includes(pins.stage));
  assert.deepEqual(cp.terminal, pins.paused || pins.diagnostic ? null : { stage: pins.stage, reason: pins.reason });
  assert.deepEqual(summary, { stage: pins.stage, reason: pins.reason, commands: cp.commandCount, originalCommands: PREFIX,
    newCommands: pins.newCommands, week: cp.policy.week, paused: pins.paused, diagnostic: pins.diagnostic,
    strictFinalValidation: true, checkpoint: 'checkpoint.json.gz', public: summary.public });
  assert.equal(hash(summary.public), pins.finalPublicSha256); assert.deepEqual(outcome(summary.public), pins.finalOutcome);
  assert.equal(cp.state.status, pins.finalOutcome.status); assert.equal(cp.state.revision, pins.finalRevision);
  assert.equal(cp.state.revision, cp.commandCount + 1);
  assert.equal(cp.state.week, pins.finalWeek); assert.equal(cp.state.progression.sequence, pins.finalSequence);
  if (pins.stage === 'NATURAL_ACTUAL_TERMINAL') { assert(['DEAD', 'SLICE_COMPLETE', 'REVIVAL_PENDING'].includes(cp.state.status)); assert.equal(pins.reason, `Actual runtime status ${cp.state.status}`); }
  else assert.equal(cp.state.status, 'ACTIVE');
  if (pins.stage === 'NATURAL_FINITE_MOON_REPORTED') assert.equal(cp.policy.reported, true);
  const ledger = decoded(join(ROOT, 'commands.ndjson.gz')).toString('utf8');
  assert.equal(ledger, cp.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const rows = ledger.trimEnd().split('\n').map(line => JSON.parse(line) as Row); assert.equal(rows.length, pins.newCommands);
  let privateHash = cp.initialStateSha256, publicHash = cp.initialPublicSha256, randomHash = cp.initialRandomSha256, policyHash = hash(INITIAL_POLICY);
  const expected: Array<{ kind: string; commandCount: number }> = [], seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    exactKeys(row, ['commandCount', 'intent', 'commandSha256', 'reason', 'publicLabel', 'publicCost', 'startedAt', 'elapsedMilliseconds', 'revision', 'week',
      'beforeStateSha256', 'afterStateSha256', 'publicBeforeSha256', 'publicAfterSha256', 'randomBefore', 'randomAfter', 'randomBeforeSha256', 'randomAfterSha256',
      'policyBeforeSha256', 'policyAfterSha256', 'receipts', 'selectionOutcome']);
    assert.equal(row.commandCount, PREFIX + index + 1); assert.equal(row.revision, row.commandCount + 1); whole(row.week); whole(row.elapsedMilliseconds);
    assert(Number.isFinite(Date.parse(row.startedAt))); for (const key of ['reason', 'publicLabel', 'publicCost'] as const) assert.equal(typeof row[key], 'string');
    same(row.intent, cp.commands[index]); assert.equal(row.commandSha256, compactHash(row.intent));
    assert.equal(row.beforeStateSha256, privateHash); assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(row.randomBeforeSha256, hash(row.randomBefore)); assert.equal(row.randomAfterSha256, hash(row.randomAfter));
    for (const rng of [row.randomBefore, row.randomAfter]) { exactKeys(rng, ['seed', 'cursor']); assert.equal(rng.seed, original.random.seed); whole(rng.cursor); }
    assert(row.randomAfter.cursor >= row.randomBefore.cursor); for (const value of [row.afterStateSha256, row.publicAfterSha256, row.policyAfterSha256]) digest(value);
    exactKeys(row.selectionOutcome, ['status', 'beautyPromoted', 'moonPromoted']); assert(['ACTIVE', 'DEAD', 'SLICE_COMPLETE', 'REVIVAL_PENDING'].includes(row.selectionOutcome.status));
    assert.equal(typeof row.selectionOutcome.beautyPromoted, 'boolean'); assert.equal(typeof row.selectionOutcome.moonPromoted, 'boolean');
    if (index < rows.length - 1) assert.equal(row.selectionOutcome.status, 'ACTIVE');
    exactKeys(row.receipts, ['checks', 'finance', 'notes']); for (const value of Object.values(row.receipts)) assert(Array.isArray(value));
    const kind = boundaryKind(row.intent, row.selectionOutcome);
    if (kind && !seen.has(kind) && expected.length < BOUNDARY_LIMIT) { seen.add(kind); expected.push({ kind, commandCount: row.commandCount }); }
    privateHash = row.afterStateSha256; publicHash = row.publicAfterSha256; randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(privateHash, pins.finalStateSha256); assert.equal(publicHash, pins.finalPublicSha256); assert.equal(randomHash, pins.finalRandomSha256);
  assert.equal(policyHash, hash(cp.policy)); assert.equal(cp.policy.week, cp.state.week); assert.equal(rows.at(-1)!.week, cp.state.week);
  assert.deepEqual(rows.at(-1)!.selectionOutcome, pins.finalOutcome);
  assert.deepEqual(json<BoundaryIndex[]>('boundaries.index.json'), cp.boundaries); assert.equal(cp.boundaries.length, pins.selectedBoundaries);
  assert.deepEqual(cp.boundaries.map(({ kind, commandCount }) => ({ kind, commandCount })), expected);
  assert.equal(new Set(cp.boundaries.map(item => item.file)).size, expected.length); assert.equal(new Set(cp.boundaries.map(item => item.commandCount)).size, expected.length);
  for (const item of cp.boundaries) { exactKeys(item, ['file', 'kind', 'commandCount', 'bytes', 'sha256']); readBoundary(item, rows[item.commandCount - PREFIX - 1]!); }
  assert.equal(cp.boundaries[0]?.commandCount, PREFIX + 1); assert.deepEqual(cp.commands[0], { type: 'ACTION', action: 'REST' });
  for (const count of pins.sqliteCommandCounts) assert(cp.boundaries.some(item => item.commandCount === count), 'SQLite sample must be an actual selected boundary');
  return { pins, original, prefixFinal, initial, checkpoint: cp, rows, summary };
}
