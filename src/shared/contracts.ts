export const CONTRACT_VERSION = "r2-v2" as const;
export const RULE_VERSION = "browser-alpha-ba2" as const;
export const CONTENT_VERSION = "fixture-ba2" as const;
export const STORAGE_SCHEMA_VERSION = 2 as const;

export const BROWSER_ALPHA_CONTRACT_VERSION = "browser-alpha-ba2-v1" as const;

export const PUBLIC_EDUCATION_LEVELS = [
  "NONE_FORMAL",
  "BASIC",
  "SECONDARY_VOCATIONAL",
  "HIGHER",
] as const;
export type PublicEducationLevel = (typeof PUBLIC_EDUCATION_LEVELS)[number];

export const PUBLIC_CONDITION_ARCHETYPES = [
  { id: "education-qualification", label: "教育/资格补足" },
  { id: "recommendation-guarantee", label: "推荐/担保" },
  { id: "relevant-history-trial", label: "相关履历/试用" },
  { id: "funds-tools", label: "资金/工具准备" },
  { id: "family-class-compromise", label: "家庭/阶层妥协" },
  { id: "gray-introduction-risk", label: "灰色引荐/风险承诺" },
] as const;
export type PublicConditionArchetypeId = (typeof PUBLIC_CONDITION_ARCHETYPES)[number]["id"];

export type RunId = string;
export type IntentId = string;
export type Revision = number;
export type IsoTimestamp = string;
export type GameLifecycle = "NO_RUN" | "ACTIVE" | "ARCHIVED";
export type StorageStatus = "READY" | "UNAVAILABLE";

export const PUBLIC_ERROR_CODES = [
  "CONTRACT_VERSION_MISMATCH",
  "SCHEMA_INVALID",
  "CONTENT_SELECTION_INVALID",
  "ACTION_UNAVAILABLE",
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

export interface PublicGameDate {
  readonly epoch: "FIFTH_EPOCH";
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export type PublicCoreStatKey = keyof PublicCoreStats;
export type PublicResolutionTier = "GREAT_SUCCESS" | "SUCCESS" | "FAILURE" | "GREAT_FAILURE";
export interface PublicCheckModifier {
  readonly source: string;
  readonly value: number;
}
export interface PublicCheckPreview {
  readonly ability: PublicCoreStatKey;
  readonly baseAbility: number;
  readonly modifiers: readonly PublicCheckModifier[];
  readonly effectiveAbility: number;
  readonly difficulty: number;
  readonly chance: number;
}
export interface PublicCheckResult extends PublicCheckPreview {
  readonly roll: number;
  readonly tier: PublicResolutionTier;
}

export type PublicConsequenceTarget =
  | "CORE_STAT"
  | "RESOURCE"
  | "CASH"
  | "KNOWLEDGE"
  | "CLUE"
  | "EVENT"
  | "WORLD_STATE";
export type PublicConsequenceChange = "ADD" | "SET" | "CREATE" | "QUEUE" | "REMOVE";
export interface PublicConsequenceItem {
  readonly id: string;
  readonly target: PublicConsequenceTarget;
  readonly change: PublicConsequenceChange;
  readonly numericValue?: number;
  readonly referenceId?: string;
  readonly condition: "ALWAYS" | PublicResolutionTier;
  readonly applied: boolean;
  readonly source: string;
  readonly summary: string;
}

export type PublicKnowledgeVisibility = "CONFIRMED" | "RUMOR";
export interface PublicKnowledgeRecord {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly visibility: PublicKnowledgeVisibility;
  readonly acquiredOn: PublicGameDate;
  readonly sourceLabel: string;
}
export interface PublicClueRecord {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly visibility: PublicKnowledgeVisibility;
  readonly acquiredOn: PublicGameDate;
  readonly sourceLabel: string;
}

export type PublicWorldFeedbackKind = "ACTION" | "WORLD_PULSE" | "EVENT_RESULT";
export interface PublicWorldFeedbackEntry {
  readonly id: string;
  readonly kind: PublicWorldFeedbackKind;
  readonly visibility: PublicKnowledgeVisibility;
  readonly date: PublicGameDate;
  readonly title: string;
  readonly summary: string;
}

export type PublicEventKind =
  | "ACTION_RESULT"
  | "INVESTIGATION"
  | "CHAIN_STAGE"
  | "THRESHOLD"
  | "MARKET"
  | "WORLD_PULSE";
export type PublicEventResolutionMode = "NONE" | "CHECK" | "COMBAT" | "TRADE";
export interface PublicEventChoice {
  readonly id: string;
  readonly label: string;
  readonly resolutionMode: PublicEventResolutionMode;
  readonly hardCostPreview: string;
  readonly foreseeableConsequences: readonly string[];
  readonly checkPreview?: PublicCheckPreview;
  readonly unavailableReason?: string;
}
export interface PublicEventCard {
  readonly eventInstanceId: string;
  readonly definitionId: string;
  readonly kind: PublicEventKind;
  readonly title: string;
  readonly body: string;
  readonly date: PublicGameDate;
  readonly sourceLabel: string;
  readonly choices: readonly PublicEventChoice[];
}
export interface PublicPendingEvent {
  readonly eventInstanceId: string;
  readonly title: string;
  readonly sourceLabel: string;
  readonly createdOn: PublicGameDate;
  readonly expiresOn: PublicGameDate | null;
}
export interface PublicEventResolutionResult {
  readonly eventInstanceId: string;
  readonly choiceId: string;
  readonly title: string;
  readonly summary: string;
  readonly resolution: PublicCheckResult | null;
  readonly consequences: readonly PublicConsequenceItem[];
}

export const R2_FIXTURE_DEFAULTS = {
  week: 1,
  currentDate: { epoch: "FIFTH_EPOCH", year: 1349, month: 6, day: 28 },
  availableActions: 3,
  cashPence: 0,
  coreStats: { physique: 15, perception: 15, will: 15, knowledge: 15 },
  resources: {
    health: { current: 100, max: 100 },
    mind: { current: 100, max: 100 },
    spirituality: { current: 15, max: 15 },
    pollution: 0,
  },
} as const;

export type PublicSex = "FEMALE" | "MALE";
export type PublicSocialTier = "POOR" | "LABOR" | "LOWER_MIDDLE" | "UPPER_MIDDLE" | "UPPER";
export type PublicProfessionLegality = "LEGAL" | "GRAY" | "ILLEGAL";
export type PublicCompatibilityStatus = "DIRECT" | "CONDITIONAL" | "FORBIDDEN";
export type PublicActionKind = "WORK" | "LEARN" | "INVESTIGATE" | "REST";

export interface PublicChoiceOption {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
}
export interface PublicPortraitOption extends PublicChoiceOption {
  readonly appearanceTags: readonly string[];
}
export type PublicBalanceCandidateStatus = "BALANCE_REVIEW_CANDIDATE";
export interface PublicOriginOpeningCandidate {
  readonly coreStatModifiers: PublicCoreStats;
  readonly defaultEducation: PublicEducationLevel;
  readonly educationLabel: string;
  readonly openingKnowledgeBonus: number;
  readonly familyEconomyLabel: string;
  readonly status: PublicBalanceCandidateStatus;
}
export interface PublicProfessionOpeningCandidate {
  readonly coreStatModifiers: PublicCoreStats;
  readonly initialCashPence: number;
  readonly weeklyWorkPayPence: number;
  readonly status: PublicBalanceCandidateStatus;
}
export interface PublicOriginOption extends PublicChoiceOption {
  readonly tier: PublicSocialTier;
  readonly opening: PublicOriginOpeningCandidate;
}
export interface PublicProfessionOption extends PublicChoiceOption {
  readonly legality: PublicProfessionLegality;
  readonly opening: PublicProfessionOpeningCandidate;
}
export interface PublicTraitOption extends PublicChoiceOption {
  readonly incompatibleTraitIds: readonly string[];
}
export interface PublicSpecializationOption extends PublicChoiceOption {
  readonly eligibleOriginIds: readonly string[];
  readonly eligibleProfessionIds: readonly string[];
}
export interface PublicCompatibilityRule {
  readonly originId: string;
  readonly professionId: string;
  readonly status: PublicCompatibilityStatus;
  readonly publicReason: string;
  readonly conditionId?: string;
  readonly conditionCostSummary?: string;
}
export interface PublicCharacterCreationCatalogue {
  readonly contentVersion: typeof CONTENT_VERSION;
  readonly fixtureContent: true;
  readonly notice: string;
  readonly birthplaces: readonly PublicChoiceOption[];
  readonly portraits: readonly PublicPortraitOption[];
  readonly origins: readonly PublicOriginOption[];
  readonly professions: readonly PublicProfessionOption[];
  readonly traits: readonly PublicTraitOption[];
  readonly flaws: readonly PublicChoiceOption[];
  readonly specializations: readonly PublicSpecializationOption[];
  readonly compatibility: readonly PublicCompatibilityRule[];
}

export interface CharacterCreationSelection {
  readonly displayName: string;
  readonly sex: PublicSex;
  readonly age: number;
  readonly birthplaceId: string;
  readonly appearanceDescription: string;
  readonly portraitId?: string;
  readonly originId: string;
  readonly professionId: string;
  readonly traitIds: readonly string[];
  readonly flawId: string;
  readonly specializationId?: string;
  readonly acceptedConditionIds: readonly string[];
}
export interface PublicResolvedChoice {
  readonly id: string;
  readonly label: string;
}
export interface PublicCharacterProjection {
  readonly displayName: string;
  readonly sex: PublicSex;
  readonly age: number;
  readonly originCountry: "LOEN";
  readonly birthplace: PublicResolvedChoice;
  readonly appearanceDescription: string;
  readonly portrait?: PublicResolvedChoice & { readonly appearanceTags: readonly string[] };
  readonly origin: PublicResolvedChoice & { readonly tier: PublicSocialTier };
  readonly profession: PublicResolvedChoice & { readonly legality: PublicProfessionLegality };
  readonly traits: readonly PublicResolvedChoice[];
  readonly flaw: PublicResolvedChoice;
  readonly specialization?: PublicResolvedChoice;
  readonly sequence: "ORDINARY";
  readonly coreStats: PublicCoreStats;
  readonly resources: PublicResources;
}

export interface PublicChronicleEntry {
  readonly id: string;
  readonly week: number;
  readonly date: PublicGameDate;
  readonly title: string;
  readonly summary: string;
}
export interface PublicActionResult {
  readonly action: PublicActionKind;
  readonly title: string;
  readonly summary: string;
  readonly weekBefore: number;
  readonly weekAfter: number;
  readonly availableActionsBefore: number;
  readonly availableActionsAfter: number;
  readonly weekAdvanced: boolean;
  readonly dateBefore: PublicGameDate;
  readonly dateAfter: PublicGameDate;
  readonly resolution: PublicCheckResult | null;
  readonly consequences: readonly PublicConsequenceItem[];
  readonly feedbackEntryId: string;
}
export interface PublicGameState {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly ruleVersion: typeof RULE_VERSION;
  readonly contentVersion: typeof CONTENT_VERSION;
  readonly runId: RunId;
  readonly lifecycle: "ACTIVE";
  readonly revision: Revision;
  readonly week: number;
  readonly currentDate: PublicGameDate;
  readonly availableActions: number;
  readonly cashPence: number;
  readonly character: PublicCharacterProjection;
  readonly chronicle: readonly PublicChronicleEntry[];
  readonly knowledgeRecords: readonly PublicKnowledgeRecord[];
  readonly clues: readonly PublicClueRecord[];
  readonly worldFeedback: readonly PublicWorldFeedbackEntry[];
  readonly activeEvent: PublicEventCard | null;
  readonly pendingEvents: readonly PublicPendingEvent[];
  readonly lastEventResolution: PublicEventResolutionResult | null;
  readonly lastAction: PublicActionResult | null;
  readonly stateChecksum: string;
}
export interface PublicRunSummary {
  readonly runId: RunId;
  readonly lifecycle: Exclude<GameLifecycle, "NO_RUN">;
  readonly displayName: string;
  readonly week: number;
  readonly currentDate: PublicGameDate;
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
  readonly characterCreation: PublicCharacterCreationCatalogue;
}

export interface CreateCharacterRunIntent {
  readonly kind: "CREATE_CHARACTER_RUN";
  readonly selection: CharacterCreationSelection;
}
export interface PerformWeeklyActionIntent {
  readonly kind: "PERFORM_WEEKLY_ACTION";
  readonly action: PublicActionKind;
}
export interface ResolveEventChoiceIntent {
  readonly kind: "RESOLVE_EVENT_CHOICE";
  readonly eventInstanceId: string;
  readonly choiceId: string;
}
export type R2IntentPayload = CreateCharacterRunIntent | PerformWeeklyActionIntent | ResolveEventChoiceIntent;
export interface IntentEnvelope<TPayload extends R2IntentPayload = R2IntentPayload> {
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
