import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { FacelessCommand, FacelessProjection } from "../domain/faceless/types";
import type { MarionettistAction, MarionettistCommand, MarionettistProjection } from "../domain/marionettist/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已观察原现场与本人意愿", PREPARED: "已准备，尚未实际施术",
  EXAMINED: "已有实际结果，请结束接触", RESOLVED: "已实际退出并报告",
};

/** Old cases stay read-only; public inherited appearance and original-costume controls remain real. */
export function MarionettistFacelessHistory({ faceless, busy = false, blocked = false, onCommand }: {
  faceless: FacelessProjection; busy?: boolean; blocked?: boolean; onCommand?: (command: FacelessCommand) => void;
}) {
  const appearanceActions = faceless.actions.filter((action) => ["RESTORE_SELF", "CHANGE_APPEARANCE", "RETURN_OUTFIT"].includes(action.command.type));
  return <section className="seer-panel magician-panel" aria-label="无面人时期的经历" aria-busy={busy}>
    <h3>无面人时期的经历</h3>
    <p className="slice-notice">原外貌、声音、衣物与实践记录继续保留。旧案仅供回看；晋升不会自动复原外貌或归还原衣。</p>
    <p>无面人扮演进度 {faceless.acting} · 消化：{faceless.digestion}</p>
    <section aria-label="保留的持续外貌与原道具服">
      <h4>持续外貌与原物</h4>
      <dl className="seer-facts">
        <div><dt>当前外貌</dt><dd>{faceless.appearance.label}</dd></div>
        <div><dt>当前声音</dt><dd>{faceless.appearance.voice}</dd></div>
        <div><dt>相对本人身高</dt><dd>{faceless.appearance.heightOffsetCm} 厘米</dd></div>
        <div><dt>外貌来源</dt><dd>{faceless.appearance.source}</dd></div>
        <div><dt>持续状态</dt><dd>{faceless.appearance.persistent ? "变化仍持续" : "本人原貌"}</dd></div>
        <div><dt>原道具服</dt><dd>{faceless.outfit.label}</dd></div>
        <div><dt>原物编号</dt><dd>{faceless.outfit.id}</dd></div>
        <div><dt>原物去向</dt><dd>{faceless.outfit.location}</dd></div>
      </dl>
      <p>{faceless.appearance.summary}</p><p>{faceless.outfit.summary}</p>
      <p className="slice-muted">本人身份、经历与记忆没有被模板替换；外貌变化没有复制衣物。</p>
      {onCommand && appearanceActions.length > 0 && <div className="magician-action-list" role="group" aria-label="继承外貌与原衣实际操作">
        {appearanceActions.map((action) => <div className="seer-action magician-compact-action" key={action.id}>
          <button className="slice-choice" disabled={busy || blocked || !action.enabled}
            onClick={() => { if (!busy && !blocked && action.enabled) onCommand(action.command); }}>
            <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
          </button>
          {action.reason && <p className="seer-action-reason">{action.reason}</p>}
        </div>)}
      </div>}
    </section>
    {(faceless.story || faceless.supplies) && <details className="seer-fold">
      <summary>原故事与六料批次</summary>{faceless.story && <p>{faceless.story}</p>}{faceless.supplies && <p>{faceless.supplies}</p>}
    </details>}
    {faceless.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>原准备：{entry.preparation}</p>}
      <p>原接触：{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>原结果：{entry.result}</p>}
    </details>)}
    {faceless.formulaKnown && faceless.formula.length > 0 && <details className="seer-fold">
      <summary>无面人时期已知配方</summary>
      <ul className="seer-formula">{faceless.formula.map((material) => <li key={material.name}>
        <span>{material.name}</span><strong>{material.quantity === null ? playerText("原著未给量") : `${material.quantity} ${material.unit}`}</strong>
        {material.note && <small>{material.note}</small>}
      </li>)}</ul>
    </details>}
    {faceless.bottles.length > 0 && <details className="seer-fold">
      <summary>无面人原瓶 · 来源与去向</summary>
      {faceless.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {faceless.abilities.length > 0 && <details className="seer-fold">
      <summary>无面人时期能力记录</summary>
      {faceless.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface MarionettistPanelProps {
  marionettist: MarionettistProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: MarionettistCommand) => void;
}

function isCaseAction(action: MarionettistAction) { return "caseId" in action.command; }
function isRitualAction(action: MarionettistAction) {
  return ["REQUEST_RITUAL", "GO_RITUAL", "BEGIN_SONG", "END_SONG", "RETURN_CLUB"].includes(action.command.type);
}
function isPuppetAction(action: MarionettistAction) {
  return ["BEGIN_CAPTURE", "COMPLETE_CAPTURE", "RELEASE_CONTROL", "PUPPET_DELIVER", "DISMISS_PUPPET", "MOVE_BEYOND_RANGE"].includes(action.command.type);
}

/** Only saved public projections change the world; confirmation preserves the original command. */
export function MarionettistPanel({ marionettist, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: MarionettistPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<MarionettistAction | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null || readOnly;
  const locked = busy || interactionBlocked;
  const confirmationLocked = locked || submittedId !== null;
  const liveConfirmation = confirmation && marionettist.actions.find((action) => action.id === confirmation.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.command));
  const selectedBottleId = confirmation?.command.type === "CONSUME" ? confirmation.command.bottleId : null;
  const selectedBottle = marionettist.bottles.find((bottle) => bottle.id === selectedBottleId);
  const caseActions = marionettist.actions.filter(isCaseAction);
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (marionettist.insideCase ? marionettist.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? marionettist.cases.find((entry) => entry.id === selectedCaseId)
    ?? marionettist.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? marionettist.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const ritualActions = marionettist.actions.filter(isRitualAction);
  const puppetActions = marionettist.actions.filter(isPuppetAction);
  const encounterActions = marionettist.actions.filter((action) => ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT"].includes(action.command.type));
  const growthActions = marionettist.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action)
    && !isRitualAction(action) && !isPuppetAction(action) && !encounterActions.includes(action));
  const nextAction = marionettist.insideCase ? closeAction
    : marionettist.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? marionettist.actions.find((action) => action.enabled && action.command.type === "BEGIN_SONG")
      ?? marionettist.actions.find((action) => action.enabled && ["END_SONG", "RETURN_CLUB"].includes(action.command.type))
      ?? [...puppetActions, ...selectedCaseActions, ...ritualActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? marionettist.actions[0];

  useEffect(() => {
    if (selectedCase && (marionettist.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, marionettist.insideCase]);
  useEffect(() => {
    if (confirmation && ((!liveConfirmation && !busy && error === null) || readOnly
      || (confirmation.command.type === "CONSUME" && (!selectedBottle || marionettist.promoted)))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, liveConfirmation, selectedBottle, marionettist.promoted, busy, error, readOnly]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) actionButtons.current.get(returnActionId.current)?.focus();
  }, [confirmation]);

  function openConfirmation(action: MarionettistAction) {
    if (locked || !action.enabled) return;
    returnActionId.current = action.id; submitted.current = null; setSubmittedId(null); setConfirmation(action);
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled) return;
    submitted.current = confirmation.id; setSubmittedId(confirmation.id);
    onCommand(confirmation.command);
  }
  function actionButton(action: MarionettistAction) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (action.command.type === "COMPLETE_CAPTURE") openConfirmation(action);
          else onCommand(action.command);
        }}
        aria-describedby={action.reason ? `marionettist-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`marionettist-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作，继续同一原操作。"}
  </p>;
  const currentResources = <section aria-label="确认前当前资源">
    <h4>你现在的状态</h4>
    <dl className="seer-facts">
      <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{marionettist.pollution}</dd></div>
      <div><dt>现金</dt><dd>{resources.cash}</dd></div>
      <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
    </dl>
  </section>;

  if (confirmation?.command.type === "CONSUME" && selectedBottle) return <section
    className="seer-panel magician-panel seer-confirmation" aria-label="这瓶秘偶大师魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">在真实现场歌声中，独立确认这一瓶</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p>来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一原瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>原瓶状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{confirmation.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="秘偶大师服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{marionettist.risk}</p></section>
    <section aria-label="服药现场歌声"><h4>当前仪式现场</h4><p>{marionettist.ritual.status}</p><p>{marionettist.ritual.summary}</p></section>
    {currentResources}
    {liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted">确认才耗用这一原瓶，失败也不返还。暂不服用不会停歌或返程；返回卷宗后可实际选择0行动停歌与返程。</p>
    {saveNotice}
  </section>;

  if (confirmation?.command.type === "COMPLETE_CAPTURE") return <section
    className="seer-panel magician-panel seer-confirmation" aria-label="完整秘偶化的不可逆死亡确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">独立确认 · 继续控制仍活着的多恩</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>此人将真正死亡且不可逆</h3>
    <section className="slice-notice seer-risk" aria-label="原人不可逆死亡风险">
      <p>{marionettist.puppet.irreversibleWarning}</p>
      <p>继续约280秒仍可能遭到抗拒或中断，失败也保留已付成本。投降、思维迟缓或受影响的意志，都不等于本人同意。</p>
    </section>
    <p>{marionettist.puppet.summary}</p><p>{marionettist.puppet.body}</p><p>{marionettist.puppet.equipment}</p>
    <p>本次消耗：{confirmation.cost}</p>
    {currentResources}
    {liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>取消，暂不完整转化</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}>
        {busy ? "正在结算并保存…" : "确认不可逆死亡并尝试完整转化"}
      </button>
    </div>
    <p className="slice-muted">取消只关闭本次确认，原初控仍在。返回后可以选择0行动释放活着的多恩；不会自动继续或完成转化。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel magician-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="秘偶大师成长下一步">
      <span className="seer-seal">{marionettist.promoted ? "序列 5" : "秘偶大师晋升卷宗"}</span>
      <h3>{marionettist.title}</h3>
      <p className="seer-next">{readOnly ? "这份卷宗只供回看。" : nextAction
        ? <><strong>{marionettist.insideCase ? "先实际结束本次接触：" : "下一步："}</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "当前没有可执行的成长行动，可回看已保存的经历。"}</p>
      <p className="slice-muted">{marionettist.digestion}</p>
    </section>

    {marionettist.promoted && (marionettist.puppet.targetId !== null || puppetActions.length > 0) && <section className="slice-notice" aria-label="同一原身体与秘偶状态">
      <h3>{marionettist.puppet.title}</h3><p>{marionettist.puppet.status}</p><p>{marionettist.puppet.summary}</p>
      <dl className="seer-facts">
        <div><dt>原身体编号</dt><dd>{marionettist.puppet.targetId ?? "尚无已结算原身体"}</dd></div>
        <div><dt>本人生命状态</dt><dd>{marionettist.puppet.alive === null ? "尚无已结算记录" : marionettist.puppet.alive ? "仍然活着" : "真正死亡，不可逆"}</dd></div>
        <div><dt>实际控制时间</dt><dd>{marionettist.puppet.elapsedSeconds} 秒</dd></div>
        <div><dt>完整秘偶控制</dt><dd>{marionettist.puppet.active ? "同一原身体仍在控制中" : "没有有效完整秘偶控制"}</dd></div>
      </dl>
      <p>{marionettist.puppet.body}</p><p>{marionettist.puppet.equipment}</p><p>{marionettist.puppet.distance}</p>
      <section aria-label="同一原信的实际去向"><h4>原信与真实递送</h4><p>{marionettist.puppet.note}</p></section>
      {puppetActions.length > 0 && <div className="magician-action-list" role="group" aria-label="原现场控制与真实秘偶行动">{puppetActions.map(actionButton)}</div>}
      {marionettist.puppet.alive && <p className="seer-risk">初控期间原人仍能抵抗。完整转化将使本人真正死亡且不可逆，必须另行明确确认；受影响的意志不等于同意。</p>}
      <details className="seer-fold"><summary>容量、范围与原身体限制</summary><p>{marionettist.puppet.source}</p><p>{marionettist.puppet.irreversibleWarning}</p></details>
    </section>}

    {marionettist.discovered && (marionettist.formulaKnown || marionettist.ritual.visits > 0) && <section className="slice-notice" aria-label="真实美人鱼歌声仪式">
      <h4>预约与海岸现场</h4><p>{marionettist.ritual.status}</p><p>{marionettist.ritual.summary}</p>
      <dl className="seer-facts">
        <div><dt>当前位置</dt><dd>{marionettist.ritual.location === "COAST" ? "海岸水湾现场" : "占卜俱乐部"}</dd></div>
        <div><dt>现场歌声</dt><dd>{marionettist.ritual.singing ? "正在现场歌唱" : "当前没有现场歌声"}</dd></div>
        <div><dt>实际到访</dt><dd>{marionettist.ritual.visits} 次</dd></div>
        <div><dt>实际服用</dt><dd>{marionettist.ritual.consumptions} 瓶</dd></div>
      </dl>
      {ritualActions.length > 0 && <div className="magician-action-list" role="group" aria-label="仪式出行与实际停歌返程">{ritualActions.map(actionButton)}</div>}
      <details className="seer-fold"><summary>歌声与行程的条件</summary><p>{marionettist.ritual.source}</p></details>
    </section>}

    {selectedCase && <section aria-label="秘偶大师有限和平实践">
      <h3>灵体之线与实际释放</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={locked || marionettist.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {marionettist.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前秘偶大师实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">{selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.observations.length > 0 && <section aria-label="现场观察与本人意愿"><h4>实际观察</h4>
          <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
        </section>}
        <p>{selectedCase.preparation || "尚无待执行的准备；选定方法不会提前施术。"}</p>
        {selectedCase.result && <section className="slice-notice" aria-label="秘偶大师实际实践结果" aria-live="polite"><h4>实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前秘偶大师实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">和平练习不会制造秘偶。实际释放与结束接触为0行动，不退款、不治疗，也不抹去失败。受影响的意志不等于本人同意。</p>
      </section>
    </section>}

    {encounterActions.length > 0 && <section aria-label="秘偶大师真实冲突"><h3>现场争议</h3>
      {marionettist.environment && <p>{marionettist.environment}</p>}
      <div className="magician-action-list">{encounterActions.map(actionButton)}</div>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="秘偶大师成长行动">{growthActions.map(actionButton)}</div>}
    {marionettist.discovered && marionettist.supplies && <section className="slice-notice" aria-label="秘偶大师实际六料与批次"><h4>实际六料与独立批次</h4><p>{marionettist.supplies}</p></section>}
    {marionettist.formulaKnown && marionettist.formula.length > 0 && <details className="seer-fold" aria-label="秘偶大师已知配方">
      <summary>查看已知秘偶大师配方 · {marionettist.formula.length} 种材料</summary>
      <ul className="seer-formula">{marionettist.formula.map((material) => <li key={material.name}>
        <span>{material.name}</span><strong>{material.quantity === null ? playerText("原著未给量") : `${material.quantity} ${material.unit}`}</strong>
        {material.note && <small>{material.note}</small>}
      </li>)}</ul>
      <p className="slice-muted">{playerText("未核实的用量保留未知，G供货份数另行标明。领取同批六料、调配原瓶、预约出行和现场确认服用是分别提交的步骤。")}</p>
    </details>}
    {marionettist.discovered && marionettist.bottles.length > 0 && <details className="seer-fold" open={!marionettist.promoted}>
      <summary>秘偶大师独立原瓶 · 来源与去向</summary>
      {marionettist.bottles.map((bottle) => {
        const action = marionettist.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !readOnly && <div>
            <button className="slice-button" disabled={locked || !action.enabled} onClick={() => openConfirmation(action)}
              ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}>
              查看并准备服用「{bottle.title}」
            </button>
            <p className="seer-small-note">{action.cost}</p>{action.reason && <p className="seer-action-reason">{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {marionettist.discovered && !marionettist.promoted && <details className="seer-fold"><summary>服用风险与四档结果</summary><p>{marionettist.risk}</p></details>}
    {marionettist.promoted && <section aria-label="秘偶大师能力与消化">
      <h3>能力与消化 · {marionettist.abilities.length} 项掌握记录</h3>
      <p>扮演进度 {marionettist.acting} · 消化：{marionettist.digestion}</p>
      {marionettist.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {marionettist.story && <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary><p>{marionettist.story}</p></details>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
