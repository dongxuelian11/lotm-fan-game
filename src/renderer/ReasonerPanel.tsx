import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ReasonerAction, ReasonerCommand, ReasonerProjection } from "../domain/reasoner/types";
import type { ReaderProjection } from "../domain/reader/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察",
  EXAMINED: "已有观察与待检验假设",
  TESTED: "已有实际检验结果",
  RESOLVED: "已有结论结果",
};

const READER_STATUS: Record<string, string> = {
  AVAILABLE: "尚未阅读", READ: "已阅读资料", ANALYZED: "已对照资料，等待提交", RESOLVED: "已有提交结果",
};

/** Previous-sequence history deliberately has no command callback or action controls. */
export function ReaderHistory({ reader }: { reader: ReaderProjection }) {
  return (
    <section className="seer-panel reasoner-panel" aria-label="阅读者时期的经历">
      <h3>阅读者时期的经历</h3>
      <p className="slice-notice">你已晋升推理学员。阅读者时期的资料、分析、提交结果与原瓶记录保留在这里，当前实践请回到推理学员卷宗。</p>
      <p>阅读者扮演进度 {reader.acting} · {reader.digestion}</p>
      {reader.environment && <p className="slice-muted">{reader.environment}</p>}
      {reader.cases.length > 0 && <section aria-label="阅读者案卷历史">
        {reader.cases.map((entry) => <details className="seer-fold" key={entry.id}>
          <summary>{entry.title} · {READER_STATUS[entry.status] ?? entry.status}</summary>
          <p>{entry.story}</p>
          {entry.documents.length > 0 && <section aria-label={`${entry.title}的已阅读资料`}>
            <h4>已阅读的公开资料</h4>
            <ul>{entry.documents.map((document, index) => <li key={index}>{document}</li>)}</ul>
          </section>}
          {entry.analysis && <section aria-label={`${entry.title}的原分析`}><h4>原资料分析</h4><p>{entry.analysis}</p></section>}
          {entry.result && <section aria-label={`${entry.title}的原提交结果`}><h4>实际提交结果</h4><p>{entry.result}</p></section>}
        </details>)}
      </section>}
      {reader.bottles.length > 0 && <details className="seer-fold">
        <summary>阅读者原瓶 · 来源与去向</summary>
        {reader.bottles.map((bottle) => <article className="reasoner-history-bottle" key={bottle.id}>
          <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
        </article>)}
      </details>}
      {reader.abilities.length > 0 && <details className="seer-fold">
        <summary>已继承的阅读者能力</summary>
        {reader.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      </details>}
    </section>
  );
}

function isCaseAction(action: ReasonerAction): boolean {
  return "caseId" in action.command;
}

interface ReasonerPanelProps {
  reasoner: ReasonerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: ReasonerCommand) => void;
}

/** Observations, hypotheses and committed outcomes come only from public state. No answer is selected for the player. */
export function ReasonerPanel({ reasoner, resources, busy, blocked, readOnly = false, onCommand }: ReasonerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = reasoner.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = reasoner.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = reasoner.actions.filter(isCaseAction);
  const selectedCase = reasoner.cases.find((entry) => entry.id === selectedCaseId)
    ?? reasoner.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? reasoner.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = reasoner.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = reasoner.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : reasoner.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Tests and conclusions remain equally presented choices, never a suggested first answer.
  const choosingTest = nextAction?.command.type === "TEST";
  const choosingConclusion = nextAction?.command.type === "CONCLUDE";
  const nextLabel = choosingTest ? "对照现场观察与各项假设，选择要实际进行的检验。"
    : choosingConclusion ? "比较观察、假设与实际检验记录，选择本次结论。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !reasoner.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || reasoner.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, reasoner.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ReasonerAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || reasoner.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: ReasonerAction) {
    return (
      <div className="seer-action reasoner-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `reasoner-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`reasoner-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel reasoner-panel seer-confirmation" aria-label="这瓶推理学员魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="推理学员服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{reasoner.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{reasoner.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="reasoner-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "reasoner-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel reasoner-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="推理学员成长下一步">
        <span className="seer-seal">{reasoner.promoted ? "序列 8" : "推理学员晋升卷宗"}</span>
        <h3>{reasoner.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份推理学员卷宗只供回看。</p>
        ) : reasoner.promoted && reasoner.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的检验与结论。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!choosingTest && !choosingConclusion && !nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{reasoner.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{reasoner.digestion}</p>
        {!reasoner.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。须完成阅读者100消化与四个完整序列9周，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("本阶段具体能力与成品药渠道属于游戏设定（G），原著细节与完整配方待核。取得渠道或晋升不会自动加入教会。")}</p>
      </section>

      {reasoner.promoted && <section className="slice-notice reasoner-environment" aria-label="已知推理环境">
        <h4>已知推理环境</h4>
        <p>{reasoner.environment || "现场、原始资料与可用工具尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="推理学员实践案卷">
          <h3>现场观察、假设与实际检验</h3>
          <label className="seer-case-selector">
            选择案卷
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {reasoner.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case reasoner-case" aria-label="当前案卷">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">案卷状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="reasoner-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察，不能确认未提供的事实。</p>}
            </section>
            <section className="reasoner-hypotheses" aria-label="待检验的竞争假设">
              <h4>待检验的竞争假设</h4>
              {selectedCase.hypotheses.length > 0
                ? <ul>{selectedCase.hypotheses.map((hypothesis, index) => <li key={`${selectedCase.id}-hypothesis-${index}`}>{hypothesis}</li>)}</ul>
                : <p className="slice-muted">尚无可供比较的假设。先查看本案现场与原始资料。</p>}
              <p className="slice-muted">假设只是可能的解释。检验需要本案实际提供的资料或工具，推理不会自动揭示真相。</p>
            </section>
            {selectedCase.testResult && <section className="slice-notice reasoner-test-result" aria-label="实际检验记录">
              <h4>实际检验记录</h4><p>{selectedCase.testResult}</p>
            </section>}
            {selectedCase.result && <section className="reasoner-result" aria-label="实际结论结果">
              <h4>实际结论结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="reasoner-action-list" role="group" aria-label="当前案卷行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="reasoner-action-list" role="group" aria-label="推理学员成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {reasoner.story && <p className="slice-muted">{reasoner.story}</p>}

      {reasoner.discovered && reasoner.supplies && <p className="slice-notice">{reasoner.supplies}</p>}
      {reasoner.discovered && reasoner.bottles.length > 0 && (
        <details className="seer-fold reasoner-bottles" open={!reasoner.promoted}>
          <summary>推理学员独立成品原瓶 · 来源与去向</summary>
          {reasoner.bottles.map((bottle) => {
            const action = reasoner.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !reasoner.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !reasoner.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `reasoner-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`reasoner-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {reasoner.discovered && !reasoner.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{reasoner.risk}</p></details>}
      {reasoner.promoted && (
        <section className="reasoner-abilities" aria-label="推理学员能力与消化">
          <h3>能力与消化 · {reasoner.abilities.length} 项能力</h3>
          <p className="slice-muted">{playerText("具体能力按游戏设定（G）实现有限观察、假设比较与实际检验；原著正文细节与完整配方仍待核实。结论必须受已有资料约束，不能读心、凭空生成证据或自动得知真相。")}</p>
          <p>扮演进度 {reasoner.acting} · 消化：{reasoner.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {reasoner.pollution}</p>
          {reasoner.abilities.map((ability) => (
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
