import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ShadowAsceticAction, ShadowAsceticCommand, ShadowAsceticProjection } from "../domain/shadow-ascetic/types";
import type { ListenerProjection } from "../domain/listener/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察阴影、阻碍与普通退路",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已有实际结果，请核对显形与退出",
  RESOLVED: "已实际退出并完成有限报告",
};
/** Earlier listening records remain visible without a mutation callback. */
export function ListenerHistory({ listener }: { listener: ListenerProjection }) {
  const status: Record<string, string> = {
    AVAILABLE: "尚未观察", OBSERVED: "已观察现场与普通退路", PREPARED: "已选定方法并完成准备",
    EXAMINED: "已实际检验，请先退出并普通核实", RESOLVED: "已完成核实与有限报告",
  };
  return <section className="seer-panel listener-panel" aria-label="倾听者时期的经历">
    <h3>倾听者时期的经历</h3>
    <p className="slice-notice">这里保留倾听者时期的原观察、有限耳语、实际离开、普通核实与报告、原瓶来源和能力掌握，只供回看。</p>
    <p>倾听者扮演进度 {listener.acting} · {listener.digestion}</p>
    {listener.story && <p>{listener.story}</p>}
    {listener.environment && <p>{listener.environment}</p>}
    {listener.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {status[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      <p>本次接触：{entry.contactOpen}</p>
      <p>普通核实：{entry.verified ? "已完成本次普通核实" : "尚未完成本次普通核实"}</p>
      <p>过度断言记录：{entry.overclaims}</p>
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {listener.supplies && <p>{listener.supplies}</p>}
    {listener.bottles.length > 0 && <details className="seer-fold"><summary>倾听者原瓶 · 来源与去向</summary>
      {listener.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {listener.abilities.length > 0 && <details className="seer-fold"><summary>已继承的倾听者能力</summary>
      {listener.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: ShadowAsceticAction): boolean {
  return "caseId" in action.command;
}

interface ShadowAsceticPanelProps {
  shadowAscetic: ShadowAsceticProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: ShadowAsceticCommand) => void;
}

/** Practice state and actual concealment are separate committed public facts. */
export function ShadowAsceticPanel({ shadowAscetic, resources, busy, blocked, onCommand }: ShadowAsceticPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => shadowAscetic.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = shadowAscetic.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = shadowAscetic.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = shadowAscetic.actions.filter(isCaseAction);
  const revealAction = caseActions.find((action) => action.command.type === "REVEAL" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "REVEAL");
  const revealCaseId = revealAction?.command.type === "REVEAL" ? revealAction.command.caseId : null;
  const openCase = shadowAscetic.insideCase ? shadowAscetic.cases.find((scene) => scene.id === revealCaseId) : undefined;
  const selectedCase = openCase ?? shadowAscetic.cases.find((scene) => scene.id === selectedCaseId)
    ?? shadowAscetic.cases.find((scene) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === scene.id))
    ?? shadowAscetic.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = shadowAscetic.insideCase ? [] : shadowAscetic.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const revealActions = caseActions.filter((action) => action.command.type === "REVEAL"
    && (!openCase || action.command.caseId === openCase.id));
  const nextAction = shadowAscetic.insideCase
    ? revealActions.find((action) => action.enabled) ?? revealActions[0]
    : shadowAscetic.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : shadowAscetic.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !shadowAscetic.promoted && !shadowAscetic.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (openCase) setSelectedCaseId(openCase.id);
    else if (!selectedCaseId && selectedCase) setSelectedCaseId(selectedCase.id);
  }, [openCase, selectedCaseId, selectedCase]);

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || shadowAscetic.promoted || shadowAscetic.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, shadowAscetic.promoted, shadowAscetic.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ShadowAsceticAction) {
    if (busy || blocked || !action.enabled || shadowAscetic.insideCase || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || shadowAscetic.promoted || shadowAscetic.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: ShadowAsceticAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className={action.command.type === "REVEAL" ? "slice-choice primary" : "slice-choice"}
          disabled={busy || blocked || !action.enabled || (shadowAscetic.insideCase && action.command.type !== "REVEAL")}
          onClick={() => {
            if (busy || blocked || !action.enabled || (shadowAscetic.insideCase && action.command.type !== "REVEAL")) return;
            // Keep the acted-on scene visible when its committed result makes it resolved.
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `shadowAscetic-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`shadowAscetic-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel shadowAscetic-panel seer-confirmation" aria-label="这瓶隐修士魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="隐修士服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{shadowAscetic.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{shadowAscetic.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="shadowAscetic-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "shadowAscetic-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel shadowAscetic-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="隐修士成长下一步">
        <span className="seer-seal">{shadowAscetic.promoted ? "序列 7" : "隐修士晋升卷宗"}</span>
        <h3>{shadowAscetic.title}</h3>
        {!shadowAscetic.insideCase && shadowAscetic.promoted && shadowAscetic.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的藏匿、显形退出与报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{shadowAscetic.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{shadowAscetic.digestion}</p>
        {!shadowAscetic.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先达到倾听者消化100并度过序列8的八个完整周，再独立确认服用本次原瓶。</p>}
        <p className="slice-muted">{playerText("阴影藏匿不等于物理免疫、穿墙、瞬移或绝对隐形。灯位与现场条件变化可能暴露真实身体，即使已经暴露，也仍须实际结束本次实践并由普通退路离开。本页的指导者、成品渠道、情境和数值为游戏设定（G）；晋升不自动加入组织。")}</p>
      </section>

      {shadowAscetic.insideCase && <section className="slice-notice shadowAscetic-exit" aria-label="立即显形并退出本次实践">
        <h3>先实际显形并退出本次实践</h3>
        <p>本次阴影实践仍未结束，不代表当前身体仍被藏住。无论此前成功、失败或灯位移动后暴露，都请先停止藏匿、实际显形，并沿普通退路离开；0行动、0灵性，精神或行动为0时仍可执行。已有结果和成本继续保留。</p>
        <div className="seer-actions" role="group" aria-label="零行动显形并退出">{revealActions.map(actionButton)}</div>
      </section>}

      {shadowAscetic.promoted && <section className="slice-notice shadowAscetic-environment" aria-label="已知实践环境">
        <h4>已知实践环境</h4>
        <p>{shadowAscetic.environment || "现场尚未确认，请先观察灯位、可用阴影、实际阻碍与普通退路。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="隐修士有限阴影实践">
          <h3>有限阴影藏匿、实际显形与普通退出</h3>
          <p className="slice-muted">{playerText("先观察现场，再从当前公开方法中选择阴影藏匿或普通方法。没有可用阴影时使用普通方法；藏匿不会让堵塞路线通行，也不会移动身体穿过障碍。准备、实际尝试、显形退出和报告分别提交；退出准备不能替代实际退出。普通方法与练习情境均为游戏设定（G）。")}</p>
          <label className="seer-case-selector">
            选择阴影实践
            <select value={selectedCase.id} disabled={busy || blocked || shadowAscetic.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {shadowAscetic.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前阴影实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="seer-fold shadowAscetic-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。阴影、灯位、路线和本次行动结果仍未确认；不会提前补出可用条件或成功结果。</p>}
            </section>
            <section className="shadowAscetic-preparation" aria-label="实际方法与准备">
              <h4>实际方法与准备</h4>
              <p>{selectedCase.preparation || "当前没有待执行的准备；观察、方法、实际尝试、显形退出与报告分别提交，不会自动生成结果。"}</p>
            </section>
            <p className="slice-muted">本次实践：{selectedCase.shadowOpen}</p>
            <p className="slice-muted">当前藏匿：{selectedCase.hidden ? "已藏入本次阴影" : "未处于阴影藏匿"}</p>
            {selectedCase.status === "EXAMINED" && <p className="slice-notice">实践已有实际结果。请先核对显形与普通退出是否完成，再提交有限报告；已经暴露身体不等于已退出本次实践。</p>}
            {selectedCase.result && <section className="slice-notice shadowAscetic-result" aria-label="实际实践结果"><h4>实际实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="seer-actions" role="group" aria-label="当前情境行动">{(!shadowAscetic.insideCase ? selectedCaseActions : []).map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="隐修士成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {shadowAscetic.story && <p className="slice-muted shadowAscetic-source">{shadowAscetic.story}</p>}

      {shadowAscetic.discovered && <section className="slice-notice" aria-label="隐修士成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用独立成品原瓶，不提供未核材料或调配。每瓶来源、劳动与供应条件以公开记录为准。")}</p>
        {shadowAscetic.supplies && <p>{shadowAscetic.supplies}</p>}
      </section>}
      {shadowAscetic.discovered && shadowAscetic.bottles.length > 0 && (
        <details className="seer-fold shadowAscetic-bottles" open={!shadowAscetic.promoted}>
          <summary>隐修士独立成品原瓶 · 来源与去向</summary>
          {shadowAscetic.bottles.map((bottle) => {
            const action = shadowAscetic.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !shadowAscetic.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !shadowAscetic.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || shadowAscetic.insideCase || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `shadowAscetic-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`shadowAscetic-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {shadowAscetic.discovered && !shadowAscetic.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{shadowAscetic.risk}</p></details>}
      {shadowAscetic.promoted && (
        <section className="shadowAscetic-abilities" aria-label="隐修士能力与消化">
          <h3>能力与消化 · {shadowAscetic.abilities.length} 项能力</h3>
          <p className="slice-muted">秘祈人与倾听者时期的原记录、能力掌握和消化继续保留。隐修士只开放本阶段有限阴影藏匿，不提供物理免疫、穿墙或瞬移；本体仍在原处且可能被发现或受伤，不提前开放序列6血肉魔法或序列5放牧。</p>
          <p>扮演进度 {shadowAscetic.acting} · 消化：{shadowAscetic.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {shadowAscetic.pollution}</p>
          {shadowAscetic.abilities.map((ability) => (
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
