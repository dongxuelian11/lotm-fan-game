import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PryerAction, PryerCommand, PryerProjection } from "../domain/pryer/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与能力边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际检验，请核对结果与阅读状态",
  RESOLVED: "已提交本次实践报告",
};

/** Other-pathway history has no mutation callback or actionable controls. */
export function PryerHistory({ pryer }: { pryer: PryerProjection }) {
  const title = "窥秘人渠道经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">这里保留窥秘人时期的渠道、原瓶与实践记录，只供回看；当前成长请查看对应卷宗。</p>
    {pryer.story && <p>{pryer.story}</p>}
    {pryer.supplies && <p>{pryer.supplies}</p>}
    {pryer.environment && <p>{pryer.environment}</p>}
    {pryer.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次阅读：{entry.readingOpen} · 过度断言记录：{entry.overclaims}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {pryer.bottles.length > 0 && <details className="seer-fold" open>
      <summary>窥秘人原瓶 · 来源与去向</summary>
      {pryer.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {pryer.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {pryer.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: PryerAction): boolean {
  return "caseId" in action.command;
}

interface PryerPanelProps {
  pryer: PryerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: PryerCommand) => void;
}

/** Only committed public facts change reading state, preparation, or reports. */
export function PryerPanel({ pryer, resources, busy, blocked, readOnly = false, onCommand }: PryerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => pryer.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = pryer.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = pryer.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = pryer.actions.filter(isCaseAction);
  // An open reading is selected from its public CLOSE intent, never inferred from prose.
  const closeAction = pryer.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : "intrusive-page";
  const selectedCase = (pryer.insideCase ? pryer.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? pryer.cases.find((entry) => entry.id === selectedCaseId)
    ?? pryer.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? pryer.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = pryer.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = pryer.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : pryer.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : pryer.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (pryer.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [pryer.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !pryer.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || pryer.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, pryer.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: PryerAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || pryer.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: PryerAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `pryer-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`pryer-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <PryerHistory pryer={pryer} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶窥秘人魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="窥秘人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{pryer.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{pryer.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="pryer-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "pryer-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="窥秘人成长下一步">
        <span className="seer-seal">{pryer.promoted ? "序列 9" : "窥秘人成长卷宗"}</span>
        <h3>{pryer.title}</h3>
        {pryer.insideCase ? (
          <p className="seer-next"><strong>先结束本次阅读：</strong>{nextLabel || "查看当前公开合页选项"}。合页不消耗行动或灵性，0精神时仍可执行；它只结束本地书页接触，不会阻断隐匿贤者。</p>
        ) : pryer.promoted && pryer.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{pryer.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{pryer.digestion}</p>
        {!pryer.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">取得渠道或晋升不会自动加入组织。神秘学学习须核对来源；本页的知识压力指游戏中外来超凡灌输，普通学习本身不被描写为精神疾病。</p>
      </section>

      {pryer.promoted && <section className="slice-notice warrior-environment" aria-label="现场与本次阅读">
        <h4>现场与本次阅读</h4>
        <p>{pryer.environment || "尚未取得现场公开记录；书页内容、仪式准备与本次结果须经实际观察和行动确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="窥秘人有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || pryer.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {pryer.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前窥秘人实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次阅读：{selectedCase.readingOpen}</p>
            <p className="slice-muted">过度断言记录：{selectedCase.overclaims}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；原文、灵视线索与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的检验、合页与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="实践范围与阅读边界">
              <h4>实践范围与阅读边界</h4>
              <p>先观察原现场，再选择神秘学方法或普通核对。准备、实际检验、合页与报告分别提交，成本与限制见按钮。报告内容由你选择，界面只展示已公开的实际记录。</p>
              <p className="slice-muted">有限灵视和初步仪式不能直接给出完整未来或健康真相。打开异常书页后，无论检验成败，都要实际合页才能安排其它事务；合页仅结束这次阅读，不能成为免疫隐匿贤者的保证。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="实际执行与报告记录" aria-live="polite" aria-atomic="true">
              <h4>实际执行与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前窥秘人实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="窥秘人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {pryer.story && <p className="slice-muted">{pryer.story}</p>}

      {pryer.discovered && <section className="slice-notice warrior-source" aria-label="窥秘人成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用公开渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {pryer.supplies && <p>{pryer.supplies}</p>}
      </section>}
      {pryer.discovered && pryer.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!pryer.promoted}>
          <summary>莉奈·安瑟的独立成品原瓶 · 来源与去向</summary>
          {pryer.bottles.map((bottle) => {
            const action = pryer.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !pryer.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !pryer.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `pryer-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`pryer-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {pryer.discovered && !pryer.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{pryer.risk}</p></details>}
      {pryer.promoted && (
        <section className="warrior-abilities" aria-label="窥秘人能力与消化">
          <h3>能力与消化 · {pryer.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列9获得初步广博的神秘学知识、仪式知识与有限灵视。能力、掌握与边界以已公开记录为准；没有远距离穿墙视觉、将眼睛置于他人身体或神秘再现。</p>
          <p>扮演进度 {pryer.acting} · 消化：{pryer.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {pryer.pollution}</p>
          {pryer.abilities.map((ability) => (
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
