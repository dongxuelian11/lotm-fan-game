import { playerText } from "../shared/player-text.js";
import { useEffect, useId, useRef, useState } from "react";
import type { MiracleWorkerAction, MiracleWorkerCommand, MiracleWorkerProjection } from "../domain/miracle-worker/types";
import "./seer-styles.css";

const PREPARATION_TYPES = new Set(["MATERIAL_WORK", "BUY_MATERIALS", "BREW"]);
const REVIVAL_TYPES = new Set(["REVIVE_NEARBY", "WAIT_REVIVAL", "FORFEIT_REVIVAL"]);
const CONFIRMATIONS = {
  CONSUME: {
    title: "饮用这一瓶奇迹师魔药？", label: "奇迹师原瓶服用确认",
    cancel: "暂不饮药，留在当前现场", confirm: "确认饮用这一原瓶",
  },
  OPEN_PASSAGE: {
    title: "打开这一来源的永久真实通道？", label: "永久真实通道确认",
    cancel: "暂不开门，留在原锚", confirm: "确认打开这一原通道",
  },
  REVIVE_NEARBY: {
    title: "消耗账本次数，在原场就近复起？", label: "有限复起独立确认",
    cancel: "暂不复起，返回待决选择", confirm: "确认按上述成本就近复起",
  },
  FORFEIT_REVIVAL: {
    title: "放弃本次复起并最终封存？", label: "放弃复起与最终封存确认",
    cancel: "保留选择，返回待决页面", confirm: "确认放弃并最终封存",
  },
} as const;
type ConfirmationType = keyof typeof CONFIRMATIONS;
type Confirmation = { action: MiracleWorkerAction; projection: MiracleWorkerProjection; snapshot: string };
type Submission = { actionId: string; projection: MiracleWorkerProjection; snapshot: string };

export interface MiracleWorkerPanelProps {
  value: MiracleWorkerProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: MiracleWorkerCommand) => void | Promise<void>;
  /** Page navigation only. Leaving a real scene must use its projected command. */
  onClose?: () => void;
}

function Facts({ title, entries }: { title: string; entries: readonly string[] }) {
  return <section aria-label={title}><h4>{title}</h4>
    {entries.length ? <ul>{entries.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      : <p className="slice-muted">尚无已保存记录。</p>}
  </section>;
}

function confirmationType(action: MiracleWorkerAction): ConfirmationType | null {
  return Object.hasOwn(CONFIRMATIONS, action.command.type) ? action.command.type as ConfirmationType : null;
}

/** Presentation only: costs, qualifications, windows, risks and outcomes belong to the projection. */
export function MiracleWorkerPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: MiracleWorkerPanelProps) {
  const panelId = useId();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const submitted = useRef<Submission | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const snapshot = JSON.stringify(value);
  const failure = error ?? submitError;
  const locked = busy || blocked || failure !== null || submittedId !== null;
  const saving = (busy || submittedId !== null) && failure === null;
  const kind = confirmation ? confirmationType(confirmation.action) : null;
  const sameConfirmation = confirmation !== null && confirmation.projection === value && confirmation.snapshot === snapshot;
  const liveAction = sameConfirmation && confirmation
    ? value.actions.find(action => action.id === confirmation.action.id
      && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const { ritual, life, revival } = value;
  const source = ritual.sources.find(entry => entry.id === ritual.currentSourceId);
  const encounter = value.encounter.encounter;
  const atEncounter = !!encounter && encounter.location !== "RECEPTION" && encounter.leftRevision === null;
  const preparationActions = value.actions.filter(action => PREPARATION_TYPES.has(action.command.type));
  const lifeActions = value.actions.filter(action => action.id.startsWith("MW2-LIFE:"));
  const encounterActions = value.actions.filter(action => action.id.startsWith("MW2-ENCOUNTER:"));
  // Never construct a revival command or infer an entry from health/sequence/remaining allowance.
  const revivalActions = revival.pending ? value.actions.filter(action => REVIVAL_TYPES.has(action.command.type)) : [];
  const currentActions = value.actions.filter(action => !PREPARATION_TYPES.has(action.command.type)
    && !REVIVAL_TYPES.has(action.command.type) && !action.id.startsWith("MW2-LIFE:")
    && !action.id.startsWith("MW2-ENCOUNTER:"));
  const currentCase = life.cases.find(entry => entry.id === life.practice?.activeCase)
    ?? life.cases.find(entry => entry.id === selectedCaseId)
    ?? life.cases.find(entry => entry.status !== "RESOLVED") ?? life.cases[0];
  const currentLifeActions = lifeActions.filter(action => "caseId" in action.command
    ? action.command.caseId === currentCase?.id : action.command.type !== "REFLECT");
  const reflectionActions = lifeActions.filter(action => action.command.type === "REFLECT");

  useEffect(() => {
    const attempt = submitted.current;
    // A rerender or a cleared busy flag alone is not a save receipt. Keep the same-operation lock on errors.
    if (attempt && !busy && error === null && attempt.projection !== value && attempt.snapshot !== snapshot) {
      submitted.current = null; setSubmittedId(null); setSubmitError(null);
    }
    // Any replaced/changed projection invalidates an unsubmitted confirmation, even during a save.
    if (confirmation && !sameConfirmation) {
      setConfirmation(null);
      if (!attempt) setNotice("记录已更新，原确认已取消。请重新核对当前行动与条件。");
    }
  }, [value, snapshot, busy, error, confirmation, sameConfirmation]);

  useEffect(() => {
    if (!confirmation) {
      const id = returnActionId.current;
      if (id) {
        const button = actionButtons.current.get(id);
        (button && !button.disabled ? button : summaryHeading.current)?.focus();
        returnActionId.current = null;
      }
      return;
    }
    const node = dialog.current;
    if (!node) return;
    // Native modal semantics keep focus in the confirmation and the preserved page inert.
    if (!node.open) {
      try {
        if (typeof node.showModal === "function") node.showModal();
        else node.setAttribute("open", "");
      } catch { node.setAttribute("open", ""); }
    }
    confirmationHeading.current?.focus();
    return () => { if (node.open && typeof node.close === "function") node.close(); };
  }, [confirmation]);

  function submit(action: MiracleWorkerAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    // Only submit the currently projected action, not a captured command from an earlier dialog.
    const current = value.actions.find(entry => entry.id === action.id
      && JSON.stringify(entry.command) === JSON.stringify(action.command));
    if (!current?.enabled) return;
    const attempt: Submission = { actionId: current.id, projection: value, snapshot };
    submitted.current = attempt; setSubmittedId(current.id); setNotice(null);
    const failed = (reason: unknown) => {
      if (submitted.current !== attempt) return;
      setSubmitError(reason instanceof Error ? reason.message : "本次提交未取得保存回执。请查看主界面的保存错误。");
    };
    try {
      const result = onCommand(current.command);
      if (result) void result.catch(failed);
    } catch (reason) { failed(reason); }
  }

  function choose(action: MiracleWorkerAction) {
    if (locked || submitted.current !== null || confirmation || !action.enabled) return;
    setNotice(null);
    if (confirmationType(action)) {
      returnActionId.current = action.id;
      setConfirmation({ action, projection: value, snapshot });
    } else submit(action);
  }

  function dismissConfirmation() {
    // An errored dialog may close to expose the parent's retry control; the submission lock stays held.
    if (submitted.current !== null && failure === null) return;
    setConfirmation(null);
  }

  function actionList(actions: readonly MiracleWorkerAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => {
        const reasonId = `${panelId}-reason-${action.id}`;
        return <div className="seer-action warrior-compact-action" key={action.id}>
          <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
            ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
            aria-describedby={action.reason ? reasonId : locked ? `${panelId}-save-status` : undefined}
            onClick={() => choose(action)}>
            <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
          </button>
          {action.reason && <p className="seer-action-reason" id={reasonId}>{action.reason}</p>}
        </div>;
      })}
    </div>;
  }

  const saveStatus = <div id={`${panelId}-save-status`} aria-live="polite">
    {failure !== null && <p className="slice-notice" role="alert">
      {typeof failure === "string" ? failure : failure.message} 当前仍显示上次已保存记录。
      {typeof failure !== "string" && failure.retryable === false ? "请按错误提示重新加载。"
        : "请使用主界面保存错误处的重试，继续同一次原操作；不要重复付费、开门、饮药或消耗复起次数。"}
    </p>}
    {saving && <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p>}
    {blocked && <p className="seer-action-reason">当前提交被主界面锁定，请先处理主界面的结算或现场提示。</p>}
    {notice && <p className="slice-notice" role="status">{notice}</p>}
  </div>;

  const revivalCurrent = revival.current && <section aria-label="本次原死亡与有限重组"><h4>本次原死亡与有限重组</h4>
    <p>原死亡 {revival.current.deathId} · 同一本人 {revival.current.bodyId}</p>
    <p>原尸位：{revival.current.deathAt}。本次重组点：{revival.current.rebuildAt}。</p>
    <p>已过 {revival.current.elapsedSeconds} 游戏秒 · 窗口剩余 {revival.current.remainingSeconds} 游戏秒；
      本次重组需 {revival.current.reconstructionSeconds} 游戏秒。</p>
    <p>本次重组后健康 {revival.current.healthAfter} · 精神 {revival.current.mindAfter} · 灵性 {revival.current.spiritualityAfter}；
      原伤 {revival.current.existingInjuries} 项、累计风险 {revival.current.existingRisk}。</p>
    {!revival.current.canCompleteInTime && <p className="seer-action-reason">当前投影确认：已不能在本次窗口内完成重组。</p>}
  </section>;

  const encounterContent = encounter && <section aria-label="当代同一原人遭遇"><h4>{encounter.name}</h4>
    <p>原人 {encounter.targetId} · 本人位置 {encounter.location} · 遭遇状态 {encounter.status}</p>
    <p>对方健康 {encounter.enemyHealth} · 精神 {encounter.enemyMind} · 灵性 {encounter.enemySpirituality}；
      {encounter.enemyStatus === "DEAD" ? "已经真实死亡" : encounter.enemyStatus === "SURRENDERED" ? "已经停止抵抗" : "仍有独立意志"}。</p>
    <p>普通出口：{encounter.originalExit} · 双方相隔 {encounter.distanceMetres} 米。</p>
    <Facts title="原敌、原器材与当前去向" entries={encounter.facts} />
    {!revival.pending && actionList(encounterActions, "同一原场可选遭遇行动")}
    <details className="seer-fold"><summary>原人来历、有限能力与真实结局</summary>
      <p>{encounter.story}</p>
      {encounter.abilities.map(ability => <p key={ability.id}>{ability.label} · 灵性成本 {ability.cost} ·
        自方贡献 {ability.selfGain} · 对方减势 {ability.enemyReduction} · {ability.available ? "当前可用" : "当前不可用"}</p>)}
      {encounter.terminal && <p>原终局：{encounter.terminal.outcome} ·
        原身体记录 {encounter.terminal.playerBodyAt} · 自有原物记录 {encounter.terminal.playerOriginalsAt} ·
        原敌武器 {encounter.terminal.enemyWeaponAt}。</p>}
    </details>
  </section>;

  const lifeContent = life.cases.length > 0 && <section aria-label="奇迹师三项生活实践"><h4>当代生活与有限奇迹</h4>
    <label className="seer-case-selector" htmlFor={`${panelId}-case`}>查看生活案
      <select id={`${panelId}-case`} value={currentCase?.id ?? ""}
        disabled={life.insideCase || saving || confirmation !== null}
        onChange={event => setSelectedCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}
      </select>
    </label>
    {currentCase && <article className="seer-current-case" aria-label="当前奇迹师生活案">
      <h4>{currentCase.title}</h4><p>{currentCase.story}</p>
      {currentCase.preparation && <p>{currentCase.preparation}</p>}
      {currentCase.result && <p className="slice-notice">{currentCase.result}</p>}
      <p>{currentCase.contactOpen} · 实际收束 {currentCase.closes} 次</p>
      {currentCase.observations.length > 0 && <details className="seer-fold"><summary>本案亲见来源与限制</summary>
        <Facts title="本案实际观察" entries={currentCase.observations} />
      </details>}
    </article>}
    {life.insideCase && life.practice && <Facts title="当前愿望、原物与资源" entries={life.practice.facts} />}
    {!revival.pending && actionList(currentLifeActions, "当前奇迹师生活案行动")}
    <details className="seer-fold"><summary>三案记录、同类愿望与反思</summary>
      {life.cases.filter(entry => entry.id !== currentCase?.id).map(entry => <article key={entry.id}>
        <h4>{entry.title}</h4><p>{entry.story}</p><p>{entry.result ?? "尚无本案实际结果。"}</p>
        <p>{entry.contactOpen} · 实际收束 {entry.closes} 次</p>
      </article>)}
      {life.practice && <>
        {!life.insideCase && <Facts title="已保存的愿望与资源" entries={life.practice.facts} />}
        <Facts title="同一原物交接与冷却记录" entries={life.practice.items.map(item =>
          `${item.id} · 原主人${item.ownerId} · 当前持有${item.holder} · 实际处理步骤${item.step} · 交接${item.handovers}次 · 主人确认${item.confirmedSecond === null ? "尚未发生" : `${item.confirmedSecond}游戏秒`} · 同类愿望禁用至${item.similarWishBlockedUntil === null ? "尚无记录" : `${item.similarWishBlockedUntil}游戏秒`}`)} />
        {life.practice.scene.image && <p>当前同一影像 {life.practice.scene.image.id} ·
          原来源 {life.practice.scene.image.sourceId} · 剩余 {life.practice.scene.image.remainingSeconds} 游戏秒。</p>}
      </>}
      <p>{life.environment}</p>
      {!revival.pending && actionList(reflectionActions, "三案完成后的反思")}
    </details>
  </section>;

  return <section className="seer-panel warrior-panel miracle-worker-panel" aria-label="奇迹师" aria-busy={saving}>
    <div className="seer-panel" aria-hidden={confirmation !== null ? true : undefined}>
      <section className="seer-summary" aria-label="奇迹师当前处境">
        <h3 ref={summaryHeading} tabIndex={-1}>{revival.pending ? revival.title : value.title}</h3>
        <p className="seer-next">{revival.pending ? revival.supportedScope : value.environment}</p>
        {value.promoted && <p>扮演 {value.acting} · {value.digestion}</p>}
        {revival.bodyLocation && <p>本人当前身体位置：{revival.bodyLocation}</p>}
        {value.insideCase && <p className="slice-muted">关闭本页不会收束现场。归还、停止、沿路离场或复起选择须提交对应行动。</p>}
      </section>
      {confirmation === null && saveStatus}

      {revival.pending ? <section className="slice-notice seer-risk" aria-label="有限复起待决选择">
        <h4>本次死亡之后，由你独立选择</h4>
        <p>总额度 {revival.allowance} · 已实际使用 {revival.used} · 剩余 {revival.remaining}</p>
        {revivalCurrent}<p>{revival.boundary}</p>
        {actionList(revivalActions, "复起、等待或最终封存")}
        {revivalActions.length === 0 && <p className="seer-action-reason">当前已保存投影没有可提交的待决命令，请查看主界面状态。</p>}
        <details className="seer-fold"><summary>原死亡证据与复起规则</summary>
          <p>{revival.source}</p><Facts title="本次真实后果" entries={revival.facts} />
        </details>
      </section> : <>
        {life.insideCase && lifeContent}
        {atEncounter && encounterContent}
        <section aria-label="奇迹师当前行动"><h4>{ritual.insideCase ? "当前原聚落的下一步" : "接待处与真实准备"}</h4>
          {source && <><h4>{source.name}</h4><Facts title="当前原瓶、真实回归与药窗" entries={source.facts} /></>}
          {currentActions.length > 0 ? actionList(currentActions, "奇迹师当前公开行动")
            : <p className="slice-muted">当前没有这一组可提交的行动，请查看当前现场与已保存条件。</p>}
        </section>
        {preparationActions.length > 0 && <details className="seer-fold"><summary>独立原料与实际调配 · {preparationActions.length} 项</summary>
          <p>{value.supplies}</p>{actionList(preparationActions, "奇迹师原料与调配")}
        </details>}
        {!life.insideCase && !atEncounter && !ritual.insideCase && lifeContent}
      </>}

      {(revival.pending || atEncounter || ritual.insideCase) && !life.insideCase && lifeContent &&
        <details className="seer-fold"><summary>三项生活案与已经保存的进度</summary>{lifeContent}</details>}
      {encounter && (revival.pending || !atEncounter) && <details className="seer-fold">
        <summary>{revival.pending ? "原敌与原场结局" : "原人遭遇与当代器材（可选）"}</summary>{encounterContent}
      </details>}

      <details className="seer-fold"><summary>真实聚落、现生居民、原物与实际路线</summary>
        <p>{ritual.summary}</p><p>{ritual.boundary}</p>
        <Facts title="固定普通路段" entries={ritual.routes} />
        <Facts title="本人及居民实际走过的路" entries={ritual.journeys} />
        {ritual.sources.map(entry => <details className="seer-fold" key={entry.id}>
          <summary>{entry.name}{entry.id === ritual.currentSourceId ? " · 当前来源" : ""}</summary>
          <Facts title={`${entry.name}的回归、药窗与原瓶`} entries={entry.facts} />
          <Facts title={`${entry.name}的当前原居民与同意`} entries={entry.residents} />
          <Facts title={`${entry.name}的同一原物去向`} entries={entry.originals} />
          <Facts title={`${entry.name}的实际经过`} entries={entry.history} />
        </details>)}
        <p>{ritual.ordinaryLife}</p>
      </details>
      <details className="seer-fold"><summary>{playerText("完整配方、原瓶与晋升风险")}</summary>
        <p>{value.story}</p>
        {value.formulaKnown ? <section aria-label="奇迹师完整配方"><h4>已知完整方</h4>
          <ul>{value.formula.map(item => <li key={item.name}>{item.name} · {item.quantity}{item.unit}{item.note && `；${item.note}`}</li>)}</ul>
        </section> : <p>当前尚未取得完整方，请按公开行动学习。</p>}
        <p>{value.supplies}</p><p className="slice-notice seer-risk">{value.risk}</p><p>{value.boundary}</p>
      </details>
      {(value.promoted || revival.history.length > 0 || revival.pending) && <details className="seer-fold">
        <summary>有限复起账本 · 已用 {revival.used}/{revival.allowance} · 余 {revival.remaining}</summary>
        <h4>{revival.title}</h4><p>{revival.source}</p><p>{revival.supportedScope}</p><p>{revival.boundary}</p>
        <Facts title="有限复起的实际记录" entries={revival.history} /><Facts title="复起边界与原物保护" entries={revival.facts} />
      </details>}
      {value.abilities.length > 0 && <details className="seer-fold"><summary>有限能力与掌握</summary>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      </details>}
      {onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null}
        onClick={() => { if (!locked && !confirmation) onClose(); }}>关闭奇迹师页面</button>}
    </div>

    {confirmation && kind && <dialog ref={dialog} className="seer-panel seer-confirmation miracle-worker-confirmation"
      aria-modal="true" aria-labelledby={`${panelId}-confirm-title`} aria-describedby={`${panelId}-confirm-cost`}
      aria-label={CONFIRMATIONS[kind].label} aria-busy={saving}
      style={{ position: "fixed", inset: "1rem", margin: "auto", width: "min(52rem, calc(100vw - 2rem))", maxHeight: "calc(100dvh - 2rem)",
        overflowY: "auto", padding: "24px", background: "var(--slice-paper-light)", color: "var(--slice-ink)", border: "1px solid var(--slice-line)", zIndex: 1000 }}
      onCancel={event => { event.preventDefault(); dismissConfirmation(); }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismissConfirmation(); return; }
        if (event.key !== "Tab") return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), summary, a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]',
        )).filter(node => node.getClientRects().length > 0);
        const first = focusable[0], last = focusable.at(-1);
        if (!first || !last) { event.preventDefault(); confirmationHeading.current?.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <h3 ref={confirmationHeading} id={`${panelId}-confirm-title`} tabIndex={-1}>{CONFIRMATIONS[kind].title}</h3>
      <p id={`${panelId}-confirm-cost`}><strong>本次实际成本：</strong>{liveAction?.cost ?? confirmation.action.cost}</p>
      {(kind === "CONSUME" || kind === "OPEN_PASSAGE") && <>
        <p>{ritual.summary}</p><p className="slice-notice seer-risk">{kind === "CONSUME" ? value.risk : ritual.boundary}</p>
        {confirmation.action.command.type === "CONSUME" && <p>所选同一原瓶：{confirmation.action.command.bottleId}</p>}
        {source && <Facts title="这一来源的原瓶、回归与药窗" entries={source.facts} />}
        <p>{value.boundary}</p>
        {kind === "OPEN_PASSAGE" && <Facts title="本次原普通路线" entries={ritual.routes} />}
        <details className="seer-fold"><summary>当下原人、原物与来源</summary>
          {source && <><Facts title="当下原居民" entries={source.residents} /><Facts title="当下原物" entries={source.originals} /></>}
          <p>{value.story}</p><p>{value.supplies}</p>
        </details>
      </>}
      {(kind === "REVIVE_NEARBY" || kind === "FORFEIT_REVIVAL") && <>
        <p>累计已用 {revival.used}/{revival.allowance} · 剩余 {revival.remaining}</p>
        {kind === "REVIVE_NEARBY" ? revivalCurrent : revival.current && <>
          <p>原死亡：{revival.current.deathId} · 同一本人 {revival.current.bodyId} · 原尸位 {revival.current.deathAt}。</p>
          <p className="slice-notice seer-risk">将按上方所列成本放弃本次机会，最终封存本周目。</p>
        </>}
        <p className="slice-notice seer-risk">{revival.boundary}</p>
        <Facts title="这一死亡之后的真实后果" entries={revival.facts} />
        <p>{revival.source}</p>
      </>}
      {!liveAction && <p className="seer-action-reason">本次确认已失效，请返回当前记录重新选择。</p>}
      {liveAction?.reason && <p className="seer-action-reason">{liveAction.reason}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={submittedId !== null && failure === null} onClick={dismissConfirmation}>
          {failure !== null && submittedId !== null ? "关闭确认，查看保存错误" : CONFIRMATIONS[kind].cancel}
        </button>
        <button className="slice-button" disabled={locked || !liveAction?.enabled}
          onClick={() => { if (liveAction && sameConfirmation) submit(liveAction); }}>{CONFIRMATIONS[kind].confirm}</button>
      </div>
      <p className="slice-muted">取消只关闭尚未提交的确认；不会替你离场或推进现场。提交后等待同一次保存回执。</p>
      {saveStatus}
    </dialog>}
  </section>;
}
