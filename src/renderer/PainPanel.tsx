import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PainAction, PainCommand, PainProjection } from "../domain/pain/types";
import type { PleasureProjection } from "../domain/pleasure/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场",
  OBSERVED: "已有公开观察",
  PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告",
  RESOLVED: "已提交有限报告",
};

/** Keep the original S6 recipe, consumed materials, body change and practice read-only. */
export function PainPleasureHistory({ pleasure }: { pleasure: PleasureProjection }) {
  const practice = pleasure.practice;
  return <section className="seer-panel witch-panel" aria-label="欢愉时期的经历">
    <h3>欢愉时期的经历</h3>
    <p className="slice-notice">你已晋升痛苦魔女（序列5）。这里保留欢愉时期的原配方、七料与原瓶、原身体变化、工具消耗、实际接触与拒绝、原丝破坏及失败，只供回看。</p>
    <p>欢愉扮演进度 {pleasure.acting} · 消化：{pleasure.digestion}</p>
    {pleasure.bodyChange && <p>{pleasure.bodyChange}</p>}
    {pleasure.story && <p>{pleasure.story}</p>}
    {pleasure.environment && <p>{pleasure.environment}</p>}
    {pleasure.supplies && <p>{pleasure.supplies}</p>}
    {pleasure.inheritedTools && <p>{pleasure.inheritedTools}</p>}
    <details className="seer-fold" aria-label="欢愉原接触与原丝记录">
      <summary>原同意、实际接触与原丝记录</summary>
      <dl className="seer-facts">
        <div><dt>原腕部练习同意</dt><dd>{practice.wristConsent ? "已记录当时的自愿同意" : "尚无当时的自愿同意记录"}</dd></div>
        <div><dt>原腕部接触</dt><dd>{practice.wrist === "SILK" ? "原实际丝线接触仍在" : practice.wrist === "CORD" ? "原实际普通绳圈仍在" : "原丝线或绳圈接触已解除"}</dd></div>
        <div><dt>原邀请意愿</dt><dd>{practice.invitationWilling ? "已有当时本人的实际意愿" : "当时本人尚未同意邀请"}</dd></div>
        <div><dt>同一原丝</dt><dd>{practice.fireSilk === "ON_FRAME" ? "已实际架在原练习框上" : practice.fireSilk === "BROKEN" ? "已实际断开，原断丝尚待清理" : practice.fireSilk === "CLEARED" ? "原断丝已实际清理" : "尚未实际建立原丝"}</dd></div>
        <div><dt>原丝实际断开方式</dt><dd>{practice.fireBreak === "BLACK_FLAME" ? "继承黑焰" : practice.fireBreak === "SCISSORS" ? "普通剪刀" : "尚无实际断开记录"}</dd></div>
      </dl>
    </details>
    {pleasure.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {pleasure.formulaKnown && pleasure.formula.length > 0 && <details className="seer-fold" aria-label="欢愉时期已知配方">
      <summary>欢愉时期已知配方</summary>
      <ul className="seer-formula">{pleasure.formula.map((material) => <li key={material.name}>
        <span>{material.name}{material.note && <small>{material.note}</small>}</span>
        <strong>{material.quantity === null ? "" : `${material.quantity} `}{material.unit}</strong>
      </li>)}</ul>
    </details>}
    {pleasure.bottles.length > 0 && <details className="seer-fold">
      <summary>欢愉原瓶 · 来源与去向</summary>
      {pleasure.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {pleasure.abilities.length > 0 && <details className="seer-fold">
      <summary>欢愉时期能力记录</summary>
      {pleasure.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">旧实践不重新结算或发奖，不补原丝、镜片或粉末，不改写原拒绝与旧马伦的实际伤势。原能力ID与掌握保留；晋升序列5不会重复序列7的身体变化。</p>
  </section>;
}

export interface PainPanelProps {
  pain: PainProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: PainCommand) => void;
}

function isCaseAction(action: PainAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: PainAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT" || action.command.type === "ENCOUNTER_AID";
}

/** Render committed public observations and submit the original projected intent unchanged. */
export function PainPanel({ pain, resources, busy, blocked = false, error = null, onCommand }: PainPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = pain.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = pain.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = pain.actions.filter(isCaseAction);
  // Only public exit intents locate a currently open scene; prose is never parsed as state.
  const exitAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "WITHDRAW" && action.enabled);
  const fallbackExit = caseActions.find((action) => action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId
    : fallbackExit && "caseId" in fallbackExit.command ? fallbackExit.command.caseId : null;
  const selectedCase = (pain.insideCase ? pain.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? pain.cases.find((entry) => entry.id === selectedCaseId)
    ?? pain.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? pain.cases[0];
  // Public enabled intents remain usable inside the scene, including zero-resource exits.
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = pain.insideCase ? [] : pain.actions.filter(isEncounterAction);
  const growthActions = pain.insideCase ? [] : pain.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = pain.insideCase ? exitAction ?? fallbackExit : !pain.promoted
    ? pain.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type !== "WITHDRAW")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
      ?? growthActions.find((action) => action.enabled)
      ?? encounterActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !pain.promoted && !pain.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (pain.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, pain.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || pain.promoted || pain.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, pain.promoted, pain.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: PainAction) {
    if (busy || interactionBlocked || pain.insideCase || pain.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || pain.promoted || pain.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: PainAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `pain-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`pain-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel witch-panel pain-panel seer-confirmation" aria-label="这瓶痛苦魔女魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方与晋升仪式细节仍待核实；本次只确认本作原创G导师准备与指导流程中的这一成品原瓶，不表示无需仪式，也不虚构仪式材料或步骤。")}</p>
    {pain.bodyChange && <p className="slice-muted">{pain.bodyChange}</p>}
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="痛苦魔女服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{pain.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{pain.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="pain-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "pain-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel witch-panel pain-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="痛苦魔女成长下一步">
      <span className="seer-seal">{pain.promoted ? "痛苦魔女5" : "欢愉6 → 痛苦魔女5"}</span>
      <h3>{pain.title}</h3>
      {pain.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : pain.insideCase ? "请查看当前公开的结束实践选项。"
          : pain.promoted && pain.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{pain.digestion}</p>
      {pain.discovered && !pain.promoted && <p className="slice-muted">用药指导：{pain.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得原瓶与逐瓶确认分别进行；实际费用、成熟条件与安全恢复范围以公开记录为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与晋升仪式细节尚未核实；材料、剂量、调配顺序及具体仪式要求保持未知，不能据此断言无需仪式。本阶段采用本作原创G的独立成品渠道、导师准备与指导服药流程，不提供虚构材料表。")}</p>
    </section>

    {pain.promoted && pain.environment && <section aria-label="当前痛苦魔女现场">
      <h4>当前现场</h4><p>{pain.environment}</p>
    </section>}
    {pain.promoted && pain.practice && <section className="slice-notice" aria-label="已保存的普通演练与原物记录" aria-live="polite" aria-atomic="true">
      <h3>普通演练中的真实动作与原物</h3>
      <p>{playerText("三项均为本作原创G普通模拟演练（SIMULATION）。成年拉维妮自愿参与约定的疏散与纸面情境；她没有被施加疾病；演练不计为玩家实际施病，也不增加疾病能力掌握。")}</p>
      <dl className="seer-facts">
        <div><dt>本人、志愿者与原标记位置</dt><dd>{pain.practice.position}</dd></div>
        <div><dt>原情境卡与实际记录</dt><dd>{pain.practice.records}</dd></div>
        <div><dt>原照护便条与实际交接</dt><dd>{pain.practice.care}</dd></div>
      </dl>
      <p className="slice-muted">准备不移动身体或原物。只有实际执行才沿原4米普通通路走到安全标记、在原表记录三行，或写下同一张演练便条。失败也保留已发生的动作；纸面症状是虚构情境，不是诊断或真实感染。</p>
      {pain.practice.history.length > 0 && <details className="seer-fold">
        <summary>实际动作、原物与失败记录</summary>
        <ul>{pain.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      </details>}
    </section>}
    {selectedCase && <section aria-label="痛苦魔女有限实践">
      <h3>普通疏散演练、虚构记录与便条交接</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || pain.insideCase}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {pain.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前痛苦魔女实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；请先核对本人的自愿参与、原4米普通通路、木标记与同一张情境卡或便条。模拟情境不让任何人实际生病。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备只记录本次普通演练的方法，不代替本人走路、放置原标记、填写原表或交接原便条；只显示已保存的结果。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="痛苦魔女实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前痛苦魔女实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {pain.insideCase && <p className="slice-muted">返回生活前须实际结束本次演练：沿原4米通路各自走回原处并将同一木标记归架，或将原情境卡归档；交接失败的已写便条放回原桌，成功交接的原纸仍由拉维妮持有。按公开选项0行动、0精神、0灵性结束，不抹去失败、复制原物或额外发奖。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="痛苦魔女成长行动">{growthActions.map(actionButton)}</div>}
    {pain.promoted && <section aria-label="痛苦魔女有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">成年空院值守奥伦持自己的普通短棍，双方相距两米，原普通出口清楚，对方不追击，现场没有旁观者。交涉不施加疾病；战斗有真实伤势与死亡风险。拉维妮不会加入；无人旁观是这个现场的事实，不表示同伴自动免疫疾病。</p>
      <p className="slice-muted">疾病是逐步加深的虚构非凡后果。防守（DEFEND）会停止后续暴露及其灵性维持；已经造成的疾病仍保留。停止施术、撤退、离开现场或战斗结束都不会自动治愈原对手。</p>
      <section className="slice-notice" aria-label="本场已保存的疾病与援助" aria-live="polite" aria-atomic="true">
        <h4>原对手的实际后果</h4>
        <dl className="seer-facts">
          <div><dt>疾病范围</dt><dd>{pain.diseaseState.fieldActive ? "正在维持，仍可能发生新暴露" : "未在维持，不再追加新暴露"}</dd></div>
          <div><dt>原对手疾病强度</dt><dd>{pain.diseaseState.enemyDisease} / 3</dd></div>
          <div><dt>实际疾病施用</dt><dd>{pain.diseaseState.diseaseApplications}</dd></div>
          <div><dt>原对手当前健康</dt><dd>{pain.diseaseState.enemyHealth} / 100</dd></div>
          <div><dt>原对手实际状态</dt><dd>{pain.diseaseState.enemyStatus === "NOT_MET" ? "尚未实际交战" : pain.diseaseState.enemyStatus === "RESISTING" ? "仍在抵抗" : pain.diseaseState.enemyStatus === "SURRENDERED" ? "已自行投降" : pain.diseaseState.enemyStatus === "DEAD" ? "已经死亡" : "已离开冲突"}</dd></div>
          <div><dt>援助请求</dt><dd>{pain.diseaseState.care === "REQUESTED" ? "已实际请求传讯与车马协助；尚无治愈结果" : "尚未请求后续援助"}</dd></div>
        </dl>
        {pain.diseaseState.enemyDisease > 0 && <p>原对手已有疾病后果，停场和离开不会清除。后续援助只请求帮助，不恢复健康、不降低疾病强度，也不保证治愈。</p>}
      </section>
      {encounterActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="痛苦魔女冲突行动">{encounterActions.map(actionButton)}</div>}
    </section>}
    {pain.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{pain.story}</p></details>}
    {pain.discovered && pain.supplies && <section className="slice-notice" aria-label="痛苦魔女成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{pain.supplies}</p>
    </section>}
    {pain.discovered && pain.bottles.length > 0 && <details className="seer-fold" open={!pain.promoted}>
      <summary>痛苦魔女独立成品原瓶 · 来源与去向</summary>
      {pain.bottles.map((bottle) => {
        const action = pain.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !pain.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !pain.promoted && !pain.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `pain-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`pain-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {pain.discovered && !pain.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{pain.risk}</p></details>}
    {pain.promoted && <section aria-label="痛苦魔女能力与消化">
      <h3>能力与消化 · {pain.abilities.length} 项训练记录</h3>
      <p>扮演进度 {pain.acting} · 消化：{pain.digestion}</p>
      <progress className="cryptologist-progress" aria-label="痛苦魔女扮演进度" value={pain.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {pain.pollution}</p>
      {pain.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      {pain.inheritedTools && <p>{pain.inheritedTools}</p>}
      {pain.bodyChange && <p>{pain.bodyChange}</p>}
      <details className="seer-fold" aria-label="痛苦魔女能力边界">
        <summary>查看模拟演练、真实疾病与继承能力边界</summary>
        <p>{playerText("序列5疾病是随战斗进展逐步加重的非凡效果。本场强度0至3、灵性成本与疲劳咳嗽的贡献减免均为本作原创G；不提供真实病原体、传染或医疗操作。原著物品表现中的约50米和20至30秒不是所有痛苦魔女的统一硬规则，也不是自动死亡倒计时。")}</p>
        <p>三项生活实践只使用普通方法，明确为SIMULATION：成年拉维妮自愿沿原4米通路演练；同一木标记PN5-MARKER-1实际放置再归架，原情境卡PN5-CASE-NOTES-1填写三行虚构时间点，原纸PN5-CARE-NOTE-1实际写下并交接。没有对志愿者施病，不用魅惑或幻觉伪装真实疾病；普通演练不增加疾病能力掌握。</p>
        <p>{playerText("每项有限报告25与反思25组成和平消化100，是本作原创G非伤害替代路线，不宣称等同原著完整扮演。失败保留实际走动、原表三行或已写便条；实际结束后才可报告，失败须按公开条件跨周重试。结束、撤回和重复操作不再发奖。")}</p>
        <p>战斗首次尝试施病支付4灵性，失败仍消耗但不产生疾病范围或强度；成功后，后续新回合维持支付2灵性并逐级加重。防守（DEFEND）停止新暴露，已受影响者的疾病强度仍保留；灵性不足、停场、撤退和失去维持意识同样不会治愈已经造成的后果。没有同伴自动免疫，也不自动穿墙或清除旧伤。</p>
        <p>本场只降低原对手实际有效普通攻击的贡献，不直接扣健康或自动致死；疾病与原丝缚只取有效较强项，不重复相乘。援助（AID）支付公开成本，实际请求传讯与车马协助，不能当成治疗、清除疾病或保证康复。</p>
        <p>继承黑焰、冰霜、原镜替、原粉末、丝线与魅惑的原能力ID和掌握。镜替须实际准备并耗用原镜片，粉末实际持有并耗用；丝线先实际准备，下次才尝试束缚，不免费复制原物。魅惑不能替本人同意。序列7原身体变化保留，不重复发生；本阶段不提供序列4绝望的神话生物形态与更高阶瘟疫。</p>
        <p>{playerText("完整配方和晋升仪式细节仍待核实；有限成品来源、导师指导、实践、成本和消化数值均为本作原创G，不虚构已核实配方或断言无需仪式。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
