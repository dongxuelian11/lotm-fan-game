import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { UnagingDemonessAction, UnagingDemonessCommand, UnagingDemonessProjection } from "../domain/unaging-demoness/types";
import { UNAGING_DEMONESS_FORMULA_STATUS, UNAGING_DEMONESS_SOURCE_STATUS } from "../domain/unaging-demoness/content";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "原现场尚未收束", EXAMINED: "待收束与报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "尚未询问", GRANTED: "本案已同意", DECLINED: "本案已拒绝", CLOSED: "本案接触已结束" };
const ENEMY_STATUS: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "原身体仍活着，已投降", DEAD: "原身体已死亡" };
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP_CONTACT", "WITHDRAW", "CLOSE", "RETURN_START", "RETURN_ITEM", "RETURN_INNER_A", "RETURN_ENTRY", "RETURN_A", "TAKE_BACK_PARCEL", "OPEN_SHUTTER", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const CANCEL_TYPES = new Set(["STOP_CONTACT", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
type Goal = "preparation" | "encounter" | `bottle:${string}` | `case:${string}`;
type Confirmation = { action: UnagingDemonessAction; facts: string; bottle: UnagingDemonessProjection["bottles"][number] };
type Attempt = NonNullable<UnagingDemonessProjection["life"]["currentAttempt"]>;
const displayDate = (date: Attempt["date"]) => `${date.year}年${date.month}月${date.day}日`;
const failed = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const goalFor = (action: UnagingDemonessAction): Goal => "bottleId" in action.command ? `bottle:${action.command.bottleId}`
  : "caseId" in action.command ? `case:${action.command.caseId}` : ENCOUNTER_TYPES.has(action.command.type) ? "encounter" : "preparation";

export interface UnagingDemonessPanelProps {
  value: UnagingDemonessProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: UnagingDemonessCommand) => void;
  /** Closing this view does not close an entrance, move a body or return an original item. */
  onClose?: () => void;
}

/** Local selection and review only. All costs, movement and outcomes come from committed public facts. */
export function UnagingDemonessPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: UnagingDemonessPanelProps) {
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
  const locked = busy || blocked || error !== null || submittedId !== null;
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
  const goal: Goal = encounter.inside ? "encounter" : activeCase ? `case:${activeCase.id}` : selectedGoal ?? defaultGoal;
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
  const attempt = selectedCase ? life.currentAttempt ?? selectedCase.attempts.at(-1) ?? null : null;

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

  function submit(action: UnagingDemonessAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: UnagingDemonessAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const bottleId = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === bottleId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: UnagingDemonessAction[], label: string) {
    return <div className="warrior-action-list" role="group" aria-label={label}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `unaging-demoness-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>{action.reason && <p className="seer-action-reason" id={`unaging-demoness-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="不老魔女当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div><div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{current.cash}</dd></div><div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function preparationCosts() {
    return <section className="slice-notice seer-risk" aria-label="不老魔女服药准备与成本"><h4>原瓶与本次准备分别付费</h4>
      <p>本周场地检查需要1行动、140便士；当前{value.preparedWeek === null ? "尚无已保存的本次准备" : `第${value.preparedWeek}周的准备已保存，140便士不退`}。服药0行动，成功或失败都会耗尽所选原瓶。</p>
      <p>可以留在绝望魔女4。结束已付准备不退行动或140便士，未服原瓶仍保留；排异后须实际取得另一原瓶并重新准备，原失败与已付成本不清除。</p>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">{playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、入镜或移动原物。"}</p>;
  const pendingNotice = (busy || submittedId !== null) && error === null ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const { bottle } = confirmation;
    return <section className="seer-panel witch-panel unaging-demoness-panel seer-confirmation" aria-label="不老魔女原瓶服用确认" aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">这一独立原瓶 · 服用前确认</div><h3 ref={confirmationHeading} tabIndex={-1}>{bottle.title}</h3>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p><p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
      {preparationCosts()}<section aria-label="不老魔女服用风险与四档结果"><h4>意志难度30与实际四档风险</h4><p>{value.risk}</p></section>
      <p>{playerText(UNAGING_DEMONESS_FORMULA_STATUS)}</p>
      <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。性别、原创建年龄、原身体与持物不改变；成功四属性各+1、灵性上限120，当前灵性不补满。不把年龄重置为18，不提供自动复活或免死。</p>
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason" id="unaging-demoness-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || !liveConfirmation?.enabled} aria-describedby={liveConfirmation?.reason ? "unaging-demoness-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，保存失败保留这一原意图。</p>{pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel witch-panel unaging-demoness-panel" aria-label="不老魔女" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="不老魔女当前目标"><span className="seer-seal">{value.promoted ? "不老魔女 · 魔女序列3" : "绝望魔女4 → 不老魔女3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3><p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? "本周目已经死亡，原身体、原人物与原物记录只读保留。"
        : nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}` : value.nextStep}</p>
      <p>{value.digestion}</p><p className="slice-muted">{playerText("已核长寿年轻外观与镜界道路方向；本场原镜、人物、有限路线与数值均为原创G。完整配方与原著晋升仪式未知，序列2及以上尚未开放。")}</p>
    </section>
    {resources()}
    <label>选择不老魔女事项<select aria-label="选择不老魔女事项" disabled={locked || !!activeCase || life.insideCase || encounter.inside}
      value={goal} onChange={event => setSelectedGoal(event.target.value as Goal)}>
      {!value.promoted && <><option value="preparation">独立成品指导与三项专业准备</option>{value.bottles.map(bottle => <option key={bottle.id} value={`bottle:${bottle.id}`}>{bottle.title} · {bottle.status}</option>)}</>}
      {value.promoted && <>{life.cases.map(entry => <option key={entry.id} value={`case:${entry.id}`}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}<option value="encounter">科宾的可选原镜冲突</option></>}
    </select></label>
    {selectedBottle && <section aria-label="当前独立不老魔女原瓶"><h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id} · {selectedBottle.status}</p><p>来源：{selectedBottle.source}</p></section>}
    {selectedCase && <section className="seer-current-case" aria-label="当前不老魔女生活情境"><h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施、报告各1行动；三报告各25、反思25，共13行动。原日期记录始终是普通核查，不增加镜路掌握；镜路实际成功并报告才增加掌握8。</p>
    </section>}
    {!value.promoted && preparationCosts()}
    <section aria-label="不老魔女当前行动"><h4>{life.insideCase ? "当前原现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "不老魔女下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternatives, "不老魔女其它公开行动")}</details>}
      {exits.length > 0 && <section aria-label="不老魔女停止与真实返程"><h4>停止与真实返程</h4>{actionList(exits, "不老魔女实际收束")}
        <p className="slice-muted">0行动清理仍须实际移动与归还。停止、撤回许可或关闭页面不传送本人，不打开远处封板，不返还已耗灵性。</p></section>}
      {unavailable.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailable, "不老魔女尚不可提交的步骤")}</details>}
    </section>
    {selectedCase && lifeFacts()}{goal === "encounter" && encounterFacts()}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><section aria-label="不老魔女成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
      <p>{playerText(UNAGING_DEMONESS_FORMULA_STATUS)}</p><p>{value.supplies}</p>
      <p>{playerText("原创G导师米蕾尔·阿什顿，54岁，UD3-MIREL。指导500便士；每瓶6400便士，或本瓶五次真实劳务后900便士；三项专业准备各1行动。绝望魔女须至少12整周、消化100，再付本周准备1行动与140便士。")}</p>
      <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
      <p>原锚参照自己的实际既往选择、服药、照护与原身体记录，不凭空生成朋友、来信或信众。原三瓶耗尽后须实际申请并等下一真实周补货。</p>
      {value.bottles.map(bottle => <p key={bottle.id}>{bottle.title} · {bottle.id} · {bottle.source} · {bottle.status}</p>)}<p>{value.risk}</p>
    </section></details>
    {value.promoted && <details className="seer-fold"><summary>三项原案的观察与实际结果</summary><section aria-label="不老魔女生活记录">{life.cases.map(entry => <article key={entry.id}>
      <h4>{entry.title}</h4><p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次。</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}{entry.attempts.map(attemptFacts)}
    </article>)}</section></details>}
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary><section aria-label={playerText("不老魔女能力与使用范围")}><h4>同一身体的有限镜路</h4>
      <p>{playerText(UNAGING_DEMONESS_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>本场只开放两面原镜间的已知6米道路。进入与B端退出各自需要6灵性、知识18判定；一次成功进入不保证另一次退出成功。原包上限只限本场这件不超过1千克的封包。</p>
      <p>受控演练的原入口只供本次实际原路返身；高位截留仍可能发生，不保证逃脱，不接任意全球镜面网络，不提供免费镜替复活、真空免疫或固定寿命。失败、普通记录、取消及普通送件不冒充能力掌握。</p>
    </section></details>
    <details className="seer-fold"><summary>原身体、年轻外观与旧魔女路线记录</summary><section aria-label="不老魔女继承记录"><h4>同一原身体与原履历</h4>
      <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别、原创建年龄或持物。</p>{value.appearanceRecord && <p>{value.appearanceRecord}</p>}
      <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p>年轻外观不是过去被改写的证据。旧瓦伦的投降、已付照护与既往疾病终值分别保留；离场与晋升不治疗旧伤、不复活旧人，旧掌握0仍为0。</p>
    </section></details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭不老魔女页面</button>}{pendingNotice}{saveNotice}
  </section>;

  function lifeFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    return <section aria-label="不老魔女原人原物与真实位置"><h4>同一身体、原物与当前出口</h4>
      {life.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      {attempt && <p>本次原主许可：{CONSENT[attempt.ownerConsent] ?? attempt.ownerConsent}；原观察员许可：{CONSENT[attempt.observerConsent] ?? attempt.observerConsent}。本次已付灵性 {attempt.spiritualitySpent}，实际行走/跨槛 {attempt.playerTravelMetres} 米，实际经过 {attempt.elapsedSeconds} 秒。</p>}
      {selectedCase.id === "dated-record" && <section aria-label="不老魔女原日期登记"><h4>原记录中实际核读的来源</h4>
        <p>原旧画人名：{life.register.oldNameRead ?? "尚未核读"}；原旧日期：{life.register.oldDateRead ? displayDate(life.register.oldDateRead) : "尚未核读"}。</p>
        <p>原当事人当面说明：{life.register.currentStatement ?? "尚未实际听取"}</p>
        <p>本次原登记日期：{life.register.writtenDate ? displayDate(life.register.writtenDate) : "尚未写入"}；结论：{life.register.conclusion ?? "尚未写入"}</p>
      </section>}
      <p className="slice-muted">页面等待不会自行计秒、开镜、移动身体或归还原包。灵性不足时只能按当前公开的原路返身或外部普通路行动；不会自动补灵或保证所有镜内情形都能脱困。</p>
      {attempt && <details className="seer-fold" open={failed(attempt.entryTier) || failed(attempt.exitTier)}><summary>本次实际尝试与已付代价</summary>{attemptFacts(attempt, 0)}</details>}
    </section>;
  }
  function attemptFacts(entry: Attempt, index: number) {
    return <article key={index}><p>第{entry.week}周 · {entry.method === "ABILITY" ? "镜路方法准备" : "普通方法准备"} · {entry.result === "ABILITY" ? "实际镜路通行后完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"}。</p>
      <p>原主许可：{CONSENT[entry.ownerConsent] ?? entry.ownerConsent}；原观察员许可：{CONSENT[entry.observerConsent] ?? entry.observerConsent}。</p>
      {entry.entryTier && <p>本次进入判定：{TIER[entry.entryTier]}。</p>}{entry.exitTier && <p>本次B端退出判定：{TIER[entry.exitTier]}。</p>}
      {(failed(entry.entryTier) || failed(entry.exitTier)) && <p>实付成本保留，不能重骰；普通返程和报告不算能力成功。</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人实际行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}。</p>
      {entry.playerMoves.map((move, moveIndex) => <p key={moveIndex}>{move.from} → {move.to}：{move.mode === "MIRROR_STEP" ? "同一本体跨原镜槛" : "本人实际行走"} {move.metres} 米、{move.seconds} 秒；携行原物 {move.itemIds.length ? move.itemIds.join("、") : "无"}。</p>)}
    </article>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="不老魔女原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁 · {enemy.id}。</p><p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {ENEMY_STATUS[enemy.status] ?? enemy.status}。</p>
        <p>原武器 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "原敌本人持有" : "留在原院"}。</p></>}
      {encounter.scene && <section aria-label="不老魔女原战斗镜与真实退路"><h4>当前原镜与本人实际位置</h4>
        <p>原院 {encounter.scene.courtId} · 本人实际在{encounter.scene.playerPosition}。</p>
        <p>{encounter.scene.mirrorA.id}：{encounter.scene.mirrorA.intact ? "原镜完好" : "原镜已破损"}；{encounter.scene.mirrorB.id}：{encounter.scene.mirrorB.intact ? "原镜完好" : "原镜已破损"}。两镜实际相距 {encounter.scene.mirrorsDistanceMetres} 米。</p>
        <p>原普通出口{encounter.scene.ordinaryExit === "OPEN" ? "实际开放" : "尚未确认"}；A至出口 {encounter.scene.exits.A} 米，B至出口 {encounter.scene.exits.B} 米，须本人实走。累计镜路 {encounter.scene.mirrorPassedMetres} 米，普通离场 {encounter.scene.ordinaryWalkedMetres} 米。</p>
      </section>}
      {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">{playerText("这是可选的原创G原人冲突。两面原镜能实际破损，破镜和资源不足时走普通回退；损毁跨战保留，不凭空修镜。有限镜路不同时攻击，不保证逃脱或复活。普通出口仍须本人实际走到。")}</p>
    </section>;
  }
}
