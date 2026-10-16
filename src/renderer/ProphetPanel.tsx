import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ProphetAction, ProphetCommand, ProphetProjection } from "../domain/prophet/types";
import type { MysticismMagisterProjection } from "../domain/mysticism-magister/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对当前现场", PREPARED: "已准备，尚未实际尝试",
  ACTIVE: "已有本次记录，须实际收束", WAITING: "等待后来的现实核验", VERIFIED: "已有独立现实观察", RESOLVED: "已提交有限报告",
  EXAMINED: "已有原实践结果",
};
const ENCOUNTER_STATUS: Record<string, string> = {
  AVAILABLE: "尚未实际交谈", READY: "已交谈，可和平离开", FIGHTING: "实际战斗中",
  RESOLVED: "原冲突已结束", RETREATED: "已沿原出口撤离", LOST: "原冲突已造成真实失败",
};
const LOCATION: Record<string, string> = {
  OUTSIDE: "本人在原准备室外", HALL: "本人在原准备室内", "PF4-HALL": "原安静准备室 PF4-HALL",
  SUPPLIER: "原供应方保管", TABLE: "原桌", FLOOR: "原地面，仍须亲手拾回", POST: "原邮务处",
  EDWIN: "原递送人埃德温携带", NORA: "已实际交给诺拉", PLAYER: "仍由玩家持有",
  CONSUMED: "已经耗用，原记录保留", MISSING: "当前原件缺失", HAND: "仍在原对手手中", YARD: "原院地面",
};
const RITUAL_TYPES = ["BOOK_RITUAL", "BEGIN_RITUAL", "CHECK_PREPARATION", "END_RITUAL", "CANCEL_RITUAL"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"];
const OBJECT_TYPES = ["SECURE_SHUTTER", "RETURN_PAGES"];
const EXIT_TYPES = ["END_RITUAL", "STOP_EFFECT", "RETURN_PAGES", "CLOSE", "WITHDRAW", "LEAVE_ENCOUNTER"];
type Visit = ProphetProjection["ritual"]["visits"][number];
type Confirmation = { action: ProphetAction; visitId: ProphetProjection["ritual"]["currentVisitId"] };

/** Preserve the original S5 token, dream, craft, case and bottle history without new controls. */
export function ProphetMysticismMagisterHistory({ mysticismMagister: value }: { mysticismMagister: MysticismMagisterProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="秘术导师时期的经历">
    <h3>秘术导师时期的经历</h3>
    <p className="slice-notice">原布巾、梦中说法、醒后核验、真实仿制与教学记录保留，只供回看；晋升不改写旧结果，也不再次结算旧成长。</p>
    <p>晋升时秘术导师扮演进度 {value.acting} · 消化：{value.digestion}</p>
    <details className="seer-fold"><summary>秘术导师原故事与供给</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.supplies}</p></details>
    {value.practice && <details className="seer-fold"><summary>原布巾与实际梦境记录</summary>
      <p>{value.practice.token}</p><p>{value.practice.dream}</p><p>{value.practice.summary}</p>
    </details>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary><p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold"><summary>秘术导师原闪光签 · 来源与实际去向</summary>
      {value.crafts.length ? value.crafts.map((craft) => <article key={craft.id}><h4>{craft.id}</h4><p>{craft.source}</p><p>{craft.status} · {craft.power}</p></article>) : <p>没有实际制作的原闪光签。</p>}
    </details>
    {value.bottles.length > 0 && <details className="seer-fold"><summary>秘术导师原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {value.abilities.length > 0 && <details className="seer-fold"><summary>秘术导师时期能力记录</summary>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface ProphetPanelProps {
  prophet: ProphetProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: ProphetCommand) => void;
}
function VisitFacts({ visit }: { visit: Visit }) {
  return <>
    <p>原到访：{visit.id} · {visit.status} · 原准备室：{visit.hallId}</p>
    <p>原专家：{visit.expertId} · 实付 {visit.paidPennies}便士 · 第{visit.bookedWeek}周预约 · 最早第{visit.plannedWeek}周入场</p>
    <p>原封装包：{visit.kit.id} · {visit.kit.status} · {LOCATION[visit.kit.location] ?? visit.kit.location}</p>
    <p>封装状态：{visit.kit.sealsIntact ? "封装仍完整" : "封装已不完整"} · {visit.kit.consumedWeek === null ? "尚未耗用" : `第${visit.kit.consumedWeek}周已耗用`}</p>
    <p>本次服用的原瓶：{visit.consumedBottleId ?? "尚未服用"}</p><p>{visit.summary}</p>
    <details className="seer-fold"><summary>{visit.id}的原来源记录</summary><p>{visit.source}</p><p>{visit.kit.source}</p></details>
  </>;
}
function RitualFacts({ ritual }: { ritual: ProphetProjection["ritual"] }) {
  const current = ritual.visits.find((visit) => visit.id === ritual.currentVisitId);
  return <>
    <h4>{ritual.title}</h4><p>{ritual.status}</p><p>{ritual.appointment}</p>
    <p>本人位置：{LOCATION[ritual.playerLocation] ?? ritual.playerLocation}</p>
    <p>当前本周服药窗口：{ritual.windowOpen ? "同一原准备室内的实际准备已经核对" : "当前没有合格窗口"}</p>
    {ritual.expert ? <section aria-label="当前专家的真实状态">
      <p>{ritual.expert.name} · {ritual.expert.age}岁 · {ritual.expert.adultAppearance ? "成年外貌" : ""} · 序列{ritual.expert.sequence} · {ritual.expert.id}</p>
      <p>当前{ritual.expert.alive ? "仍活着" : "已经死亡"}，{ritual.expert.willing ? "自愿参与当前指导" : "不愿参与当前指导"}；当前位置：{LOCATION[ritual.expert.location] ?? ritual.expert.location}。</p>
      <p className="slice-muted">{ritual.expert.source}</p>
    </section> : <p className="slice-muted">尚无当前已知专家安排。</p>}
    {current ? <VisitFacts visit={current} /> : <p className="slice-muted">当前没有未结束的到访。过去的原封装包与服药结果保留在历史中。</p>}
  </>;
}

/** Every command comes from the committed public projection; local selectors do not change original objects. */
export function ProphetPanel({ prophet: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: ProphetPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
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
  const activeCase = value.life.cases.find((entry) => entry.contactOpen || entry.status === "PREPARED");
  const selectedCase = activeCase ?? value.life.cases.find((entry) => entry.id === caseId)
    ?? value.life.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? value.life.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const ritualActions = value.actions.filter((action) => RITUAL_TYPES.includes(action.command.type));
  const encounterActions = value.actions.filter((action) => ENCOUNTER_TYPES.includes(action.command.type));
  const bottleActions = value.actions.filter((action) => "bottleId" in action.command);
  const objectActions = value.actions.filter((action) => OBJECT_TYPES.includes(action.command.type));
  const peopleActions = value.actions.filter((action) => "personId" in action.command);
  const craftActions = value.actions.filter((action) => action.command.type === "MAKE_FLASH");
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command)
    && !RITUAL_TYPES.includes(action.command.type) && !ENCOUNTER_TYPES.includes(action.command.type)
    && !("personId" in action.command) && !OBJECT_TYPES.includes(action.command.type) && action.command.type !== "MAKE_FLASH");
  const nextExit = EXIT_TYPES.map((type) => value.actions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = nextExit ?? value.actions.find((action) => action.enabled) ?? value.actions[0];

  useEffect(() => {
    if (selectedCase && (activeCase || caseId === null)) setCaseId(selectedCase.id);
  }, [selectedCase, activeCase, caseId]);
  useEffect(() => {
    if (confirmation && !busy && error === null && (readOnly || !liveConfirmation || value.promoted || (!isPreparation && !selectedBottle))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, busy, error, readOnly, liveConfirmation, value.promoted, isPreparation, selectedBottle]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function actionButton(action: ProphetAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `prophet-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (action.command.type === "CONSUME" || action.command.type === "CHECK_PREPARATION") {
            if (value.promoted) return;
            if (action.command.type === "CONSUME" && !value.bottles.some((bottle) => action.command.type === "CONSUME" && bottle.id === action.command.bottleId)) return;
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, visitId: value.ritual.currentVisitId });
          } else { if ("caseId" in action.command) setCaseId(action.command.caseId); onCommand(action.command); }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`prophet-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirmAction() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !sameVisit || !liveConfirmation?.enabled
      || (!isPreparation && !selectedBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复预测、耗用原包或服药。"}
  </p>;

  if (confirmation) return <section className="seer-panel warrior-panel prophet-panel seer-confirmation"
    aria-label={isPreparation ? "预言家专业准备的继续确认" : "这瓶预言家魔药的服用确认"} aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">同一位当前专家、同一原封装包与实际到访</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{isPreparation ? "核对本次专业准备，自由选择是否继续" : selectedBottle?.title ?? "原瓶已不再可用"}</h3>
    {selectedBottle && <><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status} · 服用成功率 {selectedBottle.chance}%</p></>}
    <section className="slice-notice" aria-label="确认前的当前预言家仪式"><RitualFacts ritual={value.ritual} /></section>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    <p className="slice-notice">{playerText("完整晋升配方与仪式细节尚未核实；本作采用原创G专业指导准备，不等于还原原著完整仪式。有限预知也不能保证这次服药成功。")}</p>
    {isPreparation ? <p>确认只核对当前本人、专家与同一原封装包，选择开启本周窗口；服药还需逐瓶确认。可以暂不继续，返回后0行动实际离场，继续秘术导师生活。预约费用不退，未用包保留实际位置。</p>
      : <><section className="slice-notice seer-risk" aria-label="预言家服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
        <p>成功或失败都会耗用这一原瓶与本次原封装包。下一次尝试须另行付费预约新的原包，等下一真实周亲自入场；旧包不能复用。</p>
        <section aria-label="服药前当前资源"><h4>当前角色资源</h4><dl className="seer-facts">
          <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div><div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
          <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
          <div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
        </dl></section></>}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="prophet-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{isPreparation ? "暂不继续，返回原准备室" : "暂不服用，返回原准备室"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "prophet-confirm-reason" : undefined} onClick={confirmAction}>
        {busy ? "正在结算并保存…" : isPreparation ? "确认核对，继续本次专业准备" : `确认服用「${selectedBottle?.title ?? "原瓶"}」`}
      </button>
    </div>
    <p className="slice-muted">关闭确认不代替实际离场。提交后只等待这一原操作的保存回执，不重复扣费或服药。</p>{saveNotice}
  </section>;

  const ritualContent = <><RitualFacts ritual={value.ritual} /><p className="slice-muted">{value.ritual.boundary}</p><p>{value.ritual.consequence}</p>
    <div className="warrior-action-list" role="group" aria-label="专业准备与零行动离场">{ritualActions.map(actionButton)}</div>
    <p className="slice-muted">等待预约时仍可正常生活。真正入场后，按当前公开按钮0行动结束或取消；退出不退费用，不移动专家，不把未用封装包送进玩家背包。</p>
    {value.ritual.visits.some((visit) => visit.id !== value.ritual.currentVisitId) && <details className="seer-fold"><summary>已结束的预言家到访与原封装包</summary>
      {value.ritual.visits.filter((visit) => visit.id !== value.ritual.currentVisitId).map((visit) => <article key={visit.id} aria-label={`${visit.id}原到访历史`}><VisitFacts visit={visit} /></article>)}
    </details>}</>;
  return <div className="seer-panel warrior-panel prophet-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="预言家成长下一步">
      <span className="seer-seal">{value.promoted ? "预言家4" : "秘术导师5 → 预言家4"}</span><h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>{nextExit ? "先处理当前收束：" : "下一步："}</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : value.acting >= 100 ? "这一阶段已消化，可以继续生活或回看实际记录。" : "请先查看当前公开条件与原物记录。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">{playerText("阅读者途径预言家（序列4）。本页保留原序列4历史；序列3洞悉者的当前内容另有入口。")}</p>
      {readOnly && <p className="slice-notice">当前为只读记录，不重复准备原物、服药或结算成长。</p>}
    </section>
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="预言家成长行动">{growthActions.map(actionButton)}</div>}
    {value.discovered && !value.promoted && <section className="slice-notice" aria-label="预言家配方与专业准备边界">
      <h3>{playerText("独立成品与晋升准备")}</h3><p>{playerText("取得有来源的成品原瓶，由当前自愿且在场的专家主持原创G专业准备；不编造原著材料清单或操作步骤。")}</p>
      <p>{value.supplies}</p><p>你可以暂不晋升，0行动退出已进入的原准备室，继续秘术导师生活。</p>
    </section>}
    {value.discovered && (value.promoted
      ? <details className="seer-fold"><summary>预言家晋升准备与原包历史</summary><section aria-label="预言家当前专业准备">{ritualContent}</section></details>
      : <section aria-label="预言家当前专业准备">{ritualContent}</section>)}
    {value.bottles.length > 0 && <details className="seer-fold" open={!value.promoted}><summary>预言家原瓶 · 来源与去向</summary>
      <section aria-label="预言家原瓶与独立来源">{value.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
        <div><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        <div className="warrior-action-list">{bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === bottle.id).map(actionButton)}</div>
      </article>)}</section>
    </details>}
    {value.promoted && selectedCase && <section aria-label="预言家有限生活实践"><h3>{value.life.title}</h3>
      <label className="seer-case-selector">选择当前生活实践<select value={selectedCase.id} disabled={locked || value.life.inside || !!activeCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="seer-current-case warrior-case" aria-label="当前预言家生活实践"><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen ? "当前现场仍须实际收束" : "当前没有未结束的现场接触"}</p>
        <p>本次方法：{selectedCase.method === "ABILITY" ? "支付实际成本的有限能力实践" : selectedCase.method === "ORDINARY" ? "普通调查，不增加能力掌握" : "尚未选择准备"}</p>
        <p>{selectedCase.effectActive ? "本人仍在短梦中，须先0行动停止效果，再结束现场。" : "当前没有持续梦境效果。"}</p>
        <section aria-label="当前已知现场"><h5>已经观察到的现场</h5>
          {selectedCase.observations.length ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p className="slice-muted">先到原现场观察，尚无本次亲见记录。</p>}
          {selectedCase.observedWeek !== null && <p className="slice-muted">最初观察：第{selectedCase.observedWeek}周</p>}
        </section>
        <section className="slice-notice" aria-label="不确定意象与玩家假设">
          <h5>不确定意象</h5><p>{selectedCase.forecast ?? "尚无本次能力意象；普通记录也不能直接证明未来结果。"}</p>
          {selectedCase.recordedWeek !== null && <p className="slice-muted">本次记录：第{selectedCase.recordedWeek}周</p>}
          <h5>玩家的解释</h5><p>{selectedCase.hypothesis ?? "尚未选择假设。意象不会替你判定答案。"}</p>
          <p className="slice-muted">这里是待核验的假设。稍后的普通行动可能改变结果，有限预知不能保证灾难发生或一定避开。</p>
          <div className="warrior-action-list" role="group" aria-label="选择自己的待核验解释">{selectedCaseActions.filter((action) => action.command.type === "INTERPRET").map(actionButton)}</div>
        </section>
        <section className="slice-notice" aria-label="后来的独立现实观察" aria-live="polite"><h5>后来的现实观察</h5>
          <p>{selectedCase.actual ?? "尚无后来的独立现实观察，不能把意象或假设当作已发生的事。"}</p>
          {selectedCase.verifiedWeek !== null && <p>实际核验：第{selectedCase.verifiedWeek}周</p>}
        </section>
        {selectedCase.status === "WAITING" && <p className="slice-notice" role="status">现场已收束。等待期间可以返回普通生活；下一真实周再亲自核验，不会自动推进时间或生成既定答案。</p>}
        <section aria-label="当前原物与实际去向"><h5>同一原物</h5>
          {selectedCase.id === "loose-shutter" && <><p>{value.life.objects.shutter}</p><p>{value.life.objects.pages}</p><p>{value.life.objects.strap}</p>
            <p className="slice-muted">诺拉提供的原绑带只能实际用一次。固定是普通防范，不等于修复旧松销；散页若落地，须在原1米范围亲手拾回。</p>
          </>}
          {selectedCase.id === "blue-door" && <><p>{value.life.objects.door}</p><p>{value.life.objects.parcel}</p>
            <p className="slice-muted">原包裹只能随实际递送与交接改变位置；短梦不传送物品，也不能认定谁已受伤。</p>
          </>}
          {selectedCase.id === "uncertain-helper" && <><p>{value.life.objects.shutter}</p><p>{value.life.objects.pliers}</p>
            <p className="slice-muted">实际会面和本人同意才支持请求协助。工具仍属于原主人；对方可以拒绝，预言不会强迫他人成为帮手。</p>
          </>}
          <div className="warrior-action-list" role="group" aria-label="原物的实际处理">{objectActions.filter((action) => selectedCase.id === "loose-shutter" && OBJECT_TYPES.includes(action.command.type)).map(actionButton)}</div>
        </section>
        {selectedCase.id === "uncertain-helper" && <section aria-label="实际会面与当前协助"><h5>去见人，再判断能否帮忙</h5>
          {value.life.people.map((person) => <article key={person.id} aria-label={`${person.name}的实际会面`}>
            <p>{person.name} · {person.age}岁 · {person.id} · {person.location}</p>
            <p>当前{person.alive ? "仍活着" : "已经死亡"}，{person.willing ? "愿意参与这次交流" : "不愿参与这次交流"}。</p>
            <p>{person.interview ?? "尚未在本案实际会面，不能预先知道他能做什么。"}</p>
            <p>{person.asked ? "本次已有实际请求记录，结果以当面回应为准。" : "本次尚未实际请求帮助。"}</p>
            <div className="warrior-action-list" role="group" aria-label={`${person.name}的会面与请求`}>{peopleActions.filter((action) => "personId" in action.command && action.command.personId === person.id).map(actionButton)}</div>
          </article>)}
        </section>}
        {selectedCase.result && <section aria-label="预言家实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前预言家生活行动">{selectedCaseActions.filter((action) => action.command.type !== "INTERPRET").map(actionButton)}</div>
        <p className="slice-muted">停止与实际离场按当前公开条件0行动完成。失败保留已付成本；重试须等下一真实周。报告依据后来核验到的有限事实，不要求原先的猜测必然成真。</p>
      </section>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>原闪光签库存与继承制作</summary><section aria-label="同一原闪光签的当前库存">
      {value.life.crafts.length ? value.life.crafts.map((craft) => <article key={craft.id} aria-label={`${craft.id}当前原件`}><h4>{craft.id}</h4>
        <p>{craft.source}</p><p>{craft.status} · {craft.power}</p></article>) : <p>没有实际制作的原闪光签，不能在战斗凭空取得。</p>}
      <p className="slice-muted">沿用秘术导师时期亲手做出的同一原件。补制仍须已有FLASH知识、实际购买并消耗新原料、支付灵性与行动且可能失败；每真实周至多一次，不重置旧制作与耗用记录。</p>
      <div className="warrior-action-list" role="group" aria-label="继承的实际闪光签制作">{craftActions.map(actionButton)}</div>
    </section></details>}

    {value.promoted && <details className="seer-fold" open={value.encounter.inside}><summary>可选原院冲突与真实后果</summary><section aria-label="预言家可选原院冲突">
      <h3>{value.encounter.title}</h3><p>{value.encounter.story}</p>
      <p>{ENCOUNTER_STATUS[value.encounter.status] ?? value.encounter.status} · {value.encounter.inside ? "本人仍在当前原院遭遇中" : "当前没有未结束的遭遇现场"}</p>
      <p>同一原对手：{value.encounter.enemy.name} · {value.encounter.enemy.age}岁 · {value.encounter.enemy.id} · 健康 {value.encounter.enemy.health} · 精神 {value.encounter.enemy.mind}</p>
      <p>原对手状态：{value.encounter.enemy.status === "DEAD" ? "原本人已真正死亡" : value.encounter.enemy.status === "SURRENDERED" ? "仍活着，已自行停止抵抗" : value.encounter.enemy.status}；原棍 {value.encounter.enemy.weaponId} · {LOCATION[value.encounter.enemy.weaponLocation] ?? value.encounter.enemy.weaponLocation}。</p>
      <p className="slice-muted">交谈后可0行动沿原出口和平离开，不追击。有限预警可能失败，不偷看隐藏战盘或保证胜利；继承的FLASH依赖实际学会的原样本，仿制品只能耗用已经做成并仍持有的同一原闪光签。原对手的真实伤势、投降或死亡均保留。</p>
      <div className="warrior-action-list" role="group" aria-label="原院交谈、战斗与零行动退出">{encounterActions.map(actionButton)}</div>
    </section></details>}
    {value.promoted && <section aria-label="预言家能力与消化"><h3>能力与消化</h3><p>扮演进度 {value.acting} · {value.digestion}</p>
      <progress className="cryptologist-progress" aria-label="预言家扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">保留原阅读者能力、掌握与样本。片段只能提供不确定意象；玩家的解释须以独立现实观察检验。没有全知未来、改写结果、时间停止或灵魂控制；未来更高阶段待核。</p>
    </section>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p>
      <p>{playerText("本作人物、原物、生活案件、专业准备、成本、检定与战盘数值均为原创G。有限预知须解释、会受现实行动影响，也不能保证避开灾难；不把梦中意象或玩家假设写成已发生的事实。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
