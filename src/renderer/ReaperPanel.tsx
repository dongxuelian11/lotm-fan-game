import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ReaperAction, ReaperCommand, ReaperProjection } from "../domain/reaper/types";
import type { ConspiratorProjection } from "../domain/conspirator/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场",
  OBSERVED: "已有公开观察",
  PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告",
  RESOLVED: "已提交有限报告",
};

/** Earlier plans, refusals and original bottles remain history, never repeatable growth. */
export function ReaperConspiratorHistory({ conspirator }: { conspirator: ConspiratorProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="阴谋家时期的经历">
    <h3>阴谋家时期的经历</h3>
    <p className="slice-notice">你已晋升收割者（序列5）。这里保留阴谋家时期三案的原事实、拒绝、修订、失败、实际结束、报告与独立原瓶，只供回看。</p>
    <p>阴谋家扮演进度 {conspirator.acting} · 消化：{conspirator.digestion}</p>
    {(conspirator.story || conspirator.environment || conspirator.supplies) && <details className="seer-fold">
      <summary>阴谋家原故事与供给</summary>
      {conspirator.story && <p>{conspirator.story}</p>}
      {conspirator.environment && <p>{conspirator.environment}</p>}
      {conspirator.supplies && <p>{conspirator.supplies}</p>}
    </details>}
    {conspirator.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方案与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {conspirator.bottles.length > 0 && <details className="seer-fold">
      <summary>阴谋家原瓶 · 来源与去向</summary>
      {conspirator.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {conspirator.abilities.length > 0 && <details className="seer-fold">
      <summary>阴谋家时期能力记录</summary>
      {conspirator.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface ReaperPanelProps {
  reaper: ReaperProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ReaperCommand) => void;
}

function isCaseAction(action: ReaperAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: ReaperAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function isExitAction(action: ReaperAction): boolean {
  return action.command.type === "CLOSE" || action.command.type === "WITHDRAW";
}

/** Render committed public observations and submit the original projected intent unchanged. */
export function ReaperPanel({ reaper, resources, busy, blocked = false, error = null, onCommand }: ReaperPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = reaper.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = reaper.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = reaper.actions.filter(isCaseAction);
  // Only public exit intents locate a currently open scene; prose is never parsed as state.
  const exitAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "WITHDRAW" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId : null;
  const selectedCase = (reaper.insideCase ? reaper.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? reaper.cases.find((entry) => entry.id === selectedCaseId)
    ?? reaper.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? reaper.cases[0];
  // SIGNAL opens an actual window before PERFORM. Being inside must not hide either command.
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = reaper.actions.filter(isEncounterAction);
  const growthActions = reaper.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = !reaper.promoted
    ? reaper.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && !isExitAction(action))
      ?? selectedCaseActions.find((action) => action.enabled)
      ?? growthActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !reaper.promoted && !reaper.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (reaper.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, reaper.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || reaper.promoted || reaper.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, reaper.promoted, reaper.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ReaperAction) {
    if (busy || interactionBlocked || reaper.insideCase || reaper.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || reaper.promoted || reaper.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: ReaperAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `reaper-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`reaper-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel reaper-panel seer-confirmation" aria-label="这瓶收割者魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方与晋升仪式仍待核实；本次只确认本作原创G指导流程中的这一成品原瓶，不表示无需仪式。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="收割者服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{reaper.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{reaper.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="reaper-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "reaper-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel reaper-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="收割者成长下一步">
      <span className="seer-seal">{reaper.promoted ? "序列 5" : "阴谋家6 → 收割者5"}</span>
      <h3>{reaper.title}</h3>
      {reaper.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : reaper.insideCase ? "请查看当前公开的结束实践选项。"
          : reaper.promoted && reaper.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{reaper.digestion}</p>
      {reaper.discovered && !reaper.promoted && <p className="slice-muted">用药指导：{reaper.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得原瓶与逐瓶确认分别进行；实际费用、成熟条件与安全恢复范围以公开记录为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与晋升仪式尚未核实，材料、剂量、调配顺序及仪式要求保持未知，不能据此断言无需仪式。本阶段采用本作原创G的独立成品渠道与指导服药流程。")}</p>
    </section>

    {reaper.promoted && reaper.environment && <section aria-label="当前收割者现场">
      <h4>当前现场</h4><p>{reaper.environment}</p>
    </section>}
    {selectedCase && <section aria-label="收割者有限实践">
      <h3>观察、窗口与实际结果</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || reaper.insideCase}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {reaper.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前收割者实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section className="slice-notice" aria-label="当前公开窗口与实践记录">
          <h4>当前窗口与原练习记录</h4><p>{selectedCase.windowOpen}</p><p>{selectedCase.practice}</p>
        </section>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察，不能把猜测当作已发现的弱点或已打开的窗口。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备不会提前开窗、命中或完成报告；效果只在实际执行并保存后显示。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="收割者实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前收割者实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {reaper.insideCase && <p className="slice-muted">返回生活前须按公开选项实际收束当前窗口或接触。0行动、0精神、0灵性时仍可使用已开放的结束或撤回选项；不会另抽随机、发奖、退款、治疗或清除原失败。撤回与结束各自的实际作用以原选项和已保存记录为准。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="收割者成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="收割者有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">按公开选项选择交涉或承担真实战斗风险。观察弱点不保证命中或必杀，防护、反击与退出以当前现场和实际结算为准。</p>
      <div className="warrior-action-list" role="group" aria-label="收割者冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {reaper.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{reaper.story}</p></details>}
    {reaper.discovered && reaper.supplies && <section className="slice-notice" aria-label="收割者成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{reaper.supplies}</p>
    </section>}
    {reaper.discovered && reaper.bottles.length > 0 && <details className="seer-fold" open={!reaper.promoted}>
      <summary>收割者独立成品原瓶 · 来源与去向</summary>
      {reaper.bottles.map((bottle) => {
        const action = reaper.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !reaper.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !reaper.promoted && !reaper.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `reaper-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`reaper-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {reaper.discovered && !reaper.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{reaper.risk}</p></details>}
    {reaper.promoted && <section aria-label="收割者能力与消化">
      <h3>能力与消化 · {reaper.abilities.length} 项训练记录</h3>
      <p>扮演进度 {reaper.acting} · 消化：{reaper.digestion}</p>
      <progress className="cryptologist-progress" aria-label="收割者扮演进度" value={reaper.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {reaper.pollution}</p>
      {reaper.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="收割者能力边界">
        <summary>查看弱点、窗口与继承能力边界</summary>
        <p>先观察眼前目标，再依据真实出现的窗口实际执行。弱点观察可以失败，发现弱点也不等于命中、重创或必杀，不推定固定穿透一切防护。</p>
        <p>原火焰能力、全部原能力ID与掌握继续保留。收割者不获得丧钟物品的三枪、5秒或负面效果，也不提前获得序列4的火焰化、铁血军团或团队连接。</p>
        <p>{playerText("三项有限实践、和平消化、费用和具体判定均为本作原创G。原工具、挡片与靶保留自己的来源和所有人，准备、结束或报告都不会将它们变成奖励。普通与能力方法的条件、失败和实际消耗按当前公开选项结算。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
