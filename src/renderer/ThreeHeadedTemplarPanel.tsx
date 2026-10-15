import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ThreeHeadedTemplarAction, ThreeHeadedTemplarCommand, ThreeHeadedTemplarProjection } from "../domain/three-headed-templar/types";
import { THREE_HEADED_TEMPLAR_FORMULA_STATUS, THREE_HEADED_TEMPLAR_SOURCE_STATUS } from "../domain/three-headed-templar/content";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "原现场尚未收束", EXAMINED: "待收束与报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "尚未询问", GRANTED: "本案已同意", DECLINED: "本案已拒绝", CLOSED: "本案接触已结束" };
const SPIRIT_STATUS: Record<string, string> = { SEALED: "原灵仍封存，尚未取得", GRAZED: "实际已放牧", RELEASED: "已永久释放，不能重新取得", DISSIPATED: "原灵已消散，不能恢复" };
const LOCATION: Record<string, string> = { SEALED: "原封存容器", INTERNAL: "已收回体内", START: "原站START", A: "原处A", B: "原处B", COURT: "原院COURT", RELEASED: "已永久离开", DISSIPATED: "已经消散" };
const METHOD: Record<string, string> = { SIGNAL: "有限信号", BRIEF_WARD: "短暂防护", LOW_GLOW: "低光照看", STEADY_HOLD: "稳持原物", SCREEN: "有限遮护" };
const ENEMY_STATUS: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "原身体仍活着，已投降", DEAD: "原身体已死亡" };
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const SPIRIT_TYPES = new Set(["MEET_SPIRITS", "PREPARE_GRAZING", "GRAZE", "RELEASE_GRAZED", "REST_SPIRIT", "EXTERNALIZE", "RECALL_SPIRIT", "SEND_SPIRIT", "ASSIST"]);
const LOCAL_SPIRIT_TYPES = new Set(["EXTERNALIZE", "RECALL_SPIRIT", "SEND_SPIRIT", "ASSIST"]);
const EXIT_TYPES = new Set(["WITHDRAW", "WALK_A", "RETURN_START", "RETURN_CARD", "CLOSE_SHUTTER", "CLOSE", "RECALL_SPIRIT", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const CANCEL_TYPES = new Set(["WITHDRAW", "RELEASE_GRAZED", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
type Goal = "preparation" | "spirits" | "encounter" | `bottle:${string}` | `case:${string}`;
type Confirmation = { action: ThreeHeadedTemplarAction; facts: string };
type Attempt = NonNullable<ThreeHeadedTemplarProjection["life"]["currentAttempt"]>;
type Spirit = ThreeHeadedTemplarProjection["life"]["spirits"][number];
const goalFor = (action: ThreeHeadedTemplarAction): Goal => "bottleId" in action.command ? `bottle:${action.command.bottleId}`
  : "caseId" in action.command ? `case:${action.command.caseId}` : ENCOUNTER_TYPES.has(action.command.type) ? "encounter"
  : SPIRIT_TYPES.has(action.command.type) ? "spirits" : "preparation";

export interface ThreeHeadedTemplarPanelProps {
  value: ThreeHeadedTemplarProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ThreeHeadedTemplarCommand) => void;
  /** Closing the view never recalls spirits, walks the player or returns an original item. */
  onClose?: () => void;
}

/** Displays committed public facts and submits existing public intentions without simulating outcomes. */
export function ThreeHeadedTemplarPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: ThreeHeadedTemplarPanelProps) {
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
    ? [{ id: "spirits", label: "原封存来源与实际放牧" }, ...life.cases.map(entry => ({ id: `case:${entry.id}` as const, label: `${entry.title} · ${CASE_STATUS[entry.status] ?? entry.status}` })), { id: "encounter", label: "布拉姆的可选原场冲突" }]
    : [{ id: "preparation", label: "独立成品指导与三项专业准备" }, ...value.bottles.map(bottle => ({ id: `bottle:${bottle.id}` as const, label: `${bottle.title} · ${bottle.status}` }))];
  const selectedCase = goal.startsWith("case:") ? life.cases.find(entry => `case:${entry.id}` === goal) : undefined;
  const selectedBottle = goal.startsWith("bottle:") ? value.bottles.find(entry => `bottle:${entry.id}` === goal) : undefined;
  const currentActions = value.actions.filter(action => {
    if (selectedBottle) return "bottleId" in action.command ? action.command.bottleId === selectedBottle.id
      : ["PREPARE_PROMOTION", "LEAVE_PREPARATION"].includes(action.command.type);
    if (selectedCase) return "caseId" in action.command ? action.command.caseId === selectedCase.id
      : action.command.type === "REFLECT" || LOCAL_SPIRIT_TYPES.has(action.command.type);
    if (goal === "encounter") return ENCOUNTER_TYPES.has(action.command.type) || LOCAL_SPIRIT_TYPES.has(action.command.type);
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

  function submit(action: ThreeHeadedTemplarAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: ThreeHeadedTemplarAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    const command = action.command;
    if (["CONSUME", "GRAZE", "RELEASE_GRAZED"].includes(command.type)) {
      if (command.type === "CONSUME" && (value.promoted || !value.bottles.some(bottle => bottle.id === command.bottleId))) return;
      if ("spiritId" in command && !life.spirits.some(spirit => spirit.id === command.spiritId)) return;
      returnActionId.current = action.id; setConfirmation({ action, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: ThreeHeadedTemplarAction[], label: string) {
    return <div className="warrior-action-list" role="group" aria-label={label}>{actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `three-headed-templar-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>{action.reason && <p className="seer-action-reason" id={`three-headed-templar-reason-${action.id}`}>{action.reason}</p>}
    </div>)}</div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="三首圣堂当前资源"><h4>当前实际资源</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div><div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{current.cash}</dd></div><div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function preparationCosts() {
    return <section className="slice-notice seer-risk" aria-label="三首圣堂服药准备与成本"><h4>原瓶与本次准备分别付费</h4>
      <p>本周场地检查需要1行动、140便士；当前{value.preparedWeek === null ? "尚无已保存的本次准备" : `第${value.preparedWeek}周的准备已保存，140便士不退`}。服药0行动，成功或失败都会耗尽所选原瓶。</p>
      <p>可以留在黑骑士4。结束已付准备不退行动或140便士，未服原瓶仍保留；排异后须实际取得另一原瓶并重新准备，原失败与已付成本不清除。</p>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">{playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、放牧、释放或移动原物。"}</p>;
  const pendingNotice = (busy || submittedId !== null) && error === null ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const command = confirmation.action.command;
    const bottle = "bottleId" in command ? value.bottles.find(entry => entry.id === command.bottleId) : undefined;
    const spirit = "spiritId" in command ? life.spirits.find(entry => entry.id === command.spiritId) : undefined;
    const releasing = command.type === "RELEASE_GRAZED";
    const label = bottle ? "三首圣堂原瓶服用确认" : releasing ? "三首圣堂永久释放确认" : "三首圣堂原灵放牧确认";
    const confirmLabel = bottle ? "确认服用这一原瓶" : releasing ? "确认永久释放这一原灵" : "确认尝试放牧这一原灵";
    return <section className="seer-panel mystic-panel three-headed-templar-panel seer-confirmation" aria-label={label} aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">{bottle ? "这一独立原瓶 · 服用前确认" : releasing ? "同一原灵 · 不可逆释放" : "同一原封存来源 · 风险放牧"}</div>
      <h3 ref={confirmationHeading} tabIndex={-1}>{bottle?.title ?? spirit?.name ?? confirmation.action.label}</h3>
      {bottle && <><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p><p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
        {preparationCosts()}<section aria-label="三首圣堂服用风险与四档结果"><h4>意志难度30与实际四档风险</h4><p>{value.risk}</p></section>
        <p>{playerText(THREE_HEADED_TEMPLAR_FORMULA_STATUS)}</p><p>晋升保留同一原身体、原人物与原物。成功四属性各+1、灵性上限120，当前灵性不补满；只新增有限双灵外放，未取得的半神灵不会自动入库。</p></>}
      {spirit && spiritFacts(spirit)}
      {!bottle && <p>本次消耗：{confirmation.action.cost}</p>}
      {releasing && <p className="seer-risk">确认后，这一原灵永久释放，保留原取得、已选技能与释放记录，但失去外放和协作权。不能从同一来源重新取得，也不会获赠替代灵。收回外放灵只让同一原灵返回，和永久释放不同。</p>}
      {command.type === "GRAZE" && <><p>本次明确选择：{command.abilityIds.map(id => METHOD[id] ?? id).join("、")}。</p>
        <p className="seer-risk">须本人实际会面并取得原保管者交接同意，使用这一次已付180便士准备。知识18检定实耗1行动、6灵性、2精神；失败仍耗尽本周准备并保留成本，原灵仍封存。下一真实周可重新付费准备同一原灵，不会复制或补发来源。</p></>}
      {resources()}{liveConfirmation?.reason && <p className="seer-action-reason" id="three-headed-templar-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>{bottle ? "暂不服用，返回准备" : "暂不提交，返回原记录"}</button>
        <button className="slice-button" disabled={locked || !liveConfirmation?.enabled} aria-describedby={liveConfirmation?.reason ? "three-headed-templar-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{confirmLabel}</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，保存失败保留这一原意图。</p>{pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel mystic-panel three-headed-templar-panel" aria-label="三首圣堂" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="三首圣堂当前目标"><span className="seer-seal">{value.promoted ? "三首圣堂 · 倒吊人序列3" : "黑骑士4 → 三首圣堂3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>三首圣堂与有限双灵外放</h3><p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? "本周目已经死亡，原身体、原人物与原物记录只读保留。"
        : nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}` : value.nextStep}</p>
      <p>{value.digestion}</p>{value.promoted && <p>三首圣堂扮演 {value.acting} / 100</p>}<p className="slice-muted">{playerText("原核支持突破一次只外放一位半神灵的限制；本作至多2位外放与全部精确范围、成本、数值均为原创G。完整配方与原著晋升仪式未知。")}</p>
    </section>
    {resources()}
    <label>选择三首圣堂事项<select aria-label="选择三首圣堂事项" disabled={locked || !!activeCase || life.insideCase || encounter.inside}
      value={goal} onChange={event => { const selected = goals.find(entry => entry.id === event.target.value); if (selected && !locked) setSelectedGoal(selected.id); }}>
      {goals.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select></label>
    {selectedBottle && <section aria-label="当前独立三首圣堂原瓶"><h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id} · {selectedBottle.status}</p><p>来源：{selectedBottle.source}</p></section>}
    {selectedCase && <section className="seer-current-case" aria-label="当前三首圣堂生活情境"><h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {life.activeCase === selectedCase.id && <p className="seer-next">{life.nextStep}</p>}{selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施、报告各1行动；三报告各25、反思25。未取得原灵仍可本人依次步行，普通报告与反思可到扮演100，不算双灵能力使用，也不增加新能力掌握。只有实际外放协作并报告才加掌握8。</p>
    </section>}
    {!value.promoted && preparationCosts()}
    <section aria-label="三首圣堂当前行动"><h4>{life.insideCase ? "当前原现场的下一步" : "当前可选行动"}</h4>
      {nextAction ? actionList([nextAction], "三首圣堂下一步") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其它可选方法</summary>{actionList(alternatives, "三首圣堂其它公开行动")}</details>}
      {exits.length > 0 && <section aria-label="三首圣堂停止与真实返程"><h4>停止与真实返程</h4>{actionList(exits, "三首圣堂实际收束")}
        <p className="slice-muted">0行动清理仍须实际移动、收回原灵、归还原卡和关闭原遮板。撤回许可或关闭页面不传送本人，不免费消失外放灵，不返还已耗资源。</p></section>}
      {unavailable.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailable, "三首圣堂尚不可提交的步骤")}</details>}
    </section>
    {value.promoted && sourceFacts()}{selectedCase && lifeFacts()}{goal === "encounter" && encounterFacts()}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary><section aria-label="三首圣堂成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
      <p>{playerText(THREE_HEADED_TEMPLAR_FORMULA_STATUS)}</p><p>{value.supplies}</p>
      <p>{playerText("原创G导师玛拉·埃尔文，51岁，THT3-MARA。指导500便士；每瓶6400便士，或本瓶五次真实劳务后900便士；三项专业准备各1行动。黑骑士须至少12整周、消化100，再付本周准备1行动与140便士。")}</p>
      <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
      <p>{playerText("三项专业准备是原创G适配，不充当已核原著仪式。成品原瓶与原灵封存容器独立，购买魔药不会赠送灵魂。")}</p>
      {value.bottles.map(bottle => <p key={bottle.id}>{bottle.title} · {bottle.id} · {bottle.source} · {bottle.status}</p>)}<p>{value.risk}</p>
    </section></details>
    {value.promoted && <details className="seer-fold"><summary>三项原案的观察与实际结果</summary><section aria-label="三首圣堂生活记录">{life.cases.map(entry => <article key={entry.id}>
      <h4>{entry.title}</h4><p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次。</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}{entry.attempts.map((record, index) => <div key={index}>{attemptFacts(record)}</div>)}
    </article>)}</section></details>}
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary><section aria-label={playerText("三首圣堂能力与使用范围")}><h4>同一原灵的有限外放</h4>
      <p>{playerText(THREE_HEADED_TEMPLAR_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>原总放牧容量7、每灵至多3项实际已选技能；主人一次只借1灵。本段本人借用仅接原已选伊芮斯，新增两来源仅能做实际外放协作，不开放完整三身体借法库。</p>
      <p>外放启动每灵实付4灵性、2精神，知识18；灵各有实际有限灵性与完整度，方法各付自身3灵性，主人另付控制维持成本。收回不会补满。强光只中断受影响原灵，仍须按原路径收回；其它原灵依实际状态继续。</p>
      <p>{playerText("原封存照护只在后续真实周实付1行动、40便士，有限恢复10灵性与10完整度，不能复活已消散或已永久释放者。所有精确上限与费用均G。")}</p>
    </section></details>
    <details className="seer-fold"><summary>原灵、原储备与旧倒吊人路线记录</summary><section aria-label="三首圣堂继承记录"><h4>原六阶段的实际原物与经历</h4>
      <p>{value.inheritedTools}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      <p>旧名册、永久释放、原加里克结局和旧不受控影体的实际隔离保持。原伊芮斯仅按实际已选与当前驱使记录借用；不会把旧原灵升格成新增半神来源。原血肉储备与原包只读实际库存，不补库存、不复活旧人、不回收释放者，也不把隔离影体变成宠物。</p>
    </section></details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭三首圣堂页面</button>}{pendingNotice}{saveNotice}
  </section>;

  function sourceFacts() {
    const acquired = life.spirits.filter(spirit => spirit.status === "GRAZED");
    const outside = acquired.filter(spirit => ["START", "A", "B", "COURT"].includes(spirit.location));
    return <section aria-label="三首圣堂原灵来源与实际资源"><h4>原封存来源与实际资源</h4><p>新来源实际可用 {acquired.length} 位 · 实际外放 {outside.length}{playerText(" / 2 位（本作G上限）。旧灵仍按原名册计入总放牧7，不属于这两位新来源。")}</p>
      {life.spirits.length ? life.spirits.map(spirit => <article key={spirit.id}>{spiritFacts(spirit)}</article>) : <p>尚无可见的已会面来源；晋升与成品购买不会自动取得半神灵。</p>}
      <p className="slice-muted">只有已经实际放牧、仍可用的同一原灵才能外放。未取得、永久释放或消散的记录不计为可用库存。没有取得原灵也可以选择普通步行方法。</p>
    </section>;
  }
  function spiritFacts(spirit: Spirit) {
    return <><h4>{spirit.name} · {SPIRIT_STATUS[spirit.status] ?? spirit.status}</h4><p>原灵魂：{spirit.id} · 生前{spirit.age}{playerText("岁 · 此前已故的原创G序列")}{spirit.sequence}相当来源。</p>
      <p>原死亡记录：{spirit.deathRecordId}；原封存容器：{spirit.casketId}；原保管者：{spirit.custodianId}。</p>
      <dl className="seer-facts"><div><dt>原灵实际灵性</dt><dd>{spirit.spirituality} / 30</dd></div><div><dt>原灵实际完整度</dt><dd>{spirit.integrity} / 100</dd></div>
        <div><dt>同一原灵实际位置</dt><dd>{LOCATION[spirit.location] ?? spirit.location}</dd></div><div><dt>实际已选方法</dt><dd>{spirit.selectedAbilities.map(id => `${METHOD[id] ?? id}（${id}）`).join("、") || "尚未选择或取得"}</dd></div></dl>
      <p>取得周：{spirit.acquiredWeek ?? "尚未取得"} · 准备周：{spirit.preparedWeek ?? "尚无当次准备"} · 原尝试周：{spirit.attemptWeek ?? "尚未尝试"} · 释放周：{spirit.releasedWeek ?? "尚未释放"} · 最近照护周：{spirit.restWeek ?? "尚未照护"}。</p>
      <p>原路径累计 {spirit.travelMetres} 米；{spirit.interrupted ? ["START", "A", "B", "COURT"].includes(spirit.location) ? "已受强光中断，须按原路收回" : "原强光中断记录保留" : "当前无中断记录"}。战斗协作{spirit.supportEnabled ? "已在实际外放状态启用，仍逐次付费" : "当前未启用"}。</p>
      {spirit.status === "SEALED" && <p>尚未取得，不能外放或协作。原灵与封存记录仍在，不是玩家现有灵魂库存。</p>}
      {spirit.status === "RELEASED" && <p>这一次永久释放已经保存，原记录保留但不可重新取得，不补发替代者。</p>}
      {spirit.status === "DISSIPATED" && <p>同一原灵已消散，照护与再次外放均不能复活。</p>}
      <details className="seer-fold"><summary>{spirit.name}的原方法与实际消耗记录</summary>
        <p>本来源已知有限方法：{spirit.knownAbilities.map(id => `${METHOD[id] ?? id}（${id}）`).join("、")}。只有实际已选方法可以使用。</p>
        {spirit.history.length ? <ol>{spirit.history.map((entry, index) => <li key={index}>第{entry.week}周 · 第{entry.atSecond}秒 · {entry.type}{entry.method ? ` · ${METHOD[entry.method] ?? entry.method}` : ""}{entry.tier ? ` · ${TIER[entry.tier] ?? entry.tier}` : ""}；主人实耗灵性{entry.masterCost}、精神{entry.mindCost}、现金{entry.cashCost}便士；原灵实耗灵性{entry.spiritCost}；实际{entry.metres}米/{entry.seconds}秒{entry.destination ? `，记录位置${LOCATION[entry.destination] ?? entry.destination}` : ""}。</li>)}</ol>
          : <p>尚无实际付费、放牧、外放或协作记录。</p>}
      </details></>;
  }
  function lifeFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    return <section aria-label="三首圣堂原人原物与真实位置"><h4>本人、同一原灵与原物路径</h4>
      {life.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p>本人实际在{life.playerLocation}；唯一原卡{life.card.id}在{life.card.location === "PLAYER" ? "本人手中" : "A原桌上"}，实际携行{life.card.travelMetres}米。原左箱{life.leftBox.id}在A、原右箱{life.rightBox.id}在B。</p>
      <p>原灯{life.lamp.id}{life.lamp.on ? "实际开启" : "保持关闭"}；原遮板{life.shutter.id}{life.shutter.state === "OPEN" ? "实际打开" : "实际关闭"}；原远端封条{life.farSeal.id}仍在B。</p>
      {attempt && attemptFacts(attempt)}
      <p className="slice-muted">本人START至A为4米、至B为8米，沿同一路径实际行走。原卡、原箱、原灯与原遮板不会复制；资源耗尽仍可执行公开的0行动撤回、普通返程、收回与归还。页面等待不会自行计秒或替你清理。</p>
    </section>;
  }
  function attemptFacts(entry: Attempt) {
    return <article><p>第{entry.week}周 · {entry.method === "ABILITY" ? "外放协作方法准备" : "普通方法准备"} · {entry.result === "ABILITY" ? "实际外放协作完成" : entry.result === "ORDINARY" ? "普通方法完成，不计能力使用" : "尚无完成结果"}。</p>
      <p>原主许可：{CONSENT[entry.ownerConsent] ?? entry.ownerConsent}；许可{entry.withdrawn ? "已实际撤回" : "尚无撤回记录"}；现场{entry.closed ? "已实际收束" : "尚未收束"}。</p>
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人实际行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}、精神 {entry.mindSpent}；实际维持付费{entry.maintenancePayments}次。</p>
      <p>原卡{entry.cardReturned ? "已实际归还" : entry.cardTaken ? "已领取，尚未归还" : "尚未领取"}；原光场{entry.lightClosed ? "已实际关闭" : entry.lightOpened ? "已经开启，尚未关闭" : "尚未开启"}。</p>
      <p>{entry.abilityUsed ? "本次已有实际外放能力使用记录。" : "本次尚无实际外放能力使用记录。"}{entry.simultaneousCare ? "两原灵曾分别实际在A/B同时照料。" : "尚无双灵同时照料记录。"}{entry.helenaInterrupted ? "赫莲娜原灵实际受到强光中断。" : ""}{entry.rolandContinued ? "罗兰原灵在另一处继续了实际协作。" : ""}</p>
      <section aria-label="三首圣堂已取得的有限信息"><h4>已实际取得的观察与回报</h4>{entry.evidence.length ? <ol>{entry.evidence.map((fact, index) => <li key={index}>第{fact.atSecond}秒 · 原件{fact.sourceId}：{fact.text}</li>)}</ol> : <p>尚无实际观察或回报；没有未来答案。</p>}</section>
      {entry.playerMoves.map((move, index) => <p key={index}>{move.from} → {move.to}：本人实际行走 {move.metres} 米、{move.seconds} 秒；携行原物 {move.itemIds.length ? move.itemIds.join("、") : "无"}。</p>)}
    </article>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="三首圣堂原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁 · {enemy.id}。</p><p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {ENEMY_STATUS[enemy.status] ?? enemy.status}。</p>
        <p>原武器 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "原敌本人持有" : "留在原场"}。</p>
        <p>实际弧光 {enemy.powerUses.ARC_BOLT} 次、屏护 {enemy.powerUses.WARD} 次、强光中断 {enemy.powerUses.LIGHT_BREAK} 次。</p></>}
      {encounter.scene && <section aria-label="三首圣堂原战场与真实退路"><h4>原场与普通出口</h4>
        <p>原场 {encounter.scene.courtId}；本人实际在{encounter.scene.playerPosition === "COURT" ? "原场内" : "出口"}。原出口实际开放，离场须本人走 {encounter.scene.exitMetres} 米。</p>
        <p>净空{encounter.scene.clearanceConfirmed ? "已实际确认" : "尚未当面确认"}，场内第三人 {encounter.scene.thirdPartiesInArea}；原人相距 {encounter.scene.distanceMetres} 米，累计普通离场 {encounter.scene.ordinaryWalkedMetres} 米。</p>
      </section>}
      {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
      <p className="slice-muted">{playerText("可选原创G冲突只使用已在COURT的实际外放原灵。每灵每轮至多1次已选协作，实付自身3灵性与主人1灵性；未到场、未选方法或资源不足均不生效。敌方先行强光可在协作前驱回一灵，已经发生并付费的协作不撤销。")}</p>
      <p className="slice-muted">存活离场须原灵按原4米路径返回、本人普通走4米；不补满。玩家死亡保留真实死亡，并永久释放当时实际外放原灵。旧加里克不重新开战。</p>
    </section>;
  }
}
