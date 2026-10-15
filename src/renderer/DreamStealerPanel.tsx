import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DreamStealerAction, DreamStealerCommand, DreamStealerProjection } from "../domain/dream-stealer/types";
import type { FireThiefProjection } from "../domain/fire-thief/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场",
  OBSERVED: "已有公开观察",
  PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告",
  RESOLVED: "已提交有限报告",
};

/** Preserve real S6 sources, demonstrations, independent windows and resources as read-only history. */
export function DreamStealerFireThiefHistory({ fireThief }: { fireThief: FireThiefProjection }) {
  const borrowedSample = fireThief.samples.find((sample) => sample.id === fireThief.loan.sample);
  return <section className="seer-panel warrior-panel" aria-label="盗火人时期的经历">
    <h3>盗火人时期的经历</h3>
    <p className="slice-notice">你已晋升窃梦家（序列5）。这里保留盗火人时期的真实来源、已发生示范、实际借用与使用、两段时窗、失败、恢复、已耗资源和独立原瓶，只供回看。</p>
    <p>盗火人扮演进度 {fireThief.acting} · 消化：{fireThief.digestion}</p>
    {(fireThief.story || fireThief.environment || fireThief.supplies) && <details className="seer-fold">
      <summary>盗火人原故事与供给</summary>
      {fireThief.story && <p>{fireThief.story}</p>}
      {fireThief.environment && <p>{fireThief.environment}</p>}
      {fireThief.supplies && <p>{fireThief.supplies}</p>}
    </details>}
    <details className="seer-fold" aria-label="盗火人原借用与两段时窗">
      <summary>原借用、实际使用与来源恢复记录</summary>
      <dl className="seer-facts">
        <div><dt>原现场实际借用</dt><dd>{fireThief.loan.sample === null ? "原记录没有当前临时能力" : borrowedSample?.label ?? fireThief.loan.sample}</dd></div>
        <div><dt>原借用案卷</dt><dd>{fireThief.loan.caseId ?? "没有未结束的原借用案卷"}</dd></div>
        <div><dt>自身原可用时窗</dt><dd>{fireThief.loan.playerSteps} 个现场时段</dd></div>
        <div><dt>来源原失能时窗</dt><dd>{fireThief.loan.targetSteps} 个现场时段</dd></div>
        <div><dt>原现场实际使用</dt><dd>{fireThief.loan.uses} 次</dd></div>
        <div><dt>原现场实际经过</dt><dd>{fireThief.loan.elapsedSteps} 个现场时段</dd></div>
        <div><dt>旧战斗自身借用</dt><dd>{fireThief.battleLoan.playerRounds} 回合</dd></div>
        <div><dt>旧战斗来源失能</dt><dd>{fireThief.battleLoan.targetRounds} 回合</dd></div>
        <div><dt>旧战斗借用起始</dt><dd>{fireThief.battleLoan.startedRound === null ? "未发生原战斗借用" : `第${fireThief.battleLoan.startedRound}回合`}</dd></div>
        <div><dt>旧战斗实际使用</dt><dd>{fireThief.battleLoan.uses} 次</dd></div>
        <div><dt>旧原对手灵性</dt><dd>{fireThief.enemySpirituality}</dd></div>
        <div><dt>旧原对手勇气示范</dt><dd>{fireThief.enemyCourageSeen ? "原战斗已实际观察" : "原战斗未实际观察"}</dd></div>
      </dl>
      <p className="slice-muted">这些是原现场与旧战斗各自的已保存记录，不续期、不补满来源灵性，不生成当前可用能力。逐次借用、借错、使用、等待与恢复仍以原案观察为准。</p>
    </details>
    {fireThief.samples.length > 0 && <details className="seer-fold" aria-label="盗火人原示范与来源资源">
      <summary>原真实来源、示范与剩余灵性</summary>
      {fireThief.samples.map((sample) => <article key={sample.id}>
        <h4>{sample.label}</h4><p className="slice-muted">原样本ID：{sample.id}</p>
        <p>来源：{sample.source}</p>
        <p>原来源灵性 {sample.instructorSpirituality} · {sample.demonstrated ? "已有原实际示范" : "尚无原实际示范"}</p>
      </article>)}
    </details>}
    {fireThief.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方案与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <p className="slice-muted">旧实践不重新结算、不发奖，不抹去失败或把旧同意续作新许可；既有原能力ID与掌握保留。窃取当前念头不会一并取得执行该念头所需的非凡能力，旧有限能力窃取也不提供无来源的技能库。</p>
    {fireThief.bottles.length > 0 && <details className="seer-fold">
      <summary>盗火人原瓶 · 来源与去向</summary>
      {fireThief.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {fireThief.abilities.length > 0 && <details className="seer-fold">
      <summary>盗火人时期能力记录</summary>
      {fireThief.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface DreamStealerPanelProps {
  dreamStealer: DreamStealerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DreamStealerCommand) => void;
}

function isCaseAction(action: DreamStealerAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: DreamStealerAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render committed public observations and submit the original projected intent unchanged. */
export function DreamStealerPanel({ dreamStealer, resources, busy, blocked = false, error = null, onCommand }: DreamStealerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = dreamStealer.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = dreamStealer.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = dreamStealer.actions.filter(isCaseAction);
  // Only public exit intents locate a currently open scene; prose is never parsed as state.
  const exitAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "WITHDRAW" && action.enabled);
  const fallbackExit = caseActions.find((action) => action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId
    : fallbackExit && "caseId" in fallbackExit.command ? fallbackExit.command.caseId : null;
  const selectedCase = (dreamStealer.insideCase ? dreamStealer.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? dreamStealer.cases.find((entry) => entry.id === selectedCaseId)
    ?? dreamStealer.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? dreamStealer.cases[0];
  // Public enabled intents remain usable inside the scene, including zero-resource exits.
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = dreamStealer.actions.filter(isEncounterAction);
  const growthActions = dreamStealer.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = !dreamStealer.promoted
    ? dreamStealer.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type !== "WITHDRAW")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
      ?? growthActions.find((action) => action.enabled)
      ?? encounterActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !dreamStealer.promoted && !dreamStealer.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (dreamStealer.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, dreamStealer.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || dreamStealer.promoted || dreamStealer.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, dreamStealer.promoted, dreamStealer.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: DreamStealerAction) {
    if (busy || interactionBlocked || dreamStealer.insideCase || dreamStealer.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || dreamStealer.promoted || dreamStealer.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: DreamStealerAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `dream-stealer-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`dream-stealer-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel dream-stealer-panel seer-confirmation" aria-label="这瓶窃梦家魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="窃梦家服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{dreamStealer.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{dreamStealer.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="dream-stealer-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "dream-stealer-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel dream-stealer-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="窃梦家成长下一步">
      <span className="seer-seal">{dreamStealer.promoted ? "窃梦家5" : "盗火人6 → 窃梦家5"}</span>
      <h3>{dreamStealer.title}</h3>
      {dreamStealer.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : dreamStealer.insideCase ? "请查看当前公开的结束实践选项。"
          : dreamStealer.promoted && dreamStealer.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{dreamStealer.digestion}</p>
      {dreamStealer.discovered && !dreamStealer.promoted && <p className="slice-muted">用药指导：{dreamStealer.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得原瓶与逐瓶确认分别进行；实际费用、成熟条件与安全恢复范围以公开记录为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与晋升仪式细节尚未核实，材料、剂量、调配顺序及具体仪式要求保持未知，不能据此断言无需仪式。本阶段采用本作原创G的独立成品渠道、导师准备与指导服药流程，不提供虚构材料表。")}</p>
    </section>

    {dreamStealer.promoted && dreamStealer.environment && <section aria-label="当前窃梦家现场">
      <h4>当前现场</h4><p>{dreamStealer.environment}</p>
    </section>}
    {dreamStealer.promoted && dreamStealer.practice && <section className="slice-notice" aria-label="窃梦家本人与原物实际状态" aria-live="polite" aria-atomic="true">
      <h3>本人的动作、目标恢复与原木片</h3>
      <dl className="seer-facts">
        <div><dt>本人当前姿态</dt><dd>{dreamStealer.practice.pose}</dd></div>
        <div><dt>原目标当前状态</dt><dd>{dreamStealer.practice.target}</dd></div>
        <div><dt>原木片去向</dt><dd>{dreamStealer.practice.token}</dd></div>
      </dl>
      <p className="slice-muted">念头窃取成功后，本人必须在同一次行动中立即亲自执行对应动作。不会暂存念头或等待另按执行按钮；准备本身不会让任何人坐下、停顿或移动原木片。</p>
      {dreamStealer.practice.history.length > 0 && <details className="seer-fold">
        <summary>实际窃取、立即执行与恢复记录</summary>
        <ul>{dreamStealer.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      </details>}
    </section>}
    {selectedCase && <section aria-label="窃梦家有限实践">
      <h3>当前落座念头、伸手念头与无心智装置</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || dreamStealer.insideCase}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {dreamStealer.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前窃梦家实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；原成年志愿者、自己的椅子与空桌、原木片去向均以已保存的公开记录为准。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备只记录本次知情同意与方法，不窃取念头、不冻结目标，也不改变本人姿态或原木片去向；实际执行与恢复只显示已保存的结果。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="窃梦家实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前窃梦家实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {dreamStealer.insideCase && <p className="slice-muted">{playerText("返回生活前须实际结束本次接触。若窃取造成短暂停顿，实际等过本作原创G的十秒并核实原目标恢复决定；随后按本案真实状态普通起身、收回空手并归置各自原物。普通路线没有被窃取的念头需要恢复。原蓝木片DS5-TOKEN-1始终属于诺汀，若已拿起须由他亲手放回自己的原桌；不是偷走物品或隔空归还。0行动、0精神、0灵性仍可按公开选项结束或撤回，不另抽随机、发奖、退款、治疗或清除原失败。")}</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="窃梦家成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="窃梦家有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">纸箱房的成年值守马洛持自己的普通短棍，距本人两米，私人空院有真实普通出口且对方不追击。他是普通人，没有可供盗取的非凡能力。可交涉或承担真实伤势与死亡风险；只有他当前实际形成的下一行动念头才可尝试窃取，成功后本人立即用自己的身体或手中原工具执行对应普通动作，不增加额外行动、不永久删除对方的后续决定，也不保证胜利。没有当前念头或面对非自主意外时只作普通准备。</p>
      <div className="warrior-action-list" role="group" aria-label="窃梦家冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {dreamStealer.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{dreamStealer.story}</p></details>}
    {dreamStealer.discovered && dreamStealer.supplies && <section className="slice-notice" aria-label="窃梦家成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{dreamStealer.supplies}</p>
    </section>}
    {dreamStealer.discovered && dreamStealer.bottles.length > 0 && <details className="seer-fold" open={!dreamStealer.promoted}>
      <summary>窃梦家独立成品原瓶 · 来源与去向</summary>
      {dreamStealer.bottles.map((bottle) => {
        const action = dreamStealer.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !dreamStealer.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !dreamStealer.promoted && !dreamStealer.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `dream-stealer-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`dream-stealer-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {dreamStealer.discovered && !dreamStealer.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{dreamStealer.risk}</p></details>}
    {dreamStealer.promoted && <section aria-label="窃梦家能力与消化">
      <h3>能力与消化 · {dreamStealer.abilities.length} 项训练记录</h3>
      <p>扮演进度 {dreamStealer.acting} · 消化：{dreamStealer.digestion}</p>
      <progress className="cryptologist-progress" aria-label="窃梦家扮演进度" value={dreamStealer.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {dreamStealer.pollution}</p>
      {dreamStealer.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="窃梦家能力边界">
        <summary>查看当前念头、立即执行与梦境边界</summary>
        <p>窃梦家可窃取目标当前刚形成、正准备执行的念头。成功后目标会暂时忘记这一决定，本人必须立即亲自执行对应动作；不会一并取得该动作所需的非凡能力。目标可恢复决定、拒绝进一步参与；不是永久删除思想、人格或全部未来行动。</p>
        <p>落座练习只涉及成年瑟蕾·芬恩当前同意的一次坐下决定，成功后本人立即坐在自己的原椅上。伸手练习只涉及成年诺汀·布莱尔的当前决定，本人立即向自己的空桌伸出空手，诺汀的原蓝木片仍在他自己的桌上，没有转移物品。实际结束时须恢复、普通起身、收回空手并让原主亲手归置原木片。</p>
        <p>更强目标可能抵抗，幻象与假动作不保证具有可窃取的真实念头。机械木臂没有自主心智，第三项只开放普通检查原杠杆与原记录；看到运动不等于发现了念头。普通路线不耗灵性，也不冒称目标被迫遗忘或发生了能力窃取。</p>
        <p>{playerText("原著有梦境与理想窃取的描述，但具体操作边界尚未核实。本阶段不开放未核实的梦境操作，不把梦中说法认定为事实；也不提前获得序列4才有的免于立即亲自执行、储存与寄生能力。")}</p>
        <p>{playerText("盗火人的旧有限能力窃取、原能力ID与掌握继续保留，只能依实际来源与既有条件使用，不从当前念头复制技能，不提供全部能力池。三项有限实践、十秒恢复、导师准备、距离、费用、判定和消化数值均为本作原创G；完整配方和晋升仪式细节仍待核实，不能断言无需仪式。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
