import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SwindlerAction, SwindlerCommand, SwindlerProjection } from "../domain/swindler/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察，等待准备",
  PREPARED: "准备已完成",
  EXAMINED: "已实际实践，等待出示原物并澄清",
  RESOLVED: "已出示原物、澄清并完成报告",
};
function isCaseAction(action: SwindlerAction): boolean {
  return "caseId" in action.command;
}

interface SwindlerPanelProps {
  swindler: SwindlerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: SwindlerCommand) => void;
}

/** A finite practice displays only committed public facts; disclosure and rewards are domain decisions. */
export function SwindlerPanel({ swindler, resources, busy, blocked, onCommand }: SwindlerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = swindler.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = swindler.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = swindler.actions.filter(isCaseAction);
  const selectedCase = swindler.cases.find((scene) => scene.id === selectedCaseId)
    ?? swindler.cases.find((scene) => scene.status === "EXAMINED")
    ?? swindler.cases.find((scene) => scene.status === "OBSERVED" || scene.status === "PREPARED")
    ?? swindler.cases.find((scene) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === scene.id))
    ?? swindler.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = swindler.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = swindler.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : swindler.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !swindler.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || swindler.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, swindler.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SwindlerAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || swindler.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: SwindlerAction) {
    return (
      <div className="seer-action swindler-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => {
            if (busy || blocked || !action.enabled) return;
            // Keep the acted-on scene visible when its committed result makes it resolved.
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `swindler-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`swindler-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel swindler-panel seer-confirmation" aria-label="这瓶诈骗师魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="诈骗师服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{swindler.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{swindler.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="swindler-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "swindler-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel swindler-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="诈骗师成长下一步">
        <span className="seer-seal">{swindler.promoted ? "序列 8" : "诈骗师晋升卷宗"}</span>
        <h3>{swindler.title}</h3>
        {swindler.promoted && swindler.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的骗局与澄清记录。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{swindler.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{swindler.digestion}</p>
        {!swindler.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成偷盗者消化与成熟时间，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("这是游戏设定（G）的新渠道独立成品药，沿用原创成年导师艾德温·洛克；完整配方待核，指导不解锁材料采购或制造，也不会建立家族或组织身份。")}</p>
      </section>

      {swindler.promoted && <section className="slice-notice swindler-environment" aria-label="已知实践环境">
        <h4>已知实践环境</h4>
        <p>{swindler.environment || "现场尚未确认，请先观察当事人与原记录。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="诈骗师实践记录">
          <h3>有限骗局与实际澄清</h3>
          <p className="slice-muted">先观察原记录与当事人的公开说明，再选择有限误导或普通核对。实际实践后须出示原物并澄清，才会结算报告与奖励；准备中的取消不消耗行动或灵性。</p>
          <label className="seer-case-selector">
            选择骗局情境
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {swindler.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? scene.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前骗局情境">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="seer-fold swindler-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。对方的秘密、实际想法与本次行动结果仍未知。</p>}
            </section>
            <section className="swindler-preparation" aria-label="实际方法与准备">
              <h4>实际方法与准备</h4>
              <p>{selectedCase.preparation || "尚未选定本次方法；不会自动实施误导。"}</p>
            </section>
            {selectedCase.status === "EXAMINED" && <p className="slice-notice">实践已有实际结果。请出示原物并向当事人澄清；尚未完成报告与奖励结算。</p>}
            {selectedCase.result && <section className="slice-notice swindler-result" aria-label="实际实践结果"><h4>实际实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="swindler-action-list" role="group" aria-label="当前情境行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="swindler-action-list" role="group" aria-label="诈骗师成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {swindler.story && <p className="slice-muted swindler-source">{swindler.story}</p>}

      {swindler.discovered && swindler.supplies && <p className="slice-notice">{swindler.supplies}</p>}
      {swindler.discovered && swindler.bottles.length > 0 && (
        <details className="seer-fold swindler-bottles" open={!swindler.promoted}>
          <summary>诈骗师独立成品原瓶 · 来源与去向</summary>
          {swindler.bottles.map((bottle) => {
            const action = swindler.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !swindler.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !swindler.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `swindler-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`swindler-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {swindler.discovered && !swindler.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{swindler.risk}</p></details>}
      {swindler.promoted && (
        <section className="swindler-abilities" aria-label="诈骗师能力与消化">
          <h3>能力与消化 · {swindler.abilities.length} 项能力</h3>
          <p className="slice-muted">{playerText("口才与谋划属于同一项有限骗术。目标仍可质疑、核对或拒绝；不能保证信任或服从，不能读心、改写记忆或把谎言变成事实。本作具体实践与战斗两阶段骗局属于游戏设定（G），不提前开放能力偷取。")}</p>
          <p>扮演进度 {swindler.acting} · 消化：{swindler.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {swindler.pollution}</p>
          {swindler.abilities.map((ability) => (
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
