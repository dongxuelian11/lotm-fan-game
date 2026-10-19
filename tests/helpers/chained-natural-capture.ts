import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Completed fixture evidence only; never reads the running producer or checkpoint. */
const directory = 'tests/fixtures/chained-v02250';
export const CHAINED225_FORMAT = 'NEW225_RESTORED203_LIVING778_COMPACT_OWNED_V1';
export const CHAINED225_SOURCE_SHA = '0d99439f4e950a633e20fdba372fb0e59beb41982ccff5fe6a27fd2834adf442';
export const CHAINED225_SOURCE_STATE_SHA = '83bdd71ac25cbaf6c0286b8a83c6fec9c481f4ed28c703b0b6b37584a3fac6ad';
export const CHAINED225_FINAL_PRIVATE_SHA = '3cd8c1f6652c78f732716209833c18b50a48503d776000e841f893f91d6b2e34';
export const CHAINED225_FINAL_PUBLIC_SHA = 'c84b7706794be09ba04e4b6cdba7e5ccca03b7093eadf77d7111cc41f10c973d';
// Actual closed capture: the fully prepared first S0 consumption ended in death.
export const CHAINED225_TERMINAL_STAGE = 'NATURAL_DEATH';
export const CHAINED225_NEW_COUNT = 93;
export const CHAINED225_FINAL_INTENT = { type: 'CHAINED', command: {
  type: 'CONSUME', compoundId: 'CH225-COMPOUND-1', confirmed: true,
} } satisfies SliceIntent;
export const CHAINED225_TERMINAL_ACTUAL = { status: 'DEAD', sequence: 1, promoted: false, reported: false,
  ordinaryExit: true, returnedHome: false, sceneStatus: 'ABORTED', week: 191, health: 0, mind: 0, spirituality: 88 };
export const CHAINED225_FROZEN_ROOTS = ['prisoner', 'madman', 'werewolf', 'zombie', 'wraith',
  'puppet', 'silentDisciple', 'ancientEvil', 'abomination', 'world', 'combatHistory', 'character'] as const;
export const chainedNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const chainedNaturalHash = (value: unknown) => chainedNaturalSha(stableStringify(value));
export const chainedNaturalAnchor = (state: SliceState, view: SliceProjection) => ({
  revision: state.revision, privateStateSha256: chainedNaturalHash(state), publicStateSha256: chainedNaturalHash(view),
  random: state.random, randomSha256: chainedNaturalHash(state.random),
});
type Anchor = ReturnType<typeof chainedNaturalAnchor>;
export interface ChainedNaturalSnapshot {
  format: string; commandCount: number; newCount: number; reasons: string[]; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface ChainedNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'CHAINED_ACTION'; commandCount: number; intent: SliceIntent;
  commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
export interface ChainedNaturalActionRow extends ChainedNaturalRow {
  newCount: number; before: Anchor; after: Anchor; publicAction: SliceProjection['chained']['actions'][number];
  receipt: ReturnType<typeof chainedNaturalReceipt>; actual: ReturnType<typeof chainedNaturalOutcome>;
}
interface SnapshotIndex {
  file: string; commandCount: number; newCount: number; reasons: string[];
  stateSha256: string; publicSha256: string; contentSha256: string;
}
export interface ChainedNaturalSummary {
  format: string; hashEncoding: string; stage: string; commandCount: number; originalCommandCount: number;
  newCount: number; revision: number; finalPrivateStateSha256: string; finalWholePublicSha256: string;
  sourceSha256: string; runtimeFreezeSha256: string; strictFinalValidation: boolean;
  historicalPrefixReplayed: boolean; randomOverridden: boolean; futureDrawInspected: boolean;
  selectedPublicPreferredOnly: boolean; actual: ReturnType<typeof chainedNaturalOutcome>; keySnapshots: SnapshotIndex[];
}
export function readChainedNaturalSummary(): ChainedNaturalSummary {
  const value: ChainedNaturalSummary = JSON.parse(readFileSync(join(directory, 'summary.json'), 'utf8'));
  assert.equal(value.format, CHAINED225_FORMAT);
  assert.equal(value.hashEncoding, 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256');
  assert.equal(value.stage, CHAINED225_TERMINAL_STAGE);
  assert.equal(value.originalCommandCount, 778); assert.equal(value.newCount, CHAINED225_NEW_COUNT);
  assert.equal(value.commandCount, 778 + value.newCount); assert.equal(value.revision, 779 + value.newCount);
  assert.equal(value.finalPrivateStateSha256, CHAINED225_FINAL_PRIVATE_SHA);
  assert.equal(value.finalWholePublicSha256, CHAINED225_FINAL_PUBLIC_SHA);
  assert.equal(value.sourceSha256, CHAINED225_SOURCE_SHA);
  assert.deepEqual([value.strictFinalValidation, value.selectedPublicPreferredOnly, value.historicalPrefixReplayed,
    value.randomOverridden, value.futureDrawInspected], [true, true, false, false, false]);
  assert.deepEqual(value.actual, CHAINED225_TERMINAL_ACTUAL);
  for (const hash of [value.finalPrivateStateSha256, value.finalWholePublicSha256, value.runtimeFreezeSha256])
    assert.match(hash, /^[a-f0-9]{64}$/);
  return value;
}
export function readChainedNaturalSource(): { final: SliceState; commands: SliceIntent[] } {
  const bytes = gunzipSync(readFileSync(join(directory, 'source-natural.json.gz')));
  assert.equal(chainedNaturalSha(bytes), CHAINED225_SOURCE_SHA);
  const value = JSON.parse(bytes.toString('utf8')) as { final: SliceState; commands: SliceIntent[] };
  assert.equal(chainedNaturalHash(value.final), CHAINED225_SOURCE_STATE_SHA); assert.equal(value.commands.length, 778);
  assert.deepEqual([value.final.revision, value.final.status, value.final.week], [779, 'ACTIVE', 175]);
  assert.deepEqual([value.final.health, value.final.mind, value.final.spirituality, value.final.cash, value.final.actionsRemaining],
    [100, 48, 82, 180, 2]);
  assert.equal(value.final.progression.pathwayId, 'chained'); assert.equal(value.final.progression.sequence, 1);
  assert.equal(value.final.progression.acting, 100);
  assert.equal(Object.keys(value.final.progression.mastery).length, 21);
  assert.deepEqual(value.final.random, { seed: 'prisoner-natural-v057', cursor: 291 });
  return value;
}
export function readChainedNaturalRows(): ChainedNaturalRow[] {
  const text = readFileSync(join(directory, 'commands.jsonl'), 'utf8');
  assert(text.endsWith('\n'), 'Incomplete compact receipt tail');
  return text.trimEnd().split('\n').map(line => JSON.parse(line));
}
export function readChainedNaturalSnapshot(which: 'initial' | 'terminal'): ChainedNaturalSnapshot {
  const summary = readChainedNaturalSummary(), count = which === 'initial' ? 778 : summary.commandCount;
  const items = summary.keySnapshots.filter(item => item.commandCount === count && item.reasons.includes(which));
  assert.equal(items.length, 1);
  const item = items[0]!;
  assert.equal(item.file, `key-${item.commandCount}-${item.reasons.join('-')}.json.gz`);
  assert.match(item.file, /^key-\d+-[a-z0-9-]+\.json\.gz$/);
  const value: ChainedNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(directory, item.file))).toString('utf8'));
  assert.equal(chainedNaturalHash(value), item.contentSha256); assert.equal(value.format, CHAINED225_FORMAT);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [222, 'chained-v222']);
  assert.equal(value.commandCount, count); assert.equal(value.commandCount, item.commandCount);
  assert.equal(value.newCount, which === 'initial' ? 0 : summary.newCount); assert.equal(value.newCount, item.newCount);
  assert.deepEqual(value.reasons, item.reasons); assert.deepEqual(value.random, value.final.random);
  assert.deepEqual(value.anchor, chainedNaturalAnchor(value.final, value.public));
  assert.equal(value.anchor.privateStateSha256, item.stateSha256); assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  if (which === 'terminal') {
    assert.equal(value.anchor.privateStateSha256, summary.finalPrivateStateSha256);
    assert.equal(value.anchor.publicStateSha256, summary.finalWholePublicSha256);
    assert.deepEqual(chainedNaturalOutcome(value.final), summary.actual);
  }
  return value;
}
export function chainedNaturalReceipt(next: SliceState, before: SliceState) {
  const latest = next.chained.journal.at(-1);
  if (latest?.revision === next.revision) return { id: latest.id, checks: latest.randomReceipts,
    finance: latest.financeReceipts, notes: latest.notes, beforeDigest: latest.beforeDigest, afterDigest: latest.afterDigest };
  assert(!before.chained.guidanceKnown && next.chained.guidanceKnown, 'Missing actual Chained action receipt');
  return { id: null, checks: [], finance: [], notes: next.chronicle.slice(before.chronicle.length) };
}
export function chainedNaturalOutcome(state: SliceState) {
  const root = state.chained, scene = root.scene;
  return { status: state.status, sequence: state.progression.sequence, promoted: state.progression.sequence === 0,
    reported: Boolean(scene?.returnReportEventId), ordinaryExit: scene?.playerPosition === 'OUTSIDE',
    returnedHome: root.frame?.location === 'CH225-CORRIDOR', sceneStatus: scene?.status ?? null,
    week: state.week, health: state.health, mind: state.mind, spirituality: state.spirituality };
}
/** Verify retained bytes without rebuilding, replaying original778, or opening live output. */
export function assertChainedNaturalRetainedFreeze(summary: ChainedNaturalSummary): void {
  const { sha256, ...payload } = JSON.parse(readFileSync(join(directory, 'runtime-freeze.json'), 'utf8')) as {
    sha256: string; source: { path: string; sha256: string }; files: { file: string; sha256: string }[];
  };
  assert.equal(sha256, summary.runtimeFreezeSha256); assert.equal(chainedNaturalHash(payload), sha256);
  assert.equal(payload.source.path, 'tests/fixtures/abomination-v02030/natural.json');
  assert.equal(payload.source.sha256, CHAINED225_SOURCE_SHA);
  for (const [retained, source] of [['producer.mjs', 'scripts/play/chained-stage.mjs'],
    ['producer-tests.mjs', 'scripts/play/chained-stage.test.mjs']] as const) {
    const original = payload.files.find(file => file.file === source);
    assert(original, `Missing captured producer evidence: ${source}`);
    assert.equal(chainedNaturalSha(readFileSync(join(directory, retained))), original.sha256);
  }
}
