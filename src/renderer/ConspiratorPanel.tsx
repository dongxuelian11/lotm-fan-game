import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ConspiratorAction, ConspiratorCommand, ConspiratorProjection } from "../domain/conspirator/types";
import type { PyromaniacProjection } from "../domain/pyromaniac/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对事实",
  OBSERVED: "已有事实与回应记录",
  PREPARED: "已有待执行的有条件方案",
  EXAMINED: "已有实际回应，请核对结果与限制",
  RESOLVED: "已提交本次有限报告",
};

/** Earlier fire practice remains history; its costs, failures and originals are never rewritten. */
export function ConspiratorPyromaniacHistory({ pyromaniac }: { pyromaniac: PyromaniacProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="纵火家时期的经历">
    <h3>纵火家时期的经历</h3>
    <p className="slice-notice">你已晋升阴谋家。这里保留纵火家时期的原实践、现场、失败、原瓶与掌握记录，只供回看。</p>
    <p>纵火家扮演进度 {pyromaniac.acting} · 消化：{pyromaniac.digestion}</p>
    {pyromaniac.story && <p>{pyromaniac.story}</p>}
    {pyromaniac.supplies && <p>{pyromaniac.supplies}</p>}
    {pyromaniac.environment && <p>{pyromaniac.environment}</p>}
    {pyromaniac.practices.map((practice) => <details className="seer-fold" key={practice.id}>
      <summary>{practice.title} · {practice.status}</summary><p>{practice.story}</p>
    </details>)}
    {pyromaniac.bottles.length > 0 && <details className="seer-fold" open>
      <summary>纵火家原瓶 · 来源与去向</summary>
      {pyromaniac.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {pyromaniac.abilities.length > 0 && <details className="seer-fold">
      <summary>纵火家时期能力记录</summary>
      {pyromaniac.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

interface ConspiratorPanelProps {
  conspirator: ConspiratorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ConspiratorCommand) => void;
}

function isCaseAction(action: ConspiratorAction): boolean {
  return "caseId" in action.command;
}
function isEncounterAction(action: ConspiratorAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Public facts and receipts alone determine plans, other people's choices, costs and outcomes. */
export function ConspiratorPanel({ conspirator, resources, busy, blocked = false, error = null, onCommand }: ConspiratorPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = conspirator.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = conspirator.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = conspirator.actions.filter(isCaseAction);
  // Only an actual public CLOSE intent identifies open contact. Historic refusal prose cannot lock it.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (conspirator.insideCase ? conspirator.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? conspirator.cases.find((entry) => entry.id === selectedCaseId)
    ?? conspirator.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? conspirator.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!conspirator.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = conspirator.insideCase ? [] : conspirator.actions.filter(isEncounterAction);
  const growthActions = conspirator.insideCase ? [] : conspirator.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = conspirator.insideCase ? closeAction : !conspirator.promoted
    ? conspirator.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !conspirator.promoted && !conspirator.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (conspirator.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, conspirator.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || conspirator.promoted || conspirator.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, conspirator.promoted, conspirator.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ConspiratorAction) {
    if (busy || interactionBlocked || conspirator.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || conspirator.promoted || conspirator.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: ConspiratorAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `conspirator-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`conspirator-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶阴谋家魔药的服用确认" aria-busy={busy}
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
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="阴谋家服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{conspirator.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{conspirator.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="conspirator-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "conspirator-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试回执。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="阴谋家成长下一步">
      <span className="seer-seal">{conspirator.promoted ? "序列 6" : "阴谋家晋升卷宗"}</span>
      <h3>{conspirator.title}</h3>
      <p className="seer-next">{conspirator.insideCase
        ? <><strong>先实际结束本次接触：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束为0行动、0精神、0灵性；不另抽随机、不奖励、不退款、不治疗，原拒绝、失败与修订记录继续保留。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{conspirator.digestion}</p>
      {!conspirator.promoted && <p className="slice-muted">服用前须完成纵火家消化100与十二个完整序列7周。指导、每瓶劳务、付款取得成品与逐瓶确认分别进行，实际费用、成熟条件与补给以当前公开记录为准；准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与剂量仍未核实，指导仅说明有来源的独立成品原瓶。原著已核实谋划、组织理由与说服能力提升，计划仍依赖已知情报，对方可拒绝，修订后也可能失败。具体故事、判定、费用与消化数值为本作原创G。")}</p>
    </section>

    {conspirator.promoted && <section className="slice-notice" aria-label="阴谋家能力边界">
      <h4>计划有条件，对方有自己的判断</h4>
      <p>先核实事实，再提出有条件的方案；实际回应由当事人自主评估。明确拒绝会保留，取得新事实后才能据此修订，修订与执行分别提交。三项主实践可和平完成本阶段消化；有限后门冲突另行选择。</p>
      <p className="slice-muted">说服不是强制控制，不会自动让人降智。原火焰能力仍按公开规则使用，不推定统一增幅或未核实距离；木偶控制与收割者的弱点击杀不属于本阶段新增能力。</p>
    </section>}
    {conspirator.promoted && conspirator.environment && <section aria-label="当前阴谋家现场">
      <h4>当前现场</h4><p>{conspirator.environment}</p>
    </section>}
    {selectedCase && <section aria-label="阴谋家有限实践">
      <h3>事实、方案与实际回应</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || conspirator.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {conspirator.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前阴谋家实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次接触：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="已核事实与原拒绝记录"><h4>已核事实与原拒绝记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际核对记录；不能把猜测当作事实，也没有可据此认定的同意。</p>}
        </section>
        <section aria-label="有条件方案与准备"><h4>有条件方案与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的方案。选择准备不会提前获得同意、实施计划或改写原拒绝。"}</p>
        </section>
        {selectedCase.result && <section aria-label="对方自主评估与实际结果" aria-live="polite" aria-atomic="true">
          <h4>对方自主评估与实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前阴谋家实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">普通方法保留自己的条件与结果。撤回待执行准备不等于结束实际接触；原拒绝、实际代价与已提交报告都不会因此消失。是否可执行与成本以公开按钮为准。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="阴谋家成长行动">{growthActions.map(actionButton)}</div>}
    {conspirator.story && <p className="slice-muted">{conspirator.story}</p>}
    {encounterActions.length > 0 && <section aria-label="有限后门冲突">
      <h3>有限后门冲突</h3>
      <p className="slice-muted">可按公开选项交涉，或承担普通短棍战的实际风险。提出理由不保证对方接受，选择战斗也不会提前取得胜利。</p>
      <div className="warrior-action-list" role="group" aria-label="后门冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {conspirator.discovered && conspirator.supplies && <section className="slice-notice" aria-label="阴谋家成品原瓶供给">
      <h4>成品原瓶与实际供给</h4><p>{conspirator.supplies}</p>
    </section>}
    {conspirator.discovered && conspirator.bottles.length > 0 && <details className="seer-fold" open={!conspirator.promoted}>
      <summary>阴谋家独立成品原瓶 · 来源与去向</summary>
      {conspirator.bottles.map((bottle) => {
        const action = conspirator.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !conspirator.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !conspirator.promoted && !conspirator.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `conspirator-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`conspirator-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {conspirator.discovered && !conspirator.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{conspirator.risk}</p></details>}
    {conspirator.promoted && <section aria-label="阴谋家能力与消化">
      <h3>能力与消化 · {conspirator.abilities.length} 项训练记录</h3>
      <p>扮演进度 {conspirator.acting} · 消化：{conspirator.digestion}</p>
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {conspirator.pollution}</p>
      {conspirator.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
