import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { AstrologerAction, AstrologerCommand, AstrologerProjection } from "../domain/astrologer/types";
import type { ApprenticeProjection } from "../domain/apprentice/types";
import type { TrickmasterProjection } from "../domain/trickmaster/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原资料与边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已执行，保留有限结果",
  RESOLVED: "本次实践已有实际结果",
};

/** Lower-sequence records intentionally have no action callback. */
function PreviousDoorHistory({ title, state }: { title: string; state: ApprenticeProjection | TrickmasterProjection }) {
  return <section className="seer-panel astrologer-panel" aria-label={`${title}时期的经历`}>
    <h3>{title}时期的经历</h3>
    <p className="slice-notice">你已晋升占星人。这里保留{title}时期的原观察、实际方法与结果、原瓶来源和能力掌握，当前实践请回到占星人卷宗。</p>
    <p>{title}扮演进度 {state.acting} · {state.digestion}</p>
    {state.environment && <p className="slice-muted">{state.environment}</p>}
    {state.cases.length > 0 && <section aria-label={`${title}实践历史`}>
      {state.cases.map((entry) => <details className="seer-fold" key={entry.id}>
        <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
        <p>{entry.story}</p>
        {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}>
          <h4>原观察记录</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
        </section>}
        {entry.preparation && <section aria-label={`${entry.title}的原准备`}><h4>原方式与准备</h4><p>{entry.preparation}</p></section>}
        {entry.result && <section aria-label={`${entry.title}的实际结果`}><h4>实际执行结果记录</h4><p>{entry.result}</p></section>}
      </details>)}
    </section>}
    {state.formulaKnown && state.formula.length > 0 && <details className="seer-fold">
      <summary>{title}时期已知配方</summary>
      <ul className="seer-formula">{state.formula.map((material) => <li key={material.name}>
        <span>{material.name}</span><strong>{material.quantity === null ? "原文数量未记载" : `${material.quantity} ${material.unit}`}</strong>
      </li>)}</ul>
    </details>}
    {state.supplies && <p className="slice-muted">{state.supplies}</p>}
    {state.bottles.length > 0 && <details className="seer-fold">
      <summary>{title}原瓶 · 来源与去向</summary>
      {state.bottles.map((bottle) => <article className="astrologer-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {state.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的{title}能力</summary>
      {state.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export function AstrologerApprenticeHistory({ apprentice }: { apprentice: ApprenticeProjection }) {
  return <PreviousDoorHistory title="学徒" state={apprentice} />;
}
export function TrickmasterHistory({ trickmaster }: { trickmaster: TrickmasterProjection }) {
  return <PreviousDoorHistory title="戏法大师" state={trickmaster} />;
}

function isCaseAction(action: AstrologerAction): boolean {
  return "caseId" in action.command;
}

interface AstrologerPanelProps {
  astrologer: AstrologerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: AstrologerCommand) => void;
}

/** Only committed public observations, preparations and results reach this panel. */
export function AstrologerPanel({ astrologer, resources, busy, blocked, readOnly = false, onCommand }: AstrologerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = astrologer.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = astrologer.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = astrologer.actions.filter(isCaseAction);
  const selectedCase = astrologer.cases.find((entry) => entry.id === selectedCaseId)
    ?? astrologer.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? astrologer.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = astrologer.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = astrologer.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : astrologer.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Selection and submitted intentions never reveal identities or synthesize either actor’s result.
  const nextLabel = nextAction?.command.type === "PREPARE"
    ? "对照实际观察，选择有限占星或普通方法并完成准备。"
    : nextAction?.command.type === "PERFORM"
      ? "核对已选方式与许可范围后执行，也可以退出本次准备。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !astrologer.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || astrologer.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, astrologer.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: AstrologerAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || astrologer.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: AstrologerAction) {
    return (
      <div className="seer-action astrologer-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `astrologer-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`astrologer-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel astrologer-panel seer-confirmation" aria-label="这瓶占星人魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="占星人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{astrologer.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{astrologer.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="astrologer-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "astrologer-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel astrologer-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="占星人成长下一步">
        <span className="seer-seal">{astrologer.promoted ? "序列 7" : "占星人成长卷宗"}</span>
        <h3>{astrologer.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份占星人卷宗只供回看。</p>
        ) : astrologer.promoted && astrologer.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的占星实践与有限结果。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{astrologer.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{astrologer.digestion}</p>
        {!astrologer.promoted && !readOnly && <p className="slice-muted">需完成戏法大师消化并度过八个完整序列8周，具体成熟度和服药条件以当前公开记录为准。准备期间仍可工作、调查或休养。</p>}
        <p className="slice-muted">晋升不会自动加入组织。尊重原资料、本人同意与未知边界；普通核验也能推进实践。</p>
      </section>

      {astrologer.promoted && <section className="slice-notice astrologer-environment" aria-label="已知现场与占星范围">
        <h4>已知现场与占星范围</h4>
        <p>{astrologer.environment || "尚未观察原资料与现场；图像对应、路线变化和探测结果不能预先认定。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="占星人生活实践">
          <h3>原资料、有限判断与实际对照</h3>
          <label className="seer-case-selector">
            选择生活实践
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {astrologer.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case astrologer-case" aria-label="当前生活实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">登记状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="astrologer-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未核对原资料与现场；不能据此确认真实身份、未来结局或探测结果。</p>}
            </section>
            <section className="astrologer-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的实践与结果见原记录。"}</p>
            </section>
            <section className="slice-notice astrologer-boundaries" aria-label="占星、对应关系与干扰边界">
              <h4>占星、对应关系与干扰边界</h4>
              <p>先观察原资料，再选择有限占星或普通核验。准备后仍可退出；实际执行才会提交结果，成本与限制见按钮。占星或干扰每次消耗3灵性，普通核验不消耗灵性。</p>
              <p className="slice-muted">占星只判断当前问题的有限线索；两幅图像的对应关系不等于揭露真实身份，也不能保证路线安全或掌握全部未来。占卜干扰只影响本次实际探测，干扰成功不保证对方探测失败。不能复制人物或原物；序列6的记录法术尚未开放。</p>
            </section>
            {selectedCase.result && <section className="astrologer-result" aria-label="实际执行结果记录">
              <h4>实际执行结果记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="astrologer-action-list" role="group" aria-label="当前生活实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="astrologer-action-list" role="group" aria-label="占星人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {astrologer.story && <p className="slice-muted">{astrologer.story}</p>}

      {astrologer.discovered && <section className="slice-notice astrologer-source" aria-label="占星人成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("占星人的当前渠道只提供成品魔药，不提供完整配方；不展示原料或用量，也不开放调配。本阶段使用有独立来源记录的成品原瓶；渠道条件、场景与数值以当前公开记录为准。")}</p>
        {astrologer.supplies && <p>{astrologer.supplies}</p>}
      </section>}
      {astrologer.discovered && astrologer.bottles.length > 0 && (
        <details className="seer-fold astrologer-bottles" open={!astrologer.promoted}>
          <summary>占星人独立成品原瓶 · 来源与去向</summary>
          {astrologer.bottles.map((bottle) => {
            const action = astrologer.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !astrologer.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !astrologer.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `astrologer-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`astrologer-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {astrologer.discovered && !astrologer.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{astrologer.risk}</p></details>}
      {astrologer.promoted && (
        <section className="astrologer-abilities" aria-label="占星人能力与消化">
          <h3>能力与消化 · {astrologer.abilities.length} 项能力</h3>
          <p className="slice-muted">继承学徒与戏法大师能力。有限占星、图像对应与占卜干扰的具体作用以实际记录为准；危险预感不能保证避开所有伤害。不会凭空获得真实身份、复制原物，或提前开放记录法术。</p>
          <p>扮演进度 {astrologer.acting} · 消化：{astrologer.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {astrologer.pollution}</p>
          {astrologer.abilities.map((ability) => (
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
