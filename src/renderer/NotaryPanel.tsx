import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { NotaryAction, NotaryCommand, NotaryProjection } from "../domain/notary/types";
import type { SunpriestProjection } from "../domain/sunpriest/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次事实",
  OBSERVED: "已有原现场与当事人意见记录",
  PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，须结束本次现场",
  RESOLVED: "已提交本次有限报告",
};

/** Earlier promises, holy water, bottles and attempts are records, never repeatable S6 actions. */
export function NotarySunpriestHistory({ sunpriest }: { sunpriest: SunpriestProjection }) {
  return <section className="seer-panel magician-panel" aria-label="太阳神官时期的经历">
    <h3>太阳神官时期的经历</h3>
    <p className="slice-notice">这里保留太阳神官时期的原材料、独立原瓶、圣水制备与消耗、自愿承诺和实际结果，只供回看。</p>
    <p>太阳神官扮演进度 {sunpriest.acting} · 消化：{sunpriest.digestion}</p>
    {sunpriest.story && <p>{sunpriest.story}</p>}
    {sunpriest.supplies && <p>{sunpriest.supplies}</p>}
    {sunpriest.environment && <p>{sunpriest.environment}</p>}
    {sunpriest.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>{entry.story}</p>
      {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}>
        <h4>当时的实际观察</h4><ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>
      </section>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}
      {entry.result && <p>当时的实际结果：{entry.result}</p>}
    </details>)}
    {sunpriest.formulaKnown && sunpriest.formula.length > 0 && <details className="seer-fold" aria-label="太阳神官时期已知配方">
      <summary>太阳神官时期已知配方</summary>
      <ul className="seer-formula">{sunpriest.formula.map((material) => <li key={material.name}>
        <span>{material.name}</span><strong>{material.quantity} {material.unit}</strong>
      </li>)}</ul>
    </details>}
    {sunpriest.bottles.length > 0 && <details className="seer-fold" open>
      <summary>太阳神官原瓶 · 来源与去向</summary>
      {sunpriest.bottles.map((bottle) => <article className="magician-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {sunpriest.abilities.length > 0 && <details className="seer-fold">
      <summary>太阳神官时期能力记录</summary>
      {sunpriest.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface NotaryPanelProps {
  notary: NotaryProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: NotaryCommand) => void;
}
function isCaseAction(action: NotaryAction): boolean {
  return "caseId" in action.command;
}
function isEncounterAction(action: NotaryAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Consent, original-tool custody and fulfillment come only from committed public records. */
export function NotaryPanel({ notary, resources, busy, blocked = false, error = null, onCommand }: NotaryPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const [recognizedAgreement, setRecognizedAgreement] = useState<string | null>(null);
  const [submittedAgreement, setSubmittedAgreement] = useState<string | null>(null);
  const bottleSubmission = useRef<string | null>(null);
  const signSubmission = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = notary.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = notary.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = notary.actions.filter(isCaseAction);
  // Public CLOSE, never retained prose or presumed inventory, identifies the current contact.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (notary.insideCase ? notary.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? notary.cases.find((entry) => entry.id === selectedCaseId)
    ?? notary.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? notary.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const signAction = selectedCaseActions.find((action) => action.command.type === "SIGN");
  // Tie the local acknowledgment to the displayed public text; revised terms require rereading.
  const agreementKey = selectedCase?.id === "signed-tool" && signAction
    ? JSON.stringify([selectedCase.id, selectedCase.story, selectedCase.observations, signAction.id, signAction.label, signAction.cost, notary.contract.signed]) : null;
  const agreementRecognized = agreementKey !== null && recognizedAgreement === agreementKey;
  const agreementSubmitted = agreementKey !== null && submittedAgreement === agreementKey;
  const encounterActions = notary.actions.filter(isEncounterAction);
  const growthActions = notary.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = notary.insideCase ? closeAction : !notary.promoted
    ? notary.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !notary.promoted && !notary.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (notary.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, notary.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || notary.promoted || notary.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      bottleSubmission.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, notary.promoted, notary.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);
  useEffect(() => {
    setRecognizedAgreement(null);
    setSubmittedAgreement(null);
    signSubmission.current = null;
  }, [agreementKey]);

  function openBottle(action: NotaryAction) {
    if (busy || interactionBlocked || notary.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    bottleSubmission.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || bottleSubmission.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || notary.promoted || notary.insideCase) return;
    bottleSubmission.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: NotaryAction) {
    const needsRecognition = action.command.type === "SIGN";
    const recognitionBlocked = needsRecognition && (!agreementRecognized || agreementSubmitted);
    const descriptions = [action.reason ? `notary-reason-${action.id}` : null, needsRecognition ? "notary-recognition-note" : null].filter(Boolean).join(" ");
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || agreementSubmitted || !action.enabled || recognitionBlocked}
        onClick={() => {
          if (busy || interactionBlocked || agreementSubmitted || !action.enabled || recognitionBlocked) return;
          if (needsRecognition) {
            if (!agreementKey || signSubmission.current === agreementKey) return;
            signSubmission.current = agreementKey;
            setSubmittedAgreement(agreementKey);
          }
          onCommand(action.command);
        }} aria-describedby={descriptions || undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`notary-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel magician-panel seer-confirmation" aria-label="这瓶公证人魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="公证人服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{notary.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{notary.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="notary-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "notary-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试回执。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel magician-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="公证人成长下一步">
      <span className="seer-seal">{notary.promoted ? "序列 6" : "公证人晋升卷宗"}</span>
      <h3>{notary.title}</h3>
      <p className="seer-next">{notary.insideCase
        ? <><strong>先实际结束本次现场：</strong>{nextAction?.label || "查看当前公开结束选项"}。借用原工具时，须亲手归还同一原物；切换卷宗不会归还工具或履行承诺。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{notary.digestion}</p>
      {!notary.promoted && <p className="slice-muted">服用前须完成太阳神官消化100与十二个完整序列7周。配方、每批实际材料、调配独立原瓶与逐瓶确认分别进行；成熟条件、五步劳务与费用以公开记录为准，准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("供货、费用、判定与实践故事为本作原创G。能力公证有限强化或削弱已有能力；契约须由本人签名认可，不能凭一句话改写事实、替他人同意或创造任意能力。")}</p>
    </section>
    {notary.promoted && notary.environment && <section aria-label="当前公证人现场"><h4>当前现场</h4><p>{notary.environment}</p></section>}
    {notary.promoted && <section className="slice-notice" aria-label="本人签名与原测量工具" aria-live="polite" aria-atomic="true">
      <h3>本人签名、原工具与归还承诺</h3>
      <dl className="seer-facts">
        <div><dt>本人签名认可</dt><dd>{notary.contract.signed ? "已明确签名认可本次短契约" : "尚未签名认可"}</dd></div>
        <div><dt>当前契约义务</dt><dd>{notary.contract.active ? "本次归还承诺仍有效" : "当前没有生效中的契约义务"}</dd></div>
        <div><dt>同一原测量工具</dt><dd>{notary.contract.tool === "PLAYER" ? "本人实际持有" : "原工作间桌上"}</dd></div>
        <div><dt>契约履行记录</dt><dd>{notary.contract.fulfilled ? "已经实际归还并履行本次承诺" : "尚无本次契约履行记录"}</dd></div>
      </dl>
      <p className="slice-muted">这里仅显示已保存的实际记录。阅读、选择方法或关闭卷宗都不会自动签约。签名认可与实际借用分别提交，归还通过公开结束行动完成，原拒绝与失败不会被抹去。</p>
    </section>}
    {selectedCase && <section aria-label="公证人有限实践">
      <h3>有限能力公证与本人认可的短契约</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || notary.insideCase || agreementSubmitted} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {notary.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前公证人实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次现场：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
        <section aria-label="公开观察与原拒绝记录"><h4>公开观察与原拒绝记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察记录；原条款、当事人的意见与现有能力须逐项核对。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前公证、签约或取得原工具。"}</p>
        </section>
        {signAction && <section className="slice-notice" aria-label="阅读与明确认可本次短契约">
          <h4>本人阅读并明确认可</h4>
          <p id="notary-recognition-note">请先阅读上方本次短契约和当面同意记录。勾选后仍须主动选择下方签名行动，才会提交本人认可；可以保持未勾选并使用公开的普通方法。</p>
          <label><input type="checkbox" checked={agreementRecognized} disabled={busy || interactionBlocked || agreementSubmitted || !signAction.enabled}
            onChange={(event) => setRecognizedAgreement(event.target.checked ? agreementKey : null)} /> 我已阅读本次短契约，愿意以本人签名明确认可。</label>
          {agreementSubmitted && <p role="status">本次签名已提交，正在等待保存回执；义务与工具去向仍以已保存记录为准。</p>}
        </section>}
        {selectedCase.result && <section aria-label="公证人实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前公证人实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">普通方法保留自己的条件和结果。原条款遭拒后不能替当事人接受；后续修订须按新的公开记录核对。撤回准备不等于实际归还，结束现场不退款、不治疗，也不消除原拒绝。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="公证人成长行动">{growthActions.map(actionButton)}</div>}
    {notary.story && <p className="slice-muted">{notary.story}</p>}
    {encounterActions.length > 0 && <section aria-label="公证人有限冲突">
      <h3>有限冲突</h3><p className="slice-muted">按当前公开选项当面交涉或承担真实战斗风险。练习中的公证与短契约不保证战斗胜利，也不让未签名的人自动受约束。</p>
      <div className="magician-action-list" role="group" aria-label="公证人冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {notary.discovered && notary.supplies && <section className="slice-notice" aria-label="公证人实际材料与批次">
      <h4>实际材料与独立批次</h4><p>{notary.supplies}</p>
    </section>}
    {notary.formulaKnown && notary.formula.length > 0 && <details className="seer-fold" aria-label="公证人已知配方">
      <summary>查看已知公证人配方 · {notary.formula.length} 种材料</summary>
      <ul className="seer-formula">{notary.formula.map((material) => <li key={material.name}>
        <span>{material.name}</span><strong>{material.quantity} {material.unit}</strong>
      </li>)}</ul>
      <p className="slice-muted">材料清单不等于投料顺序。取得六项实际原料、调配独立原瓶与确认服用分别进行，不用旧瓶替代本次原材料。</p>
    </details>}
    {notary.discovered && notary.bottles.length > 0 && <details className="seer-fold" open={!notary.promoted}>
      <summary>公证人独立调配原瓶 · 来源与去向</summary>
      {notary.bottles.map((bottle) => {
        const action = notary.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !notary.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !notary.promoted && !notary.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `notary-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`notary-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {notary.discovered && !notary.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{notary.risk}</p></details>}
    {notary.promoted && <section aria-label="公证人能力与消化">
      <h3>能力与消化 · {notary.abilities.length} 项训练记录</h3>
      <p>扮演进度 {notary.acting} · 消化：{notary.digestion}</p>
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {notary.pollution}</p>
      {notary.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
