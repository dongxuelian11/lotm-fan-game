import { useEffect, useRef, useState } from "react";
import type { ClownAction, ClownCommand, ClownProjection } from "../domain/clown/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./clown-styles.css";

interface ClownPanelProps {
  clown: ClownProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: ClownCommand) => void;
}

/** Costs, prerequisites, stories and outcomes are supplied by the public projection. */
export function ClownPanel({ clown, resources, busy, blocked, onCommand }: ClownPanelProps) {
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = clown.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = clown.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const actions = clown.actions.filter((action) => action.command.type !== "CONSUME");
  const nextAction = clown.actions.find((action) => action.enabled && action.command.type === "CONSUME")
    ?? clown.actions.find((action) => action.enabled)
    ?? clown.actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !clown.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || clown.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, clown.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ClownAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || clown.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel clown-panel seer-confirmation" aria-label="这瓶小丑魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="小丑服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{clown.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{clown.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="clown-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>
            暂不服用
          </button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "clown-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或材料。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel clown-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="小丑成长下一步">
        <span className="seer-seal">{clown.promoted ? "序列 8" : "小丑晋升准备"}</span>
        <h3>{clown.title}</h3>
        {nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">暂时没有可执行的成长行动。</p>}
        <p className="slice-muted">{clown.promoted ? `扮演进度 ${clown.acting} · 消化：${clown.digestion}` : clown.digestion}</p>
      </section>

      {clown.promoted && (
        <section className="clown-paper" aria-label="小丑纸张库存">
          <h4>随身纸张 <strong>{clown.paperSheets} 张</strong></h4>
          <p className="slice-muted">店内剩余 {clown.paperStock} 张 · 已使用 {clown.paperSpent} 张</p>
        </section>
      )}

      {clown.story && <section className="clown-story" aria-label="当前小丑情境"><h3>当前情境</h3><p>{clown.story}</p></section>}

      {actions.length > 0 && (
        <div className={!clown.promoted ? "clown-preparation" : undefined}>
          <div className={`seer-actions${actions.length === 1 && !clown.promoted ? " clown-single-action" : ""}`} role="group" aria-label="小丑成长行动">
            {actions.map((action) => (
              <div className="seer-action" key={action.id}>
                <button
                  className="slice-choice"
                  disabled={busy || blocked || !action.enabled}
                  onClick={() => onCommand(action.command)}
                  aria-describedby={action.reason ? `clown-reason-${action.id}` : undefined}
                >
                  <strong>{action.label}</strong>
                  <span className="slice-modifiers">{action.cost}</span>
                </button>
                {action.reason && <p className="seer-action-reason" id={`clown-reason-${action.id}`}>{action.reason}</p>}
              </div>
            ))}
          </div>
          {!clown.promoted && <dl className="clown-preparation-budget" aria-label="晋升准备当前资源">
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
            <div><dt>现有现金</dt><dd>{resources.cash}</dd></div>
          </dl>}
        </div>
      )}

      {clown.discovered && !clown.promoted && clown.bottles.length > 0 && (
        <section className="seer-bottles" aria-label="已调配的小丑魔药">
          <h3>已调配的小丑魔药</h3>
          {clown.bottles.map((bottle) => {
            const action = clown.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className="seer-bottle" key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `clown-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`clown-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {clown.discovered && !clown.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{clown.risk}</p></details>}

      {clown.discovered && clown.formulaKnown && clown.formula.length > 0 && (
        <details className="seer-fold">
          <summary>查看已知小丑配方 · {clown.formula.length} 种材料</summary>
          <ul className="seer-formula">
            {clown.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong></li>)}
          </ul>
          <p className="slice-muted">以上是配方用量。材料是否备齐，以可执行的调配行动为准。</p>
        </details>
      )}

      {clown.promoted && (
        <details className="seer-fold clown-abilities">
          <summary>能力与消化 · {clown.abilities.length} 项能力</summary>
          <p>扮演进度 {clown.acting} · 消化：{clown.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {clown.pollution}</p>
          {clown.abilities.map((ability) => (
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
