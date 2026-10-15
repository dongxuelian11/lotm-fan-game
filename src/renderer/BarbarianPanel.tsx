import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { BarbarianAction, BarbarianCommand, BarbarianProjection } from "../domain/barbarian/types";
import type { LawyerProjection } from "../domain/lawyer/types";
import { LawyerHistory } from "./LawyerPanel";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原障碍、现场与能力边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际尝试，请核对当事人的选择与结果",
  RESOLVED: "已提交本次实践报告",
};

/** Completed sequence-nine records are read-only and retain their original acting. */
export function BarbarianLawyerHistory({ lawyer }: { lawyer: LawyerProjection }) {
  return <section aria-label="律师时期的经历">
    <h3>律师时期的经历</h3>
    <p>律师扮演进度 {lawyer.acting} · {lawyer.digestion}</p>
    <LawyerHistory lawyer={lawyer} />
  </section>;
}

function isCaseAction(action: BarbarianAction): boolean {
  return "caseId" in action.command;
}

interface BarbarianPanelProps {
  barbarian: BarbarianProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: BarbarianCommand) => void;
}

/** Only committed public facts change contact, materials, preparation, bottles, or reports. */
export function BarbarianPanel({ barbarian, resources, busy, blocked, readOnly = false, onCommand }: BarbarianPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => barbarian.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = barbarian.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = barbarian.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = barbarian.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open contact; prose and old results never create a lock.
  const closeAction = barbarian.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? barbarian.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (barbarian.insideCase ? barbarian.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? barbarian.cases.find((entry) => entry.id === selectedCaseId)
    ?? barbarian.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? barbarian.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!barbarian.insideCase || action.command.type === "CLOSE")) : [];
  const actions = barbarian.insideCase ? [] : barbarian.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = barbarian.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : barbarian.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : barbarian.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (barbarian.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [barbarian.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !barbarian.promoted && !barbarian.insideCase && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || barbarian.promoted || barbarian.insideCase || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, barbarian.promoted, barbarian.insideCase, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: BarbarianAction) {
    if (busy || blocked || readOnly || barbarian.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || barbarian.promoted || barbarian.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: BarbarianAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `barbarian-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`barbarian-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }


  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶野蛮人魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="野蛮人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{barbarian.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{barbarian.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="barbarian-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "barbarian-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="野蛮人成长下一步">
        <span className="seer-seal">{barbarian.promoted ? "序列 8" : "野蛮人晋升卷宗"}</span>
        <h3>{barbarian.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份野蛮人卷宗只供回看。</p>
        ) : barbarian.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次作业与接触：</strong>{nextLabel || "查看当前公开结束选项"}。须按本次公开行动结束作业、放下原物或退出谈话。结束为0行动、0精神、0灵性，资源为0或尝试失败时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原障碍、当事人的选择与本次结果继续保留。</p>
        ) : barbarian.promoted && barbarian.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{barbarian.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{barbarian.digestion}</p>
        {!barbarian.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成律师消化100与四个完整周，再向米蕾·沃德学习配方、取得实际材料、调配成瓶，并独立确认服用。实际门槛、费用与劳动条件以公开行动为准。</p>}
        <p className="slice-muted">{playerText("米蕾·沃德继续提供指导，取得渠道或晋升不会自动加入组织。本阶段的材料供应批次、三项实践与数值属于本作原创G；通过力量与普通协作处理原障碍、承受有限言语压力并尊重停止边界是本阶段G扮演解释。")}</p>
      </section>

      {barbarian.promoted && <section className="slice-notice warrior-environment" aria-label="现场与本次作业与接触">
        <h4>现场与本次作业与接触</h4>
        <p>{barbarian.environment || "尚未取得现场公开记录；原车、档案与谈话压力的具体状况，须经实际观察确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="野蛮人有限实践">
          <h3>身体力量、精神抗性与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || readOnly || barbarian.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {barbarian.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前野蛮人实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次作业与接触：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未核对原障碍与现场；具体受力、接触边界与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的身体尝试、普通方法与实际结束见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="力量、抗性与自主选择边界">
              <h4>力量、抗性与自主选择边界</h4>
              <p>先观察原障碍与当事人的边界，再按公开选项选择能力方法或普通方法。观察、准备、实际执行、结束接触、报告分别提交；当前准备不是成功结果，成本与限制以公开按钮为准。</p>
              <p className="slice-muted">身体强化与精神抗性都有范围和限度，不是无敌力量、精神免疫或强迫他人服从。卡住的车与沉重档案仍是原物，普通工具、协作与结束谈话也是有效选择。本次作业与接触尚未结束时，须先实际关闭；失败不代替结束，不治疗、不退款，也不抹去已经发生的结果。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="原障碍、实际结果与有限报告" aria-live="polite" aria-atomic="true">
              <h4>原障碍、实际结果与有限报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前野蛮人实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="野蛮人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {barbarian.story && <p className="slice-muted">{barbarian.story}</p>}

      {barbarian.discovered && barbarian.supplies && <section className="slice-notice warrior-source" aria-label="野蛮人实际材料与批次">
        <h4>实际材料与独立批次</h4><p>{barbarian.supplies}</p>
      </section>}
      {barbarian.formulaKnown && barbarian.formula.length > 0 && <details className="seer-fold" aria-label="野蛮人已知配方">
        <summary>查看已知野蛮人配方 · {barbarian.formula.length} 种材料</summary>
        <ul className="seer-formula">{barbarian.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity === null ? "数量原文未注明" : `${material.quantity} ${material.unit}`}</strong>{material.note && <small>{material.note}</small>}</li>)}</ul>
        <p className="slice-muted">{playerText("这里只列已知材料与用量，不把列表顺序当作调配顺序。原文未注明的数量保留未知，G供应份数另行标明；取得六项实际材料、调配成瓶与确认服用是独立步骤。库存、原料去向和原瓶状态只按公开记录显示。")}</p>
      </details>}
      {barbarian.discovered && barbarian.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!barbarian.promoted}>
          <summary>野蛮人独立调配原瓶 · 来源与去向</summary>
          {barbarian.bottles.map((bottle) => {
            const action = barbarian.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !barbarian.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !barbarian.promoted && !barbarian.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `barbarian-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`barbarian-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {barbarian.discovered && !barbarian.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{barbarian.risk}</p></details>}
      {barbarian.promoted && (
        <section className="warrior-abilities" aria-label="野蛮人能力与消化">
          <h3>能力与消化 · {barbarian.abilities.length} 项训练记录</h3>
          <p className="slice-muted">保留律师的规则分析、说服论证与弱点识别，新增身体强化与精神抗性。精神抗性不是精神免疫，也不会强迫他人服从；不提供序列7的贿赂或更高序列的扭曲。普通武器、掩体与撤退沿用共同战斗界面。</p>
          <p>扮演进度 {barbarian.acting} · 消化：{barbarian.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {barbarian.pollution}</p>
          {barbarian.abilities.map((ability) => (
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
