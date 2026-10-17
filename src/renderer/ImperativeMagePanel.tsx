import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ImperativeMageAction, ImperativeMageCommand, ImperativeMageProjection } from "../domain/imperative-mage/types";
import type { PunishmentKnightProjection } from "../domain/punishment-knight/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已有公开观察与当次许可", PREPARED: "已准备，尚未实际施用",
  ACTIVE: "原人状态或原物仍待实际收束", EXAMINED: "已有结果，待真实收束与报告", RESOLVED: "已提交有限报告",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT"];
const CLEANUP_TYPES = ["RELEASE_ATTENTION", "CHECK_LIGHT", "RESTORE_LIGHT", "REMOVE_RULE", "CLOSE", "WITHDRAW"];
const NEXT_CASE_TYPES = ["CHECK_LIGHT", "RELEASE_ATTENTION", "RESTORE_LIGHT", "REMOVE_RULE", "PERFORM", "CLOSE", "REPORT", "PREPARE", "OBSERVE"];
const SOURCE_BOUNDARY = playerText("威严与暂时剥夺能力不保证对任意对象成功。晋升须取得独立成品并完成专业准备；能力范围、费用、持续时间与检定条件见下方。");

/** The same original S5 cases and objects, presented without replaying any action. */
export function ImperativeMagePunishmentKnightHistory({ punishmentKnight: value }: { punishmentKnight: PunishmentKnightProjection }) {
  const pad = { STAND: "原软靶已回到原架", MAT: "同一原软靶仍在原垫处" };
  const partner = { FREE: "原成年阿伦自由，旧接触已结束", HELD: "原成年阿伦仍在当时的有限停步中" };
  const rule = { NONE: "旧标线已收束，没有存续禁令", DECLARED: "当时已声明有限禁令", BREACHED: "当时已实际发生一次违禁" };
  const note = { BLANK: "同一原纸尚未填写", WRITTEN: "同一原纸已写，尚未交回", HANDED_OVER: "同一原纸已实际交回原导师" };
  return <section className="seer-panel warrior-panel" aria-label="惩戒骑士时期的经历"><h3>惩戒骑士时期的经历</h3>
    <p className="slice-notice">原导师薇娜·贝尔、原成年阿伦、原软靶、原标线与原记录纸继续保留。这里只回看旧实践，不重新结算、重发奖励或复活旧迪恩；已发生的失败与原费用不抹去。</p>
    <p>惩戒骑士扮演进度 {value.acting} · 消化：{value.digestion}</p>
    <section aria-label="惩戒骑士原物与原接触"><h4>旧原物与同一次历史</h4><dl className="seer-facts">
      <div><dt>原软靶 PK5-SOFT-PAD-1</dt><dd>{pad[value.practice.pad]}</dd></div>
      <div><dt>原成年阿伦</dt><dd>{partner[value.practice.partner]}</dd></div>
      <div><dt>旧标线 PK5-LINE-1 与有限禁令</dt><dd>{rule[value.practice.rule]}</dd></div>
      <div><dt>同一原记录纸 PK5-NOTE-1</dt><dd>{note[value.practice.note]}</dd></div></dl></section>
    {value.cases.map(entry => <details className="seer-fold" key={entry.id}><summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>{entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>{entry.result && <p>原实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold"><summary>惩戒骑士独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>
    <details className="seer-fold"><summary>惩戒骑士原能力与故事</summary>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      {value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p></details>
    <p className="slice-muted">新实践需要原成年人重新同意当次试验。旧许可不会成为永久同意，旧伤情记录不会替新目标制造伤口；惩戒、囚禁与伤口宣判的原掌握继续保留。</p>
  </section>;
}

export interface ImperativeMagePanelProps {
  imperativeMage: ImperativeMageProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ImperativeMageCommand) => void;
  readOnly?: boolean;
}
type Confirmation = { action: ImperativeMageAction; contextKey: string };

function PracticeFacts({ practice }: { practice: NonNullable<ImperativeMageProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="律令法师本次原人原物与实际收束" aria-live="polite" aria-atomic="true"><h4>原人的当次同意、实际灵性与原物取还</h4>
    <dl className="seer-facts"><div><dt>原成年阿伦的自主注意</dt><dd>{practice.attention}</dd></div>
      <div><dt>当次同意与撤回</dt><dd>{practice.consent}</dd></div>
      <div><dt>原戏法大师埃尔登·维尔与实际资源</dt><dd>{practice.partner}</dd></div>
      <div><dt>原FLASH、IM4-CARD-1与IM4-HOOD-1</dt><dd>{practice.light}</dd></div>
      <div><dt>原IM4-LINE-1与IM4-TOKEN-1</dt><dd>{practice.line}</dd></div>
      <div><dt>实际经过时间与普通取还路线</dt><dd>{practice.route}</dd></div></dl>
    {practice.history.length > 0 && <details className="seer-fold"><summary>实际施用、恢复、原物取还与普通休息记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

/** Only local selection and review state live here. Resource, material and scene changes require committed projections. */
export function ImperativeMagePanel({ imperativeMage: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: ImperativeMagePanelProps) {
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
  const suitableNext = (action: ImperativeMageAction) => action.command.type !== "WITHDRAW"
    && action.command.type !== "WITHDRAW_CONSENT";
  const sceneNext = NEXT_CASE_TYPES.map((type) => selectedCaseActions.find((action) => action.enabled && action.command.type === type && suitableNext(action))).find(Boolean);
  const nextAction = !value.promoted
    ? selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME") ?? [...growthActions, ...selectedBottleActions].find((action) => action.enabled) ?? value.actions[0]
    : sceneNext ?? [...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions.find(suitableNext) ?? value.actions[0];
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  function confirmationContext(action: ImperativeMageAction): string {
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

  function actionButton(action: ImperativeMageAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `imperativeMage-reason-${action.id}` : undefined}
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
      {action.reason && <p className="seer-action-reason" id={`imperativeMage-reason-${action.id}`}>{action.reason}</p>}
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

  if (confirmation) return <section className="seer-panel warrior-panel imperative-mage-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶律令法师魔药的服用确认" : "律令法师真实迎战确认"} aria-busy={busy}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : "可选交战与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="律令法师服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{SOURCE_BOUNDARY}</p><p>{playerText("薇娜·贝尔的专业准备、独立成品与指导属于本作原创G，不能据此断言无需仪式。确认仅服用这一原瓶，无论成败均实际耗用。")}</p>
      <p>{value.bodyChange}</p><p>只有服药排异的健康与精神最低保留1，不保护真实战斗死亡。晋升不补满灵性，不清除旧伤、污染、原物去向或既往代价；可以暂不服用，继续惩戒骑士生活。</p>
    </> : <section className="slice-notice seer-risk" aria-label="律令法师真实交战风险"><h4>可能重伤或死亡</h4>
      <p>原创成年序列5对手罗温·凯尔在原净空外院2米外，持自己的IM4-ROWAN-CLUB原短棍，有40点有限灵性与独立心智。白天双方可见、无旁人，原普通出口开放、无追逐；也可以普通拒绝交手后离开。</p>
      <p>H继承原战斗训练，只有敌方实际抵抗禁令后完成正值身体打击，才可另付3灵性强化本人一次惩戒。J只对原敌人实际已有伤口付3灵性、知识14尝试有限宣判；没有伤口时只是普通侧击。</p>
      <p>B威严另付4灵性、知识18，成功只使本轮随后一次正向身体或弧光贡献乘0.6。R暂剥另付4灵性、知识18，只令罗温本人已有的ARC在本轮余下时间不可用。失败也付费；已有待生效同类状态时不重复收费。</p>
      <p>罗温可花3灵性凝神，清除当前威严与暂剥并抵抗本轮新影响。ARC暂不可用或原灵性不足时，他仍可用自己的原短棍普通击打，0灵性；没有整次行动被免费删除。</p>
      <p>K继承3灵性的双方有限身体禁令，只检查下一次真实身体动作；实际抵抗、费用与违禁结果保留。自用护术、凝神不消耗威严或身体禁令；临时状态在回合末或终局真实结束，原ARC恢复可用。</p>
      <p>旧迪恩不复活，原短棍不归玩家，生活中的自愿许可不适用于新战斗。伤势与死亡沿用真实战斗规则，不受服药恢复底线保护。</p>
    </section>}
    {currentResources}{liveConfirmation?.reason && <p className="seer-action-reason" id="imperativeMage-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "imperativeMage-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : "确认风险，开始真实交战"}</button></div>
    <p className="slice-muted">取消不会消耗本次原瓶或开始战斗。保存未确认时保留这一次操作，等待外层重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel imperative-mage-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="律令法师成长下一步"><span className="seer-seal">{value.promoted ? playerText("律令法师4 · 有限G实践") : "惩戒骑士5 → 律令法师4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">{value.bodyChange}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    <section className="slice-notice" aria-label={playerText("律令法师能力范围")}><h4>{playerText("能力范围与有限实践")}</h4><p>{SOURCE_BOUNDARY}</p>
      <p>威严不是强迫供出真相或证明犯罪；暂剥不是永久删除、复制或学会对方能力。混途径看守者的两条规则不能当作律令法师全职业的固定上限。这里不授官方身份，不开放一句必死、任意改写世界或免费神话形态。</p>
    </section>
    {!value.promoted && <section className="slice-notice" aria-label="律令法师配方与成品边界"><h4>独立成品与真实成熟条件</h4>
      <p>{playerText("完整配方与原著晋升仪式细节仍未知。原导师薇娜·贝尔的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。")}</p>
      <p>惩戒骑士消化100且晋升后满12真实整周，意志难度28。指导540便士、1行动；每瓶全价6800便士。五次真实劳务抵5300便士后仍付1500便士，逐瓶付款与独立服用各0行动。</p>
      <p>三瓶独立原瓶全部失败后，才可等待下一真实周的有限补货。旧药不会变成新药，可以继续惩戒骑士生活。</p>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="律令法师指导与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <section aria-label="律令法师原瓶供给"><h3>独立原瓶与实际供给</h3><p>{value.supplies}</p>
      <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立律令法师原瓶" value={selectedBottle.id} disabled={locked}
        onChange={event => setBottleId(event.target.value)}>{value.bottles.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
      <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
      <div className="warrior-action-list" role="group" aria-label="当前律令法师原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
    </section>}
    {value.promoted && selectedCase && <section aria-label="律令法师有限生活实践"><h3>有限注意、同一FLASH暂剥与双方标线</h3>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前律令法师生活实践" value={selectedCase.id} disabled={locked || value.insideCase}
        onChange={event => setCaseId(event.target.value)}>{value.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {value.practice && <PracticeFacts practice={value.practice} />}
        {selectedCase.result && <section className="slice-notice" aria-label="律令法师实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前律令法师生活行动">{selectedCaseActions.map(actionButton)}</div>
        {value.insideCase && <p className="slice-muted">当前原人状态或原物尚待真实收束。须实际等到原人恢复、恢复原FLASH可用并核验资源，或解除双方禁令，再普通取还同一原物；0行动收束保持可用。撤回不瞬间清除残留，不传送，不退款，不抹去失败。</p>}
        <details className="seer-fold"><summary>已观察的事实与本次方法边界</summary>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}
          <p>{value.environment}</p>
          {selectedCase.id === "willing-attention" && <p>同一原成年阿伦在原椅与原桌旁重新同意一次有限注意试验，不认定他犯罪，也不授玩家官职。能力1行动、4灵性、知识18，成功产生3秒ATTENTION_HELD；失败RESISTED也付费，0秒。普通方法1行动、0灵性、知识10，是阿伦自愿注意。施用前撤回不收施用费；施用后撤回停止新增影响，既有3秒仍须实际经过。释放后同一人仍在原处自由注意，没有强制真实回答。</p>}
          {selectedCase.id === "one-borrowed-light" && <><p>原成年序列8戏法大师IM4-ELDEN-VALE埃尔登·维尔拥有自己的低功率FLASH，原灵性上限12。新原卡IM4-CARD-1在1米外桌上，同一原罩IM4-HOOD-1形成普通阴影，路线上无人。准备只声明一次试验，不施加效果。施用前至少需6灵性，原伙伴先实际花2灵性闪亮同一卡面，再尝试暂剥。</p>
            <p>能力1行动、4灵性、知识18，成功暂时禁止这同一原能力10秒；失败也付费。请先检验原FLASH：被暂剥则BLOCKED且不耗伙伴灵性，可用且足2灵性则实际发光LIT，资源不足则EXHAUSTED，不能把无资源当成剥夺证据。普通方法1行动、0灵性、知识10，仅用原罩遮光比较，不产生暂剥。</p>
            <p>恢复动作实际经过剩余10秒并撤除普通罩试验，原FLASH恢复可用；足2灵性才实际再次发光，不足则诚实记NO_RESOURCE。能力成功报告须同时具有真实BLOCKED与恢复后LIT。最后本人走1米取同一原卡与原罩，再走1米返回原导师，共2米。资源不足可先撤回准备，再让同一伙伴普通休息6小时；每一真实新周至多一次、1行动、恢复6灵性且不超过12，不恢复玩家资源，也不免费重置失败费用。</p></>}
          {selectedCase.id === "equal-line" && <p>新原标线IM4-LINE-1在原净空地面，原导师的同一IM4-TOKEN-1在跨线后2米的原桌上。能力1行动、3灵性、知识14，继承有限禁令对本人和阿伦采用同一条件。成功双方各停在0米；失败双方真实各跨2米，费用保留。普通方法1行动、0灵性、知识10，仅按可见线与口头约定自愿停步。解除先真实终止禁令并收起同一标线；已跨线时阿伦普通走2米回原处，本人带原木牌走2米回交。未跨线时本人解除后普通走2米取原木牌再走2米回交，因此完成一次本人共4米，阿伦共0或4米。没有永久屏障、锁死出口或物品传送。</p>}
          <p>观察、准备、施用、报告各1行动；准备尚未开始接触。失败保留费用，实际收束后到下一真实周再试，重新征得本人同意。三份成功且实际收束的报告各25，回顾25；能力报告只加对应掌握8且最多一次，第三案增加继承的禁令掌握，普通方法不增加能力掌握。</p>
        </details>
      </section>
    </section>}
    {value.promoted && <section className="slice-notice" aria-label="律令法师继承原记录"><h3>旧案、原人物、原物与原掌握继续保留</h3><p>{value.inheritedTools}</p>
      <p>仲裁人、治安官、审讯者、法官与惩戒骑士的原能力、掌握、失败和历史继续保留。旧软靶、标线与原纸不被新实践改写；旧阿伦本次重新同意，旧迪恩结局不重开。</p>
    </section>}
    {value.promoted && <section aria-label="律令法师可选交战"><h3>原外院中的罗温·凯尔</h3>
      {value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="律令法师交谈与迎战">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="律令法师能力与消化"><h3>有限威严与暂时剥夺</h3>
      <progress className="cryptologist-progress" aria-label="律令法师扮演进度" value={value.acting} max={100} />
      {value.abilities.map(ability => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p>{playerText("两项新能力掌握从0开始，本切片的具体有限用法与数值为G。下一序列混乱猎手3尚未获得，更高序列能力细节未知，不提前授予。")}</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>律令法师独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}>
      <h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>}
    <details className="seer-fold" aria-label={playerText("律令法师能力与使用范围")}><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>{playerText("继承的身体禁令、惩戒、囚禁与伤口宣判继续保留，但不凭名称生成任意效果、自动免疫或免费资源。本作未开放免费神话形态；完整配方和原著晋升仪式未知，不显示未核材料清单。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}

function EncounterFacts({ encounter: value }: { encounter: NonNullable<ImperativeMageProjection["encounter"]> }) {
  const status: Record<string, string> = { AVAILABLE: "尚未进入交战", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已沿原出口离开", LOST: "本人已死亡" };
  const body: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "仍活着，自行停止抵抗", DEAD: "同一原身体已死亡" };
  const outcome: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原出口撤退", ENEMY_DEAD: "原罗温死亡", ENEMY_SURRENDERED: "原罗温自行停止抵抗" };
  return <section aria-label="律令法师原罗温与实际费用"><p>{value.name} · {value.targetId} · 危险度约序列{value.sequence}</p>
    <dl className="seer-facts"><div><dt>当前遭遇</dt><dd>{status[value.status] ?? value.status}</dd></div>
      <div><dt>原身体健康 / 精神</dt><dd>{value.enemyHealth} / {value.enemyMind} · {body[value.enemyStatus] ?? value.enemyStatus}</dd></div>
      <div><dt>原敌人剩余灵性</dt><dd>{value.enemySpirituality} / 40</dd></div>
      <div><dt>原距离与退出路线</dt><dd>起始相距{value.distanceMetres}米 · {value.originalExit} · 无追逐 · 无旁人</dd></div>
      <div><dt>原短棍 IM4-ROWAN-CLUB</dt><dd>仍为罗温本人的原物，未传给玩家</dd></div></dl>
    <section className="slice-notice" aria-label="律令法师有限能力与实际花费" aria-live="polite" aria-atomic="true"><h4>当轮有限作用与真实资源</h4>
      <p>实际付费威慑尝试 {value.intimidationAttempts} 次 · 暂剥尝试 {value.deprivationAttempts} 次 · 继承惩戒强化 {value.punishmentUses} 次。</p>
      <p>当前威慑：{value.intimidationReady ? "只等待本轮下一次实际正向身体或弧光贡献" : "当前没有待生效威慑"}。当前原ARC：{value.deprivationReady ? "本轮暂不可用，后续对应动作回退真实BODY" : "未被暂剥，是否施放仍须足够原灵性"}。</p>
      <p>罗温当轮凝神：{value.composureReady ? "当前回合抵抗新的威慑与暂剥" : "当前没有凝神保护"}。保护只到本轮末。</p>
      <p>威严与暂剥各实际花4灵性、知识18检定，失败仍付费。威严只作用于本轮随后一次正向身体或弧光贡献，乘0.6；已有待用威严时不重复付费。</p>
      <p>暂剥只针对罗温本人的原ARC，至本轮末；他仍可持原短棍普通击打。凝神实际花3灵性，清除威严与暂剥并抵抗本轮新影响。原护术、凝神或事故不消耗待用威严。</p>
      <p>继承3灵性的身体禁令同样约束本人。只有真实身体动作才检查一次抵抗；ARC暂剥后实际回退的BODY同样接受检查。真实违禁且完成正值身体打击，才可另付3灵性强化一次本人惩戒；不能追改已发生动作或直接处死目标。</p>
    </section>
    <details className="seer-fold"><summary>原人的有限能力与现场</summary><p>{value.story}</p>
      {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 每次{ability.cost}灵性 · 已实际施放{value.powerUses[ability.id]}次 · {ability.available ? "当前原能力可用且灵性足够" : "当前原能力暂不可用或灵性不足"}</p>)}
      <p>敌人原灵性不足或原ARC暂不可用时采用持本人原短棍的普通动作，不免费施术、不跳过整次行动。临时状态到本轮末或终局结束，同一原ARC恢复可用；旧迪恩与旧战斗记录不重开。</p>
      {value.enemyInjuries.map(injury => <p key={injury.id}>原敌人伤势：{injury.id} · {injury.severity === "LIGHT" ? "轻伤" : "重伤"} · {injury.treatedRevision === null ? "尚未治疗" : "已有实际治疗记录"}</p>)}
    </details>
    {value.terminal && <p className="slice-notice">原战斗第{value.terminal.round}回合结束：{outcome[value.terminal.outcome] ?? value.terminal.outcome}。当时原敌人健康{value.terminal.enemyHealth}、精神{value.terminal.enemyMind}、灵性{value.terminal.enemySpirituality}；同一原身体结局、原棍与实际费用保留，不能重新开战。</p>}
  </section>;
}
