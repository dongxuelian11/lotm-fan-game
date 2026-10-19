import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { TrickmasterAction, TrickmasterCommand, TrickmasterProjection } from "../domain/trickmaster/types";
import type { ApprenticeProjection } from "../domain/apprentice/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场",
  PREPARED: "已选定方式并完成准备",
  RESOLVED: "本次作业已有实际结果",
};

const APPRENTICE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察", OBSERVED: "已观察原门与普通路线", PREPARED: "已准备通行",
  EXAMINED: "已实际通行", RESOLVED: "已返回并交接报告",
};

/** Historical records deliberately have no command callback. */
export function ApprenticeHistory({ apprentice }: { apprentice: ApprenticeProjection }) {
  return <section className="seer-panel trickmaster-panel" aria-label="学徒时期的经历">
    <h3>学徒时期的经历</h3>
    <p className="slice-notice">你已晋升戏法大师。这里保留学徒时期的原门观察、实际路线、返回与报告、原瓶来源和能力掌握。当前生活实践请回到戏法大师卷宗。</p>
    <p>学徒扮演进度 {apprentice.acting} · {apprentice.digestion}</p>
    {apprentice.environment && <p className="slice-muted">{apprentice.environment}</p>}
    {apprentice.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {APPRENTICE_STATUS[entry.status] ?? entry.status}</summary>
      <p>{entry.story}</p>
      {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}><h4>原观察记录</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul></section>}
      {entry.preparation && <section aria-label={`${entry.title}的原准备`}><h4>原路线与准备</h4><p>{entry.preparation}</p></section>}
      {entry.result && <section aria-label={`${entry.title}的实际结果`}><h4>实际通行与报告</h4><p>{entry.result}</p></section>}
    </details>)}
    {apprentice.bottles.length > 0 && <details className="seer-fold"><summary>学徒原瓶 · 来源与去向</summary>
      {apprentice.bottles.map((bottle) => <article className="trickmaster-history-bottle" key={bottle.id}><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {apprentice.abilities.length > 0 && <details className="seer-fold"><summary>已继承的学徒能力</summary>
      {apprentice.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: TrickmasterAction): boolean {
  return "caseId" in action.command;
}

interface TrickmasterPanelProps {
  trickmaster: TrickmasterProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: TrickmasterCommand) => void;
}

/** Facts, preparation and committed outcomes stay separate; projected methods are equal choices. */
export function TrickmasterPanel({ trickmaster, resources, busy, blocked, readOnly = false, onCommand }: TrickmasterPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = trickmaster.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = trickmaster.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = trickmaster.actions.filter(isCaseAction);
  const selectedCase = trickmaster.cases.find((entry) => entry.id === selectedCaseId)
    ?? trickmaster.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? trickmaster.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = trickmaster.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = trickmaster.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : trickmaster.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Both methods are public choices; observations never imply a completed preparation or outcome.
  const nextLabel = nextAction?.command.type === "PREPARE"
    ? "对照实际观察，选择有限戏法或普通方法并完成准备。"
    : nextAction?.command.type === "PERFORM"
      ? "核对已选方式与实际准备后执行，也可以退出本次准备。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !trickmaster.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || trickmaster.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, trickmaster.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: TrickmasterAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || trickmaster.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: TrickmasterAction) {
    return (
      <div className="seer-action trickmaster-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `trickmaster-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`trickmaster-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel trickmaster-panel seer-confirmation" aria-label="这瓶戏法大师魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="戏法大师服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{trickmaster.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{trickmaster.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="trickmaster-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "trickmaster-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel trickmaster-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="戏法大师成长下一步">
        <span className="seer-seal">{trickmaster.promoted ? "序列 8" : "戏法大师晋升卷宗"}</span>
        <h3>{trickmaster.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份戏法大师卷宗只供回看。</p>
        ) : trickmaster.promoted && trickmaster.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的生活戏法实践。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{trickmaster.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{trickmaster.digestion}</p>
        {!trickmaster.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成学徒消化与成熟准备，再取得实际材料、调配成瓶，并单独确认服用。可用行动、成本与缺少的条件以本卷宗记录为准。</p>}
        <p className="slice-muted">{playerText("本阶段具体场景、供应批次与数值属于游戏设定（G）。学习后才能查阅已知配方；列表顺序不代表已经核实的调配顺序。")}</p>
      </section>

      {trickmaster.promoted && <section className="slice-notice trickmaster-environment" aria-label="已知现场与处理边界">
        <h4>已知现场与处理边界</h4>
        <p>{trickmaster.environment || "原杯、信号物件与通道现状尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="戏法大师实践">
          <h3>现场事实、实际准备与有限戏法</h3>
          <label className="seer-case-selector">
            选择生活实践
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {trickmaster.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case trickmaster-case" aria-label="当前生活实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">作业状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="trickmaster-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得本处现场观察，不能确认未提供的事实。</p>}
            </section>
            <section className="trickmaster-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p>{selectedCase.preparation || "尚无本次准备记录。已观察现场，不等于已选择方式或布置好物件。"}</p>
            </section>
            <section className="slice-notice trickmaster-boundaries" aria-label="本次作业目标与边界">
              <h4>本次作业目标与边界</h4>
              <p>只处理已经观察到的现场对象。有限戏法与普通方法都须先准备，再执行；退出准备不消耗行动，实际结果须等结算后确认。</p>
              <p className="slice-muted">结冰、低强度闪光与轻风只作用于本次已确认的原物件和范围；普通冷却、手铃与工具也是有效选择。原杯、手铃和清扫物件留在原现场，不会因选择方式自动变成随身道具。</p>
            </section>
            {selectedCase.result && <section className="trickmaster-result" aria-label="实际作业结果">
              <h4>实际作业结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="trickmaster-action-list" role="group" aria-label="当前生活实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="trickmaster-action-list" role="group" aria-label="戏法大师成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {trickmaster.story && <p className="slice-muted">{trickmaster.story}</p>}

      {trickmaster.discovered && trickmaster.supplies && <section className="slice-notice trickmaster-supplies" aria-label="戏法大师实际物资"><h4>实际材料与独立批次</h4><p>{trickmaster.supplies}</p></section>}
      {trickmaster.discovered && trickmaster.bottles.length > 0 && (
        <details className="seer-fold trickmaster-bottles" open={!trickmaster.promoted}>
          <summary>戏法大师独立调配原瓶 · 来源与去向</summary>
          {trickmaster.bottles.map((bottle) => {
            const action = trickmaster.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !trickmaster.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !trickmaster.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `trickmaster-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`trickmaster-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {trickmaster.discovered && !trickmaster.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{trickmaster.risk}</p></details>}
      {trickmaster.discovered && trickmaster.formulaKnown && trickmaster.formula.length > 0 && <details className="seer-fold" aria-label="戏法大师已知配方">
        <summary>查看已知戏法大师配方 · {trickmaster.formula.length} 种材料</summary>
        <ul className="seer-formula">{trickmaster.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity === null ? "数量原文未注明" : `${material.quantity} ${material.unit}`}</strong>{material.note && <small>{material.note}</small>}</li>)}</ul>
        <p className="slice-muted">这里只列已知材料与用量，不把列表顺序当作调配顺序。取得材料、调配成瓶与确认服用是三个独立步骤。</p>
      </details>}
      {trickmaster.promoted && (
        <section className="trickmaster-abilities" aria-label="戏法大师能力与消化">
          <h3>能力与消化 · {trickmaster.abilities.length} 项能力</h3>
          <p className="slice-muted">保留学徒开门掌握，新增各种较弱戏法共用的一项掌握度。薄冰、低强度闪光与轻风各自受到现场对象和范围限制；这不等于任意冻结、强光致盲、风暴或更高序列能力。</p>
          <p>扮演进度 {trickmaster.acting} · 消化：{trickmaster.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {trickmaster.pollution}</p>
          {trickmaster.abilities.map((ability) => (
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
