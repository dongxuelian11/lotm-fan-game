import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { MotherProjection } from './types.js';
export { openMotherRuntimeSession } from '../slice/index.js';
declare const motherRuntimeDraftBrand: unique symbol;
export interface MotherRuntimeDraft { readonly [motherRuntimeDraftBrand]: true }
export interface MotherRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface MotherRuntimeSession {
 inspect(): MotherRuntimeIdentity; snapshot(): SliceState; project(): SliceProjection; projectMother(): MotherProjection;
 prepare(intent: SliceIntent, expectedRevision: number): MotherRuntimeDraft;
 inspectDraft(draft: MotherRuntimeDraft): MotherRuntimeIdentity; snapshotDraft(draft: MotherRuntimeDraft): SliceState;
 projectDraft(draft: MotherRuntimeDraft): SliceProjection; projectDraftMother(draft: MotherRuntimeDraft): MotherProjection;
 commit(draft: MotherRuntimeDraft): void; discard(draft: MotherRuntimeDraft): void;
}
