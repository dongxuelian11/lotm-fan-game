import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { VisionaryProjection } from './types.js';
export { openVisionaryRuntimeSession } from '../slice/index.js';
declare const visionaryRuntimeDraftBrand: unique symbol;
export interface VisionaryRuntimeDraft { readonly [visionaryRuntimeDraftBrand]: true }
export interface VisionaryRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface VisionaryRuntimeSession {
  inspect(): VisionaryRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectVisionary(): VisionaryProjection;
  prepare(intent: SliceIntent, expectedRevision: number): VisionaryRuntimeDraft;
  inspectDraft(draft: VisionaryRuntimeDraft): VisionaryRuntimeIdentity;
  snapshotDraft(draft: VisionaryRuntimeDraft): SliceState;
  projectDraft(draft: VisionaryRuntimeDraft): SliceProjection;
  projectDraftVisionary(draft: VisionaryRuntimeDraft): VisionaryProjection;
  commit(draft: VisionaryRuntimeDraft): void;
  discard(draft: VisionaryRuntimeDraft): void;
}
