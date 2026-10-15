import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { AstronomerAction, AstronomerCommand, AstronomerProjection } from "../domain/astronomer/types";
import type { ArtisanProjection } from "../domain/artisan/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场",
  OBSERVED: "已有公开观察",
  PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告",
  RESOLVED: "已提交有限报告",
};

/** Original artisan work, materials and the client-owned lamp remain read-only history. */
export function AstronomerArtisanHistory({ artisan }: { artisan: ArtisanProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="工匠时期的经历">
    <h3>工匠时期的经历</h3>
    <p className="slice-notice">你已晋升天文学家（序列5）。这里保留工匠时期三案的图纸、耗料、失败、实际结束、本人交付与独立原瓶，只供回看。</p>
    <p>工匠扮演进度 {artisan.acting} · 消化：{artisan.digestion}</p>
    {(artisan.story || artisan.environment || artisan.supplies) && <details className="seer-fold">
      <summary>工匠原故事与供给</summary>
      {artisan.story && <p>{artisan.story}</p>}
      {artisan.environment && <p>{artisan.environment}</p>}
      {artisan.supplies && <p>{artisan.supplies}</p>}
    </details>}
    {artisan.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方案与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold" aria-label="工匠原工房与已交付原件">
      <summary>原工房、原料与微光灯片去向</summary>
      <p>{artisan.workshop.summary}</p><p>{artisan.workshop.materials}</p>
      {artisan.workshop.lamp ? <>
        <p>{artisan.workshop.lamp}</p>
        <p>原件剩余照明：{artisan.workshop.remainingUses} 次。</p>
        <p>{artisan.workshop.delivered ? "原件已交付，由委托人本人保有。" : "尚无本人交付记录，原件去向以原记录为准。"}</p>
      </> : <p>原记录中尚无制造成功的灯片。</p>}
      <p className="slice-muted">晋升不复制灯片，不补充照明次数，也不会将已交付原件转回玩家。这里没有重新制造、检验或领取原件的操作。</p>
    </details>
    {artisan.bottles.length > 0 && <details className="seer-fold">
      <summary>工匠原瓶 · 来源与去向</summary>
      {artisan.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {artisan.abilities.length > 0 && <details className="seer-fold">
      <summary>工匠时期能力记录</summary>
      {artisan.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface AstronomerPanelProps {
  astronomer: AstronomerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: AstronomerCommand) => void;
}

function isCaseAction(action: AstronomerAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: AstronomerAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render committed public observations and submit the original projected intent unchanged. */
export function AstronomerPanel({ astronomer, resources, busy, blocked = false, error = null, onCommand }: AstronomerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = astronomer.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = astronomer.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = astronomer.actions.filter(isCaseAction);
  // Only public exit intents locate a currently open scene; prose is never parsed as state.
  const exitAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "WITHDRAW" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId : null;
  const selectedCase = (astronomer.insideCase ? astronomer.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? astronomer.cases.find((entry) => entry.id === selectedCaseId)
    ?? astronomer.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? astronomer.cases[0];
  // Public enabled intents remain usable inside the scene, including zero-resource exits.
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = astronomer.actions.filter(isEncounterAction);
  const growthActions = astronomer.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = !astronomer.promoted
    ? astronomer.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
      ?? selectedCaseActions.find((action) => action.enabled)
      ?? growthActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !astronomer.promoted && !astronomer.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (astronomer.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, astronomer.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || astronomer.promoted || astronomer.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, astronomer.promoted, astronomer.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: AstronomerAction) {
    if (busy || interactionBlocked || astronomer.insideCase || astronomer.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || astronomer.promoted || astronomer.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: AstronomerAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `astronomer-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`astronomer-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel astronomer-panel seer-confirmation" aria-label="这瓶天文学家魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("本次只确认指导流程中的这一成品原瓶。完整配方、晋升仪式与具体法术清单尚未掌握，不能据此断言无需仪式。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="天文学家服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{astronomer.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{astronomer.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="astronomer-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "astronomer-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel astronomer-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="天文学家成长下一步">
      <span className="seer-seal">{astronomer.promoted ? "天文学家5（古称星术师）" : "工匠6 → 天文学家5（古称星术师）"}</span>
      <h3>{astronomer.title}</h3>
      {astronomer.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : astronomer.insideCase ? "请查看当前公开的结束实践选项。"
          : astronomer.promoted && astronomer.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{astronomer.digestion}</p>
      {astronomer.discovered && !astronomer.promoted && <p className="slice-muted">用药指导：{astronomer.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得原瓶与逐瓶确认分别进行；实际费用、成熟条件与安全恢复范围以公开记录为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("当前渠道只提供独立成品魔药，不提供完整配方、材料、剂量或调配顺序。完整晋升仪式与具体法术清单尚未掌握，不能据此断言无需仪式。本阶段服药须完成普通导师准备与指导流程。")}</p>
    </section>

    {astronomer.promoted && astronomer.environment && <section aria-label="当前天文学家现场">
      <h4>当前现场</h4><p>{astronomer.environment}</p>
    </section>}
    {astronomer.promoted && astronomer.practice && <section className="slice-notice" aria-label="天文学家仪器与实际观测记录">
      <h3>原仪器与已保存的有限测量</h3>
      <dl className="seer-facts">
        <div><dt>已记录仪器偏差</dt><dd>{astronomer.practice.instrumentOffset}</dd></div>
        <div><dt>实际校准周</dt><dd>{astronomer.practice.calibratedWeek === null ? "尚未完成实际校准" : `第${astronomer.practice.calibratedWeek}周`}</dd></div>
        <div><dt>实际夜访观测周</dt><dd>{astronomer.practice.observedWeek === null ? "尚未完成实际夜访" : `第${astronomer.practice.observedWeek}周`}</dd></div>
        <div><dt>已保存测量次数</dt><dd>{astronomer.practice.measurements}</dd></div>
      </dl>
      <p className="slice-muted">偏差须以真实工具手动校准，准备或短时专注不会自动修好原仪器。完成校准报告后，还须等游戏日历推进到实际下一周，再亲赴原观测楼顶进行当晚有限测量；记录不能保证未来天象或未来事件。</p>
    </section>}
    {selectedCase && <section aria-label="天文学家有限实践">
      <h3>星表核对、手动校准与实际夜访</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || astronomer.insideCase}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {astronomer.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前天文学家实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；星表、仪器偏差与夜访结果均以已保存的公开记录为准。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备不会提前校准仪器、完成夜访或取得测量结果；效果只在实际执行并保存后显示。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="天文学家实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前天文学家实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {astronomer.insideCase && <p className="slice-muted">返回生活前须按公开选项实际结束当前接触。0行动、0精神、0灵性时仍可使用已开放的结束或撤回选项；不会另抽随机、发奖、退款、治疗或清除原失败。撤回与结束各自的实际作用以原选项和已保存记录为准。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="天文学家成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="天文学家有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">按公开选项选择交涉或承担真实战斗风险。短时专注校准不保证战斗命中、胜利或安全退出；伤势、反击与退出以当前现场和实际结算为准。</p>
      <div className="warrior-action-list" role="group" aria-label="天文学家冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {astronomer.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{astronomer.story}</p></details>}
    {astronomer.discovered && astronomer.supplies && <section className="slice-notice" aria-label="天文学家成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{astronomer.supplies}</p>
    </section>}
    {astronomer.discovered && astronomer.bottles.length > 0 && <details className="seer-fold" open={!astronomer.promoted}>
      <summary>天文学家独立成品原瓶 · 来源与去向</summary>
      {astronomer.bottles.map((bottle) => {
        const action = astronomer.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !astronomer.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !astronomer.promoted && !astronomer.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `astronomer-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`astronomer-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {astronomer.discovered && !astronomer.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{astronomer.risk}</p></details>}
    {astronomer.promoted && <section aria-label="天文学家能力与消化">
      <h3>能力与消化 · {astronomer.abilities.length} 项训练记录</h3>
      <p>扮演进度 {astronomer.acting} · 消化：{astronomer.digestion}</p>
      <progress className="cryptologist-progress" aria-label="天文学家扮演进度" value={astronomer.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {astronomer.pollution}</p>
      {astronomer.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="天文学家能力边界">
        <summary>查看短时专注、有限测量与原物边界</summary>
        <p>{playerText("本阶段新增一项技能「短时专注校准」，用于有限练习与当次真实结算。它只提供上述有限用途；完整法术清单尚未掌握，本阶段不增加其它法术。")}</p>
        <p>先核对有来源的星表，再用真实工具手动调整原仪器。校准报告后须等实际下一周，并亲赴楼顶完成当晚测量。专注、准备与报告都不会替代手动操作、真实时间推进或实际夜访，也不能提供确定未来。</p>
        <p>原仪器与原工具保留自己的来源和所有人；工匠时期交给委托人的微光灯片仍按原去向保留，不复制、不回收、不补充用途。原能力ID与掌握继续保留。</p>
        <p>{playerText("三项有限实践、和平消化、导师准备、费用和具体判定均为本作原创G。普通与能力方法的条件、失败和实际消耗按当前公开选项结算。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
