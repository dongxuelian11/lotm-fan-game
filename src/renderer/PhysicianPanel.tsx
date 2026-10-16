import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PhysicianAction, PhysicianCommand, PhysicianProjection } from "../domain/physician/types";
import type { CultivatorProjection } from "../domain/cultivator/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察当事人的当前状况与照护边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际尝试，请核对实际健康与转介结果",
  RESOLVED: "已提交本次实践报告",
};

/** The inherited S9 history has no mutation callback or actionable controls. */
export function PhysicianCultivatorHistory({ cultivator }: { cultivator: CultivatorProjection }) {
  const title = "耕种者时期的经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">你已晋升医师。这里保留耕种者时期的原土、种子、水、实际照护、收成、已交付份数、原报告与原瓶来源，只供回看。</p>
    <p>耕种者扮演进度 {cultivator.acting} · 消化：{cultivator.digestion}</p>
    {cultivator.story && <p>{cultivator.story}</p>}
    {cultivator.supplies && <p>{cultivator.supplies}</p>}
    {cultivator.environment && <p>{cultivator.environment}</p>}
    {cultivator.garden && <p>{cultivator.garden}</p>}
    {cultivator.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次照护接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {cultivator.bottles.length > 0 && <details className="seer-fold" open>
      <summary>耕种者原瓶 · 来源与去向</summary>
      {cultivator.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {cultivator.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {cultivator.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: PhysicianAction): boolean {
  return "caseId" in action.command;
}

interface PhysicianPanelProps {
  physician: PhysicianProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: PhysicianCommand) => void;
}

/** Only committed public facts describe patient health, actual supplies, referral, and reports. */
export function PhysicianPanel({ physician, resources, busy, blocked, onCommand }: PhysicianPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => physician.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = physician.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = physician.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = physician.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open practice; prose and old results never create a lock.
  const closeAction = physician.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? physician.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (physician.insideCase ? physician.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? physician.cases.find((entry) => entry.id === selectedCaseId)
    ?? physician.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? physician.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!physician.insideCase || action.command.type === "CLOSE")) : [];
  const actions = physician.insideCase ? [] : physician.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = physician.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : physician.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : physician.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (physician.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [physician.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !physician.promoted && !physician.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || physician.promoted || physician.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, physician.promoted, physician.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: PhysicianAction) {
    if (busy || blocked || physician.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || physician.promoted || physician.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: PhysicianAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => { if (!busy && !blocked && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `physician-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`physician-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶医师魔药的服用确认" aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (!confirmationLocked) setSelectedBottleId(null);
          }
        }}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="医师服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{physician.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{physician.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="physician-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "physician-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="医师成长下一步">
        <span className="seer-seal">{physician.promoted ? "序列 8" : "医师成长卷宗"}</span>
        <h3>{physician.title}</h3>
        {physician.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次实践：</strong>{nextLabel || "查看当前公开结束选项"}。结束不消耗行动或灵性，0精神时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原观察、实际健康、敷料消耗与转介报告继续保留。</p>
        ) : physician.promoted && physician.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{physician.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{physician.digestion}</p>
        {!physician.promoted && <p className="slice-muted">需先完成耕种者100消化与四个完整序列9周。晋升准备和待执行准备期间仍可工作、调查或休养；成功晋升后仍沿母亲途径成长。</p>}
        <p className="slice-muted">{playerText("独立进阶成品、三项具体照护实践与具体治疗数值均为本作原创G，不是现实医疗指导。先观察实际状况、辨明有限照护与转介边界，再核对已经发生的结果；晋升不会自动加入组织，也不会凭空治好患者。")}</p>
      </section>

      {physician.promoted && <section className="slice-notice warrior-environment" aria-label="现场与当前实践">
        <h4>现场与当前实践</h4>
        <p>{physician.environment || "尚未取得照护现场的公开记录；患者当前状况、实际敷料与转介结果须经实际行动分别确认。"}</p>
      </section>}

      {physician.promoted && <section className="slice-notice warrior-environment" aria-label="患者健康、敷料与转介记录">
        <h4>患者健康、敷料与转介记录</h4>
        <p>{physician.clinic || "尚未取得公开照护记录；实际健康、敷料库存与转介结果仍待核对。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="医师有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || physician.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {physician.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前医师实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次实践：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察当事人；当前伤情、疲劳原因、异常来源与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的观察、有限照护、实际结束与转介报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="有限照护、实际健康与转介边界">
              <h4>有限照护、实际健康与转介边界</h4>
              <p>{playerText("先观察当事人的当前状况，再选择公开的能力方法或普通方法。轻微割伤使用本作G有限治疗，能力方法实际消耗3灵性，普通方法实际消耗1份敷料，并进行普通检定。成功时，能力方法将该患者本次健康从70改善至90，普通方法从70改善至80；这是本作原创G的本次规则，失败也保留已付成本。原因未明的疲劳与危险耳语只做有限观察和转介，不耗灵性，不把未知病因、灵魂损伤或污染宣称为已治愈。准备、执行、实际结束与报告分别提交，成本与限制以公开按钮为准。")}</p>
              <p className="slice-muted">具体恢复数值、患者健康与转介情况只按已保存的公开记录显示，界面不自行计算疗效。本阶段不提供现实药物处方、复杂手术、灵魂缝合、污染治愈或序列7催生。实际敷料用尽时，按公开行动花费45便士购入3份；买到用品不等于已治疗。本次实践尚未结束时，先实际停止照护并退开，再做其它事务；失败也须实际结束。结束不另抽随机、不奖励、不退款、不治疗，原结果与报告继续保留。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="当前照护、实际健康与转介报告" aria-live="polite" aria-atomic="true">
              <h4>当前照护、实际健康与转介报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前医师实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="医师成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {physician.story && <p className="slice-muted">{physician.story}</p>}

      {physician.discovered && <section className="slice-notice warrior-source" aria-label="医师成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。材料、完整用量与投料顺序仍未知，不用候选资料补成已知配方。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供材料采购或调配。来源、费用、三次劳动与后续补给条件以以下公开记录为准。")}</p>
        {physician.supplies && <p>{physician.supplies}</p>}
      </section>}
      {physician.discovered && physician.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!physician.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {physician.bottles.map((bottle) => {
            const action = physician.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !physician.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !physician.promoted && !physician.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `physician-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`physician-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {physician.discovered && !physician.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{physician.risk}</p></details>}
      {physician.promoted && (
        <section className="warrior-abilities" aria-label="医师能力与消化">
          <h3>能力与消化 · {physician.abilities.length} 项训练记录</h3>
          <p className="slice-muted">{playerText("序列8保留耕种者的三项原能力记录，与本阶段两项医师能力合并显示，共五项当前能力。掌握与边界以已公开记录为准；有限医学知识与治疗能力不等于万能治愈，不凭空获知病因，也不清除污染或自动修补灵魂。具体治疗规则为原创G；不提供现实处方，不提前开放序列7催生。晋升后灵性上限为45，当前灵性不会自动补满。")}</p>
          <p>扮演进度 {physician.acting} · 消化：{physician.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {physician.pollution}</p>
          {physician.abilities.map((ability) => (
            <details className="seer-fold" key={ability.id}>
              <summary>{ability.label} · 掌握 {ability.mastery}</summary>
              <p>{ability.description}</p>
            </details>
          ))}
        </section>
      )}
      {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    </div>
  );
}
