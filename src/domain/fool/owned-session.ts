import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { FoolProjection } from './types.js';

// Implementation stays beside the existing private slice reducer/projection
// assembly. This facade cannot accept callbacks, prepared roots or trust flags.
export { openFoolRuntimeSession } from '../slice/index.js';

declare const foolRuntimeDraftBrand: unique symbol;
export interface FoolRuntimeDraft { readonly [foolRuntimeDraftBrand]: true }
export interface FoolRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface FoolRuntimeSession {
  inspect(): FoolRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectFool(): FoolProjection;
  prepare(intent: SliceIntent, expectedRevision: number): FoolRuntimeDraft;
  inspectDraft(draft: FoolRuntimeDraft): FoolRuntimeIdentity;
  snapshotDraft(draft: FoolRuntimeDraft): SliceState;
  projectDraft(draft: FoolRuntimeDraft): SliceProjection;
  projectDraftFool(draft: FoolRuntimeDraft): FoolProjection;
  commit(draft: FoolRuntimeDraft): void;
  discard(draft: FoolRuntimeDraft): void;
}
