import { useEffect, useRef, useState } from "react";
import { MAGICIAN_CONSUMPTION_RULE, MAGICIAN_CONSUMPTION_OUTCOMES, MAGICIAN_CONSUMPTION_PROTECTION } from "../domain/magician/content";
import type { MagicianAction, MagicianCommand, MagicianProjection } from "../domain/magician/types";
import type { ClownCommand, ClownProjection } from "../domain/clown/types";
import type { SeerProjection } from "../domain/seer/types";
import type { SeerResources } from "./SeerPanel";
import { seerReadableText } from "./seer-feedback";
import "./seer-styles.css";

interface MagicianPanelProps {
  magician: MagicianProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: MagicianCommand) => void;
  onOpenFaceless?: () => void;
  onRecovery?: () => void;
}

/** Historical records never turn old growth or original bottles into repeatable actions. */
export function SeerHistory({ seer }: { seer: SeerProjection }) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const selectedCase = seer.practice.cases.find((entry) => entry.id === selectedCaseId) ?? seer.practice.cases[0];
  return (
    <section className="seer-panel" aria-label="占卜家时期的经历">
      <h3>占卜家时期的经历</h3>
      <p className="slice-notice">这里保留占卜家时期的委托、原瓶与能力记录。当前实践请回到魔术师卷宗。</p>
      <p>占卜家扮演进度 {seer.acting} · {seer.digestion}</p>
      {selectedCase && <section aria-label="占卜家委托历史">
        <label className="seer-case-selector">查看旧委托
          <select value={selectedCase.id} onChange={(event) => setSelectedCaseId(event.target.value)}>
            {seer.practice.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}
          </select>
        </label>
        <article className="seer-current-case"><h4>{selectedCase.title}</h4><p>{selectedCase.status}</p><p>{selectedCase.body}</p></article>
      </section>}
      <HistoricalRecords pathway={seer} name="占卜家" />
    </section>
  );
}

export function ClownHistory({ clown, busy, blocked, onCommand }: {
  clown: ClownProjection; busy: boolean; blocked: boolean; onCommand: (command: ClownCommand) => void;
}) {
  const paperActions = clown.actions.filter((action) => action.command.type === "BUY_PAPER");
  return (
    <section className="seer-panel" aria-label="小丑时期的经历" aria-busy={busy}>
      <h3>小丑时期的经历</h3>
      <p className="slice-notice">小丑时期的原瓶与情境仍可查阅。纸张继续使用同一份库存，当前实践请回到魔术师卷宗。</p>
      <p>小丑扮演进度 {clown.acting} · {clown.digestion}</p>
      {clown.story && <section aria-label="小丑情境历史"><p>{clown.story}</p></section>}
      <section aria-label="保留的纸张库存">
        <h4>随身纸张 {clown.paperSheets} 张</h4>
        <p className="slice-muted">店内剩余 {clown.paperStock} 张 · 已使用 {clown.paperSpent} 张</p>
        {paperActions.map((action) => <div className="seer-action magician-compact-action" key={action.id}>
          <button className="slice-choice" disabled={busy || blocked || !action.enabled}
            onClick={() => onCommand(action.command)} aria-describedby={action.reason ? `magician-paper-${action.id}` : undefined}>
            <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
          </button>
          {action.reason && <p className="seer-action-reason" id={`magician-paper-${action.id}`}>{action.reason}</p>}
        </div>)}
      </section>
      <HistoricalRecords pathway={clown} name="小丑" />
    </section>
  );
}

function HistoricalRecords({ pathway, name }: { pathway: SeerProjection | ClownProjection; name: string }) {
  return <>
    {pathway.bottles.length > 0 && <details className="seer-fold">
      <summary>{name}原瓶 · 来源与去向</summary>
      {pathway.bottles.map((bottle) => <article className="magician-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {pathway.formulaKnown && pathway.formula.length > 0 && <details className="seer-fold">
      <summary>已知{name}配方</summary>
      <ul className="seer-formula">{pathway.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong></li>)}</ul>
    </details>}
    {pathway.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的{name}能力</summary>
      {pathway.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </>;
}

/** Availability, quantities, costs and outcomes come only from the committed public projection. */
export function MagicianPanel({ magician, resources, busy, blocked, onCommand, onOpenFaceless, onRecovery }: MagicianPanelProps) {
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const abilitiesDetails = useRef<HTMLDetailsElement>(null);
  const abilitiesSummary = useRef<HTMLElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = magician.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = magician.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const practiceActions = magician.actions.filter((action) => action.command.type === "PRACTICE");
  const sceneActions = magician.actions.filter((action) => action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT");
  const sceneHasRecord = magician.practices.some((practice) => practice.id === "magician-dispute");
  const actionsForPractice = (id: string) => id === "magician-dispute" ? sceneActions
    : practiceActions.filter((action) => action.command.type === "PRACTICE" && action.command.practiceId === id);
  const selectedPractice = magician.practices.find((practice) => practice.id === selectedPracticeId)
    ?? magician.practices.find((practice) => actionsForPractice(practice.id).some((action) => action.enabled))
    ?? magician.practices[0];
  const selectedPracticeActions = selectedPractice ? actionsForPractice(selectedPractice.id) : [];
  const supplyActions = magician.actions.filter((action) => ["BUY_OIL", "PREPARE_LANTERN", "PREPARE_FIGURINE"].includes(action.command.type));
  const injuryActions = magician.actions.filter((action) => action.command.type === "TRANSFER_INJURY");
  const remainingActions = magician.actions.filter((action) => !["CONSUME", "PRACTICE", "BUY_OIL", "PREPARE_LANTERN", "PREPARE_FIGURINE", "TRANSFER_INJURY", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"].includes(action.command.type));
  const preparationGroups = new Map<string, MagicianAction[]>();
  for (const action of remainingActions) {
    const key = "batchId" in action.command ? action.command.batchId : "guidance";
    preparationGroups.set(key, [...(preparationGroups.get(key) ?? []), action]);
  }
  const batches = [...preparationGroups.entries()];
  const currentBatchActions = batches[0]?.[1] ?? [];
  const preparedBottleAction = magician.actions.find((action) => action.command.type === "CONSUME");
  const reflectionActions = remainingActions.filter((action) => action.command.type === "REFLECT");
  const nextAction = magician.promoted
    ? selectedPracticeActions.find((action) => action.enabled) ?? practiceActions.find((action) => action.enabled)
      ?? sceneActions.find((action) => action.enabled) ?? reflectionActions.find((action) => action.enabled)
      ?? selectedPracticeActions[0] ?? practiceActions[0] ?? sceneActions[0] ?? reflectionActions[0]
    : preparedBottleAction ?? currentBatchActions.find((action) => action.enabled) ?? currentBatchActions[0];
  const needsRecovery = !magician.promoted
    && magician.bottles.some((bottle) => bottle.status.startsWith("已耗尽") && bottle.status.includes("排异"))
    && (resources.health < resources.maxHealth || resources.mind < resources.maxMind || magician.pollution > 0);
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !magician.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || magician.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, magician.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: MagicianAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || magician.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }
  function actionButton(action: MagicianAction) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || blocked || !action.enabled}
        onClick={() => onCommand(action.command)} aria-describedby={action.reason ? `magician-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`magician-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }

  if (confirming && selectedBottle && selectedAction) return (
    <section className="seer-panel magician-panel seer-confirmation" aria-label="这瓶魔术师魔药的服用确认" aria-busy={busy}>
      <div className="slice-eyebrow">服用前，请再确认一次</div>
      <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
      <p className="seer-bottle-source">来源：{seerReadableText(selectedBottle.source)}</p>
      <dl className="seer-facts">
        <div><dt>这一瓶</dt><dd>{seerReadableText(selectedBottle.id)}</dd></div>
        <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      </dl>
      <section className="slice-notice seer-risk" aria-label="魔术师服用风险与四档结果">
        <strong>服用风险与四档结果</strong>
        <p>{MAGICIAN_CONSUMPTION_RULE}</p>
        <dl className="magician-risk-outcomes">
          {MAGICIAN_CONSUMPTION_OUTCOMES.map(({ label, effect }) => <div key={label}>
            <dt>{label}</dt><dd>{effect}</dd>
          </div>)}
        </dl>
        <p className="magician-risk-protection">{MAGICIAN_CONSUMPTION_PROTECTION}</p>
        <details className="seer-fold magician-risk-details">
          <summary>筹备与补货说明 · 完整规则</summary><p>{magician.risk}</p>
        </details>
      </section>
      <section aria-label="服药前当前资源" className="seer-current-resources">
        <h4>你现在的状态</h4>
        <dl className="seer-facts">
          <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
          <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
          <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
          <div><dt>污染</dt><dd>{magician.pollution}</dd></div>
          <div><dt>现金</dt><dd>{resources.cash}</dd></div>
          <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
        </dl>
      </section>
      {selectedAction.reason && <p className="seer-action-reason" id="magician-confirm-reason">{selectedAction.reason}</p>}
      <dl className="seer-facts magician-confirm-summary" aria-label="本次服用确认摘要">
        <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
        <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
      </dl>
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
        <button className="slice-button" disabled={confirmationLocked || !selectedAction.enabled} onClick={confirmBottle}
          aria-describedby={selectedAction.reason ? "magician-confirm-reason" : undefined}>
          {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
        </button>
      </div>
      <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或材料。</p>
    </section>
  );

  const bottleRecord = (bottle: MagicianProjection["bottles"][number]) => {
    const action = !magician.promoted ? magician.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id) : undefined;
    return <article className="seer-bottle" key={bottle.id}>
      <div><h4>{bottle.title}</h4><p>来源：{seerReadableText(bottle.source)}</p><small>{bottle.status}</small></div>
      {action && <div>
        <button className="slice-button" disabled={busy || blocked || !action.enabled}
          ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
          onClick={() => openBottle(action)} aria-describedby={action.reason ? `magician-bottle-${bottle.id}` : undefined}>
          查看并准备服用「{bottle.title}」
        </button>
        <p className="seer-small-note">{action.cost}</p>
        {action.reason && <p className="seer-action-reason" id={`magician-bottle-${bottle.id}`}>{action.reason}</p>}
      </div>}
    </article>;
  };
  const preparedBottleIds = new Set(magician.actions.flatMap((action) => action.command.type === "CONSUME" ? [action.command.bottleId] : []));
  const preparedBottles = magician.bottles.filter((bottle) => preparedBottleIds.has(bottle.id));
  const exhaustedBottles = magician.bottles.filter((bottle) => !preparedBottleIds.has(bottle.id));

  return <div className="seer-panel magician-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="魔术师成长下一步">
      <span className="seer-seal">{magician.promoted ? "序列 7" : "魔术师晋升准备"}</span>
      <h3>{magician.title}</h3>
      {magician.promoted && magician.abilities.length > 0 && <div role="group" aria-label="当前魔术师能力概览">
        <p><strong>当前魔术师能力 · {magician.abilities.length} 项：</strong>{magician.abilities.map((ability) => ability.label).join(" · ")}</p>
        <button className="slice-button quiet" onClick={() => {
          if (!abilitiesDetails.current) return;
          abilitiesDetails.current.open = true;
          abilitiesSummary.current?.focus({ preventScroll: true });
          abilitiesDetails.current.scrollIntoView({ block: "nearest", inline: "nearest" });
        }}>查看能力详情</button>
      </div>}
      {needsRecovery ? <>
        <p className="seer-next"><strong>下一步：先休养，再考虑重试。</strong>原瓶已耗尽；健康 {resources.health}/{resources.maxHealth} · 精神 {resources.mind}/{resources.maxMind} · 排异 {magician.pollution}。</p>
        <p className="slice-muted">可返回日常查看休养成本与效果。休养不保证晋升成功；下方仍可筹备新一瓶，材料与调配费用照常。</p>
        {onRecovery && <button className="slice-button quiet" disabled={busy || blocked} onClick={onRecovery}>返回日常休养</button>}
      </> : magician.promoted && magician.acting >= 100 ? <>
        <p className="seer-next"><strong>魔术师扮演已达100。</strong>可查看无面人筹备；仍需实际度过12整周并满足配方、材料与独立服药条件。</p>
        {onOpenFaceless && <button className="slice-button quiet" disabled={busy || blocked} onClick={onOpenFaceless}>查看无面人筹备</button>}
      </> : <p className="seer-next">{nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "暂时没有可执行的成长行动。"}</p>}
      <p className="slice-muted">{magician.promoted ? `扮演进度 ${magician.acting} · ${magician.digestion}` : magician.digestion}</p>
    </section>

    {!magician.promoted && <dl className="magician-preparation-budget" aria-label="魔术师筹备当前资源">
      <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      <div><dt>现金</dt><dd>{resources.cash}</dd></div>
    </dl>}

    {magician.promoted && selectedPractice && <section aria-label="魔术师实践">
      <label className="seer-case-selector">选择一次实践
        <select value={selectedPractice.id} disabled={busy || blocked} onChange={(event) => setSelectedPracticeId(event.target.value)}>
          {magician.practices.map((practice) => <option key={practice.id} value={practice.id}>{practice.title} · {practice.status}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前魔术师实践">
        <h3>{selectedPractice.title}</h3><p className="slice-muted">{selectedPractice.status}</p><p>{selectedPractice.story}</p>
        <div className="magician-action-list" role="group" aria-label="当前实践行动">{selectedPracticeActions.map(actionButton)}</div>
      </section>
    </section>}

    {magician.promoted && <section aria-label="魔术师实际道具">
      <h4>随身准备</h4>
      <dl className="seer-facts">
        <div><dt>纸张</dt><dd>{magician.supplies.paperSheets} 张</dd></div>
        <div><dt>已剪好的纸人</dt><dd>{magician.supplies.figurinesHeld} 个</dd></div>
        <div><dt>持有灯油</dt><dd>{magician.supplies.oilHeld} 份</dd></div>
        <div><dt>实际提灯</dt><dd>{magician.supplies.lanternPrepared ? "已经准备" : "尚未准备"}</dd></div>
      </dl>
      {supplyActions.length > 0 && <div className="seer-actions magician-action-list" role="group" aria-label="实际道具准备">{supplyActions.map(actionButton)}</div>}
      <p className="slice-muted seer-small-note">需要补纸时，可在小丑经历里购买同一份实际纸张。</p>
    </section>}

    {!sceneHasRecord && magician.story && <section aria-label="当前魔术师情境"><h4>当前情境</h4><p>{magician.story}</p>
      {sceneActions.length > 0 && <div className="seer-actions" role="group" aria-label="魔术师情境行动">{sceneActions.map(actionButton)}</div>}
    </section>}
    {!sceneHasRecord && !magician.story && sceneActions.length > 0 && <div className="seer-actions" role="group" aria-label="魔术师情境行动">{sceneActions.map(actionButton)}</div>}
    {magician.discovered && !magician.promoted && preparedBottles.length > 0 && <section className="seer-bottles" aria-label="已调配的魔术师魔药"><h3>已调配的魔术师魔药</h3>{preparedBottles.map(bottleRecord)}</section>}
    {remainingActions.length > 0 && <section aria-label={magician.promoted ? "魔术师成长行动" : "魔术师材料与调配"}>
      {!magician.promoted && <h4>材料与调配</h4>}
      {magician.promoted ? <div className="seer-actions">{remainingActions.map(actionButton)}</div> : <>
        <div className="seer-actions magician-preparation-batch" role="group" aria-label="当前准备批次">{currentBatchActions.map(actionButton)}</div>
        {batches.length > 1 && <details className="seer-fold magician-spare-batches">
          <summary>其他批次 · 备用材料（{batches.length - 1}批）</summary>
          {batches.slice(1).map(([id, actions]) => <div className="seer-actions magician-preparation-batch" role="group" aria-label="备用准备批次" key={id}>{actions.map(actionButton)}</div>)}
        </details>}
      </>}
    </section>}
    {magician.discovered && !magician.promoted && exhaustedBottles.length > 0 && <details className="seer-fold">
      <summary>已耗尽原瓶记录 · {exhaustedBottles.length}瓶</summary>{exhaustedBottles.map(bottleRecord)}
    </details>}
    {injuryActions.length > 0 && <details className="seer-fold">
      <summary>查看可转移的自身伤势</summary>
      <p>同一处伤势只能在自己的身体内部转移一次，不恢复健康，也不会消除已经结算的伤势。</p>
      <div className="magician-action-list" role="group" aria-label="自身伤势转移">{injuryActions.map(actionButton)}</div>
    </details>}

    {magician.discovered && magician.promoted && magician.bottles.length > 0 && <details className="seer-fold"><summary>魔术师原瓶 · 来源与去向</summary>{magician.bottles.map(bottleRecord)}</details>}
    {magician.discovered && !magician.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{magician.risk}</p></details>}
    {magician.discovered && magician.formulaKnown && magician.formula.length > 0 && <details className="seer-fold">
      <summary>查看已知魔术师配方 · {magician.formula.length} 种材料</summary>
      <ul className="seer-formula">{magician.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong></li>)}</ul>
      <p className="slice-muted">这里是已知配方。取得材料、调配成瓶与确认服用是三个独立步骤。</p>
    </details>}
    {magician.promoted && <details ref={abilitiesDetails} className="seer-fold" aria-label="魔术师能力与消化">
      <summary ref={abilitiesSummary}>能力与消化 · {magician.abilities.length} 项能力</summary>
      <p>灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {magician.pollution}</p>
      {magician.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </details>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
  </div>;
}
