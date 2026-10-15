import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { CalamityPriestAction, CalamityPriestCommand, CalamityPriestProjection } from "../domain/calamity-priest/types";
import type { LuckyProjection } from "../domain/lucky/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次现场", OBSERVED: "已有普通观察与现场边界", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，请核对退出与现实证据", RESOLVED: "已退出并提交本次有限报告",
};
const HAZARD_LABELS = { UNASSESSED: "尚未完成本次风险核查", NOTICED: "已留意本次风险，尚未实际收束", SECURED: "已实际退出并做好本次风险收束" } as const;
const BOARD_LABELS = { RESTING: "同一原板仍在原支架上", UNSTABLE: "同一原板不稳，尚未固定", FALLEN: "同一原板已落下，尚未固定", SECURED: "同一原板已实际固定收好" } as const;
const CONTACT_LABELS = { NONE: "尚未开始本次接触", FOCUSED: "短暂精神接触仍在，须主动结束", RELEASED: "本次精神接触已实际解除" } as const;

/** The original S7 stories, passive luck, failures and bottles remain read-only. */
export function CalamityPriestLuckyHistory({ lucky }: { lucky: LuckyProjection }) {
  return <section className="seer-panel lucky-panel" aria-label="幸运者时期的经历">
    <h3>幸运者时期的经历</h3>
    <p className="slice-notice">你已晋升灾祸教士（序列6）。这里保留幸运者时期的原故事、观察、被动幸运、实际结束、失败和独立原瓶，只供回看。</p>
    <p>幸运者扮演进度 {lucky.acting} · 消化：{lucky.digestion}</p>
    {(lucky.story || lucky.environment || lucky.supplies) && <details className="seer-fold">
      <summary>幸运者原故事与供给</summary>
      {lucky.story && <p>{lucky.story}</p>}{lucky.environment && <p>{lucky.environment}</p>}{lucky.supplies && <p>{lucky.supplies}</p>}
    </details>}
    {lucky.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status === "RESOLVED" ? "已收束并提交原报告" : entry.status === "EXAMINED" ? "原检验结果保留" : "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen}</p><p>当时实际结束次数：{entry.closes}</p><p>当时的被动幸运记录：{entry.luck}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {lucky.bottles.length > 0 && <details className="seer-fold">
      <summary>幸运者原瓶 · 来源与去向</summary>
      {lucky.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {lucky.abilities.length > 0 && <details className="seer-fold">
      <summary>幸运者时期能力记录</summary>
      {lucky.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface CalamityPriestPanelProps {
  calamityPriest: CalamityPriestProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: CalamityPriestCommand) => void;
}
function isCaseAction(action: CalamityPriestAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: CalamityPriestAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render only committed public facts; private hostile plans never enter this component. */
export function CalamityPriestPanel({ calamityPriest, resources, busy, blocked = false, error = null, onCommand }: CalamityPriestPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = calamityPriest.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = calamityPriest.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = calamityPriest.actions.filter(isCaseAction);
  // Only a projected CLOSE intent identifies the actual open scene, never historical prose.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (calamityPriest.insideCase ? calamityPriest.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? calamityPriest.cases.find((entry) => entry.id === selectedCaseId)
    ?? calamityPriest.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? calamityPriest.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!calamityPriest.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = calamityPriest.insideCase ? [] : calamityPriest.actions.filter(isEncounterAction);
  const growthActions = calamityPriest.insideCase ? [] : calamityPriest.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = calamityPriest.insideCase ? closeAction : !calamityPriest.promoted
    ? calamityPriest.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !calamityPriest.promoted && !calamityPriest.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (calamityPriest.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, calamityPriest.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || calamityPriest.promoted || calamityPriest.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, calamityPriest.promoted, calamityPriest.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: CalamityPriestAction) {
    if (busy || interactionBlocked || calamityPriest.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || calamityPriest.promoted || calamityPriest.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: CalamityPriestAction, unavailable = false) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || unavailable || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || unavailable || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `calamityPriest-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`calamityPriest-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel calamityPriest-panel seer-confirmation" aria-label="这瓶灾祸教士魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="灾祸教士服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{calamityPriest.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{calamityPriest.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="calamityPriest-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "calamityPriest-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel calamityPriest-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="灾祸教士成长下一步">
      <span className="seer-seal">{calamityPriest.promoted ? "序列 6" : "灾祸教士晋升卷宗"}</span>
      <h3>{calamityPriest.title}</h3>
      <p className="seer-next">{calamityPriest.insideCase
        ? <><strong>先实际收束原物并结束接触：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束为0行动、0精神、0灵性；保留本次结果、失败与消耗。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : calamityPriest.promoted && calamityPriest.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{calamityPriest.digestion}</p>
      {!calamityPriest.promoted && <p className="slice-muted">{playerText("须完成幸运者消化100与十二个完整序列7周。G指导360便士；每瓶3320便士，或5步劳务抵扣3000便士后付320便士。三瓶独立成品分别取得、逐瓶确认，按意志24四档结算；失败仍耗用原瓶。准备期间可继续普通生活与休养。")}</p>}
      {!calamityPriest.promoted && <p className="slice-muted">{playerText("完整晋升配方、材料与剂量尚未核实；这里只提供有来源的G独立成品，不展示虚构材料或开放晋升魔药调配。")}</p>}
    </section>
    {calamityPriest.promoted && calamityPriest.environment && <section aria-label="当前灾祸教士现场"><h4>当前现场</h4><p>{calamityPriest.environment}</p></section>}
    {calamityPriest.promoted && <section className="slice-notice" aria-label="当前灾害、原板与精神接触">
      <h3>当前公开现场</h3>
      <p>当前雨棚风险：{HAZARD_LABELS[calamityPriest.practice.hazard]}</p>
      <p>当前原板：{BOARD_LABELS[calamityPriest.practice.board]}</p>
      <p>当前精神接触：{CONTACT_LABELS[calamityPriest.practice.contact]}</p>
      <p className="slice-muted">只显示已保存的实际状态。预感不替代现实风险核查；同一原板落下后仍须固定，精神接触仍须实际解除。</p>
    </section>}
    {selectedCase && <section aria-label="灾祸教士有限实践">
      <h3>有限预感、同一原板与自愿精神接触</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || calamityPriest.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {calamityPriest.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前灾祸教士实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对可见风险、原物、本人许可与安全退路。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前获得预感、使原板落下或开始精神接触。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="灾祸教士实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前灾祸教士实践行动">{selectedCaseActions.map((action) => actionButton(action))}</div>}
        {calamityPriest.insideCase && <p className="slice-muted">先用当前结束选项实际退开、固定同一原板或解除精神接触，再报告或做其它事。结束不另抽随机、不奖励、不退款、不治疗，也不抹去原失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="灾祸教士成长行动">{growthActions.map((action) => actionButton(action))}</div>}
    {encounterActions.length > 0 && <section aria-label="灾祸教士有限冲突">
      <h3>有限现场冲突</h3><p className="slice-muted">成年普通人杜兰持自己的普通短棍，与你相隔2米；原清空外院没有松板、旁人或可用灾源，身后原出口仍可实际退出。可交涉，战斗有真实风险；这里不追击。有限预感不能读取敌方计划，被动幸运不能主动指定成功。</p>
      <div className="magician-action-list" role="group" aria-label="灾祸教士冲突行动">{encounterActions.map((action) => actionButton(action))}</div>
    </section>}
    {calamityPriest.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{calamityPriest.story}</p></details>}
    {calamityPriest.discovered && calamityPriest.supplies && <section className="slice-notice" aria-label="灾祸教士成品来源与取得"><h4>实际供给与独立原瓶</h4><p>{calamityPriest.supplies}</p></section>}
    {calamityPriest.discovered && calamityPriest.bottles.length > 0 && <details className="seer-fold" open={!calamityPriest.promoted}>
      <summary>灾祸教士独立成品原瓶 · 来源与去向</summary>
      {calamityPriest.bottles.map((bottle) => {
        const action = calamityPriest.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !calamityPriest.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !calamityPriest.promoted && !calamityPriest.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `calamityPriest-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`calamityPriest-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {calamityPriest.discovered && !calamityPriest.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{calamityPriest.risk}</p></details>}
    {calamityPriest.promoted && <section aria-label="灾祸教士能力与消化">
      <h3>能力与消化 · {calamityPriest.abilities.length} 项训练记录</h3>
      <p>扮演进度 {calamityPriest.acting} · 消化：{calamityPriest.digestion}</p>
      <progress className="cryptologist-progress" aria-label="灾祸教士扮演进度" value={calamityPriest.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {calamityPriest.pollution}</p>
      {calamityPriest.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="灾祸教士实践与能力边界">
        <summary>查看有限灾害、精神接触与被动幸运边界</summary>
        <p>有限灾害预感只提供本次现场的有限征兆，不能预报完整未来或替代实际风险核查。雨棚的原架、风险与安全退路都仍保留；实际施用后仍须看清现场，结束时实际移开原箱并固定原支架。</p>
        <p>招灾只在物主授权、人员已清空的隔离试验区处理同一原板。准备会复位原板、支架与承接盘并清空警戒线；原板可能失稳或落下，必须实际固定收好。不会凭空创造灾源、出口或免伤保证。</p>
        <p>{playerText("精神实践只针对已同意短暂、轻微试验的现存成年人佩林，并明确为本作G原创情境。本人可要求停止，接触须实际解除；这不是强迫说真话、读心、治疗或无限控制。")}</p>
        <p>继承的被动幸运仍会波动，不能主动选择好运时机、重抽结果或保证成功；不存在幸运池、等额厄运债，也不开放序列5幸运储存与主动分配。</p>
        <p>{playerText("能力实践每次耗3灵性，普通安全方法0灵性；各次实际观察、准备、执行与报告均按公开成本结算。三项有限实践报告各25扮演进度、反思25，可完成本作G原创和平路线100。原失败、风险与实际消耗继续保留；这不等于原著无代价保证，实践成功也不保证战斗成功。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
