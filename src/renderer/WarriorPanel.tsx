import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WarriorAction, WarriorCommand, WarriorProjection } from "../domain/warrior/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与协作条件",
  PREPARED: "已选定方法并完成准备",
  WORKED: "已实际作业，请核对结果与原工具",
  RESOLVED: "已提交本次作业报告",
};

function ToolRecord({ tool }: { tool: WarriorProjection["tool"] }) {
  if (!tool) return null;
  return <section className="seer-fold warrior-tool" aria-label="训练原棍的归属与持有">
    <h4>训练原棍 · 当前公开记录</h4>
    <dl className="seer-facts">
      <div><dt>原物编号</dt><dd>{tool.id}</dd></div>
      <div><dt>原主人</dt><dd>{tool.owner}</dd></div>
      <div><dt>当前持有／保管</dt><dd>{tool.custodian}</dd></div>
      <div><dt>已知位置</dt><dd>{tool.location}</dd></div>
      <div><dt>原物记录版本</dt><dd>{tool.version}</dd></div>
    </dl>
    <p className="slice-muted">借用、取消准备与实际归还是不同的记录。借用不转移所有权；这里显示已提交的去向。</p>
  </section>;
}

/** Other-pathway history has no mutation callback or actionable controls. */
export function WarriorHistory({ warrior, advanced = false, currentTitle = "格斗家" }: { warrior: WarriorProjection; advanced?: boolean; currentTitle?: string }) {
  const title = advanced ? "战士时期的经历" : "战士渠道经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">{advanced ? `你已晋升${currentTitle}。战士时期的原观察、练习报告、原短棍归属、原瓶和能力掌握保留在这里；当前实践请回到${currentTitle}卷宗。` : "已选择其它途径，这份战士渠道只供回看。"}</p>
    {advanced && <p>战士扮演进度 {warrior.acting} · {warrior.digestion}</p>}
    {warrior.story && <p>{warrior.story}</p>}
    {warrior.supplies && <p>{warrior.supplies}</p>}
    {warrior.environment && <p>{warrior.environment}</p>}
    <ToolRecord tool={warrior.tool} />
    {warrior.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {warrior.bottles.length > 0 && <details className="seer-fold" open>
      <summary>战士原瓶 · 来源与去向</summary>
      {warrior.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {warrior.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {warrior.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: WarriorAction): boolean {
  return "caseId" in action.command;
}

interface WarriorPanelProps {
  warrior: WarriorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: WarriorCommand) => void;
}

/** Only committed public facts can change ownership, custody, preparation or reports. */
export function WarriorPanel({ warrior, resources, busy, blocked, readOnly = false, onCommand }: WarriorPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => warrior.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = warrior.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = warrior.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = warrior.actions.filter(isCaseAction);
  const selectedCase = warrior.cases.find((entry) => entry.id === selectedCaseId)
    ?? warrior.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? warrior.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = warrior.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = warrior.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : warrior.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (!selectedCaseId && selectedCase) setSelectedCaseId(selectedCase.id);
  }, [selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !warrior.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || warrior.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, warrior.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: WarriorAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || warrior.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: WarriorAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `warrior-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`warrior-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <WarriorHistory warrior={warrior} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶战士魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="战士服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{warrior.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{warrior.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="warrior-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "warrior-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="战士成长下一步">
        <span className="seer-seal">{warrior.promoted ? "序列 9" : "战士成长卷宗"}</span>
        <h3>{warrior.title}</h3>
        {readOnly ? (
          <p className="seer-next">已选择其它途径，这份战士渠道只供回看。</p>
        ) : warrior.promoted && warrior.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的作业与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{warrior.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{warrior.digestion}</p>
        {!warrior.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">取得渠道或晋升不会自动加入任何家族或组织。原工具归属与当前持有分别记录，借用不会自动加入随身装备。</p>
      </section>

      {warrior.promoted && <section className="slice-notice warrior-environment" aria-label="现场、协作与原工具去向">
        <h4>现场、协作与原工具去向</h4>
        <p>{warrior.environment || "尚未取得现场公开记录；作业条件、工具去向与本次结果须经实际观察和行动确认。"}</p>
      </section>}

      <ToolRecord tool={warrior.tool} />

      {selectedCase && (
        <section aria-label="战士有限作业">
          <h3>现场观察与有限作业</h3>
          <label className="seer-case-selector">
            选择当前作业
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {warrior.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前战士作业">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；协作条件、工具记录与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的作业、归还与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="作业范围与工具归还">
              <h4>作业范围与工具归还</h4>
              <p>先观察原现场，再选择力量／武器练习或普通团队方法。准备、实际作业、归还工具与报告分别提交，成本与限制见按钮。</p>
              <p className="slice-muted">力量用于眼前有限任务，训练使用原主人的练习棍。取消准备不会替你归还已经借到的工具；实际归还之前，持有记录仍会保留。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="实际执行与报告记录" aria-live="polite" aria-atomic="true">
              <h4>实际执行与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前战士作业行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="战士成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {warrior.story && <p className="slice-muted">{warrior.story}</p>}

      {warrior.discovered && <section className="slice-notice warrior-source" aria-label="战士成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用公开渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {warrior.supplies && <p>{warrior.supplies}</p>}
      </section>}
      {warrior.discovered && warrior.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!warrior.promoted}>
          <summary>导师的独立成品原瓶 · 来源与去向</summary>
          {warrior.bottles.map((bottle) => {
            const action = warrior.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !warrior.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !warrior.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `warrior-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`warrior-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {warrior.discovered && !warrior.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{warrior.risk}</p></details>}
      {warrior.promoted && (
        <section className="warrior-abilities" aria-label="战士能力与消化">
          <h3>能力与消化 · {warrior.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列9练习体魄与普通武器的有限运用。能力、掌握与边界以已公开记录为准。</p>
          <p>扮演进度 {warrior.acting} · 消化：{warrior.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {warrior.pollution}</p>
          {warrior.abilities.map((ability) => (
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
