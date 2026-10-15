import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { AncientAlchemistAction, AncientAlchemistCommand, AncientAlchemistProjection } from "../domain/ancient-alchemist/types";
import type { DruidProjection } from "../domain/druid/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已有实际观察", PREPARED: "已准备，尚未实际施用",
  ACTIVE: "同一原样品仍待实际收束", EXAMINED: "已有结果，待实际收束与报告", RESOLVED: "已提交有限报告",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT"];
const CLEANUP_TYPES = ["OBSERVE_RECOVERY", "TEST_MATRIX", "STOP_MATRIX", "RETURN_SAMPLE", "HAND_OVER", "CLOSE", "WITHDRAW"];
const NEXT_CASE_TYPES = ["OBSERVE_RECOVERY", "TEST_MATRIX", "STOP_MATRIX", "RETURN_SAMPLE", "HAND_OVER", "PERFORM", "CLOSE", "REPORT", "PREPARE", "BUY_KIT", "OBSERVE"];
const SOURCE_BOUNDARY = playerText("古代炼金师属于母亲途径，也称古典炼金师、人体炼金师，以生命炼成为方向，与通识者途径的炼金术士不同。晋升须取得独立成品并完成专业准备；下一序列抬棺人的能力不在本页开放。");

/** Read the same S5 record without offering any historical mutation controls. */
export function AncientAlchemistDruidHistory({ druid: value }: { druid: DruidProjection }) {
  const position = { NEAR: "本人在原近端", FAR: "本人仍在原远端" };
  const marker = { BOX: "同一原标记已收入原盒（BOX）", NEAR: "同一原标记仍在近端", FAR: "同一原标记仍在远端" };
  const soil = { SETTLED: "原普通壤土已稳定（SETTLED）", SOFTENED: "原普通壤土仍处软化状态" };
  const seedlings = { RESTING: "原双苗仍在原地休养（RESTING）", OBSERVED: "同一原双苗已有当时观察" };
  const note = { BLANK: "同一原记录纸尚未填写", WRITTEN: "同一原记录纸已写，尚未交回", HANDED_OVER: "同一原记录纸已实际交回伊芙（HANDED_OVER）" };
  return <section className="seer-panel warrior-panel" aria-label="德鲁伊时期的经历"><h3>德鲁伊时期的经历</h3>
    <p className="slice-notice">原导师伊芙·莫兰、原普通壤土、原标记、原双苗与原记录纸继续保留。这里只回看旧实践与原马伦结局，不重新结算、重发奖励或重开旧战斗；失败、独立原瓶与实际费用不抹去。</p>
    <p>德鲁伊扮演进度 {value.acting} · 消化：{value.digestion}</p>
    <section aria-label="德鲁伊原物与原地面"><h4>原地面、原双苗和同一记录</h4><dl className="seer-facts">
      <div><dt>原身体位置</dt><dd>{position[value.practice.position]}</dd></div>
      <div><dt>原标记与原盒</dt><dd>{marker[value.practice.marker]}</dd></div>
      <div><dt>原普通壤土</dt><dd>{soil[value.practice.soil]}</dd></div>
      <div><dt>原双苗</dt><dd>{seedlings[value.practice.seedlings]}</dd></div>
      <div><dt>同一原记录纸</dt><dd>{note[value.practice.note]}</dd></div></dl></section>
    {value.cases.map(entry => <details className="seer-fold" key={entry.id}><summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>{entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>{entry.result && <p>原实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold"><summary>德鲁伊原资料研习与晋升记录</summary>
      {value.studies.map(study => <article key={study.id}><h4>{study.title}</h4><p>{study.source}</p><p>{study.creatures.join("、")}</p><p>{study.status}</p></article>)}
      <p>{value.ritual.notebook}</p><p>{value.ritual.recordStatus}</p><p>{value.ritual.readyStatus}</p><p>{value.ritual.summary}</p><p>实际准备 {value.ritual.attempts} 次</p>
    </details>
    <details className="seer-fold"><summary>德鲁伊独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>
    <details className="seer-fold"><summary>德鲁伊原能力与故事</summary>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      {value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p></details>
    <p className="slice-muted">原地下潜行、生命扶持与更早掌握保留。这里的原双苗没有被改写为新案样品，旧资料与许可不会凭空生成新材料、动物变形或完整配方。</p>
  </section>;
}

function PracticeFacts({ practice }: { practice: NonNullable<AncientAlchemistProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="古代炼金师本次原材料与实际收束" aria-live="polite" aria-atomic="true"><h4>同一原材料、实际期限与取还</h4>
    <dl className="seer-facts"><div><dt>已准备的独立原材料包</dt><dd>{practice.kits}</dd></div>
      <div><dt>原活植 AA4-STEM-1</dt><dd>{practice.stem}</dd></div>
      <div><dt>原托盘 AA4-TRAY-1 与短期纤维</dt><dd>{practice.matrix}</dd></div>
      <div><dt>原记录纸 AA4-RECORD-1 与诺拉·贝尔</dt><dd>{practice.report}</dd></div>
      <div><dt>实际经过时间与普通取还路线</dt><dd>{practice.route}</dd></div>
      <div><dt>原护腕与三段有限资源</dt><dd>{practice.guard}</dd></div></dl>
    {practice.history.length > 0 && <details className="seer-fold"><summary>实际耗材、观察、停止与原物交还记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

export interface AncientAlchemistPanelProps {
  ancientAlchemist: AncientAlchemistProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: AncientAlchemistCommand) => void;
  readOnly?: boolean;
}
type Confirmation = { action: AncientAlchemistAction; contextKey: string };

/** Only local selection and review state live here. Resource, material and scene changes require committed projections. */
export function AncientAlchemistPanel({ ancientAlchemist: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: AncientAlchemistPanelProps) {
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
  const suitableNext = (action: AncientAlchemistAction) => action.command.type !== "WITHDRAW";
  const sceneNext = NEXT_CASE_TYPES.map((type) => selectedCaseActions.find((action) => action.enabled && action.command.type === type && suitableNext(action))).find(Boolean);
  const nextAction = !value.promoted
    ? selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME") ?? [...growthActions, ...selectedBottleActions].find((action) => action.enabled) ?? value.actions[0]
    : sceneNext ?? [...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions.find(suitableNext) ?? value.actions[0];
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  function confirmationContext(action: AncientAlchemistAction): string {
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

  function actionButton(action: AncientAlchemistAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `ancientAlchemist-reason-${action.id}` : undefined}
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
      {action.reason && <p className="seer-action-reason" id={`ancientAlchemist-reason-${action.id}`}>{action.reason}</p>}
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

  if (confirmation) return <section className="seer-panel warrior-panel ancient-alchemist-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶古代炼金师魔药的服用确认" : "古代炼金师真实迎战确认"} aria-busy={busy}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : "可选交战与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="古代炼金师服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{SOURCE_BOUNDARY}</p><p>{playerText("伊芙·莫兰的专业准备、独立成品与指导属于本作原创G，不能据此断言无需仪式。确认仅服用这一原瓶，无论成败均实际耗用。")}</p>
      <p>{value.bodyChange}</p><p>只有服药排异的健康与精神最低保留1，不保护真实战斗死亡。晋升不补满灵性，不清除旧伤、污染、原物去向或既往代价；可以暂不服用，继续德鲁伊生活。</p>
    </> : <section className="slice-notice seer-risk" aria-label="古代炼金师真实交战风险"><h4>可能重伤或死亡</h4>
      <p>{playerText("原创成年序列5对手奥斯里克·维尔在已知普通浅壤土原边庭2米外，持自己的AA4-OSRIC-CLUB原短棍，有40点有限灵性。原普通侧门开放、无旁人、无追逐；也可以普通拒绝交手后离开。")}</p>
      <p>原护腕须战前真实制作：1行动、120便士、4灵性并消耗一个独立原材料包，得到3段一次性基质。B再付4灵性、知识18并实耗一段，成功只让随后一次正向BODY或ARC贡献乘0.6；失败照常消耗。已有待用防护时不重复付费；无原段或灵性不足时回退旧普通观察。</p>
      <p>每段激活后最多60秒，至回合末结束；自用护术、普通凝神或事故不消耗待用防护，不叠加、不自动补充。耗尽的是同一护腕中的原段，残体仍保留，须实际交回才能重新制作。</p>
      <p>K继承地下潜行，在这块已知原普通壤土内付3灵性、知识14尝试有限身体动作，不能埋敌或移走敌人。R仅在本人实际受伤、健康不足100时另付4灵性扶持生命，恢复受既有掌握与原上限限制；健康已满不花费，也不会凭空制造伤口。</p>
      <p>H与J继续原德鲁伊身体动作；奥斯里克自己的弧光与护术有实际费用，灵性不足时仍可持自己的原棍普通击打。普通凝神不被说成控制心智。旧马伦与旧战斗记录不重开，伤势与死亡沿用共同战斗规则。</p>
    </section>}
    {currentResources}{liveConfirmation?.reason && <p className="seer-action-reason" id="ancientAlchemist-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "ancientAlchemist-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : "确认风险，开始真实交战"}</button></div>
    <p className="slice-muted">取消不会消耗本次原瓶或开始战斗。保存未确认时保留这一次操作，等待外层重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel ancient-alchemist-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="古代炼金师成长下一步"><span className="seer-seal">{value.promoted ? playerText("古代炼金师4 · 有限G实践") : "德鲁伊5 → 古代炼金师4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">{value.bodyChange}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    <section className="slice-notice" aria-label={playerText("古代炼金师能力范围")}><h4>{playerText("生命炼成与有限实践")}</h4><p>{SOURCE_BOUNDARY}</p>
      <p>不开放复活死者、创造人格或灵魂、任意动物变形、无限食物或自行作战的生命军团。老尼尔的复活尝试、混途径生命手杖与弗兰克创造灵魂的研究目标，都不能当作本职业已掌握的安全技术或完整配方。</p>
    </section>
    {!value.promoted && <section className="slice-notice" aria-label="古代炼金师配方与成品边界"><h4>独立成品与真实成熟条件</h4>
      <p>{playerText("完整配方与原著晋升仪式细节仍未知。原导师伊芙·莫兰的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。")}</p>
      <p>德鲁伊消化100且晋升后满12真实整周，意志难度28。指导540便士、1行动；每瓶全价6800便士。五次真实劳务抵5300便士后仍付1500便士，逐瓶付款与独立服用各0行动。</p>
      <p>三瓶独立原瓶全部失败后，才可等待下一真实周的有限补货。旧药不会变成新药，可以继续德鲁伊生活。</p>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="古代炼金师指导与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <section aria-label="古代炼金师原瓶供给"><h3>独立原瓶与实际供给</h3><p>{value.supplies}</p>
      <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立古代炼金师原瓶" value={selectedBottle.id} disabled={locked}
        onChange={event => setBottleId(event.target.value)}>{value.bottles.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
      <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
      <div className="warrior-action-list" role="group" aria-label="当前古代炼金师原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
    </section>}
    {value.promoted && value.practice && <PracticeFacts practice={value.practice} />}
    {value.promoted && selectedCase && <section aria-label="古代炼金师有限生活实践"><h3>原活植、短期纤维与诚实交接</h3>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前古代炼金师生活实践" value={selectedCase.id} disabled={locked || value.insideCase}
        onChange={event => setCaseId(event.target.value)}>{value.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {selectedCase.result && <section className="slice-notice" aria-label="古代炼金师实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前古代炼金师生活行动">{selectedCaseActions.map(actionButton)}</div>
        {value.insideCase && <p className="slice-muted">同一原样品仍待实际收束：完成原活植短期观察，或检验并停止原基质，再归还原样品；报告须交给原收件人。0行动收束保持可用，但不免除实际等待、搬运和交接。撤回不退款、不补材料、不抹去失败。</p>}
        <details className="seer-fold"><summary>已观察的事实与本次方法边界</summary>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}
          <p>{value.environment}</p>
          {selectedCase.id === "living-stem" && <p>新原活植AA4-STEM-1一直活着，原茎已有浅表损伤，仍在伊芙的同一原盆。先用1行动、80便士购买有稳定ID的独立材料包，再选择方法；施用无论成败均消耗这一包。能力4灵性、知识18只有限稳定原损伤；普通方法0灵性、知识10只做普通支撑绑扎。之后实际观察6小时，再结束本人保管并归还未用普通夹具。短期观察不等于永久治愈，失败原损伤可见，不替换植物、不把它复活。</p>}
          {selectedCase.id === "living-fibre" && <p>{playerText("先实际购买另一独立材料包；能力4灵性、知识18在原托盘AA4-TRAY-1形成有独立ID、最多60秒有限反应的原创G有机基质，没有心智、灵魂或独立人格。普通方法0灵性、知识10做非活性编织垫。用同一0.5千克试重块滑动一次，实际耗时10秒；成功基质有限收缩支撑，不能推出无限力量。停止动作实际经过剩余期限，保留同一惰性残体，不能复活或充能。本人走1米取残体，再走1米回交原废料容器，共2米；试重块与托盘留在原台。")}</p>}
          {selectedCase.id === "honest-handover" && <p>前两份报告真实完成后，核对实际材料包ID、原活植6小时观察与原基质60秒结果，在同一AA4-RECORD-1原纸上写出有限发现。两种方法都只做普通核对，0灵性、知识10，不虚记能力掌握。本人走2米将原纸交给自愿接收的原成年助手AA4-NORA-BELL诺拉·贝尔，再走2米返回，共4米；只有如实限定的记录才获接收，不能宣称永久生命或造魂。</p>}
          <p>观察、准备、施用、报告各1行动；实际收束0行动。失败保留原费用，收束后到下一真实周另取材料重试。初始三包各自登记，全部耗尽且无人持有后才可申请下一真实周新批次，不在施用时免费生成材料。三份成功并收束的报告各25，回顾25；前两案成功能力报告各给对应掌握8且最多一次，普通方法与第三案不虚增能力掌握。</p>
        </details>
      </section>
    </section>}
    {value.promoted && <section className="slice-notice" aria-label="古代炼金师原护腕与有限制作"><h3>同一原护腕，仅有三段</h3>
      <p>战外用独立AA4-GUARD-KIT材料包，付1行动、120便士与4灵性制作一只AA4-GUARD护腕；同一框体含3段独立一次性基质。晋升不自动赠送成品，案内或交战中不能制作，现有护腕未耗尽并实际交回前不能替换。</p>
      <p>B每次激活还须4灵性并实耗一段，知识18，失败仍耗；成功仅防护随后一次正向身体或弧光贡献，乘0.6。每段最多60秒且至回合末到期，没有自动补满。耗尽的原框体与惰性段仍在本人手中，须走1米交回再走1米返回。</p>
    </section>}
    {value.promoted && <section className="slice-notice" aria-label="古代炼金师继承原记录"><h3>旧原物、原掌握和原结果继续保留</h3><p>{value.inheritedTools}</p>
      <p>耕种者、医师、丰收祭司、生物学家与德鲁伊的原能力、掌握、失败和历史继续保留。原马伦结局不重开，原双苗、原土、标记与报告不被新案改写。</p>
    </section>}
    {value.promoted && <section aria-label="古代炼金师可选交战"><h3>原边庭中的奥斯里克·维尔</h3>
      {value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="古代炼金师交谈与迎战">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="古代炼金师能力与消化"><h3>有限生命缝合与短期活性基质</h3>
      <progress className="cryptologist-progress" aria-label="古代炼金师扮演进度" value={value.acting} max={100} />
      {value.abilities.map(ability => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p>{playerText("两项新能力掌握从0开始，具体有限用法与数值为G。下一序列抬棺人3尚未获得，不提前授予其能力。")}</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>古代炼金师独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}>
      <h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>}
    <details className="seer-fold" aria-label={playerText("古代炼金师能力与使用范围")}><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>{playerText("完整配方和原著晋升仪式未知，不显示未核材料清单。原材料包中虚构的已处理有机介质与纤维不构成现实生物制作操作说明；不开放免费神话形态、无限生命或造魂。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}

function EncounterFacts({ encounter: value }: { encounter: NonNullable<AncientAlchemistProjection["encounter"]> }) {
  const status: Record<string, string> = { AVAILABLE: "尚未进入交战", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已沿原出口离开", LOST: "本人已死亡" };
  const body: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "仍活着，自行停止抵抗", DEAD: "同一原身体已死亡" };
  const outcome: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原出口撤退", ENEMY_DEAD: "原奥斯里克死亡", ENEMY_SURRENDERED: "原奥斯里克自行停止抵抗" };
  return <section aria-label="古代炼金师原奥斯里克与实际费用"><p>{value.name} · {value.targetId} · 危险度约序列{value.sequence}</p>
    <dl className="seer-facts"><div><dt>当前遭遇</dt><dd>{status[value.status] ?? value.status}</dd></div>
      <div><dt>原身体健康 / 精神</dt><dd>{value.enemyHealth} / {value.enemyMind} · {body[value.enemyStatus] ?? value.enemyStatus}</dd></div>
      <div><dt>原敌人剩余灵性</dt><dd>{value.enemySpirituality} / 40</dd></div>
      <div><dt>原距离与退出路线</dt><dd>起始相距{value.distanceMetres}米 · {value.originalExit} · 无追逐 · 无旁人</dd></div>
      <div><dt>原短棍 AA4-OSRIC-CLUB</dt><dd>仍为奥斯里克本人的原物，未传给玩家</dd></div></dl>
    <section className="slice-notice" aria-label="古代炼金师有限防护与实际花费" aria-live="polite" aria-atomic="true"><h4>本轮原护腕的实际作用</h4>
      <p>已实际尝试防护 {value.guardAttempts} 次，失败同样消耗原段与4灵性。</p>
      <p>{value.guardReady ? `同一护腕 ${value.guardReady.guardId} 的原段 ${value.guardReady.segmentId} 已耗用，当前只等待本轮随后一次正向BODY或ARC贡献；有效时该次贡献乘0.6。` : "当前没有待生效防护。已耗用原段不会恢复，不自动补充。"}</p>
      <p>每段激活最多60秒，回合末与终局实际到期；没有后续合格攻击也不退款。原段不是独立生物，不自行攻击、不恢复本人健康。</p>
    </section>
    <details className="seer-fold"><summary>原人的有限能力与现场</summary><p>{value.story}</p>
      {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 每次{ability.cost}灵性 · 已实际施放{value.powerUses[ability.id]}次 · {ability.available ? "当前原能力可用且灵性足够" : "当前原能力不可用或灵性不足"}</p>)}
      <p>灵性不足时原敌人仍可持原短棍普通击打，0灵性；不免费施术、不跳过整次行动。普通凝神不清除原护腕或虚构精神控制。</p>
      {value.enemyInjuries.map(injury => <p key={injury.id}>原敌人伤势：{injury.id} · {injury.severity === "LIGHT" ? "轻伤" : "重伤"} · {injury.treatedRevision === null ? "尚未治疗" : "已有实际治疗记录"}</p>)}
    </details>
    {value.terminal && <p className="slice-notice">原战斗第{value.terminal.round}回合结束：{outcome[value.terminal.outcome] ?? value.terminal.outcome}。当时原敌人健康{value.terminal.enemyHealth}、精神{value.terminal.enemyMind}、灵性{value.terminal.enemySpirituality}；同一原身体结局、原棍与实际费用保留，不能重新开战。</p>}
  </section>;
}
