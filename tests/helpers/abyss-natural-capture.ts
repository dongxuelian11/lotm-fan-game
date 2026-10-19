import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Completed fixture evidence only; never reads the running producer or checkpoint. */
const directory = 'tests/fixtures/abyss-v02240';
export const ABYSS224_FORMAT = 'NEW224_RESTORED202_LIVING821_COMPACT_OWNED_V1';
export const ABYSS224_SOURCE_SHA = '44f863ff2286be6aff77275d5c8455b2641680214d5b879e285d9d976b6d3ada';
export const ABYSS224_SOURCE_STATE_SHA = '44c70ccbb2fae65d71fe50e3221872a7d5029bfddbd9a816dd9ea94c96e399b3';
export const ABYSS224_FINAL_PRIVATE_SHA = 'bd75a200424587d95a60e29bf9c1deefd8475919dec001d7df86ac8a08b7a2a3';
export const ABYSS224_FINAL_PUBLIC_SHA = '0b8626de7f5c94946ca36357313fd02faa00560c588785319836498738076fec';
export const ABYSS224_FROZEN_ROOTS = ['criminal', 'unwinged', 'serialKiller', 'demon', 'desireApostle',
  'devil', 'blatherer', 'bloodDuke', 'uncleanMonarch', 'world', 'combatHistory', 'character'] as const;
export const abyssNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const abyssNaturalHash = (value: unknown) => abyssNaturalSha(stableStringify(value));
export const abyssNaturalAnchor = (state: SliceState, view: SliceProjection) => ({
  revision: state.revision, privateStateSha256: abyssNaturalHash(state), publicStateSha256: abyssNaturalHash(view),
  random: state.random, randomSha256: abyssNaturalHash(state.random),
});
type Anchor = ReturnType<typeof abyssNaturalAnchor>;
export interface AbyssNaturalSnapshot {
  format: string; commandCount: number; newCount: number; reasons: string[]; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface AbyssNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'ABYSS_ACTION'; commandCount: number; intent: SliceIntent;
  commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
export interface AbyssNaturalActionRow extends AbyssNaturalRow {
  newCount: number; before: Anchor; after: Anchor; publicAction: SliceProjection['abyss']['actions'][number];
  receipt: ReturnType<typeof abyssNaturalReceipt>; actual: ReturnType<typeof abyssNaturalOutcome>;
}
interface SnapshotIndex {
  file: string; commandCount: number; newCount: number; reasons: string[];
  stateSha256: string; publicSha256: string; contentSha256: string;
}
export interface AbyssNaturalSummary {
  format: string; hashEncoding: string; stage: string; commandCount: number; originalCommandCount: number;
  newCount: number; revision: number; finalPrivateStateSha256: string; finalWholePublicSha256: string;
  sourceSha256: string; runtimeFreezeSha256: string; strictFinalValidation: boolean;
  historicalPrefixReplayed: boolean; randomOverridden: boolean; futureDrawInspected: boolean;
  selectedPublicPreferredOnly: boolean; actual: ReturnType<typeof abyssNaturalOutcome>; keySnapshots: SnapshotIndex[];
}
export function readAbyssNaturalSummary(): AbyssNaturalSummary {
  const value: AbyssNaturalSummary = JSON.parse(readFileSync(join(directory, 'summary.json'), 'utf8'));
  assert.equal(value.format, ABYSS224_FORMAT);
  assert.equal(value.hashEncoding, 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256');
  assert.equal(value.stage, 'NATURAL_S0_REPORTED_EXIT');
  assert.equal(value.originalCommandCount, 821); assert.equal(value.newCount, 143);
  assert.equal(value.commandCount, 821 + value.newCount); assert.equal(value.revision, 822 + value.newCount);
  assert.equal(value.finalPrivateStateSha256, ABYSS224_FINAL_PRIVATE_SHA);
  assert.equal(value.finalWholePublicSha256, ABYSS224_FINAL_PUBLIC_SHA);
  assert.equal(value.sourceSha256, ABYSS224_SOURCE_SHA);
  assert.deepEqual([value.strictFinalValidation, value.selectedPublicPreferredOnly, value.historicalPrefixReplayed,
    value.randomOverridden, value.futureDrawInspected], [true, true, false, false, false]);
  assert.deepEqual(value.actual, { status: 'ACTIVE', sequence: 0, promoted: true, reported: true, ordinaryExit: true,
    returnedHome: true, sceneStatus: 'COMPLETED', week: 227, health: 100, mind: 84, spirituality: 92 });
  for (const hash of [value.finalPrivateStateSha256, value.finalWholePublicSha256, value.runtimeFreezeSha256])
    assert.match(hash, /^[a-f0-9]{64}$/);
  return value;
}
export function readAbyssNaturalSource(): { final: SliceState; commands: SliceIntent[] } {
  const bytes = gunzipSync(readFileSync(join(directory, 'source-natural.json.gz')));
  assert.equal(abyssNaturalSha(bytes), ABYSS224_SOURCE_SHA);
  const value = JSON.parse(bytes.toString('utf8')) as { final: SliceState; commands: SliceIntent[] };
  assert.equal(abyssNaturalHash(value.final), ABYSS224_SOURCE_STATE_SHA); assert.equal(value.commands.length, 821);
  assert.deepEqual([value.final.revision, value.final.status, value.final.week], [822, 'ACTIVE', 198]);
  assert.deepEqual([value.final.health, value.final.mind, value.final.spirituality, value.final.cash, value.final.actionsRemaining],
    [100, 92, 110, 210, 2]);
  assert.equal(value.final.progression.pathwayId, 'abyss'); assert.equal(value.final.progression.sequence, 1);
  assert.equal(Object.keys(value.final.progression.mastery).length, 18);
  return value;
}
export function readAbyssNaturalRows(): AbyssNaturalRow[] {
  const text = readFileSync(join(directory, 'commands.jsonl'), 'utf8');
  assert(text.endsWith('\n'), 'Incomplete compact receipt tail');
  return text.trimEnd().split('\n').map(line => JSON.parse(line));
}
export function readAbyssNaturalSnapshot(which: 'initial' | 'terminal'): AbyssNaturalSnapshot {
  const summary = readAbyssNaturalSummary(), count = which === 'initial' ? 821 : summary.commandCount;
  const items = summary.keySnapshots.filter(item => item.commandCount === count && item.reasons.includes(which));
  assert.equal(items.length, 1);
  const item = items[0]!;
  assert.equal(item.file, `key-${item.commandCount}-${item.reasons.join('-')}.json.gz`);
  assert.match(item.file, /^key-\d+-[a-z0-9-]+\.json\.gz$/);
  const value: AbyssNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(directory, item.file))).toString('utf8'));
  assert.equal(abyssNaturalHash(value), item.contentSha256); assert.equal(value.format, ABYSS224_FORMAT);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [221, 'abyss-v221']);
  assert.equal(value.commandCount, count); assert.equal(value.commandCount, item.commandCount);
  assert.equal(value.newCount, which === 'initial' ? 0 : summary.newCount); assert.equal(value.newCount, item.newCount);
  assert.deepEqual(value.reasons, item.reasons); assert.deepEqual(value.random, value.final.random);
  assert.deepEqual(value.anchor, abyssNaturalAnchor(value.final, value.public));
  assert.equal(value.anchor.privateStateSha256, item.stateSha256); assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  if (which === 'terminal') {
    assert.equal(value.anchor.privateStateSha256, summary.finalPrivateStateSha256);
    assert.equal(value.anchor.publicStateSha256, summary.finalWholePublicSha256);
    assert.deepEqual(abyssNaturalOutcome(value.final), summary.actual);
  }
  return value;
}
export function abyssNaturalReceipt(next: SliceState, before: SliceState) {
  const latest = next.abyss.journal.at(-1);
  if (latest?.revision === next.revision) return { id: latest.id, checks: latest.randomReceipts,
    finance: latest.financeReceipts, notes: latest.notes, beforeDigest: latest.beforeDigest, afterDigest: latest.afterDigest };
  assert(!before.abyss.guidanceKnown && next.abyss.guidanceKnown, 'Missing actual Abyss action receipt');
  return { id: null, checks: [], finance: [], notes: next.chronicle.slice(before.chronicle.length) };
}
export function abyssNaturalOutcome(state: SliceState) {
  const root = state.abyss, scene = root.scene;
  return { status: state.status, sequence: state.progression.sequence, promoted: state.progression.sequence === 0,
    reported: Boolean(scene?.returnReportEventId), ordinaryExit: scene?.playerPosition === 'OUTSIDE',
    returnedHome: root.frame?.location === 'AB224-WAREHOUSE', sceneStatus: scene?.status ?? null,
    week: state.week, health: state.health, mind: state.mind, spirituality: state.spirituality };
}
/** Verify retained bytes without rebuilding, replaying original821, or opening live output. */
export function assertAbyssNaturalRetainedFreeze(summary: AbyssNaturalSummary): void {
  const { sha256, ...payload } = JSON.parse(readFileSync(join(directory, 'runtime-freeze.json'), 'utf8')) as {
    sha256: string; source: { path: string; sha256: string }; files: { file: string; sha256: string }[];
  };
  assert.equal(sha256, summary.runtimeFreezeSha256); assert.equal(abyssNaturalHash(payload), sha256);
  assert.equal(payload.source.path, 'tests/fixtures/unclean-monarch-v02020/natural.json');
  assert.equal(payload.source.sha256, ABYSS224_SOURCE_SHA);
  for (const [retained, source] of [['producer.mjs', 'scripts/play/abyss-stage.mjs'],
    ['producer-tests.mjs', 'scripts/play/abyss-stage.test.mjs']] as const) {
    const original = payload.files.find(file => file.file === source);
    assert(original, `Missing captured producer evidence: ${source}`);
    assert.equal(abyssNaturalSha(readFileSync(join(directory, retained))), original.sha256);
  }
}
