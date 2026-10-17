import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { BlathererAction, BlathererCommand, BlathererProjection } from "../domain/blatherer/types";
import { BLATHERER_FORMULA_STATUS, BLATHERER_SOURCE_STATUS } from "../domain/blatherer/content";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "原现场尚未收束", EXAMINED: "待收束与报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "尚未询问", GRANTED: "当前仅同意本次短促试验", DECLINED: "当前已拒绝", REVOKED: "已撤回同意", CLOSED: "本案接触已结束" };
const ENEMY_STATUS: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "原身体仍活着，已投降", DEAD: "原身体已死亡" };
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP_VOICE", "WAIT_CLEAR", "WITHDRAW", "RETURN_A", "RETURN_START", "RETURN_CARD", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const CANCEL_TYPES = new Set(["STOP_VOICE", "WITHDRAW", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
type Goal = "preparation" | "encounter" | `bottle:${string}` | `case:${string}`;
type Confirmation = { action: BlathererAction; facts: string; bottle: BlathererProjection["bottles"][number] };
type Attempt = NonNullable<BlathererProjection["life"]["currentAttempt"]>;
const failed = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const goalFor = (action: BlathererAction): Goal => "bottleId" in action.command ? `bottle:${action.command.bottleId}`
  : "caseId" in action.command ? `case:${action.command.caseId}` : ENCOUNTER_TYPES.has(action.command.type) ? "encounter" : "preparation";

export interface BlathererPanelProps {
  value: BlathererProjection;
  busy?: boolean;
  disabled?: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: BlathererCommand) => void;
  /** Closing this view does not stop a voice, clear a residual effect, move a body or return an original item. */
  onClose?: () => void;
}

/** Displays saved public facts and submits projected intentions without resolving the scene locally. */
export function BlathererPanel({ value, busy = false, disabled = false, blocked = false, error = null, onCommand, onClose }: BlathererPanelProps) {
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

  function submit(action: BlathererAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: BlathererAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const bottleId = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === bottleId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: BlathererAction[], label: string) {
    return <div className="warrior-action-list" role="group" aria-label={label}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || dead || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `blatherer-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>{action.reason && <p className="seer-action-reason" id={`blatherer-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="呓语者当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div><div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{current.cash}</dd></div><div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function preparationCosts() {
    return <section className="slice-notice seer-risk" aria-label="呓语者服药准备与成本"><h4>原瓶与本次准备分别付费</h4>
      <p>本周场地检查需要1行动、140便士；当前{value.preparedWeek === null ? "尚无已保存的本次准备" : `第${value.preparedWeek}周的准备已保存，140便士不退`}。服药0行动，成功或失败都会耗尽所选原瓶。</p>
      <p>可以留在魔鬼4。结束已付准备不退行动或140便士，未服原瓶仍保留；排异后须实际取得另一原瓶并重新准备，原失败与已付成本不清除。</p>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">{playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、低语检定或移动原物。"}</p>;
  const pendingNotice = (busy || submittedId !== null) && error === null ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const { bottle } = confirmation;
    return <section className="seer-panel mystic-panel blatherer-panel seer-confirmation" aria-label="呓语者原瓶服用确认" aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">这一独立原瓶 · 服用前确认</div><h3 ref={confirmationHeading} tabIndex={-1}>{bottle.title}</h3>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p><p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
      {preparationCosts()}<section aria-label="呓语者服用风险与四档结果"><h4>意志难度30与实际四档风险</h4><p>{value.risk}</p></section>
      <p>{playerText(BLATHERER_FORMULA_STATUS)}</p>
      <p>晋升保留同一原身体、原人物与原物。成功四属性各+1、灵性上限120，当前灵性不补满；只新增有限低语且掌握从0开始；旧能力、原紧绷与风险不重置，序列2鲜血大公的衔接尚未核实。</p>
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason" id="blatherer-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || dead || !liveConfirmation?.enabled} aria-describedby={liveConfirmation?.reason ? "blatherer-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，保存失败保留这一原意图。</p>{pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel mystic-panel blatherer-panel" aria-label="呓语者" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="呓语者当前目标"><span className="seer-seal">{value.promoted ? "呓语者 · 深渊序列3（推断）" : "魔鬼4 → 呓语者3（推断）"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>呓语者与有限低语</h3><p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? "本周目已经死亡，原身体、原人物与原物记录只读保留。"
        : nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}` : value.nextStep}</p>
      <p>{value.digestion}</p>{value.promoted && <p>呓语者扮演 {value.acting} / 100</p>}<p className="slice-muted">{playerText("名称与序列3衔接仅有人物推断支持，完整配方、晋升仪式与新增固有能力规则尚未核实。本场有限低语、成年志愿者、范围、时长、成本与数值均为原创G。")}</p>
    </section>
    {resources()}
    <label>选择呓语者事项<select aria-label="选择呓语者事项" disabled={locked || !!activeCase || life.insideCase || encounter.inside}
      value={goal} onChange={event => { const selected = goals.find(entry => entry.id === event.target.value); if (selected && !locked) setSelectedGoal(selected.id); }}>
      {goals.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select></label>
    {selectedBottle && <section aria-label="当前独立呓语者原瓶"><h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id} · {selectedBottle.status}</p><p>来源：{selectedBottle.source}</p></section>}
    {selectedCase && <section className="seer-current-case" aria-label="当前呓语者生活情境"><h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">每案观察、准备、实际检定或普通核验、报告各1行动；三报告各25、反思25，共13行动。进入原现场不自动施术。能力失败后可真实普通核验；普通报告不算能力成功，只有成功低语并完成本案才增加掌握8。</p>
    </section>}
    {!value.promoted && preparationCosts()}
    <section aria-label="呓语者当前行动"><h4>{life.insideCase ? "当前原现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "呓语者下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternatives, "呓语者其它公开行动")}</details>}
      {exits.length > 0 && <section aria-label="呓语者停止与真实返程"><h4>停止与真实返程</h4>{actionList(exits, "呓语者实际收束")}
        <p className="slice-muted">0行动清理仍须停止发声、实际等待余效、沿原路返回并归还原卡。停声只结束输入，成功后的轻微迟疑仍须实际等30秒；关闭页面不清除效果或代为返程，已付成本不退。</p></section>}
      {unavailable.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailable, "呓语者尚不可提交的步骤")}</details>}
    </section>
    {selectedCase && lifeFacts()}{goal === "encounter" && encounterFacts()}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><section aria-label="呓语者成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
      <p>{playerText(BLATHERER_FORMULA_STATUS)}</p><p>{value.supplies}</p>
      <p>沿用同一原成年导师罗安·费里。指导500便士；每瓶6400便士，或本瓶五次真实劳务后900便士；三项专业准备各1行动。魔鬼须晋升后至少12整周、消化100，再付本周准备1行动与140便士。</p>
      <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
      <p>{playerText("三项专业准备是原创G：核对既往原记录、安静原房间与普通门口、实际停止与退出步骤，不充当原著仪式。原三瓶耗尽后须实际申请并等下一真实周补货。船上笑声、血晶与推测祭坛不授予为职业能力或晋升仪式，不开放自制配方。")}</p>
      {value.bottles.map(bottle => <p key={bottle.id}>{bottle.title} · {bottle.id} · {bottle.source} · {bottle.status}</p>)}<p>{value.risk}</p>
    </section></details>
    {value.promoted && <details className="seer-fold"><summary>三项原案的观察与实际结果</summary><section aria-label="呓语者生活记录">{life.cases.map(entry => <article key={entry.id}>
      <h4>{entry.title}</h4><p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次。</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}{entry.attempts.map((record, index) => <div key={index}>{attemptFacts(record)}</div>)}
    </article>)}</section></details>}
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary><section aria-label={playerText("呓语者能力与使用范围")}><h4>当前听者与有限低语</h4>
      <p>{playerText(BLATHERER_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>{playerText("本次仅新增有限低语G：当前清醒且实际听得到的原听者、6米有限范围；实付4灵性、1精神，知识18检定。和平实践须当事人当次同意，成功只出现一次轻微可见迟疑，不造成健康伤害或永久人格改变。失败照付，可以普通核验；撤回同意后不能继续施术。")}</p>
      <p>战斗低语成功仅使本回合下一个实际正贡献BODY或ARC攻击减半一次；重复成功须再次付费且不叠加。敌人实际凝神可清除尚未消费的效果，不能撤销已发生的减势，敌人原施法成本照付。低语本身0直接伤害，不强迫投降、交出原棍或改写忠诚，不授天使污染、免费召唤或全场疯狂。</p>
    </section></details>
    <details className="seer-fold"><summary>原人物、原物与旧深渊路线记录</summary><section aria-label="呓语者继承记录"><h4>原六阶段的实际原物与经历</h4>
      <p>{value.inheritedTools}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p>{playerText("旧罪犯、折翼天使、连环杀手、恶魔、欲望使徒与魔鬼六阶段原记录保持。原奥里克的实际结局（包括已投降记录）、原伤势、旧种子与同一恶魔紧绷保留；旧目标种子不转交新原人。和平扮演100是有成本的原创G替代，不声称恢复良知或消除恶欲风险，不补库存、免费治疗或复活旧人。")}</p>
    </section></details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭呓语者页面</button>}{pendingNotice}{saveNotice}
  </section>;

  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene;
    return <section aria-label="呓语者原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 独立原创G序列")}{enemy.sequence}对手。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {ENEMY_STATUS[enemy.status] ?? enemy.status}。</p>
        <p>原武器 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "原敌本人持有" : "留在原场"}。</p>
        <p>实际弧光 {enemy.powerUses.ARC_BOLT} 次、屏护 {enemy.powerUses.WARD} 次、集中呼吸 {enemy.breathUses} 次。原敌资源耗尽须普通回退，不免费补满。</p></>}
      {scene && <section aria-label="呓语者原战场与真实退路"><h4>原场与普通出口</h4>
        <p>原场 {scene.courtId}；本人实际在{scene.playerPosition === "COURT" ? "原场内" : "出口"}。原出口实际开放，离场须本人走 {scene.exitMetres} 米。</p>
        <p>净空{scene.clearanceConfirmed ? "已实际确认" : "尚未当面确认"}，场内第三人 {scene.thirdPartiesInArea}；原场距离 {scene.distanceMetres} 米，累计普通离场 {scene.ordinaryWalkedMetres} 米。</p>
        <p>{enemy?.status !== "DEAD" && scene.playerPosition === "COURT" ? `原听者当前${scene.targetAwake ? "清醒" : "不清醒"}、${scene.targetListening ? "实际可听" : "当前不可听"}。` : "本人已离场或原听者已死亡，原开战听距记录不表示当前还能施术。"}</p>
      </section>}
      <section aria-label="呓语者战斗当前有限低语"><h4>当前减势与余留</h4>
        <p>{encounter.whisperReady ? "本回合下一次实际正贡献BODY或ARC攻击可减半一次；尚未消费，不叠加。" : "当前没有待消费的本回合减势效果。"}</p>
        <p>当前轻微余留 {encounter.residualSeconds} 秒。停声不退款，终局若仍有余留须实际等待，不自动治疗健康。</p>
      </section>
      {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">{playerText("这是可选原创G冲突。新低语4灵性、1精神，失败仍付；敌人实际集中呼吸可清除尚未消费的效果，不能撤回已发生的减半。旧火焰与硬皮继续支付同一原恶魔紧绷，原短棍或资源不足时按真实普通方法回退。")}</p>
      <p className="slice-muted">和平离开与真实撤退保留原人、原棍、伤势、原灵性和已付代价。每轮60秒；终局若有余留另实等30秒，活人再沿原4米出口步行。没有免费回复、强制投降或复活；旧奥里克的实际结局不重开。</p>
    </section>;
  }
  function lifeFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    const current = life.activeCase === selectedCase.id ? life.currentAttempt : null;
    return <section aria-label="呓语者原人原物与真实位置"><h4>当前听者、同一原物与本人路径</h4>
      <p>原场 {life.siteId}；本人实际在{life.playerLocation}，累计普通步行 {life.playerTravelMetres} 米，实际时钟 {life.clockSeconds} 秒。</p>
      <p>{life.volunteer.name} · {life.volunteer.age}岁 · {life.volunteer.id}，实际在{life.volunteer.location}。她是独立成年志愿者；{life.volunteer.willing ? "一般愿意参与不等于本案当前同意。" : "她当前不愿参与，旧许可不能强迫继续。"}</p>
      <p>原导师{life.guide.name}（{life.guide.id}）当前在{life.guide.location === "OUTSIDE" ? "室外，距A听者8米" : life.guide.location}，本人实际行走 {life.guide.travelMetres} 米。
        {life.guide.location === "OUTSIDE" ? "已在本场G6米听距之外。" : "仍在本场G6米听距之内，熟人没有免疫；不能自动施加低语。"}</p>
      <p>唯一原卡 {life.card.id} 属于{life.card.owner}，当前由{life.card.location === "NORA" ? "诺拉本人" : "玩家临时"}持有；原卡实际携行 {life.card.travelMetres} 米。原铃 {life.bell.id} 与原笔记 {life.note.id} 实际仍在B。</p>
      {current && <section aria-label="呓语者当前许可与残余"><h4>当前许可、实际发声与残余</h4>
        <p>当前许可：{CONSENT[current.consent] ?? current.consent}。{current.consent === "REVOKED" || current.consent === "DECLINED" ? "不能沿用此前同意继续试验；普通核验须尊重她当前答复。" : "一次许可只覆盖本案短试验，不能扩大为持续控制。"}</p>
        <p>实际输入：{current.voiceActive ? "尚未明确停止" : current.stopped ? "已实际停止" : "尚未开始"}；当前轻微残余 {current.residualSeconds} 秒；已实际等候 {current.waitedSeconds} 秒。</p>
        <p>{current.residualSeconds > 0 ? "停止发声只结束新输入，原成功迟疑仍在；须执行实际等待，不能瞬间清除。" : current.waitCompleted ? "本次实际等待已完成，原费用和当事人的选择仍保留。" : "当前没有残余，不凭空产生效果或等待收益。"}</p>
        <p>原听者实际低语来源：{current.whisperSourceId ?? "尚无实际低语来源"}；{current.whisperTier ? `本次判定${TIER[current.whisperTier] ?? current.whisperTier}` : "本次尚无实际低语尝试"}。
          {failed(current.whisperTier) ? "失败成本保留，普通补查不算能力成功。" : current.whisperTier ? playerText("只观察到本作G轻微迟疑，不代表服从、同意邀请或物权转移。") : "普通方法不虚构声音。"}</p>
        <p>已付灵性 {current.spiritualitySpent}、精神 {current.mindSpent}、实施行动 {current.resolutionActions}；{current.ordinaryChecked ? "已实际完成普通核验。" : "尚未实际完成普通核验。"}</p>
        {selectedCase.id === "withdrawn-invitation" && <p>当前邀请答复：{current.currentAnswer === "DECLINED" ? "诺拉当面拒绝邀请。" : "尚未当面取得当前答复，不代替她回答。"} 原卡整案仍属于她，由她本人持有。</p>}
      </section>}
      {life.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      {attempt && <details className="seer-fold" open={failed(attempt.whisperTier)}><summary>本次实际尝试与已付代价</summary>{attemptFacts(attempt)}</details>}
      <p className="slice-muted">START至A4米，A至B4米；本人从B须先走回A，再4米到START。旁人须B→START8米，再4米到室外才真正离开6米听距。0行动清理仍须实际停声、等待、归还和普通步行；邀请案原卡一直留诺拉手中。页面等待与关闭页面不会自行计秒、消除残余、归物或治疗。</p>
    </section>;
  }
  function attemptFacts(entry: Attempt) {
    return <article><p>第{entry.week}周 · {entry.method === "ABILITY" ? "有限低语方案准备" : "普通核验方案准备"} · {entry.result === "ABILITY" ? "低语实际成功并真实核验" : entry.result === "ORDINARY" ? "普通核验完成，不计能力成功" : "尚无完成结果"}。</p>
      <p>本次记录许可：{CONSENT[entry.consent] ?? entry.consent}；方案{entry.withdrawn ? "已实际撤回" : "尚未撤回"}；现场{entry.closed ? "已实际收束" : "尚未实际收束"}。</p>
      <p>原低语来源：{entry.whisperSourceId ?? "尚无"}；{entry.whisperTier ? `实际判定${TIER[entry.whisperTier] ?? entry.whisperTier}` : "没有实际低语，不假称听见声音"}。
        {entry.whisperAtSecond !== null && `记录于本案第${entry.whisperAtSecond}秒。`}{failed(entry.whisperTier) && "失败已付成本不退，普通完成不加低语掌握。"}</p>
      <p>该记录输入{entry.voiceActive ? "尚未停止" : entry.stopped ? "已实际停止" : "未开始"}，残余 {entry.residualSeconds} 秒；已实际等候 {entry.waitedSeconds} 秒，{entry.waitCompleted ? "等待已完成" : "尚无实际等待记录"}。</p>
      <p>原卡{entry.cardReturned ? "已当面归还" : entry.cardTaken ? "已临时借出，尚未归还" : "未领取，仍由诺拉本人持有"}；原铃记录{entry.bellRead ? "已实际核读" : "尚未实际核读"}。旁人{entry.guideLeft ? "已真实走出听距" : "本记录没有请旁人离场"}。</p>
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人实际行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}、精神 {entry.mindSpent}、实施行动 {entry.resolutionActions}。</p>
      <p>真实结果：{entry.outcome ?? "尚未形成当前真实结果。"}</p>
      {entry.evidence.length ? <ol>{entry.evidence.map((fact, index) => <li key={index}>第{fact.atSecond}秒 · 原来源{fact.sourceId}：{fact.text}</li>)}</ol> : <p>尚未取得当面答复或原物证据，不填入想象中的答案。</p>}
      {entry.playerMoves.map((move, index) => <p key={index}>{move.from} → {move.to}：本人实际步行 {move.metres} 米、{move.seconds} 秒；携行原物 {move.itemIds.length ? move.itemIds.join("、") : "无"}。</p>)}
    </article>;
  }
}
