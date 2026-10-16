import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SilentDiscipleAction, SilentDiscipleCommand, SilentDiscipleProjection } from "../domain/silent-disciple/types";
import { SILENT_DISCIPLE_FORMULA_STATUS, SILENT_DISCIPLE_SOURCE_STATUS } from "../domain/silent-disciple/content";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "原现场尚未收束", EXAMINED: "待收束与报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "尚未询问", GRANTED: "当前仅同意本次短促试验", DECLINED: "当前已拒绝", REVOKED: "已撤回同意", CLOSED: "本案接触已结束" };
const ENEMY_STATUS: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "原身体仍活着，已投降", DEAD: "原身体已死亡" };
const ENCOUNTER_TYPES = new Set(["BUY_BLOCKS", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const MOON_TYPES = new Set(["READ_MOON_NOTICE", "GUIDED_REST", "ENDURE_REST", "WAIT_MOON"]);
const EXIT_TYPES = new Set(["STOP_INPUT", "WAIT_FORM", "RELEASE_FORM", "DROP_LINK", "WAIT_LINK", "WITHDRAW", "RETURN_A", "RETURN_START", "RETURN_ITEMS", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const CANCEL_TYPES = new Set(["STOP_INPUT", "WITHDRAW", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
type Goal = "preparation" | "encounter" | "moon" | `bottle:${string}` | `case:${string}`;
type Confirmation = { action: SilentDiscipleAction; facts: string; bottle: SilentDiscipleProjection["bottles"][number] };
type Attempt = NonNullable<SilentDiscipleProjection["life"]["currentAttempt"]>;
const failed = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const goalFor = (action: SilentDiscipleAction): Goal => "bottleId" in action.command ? `bottle:${action.command.bottleId}`
  : "caseId" in action.command ? `case:${action.command.caseId}` : ENCOUNTER_TYPES.has(action.command.type) ? "encounter" : MOON_TYPES.has(action.command.type) ? "moon" : "preparation";

export interface SilentDisciplePanelProps {
  value: SilentDiscipleProjection;
  busy?: boolean;
  disabled?: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: SilentDiscipleCommand) => void;
  /** Closing this view does not stop input, revert a body, remove a link, return original items or advance time. */
  onClose?: () => void;
}

/** Displays saved public facts and submits projected intentions without resolving the scene locally. */
export function SilentDisciplePanel({ value, busy = false, disabled = false, blocked = false, error = null, onCommand, onClose }: SilentDisciplePanelProps) {
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
    ? selectedGoal === "encounter" || selectedGoal === "moon" || life.cases.some(entry => selectedGoal === `case:${entry.id}`)
    : selectedGoal === "preparation" || value.bottles.some(entry => selectedGoal === `bottle:${entry.id}`));
  const goal: Goal = encounter.inside ? "encounter" : ["ANNOUNCED", "RESTING"].includes(life.moon.status) ? "moon" : activeCase ? `case:${activeCase.id}` : (selectedGoalAvailable ? selectedGoal : null) ?? defaultGoal;
  const goals: { id: Goal; label: string }[] = value.promoted
    ? [...life.cases.map(entry => ({ id: `case:${entry.id}` as const, label: `${entry.title} · ${CASE_STATUS[entry.status] ?? entry.status}` })), { id: "moon", label: "有限G月相告示" }, { id: "encounter", label: "卡尔德的可选原场冲突" }]
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

  function submit(action: SilentDiscipleAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: SilentDiscipleAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const bottleId = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === bottleId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: SilentDiscipleAction[], label: string) {
    return <div className="warrior-action-list" role="group" aria-label={label}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || dead || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `silent-disciple-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>{action.reason && <p className="seer-action-reason" id={`silent-disciple-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="沉默门徒当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div><div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{current.cash}</dd></div><div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function preparationCosts() {
    return <section className="slice-notice seer-risk" aria-label="沉默门徒服药准备与成本"><h4>原瓶与本次准备分别付费</h4>
      <p>本周场地检查需要1行动、140便士；当前{value.preparedWeek === null ? "尚无已保存的本次准备" : `第${value.preparedWeek}周的准备已保存，140便士不退`}。服药0行动，成功或失败都会耗尽所选原瓶。</p>
      <p>可以留在木偶4。结束已付准备不退行动或140便士，未服原瓶仍保留；排异后须实际取得另一原瓶并重新准备，原失败与已付成本不清除。</p>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">{playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、变形、建立联系或归还原物。"}</p>;
  const pendingNotice = (busy || submittedId !== null) && error === null ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const { bottle } = confirmation;
    return <section className="seer-panel mystic-panel silent-disciple-panel seer-confirmation" aria-label="沉默门徒原瓶服用确认" aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">这一独立原瓶 · 服用前确认</div><h3 ref={confirmationHeading} tabIndex={-1}>{bottle.title}</h3>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p><p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
      {preparationCosts()}<section aria-label="沉默门徒服用风险与四档结果"><h4>意志难度30与实际四档风险</h4><p>{value.risk}</p></section>
      <p>{playerText(SILENT_DISCIPLE_FORMULA_STATUS)}</p>
      <p>晋升保留同一原身体、原人物与原物。成功四属性各+1、灵性上限120，当前灵性不补满；只新增短时变形与有限联系，掌握均从0开始；旧能力、原伤势与已付风险不重置。序列2古代邪物与序列1神孽不是本次开放内容。</p>
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason" id="silent-disciple-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || dead || !liveConfirmation?.enabled} aria-describedby={liveConfirmation?.reason ? "silent-disciple-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，保存失败保留这一原意图。</p>{pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel mystic-panel silent-disciple-panel" aria-label="沉默门徒" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="沉默门徒当前目标"><span className="seer-seal">{value.promoted ? "沉默门徒 · 被缚者序列3" : "木偶4 → 沉默门徒3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>沉默门徒与有限变形</h3><p className="seer-next"><strong>下一步：</strong>{dead ? "本周目已经死亡，原身体、原人物与原物记录只读保留。"
        : nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}` : value.nextStep}</p>
      <p>{value.digestion}</p>{value.promoted && <p>沉默门徒扮演 {value.acting} / 100</p>}
      <p className="slice-muted">{playerText("原著支持序列3名称与变形诅咒方向，完整配方、晋升仪式和序列3具体月圆规则仍未知。本场人物、兔形、期限、抵抗、距离与费用均为原创G；职业名称不自动赋予沉默能力。")}</p>
    </section>
    {resources()}
    <label>选择沉默门徒事项<select aria-label="选择沉默门徒事项" disabled={locked || !!activeCase || life.insideCase || encounter.inside || ["ANNOUNCED", "RESTING"].includes(life.moon.status)}
      value={goal} onChange={event => { const selected = goals.find(entry => entry.id === event.target.value); if (selected && !locked) setSelectedGoal(selected.id); }}>
      {goals.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select></label>
    {selectedBottle && <section aria-label="当前独立沉默门徒原瓶"><h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id} · {selectedBottle.status}</p><p>来源：{selectedBottle.source}</p></section>}
    {selectedCase && <section className="seer-current-case" aria-label="当前沉默门徒生活情境"><h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">每案观察、准备、首次实际实施或普通核验、报告各1行动；三报告各25、反思25，共13行动。进入原现场不自动施术。能力失败后可用已付实施行动普通补查；普通报告不算能力成功，仅真实成功的新能力各增加掌握8。</p>
    </section>}
    {!value.promoted && preparationCosts()}{goal === "moon" && moonFacts()}
    <section aria-label="沉默门徒当前行动"><h4>{life.insideCase ? "当前原现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "沉默门徒下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternatives, "沉默门徒其它公开行动")}</details>}
      {exits.length > 0 && <section aria-label="沉默门徒停止与真实返程"><h4>停止与真实返程</h4>{actionList(exits, "沉默门徒实际收束")}</section>}
      {selectedCase && <p className="slice-muted">0行动清理仍须实际停输入、等待或解除、归还原衣物与原包，再沿原路退出。停止不瞬间恢复兔形；灵性不足时活着的本人仍可实际等待期限。关闭页面不计时、不恢复身体、不归物、不退款。</p>}
      {unavailable.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailable, "沉默门徒尚不可提交的步骤")}</details>}
    </section>
    {selectedCase && lifeFacts()}{goal === "encounter" && encounterFacts()}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><section aria-label="沉默门徒成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
      <p>{playerText(SILENT_DISCIPLE_FORMULA_STATUS)}</p><p>{value.supplies}</p>
      <p>沿用同一原成年导师哈伦·维斯。指导500便士；每瓶6400便士，或本瓶五次真实劳务抵5500后付900便士；三项专业准备各1行动。木偶须晋升后至少12整周、消化100，再付本周准备1行动与140便士。</p>
      <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
      <p>{playerText("专业准备是原创G：核对旧记录、安静房间与实际来源、退出与撤回路线，不充当原著仪式。不把特定木乃伊要求当作本职业通用仪式。三瓶耗尽后须实际申请并等下一真实周补货；不开放未知配方自制。")}</p>
      {value.bottles.map(bottle => <p key={bottle.id}>{bottle.title} · {bottle.id} · {bottle.source} · {bottle.status}</p>)}<p>{value.risk}</p>
    </section></details>
    {value.promoted && <details className="seer-fold"><summary>三项原案的观察与实际结果</summary><section aria-label="沉默门徒生活记录">{life.cases.map(entry => <article key={entry.id}>
      <h4>{entry.title}</h4><p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次。</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}{entry.attempts.map((record, index) => <div key={index}>{attemptFacts(record)}</div>)}
    </article>)}</section></details>}
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary><section aria-label={playerText("沉默门徒能力与使用范围")}><h4>同一身体的短时变形与有代价联系</h4>
      <p>{playerText(SILENT_DISCIPLE_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>{playerText("和平变形须本人到A核对埃尔莎的当前许可，实付5灵性、2精神、知识20检定；成功仅同一原身体变为兔形60秒G，原健康、精神、灵性与伤势保留。兔与人不是两个同时存在的身体；失败照付，原人仍为HUMAN。")}</p>
      <p>{playerText("有限联系须当前许可与实际2米内接触，实付4灵性、1精神、知识18检定，成功LINKED30秒G。志愿者只许可短暂无伤联系，未许可受伤、反伤或身体控制；没有实际伤害就不能声称反伤掌握。")}</p>
      <p>战斗默认有限变形策略也须先建立实际同一目标联系，再另付5灵性、2精神检查变形；重复不叠加、不刷新期限。原对手仍可抵抗与实际挣断，不能绝对禁用高位能力。主动选择继承伤己联系策略仍须真实自身诅咒形态与真实自伤，不是零代价或无限反射。</p>
    </section></details>
    <details className="seer-fold"><summary>原人物、原物与旧被缚者路线记录</summary><section aria-label="沉默门徒继承记录"><h4>原六阶段的实际原物与经历</h4>
      <p>{value.inheritedTools}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p>旧囚犯、疯子、狼人、活尸、怨魂与木偶六阶段记录保留。原埃德林的原伤势、灵性与投降结局不重开，原木块仍在各自真实位置；旧能力、原瓶和月圆历史继续保存，不补库存、不免费治疗或新增身体。</p>
    </section></details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭沉默门徒页面</button>}{pendingNotice}{saveNotice}
  </section>;

  function lifeFacts() {
    const current = life.currentAttempt;
    return <section aria-label="沉默门徒原身体原物与真实位置" aria-live="polite"><h4>同一原身体、原衣物与实际路径</h4>
      <p>原场 {life.siteId}；本人实际在{life.playerLocation}，累计普通步行 {life.playerTravelMetres} 米，实际时钟 {life.clockSeconds} 秒。</p>
      <section aria-label="埃尔莎同一原身体"><h4>{life.volunteer.name} · {life.volunteer.age}岁 · {life.volunteer.id}</h4>
        <p>唯一身体 {life.volunteer.bodyId}；当前{life.volunteer.form === "RABBIT" ? "RABBIT兔形" : "HUMAN人形"}，实际仍在{life.volunteer.location}。同一身份与同一身体连续，不另留一个人形副本。</p>
        <p>原健康 {life.volunteer.health} · 原精神 {life.volunteer.mind} · 原灵性 {life.volunteer.spirituality} · 原伤势 {life.volunteer.injuries.length} 处。变形与复原均不治疗、不退款。</p>
        <p>{life.volunteer.willing ? "一般愿意参与不等于每次都有当前同意。" : "她当前不愿参与，旧许可不能迫使继续。"}</p>
      </section>
      <section aria-label="沉默门徒原衣物与原包"><h4>唯一原衣物与原包的实际去向</h4>
        <p>{life.clothing.id} · 原主人{life.clothing.owner} · 数量 {life.clothing.quantity} · 当前{life.clothing.location === "TRAY" ? "在原托盘" : "由埃尔莎本人持有"}；{life.clothing.worn ? "本人当前实际穿着" : "尚未实际穿回"}。</p>
        <p>{life.bag.id} · 原主人{life.bag.owner} · 数量 {life.bag.quantity} · 当前{life.bag.location === "TRAY" ? "在原托盘" : "由埃尔莎本人持有"}。</p>
        <p>原托盘 {life.tray.id} 在{life.tray.location}，PRIVATE私密处置。更衣在私密空间抽象处理；恢复人形后仍须RETURN_ITEMS实际归还同一衣物并穿回、取回原包，不能凭空装备或复制。</p>
      </section>
      <p>原记录纸 {life.note.id} 实际在{life.note.location}；原导师{life.guide.name}（{life.guide.id}）实际在{life.guide.location}{playerText("。导师只按本场G约定协助，不是原著瞬间解咒能力。")}</p>
      {current && <section aria-label="沉默门徒当前许可与剩余期限"><h4>当前许可、原来源与实际剩余时间</h4>
        <p>当前许可：{CONSENT[current.consent] ?? current.consent}。{current.consent === "REVOKED" || current.consent === "DECLINED" ? "当前拒绝或撤回仍有效，不能再次输入或沿用原许可。" : "一次许可只覆盖本案有限试验，不能扩展为伤害或控制。"}</p>
        <p>新输入{current.inputActive ? "仍在进行，尚须实际停止" : current.stopped ? "已实际停止" : "尚未实际施加"}；同一身体当前剩余兔形 {current.formRemainingSeconds} 秒；当前联系 {current.linkState}，剩余 {current.linkRemainingSeconds} 秒；已实际等待 {current.waitedSeconds} 秒。</p>
        <p>真实能力来源 {current.abilitySourceId ?? "尚无实际能力来源"}；{current.abilityTier ? `本次判定${TIER[current.abilityTier] ?? current.abilityTier}` : "本次未实际尝试，不虚构形态或联系"}。
          {failed(current.abilityTier) && "失败成本保留，可普通补查，不能冒充能力成功。"}</p>
        {current.formRemainingSeconds > 0 && <p className="slice-notice">停输入不会立即变回人形。可付2灵性、0行动有限解除，或0灵性、0行动实际等待剩余期限；复原只作用于同一身体，原衣物仍在实际原处。</p>}
        {current.linkRemainingSeconds > 0 && <p className="slice-notice">可0行动DROP_LINK解除，或WAIT_LINK实际等待剩余期限；志愿者未授权任何自伤、传伤或控制。</p>}
        <p>原身份{current.identityRead ? "已当面读过" : "尚未当面读过"}；原纸{current.noteRead ? "已实际读取" : "尚未实际读取"}；同一身份{current.identityCompared ? "已实际比较" : "尚未实际比较"}；原物{current.itemsReturned ? "已真实归还并穿回" : current.itemsStored ? "已存入原托盘，尚未真实归还" : "未作本次存放"}。</p>
        <p>已付灵性 {current.spiritualitySpent}、精神 {current.mindSpent}、实施行动 {current.resolutionActions}；{current.ordinaryChecked ? "已实际完成普通核验，未凭此获得能力掌握。" : "尚未实际完成普通核验。"}</p>
      </section>}
      {life.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      {attempt && <details className="seer-fold" open={failed(attempt.abilityTier)}><summary>本次实际尝试与已付代价</summary>{attemptFacts(attempt)}</details>}
      <p className="slice-muted">START至A4米，A至B4米；读取B原纸后须本人走4米回A核同一身体、归物，再4米回START，完整核验路线16米。页面等待不会自动计秒。0行动收束仍保留实际行走、时间、撤回与原物记录。</p>
    </section>;
  }
  function attemptFacts(entry: Attempt) {
    return <article><p>第{entry.week}周 · {entry.method === "ABILITY" ? "有限能力方案准备" : "普通核验方案准备"} · {entry.result === "ABILITY" ? "能力实际成功并真实核验" : entry.result === "ORDINARY" ? "普通核验完成，不计能力成功" : "尚无完成结果"}。</p>
      <p>本次记录许可：{CONSENT[entry.consent] ?? entry.consent}；方案{entry.withdrawn ? "已实际撤回" : "尚未撤回"}；现场{entry.closed ? "已实际收束" : "尚未实际收束"}。</p>
      <p>原能力来源 {entry.abilitySourceId ?? "尚无"}；{entry.abilityTier ? `实际判定${TIER[entry.abilityTier] ?? entry.abilityTier}` : "未施加能力，不虚构兔形或联系"}。{entry.abilityAtSecond !== null && `记录于本案第${entry.abilityAtSecond}秒。`}</p>
      <p>该记录输入{entry.inputActive ? "尚未实际停止" : entry.stopped ? "已实际停止" : "未开始"}，剩余兔形 {entry.formRemainingSeconds} 秒，联系 {entry.linkState}、剩余 {entry.linkRemainingSeconds} 秒；已实际等待 {entry.waitedSeconds} 秒。</p>
      <p>原身份{entry.identityRead ? "已当面核读" : "尚未核读"}；原纸{entry.noteRead ? "已实际核读" : "尚未核读"}；身份{entry.identityCompared ? "已真实比较" : "尚未比较"}；原衣物与包{entry.itemsReturned ? "已真实归还" : entry.itemsStored ? "曾实际存入托盘，尚未归还" : "未作本次存放"}。</p>
      <p>当时比较的真实形态 {entry.comparedForm ?? "尚未比较"}；保留当时原观察，不以当前复原后的形态改写。{entry.released ? "本次已实际主动解除。" : entry.waitCompleted ? "本次已实际完成等待。" : "本次尚无解除或完成等待记录。"}</p>
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人实际行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}、精神 {entry.mindSpent}、实施行动 {entry.resolutionActions}。</p>
      <p>真实结果：{entry.outcome ?? "尚未形成当前真实结果。"}{failed(entry.abilityTier) && "失败成本不退；普通补查不加能力掌握。"}</p>
      {entry.evidence.length > 0 ? <ol>{entry.evidence.map((fact, index) => <li key={index}>第{fact.atSecond}秒 · 原来源{fact.sourceId}：{fact.text}</li>)}</ol> : <p>尚无当面取得的原证据，不填入想象的结果。</p>}
      {entry.playerMoves.map((move, index) => <p key={index}>{move.from} → {move.to}：本人实际步行 {move.metres} 米、{move.seconds} 秒；携行原物 {move.itemIds.length ? move.itemIds.join("、") : "无"}。</p>)}
    </article>;
  }
  function moonFacts() {
    const moon = life.moon;
    const status = { UNREAD: "尚未读取原告示", ANNOUNCED: "已读取，尚待选择", RESTING: "已付实际成本，尚待休息期结束", RESOLVED: "该唯一事件已实际结束" };
    return <section aria-label={playerText("沉默门徒有限G月相告示")}><h4>{playerText("当地观测所的告示")}</h4>
      <p>原来源 {moon.id} · {status[moon.status]}。{moon.announcedWeek !== null && `实际读取于第${moon.announcedWeek}周。`}</p>
      <p>{playerText("晋升满2整周后可选择读取这张独立地方观测所公告；不是每4周自动触发。序列3具体原著月圆诅咒未知，这只是一次原创G安排，不叠加狼人、活尸、怨魂或木偶旧发作。")}</p>
      <section className="slice-notice" aria-label="沉默门徒月相选择前实际成本"><h4>选择前的费用与时间</h4>
        <p>GUIDED_REST：1行动、60便士、至多精神−8；ENDURE_REST：1行动、至多精神−18，实际不超过当前精神。两者均须实际休息3600秒，不回复健康、吸收灵魂或增加身体。</p>
        <p>可以不读取并继续普通生活。读过后须解决这同一事件再开始新实践、战斗或服药；退出页面不取消事件、不退已付精神或现金，不能重复领取收益。</p>
      </section>
      <p>当前选择 {moon.choice ?? "尚未选择"}；已付精神 {moon.mindSpent}、现金 {moon.cashSpent} 便士；已实际经过 {moon.elapsedSeconds} 秒，剩余 {moon.remainingSeconds} 秒。WAIT_MOON提交实际等待，页面停留不自行结算。</p>
    </section>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene;
    return <section aria-label="沉默门徒原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 独立原创G序列")}{enemy.sequence}对手。</p>
        <p>同一原身体当前 {enemy.form}；健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {ENEMY_STATUS[enemy.status] ?? enemy.status}。</p>
        <p>唯一原武器 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "仍由卡尔德本人持有" : "实际落在原COURT地面，仍属于卡尔德"}。变回HUMAN不会自动取回，下一次实际拾取占一个行动槽。</p></>}
      {scene && <section aria-label="沉默门徒原战场与真实退路"><h4>原场与普通出口</h4>
        <p>原场 {scene.courtId}；本人实际在{scene.playerPosition === "COURT" ? "原场内" : "出口"}。普通出口实际开放，离场须本人走 {scene.exitMetres} 米。</p>
        <p>原场距离 {scene.distanceMetres} 米；净空{scene.clearanceConfirmed ? "已确认" : "尚未实际确认"}；场内旁人 {scene.thirdPartiesInArea}；累计普通离场 {scene.ordinaryWalkedMetres} 米。</p>
      </section>}
      <section aria-label="沉默门徒战斗当前身体与联系"><h4>当前联系、同一身体与期限</h4>
        <p>本人当前 {encounter.form}；实际同目标联系 {encounter.link}；{encounter.linkRound === null ? "尚无当前联系回合" : `当前联系建立于第${encounter.linkRound}回合`}。</p>
        <p>原敌当前兔形期限记录 {enemy?.form === "RABBIT" ? `至原战斗时钟第${encounter.enemyFormUntilSeconds}秒` : "无待结束的兔形"}；不续时、不叠加。兔形中依赖双手的原弧光与屏护改为普通无武器动作；仍保留实际挣断联系与形态的机会。</p>
        <p>新三块原木件{encounter.blocksPurchased ? "已实际付80便士购买" : "尚未购买"}；原木件用后落在目标地面，不回箱、不补旧PU4木块。缺原木件或灵性时按普通动作回退。</p>
        {encounter.blocks.map(block => <p key={block.id}>{block.id} · 原主人{block.owner} · {block.status}/{block.location} · {block.usedRound === null ? "尚未实际使用" : `第${block.usedRound}回合已实际使用`}。</p>)}
      </section>
      {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">{playerText("这是可选原创G冲突。新联系4灵性、1精神、知识18；短时变形再付5灵性、2精神、知识20，失败照付。原敌挣断需真实4灵性，保留原资源与行动顺序。继承伤己联系策略默认关闭，须玩家明确选择才尝试；不会凭新职业免除自伤。")}</p>
      <p className="slice-muted">和平离开、实际撤退与终局保留同一原人、原棍、原伤势、实际灵性和已付代价。每轮实际60秒；到期只恢复同一身体，不治疗。没有免费回复、强制胜利或复活；旧埃德林的实际投降仍留原档。</p>
    </section>;
  }
}
