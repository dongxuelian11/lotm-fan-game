import { useEffect, useRef, useState } from "react";
import type { BardAction, BardCommand, BardProjection } from "../domain/bard/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察当事人与声场",
  AGREED: "已确认本次方式与边界",
  RESOLVED: "本次协助已有实际结果",
};

function isCaseAction(action: BardAction): boolean {
  return "caseId" in action.command;
}

interface BardPanelProps {
  bard: BardProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: BardCommand) => void;
}

/** Consent, observations and outcomes are displayed only from the authoritative public projection. */
export function BardPanel({ bard, resources, busy, blocked, readOnly = false, onCommand }: BardPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = bard.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = bard.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = bard.actions.filter(isCaseAction);
  const selectedCase = bard.cases.find((entry) => entry.id === selectedCaseId)
    ?? bard.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? bard.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = bard.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = bard.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : bard.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // The participant’s choice governs the mode; neither song nor consent is inferred here.
  const nextLabel = nextAction?.command.type === "AGREE"
    ? "根据当事人的意愿确认本次协助方式；可以选择普通交谈。"
    : nextAction?.command.type === "PERFORM"
      ? "对照已确认的方式与边界，进行本次有限协助，也可以退出。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !bard.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || bard.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, bard.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: BardAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || bard.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: BardAction) {
    return (
      <div className="seer-action bard-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `bard-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`bard-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel bard-panel seer-confirmation" aria-label="这瓶歌颂者魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="歌颂者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{bard.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{bard.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="bard-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "bard-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel bard-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="歌颂者成长下一步">
        <span className="seer-seal">{bard.promoted ? "序列 9" : "歌颂者成长卷宗"}</span>
        <h3>{bard.title}</h3>
        {readOnly ? (
          <p className="seer-next">已选择其它途径，这份歌颂者渠道只供回看。</p>
        ) : bard.promoted && bard.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的自愿协助。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{bard.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{bard.digestion}</p>
        {!bard.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">取得渠道或晋升不会自动加入教会，也不要求接受某种信仰。歌声协助需先确认当事人本次意愿；普通交谈同样可以推进实践。</p>
      </section>

      {bard.promoted && <section className="slice-notice bard-environment" aria-label="已知音乐室与共同声场">
        <h4>已知音乐室与共同声场</h4>
        <p>{bard.environment || "当事人、共同声场与本次意愿尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="歌颂者自愿协助">
          <h3>观察、约定与有限鼓舞</h3>
          <label className="seer-case-selector">
            选择自愿协助
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {bard.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case bard-case" aria-label="当前自愿协助">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">协助状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="bard-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未当面观察；不能推断当事人的意愿、情绪或共同声场。</p>}
            </section>
            <section className="bard-preparation" aria-label="本次约定与声场准备">
              <h4>本次约定与声场准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "尚未确认本次协助方式；观察不等于同意接受歌声。"}</p>
            </section>
            <section className="slice-notice bard-boundaries" aria-label="自愿参与与能力边界">
              <h4>自愿参与与能力边界</h4>
              <p>先观察，再约定歌声或普通交谈。拒绝歌声不妨碍普通交谈；确认方式后仍可退出，实际成本见按钮。</p>
              <p className="slice-muted">共同声场中的歌声只能有限鼓舞自己与同伴的勇气、力量；不读取隐私、不保证成功，也不能使听众绝对服从。这里不提供圣光攻击或治疗。</p>
            </section>
            {selectedCase.result && <section className="bard-result" aria-label="实际协助结果">
              <h4>实际协助结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="bard-action-list" role="group" aria-label="当前自愿协助行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="bard-action-list" role="group" aria-label="歌颂者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {bard.story && <p className="slice-muted">{bard.story}</p>}

      {bard.discovered && <section className="slice-notice bard-source" aria-label="歌颂者成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>当前渠道只提供有独立来源记录的成品原瓶，不提供完整配方，也不展示未掌握的原料或调配方法；渠道条件、场景与数值以当前公开记录为准。</p>
        {bard.supplies && <p>{bard.supplies}</p>}
      </section>}
      {bard.discovered && bard.bottles.length > 0 && (
        <details className="seer-fold bard-bottles" open={!bard.promoted}>
          <summary>导师的独立成品原瓶 · 来源与去向</summary>
          {bard.bottles.map((bottle) => {
            const action = bard.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !bard.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !bard.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `bard-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`bard-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {bard.discovered && !bard.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{bard.risk}</p></details>}
      {bard.promoted && (
        <section className="bard-abilities" aria-label="歌颂者能力与消化">
          <h3>能力与消化 · {bard.abilities.length} 项能力</h3>
          <p className="slice-muted">序列9以歌声有限鼓舞自己与同伴的勇气、力量，效果受真实情境与共同声场限制。不会凭空产生圣光、治疗伤病或让听众绝对服从。</p>
          <p>扮演进度 {bard.acting} · 消化：{bard.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {bard.pollution}</p>
          {bard.abilities.map((ability) => (
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
