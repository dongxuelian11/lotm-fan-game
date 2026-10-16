import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { BiologistAction, BiologistCommand, BiologistProjection } from "../domain/biologist/types";
import type { HarvestpriestProjection } from "../domain/harvestpriest/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对原样本与同一原苗", OBSERVED: "已有原样本、原苗与有限条件观察", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，请核对用水、复核与归还记录", RESOLVED: "已退出并提交本次有限报告",
};
const TRIAL_STATUS: Record<BiologistProjection["trial"]["status"], string> = {
  IDLE: "同一原苗尚无成功试验记录",
  WAITING: "同一原苗已有试验记录，尚未实际复核",
  VERIFIED: "已实际复核同一原苗，有限结论保留",
  RETURNED: "同一原苗已实际归还原主伊芙",
};

/** Original S7 accounts, choices, failures and independent bottles remain read-only. */
export function BiologistHarvestpriestHistory({ harvestpriest }: { harvestpriest: HarvestpriestProjection }) {
  return <section className="seer-panel harvestpriest-panel" aria-label="丰收祭司时期的经历">
    <h3>丰收祭司时期的经历</h3>
    <p className="slice-notice">你已晋升生物学家（序列6）。这里保留丰收祭司时期的原植床、实际耗水、有限收成、已交付份数、下一季计划、失败、实际结束、原报告和独立原瓶，只供回看。</p>
    <p>丰收祭司扮演进度 {harvestpriest.acting} · 消化：{harvestpriest.digestion}</p>
    {(harvestpriest.story || harvestpriest.environment || harvestpriest.supplies || harvestpriest.plot) && <details className="seer-fold">
      <summary>丰收祭司原故事与供给</summary>
      {harvestpriest.story && <p>{harvestpriest.story}</p>}{harvestpriest.environment && <p>{harvestpriest.environment}</p>}{harvestpriest.supplies && <p>{harvestpriest.supplies}</p>}{harvestpriest.plot && <p>{harvestpriest.plot}</p>}
    </details>}
    {harvestpriest.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status === "RESOLVED" ? "已收束并提交原报告" : entry.status === "EXAMINED" ? "原检验结果保留" : "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen}</p><p>当时实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {harvestpriest.bottles.length > 0 && <details className="seer-fold">
      <summary>丰收祭司原瓶 · 来源与去向</summary>
      {harvestpriest.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {harvestpriest.abilities.length > 0 && <details className="seer-fold">
      <summary>丰收祭司时期能力记录</summary>
      {harvestpriest.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface BiologistPanelProps {
  biologist: BiologistProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: BiologistCommand) => void;
}
function isCaseAction(action: BiologistAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: BiologistAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Display committed public facts; preparing or submitting never applies an effect locally. */
export function BiologistPanel({ biologist, resources, busy, blocked = false, error = null, onCommand }: BiologistPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = biologist.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = biologist.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = biologist.actions.filter(isCaseAction);
  // Only a projected CLOSE intent identifies the actual open scene, never historical prose.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (biologist.insideCase ? biologist.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? biologist.cases.find((entry) => entry.id === selectedCaseId)
    ?? biologist.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? biologist.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!biologist.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = biologist.insideCase ? [] : biologist.actions.filter(isEncounterAction);
  const growthActions = biologist.insideCase ? [] : biologist.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = biologist.insideCase ? closeAction : !biologist.promoted
    ? biologist.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !biologist.promoted && !biologist.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (biologist.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, biologist.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || biologist.promoted || biologist.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, biologist.promoted, biologist.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: BiologistAction) {
    if (busy || interactionBlocked || biologist.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || biologist.promoted || biologist.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: BiologistAction) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `biologist-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`biologist-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel biologist-panel seer-confirmation" aria-label="这瓶生物学家魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); } }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="生物学家服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{biologist.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{biologist.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="biologist-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "biologist-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel biologist-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="生物学家成长下一步">
      <span className="seer-seal">{biologist.promoted ? "序列 6" : "生物学家晋升卷宗"}</span>
      <h3>{biologist.title}</h3>
      <p className="seer-next">{biologist.insideCase
        ? <><strong>先结束本次实践，回到生活：</strong>{nextAction?.label || "查看当前公开的结束实践选项"}。结束为0行动、0精神、0灵性；保留本次结果、失败与消耗。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : biologist.promoted && biologist.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{biologist.digestion}</p>
      {!biologist.promoted && <p className="slice-muted">{playerText("须完成丰收祭司消化100与十二个完整序列7周。G指导360便士；每瓶3320便士，或5步劳务抵扣3000便士后付320便士。独立成品分别取得、逐瓶确认，按意志24四档结算；失败仍耗用原瓶，实际排异与污染保留，可休养后另取独立原瓶重试。准备期间可继续普通生活与休养。")}</p>}
      {!biologist.promoted && <p className="slice-muted">{playerText("完整晋升配方、材料与剂量尚未核实；这里只提供有来源的G独立成品，不展示虚构材料或开放晋升魔药调配。")}</p>}
    </section>
    {biologist.promoted && biologist.environment && <section aria-label="当前生物学家现场"><h4>当前现场</h4><p>{biologist.environment}</p></section>}
    {biologist.promoted && <section className="slice-notice" aria-label="原样本、同一原苗与实际资源">
      <h3>原样本与同一原苗</h3>
      <p>原封样本：{biologist.practice.sampleRecorded ? "已完成有限观察记录，样本仍原封保存" : "尚未完成本次有限观察记录，样本仍原封保存"}</p>
      <p>同一原苗：{TRIAL_STATUS[biologist.trial.status]}</p>
      <p>原苗位置：{biologist.trial.location === "OWNER" ? "同一温室内，已当面交回原主伊芙" : "同一温室原台，仍是伊芙的原苗"}</p>
      <p>有限结论与未知警告：{biologist.practice.warningsRecorded ? "已实际核对并记录" : "尚未实际核对并记录"}</p>
      <dl className="seer-facts">
        <div><dt>试验开始周</dt><dd>{biologist.trial.careWeek === null ? "尚无成功开始记录" : `第${biologist.trial.careWeek}周`}</dd></div>
        <div><dt>实际复核周</dt><dd>{biologist.trial.verifiedWeek === null ? "尚未实际复核" : `第${biologist.trial.verifiedWeek}周`}</dd></div>
        <div><dt>本阶段实际用水</dt><dd>{biologist.trial.waterUsed}份</dd></div>
        <div><dt>原植床水库存</dt><dd>{biologist.water.held}份</dd></div>
        <div><dt>原库存累计实际用水</dt><dd>{biologist.water.used}份</dd></div>
      </dl>
      <p>{biologist.water.summary}</p>
      {biologist.trial.status === "WAITING" && <p className="seer-next" role="status">
        <strong>等待真实跨周后再亲自复核：</strong>
        {biologist.trial.careWeek === null ? "当前尚无可确认的开始周，以公开复核条件为准。" : `最早第${biologist.trial.careWeek + 1}周可按公开条件复核。`}
        {biologist.insideCase ? "先实际结束当前接触，再回到生活。" : "现在可回到生活，工作、调查或休养。"}
        过周不会自动验证；只有实际复核并保存后，才会显示复核结果。
      </p>}
      <p className="slice-muted">只显示已保存的实践事实。原封样本观察不拆封、不新增材料；同一原苗的实际用水、尝试、跨周复核和归还分别记录。</p>
      <p className="slice-muted">有限试验须先实际结束接触，才可回到生活。等待下一真实周期间可以工作、调查或休养；周结不会自动复核，须实际执行公开的复核选项。没有复核结果时，不预告成功、产量或食用安全。</p>
    </section>}
    {selectedCase && <section aria-label="生物学家有限实践">
      <h3>原封样本、同原苗试验与实际归还</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || biologist.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {biologist.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前生物学家实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对伊芙的原封样本、同一原苗、原用水库存与归还边界，不凭描述提前得到试验结论。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前消耗水、改造原苗、完成跨周复核或归还物品；只有实际执行才记录有限结果。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="生物学家实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前生物学家实践行动">{selectedCaseActions.map((action) => actionButton(action))}</div>}
        {biologist.insideCase && <p className="slice-muted">先用当前“结束实践”选项实际退开，再回到生活、等待下一真实周或提交报告。即使0行动、0精神、0灵性或本次尝试失败，也可实际结束；不另抽随机、不奖励、不退款、不治疗，原封样本、同一原苗、实际耗水、失败与归还记录继续保留。撤回准备不能代替实际结束。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="生物学家成长行动">{growthActions.map((action) => actionButton(action))}</div>}
    {encounterActions.length > 0 && <section aria-label="生物学家有限冲突">
      <h3>有限现场冲突</h3><p className="slice-muted">只按当前公开现场交涉或承担冲突；已有出口仍可实际退出，这里不追击。战斗限于普通身体动作、对当前可见状况的观察和继承的有限自护，实际资源与伤势继续保留。样本研究和有限试验不变成植物攻击、即时食物或必胜效果。</p>
      <div className="magician-action-list" role="group" aria-label="生物学家冲突行动">{encounterActions.map((action) => actionButton(action))}</div>
    </section>}
    {biologist.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{biologist.story}</p></details>}
    {biologist.discovered && biologist.supplies && <section className="slice-notice" aria-label="生物学家成品来源与取得"><h4>实际供给与独立原瓶</h4><p>{biologist.supplies}</p></section>}
    {biologist.discovered && biologist.bottles.length > 0 && <details className="seer-fold" open={!biologist.promoted}>
      <summary>生物学家独立成品原瓶 · 来源与去向</summary>
      {biologist.bottles.map((bottle) => {
        const action = biologist.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !biologist.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !biologist.promoted && !biologist.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `biologist-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`biologist-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {biologist.discovered && !biologist.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{biologist.risk}</p></details>}
    {biologist.promoted && <section aria-label="生物学家能力与消化">
      <h3>能力与消化 · {biologist.abilities.length} 项训练记录</h3>
      <p>扮演进度 {biologist.acting} · 消化：{biologist.digestion}</p>
      <progress className="cryptologist-progress" aria-label="生物学家扮演进度" value={biologist.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {biologist.pollution}</p>
      {biologist.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="生物学家实践与能力边界">
        <summary>查看样本研究、有限试验与继承能力边界</summary>
        <p>{playerText("本序列新增有限样本研究与有限对照实践两项独立掌握，继承七项原能力，共九项记录；旧能力与原掌握保留。本阶段可通过三项具体实践继续成长与和平消化，具体数值按当前公开说明执行。")}</p>
        <p>原封样本只作有限观察，不拆封、不取样、不凭空创造材料。同一原苗来自伊芙，试验仍用原苗；实际用水复用丰收祭司原植床库存，补水不会另建第二套库存。失败也保留实际耗水和能力成本。</p>
        <p>成功开始试验后须至少等待下一真实周，才可实际复核。结束接触后可继续生活；周结不会自动验证，必须提交当前公开的复核命令，且只展示已保存的有限结论。</p>
        <p>归还实践须先核对并确认，再把同一原苗实际交回原主伊芙；确认、准备、结束和报告不凭空复制原苗或改写产权。有限观察和复核都不构成食用安全保证，不制造当前或未来无限粮食。</p>
        <p>弗兰克的个人高阶神战事故不复制为通用能力；序列5的潜地能力未下放，本阶段也不开放动物变形。战斗只使用普通身体、可见观察与继承有限自护，不新增植物攻击。</p>
        <p>普通方法保留，不额外耗灵性；能力方法按当前公开成本支付真实资源。结束实践0行动、0精神、0灵性，不抽随机、不奖励、不退款、不治疗，全部实际成本、失败与原报告保留。</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
