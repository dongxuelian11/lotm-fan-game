import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { ChainedProjection } from './types.js';
export { openChainedRuntimeSession } from '../slice/index.js';
declare const chainedRuntimeDraftBrand: unique symbol;
export interface ChainedRuntimeDraft { readonly [chainedRuntimeDraftBrand]: true }
export interface ChainedRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface ChainedRuntimeSession {
 inspect(): ChainedRuntimeIdentity; snapshot(): SliceState; project(): SliceProjection; projectChained(): ChainedProjection;
 prepare(intent: SliceIntent, expectedRevision: number): ChainedRuntimeDraft;
 inspectDraft(draft: ChainedRuntimeDraft): ChainedRuntimeIdentity; snapshotDraft(draft: ChainedRuntimeDraft): SliceState;
 projectDraft(draft: ChainedRuntimeDraft): SliceProjection; projectDraftChained(draft: ChainedRuntimeDraft): ChainedProjection;
 commit(draft: ChainedRuntimeDraft): void; discard(draft: ChainedRuntimeDraft): void;
}
