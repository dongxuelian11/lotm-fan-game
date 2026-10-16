import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DawnPaladinAction, DawnPaladinCommand, DawnPaladinProjection } from "../domain/dawn-paladin/types";
import type { WeaponmasterProjection } from "../domain/weaponmaster/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已核对原物与边界", PREPARED: "已准备待执行方法",
  EXAMINED: "已有实际结果，待离场与复核", RESOLVED: "已提交本次有限报告",
};

/** Previous tools, observations and consumed originals are history, never repeatable S6 rewards. */
export function DawnPaladinWeaponmasterHistory({ weaponmaster }: { weaponmaster: WeaponmasterProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="武器大师时期的经历">
    <h3>武器大师时期的经历</h3>
    <p className="slice-notice">你已晋升黎明骑士。这里保留武器大师时期的原工具、借还、练习、失败、报告与原瓶，只供回看。</p>
    <p>武器大师扮演进度 {weaponmaster.acting} · 消化：{weaponmaster.digestion}</p>
    {weaponmaster.story && <p>{weaponmaster.story}</p>}
    {weaponmaster.environment && <p>{weaponmaster.environment}</p>}
    {weaponmaster.supplies && <p>{weaponmaster.supplies}</p>}
    {weaponmaster.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      {entry.result && <p>当时的实际练习与报告：{entry.result}</p>}
    </details>)}
    {weaponmaster.bottles.length > 0 && <details className="seer-fold">
      <summary>武器大师原瓶 · 来源与去向</summary>
      {weaponmaster.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {weaponmaster.abilities.length > 0 && <details className="seer-fold">
      <summary>武器大师时期能力记录</summary>
      {weaponmaster.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface DawnPaladinPanelProps {
  dawnPaladin: DawnPaladinProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DawnPaladinCommand) => void;
}
function isCaseAction(action: DawnPaladinAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: DawnPaladinAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Only committed public facts can dispel an illusion, crack armor or change the original target. */
export function DawnPaladinPanel({ dawnPaladin, resources, busy, blocked = false, error = null, onCommand }: DawnPaladinPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = dawnPaladin.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = dawnPaladin.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = dawnPaladin.actions.filter(isCaseAction);
  // A public CLOSE intent identifies the open scene; historical prose cannot lock navigation.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (dawnPaladin.insideCase ? dawnPaladin.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? dawnPaladin.cases.find((entry) => entry.id === selectedCaseId)
    ?? dawnPaladin.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? dawnPaladin.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!dawnPaladin.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = dawnPaladin.insideCase ? [] : dawnPaladin.actions.filter(isEncounterAction);
  const growthActions = dawnPaladin.insideCase ? [] : dawnPaladin.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = dawnPaladin.insideCase ? closeAction : !dawnPaladin.promoted
    ? dawnPaladin.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !dawnPaladin.promoted && !dawnPaladin.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (dawnPaladin.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, dawnPaladin.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || dawnPaladin.promoted || dawnPaladin.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, dawnPaladin.promoted, dawnPaladin.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: DawnPaladinAction) {
    if (busy || interactionBlocked || dawnPaladin.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || dawnPaladin.promoted || dawnPaladin.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: DawnPaladinAction) {
    return <div className="seer-action cryptologist-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `dawn-paladin-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`dawn-paladin-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel cryptologist-panel warrior-panel seer-confirmation" aria-label="这瓶黎明骑士魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); } }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="黎明骑士服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{dawnPaladin.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{dawnPaladin.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="dawn-paladin-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "dawn-paladin-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel cryptologist-panel warrior-panel dawn-paladin-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="黎明骑士成长下一步">
      <span className="seer-seal">{dawnPaladin.promoted ? "序列 6" : "黎明骑士晋升卷宗"}</span>
      <h3>{dawnPaladin.title}</h3>
      <p className="seer-next">{dawnPaladin.insideCase
        ? <><strong>先实际结束本次实践：</strong>{nextAction?.label || "查看当前公开结束选项"}。离场为0行动、0精神、0灵性；保留本次结果与消耗。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : dawnPaladin.promoted && dawnPaladin.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{dawnPaladin.digestion}</p>
      {!dawnPaladin.promoted && <p className="slice-muted">先完成武器大师消化与成熟时间，再听取指导、逐瓶筹措成品并独立确认服用。准备期间仍可继续普通生活。</p>}
      {!dawnPaladin.promoted && <p className="slice-muted">{playerText("完整配方、材料与剂量尚未核实；指导只说明有来源的独立成品原瓶，不开放材料采购或调配。")}</p>}
    </section>
    {dawnPaladin.promoted && <section className="slice-notice" aria-label="黎明骑士能力边界">
      <h4>晨曦实践</h4>
      <p>晨曦之光尝试破除适用低位幻象；晨曦铠甲会被击破。晨曦武器与光之风暴有实际消耗，风暴可能波及人或原物，清场也不保证无害。</p>
      <p className="slice-muted">{playerText("三项原创G实践保留普通方法。序列5守护者的代挡与分担伤害尚未开放。")}</p>
    </section>}
    {dawnPaladin.promoted && dawnPaladin.environment && <section aria-label="当前黎明骑士现场">
      <h4>当前现场</h4><p>{dawnPaladin.environment}</p>
    </section>}
    {selectedCase && <section aria-label="黎明骑士有限实践">
      <h3>原标记、铠甲试验与清场风暴</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || dawnPaladin.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {dawnPaladin.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前黎明骑士实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        {(dawnPaladin.practice.swordActive || dawnPaladin.practice.armorActive) && <p className="slice-notice" role="status">
          本次仍在持续：{[dawnPaladin.practice.swordActive && "晨曦武器", dawnPaladin.practice.armorActive && "晨曦铠甲"].filter(Boolean).join("、")}。须实际收束后离场。
        </p>}
        <section aria-label="公开观察与原失败记录"><h4>公开观察与原失败记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次现场观察，请先核对原物、退路与停止边界。</p>}
        </section>
        <section aria-label="有限实践与准备"><h4>有限实践与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择准备不会提前破幻、完成试验或改变原靶。"}</p>
        </section>
        {dawnPaladin.promoted && <section className="seer-fold" aria-label="已保存的原物实践记录">
          <h4>已保存的原物实践记录</h4>
          {selectedCase.id === "marked-exit" && <>
            <p>{dawnPaladin.practice.illusionCreated ? "教学低位幻象已实际建立。" : "教学低位幻象尚未实际建立。"} 原教学施术者灵性：{dawnPaladin.practice.volunteerSpirituality}</p>
            <p>{dawnPaladin.practice.illusionDispelled ? "已实际破除这一教学幻象。" : "尚无实际破除记录。"}{dawnPaladin.practice.screenRemoved ? "原遮屏已实际移开。" : "原遮屏未记录移开。"}</p>
          </>}
          {selectedCase.id === "armor-test" && <p>{dawnPaladin.practice.armorProbePerformed ? "已实际进行本次铠甲试探。" : "尚未实际进行铠甲试探。"}{dawnPaladin.practice.armorCracked ? "试探留下了铠甲裂纹记录。" : "尚无本次铠甲裂纹记录。"}</p>}
          {selectedCase.id === "cleared-storm" && <>
            <p>{dawnPaladin.practice.stormCleared ? "本次练习场已实际清场。" : "尚无本次实际清场记录。"}{dawnPaladin.practice.instructorOutside ? "导师当前在场外等候。" : "导师当前未在场外等候。"}</p>
            <p>同一练习原靶：{dawnPaladin.practice.stormTarget === "DESTROYED" ? "已被实际风暴毁坏" : dawnPaladin.practice.stormTarget === "DISMANTLED" ? "已由普通方法实际拆卸" : "仍完整"}</p>
            {dawnPaladin.practice.stormFrameScorched && <p>原靶框留下了风暴灼损。</p>}
            {dawnPaladin.practice.stormSwordDispersed && <p>本次风暴后晨曦武器已消散。</p>}
            {dawnPaladin.practice.stormArmorCracked && <p>本次风暴留下了铠甲裂纹记录。</p>}
          </>}
        </section>}
        {selectedCase.result && <section className="slice-notice" aria-label="有限实践与实际结果" aria-live="polite" aria-atomic="true">
          <h4>有限实践与实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="cryptologist-action-list" role="group" aria-label="当前黎明骑士实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {dawnPaladin.insideCase && <p className="slice-muted">须实际结束能力并离场后再报告。离场不另抽随机、不奖励、不退款、不治疗，也不修复原靶或抹去失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="cryptologist-action-list" role="group" aria-label="黎明骑士成长行动">{growthActions.map(actionButton)}</div>}
    {dawnPaladin.story && <p className="slice-muted">{dawnPaladin.story}</p>}
    {encounterActions.length > 0 && <section aria-label="有限现场冲突">
      <h3>罗尔德与他的原短棍</h3>
      <p className="slice-muted">罗尔德是普通人，手持自己的原短棍。按公开选项交涉或承担真实战斗风险；能力不保证胜利。</p>
      <div className="cryptologist-action-list" role="group" aria-label="现场冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {dawnPaladin.discovered && dawnPaladin.supplies && <section className="slice-notice" aria-label="黎明骑士成品原瓶供给">
      <h4>成品原瓶与实际供给</h4><p>{dawnPaladin.supplies}</p>
    </section>}
    {dawnPaladin.discovered && dawnPaladin.bottles.length > 0 && <details className="seer-fold" open={!dawnPaladin.promoted}>
      <summary>黎明骑士独立成品原瓶 · 来源与去向</summary>
      {dawnPaladin.bottles.map((bottle) => {
        const action = dawnPaladin.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !dawnPaladin.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !dawnPaladin.promoted && !dawnPaladin.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `dawn-paladin-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`dawn-paladin-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {dawnPaladin.discovered && !dawnPaladin.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{dawnPaladin.risk}</p></details>}
    {dawnPaladin.promoted && <section aria-label="黎明骑士能力与消化">
      <h3>能力与消化 · {dawnPaladin.abilities.length} 项训练记录</h3>
      <p>扮演进度 {dawnPaladin.acting} · 消化：{dawnPaladin.digestion}</p>
      <progress className="cryptologist-progress" aria-label="黎明骑士扮演进度" value={dawnPaladin.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {dawnPaladin.pollution}</p>
      {dawnPaladin.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
