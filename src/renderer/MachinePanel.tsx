import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { MachineAction, MachineCommand, MachineProjection } from "../domain/machine/types";
import type { MonsterProjection } from "../domain/monster/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与有限条件",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际执行，请核对估计与实测",
  RESOLVED: "已提交本次实践报告",
};

/** The inherited S9 history has no mutation callback or actionable controls. */
export function MachineMonsterHistory({ monster }: { monster: MonsterProjection }) {
  const title = "怪物时期的经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">你已晋升机器。这里保留怪物时期的片段、普通核实、实际结束、原报告与原瓶来源，只供回看。</p>
    <p>怪物扮演进度 {monster.acting} · 消化：{monster.digestion}</p>
    {monster.story && <p>{monster.story}</p>}
    {monster.supplies && <p>{monster.supplies}</p>}
    {monster.environment && <p>{monster.environment}</p>}
    {monster.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status === "EXAMINED" ? "已实际记录，请核对片段与现场" : CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次观察接触：{entry.contactOpen} · 实际结束次数：{entry.closes} · 过度断言记录：{entry.overclaims}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {monster.bottles.length > 0 && <details className="seer-fold" open>
      <summary>怪物原瓶 · 来源与去向</summary>
      {monster.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {monster.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {monster.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: MachineAction): boolean {
  return "caseId" in action.command;
}

interface MachinePanelProps {
  machine: MachineProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: MachineCommand) => void;
}

/** Only committed public facts change practice, computed estimates, measured results, or reports. */
export function MachinePanel({ machine, resources, busy, blocked, onCommand }: MachinePanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => machine.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = machine.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = machine.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = machine.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open practice; prose and old results never create a lock.
  const closeAction = machine.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? machine.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (machine.insideCase ? machine.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? machine.cases.find((entry) => entry.id === selectedCaseId)
    ?? machine.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? machine.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!machine.insideCase || action.command.type === "CLOSE")) : [];
  const actions = machine.insideCase ? [] : machine.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = machine.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : machine.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : machine.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (machine.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [machine.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !machine.promoted && !machine.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || machine.promoted || machine.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, machine.promoted, machine.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: MachineAction) {
    if (busy || blocked || machine.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || machine.promoted || machine.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: MachineAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => { if (!busy && !blocked && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `machine-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`machine-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶机器魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="机器服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{machine.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{machine.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="machine-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "machine-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="机器成长下一步">
        <span className="seer-seal">{machine.promoted ? "序列 8" : "机器成长卷宗"}</span>
        <h3>{machine.title}</h3>
        {machine.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次实践：</strong>{nextLabel || "查看当前公开结束选项"}。结束不消耗行动或灵性，0精神时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原计算、实测、有限问题与报告继续保留。</p>
        ) : machine.promoted && machine.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{machine.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{machine.digestion}</p>
        {!machine.promoted && <p className="slice-muted">需先完成怪物100消化与四个完整序列9周。晋升准备和待执行准备期间仍可工作、调查或休养；成功晋升后仍沿命运之轮途径成长。</p>}
        <p className="slice-muted">{playerText("取得渠道或晋升不会自动加入组织。成年指导者艾妲·芬恩、成品供给、三项具体实践与数值为本作原创G。以已知输入计算、实测复核并遵守问题范围是本阶段G扮演解释；计算能力、精确控制与身体天赋、占卜及反占卜仍受现实条件与已知信息限制。")}</p>
      </section>

      {machine.promoted && <section className="slice-notice warrior-environment" aria-label="现场与当前实践">
        <h4>现场与当前实践</h4>
        <p>{machine.environment || "尚未取得现场公开记录；输入条件、计算估计、实际测量与有限问题须经实际行动分别确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="机器有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || machine.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {machine.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前机器实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次实践：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；原工具、已知输入、同意范围与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的计算、实测、实际结束与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="计算、实测与有限问题边界">
              <h4>计算、实测与有限问题边界</h4>
              <p>先观察原现场，再选择公开的能力方法或普通方法。计算估计与实际测量是不同的记录，估计不能代替实测；只有实际提交后的公开记录才会显示。准备、执行、实际结束与报告分别提交，成本与限制以公开按钮为准。</p>
              <p className="slice-muted">占卜与反占卜只围绕本人自愿提出的有限问题，不会确定另一人的想法或补齐未知事实。本次实践尚未结束时，先执行公开的结束动作，再做其它事务；失败也须实际结束。结束不另抽随机、不奖励、不退款、不治疗，原结果与报告继续保留。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="计算估计、实测与有限报告" aria-live="polite" aria-atomic="true">
              <h4>计算估计、实测与有限报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前机器实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="机器成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {machine.story && <p className="slice-muted">{machine.story}</p>}

      {machine.discovered && <section className="slice-notice warrior-source" aria-label="机器成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {machine.supplies && <p>{machine.supplies}</p>}
      </section>}
      {machine.discovered && machine.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!machine.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {machine.bottles.map((bottle) => {
            const action = machine.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !machine.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !machine.promoted && !machine.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `machine-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`machine-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {machine.discovered && !machine.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{machine.risk}</p></details>}
      {machine.promoted && (
        <section className="warrior-abilities" aria-label="机器能力与消化">
          <h3>能力与消化 · {machine.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列8拥有计算能力、精确控制与身体天赋，并可学习占卜与反占卜。能力、掌握与边界以已公开记录为准；没有无限记忆、自动制造、必定命中、全知或幸运控制，也不保证每次问题都得到答案。</p>
          <p>扮演进度 {machine.acting} · 消化：{machine.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {machine.pollution}</p>
          {machine.abilities.map((ability) => (
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
