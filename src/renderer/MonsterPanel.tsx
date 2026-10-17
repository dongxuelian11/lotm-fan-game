import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { MonsterAction, MonsterCommand, MonsterProjection } from "../domain/monster/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与能力边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际记录，请另行核对片段与现场",
  RESOLVED: "已提交本次实践报告",
};

/** Other-pathway history has no mutation callback or actionable controls. */
export function MonsterHistory({ monster }: { monster: MonsterProjection }) {
  const title = "怪物渠道经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">这里保留怪物时期的渠道、原瓶与实践记录，只供回看；当前成长请查看对应卷宗。</p>
    {monster.story && <p>{monster.story}</p>}
    {monster.supplies && <p>{monster.supplies}</p>}
    {monster.environment && <p>{monster.environment}</p>}
    {monster.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次观察接触：{entry.contactOpen} · 实际结束次数：{entry.closes} · 过度断言记录：{entry.overclaims}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {monster.bottles.length > 0 && <details className="seer-fold" open>
      <summary>怪物原瓶 · 来源与去向</summary>
      {monster.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {monster.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {monster.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: MonsterAction): boolean {
  return "caseId" in action.command;
}

interface MonsterPanelProps {
  monster: MonsterProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: MonsterCommand) => void;
}

/** Only committed public facts change observation contact, preparation, or reports. */
export function MonsterPanel({ monster, resources, busy, blocked, readOnly = false, onCommand }: MonsterPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => monster.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = monster.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = monster.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = monster.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open contact; prose and old results never create a lock.
  const closeAction = monster.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? monster.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (monster.insideCase ? monster.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? monster.cases.find((entry) => entry.id === selectedCaseId)
    ?? monster.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? monster.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!monster.insideCase || action.command.type === "CLOSE")) : [];
  const actions = monster.insideCase ? [] : monster.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = monster.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : monster.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : monster.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (monster.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [monster.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !monster.promoted && !monster.insideCase && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || monster.promoted || monster.insideCase || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, monster.promoted, monster.insideCase, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: MonsterAction) {
    if (busy || blocked || readOnly || monster.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || monster.promoted || monster.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: MonsterAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `monster-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`monster-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <MonsterHistory monster={monster} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶怪物魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="怪物服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{monster.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{monster.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="monster-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "monster-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="怪物成长下一步">
        <span className="seer-seal">{monster.promoted ? "序列 9" : "怪物成长卷宗"}</span>
        <h3>{monster.title}</h3>
        {monster.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次观察接触：</strong>{nextLabel || "查看当前公开结束选项"}。结束不消耗行动或灵性，0精神时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，片段、普通核实与错误报告继续保留。</p>
        ) : monster.promoted && monster.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{monster.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{monster.digestion}</p>
        {!monster.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">{playerText("取得渠道或晋升不会自动加入组织。成年指导者艾妲·芬恩、成品供给、三项实践与数值为本作原创G。记录片段、普通核实与承认未知是本阶段G扮演解释，可完成本阶段消化；偶发预兆不等于确定未来，也不是原著保证。")}</p>
      </section>

      {monster.promoted && <section className="slice-notice warrior-environment" aria-label="现场与本次观察接触">
        <h4>现场与本次观察接触</h4>
        <p>{monster.environment || "尚未取得现场公开记录；感觉到的片段、后来的普通核实与暂定结论须经实际行动分别确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="怪物有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || monster.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {monster.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前怪物实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次观察接触：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">过度断言记录：{selectedCase.overclaims}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；片段来源、具体条件与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的片段记录、普通核实、结束接触与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="片段、核实与报告边界">
              <h4>片段、核实与报告边界</h4>
              <p>先观察原现场，再按公开选项准备留意偶发征兆或普通核对。片段记录、普通核实与暂定报告是不同的事实；只有实际提交后的公开记录才会显示。准备、执行、结束接触与报告分别提交，成本与限制以公开按钮为准。</p>
              <p className="slice-muted">怪物的高灵性感知偶尔带来零碎预兆，不能点选精确未来，也不保证所见真实或完整。实际观察接触尚未结束时，先执行公开的结束动作，再做其它事务；失败也不代替实际结束。结束只停止本次集中关注，不能关闭所有被动感知，也不保证感官负担消失。结束不另抽随机、不奖励、不退款、不治疗，过度断言不会被抹去。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="片段、普通核实与暂定报告" aria-live="polite" aria-atomic="true">
              <h4>片段、普通核实与暂定报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前怪物实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="怪物成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {monster.story && <p className="slice-muted">{monster.story}</p>}

      {monster.discovered && <section className="slice-notice warrior-source" aria-label="怪物成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {monster.supplies && <p>{monster.supplies}</p>}
      </section>}
      {monster.discovered && monster.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!monster.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {monster.bottles.map((bottle) => {
            const action = monster.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !monster.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !monster.promoted && !monster.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `monster-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`monster-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {monster.discovered && !monster.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{monster.risk}</p></details>}
      {monster.promoted && (
        <section className="warrior-abilities" aria-label="怪物能力与消化">
          <h3>能力与消化 · {monster.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列9拥有高灵性感知，偶尔得到零碎预兆。片段不是确定真相，仍须后来普通核实并保留暂定结论。能力、掌握与边界以已公开记录为准；不提供序列8的身体强化、序列7的幸运或更高序列的运气控制。</p>
          <p>扮演进度 {monster.acting} · 消化：{monster.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {monster.pollution}</p>
          {monster.abilities.map((ability) => (
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
