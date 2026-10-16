import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { MidnightAction, MidnightCommand, MidnightProjection } from "../domain/midnight/types";
import type { SleeplessProjection } from "../domain/sleepless/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察，等待准备",
  PREPARED: "准备已完成",
  WITHDRAWN: "已停止本次实践",
  RESOLVED: "已结束",
  FIGHTING: "冲突进行中",
  RETREATED: "已经撤离",
  LOST: "实践中断",
};
const WATCH_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察", SURVEYED: "已有现场观察", RESOLVED: "已结束",
  FIGHTING: "冲突进行中", RETREATED: "已经撤离", LOST: "守望中断",
};

/** Preserve the exact prior-sequence records without exposing obsolete growth commands. */
export function SleeplessHistory({ sleepless }: { sleepless: SleeplessProjection }) {
  return (
    <section className="seer-panel midnight-panel" aria-label="不眠者时期的经历">
      <h3>不眠者时期的经历</h3>
      <p className="slice-notice">你已晋升午夜诗人。不眠者时期的守望、原瓶与已掌握能力保留在这里，当前实践请回到午夜诗人卷宗。</p>
      <p>不眠者扮演进度 {sleepless.acting} · {sleepless.digestion}</p>
      {sleepless.environment && <p className="slice-muted">{sleepless.environment}</p>}
      {sleepless.watches.length > 0 && <section aria-label="不眠者守望历史">
        {sleepless.watches.map((watch) => <details className="seer-fold" key={watch.id}>
          <summary>{watch.title} · {WATCH_STATUS[watch.status] ?? watch.status}</summary>
          <p>{watch.story}</p>
          {watch.observations.length > 0 && <ul>{watch.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
          {watch.result && <p>{watch.result}</p>}
        </details>)}
      </section>}
      {sleepless.bottles.length > 0 && <details className="seer-fold">
        <summary>不眠者原瓶 · 来源与去向</summary>
        {sleepless.bottles.map((bottle) => <article className="midnight-history-bottle" key={bottle.id}>
          <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
        </article>)}
      </details>}
      {sleepless.abilities.length > 0 && <details className="seer-fold">
        <summary>已继承的不眠者能力</summary>
        {sleepless.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      </details>}
    </section>
  );
}

function belongsToCase(action: MidnightAction, caseId: string): boolean {
  return "caseId" in action.command ? action.command.caseId === caseId
    : caseId === "midnight-dispute" && ["OBSERVE_ENCOUNTER", "CLEAR_BYSTANDER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"].includes(action.command.type);
}
function isCaseAction(action: MidnightAction): boolean {
  return "caseId" in action.command || ["OBSERVE_ENCOUNTER", "CLEAR_BYSTANDER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"].includes(action.command.type);
}

interface MidnightPanelProps {
  midnight: MidnightProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: MidnightCommand) => void;
}

/** Only public observations are shown; preparation, consent and outcomes come from committed domain state. */
export function MidnightPanel({ midnight, resources, busy, blocked, onCommand }: MidnightPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = midnight.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = midnight.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = midnight.actions.filter(isCaseAction);
  const selectedCase = midnight.cases.find((scene) => scene.id === selectedCaseId)
    ?? midnight.cases.find((scene) => scene.status === "OBSERVED" || scene.status === "PREPARED")
    ?? midnight.cases.find((scene) => caseActions.some((action) => action.enabled && belongsToCase(action, scene.id)))
    ?? midnight.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => belongsToCase(action, selectedCase.id)) : [];
  const actions = midnight.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = midnight.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : midnight.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !midnight.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || midnight.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, midnight.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: MidnightAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || midnight.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: MidnightAction) {
    return (
      <div className="seer-action midnight-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => { if (!busy && !blocked && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `midnight-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`midnight-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel midnight-panel seer-confirmation" aria-label="这瓶午夜诗人魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="午夜诗人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{midnight.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{midnight.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="midnight-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "midnight-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel midnight-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="午夜诗人成长下一步">
        <span className="seer-seal">{midnight.promoted ? "序列 8" : "午夜诗人晋升卷宗"}</span>
        <h3>{midnight.title}</h3>
        {midnight.promoted && midnight.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的夜间实践。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{midnight.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{midnight.digestion}</p>
        {!midnight.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成不眠者消化与成熟时间，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("这是游戏设定（G）的有限成品药渠道，完整配方待核；取得渠道或晋升不会自动加入教会。")}</p>
      </section>

      {midnight.promoted && <section className="slice-notice midnight-environment" aria-label="已知夜间环境">
        <h4>已知夜间环境</h4>
        <p>{midnight.environment || "夜间环境尚未确认，请先观察现场。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="午夜诗人实践记录">
          <h3>夜间诗歌与安抚</h3>
          <p className="slice-muted">先观察当事人的需要。吟诵前须确认成年当事人同意并请旁人离开；也可选择普通交谈，或停止本次实践。</p>
          <label className="seer-case-selector">
            选择夜间情境
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {midnight.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? scene.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前夜间情境">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="seer-fold" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。先了解当事人的需要与周围情况。</p>}
            </section>
            {selectedCase.result && <section className="slice-notice" aria-label="实际实践结果"><h4>实际实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="midnight-action-list" role="group" aria-label="当前情境行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="midnight-action-list" role="group" aria-label="午夜诗人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {midnight.story && <p className="slice-muted">{midnight.story}</p>}

      {midnight.discovered && midnight.supplies && <p className="slice-notice">{midnight.supplies}</p>}
      {midnight.discovered && midnight.bottles.length > 0 && (
        <details className="seer-fold midnight-bottles" open={!midnight.promoted}>
          <summary>午夜诗人独立成品原瓶 · 来源与去向</summary>
          {midnight.bottles.map((bottle) => {
            const action = midnight.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !midnight.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !midnight.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `midnight-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`midnight-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {midnight.discovered && !midnight.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{midnight.risk}</p></details>}
      {midnight.promoted && (
        <section className="midnight-abilities" aria-label="午夜诗人能力与消化">
          <h3>能力与消化 · {midnight.abilities.length} 项能力</h3>
          <p className="slice-muted">诗歌须有声吟诵，可以带来平静或困意，也可能被抵抗；附近同伴同样可能受到影响。不能控制意志、读取思想或进入梦境。</p>
          <p>扮演进度 {midnight.acting} · 消化：{midnight.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {midnight.pollution}</p>
          {midnight.abilities.map((ability) => (
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
