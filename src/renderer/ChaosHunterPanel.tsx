import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ChaosHunterAction, ChaosHunterCommand, ChaosHunterProjection } from "../domain/chaos-hunter/types";
import { CHAOS_HUNTER_FORMULA_STATUS, CHAOS_HUNTER_SOURCE_STATUS } from "../domain/chaos-hunter/content";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "原现场尚未收束", EXAMINED: "待收束与报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "尚未询问", GRANTED: "当前仅同意这一次有限动作试验", DECLINED: "当前已拒绝", REVOKED: "已撤回能力参与", ORDINARY: "当前只同意普通行动", CLOSED: "本案接触已结束" };
const ENEMY_STATUS: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "原身体仍活着，已投降", DEAD: "原身体已死亡" };
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP_RULE", "WAIT_EFFECT", "WITHDRAW", "WITHDRAW_CONSENT", "RETURN_PERSON", "RETURN_A", "RETURN_START", "RETURN_OBJECT", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const CANCEL_TYPES = new Set(["STOP_RULE", "WITHDRAW", "WITHDRAW_CONSENT", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
type Goal = "preparation" | "encounter" | `bottle:${string}` | `case:${string}`;
type Confirmation = { action: ChaosHunterAction; facts: string; bottle: ChaosHunterProjection["bottles"][number] };
type Attempt = NonNullable<ChaosHunterProjection["life"]["currentAttempt"]>;
const failed = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const goalFor = (action: ChaosHunterAction): Goal => "bottleId" in action.command ? `bottle:${action.command.bottleId}`
  : "caseId" in action.command ? `case:${action.command.caseId}` : ENCOUNTER_TYPES.has(action.command.type) ? "encounter" : "preparation";

export interface ChaosHunterPanelProps {
  value: ChaosHunterProjection;
  busy?: boolean;
  disabled?: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ChaosHunterCommand) => void;
  /** Local close is available after the original scene has actually been left. It never resolves a scene. */
  onClose?: () => void;
}

/** Local review and selection only. All physical actions and costs await the saved public projection. */
export function ChaosHunterPanel({ value, busy = false, disabled = false, blocked = false, error = null, onCommand, onClose }: ChaosHunterPanelProps) {
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const publicFacts = JSON.stringify(value);
  const locked = busy || disabled || blocked || error !== null || submittedId !== null;
  const dead = value.resources?.health === 0;
  const { life, encounter } = value;
  const liveConfirmation = confirmation && confirmation.facts === publicFacts
    ? value.actions.find(action => action.id === confirmation.action.id && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const activeCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === "PREPARED");
  const preferred = value.actions.find(action => action.id === value.preferredActionId)
    ?? value.actions.find(action => action.enabled && !CANCEL_TYPES.has(action.command.type));
  const firstCase = life.cases.find(entry => entry.status !== "RESOLVED") ?? life.cases[0];
  const defaultGoal: Goal = preferred && preferred.command.type !== "REFLECT" ? goalFor(preferred)
    : value.promoted && firstCase ? `case:${firstCase.id}` : "preparation";
  const selectedGoalAvailable = selectedGoal && (value.promoted
    ? selectedGoal === "encounter" || life.cases.some(entry => selectedGoal === `case:${entry.id}`)
    : selectedGoal === "preparation" || value.bottles.some(entry => selectedGoal === `bottle:${entry.id}`));
  const goal: Goal = encounter.inside ? "encounter" : activeCase ? `case:${activeCase.id}` : (selectedGoalAvailable ? selectedGoal : null) ?? defaultGoal;
  const goals: { id: Goal; label: string }[] = value.promoted
    ? [...life.cases.map(entry => ({ id: `case:${entry.id}` as const, label: `${entry.title} · ${CASE_STATUS[entry.status] ?? entry.status}` })), { id: "encounter", label: "埃德里克的可选原场冲突" }]
    : [{ id: "preparation", label: "独立成品指导与三项专业准备" }, ...value.bottles.map(bottle => ({ id: `bottle:${bottle.id}` as const, label: `${bottle.title} · ${bottle.status}` }))];
  const selectedCase = goal.startsWith("case:") ? life.cases.find(entry => `case:${entry.id}` === goal) : undefined;
  const selectedBottle = goal.startsWith("bottle:") ? value.bottles.find(entry => `bottle:${entry.id}` === goal) : undefined;
  const currentActions = value.actions.filter(action => {
    if (selectedBottle) return "bottleId" in action.command ? action.command.bottleId === selectedBottle.id
      : ["PREPARE_PROMOTION", "LEAVE_PREPARATION"].includes(action.command.type);
    if (selectedCase) return "caseId" in action.command ? action.command.caseId === selectedCase.id : action.command.type === "REFLECT";
    return goalFor(action) === goal;
  });
  const nextAction = currentActions.find(action => action.id === value.preferredActionId)
    ?? currentActions.find(action => action.enabled && !CANCEL_TYPES.has(action.command.type))
    ?? currentActions.find(action => action.enabled) ?? currentActions[0];
  const alternatives = currentActions.filter(action => action !== nextAction && action.enabled && !EXIT_TYPES.has(action.command.type));
  const exits = currentActions.filter(action => action !== nextAction && EXIT_TYPES.has(action.command.type));
  const unavailable = currentActions.filter(action => action !== nextAction && !action.enabled && !EXIT_TYPES.has(action.command.type));
  const attempt = selectedCase ? (life.activeCase === selectedCase.id ? life.currentAttempt : null) ?? selectedCase.attempts.at(-1) ?? null : null;
  const sceneOpen = life.insideCase || encounter.inside;
  const exitNeeded = sceneOpen || value.preparedWeek !== null;
  const closeLocked = locked || (!dead && exitNeeded);

  useEffect(() => { summaryHeading.current?.focus(); }, []);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== publicFacts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); setSelectedGoal(null);
      summaryHeading.current?.focus();
    }
    if (confirmation && submitted.current === null && !busy && error === null && !liveConfirmation) setConfirmation(null);
  }, [publicFacts, busy, error, confirmation, liveConfirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function submit(action: ChaosHunterAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: ChaosHunterAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const bottleId = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === bottleId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: ChaosHunterAction[], label: string) {
    return <div className="warrior-action-list" role="group" aria-label={label}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || dead || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `chaos-hunter-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>{action.reason && <p className="seer-action-reason" id={`chaos-hunter-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="混乱猎手当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div><div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{current.cash}</dd></div><div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function preparationCosts() {
    return <section className="slice-notice seer-risk" aria-label="混乱猎手服药准备与成本"><h4>原瓶与本次准备分别付费</h4>
      <p>本周场地检查需要1行动、140便士；当前{value.preparedWeek === null ? "尚无已保存的本次准备" : `第${value.preparedWeek}周的准备已保存，140便士不退`}。服药0行动，成功或失败都会耗尽所选原瓶。</p>
      <p>可以留在律令法师4。结束已付准备不退行动或140便士，未服原瓶仍保留；排异后须实际取得另一原瓶并重新准备，原失败与已付成本不清除。</p>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">{playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、施术、执行原动作或归还原物。"}</p>;
  const pendingNotice = (busy || submittedId !== null) && error === null ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const { bottle } = confirmation;
    return <section className="seer-panel mystic-panel chaos-hunter-panel seer-confirmation" aria-label="混乱猎手原瓶服用确认" aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">这一独立原瓶 · 服用前确认</div><h3 ref={confirmationHeading} tabIndex={-1}>{bottle.title}</h3>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p><p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
      {preparationCosts()}<section aria-label="混乱猎手服用风险与四档结果"><h4>意志难度30与实际四档风险</h4><p>{value.risk}</p></section>
      <p>{playerText(CHAOS_HUNTER_FORMULA_STATUS)}</p>
      <p>{playerText("成功四属性各+1、灵性上限120，当前灵性不补满；唯一新增的有限双方规则掌握从0开始。同一原身体、年龄、性别与旧伤势保持，旧罗温原投降和原伤不变，原伙伴与原物不重开、不补能。混乱猎手3与平衡者2名称编号已核实；本次新增规则、范围、秒数、专业准备与数值全部为原创G，不下放序列2天使权能。")}</p>
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason" id="chaos-hunter-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || dead || !liveConfirmation?.enabled} aria-describedby={liveConfirmation?.reason ? "chaos-hunter-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，保存失败保留这一原意图。</p>{pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel mystic-panel chaos-hunter-panel" aria-label="混乱猎手" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="混乱猎手当前目标"><span className="seer-seal">{value.promoted ? "混乱猎手 · 审判者序列3" : "律令法师4 → 混乱猎手3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>混乱猎手与有限规则</h3><p className="seer-next"><strong>下一步：</strong>{dead ? "本周目已经死亡，原身体、原人物与原物记录只读保留。"
        : nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}` : value.nextStep}</p>
      <p>{value.digestion}</p>{value.promoted && <p>混乱猎手扮演 {value.acting} / 100</p>}
      <p className="slice-muted">{playerText("混乱猎手3、平衡者2的名称编号已获原文直接支持。完整配方、晋升仪式与本阶完整能力仍未知；本次有限双方规则、范围、秒数、场景、成本与数值全部为原创G。")}</p>
    </section>
    {resources()}
    <label>选择混乱猎手事项<select aria-label="选择混乱猎手事项" disabled={locked || !!activeCase || sceneOpen}
      value={goal} onChange={event => { const selected = goals.find(entry => entry.id === event.target.value); if (selected && !locked && !activeCase && !sceneOpen) setSelectedGoal(selected.id); }}>
      {goals.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select></label>
    {selectedBottle && <section aria-label="当前独立混乱猎手原瓶"><h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id} · {selectedBottle.status}</p><p>来源：{selectedBottle.source}</p></section>}
    {selectedCase && <section className="seer-current-case" aria-label="当前混乱猎手生活情境"><h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">施术只准备20秒有限规则。{selectedCase.id === "own-line" ? "本案仅本人实际试走，米拉不参与。" : "本人和米拉须各自实际尝试。"}自己的规则也约束本人；原标条不是墙。停止规则后亲取同一原包、归还原物，再普通返回START才能退出并报告。</p>
    </section>}
    {!value.promoted && preparationCosts()}
    <section aria-label="混乱猎手当前行动"><h4>{life.insideCase ? "当前原现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "混乱猎手下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternatives, "混乱猎手其它公开行动")}</details>}
      {exits.length > 0 && <section aria-label="混乱猎手停止与真实返程"><h4>停止与真实返程</h4>{actionList(exits, "混乱猎手实际收束")}
        <p className="slice-muted">STOP_RULE只停止尚未应用的规则。已经发生的尝试、行走、位置与结果不能回滚；已付代价不退。0行动仍可实际返程、交还同一原包和原纸、收起原标条，不能瞬移退出。</p></section>}
      {unavailable.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailable, "混乱猎手尚不可提交的步骤")}</details>}
    </section>
    {selectedCase && lifeFacts()}{goal === "encounter" && encounterFacts()}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><section aria-label="混乱猎手成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
      <p>{playerText(CHAOS_HUNTER_FORMULA_STATUS)}</p><p>{value.supplies}</p>
      <p>原导师薇娜·贝尔的指导500便士；每瓶6400便士，或本瓶五次真实劳务抵5500便士后付900便士。律令法师须晋升后满12整周、消化100；三项专业准备各1行动，当周准备另付1行动与140便士。服药须健康&gt;20、精神&gt;40，意志难度30。</p>
      <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
      <p>{playerText("核对原记录、检查有限边界、标明真实退出均为专业准备G，不能代替未知的原著完整仪式。三原瓶耗尽后须申请并等下一真实周独立供货，不重置旧瓶、不开放自制配方。")}</p>
      {value.bottles.map(bottle => <p key={bottle.id}>{bottle.title} · {bottle.id} · {bottle.source} · {bottle.status}</p>)}<p>{value.risk}</p>
    </section></details>
    {value.promoted && <details className="seer-fold"><summary>三项原案的观察与实际结果</summary><section aria-label="混乱猎手生活记录">{life.cases.map(entry => <article key={entry.id}>
      <h4>{entry.title}</h4><p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次。</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}{entry.attempts.map((record, index) => <div key={index}>{attemptFacts(record, entry.id === "own-line")}</div>)}
    </article>)}</section></details>}
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary><section aria-label={playerText("混乱猎手能力与使用范围")}><h4>只针对本次实际越线的有限规则</h4>
      <p>{playerText(CHAOS_HUNTER_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>{playerText("唯一新能力为justiciar.s3.bounded-order，全部是本作原创G。和平施术1行动、5灵性、2精神，知识20四档，只检定一次；成功准备20秒有限规则，仅覆盖本次两人各一次A→B试走。合作演练不额外随机重掷，不等于真实敌人必服从。")}</p>
      <p>本人同样受规则约束，没有自动豁免；米拉是有自主身体与独立心智的成年人。本次当前许可可撤回，必须STOP_RULE后再按当前普通意愿步行。原纸永久写“本次从A到B的越线”，不改原纸、不追改过去、不控制未来或长期意愿。</p>
      <p>三案各观察、准备、实施、报告1行动，另反思1行动，共13行动。普通方案实施1行动、0灵性0精神且不检定；失败、停止、撤回、到期的费用不退。只有双人案或本人案成功且实际拦停后报告各奖掌握8，最多16；撤回案与普通完成不奖掌握。</p>
      <p>实战新K实付5灵性、知识20四档，成功给本人和原敌各一份待用BODY约束，各在自己的实际BODY动作上独立抵抗；当前任一份未用不叠加、不再次收费。ARC、WARD、COMPOSE与有伤J不受这条BODY规则约束。</p>
      <p>原敌实际正贡献BODY抵抗本规则才形成一次违令来源，旧惩戒另付3灵性附加于同一攻击；本人抵抗不是攻击敌人的来源。原敌凝神清旧威慑与剥夺，但不清双方BODY规则；轮末未用规则与来源清除，已付成本不退。</p>
      <p>{playerText("原文的0—36神器光枪与翼封空间不列为序列3通用能力；剥夺黑焰仅是个例，高阶灰白隔绝禁令的边界保留。完整配方、仪式、全部新增规则、范围与次数未核；平衡者2名称编号已核，不下放天使光领域，不声称全知识别罪恶、任意改规则、强制真话或死亡判决。")}</p>
    </section></details>
    <details className="seer-fold"><summary>原人物、原物与旧审判者路线记录</summary><section aria-label="混乱猎手继承记录"><h4>六阶段同一原历史</h4>
      <p>{value.inheritedTools}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p>仲裁人、治安官、审讯者、法官、惩戒骑士与律令法师的原瓶、原能力、失败、伤势、原伙伴与原物全字段保留。旧罗温IM4-ROWAN-KELL是原投降者，不换皮重开，不因新遭遇复位健康、灵性、伤势或风险。</p>
      <p>新米拉CH3-MIRA与新埃德里克CH3-EDRIC各有独立原身体。原埃尔登及原卡、原罩、原标线、原令牌保持旧状态，不移动、不补能、不复制；新案只使用CH3-RULE-PAPER、CH3-PARCEL与CH3-LINE这三件唯一原物。</p>
    </section></details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {onClose && <button className="slice-button quiet" disabled={closeLocked} aria-describedby={!dead && exitNeeded ? "chaos-hunter-close-reason" : undefined} onClick={() => { if (!closeLocked) onClose(); }}>关闭混乱猎手页面</button>}
    {!dead && exitNeeded && <p className="slice-muted" id="chaos-hunter-close-reason">{sceneOpen ? "先停止未用影响、归还原物并实际离开当前现场，再关闭页面。关闭不代替返程，也不撤销已发生的事实。" : "本次服药准备仍在进行；可0行动结束准备再关闭，140便士不退，未服原瓶保留。"}</p>}{pendingNotice}{saveNotice}
  </section>;

  function lifeFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    const current = life.activeCase === selectedCase.id ? life.currentAttempt : null;
    return <section aria-label="混乱猎手原人原物与真实位置"><h4>同一标线、原包与两个真实身体</h4>
      <p>本人实际在{life.playerLocation}，累计普通步行 {life.playerTravelMetres} 米，实际时钟 {life.clockSeconds} 秒。原导师{life.guide.name}在{life.guide.location}，累计真实行走 {life.guideTravelMetres} 米。</p>
      <p>{life.volunteer.name} · {life.volunteer.age}岁 · {life.volunteer.id}，本人实际在{life.volunteer.location}；独立心智，健康 {life.volunteer.health}、精神 {life.volunteer.mind}。{life.volunteer.willing ? "一般愿意参加仍须核对本次当前许可。" : "当前不愿参加，旧许可不能强迫继续。"}</p>
      <p>唯一原纸 {life.paper.id} 永久写“{life.paper.text}”，在{life.paper.location}，由{life.paper.holder === "PLAYER" ? "本人亲手持有" : "原导师持有"}。规则不修改原纸或已经发生的结果。</p>
      <p>唯一350克演练原包 {life.parcel.id} 属于原导师，当前在{life.parcel.location}，{life.parcel.holder === "TABLE" ? "真实放在空桌上" : life.parcel.holder === "PLAYER" ? "由本人亲手持有" : "由原导师持有"}；实际交接 {life.parcel.handovers} 次、归还 {life.parcel.returns} 次。亲取原包必须本人实际到B，不能远程取得或生成副本。</p>
      <p>唯一原标条 {life.line.id} 当前在{life.line.location}，{life.line.holder === "FLOOR" ? "真实放在A的越线路径上" : "由原导师持有"}；实际收回 {life.line.returns} 次。它不是墙，规则停止或失效后仍可普通走过。</p>
      {current && <section aria-label="混乱猎手当前许可与双方待用规则"><h4>当前许可与双方各一次试走</h4>
        <p>当前许可：{CONSENT[current.consent] ?? current.consent}。{current.consentWithdrawn ? "米拉已经撤回本次规则许可，必须STOP_RULE后双方才能各按当前普通意愿走向B。" : "许可只覆盖当前这一次试验，不是未来或长期服从。"}</p>
        <p>{selectedCase.id === "own-line" ? "米拉本案不参与试走，独立留在A自愿看守，不受本案规则效果。" : "本人和米拉各自尝试同一原纸所指的A→B；自己的规则也约束本人，没有自动豁免。两次实际尝试独立保存，不能用另一人的动作代替。"}</p>
        <p>本人当前许可：{current.selfConsent ? "已经明确自己也受同一规则" : "尚未确认自己参与，不可自动豁免"}。</p>
        <p>本次规则：{current.ruleActive ? "当前仍有效，尚未停止" : current.stopped ? "已实际停止" : current.abilityTier === null ? "尚未施术或采用普通方案" : "当前没有有效规则"}；未用效力剩余 {current.pendingRemainingSeconds} 秒；已实际等待 {current.waitedSeconds} 秒。</p>
        {current.ruleExpired && <p>未用规则已经随真实时间到期，不能重复等待推进时间；已付代价不退，没有新增拦停或掌握。</p>}
        {current.ruleCancelled && <p>未用规则已经取消；已付代价不退，已经发生的动作与位置不回滚。</p>}
        <p>{current.playerBlocked || current.partnerBlocked ? "已有实际试走被拦停在A；STOP_RULE只清未用效力，既有尝试、位置与结果不回滚。" : current.ruleActive ? "施术只准备了规则；尚无实际拦停记录，不能把成功检定当成已经改变动作。" : "普通或失效后本人仍须实际行走；停止规则不会替任何人移动或归还原物。"}</p>
        <p>本次已付灵性 {current.spiritualitySpent}、精神 {current.mindSpent}、实施行动 {current.resolutionActions}；{current.abilityTier ? `实际检定${TIER[current.abilityTier] ?? current.abilityTier}` : "没有实际能力检定"}。已经支付的成本不会因失败、停止、撤回或到期而退还。</p>
      </section>}
      {current && executionFacts(current, selectedCase.id === "own-line")}
      {attempt && <details className="seer-fold" open={failed(attempt.abilityTier)}><summary>本次实际尝试与已付代价</summary>{attemptFacts(attempt)}</details>}
      <details className="seer-fold"><summary>原现场公开记录</summary><p>{life.environment}</p>{life.facts.map((fact, index) => <p key={index}>{fact}</p>)}</details>
      <p className="slice-muted">START至A4米，A至B4米；原导师亲携原包去B再回A，原包留在空桌。每人一次实际尝试用1秒；止于A不移动，普通走到B另用4米4秒。米拉在B时须本人自主返回A，玩家不会随她移动。本人取包、带回A、当面交还原包和原纸并收起原标条，再与原导师各自普通返回START。关闭页面与现实等待不会自动计秒、归物或退款。</p>
    </section>;
  }
  function executionFacts(entry: Attempt, own = selectedCase?.id === "own-line", historical = false) {
    return <section aria-label={historical ? "混乱猎手双方原动作历史回执" : "混乱猎手双方各一次真实试走"}><h4>施术检定与本人、伙伴的实际尝试分别保存</h4>
      <p>本人实际尝试 {entry.playerAttempted ? 1 : 0} 次。{entry.playerAttempted ? `实际结果 ${entry.playerResult}；${entry.playerBlocked ? "被有限规则拦停在A，没有移动" : "按普通意愿从A实走4米至B"}。` : "尚未尝试，不显示想象中的结果。"}{entry.playerAtSecond !== null && `本案第${entry.playerAtSecond}秒完成。`}</p>
      <p>{own ? "米拉本案不参与，仍在A自愿看守；不能替本人试走。" : `米拉实际尝试 ${entry.partnerAttempted ? 1 : 0} 次。${entry.partnerAttempted ? `实际结果 ${entry.partnerResult}；${entry.partnerBlocked ? "被有限规则拦停在A，没有移动" : "本人按当前普通意愿从A实走4米至B"}。` : "尚未尝试，与本人的记录分别保留。"}`}{!own && entry.partnerAtSecond !== null && `本案第${entry.partnerAtSecond}秒完成。`}</p>
      <p>{entry.resultRead ? "本人已亲核两人实际位置与同一原纸，本人案只核本人。" : "本人仍须亲核所需的实际位置与同一原纸。"}每人最多一次实际尝试，不重试以覆盖第一次结果；实际返程不会改写这份试走回执。</p>
    </section>;
  }
  function attemptFacts(entry: Attempt, own = selectedCase?.id === "own-line") {
    return <article><p>本次检定：{entry.abilityCheck ? `${entry.abilityCheck.roll} / 100，成功率 ${entry.abilityCheck.chance}%，${TIER[entry.abilityCheck.tier] ?? entry.abilityCheck.tier}` : "尚无实际能力检定"}。{failed(entry.abilityTier) && "失败费用保留，普通收束不当作能力成功。"}</p>
      <p>当前记录许可：{CONSENT[entry.consent] ?? entry.consent}；原许可撤回：{entry.consentWithdrawn ? "已发生" : "未发生"}。规则{entry.ruleActive ? "仍有效" : "当前无效"}，剩余 {entry.pendingRemainingSeconds} 秒；明确停止{entry.stopped ? "已发生" : "尚未发生"}。取消{entry.ruleCancelled ? "已发生" : "未发生"}；到期{entry.ruleExpired ? "已发生" : "未发生"}；已实际等待 {entry.waitedSeconds} 秒。</p>
      {executionFacts(entry, own, true)}
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "有限双方规则方案" : "普通核验方案"}；本案{entry.closed ? "已真实退出" : "尚未真实退出"}。原包、原纸与原标条{entry.objectsReturned ? "已真实归还原主" : "尚未真实归还原主"}，同一原纸{entry.paperRead ? "已亲读" : "尚未亲读"}。</p>
      <p>实际经过 {entry.elapsedSeconds} 秒，本人普通行走 {entry.playerTravelMetres} 米；已付灵性 {entry.spiritualitySpent}、精神 {entry.mindSpent}、实施行动 {entry.resolutionActions}。真实结果：{entry.outcome ?? "尚未形成完成结果。"}</p>
      <p>有限结论{entry.limitedConfirmed ? "已如实确认" : "尚未确认"}；保证声明被拒绝 {entry.rejectedClaims} 次。停止未用规则不退已付代价、不替人返程。</p>
      {entry.evidence.length > 0 && <ol>{entry.evidence.map((fact, index) => <li key={index}>第{fact.atSecond}秒 · 原来源{fact.sourceId}：{fact.text}</li>)}</ol>}
      {entry.playerMoves.map((move, index) => <p key={`player-${index}`}>{move.from} → {move.to}：本人普通步行 {move.metres} 米、{move.seconds} 秒；亲携原物 {move.itemIds.length ? move.itemIds.join("、") : "无"}。</p>)}
      {entry.personMoves.map((move, index) => <p key={`person-${index}`}>{move.from} → {move.to}：同一米拉自主步行 {move.metres} 米、{move.seconds} 秒；亲携原物 {move.itemIds.length ? move.itemIds.join("、") : "无"}。</p>)}
      {entry.objectMoves.map((move, index) => <p key={`object-${index}`}>{move.from} → {move.to}：原物 {move.itemIds.join("、")} 实际随持有人移动 {move.metres} 米、{move.seconds} 秒。</p>)}
      {entry.guideMoves.map((move, index) => <p key={`guide-${index}`}>{move.from} → {move.to}：原导师普通步行 {move.metres} 米、{move.seconds} 秒，亲携 {move.itemIds.length ? move.itemIds.join("、") : "无原物"}。</p>)}
    </article>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene;
    return <section aria-label="混乱猎手原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 独立原创G序列")}{enemy.sequence}对手。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {ENEMY_STATUS[enemy.status] ?? enemy.status}。</p>
        <p>原武器 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "原敌本人持有" : "留在原场"}。</p>
        <p>实际弧光 {enemy.powerUses.ARC_BOLT} 次、屏护 {enemy.powerUses.WARD} 次、凝神 {enemy.powerUses.COMPOSE} 次。原敌术法先付自己的全部费用；不足或被剥夺时回退实际普通BODY，未发动的术法不收费。</p></>}
      {scene && <section aria-label="混乱猎手原战场与真实退路"><h4>净空原院与普通出口</h4>
        <p>原场 {scene.courtId}；本人实际在{scene.playerPosition === "COURT" ? "原院内" : "出口"}。开放出口需普通行走 {scene.exitMetres} 米；已真实离场 {scene.ordinaryWalkedMetres} 米。</p>
        <p>净空{scene.clearanceConfirmed ? "已实际确认" : "尚未当面确认"}，第三人 {scene.thirdPartiesInArea}；原敌距本人 {scene.distanceMetres} 米。</p>
      </section>}
      <section aria-label="混乱猎手战斗双方独立BODY规则"><h4>双方各自待用的一份规则</h4>
        <p>本人BODY规则：{encounter.playerBodyPending ? "仍待本人实际BODY动作独立抵抗" : "当前没有待用约束"}。原敌BODY规则：{encounter.enemyBodyPending ? "仍待原敌实际BODY动作独立抵抗" : "当前没有待用约束"}。</p>
        <p>两份各自判定，不能用原敌的一次动作偷耗本人的那一份；被挡仅使该次BODY贡献为0，抵抗则原动作真实继续。ARC、WARD、COMPOSE与有伤J不受此规则约束。</p>
        <p>原敌违令来源：{encounter.breachReady ? "已有原敌实际正贡献BODY抵抗的真实来源，可另付3灵性用于同一原攻击一次" : "当前没有可消费的真实来源"}。本人的抵抗不能算原敌违令。</p>
        <p>旧威慑{encounter.intimidationReady ? "尚有待用影响" : "没有待用影响"}；旧ARC剥夺{encounter.deprivationReady ? "仍有效" : "当前无效"}。{encounter.composureReady ? "原敌本轮已实际凝神，清旧威慑与剥夺并抵抗本轮B/R；不清双方BODY规则。" : "原敌当前没有本轮凝神抵抗记录。"}</p>
        <p>当前任一BODY约束待用时新K不叠加、不再次收费；轮末未用规则和违令来源清除，已付费用不退。</p>
      </section>
      {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">每轮实际60秒，继续轮仅本人恢复12灵性，原敌永不补能。活人终局沿原出口走4米4秒离开；死者原身体留院，敌死原棍留院，否则仍在原敌手中。旧罗温的原投降、原伤与资源保持，不能换一个名字重新开战。</p>
    </section>;
  }
}
