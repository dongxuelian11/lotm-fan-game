import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { WhiteTowerProjection } from './types.js';
export { openWhiteTowerRuntimeSession } from '../slice/index.js';
declare const whiteTowerRuntimeDraftBrand: unique symbol;
export interface WhiteTowerRuntimeDraft { readonly [whiteTowerRuntimeDraftBrand]: true }
export interface WhiteTowerRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface WhiteTowerRuntimeSession {
  inspect(): WhiteTowerRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectWhiteTower(): WhiteTowerProjection;
  prepare(intent: SliceIntent, expectedRevision: number): WhiteTowerRuntimeDraft;
  inspectDraft(draft: WhiteTowerRuntimeDraft): WhiteTowerRuntimeIdentity;
  snapshotDraft(draft: WhiteTowerRuntimeDraft): SliceState;
  projectDraft(draft: WhiteTowerRuntimeDraft): SliceProjection;
  projectDraftWhiteTower(draft: WhiteTowerRuntimeDraft): WhiteTowerProjection;
  commit(draft: WhiteTowerRuntimeDraft): void;
  discard(draft: WhiteTowerRuntimeDraft): void;
}
