import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { BizarroSorcererAction, BizarroSorcererCommand, BizarroSorcererProjection } from "../domain/bizarro-sorcerer/types";
import type { MarionettistProjection } from "../domain/marionettist/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察", OBSERVED: "已观察原现场", PREPARED: "已准备，尚未执行",
  ACTIVE: "原现场仍需实际返回与收束", EXAMINED: "已实际收束，等待报告", RESOLVED: "已实际收束并报告",
};
const MOUSE_STATUS: Record<string, string> = {
  WILD: "同一原野鼠仍自由活着", HELD: "已普通活捕，原鼠仍活着", INITIAL_CONTROL: "3秒初控，原鼠仍活着",
  CONTROLLED: "原鼠真正死亡，同一身体仍受控", RELEASED: "已放生同一活鼠，不再捕获", INERT: "原鼠已死，解除控制后留下同一死物",
};
const POSITION: Record<string, string> = { NEAR: "原近端", FAR: "原远端", WILD: "原野地", CARRIER: "原携笼", RELEASE_SITE: "原放生地" };
const RITUAL_TYPES = ["SURVEY_RITUAL", "PREPARE_STAGE", "GATHER_WITNESSES", "START_RITUAL", "CLOSE_RITUAL", "REQUEST_NEXT_RITUAL", "REQUEST_NEW_LEAD", "RECEIVE_LEAD", "START_CHALLENGE"];
const MOUSE_TYPES = ["CAPTURE_MOUSE", "RELEASE_MOUSE", "BEGIN_MOUSE_CONTROL", "COMPLETE_MOUSE_CONTROL", "ASSIGN_WORM", "RECALL_WORM", "DISMISS_MOUSE"];
const TRANSIT_TYPES = ["FLAME_OUT", "FLAME_BACK", "PUPPET_ILLUSION", "WALK_MOUSE_FAR", "SWAP_OUT", "SWAP_BACK", "RETURN_ORDINARY"];
const CONFIRM_TYPES = ["CONSUME_FINALE", "COMPLETE_MOUSE_CONTROL", "DISMISS_MOUSE", "START_RITUAL", "START_CHALLENGE"];

/** The old account is a record, never a second source of bodies, rituals or supplies. */
export function BizarroMarionettistHistory({ marionettist }: { marionettist: MarionettistProjection }) {
  return <section className="seer-panel magician-panel" aria-label="秘偶大师时期的经历">
    <h3>秘偶大师时期的经历</h3>
    <p className="slice-notice">原歌声仪式、独立原瓶、真实失败与同一原身体的结局继续保留，只供回看。晋升没有复活多恩，也没有复制秘偶。</p>
    <p>秘偶大师扮演进度 {marionettist.acting} · 消化：{marionettist.digestion}</p>
    <details className="seer-fold"><summary>同一原身体与原物的实际去向</summary>
      <p>{marionettist.puppet.status}</p><p>{marionettist.puppet.summary}</p>
      <p>原身体：{marionettist.puppet.targetId ?? "尚无已结算原身体"} · 实际控制 {marionettist.puppet.elapsedSeconds} 秒</p>
      <p>{marionettist.puppet.alive === null ? "尚无生命结局记录" : marionettist.puppet.alive ? "原人仍然活着" : "原人真正死亡，不可逆"}</p>
      <p>{marionettist.puppet.body}</p><p>{marionettist.puppet.equipment}</p><p>{marionettist.puppet.distance}</p><p>{marionettist.puppet.note}</p>
    </details>
    <details className="seer-fold"><summary>原海岸歌声、来源与供给</summary>
      <p>{marionettist.ritual.status}</p><p>{marionettist.ritual.summary}</p><p>{marionettist.ritual.source}</p>
      <p>实际到访 {marionettist.ritual.visits} 次 · 实际服用 {marionettist.ritual.consumptions} 瓶</p>
      {marionettist.story && <p>{marionettist.story}</p>}{marionettist.supplies && <p>{marionettist.supplies}</p>}
    </details>
    {marionettist.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={`${entry.id}-${index}`}>{text}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {marionettist.formulaKnown && <details className="seer-fold"><summary>秘偶大师时期已知配方</summary>
      <ul className="seer-formula">{marionettist.formula.map((material) => <li key={material.name}><span>{material.name}</span>
        <strong>{material.quantity === null ? playerText("原著未给量") : `${material.quantity} ${material.unit}`}</strong>{material.note && <small>{material.note}</small>}</li>)}</ul>
    </details>}
    {marionettist.bottles.length > 0 && <details className="seer-fold"><summary>秘偶大师原瓶 · 来源与去向</summary>
      {marionettist.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {marionettist.abilities.length > 0 && <details className="seer-fold"><summary>秘偶大师时期能力记录</summary>
      {marionettist.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface BizarroSorcererPanelProps {
  bizarroSorcerer: BizarroSorcererProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: BizarroSorcererCommand) => void;
}
interface Confirmation {
  action: BizarroSorcererAction;
  bottle: BizarroSorcererProjection["bottles"][number] | null;
}

/** Public actions own all gates and costs. A failed save retains the same confirmed intent. */
export function BizarroSorcererPanel({ bizarroSorcerer: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: BizarroSorcererPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [mouseOpen, setMouseOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const locked = busy || blocked || error !== null || readOnly;
  const confirmationLocked = locked || submittedId !== null;
  const actions = [...new Map([...value.actions, ...value.ritual.actions].map((action) => [action.id, action])).values()];
  const liveConfirmation = confirmation && actions.find((action) => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command));
  const caseActions = actions.filter((action) => "caseId" in action.command);
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const activeCaseId = value.life.practice.activeCase ?? (closeAction && "caseId" in closeAction.command ? closeAction.command.caseId : null);
  const selectedCase = (value.insideCase ? value.life.cases.find((entry) => entry.id === activeCaseId) : undefined)
    ?? value.life.cases.find((entry) => entry.id === caseId)
    ?? value.life.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? value.life.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const isCurrentPracticeWormAction = (action: BizarroSorcererAction) => activeCaseId !== null && ["ASSIGN_WORM", "RECALL_WORM"].includes(action.command.type);
  const transitActions = actions.filter((action) => (TRANSIT_TYPES.includes(action.command.type) || isCurrentPracticeWormAction(action)) && !("caseId" in action.command));
  const mouseActions = actions.filter((action) => MOUSE_TYPES.includes(action.command.type) && !isCurrentPracticeWormAction(action));
  const ritualActions = actions.filter((action) => RITUAL_TYPES.includes(action.command.type));
  const growthActions = actions.filter((action) => action.command.type !== "CONSUME_FINALE" && !("caseId" in action.command)
    && !TRANSIT_TYPES.includes(action.command.type) && !MOUSE_TYPES.includes(action.command.type) && !RITUAL_TYPES.includes(action.command.type));
  const batchIds = [...new Set(growthActions.flatMap((action) => "batchId" in action.command ? [action.command.batchId] : []))];
  const firstEnabledBatchId = growthActions.flatMap((action) => action.enabled && "batchId" in action.command ? [action.command.batchId] : [])[0];
  const currentBatchId = batchId !== null && batchIds.includes(batchId) ? batchId : firstEnabledBatchId ?? batchIds[0];
  const visibleGrowthActions = growthActions.filter((action) => !("batchId" in action.command) || action.command.batchId === currentBatchId);
  const hasPreparedBottle = actions.some((action) => action.command.type === "CONSUME_FINALE");
  const finaleActions = actions.filter((action) => value.ritual.phase === "FINALE" && action.command.type === "CONSUME_FINALE"
    && action.command.bottleId === value.ritual.finaleBottleId);
  const nextAction = value.insideCase ? [...transitActions, ...selectedCaseActions, ...mouseActions].find((action) => action.enabled) ?? closeAction
    : finaleActions.find((action) => action.enabled) ?? (value.promoted ? [...selectedCaseActions, ...visibleGrowthActions].find((action) => action.enabled) : undefined)
      ?? (!value.promoted && !hasPreparedBottle ? visibleGrowthActions.find((action) => action.enabled) : undefined)
      ?? ritualActions.find((action) => action.enabled)
      ?? [...visibleGrowthActions, ...selectedCaseActions, ...mouseActions].find((action) => action.enabled) ?? actions[0];

  useEffect(() => {
    if (selectedCase && (value.insideCase || caseId === null)) setCaseId(selectedCase.id);
  }, [selectedCase, value.insideCase, caseId]);
  useEffect(() => {
    if (confirmation && (readOnly || (!busy && error === null && !liveConfirmation))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, liveConfirmation, busy, error, readOnly]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function openConfirmation(action: BizarroSorcererAction) {
    if (locked || !action.enabled) return;
    const selectedBottleId = action.command.type === "CONSUME_FINALE" ? action.command.bottleId : null;
    const bottle = value.bottles.find((entry) => entry.id === selectedBottleId) ?? null;
    if (action.command.type === "CONSUME_FINALE" && !bottle) return;
    if (MOUSE_TYPES.includes(action.command.type)) setMouseOpen(true);
    returnActionId.current = action.id; submitted.current = null; setSubmittedId(null); setConfirmation({ action, bottle });
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(confirmation.action.command);
  }
  function actionButton(action: BizarroSorcererAction) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `bizarro-reason-${action.id}` : undefined}
        onClick={() => { if (locked || !action.enabled) return; if (CONFIRM_TYPES.includes(action.command.type)) openConfirmation(action); else onCommand(action.command); }}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`bizarro-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作。"}
  </p>;
  const currentResources = <section aria-label="确认前当前资源"><h4>你现在的状态</h4>
    <dl className="seer-facts">
      <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div>
      <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
    </dl>
  </section>;
  const ritualFacts = <>
    <p>{value.ritual.status}</p>
    <dl className="seer-facts">
      <div><dt>原目标</dt><dd>{value.ritual.targetName ?? "尚未实地核实"}</dd></div>
      <div><dt>实际在场见证者</dt><dd>{value.ritual.witnessesPresent} 人</dd></div>
      <div><dt>观众退场</dt><dd>{value.ritual.witnessesExited > 0 ? `${value.ritual.witnessesExited} 人已沿原退路离开，本场资格失效` : "尚无退场记录"}</dd></div>
      <div><dt>见证视线</dt><dd>{value.ritual.viewObstructed ? "原幕遮挡，不能亲见" : "没有已记录的原幕遮挡"}</dd></div>
      <div><dt>看台与退路</dt><dd>{value.ritual.unsafe ? "已记录危险，本场资格失效" : "没有已记录的危险标志"}</dd></div>
      <div><dt>实际登场</dt><dd>{value.ritual.openingComplete ? "本人幻术与真火跳跃均已实际完成" : "尚未完成两项真实登场"}</dd></div>
    </dl>
    <p>真实击杀记录：{value.ritual.killEvidence ?? "尚无玩家亲自击杀的已保存记录"}</p>
  </>;

  if (confirmation) {
    const type = confirmation.action.command.type;
    const bottle = confirmation.bottle;
    const isBottle = type === "CONSUME_FINALE" && bottle !== null;
    const isMouse = type === "COMPLETE_MOUSE_CONTROL";
    const isLoss = type === "DISMISS_MOUSE";
    const hasAssignedWorm = value.life.worms.assigned > 0;
    const title = isBottle ? bottle.title : isMouse ? "这只原鼠将真正死亡且不可逆" : isLoss
      ? hasAssignedWorm ? "确认放弃这只原秘偶及未召回的灵之虫" : "解除同一原鼠身体的控制" : "亲自迎战序列4等价超凡生物";
    const region = isBottle ? "这瓶诡法师魔药的谢幕服用确认" : isMouse ? "原鼠完整转化的不可逆死亡确认" : isLoss ? "原秘偶与灵之虫的放弃确认" : "真实危险挑战确认";
    const cancelLabel = isBottle ? "暂不服用，返回谢幕" : isMouse ? "取消，暂不完整转化" : isLoss ? "取消，保留原控制" : "暂不开战";
    const confirmLabel = isBottle ? `确认谢幕服用「${bottle.title}」` : isMouse ? "确认不可逆死亡并尝试完整转化" : isLoss
      ? hasAssignedWorm ? "确认放弃原秘偶并承担实际损失" : "确认解除控制，保留同一已死身体" : type === "START_CHALLENGE" ? "确认参加非仪式实战" : "确认开演并亲自迎战";
    return <section className="seer-panel magician-panel seer-confirmation" aria-label={region} aria-busy={busy}
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">独立确认 · 只提交这一原操作</div>
      <h3 ref={confirmationHeading} tabIndex={-1}>{title}</h3>
      {isBottle && <>
        <p>来源：{bottle.source}</p><dl className="seer-facts"><div><dt>这一原瓶</dt><dd>{bottle.id}</dd></div>
          <div><dt>原瓶状态</dt><dd>{bottle.status}</dd></div><div><dt>服药成功率</dt><dd>{bottle.chance}%</dd></div></dl>
        <section className="slice-notice seer-risk" aria-label="诡法师服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
        <section aria-label="同场真实谢幕记录"><h4>当前谢幕现场</h4>{ritualFacts}</section>
        <p className="seer-risk">确认才耗用这瓶原药，失败也不返还。本场死亡只能支持一次谢幕；服药失败后仍为序列5，须以新原瓶、新真实目标和新到场见证重筹。</p>
      </>}
      {isMouse && <section className="slice-notice seer-risk" aria-label="原鼠不可逆死亡风险">
        <p>{value.life.mouse.irreversibleWarning}</p><p>{MOUSE_STATUS[value.life.mouse.status] ?? value.life.mouse.status}</p>
        <p>原身体：{value.life.mouse.id} · 已实际控制 {value.life.mouse.elapsedSeconds} 秒。此次继续控制仍可能失败；成功后原鼠真正死亡，释放或解除控制都不能使它复活。</p>
      </section>}
      {isLoss && <section className="slice-notice seer-risk" aria-label="灵之虫实际损失风险">
        <p>{value.life.worms.risk}</p><p>已分离 {value.life.worms.split} · 实际指派 {value.life.worms.assigned} · 已召回 {value.life.worms.recalled} · 已损失 {value.life.worms.lost}</p>
      </section>}
      {!isBottle && !isMouse && !isLoss && <section className="slice-notice seer-risk" aria-label="真实战斗死亡风险">
        {ritualFacts}<p>{value.ritual.story}</p><p>{value.ritual.equipment}</p>
        <p>此兽会真实致伤和杀死你。战中撤退会消耗本轮行动且可能失败；成功逃离也保留伤势与实际消耗。可以现在不开战，继续保持当前序列。</p>
        {type === "START_CHALLENGE" && <p>这是晋升后的可选实战，不是晋升仪式，不会开启饮药谢幕。</p>}
      </section>}
      <p>本次消耗：{confirmation.action.cost}</p>{currentResources}
      {liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{cancelLabel}</button>
        <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}>{busy ? "正在结算并保存…" : confirmLabel}</button>
      </div>
      <p className="slice-muted">{isBottle ? "暂不服用只关闭确认；返回后仍可选择0行动放弃饮药并实际收场。"
        : isMouse ? "取消只关闭确认，不自动继续转化；返回后仍可实际释放活鼠。" : "取消只关闭确认，不改变原现场、资源或控制。"}</p>
      {saveNotice}
    </section>;
  }

  const acquisitionSection = visibleGrowthActions.length > 0 && !["ASSEMBLED", "FIGHTING", "FINALE"].includes(value.ritual.phase) && <details className="seer-fold" open={!hasPreparedBottle && !value.promoted} aria-label="诡法师配方与独立原料行动">
    <summary>{value.promoted ? "成长记录" : hasPreparedBottle ? "另外筹备独立原瓶" : "先准备一瓶独立魔药"}</summary>
    {batchIds.length > 1 && <label className="seer-case-selector">选择独立材料批次
      <select value={currentBatchId} disabled={locked} onChange={(event) => setBatchId(event.target.value)}>
        {batchIds.map((id) => <option key={id} value={id}>{id}</option>)}
      </select>
    </label>}
    <div className="magician-action-list">{visibleGrowthActions.map(actionButton)}</div>
  </details>;

  return <div className="seer-panel magician-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="诡法师成长下一步">
      <span className="seer-seal">{value.promoted ? "序列 4" : "诡法师晋升卷宗"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这份卷宗只供回看。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行行动，可回看已经保存的经历。"}</p>
      <p className="slice-muted">{value.digestion}</p>
      {!value.promoted && <p>独立配好原瓶 → 筹备演出与真实见证 → 亲自迎战并在谢幕服药。可选择保持序列5；和平实践不能代替真实谋杀仪式。</p>}
    </section>

    {!hasPreparedBottle && !value.promoted && acquisitionSection}

    {value.discovered && (value.formulaKnown || ritualActions.length > 0 || value.ritual.attempts > 0) && <section aria-label="赤灯谢幕与真实见证">
      <h3>{value.ritual.mode === "CHALLENGE" ? "可选实战 · 非晋升仪式" : "赤灯谢幕"}</h3>
      {value.ritual.phase === "FINALE" ? ritualFacts : <>
        <p>{value.ritual.status} · {value.ritual.targetName} · 实际在场 {value.ritual.witnessesPresent} 人</p>
        {value.ritual.killEvidence && <p>真实击杀记录：{value.ritual.killEvidence}</p>}
        <details className="seer-fold"><summary>实际登场、见证视线与退路</summary>{ritualFacts}</details>
      </>}
      {value.ritual.phase === "FINALE" && <p className="slice-notice">原兽已经真正死亡。此刻只能选择同场服用原瓶，或0行动放弃饮药并收场；离场后不能回来补喝。</p>}
      <p className="slice-muted" aria-label="开战前实际原物与资源">{value.ritual.equipment}</p>
      {value.ritual.pendingLead && <p className="slice-notice">{value.ritual.pendingLead}</p>}
      {ritualActions.length > 0 && <div className="magician-action-list" role="group" aria-label="真实筹备、到场与收场行动">{ritualActions.map(actionButton)}</div>}
      {finaleActions.length > 0 && <div className="magician-action-list" role="group" aria-label="同场0行动谢幕选择">{finaleActions.map(actionButton)}</div>}
      <details className="seer-fold"><summary>真实目标、场地限制与已保存场次</summary>
        <p>{value.ritual.story}</p><p>{value.ritual.source}</p><p>实际场次 {value.ritual.attempts} · 已耗原瓶 {value.ritual.consumedBottleId ?? "尚无"}</p>
        {value.ritual.targets.map((target) => <p key={target.id}>{target.name} · {target.site} · {target.status}</p>)}
        <p>下一地点线索仍需本人实地核实；旧死亡、原伤势和旧场次不会刷新。</p>
      </details>
    </section>}

    {value.promoted && <>
      <details className="seer-fold" aria-label="有限原鼠与实际灵之虫" open={mouseOpen} onToggle={(event) => setMouseOpen(event.currentTarget.open)}>
        <summary>{value.life.title} · 可选原鼠与灵之虫</summary><p>{MOUSE_STATUS[value.life.mouse.status] ?? value.life.mouse.status}</p>
        <dl className="seer-facts">
          <div><dt>唯一原鼠</dt><dd>{value.life.mouse.id}</dd></div>
          <div><dt>原鼠生命</dt><dd>{value.life.mouse.alive ? "仍然活着" : "真正死亡，不可逆"}</dd></div>
          <div><dt>原鼠位置</dt><dd>{POSITION[value.life.mouse.location] ?? value.life.mouse.location}</dd></div>
          <div><dt>实际控制时间</dt><dd>{value.life.mouse.elapsedSeconds} 秒</dd></div>
          <div><dt>原鼠自身灵性</dt><dd>{value.life.mouse.spirituality}</dd></div>
          <div><dt>灵之虫容量</dt><dd>{value.life.worms.capacity}</dd></div>
          <div><dt>实际分离 / 指派 / 召回 / 损失</dt><dd>{value.life.worms.split} / {value.life.worms.assigned} / {value.life.worms.recalled} / {value.life.worms.lost}</dd></div>
        </dl>
        <p className="slice-muted">容量不是现成身体或免费灵之虫。活捕与释放可以独立选择，完整转化必须另外确认原鼠的不可逆死亡。</p>
        {mouseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="原鼠与灵之虫实际行动">{mouseActions.map(actionButton)}</div>}
        <details className="seer-fold"><summary>原身体、单向赋能与损失边界</summary><p>{value.life.source}</p><p>{value.life.mouse.irreversibleWarning}</p><p>{value.life.worms.risk}</p></details>
      </details>
      {selectedCase && <section aria-label="诡法师有限实际实践">
        <h3>原火、原纸签与实际位置</h3>
        <label className="seer-case-selector">选择当前实践
          <select value={selectedCase.id} disabled={locked || value.insideCase} onChange={(event) => setCaseId(event.target.value)}>
            {value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
          </select>
        </label>
        <section className="seer-current-case" aria-label="当前诡法师实践"><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
          <p>{value.life.environment}</p>
          <dl className="seer-facts"><div><dt>本人位置</dt><dd>{POSITION[value.life.positions.owner] ?? value.life.positions.owner}</dd></div><div><dt>原鼠位置</dt><dd>{POSITION[value.life.positions.mouse] ?? value.life.positions.mouse}</dd></div>
            <div><dt>原纸签</dt><dd>{value.life.positions.tag}</dd></div><div><dt>本人携带的原物</dt><dd>{value.life.positions.ownerItem}</dd></div></dl>
          <p className="slice-muted">{selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
          {selectedCase.observations.length > 0 && <ul>{selectedCase.observations.map((text, index) => <li key={`${selectedCase.id}-${index}`}>{text}</li>)}</ul>}
          {selectedCase.preparation && <p>{selectedCase.preparation}</p>}
          {selectedCase.result && <section className="slice-notice" aria-label="诡法师实际实践结果" aria-live="polite"><h4>实际结果</h4><p>{selectedCase.result}</p></section>}
          <div className="magician-action-list" role="group" aria-label="当前诡法师实践行动">{[...selectedCaseActions, ...transitActions].map(actionButton)}</div>
          <p className="slice-muted">各次实际施术分别付费；灵性耗尽仍可按原路0行动普通返回。普通比较不会补记能力施展或掌握。</p>
        </section>
      </section>}
    </>}

    {(hasPreparedBottle || value.promoted) && acquisitionSection}
    {value.discovered && value.supplies && <p className="slice-notice" aria-label="七料实际供给与下一批来源">{value.supplies}</p>}
    {value.formulaKnown && <details className="seer-fold" aria-label="诡法师已知七料配方"><summary>查看已知诡法师配方 · {value.formula.length} 种材料</summary>
      <ul className="seer-formula">{value.formula.map((material) => <li key={material.name}><span>{material.name}</span>
        <strong>{material.quantity === null ? playerText("原著未给量") : `${material.quantity} ${material.unit}`}</strong>{material.note && <small>{material.note}</small>}</li>)}</ul>
      <p className="slice-muted">{playerText("主材未核实的原著用量保留未知，G供货份数另行标明。原料、调配、真实演出和谢幕服用各自提交；杀死仪式目标不会自动生成配方原料。")}</p>
    </details>}
    {value.discovered && value.bottles.length > 0 && <details className="seer-fold"><summary>诡法师独立原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article className="magician-history-bottle" key={bottle.id}><h4>{bottle.title}</h4>
        <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {!value.promoted && value.discovered && <details className="seer-fold"><summary>服用风险与四档结果</summary><p>{value.risk}</p></details>}
    {value.promoted && <details className="seer-fold" aria-label="诡法师能力与消化"><summary>能力与消化 · {value.abilities.length} 项掌握记录</summary>
      <p>扮演进度 {value.acting} · 消化：{value.digestion}</p>
      {value.abilities.map((ability) => <section key={ability.id}><h4>{ability.label} · 掌握 {ability.mastery}</h4><p>{ability.description}</p></section>)}
    </details>}
    {value.story && <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary><p>{value.story}</p></details>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
