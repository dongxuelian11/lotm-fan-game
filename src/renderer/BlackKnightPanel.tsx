import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { BlackKnightAction, BlackKnightCommand, BlackKnightProjection } from "../domain/black-knight/types";
import type { ShepherdProjection } from "../domain/shepherd/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对原现场", PREPARED: "已准备，尚未实际执行",
  ACTIVE: "原接触仍在继续", EXAMINED: "已有实际结果，待收束与报告", RESOLVED: "已提交有限报告",
};
const SPIRIT_STATUS: Record<string, string> = {
  AVAILABLE: "已会面，尚未放牧", GRAZED: "已实际放牧", RELEASED: "已永久释放，不能重新取得",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const SPIRIT_TYPES = ["MEET_SPIRITS", "GRAZE", "ACTIVATE_SPIRIT", "RELEASE_SPIRIT"];
const RATION_TYPES = ["BUY_RATION", "TAKE_RATION"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT"];
const SHADE_TYPES = ["BUY_SHADE_KIT", "ENTER_SHADE_ROOM", "SPAWN_SHADE", "CAPTURE_SHADE", "RETURN_SHADE_ROUTE", "HANDOFF_SHADE", "SHADOW_EXIT"];
const REVIEW_TYPES = ["CONSUME", "RELEASE_SPIRIT", "SPAWN_SHADE", "ENCOUNTER_FIGHT"];
const CLEANUP_TYPES = ["RETURN_ROUTE", "CLOSE", "WITHDRAW"];
const NEXT_CASE_TYPES = ["RETURN_ROUTE", "PERFORM", "CLOSE", "REPORT", "PREPARE", "OBSERVE"];
const SHADE_URGE = "想为快速获胜忽视原灵界限";

/** History reads the original S5 projection; it never replays an acquisition or restores a released soul. */
export function BlackKnightShepherdHistory({ shepherd: value }: { shepherd: ShepherdProjection }) {
  const grazing = value.grazing;
  const spirits = grazing?.met ? grazing.spirits.filter(spirit => spirit.status !== "UNMET") : [];
  return <section className="seer-panel warrior-panel" aria-label="牧羊人时期的经历">
    <h3>牧羊人时期的经历</h3>
    <p className="slice-notice">这里保留牧羊人时期的原故事、实际放牧与永久释放、原纸与原记录、独立原瓶及继承储备，只供回看。旧实践不重新结算或发奖，晋升不补灵魂、原包或储备；已经释放的原灵不会复活或重新取得。</p>
    <p>牧羊人扮演进度 {value.acting} · 消化：{value.digestion}</p>
    {grazing && <section aria-label="牧羊人原灵魂名册与释放记录"><h4>同一原灵魂名册</h4><p>{grazing.summary}</p>
      <p>当前实际驱使：{spirits.find(spirit => spirit.id === grazing.activeSpiritId && spirit.status === "GRAZED")?.name ?? "无，仅使用自身能力"} · 容量 {grazing.capacity} · 同时只驱使1灵</p>
      {!grazing.met && <p>当时尚未会面，原身份与能力保持未知。</p>}
      {spirits.map(spirit => <article key={spirit.id}><h4>{spirit.name} · {SPIRIT_STATUS[spirit.status] ?? spirit.status}</h4>
        <p>原灵魂ID：{spirit.id}</p><p>来源：{spirit.source}</p>
        <p>原已选能力：{spirit.selectedAbilities.map(id => spirit.knownAbilities.find(ability => ability.id === id)?.label ?? id).join("、") || "尚未选择"}</p>
        <p>原尝试周：{spirit.attemptWeek ?? "尚未尝试"} · 取得周：{spirit.acquiredWeek ?? "尚未取得"} · 释放周：{spirit.releasedWeek ?? "尚未释放"}</p>
        {spirit.status === "RELEASED" && <p>只保留原选择与释放记录，已失去借用权；不能从当前来源重新取得。</p>}
        <details className="seer-fold"><summary>这一原灵当时的已知能力</summary>{spirit.knownAbilities.map(ability => <p key={ability.id}>{ability.label}：{ability.description}</p>)}</details>
      </article>)}
    </section>}
    {value.practice && <section aria-label="牧羊人原物与实际实践记录"><h4>同一原纸、声音与记录</h4>
      <p>{value.practice.paper}</p><p>{value.practice.chorus}</p><p>{value.practice.note}</p><p>{value.practice.position}</p>
      <ul>{value.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
    </section>}
    {value.cases.map(entry => <details className="seer-fold" key={entry.id}><summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {value.reserve && <details className="seer-fold" aria-label="牧羊人继承原储备与供给包"><summary>同一血肉储备与原包去向</summary>
      <p>血肉储备 {value.reserve.points} / {value.reserve.max}</p><p>{value.reserve.summary}</p>
      <p>原累计购买 {value.reserve.packetsBought} 份 · 最近购买周：{value.reserve.lastPurchaseWeek ?? "尚未购买"}</p>
      {value.reserve.packets.map(packet => <article key={packet.id}><p>原包：{packet.id} · {packet.status === "HELD" ? "实际持有" : "已实际耗用"}</p>
        <p>取得周：{packet.acquiredWeek} · 耗用周：{packet.consumedWeek ?? "尚未耗用"}</p></article>)}
    </details>}
    <details className="seer-fold"><summary>牧羊人原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}>
      <h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>
    <details className="seer-fold"><summary>牧羊人原能力与故事</summary>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      {value.story && <p>{value.story}</p>}<p>{value.environment}</p></details>
  </section>;
}

export interface BlackKnightPanelProps {
  blackKnight: BlackKnightProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: BlackKnightCommand) => void;
  readOnly?: boolean;
}
type Confirmation = { action: BlackKnightAction; contextKey: string };

function PracticeFacts({ practice }: { practice: NonNullable<BlackKnightProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="黑骑士原影原板与原卡的实际状态" aria-live="polite" aria-atomic="true">
    <h4>同一原现场与真实结果</h4><dl className="seer-facts">
      <div><dt>原灯与同一身体的影子</dt><dd>{practice.shadow}</dd></div>
      <div><dt>原练习板与实际切口</dt><dd>{practice.panel}</dd></div>
      <div><dt>原卡与借用来源</dt><dd>{practice.card}</dd></div>
      <div><dt>本人位置与普通返程</dt><dd>{practice.route}</dd></div></dl>
    {practice.history.length > 0 && <details className="seer-fold"><summary>实际动作、成本与失败记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}
function ShadeFacts({ shade }: { shade: NonNullable<BlackKnightProjection["shade"]> }) {
  return <section className="slice-notice" aria-label="同一独立堕落之影与原房间" aria-live="polite" aria-atomic="true">
    <h4>同一生物的已保存状态</h4><p>{shade.status}</p><dl className="seer-facts">
      <div><dt>原房间与灯</dt><dd>{shade.room}</dd></div><div><dt>独立生物的实际去向</dt><dd>{shade.creature}</dd></div>
      <div><dt>原匣与有限封条</dt><dd>{shade.kit}</dd></div><div><dt>本人位置与普通出口</dt><dd>{shade.route}</dd></div>
      <div><dt>已付成本</dt><dd>{shade.cost}</dd></div></dl><p className="seer-risk">{shade.warning}</p>
  </section>;
}
function EncounterFacts({ encounter: value }: { encounter: NonNullable<BlackKnightProjection["encounter"]> }) {
  const status: Record<string, string> = { AVAILABLE: "尚未进入交战", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已沿原出口离开", LOST: "本人已死亡" };
  const body: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "仍活着，已停止抵抗", DEAD: "原身体死亡" };
  const outcome: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原普通出口撤退", ENEMY_DEAD: "原加里克死亡", ENEMY_SURRENDERED: "原加里克自行停止抵抗" };
  return <section aria-label="黑骑士原敌人与有限资源"><p>{value.name} · {value.targetId} · 危险度约序列{value.sequence}</p>
    <dl className="seer-facts"><div><dt>当前遭遇</dt><dd>{status[value.status] ?? value.status}</dd></div>
      <div><dt>原身体健康 / 精神</dt><dd>{value.enemyHealth} / {value.enemyMind} · {body[value.enemyStatus] ?? value.enemyStatus}</dd></div>
      <div><dt>原敌人剩余灵性</dt><dd>{value.enemySpirituality} / 40</dd></div>
      <div><dt>距离与原普通出口</dt><dd>起始相距{value.distanceMetres}米 · {value.originalExit} · 无追逐</dd></div></dl>
    <details className="seer-fold"><summary>原敌人实际能力与本人战斗边界</summary><p>{value.story}</p>
      <ul>{value.abilities.map(ability => <li key={ability.id}>{ability.label} · 每次{ability.cost}灵性 · 已实际使用{value.powerUses[ability.id]}次 · {ability.available ? "当前仍具备此动作的资源" : "当前资源或身体条件不足"}</li>)}</ul>
      <p>灵肉之刃须实际付费并形成有效打击，不能保证命中或必杀。本场已知对手的恶意只属于这一原创场景，不是万能善恶鉴定。统御阴影须原目标真实受光成影，仍可抵抗；只有限削弱本轮下一次正贡献身体打击。</p>
      <p>借法仍仅来自当前驱使的1名原灵、且须已经选定；原血肉恢复耗实际储备。资源不足时普通回退，不补原包、不切换原灵。独立堕落之影不作为战斗宠物。</p>
    </details>
    {value.terminal && <p className="slice-notice">原战斗第{value.terminal.round}回合结束：{outcome[value.terminal.outcome] ?? value.terminal.outcome}。当时原敌人健康{value.terminal.enemyHealth}、精神{value.terminal.enemyMind}、灵性{value.terminal.enemySpirituality}；同一身体的伤势与结局保留，不补满或重生。</p>}
  </section>;
}

/** The renderer owns selection and deliberate review only. Every physical change comes from a committed projection. */
export function BlackKnightPanel({ blackKnight: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: BlackKnightPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [acknowledgedShade, setAcknowledgedShade] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const lastSelectedCase = useRef<{ id: string; status: string } | null>(null);
  const locked = busy || blocked || error !== null || readOnly;
  const confirmationLocked = locked || submittedId !== null;
  const grazing = value.grazing;
  const spirits = grazing?.met ? grazing.spirits.filter(spirit => spirit.status !== "UNMET") : [];
  const reserve = value.reserve;
  const caseActions = value.actions.filter(action => "caseId" in action.command);
  const sceneAction = CLEANUP_TYPES.map(type => caseActions.find(action => action.enabled && action.command.type === type)).find(Boolean);
  const activeId = sceneAction && "caseId" in sceneAction.command ? sceneAction.command.caseId : null;
  const activeCase = value.insideCase ? value.cases.find(entry => entry.id === activeId) : undefined;
  const selectedCase = activeCase ?? value.cases.find(entry => entry.id === caseId)
    ?? value.cases.find(entry => ["PREPARED", "ACTIVE", "EXAMINED"].includes(entry.status))
    ?? value.cases.find(entry => caseActions.some(action => action.enabled && "caseId" in action.command && action.command.caseId === entry.id)) ?? value.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter(action => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const bottleActions = value.actions.filter(action => BOTTLE_TYPES.includes(action.command.type));
  const selectedBottle = value.bottles.find(entry => entry.id === bottleId)
    ?? value.bottles.find(entry => bottleActions.some(action => action.enabled && "bottleId" in action.command && action.command.bottleId === entry.id)) ?? value.bottles[0];
  const selectedBottleActions = selectedBottle ? bottleActions.filter(action => "bottleId" in action.command && action.command.bottleId === selectedBottle.id) : [];
  const shadeActions = value.actions.filter(action => SHADE_TYPES.includes(action.command.type));
  const encounterActions = value.actions.filter(action => ENCOUNTER_TYPES.includes(action.command.type));
  const spiritActions = value.actions.filter(action => SPIRIT_TYPES.includes(action.command.type)).filter(action => {
    const command = action.command;
    if (command.type === "MEET_SPIRITS") return !grazing?.met;
    if (!grazing?.met) return false;
    if (command.type === "ACTIVATE_SPIRIT" && command.spiritId === null) return true;
    if (command.type === "GRAZE" || command.type === "ACTIVATE_SPIRIT" || command.type === "RELEASE_SPIRIT") {
      return spirits.some(spirit => spirit.id === command.spiritId && spirit.status === (command.type === "GRAZE" ? "AVAILABLE" : "GRAZED"));
    }
    return false;
  });
  const rationActions = value.actions.filter(action => RATION_TYPES.includes(action.command.type)).filter(action =>
    action.command.type !== "TAKE_RATION" || reserve?.packets.some(packet => action.command.type === "TAKE_RATION" && packet.id === action.command.packetId && packet.status === "HELD"));
  const growthActions = value.actions.filter(action => !("caseId" in action.command) && !("bottleId" in action.command)
    && ![...SPIRIT_TYPES, ...RATION_TYPES, ...SHADE_TYPES, ...ENCOUNTER_TYPES].includes(action.command.type));
  const shadeCleanup = ["RETURN_SHADE_ROUTE", "HANDOFF_SHADE", "CAPTURE_SHADE", "SHADOW_EXIT"].map(type => shadeActions.find(action => action.enabled && action.command.type === type)).find(Boolean);
  const sceneNext = NEXT_CASE_TYPES.map(type => selectedCaseActions.find(action => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = !value.promoted ? selectedBottleActions.find(action => action.enabled && action.command.type === "CONSUME")
    ?? [...growthActions, ...selectedBottleActions].find(action => action.enabled) ?? value.actions[0]
    : shadeCleanup ?? sceneNext ?? [...growthActions, ...spiritActions, ...encounterActions].find(action => action.enabled && action.command.type !== "RELEASE_SPIRIT")
      ?? selectedCaseActions.find(action => action.command.type !== "WITHDRAW");
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find(entry => entry.id === reviewBottleId);
  const reviewSpiritId = confirmation?.action.command.type === "RELEASE_SPIRIT" ? confirmation.action.command.spiritId : null;
  const reviewSpirit = spirits.find(spirit => spirit.id === reviewSpiritId && spirit.status === "GRAZED");
  function confirmationContext(action: BlackKnightAction): string {
    const command = action.command;
    if ("bottleId" in command) return JSON.stringify(value.bottles.find(entry => entry.id === command.bottleId));
    if (command.type === "RELEASE_SPIRIT") return JSON.stringify({ spirit: spirits.find(spirit => spirit.id === command.spiritId), active: grazing?.activeSpiritId });
    if (command.type === "SPAWN_SHADE") return JSON.stringify({ shade: value.shade, practice: value.practice });
    return JSON.stringify(value.encounter);
  }
  const liveConfirmation = confirmation && confirmation.contextKey === confirmationContext(confirmation.action)
    ? value.actions.find(action => action.id === confirmation.action.id && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmingConsume = confirmation?.action.command.type === "CONSUME";
  const confirmingRelease = confirmation?.action.command.type === "RELEASE_SPIRIT";
  const confirmingShade = confirmation?.action.command.type === "SPAWN_SHADE";

  useEffect(() => { if (selectedCase && (activeCase || caseId === null)) setCaseId(selectedCase.id); }, [selectedCase, activeCase, caseId]);
  useEffect(() => {
    const previous = lastSelectedCase.current;
    if (selectedCase && previous?.id === selectedCase.id && previous.status !== "RESOLVED" && selectedCase.status === "RESOLVED") {
      const next = value.cases.find(entry => entry.status !== "RESOLVED" && caseActions.some(action => action.enabled && "caseId" in action.command && action.command.caseId === entry.id));
      if (next) setCaseId(next.id);
    }
    lastSelectedCase.current = selectedCase ? { id: selectedCase.id, status: selectedCase.status } : null;
  }, [selectedCase, value.cases, caseActions]);
  useEffect(() => {
    if (confirmation && (readOnly || (!busy && error === null && (!liveConfirmation || (submittedId !== null && !liveConfirmation.enabled)
      || (reviewBottleId !== null && !reviewBottle) || (reviewSpiritId !== null && !reviewSpirit))))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null; setAcknowledgedShade(false);
    }
  }, [confirmation, readOnly, busy, error, liveConfirmation, submittedId, reviewBottleId, reviewBottle, reviewSpiritId, reviewSpirit]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function actionButton(action: BlackKnightAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `black-knight-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (REVIEW_TYPES.includes(action.command.type)) {
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null); setAcknowledgedShade(false);
            setConfirmation({ action, contextKey: confirmationContext(action) });
          } else {
            if ("caseId" in action.command) setCaseId(action.command.caseId);
            if ("bottleId" in action.command) setBottleId(action.command.bottleId);
            onCommand(action.command);
          }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`black-knight-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled
      || (confirmingShade && !acknowledgedShade) || (reviewBottleId !== null && !reviewBottle) || (reviewSpiritId !== null && !reviewSpirit)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复服药、释放、生成生物、耗用封条或移动原物。"}
  </p>;
  const currentResources = <section aria-label={confirmingConsume ? "服药前当前资源" : "行动前当前资源"}><h4>你现在的状态</h4>
    <dl className="seer-facts"><div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div><div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div></dl>
  </section>;
  if (confirmation) return <section className="seer-panel warrior-panel black-knight-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶黑骑士魔药的服用确认" : confirmingRelease ? "永久释放这一原灵的独立确认" : confirmingShade ? "生成独立堕落之影的明确确认" : "黑骑士真实迎战确认"} aria-busy={busy}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : confirmingRelease ? "永久释放前请单独确认" : confirmingShade ? "可选实践：会产生不受控制的真实独立生物" : "可选交战与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : confirmingRelease ? `释放「${reviewSpirit?.name ?? "原灵已不可用"}」` : confirmingShade ? "确认让这一堕落之影独立存在" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="黑骑士服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{playerText("完整配方与原著晋升仪式细节仍未知，不能据此断言无需仪式。导师专业准备、成品供给与当前流程属于本作原创G。确认只服用这一原瓶，无论成败均实际耗用。")}</p>
      <p>只有服药排异的健康与精神最低保留1，不保护战斗死亡。晋升不补满灵性，不新增性别变化；原伊芮斯、已释放原灵与实际储备保持原结果。可以暂不服用，继续牧羊人生活。</p>
    </> : confirmingRelease ? <section className="slice-notice seer-risk" aria-label="原灵永久释放后果">
      {reviewSpirit && <><p>原灵魂ID：{reviewSpirit.id}</p><p>来源：{reviewSpirit.source}</p><p>当前已选能力：{reviewSpirit.selectedAbilities.map(id => reviewSpirit.knownAbilities.find(ability => ability.id === id)?.label ?? id).join("、") || "无"}</p></>}
      <p>确认后永久失去这一原灵及其已选能力的使用权；当前来源不会重新提供它。不能撤销、重新取得、换回或复活，也不会补发另一灵魂、返还消耗或永久复制其能力。</p>
      <p>{grazing?.activeSpiritId === reviewSpiritId ? "这一原灵正在被驱使；释放将同时停止驱使。" : "这一原灵当前未被驱使。"}</p>
    </section> : confirmingShade ? <section className="slice-notice seer-risk" aria-label="独立堕落之影的实际后果">
      <p>角色将本次具体虚构恶念「{SHADE_URGE}」剥离为唯一BK4-SHADE-1。它是独立且不受控制的生物，不是宠物、第二个驱使灵魂或永久净化人格。</p>
      <p>实际支付1行动、5灵性、5精神。生成后它会自主走2米到原BK4-LAMP-1并熄灯，不听命令；普通生活须先完成真实收束。</p>
      <p>捕获每次另付1行动、3灵性和1张实际封条，知识18检定，只有两张封条。失败仍耗封条、原玻璃罩破损、精神−3最低保留1；同一生物会自主走向内门，不能当作已经消失。</p>
      <p>捕获成功后仍是同一活着的生物：封在BK4-CASK-1内。须本人沿普通路线实际走2米退出，再交给门外导师带到BK4-STORE。也可0行动沿畅通普通出口走2米，耗唯一BK4-EXIT-SEAL-1封门，永久隔离原房间；同一生物仍留在里面，不能恢复原房间或再生成一次。</p>
      {value.shade && <ShadeFacts shade={value.shade} />}
      <label><input type="checkbox" checked={acknowledgedShade} disabled={confirmationLocked} onChange={event => setAcknowledgedShade(event.target.checked)} />我确认角色本次恶念「{SHADE_URGE}」，并接受独立生物、后续封条成本与永久隔离的可能。</label>
    </section> : <section className="slice-notice seer-risk" aria-label="黑骑士真实交战风险"><h4>可能重伤或死亡</h4>
      <p>原创成年序列5对手加里克·诺尔在净空原附院4米外，持原短棍，并有40点有限灵性使用弧光与护术。原普通出口开放、无旁人、无追逐，也可以普通拒绝交手后离开。</p>
      <p>灵肉之刃并非必杀，统御真实阴影仍可抵抗；借法只来自当前选中1灵的已选能力。原血肉恢复耗实际储备，战斗伤势与死亡按共同规则结算。不能自动捕获败者灵魂或复活旧对手。</p>
    </section>}
    {currentResources}{liveConfirmation?.reason && <p className="seer-action-reason" id="black-knight-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用" : confirmingRelease ? "保留这一原灵" : confirmingShade ? "暂不生成堕落之影" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled || (confirmingShade && !acknowledgedShade)} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "black-knight-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : confirmingRelease ? `确认永久释放「${reviewSpirit?.name ?? "原灵"}」` : confirmingShade ? "确认付费生成独立堕落之影" : "确认风险，开始真实交战"}</button></div>
    <p className="slice-muted">取消不执行本次动作，也不退还此前已经支付的成本。保存未确认时保留这一次操作，等待外层重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel black-knight-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="黑骑士成长下一步"><span className="seer-seal">{value.promoted ? "黑骑士4" : "牧羊人5 → 黑骑士4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3><p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">{value.bodyChange}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    {!value.promoted && <section className="slice-notice" aria-label="黑骑士配方与成品边界"><h4>独立成品与真实成熟条件</h4>
      <p>{playerText("完整配方与原著晋升仪式细节仍未知。原导师的专业准备、指导服药、独立成品与数值均为本作原创G，不能据此断言无需仪式。")}</p>
      <p>牧羊人消化100且晋升后满12真实整周，意志难度28。指导540便士、1行动；每瓶全价6800便士。五次真实劳务抵5300便士后仍付1500便士，逐瓶付款与独立服用各0行动。</p>
      <p>三个独立原瓶不会由旧药转化；全部失败后才有下一真实周的有限补货。可以继续牧羊人生活。</p>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="黑骑士指导与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <section aria-label="黑骑士原瓶供给"><h3>独立原瓶与实际供给</h3><p>{value.supplies}</p>
      <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立黑骑士原瓶" value={selectedBottle.id} disabled={locked} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
      <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
      <div className="warrior-action-list" role="group" aria-label="当前黑骑士原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
    </section>}
    {value.promoted && selectedCase && <section aria-label="黑骑士有限生活实践"><h3>同一原影、原练习板与单灵借用</h3>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前黑骑士生活实践" value={selectedCase.id} disabled={locked || value.insideCase} onChange={event => setCaseId(event.target.value)}>
        {value.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}{value.practice && <PracticeFacts practice={value.practice} />}
        {selectedCase.result && <section className="slice-notice" aria-label="黑骑士实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前黑骑士生活行动">{selectedCaseActions.map(actionButton)}</div>
        {value.insideCase && <p className="slice-muted">原影、原刃或借用须真实结束；原卡与本人须先走普通路线返回。0行动收束保持可用，不退费、不传送、不抹去原切口或失败记录。</p>}
        <details className="seer-fold"><summary>已观察的事实与普通方法</summary>{selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}
          <p>{value.environment}</p><p>{playerText("文森须当次同意，真实灯光照出同一身体的影子；范围2米，持续60秒，知识难度18。普通边界观察不会产生束缚，也不增加统御掌握。")}</p>
          <p>灵肉之刃须实际碰到原板，切口永久保留；板后无人，没有击杀奖励。普通工具只作安全刻痕。原卡的能力方法须原伊芮斯已放牧、正在驱使且已选轻触术；否则可亲自走1米搬同一原卡，再实际取回。</p>
          <p>三份报告各25、回顾25，可全程普通方法和平消化100。普通方法、准备与失败不冒充能力成功，不要求伤害、再放牧或生成堕落之影。</p>
        </details>
      </section>
    </section>}
    {value.promoted && <section aria-label="可选独立堕落之影实践"><h3>可选：独立堕落之影与真实收束</h3>
      <p>这项实践独立于三份生活报告，不是消化必选项。一次性原器材需180便士、1行动；进入原房间须本人真实走2米。生成、捕获与普通隔离各有实际代价。</p>
      {value.shade && <ShadeFacts shade={value.shade} />}
      <div className="warrior-action-list" role="group" aria-label="独立堕落之影生成捕获与退出">{shadeActions.map(actionButton)}</div>
      <p className="slice-muted">捕获要实际封条与检定，成功后同一生物仍封在原匣；走2米退出后才可交给门外导师带走。紧急退出为0行动普通走2米，出口必须畅通，并耗唯一应急封条永久隔离原房间；同一生物仍留在里面。没有瞬移、自动消失、免费封印或受控宠物。相邻的原板与原卡房间仍可继续使用。</p>
    </section>}
    {value.promoted && grazing && <section className="slice-notice" aria-label="黑骑士继承灵魂名册与当前驱使"><h3>原灵名册 · 实际放牧 {spirits.filter(spirit => spirit.status === "GRAZED").length} / {grazing.capacity}</h3>
      <p>{grazing.summary}</p><p aria-live="polite">当前驱使：{spirits.find(spirit => spirit.id === grazing.activeSpiritId && spirit.status === "GRAZED")?.name ?? "无，仅使用自身能力"}</p>
      <p>当前保留7灵上限、每灵最多3项实际已选能力，同时只驱使1灵。切换0行动、0灵性，使用借法仍付费；晋升不填满名册。普通原灵不能外化成独立身体，没有免费半神灵库。</p>
      {!grazing.met && <p>尚未实际会面；原身份与能力保持未知。</p>}
      {spiritActions.filter(action => action.command.type === "MEET_SPIRITS" || action.command.type === "ACTIVATE_SPIRIT" && action.command.spiritId === null).map(actionButton)}
      {spirits.map(spirit => <article className="warrior-history-bottle" key={spirit.id} aria-label={`黑骑士继承原灵 ${spirit.id}`}><h4>{spirit.name} · {SPIRIT_STATUS[spirit.status] ?? spirit.status}</h4>
        <p>原灵魂ID：{spirit.id}</p><p>来源：{spirit.source}</p><p>已选能力 {spirit.selectedAbilities.length} / 3：{spirit.selectedAbilities.map(id => spirit.knownAbilities.find(ability => ability.id === id)?.label ?? id).join("、") || "尚未选择"}</p>
        <p>{spirit.status === "GRAZED" && grazing.activeSpiritId === spirit.id ? "正在驱使这一原灵" : SPIRIT_STATUS[spirit.status] ?? spirit.status}</p>
        <details className="seer-fold"><summary>同一原灵的能力与实际取得记录</summary>{spirit.knownAbilities.map(ability => <p key={ability.id}>{ability.label}：{ability.description}</p>)}
          <p>尝试周：{spirit.attemptWeek ?? "尚未尝试"} · 取得周：{spirit.acquiredWeek ?? "尚未取得"} · 释放周：{spirit.releasedWeek ?? "尚未释放"}</p></details>
        {spirit.status === "RELEASED" && <p>原灵已永久释放，只保留历史选择，不可使用其能力或重新取得。</p>}
        {spiritActions.filter(action => "spiritId" in action.command && action.command.spiritId === spirit.id).map(actionButton)}
      </article>)}
    </section>}
    {value.promoted && reserve && <section className="slice-notice" aria-label="黑骑士继承血肉储备与原供给包"><h3>血肉储备 {reserve.points} / {reserve.max}</h3><p>{reserve.summary}</p>
      <p>实际已购 {reserve.packetsBought} 份 · 最近购买周：{reserve.lastPurchaseWeek ?? "尚未购买"}。仍沿用原蔷薇主教渠道，不自动补充、取用或治疗。</p>
      {rationActions.filter(action => action.command.type === "BUY_RATION").map(actionButton)}
      {reserve.packets.length === 0 ? <p>尚无实际购买的原包。</p> : reserve.packets.map(packet => <article key={packet.id}><h4>供给原包 {packet.id}</h4>
        <p>取得周：{packet.acquiredWeek} · {packet.status === "HELD" ? "实际持有，尚未取用" : `已实际耗用，耗用周：${packet.consumedWeek ?? "待核实"}`}</p>
        {rationActions.filter(action => action.command.type === "TAKE_RATION" && action.command.packetId === packet.id).map(actionButton)}</article>)}
    </section>}
    {value.promoted && <section aria-label="黑骑士可选交战"><h3>原附院中的加里克·诺尔</h3>{value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="黑骑士交谈与迎战">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="黑骑士能力与消化"><h3>能力与消化</h3><progress className="cryptologist-progress" aria-label="黑骑士扮演进度" value={value.acting} max={100} />
      {value.abilities.map(ability => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p>本人灵肉之刃、统御阴影与实际借法须区分来源。只有真实成功的相应能力实践按规则增加掌握；下一序列为三首圣堂3，本阶段没有同时驱使多灵。</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>黑骑士独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>}
    <details className="seer-fold" aria-label={playerText("黑骑士能力与使用范围")}><summary>{playerText("能力与使用范围")}</summary><p>{value.inheritedTools}</p>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>灵肉之刃须命中才有伤害；统御真实阴影不等于读心或意志控制。堕落之影是独立生物，不能作为受控宠物，也不证明人格已经净化。只有真正取得的半神原灵才有相应有限外化可能，本渠道没有此类原灵或外化动作。</p>
      <p>{playerText("导师、文森、原灯、原板、原卡、匣与封条、具体恶念、独立生物、对手、路线、时长、费用、检定与数值均为本作G。它们不冒充完整原著公式、普适范围或必杀保证；不免费获得巫王的能力链。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
