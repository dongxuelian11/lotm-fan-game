import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { HypnotistAction, HypnotistCommand, HypnotistProjection } from "../domain/hypnotist/types";
import type { PsychologistProjection } from "../domain/psychologist/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对事实",
  OBSERVED: "已有事实与回应记录",
  PREPARED: "已准备待执行的有限练习",
  EXAMINED: "已有本人回应与实际结果",
  RESOLVED: "已提交本次有限报告",
};

/** Earlier consent, observations and consumed originals are history, never new S6 acting. */
export function HypnotistPsychologistHistory({ psychologist }: { psychologist: PsychologistProjection }) {
  return <section className="seer-panel warrior-panel psychologist-panel" aria-label="心理医生时期的经历">
    <h3>心理医生时期的经历</h3>
    <p className="slice-notice">你已晋升催眠师。这里保留心理医生时期的故事、本人回应、失败、原瓶与原ID，只供回看；旧成长不会在序列6再次结算扮演进度。</p>
    <p>心理医生扮演进度 {psychologist.acting} · 消化：{psychologist.digestion}</p>
    {psychologist.story && <p>{psychologist.story}</p>}
    {psychologist.supplies && <p>{psychologist.supplies}</p>}
    {psychologist.environment && <p>{psychologist.environment}</p>}
    {psychologist.scenes.map((scene) => <details className="seer-fold" key={scene.id}>
      <summary>{scene.title} · {scene.status}</summary>
      <p className="slice-muted">原情境ID：{scene.id}</p><p>{scene.story}</p>
      <p className="slice-muted">当时的同意记录：{scene.consent ? "本人同意本次支持" : "未同意或已结束支持"}</p>
      {scene.observations.length > 0 && <ul>{scene.observations.map((observation, index) => <li key={`${scene.id}-${index}`}>{observation}</li>)}</ul>}
      {scene.impression && <p>当时的有限印象：{scene.impression}</p>}
    </details>)}
    {psychologist.bottles.length > 0 && <details className="seer-fold" open>
      <summary>心理医生原瓶 · 来源与去向</summary>
      {psychologist.bottles.map((bottle) => <article className="psychologist-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {psychologist.abilities.length > 0 && <details className="seer-fold">
      <summary>心理医生时期能力记录</summary>
      {psychologist.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

interface HypnotistPanelProps {
  hypnotist: HypnotistProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: HypnotistCommand) => void;
}

function isCaseAction(action: HypnotistAction): boolean {
  return "caseId" in action.command;
}
function isEncounterAction(action: HypnotistAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Only committed public observations, consent, costs and outcomes are rendered. */
export function HypnotistPanel({ hypnotist, resources, busy, blocked = false, error = null, onCommand }: HypnotistPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = hypnotist.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = hypnotist.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = hypnotist.actions.filter(isCaseAction);
  // Only an actual public CLOSE intent identifies open contact. Historic refusal prose cannot lock it.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (hypnotist.insideCase ? hypnotist.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? hypnotist.cases.find((entry) => entry.id === selectedCaseId)
    ?? hypnotist.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? hypnotist.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!hypnotist.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = hypnotist.insideCase ? [] : hypnotist.actions.filter(isEncounterAction);
  const growthActions = hypnotist.insideCase ? [] : hypnotist.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = hypnotist.insideCase ? closeAction : !hypnotist.promoted
    ? hypnotist.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !hypnotist.promoted && !hypnotist.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (hypnotist.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, hypnotist.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || hypnotist.promoted || hypnotist.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, hypnotist.promoted, hypnotist.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: HypnotistAction) {
    if (busy || interactionBlocked || hypnotist.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || hypnotist.promoted || hypnotist.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: HypnotistAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `hypnotist-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`hypnotist-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel psychologist-panel seer-confirmation" aria-label="这瓶催眠师魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="催眠师服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{hypnotist.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{hypnotist.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="hypnotist-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "hypnotist-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试回执。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel psychologist-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="催眠师成长下一步">
      <span className="seer-seal">{hypnotist.promoted ? "序列 6" : "催眠师晋升卷宗"}</span>
      <h3>{hypnotist.title}</h3>
      <p className="seer-next">{hypnotist.insideCase
        ? <><strong>先实际结束本次接触：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束为0行动、0精神、0灵性；不另抽随机、不奖励、不退款、不治疗，原拒绝、失败与修订记录继续保留。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{hypnotist.digestion}</p>
      {!hypnotist.promoted && <p className="slice-muted">服用前须完成心理医生消化100与十二个完整序列7周。指导、每瓶劳务、付款取得成品与逐瓶确认分别进行，实际费用、成熟条件与下一周补给以当前公开记录为准；准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与剂量仍未核实，指导仅说明有来源的独立成品原瓶。催眠与心理学隐身只按当前公开条件使用，不能保证控制他人或证明供词真相。具体故事、判定、费用与消化数值为本作原创G。")}</p>
    </section>

    {hypnotist.promoted && <section className="slice-notice" aria-label="催眠师能力边界">
      <h4>短时练习有边界，本人随时可以停止</h4>
      <p>短专注以本人同意并集中注意为前提，精神影响仍可能被抵抗；重视保管责任的人可以真实拒绝。首次拒绝继续保留，后续跨周修订仅限已公开的旁观说明，准备与实施分别提交。三项主实践可和平完成本阶段消化；有限后门冲突另行选择。</p>
      <p className="slice-muted">心理学隐身只影响注意与察觉，身体仍在场，须绕开原物；讲话会立即结束本次效果。场内效果短时且有界，本人随时可以停止；这里是游戏情境，不是真实治疗，也不能据此认定供词为真。梦境操纵与永久人格改写不属于本阶段能力。</p>
    </section>}
    {hypnotist.promoted && hypnotist.environment && <section aria-label="当前催眠师现场">
      <h4>当前现场</h4><p>{hypnotist.environment}</p>
    </section>}
    {selectedCase && <section aria-label="催眠师有限实践">
      <h3>本人回应、有限准备与实际结果</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || hypnotist.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {hypnotist.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前催眠师实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次接触：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="公开观察与原拒绝记录"><h4>公开观察与原拒绝记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际核对记录；不能把猜测当作事实，也没有可据此认定的同意。</p>}
        </section>
        <section aria-label="有限练习与准备"><h4>有限练习与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的练习。选择准备不会提前获得同意、产生效果或改写原拒绝。"}</p>
        </section>
        {selectedCase.result && <section aria-label="本人回应与实际结果" aria-live="polite" aria-atomic="true">
          <h4>本人回应与实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前催眠师实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">普通方法保留自己的条件与结果。撤回准备不等于实际退出；结束接触不会退还精神或灵性，也不会抹去原拒绝、失败与已提交报告。是否可执行与成本以公开按钮为准。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="催眠师成长行动">{growthActions.map(actionButton)}</div>}
    {hypnotist.story && <p className="slice-muted">{hypnotist.story}</p>}
    {encounterActions.length > 0 && <section aria-label="有限后门冲突">
      <h3>有限后门冲突</h3>
      <p className="slice-muted">可按公开选项与罗温交涉，或承担普通短棍战的实际风险。精神影响不保证成功，选择战斗也不会提前取得胜利。</p>
      <div className="warrior-action-list" role="group" aria-label="后门冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {hypnotist.discovered && hypnotist.supplies && <section className="slice-notice" aria-label="催眠师成品原瓶供给">
      <h4>成品原瓶与实际供给</h4><p>{hypnotist.supplies}</p>
    </section>}
    {hypnotist.discovered && hypnotist.bottles.length > 0 && <details className="seer-fold" open={!hypnotist.promoted}>
      <summary>催眠师独立成品原瓶 · 来源与去向</summary>
      {hypnotist.bottles.map((bottle) => {
        const action = hypnotist.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !hypnotist.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !hypnotist.promoted && !hypnotist.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `hypnotist-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`hypnotist-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {hypnotist.discovered && !hypnotist.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{hypnotist.risk}</p></details>}
    {hypnotist.promoted && <section aria-label="催眠师能力与消化">
      <h3>能力与消化 · {hypnotist.abilities.length} 项训练记录</h3>
      <p>扮演进度 {hypnotist.acting} · 消化：{hypnotist.digestion}</p>
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {hypnotist.pollution}</p>
      {hypnotist.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
