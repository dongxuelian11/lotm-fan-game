import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ScrollProfessorAction, ScrollProfessorCommand, ScrollProfessorProjection } from "../domain/scroll-professor/types";
import type { WizardProjection } from "../domain/wizard/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已核对原物与边界", PREPARED: "已准备待执行方法",
  EXAMINED: "已有实际结果，待离场与复核", RESOLVED: "已提交本次有限报告",
};

/** Original S7 story, learning, failures and bottles remain read-only after promotion. */
export function ScrollProfessorWizardHistory({ wizard, currentTitle = "卷轴教授（序列6）" }: { wizard: WizardProjection; currentTitle?: string }) {
  return <section className="seer-panel warrior-panel" aria-label="巫师时期的经历">
    <h3>巫师时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留巫师时期的原故事、法术学习、观察、失败、效果结束与原瓶，只供回看；不会再次结算旧成长。</p>
    <p>巫师扮演进度 {wizard.acting} · 消化：{wizard.digestion}</p>
    {(wizard.story || wizard.environment || wizard.supplies) && <details className="seer-fold">
      <summary>巫师原故事与供给</summary>
      {wizard.story && <p>{wizard.story}</p>}{wizard.environment && <p>{wizard.environment}</p>}{wizard.supplies && <p>{wizard.supplies}</p>}
    </details>}
    {wizard.lessons.length > 0 && <details className="seer-fold">
      <summary>巫师法术学习记录</summary>
      {wizard.lessons.map((lesson) => <article key={lesson.id}>
        <h4>{lesson.label} · {lesson.learned ? "已实际学会" : "尚未学会"}</h4>
        <p className="slice-muted">原法术ID：{lesson.id}</p><p>{lesson.description}</p>
      </article>)}
    </details>}
    {wizard.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的法术效果：{entry.effectOpen}</p>
      {entry.result && <p>当时的实际练习与报告：{entry.result}</p>}
    </details>)}
    {wizard.bottles.length > 0 && <details className="seer-fold">
      <summary>巫师原瓶 · 来源与去向</summary>
      {wizard.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {wizard.abilities.length > 0 && <details className="seer-fold">
      <summary>巫师时期能力记录</summary>
      {wizard.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface ScrollProfessorPanelProps {
  scrollProfessor: ScrollProfessorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ScrollProfessorCommand) => void;
}
function isCaseAction(action: ScrollProfessorAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: ScrollProfessorAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

function isWorkshopAction(action: ScrollProfessorAction): boolean {
  return action.command.type === "BUY_KIT" || action.command.type === "CRAFT_SCROLL" || action.command.type === "AUTHORIZE_SCROLL" || action.command.type === "LEARN_SPELL";
}
const SCROLL_LABELS = { IMPACT: "冲力卷轴 · 主攻H", WARD: "护持卷轴 · 自保B" } as const;

/** Render committed originals and typed public commands; never create or consume a scroll optimistically. */
export function ScrollProfessorPanel({ scrollProfessor, resources, busy, blocked = false, error = null, onCommand }: ScrollProfessorPanelProps) {
  const [selectedCraftId, setSelectedCraftId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = scrollProfessor.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = scrollProfessor.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = scrollProfessor.actions.filter(isCaseAction);
  // A public CLOSE intent identifies the open scene; historical prose cannot lock navigation.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (scrollProfessor.insideCase ? scrollProfessor.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? scrollProfessor.cases.find((entry) => entry.id === selectedCaseId)
    ?? scrollProfessor.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? scrollProfessor.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!scrollProfessor.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = scrollProfessor.insideCase ? [] : scrollProfessor.actions.filter(isEncounterAction);
  const growthActions = scrollProfessor.insideCase ? [] : scrollProfessor.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action) && !isWorkshopAction(action));
  const workshopActions = scrollProfessor.promoted && !scrollProfessor.insideCase ? scrollProfessor.actions.filter(isWorkshopAction).filter((action) => {
    const command = action.command;
    if (command.type === "LEARN_SPELL") return scrollProfessor.workshop.lessons.some((lesson) => lesson.id === command.spellId && !lesson.learned);
    if (command.type === "AUTHORIZE_SCROLL") return scrollProfessor.workshop.scrolls.some((scroll) => scroll.id === command.scrollId);
    return true;
  }) : [];
  const actionableWorkshop = workshopActions.filter((action) => {
    const command = action.command;
    return command.type !== "AUTHORIZE_SCROLL" || scrollProfessor.workshop.scrolls.some((scroll) => scroll.id === command.scrollId && scroll.status === "HELD");
  });
  const craftActions = workshopActions.filter((action) => action.command.type === "CRAFT_SCROLL");
  const selectedCraft = craftActions.find((action) => action.id === selectedCraftId) ?? craftActions.find((action) => action.enabled) ?? craftActions[0];
  const nextAction = scrollProfessor.insideCase ? closeAction : !scrollProfessor.promoted
    ? scrollProfessor.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...actionableWorkshop, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !scrollProfessor.promoted && !scrollProfessor.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (scrollProfessor.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, scrollProfessor.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || scrollProfessor.promoted || scrollProfessor.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, scrollProfessor.promoted, scrollProfessor.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ScrollProfessorAction) {
    if (busy || interactionBlocked || scrollProfessor.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || scrollProfessor.promoted || scrollProfessor.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: ScrollProfessorAction, unavailable = false) {
    return <div className="seer-action cryptologist-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || unavailable || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || unavailable || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `scroll-professor-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`scroll-professor-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel cryptologist-panel warrior-panel seer-confirmation" aria-label="这瓶卷轴教授魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="卷轴教授服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{scrollProfessor.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{scrollProfessor.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="scroll-professor-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "scroll-professor-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel cryptologist-panel warrior-panel scroll-professor-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="卷轴教授成长下一步">
      <span className="seer-seal">{scrollProfessor.promoted ? "序列 6" : "卷轴教授晋升卷宗"}</span>
      <h3>{scrollProfessor.title}</h3>
      <p className="seer-next">{scrollProfessor.insideCase
        ? <><strong>先实际结束本次实践：</strong>{nextAction?.label || "查看当前公开结束选项"}。离场为0行动、0精神、0灵性；保留本次结果与消耗。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : scrollProfessor.promoted && scrollProfessor.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{scrollProfessor.digestion}</p>
      {!scrollProfessor.promoted && <p className="slice-muted">{playerText("须完成巫师消化100与十二个完整序列7周。G指导360便士；每瓶3320便士，或5步劳务抵扣3000便士后付320便士。三瓶独立成品分别取得、逐瓶确认，按意志24四档结算；失败仍耗用原瓶。准备期间可继续普通生活与休养。")}</p>}
      {!scrollProfessor.promoted && <p className="slice-muted">{playerText("完整晋升配方、材料与剂量尚未核实；指导只说明有来源的独立成品原瓶，不展示虚构配方或开放晋升魔药调配。")}</p>}
    </section>
    {scrollProfessor.promoted && <details className="seer-fold" aria-label="卷轴教授能力边界">
      <summary>卷轴的来源、制作与使用边界</summary>
      <p>{playerText("只能刻录实际学会的巫师法术。本阶段开放有限冲力与短时护持两种G教学卷轴，各有唯一原件ID、材料来源与一次使用次数。刻录失败仍消耗材料与灵性，不生成成品。")}</p>
      <p>{playerText("材料包1行动、100便士，含4份G教学灵性材料，每周只能购买一次。刻录1行动、2灵性、1份材料，按知识14判定。具体材料、价格、判定、教学故事与数值为本作原创G。")}</p>
      <p>战前逐件授权后，匹配主攻H或自保B抽中且灵性足够时，耗1灵性自动烧用一次。未授权卷轴保留原件；预备R不会凭空制作新卷轴。已耗用原件与失败记录始终保留。</p>
      <p>三项有限实践报告各25扮演进度，反思25，可和平完成本阶段。本页不授予序列5星象师与序列4神秘学家的能力。</p>
    </details>}
    {scrollProfessor.promoted && scrollProfessor.environment && <section aria-label="当前卷轴教授现场">
      <h4>当前现场</h4><p>{scrollProfessor.environment}</p>
    </section>}
    {scrollProfessor.promoted && <section className="slice-notice" aria-label="卷轴工坊与实际原件">
      <h3>卷轴工坊</h3>
      <p>{scrollProfessor.workshop.summary}</p>
      <p className="slice-muted">学习、购买、刻录与授权仅在保存后更新。成品默认未授权；授权只允许匹配战斗槽自动使用一次，实际启动另耗1灵性，使用仍可失败。</p>
      {scrollProfessor.workshop.lessons.length > 0 && <section aria-label="继承的巫师法术学习">
        <h4>实际学会后才能刻录</h4>
        {scrollProfessor.workshop.lessons.map((lesson) => <article key={lesson.id}>
          <p>{lesson.label} · {lesson.learned ? "已实际学会" : "尚未学会"}</p>
          <details className="seer-fold"><summary>{lesson.label}的原教学边界</summary><p>{lesson.description}</p><p className="slice-muted">原法术ID：{lesson.id}</p></details>
          {!lesson.learned && workshopActions.filter((action) => action.command.type === "LEARN_SPELL" && action.command.spellId === lesson.id).map((action) => actionButton(action))}
        </article>)}
      </section>}
      {workshopActions.some((action) => action.command.type === "BUY_KIT" || action.command.type === "CRAFT_SCROLL") && <div role="group" aria-label="材料购买与卷轴刻录">
        {workshopActions.filter((action) => action.command.type === "BUY_KIT").map((action) => actionButton(action))}
        {selectedCraft && <>
          <label className="seer-case-selector">选择要刻录的卷轴
            <select value={selectedCraft.id} disabled={busy || interactionBlocked || scrollProfessor.insideCase} onChange={(event) => setSelectedCraftId(event.target.value)}>
              {craftActions.map((action) => <option key={action.id} value={action.id}>{action.command.type === "CRAFT_SCROLL" ? SCROLL_LABELS[action.command.kind] : action.label}</option>)}
            </select>
          </label>
          {actionButton(selectedCraft)}
        </>}
      </div>}
      <details className="seer-fold">
        <summary>材料原份 · 实际持有与耗用</summary>
        {scrollProfessor.workshop.materials.length > 0 ? scrollProfessor.workshop.materials.map((material) => <article key={material.id}>
          <p>材料ID：{material.id} · {material.status === "HELD" ? "实际持有" : "已实际耗用"}</p>
          <p className="slice-muted">取得周：{material.acquiredWeek} · {material.spentWeek === null ? "尚未耗用" : `耗用周：${material.spentWeek}`}</p>
        </article>) : <p className="slice-muted">尚无实际购买的材料原份。</p>}
      </details>
      <section aria-label="卷轴原件与逐件战前授权">
        <h4>卷轴原件与逐件战前授权</h4>
        {scrollProfessor.workshop.scrolls.length > 0 ? scrollProfessor.workshop.scrolls.map((scroll) => <article className="warrior-history-bottle" key={scroll.id}>
          <h4>{scroll.title}</h4>
          <p className="slice-muted">原卷轴ID：{scroll.id} · {SCROLL_LABELS[scroll.kind]}</p>
          <p>{scroll.status === "HELD" ? "实际持有 · 可使用一次" : "已耗用 · 剩余使用0次"} · {scroll.authorized ? "已授权匹配战斗槽" : "未授权自动使用"}</p>
          <details className="seer-fold"><summary>{scroll.id}的来源与耗用记录</summary>
            <p>来源：{scroll.source}</p><p>材料ID：{scroll.materialId}</p>
            <p className="slice-muted">制作周：{scroll.createdWeek} · 制作者序列：{scroll.makerSequence} · 刻录时掌握：{scroll.inscriptionMastery}</p>
            <p className="slice-muted">{scroll.usedWeek === null ? "尚未耗用这一原件" : `耗用周：${scroll.usedWeek}`}</p>
          </details>
          {workshopActions.filter((action) => action.command.type === "AUTHORIZE_SCROLL" && action.command.scrollId === scroll.id).map((action) => actionButton(action, scroll.status === "USED"))}
          {scroll.status === "USED" && <p className="slice-muted">这一原件已经耗用，不能再次授权、恢复次数或重用。</p>}
        </article>) : <p className="slice-muted">尚无刻录成功的卷轴原件。准备与失败不会生成成品。</p>}
      </section>
    </section>}
    {selectedCase && <section aria-label="卷轴教授有限实践">
      <h3>纸靶、软冲击与自愿读者</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || scrollProfessor.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {scrollProfessor.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前卷轴教授实践">
        <h4>{selectedCase.title}</h4><details className="seer-fold"><summary>本次故事与来源</summary><p>{selectedCase.story}</p></details>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原失败记录"><h4>公开观察与原失败记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次现场观察，请先核对原物、退路与停止边界。</p>}
        </section>
        <section aria-label="有限实践与准备"><h4>有限实践与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备不会提前刻录、耗用卷轴、改变原靶或完成教学。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="有限实践与实际结果" aria-live="polite" aria-atomic="true">
          <h4>有限实践与实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="cryptologist-action-list" role="group" aria-label="当前卷轴教授实践行动">{selectedCaseActions.map((action) => actionButton(action))}</div>}
        {scrollProfessor.insideCase && <p className="slice-muted">须实际结束本次有限效果并离场后再报告。离场不另抽随机、不奖励、不退款、不治疗；原卷轴耗用、材料和原靶结果、失败记录均保留。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="cryptologist-action-list" role="group" aria-label="卷轴教授成长行动">{growthActions.map((action) => actionButton(action))}</div>}
    {scrollProfessor.story && <details className="seer-fold"><summary>卷轴教授故事记录</summary><p>{scrollProfessor.story}</p></details>}
    {encounterActions.length > 0 && <section aria-label="有限现场冲突">
      <h3>有限现场冲突</h3>
      <p className="slice-muted">按公开选项交涉或承担真实战斗风险。卷轴须在战前逐件授权；匹配槽实际抽中才消耗原件，效果不保证胜利。</p>
      <div className="cryptologist-action-list" role="group" aria-label="现场冲突行动">{encounterActions.map((action) => actionButton(action))}</div>
    </section>}
    {scrollProfessor.discovered && scrollProfessor.supplies && <details className="seer-fold" aria-label="卷轴教授成品原瓶供给">
      <summary>成品原瓶与实际供给</summary><p>{scrollProfessor.supplies}</p>
    </details>}
    {scrollProfessor.discovered && scrollProfessor.bottles.length > 0 && <details className="seer-fold" open={!scrollProfessor.promoted}>
      <summary>卷轴教授独立成品原瓶 · 来源与去向</summary>
      {scrollProfessor.bottles.map((bottle) => {
        const action = scrollProfessor.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !scrollProfessor.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><details className="seer-fold"><summary>这一原瓶的来源</summary><p>来源：{bottle.source}</p></details><small>{bottle.status}</small></div>
          {action && !scrollProfessor.promoted && !scrollProfessor.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `scroll-professor-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`scroll-professor-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {scrollProfessor.discovered && !scrollProfessor.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{scrollProfessor.risk}</p></details>}
    {scrollProfessor.promoted && <section aria-label="卷轴教授能力与消化">
      <h3>能力与消化 · {scrollProfessor.abilities.length} 项训练记录</h3>
      <p>扮演进度 {scrollProfessor.acting} · 消化：{scrollProfessor.digestion}</p>
      <progress className="cryptologist-progress" aria-label="卷轴教授扮演进度" value={scrollProfessor.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {scrollProfessor.pollution}</p>
      {scrollProfessor.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
