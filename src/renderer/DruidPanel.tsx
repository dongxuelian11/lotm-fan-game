import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DruidAction, DruidCommand, DruidProjection } from "../domain/druid/types";
import type { BiologistProjection } from "../domain/biologist/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察本次现场", OBSERVED: "已有实际观察", PREPARED: "已准备，尚未执行",
  EXAMINED: "已有实际结果，须实际收束", RESOLVED: "已收束并提交报告",
};
const POSITION = { NEAR: "近端（NEAR）", FAR: "远端（FAR）" } as const;
const MARKER = { BOX: "原收纳盒（BOX）", NEAR: "近端（NEAR）", FAR: "远端（FAR）" } as const;
const TRIAL_STATUS = {
  IDLE: "尚无成功试验记录", WAITING: "已有试验记录，尚未实际复核",
  VERIFIED: "已实际复核，有限结论保留", RETURNED: "已实际归还原主伊芙",
} as const;

/** Keep the actual S6 account visible without exposing historical mutation controls. */
export function DruidBiologistHistory({ biologist, currentTitle = "德鲁伊（序列5）" }: { biologist: BiologistProjection; currentTitle?: string }) {
  return <section className="seer-panel biologist-panel" aria-label="生物学家时期的经历">
    <h3>生物学家时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留生物学家时期的原样本、同一原苗、实际用水、跨周复核、归还、失败、报告与独立原瓶，只供回看。</p>
    <p>生物学家扮演进度 {biologist.acting} · 消化：{biologist.digestion}</p>
    <details className="seer-fold"><summary>生物学家原故事、现场与供给</summary>
      {biologist.story && <p>{biologist.story}</p>}{biologist.environment && <p>{biologist.environment}</p>}{biologist.supplies && <p>{biologist.supplies}</p>}
    </details>
    <details className="seer-fold"><summary>原样本、同一原苗与实际用水</summary>
      <p>原封样本记录：{biologist.practice.sampleRecorded ? "已实际记录" : "尚未完成"}</p>
      <p>原有限结论与未知警告：{biologist.practice.warningsRecorded ? "已实际记录" : "尚未完成"}</p>
      <p>同一原苗：{TRIAL_STATUS[biologist.trial.status]}</p>
      <p>原苗位置：{biologist.trial.location === "OWNER" ? "已当面交回原主伊芙" : "仍在原温室台"}</p>
      <p>原试验开始：{biologist.trial.careWeek === null ? "尚无成功记录" : `第${biologist.trial.careWeek}周`}</p>
      <p>原实际复核：{biologist.trial.verifiedWeek === null ? "尚未实际复核" : `第${biologist.trial.verifiedWeek}周`}</p>
      <p>生物学家阶段实际用水：{biologist.trial.waterUsed}份</p><p>{biologist.water.summary}</p>
    </details>
    {biologist.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status === "RESOLVED" ? "已收束并提交原报告" : "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen}</p><p>当时实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {biologist.bottles.length > 0 && <details className="seer-fold"><summary>生物学家原瓶 · 来源与去向</summary>
      {biologist.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4>
        <p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {biologist.abilities.length > 0 && <details className="seer-fold"><summary>生物学家时期能力记录</summary>
      {biologist.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface DruidPanelProps {
  druid: DruidProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DruidCommand) => void;
}
function isCaseAction(action: DruidAction) { return "caseId" in action.command; }
function isReleaseAction(action: DruidAction) { return action.command.type === "RETURN" || action.command.type === "CLOSE"; }
function isEncounterAction(action: DruidAction) { return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT"; }

/** Only saved public projections change physical positions, ritual records or bottles. */
export function DruidPanel({ druid, resources, busy, blocked = false, error = null, onCommand }: DruidPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = druid.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = druid.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = druid.actions.filter(isCaseAction);
  const releaseActions = caseActions.filter(isReleaseAction);
  // A live projected return/close pins the scene. Historical result prose cannot identify it.
  const releaseAction = releaseActions.find((action) => action.enabled)
    ?? releaseActions.find((action) => action.command.type === "RETURN") ?? releaseActions[0];
  const releaseCaseId = releaseAction && "caseId" in releaseAction.command ? releaseAction.command.caseId : null;
  const selectedCase = (druid.insideCase ? druid.cases.find((entry) => entry.id === releaseCaseId) : undefined)
    ?? druid.cases.find((entry) => entry.id === selectedCaseId)
    ?? druid.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? druid.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!druid.insideCase || isReleaseAction(action))) : [];
  const studyActions = !druid.promoted && !druid.insideCase ? druid.studies.map((study) => study.action) : [];
  const growthActions = druid.insideCase ? [] : druid.actions.filter((action) => action.command.type !== "CONSUME" && action.command.type !== "STUDY"
    && !isCaseAction(action) && !isEncounterAction(action));
  const encounterActions = druid.insideCase ? [] : druid.actions.filter(isEncounterAction);
  const nextAction = druid.insideCase ? releaseAction : !druid.promoted
    ? druid.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? [...growthActions, ...studyActions].find((action) => action.enabled) ?? growthActions[0] ?? studyActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled) ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !druid.promoted && !druid.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => { if (selectedCase && (druid.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id); }, [selectedCase, selectedCaseId, druid.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || druid.promoted || druid.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, druid.promoted, druid.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: DruidAction) {
    if (busy || interactionBlocked || druid.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || druid.promoted || druid.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: DruidAction) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        aria-describedby={action.reason ? `druid-reason-${action.id}` : undefined}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`druid-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section className="seer-panel druid-panel seer-confirmation"
    aria-label="这瓶德鲁伊魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); } }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div><h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div><div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div><div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice" aria-label="本瓶实际仪式准备"><h4>本瓶实际仪式准备</h4>
      <p>{druid.ritual.notebook}</p><p>{druid.ritual.recordStatus}</p><p>{druid.ritual.readyStatus}</p>
      <p>实际服用即耗用这一原瓶与本次准备；无论成功或失败，下瓶都须重新付费准备。已有学习和亲笔记录保留。</p>
    </section>
    <section className="slice-notice seer-risk" aria-label="德鲁伊服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{druid.risk}</p></section>
    <section className="seer-current-resources" aria-label="服药前当前资源"><h4>你现在的状态</h4><dl className="seer-facts">
      <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div><div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{druid.pollution}</dd></div>
      <div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
    </dl></section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="druid-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "druid-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>{saveNotice}
  </section>;

  return <div className="seer-panel druid-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="德鲁伊成长下一步">
      <span className="seer-seal">{druid.promoted ? "序列 5" : "德鲁伊晋升卷宗"}</span><h3>{druid.title}</h3>
      <p className="seer-next">{druid.insideCase
        ? <><strong>先沿实际路线返回并收束：</strong>{nextAction?.label || "查看当前公开的返程与结束选项"}。身体回到近端后才能收好原标记；点击不会提前改变位置。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : druid.promoted && druid.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{druid.digestion}</p>
      {!druid.promoted && <p className="slice-muted">{playerText("须完成生物学家消化100与十二个完整序列6周。G指导460便士；每瓶4800便士，或5步劳务抵扣4200便士后付600便士。逐瓶确认，按意志26四档结算；失败仍耗用原瓶，实际排异与污染保留，可休养后另取独立原瓶重试。")}</p>}
      {!druid.promoted && <p className="slice-muted">{playerText("已核实的仪式部分要求积累多种普通动物与三种超凡生物的习性、身体构造知识，并亲笔写出知识和经历。完整配方、材料剂量与其余完整仪式步骤尚未核实；独立G成品不能代替这些实际学习与记录。")}</p>}
    </section>

    {druid.discovered && <section aria-label="德鲁伊实际学习与晋升准备"><h3>实际学习、亲笔记录与本瓶准备</h3>
      <p className="slice-muted">{playerText("按公开条件亲自阅读原教学记录，与伊芙核对并写下小记；借阅原页在本次学习结束时归还。具体资料柜、教学图录、课程与普通动物选择是本作G原创安排，不展示未读知识或活体实验。")}</p>
      {druid.studies.map((study) => <article className="seer-current-case" key={study.id} aria-label={`${study.title}学习记录`}>
        <h4>{study.title}</h4><p>资料来源：{study.source}</p><p>本册对象：{study.creatures.join("、")}</p>
        <p>{study.status}</p><p className="slice-muted">已保存的学习结果：{study.completed ? "本项已完成" : "本项尚未完成"}</p>
        {!druid.promoted && !druid.insideCase && actionButton(study.action)}
      </article>)}
      <section className="slice-notice" aria-label="同一本亲笔笔记与仪式准备"><h4>同一本亲笔笔记与仪式准备</h4>
        <p>{druid.ritual.notebook}</p><p>{druid.ritual.recordStatus}</p><p>{druid.ritual.readyStatus}</p>
        <p>实际准备次数：{druid.ritual.attempts}</p><p>{druid.ritual.summary}</p>
        <p className="slice-muted">{playerText("四项学习完成后，仍须实际写成总记录，再由伊芙核对原笔记、准备原安静园室。每次准备1行动、90便士；其余安排明确为G适配，不冒充已核完整仪式。失败的学习与写作须按公开条件等下一真实周重试，已有笔记保留。")}</p>
      </section>
    </section>}

    {druid.promoted && druid.environment && <section aria-label="当前德鲁伊现场"><h4>当前现场</h4><p>{druid.environment}</p></section>}
    {druid.promoted && <section className="slice-notice" aria-label="实际身体、原标记与原物"><h3>实际身体与原物</h3>
      <p>身体位置：{POSITION[druid.practice.position]}</p><p>原标记 DR5-MARKER-1：{MARKER[druid.practice.marker]}</p>
      <p>原土段：{druid.practice.soil === "SOFTENED" ? "暂时软化（SOFTENED）" : "已恢复稳定（SETTLED）"}</p>
      <p>本次能力返程：{druid.practice.returnAttempted ? "已尝试，仍在远端时请走普通退路" : "尚未尝试"}</p>
      <p>两株原苗 DR5-SEEDLING-A/B：{druid.practice.seedlings === "OBSERVED" ? "已实际观察，仍在各自原植床" : "安放于各自原植床"}</p>
      <p>原记录纸 DR5-LIFE-NOTE-1：{druid.practice.note === "HANDED_OVER" ? "已实际交回" : druid.practice.note === "WRITTEN" ? "已实际写下，尚未交回" : "尚未写下本次记录"}</p>
      <p className="slice-muted">地下去程3灵性，另选能力返程再付3灵性并独立判定，能力往返合计6灵性。也可从远端沿原干燥短路步行返回：0行动、0精神、0灵性；即使能力返程失败或灵性为0，这条原普通退路仍可使用。</p>
      <p className="slice-muted">实际身体与同一原标记一起移动。返回近端后再实际收好标记并结束，结束不传送、不治疗、不退款；这里只显示已保存的位置与原物状态。</p>
    </section>}

    {selectedCase && <section aria-label="德鲁伊有限实践"><h3>已知土段、原苗观察与如实记录</h3>
      <label className="seer-case-selector">选择当前实践<select value={selectedCase.id} disabled={busy || interactionBlocked || druid.insideCase}
        onChange={(event) => setSelectedCaseId(event.target.value)}>{druid.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}</select></label>
      <section className="seer-current-case" aria-label="当前德鲁伊实践"><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对原现场、原物与退路，不凭说明提前取得实践结论。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4><p>{selectedCase.preparation || "尚未准备。选择方法不会提前移动身体、观察原苗或写成记录；实际结果须执行并保存后才会出现。"}</p></section>
        {selectedCase.result && <section className="slice-notice" aria-label="德鲁伊实际结果" aria-live="polite" aria-atomic="true"><h4>本次实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前德鲁伊实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {druid.insideCase && <p className="slice-muted">只使用当前公开的返程和结束选项。远端须先实际返回近端，收好同一原标记后才可回到生活或提交报告。原苗留在原植床，原记录须实际交妥；撤回准备不能代替收束。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="德鲁伊成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="德鲁伊有限冲突"><h3>园边的有限冲突</h3>
      <p className="slice-muted">只按当前公开现场与马伦交涉或承担冲突；原普通干燥侧路可实际退出，不追击。地下移动须在已知浅层普通壤土中真实短距潜行并出土，支付实际成本；不是无敌、自动闪避或困住敌人的地形法术。继承能力、原伤势与资源继续按实际状态结算。</p>
      <div className="magician-action-list" role="group" aria-label="德鲁伊冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {druid.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{druid.story}</p></details>}
    {druid.discovered && druid.supplies && <section className="slice-notice" aria-label="德鲁伊成品来源与取得"><h4>实际供给与独立原瓶</h4><p>{druid.supplies}</p></section>}
    {druid.discovered && druid.bottles.length > 0 && <details className="seer-fold" open={!druid.promoted}><summary>德鲁伊独立成品原瓶 · 来源与去向</summary>
      {druid.bottles.map((bottle) => {
        const action = druid.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !druid.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !druid.promoted && !druid.insideCase && <div><button className="slice-button" disabled={busy || interactionBlocked || !action.enabled}
            onClick={() => openBottle(action)} ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
            aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`} aria-describedby={action.reason ? `druid-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>{action.reason && <p className="seer-action-reason" id={`druid-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {druid.discovered && !druid.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{druid.risk}</p></details>}
    {druid.promoted && <section aria-label="德鲁伊能力与消化"><h3>能力与消化 · {druid.abilities.length} 项训练记录</h3>
      <p>扮演进度 {druid.acting} · 消化：{druid.digestion}</p><progress className="cryptologist-progress" aria-label="德鲁伊扮演进度" value={druid.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {druid.pollution}</p>
      {druid.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <details className="seer-fold" aria-label="德鲁伊实践与能力边界"><summary>{playerText("查看地下潜行、普通实践与使用范围")}</summary>
        <p>{playerText("本阶段新增地下潜行一项掌握，继承原九项能力与实际掌握。已核原著支持地下潜行及地面软化后恢复，未提供这里的具体距离、速度和消耗；已知1米土段、两端安全出口、费用与成长均为本作G原创适配。")}</p>
        <p>去程实际把自身身体与原标记从近端带到远端。能力返程另付3灵性并判定，每次实践只可尝试一次；失败后沿原普通退路返回。近端、稳定土段才可实际结束，不凭按钮传送，不穿越未知地基、金属或地图外区域。</p>
        <p>两株原苗仅作普通条件下的有限观察，如实记录仅作普通写作与交回。两案不开放能力方法，不催生植物、复制生物或增加作物；普通报告不自动增加地下潜行掌握。</p>
        <p>本阶段不提供具体动物变形形态，也不提供熊、鹰或龙等变形菜单。序列4赋予造物灵魂、神战区域的异常成果与高阶个人实验不作为德鲁伊通用能力。</p>
        <p>原页、笔记、原苗、标记、实际成本与失败持续保留。零成本普通返程和结束只完成原现场动作，不发奖励、不恢复资源、不更改旧死亡记录。</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
