import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DetectiveAction, DetectiveCommand, DetectiveProjection } from "../domain/detective/types";
import type { ReaderProjection } from "../domain/reader/types";
import type { ReasonerProjection } from "../domain/reasoner/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察", SURVEYED: "已有现场残留", RECONSTRUCTED: "已有实际重构记录", RESOLVED: "已有报告结果",
};
const READER_STATUS: Record<string, string> = {
  AVAILABLE: "尚未阅读", READ: "已阅读资料", ANALYZED: "已对照资料，等待提交", RESOLVED: "已有提交结果",
};
const REASONER_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察", EXAMINED: "已有观察与待检验假设", TESTED: "已有实际检验结果", RESOLVED: "已有结论结果",
};

function PreviousSequenceRecords({ title, state }: { title: string; state: ReaderProjection | ReasonerProjection }) {
  return <>
    {state.bottles.length > 0 && <details className="seer-fold">
      <summary>{title}原瓶 · 来源与去向</summary>
      {state.bottles.map((bottle) => <article className="detective-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {state.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的{title}能力</summary>
      {state.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </>;
}

/** Archives have no command callback, even if an older projection still contains actions. */
export function DetectiveReaderHistory({ reader }: { reader: ReaderProjection }) {
  return <section className="seer-panel detective-panel" aria-label="阅读者时期的经历">
    <h3>阅读者时期的经历</h3>
    <p className="slice-notice">你已晋升守知者（侦探）。这里保留阅读者时期的实际资料、分析、提交结果与原瓶记录，当前实践请回到守知者卷宗。</p>
    <p>阅读者扮演进度 {reader.acting} · {reader.digestion}</p>
    {reader.environment && <p className="slice-muted">{reader.environment}</p>}
    {reader.cases.length > 0 && <section aria-label="阅读者案卷历史">
      {reader.cases.map((entry) => <details className="seer-fold" key={entry.id}>
        <summary>{entry.title} · {READER_STATUS[entry.status] ?? entry.status}</summary>
        <p>{entry.story}</p>
        {entry.documents.length > 0 && <section aria-label={`${entry.title}的已阅读资料`}>
          <h4>已阅读的公开资料</h4><ul>{entry.documents.map((document, index) => <li key={index}>{document}</li>)}</ul>
        </section>}
        {entry.analysis && <section aria-label={`${entry.title}的原分析`}><h4>原资料分析</h4><p>{entry.analysis}</p></section>}
        {entry.result && <section aria-label={`${entry.title}的原提交结果`}><h4>实际提交结果</h4><p>{entry.result}</p></section>}
      </details>)}
    </section>}
    <PreviousSequenceRecords title="阅读者" state={reader} />
  </section>;
}

export function ReasonerHistory({ reasoner }: { reasoner: ReasonerProjection }) {
  return <section className="seer-panel detective-panel" aria-label="推理学员时期的经历">
    <h3>推理学员时期的经历</h3>
    <p className="slice-notice">你已晋升守知者（侦探）。这里保留推理学员时期的实际观察、假设、检验、结论与原瓶记录，当前实践请回到守知者卷宗。</p>
    <p>推理学员扮演进度 {reasoner.acting} · {reasoner.digestion}</p>
    {reasoner.environment && <p className="slice-muted">{reasoner.environment}</p>}
    {reasoner.cases.length > 0 && <section aria-label="推理学员案卷历史">
      {reasoner.cases.map((entry) => <details className="seer-fold" key={entry.id}>
        <summary>{entry.title} · {REASONER_STATUS[entry.status] ?? entry.status}</summary>
        <p>{entry.story}</p>
        {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}>
          <h4>已取得的现场观察</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
        </section>}
        {entry.hypotheses.length > 0 && <section aria-label={`${entry.title}的原假设`}>
          <h4>原竞争假设</h4><ul>{entry.hypotheses.map((hypothesis, index) => <li key={index}>{hypothesis}</li>)}</ul>
        </section>}
        {entry.testResult && <section aria-label={`${entry.title}的原检验`}><h4>实际检验记录</h4><p>{entry.testResult}</p></section>}
        {entry.result && <section aria-label={`${entry.title}的原结论`}><h4>实际结论结果</h4><p>{entry.result}</p></section>}
      </details>)}
    </section>}
    <PreviousSequenceRecords title="推理学员" state={reasoner} />
  </section>;
}

function isCaseAction(action: DetectiveAction): boolean {
  return "caseId" in action.command;
}

interface DetectivePanelProps {
  detective: DetectiveProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: DetectiveCommand) => void;
}

/** Only projected traces, reconstruction and gaps are displayed. No plan or report is chosen for the player. */
export function DetectivePanel({ detective, resources, busy, blocked, readOnly = false, onCommand }: DetectivePanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = detective.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = detective.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = detective.actions.filter(isCaseAction);
  const selectedCase = detective.cases.find((entry) => entry.id === selectedCaseId)
    ?? detective.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? detective.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = detective.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = detective.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : detective.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Reconstruction plans and reports remain equally presented choices, never a suggested first answer.
  const choosingPlan = nextAction?.command.type === "RECONSTRUCT";
  const choosingReport = nextAction?.command.type === "REPORT";
  const nextLabel = choosingPlan ? "对照已取得的现场残留，选择本次重构方案。"
    : choosingReport ? "比较现场残留、实际重构与证据缺口，选择本次报告。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !detective.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || detective.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, detective.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: DetectiveAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || detective.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: DetectiveAction) {
    return (
      <div className="seer-action detective-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `detective-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`detective-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel detective-panel seer-confirmation" aria-label="这瓶守知者魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="守知者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{detective.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{detective.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="detective-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "detective-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel detective-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="守知者成长下一步">
        <span className="seer-seal">{detective.promoted ? "序列 7" : "守知者晋升卷宗"}</span>
        <h3>{detective.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份守知者卷宗只供回看。</p>
        ) : detective.promoted && detective.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的重构与报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!choosingPlan && !choosingReport && !nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{detective.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{detective.digestion}</p>
        {!detective.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。须完成推理学员100消化与八个完整序列8周，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("守知者（侦探）的知识、推理与器械运用有原著依据；具体实践、数值与成品药渠道属于游戏设定（G），完整配方仍未核实。取得渠道或晋升不会自动加入教会。")}</p>
      </section>

      {detective.promoted && <section className="slice-notice detective-environment" aria-label="已知重构环境">
        <h4>已知重构环境</h4>
        <p>{detective.environment || "现场残留与可用工具尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="守知者实践案卷">
          <h3>现场残留、重构与证据缺口</h3>
          <label className="seer-case-selector">
            选择案卷
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {detective.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case detective-case" aria-label="当前案卷">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">案卷状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="detective-traces" aria-label="已取得的现场残留">
              <h4>已取得的现场残留</h4>
              {selectedCase.traces.length > 0
                ? <ol>{selectedCase.traces.map((trace, index) => <li key={`${selectedCase.id}-trace-${index}`}>{trace}</li>)}</ol>
                : <p className="slice-muted">尚未取得现场残留，不能确认未提供的事实。</p>}
              <p className="slice-muted">这里只列出实际取得的残留；记录顺序不代表事件发生顺序。</p>
            </section>
            {selectedCase.reconstruction && <section className="slice-notice detective-reconstruction" aria-label="实际重构记录">
              <h4>实际重构记录 · 顺序与轨迹</h4><p>{selectedCase.reconstruction}</p>
            </section>}
            <section className="detective-gaps" aria-label="尚未补足的证据缺口">
              <h4>尚未补足的证据缺口</h4>
              {selectedCase.gaps.length > 0
                ? <ul>{selectedCase.gaps.map((gap, index) => <li key={`${selectedCase.id}-gap-${index}`}>{gap}</li>)}</ul>
                : <p className="slice-muted">尚无已记录的缺口，不代表证据完整。</p>}
              <p className="slice-muted">重构受现有残留约束，不能补出未留下的对白、动机或身份，也不能自动定罪。</p>
            </section>
            {selectedCase.result && <section className="detective-result" aria-label="实际报告结果">
              <h4>实际报告结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="detective-action-list" role="group" aria-label="当前案卷行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="detective-action-list" role="group" aria-label="守知者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {detective.story && <p className="slice-muted">{detective.story}</p>}

      {detective.discovered && detective.supplies && <p className="slice-notice">{detective.supplies}</p>}
      {detective.discovered && detective.bottles.length > 0 && (
        <details className="seer-fold detective-bottles" open={!detective.promoted}>
          <summary>守知者独立成品原瓶 · 来源与去向</summary>
          {detective.bottles.map((bottle) => {
            const action = detective.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !detective.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !detective.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `detective-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`detective-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {detective.discovered && !detective.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{detective.risk}</p></details>}
      {detective.promoted && (
        <section className="detective-abilities" aria-label="守知者能力与消化">
          <h3>能力与消化 · {detective.abilities.length} 项能力</h3>
          <p className="slice-muted">{playerText("现场重构只整理已有残留支持的顺序、轨迹和缺口。武器、格斗与敏捷仍受实际身体和器械限制；不会复制他人的非凡能力。具体实践与数值为游戏设定（G），完整魔药配方仍待核实。")}</p>
          <p>扮演进度 {detective.acting} · 消化：{detective.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {detective.pollution}</p>
          {detective.abilities.map((ability) => (
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
