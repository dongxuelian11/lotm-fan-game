import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { DemonessProjection } from './types.js';
export { openDemonessRuntimeSession } from '../slice/index.js';
declare const demonessRuntimeDraftBrand: unique symbol;
export interface DemonessRuntimeDraft { readonly [demonessRuntimeDraftBrand]: true }
export interface DemonessRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface DemonessRuntimeSession {
  inspect(): DemonessRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectDemoness(): DemonessProjection;
  prepare(intent: SliceIntent, expectedRevision: number): DemonessRuntimeDraft;
  inspectDraft(draft: DemonessRuntimeDraft): DemonessRuntimeIdentity;
  snapshotDraft(draft: DemonessRuntimeDraft): SliceState;
  projectDraft(draft: DemonessRuntimeDraft): SliceProjection;
  projectDraftDemoness(draft: DemonessRuntimeDraft): DemonessProjection;
  commit(draft: DemonessRuntimeDraft): void;
  discard(draft: DemonessRuntimeDraft): void;
}
