import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DreamwalkerAction, DreamwalkerCommand, DreamwalkerProjection } from "../domain/dreamwalker/types";
import type { HypnotistProjection } from "../domain/hypnotist/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对事实与本人意愿",
  OBSERVED: "已有公开观察与本人回应",
  PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待退出与现实复核",
  RESOLVED: "已提交有限报告",
};

/** Old facts, refusals, outcomes and original bottles remain read-only after promotion. */
export function DreamwalkerHypnotistHistory({ hypnotist }: { hypnotist: HypnotistProjection }) {
  return <section className="seer-panel warrior-panel psychologist-panel" aria-label="催眠师时期的经历">
    <h3>催眠师时期的经历</h3>
    <p className="slice-notice">这里保留催眠师时期的原故事、同意与拒绝、失败、实际结束、报告和独立原瓶，只供回看；旧成长不会在序列5再次结算。</p>
    <p>催眠师扮演进度 {hypnotist.acting} · 消化：{hypnotist.digestion}</p>
    {(hypnotist.story || hypnotist.environment || hypnotist.supplies) && <details className="seer-fold">
      <summary>催眠师原故事与供给</summary>
      {hypnotist.story && <p>{hypnotist.story}</p>}
      {hypnotist.environment && <p>{hypnotist.environment}</p>}
      {hypnotist.supplies && <p>{hypnotist.supplies}</p>}
    </details>}
    {hypnotist.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方法与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {hypnotist.bottles.length > 0 && <details className="seer-fold">
      <summary>催眠师原瓶 · 来源与去向</summary>
      {hypnotist.bottles.map((bottle) => <article className="psychologist-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {hypnotist.abilities.length > 0 && <details className="seer-fold">
      <summary>催眠师时期能力记录</summary>
      {hypnotist.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface DreamwalkerPanelProps {
  dreamwalker: DreamwalkerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DreamwalkerCommand) => void;
}

function isCaseAction(action: DreamwalkerAction): boolean { return "caseId" in action.command; }
function isRitualAction(action: DreamwalkerAction): boolean {
  return ["REQUEST_RITUAL", "BEGIN_RITUAL", "END_RITUAL"].includes(action.command.type);
}
function isEncounterAction(action: DreamwalkerAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

function RitualFacts({ ritual }: { ritual: DreamwalkerProjection["ritual"] }) {
  return <>
    <h4>{ritual.title}</h4>
    <dl className="seer-facts">
      <div><dt>现场状态</dt><dd>{ritual.status}</dd></div>
      <div><dt>实际参与者</dt><dd>{ritual.participant}</dd></div>
      <div><dt>同一契约</dt><dd>{ritual.contract}</dd></div>
      <div><dt>唯一原尾羽</dt><dd>{ritual.feather}</dd></div>
      <div><dt>本次情绪</dt><dd>{ritual.emotion}</dd></div>
      <div><dt>会面预约</dt><dd>{ritual.appointment}</dd></div>
    </dl>
  </>;
}

/** Commands, consent, exits and resource eligibility come only from the saved public projection. */
export function DreamwalkerPanel({ dreamwalker, resources, busy, blocked = false, error = null, onCommand }: DreamwalkerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<DreamwalkerAction | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const locked = busy || blocked || error !== null;
  const confirmationLocked = locked || submittedId !== null;
  const liveConfirmation = confirmation && dreamwalker.actions.find((action) => action.id === confirmation.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.command));
  const selectedBottleId = confirmation?.command.type === "CONSUME" ? confirmation.command.bottleId : null;
  const selectedBottle = dreamwalker.bottles.find((bottle) => bottle.id === selectedBottleId);
  const caseActions = dreamwalker.actions.filter(isCaseAction);
  const closeAction = caseActions.find((action) => action.enabled && action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const openCaseId = closeAction && "caseId" in closeAction.command ? closeAction.command.caseId : null;
  const selectedCase = (dreamwalker.insideCase ? dreamwalker.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? dreamwalker.cases.find((entry) => entry.id === selectedCaseId)
    ?? dreamwalker.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? dreamwalker.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const ritualActions = dreamwalker.actions.filter(isRitualAction);
  const returnActions = dreamwalker.actions.filter((action) => action.command.type === "RETURN");
  const encounterActions = dreamwalker.actions.filter(isEncounterAction);
  const growthActions = dreamwalker.actions.filter((action) => action.command.type !== "CONSUME" && action.command.type !== "RETURN"
    && !isCaseAction(action) && !isRitualAction(action) && !isEncounterAction(action));
  const nextExit = ["END_RITUAL", "CLOSE", "RETURN", "WITHDRAW"]
    .map((type) => dreamwalker.actions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = nextExit
    ?? dreamwalker.actions.find((action) => action.enabled && action.command.type === "CONSUME")
    ?? [...selectedCaseActions, ...ritualActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
    ?? [...selectedCaseActions, ...ritualActions, ...growthActions, ...returnActions][0];

  useEffect(() => {
    if (selectedCase && (dreamwalker.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, dreamwalker.insideCase]);
  useEffect(() => {
    if (confirmation && !busy && error === null && (!liveConfirmation || !selectedBottle)) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, liveConfirmation, selectedBottle, busy, error]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirmation]);

  function openBottle(action: DreamwalkerAction) {
    if (locked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedId(null); setConfirmation(action);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !selectedBottle || !liveConfirmation?.enabled) return;
    submitted.current = confirmation.id; setSubmittedId(confirmation.id);
    onCommand(confirmation.command);
  }
  function actionButton(action: DreamwalkerAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        onClick={() => {
          if (locked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `dreamwalker-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`dreamwalker-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作，继续同一原操作，不要重新服药。"}
  </p>;

  if (confirmation && selectedBottle) return <section
    className="seer-panel warrior-panel psychologist-panel seer-confirmation" aria-label="这瓶梦境行者魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">在本次真实仪式中，独立确认这一瓶</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{liveConfirmation ? liveConfirmation.cost : confirmation.cost}</dd></div>
    </dl>
    <section className="slice-notice" aria-label="服药前的真实仪式状态"><RitualFacts ritual={dreamwalker.ritual} /></section>
    <p className="slice-muted">{playerText("完整配方尚未核实；本次是原创G成品渠道的独立原瓶。预约、实际赴会、逐瓶服药与结束会面分别保存，查看确认不会建立契约或取得尾羽。")}</p>
    <section className="slice-notice seer-risk" aria-label="梦境行者服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{dreamwalker.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{dreamwalker.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {liveConfirmation?.reason && <p className="seer-action-reason" id="dreamwalker-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirmBottle}
        aria-describedby={liveConfirmation?.reason ? "dreamwalker-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新结算。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel psychologist-panel dreamwalker-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="梦境行者成长下一步">
      <span className="seer-seal">{dreamwalker.promoted ? "序列 5" : "催眠师6 → 梦境行者5"}</span>
      <h3>{dreamwalker.title}</h3>
      {dreamwalker.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : dreamwalker.insideCase ? "请查看当前公开的退出或返回选项。"
          : dreamwalker.promoted && dreamwalker.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{dreamwalker.digestion}</p>
      {dreamwalker.discovered && !dreamwalker.promoted && <p className="slice-muted">用药指导：{dreamwalker.guidanceKnown ? "已听取" : "尚未听取"}。每瓶劳务、付款取得原瓶、仪式预约、实际赴会与服药确认分别进行；费用和条件以公开选项为准。</p>}
      <p className="slice-muted">{playerText("完整魔药配方尚未核实，不拼补材料、用量或调配顺序。这里的成品供给为本作原创G；已核实的鸟妖契约、原尾羽、激烈情绪和外力唤醒仪式仍须实际完成。")}</p>
    </section>
    {(dreamwalker.discovered || ritualActions.length > 0) && <section aria-label="梦境行者真实仪式">
      <RitualFacts ritual={dreamwalker.ritual} />
      {ritualActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="梦境行者仪式行动">{ritualActions.map(actionButton)}</div>}
      {dreamwalker.ritual.visits.length > 0 && <details className="seer-fold">
        <summary>原契约与每次实际会面记录</summary>
        <ul>{dreamwalker.ritual.visits.map((visit) => <li key={visit.id}>第{visit.id}次会面：{visit.summary}</li>)}</ul>
      </details>}
    </section>}
    {dreamwalker.practice && <section className="slice-notice" aria-label="实际身体节点与梦境状态">
      <h4>身体与梦境</h4>
      <dl className="seer-facts">
        <div><dt>身体所在节点</dt><dd>{dreamwalker.practice.location === "SOURCE_ROOM" ? "源房间" : "160米外的目标房间"}</dd></div>
        <div><dt>当前梦境</dt><dd>{{ NONE: "当前没有梦境接触", NOEL: "诺尔的实际梦境", AMINA: "阿米娜的实际梦境" }[dreamwalker.practice.dream]}</dd></div>
        <div><dt>实际抵达目标</dt><dd>{dreamwalker.practice.outboundTrips} 次</dd></div>
        <div><dt>沿原普通路返回</dt><dd>{dreamwalker.practice.returns} 次</dd></div>
        <div><dt>清醒现实核验</dt><dd>{dreamwalker.practice.wakingChecks} 次</dd></div>
      </dl>
      <p className="slice-muted">身体位置只随已保存的实际行动改变。退出当前梦境不会把身体送回源房间；实际归途仍沿160米原普通路线。</p>
    </section>}
    {dreamwalker.environment && <section aria-label="当前梦境行者现场"><h4>当前现场</h4><p>{dreamwalker.environment}</p></section>}
    {returnActions.length > 0 && <section aria-label="梦境行者实际返回">
      <h4>退出梦境后的实际归途</h4>
      <div className="warrior-action-list">{returnActions.map(actionButton)}</div>
    </section>}
    {selectedCase && <section aria-label="梦境行者有限实践">
      <h3>梦中反馈与现实复核</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={locked || (dreamwalker.insideCase && openCaseId !== null)}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {dreamwalker.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前梦境行者实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section className="slice-notice" aria-label="实际练习与跨周核验记录">
          <h4>实际练习与现实核验</h4>
          <p>已实际练习 {selectedCase.sessions} 次 · 练习周：{selectedCase.sessionWeeks.length > 0 ? selectedCase.sessionWeeks.map((week) => `第${week}周`).join("、") : "尚无实际练习周"}</p>
          <p>{selectedCase.verified ? "本案已完成清醒现实核验" : "本案尚未完成清醒现实核验"}</p>
        </section>
        <section aria-label="公开观察与本人回应"><h4>公开观察与本人回应</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察，不把梦话当作事实，也不预设本人已经同意或熟睡。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的练习。准备不会提前产生梦境效果、完成穿梭或替代现实核验。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="梦境行者实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前梦境行者实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {dreamwalker.insideCase && <p className="slice-muted">结束接触会退出当前梦境，身体留在实际抵达的当前节点；返回须沿公开的原普通路线实际归源。0行动、0精神、0灵性时仍可使用已开放的结束、返回或撤回选项。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="梦境行者成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="梦境行者有限冲突">
      <h3>现场争议</h3><div className="warrior-action-list">{encounterActions.map(actionButton)}</div>
    </section>}
    {dreamwalker.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{dreamwalker.story}</p></details>}
    {dreamwalker.discovered && dreamwalker.supplies && <section className="slice-notice" aria-label="梦境行者成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{dreamwalker.supplies}</p>
    </section>}
    {dreamwalker.bottles.length > 0 && <details className="seer-fold" open={!dreamwalker.promoted}>
      <summary>梦境行者独立成品原瓶 · 来源与去向</summary>
      {dreamwalker.bottles.map((bottle) => {
        const action = dreamwalker.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action ? "seer-bottle" : "psychologist-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && <div>
            <button className="slice-button" disabled={locked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `dreamwalker-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`dreamwalker-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {dreamwalker.discovered && !dreamwalker.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{dreamwalker.risk}</p></details>}
    {dreamwalker.promoted && <section aria-label="梦境行者能力与消化">
      <h3>能力与消化 · {dreamwalker.abilities.length} 项训练记录</h3>
      <p>扮演进度 {dreamwalker.acting} · 消化：{dreamwalker.digestion}</p>
      <progress className="cryptologist-progress" aria-label="梦境行者扮演进度" value={dreamwalker.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {dreamwalker.pollution}</p>
      {dreamwalker.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
