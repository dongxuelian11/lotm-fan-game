import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SpiritmediumAction, SpiritmediumCommand, SpiritmediumProjection } from "../domain/spiritmedium/types";
import type { CorpsecollectorProjection } from "../domain/corpsecollector/types";
import type { GravediggerProjection } from "../domain/gravedigger/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原现场与边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已核验，尚待报告",
  RESOLVED: "本次有限报告已交接",
};

/** Lower-sequence records intentionally have no action callback. */
function PreviousDeathHistory({ title, state }: { title: string; state: CorpsecollectorProjection | GravediggerProjection }) {
  return <section className="seer-panel spiritmedium-panel" aria-label={`${title}时期的经历`}>
    <h3>{title}时期的经历</h3>
    <p className="slice-notice">你已晋升通灵者。这里保留{title}时期的原观察、实际准备、核验与报告、原瓶来源和能力掌握，当前实践请回到通灵者卷宗。</p>
    <p>{title}扮演进度 {state.acting} · {state.digestion}</p>
    {state.environment && <p className="slice-muted">{state.environment}</p>}
    {state.cases.length > 0 && <section aria-label={`${title}核验历史`}>
      {state.cases.map((entry) => <details className="seer-fold" key={entry.id}>
        <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
        <p>{entry.story}</p>
        {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}>
          <h4>原观察记录</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
        </section>}
        {entry.preparation && <section aria-label={`${entry.title}的原准备`}><h4>原方式与准备</h4><p>{entry.preparation}</p></section>}
        {entry.result && <section aria-label={`${entry.title}的实际结果`}><h4>实际核验与报告记录</h4><p>{entry.result}</p></section>}
      </details>)}
    </section>}
    {state.bottles.length > 0 && <details className="seer-fold">
      <summary>{title}原瓶 · 来源与去向</summary>
      {state.bottles.map((bottle) => <article className="spiritmedium-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {state.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的{title}能力</summary>
      {state.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export function SpiritmediumCorpsecollectorHistory({ corpsecollector }: { corpsecollector: CorpsecollectorProjection }) {
  return <PreviousDeathHistory title="收尸人" state={corpsecollector} />;
}
export function GravediggerHistory({ gravedigger }: { gravedigger: GravediggerProjection }) {
  return <PreviousDeathHistory title="掘墓人" state={gravedigger} />;
}

function isCaseAction(action: SpiritmediumAction): boolean {
  return "caseId" in action.command;
}

interface SpiritmediumPanelProps {
  spiritmedium: SpiritmediumProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: SpiritmediumCommand) => void;
}

/** Original records, limited findings and reports come only from the public projection. */
export function SpiritmediumPanel({ spiritmedium, resources, busy, blocked, readOnly = false, onCommand }: SpiritmediumPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = spiritmedium.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = spiritmedium.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = spiritmedium.actions.filter(isCaseAction);
  const selectedCase = spiritmedium.cases.find((entry) => entry.id === selectedCaseId)
    ?? spiritmedium.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? spiritmedium.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = spiritmedium.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = spiritmedium.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : spiritmedium.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Neither observations nor a chosen method imply a completed examination or a true conclusion.
  const nextLabel = nextAction?.command.type === "PREPARE"
    ? "对照实际观察，从本次可用方法中选择并完成准备。"
    : nextAction?.command.type === "PERFORM"
      ? "核对方法与退路后进行有限核验，也可以退出本次准备。"
      : nextAction?.command.type === "REPORT"
        ? "根据实际核验与仍未知的部分，报告本次所见与交流边界。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !spiritmedium.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || spiritmedium.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, spiritmedium.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SpiritmediumAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || spiritmedium.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: SpiritmediumAction) {
    return (
      <div className="seer-action spiritmedium-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `spiritmedium-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`spiritmedium-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel spiritmedium-panel seer-confirmation" aria-label="这瓶通灵者魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="通灵者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{spiritmedium.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{spiritmedium.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="spiritmedium-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "spiritmedium-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel spiritmedium-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="通灵者成长下一步">
        <span className="seer-seal">{spiritmedium.promoted ? "序列 7" : "通灵者成长卷宗"}</span>
        <h3>{spiritmedium.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份通灵者卷宗只供回看。</p>
        ) : spiritmedium.promoted && spiritmedium.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的通灵实践和有限报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{spiritmedium.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{spiritmedium.digestion}</p>
        {!spiritmedium.promoted && !readOnly && <p className="slice-muted">需完成掘墓人消化并度过八个完整序列8周，具体成熟度和服药条件以当前公开记录为准。准备期间仍可工作、调查或休养。</p>}
        <p className="slice-muted">晋升不会自动加入教会。尊重逝者与原物的保管边界；普通核验也能推进实践。</p>
      </section>

      {spiritmedium.promoted && <section className="slice-notice spiritmedium-environment" aria-label="已知原灵与通灵范围">
        <h4>已知原灵与通灵范围</h4>
        <p>{spiritmedium.environment || "尚未观察原记录与现场；原灵的回应、所知与可借力量不能预先认定。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="通灵者通灵实践">
          <h3>原现场、有限核验与报告</h3>
          <label className="seer-case-selector">
            选择通灵实践
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {spiritmedium.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case spiritmedium-case" aria-label="当前通灵实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">登记状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="spiritmedium-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未核对原记录与现场；不能据此确定灵体所知、借力结果或隐藏身份。</p>}
            </section>
            <section className="spiritmedium-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的核验与报告见原记录。"}</p>
            </section>
            <section className="slice-notice spiritmedium-boundaries" aria-label="通灵仪式、问答与借力边界">
              <h4>通灵仪式、问答与借力边界</h4>
              <p>先观察原现场，再选择有限仪式或普通核验。准备后仍可退出；实际执行与报告分别提交，成本与限制见按钮。仪式消耗3灵性，普通核验不消耗灵性。</p>
              <p className="slice-muted">仪式只面向现场实际存在且已确认的附近少量灵体。回应可能片面、拒绝或误导，问答不能自动揭示全部真相；借力也须有真实对象与执行结果。序列6的灵界信使、序列5的冥界之门不在本阶段开放。错误的完整真相宣称会保留在原记录中，可再作有限报告更正。</p>
            </section>
            {selectedCase.result && <section className="spiritmedium-result" aria-label="实际核验与报告记录">
              <h4>实际核验与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="spiritmedium-action-list" role="group" aria-label="当前通灵实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="spiritmedium-action-list" role="group" aria-label="通灵者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {spiritmedium.story && <p className="slice-muted">{spiritmedium.story}</p>}

      {spiritmedium.discovered && <section className="slice-notice spiritmedium-source" aria-label="通灵者成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("通灵者的完整配方尚未核实，不展示原料或用量，也不开放调配。本阶段使用有独立来源记录的成品原瓶；具体渠道、场景与数值属于本作游戏设定。")}</p>
        {spiritmedium.supplies && <p>{spiritmedium.supplies}</p>}
      </section>}
      {spiritmedium.discovered && spiritmedium.bottles.length > 0 && (
        <details className="seer-fold spiritmedium-bottles" open={!spiritmedium.promoted}>
          <summary>通灵者独立成品原瓶 · 来源与去向</summary>
          {spiritmedium.bottles.map((bottle) => {
            const action = spiritmedium.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !spiritmedium.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !spiritmedium.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `spiritmedium-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`spiritmedium-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {spiritmedium.discovered && !spiritmedium.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{spiritmedium.risk}</p></details>}
      {spiritmedium.promoted && (
        <section className="spiritmedium-abilities" aria-label="通灵者能力与消化">
          <h3>能力与消化 · {spiritmedium.abilities.length} 项能力</h3>
          <p className="slice-muted">继承收尸人与掘墓人能力，新增通灵仪式、灵体交流与有限借力。具体对象、回应和原物变化以实际记录为准，不凭空创造盟友或宣告完整真相。当前首案未确认可借力原灵，战斗仍以普通身体与工具行动；不声称已经借得灵体助战。</p>
          <p>扮演进度 {spiritmedium.acting} · 消化：{spiritmedium.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {spiritmedium.pollution}</p>
          {spiritmedium.abilities.map((ability) => (
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
