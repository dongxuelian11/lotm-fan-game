import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { NavigatorAction, NavigatorCommand, NavigatorProjection } from "../domain/navigator/types";
import type { RagerProjection } from "../domain/rager/types";
import type { SailorProjection } from "../domain/sailor/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察", SURVEYED: "已勘察水域", PLANNED: "已有本次计划与准备", RESOLVED: "本次作业已有实际结果",
};
const SAILOR_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察", SURVEYED: "已勘察现场", PREPARED: "已准备绳具与退路", RESOLVED: "作业已结算，人在岸边",
};
const RAGER_STATUS: Record<string, string> = {
  AVAILABLE: "尚未勘察", OBSERVED: "已观察现场", PREPARED: "已确认防护与协作", RESOLVED: "本次作业已有实际结果",
};

function PreviousSequenceRecords({ title, state }: { title: string; state: SailorProjection | RagerProjection }) {
  return <>
    {state.bottles.length > 0 && <details className="seer-fold">
      <summary>{title}原瓶 · 来源与去向</summary>
      {state.bottles.map((bottle) => <article className="navigator-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {state.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的{title}能力</summary>
      {state.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </>;
}

/** Previous-sequence records cannot dispatch commands, including stale projected actions. */
export function NavigatorSailorHistory({ sailor }: { sailor: SailorProjection }) {
  return <section className="seer-panel navigator-panel" aria-label="水手时期的经历">
    <h3>水手时期的经历</h3>
    <p className="slice-notice">你已晋升航海家。这里保留水手时期的观察、原绳具、实际结果与原瓶记录，当前实践请回到航海家卷宗。</p>
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
    <PreviousSequenceRecords title="水手" state={sailor} />
  </section>;
}

export function RagerHistory({ rager }: { rager: RagerProjection }) {
  return <section className="seer-panel navigator-panel" aria-label="暴怒之民时期的经历">
    <h3>暴怒之民时期的经历</h3>
    <p className="slice-notice">你已晋升航海家。这里保留暴怒之民时期的现场、防护与协作、实际结果与原瓶记录，当前实践请回到航海家卷宗。</p>
    <p>暴怒之民扮演进度 {rager.acting} · {rager.digestion}</p>
    {rager.environment && <p className="slice-muted">{rager.environment}</p>}
    {rager.cases.length > 0 && <section aria-label="暴怒之民作业历史">
      {rager.cases.map((entry) => <details className="seer-fold" key={entry.id}>
        <summary>{entry.title} · {RAGER_STATUS[entry.status] ?? entry.status}</summary>
        <p>{entry.story}</p>
        {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}>
          <h4>原现场观察</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
        </section>}
        {entry.preparation && <section aria-label={`${entry.title}的原准备`}><h4>原防护与协作准备</h4><p>{entry.preparation}</p></section>}
        {entry.result && <section aria-label={`${entry.title}的实际结果`}><h4>实际作业结果</h4><p>{entry.result}</p></section>}
      </details>)}
    </section>}
    <PreviousSequenceRecords title="暴怒之民" state={rager} />
  </section>;
}

function isCaseAction(action: NavigatorAction): boolean {
  return "caseId" in action.command;
}

interface NavigatorPanelProps {
  navigator: NavigatorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: NavigatorCommand) => void;
}

/** Only public facts, chosen preparation and committed outcomes are shown. */
export function NavigatorPanel({ navigator, resources, busy, blocked, readOnly = false, onCommand }: NavigatorPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = navigator.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = navigator.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = navigator.actions.filter(isCaseAction);
  const selectedCase = navigator.cases.find((entry) => entry.id === selectedCaseId)
    ?? navigator.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? navigator.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = navigator.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = navigator.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : navigator.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Plans and methods are equally presented choices, never a suggested correct answer.
  const choosingPlan = nextAction?.command.type === "PLAN";
  const nextLabel = choosingPlan ? "对照已知水域与天气，选择本次计划。"
    : nextAction?.command.type === "PERFORM" ? "核对已选计划与实际准备后执行，也可以退出本次准备。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !navigator.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || navigator.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, navigator.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: NavigatorAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || navigator.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: NavigatorAction) {
    return (
      <div className="seer-action navigator-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `navigator-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`navigator-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel navigator-panel seer-confirmation" aria-label="这瓶航海家魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="航海家服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{navigator.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{navigator.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="navigator-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "navigator-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel navigator-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="航海家成长下一步">
        <span className="seer-seal">{navigator.promoted ? "序列 7" : "航海家晋升卷宗"}</span>
        <h3>{navigator.title}</h3>
        {readOnly ? (
          <p className="seer-next">这份航海家卷宗只供回看。</p>
        ) : navigator.promoted && navigator.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的航行与水域作业。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{navigator.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{navigator.digestion}</p>
        {!navigator.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。须完成暴怒之民100消化与八个完整序列8周，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("本阶段具体场景、成品药渠道与数值属于游戏设定（G），完整配方待核。取得渠道或晋升不会自动加入教会。")}</p>
      </section>

      {navigator.promoted && <section className="slice-notice navigator-environment" aria-label="已知水域与天气条件">
        <h4>已知水域与天气条件</h4>
        <p>{navigator.environment || "水源、天气与同行条件尚未确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="航海家航行与水域作业">
          <h3>看清水域，再计划行动</h3>
          <label className="seer-case-selector">
            选择航行与水域作业
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {navigator.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case navigator-case" aria-label="当前航行与水域作业">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">作业状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="navigator-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得本处现场观察，不能确认未提供的事实。</p>}
            </section>
            <section className="navigator-preparation" aria-label="实际计划与准备">
              <h4>实际计划与准备</h4>
              <p>{selectedCase.preparation || "尚无本次计划与准备记录。观察到水域条件，并不等于已完成准备。"}</p>
            </section>
            <section className="slice-notice navigator-boundaries" aria-label="本次水域作业边界">
              <h4>本次水域作业边界</h4>
              <p>只使用现场已确认的水源与航线。先勘察，再选择计划；能力和普通协作都要等结算后才有实际结果。</p>
              <p className="slice-muted">日常实践不积累战斗怒势。航海判断不会凭空改变天气，也不会把小片水域变成海域主场。</p>
            </section>
            {selectedCase.result && <section className="navigator-result" aria-label="实际作业结果">
              <h4>实际作业结果</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="navigator-action-list" role="group" aria-label="当前航行与水域作业行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="navigator-action-list" role="group" aria-label="航海家成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {navigator.story && <p className="slice-muted">{navigator.story}</p>}

      {navigator.discovered && navigator.supplies && <p className="slice-notice">{navigator.supplies}</p>}
      {navigator.discovered && navigator.bottles.length > 0 && (
        <details className="seer-fold navigator-bottles" open={!navigator.promoted}>
          <summary>航海家独立成品原瓶 · 来源与去向</summary>
          {navigator.bottles.map((bottle) => {
            const action = navigator.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !navigator.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !navigator.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `navigator-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`navigator-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {navigator.discovered && !navigator.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{navigator.risk}</p></details>}
      {navigator.promoted && (
        <section className="navigator-abilities" aria-label="航海家能力与消化">
          <h3>能力与消化 · {navigator.abilities.length} 项能力</h3>
          <p className="slice-muted">继承五项水手与暴怒之民能力，新增航海判断、有限水控与水缚。水系攻击不积怒势；实际持棍物理攻击满足条件时仍可释放怒击。</p>
          <p>扮演进度 {navigator.acting} · 消化：{navigator.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {navigator.pollution}</p>
          {navigator.abilities.map((ability) => (
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
