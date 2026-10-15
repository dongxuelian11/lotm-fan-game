import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { CorpsecollectorAction, CorpsecollectorCommand, CorpsecollectorProjection } from "../domain/corpsecollector/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原记录与现场",
  PREPARED: "已选定核验方式并完成准备",
  EXAMINED: "已核验，尚待报告",
  RESOLVED: "本次有限报告已交接",
};

function isCaseAction(action: CorpsecollectorAction): boolean {
  return "caseId" in action.command;
}

interface CorpsecollectorPanelProps {
  corpsecollector: CorpsecollectorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: CorpsecollectorCommand) => void;
}

/** Original records, limited findings and reports come only from the public projection. */
export function CorpsecollectorPanel({ corpsecollector, resources, busy, blocked, readOnly = false, onCommand }: CorpsecollectorPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = corpsecollector.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = corpsecollector.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = corpsecollector.actions.filter(isCaseAction);
  const selectedCase = corpsecollector.cases.find((entry) => entry.id === selectedCaseId)
    ?? corpsecollector.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? corpsecollector.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = corpsecollector.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = corpsecollector.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : corpsecollector.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  // Neither observations nor a chosen method imply a completed examination or a true conclusion.
  const nextLabel = nextAction?.command.type === "PREPARE"
    ? "对照原记录，选择有限灵视或普通核验并完成准备。"
    : nextAction?.command.type === "PERFORM"
      ? "核对已选方式与防护后进行有限核验，也可以退出本次准备。"
      : nextAction?.command.type === "REPORT"
        ? "根据实际核验与仍未知的部分，选择报告范围。" : nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !corpsecollector.promoted && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || corpsecollector.promoted || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, corpsecollector.promoted, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: CorpsecollectorAction) {
    if (busy || blocked || readOnly || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || corpsecollector.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: CorpsecollectorAction) {
    return (
      <div className="seer-action corpsecollector-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `corpsecollector-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`corpsecollector-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel corpsecollector-panel seer-confirmation" aria-label="这瓶收尸人魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="收尸人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{corpsecollector.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{corpsecollector.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="corpsecollector-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "corpsecollector-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel corpsecollector-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="收尸人成长下一步">
        <span className="seer-seal">{corpsecollector.promoted ? "序列 9" : "收尸人成长卷宗"}</span>
        <h3>{corpsecollector.title}</h3>
        {readOnly ? (
          <p className="seer-next">已选择其它途径，这份收尸人渠道只供回看。</p>
        ) : corpsecollector.promoted && corpsecollector.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的遗体照料和有限报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{corpsecollector.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{corpsecollector.digestion}</p>
        {!corpsecollector.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">取得渠道或晋升不会自动加入教会。照料逝者须尊重遗体与家属隐私；普通核验也能推进实践。</p>
      </section>

      {corpsecollector.promoted && <section className="slice-notice corpsecollector-environment" aria-label="已知登记处与核验范围">
        <h4>已知登记处与核验范围</h4>
        <p>{corpsecollector.environment || "尚未观察原记录与现场；遗体身份、死因与异常来源不能预先认定。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="收尸人遗体照料">
          <h3>原记录、有限核验与报告</h3>
          <label className="seer-case-selector">
            选择遗体照料
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {corpsecollector.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case corpsecollector-case" aria-label="当前遗体照料">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">登记状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="corpsecollector-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未核对原记录与现场；不能据此确定逝者身份、死因或异常来源。</p>}
            </section>
            <section className="corpsecollector-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的核验与报告见原记录。"}</p>
            </section>
            <section className="slice-notice corpsecollector-boundaries" aria-label="逝者尊严与有限认知">
              <h4>逝者尊严与有限认知</h4>
              <p>先观察，再选择有限灵视或普通核验。准备后仍可退出；实际核验与报告分别提交，成本与限制见按钮。</p>
              <p className="slice-muted">灵视只显示本次实际可见的残留，不读取逝者秘密，也不直接给出身份、死因或凶手。确定断言可能失实，已交出的错误会留在原记录中。</p>
            </section>
            {selectedCase.result && <section className="corpsecollector-result" aria-label="实际核验与报告记录">
              <h4>实际核验与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="corpsecollector-action-list" role="group" aria-label="当前遗体照料行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="corpsecollector-action-list" role="group" aria-label="收尸人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {corpsecollector.story && <p className="slice-muted">{corpsecollector.story}</p>}

      {corpsecollector.discovered && <section className="slice-notice corpsecollector-source" aria-label="收尸人成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("仅知配方线索「风干的成年黑斑青蛙」，其用量与完整配方未核实。本阶段使用有独立来源记录的成品原瓶，不提供调配；具体渠道、场景与数值属于本作游戏设定。")}</p>
        {corpsecollector.supplies && <p>{corpsecollector.supplies}</p>}
      </section>}
      {corpsecollector.discovered && corpsecollector.bottles.length > 0 && (
        <details className="seer-fold corpsecollector-bottles" open={!corpsecollector.promoted}>
          <summary>导师的独立成品原瓶 · 来源与去向</summary>
          {corpsecollector.bottles.map((bottle) => {
            const action = corpsecollector.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !corpsecollector.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !corpsecollector.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `corpsecollector-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`corpsecollector-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {corpsecollector.discovered && !corpsecollector.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{corpsecollector.risk}</p></details>}
      {corpsecollector.promoted && (
        <section className="corpsecollector-abilities" aria-label="收尸人能力与消化">
          <h3>能力与消化 · {corpsecollector.abilities.length} 项能力</h3>
          <p className="slice-muted">序列9的阴冷体质、有限灵视与亡灵知识用于实际照料和核验。抗性不能替代现场防护，也不等于免疫毒素、疾病或污染。</p>
          <p>扮演进度 {corpsecollector.acting} · 消化：{corpsecollector.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {corpsecollector.pollution}</p>
          {corpsecollector.abilities.map((ability) => (
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
