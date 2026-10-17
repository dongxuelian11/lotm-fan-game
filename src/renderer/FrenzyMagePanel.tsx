import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { FrenzyMageAction, FrenzyMageCommand, FrenzyMageProjection } from "../domain/frenzy-mage/types";
import { FRENZY_MAGE_FORMULA_STATUS, FRENZY_MAGE_SOURCE_STATUS } from "../domain/frenzy-mage/content";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "原现场尚未收束", EXAMINED: "待收束与报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "尚未询问", GRANTED: "当前仅同意这一次有限动作试验", DECLINED: "当前已拒绝", REVOKED: "已撤回能力参与", ORDINARY: "当前只同意普通行动", CLOSED: "本案接触已结束" };
const ENEMY_STATUS: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "原身体仍活着，已投降", DEAD: "原身体已死亡" };
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP_INPUT", "WAIT_EFFECT", "WITHDRAW", "WITHDRAW_CONSENT", "RETURN_PERSON", "RETURN_A", "RETURN_START", "RETURN_OBJECT", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const CANCEL_TYPES = new Set(["STOP_INPUT", "WITHDRAW", "WITHDRAW_CONSENT", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
type Goal = "preparation" | "encounter" | `bottle:${string}` | `case:${string}`;
type Confirmation = { action: FrenzyMageAction; facts: string; bottle: FrenzyMageProjection["bottles"][number] };
type Attempt = NonNullable<FrenzyMageProjection["life"]["currentAttempt"]>;
const failed = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const goalFor = (action: FrenzyMageAction): Goal => "bottleId" in action.command ? `bottle:${action.command.bottleId}`
  : "caseId" in action.command ? `case:${action.command.caseId}` : ENCOUNTER_TYPES.has(action.command.type) ? "encounter" : "preparation";

export interface FrenzyMagePanelProps {
  value: FrenzyMageProjection;
  busy?: boolean;
  disabled?: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: FrenzyMageCommand) => void;
  /** Local close is available after the original scene has actually been left. It never resolves a scene. */
  onClose?: () => void;
}

/** Local review and selection only. All physical actions and costs await the saved public projection. */
export function FrenzyMagePanel({ value, busy = false, disabled = false, blocked = false, error = null, onCommand, onClose }: FrenzyMagePanelProps) {
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
    ? [...life.cases.map(entry => ({ id: `case:${entry.id}` as const, label: `${entry.title} · ${CASE_STATUS[entry.status] ?? entry.status}` })), { id: "encounter", label: "阿尔登的可选原场冲突" }]
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

  function submit(action: FrenzyMageAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: FrenzyMageAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const bottleId = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === bottleId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: FrenzyMageAction[], label: string) {
    return <div className="warrior-action-list" role="group" aria-label={label}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || dead || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `frenzy-mage-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>{action.reason && <p className="seer-action-reason" id={`frenzy-mage-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="狂乱法师当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div><div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{current.cash}</dd></div><div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function preparationCosts() {
    return <section className="slice-notice seer-risk" aria-label="狂乱法师服药准备与成本"><h4>原瓶与本次准备分别付费</h4>
      <p>本周场地检查需要1行动、140便士；当前{value.preparedWeek === null ? "尚无已保存的本次准备" : `第${value.preparedWeek}周的准备已保存，140便士不退`}。服药0行动，成功或失败都会耗尽所选原瓶。</p>
      <p>可以留在堕落伯爵4。结束已付准备不退行动或140便士，未服原瓶仍保留；排异后须实际取得另一原瓶并重新准备，原失败与已付成本不清除。</p>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">{playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、施术、执行原动作或归还原物。"}</p>;
  const pendingNotice = (busy || submittedId !== null) && error === null ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const { bottle } = confirmation;
    return <section className="seer-panel mystic-panel frenzy-mage-panel seer-confirmation" aria-label="狂乱法师原瓶服用确认" aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">这一独立原瓶 · 服用前确认</div><h3 ref={confirmationHeading} tabIndex={-1}>{bottle.title}</h3>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p><p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
      {preparationCosts()}<section aria-label="狂乱法师服用风险与四档结果"><h4>意志难度30与实际四档风险</h4><p>{value.risk}</p></section>
      <p>{playerText(FRENZY_MAGE_FORMULA_STATUS)}</p>
      <p>{playerText("成功四属性各+1、灵性上限120，当前灵性不补满；唯一新增的有限既有动作偏转掌握从0开始。同一原身体、年龄、性别与旧伤势保持，原马洛死亡不变，原礼物库存不复制、不补发。狂乱法师3与熵之公爵2名称编号已核实；本次新增机制、专业准备与数值全部为原创G，序列2能力仍未知。")}</p>
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason" id="frenzy-mage-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || dead || !liveConfirmation?.enabled} aria-describedby={liveConfirmation?.reason ? "frenzy-mage-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，保存失败保留这一原意图。</p>{pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel mystic-panel frenzy-mage-panel" aria-label="狂乱法师" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="狂乱法师当前目标"><span className="seer-seal">{value.promoted ? "狂乱法师 · 黑皇帝序列3" : "堕落伯爵4 → 狂乱法师3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>狂乱法师与有限次序</h3><p className="seer-next"><strong>下一步：</strong>{dead ? "本周目已经死亡，原身体、原人物与原物记录只读保留。"
        : nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}` : value.nextStep}</p>
      <p>{value.digestion}</p>{value.promoted && <p>狂乱法师扮演 {value.acting} / 100</p>}
      <p className="slice-muted">{playerText("狂乱法师3、熵之公爵2的名称编号已获原文直接支持。完整配方、晋升仪式与本阶完整能力仍未知；本次有限既有动作偏转、场景、成本与数值全部为原创G。")}</p>
    </section>
    {resources()}
    <label>选择狂乱法师事项<select aria-label="选择狂乱法师事项" disabled={locked || !!activeCase || sceneOpen}
      value={goal} onChange={event => { const selected = goals.find(entry => entry.id === event.target.value); if (selected && !locked && !activeCase && !sceneOpen) setSelectedGoal(selected.id); }}>
      {goals.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select></label>
    {selectedBottle && <section aria-label="当前独立狂乱法师原瓶"><h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id} · {selectedBottle.status}</p><p>来源：{selectedBottle.source}</p></section>}
    {selectedCase && <section className="seer-current-case" aria-label="当前狂乱法师生活情境"><h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">施术只准备一次有限偏转。之后仍须由原成年人实际行走，或本人实际投出同一原球；尚未执行不算应用。归还原物并沿原路退出后才能报告。</p>
    </section>}
    {!value.promoted && preparationCosts()}
    <section aria-label="狂乱法师当前行动"><h4>{life.insideCase ? "当前原现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "狂乱法师下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternatives, "狂乱法师其它公开行动")}</details>}
      {exits.length > 0 && <section aria-label="狂乱法师停止与真实返程"><h4>停止与真实返程</h4>{actionList(exits, "狂乱法师实际收束")}
        <p className="slice-muted">停止输入只取消尚未执行的偏转。已发生的行走、投球、位置与结果不能回滚；已付代价不退。0行动仍须实际返程、交还同一原物，不能瞬移退出。</p></section>}
      {unavailable.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailable, "狂乱法师尚不可提交的步骤")}</details>}
    </section>
    {selectedCase && lifeFacts()}{goal === "encounter" && encounterFacts()}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><section aria-label="狂乱法师成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
      <p>{playerText(FRENZY_MAGE_FORMULA_STATUS)}</p><p>{value.supplies}</p>
      <p>原导师米蕾·沃德的指导500便士；每瓶6400便士，或本瓶五次真实劳务抵5500便士后付900便士。堕落伯爵须晋升后满12整周、消化100；三项专业准备各1行动，当周准备另付1行动与140便士。服药须健康&gt;20、精神&gt;40，意志难度30。</p>
      <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
      <p>{playerText("核对原记录、检查有限边界、标明真实退出均为专业准备G，不能代替未知的原著完整仪式。三原瓶耗尽后须申请并等下一真实周独立供货，不重置旧瓶、不开放自制配方。")}</p>
      {value.bottles.map(bottle => <p key={bottle.id}>{bottle.title} · {bottle.id} · {bottle.source} · {bottle.status}</p>)}<p>{value.risk}</p>
    </section></details>
    {value.promoted && <details className="seer-fold"><summary>三项原案的观察与实际结果</summary><section aria-label="狂乱法师生活记录">{life.cases.map(entry => <article key={entry.id}>
      <h4>{entry.title}</h4><p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次。</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}{entry.attempts.map((record, index) => <div key={index}>{attemptFacts(record)}</div>)}
    </article>)}</section></details>}
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary><section aria-label={playerText("狂乱法师能力与使用范围")}><h4>一次尚未执行的既有动作</h4>
      <p>{playerText(FRENZY_MAGE_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>{playerText("唯一新能力为black-emperor.s3.ordered-deviation，全部是本作原创G。和平施术1行动、5灵性、2精神，知识20四档，只检定一次；成功预备30秒内一次已明确而尚未执行动作的有限偏转。后来实际执行不额外随机重掷，不能把检定成功当成已经发生。")}</p>
      <p>当前许可可撤回，独立成年人仍可拒绝；撤回后必须停止未用偏转，再由本人按当前同意普通走向B。原纸永远写“从A到B”，不能改写纸面、过去结果或长期意愿。普通准备1行动、不耗灵性精神；施术失败后普通收束不再收实施行动。取消、到期、失败不退成本、不奖掌握。</p>
      <p>三案各观察、准备、实施、报告1行动，另反思1行动，共13行动。只有实际应用的偏转奖新掌握8；报告与反思依据如实核验，不要求魔法必成功。原人走4米、原80克软布球飞4米都是真实物理动作，没有传送、召唤或远程取物。</p>
      <p>实战新K实付5灵性、知识20，成功只减半下一次实际正贡献BODY、ARC或正WARD一次；不伤人、不强制投降、不追改旧招。原敌凝神实付4灵性，取消未用偏转并抵抗本轮新K，已经实际应用的减半仍保留。</p>
      <p>不因其他人物的个别表现提高本阶通用数值；本阶段不获得船只的灵界跳跃。建国、异常规则与九陵寝属于1→0，不能代替本阶的晋升准备；不获得任意操控热力学的序列2能力。</p>
    </section></details>
    <details className="seer-fold"><summary>原人物、原物与旧黑皇帝路线记录</summary><section aria-label="狂乱法师继承记录"><h4>六阶段同一原历史</h4>
      <p>{value.inheritedTools}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p>律师、野蛮人、贿赂者、腐化男爵、混乱导师与堕落伯爵的原瓶、原能力、失败和原物继续保留。原马洛·文恩FE4-MARLOW-VENN已经永久死亡，原尸、原装备与原结局不重开。原伊芙、原箱与原低垫保持实际收束。</p>
      <p>只使用briber.gifts唯一旧库存中当前仍由PLAYER实际持有的原礼物；不发新礼物、不复制库存。真正给出的同一件永久记录原目的地与给出周，已GIVEN礼物不能回收再给。新遭遇不能重置此前给出的去向。</p>
    </section></details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {onClose && <button className="slice-button quiet" disabled={closeLocked} aria-describedby={!dead && exitNeeded ? "frenzy-mage-close-reason" : undefined} onClick={() => { if (!closeLocked) onClose(); }}>关闭狂乱法师页面</button>}
    {!dead && exitNeeded && <p className="slice-muted" id="frenzy-mage-close-reason">{sceneOpen ? "先停止未用影响、归还原物并实际离开当前现场，再关闭页面。关闭不代替返程，也不撤销已发生的事实。" : "本次服药准备仍在进行；可0行动结束准备再关闭，140便士不退，未服原瓶保留。"}</p>}{pendingNotice}{saveNotice}
  </section>;

  function lifeFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    const current = life.activeCase === selectedCase.id ? life.currentAttempt : null;
    return <section aria-label="狂乱法师原人原物与真实位置"><h4>同一成年人、原纸与实际路径</h4>
      <p>本人实际在{life.playerLocation}，累计普通步行 {life.playerTravelMetres} 米，实际时钟 {life.clockSeconds} 秒。原导师{life.guide.name}在{life.guide.location}，累计真实行走 {life.guideTravelMetres} 米。</p>
      <p>{life.volunteer.name} · {life.volunteer.age}岁 · {life.volunteer.id}，本人实际在{life.volunteer.location}；独立心智，健康 {life.volunteer.health}、精神 {life.volunteer.mind}。{life.volunteer.willing ? "一般愿意参加仍须核对本次当前许可。" : "当前不愿参加，旧许可不能强迫继续。"}</p>
      <p>唯一原纸 {life.paper.id} 仍写“{life.paper.text}”，在{life.paper.location}，由{life.paper.holder === "PLAYER" ? "本人亲手持有" : "原导师持有"}。偏转不修改原纸。</p>
      {selectedCase.id !== "own-throw" ? <p>唯一400克演练封包 {life.parcel.id} 属于原导师，当前在{life.parcel.location}，由{life.parcel.holder === "DARIAN" ? "同一达里安本人持有" : "原导师持有"}；实际归还 {life.parcel.returns} 次。包随原人普通移动，不能生成副本。</p>
        : <p>唯一80克软布球 {life.ball.id} 属于原导师，当前在{life.ball.location}，由{life.ball.holder === "PLAYER" ? "本人亲手持有" : life.ball.holder === "PAD" ? "实际落在空垫上" : "原导师持有"}；实际投出 {life.ball.throws} 次、归还 {life.ball.returns} 次。原球实际飞行，拾回和返还必须本人走到现场。</p>}
      {current && <section aria-label="狂乱法师当前许可与待用偏转"><h4>当次许可与尚未执行的动作</h4>
        <p>当前许可：{CONSENT[current.consent] ?? current.consent}。{current.consentWithdrawn ? "本人已经撤回能力参与，必须STOP_INPUT清除未用偏转；之后仅执行本人当前同意的普通A→B。" : "许可只覆盖当前这一次试验，不是未来或长期服从。"}</p>
        <p>当时明确的待行动作：{current.expressedAction === "WALK_A_TO_B" ? "达里安本人下一步按原纸从A普通走向B" : current.expressedAction === "THROW_A_TO_B" ? "本人下一步亲手把原软球从A投向B" : "尚未声明，不可凭空制造一个待行命令"}。</p>
        <p>实际输入：{current.inputActive ? "尚未明确停止" : current.stopped ? "已实际停止" : current.abilityTier === null ? "尚未开始能力输入" : "本次能力输入已结束"}；待用偏转剩余 {current.pendingRemainingSeconds} 秒；已实际等待 {current.waitedSeconds} 秒。</p>
        <p>{current.modifierApplied ? "偏转已经在后来的一次实际动作中应用；停止只阻止以后输入，不能复原已经走过的路、原球落点或已付成本。"
          : current.modifierCancelled ? "尚未执行的偏转已经取消；不增加新掌握，已付代价不退。"
          : current.modifierExpired ? "尚未执行的偏转已随真实时间到期；不增加新掌握，已付代价不退。"
          : current.pendingRemainingSeconds > 0 ? "施术成功只准备了偏转；原动作尚未实际执行，此时没有应用或新掌握。" : current.actionExecutions > 0 ? "本次已按普通路线实际执行，没有应用偏转。" : "当前没有待用偏转，普通动作仍须实际执行。"}</p>
        <p>本次已付灵性 {current.spiritualitySpent}、精神 {current.mindSpent}、实施行动 {current.resolutionActions}；{current.abilityTier ? `实际检定${TIER[current.abilityTier] ?? current.abilityTier}` : "没有实际能力检定"}。已经支付的成本不会因失败、停止或撤回而退还。</p>
      </section>}
      {current && executionFacts(current)}
      {attempt && <details className="seer-fold" open={failed(attempt.abilityTier)}><summary>本次实际尝试与已付代价</summary>{attemptFacts(attempt)}</details>}
      <details className="seer-fold"><summary>原现场公开记录</summary><p>{life.environment}</p>{life.facts.map((fact, index) => <p key={index}>{fact}</p>)}</details>
      <p className="slice-muted">START至A4米，A至B或C各4米，接收台空置有垫、轨迹无人。原人回A或原球拾回后，与在A的原导师当面交还原件；本人和原导师再普通返回START。关闭页面与现实等待不会自动计秒、归物或退款。</p>
    </section>;
  }
  function executionFacts(entry: Attempt, historical = false) {
    return <section aria-label={historical ? "狂乱法师原动作历史回执" : "狂乱法师后来一次真实执行"}><h4>施术尝试与后来实际动作分开记录</h4>
      <p>原动作实际执行 {entry.actionExecutions} 次。{entry.actionExecutions === 0 ? "尚未行走或投球，不显示想象中的结果。" : `实际终点 ${entry.actionResult}；原纸仍写从A到B，不重投、不重走以抹除第一次结果。`}</p>
      <p>{entry.resultRead ? "本人已走到真实结果旁，亲读原人或原球与同一原纸。" : "本人仍须走到真实结果旁亲读，不能远程得知或归还。"}{entry.modifierApplied ? "本次确实应用了一次有限偏转。" : "本次尚无实际应用，不增加新掌握。"}</p>
    </section>;
  }
  function attemptFacts(entry: Attempt) {
    return <article><p>本次检定：{entry.abilityCheck ? `${entry.abilityCheck.roll} / 100，成功率 ${entry.abilityCheck.chance}%，${TIER[entry.abilityCheck.tier] ?? entry.abilityCheck.tier}` : "尚无实际能力检定"}。{failed(entry.abilityTier) && "失败费用保留，普通收束不当作能力成功。"}</p>
      <p>当前记录许可：{CONSENT[entry.consent] ?? entry.consent}；原许可撤回：{entry.consentWithdrawn ? "已发生" : "未发生"}。偏转应用：{entry.modifierApplied ? "已实际应用一次" : "尚未应用"}；取消：{entry.modifierCancelled ? "已发生" : "未发生"}；到期：{entry.modifierExpired ? "已发生" : "未发生"}。</p>
      {executionFacts(entry, true)}
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "有限动作能力方案" : "普通核验方案"}；本案{entry.closed ? "已真实退出" : "尚未真实退出"}。原物{entry.objectsReturned ? "已真实归还原主" : "尚未真实归还原主"}，同一原纸{entry.paperRead ? "已亲读" : "尚未亲读"}。</p>
      <p>实际经过 {entry.elapsedSeconds} 秒，本人普通行走 {entry.playerTravelMetres} 米；已付灵性 {entry.spiritualitySpent}、精神 {entry.mindSpent}、实施行动 {entry.resolutionActions}。真实结果：{entry.outcome ?? "尚未形成完成结果。"}</p>
      <p>能力来源 {entry.abilitySourceId ?? "尚无"}；实际动作来源 {entry.actionSourceId ?? "尚未执行"}。{entry.actionAtSecond !== null && `动作完成于本案第${entry.actionAtSecond}秒。`}有限结论{entry.limitedConfirmed ? "已如实确认" : "尚未确认"}；保证声明被拒绝 {entry.rejectedClaims} 次。</p>
      {entry.evidence.length > 0 && <ol>{entry.evidence.map((fact, index) => <li key={index}>第{fact.atSecond}秒 · 原来源{fact.sourceId}：{fact.text}</li>)}</ol>}
      {entry.playerMoves.map((move, index) => <p key={`player-${index}`}>{move.from} → {move.to}：本人普通步行 {move.metres} 米、{move.seconds} 秒；亲携原物 {move.itemIds.length ? move.itemIds.join("、") : "无"}。</p>)}
      {entry.personMoves.map((move, index) => <p key={`person-${index}`}>{move.from} → {move.to}：同一达里安自主步行 {move.metres} 米、{move.seconds} 秒，亲携 {move.itemIds.join("、")}。</p>)}
      {entry.objectMoves.map((move, index) => <p key={`object-${index}`}>{move.from} → {move.to}：原物 {move.itemIds.join("、")} 实际{move.mode === "THROW" ? "飞行" : "随持有人移动"} {move.metres} 米、{move.seconds} 秒。</p>)}
      {entry.guideMoves.map((move, index) => <p key={`guide-${index}`}>{move.from} → {move.to}：原导师普通步行 {move.metres} 米、{move.seconds} 秒，亲携 {move.itemIds.join("、")}。</p>)}
    </article>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene;
    return <section aria-label="狂乱法师原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 独立原创G序列")}{enemy.sequence}对手。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {ENEMY_STATUS[enemy.status] ?? enemy.status}。</p>
        <p>原武器 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "原敌本人持有" : "留在原场"}。</p>
        <p>实际弧光 {enemy.powerUses.ARC_BOLT} 次、屏护 {enemy.powerUses.WARD} 次、凝神 {enemy.powerUses.COMPOSE} 次。原敌术法先付自己的全部费用，耗尽则普通回退。</p></>}
      {scene && <section aria-label="狂乱法师原战场与真实退路"><h4>净空原院与普通出口</h4>
        <p>原场 {scene.courtId}；本人实际在{scene.playerPosition === "COURT" ? "原院内" : "出口"}。开放出口需普通行走 {scene.exitMetres} 米；已真实离场 {scene.ordinaryWalkedMetres} 米。</p>
        <p>净空{scene.clearanceConfirmed ? "已实际确认" : "尚未当面确认"}，第三人 {scene.thirdPartiesInArea}；原敌距本人 {scene.distanceMetres} 米。</p>
      </section>}
      <section aria-label="狂乱法师战斗当前单次偏转"><h4>当前未用偏转</h4>
        <p>{encounter.pendingKind ? "已准备一次有限偏转：仅下一次实际正BODY、ARC或正WARD减半，尚未应用，不叠加。" : "当前没有待消费的本轮偏转。"}</p>
        <p>{encounter.composureReady ? "原敌本轮已经实际凝神，抵抗本轮新K；只清未用影响，已经应用的减半不撤销。" : "原敌当前没有本轮凝神抵抗记录。"}轮末未用影响到期，成本不退。</p>
      </section>
      <section aria-label="狂乱法师同一旧赠物库存"><h4>仍在手中的原礼物</h4>
        <p>{encounter.gifts.summary}</p><p>原库存当前持有 {encounter.gifts.held} 件，已实际给出 {encounter.gifts.given} 件；其中真实留在本原院 {encounter.gifts.battleGround} 件。</p>
      </section>
      {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">新K只影响之后一次实际BODY、ARC或正WARD；旧贿赂只削弱针对本人的动作，两者各自保留真实来源。R只延长同一原礼物从1次到2次，不能延长K。凝神清未用K，不抹去已发生的减半。</p>
      <p className="slice-muted">只可交出同一旧briber.gifts库存中仍持有的原件；实际给出后留在BATTLE:FRENZY_MAGE_DISPUTE:GROUND，保留给出周，不补货或收回。每轮实际60秒，活人终局走4米4秒离开；死者留院，旧马洛永久死亡不重开。</p>
    </section>;
  }
}
