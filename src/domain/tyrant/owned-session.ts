import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { TyrantProjection } from './types.js';
export { openTyrantRuntimeSession } from '../slice/index.js';
declare const tyrantRuntimeDraftBrand: unique symbol;
export interface TyrantRuntimeDraft { readonly [tyrantRuntimeDraftBrand]: true }
export interface TyrantRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface TyrantRuntimeSession {
  inspect(): TyrantRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectTyrant(): TyrantProjection;
  prepare(intent: SliceIntent, expectedRevision: number): TyrantRuntimeDraft;
  inspectDraft(draft: TyrantRuntimeDraft): TyrantRuntimeIdentity;
  snapshotDraft(draft: TyrantRuntimeDraft): SliceState;
  projectDraft(draft: TyrantRuntimeDraft): SliceProjection;
  projectDraftTyrant(draft: TyrantRuntimeDraft): TyrantProjection;
  commit(draft: TyrantRuntimeDraft): void;
  discard(draft: TyrantRuntimeDraft): void;
}
