import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ReaderAction, ReaderCommand, ReaderProjection } from "../domain/reader/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未阅读",
  READ: "已阅读资料",
  ANALYZED: "已对照资料，等待提交",
  RESOLVED: "已有提交结果",
};

function isCaseAction(action: ReaderAction): boolean {
  return "caseId" in action.command;
}

interface ReaderPanelProps {
  reader: ReaderProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: ReaderCommand) => void;
}

/** Sources, comparisons and outcomes come only from the public projection. The player chooses the conclusion. */
export function ReaderPanel({ reader, resources, busy, blocked, readOnly = false, onCommand }: ReaderPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = reader.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = reader.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = reader.actions.filter(isCaseAction);
  const selectedCase = reader.cases.find((entry) => entry.id === selectedCaseId)
    ?? reader.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? reader.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = reader.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = reader.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : reader.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // A pair of conclusion buttons must remain a player choice, not a recommended answer.
  const nextLabel = nextAction?.command.type === "SUBMIT" ? "对照资料与分析记录，选择本次提交的结论。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !reader.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || reader.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, reader.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ReaderAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || reader.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: ReaderAction) {
    return (
      <div className="seer-action reader-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `reader-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`reader-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel reader-panel seer-confirmation" aria-label="这瓶阅读者魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="阅读者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{reader.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{reader.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="reader-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "reader-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel reader-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="阅读者成长下一步">
        <span className="seer-seal">{reader.promoted ? "序列 9" : "阅读者成长卷宗"}</span>
        <h3>{reader.title}</h3>
        {readOnly ? (
          <p className="seer-next">已选择其它途径，这份阅读者渠道只供回看。</p>
        ) : reader.promoted && reader.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的案卷与提交结果。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{reader.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{reader.digestion}</p>
        {!reader.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">取得渠道或晋升不会自动加入教会。阅读必须有可访问资料，理解与结论仍需证据。</p>
      </section>

      {reader.promoted && <section className="slice-notice reader-environment" aria-label="已知案卷环境">
        <h4>已知案卷环境</h4>
        <p>{reader.environment || "案卷来源与可用资料尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="阅读者案卷">
          <h3>案卷阅读与核实</h3>
          <label className="seer-case-selector">
            选择案卷
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {reader.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case reader-case" aria-label="当前案卷">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">案卷状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="reader-sources" aria-label="已阅读的公开资料">
              <h4>已阅读的公开资料</h4>
              {selectedCase.documents.length > 0
                ? <div className="reader-source-list">{selectedCase.documents.map((document, index) => (
                  <article className="reader-source-card" key={`${selectedCase.id}-${index}`} aria-label={`公开资料 ${index + 1}`}>
                    <span className="reader-source-number">资料 {index + 1}</span>
                    <p>{document}</p>
                  </article>
                ))}</div>
                : <p className="slice-muted">尚未阅读本案资料，不能据此确认缺失的内容。</p>}
            </section>
            {selectedCase.analysis && <section className="slice-notice reader-analysis" aria-label="资料分析与待核之处">
              <h4>资料分析与待核之处</h4><p>{selectedCase.analysis}</p>
            </section>}
            {selectedCase.result && <section className="reader-result" aria-label="实际提交结果">
              <h4>实际提交结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="reader-action-list" role="group" aria-label="当前案卷行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="reader-action-list" role="group" aria-label="阅读者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {reader.story && <p className="slice-muted">{reader.story}</p>}

      {reader.discovered && reader.supplies && <p className="slice-notice">{reader.supplies}</p>}
      {reader.discovered && reader.bottles.length > 0 && (
        <details className="seer-fold reader-bottles" open={!reader.promoted}>
          <summary>导师的独立成品原瓶 · 来源与去向</summary>
          {reader.bottles.map((bottle) => {
            const action = reader.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !reader.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !reader.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `reader-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`reader-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {reader.discovered && !reader.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{reader.risk}</p></details>}
      {reader.promoted && (
        <section className="reader-abilities" aria-label="阅读者能力与消化">
          <h3>能力与消化 · {reader.abilities.length} 项能力</h3>
          <p className="slice-muted">{playerText("本阶段依据已确认的游戏设计实现阅读与资料核实；具体能力与完整配方的原著正文仍待核实。记住资料不等于证明其真实，未提供的来源与事实仍未知。")}</p>
          <p>扮演进度 {reader.acting} · 消化：{reader.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {reader.pollution}</p>
          {reader.abilities.map((ability) => (
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
