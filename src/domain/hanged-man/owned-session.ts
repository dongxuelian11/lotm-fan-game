import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { HangedManProjection } from './types.js';
export { openHangedManRuntimeSession } from '../slice/index.js';
declare const hangedManRuntimeDraftBrand: unique symbol;
export interface HangedManRuntimeDraft { readonly [hangedManRuntimeDraftBrand]: true }
export interface HangedManRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface HangedManRuntimeSession {
 inspect(): HangedManRuntimeIdentity; snapshot(): SliceState; project(): SliceProjection; projectHangedMan(): HangedManProjection;
 prepare(intent: SliceIntent, expectedRevision: number): HangedManRuntimeDraft;
 inspectDraft(draft: HangedManRuntimeDraft): HangedManRuntimeIdentity; snapshotDraft(draft: HangedManRuntimeDraft): SliceState;
 projectDraft(draft: HangedManRuntimeDraft): SliceProjection; projectDraftHangedMan(draft: HangedManRuntimeDraft): HangedManProjection;
 commit(draft: HangedManRuntimeDraft): void; discard(draft: HangedManRuntimeDraft): void;
}
