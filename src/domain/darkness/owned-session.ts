import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { DarknessProjection } from './types.js';
export { openDarknessRuntimeSession } from '../slice/index.js';
declare const darknessRuntimeDraftBrand: unique symbol;
export interface DarknessRuntimeDraft { readonly [darknessRuntimeDraftBrand]: true }
export interface DarknessRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface DarknessRuntimeSession {
  inspect(): DarknessRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectDarkness(): DarknessProjection;
  prepare(intent: SliceIntent, expectedRevision: number): DarknessRuntimeDraft;
  inspectDraft(draft: DarknessRuntimeDraft): DarknessRuntimeIdentity;
  snapshotDraft(draft: DarknessRuntimeDraft): SliceState;
  projectDraft(draft: DarknessRuntimeDraft): SliceProjection;
  projectDraftDarkness(draft: DarknessRuntimeDraft): DarknessProjection;
  commit(draft: DarknessRuntimeDraft): void;
  discard(draft: DarknessRuntimeDraft): void;
}
