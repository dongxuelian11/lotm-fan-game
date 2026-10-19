import { useEffect, useRef, useState } from "react";
import type { SavantAction, SavantCommand, SavantProjection } from "../domain/savant/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const PROJECT_STATUS: Record<string, string> = {
  UNREAD: "尚未学习",
  LEARNED: "已学图纸，等待制作",
  READY: "成品待交付",
  DELIVERED: "已交付",
};

interface SavantPanelProps {
  savant: SavantProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: SavantCommand) => void;
}

/** Render only public plans, original bottles and available commands; no rules or stock live here. */
export function SavantPanel({ savant, resources, busy, blocked, onCommand }: SavantPanelProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = savant.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = savant.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const projectActions = savant.actions.filter((action) => "projectId" in action.command);
  const selectedProject = savant.projects.find((project) => project.id === selectedProjectId)
    ?? savant.projects.find((project) => projectActions.some((action) => "projectId" in action.command && action.command.projectId === project.id))
    ?? savant.projects[0];
  const selectedProjectActions = projectActions.filter((action) => "projectId" in action.command
    && action.command.projectId === selectedProject?.id);
  const actions = savant.actions.filter((action) => action.command.type !== "CONSUME" && !("projectId" in action.command));
  const nextAction = savant.promoted
    ? selectedProjectActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedProjectActions[0] ?? actions[0]
    : savant.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !savant.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || savant.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, savant.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SavantAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || savant.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: SavantAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => onCommand(action.command)}
          aria-describedby={action.reason ? `savant-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`savant-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel savant-panel seer-confirmation" aria-label="这瓶通识者魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="通识者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{savant.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{savant.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="savant-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "savant-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel savant-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="通识者成长下一步">
        <span className="seer-seal">{savant.promoted ? "序列 9" : "通识者成长卷宗"}</span>
        <h3>{savant.title}</h3>
        {nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{savant.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{savant.digestion}</p>
        {!savant.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
      </section>

      {selectedProject && (
        <section aria-label="通识者工坊委托">
          <h3>学习与实践</h3>
          <label className="seer-case-selector">
            选择工坊委托
            <select value={selectedProject.id} disabled={busy || blocked} onChange={(event) => setSelectedProjectId(event.target.value)}>
              {savant.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前工坊委托">
            <h4>{selectedProject.title}</h4>
            <p>{selectedProject.story}</p>
            <dl className="seer-facts">
              <div><dt>委托状态</dt><dd>{PROJECT_STATUS[selectedProject.status] ?? selectedProject.status}</dd></div>
              <div><dt>实际材料</dt><dd>{selectedProject.materials}</dd></div>
              <div><dt>借用工具</dt><dd>{selectedProject.tool}</dd></div>
            </dl>
            {selectedProject.plan && <section className="seer-fold" aria-label="已经学过的工序"><h4>已经学过的工序</h4><p>{selectedProject.plan}</p></section>}
            {selectedProjectActions.length > 0 && (
              <div className="seer-actions seer-reflection" role="group" aria-label="当前工坊行动">{selectedProjectActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="通识者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {savant.story && <p className="slice-muted">{savant.story}</p>}

      {savant.discovered && savant.supplies && <p className="slice-notice">{savant.supplies}</p>}
      {savant.discovered && savant.bottles.length > 0 && (
        <details className="seer-fold savant-bottles" open={!savant.promoted}>
          <summary>工坊的独立成品原瓶 · 来源与去向</summary>
          {savant.bottles.map((bottle) => {
            const action = savant.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !savant.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !savant.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `savant-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`savant-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {savant.discovered && !savant.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{savant.risk}</p></details>}
      {savant.promoted && (
        <section className="savant-abilities" aria-label="通识者能力与消化">
          <h3>能力与消化 · {savant.abilities.length} 项能力</h3>
          <p>扮演进度 {savant.acting} · 消化：{savant.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {savant.pollution}</p>
          {savant.abilities.map((ability) => (
            <details className="seer-fold" key={ability.id}>
              <summary>{ability.label} · 掌握 {ability.mastery}</summary>
              <p>{ability.description}</p>
            </details>
          ))}
        </section>
      )}
      {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    </div>
  );
}
