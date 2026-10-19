import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Completed fixture evidence only; never reads the running producer or checkpoint. */
const directory = 'tests/fixtures/black-emperor-v02270';
export const BLACK_EMPEROR227_FORMAT = 'NEW227_PRINCE924_COMPACT_OWNED_V1';
export const BLACK_EMPEROR227_PREFIX_COUNT = 924;
export const BLACK_EMPEROR227_SOURCE_REVISION = 925;
export const BLACK_EMPEROR227_SOURCE_SHA = '116e7060455dbde907758f92af3fb20f6de8f0e15b248f44bb895d4a78e03dfa';
export const BLACK_EMPEROR227_SOURCE_STATE_SHA = '29884ce25f4e53df01bf56aa812174c18bf278313ce6f2176b0313a7325c3124';
/** Pinned only after the one natural continuation actually completed at command1014. */
export const BLACK_EMPEROR227_FINAL_PRIVATE_SHA = '904886e9088460582dc33f5e2adfc17ad908b4c40dd5b52b15668cbc3a070c56';
export const BLACK_EMPEROR227_FINAL_PUBLIC_SHA = '3b79aadae735e5267b62f0dc4739da57e805d7b2f7f59dbbfcc0a3fe14764d19';
export const BLACK_EMPEROR227_FROZEN_ROOTS = ['lawyer', 'barbarian', 'briber', 'corruptionBaron', 'mentorDisorder',
  'fallenEarl', 'frenzyMage', 'entropyDuke', 'princeOfAbolition', 'world', 'combatHistory', 'character'] as const;
export const blackEmperorNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const blackEmperorNaturalHash = (value: unknown) => blackEmperorNaturalSha(stableStringify(value));
export const blackEmperorNaturalAnchor = (state: SliceState, view: SliceProjection) => ({
  revision: state.revision, week: state.week, privateStateSha256: blackEmperorNaturalHash(state),
  publicStateSha256: blackEmperorNaturalHash(view), random: state.random, randomSha256: blackEmperorNaturalHash(state.random),
});
type Anchor = ReturnType<typeof blackEmperorNaturalAnchor>;
export interface BlackEmperorNaturalSnapshot {
  format: string; commandCount: number; newCount: number; reasons: string[]; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface BlackEmperorNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'BLACK_EMPEROR_ACTION'; commandCount: number; intent: SliceIntent;
  commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
export interface BlackEmperorNaturalActionRow extends BlackEmperorNaturalRow {
  newCount: number; before: Anchor; after: Anchor; elapsedWeeks: number;
  publicAction: SliceProjection['blackEmperor']['actions'][number];
  receipt: ReturnType<typeof blackEmperorNaturalReceipt>; actual: ReturnType<typeof blackEmperorNaturalOutcome>;
}
interface SnapshotIndex {
  file: string; commandCount: number; newCount: number; reasons: string[];
  stateSha256: string; publicSha256: string; contentSha256: string;
}
export interface BlackEmperorNaturalSummary {
  format: string; hashEncoding: string; stage: string; commandCount: number; originalCommandCount: number;
  newCount: number; revision: number; finalPrivateStateSha256: string; finalWholePublicSha256: string;
  sourceSha256: string; runtimeFreezeSha256: string; strictFinalValidation: boolean;
  historicalPrefixReplayed: boolean; randomOverridden: boolean; futureDrawInspected: boolean;
  selectedPublicPreferredOnly: boolean; actual: ReturnType<typeof blackEmperorNaturalOutcome>; keySnapshots: SnapshotIndex[];
}
export function readBlackEmperorNaturalSummary(): BlackEmperorNaturalSummary {
  const value: BlackEmperorNaturalSummary = JSON.parse(readFileSync(join(directory, 'summary.json'), 'utf8'));
  assert.equal(value.format, BLACK_EMPEROR227_FORMAT);
  assert.equal(value.hashEncoding, 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256');
  assert.equal(value.originalCommandCount, BLACK_EMPEROR227_PREFIX_COUNT);
  assert.equal(value.newCount, 90);
  assert.equal(value.finalPrivateStateSha256, BLACK_EMPEROR227_FINAL_PRIVATE_SHA);
  assert.equal(value.finalWholePublicSha256, BLACK_EMPEROR227_FINAL_PUBLIC_SHA);
  assert.equal(value.commandCount, BLACK_EMPEROR227_PREFIX_COUNT + value.newCount);
  assert.equal(value.revision, BLACK_EMPEROR227_SOURCE_REVISION + value.newCount);
  assert.equal(value.sourceSha256, BLACK_EMPEROR227_SOURCE_SHA);
  assert.deepEqual([value.strictFinalValidation, value.selectedPublicPreferredOnly, value.historicalPrefixReplayed,
    value.randomOverridden, value.futureDrawInspected], [true, true, false, false, false]);
  for (const hash of [value.finalPrivateStateSha256, value.finalWholePublicSha256, value.runtimeFreezeSha256])
    assert.match(hash, /^[a-f0-9]{64}$/);
  const actual = value.actual;
  assert(actual.sequence === 0 || actual.sequence === 1); assert.equal(actual.promoted, actual.sequence === 0);
  if (actual.status === 'DEAD') assert.equal(value.stage, 'NATURAL_DEATH');
  else {
    assert.equal(actual.status, 'ACTIVE');
    assert.equal(value.stage, actual.promoted && actual.sceneStatus === 'COMPLETED'
      ? 'NATURAL_S0_REPORTED_EXIT' : 'NATURAL_ORDINARY_EXIT');
    assert(['COMPLETED', 'ABORTED'].includes(actual.sceneStatus ?? ''));
    assert.equal(actual.reported, true); assert.equal(actual.ordinaryExit, true); assert.equal(actual.exitClosed, true);
  }
  return value;
}
export function readBlackEmperorNaturalSource(): { final: SliceState; commands: SliceIntent[] } {
  const bytes = gunzipSync(readFileSync(join(directory, 'source-natural.json.gz')));
  assert.equal(blackEmperorNaturalSha(bytes), BLACK_EMPEROR227_SOURCE_SHA);
  const value = JSON.parse(bytes.toString('utf8')) as { final: SliceState; commands: SliceIntent[] };
  const source = value.final;
  assert.equal(blackEmperorNaturalHash(source), BLACK_EMPEROR227_SOURCE_STATE_SHA);
  assert.equal(value.commands.length, BLACK_EMPEROR227_PREFIX_COUNT);
  // The authentic schema202 file has no BlackEmperor root. Only migration adds its empty default.
  assert.deepEqual([source.schemaVersion, source.contentVersion], [202, 'prince-of-abolition-v202']);
  assert.equal(Object.hasOwn(source, 'blackEmperor'), false);
  assert.deepEqual([source.revision, source.status, source.week], [BLACK_EMPEROR227_SOURCE_REVISION, 'ACTIVE', 222]);
  assert.deepEqual([source.health, source.mind, source.spirituality, source.cash, source.actionsRemaining], [80, 71, 97, 140, 1]);
  assert.equal(source.progression.pathwayId, 'black-emperor'); assert.equal(source.progression.sequence, 1);
  assert.equal(source.progression.acting, 100); assert.equal(Object.keys(source.progression.mastery).length, 16);
  assert.deepEqual(source.random, { seed: 'lawyer-natural-v063', cursor: 315 });
  assert.deepEqual(source.injuries, [
    { id: 'lawyer-rebuild-natural:combat:1:PLAYER:920:0', severity: 'LIGHT', acquiredRevision: 920, treatedRevision: null },
    { id: 'lawyer-rebuild-natural:combat:5:PLAYER:924:1', severity: 'LIGHT', acquiredRevision: 924, treatedRevision: null },
  ]);
  assert.deepEqual(source.princeOfAbolition.bottles.map(({ id, status, outcome }) => ({ id, status, outcome })), [
    { id: 'prince-of-abolition-potion-1', status: 'CONSUMED', outcome: 'FAILURE' },
    { id: 'prince-of-abolition-potion-2', status: 'CONSUMED', outcome: 'FAILURE' },
    { id: 'prince-of-abolition-potion-3', status: 'CONSUMED', outcome: 'SUCCESS' },
  ]);
  return value;
}
export function readBlackEmperorNaturalRows(): BlackEmperorNaturalRow[] {
  const text = readFileSync(join(directory, 'commands.jsonl'), 'utf8');
  assert(text.endsWith('\n'), 'Incomplete compact receipt tail');
  return text.trimEnd().split('\n').map(line => JSON.parse(line));
}
export function readBlackEmperorNaturalSnapshot(which: 'initial' | 'terminal'): BlackEmperorNaturalSnapshot {
  const summary = readBlackEmperorNaturalSummary();
  const count = which === 'initial' ? BLACK_EMPEROR227_PREFIX_COUNT : summary.commandCount;
  const items = summary.keySnapshots.filter(item => item.commandCount === count && item.reasons.includes(which));
  assert.equal(items.length, 1);
  const item = items[0]!;
  assert.equal(item.file, `key-${item.commandCount}-${item.reasons.join('-')}.json.gz`);
  assert.match(item.file, /^key-\d+-[a-z0-9-]+\.json\.gz$/);
  const value: BlackEmperorNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(directory, item.file))).toString('utf8'));
  assert.equal(blackEmperorNaturalHash(value), item.contentSha256); assert.equal(value.format, BLACK_EMPEROR227_FORMAT);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [224, 'black-emperor-v224']);
  assert.equal(value.commandCount, count); assert.equal(value.commandCount, item.commandCount);
  assert.equal(value.newCount, which === 'initial' ? 0 : summary.newCount); assert.equal(value.newCount, item.newCount);
  assert.deepEqual(value.reasons, item.reasons); assert.deepEqual(value.random, value.final.random);
  assert.deepEqual(value.anchor, blackEmperorNaturalAnchor(value.final, value.public));
  assert.equal(value.anchor.privateStateSha256, item.stateSha256); assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  if (which === 'terminal') {
    assert.equal(value.anchor.privateStateSha256, summary.finalPrivateStateSha256);
    assert.equal(value.anchor.publicStateSha256, summary.finalWholePublicSha256);
    assert.deepEqual(blackEmperorNaturalOutcome(value.final), summary.actual);
  }
  return value;
}
export function blackEmperorNaturalReceipt(next: SliceState, before: SliceState) {
  const previous = before.blackEmperor.journal, journal = next.blackEmperor.journal, latest = journal.at(-1);
  assert.deepEqual(journal.slice(0, previous.length), previous, 'Prior successful and failed receipts changed');
  if (latest?.revision === next.revision) {
    assert.equal(journal.length, previous.length + 1);
    assert.equal(latest.before.budget.week, before.week); assert.equal(latest.after.budget.week, next.week);
    const construction = next.blackEmperor.scene?.constructionReceipts ?? [];
    const earlier = before.blackEmperor.scene?.constructionReceipts ?? [];
    assert.deepEqual(construction.slice(0, earlier.length), earlier, 'Prior construction receipts changed');
    return { id: latest.id, checks: latest.randomReceipts, finance: latest.financeReceipts,
      notes: latest.notes, beforeDigest: latest.beforeDigest, afterDigest: latest.afterDigest,
      elapsedWeeks: next.week - before.week, construction: construction.slice(earlier.length) };
  }
  assert(!before.blackEmperor.guidanceKnown && next.blackEmperor.guidanceKnown, 'Missing actual BlackEmperor action receipt');
  return { id: null, checks: [], finance: [], notes: next.chronicle.slice(before.chronicle.length) };
}
export function blackEmperorNaturalOutcome(state: SliceState) {
  const root = state.blackEmperor, scene = root.scene, construction = scene?.constructionReceipts ?? [];
  const compounds = root.materials?.compounds ?? [], cities = scene?.realm.cities ?? [];
  const tombs = cities.flatMap(city => city.tombs), festival = scene?.festivals.at(-1);
  return { status: state.status, sequence: state.progression.sequence, promoted: state.progression.sequence === 0,
    phase: scene?.phase ?? null, reported: Boolean(scene?.returnReportEventId),
    ordinaryExit: scene?.playerPosition === 'OUTSIDE', exitClosed: scene?.exit.door === 'CLOSED',
    sceneStatus: scene?.status ?? null, originalDepartureRecorded: Boolean(scene?.originalDepartureEventId),
    realmFounded: Boolean(scene?.realm.charterEventId), population: scene?.realm.totalPopulation ?? 0,
    completedTombs: tombs.filter(tomb => tomb.stage === 3 && tomb.integrity > 0).length,
    festivalCities: festival?.participation.length ?? 0,
    festivalParticipants: festival?.participation.reduce((sum, item) => sum + item.participants, 0) ?? 0,
    orderDistortionApplied: Boolean(scene?.orderDistortionApplied), delayedImpactApplied: Boolean(scene?.delayedImpactApplied),
    constructionBatches: construction.length, constructionWeeks: construction.reduce((sum, item) => sum + item.weeks, 0),
    compoundOutcomes: compounds.map(({ id, status, consumedEventId }) => ({ id, status, consumedEventId })),
    week: state.week, health: state.health, mind: state.mind, spirituality: state.spirituality };
}
/** Verify retained bytes without rebuilding, replaying original924, or opening live output. */
export function assertBlackEmperorNaturalRetainedFreeze(summary: BlackEmperorNaturalSummary): void {
  const { sha256, ...payload } = JSON.parse(readFileSync(join(directory, 'runtime-freeze.json'), 'utf8')) as {
    sha256: string; source: { path: string; sha256: string }; files: { file: string; sha256: string }[];
  };
  assert.equal(sha256, summary.runtimeFreezeSha256); assert.equal(blackEmperorNaturalHash(payload), sha256);
  assert.equal(payload.source.path, 'tests/fixtures/prince-of-abolition-v02050/natural.json');
  assert.equal(payload.source.sha256, BLACK_EMPEROR227_SOURCE_SHA);
  for (const [retained, source] of [['producer.mjs', 'scripts/play/black-emperor-stage.mjs'],
    ['producer-tests.mjs', 'scripts/play/black-emperor-stage.test.mjs']] as const) {
    const original = payload.files.find(file => file.file === source);
    assert(original, `Missing captured producer evidence: ${source}`);
    assert.equal(blackEmperorNaturalSha(readFileSync(join(directory, retained))), original.sha256);
  }
}

/** Same whole-public boundary as the retained producer, without importing its runtime. */
export function assertBlackEmperorNaturalPublic(value: unknown, path = '$'): void {
  if (!value || typeof value !== 'object') return;
  const forbidden = new Set(['random', 'seed', 'cursor', 'randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter',
    'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'randomReceipts', 'sourceDigest', 'historyDigest',
    'originalWorldDigest', 'combatHistoryDigest', 'originalsDigest', 'acquisitionDigest', 'compoundDigest', 'beforeDigest', 'afterDigest',
    'privateSite', 'actorId', 'predecessorActorId', 'incumbentActorId', 'custodianActorId', 'preparationRoll', 'futureRoll', 'nextRoll', 'privateSource']);
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`, physicalActor = key === 'actorId'
      && /^\$\.mercurySnake\.life\.ledger\.\d+\.moves\.\d+\.actorId$/.test(next)
      && ['PLAYER', 'GUIDE', 'CW3-VERA', 'CW3-CART', 'CW3-PARCEL'].includes(child), inheritedNull = key === 'actorId' && child === null
      && ['$.divineHand.life.site.guard.actorId', '$.glory.life.site.guard.actorId'].includes(next);
    assert(!(forbidden.has(key) && !inheritedNull && !physicalActor)
      && !(key === 'source' && child !== null && typeof child === 'object'), `Private public field ${next}`);
    assertBlackEmperorNaturalPublic(child, next);
  }
}
