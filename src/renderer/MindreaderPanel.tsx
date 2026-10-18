import { useEffect, useRef, useState } from "react";
import type { AudienceProjection } from "../domain/audience/types";
import type { MindreaderAction, MindreaderCommand, MindreaderProjection } from "../domain/mindreader/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

interface MindreaderPanelProps {
  mindreader: MindreaderProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: MindreaderCommand) => void;
}

/** Prior-sequence records remain visible without exposing executable Audience commands. */
export function AudienceHistory({ audience }: { audience: AudienceProjection }) {
  return (
    <section className="seer-panel audience-panel" aria-label="观众时期的经历">
      <h3>观众时期的经历</h3>
      <p className="slice-notice">你已晋升读心者。这里保留观众时期的观察、交往与原瓶记录；继续实践请回到读心者卷宗。</p>
      <p>观众扮演进度 {audience.acting} · {audience.digestion}</p>
      <p>交往信任：{audience.trust}</p>
      {audience.scenes.length > 0 && <section aria-label="观众交往记录">
        {audience.scenes.map((scene) => <details className="seer-fold" key={scene.id}>
          <summary>{scene.title} · {scene.status}</summary>
          <p>{scene.story}</p>
          {scene.observations.length > 0 && <ul>{scene.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
          {scene.interpretation && <p>当时的解读：{scene.interpretation}</p>}
        </details>)}
      </section>}
      {audience.formulaKnown && audience.formula.length > 0 && <details className="seer-fold">
        <summary>已学过的观众配方</summary>
        <ul className="seer-formula">{audience.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong></li>)}</ul>
      </details>}
      {audience.bottles.length > 0 && <details className="seer-fold">
        <summary>观众原瓶 · 来源与去向</summary>
        {audience.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
          <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        </article>)}
      </details>}
      {audience.abilities.length > 0 && <details className="seer-fold">
        <summary>已继承的观众能力</summary>
        {audience.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      </details>}
    </section>
  );
}

/** Display visible facts, genuine shallow reading and dialogue as distinct public records. */
export function MindreaderPanel({ mindreader, resources, busy, blocked, onCommand }: MindreaderPanelProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = mindreader.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = mindreader.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const sceneActions = mindreader.actions.filter((action) => action.command.type === "OBSERVE" || action.command.type === "READ" || action.command.type === "DISCUSS");
  const selectedScene = mindreader.scenes.find((scene) => scene.id === selectedSceneId)
    ?? mindreader.scenes.find((scene) => sceneActions.some((action) => "caseId" in action.command && action.command.caseId === scene.id && action.enabled))
    ?? mindreader.scenes[0];
  const selectedSceneActions = selectedScene ? sceneActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedScene.id) : [];
  const reflections = mindreader.actions.filter((action) => action.command.type === "REFLECT");
  const actions = mindreader.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "OBSERVE" && action.command.type !== "READ" && action.command.type !== "DISCUSS" && action.command.type !== "REFLECT");
  const nextAction = (mindreader.promoted ? selectedSceneActions.find((action) => action.enabled) ?? reflections.find((action) => action.enabled) : undefined)
    ?? mindreader.actions.find((action) => action.enabled && action.command.type === "CONSUME")
    ?? actions.find((action) => action.enabled)
    ?? (mindreader.promoted ? selectedSceneActions[0] : undefined) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !mindreader.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || mindreader.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, mindreader.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: MindreaderAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || mindreader.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: MindreaderAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => onCommand(action.command)}
          aria-describedby={action.reason ? `mindreader-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`mindreader-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel mindreader-panel seer-confirmation" aria-label="这瓶读心者魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="读心者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{mindreader.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{mindreader.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="mindreader-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "mindreader-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel mindreader-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="读心者成长下一步">
        <span className="seer-seal">{mindreader.promoted ? "序列 8" : "读心者成长卷宗"}</span>
        <h3>{mindreader.title}</h3>
        {nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{mindreader.promoted ? "分清亲见事实、浅层心声与实际交谈，再继续生活。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{mindreader.digestion}</p>
        {!mindreader.promoted && <p className="slice-muted">准备期间仍可继续工作、调查或休养；晋升条件与各批材料费用见当前行动说明。</p>}
      </section>

      {mindreader.promoted && selectedScene && (
        <section aria-label="读心者社会交往">
          <h3>观察、读心与交谈</h3>
          <p className="slice-muted">读心可以触及当下的浅层思想与情绪灵光。它不会打开深层记忆，也不能操控对方；实际经过仍需交谈或查证。</p>
          {mindreader.scenes.length > 1 && (
            <label className="seer-case-selector">
              选择社会情境
              <select value={selectedScene.id} disabled={busy || blocked} onChange={(event) => setSelectedSceneId(event.target.value)}>
                {mindreader.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {scene.status}</option>)}
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
            {selectedScene.impression && (
              <section className="slice-notice" aria-label="读心获得的浅层印象">
                <strong>浅层心声与情绪灵光</strong>
                <p>{selectedScene.impression}</p>
                <p className="slice-muted">这是该次能力读取到的表层内容，不是完整记忆或整件事情的真相；记录保留读取时的状态。</p>
              </section>
            )}
            {selectedScene.dialogue && (
              <section className="seer-fold" aria-label="交谈与核实的结果">
                <h4>交谈与核实的结果</h4>
                <p>{selectedScene.dialogue}</p>
              </section>
            )}
            {selectedSceneActions.length > 0 && (
              <div className="seer-actions" role="group" aria-label="当前社会情境的处理方式">{selectedSceneActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {mindreader.promoted && reflections.length > 0 && (
        <div className="seer-actions" role="group" aria-label="交往复盘">{reflections.map(actionButton)}</div>
      )}

      {actions.length > 0 && <div className="seer-actions" role="group" aria-label="读心者成长行动">{actions.map(actionButton)}</div>}

      {mindreader.discovered && mindreader.bottles.length > 0 && (
        <details className="seer-fold seer-bottles" open={!mindreader.promoted}>
          <summary>读心者独立原瓶 · 来源与去向</summary>
          <section aria-label="已调配的读心者魔药">
          {mindreader.bottles.map((bottle) => {
            const action = mindreader.actions.find((entry) => entry.command.type === "CONSUME" && entry.command.bottleId === bottle.id);
            return (
              <article className="seer-bottle" key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !mindreader.promoted && (
                  <div>
                    <button
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `mindreader-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`mindreader-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
          </section>
        </details>
      )}

      {mindreader.discovered && !mindreader.promoted && <details className="seer-fold"><summary>查看服用风险与补给规则</summary><p>{mindreader.risk}</p></details>}

      {mindreader.discovered && mindreader.formulaKnown && mindreader.formula.length > 0 && (
        <details className="seer-fold">
          <summary>查看已知配方 · {mindreader.formula.length} 种材料</summary>
          <ul className="seer-formula">
            {mindreader.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong></li>)}
          </ul>
          <p className="slice-muted">以上是配方用量。材料是否备齐，以可执行的调配行动为准。</p>
        </details>
      )}

      {mindreader.promoted && (
        <details className="seer-fold seer-abilities">
          <summary>读心者能力与消化 · {mindreader.abilities.length} 项能力</summary>
          <section aria-label="读心者能力与消化">
          <p>扮演进度 {mindreader.acting} · 消化：{mindreader.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {mindreader.pollution}</p>
          {mindreader.abilities.map((ability) => (
            <details className="seer-fold" key={ability.id}>
              <summary>{ability.label} · 掌握 {ability.mastery}</summary>
              <p>{ability.description}</p>
            </details>
          ))}
          </section>
        </details>
      )}
      {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    </div>
  );
}
