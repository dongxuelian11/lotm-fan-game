/** Actual single natural terminal. Final imports assume tests/helpers; no live output/checkpoint reads.
 * Fill terminal pins only after the one frozen natural continuation has stopped. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';

// Proposed retained-fixture destination. Change only if the parent chooses another path.
const directory = 'tests/fixtures/justiciar-v02280';
export const JUSTICIAR228_FORMAT = 'NEW228_ACTUAL706_RECOVERY_COMPACT_OWNED_V1';
export const JUSTICIAR228_PREFIX_COUNT = 706, JUSTICIAR228_SOURCE_REVISION = 707;
export const JUSTICIAR228_SOURCE_SHA = '7cb9aa2ac25d209060582aef054f9c0fb1d8af8a77b2d071fc8feef633893f4c';
export const JUSTICIAR228_SOURCE_STATE_SHA = '02e12e3eec478f78ab430741894ba813e07f0375e81ac82c2607c645fdd5f54d';
export const JUSTICIAR228_HISTORY_SHA = 'f5b1e8090128b479850acda55353f828a1ee2f122b1feaafd89cc6a18ad94d4a';
export const JUSTICIAR228_PREFIX_SHA = '54d787f7dce773eda10cfc88ebec8e1c512529a012d374c6369bca23ecb913b4';
export const justiciarNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const justiciarNaturalHash = (value: unknown) => justiciarNaturalSha(stableStringify(value));
export const justiciarNaturalAnchor = (state: SliceState, view: SliceProjection) => ({
  revision: state.revision, privateStateSha256: justiciarNaturalHash(state), publicStateSha256: justiciarNaturalHash(view),
  random: state.random, randomSha256: justiciarNaturalHash(state.random),
});
type Anchor = ReturnType<typeof justiciarNaturalAnchor>;
export interface JusticiarNaturalSnapshot {
  format: string; commandCount: number; newCount: number; reasons: string[]; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface JusticiarNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'JUSTICIAR_CONTINUATION_ACTION'; commandCount: number; intent: SliceIntent;
  commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
export interface JusticiarNaturalActionRow extends JusticiarNaturalRow {
  newCount: number; before: Anchor; after: Anchor; elapsedWeeks: number;
  publicAction: { enabled: boolean; preferredAction?: boolean; [key: string]: unknown };
  receipt: ReturnType<typeof justiciarNaturalReceipt>; actual: ReturnType<typeof justiciarNaturalOutcome>;
}
interface SnapshotIndex {
  file: string; commandCount: number; newCount: number; reasons: string[];
  stateSha256: string; publicSha256: string; contentSha256: string;
}
type PredecessorFreeze = { revision: number; roots: Record<string, string> } | null;
export interface JusticiarNaturalSummary {
  format: string; hashEncoding: string; stage: string; commandCount: number; originalCommandCount: number;
  newCount: number; revision: number; finalPrivateStateSha256: string; finalWholePublicSha256: string;
  sourceSha256: string; historySha256: string; prefixCommandsSha256: string; runtimeFreezeSha256: string;
  strictFinalValidation: boolean; historicalPrefixReplayed: boolean; randomOverridden: boolean; futureDrawInspected: boolean;
  selectedPublicControlsOnly: boolean; selectedS0PublicPreferredOnly: boolean; provenance: unknown;
  frozenSourceKeys: string[]; predecessorFreeze: PredecessorFreeze;
  actual: ReturnType<typeof justiciarNaturalOutcome>; keySnapshots: SnapshotIndex[];
}
export const justiciarNaturalStateFacts = (s: SliceState) => ({
  revision: s.revision, status: s.status, week: s.week, health: s.health, mind: s.mind, spirituality: s.spirituality,
  cash: s.cash, actionsRemaining: s.actionsRemaining, injuries: s.injuries,
  pollution: s.seer.pollution, pathwayId: s.progression.pathwayId, sequence: s.progression.sequence,
  randomCursor: s.random.cursor,
});
export function justiciarNaturalRolls(state: SliceState, source: SliceState) {
  return [
    ...state.handOfOrder.acquisitionJournal.slice(source.handOfOrder.acquisitionJournal.length)
      .flatMap(e => e.check ? [{ chapter: 'S1_ACQUISITION', revision: e.revision, check: e.check }] : []),
    ...state.handOfOrder.life.journal.slice(source.handOfOrder.life.journal.length)
      .flatMap(e => e.check ? [{ chapter: 'S1_LIFE', revision: e.revision, check: e.check }] : []),
    ...state.justiciar.journal.flatMap(e => e.randomReceipts.map(r => ({ chapter: 'S0', revision: e.revision, check: r.check }))),
  ].sort((a, b) => a.revision - b.revision)
    .map(({ chapter, revision, check }) => ({ chapter, revision, chance: check.chance, roll: check.roll, tier: check.tier }));
}
export interface JusticiarTerminalPins {
  stage: string; commandCount: number; newCount: number; revision: number; lastIntent: SliceIntent;
  finalPrivateStateSha256: string; finalWholePublicSha256: string; runtimeFreezeSha256: string;
  state: ReturnType<typeof justiciarNaturalStateFacts>; actual: ReturnType<typeof justiciarNaturalOutcome>;
  rolls: ReturnType<typeof justiciarNaturalRolls>;
  /** Hash of the actual S1-to-S0 source, including its true budget, or null if guidance was never reached. */
  handoffSourceSha256: string | null;
}
// Actual frozen terminal915 facts, inspected after the single continuation.
const terminalPins: JusticiarTerminalPins = {
  "stage": "NATURAL_S0_RETURN_REPORTED",
  "commandCount": 915,
  "newCount": 209,
  "revision": 916,
  "lastIntent": {
    "type": "JUSTICIAR",
    "command": {
      "type": "REPORT_RETURN"
    }
  },
  "finalPrivateStateSha256": "237a2cf3f4c13d9cc7ab884f26b9088b5c2f77f75d48568811de187aece84702",
  "finalWholePublicSha256": "8925bc99000d25ae75efdb534a237022ffccc9949ae63f5880e5d0629b8760d6",
  "runtimeFreezeSha256": "d029f939b6641333e826291668b2b9b8a95332bad15cdb4c9ad05c784815e8c3",
  "state": {
    "revision": 916,
    "status": "ACTIVE",
    "week": 201,
    "health": 100,
    "mind": 70,
    "spirituality": 54,
    "cash": 1350,
    "actionsRemaining": 0,
    "injuries": [],
    "pollution": 0,
    "pathwayId": "justiciar",
    "sequence": 0,
    "randomCursor": 391
  },
  "actual": {
    "status": "ACTIVE",
    "sequence": 0,
    "s1Promoted": true,
    "s1Reflected": true,
    "promoted": true,
    "promotionWeek": 200,
    "scenePhase": "PRACTICE",
    "sceneStatus": "COMPLETED",
    "originalDepartureRecorded": true,
    "originalDepartureSource": "PRESERVED_HAND_OF_ORDER_LIFE",
    "evacuationReported": true,
    "reported": true,
    "returnReportEventId": "R228:arbiter-rebuild-natural:916",
    "cargoDelivered": true,
    "ordinaryExit": true,
    "returnedHome": true,
    "location": "JU228-DOCK",
    "constraintApplied": true,
    "priorityApplied": true,
    "loadMethod": "ABILITY",
    "cargoMethod": "ABILITY",
    "week": 201,
    "health": 100,
    "mind": 70,
    "spirituality": 54
  },
  "rolls": [
    {
      "chapter": "S1_ACQUISITION",
      "revision": 725,
      "chance": 70,
      "roll": 22,
      "tier": "SUCCESS"
    },
    {
      "chapter": "S1_LIFE",
      "revision": 740,
      "chance": 58,
      "roll": 3,
      "tier": "GREAT_SUCCESS"
    },
    {
      "chapter": "S1_LIFE",
      "revision": 760,
      "chance": 58,
      "roll": 84,
      "tier": "FAILURE"
    },
    {
      "chapter": "S1_LIFE",
      "revision": 776,
      "chance": 58,
      "roll": 65,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 827,
      "chance": 34,
      "roll": 98,
      "tier": "GREAT_FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 831,
      "chance": 34,
      "roll": 79,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 832,
      "chance": 34,
      "roll": 60,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 836,
      "chance": 34,
      "roll": 41,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 837,
      "chance": 34,
      "roll": 70,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 841,
      "chance": 34,
      "roll": 51,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 842,
      "chance": 34,
      "roll": 59,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 846,
      "chance": 34,
      "roll": 78,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 847,
      "chance": 34,
      "roll": 21,
      "tier": "SUCCESS"
    },
    {
      "chapter": "S0",
      "revision": 859,
      "chance": 34,
      "roll": 40,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 863,
      "chance": 34,
      "roll": 35,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 864,
      "chance": 34,
      "roll": 54,
      "tier": "FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 868,
      "chance": 34,
      "roll": 97,
      "tier": "GREAT_FAILURE"
    },
    {
      "chapter": "S0",
      "revision": 869,
      "chance": 34,
      "roll": 16,
      "tier": "SUCCESS"
    },
    {
      "chapter": "S0",
      "revision": 895,
      "chance": 70,
      "roll": 11,
      "tier": "SUCCESS"
    },
    {
      "chapter": "S0",
      "revision": 908,
      "chance": 74,
      "roll": 30,
      "tier": "SUCCESS"
    },
    {
      "chapter": "S0",
      "revision": 911,
      "chance": 74,
      "roll": 4,
      "tier": "GREAT_SUCCESS"
    }
  ],
  "handoffSourceSha256": "c368e5640076705060c6ee9afc269335bc151d4e088cf3e9170eb4af025721e1"
};
export function justiciarNaturalPins(): JusticiarTerminalPins {
  assert(terminalPins, 'NOT_RUN: natural terminal facts are unknown; complete and independently pin the single capture first');
  return terminalPins;
}
export function readJusticiarNaturalSummary(): JusticiarNaturalSummary {
  const pins = justiciarNaturalPins();
  const value: JusticiarNaturalSummary = JSON.parse(readFileSync(join(directory, 'summary.json'), 'utf8'));
  assert.equal(value.format, JUSTICIAR228_FORMAT); assert.equal(value.hashEncoding, 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256');
  assert.equal(value.originalCommandCount, JUSTICIAR228_PREFIX_COUNT);
  for (const key of ['stage', 'commandCount', 'newCount', 'revision', 'finalPrivateStateSha256', 'finalWholePublicSha256', 'runtimeFreezeSha256'] as const)
    assert.equal(value[key], pins[key]);
  assert(value.stage.startsWith('NATURAL_'), 'A pause or public-action block is not a terminal acceptance capture');
  assert(value.newCount > 0); assert.equal(value.commandCount, JUSTICIAR228_PREFIX_COUNT + value.newCount);
  assert.equal(value.revision, JUSTICIAR228_SOURCE_REVISION + value.newCount);
  assert.equal(value.sourceSha256, JUSTICIAR228_SOURCE_SHA); assert.equal(value.historySha256, JUSTICIAR228_HISTORY_SHA);
  assert.equal(value.prefixCommandsSha256, JUSTICIAR228_PREFIX_SHA); assert.deepEqual(value.actual, pins.actual);
  assert.deepEqual([value.strictFinalValidation, value.selectedPublicControlsOnly, value.selectedS0PublicPreferredOnly,
    value.historicalPrefixReplayed, value.randomOverridden, value.futureDrawInspected], [true, true, true, false, false, false]);
  if (value.actual.status === 'DEAD') assert.equal(value.stage, 'NATURAL_DEATH');
  else {
    assert.equal(value.actual.status, 'ACTIVE'); assert.equal(value.stage, 'NATURAL_S0_RETURN_REPORTED');
    for (const key of ['promoted', 'originalDepartureRecorded', 'evacuationReported', 'reported', 'ordinaryExit', 'returnedHome'] as const)
      assert.equal(value.actual[key], true);
  }
  return value;
}
export function readJusticiarNaturalSource() {
  const bytes = gunzipSync(readFileSync(join(directory, 'source-snapshot.json.gz')));
  const history = gunzipSync(readFileSync(join(directory, 'original801-natural.json.gz')));
  assert.equal(justiciarNaturalSha(bytes), JUSTICIAR228_SOURCE_SHA);
  assert.equal(justiciarNaturalSha(history), JUSTICIAR228_HISTORY_SHA);
  const wrapper = JSON.parse(bytes.toString('utf8')) as { commandCount: number; final: SliceState; beforeLast: SliceState; lastIntent: SliceIntent };
  const archive = JSON.parse(history.toString('utf8')) as { commands: SliceIntent[]; final: SliceState };
  assert.equal(justiciarNaturalHash(wrapper.final), JUSTICIAR228_SOURCE_STATE_SHA);
  assert.equal(wrapper.commandCount, JUSTICIAR228_PREFIX_COUNT); assert.equal(wrapper.final.revision, JUSTICIAR228_SOURCE_REVISION);
  assert.equal(wrapper.final.status, 'ACTIVE'); assert.equal(wrapper.final.progression.sequence, 2);
  assert.equal(archive.commands.length, 801); assert.equal(archive.final.status, 'DEAD');
  const prefixCommands = archive.commands.slice(0, JUSTICIAR228_PREFIX_COUNT);
  assert.equal(justiciarNaturalHash(prefixCommands), JUSTICIAR228_PREFIX_SHA);
  return { wrapper, archive, prefixCommands, source: wrapper.final };
}
export function readJusticiarNaturalRows(): JusticiarNaturalRow[] {
  const text = readFileSync(join(directory, 'commands.jsonl'), 'utf8');
  assert(text.endsWith('\n'), 'Incomplete compact receipt tail');
  return text.trimEnd().split('\n').map(line => JSON.parse(line));
}
export function readJusticiarNaturalSnapshot(which: 'initial' | 'terminal'): JusticiarNaturalSnapshot {
  const summary = readJusticiarNaturalSummary(), count = which === 'initial' ? JUSTICIAR228_PREFIX_COUNT : summary.commandCount;
  const items = summary.keySnapshots.filter(item => item.commandCount === count && item.reasons.includes(which));
  assert.equal(items.length, 1); const item = items[0]!;
  assert.equal(item.file, `key-${item.commandCount}-${item.reasons.join('-')}.json.gz`);
  assert.match(item.file, /^key-\d+-[a-z0-9-]+\.json\.gz$/);
  const value: JusticiarNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(directory, item.file))).toString('utf8'));
  assert.equal(justiciarNaturalHash(value), item.contentSha256); assert.equal(value.format, JUSTICIAR228_FORMAT);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [225, 'justiciar-v225']);
  assert.equal(value.commandCount, count); assert.equal(value.newCount, which === 'initial' ? 0 : summary.newCount);
  assert.equal(value.newCount, item.newCount); assert.deepEqual(value.reasons, item.reasons);
  assert.deepEqual(value.random, value.final.random); assert.deepEqual(value.anchor, justiciarNaturalAnchor(value.final, value.public));
  assert.equal(value.anchor.privateStateSha256, item.stateSha256); assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  if (which === 'terminal') {
    assert.equal(value.anchor.privateStateSha256, summary.finalPrivateStateSha256);
    assert.equal(value.anchor.publicStateSha256, summary.finalWholePublicSha256);
    assert.deepEqual(justiciarNaturalOutcome(value.final), summary.actual);
  }
  assertJusticiarNaturalPublic(value.public); return value;
}
export function justiciarNaturalReceipt(next: SliceState, before: SliceState) {
  const hand = next.handOfOrder, old = before.handOfOrder, journal = next.justiciar.journal;
  assert.deepEqual(journal.slice(0, before.justiciar.journal.length), before.justiciar.journal);
  assert.deepEqual(hand.acquisitionJournal.slice(0, old.acquisitionJournal.length), old.acquisitionJournal);
  assert.deepEqual(hand.life.journal.slice(0, old.life.journal.length), old.life.journal);
  const latest = journal.at(-1);
  if (latest?.revision === next.revision) {
    assert.equal(journal.length, before.justiciar.journal.length + 1);
    return { id: latest.id, checks: latest.randomReceipts, finance: latest.financeReceipts, notes: latest.notes,
      beforeDigest: latest.beforeDigest, afterDigest: latest.afterDigest };
  }
  const acquisition = hand.acquisitionJournal.slice(old.acquisitionJournal.length).map(e => ({
    revision: e.revision, command: e.command, before: e.before, after: e.after, check: e.check,
    cursorBefore: e.cursorBefore, cursorAfter: e.cursorAfter,
    ...(e.recoverySite ? { recoverySiteSha256: justiciarNaturalHash(e.recoverySite), sourceBottleId: e.recoverySite.sourceBottleId,
      originalBottleId: e.recoverySite.originalBottleId } : {}),
  }));
  const life = hand.life.journal.slice(old.life.journal.length).map(e => ({ revision: e.revision, command: e.command,
    before: e.before, after: e.after, check: e.check, tier: e.tier, clockBefore: e.clockBefore, clockAfter: e.clockAfter }));
  return { id: null, acquisition, life, notes: next.chronicle.slice(before.chronicle.length) };
}
export function justiciarNaturalOutcome(state: SliceState) {
  const root = state.justiciar, scene = root.scene, life = state.handOfOrder.life;
  const departure = life.journal.find(e => e.command.type === 'EXIT_ORIGINAL' && e.clockAfter - e.clockBefore === 4);
  const walk = life.movements.some(m => m.actor === 'PLAYER' && m.from === 'START' && m.to === 'OUTSIDE' && m.metres === 4 && m.seconds === 4);
  const workers = scene?.workers ?? [], cargo = (scene?.cargo ?? []).filter(c => ['JU228-ADA', 'JU228-SIMON'].includes(c.carrierId));
  const passed = (item: { position: string; passage: { a: string | null; b: string | null; exit: string | null } }) =>
    item.position === 'OUTSIDE' && !!item.passage.a && !!item.passage.b && !!item.passage.exit;
  return { status: state.status, sequence: state.progression.sequence,
    s1Promoted: state.handOfOrder.promotionWeek !== null, s1Reflected: life.reflected,
    promoted: state.progression.sequence === 0 && root.promotionWeek !== null, promotionWeek: root.promotionWeek,
    scenePhase: scene?.phase ?? null, sceneStatus: scene?.status ?? null,
    originalDepartureRecorded: !!scene?.originalDepartureEventId || !!departure && !!walk,
    originalDepartureSource: scene?.originalDepartureEventId ? 'JUSTICIAR_SCENE' : departure && walk ? 'PRESERVED_HAND_OF_ORDER_LIFE' : null,
    evacuationReported: !!scene?.evacuationReportEventId, reported: !!scene?.returnReportEventId,
    returnReportEventId: scene?.returnReportEventId ?? null, cargoDelivered: cargo.length === 2 && cargo.every(passed),
    ordinaryExit: !!scene && scene.playerPosition === 'OUTSIDE' && scene.owner.position === 'OUTSIDE' && workers.length === 2
      && workers.every(passed) && cargo.length === 2 && cargo.every(passed) && !scene.window && !scene.contact
      && !scene.segments.A.open && !scene.segments.B.open && scene.exit.door === 'CLOSED',
    returnedHome: root.frame?.location === 'JU228-DOCK', location: root.frame?.location ?? null,
    constraintApplied: scene?.constraintApplied ?? false, priorityApplied: scene?.priorityApplied ?? false,
    loadMethod: scene?.device.loadMethod ?? null, cargoMethod: scene?.device.cargoMethod ?? null,
    week: state.week, health: state.health, mind: state.mind, spirituality: state.spirituality };
}
export function assertJusticiarNaturalPublic(value: unknown, path = '$'): void {
  if (!value || typeof value !== 'object') return;
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter',
    'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'randomReceipts', 'actorId', 'predecessorActorId',
    'incumbentActorId', 'custodianActorId', 'preparationRoll', 'futureRoll', 'nextRoll', 'privateSource']);
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`;
    const body = key === 'actorId' && /^\$\.justiciar\.actions\.\d+\.command\.actorId$/.test(next)
      && ['PLAYER', 'JU228-ADA', 'JU228-SIMON'].includes(child);
    const inactive = child === null && ['$.divineHand.life.site.guard.actorId', '$.glory.life.site.guard.actorId',
      '$.writer.life.practice.record.reportDigest'].includes(next);
    assert(!((forbidden.has(key) || key.endsWith('Digest')) && !body && !inactive)
      && !(key === 'source' && child !== null && typeof child === 'object'), `Private public field ${next}`);
    assertJusticiarNaturalPublic(child, next);
  }
}
interface RetainedPolicy {
  chooseAction(view: SliceProjection, previous: SliceIntent | null):
    { intent: SliceIntent; publicAction: JusticiarNaturalActionRow['publicAction'] } | { stop: string; reason: string };
  verifySourceProvenance(wrapper: unknown, archive: unknown): { prefixCommands: SliceIntent[]; provenance: unknown };
  freezePredecessors(state: SliceState, keys: readonly string[]): NonNullable<PredecessorFreeze>;
  assertOriginalRoots(state: SliceState, original: SliceState, keys: readonly string[], freeze: PredecessorFreeze): void;
  auditPublic(view: SliceProjection, state: SliceState): void;
  terminal(state: SliceState): { stage: string; reason: string } | null;
}
/** Retained producer is authenticated before importing its pure policy functions.
 * Its top-level import does not load dist/game state; never invoke main or tests. */
export async function loadJusticiarNaturalPolicy(summary: JusticiarNaturalSummary): Promise<RetainedPolicy> {
  const { sha256, ...payload } = JSON.parse(readFileSync(join(directory, 'runtime-freeze.json'), 'utf8')) as {
    sha256: string; source: { path: string; sha256: string }; history: { path: string; sha256: string };
    files: { file: string; sha256: string }[];
  };
  assert.equal(sha256, summary.runtimeFreezeSha256); assert.equal(justiciarNaturalHash(payload), sha256);
  assert.equal(payload.source.path, 'tests/fixtures/hand-of-order-v02060/boundary-step-706-action.json');
  assert.equal(payload.source.sha256, JUSTICIAR228_SOURCE_SHA);
  assert.equal(payload.history.path, 'tests/fixtures/hand-of-order-v02060/natural.json');
  assert.equal(payload.history.sha256, JUSTICIAR228_HISTORY_SHA);
  for (const [retained, name] of [['producer.mjs', 'scripts/play/justiciar-stage.mjs'],
    ['producer-tests.mjs', 'scripts/play/justiciar-stage.test.mjs']] as const) {
    const evidence = payload.files.find(item => item.file === name); assert(evidence);
    assert.equal(justiciarNaturalSha(readFileSync(join(directory, retained))), evidence.sha256);
  }
  const specifier = pathToFileURL(resolve(directory, 'producer.mjs')).href;
  return await import(/* @vite-ignore */ specifier) as RetainedPolicy;
}
