import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PleasureAction, PleasureCommand, PleasureProjection } from "../domain/pleasure/types";
import type { WitchProjection } from "../domain/witch/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次现场", OBSERVED: "已核对当事人意见与原物", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，须结束本次接触", RESOLVED: "已提交本次有限报告",
};

/** The prior body change, original materials, tools and failures remain read-only S7 history. */
export function PleasureWitchHistory({ witch }: { witch: WitchProjection }) {
  return <section className="seer-panel witch-panel" aria-label="女巫时期的经历">
    <h3>女巫时期的经历</h3>
    <p className="slice-notice">这里保留女巫时期的原材料、独立原瓶、身体变化、镜片与粉末消耗、实际方法和失败，只供回看。</p>
    <p>女巫扮演进度 {witch.acting} · 消化：{witch.digestion}</p>
    {witch.story && <p>{witch.story}</p>}
    {witch.bodyChange && <p>{witch.bodyChange}</p>}
    {witch.environment && <p>{witch.environment}</p>}
    {witch.supplies && <p>{witch.supplies}</p>}
    {witch.tools && <p>{witch.tools}</p>}
    {witch.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {witch.formulaKnown && witch.formula.length > 0 && <details className="seer-fold" aria-label="女巫时期已知配方">
      <summary>女巫时期已知配方</summary>
      <ul className="seer-formula">{witch.formula.map((material) => <li key={material.name}>
        <span>{material.name}{material.note && <small>{material.note}</small>}</span>
        <strong>{material.quantity === null ? "" : `${material.quantity} `}{material.unit}</strong>
      </li>)}</ul>
    </details>}
    {witch.bottles.length > 0 && <details className="seer-fold">
      <summary>女巫原瓶 · 来源与去向</summary>
      {witch.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {witch.abilities.length > 0 && <details className="seer-fold">
      <summary>女巫时期能力记录</summary>
      {witch.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface PleasurePanelProps {
  pleasure: PleasureProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: PleasureCommand) => void;
}
function isCaseAction(action: PleasureAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: PleasureAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Only saved public facts establish consent, actual silk contact, fire damage and release. */
export function PleasurePanel({ pleasure, resources, busy, blocked = false, error = null, onCommand }: PleasurePanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = pleasure.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = pleasure.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = pleasure.actions.filter(isCaseAction);
  // A public CLOSE intent identifies the real contact. Old prose cannot imply a new connection.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (pleasure.insideCase ? pleasure.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? pleasure.cases.find((entry) => entry.id === selectedCaseId)
    ?? pleasure.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? pleasure.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!pleasure.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = pleasure.insideCase ? [] : pleasure.actions.filter(isEncounterAction);
  const growthActions = pleasure.insideCase ? [] : pleasure.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = pleasure.insideCase ? closeAction : !pleasure.promoted
    ? pleasure.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !pleasure.promoted && !pleasure.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (pleasure.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, pleasure.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || pleasure.promoted || pleasure.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, pleasure.promoted, pleasure.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: PleasureAction) {
    if (busy || interactionBlocked || pleasure.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || pleasure.promoted || pleasure.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: PleasureAction) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `pleasure-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`pleasure-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel witch-panel seer-confirmation" aria-label="这瓶欢愉魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="欢愉服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{pleasure.risk}</p>
    </section>
    {pleasure.bodyChange && <p className="slice-muted">{pleasure.bodyChange}</p>}
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{pleasure.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="pleasure-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "pleasure-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel witch-panel pleasure-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="欢愉成长下一步">
      <span className="seer-seal">{pleasure.promoted ? "序列 6" : "欢愉晋升卷宗"}</span>
      <h3>{pleasure.title}</h3>
      <p className="seer-next">{pleasure.insideCase
        ? <><strong>先实际结束本次接触：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束为0行动、0精神、0灵性；保留本次结果与消耗。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : pleasure.promoted && pleasure.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{pleasure.digestion}</p>
      {!pleasure.promoted && <p className="slice-muted">配方与实际材料可提前准备，调配独立原瓶后保留。完成女巫消化与成熟时间后，再逐瓶确认服用。准备期间仍可继续普通生活。</p>}
    </section>
    {pleasure.promoted && pleasure.environment && <section aria-label="当前欢愉现场"><h4>当前现场</h4><p>{pleasure.environment}</p></section>}
    {selectedCase && <section aria-label="欢愉有限实践">
      <h3>丝线、邀请与实际停止</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || pleasure.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {pleasure.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前欢愉实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原拒绝记录"><h4>公开观察与原拒绝记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。请先核对当事人的意愿、原物与停止边界。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前取得同意、建立丝线接触或切断原丝。"}</p>
        </section>
        {pleasure.promoted && <section className="seer-fold" aria-label="已保存的接触与原丝记录">
          <h4>已保存的接触与原丝记录</h4>
          {selectedCase.id === "silk-release" && <>
            <p>{pleasure.practice.wristConsent ? "已记录当事人对本次腕部练习的自愿同意。" : "尚无当事人对本次腕部练习的同意记录。"}</p>
            <p>当前腕部：{pleasure.practice.wrist === "SILK" ? "实际丝线接触仍在" : pleasure.practice.wrist === "CORD" ? "实际普通绳圈仍在" : "已无丝线或绳圈接触"}</p>
          </>}
          {selectedCase.id === "refused-invitation" && <>
            <p>{pleasure.practice.invitationWilling ? "已记录当事人对本次邀请的实际意愿。" : "当事人当前未同意本次邀请。"}</p>
            <p className="slice-muted">受影响不等于同意。原拒绝保留，魅惑不能替对方接受邀请。</p>
          </>}
          {selectedCase.id === "fire-break" && <>
            <p>同一原丝：{pleasure.practice.fireSilk === "ON_FRAME" ? "已实际架在练习框上" : pleasure.practice.fireSilk === "BROKEN" ? "已实际断开，断丝仍待清理" : pleasure.practice.fireSilk === "CLEARED" ? "已实际清理" : "尚未实际建立"}</p>
            <p>实际断开方式：{pleasure.practice.fireBreak === "BLACK_FLAME" ? "黑焰" : pleasure.practice.fireBreak === "SCISSORS" ? "普通剪刀" : "尚无实际断开记录"}</p>
          </>}
        </section>}
        {selectedCase.result && <section className="slice-notice" aria-label="欢愉实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前欢愉实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {pleasure.insideCase && <p className="slice-muted">须实际解除接触并结束现场后再报告。结束不另抽随机、不奖励、不退款、不治疗，也不抹去原拒绝或原失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="欢愉成长行动">{growthActions.map(actionButton)}</div>}
    {pleasure.story && <details className="seer-fold"><summary>{playerText("成品来源与使用说明")}</summary><p>{pleasure.story}</p></details>}
    {encounterActions.length > 0 && <section aria-label="欢愉有限冲突">
      <h3>有限现场冲突</h3><p className="slice-muted">按当前公开选项交涉或承担真实战斗风险。能力会遭抵抗，练习结果不保证战斗胜利。</p>
      <div className="magician-action-list" role="group" aria-label="欢愉冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {pleasure.discovered && pleasure.supplies && <section className="slice-notice" aria-label="欢愉实际材料与批次">
      <h4>实际材料与独立批次</h4><p>{pleasure.supplies}</p>
    </section>}
    {pleasure.formulaKnown && pleasure.formula.length > 0 && <details className="seer-fold" aria-label="欢愉已知配方">
      <summary>查看已知欢愉配方 · {pleasure.formula.length} 种材料</summary>
      <ul className="seer-formula">{pleasure.formula.map((material) => <li key={material.name}>
        <span>{material.name}{material.note && <small>{material.note}</small>}</span>
        <strong>{material.quantity === null ? "" : `${material.quantity} `}{material.unit}</strong>
      </li>)}</ul>
      <p className="slice-muted">材料清单不等于投料顺序。取得七项实际原料、调配独立原瓶与确认服用分别进行；女妖的全部残留毛发按原物一份记录，不换算成未知克重。</p>
    </details>}
    {pleasure.discovered && pleasure.bottles.length > 0 && <details className="seer-fold" open={!pleasure.promoted}>
      <summary>欢愉独立调配原瓶 · 来源与去向</summary>
      {pleasure.bottles.map((bottle) => {
        const action = pleasure.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !pleasure.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !pleasure.promoted && !pleasure.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `pleasure-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`pleasure-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {pleasure.discovered && !pleasure.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{pleasure.risk}</p></details>}
    {pleasure.promoted && <section aria-label="欢愉能力与消化">
      <h3>能力与消化 · {pleasure.abilities.length} 项训练记录</h3>
      <p>扮演进度 {pleasure.acting} · 消化：{pleasure.digestion}</p>
      <progress className="cryptologist-progress" aria-label="欢愉扮演进度" value={pleasure.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {pleasure.pollution}</p>
      {pleasure.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="欢愉实践边界">
        <summary>查看自愿实践与能力边界</summary>
        <p>练习只面向成年人，须有本人的自愿同意并可实际停止。魅惑不是绝对服从，原拒绝不能被魅惑改写。</p>
        <p>{playerText("这三项自愿社交与丝线实践、普通方法以及和平消化100是本作原创G替代路线，不宣称等同原著亲密扮演。")}</p>
        <p>丝线须实际建立接触，也可能被火焰或干扰破坏。本阶段不提供序列5的疾病能力。</p>
        {pleasure.bodyChange && <p>{pleasure.bodyChange}</p>}
      </details>
    </section>}
    {pleasure.promoted && pleasure.inheritedTools && <details className="seer-fold"><summary>继承的女巫工具与消耗</summary><p>{pleasure.inheritedTools}</p></details>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
