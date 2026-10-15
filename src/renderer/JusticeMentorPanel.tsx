import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { JusticeMentorAction, JusticeMentorCommand, JusticeMentorProjection } from "../domain/justice-mentor/types";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "本次尚未当面询问", GRANTED: "已当面同意本次有限用途", DECLINED: "已拒绝本次用途", REVOKED: "本次同意已撤回", CLOSED: "本次许可已结束" };
const LOCATION: Record<string, string> = { EXIT: "原入口与普通出口", START: "原箱起点", BENCH: "原主人接收台", TABLE: "原核读与试验台", SIDE: "四米普通廊道外侧", OWNER: "原主人处", PLAYER: "本人手中", BOX: "同一原封存盒" };
const GLYPH: Record<string, string> = { OLD_BAY: "OLD_BAY（旧库位）", SECOND_SHIFT: "SECOND_SHIFT（第二班）" };
const HYPOTHESIS: Record<string, string> = { MISSING_ITEM: "可能涉及遗失物", REASSIGNED: "旧牌调到备用箱" };
const failedTier = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["RETURN_HELPERS", "STOP_EFFECT", "STOP_CONTACT", "SEAL_SAMPLE", "INVITE_SPIRIT_RETURN", "RETURN_PLAYER", "RETURN_ITEMS", "INSPECT", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const isExit = ({ command }: JusticeMentorAction) => EXIT_TYPES.has(command.type);
type Confirmation = { action: JusticeMentorAction; bottle: JusticeMentorProjection["bottles"][number]; facts: string };

export interface JusticeMentorPanelProps {
  value: JusticeMentorProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: JusticeMentorCommand) => void;
  /** Dismissing the view does not return an original object or leave the actual scene. */
  onClose?: () => void;
}

function confirmationFacts(value: JusticeMentorProjection, action: JusticeMentorAction) {
  return JSON.stringify({ promoted: value.promoted, preparations: value.preparations, preparedWeek: value.preparedWeek,
    bottles: value.bottles, resources: value.resources, risk: value.risk, digestion: value.digestion,
    currentGender: value.currentGender, action: { id: action.id, cost: action.cost, command: action.command } });
}

/** Public saved facts and typed intents are the only source of scene and resource changes. */
export function JusticeMentorPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: JusticeMentorPanelProps) {
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
  const encounterActions = value.actions.filter(action => ENCOUNTER_TYPES.has(action.command.type));
  const lifeActions = value.actions.filter(action => !ACQUISITION_TYPES.has(action.command.type) && !ENCOUNTER_TYPES.has(action.command.type)
    && (!("caseId" in action.command) || action.command.caseId === selectedCase?.id));
  const currentActions = encounter.inside ? encounterActions : value.promoted ? lifeActions : acquisitionActions;
  const nextAction = currentActions.find(action => action.enabled && action.command.type === "CONSUME")
    ?? currentActions.find(action => action.enabled && !isExit(action))
    ?? currentActions.find(action => action.enabled) ?? currentActions[0];
  const immediateActions = currentActions.filter(action => action.enabled || action === nextAction);
  const exitActions = immediateActions.filter(isExit);
  const unavailableActions = currentActions.filter(action => !immediateActions.includes(action));

  useEffect(() => { summaryHeading.current?.focus(); }, []);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== publicFacts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); setCaseId(null);
      summaryHeading.current?.focus();
    }
    if (confirmation && submitted.current === null && !busy && error === null && !liveConfirmation) setConfirmation(null);
  }, [publicFacts, busy, error, confirmation, liveConfirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function submit(action: JusticeMentorAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: JusticeMentorAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const selectedId = action.command.bottleId;
      const bottle = value.bottles.find(entry => entry.id === selectedId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id;
      setConfirmation({ action, bottle, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  function actionList(actions: JusticeMentorAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `justice-mentor-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`justice-mentor-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="正义导师当前资源"><h4>当前实际资源</h4>
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
    return <section aria-label="正义导师原人遭遇"><h4>{encounter.title}</h4>
      {enemy && <>
        <p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 本场原创G序列")}{enemy.sequence}等效。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {enemy.status === "DEAD" ? "已经真实死亡" : enemy.status === "SURRENDERED" ? "已投降停止抵抗" : "仍有独立意志"}。</p>
        <p>自己的原棍 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原干燥院场"}。科温与旧埃德蒙分别保存。</p>
      </>}
      <p>双方原身体相距2米，原普通出口开放，无追逐。太阳能力仍有实际范围和友伤风险。</p>
      {encounter.scene && <p>原场地 {encounter.scene.courtId} · 普通出口{encounter.scene.ordinaryExit === "OPEN" ? "开放" : "不可通行"} · 当前第三人 {encounter.scene.thirdPartiesInArea} 人。
        {encounter.scene.clearanceConfirmed ? "已实际确认他人均在作用范围外。" : "尚未实际确认净空，不把计划当作已完成的检查。"}</p>}
      <details className="seer-fold"><summary>本场范围与战斗代价</summary>
        <p>{encounter.story}</p>
        {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
        <p>共享光辉6灵性、清晰标记6灵性；继承无暗领域5灵性、净化光6灵性。各用实际掌握，资源不足仅普通0灵性回退；检验失败照耗，伤势与死亡仍由共同轮盘结算。</p>
        <p>{playerText("本场须实际确认第三人处在界外；净空场况不授予自动友军免疫。新科温自有光术是本作G，不把普通人伪装成太阳途径，也不重新召来旧埃德蒙。")}</p>
      </details>
    </section>;
  }
  function attemptFacts(entry: NonNullable<JusticeMentorProjection["life"]["currentAttempt"]>, index: number) {
    return <article key={index}>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "能力辅助后实际完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"} · {entry.closed ? "本次已收束" : "本次尚未收束"}。</p>
      {entry.abilityTier && <p>本案唯一能力判定：{TIER[entry.abilityTier]}。{failedTier(entry.abilityTier) && "失败与实付成本保留，不能重骰；仍可普通完成或退出。"}</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人普通行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}。</p>
      {(entry.ayaEnergySpent > 0 || entry.nivenEnergySpent > 0) && <p>本次阿娅实付精力 {entry.ayaEnergySpent} · 尼文实付精力 {entry.nivenEnergySpent} · 每位助手实际行程 {entry.helperTravelMetres} 米 · 同一原箱实际行程 {entry.chestTravelMetres} 米。</p>}
      {(entry.lampOilSpent > 0 || entry.sealSpent > 0) && <p>本次原灯油实耗 {entry.lampOilSpent} · 原封条实耗 {entry.sealSpent}；归还与收束不退还成本。</p>}
      {entry.spiritTravelMetres > 0 && <p>本次同一原榆音实际行程 {entry.spiritTravelMetres} 米，按本人意愿与普通路线往返。</p>}
      {entry.stopped && <p>本次接触已实际停止；原物仍须按真实位置交还。</p>}
      <p>{entry.inspected ? "已实际检查原人、原物与普通出口。" : "尚未完成最终检查。"}</p>
    </article>;
  }
  function sceneFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    return <section aria-label="正义导师原人原物与普通退路"><h4>当前原人、原物与实际位置</h4>
      <p>本人在{LOCATION[life.playerLocation]} · 实际累计行走 {life.playerTravelMetres} 米 · 原现场累计 {life.clockSeconds} 秒。</p>
      <p>{life.selby.name} · {life.selby.age}岁 · {life.selby.id} · 当前在{LOCATION[life.selby.location]}。本次物主许可：{attempt ? CONSENT[attempt.ownerConsent] : "尚无本次已保存许可"}。{!life.selby.willing && "原主人当前不愿继续。"}</p>
      <p>原普通门 {life.door.id} · {life.door.state === "OPEN" ? "实际开放" : "不可通行"}。普通退出不靠施法维持，关闭页面不代替本人离场。</p>
      {selectedCase.id === "paired-lift" && <section aria-label="同一原箱与两位实际助手"><h4>两位本人当前自愿，保留普通回程</h4>
        {([life.aya, life.niven] as const).map((helper, index) => <p key={helper.id}>
          {helper.name} · {helper.age}岁 · {helper.id} · {helper.present ? `当前在${LOCATION[helper.location]}` : "当前不在场"} · 剩余精力 {helper.energy} · 累计实际行程 {helper.travelMetres} 米。
          本次本人许可：{attempt ? CONSENT[index === 0 ? attempt.ayaConsent : attempt.nivenConsent] : "尚无本次已保存许可"}。{!helper.willing && `${helper.name}当前已拒绝继续，不强制行动。`}
        </p>)}
        <p>同一原工具箱 {life.chest.id} · 在{LOCATION[life.chest.location]} · {life.chest.custody === "OWNER" ? "由原主人保管" : "仍由两位原助手保管，尚未交接"} · 累计实际行程 {life.chest.travelMetres} 米。</p>
        <p>{attempt?.routeChecked ? "已实际检查原8米干燥平路与普通返程。" : "尚未实际检查原路。"}
          {attempt?.carried ? attempt.chestReceived ? "本次原主已当面接收原箱。" : "本次已运到，须原主当面接收同一箱。" : "本次尚未实际搬运；鼓舞成功也不等于已搬箱。"}
          {attempt?.helpersReturned ? "本次两位原助手已实际空手返回。" : "尚无本次两位助手回程完成记录。"}</p>
        <p className="slice-muted">每位原助手出发前至少8精力。一次6灵性鼓舞成功，本次8米出程各耗3精力，否则各耗6；8米普通空手回程另各耗2。本人须实际随行并另走8米回出口，原箱留在原主接收处，不生成第三人、箱子副本或免费精力。运输为抽象游戏动作。</p>
      </section>}
      {selectedCase.id === "faded-label" && <section aria-label="原有字形与实际证据"><h4>字形、假说与原记录分别核实</h4>
        <p>同一原保管牌 {life.tag.id} 在{LOCATION[life.tag.location]}；同一原交接册 {life.register.id} 在{LOCATION[life.register.location]}。</p>
        <p>本次已实际读到的字形：{attempt?.glyphs.length ? attempt.glyphs.map(glyph => GLYPH[glyph]).join("、") : "尚无已读出的字形"}。原有字形不自动给出失主、用途或罪责。</p>
        <p>原放大镜 {life.magnifier.id} 在{LOCATION[life.magnifier.location]} · 耐久 {life.magnifier.durability}；原灯 {life.lamp.id} 在{LOCATION[life.lamp.location]} · 剩余灯油 {life.lamp.oil} 单位。
          {attempt?.lampRead ? "本次已用原灯普通核读。" : "本次尚未用原灯普通核读。"}</p>
        <p>当前假说：{attempt?.hypothesis ? HYPOTHESIS[attempt.hypothesis] : "尚未提出"}。
          {!!attempt?.hypothesisHistory.length && `原假说记录：${attempt.hypothesisHistory.map(hypothesis => HYPOTHESIS[hypothesis]).join(" → ")}。`}</p>
        <p>原人当面询问：塞尔比{attempt?.selbyAsked ? "已问" : "未问"}、尼文{attempt?.nivenAsked ? "已问" : "未问"}。同一原签注{attempt?.registerRead ? "已亲自读取" : "尚未亲自读取"}。</p>
        <p>{attempt?.verified ? "已据真实证词与原签注核实，原错误假说仍保留。" : "尚未完成原证词与原签注核实，假说不是事实。"}
          {attempt?.itemsReturned ? "同一原牌、原册及两原工具已亲手归还。" : life.tag.location === "PLAYER" ? "本人仍保管原借物，须携带交还原主。" : "尚无本次借物归还完成记录。"}</p>
        <p>原箱 {life.chest.id} 当前仍在{LOCATION[life.chest.location]}；查阅记录不会搬动原箱。</p>
        <p className="slice-muted">能力失败仍耗6灵性且不重骰；可用原灯与放大镜普通核读，另耗4秒、原灯油1单位。普通核读也只显字形。问两位原人与交还原借物都须实际走路，已耗灯油不补回。</p>
      </section>}
      {selectedCase.id === "shielded-sample" && <section aria-label="同一友善灵与原样本封存"><h4>先实际退开，再使用继承净化</h4>
        <p>既存原友善灵 {life.elm.name} · {life.elm.id} · 当前在{LOCATION[life.elm.location]} · 累计实际行程 {life.elm.travelMetres} 米。本次本人许可：{attempt ? CONSENT[attempt.spiritConsent] : "尚无本次已保存许可"}。
          {!life.elm.willing && "榆音当前不愿继续，不强制移动或召回。"}</p>
        <p>{attempt?.spiritSteppedOut ? "本次原灵已沿4米普通廊道实际退开。" : "本次尚未完成原灵实际退开；同意不等于已经移动。"}
          {attempt?.spiritDisposition === "RETURNED" ? "停光后已另行邀请，同一原灵自愿沿原4米走回。" : attempt?.spiritDisposition === "STAY_SIDE" ? "停光后原灵拒绝返回，实际留在SIDE；尊重选择，不自动召回。" : "尚无本次返回或留在外侧的已保存选择。"}</p>
        <p>原屏架 {life.screen.id} · {life.screen.intact ? "完好" : "已损坏"} · {life.screen.placed ? "已实际摆好" : "尚未摆好"} · 耐久 {life.screen.durability}。
          {attempt?.screenChecked ? "本次已亲自检查屏架与普通门。" : "本次尚未完成屏架与普通门检查。"}</p>
        <p className={attempt?.lightActive ? "slice-notice" : undefined}>本次太阳作用：{attempt?.lightActive ? "仍在进行，须实际停止" : attempt?.lightStopped ? "已实际停止" : "尚未施放"}。友善身份与屏架均不授予太阳免疫。</p>
        <p>同一原样本 {life.sample.id} · 数量 {life.sample.quantity} · 实际残留强度 {life.sample.contamination} · 在{LOCATION[life.sample.location]}。
          {life.sample.contamination === 0 ? "原残留已实际净化。" : "原残留仍为2，不能称作已净化。"}</p>
        <p>同一原盒 {life.sample.boxId} · {life.sample.sealed ? "已真实封存" : "尚未封存"}；唯一原封条 {life.seal.id} · 剩余 {life.seal.remaining}。
          {life.sample.sealed && life.sample.contamination > 0 && "普通封存保留未净化事实。"}</p>
        <p className="slice-muted">本案6灵性、意志18使用继承序列4净化。成功残留2→0，失败仍2；停光后都须耗同一原封条1→0封存。成功作用并报告只加旧净化掌握8。原灵可拒绝退开，改普通封存；返程须另行邀请，拒绝可留SIDE。本人沿4米普通路退出。样本是游戏中的超自然污秽残留。</p>
      </section>}
      {selectedCase.observations.length > 0 && <section aria-label="本案已取得的原观察"><h4>目前已取得的证据</h4>
        <ul>{selectedCase.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
      </section>}
      {attempt && <details className="seer-fold" open={failedTier(attempt.abilityTier) || attempt.refused || attempt.stopped}>
        <summary>本次实际尝试与已付代价</summary><section aria-label="正义导师本次尝试与代价">{attemptFacts(attempt, 0)}</section>
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

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation justice-mentor-panel"
    aria-label="正义导师原瓶服用确认" aria-busy={busy || submittedId !== null}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmation.bottle.title}</h3>
    <p>原瓶：{confirmation.bottle.id}</p><p>来源：{confirmation.bottle.source}</p><p>{confirmation.bottle.status}</p>
    <p>当前成功率 {confirmation.bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
    <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。正义导师序列3已有原文依据；完整配方与原著晋升仪式仍未核，本次采用独立成品与专业准备G。")}</p>
    <section className="slice-notice seer-risk" aria-label="正义导师服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
    <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不退。失败后须实际恢复、筹另一独立原瓶，并重新检查场地。</p>
    <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶身体性别不改变，旧伤势与能力掌握保留；灵性上限120，当前灵性不补满。旧埃德蒙伤势与投降、原物和已回输的原情感不因晋升改写。</p>
    {resources()}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="justice-mentor-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
      <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "justice-mentor-confirm-reason" : undefined}
        onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
    </div>
    <p className="slice-muted">返回只取消未提交的确认，不代替实际退出准备。提交后等待同一次保存回执，失败时保留这一原意图。</p>
    {pendingNotice}{saveNotice}
  </section>;

  return <section className="seer-panel warrior-panel justice-mentor-panel" aria-label="正义导师" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="正义导师当前目标">
      <span className="seer-seal">{value.promoted ? playerText("正义导师 · 太阳序列3（合作与核实G）") : "无暗者4 → 正义导师3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.resources?.health === 0 || encounter.status === "LOST" ? "本周目已经死亡，原记录只读保留。"
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">{playerText("序列3正义导师已核实；新增技能未原核，当前两项合作与核实技巧为本作G。下一序列2逐光者（古称逐日者）据卷末作者总结，尚未开放。")}</p>
    </section>
    {resources()}
    {!value.promoted && selectedBottle && <section aria-label="当前独立正义导师原瓶"><h4>本次原瓶</h4>
      <label>选择独立正义导师原瓶<select aria-label="选择独立正义导师原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前正义导师生活情境">
      <label>选择正义导师生活情境<select aria-label="选择正义导师生活情境" disabled={locked || life.insideCase || life.cases.some(entry => entry.status === "PREPARED")} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.method && <p>本次已保存准备：{selectedCase.method === "ABILITY" ? "能力方法" : "普通方法"}。</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施与报告各1行动；准备前须留足2行动。现场子步0行动，仍记录实际时间、位置、资源与原物后果。</p>
    </section>}

    {value.promoted && !encounter.inside && sceneFacts()}
    {value.promoted && encounter.inside && encounterFacts()}
    <section aria-label="正义导师当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {immediateActions.length ? actionList(immediateActions.filter(action => !isExit(action)), "正义导师公开行动") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {exitActions.length > 0 && <section aria-label="正义导师停止与普通收束"><h4>归还原物与普通退出</h4>
        {actionList(exitActions, "正义导师零行动收束")}
        <p className="slice-muted">按公开选项0行动归还、检查并沿实际路线退出；已付灵性、助手精力、原灯油与封条损耗不退。关闭页面不会代替这些动作。</p>
      </section>}
      {unavailableActions.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>
        {actionList(unavailableActions, "正义导师尚不可提交的步骤")}
      </details>}
    </section>

    {value.promoted && <details className="seer-fold"><summary>三项实践的原观察与结果</summary>
      <section aria-label="正义导师生活记录">{life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4>
        <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束现场"}。</p>
        {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
        {entry.attempts.map(attemptFacts)}
      </article>)}<p>{life.environment}</p></section>
    </details>}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary>
      <section aria-label="正义导师成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
        <p>{playerText("第五部第88章《收获》直接明确序列3正义导师。完整配方、材料用量、调配顺序、新增技能名录及正义导师晋升仪式仍未核实，不能据此断言不需仪式。下一序列2逐光者（古称逐日者）来自第五部卷末作者总结，能力未核且本阶段不开放。")}</p>
        <p>{value.supplies}</p>
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>从无暗者实际晋升周起满12整周、原消化100；指导500便士，三项不同准备各1行动，当周准备另需1行动及120便士。三瓶独立成品各6200便士，或各完成五次真实劳务后800便士。</p>
        <p>当次准备：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}{playerText("。独立成品渠道、专业支持与以上全部数值均为本作G，不冒充原著完整配方或晋升仪式。")}</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>{playerText("旧序列4的情感剥离与回输仪式不会作为本阶任务重做。已回输的同一原情感和六种原材料去向只读保留；专业准备不代替尚未核实的3级原著仪式。")}</p>
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>{playerText("技巧与使用范围")}</summary>
      <section aria-label={playerText("正义导师能力与使用范围")}><h4>实际掌握与有限范围</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>{playerText("第五部第88章《收获》只直接核实序列3正义导师称号。本次没有核实其完整新增技能名录或定量；共享光辉与清晰标记均是本作借太阳低阶根基拓展的原创G技巧，不冒充原文技能。")}</p>
        <p>{playerText("每次尝试6灵性，有限共享光辉为意志18，清晰标记为知识18；距离、强度、时间、消耗与三项故事均为G。鼓舞不能迫使不愿者行动或补满精力，原有字形不能替代证词与原记录，不凭空生成证据、识心或定罪。")}</p>
        <p>{playerText("第三案使用继承的序列4净化，成功实际作用并报告只增加旧净化掌握8，不增加两项G新技巧掌握。友善灵也可能受太阳作用伤害，须取得本次同意并真实退到界外，不自动免疫或召回。")}</p>
        <p>{playerText("继承序列6公证签名仍须本人认可；没有强制契约、善恶雷达、法律身份或依名称即死。下一2逐光者的名称依据属于第五部卷末作者总结，古称逐日者，能力未核且不开放。")}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、旧埃德蒙与原物</summary>
      <section aria-label="正义导师继承记录"><h4>序列4经历只读保留</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>旧埃德蒙的真实伤势、投降或死亡与原棍、原奥尔登的出入和风险、原特性污染与原盒、原石板焦痕和60秒冷却记录均保留。已回输的原情感不重新剥离，不重做旧序列4仪式，不治疗、复活或免费修复原物。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>新原人的可选冲突</summary>
      {encounterFacts()}{actionList(encounterActions, "正义导师可选遭遇行动")}
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭正义导师页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
