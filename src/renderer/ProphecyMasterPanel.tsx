import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ProphecyMasterAction, ProphecyMasterCommand, ProphecyMasterProjection } from "../domain/prophecy-master/types";
import { PROPHECY_MASTER_FORMULA_STATUS, PROPHECY_MASTER_SOURCE_STATUS } from "../domain/prophecy-master/content";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "原现场尚未收束", EXAMINED: "待收束与报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "尚未询问", GRANTED: "本案已同意", DECLINED: "本案已拒绝", CLOSED: "本案接触已结束" };
const HYPOTHESIS = { ALARM: "警报假说（尚待实证）", HANDOVER: "交接假说（尚待实证）" };
const ENEMY_STATUS: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "原身体仍活着，已投降", DEAD: "原身体已死亡" };
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP_INQUIRY", "WITHDRAW", "RETURN_A", "RETURN_START", "RETURN_RECORD", "CLOSE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const CANCEL_TYPES = new Set(["STOP_INQUIRY", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
type Goal = "preparation" | "encounter" | `bottle:${string}` | `case:${string}`;
type Confirmation = { action: ProphecyMasterAction; facts: string; bottle: ProphecyMasterProjection["bottles"][number] };
type Attempt = NonNullable<ProphecyMasterProjection["life"]["currentAttempt"]>;
const failed = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const goalFor = (action: ProphecyMasterAction): Goal => "bottleId" in action.command ? `bottle:${action.command.bottleId}`
  : "caseId" in action.command ? `case:${action.command.caseId}` : ENCOUNTER_TYPES.has(action.command.type) ? "encounter" : "preparation";

export interface ProphecyMasterPanelProps {
  value: ProphecyMasterProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ProphecyMasterCommand) => void;
  /** Closing this view does not stop an inquiry, move a body or return an original item. */
  onClose?: () => void;
}

/** Selects and reviews public intentions only; it never supplies a forecast, evidence or outcome. */
export function ProphecyMasterPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: ProphecyMasterPanelProps) {
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
  const goals: { id: Goal; label: string }[] = value.promoted
    ? [...life.cases.map(entry => ({ id: `case:${entry.id}` as const, label: `${entry.title} · ${CASE_STATUS[entry.status] ?? entry.status}` })), { id: "encounter", label: "奥斯里克的可选原场冲突" }]
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

  function submit(action: ProphecyMasterAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: ProphecyMasterAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const bottleId = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === bottleId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: ProphecyMasterAction[], label: string) {
    return <div className="warrior-action-list" role="group" aria-label={label}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `prophecy-master-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>{action.reason && <p className="seer-action-reason" id={`prophecy-master-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="预言大师当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div><div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{current.cash}</dd></div><div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function preparationCosts() {
    return <section className="slice-notice seer-risk" aria-label="预言大师服药准备与成本"><h4>原瓶与本次准备分别付费</h4>
      <p>本周场地检查需要1行动、140便士；当前{value.preparedWeek === null ? "尚无已保存的本次准备" : `第${value.preparedWeek}周的准备已保存，140便士不退`}。服药0行动，成功或失败都会耗尽所选原瓶。</p>
      <p>可以留在神秘学家4。结束已付准备不退行动或140便士，未服原瓶仍保留；排异后须实际取得另一原瓶并重新准备，原失败与已付成本不清除。</p>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">{playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、预兆检定或移动原物。"}</p>;
  const pendingNotice = (busy || submittedId !== null) && error === null ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const { bottle } = confirmation;
    return <section className="seer-panel mystic-panel prophecy-master-panel seer-confirmation" aria-label="预言大师原瓶服用确认" aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">这一独立原瓶 · 服用前确认</div><h3 ref={confirmationHeading} tabIndex={-1}>{bottle.title}</h3>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p><p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
      {preparationCosts()}<section aria-label="预言大师服用风险与四档结果"><h4>意志难度30与实际四档风险</h4><p>{value.risk}</p></section>
      <p>{playerText(PROPHECY_MASTER_FORMULA_STATUS)}</p>
      <p>晋升保留同一原身体、原人物与原物。成功四属性各+1、灵性上限120，当前灵性不补满；不追加另一滴神话血，不提前获得序列2贤者的信息化。</p>
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason" id="prophecy-master-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || !liveConfirmation?.enabled} aria-describedby={liveConfirmation?.reason ? "prophecy-master-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，保存失败保留这一原意图。</p>{pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel mystic-panel prophecy-master-panel" aria-label="预言大师" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="预言大师当前目标"><span className="seer-seal">{value.promoted ? "预言大师 · 隐者序列3" : "神秘学家4 → 预言大师3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>预言大师与有限预兆</h3><p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? "本周目已经死亡，原身体、原人物与原物记录只读保留。"
        : nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}` : value.nextStep}</p>
      <p>{value.digestion}</p><p className="slice-muted">{playerText("模糊命运画面需要解释，受位格限制且可能判断错误。完整配方与原著晋升仪式未知；本场人物、有限情境、范围、成本与数值均为原创G。")}</p>
    </section>
    {resources()}
    <label>选择预言大师事项<select aria-label="选择预言大师事项" disabled={locked || !!activeCase || life.insideCase || encounter.inside}
      value={goal} onChange={event => { const selected = goals.find(entry => entry.id === event.target.value); if (selected && !locked) setSelectedGoal(selected.id); }}>
      {goals.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select></label>
    {selectedBottle && <section aria-label="当前独立预言大师原瓶"><h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id} · {selectedBottle.status}</p><p>来源：{selectedBottle.source}</p></section>}
    {selectedCase && <section className="seer-current-case" aria-label="当前预言大师生活情境"><h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施、报告各1行动；三报告各25、反思25，共13行动。实施只进入原现场；须另行选择预兆。能力实际成功并完成物证核实与报告后才增加掌握8。</p>
    </section>}
    {!value.promoted && preparationCosts()}
    <section aria-label="预言大师当前行动"><h4>{life.insideCase ? "当前原现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "预言大师下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternatives, "预言大师其它公开行动")}</details>}
      {exits.length > 0 && <section aria-label="预言大师停止与真实返程"><h4>停止与真实返程</h4>{actionList(exits, "预言大师实际收束")}
        <p className="slice-muted">0行动清理仍须实际移动与归还。停止、撤回许可或关闭页面不传送本人，不代交封包，不返还已耗灵性、精神或行动。</p></section>}
      {unavailable.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailable, "预言大师尚不可提交的步骤")}</details>}
    </section>
    {selectedCase && lifeFacts()}{goal === "encounter" && encounterFacts()}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><section aria-label="预言大师成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
      <p>{playerText(PROPHECY_MASTER_FORMULA_STATUS)}</p><p>{value.supplies}</p>
      <p>{playerText("原创G导师埃莉拉·温特，53岁，PM3-ELIRA。指导500便士；每瓶6400便士，或本瓶五次真实劳务后900便士；三项专业准备各1行动。神秘学家须至少12整周、消化100，再付本周准备1行动与140便士。")}</p>
      <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
      <p>{playerText("三项专业准备是原创G适配，不充当已核原著仪式。原三瓶耗尽后须实际申请并等下一真实周补货。命运之蛇血是嘉德丽雅原4的个别准备，不追加为本阶通用配方。")}</p>
      {value.bottles.map(bottle => <p key={bottle.id}>{bottle.title} · {bottle.id} · {bottle.source} · {bottle.status}</p>)}<p>{value.risk}</p>
    </section></details>
    {value.promoted && <details className="seer-fold"><summary>三项原案的观察与实际结果</summary><section aria-label="预言大师生活记录">{life.cases.map(entry => <article key={entry.id}>
      <h4>{entry.title}</h4><p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次。</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}{entry.attempts.map((record, index) => <div key={index}>{knowledgeFacts(record)}{attemptFacts(record)}</div>)}
    </article>)}</section></details>}
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary><section aria-label={playerText("预言大师能力与使用范围")}><h4>需要实证的有限预兆</h4>
      <p>{playerText(PROPHECY_MASTER_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>本次仅新增有限预兆：6灵性、2精神与知识18判定。失败仍支付成本，不给可靠结论；成功画面也不直接证明哪种解释正确。可以自愿停止并采用普通核查，停止不等同驱散真实污染。</p>
      <p>战斗预兆只准备本回合下一个真实攻击的有限减势窗口，不先行造成伤害；对方假动作或回合结束可使窗口失效，已付成本不退。不窥探高位全部秘密、不阻止全部灾难；序列2贤者的信息化与高位灾难仪式尚未开放。</p>
    </section></details>
    <details className="seer-fold"><summary>原故事、原卷与旧隐者路线记录</summary><section aria-label="预言大师继承记录"><h4>原六阶段的实际原物与经历</h4>
      <p>{value.inheritedTools}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p>旧故事的公开历史不回收；原卢坎结局、神话血、眼镜、原卷与实际掌握按原记录保留。只消耗实际用过的原卷，不凭空补库存、再送故事库、治疗旧伤或复活旧人。</p>
    </section></details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭预言大师页面</button>}{pendingNotice}{saveNotice}
  </section>;

  function knowledgeFacts(entry: Attempt) {
    return <div className="seer-facts">
      <section aria-label="原不确定预兆"><h4>当时的不确定预兆</h4><p>{entry.glimpseText ?? "尚无预兆画面。"}</p>{entry.glimpseAtSecond !== null && <p>原预兆记录时间：第{entry.glimpseAtSecond}秒。</p>}
        {entry.glimpseTier && <p>本次预兆判定：{TIER[entry.glimpseTier]}。{failed(entry.glimpseTier) ? "未得到可靠结论，成本已付。" : "画面尚需核实，不能据此断言未来事实。"}</p>}</section>
      <section aria-label="玩家当时的解释"><h4>已选择的假说</h4><p>{entry.hypothesis ? HYPOTHESIS[entry.hypothesis] : "尚未选择解释。"}</p>{entry.hypothesisAtSecond !== null && <p>原假说记录时间：第{entry.hypothesisAtSecond}秒。</p>}<p className="slice-muted">原假说保留；后续物证与修正另记，不改写当时的判断。</p></section>
      <section aria-label="已经取得的实际物证"><h4>后续实际观察与物证</h4>{entry.evidence.length ? <ol>{entry.evidence.map((fact, index) => <li key={index}>第{fact.atSecond}秒 · 原件{fact.sourceId}：{fact.text}</li>)}</ol> : <p>尚未取得实际物证；目前没有可确认的答案。</p>}
        <p>核实后的修正：{entry.correction ?? "尚未完成证据比对。"}</p>{entry.comparedAtSecond !== null && <p>实际比对时间：第{entry.comparedAtSecond}秒。</p>}</section>
    </div>;
  }
  function lifeFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    return <section aria-label="预言大师原人原物与真实位置"><h4>本人、原物与实际路径</h4>
      {life.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      {attempt && <><p>本次原主许可：{CONSENT[attempt.ownerConsent] ?? attempt.ownerConsent}；原保管人许可：{CONSENT[attempt.keeperConsent] ?? attempt.keeperConsent}；原接收人许可：{CONSENT[attempt.receiverConsent] ?? attempt.receiverConsent}。已付灵性 {attempt.spiritualitySpent}、精神 {attempt.mindSpent}；实际行走 {attempt.playerTravelMetres} 米，实际经过 {attempt.elapsedSeconds} 秒。</p>
        {knowledgeFacts(attempt)}<details className="seer-fold" open={failed(attempt.glimpseTier)}><summary>本次实际尝试与已付代价</summary>{attemptFacts(attempt)}</details></>}
      <p className="slice-muted">页面等待不会自行计秒、预知答案、移动身体或归还原物。START至A实走6米，A至B侧道实走12米；返程仍须按原路逐段走回。资源耗尽仍可按公开行动停止、普通返程与归还。</p>
    </section>;
  }
  function attemptFacts(entry: Attempt) {
    return <article><p>第{entry.week}周 · {entry.method === "ABILITY" ? "预兆方法准备" : "普通方法准备"} · {entry.result === "ABILITY" ? "成功预兆后实际核实并完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"}。</p>
      <p>原主许可：{CONSENT[entry.ownerConsent] ?? entry.ownerConsent}；原保管人许可：{CONSENT[entry.keeperConsent] ?? entry.keeperConsent}；原接收人许可：{CONSENT[entry.receiverConsent] ?? entry.receiverConsent}。</p>
      <p>探查{entry.stopped ? "已实际停止" : "尚无停止记录"}；许可{entry.withdrawn ? "已实际撤回" : "尚无撤回记录"}；原物{entry.recordReturned ? "已实际归还" : "尚未归还"}。</p>
      {failed(entry.glimpseTier) && <p>实付成本保留，不能重骰；普通核查和报告不算能力成功。</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人实际行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}、精神 {entry.mindSpent}。</p>
      {entry.playerMoves.map((move, index) => <p key={index}>{move.from} → {move.to}：本人实际行走 {move.metres} 米、{move.seconds} 秒；携行原物 {move.itemIds.length ? move.itemIds.join("、") : "无"}。</p>)}
    </article>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="预言大师原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁 · {enemy.id}。</p><p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {ENEMY_STATUS[enemy.status] ?? enemy.status}。</p>
        <p>原武器 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "原敌本人持有" : "留在原场"}。</p>
        <p>实际弧光 {enemy.powerUses.ARC_BOLT} 次、屏护 {enemy.powerUses.WARD} 次、付费假动作 {enemy.powerUses.FEINT} 次。</p></>}
      {encounter.scene && <section aria-label="预言大师原战场与真实退路"><h4>原场与普通出口</h4>
        <p>原场 {encounter.scene.courtId}；本人实际在{encounter.scene.playerPosition === "COURT" ? "原场内" : "出口"}。原出口实际开放，离场须本人走 {encounter.scene.exitMetres} 米。</p>
        <p>净空{encounter.scene.clearanceConfirmed ? "已实际确认" : "尚未当面确认"}，场内第三人 {encounter.scene.thirdPartiesInArea}；原人相距 {encounter.scene.distanceMetres} 米，累计普通离场 {encounter.scene.ordinaryWalkedMetres} 米。</p>
      </section>}
      {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">{playerText("这是可选的原创G原人冲突。原棍与有限法术读取真实资源；预兆和假动作本身不致伤。和平离开与真实撤退保留原人、原物、伤势和已付代价，不回收旧故事公开历史。")}</p>
    </section>;
  }
}
