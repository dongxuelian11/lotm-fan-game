import { useEffect, useRef, useState } from "react";
import type { ApothecaryAction, ApothecaryCommand, ApothecaryProjection } from "../domain/apothecary/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未检查",
  EXAMINED: "已检查，等待选择",
  RESOLVED: "已完成本次处置",
};

interface ApothecaryPanelProps {
  apothecary: ApothecaryProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: ApothecaryCommand) => void;
}

/** Display public patient observations, real clinic stocks and original bottles; domain rules stay outside the UI. */
export function ApothecaryPanel({ apothecary, resources, busy, blocked, onCommand }: ApothecaryPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = apothecary.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = apothecary.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = apothecary.actions.filter((action) => "caseId" in action.command);
  const selectedCase = apothecary.cases.find((patient) => patient.id === selectedCaseId)
    ?? apothecary.cases.find((patient) => caseActions.some((action) => "caseId" in action.command && action.command.caseId === patient.id && action.enabled))
    ?? apothecary.cases[0];
  const selectedCaseActions = caseActions.filter((action) => "caseId" in action.command
    && action.command.caseId === selectedCase?.id);
  const actions = apothecary.actions.filter((action) => action.command.type !== "CONSUME" && !("caseId" in action.command));
  const nextAction = apothecary.promoted
    ? selectedCaseActions.find((action) => action.enabled)
      ?? actions.find((action) => action.enabled && action.command.type === "REFLECT")
      ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : apothecary.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !apothecary.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || apothecary.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, apothecary.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ApothecaryAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || apothecary.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: ApothecaryAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => onCommand(action.command)}
          aria-describedby={action.reason ? `apothecary-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`apothecary-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel apothecary-panel seer-confirmation" aria-label="这瓶药师魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="药师服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{apothecary.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{apothecary.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="apothecary-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "apothecary-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel apothecary-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="药师成长下一步">
        <span className="seer-seal">{apothecary.promoted ? "序列 9" : "药师成长卷宗"}</span>
        <h3>{apothecary.title}</h3>
        {apothecary.promoted && apothecary.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，也可以回看实际接诊记录。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{apothecary.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{apothecary.digestion}</p>
        {!apothecary.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
      </section>

      {apothecary.promoted && (
        <section className="seer-fold" aria-label="药铺实际耗材">
          <h3>药铺实际耗材</h3>
          <dl className="seer-facts">
            <div><dt>可用游戏材料</dt><dd>{apothecary.clinic.materials}</dd></div>
            <div><dt>外伤护理剂</dt><dd>{apothecary.clinic.healing}</dd></div>
            <div><dt>安神剂</dt><dd>{apothecary.clinic.calming}</dd></div>
            <div><dt>已耗用/废弃份数</dt><dd>{apothecary.clinic.spent}</dd></div>
          </dl>
          <p className="slice-muted">这些药剂与材料仅为虚构游戏道具，不是现实药方或医疗建议。</p>
        </section>
      )}

      {apothecary.promoted && selectedCase && (
        <section aria-label="药师接诊记录">
          <h3>观察与照料</h3>
          <label className="seer-case-selector">
            选择接诊记录
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {apothecary.cases.map((patient) => <option key={patient.id} value={patient.id}>{patient.title} · {CASE_STATUS[patient.status] ?? patient.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前接诊记录">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <dl className="seer-facts">
              <div><dt>接诊状态</dt><dd>{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</dd></div>
              <div><dt>病人健康</dt><dd>{selectedCase.health === null ? "尚未检查" : selectedCase.health}</dd></div>
              <div><dt>病人精神</dt><dd>{selectedCase.mind === null ? "尚未检查" : selectedCase.mind}</dd></div>
            </dl>
            <section className="seer-fold" aria-label="已取得的检查记录">
              <h4>已取得的检查记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未检查，没有可用的观察记录。</p>}
            </section>
            {selectedCase.result && <section className="slice-notice" aria-label="实际处置结果"><h4>实际处置结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="seer-actions" role="group" aria-label="当前接诊行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="药师成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {apothecary.story && <p className="slice-muted">{apothecary.story}</p>}

      {apothecary.discovered && apothecary.supplies && <p className="slice-notice">{apothecary.supplies}</p>}
      {apothecary.discovered && apothecary.bottles.length > 0 && (
        <details className="seer-fold apothecary-bottles" open={!apothecary.promoted}>
          <summary>药铺的独立成品原瓶 · 来源与去向</summary>
          {apothecary.bottles.map((bottle) => {
            const action = apothecary.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !apothecary.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !apothecary.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `apothecary-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`apothecary-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {apothecary.discovered && !apothecary.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{apothecary.risk}</p></details>}
      {apothecary.promoted && (
        <section className="apothecary-abilities" aria-label="药师能力与消化">
          <h3>能力与消化 · {apothecary.abilities.length} 项能力</h3>
          <p>扮演进度 {apothecary.acting} · 消化：{apothecary.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {apothecary.pollution}</p>
          {apothecary.abilities.map((ability) => (
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
