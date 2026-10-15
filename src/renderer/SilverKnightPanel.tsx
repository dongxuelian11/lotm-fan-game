import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SilverKnightAction, SilverKnightCommand, SilverKnightProjection } from "../domain/silver-knight/types";
import { SILVER_KNIGHT_FORMULA_STATUS, SILVER_KNIGHT_SOURCE_STATUS } from "../domain/silver-knight/content";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const HUNT_STATUS: Record<string, string> = { UNSEEN: "尚未实查", AVAILABLE: "尚未实查", INVESTIGATED: "已实查原个体", PREPARED: "已准备本目标", ACTIVE: "正在交战", RESISTING: "仍在抵抗", DEAD: "原个体已死亡", ENEMY_DEAD: "原个体已死亡", SURRENDERED: "原个体已投降", COLLECTED: "原遗骸已采集", CONSUMED: "本份遗骸已耗用", WITHDRAWN: "已退出，原状态保留", TRACKED: "已实查原个体", FIGHTING: "正在交战", RETREATED: "已退场，原状态保留", LEFT: "已普通离开" };
const RITUAL_LOCATION: Record<string, string> = { DOOR: "原门", MEETING: "原会见点", ALTAR: "原祭坛" };
const MEETING_STATUS: Record<string, string> = { REQUESTED: "已预约，尚无祝福", GRANTED: "实际给予祝福", REFUSED: "本次实际拒绝", CANCELLED: "本人已取消" };
const BLESSING_STATUS: Record<string, string> = { ACTIVE: "当前有效", CONSUMED: "已经耗用", CANCELLED: "已取消", EXPIRED: "已经过期" };
const REMAINS_STATUS: Record<string, string> = { OWNER_PLAYER: "本人实际持有", ALTAR: "已放入原祭坛", CONSUMED: "已经耗用，不可再放置" };
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_TASK", "POTION_WORK", "BUY_POTION"]);
const HUNT_TYPES = new Set(["INVESTIGATE_HUNT", "PREPARE_HUNT", "HUNT_FIGHT", "COLLECT_REMAINS"]);
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP_EFFECT", "STOP_CONTACT", "EXTINGUISH", "RETURN_PLAYER", "RETURN_ITEM", "RETURN_WITNESS", "INSPECT", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER", "RITUAL_RETURN_DOOR", "RITUAL_CANCEL_MEETING"]);
const CANCEL_TYPES = new Set(["STOP_CONTACT", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER", "RITUAL_CANCEL_MEETING"]);
type Phase = "preparation" | "hunts" | "ritual" | "life" | "encounter";
type Confirmation = { action: SilverKnightAction; facts: string; bottle: SilverKnightProjection["bottles"][number] };
type Attempt = NonNullable<SilverKnightProjection["life"]["currentAttempt"]>;
const failedTier = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const phaseFor = ({ command }: SilverKnightAction): Phase => ACQUISITION_TYPES.has(command.type) ? "preparation"
  : HUNT_TYPES.has(command.type) ? "hunts"
  : command.type.startsWith("RITUAL_") || ["CONSUME", "PREPARE_PROMOTION", "LEAVE_PREPARATION"].includes(command.type) ? "ritual"
  : ENCOUNTER_TYPES.has(command.type) ? "encounter" : "life";

export interface SilverKnightPanelProps {
  value: SilverKnightProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: SilverKnightCommand) => void;
  /** Closing the view never moves a body, ends an effect or returns a consumed original. */
  onClose?: () => void;
}

/** Render committed public facts only. Timers, movement, resource spending and retries belong to the saved command flow. */
export function SilverKnightPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: SilverKnightPanelProps) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const publicFacts = JSON.stringify(value);
  const locked = busy || blocked || error !== null || submittedId !== null;
  const { life, encounter, ritual } = value;
  const liveConfirmation = confirmation && confirmation.facts === publicFacts
    ? value.actions.find(action => action.id === confirmation.action.id) : undefined;
  const selectedBottle = value.bottles.find(bottle => bottle.id === bottleId)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && action.command.type === "CONSUME" && action.command.bottleId === bottle.id))
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && "bottleId" in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const selectedCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === "PREPARED")
    ?? life.cases.find(entry => entry.id === caseId)
    ?? life.cases.find(entry => entry.status !== "RESOLVED") ?? life.cases[0];
  const preferredAction = value.actions.find(action => action.id === value.preferredActionId);
  const selectedHunt = encounter.hunts.find(entry => encounter.inside && entry.instanceId === encounter.activeTargetId)
    ?? encounter.hunts.find(entry => entry.speciesId === speciesId)
    ?? encounter.hunts.find(entry => preferredAction && "speciesId" in preferredAction.command && preferredAction.command.speciesId === entry.speciesId)
    ?? encounter.hunts.find(entry => value.actions.some(action => action.enabled && "speciesId" in action.command && action.command.speciesId === entry.speciesId))
    ?? encounter.hunts[0];
  const suggestedAction = preferredAction ?? value.actions.find(action => action.enabled && action.command.type === "CONSUME")
    ?? value.actions.find(action => action.enabled && !CANCEL_TYPES.has(action.command.type));
  const phase: Phase = encounter.inside ? encounter.enemy?.speciesId ? "hunts" : "encounter"
    : ritual.inside ? "ritual" : life.insideCase ? "life"
    : selectedPhase ?? (value.promoted ? "life" : suggestedAction ? phaseFor(suggestedAction) : "preparation");
  const currentActions = value.actions.filter(action => {
    const category = phaseFor(action);
    if (phase === "hunts" ? category !== "hunts" && !(encounter.inside && action.command.type === "LEAVE_ENCOUNTER") : category !== phase) return false;
    if ("bottleId" in action.command && action.command.bottleId !== selectedBottle?.id) return false;
    if ("caseId" in action.command && action.command.caseId !== selectedCase?.id) return false;
    return !("speciesId" in action.command) || action.command.speciesId === selectedHunt?.speciesId;
  });
  const nextAction = currentActions.find(action => action.id === value.preferredActionId)
    ?? currentActions.find(action => action.enabled && action.command.type === "CONSUME")
    ?? currentActions.find(action => action.enabled && !CANCEL_TYPES.has(action.command.type))
    ?? currentActions.find(action => action.enabled) ?? currentActions[0];
  const alternativeActions = currentActions.filter(action => action.enabled && action !== nextAction && !EXIT_TYPES.has(action.command.type));
  const exitActions = currentActions.filter(action => action.enabled && action !== nextAction && EXIT_TYPES.has(action.command.type));
  const unavailableActions = currentActions.filter(action => !action.enabled && action !== nextAction);
  const attempt = life.currentAttempt ?? selectedCase?.attempts.at(-1) ?? null;

  useEffect(() => { summaryHeading.current?.focus(); }, []);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== publicFacts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); setCaseId(null); setSelectedPhase(null);
      summaryHeading.current?.focus();
    }
    if (confirmation && submitted.current === null && !busy && error === null && !liveConfirmation) setConfirmation(null);
  }, [publicFacts, busy, error, confirmation, liveConfirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function submit(action: SilverKnightAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: SilverKnightAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const id = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === id);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: SilverKnightAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `silver-knight-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>{action.reason && <p className="seer-action-reason" id={`silver-knight-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="银骑士当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div><div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{current.cash}</dd></div><div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function irreversibleCosts() {
    return <section className="slice-notice seer-risk" aria-label="银骑士不可逆代价"><h4>服药前请确认不可逆代价</h4>
      <p>亲猎中的真实死亡不可撤销，投降不算本人击杀；可以停止准备，继续留在猎魔者4。</p>
      <p>成功或失败都会耗用本次原瓶、六份已亲自采集并放置的原遗骸、祭坛耗材和本场祝福。服药失败不返还这些原物，也不复活已猎杀的原个体。</p>
      <p>再次尝试须实际取得另一原瓶；被耗用遗骸只能在下一真实周取得同种新线索后，重新调查、亲猎与采集，不能从旧尸复制。当前伤势与已付成本保留。</p>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">{playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、采集或施术。"}</p>;
  const pendingNotice = (busy || submittedId !== null) && error === null ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const { bottle } = confirmation;
    return <section className="seer-panel warrior-panel seer-confirmation silver-knight-panel" aria-label="银骑士原瓶服用确认" aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div><h3 ref={confirmationHeading} tabIndex={-1}>{bottle.title}</h3>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      <p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
      <p>本次祭坛检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。完整配方未知，六槽布局、独立成品与当次封护方案为原创G。")}</p>
      {irreversibleCosts()}<section aria-label="银骑士服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
      {ritualFacts()}
      <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。性别不改变，成功后四属性各+1、灵性上限120，当前灵性不补满；旧能力、原伤势与旧人物结局继续保留。</p>
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason" id="silver-knight-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || !liveConfirmation?.enabled} aria-describedby={liveConfirmation?.reason ? "silver-knight-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，保存失败保留这一原意图。</p>{pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel warrior-panel silver-knight-panel" aria-label="银骑士" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="银骑士当前目标"><span className="seer-seal">{value.promoted ? "银骑士 · 战士序列3" : "猎魔者4 → 银骑士3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? "本周目已经死亡，原身体、敌人及原物记录只读保留。"
        : nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.nextStep || (value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看当前公开条件，或继续普通生活。")}</p>
      <p>{value.digestion}</p><p className="slice-muted">{playerText("六种亲猎遗骸、复杂祭坛与祝福的方向已核；本场生物、天使、布局和数值均为原创G。序列2及以上尚未开放。")}</p>
    </section>
    {resources()}
    <label>选择银骑士事项<select aria-label="选择银骑士事项" disabled={locked || value.insideCase || encounter.inside || ritual.inside || life.insideCase}
      value={phase} onChange={event => setSelectedPhase(event.target.value as Phase)}>
      {!value.promoted && <><option value="preparation">独立原瓶与专业准备</option><option value="hunts">六种实际亲猎</option><option value="ritual">原锚、祝福与六槽祭坛</option></>}
      {value.promoted && <><option value="life">三项实际生活实践</option><option value="encounter">洛肯的可选冲突</option></>}
    </select></label>
    {!value.promoted && (phase === "preparation" || phase === "ritual") && selectedBottle && <section aria-label="当前独立银骑士原瓶"><h4>本次原瓶</h4>
      <label>选择独立银骑士原瓶<select aria-label="选择独立银骑士原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}
    {phase === "hunts" && selectedHunt && <section aria-label="当前银骑士亲猎目标"><label>选择亲猎物种<select aria-label="选择亲猎物种" disabled={locked || encounter.inside}
      value={selectedHunt.speciesId} onChange={event => setSpeciesId(event.target.value)}>{encounter.hunts.map(hunt => <option key={hunt.speciesId} value={hunt.speciesId}>{hunt.label} · {HUNT_STATUS[hunt.status] ?? hunt.status}</option>)}</select></label>
      <h4>{selectedHunt.label} · {HUNT_STATUS[selectedHunt.status] ?? selectedHunt.status}</h4>
      <p>{selectedHunt.instanceId ? `同一原个体 ${selectedHunt.instanceId} · 原地点 ${selectedHunt.locationId}` : "尚未亲自调查，没有确认原个体的位置、资源或能力。"}</p>
      <p className="slice-muted">调查1行动；可另付1行动与120便士准备仅对同一原个体有效的2份涂层。接近开战1行动，真实击杀后另付1行动采集；可选择普通退出。</p>
    </section>}
    {phase === "life" && selectedCase && <section className="seer-current-case" aria-label="当前银骑士生活情境"><label>选择银骑士生活情境<select aria-label="选择银骑士生活情境"
      disabled={locked || life.insideCase || life.cases.some(entry => entry.status === "PREPARED")} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
      {life.cases.map(entry => <option key={entry.id} value={entry.id} disabled={entry.status === "AVAILABLE" && !value.actions.some(action => "caseId" in action.command && action.command.caseId === entry.id)}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label><h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施、报告各1行动；现场子步0行动仍计秒、移动并耗用原物。三报告各25、反思25，共13行动。能力实际成功并报告才增加对应掌握8。</p>
    </section>}
    {phase === "ritual" && <p className="seer-next">{ritual.nextStep}</p>}
    {!value.promoted && phase === "ritual" && irreversibleCosts()}
    <section aria-label="银骑士当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "银骑士下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternativeActions.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternativeActions, "银骑士其它公开行动")}</details>}
      {exitActions.length > 0 && <section aria-label="银骑士停止与实际收束"><h4>停止与普通退出</h4>{actionList(exitActions, "银骑士实际收束")}
        <p className="slice-muted">退出沿原普通门路进行，不复活原个体、不返还已耗原物、不补满资源。停止效果不移动本人。</p></section>}
      {unavailableActions.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailableActions, "银骑士尚不可提交的步骤")}</details>}
    </section>
    {phase === "hunts" && huntFacts()}{phase === "ritual" && ritualFacts()}{phase === "life" && lifeFacts()}{phase === "encounter" && encounterFacts()}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><section aria-label="银骑士成品与配方边界"><h4>{playerText("完整配方未知")}</h4>
      <p>{playerText(SILVER_KNIGHT_FORMULA_STATUS)}</p>
      <p>{value.supplies}</p><p>导师奥斯里克·韦尔，58岁，SK3-OSRIC。指导500便士；独立原瓶6400便士，或每瓶五次真实劳务后900便士；三项准备各1行动。本周祭坛准备另付1行动与140便士，原猎魔者须至少12整周且消化100。</p>
      <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
      <p>本次准备：{value.preparedWeek === null ? "尚无已保存准备" : `第${value.preparedWeek}周`}。</p>
      {value.bottles.map(bottle => <p key={bottle.id}>{bottle.title} · {bottle.id} · {bottle.source} · {bottle.status}</p>)}<p>{value.risk}</p>
    </section></details>
    <details className="seer-fold"><summary>六份原遗骸与不可改写的击杀记录</summary><section aria-label="银骑士原遗骸记录"><h4>只认本人实际击杀并采得的同一份遗骸</h4>
      {encounter.remains.length === 0 ? <p>尚无已保存的原遗骸记录。</p> : encounter.remains.map(remains => <article key={remains.id}><h4>{remains.id}</h4>
        <p>原个体 {remains.instanceId} · {remains.speciesId} · 原死亡地点 {remains.originLocationId} · 本人实际击杀，第{remains.killedWeek}周。</p>
        <p>第{remains.collectedWeek}周实际采集 · {REMAINS_STATUS[remains.status] ?? remains.status} · 当前 {remains.locationId}{remains.slotId ? ` · 原槽位 ${remains.slotId}` : ""}{remains.consumedWeek === null ? "" : ` · 第${remains.consumedWeek}周已耗用`}。</p>
      </article>)}<p>投降、他人击杀、购买材料和未采集的原尸均不能替代。耗用旧遗骸不会删除原死亡历史。</p>
    </section></details>
    {value.promoted && <details className="seer-fold"><summary>三项实践的原观察与实际结果</summary><section aria-label="银骑士生活记录">{life.cases.map(entry => <article key={entry.id}>
      <h4>{entry.title}</h4><p>{entry.result ?? "尚无实际结果。"} · 已收束 {entry.closes} 次。</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}{entry.attempts.map(attemptFacts)}
    </article>)}</section></details>}
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary><section aria-label={playerText("银骑士能力与使用范围")}><h4>银甲、借光隐藏与有限传送细剑</h4>
      <p>{playerText(SILVER_KNIGHT_SOURCE_STATUS)}</p>
      {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>{playerText("原晨曦剑继承，细剑不是本人传送。银甲会损伤，借光隐藏可被识破，细剑不必中且可能被高位封锁抵挡。本场6灵性、知识18及所有距离时长为原创G。")}</p>
      <p>不同祝福的具体作用不同，本场不授科林的水银化、随机好运或永久天使伙伴。生活普通收束、失败和取消不增加能力掌握。</p>
    </section></details>
    <details className="seer-fold"><summary>原身体与旧战士路线记录</summary><section aria-label="银骑士继承记录"><h4>原经历与原人物继续保留</h4>
      <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p>承接普通人自然周目与战士至猎魔者的实际经历。灰烬哨卫的投降及原剩涂层继续保存，不能把该投降者当作新猎物或改名取得遗骸。后续晋升、亲猎和生活能力成败只按本周目实际记录显示。</p>
    </section></details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭银骑士页面</button>}{pendingNotice}{saveNotice}
  </section>;

  function huntFacts() {
    if (!selectedHunt) return null;
    return <section aria-label="银骑士原亲猎个体"><h4>当前原个体与独立资源</h4>
      {selectedHunt.instanceId ? <><p>{selectedHunt.instanceId} · {selectedHunt.locationId} · {HUNT_STATUS[selectedHunt.status] ?? selectedHunt.status}。</p>
        <p>健康 {selectedHunt.health} · 精神 {selectedHunt.mind} · 独立灵性 {selectedHunt.spirituality} / {selectedHunt.maxSpirituality}。</p>
        <p>原伤势 {selectedHunt.injuries} 处 · 此原目标剩余涂层 {selectedHunt.coatingsRemaining} 份。</p><p>{selectedHunt.trait}</p></> : <p>须本人实际调查，才公开这一原个体的资源、地点与特性。</p>}
      <p>{selectedHunt.remainsId ? `已采集原遗骸 ${selectedHunt.remainsId}，去向见原遗骸记录。` : "尚未亲自采得这一原个体的原遗骸；真实死亡与实际采集分别记录。"}</p>
      <details className="seer-fold"><summary>亲猎场景与已保存的战斗事实</summary><p>{encounter.story}</p>{encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}</details>
      <p className="slice-muted">{playerText("六种生物及其能力为原创G。退场保留同一原个体的资源、伤势与结局，不重置敌人；亲猎沿用当前猎魔者能力，晋升前不能用银甲或传送细剑。")}</p>
    </section>;
  }
  function ritualFacts() {
    return <section aria-label="银骑士原锚祝福与祭坛"><h4>{ritual.title}</h4><p>{ritual.story}</p>
      <p>原礼堂 {ritual.siteId} · 本人实际位置 {RITUAL_LOCATION[ritual.playerLocation]} · 累计普通行走 {ritual.travelMetres} 米。</p>
      {ritual.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      {ritual.anchor && <details className="seer-fold"><summary>原锚册与关联经历</summary><p>{ritual.anchor.id} · 数量 {ritual.anchor.quantity} · 本人持有</p><p>{ritual.anchor.text}</p>
        <ul>{ritual.anchor.entries.map((entry, index) => <li key={index}>{entry.root === "warrior" ? "战士训练" : "守护者护人"} · {entry.caseId} · 原人 {entry.personId} · 第{entry.eventWeek}周 · 原结果 {entry.outcome}</li>)}</ul>
      </details>}
      {ritual.meetings.length > 0 && <details className="seer-fold"><summary>实际会见与原祝福记录</summary>{ritual.meetings.map(meeting => <article key={meeting.id}>
        <p>{meeting.id} · 第{meeting.requestedWeek}周 · {MEETING_STATUS[meeting.status]} · {meeting.visited ? "本人已走到会见点" : "尚未实际走到会见点"} · {meeting.shown ? "已当面展示原锚与六种亲猎记录" : "尚未当面展示记录"}。</p>
        <p>{meeting.returned ? "本人已沿原路返回。" : "尚未完成实际返程。"}{meeting.decisionTier ? `本次回应：${TIER[meeting.decisionTier]}。` : ""}</p>
        {meeting.blessing && <p>原祝福 {meeting.blessing.id} · 原来源 {meeting.blessing.sourceId} · 第{meeting.blessing.grantedWeek}周 · {BLESSING_STATUS[meeting.blessing.status]}。</p>}
      </article>)}</details>}
      <p className="slice-muted">{playerText("晨印守望者奥瑞尔为原创G天使。本次实际会见和给予祝福分别记录；本人由原门普通6米到会见点、6米返回，再沿4米普通路到祭坛。预约本身不等于得到祝福。")}</p>
    </section>;
  }
  function lifeFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    return <section aria-label="银骑士原人原物与真实位置"><h4>原现场的实际记录</h4>
      {life.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">页面等待不会自行计秒、点灯、移动本人或施放能力；仅显示实际保存的时长、位置与原物去向。</p>
      {attempt && <details className="seer-fold" open={failedTier(attempt.abilityTier)}><summary>本次实际尝试与已付代价</summary>{attemptFacts(attempt, 0)}</details>}
    </section>;
  }
  function attemptFacts(entry: Attempt, index: number) {
    return <article key={index}><p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "能力实际作用后完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"}。</p>
      {entry.abilityTier && <p>本次能力判定：{TIER[entry.abilityTier]}。{failedTier(entry.abilityTier) && "实付成本保留，不能重骰；普通收束不算能力成功。"}</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人普通行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}。</p>
      {entry.playerMoves.map((move, moveIndex) => <p key={moveIndex}>{move.from} → {move.to}：普通行走 {move.metres} 米、{move.seconds} 秒。</p>)}
    </article>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="银骑士原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name}{enemy.age === null ? "" : ` · ${enemy.age}岁`} · {enemy.id} · 原地点 {enemy.locationId}。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / {enemy.maxSpirituality} · {HUNT_STATUS[enemy.status] ?? enemy.status}。</p><p>原伤势 {enemy.injuries} 处，所有实际损耗继续保留。</p></>}
      {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">{playerText("这是可选的原创G原人冲突，可普通离开。独立原资源和实际伤亡保留，关闭页面不治愈、不复活、不开始另一场战斗。")}</p>
    </section>;
  }
}
