import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { InstigatorAction, InstigatorCommand, InstigatorProjection } from "../domain/instigator/types";
import type { AssassinProjection } from "../domain/assassin/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原有不满、证据与当事人反应",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际尝试，等待处理后果并报告",
  RESOLVED: "已处理实际后果并完成本次报告",
};
/** The inherited S9 dossier is a read-only record, including the same original draft. */
export function InstigatorAssassinHistory({ assassin }: { assassin: AssassinProjection }) {
  const status: Record<string, string> = {
    AVAILABLE: "尚未观察", OBSERVED: "已观察现场与能力边界", PREPARED: "已选定方法并完成准备",
    EXAMINED: "已实际检验，请核对结果与原位置", RESOLVED: "已提交本次实践报告",
  };
  return <section className="seer-panel warrior-panel" aria-label="刺客时期的经历">
    <h3>刺客时期的经历</h3>
    <p className="slice-notice">你已晋升教唆者。这里保留刺客时期的原观察、实际方法、往返与原稿记录、原瓶来源和能力掌握；当前实践请回到教唆者卷宗。</p>
    <p>刺客扮演进度 {assassin.acting} · {assassin.digestion}</p>
    {assassin.story && <p>{assassin.story}</p>}
    {assassin.environment && <p className="slice-muted">{assassin.environment}</p>}
    {assassin.draft && <section className="seer-fold" aria-label="练习原稿的归属与持有">
      <h4>练习原稿 · 当前公开记录</h4>
      <dl className="seer-facts">
        <div><dt>原物编号</dt><dd>{assassin.draft.id}</dd></div>
        <div><dt>原主人</dt><dd>{assassin.draft.owner}</dd></div>
        <div><dt>当前持有／保管</dt><dd>{assassin.draft.custodian}</dd></div>
        <div><dt>已知位置</dt><dd>{assassin.draft.location}</dd></div>
        <div><dt>原物记录版本</dt><dd>{assassin.draft.version}</dd></div>
      </dl>
      <p className="slice-muted">原稿归属与实际保管分别记录；晋升不会自动转移原物或改写原报告。</p>
    </section>}
    {assassin.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {status[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p>记录位置：{entry.position}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {assassin.supplies && <p className="slice-muted">{assassin.supplies}</p>}
    {assassin.bottles.length > 0 && <details className="seer-fold"><summary>刺客原瓶 · 来源与去向</summary>
      {assassin.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {assassin.abilities.length > 0 && <details className="seer-fold"><summary>已继承的刺客能力</summary>
      {assassin.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: InstigatorAction): boolean {
  return "caseId" in action.command;
}

interface InstigatorPanelProps {
  instigator: InstigatorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: InstigatorCommand) => void;
}

/** Tension, consequences, costs and results come only from the committed public projection. */
export function InstigatorPanel({ instigator, resources, busy, blocked, onCommand }: InstigatorPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = instigator.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = instigator.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = instigator.actions.filter(isCaseAction);
  const settleAction = caseActions.find((action) => action.command.type === "SETTLE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "SETTLE");
  const settleCaseId = settleAction?.command.type === "SETTLE" ? settleAction.command.caseId : null;
  const heatedCase = instigator.insideCase ? instigator.cases.find((scene) => scene.id === settleCaseId) : undefined;
  const selectedCase = heatedCase ?? instigator.cases.find((scene) => scene.id === selectedCaseId)
    ?? instigator.cases.find((scene) => scene.status === "EXAMINED")
    ?? instigator.cases.find((scene) => scene.status === "OBSERVED" || scene.status === "PREPARED")
    ?? instigator.cases.find((scene) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === scene.id))
    ?? instigator.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = instigator.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const settleActions = caseActions.filter((action) => action.command.type === "SETTLE"
    && (!heatedCase || action.command.caseId === heatedCase.id));
  const nextAction = instigator.insideCase
    ? settleActions.find((action) => action.enabled) ?? settleActions[0]
    : instigator.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : instigator.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !instigator.promoted && !instigator.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (heatedCase) setSelectedCaseId(heatedCase.id);
    else if (!selectedCaseId && selectedCase) setSelectedCaseId(selectedCase.id);
  }, [heatedCase, selectedCaseId, selectedCase]);

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || instigator.promoted || instigator.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, instigator.promoted, instigator.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: InstigatorAction) {
    if (busy || blocked || !action.enabled || instigator.insideCase || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || instigator.promoted || instigator.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: InstigatorAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className={action.command.type === "SETTLE" ? "slice-choice primary" : "slice-choice"}
          disabled={busy || blocked || !action.enabled || (instigator.insideCase && action.command.type !== "SETTLE")}
          onClick={() => {
            if (busy || blocked || !action.enabled || (instigator.insideCase && action.command.type !== "SETTLE")) return;
            // Keep the acted-on scene visible when its committed result makes it resolved.
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `instigator-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`instigator-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel instigator-panel seer-confirmation" aria-label="这瓶教唆者魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="教唆者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{instigator.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{instigator.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="instigator-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "instigator-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel instigator-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="教唆者成长下一步">
        <span className="seer-seal">{instigator.promoted ? "序列 8" : "教唆者晋升卷宗"}</span>
        <h3>{instigator.title}</h3>
        {!instigator.insideCase && instigator.promoted && instigator.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的尝试、后果与报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{instigator.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{instigator.digestion}</p>
        {!instigator.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成刺客消化与成熟时间，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("教唆者利用已经存在的恶欲、不满或矛盾施加有限影响；对方仍可抵抗或拒绝。新的独立成品渠道不公开未核实的配方，也不建立组织身份。渠道和具体情境属于游戏设定（G）。")}</p>
      </section>

      {instigator.insideCase && <section className="slice-notice instigator-settle" aria-label="立即停止挑动并退开">
        <h3>先停止挑动并退开</h3>
        <p>本次尝试已经使争执升温。请先停止自己的挑动并退开，再报告或安排其它事务；这一步为0行动，不再消耗灵性，灵性或行动耗尽时仍可执行。它不会抹去此前的影响或已付成本，也不保证对方冷静、原谅或服从。</p>
        <div className="seer-actions" role="group" aria-label="零行动停止挑动">{settleActions.map(actionButton)}</div>
      </section>}

      {instigator.promoted && <section className="slice-notice instigator-environment" aria-label="已知实践环境">
        <h4>已知实践环境</h4>
        <p>{instigator.environment || "现场尚未确认，请先观察原有争议、实际证据与当事人反应。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="教唆者实践记录">
          <h3>有限影响与实际后果</h3>
          <p className="slice-muted">先观察当事人已有的不满与现场事实，再选择教唆或普通核对沟通。已经使争执升温时，必须先实际停止挑动并退开，之后再报告；取消或退出不会退回已支付的行动、灵性或费用，也不会自动消除后果。</p>
          <label className="seer-case-selector">
            选择社会情境
            <select value={selectedCase.id} disabled={busy || blocked || instigator.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {instigator.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? scene.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前社会情境">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="seer-fold instigator-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。原有矛盾、当事人意愿与本次行动结果仍未确认。</p>}
            </section>
            <section className="instigator-preparation" aria-label="实际方法与准备">
              <h4>实际方法与准备</h4>
              <p>{selectedCase.preparation || "当前没有待执行的准备；本次影响以实际结果为准，不会自动改变当事人的意图。"}</p>
            </section>
            <p className="slice-muted">争执状态：{selectedCase.tension}</p>
            {selectedCase.status === "EXAMINED" && <p className="slice-notice">尝试已有实际结果。请核对本人是否已实际停止挑动并退开，再提交本次报告；尚未完成报告与奖励结算。</p>}
            {selectedCase.result && <section className="slice-notice instigator-result" aria-label="实际实践结果"><h4>实际实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="seer-actions" role="group" aria-label="当前情境行动">{selectedCaseActions.filter((action) => !instigator.insideCase || action.command.type !== "SETTLE").map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="教唆者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {instigator.story && <p className="slice-muted instigator-source">{instigator.story}</p>}

      {instigator.discovered && instigator.supplies && <p className="slice-notice">{instigator.supplies}</p>}
      {instigator.discovered && instigator.bottles.length > 0 && (
        <details className="seer-fold instigator-bottles" open={!instigator.promoted}>
          <summary>教唆者独立成品原瓶 · 来源与去向</summary>
          {instigator.bottles.map((bottle) => {
            const action = instigator.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !instigator.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !instigator.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || instigator.insideCase || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `instigator-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`instigator-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {instigator.discovered && !instigator.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{instigator.risk}</p></details>}
      {instigator.promoted && (
        <section className="instigator-abilities" aria-label="教唆者能力与消化">
          <h3>能力与消化 · {instigator.abilities.length} 项能力</h3>
          <p className="slice-muted">原有刺客能力与掌握记录继续继承。教唆只影响已有欲望或矛盾，不会凭空制造动机，不读心，也不保证对方服从。普通核对与沟通同样可完成实践；已经发生的冲突须先实际停止本人挑动并退开；这不保证对方冷静或原谅。序列7女巫的身体变化、隐身和黑焰尚未开放。</p>
          <p>扮演进度 {instigator.acting} · 消化：{instigator.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {instigator.pollution}</p>
          {instigator.abilities.map((ability) => (
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
