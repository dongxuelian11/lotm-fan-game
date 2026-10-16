import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { StarMysticAction, StarMysticCommand, StarMysticProjection } from "../domain/star-mystic/types";
import type { ScrollProfessorProjection } from "../domain/scroll-professor/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已有公开观察", PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告", RESOLVED: "已提交有限报告",
};
const SCROLL_LABELS = { IMPACT: "冲力卷轴 · 主攻H", WARD: "护持卷轴 · 自保B" } as const;

/** Preserve S6 case history and the actual current whereabouts of the original S6 scrolls. */
export function StarMysticScrollProfessorHistory({ scrollProfessor, currentTitle = "星象师（序列5）" }: { scrollProfessor: ScrollProfessorProjection; currentTitle?: string }) {
  return <section className="seer-panel warrior-panel" aria-label="卷轴教授时期的经历">
    <h3>卷轴教授时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留卷轴教授时期的原故事、实际材料与耗卷、失败、原瓶和旧现场结果，只供回看。继续学习、购买、制卷与逐件授权请使用当前成长页的继承工坊。</p>
    <p>卷轴教授扮演进度 {scrollProfessor.acting} · 消化：{scrollProfessor.digestion}</p>
    {scrollProfessor.story && <p>{scrollProfessor.story}</p>}
    {scrollProfessor.environment && <p>{scrollProfessor.environment}</p>}
    {scrollProfessor.supplies && <p>{scrollProfessor.supplies}</p>}
    {scrollProfessor.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold" aria-label="原工坊材料与序列6原卷记录">
      <summary>原工坊材料与序列6原卷的当前去向</summary>
      <p>{scrollProfessor.workshop.summary}</p>
      {scrollProfessor.workshop.materials.map((material) => <article key={material.id}>
        <p>材料ID：{material.id} · {material.status === "HELD" ? "实际持有" : "已实际耗用"}</p>
        <p>取得周：{material.acquiredWeek} · {material.spentWeek === null ? "尚未耗用" : `耗用周：${material.spentWeek}`}</p>
      </article>)}
      {scrollProfessor.workshop.scrolls.filter((scroll) => scroll.makerSequence === 6).map((scroll) => <article key={scroll.id}>
        <h4>{scroll.title}</h4><p>原卷轴ID：{scroll.id}</p><p>来源：{scroll.source}</p><p>材料ID：{scroll.materialId}</p>
        <p>制作周：{scroll.createdWeek} · 制作者序列：{scroll.makerSequence} · 刻录时掌握：{scroll.inscriptionMastery}</p>
        <p>{scroll.status === "HELD" ? "实际持有 · 可使用一次" : "已耗用 · 剩余使用0次"} · {scroll.authorized ? "已授权匹配战斗槽" : "未授权自动使用"}</p>
        <p>{scroll.usedWeek === null ? "尚未耗用这一原件" : `耗用周：${scroll.usedWeek}`}</p>
      </article>)}
    </details>
    {scrollProfessor.workshop.lessons.length > 0 && <details className="seer-fold">
      <summary>继承课程的实际学习记录</summary>
      {scrollProfessor.workshop.lessons.map((lesson) => <article key={lesson.id}>
        <h4>{lesson.label} · {lesson.learned ? "已实际学会" : "尚未学会"}</h4>
        <p className="slice-muted">原法术ID：{lesson.id}</p><p>{lesson.description}</p>
      </article>)}
    </details>}
    {scrollProfessor.bottles.length > 0 && <details className="seer-fold">
      <summary>卷轴教授原瓶 · 来源与去向</summary>
      {scrollProfessor.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {scrollProfessor.abilities.length > 0 && <details className="seer-fold">
      <summary>卷轴教授能力记录</summary>
      {scrollProfessor.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">旧实践不重新结算或发奖；不补原材料或原卷，不改写原失败、米娅的自愿意愿或旧卡尔冲突的实际结果。原能力ID与掌握保留，新工坊制作不会把旧卷的制作序列改成5。</p>
  </section>;
}

export interface StarMysticPanelProps {
  starMystic: StarMysticProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: StarMysticCommand) => void;
}

function isCaseAction(action: StarMysticAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: StarMysticAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function isWorkshopAction(action: StarMysticAction): boolean {
  return action.command.type === "LEARN_SPELL" || action.command.type === "BUY_KIT"
    || action.command.type === "CRAFT_SCROLL" || action.command.type === "AUTHORIZE_SCROLL";
}

/** Render committed public observations and submit the original projected intent unchanged. */
export function StarMysticPanel({ starMystic, resources, busy, blocked = false, error = null, onCommand }: StarMysticPanelProps) {
  const [selectedCraftId, setSelectedCraftId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const workshop = starMystic.workshop;
  const selectedBottle = starMystic.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = starMystic.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = starMystic.actions.filter(isCaseAction);
  // Only public exit intents locate a currently open scene; prose is never parsed as state.
  const exitAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "WITHDRAW" && action.enabled);
  const fallbackExit = caseActions.find((action) => action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId
    : fallbackExit && "caseId" in fallbackExit.command ? fallbackExit.command.caseId : null;
  const selectedCase = (starMystic.insideCase ? starMystic.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? starMystic.cases.find((entry) => entry.id === selectedCaseId)
    ?? starMystic.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? starMystic.cases[0];
  // Public enabled intents remain usable inside the scene, including zero-resource exits.
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = starMystic.insideCase ? [] : starMystic.actions.filter(isEncounterAction);
  const growthActions = starMystic.insideCase ? [] : starMystic.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action) && !isWorkshopAction(action));
  const workshopActions = starMystic.promoted && workshop && !starMystic.insideCase ? starMystic.actions.filter(isWorkshopAction).filter((action) => {
    const command = action.command;
    if (command.type === "LEARN_SPELL") return workshop.lessons.some((lesson) => lesson.id === command.spellId && !lesson.learned);
    if (command.type === "AUTHORIZE_SCROLL") return workshop.scrolls.some((scroll) => scroll.id === command.scrollId);
    return true;
  }) : [];
  const actionableWorkshop = workshopActions.filter((action) => {
    const command = action.command;
    return command.type !== "AUTHORIZE_SCROLL" || !!workshop?.scrolls.some((scroll) => scroll.id === command.scrollId && scroll.status === "HELD");
  });
  const craftActions = workshopActions.filter((action) => action.command.type === "CRAFT_SCROLL");
  const selectedCraft = craftActions.find((action) => action.id === selectedCraftId) ?? craftActions.find((action) => action.enabled) ?? craftActions[0];
  const nextAction = starMystic.insideCase ? exitAction ?? fallbackExit : !starMystic.promoted
    ? starMystic.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type !== "WITHDRAW")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
      ?? actionableWorkshop.find((action) => action.enabled)
      ?? growthActions.find((action) => action.enabled)
      ?? encounterActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !starMystic.promoted && !starMystic.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (starMystic.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, starMystic.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || starMystic.promoted || starMystic.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, starMystic.promoted, starMystic.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: StarMysticAction) {
    if (busy || interactionBlocked || starMystic.insideCase || starMystic.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || starMystic.promoted || starMystic.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: StarMysticAction, unavailable = false) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || unavailable || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || unavailable || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `star-mystic-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`star-mystic-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel star-mystic-panel seer-confirmation" aria-label="这瓶星象师魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="星象师服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{starMystic.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{starMystic.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="star-mystic-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "star-mystic-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel star-mystic-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="星象师成长下一步">
      <span className="seer-seal">{starMystic.promoted ? "星象师5" : "卷轴教授6 → 星象师5"}</span>
      <h3>{starMystic.title}</h3>
      {starMystic.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : starMystic.insideCase ? "请查看当前公开的结束实践选项。"
          : starMystic.promoted && starMystic.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{starMystic.digestion}</p>
      {starMystic.discovered && !starMystic.promoted && <p className="slice-muted">用药指导：{starMystic.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得原瓶与逐瓶确认分别进行；实际费用、成熟条件与安全恢复范围以公开记录为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与晋升仪式细节尚未核实；材料、剂量、调配顺序及具体仪式要求保持未知，不能据此断言无需仪式。本阶段采用本作原创G的独立成品渠道、导师准备与指导服药流程，不提供虚构材料表。")}</p>
    </section>

    {starMystic.promoted && starMystic.environment && <section aria-label="当前星象师现场">
      <h4>当前现场</h4><p>{starMystic.environment}</p>
    </section>}
    {starMystic.promoted && starMystic.practice && <section className="slice-notice" aria-label="已保存的星象师视野与实际位置" aria-live="polite" aria-atomic="true">
      <h3>原眼镜、有限视野与实际位置</h3>
      <dl className="seer-facts">
        <div><dt>原眼镜与已观察视野</dt><dd>{starMystic.practice.vision}</dd></div>
        <div><dt>同一参与者与星光囚笼</dt><dd>{starMystic.practice.cage}</dd></div>
        <div><dt>本人位置与当下核对</dt><dd>{starMystic.practice.position}</dd></div>
      </dl>
      <p className="slice-muted">厚镜片须实际购买才会持有并戴好。准备只记录方法；尚未实际看见的标记内容保持未知。失败不抹去已经发生的抬镜、拉帘、步行或消耗；结束后只保留实际观察得到的知识。</p>
      {starMystic.practice.history.length > 0 && <details className="seer-fold">
        <summary>实际动作、原物与失败记录</summary>
        <ul>{starMystic.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      </details>}
    </section>}
    {starMystic.promoted && workshop && <section className="slice-notice" aria-label="卷轴工坊与实际原件">
      <h3>继承的卷轴工坊 · 当前序列5</h3>
      <p>{workshop.summary}</p>
      <p className="slice-muted">{playerText("沿用同一工坊、原课程与实际库存。旧卷制作序列保持6，新刻录如实记5；本次继续使用原G模板，不自动获得更强法术或序列4创作能力。")}</p>
      <p className="slice-muted">学习、购买、刻录与授权仅在保存后更新。成品默认未授权；授权只允许匹配战斗槽自动使用一次，实际启动另耗1灵性，使用仍可失败。</p>
      {workshop.lessons.length > 0 && <section aria-label="继承的巫师法术学习">
        <h4>实际学会后才能刻录</h4>
        {workshop.lessons.map((lesson) => <article key={lesson.id}>
          <p>{lesson.label} · {lesson.learned ? "已实际学会" : "尚未学会"}</p>
          <details className="seer-fold"><summary>{lesson.label}的原教学边界</summary><p>{lesson.description}</p><p className="slice-muted">原法术ID：{lesson.id}</p></details>
          {!lesson.learned && workshopActions.filter((action) => action.command.type === "LEARN_SPELL" && action.command.spellId === lesson.id).map((action) => actionButton(action))}
        </article>)}
      </section>}
      {workshopActions.some((action) => action.command.type === "BUY_KIT" || action.command.type === "CRAFT_SCROLL") && <div role="group" aria-label="材料购买与卷轴刻录">
        {workshopActions.filter((action) => action.command.type === "BUY_KIT").map((action) => actionButton(action))}
        {selectedCraft && <>
          <label className="seer-case-selector">选择要刻录的卷轴
            <select value={selectedCraft.id} disabled={busy || interactionBlocked || starMystic.insideCase} onChange={(event) => setSelectedCraftId(event.target.value)}>
              {craftActions.map((action) => <option key={action.id} value={action.id}>{action.command.type === "CRAFT_SCROLL" ? SCROLL_LABELS[action.command.kind] : action.label}</option>)}
            </select>
          </label>
          {actionButton(selectedCraft)}
        </>}
      </div>}
      <details className="seer-fold">
        <summary>材料原份 · 实际持有与耗用</summary>
        {workshop.materials.length > 0 ? workshop.materials.map((material) => <article key={material.id}>
          <p>材料ID：{material.id} · {material.status === "HELD" ? "实际持有" : "已实际耗用"}</p>
          <p className="slice-muted">取得周：{material.acquiredWeek} · {material.spentWeek === null ? "尚未耗用" : `耗用周：${material.spentWeek}`}</p>
        </article>) : <p className="slice-muted">尚无实际购买的材料原份。</p>}
      </details>
      <section aria-label="卷轴原件与逐件战前授权">
        <h4>卷轴原件与逐件战前授权</h4>
        {workshop.scrolls.length > 0 ? workshop.scrolls.map((scroll) => <article className="warrior-history-bottle" key={scroll.id}>
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
    {selectedCase && <section aria-label="星象师有限实践">
      <h3>遮帘后的有限观察、自愿囚笼与当下天空</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || starMystic.insideCase}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {starMystic.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前星象师实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；请先核对原现场、本人自愿参与、约定标记与停止边界。帘后内容、未做的实践与未来天气都不能提前当作已知。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备只记录本次方法，不抬起原眼镜、不拉开原帘、不移动参与者、不建立囚笼，也不提前走到庭院；只显示已保存的结果。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="星象师实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前星象师实践行动">{selectedCaseActions.map((action) => actionButton(action))}</div>}
        {starMystic.insideCase && <p className="slice-muted">返回生活前须按公开选项实际收束：拉合原帘并戴回已持有的同一眼镜，解除本次囚笼后让达芙宁沿原两米路自由走回，或本人沿原六米走廊返回房间。0行动、0精神、0灵性结束，最后行动耗尽仍可退出；不退款、不抹去失败、不清除已经实际看到的知识，也不额外发奖。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="星象师成长行动">{growthActions.map((action) => actionButton(action))}</div>}
    {starMystic.promoted && <section aria-label="星象师有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">成年空院看守布莱斯持自己的普通短棍，双方相距两米，原普通出口清楚，对方不追击，现场没有旁观者。达芙宁不参加这场战斗；交涉与沿原出口离开均以公开选项为准，战斗有真实伤势与死亡风险。</p>
      <p className="slice-muted">星光囚笼直接施术，不自动耗用卷轴；只在实际成功后限制本场原对手下一次有效普通打击，一次后或本轮结束失效，不控制其思想、言语或全部行动。有限窥秘须已实际持有并戴好原眼镜；抬镜聚焦与囚笼本身不直接扣健康，也不保证胜利。</p>
      {encounterActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="星象师冲突行动">{encounterActions.map((action) => actionButton(action))}</div>}
    </section>}
    {starMystic.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{starMystic.story}</p></details>}
    {starMystic.discovered && starMystic.supplies && <section className="slice-notice" aria-label="星象师成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{starMystic.supplies}</p>
    </section>}
    {starMystic.discovered && starMystic.bottles.length > 0 && <details className="seer-fold" open={!starMystic.promoted}>
      <summary>星象师独立成品原瓶 · 来源与去向</summary>
      {starMystic.bottles.map((bottle) => {
        const action = starMystic.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !starMystic.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !starMystic.promoted && !starMystic.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `star-mystic-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`star-mystic-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {starMystic.discovered && !starMystic.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{starMystic.risk}</p></details>}
    {starMystic.promoted && <section aria-label="星象师能力与消化">
      <h3>能力与消化 · {starMystic.abilities.length} 项训练记录</h3>
      <p>扮演进度 {starMystic.acting} · 消化：{starMystic.digestion}</p>
      <progress className="cryptologist-progress" aria-label="星象师扮演进度" value={starMystic.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {starMystic.pollution}</p>
      {starMystic.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="星象师能力边界">
        <summary>查看有限窥秘、星光囚笼与继承工坊边界</summary>
        <p>本阶段是窥秘人途径序列5星象师，序列6卷轴教授的后续。成熟星象师的窥秘之眼有更强的隔障视野，但可能出现混乱与风险；厚镜片过滤额外视野，不等于全知、安全读心或未来预言。本段只处理原现场的有限主动观察，普通生活中不自动揭示秘密或持续扣精神。</p>
        <p>原厚眼镜实际购入花1行动与80便士；仅取得同一原件并实际戴好。观察原遮帘后约定标记时，能力方法实际抬镜，耗1行动、3灵性与2精神，知识14判定；普通方法经允许实际拉开原帘，1行动、0灵性，知识10判定。标记内容只由实际观察后的公开结果提供，准备或抬镜失败不凭空知道答案。</p>
        <p>成年达芙宁自愿沿原两米路径走到约定位置，直接星光囚笼耗1行动与3灵性、知识14判定，失败不建立囚笼；普通方法只是本人自愿停在已有地面边界，不是束缚。结束时实际解除囚笼，她自由沿原路走回，不传送、不造成练习伤害，也不继续控制她。</p>
        <p>相互冲突的三条旧天气记录不能证明未来。第三项只提供普通方法：本人实际沿原六米走廊到庭院核对当下天空，再沿原路返回；失败仍保留实际看到的当下天气，不冒充未来预报、改变天气或跳过时间。</p>
        <p>{playerText("每项有限报告25与回顾25组成和平消化100。能力方法成功后的有限报告才可能增加已有知识池掌握；普通方法、退出、取消和重复报告不凭空训练新能力。三案故事、价格、数值、距离和判定均为本作原创G。")}</p>
        <p>{playerText("战斗K耗3灵性、知识14，成功后本轮原对手下一次有效普通打击贡献乘0.5，使用一次或回合结束清除。R须实际戴着原眼镜且本轮尚未聚焦，支付3灵性与2精神后抬镜；下一次K耗去聚焦，只加5个百分点G成功率。聚焦耗用或本轮结束戴回原眼镜，不退还资源；没有眼镜时R只有普通观察，不生成眼镜或增益，K仍可按原条件独立施用。")}</p>
        <p>继承工坊只用实际学会的原巫师法术和已有原材料。原序列6卷轴仍标记制作序列6，晋升后实际新刻录的卷轴标记制作序列5；刻录时掌握与一次使用规则保持，晋升不免费补课、不重写旧卷或自动提高模板强度。序列4神秘学家的神秘再现与根据故事创造能力尚未开放；序列2才是贤者。</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
