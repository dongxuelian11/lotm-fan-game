import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SpiritWarlockAction, SpiritWarlockCommand, SpiritWarlockProjection } from "../domain/spirit-warlock/types";
import type { SootherProjection } from "../domain/soother/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场",
  OBSERVED: "已有公开观察",
  PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告",
  RESOLVED: "已提交有限报告",
};

/** Preserve actual S6 observations, failed attempts, closures and original bottles as read-only history. */
export function SpiritWarlockSootherHistory({ soother }: { soother: SootherProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="安魂师时期的经历">
    <h3>安魂师时期的经历</h3>
    <p className="slice-notice">你已晋升灵巫（序列5）。这里保留安魂师时期三案的灵体观察、有限平复、清醒核实、失败、修订、实际结束与独立原瓶，只供回看。</p>
    <p>安魂师扮演进度 {soother.acting} · 消化：{soother.digestion}</p>
    {(soother.story || soother.environment || soother.supplies) && <details className="seer-fold">
      <summary>安魂师原故事与供给</summary>
      {soother.story && <p>{soother.story}</p>}
      {soother.environment && <p>{soother.environment}</p>}
      {soother.supplies && <p>{soother.supplies}</p>}
    </details>}
    {soother.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方案与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <p className="slice-muted">这里展示安魂师原记录，不重新结算旧实践、发奖、封印原灵体或抹去失败；灵体印象仍须现实核实。原能力ID与掌握继续保留。</p>
    {soother.bottles.length > 0 && <details className="seer-fold">
      <summary>安魂师原瓶 · 来源与去向</summary>
      {soother.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {soother.abilities.length > 0 && <details className="seer-fold">
      <summary>安魂师时期能力记录</summary>
      {soother.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface SpiritWarlockPanelProps {
  spiritWarlock: SpiritWarlockProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: SpiritWarlockCommand) => void;
}

function isCaseAction(action: SpiritWarlockAction): boolean { return "caseId" in action.command; }
function isSpiritAction(action: SpiritWarlockAction): boolean {
  return ["INVITE_SPIRIT", "RELEASE_SPIRIT", "RECALL_SPIRIT", "RETRIEVE_NOTE"].includes(action.command.type);
}
function isEncounterAction(action: SpiritWarlockAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render committed public observations and submit the original projected intent unchanged. */
export function SpiritWarlockPanel({ spiritWarlock, resources, busy, blocked = false, error = null, onCommand }: SpiritWarlockPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = spiritWarlock.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = spiritWarlock.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = spiritWarlock.actions.filter(isCaseAction);
  // Only public exit intents locate a currently open scene; prose is never parsed as state.
  const exitAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "WITHDRAW" && action.enabled);
  const fallbackExit = caseActions.find((action) => action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId
    : spiritWarlock.actions.some((action) => action.command.type === "RETRIEVE_NOTE" && action.enabled) ? "original-message"
      : fallbackExit && "caseId" in fallbackExit.command ? fallbackExit.command.caseId : null;
  const selectedCase = (spiritWarlock.insideCase ? spiritWarlock.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? spiritWarlock.cases.find((entry) => entry.id === selectedCaseId)
    ?? spiritWarlock.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? spiritWarlock.cases[0];
  // Public enabled intents remain usable inside the scene, including zero-resource exits.
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = spiritWarlock.actions.filter(isEncounterAction);
  const spiritActions = spiritWarlock.actions.filter(isSpiritAction);
  const growthActions = spiritWarlock.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action) && !isSpiritAction(action));
  const nextAction = !spiritWarlock.promoted
    ? spiritWarlock.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
      ?? (spiritWarlock.insideCase ? spiritActions.find((action) => action.enabled && action.command.type === "RETRIEVE_NOTE")
        ?? spiritActions.find((action) => action.enabled && action.command.type === "RECALL_SPIRIT") : undefined)
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
      ?? selectedCaseActions.find((action) => action.enabled)
      ?? spiritActions.find((action) => action.enabled && action.command.type === "INVITE_SPIRIT")
      ?? growthActions.find((action) => action.enabled)
      ?? encounterActions.find((action) => action.enabled)
      ?? spiritActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !spiritWarlock.promoted && !spiritWarlock.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (spiritWarlock.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, spiritWarlock.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || spiritWarlock.promoted || spiritWarlock.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, spiritWarlock.promoted, spiritWarlock.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SpiritWarlockAction) {
    if (busy || interactionBlocked || spiritWarlock.insideCase || spiritWarlock.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || spiritWarlock.promoted || spiritWarlock.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: SpiritWarlockAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `spirit-warlock-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`spirit-warlock-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel nightmare-panel seer-confirmation" aria-label="这瓶灵巫魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方、晋升仪式与具体法术清单仍待核实；本次只确认本作原创G指导流程中的这一成品原瓶，不表示无需仪式。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="灵巫服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{spiritWarlock.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{spiritWarlock.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="spirit-warlock-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "spirit-warlock-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel nightmare-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="灵巫成长下一步">
      <span className="seer-seal">{spiritWarlock.promoted ? "灵巫5" : "安魂师6 → 灵巫5"}</span>
      <h3>{spiritWarlock.title}</h3>
      {spiritWarlock.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : spiritWarlock.insideCase ? "请查看当前公开的结束实践选项。"
          : spiritWarlock.promoted && spiritWarlock.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{spiritWarlock.digestion}</p>
      {spiritWarlock.discovered && !spiritWarlock.promoted && <p className="slice-muted">用药指导：{spiritWarlock.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得原瓶与逐瓶确认分别进行；实际费用、成熟条件与安全恢复范围以公开记录为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方、晋升仪式与具体法术清单尚未核实，材料、剂量、调配顺序及仪式要求保持未知，不能据此断言无需仪式。本阶段采用本作原创G的独立成品渠道、普通导师准备与指导服药流程。")}</p>
    </section>

    {spiritWarlock.promoted && spiritWarlock.environment && <section aria-label="当前灵巫现场">
      <h4>当前现场</h4><p>{spiritWarlock.environment}</p>
    </section>}
    {spiritWarlock.promoted && spiritWarlock.companion && <section className="slice-notice" aria-label="灵巫原灵体与实际经历">
      <h3>{spiritWarlock.companion.name} · 原灵体记录</h3>
      <dl className="seer-facts">
        <div><dt>原灵体来源</dt><dd>{spiritWarlock.companion.source}</dd></div>
        <div><dt>当前实际状态</dt><dd>{spiritWarlock.companion.status}</dd></div>
      </dl>
      {spiritWarlock.companion.history.length > 0
        ? <ul>{spiritWarlock.companion.history.map((entry, index) => <li key={`${spiritWarlock.companion!.source}-${index}`}>{entry}</li>)}</ul>
        : <p className="slice-muted">尚无已保存的邀请、收容或协作经历。</p>}
      <p className="slice-muted">晋升不会自动获得灵体。卷叶是原庭院的同一个小型自然灵；实际邀请成功后才可自愿寄居于牙齿媒介中。召回只结束本次派出，不会替你走动、取回原纸条或结束梦境；释放让同一原灵体回到原庭院，已有经历保留。</p>
    </section>}
    {spiritWarlock.promoted && spiritWarlock.practice && <section className="slice-notice" aria-label="灵巫原纸条与当前梦境">
      <h3>原纸条与当前梦境</h3>
      <dl className="seer-facts">
        <div><dt>原纸条去向</dt><dd>{spiritWarlock.practice.note}</dd></div>
        <div><dt>当前梦境</dt><dd>{spiritWarlock.practice.dream}</dd></div>
      </dl>
      <p>{spiritWarlock.practice.summary}</p>
      <p className="slice-muted">原纸条SW5-NOTE-1始终属于导师。结束接触不会自动取回原件；须按公开选项让梅森本人沿同一段普通两米路径交回。有限梦境结束后目标清醒，本人身体仍在原处；记录不能直接证明消息内容为真。</p>
    </section>}
    {spiritActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="灵巫原灵体与原件行动">{spiritActions.map(actionButton)}</div>}
    {selectedCase && <section aria-label="灵巫有限实践">
      <h3>听叶、原件递送与安静协作</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || spiritWarlock.insideCase}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {spiritWarlock.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前灵巫实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；原灵体、原件去向与梦境状态均以已保存的公开记录为准。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备不会提前获得灵体、递送原纸条或开启梦境；效果只在实际执行并保存后显示。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="灵巫实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前灵巫实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {spiritWarlock.insideCase && <p className="slice-muted">返回生活前须实际结束接触与梦境、召回已派出的原灵体，并取回尚在收件人处的原纸条。0行动、0精神、0灵性时仍可使用已开放的结束、召回、取回或撤回选项；不会另抽随机、发奖、退款、治疗或清除原失败。释放同样为0行动，是否开放以当前公开选项为准。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="灵巫成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="灵巫有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">原庭院中的成年奥林持自己的普通短棍，出口与普通两米距离以实际现场为准。可选择交涉或承担真实战斗风险；维持继承梦魇时本体不能自由移动，只有实际取得并派出的原灵体才能协助，不保证命中、胜利或免伤。</p>
      <div className="warrior-action-list" role="group" aria-label="灵巫冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {spiritWarlock.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{spiritWarlock.story}</p></details>}
    {spiritWarlock.discovered && spiritWarlock.supplies && <section className="slice-notice" aria-label="灵巫成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{spiritWarlock.supplies}</p>
    </section>}
    {spiritWarlock.discovered && spiritWarlock.bottles.length > 0 && <details className="seer-fold" open={!spiritWarlock.promoted}>
      <summary>灵巫独立成品原瓶 · 来源与去向</summary>
      {spiritWarlock.bottles.map((bottle) => {
        const action = spiritWarlock.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !spiritWarlock.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !spiritWarlock.promoted && !spiritWarlock.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `spirit-warlock-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`spirit-warlock-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {spiritWarlock.discovered && !spiritWarlock.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{spiritWarlock.risk}</p></details>}
    {spiritWarlock.promoted && <section aria-label="灵巫能力与消化">
      <h3>能力与消化 · {spiritWarlock.abilities.length} 项训练记录</h3>
      <p>扮演进度 {spiritWarlock.acting} · 消化：{spiritWarlock.digestion}</p>
      <progress className="cryptologist-progress" aria-label="灵巫扮演进度" value={spiritWarlock.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {spiritWarlock.pollution}</p>
      {spiritWarlock.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="灵巫能力边界">
        <summary>查看身体收容、原灵体协助与梦境边界</summary>
        <p>{playerText("灵巫的身体可供灵体休憩与封印，本阶段以牙齿作为本作原创G的有限寄居媒介。收容、协助与协同训练只反映本人能力；灵体必须另行实际取得，晋升不会赠送灵体库或把卷叶的协助变成永久学会的本人技能。")}</p>
        <p>飞行、土行等借助灵体的效果需要合适且已经取得的独立灵体，当前卷叶不提供这些效果。本阶段不开放死神途径序列5的体内冥界，也不提前获得黑暗途径序列4的厄运。</p>
        <p>维持继承梦魇时本人身体留在原处，实际取得的原灵体可完成一次有限协助。三案中只有同意参与的成年梅森与原导师在场；普通方法也能完成和平消化，不会虚构收容、梦境或自动递送。</p>
        <p>卷叶SW5-LEAF-1与纸条SW5-NOTE-1各是同一原物，释放、召回、取回和结束各有实际作用，不复制或重置经历。原能力ID与掌握继续保留。</p>
        <p>{playerText("三项有限实践、和平消化、导师准备、费用、距离和具体判定均为本作原创G。完整魔药配方与晋升仪式仍待核实，不能断言无需仪式；普通与能力方法的条件、失败和实际消耗按公开选项结算。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
