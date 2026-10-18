import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { ErrorAscentProjection } from './types.js';
export { openErrorAscentRuntimeSession } from '../slice/index.js';
declare const errorAscentRuntimeDraftBrand: unique symbol;
export interface ErrorAscentRuntimeDraft { readonly [errorAscentRuntimeDraftBrand]: true }
export interface ErrorAscentRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface ErrorAscentRuntimeSession {
  inspect(): ErrorAscentRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectErrorAscent(): ErrorAscentProjection;
  prepare(intent: SliceIntent, expectedRevision: number): ErrorAscentRuntimeDraft;
  inspectDraft(draft: ErrorAscentRuntimeDraft): ErrorAscentRuntimeIdentity;
  snapshotDraft(draft: ErrorAscentRuntimeDraft): SliceState;
  projectDraft(draft: ErrorAscentRuntimeDraft): SliceProjection;
  projectDraftErrorAscent(draft: ErrorAscentRuntimeDraft): ErrorAscentProjection;
  commit(draft: ErrorAscentRuntimeDraft): void;
  discard(draft: ErrorAscentRuntimeDraft): void;
}
