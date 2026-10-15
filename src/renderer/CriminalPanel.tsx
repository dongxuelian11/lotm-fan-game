import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { CriminalAction, CriminalCommand, CriminalProjection } from "../domain/criminal/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与能力边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际执行，请核对原物与结果",
  RESOLVED: "已提交本次实践报告",
};

/** Other-pathway history has no mutation callback or actionable controls. */
export function CriminalHistory({ criminal }: { criminal: CriminalProjection }) {
  const title = "罪犯渠道经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">这里保留罪犯时期的渠道、原瓶与实践记录，只供回看；当前成长请查看对应卷宗。</p>
    {criminal.story && <p>{criminal.story}</p>}
    {criminal.supplies && <p>{criminal.supplies}</p>}
    {criminal.environment && <p>{criminal.environment}</p>}
    {criminal.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">原物去向：{entry.holding} · 曾拿取原物：{entry.tookOriginal ? "是" : "否"} · 实际归还次数：{entry.returns}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {criminal.bottles.length > 0 && <details className="seer-fold" open>
      <summary>罪犯原瓶 · 来源与去向</summary>
      {criminal.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {criminal.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {criminal.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: CriminalAction): boolean {
  return "caseId" in action.command;
}

interface CriminalPanelProps {
  criminal: CriminalProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: CriminalCommand) => void;
}

/** Only committed public facts change original custody, preparation, or reports. */
export function CriminalPanel({ criminal, resources, busy, blocked, readOnly = false, onCommand }: CriminalPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => criminal.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = criminal.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = criminal.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = criminal.actions.filter(isCaseAction);
  // Actual custody selects the public RETURN target; history and prose never create a lock.
  const returnAction = criminal.actions.find((action) => action.command.type === "RETURN");
  const returnCaseId = returnAction?.command.type === "RETURN" ? returnAction.command.caseId : null;
  const selectedCase = (criminal.insideCase ? criminal.cases.find((entry) => entry.id === returnCaseId) : undefined)
    ?? criminal.cases.find((entry) => entry.id === selectedCaseId)
    ?? criminal.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? criminal.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!criminal.insideCase || action.command.type === "RETURN")) : [];
  const actions = criminal.insideCase ? [] : criminal.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = criminal.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "RETURN" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "RETURN")
    : criminal.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : criminal.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (criminal.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [criminal.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !criminal.promoted && !criminal.insideCase && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || criminal.promoted || criminal.insideCase || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, criminal.promoted, criminal.insideCase, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: CriminalAction) {
    if (busy || blocked || readOnly || criminal.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || criminal.promoted || criminal.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: CriminalAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `criminal-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`criminal-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <CriminalHistory criminal={criminal} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶罪犯魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="罪犯服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{criminal.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{criminal.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="criminal-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "criminal-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="罪犯成长下一步">
        <span className="seer-seal">{criminal.promoted ? "序列 9" : "罪犯成长卷宗"}</span>
        <h3>{criminal.title}</h3>
        {criminal.insideCase ? (
          <p className="seer-next"><strong>先把手中的原物实际交还：</strong>{nextLabel || "查看当前公开归还选项"}。归还不消耗行动或灵性，0精神时仍可执行；它不治疗伤势、不退还此前成本，也不抹去拿取记录。</p>
        ) : criminal.promoted && criminal.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{criminal.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{criminal.digestion}</p>
        {!criminal.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">{playerText("取得渠道或晋升不会自动加入组织。成年指导者罗安·费里、成品供给、三项实践与数值为本作原创G。守住良知的身体与判断实践是本阶段G扮演解释，不是原著保证，也不保证更高序列无需代价。")}</p>
      </section>

      {criminal.promoted && <section className="slice-notice warrior-environment" aria-label="现场与原物去向">
        <h4>现场与原物去向</h4>
        <p>{criminal.environment || "尚未取得现场公开记录；当事人、原物归属与本次结果须经实际观察和行动确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="罪犯有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || criminal.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {criminal.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前罪犯实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">原物去向：{selectedCase.holding}</p>
            <p className="slice-muted">曾拿取原物：{selectedCase.tookOriginal ? "是" : "否"} · 实际归还次数：{selectedCase.returns}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；原物归属、具体条件与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的行动、原物交还与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="实践范围与良知边界">
              <h4>实践范围与良知边界</h4>
              <p>先观察原现场，再选择已公开的身体与敏锐直觉方法或普通协作。准备、实际执行、原物归还与报告分别提交，成本与限制以公开按钮为准。敏锐直觉仍须核实，不能预测尚未发生的危险。</p>
              <p className="slice-muted">拿取只会把眼前的原工资袋放到手中，不能变为个人可花现金；原物与主人以当前公开记录为准。实际拿取后，须交到原主人手中才能安排其它事务。归还保留拿取历史，不退款、不治疗；未拿取时仍可继续普通生活。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="实际执行与报告记录" aria-live="polite" aria-atomic="true">
              <h4>实际执行与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前罪犯实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="罪犯成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {criminal.story && <p className="slice-muted">{criminal.story}</p>}

      {criminal.discovered && <section className="slice-notice warrior-source" aria-label="罪犯成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {criminal.supplies && <p>{criminal.supplies}</p>}
      </section>}
      {criminal.discovered && criminal.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!criminal.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {criminal.bottles.map((bottle) => {
            const action = criminal.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !criminal.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !criminal.promoted && !criminal.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `criminal-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`criminal-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {criminal.discovered && !criminal.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{criminal.risk}</p></details>}
      {criminal.promoted && (
        <section className="warrior-abilities" aria-label="罪犯能力与消化">
          <h3>能力与消化 · {criminal.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列9拥有强健身体与敏锐直觉，仍保留良知与自己的选择。能力、掌握与边界以已公开记录为准；不提供序列6的危险预知、毒素免疫或火焰能力。</p>
          <p>扮演进度 {criminal.acting} · 消化：{criminal.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {criminal.pollution}</p>
          {criminal.abilities.map((ability) => (
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
