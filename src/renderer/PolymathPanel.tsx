import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PolymathAction, PolymathCommand, PolymathProjection } from "../domain/polymath/types";
import type { DetectiveProjection } from "../domain/detective/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对事实",
  OBSERVED: "已有亲见示范记录，分析另行核对",
  PREPARED: "已准备待执行的有限实践",
  EXAMINED: "已有模仿或普通对照的实际结果",
  RESOLVED: "已提交本次有限报告",
};

const DETECTIVE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察", SURVEYED: "已有现场残留", RECONSTRUCTED: "已有实际重构记录", RESOLVED: "已有报告结果",
};

/** The original traces, gaps and conclusions stay read-only, even if old actions remain public. */
export function PolymathDetectiveHistory({ detective }: { detective: DetectiveProjection }) {
  return <section className="seer-panel warrior-panel detective-panel" aria-label="守知者时期的经历">
    <h3>守知者时期的经历</h3>
    <p className="slice-notice">你已晋升博学者。这里保留守知者时期的现场痕迹、重构、证据缺口、原结论、原瓶与能力，只供回看；旧成长不会在序列6再次结算扮演进度。</p>
    <p>守知者扮演进度 {detective.acting} · 消化：{detective.digestion}</p>
    {detective.story && <p>{detective.story}</p>}
    {detective.supplies && <p>{detective.supplies}</p>}
    {detective.environment && <p>{detective.environment}</p>}
    {detective.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {DETECTIVE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.traces.length > 0 && <section aria-label={`${entry.title}的原现场痕迹`}>
        <h4>当时的现场痕迹</h4><ul>{entry.traces.map((trace, index) => <li key={`${entry.id}-trace-${index}`}>{trace}</li>)}</ul>
      </section>}
      {entry.gaps.length > 0 && <section aria-label={`${entry.title}的原证据缺口`}>
        <h4>保留的证据缺口</h4><ul>{entry.gaps.map((gap, index) => <li key={`${entry.id}-gap-${index}`}>{gap}</li>)}</ul>
      </section>}
      {entry.reconstruction && <p>当时的实际重构：{entry.reconstruction}</p>}
      {entry.result && <p>当时的结论与报告：{entry.result}</p>}
    </details>)}
    {detective.bottles.length > 0 && <details className="seer-fold" open>
      <summary>守知者原瓶 · 来源与去向</summary>
      {detective.bottles.map((bottle) => <article className="detective-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {detective.abilities.length > 0 && <details className="seer-fold">
      <summary>守知者时期能力记录</summary>
      {detective.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface PolymathPanelProps {
  polymath: PolymathProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: PolymathCommand) => void;
}

function isCaseAction(action: PolymathAction): boolean {
  return "caseId" in action.command;
}
function isEncounterAction(action: PolymathAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render only public samples, separate analysis and imitation records, and committed results. */
export function PolymathPanel({ polymath, resources, busy, blocked = false, error = null, onCommand }: PolymathPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = polymath.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = polymath.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = polymath.actions.filter(isCaseAction);
  // Only a public CLOSE intent identifies the open scene; old failure prose cannot lock it.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (polymath.insideCase ? polymath.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? polymath.cases.find((entry) => entry.id === selectedCaseId)
    ?? polymath.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? polymath.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!polymath.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = polymath.insideCase ? [] : polymath.actions.filter(isEncounterAction);
  const growthActions = polymath.insideCase ? [] : polymath.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = polymath.insideCase ? closeAction : !polymath.promoted
    ? polymath.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !polymath.promoted && !polymath.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (polymath.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, polymath.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || polymath.promoted || polymath.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, polymath.promoted, polymath.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: PolymathAction) {
    if (busy || interactionBlocked || polymath.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || polymath.promoted || polymath.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: PolymathAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `polymath-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`polymath-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel detective-panel seer-confirmation" aria-label="这瓶博学者魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="博学者服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{polymath.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{polymath.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="polymath-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "polymath-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试回执。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel detective-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="博学者成长下一步">
      <span className="seer-seal">{polymath.promoted ? "序列 6" : "博学者晋升卷宗"}</span>
      <h3>{polymath.title}</h3>
      <p className="seer-next">{polymath.insideCase
        ? <><strong>先实际结束本次示范或练习：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束示范与短效、归还原杯并实际离场为0行动、0精神、0灵性；不另抽随机、不奖励、不退款、不治疗，原失败与实际记录继续保留。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{polymath.digestion}</p>
      {!polymath.promoted && <p className="slice-muted">服用前须完成守知者消化100与十二个完整序列7周。指导、每瓶劳务、付款取得成品与逐瓶确认分别进行，实际费用、成熟条件与下一周补给以当前公开记录为准；准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与剂量仍未核实，指导仅说明有来源的独立成品原瓶。模仿须有实际亲见与分析依据，只尝试较弱的有限效果；看见、分析与成功模仿分别记录。具体故事、判定、费用与消化数值为本作原创G。")}</p>
    </section>

    {polymath.promoted && <section className="slice-notice" aria-label="博学者能力边界">
      <h4>亲见、分析与有限模仿分别成立</h4>
      <p>先亲见成年教师本人自愿作出的低强度示范，再分析实际样本；分析成功仍不保证模仿成功。闪光、薄冰与鼓舞各有来源，只有实际成功的弱化模仿才记为已成功模仿。三项主实践可和平完成本阶段消化；普通对照保留自己的结果，不授予已学样本。</p>
      <p className="slice-muted">闪光仅是有限光照，不造成伤害；薄冰只作用于约定杯水，原杯须归还；鼓舞只面对自愿成年人，不控制心智，也不制造忠诚，本人可以停止。有限模仿不会获得完整技能库、任意高序列能力或途径权柄；2-081的案例不赠送任何样本。</p>
    </section>}
    {polymath.promoted && <section aria-label="亲见样本与学习记录">
      <h3>亲见样本与学习记录</h3>
      <p className="slice-muted">仅展示当前公开的样本；看见不等于理解，理解不等于学会。记录只随已保存的实际结果更新。</p>
      {polymath.samples.length > 0 ? polymath.samples.map((sample) => <article className="seer-current-case" key={sample.id} aria-label={sample.label}>
        <h4>{sample.label}</h4><p>来源：{sample.source}</p>
        <dl className="seer-facts">
          <div><dt>亲见示范</dt><dd>{sample.observed ? "已亲见" : "尚未亲见"}</dd></div>
          <div><dt>分析结果</dt><dd>{sample.understood ? "已分析成功" : "尚未分析成功"}</dd></div>
          <div><dt>模仿结果</dt><dd>{sample.learned ? "已成功模仿" : "尚未成功模仿"}</dd></div>
        </dl>
        <p className="slice-muted">{sample.boundary}</p>
      </article>) : <p className="slice-muted">尚无已公开的亲见样本。按当前实践的公开选项亲见实际示范后，再核对分析与模仿记录。</p>}
    </section>}
    {polymath.promoted && polymath.environment && <section aria-label="当前博学者现场">
      <h4>当前现场</h4><p>{polymath.environment}</p>
    </section>}
    {selectedCase && <section aria-label="博学者有限实践">
      <h3>亲见示范、分析样本与有限模仿</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || polymath.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {polymath.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前博学者实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次示范或练习：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="亲见示范与原失败记录"><h4>亲见示范与原失败记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际亲见记录；样本来源、成年教师本人的意愿与实际分析均须分别核对，不能只凭能力名称认定已学会。</p>}
        </section>
        <section aria-label="有限实践与准备"><h4>有限实践与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择准备不会提前完成分析、学会样本、取得本人同意或改写原失败。"}</p>
        </section>
        {selectedCase.result && <section aria-label="有限模仿与实际结果" aria-live="polite" aria-atomic="true">
          <h4>有限模仿与实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前博学者实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">普通方法只提交普通对照结果，不授予已学样本。撤回准备不等于实际退出；结束示范与短效、归还原杯并实际离场不会退还精神或灵性，也不会抹去失败与已提交报告。零行动仍可按公开结束选项退出，再提交报告；是否可执行与成本以公开按钮为准。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="博学者成长行动">{growthActions.map(actionButton)}</div>}
    {polymath.story && <p className="slice-muted">{polymath.story}</p>}
    {encounterActions.length > 0 && <section aria-label="有限现场冲突">
      <h3>有限现场冲突</h3>
      <p className="slice-muted">先结束本次示范与练习，再按公开选项交涉，或承担普通短棍战的实际风险。样本学习不会自动附送战斗效果，有限模仿不保证战斗成功，选择战斗也不会提前取得胜利。</p>
      <div className="warrior-action-list" role="group" aria-label="现场冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {polymath.discovered && polymath.supplies && <section className="slice-notice" aria-label="博学者成品原瓶供给">
      <h4>成品原瓶与实际供给</h4><p>{polymath.supplies}</p>
    </section>}
    {polymath.discovered && polymath.bottles.length > 0 && <details className="seer-fold" open={!polymath.promoted}>
      <summary>博学者独立成品原瓶 · 来源与去向</summary>
      {polymath.bottles.map((bottle) => {
        const action = polymath.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !polymath.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !polymath.promoted && !polymath.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `polymath-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`polymath-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {polymath.discovered && !polymath.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{polymath.risk}</p></details>}
    {polymath.promoted && <section aria-label="博学者能力与消化">
      <h3>能力与消化 · {polymath.abilities.length} 项训练记录</h3>
      <p>扮演进度 {polymath.acting} · 消化：{polymath.digestion}</p>
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {polymath.pollution}</p>
      {polymath.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
