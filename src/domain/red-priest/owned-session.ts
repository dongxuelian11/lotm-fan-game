import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { RedPriestProjection } from './types.js';
export { openRedPriestRuntimeSession } from '../slice/index.js';
declare const redPriestRuntimeDraftBrand: unique symbol;
export interface RedPriestRuntimeDraft { readonly [redPriestRuntimeDraftBrand]: true }
export interface RedPriestRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface RedPriestRuntimeSession {
  inspect(): RedPriestRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectRedPriest(): RedPriestProjection;
  prepare(intent: SliceIntent, expectedRevision: number): RedPriestRuntimeDraft;
  inspectDraft(draft: RedPriestRuntimeDraft): RedPriestRuntimeIdentity;
  snapshotDraft(draft: RedPriestRuntimeDraft): SliceState;
  projectDraft(draft: RedPriestRuntimeDraft): SliceProjection;
  projectDraftRedPriest(draft: RedPriestRuntimeDraft): RedPriestProjection;
  commit(draft: RedPriestRuntimeDraft): void;
  discard(draft: RedPriestRuntimeDraft): void;
}
