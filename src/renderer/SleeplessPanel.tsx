import { useEffect, useRef, useState } from "react";
import type { SleeplessAction, SleeplessCommand, SleeplessProjection } from "../domain/sleepless/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const WATCH_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察",
  SURVEYED: "已有现场观察，等待守望",
  RESOLVED: "已结束",
  FIGHTING: "冲突进行中",
  RETREATED: "已经撤离",
  LOST: "守望中断",
};

function belongsToWatch(action: SleeplessAction, watchId: string): boolean {
  return "watchId" in action.command ? action.command.watchId === watchId
    : watchId === "sleepless-watch" && ["OBSERVE_ENCOUNTER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"].includes(action.command.type);
}
function isWatchAction(action: SleeplessAction): boolean {
  return "watchId" in action.command || ["OBSERVE_ENCOUNTER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"].includes(action.command.type);
}

interface SleeplessPanelProps {
  sleepless: SleeplessProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: SleeplessCommand) => void;
}

/** Only render public observations and forward typed intents; night facts and results belong to the domain. */
export function SleeplessPanel({ sleepless, resources, busy, blocked, readOnly = false, onCommand }: SleeplessPanelProps) {
  const [selectedWatchId, setSelectedWatchId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = sleepless.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = sleepless.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const watchActions = sleepless.actions.filter(isWatchAction);
  const selectedWatch = sleepless.watches.find((watch) => watch.id === selectedWatchId)
    ?? sleepless.watches.find((watch) => watchActions.some((action) => action.enabled && belongsToWatch(action, watch.id)))
    ?? sleepless.watches[0];
  const selectedWatchActions = selectedWatch ? watchActions.filter((action) => belongsToWatch(action, selectedWatch.id)) : [];
  const actions = sleepless.actions.filter((action) => action.command.type !== "CONSUME" && !isWatchAction(action));
  const nextAction = sleepless.promoted
    ? selectedWatchActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedWatchActions[0] ?? actions[0]
    : sleepless.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !sleepless.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || sleepless.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, sleepless.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SleeplessAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || sleepless.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: SleeplessAction) {
    return (
      <div className="seer-action sleepless-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `sleepless-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`sleepless-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel sleepless-panel seer-confirmation" aria-label="这瓶不眠者魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="不眠者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{sleepless.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{sleepless.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="sleepless-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "sleepless-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel sleepless-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="不眠者成长下一步">
        <span className="seer-seal">{sleepless.promoted ? "序列 9" : "不眠者成长卷宗"}</span>
        <h3>{sleepless.title}</h3>
        {readOnly ? (
          <p className="seer-next">已选择其它途径，这份不眠者渠道只供回看。</p>
        ) : sleepless.promoted && sleepless.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的夜间守望。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{sleepless.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{sleepless.digestion}</p>
        {!sleepless.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">取得渠道或晋升不会自动加入教会。夜间守望仍需要观察和报告。</p>
      </section>

      {sleepless.promoted && <section className="slice-notice sleepless-environment" aria-label="已知夜间环境">
        <h4>已知夜间环境</h4>
        <p>{sleepless.environment || "夜间环境尚未确认，请先观察现场。"}</p>
      </section>}

      {selectedWatch && (
        <section aria-label="不眠者守望记录">
          <h3>夜间守望与报告</h3>
          <label className="seer-case-selector">
            选择守望地点
            <select value={selectedWatch.id} disabled={busy || blocked} onChange={(event) => setSelectedWatchId(event.target.value)}>
              {sleepless.watches.map((watch) => <option key={watch.id} value={watch.id}>{watch.title} · {WATCH_STATUS[watch.status] ?? watch.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前守望记录">
            <h4>{selectedWatch.title}</h4>
            <p>{selectedWatch.story}</p>
            <p className="slice-muted">守望状态：{WATCH_STATUS[selectedWatch.status] ?? selectedWatch.status}</p>
            <section className="seer-fold" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedWatch.observations.length > 0
                ? <ul>{selectedWatch.observations.map((observation, index) => <li key={`${selectedWatch.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。黑暗中的情况仍待核实。</p>}
            </section>
            {selectedWatch.result && <section className="slice-notice" aria-label="实际守望结果"><h4>实际守望结果</h4><p>{selectedWatch.result}</p></section>}
            {selectedWatchActions.length > 0 && (
              <div className="sleepless-action-list" role="group" aria-label="当前守望行动">{selectedWatchActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="sleepless-action-list" role="group" aria-label="不眠者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {sleepless.story && <p className="slice-muted">{sleepless.story}</p>}

      {sleepless.discovered && sleepless.supplies && <p className="slice-notice">{sleepless.supplies}</p>}
      {sleepless.discovered && sleepless.bottles.length > 0 && (
        <details className="seer-fold sleepless-bottles" open={!sleepless.promoted}>
          <summary>守夜导师的独立成品原瓶 · 来源与去向</summary>
          {sleepless.bottles.map((bottle) => {
            const action = sleepless.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !sleepless.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !sleepless.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `sleepless-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`sleepless-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {sleepless.discovered && !sleepless.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{sleepless.risk}</p></details>}
      {sleepless.promoted && (
        <section className="sleepless-abilities" aria-label="不眠者能力与消化">
          <h3>能力与消化 · {sleepless.abilities.length} 项能力</h3>
          <p className="slice-muted">睡眠需求减少，仍需休息。每周行动不增加，受伤后仍使用日常休养；序列9没有催眠诗歌或入梦能力。</p>
          <p>扮演进度 {sleepless.acting} · 消化：{sleepless.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {sleepless.pollution}</p>
          {sleepless.abilities.map((ability) => (
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
