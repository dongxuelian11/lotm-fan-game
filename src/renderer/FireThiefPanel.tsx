import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { FireThiefAction, FireThiefCommand, FireThiefProjection } from "../domain/fire-thief/types";
import type { CryptologistProjection } from "../domain/cryptologist/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已核对来源与边界", PREPARED: "已准备待执行方法",
  EXAMINED: "已有实际结果，待结束与复核", RESOLVED: "已提交本次有限报告",
};

/** Earlier decryption cases and original bottles remain public, read-only history. */
export function FireThiefCryptologistHistory({ cryptologist }: { cryptologist: CryptologistProjection }) {
  return <section className="seer-panel cryptologist-panel" aria-label="解密学者时期的经历">
    <h3>解密学者时期的经历</h3>
    <p className="slice-notice">你已晋升盗火人。这里保留解密学者时期的原资料、实际解密与普通核对、有限结果、失败与原瓶，只供回看；旧成长不会再次结算扮演进度。</p>
    <p>解密学者扮演进度 {cryptologist.acting} · 消化：{cryptologist.digestion}</p>
    {cryptologist.story && <p>{cryptologist.story}</p>}
    {cryptologist.supplies && <p>{cryptologist.supplies}</p>}
    {cryptologist.environment && <p>{cryptologist.environment}</p>}
    {cryptologist.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      {entry.result && <p>当时的实际核实与报告：{entry.result}</p>}
    </details>)}
    {cryptologist.bottles.length > 0 && <details className="seer-fold">
      <summary>解密学者原瓶 · 来源与去向</summary>
      {cryptologist.bottles.map((bottle) => <article className="cryptologist-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {cryptologist.abilities.length > 0 && <details className="seer-fold">
      <summary>解密学者时期能力记录</summary>
      {cryptologist.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface FireThiefPanelProps {
  fireThief: FireThiefProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: FireThiefCommand) => void;
}
function isCaseAction(action: FireThiefAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: FireThiefAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Only committed public projections can borrow a power, advance its windows or restore its source. */
export function FireThiefPanel({ fireThief, resources, busy, blocked = false, error = null, onCommand }: FireThiefPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = fireThief.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = fireThief.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = fireThief.actions.filter(isCaseAction);
  // An actual public CLOSE intent, rather than historical prose, identifies the open scene.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : fireThief.loan.caseId;
  const selectedCase = (fireThief.insideCase ? fireThief.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? fireThief.cases.find((entry) => entry.id === selectedCaseId)
    ?? fireThief.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? fireThief.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!fireThief.insideCase || ["USE", "WAIT", "CLOSE"].includes(action.command.type))) : [];
  const encounterActions = fireThief.insideCase ? [] : fireThief.actions.filter(isEncounterAction);
  const growthActions = fireThief.insideCase ? [] : fireThief.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = fireThief.insideCase
    ? selectedCaseActions.find((action) => action.enabled) ?? closeAction
    : !fireThief.promoted
      ? fireThief.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
        ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
      : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
        ?? selectedCaseActions[0] ?? growthActions[0];
  const borrowedSample = fireThief.samples.find((sample) => sample.id === fireThief.loan.sample);
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !fireThief.promoted && !fireThief.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (fireThief.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, fireThief.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || fireThief.promoted || fireThief.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, fireThief.promoted, fireThief.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: FireThiefAction) {
    if (busy || interactionBlocked || fireThief.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || fireThief.promoted || fireThief.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: FireThiefAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `fire-thief-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`fire-thief-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel cryptologist-panel seer-confirmation" aria-label="这瓶盗火人魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="盗火人服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{fireThief.risk}</p></section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{fireThief.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="fire-thief-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "fire-thief-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试答复。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel cryptologist-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="盗火人成长下一步">
      <span className="seer-seal">{fireThief.promoted ? "序列 6" : "盗火人晋升卷宗"}</span><h3>{fireThief.title}</h3>
      <p className="seer-next">{fireThief.insideCase
        ? <><strong>本次接触尚未结束：</strong>{nextAction?.label || "查看当前公开使用、等待或结束选项"}。可使用当前临时能力、等待，或等完剩余时段并核实来源恢复后离场。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : fireThief.promoted && fireThief.acting >= 100 ? "本阶段已消化，可以继续生活或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{fireThief.digestion}</p>
      {!fireThief.promoted && <p className="slice-muted">指导、每瓶劳务、取得成品原瓶与逐瓶服用确认分别进行；费用、成熟度与补给以当前公开选项为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方、材料与剂量仍未核实，不开放材料采购或调配。具体教学、费用、判定和消化数值为本作原创G。")}</p>
    </section>
    {fireThief.promoted && <section className="slice-notice" aria-label="盗火人能力边界">
      <h4>暂时窃取具体能力，分别观察借用到期与来源恢复</h4>
      <p>只能尝试当前真实来源中允许的能力，实际窃得的能力可能与预期不同。自己的可用时窗与原持有者的失能时窗分别推进；临时借用不会永久学会，也不永久删除原持有者的能力。</p>
      <p className="slice-muted">三案均有0灵性的普通核实路线；未知高位来源只能核对已知资料并拒绝越界。能力路线至少需要一次实际使用才能形成有限报告。盗火人本页不提供序列5窃梦家的念头或梦境窃取，也不能抹去污染。</p>
      <p className="slice-muted">{playerText("现场时段不等于战斗回合；战斗借用与来源失能另按战斗面板结算。")}</p>
    </section>}
    {fireThief.promoted && <section aria-label="当前借用与两段时窗" aria-live="polite" aria-atomic="true">
      <h3>当前借用与两段时窗</h3>
      {fireThief.loan.sample !== null ? <>
        <p>本次实际窃得：{borrowedSample?.label ?? fireThief.loan.sample}</p>
        {borrowedSample && <p>来源：{borrowedSample.source}</p>}
        <dl className="seer-facts">
          <div><dt>自身可用剩余时段</dt><dd>{fireThief.loan.playerSteps} 个现场时段</dd></div>
          <div><dt>来源失能剩余时段</dt><dd>{fireThief.loan.targetSteps} 个现场时段</dd></div>
          <div><dt>本次实际使用次数</dt><dd>{fireThief.loan.uses} 次</dd></div>
          <div><dt>已经过的现场时段</dt><dd>{fireThief.loan.elapsedSteps} 个现场时段</dd></div>
        </dl>
        <p>{fireThief.loan.playerSteps > 0 ? "自身仍在临时可用时窗内；能否使用以当前公开选项为准。" : "自身借用已到期，不能再使用这项临时能力。"}</p>
        <p>{fireThief.loan.targetSteps > 0 ? "原持有者这项能力仍暂时失能；自身到期不代表来源已恢复。" : "来源失能时窗已结束，原持有者这项能力已恢复。"}</p>
        <p className="slice-muted">使用会支付当前公开灵性成本并推进一个现场时段；等待不使用能力；结束会实际等完剩余时间、核实恢复后离场。点击不会提前改写这两段时窗。</p>
      </> : <p className="slice-muted">当前没有实际借得的临时能力。准备、期望或历史记录不会生成可用能力。</p>}
    </section>}
    {fireThief.promoted && fireThief.samples.length > 0 && <details className="seer-fold" open={!fireThief.insideCase}>
      <summary>当前公开的真实能力来源</summary>
      {fireThief.samples.map((sample) => <section key={sample.id} aria-label={`${sample.label}的公开来源`}>
        <h4>{sample.label}</h4><p>来源：{sample.source}</p>
        <p className="slice-muted">来源当前灵性 {sample.instructorSpirituality} · {sample.demonstrated ? "已有本次实际示范" : "尚无本次实际示范"}</p>
      </section>)}
    </details>}
    {fireThief.promoted && fireThief.environment && <section aria-label="当前盗火人现场"><h4>当前现场</h4><p>{fireThief.environment}</p></section>}
    {selectedCase && <section aria-label="盗火人有限实践">
      <h3>临时借用、两段时窗与普通核实</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || fireThief.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {fireThief.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前盗火人实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次接触：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="公开观察与原失败记录"><h4>公开观察与原失败记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际核对记录；不能凭预期或叙述补出来源、能力或实际结果。</p>}
        </section>
        <section aria-label="实际方法与准备"><h4>实际方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的方法。选择准备不会提前窃取、使用能力或完成普通核实。"}</p>
        </section>
        {selectedCase.result && <section aria-label="有限实践与实际结果" aria-live="polite" aria-atomic="true"><h4>有限实践与实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前盗火人实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">撤回准备不等于实际退出。实施后须使用、等待或结束本次接触；结束会等完剩余时段并核实来源恢复，之后才可报告。结束不另抽随机、不奖励、不退款、不治疗。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="盗火人成长行动">{growthActions.map(actionButton)}</div>}
    {fireThief.story && <p className="slice-muted">{fireThief.story}</p>}
    {encounterActions.length > 0 && <section aria-label="有限现场冲突"><h3>有限现场冲突</h3>
      <p className="slice-muted">按公开选项交涉或承担真实战斗风险。战斗中的临时借用与来源失能按各自回合时窗显示；能力选择、实际成本和来源恢复以战斗面板为准，仍可使用普通动作。</p>
      <div className="warrior-action-list" role="group" aria-label="现场冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {fireThief.discovered && fireThief.supplies && <section className="slice-notice" aria-label="盗火人成品原瓶供给"><h4>成品原瓶与实际供给</h4><p>{fireThief.supplies}</p></section>}
    {fireThief.discovered && fireThief.bottles.length > 0 && <details className="seer-fold" open={!fireThief.promoted}>
      <summary>盗火人独立成品原瓶 · 来源与去向</summary>
      {fireThief.bottles.map((bottle) => {
        const action = fireThief.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !fireThief.promoted ? "seer-bottle" : "cryptologist-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !fireThief.promoted && !fireThief.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `fire-thief-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>{action.reason && <p className="seer-action-reason" id={`fire-thief-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {fireThief.discovered && !fireThief.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{fireThief.risk}</p></details>}
    {fireThief.promoted && <section aria-label="盗火人能力与消化"><h3>能力与消化 · {fireThief.abilities.length} 项训练记录</h3>
      <p>扮演进度 {fireThief.acting} · 消化：{fireThief.digestion}</p><p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {fireThief.pollution}</p>
      {fireThief.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
