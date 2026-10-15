import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { GladiatorAction, GladiatorCommand, GladiatorProjection } from "../domain/gladiator/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察距离、许可与停止信号",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际练习，等待核对接触与报告",
  RESOLVED: "已实际停止并完成本次报告",
};
function isCaseAction(action: GladiatorAction): boolean {
  return "caseId" in action.command;
}

interface GladiatorPanelProps {
  gladiator: GladiatorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: GladiatorCommand) => void;
}

/** Contact, permission, costs and results come only from the committed public projection. */
export function GladiatorPanel({ gladiator, resources, busy, blocked, onCommand }: GladiatorPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = gladiator.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = gladiator.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = gladiator.actions.filter(isCaseAction);
  const releaseAction = caseActions.find((action) => action.command.type === "RELEASE");
  const releaseCaseId = releaseAction?.command.type === "RELEASE" ? releaseAction.command.caseId : null;
  const engagedCase = gladiator.insideCase ? gladiator.cases.find((scene) => scene.id === releaseCaseId) : undefined;
  const selectedCase = engagedCase ?? gladiator.cases.find((scene) => scene.id === selectedCaseId)
    ?? gladiator.cases.find((scene) => scene.status === "EXAMINED")
    ?? gladiator.cases.find((scene) => scene.status === "OBSERVED" || scene.status === "PREPARED")
    ?? gladiator.cases.find((scene) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === scene.id))
    ?? gladiator.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = gladiator.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const releaseActions = caseActions.filter((action) => action.command.type === "RELEASE"
    && (!engagedCase || action.command.caseId === engagedCase.id));
  const nextAction = gladiator.insideCase
    ? releaseActions.find((action) => action.enabled) ?? releaseActions[0]
    : gladiator.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : gladiator.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !gladiator.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (engagedCase) setSelectedCaseId(engagedCase.id);
    else if (!selectedCaseId && selectedCase) setSelectedCaseId(selectedCase.id);
  }, [engagedCase, selectedCaseId, selectedCase]);

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || gladiator.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, gladiator.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: GladiatorAction) {
    if (busy || blocked || !action.enabled || gladiator.insideCase || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || gladiator.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: GladiatorAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className={action.command.type === "RELEASE" ? "slice-choice primary" : "slice-choice"}
          disabled={busy || blocked || !action.enabled || (gladiator.insideCase && action.command.type !== "RELEASE")}
          onClick={() => {
            if (busy || blocked || !action.enabled || (gladiator.insideCase && action.command.type !== "RELEASE")) return;
            // Keep the acted-on scene visible when its committed result makes it resolved.
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `gladiator-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`gladiator-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel gladiator-panel seer-confirmation" aria-label="这瓶格斗家魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="格斗家服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{gladiator.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{gladiator.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="gladiator-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "gladiator-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel gladiator-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="格斗家成长下一步">
        <span className="seer-seal">{gladiator.promoted ? "序列 8" : "格斗家晋升卷宗"}</span>
        <h3>{gladiator.title}</h3>
        {!gladiator.insideCase && gladiator.promoted && gladiator.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的练习与停止记录。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{gladiator.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{gladiator.digestion}</p>
        {!gladiator.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成战士消化与成熟时间，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("格斗家在古代也称角斗士。当前沿用原创成年导师奥斯温·布莱克特，由新的独立成品渠道供应进阶原瓶；完整配方待核，指导不解锁材料采购或制造，也不建立组织身份。渠道、训练分类与具体情境均为游戏设定（G）。")}</p>
      </section>

      {gladiator.insideCase && <section className="slice-notice gladiator-release" aria-label="立即松开并停止接触">
        <h3>先实际松开训练伙伴</h3>
        <p>本次练习仍有实际身体接触。请先松开并停止，再报告或安排其它事务；松开为0行动，不再消耗灵性，灵性或行动耗尽时仍可执行。</p>
        <div className="seer-actions" role="group" aria-label="零行动松开">{releaseActions.map(actionButton)}</div>
      </section>}

      {gladiator.promoted && <section className="slice-notice gladiator-environment" aria-label="已知实践环境">
        <h4>已知实践环境</h4>
        <p>{gladiator.environment || "现场尚未确认，请先观察训练伙伴、距离与退路。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="格斗家实践记录">
          <h3>有限练习与实际停止</h3>
          <p className="slice-muted">先观察成年伙伴的许可、距离与停止信号，再选择格斗技巧或普通团队方法。已经发生的接触必须实际松开，之后再报告；取消或退出不会退回已支付的行动、灵性或费用，也不会替你松开。</p>
          <label className="seer-case-selector">
            选择练习情境
            <select value={selectedCase.id} disabled={busy || blocked || gladiator.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {gladiator.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? scene.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前练习情境">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="seer-fold gladiator-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。许可、距离与本次行动结果仍未确认。</p>}
            </section>
            <section className="gladiator-preparation" aria-label="实际方法与准备">
              <h4>实际方法与准备</h4>
              <p>{selectedCase.preparation || "当前没有待执行的准备；已发生的练习以实际结果为准，不会自动接触训练伙伴。"}</p>
            </section>
            <p className="slice-muted">接触状态：{selectedCase.contact}</p>
            {selectedCase.status === "EXAMINED" && <p className="slice-notice">练习已有实际结果。请核对停止与接触状态，再提交本次报告；尚未完成报告与奖励结算。</p>}
            {selectedCase.result && <section className="slice-notice gladiator-result" aria-label="实际实践结果"><h4>实际实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="seer-actions" role="group" aria-label="当前情境行动">{selectedCaseActions.filter((action) => !gladiator.insideCase || action.command.type !== "RELEASE").map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="格斗家成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {gladiator.story && <p className="slice-muted gladiator-source">{gladiator.story}</p>}

      {gladiator.discovered && gladiator.supplies && <p className="slice-notice">{gladiator.supplies}</p>}
      {gladiator.discovered && gladiator.bottles.length > 0 && (
        <details className="seer-fold gladiator-bottles" open={!gladiator.promoted}>
          <summary>格斗家独立成品原瓶 · 来源与去向</summary>
          {gladiator.bottles.map((bottle) => {
            const action = gladiator.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !gladiator.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !gladiator.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `gladiator-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`gladiator-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {gladiator.discovered && !gladiator.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{gladiator.risk}</p></details>}
      {gladiator.promoted && (
        <section className="gladiator-abilities" aria-label="格斗家能力与消化">
          <h3>能力与消化 · {gladiator.abilities.length} 项能力</h3>
          <p className="slice-muted">{playerText("格斗技巧是本作新增的一项游戏设定（G）训练分类；原有战士能力与掌握记录继续继承。练习需要成年伙伴明确同意，停止信号必须落实为实际松开。格斗家仍会受到精神影响与恐惧干扰，不免伤、不徒手防弹；序列6晨曦铠甲、晨曦武器与光之风暴尚未开放。")}</p>
          <p>扮演进度 {gladiator.acting} · 消化：{gladiator.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {gladiator.pollution}</p>
          {gladiator.abilities.map((ability) => (
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
