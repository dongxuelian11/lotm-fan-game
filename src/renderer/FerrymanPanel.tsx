import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { FerrymanAction, FerrymanCommand, FerrymanProjection } from "../domain/ferryman/types";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "本次尚未当面询问", GRANTED: "已当面同意本次有限用途", DECLINED: "已拒绝本次用途", REVOKED: "本次同意已撤回", CLOSED: "本次许可已结束" };
const LOCATION: Record<string, string> = { UNWRITTEN: "尚未写成", EXIT: "原普通出口", START: "玛拉接待起点", NEAR: "原近端", FAR: "伊兰原远端", MARA: "玛拉本人处", ILAN: "伊兰本人处", REED: "同一原芦羽处", PLAYER: "本人手中", BOX: "同一原封存盒" };
const failedTier = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
const isEraAction = ({ command }: FerrymanAction) => command.type.startsWith("ERA_");
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP", "STOP_EFFECT", "STOP_CONTACT", "RETURN_PLAYER", "RETURN_ITEMS", "INSPECT", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const isExit = ({ command }: FerrymanAction) => EXIT_TYPES.has(command.type);
type Confirmation = { action: FerrymanAction; bottle: FerrymanProjection["bottles"][number]; facts: string };

export interface FerrymanPanelProps {
  value: FerrymanProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: FerrymanCommand) => void;
  /** Dismissing the view does not return an original object or leave the actual scene. */
  onClose?: () => void;
}

function confirmationFacts(value: FerrymanProjection, action: FerrymanAction) {
  return JSON.stringify({ promoted: value.promoted, preparations: value.preparations, preparedWeek: value.preparedWeek,
    bottles: value.bottles, resources: value.resources, risk: value.risk, digestion: value.digestion,
    currentGender: value.currentGender, currentChannel: value.currentChannel, era: value.era, action: { id: action.id, cost: action.cost, command: action.command } });
}

/** Public saved facts and typed intents are the only source of scene and resource changes. */
export function FerrymanPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: FerrymanPanelProps) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const locked = busy || blocked || error !== null || submittedId !== null;
  const publicFacts = JSON.stringify(value);
  const liveConfirmation = confirmation ? value.actions.find(action => action.id === confirmation.action.id
    && confirmationFacts(value, action) === confirmation.facts) : undefined;
  const selectedBottle = value.bottles.find(bottle => bottle.id === bottleId)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && "bottleId" in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const { life, encounter } = value;
  const selectedCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === "PREPARED")
    ?? life.cases.find(entry => entry.id === caseId)
    ?? life.cases.find(entry => entry.status !== "RESOLVED") ?? life.cases[0];
  const attempt = life.currentAttempt ?? selectedCase?.attempts.at(-1) ?? null;
  const acquisitionActions = value.actions.filter(action => ACQUISITION_TYPES.has(action.command.type)
    && (!("bottleId" in action.command) || action.command.bottleId === selectedBottle?.id));
  const eraActions = value.actions.filter(isEraAction);
  const encounterActions = value.actions.filter(action => ENCOUNTER_TYPES.has(action.command.type));
  const lifeActions = value.actions.filter(action => !isEraAction(action) && !ACQUISITION_TYPES.has(action.command.type) && !ENCOUNTER_TYPES.has(action.command.type)
    && (!("caseId" in action.command) || action.command.caseId === selectedCase?.id));
  const currentActions = encounter.inside ? encounterActions : value.promoted ? lifeActions : acquisitionActions;
  const nextAction = currentActions.find(action => action.enabled && action.command.type === "CONSUME")
    ?? currentActions.find(action => action.enabled && !isExit(action))
    ?? currentActions.find(action => action.enabled) ?? eraActions.find(action => action.enabled) ?? currentActions[0];
  const immediateActions = currentActions.filter(action => action.enabled || action === nextAction);
  const exitActions = immediateActions.filter(isExit);
  const unavailableActions = currentActions.filter(action => !immediateActions.includes(action));

  useEffect(() => { summaryHeading.current?.focus(); }, []);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== publicFacts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); setCaseId(null); setBottleId(null);
      summaryHeading.current?.focus();
    }
    if (confirmation && submitted.current === null && !busy && error === null && !liveConfirmation) setConfirmation(null);
  }, [publicFacts, busy, error, confirmation, liveConfirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function submit(action: FerrymanAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: FerrymanAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const selectedId = action.command.bottleId;
      const bottle = value.bottles.find(entry => entry.id === selectedId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id;
      setConfirmation({ action, bottle, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  function actionList(actions: FerrymanAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `ferryman-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`ferryman-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="摆渡人当前资源"><h4>当前实际资源</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{value.pollution}</dd></div>
        <div><dt>现金</dt><dd>{current.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
      </dl>
    </section>;
  }
  // Scene and encounter facts use only the saved public projection.
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="摆渡人原人遭遇"><h4>{encounter.title}</h4>
      {enemy && <>
        <p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 本场原创G序列")}{enemy.sequence}等效。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {enemy.status === "DEAD" ? "已经真实死亡" : enemy.status === "SURRENDERED" ? "已投降停止抵抗" : "仍有独立意志"}。</p>
        <p>自己的原棍 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原干燥院场"}。新罗温与旧欧文分别保存，不是旧人复活。</p>
      </>}
      <p>双方原身体相距2米，原普通出口开放，无追逐。同一原芦羽与原灰羽都不会免费参战。</p>
      {encounter.scene && <p>原场地 {encounter.scene.courtId} · 普通出口{encounter.scene.ordinaryExit === "OPEN" ? "开放" : "不可通行"} · 当前第三人 {encounter.scene.thirdPartiesInArea} 人。
        {encounter.scene.clearanceConfirmed ? "已实际确认他人均在作用范围外。" : "尚未实际确认净空，不把计划当作已完成的检查。"}</p>}
      <details className="seer-fold"><summary>本场范围与战斗代价</summary>
        <p>{encounter.story}</p>
        {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
        <p>有限摆渡6灵性、离程屏护6灵性；继承死者之语6灵性、冥界封印6灵性。各用实际掌握，资源不足仅普通0灵性回退；检验失败照耗，伤势与死亡仍由共同轮盘结算。</p>
        <p>{playerText("新罗温自有灵体干扰与屏护技巧为本作G。有限迟滞与屏护只减势，不把活人移过通道、不控制人格、不直接扣健康或精神，也不强制投降。普通死亡不会周期复活。")}</p>
      </details>
    </section>;
  }
  function attemptFacts(entry: NonNullable<FerrymanProjection["life"]["currentAttempt"]>, index: number) {
    return <article key={index}>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "能力辅助后实际完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"} · {entry.closed ? "本次已收束" : "本次尚未收束"}。</p>
      {entry.abilityTier && <p>本案唯一能力判定：{TIER[entry.abilityTier]}。{failedTier(entry.abilityTier) && "失败与实付成本保留，不能重骰；仍可普通完成或退出。"}</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人普通行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}。</p>
      <p>同一原芦羽实际行程 {entry.spiritTravelMetres} 米 · 实付精力 {entry.spiritEnergySpent} · 原灵材实耗 {entry.materialsSpent} 份 · 原封条实耗 {entry.sealSpent} · 原夹具磨损 {entry.clampWear}。</p>
      {entry.spiritCrossed && <p>{entry.passageBenefit ? "本次窗口内的有限通道已实际承载同一原灵。" : "本次原灵实际自愿沿普通迂回道行走，没有获得通道收益。"}</p>}
      {entry.jarSealed && <p>{entry.sealBenefit ? "本次暂静窗口确实协助原盖封存。" : "本次用原夹具普通合盖封存；不算能力实际成功。"}原回响本质未消灭。</p>}
      {entry.playerMoves.length > 0 && <ul>{entry.playerMoves.map((move, n) => <li key={n}>本人{LOCATION[move.from]} → {LOCATION[move.to]}：{move.metres}米、{move.seconds}秒。</li>)}</ul>}
      {entry.stopped && <p>本次能力已实际停止；原灵与原物仍按真实位置收束。</p>}
      <p>{entry.inspected ? "已实际检查原灵、原物与普通出口。" : "尚未完成最终检查。"}</p>
    </article>;
  }
  function sceneFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    const owner = selectedCase.id === "quiet-jar" ? life.ilan : life.mara;
    return <section aria-label="摆渡人原灵原物与普通退路"><h4>当前原灵、原物与实际位置</h4>
      <p>本人在{LOCATION[life.playerLocation]} · 本人累计实际行走 {life.playerTravelMetres} 米 · 原现场累计 {life.clockSeconds} 秒。</p>
      <p>{owner.name} · {owner.age}岁 · {owner.id} · 本人在{LOCATION[owner.location]}。本次原主许可：{attempt ? CONSENT[attempt.ownerConsent] : "尚无本次已保存许可"}。{!owner.willing && "原主当前不愿继续。"}</p>
      <p>原普通门 {life.door.id} · {life.door.state === "OPEN" ? "实际开放" : "已阻塞，不能声称已走过"}。关闭页面不代替本人离场。</p>
      {selectedCase.id !== "quiet-jar" ? <section aria-label="同一原芦羽与两封独立原纸"><h4>同一原灵，本次重新询问意愿</h4>
        <p>{life.reed.name} · {life.reed.id} · 当前在{LOCATION[life.reed.location]} · 剩余精力 {life.reed.energy} · 累计实际行程 {life.reed.travelMetres} 米。
          本次原灵许可：{attempt ? CONSENT[attempt.spiritConsent] : "尚无本次已保存许可"}。{!life.reed.willing && "它当前不愿继续，可以留在实际端点，不强制召回。"}</p>
        <p>同一原信签 {life.tag.id} · 数量 {life.tag.quantity} · 在{LOCATION[life.tag.location]} · 实际累计行程 {life.tag.travelMetres} 米。</p>
        <p>独立原回信 {life.reply.id} · {life.reply.written ? `已实际写成，数量${life.reply.quantity}，在${LOCATION[life.reply.location]}` : "尚未实际写成，不能领取或交付"} · 实际累计行程 {life.reply.travelMetres} 米。</p>
        <p>{attempt?.endpointsChecked ? "本次已实际核对两原端点。" : "本次尚未实际核对两原端点。"}
          {attempt?.spiritCrossed ? "本次原灵已经真实过路，本人仍须独立普通步行。" : "本次原灵尚未过路；开通道成功不等于已经移动原灵。"}</p>
        {selectedCase.id === "passage-out" && <p>{attempt?.tagDelivered ? "本次伊兰已收到同一原信签；芦羽留实际FAR。" : "本次原信签尚未由伊兰实际接收。"}</p>}
        {selectedCase.id === "passage-return" && <p>{attempt?.replyDelivered ? "本次玛拉已收到同一原回信；芦羽只回当地栖处。" : "本次原回信尚未由玛拉实际接收。"}上次同意不沿用为本次返程同意，原信签不会变成原回信。</p>}
        <p>原灵材 {life.materials.id} · 剩余 {life.materials.remaining} 份。原灵精力与两份原灵材不会因关闭、休整或换案回满。</p>
      </section> : <section aria-label="同一原罐与暂静后的原回响"><h4>原回响仍在，暂静与封存分别保存</h4>
        <p>原罐 {life.jar.id} · 原主 {life.ilan.name} · 数量 {life.jar.quantity} · 在{LOCATION[life.jar.location]} · 原盒 {life.jar.boxId}。</p>
        <p>有限本地超自然回响 · 当前躁动 {life.jar.agitation} · 原回响强度 {life.jar.residualEcho}。
          {life.jar.lidClosed ? "同一原盖已经合上。" : "同一原盖尚未合上。"}{life.jar.sealed ? "同一原罐已经封存。" : "同一原罐尚未封存。"}</p>
        <p>原封条 {life.seal.id} · 剩余 {life.seal.remaining} · 原夹具 {life.clamp.id} · 耐久 {life.clamp.durability}。</p>
        <p>{attempt?.jarQuieted ? "本次确曾短暂压低躁动；停止或过期后仍恢复为2。" : "本次尚无短暂压低原躁动的成功记录。"}封存不等于净化或消灭，不是亡者复活或现实病原处理。</p>
      </section>}
      {attempt && <section aria-label="摆渡人本次实际时间窗"><h4>本次有限作用</h4>
        <p>{attempt.effectActive ? `本次作用仍在持续，剩余${attempt.effectRemainingSeconds}秒。` : attempt.effectExpired ? "本次20秒窗口已实际耗尽。" : attempt.effectStopped ? "本次作用已经主动停止。" : "当前没有持续中的能力窗口。"}
          这里显示已保存的实际秒数，页面等待不会自行施术、移动或归还原物。</p>
        <p>{selectedCase.id === "quiet-jar" ? "窗口不足时按当前原夹具、原封条条件普通封存；原回响不会凭空消失。" : "通道关闭或过期不传回原灵；未过路仍可在当前自愿和实际条件满足时沿16米普通迂回。"}</p>
      </section>}
      <details className="seer-fold"><summary>本次来源、两端点与普通路线</summary>
        <p>中转室 FR3-TRANSFER-HOUSE · {life.channelId === "POST_CYCLE" ? "首次周期后的当前渠道" : life.channelId === "ORIGINAL" ? "原时代当前渠道" : "尚无实际渠道登记"}
          {life.introducedWeek !== null && ` · 实际接触第${life.introducedWeek}周`}
          {life.introducedDate && ` · ${life.introducedDate.year}年${life.introducedDate.month}月${life.introducedDate.day}日`}。</p>
        <p>{life.mara.name}（{life.mara.id}，{life.mara.age}岁）在{LOCATION[life.mara.location]}；{life.ilan.name}（{life.ilan.id}，{life.ilan.age}岁）在{LOCATION[life.ilan.location]}。这些是本次渠道时期实际接触的原人，不是已等候六十年的旧人。</p>
        <p>{life.reed.id}来源于当前中转室登记的同一当地友善灵（{life.reed.source}），不是原灰羽或玩家已故亲人，不自动成为战宠。</p>
        <p>原近端 {life.endpoints.nearId}：{life.endpoints.nearIntact ? "完好" : "已毁损"}；原远端 {life.endpoints.farId}：{life.endpoints.farIntact ? "完好" : "已毁损"}。两端相距 {life.endpoints.distanceMetres} 米，灵体普通迂回 {life.endpoints.ordinarySpiritRouteMetres} 米。</p>
        <p>本人START到NEAR普通4米，NEAR到FAR普通6米，START到FAR普通10米。原门与端点须实际可用，不能把计划当作检查或把阻塞当作已通过。</p>
      </details>
      {attempt && <details className="seer-fold" open={failedTier(attempt.abilityTier) || attempt.refused || attempt.stopped}>
        <summary>本次实际尝试与已付代价</summary><section aria-label="摆渡人本次尝试与代价">{attemptFacts(attempt, 0)}</section>
      </details>}
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、展示、取还原物或服药。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation ferryman-panel"
    aria-label="摆渡人原瓶服用确认" aria-busy={busy || submittedId !== null}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmation.bottle.title}</h3>
    <p>原瓶：{confirmation.bottle.id}</p><p>来源：{confirmation.bottle.source}</p><p>{confirmation.bottle.status}</p>
    {value.currentChannel && <p>当前渠道：{value.currentChannel.provider} · {value.currentChannel.introduced}</p>}
    <p>当前成功率 {confirmation.bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
    <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。摆渡人序列3已有原文依据；完整配方与原著晋升仪式仍未核，本次采用独立成品与专业准备G。")}</p>
    <section className="slice-notice seer-risk" aria-label="摆渡人服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
    <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不退。失败后须实际恢复、筹另一独立原瓶，并重新检查场地。</p>
    <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶身体性别不改变，旧伤势与能力掌握保留；灵性上限120，当前灵性不补满。已经发生的原周期与原欧文、原灰羽、原伊芙琳和原物历史不因晋升改写；不获得即时战斗复活。</p>
    {resources()}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="ferryman-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
      <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "ferryman-confirm-reason" : undefined}
        onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
    </div>
    <p className="slice-muted">返回只取消未提交的确认，不代替实际退出准备。提交后等待同一次保存回执，失败时保留这一原意图。</p>
    {pendingNotice}{saveNotice}
  </section>;

  return <section className="seer-panel warrior-panel ferryman-panel" aria-label="摆渡人" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="摆渡人当前目标">
      <span className="seer-seal">{value.promoted ? playerText("摆渡人 · 死神序列3（有限往返G）") : "不死者4 → 摆渡人3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.resources?.health === 0 || encounter.status === "LOST" ? "本周目已经死亡，原记录只读保留。"
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}</p>
      {value.promoted && <p>已进入序列3，旧六十年周期诅咒不再触发；实际周期历史仍保留，普通战斗死亡不会复活。</p>}
      <p className="slice-muted">{playerText("序列3摆渡人，下一阶段为序列2死亡执政官。达到成长条件后，可查看下一阶段的独立准备。")}</p>
    </section>
    {resources()}
    <section aria-label="当前摆渡人渠道"><h4>本次实际渠道</h4>
      {value.currentChannel ? <>
        <p>{value.currentChannel.id === "POST_CYCLE" ? "首次周期后的当前渠道" : "原时代当前渠道"} · {value.currentChannel.provider}</p>
        <p>{value.currentChannel.introduced}</p>
        <p>本渠道知识指导 {value.currentChannel.prices.guidance} 便士 · 独立原瓶 {value.currentChannel.prices.potion} 便士，或每瓶五次实际劳务后 {value.currentChannel.prices.potion - value.currentChannel.prices.labourCredit} 便士 · 本周场地准备 {value.currentChannel.prices.preparation} 便士。</p>
      </> : <p>尚未建立本时代的实际供应约定；按公开介绍选项接触当前来源。</p>}
      <p className="slice-muted">{value.guidanceKnown ? "已学指导知识保留。新渠道实际介绍仍需1行动，不再收取同一知识费；旧劳动与旧准备不转给新原瓶。" : "实际介绍需1行动，并支付当前公开知识费；尚未到场的人与原瓶不能当作已取得。"}</p>
    </section>
    {!value.promoted && selectedBottle && <section aria-label="当前独立摆渡人原瓶"><h4>本次原瓶</h4>
      <label>选择独立摆渡人原瓶<select aria-label="选择独立摆渡人原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前摆渡人生活情境">
      <label>选择摆渡人生活情境<select aria-label="选择摆渡人生活情境" disabled={locked || life.insideCase || life.cases.some(entry => entry.status === "PREPARED")} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.method && <p>本次已保存准备：{selectedCase.method === "ABILITY" ? "能力方法" : "普通方法"}。</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施与报告各1行动；准备前须留足2行动。现场子步0行动，仍记录实际时间、位置、资源与原物后果。</p>
    </section>}

    {value.promoted && encounter.inside && encounterFacts()}
    <section aria-label="摆渡人当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {immediateActions.length ? actionList(immediateActions.filter(action => !isExit(action)), "摆渡人公开行动") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {exitActions.length > 0 && <section aria-label="摆渡人停止与普通收束"><h4>归还原物与普通退出</h4>
        {actionList(exitActions, "摆渡人零行动收束")}
        <p className="slice-muted">按公开选项0行动归还、检查并沿实际路线退出；已付灵性、同一原灵精力、灵材与封条损耗不退。关闭页面不会代替这些动作。</p>
      </section>}
      {unavailableActions.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>
        {actionList(unavailableActions, "摆渡人尚不可提交的步骤")}
      </details>}
    </section>

    {value.promoted && !encounter.inside && sceneFacts()}

    {value.era.available && <section aria-label="当前时代生活"><h4>当前时代的工作与休整</h4>
      <p>{value.era.current}</p><p>当前实际地点：{value.era.location}</p>
      <p>{value.era.economy}</p>
      {actionList(eraActions.filter(action => action.enabled), "摆渡人当前时代可用行动")}
      {eraActions.some(action => !action.enabled) && <details className="seer-fold"><summary>当前生活的未满足条件</summary>
        {actionList(eraActions.filter(action => !action.enabled), "摆渡人当前时代尚不可用行动")}
      </details>}
      <details className="seer-fold"><summary>离开居所时的记录与本章实际收支</summary>
        <section aria-label="完成居所的历史余额"><h4>历史离开记录，不是当前资源</h4>
          <ul>{value.era.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
          <ul>{value.era.counters.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
          <p>居所已经完成交接，旧时代保持关闭。只有本章的实际工作、休整和付费周结更新当前生活；查看或关闭历史页面不会重新进入旧居所。</p>
        </section>
      </details>
    </section>}

    {value.promoted && <details className="seer-fold"><summary>三项实践的原观察与结果</summary>
      <section aria-label="摆渡人生活记录">{life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4>
        <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束现场"}。</p>
        {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
        {entry.attempts.map(attemptFacts)}
      </article>)}<p>{life.environment}</p></section>
    </details>}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary>
      <section aria-label="摆渡人成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
        <p>{playerText("当前渠道只提供有来源的成品魔药，不提供完整配方、材料用量或自行调配步骤。晋升仍需完成专业准备；每瓶药剂、预约与准备分别结算。")}</p>
        <p>{value.supplies}</p>
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>从不死者实际晋升周起满12整周、原消化100；三项不同准备各1行动，本周场地准备另需1行动。实际指导、原瓶及场地费用以当前渠道与公开选项为准。</p>
        <p>当次准备：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}{playerText("。独立成品渠道、专业支持与以上全部数值均为本作G，不冒充原著完整配方或晋升仪式。")}</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>两个时代的渠道记录</summary>
      <section aria-label="摆渡人历史渠道"><h4>已经结束的约定与实际原瓶</h4>
        {value.channelHistory.length ? <ul>{value.channelHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul> : <p>尚无已结束的渠道记录。</p>}
        <p>原时代协议结束后，未用旧原瓶记录为已过期，已失败的原瓶仍为已耗尽；旧劳动、费用和准备历史保留。旧供应人不会被当作仍在原地等待六十年，莱娜也不被当作新的专业供应人。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>{playerText("技巧与使用范围")}</summary>
      <section aria-label={playerText("摆渡人能力与使用范围")}><h4>实际掌握与有限范围</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>{playerText("两项技巧依赖当前原灵、实际端点与已准备的材料。请先确认现场条件、当次同意与普通退路。")}</p>
        <p>有限摆渡每案一次6灵性、意志18，只引导当前自愿的同一原灵通过已核实的两个端点。离程屏护每案一次6灵性、知识18，只降低有限原回响的短时躁动；两种成功窗口均为20秒，不是复活、任意冥界传送、永久控制或人格净化。</p>
        <p>新技巧掌握只在本次实际能力成功并报告后增加8；普通完成和失败不赠能力掌握。停止、超时与普通退出不退还已付灵性、原灵精力、灵材或封条。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、实际周期与旧人旧物</summary>
      <section aria-label="摆渡人继承记录"><h4>已经发生的序列4经历只读保留</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>六十年死亡、同体复起与失忆只属于不死者序列4阶段。真正晋升3后终止旧周期诅咒，但不删除已经发生的死亡、复起、失忆与找回记录，也不给即时战斗复活。</p>
        <p>原欧文的真实结局与原棍、原灰羽的真实去向、原伊芙琳与居所保管交接均不因晋升复原。后世新供应人和本次当前原灵各有独立来源，不是旧人复活或旧灵自动召回。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>新原人的可选冲突</summary>
      {encounterFacts()}{actionList(encounterActions, "摆渡人可选遭遇行动")}
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭摆渡人页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
