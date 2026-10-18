import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { DoorProjection } from './types.js';
export { openDoorRuntimeSession } from '../slice/index.js';
declare const doorRuntimeDraftBrand: unique symbol;
export interface DoorRuntimeDraft { readonly [doorRuntimeDraftBrand]: true }
export interface DoorRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface DoorRuntimeSession {
  inspect(): DoorRuntimeIdentity;
  snapshot(): SliceState;
  project(): SliceProjection;
  projectDoor(): DoorProjection;
  prepare(intent: SliceIntent, expectedRevision: number): DoorRuntimeDraft;
  inspectDraft(draft: DoorRuntimeDraft): DoorRuntimeIdentity;
  snapshotDraft(draft: DoorRuntimeDraft): SliceState;
  projectDraft(draft: DoorRuntimeDraft): SliceProjection;
  projectDraftDoor(draft: DoorRuntimeDraft): DoorProjection;
  commit(draft: DoorRuntimeDraft): void;
  discard(draft: DoorRuntimeDraft): void;
}
