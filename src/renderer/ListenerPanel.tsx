import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ListenerAction, ListenerCommand, ListenerProjection } from "../domain/listener/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与普通退路",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际检验，请先退出并普通核实",
  RESOLVED: "已完成核实与有限报告",
};
function isCaseAction(action: ListenerAction): boolean {
  return "caseId" in action.command;
}

interface ListenerPanelProps {
  listener: ListenerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: ListenerCommand) => void;
}

/** Exposure, voice fragments and verification are only committed public facts. */
export function ListenerPanel({ listener, resources, busy, blocked, onCommand }: ListenerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => listener.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = listener.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = listener.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = listener.actions.filter(isCaseAction);
  const leaveAction = caseActions.find((action) => action.command.type === "LEAVE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "LEAVE");
  const leaveCaseId = leaveAction?.command.type === "LEAVE" ? leaveAction.command.caseId : null;
  const openCase = listener.insideCase ? listener.cases.find((scene) => scene.id === leaveCaseId) : undefined;
  const selectedCase = openCase ?? listener.cases.find((scene) => scene.id === selectedCaseId)
    ?? listener.cases.find((scene) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === scene.id))
    ?? listener.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = listener.insideCase ? [] : listener.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const leaveActions = caseActions.filter((action) => action.command.type === "LEAVE"
    && (!openCase || action.command.caseId === openCase.id));
  const nextAction = listener.insideCase
    ? leaveActions.find((action) => action.enabled) ?? leaveActions[0]
    : listener.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : listener.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !listener.promoted && !listener.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (openCase) setSelectedCaseId(openCase.id);
    else if (!selectedCaseId && selectedCase) setSelectedCaseId(selectedCase.id);
  }, [openCase, selectedCaseId, selectedCase]);

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || listener.promoted || listener.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, listener.promoted, listener.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ListenerAction) {
    if (busy || blocked || !action.enabled || listener.insideCase || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || listener.promoted || listener.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: ListenerAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className={action.command.type === "LEAVE" ? "slice-choice primary" : "slice-choice"}
          disabled={busy || blocked || !action.enabled || (listener.insideCase && action.command.type !== "LEAVE")}
          onClick={() => {
            if (busy || blocked || !action.enabled || (listener.insideCase && action.command.type !== "LEAVE")) return;
            // Keep the acted-on scene visible when its committed result makes it resolved.
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `listener-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`listener-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel listener-panel seer-confirmation" aria-label="这瓶倾听者魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="倾听者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{listener.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{listener.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="listener-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "listener-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel listener-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="倾听者成长下一步">
        <span className="seer-seal">{listener.promoted ? "序列 8" : "倾听者晋升卷宗"}</span>
        <h3>{listener.title}</h3>
        {!listener.insideCase && listener.promoted && listener.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的倾听、退出、核实与报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{listener.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{listener.digestion}</p>
        {!listener.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先达到秘祈人消化100并度过序列9的四个完整周，再独立确认服用本次原瓶。</p>}
        <p className="slice-muted">{playerText("直接听到对应隐秘存在的耳语，不等于可靠理解或证明真相。可能获得的独特或扭曲力量不是自动赐予，也不是通用法术。本页的指导者、成品渠道、情境和数值为游戏设定（G）；晋升不自动加入组织。")}</p>
      </section>

      {listener.insideCase && <section className="slice-notice listener-exit" aria-label="立即离开本次倾听位置">
        <h3>先实际离开本次倾听位置</h3>
        <p>你仍在本次倾听位置。无论此前成功或失败，都请先实际离开，再核实、报告或安排其它事务；离开为0行动、0灵性，精神为0时仍可执行。离开只结束本次主动接触，不能保证免受未知影响；已有结果和成本继续保留。</p>
        <div className="seer-actions" role="group" aria-label="零行动离开倾听位置">{leaveActions.map(actionButton)}</div>
      </section>}

      {listener.promoted && <section className="slice-notice listener-environment" aria-label="已知实践环境">
        <h4>已知实践环境</h4>
        <p>{listener.environment || "现场尚未确认，请先观察声音的可知来源、普通记录与退路。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="倾听者有限实践">
          <h3>有限倾听、实际离开与普通核实</h3>
          <p className="slice-muted">先观察现场，再选择有限倾听或普通方法。听到的片段与来源推测须分别记录，实际离开后再用普通证据核实；退出准备不能替代离开。未知内容不补齐，错误的确定断言可以更正，但原记录继续保留。</p>
          <label className="seer-case-selector">
            选择倾听情境
            <select value={selectedCase.id} disabled={busy || blocked || listener.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {listener.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前倾听情境">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="seer-fold listener-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。声音、来源与本次行动结果仍未确认；不会提前补出耳语内容。</p>}
            </section>
            <section className="listener-preparation" aria-label="实际方法与准备">
              <h4>实际方法与准备</h4>
              <p>{selectedCase.preparation || "当前没有待执行的准备；观察、方法、检验、离开、普通核实与报告分别提交，不会自动生成结果。"}</p>
            </section>
            <p className="slice-muted">本次接触：{selectedCase.contactOpen}</p>
            <p className="slice-muted">普通核实：{selectedCase.verified ? "已完成本次普通核实" : "尚未完成本次普通核实"}</p>
            <p className="slice-muted">过度断言记录：{selectedCase.overclaims}</p>
            {selectedCase.status === "EXAMINED" && <p className="slice-notice">检验已有实际结果。请先核对是否已实际离开，再进行普通核实并提交报告；听到不等于已查明真相。</p>}
            {selectedCase.result && <section className="slice-notice listener-result" aria-label="实际实践结果"><h4>实际实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="seer-actions" role="group" aria-label="当前情境行动">{(!listener.insideCase ? selectedCaseActions : []).map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="倾听者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {listener.story && <p className="slice-muted listener-source">{listener.story}</p>}

      {listener.discovered && <section className="slice-notice" aria-label="倾听者成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用独立成品原瓶，不提供未核材料或调配。每瓶来源、劳动与供应条件以公开记录为准。")}</p>
        {listener.supplies && <p>{listener.supplies}</p>}
      </section>}
      {listener.discovered && listener.bottles.length > 0 && (
        <details className="seer-fold listener-bottles" open={!listener.promoted}>
          <summary>倾听者独立成品原瓶 · 来源与去向</summary>
          {listener.bottles.map((bottle) => {
            const action = listener.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !listener.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !listener.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || listener.insideCase || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `listener-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`listener-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {listener.discovered && !listener.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{listener.risk}</p></details>}
      {listener.promoted && (
        <section className="listener-abilities" aria-label="倾听者能力与消化">
          <h3>能力与消化 · {listener.abilities.length} 项能力</h3>
          <p className="slice-muted">秘祈人时期的能力与原掌握记录继续保留。有限耳语与可能的力量须受实际来源约束，不能自动成为真相、战斗增益或人人相同的法术。离开不保证免受未知影响；不提前开放隐修士、血肉魔法或放牧，也不用游戏异常接触解释现实心理症状。</p>
          <p>扮演进度 {listener.acting} · 消化：{listener.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {listener.pollution}</p>
          {listener.abilities.map((ability) => (
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
