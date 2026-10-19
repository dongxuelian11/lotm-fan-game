import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { MoonProjection } from './types.js';
export { openMoonRuntimeSession } from '../slice/index.js';
declare const moonRuntimeDraftBrand: unique symbol;
export interface MoonRuntimeDraft { readonly [moonRuntimeDraftBrand]: true }
export interface MoonRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface MoonRuntimeSession {
  inspect(): MoonRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectMoon(): MoonProjection;
  prepare(intent: SliceIntent, expectedRevision: number): MoonRuntimeDraft;
  inspectDraft(draft: MoonRuntimeDraft): MoonRuntimeIdentity;
  snapshotDraft(draft: MoonRuntimeDraft): SliceState;
  projectDraft(draft: MoonRuntimeDraft): SliceProjection;
  projectDraftMoon(draft: MoonRuntimeDraft): MoonProjection;
  commit(draft: MoonRuntimeDraft): void;
  discard(draft: MoonRuntimeDraft): void;
}
