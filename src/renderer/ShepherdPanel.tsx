import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ShepherdAction, ShepherdCommand, ShepherdProjection } from "../domain/shepherd/types";
import type { RoseBishopProjection } from "../domain/rose-bishop/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已有公开观察", PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告", RESOLVED: "已提交有限报告",
};
const SPIRIT_STATUS: Record<string, string> = {
  AVAILABLE: "已会面，尚未放牧", GRAZED: "已实际放牧", RELEASED: "已永久释放，不能重新取得",
};

/** S6 history remains read-only; current inherited packet controls belong to the S5 panel. */
export function ShepherdRoseBishopHistory({ roseBishop, currentTitle="牧羊人（序列5）" }: { roseBishop: RoseBishopProjection; currentTitle?:string }) {
  return <section className="seer-panel warrior-panel" aria-label="蔷薇主教时期的经历">
    <h3>蔷薇主教时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留蔷薇主教时期的原故事、实际供给包、储备、失败、原瓶与旧实践，只供回看。购买与取用同一供给渠道的原包，请使用当前成长页。</p>
    <p>蔷薇主教扮演进度 {roseBishop.acting} · 消化：{roseBishop.digestion}</p>
    {roseBishop.story && <p>{roseBishop.story}</p>}
    {roseBishop.environment && <p>{roseBishop.environment}</p>}
    {roseBishop.supplies && <p>{roseBishop.supplies}</p>}
    {roseBishop.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold" aria-label="原血肉储备与供给包记录">
      <summary>继承储备与原供给包的当前去向</summary>
      <p>血肉储备 {roseBishop.reserve.points} / {roseBishop.reserve.max}</p><p>{roseBishop.reserve.summary}</p>
      {roseBishop.reserve.packets.map((packet) => <article key={packet.id}>
        <p>原包ID：{packet.id} · {packet.status === "HELD" ? "实际持有" : "已实际耗用"}</p>
        <p>取得周：{packet.acquiredWeek} · {packet.consumedWeek === null ? "尚未取用" : `耗用周：${packet.consumedWeek}`}</p>
      </article>)}
    </details>
    {roseBishop.bottles.length > 0 && <details className="seer-fold">
      <summary>蔷薇主教原瓶 · 来源与去向</summary>
      {roseBishop.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {roseBishop.abilities.length > 0 && <details className="seer-fold">
      <summary>蔷薇主教原能力记录</summary>
      {roseBishop.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">旧实践不重新结算或发奖，原失败与消耗不改写；晋升不补供给包或储备，也不重置旧能力掌握。</p>
  </section>;
}

export interface ShepherdPanelProps {
  shepherd: ShepherdProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ShepherdCommand) => void;
}
function isCaseAction(action: ShepherdAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: ShepherdAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function isRationAction(action: ShepherdAction): boolean {
  return action.command.type === "BUY_RATION" || action.command.type === "TAKE_RATION";
}
function isSpiritAction(action: ShepherdAction): boolean {
  return action.command.type === "MEET_SPIRITS" || action.command.type === "GRAZE"
    || action.command.type === "ACTIVATE_SPIRIT" || action.command.type === "RELEASE_SPIRIT";
}

/** Only committed public state is shown; confirmation submits the projected original intent once. */
export function ShepherdPanel({ shepherd, resources, busy, blocked = false, error = null, onCommand }: ShepherdPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);
  const submitted = useRef<ShepherdCommand | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnKey = useRef<string | null>(null);
  const confirmationButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const grazing = shepherd.grazing;
  const spirits = shepherd.promoted && grazing?.met ? grazing.spirits.filter((spirit) => spirit.status !== "UNMET") : [];
  const reserve = shepherd.reserve;
  const selectedBottle = shepherd.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = shepherd.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const selectedRelease = spirits.find((spirit) => spirit.id === selectedReleaseId && spirit.status === "GRAZED");
  const selectedReleaseAction = shepherd.actions.find((action) => action.command.type === "RELEASE_SPIRIT" && action.command.spiritId === selectedReleaseId);
  const caseActions = shepherd.actions.filter(isCaseAction);
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (shepherd.insideCase ? shepherd.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? shepherd.cases.find((entry) => entry.id === selectedCaseId)
    ?? shepherd.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? shepherd.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!shepherd.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = shepherd.insideCase ? [] : shepherd.actions.filter(isEncounterAction);
  const growthActions = shepherd.insideCase ? [] : shepherd.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action) && !isRationAction(action) && !isSpiritAction(action));
  const rationActions = shepherd.promoted && reserve && !shepherd.insideCase ? shepherd.actions.filter(isRationAction).filter((action) => {
    const command = action.command;
    return command.type !== "TAKE_RATION" || reserve.packets.some((packet) => packet.id === command.packetId && packet.status === "HELD");
  }) : [];
  const spiritActions = shepherd.promoted && !shepherd.insideCase ? shepherd.actions.filter(isSpiritAction).filter((action) => {
    const command = action.command;
    if (command.type === "MEET_SPIRITS") return !grazing?.met;
    if (!grazing?.met) return false;
    if (command.type === "ACTIVATE_SPIRIT" && command.spiritId === null) return true;
    if (command.type === "GRAZE" || command.type === "ACTIVATE_SPIRIT" || command.type === "RELEASE_SPIRIT") {
      return spirits.some((spirit) => spirit.id === command.spiritId && spirit.status === (command.type === "GRAZE" ? "AVAILABLE" : "GRAZED"));
    }
    return false;
  }) : [];
  const nextAction = shepherd.insideCase ? closeAction : !shepherd.promoted
    ? shepherd.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && action.command.type !== "WITHDRAW")
      ?? selectedCaseActions.find((action) => action.enabled)
      ?? spiritActions.find((action) => action.enabled && action.command.type !== "RELEASE_SPIRIT")
      ?? rationActions.find((action) => action.enabled) ?? growthActions.find((action) => action.enabled)
      ?? encounterActions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? growthActions[0];
  const confirmingBottle = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !shepherd.promoted && !shepherd.insideCase;
  const confirmingRelease = !!selectedRelease && selectedReleaseAction?.command.type === "RELEASE_SPIRIT" && shepherd.promoted && !shepherd.insideCase;
  const confirming = confirmingBottle || confirmingRelease;
  const confirmationLocked = busy || interactionBlocked || submittedKey !== null;

  useEffect(() => {
    if (selectedCase && (shepherd.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, shepherd.insideCase]);
  useEffect(() => {
    if (selectedBottleId && !confirmingBottle) { setSelectedBottleId(null); setSubmittedKey(null); submitted.current = null; }
    if (selectedReleaseId && !confirmingRelease) { setSelectedReleaseId(null); setSubmittedKey(null); submitted.current = null; }
  }, [selectedBottleId, selectedReleaseId, confirmingBottle, confirmingRelease]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnKey.current) confirmationButtons.current.get(returnKey.current)?.focus();
  }, [confirming, selectedBottleId, selectedReleaseId]);

  function openConfirmation(action: ShepherdAction) {
    if (busy || interactionBlocked || shepherd.insideCase || !action.enabled) return;
    const command = action.command;
    if (command.type === "CONSUME" && !shepherd.promoted) {
      returnKey.current = `bottle:${command.bottleId}`;
      setSelectedReleaseId(null); setSelectedBottleId(command.bottleId);
    } else if (command.type === "RELEASE_SPIRIT" && shepherd.promoted
      && spirits.some((spirit) => spirit.id === command.spiritId && spirit.status === "GRAZED")) {
      returnKey.current = `release:${command.spiritId}`;
      setSelectedBottleId(null); setSelectedReleaseId(command.spiritId);
    } else return;
    submitted.current = null; setSubmittedKey(null);
  }
  function cancelConfirmation() {
    if (confirmationLocked) return;
    setSelectedBottleId(null); setSelectedReleaseId(null);
  }
  function confirm(action: ShepherdAction | undefined) {
    if (confirmationLocked || submitted.current !== null || !action?.enabled || !confirming) return;
    submitted.current = action.command; setSubmittedKey(action.id);
    onCommand(action.command);
  }
  function actionButton(action: ShepherdAction) {
    const key = action.command.type === "RELEASE_SPIRIT" ? `release:${action.command.spiritId}` : null;
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        ref={(node) => { if (key) { if (node) confirmationButtons.current.set(key, node); else confirmationButtons.current.delete(key); } }}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if (action.command.type === "CONSUME" || action.command.type === "RELEASE_SPIRIT") { openConfirmation(action); return; }
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `shepherd-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`shepherd-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作，重试同一原意图。"}
  </p>;
  const confirmationKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.stopPropagation(); cancelConfirmation(); }
  };

  if (confirmingRelease && selectedRelease && selectedReleaseAction) return <section
    className="seer-panel warrior-panel shepherd-panel seer-confirmation" aria-label="永久释放这一灵魂的独立确认" aria-busy={busy}
    onKeyDown={confirmationKeys}>
    <div className="slice-eyebrow">永久释放前，请单独确认</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>释放「{selectedRelease.name}」</h3>
    <p>原灵魂ID：{selectedRelease.id}</p><p>来源：{selectedRelease.source}</p>
    <p className="slice-notice seer-risk">确认后永久失去这一灵魂及其已选能力的使用权。当前渠道不会再次提供这一原灵魂，不能撤销、重新取得或换回；这不是复活，也不会补发另一灵魂或退还此前消耗。</p>
    <p>当前已选能力：{selectedRelease.selectedAbilities.map((id) => selectedRelease.knownAbilities.find((ability) => ability.id === id)?.label ?? id).join("、") || "无"}</p>
    <p>{grazing?.activeSpiritId === selectedRelease.id ? "这一灵魂正在驱使；确认释放后同时停止驱使。" : "这一灵魂当前未被驱使。"}</p>
    <p>本次成本：{selectedReleaseAction.cost}</p>
    {selectedReleaseAction.reason && <p id="shepherd-release-reason" className="seer-action-reason">{selectedReleaseAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={cancelConfirmation}>保留这一灵魂</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedReleaseAction.enabled} onClick={() => confirm(selectedReleaseAction)}
        aria-describedby={selectedReleaseAction.reason ? "shepherd-release-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认永久释放「${selectedRelease.name}」`}
      </button>
    </div>
    <p className="slice-muted">取消不释放、不消耗。保存失败保留这次独立确认，等待外层重试同一原操作；不会改换目标或再次提交释放。</p>
    {saveNotice}
  </section>;

  if (confirmingBottle && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel shepherd-panel seer-confirmation" aria-label="这瓶牧羊人魔药的服用确认" aria-busy={busy}
    onKeyDown={confirmationKeys}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方与晋升仪式细节仍待核实；本次只确认本作原创G导师准备与指导流程中的这一成品原瓶，不表示无需仪式。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div><div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div><div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="牧羊人服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{shepherd.risk}</p></section>
    <section className="seer-current-resources" aria-label="服药前当前资源"><h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{shepherd.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p id="shepherd-confirm-reason" className="seer-action-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={cancelConfirmation}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={() => confirm(selectedBottleAction)}
        aria-describedby={selectedBottleAction.reason ? "shepherd-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted">确认才服用这一独立原瓶。取消不消耗；保存失败保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel shepherd-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="牧羊人成长下一步">
      <span className="seer-seal">{shepherd.promoted ? "牧羊人5" : "蔷薇主教6 → 牧羊人5"}</span><h3>{shepherd.title}</h3>
      {shepherd.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : shepherd.insideCase ? "请查看当前公开的结束实践选项。" : shepherd.promoted && shepherd.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{shepherd.digestion}</p>
      {shepherd.discovered && !shepherd.promoted && <p className="slice-muted">用药指导：{shepherd.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得与逐瓶确认分别进行；费用与成熟条件以公开记录为准。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与晋升仪式细节尚未核实，不能据此断言无需仪式。本阶段采用本作原创G独立成品渠道、导师准备与指导服药流程。")}</p>
    </section>
    {shepherd.promoted && shepherd.environment && <section aria-label="当前牧羊人现场"><h4>当前现场</h4><p>{shepherd.environment}</p></section>}
    {shepherd.promoted && grazing && <section className="slice-notice" aria-label="放牧名册与当前驱使">
      <h3>实际灵魂名册 · 已放牧 {spirits.filter((spirit) => spirit.status === "GRAZED").length} / {grazing.capacity}</h3>
      <p>{grazing.summary}</p>
      <p className="slice-muted">容量上限7灵，每灵最多选3项其实际掌握的能力；同时只驱使1灵，并可使用自己的能力。切换本身0行动、0灵性，借用能力仍由本人支付灵性；晋升不会填满名册或取得完整技能库。</p>
      <p aria-live="polite">当前驱使：{spirits.find((spirit) => spirit.id === grazing.activeSpiritId && spirit.status === "GRAZED")?.name ?? "无，仅使用自身能力"}</p>
      {!grazing.met && <p className="slice-muted">尚未实际会面；原灵魂身份、来源与具体可选能力保持未知。</p>}
      {spiritActions.filter((action) => action.command.type === "MEET_SPIRITS" || action.command.type === "ACTIVATE_SPIRIT" && action.command.spiritId === null).map(actionButton)}
      {spirits.map((spirit) => <article className="warrior-history-bottle" key={spirit.id} aria-label={`原灵魂 ${spirit.id}`}>
        <h4>{spirit.name} · {SPIRIT_STATUS[spirit.status] ?? "状态待核实"}</h4>
        <p className="slice-muted">原灵魂ID：{spirit.id}</p><p>来源：{spirit.source}</p>
        <p>{spirit.status === "GRAZED" && grazing.activeSpiritId === spirit.id ? "正在驱使这一灵魂" : spirit.status === "GRAZED" ? "已放牧，当前未驱使" : SPIRIT_STATUS[spirit.status]}</p>
        <p>已选能力 {spirit.selectedAbilities.length} / 3：{spirit.selectedAbilities.map((id) => spirit.knownAbilities.find((ability) => ability.id === id)?.label ?? id).join("、") || "尚未选择"}</p>
        <details className="seer-fold"><summary>这一原灵魂的实际已知能力与记录</summary>
          {spirit.knownAbilities.map((ability) => <p key={ability.id}>{ability.label}：{ability.description}</p>)}
          <p>最近尝试：{spirit.attemptWeek === null ? "尚未尝试" : `第${spirit.attemptWeek}周`} · 取得：{spirit.acquiredWeek === null ? "尚未取得" : `第${spirit.acquiredWeek}周`} · 释放：{spirit.releasedWeek === null ? "尚未释放" : `第${spirit.releasedWeek}周`}</p>
        </details>
        {spirit.status === "RELEASED" && <p className="slice-muted">只保留历史选择，已失去这一灵魂及其能力的使用权；不能从当前来源重新取得。</p>}
        {spiritActions.filter((action) => "spiritId" in action.command && action.command.spiritId === spirit.id).map(actionButton)}
      </article>)}
    </section>}
    {shepherd.promoted && shepherd.practice && <section className="slice-notice" aria-label="已保存的牧羊人实践与实际原物" aria-live="polite" aria-atomic="true">
      <h3>原纸、实际声音、原记录与本人位置</h3>
      <dl className="seer-facts">
        <div><dt>同一原纸</dt><dd>{shepherd.practice.paper}</dd></div><div><dt>实际歌声</dt><dd>{shepherd.practice.chorus}</dd></div>
        <div><dt>同一原记录</dt><dd>{shepherd.practice.note}</dd></div><div><dt>本人位置</dt><dd>{shepherd.practice.position}</dd></div>
      </dl>
      <p className="slice-muted">准备只记录方法。实际失败后仍须收束已经发生的声音、步行或书写；结束不退还消耗，也不制造副本或抹去记录。</p>
      {shepherd.practice.history.length > 0 && <details className="seer-fold"><summary>实际动作与失败记录</summary><ul>{shepherd.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
    </section>}
    {shepherd.promoted && reserve && <section className="slice-notice" aria-label="继承血肉储备与实际供给包">
      <h3>血肉储备 {reserve.points} / {reserve.max}</h3><p>{reserve.summary}</p>
      <p>已购供给包 {reserve.packetsBought} 份 · 最近购买：{reserve.lastPurchaseWeek === null ? "尚未购买" : `第${reserve.lastPurchaseWeek}周`}</p>
      <p className="slice-muted">继续使用原蔷薇主教补给渠道与实际储备，每周购买上限和取用成本保持；晋升不补包、不自动进食、不直接治疗。</p>
      {rationActions.filter((action) => action.command.type === "BUY_RATION").map(actionButton)}
      {reserve.packets.length === 0 ? <p className="slice-muted">尚无实际购买的供给原包。</p> : reserve.packets.map((packet) => <article className="warrior-history-bottle" key={packet.id}>
        <h4>供给原包 {packet.id}</h4><p>取得周：{packet.acquiredWeek}</p>
        <p>{packet.status === "HELD" ? "实际持有 · 尚未取用" : `已实际耗用 · 耗用周：${packet.consumedWeek ?? "待核实"}`}</p>
        {rationActions.filter((action) => action.command.type === "TAKE_RATION" && action.command.packetId === packet.id).map(actionButton)}
      </article>)}
    </section>}
    {selectedCase && <section aria-label="牧羊人有限实践">
      <h3>原物牵引、自愿歌声与有限记录</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || shepherd.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {shepherd.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前牧羊人实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察，请先核对现场、原物、参与者与停止边界。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4><p>{selectedCase.preparation || "当前没有待执行的实践；准备不会提前移动原纸、唱出声音、书写记录或改变本人位置。"}</p></section>
        {selectedCase.result && <section className="slice-notice" aria-label="牧羊人实际结果" aria-live="polite" aria-atomic="true"><h4>本次实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前牧羊人实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {shepherd.insideCase && <p className="slice-muted">先用0行动、0精神、0灵性的结束选项实际收束，再继续生活：必要时步行到原标记取回同一纸张并走回原桌，停止本人歌声与反馈，或将这一原记录交给原导师。最后行动耗尽仍可结束；不传送、不退款、不复制原物。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="牧羊人成长行动">{growthActions.map(actionButton)}</div>}
    {shepherd.promoted && encounterActions.length > 0 && <section aria-label="牧羊人有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">成年门廊看守埃尔顿持自己的普通短棍，双方相距两米，白昼庭院内原出口清楚，无旁人且对方不追击。战斗有真实伤势与死亡风险；死亡不会自动给玩家捕获新灵魂。</p>
      <p className="slice-muted">每轮只驱使当前选中的一灵，仅可借用它实际已选的能力。仍可使用本人的旧能力；体内灵魂不会另获独立身体。切换不增加等待时长，也不返还此前消耗。</p>
      <div className="warrior-action-list" role="group" aria-label="牧羊人冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {shepherd.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{shepherd.story}</p></details>}
    {shepherd.discovered && shepherd.supplies && <section className="slice-notice" aria-label="牧羊人成品来源与取得"><h4>实际供给与独立原瓶</h4><p>{shepherd.supplies}</p></section>}
    {shepherd.discovered && shepherd.bottles.length > 0 && <details className="seer-fold" open={!shepherd.promoted}>
      <summary>牧羊人独立成品原瓶 · 来源与去向</summary>
      {shepherd.bottles.map((bottle) => {
        const action = shepherd.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !shepherd.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !shepherd.promoted && !shepherd.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openConfirmation(action)}
              ref={(node) => { if (node) confirmationButtons.current.set(`bottle:${bottle.id}`, node); else confirmationButtons.current.delete(`bottle:${bottle.id}`); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `shepherd-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>{action.reason && <p id={`shepherd-bottle-${bottle.id}`} className="seer-action-reason">{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {shepherd.discovered && !shepherd.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{shepherd.risk}</p></details>}
    {shepherd.promoted && <section aria-label="牧羊人能力与消化">
      <h3>能力与消化 · {shepherd.abilities.length} 项训练记录</h3><p>扮演进度 {shepherd.acting} · 消化：{shepherd.digestion}</p>
      <progress className="cryptologist-progress" aria-label="牧羊人扮演进度" value={shepherd.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {shepherd.pollution}</p>
      {shepherd.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <details className="seer-fold" aria-label="牧羊人能力与实践边界"><summary>查看放牧与有限实践边界</summary>
        <p>放牧有实际来源的灵魂，最多7灵、每灵最多3项已选能力，一次只驱使1灵。永久释放不保留可用技能，也不把借用能力永久复制给本人。没有晋升赠送的七灵或完整职业技能库。</p>
        <p>{playerText("本作原创G只使用已经存在、在故事开始前已死亡的有限灵魂来源。具体身份与能力须实际会面后才公开；此渠道的有限约定不代表一切放牧的通用原著条件，不要求伤害活人。")}</p>
        <p>三项报告各25、回顾25，可用普通方法和平消化100。只有实际成功的能力实践报告才按规则训练已有知识池；有限记录只写已观察事实，不能变成新法术、读心、强迫信仰或意志控制。</p>
        <p>{playerText("完整配方与晋升仪式尚未核实。序列4黑骑士的灵肉之刃和统御阴影尚未开放。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
