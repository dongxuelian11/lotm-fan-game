import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { CultivatorAction, CultivatorCommand, CultivatorProjection } from "../domain/cultivator/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察原土、种子与照护边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际尝试，请核对原物、周次与结果",
  RESOLVED: "已提交本次实践报告",
};

/** Other-pathway history has no mutation callback or actionable controls. */
export function CultivatorHistory({ cultivator }: { cultivator: CultivatorProjection }) {
  const title = "耕种者渠道经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">这里保留耕种者时期的渠道、原瓶与实践记录，只供回看；当前成长请查看对应卷宗。</p>
    {cultivator.story && <p>{cultivator.story}</p>}
    {cultivator.supplies && <p>{cultivator.supplies}</p>}
    {cultivator.environment && <p>{cultivator.environment}</p>}
    {cultivator.garden && <p>{cultivator.garden}</p>}
    {cultivator.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次照护接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {cultivator.bottles.length > 0 && <details className="seer-fold" open>
      <summary>耕种者原瓶 · 来源与去向</summary>
      {cultivator.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {cultivator.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {cultivator.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: CultivatorAction): boolean {
  return "caseId" in action.command;
}

interface CultivatorPanelProps {
  cultivator: CultivatorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  readOnly?: boolean;
  onCommand: (command: CultivatorCommand) => void;
}

/** Only committed public facts change cultivation contact, preparation, or reports. */
export function CultivatorPanel({ cultivator, resources, busy, blocked, readOnly = false, onCommand }: CultivatorPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => cultivator.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = cultivator.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = cultivator.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = cultivator.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open contact; prose and old results never create a lock.
  const closeAction = cultivator.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? cultivator.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (cultivator.insideCase ? cultivator.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? cultivator.cases.find((entry) => entry.id === selectedCaseId)
    ?? cultivator.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? cultivator.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!cultivator.insideCase || action.command.type === "CLOSE")) : [];
  const actions = cultivator.insideCase ? [] : cultivator.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = cultivator.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : cultivator.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : cultivator.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (cultivator.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [cultivator.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !cultivator.promoted && !cultivator.insideCase && !readOnly;
  const confirmationLocked = busy || blocked || readOnly || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || cultivator.promoted || cultivator.insideCase || readOnly)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, cultivator.promoted, cultivator.insideCase, readOnly]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: CultivatorAction) {
    if (busy || blocked || readOnly || cultivator.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || cultivator.promoted || cultivator.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: CultivatorAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || readOnly || !action.enabled}
          onClick={() => { if (!busy && !blocked && !readOnly && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `cultivator-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`cultivator-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (readOnly) return <CultivatorHistory cultivator={cultivator} />;

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶耕种者魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="耕种者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{cultivator.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{cultivator.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="cultivator-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "cultivator-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="耕种者成长下一步">
        <span className="seer-seal">{cultivator.promoted ? "序列 9" : "耕种者成长卷宗"}</span>
        <h3>{cultivator.title}</h3>
        {cultivator.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次照护接触：</strong>{nextLabel || "查看当前公开结束选项"}。须实际收好工具，并离开本次照护现场。结束不消耗行动或灵性，0精神时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原种子、水、作物与本次结果继续保留。</p>
        ) : cultivator.promoted && cultivator.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{cultivator.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{cultivator.digestion}</p>
        {!cultivator.promoted && !readOnly && <p className="slice-muted">准备期间仍可工作、调查或休养。成功晋升后，途径不能切换。</p>}
        <p className="slice-muted">{playerText("取得渠道或晋升不会自动加入组织。成年苗圃照料员伊芙·莫兰、成品供给、三项有界照护实践与数值均为本作原创G。观察原土与时节、实际照料同一批作物，并分享实际收成是本阶段G扮演解释，可完成本阶段消化；不借用弗兰克的序列6杂交能力。")}</p>
      </section>

      {cultivator.promoted && <section className="slice-notice warrior-environment" aria-label="现场与本次照护接触">
        <h4>现场与本次照护接触</h4>
        <p>{cultivator.environment || "尚未取得现场公开记录；原土、种子、水、实际照护与原收成须经行动分别确认。"}</p>
      </section>}

      {cultivator.promoted && <section className="slice-notice warrior-environment" aria-label="原苗床与实际收成">
        <h4>原苗床与实际收成</h4>
        <p>{cultivator.garden || "尚未取得苗床公开记录；种子、水、栽种周次、照护与实际收成以保存后的记录为准。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="耕种者有限实践">
          <h3>原土观察、真实栽种与收成分享</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || cultivator.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {cultivator.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前耕种者实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次照护接触：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察原现场；土壤、种子、实际照护与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的有界能力实践、普通照护与实际收拾退出见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="原物、时间与照护边界">
              <h4>原物、时间与照护边界</h4>
              <p>先观察原土与时节，再按公开选项准备有界能力实践或普通照护。实际种子、水、栽种、跨周照护、收获与分享分别记入原记录；只有实际提交后的公开记录才会显示。准备、执行、实际收拾退出、报告分别提交，成本、等待周次与限制以公开按钮为准。</p>
              <p className="slice-muted">耕作知识与时节观察不控制天气，不即时催熟，也不制造种子、水或收成。作物须经历真实周次与实际照护；收获和分享只处理已经取得的原份额。本次照护接触尚未结束时，须实际收好工具并退出，再做其它事务；失败也不代替实际结束。结束不另抽随机、不奖励、不退款、不治疗，不会抹去已经发生的结果。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="原物、照护经过与有限报告" aria-live="polite" aria-atomic="true">
              <h4>原物、照护经过与有限报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前耕种者实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="耕种者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {cultivator.story && <p className="slice-muted">{cultivator.story}</p>}

      {cultivator.discovered && <section className="slice-notice warrior-source" aria-label="耕种者成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {cultivator.supplies && <p>{cultivator.supplies}</p>}
      </section>}
      {cultivator.discovered && cultivator.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!cultivator.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {cultivator.bottles.map((bottle) => {
            const action = cultivator.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !cultivator.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !cultivator.promoted && !cultivator.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || readOnly || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `cultivator-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`cultivator-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {cultivator.discovered && !cultivator.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{cultivator.risk}</p></details>}
      {cultivator.promoted && (
        <section className="warrior-abilities" aria-label="耕种者能力与消化">
          <h3>能力与消化 · {cultivator.abilities.length} 项训练记录</h3>
          <p className="slice-muted">{playerText("本阶段以耕作知识、时节观察与细致照护三项有界G能力承接耕种者主题，具体效果均以实际观察与行动结果为准。时节观察不控制天气；照护不即时催熟、不凭空创造收成，也不提供弗兰克的序列6杂交能力。原土、原种子、水与作物仍须真实投入和照料；不把候选设计或高序列能力写成已核实原著事实。普通武器、掩体与撤退沿用共同战斗界面。")}</p>
          <p>扮演进度 {cultivator.acting} · 消化：{cultivator.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {cultivator.pollution}</p>
          {cultivator.abilities.map((ability) => (
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
