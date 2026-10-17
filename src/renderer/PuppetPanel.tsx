import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PuppetAction, PuppetCommand, PuppetProjection } from "../domain/puppet/types";
import type { WraithProjection } from "../domain/wraith/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已有公开观察与当次许可", PREPARED: "已准备，尚须实际执行",
  ACTIVE: "本次身体或接触仍未收束", EXAMINED: "已有本次结果，待真实收束与报告", RESOLVED: "已提交有限报告",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const ENCOUNTER_TYPES = ["PURCHASE_BLOCKS", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"];
const CLEANUP_TYPES = ["RETURN_ROUTE", "RETURN_FORM_ROUTE", "RESTORE_FORM", "CLOSE", "WITHDRAW"];
const NEXT_CASE_TYPES = ["RETURN_ROUTE", "RETURN_FORM_ROUTE", "RESTORE_FORM", "FORM_TRIAL", "PERFORM", "CLOSE", "REPORT", "PREPARE", "OBSERVE"];

/** Old bodies, hosts, mirrors, objects and moon costs remain read-only historical facts. */
export function PuppetWraithHistory({ wraith: value }: { wraith: WraithProjection }) {
  const form = { HUMAN: "本人已显现为人形", WRAITH: "本人当时处于怨魂形态" };
  const node = { ROOM: "原工坊室内（ROOM）", ALCOVE: "四米外原壁龛（ALCOVE）" };
  return <section className="seer-panel warrior-panel" aria-label="怨魂时期的经历"><h3>怨魂时期的经历</h3>
    <p className="slice-notice">这里保留原哈伦·维斯、原成年诺兰、原镜面、WF5-FLAG-1信号旗、WF5-NOTE-1记录纸、独立原瓶与失败结果，只供回看。原贝文的冲突结果不重开，旧身体与宿主不复制。</p>
    <p>怨魂扮演进度 {value.acting} · 消化：{value.digestion}</p>
    <section aria-label="怨魂原身体镜面与物件"><h4>原身体、原宿主与原物</h4>
      <dl className="seer-facts"><div><dt>原身体与原位置</dt><dd>{form[value.practice.form]} · {node[value.practice.node]}</dd></div>
        <div><dt>原反射端点</dt><dd>{value.practice.mirror === "COVERED" ? "原两面镜均已盖好" : "原两面镜当时仍揭开"}</dd></div>
        <div><dt>原宿主</dt><dd>{value.practice.host === "SELF" ? "本人未附在诺兰身上" : "本人当时仍附在原诺兰身上"}</dd></div>
        <div><dt>原信号旗 WF5-FLAG-1</dt><dd>{value.practice.flag === "TABLE" ? "同一原旗在原桌上" : "同一原旗当时仍举起"}</dd></div>
        <div><dt>原记录纸 WF5-NOTE-1</dt><dd>{value.practice.note === "HANDED_OVER" ? "同一原纸已实际交回" : value.practice.note === "WRITTEN" ? "同一原纸已写，尚未交回" : "同一原纸尚未填写"}</dd></div></dl>
    </section>
    {value.cases.map(entry => <details className="seer-fold" key={entry.id}><summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold" aria-label="怨魂原月圆记录"><summary>怨魂原月圆记录 · 仅供回看</summary><p>{value.moon.summary}</p>
      <p>原记录状态：{value.moon.pending ? "当时尚待处理" : "当时已无待处理发作"}。木偶阶段不会再次收取怨魂、活尸或狼人旧阶段的月圆代价。</p>
      {value.moon.history.map((entry, index) => <p key={`${entry.week}-${index}`}>第{entry.week}周 · {entry.method === "GUARDED" ? "原哈伦工坊看守过夜" : "原地点独自过夜"} · 原实际精神消耗{entry.mentalCost}</p>)}
    </details>
    {value.battle && <details className="seer-fold"><summary>原贝文现场的原附身记录</summary><p>原附身回合：{value.battle.lastPossessionRound ?? "尚未实际附身"} · 原迟疑：{value.battle.staggerReady ? "原记录尚在" : "已结束或尚未产生"}。只能回看，不能转给新埃德林。</p></details>}
    <details className="seer-fold"><summary>怨魂原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>
    <details className="seer-fold"><summary>怨魂原能力与故事</summary>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      {value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p></details>
    <p className="slice-muted">晋升不重新结算旧实践，不返还已付成本，不刷新原旗、原纸、原药瓶或原对手。旧阶段全部月圆历史与能力掌握继续保留。</p>
  </section>;
}

export interface PuppetPanelProps {
  puppet: PuppetProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: PuppetCommand) => void;
  readOnly?: boolean;
}
type Confirmation = { action: PuppetAction; contextKey: string };

function PracticeFacts({ practice }: { practice: NonNullable<PuppetProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="木偶本次原物身体与联系" aria-live="polite" aria-atomic="true"><h4>同一原物与实际身体</h4>
    <dl className="seer-facts"><div><dt>同一原木片</dt><dd>{practice.token}</dd></div>
      <div><dt>本人当前身体</dt><dd>{practice.body}</dd></div><div><dt>两种实际形态试验</dt><dd>{practice.forms}</dd></div>
      <div><dt>本次有限联系</dt><dd>{practice.link}</dd></div><div><dt>诺兰本人的当次同意</dt><dd>{practice.consent}</dd></div>
      <div><dt>本人实际路线</dt><dd>{practice.route}</dd></div><div><dt>同一原记录纸</dt><dd>{practice.note}</dd></div></dl>
    {practice.history.length > 0 && <details className="seer-fold"><summary>实际移动、变形与联系记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

/** Only local selection and review state live here. Resource, material and scene changes require committed projections. */
export function PuppetPanel({ puppet: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: PuppetPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const lastSelectedCase = useRef<{ id: string; status: string } | null>(null);
  const locked = busy || blocked || error !== null || readOnly;
  const confirmationLocked = locked || submittedId !== null;
  const caseActions = value.actions.filter((action) => "caseId" in action.command);
  const sceneAction = caseActions.find((action) => action.enabled && CLEANUP_TYPES.includes(action.command.type))
    ?? caseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const activeId = sceneAction && "caseId" in sceneAction.command ? sceneAction.command.caseId : null;
  const activeCase = value.insideCase ? value.cases.find((entry) => entry.id === activeId) : undefined;
  const selectedCase = activeCase ?? value.cases.find((entry) => entry.id === caseId)
    ?? value.cases.find((entry) => ["PREPARED", "ACTIVE", "EXAMINED", "WAITING"].includes(entry.status))
    ?? value.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id)) ?? value.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const bottleActions = value.actions.filter((action) => BOTTLE_TYPES.includes(action.command.type));
  const selectedBottle = value.bottles.find((entry) => entry.id === bottleId)
    ?? value.bottles.find((entry) => bottleActions.some((action) => action.enabled && "bottleId" in action.command && action.command.bottleId === entry.id)) ?? value.bottles[0];
  const selectedBottleActions = selectedBottle ? bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === selectedBottle.id) : [];
  const encounterActions = value.actions.filter((action) => ENCOUNTER_TYPES.includes(action.command.type));
  const moonActions = value.actions.filter((action) => action.command.type === "HANDLE_MOON");
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command) && !ENCOUNTER_TYPES.includes(action.command.type) && action.command.type !== "HANDLE_MOON");
  const suitableNext = (action: PuppetAction) => action.command.type !== "WITHDRAW"
    && action.command.type !== "WITHDRAW_CONSENT";
  const sceneNext = NEXT_CASE_TYPES.map((type) => selectedCaseActions.find((action) => action.enabled && action.command.type === type && suitableNext(action))).find(Boolean);
  const nextAction = !value.promoted
    ? selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME") ?? [...growthActions, ...selectedBottleActions].find((action) => action.enabled) ?? value.actions[0]
    : moonActions.find((action) => action.enabled) ?? sceneNext ?? [...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions.find(suitableNext) ?? value.actions[0];
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  function confirmationContext(action: PuppetAction): string {
    if ("bottleId" in action.command) return JSON.stringify(value.bottles.find((entry) => "bottleId" in action.command && entry.id === action.command.bottleId));
    return JSON.stringify(value.encounter);
  }
  const liveConfirmation = confirmation && confirmation.contextKey === confirmationContext(confirmation.action)
    ? value.actions.find((action) => action.id === confirmation.action.id && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmingConsume = confirmation?.action.command.type === "CONSUME";

  useEffect(() => { if (selectedCase && (activeCase || caseId === null)) setCaseId(selectedCase.id); }, [selectedCase, activeCase, caseId]);
  useEffect(() => {
    const previous = lastSelectedCase.current;
    if (selectedCase && previous?.id === selectedCase.id && previous.status !== "RESOLVED" && selectedCase.status === "RESOLVED") {
      const next = value.cases.find((entry) => entry.status !== "RESOLVED" && caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id));
      if (next) setCaseId(next.id);
    }
    lastSelectedCase.current = selectedCase ? { id: selectedCase.id, status: selectedCase.status } : null;
  }, [selectedCase, value.cases, caseActions]);
  useEffect(() => {
    if (confirmation && (readOnly || (!busy && error === null && (!liveConfirmation || (submittedId !== null && !liveConfirmation.enabled)
      || (reviewBottleId !== null && !reviewBottle))))) {
      setConfirmation(null); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, readOnly, busy, error, liveConfirmation, submittedId, reviewBottleId, reviewBottle]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function actionButton(action: PuppetAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `puppet-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (["CONSUME", "ENCOUNTER_FIGHT"].includes(action.command.type)) {
            returnActionId.current = action.id; submitted.current = null; setSubmittedId(null);
            setConfirmation({ action, contextKey: confirmationContext(action) });
          } else {
            if ("caseId" in action.command) setCaseId(action.command.caseId);
            if ("bottleId" in action.command) setBottleId(action.command.bottleId);
            onCommand(action.command);
          }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`puppet-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled || (reviewBottleId !== null && !reviewBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复服药、变形、建立联系或移动原物。"}
  </p>;
  const currentResources = <section aria-label={confirmingConsume ? "服药前当前资源" : "行动前当前资源"}><h4>你现在的状态</h4>
    <dl className="seer-facts"><div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div><div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div></dl>
  </section>;

  if (confirmation) return <section className="seer-panel warrior-panel puppet-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶木偶魔药的服用确认" : "木偶真实迎战确认"} aria-busy={busy}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : "可选交战与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="木偶服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{playerText("完整配方与原著晋升仪式细节仍未知。哈伦·维斯的专业准备、成品与指导流程属于本作原创G，不能据此断言无需仪式。莎伦所需的具名木乃伊只是她个人仪式的一部分，不能改成人人必须购买的通用材料。确认仅服用这一原瓶，无论成败均实际耗用。")}</p>
      <p>{value.bodyChange}</p><p>只有服药排异的健康与精神最低保留1，不保护真实战斗死亡。晋升不补满灵性，不清除旧伤、污染或既往代价；可以暂不服用，继续怨魂生活。</p>
    </> : <section className="slice-notice seer-risk" aria-label="木偶真实交战风险"><h4>可能重伤或死亡</h4>
      <p>原创成年序列5对手埃德林·维尔在原净空工坊2米外，持自己的原短棍，有40点有限灵性使用弧光、护术与断开联系。原普通出口开放、无旁人、无追逐，也可以普通拒绝交手后离开。</p>
      <p>器物攻击只使用实际买下的3块原木块，每块一次，落地后不会免费回到箱中。不能夺走对方原棍或任意命令敌方神奇物品。</p>
      <p>{playerText("每回合默认不启用诅咒。若另行选择承担诅咒风险，实际接近1米并返回1米，付3灵性、知识18尝试建立联系，可能失败；联系有效期只有当轮及随后两轮G。再次抽中对应行动时另付4灵性、知识18尝试把自己的同一身体变为木偶诅咒源，不会立即伤害对方。")}</p>
      <p>{playerText("仅在本轮自己的诅咒源形态与同一有效联系同时成立，且本人实际受伤时，才反映有限伤害：本人仍承受完整10点轻伤或30点重伤，对方分别承受5或15点G伤害。原伤势真实保留；没有免伤、免费复活或绝对命中。本人死亡优先结算，即使同一反伤也使对方死亡。")}</p>
      <p>原人可抵抗或付费断开联系；不启用、过期或终局也会解除临时联系。形态在真实回合末恢复本人，不能解除已经发生的战斗伤势。原贝文不复活，原诺兰的生活同意不适用于伤害或这场战斗。</p>
    </section>}
    {currentResources}{liveConfirmation?.reason && <p className="seer-action-reason" id="puppet-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "puppet-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : "确认风险，开始真实交战"}</button></div>
    <p className="slice-muted">取消不会消耗本次原瓶或开始战斗。保存未确认时保留这一次操作，等待外层重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel puppet-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="木偶成长下一步"><span className="seer-seal">{value.promoted ? "木偶4" : "怨魂5 → 木偶4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">{value.bodyChange}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    {!value.promoted && <section className="slice-notice" aria-label="木偶配方与成品边界"><h4>独立成品与真实成熟条件</h4>
      <p>{playerText("完整配方与原著晋升仪式细节仍未知。原导师哈伦·维斯的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。莎伦个人需要的具名木乃伊不是已核实的通用配方或完整仪式。")}</p>
      <p>怨魂消化100且晋升后满12真实整周，意志难度28。指导540便士、1行动；每瓶全价6800便士。五次真实劳务抵5300便士后仍付1500便士，逐瓶付款与独立服用各0行动。</p>
      <p>三瓶独立原瓶全部失败后，才可等待下一真实周的有限补货。旧药不会变成新药，可以继续怨魂生活。</p>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="木偶指导与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <section aria-label="木偶原瓶供给"><h3>独立原瓶与实际供给</h3><p>{value.supplies}</p>
      <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立木偶原瓶" value={selectedBottle.id} disabled={locked}
        onChange={event => setBottleId(event.target.value)}>{value.bottles.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
      <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
      <div className="warrior-action-list" role="group" aria-label="当前木偶原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section className="slice-notice" aria-label="木偶有限月圆安排"><h3>{value.moon.title}</h3>
      <p>{value.moon.rule}</p><p>{playerText("木偶特有诅咒的精确原著机制仍未知；以下两次安排是本作G替代体验，不是天文月相公式，也不再自动执行怨魂吸取灵魂的旧机制。")}</p>
      <p aria-live="polite">{value.moon.pendingWeek === null ? "当前没有待处理的木偶月圆安排。" : `原第${value.moon.pendingWeek}周安排已到期，须先结束实际接触再处理。`} 已实际等待 {value.moon.waitedHours} 小时。</p>
      <ul>{value.moon.notices.map(notice => <li key={notice.id}>{notice.id} · 第{notice.week}周 · {notice.title} · {notice.status}</li>)}</ul>
      <p>{playerText("每次实际停止活动并等待6小时G；贝克兰德原哈伦看守消耗至多8精神，独自承受消耗至多16精神，以当前精神为限。不治疗、不补行动或灵性、不增加掌握。两次处理后不会自动续生第三次。")}</p>
      <div className="warrior-action-list" role="group" aria-label="木偶当前月圆处理">{moonActions.map(actionButton)}</div>
      <details className="seer-fold"><summary>木偶原月圆处理记录</summary>{value.moon.history.length ? <ul>{value.moon.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul> : <p>尚未实际处理本阶段安排。</p>}</details>
    </section>}
    {value.promoted && selectedCase && <section aria-label="木偶有限生活实践"><h3>同一原物、本人形态与有限联系</h3>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前木偶生活实践" value={selectedCase.id} disabled={locked || value.insideCase}
        onChange={event => setCaseId(event.target.value)}>{value.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {value.practice && <PracticeFacts practice={value.practice} />}
        {value.practice && value.practice.formState !== "HUMAN" && <section className="slice-notice" aria-label="本人形态尚未实际恢复"><h5>同一个身体尚未恢复人形</h5>
          <p>本人当前为{value.practice.formState === "WOOD" ? "神秘木偶" : "魔法纸人"}形态。先沿原2米路线走到原垫再走回原门，完成本次实际4米路线，再0行动恢复本人。费用已包含在本次原试验内，0灵性时仍可真实收束；不是分身、缩小、复制衣物或免费免伤。</p>
        </section>}
        {value.practice?.linkState === "LINKED" && <section className="slice-notice" aria-label="诺兰的有限联系仍待解除"><h5>建立联系不代表伤害试验</h5>
          <p>原成年诺兰只同意这一次有边界的接触、建立与解除联系，没有同意受伤、命令或敌对测试。他可以随时撤回；0行动解除并结束接触不退还已付成本，也不证明能够强迫敌人受伤。</p>
        </section>}
        {selectedCase.result && <section className="slice-notice" aria-label="木偶实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前木偶生活行动">{selectedCaseActions.map(actionButton)}</div>
        {value.insideCase && <p className="slice-muted">先真实结束本次接触、走完本人原路线、恢复本人或交回同一原物。0行动收束保持可用；不退款，不传送，不抹去已付成本与失败记录。</p>}
        <details className="seer-fold"><summary>已观察的事实与本次方法边界</summary>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}
          <p>{value.environment}</p>
          {selectedCase.id === "moving-token" && <p>哈伦自己的同一PU4-TOKEN-1从原近端移到2米外原标记。能力成功后本人走2米过去取原物，再带原物走2米回到哈伦处；普通方法直接带原物过去再走回，也实际走4米。失败的原物不会消失，下周仍用同一块。最后亲手归还。</p>}
          {selectedCase.id === "chosen-form" && <p>原净空工坊只有本人试验。木偶与纸人须各自实付1行动、3灵性、通过知识18检定并走完路线，再恢复同一个身体；两次实际成功才支持能力报告。原衣物随本人，不生成额外装备。普通检查只观察本人的站姿与非魔法展示，不伪称已经变形，也不增加能力掌握。</p>}
          {selectedCase.id === "reversible-link" && <p>{playerText("原成年诺兰当次明确同意有限接触。能力尝试实际普通走1米接近并1米返回，付1行动、3灵性与知识18检定；成功只建立有限G联系，不造成健康损失。普通讨论只记录边界。PU4-NOTE-1写清真实局限，结束时交回同一原纸；旧WF5-NOTE-1和原旗不改。")}</p>}
          <p>三份有限报告各25，回顾25；能力成功且实际收束后对应掌握只奖励一次。普通方法可完成本切片，不增加能力掌握，也不提供无限消化。下一序列为沉默门徒（古诅咒之物），本阶段尚未获得。</p>
        </details>
      </section>
    </section>}
    {value.promoted && <section className="slice-notice" aria-label="木偶继承原记录"><h3>旧身体、原物与代价继续保留</h3><p>{value.inheritedTools}</p>
      <p>怨魂、活尸、狼人、疯子与囚犯的原能力、掌握、失败和历史继续保留。不会重新打开旧镜面、附入旧宿主、复活旧对手或叠收旧月圆代价。</p>
    </section>}
    {value.promoted && <section aria-label="木偶可选交战"><h3>原工坊中的埃德林·维尔</h3>
      {value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="木偶原木块交谈与迎战">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="木偶能力与消化"><h3>{playerText("当前实践与继承能力")}</h3>
      <progress className="cryptologist-progress" aria-label="木偶扮演进度" value={value.acting} max={100} />
      {value.abilities.map(ability => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p>{playerText("操纵非生物器物、把自己化为神秘木偶或魔法纸人、通过建立的联系成为诅咒之源属于来源支持的类别；本作的距离、期限、费用、检定与伤害数值均为G，不是完整原著技能表。新掌握从0开始。")}</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>木偶独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}>
      <h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>}
    <details className="seer-fold" aria-label={playerText("木偶能力与使用范围")}><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>{playerText("完整配方、完整晋升仪式与序列4特有月圆诅咒的精确机制仍未知。莎伦的具名木乃伊只支持个人仪式的一部分；她的月牙形物品免疫不是职业自带能力。")}</p>
      <p>不把“木偶”理解成控制木制NPC的思想，不使用占卜家途径的秘偶尸体，不免费命令敌方神奇物品。自身体形变化不洗掉原伤势，不意味着无敌。</p>
      <p>{playerText("新原木片、原记录纸、原木块、当次故事、埃德林、路线、有限月圆安排、费用与数值均为本作G；不是通用配方、普适作用范围或必胜保证。原贝文与旧物结局继续保留。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}

function EncounterFacts({ encounter: value }: { encounter: NonNullable<PuppetProjection["encounter"]> }) {
  const status: Record<string, string> = { AVAILABLE: "尚未进入交战", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已沿原出口离开", LOST: "本人已死亡" };
  const body: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "仍活着，自行停止抵抗", DEAD: "同一原身体已死亡" };
  const outcome: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原出口撤退", ENEMY_DEAD: "原埃德林死亡", ENEMY_SURRENDERED: "原埃德林自行停止抵抗" };
  return <section aria-label="木偶原埃德林与实际联系"><p>{value.name} · {value.targetId} · 危险度约序列{value.sequence}</p>
    <dl className="seer-facts"><div><dt>当前遭遇</dt><dd>{status[value.status] ?? value.status}</dd></div>
      <div><dt>原身体健康 / 精神</dt><dd>{value.enemyHealth} / {value.enemyMind} · {body[value.enemyStatus] ?? value.enemyStatus}</dd></div>
      <div><dt>原敌人剩余灵性</dt><dd>{value.enemySpirituality} / 40</dd></div>
      <div><dt>原距离与退出路线</dt><dd>起始相距{value.distanceMetres}米 · {value.originalExit} · 无追逐 · 无旁人</dd></div></dl>
    <section className="slice-notice" aria-label="木偶战斗原木块"><h4>买下的原木块与真实去向</h4><p>{value.blocksPurchased ? "已实际付60便士买下这一组3块原木块，不能再次购买补满。" : "尚未买下原木块，不凭空提供器物攻击媒介。"}</p>
      <ul>{value.blocks.map(block => <li key={block.id}>{block.id} · {block.status === "READY" ? "原箱内待用" : "已实际消耗本次攻击机会"} · {block.location === "SOURCE" ? "本人原位置（SOURCE）" : "2米外原目标地面（TARGET_GROUND）"} · {block.usedRound === null ? "尚未用于原回合" : `实际第${block.usedRound}回合使用`}</li>)}</ul>
      <p>击中与否都不会让已用原块免费回箱，也不会取得敌人的原短棍。真实地面原物在战后继续保留。</p>
    </section>
    <section className="slice-notice" aria-label="木偶战斗当前身体与联系" aria-live="polite" aria-atomic="true"><h4>同一个身体与本轮风险</h4>
      <p>本人形态：{value.form === "HUMAN" ? "本人实际为人形" : "本人当前为木偶诅咒源"}。原伤势与身体只有一份。</p>
      <p>同一目标联系：{value.link === "LINKED" ? "实际联系仍在期限内" : "当前没有有效联系"} · 原建立回合：{value.linkRound ?? "尚未建立"}。</p>
      <p>实际接触尝试 {value.contactAttempts} 次 · 形态尝试 {value.formAttempts} 次 · 对方付费断开联系 {value.breakLinkUses} 次 · 本人实际接触路线累计 {value.contactDistanceMetres} 米。</p>
      <p>联系只在建立当轮及随后两轮有效。默认不启用诅咒，须在战斗中独立选择；对方可抵抗或断开。本人的完整伤害与原伤势不会因为反映伤害而减免。</p>
    </section>
    <details className="seer-fold"><summary>实际受伤与反映记录</summary>{value.reflectionHistory.length ? <ul>{value.reflectionHistory.map((entry, index) => <li key={index}>原第{entry.round}回合 · 本人实际承受{entry.playerDamage}点{entry.severity === "LIGHT" ? "轻伤" : "重伤"}（{entry.playerInjuryId}），原埃德林承受{entry.enemyDamage}点（{entry.enemyInjuryId}）。两个原身体与原伤势均保留。</li>)}</ul> : <p>尚无实际受伤触发的反映记录。联系或形态成功本身不会造成对方健康损失。</p>}
      {value.enemyInjuries.map(injury => <p key={injury.id}>原敌人伤势：{injury.id} · {injury.severity === "LIGHT" ? "轻伤" : "重伤"} · {injury.treatedRevision === null ? "尚未治疗" : "已有实际治疗记录"}</p>)}
    </details>
    <details className="seer-fold"><summary>原人的有限能力与现场</summary><p>{value.story}</p>
      {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 每次{ability.cost}灵性 · 已实际施放{value.powerUses[ability.id]}次 · {ability.available ? "当前原灵性足够" : "当前不可使用"}</p>)}
      <p>原敌人弧光、护术和断开联系各自真实付费。没有补灵、重置身体或重新开战；反映伤害需要同一有效联系、本人本轮诅咒源形态与真正受到原伤三者同时成立。</p>
    </details>
    {value.terminal && <p className="slice-notice">原战斗第{value.terminal.round}回合结束：{outcome[value.terminal.outcome] ?? value.terminal.outcome}。当时原敌人健康{value.terminal.enemyHealth}、精神{value.terminal.enemyMind}、灵性{value.terminal.enemySpirituality}；同一原身体结局与实际费用保留，不能重新开战。</p>}
  </section>;
}
