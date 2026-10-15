import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ApprenticeAction, ApprenticeCommand, ApprenticeProjection } from "../domain/apprentice/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原门与普通路线",
  PREPARED: "已选定通行方式并完成准备",
  EXAMINED: "已实际通行，请核对位置与返程",
  RESOLVED: "已返回并交接本次报告",
};

function isCaseAction(action: ApprenticeAction): boolean {
  return "caseId" in action.command;
}

interface ApprenticePanelProps {
  apprentice: ApprenticeProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: ApprenticeCommand) => void;
}

/** Passage, location and reports are rendered only after authoritative public projection updates. */
export function ApprenticePanel({ apprentice, resources, busy, blocked, readOnly = false, onCommand }: ApprenticePanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = apprentice.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = apprentice.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = apprentice.actions.filter(isCaseAction);
  const selectedCase = apprentice.cases.find((entry) => entry.id === apprentice.insideCaseId)
    ?? apprentice.cases.find((entry) => entry.id === selectedCaseId)
    ?? apprentice.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? apprentice.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = apprentice.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = apprentice.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : apprentice.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Selecting or preparing a route never implies passage, an opened door or a returned traveller.
  const nextLabel = nextAction?.command.type === "PREPARE"
    ? "对照原门与退路，选择本人开门或已知普通路线并完成准备。"
    : nextAction?.command.type === "PERFORM"
      ? "核对已选路线后实际通行，也可以取消本次准备。"
      : nextAction?.command.type === "RETURN"
        ? "经已确认的普通门返回外侧；实际返回后才能报告。"
      : nextAction?.command.type === "REPORT"
        ? "人在外侧后，报告实际经过与仍未知的边界。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !apprentice.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || apprentice.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, apprentice.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ApprenticeAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || apprentice.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: ApprenticeAction) {
    return (
      <div className="seer-action apprentice-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `apprentice-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`apprentice-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel apprentice-panel seer-confirmation" aria-label="这瓶学徒魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="学徒服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{apprentice.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{apprentice.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="apprentice-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "apprentice-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel apprentice-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="学徒成长下一步">
        <span className="seer-seal">{apprentice.promoted ? "序列 9" : "学徒成长卷宗"}</span>
        <h3>{apprentice.title}</h3>
        {readOnly ? (
          <p className="seer-next">已选择其它途径，这份学徒渠道只供回看。</p>
        ) : apprentice.insideCaseId ? (
          <p className="seer-next"><strong>下一步：</strong>先沿已开的原门返回。人在外侧后才能报告或处理外部事务；返回不消耗行动或灵性。</p>
        ) : apprentice.promoted && apprentice.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的通行实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{apprentice.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{apprentice.digestion}</p>
        {!apprentice.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">取得渠道或晋升不会自动加入教会。学徒开门只供本人通过，不能携带同伴；已知普通路线也能推进实践。</p>
      </section>

      {apprentice.promoted && <section className="slice-notice apprentice-environment" aria-label="当前位置与已知退路">
        <h4>当前位置与已知退路</h4>
        <p>{apprentice.environment || "尚未取得当前位置、原门状态与退路的公开记录；不能预先认定已经通过或打开原门。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="学徒通行实践">
          <h3>原门、实际通行与报告</h3>
          <label className="seer-case-selector">
            选择通行实践
            <select value={selectedCase.id} disabled={busy || blocked || apprentice.insideCaseId !== null} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {apprentice.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case apprentice-case" aria-label="当前通行实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="apprentice-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察原门与现场；门后情况、障碍厚度与通行结果仍未知。</p>}
            </section>
            <section className="apprentice-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的通行与报告见原记录。"}</p>
            </section>
            <section className="slice-notice apprentice-boundaries" aria-label="单人通行与普通退路">
              <h4>单人通行与普通退路</h4>
              <p>先观察原障碍，再选择本人开门或已知普通路线。准备、实际通行、普通返回与报告分别提交，成本与限制见按钮。</p>
              <p className="slice-muted">开门不能带同伴通过，也不保证任何厚墙均可穿越。通过后是否已从内侧解闩，只看实际结果；原门可用时才沿普通门返回，人在外侧后再报告。</p>
            </section>
            {selectedCase.result && <section className="apprentice-result" aria-label="实际通行与报告记录">
              <h4>实际通行与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="apprentice-action-list" role="group" aria-label="当前通行实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="apprentice-action-list" role="group" aria-label="学徒成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {apprentice.story && <p className="slice-muted">{apprentice.story}</p>}

      {apprentice.discovered && <section className="slice-notice apprentice-source" aria-label="学徒成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("当前渠道只提供成品魔药，不提供完整配方。本阶段由诺拉·维恩提供有独立来源记录的成品原瓶，不提供调配；渠道条件、场景与数值以当前公开记录为准。")}</p>
        {apprentice.supplies && <p>{apprentice.supplies}</p>}
      </section>}
      {apprentice.discovered && apprentice.bottles.length > 0 && (
        <details className="seer-fold apprentice-bottles" open={!apprentice.promoted}>
          <summary>导师的独立成品原瓶 · 来源与去向</summary>
          {apprentice.bottles.map((bottle) => {
            const action = apprentice.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !apprentice.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !apprentice.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `apprentice-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`apprentice-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {apprentice.discovered && !apprentice.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{apprentice.risk}</p></details>}
      {apprentice.promoted && (
        <section className="apprentice-abilities" aria-label="学徒能力与消化">
          <h3>能力与消化 · {apprentice.abilities.length} 项能力</h3>
          <p className="slice-muted">序列9开门用于本人通过适用的原障碍。普通钥匙与已知路线仍有效；这里不提供携人传送、记录法术或更高序列能力。</p>
          <p>扮演进度 {apprentice.acting} · 消化：{apprentice.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {apprentice.pollution}</p>
          {apprentice.abilities.map((ability) => (
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
