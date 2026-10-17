import { useEffect, useRef, useState } from "react";
import type { AudienceAction, AudienceCommand, AudienceProjection } from "../domain/audience/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

interface AudiencePanelProps {
  audience: AudienceProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: AudienceCommand) => void;
}

/** Display only public observations, tentative interpretations and typed player choices. */
export function AudiencePanel({ audience, resources, busy, blocked, onCommand }: AudiencePanelProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = audience.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = audience.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const sceneActions = audience.actions.filter((action) => action.command.type === "OBSERVE" || action.command.type === "DISCUSS");
  const selectedScene = audience.scenes.find((scene) => scene.id === selectedSceneId)
    ?? audience.scenes.find((scene) => sceneActions.some((action) => "caseId" in action.command && action.command.caseId === scene.id && action.enabled))
    ?? audience.scenes[0];
  const selectedSceneActions = selectedScene ? sceneActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedScene.id) : [];
  const reflections = audience.actions.filter((action) => action.command.type === "REFLECT");
  const actions = audience.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "OBSERVE" && action.command.type !== "DISCUSS" && action.command.type !== "REFLECT"
    && (audience.discovered || action.command.type === "DISCOVER"));
  const nextAction = (audience.promoted ? selectedSceneActions.find((action) => action.enabled) ?? reflections.find((action) => action.enabled) : undefined)
    ?? audience.actions.find((action) => action.enabled && action.command.type === "CONSUME")
    ?? actions.find((action) => action.enabled)
    ?? (audience.promoted ? selectedSceneActions[0] : undefined) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !audience.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || audience.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, audience.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: AudienceAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || audience.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: AudienceAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => onCommand(action.command)}
          aria-describedby={action.reason ? `audience-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`audience-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel audience-panel seer-confirmation" aria-label="这瓶观众魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="观众服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{audience.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{audience.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="audience-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "audience-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel audience-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="观众成长下一步">
        <span className="seer-seal">{audience.promoted ? "序列 9" : "观众成长卷宗"}</span>
        <h3>{audience.title}</h3>
        {nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{audience.promoted ? "留意人们的言行，再用实际交往核实自己的理解。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{audience.digestion}</p>
        {!audience.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
      </section>

      {audience.promoted && selectedScene && (
        <section aria-label="观众社会交往">
          <h3>观察与交往</h3>
          <p className="slice-muted">留意表情、语气和动作，再决定怎样开口。你不能直接知道别人的思想。</p>
          <p>交往信任：{audience.trust}</p>
          {audience.scenes.length > 1 && (
            <label className="seer-case-selector">
              选择社会情境
              <select value={selectedScene.id} disabled={busy || blocked} onChange={(event) => setSelectedSceneId(event.target.value)}>
                {audience.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {scene.status}</option>)}
              </select>
            </label>
          )}
          <section className="seer-current-case" aria-label="当前社会情境">
            <h4>{selectedScene.title}</h4>
            <span className="slice-muted">{selectedScene.status}</span>
            <p>{selectedScene.story}</p>
            <section className="seer-fold" aria-label="亲眼观察到的线索">
              <h4>亲眼观察到的线索</h4>
              {selectedScene.observations.length > 0
                ? <ul>{selectedScene.observations.map((observation, index) => <li key={`${selectedScene.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未留下可用的观察记录。</p>}
            </section>
            {selectedScene.interpretation && (
              <section className="slice-notice" aria-label="暂时的解读">
                <strong>暂时的解读 · 推测仍需核实</strong>
                <p>{selectedScene.interpretation}</p>
                <p className="slice-muted">这些线索可能有多种解释，不能凭此认定对方在撒谎或有恶意。</p>
              </section>
            )}
            {selectedSceneActions.length > 0 && (
              <div className="seer-actions" role="group" aria-label="当前社会情境的处理方式">{selectedSceneActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {audience.promoted && reflections.length > 0 && (
        <div className="seer-actions" role="group" aria-label="交往复盘">{reflections.map(actionButton)}</div>
      )}

      {actions.length > 0 && <div className="seer-actions" role="group" aria-label="观众成长行动">{actions.map(actionButton)}</div>}

      {audience.discovered && audience.bottles.length > 0 && (
        <section className="seer-bottles" aria-label="已调配的观众魔药">
          <h3>已调配的魔药</h3>
          {audience.bottles.map((bottle) => {
            const action = audience.actions.find((entry) => entry.command.type === "CONSUME" && entry.command.bottleId === bottle.id);
            return (
              <article className="seer-bottle" key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !audience.promoted && (
                  <div>
                    <button
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      onClick={() => openBottle(action)}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason">{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {audience.discovered && audience.formulaKnown && audience.formula.length > 0 && (
        <details className="seer-fold">
          <summary>查看已知配方 · {audience.formula.length} 种材料</summary>
          <ul className="seer-formula">
            {audience.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong></li>)}
          </ul>
          <p className="slice-muted">以上是配方用量。材料是否备齐，以可执行的调配行动为准。</p>
        </details>
      )}

      {audience.promoted && (
        <section className="seer-abilities" aria-label="观众能力与消化">
          <h3>能力与消化</h3>
          <p>扮演进度 {audience.acting} · 消化：{audience.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {audience.pollution}</p>
          {audience.abilities.map((ability) => (
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
