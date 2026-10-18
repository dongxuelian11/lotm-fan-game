import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SecretsSorcererAction, SecretsSorcererCommand, SecretsSorcererProjection } from "../domain/secrets-sorcerer/types";
import type { TravelerProjection } from "../domain/traveler/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对当前现场", PREPARED: "已准备，尚未实际尝试",
  ACTIVE: "已有本次结果，须实际收束", EXAMINED: "已有本次结果，待结束与报告", RESOLVED: "已提交有限报告",
};
const ITEM_LOCATION: Record<string, string> = { DESK: "原教学桌", PLAYER: "本人手中", POCKET: "原空间口袋内", BAG: "原挎包普通隔层内" };
const RITUAL_TYPES = ["SURVEY_RITUAL", "PREPARE_SEAL", "START_RITUAL", "END_RITUAL", "REQUEST_NEW_LEAD", "RECEIVE_LEAD", "START_CHALLENGE"];
const ROOM_TYPES = ["EXIT_ROOM", "STOP_HIDING"];
const POCKET_TYPES = ["STORE_ITEM", "TAKE_ITEM", "RETURN_ITEM", "STOP_POCKET", "MAINTAIN_POCKET"];
const BANISHMENT_TYPES = ["SECURE_TARGET", "WAIT_RETURN", "RELEASE_RESTRAINT"];
const CLEANUP_TYPES = ["EXIT_ROOM", "WAIT_RETURN", "RELEASE_RESTRAINT", "TAKE_ITEM", "RETURN_ITEM", "STOP_HIDING", "STOP_POCKET", "CLOSE", "END_RITUAL"];
const CONFIRM_TYPES = ["START_RITUAL", "START_CHALLENGE", "CONSUME"];

/** Original S5 facts stay read-only; this page never repeats a journey or grants a record. */
export function SecretsSorcererTravelerHistory({ traveler: value }: { traveler: TravelerProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="旅行家时期的经历">
    <h3>旅行家时期的经历</h3>
    <p className="slice-notice">原四处坐标、不可控漫游后的返程、同一原卡、原米拉和原记录继续按实际经历保留。这里只回看，不重新奖励旧成长，也不重复移动任何原物或同伴。</p>
    <p>旅行家扮演进度 {value.acting} · 消化：{value.digestion}</p>
    {value.ritual && <section aria-label="旅行家原四处坐标与实际返程"><h4>原四处坐标与返程</h4>
      <p>本人实际所在：{value.ritual.at} · 原护送者当前灵性 {value.ritual.escortSpirituality}</p>
      <ul>{value.ritual.coordinates.map((site) => <li key={site.id}>{site.label}：{site.status}</li>)}</ul>
      <ul>{value.ritual.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p className="slice-muted">原护送者艾文与原序列8导师诺拉分别保留，不因晋升互换身份或恢复已耗灵性。</p>
    </section>}
    {value.practice && <section aria-label="旅行家原身体原卡与米拉"><h4>原身体、原卡与自愿同行</h4>
      <p>{value.practice.position}</p><p>{value.practice.card}</p><p>{value.practice.companion}</p>
      <ul>{value.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p className="slice-muted">旧同行约定只适用于当次实践，不代替米拉对新现场的当前同意。</p>
    </section>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary><p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold"><summary>旅行家原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>
    <details className="seer-fold"><summary>旅行家时期能力与原故事</summary>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      {value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.supplies}</p>
    </details>
    <p className="slice-muted">更早的学徒、戏法大师、占星人与记录官经历仍保留。已有记录依旧绑定实际教师与原示范，释放一份就耗尽一份；空容量不会生成半神法术。</p>
  </section>;
}

export interface SecretsSorcererPanelProps {
  secretsSorcerer: SecretsSorcererProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: SecretsSorcererCommand) => void;
}

function RoomFacts({ life }: { life: SecretsSorcererProjection["life"] }) {
  return <section className="slice-notice" aria-label="原隐藏房间与唯一实体门"><h5>同一原房间与实体门</h5>
    <p>原房间 {life.room.id} · 唯一实体门 {life.room.doorId}</p>
    <p>本人实际位置：{life.room.position === "INSIDE" ? "原房间内" : "原房间外"} · {life.room.hidden ? "原房间的一部分已实际隐藏" : "当前没有生效的空间隐藏"}</p>
    <p>{life.room.companion}</p>
    <p>空间隐藏实际分割同一原房间的一部分，出入仍须经过这扇实体门。先走出原门，再停止隐藏，最后收束实践；关闭页面不会移动身体或自动复原房间。</p>
    {life.room.history.length > 0 && <details className="seer-fold"><summary>原房间实际隐藏与出入记录</summary><ul>{life.room.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

function PocketFacts({ life }: { life: SecretsSorcererProjection["life"] }) {
  const pocket = life.pocket;
  return <section className="slice-notice" aria-label="原挎包有限口袋与三件原物"><h5>原挎包、有限坐标与三件原物</h5>
    <p>原挎包 {pocket.id} · 有限容量 {pocket.capacity} 件 · {pocket.linked ? "已建立实际空间连接" : pocket.mode === "ORDINARY" ? "当前使用原包普通隔层" : "当前没有空间连接"}</p>
    <p>固定坐标：{pocket.coordinate}</p>
    <p>{pocket.expiresWeek === null ? "尚无空间连接的维护期限。" : `原连接维护期限：第${pocket.expiresWeek}周。`}
      {pocket.expired ? "期限已过，原物仍留在口袋，须实际维护后才能继续存取。" : pocket.linked ? "跨过期限前须实际维护；不会自动补膜或续期。" : ""}</p>
    <ul>{pocket.items.map((item) => <li key={item.id}><strong>{item.title}</strong> · {item.id} · {item.owner === "ARCHIVE" ? "归原档案室" : "归玩家"} · {ITEM_LOCATION[item.location] ?? item.location}<br />{item.effect}</li>)}</ul>
    <p>{playerText("本作G口袋只容纳这三件实际原物，连接和固定坐标必须成立。原封石的弱精神嗡鸣不会被口袋抵消，每次存入或取出仍付实际代价；不是无限背包，也不能借此消除高危险封印物的负面效果。")}</p>
    <p>须逐件实际存入、取出，归还两件档案室原物，再停用空口袋。暂时撤回会保留原连接与物品位置，不会自动倒出、复制或抹去物品。</p>
    {pocket.history.length > 0 && <details className="seer-fold"><summary>原口袋存取与维护记录</summary><ul>{pocket.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

function BanishmentFacts({ life }: { life: SecretsSorcererProjection["life"] }) {
  const target = life.banishment;
  return <section className="slice-notice" aria-label="同一原回响的临时放逐与返回"><h5>同一原回响必须实际返回</h5>
    <p>原回响 {target.id} · 原封闭笼 {target.cageId}</p>
    <p>实际位置：{target.location === "AWAY" ? "暂时处于有限时空乱流中" : "仍在同一原封闭笼内"} · {target.restrained ? "已有实际物理约束" : "尚无当前物理约束"} · 剩余 {target.remainingSeconds} 秒</p>
    <p>先用原笼实际约束，再尝试临时放逐。同一原目标会返回原笼，等到返回后才解除约束；原笼始终关闭，不把敌对回响放入人群。未返回时不能报告完成，也不构成永久消灭。</p>
    <p className="slice-muted">{playerText("这是本作G低强度教学回响，不能代替晋升仪式要求的敌对半神生物。普通方法只是检查原笼，没有产生放逐。")}</p>
    {target.history.length > 0 && <details className="seer-fold"><summary>同一回响的约束、放逐与返回记录</summary><ul>{target.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

function RitualFacts({ ritual }: { ritual: SecretsSorcererProjection["ritual"] }) {
  return <>
    <h4>{ritual.targetName}</h4><p>{ritual.status}</p>
    <p>本人当前所在：{ritual.currentVisit ? "仍在本次原石拱现场，尚未沿地面出口实际离开" : "当前没有未结束的原石拱到访"}</p>
    <p>当前原目标：{ritual.currentTargetId ?? "尚未实地核实"} · {ritual.hostileVerified ? "已由本人核实明确敌意" : "敌意与位格尚待本人实地核实"}</p>
    {ritual.enemyHealth !== null && <dl className="seer-facts"><div><dt>原敌体健康</dt><dd>{ritual.enemyHealth} / 100</dd></div>
      <div><dt>原敌体精神</dt><dd>{ritual.enemyMind} / 100</dd></div><div><dt>原敌体有限灵性</dt><dd>{ritual.enemySpirituality} / 40</dd></div>
      <div><dt>本人实际受限位置标记</dt><dd>{ritual.restraintMarks} / 2</dd></div><div><dt>原敌折光</dt><dd>{ritual.refraction ? "一层当前折光仍在" : "当前没有折光层"}</dd></div></dl>}
    <section aria-label="同一原封框与有限次数"><h5>当前原封框</h5>
      <p>原框：{ritual.caseId ?? "尚未借领"} · 剩余封合次数 {ritual.charges ?? "尚无"}</p><p>{ritual.caseStatus}</p>
      <p>{ritual.equipment}</p>
    </section>
    {ritual.captureEvidence ? <section className="slice-notice" aria-label="实际活体封印证据"><h5>实际活体封印</h5><p>{ritual.captureEvidence}</p>
      <p>这是同一原敌体仍活着的封存记录，不是死亡、自动投降或新生成的替身。</p></section> : <p>当前没有本场实际活体封印证据。受伤、击杀、撤退或摆好空框都不能代替本人完成封印。</p>}
    <p>本场已经服用的原瓶：{ritual.consumedBottleId ?? "尚未服用"} · 实际交战尝试 {ritual.attempts} 次</p>
    <p className="slice-muted">奥尔德伦·维尔，63岁成年男性普通持照档案保管员，只负责借还与药物照护，不参战、不代抓。原地面出口在原兽活动边界之外；守卫留在出口外。已核原框放在石拱前2米，本人短旅行的两米侧位与返程均须实际核实。</p>
    <details className="seer-fold"><summary>原目标来源与已知去向</summary><p>{ritual.source}</p><p>{ritual.story}</p>
      <ul>{ritual.targets.map((target) => <li key={target.id}>{target.id} · {target.name} · 原场地 {target.site} · {target.status}</li>)}</ul>
      {ritual.pendingLead && <p>当前新线索：{ritual.pendingLead}</p>}
    </details>
  </>;
}

type Confirmation = { action: SecretsSorcererAction; attemptKey: string };

/** All costs, results and movement come from committed public projections. */
export function SecretsSorcererPanel({ secretsSorcerer: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: SecretsSorcererPanelProps) {
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
  const ritual = value.ritual;
  const attemptKey = `${ritual.currentTargetId ?? "none"}:${ritual.caseId ?? "none"}:${ritual.attempts}`;
  const liveConfirmation = confirmation?.attemptKey === attemptKey ? value.actions.find((action) => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmingConsume = confirmation?.action.command.type === "CONSUME";
  const confirmingChallenge = confirmation?.action.command.type === "START_CHALLENGE";
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  const caseActions = value.actions.filter((action) => "caseId" in action.command);
  const activeCase = value.life.cases.find((entry) => entry.contactOpen || entry.status === "PREPARED");
  const selectedCase = activeCase ?? value.life.cases.find((entry) => entry.id === caseId)
    ?? value.life.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? value.life.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const bottleActions = value.actions.filter((action) => ["POTION_WORK", "BUY_POTION", "CONSUME"].includes(action.command.type));
  const selectedBottle = value.bottles.find((entry) => entry.id === bottleId)
    ?? value.bottles.find((entry) => bottleActions.some((action) => action.enabled && "bottleId" in action.command && action.command.bottleId === entry.id))
    ?? value.bottles[0];
  const selectedBottleActions = selectedBottle ? bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === selectedBottle.id) : [];
  const ritualActions = value.actions.filter((action) => RITUAL_TYPES.includes(action.command.type)
    && (action.command.type !== "START_RITUAL" || action.command.bottleId === selectedBottle?.id));
  const roomActions = value.actions.filter((action) => ROOM_TYPES.includes(action.command.type));
  const pocketActions = value.actions.filter((action) => POCKET_TYPES.includes(action.command.type));
  const banishmentActions = value.actions.filter((action) => BANISHMENT_TYPES.includes(action.command.type));
  const growthActions = value.actions.filter((action) => !RITUAL_TYPES.includes(action.command.type) && !ROOM_TYPES.includes(action.command.type)
    && !POCKET_TYPES.includes(action.command.type) && !BANISHMENT_TYPES.includes(action.command.type) && !("caseId" in action.command) && !("bottleId" in action.command));
  const readyConsume = selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME");
  const cleanupAction = CLEANUP_TYPES.map((type) => value.actions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextRitualAction = ritual.currentVisit ? ritual.phase === "SEALED" && !value.promoted && readyConsume ? readyConsume
    : ritualActions.find((action) => action.enabled && action.command.type !== "END_RITUAL")
      ?? ritualActions.find((action) => action.enabled && action.command.type === "END_RITUAL") : undefined;
  const nextPreparedAction = activeCase?.status === "PREPARED" ? selectedCaseActions.find((action) => action.enabled && action.command.type === "PERFORM")
    ?? banishmentActions.find((action) => action.enabled && action.command.type === "SECURE_TARGET")
    ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW") : undefined;
  const nextAction = nextRitualAction ?? nextPreparedAction ?? (cleanupAction && (value.insideCase || value.promoted) ? cleanupAction : undefined)
    ?? [...selectedCaseActions, ...banishmentActions, ...growthActions, ...selectedBottleActions, ...ritualActions].find((action) => action.enabled)
    ?? value.actions.find((action) => action.enabled) ?? value.actions[0];
  const pendingRoom = value.life.room.hidden || value.life.room.position === "INSIDE";
  const pendingPocket = value.life.pocket.linked || value.life.pocket.items.some((item) => item.location === "POCKET" || item.location === "BAG" || (item.owner === "ARCHIVE" && item.location === "PLAYER"));
  const pendingBanishment = value.life.banishment.restrained || value.life.banishment.location === "AWAY";
  const showRoom = value.promoted && (selectedCase?.id === "hidden-room" || pendingRoom);
  const showPocket = value.promoted && (selectedCase?.id === "original-pocket" || pendingPocket);
  const showBanishment = value.promoted && (selectedCase?.id === "temporary-banishment" || pendingBanishment);

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

  function actionButton(action: SecretsSorcererAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `secrets-sorcerer-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (CONFIRM_TYPES.includes(action.command.type)) {
            if ("bottleId" in action.command && !value.bottles.some((entry) => "bottleId" in action.command && entry.id === action.command.bottleId)) return;
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null); setConfirmation({ action, attemptKey });
          } else {
            if ("caseId" in action.command) setCaseId(action.command.caseId);
            if ("bottleId" in action.command) setBottleId(action.command.bottleId);
            onCommand(action.command);
          }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`secrets-sorcerer-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled
      || (reviewBottleId !== null && !reviewBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复开战、存取原物或服药。"}
  </p>;
  const currentResources = <section aria-label={confirmingConsume ? "服药前当前资源" : "迎战前当前资源"}><h4>你现在的状态</h4>
    <dl className="seer-facts"><div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div><div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div></dl>
  </section>;

  if (confirmation) return <section className="seer-panel warrior-panel secrets-sorcerer-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶秘法师魔药的服用确认" : "秘法师真实迎战确认"} aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "封印成立后，仍由你独立选择是否饮药" : "真实敌对半神与有限原封框"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : "确认承担真实交战与死亡风险"}</h3>
    {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status}{confirmingConsume ? ` · 服用成功率 ${reviewBottle.chance}%` : " · 此次开战不会自动服用"}</p></>}
    <section className="slice-notice" aria-label="确认前的当前封印现场"><RitualFacts ritual={ritual} /></section>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      <section className="slice-notice seer-risk" aria-label="秘法师服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>确认只饮用这一独立原瓶。无论成败，原敌体仍活着封存在同一原框中；还须本人沿原地面出口离开，将原框连同原敌体交还档案保管员。不会清空原框复用，也不会把捕获改写为击杀。</p>
      <p>可以暂不服用并实际交还封框，保持旅行家5，未用原瓶仍由本人持有。药物照护的最低健康与精神保护只覆盖服药排异，不覆盖真实战斗死亡。</p>
    </> : <>
      <section className="slice-notice seer-risk" aria-label="敌对半神真实交战风险"><h4>真实交战可能重伤或死亡</h4>
        <p>原磁门折光兽达到半神等价位格且明确敌对。须主要凭自己的实际能力与已有原记录限制其位置，再用原封框尝试收容；仅打死原目标不能完成封印仪式。</p>
        <p>原封框不会替你捕捉、攻击或削弱敌人，只有有限收容次数。每次合格捕获尝试实际耗一份框能、6灵性和2精神，失败也不会返还。对手仍有真实法术和有限灵性，普通伤势与死亡照常结算，撤退也有真实风险。</p>
        <p>奥尔德伦是普通持照档案保管员，守卫均留在地面出口之外，没有外人代打或代抓。你实际持有的旧记录可用，但不会得到免费半神法术。</p>
      </section>
      <p>{confirmingChallenge ? "这是晋升后的可选实战，不构成新的晋升仪式，也不会饮药或复制敌体。" : "确认只开始这一场真实战斗，不会自动捕获或饮药。活体封印实际成功后，还须再次独立确认服用原瓶；也可以选择不服药。"}</p>
    </>}
    {currentResources}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="secrets-sorcerer-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用，返回封印现场" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "secrets-sorcerer-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : "确认风险，开始真实交战"}</button>
    </div>
    <p className="slice-muted">取消确认不会移动身体、耗用原瓶或回收原框。保存未确认时请等待原操作重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel secrets-sorcerer-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="秘法师成长下一步"><span className="seer-seal">{value.promoted ? "秘法师4" : "旅行家5 → 秘法师4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    <section className="slice-notice" aria-label="秘法师配方与封印边界"><h4>已知仪式与未知配方</h4>
      <p>{playerText("完整配方、材料、用量与调配顺序仍未知，本阶段使用有来源的原创G独立成品，配方保持空白。可以继续旅行家生活，不必立即晋升。")}</p>
      <p>晋升须主要凭自己的力量，实际封印至少半神层次且明确敌对的生物；过多外来帮助会使仪式失效。自己的实际记录属于自己的力量。某件1级封印物的推荐不是所有人必须使用同一指定物品的通则。</p>
    </section>
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="秘法师指导与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <details className="seer-fold" open={ritual.phase !== "FIGHTING"}><summary>独立原瓶与实际供给</summary>
      <section aria-label="秘法师原瓶供给"><p>{value.supplies}</p>
        <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立秘法师原瓶" value={selectedBottle.id} disabled={locked || ritual.phase === "FIGHTING"}
          onChange={(event) => setBottleId(event.target.value)}>{value.bottles.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
        <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
        <div className="warrior-action-list" role="group" aria-label="当前原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
      </section>
    </details>}
    <details className="seer-fold" open={!value.promoted || ritual.currentVisit}><summary>{value.promoted ? "可选原石拱实战与原封印经历" : "当前敌对原目标与封印准备"}</summary>
      <section aria-label="秘法师当前封印现场"><RitualFacts ritual={ritual} />
        <div className="warrior-action-list" role="group" aria-label="秘法师实际勘察准备与离场">{ritualActions.map(actionButton)}</div>
        <p className="slice-muted">尚在战斗时须通过共同战斗盘实际撤退；战斗结束后，沿原地面出口离开并交还同一封框才算收场。0行动离场不会治疗、退费、复活目标或清空已封存的原敌体。</p>
      </section>
    </details>
    {value.promoted && selectedCase && <section aria-label="秘法师有限生活实践"><h3>{value.life.title}</h3><p>{value.life.environment}</p>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前生活实践" value={selectedCase.id} disabled={locked || value.insideCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen ? "本次实际接触仍未结束" : "当前没有未结束的实际接触"}</p>
        <section aria-label="秘法师当前已知现场"><h5>已经观察到的现场</h5>{selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}</section>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {selectedCase.result && <section className="slice-notice" aria-label="秘法师实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前秘法师生活行动">{selectedCaseActions.map(actionButton)}</div>
      </section>
      <p className="slice-muted">观察、准备、尝试与报告分别支付真实行动。失败保留已经发生的成本，下一真实周才能重试。实际退出、等原目标返回与归还原物须分别完成，关闭页面不能替代收束。</p>
    </section>}
    {showRoom && <><RoomFacts life={value.life} /><div className="warrior-action-list" role="group" aria-label="原实体门退出与停止隐藏">{roomActions.map(actionButton)}</div></>}
    {showPocket && <><PocketFacts life={value.life} /><div className="warrior-action-list" role="group" aria-label="原物实际存取归还与口袋维护">{pocketActions.map(actionButton)}</div></>}
    {showBanishment && <><BanishmentFacts life={value.life} /><div className="warrior-action-list" role="group" aria-label="原回响约束返回与实际收束">{banishmentActions.map(actionButton)}</div></>}
    {value.promoted && <section aria-label="秘法师三项能力与消化"><h3>能力与消化</h3>
      <progress className="cryptologist-progress" aria-label="秘法师扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">三项新增掌握从0开始，旧能力与原记录来源保留。星之虫快速施法不等于永久无限施法，不提供免费高阶记录；下一序列是漫游者3，本阶段不开放星际旅行。</p>
    </section>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p>
      <p>{playerText("本作人物、磁门折光兽、房间、封框、原物、距离、次数、维护期限、成本、检定与战盘数值均为原创G。原教师仍按自己的真实序列、灵性与当次示范提供记录，不因玩家晋升成为无限来源。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
