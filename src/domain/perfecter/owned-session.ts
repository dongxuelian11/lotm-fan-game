import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { PerfecterProjection } from './types.js';
export { openPerfecterRuntimeSession } from '../slice/index.js';
declare const perfecterRuntimeDraftBrand: unique symbol;
export interface PerfecterRuntimeDraft { readonly [perfecterRuntimeDraftBrand]: true }
export interface PerfecterRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface PerfecterRuntimeSession {
  inspect(): PerfecterRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectPerfecter(): PerfecterProjection;
  prepare(intent: SliceIntent, expectedRevision: number): PerfecterRuntimeDraft;
  inspectDraft(draft: PerfecterRuntimeDraft): PerfecterRuntimeIdentity;
  snapshotDraft(draft: PerfecterRuntimeDraft): SliceState;
  projectDraft(draft: PerfecterRuntimeDraft): SliceProjection;
  projectDraftPerfecter(draft: PerfecterRuntimeDraft): PerfecterProjection;
  commit(draft: PerfecterRuntimeDraft): void;
  discard(draft: PerfecterRuntimeDraft): void;
}
