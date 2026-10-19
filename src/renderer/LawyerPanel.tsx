import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { LawyerAction, LawyerCommand, LawyerProjection } from "../domain/lawyer/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已核对原文、现场与能力边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际尝试，请核对当事人的选择与结果",
  RESOLVED: "已提交本次实践报告",
};

/** Other-pathway history has no mutation callback or actionable controls. */
export function LawyerHistory({ lawyer }: { lawyer: LawyerProjection }) {
  const title = "律师渠道经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">这里保留律师时期的渠道、原瓶与实践记录，只供回看；当前成长请查看对应卷宗。</p>
    {lawyer.story && <p>{lawyer.story}</p>}
    {lawyer.supplies && <p>{lawyer.supplies}</p>}
    {lawyer.environment && <p>{lawyer.environment}</p>}
    {lawyer.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次文书与谈话接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {lawyer.bottles.length > 0 && <details className="seer-fold" open>
      <summary>律师原瓶 · 来源与去向</summary>
      {lawyer.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {lawyer.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {lawyer.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: LawyerAction): boolean {
  return "caseId" in action.command;
}

interface LawyerPanelProps {
  lawyer: LawyerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: LawyerCommand) => void;
}

/** Only committed public facts change document contact, preparation, or reports. */
export function LawyerPanel({ lawyer, resources, busy, blocked, readOnly = false, onCommand }: LawyerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => lawyer.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = lawyer.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = lawyer.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = lawyer.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open contact; prose and old results never create a lock.
  const closeAction = lawyer.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? lawyer.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (lawyer.insideCase ? lawyer.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? lawyer.cases.find((entry) => entry.id === selectedCaseId)
    ?? lawyer.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? lawyer.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!lawyer.insideCase || action.command.type === "CLOSE")) : [];
  const actions = lawyer.insideCase ? [] : lawyer.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = lawyer.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : lawyer.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : lawyer.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (lawyer.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [lawyer.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !lawyer.promoted && !lawyer.insideCase && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || lawyer.promoted || lawyer.insideCase || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, lawyer.promoted, lawyer.insideCase, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: LawyerAction) {
    if (busy || blocked || readOnly || lawyer.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || lawyer.promoted || lawyer.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: LawyerAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `lawyer-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`lawyer-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <LawyerHistory lawyer={lawyer} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶律师魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="律师服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{lawyer.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{lawyer.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="lawyer-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "lawyer-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="律师成长下一步">
        <span className="seer-seal">{lawyer.promoted ? "序列 9" : "律师成长卷宗"}</span>
        <h3>{lawyer.title}</h3>
        {lawyer.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次文书与谈话接触：</strong>{nextLabel || "查看当前公开结束选项"}。须把原文书实际放回并结束本次谈话。结束不消耗行动或灵性，0精神时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原条款、当事人的选择与本次结果继续保留。</p>
        ) : lawyer.promoted && lawyer.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{lawyer.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{lawyer.digestion}</p>
        {!lawyer.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">{playerText("取得渠道或晋升不会自动加入组织。成年文书员米蕾·沃德、成品供给、三项实践与数值为本作原创G。理解既存条款、核对当前事实并尊重当事人的自主选择是本阶段G扮演解释，可完成本阶段消化。本作故事不构成现实法律建议。")}</p>
      </section>

      {lawyer.promoted && <section className="slice-notice warrior-environment" aria-label="现场与本次文书与谈话接触">
        <h4>现场与本次文书与谈话接触</h4>
        <p>{lawyer.environment || "尚未取得现场公开记录；原文条款、当前事实、论证与当事人的实际选择须经行动分别确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="律师有限实践">
          <h3>文书核对与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || lawyer.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {lawyer.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前律师实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次文书与谈话接触：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未核对原文与现场；具体条款、当事人的选择与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的论证、普通核对、实际归还文书与结束谈话见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="条款、论证与自主选择边界">
              <h4>条款、论证与自主选择边界</h4>
              <p>先核对原文条款与当前事实，再按公开选项准备有说服力的论证或普通核对。已有条款、提出的理由与当事人的实际选择是不同的事实；只有实际提交后的公开记录才会显示。准备、执行、归还文书并结束谈话、报告分别提交，成本与限制以公开按钮为准。</p>
              <p className="slice-muted">律师能理解既存规则、组织有说服力的论证并识别当前破绽，不能凭空创造条款或读取未知事实，也不是强迫他人服从的心灵控制。当事人可以拒绝、离开或提出异议。实际文书与谈话接触尚未结束时，须把原文书放回并结束谈话，再做其它事务；失败也不代替实际结束。结束不另抽随机、不奖励、不退款、不治疗，不会抹去已经发生的结果。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="原条款、实际选择与有限报告" aria-live="polite" aria-atomic="true">
              <h4>原条款、实际选择与有限报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前律师实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="律师成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {lawyer.story && <p className="slice-muted">{lawyer.story}</p>}

      {lawyer.discovered && <section className="slice-notice warrior-source" aria-label="律师成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {lawyer.supplies && <p>{lawyer.supplies}</p>}
      </section>}
      {lawyer.discovered && lawyer.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!lawyer.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {lawyer.bottles.map((bottle) => {
            const action = lawyer.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !lawyer.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !lawyer.promoted && !lawyer.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `lawyer-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`lawyer-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {lawyer.discovered && !lawyer.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{lawyer.risk}</p></details>}
      {lawyer.promoted && (
        <section className="warrior-abilities" aria-label="律师能力与消化">
          <h3>能力与消化 · {lawyer.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列9具备规则分析、说服论证与弱点识别；只针对已有规则与当前可知事实，当事人仍自主决定。能力、掌握与边界以已公开记录为准；不提供序列8的身体强化、序列7的贿赂或更高序列的扭曲。普通武器、掩体与撤退沿用共同战斗界面，不包装成非凡能力。</p>
          <p>扮演进度 {lawyer.acting} · 消化：{lawyer.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {lawyer.pollution}</p>
          {lawyer.abilities.map((ability) => (
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
