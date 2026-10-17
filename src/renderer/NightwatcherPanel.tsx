import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { NightwatcherAction, NightwatcherCommand, NightwatcherProjection } from "../domain/nightwatcher/types";
import type { SpiritWarlockProjection } from "../domain/spirit-warlock/types";
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
  OUTSIDE: "本人在原准备室外", HALL: "本人在原准备室内", "NW4-HALL": "原安静准备室 NW4-HALL",
  SUPPLIER: "原供应方保管", TABLE: "原准备室准备台", CONSUMED: "已经耗用，原记录保留", MISSING: "当前原件缺失",
  SHORT: "原轮受阻，停在原路线途中", BODYCHAIR: "本人仍在原椅，没有移动", RECIPIENT: "梅森原接收处",
  START: "原路线起点", END: "原2米路线终点，尚未推回", HAND: "仍在原对手手中", YARD: "原练习院地面",
};
const RITUAL_TYPES = ["BOOK_RITUAL", "BEGIN_RITUAL", "CHECK_PREPARATION", "END_RITUAL", "CANCEL_RITUAL"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"];
const SPIRIT_TYPES = ["INVITE_SPIRIT", "RELEASE_SPIRIT", "RECALL_SPIRIT"];
const RETURN_TYPES = ["RETURN_CART", "RETURN_NOTE"];
const EXIT_TYPES = ["END_RITUAL", "STOP_EFFECT", "RECALL_SPIRIT", "RETURN_CART", "RETURN_NOTE", "CLOSE", "WITHDRAW", "LEAVE_ENCOUNTER"];
const SPIRIT_STATUS: Record<string, string> = { UNMET: "尚未实际认识", AVAILABLE: "尚未实际取得", SEALED: "同一原灵正在本人约定媒介安眠", DEPLOYED: "同一原灵实际在外，仍须召回", RELEASED: "同一原灵已经释放，须实际重新邀约" };
const DREAM_RESULT: Record<string, string> = { NONE: "尚无本次梦境结果", SLEPT: "本次实际短暂入梦", RESISTED: "本次抵抗，未入梦", CONVERSATION: "仅普通清醒交谈" };
type Visit = NightwatcherProjection["ritual"]["visits"][number];
type Confirmation = { action: NightwatcherAction; visitId: NightwatcherProjection["ritual"]["currentVisitId"] };

/** Old cases, the original spirit and its actual history remain read-only at sequence 4. */
export function NightwatcherSpiritWarlockHistory({ spiritWarlock: value }: { spiritWarlock: SpiritWarlockProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="灵巫时期的经历">
    <h3>灵巫时期的经历</h3>
    <p className="slice-notice">原卷叶、原信与本人梦境协作的记录保留，只供回看；晋升不改写旧结果，也不再次结算旧成长。卷叶当前去向沿用同一原灵的实际记录。</p>
    <p>灵巫扮演进度 {value.acting} · 消化：{value.digestion}</p>
    <details className="seer-fold"><summary>灵巫原故事与供给</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.supplies}</p></details>
    {value.companion && <section aria-label="灵巫同一原灵的实际记录"><h4>{value.companion.name}</h4>
      <p>{value.companion.source}</p><p>{value.companion.status}</p>
      {value.companion.history.map((text, index) => <p key={index}>{text}</p>)}
    </section>}
    {value.practice && <section aria-label="灵巫原信与协作记录"><p>{value.practice.note}</p><p>{value.practice.dream}</p><p>{value.practice.summary}</p></section>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary><p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的结果与报告：{entry.result}</p>}
    </details>)}
    {value.bottles.length > 0 && <details className="seer-fold"><summary>灵巫原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {value.abilities.length > 0 && <details className="seer-fold"><summary>灵巫时期能力记录</summary>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface NightwatcherPanelProps {
  nightwatcher: NightwatcherProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: NightwatcherCommand) => void;
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
function RitualFacts({ ritual }: { ritual: NightwatcherProjection["ritual"] }) {
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
export function NightwatcherPanel({ nightwatcher: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: NightwatcherPanelProps) {
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
  const spiritActions = value.actions.filter((action) => SPIRIT_TYPES.includes(action.command.type));
  const returnActions = value.actions.filter((action) => RETURN_TYPES.includes(action.command.type));
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command)
    && !RITUAL_TYPES.includes(action.command.type) && !ENCOUNTER_TYPES.includes(action.command.type)
    && !SPIRIT_TYPES.includes(action.command.type) && !RETURN_TYPES.includes(action.command.type));
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

  function actionButton(action: NightwatcherAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `nightwatcher-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (action.command.type === "CONSUME" || action.command.type === "CHECK_PREPARATION") {
            if (value.promoted) return;
            if (action.command.type === "CONSUME" && !value.bottles.some((bottle) => action.command.type === "CONSUME" && bottle.id === action.command.bottleId)) return;
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, visitId: value.ritual.currentVisitId });
          } else { if ("caseId" in action.command) setCaseId(action.command.caseId); onCommand(action.command); }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`nightwatcher-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirmAction() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !sameVisit || !liveConfirmation?.enabled
      || (!isPreparation && !selectedBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复派灵、耗用原包或服药。"}
  </p>;

  if (confirmation) return <section className="seer-panel warrior-panel nightwatcher-panel seer-confirmation"
    aria-label={isPreparation ? "守夜人专业准备的继续确认" : "这瓶守夜人魔药的服用确认"} aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">同一位当前专家、同一原封装包与实际到访</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{isPreparation ? "核对本次专业准备，自由选择是否继续" : selectedBottle?.title ?? "原瓶已不再可用"}</h3>
    {selectedBottle && <><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status} · 服用成功率 {selectedBottle.chance}%</p></>}
    <section className="slice-notice" aria-label="确认前的当前守夜人仪式"><RitualFacts ritual={value.ritual} /></section>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    <p className="slice-notice">{playerText("完整晋升配方与仪式细节尚未核实；本作采用原创G专业指导准备，不等于还原原著完整仪式。特殊跨途径晋升个例不能当作守夜人的通用配方。")}</p>
    {isPreparation ? <p>确认只核对当前本人、专家与同一原封装包，选择开启本周窗口；服药还需逐瓶确认。可以暂不继续，返回后0行动实际离场，继续灵巫生活。预约费用不退，未用包保留实际位置。</p>
      : <><section className="slice-notice seer-risk" aria-label="守夜人服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
        <p>成功或失败都会耗用这一原瓶与本次原封装包。下一次尝试须另行付费预约新的原包，等下一真实周亲自入场；旧包不能复用。</p>
        <section aria-label="服药前当前资源"><h4>当前角色资源</h4><dl className="seer-facts">
          <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div><div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
          <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
          <div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
        </dl></section></>}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="nightwatcher-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{isPreparation ? "暂不继续，返回原准备室" : "暂不服用，返回原准备室"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "nightwatcher-confirm-reason" : undefined} onClick={confirmAction}>
        {busy ? "正在结算并保存…" : isPreparation ? "确认核对，继续本次专业准备" : `确认服用「${selectedBottle?.title ?? "原瓶"}」`}
      </button>
    </div>
    <p className="slice-muted">关闭确认不代替实际离场。提交后只等待这一原操作的保存回执，不重复扣费或服药。</p>{saveNotice}
  </section>;

  const ritualContent = <><RitualFacts ritual={value.ritual} /><p className="slice-muted">{value.ritual.boundary}</p><p>{value.ritual.consequence}</p>
    <div className="warrior-action-list" role="group" aria-label="专业准备与零行动离场">{ritualActions.map(actionButton)}</div>
    <p className="slice-muted">等待预约时仍可正常生活。真正入场后，按当前公开按钮0行动结束或取消；退出不退费用，不移动专家，不把未用封装包送进玩家背包。</p>
    {value.ritual.visits.some((visit) => visit.id !== value.ritual.currentVisitId) && <details className="seer-fold"><summary>已结束的守夜人到访与原封装包</summary>
      {value.ritual.visits.filter((visit) => visit.id !== value.ritual.currentVisitId).map((visit) => <article key={visit.id} aria-label={`${visit.id}原到访历史`}><VisitFacts visit={visit} /></article>)}
    </details>}</>;
  return <div className="seer-panel warrior-panel nightwatcher-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="守夜人成长下一步">
      <span className="seer-seal">{value.promoted ? "守夜人4" : "灵巫5 → 守夜人4"}</span><h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>{nextExit ? "先处理当前收束：" : "下一步："}</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : value.acting >= 100 ? "这一阶段已消化，可以继续生活或回看实际记录。" : "请先查看当前公开条件与原物记录。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">黑夜途径守夜人（序列4）。本页保留原经历；晋升后的序列3恐惧主教请从对应入口查看。</p>
      {readOnly && <p className="slice-notice">当前为只读记录，不重复准备原物、服药或结算成长。</p>}
    </section>
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="守夜人成长行动">{growthActions.map(actionButton)}</div>}
    {value.discovered && !value.promoted && <section className="slice-notice" aria-label="守夜人配方与专业准备边界">
      <h3>{playerText("独立成品与晋升准备")}</h3><p>{playerText("取得有来源的成品原瓶，由当前自愿且在场的专家主持原创G专业准备；不编造原著材料清单或操作步骤。")}</p>
      <p>{value.supplies}</p><p>你可以暂不晋升，0行动退出已进入的原准备室，继续灵巫生活。</p>
    </section>}
    {value.discovered && (value.promoted
      ? <details className="seer-fold"><summary>守夜人晋升准备与原包历史</summary><section aria-label="守夜人当前专业准备">{ritualContent}</section></details>
      : <section aria-label="守夜人当前专业准备">{ritualContent}</section>)}
    {value.bottles.length > 0 && <details className="seer-fold" open={!value.promoted}><summary>守夜人原瓶 · 来源与去向</summary>
      <section aria-label="守夜人原瓶与独立来源">{value.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
        <div><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        <div className="warrior-action-list">{bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === bottle.id).map(actionButton)}</div>
      </article>)}</section>
    </details>}
    {value.promoted && <section aria-label="继承同一原灵的当前状态"><h3>卷叶：沿用实际取得的同一原灵</h3>
      <p>原灵来源：{value.life.companion.source} · {SPIRIT_STATUS[value.life.companion.status] ?? value.life.companion.status}</p>
      <p>{value.life.companion.acquiredWeek === null ? "没有实际取得记录，不能使用原灵能力。" : `实际初次取得：第${value.life.companion.acquiredWeek}周。`}
        {value.life.companion.invitedWeek === null ? "尚无邀约记录。" : `最近实际邀约：第${value.life.companion.invitedWeek}周。`}</p>
      <p>累计实际派出 {value.life.companion.deployments} 次 · 实际召回 {value.life.companion.recalls} 次 · 实际释放 {value.life.companion.releases} 次</p>
      <p className="slice-muted">晋升不赠送新灵。只有已经实际取得、仍在约定媒介安眠的同一卷叶能被派出；缺少它时可以普通步行递纸。释放后重新邀约的仍是SW5-LEAF-1，不能凭空换一只。</p>
      <div className="warrior-action-list" role="group" aria-label="同一原灵的邀约、召回与释放">{spiritActions.map(actionButton)}</div>
    </section>}
    {value.promoted && selectedCase && <section aria-label="守夜人有限生活实践"><h3>{value.life.title}</h3>
      <label className="seer-case-selector">选择当前生活实践<select value={selectedCase.id} disabled={locked || value.life.inside || !!activeCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="seer-current-case warrior-case" aria-label="当前守夜人生活实践"><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen ? "现场仍须实际收束" : "现场已结束或尚未开始"}</p>
        <p>本次方法：{selectedCase.method === "ABILITY" ? "支付实际成本的有限能力实践" : selectedCase.method === "ORDINARY" ? "普通方法，不增加能力掌握" : "尚未选择准备"}</p>
        {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p className="slice-muted">先观察原现场、成年参加者与真实退出方式。</p>}
        {selectedCase.id === "uneven-cart" && <section className="slice-notice" aria-label="同一原空车与真实推回"><h4>原2米安全平地上的空车</h4>
          <p>原空车 {value.life.cart.id} · 归属梅森 · {LOCATION[value.life.cart.location] ?? value.life.cart.location} · 原轮仍有可见的不平整</p>
          <p>实际滚行 {value.life.cart.rolls} 次 · 实际推回 {value.life.cart.returns} 次 · {value.life.cart.finding ? "已留下本次原车轴的实际检查结果" : "尚无原车轴检查结果"}</p>
          <p>梅森当前{value.life.people.mason.alive ? "仍活着" : "已经死亡"}，{value.life.people.mason.willing ? "自愿参加" : "不愿参加"}。有限厄运需4灵性并可能失败；失败时原车正常到终点，不凭空损坏或伤人。</p>
          <p>结束与报告前须沿原2米路线把同一辆空车真正推回。普通检查同一车轴可记录发现，不增加能力掌握。</p>
          <div className="warrior-action-list" role="group" aria-label="原空车零行动实际推回">{returnActions.filter((action) => action.command.type === "RETURN_CART").map(actionButton)}</div>
        </section>}
        {selectedCase.id === "paired-dream" && <section className="slice-notice" aria-label="两位成年人的实际睡眠状态"><h4>原4米范围内的两位自愿成年人</h4>
          {Object.values(value.life.people).map((person) => <article key={person.id} aria-label={`${person.name}的当前睡眠状态`}>
            <p>{person.name} · {person.age}岁 · {person.id} · {person.location}</p>
            <p>当前{person.alive ? "仍活着" : "已经死亡"}，{person.willing ? "自愿参加" : "不愿参加"} · {person.asleep ? "实际仍在短梦中" : "当前清醒"} · {DREAM_RESULT[person.lastDream] ?? person.lastDream}</p>
          </article>)}
          <p>本人位置：{LOCATION[value.life.practice.playerLocation] ?? value.life.practice.playerLocation} · {value.life.practice.concentration ? "有限梦境专注仍在持续" : "当前没有持续梦境专注"}</p>
          <p>5灵性只支付一次有限尝试，两人分别抵抗；可能只有一人入梦，也可能全部抵抗。普通清醒交谈不会把任何人变成睡着。参与者可以停止，实际唤醒后才能结束。</p>
          <p className="slice-muted">梦中内容只是参加者报告，不能视为真相；停止不会抹去记忆或治愈精神状况，不构成现实心理治疗。</p>
        </section>}
        {selectedCase.id === "leaf-signal" && <section className="slice-notice" aria-label="原灵与同一原纸条的实际去回"><h4>同一原灵与新原纸条的有限协作</h4>
          <p>本人位置：{LOCATION[value.life.practice.playerLocation] ?? value.life.practice.playerLocation} · {value.life.practice.concentration ? "本人仍在维持有限梦境专注" : "本人当前可以沿原路行动"}</p>
          <p>原纸条 {value.life.practice.note.id} · 归属赛琳 · {value.life.practice.note.location === "TABLE" ? "原桌，已取回或尚未送出" : "梅森原接收处，尚未取回"}</p>
          <p>该原纸实际送达 {value.life.practice.deliveries} 次 · 实际取回 {value.life.practice.returns} 次</p>
          <p>原灵方法需3灵性，失败也保留同一原灵的实际派出与消耗。缺少可派出的卷叶时可选择普通步行；不会替你取得新灵。</p>
          <p>先停止本人梦境专注，再实际召回卷叶，并沿原2米路线取回同一原纸条。结束不会传送纸条，也不改写灵巫旧信的历史。</p>
          <div className="warrior-action-list" role="group" aria-label="本人零行动取回同一原纸条">{returnActions.filter((action) => action.command.type === "RETURN_NOTE").map(actionButton)}</div>
        </section>}
        {selectedCase.result && <section className="slice-notice" aria-label="守夜人实际生活结果" aria-live="polite"><h4>实际结果</h4><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前守夜人生活行动">{selectedCaseActions.map(actionButton)}</div>
        <p className="slice-muted">停止、召回、原物返回与退出按公开条件0行动完成。失败与已经消耗的灵性仍保留；失败重试须等待下一真实周。</p>
      </section>
    </section>}
    {value.promoted && <details className="seer-fold" open={value.encounter.inside}><summary>可选原院冲突与真实后果</summary><section aria-label="守夜人可选原院冲突">
      <h3>{value.encounter.title}</h3><p>{value.encounter.story}</p>
      <p>{ENCOUNTER_STATUS[value.encounter.status] ?? value.encounter.status} · {value.encounter.inside ? "本人仍在当前原院遭遇中" : "当前没有未结束的遭遇现场"}</p>
      <p>同一原对手：{value.encounter.enemy.name} · {value.encounter.enemy.age}岁 · {value.encounter.enemy.id} · 健康 {value.encounter.enemy.health} · 精神 {value.encounter.enemy.mind}</p>
      <p>原对手状态：{value.encounter.enemy.status === "DEAD" ? "原本人已真正死亡" : value.encounter.enemy.status === "SURRENDERED" ? "仍活着，已自行停止抵抗" : value.encounter.enemy.status}；原棍 {value.encounter.enemy.weaponId} · {LOCATION[value.encounter.enemy.weaponLocation] ?? value.encounter.enemy.weaponLocation}。</p>
      <p className="slice-muted">交谈后可0行动沿原出口和平离开，不追击。有限厄运和范围梦境可能失败；原灵协助只沿用已经取得且实际派出的卷叶，回合结束实际召回。原对手持普通原棍，真实伤势、投降或死亡均保留。</p>
      <div className="warrior-action-list" role="group" aria-label="原院交谈、战斗与零行动退出">{encounterActions.map(actionButton)}</div>
    </section></details>}
    {value.promoted && <section aria-label="守夜人能力与消化"><h3>能力与消化</h3><p>扮演进度 {value.acting} · {value.digestion}</p>
      <progress className="cryptologist-progress" aria-label="守夜人扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">保留原黑夜能力与掌握记录。有限厄运不能保证每次生效，范围梦境分别检定真实对象。没有默认灵赠品、传送、复活、偷窃或寄生；本阶不授予序列3恐惧主教的恐惧与黑暗毁灭。</p>
    </section>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p>
      <p>{playerText("范围、时长、灵性、检定、训练与战盘数值是本作G。特定人物借助外部力量的灵界旅行不是守夜人基础能力；不把高位能力、梦中报告或概率结果写成必然。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
