import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SootherAction, SootherCommand, SootherProjection } from "../domain/soother/types";
import type { NightmareProjection } from "../domain/nightmare/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对事实",
  OBSERVED: "已有灵体或现场观察记录",
  PREPARED: "已准备待执行的有限实践",
  EXAMINED: "已有有限实践的实际结果",
  RESOLVED: "已提交本次有限报告",
};

/** Earlier dream accounts, waking verification and consumed originals are read-only history. */
export function SootherNightmareHistory({ nightmare }: { nightmare: NightmareProjection }) {
  return <section className="seer-panel warrior-panel nightmare-panel" aria-label="梦魇时期的经历">
    <h3>梦魇时期的经历</h3>
    <p className="slice-notice">你已晋升安魂师。这里保留梦魇时期的自愿入梦、梦中记录、清醒后核实、失败、原瓶与原ID，只供回看；旧成长不会在序列6再次结算扮演进度。</p>
    <p>梦魇扮演进度 {nightmare.acting} · 消化：{nightmare.digestion}</p>
    {nightmare.story && <p>{nightmare.story}</p>}
    {nightmare.supplies && <p>{nightmare.supplies}</p>}
    {nightmare.environment && <p>{nightmare.environment}</p>}
    {nightmare.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status}</summary>
      <p className="slice-muted">原梦境ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.dreamRecord && <p>当时的梦中记录：{entry.dreamRecord}</p>}
      {entry.result && <p>当时的核实与报告：{entry.result}</p>}
    </details>)}
    {nightmare.bottles.length > 0 && <details className="seer-fold" open>
      <summary>梦魇原瓶 · 来源与去向</summary>
      {nightmare.bottles.map((bottle) => <article className="nightmare-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {nightmare.abilities.length > 0 && <details className="seer-fold">
      <summary>梦魇时期能力记录</summary>
      {nightmare.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface SootherPanelProps {
  soother: SootherProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: SootherCommand) => void;
}

function isCaseAction(action: SootherAction): boolean {
  return "caseId" in action.command;
}
function isEncounterAction(action: SootherAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render only public spirit observations, bounded preparations, costs and committed results. */
export function SootherPanel({ soother, resources, busy, blocked = false, error = null, onCommand }: SootherPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = soother.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = soother.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = soother.actions.filter(isCaseAction);
  // Only a public CLOSE intent identifies the open scene; old failure prose cannot lock it.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (soother.insideCase ? soother.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? soother.cases.find((entry) => entry.id === selectedCaseId)
    ?? soother.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? soother.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!soother.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = soother.insideCase ? [] : soother.actions.filter(isEncounterAction);
  const growthActions = soother.insideCase ? [] : soother.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = soother.insideCase ? closeAction : !soother.promoted
    ? soother.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !soother.promoted && !soother.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (soother.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, soother.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || soother.promoted || soother.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, soother.promoted, soother.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SootherAction) {
    if (busy || interactionBlocked || soother.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || soother.promoted || soother.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: SootherAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `soother-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`soother-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel nightmare-panel seer-confirmation" aria-label="这瓶安魂师魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="安魂师服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{soother.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{soother.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="soother-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "soother-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试回执。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel nightmare-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="安魂师成长下一步">
      <span className="seer-seal">{soother.promoted ? "序列 6" : "安魂师晋升卷宗"}</span>
      <h3>{soother.title}</h3>
      <p className="seer-next">{soother.insideCase
        ? <><strong>先实际结束本次接触：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束能力并实际离场为0行动、0精神、0灵性；不另抽随机、不奖励、不退款、不治疗，原失败、有限结论与修订记录继续保留。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{soother.digestion}</p>
      {!soother.promoted && <p className="slice-muted">服用前须完成梦魇消化100与十二个完整序列7周。指导、每瓶劳务、付款取得成品与逐瓶确认分别进行，实际费用、成熟条件与下一周补给以当前公开记录为准；准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与剂量仍未核实，指导仅说明有来源的独立成品原瓶。安魂只按当前公开条件有限平复，不能保证净化全部污染或使死者复活。具体故事、判定、费用与消化数值为本作原创G。")}</p>
    </section>

    {soother.promoted && <section className="slice-notice" aria-label="安魂师能力边界">
      <h4>有限安魂有边界，保留现实复核与退出</h4>
      <p>野狼幽魂、窗口残影与成年家属本人自愿追忆各有自己的范围。先观察并准备，再实际实施，有限平复不等于查明所有真相；遇到超出能力的情况须保留原失败，修订只依据后来公开的事实。三项主实践可和平完成本阶段消化；有限冲突另行选择。</p>
      <p className="slice-muted">安魂不保证净化全部污染、复活死者或得到可靠证词。成年家属的自愿追忆不等于召回亡者；本人可以停止。继承梦魇入梦时本体仍不能移动，梦中体验还须清醒后核实。灵巫的封灵、收容与驱使灵体不属于本阶段能力。</p>
    </section>}
    {soother.promoted && soother.environment && <section aria-label="当前安魂师现场">
      <h4>当前现场</h4><p>{soother.environment}</p>
    </section>}
    {selectedCase && <section aria-label="安魂师有限实践">
      <h3>现场观察、有限准备与实际结果</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || soother.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {soother.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前安魂师实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次接触：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="公开观察与原失败记录"><h4>公开观察与原失败记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际核对记录；灵体印象与梦中体验不能直接当作事实，也不能代替成年家属本人的同意。</p>}
        </section>
        <section aria-label="有限实践与准备"><h4>有限实践与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择准备不会提前平复灵体、取得本人同意或改写原失败。"}</p>
        </section>
        {selectedCase.result && <section aria-label="有限平复与实际结果" aria-live="polite" aria-atomic="true">
          <h4>有限平复与实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前安魂师实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">普通方法保留自己的条件与结果。撤回准备不等于实际退出；结束能力并实际离场不会退还精神或灵性，也不会抹去失败与已提交报告。零行动仍可按公开结束选项退出，是否可执行与成本以公开按钮为准。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="安魂师成长行动">{growthActions.map(actionButton)}</div>}
    {soother.story && <p className="slice-muted">{soother.story}</p>}
    {encounterActions.length > 0 && <section aria-label="有限现场冲突">
      <h3>有限现场冲突</h3>
      <p className="slice-muted">可按公开选项交涉，或承担普通短棍战的实际风险。继承梦魇能力仍有原本体限制，有限安魂不保证战斗成功，选择战斗也不会提前取得胜利。</p>
      <div className="warrior-action-list" role="group" aria-label="现场冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {soother.discovered && soother.supplies && <section className="slice-notice" aria-label="安魂师成品原瓶供给">
      <h4>成品原瓶与实际供给</h4><p>{soother.supplies}</p>
    </section>}
    {soother.discovered && soother.bottles.length > 0 && <details className="seer-fold" open={!soother.promoted}>
      <summary>安魂师独立成品原瓶 · 来源与去向</summary>
      {soother.bottles.map((bottle) => {
        const action = soother.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !soother.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !soother.promoted && !soother.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `soother-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`soother-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {soother.discovered && !soother.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{soother.risk}</p></details>}
    {soother.promoted && <section aria-label="安魂师能力与消化">
      <h3>能力与消化 · {soother.abilities.length} 项训练记录</h3>
      <p>扮演进度 {soother.acting} · 消化：{soother.digestion}</p>
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {soother.pollution}</p>
      {soother.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
