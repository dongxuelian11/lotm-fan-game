import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { BlackEmperorProjection } from './types.js';
export { openBlackEmperorRuntimeSession } from '../slice/index.js';
declare const blackEmperorRuntimeDraftBrand: unique symbol;
export interface BlackEmperorRuntimeDraft { readonly [blackEmperorRuntimeDraftBrand]: true }
export interface BlackEmperorRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface BlackEmperorRuntimeSession {
 inspect(): BlackEmperorRuntimeIdentity; snapshot(): SliceState; project(): SliceProjection; projectBlackEmperor(): BlackEmperorProjection;
 prepare(intent: SliceIntent, expectedRevision: number): BlackEmperorRuntimeDraft;
 inspectDraft(draft: BlackEmperorRuntimeDraft): BlackEmperorRuntimeIdentity; snapshotDraft(draft: BlackEmperorRuntimeDraft): SliceState;
 projectDraft(draft: BlackEmperorRuntimeDraft): SliceProjection; projectDraftBlackEmperor(draft: BlackEmperorRuntimeDraft): BlackEmperorProjection;
 commit(draft: BlackEmperorRuntimeDraft): void; discard(draft: BlackEmperorRuntimeDraft): void;
}
