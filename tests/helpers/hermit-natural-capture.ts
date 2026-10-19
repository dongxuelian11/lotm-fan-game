import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';

/** Completed, retained evidence only. Never generate a route or inspect future RNG. */
const directory = 'tests/fixtures/hermit-v02220';
export const HERMIT222_FORMAT = 'NEW222_RESTORED200_LIVING827_COMPACT_OWNED_V1';
export const HERMIT222_SOURCE_SHA = '7dfb8d05d6dfd262aa804fd6e8a4a1c0256dccffbdebdd0dcad4e77e830b0cb7';
export const HERMIT222_SOURCE_STATE_SHA = 'bf23ffe532b8be8c33fd44d5e5408a1600a1e7a6173ef73482a52a4336596f4b';
export const HERMIT222_HISTORY_SHA = '1fd5f8c1fa3f29bb60925268851a597976904065c8b0ed66b95ce95258a92548';
export const HERMIT222_PREFIX_SHA = 'c7399defd4dea35d147abe15d84fa3c3ff2ddcef101e30173a211208b183121f';
export const HERMIT222_FROZEN_ROOTS = ['pryer', 'combatScholar', 'wizard', 'scrollProfessor',
  'starMystic', 'mystic', 'prophecyMaster', 'sage', 'knowledgeEmperor'] as const;
interface HermitNaturalTerminalPin {
  summarySha256: string; stage: string; status: SliceState['status'];
  commandCount: number; newCount: number; revision: number; checkCount: number;
}
// Pinned only after the actual return report: no paused or predicted endpoint.
export const HERMIT222_TERMINAL: HermitNaturalTerminalPin | undefined = {
  summarySha256: 'ea82ab64dd331bf0157eeb98661aee41567f58e8b6e42f95bce432c60ad73b26',
  stage: 'NATURAL_S0_RETURN_REPORTED', status: 'ACTIVE', commandCount: 941, newCount: 114, revision: 942, checkCount: 3,
};
export function hermitNaturalTerminalPin(): HermitNaturalTerminalPin {
  assert(HERMIT222_TERMINAL, 'Actual Hermit terminal status, counts and summary SHA have not been pinned');
  assert.match(HERMIT222_TERMINAL.summarySha256, /^[a-f0-9]{64}$/);
  return HERMIT222_TERMINAL;
}
export const hermitNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const hermitNaturalHash = (value: unknown) => hermitNaturalSha(stableStringify(value));
export const hermitNaturalAnchor = (state: SliceState, view: SliceProjection) => ({
  revision: state.revision, privateStateSha256: hermitNaturalHash(state),
  publicStateSha256: hermitNaturalHash(view), random: state.random, randomSha256: hermitNaturalHash(state.random),
});
type Anchor = ReturnType<typeof hermitNaturalAnchor>;
export interface HermitNaturalSnapshot {
  format: string; commandCount: number; newCount: number; reasons: string[]; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface HermitNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'HERMIT_ACTION'; commandCount: number;
  intent: SliceIntent; commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
export interface HermitNaturalActionRow extends HermitNaturalRow {
  newCount: number; before: Anchor; after: Anchor;
  publicAction: SliceProjection['hermit']['actions'][number];
  receipt: { id: string | null; checks: SliceState['hermit']['journal'][number]['randomReceipts']; finance: unknown[]; notes: unknown[];
    beforeDigest?: string; afterDigest?: string };
  actual: ReturnType<typeof hermitNaturalOutcome>;
}
export function hermitNaturalOutcome(state: SliceState) {
  const root = state.hermit, scene = root.scene;
  return { status: state.status, sequence: state.progression.sequence,
    promoted: state.progression.sequence === 0 && root.promotionWeek !== null,
    promotionWeek: root.promotionWeek, scenePhase: scene?.phase ?? null, sceneStatus: scene?.status ?? null,
    preparationReported: !!scene?.preparationReportEventId, reported: !!scene?.returnReportEventId,
    returnReportEventId: scene?.returnReportEventId ?? null,
    ordinaryExit: !!scene && scene.playerPosition === 'OUTSIDE' && scene.owner.position === 'OUTSIDE'
      && scene.workers.every(worker => worker.position === 'OUTSIDE') && scene.body === 'SOLID' && !scene.window && !scene.contact,
    originalReturned: !!scene && scene.custody.holder === 'OWNER' && scene.custody.position === scene.owner.position && !!scene.custody.returnEventId,
    returnedHome: root.frame?.location === 'HM222-ARCHIVE-OUTSIDE', location: root.frame?.location ?? null,
    informationApplied: scene?.informationCompleted ?? false, transferApplied: scene?.transferCompleted ?? false,
    ordinaryCopyCompleted: scene?.manualCopyCompleted ?? false,
    week: state.week, health: state.health, mind: state.mind, spirituality: state.spirituality };
}
export interface HermitNaturalSummary {
  format: string; hashEncoding: string; stage: string; commandCount: number; originalCommandCount: number;
  newCount: number; revision: number; finalPrivateStateSha256: string; finalWholePublicSha256: string;
  sourceSha256: string; historySha256: string; prefixCommandsSha256: string; runtimeFreezeSha256: string;
  frozenSourceKeys: string[]; strictFinalValidation: boolean; historicalPrefixReplayed: boolean;
  randomOverridden: boolean; futureDrawInspected: boolean; selectedPublicPreferredOnly: boolean; fullNaturalS9ToS0: boolean;
  provenance: { inheritedDirectedPrefix: boolean; fullNaturalS9ToS1: boolean; historicalPrefixReplayed: boolean;
    originalArchiveCommandCount: number; originalArchiveTerminalStatus: string;
    sourceRevision: number; prefixCommandCount: number; nextCommandCount: number; nextRevision: number };
  actual: ReturnType<typeof hermitNaturalOutcome>;
  keySnapshots: { file: string; commandCount: number; newCount: number; reasons: string[];
    stateSha256: string; publicSha256: string; contentSha256: string }[];
}
export function readHermitNaturalSummary(): HermitNaturalSummary {
  const pin = hermitNaturalTerminalPin(), bytes = readFileSync(join(directory, 'summary.json'));
  assert.equal(hermitNaturalSha(bytes), pin.summarySha256);
  const value: HermitNaturalSummary = JSON.parse(bytes.toString('utf8'));
  assert.equal(value.format, HERMIT222_FORMAT);
  assert.equal(value.hashEncoding, 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256');
  assert.match(value.stage, /^NATURAL_/);
  assert.deepEqual([value.stage, value.actual.status, value.commandCount, value.newCount, value.revision],
    [pin.stage, pin.status, pin.commandCount, pin.newCount, pin.revision]);
  assert.equal(value.originalCommandCount, 827); assert(value.newCount > 0);
  assert.equal(value.commandCount, 827 + value.newCount); assert.equal(value.revision, 828 + value.newCount);
  assert.equal(value.sourceSha256, HERMIT222_SOURCE_SHA); assert.equal(value.historySha256, HERMIT222_HISTORY_SHA);
  assert.equal(value.prefixCommandsSha256, HERMIT222_PREFIX_SHA);
  assert.deepEqual(value.frozenSourceKeys, HERMIT222_FROZEN_ROOTS);
  assert.deepEqual([value.strictFinalValidation, value.selectedPublicPreferredOnly,
    value.historicalPrefixReplayed, value.randomOverridden, value.futureDrawInspected], [true, true, false, false, false]);
  assert.deepEqual([value.provenance.inheritedDirectedPrefix, value.provenance.fullNaturalS9ToS1,
    value.provenance.historicalPrefixReplayed, value.provenance.originalArchiveCommandCount,
    value.provenance.originalArchiveTerminalStatus, value.provenance.prefixCommandCount,
    value.provenance.sourceRevision, value.provenance.nextCommandCount, value.provenance.nextRevision],
  [false, true, false, 831, 'DEAD', 827, 828, 828, 829]);
  assert.equal(value.fullNaturalS9ToS0, value.actual.promoted);
  return value;
}
function originalBytes(retained: string, original: string, expected: string): Buffer {
  const bytes = gunzipSync(readFileSync(join(directory, retained)));
  assert.equal(hermitNaturalSha(bytes), expected);
  assert.equal(hermitNaturalSha(readFileSync(join('tests/fixtures/knowledge-emperor-v02000', original))), expected);
  return bytes;
}
export function readHermitNaturalSource(): SliceState {
  const source: SliceState = JSON.parse(originalBytes('source-snapshot.json.gz',
    'snapshot-recoveredBeforeEncounter.json', HERMIT222_SOURCE_SHA).toString('utf8'));
  assert.equal(hermitNaturalHash(source), HERMIT222_SOURCE_STATE_SHA);
  assert.equal(source.revision, 828); assert.equal(source.status, 'ACTIVE');
  assert.deepEqual(source.random, { seed: 'pryer-natural-v048', cursor: 346 });
  return source;
}
export function readHermitNaturalArchive(): { commands: SliceIntent[]; final: SliceState } {
  const archive = JSON.parse(originalBytes('original831-natural.json.gz', 'natural.json', HERMIT222_HISTORY_SHA).toString('utf8')) as {
    commands: SliceIntent[]; final: SliceState;
  };
  assert.equal(archive.commands.length, 831); assert.equal(archive.final.status, 'DEAD');
  assert.equal(hermitNaturalHash(archive.commands.slice(0, 827)), HERMIT222_PREFIX_SHA);
  return archive;
}
/** Verify captured bytes, not today's runtime files, which later stages may change. */
export function assertHermitNaturalRetainedFreeze(summary: HermitNaturalSummary): void {
  const { sha256, ...payload } = JSON.parse(readFileSync(join(directory, 'runtime-freeze.json'), 'utf8')) as {
    sha256: string; source: { sha256: string }; history: { sha256: string }; files: { file: string; sha256: string }[];
  };
  assert.equal(sha256, summary.runtimeFreezeSha256); assert.equal(hermitNaturalHash(payload), sha256);
  assert.equal(payload.source.sha256, HERMIT222_SOURCE_SHA); assert.equal(payload.history.sha256, HERMIT222_HISTORY_SHA);
  for (const [retained, source] of [['producer.mjs', 'scripts/play/hermit-stage.mjs'],
    ['producer-tests.mjs', 'scripts/play/hermit-stage.test.mjs']] as const) {
    const original = payload.files.find(file => file.file === source);
    assert(original, `Missing captured producer evidence: ${source}`);
    assert.equal(hermitNaturalSha(readFileSync(join(directory, retained))), original.sha256);
  }
  assertHermitNaturalAuditHandoff(summary);
}
/** One pinned audit-only transition. No runtime drift, old-action replay,
 * replacement intent or rewritten pre-handoff evidence is admitted. */
function assertHermitNaturalAuditHandoff(summary: HermitNaturalSummary): void {
  const prior = join(directory, 'before-audit-handoff910');
  const proofBytes = readFileSync(join(directory, 'continuation910-proof.json'));
  assert.equal(hermitNaturalSha(proofBytes), '2eedc032fb98162638919f6c48efdd82c7606376ca431704ab8739f662b27587');
  type FileEvidence = { file: string; bytes: number; sha256: string };
  type Freeze = { sha256: string; files: FileEvidence[]; source: unknown; history: unknown; nodeVersion: string };
  const proof = JSON.parse(proofBytes.toString('utf8')) as {
    format: string; commandCount: number; completedNewCommands: number; commandChainChecked: boolean;
    historical827Replayed: boolean; newActionsReplayedHere: boolean; productRuntimeAndOriginalInputsByteEqual: boolean;
    completePrivatePublicRandomEqual: boolean; oldFreezeSha256: string; newFreezeSha256: string;
    originalCheckpointSha256: string; originalFiles: FileEvidence[]; changedFiles: { file: string; sha256: string }[];
    pendingIntentPreserved: Pick<HermitNaturalActionRow, 'intent' | 'publicAction' | 'before' | 'commandCount'>;
  };
  assert.equal(proof.format, 'NEW222_EXACT910_AUDIT_ONLY_HANDOFF');
  assert.deepEqual([proof.commandCount, proof.completedNewCommands, proof.commandChainChecked,
    proof.historical827Replayed, proof.newActionsReplayedHere, proof.productRuntimeAndOriginalInputsByteEqual,
    proof.completePrivatePublicRandomEqual], [910, 83, true, false, false, true, true]);
  assert.equal(proof.oldFreezeSha256, '60605b89ab7c40a838e2ec109b3fe971985232f026a9169747739c61f594e9c9');
  assert.equal(proof.newFreezeSha256, '8a0d03c05c1b4e31557d171fc4cc2da8f3062287f33b3b4ae7a8d1b53bd8cea6');
  assert.equal(summary.runtimeFreezeSha256, proof.newFreezeSha256);
  assert.deepEqual(proof.changedFiles, [
    { file: 'scripts/play/hermit-stage.mjs', sha256: '424679f4b3595e2cdc763b441e61307b63d2a1e1b8e63439d8e02d25218f7c71' },
    { file: 'scripts/play/hermit-stage.test.mjs', sha256: '310e2ad2812f7085d4f9a9978ffc21731268b1f162fe41f3980ba7bb5170445a' },
  ]);
  const { sha256: oldSha, ...oldFreeze } = JSON.parse(readFileSync(join(prior, 'runtime-freeze.json'), 'utf8')) as Freeze;
  const { sha256: newSha, ...newFreeze } = JSON.parse(readFileSync(join(directory, 'runtime-freeze.json'), 'utf8')) as Freeze;
  assert.equal(oldSha, proof.oldFreezeSha256); assert.equal(hermitNaturalHash(oldFreeze), oldSha);
  assert.equal(newSha, proof.newFreezeSha256); assert.equal(hermitNaturalHash(newFreeze), newSha);
  assert.deepEqual({ ...newFreeze, files: oldFreeze.files }, oldFreeze);
  assert.deepEqual(newFreeze.files.map(item => item.file), oldFreeze.files.map(item => item.file));
  const changed = newFreeze.files.filter((item, index) => hermitNaturalHash(item) !== hermitNaturalHash(oldFreeze.files[index]));
  assert.deepEqual(changed.map(({ file, sha256 }) => ({ file, sha256 })), proof.changedFiles);
  const replaced = new Set(['checkpoint.json.gz', 'commands.jsonl', 'runtime-freeze.json', 'producer.mjs', 'producer-tests.mjs', 'summary.json']);
  for (const item of proof.originalFiles) {
    assert.match(item.file, /^[a-z0-9.-]+$/);
    const bytes = readFileSync(join(replaced.has(item.file) ? prior : directory, item.file));
    assert.equal(bytes.length, item.bytes); assert.equal(hermitNaturalSha(bytes), item.sha256);
  }
  const checkpoint = JSON.parse(gunzipSync(readFileSync(join(prior, 'checkpoint.json.gz'))).toString('utf8')) as {
    sha256: string; payload: { state: SliceState; anchor: Anchor; pending: typeof proof.pendingIntentPreserved;
      commandCount: number; newCount: number; freezeSha256: string; rowSha256: string; terminal: unknown };
  };
  assert.equal(checkpoint.sha256, proof.originalCheckpointSha256);
  assert.equal(hermitNaturalHash(checkpoint.payload), checkpoint.sha256);
  const cp = checkpoint.payload;
  assert.deepEqual([cp.commandCount, cp.newCount, cp.freezeSha256, cp.terminal], [910, 83, oldSha, null]);
  assert.equal(hermitNaturalHash(cp.state), cp.anchor.privateStateSha256);
  assert.deepEqual(cp.state.random, cp.anchor.random); assert.equal(hermitNaturalHash(cp.state.random), cp.anchor.randomSha256);
  assert.deepEqual(cp.pending, proof.pendingIntentPreserved); assert.deepEqual(cp.pending.before, cp.anchor);
  assert.deepEqual(cp.pending.intent, { type: 'HERMIT', command: { type: 'BUY_SEAL' } });
  const previousBytes = readFileSync(join(prior, 'commands.jsonl')), completeBytes = readFileSync(join(directory, 'commands.jsonl'));
  assert(completeBytes.subarray(0, previousBytes.length).equals(previousBytes), 'The original910 command bytes changed');
  assert.equal(previousBytes.toString('utf8').trimEnd().split('\n').length, 910);
  const rows = readHermitNaturalRows(), pending = rows[910] as HermitNaturalActionRow;
  assert.equal(rows[909]!.rowSha256, cp.rowSha256);
  assert.deepEqual({ commandCount: pending.commandCount, intent: pending.intent, publicAction: pending.publicAction, before: pending.before }, cp.pending);
  assert.equal(pending.newCount, 84);
}
export function readHermitNaturalRows(): HermitNaturalRow[] {
  return readFileSync(join(directory, 'commands.jsonl'), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
}
export function readHermitNaturalSnapshot(which: 'initial' | 'terminal'): HermitNaturalSnapshot {
  const summary = readHermitNaturalSummary(), initial = which === 'initial';
  const candidates = summary.keySnapshots.filter(item => item.reasons.includes(which));
  assert.equal(candidates.length, 1);
  const item = candidates[0]!;
  assert.equal(item.file, `key-${item.commandCount}-${item.reasons.join('-')}.json.gz`);
  assert.match(item.file, /^key-\d+-[a-z-]+\.json\.gz$/);
  const value: HermitNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(directory, item.file))).toString('utf8'));
  assert.equal(hermitNaturalHash(value), item.contentSha256); assert.equal(value.format, HERMIT222_FORMAT);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [219, 'hermit-v219']);
  assert.equal(value.commandCount, initial ? 827 : summary.commandCount);
  assert.equal(value.newCount, initial ? 0 : summary.newCount); assert.deepEqual(value.reasons, item.reasons);
  assert.deepEqual(value.anchor, hermitNaturalAnchor(value.final, value.public));
  assert.deepEqual(value.random, value.final.random);
  assert.equal(value.anchor.privateStateSha256, initial
    ? '3bbf0499906d0c8c06fd0f018a2eb5fd709c5a568c80089b68aa884c041bbd58' : summary.finalPrivateStateSha256);
  assert.equal(value.anchor.publicStateSha256, initial
    ? '846d57c9a725d5e6b4eaa71cc8af348a99b6a223c8f97d5fda12f425442d7f6d' : summary.finalWholePublicSha256);
  assert.equal(value.anchor.privateStateSha256, item.stateSha256); assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  return value;
}
