import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { SunProjection } from './types.js';
export { openSunRuntimeSession } from '../slice/index.js';
declare const sunRuntimeDraftBrand: unique symbol;
export interface SunRuntimeDraft { readonly [sunRuntimeDraftBrand]: true }
export interface SunRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface SunRuntimeSession {
  inspect(): SunRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectSun(): SunProjection;
  prepare(intent: SliceIntent, expectedRevision: number): SunRuntimeDraft;
  inspectDraft(draft: SunRuntimeDraft): SunRuntimeIdentity;
  snapshotDraft(draft: SunRuntimeDraft): SliceState;
  projectDraft(draft: SunRuntimeDraft): SliceProjection;
  projectDraftSun(draft: SunRuntimeDraft): SunProjection;
  commit(draft: SunRuntimeDraft): void;
  discard(draft: SunRuntimeDraft): void;
}
