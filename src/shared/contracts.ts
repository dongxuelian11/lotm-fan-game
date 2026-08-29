export const CONTRACT_VERSION = "r1-v1" as const;
export const RULE_VERSION = "fixture-r1" as const;
export const CONTENT_VERSION = "fixture-r1" as const;
export const STORAGE_SCHEMA_VERSION = 1 as const;

export type RunId = string;
export type IntentId = string;
export type Revision = number;
export type IsoTimestamp = string;

export type GameLifecycle = "NO_RUN" | "ACTIVE" | "ARCHIVED";
export type StorageStatus = "READY" | "UNAVAILABLE";

export const PUBLIC_ERROR_CODES = [
  "CONTRACT_VERSION_MISMATCH",
  "SCHEMA_INVALID",
  "REVISION_CONFLICT",
  "RUN_NOT_FOUND",
  "DUPLICATE_INTENT_CONFLICT",
  "PERSISTENCE_UNAVAILABLE",
  "SENDER_REJECTED",
  "INTERNAL_ERROR",
] as const;

export type PublicErrorCode = (typeof PUBLIC_ERROR_CODES)[number];

export interface PublicError {
  readonly code: PublicErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly currentRevision?: Revision;
}

export type BridgeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PublicError };

export interface PublicCoreStats {
  readonly physique: number;
  readonly perception: number;
  readonly will: number;
  readonly knowledge: number;
}

export interface PublicResourceMeter {
  readonly current: number;
  readonly max: number;
}

export interface PublicResources {
  readonly health: PublicResourceMeter;
  readonly mind: PublicResourceMeter;
  readonly spirituality: PublicResourceMeter;
  readonly pollution: number;
}

export const R1_FIXTURE_DEFAULTS = {
  week: 1,
  availableActions: 3,
  cashPence: 0,
  coreStats: {
    physique: 15,
    perception: 15,
    will: 15,
    knowledge: 15,
  },
  resources: {
    health: { current: 100, max: 100 },
    mind: { current: 100, max: 100 },
    spirituality: { current: 15, max: 15 },
    pollution: 0,
  },
} as const;

export interface PublicCharacterProjection {
  readonly displayName: string;
  readonly origin: "LOEN";
  readonly sequence: "ORDINARY";
  readonly coreStats: PublicCoreStats;
  readonly resources: PublicResources;
}

export interface PublicChronicleEntry {
  readonly id: string;
  readonly week: number;
  readonly title: string;
  readonly summary: string;
}

export interface PublicGameState {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly ruleVersion: typeof RULE_VERSION;
  readonly contentVersion: typeof CONTENT_VERSION;
  readonly runId: RunId;
  readonly lifecycle: "ACTIVE";
  readonly revision: Revision;
  readonly week: number;
  readonly availableActions: number;
  readonly cashPence: number;
  readonly character: PublicCharacterProjection;
  readonly chronicle: readonly PublicChronicleEntry[];
  readonly stateChecksum: string;
}

export interface PublicRunSummary {
  readonly runId: RunId;
  readonly lifecycle: Exclude<GameLifecycle, "NO_RUN">;
  readonly displayName: string;
  readonly week: number;
  readonly revision: Revision;
  readonly updatedAt: IsoTimestamp;
}

export interface BootstrapProjection {
  readonly appVersion: string;
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly storageSchemaVersion: typeof STORAGE_SCHEMA_VERSION;
  readonly storageStatus: StorageStatus;
  readonly lifecycle: GameLifecycle;
  readonly runs: readonly PublicRunSummary[];
  readonly activeState: PublicGameState | null;
}

export interface CreateR1FixtureRunIntent {
  readonly kind: "CREATE_R1_FIXTURE_RUN";
  readonly fixtureId: "ordinary-week-one";
  readonly displayName: string;
}

export type R1IntentPayload = CreateR1FixtureRunIntent;

export interface IntentEnvelope<TPayload extends R1IntentPayload = R1IntentPayload> {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly intentId: IntentId;
  readonly runId: RunId | null;
  readonly expectedRevision: Revision;
  readonly payload: TPayload;
}

export interface CommitReceipt {
  readonly intentId: IntentId;
  readonly runId: RunId;
  readonly previousRevision: Revision;
  readonly newRevision: Revision;
  readonly stateChecksum: string;
  readonly committedAt: IsoTimestamp;
  readonly replayed: boolean;
  readonly publicState: PublicGameState;
}

export interface MysteryGameBridge {
  getBootstrap(): Promise<BridgeResult<BootstrapProjection>>;
  submitIntent(intent: IntentEnvelope): Promise<BridgeResult<CommitReceipt>>;
}

declare global {
  interface Window {
    mysteryGame?: MysteryGameBridge;
  }
}
