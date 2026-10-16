import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SpiritGuideAction, SpiritGuideCommand, SpiritGuideProjection } from "../domain/spirit-guide/types";
import type { SpiritmediumProjection } from "../domain/spiritmedium/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对事实",
  OBSERVED: "已有灵体或现场观察记录",
  PREPARED: "已准备待执行的有限实践",
  EXAMINED: "已有有限实践的实际结果",
  RESOLVED: "已提交本次有限报告",
};

/** Earlier spirit observations, original objects and consumed bottles stay read-only. */
export function SpiritGuideSpiritmediumHistory({ spiritmedium }: { spiritmedium: SpiritmediumProjection }) {
  return <section className="seer-panel warrior-panel spiritmedium-panel" aria-label="通灵者时期的经历">
    <h3>通灵者时期的经历</h3>
    <p className="slice-notice">你已晋升死灵导师。这里保留通灵者时期的有限仪式、原灵片段、原物借力、普通核实、失败、原瓶与原ID，只供回看；旧成长不会在序列6再次结算扮演进度。</p>
    <p>通灵者扮演进度 {spiritmedium.acting} · 消化：{spiritmedium.digestion}</p>
    {spiritmedium.story && <p>{spiritmedium.story}</p>}
    {spiritmedium.supplies && <p>{spiritmedium.supplies}</p>}
    {spiritmedium.environment && <p>{spiritmedium.environment}</p>}
    {spiritmedium.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      {entry.result && <p>当时的实际核实与报告：{entry.result}</p>}
    </details>)}
    {spiritmedium.bottles.length > 0 && <details className="seer-fold" open>
      <summary>通灵者原瓶 · 来源与去向</summary>
      {spiritmedium.bottles.map((bottle) => <article className="spiritmedium-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {spiritmedium.abilities.length > 0 && <details className="seer-fold">
      <summary>通灵者时期能力记录</summary>
      {spiritmedium.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface SpiritGuidePanelProps {
  spiritGuide: SpiritGuideProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: SpiritGuideCommand) => void;
}

function isCaseAction(action: SpiritGuideAction): boolean {
  return "caseId" in action.command;
}
function isEncounterAction(action: SpiritGuideAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Only committed public state may recruit a messenger, move the original letter or return a reply. */
export function SpiritGuidePanel({ spiritGuide, resources, busy, blocked = false, error = null, onCommand }: SpiritGuidePanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = spiritGuide.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = spiritGuide.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = spiritGuide.actions.filter(isCaseAction);
  // Only a public CLOSE intent identifies the open scene; old failure prose cannot lock it.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (spiritGuide.insideCase ? spiritGuide.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? spiritGuide.cases.find((entry) => entry.id === selectedCaseId)
    ?? spiritGuide.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? spiritGuide.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!spiritGuide.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = spiritGuide.insideCase ? [] : spiritGuide.actions.filter(isEncounterAction);
  const growthActions = spiritGuide.insideCase ? [] : spiritGuide.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = spiritGuide.insideCase ? closeAction : !spiritGuide.promoted
    ? spiritGuide.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !spiritGuide.promoted && !spiritGuide.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (spiritGuide.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, spiritGuide.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || spiritGuide.promoted || spiritGuide.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, spiritGuide.promoted, spiritGuide.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SpiritGuideAction) {
    if (busy || interactionBlocked || spiritGuide.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || spiritGuide.promoted || spiritGuide.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: SpiritGuideAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `spirit-guide-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`spirit-guide-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel spiritmedium-panel seer-confirmation" aria-label="这瓶死灵导师魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!confirmationLocked) setSelectedBottleId(null);
      }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="死灵导师服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{spiritGuide.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{spiritGuide.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="spirit-guide-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "spirit-guide-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试答复。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel spiritmedium-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="死灵导师成长下一步">
      <span className="seer-seal">{spiritGuide.promoted ? "序列 6" : "死灵导师晋升卷宗"}</span>
      <h3>{spiritGuide.title}</h3>
      <p className="seer-next">{spiritGuide.insideCase
        ? <><strong>先实际结束本次接触：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束能力并实际离场为0行动、0精神、0灵性；不另抽随机、不奖励、不退款、不治疗，原失败、已接受条款、原信去向与实际答复继续保留。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{spiritGuide.digestion}</p>
      {!spiritGuide.promoted && <p className="slice-muted">服用前须完成通灵者消化100与十二个完整序列7周。指导360便士；独立成品每瓶3320便士，或完成五步劳务抵扣3000便士后另付320便士。指导、每瓶劳务、取得原瓶与逐瓶确认分别进行，补给以当前公开记录为准；准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方、材料与剂量仍未核实，指导仅说明有来源的独立成品原瓶，不开放材料采购或调配。具体故事、具名灵体、条款、判定、费用与消化数值为本作原创G。")}</p>
    </section>

    {spiritGuide.promoted && <section className="slice-notice" aria-label="死灵导师能力边界">
      <h4>先核对条款，再实际招募与有限递送</h4>
      <p>{playerText("低强灵体灰羽是本作原创G。玩家本人须实际核对并邀请灰羽；招募须经实际判定成功、灰羽自行接受有限条款后实际支付12便士，才建立本次有限信使约定，观察与普通条款记录不会招募。仅约定从导师房间向相邻、已知的看守房间递送这一封虚构密封教学信并带回实际答复，完成一次后休息。")}</p>
      <p className="slice-muted">普通路线由玩家本人携带同一原信，交给原收件人并带回答复。三项主实践可和平完成本阶段消化100；信使不提供免费世界传送、军队或随身战斗同伴。亡者之语只对现场实际滞留灵进行有限交流与影响，可能遭遇抵抗；不会复活死者、绝对控制亡灵或保证回答真实。看门人的冥界之门不属于本阶段能力。</p>
    </section>}
    {spiritGuide.promoted && <section className="slice-notice" aria-label="灰羽与原信的实际状态" aria-live="polite" aria-atomic="true">
      <h4>灰羽、同一原信与实际答复</h4>
      <dl className="seer-facts">
        <div><dt>信使招募</dt><dd>{spiritGuide.messenger.recruited ? "已实际招募灰羽，受原有限条款约束" : "尚未招募灰羽"}</dd></div>
        <div><dt>已付约定费用</dt><dd>{spiritGuide.messenger.feePaid}便士</dd></div>
        <div><dt>原信实际递送次数</dt><dd>{spiritGuide.messenger.deliveries}</dd></div>
        <div><dt>密封教学信原件</dt><dd>{spiritGuide.messenger.letter === "RECIPIENT" ? "已在相邻已知看守房间的原收件人手中" : "仍在导师房间的原桌上"}</dd></div>
        <div><dt>实际答复</dt><dd>{spiritGuide.messenger.replyReceived ? "已经实际带回本次有限答复" : "尚未实际带回答复"}</dd></div>
      </dl>
      {spiritGuide.messenger.deliveries > 0 && <p>唯一原信已实际交付；具体递送方式与灰羽状态以本案实际结果为准。</p>}
      <p className="slice-muted">有限答复只反映原收件人自述所知，不能证明信件内容、灵体陈述或全部事实绝对真实。这里仅显示已保存的状态；准备、选择卷宗或点击行动不会提前改变原信、招募或答复。</p>
    </section>}
    {spiritGuide.promoted && spiritGuide.environment && <section aria-label="当前死灵导师现场">
      <h4>当前现场</h4><p>{spiritGuide.environment}</p>
    </section>}
    {selectedCase && <section aria-label="死灵导师有限实践">
      <h3>条款核对、原信交接与亡者之语</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || spiritGuide.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {spiritGuide.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前死灵导师实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次接触：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="公开观察与原失败记录"><h4>公开观察与原失败记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际核对记录；灵体印象不等于可靠事实，须核对原灵、实际条款、原信与现场边界。</p>}
        </section>
        <section aria-label="有限实践与准备"><h4>有限实践与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择准备不会提前招募灰羽、付款、递送原信、取得答复或影响滞留灵。"}</p>
        </section>
        {selectedCase.result && <section aria-label="有限接触与实际结果" aria-live="polite" aria-atomic="true">
          <h4>有限接触与实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前死灵导师实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">普通记录不等于招募，普通递送仍须实际携带原信并带回答复。撤回准备不等于实际退出；每次实施后须结束能力并实际离场，0行动、0精神、0灵性，不另抽随机、不退款、不治疗。离场保留原信去向、答复、费用、失败与已提交报告，实际选项以公开按钮为准。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="死灵导师成长行动">{growthActions.map(actionButton)}</div>}
    {spiritGuide.story && <p className="slice-muted">{spiritGuide.story}</p>}
    {encounterActions.length > 0 && <section aria-label="有限现场冲突">
      <h3>有限现场冲突</h3>
      <p className="slice-muted">可按公开选项交涉，或承担原现场短棍战的实际风险。灰羽的有限递送约定不会把它变成随身战斗同伴；亡者之语只在适用目标上尝试，不保证战斗成功。</p>
      <div className="warrior-action-list" role="group" aria-label="现场冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {spiritGuide.discovered && spiritGuide.supplies && <section className="slice-notice" aria-label="死灵导师成品原瓶供给">
      <h4>成品原瓶与实际供给</h4><p>{spiritGuide.supplies}</p>
    </section>}
    {spiritGuide.discovered && spiritGuide.bottles.length > 0 && <details className="seer-fold" open={!spiritGuide.promoted}>
      <summary>死灵导师独立成品原瓶 · 来源与去向</summary>
      {spiritGuide.bottles.map((bottle) => {
        const action = spiritGuide.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !spiritGuide.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !spiritGuide.promoted && !spiritGuide.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `spirit-guide-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`spirit-guide-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {spiritGuide.discovered && !spiritGuide.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{spiritGuide.risk}</p></details>}
    {spiritGuide.promoted && <section aria-label="死灵导师能力与消化">
      <h3>能力与消化 · {spiritGuide.abilities.length} 项训练记录</h3>
      <p>扮演进度 {spiritGuide.acting} · 消化：{spiritGuide.digestion}</p>
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {spiritGuide.pollution}</p>
      {spiritGuide.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
