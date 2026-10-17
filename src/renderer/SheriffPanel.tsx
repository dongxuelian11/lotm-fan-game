import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SheriffAction, SheriffCommand, SheriffProjection } from "../domain/sheriff/types";
import type { ArbiterProjection } from "../domain/arbiter/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察现场与有限条件",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际尝试，请核对当前特征与有限结果",
  RESOLVED: "已提交本次实践报告",
};

/** The inherited S9 history has no mutation callback or actionable controls. */
export function SheriffArbiterHistory({ arbiter }: { arbiter: ArbiterProjection }) {
  const title = "仲裁人时期的经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">你已晋升治安官。这里保留仲裁人时期的原调解、当事人的选择、实际结束、原报告与原瓶来源，只供回看。</p>
    <p>仲裁人扮演进度 {arbiter.acting} · 消化：{arbiter.digestion}</p>
    {arbiter.story && <p>{arbiter.story}</p>}
    {arbiter.supplies && <p>{arbiter.supplies}</p>}
    {arbiter.environment && <p>{arbiter.environment}</p>}
    {arbiter.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次调解接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {arbiter.bottles.length > 0 && <details className="seer-fold" open>
      <summary>仲裁人原瓶 · 来源与去向</summary>
      {arbiter.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {arbiter.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {arbiter.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: SheriffAction): boolean {
  return "caseId" in action.command;
}

interface SheriffPanelProps {
  sheriff: SheriffProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: SheriffCommand) => void;
}

/** Only committed public facts change current observations, bounded sensing, image reconstruction, or reports. */
export function SheriffPanel({ sheriff, resources, busy, blocked, onCommand }: SheriffPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => sheriff.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = sheriff.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = sheriff.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = sheriff.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open practice; prose and old results never create a lock.
  const closeAction = sheriff.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? sheriff.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (sheriff.insideCase ? sheriff.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? sheriff.cases.find((entry) => entry.id === selectedCaseId)
    ?? sheriff.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? sheriff.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!sheriff.insideCase || action.command.type === "CLOSE")) : [];
  const actions = sheriff.insideCase ? [] : sheriff.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = sheriff.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : sheriff.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : sheriff.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (sheriff.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [sheriff.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !sheriff.promoted && !sheriff.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || sheriff.promoted || sheriff.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, sheriff.promoted, sheriff.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: SheriffAction) {
    if (busy || blocked || sheriff.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || sheriff.promoted || sheriff.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: SheriffAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => { if (!busy && !blocked && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `sheriff-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`sheriff-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶治安官魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="治安官服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{sheriff.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{sheriff.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="sheriff-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "sheriff-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="治安官成长下一步">
        <span className="seer-seal">{sheriff.promoted ? "序列 8" : "治安官成长卷宗"}</span>
        <h3>{sheriff.title}</h3>
        {sheriff.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次实践：</strong>{nextLabel || "查看当前公开结束选项"}。结束不消耗行动或灵性，0精神时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原观察、感应、图像重构与报告继续保留。</p>
        ) : sheriff.promoted && sheriff.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{sheriff.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{sheriff.digestion}</p>
        {!sheriff.promoted && <p className="slice-muted">需先完成仲裁人100消化与四个完整序列9周。晋升准备和待执行准备期间仍可工作、调查或休养；成功晋升后仍沿审判者途径成长。</p>}
        <p className="slice-muted">{playerText("成年民间调解文书员薇娜·贝尔仍沿原渠道提供指导；你没有获任政府职务，取得成品或晋升不会自动加入组织。独立进阶成品、三项具体实践与数值为本作原创G。观察当前事实、遵守感应范围并实际核实，是本阶段G扮演解释；记得过去特征不能代替确认眼前变化。")}</p>
      </section>

      {sheriff.promoted && <section className="slice-notice warrior-environment" aria-label="现场与当前实践">
        <h4>现场与当前实践</h4>
        <p>{sheriff.environment || "尚未取得现场公开记录；当前可见特征、附近未屏蔽痕迹与已有图像的重构须经实际行动分别确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="治安官有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || sheriff.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {sheriff.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前治安官实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次实践：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；当前特征、屏蔽情况、原路线与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的观察、感应、图像重构、实际结束与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="当前特征、有限感应与图像重构边界">
              <h4>当前特征、有限感应与图像重构边界</h4>
              <p>先观察眼前的特征、原箱与原路线，再选择公开的能力方法或普通方法。图像重构依据已见过的形象与已知路线；旧记忆不能证明当前未变，也不能凭空识别陌生人。感应限于附近、未屏蔽的相关痕迹，屏蔽容器须用实际普通方法核实。准备、执行、实际结束与报告分别提交，能力执行消耗2灵性，成本与限制以公开按钮为准。</p>
              <p className="slice-muted">本阶段不提供全域判罪、远程库存查询或任意陌生人身份识别，不能仅凭感应宣告有罪。本次实践尚未结束时，先实际停止感应、归还原物或沿原路返回，再做其它事务；失败也须实际结束。结束不另抽随机、不奖励、不退款、不治疗，原结果与报告继续保留。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="当前观察、有限感应与核实报告" aria-live="polite" aria-atomic="true">
              <h4>当前观察、有限感应与核实报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前治安官实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="治安官成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {sheriff.story && <p className="slice-muted">{sheriff.story}</p>}

      {sheriff.discovered && <section className="slice-notice warrior-source" aria-label="治安官成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。原文已知的主材料对照不等于完整制造配方；辅料、完整用量与投料顺序仍未知。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供材料采购或调配。来源、费用、三次劳动与后续补给条件以以下公开记录为准。")}</p>
        {sheriff.supplies && <p>{sheriff.supplies}</p>}
      </section>}
      {sheriff.discovered && sheriff.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!sheriff.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {sheriff.bottles.map((bottle) => {
            const action = sheriff.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !sheriff.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !sheriff.promoted && !sheriff.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `sheriff-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`sheriff-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {sheriff.discovered && !sheriff.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{sheriff.risk}</p></details>}
      {sheriff.promoted && (
        <section className="warrior-abilities" aria-label="治安官能力与消化">
          <h3>能力与消化 · {sheriff.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列8继承仲裁人的威严、令人信服的魅力与格斗训练，新增有限痕迹感应与图像重构，共五项当前能力。掌握与边界以已公开记录为准；附近且未屏蔽的感应不能代替普通核实，已知图像与路线不能凭空补全未知。没有全域判罪、远程库存查询或陌生人身份识别，不提供序列7精神刺穿或序列6神秘禁令；当事人仍自主决定。</p>
          <p>扮演进度 {sheriff.acting} · 消化：{sheriff.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {sheriff.pollution}</p>
          {sheriff.abilities.map((ability) => (
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
