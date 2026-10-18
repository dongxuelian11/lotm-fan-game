import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { LightprayerAction, LightprayerCommand, LightprayerProjection } from "../domain/lightprayer/types";
import type { BardProjection } from "../domain/bard/types";
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

/** Previous-sequence history has no callback or action controls. */
export function BardHistory({ bard }: { bard: BardProjection }) {
  return (
    <section className="seer-panel lightprayer-panel" aria-label="歌颂者时期的经历">
      <h3>歌颂者时期的经历</h3>
      <p className="slice-notice">你已晋升祈光人。歌颂者时期的观察、自愿协助方式、实际结果与原瓶记录保留在这里，当前实践请回到祈光人卷宗。</p>
      <p>歌颂者扮演进度 {bard.acting} · {bard.digestion}</p>
      {bard.environment && <p className="slice-muted">{bard.environment}</p>}
      {bard.cases.length > 0 && <section aria-label="歌颂者协助历史">
        {bard.cases.map((entry) => <details className="seer-fold" key={entry.id}>
          <summary>{entry.title} · {BARD_STATUS[entry.status] ?? entry.status}</summary>
          <p>{entry.story}</p>
          {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}>
            <h4>原观察记录</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
          </section>}
          {entry.preparation && <section aria-label={`${entry.title}的原准备`}><h4>原协助方式与边界</h4><p>{entry.preparation}</p></section>}
          {entry.result && <section aria-label={`${entry.title}的实际结果`}><h4>实际作业结果</h4><p>{entry.result}</p></section>}
        </details>)}
      </section>}
      {bard.bottles.length > 0 && <details className="seer-fold">
        <summary>歌颂者原瓶 · 来源与去向</summary>
        {bard.bottles.map((bottle) => <article className="lightprayer-history-bottle" key={bottle.id}>
          <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
        </article>)}
      </details>}
      {bard.abilities.length > 0 && <details className="seer-fold">
        <summary>已继承的歌颂者能力</summary>
        {bard.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      </details>}
    </section>
  );
}

function isCaseAction(action: LightprayerAction): boolean {
  return "caseId" in action.command;
}

interface LightprayerPanelProps {
  lightprayer: LightprayerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: LightprayerCommand) => void;
}

/** Facts, preparation and committed outcomes stay separate; projected methods are equal choices. */
export function LightprayerPanel({ lightprayer, resources, busy, blocked, readOnly = false, onCommand }: LightprayerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = lightprayer.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = lightprayer.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = lightprayer.actions.filter(isCaseAction);
  const selectedCase = lightprayer.cases.find((entry) => entry.id === selectedCaseId)
    ?? lightprayer.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? lightprayer.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = lightprayer.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = lightprayer.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : lightprayer.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Both methods are public choices; observations never imply a completed preparation or outcome.
  const nextLabel = nextAction?.command.type === "PREPARE"
    ? "对照实际观察，选择祈光方式或普通方法并完成准备。"
    : nextAction?.command.type === "PERFORM"
      ? "核对已选方式与实际准备后执行，也可以退出本次准备。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !lightprayer.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || lightprayer.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, lightprayer.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: LightprayerAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || lightprayer.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: LightprayerAction) {
    return (
      <div className="seer-action lightprayer-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `lightprayer-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`lightprayer-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel lightprayer-panel seer-confirmation" aria-label="这瓶祈光人魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="祈光人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{lightprayer.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{lightprayer.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="lightprayer-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "lightprayer-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel lightprayer-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="祈光人成长下一步">
        <span className="seer-seal">{lightprayer.promoted ? "序列 8" : "祈光人晋升卷宗"}</span>
        <h3>{lightprayer.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份祈光人卷宗只供回看。</p>
        ) : lightprayer.promoted && lightprayer.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的祈光实践。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{lightprayer.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{lightprayer.digestion}</p>
        {!lightprayer.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。须完成歌颂者100消化与四个完整序列9周，再独立确认服药，按意志难度12判定。</p>}
        <p className="slice-muted">{playerText("本阶段具体场景、成品药渠道与数值属于游戏设定（G），完整配方待核。取得渠道或晋升不会自动加入教会。")}</p>
      </section>

      {lightprayer.promoted && <section className="slice-notice lightprayer-environment" aria-label="已知现场与处理边界">
        <h4>已知现场与处理边界</h4>
        <p>{lightprayer.environment || "现场对象、光照条件与可处理范围尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="祈光人祈光实践">
          <h3>现场事实、实际准备与有限作业</h3>
          <label className="seer-case-selector">
            选择祈光实践
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {lightprayer.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case lightprayer-case" aria-label="当前祈光实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">作业状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="lightprayer-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得本处现场观察，不能确认未提供的事实。</p>}
            </section>
            <section className="lightprayer-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p>{selectedCase.preparation || "尚无本次准备记录。已观察现场，不等于已选择方式或布置好物件。"}</p>
            </section>
            <section className="slice-notice lightprayer-boundaries" aria-label="本次作业目标与边界">
              <h4>本次作业目标与边界</h4>
              <p>只处理已经观察到的现场对象。祈光方式与普通方法都须先准备，再执行；退出准备不消耗行动，实际结果须等结算后确认。</p>
              <p className="slice-muted">光照不等于识破秘密，点燃灯芯不等于任意纵火。异常来源未确认时，普通报告只记录与转交疑点，不能把未知写成已经净化。</p>
            </section>
            {selectedCase.result && <section className="lightprayer-result" aria-label="实际作业结果">
              <h4>实际作业结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="lightprayer-action-list" role="group" aria-label="当前祈光实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="lightprayer-action-list" role="group" aria-label="祈光人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {lightprayer.story && <p className="slice-muted">{lightprayer.story}</p>}

      {lightprayer.discovered && lightprayer.supplies && <p className="slice-notice">{lightprayer.supplies}</p>}
      {lightprayer.discovered && lightprayer.bottles.length > 0 && (
        <details className="seer-fold lightprayer-bottles" open={!lightprayer.promoted}>
          <summary>祈光人独立成品原瓶 · 来源与去向</summary>
          {lightprayer.bottles.map((bottle) => {
            const action = lightprayer.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !lightprayer.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !lightprayer.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `lightprayer-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`lightprayer-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {lightprayer.discovered && !lightprayer.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{lightprayer.risk}</p></details>}
      {lightprayer.promoted && (
        <section className="lightprayer-abilities" aria-label="祈光人能力与消化">
          <h3>能力与消化 · {lightprayer.abilities.length} 项能力</h3>
          <p className="slice-muted">继承两项歌颂者能力，加上暗中视物、太阳金焰与有限祈祷三项能力。能力只对实际确认的对象与公开条件生效；普通人的恶意或犯罪不会自动成为太阳能力的克制依据。</p>
          <p>扮演进度 {lightprayer.acting} · 消化：{lightprayer.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {lightprayer.pollution}</p>
          {lightprayer.abilities.map((ability) => (
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
