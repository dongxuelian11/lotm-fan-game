import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { MysticAction, MysticCommand, MysticProjection } from "../domain/mystic/types";
import type { StarMysticProjection } from "../domain/star-mystic/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对原现场", PREPARED: "已准备，尚未实际尝试",
  ACTIVE: "本次效果或接触仍在继续", WAITING: "等待下一真实周", EXAMINED: "已有本次结果，待收束与报告", RESOLVED: "已提交有限报告",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const RITUAL_TYPES = ["ACQUIRE_SAMPLE", "OPEN_ANALYSIS", "ANALYZE_SAMPLE", "CLOSE_ANALYSIS", "RETURN_SAMPLE", "BUY_LENSES"];
const WORKSHOP_TYPES = ["LEARN_SPELL", "BUY_KIT", "CRAFT_SCROLL", "AUTHORIZE_SCROLL"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT"];
const REVIEW_TYPES = ["CONSUME", "ENCOUNTER_FIGHT", "PUBLISH_STORY"];
const SCROLL_LABELS = { IMPACT: "冲力卷轴 · 主攻H", WARD: "护持卷轴 · 自保B" } as const;

/** The original S5 people, objects, costs and outcomes remain read-only after promotion. */
export function MysticStarMysticHistory({ starMystic: value }: { starMystic: StarMysticProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="星象师时期的经历">
    <h3>星象师时期的经历</h3>
    <p className="slice-notice">保留原达芙宁、原眼镜、标记、囚笼与天气观察，以及原布莱斯冲突的实际记录，只供回看。旧经历不重演或重新发奖；晋升不治愈旧伤、不复活旧对手。</p>
    <p>星象师扮演进度 {value.acting} · 消化：{value.digestion}</p>
    {value.practice && <section aria-label="星象师原眼镜与实际现场"><h4>原眼镜、视野与位置</h4>
      <dl className="seer-facts"><div><dt>同一原眼镜与实际视野</dt><dd>{value.practice.vision}</dd></div>
        <div><dt>原参与者与囚笼</dt><dd>{value.practice.cage}</dd></div>
        <div><dt>原位置与天气观察</dt><dd>{value.practice.position}</dd></div></dl>
      <details className="seer-fold"><summary>星象师原动作与失败记录</summary><ul>{value.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>
    </section>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}><summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {value.workshop && <details className="seer-fold" aria-label="星象师继承工坊原件记录"><summary>继承工坊的原材料与原卷</summary>
      <p>{value.workshop.summary}</p>
      {value.workshop.materials.map((material) => <p key={material.id}>材料 {material.id} · {material.status === "HELD" ? "实际持有" : "已耗用"} · 取得周 {material.acquiredWeek} · 耗用周 {material.spentWeek ?? "尚未耗用"}</p>)}
      {value.workshop.scrolls.map((scroll) => <article key={scroll.id}><h4>{scroll.title}</h4><p>原卷轴：{scroll.id} · 制作序列 {scroll.makerSequence}</p>
        <p>来源：{scroll.source} · 材料：{scroll.materialId}</p><p>刻录时掌握 {scroll.inscriptionMastery} · 制作周 {scroll.createdWeek} · 耗用周 {scroll.usedWeek ?? "尚未耗用"}</p>
        <p>{scroll.status === "HELD" ? "实际持有 · 可使用一次" : "已耗用 · 剩余使用0次"} · {scroll.authorized ? "已授权匹配战斗槽" : "未授权自动使用"}</p></article>)}
      <p>旧卷制作序列6或5保持原样；继续学习、购买、刻录与逐件授权，请使用当前神秘学家页的继承工坊。</p>
    </details>}
    <details className="seer-fold"><summary>星象师原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p>
    </details>
    <details className="seer-fold"><summary>星象师继承能力与原现场</summary>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      {value.story && <p>{value.story}</p>}<p>{value.environment}</p>
    </details>
  </section>;
}

export interface MysticPanelProps {
  mystic: MysticProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: MysticCommand) => void;
  readOnly?: boolean;
}
type Confirmation = { action: MysticAction; contextKey: string };

function PracticeFacts({ practice }: { practice: NonNullable<MysticProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="神秘学家原故事与共享视野" aria-live="polite" aria-atomic="true">
    <h4>已保存的来源与当前现场</h4>
    <dl className="seer-facts"><div><dt>原故事与实际研究</dt><dd>{practice.story}</dd></div>
      <div><dt>原钟与有限回声</dt><dd>{practice.bell}</dd></div><div><dt>当前同意与共享视野</dt><dd>{practice.sight}</dd></div>
      <div><dt>本人和参与者的实际位置</dt><dd>{practice.route}</dd></div><div><dt>已付成本与收束</dt><dd>{practice.cost}</dd></div></dl>
    {practice.history.length > 0 && <details className="seer-fold"><summary>实际研究、行走与失败记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

function RitualFacts({ ritual: value }: { ritual: NonNullable<MysticProjection["ritual"]> }) {
  return <section aria-label="原滴分析的已保存事实" aria-live="polite" aria-atomic="true">
    <h4>{value.title}</h4><p>不同成功步骤 {value.completedSteps} / {value.totalSteps} · {value.complete ? "已完成已知仪式部分" : "已知仪式部分尚未完成"} · {value.open ? "原罩仍开启，须实际安全关闭" : "当前没有开启的分析"}</p>
    <dl className="seer-facts"><div><dt>同一滴原血的去向</dt><dd>{value.sample}</dd></div>
      <div><dt>原防护罩</dt><dd>{value.shield}</dd></div><div><dt>原记录册</dt><dd>{value.recordbook}</dd></div></dl>
    <details className="seer-fold"><summary>原捐赠者、三项分析与全部尝试</summary><p>{value.source}</p>
      <ol>{value.steps.map((step) => <li key={step.id}>{step.title} · {step.complete ? "实际成功" : "尚未完成"}<p>{step.detail}</p></li>)}</ol>
      {value.history.length > 0 ? <ul>{value.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul> : <p>尚无实际分析尝试。</p>}
      <p>{value.boundary}</p>
    </details>
  </section>;
}

function EncounterFacts({ encounter: value }: { encounter: NonNullable<MysticProjection["encounter"]> }) {
  const status: Record<string, string> = { AVAILABLE: "尚未进入交战", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已沿原出口离开", LOST: "本人已死亡" };
  const body: Record<string, string> = { NOT_MET: "尚未碰面", RESISTING: "仍在抵抗", SURRENDERED: "仍活着，已停止抵抗", DEAD: "原身体死亡", LEFT: "已离开接触" };
  const outcome: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原出口撤退", ENEMY_DEAD: "原卢坎死亡", ENEMY_SURRENDERED: "原卢坎自行停止抵抗" };
  return <section aria-label="神秘学家原卢坎与有限资源">
    <p>{value.name} · 危险度约序列{value.sequence}</p>
    <dl className="seer-facts"><div><dt>当前遭遇</dt><dd>{status[value.status] ?? value.status}</dd></div>
      <div><dt>原身体健康 / 精神</dt><dd>{value.enemyHealth} / {value.enemyMind} · {body[value.enemyStatus] ?? value.enemyStatus}</dd></div>
      <div><dt>原敌人剩余灵性</dt><dd>{value.enemySpirituality} / 40</dd></div>
      <div><dt>原距离与退出路线</dt><dd>起始相距{value.distanceMetres}米 · {value.originalExit} · 无追逐</dd></div></dl>
    <details className="seer-fold"><summary>原敌人的法术、抵抗与有限效果</summary><p>原对手：{value.targetId}</p><p>{value.story}</p>
      <ul>{value.abilities.map((ability) => <li key={ability.id}>{ability.label} · 每次{ability.cost}灵性 · 已实际使用{value.powerUses[ability.id]}次 · {ability.available ? "当前资源允许" : "当前资源或身体条件不足"}</li>)}</ul>
      <p>迟钟回声须本人实际研究学会，才可尝试影响下一次真正发生的有效法术贡献；目标仍可抵抗，一次后或本轮结束失效，不控制思想、不取消施法成本。公开传播后效果会显著减弱。</p>
      <p>未学会回声时，预备动作只能使用已持有的原SM5-LENS-1聚焦。星光囚笼仅限制下一次有效普通打击，卷轴按原件与原授权耗用；血样不能用于施法。</p>
      <p>{playerText("本场净空、无旁观者，不表示友军自动免疫。距离、成本与效果数值均为本作原创G。")}</p>
    </details>
    {value.terminal && <p className="slice-notice">原战斗第{value.terminal.round}回合结束：{outcome[value.terminal.outcome] ?? value.terminal.outcome}。当时原敌人健康{value.terminal.enemyHealth}、精神{value.terminal.enemyMind}、灵性{value.terminal.enemySpirituality}；原身体结局保留。</p>}
  </section>;
}

/** Local state selects a view or reviews an intent; only committed domain projections change facts. */
export function MysticPanel({ mystic: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: MysticPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [craftId, setCraftId] = useState<string | null>(null);
  const [publicationOpen, setPublicationOpen] = useState(false);
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
  const activeAction = caseActions.find((action) => action.enabled && ["RETURN_ROUTE", "CLOSE", "WITHDRAW"].includes(action.command.type));
  const activeId = activeAction && "caseId" in activeAction.command ? activeAction.command.caseId : null;
  const activeCase = value.insideCase ? value.cases.find((entry) => entry.id === activeId) : undefined;
  const selectedCase = activeCase ?? value.cases.find((entry) => entry.id === caseId)
    ?? value.cases.find((entry) => ["PREPARED", "ACTIVE", "EXAMINED", "WAITING"].includes(entry.status))
    ?? value.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id)) ?? value.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const bottleActions = value.actions.filter((action) => BOTTLE_TYPES.includes(action.command.type));
  const selectedBottle = value.bottles.find((entry) => entry.id === bottleId)
    ?? value.bottles.find((entry) => bottleActions.some((action) => action.enabled && "bottleId" in action.command && action.command.bottleId === entry.id)) ?? value.bottles[0];
  const selectedBottleActions = selectedBottle ? bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === selectedBottle.id) : [];
  const ritualActions = value.actions.filter((action) => RITUAL_TYPES.includes(action.command.type));
  const workshopActions = value.actions.filter((action) => WORKSHOP_TYPES.includes(action.command.type));
  const encounterActions = value.actions.filter((action) => ENCOUNTER_TYPES.includes(action.command.type));
  const publicationActions = value.actions.filter((action) => action.command.type === "PUBLISH_STORY");
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command)
    && ![...RITUAL_TYPES, ...WORKSHOP_TYPES, ...ENCOUNTER_TYPES, "PUBLISH_STORY"].includes(action.command.type));
  const craftActions = workshopActions.filter((action) => action.command.type === "CRAFT_SCROLL");
  const selectedCraft = craftActions.find((action) => action.id === craftId) ?? craftActions.find((action) => action.enabled) ?? craftActions[0];
  const caseOrder = selectedCase?.status === "PREPARED" ? ["RETURN_ROUTE", "PERFORM", "CLOSE", "REPORT", "PREPARE", "OBSERVE"] : ["RETURN_ROUTE", "CLOSE", "REPORT", "PERFORM", "PREPARE", "OBSERVE"];
  const sceneNext = caseOrder.map((type) => selectedCaseActions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = !value.promoted
    ? selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? [...growthActions, ...ritualActions, ...selectedBottleActions].find((action) => action.enabled) ?? value.actions[0]
    : sceneNext ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
      ?? [...growthActions, ...encounterActions, ...workshopActions].find((action) => action.enabled)
      ?? selectedCaseActions.find((action) => action.command.type !== "WITHDRAW") ?? value.actions[0];
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  function confirmationContext(action: MysticAction): string {
    if ("bottleId" in action.command) return JSON.stringify(value.bottles.find((entry) => "bottleId" in action.command && entry.id === action.command.bottleId));
    return JSON.stringify(action.command.type === "PUBLISH_STORY" ? value.practice : value.encounter);
  }
  const liveConfirmation = confirmation && confirmation.contextKey === confirmationContext(confirmation.action)
    ? value.actions.find((action) => action.id === confirmation.action.id && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmingConsume = confirmation?.action.command.type === "CONSUME";
  const confirmingPublish = confirmation?.action.command.type === "PUBLISH_STORY";

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

  function actionButton(action: MysticAction, unavailable = false) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || unavailable || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `mystic-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || unavailable || !action.enabled) return;
          if (REVIEW_TYPES.includes(action.command.type)) {
            if (action.command.type === "PUBLISH_STORY") setPublicationOpen(true);
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, contextKey: confirmationContext(action) });
          } else {
            if ("caseId" in action.command) setCaseId(action.command.caseId);
            if ("bottleId" in action.command) setBottleId(action.command.bottleId);
            onCommand(action.command);
          }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`mystic-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled || (reviewBottleId !== null && !reviewBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复服药、公开故事、购买或移动原物。"}
  </p>;
  const currentResources = <section aria-label={confirmingConsume ? "服药前当前资源" : "行动前当前资源"}><h4>你现在的状态</h4>
    <dl className="seer-facts"><div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div><div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div></dl>
  </section>;

  if (confirmation) return <section className="seer-panel warrior-panel mystic-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶神秘学家魔药的服用确认" : confirmingPublish ? "神秘故事不可逆公开确认" : "神秘学家真实迎战确认"} aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : confirmingPublish ? "公开后无法收回已经传播的知识" : "可选交战与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : confirmingPublish ? "确认公开「迟到的钟声」" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="神秘学家服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{playerText("已知仪式部分是完全解析一滴神话生物血液；血样不饮用。本作服药前须三项实际成功、实际关闭原罩并归还同一密封原滴。三项分析与封存归还属于本作原创G的可玩流程，不冒充完整原著仪式。完整配方与其余仪式细节仍未知；伊蕾的专业准备同样标为G。")}</p>
      <p>确认仅服用这一原瓶，无论成败均消耗。仅服药排异的健康与精神最低保留1，不保护实战死亡；晋升不补满灵性、不改变原身体与性别记录，也不自动取得命运运气或预言大师能力。可以暂不服用，继续星象师生活。</p>
    </> : confirmingPublish ? <section className="slice-notice seer-risk" aria-label="原故事公开的不可逆后果"><h4>传播会削弱这一已学法术</h4>
      <p>把本人研究过的原故事副本MY4-PUBLIC-COPY-1交给北桥成年读书会MY4-READING-GROUP-1的100位成员，进行公开披露。原知情范围由5人扩大到105人，迟钟回声的效果系数从1降至0.15；来源与实际学习记录保留。</p>
      <p>这是不可逆的公开披露，不能通过收回副本、再次研究或晋升恢复秘密。本次不会额外增加扮演或免费赠送新法术。</p>
      {value.practice && <p>{value.practice.story}</p>}
    </section> : <section className="slice-notice seer-risk" aria-label="神秘学家真实交战风险"><h4>可能重伤或死亡</h4>
      <p>原创成年对手卢坎·维伊在原独立附院4米外，持自己的短棍且有40点有限灵性，可以实际使用弧光与护罩。原普通出口可用，无旁观者、无追逐，也可以先普通表明退出。</p>
      <p>回声必须实际学会，目标可以抵抗；共享眼睛不读取思想或控制对手。原卷轴会真实耗用，战斗伤势、撤退与死亡照常结算。旧布莱斯不会复活，原眼镜与旧卷不会刷新。</p>
    </section>}
    {currentResources}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="mystic-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用" : confirmingPublish ? "保留秘密，暂不公开" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "mystic-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : confirmingPublish ? "确认不可逆公开并削弱迟钟回声" : "确认风险，开始真实交战"}</button></div>
    <p className="slice-muted">取消不消耗资源，也不执行本次动作。保存未确认时保留这一次操作，等待原保存重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel mystic-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="神秘学家成长下一步"><span className="seer-seal">{value.promoted ? "神秘学家4" : "星象师5 → 神秘学家4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">{value.bodyChange}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    {!value.promoted && <section className="slice-notice" aria-label="神秘学家配方与成品边界"><h4>已知条件与独立成品</h4>
      <p>{playerText("完全解析一滴神话生物血液是已知的仪式部分，不饮用血样；完整配方与其余仪式细节仍未知。三项实际分析、原样封存归还及导师专业准备均为本作原创G流程。")}</p>
      <p>用药指导540便士、1行动；每瓶全价6800便士。五次真实劳务抵5300便士后仍付1500便士；付款和独立服药各0行动。可以继续星象师生活。</p>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="神秘学家指导与成长行动">{growthActions.map((action) => actionButton(action))}</div>}
    {/* Ritual facts below are supplied by the domain; analysis never updates locally. */}
    {!value.promoted && (value.ritual || ritualActions.length > 0) && <section aria-label="神秘学家一滴原血分析"><h3>同一滴原血的有限分析</h3>
      {value.ritual && <RitualFacts ritual={value.ritual} />}
      <p>同一原血样容器、护罩、记录册与原SM5-LENS-1必须实际到位。每次分析都支付1行动、4灵性、2精神并进行知识18检定；失败保留成本，须安全收束后等到下一真实周重试。</p>
      <div className="warrior-action-list" role="group" aria-label="原血取得分析与安全收束">{ritualActions.map((action) => actionButton(action))}</div>
      <p className="slice-muted">关闭分析为0行动安全收束；全部三项实际成功后归还同一原样。准备或失败不增加扮演与能力掌握，原血不复制、不饮用，也不是战斗燃料。</p>
    </section>}
    {value.promoted && value.ritual && <details className="seer-fold"><summary>晋升前同一原滴的分析与归还记录</summary><RitualFacts ritual={value.ritual} /></details>}
    {!value.promoted && selectedBottle && <section aria-label="神秘学家原瓶供给"><h3>独立原瓶与实际供给</h3><p>{value.supplies}</p>
      <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立神秘学家原瓶" value={selectedBottle.id} disabled={locked}
        onChange={(event) => setBottleId(event.target.value)}>{value.bottles.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
      <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
      <div className="warrior-action-list" role="group" aria-label="当前原瓶劳务付款与独立服用">{selectedBottleActions.map((action) => actionButton(action))}</div>
    </section>}
    {value.promoted && selectedCase && <section aria-label="神秘学家有限生活实践"><h3>亲自研究、有限回声与自愿共享视野</h3>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前神秘学家生活实践" value={selectedCase.id} disabled={locked || value.insideCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {value.practice && <PracticeFacts practice={value.practice} />}
        {selectedCase.result && <section className="slice-notice" aria-label="神秘学家实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前神秘学家生活行动">{selectedCaseActions.map((action) => actionButton(action))}</div>
        <details className="seer-fold"><summary>已观察的事实与本次方法边界</summary>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}
          <p>{value.environment}</p>
          <p>{playerText("迟钟回声来自本人对这段原创G过去事件的真实研究，晋升不免费赠送。它只影响短暂声音感知与注意，原钟保持不动，不控制时间或意志。")}</p>
          <p>共享眼睛须成年达芙宁本次自愿同意；她沿同一6米走廊走到标记，本人留在原房间。只看实际当下视野，不读取思想。普通方法由本人实际步行核对，不增加能力掌握。结束须真实返回、撤去眼睛并结束同意；0行动仍能安全收束。</p>
        </details>
      </section>
    </section>}
    {value.promoted && publicationActions.length > 0 && <details className="seer-fold" open={publicationOpen} onToggle={(event) => setPublicationOpen(event.currentTarget.open)}><summary>公开已研究故事 · 不可逆削弱效果</summary>
      <p>公开给读书会会永久扩大知情范围，并使这一已学法术显著减弱。确认后才提交，不增加扮演。</p>{publicationActions.map((action) => actionButton(action))}
    </details>}
    {value.promoted && value.workshop && <section aria-label="神秘学家继承卷轴工坊"><h3>继承的卷轴工坊 · 当前序列4</h3>
      <p>{value.workshop.summary}</p><p className="slice-muted">沿用原课程与实际库存。旧卷制作序列6或5不变，新刻录如实记4；仍使用原模板与预算，不自动增强旧法术或补回原材料。</p>
      <details className="seer-fold"><summary>原课程、材料与实际刻录</summary>
        {value.workshop.lessons.map((lesson) => <article key={lesson.id}><h4>{lesson.label} · {lesson.learned ? "已实际学会" : "尚未学会"}</h4><p>{lesson.description}</p>
          {!lesson.learned && workshopActions.filter((action) => action.command.type === "LEARN_SPELL" && action.command.spellId === lesson.id).map((action) => actionButton(action))}</article>)}
        {workshopActions.filter((action) => action.command.type === "BUY_KIT").map((action) => actionButton(action))}
        {selectedCraft && <><label className="warrior-case-picker">选择要刻录的卷轴<select aria-label="选择神秘学家继承工坊刻录" value={selectedCraft.id} disabled={locked || value.insideCase}
          onChange={(event) => setCraftId(event.target.value)}>{craftActions.map((action) => <option key={action.id} value={action.id}>{action.command.type === "CRAFT_SCROLL" ? SCROLL_LABELS[action.command.kind] : action.label}</option>)}</select></label>{actionButton(selectedCraft)}</>}
        {value.workshop.materials.length > 0 ? value.workshop.materials.map((material) => <p key={material.id}>材料 {material.id} · {material.status === "HELD" ? "实际持有" : "已实际耗用"} · 取得周 {material.acquiredWeek} · 耗用周 {material.spentWeek ?? "尚未耗用"}</p>) : <p>尚无实际购买的材料原份。</p>}
      </details>
      <details className="seer-fold"><summary>卷轴原件与逐件战前授权</summary>
        {value.workshop.scrolls.length > 0 ? value.workshop.scrolls.map((scroll) => <article key={scroll.id}><h4>{scroll.title} · {SCROLL_LABELS[scroll.kind]}</h4>
          <p>原卷轴：{scroll.id} · 制作序列 {scroll.makerSequence} · 刻录时掌握 {scroll.inscriptionMastery}</p><p>来源：{scroll.source} · 材料：{scroll.materialId}</p>
          <p>{scroll.status === "HELD" ? "实际持有 · 可使用一次" : "已耗用 · 剩余使用0次"} · {scroll.authorized ? "已授权匹配战斗槽" : "未授权自动使用"} · 耗用周 {scroll.usedWeek ?? "尚未耗用"}</p>
          {workshopActions.filter((action) => action.command.type === "AUTHORIZE_SCROLL" && action.command.scrollId === scroll.id).map((action) => actionButton(action, scroll.status === "USED"))}</article>) : <p>尚无刻录成功的原卷；准备与失败不会生成成品。</p>}
        <p>授权只允许匹配战斗槽自动使用这一原件一次，实际启动仍需1灵性，也可能失败。</p>
      </details>
    </section>}
    {value.promoted && <section aria-label="神秘学家可选交战"><h3>附院中的卢坎·维伊</h3>
      {value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="神秘学家交谈与迎战">{encounterActions.map((action) => actionButton(action))}</div>
    </section>}
    {value.promoted && <section aria-label="神秘学家能力与消化"><h3>能力与消化</h3>
      <progress className="cryptologist-progress" aria-label="神秘学家扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">旧能力与掌握保留。新能力从0开始，须实际使用才可能获得掌握；普通方法不冒充能力成功。下一序列是预言大师3，本阶段没有未来视野或完整神话形态。</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>神秘学家原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p>
    </details>}
    <details className="seer-fold" aria-label={playerText("神秘学家能力与使用范围")}><summary>{playerText("能力与使用范围")}</summary><p>{value.inheritedTools}</p>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>再现必须依赖本人研究过的神秘学知识，只有少数真实神秘故事适用，广泛传播会近乎抹去效果。不能任意输入故事变成法术，不开放缺乏保护的背叛之宴或免费的丑小鸭与神话形态。</p>
      <p>{playerText("本作的原捐赠者、原血样、三项分析、故事、原钟、参与者与遭遇的具体流程和数值均为G。原血不饮用；血液途径的差异不等于免费获得命运运气。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
