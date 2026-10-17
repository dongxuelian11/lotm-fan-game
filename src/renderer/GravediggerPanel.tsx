import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { GravediggerAction, GravediggerCommand, GravediggerProjection } from "../domain/gravedigger/types";
import type { CorpsecollectorProjection } from "../domain/corpsecollector/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原现场与边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已核验，尚待报告",
  RESOLVED: "本次有限报告已交接",
};

/** Prior-sequence facts are retained without executable actions or callbacks. */
export function CorpsecollectorHistory({ corpsecollector }: { corpsecollector: CorpsecollectorProjection }) {
  return (
    <section className="seer-panel gravedigger-panel" aria-label="收尸人时期的经历">
      <h3>收尸人时期的经历</h3>
      <p className="slice-notice">你已晋升掘墓人。收尸人时期的原观察、准备、实际核验、报告与原瓶去向保留在这里，当前实践请回到掘墓人卷宗。</p>
      <p>收尸人扮演进度 {corpsecollector.acting} · {corpsecollector.digestion}</p>
      {corpsecollector.environment && <p className="slice-muted">{corpsecollector.environment}</p>}
      {corpsecollector.cases.length > 0 && <section aria-label="收尸人照料历史">
        {corpsecollector.cases.map((entry) => <details className="seer-fold" key={entry.id}>
          <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
          <p>{entry.story}</p>
          {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}>
            <h4>原观察记录</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
          </section>}
          {entry.preparation && <section aria-label={`${entry.title}的原准备`}><h4>原核验方式与准备</h4><p>{entry.preparation}</p></section>}
          {entry.result && <section aria-label={`${entry.title}的实际结果`}><h4>实际核验与报告记录</h4><p>{entry.result}</p></section>}
        </details>)}
      </section>}
      {corpsecollector.bottles.length > 0 && <details className="seer-fold">
        <summary>收尸人原瓶 · 来源与去向</summary>
        {corpsecollector.bottles.map((bottle) => <article className="gravedigger-history-bottle" key={bottle.id}>
          <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
        </article>)}
      </details>}
      {corpsecollector.abilities.length > 0 && <details className="seer-fold">
        <summary>已继承的收尸人能力</summary>
        {corpsecollector.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      </details>}
    </section>
  );
}

function isCaseAction(action: GravediggerAction): boolean {
  return "caseId" in action.command;
}

interface GravediggerPanelProps {
  gravedigger: GravediggerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: GravediggerCommand) => void;
}

/** Original records, limited findings and reports come only from the public projection. */
export function GravediggerPanel({ gravedigger, resources, busy, blocked, readOnly = false, onCommand }: GravediggerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = gravedigger.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = gravedigger.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = gravedigger.actions.filter(isCaseAction);
  const selectedCase = gravedigger.cases.find((entry) => entry.id === selectedCaseId)
    ?? gravedigger.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? gravedigger.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = gravedigger.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = gravedigger.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : gravedigger.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Neither observations nor a chosen method imply a completed examination or a true conclusion.
  const nextLabel = nextAction?.command.type === "PREPARE"
    ? "对照实际观察，从本次可用方法中选择并完成准备。"
    : nextAction?.command.type === "PERFORM"
      ? "核对方法与退路后进行有限核验，也可以退出本次准备。"
      : nextAction?.command.type === "REPORT"
        ? "根据实际核验与仍未知的部分，报告本次所见与交流边界。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !gravedigger.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || gravedigger.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, gravedigger.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: GravediggerAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || gravedigger.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: GravediggerAction) {
    return (
      <div className="seer-action gravedigger-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `gravedigger-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`gravedigger-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel gravedigger-panel seer-confirmation" aria-label="这瓶掘墓人魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="掘墓人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{gravedigger.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{gravedigger.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="gravedigger-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "gravedigger-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel gravedigger-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="掘墓人成长下一步">
        <span className="seer-seal">{gravedigger.promoted ? "序列 8" : "掘墓人成长卷宗"}</span>
        <h3>{gravedigger.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份掘墓人卷宗只供回看。</p>
        ) : gravedigger.promoted && gravedigger.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的墓园核验和有限报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{gravedigger.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{gravedigger.digestion}</p>
        {!gravedigger.promoted && !readOnly && <p className="slice-muted">需完成收尸人消化并度过四个完整周，具体成熟度和服药条件以当前公开记录为准。准备期间仍可工作、调查或休养。</p>}
        <p className="slice-muted">晋升不会自动加入教会。尊重逝者与原物的保管边界；普通核验也能推进实践。</p>
      </section>

      {gravedigger.promoted && <section className="slice-notice gravedigger-environment" aria-label="已知墓园与核验范围">
        <h4>已知墓园与核验范围</h4>
        <p>{gravedigger.environment || "尚未观察原记录与现场；弱点、灵体回应与异常来源不能预先认定。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="掘墓人墓园实践">
          <h3>原现场、有限核验与报告</h3>
          <label className="seer-case-selector">
            选择墓园实践
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {gravedigger.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case gravedigger-case" aria-label="当前墓园实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">登记状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="gravedigger-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未核对原记录与现场；不能据此确定真实弱点、灵体意图或隐藏身份。</p>}
            </section>
            <section className="gravedigger-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的核验与报告见原记录。"}</p>
            </section>
            <section className="slice-notice gravedigger-boundaries" aria-label="死亡之眼与初步交流边界">
              <h4>死亡之眼与初步交流边界</h4>
              <p>先观察，再从本次公开方法中选择核验方式。准备后仍可退出；实际核验与报告分别提交，成本与限制见按钮。</p>
              <p className="slice-muted">死亡之眼仅辨识适用亡灵或灵体的真实弱点，不能让普通人一眼即死。附近少量灵体的初步交流可能遭到拒绝或误导；交流不等于控制，不能凭空招来或命令亡灵军队。错误的命令宣称会保留在原记录中，可再作有限报告更正。</p>
            </section>
            {selectedCase.result && <section className="gravedigger-result" aria-label="实际核验与报告记录">
              <h4>实际核验与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="gravedigger-action-list" role="group" aria-label="当前墓园实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="gravedigger-action-list" role="group" aria-label="掘墓人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {gravedigger.story && <p className="slice-muted">{gravedigger.story}</p>}

      {gravedigger.discovered && <section className="slice-notice gravedigger-source" aria-label="掘墓人成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("掘墓人的完整配方尚未核实，不展示原料或用量，也不开放调配。本阶段使用有独立来源记录的成品原瓶；具体渠道、场景与数值属于本作游戏设定。")}</p>
        {gravedigger.supplies && <p>{gravedigger.supplies}</p>}
      </section>}
      {gravedigger.discovered && gravedigger.bottles.length > 0 && (
        <details className="seer-fold gravedigger-bottles" open={!gravedigger.promoted}>
          <summary>掘墓人独立成品原瓶 · 来源与去向</summary>
          {gravedigger.bottles.map((bottle) => {
            const action = gravedigger.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !gravedigger.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !gravedigger.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `gravedigger-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`gravedigger-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {gravedigger.discovered && !gravedigger.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{gravedigger.risk}</p></details>}
      {gravedigger.promoted && (
        <section className="gravedigger-abilities" aria-label="掘墓人能力与消化">
          <h3>能力与消化 · {gravedigger.abilities.length} 项能力</h3>
          <p className="slice-muted">继承收尸人能力，并强化体魄与灵视。死亡之眼辨识适用亡灵或灵体的弱点，初步交流只及附近少量灵体；不下放更高序列的完整通灵或亡灵军队指挥。具体本领与掌握程度以当前记录为准。</p>
          <p>扮演进度 {gravedigger.acting} · 消化：{gravedigger.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {gravedigger.pollution}</p>
          {gravedigger.abilities.map((ability) => (
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
