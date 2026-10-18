import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
  type CharacterCreationSelection,
  type IntentEnvelope,
  type MysteryGameBridge,
  type PerformWeeklyActionIntent,
  type PublicActionKind,
  type PublicActionResult,
  type PublicCheckPreview,
  type PublicCharacterCreationCatalogue,
  type PublicCharacterProjection,
  type PublicClueRecord,
  type PublicCompatibilityRule,
  type PublicConsequenceItem,
  type PublicError,
  type PublicEventCard,
  type PublicEventChoice,
  type PublicGameDate,
  type PublicGameState,
  type PublicKnowledgeRecord,
  type PublicOriginOption,
  type PublicPendingEvent,
  type PublicProfessionOption,
  type PublicResolutionTier,
  type PublicSex,
  type PublicSocialTier,
  type PublicTraitOption,
  type PublicWorldFeedbackEntry,
  type ResolveEventChoiceIntent,
} from "@shared/contracts";
import "./styles.css";

const CREATION_STEPS = ["身份", "出身", "职业", "性格", "摘要", "确认"] as const;
type CreationStepIndex = 0 | 1 | 2 | 3 | 4 | 5;

type CreationDraft = {
  displayName: string;
  sex: PublicSex | "";
  age: string;
  birthplaceId: string;
  appearanceDescription: string;
  originId: string;
  professionId: string;
  traitIds: readonly string[];
  flawId: string;
  acceptedConditionIds: readonly string[];
};

const EMPTY_DRAFT: CreationDraft = {
  displayName: "",
  sex: "",
  age: "",
  birthplaceId: "",
  appearanceDescription: "",
  originId: "",
  professionId: "",
  traitIds: [],
  flawId: "",
  acceptedConditionIds: [],
};

type DraftPatch = Partial<CreationDraft>;
type ActionState =
  | { readonly kind: "idle" }
  | { readonly kind: "submitting"; readonly action: PublicActionKind }
  | { readonly kind: "error"; readonly error: PublicError };
type EventState =
  | { readonly kind: "idle" }
  | { readonly kind: "submitting"; readonly choiceId: string }
  | { readonly kind: "error"; readonly error: PublicError };

type AppViewState =
  | { readonly kind: "loading" }
  | { readonly kind: "storage-unavailable"; readonly error?: PublicError }
  | { readonly kind: "no-run"; readonly catalogue: PublicCharacterCreationCatalogue }
  | { readonly kind: "creating"; readonly catalogue: PublicCharacterCreationCatalogue }
  | {
      readonly kind: "create-failed";
      readonly catalogue: PublicCharacterCreationCatalogue;
      readonly error: PublicError;
    }
  | {
      readonly kind: "active";
      readonly game: PublicGameState;
      readonly catalogue: PublicCharacterCreationCatalogue;
    };

type PendingCreate = {
  readonly selectionKey: string;
  readonly envelope: IntentEnvelope;
};
type PendingAction = {
  readonly key: string;
  readonly envelope: IntentEnvelope<PerformWeeklyActionIntent>;
};
type PendingEventIntent = {
  readonly key: string;
  readonly envelope: IntentEnvelope<ResolveEventChoiceIntent>;
};

const DAILY_ACTIONS: readonly {
  readonly kind: PublicActionKind;
  readonly label: string;
  readonly detail: string;
}[] = [
  { kind: "WORK", label: "工作", detail: "完成工作安排" },
  { kind: "LEARN", label: "学习", detail: "整理新的认识" },
  { kind: "INVESTIGATE", label: "调查", detail: "追查眼前线索" },
  { kind: "REST", label: "休养", detail: "照料身心状态" },
];

const CORE_STATS: readonly {
  readonly key: keyof PublicCharacterProjection["coreStats"];
  readonly label: string;
}[] = [
  { key: "physique", label: "体质" },
  { key: "perception", label: "感知" },
  { key: "will", label: "意志" },
  { key: "knowledge", label: "知识" },
];

const RESOURCE_ROWS: readonly {
  readonly key: "health" | "mind" | "spirituality";
  readonly label: string;
}[] = [
  { key: "health", label: "健康" },
  { key: "mind", label: "精神" },
  { key: "spirituality", label: "灵性" },
];

const TIER_LABELS: Record<PublicSocialTier, string> = {
  POOR: "贫民",
  LABOR: "劳工",
  LOWER_MIDDLE: "小市民",
  UPPER_MIDDLE: "中上",
  UPPER: "上流",
};

const STAT_LABELS: Record<keyof PublicCharacterProjection["coreStats"], string> = {
  physique: "体质",
  perception: "感知",
  will: "意志",
  knowledge: "知识",
};

const TIER_RESULT_LABELS: Record<PublicResolutionTier, string> = {
  GREAT_SUCCESS: "大成功",
  SUCCESS: "成功",
  FAILURE: "失败",
  GREAT_FAILURE: "大失败",
};

function getProductionBridge(): MysteryGameBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return window.mysteryGame;
}

let browserIntentCounter = 0;

function createIntentId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === "function") return randomUuid.call(globalThis.crypto);
  browserIntentCounter += 1;
  return `browser-alpha-intent-${browserIntentCounter}`;
}

function selectedOption<T extends { readonly id: string }>(options: readonly T[], id: string): T | undefined {
  return options.find((option) => option.id === id);
}

function formatSex(sex: PublicSex): string {
  return sex === "FEMALE" ? "女性" : "男性";
}

function formatSequence(sequence: PublicCharacterProjection["sequence"]): string {
  return sequence === "ORDINARY" ? "普通人" : sequence;
}

function formatLegality(legality: PublicProfessionOption["legality"]): string {
  switch (legality) {
    case "LEGAL":
      return "正当谋生";
    case "GRAY":
      return "灰色门路";
    case "ILLEGAL":
      return "危险门路";
  }
}

function formatCompatibilityStatus(status: PublicCompatibilityRule["status"]): string {
  switch (status) {
    case "DIRECT":
      return "可从事";
    case "CONDITIONAL":
      return "需条件";
    case "FORBIDDEN":
      return "不可从事";
  }
}

function formatAction(action: PublicActionKind): string {
  return DAILY_ACTIONS.find((entry) => entry.kind === action)?.label ?? "行动";
}

function formatCashPence(totalPence: number): string {
  const truncatedPence = Number.isFinite(totalPence) ? Math.trunc(totalPence) : 0;
  const sign = truncatedPence < 0 ? "-" : "";
  const absolutePence = Math.abs(truncatedPence);
  const pounds = Math.floor(absolutePence / 240);
  const remainder = absolutePence % 240;
  const shillings = Math.floor(remainder / 12);
  const pence = remainder % 12;
  return `${sign}${pounds} 镑 ${shillings} 苏勒 ${pence} 便士`;
}

function formatCashChangePence(changePence: number): string {
  const sign = changePence > 0 ? "+" : changePence < 0 ? "-" : "";
  return `${sign}${formatCashPence(Math.abs(changePence))}`;
}

function formatPublicDate(gameDate: PublicGameDate): string {
  const epoch = gameDate.epoch === "FIFTH_EPOCH" ? "第五纪" : "时代";
  return `${epoch}${gameDate.year}年${gameDate.month}月${gameDate.day}日`;
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function validateDisplayName(displayName: string): string[] {
  const errors: string[] = [];
  const normalizedName = displayName.trim();
  if (normalizedName.length === 0) errors.push("请写下一个名字。");
  if (normalizedName.length > 80) errors.push("名字不能超过 80 个字符。");
  if (displayName.includes("\u0000")) errors.push("名字中不能有不可见字符。");
  return errors;
}

function ruleFor(
  catalogue: PublicCharacterCreationCatalogue,
  originId: string,
  professionId: string,
): PublicCompatibilityRule | undefined {
  return catalogue.compatibility.find((rule) => rule.originId === originId && rule.professionId === professionId);
}

function validateCreationStep(
  step: CreationStepIndex,
  draft: CreationDraft,
  catalogue: PublicCharacterCreationCatalogue,
): string[] {
  const errors: string[] = [];
  if (step === 0) {
    errors.push(...validateDisplayName(draft.displayName));
    if (draft.sex === "") errors.push("请选择性别。");
    const age = Number(draft.age);
    if (!Number.isInteger(age) || age < 18 || age > 45) errors.push("年龄需在 18 到 45 岁之间。");
    if (selectedOption(catalogue.birthplaces, draft.birthplaceId) === undefined) errors.push("请选择出生地。");
    if (draft.appearanceDescription.trim().length === 0) errors.push("请写下简短的外貌。");
  }
  if (step === 1 && selectedOption(catalogue.origins, draft.originId) === undefined) errors.push("请选择出身。");
  if (step === 2) {
    const profession = selectedOption(catalogue.professions, draft.professionId);
    const rule = ruleFor(catalogue, draft.originId, draft.professionId);
    if (profession === undefined || rule === undefined) {
      errors.push("请选择一条可以走通的道路。");
    } else if (rule.status === "FORBIDDEN") {
      errors.push("这条道路暂时走不通。");
    } else if (rule.status === "CONDITIONAL") {
      if (rule.conditionId === undefined) errors.push("条件内容尚未接入。");
      else if (!draft.acceptedConditionIds.includes(rule.conditionId)) errors.push("请先接受这条道路的条件。");
    }
  }
  if (step === 3) {
    if (draft.traitIds.length !== 2) errors.push("请选择恰好两项性格特质。");
    if (draft.flawId === "") errors.push("请选择一处真实缺陷。");
  }
  if (step === 4 || step === 5) {
    for (const previousStep of [0, 1, 2, 3] as const) errors.push(...validateCreationStep(previousStep, draft, catalogue));
  }
  return [...new Set(errors)];
}

function selectionFromDraft(draft: CreationDraft): CharacterCreationSelection {
  return {
    displayName: draft.displayName.trim(),
    sex: draft.sex as PublicSex,
    age: Number(draft.age),
    birthplaceId: draft.birthplaceId,
    appearanceDescription: draft.appearanceDescription.trim(),
    originId: draft.originId,
    professionId: draft.professionId,
    traitIds: [...draft.traitIds],
    flawId: draft.flawId,
    acceptedConditionIds: [...draft.acceptedConditionIds],
  };
}

function publicError(code: PublicError["code"], retryable = true): PublicError {
  return { code, retryable, message: "" };
}

function friendlyCreateError(error: PublicError): string {
  switch (error.code) {
    case "CONTENT_SELECTION_INVALID":
      return "这组选择暂时无法成立，请检查标记的条件。";
    case "PERSISTENCE_UNAVAILABLE":
      return "记录没有保存成功，请稍后再试。";
    case "REVISION_CONFLICT":
      return "记录已经发生变化，请重新打开游戏。";
    default:
      return "这段旅程没有成功保存，请稍后再试。";
  }
}

function friendlyActionError(error: PublicError): string {
  switch (error.code) {
    case "ACTION_UNAVAILABLE":
      return "这次行动现在无法进行，请换个安排。";
    case "REVISION_CONFLICT":
      return "记录已经发生变化，请重新打开游戏。";
    case "PERSISTENCE_UNAVAILABLE":
      return "这次行动没有保存成功，可以稍后再试。";
    default:
      return "这次行动没有完成，可以再试一次。";
  }
}

function Header() {
  return (
    <header className="app-header">
      <div className="header-seal" aria-hidden="true">◇</div>
      <div>
        <span className="header-kicker">人物档案</span>
        <strong>从一段普通生活开始</strong>
      </div>
    </header>
  );
}

function LoadingState() {
  return (
    <section className="state-card state-card--loading" role="status" aria-live="polite">
      <div className="state-symbol state-symbol--spinner" aria-hidden="true">◌</div>
      <p className="eyebrow">正在整理</p>
      <h1>正在读取记录</h1>
      <p className="state-copy">请稍候，先让故事找到它的起点。</p>
    </section>
  );
}

function StorageUnavailableState() {
  return (
    <section className="state-card state-card--danger" aria-labelledby="unavailable-title">
      <div className="state-symbol state-symbol--danger" aria-hidden="true">×</div>
      <p className="eyebrow eyebrow--danger">记录入口</p>
      <h1 id="unavailable-title">记录暂时无法打开</h1>
      <p className="state-copy">当前记录没有回应，故事还没有被改写。</p>
      <p className="state-copy">可以稍后再次打开游戏。</p>
      <p className="state-copy">请重新启动游戏后再试。</p>
    </section>
  );
}

function CreatingState({ displayName }: { readonly displayName: string }) {
  return (
    <section className="state-card state-card--loading" role="status" aria-live="polite">
      <div className="state-symbol state-symbol--spinner" aria-hidden="true">◌</div>
      <p className="eyebrow">整理行装</p>
      <h1>正在准备旅程</h1>
      <p className="state-copy">正在为“{displayName.trim()}”准备第一天。</p>
      <div className="progress-line" aria-hidden="true"><span /></div>
    </section>
  );
}

function App() {
  const [viewState, setViewState] = useState<AppViewState>({ kind: "loading" });
  const [draft, setDraft] = useState<CreationDraft>(EMPTY_DRAFT);
  const [creationStep, setCreationStep] = useState<CreationStepIndex>(0);
  const [actionState, setActionState] = useState<ActionState>({ kind: "idle" });
  const [eventState, setEventState] = useState<EventState>({ kind: "idle" });
  const catalogueRef = useRef<PublicCharacterCreationCatalogue | null>(null);
  const pendingCreateRef = useRef<PendingCreate | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  const pendingEventRef = useRef<PendingEventIntent | null>(null);
  const actionInFlightRef = useRef(false);
  const eventInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const bridge = getProductionBridge();
    if (bridge === undefined) {
      setViewState({ kind: "storage-unavailable" });
      return () => {
        cancelled = true;
      };
    }

    bridge.getBootstrap().then(
      (result) => {
        if (cancelled) return;
        if (!result.ok) {
          setViewState({ kind: "storage-unavailable", error: result.error });
          return;
        }
        const bootstrap = result.value;
        if (
          bootstrap.contractVersion !== CONTRACT_VERSION ||
          bootstrap.storageSchemaVersion !== STORAGE_SCHEMA_VERSION ||
          bootstrap.characterCreation.contentVersion !== CONTENT_VERSION ||
          bootstrap.characterCreation.fixtureContent !== true
        ) {
          setViewState({ kind: "storage-unavailable", error: publicError("CONTRACT_VERSION_MISMATCH", false) });
          return;
        }
        if (bootstrap.storageStatus !== "READY") {
          setViewState({ kind: "storage-unavailable" });
          return;
        }
        catalogueRef.current = bootstrap.characterCreation;
        if (bootstrap.lifecycle === "ACTIVE" && bootstrap.activeState !== null) {
          setViewState({ kind: "active", game: bootstrap.activeState, catalogue: bootstrap.characterCreation });
          return;
        }
        if (bootstrap.lifecycle === "NO_RUN") {
          setViewState({ kind: "no-run", catalogue: bootstrap.characterCreation });
          return;
        }
        setViewState({ kind: "storage-unavailable" });
      },
      () => {
        if (!cancelled) setViewState({ kind: "storage-unavailable" });
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const updateDraft = useCallback((patch: DraftPatch) => {
    pendingCreateRef.current = null;
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const handleCreate = useCallback(async (selection: CharacterCreationSelection) => {
    const bridge = getProductionBridge();
    const catalogue = catalogueRef.current;
    if (bridge === undefined || catalogue === null) {
      setViewState({ kind: "storage-unavailable" });
      return;
    }

    const selectionKey = JSON.stringify(selection);
    const existing = pendingCreateRef.current;
    const envelope: IntentEnvelope = existing?.selectionKey === selectionKey
      ? existing.envelope
      : {
          contractVersion: CONTRACT_VERSION,
          intentId: createIntentId(),
          runId: null,
          expectedRevision: 0,
          payload: { kind: "CREATE_CHARACTER_RUN", selection },
        };
    pendingCreateRef.current = { selectionKey, envelope };
    setViewState({ kind: "creating", catalogue });

    try {
      const result = await bridge.submitIntent(envelope);
      if (result.ok) {
        pendingCreateRef.current = null;
        setActionState({ kind: "idle" });
        setEventState({ kind: "idle" });
        setViewState({ kind: "active", game: result.value.publicState, catalogue });
        return;
      }
      setViewState({ kind: "create-failed", catalogue, error: result.error });
    } catch {
      setViewState({ kind: "create-failed", catalogue, error: publicError("INTERNAL_ERROR") });
    }
  }, []);

  const handleAction = useCallback(async (action: PublicActionKind) => {
    if (viewState.kind !== "active" || viewState.game.activeEvent !== null) return;
    if (actionInFlightRef.current || eventInFlightRef.current) return;
    const bridge = getProductionBridge();
    if (bridge === undefined) {
      setActionState({ kind: "error", error: publicError("PERSISTENCE_UNAVAILABLE") });
      return;
    }

    const game = viewState.game;
    const catalogue = viewState.catalogue;
    const key = `${game.runId}:${game.revision}:${action}`;
    const existing = pendingActionRef.current;
    if (existing !== null) {
      if (existing.key !== key) return;
    } else {
      const envelope: IntentEnvelope<PerformWeeklyActionIntent> = {
        contractVersion: CONTRACT_VERSION,
        intentId: createIntentId(),
        runId: game.runId,
        expectedRevision: game.revision,
        payload: { kind: "PERFORM_WEEKLY_ACTION", action },
      };
      pendingActionRef.current = { key, envelope };
    }

    const envelope = pendingActionRef.current?.envelope;
    if (envelope === undefined) return;
    actionInFlightRef.current = true;
    setActionState({ kind: "submitting", action });
    try {
      const result = await bridge.submitIntent(envelope);
      if (result.ok) {
        actionInFlightRef.current = false;
        pendingActionRef.current = null;
        setActionState({ kind: "idle" });
        setViewState({ kind: "active", game: result.value.publicState, catalogue });
        return;
      }
      actionInFlightRef.current = false;
      setActionState({ kind: "error", error: result.error });
    } catch {
      actionInFlightRef.current = false;
      setActionState({ kind: "error", error: publicError("INTERNAL_ERROR") });
    }
  }, [viewState]);

  const handleEventChoice = useCallback(async (eventInstanceId: string, choiceId: string) => {
    if (viewState.kind !== "active") return;
    const event = viewState.game.activeEvent;
    if (event === null || event.eventInstanceId !== eventInstanceId) return;
    if (actionInFlightRef.current || eventInFlightRef.current) return;
    const bridge = getProductionBridge();
    if (bridge === undefined) {
      setEventState({ kind: "error", error: publicError("PERSISTENCE_UNAVAILABLE") });
      return;
    }

    const choice = event.choices.find((candidate) => candidate.id === choiceId);
    if (choice === undefined || choice.unavailableReason !== undefined || choice.resolutionMode === "COMBAT" || choice.resolutionMode === "TRADE") return;
    const key = `${viewState.game.runId}:${viewState.game.revision}:${eventInstanceId}:${choiceId}`;
    const existing = pendingEventRef.current;
    if (existing !== null) {
      if (existing.key !== key) return;
    } else {
      const envelope: IntentEnvelope<ResolveEventChoiceIntent> = {
        contractVersion: CONTRACT_VERSION,
        intentId: createIntentId(),
        runId: viewState.game.runId,
        expectedRevision: viewState.game.revision,
        payload: { kind: "RESOLVE_EVENT_CHOICE", eventInstanceId, choiceId },
      };
      pendingEventRef.current = { key, envelope };
    }

    const envelope = pendingEventRef.current?.envelope;
    if (envelope === undefined) return;
    eventInFlightRef.current = true;
    setEventState({ kind: "submitting", choiceId });
    try {
      const result = await bridge.submitIntent(envelope);
      if (result.ok) {
        eventInFlightRef.current = false;
        pendingEventRef.current = null;
        setEventState({ kind: "idle" });
        setViewState({ kind: "active", game: result.value.publicState, catalogue: viewState.catalogue });
        return;
      }
      eventInFlightRef.current = false;
      setEventState({ kind: "error", error: result.error });
    } catch {
      eventInFlightRef.current = false;
      setEventState({ kind: "error", error: publicError("INTERNAL_ERROR") });
    }
  }, [viewState]);

  let content: ReactNode;
  switch (viewState.kind) {
    case "loading":
      content = <LoadingState />;
      break;
    case "storage-unavailable":
      content = <StorageUnavailableState />;
      break;
    case "no-run":
      content = <CreateRunState catalogue={viewState.catalogue} draft={draft} step={creationStep} onStepChange={setCreationStep} onDraftChange={updateDraft} onCreate={handleCreate} />;
      break;
    case "creating":
      content = <CreatingState displayName={draft.displayName} />;
      break;
    case "create-failed":
      content = <CreateFailedState catalogue={viewState.catalogue} draft={draft} step={creationStep} error={viewState.error} onStepChange={setCreationStep} onDraftChange={updateDraft} onCreate={handleCreate} />;
      break;
    case "active":
      content = <ActiveRunState game={viewState.game} catalogue={viewState.catalogue} actionState={actionState} eventState={eventState} onAction={handleAction} onEventChoice={handleEventChoice} />;
      break;
  }

  return (
    <main className="app-shell">
      <Header />
      <div className="shell-content">{content}</div>
    </main>
  );
}

function CreateRunState({
  catalogue,
  draft,
  step,
  onStepChange,
  onDraftChange,
  onCreate,
}: {
  readonly catalogue: PublicCharacterCreationCatalogue;
  readonly draft: CreationDraft;
  readonly step: CreationStepIndex;
  readonly onStepChange: (step: CreationStepIndex) => void;
  readonly onDraftChange: (patch: DraftPatch) => void;
  readonly onCreate: (selection: CharacterCreationSelection) => void;
}) {
  return <section className="creation-shell"><CreationFlow catalogue={catalogue} draft={draft} step={step} onStepChange={onStepChange} onDraftChange={onDraftChange} onCreate={onCreate} /></section>;
}

function CreateFailedState({
  catalogue,
  draft,
  step,
  error,
  onStepChange,
  onDraftChange,
  onCreate,
}: {
  readonly catalogue: PublicCharacterCreationCatalogue;
  readonly draft: CreationDraft;
  readonly step: CreationStepIndex;
  readonly error: PublicError;
  readonly onStepChange: (step: CreationStepIndex) => void;
  readonly onDraftChange: (patch: DraftPatch) => void;
  readonly onCreate: (selection: CharacterCreationSelection) => void;
}) {
  return (
    <section className="creation-shell creation-shell--failed">
      <div className="creation-failure-banner">
        <div className="state-symbol state-symbol--danger" aria-hidden="true">×</div>
        <div>
          <p className="eyebrow eyebrow--danger">旅程暂停</p>
          <h1>还没能出发</h1>
          <p className="error-callout" role="alert">{friendlyCreateError(error)}</p>
          <small className="error-help">{error.retryable ? "确认选择后可以再次尝试。" : "请重新启动游戏后再试。"}</small>
        </div>
      </div>
      <CreationFlow catalogue={catalogue} draft={draft} step={step} onStepChange={onStepChange} onDraftChange={onDraftChange} onCreate={onCreate} submitDisabled={!error.retryable} />
    </section>
  );
}

function CreationFlow({
  catalogue,
  draft,
  step,
  onStepChange,
  onDraftChange,
  onCreate,
  submitDisabled = false,
}: {
  readonly catalogue: PublicCharacterCreationCatalogue;
  readonly draft: CreationDraft;
  readonly step: CreationStepIndex;
  readonly onStepChange: (step: CreationStepIndex) => void;
  readonly onDraftChange: (patch: DraftPatch) => void;
  readonly onCreate: (selection: CharacterCreationSelection) => void;
  readonly submitDisabled?: boolean;
}) {
  const [attemptedSteps, setAttemptedSteps] = useState<readonly CreationStepIndex[]>([]);
  const errors = validateCreationStep(step, draft, catalogue);
  const showErrors = attemptedSteps.includes(step) || (step === 0 && draft.displayName.length > 0);
  const visibleErrors = showErrors ? errors : [];
  const update = (patch: DraftPatch) => onDraftChange(patch);
  const moveNext = () => {
    if (errors.length > 0) {
      setAttemptedSteps((current) => (current.includes(step) ? current : [...current, step]));
      return;
    }
    if (step < 5) onStepChange((step + 1) as CreationStepIndex);
  };
  const movePrevious = () => {
    if (step > 0) onStepChange((step - 1) as CreationStepIndex);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 5) {
      moveNext();
      return;
    }
    if (errors.length > 0 || submitDisabled) {
      setAttemptedSteps((current) => (current.includes(step) ? current : [...current, step]));
      return;
    }
    onCreate(selectionFromDraft(draft));
  };

  return (
    <form className="creation-flow" onSubmit={submit} noValidate>
      <StepNavigation step={step} onStepChange={onStepChange} />
      <section className="creation-choice-panel" aria-label="本步选择">
        <div className="creation-progress">第 {step + 1} 步，共 6 步</div>
        {visibleErrors.length > 0 ? <div className="validation-summary" role="alert">{visibleErrors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        {step === 0 ? <IdentityStep catalogue={catalogue} draft={draft} update={update} /> : null}
        {step === 1 ? <OriginStep catalogue={catalogue} draft={draft} update={update} /> : null}
        {step === 2 ? <ProfessionStep catalogue={catalogue} draft={draft} update={update} /> : null}
        {step === 3 ? <PersonalityStep catalogue={catalogue} draft={draft} update={update} /> : null}
        {step === 4 ? <SummaryStep catalogue={catalogue} draft={draft} /> : null}
        {step === 5 ? <ConfirmationStep /> : null}
      </section>
      <CreationDetailPanel catalogue={catalogue} draft={draft} step={step} onConditionChange={(conditionId, accepted) => {
        const acceptedConditionIds = accepted
          ? [...draft.acceptedConditionIds.filter((id) => id !== conditionId), conditionId]
          : draft.acceptedConditionIds.filter((id) => id !== conditionId);
        update({ acceptedConditionIds });
      }} />
      <div className="creation-nav">
        <button className="secondary-button" type="button" onClick={movePrevious} disabled={step === 0}>上一步</button>
        <button className="primary-button" type="submit" disabled={errors.length > 0 || submitDisabled}>{step === 5 ? "开始旅程" : "继续"}</button>
      </div>
    </form>
  );
}

function StepNavigation({ step, onStepChange }: { readonly step: CreationStepIndex; readonly onStepChange: (step: CreationStepIndex) => void }) {
  return (
    <aside className="creation-step-nav" aria-label="捏人步骤">
      <ol>
        {CREATION_STEPS.map((label, index) => {
          const available = index <= step;
          return (
            <li className={index === step ? "is-current" : index < step ? "is-complete" : ""} key={label}>
              <button type="button" tabIndex={-1} disabled={!available} aria-current={index === step ? "step" : undefined} onClick={() => available && onStepChange(index as CreationStepIndex)}>
                <span className="step-number">{index + 1}</span><span>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function IdentityStep({ catalogue, draft, update }: { readonly catalogue: PublicCharacterCreationCatalogue; readonly draft: CreationDraft; readonly update: (patch: DraftPatch) => void }) {
  const nameErrors = validateDisplayName(draft.displayName);
  const age = Number(draft.age);
  return (
    <div className="creation-step-content">
      <div className="step-heading">
        <p className="eyebrow">写下你的名字</p>
        <h1>从哪一个名字开始？</h1>
        <p>先决定你是谁，再看看哪条路愿意接纳你。</p>
      </div>
      <div className="identity-fields">
        <label className="field field--wide"><span>姓名</span><input value={draft.displayName} maxLength={80} aria-invalid={nameErrors.length > 0 ? "true" : "false"} onChange={(event: ChangeEvent<HTMLInputElement>) => update({ displayName: event.target.value })} />{nameErrors.includes("名字不能超过 80 个字符。") ? <small className="field-error">名字不能超过 80 个字符。</small> : null}</label>
        <label className="field"><span>性别</span><select value={draft.sex} onChange={(event) => update({ sex: event.target.value as PublicSex | "" })}><option value="">请选择</option><option value="FEMALE">女性</option><option value="MALE">男性</option></select></label>
        <label className="field"><span>年龄</span><input type="number" min={18} max={45} value={draft.age} onChange={(event: ChangeEvent<HTMLInputElement>) => update({ age: event.target.value })} />{Number.isNaN(age) || (draft.age !== "" && (!Number.isInteger(age) || age < 18 || age > 45)) ? <small className="field-error">年龄需在 18 到 45 岁之间。</small> : null}</label>
        <label className="field field--wide"><span>出生地</span><select value={draft.birthplaceId} onChange={(event) => update({ birthplaceId: event.target.value })}><option value="">请选择</option>{catalogue.birthplaces.map((birthplace) => <option value={birthplace.id} key={birthplace.id}>{birthplace.label}</option>)}</select></label>
        <label className="field field--wide"><span>外貌描述</span><textarea aria-label="外貌描述" rows={2} value={draft.appearanceDescription} placeholder="用一两句话写下你的外貌" onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update({ appearanceDescription: event.target.value })} /></label>
      </div>
    </div>
  );
}

function OriginStep({ catalogue, draft, update }: { readonly catalogue: PublicCharacterCreationCatalogue; readonly draft: CreationDraft; readonly update: (patch: DraftPatch) => void }) {
  return (
    <div className="creation-step-content">
      <div className="step-heading"><p className="eyebrow">你的来处</p><h1>什么样的日子养大了你？</h1><p>选一项出身，详细说明会留在右侧。</p></div>
      <div className="choice-grid choice-grid--origins">{catalogue.origins.map((origin) => <button className={`choice-card${draft.originId === origin.id ? " is-selected" : ""}`} type="button" aria-pressed={draft.originId === origin.id} key={origin.id} onClick={() => update({ originId: origin.id, professionId: "", acceptedConditionIds: [] })}><span className="choice-card-meta">{TIER_LABELS[origin.tier]}</span><strong>{origin.label}</strong></button>)}</div>
    </div>
  );
}

function ProfessionStep({ catalogue, draft, update }: { readonly catalogue: PublicCharacterCreationCatalogue; readonly draft: CreationDraft; readonly update: (patch: DraftPatch) => void }) {
  return (
    <div className="creation-step-content">
      <div className="step-heading"><p className="eyebrow">眼前的谋生路</p><h1>你准备靠什么过日子？</h1><p>每条路都有自己的门槛；右侧会说明与你的来处是否相接。</p></div>
      <div className="choice-grid choice-grid--professions">{catalogue.professions.map((profession) => {
        const rule = ruleFor(catalogue, draft.originId, profession.id);
        const forbidden = rule?.status === "FORBIDDEN";
        const status = rule?.status ?? "FORBIDDEN";
        return <button className={`choice-card choice-card--profession${draft.professionId === profession.id ? " is-selected" : ""}${forbidden ? " is-disabled" : ""}`} type="button" aria-pressed={draft.professionId === profession.id} disabled={forbidden} key={profession.id} onClick={() => { if (!forbidden) update({ professionId: profession.id, acceptedConditionIds: [] }); }}><span className={`status-badge status-badge--${status.toLowerCase()}`}>{formatCompatibilityStatus(status)}</span><strong>{profession.label}</strong><small>{formatLegality(profession.legality)}</small></button>;
      })}</div>
    </div>
  );
}

function PersonalityStep({ catalogue, draft, update }: { readonly catalogue: PublicCharacterCreationCatalogue; readonly draft: CreationDraft; readonly update: (patch: DraftPatch) => void }) {
  const toggleTrait = (traitId: string) => {
    const selected = draft.traitIds.includes(traitId);
    update({ traitIds: selected ? draft.traitIds.filter((id) => id !== traitId) : draft.traitIds.length < 2 ? [...draft.traitIds, traitId] : draft.traitIds });
  };
  return (
    <div className="creation-step-content">
      <div className="step-heading"><p className="eyebrow">性情与裂痕</p><h1>什么会陪你走下去？</h1><p>选恰好两项性格，再留下一处真实缺陷。</p></div>
      <div className="choice-group"><div className="choice-group-heading"><span>性格特质</span><small>{draft.traitIds.length} / 2</small></div><div className="choice-grid choice-grid--traits">{catalogue.traits.map((trait) => <button className={`choice-card${draft.traitIds.includes(trait.id) ? " is-selected" : ""}`} type="button" aria-pressed={draft.traitIds.includes(trait.id)} key={trait.id} onClick={() => toggleTrait(trait.id)}><strong>{trait.label}</strong><small>{trait.summary}</small></button>)}</div></div>
      <div className="choice-group"><div className="choice-group-heading"><span>真实缺陷</span><small>选一项</small></div><div className="choice-grid choice-grid--flaws">{catalogue.flaws.map((flaw) => <button className={`choice-card${draft.flawId === flaw.id ? " is-selected" : ""}`} type="button" aria-pressed={draft.flawId === flaw.id} key={flaw.id} onClick={() => update({ flawId: flaw.id })}><strong>{flaw.label}</strong><small>{flaw.summary}</small></button>)}</div></div>
    </div>
  );
}

function SummaryStep({ catalogue, draft }: { readonly catalogue: PublicCharacterCreationCatalogue; readonly draft: CreationDraft }) {
  const origin = selectedOption(catalogue.origins, draft.originId);
  const profession = selectedOption(catalogue.professions, draft.professionId);
  const birthplace = selectedOption(catalogue.birthplaces, draft.birthplaceId);
  if (origin === undefined || profession === undefined) return <div className="creation-step-content"><div className="step-heading"><p className="eyebrow">出发前看一眼</p><h1>角色摘要</h1><p>回到前面的步骤补齐你的选择。</p></div></div>;
  return <div className="creation-step-content"><div className="step-heading"><p className="eyebrow">出发前看一眼</p><h1>角色摘要</h1><p>你的选择已经收成一页，确认后便从这一天开始。</p></div><OpeningSummary displayName={draft.displayName.trim()} origin={origin} profession={profession} birthplaceLabel={birthplace?.label ?? "尚未选择"} appearanceDescription={draft.appearanceDescription.trim()} /></div>;
}

function formatOpeningModifiers(modifiers: PublicCharacterProjection["coreStats"]): string {
  const parts = CORE_STATS.map(({ key, label }) => ({ label, value: modifiers[key] })).filter(({ value }) => value !== 0).map(({ label, value }) => `${label} ${value > 0 ? "+" : ""}${value}`);
  return parts.length > 0 ? parts.join("、") : "无修正";
}

function OpeningSummary({ displayName, origin, profession, birthplaceLabel, appearanceDescription }: { readonly displayName: string; readonly origin: PublicOriginOption; readonly profession: PublicProfessionOption; readonly birthplaceLabel: string; readonly appearanceDescription: string }) {
  return (
    <section className="opening-summary" aria-label="开局摘要">
      <div className="opening-summary-heading"><strong>你的起点</strong><span>出发前可回看</span></div>
      <p className="opening-summary-note">姓名、来处、谋生路与眼前的起点都在这里。</p>
      <dl className="opening-summary-grid">
        <SummaryItem label="姓名" value={displayName || "尚未填写"} />
        <SummaryItem label="出生地" value={birthplaceLabel} />
        <SummaryItem label="外貌" value={appearanceDescription || "尚未写下"} />
        <SummaryItem label="出身能力" value={formatOpeningModifiers(origin.opening.coreStatModifiers)} />
        <SummaryItem label="学历" value={origin.opening.educationLabel} />
        <SummaryItem label="开局知识" value={`+${origin.opening.openingKnowledgeBonus}`} />
        <SummaryItem label="家庭经济" value={origin.opening.familyEconomyLabel} />
        <SummaryItem label="职业能力" value={formatOpeningModifiers(profession.opening.coreStatModifiers)} />
        <SummaryItem label="初始资金" value={formatCashPence(profession.opening.initialCashPence)} />
        <SummaryItem label="每周工资" value={formatCashPence(profession.opening.weeklyWorkPayPence)} />
      </dl>
    </section>
  );
}

function ConfirmationStep() {
  return <div className="creation-step-content creation-step-content--confirm"><div className="step-heading"><p className="eyebrow">最后看一眼</p><h1>确认出发</h1><p>确认这份人物摘要，开始你的第一天。</p></div><div className="confirmation-note" role="status"><span className="confirmation-mark" aria-hidden="true">◇</span><strong>路已经在脚下</strong><p>你可以随时回到前面的步骤修改选择。</p></div></div>;
}

function CreationDetailPanel({ catalogue, draft, step, onConditionChange }: { readonly catalogue: PublicCharacterCreationCatalogue; readonly draft: CreationDraft; readonly step: CreationStepIndex; readonly onConditionChange: (conditionId: string, accepted: boolean) => void }) {
  const birthplace = selectedOption(catalogue.birthplaces, draft.birthplaceId);
  const origin = selectedOption(catalogue.origins, draft.originId);
  const profession = selectedOption(catalogue.professions, draft.professionId);
  const selectedTraits = draft.traitIds.map((id) => selectedOption(catalogue.traits, id)).filter((trait): trait is PublicTraitOption => trait !== undefined);
  const flaw = selectedOption(catalogue.flaws, draft.flawId);
  const rule = profession === undefined ? undefined : ruleFor(catalogue, draft.originId, profession.id);
  const conditionAccepted = rule?.conditionId !== undefined && draft.acceptedConditionIds.includes(rule.conditionId);
  const appearance = draft.appearanceDescription.trim();
  return (
    <aside className="creation-detail-panel" aria-label="人物摘要与详情">
      <div className="detail-panel-topline"><span>随选择更新</span><span>{step + 1} / 6</span></div>
      <h2>人物摘要</h2>
      <div className="selected-detail">
        {step === 0 && birthplace !== undefined ? <DetailBlock label="出生地" title={birthplace.label} text={birthplace.summary} /> : null}
        {step === 0 && appearance !== "" ? <DetailBlock label="外貌" title="外貌描述" text={appearance} /> : null}
        {step === 1 && origin !== undefined ? <DetailBlock label="出身" title={origin.label} text={origin.summary} /> : null}
        {step === 2 && profession !== undefined ? <DetailBlock label={formatLegality(profession.legality)} title={profession.label} text={profession.summary} /> : null}
        {step === 3 && selectedTraits.length > 0 ? <DetailBlock label="性情" title={selectedTraits.map((trait) => trait.label).join("、")} text="这些特质会陪你走过接下来的日子。" /> : null}
        {step === 3 && flaw !== undefined ? <DetailBlock label="缺陷" title={flaw.label} text={flaw.summary} /> : null}
        {step === 4 && origin !== undefined ? <DetailBlock label="出身影响" title={origin.label} text="出身、学历和家庭经济已经列在中间摘要。" /> : null}
        {step === 4 && profession !== undefined ? <DetailBlock label="职业影响" title={profession.label} text="职业、初始资金和每周工资已经列在中间摘要。" /> : null}
        {step === 5 ? <DetailBlock label="摘要" title="人物已经成形" text="姓名、来处、谋生路与性情都已收在这一页。" /> : null}
        {step < 4 && ((step === 0 && birthplace === undefined && appearance === "") || (step === 1 && origin === undefined) || (step === 2 && profession === undefined) || (step === 3 && selectedTraits.length === 0 && flaw === undefined)) ? <p className="detail-placeholder">请选择本步的一项，右侧会留下简短说明。</p> : null}
      </div>
      {step === 2 && rule !== undefined ? <CompatibilityCallout rule={rule} accepted={conditionAccepted} onToggle={() => rule.conditionId !== undefined && onConditionChange(rule.conditionId, !conditionAccepted)} /> : null}
      <div className="creation-role-summary"><div className="summary-caption">目前的你</div><dl className="summary-list"><SummaryItem label="姓名" value={draft.displayName.trim() || "尚未填写"} /><SummaryItem label="性别 / 年龄" value={draft.sex === "" ? "尚未选择" : `${formatSex(draft.sex)} / ${draft.age || "—"} 岁`} /><SummaryItem label="出生地" value={birthplace?.label ?? "尚未选择"} /><SummaryItem label="外貌" value={appearance || "尚未填写"} /><SummaryItem label="出身" value={origin?.label ?? "尚未选择"} /><SummaryItem label="职业" value={profession?.label ?? "尚未选择"} /><SummaryItem label="性情" value={selectedTraits.length > 0 ? selectedTraits.map((trait) => trait.label).join("、") : "尚未选择"} /><SummaryItem label="缺陷" value={flaw?.label ?? "尚未选择"} /></dl></div>
    </aside>
  );
}

function DetailBlock({ label, title, text }: { readonly label: string; readonly title: string; readonly text: string }) {
  return <div className="detail-block"><span className="detail-label">{label}</span><strong>{title}</strong><p>{text}</p></div>;
}

function CompatibilityCallout({ rule, accepted, onToggle }: { readonly rule: PublicCompatibilityRule; readonly accepted: boolean; readonly onToggle: () => void }) {
  if (rule.status === "FORBIDDEN") return <div className="condition-callout condition-callout--blocked" role="alert"><strong>这条路暂时走不通</strong><p>{rule.publicReason}</p></div>;
  if (rule.status === "CONDITIONAL" && rule.conditionId !== undefined) return <div className="condition-callout" role="group" aria-label="这条路的条件"><strong>这条路有一个条件</strong><p>{rule.publicReason}</p>{rule.conditionCostSummary ? <small>{rule.conditionCostSummary}</small> : null}<label className="condition-check"><input type="checkbox" checked={accepted} onChange={onToggle} /><span>我愿意接受这项条件</span></label></div>;
  if (rule.status === "CONDITIONAL") return <div className="condition-callout condition-callout--blocked" role="alert"><strong>这条路需要额外条件</strong><p>{rule.publicReason || "条件内容尚未接入。"}</p>{rule.publicReason.includes("条件内容尚未接入") ? null : <p>条件内容尚未接入。</p>}</div>;
  return <div className="condition-callout condition-callout--clear"><strong>这条路可以走通</strong><p>{rule.publicReason || "当前选择可以自然衔接。"}</p></div>;
}

function SummaryItem({ label, value }: { readonly label: string; readonly value: string }) {
  return <div className="summary-item"><dt>{label}</dt><dd>{value}</dd></div>;
}

function ActiveRunState({ game, catalogue, actionState, eventState, onAction, onEventChoice }: { readonly game: PublicGameState; readonly catalogue: PublicCharacterCreationCatalogue; readonly actionState: ActionState; readonly eventState: EventState; readonly onAction: (action: PublicActionKind) => void; readonly onEventChoice: (eventInstanceId: string, choiceId: string) => void }) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const eventOpen = game.activeEvent !== null;

  useEffect(() => {
    const dashboard = dashboardRef.current;
    if (dashboard === null) return;
    dashboard.toggleAttribute("inert", eventOpen);
    if (eventOpen) dashboard.setAttribute("aria-hidden", "true");
    else dashboard.removeAttribute("aria-hidden");
  }, [eventOpen]);

  return (
    <section className="active-run" aria-labelledby="active-run-title">
      <h1 id="active-run-title" className="sr-only">{formatPublicDate(game.currentDate)}</h1>
      <div className="dashboard-surface" ref={dashboardRef} aria-hidden={eventOpen ? "true" : undefined}>
        <div className="weekly-workbench"><DossierPanel game={game} /><StagePanel game={game} /><InventoryAbilityPanel /></div>
        <ActionSection catalogue={catalogue} game={game} actionState={actionState} onAction={onAction} />
      </div>
      {game.activeEvent !== null ? <EventOverlay event={game.activeEvent} eventState={eventState} onEventChoice={onEventChoice} /> : null}
    </section>
  );
}

function DossierPanel({ game }: { readonly game: PublicGameState }) {
  const { character } = game;
  return (
    <aside className="dossier-panel" aria-labelledby="dossier-title">
      <div className="panel-heading"><span>角色信息</span></div>
      <h2 id="dossier-title">角色信息</h2>
      <div className="identity-block">
        <div className="identity-copy"><strong>{character.displayName}</strong><span>{formatSequence(character.sequence)} · {formatSex(character.sex)} · {character.age} 岁</span><span>{character.birthplace.label} · {character.origin.label}</span><span>{character.profession.label}</span></div>
        <div className="identity-selections"><span>性情：{character.traits.map((trait) => trait.label).join("、")}</span><span>缺陷：{character.flaw.label}</span></div>
        <div className="appearance-copy"><span>外貌</span><p>{character.appearanceDescription || "尚未留下描述。"}</p></div>
      </div>
      <div className="dossier-summary"><Metric label="本周行动" value={`${game.availableActions} 次`} accent="amber" /><Metric label="扮演进度" value="未开始" accent="paper" /><Metric label="现金" value={formatCashPence(game.cashPence)} accent="paper" /></div>
      <div className="panel-rule" />
      <section aria-labelledby="core-stats-title"><div className="section-caption" id="core-stats-title">四项核心能力</div><div className="core-stat-list">{CORE_STATS.map((stat) => <div className="core-stat" key={stat.key}><span>{stat.label}</span><strong>{character.coreStats[stat.key]}</strong></div>)}</div></section>
      <div className="panel-rule" />
      <section aria-labelledby="resource-title"><div className="section-caption" id="resource-title">当前状态</div><div className="resource-list">{RESOURCE_ROWS.map((resource) => { const meter = character.resources[resource.key]; return <div className="resource-row" key={resource.key}><span>{resource.label}</span><strong>{meter.current} <em>/ {meter.max}</em></strong></div>; })}<div className="resource-row resource-row--pollution"><span>污染</span><strong>{character.resources.pollution}</strong></div></div></section>
    </aside>
  );
}

function StagePanel({ game }: { readonly game: PublicGameState }) {
  return (
    <section className="stage-panel" aria-labelledby="stage-title">
      <div className="panel-heading"><span>世界推演</span></div>
      <div className="stage-heading-row"><div><h2 id="stage-title">世界推演</h2><p>这里只展示你当前能够知晓的世界变化。</p></div><time className="stage-date" dateTime={`${game.currentDate.year}-${String(game.currentDate.month).padStart(2, "0")}-${String(game.currentDate.day).padStart(2, "0")}`}>{formatPublicDate(game.currentDate)}</time></div>
      <div className="stage-main-content">
        <WorldPulseCard game={game} />
      </div>
      <div className="stage-support-grid"><KnowledgeCluePanel title="知识记录" records={game.knowledgeRecords} /><KnowledgeCluePanel title="线索" records={game.clues} /><PendingEventPanel events={game.pendingEvents} /></div>
    </section>
  );
}

function WorldPulseCard({ game }: { readonly game: PublicGameState }) {
  const projectedFeedback = game.worldFeedback.filter((entry) => entry.kind === "WORLD_PULSE" || entry.kind === "EVENT_RESULT");
  const latestFeedback = projectedFeedback.at(-1);
  const title = latestFeedback?.title ?? "暂无新的公开变化";
  const summary = latestFeedback?.summary ?? "目前没有你能够确认的新消息。";
  const messageDate = latestFeedback?.date ?? game.currentDate;
  const secondaryFeedback = projectedFeedback.slice(-3, -1).reverse();
  return <article className="world-pulse-card" aria-label="世界推演消息"><span className="event-stage-mark" aria-hidden="true">◇</span><p className="event-stage-kicker">{latestFeedback ? worldFeedbackKindLabel(latestFeedback.kind) : "公开变化"}</p><h3>{title}</h3><p className="event-stage-copy">{summary}</p><time>{formatPublicDate(messageDate)}</time>{secondaryFeedback.length > 0 ? <ol className="world-pulse-list" aria-label="此前的公开消息">{secondaryFeedback.map((entry) => <li key={entry.id}><strong>{entry.title}</strong><span>{entry.summary}</span></li>)}</ol> : null}</article>;
}

function worldFeedbackKindLabel(kind: PublicWorldFeedbackEntry["kind"]): string {
  switch (kind) {
    case "WORLD_PULSE":
      return "世界动态";
    case "EVENT_RESULT":
      return "事件后续";
    case "ACTION":
      return "行动影响";
  }
}

function EventOverlay({ event, eventState, onEventChoice }: { readonly event: PublicEventCard; readonly eventState: EventState; readonly onEventChoice: (eventInstanceId: string, choiceId: string) => void }) {
  return <div className="event-overlay" role="presentation"><div className="event-overlay-backdrop" aria-hidden="true" /><EventDialog event={event} eventState={eventState} onChoice={onEventChoice} /></div>;
}

function EventDialog({ event, eventState, onChoice }: { readonly event: PublicEventCard; readonly eventState: EventState; readonly onChoice: (eventInstanceId: string, choiceId: string) => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const submittingChoice = eventState.kind === "submitting" ? eventState.choiceId : null;
  const eventError = eventState.kind === "error" ? eventState.error : null;
  useEffect(() => {
    dialogRef.current?.focus();
  }, [event.eventInstanceId]);
  return (
    <section className="event-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="active-event-title" tabIndex={-1} onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === "Escape") keyboardEvent.preventDefault(); }}>
      <div className="event-dialog-heading"><span className="event-stage-mark" aria-hidden="true">◇</span><div><p className="event-stage-kicker">{event.sourceLabel}</p><h3 id="active-event-title">{event.title}</h3></div><time>{formatPublicDate(event.date)}</time></div>
      <p className="event-dialog-body">{event.body}</p>
      <div className="event-choice-grid">{event.choices.map((choice) => {
        const unsupported = choice.resolutionMode === "COMBAT" || choice.resolutionMode === "TRADE";
        const unavailableReason = choice.unavailableReason ?? (unsupported ? "这项选择暂时不能处理。" : undefined);
        const disabled = submittingChoice !== null || unavailableReason !== undefined;
        return <article className={`event-choice${disabled ? " is-disabled" : ""}`} key={choice.id}><button type="button" disabled={disabled} onClick={() => onChoice(event.eventInstanceId, choice.id)}><strong>{choice.label}</strong><small>{formatEventMode(choice.resolutionMode)} · {choice.hardCostPreview}</small></button><ul className="foreseeable-list">{choice.foreseeableConsequences.map((consequence) => <li key={consequence}>{consequence}</li>)}</ul>{choice.checkPreview ? <CheckPreviewPanel preview={choice.checkPreview} /> : null}{unavailableReason ? <p className="choice-unavailable">{unavailableReason}</p> : null}{submittingChoice === choice.id ? <span className="choice-progress">处理中…</span> : null}</article>;
      })}</div>
      {eventError !== null ? <p className="action-error" role="alert">{friendlyActionError(eventError)}</p> : null}
    </section>
  );
}

function formatEventMode(mode: PublicEventChoice["resolutionMode"]): string {
  switch (mode) {
    case "NONE":
      return "直接选择";
    case "CHECK":
      return "需要判断";
    case "COMBAT":
    case "TRADE":
      return "暂时不能处理";
  }
}

function CheckPreviewPanel({ preview }: { readonly preview: PublicCheckPreview }) {
  return <div className="check-preview" aria-label="判定预览"><span>{STAT_LABELS[preview.ability]} {preview.effectiveAbility}</span><span>难度 {preview.difficulty}</span><span>成功率 {preview.chance}%</span></div>;
}

function CheckResultPanel({ result }: { readonly result: NonNullable<PublicActionResult["resolution"]> }) {
  return <section className="resolution-panel" aria-label="判定结果"><div className="resolution-heading"><strong>判定结果</strong><span>{TIER_RESULT_LABELS[result.tier]}</span></div><div className="resolution-grid"><span>判定能力 {STAT_LABELS[result.ability]}</span><span>基础值 {result.baseAbility}</span><span>修正 {formatModifiers(result.modifiers)}</span><span>有效值 {result.effectiveAbility}</span><span>难度 {result.difficulty}</span><span>成功率 {result.chance}%</span><span>掷骰 {result.roll}</span><span>结果 {TIER_RESULT_LABELS[result.tier]}</span></div></section>;
}

function formatModifiers(modifiers: readonly { readonly source: string; readonly value: number }[]): string {
  if (modifiers.length === 0) return "无";
  return modifiers.map((modifier) => `${modifier.source} ${formatSignedNumber(modifier.value)}`).join("、");
}

function consequenceValue(item: PublicConsequenceItem): string | null {
  if (item.target === "KNOWLEDGE" && item.change === "ADD" && typeof item.numericValue === "number") return `知识 ${formatSignedNumber(item.numericValue)}`;
  if (item.target === "CASH" && typeof item.numericValue === "number" && Number.isFinite(item.numericValue)) return `现金 ${formatCashChangePence(item.numericValue)}`;
  return null;
}

function ConsequenceList({ items }: { readonly items: readonly PublicConsequenceItem[] }) {
  if (items.length === 0) return null;
  return <ol className="consequence-list" aria-label="结算后果">{items.map((item) => <li key={item.id} className={item.applied ? "is-applied" : "is-skipped"}>{consequenceValue(item) ? <strong>{consequenceValue(item)}</strong> : null}<span>{item.summary}</span>{!item.applied ? <small>这项结果没有发生。</small> : null}</li>)}</ol>;
}

function KnowledgeCluePanel({ title, records }: { readonly title: "知识记录" | "线索"; readonly records: readonly (PublicKnowledgeRecord | PublicClueRecord)[] }) {
  return <section className="record-panel" aria-label={title}><div className="section-caption">{title}</div>{records.length === 0 ? <p className="empty-copy">暂时没有新的记录。</p> : <div className="record-list">{records.map((record) => <article className="record-card" key={record.id}><strong>{record.title}</strong><p>{record.summary}</p><small>{record.visibility === "CONFIRMED" ? "已知" : "传闻"} · {record.sourceLabel}</small></article>)}</div>}</section>;
}

function PendingEventPanel({ events }: { readonly events: readonly PublicPendingEvent[] }) {
  return <section className="record-panel" aria-label="待处理事项"><div className="section-caption">待处理事项</div>{events.length === 0 ? <p className="empty-copy">暂时没有需要留意的事。</p> : <div className="record-list">{events.map((event) => <article className="record-card" key={event.eventInstanceId}><strong>{event.title}</strong><p>{event.sourceLabel}</p><small>{event.expiresOn ? `到期：${formatPublicDate(event.expiresOn)}` : "暂无期限"}</small></article>)}</div>}</section>;
}

function InventoryAbilityPanel() {
  const [activeTab, setActiveTab] = useState<"inventory" | "abilities">("inventory");
  const inventoryTabId = "inventory-tab";
  const abilitiesTabId = "abilities-tab";
  const panelId = "side-panel-content";
  const isInventory = activeTab === "inventory";
  return <aside className="inventory-panel" aria-labelledby="inventory-panel-title"><div className="panel-heading"><span>随身之物</span></div><h2 id="inventory-panel-title">随身物品</h2><div className="inventory-tabs" role="tablist" aria-label="随身物品与能力"><button className="inventory-tab" id={inventoryTabId} type="button" role="tab" aria-controls={panelId} aria-selected={isInventory} onClick={() => setActiveTab("inventory")}>背包</button><button className="inventory-tab" id={abilitiesTabId} type="button" role="tab" aria-controls={panelId} aria-selected={!isInventory} onClick={() => setActiveTab("abilities")}>能力</button></div><div className="inventory-empty-state" id={panelId} role="tabpanel" aria-labelledby={isInventory ? inventoryTabId : abilitiesTabId} tabIndex={0}><span className="inventory-empty-mark" aria-hidden="true">◇</span><strong>{isInventory ? "背包空空" : "尚未掌握"}</strong><p>{isInventory ? "这里还没有可以带在身边的物品。" : "你还没有掌握非凡能力。"}</p></div></aside>;
}

function ActionSection({ catalogue, game, actionState, onAction }: { readonly catalogue: PublicCharacterCreationCatalogue; readonly game: PublicGameState; readonly actionState: ActionState; readonly onAction: (action: PublicActionKind) => void }) {
  const submitting = actionState.kind === "submitting";
  const actionError = actionState.kind === "error" ? actionState.error : null;
  const profession = catalogue.professions.find((entry) => entry.id === game.character.profession.id);
  const weeklyWorkPayPence = profession?.opening.weeklyWorkPayPence;
  const workPay = typeof weeklyWorkPayPence === "number" && Number.isFinite(weeklyWorkPayPence) ? `工资：${formatCashPence(weeklyWorkPayPence)}` : "工资暂未提供";
  const blockedByEvent = game.activeEvent !== null;
  return <section className="action-section" aria-labelledby="action-title"><div className="action-section-heading"><div><div className="panel-heading"><span>本周安排</span></div><h2 id="action-title">行动台</h2></div><p>{blockedByEvent ? "先处理眼前的事" : game.availableActions > 0 ? `还可安排 ${game.availableActions} 次` : "本周的行动已经用尽"}</p></div><div className="action-dock">{DAILY_ACTIONS.map((entry) => <button className="action-button" type="button" aria-pressed="false" disabled={blockedByEvent || game.availableActions < 1 || submitting} key={entry.kind} onClick={() => onAction(entry.kind)}><span>{entry.label}</span><small>{entry.detail}</small><small>{entry.kind === "WORK" ? workPay : "每次消耗 1 次行动"}</small>{entry.kind === "WORK" ? <small>每次消耗 1 次行动</small> : null}{submitting && actionState.kind === "submitting" && actionState.action === entry.kind ? <small>处理中…</small> : null}</button>)}</div>{actionError !== null ? <p className="action-error" role="alert">{friendlyActionError(actionError)}</p> : null}{game.lastAction !== null ? <ActionResultStrip result={game.lastAction} /> : null}<div className="action-rule-note">每个安排都会留下结果与世界反馈。</div></section>;
}

function ActionResultStrip({ result }: { readonly result: PublicActionResult }) {
  const hasDetails = result.resolution !== null || result.consequences.length > 0;
  return <div className="action-result" role="status" aria-label="行动结果" aria-live="polite"><div className="result-strip"><div><p className="result-strip-kicker">{formatAction(result.action)} · 结果</p><strong>{result.title}</strong><span>{result.summary}</span></div><span>{result.weekAdvanced ? `已进入 ${formatPublicDate(result.dateAfter)}` : `还剩 ${result.availableActionsAfter} 次行动`}</span></div>{hasDetails ? <details className="action-result-details"><summary>查看行动详情</summary><div className="action-result-detail-content">{result.resolution ? <CheckResultPanel result={result.resolution} /> : null}<ConsequenceList items={result.consequences} /></div></details> : null}</div>;
}

function Metric({ label, value, accent }: { readonly label: string; readonly value: string; readonly accent: "amber" | "paper" | "red" }) {
  return <div className={`metric metric--${accent}`}><span>{label}</span><strong>{value}</strong></div>;
}

export { App };
