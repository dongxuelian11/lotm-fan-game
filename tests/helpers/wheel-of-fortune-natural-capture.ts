import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Completed fixture evidence only; never reads the running producer or checkpoint. */
const directory = 'tests/fixtures/wheel-of-fortune-v02260';
export const WHEEL_OF_FORTUNE226_FORMAT = 'NEW226_MERCURY841_COMPACT_OWNED_V1';
export const WHEEL_OF_FORTUNE226_SOURCE_SHA = '6d4542561817368ec18b535ee6195084412f97f356c00d511b8cf57c8198d574';
export const WHEEL_OF_FORTUNE226_SOURCE_STATE_SHA = 'd26118eb1a46c04dada97dffaf7ea4094eafaf00d4830b80a8caac2a6f8d50fa';
export const WHEEL_OF_FORTUNE226_FINAL_PRIVATE_SHA = 'f515024a05d5fb92988d29d19fae62a3b9e321a7b8edfa4a8aa2897b4078f0ea';
export const WHEEL_OF_FORTUNE226_FINAL_PUBLIC_SHA = 'dba5e9804522e210068ae71237a26454458022a781b68f269563caf1c0fb89ef';
export const WHEEL_OF_FORTUNE226_FROZEN_ROOTS = ['monster', 'machine', 'lucky', 'calamityPriest', 'winner',
  'misfortuneMage', 'chaosWalker', 'fateProphet', 'mercurySnake', 'world', 'combatHistory', 'character'] as const;
export const wheelOfFortuneNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const wheelOfFortuneNaturalHash = (value: unknown) => wheelOfFortuneNaturalSha(stableStringify(value));
export const wheelOfFortuneNaturalAnchor = (state: SliceState, view: SliceProjection) => ({
  revision: state.revision, privateStateSha256: wheelOfFortuneNaturalHash(state), publicStateSha256: wheelOfFortuneNaturalHash(view),
  random: state.random, randomSha256: wheelOfFortuneNaturalHash(state.random),
});
type Anchor = ReturnType<typeof wheelOfFortuneNaturalAnchor>;
export interface WheelOfFortuneNaturalSnapshot {
  format: string; commandCount: number; newCount: number; reasons: string[]; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface WheelOfFortuneNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'WHEEL_OF_FORTUNE_ACTION'; commandCount: number; intent: SliceIntent;
  commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
export interface WheelOfFortuneNaturalActionRow extends WheelOfFortuneNaturalRow {
  newCount: number; before: Anchor; after: Anchor; publicAction: SliceProjection['wheelOfFortune']['actions'][number];
  receipt: ReturnType<typeof wheelOfFortuneNaturalReceipt>; actual: ReturnType<typeof wheelOfFortuneNaturalOutcome>;
}
interface SnapshotIndex {
  file: string; commandCount: number; newCount: number; reasons: string[];
  stateSha256: string; publicSha256: string; contentSha256: string;
}
export interface WheelOfFortuneNaturalSummary {
  format: string; hashEncoding: string; stage: string; commandCount: number; originalCommandCount: number;
  newCount: number; revision: number; finalPrivateStateSha256: string; finalWholePublicSha256: string;
  sourceSha256: string; runtimeFreezeSha256: string; strictFinalValidation: boolean;
  historicalPrefixReplayed: boolean; randomOverridden: boolean; futureDrawInspected: boolean;
  selectedPublicPreferredOnly: boolean; actual: ReturnType<typeof wheelOfFortuneNaturalOutcome>; keySnapshots: SnapshotIndex[];
}
export function readWheelOfFortuneNaturalSummary(): WheelOfFortuneNaturalSummary {
  const value: WheelOfFortuneNaturalSummary = JSON.parse(readFileSync(join(directory, 'summary.json'), 'utf8'));
  assert.equal(value.format, WHEEL_OF_FORTUNE226_FORMAT);
  assert.equal(value.hashEncoding, 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256');
  assert.equal(value.stage, 'NATURAL_S0_REPORTED_EXIT');
  assert.equal(value.originalCommandCount, 841); assert.equal(value.newCount, 88);
  assert.equal(value.commandCount, 841 + value.newCount); assert.equal(value.revision, 842 + value.newCount);
  assert.equal(value.finalPrivateStateSha256, WHEEL_OF_FORTUNE226_FINAL_PRIVATE_SHA);
  assert.equal(value.finalWholePublicSha256, WHEEL_OF_FORTUNE226_FINAL_PUBLIC_SHA);
  assert.equal(value.sourceSha256, WHEEL_OF_FORTUNE226_SOURCE_SHA);
  assert.deepEqual([value.strictFinalValidation, value.selectedPublicPreferredOnly, value.historicalPrefixReplayed,
    value.randomOverridden, value.futureDrawInspected], [true, true, false, false, false]);
  assert.deepEqual(value.actual, { status: 'ACTIVE', sequence: 0, promoted: true, reported: true, ordinaryExit: true,
    returnedHome: true, exitClosed: true, sceneStatus: 'COMPLETED', originalDepartureRecorded: true,
    completedCommissions: 1, observedOpportunityWeek: 215, impactBufferApplied: true, shortReturnApplied: true,
    loadMethod: 'ABILITY', returnMethod: 'ABILITY', week: 216, health: 95, mind: 68, spirituality: 32 });
  for (const hash of [value.finalPrivateStateSha256, value.finalWholePublicSha256, value.runtimeFreezeSha256])
    assert.match(hash, /^[a-f0-9]{64}$/);
  return value;
}
export function readWheelOfFortuneNaturalSource(): { final: SliceState; commands: SliceIntent[] } {
  const bytes = gunzipSync(readFileSync(join(directory, 'source-natural.json.gz')));
  assert.equal(wheelOfFortuneNaturalSha(bytes), WHEEL_OF_FORTUNE226_SOURCE_SHA);
  const value = JSON.parse(bytes.toString('utf8')) as { final: SliceState; commands: SliceIntent[] };
  assert.equal(wheelOfFortuneNaturalHash(value.final), WHEEL_OF_FORTUNE226_SOURCE_STATE_SHA); assert.equal(value.commands.length, 841);
  assert.deepEqual([value.final.revision, value.final.status, value.final.week], [842, 'ACTIVE', 202]);
  assert.deepEqual([value.final.health, value.final.mind, value.final.spirituality, value.final.cash, value.final.actionsRemaining],
    [90, 88, 86, 20, 3]);
  assert.equal(value.final.progression.pathwayId, 'wheel'); assert.equal(value.final.progression.sequence, 1);
  assert.equal(Object.keys(value.final.progression.mastery).length, 19);
  assert.deepEqual(value.final.random, { seed: 'monster-natural-v060', cursor: 306 });
  assert.deepEqual(value.final.injuries, [{ id: 'monster-rebuild-natural:combat:1:PLAYER:841:0',
    severity: 'LIGHT', acquiredRevision: 841, treatedRevision: null }]);
  return value;
}
export function readWheelOfFortuneNaturalRows(): WheelOfFortuneNaturalRow[] {
  const text = readFileSync(join(directory, 'commands.jsonl'), 'utf8');
  assert(text.endsWith('\n'), 'Incomplete compact receipt tail');
  return text.trimEnd().split('\n').map(line => JSON.parse(line));
}
export function readWheelOfFortuneNaturalSnapshot(which: 'initial' | 'terminal'): WheelOfFortuneNaturalSnapshot {
  const summary = readWheelOfFortuneNaturalSummary(), count = which === 'initial' ? 841 : summary.commandCount;
  const items = summary.keySnapshots.filter(item => item.commandCount === count && item.reasons.includes(which));
  assert.equal(items.length, 1);
  const item = items[0]!;
  assert.equal(item.file, `key-${item.commandCount}-${item.reasons.join('-')}.json.gz`);
  assert.match(item.file, /^key-\d+-[a-z0-9-]+\.json\.gz$/);
  const value: WheelOfFortuneNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(directory, item.file))).toString('utf8'));
  assert.equal(wheelOfFortuneNaturalHash(value), item.contentSha256); assert.equal(value.format, WHEEL_OF_FORTUNE226_FORMAT);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [223, 'wheel-of-fortune-v223']);
  assert.equal(value.commandCount, count); assert.equal(value.commandCount, item.commandCount);
  assert.equal(value.newCount, which === 'initial' ? 0 : summary.newCount); assert.equal(value.newCount, item.newCount);
  assert.deepEqual(value.reasons, item.reasons); assert.deepEqual(value.random, value.final.random);
  assert.deepEqual(value.anchor, wheelOfFortuneNaturalAnchor(value.final, value.public));
  assert.equal(value.anchor.privateStateSha256, item.stateSha256); assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  if (which === 'terminal') {
    assert.equal(value.anchor.privateStateSha256, summary.finalPrivateStateSha256);
    assert.equal(value.anchor.publicStateSha256, summary.finalWholePublicSha256);
    assert.deepEqual(wheelOfFortuneNaturalOutcome(value.final), summary.actual);
  }
  return value;
}
export function wheelOfFortuneNaturalReceipt(next: SliceState, before: SliceState) {
  const latest = next.wheelOfFortune.journal.at(-1);
  if (latest?.revision === next.revision) return { id: latest.id, checks: latest.randomReceipts,
    finance: latest.financeReceipts, notes: latest.notes, beforeDigest: latest.beforeDigest, afterDigest: latest.afterDigest };
  assert(!before.wheelOfFortune.guidanceKnown && next.wheelOfFortune.guidanceKnown, 'Missing actual WheelOfFortune action receipt');
  return { id: null, checks: [], finance: [], notes: next.chronicle.slice(before.chronicle.length) };
}
export function wheelOfFortuneNaturalOutcome(state: SliceState) {
  const root = state.wheelOfFortune, scene = root.scene, commissions = scene?.commissions ?? [];
  return { status: state.status, sequence: state.progression.sequence, promoted: state.progression.sequence === 0,
    reported: Boolean(scene?.returnReportEventId), ordinaryExit: scene?.playerPosition === 'OUTSIDE',
    returnedHome: root.frame?.location === 'WF226-JUNCTION', exitClosed: scene?.exit.door === 'CLOSED',
    sceneStatus: scene?.status ?? null, originalDepartureRecorded: Boolean(scene?.originalDepartureEventId),
    completedCommissions: commissions.filter(item => item.reportEventId).length,
    observedOpportunityWeek: scene ? commissions[scene.commissionIndex]?.opportunityWeek ?? null : null,
    impactBufferApplied: Boolean(scene?.impactBufferApplied), shortReturnApplied: Boolean(scene?.shortReturnApplied),
    loadMethod: scene?.device.loadMethod ?? null, returnMethod: scene?.device.returnMethod ?? null,
    week: state.week, health: state.health, mind: state.mind, spirituality: state.spirituality };
}
/** Verify retained bytes without rebuilding, replaying original841, or opening live output. */
export function assertWheelOfFortuneNaturalRetainedFreeze(summary: WheelOfFortuneNaturalSummary): void {
  const { sha256, ...payload } = JSON.parse(readFileSync(join(directory, 'runtime-freeze.json'), 'utf8')) as {
    sha256: string; source: { path: string; sha256: string }; files: { file: string; sha256: string }[];
  };
  assert.equal(sha256, summary.runtimeFreezeSha256); assert.equal(wheelOfFortuneNaturalHash(payload), sha256);
  assert.equal(payload.source.path, 'tests/fixtures/mercury-snake-v02040/natural.json');
  assert.equal(payload.source.sha256, WHEEL_OF_FORTUNE226_SOURCE_SHA);
  for (const [retained, source] of [['producer.mjs', 'scripts/play/wheel-of-fortune-stage.mjs'],
    ['producer-tests.mjs', 'scripts/play/wheel-of-fortune-stage.test.mjs']] as const) {
    const original = payload.files.find(file => file.file === source);
    assert(original, `Missing captured producer evidence: ${source}`);
    assert.equal(wheelOfFortuneNaturalSha(readFileSync(join(directory, retained))), original.sha256);
  }
}
