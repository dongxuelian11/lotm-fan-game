import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { MentorDisorderAction, MentorDisorderCommand, MentorDisorderProjection } from "../domain/mentor-disorder/types";
import type { CorruptionBaronProjection } from "../domain/corruption-baron/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次现场", OBSERVED: "已有公开观察与现场边界", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，请完成收束再报告", RESOLVED: "已实际收束并提交有限报告",
};
const MARKER_LABELS = {
  SORTED: "原红筹 MD5-RED-1 与原蓝筹 MD5-BLUE-1 在各自原色分格内",
  MIXED: "两枚原筹仍在各自原封边软盘内，轨迹已经短暂混乱，尚未归格",
  COLLECTED: "两枚原筹已实际收停并收集，尚未按原ID归回红、蓝分格",
} as const;
const ROUTE_LABELS = {
  READY: "原成年赛恩尚未开始本次自愿行走试验",
  MARKED: "赛恩已自行安全停步，原路线标记 MD5-ROUTE-MARKER 尚未收回",
  FREE: "赛恩已复核原路、普通返回起点，原路线标记已收入原盒，本次许可结束",
} as const;
const NOTE_LABELS = {
  BLANK: "同一原记录纸 MD5-NOTE-1 尚未写本次记录",
  WRITTEN: "同一原记录纸 MD5-NOTE-1 已写，尚未实际交回",
  HANDED_OVER: "同一原记录纸 MD5-NOTE-1 已实际交回核册员伊芙",
} as const;
const OLD_CLAUSE_LABELS = { ORIGINAL: "原核册次序仍在", PENDING: "正在按原安排核查，尚未收束", ADJUSTED: "两份原册的核查先后已临时调整，尚未恢复", RESTORED: "原核册次序已实际恢复" } as const;
const OLD_MARKER_LABELS = { CRADLED: "同一原木球仍在原托槽中", ROLLING: "同一原木球正在滚动，尚未收停", SIDE_POCKET: "同一原木球已偏入原侧袋，尚未收回", STOPPED: "同一原木球已实际收停" } as const;
const OLD_ROUTE_LABELS = { READY: "原约定路线仍在，尚未开始当时递送", MOVING: "递送员正沿原约定路线行走，尚未结束", DIVERTED: "递送员已走上原侧路，当时实践尚未结束", FREE: "当时实践已结束，递送员可自由离开" } as const;

/** S6 history has no replay controls and keeps each original consequence. */
export function MentorDisorderCorruptionBaronHistory({ corruptionBaron, currentTitle = "混乱导师（序列5）" }: { corruptionBaron: CorruptionBaronProjection; currentTitle?: string }) {
  return <section className="seer-panel mentorDisorder-panel" aria-label="腐化男爵时期的经历">
    <h3>腐化男爵时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留腐化男爵时期的原故事、有限扭曲、原木球、原路线、失败与独立原瓶，只供回看。</p>
    <p>腐化男爵扮演进度 {corruptionBaron.acting} · 消化：{corruptionBaron.digestion}</p>
    {corruptionBaron.story && <p>{corruptionBaron.story}</p>}
    {corruptionBaron.environment && <p>{corruptionBaron.environment}</p>}
    {corruptionBaron.supplies && <p>{corruptionBaron.supplies}</p>}
    <details className="seer-fold" aria-label="腐化男爵原现场记录"><summary>原核册次序、原木球与原路线</summary>
      <dl className="seer-facts">
        <div><dt>原核册次序</dt><dd>{OLD_CLAUSE_LABELS[corruptionBaron.practice.clauseOrder]}</dd></div>
        <div><dt>同一原木球</dt><dd>{OLD_MARKER_LABELS[corruptionBaron.practice.marker]}</dd></div>
        <div><dt>原递送路线</dt><dd>{OLD_ROUTE_LABELS[corruptionBaron.practice.route]}</dd></div>
        <div><dt>原污染记录</dt><dd>{corruptionBaron.pollution}</dd></div>
      </dl>
    </details>
    {corruptionBaron.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold"><summary>原赠物与实际去向</summary><p>{corruptionBaron.gifts.summary}</p>
      <p>现仍持有 {corruptionBaron.gifts.held} 件原赠物 · 已实际给出 {corruptionBaron.gifts.given} 件</p>
    </details>
    {corruptionBaron.bottles.length > 0 && <details className="seer-fold"><summary>腐化男爵原瓶 · 来源与去向</summary>
      {corruptionBaron.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {corruptionBaron.risk && <details className="seer-fold"><summary>腐化男爵原服用风险</summary><p>{corruptionBaron.risk}</p></details>}
    {corruptionBaron.abilities.length > 0 && <details className="seer-fold"><summary>腐化男爵时期能力记录</summary>
      {corruptionBaron.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">回看不重做旧实践、重发奖励或取回已给出的原赠物，沃恩冲突的实际后果继续保留。</p>
  </section>;
}

export interface MentorDisorderPanelProps {
  mentorDisorder: MentorDisorderProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: MentorDisorderCommand) => void;
}
function isCaseAction(action: MentorDisorderAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: MentorDisorderAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function allowedCaseAction(action: MentorDisorderAction): boolean {
  return action.command.type !== "PREPARE" || action.command.caseId !== "honest-account" || action.command.method === "ORDINARY";
}

/** Selection changes only local focus; every result and resource comes from the saved projection. */
export function MentorDisorderPanel({ mentorDisorder, resources, busy, blocked = false, error = null, onCommand }: MentorDisorderPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = mentorDisorder.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = mentorDisorder.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = mentorDisorder.actions.filter(isCaseAction).filter(allowedCaseAction);
  // An explicit public CLOSE identifies the current contact; old prose never does.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const insidePractice = mentorDisorder.insideCase || !!closeAction || mentorDisorder.practice.markers !== "SORTED"
    || mentorDisorder.practice.route === "MARKED" || mentorDisorder.practice.note === "WRITTEN";
  const selectedCase = (insidePractice ? mentorDisorder.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? mentorDisorder.cases.find((entry) => entry.id === selectedCaseId)
    ?? mentorDisorder.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? mentorDisorder.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command
    && action.command.caseId === selectedCase.id && (!insidePractice || action.command.type === "CLOSE")) : [];
  const encounterActions = insidePractice ? [] : mentorDisorder.actions.filter(isEncounterAction);
  const growthActions = insidePractice ? [] : mentorDisorder.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = insidePractice ? closeAction : !mentorDisorder.promoted
    ? mentorDisorder.actions.find((action) => action.command.type === "CONSUME" && action.enabled) ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0] ?? encounterActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !mentorDisorder.promoted && !insidePractice;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (insidePractice || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, insidePractice]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || mentorDisorder.promoted || insidePractice)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, mentorDisorder.promoted, insidePractice]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: MentorDisorderAction) {
    if (busy || interactionBlocked || insidePractice || mentorDisorder.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || mentorDisorder.promoted || insidePractice) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: MentorDisorderAction) {
    const unavailable = insidePractice && action.command.type !== "CLOSE";
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className={insidePractice ? "slice-choice primary" : "slice-choice"} disabled={busy || interactionBlocked || unavailable || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || unavailable || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `mentorDisorder-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`mentorDisorder-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel mentorDisorder-panel seer-confirmation" aria-label="这瓶混乱导师魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); } }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方与6→5晋升仪式细节仍待核实；本次只确认本作原创G导师准备与指导流程中的这一成品原瓶，不表示原著无需仪式。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="混乱导师服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{mentorDisorder.risk}</p></section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{mentorDisorder.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="mentorDisorder-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "mentorDisorder-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。晋升后灵性上限100，不补满当前灵性。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel mentorDisorder-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="混乱导师成长下一步">
      <span className="seer-seal">{mentorDisorder.promoted ? "序列 5" : "混乱导师晋升卷宗"}</span><h3>{mentorDisorder.title}</h3>
      <p className="seer-next">{insidePractice
        ? <><strong>先收回原物并结束本次实践：</strong>{nextAction?.label || "查看当前公开的结束实践选项"}。结束为0行动、0精神、0灵性，保留本次结果与已付成本。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : mentorDisorder.promoted && mentorDisorder.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{mentorDisorder.digestion}</p>
    </section>
    {mentorDisorder.promoted && mentorDisorder.environment && <section aria-label="当前混乱导师现场"><h4>当前现场</h4><p>{mentorDisorder.environment}</p></section>}
    {mentorDisorder.promoted && <section aria-label="已保存的原筹、原路线与原纸状态">
      <h4>当前公开原物状态</h4>
      <dl className="seer-facts">
        <div><dt>两枚原筹</dt><dd>{MARKER_LABELS[mentorDisorder.practice.markers]}</dd></div>
        <div><dt>原路线</dt><dd>{ROUTE_LABELS[mentorDisorder.practice.route]}</dd></div>
        <div><dt>原记录纸</dt><dd>{NOTE_LABELS[mentorDisorder.practice.note]}</dd></div>
      </dl>
      <p className="slice-muted">只显示已保存的实际状态。两枚原筹始终留在低台各自原封边软盘内；赛恩在同一室内两条干燥标线间行走，现场没有障碍、边缘或旁人。</p>
    </section>}
    {selectedCase && <section aria-label="混乱导师有限实践">
      <h3>两道原轨迹、一次自愿行走与如实记录</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || insidePractice} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {mentorDisorder.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前混乱导师实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对原物、已有运动、本人许可与净空现场。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前使原筹移动、改变赛恩的行走或写好记录。"}</p>
        </section>
        {selectedCase.id === "paired-trays" && <p className="slice-muted">米蕾同意并实际启动两枚原轻筹后，能力才短暂混乱已有轨迹：执行1行动、3灵性、知识14，失败仍付费并实际收集两枚原筹。普通方法用原分隔板，在运动停止后逐一核对：1行动、0灵性、知识12，不算能力成功。结束时按 MD5-RED-1、MD5-BLUE-1 实际收回各自原色分格。</p>}
        {selectedCase.id === "willing-crossing" && <p className="slice-muted">原成年赛恩只同意本次短时行走，可自行停止。能力执行1行动、3灵性、知识14，只短暂混乱当前侧向运动与前方标记的关系；无论成败，他都自行安全停步。普通方法以知识10作口头澄清和正常标线行走，0灵性。结束时终止影响，由赛恩复核原路并普通返回起点，收回 MD5-ROUTE-MARKER，结束本次许可。</p>}
        {selectedCase.id === "honest-account" && <p className="slice-muted">只提供普通方法：执行1行动、0灵性、知识10，在同一原纸 MD5-NOTE-1 写下实际结果。失败文字也保留；结束时把这张原纸亲手交回伊芙，再提交报告。</p>}
        {selectedCase.result && <section className="slice-notice" aria-label="混乱导师实际结果" aria-live="polite" aria-atomic="true"><h4>本次实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前混乱导师实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {insidePractice && <p className="slice-muted">先用当前公开结束选项归回两枚原筹、完成赛恩的实际返程与收标，或交回原纸，再报告或做其它事。结束耗0行动、0精神、0灵性，零剩余行动仍可执行；不另抽结果、不退款、不治疗、不抹去失败。</p>}
      </section>
    </section>}
    {mentorDisorder.promoted && <details className="seer-fold"><summary>继承贿赂 · 原赠物</summary>
      <p>{mentorDisorder.gifts.summary}</p><p>当前持有 {mentorDisorder.gifts.held} 件 · 已实际给出 {mentorDisorder.gifts.given} 件</p>
      <p className="slice-muted">沿用原贿赂者木筹。原物给出后不自动取回；没有后续动作或效果过期，也不补发原物。</p>
    </details>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="混乱导师成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="混乱导师有限冲突">
      <h3>有限现场冲突</h3>
      <p>原成年里斯持自己的普通短棍，位于日光下的净空外院，相距2米，没有旁人；原出口可实际退出，对方不追击。可以交涉，战斗有真实伤亡风险。</p>
      <p>混乱尝试实际花费3灵性，成功后仅影响本轮下一次实际正值普通打击，失败仍付费。落空或空当不消耗这次混乱，轮末失效；已有待生效混乱时不重复施用。原贿赂仍须真实给出原物，不能保证命中或免除伤势。</p>
      <div className="magician-action-list" role="group" aria-label="混乱导师冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {mentorDisorder.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{mentorDisorder.story}</p></details>}
    {mentorDisorder.discovered && <details className="seer-fold" aria-label="混乱导师成品来源与配方边界">
      <summary>成品来源、费用与配方边界</summary>
      <p>{playerText("须完成腐化男爵消化100与十二个完整序列6周。G指导460便士；每瓶4800便士，或5步劳务抵扣4200便士后付600便士。三瓶独立成品分别取得、逐瓶确认，按意志26四档结算；失败仍耗用原瓶，后续补货须实际跨周取得。")}</p>
      <p>{playerText("完整配方、材料与6→5晋升仪式细节尚未核实；这里只提供有来源的G独立成品与导师准备，不解锁调配，也不宣称原著无需仪式。晋升须先结束旧腐化男爵接触；健康须高于20、精神须高于40，成功后四属性各加1、灵性上限100，但不补满。")}</p>
      {mentorDisorder.supplies && <p>{mentorDisorder.supplies}</p>}
    </details>}
    {mentorDisorder.discovered && mentorDisorder.bottles.length > 0 && <details className="seer-fold" open={!mentorDisorder.promoted}>
      <summary>混乱导师独立成品原瓶 · 来源与去向</summary>
      {mentorDisorder.bottles.map((bottle) => {
        const action = mentorDisorder.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !mentorDisorder.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !mentorDisorder.promoted && !insidePractice && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `mentorDisorder-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`mentorDisorder-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {mentorDisorder.discovered && !mentorDisorder.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{mentorDisorder.risk}</p></details>}
    {mentorDisorder.promoted && <section aria-label="混乱导师能力与消化">
      <h3>能力与消化 · {mentorDisorder.abilities.length} 项训练记录</h3>
      <p>扮演进度 {mentorDisorder.acting} · 消化：{mentorDisorder.digestion}</p>
      <progress className="cryptologist-progress" aria-label="混乱导师扮演进度" value={mentorDisorder.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {mentorDisorder.pollution}</p>
      {mentorDisorder.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <details className="seer-fold" aria-label="混乱导师能力与来源边界"><summary>查看有限混乱与和平成长边界</summary>
        <p>本序列只新增混乱，保留律师、野蛮人、贿赂者和腐化男爵的原能力与实际掌握。混乱只影响已有运动的有限关系，不瞬移或复制人、物，不改变所有权，也不取消自由意志。</p>
        <p>观察、准备、执行与报告各耗1行动；前两项能力执行各耗3灵性，普通方法0灵性。撤回未执行的准备与实际结束均为0行动；重复试验须重新取得当事人的本次许可。</p>
        <p>{playerText("三项报告各25扮演，反思25。全部普通方法也可完成这条原创G和平成长线；仅前两项真实成功的能力报告获得8点知识池掌握，普通方法不冒充能力成功。")}</p>
        <p>{playerText("后续序列4赠予、放大、利用尚未开放，不包含建筑级改写。混合封印物的三分钟后自我混乱不是本序列的通用代价；本作有限场景与数值不代表原著固定范围或时长。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
