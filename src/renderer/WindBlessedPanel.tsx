import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WindBlessedAction, WindBlessedCommand, WindBlessedProjection } from "../domain/wind-blessed/types";
import type { NavigatorProjection } from "../domain/navigator/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对事实",
  OBSERVED: "已有原现场观察",
  PREPARED: "已准备待执行的有限实践",
  EXAMINED: "已有本次实际结果",
  RESOLVED: "已提交本次有限报告",
};
const NAVIGATOR_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察", SURVEYED: "已勘察水域", PLANNED: "已有当时计划与准备", RESOLVED: "已有实际作业结果",
};

/** Old plans, outcomes, original bottles and mastery remain history, never new S6 actions. */
export function WindBlessedNavigatorHistory({ navigator }: { navigator: NavigatorProjection }) {
  return <section className="seer-panel warrior-panel navigator-panel" aria-label="航海家时期的经历">
    <h3>航海家时期的经历</h3>
    <p className="slice-notice">你已晋升风眷者。这里保留航海家时期的水域观察、原计划、原工具、实际结果、原瓶与能力，只供回看；旧成长不会在序列6再次结算扮演进度。</p>
    <p>航海家扮演进度 {navigator.acting} · 消化：{navigator.digestion}</p>
    {navigator.story && <p>{navigator.story}</p>}
    {navigator.supplies && <p>{navigator.supplies}</p>}
    {navigator.environment && <p>{navigator.environment}</p>}
    {navigator.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {NAVIGATOR_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <section aria-label={`${entry.title}的原现场观察`}>
        <h4>当时的现场观察</h4><ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>
      </section>}
      {entry.preparation && <p>当时的计划与准备：{entry.preparation}</p>}
      {entry.result && <p>当时的实际结果：{entry.result}</p>}
    </details>)}
    {navigator.bottles.length > 0 && <details className="seer-fold" open>
      <summary>航海家原瓶 · 来源与去向</summary>
      {navigator.bottles.map((bottle) => <article className="navigator-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {navigator.abilities.length > 0 && <details className="seer-fold">
      <summary>航海家时期能力记录</summary>
      {navigator.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface WindBlessedPanelProps {
  windBlessed: WindBlessedProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: WindBlessedCommand) => void;
}

function isCaseAction(action: WindBlessedAction): boolean {
  return "caseId" in action.command;
}
function isEncounterAction(action: WindBlessedAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Position and return history come from committed projection, never the selected panel. */
export function WindBlessedPanel({ windBlessed, resources, busy, blocked = false, error = null, onCommand }: WindBlessedPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = windBlessed.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = windBlessed.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = windBlessed.actions.filter(isCaseAction);
  // Only the public command identifies the active case; retained failure prose is not a lock.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (windBlessed.insideCase ? windBlessed.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? windBlessed.cases.find((entry) => entry.id === selectedCaseId)
    ?? windBlessed.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? windBlessed.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = windBlessed.actions.filter(isEncounterAction);
  const growthActions = windBlessed.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = windBlessed.insideCase ? closeAction : !windBlessed.promoted
    ? windBlessed.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !windBlessed.promoted && !windBlessed.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (windBlessed.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, windBlessed.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || windBlessed.promoted || windBlessed.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, windBlessed.promoted, windBlessed.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: WindBlessedAction) {
    if (busy || interactionBlocked || windBlessed.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || windBlessed.promoted || windBlessed.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: WindBlessedAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `wind-blessed-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`wind-blessed-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel navigator-panel seer-confirmation" aria-label="这瓶风眷者魔药的服用确认" aria-busy={busy}
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
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="风眷者服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{windBlessed.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{windBlessed.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="wind-blessed-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "wind-blessed-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试回执。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel navigator-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="风眷者成长下一步">
      <span className="seer-seal">{windBlessed.promoted ? "序列 6" : "风眷者晋升卷宗"}</span>
      <h3>{windBlessed.title}</h3>
      <p className="seer-next">{windBlessed.insideCase
        ? <><strong>先实际返回并结束本次现场：</strong>{nextAction?.label || "查看当前公开返回或结束选项"}。结束命令为0行动；原低台的飞行返程仍另耗2灵性并独立判定，失败留在原台面，原楼梯可以0灵性返回。切换卷宗不会移动角色，也不会结束现场。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{windBlessed.digestion}</p>
      {!windBlessed.promoted && <p className="slice-muted">服用前须完成航海家消化100与十二个完整序列7周。指导、每瓶劳务、付款取得成品与逐瓶确认分别进行，实际费用、成熟条件与下一周补给以当前公开记录为准；准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("能力只在本人、原物与获准现场有限使用，不授予序列5海洋歌者的歌声或雷击。")}</p>
    </section>

    {windBlessed.discovered && <section className="slice-notice" aria-label="风眷者已核主材料与配方边界">
      <h4>{playerText("已知主材料，尚不能自行调配")}</h4>
      <p>{playerText("已核正文只支持主材料蓝影隼结晶羽毛6根与龙眼海雕眼珠1对。完整配方、辅料、其余剂量与调配顺序尚未核实；这两项仅供了解，不开放材料采购或调配。")}</p>
      <p className="slice-muted">{playerText("本阶段用药指导只说明本作原创G渠道的独立成品原瓶，不用水手、暴怒之民或航海家旧瓶改装。")}</p>
    </section>}
    {windBlessed.promoted && <section className="slice-notice" aria-label="风眷者能力边界">
      <h4>原帆布、原低台与获准薄木条</h4>
      <p>有限控风只稳定原工作框内的原帆布；短程借风只托举本人前往原低台；风刃只切获准的原普通薄木条。保留公开的普通方法与原支杆、楼梯、锯具，具体条件和结果分别记录。</p>
      <p className="slice-muted">不改变全城天气，不携人或大件，也不因选择准备就完成飞行或切割。和平实践与战斗分别结算，能力可能失败；故事中的有限练习不是现实安全保证。</p>
    </section>}
    {windBlessed.promoted && windBlessed.environment && <section aria-label="当前风眷者现场">
      <h4>当前现场</h4><p>{windBlessed.environment}</p>
    </section>}
    {windBlessed.promoted && <section className="slice-notice" aria-label="原低台位置与往返记录" aria-live="polite" aria-atomic="true">
      <h3>原低台位置与往返记录</h3>
      <dl className="seer-facts">
        <div><dt>实际位置</dt><dd>{windBlessed.flight.position === "LOW_PLATFORM" ? "原低台台面" : "原地面"}</dd></div>
        <div><dt>实际登台</dt><dd>{windBlessed.flight.ascents} 次</dd></div>
        <div><dt>成功飞行返回</dt><dd>{windBlessed.flight.flightReturns} 次</dd></div>
        <div><dt>实际楼梯返回</dt><dd>{windBlessed.flight.stairReturns} 次</dd></div>
      </dl>
      <p>原低台水平6米、高2米；原8米普通楼梯回路始终开放。去程3灵性，飞行返程另付2灵性，各自进行体质14判定；计划飞行往返合计5灵性，仍可能失败。</p>
      <p>只有3灵性时也可按公开选项尝试去程，返回可以走原楼梯。两种返回均为0行动；飞行返回失败仍耗2灵性、人留在原台面，走楼梯返回不耗灵性、不另抽随机。</p>
      <p className="slice-muted">这里仅显示已保存的实际位置与次数；选择准备、点击返回或切换卷宗不会提前更新。返回不奖励、不退款、不治疗，不抹去原失败。</p>
    </section>}
    {selectedCase && <section aria-label="风眷者有限实践">
      <h3>有限控风、原低台往返与风刃练习</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || windBlessed.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {windBlessed.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前风眷者实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次现场：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="公开观察与原失败记录"><h4>公开观察与原失败记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察记录；原现场、原工具与许可均须按公开记录核对。</p>}
        </section>
        <section aria-label="有限实践与准备"><h4>有限实践与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择准备不会提前移动角色、改变原物或改写原失败。"}</p>
        </section>
        {selectedCase.result && <section aria-label="风眷者实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前风眷者实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">普通方法保留自己的条件、原工具与实际结果。撤回准备不等于从原低台返回；结束现场不退还原行动、精神或灵性，也不抹去已提交的报告。是否可执行与本次成本以公开按钮为准。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="风眷者成长行动">{growthActions.map(actionButton)}</div>}
    {windBlessed.story && <p className="slice-muted">{windBlessed.story}</p>}
    {encounterActions.length > 0 && <section aria-label="风眷者有限冲突">
      <h3>有限冲突</h3>
      <p className="slice-muted">只按当前公开选项交涉或进入原现场的战斗。低台往返记录不授予战斗中的免费移动、必定闪避或胜利；普通短棍与非凡能力各自承担实际成本与风险。</p>
      <div className="warrior-action-list" role="group" aria-label="风眷者冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {windBlessed.discovered && windBlessed.supplies && <section className="slice-notice" aria-label="风眷者成品原瓶供给">
      <h4>成品原瓶与实际供给</h4><p>{windBlessed.supplies}</p>
    </section>}
    {windBlessed.discovered && windBlessed.bottles.length > 0 && <details className="seer-fold" open={!windBlessed.promoted}>
      <summary>风眷者独立成品原瓶 · 来源与去向</summary>
      {windBlessed.bottles.map((bottle) => {
        const action = windBlessed.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !windBlessed.promoted ? "seer-bottle" : "navigator-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !windBlessed.promoted && !windBlessed.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `wind-blessed-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`wind-blessed-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {windBlessed.discovered && !windBlessed.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{windBlessed.risk}</p></details>}
    {windBlessed.promoted && <section aria-label="风眷者能力与消化">
      <h3>能力与消化 · {windBlessed.abilities.length} 项训练记录</h3>
      <p>扮演进度 {windBlessed.acting} · 消化：{windBlessed.digestion}</p>
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {windBlessed.pollution}</p>
      {windBlessed.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
