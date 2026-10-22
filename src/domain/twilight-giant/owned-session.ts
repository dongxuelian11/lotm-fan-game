import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { TwilightGiantProjection } from './types.js';
export { openTwilightGiantRuntimeSession } from '../slice/index.js';
declare const twilightGiantRuntimeDraftBrand: unique symbol;
export interface TwilightGiantRuntimeDraft { readonly [twilightGiantRuntimeDraftBrand]: true }
export interface TwilightGiantRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface TwilightGiantRuntimeSession {
  inspect(): TwilightGiantRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectTwilightGiant(): TwilightGiantProjection;
  prepare(intent: SliceIntent, expectedRevision: number): TwilightGiantRuntimeDraft;
  inspectDraft(draft: TwilightGiantRuntimeDraft): TwilightGiantRuntimeIdentity;
  snapshotDraft(draft: TwilightGiantRuntimeDraft): SliceState;
  projectDraft(draft: TwilightGiantRuntimeDraft): SliceProjection;
  projectDraftTwilightGiant(draft: TwilightGiantRuntimeDraft): TwilightGiantProjection;
  commit(draft: TwilightGiantRuntimeDraft): void;
  discard(draft: TwilightGiantRuntimeDraft): void;
}
