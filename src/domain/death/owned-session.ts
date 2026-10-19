import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { DeathProjection } from './types.js';
export { openDeathRuntimeSession } from '../slice/index.js';
declare const deathRuntimeDraftBrand: unique symbol;
export interface DeathRuntimeDraft { readonly [deathRuntimeDraftBrand]: true }
export interface DeathRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface DeathRuntimeSession {
  inspect(): DeathRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectDeath(): DeathProjection;
  prepare(intent: SliceIntent, expectedRevision: number): DeathRuntimeDraft;
  inspectDraft(draft: DeathRuntimeDraft): DeathRuntimeIdentity;
  snapshotDraft(draft: DeathRuntimeDraft): SliceState;
  projectDraft(draft: DeathRuntimeDraft): SliceProjection;
  projectDraftDeath(draft: DeathRuntimeDraft): DeathProjection;
  commit(draft: DeathRuntimeDraft): void;
  discard(draft: DeathRuntimeDraft): void;
}
