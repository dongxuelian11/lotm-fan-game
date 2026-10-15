import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { MadmanAction, MadmanCommand, MadmanProjection } from "../domain/madman/types";
import type { PrisonerProjection } from "../domain/prisoner/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与能力边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际执行，请先停止并核对结果",
  RESOLVED: "已提交本次实践报告",
};

/** Other-pathway history has no mutation callback or actionable controls. */
export function MadmanHistory({ madman }: { madman: MadmanProjection }) {
  const title = "疯子渠道经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">这里保留疯子时期的渠道、原瓶与实践记录，只供回看；当前成长请查看对应卷宗。</p>
    {madman.story && <p>{madman.story}</p>}
    {madman.supplies && <p>{madman.supplies}</p>}
    {madman.environment && <p>{madman.environment}</p>}
    {madman.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">当前尝试：{entry.burstOpen} · 实际停止次数：{entry.stops} · 实际强化次数：{entry.burstUses}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {madman.bottles.length > 0 && <details className="seer-fold" open>
      <summary>疯子原瓶 · 来源与去向</summary>
      {madman.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {madman.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {madman.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

/** Other-pathway history has no mutation callback or actionable controls. */
export function MadmanPrisonerHistory({ prisoner }: { prisoner: PrisonerProjection }) {
  const title = "囚犯时期的经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">你已晋升疯子。这里保留囚犯时期的观察、准备、原木垫块借还、实际结果与原瓶来源，只供回看。</p>
    <p>囚犯扮演进度 {prisoner.acting} · 消化：{prisoner.digestion}</p>
    {prisoner.story && <p>{prisoner.story}</p>}
    {prisoner.supplies && <p>{prisoner.supplies}</p>}
    {prisoner.environment && <p>{prisoner.environment}</p>}
    {prisoner.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status === "EXAMINED" ? "已实际执行，请核对原物与结果" : CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">原物去向：{entry.holding} · 实际归还次数：{entry.returns}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {prisoner.bottles.length > 0 && <details className="seer-fold" open>
      <summary>囚犯原瓶 · 来源与去向</summary>
      {prisoner.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {prisoner.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {prisoner.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: MadmanAction): boolean {
  return "caseId" in action.command;
}

interface MadmanPanelProps {
  madman: MadmanProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: MadmanCommand) => void;
}

/** Only committed public facts change the actual open attempt, chosen method, or report. */
export function MadmanPanel({ madman, resources, busy, blocked, readOnly = false, onCommand }: MadmanPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => madman.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = madman.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = madman.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = madman.actions.filter(isCaseAction);
  // The public STOP target identifies the actual open attempt; history and prose never create a lock.
  const stopAction = madman.actions.find((action) => action.command.type === "STOP");
  const stopCaseId = stopAction?.command.type === "STOP" ? stopAction.command.caseId : null;
  const selectedCase = (madman.insideCase ? madman.cases.find((entry) => entry.id === stopCaseId) : undefined)
    ?? madman.cases.find((entry) => entry.id === selectedCaseId)
    ?? madman.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? madman.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!madman.insideCase || action.command.type === "STOP")) : [];
  const actions = madman.insideCase ? [] : madman.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = madman.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "STOP" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "STOP")
    : madman.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : madman.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (madman.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [madman.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !madman.promoted && !madman.insideCase && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || madman.promoted || madman.insideCase || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, madman.promoted, madman.insideCase, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: MadmanAction) {
    if (busy || blocked || readOnly || madman.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || madman.promoted || madman.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: MadmanAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `madman-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`madman-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <MadmanHistory madman={madman} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶疯子魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="疯子服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{madman.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{madman.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="madman-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "madman-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="疯子成长下一步">
        <span className="seer-seal">{madman.promoted ? "序列 8" : "疯子晋升卷宗"}</span>
        <h3>{madman.title}</h3>
        {madman.insideCase ? (
          <p className="seer-next"><strong>先实际停止本次尝试：</strong>{nextLabel || "查看当前公开停止选项"}。停止不消耗行动、精神或灵性，资源全为0时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原尝试与实际强化次数继续保留。</p>
        ) : madman.promoted && madman.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{madman.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{madman.digestion}</p>
        {!madman.promoted && !readOnly && <p className="slice-muted">晋升需要囚犯100消化与四个完整序列9周。准备期间仍可工作、调查或休养；晋升不会自动加入组织。</p>}
        <p className="slice-muted">{playerText("“疯子”是虚构世界的序列名称，不对应现实诊断。主动牺牲当下理智换取短暂强化始终由你选择，普通方法也可完成实践与消化。成年指导、独立成品、三项实践及数值属于游戏设定（G）；不会强迫伤害他人或加入组织。")}</p>
      </section>

      {madman.promoted && <section className="slice-notice warrior-environment" aria-label="现场与停止边界">
        <h4>现场与停止边界</h4>
        <p>{madman.environment || "尚未取得现场公开记录；停止信号、实际方法与结果须经观察和行动确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="疯子有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || madman.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {madman.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前疯子实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">当前尝试：{selectedCase.burstOpen}</p>
            <p className="slice-muted">实际停止次数：{selectedCase.stops} · 实际强化次数：{selectedCase.burstUses}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；停止信号、具体条件与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的行动、实际停止与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="实践范围与节制边界">
              <h4>实践范围与节制边界</h4>
              <p>先观察原现场，再自主选择短暂强化（BURST）或普通方法（ORDINARY）。选择与准备不会自动执行；实际强化额外消耗10精神、2灵性，普通方法不付这笔强化成本，其他成本以公开按钮为准。</p>
              <p className="slice-muted">两种方法每次实际执行后都须单独停止，成功或失败均如此；只做准备不会开始本次尝试。实际停止不消耗资源，不治疗、不退还强化成本；停止后才能报告或继续普通生活。抵抗部分精神影响不等于免疫，也不能把普通挑衅当成精神攻击。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="实际执行与报告记录" aria-live="polite" aria-atomic="true">
              <h4>实际执行与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前疯子实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="疯子成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {madman.story && <p className="slice-muted">{madman.story}</p>}

      {madman.discovered && <section className="slice-notice warrior-source" aria-label="疯子成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {madman.supplies && <p>{madman.supplies}</p>}
      </section>}
      {madman.discovered && madman.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!madman.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {madman.bottles.map((bottle) => {
            const action = madman.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !madman.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !madman.promoted && !madman.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `madman-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`madman-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {madman.discovered && !madman.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{madman.risk}</p></details>}
      {madman.promoted && (
        <section className="warrior-abilities" aria-label="疯子能力与消化">
          <h3>能力与消化 · {madman.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列8保留囚犯时期能力，并可自主选择短暂强化，抵抗部分精神影响；能力、掌握与边界以公开记录为准。不提供序列7的狼人变化、自愈或黑暗法术。</p>
          <p>扮演进度 {madman.acting} · 消化：{madman.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {madman.pollution}</p>
          {madman.abilities.map((ability) => (
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
