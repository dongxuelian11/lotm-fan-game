import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DemonHunterAction, DemonHunterCommand, DemonHunterProjection } from "../domain/demon-hunter/types";
import type { GuardianProjection } from "../domain/guardian/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对原现场", PREPARED: "已准备，尚未实际尝试",
  ACTIVE: "现场接触仍在继续", EXAMINED: "已有本次结果，待收束与报告", RESOLVED: "已提交有限报告",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "PREPARE_HUNT"];
const CLEANUP_TYPES = ["WITHDRAW_PROBE", "RETURN_ROUTE", "CLOSE"];
const SCENE_TYPES = ["TEST_PROBE", ...CLEANUP_TYPES, "RUSTLE"];

/** Historical facts come from the final slice projection; this view never reconstructs or replays old actions. */
export function DemonHunterGuardianHistory({ guardian: value }: { guardian: GuardianProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="守护者时期的经历">
    <h3>守护者时期的经历</h3>
    <p className="slice-notice">这里保留原奥斯温、维拉、原探测源、纸靶、实际守护与分担、双方伤势和独立原瓶，只供回看。旧经历不重新结算，同伴不会因晋升恢复健康或被召来参战。</p>
    <p>守护者扮演进度 {value.acting} · 消化：{value.digestion}</p>
    {value.practice && <section aria-label="守护者原人物伤势与原物"><h4>当时的守护、原靶与维拉</h4>
      <dl className="seer-facts"><div><dt>本人守护与实际承伤</dt><dd>{value.practice.guard}</dd></div>
        <div><dt>唯一原纸靶</dt><dd>{value.practice.target}</dd></div><div><dt>维拉的原位置、健康与分担</dt><dd>{value.practice.companion}</dd></div></dl>
      <details className="seer-fold"><summary>原探测与伤势记录</summary><ul>{value.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>
    </section>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}
      <p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>{entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold"><summary>守护者原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
      <p>{value.supplies}</p>
    </details>
    <details className="seer-fold" aria-label="守护者旧战斗装备"><summary>旧战斗剑甲与能力记录</summary>
      <dl className="seer-facts"><div><dt>旧晨曦剑</dt><dd>{value.battleEquipment.swordReady ? "原记录已有凝剑" : "原记录没有待用晨曦剑"}</dd></div>
        <div><dt>旧失剑回合</dt><dd>{value.battleEquipment.swordLostRound === null ? "没有原失剑回合" : `第${value.battleEquipment.swordLostRound}回合`}</dd></div>
        <div><dt>旧晨曦甲</dt><dd>{value.battleEquipment.armorReady ? "原记录已有光甲" : "原记录没有待用光甲"}</dd></div>
        <div><dt>旧光甲期限</dt><dd>{value.battleEquipment.armorExpiresRound === null ? "没有原期限" : `至第${value.battleEquipment.armorExpiresRound}回合`}</dd></div></dl>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      <p>旧战斗装备不能转存为新遭遇的免费剑甲。更早战士、格斗家、武器大师与黎明骑士的原人、原物归属、借还和敌人结局继续保留。</p>
    </details>
    <details className="seer-fold"><summary>守护者原故事与实践来源</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p></details>
  </section>;
}

export interface DemonHunterPanelProps {
  demonHunter: DemonHunterProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DemonHunterCommand) => void;
  readOnly?: boolean;
}
type Confirmation = { action: DemonHunterAction; contextKey: string };

function PracticeFacts({ practice }: { practice: NonNullable<DemonHunterProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="猎魔者实际标本材料与位置" aria-live="polite" aria-atomic="true">
    <h4>原物与当前现场</h4>
    <dl className="seer-facts"><div><dt>两份原标本与剩余强度</dt><dd>{practice.samples}</dd></div>
      <div><dt>实际试剂与针对性涂层</dt><dd>{practice.preparation}</dd></div><div><dt>唯一青铜探针</dt><dd>{practice.probe}</dd></div>
      <div><dt>栏后原灰蛾</dt><dd>{practice.moth}</dd></div><div><dt>本人实际位置与返回路线</dt><dd>{practice.route}</dd></div>
      <div><dt>已付成本与安全收束</dt><dd>{practice.cost}</dd></div></dl>
    {practice.history.length > 0 && <details className="seer-fold"><summary>实际耗材、接触与退出记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

function EncounterFacts({ encounter: value }: { encounter: NonNullable<DemonHunterProjection["encounter"]> }) {
  const status: Record<string, string> = { AVAILABLE: "尚未进入交战", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已沿原出口离开", LOST: "本人已死亡" };
  const outcome: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原出口撤退", ENEMY_DEAD: "原哨卫死亡", ENEMY_SURRENDERED: "原哨卫自行停止抵抗" };
  return <section aria-label="猎魔者原敌人与有限资源">
    <p>{value.name} · {value.targetId} · 危险度约序列{value.sequence}</p>
    <dl className="seer-facts"><div><dt>当前遭遇</dt><dd>{status[value.status] ?? value.status}</dd></div>
      <div><dt>原身体健康 / 精神</dt><dd>{value.enemyHealth} / {value.enemyMind}</dd></div>
      <div><dt>原敌人剩余灵性</dt><dd>{value.enemySpirituality} / 36</dd></div>
      <div><dt>已实际观察的弱点</dt><dd>{value.weakness}</dd></div>
      <div><dt>实际退出路线</dt><dd>{value.originalExit} · 无追逐</dd></div></dl>
    <section className="slice-notice" aria-label="猎魔者实际战斗涂层"><h4>这一个目标的实际涂层</h4>
      <p>剩余 {value.coatingsRemaining} 份 · 本场实付 {value.preparationCostPence} 便士</p>
      {value.coatings.length === 0 ? <p>尚未购入原涂层；两份是可准备的有限数量，不是免费库存。</p> : <ul>{value.coatings.map((coating) => <li key={coating.id}>
        {coating.id} · 仅针对 {coating.targetId} · {coating.status === "SEALED" ? "原封仍在，尚未使用" : "已经实际耗尽"}
        {coating.usedRound !== null ? ` · 第${coating.usedRound}回合使用` : ""}
      </li>)}</ul>}
      <p className="slice-muted">日常探针涂层不转作战斗材料。J须已观察弱点并有实际武器与原涂层；缺料时普通回退，不扣不存在的库存、不逐轮补货。</p>
    </section>
    <details className="seer-fold"><summary>原敌人动作、预警与临时装备</summary><p>{value.story}</p>
      <ul>{value.abilities.map((ability) => <li key={ability.id}>{ability.label} · 实付{ability.cost}灵性 · 已实际使用{value.powerUses[ability.id]}次 · {ability.available ? "当前仍具备此动作的资源" : "当前资源或身体条件不足"}</li>)}</ul>
      <p>意图预警已经发生 {value.warningUses} / 3 次；每次由同一原敌人实付2灵性，灵性不补满。隐藏自身意图只影响这一有限预警，可见攻击仍能被目视格挡。</p>
      <p>本场晨曦剑：{value.swordReady ? "已实际凝聚" : "当前没有待用晨曦剑"}；{value.swordExpiresRound === null ? "当前无持续期限" : `最迟第${value.swordExpiresRound}回合到期`}。</p>
      <p>凝剑4灵性、持剑打击另付2灵性。全力守护整轮放弃攻击，实际付3灵性；没有在场友军就没有伤害分担。旧晨曦甲不复制为本场免费防护，收束不恢复伤势或材料。</p>
    </details>
    {value.terminal && <p className="slice-notice">原战斗第{value.terminal.round}回合结束：{outcome[value.terminal.outcome] ?? value.terminal.outcome}。当时原敌人健康{value.terminal.enemyHealth}、精神{value.terminal.enemyMind}、灵性{value.terminal.enemySpirituality}；原身体结局与已用涂层保留。</p>}
  </section>;
}

/** Only local selection and review state live here. Resource, material and scene changes require committed projections. */
export function DemonHunterPanel({ demonHunter: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: DemonHunterPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const lastSelectedCase = useRef<{ id: string; status: string } | null>(null);
  const locked = busy || blocked || error !== null || readOnly;
  const confirmationLocked = locked || submittedId !== null;
  const caseActions = value.actions.filter((action) => "caseId" in action.command);
  const preparedCase = value.cases.find((entry) => entry.status === "PREPARED");
  const sceneAction = caseActions.find((action) => action.enabled && SCENE_TYPES.includes(action.command.type))
    ?? caseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const activeId = sceneAction && "caseId" in sceneAction.command ? sceneAction.command.caseId : null;
  const activeCase = preparedCase ?? (value.insideCase ? value.cases.find((entry) => entry.id === activeId) : undefined);
  const selectedCase = activeCase ?? value.cases.find((entry) => entry.id === caseId)
    ?? value.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id)) ?? value.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const bottleActions = value.actions.filter((action) => BOTTLE_TYPES.includes(action.command.type));
  const selectedBottle = value.bottles.find((entry) => entry.id === bottleId)
    ?? value.bottles.find((entry) => bottleActions.some((action) => action.enabled && "bottleId" in action.command && action.command.bottleId === entry.id)) ?? value.bottles[0];
  const selectedBottleActions = selectedBottle ? bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === selectedBottle.id) : [];
  const encounterActions = value.actions.filter((action) => ENCOUNTER_TYPES.includes(action.command.type));
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command) && !ENCOUNTER_TYPES.includes(action.command.type));
  const sceneNext = ["TEST_PROBE", ...CLEANUP_TYPES].map((type) => selectedCaseActions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = !value.promoted
    ? selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME") ?? [...growthActions, ...selectedBottleActions].find((action) => action.enabled) ?? value.actions[0]
    : (value.insideCase ? sceneNext : undefined) ?? selectedCaseActions.find((action) => action.enabled && !["WITHDRAW", "RUSTLE"].includes(action.command.type))
      ?? [...growthActions, ...encounterActions].find((action) => action.enabled) ?? value.actions[0];
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  function confirmationContext(action: DemonHunterAction): string {
    if ("bottleId" in action.command) return JSON.stringify(value.bottles.find((entry) => "bottleId" in action.command && entry.id === action.command.bottleId));
    return JSON.stringify(value.encounter);
  }
  const liveConfirmation = confirmation && confirmation.contextKey === confirmationContext(confirmation.action)
    ? value.actions.find((action) => action.id === confirmation.action.id && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmingConsume = confirmation?.action.command.type === "CONSUME";

  useEffect(() => { if (selectedCase && (activeCase || caseId === null)) setCaseId(selectedCase.id); }, [selectedCase, activeCase, caseId]);
  useEffect(() => {
    const previous = lastSelectedCase.current;
    if (selectedCase && previous?.id === selectedCase.id && previous.status !== "RESOLVED" && selectedCase.status === "RESOLVED") {
      const next = value.cases.find((entry) => entry.status !== "RESOLVED" && caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id));
      if (next) setCaseId(next.id);
    }
    lastSelectedCase.current = selectedCase ? { id: selectedCase.id, status: selectedCase.status } : null;
  }, [selectedCase, value.cases, caseActions]);
  useEffect(() => {
    if (confirmation && (readOnly || (!busy && error === null && (!liveConfirmation || (submittedId !== null && !liveConfirmation.enabled)
      || (reviewBottleId !== null && !reviewBottle))))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, readOnly, busy, error, liveConfirmation, submittedId, reviewBottleId, reviewBottle]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function actionButton(action: DemonHunterAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `demon-hunter-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (["CONSUME", "ENCOUNTER_FIGHT"].includes(action.command.type)) {
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, contextKey: confirmationContext(action) });
          } else {
            if ("caseId" in action.command) setCaseId(action.command.caseId);
            if ("bottleId" in action.command) setBottleId(action.command.bottleId);
            onCommand(action.command);
          }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`demon-hunter-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled || (reviewBottleId !== null && !reviewBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复服药、购买、涂覆或移动原物。"}
  </p>;
  const currentResources = <section aria-label={confirmingConsume ? "服药前当前资源" : "行动前当前资源"}><h4>你现在的状态</h4>
    <dl className="seer-facts"><div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div><div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div></dl>
  </section>;

  if (confirmation) return <section className="seer-panel warrior-panel demon-hunter-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶猎魔者魔药的服用确认" : "猎魔者真实迎战确认"} aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : "可选交战与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="猎魔者服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{playerText("完整配方和原著晋升仪式细节仍未知。奥斯温核对这瓶、准备原场地并在场照护，是本作原创G专业准备流程，不能据此断言无需仪式。确认仅服用此原瓶，无论成败都会消耗这一瓶。")}</p>
      <p>可以暂不服用，继续守护者生活。仅服药排异的健康与精神最低保留1，不覆盖真实战斗死亡；晋升不补满灵性，也不提供免费神话形态、白银骑士能力或封印物效果。</p>
    </> : <section className="slice-notice seer-risk" aria-label="猎魔者真实交战风险"><h4>可能重伤或死亡</h4>
      <p>{playerText("DH4-CINDER-GUARD 是本作原创G的同一具受污染灰烬守卫，具有实际身体和有限灵性。现场有普通出口、没有旁观者与追逐；可以选择普通交谈后退出。")}</p>
      <p>辨识弱点须真实观察；针对性攻击须实际原涂层，库存为空时只按普通攻击处理。隐藏意图不让身体隐形，也不能阻止敌人看见、格挡实际攻击。</p>
      <p>战斗伤势、撤退和死亡照常结算，服药照护不保护实战。旧同伴不会被召来分担伤害，旧对手不会复活。</p>
    </section>}
    {currentResources}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="demon-hunter-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "demon-hunter-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : "确认风险，开始真实交战"}</button></div>
    <p className="slice-muted">取消不会消耗原瓶或开始战斗。保存未确认时保留这一次操作，等待原保存重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel demon-hunter-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="猎魔者成长下一步"><span className="seer-seal">{value.promoted ? "猎魔者4" : "守护者5 → 猎魔者4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    {!value.promoted && <section className="slice-notice" aria-label="猎魔者配方与成品边界"><h4>未知配方与独立成品</h4>
      <p>{playerText("完整配方、材料、用量、调配顺序和原著晋升仪式细节仍未知。使用有来源的原创G专业准备与指导服药流程，不能据此断言无需仪式。")}</p>
      <p>用药指导540便士、1行动；每瓶全价6800便士。五次真实劳务抵5300便士后仍付1500便士；付款和独立服药各0行动。可以继续守护者生活。</p>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="猎魔者指导与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <section aria-label="猎魔者原瓶供给"><h3>独立原瓶与实际供给</h3><p>{value.supplies}</p>
      <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立猎魔者原瓶" value={selectedBottle.id} disabled={locked}
        onChange={(event) => setBottleId(event.target.value)}>{value.bottles.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
      <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
      <div className="warrior-action-list" role="group" aria-label="当前原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
    </section>}
    {value.promoted && selectedCase && <section aria-label="猎魔者有限生活实践"><h3>辨识、准备与接近</h3>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前猎魔者生活实践" value={selectedCase.id} disabled={locked || !!activeCase || value.insideCase}
        onChange={(event) => setCaseId(event.target.value)}>{value.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {value.practice && <PracticeFacts practice={value.practice} />}
        {selectedCase.result && <section className="slice-notice" aria-label="猎魔者实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前猎魔者生活行动">{selectedCaseActions.filter((action) => action.command.type !== "RUSTLE").map(actionButton)}</div>
        {selectedCaseActions.some((action) => action.command.type === "RUSTLE") && <details className="seer-fold">
          <summary>可选：制造响声验证（会中断本次任务）</summary>
          <p>衣料声会让原灰蛾警觉，即使意图仍被遮蔽。这样会中断本次安静接近，不能提交成功报告；必须先原路返回、合盖，到下一真实周重试。</p>
          <div className="warrior-action-list" role="group" aria-label="主动中断本次安静接近">{selectedCaseActions.filter((action) => action.command.type === "RUSTLE").map(actionButton)}</div>
        </details>}
        <details className="seer-fold" aria-label="猎魔者当前已知现场"><summary>已观察的事实与本次方法边界</summary>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}
          <p>{value.environment}</p>
        </details>
      </section>
      <p className="slice-muted">普通方法同样能完成有限报告。失败保留实际消耗与现场结果，下一真实周才能重试；原探针须取回、本人须沿原路返回，才能收束并报告。</p>
    </section>}
    {value.promoted && <section aria-label="猎魔者可选交战"><h3>侧院原灰烬守卫</h3>
      {value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="猎魔者准备交谈或真实迎战">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="猎魔者能力与消化"><h3>能力与消化</h3>
      <progress className="cryptologist-progress" aria-label="猎魔者扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">三项新能力从0掌握开始，旧能力和实际经历保留。下一序列是白银骑士3，本阶段不提供免费永久神话形态、白银骑士能力或封印物效果。</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>猎魔者原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
      <p>{playerText("已耗原瓶不复原，未服原瓶保持原状态；完整配方与原著仪式细节仍未知。")}</p>
    </details>}
    <details className="seer-fold" aria-label={playerText("猎魔者能力与使用范围")}><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>辨识只针对具体痕迹，不裁决人品或读取物主完整历史。针对性准备需要实际材料，隐藏意图不消除可见身体与声音。</p>
      <p>{playerText("两份原标本、虚构原试剂、探针、灰蛾与两米路线均为本作G，不提供真实化学配方，也不把灰蛾的有限反应推广为所有恶魔的职业通则。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
