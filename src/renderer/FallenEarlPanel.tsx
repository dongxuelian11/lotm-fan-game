import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { FallenEarlAction, FallenEarlCommand, FallenEarlProjection } from "../domain/fallen-earl/types";
import type { MentorDisorderProjection } from "../domain/mentor-disorder/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已有公开观察与当次许可", PREPARED: "已准备，尚未实际施用",
  ACTIVE: "原人状态或原物仍待实际收束", EXAMINED: "已有结果，待真实收束与报告", RESOLVED: "已提交有限报告",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "BUY_GIFTS"];
const CLEANUP_TYPES = ["WAIT_RECOVERY", "RETURN_CRATE", "LAND", "CLOSE", "WITHDRAW"];
const NEXT_CASE_TYPES = ["WAIT_RECOVERY", "RETURN_CRATE", "LAND", "PERFORM", "CLOSE", "REPORT", "PREPARE", "OBSERVE"];
const SOURCE_BOUNDARY = playerText("可尝试赠予负面心理状态、放大自身行为和利用已有状态。晋升须取得独立成品并完成专业准备；能力范围、费用、持续时间与检定条件见下方。");

/** Read-only original S5 history; the original gift inventory remains the one live inventory. */
export function FallenEarlMentorDisorderHistory({ mentorDisorder: value }: { mentorDisorder: MentorDisorderProjection }) {
  const markers = { SORTED: "原红筹与原蓝筹在各自原色分格内", MIXED: "两枚原筹仍在各自原封边软盘内，尚未归格", COLLECTED: "两枚原筹已收停，尚未按原ID归格" };
  const route = { READY: "原成年赛恩尚未开始当时的自愿行走", MARKED: "赛恩已自行停步，原路线标记尚未收回", FREE: "赛恩已普通返回原起点，原路线标记已收入原盒，当次许可结束" };
  const note = { BLANK: "同一原纸尚未填写", WRITTEN: "同一原纸已写，尚未交回", HANDED_OVER: "同一原纸已实际交回原核册员伊芙" };
  return <section className="seer-panel warrior-panel" aria-label="混乱导师时期的经历"><h3>混乱导师时期的经历</h3>
    <p className="slice-notice">原导师米蕾·沃德、原核册员伊芙、原成年赛恩、两枚原筹、原路线标记与原记录纸继续保留。这里只回看旧实践，不重新结算、重发奖励或复活旧里斯；已发生的失败与原费用不抹去。</p>
    <p>混乱导师扮演进度 {value.acting} · 消化：{value.digestion}</p>
    <section aria-label="混乱导师原物与原接触"><h4>旧原物与同一次历史</h4><dl className="seer-facts">
      <div><dt>原筹 MD5-RED-1 / MD5-BLUE-1</dt><dd>{markers[value.practice.markers]}</dd></div>
      <div><dt>原路线标记 MD5-ROUTE-MARKER</dt><dd>{route[value.practice.route]}</dd></div>
      <div><dt>原记录纸 MD5-NOTE-1</dt><dd>{note[value.practice.note]}</dd></div></dl></section>
    {value.cases.map(entry => <details className="seer-fold" key={entry.id}><summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>{entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>{entry.result && <p>原实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold"><summary>同一原赠物库存与实际去向</summary><p>{value.gifts.summary}</p>
      <p>仍持有 {value.gifts.held} 件 · 已实际给出 {value.gifts.given} 件。此处读取同一原库存，包含后来真实购买与交出的变化，没有第二份礼物。</p></details>
    <details className="seer-fold"><summary>混乱导师独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>
    <details className="seer-fold"><summary>混乱导师原能力与故事</summary>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      {value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p></details>
    <p className="slice-muted">新实践需要在场原成年人重新同意当次试验。原纸不改写，旧许可不会成为永久同意；继承精神抗性的原记录不等于自动免疫。</p>
  </section>;
}

export interface FallenEarlPanelProps {
  fallenEarl: FallenEarlProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: FallenEarlCommand) => void;
  readOnly?: boolean;
}
type Confirmation = { action: FallenEarlAction; contextKey: string };

function PracticeFacts({ practice }: { practice: NonNullable<FallenEarlProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="堕落伯爵本次原人原物与实际收束" aria-live="polite" aria-atomic="true"><h4>当次同意、同一原箱与本人落地</h4>
    <dl className="seer-facts"><div><dt>原核册员伊芙的实际状态</dt><dd>{practice.clerk}</dd></div>
      <div><dt>伊芙本人的当次同意</dt><dd>{practice.consent}</dd></div>
      <div><dt>原轻木箱 FE4-CRATE-1</dt><dd>{practice.crate}</dd></div>
      <div><dt>原低垫 FE4-PAD-1 与本人</dt><dd>{practice.pad}</dd></div>
      <div><dt>实际等待与普通取回路线</dt><dd>{practice.route}</dd></div></dl>
    {practice.history.length > 0 && <details className="seer-fold"><summary>实际施用、恢复、取还与落地记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

/** Only local selection and review state live here. Resource, material and scene changes require committed projections. */
export function FallenEarlPanel({ fallenEarl: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: FallenEarlPanelProps) {
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
  const suitableNext = (action: FallenEarlAction) => action.command.type !== "WITHDRAW"
    && action.command.type !== "WITHDRAW_CONSENT";
  const sceneNext = NEXT_CASE_TYPES.map((type) => selectedCaseActions.find((action) => action.enabled && action.command.type === type && suitableNext(action))).find(Boolean);
  const nextAction = !value.promoted
    ? selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME") ?? [...growthActions, ...selectedBottleActions].find((action) => action.enabled) ?? value.actions[0]
    : sceneNext ?? [...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions.find(suitableNext) ?? value.actions[0];
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  function confirmationContext(action: FallenEarlAction): string {
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

  function actionButton(action: FallenEarlAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `fallenEarl-reason-${action.id}` : undefined}
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
      {action.reason && <p className="seer-action-reason" id={`fallenEarl-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled || (reviewBottleId !== null && !reviewBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复服药、施用、等待或移动原物。"}
  </p>;
  const currentResources = <section aria-label={confirmingConsume ? "服药前当前资源" : "行动前当前资源"}><h4>你现在的状态</h4>
    <dl className="seer-facts"><div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div><div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div></dl>
  </section>;

  if (confirmation) return <section className="seer-panel warrior-panel fallen-earl-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶堕落伯爵魔药的服用确认" : "堕落伯爵真实迎战确认"} aria-busy={busy}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : "可选交战与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="堕落伯爵服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{SOURCE_BOUNDARY}</p><p>{playerText("米蕾·沃德的专业准备、独立成品与指导属于本作原创G，不能据此断言无需仪式。确认仅服用这一原瓶，无论成败均实际耗用。")}</p>
      <p>{value.bodyChange}</p><p>只有服药排异的健康与精神最低保留1，不保护真实战斗死亡。晋升不补满灵性，不清除旧伤、污染、原赠物去向或既往代价；可以暂不服用，继续混乱导师生活。</p>
    </> : <section className="slice-notice seer-risk" aria-label="堕落伯爵真实交战风险"><h4>可能重伤或死亡</h4>
      <p>原创成年序列5对手马洛·文恩在原净空外院2米外，持自己的FE4-MARLOW-CLUB原短棍，有40点有限灵性与独立心智。白天双方可见、无旁人，原普通出口开放、无追逐；也可以普通拒绝交手后离开。</p>
      <p>H每次另付4灵性，仅放大本人这一次实际击打，不额外攻击。B实际给出原库存的一件礼物并付3灵性，原物留在新战场地面；没有原物或费用不足时回退旧防守。</p>
      <p>K另付4灵性、知识18赠予短暂无心恋战，失败也付费；成功只使本轮随后一次正向身体或弧光贡献乘0.55。马洛可另付3灵性凝神，清除待生效赠予并抵抗本轮新K。</p>
      <p>R仅在同一原赠物已有待生效削弱时付3灵性，把该原效果可作用的次数从1次延长为2次，最多延长一次；没有已有状态便不付费、不凭空造效果。护术和凝神对自己，不消耗针对玩家的待生效次数；未用效果在本轮末到期。</p>
      <p>原短棍与给出的原礼物在投降或死亡后仍保留实际去向。旧里斯不复活，生活中的自愿许可不适用于新战斗。伤势与死亡沿用真实战斗规则，不受服药恢复底线保护。</p>
    </section>}
    {currentResources}{liveConfirmation?.reason && <p className="seer-action-reason" id="fallenEarl-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "fallenEarl-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : "确认风险，开始真实交战"}</button></div>
    <p className="slice-muted">取消不会消耗本次原瓶或开始战斗。保存未确认时保留这一次操作，等待外层重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel fallen-earl-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="堕落伯爵成长下一步"><span className="seer-seal">{value.promoted ? playerText("堕落伯爵4 · 有限G实践") : "混乱导师5 → 堕落伯爵4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">{value.bodyChange}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    <section className="slice-notice" aria-label={playerText("堕落伯爵能力范围")}><h4>{playerText("能力范围与有限实践")}</h4><p>{SOURCE_BOUNDARY}</p>
      <p>赠予负面心理状态不是赠送任意物品、死亡或法律，也不把对象原有负面状态设为统一施用前提；没有独立心智的死秘偶不适用。本切片的放大限于自身行为；利用必须针对已有状态。这里没有任意时间停止、无限滞空或免费神话形态。</p>
    </section>
    {!value.promoted && <section className="slice-notice" aria-label="堕落伯爵配方与成品边界"><h4>独立成品与真实成熟条件</h4>
      <p>{playerText("完整配方与原著晋升仪式细节仍未知。原导师米蕾·沃德的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。")}</p>
      <p>混乱导师消化100且晋升后满12真实整周，意志难度28。指导540便士、1行动；每瓶全价6800便士。五次真实劳务抵5300便士后仍付1500便士，逐瓶付款与独立服用各0行动。</p>
      <p>三瓶独立原瓶全部失败后，才可等待下一真实周的有限补货。旧药不会变成新药，可以继续混乱导师生活。</p>
    </section>}
    <section className="slice-notice" aria-label="堕落伯爵同一原赠物库存" aria-live="polite" aria-atomic="true"><h4>继承同一原赠物库存</h4><p>{value.gifts.summary}</p>
      <dl className="seer-facts"><div><dt>本人实际持有</dt><dd>{value.gifts.held} 件</dd></div>
        <div><dt>累计实际给出</dt><dd>{value.gifts.given} 件</dd></div><div><dt>本次马洛原战场地面</dt><dd>{value.gifts.battleGround} 件</dd></div></dl>
      <p>购买三件新编号原物实付60便士，仍加入原贿赂者库存。交出才离开本人；点击准备或打开迎战确认不消耗，已给出的原物不复制、不自动归还。</p>
    </section>
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="堕落伯爵指导与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <section aria-label="堕落伯爵原瓶供给"><h3>独立原瓶与实际供给</h3><p>{value.supplies}</p>
      <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立堕落伯爵原瓶" value={selectedBottle.id} disabled={locked}
        onChange={event => setBottleId(event.target.value)}>{value.bottles.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
      <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
      <div className="warrior-action-list" role="group" aria-label="当前堕落伯爵原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
    </section>}
    {value.promoted && selectedCase && <section aria-label="堕落伯爵有限生活实践"><h3>一次自愿暂停、本人推箱与短暂上升</h3>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前堕落伯爵生活实践" value={selectedCase.id} disabled={locked || value.insideCase}
        onChange={event => setCaseId(event.target.value)}>{value.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {value.practice && <PracticeFacts practice={value.practice} />}
        {selectedCase.result && <section className="slice-notice" aria-label="堕落伯爵实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前堕落伯爵生活行动">{selectedCaseActions.map(actionButton)}</div>
        {value.insideCase && <p className="slice-muted">当前原人状态或原物尚待真实收束。须实际等到恢复、普通取回同一原箱或完成本人落地；0行动收束保持可用。撤回不瞬间治疗，不传送，不退款，不抹去失败。</p>}
        <details className="seer-fold"><summary>已观察的事实与本次方法边界</summary>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}
          <p>{value.environment}</p>
          {selectedCase.id === "willing-pause" && <p>原成年核册员伊芙只同意这一次短暂兴致缺缺试验，仍在原书桌旁，有自主意志。能力1行动、4灵性、知识18，成功产生30秒本人自述的LACK_ENTHUSIASM；失败被抵抗也付费。普通方法1行动、0灵性、知识10，只观察她自己选择的暂停。施用前撤回不施用、不收施用费；施用后撤回停止新增影响，既有状态仍须实际等待剩余秒数自然恢复，不能即刻清零或强制道德改变。</p>}
          {selectedCase.id === "own-push" && <p>导师自己的同一FE4-CRATE-1轻木箱置于净空低地面，只有本人推箱，路线上无人。能力1行动、4灵性、知识18，仅放大本人这一次推力，成功原箱从0米到1米；失败留在0米。普通1行动、0灵性、知识10。原箱实际移动后，本人走1米拿起同一轻箱，再走1米返回放回0米，共2米；原箱未移动便不虚构取还距离。最后交还原导师，失败下周也只用同一个原箱。</p>}
          {selectedCase.id === "short-rise" && <p>本人在净空低地面的同一FE4-PAD-1起跳，只利用已经开始的上升。能力1行动、3灵性、知识18，成功由普通1秒延长至有限4秒；失败仍是普通1秒。普通方法1行动、0灵性、知识10。落地动作实际推进剩余秒数，同一身体与原鞋回到同一0米原垫，再把同一原垫交还导师；没有无限滞空、高空跳台、带人飞行或月亮跳跃。</p>}
          <p>观察、准备、施用、报告各1行动；准备尚未开始接触。失败保留费用，实际收束后到下一真实周再试。三份成功且实际收束的报告各25，回顾25；能力报告各加对应新掌握8且最多一次，普通方法不增加能力掌握。</p>
        </details>
      </section>
    </section>}
    {value.promoted && <section className="slice-notice" aria-label="堕落伯爵继承原记录"><h3>旧故事、原物与同一赠物库存继续保留</h3><p>{value.inheritedTools}</p>
      <p>律师、野蛮人、贿赂者、腐化男爵与混乱导师的原能力、掌握、失败和历史继续保留。原红蓝筹、原路线与原纸不被新实践替换；原贿赂礼物继续逐件记录购买、持有与实际给出。</p>
    </section>}
    {value.promoted && <section aria-label="堕落伯爵可选交战"><h3>原外院中的马洛·文恩</h3>
      {value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="堕落伯爵原赠物与交谈迎战">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="堕落伯爵能力与消化"><h3>赠予、放大与利用</h3>
      <progress className="cryptologist-progress" aria-label="堕落伯爵扮演进度" value={value.acting} max={100} />
      {value.abilities.map(ability => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p>{playerText("三项新能力掌握从0开始，本切片的具体有限用法与数值为G。下一序列狂乱法师3尚未获得，不预授更高位利用、熵或规则权能。")}</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>堕落伯爵独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}>
      <h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>}
    <details className="seer-fold" aria-label={playerText("堕落伯爵能力与使用范围")}><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>{playerText("扭曲、混乱、贿赂与原精神抗性继续继承，但不凭名称生成任意效果、自动免疫或免费资源。本作未开放免费神话形态；完整配方和原著晋升仪式未知，不显示未核材料清单。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}

function EncounterFacts({ encounter: value }: { encounter: NonNullable<FallenEarlProjection["encounter"]> }) {
  const status: Record<string, string> = { AVAILABLE: "尚未进入交战", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已沿原出口离开", LOST: "本人已死亡" };
  const body: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "仍活着，自行停止抵抗", DEAD: "同一原身体已死亡" };
  const outcome: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原出口撤退", ENEMY_DEAD: "原马洛死亡", ENEMY_SURRENDERED: "原马洛自行停止抵抗" };
  return <section aria-label="堕落伯爵原马洛与实际费用"><p>{value.name} · {value.targetId} · 危险度约序列{value.sequence}</p>
    <dl className="seer-facts"><div><dt>当前遭遇</dt><dd>{status[value.status] ?? value.status}</dd></div>
      <div><dt>原身体健康 / 精神</dt><dd>{value.enemyHealth} / {value.enemyMind} · {body[value.enemyStatus] ?? value.enemyStatus}</dd></div>
      <div><dt>原敌人剩余灵性</dt><dd>{value.enemySpirituality} / 40</dd></div>
      <div><dt>原距离与退出路线</dt><dd>起始相距{value.distanceMetres}米 · {value.originalExit} · 无追逐 · 无旁人</dd></div>
      <div><dt>原短棍 FE4-MARLOW-CLUB</dt><dd>仍为马洛本人的原物，未传给玩家</dd></div></dl>
    <section className="slice-notice" aria-label="堕落伯爵有限能力与实际花费" aria-live="polite" aria-atomic="true"><h4>当轮有限作用与实际花费</h4>
      <p>实际付费赠予尝试 {value.bestowAttempts} 次 · 本人击打放大 {value.magnifyUses} 次 · 原赠物状态延长 {value.exploitUses} 次。</p>
      <p>待生效赠予：{value.bestowReady ? "只等待本轮下一次实际正向身体或弧光贡献" : "当前没有待生效赠予"}。成功的短暂无心恋战只使那一次贡献乘0.55；失败与抵抗仍实付4灵性，不立刻造成伤势或取消行动。已有待生效赠予时不再次付费。</p>
      <p>马洛当轮凝神：{value.composureReady ? "当前回合抵抗新的赠予" : "当前没有凝神保护"}。凝神实际花3灵性，清除待生效赠予；保护只到本轮末，不永续。</p>
      <p>放大每次独立花4灵性，只加强本人这一击，不能叠层或增加攻击次数。继承赠物削弱实际花3灵性与一件原礼物，留在原战场地面，不要求自愿接住；利用另花3灵性将同一已有削弱由1次延长到2次且仅一次。</p>
      <p>敌人自用护术、凝神不消耗针对玩家的赠物次数；已耗尽时利用无效且不收费，未用临时状态在回合末到期。赠物与赠予各自实际触发，符合时独立相乘，不能追改已经发生的结果。</p>
    </section>
    <details className="seer-fold"><summary>原人的有限能力与现场</summary><p>{value.story}</p>
      {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 每次{ability.cost}灵性 · 已实际施放{value.powerUses[ability.id]}次 · {ability.available ? "当前原灵性足够" : "当前不可使用"}</p>)}
      <p>敌人原灵性不足时采用持本人原短棍的普通动作，不免费施术。旧里斯与旧战斗记录不重开。</p>
      {value.enemyInjuries.map(injury => <p key={injury.id}>原敌人伤势：{injury.id} · {injury.severity === "LIGHT" ? "轻伤" : "重伤"} · {injury.treatedRevision === null ? "尚未治疗" : "已有实际治疗记录"}</p>)}
    </details>
    {value.terminal && <p className="slice-notice">原战斗第{value.terminal.round}回合结束：{outcome[value.terminal.outcome] ?? value.terminal.outcome}。当时原敌人健康{value.terminal.enemyHealth}、精神{value.terminal.enemyMind}、灵性{value.terminal.enemySpirituality}；同一原身体结局、原棍与实际费用保留，不能重新开战。</p>}
  </section>;
}

export default FallenEarlPanel;
