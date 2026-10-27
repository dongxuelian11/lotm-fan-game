/** One completed Mother229 capture. Terminal pins are intentionally empty until
 * the sole frozen natural continuation stops. Never derive expected facts from
 * a running checkpoint, execute the producer, or replay the original955 here. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';

// Completed public fixture only, never the live output/checkpoint directory.
export const MOTHER_NATURAL_CAPTURE_DIRECTORY = 'tests/fixtures/mother-v02290';
export const MOTHER229_FORMAT = 'NEW229_ACTUAL955_COMPACT_OWNED_V1';
export const MOTHER229_PREFIX_COUNT = 955, MOTHER229_SOURCE_REVISION = 956;
export const MOTHER229_SOURCE_SHA = '620cd1a94fd3a4c89abf6359c8126a564383bee51dc6fdfbd2442e4cca67916c';
export const MOTHER229_SOURCE_STATE_SHA = '80e22b5ff3073288904d6ffbfc7f422ae27e9f5c363c33f4de4842bb3fdd4271';
export const MOTHER229_FROZEN_ROOTS = ['cultivator', 'physician', 'harvestpriest', 'biologist', 'druid',
  'ancientAlchemist', 'coffinBearer', 'barrenMatriarch', 'natureWalker', 'world', 'combatHistory', 'character'] as const;
export const motherNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const motherNaturalHash = (value: unknown) => motherNaturalSha(stableStringify(value));
export const motherNaturalAnchor = (state: SliceState, view: SliceProjection) => ({
  revision: state.revision, privateStateSha256: motherNaturalHash(state), publicStateSha256: motherNaturalHash(view),
  random: state.random, randomSha256: motherNaturalHash(state.random),
});
type Anchor = ReturnType<typeof motherNaturalAnchor>;
export interface MotherNaturalSnapshot {
  format: string; commandCount: number; newCount: number; reasons: string[]; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface MotherNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'MOTHER_ACTION'; commandCount: number; intent: SliceIntent;
  commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
export interface MotherNaturalActionRow extends MotherNaturalRow {
  newCount: number; before: Anchor; after: Anchor; publicAction: SliceProjection['mother']['actions'][number];
  receipt: ReturnType<typeof motherNaturalReceipt>; actual: ReturnType<typeof motherNaturalOutcome>;
}
interface SnapshotIndex {
  file: string; commandCount: number; newCount: number; reasons: string[];
  stateSha256: string; publicSha256: string; contentSha256: string;
}
export interface MotherNaturalSummary {
  format: string; hashEncoding: string; stage: string; commandCount: number; originalCommandCount: number;
  newCount: number; revision: number; finalPrivateStateSha256: string; finalWholePublicSha256: string;
  sourceFormat: string; sourceSha256: string; runtimeFreezeSha256: string; strictFinalValidation: boolean;
  historicalPrefixReplayed: boolean; randomOverridden: boolean; futureDrawInspected: boolean;
  selectedPublicPreferredOnly: boolean; actual: ReturnType<typeof motherNaturalOutcome>; keySnapshots: SnapshotIndex[];
}
export const motherNaturalStateFacts = (state: SliceState) => ({
  revision: state.revision, status: state.status, week: state.week, date: state.date,
  health: state.health, mind: state.mind, spirituality: state.spirituality, cash: state.cash,
  actionsRemaining: state.actionsRemaining, injuries: state.injuries, injuryRisk: state.injuryRisk,
  pollution: state.seer.pollution, pathwayId: state.progression.pathwayId, sequence: state.progression.sequence,
  acting: state.progression.acting, mastery: state.progression.mastery, randomCursor: state.random.cursor,
});
export const motherNaturalRolls = (state: SliceState) => state.mother.journal.flatMap(event => event.randomReceipts.map(({ check }) => ({
  revision: event.revision, command: event.command.type, chance: check.chance, roll: check.roll, tier: check.tier,
})));
export interface MotherTerminalPins {
  stage: string; commandCount: number; newCount: number; revision: number; lastIntent: SliceIntent;
  finalPrivateStateSha256: string; finalWholePublicSha256: string; runtimeFreezeSha256: string;
  summaryFileSha256: string; commandsFileSha256: string;
  state: ReturnType<typeof motherNaturalStateFacts>; actual: ReturnType<typeof motherNaturalOutcome>;
  rolls: ReturnType<typeof motherNaturalRolls>; handoffSourceSha256: string | null;
}
// PIN_AFTER_NATURAL_TERMINAL: replace only after independently reading the closed
// summary, complete commands.jsonl and terminal snapshot. Include actual failures,
// ordinary methods, costs, returned originals and any death exactly as observed.
const terminalPins: MotherTerminalPins = {
  "stage": "NATURAL_S0_REPORTED_EXIT",
  "commandCount": 1074,
  "newCount": 119,
  "revision": 1075,
  "lastIntent": {
    "type": "MOTHER",
    "command": {
      "type": "REPORT_RETURN"
    }
  },
  "finalPrivateStateSha256": "cc6c8af2b1a04c71a97f0f6d5cbe3b1ef0c1a126b875e9613ed2d9c2e7cdb87a",
  "finalWholePublicSha256": "af9742c6fc36c00b36ead55a25c6de33a6efed2545d1a3c053396aa38cfc37d7",
  "runtimeFreezeSha256": "951a7605892322556cb41275415304116650c61e2b3238de902aabad1976387f",
  "summaryFileSha256": "9ca00715ddd322078b37cf7e1f324c6b00b663cad2c48bcd49cfb65b736d9319",
  "commandsFileSha256": "c7469896a6a469121b0dbe937ea28c007737a59ab9af8f46fff880556a55f539",
  "state": {
    "revision": 1075,
    "status": "ACTIVE",
    "week": 250,
    "date": {
      "epoch": "FIFTH_EPOCH",
      "year": 1354,
      "month": 4,
      "day": 6
    },
    "health": 80,
    "mind": 68,
    "spirituality": 54,
    "cash": 165,
    "actionsRemaining": 1,
    "injuries": [],
    "injuryRisk": 0,
    "pollution": 0,
    "pathwayId": "mother",
    "sequence": 0,
    "acting": 0,
    "mastery": {
      "mother.s9.cultivation-knowledge": 25,
      "mother.s9.season-observation": 32,
      "mother.s9.careful-practice": 32,
      "mother.s8.limited-healing": 16,
      "mother.s8.condition-observation": 0,
      "mother.s7.harvest-care": 24,
      "mother.s7.life-support": 25,
      "mother.s6.specimen-study": 0,
      "mother.s6.controlled-trial": 25,
      "mother.s5.ground-passage": 0,
      "mother.s4.vital-knit": 8,
      "mother.s4.living-matrix": 8,
      "mother.s3.finite-preservation": 8,
      "mother.s2.bounded-dormancy": 8,
      "mother.s2.root-buffer": 24,
      "mother.s1.living-response": 8,
      "mother.s1.root-bearing": 8,
      "mother.s0.short-vitality-maintenance": 0,
      "mother.s0.existing-branch-support": 8
    },
    "randomCursor": 352
  },
  "actual": {
    "status": "ACTIVE",
    "sequence": 0,
    "promoted": true,
    "reported": true,
    "ordinaryExit": true,
    "returnedHome": true,
    "exitOpen": true,
    "sceneStatus": "COMPLETED",
    "originalDepartureRecorded": false,
    "preparationReported": true,
    "returnedOriginals": 2,
    "allOriginalsReturned": true,
    "maintenanceApplied": false,
    "branchApplied": true,
    "week": 250,
    "health": 80,
    "mind": 68,
    "spirituality": 54
  },
  "rolls": [
    {
      "revision": 1051,
      "command": "CONSUME",
      "chance": 70,
      "roll": 29,
      "tier": "SUCCESS"
    },
    {
      "revision": 1061,
      "command": "APPLY_MAINTENANCE",
      "chance": 72,
      "roll": 87,
      "tier": "FAILURE"
    },
    {
      "revision": 1071,
      "command": "APPLY_BRANCH_SUPPORT",
      "chance": 70,
      "roll": 6,
      "tier": "SUCCESS"
    }
  ],
  "handoffSourceSha256": "03aa3135822c0105ce254dcb978b38ad36b1b60b1359236c8e7d44ad05425881"
};
export function motherNaturalPins(): MotherTerminalPins {
  assert(terminalPins, 'NOT_RUN: Mother229 terminal is not pinned; wait for the single frozen natural continuation to stop');
  return terminalPins;
}
export function readMotherNaturalSummary(): MotherNaturalSummary {
  const pins = motherNaturalPins(), bytes = readFileSync(join(MOTHER_NATURAL_CAPTURE_DIRECTORY, 'summary.json'));
  assert.equal(motherNaturalSha(bytes), pins.summaryFileSha256, 'The completed summary bytes changed');
  const value: MotherNaturalSummary = JSON.parse(bytes.toString('utf8'));
  assert.equal(value.format, MOTHER229_FORMAT); assert.equal(value.hashEncoding, 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256');
  assert.equal(value.sourceFormat, 'FULL_NATURAL_ARCHIVE'); assert.equal(value.sourceSha256, MOTHER229_SOURCE_SHA);
  assert.equal(value.originalCommandCount, MOTHER229_PREFIX_COUNT);
  for (const key of ['stage', 'commandCount', 'newCount', 'revision', 'finalPrivateStateSha256', 'finalWholePublicSha256', 'runtimeFreezeSha256'] as const)
    assert.equal(value[key], pins[key]);
  assert(['NATURAL_S0_REPORTED_EXIT', 'NATURAL_ORDINARY_EXIT', 'NATURAL_DEATH', 'NATURAL_TERMINAL'].includes(value.stage),
    'Manual pause or public blockage is not natural terminal acceptance');
  assert(value.newCount > 0); assert.equal(value.commandCount, MOTHER229_PREFIX_COUNT + value.newCount);
  assert.equal(value.revision, MOTHER229_SOURCE_REVISION + value.newCount); assert.deepEqual(value.actual, pins.actual);
  assert.deepEqual([value.strictFinalValidation, value.selectedPublicPreferredOnly, value.historicalPrefixReplayed,
    value.randomOverridden, value.futureDrawInspected], [true, true, false, false, false]);
  if (value.actual.status === 'DEAD') assert.equal(value.stage, 'NATURAL_DEATH');
  if (value.actual.status === 'ACTIVE') {
    assert(['NATURAL_S0_REPORTED_EXIT', 'NATURAL_ORDINARY_EXIT'].includes(value.stage));
    for (const key of ['ordinaryExit', 'returnedHome', 'exitOpen', 'allOriginalsReturned'] as const) assert.equal(value.actual[key], true);
    assert.equal(value.actual.returnedOriginals, 2);
    if (value.stage === 'NATURAL_S0_REPORTED_EXIT') { assert(value.actual.promoted); assert(value.actual.reported); }
  }
  return value;
}
export function readMotherNaturalSource(): { final: SliceState; commands: SliceIntent[] } {
  motherNaturalPins();
  const bytes = gunzipSync(readFileSync(join(MOTHER_NATURAL_CAPTURE_DIRECTORY, 'source-natural.json.gz')));
  assert.equal(bytes.length, 9853856); assert.equal(motherNaturalSha(bytes), MOTHER229_SOURCE_SHA);
  const value = JSON.parse(bytes.toString('utf8')) as { final: SliceState; commands: SliceIntent[] };
  const source = value.final;
  assert.equal(motherNaturalHash(source), MOTHER229_SOURCE_STATE_SHA); assert.equal(value.commands.length, MOTHER229_PREFIX_COUNT);
  assert.deepEqual([source.revision, source.status, source.week], [956, 'ACTIVE', 228]);
  assert.deepEqual([source.health, source.mind, source.spirituality, source.cash, source.actionsRemaining], [40, 83, 114, 255, 3]);
  assert.equal(source.progression.pathwayId, 'mother'); assert.equal(source.progression.sequence, 1);
  assert.equal(Object.keys(source.progression.mastery).length, 17);
  assert.deepEqual(source.random, { seed: 'cultivator-natural-v069', cursor: 349 });
  assert.equal(source.injuryRisk, 3);
  assert.deepEqual(source.injuries.map(i => [i.severity, i.treatedRevision]), [['LIGHT', null], ['LIGHT', null], ['HEAVY', null], ['HEAVY', null]]);
  assert.deepEqual(Object.keys(source.natureWalker.sourceHistory!), MOTHER229_FROZEN_ROOTS.slice(0, 8));
  for (const key of MOTHER229_FROZEN_ROOTS.slice(0, 8))
    assert.deepEqual(source.natureWalker.sourceHistory![key as keyof NonNullable<typeof source.natureWalker.sourceHistory>], source[key]);
  return value;
}
export function readMotherNaturalRows(): MotherNaturalRow[] {
  const pins = motherNaturalPins(), bytes = readFileSync(join(MOTHER_NATURAL_CAPTURE_DIRECTORY, 'commands.jsonl'));
  assert.equal(motherNaturalSha(bytes), pins.commandsFileSha256, 'The complete ordered receipt bytes changed');
  const text = bytes.toString('utf8'); assert(text.endsWith('\n'), 'Incomplete compact receipt tail');
  return text.trimEnd().split('\n').map(line => JSON.parse(line));
}
export function readMotherNaturalSnapshot(which: 'initial' | 'terminal'): MotherNaturalSnapshot {
  const summary = readMotherNaturalSummary(), count = which === 'initial' ? MOTHER229_PREFIX_COUNT : summary.commandCount;
  const items = summary.keySnapshots.filter(item => item.commandCount === count && item.reasons.includes(which));
  assert.equal(items.length, 1); const item = items[0]!;
  assert.equal(item.file, `key-${item.commandCount}-${item.reasons.join('-')}.json.gz`);
  assert.match(item.file, /^key-\d+-[a-z0-9-]+\.json\.gz$/);
  const value: MotherNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(MOTHER_NATURAL_CAPTURE_DIRECTORY, item.file))).toString('utf8'));
  assert.equal(motherNaturalHash(value), item.contentSha256); assert.equal(value.format, MOTHER229_FORMAT);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [226, 'mother-v226']);
  assert.equal(value.commandCount, count); assert.equal(value.newCount, which === 'initial' ? 0 : summary.newCount);
  assert.equal(value.newCount, item.newCount); assert.deepEqual(value.reasons, item.reasons);
  assert.deepEqual(value.random, value.final.random); assert.deepEqual(value.anchor, motherNaturalAnchor(value.final, value.public));
  assert.equal(value.anchor.privateStateSha256, item.stateSha256); assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  if (which === 'terminal') {
    assert.equal(value.anchor.privateStateSha256, summary.finalPrivateStateSha256);
    assert.equal(value.anchor.publicStateSha256, summary.finalWholePublicSha256);
    assert.deepEqual(motherNaturalOutcome(value.final), summary.actual);
  }
  assertMotherNaturalPublic(value.public, value.final); return value;
}
export function motherNaturalReceipt(next: SliceState, before: SliceState) {
  const latest = next.mother.journal.at(-1);
  if (latest?.revision === next.revision) return { id: latest.id, checks: latest.randomReceipts,
    finance: latest.financeReceipts, notes: latest.notes, beforeDigest: latest.beforeDigest, afterDigest: latest.afterDigest };
  assert(!before.mother.guidanceKnown && next.mother.guidanceKnown, 'Missing actual Mother action receipt');
  return { id: null, checks: [], finance: [], notes: next.chronicle.slice(before.chronicle.length) };
}
export function motherNaturalOutcome(state: SliceState) {
  const root = state.mother, scene = root.scene, plants = scene?.plants ?? [];
  const returned = plants.filter(plant => plant.returnedEventId && plant.holder === plant.originalHolder && plant.location === 'OUTSIDE');
  return { status: state.status, sequence: state.progression.sequence, promoted: state.progression.sequence === 0,
    reported: Boolean(scene?.returnReportEventId), ordinaryExit: scene?.playerPosition === 'OUTSIDE',
    returnedHome: root.frame?.location === 'MO229-GREENHOUSE', exitOpen: scene?.greenhouse.exitOpen === true, sceneStatus: scene?.status ?? null,
    originalDepartureRecorded: Boolean(scene?.originalDepartureEventId), preparationReported: Boolean(scene?.greenhouseReportEventId),
    returnedOriginals: returned.length, allOriginalsReturned: plants.length === 2 && returned.length === plants.length,
    maintenanceApplied: Boolean(scene?.maintenanceApplied), branchApplied: Boolean(scene?.branchApplied),
    week: state.week, health: state.health, mind: state.mind, spirituality: state.spirituality };
}
export function assertMotherNaturalPublic(value: unknown, state?: SliceState, path = '$'): void {
  if (!value || typeof value !== 'object') return;
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter',
    'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'randomReceipts', 'sourceDigest', 'historyDigest',
    'originalWorldDigest', 'combatHistoryDigest', 'originalsDigest', 'acquisitionDigest', 'compoundDigest', 'beforeDigest', 'afterDigest',
    'actorId', 'predecessorActorId', 'incumbentActorId', 'custodianActorId', 'preparationRoll', 'futureRoll', 'nextRoll', 'privateSource']);
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`, inactive = key === 'actorId' && child === null &&
      ['$.divineHand.life.site.guard.actorId', '$.glory.life.site.guard.actorId'].includes(next);
    assert(!(forbidden.has(key) && !inactive) && !(key === 'source' && child !== null && typeof child === 'object'), `Private public field ${next}`);
    assertMotherNaturalPublic(child, undefined, next);
  }
  if (state) for (const secret of [state.random.seed, state.mother.source?.actorId, state.mother.source?.historyDigest].filter(Boolean))
    assert(!JSON.stringify(value).includes(secret!), 'Whole public state leaked an actual identity, source digest or seed');
}
/** Read only the retained freeze/producer bytes. No build, original replay or main invocation. */
export function assertMotherNaturalRetainedFreeze(summary: MotherNaturalSummary): void {
  const { sha256, ...payload } = JSON.parse(readFileSync(join(MOTHER_NATURAL_CAPTURE_DIRECTORY, 'runtime-freeze.json'), 'utf8')) as {
    sha256: string; nodeVersion: string; nodeExecutable: { bytes: number; sha256: string };
    source: { format: string; path: string; bytes: number; sha256: string }; files: { file: string; bytes: number; sha256: string }[];
  };
  assert.equal(sha256, summary.runtimeFreezeSha256); assert.equal(motherNaturalHash(payload), sha256);
  assert.equal(payload.source.format, 'FULL_NATURAL_ARCHIVE');
  assert.equal(payload.source.path, 'tests/fixtures/nature-walker-v02070/natural.json');
  assert.equal(payload.source.bytes, 9853856); assert.equal(payload.source.sha256, MOTHER229_SOURCE_SHA);
  assert.match(payload.nodeVersion, /^v\d+\./); assert(payload.nodeExecutable.bytes > 0); assert.match(payload.nodeExecutable.sha256, /^[a-f0-9]{64}$/);
  for (const [retained, original] of [['producer.mjs', 'scripts/play/mother-stage.mjs'], ['producer-tests.mjs', 'scripts/play/mother-stage.test.mjs']] as const) {
    const evidence = payload.files.find(file => file.file === original); assert(evidence, `Missing retained ${original}`);
    const bytes = readFileSync(join(MOTHER_NATURAL_CAPTURE_DIRECTORY, retained));
    assert.equal(bytes.length, evidence.bytes); assert.equal(motherNaturalSha(bytes), evidence.sha256);
  }
}
