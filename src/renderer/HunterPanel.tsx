import { useEffect, useRef, useState } from "react";
import type { HunterAction, HunterCommand, HunterProjection } from "../domain/hunter/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./hunter-styles.css";

interface HunterPanelProps {
  hunter: HunterProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: HunterCommand) => void;
}

/** Display the public supplies and actions without manufacturing potions or trap inventory. */
export function HunterPanel({ hunter, resources, busy, blocked, onCommand }: HunterPanelProps) {
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = hunter.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = hunter.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const practices = hunter.actions.filter((action) => action.command.type === "PRACTICE");
  // The public projection omits completed practices, so its first entry is the next unfinished one.
  const selectedPractice = practices.find((action) => action.id === selectedPracticeId) ?? practices[0];
  const cargoTypes = ["CARGO_TALK", "CARGO_FIGHT", "SET_TRAP", "RECOVER_TRAP"];
  const cargoActions = hunter.actions.filter((action) => cargoTypes.includes(action.command.type));
  const actions = hunter.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "PRACTICE" && !cargoTypes.includes(action.command.type));
  const nextAction = (hunter.promoted ? selectedPractice ?? cargoActions.find((action) => action.enabled) : undefined)
    ?? hunter.actions.find((action) => action.enabled && action.command.type === "CONSUME")
    ?? hunter.actions.find((action) => action.enabled)
    ?? hunter.actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !hunter.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || hunter.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, hunter.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: HunterAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || hunter.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: HunterAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => onCommand(action.command)}
          aria-describedby={action.reason ? `hunter-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`hunter-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel hunter-panel seer-confirmation" aria-label="这瓶猎人魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="猎人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{hunter.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{hunter.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="hunter-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "hunter-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel hunter-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="猎人成长下一步">
        <span className="seer-seal">{hunter.promoted ? "序列 9" : "猎人成长卷宗"}</span>
        <h3>{hunter.title}</h3>
        {nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{hunter.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{hunter.digestion}</p>
        {!hunter.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
      </section>

      {selectedPractice && (
        <section className="hunter-practice" aria-label="猎人实践">
          <h3>猎人实践</h3>
          <label className="seer-case-selector">
            选择未完成的实践
            <select value={selectedPractice.id} disabled={busy || blocked} onChange={(event) => setSelectedPracticeId(event.target.value)}>
              {practices.map((practice) => <option key={practice.id} value={practice.id}>{practice.label}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前猎人实践">
            <h4>{selectedPractice.label}</h4>
            <p>{selectedPractice.cost}</p>
            <button
              className="slice-button"
              disabled={busy || blocked || !selectedPractice.enabled}
              onClick={() => onCommand(selectedPractice.command)}
              aria-describedby={selectedPractice.reason ? "hunter-practice-reason" : undefined}
            >{selectedPractice.label}</button>
            {selectedPractice.reason && <p className="seer-action-reason" id="hunter-practice-reason">{selectedPractice.reason}</p>}
          </section>
        </section>
      )}

      {hunter.promoted && (
        <section className="hunter-inventory" aria-label="猎人陷阱原件库存">
          <h3>陷阱原件</h3>
          <dl className="seer-facts">
            <div><dt>随身持有</dt><dd>{hunter.trapHeld} 套</dd></div>
            <div><dt>现场已布置</dt><dd>{hunter.trapDeployed} 套</dd></div>
            <div><dt>供应方库存</dt><dd>{hunter.trapStock} 套</dd></div>
            <div><dt>累计损耗</dt><dd>{hunter.trapSpent} 套</dd></div>
          </dl>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="猎人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {(hunter.story || cargoActions.length > 0) && (
        <details className="seer-fold hunter-cargo">
          <summary>货道争议</summary>
          {hunter.story && <section className="hunter-story" aria-label="当前猎人情境"><p>{hunter.story}</p></section>}
          {cargoActions.length > 0 && (
            <div className="seer-actions" role="group" aria-label="货道争议行动">{cargoActions.map(actionButton)}</div>
          )}
        </details>
      )}

      {hunter.discovered && hunter.supplies && <p className="slice-notice">{hunter.supplies}</p>}
      {hunter.discovered && hunter.bottles.length > 0 && (
        <details className="seer-fold hunter-bottles" open={!hunter.promoted}>
          <summary>导师的独立原瓶 · 来源与去向</summary>
          {hunter.bottles.map((bottle) => {
            const action = hunter.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className="seer-bottle" key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !hunter.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `hunter-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`hunter-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {hunter.discovered && !hunter.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{hunter.risk}</p></details>}
      {hunter.promoted && (
        <section className="hunter-abilities" aria-label="猎人能力与消化">
          <h3>能力与消化 · {hunter.abilities.length} 项能力</h3>
          <p>扮演进度 {hunter.acting} · 消化：{hunter.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {hunter.pollution}</p>
          {hunter.abilities.map((ability) => (
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
