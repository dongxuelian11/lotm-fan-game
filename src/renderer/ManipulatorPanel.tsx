import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ManipulatorAction, ManipulatorCommand, ManipulatorProjection } from "../domain/manipulator/types";
import type { DreamwalkerProjection } from "../domain/dreamwalker/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对原现场", OBSERVED: "已观察并核对边界", PREPARED: "已准备，尚未执行",
  ACTIVE: "当前实践仍需实际收束", EXAMINED: "已有实际结果，等待复核与报告", RESOLVED: "已提交有限报告",
};
const ENCOUNTER_STATUS: Record<string, string> = { AVAILABLE: "尚未实际交谈", READY: "已实际交谈，尚未开战", FIGHTING: "实际战斗中", RESOLVED: "原冲突已结束", RETREATED: "已沿原出口撤离", LOST: "原冲突已造成真实失败" };
const RITUAL_TYPES = ["BOOK_GATHERING", "OPEN_GATHERING", "ARRIVE_GROUP", "RESONATE", "LEAVE_GATHERING"];
const PRACTICE_TYPES = ["CONSENT", "STOP", "CREATE_PERSONA", "PERSONA_TASK", "WITHDRAW_PERSONA", "RETURN_PAPER"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER", "AID_ENEMY"];
const EXIT_TYPES = ["STOP", "WITHDRAW_PERSONA", "RETURN_PAPER", "CLOSE", "WITHDRAW", "LEAVE_GATHERING", "LEAVE_ENCOUNTER"];

/** Earlier original objects, refusals and outcomes stay read-only after promotion. */
export function ManipulatorDreamwalkerHistory({ dreamwalker }: { dreamwalker: DreamwalkerProjection }) {
  return <section className="seer-panel warrior-panel psychologist-panel" aria-label="梦境行者时期的经历">
    <h3>梦境行者时期的经历</h3>
    <p className="slice-notice">原梦境、身体去回、醒后复核、失败、同一契约与原尾羽继续保留，只供回看；晋升不会重开旧窗口或重复旧成长。</p>
    <p>梦境行者扮演进度 {dreamwalker.acting} · 消化：{dreamwalker.digestion}</p>
    <details className="seer-fold"><summary>梦境行者原故事与供给</summary>
      {dreamwalker.story && <p>{dreamwalker.story}</p>}<p>{dreamwalker.environment}</p><p>{dreamwalker.supplies}</p>
    </details>
    <details className="seer-fold"><summary>原鸟妖契约、原尾羽与实际会面</summary>
      <p>{dreamwalker.ritual.status}</p><p>{dreamwalker.ritual.participant}</p><p>{dreamwalker.ritual.contract}</p>
      <p>{dreamwalker.ritual.feather}</p><p>{dreamwalker.ritual.emotion}</p><p>{dreamwalker.ritual.appointment}</p>
      {dreamwalker.ritual.visits.map((visit) => <p key={visit.id}>第{visit.id}次原会面：{visit.summary}</p>)}
    </details>
    {dreamwalker.practice && <p>原身体节点：{dreamwalker.practice.location === "SOURCE_ROOM" ? "原出发静室" : "原目标静室"} · 实际梦间去程 {dreamwalker.practice.outboundTrips} 次 · 实际普通返程 {dreamwalker.practice.returns} 次 · 醒后核验 {dreamwalker.practice.wakingChecks} 次</p>}
    {dreamwalker.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p className="slice-muted">原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={`${entry.id}-${index}`}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}
      <p>{entry.contactOpen} · 实际结束 {entry.closes} 次 · 实际练习 {entry.sessions} 次 · {entry.verified ? "已醒后复核" : "尚无醒后复核记录"}</p>
      {entry.sessionWeeks.length > 0 && <p>实际练习周：{entry.sessionWeeks.map((week) => `第${week}周`).join("、")}</p>}
      {entry.result && <p>当时的结果与报告：{entry.result}</p>}
    </details>)}
    {dreamwalker.bottles.length > 0 && <details className="seer-fold"><summary>梦境行者原瓶 · 来源与去向</summary>
      {dreamwalker.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {dreamwalker.abilities.length > 0 && <details className="seer-fold"><summary>梦境行者时期能力记录</summary>
      {dreamwalker.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface ManipulatorPanelProps {
  manipulator: ManipulatorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: ManipulatorCommand) => void;
}

function RitualFacts({ ritual }: { ritual: ManipulatorProjection["ritual"] }) {
  return <>
    <h4>{ritual.title}</h4>
    <dl className="seer-facts">
      <div><dt>本次聚会</dt><dd>{ritual.currentEventId ?? "尚无当前聚会"}</dd></div>
      <div><dt>实际状态</dt><dd>{ritual.status}</dd></div>
      <div><dt>原会场</dt><dd>{ritual.venue}</dd></div>
      <div><dt>预约与时间</dt><dd>{ritual.appointment}</dd></div>
      <div><dt>当前实际在场</dt><dd>{ritual.actualPresent} / 至少 {ritual.requiredCount} 人</dd></div>
      <div><dt>登记人数</dt><dd>{ritual.registeredCount} 人，登记不等于到场</dd></div>
      <div><dt>共同情绪</dt><dd>{ritual.emotion}</dd></div>
      <div><dt>本周服药窗口</dt><dd>{ritual.windowOpen ? "当前同场共鸣窗口已实际成立" : "当前没有合格共鸣窗口"}</dd></div>
    </dl>
  </>;
}

/** UI only displays committed public facts and forwards the exact typed action. */
export function ManipulatorPanel({ manipulator: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: ManipulatorPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ManipulatorAction | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const locked = busy || blocked || error !== null || readOnly;
  const confirmationLocked = locked || submittedId !== null;
  const liveConfirmation = confirmation && value.actions.find((action) => action.id === confirmation.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.command));
  const selectedBottleId = confirmation?.command.type === "CONSUME" ? confirmation.command.bottleId : null;
  const selectedBottle = value.bottles.find((bottle) => bottle.id === selectedBottleId);
  const caseActions = value.actions.filter((action) => "caseId" in action.command);
  const selectedCase = (value.life.insideCase ? value.life.cases.find((entry) => entry.id === value.life.practice.activeCase) : undefined)
    ?? value.life.cases.find((entry) => entry.id === caseId)
    ?? value.life.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? value.life.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const practiceActions = value.actions.filter((action) => !("caseId" in action.command) && PRACTICE_TYPES.includes(action.command.type));
  const ritualActions = value.actions.filter((action) => RITUAL_TYPES.includes(action.command.type));
  const encounterActions = value.actions.filter((action) => ENCOUNTER_TYPES.includes(action.command.type));
  const batchActions = value.actions.filter((action) => "batchId" in action.command);
  const selectedBatch = value.batches.find((entry) => entry.id === batchId)
    ?? value.batches.find((entry) => batchActions.some((action) => action.enabled && "batchId" in action.command && action.command.batchId === entry.id))
    ?? value.batches[0];
  const selectedBatchActions = selectedBatch ? batchActions.filter((action) => "batchId" in action.command && action.command.batchId === selectedBatch.id) : [];
  const growthActions = value.actions.filter((action) => action.command.type !== "CONSUME" && !("caseId" in action.command) && !("batchId" in action.command)
    && !RITUAL_TYPES.includes(action.command.type) && !PRACTICE_TYPES.includes(action.command.type) && !ENCOUNTER_TYPES.includes(action.command.type));
  const nextExit = EXIT_TYPES.map((type) => value.actions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = nextExit ?? value.actions.find((action) => action.enabled) ?? value.actions[0];
  const practice = value.life.practice;

  useEffect(() => {
    if (selectedCase && (value.life.insideCase || caseId === null)) setCaseId(selectedCase.id);
  }, [selectedCase, value.life.insideCase, caseId]);
  useEffect(() => {
    if (confirmation && (readOnly || (!busy && error === null && (!liveConfirmation || !selectedBottle || value.promoted)))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, liveConfirmation, selectedBottle, busy, error, readOnly, value.promoted]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function openBottle(action: ManipulatorAction) {
    if (locked || !action.enabled || action.command.type !== "CONSUME" || value.promoted) return;
    const bottleId = action.command.bottleId;
    if (!value.bottles.some((bottle) => bottle.id === bottleId)) return;
    returnActionId.current = action.id; submitted.current = null; setSubmittedId(null); setConfirmation(action);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !selectedBottle || !liveConfirmation?.enabled) return;
    submitted.current = confirmation.id; setSubmittedId(confirmation.id); onCommand(confirmation.command);
  }
  function actionButton(action: ManipulatorAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `manipulator-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (action.command.type === "CONSUME") openBottle(action);
          else { if ("caseId" in action.command) setCaseId(action.command.caseId); onCommand(action.command); }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`manipulator-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重新服药。"}
  </p>;

  if (confirmation && selectedBottle) return <section className="seer-panel warrior-panel psychologist-panel seer-confirmation"
    aria-label="这瓶操纵师魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">同一原瓶、本次实际到场与共同情绪</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p>来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一原瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次成本</dt><dd>{liveConfirmation ? liveConfirmation.cost : confirmation.cost}</dd></div>
    </dl>
    <section className="slice-notice" aria-label="服药前当前真实聚会"><RitualFacts ritual={value.ritual} /></section>
    <p>只有本周、当前聚会、本人仍在原会场且至少10000人实际同场共鸣时才能服用。登记人数、过去最大到场数和已结束聚会都不能替代。</p>
    <section className="slice-notice seer-risk" aria-label="操纵师服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
    <section className="seer-current-resources" aria-label="服药前当前资源"><h4>当前角色资源</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{value.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {liveConfirmation?.reason && <p className="seer-action-reason" id="manipulator-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>暂不服用，返回当前聚会</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirmBottle}
        aria-describedby={liveConfirmation?.reason ? "manipulator-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted">确认才消耗这一原瓶并结束本次聚会。失败同样消耗，须使用另一原瓶、重新预约并等待新的真实聚会；暂不服用不消耗。保存失败保留同一已确认意图，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel psychologist-panel manipulator-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="操纵师成长下一步">
      <span className="seer-seal">{value.promoted ? "操纵师4" : "梦境行者5 → 操纵师4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : value.acting >= 100 ? "这一阶段已消化，可以继续生活或回看实际记录。" : "请查看原材料、本人同意与当前公开条件。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">{playerText("听取指导后核对完整配方与本阶段开放分支。三种原材料和七名不同成年人的新泪滴分别实际取得，调配成原瓶后再预约万人聚会。")}</p>
      {readOnly && <p className="slice-notice">当前为只读记录，不能重复取得材料、服药或结算成长。</p>}
    </section>
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="操纵师成长行动">{growthActions.map(actionButton)}</div>}
    {value.formulaKnown && <section className="slice-notice" aria-label={playerText("操纵师完整配方与开放分支")}>
      <h3>{playerText("完整配方与本阶段原材料")}</h3><p>{value.formulaAlternatives}</p>
      <ul>{value.formula.map((material, index) => <li key={`${material.name}-${index}`}>{material.name} · {material.quantity} {material.unit}</li>)}</ul>
      <p className="slice-muted">这些是虚构世界的物品数量。完整心脏不另编重量；没有纯水，也不编造未核实的调配先后。实际材料、泪滴、原瓶分别保存。</p>
    </section>}
    {value.discovered && <section className="slice-notice" aria-label="操纵师实际供给"><h4>三种原材料与独立批次</h4><p>{value.supplies}</p></section>}
    {value.formulaKnown && selectedBatch && <section aria-label="操纵师材料批次与七名原捐献者">
      <h3>取得原材料，再逐人取得新泪滴</h3>
      <label className="seer-case-selector">选择当前材料批次<select value={selectedBatch.id} disabled={locked}
        onChange={(event) => setBatchId(event.target.value)}>{value.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.title} · {batch.status}</option>)}</select></label>
      <article className="seer-current-case" aria-label="当前原材料批次">
        <h4>{selectedBatch.title}</h4><p>原批次：{selectedBatch.id}</p><p>来源：{selectedBatch.source}</p><p>{selectedBatch.status}</p>
        <p>实际劳务 {selectedBatch.labourSteps} / 5 次 · 当前付款 {selectedBatch.price} 便士</p>
        <ul>{selectedBatch.materials.map((material) => <li key={material.id}>{material.name} · {material.quantity} {material.unit} · {material.status}<p className="slice-muted">原物：{material.id}</p></li>)}</ul>
        <p>本批实际泪滴 {selectedBatch.tears.length} / 7 滴，必须来自七名不同原人物；新批次须重新会面取得新滴，不能复用旧原瓶。</p>
        {selectedBatch.tears.length > 0 && <details className="seer-fold"><summary>本批原泪滴与实际来源</summary>
          <ul>{selectedBatch.tears.map((tear) => <li key={tear.id}>{tear.id} · {tear.donorId} · {tear.status}<p>{tear.source}</p></li>)}</ul>
        </details>}
        {selectedBatch.bottleId && <p>本批实际生成的原瓶：{selectedBatch.bottleId}</p>}
        <div className="warrior-action-list" role="group" aria-label="当前材料批次行动">{selectedBatchActions.filter((action) => action.command.type !== "COLLECT_TEAR").map(actionButton)}</div>
      </article>
      <p className="slice-muted">购买只取得心脏、80毫升龙血和3片金叶，不包含泪水。每个人保留独立意愿、原房间与强烈情绪来源；不使用暗示强迫流泪。</p>
      {value.donors.map((donor) => <details className="seer-fold" key={donor.id} aria-label={`${donor.name}的原故事与当前同意`}>
        <summary>{donor.name} · {donor.emotion} · {donor.collectedBatchIds.includes(selectedBatch.id) ? "本批已实际取得" : "本批尚未取得"}</summary>
        <p>{donor.age}岁 · {donor.id} · {donor.location}</p><p>{donor.story}</p>
        <p>{donor.consent} · {donor.willing ? "当前自愿" : "当前未同意，不能取得"}</p>
        <div className="warrior-action-list">{selectedBatchActions.filter((action) => action.command.type === "COLLECT_TEAR" && action.command.donorId === donor.id).map(actionButton)}</div>
      </details>)}
    </section>}
    {value.discovered && <section aria-label="操纵师当前实际聚会">
      <RitualFacts ritual={value.ritual} />
      <p className="slice-muted">四区各自登记，不重复计算原成员。只有实际到原礼堂并仍在场的人计入10000人门槛；自愿纪念与互助引发共同情绪，不用心灵操纵。每场只尝试一次共鸣。</p>
      <div className="warrior-action-list" role="group" aria-label="预约、赴会与零行动散场">{ritualActions.filter((action) => action.command.type !== "ARRIVE_GROUP" && action.command.type !== "RESONATE").map(actionButton)}</div>
      {value.ritual.groups.map((group) => <article className="seer-current-case" key={group.id} aria-label={`${group.title}实际到场记录`}>
        <h4>{group.title}</h4><p>{group.id} · 原来源：{group.source}</p>
        <p>登记 {group.registeredCount} 人 · 当前实际在场 {group.presentCount} 人 · 本次实际到过 {group.arrivedCount} 人</p>
        <p>{group.location} · {group.emotion}</p><p>{group.arrival}</p>
        <div className="warrior-action-list">{ritualActions.filter((action) => action.command.type === "ARRIVE_GROUP" && action.command.groupId === group.id).map(actionButton)}</div>
      </article>)}
      <div className="warrior-action-list" role="group" aria-label="当前聚会共同情绪行动">{ritualActions.filter((action) => action.command.type === "RESONATE").map(actionButton)}</div>
      <p className="slice-muted">预约后仍可正常生活，须下一真实周再赴会。实际入场期间可随时0行动散场；费用不退、原瓶不自动耗用，已经散场的人不能计入之后的新窗口。</p>
      {value.ritual.history.length > 0 && <details className="seer-fold"><summary>原聚会、实际人数与散场历史</summary>
        {value.ritual.history.map((entry) => <p key={entry.id}>{entry.id}：{entry.summary}</p>)}
      </details>}
    </section>}
    {value.bottles.length > 0 && <details className="seer-fold" open={!value.promoted}><summary>操纵师原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
        <div><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        {!value.promoted && value.actions.filter((action) => action.command.type === "CONSUME" && action.command.bottleId === bottle.id).map(actionButton)}
      </article>)}
    </details>}
    {value.promoted && <section className="slice-notice" aria-label="操纵师当前心灵接触与原物">
      <h3>当前精神接触与原物</h3><p>{value.life.environment}</p>
      <dl className="seer-facts">
        <div><dt>当前心灵接触</dt><dd>{practice.contact === "MIRA_MIND" ? "仍在原米拉的心灵接触中，须明确停止" : "当前没有心灵接触"}</dd></div>
        <div><dt>当前本人同意</dt><dd>{practice.consent ? "米拉仅同意本次当前问题" : "当前没有有效的米拉接触同意"}</dd></div>
        <div><dt>实际虚拟人格</dt><dd>{practice.persona ? `${practice.persona.id} · 当前仍未重归本人 · ${practice.persona.taskDone ? "本次观察成功" : practice.persona.taskAttempted ? "本次观察失败，不能在同场重试" : "尚未执行本次任务"}` : "当前没有在外的虚拟人格"}</dd></div>
        <div><dt>实际创建记录</dt><dd>{practice.createdPersonas} 位 · 已实际付出本人精神 {practice.totalMindSpent}</dd></div>
        <div><dt>同一比较纸</dt><dd>{practice.paper.id} · {practice.paper.holder === "OWNER" ? "当前由本人持有，须亲手归还" : "当前在原桌"}</dd></div>
        <div><dt>原锁定训练板</dt><dd>{practice.board.id} · 静置锁定，三条蓝线</dd></div>
        <div><dt>原铃</dt><dd>{practice.bell.id} · 三个原缺口</dd></div>
        <div><dt>同一原账簿</dt><dd>{practice.ledger.id} · 原条目指向B架</dd></div>
        <div><dt>同一原包裹</dt><dd>{practice.parcel.id} · 仍在原B架</dd></div>
        <div><dt>普通图解</dt><dd>{practice.diagram.id} · 无生命静物 · 实际感染 {practice.diagram.infections}</dd></div>
      </dl>
      <p className="slice-muted">人格没有独立身体或实体手，不能替本人搬动物品。停止接触与重归人格均为0行动；已付精神、灵性和失败保留，不自动返还或治疗。</p>
      <div className="warrior-action-list" role="group" aria-label="当前精神接触与零行动退出">{practiceActions.map(actionButton)}</div>
      {practice.personaHistory.length > 0 && <details className="seer-fold"><summary>原虚拟人格的创建、任务与重归记录</summary>
        {practice.personaHistory.map((persona) => <p key={persona.id}>{persona.id}：第{persona.createdWeek}周从本人实际创建，第{persona.rejoinedWeek}周已重归；{persona.taskDone ? "实际观察成功" : persona.taskAttempted ? "原观察失败保留" : "未执行任务"}。不继续在外自动工作。</p>)}
      </details>}
    </section>}
    {value.promoted && selectedCase && <section aria-label="操纵师有限生活实践">
      <h3>{value.life.title}</h3>
      <label className="seer-case-selector">选择当前生活实践<select value={selectedCase.id} disabled={locked || value.life.insideCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="seer-current-case warrior-case" aria-label="当前操纵师生活实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen ? "现场仍须实际收束" : "现场已结束或尚未开始"} · {selectedCase.returned ? "已记录实际停止或归还" : "尚无本次停止或归还记录"} · 实际结束 {selectedCase.closes} 次</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={`${selectedCase.id}-${index}`}>{text}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对原人、本人意愿、原物与退出方式。</p>}
        </section>
        <p>{selectedCase.preparation ?? "尚无本次准备。普通方法和能力方法分别保留，选择准备不等于已实施。"}</p>
        {selectedCase.id === "plague-model" && <p className="slice-notice">{playerText("这是原创G普通教学模拟：纸面没有心灵，不施放精神瘟疫，不产生感染，也不增加任何能力掌握。")}</p>}
        {selectedCase.result && <section className="slice-notice" aria-label="操纵师实际生活结果" aria-live="polite"><h4>实际结果</h4><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前操纵师生活行动">{selectedCaseActions.map(actionButton)}</div>
        <p className="slice-muted">心灵线索须实际停止接触后再核对同一原账簿与原包裹。原板练习须明确重归人格、归还原纸，再复核和结束；失败先收束，下一真实周才能重试。</p>
      </section>
    </section>}
    {value.promoted && <section aria-label="操纵师可选原仓库冲突">
      <h3>{value.encounter.title}</h3><p>{value.encounter.story}</p>
      <p>{ENCOUNTER_STATUS[value.encounter.status] ?? value.encounter.status} · {value.encounter.inside ? "本人仍在当前遭遇中" : "当前没有未结束的遭遇现场"}</p>
      <p>同一原对手：{value.encounter.enemy.name} · {value.encounter.enemy.age}岁 · {value.encounter.enemy.id} · 健康 {value.encounter.enemy.health} · 精神 {value.encounter.enemy.mind}</p>
      <p>{value.encounter.enemy.status === "DEAD" ? "原鲁兰已真正死亡" : value.encounter.enemy.status === "SURRENDERED" ? "原鲁兰仍活着，已自行停止抵抗" : "原鲁兰仍有自己的心灵与抵抗"}；原棍 {value.encounter.enemy.weaponId} · {value.encounter.enemy.weaponLocation === "HAND" ? "仍在原鲁兰手中" : "留在原仓库地面"}。</p>
      <p className="slice-notice" aria-label="原鲁兰当前实际精神瘟疫">当前实际精神瘟疫强度 {value.encounter.mentalPlague}。离场、停止接触或重归人格不会清除已经形成的病况。</p>
      <p className="slice-muted">真实交谈后可0行动和平离开。若选择战斗，仍有真实伤势与死亡风险；指导服药保护不适用于战斗。精神瘟疫是虚构超自然能力，不是现实疾病或治疗说明。</p>
      <div className="warrior-action-list" role="group" aria-label="原仓库交谈、退出与自愿援助">{encounterActions.map(actionButton)}</div>
      <p className="slice-muted">生还的原鲁兰可自愿接受专业稳定：每真实周最多实际降低1强度，需另付1行动与40便士；不立刻恢复精神或健康，也不能复活。当前资格以公开行动为准。</p>
      {value.encounter.helpHistory.length > 0 && <details className="seer-fold"><summary>原鲁兰实际接受的专业稳定</summary>
        {value.encounter.helpHistory.map((entry) => <p key={entry.week}>第{entry.week}周实际支付{entry.fee}便士，原病况强度 {entry.before} → {entry.after}；没有即时恢复原精神或健康。</p>)}
      </details>}
    </section>}
    {value.promoted && <section aria-label="操纵师能力与消化"><h3>能力与消化</h3>
      <p>扮演进度 {value.acting} · {value.digestion}</p><progress className="cryptologist-progress" aria-label="操纵师扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">虚拟人格由本人付出代价产生，具有心智体，没有独立肉身；可被精神防御拒绝，也不是精神全免。龙化尚不可玩；序列3织梦人的身份分割与近真幻象尚未开放。</p>
    </section>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>
      {value.story && <p>{value.story}</p>}<p>{value.life.source}</p><p>{value.risk}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
