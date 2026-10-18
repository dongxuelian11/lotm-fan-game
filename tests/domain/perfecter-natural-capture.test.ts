import { assertEmptyErrorAscentState } from '../helpers/empty-error-ascent-capture.js';
import { historicalPerfecterStateForEmptyRootAudit } from '../helpers/historical-empty-root-audit.js';
import { assertEmptyDeathState, assertEmptyDoorState } from '../helpers/empty-death-capture.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { applySliceIntent, assertValidSliceState, createSliceRun, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createPerfecterState, projectPerfecter } from '../../src/domain/perfecter/index.js';
import { openPerfecterRuntimeSession, type PerfecterRuntimeSession } from '../../src/domain/perfecter/owned-session.js';
import { PERFECTER_FROZEN_SOURCE_KEYS, perfecterSourceBlock } from '../../src/domain/perfecter/source.js';
import { PERFECTER_WORKS_STATIONS } from '../../src/domain/perfecter/works-content.js';
import type { PerfecterCommand, PerfecterEvent, PerfecterProjection } from '../../src/domain/perfecter/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

/** Immutable actual211 evidence: the original797 commands are authenticated,
 * not redundantly replayed. Execute only the recorded158 continuation actions
 * through the raw guidance handoff and one private owned session. The actual
 * second failed dose killed the original character; no S0 or epilogue occurred.
 * No producer/dist import, fixture write, supplied die, alternate route or retry. */
const SOURCE = 'tests/fixtures/civilization-enlightener-v01890/natural.json';
const SOURCE_SHA = '5d7a97347f8a555c91c7b1a57dc4acdebd78f3ac36414e1674d2bb5d34cc835f';
const PREFIX_SHA = '3c5d52d10c731b2664f324a27ed5544623af38a66b38a4debdde50a9c62af565';
const PREFIX = 797;
interface Member { file: string; bytes: number; sha256: string }
interface Boundary extends Member { kind: string; commandCount: number }
interface Row {
  commandCount: number; intent: SliceIntent; commandSha256: string; revision: number; week: number;
  reason: string; publicLabel: string; publicCost: string; startedAt: string; elapsedMilliseconds: number;
  beforeStateSha256: string; afterStateSha256: string; publicBeforeSha256: string; publicAfterSha256: string;
  randomBefore: SliceState['random']; randomAfter: SliceState['random'];
  randomBeforeSha256: string; randomAfterSha256: string; policyBeforeSha256: string; policyAfterSha256: string;
  receipts: { checks: PerfecterEvent['randomReceipts']; finance: PerfecterEvent['financeReceipts']; notes: string[] };
}
interface Checkpoint {
  format: string; source: string; sourceSha256: string; historySha256: string; prefixSha256: string; freezeSha256: string;
  commandCount: number; commands: SliceIntent[]; rows: Row[]; boundaries: Boundary[]; state: SliceState;
  initialStateSha256: string; finalStateSha256: string; initialPublicSha256: string; publicStateSha256: string;
  initialRandomSha256: string; pending: { intent: SliceIntent } | null; terminal: { stage: string; reason: string } | null;
  policyDefinition: { noReroll: boolean }; policy: { doses: number; week: number };
}
interface CapturePins {
  root: string; manifestSha256: string; freezeSha256: string; initialSha256: string;
  finalSha256: string; finalPublicSha256: string; newCommands: number; stage: string; paused: boolean;
  draws: Array<[number, number, string]>; finalFacts: ReturnType<typeof facts>;
}
const CAPTURE: CapturePins = {
  root: "tests/fixtures/perfecter-v02110",
  manifestSha256: "8431dcbecca2ae25e3f0181d30b898d38fd8aac9b860103938a7aee5a00e580b",
  freezeSha256: "8d3bb2822758a4d29c569fc3d97f0f825caaf395b913e2e3e2641f0367cc6ee4",
  initialSha256: "932d1de51f7b674c13a62aea66f079ca578ef07b73eb177615e18e8b2297665f",
  finalSha256: "9342e3ab7d2773730bfe2a6343d236d8268af0bc42c01031b2c1313389777724",
  finalPublicSha256: "c99f9cdd25b379299313d46420de8fa567e5ed2fed145e33fb1718634731bf27",
  newCommands: 158,
  stage: "NATURAL_ACTUAL_TERMINAL",
  paused: false,
  draws: [[919, 81, "FAILURE"], [955, 100, "GREAT_FAILURE"]],
  finalFacts: {
    revision: 956,
    status: "DEAD",
    week: 230,
    date: {"epoch": "FIFTH_EPOCH", "year": 1353, "month": 11, "day": 17},
    random: {"seed": "savant-rebuild-first", "cursor": 348},
    body: [0, 0, 78, 890, 0, 2, 70],
    injuries: [{"id": "R211:savant-rebuild-natural:956:potion-injury", "severity": "HEAVY", "acquiredRevision": 956, "treatedRevision": null}],
    sequence: 1,
    acting: 100,
    promotionWeek: null,
    stations: [["ARCHIVE", "BC-ARC-17", "civic-iris-ward", 92, 194, 201, 3, 3, 0, 3, 0], ["WORKSHOP", "BC-WKS-04", "civic-emil-holt", 92, 197, 202, 3, 3, 0, 3, 0], ["SOUTH_BANK", "BC-SBR-09", "civic-nadia-bell", 92, 200, 203, 3, 3, 0, 3, 0]],
    operations: [["ARCHIVE", "BC-ARC-17:maintenance-ledger:service-1", 194, ["archive-elin-reed", "archive-jonas-vale"]], ["ARCHIVE", "BC-ARC-17:maintenance-ledger:service-2", 195, ["archive-ruth-hill", "archive-edgar-stone"]], ["ARCHIVE", "BC-ARC-17:maintenance-ledger:service-3", 196, ["archive-leah-cole", "archive-finn-marsh"]], ["WORKSHOP", "BC-WKS-04:maintenance-ledger:service-1", 197, ["workshop-anna-moss", "workshop-peter-dunn"]], ["WORKSHOP", "BC-WKS-04:maintenance-ledger:service-2", 198, ["workshop-rose-king", "workshop-otto-bell"]], ["WORKSHOP", "BC-WKS-04:maintenance-ledger:service-3", 199, ["workshop-nora-park", "workshop-will-green"]], ["SOUTH_BANK", "BC-SBR-09:maintenance-ledger:service-1", 200, ["relay-clara-brook", "relay-hugh-wood"]], ["SOUTH_BANK", "BC-SBR-09:maintenance-ledger:service-2", 201, ["relay-vera-gray", "relay-noel-lake"]], ["SOUTH_BANK", "BC-SBR-09:maintenance-ledger:service-3", 202, ["relay-mira-west", "relay-alan-fox"]]],
    characteristics: [["civilization-enlightener-potion-1:characteristic", "civilization-enlightener-potion-1", "EMBODIED", null, null, 0], ["civilization-enlightener-potion-2:characteristic", "civilization-enlightener-potion-2", "LOST", "backlund:ritual-workshop", "perfecter-compound-2", 5], ["civilization-enlightener-potion-3:characteristic", "civilization-enlightener-potion-3", "LOST", "backlund:ritual-workshop", "perfecter-compound-2", 5]],
    uniqueness: ["paragon-uniqueness:original-branch-1353", "LOST", "backlund:ritual-workshop", "perfecter-compound-2", [["CHAIN", 211], ["VACANCY", 212], ["SEAL", 216]], 216, null],
    batches: [["perfecter-carrier-1", "SPENT", 1, 220, null], ["perfecter-carrier-2", "SPENT", 1, 230, null], ["perfecter-carrier-3", "SUPPLIER", 0, null, null]],
    compounds: [["perfecter-compound-1", "perfecter-carrier-1", "RECOVERED", 218, 220, "R211:savant-rebuild-natural:923", "R211:savant-rebuild-natural:926"], ["perfecter-compound-2", "perfecter-carrier-2", "FAILED_LOST", 228, 230, null, null]],
    settlements: [["perfecter-compound-1", 220, false, true, "backlund:ritual-workshop"], ["perfecter-compound-2", 230, false, false, "backlund:ritual-workshop"]],
    epilogue: null,
  },
};
const pins = (): CapturePins => CAPTURE;
// Matches the producer's ALL-key lexical ordering, including numeric keys.
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v)!;
}
const sha = (v: string | Buffer): string => createHash('sha256').update(v).digest('hex');
const hash = (v: unknown): string => sha(stable(v));
const compactHash = (v: unknown): string => sha(JSON.stringify(v));
const same = (a: unknown, b: unknown): void => { expect(hash(a)).toBe(hash(b)); };
const json = <T>(file: string): T => JSON.parse(readFileSync(join(pins().root, file), 'utf8')) as T;
const entry = <T>(file: string, key: string): T => readObjectEntry<T>(join(pins().root, file), key);
function filePin(path: string): Omit<Member, 'file'> {
  const stat = lstatSync(path); expect(stat.isSymbolicLink(), path).toBe(false); expect(stat.isFile(), path).toBe(true);
  const bytes = readFileSync(path); expect(bytes.length).toBe(stat.size);
  return { bytes: bytes.length, sha256: sha(bytes) };
}
function inventory(root: string, prefix = ''): string[] {
  return readdirSync(join(root, prefix)).sort().flatMap(name => {
    const file = prefix ? `${prefix}/${name}` : name, stat = lstatSync(join(root, file));
    expect(stat.isSymbolicLink(), file).toBe(false);
    return stat.isDirectory() ? inventory(root, file) : [file];
  });
}
// Exact additions for the actual186 -> actual208 handoff; no unknown roots.
const ADDED_ROOTS = ['beautyGoddess', 'misfortuneKnight', 'allKnowingEye', 'thunderGod', 'pureWhiteAngel',
  'paleEmperor', 'starKey', 'timeWorm', 'divineHand', 'apocalypseDemoness', 'knowledgeEmperor', 'darkAngel',
  'uncleanMonarch', 'abomination', 'mercurySnake', 'princeOfAbolition', 'handOfOrder', 'natureWalker',
  'fool', 'redPriest', 'visionary', 'perfecter'].sort();
let raw: SliceState, initial: SliceState, captureInitial: SliceState, defaults: SliceState;
let cp: Checkpoint, rows: Row[], boundaries: Boundary[];

/** The only migration seam: retain every historical field, normalize only the
 * two version labels, and require every newly introduced known root to equal
 * its complete fresh CURRENT default. Unknown or nonempty additions fail. */
function captureHash(current: SliceState, historical: SliceState): string {
  if (Number(historical.schemaVersion) === 208) return hash(historicalPerfecterStateForEmptyRootAudit(current, historical as unknown as Record<string, unknown>));
  expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  const old = historical as unknown as Record<string, unknown>, now = current as unknown as Record<string, unknown>;
  const fresh = defaults as unknown as Record<string, unknown>;
  const laterRoots = ['moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent'] as const;
  expect([186, 208]).toContain(historical.schemaVersion);
  const added = Number(historical.schemaVersion) === 186 ? [...ADDED_ROOTS, ...laterRoots] : [...laterRoots];
  for (const key of added) expect(Object.hasOwn(old, key), `Unexpected historical root ${key}`).toBe(false);
  assertEmptyDeathState(current); assertEmptyDoorState(current); assertEmptyErrorAscentState(current);
  expect(Object.keys(now).sort()).toEqual([...Object.keys(old), ...added].sort());
  for (const key of added) same(now[key], fresh[key]);
  return hash({ ...Object.fromEntries(Object.keys(old).map(key => [key, now[key]])),
    schemaVersion: historical.schemaVersion, contentVersion: historical.contentVersion });
}
function migrateExactly(historical: SliceState): SliceState {
  const before = hash(historical), migrated = migrateSliceState(historical);
  expect(hash(historical), 'Migration must leave every historical field intact').toBe(before);
  expect(captureHash(migrated, historical)).toBe(before); return migrated;
}

/** Literal finalFacts pins make actual residents, apparatus, custody, injuries,
 * spent carriers and unsuccessful skills reviewable, alongside the full hashes. */
function facts(s: SliceState) {
  const p = s.perfecter, m = p.materials;
  return {
    revision: s.revision, status: s.status, week: s.week, date: s.date, random: s.random,
    body: [s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining, s.injuryRisk, s.seer.pollution],
    injuries: s.injuries, sequence: s.progression.sequence, acting: s.progression.acting, promotionWeek: p.promotionWeek,
    stations: p.works?.stations.map(x => [x.id, x.apparatusId, x.operatorId, x.durability, x.trialWeek, x.verifiedWeek,
      x.supplierStock, x.purchasedParts, x.partsStock, x.installedParts, x.serviceStock]) ?? null,
    operations: p.works?.stations.flatMap(x => x.operations.map(op => [x.id, op.recordId, op.week, op.residents])) ?? null,
    characteristics: m?.characteristics.map(x => [x.id, x.originBottleId, x.holder, x.location, x.compoundId, x.labour.length]) ?? null,
    uniqueness: m && [m.uniqueness.id, m.uniqueness.holder, m.uniqueness.location, m.uniqueness.compoundId,
      m.uniqueness.checks.map(x => [x.step, x.week]), m.uniqueness.acquiredWeek, m.uniqueness.incumbentActorId],
    batches: m?.batches.map(x => [x.id, x.status, x.uses, x.spentWeek, x.repair]) ?? null,
    compounds: m?.compounds.map(x => [x.id, x.batchId, x.status, x.preparedWeek, x.consumedWeek, x.sealedEventId, x.recoveredEventId]) ?? null,
    settlements: m?.settlements.map(x => [x.compoundId, x.week, x.success, x.alive, x.location]) ?? null,
    epilogue: p.epilogue,
  };
}
function publicOnly(v: unknown): void {
  if (!v || typeof v !== 'object') return;
  for (const [key, value] of Object.entries(v)) {
    expect(['random', 'seed', 'cursor', 'source', 'sourceDigest', 'historyDigest', 'frame', 'randomReceipts', 'financeReceipts']).not.toContain(key);
    publicOnly(value);
  }
}
function conserve(s: SliceState): void {
  for (const key of [...PERFECTER_FROZEN_SOURCE_KEYS, 'world', 'combatHistory', 'character'] as const) same(s[key], raw[key]);
  for (const [id, mastery] of Object.entries(raw.progression.mastery)) expect(s.progression.mastery[id], id).toBe(mastery);
  const p = s.perfecter;
  if (p.source) {
    expect(p.source.revision).toBe(raw.revision); same(p.source.random, raw.random);
    same(p.source.budget.mastery, raw.progression.mastery); same(p.source.budget.injuries, raw.injuries);
    same(p.source.originalDevices, raw.alchemist.life.creations); expect(p.source.budget.cash).toBe(raw.cash);
  }
  if (p.works) {
    expect(p.works.week).toBe(s.week);
    for (const d of PERFECTER_WORKS_STATIONS) {
      const station = p.works.stations.find(x => x.id === d.id)!;
      expect(station).toMatchObject({ apparatusId: d.apparatusId, operatorId: d.operatorId, originalRecordId: d.recordId, owner: 'MUNICIPAL' });
      expect(station.supplierStock + station.purchasedParts).toBe(d.stock);
      expect(station.partsStock + station.installedParts).toBe(station.purchasedParts);
      expect(station.serviceStock + station.operations.reduce((n, op) => n + op.consumedStock, 0)).toBe(d.serviceStock);
      expect(station.operations.flatMap(op => op.residents)).toEqual(d.residents.slice(0, station.operations.length * 2));
      for (const [index, op] of station.operations.entries()) {
        expect(op).toMatchObject({ apparatusId: d.apparatusId, operatorId: d.operatorId, week: station.trialWeek! + index, cycles: 2, consumedStock: 1 });
      }
      if (station.verifiedWeek !== null) { expect(station.verifiedWeek).toBeGreaterThanOrEqual(station.trialWeek! + 2); expect(station.operations).toHaveLength(3); }
    }
  }
  if (p.materials) {
    const m = p.materials;
    expect(m.characteristics.map(x => [x.id, x.originBottleId])).toEqual([1, 2, 3].map(n => [`civilization-enlightener-potion-${n}:characteristic`, `civilization-enlightener-potion-${n}`]));
    expect(m.uniqueness.id).toBe('paragon-uniqueness:original-branch-1353');
    expect(m.batches.map(b => b.id)).toEqual(['perfecter-carrier-1', 'perfecter-carrier-2', 'perfecter-carrier-3']);
    same(m.origin.bottles, raw.civilizationEnlightener.bottles);
    for (const compound of m.compounds) { same(compound.characteristicIds, m.characteristics.map(c => c.id)); expect(compound.uniquenessId).toBe(m.uniqueness.id); }
  }
  if (p.epilogue) {
    const e = p.epilogue, origin = p.works!.epilogueOrigin;
    expect(e.originId).toBe(origin.id); expect(e.location).toBe(origin.location);
    same(e.operators, origin.operators); same(e.objectIds, origin.objects.map(o => o.id));
    same(e.patients.map(x => [x.id, x.name, x.injury]), origin.patients.map(x => [x.id, x.name, x.injury]));
    expect(e.apparatus.id).toBe(origin.apparatus.id); expect(e.apparatus.modelId).toBe(origin.apparatus.modelId);
    expect(e.flow.id).toBe(origin.flow.id); expect(e.flow.sourceObjectId).toBe(origin.flow.sourceObjectId);
    expect(e.flow.looseUnits + e.flow.quietedUnits + e.page.containedUnits).toBe(6);
    expect(e.apparatus.supplierPartsStock + e.apparatus.sparePartsPurchased).toBe(3);
    expect(e.apparatus.sparePartsInstalled + e.apparatus.sparePartsDamaged).toBe(e.apparatus.sparePartsPurchased);
  }
}
// Independent declaration of the producer's named selection, based only on
// commands which really occurred. No successful dose or epilogue is required.
function selected(c: PerfecterCommand, seen: Set<string>): string | null {
  const first = (kind: string): string | null => seen.has(kind) ? null : kind;
  if (['LEARN_GUIDANCE', 'STABILIZE_PROMOTION', 'CONSUME', 'START_EPILOGUE'].includes(c.type)) return c.type.toLowerCase();
  if (['WORK', 'NEXT_WEEK', 'TRAVEL', 'REST', 'CLINIC'].includes(c.type)) return first(`first-${c.type.toLowerCase()}`);
  if (c.type === 'WORKS' && ['WORKS_TRIAL', 'WORKS_VERIFY'].includes(c.command.type)) return `${c.command.type.toLowerCase()}-${c.command.stationId.toLowerCase()}`;
  if (c.type === 'MATERIAL') {
    const m = c.command;
    if (['COMPOSE_POTION', 'SEAL_REMAINS', 'RECOVER_SEALED', 'BUY_COMPOUND', 'REQUEST_COMPOUND_REPAIR', 'RECEIVE_COMPOUND_REPAIR'].includes(m.type)) return m.type.toLowerCase();
    if (m.type === 'VERIFY_UNIQUENESS') return `uniqueness-${m.step.toLowerCase()}`;
    if (['MATERIAL_LABOUR', 'ACQUIRE_CHARACTERISTIC', 'ACQUIRE_UNIQUENESS'].includes(m.type)) return first(`first-${m.type.toLowerCase()}`);
  }
  return c.type === 'EPILOGUE' ? `actual-archive-${c.command.type.toLowerCase()}` : null;
}

beforeAll(() => {
  const p = pins(); expect(filePin(join(p.root, 'manifest.json')).sha256).toBe(p.manifestSha256);
  const manifest = json<{ format: string; files: Member[] }>('manifest.json');
  expect(manifest.format).toBe('PERFECTER211_CAPTURE_FILES_V1'); expect(manifest.files).toHaveLength(36);
  expect(inventory(p.root).sort()).toEqual([...manifest.files.map(f => f.file), 'manifest.json'].sort());
  for (const f of manifest.files) {
    expect(f.file.includes('\\')).toBe(false); expect(f.file.split('/').every(part => part && part !== '.' && part !== '..')).toBe(true);
    expect(filePin(join(p.root, f.file)), f.file).toEqual({ bytes: f.bytes, sha256: f.sha256 });
  }
  expect(filePin(SOURCE).sha256).toBe(SOURCE_SHA); raw = readObjectEntry<SliceState>(SOURCE, 'final');
  defaults = createSliceRun(raw.runId, readObjectEntry<Parameters<typeof createSliceRun>[1]>(SOURCE, 'creation'), raw.random.seed);
  initial = migrateExactly(raw); captureInitial = entry<SliceState>('boundary-798-learn_guidance.json', 'beforeLast');
  expect([captureInitial.schemaVersion, captureInitial.contentVersion]).toEqual([208, 'perfecter-v208']);
  expect(Object.keys(captureInitial).filter(key => !Object.hasOwn(raw, key)).sort()).toEqual(ADDED_ROOTS);
  for (const [key, value] of Object.entries(raw)) if (!['schemaVersion', 'contentVersion'].includes(key)) same(captureInitial[key as keyof SliceState], value);
  for (const key of ADDED_ROOTS) same(captureInitial[key as keyof SliceState], defaults[key as keyof SliceState]);
  expect(hash(captureInitial)).toBe(p.initialSha256); expect(captureHash(initial, captureInitial)).toBe(p.initialSha256);
  same(initial, migrateExactly(captureInitial)); same(initial.perfecter, createPerfecterState());
  const wrapped = json<{ sha256: string; payload: Checkpoint }>('checkpoint.json');
  expect(wrapped.sha256).toBe(hash(wrapped.payload)); cp = wrapped.payload;
  boundaries = json<Boundary[]>('boundaries.index.json'); same(boundaries, cp.boundaries); expect(boundaries).toHaveLength(28);
  const ledger = readFileSync(join(p.root, 'commands.ndjson'), 'utf8');
  expect(ledger === '' || ledger.endsWith('\n')).toBe(true);
  rows = ledger === '' ? [] : ledger.trimEnd().split('\n').map(line => JSON.parse(line) as Row);
  same(rows, cp.rows); expect(rows).toHaveLength(p.newCommands);
}, 30_000);

describe('Perfecter immutable actual211 original797 continuation', () => {
  it('authenticates the unchanged source, complete command prefix, exact migration and frozen producer', () => {
    const p = pins(), prefix = readObjectEntry<SliceIntent[]>(SOURCE, 'commands'), commands = entry<SliceIntent[]>('natural.json', 'commands');
    expect(prefix).toHaveLength(PREFIX); expect(compactHash(prefix)).toBe(PREFIX_SHA);
    expect(commands).toHaveLength(PREFIX + p.newCommands); same(commands.slice(0, PREFIX), prefix); same(commands.slice(PREFIX), cp.commands);
    same(entry('prefix-original797.json', 'commands'), prefix); same(entry('prefix-original797.json', 'final'), raw); same(entry('natural.json', 'prefixFinal'), raw);
    for (const file of ['prefix-original797.json', 'natural.json']) same(entry(file, 'initial'), readObjectEntry(SOURCE, 'initial'));
    expect(entry('prefix-original797.json', 'historicalPrefixReplayedHere')).toBe(false); expect(entry('prefix-original797.json', 'original797AliveHistoryRetained')).toBe(true);
    expect(raw).toMatchObject({ schemaVersion: 186, contentVersion: 'civilization-enlightener-v186', revision: 798,
      runId: 'savant-rebuild-natural', status: 'ACTIVE', week: 188, health: 60, mind: 98, spirituality: 120,
      cash: 436, actionsRemaining: 3, random: { seed: 'savant-rebuild-first', cursor: 346 }, progression: { sequence: 1, acting: 100 } });
    expect(raw.injuries.map(i => i.severity)).toEqual(['LIGHT', 'HEAVY']); expect(Object.keys(raw.progression.mastery)).toHaveLength(21);
    expect(Object.values(raw.progression.mastery).filter(v => v === 0)).toHaveLength(8);
    expect(PERFECTER_FROZEN_SOURCE_KEYS).toEqual(['savant', 'archaeologist', 'appraiser', 'artisan', 'astronomer', 'alchemist', 'arcaneScholar', 'knowledgeMentor', 'civilizationEnlightener']);
    expect(perfecterSourceBlock(initial)).toBeNull(); assertValidSliceState(initial);
    const freeze = json<{ sha256: string; files: Member[] }>('freeze.json');
    expect(freeze.sha256).toBe(p.freezeSha256); expect(compactHash(freeze.files)).toBe(freeze.sha256);
    expect(freeze.files.find(f => f.file === SOURCE)?.sha256).toBe(SOURCE_SHA);
    expect(freeze.files.find(f => f.file === '$natural-producer')).toEqual({ file: '$natural-producer', ...filePin(join(p.root, 'producer.mjs')) });
    expect(entry('natural.json', 'provenance')).toEqual({ kind: 'EXACT_ORIGINAL_LIVING_ENLIGHTENER797_PUBLIC_PERFECTER_CONTINUATION',
      source: SOURCE, sourceSha256: SOURCE_SHA, originalHistory: SOURCE, originalHistorySha256: SOURCE_SHA,
      prefixCommandsSha256: PREFIX_SHA, runtimeFreezeSha256: p.freezeSha256, historicalPrefixReplayedByThisProducer: false,
      originalPrefixRetainedExactly: true, original797AliveHistoryUnchanged: true, privateAudit: true,
      seedChanged: false, randomOverridden: false, selectedFromEnabledPublicActionsOnly: true });
    expect(cp).toMatchObject({ format: 'PERFECTER797_DURABLE_PUBLIC_ACTION_BOUNDARY_V1', source: SOURCE, sourceSha256: SOURCE_SHA,
      historySha256: SOURCE_SHA, prefixSha256: PREFIX_SHA, freezeSha256: p.freezeSha256, initialStateSha256: p.initialSha256,
      finalStateSha256: p.finalSha256, publicStateSha256: p.finalPublicSha256, commandCount: PREFIX + p.newCommands, policyDefinition: { noReroll: true } });
    same(entry('natural.json', 'policy'), cp.policyDefinition);
  }, 30_000);

  it('replays every actual new command once and matches public availability, RNG, costs and every selected before/final', () => {
    const p = pins(), draws: CapturePins['draws'] = [], seen = new Set<string>(), visited: Boundary[] = [];
    let state = initial, view = projectPerfecter(initial), session: PerfecterRuntimeSession | null = null;
    expect(hash(view)).toBe(cp.initialPublicSha256); expect(hash(state.random)).toBe(cp.initialRandomSha256);
    for (const [index, row] of rows.entries()) {
      expect(row.commandCount).toBe(PREFIX + index + 1); expect(row.revision).toBe(initial.revision + index + 1);
      same(row.intent, cp.commands[index]); expect(row.commandSha256).toBe(compactHash(row.intent)); expect(validateSlicePayload(row.intent)).toBe(true);
      if (row.intent.type !== 'PERFECTER') throw Error('The actual continuation must contain only Perfecter public commands.');
      expect(state.status).toBe('ACTIVE'); expect(captureHash(state, captureInitial)).toBe(row.beforeStateSha256); expect(hash(view)).toBe(row.publicBeforeSha256);
      expect(state.random).toEqual(row.randomBefore); expect(hash(row.randomBefore)).toBe(row.randomBeforeSha256); expect(hash(row.randomAfter)).toBe(row.randomAfterSha256);
      if (index) expect(row.policyBeforeSha256).toBe(rows[index - 1]!.policyAfterSha256);
      const command = row.intent.command, offered = view.actions.filter(a => hash(a.command) === hash(command));
      expect(offered).toHaveLength(1); expect(offered[0]).toMatchObject({ enabled: true, reason: null, label: row.publicLabel, cost: row.publicCost });
      publicOnly(view); expect(JSON.stringify(view)).not.toContain(raw.random.seed);
      const before = state;
      if (session) {
        const draft = session.prepare(row.intent, before.revision);
        state = session.snapshotDraft(draft); view = session.projectDraftPerfecter(draft); session.commit(draft);
      } else {
        expect(index).toBe(0); expect(command).toEqual({ type: 'LEARN_GUIDANCE' });
        state = applySliceIntent(before, row.intent); session = openPerfecterRuntimeSession(state); view = session.projectPerfecter();
      }
      expect(captureHash(before, captureInitial), 'The prepared draft must not mutate its predecessor').toBe(row.beforeStateSha256);
      expect(captureHash(state, captureInitial)).toBe(row.afterStateSha256); expect(hash(view)).toBe(row.publicAfterSha256);
      expect([state.revision, state.week]).toEqual([row.revision, row.week]); expect(state.random).toEqual(row.randomAfter);
      expect(state.random.seed).toBe(raw.random.seed); conserve(state);
      if (command.type === 'LEARN_GUIDANCE') {
        expect([state.cash, state.actionsRemaining]).toEqual([before.cash - 100, before.actionsRemaining - 1]);
        same(state.random, before.random); expect(state.perfecter.journal).toEqual([]);
        expect(row.receipts).toEqual({ checks: [], finance: [], notes: ['Actual guidance paid: 100 pennies and one action.'] });
      } else {
        const event = state.perfecter.journal.at(-1)!;
        expect(event.revision).toBe(row.revision); same(event.command, command);
        same(event.before.random, row.randomBefore); same(event.after.random, row.randomAfter);
        same({ checks: event.randomReceipts, finance: event.financeReceipts, notes: event.notes }, row.receipts);
        const rng = new DeterministicActionRandomStream(before.random.seed, before.random.cursor);
        for (const receipt of event.randomReceipts) {
          expect(receipt.cursorBefore).toBe(rng.cursor); expect(receipt.check.roll).toBe(rng.nextInt(1, 100)); expect(receipt.cursorAfter).toBe(rng.cursor);
          draws.push([row.commandCount, receipt.check.roll, receipt.check.tier]);
        }
        expect(rng.cursor).toBe(state.random.cursor);
        const effect = command.type === 'WORKS' ? state.perfecter.works!.journal.at(-1)!.effect
          : command.type === 'MATERIAL' ? state.perfecter.materials!.receipts.at(-1)!.effect : null;
        if (effect) {
          expect(state.week - before.week).toBe(effect.weeks);
          expect(state.cash).toBe(before.cash - effect.cashCost + effect.cashGain - 30 * effect.weeks);
          expect(state.actionsRemaining).toBe(effect.weeks ? state.weeklyBudget : before.actionsRemaining - effect.actions);
          expect(state.spirituality).toBe(before.spirituality - effect.spirituality); expect(state.mind).toBe(before.mind - effect.mind);
        }
        if (command.type === 'WORK') { expect(state.cash).toBe(before.cash + 180); expect(state.actionsRemaining).toBe(before.actionsRemaining - 1); expect(before.wagePaidWeek).not.toBe(before.week); expect(state.wagePaidWeek).toBe(state.week); }
        if (command.type === 'NEXT_WEEK') { expect(state.week).toBe(before.week + 1); expect(state.cash).toBe(before.cash - 30); expect(state.actionsRemaining).toBe(3); same([state.health, state.mind, state.spirituality], [before.health, before.mind, before.spirituality]); }
        if (command.type === 'STABILIZE_PROMOTION') expect([state.cash, state.actionsRemaining, state.spirituality, state.mind]).toEqual([before.cash - 100, before.actionsRemaining - 1, before.spirituality - 12, before.mind - 8]);
        if (command.type === 'CONSUME') {
          expect(offered[0]!.preferredAction).toBe(true);
          const preparation = before.perfecter.promotionStability.preparations.find(x => x.compoundId === command.compoundId && x.status === 'READY')!;
          expect(preparation).toBeDefined(); expect(state.perfecter.promotionStability.preparations.find(x => x.id === preparation.id)).toMatchObject({ status: 'SPENT', spentEventId: event.id });
          expect(state.perfecter.materials!.settlements.at(-1)).toMatchObject({ compoundId: command.compoundId, eventId: event.id,
            success: ['SUCCESS', 'GREAT_SUCCESS'].includes(event.randomReceipts[0]!.check.tier), alive: state.status === 'ACTIVE' });
        }
      }
      const kind = selected(command, seen), matches = boundaries.filter(b => b.commandCount === row.commandCount);
      expect(matches).toHaveLength(kind ? 1 : 0);
      if (kind) {
        seen.add(kind); const boundary = matches[0]!; expect(boundary.kind).toBe(kind);
        expect(boundary.file).toBe(`boundary-${row.commandCount}-${kind}.json`);
        expect(filePin(join(p.root, boundary.file))).toEqual({ bytes: boundary.bytes, sha256: boundary.sha256 });
        expect(entry(boundary.file, 'commandCount')).toBe(row.commandCount); same(entry(boundary.file, 'lastIntent'), row.intent);
        const capturedBefore = entry<SliceState>(boundary.file, 'beforeLast'), capturedAfter = entry<SliceState>(boundary.file, 'final');
        for (const historical of [capturedBefore, capturedAfter]) expect([historical.schemaVersion, historical.contentVersion]).toEqual([208, 'perfecter-v208']);
        expect(hash(capturedBefore)).toBe(row.beforeStateSha256); expect(captureHash(before, capturedBefore)).toBe(row.beforeStateSha256);
        expect(hash(capturedAfter)).toBe(row.afterStateSha256); expect(captureHash(state, capturedAfter)).toBe(row.afterStateSha256);
        same(entry(boundary.file, 'public'), view);
        same(entry(boundary.file, 'audit'), { ...row, elapsedMilliseconds: null }); visited.push(boundary);
      }
    }
    same(visited, boundaries); same(draws, p.draws); same(cp.state, entry('natural.json', 'final'));
    expect([cp.state.schemaVersion, cp.state.contentVersion]).toEqual([208, 'perfecter-v208']);
    expect(hash(cp.state)).toBe(p.finalSha256); expect(captureHash(state, cp.state)).toBe(p.finalSha256); expect(hash(view)).toBe(p.finalPublicSha256); same(facts(state), p.finalFacts);
    expect(cp.policy.doses).toBe(rows.filter(r => r.intent.type === 'PERFECTER' && r.intent.command.type === 'CONSUME').length);
    expect(cp.policy.week).toBe(state.week); if (rows.length) expect(rows.at(-1)!.policyAfterSha256).toBe(hash(cp.policy));
    expect(entry('natural.json', 'stage')).toBe(p.stage); same(entry('natural.json', 'pendingIntent'), cp.pending?.intent ?? null);
    expect(cp.terminal?.stage ?? 'MANUAL_PAUSE').toBe(p.stage);
    const summary = json<{ stage: string; commands: number; originalCommands: number; newCommands: number; paused: boolean; strictFinalValidation: boolean; public: PerfecterProjection }>('summary.json');
    expect(summary).toMatchObject({ stage: p.stage, commands: PREFIX + p.newCommands, originalCommands: PREFIX, newCommands: p.newCommands, paused: p.paused, strictFinalValidation: true });
    same(summary.public, view); publicOnly(summary.public); assertValidSliceState(state); expect(filePin(SOURCE).sha256).toBe(SOURCE_SHA);
    expect(state.status).toBe('DEAD'); expect(view.promoted).toBe(false); expect(view.insideCase).toBe(false);
    expect(view.actions.every(action => !action.enabled)).toBe(true);
    if (!session) throw Error('The actual158-command continuation must retain its single owned session.');
    const stopped = session, terminalHash = hash(stopped.snapshot());
    const continuations: SliceIntent[] = [
      { type: 'PERFECTER', command: { type: 'WORK' } }, { type: 'PERFECTER', command: { type: 'REST' } },
      { type: 'PERFECTER', command: { type: 'NEXT_WEEK' } }, { type: 'PERFECTER', command: { type: 'START_EPILOGUE' } },
      { type: 'PERFECTER', command: { type: 'CONSUME', compoundId: 'perfecter-compound-2', confirmed: true } },
      { type: 'PERFECTER', command: { type: 'MATERIAL', command: { type: 'RECOVER_SEALED', compoundId: 'perfecter-compound-2' } } },
    ];
    for (const intent of continuations) expect(() => stopped.prepare(intent, state.revision)).toThrow();
    expect(hash(stopped.snapshot())).toBe(terminalHash); expect(hash(stopped.projectPerfecter())).toBe(p.finalPublicSha256);
  }, 180_000); // One owned traversal of158 actual actions; no quadratic raw replay.

  it('retains the failed first dose, paid same-original recovery and fatal second dose without inventing S0 or an epilogue', () => {
    const doses = rows.filter(r => r.intent.type === 'PERFECTER' && r.intent.command.type === 'CONSUME');
    expect(doses.map(r => [r.commandCount, r.week, r.receipts.checks[0]!.check.chance,
      r.receipts.checks[0]!.check.roll, r.receipts.checks[0]!.check.tier])).toEqual([
      [919, 220, 70, 81, 'FAILURE'], [955, 230, 70, 100, 'GREAT_FAILURE'],
    ]);
    const failed = entry<SliceState>('boundary-919-consume.json', 'final');
    expect(failed).toMatchObject({ status: 'ACTIVE', health: 55, mind: 52, spirituality: 78, cash: 440, week: 220 });
    expect(failed.perfecter.materials!.compounds[0]!.status).toBe('FAILED_EXPOSED');
    for (const [file, status] of [['boundary-922-seal_remains.json', 'FAILED_SEALED'], ['boundary-925-recover_sealed.json', 'RECOVERED']]) {
      const boundary = entry<SliceState>(file!, 'final'); expect(boundary.perfecter.materials!.compounds[0]!.status).toBe(status);
      expect(boundary.random.cursor).toBe(347); same(boundary.progression.mastery, raw.progression.mastery);
    }
    const final = cp.state;
    expect(final).toMatchObject({ status: 'DEAD', revision: 956, week: 230, health: 0, mind: 0, spirituality: 78,
      cash: 890, actionsRemaining: 0, ending: { kind: 'DEATH' }, random: { seed: 'savant-rebuild-first', cursor: 348 } });
    same(final.progression.mastery, raw.progression.mastery); expect(final.progression.sequence).toBe(1);
    expect(Object.keys(final.progression.mastery).some(id => id.startsWith('paragon.s0.'))).toBe(false);
    expect(final.perfecter.promotionWeek).toBeNull(); expect(final.perfecter.epilogue).toBeNull();
    expect(rows.some(r => r.intent.type === 'PERFECTER' && ['START_EPILOGUE', 'EPILOGUE'].includes(r.intent.command.type))).toBe(false);
    expect(final.perfecter.materials!.compounds.map(x => [x.id, x.status])).toEqual([
      ['perfecter-compound-1', 'RECOVERED'], ['perfecter-compound-2', 'FAILED_LOST'],
    ]);
    expect(final.perfecter.materials!.characteristics.map(x => x.holder)).toEqual(['EMBODIED', 'LOST', 'LOST']);
    expect(final.perfecter.materials!.uniqueness).toMatchObject({ holder: 'LOST', location: 'backlund:ritual-workshop', compoundId: 'perfecter-compound-2' });
    expect(final.perfecter.promotionStability.preparations.map(x => [x.compoundId, x.status, x.spentEventId])).toEqual([
      ['perfecter-compound-1', 'SPENT', 'R211:savant-rebuild-natural:920'],
      ['perfecter-compound-2', 'SPENT', 'R211:savant-rebuild-natural:956'],
    ]);
    expect(cp.terminal).toEqual({ stage: 'NATURAL_ACTUAL_TERMINAL', reason: 'Actual runtime status DEAD' }); expect(cp.pending).toBeNull();
  });
});
