import { useEffect, useRef, useState } from "react";
import type { SailorAction, SailorCommand, SailorProjection } from "../domain/sailor/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察",
  SURVEYED: "已勘察现场",
  PREPARED: "已准备绳具与退路",
  RESOLVED: "作业已结算，人在岸边",
};

function isCaseAction(action: SailorAction): boolean {
  return "caseId" in action.command;
}

interface SailorPanelProps {
  sailor: SailorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: SailorCommand) => void;
}

/** Site, equipment ownership and outcomes are displayed only after authoritative projection. */
export function SailorPanel({ sailor, resources, busy, blocked, readOnly = false, onCommand }: SailorPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = sailor.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = sailor.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = sailor.actions.filter(isCaseAction);
  const selectedCase = sailor.cases.find((entry) => entry.id === selectedCaseId)
    ?? sailor.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? sailor.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = sailor.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = sailor.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : sailor.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Both methods stay a real choice; no implied recommendation to enter the water.
  const nextLabel = nextAction?.command.type === "PERFORM" ? "对照现场与绳具记录，选择本次作业方法，也可以撤回岸边。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !sailor.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || sailor.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, sailor.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SailorAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || sailor.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: SailorAction) {
    return (
      <div className="seer-action sailor-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `sailor-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`sailor-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel sailor-panel seer-confirmation" aria-label="这瓶水手魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="水手服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{sailor.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{sailor.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="sailor-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "sailor-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel sailor-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="水手成长下一步">
        <span className="seer-seal">{sailor.promoted ? "序列 9" : "水手成长卷宗"}</span>
        <h3>{sailor.title}</h3>
        {readOnly ? (
          <p className="seer-next">已选择其它途径，这份水手渠道只供回看。</p>
        ) : sailor.promoted && sailor.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的水边作业。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{sailor.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{sailor.digestion}</p>
        {!sailor.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">取得渠道或晋升不会自动加入教会。作业必须使用现场真实存在的水域、绳具和协作者。</p>
      </section>

      {sailor.promoted && <section className="slice-notice sailor-environment" aria-label="已知水域与岸边环境">
        <h4>已知水域与岸边环境</h4>
        <p>{sailor.environment || "水域、作业条件与岸边退路尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="水手水边作业">
          <h3>勘察、准备与有限作业</h3>
          <label className="seer-case-selector">
            选择水边作业
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {sailor.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case sailor-case" aria-label="当前水边作业">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">作业状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="sailor-observations" aria-label="实际勘察记录">
              <h4>实际勘察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未勘察本处水域，水情与退路不能凭空确认。</p>}
            </section>
            <section className="sailor-equipment" aria-label="原绳具与物件归属">
              <h4>原绳具与物件归属</h4>
              {selectedCase.equipment.length > 0
                ? <ul>{selectedCase.equipment.map((equipment, index) => <li key={`${selectedCase.id}-equipment-${index}`}>{equipment}</li>)}</ul>
                : <p className="slice-muted">尚无已确认的绳具准备记录；现场物件不会自动归入你的背包。</p>}
            </section>
            <section className="slice-notice sailor-shore" aria-label="岸边退路与作业边界">
              <h4>岸边退路与作业边界</h4>
              <p>每次作业都是包含返回岸边的完整行动，成功或失败都在岸边结算；没有跨行动的水中停留或呼吸倒计时。准备后仍可选择撤回岸边，实际成本见按钮。</p>
              <p className="slice-muted">水手能力与普通协作是不同方法。能力不能代替本次准备，也不会把他人的绳具、货物或救援对象变成你的物品。</p>
            </section>
            {selectedCase.result && <section className="sailor-result" aria-label="实际作业结果">
              <h4>实际作业结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="sailor-action-list" role="group" aria-label="当前水边作业行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="sailor-action-list" role="group" aria-label="水手成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {sailor.story && <p className="slice-muted">{sailor.story}</p>}

      {sailor.discovered && sailor.supplies && <p className="slice-notice">{sailor.supplies}</p>}
      {sailor.discovered && sailor.bottles.length > 0 && (
        <details className="seer-fold sailor-bottles" open={!sailor.promoted}>
          <summary>导师的独立成品原瓶 · 来源与去向</summary>
          {sailor.bottles.map((bottle) => {
            const action = sailor.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !sailor.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !sailor.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `sailor-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`sailor-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {sailor.discovered && !sailor.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{sailor.risk}</p></details>}
      {sailor.promoted && (
        <section className="sailor-abilities" aria-label="水手能力与消化">
          <h3>能力与消化 · {sailor.abilities.length} 项能力</h3>
          <p className="slice-muted">序列9的强壮、平衡、湿滑幻鳞与水中灵活性各有适用条件。小说中的水下至少十分钟能力是虚构设定，不是现实潜水建议；不代表无限呼吸、深水免伤或无条件脱困。暴怒与水系法术属于后续序列，本阶段不提供。</p>
          <p>扮演进度 {sailor.acting} · 消化：{sailor.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {sailor.pollution}</p>
          {sailor.abilities.map((ability) => (
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
