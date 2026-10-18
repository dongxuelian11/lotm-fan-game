import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PunishmentKnightAction, PunishmentKnightCommand, PunishmentKnightProjection } from "../domain/punishment-knight/types";
import type { JudgeProjection } from "../domain/judge/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次现场", OBSERVED: "已有公开观察与现场边界", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，请完成收束再报告", RESOLVED: "已实际收束并提交有限报告",
};
const PAD_LABELS = {
  STAND: "同一原软靶 PK5-SOFT-PAD-1 在原架上",
  MAT: "同一原软靶 PK5-SOFT-PAD-1 已实际落在原软垫上，尚未归架",
} as const;
const PARTNER_LABELS = {
  FREE: "原成年阿伦可自由行动，没有尚在生效的禁锢",
  HELD: "原成年阿伦正处于本次自愿短时停步，尚须实际解除并返回",
} as const;
const RULE_LABELS = {
  NONE: "当前没有生效的训练宣告；原标线是否已收回，以本次实际结束记录为准",
  DECLARED: "本次弱化训练宣告已提出，尚无实际越线记录",
  BREACHED: "阿伦已先实际越过原标线 PK5-LINE-1，本次宣告尚须结束并收回原线",
} as const;
const NOTE_LABELS = {
  BLANK: "同一原记录纸 PK5-NOTE-1 尚未写本次记录",
  WRITTEN: "同一原记录纸 PK5-NOTE-1 已写，尚未实际交回",
  HANDED_OVER: "同一原记录纸 PK5-NOTE-1 已实际交回薇娜·贝尔",
} as const;
const OLD_AUDIENCE_LABELS = { READY: "原自愿谈话尚未开始", ADDRESSED: "原谈话已提出请求，尚未结束", ATTENTIVE: "当时已获得短暂注意，尚未结束", FREE: "原谈话与短暂影响已结束，当事人可自由离开" } as const;
const OLD_BOUNDARY_LABELS = { CLEAR: "双方尚未实际尝试跨原标线", ATTEMPTED: "双方已实际尝试，未形成有效限制", HELD: "双方已实际尝试，均停留在原标线内", RELEASED: "原标线限制已实际撤回，双方可自由跨越" } as const;
const OLD_TOKEN_LABELS = { ON_TABLE: "同一原木牌仍在原台", OUTSIDE_TABLE: "同一原木牌已带出台域，尚未放回", HELD_ON_TABLE: "双方已实际尝试，同一原木牌仍在原台域", RETURNED: "同一原木牌已实际放回原台，本次限制已撤回" } as const;

/** S6 history has no replay controls and keeps original observations and consequences. */
export function PunishmentKnightJudgeHistory({ judge, currentTitle = "惩戒骑士（序列5）" }: { judge: JudgeProjection; currentTitle?: string }) {
  return <section className="seer-panel punishmentKnight-panel" aria-label="法官时期的经历">
    <h3>法官时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留法官时期的原故事、双方实试、原标线、同一原木牌、失败与独立原瓶，只供回看。</p>
    <p>法官扮演进度 {judge.acting} · 消化：{judge.digestion}</p>
    {judge.story && <p>{judge.story}</p>}
    {judge.environment && <p>{judge.environment}</p>}
    {judge.supplies && <p>{judge.supplies}</p>}
    <details className="seer-fold" aria-label="法官原现场记录"><summary>原谈话、原标线与同一原木牌</summary>
      <dl className="seer-facts">
        <div><dt>原谈话</dt><dd>{OLD_AUDIENCE_LABELS[judge.practice.audience]}</dd></div>
        <div><dt>原标线</dt><dd>{OLD_BOUNDARY_LABELS[judge.practice.boundary]}</dd></div>
        <div><dt>同一原木牌</dt><dd>{OLD_TOKEN_LABELS[judge.practice.token]}</dd></div>
        <div><dt>原跨线测试</dt><dd>{judge.practice.lineTestedBy === "BOTH" ? "玩家与当事人双方均已实际尝试" : "双方尚未实际尝试"}</dd></div>
        <div><dt>原带牌测试</dt><dd>{judge.practice.tokenTestedBy === "BOTH" ? "玩家与当事人双方均已实际尝试" : "双方尚未实际尝试"}</dd></div>
        <div><dt>原污染记录</dt><dd>{judge.pollution}</dd></div>
      </dl>
    </details>
    {judge.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {judge.bottles.length > 0 && <details className="seer-fold"><summary>法官原瓶 · 来源与去向</summary>
      {judge.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {judge.risk && <details className="seer-fold"><summary>法官原服用风险</summary><p>{judge.risk}</p></details>}
    {judge.abilities.length > 0 && <details className="seer-fold"><summary>法官时期能力记录</summary>
      {judge.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">回看不重做旧实践、重发奖励或撤销旧伤势；埃文冲突的实际后果继续保留。原法官禁令的旧记录不被本阶段规则改写。</p>
  </section>;
}

export interface PunishmentKnightPanelProps {
  punishmentKnight: PunishmentKnightProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: PunishmentKnightCommand) => void;
}
function isCaseAction(action: PunishmentKnightAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: PunishmentKnightAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function allowedCaseAction(action: PunishmentKnightAction): boolean {
  return action.command.type !== "PREPARE" || action.command.caseId !== "wound-record" || action.command.method === "ORDINARY";
}

/** Selection changes only local focus; every result and resource comes from the saved projection. */
export function PunishmentKnightPanel({ punishmentKnight, resources, busy, blocked = false, error = null, onCommand }: PunishmentKnightPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = punishmentKnight.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = punishmentKnight.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = punishmentKnight.actions.filter(isCaseAction).filter(allowedCaseAction);
  // An explicit public CLOSE identifies the current contact; old prose never does.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const insidePractice = punishmentKnight.insideCase || !!closeAction || punishmentKnight.practice.pad === "MAT"
    || punishmentKnight.practice.partner === "HELD" || punishmentKnight.practice.rule !== "NONE" || punishmentKnight.practice.note === "WRITTEN";
  const selectedCase = (insidePractice ? punishmentKnight.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? punishmentKnight.cases.find((entry) => entry.id === selectedCaseId)
    ?? punishmentKnight.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? punishmentKnight.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command
    && action.command.caseId === selectedCase.id && (!insidePractice || action.command.type === "CLOSE")) : [];
  const encounterActions = insidePractice ? [] : punishmentKnight.actions.filter(isEncounterAction);
  const growthActions = insidePractice ? [] : punishmentKnight.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = insidePractice ? closeAction : !punishmentKnight.promoted
    ? punishmentKnight.actions.find((action) => action.command.type === "CONSUME" && action.enabled) ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0] ?? encounterActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !punishmentKnight.promoted && !insidePractice;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (insidePractice || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, insidePractice]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || punishmentKnight.promoted || insidePractice)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, punishmentKnight.promoted, insidePractice]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: PunishmentKnightAction) {
    if (busy || interactionBlocked || insidePractice || punishmentKnight.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || punishmentKnight.promoted || insidePractice) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: PunishmentKnightAction) {
    const unavailable = insidePractice && action.command.type !== "CLOSE";
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className={insidePractice ? "slice-choice primary" : "slice-choice"} disabled={busy || interactionBlocked || unavailable || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || unavailable || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `punishmentKnight-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`punishmentKnight-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel punishmentKnight-panel seer-confirmation" aria-label="这瓶惩戒骑士魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); } }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方与6→5晋升仪式细节仍待核实；本次只确认本作原创G导师准备与指导流程中的这一成品原瓶，不表示原著无需仪式。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="惩戒骑士服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{punishmentKnight.risk}</p></section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{punishmentKnight.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="punishmentKnight-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "punishmentKnight-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。晋升后灵性上限100，不补满当前灵性。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel punishmentKnight-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="惩戒骑士成长下一步">
      <span className="seer-seal">{punishmentKnight.promoted ? "序列 5" : "惩戒骑士晋升卷宗"}</span><h3>{punishmentKnight.title}</h3>
      <p className="seer-next">{insidePractice
        ? <><strong>先实际收束本次实践：</strong>{nextAction?.label || "查看当前公开的结束实践选项"}。结束为0行动、0精神、0灵性，保留本次结果与已付成本。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : punishmentKnight.promoted && punishmentKnight.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{punishmentKnight.digestion}</p>
    </section>
    {punishmentKnight.promoted && punishmentKnight.environment && <section aria-label="当前惩戒骑士现场"><h4>当前现场</h4><p>{punishmentKnight.environment}</p></section>}
    {punishmentKnight.promoted && <section aria-label="已保存的原软靶、阿伦、原标线与原纸状态">
      <h4>当前公开现场</h4>
      <dl className="seer-facts">
        <div><dt>同一原软靶</dt><dd>{PAD_LABELS[punishmentKnight.practice.pad]}</dd></div>
        <div><dt>原成年阿伦</dt><dd>{PARTNER_LABELS[punishmentKnight.practice.partner]}</dd></div>
        <div><dt>本次训练宣告</dt><dd>{RULE_LABELS[punishmentKnight.practice.rule]}</dd></div>
        <div><dt>原记录纸</dt><dd>{NOTE_LABELS[punishmentKnight.practice.note]}</dd></div>
      </dl>
      <p className="slice-muted">{playerText("只显示已保存的实际状态。这里是本作G原创调解处安全练习室；薇娜·贝尔是民间调解文书员，阿伦是自愿参加的成年递件员。晋升不授予官方身份，也不把训练宣告变成法律或定罪。")}</p>
    </section>}
    {selectedCase && <section aria-label="惩戒骑士有限实践">
      <h3>原软靶惩戒、一次自愿停步与伤势记录</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || insidePractice} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {punishmentKnight.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前惩戒骑士实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对同一原软靶、原标线、成年当事人的本次许可与净空现场；记录只引用实际可见结果。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前认定越线、击落原软靶、禁锢阿伦或写好记录。"}</p>
        </section>
        {selectedCase.id === "breach-and-pad" && <p className="slice-muted">{playerText("先说明约定，再由阿伦自愿实际越过原标线 PK5-LINE-1，薇娜当场观察；不是仅凭计划、指控或宣告认定违规。本次刻意弱化的训练宣告不是绝对屏障，阿伦保留自己的选择。随后仅向同一原软靶 PK5-SOFT-PAD-1 尝试有限惩戒，绝不击打阿伦：执行1行动、3灵性、知识14，失败仍付费。普通方法以知识12作普通软靶测试，0灵性，没有神秘宣告或惩戒。弱化宣告、惩戒用于安全物体的范围与数值均是G原创适配。结束时实际将原软靶归架、收回原标线并结束本次宣告；不制造真人伤势。")}</p>}
        {selectedCase.id === "willing-pause" && <p className="slice-muted">原成年阿伦只同意本次短时停步，先约定停止口令，可要求立即结束。能力执行1行动、3灵性、知识14，可能失败；普通方法以知识10作正常口头停步，0灵性，不算禁锢成功。结束时实际解除影响，再让阿伦沿原净空短路正常返回并可自由离开；这不是心智控制，也不是永久许可。</p>}
        {selectedCase.id === "wound-record" && <p className="slice-muted">只提供普通方法：执行1行动、0灵性、知识10，在同一原纸 PK5-NOTE-1 写下先前实际记录的伤势，或明确写“未观察到伤势”。不需要先战斗，不推断隐藏伤口，也不为训练制造伤势；这不算伤势裁决能力实践。失败文字也保留，结束时把这张原纸实际交回薇娜·贝尔，再提交报告。</p>}
        {selectedCase.result && <section className="slice-notice" aria-label="惩戒骑士实际结果" aria-live="polite" aria-atomic="true"><h4>本次实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前惩戒骑士实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {insidePractice && <p className="slice-muted">先用当前公开结束选项将同一原软靶归架并收回原标线、结束宣告，实际解除阿伦的禁锢并完成正常返回，或交回同一原纸，再报告或做其它事。结束耗0行动、0精神、0灵性，零剩余行动、精神与灵性仍可执行；不另抽结果、不退款、不治疗、不抹去失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="惩戒骑士成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="惩戒骑士有限冲突">
      <h3>有限现场冲突</h3>
      <p>原成年迪恩持自己的普通短棍，位于日光下的净空外院，相距2米，没有旁人；原出口可实际退出，对方不追击。可以交涉，战斗有真实伤亡风险。</p>
      <p>{playerText("本阶段G禁令花费3灵性，针对本轮敌我双方的下一次身体近击进行一次实际抵抗判定，判定后该次禁令结束；自己的近击同样受限。只有对方实际突破规则并打出正值打击后，才留下本轮有限惩戒依据，后续惩戒另需3灵性，不保证命中、破防或免除伤势。")}</p>
      <p>禁锢尝试花费3灵性，成功后只降低本轮下一次实际正值敌方普通打击；落空、空当或已被禁令挡住的动作不消耗该次禁锢。待生效时不重复施用，轮末失效。伤势裁决须目标仍存活且已有实际记录伤势，尝试耗3灵性并可能失败；没有合格伤势或灵性不足时回退普通动作，不是“一句话必死”，不凭玩家自身伤势执行对敌裁决。</p>
      <div className="magician-action-list" role="group" aria-label="惩戒骑士冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {punishmentKnight.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{punishmentKnight.story}</p></details>}
    {punishmentKnight.discovered && <details className="seer-fold" aria-label="惩戒骑士成品来源与配方边界">
      <summary>成品来源、费用与配方边界</summary>
      <p>{playerText("须完成法官消化100与十二个完整序列6周。G指导460便士；每瓶4800便士，或5步劳务抵扣4200便士后付600便士。三瓶独立成品分别取得、逐瓶确认，按意志26四档结算；失败仍耗用原瓶，后续补货须实际跨周取得。")}</p>
      <p>{playerText("完整配方、材料与6→5晋升仪式细节尚未核实；这里只提供有来源的G独立成品与导师准备，不解锁调配，也不宣称原著无需仪式。晋升须先结束旧法官接触；健康须高于20、精神须高于40，成功后四属性各加1、灵性上限100，但不补满。")}</p>
      {punishmentKnight.supplies && <p>{punishmentKnight.supplies}</p>}
    </details>}
    {punishmentKnight.discovered && punishmentKnight.bottles.length > 0 && <details className="seer-fold" open={!punishmentKnight.promoted}>
      <summary>惩戒骑士独立成品原瓶 · 来源与去向</summary>
      {punishmentKnight.bottles.map((bottle) => {
        const action = punishmentKnight.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !punishmentKnight.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !punishmentKnight.promoted && !insidePractice && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `punishmentKnight-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`punishmentKnight-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {punishmentKnight.discovered && !punishmentKnight.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{punishmentKnight.risk}</p></details>}
    {punishmentKnight.promoted && <section aria-label="惩戒骑士能力与消化">
      <h3>能力与消化 · {punishmentKnight.abilities.length} 项训练记录</h3>
      <p>扮演进度 {punishmentKnight.acting} · 消化：{punishmentKnight.digestion}</p>
      <progress className="cryptologist-progress" aria-label="惩戒骑士扮演进度" value={punishmentKnight.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {punishmentKnight.pollution}</p>
      {punishmentKnight.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <details className="seer-fold" aria-label="惩戒骑士能力与来源边界"><summary>查看惩戒、禁锢与伤势裁决边界</summary>
        <p>本序列新增惩戒、禁锢与伤势裁决的独立掌握，保留仲裁人、治安官、审讯者和法官的原能力与实际掌握。惩戒须有实际触发依据，宣告不是自动定罪；禁锢可能失败或被抵抗，不取消自由意志。</p>
        <p>伤势裁决须有当前目标实际记录的既存伤势，不能凭一句判词必杀、无伤制造伤口或使用玩家伤势代替目标伤势。实战结果仍经过共同战斗后果结算；普通伤势记录不会获得伤势裁决掌握。</p>
        <p>观察、准备、执行与报告各耗1行动；前两项能力执行各耗3灵性，普通方法0灵性。撤回未执行的准备与实际结束均为0行动；重复试验须重新取得当事人的本次许可。</p>
        <p>{playerText("三项报告各25扮演，反思25。全部普通方法也可完成这条原创G和平成长线；仅前两项真实成功的能力报告获得8点知识池掌握，随机分配到已知能力，不保证新能力增长。普通方法不冒充能力成功。")}</p>
        <p>{playerText("后续序列4律令法师的能力剥夺尚未开放；本作有限训练、战斗时序与数值是G原创适配，不代表原著固定范围、时长或通用绝对命令。晋升不授予官方身份，现场实践也不能证明当事人有罪。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
