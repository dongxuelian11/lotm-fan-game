import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WitchKingAction, WitchKingCommand, WitchKingProjection } from "../domain/witch-king/types";
import type { CrimsonScholarProjection } from "../domain/crimson-scholar/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对原物与边界", PREPARED: "已准备，尚未实施",
  ACTIVE: "实践中，仍须实际收束", EXAMINED: "已有实际结果，等待收束与报告", RESOLVED: "已提交有限报告",
};
const ENCOUNTER_STATUS: Record<string, string> = {
  AVAILABLE: "尚未实际交谈", READY: "已交谈，可和平离开", FIGHTING: "实际战斗中",
  RESOLVED: "原冲突已结束", RETREATED: "已沿原出口撤离", LOST: "原冲突已造成真实失败",
};
const LOCATION: Record<string, string> = {
  OUTSIDE: "本人在原礼堂外", HALL: "本人在原礼堂内", "WK4-HALL": "原私人礼堂 WK4-HALL",
  SUPPLIER: "原供应方保管", TABLE: "原礼堂准备台", CONSUMED: "已经耗用，原记录保留", MISSING: "当前原件缺失",
  START: "原路线起点", END: "原6米路线终点，尚未返回", HAND: "仍在原对手手中", YARD: "原院地面",
};
const RITUAL_TYPES = ["BOOK_RITUAL", "BEGIN_RITUAL", "CHECK_PREPARATION", "END_RITUAL", "CANCEL_RITUAL"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"];
const PAPER_TYPES = ["BUY_PAPERS", "PREPARE_PAPER"];
const EXIT_TYPES = ["END_RITUAL", "CANCEL_RITUAL", "RETURN", "STOP_EFFECT", "INSPECT", "CLOSE", "WITHDRAW", "LEAVE_ENCOUNTER"];
type Visit = WitchKingProjection["ritual"]["visits"][number];
type Confirmation = { action: WitchKingAction; visitId: WitchKingProjection["ritual"]["currentVisitId"] };

/** The original full-moon ritual, body route and outcomes are a read-only historical chapter. */
export function WitchKingCrimsonScholarHistory({ crimsonScholar }: { crimsonScholar: CrimsonScholarProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="深红学者时期的经历">
    <h3>深红学者时期的经历</h3>
    <p className="slice-notice">原满月公告、原仪式包、月效实践、本人去回与失败记录继续保留，只供回看；晋升不改写旧结果，也不再次结算旧成长。</p>
    <p>深红学者扮演进度 {crimsonScholar.acting} · 消化：{crimsonScholar.digestion}</p>
    <details className="seer-fold"><summary>深红学者原故事与供给</summary>
      {crimsonScholar.story && <p>{crimsonScholar.story}</p>}<p>{crimsonScholar.environment}</p><p>{crimsonScholar.supplies}</p>
    </details>
    <details className="seer-fold"><summary>深红学者原满月公告与实际仪式</summary>
      <p>{crimsonScholar.ritual.summary}</p><p>{crimsonScholar.ritual.reservation}</p><p>{crimsonScholar.ritual.activeVisit}</p>
      {crimsonScholar.ritual.announcements.map((text, index) => <p key={`announcement-${index}`}>{text}</p>)}
      {crimsonScholar.ritual.history.map((text, index) => <p key={`visit-${index}`}>{text}</p>)}
    </details>
    {crimsonScholar.practice && <section aria-label="深红学者原身体与月效记录">
      <p>当时的原身体位置：{LOCATION[crimsonScholar.practice.location] ?? crimsonScholar.practice.location}</p>
      <p>原场域：{crimsonScholar.practice.field === "NONE" ? "无持续月效" : crimsonScholar.practice.field === "FULL" ? "有限区域满月" : "有限区域隐月"}</p>
      <p>实际去程 {crimsonScholar.practice.outboundTrips} 次 · 实际返程 {crimsonScholar.practice.returns} 次 · 有限重组尝试 {crimsonScholar.practice.reassemblies} 次</p>
      <p>{crimsonScholar.practice.reassembledWeek === null ? "尚无已记录重组尝试" : `原重组尝试：第${crimsonScholar.practice.reassembledWeek}周`}；保留本人伤势与历史，不复活。</p>
    </section>}
    {crimsonScholar.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={`${entry.id}-${index}`}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的结果与报告：{entry.result}</p>}
    </details>)}
    {crimsonScholar.bottles.length > 0 && <details className="seer-fold"><summary>深红学者原瓶 · 来源与去向</summary>
      {crimsonScholar.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {crimsonScholar.abilities.length > 0 && <details className="seer-fold"><summary>深红学者时期能力记录</summary>
      {crimsonScholar.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface WitchKingPanelProps {
  witchKing: WitchKingProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: WitchKingCommand) => void;
}
function VisitFacts({ visit }: { visit: Visit }) {
  return <>
    <p>原到访：{visit.id} · {visit.status} · 原礼堂：{visit.hallId}</p>
    <p>原专家：{visit.expertId} · 实付 {visit.paidPennies}便士 · 第{visit.bookedWeek}周预约 · 最早第{visit.plannedWeek}周入场</p>
    <p>原封装包：{visit.kit.id} · {visit.kit.status} · {LOCATION[visit.kit.location] ?? visit.kit.location}</p>
    <p>封装状态：{visit.kit.sealsIntact ? "封装仍完整" : "封装已不完整"} · {visit.kit.consumedWeek === null ? "尚未耗用" : `第${visit.kit.consumedWeek}周已耗用`}</p>
    <p>本次服用的原瓶：{visit.consumedBottleId ?? "尚未服用"}</p><p>{visit.summary}</p>
    <details className="seer-fold"><summary>{visit.id}的原来源记录</summary><p>{visit.source}</p><p>{visit.kit.source}</p></details>
  </>;
}
function RitualFacts({ ritual }: { ritual: WitchKingProjection["ritual"] }) {
  const current = ritual.visits.find((visit) => visit.id === ritual.currentVisitId);
  return <>
    <h4>{ritual.title}</h4><p>{ritual.status}</p><p>{ritual.appointment}</p>
    <p>本人位置：{LOCATION[ritual.playerLocation] ?? ritual.playerLocation}</p>
    <p>当前本周服药窗口：{ritual.windowOpen ? "同一原礼堂内的实际准备已经核对" : "当前没有合格窗口"}</p>
    {ritual.expert ? <section aria-label="当前专家的真实状态">
      <p>{ritual.expert.name} · {ritual.expert.age}岁 · {ritual.expert.adultAppearance ? "成年外貌" : ""} · 序列{ritual.expert.sequence} · {ritual.expert.id}</p>
      <p>当前{ritual.expert.alive ? "仍活着" : "已经死亡"}，{ritual.expert.willing ? "自愿参与当前指导" : "不愿参与当前指导"}；当前位置：{LOCATION[ritual.expert.location] ?? ritual.expert.location}。</p>
      <p className="slice-muted">{ritual.expert.source}</p>
    </section> : <p className="slice-muted">尚无当前已知专家安排。</p>}
    {current ? <VisitFacts visit={current} /> : <p className="slice-muted">当前没有未结束的到访。过去的原封装包与服药结果保留在历史中。</p>}
  </>;
}

/** Every command comes from the committed public projection; local selectors do not change original objects. */
export function WitchKingPanel({ witchKing: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: WitchKingPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [paperId, setPaperId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const locked = busy || blocked || error !== null || readOnly;
  const confirmationLocked = locked || submittedId !== null;
  const isPreparation = confirmation?.action.command.type === "CHECK_PREPARATION";
  const sameVisit = !confirmation || confirmation.visitId === value.ritual.currentVisitId;
  const liveConfirmation = confirmation && sameVisit ? value.actions.find((action) => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const selectedBottleId = confirmation?.action.command.type === "CONSUME" ? confirmation.action.command.bottleId : null;
  const selectedBottle = value.bottles.find((bottle) => bottle.id === selectedBottleId);
  const caseActions = value.actions.filter((action) => "caseId" in action.command);
  const activeCase = value.life.cases.find((entry) => entry.contactOpen || entry.status === "PREPARED")
    ?? (value.life.practice.location === "END" ? value.life.cases.find((entry) => entry.id === "moon-return") : undefined);
  const selectedCase = activeCase ?? value.life.cases.find((entry) => entry.id === caseId)
    ?? value.life.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? value.life.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const ritualActions = value.actions.filter((action) => RITUAL_TYPES.includes(action.command.type));
  const encounterActions = value.actions.filter((action) => ENCOUNTER_TYPES.includes(action.command.type));
  const bottleActions = value.actions.filter((action) => "bottleId" in action.command);
  const paperActions = value.actions.filter((action) => PAPER_TYPES.includes(action.command.type));
  const returnActions = value.actions.filter((action) => action.command.type === "RETURN");
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command)
    && !RITUAL_TYPES.includes(action.command.type) && !ENCOUNTER_TYPES.includes(action.command.type)
    && !PAPER_TYPES.includes(action.command.type) && action.command.type !== "RETURN");
  const selectedPaper = value.life.papers.find((paper) => paper.id === paperId && paper.status === "HELD");
  const selectedPaperAction = selectedPaper ? paperActions.find((action) => action.command.type === "PREPARE_PAPER" && action.command.paperId === selectedPaper.id) : undefined;
  const preparedPaper = value.life.papers.find((paper) => paper.status === "PREPARED");
  const ordinaryReturn = returnActions.find((action) => action.command.type === "RETURN" && action.command.method === "ORDINARY" && action.enabled);
  const nextExit = ordinaryReturn ?? EXIT_TYPES.map((type) => value.actions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = nextExit ?? value.actions.find((action) => action.enabled) ?? value.actions[0];

  useEffect(() => {
    if (selectedCase && (activeCase || caseId === null)) setCaseId(selectedCase.id);
  }, [selectedCase, activeCase, caseId]);
  useEffect(() => {
    if (paperId !== null && !selectedPaper) setPaperId(null);
  }, [paperId, selectedPaper]);
  useEffect(() => {
    if (confirmation && !busy && error === null && (readOnly || !liveConfirmation || value.promoted || (!isPreparation && !selectedBottle))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, busy, error, readOnly, liveConfirmation, value.promoted, isPreparation, selectedBottle]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function actionButton(action: WitchKingAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `witch-king-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (action.command.type === "CONSUME" || action.command.type === "CHECK_PREPARATION") {
            if (value.promoted) return;
            if (action.command.type === "CONSUME" && !value.bottles.some((bottle) => action.command.type === "CONSUME" && bottle.id === action.command.bottleId)) return;
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, visitId: value.ritual.currentVisitId });
          } else { if ("caseId" in action.command) setCaseId(action.command.caseId); onCommand(action.command); }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`witch-king-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirmAction() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !sameVisit || !liveConfirmation?.enabled
      || (!isPreparation && !selectedBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要再次准备、耗纸或服药。"}
  </p>;

  if (confirmation) return <section className="seer-panel warrior-panel witch-king-panel seer-confirmation"
    aria-label={isPreparation ? "巫王专业准备的继续确认" : "这瓶巫王魔药的服用确认"} aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">同一位当前专家、同一原封装包与实际到访</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{isPreparation ? "核对本次专业准备，自由选择是否继续" : selectedBottle?.title ?? "原瓶已不再可用"}</h3>
    {selectedBottle && <><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status} · 服用成功率 {selectedBottle.chance}%</p></>}
    <section className="slice-notice" aria-label="确认前的当前巫王仪式"><RitualFacts ritual={value.ritual} /></section>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    <p className="slice-notice">{playerText("完整晋升配方与仪式细节尚未核实；本作采用原创G专业指导准备，不等于还原原著完整仪式。血族晋升序列4仍需仪式，不能沿用低序列免仪式说法。")}</p>
    {isPreparation ? <p>确认只核对当前本人、专家与同一原封装包，选择开启本周窗口；服药还需逐瓶确认。可以暂不继续，返回后0行动实际离场，继续深红学者生活。预约费用不退，未用包保留实际位置。</p>
      : <><section className="slice-notice seer-risk" aria-label="巫王服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
        <p>成功或失败都会耗用这一原瓶与本次原封装包。下一次尝试须另行付费预约新的原包，等下一真实周亲自入场；旧包不能复用。</p>
        <section aria-label="服药前当前资源"><h4>当前角色资源</h4><dl className="seer-facts">
          <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div><div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
          <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
          <div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
        </dl></section></>}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="witch-king-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{isPreparation ? "暂不继续，返回原礼堂" : "暂不服用，返回原礼堂"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "witch-king-confirm-reason" : undefined} onClick={confirmAction}>
        {busy ? "正在结算并保存…" : isPreparation ? "确认核对，继续本次专业准备" : `确认服用「${selectedBottle?.title ?? "原瓶"}」`}
      </button>
    </div>
    <p className="slice-muted">关闭确认不代替实际离场。提交后只等待这一原操作的保存回执，不重复扣费或服药。</p>{saveNotice}
  </section>;

  const ritualContent = <><RitualFacts ritual={value.ritual} /><p className="slice-muted">{value.ritual.boundary}</p><p>{value.ritual.consequence}</p>
    <div className="warrior-action-list" role="group" aria-label="专业准备与零行动离场">{ritualActions.map(actionButton)}</div>
    <p className="slice-muted">等待预约时仍可正常生活。真正入场后，按当前公开按钮0行动结束或取消；退出不退费用，不移动专家，不把未用封装包送进玩家背包。</p>
    {value.ritual.visits.some((visit) => visit.id !== value.ritual.currentVisitId) && <details className="seer-fold"><summary>已结束的巫王到访与原封装包</summary>
      {value.ritual.visits.filter((visit) => visit.id !== value.ritual.currentVisitId).map((visit) => <article key={visit.id} aria-label={`${visit.id}原到访历史`}><VisitFacts visit={visit} /></article>)}
    </details>}</>;
  return <div className="seer-panel warrior-panel witch-king-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="巫王成长下一步">
      <span className="seer-seal">{value.promoted ? "巫王4" : "深红学者5 → 巫王4"}</span><h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>{nextExit ? "先处理当前收束：" : "下一步："}</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : value.acting >= 100 ? "这一阶段已消化，可以继续生活或回看实际记录。" : "请先查看当前公开条件与原物记录。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">月亮途径巫王（序列4）。本页保留该阶经历；晋升后的召唤大师内容请从对应入口查看。</p>
      {readOnly && <p className="slice-notice">当前为只读记录，不重复准备原物、服药或结算成长。</p>}
    </section>
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="巫王成长行动">{growthActions.map(actionButton)}</div>}
    {value.discovered && !value.promoted && <section className="slice-notice" aria-label="巫王配方与专业准备边界">
      <h3>{playerText("独立成品与晋升准备")}</h3><p>{playerText("取得有来源的成品原瓶，由当前自愿且在场的专家主持原创G专业准备；不编造原著材料清单或操作步骤。")}</p>
      <p>{value.supplies}</p><p>血族晋升序列4仍需仪式。你可以暂不晋升，0行动退出已进入的原礼堂。</p>
    </section>}
    {value.discovered && (value.promoted
      ? <details className="seer-fold"><summary>巫王晋升准备与原包历史</summary><section aria-label="巫王当前专业准备">{ritualContent}</section></details>
      : <section aria-label="巫王当前专业准备">{ritualContent}</section>)}
    {value.bottles.length > 0 && <details className="seer-fold" open={!value.promoted}><summary>巫王原瓶 · 来源与去向</summary>
      <section aria-label="巫王原瓶与独立来源">{value.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
        <div><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        <div className="warrior-action-list">{bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === bottle.id).map(actionButton)}</div>
      </article>)}</section>
    </details>}
    {value.promoted && <section aria-label="实际月亮纸人与逐张去向"><h3>月亮纸人：选定一张真实原纸</h3>
      <p>未准备 {value.life.papers.filter((paper) => paper.status === "HELD").length} 张 · 已准备 {value.life.papers.filter((paper) => paper.status === "PREPARED").length} 张 · 已耗用 {value.life.papers.filter((paper) => paper.status === "CONSUMED").length} 张</p>
      <p>{preparedPaper ? `当前唯一已准备原纸：${preparedPaper.id}。实际施用时，无论成功或失败都会耗用这一张。` : "尚无已准备原纸。持有原纸不等于已经准备，战斗不会自动替你准备。"}</p>
      <div className="warrior-action-list">{paperActions.filter((action) => action.command.type === "BUY_PAPERS").map(actionButton)}</div>
      {value.life.papers.some((paper) => paper.status === "HELD") && <><label className="seer-case-selector">选择要准备的一张原纸<select value={selectedPaper?.id ?? ""} disabled={locked || !!preparedPaper}
        onChange={(event) => setPaperId(event.target.value || null)}><option value="">先选择原纸编号</option>
        {value.life.papers.filter((paper) => paper.status === "HELD").map((paper) => <option key={paper.id} value={paper.id}>{paper.id} · 第{paper.purchasedWeek}周购入</option>)}
      </select></label>{selectedPaper && <p>选定原纸来源：{selectedPaper.source}</p>}{selectedPaperAction && actionButton(selectedPaperAction)}</>}
      <p className="slice-muted">购纸1行动、60便士取得3张独立原纸；每真实周至多一批，有未耗用原纸时不补货。场外准备一张需1行动、3灵性；已付费的纸人实践准备中为0行动、3灵性。具体资格以公开按钮为准，最多一张处于准备状态。</p>
      <details className="seer-fold"><summary>每张原纸的来源、准备与实际耗用</summary>
        {value.life.papers.length === 0 && <p>尚未实际购入原纸。</p>}
        {value.life.papers.map((paper) => <article key={paper.id} aria-label={`${paper.id}原纸记录`}><h4>{paper.id}</h4><p>{paper.source}</p>
          <p>{paper.status === "HELD" ? "实际持有，尚未准备" : paper.status === "PREPARED" ? "已明确准备，尚未耗用" : "已经耗用，不会恢复为新纸"}</p>
          <p>购入：第{paper.purchasedWeek}周 · 准备：{paper.preparedWeek === null ? "尚无" : `第${paper.preparedWeek}周`} · 耗用：{paper.consumedWeek === null ? "尚无" : `第${paper.consumedWeek}周`}</p>
          {paper.consumedBy && <p>实际去向：{paper.consumedBy === "COMBAT" ? "原战斗" : "原软垫纸人实践"}{paper.combatRound === null ? "" : ` · 原战斗第${paper.combatRound}轮`}</p>}
        </article>)}
      </details>
    </section>}
    {value.promoted && selectedCase && <section aria-label="巫王有限生活实践"><h3>{value.life.title}</h3>
      <label className="seer-case-selector">选择当前生活实践<select value={selectedCase.id} disabled={locked || value.life.inside || !!activeCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="seer-current-case warrior-case" aria-label="当前巫王生活实践"><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen ? "现场仍须实际收束" : "现场已结束或尚未开始"}</p>
        <p>本次方法：{selectedCase.method === "ABILITY" ? "支付实际成本的有限能力实践" : selectedCase.method === "ORDINARY" ? "普通方法，不增加能力掌握" : "尚未选择准备"}</p>
        {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={`${selectedCase.id}-${index}`}>{text}</li>)}</ul> : <p className="slice-muted">先观察原现场、参加者与真实退出方式。</p>}
        {selectedCase.id === "paper-trial" && <section className="slice-notice" aria-label="原教员与软垫实践边界"><p>当前教员：{value.life.instructor.name} · {value.life.instructor.age}岁 · {value.life.instructor.id} · {value.life.instructor.alive ? "仍活着" : "已经死亡"} · {value.life.instructor.willing ? "自愿参加" : "不愿参加"} · {value.life.instructor.location}</p><p>{playerText("成年教员自愿以原软垫轻触一次；可以选择普通侧步或随时停止。纸人尝试耗用选定原纸，失败可能损失2健康（G），不要求主动受伤，也不证明能避开所有致命攻击。")}</p></section>}
        {selectedCase.id === "arrow-target" && <section className="slice-notice" aria-label="同一原泥靶的真实状态"><p>原泥靶 {value.life.target.id}：{value.life.target.status === "BROKEN" ? "已经破裂" : value.life.target.status === "MARKED" ? "已由普通工具留下标记" : "仍完整"} · 原挡板 {value.life.target.backstopId} · 实际失手 {value.life.target.misses} 次</p><p>原泥靶与惰性石质挡板，射线上没有人。血月之箭支付4灵性；失手仍保留消耗，破损原靶不自动刷新。普通标记不冒充施术。</p></section>}
        {selectedCase.id === "moon-return" && <section aria-label="本人和原手册的真实位置"><h4>同一原6米路线</h4>
          <p>本人：{LOCATION[value.life.practice.location]} · 原手册 {value.life.practice.folio.id}：{LOCATION[value.life.practice.folio.location]} · 归属 {value.life.practice.folio.owner}</p>
          <p>{value.life.practice.field === "MOON" ? "有限月效仍在持续" : "当前没有持续月效"} · 实际去程 {value.life.practice.outboundTrips} 次 · 实际返程 {value.life.practice.returns} 次</p>
          <p>先沿原路真正返回起点，再停止月效、检查并结束。灵性不足时可0行动、0灵性普通步行返回；关闭现场不会传送本人或原手册。</p>
          <div className="warrior-action-list" role="group" aria-label="实际月光返程或普通步行返程">{returnActions.map(actionButton)}</div>
        </section>}
        {selectedCase.result && <section className="slice-notice" aria-label="巫王实际生活结果" aria-live="polite"><h4>实际结果</h4><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前巫王生活行动">{selectedCaseActions.map(actionButton)}</div>
        <p className="slice-muted">停止、检查与退出可按公开条件0行动完成。失败和已耗原纸、灵性仍保留；重试须等待下一真实周。</p>
      </section>
    </section>}
    {value.promoted && <details className="seer-fold" open={value.encounter.inside}><summary>可选原院冲突与真实后果</summary><section aria-label="巫王可选原院冲突">
      <h3>{value.encounter.title}</h3><p>{value.encounter.story}</p>
      <p>{ENCOUNTER_STATUS[value.encounter.status] ?? value.encounter.status} · {value.encounter.inside ? "本人仍在当前原院遭遇中" : "当前没有未结束的遭遇现场"}</p>
      <p>同一原对手：{value.encounter.enemy.name} · {value.encounter.enemy.age}岁 · {value.encounter.enemy.id} · 健康 {value.encounter.enemy.health} · 精神 {value.encounter.enemy.mind}</p>
      <p>原对手状态：{value.encounter.enemy.status === "DEAD" ? "原本人已真正死亡" : value.encounter.enemy.status === "SURRENDERED" ? "仍活着，已自行停止抵抗" : value.encounter.enemy.status}；原棍 {value.encounter.enemy.weaponId} · {LOCATION[value.encounter.enemy.weaponLocation] ?? value.encounter.enemy.weaponLocation}。</p>
      <p className="slice-muted">交谈后可0行动和平离开。纸人只使用此前明确准备的同一张原纸，有限替身不复制本人或灵魂，不自动抵消死亡；真实伤势、投降或死亡均保留。</p>
      <div className="warrior-action-list" role="group" aria-label="原院交谈、战斗与零行动退出">{encounterActions.map(actionButton)}</div>
    </section></details>}
    {value.promoted && <section aria-label="巫王能力与消化"><h3>能力与消化</h3><p>扮演进度 {value.acting} · {value.digestion}</p>
      <progress className="cryptologist-progress" aria-label="巫王扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">继承深红学者的有限月光化与原身体；月光不是复活或永久免疫。深渊枷锁沿用原序列7能力，仍有成本与抵抗。本阶不授予序列3召唤大师之门；更高阶仍须实际取得协助者，没有免费生物库存。</p>
    </section>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p>
      <p>{playerText("范围、时长、灵性、训练与战盘数值是本作G。常见约1200年的自然寿限不等于不死；更长个例不能当作巫王普遍待遇。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
