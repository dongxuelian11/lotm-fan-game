import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { AssassinAction, AssassinCommand, AssassinProjection } from "../domain/assassin/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与能力边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际检验，请核对结果与当前位置",
  RESOLVED: "已提交本次实践报告",
};

function DraftRecord({ draft }: { draft: AssassinProjection["draft"] }) {
  if (!draft) return null;
  return <section className="seer-fold warrior-tool" aria-label="练习原稿的归属与持有">
    <h4>练习原稿 · 当前公开记录</h4>
    <dl className="seer-facts">
      <div><dt>原物编号</dt><dd>{draft.id}</dd></div>
      <div><dt>原主人</dt><dd>{draft.owner}</dd></div>
      <div><dt>当前持有／保管</dt><dd>{draft.custodian}</dd></div>
      <div><dt>已知位置</dt><dd>{draft.location}</dd></div>
      <div><dt>原物记录版本</dt><dd>{draft.version}</dd></div>
    </dl>
    <p className="slice-muted">原稿属于原主人；拾取和携带只改变实际保管与位置。这是只读原物记录，不会加入自有装备，也不会自动交还。</p>
  </section>;
}

/** Other-pathway history has no mutation callback or actionable controls. */
export function AssassinHistory({ assassin }: { assassin: AssassinProjection }) {
  const title = "刺客渠道经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">已选择其它途径，这份刺客渠道只供回看。</p>
    {assassin.story && <p>{assassin.story}</p>}
    {assassin.supplies && <p>{assassin.supplies}</p>}
    {assassin.environment && <p>{assassin.environment}</p>}
    <DraftRecord draft={assassin.draft} />
    {assassin.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">记录位置：{entry.position}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {assassin.bottles.length > 0 && <details className="seer-fold" open>
      <summary>刺客原瓶 · 来源与去向</summary>
      {assassin.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {assassin.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {assassin.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: AssassinAction): boolean {
  return "caseId" in action.command;
}

interface AssassinPanelProps {
  assassin: AssassinProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: AssassinCommand) => void;
}

/** Only committed public facts can change ownership, custody, preparation or reports. */
export function AssassinPanel({ assassin, resources, busy, blocked, readOnly = false, onCommand }: AssassinPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => assassin.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = assassin.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = assassin.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = assassin.actions.filter(isCaseAction);
  // An in-progress trip is selected from the public RETURN intent, never inferred from prose.
  const returnAction = assassin.actions.find((action) => action.command.type === "RETURN");
  const returnCaseId = returnAction?.command.type === "RETURN" ? returnAction.command.caseId : "upper-draft";
  const selectedCase = (assassin.insideCase ? assassin.cases.find((entry) => entry.id === returnCaseId) : undefined)
    ?? assassin.cases.find((entry) => entry.id === selectedCaseId)
    ?? assassin.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? assassin.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = assassin.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = assassin.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "RETURN" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "RETURN")
    : assassin.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : assassin.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (assassin.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [assassin.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !assassin.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || assassin.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, assassin.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: AssassinAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || assassin.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: AssassinAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `assassin-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`assassin-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <AssassinHistory assassin={assassin} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶刺客魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="刺客服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{assassin.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{assassin.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="assassin-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "assassin-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="刺客成长下一步">
        <span className="seer-seal">{assassin.promoted ? "序列 9" : "刺客成长卷宗"}</span>
        <h3>{assassin.title}</h3>
        {assassin.insideCase ? (
          <p className="seer-next"><strong>先实际返回：</strong>{nextLabel || "查看当前公开返回选项"}。本次上楼的行动已支付，普通楼梯可在0行动、0灵性时返回。</p>
        ) : assassin.promoted && assassin.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{assassin.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{assassin.digestion}</p>
        {!assassin.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">取得渠道或晋升不会自动加入任何家族或组织。原稿归属与当前保管分别记录，携带不会自动加入自有装备。</p>
      </section>

      {assassin.promoted && <section className="slice-notice warrior-environment" aria-label="现场、位置与原稿去向">
        <h4>现场、位置与原稿去向</h4>
        <p>{assassin.environment || "尚未取得现场公开记录；现场条件、原稿去向与本次结果须经实际观察和行动确认。"}</p>
      </section>}

      <DraftRecord draft={assassin.draft} />

      {selectedCase && (
        <section aria-label="刺客有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || assassin.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {assassin.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前刺客实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">当前位置：{selectedCase.position}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；现场条件、原稿记录与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的检验、返回与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="实践范围与实际返回">
              <h4>实践范围与实际返回</h4>
              <p>先观察原现场，再选择能力或普通方法。准备、实际检验、原路返回与报告分别提交，成本与限制见按钮。</p>
              <p className="slice-muted">轻盈身法仅能短距离跃移，不能飞行；借影藏身仍可能被发现，瞬间爆发也不保证击杀。上层平台取稿后，你仍在那里；必须实际返回，取消准备或报告都不会把你送回外侧。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="实际执行与报告记录" aria-live="polite" aria-atomic="true">
              <h4>实际执行与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前刺客实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="刺客成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {assassin.story && <p className="slice-muted">{assassin.story}</p>}

      {assassin.discovered && <section className="slice-notice warrior-source" aria-label="刺客成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用公开渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {assassin.supplies && <p>{assassin.supplies}</p>}
      </section>}
      {assassin.discovered && assassin.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!assassin.promoted}>
          <summary>诺艾拉·温瑟的独立成品原瓶 · 来源与去向</summary>
          {assassin.bottles.map((bottle) => {
            const action = assassin.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !assassin.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !assassin.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `assassin-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`assassin-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {assassin.discovered && !assassin.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{assassin.risk}</p></details>}
      {assassin.promoted && (
        <section className="warrior-abilities" aria-label="刺客能力与消化">
          <h3>能力与消化 · {assassin.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列9练习暗中视物、轻盈身法、借影藏身与有限爆发。性别变化和黑魔法属于后续女巫阶段，本阶段不会获得。能力、掌握与边界以已公开记录为准。</p>
          <p>扮演进度 {assassin.acting} · 消化：{assassin.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {assassin.pollution}</p>
          {assassin.abilities.map((ability) => (
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
