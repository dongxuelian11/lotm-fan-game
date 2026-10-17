import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { CorruptionBaronAction, CorruptionBaronCommand, CorruptionBaronProjection } from "../domain/corruption-baron/types";
import type { BriberProjection } from "../domain/briber/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次现场", OBSERVED: "已有普通观察与现场边界", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，请核对退出与现实证据", RESOLVED: "已退出并提交本次有限报告",
};
const CLAUSE_LABELS = { ORIGINAL: "原核册次序仍在", PENDING: "正在按原安排核查，尚未收束", ADJUSTED: "两份原册的核查先后已临时调整，尚未恢复", RESTORED: "原核册次序已实际恢复" } as const;
const MARKER_LABELS = { CRADLED: "同一原木球仍在原托槽中", ROLLING: "同一原木球正在滚动，尚未收停", SIDE_POCKET: "同一原木球已偏入原侧袋，尚未收回", STOPPED: "同一原木球已实际收停" } as const;
const ROUTE_LABELS = { READY: "原约定路线仍在，尚未开始本次递送", MOVING: "递送员正在沿原约定路线行走，尚未结束", DIVERTED: "递送员已走上原侧路，本次实践尚未结束", FREE: "本次递送实践已结束，递送员可自由离开" } as const;

/** Original S7 gifts, choices, failures and independent bottles remain read-only. */
export function CorruptionBaronBriberHistory({ briber }: { briber: BriberProjection }) {
  return <section className="seer-panel briber-panel" aria-label="贿赂者时期的经历">
    <h3>贿赂者时期的经历</h3>
    <p className="slice-notice">你已晋升腐化男爵（序列6）。这里保留贿赂者时期的原故事、实际赠物、当事人选择、结束、失败和独立原瓶，只供回看。</p>
    <p>贿赂者扮演进度 {briber.acting} · 消化：{briber.digestion}</p>
    {(briber.story || briber.environment || briber.supplies) && <details className="seer-fold">
      <summary>贿赂者原故事与供给</summary>
      {briber.story && <p>{briber.story}</p>}{briber.environment && <p>{briber.environment}</p>}{briber.supplies && <p>{briber.supplies}</p>}
    </details>}
    {briber.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status === "RESOLVED" ? "已收束并提交原报告" : entry.status === "EXAMINED" ? "原检验结果保留" : "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen}</p><p>当时实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold"><summary>原赠物与实际去向</summary><p>{briber.gifts.summary}</p>
      <p>现仍持有 {briber.gifts.held} 件原赠物 · 已实际给出 {briber.gifts.given} 件</p>
      <p className="slice-muted">给予、拒绝与过期记录继续保留。回看不会收回赠物、购买新原筹或重新触发旧效果。</p>
    </details>
    {briber.formulaKnown && briber.formula.length > 0 && <details className="seer-fold">
      <summary>贿赂者时期已知配方</summary>
      <ul>{briber.formula.map((material) => <li key={material.name}>{material.name} · {material.quantity === null ? "数量原文未注明" : `${material.quantity} ${material.unit}`}{material.note && <small>{material.note}</small>}</li>)}</ul>
    </details>}
    {briber.bottles.length > 0 && <details className="seer-fold">
      <summary>贿赂者原瓶 · 来源与去向</summary>
      {briber.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {briber.abilities.length > 0 && <details className="seer-fold">
      <summary>贿赂者时期能力记录</summary>
      {briber.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface CorruptionBaronPanelProps {
  corruptionBaron: CorruptionBaronProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: CorruptionBaronCommand) => void;
}
function isCaseAction(action: CorruptionBaronAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: CorruptionBaronAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render committed public facts only; no intent, movement, effect, or gift changes optimistically. */
export function CorruptionBaronPanel({ corruptionBaron, resources, busy, blocked = false, error = null, onCommand }: CorruptionBaronPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = corruptionBaron.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = corruptionBaron.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = corruptionBaron.actions.filter(isCaseAction);
  // Only a projected CLOSE intent identifies the actual open scene, never historical prose.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (corruptionBaron.insideCase ? corruptionBaron.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? corruptionBaron.cases.find((entry) => entry.id === selectedCaseId)
    ?? corruptionBaron.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? corruptionBaron.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!corruptionBaron.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = corruptionBaron.insideCase ? [] : corruptionBaron.actions.filter(isEncounterAction);
  const growthActions = corruptionBaron.insideCase ? [] : corruptionBaron.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = corruptionBaron.insideCase ? closeAction : !corruptionBaron.promoted
    ? corruptionBaron.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !corruptionBaron.promoted && !corruptionBaron.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (corruptionBaron.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, corruptionBaron.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || corruptionBaron.promoted || corruptionBaron.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, corruptionBaron.promoted, corruptionBaron.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: CorruptionBaronAction) {
    if (busy || interactionBlocked || corruptionBaron.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || corruptionBaron.promoted || corruptionBaron.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: CorruptionBaronAction, unavailable = false) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || unavailable || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || unavailable || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `corruptionBaron-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`corruptionBaron-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel corruptionBaron-panel seer-confirmation" aria-label="这瓶腐化男爵魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="腐化男爵服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{corruptionBaron.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{corruptionBaron.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="corruptionBaron-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "corruptionBaron-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel corruptionBaron-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="腐化男爵成长下一步">
      <span className="seer-seal">{corruptionBaron.promoted ? "序列 6" : "腐化男爵晋升卷宗"}</span>
      <h3>{corruptionBaron.title}</h3>
      <p className="seer-next">{corruptionBaron.insideCase
        ? <><strong>先结束本次实践，回到生活：</strong>{nextAction?.label || "查看当前公开的结束实践选项"}。结束为0行动、0精神、0灵性；保留本次结果、失败与消耗。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : corruptionBaron.promoted && corruptionBaron.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{corruptionBaron.digestion}</p>
      {!corruptionBaron.promoted && <p className="slice-muted">{playerText("须完成贿赂者消化100与十二个完整序列7周。G指导360便士；每瓶3320便士，或5步劳务抵扣3000便士后付320便士。三瓶独立成品分别取得、逐瓶确认，按意志24四档结算；失败仍耗用原瓶。准备期间可继续普通生活与休养。")}</p>}
      {!corruptionBaron.promoted && <p className="slice-muted">{playerText("完整晋升配方、材料与剂量尚未核实；这里只提供有来源的G独立成品，不展示虚构材料或开放晋升魔药调配。")}</p>}
    </section>
    {corruptionBaron.promoted && corruptionBaron.environment && <section aria-label="当前腐化男爵现场"><h4>当前现场</h4><p>{corruptionBaron.environment}</p></section>}
    {corruptionBaron.promoted && <section className="slice-notice" aria-label="当前原条款、原木球与递送路线">
      <h3>当前公开现场</h3>
      <p>当前原条款：{CLAUSE_LABELS[corruptionBaron.practice.clauseOrder]}</p>
      <p>当前原木球：{MARKER_LABELS[corruptionBaron.practice.marker]}</p>
      <p>当前递送路线：{ROUTE_LABELS[corruptionBaron.practice.route]}</p>
      <p className="slice-muted">只显示已保存的实际状态。有限扭曲只偏转已有语言、行动或意图，可能失败或被抵抗；原条款、同一原木球与原路线仍需实际收束。</p>
    </section>}
    {selectedCase && <section aria-label="腐化男爵有限实践">
      <h3>已有语言、行动与意图的有限扭曲</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || corruptionBaron.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {corruptionBaron.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前腐化男爵实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对已有原说法、原物与原行动意图，以及当事人选择和实际退出条件。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前改动原条款、使原木球滚动或改变递送员的行动意图。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="腐化男爵实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前腐化男爵实践行动">{selectedCaseActions.map((action) => actionButton(action))}</div>}
        {corruptionBaron.insideCase && <p className="slice-muted">先用当前“结束实践”选项恢复原条款、收停同一原木球或结束短暂影响，再回到生活、报告或做其它事。即使0行动、0精神、0灵性或本次尝试失败，也可实际结束；不另抽随机、不奖励、不退款、不治疗，不抹去失败或抵抗。</p>}
      </section>
    </section>}
    {corruptionBaron.promoted && <section className="slice-notice" aria-label="继承贿赂的原赠物">
      <h4>继承贿赂 · 原赠物</h4><p>{corruptionBaron.gifts.summary}</p>
      <p>当前持有 {corruptionBaron.gifts.held} 件 · 已实际给出 {corruptionBaron.gifts.given} 件</p>
      <p className="slice-muted">沿用贿赂者原木筹，每包三枚共60便士，购买0行动。原物实际给出才离开持有库存；失败、没有后续动作或效果过期都不返还。使用同一批原木筹，结束实践也不会取回已给出的原物。</p>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="腐化男爵成长行动">{growthActions.map((action) => actionButton(action))}</div>}
    {encounterActions.length > 0 && <section aria-label="腐化男爵有限冲突">
      <h3>有限现场冲突</h3><p className="slice-muted">只按当前公开现场交涉或承担冲突；身后已有出口仍可实际退出，这里不追击。有限扭曲只作用于合格的现存动作，可能失败或被抵抗；不能改写敌方意愿、保证命中或抹去真实伤势。</p>
      <div className="magician-action-list" role="group" aria-label="腐化男爵冲突行动">{encounterActions.map((action) => actionButton(action))}</div>
    </section>}
    {corruptionBaron.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{corruptionBaron.story}</p></details>}
    {corruptionBaron.discovered && corruptionBaron.supplies && <section className="slice-notice" aria-label="腐化男爵成品来源与取得"><h4>实际供给与独立原瓶</h4><p>{corruptionBaron.supplies}</p></section>}
    {corruptionBaron.discovered && corruptionBaron.bottles.length > 0 && <details className="seer-fold" open={!corruptionBaron.promoted}>
      <summary>腐化男爵独立成品原瓶 · 来源与去向</summary>
      {corruptionBaron.bottles.map((bottle) => {
        const action = corruptionBaron.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !corruptionBaron.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !corruptionBaron.promoted && !corruptionBaron.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `corruptionBaron-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`corruptionBaron-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {corruptionBaron.discovered && !corruptionBaron.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{corruptionBaron.risk}</p></details>}
    {corruptionBaron.promoted && <section aria-label="腐化男爵能力与消化">
      <h3>能力与消化 · {corruptionBaron.abilities.length} 项训练记录</h3>
      <p>扮演进度 {corruptionBaron.acting} · 消化：{corruptionBaron.digestion}</p>
      <progress className="cryptologist-progress" aria-label="腐化男爵扮演进度" value={corruptionBaron.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {corruptionBaron.pollution}</p>
      {corruptionBaron.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="腐化男爵实践与能力边界">
        <summary>查看有限扭曲与继承能力边界</summary>
        <p>本序列只新增扭曲。它对已经存在的语言、行动或意图作一次短暂、有限的偏转，不能凭空制造目标、语言或行动，也不是长期控制、强迫服从、改写人格或记忆；仍可能失败或被抵抗。</p>
        <p>原条款的文字与原次序、同一原木球与原托槽、递送员原先约定的路线均保留。实践结束须实际恢复次序、收停原木球或终止短暂影响，让当事人自由离开；准备、执行、实际结束与报告分别记录。</p>
        <p>律师的口才与规则观察、野蛮人的身体能力与有限精神抵抗、贿赂者的有限削弱继续继承。贿赂仍须真实原赠物和公开成本，没有合格后续动作就不会凭空产生削弱；不下放序列5混乱或序列4放大、利用。</p>
        <p>{playerText("普通方法保留，不额外耗灵性；能力方法按当前公开行动支付真实资源。结束实践0行动、0精神、0灵性，原失败、抵抗、付出与给予去向都保留。三段有限实践与和平消化为本作G原创适配，不是原著无代价保证，实践成功也不保证战斗成功。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
