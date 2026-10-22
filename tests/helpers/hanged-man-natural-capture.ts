import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Completed, committed evidence only. Never reads a running capture/checkpoint. */
const directory = 'tests/fixtures/hanged-man-v02230';
export const HANGED_MAN223_SOURCE_SHA = 'c550a22334fe0fbeab0927dfef8c6ee6ed0937a45ce5e6d4506bd0755045e4ef';
export const HANGED_MAN223_SOURCE_STATE_SHA = '60046b323634afaf09347a2f5e8b7e8f62258a4e7b86b9fe635bdd078724b102';
export const HANGED_MAN223_HISTORY_SHA = '54c625eb2781a5e5dbd9b31b0e9d09c3cb89d60a83c16d82d631d37d5329e79b';
export const HANGED_MAN223_PREFIX_SHA = '59247a2bbb9f873cfd407fc8ab4047a9c3d55a41eebfddc626cbdcb6e7549cb4';
export const HANGED_MAN223_FORMAT = 'NEW223_ACTUAL723_RECOVERY_COMPACT_OWNED_V1';
export const HANGED_MAN223_FROZEN_ROOTS = ['secretSupplicant', 'listener', 'shadowAscetic', 'roseBishop',
  'shepherd', 'blackKnight', 'threeHeadedTemplar', 'elder', 'darkAngel'] as const;
export const hangedManNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const hangedManNaturalHash = (value: unknown) => hangedManNaturalSha(stableStringify(value));
export const hangedManNaturalAnchor = (state: SliceState, view: SliceProjection) => ({
  revision: state.revision, privateStateSha256: hangedManNaturalHash(state),
  publicStateSha256: hangedManNaturalHash(view), random: state.random, randomSha256: hangedManNaturalHash(state.random),
});
type Anchor = ReturnType<typeof hangedManNaturalAnchor>;
export interface HangedManNaturalSnapshot {
  format: string; commandCount: number; newCount: number; reasons: string[]; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface HangedManNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'HANGED_MAN_CONTINUATION_ACTION'; commandCount: number;
  intent: SliceIntent; commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
type ChapterAction = (SliceProjection['hangedMan']['actions'][number]
  | SliceProjection['darkAngel']['actions'][number]) & { selectionRule: string };
export type HangedManNaturalPublicAction = ChapterAction | {
  kind: 'ORDINARY_RESOURCE'; action: 'WORK' | 'REST'; enabled: boolean; preferredAction: false;
  label: string; rule: string; publicBudget: ReturnType<typeof hangedManNaturalPublicBudget>;
};
export interface HangedManNaturalActionRow extends HangedManNaturalRow {
  newCount: number; before: Anchor; after: Anchor; publicAction: HangedManNaturalPublicAction;
  receipt: ReturnType<typeof hangedManNaturalReceipt>; actual: ReturnType<typeof hangedManNaturalOutcome>;
}
interface SnapshotIndex {
  file: string; commandCount: number; newCount: number; reasons: string[];
  stateSha256: string; publicSha256: string; contentSha256: string;
}
export interface HangedManNaturalSummary {
  format: string; hashEncoding: string; stage: string; commandCount: number; originalCommandCount: number;
  newCount: number; revision: number; finalPrivateStateSha256: string; finalWholePublicSha256: string;
  sourceSha256: string; historySha256: string; prefixCommandsSha256: string; runtimeFreezeSha256: string;
  frozenSourceKeys: string[]; strictFinalValidation: boolean; historicalPrefixReplayed: boolean;
  randomOverridden: boolean; futureDrawInspected: boolean; selectedPublicControlsOnly: boolean;
  selectedS0PublicPreferredOnly: boolean; preludePolicy: string;
  provenance: { snapshotRoot: string; snapshotStateSha256: string; originalArchiveCommandCount: number;
    archiveRole: string; prefixCommandCount: number; sourceRevision: number; nextCommandCount: number;
    nextRevision: number; historicalPrefixReplayed: boolean; inheritedDirectedPrefix: boolean; fullNaturalS9ToS0: boolean };
  predecessorFreeze: { revision: number; roots: Record<string, string> } | null;
  actual: ReturnType<typeof hangedManNaturalOutcome>; keySnapshots: SnapshotIndex[];
}
export function readHangedManNaturalSummary(): HangedManNaturalSummary {
  const bytes = readFileSync(join(directory, 'summary.json'));
  const value: HangedManNaturalSummary = JSON.parse(bytes.toString('utf8'));
  assert.equal(value.format, HANGED_MAN223_FORMAT);
  assert.equal(value.hashEncoding, 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256');
  assert(['NATURAL_DEATH', 'NATURAL_S0_RETURN_REPORTED'].includes(value.stage));
  assert.equal(value.originalCommandCount, 723); assert(Number.isSafeInteger(value.newCount) && value.newCount > 0);
  assert.equal(value.commandCount, 723 + value.newCount); assert.equal(value.revision, 724 + value.newCount);
  assert.equal(value.sourceSha256, HANGED_MAN223_SOURCE_SHA); assert.equal(value.historySha256, HANGED_MAN223_HISTORY_SHA);
  assert.equal(value.prefixCommandsSha256, HANGED_MAN223_PREFIX_SHA);
  assert.deepEqual(value.frozenSourceKeys, HANGED_MAN223_FROZEN_ROOTS);
  assert.deepEqual([value.strictFinalValidation, value.selectedPublicControlsOnly, value.selectedS0PublicPreferredOnly,
    value.historicalPrefixReplayed, value.randomOverridden, value.futureDrawInspected], [true, true, true, false, false, false]);
  assert.equal(value.preludePolicy, 'FIXED_REAL_RESOURCE_AND_SAME_ORIGINAL_RECOVERY_THEN_PUBLIC_LIFE');
  assert.deepEqual([value.provenance.snapshotRoot, value.provenance.snapshotStateSha256,
    value.provenance.originalArchiveCommandCount, value.provenance.archiveRole, value.provenance.prefixCommandCount,
    value.provenance.sourceRevision, value.provenance.nextCommandCount, value.provenance.nextRevision,
    value.provenance.historicalPrefixReplayed, value.provenance.inheritedDirectedPrefix, value.provenance.fullNaturalS9ToS0],
  ['final', HANGED_MAN223_SOURCE_STATE_SHA, 824, 'READ_ONLY_OLD_FOURTH_INDEPENDENT_BOTTLE_SUCCESS_NOT_SOURCE',
    723, 724, 724, 725, false, false, false]);
  assert.equal(value.actual.status, value.stage === 'NATURAL_DEATH' ? 'DEAD' : 'ACTIVE');
  for (const hash of [value.finalPrivateStateSha256, value.finalWholePublicSha256, value.runtimeFreezeSha256]) assert.match(hash, /^[a-f0-9]{64}$/);
  return value;
}
/** Raw198 .final is the source; neither beforeLast nor the old824 independent-fourth S1 success is substituted. */
export function readHangedManNaturalSource(): SliceState {
  const bytes = gunzipSync(readFileSync(join(directory, 'source-snapshot.json.gz')));
  assert.equal(hangedManNaturalSha(bytes), HANGED_MAN223_SOURCE_SHA);
  const value = JSON.parse(bytes.toString('utf8')) as {
    commandCount: number; final: SliceState; beforeLast: SliceState; lastIntent: SliceIntent;
  };
  assert.equal(value.commandCount, 723); assert.equal(value.beforeLast.revision, 723);
  assert.deepEqual(value.lastIntent, { type: 'DARK_ANGEL', command: { type: 'CONSUME', bottleId: 'dark-angel-potion-3', confirmed: true } });
  assert.equal(hangedManNaturalHash(value.final), HANGED_MAN223_SOURCE_STATE_SHA);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [198, 'dark-angel-v198']);
  assert.equal(Object.hasOwn(value.final, 'hangedMan'), false);
  assert.equal(value.final.revision, 724); assert.equal(value.final.status, 'ACTIVE');
  assert.equal(value.final.progression.pathwayId, 'hanged-man'); assert.equal(value.final.progression.sequence, 2);
  assert.deepEqual(value.final.random, { seed: 'secret-supplicant-natural-v051', cursor: 356 });
  return value.final;
}
export function readHangedManNaturalArchive(): { commands: SliceIntent[]; final: SliceState } {
  const bytes = gunzipSync(readFileSync(join(directory, 'original824-natural.json.gz')));
  assert.equal(hangedManNaturalSha(bytes), HANGED_MAN223_HISTORY_SHA);
  const value = JSON.parse(bytes.toString('utf8')) as { commands: SliceIntent[]; final: SliceState };
  assert.equal(value.commands.length, 824); assert.equal(value.final.status, 'ACTIVE');
  assert.equal(value.final.progression.sequence, 1);
  assert.equal(hangedManNaturalHash(value.commands.slice(0, 723)), HANGED_MAN223_PREFIX_SHA);
  assert.deepEqual(value.commands[723], { type: 'DARK_ANGEL', command: { type: 'REQUEST_SUPPLY' } });
  return value;
}
export function readHangedManNaturalRows(): HangedManNaturalRow[] {
  const text = readFileSync(join(directory, 'commands.jsonl'), 'utf8');
  assert(text.endsWith('\n'), 'Incomplete compact receipt tail');
  return text.trimEnd().split('\n').map(line => JSON.parse(line));
}
function readSnapshot(item: SnapshotIndex): HangedManNaturalSnapshot {
  assert.match(item.file, /^key-\d+-[a-z0-9-]+\.json\.gz$/);
  const value: HangedManNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(directory, item.file))).toString('utf8'));
  assert.equal(hangedManNaturalHash(value), item.contentSha256);
  assert.equal(value.format, HANGED_MAN223_FORMAT);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [220, 'hanged-man-v220']);
  assert.equal(value.commandCount, item.commandCount); assert.equal(value.newCount, item.newCount);
  assert.deepEqual(value.reasons, item.reasons); assert.deepEqual(value.random, value.final.random);
  assert.deepEqual(value.anchor, hangedManNaturalAnchor(value.final, value.public));
  assert.equal(value.anchor.privateStateSha256, item.stateSha256); assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  return value;
}
export function readHangedManNaturalSnapshot(which: 'initial' | 'terminal'): HangedManNaturalSnapshot {
  const summary = readHangedManNaturalSummary(), count = which === 'initial' ? 723 : summary.commandCount;
  // Earlier safe stops also retained a terminal key. They remain immutable evidence.
  const items = summary.keySnapshots.filter(item => item.commandCount === count && item.reasons.includes(which));
  assert.equal(items.length, 1);
  const value = readSnapshot(items[0]!);
  assert.equal(value.commandCount, which === 'initial' ? 723 : summary.commandCount);
  assert.equal(value.newCount, which === 'initial' ? 0 : summary.newCount);
  if (which === 'terminal') {
    assert.equal(value.anchor.privateStateSha256, summary.finalPrivateStateSha256);
    assert.equal(value.anchor.publicStateSha256, summary.finalWholePublicSha256);
    assert.deepEqual(hangedManNaturalOutcome(value.final), summary.actual);
  }
  return value;
}
export const hangedManNaturalPublicBudget = (view: SliceProjection) => ({ week: view.week, health: view.health,
  mind: view.mind, spirituality: view.spirituality, cash: view.cash, actionsRemaining: view.actionsRemaining,
  pollution: view.pollution, wagePaid: view.wagePaid });
export function hangedManNaturalReceipt(next: SliceState, before: SliceState) {
  const latest = next.hangedMan.journal.at(-1);
  if (latest?.revision === next.revision) return { id: latest.id, checks: latest.randomReceipts, finance: latest.financeReceipts,
    notes: latest.notes, beforeDigest: latest.beforeDigest, afterDigest: latest.afterDigest };
  const acquisition = next.darkAngel.acquisitionJournal.slice(before.darkAngel.acquisitionJournal.length)
    .map(e => ({ revision: e.revision, command: e.command, before: e.before, after: e.after,
      check: e.check, cursorBefore: e.cursorBefore, cursorAfter: e.cursorAfter }));
  const life = next.darkAngel.life.journal.slice(before.darkAngel.life.journal.length)
    .map(e => ({ revision: e.revision, command: e.command, before: e.before, after: e.after, check: e.check, outcome: e.outcome }));
  return { id: null, acquisition, life, notes: next.chronicle.slice(before.chronicle.length) };
}
export function hangedManNaturalOutcome(state: SliceState) {
  const root = state.hangedMan, scene = root.scene;
  return { status: state.status, sequence: state.progression.sequence,
    s1Promoted: state.darkAngel.promotionWeek !== null, s1Reflected: state.darkAngel.life.reflected,
    promoted: state.progression.sequence === 0 && root.promotionWeek !== null,
    promotionWeek: root.promotionWeek, scenePhase: scene?.phase ?? null, sceneStatus: scene?.status ?? null,
    evacuationReported: !!scene?.evacuationReportEventId, reported: !!scene?.returnReportEventId,
    returnReportEventId: scene?.returnReportEventId ?? null,
    ordinaryExit: !!scene && scene.playerPosition === 'OUTSIDE' && scene.owner.position === 'OUTSIDE' &&
      scene.workers.length === 2 && scene.workers.every(worker => worker.position === 'OUTSIDE' && !!worker.passage.a && !!worker.passage.b && !!worker.passage.exit) &&
      !scene.window && !scene.contact && !scene.segments.A.open && !scene.segments.B.open && scene.exit.door === 'CLOSED',
    returnedHome: root.frame?.location === 'HM223-CORRIDOR', location: root.frame?.location ?? null,
    pressureApplied: scene?.pressureApplied ?? false, cooperativeSealApplied: scene?.cooperativeSealApplied ?? false,
    week: state.week, health: state.health, mind: state.mind, spirituality: state.spirituality };
}

/** Verify retained source/runtime/producer evidence, never rebuild or launch a route.
 * There is no speculative terminal pin. The eventual recorded bytes and one full
 * new-command replay must establish the actual outcome before any pin is added. */
export function assertHangedManNaturalRetainedFreeze(summary: HangedManNaturalSummary): void {
  const { sha256, ...payload } = JSON.parse(readFileSync(join(directory, 'runtime-freeze.json'), 'utf8')) as {
    sha256: string; source: { sha256: string }; history: { sha256: string }; files: { file: string; sha256: string }[];
  };
  assert.equal(sha256, summary.runtimeFreezeSha256); assert.equal(hangedManNaturalHash(payload), sha256);
  assert.equal(payload.source.sha256, HANGED_MAN223_SOURCE_SHA); assert.equal(payload.history.sha256, HANGED_MAN223_HISTORY_SHA);
  for (const [retained, source] of [['producer.mjs', 'scripts/play/hanged-man-stage.mjs'],
    ['producer-tests.mjs', 'scripts/play/hanged-man-stage.test.mjs']] as const) {
    const original = payload.files.find(file => file.file === source);
    assert(original, `Missing captured producer evidence: ${source}`);
    assert.equal(hangedManNaturalSha(readFileSync(join(directory, retained))), original.sha256);
  }
}
