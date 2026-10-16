import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ArbiterAction, ArbiterCommand, ArbiterProjection } from "../domain/arbiter/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察争议现场与能力边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际尝试，请核对当事人的选择与结果",
  RESOLVED: "已提交本次实践报告",
};

/** Other-pathway history has no mutation callback or actionable controls. */
export function ArbiterHistory({ arbiter }: { arbiter: ArbiterProjection }) {
  const title = "仲裁人渠道经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">这里保留仲裁人时期的渠道、原瓶与实践记录，只供回看；当前成长请查看对应卷宗。</p>
    {arbiter.story && <p>{arbiter.story}</p>}
    {arbiter.supplies && <p>{arbiter.supplies}</p>}
    {arbiter.environment && <p>{arbiter.environment}</p>}
    {arbiter.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次调解接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {arbiter.bottles.length > 0 && <details className="seer-fold" open>
      <summary>仲裁人原瓶 · 来源与去向</summary>
      {arbiter.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {arbiter.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {arbiter.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: ArbiterAction): boolean {
  return "caseId" in action.command;
}

interface ArbiterPanelProps {
  arbiter: ArbiterProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: ArbiterCommand) => void;
}

/** Only committed public facts change mediation contact, preparation, or reports. */
export function ArbiterPanel({ arbiter, resources, busy, blocked, readOnly = false, onCommand }: ArbiterPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => arbiter.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = arbiter.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = arbiter.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = arbiter.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open contact; prose and old results never create a lock.
  const closeAction = arbiter.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? arbiter.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (arbiter.insideCase ? arbiter.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? arbiter.cases.find((entry) => entry.id === selectedCaseId)
    ?? arbiter.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? arbiter.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!arbiter.insideCase || action.command.type === "CLOSE")) : [];
  const actions = arbiter.insideCase ? [] : arbiter.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = arbiter.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : arbiter.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : arbiter.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (arbiter.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [arbiter.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !arbiter.promoted && !arbiter.insideCase && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || arbiter.promoted || arbiter.insideCase || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, arbiter.promoted, arbiter.insideCase, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ArbiterAction) {
    if (busy || blocked || readOnly || arbiter.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || arbiter.promoted || arbiter.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: ArbiterAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `arbiter-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`arbiter-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <ArbiterHistory arbiter={arbiter} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶仲裁人魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="仲裁人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{arbiter.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{arbiter.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="arbiter-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "arbiter-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="仲裁人成长下一步">
        <span className="seer-seal">{arbiter.promoted ? "序列 9" : "仲裁人成长卷宗"}</span>
        <h3>{arbiter.title}</h3>
        {arbiter.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次调解接触：</strong>{nextLabel || "查看当前公开结束选项"}。须实际结束本次谈话，并沿普通退路离开。结束不消耗行动或灵性，0精神时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原争议、当事人的选择与本次结果继续保留。</p>
        ) : arbiter.promoted && arbiter.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{arbiter.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{arbiter.digestion}</p>
        {!arbiter.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">{playerText("取得渠道或晋升不会自动加入组织。成年民间调解文书员薇娜·贝尔、成品供给、三项实践与数值为本作原创G；她没有获任政府职务，取得能力也不自动授予你官方身份。依据当前事实提出公平安排，并尊重当事人的自主选择是本阶段G扮演解释，可完成本阶段消化。本作故事不构成现实法律建议。")}</p>
      </section>

      {arbiter.promoted && <section className="slice-notice warrior-environment" aria-label="现场与本次调解接触">
        <h4>现场与本次调解接触</h4>
        <p>{arbiter.environment || "尚未取得现场公开记录；现场争议、当前事实、调解提议与当事人的实际选择须经行动分别确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="仲裁人有限实践">
          <h3>调解、现场安排与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || arbiter.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {arbiter.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前仲裁人实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次调解接触：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察争议现场；具体事实、当事人的选择与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的威严影响、普通商谈、实际结束谈话与退出见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="威严、事实与自主选择边界">
              <h4>威严、事实与自主选择边界</h4>
              <p>先观察争议现场与当前事实，再按公开选项准备威严调解或普通商谈。提出的安排、能力造成的影响与当事人的实际选择是不同的事实；只有实际提交后的公开记录才会显示。准备、执行、实际结束谈话并退出、报告分别提交，成本与限制以公开按钮为准。</p>
              <p className="slice-muted">仲裁人的威严与说服力可能影响对方，但不保证服从，也不能凭态度判断陈述真假或宣告有罪。当事人可以拒绝、离开或提出异议；双方自主选择仍须实际记录。本次调解接触尚未结束时，须实际结束谈话并沿普通退路离开，再做其它事务；失败也不代替实际结束。结束不另抽随机、不奖励、不退款、不治疗，不会抹去已经发生的结果。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="原争议、实际选择与有限报告" aria-live="polite" aria-atomic="true">
              <h4>原争议、实际选择与有限报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前仲裁人实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="仲裁人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {arbiter.story && <p className="slice-muted">{arbiter.story}</p>}

      {arbiter.discovered && <section className="slice-notice warrior-source" aria-label="仲裁人成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {arbiter.supplies && <p>{arbiter.supplies}</p>}
      </section>}
      {arbiter.discovered && arbiter.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!arbiter.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {arbiter.bottles.map((bottle) => {
            const action = arbiter.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !arbiter.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !arbiter.promoted && !arbiter.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `arbiter-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`arbiter-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {arbiter.discovered && !arbiter.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{arbiter.risk}</p></details>}
      {arbiter.promoted && (
        <section className="warrior-abilities" aria-label="仲裁人能力与消化">
          <h3>能力与消化 · {arbiter.abilities.length} 项训练记录</h3>
          <p className="slice-muted">{playerText("序列9具备威严、说服力与格斗训练；威严可以影响他人，当事人仍自主决定。它不保证服从，不判定陈述真假，不宣告有罪，也不提供序列6的神秘禁令。战斗中的短暂迟疑是本阶段G实现，可能被抵抗，不取消对方行动；实际消耗与结果见正常回合日志。普通武器、掩体与撤退沿用共同战斗界面，不包装成额外非凡能力。")}</p>
          <p>扮演进度 {arbiter.acting} · 消化：{arbiter.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {arbiter.pollution}</p>
          {arbiter.abilities.map((ability) => (
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
