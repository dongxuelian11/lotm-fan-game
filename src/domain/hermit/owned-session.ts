import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { HermitProjection } from './types.js';
export { openHermitRuntimeSession } from '../slice/index.js';
declare const hermitRuntimeDraftBrand: unique symbol;
export interface HermitRuntimeDraft { readonly [hermitRuntimeDraftBrand]: true }
export interface HermitRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface HermitRuntimeSession {
 inspect(): HermitRuntimeIdentity; snapshot(): SliceState; project(): SliceProjection; projectHermit(): HermitProjection;
 prepare(intent: SliceIntent, expectedRevision: number): HermitRuntimeDraft;
 inspectDraft(draft: HermitRuntimeDraft): HermitRuntimeIdentity; snapshotDraft(draft: HermitRuntimeDraft): SliceState;
 projectDraft(draft: HermitRuntimeDraft): SliceProjection; projectDraftHermit(draft: HermitRuntimeDraft): HermitProjection;
 commit(draft: HermitRuntimeDraft): void; discard(draft: HermitRuntimeDraft): void;
}
