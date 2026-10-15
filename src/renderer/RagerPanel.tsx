import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { RagerAction, RagerCommand, RagerProjection } from "../domain/rager/types";
import type { SailorProjection } from "../domain/sailor/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察",
  OBSERVED: "已观察现场",
  PREPARED: "已确认防护与协作",
  RESOLVED: "本次作业已有实际结果",
};

const SAILOR_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察", SURVEYED: "已勘察现场", PREPARED: "已准备绳具与退路", RESOLVED: "作业已结算，人在岸边",
};

/** Previous-sequence history has no callback or action controls. */
export function SailorHistory({ sailor }: { sailor: SailorProjection }) {
  return (
    <section className="seer-panel rager-panel" aria-label="水手时期的经历">
      <h3>水手时期的经历</h3>
      <p className="slice-notice">你已晋升暴怒之民。水手时期的现场、绳具、实际结果与原瓶记录保留在这里，当前实践请回到暴怒之民卷宗。</p>
      <p>水手扮演进度 {sailor.acting} · {sailor.digestion}</p>
      {sailor.environment && <p className="slice-muted">{sailor.environment}</p>}
      {sailor.cases.length > 0 && <section aria-label="水手作业历史">
        {sailor.cases.map((entry) => <details className="seer-fold" key={entry.id}>
          <summary>{entry.title} · {SAILOR_STATUS[entry.status] ?? entry.status}</summary>
          <p>{entry.story}</p>
          {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}>
            <h4>原现场观察</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
          </section>}
          {entry.equipment.length > 0 && <section aria-label={`${entry.title}的原绳具记录`}>
            <h4>原绳具与物件归属</h4><ul>{entry.equipment.map((equipment, index) => <li key={index}>{equipment}</li>)}</ul>
          </section>}
          {entry.result && <section aria-label={`${entry.title}的实际结果`}><h4>实际作业结果</h4><p>{entry.result}</p></section>}
        </details>)}
      </section>}
      {sailor.bottles.length > 0 && <details className="seer-fold">
        <summary>水手原瓶 · 来源与去向</summary>
        {sailor.bottles.map((bottle) => <article className="rager-history-bottle" key={bottle.id}>
          <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
        </article>)}
      </details>}
      {sailor.abilities.length > 0 && <details className="seer-fold">
        <summary>已继承的水手能力</summary>
        {sailor.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      </details>}
    </section>
  );
}

function isCaseAction(action: RagerAction): boolean {
  return "caseId" in action.command;
}

interface RagerPanelProps {
  rager: RagerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: RagerCommand) => void;
}

/** Facts, preparation and committed outcomes stay separate; projected methods are equal choices. */
export function RagerPanel({ rager, resources, busy, blocked, readOnly = false, onCommand }: RagerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = rager.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = rager.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = rager.actions.filter(isCaseAction);
  const selectedCase = rager.cases.find((entry) => entry.id === selectedCaseId)
    ?? rager.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? rager.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = rager.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = rager.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : rager.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Supervised strength and ordinary teamwork remain equally presented choices.
  const nextLabel = nextAction?.command.type === "PERFORM" ? "对照现场事实与实际准备，选择受控发力或普通协作，也可以退出本次准备。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !rager.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || rager.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, rager.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: RagerAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || rager.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: RagerAction) {
    return (
      <div className="seer-action rager-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `rager-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`rager-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel rager-panel seer-confirmation" aria-label="这瓶暴怒之民魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="暴怒之民服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{rager.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{rager.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="rager-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "rager-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel rager-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="暴怒之民成长下一步">
        <span className="seer-seal">{rager.promoted ? "序列 8" : "暴怒之民晋升卷宗"}</span>
        <h3>{rager.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份暴怒之民卷宗只供回看。</p>
        ) : rager.promoted && rager.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的受监督作业。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{rager.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{rager.digestion}</p>
        {!rager.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。须完成水手100消化与四个完整序列9周，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("本阶段具体场景、成品药渠道与数值属于游戏设定（G），完整配方待核。取得渠道或晋升不会自动加入教会。")}</p>
      </section>

      {rager.promoted && <section className="slice-notice rager-environment" aria-label="已知现场与监督条件">
        <h4>已知现场与监督条件</h4>
        <p>{rager.environment || "作业对象、防护条件与在场协作者尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="暴怒之民受监督作业">
          <h3>现场事实、实际准备与有限作业</h3>
          <label className="seer-case-selector">
            选择受监督作业
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {rager.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case rager-case" aria-label="当前受监督作业">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">作业状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="rager-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得本处现场观察，不能确认未提供的事实。</p>}
            </section>
            <section className="rager-preparation" aria-label="实际防护与协作准备">
              <h4>实际防护与协作准备</h4>
              <p>{selectedCase.preparation || "尚无本次准备记录。观察到条件并不等于已布置防护或安排协作者。"}</p>
            </section>
            <section className="slice-notice rager-boundaries" aria-label="本次作业目标与边界">
              <h4>本次作业目标与边界</h4>
              <p>只处理本处已有的机械、货物或人群退路。受控发力和普通协作都需要真实准备与在场监督；退出准备不消耗行动，实际结果须等作业结算后确认。</p>
              <p className="slice-muted">消化不要求主动伤人、酗酒或故意失控。这里的日常实践不会积累战斗怒势，也不会自动获得航海家水系法术。</p>
            </section>
            {selectedCase.result && <section className="rager-result" aria-label="实际作业结果">
              <h4>实际作业结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="rager-action-list" role="group" aria-label="当前受监督作业行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="rager-action-list" role="group" aria-label="暴怒之民成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {rager.story && <p className="slice-muted">{rager.story}</p>}

      {rager.discovered && rager.supplies && <p className="slice-notice">{rager.supplies}</p>}
      {rager.discovered && rager.bottles.length > 0 && (
        <details className="seer-fold rager-bottles" open={!rager.promoted}>
          <summary>暴怒之民独立成品原瓶 · 来源与去向</summary>
          {rager.bottles.map((bottle) => {
            const action = rager.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !rager.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !rager.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `rager-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`rager-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {rager.discovered && !rager.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{rager.risk}</p></details>}
      {rager.promoted && (
        <section className="rager-abilities" aria-label="暴怒之民能力与消化">
          <h3>能力与消化 · {rager.abilities.length} 项能力</h3>
          <p className="slice-muted">继承三项水手能力，加上本阶段两项能力；全部能力只按公开条件生效。三层怒势来自敌对物理交换，战后清空；2层怒击×1.25，3层×1.40，释放策略在战斗回合前选择。日常作业不积层，航海家水系法术尚未获得。</p>
          <p>扮演进度 {rager.acting} · 消化：{rager.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {rager.pollution}</p>
          {rager.abilities.map((ability) => (
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
