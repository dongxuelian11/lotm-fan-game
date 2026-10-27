import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { JusticiarProjection } from './types.js';
export { openJusticiarRuntimeSession } from '../slice/index.js';
declare const justiciarRuntimeDraftBrand: unique symbol;
export interface JusticiarRuntimeDraft { readonly [justiciarRuntimeDraftBrand]: true }
export interface JusticiarRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface JusticiarRuntimeSession {
 inspect(): JusticiarRuntimeIdentity; snapshot(): SliceState; project(): SliceProjection; projectJusticiar(): JusticiarProjection;
 prepare(intent: SliceIntent, expectedRevision: number): JusticiarRuntimeDraft;
 inspectDraft(draft: JusticiarRuntimeDraft): JusticiarRuntimeIdentity; snapshotDraft(draft: JusticiarRuntimeDraft): SliceState;
 projectDraft(draft: JusticiarRuntimeDraft): SliceProjection; projectDraftJusticiar(draft: JusticiarRuntimeDraft): JusticiarProjection;
 commit(draft: JusticiarRuntimeDraft): void; discard(draft: JusticiarRuntimeDraft): void;
}
