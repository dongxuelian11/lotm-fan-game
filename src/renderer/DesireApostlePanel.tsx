import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DesireApostleAction, DesireApostleCommand, DesireApostleProjection } from "../domain/desire-apostle/types";
import type { DemonProjection } from "../domain/demon/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已有公开观察", PREPARED: "已准备，按当前公开选项继续",
  EXAMINED: "已有实际结果，待结束与报告", RESOLVED: "已提交有限报告",
};
const BODY_LABELS = { NORMAL: "正常身体", ENLARGED: "原记录中的临时魔化增大尚在" } as const;
const FLAME_LABELS = { NONE: "原冷火盆尚未点燃", LIT: "同一原火盆的有限火焰仍在", EXTINGUISHED: "同一原火盆已实际盖熄" } as const;

/** Original S6 consequences, bodies, fire, abilities and bottles are history, never new intents. */
export function DesireApostleDemonHistory({ demon,currentTitle="欲望使徒（序列5）" }: { demon: DemonProjection;currentTitle?:string }) {
  return <section className="seer-panel warrior-panel" aria-label="恶魔时期的经历">
    <h3>恶魔时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留恶魔时期的原故事、有限预感、身体与火盆、张力、失败、独立原瓶和旧现场后果，只供回看。</p>
    <p>恶魔扮演进度 {demon.acting} · 消化：{demon.digestion}</p>
    {demon.story && <p>{demon.story}</p>}
    {demon.environment && <p>{demon.environment}</p>}
    {demon.supplies && <p>{demon.supplies}</p>}
    <details className="seer-fold" aria-label="恶魔原身体、火盆与张力记录">
      <summary>原身体、火盆与张力</summary>
      <dl className="seer-facts">
        <div><dt>原冲动张力</dt><dd>{demon.strain} / 3</dd></div>
        <div><dt>原身体状态</dt><dd>{BODY_LABELS[demon.practice.body]}</dd></div>
        <div><dt>同一原火盆</dt><dd>{FLAME_LABELS[demon.practice.flame]}</dd></div>
        <div><dt>原污染记录</dt><dd>{demon.pollution}</dd></div>
      </dl>
    </details>
    {demon.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {demon.bottles.length > 0 && <details className="seer-fold">
      <summary>恶魔原瓶 · 来源与去向</summary>
      {demon.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {demon.risk && <details className="seer-fold"><summary>恶魔原服用风险</summary><p>{demon.risk}</p></details>}
    {demon.abilities.length > 0 && <details className="seer-fold">
      <summary>恶魔时期能力记录</summary>
      {demon.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">旧实践不重新结算或发奖，不补火盆、原瓶或资源，不改写旧莫顿冲突的实际后果。原序列6及更低序列能力ID、掌握与风险继续保留；新情绪实践不会覆盖旧失败。</p>
  </section>;
}

export interface DesireApostlePanelProps {
  desireApostle: DesireApostleProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DesireApostleCommand) => void;
}

function isCaseAction(action: DesireApostleAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: DesireApostleAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function allowedCaseAction(action: DesireApostleAction): boolean {
  if (action.command.type === "CATALYZE") return action.command.caseId === "eager-rehearsal";
  return action.command.type !== "PREPARE" || action.command.method !== "ABILITY" || action.command.caseId === "eager-rehearsal";
}

/** Display committed public facts and forward exact projected commands. Never infer a mind from prose. */
export function DesireApostlePanel({ desireApostle, resources, busy, blocked = false, error = null, onCommand }: DesireApostlePanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = desireApostle.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = desireApostle.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = desireApostle.actions.filter(isCaseAction).filter(allowedCaseAction);
  // The public CATALYZE intent identifies the paid PLANTED phase, even when disabled for low S.
  // PREPARED alone is ambiguous: it also describes an unstarted preparation.
  const catalysisAction = caseActions.find((action) => action.command.type === "CATALYZE");
  const pendingSeed = !!catalysisAction;
  const sceneOpen = desireApostle.insideCase || pendingSeed;
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const openCaseId = catalysisAction?.command.type === "CATALYZE" ? catalysisAction.command.caseId
    : closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (sceneOpen ? desireApostle.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? desireApostle.cases.find((entry) => entry.id === selectedCaseId)
    ?? desireApostle.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? desireApostle.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!sceneOpen || action.command.type === "CLOSE" || (pendingSeed && action.command.type === "CATALYZE"))) : [];
  const encounterActions = sceneOpen ? [] : desireApostle.actions.filter(isEncounterAction);
  const growthActions = sceneOpen ? [] : desireApostle.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = sceneOpen ? (catalysisAction?.enabled ? catalysisAction : closeAction ?? catalysisAction) : !desireApostle.promoted
    ? desireApostle.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !desireApostle.promoted && !sceneOpen;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;
  const caseStatus = (id: string, status: string) => pendingSeed && id === openCaseId
    ? "已实际埋种，尚未催化" : CASE_STATUS[status] ?? "状态待核实";

  useEffect(() => {
    if (selectedCase && (sceneOpen || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, sceneOpen]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || desireApostle.promoted || sceneOpen)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, desireApostle.promoted, sceneOpen]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: DesireApostleAction) {
    if (busy || interactionBlocked || sceneOpen || desireApostle.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || desireApostle.promoted || sceneOpen) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: DesireApostleAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `desire-apostle-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`desire-apostle-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel desire-apostle-panel seer-confirmation" aria-label="这瓶欲望使徒魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方与晋升仪式细节仍待核实；本次只确认本作原创G导师准备与指导流程中的这一成品原瓶，不表示无需仪式，也不虚构仪式材料或步骤。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="欲望使徒服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{desireApostle.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{desireApostle.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="desire-apostle-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "desire-apostle-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel desire-apostle-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="欲望使徒成长下一步">
      <span className="seer-seal">{desireApostle.promoted ? "欲望使徒5" : "恶魔6 → 欲望使徒5"}</span>
      <h3>{desireApostle.title}</h3>
      {desireApostle.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>{pendingSeed ? "继续催化或结束本次实践：" : "下一步："}</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : sceneOpen ? "请查看当前公开的结束实践选项。"
          : desireApostle.promoted && desireApostle.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{desireApostle.digestion}</p>
      {desireApostle.discovered && !desireApostle.promoted && <p className="slice-muted">用药指导：{desireApostle.guidanceKnown ? "已听取" : "尚未听取"}{playerText("。须完成恶魔消化100与十二个完整序列6周；G指导460便士。每瓶4800便士，或5步劳务抵4200便士后付600便士。指导、劳务、付款与逐瓶确认分别进行；准备期间仍可继续普通生活。")}</p>}
      <p className="slice-muted">{playerText("完整魔药配方与晋升仪式细节尚未核实，不能据此断言无需仪式。本阶段采用本作原创G的独立成品渠道、导师准备与指导服药流程，不提供虚构材料表。")}</p>
    </section>

    {desireApostle.promoted && desireApostle.environment && <section aria-label="当前欲望使徒现场"><h4>当前现场</h4><p>{desireApostle.environment}</p></section>}
    {desireApostle.promoted && desireApostle.practice && <section className="slice-notice" aria-label="已保存的公开情绪、种子与原记录" aria-live="polite" aria-atomic="true">
      <h3>公开条件与实际原物</h3>
      <dl className="seer-facts">
        <div><dt>本次公开情绪条件</dt><dd>{desireApostle.practice.emotion}</dd></div>
        <div><dt>本次种子与催化</dt><dd>{desireApostle.practice.seed}</dd></div>
        <div><dt>原账簿与原记录纸</dt><dd>{desireApostle.practice.records}</dd></div>
      </dl>
      <p className="slice-muted">这里只显示本人表述、现场可见表现与已发生的实践记录，不读取隐藏思想。准备不提前埋种；点击后仍须等实际结果保存，才更新情绪、种子或原物去向。</p>
      {desireApostle.practice.history.length > 0 && <details className="seer-fold">
        <summary>实际尝试、消耗与结束记录</summary>
        <ul>{desireApostle.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      </details>}
    </section>}
    {selectedCase && <section aria-label="欲望使徒有限实践">
      <h3>平稳边界、自愿排练与如实记录</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || sceneOpen} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {desireApostle.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {caseStatus(entry.id, entry.status)}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前欲望使徒实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{caseStatus(selectedCase.id, selectedCase.status)} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；先听取在场成年人的明确表述，并核对可见表现与同一原物。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || (pendingSeed ? "本次准备已经实际执行并成功埋种；当前只待选择催化或结束，不能重新执行或当作尚未开始撤回。" : "当前没有待执行的实践。准备只记录这次有限同意与方法，不改变他人的情绪，不提前获得种子、催化结果或报告。")}</p>
        </section>
        {selectedCase.id === "calm-boundary" && <p className="slice-muted">蕾娜当前心情平稳，强烈情绪或明显欲望的入口不成立。本项只提供普通核对与原账簿借还，不提供耗灵性强行制造情绪的尝试。</p>}
        {selectedCase.id === "honest-account" && <p className="slice-muted">本项只用普通方法写下已有公开事实。原纸DA5-NOTE-1上的实际文字与失败保留；结束时把同一张原纸交还指导者，不作诊断或秘密思想断言。</p>}
        {selectedCase.id === "eager-rehearsal" && !pendingSeed && <p className="slice-muted">{playerText("米蕾尔为自选舞台排练兴奋，并明确同意本次有限G试验。能力准备耗1行动；实际埋种另耗1行动、3灵性，成功后催化再耗2灵性、0额外行动。开始前建议至少5灵性；仅有3灵性仍可按公开条件尝试埋种，之后也可选择结束，不强迫催化。普通交谈不埋种、不耗灵性。")}</p>}
        {pendingSeed && <section className="slice-notice" aria-label="待处理的实际种子">
          <h4>种子已实际埋下，尚未催化</h4>
          <p>本次埋种已实际支付1行动与3灵性。催化须另付2灵性、0额外行动，并按知识14判定；成功才会出现本次约定的短暂可见停顿，失败仍消耗这2灵性。尚未获得催化结果或报告奖励。</p>
          <p>{playerText("可以选择催化，也可以0行动、0精神、0灵性结束：停止这次自愿约定的实践，并等过本作G的单次有限窗口。尚未催化的种子随后到期；不退还原消耗，不抹去尝试，也不代表全局净化能力。")}</p>
        </section>}
        {selectedCase.result && <section className="slice-notice" aria-label="欲望使徒实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前欲望使徒实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {sceneOpen && <p className="slice-muted">当前仍在原室；结束须实际返还原账簿、交回已写原纸，或停止这次排练试验。0行动、0精神、0灵性仍可使用公开的结束选项；不另抽随机、不退款、不治疗、不抹去失败。完成真实结束后，才可报告或返回其它活动。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="欲望使徒成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="欲望使徒有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">成年看守费兰持自己的普通短棍，站在两米外的日光空院中；真实出口清楚，对方不追击，现场没有其他人。可以交涉，或承担真实伤势与死亡风险。</p>
      <p className="slice-muted">{playerText("只有实际开场时，他因本作G的约定误会明确表达愤怒并表现激动，才提供本场强烈情绪来源。费兰自己的普通「寻找空当」行动可在稳住情绪后执行；一旦平稳，K不能继续埋种或催化。受伤不会自动使他再度愤怒，R只观察当前公开条件。")}</p>
      <div className="warrior-action-list" role="group" aria-label="欲望使徒冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {desireApostle.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{desireApostle.story}</p></details>}
    {desireApostle.discovered && desireApostle.supplies && <section className="slice-notice" aria-label="欲望使徒成品来源与取得"><h4>实际供给与独立原瓶</h4><p>{desireApostle.supplies}</p></section>}
    {desireApostle.discovered && desireApostle.bottles.length > 0 && <details className="seer-fold" open={!desireApostle.promoted}>
      <summary>欲望使徒独立成品原瓶 · 来源与去向</summary>
      {desireApostle.bottles.map((bottle) => {
        const action = desireApostle.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !desireApostle.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !desireApostle.promoted && !sceneOpen && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `desire-apostle-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`desire-apostle-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {desireApostle.discovered && !desireApostle.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{desireApostle.risk}</p></details>}
    {desireApostle.promoted && <section aria-label="欲望使徒能力与消化">
      <h3>能力与消化 · {desireApostle.abilities.length} 项训练记录</h3>
      <p>扮演进度 {desireApostle.acting} · 消化：{desireApostle.digestion}</p>
      <progress className="cryptologist-progress" aria-label="欲望使徒扮演进度" value={desireApostle.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {desireApostle.pollution}</p>
      {desireApostle.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="欲望使徒能力边界">
        <summary>查看情绪入口、实际消耗与有限催化</summary>
        <p>强烈情绪波动或明显欲望是埋种与催化的实际入口；情绪平稳、欲望内敛时条件不成立。现场可见表现与本人表述只说明这次已知条件，不能推出隐藏思想、记忆、真相或完整人格。</p>
        <p>{playerText("第一、第三项只提供普通方法。第二项使用原成年志愿者自选排练的已有兴奋与明确同意，普通方法只是交谈与本人愿意的短暂停顿。同意属于本作原创G故事安排，不是原著能力必需的通用魔法条件。")}</p>
        <p>埋种成功只建立本次待用种子，不立刻造成催化效果。实际催化再付2灵性，成功只出现一次约定的可见短暂停顿；不强迫忠诚、投降或交出秘密。两段判定失败均保留真实消耗，须结束本次接触后等下一真实周重试。</p>
        <p>{playerText("三项有限报告各25与反思25组成本作原创G和平消化100，全部采用普通方法也可完成。只有实际成功的能力催化报告才提供8点知识池掌握；普通方法、准备、单独埋种、结束或重复报告不伪增能力掌握。这不保证原著中的无风险完美扮演。")}</p>
        <p>{playerText("战斗K在实际强烈情绪下分两次：无待用种子时付3灵性埋种，有种子时另付2灵性催化，均按知识14判定。催化成功仅令本轮对方下一次有效普通打击贡献乘0.5一次，不立刻扣健康或控制整个人；催化失败也耗去本次种子。种子有本作G的两回合窗口，同回合用过后不重新埋种，战斗结束清除待用效果。R不耗灵性、只观察当前公开情绪与种子，不创造情绪或预知后续轮盘。")}</p>
        <p>原恶魔火焰、身体、魔化与张力规则、能力ID和掌握继续继承。个体燃角激化或舍身留影不作为所有欲望使徒的默认能力；本阶段不提供全目标秒杀、自动停心或万能控心。序列4魔鬼尚未开放，未把污秽君王当作下一序列。</p>
        <p>{playerText("原成年人物、原账簿DA5-LEDGER-1、原纸DA5-NOTE-1、有限窗口、距离、消耗、判定与消化数值均为本作原创G。原物须实际交还，所有人仍在原现场；结束本次自愿试验不是通用诅咒净化，也不提供现实心理或医疗操作。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
