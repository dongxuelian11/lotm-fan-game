import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { AbyssProjection } from './types.js';
export { openAbyssRuntimeSession } from '../slice/index.js';
declare const abyssRuntimeDraftBrand: unique symbol;
export interface AbyssRuntimeDraft { readonly [abyssRuntimeDraftBrand]: true }
export interface AbyssRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface AbyssRuntimeSession {
 inspect(): AbyssRuntimeIdentity; snapshot(): SliceState; project(): SliceProjection; projectAbyss(): AbyssProjection;
 prepare(intent: SliceIntent, expectedRevision: number): AbyssRuntimeDraft;
 inspectDraft(draft: AbyssRuntimeDraft): AbyssRuntimeIdentity; snapshotDraft(draft: AbyssRuntimeDraft): SliceState;
 projectDraft(draft: AbyssRuntimeDraft): SliceProjection; projectDraftAbyss(draft: AbyssRuntimeDraft): AbyssProjection;
 commit(draft: AbyssRuntimeDraft): void; discard(draft: AbyssRuntimeDraft): void;
}
