import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { RoseBishopAction, RoseBishopCommand, RoseBishopProjection } from "../domain/rose-bishop/types";
import type { ShadowAsceticProjection } from "../domain/shadow-ascetic/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次现场", OBSERVED: "已核对本人、原物与边界", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，须恢复常态并结束接触", RESOLVED: "已提交本次有限报告",
};
const SHAPE_LABELS = { NORMAL: "正常身体", SLIM_HAND: "本人手部仍处于有限调整", SUPPORT_PALM: "本人手掌仍处于承托调整" } as const;

/** The original S7 story, shadow use, failures and bottles remain read-only. */
export function RoseBishopShadowAsceticHistory({ shadowAscetic, currentTitle="蔷薇主教（序列6）" }: { shadowAscetic: ShadowAsceticProjection; currentTitle?:string }) {
  return <section className="seer-panel shadowAscetic-panel" aria-label="隐修士时期的经历">
    <h3>隐修士时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留隐修士时期的原故事、观察、藏匿、显形退出、失败和原瓶，只供回看。</p>
    <p>隐修士扮演进度 {shadowAscetic.acting} · 消化：{shadowAscetic.digestion}</p>
    {(shadowAscetic.story || shadowAscetic.environment || shadowAscetic.supplies) && <details className="seer-fold">
      <summary>隐修士原故事与供给</summary>
      {shadowAscetic.story && <p>{shadowAscetic.story}</p>}{shadowAscetic.environment && <p>{shadowAscetic.environment}</p>}{shadowAscetic.supplies && <p>{shadowAscetic.supplies}</p>}
    </details>}
    {shadowAscetic.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status === "RESOLVED" ? "已退出并提交原报告" : entry.status === "EXAMINED" ? "原检验结果保留" : "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的阴影接触：{entry.shadowOpen}</p><p>当时实际藏匿：{entry.hidden ? "仍在藏匿" : "已显形或未藏匿"}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {shadowAscetic.bottles.length > 0 && <details className="seer-fold">
      <summary>隐修士原瓶 · 来源与去向</summary>
      {shadowAscetic.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {shadowAscetic.abilities.length > 0 && <details className="seer-fold">
      <summary>隐修士时期能力记录</summary>
      {shadowAscetic.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface RoseBishopPanelProps {
  roseBishop: RoseBishopProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: RoseBishopCommand) => void;
}
function isCaseAction(action: RoseBishopAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: RoseBishopAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function isRationAction(action: RoseBishopAction): boolean {
  return action.command.type === "BUY_RATION" || action.command.type === "TAKE_RATION";
}

/** Show committed public originals; choosing a method never changes the body or consumes a packet. */
export function RoseBishopPanel({ roseBishop, resources, busy, blocked = false, error = null, onCommand }: RoseBishopPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = roseBishop.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = roseBishop.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = roseBishop.actions.filter(isCaseAction);
  // Only a projected CLOSE intent identifies the actual open scene, never historical prose.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (roseBishop.insideCase ? roseBishop.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? roseBishop.cases.find((entry) => entry.id === selectedCaseId)
    ?? roseBishop.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? roseBishop.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!roseBishop.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = roseBishop.insideCase ? [] : roseBishop.actions.filter(isEncounterAction);
  const growthActions = roseBishop.insideCase ? [] : roseBishop.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action) && !isRationAction(action));
  const rationActions = !roseBishop.promoted || roseBishop.insideCase ? [] : roseBishop.actions.filter(isRationAction).filter((action) => {
    const command = action.command;
    return command.type !== "TAKE_RATION" || roseBishop.reserve.packets.some((packet) => packet.id === command.packetId);
  });
  const nextRationActions = rationActions.filter((action) => {
    const command = action.command;
    return command.type !== "TAKE_RATION" || roseBishop.reserve.packets.some((packet) => packet.id === command.packetId && packet.status === "HELD");
  });
  const nextAction = roseBishop.insideCase ? closeAction : !roseBishop.promoted
    ? roseBishop.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...nextRationActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !roseBishop.promoted && !roseBishop.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (roseBishop.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, roseBishop.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || roseBishop.promoted || roseBishop.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, roseBishop.promoted, roseBishop.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: RoseBishopAction) {
    if (busy || interactionBlocked || roseBishop.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || roseBishop.promoted || roseBishop.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: RoseBishopAction, unavailable = false) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || unavailable || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || unavailable || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `rose-bishop-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`rose-bishop-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel rose-bishop-panel seer-confirmation" aria-label="这瓶蔷薇主教魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); } }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="蔷薇主教服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{roseBishop.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{roseBishop.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="rose-bishop-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "rose-bishop-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel rose-bishop-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="蔷薇主教成长下一步">
      <span className="seer-seal">{roseBishop.promoted ? "序列 6" : "蔷薇主教晋升卷宗"}</span>
      <h3>{roseBishop.title}</h3>
      <p className="seer-next">{roseBishop.insideCase
        ? <><strong>先实际恢复常态并结束接触：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束为0行动、0精神、0灵性、0储备；保留本次结果与消耗。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : roseBishop.promoted && roseBishop.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{roseBishop.digestion}</p>
      {!roseBishop.promoted && <p className="slice-muted">{playerText("须完成隐修士消化100与十二个完整序列7周。G指导360便士；每瓶3320便士，或5步劳务抵扣3000便士后付320便士。三瓶独立成品分别取得、逐瓶确认，按意志24四档结算；失败仍耗用原瓶。准备期间可继续普通生活与休养。")}</p>}
      {!roseBishop.promoted && <p className="slice-muted">{playerText("完整晋升配方、材料与剂量尚未核实；这里只提供有来源的G独立成品，不展示虚构材料或开放晋升魔药调配。")}</p>}
    </section>
    {roseBishop.promoted && roseBishop.environment && <section aria-label="当前蔷薇主教现场"><h4>当前现场</h4><p>{roseBishop.environment}</p></section>}
    {roseBishop.promoted && <section className="slice-notice" aria-label="血肉储备与实际供给包">
      <h3>血肉储备 {roseBishop.reserve.points} / {roseBishop.reserve.max}</h3>
      <p>{roseBishop.reserve.summary}</p>
      <p>已购供给包 {roseBishop.reserve.packetsBought} 份 · 最近购买：{roseBishop.reserve.lastPurchaseWeek === null ? "尚未购买" : `第${roseBishop.reserve.lastPurchaseWeek}周`}</p>
      <p className="slice-muted">密封非人类动物供给包每周最多购买一份：1行动、40便士。实际取用一原包另耗1行动，储备+1（上限3）；不直接治疗，也不向他人喂食。休养不会补回储备。</p>
      {rationActions.filter((action) => action.command.type === "BUY_RATION").map((action) => actionButton(action))}
      {roseBishop.reserve.packets.length === 0 ? <p className="slice-muted">尚无实际购买的供给原包。</p> : <div aria-label="供给原包记录">
        {roseBishop.reserve.packets.map((packet) => <article key={packet.id} className="seer-bottle">
          <div><h4>供给原包 {packet.id}</h4><p>取得周：{packet.acquiredWeek}</p>
            <p>{packet.status === "HELD" ? "实际持有 · 尚未取用" : `已实际耗用 · 耗用周：${packet.consumedWeek ?? "待核实"}`}</p></div>
          {rationActions.filter((action) => action.command.type === "TAKE_RATION" && action.command.packetId === packet.id)
            .map((action) => actionButton(action, packet.status !== "HELD"))}
        </article>)}
      </div>}
    </section>}
    {selectedCase && <section aria-label="蔷薇主教有限实践">
      <h3>本人身体、原物与实际恢复</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || roseBishop.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {roseBishop.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前蔷薇主教实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        {roseBishop.promoted && <p>当前本人身体：{SHAPE_LABELS[roseBishop.practice.shape]}</p>}
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。请先核对本人、同一原物与停止边界。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前改变身体、取用供给包或取得对方同意。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="蔷薇主教实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前蔷薇主教实践行动">{selectedCaseActions.map((action) => actionButton(action))}</div>}
        {roseBishop.insideCase && <p className="slice-muted">先用当前结束选项实际恢复正常身体并结束接触，再报告或做其它事。结束不另抽随机、不奖励、不退款、不治疗，不抹去原失败或原拒绝。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="蔷薇主教成长行动">{growthActions.map((action) => actionButton(action))}</div>}
    {encounterActions.length > 0 && <section aria-label="蔷薇主教有限冲突">
      <h3>有限现场冲突</h3><p className="slice-muted">维恩持自己的短棍在原外院内行动；可交涉，战斗也有真实风险。这里不追击，不把练习结果当作战斗胜利。</p>
      <div className="magician-action-list" role="group" aria-label="蔷薇主教冲突行动">{encounterActions.map((action) => actionButton(action))}</div>
    </section>}
    {roseBishop.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{roseBishop.story}</p></details>}
    {roseBishop.discovered && roseBishop.supplies && <section className="slice-notice" aria-label="蔷薇主教成品来源与取得"><h4>实际供给与独立原瓶</h4><p>{roseBishop.supplies}</p></section>}
    {roseBishop.discovered && roseBishop.bottles.length > 0 && <details className="seer-fold" open={!roseBishop.promoted}>
      <summary>蔷薇主教独立成品原瓶 · 来源与去向</summary>
      {roseBishop.bottles.map((bottle) => {
        const action = roseBishop.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !roseBishop.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !roseBishop.promoted && !roseBishop.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `rose-bishop-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`rose-bishop-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {roseBishop.discovered && !roseBishop.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{roseBishop.risk}</p></details>}
    {roseBishop.promoted && <section aria-label="蔷薇主教能力与消化">
      <h3>能力与消化 · {roseBishop.abilities.length} 项训练记录</h3>
      <p>扮演进度 {roseBishop.acting} · 消化：{roseBishop.digestion}</p>
      <progress className="cryptologist-progress" aria-label="蔷薇主教扮演进度" value={roseBishop.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {roseBishop.pollution}</p>
      {roseBishop.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="蔷薇主教实践与能力边界">
        <summary>查看自愿实践、来源与能力边界</summary>
        <p>前两项只调整本人手部，分别解除同一原环、承托同一原瓶。能力实践1行动、3灵性、1储备；普通安全方法0灵性、0储备。教学只面向自愿成年人，可拒绝，耗0灵性。</p>
        <p>{playerText("三项有限实践报告各25扮演进度，反思25，可和平消化100。供给、教学情境和数值为本作原创G，不冒充原著完整配方或完整扮演法。")}</p>
        <p>战斗主攻H的本人血肉变化耗2灵性、1储备；自保B的实际健康恢复耗3灵性、1储备，保留伤势，不是复活。储备不足不会自动扣健康代偿。</p>
        <p>本阶段不开放进入他人身体、食人、序列5放牧或灵魂技能。身体恢复常态须实际结束本次接触。</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
