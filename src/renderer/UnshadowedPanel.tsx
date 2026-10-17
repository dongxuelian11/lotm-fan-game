import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PriestOfLightProjection } from "../domain/priest-of-light/types";
import type { UnshadowedAction, UnshadowedCommand, UnshadowedProjection } from "../domain/unshadowed/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对原现场", OBSERVED: "已有实际观察", PREPARED: "已准备，尚未实际执行",
  ACTIVE: "现场仍须实际收束", EXAMINED: "已有实际结果，待报告", RESOLVED: "已提交有限报告",
};
const LOCATION: Record<string, string> = {
  OUTSIDE: "已在原场地外", HALL: "原仪式室内", ROOM: "原练习室内", DOOR_OUTSIDE: "沿普通门走到室外",
  BENCH: "原档案工作台", COURTYARD: "原庭院地面", LOW: "原练习现场", AWAY: "当前不在场",
  TABLE: "原仪式桌上", SUPPLIER: "原供应方保管", PLAYER: "本人实际持有", CONSUMED: "已实际耗用", HAND: "原对手手中",
};
const OUTCOME: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "大失败" };
const RITUAL_TYPES = ["BOOK_RITUAL", "BEGIN_RITUAL", "DECLARE_EMOTION", "SEPARATE_EMOTION", "RETURN_EMOTION", "END_RITUAL", "CANCEL_RITUAL"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"];
const OBJECT_TYPES = ["MOVE_ALLY", "RETURN_ALLY", "STEP_OUT", "STEP_IN", "COOL_TARGET"];
const REVIEW_TYPES = ["DECLARE_EMOTION", "SEPARATE_EMOTION", "CONSUME", "CANCEL_RITUAL"];
const CLOSE_TYPES = ["RETURN_EMOTION", "END_RITUAL", "STOP_EFFECT", "COOL_TARGET", "STEP_IN", "RETURN_ALLY", "CLOSE"];

/** Earlier originals remain saved history; there are no executable S5 controls here. */
export function UnshadowedPriestOfLightHistory({ priestOfLight: value }: { priestOfLight: PriestOfLightProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="光之祭司时期的经历">
    <h3>光之祭司时期的经历</h3>
    <p className="slice-notice">原导师、原不化坚冰、原灯、灵与旧案均按已保存的事实保留，只供回看。晋升不会替你移动原物、重做旧仪式、清除旧失败或补发奖励。</p>
    <p>晋升时光之祭司扮演进度 {value.acting} · 消化：{value.digestion}</p>
    <details className="seer-fold"><summary>光之祭司原故事与供给</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.supplies}</p></details>
    <section aria-label="光之祭司原坚冰仪式与返程"><h4>原坚冰仪式与实际返程</h4>
      <p>原记录位置：{value.ritual.location === "GUIDE" ? "原导师处" : value.ritual.location === "CHAMBER" ? "原遮光地窖外间" : "原不化坚冰中"}</p>
      <p>{value.ritual.status} · 实际赴仪式 {value.ritual.visits} 次 · 冰中实际服药 {value.ritual.consumptions} 次</p>
      <p>原身体：{value.ritual.nonMeltingIce ? "仍实际埋入原不化坚冰" : "当前未埋入原不化坚冰"} · 原遮光：{value.ritual.darkness ? "当前仍完整遮光" : "当前不处于完整遮光中"}</p>
      <p>原协助者：{value.ritual.helperPresent ? "原记录仍在场" : "原记录当前未在场"}</p><p>{value.ritual.summary}</p><p className="slice-muted">{value.ritual.source}</p>
    </section>
    {value.practice && <details className="seer-fold"><summary>原灯、光环与原灵的实际记录</summary>
      <p>原灯位置：{value.practice.lanternPosition} · 原光环：{value.practice.aura} · 原灵：{value.practice.distressed}</p>
      <ul>{value.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
    </details>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary><p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>原接触：{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的结果与报告：{entry.result}</p>}
    </details>)}
    {value.formulaKnown && <details className="seer-fold"><summary>光之祭司时期已知配方</summary><ul className="seer-formula">
      {value.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong>{material.note && <p>{material.note}</p>}</li>)}
    </ul></details>}
    {value.bottles.length > 0 && <details className="seer-fold"><summary>光之祭司原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    <details className="seer-fold"><summary>光之祭司时期能力记录</summary>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>
    <p className="slice-muted">原歌颂者、祈光人、太阳神官与公证人的经历和掌握继续保留；本页没有旧实践入口。</p>
  </section>;
}

export interface UnshadowedPanelProps {
  unshadowed: UnshadowedProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: UnshadowedCommand) => void;
}

type Confirmation = { action: UnshadowedAction; visitId: UnshadowedProjection["ritual"]["currentVisitId"] };

/** The view only submits public intentions. Closing a review never returns an emotion. */
export function UnshadowedPanel({ unshadowed: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: UnshadowedPanelProps) {
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
  const batchActions = value.actions.filter((action) => "batchId" in action.command);
  const objectActions = value.actions.filter((action) => OBJECT_TYPES.includes(action.command.type));
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command) && !("batchId" in action.command)
    && !RITUAL_TYPES.includes(action.command.type) && !ENCOUNTER_TYPES.includes(action.command.type) && !OBJECT_TYPES.includes(action.command.type));
  const nextClose = CLOSE_TYPES.map((type) => value.actions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = nextClose ?? value.actions.find((action) => action.enabled && action.command.type !== "CANCEL_RITUAL") ?? value.actions.find((action) => action.enabled) ?? value.actions[0];

  useEffect(() => { if (selectedCase && (activeCase || caseId === null)) setCaseId(selectedCase.id); }, [selectedCase, activeCase, caseId]);
  useEffect(() => {
    if (confirmation && !busy && error === null && (readOnly || !liveConfirmation
      || (submittedId !== null && !liveConfirmation.enabled) || (confirmationType === "CONSUME" && !selectedBottle))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, busy, error, readOnly, liveConfirmation, confirmationType, selectedBottle, submittedId]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function actionButton(action: UnshadowedAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `unshadowed-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (REVIEW_TYPES.includes(action.command.type)) {
            if (action.command.type === "CONSUME" && !value.bottles.some((bottle) => action.command.type === "CONSUME" && bottle.id === action.command.bottleId)) return;
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, visitId: value.ritual.currentVisitId });
          } else { if ("caseId" in action.command) setCaseId(action.command.caseId); onCommand(action.command); }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`unshadowed-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirmAction() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !sameVisit || !liveConfirmation?.enabled
      || (confirmationType === "CONSUME" && !selectedBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复分离、服药或回输。"}
  </p>;
  const confirmLabel = confirmationType === "DECLARE_EMOTION" ? "确认这是本角色此刻最强烈、最不愿舍弃的情感"
    : confirmationType === "SEPARATE_EMOTION" ? "确认由专业者分离这份声明情感"
    : confirmationType === "CANCEL_RITUAL" ? "确认按当前原状态回输并退出，不再晋升"
    : `确认服用「${selectedBottle?.title ?? "原瓶"}」`;

  if (confirmation) return <section className="seer-panel warrior-panel unshadowed-panel seer-confirmation"
    aria-label={confirmationType === "DECLARE_EMOTION" ? "最强烈情感的独立声明" : confirmationType === "SEPARATE_EMOTION" ? "声明情感分离的独立确认" : confirmationType === "CANCEL_RITUAL" ? "放弃本次无暗者晋升的确认" : "这瓶无暗者魔药的服用确认"}
    aria-busy={busy} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">本人选择、同一原情感与实际回输</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmationType === "DECLARE_EMOTION" ? "由你决定本角色此刻最珍重的情感"
      : confirmationType === "SEPARATE_EMOTION" ? "是否暂时分离这份声明情感？"
      : confirmationType === "CANCEL_RITUAL" ? "是否放弃本次晋升并实际退出？" : selectedBottle?.title ?? "原瓶已不再可用"}</h3>
    {selectedBottle && <><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status} · 服用成功率 {selectedBottle.chance}%</p></>}
    <section className="slice-notice" aria-label="确认前的无暗者当前现场"><RitualFacts ritual={value.ritual} /></section>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmationType === "DECLARE_EMOTION" ? <section aria-label="玩家自己的情感选择">
      <p>本次可声明：对原导师米瑞尔在长期指导与实际共同经历中形成的珍重与感激，是本角色此刻最强烈、最不愿舍弃的情感。</p>
      <p>这必须符合你对当前角色的理解。系统不会从旧经历自动判定你最爱谁，也不会替你改变情感；不符合时请暂不声明，可以取消本次安排，继续作为光之祭司生活。</p>
      <p>旧指导与已完成经历只是这份声明可追溯的依据。确认声明不会分离情感或服药，之后仍由你分别决定。</p>
    </section> : confirmationType === "SEPARATE_EMOTION" ? <section aria-label="同一声明情感的暂时离身">
      <p>{playerText("由当前自愿在场的持照专业者，以本作G虚构规程把已声明的这一份情感放入本次同一原封存载体。你暂时感受不到这份珍重与感激，关于原导师和旧经历的记忆事实仍保留。")}</p>
      <p>这不是清除全部人性，也不是玩家获得操纵他人心灵的能力。此次确认不服药；随后仍有独立的原瓶确认。</p>
      <p>分离后不能靠关闭页面恢复。须由当前原专业者和原导师自愿在场，用仍完好的同一原载体实际回输；载体缺失、损坏或人员不愿参与时，保留待处理状态。</p>
    </section> : confirmationType === "CANCEL_RITUAL" ? <section aria-label="放弃本次晋升的实际后果">
      <p>尚未分离时实际退出；已经分离时，先从本次同一原载体回输这份情感再退出。缺失载体或当前人员条件不满足时，不能假称已经归还。</p>
      <p>服药后选择这里会放弃本次晋升，即使原始药效成功也仍为光之祭司5。已付费用、已耗原瓶与原包、真实损失全部保留，不退款或重抽；下次须另约实际新安排。</p>
    </section> : <>
      <section className="slice-notice seer-risk" aria-label="无暗者服用风险与四档结果"><h4>原始药效与完成晋升分开结算</h4><p>{value.risk}</p></section>
      <p>确认只会耗用这一原瓶和本次原包，并保存原始药效。服药成功后仍是光之祭司5；必须在本次过程中从同一原载体回输同一份情感，才完成无暗者4晋升。</p>
      <p>原始药效失败也须实际回输后退出。你仍可放弃本次晋升并回输退出，全部原成本和真实损失保留；回输不会治疗、补灵性或退回原瓶。</p>
      <section aria-label="服药前当前资源"><h4>你现在的状态</h4><dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div><div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl></section>
    </>}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="unshadowed-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmationType === "CONSUME" ? "暂不服用，返回现场" : "暂不继续，返回现场"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirmAction}
        aria-describedby={liveConfirmation?.reason ? "unshadowed-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmLabel}</button>
    </div><p className="slice-muted">返回现场只关闭本次确认，不会代替分离、服药、回输或实际退出。提交后等待同一操作保存。</p>{saveNotice}
  </section>;

  const ritualContent = <><RitualFacts ritual={value.ritual} />
    <div className="warrior-action-list" role="group" aria-label="无暗者仪式、回输与实际退出">{ritualActions.map(actionButton)}</div>
    {value.ritual.playerLocation === "HALL" && <p className="slice-notice">本人仍在原仪式厅。关闭确认、切换卷宗或保存重试都不会替你回输情感或实际走出。若不再晋升，请使用明确的取消并回输退出操作。</p>}
    <details className="seer-fold"><summary>本次情感仪式的范围与来源</summary><p>{value.ritual.boundary}</p><p>{value.ritual.source}</p></details>
    {value.ritual.visits.some((visit) => visit.id !== value.ritual.currentVisitId) && <details className="seer-fold"><summary>无暗者原载体、情感与服药历史</summary>
      {value.ritual.visits.filter((visit) => visit.id !== value.ritual.currentVisitId).map((visit) => <article key={visit.id} aria-label={`${visit.id}原到访历史`}><VisitFacts visit={visit} /></article>)}
    </details>}</>;
  return <div className="seer-panel warrior-panel unshadowed-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="无暗者成长下一步">
      <span className="seer-seal">{value.promoted ? "无暗者4" : "光之祭司5 → 无暗者4"}</span><h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>{nextClose ? "先处理当前收束：" : "下一步："}</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : value.acting >= 100 ? "这一阶段已消化，可以继续生活或回看实际记录。" : "请先查看当前公开条件与现场记录。"}</p>
      <p>{value.digestion}</p>{readOnly && <p className="slice-notice">当前为只读记录，不分离情感、服药或重复结算成长。</p>}
    </section>
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="无暗者成长行动">{growthActions.map(actionButton)}</div>}
    {value.formulaKnown && <section className="slice-notice" aria-label="无暗者配方与已知替代">
      <h3>本渠道可实际取得的六项原料</h3><p>{value.supplies}</p>
      <ul className="seer-formula">{value.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong>{material.note && <p>{material.note}</p>}</li>)}</ul>
      <p>已知另一主材方案为太阳神血液1滴，本处没有神血库存或购买入口。此处实际整批领取的是尾羽、光辉石和四项辅材；一次调配消耗同批六项原数量，只产生该批的一瓶原魔药。</p>
      <p className="slice-muted">{playerText("材料与剂量来自已核原著清单，价格、劳务、具体投料顺序与技术规程是本作G。")}</p>
    </section>}
    {value.batches.length > 0 && <details className="seer-fold" open={!value.promoted}><summary>无暗者实际六料原批次</summary>
      <section aria-label="无暗者原批次与材料去向">{value.batches.map((batch) => <article className="seer-bottle" key={batch.id}>
        <div><h4>{batch.title}</h4><p>原批次：{batch.id} · {batch.status} · 实际劳务 {batch.labourSteps} / 5</p>
          <ul>{batch.materials.map((material) => <li key={material.id}>{material.name} · {material.quantity}{material.unit} · {LOCATION[material.holder] ?? material.holder}
            <details><summary>{material.id}的原来源</summary><p>{material.source}</p></details></li>)}</ul>
        </div><div className="warrior-action-list">{batchActions.filter((action) => "batchId" in action.command && action.command.batchId === batch.id).map(actionButton)}</div>
      </article>)}</section>
    </details>}
    {(value.discovered || currentVisit) && (value.promoted && value.ritual.playerLocation === "OUTSIDE"
      ? <details className="seer-fold"><summary>无暗者晋升与同一情感记录</summary><section aria-label="无暗者当前仪式">{ritualContent}</section></details>
      : <section aria-label="无暗者当前仪式">{ritualContent}</section>)}
    {value.bottles.length > 0 && <details className="seer-fold" open={!value.promoted}><summary>无暗者原瓶 · 来源与去向</summary>
      <section aria-label="无暗者原瓶与独立来源">{value.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
        <div><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        <div className="warrior-action-list">{bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === bottle.id).map(actionButton)}</div>
      </article>)}</section>
    </details>}
    {value.promoted && selectedCase && <section aria-label="无暗者有限生活实践"><h3>无暗领域、有限净化与太阳耀斑</h3><p>{value.life.environment}</p>
      <label className="seer-case-selector">选择当前生活实践<select value={selectedCase.id} disabled={locked || value.life.inside || !!activeCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="seer-current-case warrior-case" aria-label="当前无暗者生活实践"><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen ? "现场接触尚未实际结束" : "当前没有未结束的接触"} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {selectedCase.observations.length > 0 && <ul>{selectedCase.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
        <section className="slice-notice" aria-label="当前同伴、普通出口与有限效果" aria-live="polite"><h5>真实位置与普通通行</h5>
          <p>本人实际位置：{LOCATION[value.life.playerLocation] ?? value.life.playerLocation}</p>
          <p>{value.life.ally.name} · {value.life.ally.age}岁 · {value.life.ally.id}：{value.life.ally.alive ? "仍活着" : "已经死亡"}，{value.life.ally.willing ? "当前愿意参与" : "当前不愿参与"}。</p>
          <p>同伴实际位置：{LOCATION[value.life.ally.location] ?? value.life.ally.location} · 实际离场 {value.life.ally.moves} 次 · 实际返回 {value.life.ally.returns} 次</p>
          <p>无暗领域没有实体墙，可沿原普通门真实走出与走回。太阳耀斑可能伤及范围内同伴，友善身份不会自动免疫；必须先实际离场。</p>
          <div className="warrior-action-list" role="group" aria-label="同伴、普通通行与原靶冷却">{objectActions.map(actionButton)}</div>
        </section>
        <section aria-label="无暗者当前原物与实际变化"><h5>同一原物与保留后果</h5>{value.life.objects.map((fact, index) => <p key={index}>{fact}</p>)}</section>
        {selectedCase.result && <section aria-label="无暗者实际实践结果" aria-live="polite"><h5>实际尝试与有限报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前无暗者生活行动">{selectedCaseActions.map(actionButton)}</div>
        <p className="slice-muted">先实际停止效果，再完成当前人的往返与原靶冷却，最后退出并报告。停止不抹掉原灼痕；普通封存不等于净化，原特性始终由档案方持有。失败保留成本，下一真实周才能重试。</p>
      </section>
    </section>}
    {value.promoted && <details className="seer-fold" open={value.encounter.inside}><summary>可选原庭院冲突与真实后果</summary><section aria-label="无暗者可选原庭院冲突">
      <h3>{value.encounter.title}</h3><p>{value.encounter.story}</p><p>当前冲突：{value.encounter.status}</p>
      <p>同一原对手：{value.encounter.enemy.name} · {value.encounter.enemy.age}岁 · {value.encounter.enemy.id} · 健康 {value.encounter.enemy.health} · 精神 {value.encounter.enemy.mind}</p>
      <p>原本人：{value.encounter.enemy.status === "DEAD" ? "已经真正死亡" : value.encounter.enemy.status === "SURRENDERED" ? "仍活着，已自行停止抵抗" : value.encounter.enemy.status} · 原棍 {value.encounter.enemy.weaponId} · {LOCATION[value.encounter.enemy.weaponLocation] ?? value.encounter.enemy.weaponLocation}</p>
      <p>原地面实际太阳耀斑灼痕：{value.encounter.groundScorchMarks}</p><p className="slice-muted">{value.encounter.enemy.source}</p>
      <p>交谈后可0行动沿普通出口和平离开，对方不追击。本场其余人员实际在已知范围外，不能据此认为太阳耀斑普遍对友方无害；原普通对手没有自动邪异易伤，也不保证能够战胜。</p>
      <div className="warrior-action-list" role="group" aria-label="原庭院交谈、战斗与退出">{encounterActions.map(actionButton)}</div>
    </section></details>}
    {value.promoted && <section aria-label="无暗者能力与消化"><h3>能力与消化</h3><p>扮演进度 {value.acting} · {value.digestion}</p>
      <progress className="cryptologist-progress" aria-label="无暗者扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
    </section>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p>
      <p>普通失控者遗留特性的有限精神污染可以尝试净化；神性或极端污染不保证清除，析出自身特性可能导致降序列，不能当作免费精准清洗。无暗十字的固定流血和每小时析出特性属于封印物代价，并非无暗者本体的固有代价。</p>
      <p>{playerText("本作人物、场地、价格、范围、载体、具体情感操作、冷却时间与检定数值均为原创G。本面板保留原无暗者经历；正义导师3另有明确G的有限合作入口，原文新增能力仍待核。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}

type Visit = UnshadowedProjection["ritual"]["visits"][number];
function VisitFacts({ visit }: { visit: Visit }) {
  const anchor = visit.anchor;
  return <>
    <p>原到访：{visit.id} · {visit.status} · 原场地：{visit.siteId}</p>
    <p>实付 {visit.paidPennies}便士 · 第{visit.bookedWeek}周预约 · 最早第{visit.plannedWeek}周赴场{visit.closedWeek !== null ? ` · 第${visit.closedWeek}周已实际结束` : ""}</p>
    <section aria-label={`${visit.id}同一原载体与原包`}><h5>本次原物，不可替换或凭空补齐</h5>
      <p>同一原封存载体：{visit.vessel.id} · {visit.vessel.status === "FULL" ? "同一声明情感仍在原载体内" : visit.vessel.status === "DESTROYED" ? "原载体已经毁坏" : "原载体当前为空"} · {visit.vessel.intact ? "原载体仍完好" : "原载体已不完好"}</p>
      <p>载体实际位置：{visit.vessel.location === "MISSING" ? "原载体当前缺失" : LOCATION[visit.vessel.location] ?? visit.vessel.location} · 所有者：{visit.vessel.ownerId}，不属于玩家赠品</p>
      <p>载体内原情感：{visit.vessel.anchorId ?? "当前没有"}{visit.vessel.returnedWeek !== null ? ` · 第${visit.vessel.returnedWeek}周已实际回输` : ""}</p>
      <p>本次原包：{visit.kit.id} · {visit.kit.status === "SEALED" ? "封装完整，尚未使用" : visit.kit.status === "IN_USE" ? "已在本次分离中启用" : visit.kit.status === "CONSUMED" ? "已经耗用，不能复用" : "原包已损坏"} · {visit.kit.location === "MISSING" ? "原包当前缺失" : LOCATION[visit.kit.location] ?? visit.kit.location}</p>
    </section>
    <section aria-label={`${visit.id}声明情感的真实状态`} aria-live="polite"><h5>同一份情感与原记忆</h5>
      {anchor ? <><p>本次原情感：{anchor.id} · 指向同一原人物：{anchor.subjectId} · 第{anchor.declaredWeek}周由玩家声明</p>
        <p>{anchor.reason}</p>
        <p>实际去向：{anchor.location === "SELF" ? "仍在本人，尚未离身" : anchor.location === "VESSEL" ? "仍离身，暂存在本次同一原载体中" : "已从同一原载体实际回到本人"}</p>
        <p>本人此刻{anchor.felt ? "能感受到这份声明情感" : "暂时感受不到这份声明情感"}；{anchor.memoriesRetained ? "关于原导师与旧经历的记忆事实仍保留" : "请核对原记忆记录"}。</p>
        {anchor.returnedFromVesselId && <p>实际回输来源：{anchor.returnedFromVesselId} · 第{anchor.returnedWeek}周；没有制造新的情感副本。</p>}
        <details className="seer-fold"><summary>这份声明的原指导与实际经历依据</summary><ul>{anchor.basis.map((basis) => <li key={basis.id}>{basis.id} · {basis.description}{basis.week !== null ? ` · 第${basis.week}周` : ""}</li>)}</ul></details>
      </> : <p>尚未由玩家声明。当前没有被分离的情感；旧经历不会自动决定本角色此刻最强烈的情感。</p>}
    </section>
    <section aria-label={`${visit.id}原始药效与晋升状态`} aria-live="polite"><h5>原瓶、原始药效与实际回输</h5>
      <p>本次原瓶：{visit.pendingBottleId ?? "尚未服用"} · 原始药效：{visit.rawOutcome ? OUTCOME[visit.rawOutcome] ?? visit.rawOutcome : "尚无"}</p>
      {visit.finishedSuccess ? <p>同一原情感已经实际回输，无暗者4晋升已完成；仍须按当前位置实际离场。</p>
        : visit.abortedReason ? <p>本人已明确放弃本次晋升并实际退出，保留光之祭司5身份。原费用、耗用与真实损失全部保留，原始药效成功也不再完成晋升。</p>
        : visit.rawOutcome && visit.phase === "DRUNK" ? <p>原始药效已保存，目前仍为光之祭司5。原情感仍离身，必须实际回输；成功并不等于已经完成晋升，失败也不能跳过回输。</p>
        : visit.rawOutcome ? <p>原情感已实际回输，原始药效未完成晋升，仍为光之祭司5；原失败、成本和损失保留。</p>
        : <p>本次尚未饮药，可以继续作为光之祭司生活；如情感已离身，取消仍须从同一原载体实际回输。</p>}
      <p>{visit.summary}</p>
    </section>
    <details className="seer-fold"><summary>{visit.id}的原来源</summary><p>{visit.source}</p><p>{visit.vessel.source}</p><p>{visit.kit.source}</p></details>
  </>;
}
function RitualFacts({ ritual }: { ritual: UnshadowedProjection["ritual"] }) {
  const current = ritual.visits.find((visit) => visit.id === ritual.currentVisitId);
  return <>
    <h4>{ritual.title}</h4><p>{ritual.status}</p><p>{ritual.appointment}</p>
    <p>本人实际位置：{LOCATION[ritual.playerLocation] ?? ritual.playerLocation}</p>
    <p>当前服药窗口：{ritual.windowOpen ? "声明情感已实际离身，可在本场独立确认原瓶" : "当前没有合格的服药窗口"}</p>
    <section aria-label="当前原导师与持照专业者">
      {[ritual.guide, ritual.expert].map((person, index) => person && <div key={person.id}>
        <p>{index === 0 ? "长期同一原导师" : "本次独立专业者"}：{person.name} · {person.age}岁 · {person.id}{person.sequence === null ? "" : ` · 序列${person.sequence}`}</p>
        <p>当前{person.alive ? "仍活着" : "已经死亡"}，{person.willing ? "自愿参与本次安排" : "不愿参与本次安排"}；实际位置：{LOCATION[person.location] ?? person.location}。</p>
        <details><summary>{person.id}的身份来源</summary><p>{person.source}</p></details>
      </div>)}
    </section>
    {current ? <VisitFacts visit={current} /> : <p className="slice-muted">当前没有未结束的到访；原载体、声明、实际回输、耗用与费用仍保存在历史中。</p>}
    {!current?.anchor && <details className="seer-fold"><summary>声明前可核对的原指导与旧经历</summary>
      <p>{ritual.declaration}</p><p>这些是实际发生的记忆依据，不替玩家决定哪份情感最强。</p>
      <ul>{ritual.basis.map((basis) => <li key={basis.id}>{basis.id} · {basis.description}{basis.week !== null ? ` · 第${basis.week}周` : ""}</li>)}</ul>
    </details>}
    <p>{ritual.consequence}</p>
  </>;
}
