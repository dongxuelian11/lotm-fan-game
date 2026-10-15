import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DespairAction, DespairCommand, DespairProjection } from "../domain/despair/types";
import type { PainProjection } from "../domain/pain/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对原现场", PREPARED: "已准备，尚未实际尝试",
  ACTIVE: "现场接触仍在继续", WAITING: "已约定下一真实周随访", EXAMINED: "已有本次结果，待收束与报告", RESOLVED: "已提交有限报告",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "ENCOUNTER_AID", "BUY_SUPPLIES", "PREPARE_MIRROR"];
const CLEANUP_TYPES = ["WALK_OUT", "RETURN_ROUTE", "CLOSE"];
const NEXT_CASE_TYPES = ["FOLLOW_UP", "WALK_OUT", "RETURN_ROUTE", "PERFORM", "CLOSE", "REPORT", "PREPARE", "OBSERVE"];

/** Render the original S5 projection without replaying its choices or clearing its consequences. */
export function DespairPainHistory({ pain: value }: { pain: PainProjection }) {
  const disease = value.diseaseState;
  const enemyStatus: Record<string, string> = { NOT_MET: "当时尚未碰面", RESISTING: "仍在抵抗", SURRENDERED: "原奥伦仍活着，已经投降", DEAD: "原奥伦已死亡", LEFT: "原奥伦已离开接触" };
  return <section className="seer-panel witch-panel" aria-label="痛苦魔女时期的经历">
    <h3>痛苦魔女时期的经历</h3>
    <p className="slice-notice">这里保留原拉维妮、普通演练的原人原物、原奥伦实际疾病与结局、原工具及独立原瓶，只供回看。旧经历不重新结算；晋升不会治愈旧伤、复活旧对手或重演身体变化。</p>
    <p>痛苦魔女扮演进度 {value.acting} · 消化：{value.digestion}</p><p>{value.bodyChange}</p>
    {value.practice && <section aria-label="痛苦魔女原人物位置与模拟记录"><h4>原演练中的实际动作</h4>
      <dl className="seer-facts"><div><dt>原本人、志愿者与标记位置</dt><dd>{value.practice.position}</dd></div>
        <div><dt>原虚构情境与实际记录</dt><dd>{value.practice.records}</dd></div>
        <div><dt>原照护便条与交接</dt><dd>{value.practice.care}</dd></div></dl>
      <details className="seer-fold"><summary>原演练实际记录</summary><ul>{value.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>
      <p>这些是普通模拟，志愿者未被施病；演练结果不冒充实际疾病能力掌握。</p>
    </section>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}><summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <section aria-label="痛苦魔女原奥伦疾病与结局"><h4>原奥伦的身体与疾病</h4>
      <p>{enemyStatus[disease.enemyStatus] ?? disease.enemyStatus} · 原健康{disease.enemyHealth} · 原感染强度{disease.enemyDisease} / 3。</p>
      <p>原场：{disease.fieldActive ? "原记录仍在维持" : "原记录已停止或尚未建立"}；实际建立{disease.diseaseApplications}次；协助：{disease.care === "REQUESTED" ? "当时已请求协助，不代表已经治愈" : "当时尚未请求协助"}。</p>
      <p>这是同一原奥伦的已存结果。新瓦伦遭遇不替换他的身份、感染、伤势或死亡。</p>
    </section>
    <details className="seer-fold"><summary>痛苦魔女原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
      <p>{value.supplies}</p><p>{playerText("完整配方与原著晋升仪式保持未知，旧成品不能变成免费新药。")}</p>
    </details>
    <details className="seer-fold" aria-label="痛苦魔女原工具与能力"><summary>原镜、粉末与继承能力</summary><p>{value.inheritedTools}</p>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>
    <details className="seer-fold"><summary>痛苦魔女原故事与现场</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p></details>
  </section>;
}

export interface DespairPanelProps {
  despair: DespairProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DespairCommand) => void;
  readOnly?: boolean;
}
type Confirmation = { action: DespairAction; contextKey: string };

function PracticeFacts({ practice }: { practice: NonNullable<DespairProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="绝望魔女普通演练的原物与实际位置" aria-live="polite" aria-atomic="true">
    <h4>原物与当前现场</h4>
    <dl className="seer-facts"><div><dt>原房间、志愿者与出口标记</dt><dd>{practice.room}</dd></div>
      <div><dt>原纸面情境与真实记录</dt><dd>{practice.scenario}</dd></div>
      <div><dt>原案夹、实际交接与下周随访</dt><dd>{practice.care}</dd></div>
      <div><dt>本人实际位置与普通路线</dt><dd>{practice.route}</dd></div>
      <div><dt>已付成本与收束</dt><dd>{practice.cost}</dd></div></dl>
    {practice.history.length > 0 && <details className="seer-fold"><summary>实际走动、交接与记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

function EncounterFacts({ encounter: value }: { encounter: NonNullable<DespairProjection["encounter"]> }) {
  const status: Record<string, string> = { AVAILABLE: "尚未进入交战", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已沿原出口离开", LOST: "本人已死亡" };
  const body: Record<string, string> = { NOT_MET: "尚未碰面", RESISTING: "仍在抵抗", SURRENDERED: "仍活着，已停止抵抗", DEAD: "原身体死亡", LEFT: "已离开接触，原症状仍有记录" };
  const outcome: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原出口撤退", ENEMY_DEAD: "原瓦伦死亡", ENEMY_SURRENDERED: "原瓦伦自行停止抵抗" };
  return <section aria-label="绝望魔女原敌人与持续症状">
    <p>{value.name} · {value.targetId} · 危险度约序列{value.sequence}</p>
    <dl className="seer-facts"><div><dt>当前遭遇</dt><dd>{status[value.status] ?? value.status}</dd></div>
      <div><dt>原身体健康 / 精神</dt><dd>{value.enemyHealth} / {value.enemyMind} · {body[value.enemyStatus] ?? value.enemyStatus}</dd></div>
      <div><dt>原敌人剩余灵性</dt><dd>{value.enemySpirituality} / 40</dd></div>
      <div><dt>原距离与退出路线</dt><dd>起始相距{value.distanceMetres}米 · {value.originalExit} · 无追逐</dd></div></dl>
    <section className="slice-notice" aria-label="当前瘟疫场与已存感染" aria-live="polite" aria-atomic="true"><h4>新增暴露与既有症状</h4>
      <p>当前瘟疫场：{value.fieldActive ? "仍在维持新增暴露" : "已停止或尚未建立新增暴露"}。原瓦伦现存感染强度 {value.enemyDisease} / 6。</p>
      <p>本场实际建立 {value.diseaseApplications} 次 · 已实际打断法术 {value.interruptionCount} 次。</p>
      {value.status === "FIGHTING" && <p>停止新增暴露：在战斗姿态中选择「防守」或「撤退」，会先撤去场，再处理本轮；已存感染不会因此消失。</p>}
      <p>{value.careChannel}</p>
      <p>停止维持、离开范围或使用纸人替身都不等于已经痊愈。战后活着且仍有症状时，可每个真实周安排一次专业照护：1行动、60便士，现存强度减少2；不复活、不补回原伤势。</p>
      {value.careVisits.length > 0 && <ul aria-label="实际跨周照护记录">{value.careVisits.map((visit, index) => <li key={index}>第{visit.week}周 · 实付{visit.costPence}便士 · 原感染强度{visit.before} → {visit.after}</li>)}</ul>}
    </section>
    <details className="seer-fold"><summary>原敌人能力、有限场域与工具成本</summary><p>{value.story}</p>
      <ul>{value.abilities.map((ability) => <li key={ability.id}>{ability.label} · 每次{ability.cost}灵性 · 已实际使用{value.powerUses[ability.id]}次 · {ability.available ? "当前仍具备此动作的资源" : "当前资源或身体条件不足"}</li>)}</ul>
      <p>本场净空，无旁观者，不代表友军自动免疫。本场{value.fieldRadiusMetres}{playerText("米上限是原创G；不能推广为所有绝望魔女的固定射程。")}</p>
      <p>首次建立场需要4灵性与知识18检定；以后每个真实回合维持需2灵性，成功暴露逐渐加重，最高6。强度达到3才可能妨碍本轮首个符合条件的实际法术，目标仍可抵抗；不会凭空打断不存在的动作，也不跳过共同伤势盘。</p>
      <p>继承镜替与粉末按原库存消耗。布丝与牵引分别付费；没有原工具时普通回退，旧库存与旧对手不刷新。</p>
    </details>
    {value.terminal && <p className="slice-notice">原战斗第{value.terminal.round}回合结束：{outcome[value.terminal.outcome] ?? value.terminal.outcome}。当时原敌人健康{value.terminal.enemyHealth}、精神{value.terminal.enemyMind}、灵性{value.terminal.enemySpirituality}、感染强度{value.terminal.enemyDisease}；原身体结局与持续症状保留，当前症状以实际照护后的记录为准。</p>}
  </section>;
}

/** Only local selection and review state live here. Resource, material and scene changes require committed projections. */
export function DespairPanel({ despair: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: DespairPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const lastSelectedCase = useRef<{ id: string; status: string } | null>(null);
  const locked = busy || blocked || error !== null || readOnly;
  const confirmationLocked = locked || submittedId !== null;
  const caseActions = value.actions.filter((action) => "caseId" in action.command);
  const sceneAction = caseActions.find((action) => action.enabled && CLEANUP_TYPES.includes(action.command.type))
    ?? caseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const activeId = sceneAction && "caseId" in sceneAction.command ? sceneAction.command.caseId : null;
  const activeCase = value.insideCase ? value.cases.find((entry) => entry.id === activeId) : undefined;
  const selectedCase = activeCase ?? value.cases.find((entry) => entry.id === caseId)
    ?? value.cases.find((entry) => ["PREPARED", "ACTIVE", "EXAMINED", "WAITING"].includes(entry.status))
    ?? value.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id)) ?? value.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const bottleActions = value.actions.filter((action) => BOTTLE_TYPES.includes(action.command.type));
  const selectedBottle = value.bottles.find((entry) => entry.id === bottleId)
    ?? value.bottles.find((entry) => bottleActions.some((action) => action.enabled && "bottleId" in action.command && action.command.bottleId === entry.id)) ?? value.bottles[0];
  const selectedBottleActions = selectedBottle ? bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === selectedBottle.id) : [];
  const encounterActions = value.actions.filter((action) => ENCOUNTER_TYPES.includes(action.command.type));
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command) && !ENCOUNTER_TYPES.includes(action.command.type));
  const suitableNext = (action: DespairAction) => action.command.type !== "WITHDRAW"
    && !(action.command.type === "PERFORM" && "plan" in action.command && action.command.plan === "DECLARE_ALL_CURED");
  const sceneNext = NEXT_CASE_TYPES.map((type) => selectedCaseActions.find((action) => action.enabled && action.command.type === type && suitableNext(action))).find(Boolean);
  const awaitingFollowUp = selectedCase?.status === "WAITING" ? selectedCaseActions.find((action) => action.command.type === "FOLLOW_UP") : undefined;
  const nextAction = !value.promoted
    ? selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME") ?? [...growthActions, ...selectedBottleActions].find((action) => action.enabled) ?? value.actions[0]
    : sceneNext ?? awaitingFollowUp ?? [...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions.find(suitableNext) ?? value.actions[0];
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  function confirmationContext(action: DespairAction): string {
    if ("bottleId" in action.command) return JSON.stringify(value.bottles.find((entry) => "bottleId" in action.command && entry.id === action.command.bottleId));
    return JSON.stringify(value.encounter);
  }
  const liveConfirmation = confirmation && confirmation.contextKey === confirmationContext(confirmation.action)
    ? value.actions.find((action) => action.id === confirmation.action.id && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmingConsume = confirmation?.action.command.type === "CONSUME";

  useEffect(() => { if (selectedCase && (activeCase || caseId === null)) setCaseId(selectedCase.id); }, [selectedCase, activeCase, caseId]);
  useEffect(() => {
    const previous = lastSelectedCase.current;
    if (selectedCase && previous?.id === selectedCase.id && previous.status !== "RESOLVED" && selectedCase.status === "RESOLVED") {
      const next = value.cases.find((entry) => entry.status !== "RESOLVED" && caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id));
      if (next) setCaseId(next.id);
    }
    lastSelectedCase.current = selectedCase ? { id: selectedCase.id, status: selectedCase.status } : null;
  }, [selectedCase, value.cases, caseActions]);
  useEffect(() => {
    if (confirmation && (readOnly || (!busy && error === null && (!liveConfirmation || (submittedId !== null && !liveConfirmation.enabled)
      || (reviewBottleId !== null && !reviewBottle))))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, readOnly, busy, error, liveConfirmation, submittedId, reviewBottleId, reviewBottle]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function actionButton(action: DespairAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `despair-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (["CONSUME", "ENCOUNTER_FIGHT"].includes(action.command.type)) {
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, contextKey: confirmationContext(action) });
          } else {
            if ("caseId" in action.command) setCaseId(action.command.caseId);
            if ("bottleId" in action.command) setBottleId(action.command.bottleId);
            onCommand(action.command);
          }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`despair-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled || (reviewBottleId !== null && !reviewBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复服药、购买、照护或移动原物。"}
  </p>;
  const currentResources = <section aria-label={confirmingConsume ? "服药前当前资源" : "行动前当前资源"}><h4>你现在的状态</h4>
    <dl className="seer-facts"><div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div><div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div></dl>
  </section>;

  if (confirmation) return <section className="seer-panel witch-panel despair-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶绝望魔女魔药的服用确认" : "绝望魔女真实迎战确认"} aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : "可选交战与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="绝望魔女服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{playerText("完整配方和原著晋升仪式细节仍未知。诺艾拉核对这瓶、准备原场地并在场照护，是本作原创G专业准备流程，不能据此断言无需仪式。确认仅服用此原瓶，无论成败都会消耗这一瓶。")}</p>
      <p>{value.bodyChange}</p><p>可以暂不服用，继续痛苦魔女生活。仅服药排异的健康与精神最低保留1，不覆盖真实战斗死亡；晋升不补满灵性，不开放危险的不完整神话形态，也未获得不老魔女能力。</p>
    </> : <section className="slice-notice seer-risk" aria-label="绝望魔女真实交战风险"><h4>可能重伤或死亡</h4>
      <p>原创成年对手瓦伦·霍尔特在原独立废院4米外，持原短棍且有40点有限灵性，能够实际施法。现场有普通出口、没有旁观者与追逐；可以普通表明退出并离开。</p>
      <p>瘟疫暴露会逐渐加重，停止场与撤退不清除既有症状；达到强度门槛后也只是可能打断实际法术，不保证目标失去所有行动或直接死亡。</p>
      <p>战斗伤势、撤退和死亡照常结算，服药照护不保护实战。旧奥伦不会复活；已用原镜与粉末不补回。</p>
    </section>}
    {currentResources}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="despair-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "despair-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : "确认风险，开始真实交战"}</button></div>
    <p className="slice-muted">取消不会消耗原瓶或开始战斗。保存未确认时保留这一次操作，等待原保存重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel witch-panel despair-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="绝望魔女成长下一步"><span className="seer-seal">{value.promoted ? "绝望魔女4" : "痛苦魔女5 → 绝望魔女4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">{value.bodyChange}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    {!value.promoted && <section className="slice-notice" aria-label="绝望魔女配方与成品边界"><h4>未知配方与独立成品</h4>
      <p>{playerText("完整配方、材料、用量、调配顺序和原著晋升仪式细节仍未知。使用有来源的原创G专业准备与指导服药流程，不能据此断言无需仪式。")}</p>
      <p>用药指导540便士、1行动；每瓶全价6800便士。五次真实劳务抵5300便士后仍付1500便士；付款和独立服药各0行动。可以继续痛苦魔女生活。</p>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="绝望魔女指导与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <section aria-label="绝望魔女原瓶供给"><h3>独立原瓶与实际供给</h3><p>{value.supplies}</p>
      <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立绝望魔女原瓶" value={selectedBottle.id} disabled={locked}
        onChange={(event) => setBottleId(event.target.value)}>{value.bottles.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
      <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
      <div className="warrior-action-list" role="group" aria-label="当前原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
    </section>}
    {value.promoted && selectedCase && <section aria-label="绝望魔女有限生活实践"><h3>疏散、停止暴露与后续照护</h3>
      <p className="slice-notice">{playerText("三项都是原创G普通模拟演练。成年拉维妮与玛拉·维尔自愿参与；纸面症状是虚构情境，不对志愿者施病，不增加瘟疫能力掌握。")}</p>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前绝望魔女生活实践" value={selectedCase.id} disabled={locked || value.insideCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {value.practice && <PracticeFacts practice={value.practice} />}
        {selectedCase.result && <section className="slice-notice" aria-label="绝望魔女实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        {selectedCase.status === "WAITING" && !value.insideCase && <p className="slice-notice">现场已安全收束，可以正常休养推进到下一真实周，再回来随访；等待本身不会完成记录或治疗任何人。</p>}
        <div className="warrior-action-list" role="group" aria-label="当前绝望魔女生活行动">{selectedCaseActions.map(actionButton)}</div>
        <details className="seer-fold" aria-label="绝望魔女当前已知现场"><summary>已观察的事实与本次方法边界</summary>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}
          <p>{value.environment}</p>
        </details>
      </section>
      <p className="slice-muted">模拟中的实际动作仍须逐项完成：人走到真实标记、原板归架、原纸记录与原案夹交回。错误选择保留已付行动与记录，不伤人；收束和撤出演练不发完成奖励。</p>
    </section>}
    {value.promoted && <section aria-label="绝望魔女可选交战"><h3>废院中的瓦伦·霍尔特</h3>
      <p className="slice-muted">{value.inheritedTools}</p>
      {value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="绝望魔女交谈工具与实际照护">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="绝望魔女能力与消化"><h3>能力与消化</h3>
      <progress className="cryptologist-progress" aria-label="绝望魔女扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">新增瘟疫能力从0掌握开始，普通演练只推进扮演，不假称能力熟练。旧能力、原材料与实际经历保留；下一序列是不老魔女3，本阶段尚未获得不老、镜界逃生或危险神话形态。</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>绝望魔女原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
      <p>{playerText("已耗原瓶不复原，未服原瓶保持原状态；完整配方与原著仪式细节仍未知。")}</p>
    </details>}
    <details className="seer-fold" aria-label={playerText("绝望魔女能力与使用范围")}><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>潘娜蒂亚大雾事件发生于她已是绝望魔女之后，不能用作5→4晋升仪式。成熟个体的城市尺度表现也不是新晋者的统一初始半径。</p>
      <p>{playerText("三案原人物、原板、纸面情境与虚构症状均为G。没有现实病原、传播步骤或医学处方；风雨驱散暴露不等于现存感染全部消失。主动撤去自身疾病也不保证所有伤者瞬时康复。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
