import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { InterrogatorAction, InterrogatorCommand, InterrogatorProjection } from "../domain/interrogator/types";
import type { ArbiterProjection } from "../domain/arbiter/types";
import type { SheriffProjection } from "../domain/sheriff/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已观察记录与自愿谈话边界",
  PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际尝试，请核对原陈述与有限结果",
  RESOLVED: "已提交本次实践报告",
};

/** Prior stages stay read-only after promotion; live inherited exits use their original panels. */
function InterrogatorPriorHistory({ value, name }: { value: ArbiterProjection | SheriffProjection; name: string }) {
  const title = `${name}时期的经历`;
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">你已晋升审讯者。这里保留{name}时期的原观察、当事人的选择、实际结束、原报告与原瓶来源，只供回看。</p>
    <p>{name}扮演进度 {value.acting} · 消化：{value.digestion}</p>
    {value.story && <p>{value.story}</p>}
    {value.supplies && <p>{value.supplies}</p>}
    {value.environment && <p>{value.environment}</p>}
    {value.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">本次接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {value.bottles.length > 0 && <details className="seer-fold" open>
      <summary>{name}原瓶 · 来源与去向</summary>
      {value.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {value.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {value.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}
export function InterrogatorArbiterHistory({ arbiter }: { arbiter: ArbiterProjection }) {
  return <InterrogatorPriorHistory value={arbiter} name="仲裁人" />;
}
export function InterrogatorSheriffHistory({ sheriff }: { sheriff: SheriffProjection }) {
  return <InterrogatorPriorHistory value={sheriff} name="治安官" />;
}

function isCaseAction(action: InterrogatorAction): boolean {
  return "caseId" in action.command;
}

interface InterrogatorPanelProps {
  interrogator: InterrogatorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: InterrogatorCommand) => void;
}

/** Only committed public facts change interviews, contradictory accounts, actual exits, or bounded reports. */
export function InterrogatorPanel({ interrogator, resources, busy, blocked, onCommand }: InterrogatorPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => interrogator.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = interrogator.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = interrogator.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const caseActions = interrogator.actions.filter(isCaseAction);
  // Only the public CLOSE intent selects the actual open practice; prose and old results never create a lock.
  const closeAction = interrogator.actions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? interrogator.actions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (interrogator.insideCase ? interrogator.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? interrogator.cases.find((entry) => entry.id === selectedCaseId)
    ?? interrogator.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? interrogator.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!interrogator.insideCase || action.command.type === "CLOSE")) : [];
  const actions = interrogator.insideCase ? [] : interrogator.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action));
  const nextAction = interrogator.insideCase
    ? selectedCaseActions.find((action) => action.command.type === "CLOSE" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "CLOSE")
    : interrogator.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : interrogator.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (interrogator.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [interrogator.insideCase, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !interrogator.promoted && !interrogator.insideCase;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || interrogator.promoted || interrogator.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, interrogator.promoted, interrogator.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: InterrogatorAction) {
    if (busy || blocked || interrogator.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || interrogator.promoted || interrogator.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: InterrogatorAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => { if (!busy && !blocked && action.enabled) onCommand(action.command); }}
          aria-describedby={action.reason ? `interrogator-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`interrogator-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶审讯者魔药的服用确认" aria-busy={busy}
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
        <section className="slice-notice seer-risk" aria-label="审讯者服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{interrogator.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{interrogator.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="interrogator-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "interrogator-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="审讯者成长下一步">
        <span className="seer-seal">{interrogator.promoted ? "序列 7" : "审讯者成长卷宗"}</span>
        <h3>{interrogator.title}</h3>
        {interrogator.insideCase ? (
          <p className="seer-next"><strong>先实际结束本次实践：</strong>{nextLabel || "查看当前公开结束选项"}。结束不消耗行动或灵性，0精神时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原观察、矛盾陈述、当事人的选择与报告继续保留。</p>
        ) : interrogator.promoted && interrogator.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{interrogator.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{interrogator.digestion}</p>
        {!interrogator.promoted && <p className="slice-muted">需先完成治安官100消化与八个完整序列8周。晋升准备和待执行准备期间仍可工作、调查或休养；成功晋升后仍沿审判者途径成长。</p>}
        <p className="slice-muted">{playerText("成年民间调解文书员薇娜·贝尔仍沿原渠道提供指导；你没有获任政府职务，取得成品或晋升不会自动加入组织。独立进阶成品、三项具体实践与数值为本作原创G。核对原陈述、承认矛盾与有限结果、尊重当事人的停止选择，是本阶段G扮演解释；能力施压不保证真话，也不会自动补全未知事实。")}</p>
      </section>

      {interrogator.promoted && <section className="slice-notice warrior-environment" aria-label="现场与当前实践">
        <h4>现场与当前实践</h4>
        <p>{interrogator.environment || "尚未取得公开记录；原片段、交付矛盾与自愿谈话的停止边界须经实际行动分别确认。"}</p>
      </section>}

      {selectedCase && (
        <section aria-label="审讯者有限实践">
          <h3>记录核对与自愿谈话</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || interrogator.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {interrogator.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前审讯者实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">本次实践：{selectedCase.contactOpen}</p>
            <p className="slice-muted">实际结束次数：{selectedCase.closes}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察原记录；片段内容、交付矛盾、自愿谈话边界与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的观察、原陈述、实际结束与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="自愿谈话、有限陈述与核实边界">
              <h4>自愿谈话、有限陈述与核实边界</h4>
              <p>先观察原片段、相互矛盾的交付记录与当事人同意的范围，再选择公开的能力方法或普通方法。陈述与回忆可能片面、失真或互相矛盾，能力施压不保证真话，不能自动读取真相或判罪。自愿谈话可随时停止；本人撤回同意后，实际结束接触，再通过普通记录核实。准备、执行、实际结束与报告分别提交，实际能力执行消耗3灵性；本人撤回同意时不强行执行，也不消耗这笔灵性，但仍须实际结束接触。成本与限制以公开按钮为准。</p>
              <p className="slice-muted">本阶段不提供自动判罪、读取完整真相或政府任命。精神刺穿的虚构战斗能力不等于日常谈话许可；日常实践不给出施刑操作。当事人仍自主决定。实际接触开始后，无论采用能力或普通方法、尝试成功或失败，都须先实际结束，再做其它事务；撤回待执行准备不能代替结束。结束不另抽随机、不奖励、不退款、不治疗，原结果与报告继续保留。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="原陈述、实际结果与有限报告" aria-live="polite" aria-atomic="true">
              <h4>原陈述、实际结果与有限报告</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前审讯者实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="审讯者成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {interrogator.story && <p className="slice-muted">{interrogator.story}</p>}

      {interrogator.discovered && <section className="slice-notice warrior-source" aria-label="审讯者成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。已知主材料为闪纹黑蛇的角、湖中之灵粉尘，但没有已核实用量；辅料、完整用量与投料顺序仍未知，不能据此制造。本阶段只使用本作原创G渠道中的三瓶独立成品原瓶，不提供材料采购或调配。指导240便士并用1行动；每瓶原价2010便士，四次实际劳动抵扣1800便士后仍需210便士。服用按意志难度18判定，来源与有限补给条件以以下公开记录为准。")}</p>
        {interrogator.supplies && <p>{interrogator.supplies}</p>}
      </section>}
      {interrogator.discovered && interrogator.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!interrogator.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {interrogator.bottles.map((bottle) => {
            const action = interrogator.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !interrogator.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !interrogator.promoted && !interrogator.insideCase && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `interrogator-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`interrogator-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {interrogator.discovered && !interrogator.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{interrogator.risk}</p></details>}
      {interrogator.promoted && (
        <section className="warrior-abilities" aria-label="审讯者能力与消化">
          <h3>能力与消化 · {interrogator.abilities.length} 项训练记录</h3>
          <p className="slice-muted">序列7继承仲裁人的威严、令人信服的魅力与格斗训练，以及治安官的痕迹感应与图像重构，新增精神刺穿与精神压迫，共七项当前能力。掌握与边界以已公开记录为准；精神刺穿与审讯本领不保证陈述真实，不能自动读取真相或宣告有罪。不提供序列6神秘禁令，不获得政府任命；当事人仍自主决定。晋升后灵性上限60，当前灵性不会自动补满。</p>
          <p>扮演进度 {interrogator.acting} · 消化：{interrogator.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {interrogator.pollution}</p>
          {interrogator.abilities.map((ability) => (
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
