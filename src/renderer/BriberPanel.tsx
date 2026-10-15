import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { BriberAction, BriberCommand, BriberProjection } from "../domain/briber/types";
import type { BarbarianProjection } from "../domain/barbarian/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原物、对方选择与能力边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际尝试，请核对当事人的选择与结果",
  RESOLVED: "已提交本次实践报告",
};

/** Completed sequence-eight records preserve original materials, attempts, and reports without commands. */
export function BriberBarbarianHistory({ barbarian }: { barbarian: BarbarianProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="野蛮人时期的经历">
    <h3>野蛮人时期的经历</h3>
    <p className="slice-notice">这里保留野蛮人时期的原料、原瓶、实际作业、结束与报告，只供回看。</p>
    <p>野蛮人扮演进度 {barbarian.acting} · 消化：{barbarian.digestion}</p>
    {barbarian.story && <p>{barbarian.story}</p>}
    {barbarian.supplies && <p>{barbarian.supplies}</p>}
    {barbarian.environment && <p>{barbarian.environment}</p>}
    {barbarian.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次作业与接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {barbarian.formulaKnown && barbarian.formula.length > 0 && <details className="seer-fold">
      <summary>野蛮人时期已知配方</summary>
      <ul>{barbarian.formula.map((material) => <li key={material.name}>{material.name} · {material.quantity === null ? "数量原文未注明" : `${material.quantity} ${material.unit}`}{material.note && <small>{material.note}</small>}</li>)}</ul>
    </details>}
    {barbarian.bottles.length > 0 && <details className="seer-fold" open>
      <summary>野蛮人原瓶 · 来源与去向</summary>
      {barbarian.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {barbarian.abilities.length > 0 && <details className="seer-fold">
      <summary>野蛮人时期能力记录</summary>
      {barbarian.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: BriberAction): boolean {
  return "caseId" in action.command;
}

interface BriberPanelProps {
  briber: BriberProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: BriberCommand) => void;
}

/** Only committed public facts change contact, materials, preparation, bottles, or reports. */
export function BriberPanel({ briber, resources, busy, blocked, readOnly = false, onCommand }: BriberPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => briber.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = briber.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = briber.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = briber.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open contact; prose and old results never create a lock.
  const closeAction = briber.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? briber.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (briber.insideCase ? briber.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? briber.cases.find((entry) => entry.id === selectedCaseId)
    ?? briber.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? briber.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!briber.insideCase || action.command.type === "CLOSE")) : [];
  const actions = briber.insideCase ? [] : briber.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = briber.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : briber.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : briber.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (briber.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [briber.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !briber.promoted && !briber.insideCase && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || briber.promoted || briber.insideCase || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, briber.promoted, briber.insideCase, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: BriberAction) {
    if (busy || blocked || readOnly || briber.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || briber.promoted || briber.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: BriberAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `briber-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`briber-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }


  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶贿赂者魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="贿赂者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{briber.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{briber.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="briber-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "briber-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="贿赂者成长下一步">
        <span className="seer-seal">{briber.promoted ? "序列 7" : "贿赂者晋升卷宗"}</span>
        <h3>{briber.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份贿赂者卷宗只供回看。</p>
        ) : briber.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次赠与实践：</strong>{nextLabel || "查看当前公开结束选项"}。须按本次公开行动停止能力影响并结束谈话。结束为0行动、0精神、0灵性，资源为0或尝试失败时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，已经给出的赠物、当事人的选择与本次结果继续保留；关闭不会收回赠物。</p>
        ) : briber.promoted && briber.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{briber.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{briber.digestion}</p>
        {!briber.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成野蛮人消化100与晋升序列8后的八个完整周，再向米蕾·沃德学习配方、取得实际材料、调配成瓶，并独立确认服用。实际门槛、费用与劳动条件以公开行动为准。</p>}
        <p className="slice-muted">{playerText("米蕾·沃德继续提供指导，取得渠道或晋升不会自动加入组织。本阶段的材料供应批次、三项实践与数值属于本作原创G；三项赠与实践突出实际付出、有限削弱、普通沟通与尊重停止边界，是本阶段G扮演解释。")}</p>
      </section>

      {briber.promoted && <section className="slice-notice warrior-environment" aria-label="现场与本次赠与实践">
        <h4>现场与本次赠与实践</h4>
        <p>{briber.environment || "尚未取得现场公开记录；原赠物、对方的实际选择与本次接触边界，须经观察确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="贿赂者有限实践">
          <h3>实际赠物、有限削弱与普通沟通</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || readOnly || briber.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {briber.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前贿赂者实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次赠与实践：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未核对原物与对方选择；赠与、接触边界与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的赠与尝试、普通方法与实际结束见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="赠与、削弱与自主选择边界">
              <h4>赠与、削弱与自主选择边界</h4>
              <p>先观察原赠物与当事人的边界，再按公开选项选择能力方法或普通方法。观察、准备、实际执行、结束接触、报告分别提交；当前准备不是成功结果，成本与限制以公开按钮为准。</p>
              <p className="slice-muted">贿赂削弱不要求对方接住赠物或喝下杯中饮料；这不把实际拒绝变成同意，也不强迫对方达成协议。能力方法实际给出一件赠物并消耗3灵性，普通方法也保留自己的成本与结果。本次接触尚未结束时须先实际关闭；关闭为0行动、0精神、0灵性，不治疗、不退款，已经给出的赠物维持原去向，失败与拒绝记录继续保留。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="原赠物、实际结果与有限报告" aria-live="polite" aria-atomic="true">
              <h4>原赠物、实际结果与有限报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前贿赂者实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="贿赂者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {briber.story && <p className="slice-muted">{briber.story}</p>}

      {briber.discovered && <section className="slice-notice warrior-source" aria-label="实际赠物库存与去向">
        <h4>实际赠物库存与去向</h4>
        <dl className="seer-facts"><div><dt>仍在手中</dt><dd>{briber.gifts.held}</dd></div><div><dt>已实际给出</dt><dd>{briber.gifts.given}</dd></div></dl>
        <p>{briber.gifts.summary}</p>
        <p className="slice-muted">只按已保存的公开记录显示。购买、实际给出与结束接触是不同步骤；实际给出的赠物不会因关闭、失败或撤回准备而自动退还。</p>
      </section>}

      {briber.discovered && briber.supplies && <section className="slice-notice warrior-source" aria-label="贿赂者实际材料与批次">
        <h4>实际材料与独立批次</h4><p>{briber.supplies}</p>
      </section>}
      {briber.formulaKnown && briber.formula.length > 0 && <details className="seer-fold" aria-label="贿赂者已知配方">
        <summary>查看已知贿赂者配方 · {briber.formula.length} 种材料</summary>
        <ul className="seer-formula">{briber.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity === null ? "数量原文未注明" : `${material.quantity} ${material.unit}`}</strong>{material.note && <small>{material.note}</small>}</li>)}</ul>
        <p className="slice-muted">{playerText("这里只列已知材料与用量，不把列表顺序当作调配顺序。原文未注明的数量保留未知，G供应份数另行标明；取得六项实际材料、调配成瓶与确认服用是独立步骤。库存、原料去向和原瓶状态只按公开记录显示。")}</p>
      </details>}
      {briber.discovered && briber.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!briber.promoted}>
          <summary>贿赂者独立调配原瓶 · 来源与去向</summary>
          {briber.bottles.map((bottle) => {
            const action = briber.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !briber.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !briber.promoted && !briber.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `briber-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`briber-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {briber.discovered && !briber.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{briber.risk}</p></details>}
      {briber.promoted && (
        <section className="warrior-abilities" aria-label="贿赂者能力与消化">
          <h3>能力与消化 · {briber.abilities.length} 项训练记录</h3>
          <p className="slice-muted">保留律师的规则分析、说服论证与弱点识别，以及野蛮人的非凡体能与精神抗性，新增有限贿赂削弱。不开放序列6的扭曲或其它高序列能力。共同战斗中抽到贿赂时实际给出一件赠物并消耗3灵性，只削弱本轮此后一次实际敌方行动，削弱比例为35%乘以掌握效果系数；回合末到期，不增加行动次数或立即优势。</p>
          <p>扮演进度 {briber.acting} · 消化：{briber.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {briber.pollution}</p>
          {briber.abilities.map((ability) => (
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
