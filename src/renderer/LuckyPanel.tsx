import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { LuckyAction, LuckyCommand, LuckyProjection } from "../domain/lucky/types";
import type { MachineProjection } from "../domain/machine/types";
import type { MonsterProjection } from "../domain/monster/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与现实条件",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际执行，请核对本次结果",
  RESOLVED: "已提交本次实践报告",
};

/** Earlier originals and reports stay read-only after promotion. */
export function LuckyMonsterHistory({ monster }: { monster: MonsterProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="怪物时期的经历">
    <h3>怪物时期的经历</h3>
    <p className="slice-notice">你已晋升幸运者。这里保留怪物时期的片段、普通核实、实际结束、原报告与原瓶来源，只供回看。</p>
    <p>怪物扮演进度 {monster.acting} · 消化：{monster.digestion}</p>
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

export function LuckyMachineHistory({ machine }: { machine: MachineProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="机器时期的经历">
    <h3>机器时期的经历</h3>
    <p className="slice-notice">你已晋升幸运者。这里保留机器时期的已知输入、计算估计、实际测量、有限问题、实际结束、原报告与原瓶来源，只供回看。</p>
    <p>机器扮演进度 {machine.acting} · 消化：{machine.digestion}</p>
    {machine.story && <p>{machine.story}</p>}
    {machine.supplies && <p>{machine.supplies}</p>}
    {machine.environment && <p>{machine.environment}</p>}
    {machine.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次实践：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {machine.bottles.length > 0 && <details className="seer-fold" open>
      <summary>机器原瓶 · 来源与去向</summary>
      {machine.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {machine.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {machine.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: LuckyAction): boolean {
  return "caseId" in action.command;
}

interface LuckyPanelProps {
  lucky: LuckyProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: LuckyCommand) => void;
}

/** Only committed public facts change practice, preparation, passive luck outcomes, or reports. */
export function LuckyPanel({ lucky, resources, busy, blocked, onCommand }: LuckyPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => lucky.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = lucky.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = lucky.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = lucky.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open practice; prose and old results never create a lock.
  const closeAction = lucky.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? lucky.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (lucky.insideCase ? lucky.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? lucky.cases.find((entry) => entry.id === selectedCaseId)
    ?? lucky.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? lucky.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!lucky.insideCase || action.command.type === "CLOSE")) : [];
  const actions = lucky.insideCase ? [] : lucky.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = lucky.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : lucky.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : lucky.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (lucky.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [lucky.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !lucky.promoted && !lucky.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || lucky.promoted || lucky.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, lucky.promoted, lucky.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: LuckyAction) {
    if (busy || blocked || lucky.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || lucky.promoted || lucky.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: LuckyAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => { if (!busy && !blocked && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `lucky-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`lucky-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶幸运者魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="幸运者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{lucky.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{lucky.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="lucky-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "lucky-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="幸运者成长下一步">
        <span className="seer-seal">{lucky.promoted ? "序列 7" : "幸运者成长卷宗"}</span>
        <h3>{lucky.title}</h3>
        {lucky.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次实践：</strong>{nextLabel || "查看当前公开结束选项"}。结束不消耗行动或灵性，0精神时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原回执的归属、实际结果与报告继续保留。</p>
        ) : lucky.promoted && lucky.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{lucky.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{lucky.digestion}</p>
        {!lucky.promoted && <p className="slice-muted">需先完成机器100消化与八个完整序列8周。晋升准备和待执行准备期间仍可工作、调查或休养；成功晋升后仍沿命运之轮途径成长。</p>}
        <p className="slice-muted">{playerText("取得渠道或晋升不会自动加入组织。成年指导者艾妲·芬恩、成品供给、三项具体实践、数值与扮演解释均为本作原创G。幸运是被动、不可控且有波动的，可能完全没有帮上忙；认真准备与普通核实仍有意义。")}</p>
      </section>

      {lucky.promoted && <section className="slice-notice warrior-environment" aria-label="现场与当前实践">
        <h4>现场与当前实践</h4>
        <p>{lucky.environment || "尚未取得现场公开记录；原班车、原回执与封闭路线须经实际观察核实。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="幸运者有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || lucky.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {lucky.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前幸运者实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次实践：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            {selectedCase.luck && <p className="slice-notice" aria-label="本次被动幸运记录">{selectedCase.luck}</p>}
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；原物归属、可行路线、他人的意愿与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的准备、实际结果、实际结束与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="准备、偶然帮助与现实边界">
              <h4>准备、偶然帮助与现实边界</h4>
              <p>先观察原现场，再选择认真准备或普通方法。两者都不是主动发动幸运；只有实际提交后的公开记录才会显示本次是否得到偶然帮助。准备、执行、实际结束与报告分别提交，成本与限制以公开按钮为准。</p>
              <p className="slice-muted">幸运不保证成功，不会让封闭路线凭空消失，也不能改写他人的拒绝。原回执始终属于原主人，实际结束时须交还，偶然找到不等于取得所有权；不存在每次好运都必须偿还等量厄运的规则。失败也须实际结束，不另抽随机、不奖励、不退款、不治疗，原结果与报告继续保留。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="本次实际结果与有限报告" aria-live="polite" aria-atomic="true">
              <h4>本次实际结果与有限报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前幸运者实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="幸运者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {lucky.story && <p className="slice-muted">{lucky.story}</p>}

      {lucky.discovered && <section className="slice-notice warrior-source" aria-label="幸运者成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {lucky.supplies && <p>{lucky.supplies}</p>}
      </section>}
      {lucky.discovered && lucky.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!lucky.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {lucky.bottles.map((bottle) => {
            const action = lucky.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !lucky.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !lucky.promoted && !lucky.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `lucky-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`lucky-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {lucky.discovered && !lucky.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{lucky.risk}</p></details>}
      {lucky.promoted && (
        <section className="warrior-abilities" aria-label="幸运者能力与消化">
          <h3>能力与消化 · {lucky.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列7受到被动幸运眷顾，但幸运不可控制、会波动，也可能没有帮助。不能指定好运时刻、储存或分配幸运、主动重掷，也没有保证成功或固定等量厄运债；能力、掌握与边界以已公开记录为准。</p>
          <p>扮演进度 {lucky.acting} · 消化：{lucky.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {lucky.pollution}</p>
          {lucky.abilities.map((ability) => (
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
