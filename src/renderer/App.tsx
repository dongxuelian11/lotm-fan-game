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
  { label: "黑市", detail: "R4 · 交易与风险" },
  { label: "季度拍卖", detail: "R4 · 每三个月开放" },
  { label: "事件卡", detail: "R3 · 阻塞卡与纪事" },
  { label: "战斗转盘", detail: "R5 · 战斗与生存" },
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
    "生产 bridge 不可用：window.mysteryGame 未注入。未启用 mock 回退。",
    false,
  );
}

function rendererFailureError(): PublicError {
  return makePublicError(
    "INTERNAL_ERROR",
    "无法读取公开存储状态。请稍后重试。",
    true,
  );
}

function invalidBootstrapError(): PublicError {
  return makePublicError(
    "SCHEMA_INVALID",
    "公开存储状态无效，已停止渲染。",
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
    return "名字不能超过 80 个 UTF-16 code units。";
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
          <span className="brand-kicker">R1 / 工程 fixture</span>
          <h1>雾都纪事</h1>
          <p>一份从普通人开始的公开卷宗</p>
        </div>
        <div className="header-mark" aria-hidden="true">
          <span>✦</span>
        </div>
      </header>

      <div className="shell-content">
        {renderShellState({ shellState, displayName, nameError, handleNameChange, handleCreate })}
      </div>

      <footer className="app-footer">
        <span>本地桌面 · 权威状态由 Main / SQLite 管理</span>
        <span>公开投影 · {CONTRACT_VERSION}</span>
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
      <p className="eyebrow">正在建立连接</p>
      <h2 id="loading-title">正在读取公开状态</h2>
      <p className="state-copy">正在向本地权威存储请求启动投影。</p>
    </section>
  );
}

function StorageUnavailableState({ error }: { readonly error: PublicError }) {
  return (
    <section className="state-card state-card--danger" aria-labelledby="storage-title">
      <div className="state-symbol state-symbol--danger" aria-hidden="true">
        !
      </div>
      <p className="eyebrow eyebrow--danger">安全停止</p>
      <h2 id="storage-title">存储不可用</h2>
      <p className="state-copy">没有获得可信的公开状态，因此没有载入或创建本地周目。</p>
      <div className="error-callout" role="alert">
        <code>{error.code}</code>
        <p>{error.message}</p>
      </div>
      <p className="state-note">Renderer 不会静默回退到 mock；请由桌面端提供 window.mysteryGame。</p>
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
  submitLabel = "创建 R1 工程周目",
  submitDisabled = false,
}: CreateFormProps) {
  const nameErrorId = "display-name-error";
  const nameHintId = "display-name-hint";
  const describedBy = nameError === null ? nameHintId : `${nameHintId} ${nameErrorId}`;

  return (
    <form className="create-form" onSubmit={onSubmit} noValidate>
      <div className="field-group">
        <label htmlFor="display-name">卷宗显示名</label>
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
          只用于这份工程 fixture 的公开显示。
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
      <p className="eyebrow">没有可恢复周目</p>
      <h2 id="no-run-title">从一份工程卷宗开始</h2>
      <p className="state-copy">
        这会创建 R1 的普通人第一周 fixture，仅用于验证公开投影、窄 bridge 与持久化回执；它不是正式捏人、职业、特质或经济开局。
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
      <p className="eyebrow">正在提交</p>
      <h2 id="creating-title">正在创建 R1 工程周目</h2>
      <p className="state-copy">正在为“{displayName}”请求一次性权威回执，请勿重复提交。</p>
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
      <p className="eyebrow eyebrow--danger">提交未完成</p>
      <h2 id="create-failed-title">创建失败</h2>
      <p className="state-copy">“{displayName}”没有进入活动周目，权威状态未被前端假定改变。</p>
      <div className="error-callout" role="alert">
        <code>{error.code}</code>
        <p>{error.message}</p>
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
        <p className="eyebrow">活动周目 / R1 工程 fixture</p>
        <h2 id="active-run-title">第 {game.week} 周</h2>
        <p className="active-subtitle">
          {formatOrigin(character.origin)} · {formatSequence(character.sequence)} · 公开状态视图
        </p>
      </div>
      <div className="revision-stamp" aria-label={`当前状态修订号 ${game.revision}`}>
        <span>状态修订</span>
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
      <PanelHeading index="01" label="PERSONAL DOSSIER" />
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
      <PanelHeading index="02" label="WEEKLY STAGE" />
      <div className="stage-heading-row">
        <div>
          <h3 id="stage-title">本周周舞台</h3>
          <p>当前只展示 Main 返回的公开投影。</p>
        </div>
        <span className="fixture-tag">FIXTURE / READ ONLY VIEW</span>
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
        最小纪事
      </div>
      {chronicle.length === 0 ? (
        <p className="empty-chronicle">暂无公开纪事。</p>
      ) : (
        <ol className="chronicle-list">
          {chronicle.map((entry) => (
            <li key={entry.id}>
              <span className="chronicle-week">第 {entry.week} 周</span>
              <div>
                <strong>{entry.title}</strong>
                <p>{entry.summary}</p>
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
        后续轮次承载
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
            <span className="future-status">未开放</span>
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
          <PanelHeading index="03" label="DAILY ACTION DOCK" />
          <h3 id="action-title">日常行动</h3>
        </div>
        <p>R2 起开放；本轮不触发伪逻辑。</p>
      </div>
      <div className="action-dock">
        {DAILY_ACTIONS.map((action) => (
          <button className="action-placeholder" type="button" disabled key={action}>
            <span>{action}</span>
            <small>后续轮次开放</small>
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
