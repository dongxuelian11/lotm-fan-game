import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SerialKillerAction, SerialKillerCommand, SerialKillerProjection } from "../domain/serial-killer/types";
import type { UnwingedProjection } from "../domain/unwinged/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原物与普通对照",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已有实际结果，请核对本次收束",
  RESOLVED: "已实际收束并提交有限报告",
};

/** S8's accepted fictional change and original records remain visible without mutation controls. */
export function SerialKillerUnwingedHistory({ unwinged }: { unwinged: UnwingedProjection }) {
  const status: Record<string, string> = {
    AVAILABLE: "尚未观察", OBSERVED: "已观察现场与当事人边界", PREPARED: "已选定方法并完成准备",
    EXAMINED: "已有实际结果，请核对冲动与克制", RESOLVED: "已提交原实践报告",
  };
  return <section className="seer-panel warrior-panel" aria-label="折翼天使时期的经历">
    <h3>折翼天使时期的经历</h3>
    <p className="slice-notice">这里保留折翼天使时期的原观察、实际方法、松手退开、报告、原瓶来源和能力掌握，只供回看。原序列8的独立角色变化接受继续保留，序列7不会重新要求接受，也不会恢复原有良知。</p>
    <p>折翼天使扮演进度 {unwinged.acting} · 消化：{unwinged.digestion}</p>
    <section aria-label="原序列8角色变化记录">
      <h4>原序列8角色变化记录</h4>
      <p>{unwinged.changeWarning}</p>
      <p>角色良知状态：{unwinged.conscienceLost ? "已失去原有良知" : "尚未发生晋升改变"}</p>
    </section>
    {unwinged.story && <p>{unwinged.story}</p>}
    {unwinged.environment && <p>{unwinged.environment}</p>}
    {unwinged.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {status[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      <p>原冲动记录：{entry.urgeOpen} · 实际克制次数：{entry.restraints}</p>
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {unwinged.supplies && <p>{unwinged.supplies}</p>}
    {unwinged.bottles.length > 0 && <details className="seer-fold" open><summary>折翼天使原瓶 · 来源与去向</summary>
      {unwinged.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {unwinged.abilities.length > 0 && <details className="seer-fold"><summary>已继承的折翼天使能力</summary>
      {unwinged.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: SerialKillerAction): boolean {
  return "caseId" in action.command;
}

interface SerialKillerPanelProps {
  serialKiller: SerialKillerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: SerialKillerCommand) => void;
}

/** Actual contact and its closure are committed public facts, never inferred from prose or resources. */
export function SerialKillerPanel({ serialKiller, resources, busy, blocked, onCommand }: SerialKillerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => serialKiller.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = serialKiller.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = serialKiller.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = serialKiller.actions.filter(isCaseAction);
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const openCase = serialKiller.insideCase ? serialKiller.cases.find((scene) => scene.id === closeCaseId) : undefined;
  const selectedCase = openCase ?? serialKiller.cases.find((scene) => scene.id === selectedCaseId)
    ?? serialKiller.cases.find((scene) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === scene.id))
    ?? serialKiller.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = serialKiller.insideCase ? [] : serialKiller.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const closeActions = caseActions.filter((action) => action.command.type === "CLOSE"
    && (!openCase || action.command.caseId === openCase.id));
  const nextAction = serialKiller.insideCase
    ? closeActions.find((action) => action.enabled) ?? closeActions[0]
    : serialKiller.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : serialKiller.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !serialKiller.promoted && !serialKiller.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (openCase) setSelectedCaseId(openCase.id);
    else if (!selectedCaseId && selectedCase) setSelectedCaseId(selectedCase.id);
  }, [openCase, selectedCaseId, selectedCase]);

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || serialKiller.promoted || serialKiller.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, serialKiller.promoted, serialKiller.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SerialKillerAction) {
    if (busy || blocked || !action.enabled || serialKiller.insideCase || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || serialKiller.promoted || serialKiller.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand({ type: "CONSUME", bottleId: selectedBottle.id, confirmed: true });
  }

  function actionButton(action: SerialKillerAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className={action.command.type === "CLOSE" ? "slice-choice primary" : "slice-choice"}
          disabled={busy || blocked || !action.enabled || (serialKiller.insideCase && action.command.type !== "CLOSE")}
          onClick={() => {
            if (busy || blocked || !action.enabled || (serialKiller.insideCase && action.command.type !== "CLOSE")) return;
            // Keep the acted-on scene visible when its committed result makes it resolved.
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `serialKiller-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`serialKiller-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel serialKiller-panel seer-confirmation" aria-label="这瓶连环杀手魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="连环杀手服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{serialKiller.risk}</p>
        </section>
        <section className="slice-notice" aria-label="已发生的虚构角色变化">
          <h4>已发生的虚构角色变化</h4>
          <p>折翼天使晋升时已单独接受的原有良知丧失与恶欲增强继续保留。这次确认只针对眼前的序列7原瓶；成功、失败或本阶段练习都不会恢复原有良知。</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{serialKiller.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="serialKiller-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "serialKiller-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel serialKiller-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="连环杀手成长下一步">
        <span className="seer-seal">{serialKiller.promoted ? "序列 7" : "连环杀手晋升卷宗"}</span>
        <h3>{serialKiller.title}</h3>
        {!serialKiller.insideCase && serialKiller.promoted && serialKiller.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的知识学习、实际收束与有限报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{serialKiller.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{serialKiller.digestion}</p>
        {!serialKiller.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先达到折翼天使消化100并度过序列8的八个完整周，再独立确认服用本次原瓶。</p>}
        <p className="slice-muted">{playerText("已核范围是恶魔知识与仪式。本页指导者、成品渠道、三项不伤人的知识／仪式练习、成本与消化解释为游戏设定（G），不代表原著保证此途径可以无痛善良消化。本阶段不开放序列6的火焰、诅咒、巨大化、魔甲或危险预知。")}</p>
      </section>

      {serialKiller.insideCase && <section className="slice-notice serialKiller-exit" aria-label="立即收束本次接触">
        <h3>先实际收束本次接触</h3>
        <p>{playerText("每次实际尝试后都须由玩家另行收束，失败也不例外。收束为0行动、0灵性，精神为0时仍可执行；本作G实际扣除最多5点当前精神，不另抽随机、不退款、不治疗，也不恢复原有良知。此前结果和成本继续保留。")}</p>
        <div className="seer-actions" role="group" aria-label="零行动实际收束">{closeActions.map(actionButton)}</div>
      </section>}

      {serialKiller.promoted && <section className="slice-notice serialKiller-environment" aria-label="已知实践环境">
        <h4>已知实践环境</h4>
        <p>{serialKiller.environment || "现场尚未确认，请先观察原物、记录和普通对照；未知来源不会自动成为事实。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="连环杀手有限知识与仪式实践">
          <h3>有限知识、仪式尝试与实际收束</h3>
          <p className="slice-muted">{playerText("先观察原物，再选择当前公开的有限仪式或普通对照。准备、实际尝试、收束和有限报告分别提交；准备或报告不能替代实际收束。三项不伤人练习与具体成本均为游戏设定（G），不保证未知来源可信。")}</p>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || serialKiller.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {serialKiller.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前知识与仪式实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="seer-fold serialKiller-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。原物、来源、对应关系和本次行动结果仍未确认；不会提前补出隐藏知识或成功结果。</p>}
            </section>
            <section className="serialKiller-preparation" aria-label="实际方法与准备">
              <h4>实际方法与准备</h4>
              <p>{selectedCase.preparation || "当前没有待执行的准备；观察、方法、实际尝试、收束与报告分别提交，不会自动生成结果。"}</p>
            </section>
            <p className="slice-muted">本次接触：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际收束次数：{selectedCase.closures} · 过度断言记录：{selectedCase.overclaims}</p>
            {selectedCase.status === "EXAMINED" && <p className="slice-notice">实践已有实际结果。先核对本次接触是否实际收束，再选择有限报告；已有过度断言不会因退出或更正而抹去。</p>}
            {selectedCase.result && <section className="slice-notice serialKiller-result" aria-label="实际实践结果"><h4>实际实践结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="seer-actions" role="group" aria-label="当前情境行动">{(!serialKiller.insideCase ? selectedCaseActions : []).map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="连环杀手成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {serialKiller.story && <p className="slice-muted serialKiller-source">{serialKiller.story}</p>}

      {serialKiller.discovered && <section className="slice-notice" aria-label="连环杀手成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用独立成品原瓶，不提供未核材料或调配。每瓶来源、劳动与供应条件以公开记录为准。")}</p>
        {serialKiller.supplies && <p>{serialKiller.supplies}</p>}
      </section>}
      {serialKiller.discovered && serialKiller.bottles.length > 0 && (
        <details className="seer-fold serialKiller-bottles" open={!serialKiller.promoted}>
          <summary>连环杀手独立成品原瓶 · 来源与去向</summary>
          {serialKiller.bottles.map((bottle) => {
            const action = serialKiller.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !serialKiller.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !serialKiller.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || serialKiller.insideCase || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `serialKiller-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`serialKiller-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {serialKiller.discovered && !serialKiller.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{serialKiller.risk}</p></details>}
      {serialKiller.promoted && (
        <section className="serialKiller-abilities" aria-label="连环杀手能力与消化">
          <h3>能力与消化 · {serialKiller.abilities.length} 项能力</h3>
          <p className="slice-muted">{playerText("罪犯与折翼天使时期的原记录、能力掌握和消化继续保留，角色已失去的原有良知不会恢复。这里仅显示恶魔知识与仪式的有限掌握；不提供未核魔类法术、完整真相或保证安全的接触。G练习的消化进度不等于原著确认的普遍善良消化路线。")}</p>
          <p>扮演进度 {serialKiller.acting} · 消化：{serialKiller.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {serialKiller.pollution}</p>
          {serialKiller.abilities.map((ability) => (
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
