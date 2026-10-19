import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from './current-save-format.js';

/** Completed, committed evidence only. Never reads a running capture/checkpoint. */
const directory = 'tests/fixtures/demoness-v02210';
export const DEMONESS221_SOURCE_SHA = '34e43b3cb872a7c43851e5d3d583983e06b2081d8645bc42cd10b6d243a5bb67';
export const DEMONESS221_SOURCE_STATE_SHA = '8af32e14eb3c151815f6ec8a0bf215e701e4f01945d417c04312fb5a6bf1f3f0';
export const DEMONESS221_HISTORY_SHA = 'baf997edd399bee66132fc7278a741968063dee012e960c9e2fc80ae1f1f4339';
export const DEMONESS221_PREFIX_SHA = 'e7020f05603b64ded38f60da0fea7bb5c2031c0bb40ad1de9328a969a1b30a23';
export const DEMONESS221_HANDOFF_SHA = '75244fe33a3f8387ebfb8c0984f53e7a6c4ae2558820023c54c26f900562485a';
export const DEMONESS221_PROJECTION_AUDIT_SHA = 'f698abc5e8d2cb3de4982cce26dba011d3c0c6dd4eebe97bb02c08fddb13ffbe';
// Pinned from the completed actual961 capture, never from a desired endpoint.
export const DEMONESS221_SUMMARY_SHA = '96a7c3e244680d0877aa6494548b0f39988d9c832ff9d2272732b194de943f74';
export const DEMONESS221_FROZEN_ROOTS = ['assassin', 'instigator', 'witch', 'pleasure', 'pain',
  'despair', 'unagingDemoness', 'calamityDemoness', 'apocalypseDemoness'] as const;
export const demonessNaturalSha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const demonessNaturalHash = (value: unknown) => demonessNaturalSha(stableStringify(value));
export const demonessNaturalAnchor = (state: SliceState, view: SliceProjection) => ({
  revision: state.revision, privateStateSha256: demonessNaturalHash(state),
  publicStateSha256: demonessNaturalHash(view), random: state.random, randomSha256: demonessNaturalHash(state.random),
});
type Anchor = ReturnType<typeof demonessNaturalAnchor>;
export interface DemonessNaturalSnapshot {
  format: string; commandCount: number; newCount: number; reasons: string[]; anchor: Anchor;
  final: SliceState; random: SliceState['random']; public: SliceProjection;
}
export interface DemonessNaturalRow {
  kind: 'HISTORICAL_COMMAND' | 'DEMONESS_CONTINUATION_ACTION'; commandCount: number;
  intent: SliceIntent; commandSha256: string; previousRowSha256: string | null; rowSha256: string;
}
type ChapterAction = (SliceProjection['demoness']['actions'][number]
  | SliceProjection['apocalypseDemoness']['actions'][number]) & { selectionRule: string };
export type DemonessNaturalPublicAction = ChapterAction | {
  kind: 'ORDINARY_RESOURCE'; action: 'WORK' | 'REST'; enabled: boolean; preferredAction: false;
  label: string; rule: string; publicBudget: ReturnType<typeof demonessNaturalPublicBudget>;
};
export interface DemonessNaturalActionRow extends DemonessNaturalRow {
  newCount: number; before: Anchor; after: Anchor; publicAction: DemonessNaturalPublicAction;
  receipt: ReturnType<typeof demonessNaturalReceipt>; actual: ReturnType<typeof demonessNaturalOutcome>;
}
interface SnapshotIndex {
  file: string; commandCount: number; newCount: number; reasons: string[];
  stateSha256: string; publicSha256: string; contentSha256: string;
}
export interface DemonessNaturalSummary {
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
  actual: ReturnType<typeof demonessNaturalOutcome>; keySnapshots: SnapshotIndex[];
}
export function readDemonessNaturalSummary(): DemonessNaturalSummary {
  assert.match(DEMONESS221_SUMMARY_SHA, /^[a-f0-9]{64}$/, 'The actual terminal summary has not been pinned yet');
  const bytes = readFileSync(join(directory, 'summary.json'));
  assert.equal(demonessNaturalSha(bytes), DEMONESS221_SUMMARY_SHA);
  const value: DemonessNaturalSummary = JSON.parse(bytes.toString('utf8'));
  assert.equal(value.format, 'NEW221_ACTUAL688_RECOVERY_COMPACT_OWNED_V1');
  assert.equal(value.hashEncoding, 'SORTED_KEYS_CANONICAL_JSON_UTF8_SHA256');
  assert(['NATURAL_DEATH', 'NATURAL_S0_REPORTED_EXIT', 'NATURAL_TERMINAL'].includes(value.stage));
  assert.equal(value.originalCommandCount, 688); assert(value.newCount > 20);
  assert.equal(value.commandCount, 688 + value.newCount); assert.equal(value.revision, 689 + value.newCount);
  assert.equal(value.sourceSha256, DEMONESS221_SOURCE_SHA); assert.equal(value.historySha256, DEMONESS221_HISTORY_SHA);
  assert.equal(value.prefixCommandsSha256, DEMONESS221_PREFIX_SHA);
  assert.deepEqual(value.frozenSourceKeys, DEMONESS221_FROZEN_ROOTS);
  assert.deepEqual([value.strictFinalValidation, value.selectedPublicControlsOnly, value.selectedS0PublicPreferredOnly,
    value.historicalPrefixReplayed, value.randomOverridden, value.futureDrawInspected], [true, true, true, false, false, false]);
  assert.equal(value.preludePolicy, 'FIXED_REAL_RESOURCE_AND_SAME_ORIGINAL_RECOVERY_THEN_PUBLIC_LIFE');
  assert.deepEqual([value.provenance.snapshotRoot, value.provenance.snapshotStateSha256,
    value.provenance.originalArchiveCommandCount, value.provenance.archiveRole, value.provenance.prefixCommandCount,
    value.provenance.sourceRevision, value.provenance.nextCommandCount, value.provenance.nextRevision,
    value.provenance.historicalPrefixReplayed, value.provenance.inheritedDirectedPrefix, value.provenance.fullNaturalS9ToS0],
  ['final', DEMONESS221_SOURCE_STATE_SHA, 854, 'READ_ONLY_OLD_SIXTH_INDEPENDENT_BOTTLE_SUCCESS_NOT_SOURCE',
    688, 689, 689, 690, false, false, false]);
  return value;
}
/** Raw196 .final is the source; neither beforeLast nor the old854 S1 success is substituted. */
export function readDemonessNaturalSource(): SliceState {
  const bytes = gunzipSync(readFileSync(join(directory, 'source-snapshot.json.gz')));
  assert.equal(demonessNaturalSha(bytes), DEMONESS221_SOURCE_SHA);
  const value = JSON.parse(bytes.toString('utf8')) as {
    commandCount: number; final: SliceState; beforeLast: SliceState; lastIntent: SliceIntent;
  };
  assert.equal(value.commandCount, 688); assert.equal(value.beforeLast.revision, 688);
  assert.deepEqual(value.lastIntent, { type: 'ACTION', action: 'WORK' });
  assert.equal(demonessNaturalHash(value.final), DEMONESS221_SOURCE_STATE_SHA);
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [196, 'apocalypse-demoness-v196']);
  assert.equal(Object.hasOwn(value.final, 'demoness'), false);
  assert.equal(value.final.revision, 689); assert.equal(value.final.status, 'ACTIVE');
  assert.equal(value.final.progression.pathwayId, 'demoness'); assert.equal(value.final.progression.sequence, 2);
  assert.deepEqual(value.final.random, { seed: 'assassin-natural-v045', cursor: 210 });
  return value.final;
}
export function readDemonessNaturalArchive(): { commands: SliceIntent[]; final: SliceState } {
  const bytes = gunzipSync(readFileSync(join(directory, 'original854-natural.json.gz')));
  assert.equal(demonessNaturalSha(bytes), DEMONESS221_HISTORY_SHA);
  const value = JSON.parse(bytes.toString('utf8')) as { commands: SliceIntent[]; final: SliceState };
  assert.equal(value.commands.length, 854); assert.equal(value.final.status, 'ACTIVE');
  assert.equal(value.final.progression.sequence, 1);
  assert.equal(demonessNaturalHash(value.commands.slice(0, 688)), DEMONESS221_PREFIX_SHA);
  assert.deepEqual(value.commands[688], { type: 'APOCALYPSE_DEMONESS', command: { type: 'REQUEST_SUPPLY' } });
  return value;
}
export function readDemonessNaturalRows(): DemonessNaturalRow[] {
  const text = readFileSync(join(directory, 'commands.jsonl'), 'utf8');
  assert(text.endsWith('\n'), 'Incomplete compact receipt tail');
  return text.trimEnd().split('\n').map(line => JSON.parse(line));
}
function readSnapshot(item: SnapshotIndex): DemonessNaturalSnapshot {
  assert.match(item.file, /^key-\d+-[a-z0-9-]+\.json\.gz$/);
  const value: DemonessNaturalSnapshot = JSON.parse(gunzipSync(readFileSync(join(directory, item.file))).toString('utf8'));
  assert.equal(demonessNaturalHash(value), item.contentSha256);
  assert.equal(value.format, 'NEW221_ACTUAL688_RECOVERY_COMPACT_OWNED_V1');
  assert.deepEqual([value.final.schemaVersion, value.final.contentVersion], [218, 'demoness-v218']);
  assert.equal(value.commandCount, item.commandCount); assert.equal(value.newCount, item.newCount);
  assert.deepEqual(value.reasons, item.reasons); assert.deepEqual(value.random, value.final.random);
  assert.deepEqual(value.anchor, demonessNaturalAnchor(value.final, value.public));
  assert.equal(value.anchor.privateStateSha256, item.stateSha256); assert.equal(value.anchor.publicStateSha256, item.publicSha256);
  return value;
}
export function readDemonessNaturalSnapshot(which: 'initial' | 'terminal'): DemonessNaturalSnapshot {
  const summary = readDemonessNaturalSummary(), count = which === 'initial' ? 688 : summary.commandCount;
  // Earlier safe stops also retained a terminal key. They remain immutable evidence.
  const items = summary.keySnapshots.filter(item => item.commandCount === count && item.reasons.includes(which));
  assert.equal(items.length, 1);
  const value = readSnapshot(items[0]!);
  assert.equal(value.commandCount, which === 'initial' ? 688 : summary.commandCount);
  assert.equal(value.newCount, which === 'initial' ? 0 : summary.newCount);
  if (which === 'terminal') {
    assert.equal(value.anchor.privateStateSha256, summary.finalPrivateStateSha256);
    assert.equal(value.anchor.publicStateSha256, summary.finalWholePublicSha256);
    assert.deepEqual(demonessNaturalOutcome(value.final), summary.actual);
  }
  return value;
}
/** Capture218 is already current: no arbitrary root removal or projection reconstruction. */
export function currentDemonessNaturalAnchor(state: SliceState, view: SliceProjection, original: DemonessNaturalSnapshot): Anchor {
  assert.deepEqual([state.schemaVersion, state.contentVersion], [CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  assert.deepEqual([state.schemaVersion, state.contentVersion], [original.final.schemaVersion, original.final.contentVersion]);
  assert.deepEqual(Object.keys(state).sort(), Object.keys(original.final).sort());
  assert.deepEqual(Object.keys(view).sort(), Object.keys(original.public).sort());
  return demonessNaturalAnchor(state, view);
}
interface RuntimeFreeze {
  sha256: string; source: { sha256: string }; history: { sha256: string };
  files: { file: string; sha256: string; bytes: number }[];
}
interface ProjectionAuditProof {
  format: string; commandCount: number; newCommands: number; historical688Replayed: boolean;
  originalFiles: { file: string; bytes: number; sha256: string }[]; originalCheckpointSha256: string;
  oldFreezeSha256: string; newFreezeSha256: string; changedFiles: { file: string; before: string; after: string }[];
  allowedPublicFields: string[]; allPrivateStatesAndRandomExact: boolean; originalCommandsAndReceiptsExact: boolean;
  oldTraceSha256: string; auditTraceSha256: string; nextPublicAction: SliceIntent;
  publicDifferences: { commandCount: number; oldPublicSha256: string; currentPublicSha256: string;
    oldNextStep: string; currentNextStep: string }[];
}
export interface DemonessNaturalProjectionAudit {
  proof: ProjectionAuditProof; rows: DemonessNaturalRow[]; initial: Anchor; finalPublic: SliceProjection;
  verifiedDifferences: Set<number>;
}
/** Retained bytes, not today's source/dist. Neither explicit handoff rewrites an action or private result. */
export function assertDemonessNaturalRetainedFreeze(summary: DemonessNaturalSummary, rows: DemonessNaturalRow[]): DemonessNaturalProjectionAudit {
  const { sha256, ...payload } = JSON.parse(readFileSync(join(directory, 'runtime-freeze.json'), 'utf8')) as {
    sha256: string; source: { sha256: string }; history: { sha256: string }; files: { file: string; sha256: string }[];
  };
  assert.equal(sha256, summary.runtimeFreezeSha256); assert.equal(demonessNaturalHash(payload), sha256);
  assert.equal(payload.source.sha256, DEMONESS221_SOURCE_SHA); assert.equal(payload.history.sha256, DEMONESS221_HISTORY_SHA);
  for (const [retained, original] of [['producer.mjs', 'scripts/play/demoness-stage.mjs'],
    ['producer-tests.mjs', 'scripts/play/demoness-stage.test.mjs']] as const) {
    const evidence = payload.files.find(item => item.file === original); assert(evidence);
    assert.equal(demonessNaturalSha(readFileSync(join(directory, retained))), evidence.sha256);
  }
  assert.match(DEMONESS221_PROJECTION_AUDIT_SHA, /^[a-f0-9]{64}$/, 'The actual883 projection proof has not been pinned yet');
  const auditBytes = readFileSync(join(directory, 'continuation883-proof.json'));
  assert.equal(demonessNaturalSha(auditBytes), DEMONESS221_PROJECTION_AUDIT_SHA);
  const audit: ProjectionAuditProof = JSON.parse(auditBytes.toString('utf8'));
  assert.equal(audit.format, 'NEW221_EXACT883_RECOMMENDATION_PROJECTION_AUDIT');
  assert.deepEqual([audit.commandCount, audit.newCommands, audit.historical688Replayed,
    audit.allPrivateStatesAndRandomExact, audit.originalCommandsAndReceiptsExact], [883, 195, false, true, true]);
  assert.deepEqual([...audit.allowedPublicFields].sort(),
    ['$.demoness.nextStep', '$.demoness.actions[*].preferredAction', '$.nextStep'].sort());
  assert.equal(audit.newFreezeSha256, sha256);
  for (const [retained, original] of [['checkpoint883-v2.json.gz', 'checkpoint.json.gz'],
    ['commands883-v2.jsonl', 'commands.jsonl'], ['runtime-freeze883-v2.json', 'runtime-freeze.json'],
    ['summary883-v2.json', 'summary.json']] as const) {
    const evidence = audit.originalFiles.find(item => item.file === original); assert(evidence);
    const bytes = readFileSync(join(directory, retained));
    assert.equal(bytes.length, evidence.bytes); assert.equal(demonessNaturalSha(bytes), evidence.sha256);
  }
  const { sha256: oldFreezeSha256, ...oldPayload } = JSON.parse(readFileSync(join(directory, 'runtime-freeze883-v2.json'), 'utf8')) as RuntimeFreeze;
  assert.equal(oldFreezeSha256, audit.oldFreezeSha256); assert.equal(demonessNaturalHash(oldPayload), oldFreezeSha256);
  assert.deepEqual({ ...payload, files: oldPayload.files }, oldPayload);
  assert.deepEqual(payload.files.map(item => item.file), oldPayload.files.map(item => item.file));
  const allowedFiles = ['src/domain/demoness/index.ts', 'dist/domain/demoness/index.js', 'dist/domain/demoness/index.js.map'];
  assert.equal(new Set(audit.changedFiles.map(item => item.file)).size, audit.changedFiles.length);
  assert(audit.changedFiles.some(item => item.file === allowedFiles[0]));
  assert(audit.changedFiles.some(item => item.file === allowedFiles[1]));
  for (const changed of audit.changedFiles) {
    assert(allowedFiles.includes(changed.file));
    assert.equal(oldPayload.files.find(item => item.file === changed.file)?.sha256, changed.before);
    assert.equal(payload.files.find(item => item.file === changed.file)?.sha256, changed.after);
    assert.notEqual(changed.before, changed.after);
  }
  for (const old of oldPayload.files) if (!audit.changedFiles.some(item => item.file === old.file))
    assert.deepEqual(payload.files.find(item => item.file === old.file), old);
  const oldTrace = readFileSync(join(directory, 'commands883-v2.jsonl'));
  assert.equal(demonessNaturalSha(oldTrace), audit.oldTraceSha256); assert(oldTrace.toString('utf8').endsWith('\n'));
  const oldRows: DemonessNaturalRow[] = oldTrace.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  assert.equal(oldRows.length, 883); assert(rows.length > 883);
  assert.equal(demonessNaturalSha(rows.slice(0, 883).map(row => JSON.stringify(row) + '\n').join('')), audit.auditTraceSha256);
  assert.deepEqual(audit.nextPublicAction, rows[883]!.intent);
  let oldPrevious: string | null = null;
  for (const [index, old] of oldRows.entries()) {
    const { rowSha256, ...oldBody } = old;
    assert.equal(demonessNaturalHash(oldBody), rowSha256); assert.equal(old.previousRowSha256, oldPrevious);
    assert.equal(old.commandCount, index + 1); assert.equal(demonessNaturalHash(old.intent), old.commandSha256);
    if (index < 688) assert.deepEqual(rows[index], old);
    else {
      const { rowSha256: _oldHash, previousRowSha256: _oldPrevious, before: oldBefore, after: oldAfter, ...oldAction } = old as DemonessNaturalActionRow;
      const { rowSha256: _newHash, previousRowSha256: _newPrevious, before: newBefore, after: newAfter, ...newAction } = rows[index] as DemonessNaturalActionRow;
      assert.deepEqual(newAction, oldAction, `Archived command/control/receipt/actual changed at ${index + 1}`);
      for (const [oldAnchor, newAnchor] of [[oldBefore, newBefore], [oldAfter, newAfter]]) {
        const { publicStateSha256: _oldPublic, ...oldPrivate } = oldAnchor!;
        const { publicStateSha256: _newPublic, ...newPrivate } = newAnchor!;
        assert.deepEqual(newPrivate, oldPrivate, `Archived private/RNG boundary changed at ${index + 1}`);
      }
    }
    oldPrevious = rowSha256;
  }
  const oldCheckpoint = JSON.parse(gunzipSync(readFileSync(join(directory, 'checkpoint883-v2.json.gz'))).toString('utf8')) as {
    sha256: string; payload: { commandCount: number; newCount: number; pending: unknown;
      freezeSha256: string; anchor: Anchor; state: SliceState; lastRow: DemonessNaturalActionRow; initial: Anchor };
  };
  assert.equal(oldCheckpoint.sha256, audit.originalCheckpointSha256);
  assert.equal(demonessNaturalHash(oldCheckpoint.payload), oldCheckpoint.sha256);
  const oldCp = oldCheckpoint.payload;
  assert.deepEqual([oldCp.commandCount, oldCp.newCount, oldCp.pending], [883, 195, null]);
  assert.equal(oldCp.freezeSha256, oldFreezeSha256); assert.equal(demonessNaturalHash(oldCp.state), oldCp.anchor.privateStateSha256);
  assert.deepEqual(oldCp.state.random, oldCp.anchor.random); assert.deepEqual(oldCp.lastRow, oldRows[882]);
  assert.deepEqual(oldCp.anchor, (oldRows[882] as DemonessNaturalActionRow).after);
  assert.deepEqual(oldCp.initial, (oldRows[688] as DemonessNaturalActionRow).before);
  let oldAnchor = oldCp.initial;
  for (const row of oldRows.slice(688) as DemonessNaturalActionRow[]) {
    assert.deepEqual(row.before, oldAnchor); assert.equal(row.after.revision, 689 + row.newCount);
    assert.equal(demonessNaturalHash(row.after.random), row.after.randomSha256);
    oldAnchor = row.after;
  }
  assert.deepEqual(oldAnchor, oldCp.anchor);
  const finalPublic: SliceProjection = JSON.parse(gunzipSync(readFileSync(join(directory, 'old-public883.json.gz'))).toString('utf8'));
  assert.equal(demonessNaturalHash(finalPublic), oldCp.anchor.publicStateSha256);
  assert.equal(new Set(audit.publicDifferences.map(item => item.commandCount)).size, audit.publicDifferences.length);
  for (const difference of audit.publicDifferences) assert(difference.commandCount >= 688 && difference.commandCount <= 883);
  const proofBytes = readFileSync(join(directory, 'continuation708-proof.json'));
  assert.equal(demonessNaturalSha(proofBytes), DEMONESS221_HANDOFF_SHA);
  const proof = JSON.parse(proofBytes.toString('utf8')) as {
    format: string; commandCount: number; actualNewCommandsVerified: number; historical688Replayed: boolean;
    fullFinalPrivateStateEqual: boolean; everyNewPrivatePublicRandomAnchorEqual: boolean;
    originalFiles: { file: string; sha256: string }[]; oldFreezeSha256: string; newFreezeSha256: string;
    originalCheckpointSha256: string; changedFiles: { file: string; sha256: string }[]; nextPublicAction: SliceIntent;
  };
  assert.equal(proof.format, 'NEW221_EXACT708_PRODUCER_ORDER_HANDOFF');
  assert.deepEqual([proof.commandCount, proof.actualNewCommandsVerified, proof.historical688Replayed,
    proof.fullFinalPrivateStateEqual, proof.everyNewPrivatePublicRandomAnchorEqual], [708, 20, false, true, true]);
  assert.equal(proof.newFreezeSha256, oldFreezeSha256);
  assert.deepEqual(proof.changedFiles.map(item => item.file).sort(),
    ['scripts/play/demoness-stage.mjs', 'scripts/play/demoness-stage.test.mjs'].sort());
  for (const changed of proof.changedFiles) assert.equal(oldPayload.files.find(item => item.file === changed.file)?.sha256, changed.sha256);
  for (const [retained, original] of [['producer-v1.mjs', 'producer.mjs'], ['checkpoint708-v1.json.gz', 'checkpoint.json.gz']] as const) {
    const evidence = proof.originalFiles.find(item => item.file === original); assert(evidence);
    assert.equal(demonessNaturalSha(readFileSync(join(directory, retained))), evidence.sha256);
  }
  const checkpoint = JSON.parse(gunzipSync(readFileSync(join(directory, 'checkpoint708-v1.json.gz'))).toString('utf8')) as {
    sha256: string; payload: { commandCount: number; newCount: number; pending: unknown; terminal: unknown;
      freezeSha256: string; anchor: Anchor; state: SliceState; lastRow: DemonessNaturalActionRow; initial: Anchor };
  };
  assert.equal(checkpoint.sha256, proof.originalCheckpointSha256); assert.equal(demonessNaturalHash(checkpoint.payload), checkpoint.sha256);
  const cp = checkpoint.payload;
  assert.deepEqual([cp.commandCount, cp.newCount, cp.pending, cp.terminal], [708, 20, null, null]);
  assert.equal(cp.freezeSha256, proof.oldFreezeSha256); assert.equal(demonessNaturalHash(cp.state), cp.anchor.privateStateSha256);
  assert.deepEqual(cp.state.random, cp.anchor.random); assert.deepEqual(cp.lastRow, oldRows[707]);
  assert.deepEqual(cp.anchor, (oldRows[707] as DemonessNaturalActionRow).after);
  assert.deepEqual(cp.initial, (oldRows[688] as DemonessNaturalActionRow).before);
  assert.deepEqual(proof.nextPublicAction, oldRows[708]!.intent);
  return { proof: audit, rows: oldRows, initial: oldCp.initial, finalPublic, verifiedDifferences: new Set() };
}
/** Reconstruct only the three explicitly audited recommendation paths. Every
 * other public leaf must reproduce the old full hash during the single replay. */
export function demonessNaturalArchivedPublic(view: SliceProjection, commandCount: number,
  audit: DemonessNaturalProjectionAudit): SliceProjection {
  assert(commandCount >= 688 && commandCount <= 883);
  const oldAnchor = commandCount === 688 ? audit.initial : (audit.rows[commandCount - 1] as DemonessNaturalActionRow).after;
  const currentHash = demonessNaturalHash(view), difference = audit.proof.publicDifferences.find(item => item.commandCount === commandCount);
  if (currentHash === oldAnchor.publicStateSha256) { assert.equal(difference, undefined); return view; }
  assert(difference, `Unreported public difference at ${commandCount}`);
  assert.equal(difference.oldPublicSha256, oldAnchor.publicStateSha256); assert.equal(difference.currentPublicSha256, currentHash);
  assert.equal(difference.currentNextStep, view.demoness.nextStep);
  assert.equal(view.nextStep, view.demoness.nextStep, 'The changed global next step must be the chapter mirror');
  const restored = structuredClone(view);
  if (commandCount === 883) {
    assert.deepEqual(restored.demoness.actions.map(action => action.id), audit.finalPublic.demoness.actions.map(action => action.id));
    assert.equal(audit.finalPublic.nextStep, audit.finalPublic.demoness.nextStep);
    restored.demoness.nextStep = audit.finalPublic.demoness.nextStep;
    restored.demoness.actions.forEach((action, index) => {
      const original = audit.finalPublic.demoness.actions[index]!;
      if (Object.hasOwn(original, 'preferredAction')) action.preferredAction = original.preferredAction!;
      else delete action.preferredAction;
    });
  } else {
    const next = audit.rows[commandCount] as DemonessNaturalActionRow, control = next.publicAction;
    assert.equal(next.intent.type, 'DEMONESS'); assert.equal(control.preferredAction, true);
    assert(!('kind' in control));
    restored.demoness.nextStep = control.label;
    restored.demoness.actions.forEach(action => {
      if (demonessNaturalHash(action.command) === demonessNaturalHash(control.command)) action.preferredAction = true;
      else delete action.preferredAction;
    });
  }
  restored.nextStep = restored.demoness.nextStep;
  assert.equal(restored.demoness.nextStep, difference.oldNextStep);
  assert.equal(demonessNaturalHash(restored), oldAnchor.publicStateSha256, `Public change beyond the exact recommendation fields at ${commandCount}`);
  audit.verifiedDifferences.add(commandCount);
  return restored;
}
export const demonessNaturalPublicBudget = (view: SliceProjection) => ({ week: view.week, health: view.health,
  mind: view.mind, spirituality: view.spirituality, cash: view.cash, actionsRemaining: view.actionsRemaining,
  pollution: view.pollution, wagePaid: view.wagePaid });
export function demonessNaturalReceipt(next: SliceState, before: SliceState) {
  const latest = next.demoness.journal.at(-1);
  if (latest?.revision === next.revision) return { id: latest.id, checks: latest.checks, finance: latest.financeReceipts,
    notes: latest.notes, beforeDigest: latest.beforeDigest, afterDigest: latest.afterDigest };
  const acquisition = next.apocalypseDemoness.acquisitionJournal.slice(before.apocalypseDemoness.acquisitionJournal.length)
    .map(e => ({ revision: e.revision, command: e.command, before: e.before, after: e.after,
      check: e.check, cursorBefore: e.cursorBefore, cursorAfter: e.cursorAfter }));
  const life = next.apocalypseDemoness.life.journal.slice(before.apocalypseDemoness.life.journal.length)
    .map(e => ({ revision: e.revision, command: e.command, before: e.before, after: e.after, check: e.check, outcome: e.outcome }));
  return { id: null, acquisition, life, notes: next.chronicle.slice(before.chronicle.length) };
}
export function demonessNaturalOutcome(state: SliceState) {
  const root = state.demoness, passage = root.passage;
  return { status: state.status, sequence: state.progression.sequence,
    s1Promoted: state.apocalypseDemoness.promotionWeek !== null, s1Reflected: state.apocalypseDemoness.life.reflected,
    promoted: state.progression.sequence === 0 && root.promotionWeek !== null, promotionWeek: root.promotionWeek,
    passagePhase: passage?.phase ?? null, reported: !!passage?.returnReportEventId,
    ordinaryExit: passage?.position === -2 && passage.residents.length === 2
      && passage.residents.every(person => person.position === -2 && !!person.returnPassage?.crossing && !!person.returnPassage?.exit),
    location: root.frame?.location ?? null, petrificationApplied: !!passage?.petrificationAppliedEventId,
    reshapingApplied: !!passage?.reshapingAppliedEventId, week: state.week,
    health: state.health, mind: state.mind, spirituality: state.spirituality };
}
