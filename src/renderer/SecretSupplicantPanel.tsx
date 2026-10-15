import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SecretSupplicantAction, SecretSupplicantCommand, SecretSupplicantProjection } from "../domain/secret-supplicant/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与能力边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际检验，请核对结果与接触状态",
  RESOLVED: "已提交本次实践报告",
};

/** Other-pathway history has no mutation callback or actionable controls. */
export function SecretSupplicantHistory({ secretSupplicant }: { secretSupplicant: SecretSupplicantProjection }) {
  const title = "秘祈人渠道经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">这里保留秘祈人时期的渠道、原瓶与实践记录，只供回看；当前成长请查看对应卷宗。</p>
    {secretSupplicant.story && <p>{secretSupplicant.story}</p>}
    {secretSupplicant.supplies && <p>{secretSupplicant.supplies}</p>}
    {secretSupplicant.environment && <p>{secretSupplicant.environment}</p>}
    {secretSupplicant.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次接触：{entry.contactOpen} · 过度断言记录：{entry.overclaims}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {secretSupplicant.bottles.length > 0 && <details className="seer-fold" open>
      <summary>秘祈人原瓶 · 来源与去向</summary>
      {secretSupplicant.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {secretSupplicant.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {secretSupplicant.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: SecretSupplicantAction): boolean {
  return "caseId" in action.command;
}

interface SecretSupplicantPanelProps {
  secretSupplicant: SecretSupplicantProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: SecretSupplicantCommand) => void;
}

/** Only committed public facts change contact state, preparation, or reports. */
export function SecretSupplicantPanel({ secretSupplicant, resources, busy, blocked, readOnly = false, onCommand }: SecretSupplicantPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => secretSupplicant.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = secretSupplicant.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = secretSupplicant.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = secretSupplicant.actions.filter(isCaseAction);
  // An open contact is selected from its public COVER intent, never inferred from prose.
  const coverAction = secretSupplicant.actions.find((action) => action.command.type === "COVER");
  const coverCaseId = coverAction?.command.type === "COVER" ? coverAction.command.caseId : "covered-token";
  const selectedCase = (secretSupplicant.insideCase ? secretSupplicant.cases.find((entry) => entry.id === coverCaseId) : undefined)
    ?? secretSupplicant.cases.find((entry) => entry.id === selectedCaseId)
    ?? secretSupplicant.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? secretSupplicant.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!secretSupplicant.insideCase || action.command.type === "COVER")) : [];
  const actions = secretSupplicant.insideCase ? [] : secretSupplicant.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = secretSupplicant.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "COVER" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "COVER")
    : secretSupplicant.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : secretSupplicant.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (secretSupplicant.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [secretSupplicant.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !secretSupplicant.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || secretSupplicant.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, secretSupplicant.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SecretSupplicantAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || secretSupplicant.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: SecretSupplicantAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `secretSupplicant-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`secretSupplicant-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <SecretSupplicantHistory secretSupplicant={secretSupplicant} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶秘祈人魔药的服用确认" aria-busy={busy}
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
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="秘祈人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{secretSupplicant.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{secretSupplicant.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="secretSupplicant-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "secretSupplicant-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="秘祈人成长下一步">
        <span className="seer-seal">{secretSupplicant.promoted ? "序列 9" : "秘祈人成长卷宗"}</span>
        <h3>{secretSupplicant.title}</h3>
        {secretSupplicant.insideCase ? (
          <p className="seer-next"><strong>先结束本次接触：</strong>{nextLabel || "查看当前公开盖罩选项"}。盖罩不消耗行动或灵性，0精神时仍可执行；它只结束这次主动接触，不能保证免受神秘影响。</p>
        ) : secretSupplicant.promoted && secretSupplicant.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{secretSupplicant.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{secretSupplicant.digestion}</p>
        {!secretSupplicant.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">{playerText("取得渠道或晋升不会自动加入极光会或其它组织。管理员、成品供给、三项实践与数值为本作原创G；普通学习或现实心理症状不等于神秘污染。")}</p>
      </section>

      {secretSupplicant.promoted && <section className="slice-notice warrior-environment" aria-label="现场与本次接触">
        <h4>现场与本次接触</h4>
        <p>{secretSupplicant.environment || "尚未取得现场公开记录；旧账内容、仪式准备与本次结果须经实际观察和行动确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="秘祈人有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || secretSupplicant.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {secretSupplicant.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前秘祈人实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次接触：{selectedCase.contactOpen}</p>
            <p className="slice-muted">过度断言记录：{selectedCase.overclaims}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；旧物来源、有限神秘迹象与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的检验、盖罩与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="实践范围与接触边界">
              <h4>实践范围与接触边界</h4>
              <p>先观察原现场，再选择有限神秘学方法或普通核对。准备、实际检验、盖罩与报告分别提交，成本与限制见按钮。已知资料不足时，确定断言不给予成长奖励；可以更正报告，但原错误记录继续保留。</p>
              <p className="slice-muted">有限感知不能确认未知存在的身份或意图，完成仪式也不保证得到回应。原罩揭开后，无论检验成败，都要实际盖回才能安排其它事务；盖罩只结束本次主动接触，不能保证免受神秘影响。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="实际执行与报告记录" aria-live="polite" aria-atomic="true">
              <h4>实际执行与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前秘祈人实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="秘祈人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {secretSupplicant.story && <p className="slice-muted">{secretSupplicant.story}</p>}

      {secretSupplicant.discovered && <section className="slice-notice warrior-source" aria-label="秘祈人成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {secretSupplicant.supplies && <p>{secretSupplicant.supplies}</p>}
      </section>}
      {secretSupplicant.discovered && secretSupplicant.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!secretSupplicant.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {secretSupplicant.bottles.map((bottle) => {
            const action = secretSupplicant.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !secretSupplicant.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !secretSupplicant.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `secretSupplicant-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`secretSupplicant-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {secretSupplicant.discovered && !secretSupplicant.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{secretSupplicant.risk}</p></details>}
      {secretSupplicant.promoted && (
        <section className="warrior-abilities" aria-label="秘祈人能力与消化">
          <h3>能力与消化 · {secretSupplicant.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列9只在当前公开情境中使用有限神秘感知、少量祭祀知识与仪式实践。能力、掌握与边界以已公开记录为准；不提供倾听者的直接耳语、失控肉瘤、血肉操控或灵魂放牧。</p>
          <p>扮演进度 {secretSupplicant.acting} · 消化：{secretSupplicant.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {secretSupplicant.pollution}</p>
          {secretSupplicant.abilities.map((ability) => (
            <details className="seer-fold" key={ability.id}>
              <summary>{ability.label} · 掌握 {ability.mastery}</summary>
              <p>{ability.description}</p>
            </details>
          ))}
        </section>
      )}
      {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    </div>
  );
}
