import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DeceitMentorAction, DeceitMentorCommand, DeceitMentorProjection } from "../domain/deceit-mentor/types";
import { DECEIT_MENTOR_FORMULA_STATUS, DECEIT_MENTOR_SOURCE_STATUS } from "../domain/deceit-mentor/content";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "本次尚未当面询问", GRANTED: "已同意本次有限演练", DECLINED: "已拒绝本次演练", REVOKED: "本次许可已撤回", CLOSED: "本次许可已结束" };
const LOCATION: Record<string, string> = { START: "原接待桌START", BENCH: "原试验台BENCH", CABINET: "原夹框处CABINET", OWNER: "原主人伊迪丝处", PLAYER: "本人随身", TRAY: "原毡托盘", HAND: "本人手中", AIR: "原毡托盘上方", FRAME: "原夹框" };
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP_EFFECT", "STOP_CONTACT", "EXTINGUISH", "RETURN_PLAYER", "RETURN_ITEM", "RETURN_WITNESS", "RECOVER_TAG", "RECOVER_CARD", "INSPECT", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const CANCEL_TYPES = new Set(["STOP_CONTACT", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const isExit = ({ command }: DeceitMentorAction) => EXIT_TYPES.has(command.type);
const failedTier = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const location = (value: string) => LOCATION[value] ?? value;
const face = (value: string | null) => value === "FRONT" ? "正面（蓝三角）" : value === "BACK" ? "背面（红圆）" : "尚未取得现场记录";
type Attempt = NonNullable<DeceitMentorProjection["life"]["currentAttempt"]>;
type Confirmation = { action: DeceitMentorAction; facts: string; bottle: DeceitMentorProjection["bottles"][number] };

export interface DeceitMentorPanelProps {
  value: DeceitMentorProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DeceitMentorCommand) => void;
  /** Closing the view does not stop an effect, move a body or return an original item. */
  onClose?: () => void;
}

/** Read committed public facts and submit typed intents. No local timers, movement or resource simulation. */
export function DeceitMentorPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: DeceitMentorPanelProps) {
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
  const publicFacts = JSON.stringify(value);
  const locked = busy || blocked || error !== null || submittedId !== null;
  const liveConfirmation = confirmation && confirmation.facts === publicFacts
    ? value.actions.find(action => action.id === confirmation.action.id) : undefined;
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
    ?? currentActions.find(action => action.enabled && !CANCEL_TYPES.has(action.command.type))
    ?? currentActions.find(action => action.enabled) ?? currentActions[0];
  const alternativeActions = currentActions.filter(action => action.enabled && action !== nextAction && !isExit(action));
  const exitActions = currentActions.filter(action => action.enabled && action !== nextAction && isExit(action));
  const unavailableActions = currentActions.filter(action => !action.enabled && action !== nextAction);

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

  function submit(action: DeceitMentorAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: DeceitMentorAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const id = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === id);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: DeceitMentorAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `deceit-mentor-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`deceit-mentor-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="欺瞒导师当前资源"><h4>当前实际资源</h4>
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
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="欺瞒导师原人遭遇"><h4>{encounter.title}</h4>
      {enemy && <>
        <p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 本场原创G序列")}{enemy.sequence}等效。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {enemy.status === "DEAD" ? "已经真实死亡" : enemy.status === "SURRENDERED" ? "已投降停止抵抗" : "仍有独立意志"}。</p>
        <p>唯一原棍 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原干院"}。吉迪恩与旧拉尔夫分别保存，旧人和原棍不重置。</p>
      </>}
      {encounter.scene && <p>原场地 {encounter.scene.courtId} · 普通出口{encounter.scene.ordinaryExit === "OPEN" ? "实际开放" : "不可通行"} · 当前第三人 {encounter.scene.thirdPartiesInArea} 人。
        {encounter.scene.clearanceConfirmed ? "已实际确认净空。" : "尚未实际确认净空。"}</p>}
      <p>双方原身体相距2米，普通出口开放、无追逐；关闭页面不改变原敌的资源、原棍、伤势或结局。</p>
      <details className="seer-fold"><summary>本场范围与战斗代价</summary>
        <p>{encounter.story}</p>{encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
        <p>规则欺瞒与深层欺瞒各耗6灵性、知识18；成功分别使对方优势−36、−30，不直接致伤，不控制身体。只有普通STRIKE构成伤势威胁。</p>
        <p>{playerText("吉迪恩本场能力来源为ORIGINAL_LIMITED_G：灵性冲击5灵性、屏护4灵性、辨伪4灵性。辨伪只抵本轮下一次成功欺瞒；被抵仍实付成本。缺资源仅普通回退，每轮实际60秒，共同伤势与死亡没有豁免。")}</p>
      </details>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、点灯或施术。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const { bottle } = confirmation;
    return <section className="seer-panel warrior-panel seer-confirmation deceit-mentor-panel" aria-label="欺瞒导师原瓶服用确认"
      aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
      <h3 ref={confirmationHeading} tabIndex={-1}>{bottle.title}</h3>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      <p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
      <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。完整配方与原著晋升仪式仍未核；本次独立成品与专业准备为原创G。")}</p>
      <section className="slice-notice seer-risk" aria-label="欺瞒导师服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
      <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不退。失败后须实际恢复、筹另一独立原瓶，再重新检查本周场地。</p>
      <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。身体性别不改变，四属性成功后各+1；原伤势与全部旧掌握保留，灵性上限仍120，当前灵性不补满。原寄生宿主、窃取窗口、旧存货与原人物去向保留，不赠原能力或天使分身。</p>
      {resources()}
      {liveConfirmation?.reason && <p className="seer-action-reason" id="deceit-mentor-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
          aria-describedby={liveConfirmation?.reason ? "deceit-mentor-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
      </div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，失败时保留这一原意图。</p>
      {pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel warrior-panel deceit-mentor-panel" aria-label="欺瞒导师" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="欺瞒导师当前目标">
      <span className="seer-seal">{value.promoted ? playerText("欺瞒导师 · 错误序列3（有限规则欺瞒G）") : "寄生者4 → 欺瞒导师3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.resources?.health === 0 || encounter.status === "LOST" ? "本周目已经死亡，原身体位置与原物记录只读保留。"
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">{playerText("序列3欺瞒导师及欺诈自然规律的方向已核；本场规则、秒数与资源均为原创G。序列2命运木马及以上尚未开放。")}</p>
    </section>
    {resources()}
    {!value.promoted && selectedBottle && <section aria-label="当前独立欺瞒导师原瓶"><h4>本次原瓶</h4>
      <label>选择独立欺瞒导师原瓶<select aria-label="选择独立欺瞒导师原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}
    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前欺瞒导师生活情境">
      <label>选择欺瞒导师生活情境<select aria-label="选择欺瞒导师生活情境" disabled={locked || life.insideCase || life.cases.some(entry => entry.status === "PREPARED")} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id} disabled={entry.status === "AVAILABLE" && !value.actions.some(action => "caseId" in action.command && action.command.caseId === entry.id)}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.method && <p>本次已保存准备：{selectedCase.method === "ABILITY" ? "能力方法" : "普通方法"}。</p>}
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施与报告各1行动，准备前须留足2行动；现场子步0行动仍实际计秒、行走、消耗。三报告各25、反思25，共13行动。</p>
    </section>}
    <section aria-label="欺瞒导师当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "欺瞒导师下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternativeActions.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternativeActions, "欺瞒导师其它公开行动")}</details>}
      {exitActions.length > 0 && <section aria-label="欺瞒导师停止与实际收束"><h4>停止、归还与普通退出</h4>
        {actionList(exitActions, "欺瞒导师实际收束")}
        <p className="slice-muted">收束按真实位置进行；停止效果不自动归还原物，也不会送回巴兹尔或本人。实付资源不退，普通返程0灵性仍计米与秒。</p>
      </section>}
      {unavailableActions.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailableActions, "欺瞒导师尚不可提交的步骤")}</details>}
    </section>
    {value.promoted && !encounter.inside && sceneFacts()}
    {value.promoted && encounter.inside && encounterFacts()}
    {value.promoted && <details className="seer-fold"><summary>三项实践的原观察与结果</summary>
      <section aria-label="欺瞒导师生活记录">{life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4>
        <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束现场"}。</p>
        {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
        {entry.attempts.map(attemptFacts)}
      </article>)}<p>{life.environment}</p></section>
    </details>}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary>
      <section aria-label="欺瞒导师成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
        <p>{playerText(DECEIT_MENTOR_FORMULA_STATUS)}</p><p>{value.supplies}</p>
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>导师阿德里安·霍尔，54岁，DM3-ADRIAN。指导500便士；独立原瓶6400便士，或每瓶五次实际劳务后900便士；三项准备各1行动。当周场地准备另付1行动与140便士，寄生者实际晋升满12整周且原消化100才可继续。</p>
        <p>当次准备：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}{playerText("。原瓶渠道、专业支持和全部数值为本作G，不重做旧序列4仪式。")}</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary>
      <section aria-label={playerText("欺瞒导师能力与使用范围")}><h4>有限效果与真实收束</h4>
        <p>{playerText(DECEIT_MENTOR_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>{playerText("阿蒙无燃料亮灯一周的原文事例不能当作初晋普遍时长。当前续光16秒、迟落8秒、朝向误判最多6秒均为本作G；不下放换命、主辅颠倒、源堡复活骗局或天使分身。")}</p>
        <p>只有能力实际成功并完成对应报告才增加该能力掌握8；普通方法完成、失败与取消均不赠能力掌握。不会回填原油、复制原物或抹去已经付出的代价。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、旧寄生与继承原物</summary>
      <section aria-label="欺瞒导师继承记录"><h4>旧偷盗者至寄生者经历只读保留</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>承接原错误路线普通人自然周目前缀，后续成败以本周目实际保存记录为准。原托马斯的分离与自主行动、原艾莉丝已执行并恢复的念头、旧拉尔夫及原棍结局均保持；旧窃取窗口和实际存货不复制，不赠天使能力，不复活死亡档。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>新原人的可选冲突</summary>{encounterFacts()}{actionList(encounterActions, "欺瞒导师可选遭遇行动")}</details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭欺瞒导师页面</button>}
    {pendingNotice}{saveNotice}
  </section>;

  function correctionFacts(entry: Attempt) {
    if (!entry.cardRead) return <p>尚未现场记录同一原卡，未生成见证判断。</p>;
    const mistaken = entry.observedFaceBeforeCorrection !== null && entry.observedFaceBeforeCorrection !== entry.originalFace;
    return <>
      <p>施术前原卡实面：{face(entry.originalFace)}。当时见证判断：{face(entry.observedFaceBeforeCorrection)}。
        {entry.observedFaceBeforeCorrection !== null && (mistaken ? "这是当时的误判，原记录保留。" : "当时未看错；不能把识破算成能力成功。")}</p>
      <p>{entry.cardFlipped ? "本人已普通翻动同一原卡。" : "本人尚未普通翻动原卡。"}
        {entry.correctionMade ? `已当面纠正：施术时原面是${face(entry.correctedOriginalFace)}；现场核实当前卡面为${face(entry.verifiedFace)}。旧判断保留，未改写原记忆。` : "尚未完成当面纠正与现场复核，原判断不能当作最终事实。"}</p>
    </>;
  }
  function attemptFacts(entry: Attempt, index: number) {
    return <article key={index}>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "能力实际作用后完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"} · {entry.closed ? "本次已收束" : "本次尚未收束"}。</p>
      {entry.abilityTier && <p>本案唯一能力判定：{TIER[entry.abilityTier]}。{failedTier(entry.abilityTier) && "失败与实付成本保留，不能重骰；按现场原资源普通收束，不算能力成功。"}</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人普通行走 {entry.playerTravelMetres} 米 · 巴兹尔普通行走 {entry.witnessTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}。</p>
      {entry.playerMoves.map((move, moveIndex) => <p key={moveIndex}>{location(move.from)} → {location(move.to)}：普通行走 {move.metres} 米、{move.seconds} 秒{move.itemId ? `，携同一原物${move.itemId}` : "，没有携带本案原物"}。</p>)}
      {(entry.lampLit || entry.candleSpent > 0) && <p>原油实耗 {entry.lampOilSpent} · 原蜡烛实耗 {entry.candleSpent} · {entry.plateRead ? `已借${entry.plateReadBy === "LAMP" ? "同一原灯" : "同一原蜡烛"}核读原铭牌` : "尚未核读原铭牌"} · {entry.extinguished ? "已实际熄灯与蜡烛" : "尚未完成熄灭检查"}。</p>}
      {entry.tagReleased && <p>{entry.tagRead ? `已在${entry.tagReadWhile === "AIR" ? "同一原签迟落时" : "本人手持同一原签时"}核对原编号` : "尚未核读原编号"}；{entry.tagRecovered ? "原纸签已亲手收回" : "原纸签尚未亲手收回"}。</p>}
      {entry.cardRead && correctionFacts(entry)}
      {entry.stopped && <p>本次已停止；停止不移动身体、不归还原物、不退资源。</p>}
      <p>{entry.effectStopped ? "效果已实际停止。" : "尚未完成停效检查。"}{entry.itemReturned ? "原物已交还伊迪丝。" : "原物尚未交还。"}{entry.inspected ? "已完成最终实际检查。" : "尚未完成最终实际检查。"}</p>
    </article>;
  }
  function sceneFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    return <section aria-label="欺瞒导师原人原物与真实位置"><h4>原现场的实际记录</h4>
      <p>原现场 {life.siteId} · 本人在{location(life.playerLocation)} · 实际累计 {life.clockSeconds} 秒 · 本人累计普通行走 {life.playerTravelMetres} 米。</p>
      <p>{life.edith.name} · {life.edith.age}岁 · {life.edith.id} · 当前在{location(life.edith.location)}；本案许可：{attempt ? CONSENT[attempt.ownerConsent] : "尚无本案已保存许可"}。
        {!life.edith.willing && "原主当前不愿继续，不能强迫交付。"}</p>
      <p>{life.basil.name} · {life.basil.age}岁 · {life.basil.id} · 当前在{location(life.basil.location)}；本案见证许可：{attempt ? CONSENT[attempt.witnessConsent] : "尚无本案已保存许可"}。
        {!life.basil.willing && "巴兹尔当前不愿继续，不能以随机结果强迫同意。"}旧案同意不延续。</p>
      <p>原普通门 {life.door.id} · {life.door.state === "OPEN" ? "实际开放" : "不可通行"}。START↔BENCH 6米、BENCH↔CABINET 4米、START↔CABINET 10米，均须实际沿原干廊往返。</p>
      {selectedCase.id === "spent-lamp" && <section aria-label="欺瞒导师原灯与有限燃料"><h4>同一原灯与剩余光照</h4>
        <p>{life.lamp.id} · 数量 {life.lamp.quantity} · 原主 {life.lamp.owner} · 在{location(life.lamp.location)} · {life.lamp.lit ? "仍有真实原火" : "当前已经熄灭"} · 累计携行 {life.lamp.travelMetres} 米。</p>
        <dl className="seer-facts"><div><dt>原油剩余</dt><dd>{life.lamp.oil} / 1 单位</dd></div><div><dt>原灯芯余辉</dt><dd>{life.lamp.wickSeconds} 秒</dd></div>
          <div><dt>有限续光剩余</dt><dd>{life.lamp.extensionSeconds} 秒</dd></div><div><dt>续光尝试</dt><dd>{life.lamp.extensionUsed ? "原灯已尝试续光" : "尚未使用"}</dd></div></dl>
        <p>{life.candle.id} · 数量 {life.candle.quantity} · 在{location(life.candle.location)} · 原备用蜡烛剩余 {life.candle.remaining} / 1 支 · {life.candle.lit ? "正在燃烧" : "当前未燃烧"} · 剩余寿命 {life.candle.burnSeconds} 秒。</p>
        <p>原铭牌 {life.plate.id} · 数量 {life.plate.quantity} · 仍在{location(life.plate.location)}。{attempt?.plateRead ? `已实际核读：${life.plate.inscription}。` : "尚未核读，不预先给出牌中文字。"}</p>
        <p className="slice-muted">原油用尽后只有20秒灯芯余辉；核读需24秒。原火尚在才能尝试一次额外16秒，失败不延长，灯灭后不能借续光重燃。普通核读须实际消耗这一原备用蜡烛。</p>
      </section>}
      {selectedCase.id === "falling-tag" && <section aria-label="欺瞒导师原签与有限迟落"><h4>同一纸签与实际落点</h4>
        <p>{life.tag.id} · 数量 {life.tag.quantity} · 原主 {life.tag.owner} · 当前在{location(life.tag.location)} · 剩余迟落 {life.tag.delaySeconds} 秒 · 累计携行 {life.tag.travelMetres} 米。</p>
        <p>{life.tray.id} · 数量 {life.tray.quantity} · 原毡托盘仍在{location(life.tray.location)}。
          {life.tag.location === "AIR" ? "原签短暂留在同一托盘上方，到期或停效后实际落盘。" : life.tag.location === "TRAY" ? "原签已实际落在同一毡盘，须到场亲手收回。" : life.tag.location === "OWNER" ? "原签在伊迪丝手里。" : "本人正实际持有这同一原签。"}</p>
        <p>{attempt?.tagRead ? `已实核原编号：${life.tag.number}。` : "尚未现场核号，不提前给出原编号。"}</p>
        <p className="slice-muted">仅松开自己手中原小签时可试一次8秒迟落，空中核号耗5秒；失败立即落盘，可亲手收回后普通持有核号。不能悬人、无限悬停或远距收物。</p>
      </section>}
      {selectedCase.id === "witness-correction" && <section aria-label="欺瞒导师原卡与纠正记录"><h4>原卡、当时判断与现场纠正</h4>
        <p>{life.card.id} · 数量 {life.card.quantity} · 原主 {life.card.owner} · 在{location(life.card.location)} · 累计携行 {life.card.travelMetres} 米。
          原夹框 {life.frame.id} 在{location(life.frame.location)}。</p>
        <p>当前注意偏移剩余 {life.card.deceptionSeconds} 秒。{attempt?.cardRead ? `当前真实卡面：${face(life.card.face)}。` : "尚未现场核实卡面。"}</p>
        {attempt ? correctionFacts(attempt) : <p>尚无本案原卡判断与纠正记录。</p>}
        <p>{life.basil.location === "CABINET" ? "巴兹尔仍在CABINET，尚未实际4米返回BENCH。" : attempt?.witnessReturned ? "巴兹尔已经实际4米返回BENCH。" : "巴兹尔当前仍在原BENCH。"}本人累计普通行走 {life.playerTravelMetres} 米；巴兹尔累计普通行走 {life.basil.travelMetres} 米。</p>
        <p className="slice-muted">{playerText("最多6秒的原创G注意偏移；见证者仍可拒绝或识破。真实卡面只由本人普通翻动改变，必须停效或到期后当面复核，原误判与纠正分别保存。")}</p>
      </section>}
      <p className="slice-muted">页面等待不会自行计秒或移动。现场动作与每轮战斗60秒按实际结算推进；剩余时长、原油和蜡烛不会因关闭页面恢复。</p>
      {selectedCase.observations.length > 0 && <details className="seer-fold"><summary>本案已经取得的原观察</summary><ul>{selectedCase.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul></details>}
      {attempt && <details className="seer-fold" open={failedTier(attempt.abilityTier) || attempt.stopped || attempt.ownerConsent === "DECLINED" || attempt.witnessConsent === "DECLINED"}>
        <summary>本次实际尝试与已付代价</summary><section aria-label="欺瞒导师本次尝试与代价">{attemptFacts(attempt, 0)}</section>
      </details>}
    </section>;
  }
}
