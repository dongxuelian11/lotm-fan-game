import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { UnwingedAction, UnwingedCommand, UnwingedProjection } from "../domain/unwinged/types";
import type { CriminalProjection } from "../domain/criminal/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与当事人边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际执行，请核对冲动与结果",
  RESOLVED: "已提交本次实践报告",
};

/** The inherited S9 history has no mutation callback or actionable controls. */
export function UnwingedCriminalHistory({ criminal }: { criminal: CriminalProjection }) {
  const title = "罪犯时期的经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">你已晋升折翼天使。这里保留罪犯时期的观察、实际方法、原物拿取与归还后果、原报告和原瓶来源，只供回看。</p>
    <p>罪犯扮演进度 {criminal.acting} · 消化：{criminal.digestion}</p>
    {criminal.story && <p>{criminal.story}</p>}
    {criminal.supplies && <p>{criminal.supplies}</p>}
    {criminal.environment && <p>{criminal.environment}</p>}
    {criminal.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">原物去向：{entry.holding} · 曾拿取原物：{entry.tookOriginal ? "是" : "否"} · 实际归还次数：{entry.returns}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {criminal.bottles.length > 0 && <details className="seer-fold" open>
      <summary>罪犯原瓶 · 来源与去向</summary>
      {criminal.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {criminal.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {criminal.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: UnwingedAction): boolean {
  return "caseId" in action.command;
}

interface UnwingedPanelProps {
  unwinged: UnwingedProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: UnwingedCommand) => void;
}

/** Only committed public facts change conscience, open urges, preparation, or reports. */
export function UnwingedPanel({ unwinged, resources, busy, blocked, readOnly = false, onCommand }: UnwingedPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => unwinged.cases[0]?.id ?? null);
  const [changeAccepted, setChangeAccepted] = useState(false);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = unwinged.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = unwinged.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = unwinged.actions.filter(isCaseAction);
  // The projected step-back command identifies the actual open scene; prose cannot create a lock.
  const standDownAction = unwinged.actions.find((action) => action.command.type === "STAND_DOWN");
  const standDownCaseId = standDownAction?.command.type === "STAND_DOWN" ? standDownAction.command.caseId : null;
  const selectedCase = (unwinged.insideCase ? unwinged.cases.find((entry) => entry.id === standDownCaseId) : undefined)
    ?? unwinged.cases.find((entry) => entry.id === selectedCaseId)
    ?? unwinged.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? unwinged.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!unwinged.insideCase || action.command.type === "STAND_DOWN")) : [];
  const actions = unwinged.insideCase ? [] : unwinged.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = unwinged.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "STAND_DOWN" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "STAND_DOWN")
    : unwinged.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : unwinged.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (unwinged.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [unwinged.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !unwinged.promoted && !unwinged.insideCase && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || unwinged.promoted || unwinged.insideCase || readOnly)) {
      setSelectedBottleId(null);
      setChangeAccepted(false);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, unwinged.promoted, unwinged.insideCase, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: UnwingedAction) {
    if (busy || blocked || readOnly || unwinged.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setChangeAccepted(false);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || !changeAccepted || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || unwinged.promoted || unwinged.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    // Only this explicit choice accepts this bottle’s fictional character consequence.
    onCommand({ type: "CONSUME", bottleId: selectedBottle.id, confirmed: true, acceptedChange: true });
  }

  function cancelBottle() {
    if (confirmationLocked) return;
    setChangeAccepted(false);
    setSelectedBottleId(null);
  }

  function actionButton(action: UnwingedAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `unwinged-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`unwinged-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶折翼天使魔药的服用确认" aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (!confirmationLocked) cancelBottle();
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
        <section className="slice-notice seer-risk" aria-label="折翼天使服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{unwinged.risk}</p>
        </section>
        <section className="slice-notice" aria-label="本瓶晋升的角色变化与独立接受">
          <h4>成功晋升后的角色变化</h4>
          <p>{unwinged.changeWarning}</p>
          <label htmlFor="unwinged-change-consent">
            <input id="unwinged-change-consent" type="checkbox" checked={changeAccepted}
              disabled={confirmationLocked} onChange={(event) => setChangeAccepted(event.target.checked)} />
            我已了解并接受这瓶魔药成功晋升后的虚构角色良知变化与恶欲代价
          </label>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{unwinged.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="unwinged-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={cancelBottle}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !changeAccepted || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "unwinged-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">勾选仅针对这一原瓶。确认后才会服用；打开、取消或服药失败不会改变角色良知。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="折翼天使成长下一步">
        <span className="seer-seal">{unwinged.promoted ? "序列 8" : "折翼天使成长卷宗"}</span>
        <h3>{unwinged.title}</h3>
        {unwinged.insideCase ? (
          <p className="seer-next"><strong>先实际松手或退开：</strong>{nextLabel || "查看当前公开克制选项"}{playerText("。克制不消耗行动或灵性，0精神时仍可执行；本作G实际扣除最多5点精神，不会治疗、恢复原有良知、退款或抹去此前结果。")}</p>
        ) : unwinged.promoted && unwinged.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{unwinged.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{unwinged.digestion}</p>
        {!unwinged.promoted && !readOnly && <p className="slice-muted">需先完成罪犯100消化与四个完整序列9周。晋升准备和普通方法的待执行准备期间仍可工作、调查或休养；成功晋升后仍沿深渊途径成长。</p>}
        <p className="slice-muted">{playerText("成年指导者罗安·费里、成品渠道、三项具体实践与克制成本为游戏设定（G）。已核良知丧失与恶欲增强不等于已核所有个体魔类法术；本阶段没有序列6火焰、诅咒、魔甲或危险预知。")}</p>
      </section>

      {unwinged.promoted && <section className="slice-notice warrior-environment" aria-label="现场与冲动记录">
        <h4>现场与冲动记录</h4>
        <p>{unwinged.environment || "尚未取得现场公开记录；当事人、实际冲动与本次结果须经实际观察和行动确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="折翼天使有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || readOnly || unwinged.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {unwinged.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前折翼天使实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">冲动状态：{selectedCase.urgeOpen}</p>
            <p className="slice-muted">实际克制次数：{selectedCase.restraints}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；当事人反应、具体条件与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的行动、实际克制与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="实践范围与恶欲代价">
              <h4>实践范围与恶欲代价</h4>
              <p>{playerText("先观察原现场，再选择已公开的身体方法或普通方法。准备、实际执行、松手或退开、报告分别提交，成本与限制以公开按钮为准；身体实践不等于获得未核的魔类法术。")}</p>
              <p className="slice-muted">冲动真正进入待处理状态后，须由玩家选择实际松手或退开；这不是点开页面、报告或切换场景就完成的克制。0行动、0精神时仍有公开退出选项，成本按当前资源实际扣除；普通方法的待执行准备不会锁住生活。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="实际执行与报告记录" aria-live="polite" aria-atomic="true">
              <h4>实际执行与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前折翼天使实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="折翼天使成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {unwinged.story && <p className="slice-muted">{unwinged.story}</p>}

      {unwinged.discovered && <section className="slice-notice warrior-source" aria-label="折翼天使成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {unwinged.supplies && <p>{unwinged.supplies}</p>}
      </section>}
      {unwinged.discovered && unwinged.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!unwinged.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {unwinged.bottles.map((bottle) => {
            const action = unwinged.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !unwinged.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !unwinged.promoted && !unwinged.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `unwinged-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`unwinged-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {unwinged.discovered && !unwinged.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{unwinged.risk}</p></details>}
      {unwinged.promoted && (
        <section className="warrior-abilities" aria-label="折翼天使能力与消化">
          <h3>能力与消化 · {unwinged.abilities.length} 项训练记录</h3>
          <p className="slice-muted">{playerText("成功晋升后角色失去原有良知，恶欲增强；玩家仍选择具体行为。公开能力与掌握只代表本阶段已实现范围，不代表所有折翼天使的个体魔类法术已核实。克制训练仍有精神成本，不恢复良知，也不保证更高序列可以无痛善良消化。")}</p>
          <p>角色良知状态：{unwinged.conscienceLost ? "已失去原有良知" : "尚未发生晋升改变"}</p>
          <p>扮演进度 {unwinged.acting} · 消化：{unwinged.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {unwinged.pollution}</p>
          {unwinged.abilities.map((ability) => (
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
