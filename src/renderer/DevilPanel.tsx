import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DevilAction, DevilCommand, DevilProjection } from "../domain/devil/types";
import type { DesireApostleProjection } from "../domain/desire-apostle/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已有公开观察与当次对话", PREPARED: "已准备，须看实际种子与结果",
  ACTIVE: "本次接触仍在继续", EXAMINED: "已有本次结果，待真实收束与报告", RESOLVED: "已提交有限报告",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT"];
const CLEANUP_TYPES = ["RETURN_ROUTE", "CLOSE", "WITHDRAW"];
const NEXT_CASE_TYPES = ["RETURN_ROUTE", "CATALYZE", "CONFIRM_ACCOUNT", "PERFORM", "CLOSE", "REPORT", "PREPARE", "OBSERVE"];

/** Original S5 public records are history, never newly actionable scenes or replacement bodies. */
export function DevilDesireApostleHistory({ desireApostle: value }: { desireApostle: DesireApostleProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="欲望使徒时期的经历">
    <h3>欲望使徒时期的经历</h3>
    <p className="slice-notice">这里保留原蕾娜、原米蕾尔、原账册DA5-LEDGER-1与原便条DA5-NOTE-1、独立原瓶、失败与实际结果，只供回看。原费兰与原莫顿的结局继续封存在原记录中；新遭遇不重开旧冲突，不复活旧对手。</p>
    <p>欲望使徒扮演进度 {value.acting} · 消化：{value.digestion}</p>
    {value.practice && <section aria-label="欲望使徒原情绪种子与原物记录"><h4>同一原账册与原便条</h4>
      <p>{value.practice.emotion}</p><p>{value.practice.seed}</p><p>{value.practice.records}</p>
      <ul>{value.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
    </section>}
    {value.cases.map(entry => <details className="seer-fold" key={entry.id}><summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {value.battle && <details className="seer-fold"><summary>原费兰现场的情绪与种子记录</summary>
      <p>原情绪：{value.battle.emotion === "STRONG" ? "当时仍有公开强烈情绪" : "原记录已平静"} · 原种子：{value.battle.seedPlanted ? "原记录仍有种子" : "没有可用旧种子"}。</p>
      <p>原埋种回合：{value.battle.seedRound ?? "尚未实际埋种"} · 原迟疑：{value.battle.staggerReady ? "原记录尚在" : "已结束或尚未产生"}。这里只展示旧记录，不能用于新奥里克。</p>
    </details>}
    <details className="seer-fold"><summary>欲望使徒原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}>
      <h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>
    <details className="seer-fold"><summary>欲望使徒原能力与故事</summary>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      {value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p></details>
    <p className="slice-muted">晋升不重新结算旧实践，不返还已付成本、不刷新旧情绪或种子，也不补回原账册、便条与药瓶。旧能力、掌握、风险和良知代价仍然保留。</p>
  </section>;
}

export interface DevilPanelProps {
  devil: DevilProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DevilCommand) => void;
  readOnly?: boolean;
}
type Confirmation = { action: DevilAction; contextKey: string };

function PracticeFacts({ practice }: { practice: NonNullable<DevilProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="魔鬼本次原物与实际情绪" aria-live="polite" aria-atomic="true"><h4>本次公开事实与原物</h4>
    <dl className="seer-facts"><div><dt>米蕾尔当次情绪</dt><dd>{practice.emotion}</dd></div>
      <div><dt>本次种子与实际催化</dt><dd>{practice.seed}</dd></div><div><dt>当次同意与撤回</dt><dd>{practice.consent}</dd></div>
      <div><dt>米蕾尔自己的原节目单</dt><dd>{practice.program}</dd></div><div><dt>蕾娜与同一原邀请</dt><dd>{practice.invitation}</dd></div>
      <div><dt>本人实际位置与普通路线</dt><dd>{practice.route}</dd></div><div><dt>同一原便条与有限陈述</dt><dd>{practice.account}</dd></div></dl>
    {practice.history.length > 0 && <details className="seer-fold"><summary>实际埋种、走动与记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

/** Only local selection and review state live here. Resource, material and scene changes require committed projections. */
export function DevilPanel({ devil: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: DevilPanelProps) {
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
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command) && !ENCOUNTER_TYPES.includes(action.command.type));
  const suitableNext = (action: DevilAction) => action.command.type !== "WITHDRAW"
    && action.command.type !== "WITHDRAW_CONSENT"
    && !(action.command.type === "CONFIRM_ACCOUNT" && action.command.claim === "GUARANTEED");
  const sceneNext = NEXT_CASE_TYPES.map((type) => selectedCaseActions.find((action) => action.enabled && action.command.type === type && suitableNext(action))).find(Boolean);
  const nextAction = !value.promoted
    ? selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME") ?? [...growthActions, ...selectedBottleActions].find((action) => action.enabled) ?? value.actions[0]
    : sceneNext ?? [...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions.find(suitableNext) ?? value.actions[0];
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  function confirmationContext(action: DevilAction): string {
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

  function actionButton(action: DevilAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `devil-reason-${action.id}` : undefined}
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
      {action.reason && <p className="seer-action-reason" id={`devil-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled || (reviewBottleId !== null && !reviewBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复服药、埋种、催化或移动原物。"}
  </p>;
  const currentResources = <section aria-label={confirmingConsume ? "服药前当前资源" : "行动前当前资源"}><h4>你现在的状态</h4>
    <dl className="seer-facts"><div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div><div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div></dl>
  </section>;

  if (confirmation) return <section className="seer-panel warrior-panel devil-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶魔鬼魔药的服用确认" : "魔鬼真实迎战确认"} aria-busy={busy}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : "可选交战与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="魔鬼服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{playerText("完整配方与原著晋升仪式细节仍未知。原导师的专业准备、成品与指导流程属于本作原创G，不能据此断言无需仪式。确认仅服用这一原瓶，无论成败均实际耗用。")}</p>
      <p>{value.bodyChange}</p><p>只有服药排异的健康与精神最低保留1，不保护真实战斗死亡。晋升不补满灵性、不清除旧张力、污染或良知代价；可以暂不服用，继续欲望使徒生活。</p>
    </> : <section className="slice-notice seer-risk" aria-label="魔鬼真实交战风险"><h4>可能重伤或死亡</h4>
      <p>原创成年序列5对手奥里克·费恩在原净空附院4米外，持自己的原短棍，有40点有限灵性使用弧光与护术。原普通出口开放、无旁人、无追逐，也可以普通拒绝交手后离开。</p>
      <p>当前强烈情绪来自他对被拒领原库房钥匙的公开愤怒，不能免费制造。实际付4灵性埋种后仍须另付3灵性催化并通过知识18检定；原人自行平静或种子过期后无可用入口。</p>
      <p>{playerText("催化成功只在本轮减弱下一次实际正贡献攻击一次；敌人真实施法费用照付，小护术不是攻击。不会直接致死、控制忠诚或取消所有行动。成本、期限、限制与数值均为G。")}</p>
      <p>战斗伤势、撤退和死亡照常结算，旧费兰与旧莫顿不复活，旧种子不能转给新对手。</p>
    </section>}
    {currentResources}{liveConfirmation?.reason && <p className="seer-action-reason" id="devil-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "devil-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : "确认风险，开始真实交战"}</button></div>
    <p className="slice-muted">取消不会消耗本次原瓶或开始战斗。保存未确认时保留这一次操作，等待外层重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel devil-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="魔鬼成长下一步"><span className="seer-seal">{value.promoted ? "魔鬼4" : "欲望使徒5 → 魔鬼4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">{value.bodyChange}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    {!value.promoted && <section className="slice-notice" aria-label="魔鬼配方与成品边界"><h4>独立成品与真实成熟条件</h4>
      <p>{playerText("完整配方与原著晋升仪式细节仍未知。原导师罗安·费里的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。")}</p>
      <p>欲望使徒消化100且晋升后满12真实整周，意志难度28。指导540便士、1行动；每瓶全价6800便士。五次真实劳务抵5300便士后仍付1500便士，逐瓶付款与独立服用各0行动。</p>
      <p>三瓶独立原瓶全部失败后，才可等待下一真实周的有限补货。旧药不会变成新药，可以继续欲望使徒生活。</p>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="魔鬼指导与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <section aria-label="魔鬼原瓶供给"><h3>独立原瓶与实际供给</h3><p>{value.supplies}</p>
      <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立魔鬼原瓶" value={selectedBottle.id} disabled={locked}
        onChange={event => setBottleId(event.target.value)}>{value.bottles.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
      <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
      <div className="warrior-action-list" role="group" aria-label="当前魔鬼原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
    </section>}
    {value.promoted && selectedCase && <section aria-label="魔鬼有限生活实践"><h3>当次同意、归还邀请与有限陈述</h3>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前魔鬼生活实践" value={selectedCase.id} disabled={locked || value.insideCase}
        onChange={event => setCaseId(event.target.value)}>{value.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{selectedCase.id === "stage-decision" && value.practice?.seedState === "PLANTED" ? "已付费实际埋种，尚未实际催化" : CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {value.practice && <PracticeFacts practice={value.practice} />}
        {selectedCase.id === "stage-decision" && value.practice?.seedState === "PLANTED" && <section className="slice-notice" aria-label="已付费原种子仍待催化">
          <h5>埋种成功仍不是完成</h5><p>这次原种子已实际支付1行动、4灵性，尚未结算催化、报告或掌握奖励。继续催化另需0行动、3灵性与知识18检定，无论成败都耗掉同一原种子。</p>
          <p>{playerText("米蕾尔可以当场撤回同意并平静，让种子失效；之后仍须结束原接触。也可0行动结束，实际等完60秒G窗口。都不退还已付成本，不冒充催化成功。")}</p>
        </section>}
        {selectedCase.result && <section className="slice-notice" aria-label="魔鬼实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前魔鬼生活行动">{selectedCaseActions.map(actionButton)}</div>
        {value.insideCase && <p className="slice-muted">先真实结束本次接触、本人走回原路线或交回同一原纸。0行动收束保持可用；不退款，不传送，不抹去已付成本与失败记录。</p>}
        <details className="seer-fold"><summary>已观察的事实与本次方法边界</summary>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}
          <p>{value.environment}</p>
          {selectedCase.id === "stage-decision" && <p>{playerText("原成年米蕾尔自己选择短篇朗读并持有DV4-PROGRAM-1。只有她公开表达的当次强烈情绪、明确同意与仍有效的原种子才允许试验；催化成功仅出现30秒G短暂迟疑，节目单始终由她自己持有。普通讨论等她自己回答，不增加能力掌握。")}</p>}
          {selectedCase.id === "returned-invitation" && <p>原成年蕾娜保持平静，可以自由拒绝同一DV4-INVITATION-1，没有能力入口。她把原纸放到1米外原架后，本人须普通走过去取回，再实际走1米带回原导师处。失败仍保留这次真实路线与拒绝；下周只核对原记录，不重新发出一次邀请。</p>}
          {selectedCase.id === "bounded-account" && <p>{playerText("导师自己的DV4-NOTE-1承载真实报告，旧账册不改。有限陈述只支持已观察结果与可能失败；承诺必然成功会被导师明确拒绝。可0行动在同一原纸上纠正，原错误保留。这是G核对标准，没有魔法契约、灵魂所有权或超自然测谎。")}</p>}
          <p>三份有限报告各25，回顾25；普通方法可完成这一有限切片，但不提供无限、保证无代价的善行消化。原恶意、张力、风险与良知代价继续存在。</p>
        </details>
      </section>
    </section>}
    {value.promoted && <section className="slice-notice" aria-label="魔鬼继承原张力"><h3>原冲动张力 {value.strain} / 3</h3>
      <p>{value.inheritedTools}</p><p>场外普通收拢冲动仍付1行动，只将同一恶魔张力降低1。不会恢复健康、精神或灵性，不清污染，也不抹去其他心智与良知代价。</p>
    </section>}
    {value.promoted && <section aria-label="魔鬼可选交战"><h3>原附院中的奥里克·费恩</h3>
      {value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="魔鬼交谈与迎战">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="魔鬼能力与消化"><h3>{playerText("当前训练与继承能力")}</h3>
      <progress className="cryptologist-progress" aria-label="魔鬼扮演进度" value={value.acting} max={100} />
      {value.abilities.map(ability => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p>{playerText("两个新增训练名与具体强化机制都明确属于本作G，不冒充已经核实的魔鬼完整原著技能表。新掌握从0开始；只有实际成功的对应付费催化实践，才在收束并报告后各增8一次。")}</p>
      <p>下一阶段为呓语者序列3。本阶段没有获得更高序列或原初恶魔的能力。</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>魔鬼独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}>
      <h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>}
    <details className="seer-fold" aria-label={playerText("魔鬼能力与使用范围")}><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>{playerText("完整配方、晋升仪式与魔鬼完整能力表仍未知。不老泉骗局至多支持仪式或消化的推测，不能据此强制大屠杀。堕落长笛是物品，不是本职业能力；本切片没有授予这一物品。")}</p>
      <p>强烈欲望或情绪仍是实际前提，平静、警惕或抵抗者不自动受控。不能把降低智力、固定提前一两天预警、免费契约或灵魂所有权当作普遍职业能力。</p>
      <p>{playerText("新节目单、邀请、便条、当次故事、奥里克、路线、时长、费用、检定、能力名与数值均为本作G；不是完整原著配方、普适作用范围或必胜保证。原费兰、原莫顿与旧物结局继续保留。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}

function EncounterFacts({ encounter: value }: { encounter: NonNullable<DevilProjection["encounter"]> }) {
  const status: Record<string, string> = { AVAILABLE: "尚未进入交战", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已沿原出口离开", LOST: "本人已死亡" };
  const body: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "仍活着，自行停止抵抗", DEAD: "同一原身体已死亡" };
  const outcome: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原出口撤退", ENEMY_DEAD: "原奥里克死亡", ENEMY_SURRENDERED: "原奥里克自行停止抵抗" };
  return <section aria-label="魔鬼原奥里克与实际种子"><p>{value.name} · {value.targetId} · 危险度约序列{value.sequence}</p>
    <dl className="seer-facts"><div><dt>当前遭遇</dt><dd>{status[value.status] ?? value.status}</dd></div>
      <div><dt>原身体健康 / 精神</dt><dd>{value.enemyHealth} / {value.enemyMind} · {body[value.enemyStatus] ?? value.enemyStatus}</dd></div>
      <div><dt>原敌人剩余灵性</dt><dd>{value.enemySpirituality} / 40</dd></div>
      <div><dt>原距离与退出路线</dt><dd>起始相距{value.distanceMetres}米 · {value.originalExit} · 无追逐 · 无旁人</dd></div></dl>
    <section className="slice-notice" aria-label="原奥里克当前情绪与付费种子" aria-live="polite" aria-atomic="true"><h4>当前实际入口</h4>
      <p>情绪：{value.emotion === "STRONG" ? "本人已公开表达强烈愤怒" : "本人已实际平静，本场不重新制造入口"}。</p>
      <p>原种子：{value.seedPlanted ? "已付费埋下，尚未消费" : "当前没有可用种子"} · 最近实际埋种回合：{value.lastSeedRound ?? "尚未埋种"}。</p>
      <p>本轮催化迟疑：{value.staggerReady ? "等待下一次正贡献攻击，至多一次" : "尚未产生或已经结束"}。</p>
      <p>实际埋种尝试 {value.seedAttempts} 次 · 催化尝试 {value.catalysisAttempts} 次 · 原人自行平静 {value.composeUses} 次。</p>
      <p>{playerText("种子只有埋种当轮及随后两轮的G期限，观察不延长。实际平静、到期或终局会结束临时效果，保留原尝试记录。旧费兰的情绪和种子不进入本场。")}</p>
    </section>
    <details className="seer-fold"><summary>原人的有限能力与现场</summary><p>{value.story}</p>
      {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 每次{ability.cost}灵性 · 已实际施放{value.powerUses[ability.id]}次 · {ability.available ? "当前原灵性足够" : "当前不可使用"}</p>)}
      <p>真实弧光先付5灵性，再可能被当轮催化迟疑减弱一次；小护术付3灵性，不是攻击，也不耗掉这次迟疑。原灵性不会因晋升、退出或重新查看而补满。</p>
    </details>
    {value.terminal && <p className="slice-notice">原战斗第{value.terminal.round}回合结束：{outcome[value.terminal.outcome] ?? value.terminal.outcome}。当时原敌人健康{value.terminal.enemyHealth}、精神{value.terminal.enemyMind}、灵性{value.terminal.enemySpirituality}；同一原身体结局与实际费用保留，不能重新开战。</p>}
  </section>;
}
