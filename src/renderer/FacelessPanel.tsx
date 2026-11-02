import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { FacelessAction, FacelessCommand, FacelessProjection } from "../domain/faceless/types";
import type { MagicianProjection } from "../domain/magician/types";
import type { SeerResources } from "./SeerPanel";
import { seerReadableText } from "./seer-feedback";
import "./seer-styles.css";

// Display-only wording for the two public practice explanations, not commands or saved history.
function facelessPracticeText(text: string): string {
  return text.replace("本人SELF、获同意成年人的STAGE_DOUBLE和PORTER_PART固定外貌与声线", "本人原貌、获同意的舞台替身和获同意的搬运工角色（后两者均为成年人）的固定外貌与声线")
    .replace(/(?<![A-Za-z0-9_:-])RESTORE_SELF(?![A-Za-z0-9_:-])/g, "复原本人外貌与原声")
    .replace(/(?<![A-Za-z0-9_:-])CLOSE(?![A-Za-z0-9_:-])/g, "结束本次练习");
}

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察本人、模板与实际边界",
  PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已实际尝试，请核对结果并结束接触",
  RESOLVED: "已提交本次实践报告",
};
const ENCOUNTER_STATUS: Record<string, string> = {
  AVAILABLE: "等待当面澄清", FIGHTING: "真实冲突进行中", RESOLVED: "争议已有结果",
  RETREATED: "已实际退出", LOST: "原冲突已结束",
};
function caseStatus(entry: FacelessProjection["cases"][number]): string {
  return (entry.id === "faceless-dispute" ? ENCOUNTER_STATUS : CASE_STATUS)[entry.status] ?? entry.status;
}

/** Earlier bottles, props and attempts remain records, never new actions. */
export function FacelessMagicianHistory({ magician }: { magician: MagicianProjection }) {
  return <section className="seer-panel magician-panel" aria-label="魔术师时期的经历">
    <h3>魔术师时期的经历</h3>
    <p className="slice-notice">这里保留魔术师时期的原瓶、实际道具、实践与能力记录，只供回看。</p>
    <p>魔术师扮演进度 {magician.acting} · 消化：{magician.digestion}</p>
    {magician.story && <p>{magician.story}</p>}
    {magician.practices.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status}</summary><p>{entry.story}</p>
    </details>)}
    <section aria-label="魔术师实际道具记录">
      <h4>实际道具记录</h4>
      <dl className="seer-facts">
        <div><dt>随身纸张</dt><dd>{magician.supplies.paperSheets} 张</dd></div>
        <div><dt>已剪好的纸人</dt><dd>{magician.supplies.figurinesHeld} 个</dd></div>
        <div><dt>持有灯油</dt><dd>{magician.supplies.oilHeld} 份</dd></div>
        <div><dt>实际提灯</dt><dd>{magician.supplies.lanternPrepared ? "已经准备" : "尚未准备"}</dd></div>
      </dl>
    </section>
    {magician.formulaKnown && magician.formula.length > 0 && <details className="seer-fold">
      <summary>魔术师时期已知配方</summary>
      <ul className="seer-formula">{magician.formula.map((material) => <li key={material.name}>
        <span>{material.name}</span><strong>{material.quantity} {material.unit}</strong>
      </li>)}</ul>
    </details>}
    {magician.bottles.length > 0 && <details className="seer-fold" open>
      <summary>魔术师原瓶 · 来源与去向</summary>
      {magician.bottles.map((bottle) => <article className="magician-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{seerReadableText(bottle.source)}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {magician.abilities.length > 0 && <details className="seer-fold">
      <summary>魔术师时期能力记录</summary>
      {magician.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

interface FacelessPanelProps {
  faceless: FacelessProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: FacelessCommand) => void;
  onRecovery?: () => void;
}

function isCaseAction(action: FacelessAction): boolean {
  return "caseId" in action.command && action.command.type !== "BORROW_OUTFIT";
}

/** Lay out the projected wording without replacing any probability, consequence or protection. */
function ConsumptionRisk({ text }: { text: string }) {
  const outcomes = [...text.matchAll(/(大成功|成功|失败|灾难)：([^；。]+[；。])/g)];
  if (outcomes.length === 0 || outcomes.some((outcome, index) => index > 0
    && outcome.index !== outcomes[index - 1]!.index + outcomes[index - 1]![0].length)) return <p>{text}</p>;
  const last = outcomes[outcomes.length - 1]!;
  return <>
    <p>{text.slice(0, outcomes[0]!.index)}</p>
    <dl className="magician-risk-outcomes">
      {outcomes.map((outcome) => <div key={outcome.index}>
        <dt>{outcome[1]}：</dt><dd>{outcome[2]}</dd>
      </div>)}
    </dl>
    <p className="magician-risk-protection">{text.slice(last.index + last[0].length)}</p>
  </>;
}

/** Appearance, voice, costume ownership and outcomes change only on committed public state. */
export function FacelessPanel({ faceless, resources, busy, blocked = false, error = null, readOnly = false, onCommand, onRecovery }: FacelessPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null || readOnly;
  const selectedBottle = faceless.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = faceless.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = faceless.actions.filter(isCaseAction);
  const encounterActions = faceless.actions.filter((action) => action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT");
  // Only the actual public CLOSE command identifies the open contact. Old prose cannot lock it.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (faceless.insideCase ? faceless.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? faceless.cases.find((entry) => entry.id === selectedCaseId)
    ?? faceless.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? faceless.cases[0];
  const selectedCaseActions = selectedCase?.id === "faceless-dispute" ? encounterActions : selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!faceless.insideCase || action.command.type === "CLOSE")) : [];
  const appearanceActions = faceless.actions.filter((action) => action.command.type === "CHANGE_APPEARANCE" || action.command.type === "RESTORE_SELF");
  const outfitActions = faceless.actions.filter((action) => action.command.type === "RETURN_OUTFIT"
    || (action.command.type === "BORROW_OUTFIT" && action.command.caseId === selectedCase?.id));
  const growthActions = faceless.insideCase ? [] : faceless.actions.filter((action) => !isCaseAction(action)
    && !["CONSUME", "CHANGE_APPEARANCE", "RESTORE_SELF", "BORROW_OUTFIT", "RETURN_OUTFIT", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"].includes(action.command.type));
  // Preserve the current bottle or batch's real blocker instead of recommending spare work.
  const preparedBottleAction = faceless.actions.find((action) => action.command.type === "CONSUME");
  const firstPreparation = growthActions[0];
  const preparationBatchId = firstPreparation && "batchId" in firstPreparation.command ? firstPreparation.command.batchId : null;
  const currentPreparationActions = preparationBatchId !== null
    ? growthActions.filter((action) => "batchId" in action.command
      && action.command.batchId === preparationBatchId)
    : firstPreparation ? [firstPreparation] : [];
  const preparationGroups = new Map<string, FacelessAction[]>();
  for (const action of growthActions) {
    const key = "batchId" in action.command ? action.command.batchId : "guidance";
    preparationGroups.set(key, [...(preparationGroups.get(key) ?? []), action]);
  }
  const preparationBatches = [...preparationGroups.entries()];
  const nextAction = faceless.insideCase ? closeAction : !faceless.promoted
    ? preparedBottleAction ?? currentPreparationActions.find((action) => action.enabled) ?? firstPreparation
    : [...selectedCaseActions, ...appearanceActions, ...outfitActions, ...growthActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const needsRecovery = !faceless.promoted && !faceless.insideCase && !readOnly
    && faceless.bottles.some((bottle) => bottle.status.startsWith("已耗尽") && bottle.status.includes("排异"))
    && (resources.health < resources.maxHealth || resources.mind < resources.maxMind || faceless.pollution > 0);
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !faceless.promoted && !faceless.insideCase && !readOnly;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (faceless.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, faceless.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || faceless.promoted || faceless.insideCase || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, faceless.promoted, faceless.insideCase, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: FacelessAction) {
    if (busy || interactionBlocked || faceless.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || faceless.promoted || faceless.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: FacelessAction) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `faceless-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`faceless-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel magician-panel seer-confirmation" aria-label="这瓶无面人魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!confirmationLocked) setSelectedBottleId(null);
      }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{seerReadableText(selectedBottle.source)}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{seerReadableText(selectedBottle.id)}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="无面人服用风险与四档结果">
      <h4>服用风险与四档结果</h4><ConsumptionRisk text={faceless.risk} />
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{faceless.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="faceless-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "faceless-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或材料；晋升不会替你选择外貌模板。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel magician-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="无面人成长下一步">
      <span className="seer-seal">{faceless.promoted ? "序列 6" : "无面人晋升卷宗"}</span>
      <h3>{faceless.title}</h3>
      {needsRecovery ? <>
        <p className="seer-next"><strong>下一步：先休养，再考虑重试。</strong>原瓶已耗尽；健康 {resources.health}/{resources.maxHealth} · 精神 {resources.mind}/{resources.maxMind} · 排异 {faceless.pollution}。</p>
        <p className="slice-muted">可返回日常查看休养成本与效果。休养不保证晋升成功；下方仍可筹备新一瓶，材料与调配费用照常。</p>
        {onRecovery && <button className="slice-button quiet" disabled={busy || interactionBlocked} onClick={onRecovery}>返回日常休养</button>}
      </> : <p className="seer-next">{readOnly ? "这份无面人卷宗只供回看。" : faceless.insideCase
        ? <><strong>先实际结束本次接触：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束接触不会复原外貌，也不会归还借来的原道具服。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "暂时没有可执行的成长行动。"}</p>}
      <p className="slice-muted">{faceless.digestion}</p>
      {!faceless.promoted && <p className="slice-muted">配方与材料可以提前准备；服用前须完成魔术师消化与成长所需整周。学习配方、取得实际材料、调配独立原瓶与逐瓶确认服用分别进行，成熟门槛、劳务进度与费用以当前公开记录为准；准备期间仍可继续普通生活。</p>}
    </section>

    {!faceless.promoted && <dl className="magician-preparation-budget faceless-preparation-budget" aria-label="无面人筹备当前资源">
      <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      <div><dt>现金</dt><dd>{resources.cash}</dd></div>
    </dl>}

    {faceless.promoted && <section className="slice-notice" aria-label="当前持续外貌与本人身份">
      <h4>当前持续外貌</h4>
      <dl className="seer-facts">
        <div><dt>当前外貌</dt><dd>{faceless.appearance.label}</dd></div>
        <div><dt>当前声音</dt><dd>{faceless.appearance.voice}</dd></div>
        <div><dt>相对本人身高</dt><dd>{faceless.appearance.heightOffsetCm} 厘米</dd></div>
        <div><dt>外貌来源</dt><dd>{faceless.appearance.source}</dd></div>
        <div><dt>持续状态</dt><dd>{faceless.appearance.persistent ? "变化持续中，须主动复原" : "当前为本人外貌"}</dd></div>
      </dl>
      <p>{faceless.appearance.summary}</p>
      <p className="slice-muted">本人姓名、经历、记忆与真实身份仍以人物卷宗为准。模板只提供获同意的原创成年角色的有限外貌与原声示范，不复制衣物、知识、关系、身份凭证或非凡能力，也不能任意选择NPC。</p>
      <p className="slice-muted">离场、关闭卷宗、结束接触或撤回准备都不会自动复原。恢复本人外貌须明确选择下方公开复原操作，消耗以按钮为准。</p>
      {appearanceActions.length > 0 && <div className="magician-action-list" role="group" aria-label="外貌变更与明确复原">{appearanceActions.map(actionButton)}</div>}
    </section>}

    {faceless.promoted && <section className="slice-notice" aria-label="原道具服与实际借还">
      <h4>原道具服与实际借还</h4>
      <dl className="seer-facts">
        <div><dt>原道具服</dt><dd>{faceless.outfit.label}</dd></div>
        <div><dt>原物编号</dt><dd>{faceless.outfit.id}</dd></div>
        <div><dt>当前去向</dt><dd>{faceless.outfit.location}</dd></div>
      </dl>
      <p>{facelessPracticeText(faceless.outfit.summary)}</p>
      <p className="slice-muted">改变外貌不会生成或更换衣物。借出与归还须分别提交，关闭接触、失败、撤回准备或复原都不会自动把原物送回。</p>
      {outfitActions.length > 0 && <div className="magician-action-list" role="group" aria-label="原道具服借还行动">{outfitActions.map(actionButton)}</div>}
    </section>}

    {faceless.promoted && faceless.environment && <section aria-label="当前无面人现场"><h4>当前现场</h4><p>{facelessPracticeText(faceless.environment)}</p></section>}
    {selectedCase && <section aria-label="无面人有限实践">
      <h3>外貌、举止与记住本人</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || faceless.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {faceless.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {caseStatus(entry)}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前无面人实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次接触：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{caseStatus(selectedCase)}</p>
        <section aria-label="实际观察与同意边界"><h4>实际观察与同意边界</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察记录；不能把模板外貌当作已了解当事人的声音、举止或身份。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备。选择方法不会提前改变外貌、发声、借入衣物或产生成功结果。"}</p>
        </section>
        {selectedCase.result && <section aria-label="实际结果与有限报告" aria-live="polite" aria-atomic="true">
          <h4>实际结果与有限报告</h4><p>{selectedCase.id === "remember-self"
            && selectedCase.result === "角色片段已完成，尚须按当前状态结束、复原并归还原服，才可报告。"
            ? "角色片段已完成。按当前外貌与原服状态完成必要的复原和归还，再提交自我报告。" : selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前无面人实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">普通方法保留自己的条件与结果。撤回准备与实际结束接触是不同操作；结束不治疗、不退款，不消除已发生的目击、拒绝或报告。是否可执行与实际成本由公开按钮显示。</p>
      </section>
    </section>}

    {growthActions.length > 0 && <section aria-label={faceless.promoted ? "无面人成长行动" : "无面人材料与调配"}>
      {faceless.promoted ? <div className="magician-action-list">{growthActions.map(actionButton)}</div> : <>
        <h4>材料与调配</h4>
        {preparationBatches.map(([id, actions], index) => <section className="faceless-preparation-batch" key={id}
          aria-label={index === 0 ? "当前准备批次" : "备用准备批次"}>
          <h5>{id === "guidance" ? "配方与补货" : index === 0 ? "当前批次" : "备用材料"}</h5>
          <div className="seer-actions magician-preparation-batch" role="group" aria-label={index === 0 ? "当前批次行动" : "备用材料行动"}>{actions.map(actionButton)}</div>
        </section>)}
      </>}
    </section>}
    {faceless.story && <p className="slice-muted">{faceless.story}</p>}
    {faceless.discovered && faceless.supplies && <section className="slice-notice" aria-label="无面人实际材料与批次">
      <h4>实际材料与独立批次</h4><p>{faceless.supplies}</p>
    </section>}
    {faceless.formulaKnown && faceless.formula.length > 0 && <details className="seer-fold" aria-label="无面人已知配方">
      <summary>查看已知无面人配方 · {faceless.formula.length} 种材料</summary>
      <ul className="seer-formula">{faceless.formula.map((material) => <li key={material.name}>
        <span>{material.name}</span><strong>{material.quantity === null ? "数量原文未注明" : `${material.quantity} ${material.unit}`}</strong>{material.note && <small>{material.note}</small>}
      </li>)}</ul>
      <p className="slice-muted">{playerText("材料顺序不等于投料顺序。未注明的原著用量保留未知，本作供货计量单独标明；取得材料、调配原瓶与确认服用是独立步骤。")}</p>
    </details>}
    {faceless.discovered && faceless.bottles.length > 0 && <details className="seer-fold" open={!faceless.promoted}>
      <summary>无面人独立调配原瓶 · 来源与去向</summary>
      {faceless.bottles.map((bottle) => {
        const action = faceless.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !faceless.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p>来源：{seerReadableText(bottle.source)}</p><small>{bottle.status}</small></div>
          {action && !faceless.promoted && !faceless.insideCase && !readOnly && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `faceless-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`faceless-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {faceless.discovered && !faceless.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{faceless.risk}</p></details>}
    {faceless.promoted && <section aria-label="无面人能力与消化">
      <h3>能力与消化 · {faceless.abilities.length} 项训练记录</h3>
      <p>扮演进度 {faceless.acting} · 消化：{faceless.digestion}</p>
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {faceless.pollution}</p>
      {faceless.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
