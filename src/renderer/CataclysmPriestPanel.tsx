import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { CataclysmPriestAction, CataclysmPriestCommand, CataclysmPriestProjection } from "../domain/cataclysm-priest/types";
import type { OceanSingerProjection } from "../domain/ocean-singer/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对现场", PREPARED: "已准备，尚未尝试",
  ACTIVE: "现场仍须实际收束", EXAMINED: "已有实际结果，待报告", RESOLVED: "已提交有限报告",
};
const LOCATION: Record<string, string> = {
  OUTSIDE: "原海湾外", RIDGE: "原高脊", PLATFORM: "原临海台面", LOW: "原低岸现场", AWAY: "当前不在现场",
  SUPPLIER: "原供应方保管", CONSUMED: "已经耗用", HAND: "原对手手中", QUAY: "原石岸地面",
};
const OUTCOME: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "大失败" };
const DAMAGE: Record<string, string> = { INTACT: "仍完整", CRACKED: "已开裂", BROKEN: "已断裂", DAMAGED: "已损坏", WASHED_OUT: "已冲毁" };
const SEA: Record<string, string> = { CALM: "原海水平静", DRAWDOWN: "海水已退，第一波将至", FIRST_WAVE: "第一波已冲过台面", RECEDED: "回卷浪已过，海水退去" };
const ENCOUNTER_STATUS: Record<string, string> = {
  AVAILABLE: "尚未交谈", READY: "已交谈，可和平离开", FIGHTING: "实际战斗中",
  RESOLVED: "原冲突已结束", RETREATED: "已沿原出口撤离", LOST: "原冲突已造成真实失败",
};
const RITUAL_TYPES = ["BOOK_RITUAL", "BEGIN_RITUAL", "CLEAR_COAST", "CHECK_PREPARATION", "START_QUAKE", "HOLD_POSITION", "END_RITUAL", "LEAVE_RITUAL"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"];
const OBJECT_TYPES = ["MOVE_ALLY", "RETURN_ALLY", "RETURN_FLOAT"];
const CLOSE_TYPES = ["END_RITUAL", "STOP_EFFECT", "RETURN_FLOAT", "RETURN_ALLY", "CLOSE"];
type Visit = CataclysmPriestProjection["ritual"]["visits"][number];
type Confirmation = { action: CataclysmPriestAction; visitId: CataclysmPriestProjection["ritual"]["currentVisitId"] };

/** The original S5 journey remains a record, with no old practice or ritual commands. */
export function CataclysmPriestOceanSingerHistory({ oceanSinger: value }: { oceanSinger: OceanSingerProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="海洋歌者时期的经历">
    <h3>海洋歌者时期的经历</h3>
    <p className="slice-notice">原海怪、船组、水膜、原瓶与实际往返均保留，只供回看。晋升不会再次结算旧实践，也不会改写原失败、伤势或费用。</p>
    <p>晋升时海洋歌者扮演进度 {value.acting} · 消化：{value.digestion}</p>
    <details className="seer-fold"><summary>海洋歌者原故事与供给</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.supplies}</p></details>
    <section aria-label="海洋歌者原海怪仪式与往返记录"><h4>原海怪仪式与实际返程</h4>
      <p>原记录位置：{value.ritual.location === "DOCK" ? "原码头" : value.ritual.location === "COAST" ? "原近海仪式岸边" : "原活体奥布尼斯海怪腹中"}</p>
      <p>{value.ritual.status} · 实际赴仪式 {value.ritual.visits} 次 · 腹中实际服药 {value.ritual.consumptions} 次</p>
      <p>原水膜：{value.ritual.waterFilm ? "原记录仍启用" : "原记录已结束或尚未启用"}</p><p>{value.ritual.summary}</p><p className="slice-muted">{value.ritual.source}</p>
    </section>
    {value.practice && <details className="seer-fold"><summary>原同伴、歌声与潮流记录</summary>
      <p>同伴位置：{value.practice.allyPosition} · 原歌声：{value.practice.song} · 原实际影响：{value.practice.affected}</p>
      <ul>{value.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
    </details>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary><p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的结果与报告：{entry.result}</p>}
    </details>)}
    {value.bottles.length > 0 && <details className="seer-fold"><summary>海洋歌者原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {value.abilities.length > 0 && <details className="seer-fold"><summary>海洋歌者时期能力记录</summary>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface CataclysmPriestPanelProps {
  cataclysmPriest: CataclysmPriestProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: CataclysmPriestCommand) => void;
}
function VisitFacts({ visit }: { visit: Visit }) {
  return <>
    <p>原到访：{visit.id} · {visit.status} · 原场地：{visit.siteId}</p>
    <p>实付 {visit.paidPennies}便士 · 第{visit.bookedWeek}周预约 · 最早第{visit.plannedWeek}周赴场</p>
    <p>经过的现场时间：{visit.elapsedSeconds}秒</p>
    <p>本次原套件：{visit.kit.id} · {visit.kit.status === "CONSUMED" ? "已经耗用，不能复用" : visit.kit.sealsIntact ? "封装仍完整，尚未耗用" : "封装已不完整"} · {LOCATION[visit.kit.location] ?? visit.kit.location}</p>
    <section aria-label={`${visit.id}原设施与海水`}><dl className="seer-facts">
      <div><dt>原木质潮标 {visit.site.gaugeId}</dt><dd>{DAMAGE[visit.site.gauge]}</dd></div>
      <div><dt>原下层步道 {visit.site.walkwayId}</dt><dd>{DAMAGE[visit.site.lowerWalkway]}</dd></div>
      <div><dt>当前真实海水</dt><dd>{SEA[visit.site.sea]}</dd></div>
      <div><dt>原高处后阶</dt><dd>{visit.site.upperBackstairs === "CLEAR" ? "普通道路仍畅通，通向原高脊" : visit.site.upperBackstairs}</dd></div>
    </dl></section>
    <p>本次原瓶：{visit.pendingBottleId ?? "尚未服用"} · 原服药结果：{visit.rawOutcome ? OUTCOME[visit.rawOutcome] ?? visit.rawOutcome : "尚无"}</p>
    <p>{visit.finishedSuccess ? "已在灾害结束时存活，晋升已经完成。" : visit.rawOutcome ? "服药结果已保存；这项原结果不等于完成晋升。" : "尚未开始服药后的存活考验。"}</p>
    {visit.abortedReason && <p>本次未完成的原因：{visit.abortedReason === "WITHDRAWN" ? "本人已沿原后阶撤退，原成本与损坏保留" : "本人在原台面死亡，死亡位置与原后果保留"}</p>}
    {visit.hazards.length > 0 && <section aria-label={`${visit.id}实际浪涌伤势`}><h5>已经经历的真实浪涌</h5>
      {visit.hazards.map((hazard) => <p key={hazard.stage}>第{hazard.stage}段 · {hazard.elapsedSeconds}秒 · {OUTCOME[hazard.tier]} · 实际伤害 {hazard.healthDamage} · 健康 {hazard.healthBefore} → {hazard.healthAfter}</p>)}
    </section>}
    <p>{visit.summary}</p>
    <details className="seer-fold"><summary>{visit.id}的原来源</summary><p>{visit.source}</p><p>{visit.kit.source}</p><p>{visit.site.source}</p></details>
  </>;
}
function RitualFacts({ ritual }: { ritual: CataclysmPriestProjection["ritual"] }) {
  const current = ritual.visits.find((visit) => visit.id === ritual.currentVisitId);
  return <>
    <h4>{ritual.title}</h4><p>{ritual.status}</p><p>{ritual.appointment}</p>
    <p>本人实际位置：{LOCATION[ritual.playerLocation] ?? ritual.playerLocation}</p>
    <p>当前服药窗口：{ritual.windowOpen ? "原海水已退，第一波尚未抵岸，可在本次现场独立确认服药" : "当前没有合格的服药窗口"}</p>
    {ritual.expert && <section aria-label="当前主持者与助手的位置">
      <p>{ritual.expert.name} · {ritual.expert.age}岁 · 序列{ritual.expert.sequence} · {ritual.expert.id}</p>
      <p>当前{ritual.expert.alive ? "仍活着" : "已经死亡"}，{ritual.expert.willing ? "自愿参与本次安排" : "不愿参与本次安排"}；位置：{LOCATION[ritual.expert.location] ?? ritual.expert.location}。</p>
      {ritual.assistants.map((person) => <p key={person.id}>{person.name} · {person.age}岁 · {person.id}：{person.alive ? "仍活着" : "已经死亡"}，{person.willing ? "当前愿意参与" : "当前不愿参与"}，位置：{LOCATION[person.location] ?? person.location}。</p>)}
    </section>}
    {current ? <VisitFacts visit={current} /> : <p className="slice-muted">当前没有未结束的到访；原地点、耗用与损坏仍保留在历史中。</p>}
  </>;
}

/** Local choices never advance the event clock, move originals or award a promotion. */
export function CataclysmPriestPanel({ cataclysmPriest: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: CataclysmPriestPanelProps) {
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
  const sameVisit = !confirmation || confirmation.visitId === value.ritual.currentVisitId;
  const liveConfirmation = confirmation && sameVisit ? value.actions.find((action) => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmationType = confirmation?.action.command.type;
  const selectedBottleId = confirmation?.action.command.type === "CONSUME" ? confirmation.action.command.bottleId : null;
  const selectedBottle = value.bottles.find((bottle) => bottle.id === selectedBottleId);
  const currentVisit = value.ritual.visits.find((visit) => visit.id === value.ritual.currentVisitId);
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
  const nextClose = CLOSE_TYPES.map((type) => value.actions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = nextClose ?? value.actions.find((action) => action.enabled && action.command.type !== "LEAVE_RITUAL") ?? value.actions.find((action) => action.enabled) ?? value.actions[0];

  useEffect(() => { if (selectedCase && (activeCase || caseId === null)) setCaseId(selectedCase.id); }, [selectedCase, activeCase, caseId]);
  useEffect(() => {
    if (confirmation && !busy && error === null && (readOnly || !liveConfirmation || value.promoted
      || (submittedId !== null && !liveConfirmation.enabled) || (confirmationType === "CONSUME" && !selectedBottle))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, busy, error, readOnly, liveConfirmation, value.promoted, confirmationType, selectedBottle, submittedId]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function actionButton(action: CataclysmPriestAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `cataclysm-priest-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (["CHECK_PREPARATION", "START_QUAKE", "CONSUME"].includes(action.command.type)) {
            if (value.promoted) return;
            if (action.command.type === "CONSUME" && !value.bottles.some((bottle) => action.command.type === "CONSUME" && bottle.id === action.command.bottleId)) return;
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, visitId: value.ritual.currentVisitId });
          } else { if ("caseId" in action.command) setCaseId(action.command.caseId); onCommand(action.command); }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`cataclysm-priest-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirmAction() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !sameVisit || !liveConfirmation?.enabled
      || (confirmationType === "CONSUME" && !selectedBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复引发灾害、服药或推进波浪。"}
  </p>;

  if (confirmation) return <section className="seer-panel warrior-panel cataclysm-priest-panel seer-confirmation"
    aria-label={confirmationType === "CHECK_PREPARATION" ? "灾难主祭准备的独立确认" : confirmationType === "START_QUAKE" ? "引发本次地震海啸的独立确认" : "这瓶灾难主祭魔药的服用确认"}
    aria-busy={busy} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">当前原场地、人员与实际成本</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmationType === "CHECK_PREPARATION" ? "核对撤离与现场准备" : confirmationType === "START_QUAKE" ? "是否引发本次地震与海啸？" : selectedBottle?.title ?? "原瓶已不再可用"}</h3>
    {selectedBottle && <><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status} · 服用成功率 {selectedBottle.chance}%</p></>}
    <section className="slice-notice" aria-label="确认前的灾难主祭当前现场"><RitualFacts ritual={value.ritual} /></section>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmationType === "CHECK_PREPARATION" ? <p>核对已实际撤离的助手与本次原套件。此次确认不会引发地震，也不会服药；之后仍分别由你决定。可以暂不继续，沿原高处后阶撤到原高脊，已付费用不退。</p>
      : confirmationType === "START_QUAKE" ? <section className="slice-notice seer-risk" aria-label="本次灾害与退路的代价">
        <h4>原场地会实际受损</h4><p>{value.ritual.consequence}</p>
        <p>地震会破坏原木质潮标和下层步道，随后真实海水淹过台面。人员已撤离不等于场地免受损坏；触发后即使撤退，海浪仍会走完本次过程，不能撤回灾害。</p>
        <p>原高处后阶是当前已知的普通撤离路线。留下会经历两段各60秒的危险，可能受伤或死亡；原瓶服药成功也不能免除这两段考验。</p>
      </section>
      : <><section className="slice-notice seer-risk" aria-label="灾难主祭服用风险与四档结果"><h4>服药结果与存活是两件事</h4><p>{value.risk}</p></section>
        <p>确认会耗用这一原瓶与本次原套件。服药成功仅是暂定结果，之后仍须亲自撑过第一波与回卷浪，在海水退去时活着，才完成晋升。</p>
        <p>每段危险前都可沿原高处后阶撤到原高脊。撤退保留海洋歌者身份，也保留已耗原瓶、费用和场地损坏；下一次须另付费用预约新场地与新套件，等下一真实周。</p>
        <section aria-label="服药前当前资源"><h4>你现在的状态</h4><dl className="seer-facts">
          <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div><div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
          <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
          <div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
        </dl></section></>}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="cataclysm-priest-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmationType === "CONSUME" ? "暂不服用，返回现场" : "暂不继续，返回现场"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirmAction}
        aria-describedby={liveConfirmation?.reason ? "cataclysm-priest-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : confirmationType === "CHECK_PREPARATION" ? "确认核对本次准备" : confirmationType === "START_QUAKE" ? "确认引发本次地震与海啸" : `确认服用「${selectedBottle?.title ?? "原瓶"}」`}
      </button>
    </div><p className="slice-muted">关闭确认不会代替实际撤离。提交后等待同一操作保存，不重复扣费或重抽结果。</p>{saveNotice}
  </section>;

  const ritualContent = <><RitualFacts ritual={value.ritual} />
    {currentVisit?.rawOutcome && !currentVisit.abortedReason && <section className="slice-notice" aria-label="服药后的两段存活考验" aria-live="polite">
      <h4>{currentVisit.phase === "ENDED" ? "两段灾害已经实际结束" : "仍须在灾害结束时存活"}</h4>
      <ol><li>{currentVisit.elapsedSeconds >= 60 ? "第一波已实际经过" : "第一波尚待经历"}：真实海水冲上原台面，持续60秒。</li>
        <li>{currentVisit.elapsedSeconds >= 120 ? "回卷浪已实际经过，海水退去" : "回卷浪尚待经历"}：再经过60秒，才到本次灾害结束。</li></ol>
      <p>当前健康 {resources.health} / {resources.maxHealth}。{currentVisit.phase === "ENDED" ? "仍须沿原后阶实际离开台面。" : "每次留下都可能受伤；服药保护不会让后续灾害免死。"}</p>
    </section>}
    <div className="warrior-action-list" role="group" aria-label="灾难主祭仪式与实际撤离">{ritualActions.map(actionButton)}</div>
    {value.ritual.playerLocation === "PLATFORM" && <p className="slice-notice">仍在原临海台面。可用当前公开按钮沿原高处后阶实际撤离；切换卷宗、关闭确认或保存重试都不会替你移动。</p>}
    <details className="seer-fold"><summary>本次安排的范围与代价</summary><p>{value.ritual.boundary}</p><p>{value.ritual.consequence}</p><p>{value.ritual.source}</p></details>
    {value.ritual.visits.some((visit) => visit.id !== value.ritual.currentVisitId) && <details className="seer-fold"><summary>灾难主祭原场地、损坏与服药历史</summary>
      {value.ritual.visits.filter((visit) => visit.id !== value.ritual.currentVisitId).map((visit) => <article key={visit.id} aria-label={`${visit.id}原到访历史`}><VisitFacts visit={visit} /></article>)}
    </details>}</>;
  return <div className="seer-panel warrior-panel cataclysm-priest-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="灾难主祭成长下一步">
      <span className="seer-seal">{value.promoted ? "灾难主祭4" : "海洋歌者5 → 灾难主祭4"}</span><h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>{nextClose ? "先处理当前收束：" : "下一步："}</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : value.acting >= 100 ? "这一阶段已消化，可以继续生活或回看实际记录。" : "请先查看当前公开条件与现场记录。"}</p>
      <p>{value.digestion}</p>{readOnly && <p className="slice-notice">当前为只读记录，不引发灾害、服药或重复结算成长。</p>}
    </section>
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="灾难主祭成长行动">{growthActions.map(actionButton)}</div>}
    {value.discovered && !value.promoted && <section className="slice-notice" aria-label="灾难主祭配方与仪式边界">
      <h3>在地震与海啸中服药，并活到结束</h3><p>{playerText("完整配方、灾害规模与原著完整安排尚未核实。这里采用本作原创G的无人海湾与专业协作，原瓶、费用、场地和人员都有独立来源。")}</p>
      <p>{value.supplies}</p>
    </section>}
    {(value.discovered || currentVisit) && (value.promoted && value.ritual.playerLocation !== "PLATFORM"
      ? <details className="seer-fold"><summary>灾难主祭晋升与原场地记录</summary><section aria-label="灾难主祭当前仪式">{ritualContent}</section></details>
      : <section aria-label="灾难主祭当前仪式">{ritualContent}</section>)}
    {value.bottles.length > 0 && <details className="seer-fold" open={!value.promoted}><summary>灾难主祭原瓶 · 来源与去向</summary>
      <section aria-label="灾难主祭原瓶与独立来源">{value.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
        <div><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        <div className="warrior-action-list">{bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === bottle.id).map(actionButton)}</div>
      </article>)}</section>
    </details>}
    {value.promoted && selectedCase && <section aria-label="灾难主祭有限生活实践"><h3>{value.life.title}</h3>
      <label className="seer-case-selector">选择当前生活实践<select value={selectedCase.id} disabled={locked || value.life.inside || !!activeCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="seer-current-case warrior-case" aria-label="当前灾难主祭生活实践"><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen ? "现场接触尚未实际结束" : "当前没有未结束的接触"}</p>
        <p>本次方法：{selectedCase.method === "ABILITY" ? "有真实灵性成本的能力尝试" : selectedCase.method === "ORDINARY" ? "使用同一原物的普通办法，不增加能力掌握" : "尚未选择"}</p>
        {selectedCase.observations.length > 0 && <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
        <section className="slice-notice" aria-label="当前同伴与有限效果" aria-live="polite"><h5>同伴与现场效果</h5>
          <p>{value.life.ally.name} · {value.life.ally.age}岁 · {value.life.ally.id}：{value.life.ally.alive ? "仍活着" : "已经死亡"}，{value.life.ally.willing ? "当前愿意参与" : "当前不愿参与"}。</p>
          <p>实际位置：{LOCATION[value.life.ally.location] ?? value.life.ally.location} · 实际撤到高脊 {value.life.ally.moves} 次 · 实际返回 {value.life.ally.returns} 次</p>
          <p>{selectedCase.effectActive ? "当前效果仍在持续，须先实际停止。" : "当前没有持续中的能力效果。"}</p>
          <div className="warrior-action-list" role="group" aria-label="同伴与原浮标的实际处理">{objectActions.map(actionButton)}</div>
        </section>
        <section aria-label="灾难主祭当前原物与真实海水"><h5>同一原物与真实变化</h5>{value.life.objects.map((text, index) => <p key={index}>{text}</p>)}</section>
        {selectedCase.result && <section aria-label="灾难主祭实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前灾难主祭生活行动">{selectedCaseActions.map(actionButton)}</div>
        <p className="slice-muted">先停止效果，再处理原物与同伴返回，最后结束现场并报告。失败保留成本，下一真实周才能重试；停止不会修好原绳、消除湿痕或移回浮标。</p>
      </section>
    </section>}
    {value.promoted && <details className="seer-fold" open={value.encounter.inside}><summary>可选原石岸冲突与真实后果</summary><section aria-label="灾难主祭可选原石岸冲突">
      <h3>{value.encounter.title}</h3><p>{value.encounter.story}</p><p>{ENCOUNTER_STATUS[value.encounter.status] ?? value.encounter.status}</p>
      <p>同一原对手：{value.encounter.enemy.name} · {value.encounter.enemy.age}岁 · {value.encounter.enemy.id} · 健康 {value.encounter.enemy.health} · 精神 {value.encounter.enemy.mind}</p>
      <p>原本人：{value.encounter.enemy.status === "DEAD" ? "已经真正死亡" : value.encounter.enemy.status === "SURRENDERED" ? "仍活着，已自行停止抵抗" : value.encounter.enemy.status} · 原棍 {value.encounter.enemy.weaponId} · {LOCATION[value.encounter.enemy.weaponLocation] ?? value.encounter.enemy.weaponLocation}</p>
      <p>当前实际水源：{value.encounter.waterSource === "SEAWATER" ? "原石岸旁的真实海水" : "当前没有可用海水"}。</p>
      <p className="slice-muted">交谈后可0行动沿普通干燥出口和平离开，对方不追击。风、水与雷电均须实际成本且可能失败，普通对手也不保证能战胜。</p>
      <div className="warrior-action-list" role="group" aria-label="原石岸交谈、战斗与退出">{encounterActions.map(actionButton)}</div>
    </section></details>}
    {value.promoted && <section aria-label="灾难主祭能力与消化"><h3>能力与消化</h3><p>扮演进度 {value.acting} · {value.digestion}</p>
      <progress className="cryptologist-progress" aria-label="灾难主祭扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
    </section>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p>
      <p>{playerText("本作人物、场地、两段时间、价格、检定与实践数值均为原创G。海水来自当前真实海域，不能在内陆凭空造出海洋；同伴与环境不会自动免疫。本面板保留灾难主祭原历史；海王有限海域实践另有入口，天灾位格尚未开放。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
