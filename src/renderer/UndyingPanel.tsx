import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { UndyingAction, UndyingCommand, UndyingProjection } from "../domain/undying/types";
import type { GatekeeperProjection } from "../domain/gatekeeper/types";
import type { PublicGameDate } from "../shared/contracts";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对当前现场", PREPARED: "已准备，尚未实际尝试",
  ACTIVE: "已有本次结果，须实际收束", EXAMINED: "已有本次结果，待结束与报告", RESOLVED: "已提交有限报告",
};
const ENCOUNTER_STATUS: Record<string, string> = {
  AVAILABLE: "尚未实际交谈", READY: "已交谈，可和平离开", FIGHTING: "实际战斗中",
  RESOLVED: "原冲突已结束", RETREATED: "已沿原出口撤离", LOST: "原冲突已造成真实失败",
};
const LOCATION: Record<string, string> = {
  OUTSIDE: "原场地外", HALL: "原准备室内", "UDY4-HALL": "原持照纪念准备室 UDY4-HALL", AWAY: "当前不在原厅",
  SUPPLIER: "原供应方保管", TABLE: "原准备桌", DESK: "原档案桌", SEAL_BENCH: "原封印工作台", PLAYER: "仍由玩家持有",
  ARCHIVE: "原档案室保管", "UDY4-ARCHIVE": "原档案室 UDY4-ARCHIVE", CONSUMED: "已经耗用，原记录保留",
  MISSING: "当前原件缺失", HAND: "仍在原对手手中", YARD: "原院地面", CARE_CHEST: "长期居所原保管箱",
};
const RITUAL_TYPES = ["BOOK_RITUAL", "BEGIN_RITUAL", "CHECK_PREPARATION", "END_RITUAL", "CANCEL_RITUAL"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"];
const OBJECT_TYPES = ["RETURN_BOOK"];
const EXIT_TYPES = ["END_RITUAL", "STOP_EFFECT", "RETURN_BOOK", "CLOSE", "WITHDRAW", "LEAVE_ENCOUNTER"];
type Visit = UndyingProjection["ritual"]["visits"][number];
type Confirmation = { action: UndyingAction; visitId: UndyingProjection["ritual"]["currentVisitId"] };
const dateLabel = (date: PublicGameDate | null) => date ? `第五纪${date.year}年${date.month}月${date.day}日` : "尚未登记";

/** Old spirit and object records remain read-only, with no new permission or repeated reward. */
export function UndyingGatekeeperHistory({ gatekeeper: value }: { gatekeeper: GatekeeperProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="看门人时期的经历">
    <h3>看门人时期的经历</h3>
    <p className="slice-notice">原灰羽、体内冥界短驻约定、原木牌、冥界之门与旧案按实际保存的记录保留，只供回看；晋升不复制原灵、不移动原物，也不重复结算旧成长。</p>
    <p>看门人扮演进度 {value.acting} · 消化：{value.digestion}</p>
    <details className="seer-fold"><summary>看门人原故事与供给</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.supplies}</p></details>
    {value.companion && <section aria-label="看门人原灰羽与短驻约定"><h4>同一原灰羽</h4>
      <p>{value.companion.name} · 原来源：{value.companion.source} · {value.companion.status}</p>
      <ul>{value.companion.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p className="slice-muted">灰羽仍是死灵导师时期的 SG6-GRAY-FEATHER。此处不补发新灵，也不自动派出、召回或重置原约定和费用。</p>
    </section>}
    {value.practice && <section aria-label="看门人原木牌与门的实际记录"><h4>原木牌与冥界之门</h4>
      <p>{value.practice.marker}</p><p>{value.practice.gate}</p><p>{value.practice.summary}</p>
    </section>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary><p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的结果与报告：{entry.result}</p>}
    </details>)}
    {value.bottles.length > 0 && <details className="seer-fold"><summary>看门人原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    <details className="seer-fold"><summary>看门人时期能力记录</summary>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>
    <p className="slice-muted">原收尸人、掘墓人、通灵者和死灵导师经历继续保留；此页没有重做旧实践的入口。</p>
  </section>;
}

export interface UndyingPanelProps {
  undying: UndyingProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: UndyingCommand) => void;
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
function RitualFacts({ ritual }: { ritual: UndyingProjection["ritual"] }) {
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
function LifecycleFacts({ lifecycle }: { lifecycle: UndyingProjection["lifecycle"] }) {
  return <section className="slice-notice" aria-label="不死者六十年周期登记与实际边界">
    <h3>周期登记与记忆准备</h3>
    <p>{lifecycle.status === "CYCLE_DEAD" ? "已到达原登记的首次六十年周年，同一身体处于周期性死亡；请在长期章节继续专用等待流程。"
      : lifecycle.experiencedCycles > 0 ? "已实际经历首次六十年周期与同一身体复起；当前记忆状态及旧人原物后果以长期章节记录为准。"
      : "不死者晋升/继承与记忆准备可玩，六十年周期尚未经历；长期章节另行安排真实供养与时代推进。"}</p>
    <dl className="seer-facts"><div><dt>实际晋升日期</dt><dd>{dateLabel(lifecycle.promotionDate)}</dd></div>
      <div><dt>{playerText("G预期六十年周年登记")}</dt><dd>{dateLabel(lifecycle.expectedCycleDate)}</dd></div>
      <div><dt>实际经历的周期</dt><dd>{lifecycle.experiencedCycles} 次</dd></div></dl>
    <p>{lifecycle.summary}</p><p>{lifecycle.boundary}</p>
    <p>{playerText("登记日期是本作G从原晋升日计算的周年，不是原著精确时刻保证。")}{lifecycle.status === "REGISTERED_NOT_EXPERIENCED" || lifecycle.status === "NOT_PROMOTED" ? "单有日期不是已经死亡复活的记录。" : "实际周期死与复起分别保存，不能仅凭周年登记认定已经复起。"}普通战斗死亡不自动复活，不补满健康、精神或灵性。</p>
    <p className="slice-muted">{playerText("长期章节先确认供养付费，再独立确认不可逆日期推进；7天复起等待为本作G，原著时长未知。原记忆册仍是同一本，外部原文可读不等于本人已寻回记忆，旧人的当前去向以真实时代记录为准。")}</p>
  </section>;
}

function LifeOriginals({ life }: { life: UndyingProjection["life"] }) {
  return <>
    <section className="slice-notice" aria-label="唯一原记忆簿与实际去向"><h5>同一本原记忆簿</h5>
      <p>{life.book.id} · 归玩家所有 · {LOCATION[life.book.location] ?? life.book.location}</p>
      <p>剩余空白页 {life.book.blankPages} 张 · 实际放到原桌 {life.book.placements} 次 · 亲手拿回 {life.book.returns} 次</p>
      {life.book.entries.length ? life.book.entries.map((entry) => <article key={entry.id} aria-label={`${entry.id}原记忆条目`}>
        <p>{entry.id} · 第{entry.recordedWeek}周实际记录 · 已知来源：{entry.sourceId}</p><p>{entry.text}</p>
      </article>) : <p>原三页尚未写入事实；只有实际知识核对成功后才会出现记录。</p>}
      <p className="slice-muted">普通抄录不耗封条、不授予非凡掌握，也不让错误证言变真。原簿在桌上时须亲手拿回；关闭页面或离场按钮不会复制或传送原簿。</p>
    </section>
    <section aria-label="原见证人当前同意与期限"><h5>当前的自愿见证</h5>
      <p>{life.witness.name} · {life.witness.age}岁成年女性 · {life.witness.id}</p>
      <p>当前{life.witness.alive ? "仍活着" : "已经死亡"}，{life.witness.willing ? "愿意参与本次核对" : "不愿参与本次核对"}；位置：{life.witness.location === "AWAY" ? "当前不在原档案室" : LOCATION[life.witness.location] ?? life.witness.location}。</p>
      <p>{life.witness.agreedWeek === null ? "尚未完成实际见证，当前意愿不等于已有成功核对记录。" : `第${life.witness.agreedWeek}周本人实际作证；对应原条目：${life.witness.entryIds.join("、")}。`}</p>
      <p>{life.witness.uncertainty ?? "只在本次活着、自愿且在场时核对。未来寿命、六十年后可联系以及届时继续同意均无保证。"}</p>
      <p className="slice-muted">仍是原联系人伊芙琳，不升级其位格。普通知识核对可能失败，不是催眠、读心、恢复记忆或永远生效的许诺。</p>
    </section>
    <details className="seer-fold"><summary>原回响、屏蔽盒与实际封条</summary><section aria-label="原封印对象与已付封条">
      <p>{life.seal.vessel}</p><p>{life.seal.box}</p>
      {life.seal.strips.length ? <ul>{life.seal.strips.map((strip, index) => <li key={index}>{strip}</li>)}</ul> : <p>没有已购买的原封条；能力准备须实际支付40便士购买一条。</p>}
      <p>能力尝试耗6灵性与本次同一原封条，意志难度18，成功失败均耗用；未用原条保留，后续准备复用它，不重复购买。普通方法用原屏蔽盒，不购封条，知识难度16。</p>
      <p className="slice-muted">这份低强度原回响归档案室，不是新赠玩家的幽灵。有限封印停止后重新躁动；普通屏蔽盒仅封存，没有让回响本身安静。原灰羽不参与，原进出与费用不变；不能净化高位存在或提取特性。</p>
    </section></details>
  </>;
}

/** Submit only committed public intentions; local review and case selection never move originals. */
export function UndyingPanel({ undying: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: UndyingPanelProps) {
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
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command)
    && !RITUAL_TYPES.includes(action.command.type) && !ENCOUNTER_TYPES.includes(action.command.type) && !OBJECT_TYPES.includes(action.command.type));
  const nextExit = EXIT_TYPES.map((type) => value.actions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = nextExit ?? value.actions.find((action) => action.enabled && action.command.type !== "CANCEL_RITUAL") ?? value.actions.find((action) => action.enabled) ?? value.actions[0];

  useEffect(() => { if (selectedCase && (activeCase || caseId === null)) setCaseId(selectedCase.id); }, [selectedCase, activeCase, caseId]);
  useEffect(() => {
    if (confirmation && !busy && error === null && (readOnly || !liveConfirmation || value.promoted
      || (submittedId !== null && !liveConfirmation.enabled) || (!isPreparation && !selectedBottle))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, busy, error, readOnly, liveConfirmation, value.promoted, isPreparation, selectedBottle, submittedId]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function actionButton(action: UndyingAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `undying-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (action.command.type === "CONSUME" || action.command.type === "CHECK_PREPARATION") {
            if (value.promoted) return;
            if (action.command.type === "CONSUME" && !value.bottles.some((bottle) => action.command.type === "CONSUME" && bottle.id === action.command.bottleId)) return;
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, visitId: value.ritual.currentVisitId });
          } else { if ("caseId" in action.command) setCaseId(action.command.caseId); onCommand(action.command); }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`undying-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirmAction() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !sameVisit || !liveConfirmation?.enabled
      || (!isPreparation && !selectedBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复记忆抄录、耗用原包或服药。"}
  </p>;

  if (confirmation) return <section className="seer-panel warrior-panel undying-panel seer-confirmation"
    aria-label={isPreparation ? "不死者专业准备的继续确认" : "这瓶不死者魔药的服用确认"} aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">当前原专家、同一原封装包与六十年负担</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{isPreparation ? "核对本次专业准备，自由选择是否继续" : selectedBottle?.title ?? "原瓶已不再可用"}</h3>
    {selectedBottle && <><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status} · 服用成功率 {selectedBottle.chance}%</p></>}
    <section className="slice-notice" aria-label="确认前的当前不死者准备"><RitualFacts ritual={value.ritual} /></section>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    <p className="slice-notice">{playerText("完整晋升配方与仪式细节尚未核实；本作采用原创G专业指导准备，不等于还原原著完整仪式，也不表示原著无需仪式。")}</p>
    <p>已知不死者有每六十年死亡复活并遗忘大部分记忆、随后逐渐恢复的负担。这里不模拟实际死亡，不承诺低风险或服药成功；普通战斗死亡不自动复活。</p>
    {isPreparation ? <p>确认只核对当前本人可实际接触的身体、当前自愿在场的原专家与同一原封装包，并确认理解六十年负担，选择开启本周窗口；服药还需逐瓶确认。可以暂不继续，返回后0行动实际离场，继续看门人生活。预约费用不退，未用包保留实际位置。</p>
      : <><section className="slice-notice seer-risk" aria-label="不死者服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
        <p>成功或失败都会耗用这一原瓶与本次原封装包。下一次尝试须另行付费预约新的原包，等下一真实周亲自入场；旧包不能复用。服药后仍须实际走出原准备室。</p>
        <p>{playerText("成功只登记实际晋升日期与G预期六十年周年，实际经历周期仍为0；不会凭这次服药生成死亡、复活或记忆恢复记录。")}</p>
        <section aria-label="服药前当前资源"><h4>当前角色资源</h4><dl className="seer-facts">
          <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div><div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
          <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
          <div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
        </dl></section></>}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="undying-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{isPreparation ? "暂不继续，返回原准备室" : "暂不服用，返回原准备室"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "undying-confirm-reason" : undefined} onClick={confirmAction}>
        {busy ? "正在结算并保存…" : isPreparation ? "确认核对，继续本次专业准备" : `确认服用「${selectedBottle?.title ?? "原瓶"}」`}
      </button>
    </div><p className="slice-muted">关闭确认不代替实际离场。提交后只等待这一原操作的保存回执，不重复扣费或服药。</p>{saveNotice}
  </section>;

  const ritualContent = <><RitualFacts ritual={value.ritual} /><p className="slice-muted">{value.ritual.boundary}</p><p>{value.ritual.consequence}</p>
    <div className="warrior-action-list" role="group" aria-label="专业准备与零行动离场">{ritualActions.map(actionButton)}</div>
    <p className="slice-muted">等待预约时仍可正常生活。真正入场后须0行动实际结束或取消；退出不退款、不移动专家，也不把未用原包送入玩家背包。</p>
    {value.ritual.visits.some((visit) => visit.id !== value.ritual.currentVisitId) && <details className="seer-fold"><summary>已结束的不死者到访与原封装包</summary>
      {value.ritual.visits.filter((visit) => visit.id !== value.ritual.currentVisitId).map((visit) => <article key={visit.id} aria-label={`${visit.id}原到访历史`}><VisitFacts visit={visit} /></article>)}
    </details>}</>;
  return <div className="seer-panel warrior-panel undying-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="不死者成长下一步">
      <span className="seer-seal">{value.promoted ? "不死者4" : "看门人5 → 不死者4"}</span><h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>{nextExit ? "先处理当前收束：" : "下一步："}</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : value.acting >= 100 ? value.lifecycle.status === "CYCLE_DEAD" ? "已到首次周期性死亡；请在长期章节继续同一身体的专用等待流程。" : value.lifecycle.experiencedCycles > 0 ? "记忆准备实践已消化；已实际经历的周期及部分记忆状态请查看长期章节。" : "记忆准备实践已消化，可以继续生活或回看实际记录；六十年周期尚未经历。" : "请先查看当前公开条件与原物记录。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">死神途径不死者（序列4）；下一阶段为摆渡人（序列3），达到成长条件后可查看独立准备。</p>
      {readOnly && <p className="slice-notice">当前为只读记录，不重复准备原物、服药或结算成长。</p>}
    </section>
    <LifecycleFacts lifecycle={value.lifecycle} />
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="不死者成长行动">{growthActions.map(actionButton)}</div>}
    {value.discovered && !value.promoted && <section className="slice-notice" aria-label="不死者配方与专业准备边界">
      <h3>{playerText("独立成品与晋升准备")}</h3><p>{playerText("取得有来源的成品原瓶，由当前自愿且在场的独立专家主持专业准备；此渠道不提供完整配方或自行调配步骤。")}</p>
      <p>{value.supplies}</p><p>你可以暂不晋升，0行动退出已进入的原准备室，继续看门人生活。原联系人伊芙琳的身份不会因介绍专家而升级。</p>
    </section>}
    {value.discovered && (value.promoted && value.ritual.currentVisitId === null
      ? <details className="seer-fold"><summary>不死者晋升准备与原包历史</summary><section aria-label="不死者当前专业准备">{ritualContent}</section></details>
      : <section aria-label="不死者当前专业准备">{ritualContent}</section>)}
    {value.bottles.length > 0 && <details className="seer-fold" open={!value.promoted}><summary>不死者原瓶 · 来源与去向</summary>
      <section aria-label="不死者原瓶与独立来源">{value.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
        <div><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        <div className="warrior-action-list">{bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === bottle.id).map(actionButton)}</div>
      </article>)}</section>
    </details>}
    {value.promoted && selectedCase && <section aria-label="不死者有限生活实践"><h3>{value.life.title}</h3><p>{value.life.story}</p>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前生活实践" value={selectedCase.id} disabled={locked || value.life.inside}
        onChange={(event) => setCaseId(event.target.value)}>{value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.method === "ABILITY" ? "有限冥界借力" : selectedCase.method === "ORDINARY" ? "普通手段" : "尚未选择方法"}</p>
        <section aria-label="当前已知现场"><h5>已经观察到的现场</h5>
          {selectedCase.observations.length ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p className="slice-muted">先到原现场观察，尚无本次亲见记录。</p>}
        </section>
        <LifeOriginals life={value.life} />
        <div className="warrior-action-list" role="group" aria-label="原书的实际归还">{objectActions.map(actionButton)}</div>
        {selectedCase.result && <section aria-label="不死者实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前不死者生活行动">{selectedCaseActions.map(actionButton)}</div>
        <p className="slice-muted">观察、准备、实际尝试与报告按按钮支付真实行动。归还原书、停止效果和实际离场按当前条件0行动完成；失败保留成本，下一真实周再重试。关闭页面不会归还原书或停止封印。</p>
      </section>
    </section>}
    {value.promoted && <details className="seer-fold" open={value.encounter.inside}><summary>可选原院冲突与真实后果</summary><section aria-label="不死者可选原院冲突">
      <h3>{value.encounter.title}</h3><p>{value.encounter.story}</p>
      <p>{ENCOUNTER_STATUS[value.encounter.status] ?? value.encounter.status} · {value.encounter.inside ? "本人仍在当前原院遭遇中" : "当前没有未结束的遭遇现场"}</p>
      <p>同一原对手：{value.encounter.enemy.name} · {value.encounter.enemy.age}岁 · {value.encounter.enemy.id} · 健康 {value.encounter.enemy.health} · 精神 {value.encounter.enemy.mind}</p>
      <p>原对手状态：{value.encounter.enemy.status === "DEAD" ? "原本人已真正死亡" : value.encounter.enemy.status === "SURRENDERED" ? "仍活着，已自行停止抵抗" : value.encounter.enemy.status}；原棍 {value.encounter.enemy.weaponId} · {LOCATION[value.encounter.enemy.weaponLocation] ?? value.encounter.enemy.weaponLocation}。</p>
      <p className="slice-muted">交谈后可0行动沿原出口和平离开，不追击。亡者之语与有限冥界借力依赖真实掌握并可能失败；短暂压制在当轮结束，不是永久封印或无条件死亡。灰羽不自动派出，普通战斗死亡不自动复活。</p>
      <div className="warrior-action-list" role="group" aria-label="原院交谈、战斗与零行动退出">{encounterActions.map(actionButton)}</div>
    </section></details>}
    {value.promoted && <section aria-label="不死者能力与消化"><h3>能力与消化</h3><p>扮演进度 {value.acting} · {value.digestion}</p>
      <progress className="cryptologist-progress" aria-label="不死者扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">原亡者之语、体内冥界和冥界之门的能力与掌握保留。记忆记录和自愿见证是普通准备，不增加非凡能力掌握，也不保证恢复完整自我；没有无代价复活、身体复制、灵魂补全或任意灵界传送。</p>
    </section>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p>
      <p>{playerText("本作人物、原物、生活案件、专业准备、周年登记、成本、检定与战盘数值均为原创G。有限冥界借力封印仅实现已核方向，不代表完整原著能力清单，也不能普遍净化封印物或高位存在。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
