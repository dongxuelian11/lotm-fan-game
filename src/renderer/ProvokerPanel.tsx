import { useEffect, useRef, useState } from "react";
import type { ProvokerAction, ProvokerCommand, ProvokerProjection } from "../domain/provoker/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./provoker-styles.css";

interface ProvokerPanelProps {
  provoker: ProvokerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: ProvokerCommand) => void;
}

/** The public projection supplies every fact, available choice, cost and prerequisite. */
export function ProvokerPanel({ provoker, resources, busy, blocked, onCommand }: ProvokerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = provoker.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = provoker.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = provoker.actions.filter((action) => action.command.type === "OBSERVE" || action.command.type === "CHOOSE");
  const cases = provoker.cases.filter((entry) => caseActions.some((action) =>
    (action.command.type === "OBSERVE" || action.command.type === "CHOOSE") && action.command.caseId === entry.id,
  ));
  const selectedCase = cases.find((entry) => entry.id === selectedCaseId)
    ?? cases.find((entry) => caseActions.some((action) => action.command.type === "CHOOSE" && action.command.caseId === entry.id))
    ?? cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) =>
    (action.command.type === "OBSERVE" || action.command.type === "CHOOSE") && action.command.caseId === selectedCase.id,
  ) : [];
  const encounterActions = provoker.actions.filter((action) => action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT");
  const actions = provoker.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "OBSERVE" && action.command.type !== "CHOOSE"
    && action.command.type !== "ENCOUNTER_TALK" && action.command.type !== "ENCOUNTER_FIGHT");
  const nextAction = (provoker.promoted ? selectedCaseActions.find((action) => action.enabled) : undefined)
    ?? provoker.actions.find((action) => action.enabled && action.command.type === "CONSUME")
    ?? provoker.actions.find((action) => action.enabled)
    ?? provoker.actions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !provoker.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || provoker.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, provoker.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ProvokerAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || provoker.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }

  function actionButton(action: ProvokerAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => onCommand(action.command)}
          aria-describedby={action.reason ? `provoker-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`provoker-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedBottleAction) {
    return (
      <section className="seer-panel provoker-panel seer-confirmation" aria-label="这瓶挑衅者魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="挑衅者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{provoker.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{provoker.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedBottleAction.reason && <p className="seer-action-reason" id="provoker-confirm-reason">{selectedBottleAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedBottleAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedBottleAction.reason ? "provoker-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel provoker-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="挑衅者成长下一步">
        <span className="seer-seal">{provoker.promoted ? "序列 8" : "挑衅者晋升准备"}</span>
        <h3>{provoker.title}</h3>
        {nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{provoker.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{provoker.promoted ? `扮演进度 ${provoker.acting} · 消化：${provoker.digestion}` : provoker.digestion}</p>
      </section>

      {selectedCase && (
        <section className="provoker-cases" aria-label="挑衅者实践">
          <h3>观察与应对</h3>
          <label className="seer-case-selector">
            选择当前情境
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前挑衅者情境">
            <h4>{selectedCase.title}</h4>
            <p className="provoker-story">{selectedCase.story}</p>
            <div className="seer-actions" role="group" aria-label="当前情境行动">{selectedCaseActions.map(actionButton)}</div>
          </section>
        </section>
      )}

      {actions.length > 0 && <div className="seer-actions" role="group" aria-label="挑衅者成长行动">{actions.map(actionButton)}</div>}

      {(provoker.story || encounterActions.length > 0) && (
        <details className="seer-fold provoker-encounter">
          <summary>货栈争议</summary>
          {provoker.story && <section aria-label="当前货栈情境"><p className="provoker-story">{provoker.story}</p></section>}
          {encounterActions.length > 0 && <div className="seer-actions" role="group" aria-label="货栈争议行动">{encounterActions.map(actionButton)}</div>}
        </details>
      )}

      {provoker.discovered && provoker.supplies && <p className="slice-notice">{provoker.supplies}</p>}
      {provoker.discovered && provoker.bottles.length > 0 && (
        <details className="seer-fold provoker-bottles" open={!provoker.promoted}>
          <summary>挑衅者独立原瓶 · 来源与去向</summary>
          {provoker.bottles.map((bottle) => {
            const action = provoker.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className="seer-bottle" key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !provoker.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `provoker-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`provoker-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {provoker.discovered && !provoker.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{provoker.risk}</p></details>}
      {provoker.promoted && (
        <details className="seer-fold provoker-abilities">
          <summary>挑衅者能力与消化 · {provoker.abilities.length} 项能力</summary>
          <p>扮演进度 {provoker.acting} · 消化：{provoker.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {provoker.pollution}</p>
          {provoker.abilities.map((ability) => (
            <details className="seer-fold" key={ability.id}>
              <summary>{ability.label} · 掌握 {ability.mastery}</summary>
              <p>{ability.description}</p>
            </details>
          ))}
        </details>
      )}
      {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    </div>
  );
}
