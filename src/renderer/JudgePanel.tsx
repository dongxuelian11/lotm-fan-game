import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { JudgeAction, JudgeCommand, JudgeProjection } from "../domain/judge/types";
import type { InterrogatorProjection } from "../domain/interrogator/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次现场", OBSERVED: "已有普通观察与现场边界", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，请核对退出与现实证据", RESOLVED: "已退出并提交本次有限报告",
};
const AUDIENCE_LABELS = {
  READY: "自愿谈话尚未实际开始", ADDRESSED: "已经实际提出请求，本次谈话尚未结束",
  ATTENTIVE: "本次已实际获得短暂注意，谈话尚未结束", FREE: "本次谈话与短暂影响已结束，当事人可自由离开",
} as const;
const BOUNDARY_LABELS = {
  CLEAR: "原标线仍在，双方尚未实际尝试跨越", ATTEMPTED: "双方已实际尝试跨线，本次未形成有效限制，仍需结束",
  HELD: "双方已实际尝试跨线，本次均停留在原标线内", RELEASED: "本次限制已实际撤回，原标线仍在，双方可自由跨越",
} as const;
const TOKEN_LABELS = {
  ON_TABLE: "同一原木牌仍在原台，尚未实际尝试带出", OUTSIDE_TABLE: "同一原木牌已带出台域，仍由实际持牌者持有，尚未放回",
  HELD_ON_TABLE: "双方已实际尝试，同一原木牌仍在原台域内", RETURNED: "同一原木牌已安全放回原台，本次限制已实际撤回",
} as const;

/** Original S7 accounts, choices, failures and independent bottles remain read-only. */
export function JudgeInterrogatorHistory({ interrogator }: { interrogator: InterrogatorProjection }) {
  return <section className="seer-panel interrogator-panel" aria-label="审讯者时期的经历">
    <h3>审讯者时期的经历</h3>
    <p className="slice-notice">你已晋升法官（序列6）。这里保留审讯者时期的原故事、原陈述、矛盾、当事人撤回、实际结束、失败和独立原瓶，只供回看。</p>
    <p>审讯者扮演进度 {interrogator.acting} · 消化：{interrogator.digestion}</p>
    {(interrogator.story || interrogator.environment || interrogator.supplies) && <details className="seer-fold">
      <summary>审讯者原故事与供给</summary>
      {interrogator.story && <p>{interrogator.story}</p>}{interrogator.environment && <p>{interrogator.environment}</p>}{interrogator.supplies && <p>{interrogator.supplies}</p>}
    </details>}
    {interrogator.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status === "RESOLVED" ? "已收束并提交原报告" : entry.status === "EXAMINED" ? "原检验结果保留" : "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen}</p><p>当时实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {interrogator.bottles.length > 0 && <details className="seer-fold">
      <summary>审讯者原瓶 · 来源与去向</summary>
      {interrogator.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {interrogator.abilities.length > 0 && <details className="seer-fold">
      <summary>审讯者时期能力记录</summary>
      {interrogator.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface JudgePanelProps {
  judge: JudgeProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: JudgeCommand) => void;
}
function isCaseAction(action: JudgeAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: JudgeAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Display committed public facts; preparing or submitting never applies an effect locally. */
export function JudgePanel({ judge, resources, busy, blocked = false, error = null, onCommand }: JudgePanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = judge.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = judge.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = judge.actions.filter(isCaseAction);
  // Only a projected CLOSE intent identifies the actual open scene, never historical prose.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (judge.insideCase ? judge.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? judge.cases.find((entry) => entry.id === selectedCaseId)
    ?? judge.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? judge.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!judge.insideCase || action.command.type === "CLOSE")) : [];
  const encounterActions = judge.insideCase ? [] : judge.actions.filter(isEncounterAction);
  const growthActions = judge.insideCase ? [] : judge.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = judge.insideCase ? closeAction : !judge.promoted
    ? judge.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !judge.promoted && !judge.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (judge.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, judge.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || judge.promoted || judge.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, judge.promoted, judge.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: JudgeAction) {
    if (busy || interactionBlocked || judge.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || judge.promoted || judge.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: JudgeAction) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `judge-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`judge-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel judge-panel seer-confirmation" aria-label="这瓶法官魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="法官服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{judge.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{judge.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="judge-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "judge-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel judge-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="法官成长下一步">
      <span className="seer-seal">{judge.promoted ? "序列 6" : "法官晋升卷宗"}</span>
      <h3>{judge.title}</h3>
      <p className="seer-next">{judge.insideCase
        ? <><strong>先结束本次实践，回到生活：</strong>{nextAction?.label || "查看当前公开的结束实践选项"}。结束为0行动、0精神、0灵性；保留本次结果、失败与消耗。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : judge.promoted && judge.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{judge.digestion}</p>
      {!judge.promoted && <p className="slice-muted">{playerText("须完成审讯者消化100与十二个完整序列7周。G指导360便士；每瓶3320便士，或5步劳务抵扣3000便士后付320便士。三瓶独立成品分别取得、逐瓶确认，按意志24四档结算；失败仍耗用原瓶，实际排异与污染保留，可休养后另取独立原瓶重试。准备期间可继续普通生活与休养。")}</p>}
      {!judge.promoted && <p className="slice-muted">{playerText("完整晋升配方、材料与剂量尚未核实；这里只提供有来源的G独立成品，不展示虚构材料或开放晋升魔药调配。")}</p>}
    </section>
    {judge.promoted && judge.environment && <section aria-label="当前法官现场"><h4>当前现场</h4><p>{judge.environment}</p></section>}
    {judge.promoted && <section className="slice-notice" aria-label="当前自愿谈话、原标线与原木牌">
      <h3>当前公开现场</h3>
      <p>当前自愿谈话：{AUDIENCE_LABELS[judge.practice.audience]}</p>
      <p>当前原标线：{BOUNDARY_LABELS[judge.practice.boundary]}</p>
      <p>当前原木牌：{TOKEN_LABELS[judge.practice.token]}</p>
      <p>实际跨线测试：{judge.practice.lineTestedBy === "BOTH" ? "玩家与当事人双方均已实际尝试" : "双方尚未实际尝试"}</p>
      <p>实际带牌测试：{judge.practice.tokenTestedBy === "BOTH" ? "玩家与当事人双方均已实际尝试" : "双方尚未实际尝试"}</p>
      <p className="slice-muted">只显示已保存的现场事实；当事人的注意不等于真话。普通配合与有限能力的实际结果分别记录，威严与禁令可能失败或被抵抗，仍须实际结束并撤回影响。</p>
    </section>}
    {selectedCase && <section aria-label="法官有限实践">
      <h3>自愿注意与双方同受限的现场禁行</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || judge.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {judge.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前法官实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对自愿谈话、原标线、同一原木牌与原台域，确认双方实际试动作和退出边界。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前获得注意、触发跨线限制或移动原木牌；只有实际执行才记录双方试动作与有限结果。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="法官实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前法官实践行动">{selectedCaseActions.map((action) => actionButton(action))}</div>}
        {judge.insideCase && <p className="slice-muted">先用当前“结束实践”选项退开并停止威严、撤回原标线禁行，或把同一原木牌安全放回原台并撤回限制，再回到生活或提交报告。即使0行动、0精神、0灵性或本次尝试失败，也可实际结束；不另抽随机、不奖励、不退款、不治疗，不抹去失败或抵抗。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="法官成长行动">{growthActions.map((action) => actionButton(action))}</div>}
    {encounterActions.length > 0 && <section aria-label="法官有限冲突">
      <h3>有限现场冲突</h3><p className="slice-muted">{playerText("只按当前公开现场交涉或承担冲突；已有出口仍可实际退出，这里不追击。当前G战斗禁令只限制本轮余下的身体近击，敌我双方同受约束，本轮结束时解除；不取消整个行动槽或其它技能，不追溯已经结算的动作。禁令可能失败或被抵抗，真实伤势和原成本继续保留。")}</p>
      <div className="magician-action-list" role="group" aria-label="法官冲突行动">{encounterActions.map((action) => actionButton(action))}</div>
    </section>}
    {judge.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{judge.story}</p></details>}
    {judge.discovered && judge.supplies && <section className="slice-notice" aria-label="法官成品来源与取得"><h4>实际供给与独立原瓶</h4><p>{judge.supplies}</p></section>}
    {judge.discovered && judge.bottles.length > 0 && <details className="seer-fold" open={!judge.promoted}>
      <summary>法官独立成品原瓶 · 来源与去向</summary>
      {judge.bottles.map((bottle) => {
        const action = judge.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !judge.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !judge.promoted && !judge.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `judge-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`judge-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {judge.discovered && !judge.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{judge.risk}</p></details>}
    {judge.promoted && <section aria-label="法官能力与消化">
      <h3>能力与消化 · {judge.abilities.length} 项训练记录</h3>
      <p>扮演进度 {judge.acting} · 消化：{judge.digestion}</p>
      <progress className="cryptologist-progress" aria-label="法官扮演进度" value={judge.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {judge.pollution}</p>
      {judge.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="法官实践与能力边界">
        <summary>查看有限威严、禁令与继承能力边界</summary>
        <p>本序列新增威严与有限禁令的独立掌握，继承七项原能力。威严只争取自愿现场的短暂注意，不保证服从、真话或补全未知事实；禁令须针对已公开的现场、对象与动作，可能失败或被抵抗。</p>
        <p>原标线实践须由玩家与当事人双方实际尝试跨越，双方同受本次限制；原木牌实践只针对同一原木牌离开原台域的动作，须由双方分别实际尝试，不能仅凭宣告认定生效。原标线、原台与物品产权不被改写，晋升不授予官方身份。</p>
        <p>准备不等于已经实施。实际执行、结束撤回与有限报告分别记录；结束时须停止影响，让当事人自由离开，将同一原木牌安全放回原台。普通方法保留，不额外耗灵性；能力方法按当前公开成本支付真实资源。</p>
        <p>{playerText("当前G战斗禁令只约束本轮余下的身体近击，敌我双方同受约束，本轮结束时解除；不取消行动槽或其它技能，不追溯已结算的动作。这里不提供永久封禁，也不提前开放序列5惩戒。")}</p>
        <p>{playerText("结束实践0行动、0精神、0灵性，已付成本、失败、抵抗与旧陈述全部保留，不治疗或返还资源。三项实践、场地、数值和和平消化为本作G原创适配；实际注意与停止动作都不能证明对方有罪，实践成功也不保证战斗成功。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
