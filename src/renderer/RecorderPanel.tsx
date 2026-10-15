import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { RecorderAction, RecorderCommand, RecorderProjection } from "../domain/recorder/types";
import type { AstrologerProjection } from "../domain/astrologer/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已核对来源与边界", PREPARED: "已准备待执行方法",
  EXAMINED: "已有实际结果，待结束与复核", RESOLVED: "已提交本次有限报告",
};

/** Earlier observations and the independent NPC probe remain public, read-only history. */
export function RecorderAstrologerHistory({ astrologer }: { astrologer: AstrologerProjection }) {
  return <section className="seer-panel astrologer-panel" aria-label="占星人时期的经历">
    <h3>占星人时期的经历</h3>
    <p className="slice-notice">你已晋升记录官。这里保留占星人时期的原资料、实际方法、有限结果、独立探测试验与原瓶，只供回看；旧成长不会再次结算扮演进度。</p>
    <p>占星人扮演进度 {astrologer.acting} · 消化：{astrologer.digestion}</p>
    {astrologer.story && <p>{astrologer.story}</p>}
    {astrologer.supplies && <p>{astrologer.supplies}</p>}
    {astrologer.environment && <p>{astrologer.environment}</p>}
    {astrologer.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      {entry.result && <p>当时的实际核实与试验：{entry.result}</p>}
    </details>)}
    {astrologer.bottles.length > 0 && <details className="seer-fold">
      <summary>占星人原瓶 · 来源与去向</summary>
      {astrologer.bottles.map((bottle) => <article className="astrologer-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {astrologer.abilities.length > 0 && <details className="seer-fold">
      <summary>占星人时期能力记录</summary>
      {astrologer.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface RecorderPanelProps {
  recorder: RecorderProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: RecorderCommand) => void;
}
function isCaseAction(action: RecorderAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: RecorderAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Selection never creates a recording, consumes an original or resolves an action locally. */
export function RecorderPanel({ recorder, resources, busy, blocked = false, error = null, onCommand }: RecorderPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = recorder.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = recorder.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = recorder.actions.filter(isCaseAction);
  // An actual public CLOSE intent, rather than historical prose, identifies the open scene.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (recorder.insideCase ? recorder.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? recorder.cases.find((entry) => entry.id === selectedCaseId)
    ?? recorder.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? recorder.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!recorder.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = recorder.insideCase ? [] : recorder.actions.filter(isEncounterAction);
  const recordingActions = recorder.insideCase ? [] : recorder.actions.filter((action) => action.command.type === "RECORD"
    && recorder.samples.some((sample) => action.command.type === "RECORD" && sample.id === action.command.sample));
  const growthActions = recorder.insideCase ? [] : recorder.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "RECORD" && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = recorder.insideCase ? closeAction : !recorder.promoted
    ? recorder.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...recordingActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !recorder.promoted && !recorder.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (recorder.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, recorder.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || recorder.promoted || recorder.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, recorder.promoted, recorder.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: RecorderAction) {
    if (busy || interactionBlocked || recorder.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || recorder.promoted || recorder.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: RecorderAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `recorder-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`recorder-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel astrologer-panel seer-confirmation" aria-label="这瓶记录官魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); } }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="记录官服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{recorder.risk}</p></section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{recorder.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="recorder-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "recorder-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试答复。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel astrologer-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="记录官成长下一步">
      <span className="seer-seal">{recorder.promoted ? "序列 6" : "记录官晋升卷宗"}</span><h3>{recorder.title}</h3>
      <p className="seer-next">{recorder.insideCase
        ? <><strong>先实际结束本次实践：</strong>{nextAction?.label || "查看当前公开结束选项"}。离场为0行动、0精神、0灵性；原记录的去向、失败与消耗继续保留。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : recorder.promoted && recorder.acting >= 100 ? "本阶段已消化，可以继续生活或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{recorder.digestion}</p>
      {!recorder.promoted && <p className="slice-muted">指导、每瓶劳务、取得成品原瓶与逐瓶服用确认分别进行；费用、成熟度与补给以当前公开选项为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方、材料与剂量仍未核实，不开放材料采购或调配。具体教学、费用、判定和消化数值为本作原创G。")}</p>
    </section>
    {recorder.promoted && <section className="slice-notice" aria-label="记录官能力边界">
      <h4>先实际记录，再一次性释放原记录</h4>
      <p>记录需要现场真实示范与知识判定，失败也保留本次成本。容量不赠送能力；成功储存的每份原记录只能释放一次，释放后保留来源与去向。</p>
      <p className="slice-muted">当前只有公开列出的两种低序列样本。三案均有普通核实路线；缺少示范时可以普通复核或拒绝越界。记录官尚无旅行家的自身旅行能力；可以记录他人的旅行能力，但这里没有可用的真实旅行示范。</p>
    </section>}
    {recorder.promoted && <section aria-label="原记录与实际容量" aria-live="polite" aria-atomic="true">
      <h3>原记录与容量</h3>
      <dl className="seer-facts">{recorder.capacities.map((capacity) => <div key={capacity.tier}>
        <dt>{capacity.label}</dt><dd>{capacity.used} / {capacity.maximum}<small> · {capacity.boundary}</small></dd>
      </div>)}</dl>
      {recorder.records.length === 0 ? <p className="slice-muted">尚无已成功储存的原记录；空容量不能直接释放能力。</p>
        : <details className="seer-fold" open><summary>已保存的原记录 · {recorder.records.length} 份</summary>
          {recorder.records.map((record) => <article className="astrologer-history-bottle" key={record.id}>
            <h4>{record.label} · 序列 {record.sequence} · {record.status === "STORED" ? "尚未释放" : "已释放，原记录已消耗"}</h4>
            <p className="slice-muted">原记录ID：{record.id}</p><p>来源：{record.source}</p>
            <p className="slice-muted">原示范ID：{record.sourceDemoId} · 第{record.createdWeek}周实际记录{record.releasedWeek !== null ? ` · 第${record.releasedWeek}周实际释放` : ""}</p>
          </article>)}
        </details>}
    </section>}
    {recorder.promoted && recorder.samples.length > 0 && <details className="seer-fold" open={!recorder.insideCase}>
      <summary>当前可核对的示范来源</summary>
      {recorder.samples.map((sample) => <section key={sample.id} aria-label={`${sample.label}的示范与记录`}>
        <h4>{sample.label}</h4><p>来源：{sample.source}</p>
        <p className="slice-muted">示范者当前灵性 {sample.instructorSpirituality} · 已储存 {sample.stored} 份 · {sample.lastAttemptWeek === null ? "尚未实际尝试记录" : `最近尝试：第${sample.lastAttemptWeek}周`}</p>
        {recordingActions.filter((action) => action.command.type === "RECORD" && action.command.sample === sample.id).map(actionButton)}
      </section>)}
    </details>}
    {recorder.promoted && recorder.environment && <section aria-label="当前记录官现场"><h4>当前现场</h4><p>{recorder.environment}</p></section>}
    {selectedCase && <section aria-label="记录官有限实践">
      <h3>原记录、实际使用与普通核实</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || recorder.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {recorder.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前记录官实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次接触：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="公开观察与原失败记录"><h4>公开观察与原失败记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际核对记录；不能凭容量或叙述补出示范、能力或实际结果。</p>}
        </section>
        <section aria-label="实际方法与准备"><h4>实际方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的方法。选择准备不会提前记录、释放能力或完成普通核实。"}</p>
        </section>
        {selectedCase.result && <section aria-label="有限实践与实际结果" aria-live="polite" aria-atomic="true"><h4>有限实践与实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前记录官实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">撤回准备不等于实际退出。实施后须结束本次能力并实际离场，再复核和报告；离场不另抽随机、不奖励、不退款、不治疗。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="记录官成长行动">{growthActions.map(actionButton)}</div>}
    {recorder.story && <p className="slice-muted">{recorder.story}</p>}
    {encounterActions.length > 0 && <section aria-label="有限现场冲突"><h3>有限现场冲突</h3>
      <p className="slice-muted">按公开选项交涉或承担真实战斗风险。可用原记录及本轮释放选择以战斗面板为准，未选中或没有原记录时仍可使用普通动作。</p>
      <div className="warrior-action-list" role="group" aria-label="现场冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {recorder.discovered && recorder.supplies && <section className="slice-notice" aria-label="记录官成品原瓶供给"><h4>成品原瓶与实际供给</h4><p>{recorder.supplies}</p></section>}
    {recorder.discovered && recorder.bottles.length > 0 && <details className="seer-fold" open={!recorder.promoted}>
      <summary>记录官独立成品原瓶 · 来源与去向</summary>
      {recorder.bottles.map((bottle) => {
        const action = recorder.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !recorder.promoted ? "seer-bottle" : "astrologer-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !recorder.promoted && !recorder.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `recorder-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>{action.reason && <p className="seer-action-reason" id={`recorder-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {recorder.discovered && !recorder.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{recorder.risk}</p></details>}
    {recorder.promoted && <section aria-label="记录官能力与消化"><h3>能力与消化 · {recorder.abilities.length} 项训练记录</h3>
      <p>扮演进度 {recorder.acting} · 消化：{recorder.digestion}</p><p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {recorder.pollution}</p>
      {recorder.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
