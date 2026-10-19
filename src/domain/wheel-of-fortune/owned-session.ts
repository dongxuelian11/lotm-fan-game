import type { SliceIntent, SliceProjection, SliceState } from '../slice/types.js';
import type { WheelOfFortuneProjection } from './types.js';
export { openWheelOfFortuneRuntimeSession } from '../slice/index.js';
declare const wheelOfFortuneRuntimeDraftBrand: unique symbol;
export interface WheelOfFortuneRuntimeDraft { readonly [wheelOfFortuneRuntimeDraftBrand]: true }
export interface WheelOfFortuneRuntimeIdentity { runId: string; revision: number; status: SliceState['status'] }
export interface WheelOfFortuneRuntimeSession {
 inspect(): WheelOfFortuneRuntimeIdentity; snapshot(): SliceState; project(): SliceProjection; projectWheelOfFortune(): WheelOfFortuneProjection;
 prepare(intent: SliceIntent, expectedRevision: number): WheelOfFortuneRuntimeDraft;
 inspectDraft(draft: WheelOfFortuneRuntimeDraft): WheelOfFortuneRuntimeIdentity; snapshotDraft(draft: WheelOfFortuneRuntimeDraft): SliceState;
 projectDraft(draft: WheelOfFortuneRuntimeDraft): SliceProjection; projectDraftWheelOfFortune(draft: WheelOfFortuneRuntimeDraft): WheelOfFortuneProjection;
 commit(draft: WheelOfFortuneRuntimeDraft): void; discard(draft: WheelOfFortuneRuntimeDraft): void;
}
