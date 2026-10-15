import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SunpriestAction, SunpriestCommand, SunpriestProjection } from "../domain/sunpriest/types";
import type { BardProjection } from "../domain/bard/types";
import type { LightprayerProjection } from "../domain/lightprayer/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场",
  PREPARED: "已选定方式并完成准备",
  RESOLVED: "本次作业已有实际结果",
};

const BARD_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察", OBSERVED: "已观察当事人与声场", AGREED: "已确认本次方式与边界", RESOLVED: "本次协助已有实际结果",
};

/** These lower-sequence records intentionally have no command callback. */
function PreviousSunHistory({ title, state, statuses }: { title: string; state: BardProjection | LightprayerProjection; statuses: Record<string, string> }) {
  return <section className="seer-panel sunpriest-panel" aria-label={`${title}时期的经历`}>
    <h3>{title}时期的经历</h3>
    <p className="slice-notice">你已晋升太阳神官。这里保留{title}时期的原观察、实际准备与结果、原瓶来源和能力掌握，当前实践请回到太阳神官卷宗。</p>
    <p>{title}扮演进度 {state.acting} · {state.digestion}</p>
    {state.environment && <p className="slice-muted">{state.environment}</p>}
    {state.cases.length > 0 && <section aria-label={`${title}作业历史`}>
      {state.cases.map((entry) => <details className="seer-fold" key={entry.id}>
        <summary>{entry.title} · {statuses[entry.status] ?? entry.status}</summary>
        <p>{entry.story}</p>
        {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}>
          <h4>原观察记录</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
        </section>}
        {entry.preparation && <section aria-label={`${entry.title}的原准备`}><h4>原方式与准备</h4><p>{entry.preparation}</p></section>}
        {entry.result && <section aria-label={`${entry.title}的实际结果`}><h4>实际作业结果</h4><p>{entry.result}</p></section>}
      </details>)}
    </section>}
    {state.bottles.length > 0 && <details className="seer-fold">
      <summary>{title}原瓶 · 来源与去向</summary>
      {state.bottles.map((bottle) => <article className="sunpriest-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {state.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的{title}能力</summary>
      {state.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export function SunpriestBardHistory({ bard }: { bard: BardProjection }) {
  return <PreviousSunHistory title="歌颂者" state={bard} statuses={BARD_STATUS} />;
}

export function LightprayerHistory({ lightprayer }: { lightprayer: LightprayerProjection }) {
  return <PreviousSunHistory title="祈光人" state={lightprayer} statuses={CASE_STATUS} />;
}

function isCaseAction(action: SunpriestAction): boolean {
  return "caseId" in action.command;
}

interface SunpriestPanelProps {
  sunpriest: SunpriestProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: SunpriestCommand) => void;
}

/** Facts, preparation and committed outcomes stay separate; projected methods are equal choices. */
export function SunpriestPanel({ sunpriest, resources, busy, blocked, readOnly = false, onCommand }: SunpriestPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = sunpriest.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = sunpriest.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = sunpriest.actions.filter(isCaseAction);
  const selectedCase = sunpriest.cases.find((entry) => entry.id === selectedCaseId)
    ?? sunpriest.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? sunpriest.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = sunpriest.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = sunpriest.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : sunpriest.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Both methods are public choices; observations never imply a completed preparation or outcome.
  const nextLabel = nextAction?.command.type === "PREPARE"
    ? "对照实际观察，选择神官方式或普通方法并完成准备。"
    : nextAction?.command.type === "PERFORM"
      ? "核对已选方式与实际准备后执行，也可以退出本次准备。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !sunpriest.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || sunpriest.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, sunpriest.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SunpriestAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || sunpriest.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: SunpriestAction) {
    return (
      <div className="seer-action sunpriest-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `sunpriest-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`sunpriest-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel sunpriest-panel seer-confirmation" aria-label="这瓶太阳神官魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="太阳神官服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{sunpriest.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{sunpriest.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="sunpriest-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "sunpriest-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel sunpriest-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="太阳神官成长下一步">
        <span className="seer-seal">{sunpriest.promoted ? "序列 7" : "太阳神官晋升卷宗"}</span>
        <h3>{sunpriest.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份太阳神官卷宗只供回看。</p>
        ) : sunpriest.promoted && sunpriest.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的神官实践。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{sunpriest.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{sunpriest.digestion}</p>
        {!sunpriest.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成祈光人消化与成熟准备，再取得实际材料、调配成瓶，并单独确认服用。可用行动、成本与缺少的条件以本卷宗记录为准。</p>}
        <p className="slice-muted">{playerText("本阶段具体场景、材料渠道与数值属于游戏设定（G）。已核配方不代表具体调配顺序已经核实；取得渠道或晋升不会自动加入教会。")}</p>
      </section>

      {sunpriest.promoted && <section className="slice-notice sunpriest-environment" aria-label="已知现场与处理边界">
        <h4>已知现场与处理边界</h4>
        <p>{sunpriest.environment || "现场对象、光照条件与可处理范围尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="太阳神官实践">
          <h3>现场事实、实际准备与有限作业</h3>
          <label className="seer-case-selector">
            选择神官实践
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {sunpriest.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case sunpriest-case" aria-label="当前神官实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">作业状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="sunpriest-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得本处现场观察，不能确认未提供的事实。</p>}
            </section>
            <section className="sunpriest-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p>{selectedCase.preparation || "尚无本次准备记录。已观察现场，不等于已选择方式或布置好物件。"}</p>
            </section>
            <section className="slice-notice sunpriest-boundaries" aria-label="本次作业目标与边界">
              <h4>本次作业目标与边界</h4>
              <p>只处理已经观察到的现场对象。神官方式与普通方法都须先准备，再执行；退出准备不消耗行动，实际结果须等结算后确认。</p>
              <p className="slice-muted">神圣誓约须出于当事人自愿，不等于公证或强制契约。制作与使用神圣之水依据实际物资结算；普通记录与转交不消耗圣水，也不能把未知写成已经净化。</p>
            </section>
            {selectedCase.result && <section className="sunpriest-result" aria-label="实际作业结果">
              <h4>实际作业结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="sunpriest-action-list" role="group" aria-label="当前神官实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="sunpriest-action-list" role="group" aria-label="太阳神官成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {sunpriest.story && <p className="slice-muted">{sunpriest.story}</p>}

      {sunpriest.discovered && sunpriest.supplies && <section className="slice-notice sunpriest-supplies" aria-label="太阳神官实际物资"><h4>实际材料与神圣之水</h4><p>{sunpriest.supplies}</p></section>}
      {sunpriest.discovered && sunpriest.bottles.length > 0 && (
        <details className="seer-fold sunpriest-bottles" open={!sunpriest.promoted}>
          <summary>太阳神官独立调配原瓶 · 来源与去向</summary>
          {sunpriest.bottles.map((bottle) => {
            const action = sunpriest.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !sunpriest.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !sunpriest.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `sunpriest-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`sunpriest-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {sunpriest.discovered && !sunpriest.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{sunpriest.risk}</p></details>}
      {sunpriest.discovered && sunpriest.formulaKnown && sunpriest.formula.length > 0 && <details className="seer-fold" aria-label="太阳神官已知配方">
        <summary>查看已知太阳神官配方 · {sunpriest.formula.length} 种材料</summary>
        <ul className="seer-formula">{sunpriest.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong></li>)}</ul>
        <p className="slice-muted">这里只列已知材料与用量，不把列表顺序当作调配顺序。取得材料、调配成瓶与确认服用是三个独立步骤。</p>
      </details>}
      {sunpriest.promoted && (
        <section className="sunpriest-abilities" aria-label="太阳神官能力与消化">
          <h3>能力与消化 · {sunpriest.abilities.length} 项能力</h3>
          <p className="slice-muted">继承歌颂者与祈光人能力，并获得圣光、神圣誓约、太阳光环与神圣之水。序列7的恐惧免疫确实生效，但不等于所有心智影响免疫；不包含序列6公证、复活或高污染治愈。普通人的恶意或犯罪不会自动成为太阳能力的克制依据。</p>
          <p>扮演进度 {sunpriest.acting} · 消化：{sunpriest.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {sunpriest.pollution}</p>
          {sunpriest.abilities.map((ability) => (
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
