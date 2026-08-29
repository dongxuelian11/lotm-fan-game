import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  CONTRACT_VERSION,
  type BootstrapProjection,
  type MysteryGameBridge,
  type PublicError,
  type PublicGameState,
  type IntentEnvelope,
} from "@shared/contracts";

import "./styles.css";

type ShellState =
  | { readonly kind: "loading" }
  | { readonly kind: "storage-unavailable"; readonly error: PublicError }
  | { readonly kind: "no-run" }
  | { readonly kind: "creating"; readonly displayName: string }
  | {
      readonly kind: "create-failed";
      readonly displayName: string;
      readonly error: PublicError;
    }
  | { readonly kind: "active"; readonly game: PublicGameState };

const CORE_STATS = [
  { key: "physique", label: "体魄", hint: "承受与行动" },
  { key: "perception", label: "感知", hint: "观察与识别" },
  { key: "will", label: "意志", hint: "精神承载" },
  { key: "knowledge", label: "知识", hint: "学习与分析" },
] as const;

const RESOURCES = [
  { key: "health", label: "健康" },
  { key: "mind", label: "精神" },
  { key: "spirituality", label: "灵性" },
] as const;

const DAILY_ACTIONS = ["工作", "学习", "调查", "休养"] as const;

const FUTURE_ENTRIES = [
  { label: "黑市", detail: "隐秘交易与未知风险" },
  { label: "季度拍卖", detail: "珍稀之物每三个月现身" },
  { label: "事件", detail: "遭遇、抉择与后果" },
  { label: "战斗", detail: "危险中的较量与生存" },
] as const;

let fallbackIntentSequence = 0;

function getProductionBridge(): MysteryGameBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.mysteryGame;
}

function makePublicError(
  code: PublicError["code"],
  message: string,
  retryable: boolean,
): PublicError {
  return { code, message, retryable };
}

function bridgeUnavailableError(): PublicError {
  return makePublicError(
    "PERSISTENCE_UNAVAILABLE",
    "游戏记录暂时无法读取，请重新启动游戏。",
    false,
  );
}

function rendererFailureError(): PublicError {
  return makePublicError(
    "INTERNAL_ERROR",
    "卷宗暂时无法打开，请稍后再试。",
    true,
  );
}

function invalidBootstrapError(): PublicError {
  return makePublicError(
    "SCHEMA_INVALID",
    "卷宗内容出现异常，请重新启动游戏。",
    false,
  );
}

function createIntentId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  fallbackIntentSequence += 1;
  return `r1-fixture-${fallbackIntentSequence}`;
}

function createFixtureIntent(displayName: string): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId: createIntentId(),
    runId: null,
    expectedRevision: 0,
    payload: {
      kind: "CREATE_R1_FIXTURE_RUN",
      fixtureId: "ordinary-week-one",
      displayName,
    },
  };
}

function validateDisplayName(displayName: string): string | null {
  if (displayName.trim().length === 0) {
    return "请输入一个用于显示的名字。";
  }

  if (displayName.length > 80) {
    return "名字不能超过 80 个字。";
  }

  if ([...displayName].some((character) => character === "\u0000")) {
    return "名字包含不可用字符。";
  }

  return null;
}

function resolveBootstrap(result: Awaited<ReturnType<MysteryGameBridge["getBootstrap"]>>): ShellState {
  if (!result.ok) {
    return { kind: "storage-unavailable", error: result.error };
  }

  const bootstrap = result.value;
  if (bootstrap.storageStatus === "UNAVAILABLE") {
    return {
      kind: "storage-unavailable",
      error: makePublicError(
        "PERSISTENCE_UNAVAILABLE",
        "本地存储不可用，无法安全读取周目。",
        true,
      ),
    };
  }

  if (bootstrap.lifecycle === "ACTIVE") {
    if (bootstrap.activeState === null) {
      return { kind: "storage-unavailable", error: invalidBootstrapError() };
    }

    return { kind: "active", game: bootstrap.activeState };
  }

  if (bootstrap.activeState !== null) {
    return { kind: "storage-unavailable", error: invalidBootstrapError() };
  }

  return { kind: "no-run" };
}

function formatCashPence(cashPence: number): string {
  return `${new Intl.NumberFormat("zh-CN").format(cashPence)} 便士`;
}

function formatOrigin(origin: PublicGameState["character"]["origin"]): string {
  return origin === "LOEN" ? "鲁恩" : origin;
}

function formatSequence(sequence: PublicGameState["character"]["sequence"]): string {
  return sequence === "ORDINARY" ? "普通人" : sequence;
}

export function App() {
  const [shellState, setShellState] = useState<ShellState>({ kind: "loading" });
  const [displayName, setDisplayName] = useState("");
  const submittingRef = useRef(false);
  const pendingCreateRef = useRef<IntentEnvelope | null>(null);

  useEffect(() => {
    let cancelled = false;
    const productionBridge = getProductionBridge();

    if (productionBridge === undefined) {
      setShellState({ kind: "storage-unavailable", error: bridgeUnavailableError() });
      return () => {
        cancelled = true;
      };
    }

    void productionBridge
      .getBootstrap()
      .then((result) => {
        if (!cancelled) {
          setShellState(resolveBootstrap(result));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShellState({ kind: "storage-unavailable", error: rendererFailureError() });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const nameError = validateDisplayName(displayName);

  const handleNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextDisplayName = event.target.value;
    const pendingIntent = pendingCreateRef.current;
    if (pendingIntent !== null && pendingIntent.payload.displayName !== nextDisplayName.trim()) {
      pendingCreateRef.current = null;
    }
    setDisplayName(nextDisplayName);
  }, []);

  const handleCreate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submittingRef.current) {
        return;
      }

      const normalizedDisplayName = displayName.trim();
      const currentNameError = validateDisplayName(normalizedDisplayName);
      if (currentNameError !== null) {
        return;
      }

      const currentBridge = getProductionBridge();
      if (currentBridge === undefined) {
        setShellState({ kind: "create-failed", displayName: normalizedDisplayName, error: bridgeUnavailableError() });
        return;
      }

      submittingRef.current = true;
      setShellState({ kind: "creating", displayName: normalizedDisplayName });

      const pendingIntent = pendingCreateRef.current;
      const intent =
        pendingIntent !== null && pendingIntent.payload.displayName === normalizedDisplayName
          ? pendingIntent
          : createFixtureIntent(normalizedDisplayName);
      pendingCreateRef.current = intent;

      try {
        const result = await currentBridge.submitIntent(intent);
        if (result.ok) {
          pendingCreateRef.current = null;
          setShellState({ kind: "active", game: result.value.publicState });
        } else {
          setShellState({ kind: "create-failed", displayName: normalizedDisplayName, error: result.error });
        }
      } catch {
        setShellState({ kind: "create-failed", displayName: normalizedDisplayName, error: rendererFailureError() });
      } finally {
        submittingRef.current = false;
      }
    },
    [displayName],
  );

  return (
    <main className="app-shell">
      <div className="ambient-glow ambient-glow--one" aria-hidden="true" />
      <div className="ambient-glow ambient-glow--two" aria-hidden="true" />
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-kicker">贝克兰德纪闻</span>
          <h1>雾都纪事</h1>
          <p>从一名普通人的命运开始</p>
        </div>
        <div className="header-mark" aria-hidden="true">
          <span>✦</span>
        </div>
      </header>

      <div className="shell-content">
        {renderShellState({ shellState, displayName, nameError, handleNameChange, handleCreate })}
      </div>

      <footer className="app-footer">
        <span>雾都沉睡，命运仍在暗处转动</span>
        <span>每一次选择都会留下痕迹</span>
      </footer>
    </main>
  );
}

type ShellStateViewProps = {
  readonly shellState: ShellState;
  readonly displayName: string;
  readonly nameError: string | null;
  readonly handleNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly handleCreate: (event: FormEvent<HTMLFormElement>) => void;
};

function renderShellState({
  shellState,
  displayName,
  nameError,
  handleNameChange,
  handleCreate,
}: ShellStateViewProps) {
  switch (shellState.kind) {
    case "loading":
      return <LoadingState />;
    case "storage-unavailable":
      return <StorageUnavailableState error={shellState.error} />;
    case "no-run":
      return (
        <CreateRunState
          displayName={displayName}
          nameError={nameError}
          onNameChange={handleNameChange}
          onSubmit={handleCreate}
        />
      );
    case "creating":
      return <CreatingState displayName={shellState.displayName} />;
    case "create-failed":
      return (
        <CreateFailedState
          displayName={displayName}
          error={shellState.error}
          nameError={nameError}
          onNameChange={handleNameChange}
          onSubmit={handleCreate}
        />
      );
    case "active":
      return <ActiveRunState game={shellState.game} />;
  }
}

function LoadingState() {
  return (
    <section className="state-card state-card--loading" aria-labelledby="loading-title" role="status" aria-live="polite">
      <div className="state-symbol state-symbol--spinner" aria-hidden="true">
        ◌
      </div>
      <p className="eyebrow">雾中来信</p>
      <h2 id="loading-title">正在翻开卷宗</h2>
      <p className="state-copy">散落在雾中的记录正在归位。</p>
    </section>
  );
}

function StorageUnavailableState({ error }: { readonly error: PublicError }) {
  return (
    <section className="state-card state-card--danger" aria-labelledby="storage-title">
      <div className="state-symbol state-symbol--danger" aria-hidden="true">
        !
      </div>
      <p className="eyebrow eyebrow--danger">卷宗蒙尘</p>
      <h2 id="storage-title">卷宗暂时无法打开</h2>
      <p className="state-copy">记录没有成功载入，请稍后再试。</p>
      <div className="error-callout" role="alert">
        <p>{error.retryable ? "你可以稍后再次打开游戏。" : "请重新启动游戏后再试。"}</p>
      </div>
    </section>
  );
}

type CreateFormProps = {
  readonly displayName: string;
  readonly nameError: string | null;
  readonly onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly submitLabel?: string;
  readonly submitDisabled?: boolean;
};

function CreateForm({
  displayName,
  nameError,
  onNameChange,
  onSubmit,
  submitLabel = "开始新的旅程",
  submitDisabled = false,
}: CreateFormProps) {
  const nameErrorId = "display-name-error";
  const nameHintId = "display-name-hint";
  const describedBy = nameError === null ? nameHintId : `${nameHintId} ${nameErrorId}`;

  return (
    <form className="create-form" onSubmit={onSubmit} noValidate>
      <div className="field-group">
        <label htmlFor="display-name">姓名</label>
        <input
          id="display-name"
          name="displayName"
          type="text"
          value={displayName}
          onChange={onNameChange}
          autoComplete="off"
          maxLength={80}
          aria-invalid={nameError !== null}
          aria-describedby={describedBy}
          placeholder="输入一个名字"
        />
        <p className="field-hint" id={nameHintId}>
          这个名字将写在你的个人卷宗上。
        </p>
        {nameError !== null ? (
          <p className="field-error" id={nameErrorId} role="alert">
            {nameError}
          </p>
        ) : null}
      </div>
      <button className="primary-button" type="submit" disabled={submitDisabled || nameError !== null}>
        <span>{submitLabel}</span>
        <span className="button-arrow" aria-hidden="true">
          →
        </span>
      </button>
    </form>
  );
}

function CreateRunState({
  displayName,
  nameError,
  onNameChange,
  onSubmit,
}: Omit<CreateFormProps, "submitLabel" | "submitDisabled">) {
  return (
    <section className="state-card state-card--empty" aria-labelledby="no-run-title">
      <div className="state-symbol state-symbol--seal" aria-hidden="true">
        ◈
      </div>
      <p className="eyebrow">命运尚未落笔</p>
      <h2 id="no-run-title">在雾都写下你的名字</h2>
      <p className="state-copy">
        你将以一名普通人的身份踏入贝克兰德。故事尚未开始，但雾已经在等待。
      </p>
      <CreateForm
        displayName={displayName}
        nameError={nameError}
        onNameChange={onNameChange}
        onSubmit={onSubmit}
      />
    </section>
  );
}

function CreatingState({ displayName }: { readonly displayName: string }) {
  return (
    <section className="state-card state-card--loading" aria-labelledby="creating-title" role="status" aria-live="polite">
      <div className="state-symbol state-symbol--spinner" aria-hidden="true">
        ◌
      </div>
      <p className="eyebrow">命运落笔</p>
      <h2 id="creating-title">正在整理行装</h2>
      <p className="state-copy">正在为“{displayName}”准备旅程的第一周。</p>
      <div className="progress-line" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}

function CreateFailedState({
  displayName,
  error,
  nameError,
  onNameChange,
  onSubmit,
}: CreateFormProps & { readonly error: PublicError }) {
  return (
    <section className="state-card state-card--danger" aria-labelledby="create-failed-title">
      <div className="state-symbol state-symbol--danger" aria-hidden="true">
        ×
      </div>
      <p className="eyebrow eyebrow--danger">命运受阻</p>
      <h2 id="create-failed-title">旅程未能开始</h2>
      <p className="state-copy">“{displayName}”的卷宗没有成功建立，你可以再次尝试。</p>
      <div className="error-callout" role="alert">
        <p>{error.retryable ? "请确认名字后再次尝试。" : "请重新启动游戏后再试。"}</p>
      </div>
      <CreateForm
        displayName={displayName}
        nameError={nameError}
        onNameChange={onNameChange}
        onSubmit={onSubmit}
        submitLabel="重试创建"
        submitDisabled={!error.retryable}
      />
    </section>
  );
}

function ActiveRunState({ game }: { readonly game: PublicGameState }) {
  const { character } = game;

  return (
    <section className="active-run" aria-labelledby="active-run-title">
      <ActiveHeader game={game} />
      <StatusRail game={game} />

      <div className="dashboard-grid">
        <DossierPanel character={character} />
        <StagePanel game={game} />
      </div>

      <ActionSection />
    </section>
  );
}

function ActiveHeader({ game }: { readonly game: PublicGameState }) {
  const { character } = game;
  return (
    <div className="active-heading">
      <div>
        <p className="eyebrow">雾都纪事</p>
        <h2 id="active-run-title">第 {game.week} 周</h2>
        <p className="active-subtitle">
          {formatOrigin(character.origin)} · {formatSequence(character.sequence)}
        </p>
      </div>
      <div className="revision-stamp" aria-label={`卷宗页码 ${game.revision}`}>
        <span>卷宗页码</span>
        <strong>{game.revision}</strong>
      </div>
    </div>
  );
}

function StatusRail({ game }: { readonly game: PublicGameState }) {
  return (
    <div className="status-rail" aria-label="周状态">
      <Metric label="本周行动" value={`${game.availableActions} 次`} accent="amber" />
      <Metric label="现金" value={formatCashPence(game.cashPence)} accent="paper" />
      <Metric label="污染" value={`${game.character.resources.pollution} / 100`} accent="red" />
    </div>
  );
}

function PanelHeading({ index, label }: { readonly index: string; readonly label: string }) {
  return (
    <div className="panel-heading">
      <span className="panel-index">{index}</span>
      <span className="panel-label">{label}</span>
    </div>
  );
}

function DossierPanel({ character }: { readonly character: PublicGameState["character"] }) {
  return (
    <aside className="dossier-panel" aria-labelledby="dossier-title">
      <PanelHeading index="01" label="人物卷宗" />
      <h3 id="dossier-title">人物卷宗</h3>
      <DossierIdentity character={character} />
      <div className="dossier-divider" />
      <CoreStatsSection stats={character.coreStats} />
      <div className="dossier-divider" />
      <ResourceSection resources={character.resources} />
    </aside>
  );
}

function DossierIdentity({ character }: { readonly character: PublicGameState["character"] }) {
  return (
    <div className="identity-block">
      <div className="portrait-placeholder" aria-hidden="true">
        <span>◇</span>
      </div>
      <div>
        <strong>{character.displayName}</strong>
        <span>{formatSequence(character.sequence)}</span>
        <span>{formatOrigin(character.origin)}</span>
      </div>
    </div>
  );
}

function CoreStatsSection({ stats }: { readonly stats: PublicGameState["character"]["coreStats"] }) {
  return (
    <section aria-labelledby="core-stats-title">
      <div className="section-caption" id="core-stats-title">
        四项核心能力
      </div>
      <div className="core-stat-list">
        {CORE_STATS.map((stat) => (
          <div className="core-stat" key={stat.key}>
            <div>
              <span>{stat.label}</span>
              <small>{stat.hint}</small>
            </div>
            <strong>{stats[stat.key]}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResourceSection({ resources }: { readonly resources: PublicGameState["character"]["resources"] }) {
  return (
    <section aria-labelledby="resource-title">
      <div className="section-caption" id="resource-title">
        当前状态
      </div>
      <div className="resource-list">
        {RESOURCES.map((resource) => {
          const meter = resources[resource.key];
          return (
            <div className="resource-row" key={resource.key}>
              <span>{resource.label}</span>
              <strong>
                {meter.current} <em>/ {meter.max}</em>
              </strong>
            </div>
          );
        })}
        <div className="resource-row resource-row--pollution">
          <span>污染</span>
          <strong>{resources.pollution} <em>/ 100</em></strong>
        </div>
      </div>
    </section>
  );
}

function StagePanel({ game }: { readonly game: PublicGameState }) {
  return (
    <section className="stage-panel" aria-labelledby="stage-title">
      <PanelHeading index="02" label="本周纪事" />
      <div className="stage-heading-row">
        <div>
          <h3 id="stage-title">本周纪事</h3>
          <p>雾都的一切变化都会在这里留下痕迹。</p>
        </div>
        <span className="fixture-tag">命运记录</span>
      </div>
      <ChronicleCard chronicle={game.chronicle} />
      <FutureSection />
    </section>
  );
}

function ChronicleCard({ chronicle }: { readonly chronicle: PublicGameState["chronicle"] }) {
  return (
    <section className="chronicle-card" aria-labelledby="chronicle-title">
      <div className="section-caption" id="chronicle-title">
        纪事
      </div>
      {chronicle.length === 0 ? (
        <p className="empty-chronicle">这一周还没有新的记录。</p>
      ) : (
        <ol className="chronicle-list">
          {chronicle.map((entry) => (
            <li key={entry.id}>
              <span className="chronicle-week">第 {entry.week} 周</span>
              <div>
                <strong>{entry.id === "r1-fixture-created" ? "抵达贝克兰德" : entry.title}</strong>
                <p>
                  {entry.id === "r1-fixture-created"
                    ? "雾中的第一周已经开始，你的名字被写入了一份新卷宗。"
                    : entry.summary}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function FutureSection() {
  return (
    <section className="future-section" aria-labelledby="future-title">
      <div className="section-caption" id="future-title">
        雾中入口
      </div>
      <div className="future-grid">
        {FUTURE_ENTRIES.map((entry) => (
          <article className="future-card" key={entry.label}>
            <div className="future-card-mark" aria-hidden="true">
              •
            </div>
            <div>
              <h4>{entry.label}</h4>
              <p>{entry.detail}</p>
            </div>
            <span className="future-status">尚未解锁</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActionSection() {
  return (
    <section className="action-section" aria-labelledby="action-title">
      <div className="action-section-heading">
        <div>
          <PanelHeading index="03" label="行动安排" />
          <h3 id="action-title">日常行动</h3>
        </div>
        <p>旅程展开后，你可以在这里安排每周行动。</p>
      </div>
      <div className="action-dock">
        {DAILY_ACTIONS.map((action) => (
          <button className="action-placeholder" type="button" disabled key={action}>
            <span>{action}</span>
            <small>尚未解锁</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  readonly label: string;
  readonly value: string;
  readonly accent: "amber" | "paper" | "red";
}) {
  return (
    <div className={`metric metric--${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
