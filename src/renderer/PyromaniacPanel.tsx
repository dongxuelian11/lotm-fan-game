import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PyromaniacAction, PyromaniacCommand, PyromaniacProjection } from "../domain/pyromaniac/types";
import type { HunterProjection } from "../domain/hunter/types";
import type { ProvokerProjection } from "../domain/provoker/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

interface PyromaniacPanelProps {
  pyromaniac: PyromaniacProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: PyromaniacCommand) => void;
}

/** Old originals and mastered abilities stay readable, without reopening earlier growth. */
function HunterPathwayRecords({ pathway, name }: { pathway: HunterProjection | ProvokerProjection; name: string }) {
  return <>
    {pathway.bottles.length > 0 && <details className="seer-fold">
      <summary>{name}原瓶 · 来源与去向</summary>
      {pathway.bottles.map((bottle) => <article className="pyromaniac-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {pathway.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的{name}能力</summary>
      {pathway.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </>;
}

export function HunterHistory({ hunter }: { hunter: HunterProjection }) {
  return <section className="seer-panel" aria-label="猎人时期的经历">
    <h3>猎人时期的经历</h3>
    <p className="slice-notice">这里保留猎人时期的货道、原瓶与能力记录。当前实践请回到纵火家卷宗。</p>
    <p>猎人扮演进度 {hunter.acting} · {hunter.digestion}</p>
    {hunter.story && <section aria-label="猎人货道历史"><p>{hunter.story}</p></section>}
    <details className="seer-fold"><summary>原陷阱库存记录</summary>
      <dl className="seer-facts">
        <div><dt>店内剩余</dt><dd>{hunter.trapStock} 套</dd></div>
        <div><dt>随身持有</dt><dd>{hunter.trapHeld} 套</dd></div>
        <div><dt>已布置</dt><dd>{hunter.trapDeployed} 套</dd></div>
        <div><dt>已耗用</dt><dd>{hunter.trapSpent} 套</dd></div>
      </dl>
    </details>
    <HunterPathwayRecords pathway={hunter} name="猎人" />
  </section>;
}

export function ProvokerHistory({ provoker }: { provoker: ProvokerProjection }) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const selectedCase = provoker.cases.find((entry) => entry.id === selectedCaseId) ?? provoker.cases[0];
  return <section className="seer-panel" aria-label="挑衅者时期的经历">
    <h3>挑衅者时期的经历</h3>
    <p className="slice-notice">挑衅者时期的观察、应对与原瓶仍可查阅。当前实践请回到纵火家卷宗。</p>
    <p>挑衅者扮演进度 {provoker.acting} · {provoker.digestion}</p>
    {selectedCase && <section aria-label="挑衅者情境历史">
      <label className="seer-case-selector">查看旧情境
        <select value={selectedCase.id} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {provoker.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
        </select>
      </label>
      <article className="seer-current-case"><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p></article>
    </section>}
    {provoker.story && <details className="seer-fold"><summary>原货栈争议记录</summary><p>{provoker.story}</p></details>}
    <HunterPathwayRecords pathway={provoker} name="挑衅者" />
  </section>;
}

const ENCOUNTER_COMMANDS = ["SURVEY_ENCOUNTER", "CLEAR_LANE", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"];

/** All costs, environmental facts, availability and results come from the committed projection. */
export function PyromaniacPanel({ pyromaniac, resources, busy, blocked, onCommand }: PyromaniacPanelProps) {
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = pyromaniac.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = pyromaniac.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const practiceActions = pyromaniac.actions.filter((action) => action.command.type === "PRACTICE");
  const sceneActions = pyromaniac.actions.filter((action) => ENCOUNTER_COMMANDS.includes(action.command.type));
  const sceneHasRecord = pyromaniac.practices.some((practice) => practice.id === "pyromaniac-dispute");
  const actionsForPractice = (id: string) => id === "pyromaniac-dispute" ? sceneActions
    : practiceActions.filter((action) => action.command.type === "PRACTICE" && action.command.practiceId === id);
  const selectedPractice = pyromaniac.practices.find((practice) => practice.id === selectedPracticeId)
    ?? pyromaniac.practices.find((practice) => actionsForPractice(practice.id).some((action) => action.enabled))
    ?? pyromaniac.practices[0];
  const selectedPracticeActions = selectedPractice ? actionsForPractice(selectedPractice.id) : [];
  const remainingActions = pyromaniac.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "PRACTICE" && !ENCOUNTER_COMMANDS.includes(action.command.type));
  const nextAction = pyromaniac.promoted
    ? selectedPracticeActions.find((action) => action.enabled) ?? remainingActions.find((action) => action.enabled)
      ?? selectedPracticeActions[0] ?? remainingActions[0]
    : pyromaniac.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? remainingActions.find((action) => action.enabled) ?? remainingActions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !pyromaniac.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || pyromaniac.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, pyromaniac.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: PyromaniacAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || pyromaniac.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }
  function actionButton(action: PyromaniacAction) {
    return <div className="seer-action pyromaniac-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || blocked || !action.enabled}
        onClick={() => onCommand(action.command)} aria-describedby={action.reason ? `pyromaniac-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`pyromaniac-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }

  if (confirming && selectedBottle && selectedAction) return (
    <section className="seer-panel pyromaniac-panel seer-confirmation" aria-label="这瓶纵火家魔药的服用确认" aria-busy={busy}>
      <div className="slice-eyebrow">服用前，请再确认一次</div>
      <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
      <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
      <dl className="seer-facts">
        <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
        <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
        <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
        <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
      </dl>
      <section className="slice-notice seer-risk" aria-label="纵火家服用风险与四档结果">
        <strong>服用风险与四档结果</strong><p>{pyromaniac.risk}</p>
      </section>
      <section aria-label="服药前当前资源" className="seer-current-resources">
        <h4>你现在的状态</h4>
        <dl className="seer-facts">
          <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
          <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
          <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
          <div><dt>污染</dt><dd>{pyromaniac.pollution}</dd></div>
          <div><dt>现金</dt><dd>{resources.cash}</dd></div>
          <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
        </dl>
      </section>
      {selectedAction.reason && <p className="seer-action-reason" id="pyromaniac-confirm-reason">{selectedAction.reason}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
        <button className="slice-button" disabled={confirmationLocked || !selectedAction.enabled} onClick={confirmBottle}
          aria-describedby={selectedAction.reason ? "pyromaniac-confirm-reason" : undefined}>
          {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
        </button>
      </div>
      <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
    </section>
  );

  const bottleRecords = pyromaniac.bottles.map((bottle) => {
    const action = !pyromaniac.promoted ? pyromaniac.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id) : undefined;
    return <article className="seer-bottle" key={bottle.id}>
      <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
      {action && <div>
        <button className="slice-button" disabled={busy || blocked || !action.enabled}
          ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
          onClick={() => openBottle(action)} aria-describedby={action.reason ? `pyromaniac-bottle-${bottle.id}` : undefined}>
          查看并准备服用「{bottle.title}」
        </button>
        <p className="seer-small-note">{action.cost}</p>
        {action.reason && <p className="seer-action-reason" id={`pyromaniac-bottle-${bottle.id}`}>{action.reason}</p>}
      </div>}
    </article>;
  });

  return <div className="seer-panel pyromaniac-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="纵火家成长下一步">
      <span className="seer-seal">{pyromaniac.promoted ? "序列 7" : "纵火家晋升准备"}</span>
      <h3>{pyromaniac.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{pyromaniac.promoted ? `扮演进度 ${pyromaniac.acting} · ${pyromaniac.digestion}` : pyromaniac.digestion}</p>
    </section>

    {pyromaniac.promoted && selectedPractice && <section aria-label="纵火家实践">
      <label className="seer-case-selector">选择一次实践
        <select value={selectedPractice.id} disabled={busy || blocked} onChange={(event) => setSelectedPracticeId(event.target.value)}>
          {pyromaniac.practices.map((practice) => <option key={practice.id} value={practice.id}>{practice.title} · {practice.status}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前纵火家实践">
        <h3>{selectedPractice.title}</h3><p className="slice-muted">{selectedPractice.status}</p><p>{selectedPractice.story}</p>
        {selectedPractice.id === "pyromaniac-dispute" && pyromaniac.environment && <section className="slice-notice" aria-label="当前纵火家现场环境">
          <h4>现场与射线</h4><p>{pyromaniac.environment}</p>
        </section>}
        <div className="pyromaniac-action-list" role="group" aria-label="当前实践行动">{selectedPracticeActions.map(actionButton)}</div>
      </section>
    </section>}
    {pyromaniac.promoted && !sceneHasRecord && (pyromaniac.environment || sceneActions.length > 0) && <section aria-label="当前纵火家现场环境">
      <h4>现场与射线</h4>{pyromaniac.environment && <p>{pyromaniac.environment}</p>}
      <div className="pyromaniac-action-list" role="group" aria-label="纵火家现场行动">{sceneActions.map(actionButton)}</div>
    </section>}
    {remainingActions.length > 0 && <section aria-label={pyromaniac.promoted ? "纵火家成长行动" : "纵火家成品药渠道"}>
      {!pyromaniac.promoted && <h4>成品药与准备</h4>}
      <div className="seer-actions">{remainingActions.map(actionButton)}</div>
    </section>}
    {pyromaniac.discovered && !pyromaniac.promoted && <section aria-label="纵火家供货说明">
      {pyromaniac.supplies && <p className="slice-notice">{pyromaniac.supplies}</p>}
      <p className="slice-muted">{playerText("取得原瓶与确认服用是两个独立步骤，完整配方尚未公开。")}</p>
    </section>}
    {pyromaniac.discovered && pyromaniac.bottles.length > 0 && (pyromaniac.promoted
      ? <details className="seer-fold"><summary>纵火家原瓶 · 来源与去向</summary>{bottleRecords}</details>
      : <section className="seer-bottles" aria-label="纵火家独立原瓶"><h3>纵火家独立原瓶</h3>{bottleRecords}</section>)}
    {pyromaniac.discovered && !pyromaniac.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{pyromaniac.risk}</p></details>}
    {pyromaniac.promoted && <details className="seer-fold" aria-label="纵火家能力与消化">
      <summary>能力与消化 · {pyromaniac.abilities.length} 项能力</summary>
      <p>灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {pyromaniac.pollution}</p>
      {pyromaniac.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </details>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
  </div>;
}
