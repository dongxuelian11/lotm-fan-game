import { assertEmptyDemonessState, assertEmptyDemonessPublic } from './empty-demoness-capture.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';
import { assertEmptyErrorAscentState, assertEmptyErrorAscentPublic } from './empty-error-ascent-capture.js';
import { assertEmptyTwilightGiantState, assertEmptyTwilightGiantPublic } from './empty-twilight-giant-capture.js';
import { createSunState } from '../../src/domain/sun/index.js';
import { assertEmptyDeathState, assertEmptyDeathPublic, assertEmptyDoorState, assertEmptyDoorPublic } from './empty-death-capture.js';

/** Read-only NEW215 evidence consumer. No producer imports, compiled runtime,
 * controlled-success fixture, random seam, alternate root or lost215 fallback. */
export const ROOT = 'tests/fixtures/tyrant-v02150';
export const INPUT_MANIFEST = `${ROOT}/capture-inputs.manifest.json`;
export const INPUT_MANIFEST_SHA = '099cea7c79a9d571b4f0755063a41c56f40349fb064069edb16acf65e1b5723a';
export const SOURCE = 'tests/fixtures/thunder-god-v01930/boundary-step-701-action.json';
export const SOURCE_SHA = '6d721f6e2376085b77026c8a9373fbed5b005ee8a2413d27cdf5f02a4303f708';
export const ARCHIVE = 'tests/fixtures/thunder-god-v01930/natural.json';
export const ARCHIVE_SHA = 'd682e3656fa4f8fb70f09e38b71355c50b4657c5ab7263201afa3c97b2c3f8b1';
export const PREFIX = 701, NEW_COMMANDS = 163;
export const CAPTURE_SCHEMA = 212, CAPTURE_CONTENT = 'tyrant-v212';
export const CURRENT_IS_CAPTURE_FORMAT = Number(CURRENT_SCHEMA_VERSION) === CAPTURE_SCHEMA && String(CURRENT_CONTENT_VERSION) === CAPTURE_CONTENT;
export const PINS = {
  naturalSha256: '988c66b6ad68f2c048c2ed0f1bb98b88c9d8ac46cb37624fe1c9fe25d321708a',
  originalStateSha256: '46f9e02789ce3b8b948a8110ab84c2ff7ee8651a7bc03b28876d1d90bc1bc788',
  prefixSha256: 'c015b29d305accb2a3ed61c77aa736f3789d3568587afd952c917720d995eaac',
  inputFreezeSha256: 'e0c90e36fa1b47596bdfef3bfec3d6e0af686c67fa32285b6678ef9551e4d474',
  runtimeFreezeSha256: '4f05734e47058f3845d70df818dd470983990d743199e18d6e527aa2bd79a93b',
  initialStateSha256: '18ffda152d9086e5f817750f34d2da4d4e51307b05ace0e019fbf3801e6829d4',
  finalStateSha256: 'f1131cd1acec94a34e6ee0440ec8769059f7d321ad918742b24cc0977a154937',
  initialPublicSha256: 'd5ec75fedfdf80751ee497544fc2eff4deb9395c68cd55277bcd7a2130469032',
  finalPublicSha256: '429036751101585e8654e0e06baf58a69deae7a7b2ff4919765f962c2e3b517d',
  initialGlobalPublicSha256: '7540cc63d11341650698456214d3d3affa5cd7b0a4ba1ba7f8c98b7da9154fb5',
  finalGlobalPublicSha256: '11f55d0ac868cc4576d450bbcf02fcdf99b90891188d6015c98090fd389dd937',
  initialRandomSha256: 'ec99e29a659c78baba70f57be5a8cd718176c573bec9ee5c3aa9bacf0d4afa46',
  finalRandomSha256: '22d180326e9f60d29e75dcd96933ba89014bba8dfbcd2746c0b4ae0abc4b6976',
  initialPolicySha256: 'ed5dc77e0afb4882ad97a92e3b6061796690c2b8cf85f7a1616448fb8beb473c',
  stage: 'NATURAL_ACTUAL_TERMINAL', reason: 'Actual runtime status DEAD',
  sqliteCommandCounts: [717, 780, 830, 864] as const,
  boundaryCommandCounts: [702, 704, 714, 715, 716, 717, 738, 755, 776, 777, 780, 786, 791, 796, 801,
    804, 808, 809, 821, 825, 830, 834, 838, 847, 850, 856, 857, 864] as const,
};
export interface FilePin { bytes: number; sha256: string }
export interface Member extends FilePin { file: string; originalBytes?: number; originalSha256?: string }
export interface Manifest { format: string; files: Member[] }
export interface Freeze { sha256: string; nodeVersion: string; files: Array<FilePin & { file: string }> }
export interface BoundaryIndex extends FilePin { file: string; kind: string; commandCount: number }
export interface Outcome { status: SliceState['status']; sequence: SliceProjection['progression']['sequence']; promoted: boolean; guidance: boolean; s1Reflected: boolean }
export interface Policy {
  phase: string; week: number; s1SourceBottleId: string; s1StabilizedBottleId: string | null;
  s1Doses: number; doses: number; carriers: string[]; epilogueAttempted: string[]; reported: boolean;
  loop: { key: string | null; repetitions: number };
}
export interface Row {
  commandCount: number; intent: SliceIntent; commandSha256: string; reason: string; publicLabel: string; publicCost: string;
  startedAt: string; elapsedMilliseconds: number; revision: number; week: number;
  beforeStateSha256: string; afterStateSha256: string; publicBeforeSha256: string; publicAfterSha256: string;
  globalPublicBeforeSha256: string; globalPublicAfterSha256: string;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; randomBeforeSha256: string; randomAfterSha256: string;
  policyBeforeSha256: string; policyAfterSha256: string; selectionOutcome: Outcome;
  receipts: { checks: unknown[]; acquisition?: unknown[]; life?: unknown[]; finance: unknown[]; notes: unknown[] };
  capture: FilePin & { file: string };
}
export interface Continuation {
  format: string; anchor: { kind: string; commandCount: number; newCommands: number; checkpointSha256: string;
    envelopeSha256: string; stateSha256: string; runtimeFreezeSha256: string; runtimeFreezeFileSha256: string;
    producerSha256: string; inputFreezeSha256: string; blockedReason: string };
  firstPossibleNewCommand: number; inheritedCommandsVerifiedByBothPolicies: number; oldOutcomesRetained: boolean;
  runtimeRulesChanged: boolean; change: string; predecessorDirectory: string; predecessorFiles: Member[];
  predecessorFilesSha256: string; newRuntimeFreezeSha256: string; producer: FilePin; tool: FilePin;
}
export interface Checkpoint {
  format: string; source: string; sourceSha256: string; prefixSha256: string; inputFreezeSha256: string; runtimeFreezeSha256: string;
  migration: { originalStateSha256: string; migratedStateSha256: string; fromSchema: number; toSchema: number };
  policyDefinition: Record<string, unknown>; policy: Policy; continuation835: Continuation;
  commandCount: number; commands: SliceIntent[]; rows: Row[]; boundaries: BoundaryIndex[]; state: SliceState;
  initialStateSha256: string; finalStateSha256: string; initialPublicSha256: string; publicStateSha256: string;
  initialGlobalPublicSha256: string; globalPublicStateSha256: string; initialRandomSha256: string;
  pending: unknown | null; terminal: { stage: string; reason: string } | null;
}
export interface Action {
  commandCount: number; beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState;
  randomBefore: SliceState['random']; randomAfter: SliceState['random']; publicBefore: CapturedPublic; public: CapturedPublic;
  globalPublicBefore: SliceProjection; globalPublic: SliceProjection; policyBefore: Policy; policyAfter: Policy;
  audit: Omit<Row, 'elapsedMilliseconds' | 'capture'> & { elapsedMilliseconds: null };
}
export type HistoricalSource = Omit<SliceState, 'schemaVersion' | 'contentVersion'> & { schemaVersion: 190; contentVersion: 'thunder-god-v190' };
export interface History { commands: SliceIntent[]; final: HistoricalSource; creation: unknown; seed: string }
interface Natural extends Omit<History, 'final'> {
  final: SliceState; provenance: Record<string, unknown>; prefixCount: number; policy: Record<string, unknown>;
  stage: string; reason: string; pendingIntent: null; boundaries: BoundaryIndex[];
}
export interface Summary {
  stage: string; reason: string; commands: number; originalCommands: number; newCommands: number; week: number;
  rebuild: string; lostOriginal215Restored: boolean; controlledStop: boolean; paused: boolean; diagnostic: boolean;
  strictFinalValidation: boolean; continuation835: Continuation; sqliteReopenValidation: string; checkpoint: string; public: CapturedPublic;
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
/** Recursively inventory retained835 too; the external manifest excludes itself. */
export function captureFiles(directory = ROOT, prefix = ''): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name), stat = lstatSync(path); assert(!stat.isSymbolicLink());
    const relative = prefix + name;
    return stat.isDirectory() ? captureFiles(path, `${relative}/`) : [relative];
  }).filter(file => file !== 'capture-inputs.manifest.json').sort();
}
export function assertCaptureManifest(manifest: Manifest, actualFiles: readonly string[]): void {
  exactKeys(manifest, ['format', 'files']); assert.equal(manifest.format, 'NEW215_TYRANT_CAPTURE_FILES_V1');
  assert.equal(manifest.files.length, 321);
  const names = manifest.files.map(row => relativeFile(row.file));
  assert.equal(new Set(names).size, names.length); assert.deepEqual(names, [...names].sort());
  assert.deepEqual(actualFiles, names, 'All321 members, including original835, are required without additions');
  assert.deepEqual(names.filter(name => /^action-\d+\.json\.gz$/.test(name)),
    Array.from({ length: NEW_COMMANDS }, (_, index) => `action-${PREFIX + index + 1}.json.gz`));
  assert.deepEqual(names.filter(name => /^predecessor-835\/action-\d+\.json\.gz$/.test(name)),
    Array.from({ length: 134 }, (_, index) => `predecessor-835/action-${PREFIX + index + 1}.json.gz`));
  for (const row of manifest.files) {
    exactKeys(row, row.file.endsWith('.gz') ? ['file', 'bytes', 'sha256', 'originalBytes', 'originalSha256'] : ['file', 'bytes', 'sha256']);
    assert(Number.isSafeInteger(row.bytes) && row.bytes > 0); assert(/^[a-f0-9]{64}$/.test(row.sha256));
    if (row.file.endsWith('.gz')) { assert(Number.isSafeInteger(row.originalBytes) && row.originalBytes! > 0); assert(/^[a-f0-9]{64}$/.test(row.originalSha256!)); }
  }
}
export function assertCaptureFreeze(freeze: Freeze): void {
  exactKeys(freeze, ['sha256', 'nodeVersion', 'files']); assert.equal(freeze.sha256, PINS.runtimeFreezeSha256);
  assert.equal(compactHash(freeze.files), freeze.sha256); assert.equal(freeze.files.length, 4546);
  assert.equal(new Set(freeze.files.map(row => row.file)).size, freeze.files.length);
  const producer = freeze.files.find(row => row.file === '$natural-producer'); assert(producer);
  assert.deepEqual(filePin(join(ROOT, 'producer.mjs')), { bytes: producer.bytes, sha256: producer.sha256 });
  // This authenticates historical bytes, not future src/dist equality.
}
export function authenticateInputs(): void {
  assert.equal(filePin(INPUT_MANIFEST).sha256, INPUT_MANIFEST_SHA);
  const manifest = JSON.parse(bytes(INPUT_MANIFEST).toString('utf8')) as Manifest;
  assertCaptureManifest(manifest, captureFiles());
  for (const row of manifest.files) {
    const raw = bytes(join(ROOT, row.file)); assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256);
    if (row.file.endsWith('.gz')) { const plain = gunzipSync(raw); assert.equal(plain.length, row.originalBytes); assert.equal(sha(plain), row.originalSha256); }
  }
  assert.equal(filePin(join(ROOT, 'natural.json.gz')).sha256, PINS.naturalSha256);
  for (const [source, expected, size, archive] of [
    [SOURCE, SOURCE_SHA, 2193278, 'archived-original701.json.gz'],
    [ARCHIVE, ARCHIVE_SHA, 5303731, 'archived-original193-natural.json.gz'],
  ] as const) {
    const raw = bytes(source); assert.equal(raw.length, size); assert.equal(sha(raw), expected);
    assert(decoded(join(ROOT, archive)).equals(raw), `Exact original bytes: ${source}`);
  }
  assertCaptureFreeze(json<Freeze>('runtime-freeze.json'));
  const frozen = json<{ format: string; sha256: string; files: Member[]; originalStateSha256: string; sourceRoot: string;
    prefixSha256: string; archivedCommandCount: number; origin: string; lostOriginal215Restored: boolean }>('input-freeze.json');
  assert.equal(frozen.sha256, PINS.inputFreezeSha256); assert.equal(compactHash(frozen.files), frozen.sha256);
  assert.deepEqual(frozen, { format: 'NEW215_RESTORED193_HISTORICAL_INPUTS_V1', sha256: PINS.inputFreezeSha256,
    files: [{ file: SOURCE, sha256: SOURCE_SHA, bytes: 2193278 }, { file: ARCHIVE, sha256: ARCHIVE_SHA, bytes: 5303731 }],
    originalStateSha256: PINS.originalStateSha256, sourceRoot: 'final', prefixSha256: PINS.prefixSha256,
    archivedCommandCount: PREFIX, origin: 'GENUINELY_RESTORED_VOLUME193', lostOriginal215Restored: false });
}
const PUBLIC_FIELDS = ['runId', 'revision', 'status', 'week', 'date', 'actionsRemaining', 'weeklyBudget', 'cash', 'weeklyWage', 'wagePaid',
  'health', 'mind', 'spirituality', 'maxHealth', 'maxMind', 'maxSpirituality', 'pollution', 'injuries', 'injuryRisk',
  'debtTotal', 'debts', 'canAct', 'actionBlockedReason', 'activeEvent', 'combat'] as const;
const LIFE_FIELDS = ['activeCase', 'inside', 'reflected', 'playerLocation', 'target', 'pad', 'cases', 'actions'] as const;
export function capturePublic(projection: SliceProjection) {
  const ordinary = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, structuredClone(projection[key])])) as Pick<SliceProjection, typeof PUBLIC_FIELDS[number]>;
  const tg = projection.thunderGod;
  const life = Object.fromEntries(LIFE_FIELDS.map(key => [key, structuredClone(tg.life[key])])) as Pick<typeof tg.life, typeof LIFE_FIELDS[number]>;
  return { ...ordinary, progression: { sequence: projection.progression.sequence, acting: projection.progression.acting,
    mastery: structuredClone(projection.progression.mastery) }, thunderGod: { guidanceKnown: tg.guidanceKnown, promoted: tg.promoted,
    preparedWeek: tg.preparedWeek, actions: structuredClone(tg.actions), bottles: tg.bottles.map(({ id, status, chance }) => ({ id, status, chance })),
    insideCase: tg.insideCase, life }, tyrant: structuredClone(projection.tyrant) };
}
export type CapturedPublic = ReturnType<typeof capturePublic>;
export function assertGlobalPublic(projection: SliceProjection, state: SliceState): void {
  const forbidden = /^(?:random|rng|rngState|seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|cursorBefore|cursorAfter|randomBefore|randomAfter|randomReceipts|preparedRoll|futureRoll|futureRolls|nextRoll|unrolledResult|privateSource|sourceState|sourceDigest|historyDigest|originalWorldDigest|combatHistoryDigest|originalsDigest|originalPracticeDigest|acquisitionDigest|compoundDigest|beforeDigest|afterDigest|actorId|predecessorActorId|incumbentActorId|custodianActorId)$/;
  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      const next = `${path}.${key}`, inactive = key === 'actorId' && value === null &&
        ['$.divineHand.life.site.guard.actorId', '$.glory.life.site.guard.actorId'].includes(next);
      assert(!(forbidden.test(key) && !inactive), `Private field ${next}`);
      assert(!(key === 'source' && value !== null && typeof value === 'object'), `Private source ${next}`);
      visit(value, next); // Resolved check.modifiers[].source labels are lawful.
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
  return { status: view.status, sequence: view.progression.sequence, promoted: view.tyrant.promoted,
    guidance: view.tyrant.guidanceKnown, s1Reflected: view.thunderGod.life.reflected };
}
export function assertPublicAction(view: CapturedPublic, row: Pick<Row, 'intent' | 'publicLabel' | 'publicCost'>): void {
  const intent = row.intent;
  if (intent.type === 'TYRANT' || intent.type === 'THUNDER_GOD') {
    const actions = intent.type === 'TYRANT' ? view.tyrant.actions : view.thunderGod.actions;
    const offered = actions.filter(action => stable(action.command) === stable(intent.command));
    assert.equal(offered.length, 1); assert.equal(offered[0]!.enabled, true);
    assert.equal(row.publicLabel, offered[0]!.label); assert.equal(row.publicCost, offered[0]!.cost); return;
  }
  assert(!view.tyrant.guidanceKnown);
  if (intent.type === 'ACTION') {
    assert(view.canAct && !view.activeEvent && !view.combat && !view.thunderGod.insideCase && !view.thunderGod.life.inside);
    assert.equal(intent.action, view.wagePaid ? 'REST' : 'WORK');
    assert.equal(row.publicLabel, intent.action === 'WORK' ? '做本周原职业工作' : '按实际生活档休养');
    assert.equal(row.publicCost, '1行动；实际工资、恢复与周生活费照常'); return;
  }
  assert(intent.type === 'EVENT_CHOICE'); assert.equal(intent.eventInstanceId, view.activeEvent?.instanceId);
  const choice = view.activeEvent?.choices.find(value => value.id === intent.choiceId); assert(choice?.enabled);
  assert.equal(row.publicLabel, choice.label);
  assert.equal(row.publicCost, 'cost' in choice && typeof choice.cost === 'string' ? choice.cost : '实际事件费用');
}
export function actualReceipts(after: SliceState, before: SliceState): Row['receipts'] {
  const latest = after.tyrant.journal.at(-1);
  if (latest?.revision === after.revision) return { checks: latest.randomReceipts, finance: latest.financeReceipts, notes: latest.notes };
  const acquisition = after.thunderGod.acquisitionJournal.slice(before.thunderGod.acquisitionJournal.length);
  const life = after.thunderGod.life.journal.slice(before.thunderGod.life.journal.length);
  return { checks: [...acquisition, ...life].filter(row => row.check).map(row => row.check), acquisition, life,
    finance: [], notes: after.chronicle.slice(before.chronicle.length) };
}
const EMPTY_SUN: SliceState['sun'] = {
  version: 1, guidanceKnown: false, source: null, frame: null, promotionWeek: null,
  services: null, materials: null, epilogue: null, journal: [], promotionStability: { preparations: [] },
};
export type HistoricalTyrantState = Omit<SliceState, 'schemaVersion' | 'contentVersion' | 'sun' | 'death' | 'door' | 'errorAscent' | 'twilightGiant' | 'demoness'> & {
  schemaVersion: 212; contentVersion: 'tyrant-v212';
};
export type HistoricalTyrantPublic = Omit<SliceProjection, 'sun' | 'death' | 'door' | 'errorAscent' | 'twilightGiant' | 'demoness'>;
export function historicalTyrantState(state: SliceState): HistoricalTyrantState {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assert.deepEqual(createSunState(), EMPTY_SUN); assert.deepEqual(state.sun, EMPTY_SUN);
  assertEmptyDeathState(state); assertEmptyDoorState(state); assertEmptyErrorAscentState(state); assertEmptyTwilightGiantState(state); assertEmptyDemonessState(state);
  const { sun: _emptySun, death: _emptyDeath, door: _emptyDoor, errorAscent: _emptyErrorAscent, twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness, ...originalFields } = state;
  return { ...originalFields, schemaVersion: CAPTURE_SCHEMA, contentVersion: CAPTURE_CONTENT };
}
function assertPostTyrantPublic(projection: SliceProjection, state: SliceState): void {
  assert.notEqual(state.progression.pathwayId, 'sun');
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
  assertEmptyDeathPublic(projection, state); assertEmptyDoorPublic(projection, state); assertEmptyErrorAscentPublic(projection, state); assertEmptyTwilightGiantPublic(projection, state); assertEmptyDemonessPublic(projection, state);
}
export function historicalTyrantPublic(projection: SliceProjection, state: SliceState): HistoricalTyrantPublic {
  historicalTyrantState(state); assertPostTyrantPublic(projection, state);
  const { sun: _emptySun, death: _emptyDeath, door: _emptyDoor, errorAscent: _emptyErrorAscent, twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness, ...originalFields } = projection;
  return originalFields;
}
/** Raw capture hashes always refer to212; current strict admission is a separate
 * fact. Future migrations may add fields, but may never rewrite the input. */
export function migrateCapturedTyrantState(raw: SliceState): SliceState {
  assert.deepEqual([raw.schemaVersion, raw.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
  const before = hash(raw), current = migrateSliceState(raw);
  assert.deepEqual([current.schemaVersion, current.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assertValidSliceState(current); assert.equal(hash(raw), before);
  assert.equal(Object.hasOwn(raw, 'sun'), false); assert.equal(Object.hasOwn(raw, 'death'), false); assert.equal(Object.hasOwn(raw, 'door'), false); assert.equal(Object.hasOwn(raw, 'errorAscent'), false); assert.equal(Object.hasOwn(raw, 'twilightGiant'), false); assert.equal(Object.hasOwn(raw, 'demoness'), false);
  exactKeys(current, [...Object.keys(raw), 'sun', 'death', 'door', 'errorAscent', 'twilightGiant', 'demoness']);
  same(historicalTyrantState(current), raw, 'Current ingress changed complete captured212 state');
  assert.equal(current.runId, raw.runId); same(current.random, raw.random); return current;
}
export function readAction(row: Row): Action {
  assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
  assert.deepEqual(filePin(join(ROOT, relativeFile(row.capture.file))), { bytes: row.capture.bytes, sha256: row.capture.sha256 });
  const action = json<Action>(row.capture.file);
  exactKeys(action, ['commandCount', 'beforeLast', 'lastIntent', 'final', 'randomBefore', 'randomAfter', 'publicBefore', 'public',
    'globalPublicBefore', 'globalPublic', 'policyBefore', 'policyAfter', 'audit']);
  const { capture: _capture, ...audit } = row;
  same(action.audit, { ...audit, elapsedMilliseconds: null }); assert.equal(action.commandCount, row.commandCount); same(action.lastIntent, row.intent);
  for (const [value, expected] of [[action.beforeLast, row.beforeStateSha256], [action.final, row.afterStateSha256],
    [action.publicBefore, row.publicBeforeSha256], [action.public, row.publicAfterSha256],
    [action.globalPublicBefore, row.globalPublicBeforeSha256], [action.globalPublic, row.globalPublicAfterSha256],
    [action.policyBefore, row.policyBeforeSha256], [action.policyAfter, row.policyAfterSha256]] as const) assert.equal(hash(value), expected);
  assert.deepEqual(action.randomBefore, row.randomBefore); assert.deepEqual(action.randomAfter, row.randomAfter);
  assert.deepEqual(action.beforeLast.random, row.randomBefore); assert.deepEqual(action.final.random, row.randomAfter);
  same(capturePublic(action.globalPublicBefore), action.publicBefore); same(capturePublic(action.globalPublic), action.public);
  assert.deepEqual(outcome(action.public), row.selectionOutcome); return action;
}
/** The rebuilt capture retains the original legacy44 dashboard result. The
 * current projection has one reviewed display-only correction: the complete
 * supported70 acquisition check at717-after, the same state at718-before.
 * This oracle never edits the capture, private lastCheck, journal or RNG. */
export const RAW_SUPPORTED_PROMOTION_CHECK: NonNullable<SliceProjection['lastCheck']> = {
  ability: 'will', baseAbility: 27, modifiers: [], effectiveAbility: 27,
  difficulty: 30, chance: 44, roll: 36, tier: 'SUCCESS',
};
export const CURRENT_SUPPORTED_PROMOTION_CHECK: NonNullable<SliceProjection['lastCheck']> = {
  ability: 'will', baseAbility: 27, modifiers: [{ source: '同瓶同场当周有价支持', value: 13 }],
  effectiveAbility: 40, difficulty: 30, chance: 70, roll: 36, tier: 'SUCCESS',
};
export function expectedCurrentGlobal(action: Action, side: 'before' | 'after'): SliceProjection {
  const raw = side === 'before' ? action.globalPublicBefore : action.globalPublic;
  const expected = structuredClone(raw);
  if (!(action.commandCount === 717 && side === 'after') && !(action.commandCount === 718 && side === 'before')) return expected;
  const state = side === 'before' ? action.beforeLast : action.final;
  assert.equal(hash(state), '9be5b3d7474353d105f271e4af504fe9aeb980ee40d6e8776289490527ffd8be');
  assert.equal(hash(raw), 'df1c318eb45b1c46cfa81370a76ad419e0d0db713a2695065b6d51397b493355');
  assert.equal(state.revision, 718); assert.equal(state.progression.sequence, 1); assert.equal(state.status, 'ACTIVE');
  assert.deepEqual(raw.lastCheck, RAW_SUPPORTED_PROMOTION_CHECK); assert.deepEqual(state.lastCheck, RAW_SUPPORTED_PROMOTION_CHECK);
  const receipt = state.thunderGod.acquisitionJournal.at(-1); assert(receipt);
  assert.equal(receipt.revision, 717);
  assert.deepEqual(receipt.command, { type: 'CONSUME', bottleId: 'thunder-god-potion-4', confirmed: true });
  assert.deepEqual(receipt.check, CURRENT_SUPPORTED_PROMOTION_CHECK);
  expected.lastCheck = structuredClone(receipt.check);
  return expected;
}
export function assertCurrentGlobal(actual: SliceProjection, action: Action, side: 'before' | 'after'): void {
  const state = side === 'before' ? action.beforeLast : action.final;
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
  assertPostTyrantPublic(actual, state);
  const { sun: _emptySun, death: _emptyDeath, door: _emptyDoor, errorAscent: _emptyErrorAscent, twilightGiant: _emptyTwilightGiant, demoness: _emptyDemoness, ...historicalPublic } = actual;
  same(historicalPublic, expectedCurrentGlobal(action, side), `Only the exact supported717 public check may differ (${action.commandCount} ${side})`);
  same(capturePublic(actual), side === 'before' ? action.publicBefore : action.public, 'The complete chapter capture remains unchanged');
}
function assertContinuation(cp: Checkpoint): void {
  const proof = json<Continuation>('continuation-835.json'); same(proof, cp.continuation835);
  assert.equal(proof.format, 'NEW215_REVIEWED_EXACT835_CONTINUATION_MANIFEST_V1');
  assert.equal(proof.firstPossibleNewCommand, 836); assert.equal(proof.inheritedCommandsVerifiedByBothPolicies, 134);
  assert.equal(proof.oldOutcomesRetained, true); assert.equal(proof.runtimeRulesChanged, false);
  assert.equal(proof.change, 'ONLY_EXACT_COAST_ASK_PERMISSION_ALREADY_ANSWERED_THIS_WEEK_USES_EXISTING_PAID_WAIT');
  assert.equal(proof.predecessorDirectory, 'predecessor-835'); assert.equal(hash(proof.predecessorFiles), proof.predecessorFilesSha256);
  assert.equal(proof.newRuntimeFreezeSha256, PINS.runtimeFreezeSha256);
  assert.equal(filePin(join(ROOT, 'predecessor-835/checkpoint.json.gz')).sha256, proof.anchor.checkpointSha256);
  const predecessor = json<{ sha256: string; payload: Checkpoint }>('predecessor-835/checkpoint.json.gz');
  assert.equal(predecessor.sha256, proof.anchor.envelopeSha256); assert.equal(hash(predecessor.payload), predecessor.sha256);
  const old = predecessor.payload;
  assert.equal(old.commandCount, 835); assert.equal(old.commands.length, 134); assert.equal(old.pending, null); assert.equal(old.terminal, null);
  assert.equal(hash(old.state), proof.anchor.stateSha256); assert.equal(old.state.status, 'ACTIVE');
  assert.deepEqual(old.state.random, { seed: 'sailor-natural-v026', cursor: 273 });
  same(cp.commands.slice(0, 134), old.commands); same(cp.rows.slice(0, 134), old.rows);
  same(cp.boundaries.filter(row => row.commandCount <= 835), old.boundaries);
  assert.equal(cp.rows[134]!.beforeStateSha256, old.finalStateSha256);
  assert.equal(cp.rows[134]!.policyBeforeSha256, hash(old.policy));
  const originalFreeze = json<Freeze>('predecessor-835/runtime-freeze.json'), freeze = json<Freeze>('runtime-freeze.json');
  assert.equal(originalFreeze.sha256, proof.anchor.runtimeFreezeSha256); assert.equal(compactHash(originalFreeze.files), originalFreeze.sha256);
  assert.equal(filePin(join(ROOT, 'predecessor-835/runtime-freeze.json')).sha256, proof.anchor.runtimeFreezeFileSha256);
  assert.equal(originalFreeze.nodeVersion, freeze.nodeVersion); assert.equal(originalFreeze.files.length, freeze.files.length);
  let changed = 0;
  for (const [index, before] of originalFreeze.files.entries()) {
    const after = freeze.files[index]!; assert.equal(before.file, after.file);
    if (before.file === '$natural-producer') {
      changed++; assert.equal(before.sha256, proof.anchor.producerSha256); assert.deepEqual(after, { file: '$natural-producer', ...proof.producer });
    } else assert.deepEqual(after, before, `Frozen product/runtime changed at ${before.file}`);
  }
  assert.equal(changed, 1); assert.deepEqual(filePin(join(ROOT, 'continuation-tool.mjs')), proof.tool);
  assert.deepEqual(filePin(join(ROOT, 'producer.mjs')), proof.producer);
  for (const member of proof.predecessorFiles) assert.deepEqual(filePin(join(ROOT, 'predecessor-835', relativeFile(member.file))), { bytes: member.bytes, sha256: member.sha256 });
  for (const row of old.rows) assert.deepEqual(filePin(join(ROOT, 'predecessor-835', row.capture.file)), { bytes: row.capture.bytes, sha256: row.capture.sha256 });
}
export interface LoadedCapture { original: HistoricalSource; archived: History; initial: SliceState; checkpoint: Checkpoint; rows: Row[]; summary: Summary }
export function loadCapture(): LoadedCapture {
  authenticateInputs();
  const archived = json<History>('archived-original193-natural.json.gz');
  const source = json<{ commandCount: number; lastIntent: SliceIntent; final: HistoricalSource }>('archived-original701.json.gz'), original = source.final;
  assert.equal(source.commandCount, PREFIX); assert.equal(archived.commands.length, 820); assert.equal(archived.final.status, 'DEAD');
  assert.equal(compactHash(archived.commands.slice(0, PREFIX)), PINS.prefixSha256);
  same(source.lastIntent, archived.commands[PREFIX - 1]); assert.equal(archived.seed, original.random.seed);
  assert.deepEqual([original.schemaVersion, original.contentVersion], [190, 'thunder-god-v190']);
  assert.equal(compactHash(original), PINS.originalStateSha256);
  const initial = migrateSliceState(original); assertValidSliceState(initial);
  assert.equal(compactHash(original), PINS.originalStateSha256);
  assert.deepEqual([initial.schemaVersion, initial.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  const migrated = json<{ originalStateSha256: string; migratedStateSha256: string; publicSha256: string; globalPublicSha256: string;
    final: SliceState; random: SliceState['random']; public: CapturedPublic; globalPublic: SliceProjection }>('migration-initial.json.gz');
  assert.equal(migrated.originalStateSha256, PINS.originalStateSha256);
  assert.equal(migrated.migratedStateSha256, PINS.initialStateSha256);
  assert.equal(migrated.publicSha256, PINS.initialPublicSha256); assert.equal(migrated.globalPublicSha256, PINS.initialGlobalPublicSha256);
  assert.deepEqual([migrated.final.schemaVersion, migrated.final.contentVersion], [CAPTURE_SCHEMA, CAPTURE_CONTENT]);
  assert.equal(hash(migrated.final), PINS.initialStateSha256); assert.equal(hash(migrated.public), PINS.initialPublicSha256);
  assert.equal(hash(migrated.globalPublic), PINS.initialGlobalPublicSha256); same(migrated.random, original.random);
  for (const [key, value] of Object.entries(original)) if (!['schemaVersion', 'contentVersion'].includes(key))
    same(migrated.final[key as keyof SliceState], value, `Historical190 to212 migration altered original701 field ${key}`);
  same(initial, migrateCapturedTyrantState(migrated.final));
  const initialGlobal = projectSliceState(initial); assertGlobalPublic(initialGlobal, initial);
  assertGlobalPublic(migrated.globalPublic, migrated.final); same(capturePublic(migrated.globalPublic), migrated.public);
  same(historicalTyrantPublic(initialGlobal, initial), migrated.globalPublic);
  assert.equal(hash(historicalTyrantState(initial)), PINS.initialStateSha256);
  const wrapper = json<{ sha256: string; payload: Checkpoint }>('checkpoint.json.gz');
  assert.equal(wrapper.sha256, hash(wrapper.payload)); const cp = wrapper.payload;
  assert.equal(cp.format, 'NEW215_RESTORED193_LIVING701_DURABLE_PUBLIC_ACTION_BOUNDARY_V1'); assert.equal(cp.source, SOURCE); assert.equal(cp.sourceSha256, SOURCE_SHA);
  for (const key of ['prefixSha256', 'inputFreezeSha256', 'runtimeFreezeSha256', 'initialStateSha256', 'finalStateSha256', 'initialPublicSha256', 'initialGlobalPublicSha256', 'initialRandomSha256'] as const) assert.equal(cp[key], PINS[key]);
  assert.equal(cp.publicStateSha256, PINS.finalPublicSha256); assert.equal(cp.globalPublicStateSha256, PINS.finalGlobalPublicSha256);
  assert.equal(hash(cp.state), PINS.finalStateSha256); assert.equal(hash(cp.state.random), PINS.finalRandomSha256);
  assert.deepEqual(cp.migration, { originalStateSha256: PINS.originalStateSha256, migratedStateSha256: PINS.initialStateSha256, fromSchema: 190, toSchema: 212 });
  assert.equal(cp.commandCount, 864); assert.equal(cp.commands.length, NEW_COMMANDS); assert.equal(cp.pending, null);
  assert.deepEqual(cp.terminal, { stage: PINS.stage, reason: PINS.reason });
  const natural = json<Natural>('natural.json.gz'), summary = json<Summary>('summary.json');
  same(natural.final, cp.state); same(natural.creation, archived.creation); assert.equal(natural.seed, archived.seed);
  assert.equal(natural.prefixCount, PREFIX); same(natural.commands, [...archived.commands.slice(0, PREFIX), ...cp.commands]);
  same(natural.policy, cp.policyDefinition); same(natural.boundaries, cp.boundaries);
  assert.equal(natural.pendingIntent, null); assert.equal(natural.stage, PINS.stage); assert.equal(natural.reason, PINS.reason);
  for (const key of ['lostOriginal215Restored', 'historicalPrefixReplayedByThisProducer', 'alternateSourceUsed', 'seedChanged', 'randomOverridden', 'futureDrawInspected']) assert.equal(natural.provenance[key], false);
  for (const key of ['rebuiltFromRestoredVolume193', 'originalPrefixRetainedExactly', 'completeOriginalSourceRetainedExactly', 'selectedFromEnabledPublicActionsOnly']) assert.equal(natural.provenance[key], true);
  assert.deepEqual(summary, { stage: PINS.stage, reason: PINS.reason, commands: 864, originalCommands: PREFIX, newCommands: NEW_COMMANDS,
    rebuild: 'NEW215', lostOriginal215Restored: false, controlledStop: false, week: 195, paused: false, diagnostic: false,
    strictFinalValidation: true, continuation835: cp.continuation835, sqliteReopenValidation: 'NOT_RUN_BY_PRODUCER', checkpoint: 'checkpoint.json.gz', public: summary.public });
  assert.equal(hash(summary.public), PINS.finalPublicSha256);
  assert.equal(decoded(join(ROOT, 'commands.ndjson.gz')).toString('utf8'), cp.rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  const rows = cp.rows; assert.equal(rows.length, NEW_COMMANDS);
  let privateHash = PINS.initialStateSha256, publicHash = PINS.initialPublicSha256, globalHash = PINS.initialGlobalPublicSha256,
    randomHash = PINS.initialRandomSha256, policyHash = PINS.initialPolicySha256;
  for (const [index, row] of rows.entries()) {
    assert.equal(row.commandCount, PREFIX + index + 1); assert.equal(row.revision, row.commandCount + 1);
    same(row.intent, cp.commands[index]); assert(['TYRANT', 'THUNDER_GOD', 'ACTION', 'EVENT_CHOICE'].includes(row.intent.type));
    assert.equal(row.commandSha256, compactHash(row.intent)); assert.equal(row.beforeStateSha256, privateHash);
    assert.equal(row.publicBeforeSha256, publicHash); assert.equal(row.globalPublicBeforeSha256, globalHash);
    assert.equal(row.randomBeforeSha256, randomHash); assert.equal(row.policyBeforeSha256, policyHash);
    assert.equal(hash(row.randomBefore), row.randomBeforeSha256); assert.equal(hash(row.randomAfter), row.randomAfterSha256);
    assert.equal(row.randomBefore.seed, original.random.seed); assert.equal(row.randomAfter.seed, original.random.seed);
    assert(row.randomAfter.cursor >= row.randomBefore.cursor); assert.equal(row.capture.file, `action-${row.commandCount}.json.gz`);
    privateHash = row.afterStateSha256; publicHash = row.publicAfterSha256; globalHash = row.globalPublicAfterSha256;
    randomHash = row.randomAfterSha256; policyHash = row.policyAfterSha256;
  }
  assert.equal(privateHash, PINS.finalStateSha256); assert.equal(publicHash, PINS.finalPublicSha256); assert.equal(globalHash, PINS.finalGlobalPublicSha256);
  assert.equal(randomHash, PINS.finalRandomSha256); assert.equal(policyHash, hash(cp.policy));
  same(json<BoundaryIndex[]>('boundaries.index.json'), cp.boundaries);
  assert.deepEqual(cp.boundaries.map(row => row.commandCount), PINS.boundaryCommandCounts);
  assert.equal(new Set(cp.boundaries.map(item => item.commandCount)).size, 28); assert.equal(new Set(cp.boundaries.map(item => item.kind)).size, 28);
  for (const { commandCount, kind, ...pin } of cp.boundaries) { assert(kind); assert.deepEqual(pin, rows[commandCount - PREFIX - 1]!.capture); }
  assertContinuation(cp);
  return { original, archived, initial, checkpoint: cp, rows, summary };
}
