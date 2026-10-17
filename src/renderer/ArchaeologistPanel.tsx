import { useEffect, useRef, useState } from "react";
import type { ArchaeologistAction, ArchaeologistCommand, ArchaeologistProjection } from "../domain/archaeologist/types";
import type { SavantProjection } from "../domain/savant/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const SITE_STATUS: Record<string, string> = {
  AVAILABLE: "等待许可与现场勘察",
  SURVEYED: "已有现场记录，等待核实",
  RESOLVED: "探索记录已核实交付",
};
const PROJECT_STATUS: Record<string, string> = {
  UNREAD: "尚未学习",
  LEARNED: "已学图纸，等待制作",
  READY: "成品待交付",
  DELIVERED: "已交付",
};

interface ArchaeologistPanelProps {
  archaeologist: ArchaeologistProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: ArchaeologistCommand) => void;
}

/** Preserve prior-sequence records without offering actions from the former growth stage. */
export function SavantHistory({ savant }: { savant: SavantProjection }) {
  return (
    <section className="seer-panel savant-panel" aria-label="通识者时期的经历">
      <h3>通识者时期的经历</h3>
      <p className="slice-notice">你已晋升考古学家。这里保留通识者时期的工坊委托、已学工序与原瓶记录；继续实践请回到考古学家卷宗。</p>
      <p>通识者扮演进度 {savant.acting} · {savant.digestion}</p>
      {savant.projects.length > 0 && <section aria-label="通识者工坊记录">
        {savant.projects.map((project) => <details className="seer-fold" key={project.id}>
          <summary>{project.title} · {PROJECT_STATUS[project.status] ?? project.status}</summary>
          <p>{project.story}</p>
          {project.plan && <p>{project.plan}</p>}
          <p>实际材料：{project.materials}</p>
          <p>借用工具：{project.tool}</p>
        </details>)}
      </section>}
      {savant.bottles.length > 0 && <details className="seer-fold">
        <summary>通识者原瓶 · 来源与去向</summary>
        {savant.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
          <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        </article>)}
      </details>}
      {savant.abilities.length > 0 && <details className="seer-fold">
        <summary>已继承的通识者能力</summary>
        {savant.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      </details>}
    </section>
  );
}

/** Display surveyed facts and actual exploration results, never infer hidden relic properties. */
export function ArchaeologistPanel({ archaeologist, resources, busy, blocked, onCommand }: ArchaeologistPanelProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = archaeologist.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = archaeologist.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const siteActions = archaeologist.actions.filter((action) => "siteId" in action.command);
  const selectedSite = archaeologist.sites.find((site) => site.id === selectedSiteId)
    ?? archaeologist.sites.find((site) => siteActions.some((action) => "siteId" in action.command && action.command.siteId === site.id && action.enabled))
    ?? archaeologist.sites[0];
  const selectedSiteActions = siteActions.filter((action) => "siteId" in action.command
    && action.command.siteId === selectedSite?.id);
  const actions = archaeologist.actions.filter((action) => action.command.type !== "CONSUME" && !("siteId" in action.command));
  const nextAction = archaeologist.promoted
    ? selectedSiteActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedSiteActions[0] ?? actions[0]
    : archaeologist.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !archaeologist.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || archaeologist.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, archaeologist.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ArchaeologistAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || archaeologist.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: ArchaeologistAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => onCommand(action.command)}
          aria-describedby={action.reason ? `archaeologist-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`archaeologist-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel archaeologist-panel seer-confirmation" aria-label="这瓶考古学家魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="考古学家服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{archaeologist.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{archaeologist.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="archaeologist-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "archaeologist-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel archaeologist-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="考古学家成长下一步">
        <span className="seer-seal">{archaeologist.promoted ? "序列 8" : "考古学家成长卷宗"}</span>
        <h3>{archaeologist.title}</h3>
        {nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{archaeologist.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{archaeologist.digestion}</p>
        {!archaeologist.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养，也可继续回看通识者时期的经历。</p>}
      </section>

      {selectedSite && (
        <section aria-label="考古学家遗址探索">
          <h3>勘察与探索</h3>
          <label className="seer-case-selector">
            选择探索地点
            <select value={selectedSite.id} disabled={busy || blocked} onChange={(event) => setSelectedSiteId(event.target.value)}>
              {archaeologist.sites.map((site) => <option key={site.id} value={site.id}>{site.title}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前探索地点">
            <h4>{selectedSite.title}</h4>
            <p>{selectedSite.story}</p>
            <p className="slice-muted">{SITE_STATUS[selectedSite.status] ?? selectedSite.status}</p>
            {selectedSite.observations.length > 0 && (
              <section className="seer-fold" aria-label="已经勘察到的现场记录">
                <h4>已经勘察到的现场记录</h4>
                <ul>{selectedSite.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
              </section>
            )}
            {selectedSite.result && (
              <section className="seer-fold" aria-label="实际探索结果">
                <h4>实际探索结果</h4>
                <p>{selectedSite.result}</p>
              </section>
            )}
            {selectedSiteActions.length > 0 && (
              <div className="seer-actions seer-reflection" role="group" aria-label="当前地点的探索行动">{selectedSiteActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="考古学家成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {archaeologist.story && <p className="slice-muted">{archaeologist.story}</p>}

      {archaeologist.discovered && archaeologist.supplies && <p className="slice-notice">{archaeologist.supplies}</p>}
      {archaeologist.discovered && archaeologist.bottles.length > 0 && (
        <details className="seer-fold archaeologist-bottles" open={!archaeologist.promoted}>
          <summary>考古学家独立成品原瓶 · 来源与去向</summary>
          {archaeologist.bottles.map((bottle) => {
            const action = archaeologist.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !archaeologist.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !archaeologist.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `archaeologist-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`archaeologist-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {archaeologist.discovered && !archaeologist.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{archaeologist.risk}</p></details>}
      {archaeologist.promoted && (
        <section className="archaeologist-abilities" aria-label="考古学家能力与消化">
          <h3>能力与消化 · {archaeologist.abilities.length} 项能力</h3>
          <p>扮演进度 {archaeologist.acting} · 消化：{archaeologist.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {archaeologist.pollution}</p>
          {archaeologist.abilities.map((ability) => (
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
