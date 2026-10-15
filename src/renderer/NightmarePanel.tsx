import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { NightmareAction, NightmareCommand, NightmareProjection } from "../domain/nightmare/types";
import type { MidnightProjection } from "../domain/midnight/types";
import type { SleeplessProjection } from "../domain/sleepless/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察，等待准备",
  PREPARED: "准备已完成",
  DREAM_RECORDED: "已退出梦境，等待清醒核实",
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

type HistoryRecords = { id: string; title: string; story: string; observations: string[]; result: string | null; status: string }[];
type DarknessHistoryProjection = Pick<SleeplessProjection, "acting" | "digestion" | "environment" | "abilities"> & { bottles: { id: string; title: string; source: string; status: string }[] };

/** Prior-sequence dossiers expose records, never old acquisition or practice commands. */
function DarknessHistory({ title, state, records, recordLabel, statuses }: {
  title: string; state: DarknessHistoryProjection; records: HistoryRecords;
  recordLabel: string; statuses: Record<string, string>;
}) {
  return <section className="seer-panel nightmare-panel" aria-label={`${title}时期的经历`}>
    <h3>{title}时期的经历</h3>
    <p className="slice-notice">你已晋升梦魇。这里保留{title}时期的实际经历、原瓶去向与已掌握能力，当前实践请回到梦魇卷宗。</p>
    <p>{title}扮演进度 {state.acting} · {state.digestion}</p>
    {state.environment && <p className="slice-muted">{state.environment}</p>}
    {records.length > 0 && <section aria-label={recordLabel}>
      {records.map((record) => <details className="seer-fold" key={record.id}>
        <summary>{record.title} · {statuses[record.status] ?? record.status}</summary>
        <p>{record.story}</p>
        {record.observations.length > 0 && <ul>{record.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
        {record.result && <p>{record.result}</p>}
      </details>)}
    </section>}
    {state.bottles.length > 0 && <details className="seer-fold">
      <summary>{title}原瓶 · 来源与去向</summary>
      {state.bottles.map((bottle) => <article className="nightmare-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {state.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的{title}能力</summary>
      {state.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export function NightmareSleeplessHistory({ sleepless }: { sleepless: SleeplessProjection }) {
  return <DarknessHistory title="不眠者" state={sleepless} records={sleepless.watches} recordLabel="不眠者守望历史" statuses={WATCH_STATUS} />;
}

export function MidnightHistory({ midnight }: { midnight: MidnightProjection }) {
  return <DarknessHistory title="午夜诗人" state={midnight} records={midnight.cases} recordLabel="午夜诗人实践历史" statuses={CASE_STATUS} />;
}

function belongsToCase(action: NightmareAction, caseId: string): boolean {
  return "caseId" in action.command ? action.command.caseId === caseId
    : caseId === "nightmare-dispute" && ["OBSERVE_ENCOUNTER", "CLEAR_BYSTANDER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"].includes(action.command.type);
}
function isCaseAction(action: NightmareAction): boolean {
  return "caseId" in action.command || ["OBSERVE_ENCOUNTER", "CLEAR_BYSTANDER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"].includes(action.command.type);
}

interface NightmarePanelProps {
  nightmare: NightmareProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: NightmareCommand) => void;
}

/** Only public observations are shown; preparation, consent and outcomes come from committed domain state. */
export function NightmarePanel({ nightmare, resources, busy, blocked, onCommand }: NightmarePanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = nightmare.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = nightmare.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = nightmare.actions.filter(isCaseAction);
  const selectedCase = nightmare.cases.find((scene) => scene.id === selectedCaseId)
    ?? nightmare.cases.find((scene) => scene.status === "OBSERVED" || scene.status === "PREPARED" || scene.status === "DREAM_RECORDED")
    ?? nightmare.cases.find((scene) => caseActions.some((action) => action.enabled && belongsToCase(action, scene.id)))
    ?? nightmare.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => belongsToCase(action, selectedCase.id)) : [];
  const actions = nightmare.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = nightmare.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : nightmare.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !nightmare.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || nightmare.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, nightmare.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: NightmareAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || nightmare.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: NightmareAction) {
    return (
      <div className="seer-action nightmare-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => { if (!busy && !blocked && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `nightmare-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`nightmare-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel nightmare-panel seer-confirmation" aria-label="这瓶梦魇魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="梦魇服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{nightmare.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{nightmare.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="nightmare-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "nightmare-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel nightmare-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="梦魇成长下一步">
        <span className="seer-seal">{nightmare.promoted ? "序列 7" : "梦魇晋升卷宗"}</span>
        <h3>{nightmare.title}</h3>
        {nightmare.promoted && nightmare.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的入梦与核实记录。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{nightmare.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{nightmare.digestion}</p>
        {!nightmare.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成午夜诗人消化与成熟时间，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("这是游戏设定（G）的有限成品药渠道，完整配方待核；取得渠道或晋升不会自动加入教会。")}</p>
      </section>

      {nightmare.promoted && <section className="slice-notice nightmare-environment" aria-label="已知入梦环境">
        <h4>已知入梦环境</h4>
        <p>{nightmare.environment || "入梦环境尚未确认，请先观察现场。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="梦魇实践记录">
          <h3>{selectedCase.id === "nightmare-dispute" ? "现场争端与本体风险" : "自愿入梦与清醒核实"}</h3>
          {selectedCase.id === "nightmare-dispute" ? <p className="slice-muted">先亲自观察并安排旁人离开，再选择交涉或承担战斗风险。清醒目标的拉梦需要反复准备与实际对抗；锁定期间本体不能移动，也不能同时发动身体动作。</p> : <>
            <p className="slice-muted">先观察成年当事人的需要。准备时须取得本人同意、安排普通守护人并确认对方已自愿入睡；也可停止本次实践。</p>
            <p className="slice-muted">一次短程入梦行动包含进入、查看与退出。本体全程留在原处不能移动，守护人也不会代替你行动；退出后再单独进行清醒核实。</p>
          </>}
          <label className="seer-case-selector">
            选择入梦情境
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {nightmare.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? scene.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前入梦情境">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="seer-fold" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。先了解当事人的需要与周围情况。</p>}
            </section>
            {selectedCase.dreamRecord && <section className="slice-notice nightmare-dream-record" aria-label="梦境经历记录">
              <h4>{selectedCase.status === "RESOLVED" ? "梦境经历记录 · 已另行清醒核实" : selectedCase.status === "WITHDRAWN" ? "梦境经历记录 · 未完成清醒核实" : "梦境经历记录 · 待清醒核实"}</h4>
              <p>{selectedCase.dreamRecord}</p>
              <p className="slice-muted">这只是本次报告的梦境经历，可能失真，不能直接作为事实或证词。清醒后的核实结果另行记录。</p>
            </section>}
            {selectedCase.result && <section className="slice-notice" aria-label="实际实践结果"><h4>实际实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="nightmare-action-list" role="group" aria-label="当前情境行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="nightmare-action-list" role="group" aria-label="梦魇成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {nightmare.story && <p className="slice-muted">{nightmare.story}</p>}

      {nightmare.discovered && nightmare.supplies && <p className="slice-notice">{nightmare.supplies}</p>}
      {nightmare.discovered && nightmare.bottles.length > 0 && (
        <details className="seer-fold nightmare-bottles" open={!nightmare.promoted}>
          <summary>梦魇独立成品原瓶 · 来源与去向</summary>
          {nightmare.bottles.map((bottle) => {
            const action = nightmare.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !nightmare.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !nightmare.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `nightmare-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`nightmare-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {nightmare.discovered && !nightmare.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{nightmare.risk}</p></details>}
      {nightmare.promoted && (
        <section className="nightmare-abilities" aria-label="梦魇能力与消化">
          <h3>能力与消化 · {nightmare.abilities.length} 项能力</h3>
          <p className="slice-muted">本阶段入梦只涉及当前真实对象与已记录情境。梦中经历可能失真，不会自动揭示秘密或变成客观证据。清醒目标须经反复准备与实际对抗才能拉梦；锁定期间本体不能移动，也不能同时发动身体动作。</p>
          <p>扮演进度 {nightmare.acting} · 消化：{nightmare.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {nightmare.pollution}</p>
          {nightmare.abilities.map((ability) => (
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
