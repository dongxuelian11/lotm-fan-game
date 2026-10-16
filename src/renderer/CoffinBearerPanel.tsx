import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { CoffinBearerAction, CoffinBearerCommand, CoffinBearerProjection } from "../domain/coffin-bearer/types";
import { COFFIN_BEARER_FORMULA_STATUS, COFFIN_BEARER_SOURCE_STATUS } from "../domain/coffin-bearer/content";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "原现场尚未收束", EXAMINED: "待收束与报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "尚未询问", GRANTED: "当前仅同意这一个原样本的有限保全与转运", DECLINED: "当前已拒绝", REVOKED: "已撤回本次接收和保全许可", ORDINARY: "当前只同意普通观察记录", CLOSED: "本案接触已结束", RECORD_ONLY: "当前只同意普通观察与核验枯样记录" };
const ENEMY_STATUS: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "原身体仍活着，已投降", DEAD: "原身体已死亡" };
const ENCOUNTER_TYPES = new Set(["PREPARE_GUARD", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP_EFFECT", "WAIT_WINDOW", "WITHDRAW", "RETURN_A", "RETURN_START", "RETURN_SAMPLE", "RETURN_KIT", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const CANCEL_TYPES = new Set(["STOP_EFFECT", "WITHDRAW", "LEAVE_CASE", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
type Goal = "preparation" | "encounter" | `bottle:${string}` | `case:${string}`;
type Confirmation = { action: CoffinBearerAction; facts: string; bottle: CoffinBearerProjection["bottles"][number] };
type Attempt = NonNullable<CoffinBearerProjection["life"]["currentAttempt"]>;
const failed = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const goalFor = (action: CoffinBearerAction): Goal => "bottleId" in action.command ? `bottle:${action.command.bottleId}`
  : "caseId" in action.command ? `case:${action.command.caseId}` : action.command.type === "BUY_KIT" ? "case:fresh-transfer" : ENCOUNTER_TYPES.has(action.command.type) ? "encounter" : "preparation";

export interface CoffinBearerPanelProps {
  value: CoffinBearerProjection;
  busy?: boolean;
  disabled?: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: CoffinBearerCommand) => void;
  /** Local close is available after the original scene has actually been left. It never resolves a scene. */
  onClose?: () => void;
}

/** Local review and selection only. All physical actions and costs await the saved public projection. */
export function CoffinBearerPanel({ value, busy = false, disabled = false, blocked = false, error = null, onCommand, onClose }: CoffinBearerPanelProps) {
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
    ? [...life.cases.map(entry => ({ id: `case:${entry.id}` as const, label: `${entry.title} · ${CASE_STATUS[entry.status] ?? entry.status}` })), { id: "encounter", label: "诺兰的可选原场冲突与新护腕" }]
    : [{ id: "preparation", label: "独立成品指导与三项专业准备" }, ...value.bottles.map(bottle => ({ id: `bottle:${bottle.id}` as const, label: `${bottle.title} · ${bottle.status}` }))];
  const selectedCase = goal.startsWith("case:") ? life.cases.find(entry => `case:${entry.id}` === goal) : undefined;
  const selectedBottle = goal.startsWith("bottle:") ? value.bottles.find(entry => `bottle:${entry.id}` === goal) : undefined;
  const currentActions = value.actions.filter(action => {
    if (selectedBottle) return "bottleId" in action.command ? action.command.bottleId === selectedBottle.id
      : ["PREPARE_PROMOTION", "LEAVE_PREPARATION"].includes(action.command.type);
    if (selectedCase) return "caseId" in action.command ? action.command.caseId === selectedCase.id : ["REFLECT", "BUY_KIT"].includes(action.command.type);
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

  function submit(action: CoffinBearerAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: CoffinBearerAction) {
    if (locked || dead || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const bottleId = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === bottleId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: CoffinBearerAction[], label: string) {
    return <div className="warrior-action-list" role="group" aria-label={label}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || dead || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `coffin-bearer-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>{action.reason && <p className="seer-action-reason" id={`coffin-bearer-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="抬棺人当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div><div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{current.cash}</dd></div><div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function preparationCosts() {
    return <section className="slice-notice seer-risk" aria-label="抬棺人服药准备与成本"><h4>原瓶与本次准备分别付费</h4>
      <p>本周场地检查需要1行动、140便士；当前{value.preparedWeek === null ? "尚无已保存的本次准备" : `第${value.preparedWeek}周的准备已保存，140便士不退`}。服药0行动，成功或失败都会耗尽所选原瓶。</p>
      <p>可以留在古代炼金师4。结束已付准备不退行动或140便士，未服原瓶仍保留；排异后须实际取得另一原瓶并重新准备，原失败与已付成本不清除。</p>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">{playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、施术、执行原动作或归还原物。"}</p>;
  const pendingNotice = (busy || submittedId !== null) && error === null ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const { bottle } = confirmation;
    return <section className="seer-panel mystic-panel coffin-bearer-panel seer-confirmation" aria-label="抬棺人原瓶服用确认" aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">这一独立原瓶 · 服用前确认</div><h3 ref={confirmationHeading} tabIndex={-1}>{bottle.title}</h3>
      <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p><p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
      {preparationCosts()}<section aria-label="抬棺人服用风险与四档结果"><h4>意志难度30与实际四档风险</h4><p>{value.risk}</p></section>
      <p>{playerText(COFFIN_BEARER_FORMULA_STATUS)}</p>
      <p>{playerText("成功四属性各+1、灵性上限120，当前灵性不补满；唯一新增的有限活性保全掌握从0开始。同一原身体、年龄、性别与旧伤势保持，旧奥斯里克原投降和原伤不变，原样本、伙伴与原物不重开、不补能。抬棺人3、荒芜主母2与自然行者1名称编号已核实；本次有限保全、实物媒介、时限、专业准备与数值全部为原创G。枯样仍为原枯样，不给予复活或死亡豁免。")}</p>
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason" id="coffin-bearer-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
        <button className="slice-button" disabled={locked || dead || !liveConfirmation?.enabled} aria-describedby={liveConfirmation?.reason ? "coffin-bearer-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，保存失败保留这一原意图。</p>{pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel mystic-panel coffin-bearer-panel" aria-label="抬棺人" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="抬棺人当前目标"><span className="seer-seal">{value.promoted ? "抬棺人 · 母亲序列3" : "古代炼金师4 → 抬棺人3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>抬棺人与有限活性转运</h3><p className="seer-next"><strong>下一步：</strong>{dead ? "本周目已经死亡，原身体、原人物与原物记录只读保留。"
        : nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}` : value.nextStep}</p>
      <p>{value.digestion}</p>{value.promoted && <p>抬棺人扮演 {value.acting} / 100</p>}
      <p className="slice-muted">{playerText("抬棺人3、荒芜主母2与自然行者1的名称编号已获原文直接支持。完整配方、晋升仪式与本阶完整能力仍未知；本次有限活性保全、样本转运、实物媒介、时限、场景与数值全部为原创G。原活样可能继续衰减，原枯样不会复活。")}</p>
    </section>
    {resources()}
    <label>选择抬棺人事项<select aria-label="选择抬棺人事项" disabled={locked || !!activeCase || sceneOpen}
      value={goal} onChange={event => { const selected = goals.find(entry => entry.id === event.target.value); if (selected && !locked && !activeCase && !sceneOpen) setSelectedGoal(selected.id); }}>
      {goals.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select></label>
    {selectedBottle && <section aria-label="当前独立抬棺人原瓶"><h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id} · {selectedBottle.status}</p><p>来源：{selectedBottle.source}</p></section>}
    {selectedCase && <section className="seer-current-case" aria-label="当前抬棺人生活情境"><h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">{selectedCase.id === "dry-record" ? "这株原样本已经枯萎，只能普通观察记录；不能对它施用活性保全，也不能承诺复活。" : selectedCase.id === "withdrawn-transfer" ? "本案使用另一株原活盆。莉娜撤回本次接收和保全许可后，先停止剩余效力，再带同一原盆普通返回。" : "成功只减缓这株原活盆的测试性活性损失60秒，不增加活性。实际等待满本次窗口后，才能装入唯一原匣并普通搬运。"}每次都核对当前许可和原纸，实际交付或归还原样本、归还匣与耗材后，再普通返回START报告。</p>
    </section>}
    {!value.promoted && preparationCosts()}
    <section aria-label="抬棺人当前行动"><h4>{life.insideCase ? "当前原现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "抬棺人下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternatives, "抬棺人其它公开行动")}</details>}
      {exits.length > 0 && <section aria-label="抬棺人停止与真实返程"><h4>停止与真实返程</h4>{actionList(exits, "抬棺人实际收束")}
        <p className="slice-muted">停止保全只清未用时长，不恢复已经损失的活性，也不退已付费用。0行动仍可按实际位置带原样本返回、当面交还原物；关闭页面不能代替返程。</p></section>}
      {unavailable.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailable, "抬棺人尚不可提交的步骤")}</details>}
    </section>
    {selectedCase && lifeFacts()}{goal === "encounter" && encounterFacts()}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><section aria-label="抬棺人成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
      <p>{playerText(COFFIN_BEARER_FORMULA_STATUS)}</p><p>{value.supplies}</p>
      <p>原导师伊芙·莫兰的指导500便士；每瓶6400便士，或本瓶五次真实劳务抵5500便士后付900便士。古代炼金师须晋升后满12整周、消化100；三项专业准备各1行动，当周准备另付1行动与140便士。服药须健康&gt;20、精神&gt;40，意志难度30。</p>
      <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
      <p>{playerText("核对原记录、检查有限边界、标明真实退出均为专业准备G，不能代替未知的原著完整仪式。三原瓶耗尽后须申请并等下一真实周独立供货，不重置旧瓶、不开放自制配方。")}</p>
      {value.bottles.map(bottle => <p key={bottle.id}>{bottle.title} · {bottle.id} · {bottle.source} · {bottle.status}</p>)}<p>{value.risk}</p>
    </section></details>
    {value.promoted && <details className="seer-fold"><summary>三项原案的观察与实际结果</summary><section aria-label="抬棺人生活记录">{life.cases.map(entry => <article key={entry.id}>
      <h4>{entry.title}</h4><p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次。</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}{entry.attempts.map((record, index) => <div key={index}>{attemptFacts(record)}</div>)}
    </article>)}</section></details>}
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary><section aria-label={playerText("抬棺人能力与使用范围")}><h4>仅保全这一株尚活着的原样本</h4>
      <p>{playerText(COFFIN_BEARER_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>{playerText("唯一新能力为mother.s3.finite-preservation，全部是本作原创G。和平施术另付1行动、5灵性、2精神并实耗一片原衬片，知识20四档，只尝试一次；失败照付，原惰性衬片仍保存。")}</p>
      <p>只有本案已核对且尚未交付或交回的活样处于测试性暴露。普通每累计10秒损失1活性；成功保全的60秒内每累计20秒损失1，计数分别保存。停止后重新累计普通10秒，不补回已失活性；活性到0即枯萎，不能用本能力恢复。</p>
      <p>三案各观察、准备、实施、报告1行动，另反思1行动，共13行动。初次原匣、牌和三片衬片真实购入另付1行动、90便士；普通方案实施1行动、0灵性0精神、不耗衬片且不检定。仅首案成功保全并实际交付后报告奖掌握8，失败、普通或撤回案均不奖掌握。</p>
      <p>战前新护腕另付1行动、120便士、4灵性，由实际新材料制成三个一次性原段。B实耗一段、4灵性并知识18检定，成功减弱随后一次正BODY或ARC至0.6倍；K实耗一段、5灵性并知识20四档，成功最多减弱本轮随后两次正BODY或ARC至0.8倍。</p>
      <p>B或K已有任一待用效果时，两者均不叠加、不再次收费。原段用后留为SPENT，不自动补充；无段或灵性不足只用公开的普通回退。护持、0贡献及敌方0动作不消耗待用次数，轮末剩余效力结束。</p>
      <p>{playerText("有限保全不治疗疾病、不提高活性、不改死亡或伤势判定，不提供免死、复活、灵魂创造或亡者操纵。三名新成年人的独立心智、健康和当前许可保留；本作植物测量属于虚构G规则，不是现实生物操作指南。")}</p>
    </section></details>
    <details className="seer-fold"><summary>原人物、原物与旧母亲路线记录</summary><section aria-label="抬棺人继承记录"><h4>六阶段同一原历史</h4>
      <p>{value.inheritedTools}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p>耕种者、医师、丰收祭司、生物学家、德鲁伊与古代炼金师的原瓶、原能力、失败、伤势、原伙伴与原物全字段保留。旧奥斯里克AA4-OSRIC-VALE仍是原SURRENDERED投降者，不作为新目标，不复位原健康、灵性、伤势或风险。</p>
      <p>原AA4-STEM与旧AA4护腕、基质和记录保持历史原状；本案三株CB3样本来自艾达的原温室记录，新护腕CB3-GUARD使用独立新材料。新诺兰CB3-NOLAN是独立成年对手，不挪用旧敌或给旧护腕免费补段。</p>
    </section></details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {onClose && <button className="slice-button quiet" disabled={closeLocked} aria-describedby={!dead && exitNeeded ? "coffin-bearer-close-reason" : undefined} onClick={() => { if (!closeLocked) onClose(); }}>关闭抬棺人页面</button>}
    {!dead && exitNeeded && <p className="slice-muted" id="coffin-bearer-close-reason">{sceneOpen ? "先停止未用影响、交付或归还原样本、归还原物并实际离开当前现场，再关闭页面。关闭不代替返程，也不撤销已发生的事实。" : "本次服药准备仍在进行；可0行动结束准备再关闭，140便士不退，未服原瓶保留。"}</p>}{pendingNotice}{saveNotice}
  </section>;

  function lifeFacts() {
    if (!selectedCase) return null;
    const current = life.activeCase === selectedCase.id ? life.currentAttempt : null;
    const currentSample = life.samples.find(sample => sample.caseId === selectedCase.id);
    return <section aria-label="抬棺人原样本与真实位置"><h4>原样本、实际持有人与生命状态</h4>
      <p>本人实际在{life.playerLocation}，累计普通步行 {life.playerTravelMetres} 米，生活现场实际时钟 {life.clockSeconds} 秒；另有场外时钟 {life.externalSeconds} 秒。界面停留不会自行计秒。</p>
      <p>原所有者{life.owner.name} · {life.owner.age}岁 · {life.owner.id}，实际在{life.owner.location}，独立心智，健康 {life.owner.health}、精神 {life.owner.mind}；当前许可：{CONSENT[life.owner.consent] ?? life.owner.consent}。</p>
      <p>接收照料者{life.recipient.name} · {life.recipient.age}岁 · {life.recipient.id}，实际在{life.recipient.location}，独立心智，健康 {life.recipient.health}、精神 {life.recipient.mind}；当前许可：{CONSENT[life.recipient.consent] ?? life.recipient.consent}。前案同意不等于同意本案。</p>
      <section aria-label="抬棺人三株原样本"><h4>不同原样本分别保存</h4>{life.samples.map(sample => <article key={sample.id}>
        <h5>{sample.id}{sample.id === currentSample?.id ? " · 当前本案原样本" : ""}</h5>
        <p>原所有者 {life.owner.id}；{sample.origin === "OWNER_GREENHOUSE" ? "原温室培养记录" : "原自然枯萎记录"}。原初{sample.originalAlive ? "活着" : "已经枯萎"}，原初活性 {sample.originalVitality} / {sample.maximumVitality}；当前{sample.alive ? "仍活着" : "已经枯萎"}，当前活性 {sample.vitality} / {sample.maximumVitality}。</p>
        <p>原重 {sample.massGrams} 克，数量 {sample.quantity}；当前在{sample.location}，{sample.holder === "CASE" ? `装于唯一原匣${life.box.id}中，匣当前由${holder(life.box.holder)}持有` : `由${holder(sample.holder)}持有`}。{sample.care === "EXPOSED" ? "本案当前仍处于测试性暴露。" : sample.care === "RECIPIENT_CARE" ? "已进入接收者照料，本批测试性衰减停止。" : "在原所有者照料中，当前没有本批测试性衰减。"}实际交付 {sample.handovers} 次，归还 {sample.returns} 次。</p>
      </article>)}</section>
      <section aria-label="抬棺人原匣与有限耗材"><h4>同一转运匣与三片一次衬片</h4>
        <p>原供货 {life.kit.sourceId}：{life.kit.purchased ? `已于第${life.kit.purchasedWeek}周真实购入` : "尚未购入，仍在供货处"}；已付 {life.kit.actionsSpent} 行动、{life.kit.costPence} 便士。</p>
        <p>唯一原匣 {life.box.id}，所有者{holder(life.box.owner)}，当前由{holder(life.box.holder)}持有、在{life.box.location}。承重 {life.box.maximumMassGrams} 克，容量 {life.box.capacity} 株；当前{life.box.sampleId ? `装有同一原样本 ${life.box.sampleId}` : "空匣"}，已实际归还 {life.box.returns} 次。匣没有免伤或复活作用。</p>
        <p>唯一观察牌 {life.tag.id} 当前由{holder(life.tag.holder)}持有、在{life.tag.location}；已实际归还 {life.tag.returns} 次。</p>
        <ul>{life.pads.map(pad => <li key={pad.id}>{pad.id} · 来源 {pad.sourceId} · {pad.status === "SPENT" ? "已用原惰性片，仍保留同物" : "尚未使用"} · 当前由{holder(pad.holder)}持有、在{pad.location}{pad.caseId && ` · 用于 ${pad.caseId}`}{pad.spentWeek !== null && ` · 第${pad.spentWeek}周实际使用`}</li>)}</ul>
        <p>原匣和牌归还到A后，下案须本人先走到A实际领取；不会在START免费复制原物或补充衬片。</p>
      </section>
      <p>原记录纸 {life.paper.id} 固定列出 {life.paper.sampleIds.join("、")}，由原所有者持有、在{life.paper.location}。原文“{life.paper.text}”；本人在A已实际读取 {life.paper.readings} 次。记录实测，不改变样本死活。</p>
      {current && <section aria-label="抬棺人当前许可与有限保全"><h4>本案当前许可与实际剩余时限</h4>
        <p>原所有者本案许可：{CONSENT[current.ownerConsent] ?? current.ownerConsent}；接收者本案许可：{CONSENT[current.recipientConsent] ?? current.recipientConsent}。</p>
        {current.consentWithdrawn && <p>莉娜已撤回本次接收和保全许可，必须先停止剩余效力，再将同一原样本普通带回A。停止不恢复活性、不退成本，也不自动返程。</p>}
        <p>本次原样本 {current.sampleId}；{current.sampleChecked ? `已当面核对，当时${current.checkedAlive ? "活着" : "已枯萎"}、活性 ${current.checkedVitality}` : "尚未当面核对生命状态"}。原纸{current.paperRead ? "已在A亲读" : "尚未亲读"}。</p>
        <p>有限保全：{current.effectActive ? "当前有效" : current.stopped ? "已实际停止" : current.effectExpired ? "已实际到期" : current.abilityTier ? "当前没有有效保全" : "尚未施术或采用普通方案"}，剩余 {current.remainingSeconds} 秒；已实际等待 {current.waitedSeconds} 秒，{current.waitCompleted ? "本次等待窗口已经完成，不能重复刷时长" : "本次窗口尚未完成"}。</p>
        <p>实际普通暴露 {current.ordinaryExposureSeconds} 秒、保全暴露 {current.protectedExposureSeconds} 秒；分别剩余累计 {current.ordinaryRemainderSeconds} / 10 秒与 {current.protectedRemainderSeconds} / 20 秒，本案已损失活性 {current.vitalityLost}。这些是已保存的计时与损失，保全不补回活性。</p>
        <p>本次已付灵性 {current.spiritualitySpent}、精神 {current.mindSpent}、实施行动 {current.resolutionActions}；原衬片 {current.padId ?? "未使用"}；{current.abilityTier ? `实际检定${TIER[current.abilityTier] ?? current.abilityTier}` : "没有实际能力检定"}。失败、停止、撤回和到期均不退费用。</p>
        <p>原样本{current.handedOver ? "已真实交付接收者" : current.sampleReturned ? "已真实交回原所有者" : current.sampleTaken ? "已装入原匣，尚需真实交付或归还" : "尚未装入原匣"}；原匣、牌与衬片{current.kitReturned ? "已实际归还到A" : "尚未实际归还"}。{current.outcomeRecorded ? "实测结果已如实记录。" : "尚未完成实测结果记录。"}</p>
      </section>}
      {attempt && <details className="seer-fold" open={failed(attempt.abilityTier)}><summary>本次实际尝试与已付代价</summary>{attemptFacts(attempt)}</details>}
      <details className="seer-fold"><summary>原现场公开记录</summary><p>{life.environment}</p>{life.facts.map((fact, index) => <p key={index}>{fact}</p>)}{life.paper.records.map((record, index) => <p key={`record-${index}`}>{record}</p>)}</details>
      <p className="slice-muted">START至A4米，A至B4米，均为净空普通通路。原样本随本人持有的同一原匣实际移动，不传送；归还原物和返程各自保存。正式照料后的样本不因随后战斗时钟继续本批测试性衰减。</p>
    </section>;
  }
  function holder(value: string) {
    return ({ OWNER: "原所有者艾达", RECIPIENT: "接收者莉娜", PLAYER: "本人", SUPPLIER: "原供货者" } as Record<string, string>)[value] ?? value;
  }
  function attemptFacts(entry: Attempt) {
    return <article><p>本次原样本 {entry.sampleId}。本次检定：{entry.abilityCheck ? `${entry.abilityCheck.roll} / 100，成功率 ${entry.abilityCheck.chance}%，${TIER[entry.abilityCheck.tier] ?? entry.abilityCheck.tier}` : "尚无实际能力检定"}。{failed(entry.abilityTier) && "失败费用保留，普通收束不当作能力成功。"}</p>
      <p>当时原所有者许可：{CONSENT[entry.ownerConsent] ?? entry.ownerConsent}；接收者许可：{CONSENT[entry.recipientConsent] ?? entry.recipientConsent}；撤回{entry.consentWithdrawn ? "已发生" : "未发生"}。保全{entry.effectActive ? "仍有效" : "当前无效"}、剩余 {entry.remainingSeconds} 秒，明确停止{entry.stopped ? "已发生" : "未发生"}，到期{entry.effectExpired ? "已发生" : "未发生"}。</p>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "有限活性保全方案" : "普通观察记录方案"}；本案{entry.closed ? "已真实退出" : "尚未真实退出"}。原样本{entry.handedOver ? "已真实交付" : entry.sampleReturned ? "已真实归还" : "尚未交付或归还"}，原匣与耗材{entry.kitReturned ? "已归还" : "尚未归还"}。</p>
      <p>实际经过 {entry.elapsedSeconds} 秒，普通步行 {entry.playerTravelMetres} 米；普通暴露 {entry.ordinaryExposureSeconds} 秒、保全暴露 {entry.protectedExposureSeconds} 秒，活性实际损失 {entry.vitalityLost}。已实际等待 {entry.waitedSeconds} 秒，窗口{entry.waitCompleted ? "已完成" : "未完成"}。</p>
      <p>已付灵性 {entry.spiritualitySpent}、精神 {entry.mindSpent}、实施行动 {entry.resolutionActions}，已用原衬片 {entry.padId ?? "无"}；真实结果：{entry.outcome ?? "尚未形成完成结果。"}</p>
      <p>有限结论{entry.limitedConfirmed ? "已如实确认" : "尚未确认"}；复活声明被拒绝 {entry.rejectedClaims} 次。原纸和原样本生命状态不因声明而改变。</p>
      {entry.evidence.length > 0 && <ol>{entry.evidence.map((fact, index) => <li key={index}>第{fact.atSecond}秒 · 原来源{fact.sourceId}：{fact.text}</li>)}</ol>}
      {entry.playerMoves.map((move, index) => <p key={`player-${index}`}>{move.from} → {move.to}：本人普通步行 {move.metres} 米、{move.seconds} 秒；亲携原物 {move.itemIds.length ? move.itemIds.join("、") : "无"}。</p>)}
      {entry.objectMoves.map((move, index) => <p key={`object-${index}`}>{move.from} → {move.to}：原物 {move.itemIds.join("、")} 随真实持有人移动 {move.metres} 米、{move.seconds} 秒。</p>)}
    </article>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene, guard = life.guard;
    return <section aria-label="抬棺人原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 独立原创G序列")}{enemy.sequence}对手。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {ENEMY_STATUS[enemy.status] ?? enemy.status}。</p>
        <p>原武器 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "原敌本人持有" : "留在原场"}。</p>
        <p>实际弧光 {enemy.powerUses.ARC_BOLT} 次、屏护 {enemy.powerUses.WARD} 次、凝神 {enemy.powerUses.COMPOSE} 次。原敌术法先付自己的全部费用；不足时回退实际普通BODY，未发动的术法不收费。普通凝神调整抵抗，不会凭空清除已经取得的原护腕防护。</p></>}
      {scene && <section aria-label="抬棺人原战场与真实退路"><h4>净空原院与普通出口</h4>
        <p>原场 {scene.courtId}；本人实际在{scene.playerPosition === "COURT" ? "原院内" : "出口"}。开放出口需普通行走 {scene.exitMetres} 米；已真实离场 {scene.ordinaryWalkedMetres} 米。</p>
        <p>净空{scene.clearanceConfirmed ? "已实际确认" : "尚未当面确认"}，第三人 {scene.thirdPartiesInArea}；原敌距本人 {scene.distanceMetres} 米。</p>
      </section>}
      <section aria-label="抬棺人新护腕与实际原段"><h4>独立新材料与有限护腕</h4>
        <p>新原材料 {guard.sourceId}；{guard.prepared ? `已于第${guard.preparedWeek}周实际制成唯一原护腕 ${guard.id}` : `尚未制成 ${guard.id}，不能当作已有护腕或原段`}。当前所有者{holder(guard.owner)}，实际位置 {guard.location}。</p>
        <p>实际制作已付 {guard.actionsSpent} 行动、{guard.costPence} 便士、{guard.spiritualitySpent}{playerText(" 灵性。新护腕为原创G，承接已有古代炼金师有限活性基质知识，不挪用旧AA4原物。")}</p>
        <ul>{guard.segments.map(segment => <li key={segment.id}>{segment.id} · {segment.status === "RAW" ? "原材料尚未制段" : segment.status === "UNUSED" ? "同一原段尚未使用" : "SPENT · 已用同一原段，残体保留"}</li>)}</ul>
        <p>当前待用模式：{encounter.guardMode === "MATRIX" ? "MATRIX · 有限活性基质" : encounter.guardMode === "PRESERVE" ? "PRESERVE · 有限活性保全" : "无"}；剩余真实防护 {encounter.guardCharges} 次。已实际尝试基质 {encounter.guardAttempts} 次，有限保全 {encounter.preservationAttempts} 次。</p>
        <p>B须一段和4灵性，成功减弱后来一次正BODY或ARC至0.6倍；K须一段和5灵性，成功最多减弱本轮后来两次正BODY或ARC至0.8倍。失败照耗；B或K任一待用时均不叠加、不再次收费。</p>
        <p>只有实际正向BODY或ARC消耗待用次数，屏护和敌方0动作不消耗。轮末未用效力结束，已用原段不变回未用。未制作或耗尽时仍可交谈和选择迎战，B回退旧普通观察，K回退普通走位，均不支付不存在的资源。</p>
      </section>
      <section className="slice-notice seer-risk" aria-label="抬棺人真实交战风险"><h4>原伤、累计风险与真实死亡继续保留</h4>
        <p>共同伤势盘基础65/30/5仍加原累计风险。有限护腕只改变本轮实际战势贡献，不改伤势后果、不抵死亡、不清旧伤、不复活。R沿用旧生命扶持，仅健康不足100且有4灵性时实际恢复健康；健康满时不收费，也不清除未治疗伤势或风险。</p>
        <p>每轮实际60秒，继续轮仅本人恢复12灵性，原敌永不补能。活人终局沿原出口实走4米4秒；死者原身体留院，原敌死后原棍留院，否则仍在原敌手中。</p>
      </section>
      {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">旧奥斯里克的原投降、原伤与资源保持，旧AA4护腕和原基质不动；新诺兰、新材料与本场CB3-GUARD分别保存，不能换一个名字重新开战。</p>
    </section>;
  }
}
