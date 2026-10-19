export type { BlackEmperorCommand, BlackEmperorProjection } from '../domain/black-emperor/types.js';
export type { WheelOfFortuneCommand, WheelOfFortuneProjection } from '../domain/wheel-of-fortune/types.js';
export type { ChainedCommand, ChainedProjection } from '../domain/chained/types.js';
export type { AbyssCommand, AbyssProjection } from '../domain/abyss/types.js';
export type { HangedManCommand, HangedManProjection } from '../domain/hanged-man/types.js';
export type { HermitCommand, HermitProjection } from '../domain/hermit/types.js';
export type { DemonessCommand, DemonessProjection } from '../domain/demoness/types.js';
export type { TwilightGiantCommand, TwilightGiantProjection } from '../domain/twilight-giant/types.js';
export type { ErrorAscentCommand, ErrorAscentProjection } from '../domain/error-ascent/types.js';
export type { DoorCommand, DoorProjection } from '../domain/door/types.js';
export type { DeathCommand, DeathProjection } from '../domain/death/types.js';
import type { SliceCreationSelection } from "../content/slice-creation.js";
import type { SliceIntent, SliceProjection } from "../domain/slice/types.js";

export const SLICE_BRIDGE_VERSION = "slice-1" as const;
export type SliceCommand =
  | SliceIntent
  | { type: "CREATE"; selection: SliceCreationSelection };
export interface SliceEnvelope {
  intentId: string;
  runId: string | null;
  expectedRevision: number;
  payload: SliceCommand;
}
export interface SliceError {
  code: string;
  message: string;
  retryable: boolean;
}
export type SliceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SliceError };
export interface SliceRunSummary {
  runId: string;
  name: string;
  portraitId: string;
  week: number;
  date: SliceProjection["date"];
  status: SliceProjection["status"];
  revision: number;
  updatedAt: string;
}
export interface SliceBootstrap {
  mode: "browser" | "desktop";
  runs: SliceRunSummary[];
  activeState: SliceProjection | null;
  recoveryNotice?: string;
}
export interface SliceReceipt {
  intentId: string;
  runId: string;
  previousRevision: number;
  newRevision: number;
  committedAt: string;
  replayed: boolean;
  state: SliceProjection;
}
export interface SliceBridge {
  getBootstrap(): Promise<SliceResult<SliceBootstrap>>;
  loadRun(runId: string): Promise<SliceResult<SliceProjection>>;
  submitIntent(envelope: SliceEnvelope): Promise<SliceResult<SliceReceipt>>;
}
declare global {
  interface Window {
    sliceGame?: SliceBridge;
  }
}
