import { expect } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { RedPriestProjection } from '../../src/domain/red-priest/types.js';
import { hash, json, observed, type FilePin, type Freeze, type Row } from './red-priest-capture-fixture.js';
import { RED_PRIEST_STORY_OBSERVED } from './red-priest-story-observed.js';

export interface StoryObservation {
  format: 'RED_PRIEST_CAPTURE_STORY_OBSERVED_V1'; proofSha256: string;
  runtimeFreezeSha256: string; currentPublicSha256: string;
  /** Additional files only. All original156 pins remain in their original module. */
  files: Record<string, FilePin>;
}
export interface StoryPatients { evacuated: number; sheltered: number; status: string; reported: boolean }
export interface StoryRow {
  commandCount: number; commandSha256: string; beforeStateSha256: string; stateSha256: string;
  randomBefore: SliceState['random']; random: SliceState['random'];
  capturedPublicBeforeSha256: string; capturedPublicSha256: string;
  publicBeforeSha256: string; publicSha256: string;
  originalStoryBefore: string; originalStoryAfter: string; currentStoryBefore: string; currentStoryAfter: string;
  storyChangedBefore: boolean; storyChangedAfter: boolean;
  actualPatientsBefore: StoryPatients | null; actualPatientsAfter: StoryPatients | null;
  privateAndRngEqual: boolean; allOtherPublicFieldsEqual: boolean; enabledOriginalAction: boolean;
}
export interface StoryProof {
  format: string; commandCount: number;
  source1051: { checkpointFile: string; checkpoint: FilePin; checkpointPayloadSha256: string;
    commandCount: number; stateSha256: string; publicSha256: string; random: SliceState['random'] };
  originalCapture: { directory: string; files7: Array<FilePin & { path: string }>; manifest: string; manifestEvidence: FilePin;
    freezeSha256: string; producer: FilePin & { path: string } };
  originalRuntimeFreeze: Freeze; currentRuntimeFreeze: Freeze;
  changedFiles: Array<{ file: string; before: FilePin; after: FilePin }>;
  allowedChanges: string[]; allowedPublicChanges: string[]; publicProjectionPath: string; publicFieldPaths: string[];
  exactSourceEditVerified: boolean; stateSha256: string; originalPublicSha256: string; continuedPublicSha256: string;
  random: SliceState['random']; originalStory: string; currentStory: string; strictFinalValidation: boolean;
  normalizerNegativeTests: { commandCount: number; observedStateSha256: string; observedPublicSha256: string;
    capturedPublicSha256: string; positiveControlPassed: boolean; noAdditionalReplay: boolean;
    rejectedMutations: number; checks: Array<{ name: string; rejected: boolean }> };
  replay: { commands: number; first: number; last: number; allPrivateAndRngEqual: boolean; allOtherPublicFieldsEqual: boolean;
    allowedPublicChanges: string[]; storyChangedChecks: number; rows: StoryRow[] };
  inputFiles: Array<FilePin & { path: string }>; inputStartSha256: string; inputEndSha256: string;
  currentRuntimeEndSha256: string; originalInputsUnchanged: boolean; productionUnchangedDuringReplay: boolean;
  scriptSha256: string; normalizerSha256: string;
}
export function storyObserved(): StoryObservation {
  if (!RED_PRIEST_STORY_OBSERVED) throw Error('PENDING: require the completed, reviewed133-row story proof; original observations cannot substitute for it.');
  return RED_PRIEST_STORY_OBSERVED;
}
export function storyProof(): StoryProof {
  const proof = json<StoryProof>('proofs/final-story-equivalence.json');
  expect(proof.format).toBe('RED_PRIEST1051_STORY_TRANSITION_V1');
  expect(proof.commandCount).toBe(observed().commands);
  expect(proof.continuedPublicSha256).toBe(storyObserved().currentPublicSha256);
  return proof;
}
export const ORIGINAL_EPILOGUE_STORY = '停战后的原运输侧线起火，三名原伤员尚待移出。六人分队来自原军团，仍受疲劳、伤势和现场抵抗限制。';
export const ORIGINAL_PRE_EPILOGUE_STORY = '北大陆四方的危机仍未成为全面战争。取得三方实际委托之后，你可以选择亲自发动，也可以拒绝、停战或保护撤离。旧日互助同伴始终保留原来的身份与经历。';
/** Independent exact one-field oracle. No production projection helper imports. */
export function expectedStory(state: SliceState): { original: string; current: string; patients: StoryPatients | null } {
  const ep = state.redPriest.epilogue;
  if (ep === null) return { original: ORIGINAL_PRE_EPILOGUE_STORY, current: ORIGINAL_PRE_EPILOGUE_STORY, patients: null };
  expect(ep.patients).toHaveLength(3); expect(new Set(ep.patients.map(p => p.id)).size).toBe(3);
  for (const patient of ep.patients) expect(['EVACUATED', 'SHELTERED']).toContain(patient.status);
  expect(['ACTIVE', 'RESOLVED', 'WITHDRAWN']).toContain(ep.status); expect(typeof ep.reported).toBe('boolean');
  if (ep.reported) expect(ep.status).not.toBe('ACTIVE');
  const evacuated = ep.patients.filter(p => p.status === 'EVACUATED').length, sheltered = 3 - evacuated;
  const account = ep.reported ? '救援人数和原分队损失已经交接。'
    : ep.status === 'ACTIVE' ? '原分队仍受疲劳、伤势和现场抵抗限制。'
      : '救援已经收束，实际人数和原分队损失尚待交接。';
  return { original: ORIGINAL_EPILOGUE_STORY,
    current: `停战后的原运输侧线起火；已转运原伤员${evacuated}名，${sheltered}名仍留在有遮蔽的原救护站。${account}`,
    patients: { evacuated, sheltered, status: ep.status, reported: ep.reported } };
}
/** The proof must bind its old values to the literal captured ledger, rather
 * than replacing it. Private state and RNG are still checked by every replay. */
export function bindStoryRow(check: StoryRow, captured: Row): void {
  expect(check).toMatchObject({ commandCount: captured.commandCount, commandSha256: captured.commandSha256,
    beforeStateSha256: captured.beforeStateSha256, stateSha256: captured.afterStateSha256,
    randomBefore: captured.randomBefore, random: captured.randomAfter,
    capturedPublicBeforeSha256: captured.publicBeforeSha256, capturedPublicSha256: captured.publicAfterSha256,
    privateAndRngEqual: true, allOtherPublicFieldsEqual: true, enabledOriginalAction: true });
}
/** Assert both complete current projection and complete old projection hashes.
 * Restore only the validated root story. Any other added/removed/changed field
 * fails one of these full-object hashes; no projection field is discarded. */
export function assertStoryBoundary(view: RedPriestProjection, state: SliceState, captured: Row, check: StoryRow, boundary: 'Before' | 'After'): void {
  bindStoryRow(check, captured);
  const oracle = expectedStory(state), before = boundary === 'Before';
  expect(Object.hasOwn(view, 'story')).toBe(true); expect(view.story).toBe(oracle.current);
  expect(state.random).toEqual(before ? captured.randomBefore : captured.randomAfter);
  expect(check[`originalStory${boundary}`]).toBe(oracle.original);
  expect(check[`currentStory${boundary}`]).toBe(oracle.current);
  expect(check[`actualPatients${boundary}`]).toEqual(oracle.patients);
  expect(check[`storyChanged${boundary}`]).toBe(oracle.patients !== null);
  expect(hash(view)).toBe(before ? check.publicBeforeSha256 : check.publicSha256);
  const prior = structuredClone(view);
  if (oracle.patients !== null) prior.story = oracle.original;
  expect(hash(prior), 'Every non-story field remains exactly captured').toBe(before ? captured.publicBeforeSha256 : captured.publicAfterSha256);
}
