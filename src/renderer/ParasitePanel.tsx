import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ParasiteAction, ParasiteCommand, ParasiteProjection } from "../domain/parasite/types";
import type { DreamStealerProjection } from "../domain/dream-stealer/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对当前现场", PREPARED: "已准备，尚未实际尝试",
  ACTIVE: "实际接触仍在继续", EXAMINED: "已有本次结果，待结束与报告", RESOLVED: "已提交有限报告",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "RETURN_POWERS", "WAIT_POWER_EXPIRY"];
const CONFIRM_TYPES = ["CONSUME", "CONSENT_BASIC", "CONSENT_FULL", "ENCOUNTER_FIGHT"];
const CLEANUP_TYPES = ["RETURN_TOKEN", "EXIT_HOST", "RETURN_TO_START", "CLOSE"];
const SCENE_TYPES = [...CLEANUP_TYPES, "WALK_ROUTE", "TAKE_TOKEN", "STEP_TO_CHAIR", "STAND_UP", "RELEASE_THOUGHT"];

/** Original S5 people, bodies and results remain historical facts, never a new ability inventory. */
export function ParasiteDreamStealerHistory({ dreamStealer: value }: { dreamStealer: DreamStealerProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="窃梦家时期的经历">
    <h3>窃梦家时期的经历</h3>
    <p className="slice-notice">这里保留窃梦家时期的原人物、原椅、原木片、实际动作、恢复和独立原瓶，只供回看。旧实践不重新结算，旧同意不延续为当前寄生许可。</p>
    <p>窃梦家扮演进度 {value.acting} · 消化：{value.digestion}</p>
    {value.practice && <section aria-label="窃梦家原身体与原物"><h4>当时的身体、目标与原木片</h4>
      <dl className="seer-facts"><div><dt>本人原姿态</dt><dd>{value.practice.pose}</dd></div>
        <div><dt>原目标状态</dt><dd>{value.practice.target}</dd></div><div><dt>原木片去向</dt><dd>{value.practice.token}</dd></div></dl>
      <ul>{value.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p className="slice-muted">当时成功窃取后已由本人立即执行；晋升不会把旧动作改写为未执行的储存念头。</p>
    </section>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}
      <p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>{entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold"><summary>窃梦家原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>
    <details className="seer-fold"><summary>窃梦家能力与原故事</summary>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      {value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.supplies}</p>
    </details>
    <p className="slice-muted">更早的偷盗者、诈骗师、解密学者与盗火人经历继续保留。原教师、来源灵性、借用、使用与恢复不会重置；晋升不生成无来源法术或免费能力库存。</p>
  </section>;
}

export interface ParasitePanelProps {
  parasite: ParasiteProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ParasiteCommand) => void;
  readOnly?: boolean;
}

type Confirmation = { action: ParasiteAction; contextKey: string };

function PracticeFacts({ practice }: { practice: NonNullable<ParasiteProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="寄生者实际身体同意与原物" aria-live="polite" aria-atomic="true">
    <h4>当前身体、同意与原物</h4>
    <dl className="seer-facts">
      <div><dt>当前成年参与者</dt><dd>{practice.host}</dd></div>
      <div><dt>本次独立同意</dt><dd>{practice.consent}</dd></div>
      <div><dt>当前寄生阶段</dt><dd>{practice.mode}</dd></div>
      <div><dt>本人及宿主的实际位置</dt><dd>{practice.location}</dd></div>
      <div><dt>宿主当前知觉</dt><dd>{practice.awareness}</dd></div>
      <div><dt>身体当前由谁控制</dt><dd>{practice.control}</dd></div>
      <div><dt>唯一原木片</dt><dd>{practice.token}</dd></div>
      <div><dt>具体待执行念头</dt><dd>{practice.thought}</dd></div>
      <div><dt>实际准备与退出代价</dt><dd>{practice.cost}</dd></div>
    </dl>
    <p>初步寄生只共享当前实际视听，不能直接读取或干涉宿主思想；沟通仍须借宿主声音。完全寄生的身体控制只用于本次另行同意的原木片任务。</p>
    <p>进入后不保留一个在外活动的第二身体，不复制装备。宿主走到哪里，共同接触就实际位于哪里；须先归还原物、实际协助分离，再按当前位置步行返回。关闭页面不会分离或把身体送回原点。</p>
    {practice.history.length > 0 && <details className="seer-fold"><summary>实际接触、动作与恢复记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

function EncounterFacts({ encounter }: { encounter: NonNullable<ParasiteProjection["encounter"]> }) {
  const powerLabel = (id: string) => encounter.abilities.find((ability) => ability.id === id)?.label ?? id;
  const status: Record<string, string> = { AVAILABLE: "尚未解决", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已实际退出", LOST: "本人已死亡" };
  const outcomeLabel: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原出口撤退", ENEMY_DEAD: "原对手死亡", ENEMY_SURRENDERED: "原对手自行停止抵抗" };
  const powerStatus: Record<string, string> = { STORED: "仍可实际施放", USED: "已施放，期限内仍可按实际成本使用", RETURNED: "已主动结束暂窃", EXPIRED: "已实际到期" };
  return <section aria-label="寄生者原对手与实际能力来源">
    <p>{encounter.story}</p>
    <dl className="seer-facts"><div><dt>同一原对手</dt><dd>{encounter.name} · {encounter.age}岁 · 序列{encounter.sequence} · {encounter.targetId}</dd></div>
      <div><dt>原争执状态</dt><dd>{status[encounter.status] ?? encounter.status}</dd></div>
      <div><dt>原身体健康与精神</dt><dd>{encounter.enemyHealth} / {encounter.enemyMind}</dd></div>
      <div><dt>原对手剩余灵性</dt><dd>{encounter.enemySpirituality}</dd></div>
      <div><dt>唯一原短棍</dt><dd>{encounter.weapon.id} · 原主 {encounter.weapon.owner} · {encounter.weapon.location === "HAND" ? "仍在原主手中" : "留在原庭院地面"}</dd></div>
      <div><dt>实际现场时间</dt><dd>{encounter.elapsedSeconds}秒</dd></div>
      <div><dt>实际退出路线</dt><dd>{encounter.originalExit} · 无追逐</dd></div>
    </dl>
    <details className="seer-fold"><summary>来源能力、实际观察与禁用状态</summary>
      <ul>{encounter.abilities.map((ability) => <li key={ability.id}>{ability.label} · {ability.cost}灵性 · {ability.seen ? "已实际观察" : "尚未实际观察"} · {ability.disabled ? "当前被暂窃，来源不能使用" : "当前未被暂窃禁用"}</li>)}</ul>
      <p>这是原对手自身的有限能力来源，不是你的已获能力。原对手支付其实际灵性；不补满、不重置，失能时只能使用实际仍可用的行动。</p>
    </details>
    <section className="slice-notice" aria-label="寄生者实际暂窃能力与期限"><h4>这一个来源的实际暂窃记录</h4>
      {encounter.borrowed.length === 0 ? <p>目前没有从此原目标取得的能力。三种上限是容量，不是免费库存。</p> : <ul>{encounter.borrowed.map((power) => <li key={power.id}>
        <strong>{powerLabel(power.abilityId)}</strong> · {power.id} · 原来源 {power.sourceId}<br />
        第{power.acquiredRound}回合、现场{power.acquiredSeconds}秒实际取得 · 现场{power.expiresSeconds}秒到期 · {powerStatus[power.status] ?? power.status}<br />
        {power.usedRound === null ? "尚未实际施放" : `最近第${power.usedRound}回合实际施放，累计${power.uses}次`} · {power.closedSeconds === null ? "来源禁用尚未收束" : `现场${power.closedSeconds}秒已收束`} · {power.restoredToSource ? "同一存活来源已恢复能力，灵性不补满" : power.closedSeconds === null ? "来源尚未恢复该能力" : "没有使死亡来源复活或恢复施法"}
      </li>)}</ul>}
      <p>{playerText("每次窃取只处理一个实际能力，同一来源至多三种不同能力。场景秒数、暂窃施放与主动结束是本作G的有限实现；不会复制重复能力或把当前念头变成法术。")}</p>
    </section>
    {encounter.thoughts.length > 0 && <details className="seer-fold"><summary>实际压下的当前动作念头</summary>
      <ul>{encounter.thoughts.map((thought, index) => <li key={index}>第{thought.round}回合 · {powerLabel(thought.action)} · {thought.status === "DISCARDED" ? "本次动作被压下后已释放，未自动执行或取得能力" : "当前具体动作暂未执行"}</li>)}</ul>
    </details>}
    {encounter.terminal && <p className="slice-notice">原战斗第{encounter.terminal.round}回合结束：{outcomeLabel[encounter.terminal.outcome] ?? encounter.terminal.outcome}。当时原对手健康{encounter.terminal.enemyHealth}、精神{encounter.terminal.enemyMind}、灵性{encounter.terminal.enemySpirituality}；原身体结局与借用记录均保留。</p>}
  </section>;
}

/** Render only committed public facts; every submitted command is the original projected intent. */
export function ParasitePanel({ parasite: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: ParasitePanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const locked = busy || blocked || error !== null || readOnly;
  const confirmationLocked = locked || submittedId !== null;
  const caseActions = value.actions.filter((action) => "caseId" in action.command);
  const preparedCase = value.cases.find((entry) => entry.status === "PREPARED");
  const currentExit = caseActions.find((action) => action.enabled && SCENE_TYPES.includes(action.command.type))
    ?? caseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const currentCaseId = currentExit && "caseId" in currentExit.command ? currentExit.command.caseId : null;
  const activeCase = preparedCase ?? (value.insideCase ? value.cases.find((entry) => entry.id === currentCaseId) : undefined);
  const selectedCase = activeCase ?? value.cases.find((entry) => entry.id === caseId)
    ?? value.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? value.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const bottleActions = value.actions.filter((action) => BOTTLE_TYPES.includes(action.command.type));
  const selectedBottle = value.bottles.find((entry) => entry.id === bottleId)
    ?? value.bottles.find((entry) => bottleActions.some((action) => action.enabled && "bottleId" in action.command && action.command.bottleId === entry.id))
    ?? value.bottles[0];
  const selectedBottleActions = selectedBottle ? bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === selectedBottle.id) : [];
  const encounterActions = value.actions.filter((action) => ENCOUNTER_TYPES.includes(action.command.type));
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command) && !ENCOUNTER_TYPES.includes(action.command.type));
  const cleanupAction = CLEANUP_TYPES.map((type) => selectedCaseActions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextTaskAction = selectedCase?.status === "ACTIVE" ? selectedCaseActions.find((action) => action.enabled && ["WALK_ROUTE", "TAKE_TOKEN", "CONSENT_FULL"].includes(action.command.type)) : undefined;
  const nextAction = !value.promoted
    ? selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? [...growthActions, ...selectedBottleActions].find((action) => action.enabled) ?? value.actions[0]
    : nextTaskAction ?? (value.insideCase ? cleanupAction : undefined)
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type !== "WITHDRAW")
      ?? [...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions.find((action) => action.enabled) ?? value.actions[0];
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  function confirmationContext(action: ParasiteAction): string {
    if ("bottleId" in action.command) return JSON.stringify(value.bottles.find((entry) => "bottleId" in action.command && entry.id === action.command.bottleId));
    if ("caseId" in action.command) return JSON.stringify({ practice: value.practice, case: value.cases.find((entry) => "caseId" in action.command && entry.id === action.command.caseId) });
    return JSON.stringify(value.encounter);
  }
  const liveConfirmation = confirmation && confirmation.contextKey === confirmationContext(confirmation.action)
    ? value.actions.find((action) => action.id === confirmation.action.id && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmingConsume = confirmation?.action.command.type === "CONSUME";
  const confirmingBasic = confirmation?.action.command.type === "CONSENT_BASIC";
  const confirmingFull = confirmation?.action.command.type === "CONSENT_FULL";
  const confirmingConsent = confirmingBasic || confirmingFull;

  useEffect(() => { if (selectedCase && (activeCase || caseId === null)) setCaseId(selectedCase.id); }, [selectedCase, activeCase, caseId]);
  useEffect(() => {
    if (confirmation && (readOnly || (!busy && error === null && (!liveConfirmation
      || (submittedId !== null && !liveConfirmation.enabled) || (reviewBottleId !== null && !reviewBottle))))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, readOnly, busy, error, liveConfirmation, submittedId, reviewBottleId, reviewBottle]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function actionButton(action: ParasiteAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `parasite-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (CONFIRM_TYPES.includes(action.command.type)) {
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, contextKey: confirmationContext(action) });
          } else {
            if ("caseId" in action.command) setCaseId(action.command.caseId);
            if ("bottleId" in action.command) setBottleId(action.command.bottleId);
            onCommand(action.command);
          }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`parasite-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled || (reviewBottleId !== null && !reviewBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复服药、同意、寄生或移动原物。"}
  </p>;
  const currentResources = <section aria-label={confirmingConsume ? "服药前当前资源" : "行动前当前资源"}><h4>你现在的状态</h4>
    <dl className="seer-facts"><div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div><div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div></dl>
  </section>;
  const confirmLabel = confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」`
    : confirmingBasic ? "确认本次初步寄生同意" : confirmingFull ? "确认仅控制本次取还原木片" : "确认风险，开始真实交战";
  const cancelLabel = confirmingConsume ? "暂不服用" : confirmingConsent ? "暂不同意，返回现场" : "暂不迎战";

  if (confirmation) return <section className="seer-panel warrior-panel parasite-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶寄生者魔药的服用确认" : confirmingBasic ? "寄生者初步寄生独立确认" : confirmingFull ? "寄生者完全寄生独立确认" : "寄生者真实迎战确认"} aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : confirmingConsent ? "本次有限同意，不延续到其他任务" : "可选争执与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : confirmingBasic ? "确认共享本次实际视听" : confirmingFull ? "确认这一次原木片取还任务" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="寄生者服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{playerText("完整配方和原著仪式细节仍未知。这是原渠道专业准备、指导服用的本作原创G成品流程，不能据此断言无需仪式。确认仅饮用此原瓶，无论成败都会消耗这一瓶。")}</p>
      <p>可以暂不服用，继续窃梦家生活。药物照护的最低健康与精神保护仅覆盖服药排异，不覆盖真实战斗死亡；晋升不补满灵性，也不提供免费能力库存。</p>
    </> : confirmingConsent ? <>
      {value.practice && <PracticeFacts practice={value.practice} />}
      {confirmingBasic ? <p>托马斯·里德仅同意本次初步寄生与实际视听共享。保持他的意识和自主身体控制；不能直接读取或干涉思想，也不包含完全寄生、移动原木片或以后任何一次接触的许可。确认同意不会替代实际能力尝试。</p>
        : <p>这是托马斯·里德另行确认的完全寄生许可，仅限用他的同一身体，将他的原木片 PR4-TOKEN-1 从原桌拿到手中，再归还原桌。不扩展为随意行动、永久控制或新任务许可。</p>}
      <p>{playerText("可以取消并选择普通观察。付费安全准备与协助分离均是本作原创G的有限现场措施，不保证任意宿主或任意情境都能无痛安全退出。")}</p>
    </> : <section className="slice-notice seer-risk" aria-label="寄生者真实争执风险"><h4>可能重伤或死亡</h4>
      <p>{playerText("原拉尔夫·托伦是本作原创G的成年序列6风眷者，有实际法术、原木棍和有限灵性。也可以先沟通解决；开战不保证窃取成功或对手投降。")}</p>
      <p>窃取当前念头不会附送执行它所需的能力。每次能力窃取最多取得一个实际来源能力，同一目标至多保存三种不同能力；必须支付自己的实际施放成本。退场、失效和来源恢复保留实际记录。</p>
      <p>本场不提供任意敌人寄生；普通伤势、撤退和死亡照常结算，药物照护不保护实战。</p>
    </section>}
    {currentResources}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="parasite-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{cancelLabel}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "parasite-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmLabel}</button></div>
    <p className="slice-muted">取消不会消耗原瓶、改变同意或移动身体。保存未确认时保留这一次操作，等待原保存重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel parasite-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="寄生者成长下一步"><span className="seer-seal">{value.promoted ? "寄生者4" : "窃梦家5 → 寄生者4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    <section className="slice-notice" aria-label="寄生者配方与成品边界"><h4>未知配方与独立成品</h4>
      <p>{playerText("完整配方、材料、用量、调配顺序与原著晋升仪式细节仍未知，配方保持空白。本阶段使用有来源的原创G专业准备与指导服用流程，不表示原著无需仪式。")}</p>
      <p>指导、原室劳务、付款取得原瓶与独立服用分别进行。每瓶全价6800便士；完成五次真实劳务抵5300便士后，仍须支付1500便士。可以继续窃梦家生活，不必立即晋升。</p>
    </section>
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="寄生者指导与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <details className="seer-fold" open><summary>独立原瓶与实际供给</summary>
      <section aria-label="寄生者原瓶供给"><p>{value.supplies}</p>
        <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立寄生者原瓶" value={selectedBottle.id} disabled={locked}
          onChange={(event) => setBottleId(event.target.value)}>{value.bottles.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
        <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
        <div className="warrior-action-list" role="group" aria-label="当前原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
      </section>
    </details>}
    {value.promoted && selectedCase && <section aria-label="寄生者有限生活实践"><h3>有限寄生与延迟念头实践</h3><p>{value.environment}</p>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前寄生者生活实践" value={selectedCase.id} disabled={locked || !!activeCase || value.insideCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        <section aria-label="寄生者当前已知现场"><h5>已经观察到的现场</h5>{selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}</section>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {value.practice && <PracticeFacts practice={value.practice} />}
        {selectedCase.id === "deferred-seat" && <section className="slice-notice" aria-label="寄生者延迟念头选择"><h5>何时呈现，由你决定</h5>
          <p>只窃取艾莉丝·伍德眼前实际准备坐下的具体念头。成功后本人仍站着；可以在原椅与位置条件安全时，选择稍后执行，也可以选择不执行并释放。目标之后恢复决定。</p>
          <p>{playerText("实际选择须使用下方当前公开行动；等待、切换页面或报告都不会自动替你坐下。延迟操作、现场恢复与安全条件是本作原创G，不构成永久删除人格或从无思想傀儡取得念头。")}</p>
        </section>}
        {selectedCase.result && <section className="slice-notice" aria-label="寄生者实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前寄生者生活行动">{selectedCaseActions.map(actionButton)}</div>
      </section>
      <p className="slice-muted">观察、准备、尝试与报告分别支付真实行动；普通观察路线不耗灵性，也不假称发生寄生。能力失败保留实际成本，下一个真实周再尝试。实际分离、归还原物与按当前位置返回须先于报告。</p>
    </section>}
    {value.promoted && <section aria-label="寄生者可选争执"><h3>原庭院的可选争执</h3>
      {value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="寄生者交谈或真实迎战">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="寄生者能力与消化"><h3>能力与消化</h3>
      <progress className="cryptologist-progress" aria-label="寄生者扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">新增寄生与延迟念头掌握从0开始，原能力与来源不重置。能力窃取一次一项，同一目标至多三种不同能力；熟悉程度影响选择，空位不会产生法术。下一序列是欺瞒导师3，本阶段不开放命运、身份窃取或天使分身。</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>寄生者原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
      <p>已耗尽的原瓶不复原，未服原瓶仍按原状态保留；不会重复服药或把旧原瓶改装成新药。</p>
    </details>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>{playerText("托马斯、艾莉丝、监督者、原木片、原椅、四米路线、80便士安全准备、退出协助、资源成本、检定与战盘数值均为本作原创G。长期寄生动物可能影响身份认同和生理习惯，本阶段不模拟动物宿主。")}</p>
      <p>初步视听共享与完全寄生的读意、身体控制须区分；本次同意不会成为通用占有许可。延迟念头不附送能力，也不采用火种手套的负面效果或独立时限作为寄生者通则。</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
