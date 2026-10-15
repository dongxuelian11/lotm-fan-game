import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ChaosWalkerAction, ChaosWalkerCommand, ChaosWalkerProjection } from "../domain/chaos-walker/types";
import { CHAOS_WALKER_FORMULA_STATUS, CHAOS_WALKER_SOURCE_STATUS } from "../domain/chaos-walker/content";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "原现场尚未收束", EXAMINED: "待收束与报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "尚未询问", GRANTED: "当前仅同意本次短促试验", DECLINED: "当前已拒绝", REVOKED: "已撤回同意", ORDINARY: "当前只同意普通试验", CLOSED: "本案接触已结束" };
const ENEMY_STATUS: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "原身体仍活着，已投降", DEAD: "原身体已死亡" };
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP_INPUT", "WAIT_EFFECT", "WITHDRAW", "RETURN_A", "RETURN_START", "RETURN_CART", "RETURN_OBJECT", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const CANCEL_TYPES = new Set(["STOP_INPUT", "WITHDRAW", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
type Goal = "preparation" | "encounter" | "reserve" | `bottle:${string}` | `case:${string}`;
type Confirmation = { action: ChaosWalkerAction; facts: string; bottle: ChaosWalkerProjection["bottles"][number] };
type Attempt = NonNullable<ChaosWalkerProjection["life"]["currentAttempt"]>;
const failed = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const goalFor = (action: ChaosWalkerAction): Goal => "bottleId" in action.command ? `bottle:${action.command.bottleId}`
  : "caseId" in action.command ? `case:${action.command.caseId}` : ENCOUNTER_TYPES.has(action.command.type) ? "encounter" : action.command.type === "ACCUMULATE" ? "reserve" : "preparation";

export interface ChaosWalkerPanelProps {
  value: ChaosWalkerProjection;
  busy?: boolean;
  disabled?: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ChaosWalkerCommand) => void;
  /** Closing this view does not cancel a pending modifier, trigger or undo a physical event, move a body or return an original item. */
  onClose?: () => void;
}

/** Displays saved public facts and submits projected intentions without resolving the scene locally. */
export function ChaosWalkerPanel({ value, busy = false, disabled = false, blocked = false, error = null, onCommand, onClose }: ChaosWalkerPanelProps) {
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
    ? (selectedGoal === "encounter" || selectedGoal === "reserve") || life.cases.some(entry => selectedGoal === `case:${entry.id}`)
    : selectedGoal === "preparation" || value.bottles.some(entry => selectedGoal === `bottle:${entry.id}`));
  const goal: Goal = encounter.inside ? "encounter" : activeCase ? `case:${activeCase.id}` : (selectedGoalAvailable ? selectedGoal : null) ?? defaultGoal;
  const goals: { id: Goal; label: string }[] = value.promoted
    ? [...life.cases.map(entry => ({ id: `case:${entry.id}` as const, label: `${entry.title} · ${CASE_STATUS[entry.status] ?? entry.status}` })), { id: "reserve", label: "唯一原幸运储备与本周积累" }, { id: "encounter", label: "加雷斯的可选原场冲突" }]
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

  function submit(action: ChaosWalkerAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: ChaosWalkerAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const bottleId = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === bottleId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: ChaosWalkerAction[], label: string) {
    return <div className="warrior-action-list" role="group" aria-label={label}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || dead || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `chaos-walker-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>{action.reason && <p className="seer-action-reason" id={`chaos-walker-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="混乱行者当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div><div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{current.cash}</dd></div><div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function preparationCosts() {
    return <section className="slice-notice seer-risk" aria-label="混乱行者服药准备与成本"><h4>原瓶与本次准备分别付费</h4>
      <p>本周场地检查需要1行动、140便士；当前{value.preparedWeek === null ? "尚无已保存的本次准备" : `第${value.preparedWeek}周的准备已保存，140便士不退`}。服药0行动，成功或失败都会耗尽所选原瓶。</p>
      <p>可以留在厄运法师4。结束已付准备不退行动或140便士，未服原瓶仍保留；排异后须实际取得另一原瓶并重新准备，原失败与已付成本不清除。</p>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">{playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、积运、投放原车或抽取分支。"}</p>;
  const pendingNotice = (busy || submittedId !== null) && error === null ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const { bottle } = confirmation;
    return <section className="seer-panel mystic-panel chaos-walker-panel seer-confirmation" aria-label="混乱行者原瓶服用确认" aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">这一独立原瓶 · 服用前确认</div><h3 ref={confirmationHeading} tabIndex={-1}>{bottle.title}</h3>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p><p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
      {preparationCosts()}<section aria-label="混乱行者服用风险与四档结果"><h4>意志难度30与实际四档风险</h4><p>{value.risk}</p></section>
      <p>{playerText(CHAOS_WALKER_FORMULA_STATUS)}</p>
      <p>{playerText("晋升保留同一原身体、原人物与原物。成功四属性各+1、灵性上限120，当前灵性不补满；两项有限概率实践掌握均从0开始。唯一原幸运储备不补满、不复制，旧伤势与风险不重置。序列2先知、序列1水银之蛇本次尚未开放。")}</p>
      {resources()}{reserveFacts()}{liveConfirmation?.reason && <p className="seer-action-reason" id="chaos-walker-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || dead || !liveConfirmation?.enabled} aria-describedby={liveConfirmation?.reason ? "chaos-walker-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，保存失败保留这一原意图。</p>{pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel mystic-panel chaos-walker-panel" aria-label="混乱行者" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="混乱行者当前目标"><span className="seer-seal">{value.promoted ? playerText("混乱行者 · 命运之轮序列3") : playerText("厄运法师4 → 混乱行者3")}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>混乱行者与有限概率</h3><p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? "本周目已经死亡，原身体、原人物与原物记录只读保留。"
        : nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}` : value.nextStep}</p>
      <p>{value.digestion}</p>{value.promoted && <p>混乱行者扮演 {value.acting} / 100</p>}<p className="slice-muted">{playerText("本阶段开放两项有限概率能力；晋升须取得独立成品并完成专业准备。具体条件、成本与风险见下方。")}</p>
    </section>
    {resources()}{reserveFacts()}
    <label>选择混乱行者事项<select aria-label="选择混乱行者事项" disabled={locked || !!activeCase || life.insideCase || encounter.inside}
      value={goal} onChange={event => { const selected = goals.find(entry => entry.id === event.target.value); if (selected && !locked) setSelectedGoal(selected.id); }}>
      {goals.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select></label>
    {selectedBottle && <section aria-label="当前独立混乱行者原瓶"><h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id} · {selectedBottle.status}</p><p>来源：{selectedBottle.source}</p></section>}
    {selectedCase && <section className="seer-current-case" aria-label="当前混乱行者生活情境"><h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">每案观察、准备、实际施术或普通准备、报告各1行动；三报告各25、反思25，共13行动。进入原现场不自动施术。施术成功只布置一个待生效修正，之后的真实物理事件才单独抽取一次；实际应用修正并完成本案才增加对应掌握8。普通完成、失败、撤销或到期均不增加新掌握。</p>
    </section>}
    {!value.promoted && preparationCosts()}
    <section aria-label="混乱行者当前行动"><h4>{life.insideCase ? "当前原现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "混乱行者下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternatives, "混乱行者其它公开行动")}</details>}
      {exits.length > 0 && <section aria-label="混乱行者停止与真实返程"><h4>停止与真实返程</h4>{actionList(exits, "混乱行者实际收束")}
        <p className="slice-muted">0行动清理仍须明确停止输入、沿实际原路返回并归还同一原物。STOP_INPUT只撤销尚未发生的修正；已经投放、抽签或旋转的结果不能撤回、重掷或改写。关闭页面不计秒、不自动归物，已付成本不退。</p></section>}
      {unavailable.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailable, "混乱行者尚不可提交的步骤")}</details>}
    </section>
    {selectedCase && lifeFacts()}{goal === "encounter" && encounterFacts()}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><section aria-label="混乱行者成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
      <p>{playerText(CHAOS_WALKER_FORMULA_STATUS)}</p><p>{value.supplies}</p>
      <p>沿用同一原成年导师艾妲·芬恩。指导500便士；每瓶6400便士，或本瓶五次真实劳务后900便士；三项专业准备各1行动。厄运法师须晋升后至少12整周、消化100，再付本周准备1行动与140便士。</p>
      <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
      <p>{playerText("三项专业准备是原创G：核对既往原记录、确认有限边界、标明真实停止与退出步骤，不能代替尚未知晓的原著仪式。三原瓶耗尽后须实际申请并等下一真实周补货，不重置旧瓶、不开放自制配方。")}</p>
      {value.bottles.map(bottle => <p key={bottle.id}>{bottle.title} · {bottle.id} · {bottle.source} · {bottle.status}</p>)}<p>{value.risk}</p>
    </section></details>
    {value.promoted && <details className="seer-fold"><summary>三项原案的观察与实际结果</summary><section aria-label="混乱行者生活记录">{life.cases.map(entry => <article key={entry.id}>
      <h4>{entry.title}</h4><p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次。</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}{entry.attempts.map((record, index) => <div key={index}>{attemptFacts(record)}</div>)}
    </article>)}</section></details>}
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary><section aria-label={playerText("混乱行者能力与使用范围")}><h4>有限偏差缓冲与未来阻碍</h4>
      <p>{playerText(CHAOS_WALKER_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>{playerText("两项新实践全部是原创G：知识20四档检定，每次实付5灵性、1精神与1份唯一原幸运，失败也照付。成功只布置30秒内下一次物理事件的单次修正，布置成功不等于实际应用，更不保证目标结果。")}</p>
      <p>普通事件概率50%；原车往B可变为75%，原签或原转盘A可变为25%，都不是100%。后来投放、抽签或旋转才另抽一次真实1至100分支，已经发生的结果不能重掷、改写或回滚。撤回同意后必须停止输入，保留已付成本，按普通50%进行她同意的原抽签。</p>
      <p>战斗默认HOLD保留幸运。只有明确选择SPEND_FIRST，本轮首个有资格B/K才能实付1份原储备与5灵性；成功仅减半下一次实际正贡献BODY或ARC一次，不叠加、不倒追。实际集中呼吸可取消未消费效果并抵抗本轮新检定，原敌施法成本照付。无储备或灵性不足回退旧3灵性方法；没有无条件成功、概率之骰、免费灾难、改写历史或天使能力。</p>
    </section></details>
    <details className="seer-fold"><summary>原人物、原物与旧命运之轮路线记录</summary><section aria-label="混乱行者继承记录"><h4>原六阶段的实际原物与经历</h4>
      <p>{value.inheritedTools}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p>怪物、机器、幸运者、灾祸教士、赢家与厄运法师六阶段原记录保持。原费里斯·洛恩的实际结局、原伤势、旧原物与掌握不重置；旧被动幸运继续沿原规则处理。只会因后来实际积累或支付改变同一原幸运账本，不免费补血、补灵性、复制储备或复活旧人。</p>
    </section></details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭混乱行者页面</button>}{pendingNotice}{saveNotice}
  </section>;

  function reserveFacts() {
    const luck = life.luck;
    return <section className="seer-current-resources" aria-label="混乱行者唯一原幸运储备"><h4>唯一原幸运储备</h4>
      <p>原winner.luck：当前 {luck.stored} / {luck.capacity} 份，累计实际积累 {luck.accumulated} 份，累计实际支付 {luck.spent} 份。最近实际积累：{luck.lastAccumulateWeek === null ? "尚无记录" : `第${luck.lastAccumulateWeek}周`}。</p>
      <p className="slice-muted">每真实周最多实际积累1次，1行动换1份，上限3；不消耗灵性、不治疗。进行中的现场、战斗、事件与服药准备须先实际收束。晋升、休养、关闭页面和普通等待均不会自动补运；原储备为0仍可选普通方法。</p>
      {life.accumulations.length > 0 && <details className="seer-fold"><summary>后来实际积运的原账本回执</summary><ul>{life.accumulations.map((receipt, index) => <li key={index}>第{receipt.week}周实付{receipt.actionCost}行动：原储备 {receipt.storedBefore} → {receipt.storedAfter} / 3；当时累计积累 {receipt.accumulatedAfter}、累计支付 {receipt.spentAtTime}。</li>)}</ul></details>}
    </section>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene;
    return <section aria-label="混乱行者原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 独立原创G序列")}{enemy.sequence}对手。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {ENEMY_STATUS[enemy.status] ?? enemy.status}。</p>
        <p>原武器 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "原敌本人持有" : "留在原场"}。</p>
        <p>实际弧光 {enemy.powerUses.ARC_BOLT} 次、屏护 {enemy.powerUses.WARD} 次、集中呼吸 {enemy.powerUses.COMPOSE} 次。原敌资源耗尽须普通回退，不免费补满。</p></>}
      {scene && <section aria-label="混乱行者原战场与真实退路"><h4>原场与普通出口</h4>
        <p>原场 {scene.courtId}；本人实际在{scene.playerPosition === "COURT" ? "原场内" : "出口"}。原出口实际开放，离场须本人走 {scene.exitMetres} 米。</p>
        <p>净空{scene.clearanceConfirmed ? "已实际确认" : "尚未当面确认"}，场内第三人 {scene.thirdPartiesInArea}；原场距离 {scene.distanceMetres} 米，累计普通离场 {scene.ordinaryWalkedMetres} 米。</p>
      </section>}
      <section aria-label="混乱行者战斗当前单次修正"><h4>当前待生效减势</h4>
        <p>{encounter.pendingKind ? `${encounter.pendingKind === "DEVIATION_BUFFER" ? "有限偏差缓冲" : "有限未来阻碍"}已布置：仅本轮下一次实际正贡献BODY或ARC减半一次，尚未消费，不叠加。` : "当前没有待消费的本回合减势效果。"}</p>
        <p>{encounter.composureReady ? "原敌本轮已经实际集中呼吸，抵抗本轮新检定；已发生的减势不撤回。" : "原敌当前没有本轮集中呼吸抵抗记录。"}轮末或终局未消费的效果到期，不退款。</p>
      </section>
      {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">{playerText("可选原创G冲突：默认HOLD，不自动消耗原储备。SPEND_FIRST才允许本轮首个有资格B/K实付1份原幸运与5灵性，失败照付；无资源回退旧3灵性方法。WARD和意外不消费单次减势，集中呼吸只取消未使用效果，原敌实际弧光5灵性、屏护4灵性、集中呼吸4灵性先付。")}</p>
      <p className="slice-muted">每轮实际60秒。和平离开与真实撤退保留原人、原棍、伤势和已付代价；活人沿原4米出口步行，不搬走死亡身体、不免费回复或强制投降。旧费里斯的实际结局不重开。</p>
    </section>;
  }
  function lifeFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    const current = life.activeCase === selectedCase.id ? life.currentAttempt : null;
    return <section aria-label="混乱行者原人原物与真实位置"><h4>同一原物与本人实际路径</h4>
      <p>原场 {life.siteId}；本人实际在{life.playerLocation}，累计普通步行 {life.playerTravelMetres} 米，实际时钟 {life.clockSeconds} 秒。</p>
      <p>原导师{life.guide.name}（{life.guide.id}）当前在{life.guide.location}，累计真实行走 {life.guideTravelMetres} 米；交还原物须与原主实际同处。</p>
      {selectedCase.id === "cart-fork" && <section aria-label="混乱行者同一原车与封包"><h4>实际岔道、原车与原载物</h4>
        <p>唯一原车 {life.cart.id} 属于{life.cart.owner}，当前在{life.cart.location}，控制权在{life.cart.control === "GUIDE" ? "原导师" : "本人"}；已实际释放 {life.cart.releases} 次、归还 {life.cart.returns} 次。</p>
        <p>唯一原封包 {life.parcel.id} 属于{life.parcel.owner}，{life.parcel.massGrams}克，仍密封在{life.parcel.location}内；原车和原包必须一起实际推回A，不能远程取回或生成第二件。</p>
        <p>{life.stops.map(stop => `${stop.id}在${stop.location}的原软挡`).join("；")}。A至B与A至C各有真实4米轨道，路径中没有人；本人必须走向实际停点。</p>
      </section>}
      {selectedCase.id === "revoked-draw" && <section aria-label="混乱行者薇拉与原签袋"><h4>当前本人、原签与原袋</h4>
        <p>{life.volunteer.name} · {life.volunteer.age}岁 · {life.volunteer.id}，实际在{life.volunteer.location}。她是独立成年志愿者；{life.volunteer.willing ? "一般愿意参与不等于本案当前能力许可。" : "她当前不愿参与，旧同意不能强迫继续。"}</p>
        <p>本人健康 {life.volunteer.health}、精神 {life.volunteer.mind}、灵性 {life.volunteer.spirituality}，没有被能力改写意志或扣除这些资源。</p>
        <p>不透明原袋 {life.pouch.id} 始终由薇拉本人持有，属于{life.pouch.owner}；实际亲手抽取 {life.pouch.draws} 次，原签放回 {life.pouch.returns} 次。</p>
        {life.tags.map(tag => <p key={tag.id}>唯一原签 {tag.id} 属于{tag.owner}，当前在{tag.location === "POUCH" ? "同一原袋内" : "薇拉本人手中"}。</p>)}
        <p>唯一原记录 {life.record.id} 属于{life.record.owner}，仍在{life.record.location}。本人必须走B亲读，再走回A，不复制原纸或代她抽签。</p>
      </section>}
      {selectedCase.id === "counterexample" && <section aria-label="混乱行者原转盘与反例"><h4>原指针与原预测分别核验</h4>
        <p>唯一原盘 {life.disc.id} 属于{life.disc.owner}，始终在{life.disc.location}，控制权在{life.disc.control === "GUIDE" ? "原导师" : "本人"}；已实际转动 {life.disc.spins} 次，控制权归还 {life.disc.returns} 次。</p>
        <p>原指针当前：{life.disc.pointer ?? "尚未实际旋转，没有结果"}。即使成功修正为A概率25%，仍可能实际停A；已经停止的原指针不因反例重置。</p>
        <p>唯一原预测 {life.forecast.id} 属于{life.forecast.owner}，仍在{life.forecast.location}；必须本人走B读取后回A比较。确认有限结论不重掷，声称保证结果会被拒绝。</p>
      </section>}
      {current && <section aria-label="混乱行者当前许可与待生效修正"><h4>当前许可、待用修正与实际应用</h4>
        <p>当前许可：{CONSENT[current.consent] ?? current.consent}。{current.consentWithdrawn ? "薇拉已经在本次施术后撤回，必须STOP_INPUT丢弃未应用修正，再由她亲手普通抽签，A仍为50%；不沿用旧同意。" : "原许可只覆盖这一次有限试验，不授权以后继续。"}</p>
        <p>实际输入：{current.inputActive ? "尚未明确停止" : current.stopped ? "已实际停止" : "尚未开始"}；待用修正剩余 {current.pendingRemainingSeconds} 秒；已实际等待 {current.waitedSeconds} 秒。</p>
        <p>{current.modifierApplied ? "修正已在后来一次真实物理事件中消费，不能再次应用或撤回原结果。" : current.modifierCancelled ? "尚未应用的修正已实际取消，已付成本不退，不加新掌握。" : current.modifierExpired ? "修正已随真实时间到期，未应用，不退款或增加新掌握。" : current.pendingRemainingSeconds > 0 ? "施术成功只布置了下一次修正，物理事件尚未发生；此时未应用，不算能力完成或获得掌握。" : "当前没有待用修正；普通方法不凭空施术。"}</p>
        <p>施术来源：{current.abilitySourceId ?? "尚无实际施术来源"}；{current.abilityTier ? `本次检定${TIER[current.abilityTier] ?? current.abilityTier}` : "尚无实际施术检定"}。{failed(current.abilityTier) && "失败成本保留；后来可以普通50%完成，不算能力成功。"}</p>
        <p>本次已付灵性 {current.spiritualitySpent}、精神 {current.mindSpent}、原幸运 {current.luckSpent}、实施行动 {current.resolutionActions}。</p>
      </section>}
      {current && eventFacts(current, selectedCase.id)}
      {attempt && <details className="seer-fold" open={failed(attempt.abilityTier)}><summary>本次实际尝试与已付代价</summary>{attemptFacts(attempt)}</details>}
      <details className="seer-fold"><summary>原现场公开记录</summary><p>{life.environment}</p>{life.facts.map((fact, index) => <p key={index}>{fact}</p>)}</details>
      <p className="slice-muted">START至A4米，A至B或C各4米。0行动仍须真正停止、读取、推回、交还和普通步行；页内等待与关闭页面不会自行计秒、取消修正、移动原物或退款。</p>
    </section>;
  }
  function eventFacts(entry: Attempt, caseId?: string) {
    const target = caseId === "cart-fork" || entry.eventSourceId === "CW3-CART" ? "B" : "A";
    return <section aria-label={caseId ? "混乱行者一次真实后续事件" : "混乱行者历史事件回执"}><h4>后续物理事件，独立于施术检定</h4>
      <p>本案实际分支抽取 {entry.eventDraws} 次。{entry.eventDraws === 0 ? "尚未投放、抽签或转盘，不提前显示一个想象中的结果。" : `原事件来源 ${entry.eventSourceId}；实际分支点数 ${entry.branchRoll} / 100，${target}概率 ${entry.branchChance}%，真实结果 ${entry.branchResult}。`}</p>
      {entry.eventAtSecond !== null && <p>原事件发生于本案第 {entry.eventAtSecond} 秒；{entry.resultRead ? "本人已亲读同一原物。" : "尚须走到实际原物旁亲读。"}已发生一次，不可重抽、重置或追改。</p>}
      <p>{entry.modifierApplied ? "这一次确实使用了修正，目标结果仍有可能未出现；75%与25%都不是保证。" : "本次没有实际应用修正，不增加新能力掌握。"}</p>
    </section>;
  }
  function attemptFacts(entry: Attempt) {
    return <article><p>第{entry.week}周 · {entry.method === "ABILITY" ? "有限概率能力方案" : "普通核验方案"} · {entry.result === "ABILITY" ? "修正实际应用并已记录" : entry.result === "ORDINARY" ? "普通完成，不计能力掌握" : "尚无完成结果"}。</p>
      <p>本次记录许可：{CONSENT[entry.consent] ?? entry.consent}；现场{entry.closed ? "已实际收束" : "尚未实际收束"}。{entry.consentWithdrawn && "实际撤回能力许可的事实保留。"}</p>
      <p>施术来源：{entry.abilitySourceId ?? "尚无"}；{entry.abilityCheck ? `检定点数 ${entry.abilityCheck.roll} / 100，成功率 ${entry.abilityCheck.chance}%，实际${TIER[entry.abilityCheck.tier] ?? entry.abilityCheck.tier}` : "没有实际能力检定"}。
        {entry.abilityAtSecond !== null && `发生于本案第${entry.abilityAtSecond}秒。`}{failed(entry.abilityTier) && "失败已付成本不退，普通完成不加新掌握。"}</p>
      <p>修正实际应用：{entry.modifierApplied ? "是，仅一次" : "否"}；取消：{entry.modifierCancelled ? "已发生" : "未发生"}；到期：{entry.modifierExpired ? "已发生" : "未发生"}。实际停止：{entry.stopped ? "是" : "否"}，待用 {entry.pendingRemainingSeconds} 秒，已实际等待 {entry.waitedSeconds} 秒。</p>
      {eventFacts(entry)}
      <p>已亲读原结果：{entry.resultRead ? "是" : "否"}；已亲读B处原纸：{entry.recordRead ? "是" : "否"}；已比较原预测：{entry.compared ? "是" : "否"}；有限结论：{entry.limitedConfirmed ? "已确认" : "尚未确认"}；保证声明被拒绝 {entry.rejectedClaims} 次。</p>
      <p>同一原物或控制权{entry.objectsReturned ? "已真实归还原主" : "尚未真实归还"}，{entry.outcomeRecorded ? "已如实记录结果" : "尚未如实记录结果"}。普通方法{entry.ordinaryChecked ? "已真实实施" : "未作实施记录"}。</p>
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人实际行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}、精神 {entry.mindSpent}、原幸运 {entry.luckSpent}、实施行动 {entry.resolutionActions}。</p>
      {entry.luckBefore && entry.luckAfter && <p>同一winner.luck支付前 {entry.luckBefore.stored} / 3、累计积累 {entry.luckBefore.accumulated}、累计支付 {entry.luckBefore.spent}；支付后 {entry.luckAfter.stored} / 3、累计积累 {entry.luckAfter.accumulated}、累计支付 {entry.luckAfter.spent}。失败或取消不退还。</p>}
      <p>真实结果：{entry.outcome ?? "尚未形成当前真实结果。"}</p>
      {entry.evidence.length ? <ol>{entry.evidence.map((fact, index) => <li key={index}>第{fact.atSecond}秒 · 原来源{fact.sourceId}：{fact.text}</li>)}</ol> : <p>尚未取得本次原物证据，不填入想象中的答案。</p>}
      {entry.playerMoves.map((move, index) => <p key={`player-${index}`}>{move.from} → {move.to}：本人{move.mode === "PUSH" ? "手推同一原车" : "普通步行"} {move.metres} 米、{move.seconds} 秒；携同原物 {move.itemIds.length ? move.itemIds.join("、") : "无"}。</p>)}
      {entry.objectMoves.map((move, index) => <p key={`object-${index}`}>原物 {move.itemIds.join("、")}：{move.from} → {move.to}，实际{move.mode === "ROLL" ? "沿轨滚行" : "手推"} {move.metres} 米、{move.seconds} 秒。</p>)}
      {entry.guideMoves.map((move, index) => <p key={`guide-${index}`}>原导师：{move.from} → {move.to}，实际步行 {move.metres} 米、{move.seconds} 秒。</p>)}
    </article>;
  }
}
