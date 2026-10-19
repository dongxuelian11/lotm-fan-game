import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { CryptologistAction, CryptologistCommand, CryptologistProjection } from "../domain/cryptologist/types";
import type { SeerResources } from "./SeerPanel";
import type { SwindlerProjection } from "../domain/swindler/types";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原记录与已知边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际核查，等待提交报告",
  RESOLVED: "已完成本次有限报告",
};

/** Older S8 evidence is a record only; it deliberately has no command callback. */
export function SwindlerHistory({ swindler }: { swindler: SwindlerProjection }) {
  const status: Record<string, string> = {
    AVAILABLE: "尚未观察", OBSERVED: "已观察，等待准备", PREPARED: "准备已完成",
    EXAMINED: "已实际实践，尚未澄清", RESOLVED: "已出示原物并澄清报告",
  };
  return <section className="seer-panel cryptologist-panel" aria-label="诈骗师时期的经历">
    <h3>诈骗师时期的经历</h3>
    <p className="slice-notice">你已晋升解密学者。这里保留诈骗师时期的原观察、实际方法与澄清报告、原瓶来源和能力掌握；当前实践请回到解密学者卷宗。</p>
    <p>诈骗师扮演进度 {swindler.acting} · {swindler.digestion}</p>
    {swindler.story && <p>{swindler.story}</p>}
    {swindler.environment && <p className="slice-muted">{swindler.environment}</p>}
    {swindler.cases.length > 0 && <section aria-label="诈骗师实践历史">
      {swindler.cases.map((entry) => <details className="seer-fold" key={entry.id}>
        <summary>{entry.title} · {status[entry.status] ?? "状态待核实"}</summary>
        <p>{entry.story}</p>
        {entry.observations.length > 0 && <section aria-label={`${entry.title}的原观察`}>
          <h4>原观察记录</h4><ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
        </section>}
        {entry.preparation && <section aria-label={`${entry.title}的原准备`}><h4>原方式与准备</h4><p>{entry.preparation}</p></section>}
        {entry.result && <section aria-label={`${entry.title}的实际结果`}><h4>实际结果与澄清记录</h4><p>{entry.result}</p></section>}
      </details>)}
    </section>}
    {swindler.supplies && <p className="slice-muted">{swindler.supplies}</p>}
    {swindler.bottles.length > 0 && <details className="seer-fold">
      <summary>诈骗师原瓶 · 来源与去向</summary>
      {swindler.bottles.map((bottle) => <article className="cryptologist-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {swindler.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的诈骗师能力</summary>
      {swindler.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: CryptologistAction): boolean {
  return "caseId" in action.command;
}

interface CryptologistPanelProps {
  cryptologist: CryptologistProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: CryptologistCommand) => void;
}

/** The panel forwards public intents and displays only committed observations and finite answers. */
export function CryptologistPanel({ cryptologist, resources, busy, blocked, onCommand }: CryptologistPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = cryptologist.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = cryptologist.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = cryptologist.actions.filter(isCaseAction);
  const selectedCase = cryptologist.cases.find((scene) => scene.id === selectedCaseId)
    ?? cryptologist.cases.find((scene) => scene.status === "EXAMINED")
    ?? cryptologist.cases.find((scene) => scene.status === "OBSERVED" || scene.status === "PREPARED")
    ?? cryptologist.cases.find((scene) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === scene.id))
    ?? cryptologist.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const actions = cryptologist.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = cryptologist.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? caseActions.find((action) => action.enabled) ?? selectedCaseActions[0] ?? actions[0]
    : cryptologist.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !cryptologist.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || cryptologist.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, cryptologist.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: CryptologistAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || cryptologist.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: CryptologistAction) {
    return (
      <div className="seer-action cryptologist-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => {
            if (busy || blocked || !action.enabled) return;
            // Keep the acted-on scene visible when its committed result makes it resolved.
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `cryptologist-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`cryptologist-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel cryptologist-panel seer-confirmation" aria-label="这瓶解密学者魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="解密学者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{cryptologist.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{cryptologist.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="cryptologist-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "cryptologist-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel cryptologist-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="解密学者成长下一步">
        <span className="seer-seal">{cryptologist.promoted ? "序列 7" : "解密学者晋升卷宗"}</span>
        <h3>{cryptologist.title}</h3>
        {cryptologist.promoted && cryptologist.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的原记录、解密与有限报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{cryptologist.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{cryptologist.digestion}</p>
        {!cryptologist.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养。先完成诈骗师消化与八个完整序列8周的成熟时间，再独立确认服药。</p>}
        <p className="slice-muted">{playerText("这是游戏设定（G）的新渠道独立成品药，沿用原创成年导师艾德温·洛克；完整配方待核，指导不解锁材料采购或制造，也不会建立家族或组织身份。")}</p>
      </section>

      {cryptologist.promoted && <section className="slice-notice cryptologist-environment" aria-label="已知实践环境">
        <h4>已知实践环境</h4>
        <p>{cryptologist.environment || "现场尚未确认，请先观察原记录、实际对象与已公开的边界。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="解密学者实践记录">
          <h3>原记录、有限解密与报告</h3>
          <p className="slice-muted">先观察原记录和已知风险，再选择有限解密或普通核查。实际执行后，按已有结果提交报告；未知内容仍须保留。各步的消耗与可否执行以公开按钮为准。</p>
          <label className="seer-case-selector">
            选择解密情境
            <select value={selectedCase.id} disabled={busy || blocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {cryptologist.cases.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {CASE_STATUS[scene.status] ?? scene.status}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前解密情境">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? selectedCase.status}</p>
            <section className="seer-fold cryptologist-observations" aria-label="已取得的现场观察">
              <h4>已取得的现场观察</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得现场观察。原记录的答案、未公开的危险与本次行动结果仍未知。</p>}
            </section>
            <section className="cryptologist-preparation" aria-label="实际方法与准备">
              <h4>实际方法与准备</h4>
              <p>{selectedCase.preparation || "尚未选定本次方法；不会自动解密或替你作出确定结论。"}</p>
            </section>
            {selectedCase.status === "EXAMINED" && <p className="slice-notice">核查已有实际结果。请区分已解出的内容和仍未知的部分，再提交报告；尚未完成报告与奖励结算。</p>}
            {selectedCase.result && <section className="slice-notice cryptologist-result" aria-label="实际解密与核查结果"><h4>实际解密与核查结果</h4><p>{selectedCase.result}</p></section>}
            {selectedCaseActions.length > 0 && (
              <div className="cryptologist-action-list" role="group" aria-label="当前情境行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="cryptologist-action-list" role="group" aria-label="解密学者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {cryptologist.story && <p className="slice-muted cryptologist-source">{cryptologist.story}</p>}

      {cryptologist.discovered && cryptologist.supplies && <p className="slice-notice">{cryptologist.supplies}</p>}
      {cryptologist.discovered && cryptologist.bottles.length > 0 && (
        <details className="seer-fold cryptologist-bottles" open={!cryptologist.promoted}>
          <summary>解密学者独立成品原瓶 · 来源与去向</summary>
          {cryptologist.bottles.map((bottle) => {
            const action = cryptologist.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !cryptologist.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !cryptologist.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `cryptologist-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`cryptologist-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {cryptologist.discovered && !cryptologist.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{cryptologist.risk}</p></details>}
      {cryptologist.promoted && (
        <section className="cryptologist-abilities" aria-label="解密学者能力与消化">
          <h3>能力与消化 · {cryptologist.abilities.length} 项能力</h3>
          <p className="slice-muted">{playerText("解密、神秘学推理、灵性直觉与危险感知归于同一项解密能力。成功可以解开当前情境允许解出的完整谜题；不会凭空补出未定义答案、未知身份或高位秘密。危险只显示已经公开的预警，具体场景与数值属于游戏设定（G），不提前开放能力偷取。")}</p>
          <p>扮演进度 {cryptologist.acting} / 100 · 消化：{cryptologist.digestion}</p>
          <progress className="cryptologist-progress" aria-label="解密学者扮演进度" value={cryptologist.acting} max={100} />
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {cryptologist.pollution}</p>
          {cryptologist.abilities.map((ability) => (
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
