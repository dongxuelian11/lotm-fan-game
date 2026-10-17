import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WizardAction, WizardCommand, WizardProjection } from "../domain/wizard/types";
import type { CombatScholarProjection } from "../domain/combat-scholar/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原物与法术边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际检验，请核对效果结束状态与报告",
  RESOLVED: "已核对效果结束并完成本次报告",
};
/** Earlier S8 records stay visible without a mutation callback. */
export function CombatScholarHistory({ combatScholar }: { combatScholar: CombatScholarProjection }) {
  const status: Record<string, string> = {
    AVAILABLE: "尚未观察", OBSERVED: "已观察当前动作、路线与停止信号", PREPARED: "已选定方法并完成准备",
    EXAMINED: "已实际演练，请核对停止状态与报告", RESOLVED: "已核对演练结束并完成本次报告",
  };
  return <section className="seer-panel combatScholar-panel" aria-label="格斗学者时期的经历">
    <h3>格斗学者时期的经历</h3>
    <p className="slice-notice">这里保留格斗学者时期的原观察、实际方法、演练停止与报告、原瓶来源和能力掌握，只供回看；当前成长请查看对应卷宗。</p>
    <p>格斗学者扮演进度 {combatScholar.acting} · {combatScholar.digestion}</p>
    {combatScholar.story && <p>{combatScholar.story}</p>}
    {combatScholar.environment && <p>{combatScholar.environment}</p>}
    {combatScholar.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {status[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      <p>演练状态：{entry.exerciseOpen}</p>
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {combatScholar.supplies && <p>{combatScholar.supplies}</p>}
    {combatScholar.bottles.length > 0 && <details className="seer-fold"><summary>格斗学者原瓶 · 来源与去向</summary>
      {combatScholar.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {combatScholar.abilities.length > 0 && <details className="seer-fold"><summary>已继承的格斗学者能力</summary>
      {combatScholar.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: WizardAction): boolean {
  return "caseId" in action.command;
}

interface WizardPanelProps {
  wizard: WizardProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: WizardCommand) => void;
}

/** Spell learning, effect state, costs and results come only from the committed public projection. */
export function WizardPanel({ wizard, resources, busy, blocked, onCommand }: WizardPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = wizard.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = wizard.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = wizard.actions.filter(isCaseAction);
  const endAction = caseActions.find((action) => action.command.type === "END" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "END");
  const endCaseId = endAction?.command.type === "END" ? endAction.command.caseId : null;
  const openCase = wizard.insideCase ? wizard.cases.find((scene) => scene.id === endCaseId) : undefined;
  const selectedCase = openCase ?? wizard.cases.find((scene) => scene.id === selectedCaseId)
    ?? wizard.cases.find((scene) => scene.status === "EXAMINED")
    ?? wizard.cases.find((scene) => scene.status === "OBSERVED" || scene.status === "PREPARED")
    ?? wizard.cases.find((scene) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === scene.id))
    ?? wizard.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = wizard.actions.filter((action) => action.command.type !== "CONSUME" && action.command.type !== "LEARN_SPELL" && !isCaseAction(action));
  const lessonActions = wizard.actions.filter((action) => action.command.type === "LEARN_SPELL");
  const endActions = caseActions.filter((action) => action.command.type === "END"
    && (!openCase || action.command.caseId === openCase.id));
  const nextAction = wizard.insideCase
    ? endActions.find((action) => action.enabled) ?? endActions[0]
    : wizard.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? lessonActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? lessonActions[0] ?? actions[0]
    : wizard.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !wizard.promoted && !wizard.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (openCase) setSelectedCaseId(openCase.id);
    else if (!selectedCaseId && selectedCase) setSelectedCaseId(selectedCase.id);
  }, [openCase, selectedCaseId, selectedCase]);

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || wizard.promoted || wizard.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, wizard.promoted, wizard.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: WizardAction) {
    if (busy || blocked || !action.enabled || wizard.insideCase || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || wizard.promoted || wizard.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: WizardAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className={action.command.type === "END" ? "slice-choice primary" : "slice-choice"}
          disabled={busy || blocked || !action.enabled || (wizard.insideCase && action.command.type !== "END")}
          onClick={() => {
            if (busy || blocked || !action.enabled || (wizard.insideCase && action.command.type !== "END")) return;
            // Keep the acted-on scene visible when its committed result makes it resolved.
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `wizard-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`wizard-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel wizard-panel seer-confirmation" aria-label="这瓶巫师魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="巫师服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{wizard.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{wizard.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="wizard-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "wizard-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel wizard-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="巫师成长下一步">
        <span className="seer-seal">{wizard.promoted ? "序列 7" : "巫师晋升卷宗"}</span>
        <h3>{wizard.title}</h3>
        {!wizard.insideCase && wizard.promoted && wizard.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已学法术、效果结束与实际报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{wizard.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{wizard.digestion}</p>
        {!wizard.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先达到格斗学者消化100并度过序列8的八个完整周，再独立确认服用本次原瓶。</p>}
        <p className="slice-muted">{playerText("本页三项有限法术、课程、实践情境、成品渠道和数值均为游戏设定（G），不作为原著已核法术。晋升不会自动学会所有法术，也不自动加入组织。")}</p>
      </section>

      {wizard.insideCase && <section className="slice-notice wizard-stop" aria-label="立即结束本次法术效果">
        <h3>先实际结束本次法术效果</h3>
        <p>本次法术效果仍未实际结束。无论此前成功或失败，都请先结束效果，再报告或安排其它事务；结束为0行动、0灵性，行动、精神或灵性为0时仍可执行。它不会抹去实际结果，也不会退回已支付的成本。</p>
        <div className="seer-actions" role="group" aria-label="零行动结束法术效果">{endActions.map(actionButton)}</div>
      </section>}

      {wizard.promoted && <section className="slice-notice wizard-environment" aria-label="已知实践环境">
        <h4>已知实践环境</h4>
        <p>{wizard.environment || "现场尚未确认，请先观察原物、当前条件与可使用法术的边界。"}</p>
      </section>}

      {wizard.promoted && <section className="wizard-lessons" aria-label="巫师已知法术与学习">
        <h3>法术学习 · 逐项记录</h3>
        <p className="slice-muted">{playerText("三项法术共用“法术研习”掌握记录。学习每项需1行动、60便士，知识难度12；失败后下周才能重试。已学会与否、可用条件和本次成本以公开记录和按钮为准。")}</p>
        {wizard.lessons.map((lesson) => <article className="seer-fold" key={lesson.id}>
          <h4>{lesson.label} · {lesson.learned ? "已学会" : "尚未学会"}</h4>
          <p>{lesson.description}</p>
          <div className="seer-actions" role="group" aria-label={`${lesson.label}学习行动`}>
            {lessonActions.filter((action) => action.command.type === "LEARN_SPELL" && action.command.spellId === lesson.id).map(actionButton)}
          </div>
        </article>)}
      </section>}

      {selectedCase && (
        <section aria-label="巫师实践记录">
          <h3>已学法术、有限应用与实际结束</h3>
          <p className="slice-muted">{playerText("先实际观察，再选择已学法术或普通核对。学习、准备、施放、结束效果与报告分别提交；尚未结束的效果必须先实际结束，之后再报告。退出准备不会退还成本，也不能代替结束效果。具体法术与效果均为游戏设定（G）。")}</p>
          <label className="seer-case-selector">
            选择法术实践
            <select value={selectedCase.id} disabled={busy || blocked || wizard.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {wizard.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前法术实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="seer-fold wizard-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。原物、当前条件与本次行动结果仍未确认。</p>}
            </section>
            <section className="wizard-preparation" aria-label="实际方法与准备">
              <h4>实际方法与准备</h4>
              <p>{selectedCase.preparation || "当前没有待执行的准备；观察、方法、实际检验、结束效果与报告分别提交，不会自动生成结果。"}</p>
            </section>
            <p className="slice-muted">效果状态：{selectedCase.effectOpen}</p>
            {selectedCase.status === "EXAMINED" && <p className="slice-notice">实践已有实际结果。请核对是否已实际结束效果，再提交本次报告；尚未完成报告与奖励结算。</p>}
            {selectedCase.result && <section className="slice-notice wizard-result" aria-label="实际实践结果"><h4>实际实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="seer-actions" role="group" aria-label="当前情境行动">{selectedCaseActions.filter((action) => !wizard.insideCase || action.command.type !== "END").map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="巫师成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {wizard.story && <p className="slice-muted wizard-source">{wizard.story}</p>}

      {wizard.discovered && <section className="slice-notice" aria-label="巫师成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用独立成品原瓶，不提供未核材料或调配。每瓶来源、劳动与供应条件以公开记录为准。")}</p>
        {wizard.supplies && <p>{wizard.supplies}</p>}
      </section>}
      {wizard.discovered && wizard.bottles.length > 0 && (
        <details className="seer-fold wizard-bottles" open={!wizard.promoted}>
          <summary>巫师独立成品原瓶 · 来源与去向</summary>
          {wizard.bottles.map((bottle) => {
            const action = wizard.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !wizard.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !wizard.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || wizard.insideCase || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `wizard-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`wizard-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {wizard.discovered && !wizard.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{wizard.risk}</p></details>}
      {wizard.promoted && (
        <section className="wizard-abilities" aria-label="巫师能力与消化">
          <h3>能力与消化 · {wizard.abilities.length} 项能力</h3>
          <p className="slice-muted">{playerText("本阶段具体法术及效果全部属于游戏设定（G）；窥秘人与格斗学者时期的能力、消化成果及原掌握记录继续保留。只可使用实际学会的法术；有限应用不能读取思想、复制其它途径能力或保证命中，不提前开放卷轴、神秘再现与高阶窥秘之眼。")}</p>
          <p>扮演进度 {wizard.acting} · 消化：{wizard.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {wizard.pollution}</p>
          {wizard.abilities.map((ability) => (
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
