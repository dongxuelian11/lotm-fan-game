import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { CombatScholarAction, CombatScholarCommand, CombatScholarProjection } from "../domain/combat-scholar/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察当前动作、路线与停止信号",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际演练，请核对停止状态与报告",
  RESOLVED: "已核对演练结束并完成本次报告",
};
function isCaseAction(action: CombatScholarAction): boolean {
  return "caseId" in action.command;
}

interface CombatScholarPanelProps {
  combatScholar: CombatScholarProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: CombatScholarCommand) => void;
}

/** Exercise state, observations, costs and results come only from the committed public projection. */
export function CombatScholarPanel({ combatScholar, resources, busy, blocked, onCommand }: CombatScholarPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = combatScholar.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = combatScholar.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = combatScholar.actions.filter(isCaseAction);
  const stopAction = caseActions.find((action) => action.command.type === "STOP" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "STOP");
  const stopCaseId = stopAction?.command.type === "STOP" ? stopAction.command.caseId : null;
  const openCase = combatScholar.insideCase ? combatScholar.cases.find((scene) => scene.id === stopCaseId) : undefined;
  const selectedCase = openCase ?? combatScholar.cases.find((scene) => scene.id === selectedCaseId)
    ?? combatScholar.cases.find((scene) => scene.status === "EXAMINED")
    ?? combatScholar.cases.find((scene) => scene.status === "OBSERVED" || scene.status === "PREPARED")
    ?? combatScholar.cases.find((scene) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === scene.id))
    ?? combatScholar.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = combatScholar.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const stopActions = caseActions.filter((action) => action.command.type === "STOP"
    && (!openCase || action.command.caseId === openCase.id));
  const nextAction = combatScholar.insideCase
    ? stopActions.find((action) => action.enabled) ?? stopActions[0]
    : combatScholar.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : combatScholar.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !combatScholar.promoted && !combatScholar.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (openCase) setSelectedCaseId(openCase.id);
    else if (!selectedCaseId && selectedCase) setSelectedCaseId(selectedCase.id);
  }, [openCase, selectedCaseId, selectedCase]);

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || combatScholar.promoted || combatScholar.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, combatScholar.promoted, combatScholar.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: CombatScholarAction) {
    if (busy || blocked || !action.enabled || combatScholar.insideCase || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || combatScholar.promoted || combatScholar.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: CombatScholarAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className={action.command.type === "STOP" ? "slice-choice primary" : "slice-choice"}
          disabled={busy || blocked || !action.enabled || (combatScholar.insideCase && action.command.type !== "STOP")}
          onClick={() => {
            if (busy || blocked || !action.enabled || (combatScholar.insideCase && action.command.type !== "STOP")) return;
            // Keep the acted-on scene visible when its committed result makes it resolved.
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `combatScholar-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`combatScholar-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel combatScholar-panel seer-confirmation" aria-label="这瓶格斗学者魔药的服用确认" aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (!confirmationLocked) setSelectedBottleId(null);
          }
        }}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="格斗学者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{combatScholar.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{combatScholar.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="combatScholar-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "combatScholar-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel combatScholar-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="格斗学者成长下一步">
        <span className="seer-seal">{combatScholar.promoted ? "序列 8" : "格斗学者晋升卷宗"}</span>
        <h3>{combatScholar.title}</h3>
        {!combatScholar.insideCase && combatScholar.promoted && combatScholar.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的演练、停止与报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{combatScholar.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{combatScholar.digestion}</p>
        {!combatScholar.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先达到窥秘人消化100并度过序列9的四个完整周，再独立确认服用本次原瓶。</p>}
        <p className="slice-muted">{playerText("原著已核内容只确认“格斗学者”的序列名称。本页的训练分类、观察与演练规则、情境、成品渠道和数值均为游戏设定（G），不作为已核原著能力。晋升不自动加入组织。")}</p>
      </section>

      {combatScholar.insideCase && <section className="slice-notice combatScholar-stop" aria-label="立即停止本次演练">
        <h3>先实际停止本次演练</h3>
        <p>本次演练仍未实际结束。无论此前成功或失败，都请先停止演练，再报告或安排其它事务；停止为0行动、0灵性，精神为0时仍可执行。它不会抹去实际结果，也不会退回已支付的成本。</p>
        <div className="seer-actions" role="group" aria-label="零行动停止演练">{stopActions.map(actionButton)}</div>
      </section>}

      {combatScholar.promoted && <section className="slice-notice combatScholar-environment" aria-label="已知实践环境">
        <h4>已知实践环境</h4>
        <p>{combatScholar.environment || "现场尚未确认，请先观察当前动作、路线、成年伙伴许可与停止信号。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="格斗学者实践记录">
          <h3>当前观察、有限演练与实际停止</h3>
          <p className="slice-muted">{playerText("先实际观察，再选择当前观察、照旧记法或普通协作。现场改变后，旧记法不能替代重新核对。仍未结束的演练必须先实际停止，之后再报告；退出准备不会退还成本，也不能代替停止。三种方法及其效果均为游戏设定（G）。")}</p>
          <label className="seer-case-selector">
            选择演练情境
            <select value={selectedCase.id} disabled={busy || blocked || combatScholar.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {combatScholar.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前演练情境">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="seer-fold combatScholar-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。当前动作、路线与本次行动结果仍未确认。</p>}
            </section>
            <section className="combatScholar-preparation" aria-label="实际方法与准备">
              <h4>实际方法与准备</h4>
              <p>{selectedCase.preparation || "当前没有待执行的准备；观察、方法、实际演练、停止与报告分别提交，不会自动生成结果。"}</p>
            </section>
            <p className="slice-muted">演练状态：{selectedCase.exerciseOpen}</p>
            {selectedCase.status === "EXAMINED" && <p className="slice-notice">演练已有实际结果。请核对是否已实际停止，再提交本次报告；尚未完成报告与奖励结算。</p>}
            {selectedCase.result && <section className="slice-notice combatScholar-result" aria-label="实际实践结果"><h4>实际实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="seer-actions" role="group" aria-label="当前情境行动">{selectedCaseActions.filter((action) => !combatScholar.insideCase || action.command.type !== "STOP").map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="格斗学者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {combatScholar.story && <p className="slice-muted combatScholar-source">{combatScholar.story}</p>}

      {combatScholar.discovered && <section className="slice-notice" aria-label="格斗学者成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用独立成品原瓶，不提供未核材料或调配。每瓶来源、劳动与供应条件以公开记录为准。")}</p>
        {combatScholar.supplies && <p>{combatScholar.supplies}</p>}
      </section>}
      {combatScholar.discovered && combatScholar.bottles.length > 0 && (
        <details className="seer-fold combatScholar-bottles" open={!combatScholar.promoted}>
          <summary>格斗学者独立成品原瓶 · 来源与去向</summary>
          {combatScholar.bottles.map((bottle) => {
            const action = combatScholar.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !combatScholar.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !combatScholar.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || combatScholar.insideCase || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `combatScholar-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`combatScholar-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {combatScholar.discovered && !combatScholar.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{combatScholar.risk}</p></details>}
      {combatScholar.promoted && (
        <section className="combatScholar-abilities" aria-label="格斗学者能力与消化">
          <h3>能力与消化 · {combatScholar.abilities.length} 项能力</h3>
          <p className="slice-muted">{playerText("新训练分类及具体效果全部属于游戏设定（G）；窥秘人时期的能力与原掌握记录继续保留。现场观察不能读取思想、复制其它途径能力、证明隐藏秘密或保证命中，不提前开放巫师、卷轴或神秘再现能力。")}</p>
          <p>扮演进度 {combatScholar.acting} · 消化：{combatScholar.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {combatScholar.pollution}</p>
          {combatScholar.abilities.map((ability) => (
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
