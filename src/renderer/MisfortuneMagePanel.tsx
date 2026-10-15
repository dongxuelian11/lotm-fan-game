import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { MisfortuneMageAction, MisfortuneMageCommand, MisfortuneMageProjection } from "../domain/misfortune-mage/types";
import type { WinnerProjection } from "../domain/winner/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已有公开观察与当次许可", PREPARED: "已准备，尚须实际执行",
  ACTIVE: "本次原物或接触仍未收束", EXAMINED: "已有本次结果，待真实收束与报告", RESOLVED: "已提交有限报告",
};
const BOTTLE_TYPES = ["POTION_WORK", "BUY_POTION", "CONSUME"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT"];
const CLEANUP_TYPES = ["SECURE_WEIGHT", "RETURN_BAG", "CLOSE", "WITHDRAW"];
const NEXT_CASE_TYPES = ["SECURE_WEIGHT", "RETURN_BAG", "CONFIRM_ACCOUNT", "PERFORM", "CLOSE", "REPORT", "PREPARE", "OBSERVE"];
const SOURCE_BOUNDARY = playerText("本阶段的晋升准备、有限能力与实际掌握见下方；每项操作仍须满足当前条件，并承担实际费用与风险。");

function LuckFacts({ luck }: { luck: WinnerProjection["luck"] }) {
  return <section className="slice-notice" aria-label="同一赢家积运账" aria-live="polite" aria-atomic="true"><h4>原赢家积运继续使用</h4>
    <p>{luck.summary}</p><dl className="seer-facts"><div><dt>实际储存 / 容量</dt><dd>{luck.stored} / {luck.capacity}</dd></div>
      <div><dt>真实累计积存</dt><dd>{luck.accumulated}</dd></div><div><dt>真实累计花费</dt><dd>{luck.spent}</dd></div>
      <div><dt>上次实际积运周</dt><dd>{luck.lastAccumulateWeek === null ? "尚未积运" : `第${luck.lastAccumulateWeek}周`}</dd></div></dl>
    <p>当前储存 = 累计积存 − 累计花费。晋升不重置或补满，不产生第二份积运；失败尝试已经花掉的积运不会退还，也不自动追加等额厄运债。</p>
  </section>;
}

/** Original stories and objects remain read-only; luck is the same live inherited ledger. */
export function MisfortuneMageWinnerHistory({ winner: value }: { winner: WinnerProjection }) {
  const counter = { GUIDE: "同一原木筹已在艾妲手中", TRAY: "同一原木筹在原软接盘内", CAUGHT: "同一原木筹已实际接稳" };
  const ring = { OWNER: "同一原环已在塞拉手中", MAT: "同一原环仍在原软垫上" };
  const note = { BLANK: "同一原纸尚未填写", WRITTEN: "同一原纸已写，尚未交回", HANDED_OVER: "同一原纸已实际交回" };
  return <section className="seer-panel warrior-panel" aria-label="赢家时期的经历"><h3>赢家时期的经历</h3>
    <p className="slice-notice">原艾妲·芬恩、原成年塞拉、原木筹、原环、原记录纸与独立原瓶继续保留。这里只回看旧实践与原奥德里冲突，不重新结算或复活旧对手。同一积运账仍记录后来真实的积存与花费。</p>
    <p>赢家扮演进度 {value.acting} · 消化：{value.digestion}</p><LuckFacts luck={value.luck} />
    <section aria-label="赢家原物与原接触"><h4>旧原物没有被新实践替换</h4><dl className="seer-facts">
      <div><dt>原木筹 WN5-COUNTER-1</dt><dd>{counter[value.practice.counter]}</dd></div>
      <div><dt>原环 WN5-RING-1</dt><dd>{ring[value.practice.ring]}</dd></div>
      <div><dt>原记录纸 WN5-NOTE-1</dt><dd>{note[value.practice.note]}</dd></div></dl></section>
    {value.cases.map(entry => <details className="seer-fold" key={entry.id}><summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>{entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}<p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>{entry.result && <p>原实际结果与报告：{entry.result}</p>}
    </details>)}
    {value.battle && <details className="seer-fold"><summary>原奥德里冲突记录</summary><p>原使用积运回合：{value.battle.lastLuckRound ?? "尚未实际使用"} · 原迟滞：{value.battle.staggerReady ? "原记录仍在" : "已结束或尚未产生"}。旧回合记录不会转给新费里斯。</p></details>}
    <details className="seer-fold"><summary>赢家独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>
    <details className="seer-fold"><summary>赢家原能力与故事</summary>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      {value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p></details>
    <p className="slice-muted">新豆袋需要塞拉重新同意当次投掷。旧原环、旧许可和旧敌人不会变成新的施术媒介、永久同意或重复奖励。</p>
  </section>;
}

export interface MisfortuneMagePanelProps {
  misfortuneMage: MisfortuneMageProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: MisfortuneMageCommand) => void;
  readOnly?: boolean;
}
type Confirmation = { action: MisfortuneMageAction; contextKey: string };

function PracticeFacts({ practice }: { practice: NonNullable<MisfortuneMageProjection["practice"]> }) {
  return <section className="slice-notice" aria-label="厄运法师本次原物与实际收束" aria-live="polite" aria-atomic="true"><h4>同一原物、本人路线与当次同意</h4>
    <dl className="seer-facts"><div><dt>原小砝码 MM4-WEIGHT-1</dt><dd>{practice.weight}</dd></div>
      <div><dt>原绳 MM4-CORD-1 与原软接盘</dt><dd>{practice.cord}</dd></div>
      <div><dt>塞拉的原豆袋 MM4-BAG-1</dt><dd>{practice.bag}</dd></div><div><dt>塞拉本人的当次同意</dt><dd>{practice.consent}</dd></div>
      <div><dt>本人实际取回路线</dt><dd>{practice.route}</dd></div><div><dt>同一原记录纸 MM4-NOTE-1</dt><dd>{practice.note}</dd></div></dl>
    {practice.history.length > 0 && <details className="seer-fold"><summary>真实警示、投掷、取回与核对记录</summary><ul>{practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul></details>}
  </section>;
}

/** Only local selection and review state live here. Resource, material and scene changes require committed projections. */
export function MisfortuneMagePanel({ misfortuneMage: value, resources, busy, blocked = false, error = null, onCommand, readOnly = false }: MisfortuneMagePanelProps) {
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
  const suitableNext = (action: MisfortuneMageAction) => action.command.type !== "WITHDRAW"
    && action.command.type !== "WITHDRAW_CONSENT"
    && !(action.command.type === "CONFIRM_ACCOUNT" && action.command.claim === "GUARANTEED");
  const sceneNext = NEXT_CASE_TYPES.map((type) => selectedCaseActions.find((action) => action.enabled && action.command.type === type && suitableNext(action))).find(Boolean);
  const nextAction = !value.promoted
    ? selectedBottleActions.find((action) => action.enabled && action.command.type === "CONSUME") ?? [...growthActions, ...selectedBottleActions].find((action) => action.enabled) ?? value.actions[0]
    : sceneNext ?? [...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions.find(suitableNext) ?? value.actions[0];
  const reviewBottleId = confirmation && "bottleId" in confirmation.action.command ? confirmation.action.command.bottleId : null;
  const reviewBottle = value.bottles.find((entry) => entry.id === reviewBottleId);
  function confirmationContext(action: MisfortuneMageAction): string {
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

  function actionButton(action: MisfortuneMageAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `misfortuneMage-reason-${action.id}` : undefined}
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
      {action.reason && <p className="seer-action-reason" id={`misfortuneMage-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  function confirm() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !liveConfirmation?.enabled || (reviewBottleId !== null && !reviewBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id); onCommand(liveConfirmation.command);
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要重复服药、投掷、积运或移动原物。"}
  </p>;
  const currentResources = <section aria-label={confirmingConsume ? "服药前当前资源" : "行动前当前资源"}><h4>你现在的状态</h4>
    <dl className="seer-facts"><div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
      <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div><div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
      <div><dt>污染</dt><dd>{value.pollution}</dd></div><div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div></dl>
  </section>;

  if (confirmation) return <section className="seer-panel warrior-panel misfortune-mage-panel seer-confirmation"
    aria-label={confirmingConsume ? "这瓶厄运法师魔药的服用确认" : "厄运法师真实迎战确认"} aria-busy={busy}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{confirmingConsume ? "这一独立原瓶由你决定是否服用" : "可选交战与真实风险"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmingConsume ? reviewBottle?.title ?? "原瓶已不可用" : "确认承担真实交战与死亡风险"}</h3>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {confirmingConsume ? <>
      {reviewBottle && <><p>原瓶：{reviewBottle.id}</p><p>来源：{reviewBottle.source}</p><p>{reviewBottle.status} · 服用成功率 {reviewBottle.chance}%</p></>}
      <section className="slice-notice seer-risk" aria-label="厄运法师服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>{SOURCE_BOUNDARY}</p><p>{playerText("完整配方与原著晋升仪式细节仍未知。艾妲·芬恩的专业准备、成品、指导与数值属于本作原创G，不能据此断言无需仪式。确认仅服用这一原瓶，无论成败均实际耗用。")}</p>
      <p>{value.bodyChange}</p><p>只有服药排异的健康与精神最低保留1，不保护真实战斗死亡。晋升不补满灵性，不重置原积运，不清除旧伤、污染或既往代价；可以暂不服用，继续赢家生活。</p>
    </> : <section className="slice-notice seer-risk" aria-label="厄运法师真实交战风险"><h4>可能重伤或死亡</h4>
      <p>原创成年序列5对手费里斯·洛恩在原报时铺后院2米外，持自己的MM4-FERRIS-CLUB原短棍，有40点有限灵性。原普通出口开放、无旁人、无追逐；也可以普通拒绝交手后离开。</p>
      <p>本轮默认保留积运。只有在实际战斗回合另选使用策略，首次符合条件的B或K才实付同一原积运1份与4灵性。B有限减势；K还需知识18检定，成功只减弱本轮随后下一次实际正向身体或弧光贡献，不立刻伤害，不取消敌人行动。</p>
      <p>费里斯可实付3灵性整顿心神，清除待生效厄运并抵抗本轮新的K。抵抗、失败和当轮没有可影响行动都不退已付费用。未使用的临时效果在回合末或终局结束，没有永久诅咒、必胜、重掷或额外等额厄运债。</p>
      <p>原现场没有松动物件或可借用灾源，不能凭空招灾。费里斯投降后仍持自己的原棍；旧奥德里不复活，塞拉的生活许可不适用于这场战斗。伤势与死亡沿用真实战斗规则，不受服药恢复底线保护。</p>
      <p>{playerText("这两项新实践及序列4强化全部为G延伸，不冒充已核原著技能。")}</p>
    </section>}
    {currentResources}{liveConfirmation?.reason && <p className="seer-action-reason" id="misfortuneMage-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{confirmingConsume ? "暂不服用" : "暂不迎战"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled} onClick={confirm}
        aria-describedby={liveConfirmation?.reason ? "misfortuneMage-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : confirmingConsume ? `确认服用「${reviewBottle?.title ?? "原瓶"}」` : "确认风险，开始真实交战"}</button></div>
    <p className="slice-muted">取消不会消耗本次原瓶或开始战斗。保存未确认时保留这一次操作，等待外层重试，不重复提交。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel misfortune-mage-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="厄运法师成长下一步"><span className="seer-seal">{value.promoted ? playerText("候选厄运法师4 · G延伸实践") : playerText("赢家5 → 候选厄运法师4")}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{readOnly ? "这里只回看已保存的原记录。" : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "当前没有可执行的成长行动。"}</p>
      <p>{value.digestion}</p><p className="slice-muted">{value.bodyChange}</p>{value.promoted && <p>扮演进度 {value.acting} · 当前灵性 {resources.spirituality} / {resources.maxSpirituality}</p>}
    </section>
    <section className="slice-notice" aria-label={playerText("厄运法师能力范围")}><h4>{playerText("当前能力与有限实践")}</h4><p>{SOURCE_BOUNDARY}</p>
      <p>{playerText("本切片新增的防患练习、有限厄运及所有序列4强化均为G延伸实践。已核低序列的被动幸运、灾难感知与精神风暴、节制积运继续继承；这不是完整原著厄运法师4。")}</p>
    </section>
    {!value.promoted && <section className="slice-notice" aria-label="厄运法师配方与成品边界"><h4>独立成品与真实成熟条件</h4>
      <p>{playerText("完整配方与原著晋升仪式细节仍未知。原导师艾妲·芬恩的专业准备、指导、成品与数值都是本作原创G，不能据此断言无需仪式。")}</p>
      <p>赢家消化100且晋升后满12真实整周，意志难度28。指导540便士、1行动；每瓶全价6800便士。五次真实劳务抵5300便士后仍付1500便士，逐瓶付款与独立服用各0行动。</p>
      <p>三瓶独立原瓶全部失败后，才可等待下一真实周的有限补货。旧药不会变成新药，可以继续赢家生活。</p>
    </section>}
    <LuckFacts luck={value.luck} />
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="厄运法师指导积运与成长行动">{growthActions.map(actionButton)}</div>}
    {!value.promoted && selectedBottle && <section aria-label="厄运法师原瓶供给"><h3>独立原瓶与实际供给</h3><p>{value.supplies}</p>
      <label className="warrior-case-picker">选择当前原瓶<select aria-label="选择独立厄运法师原瓶" value={selectedBottle.id} disabled={locked}
        onChange={event => setBottleId(event.target.value)}>{value.bottles.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {entry.status}</option>)}</select></label>
      <h4>{selectedBottle.title}</h4><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status}</p>
      <div className="warrior-action-list" role="group" aria-label="当前厄运法师原瓶劳务付款与独立服用">{selectedBottleActions.map(actionButton)}</div>
    </section>}
    {value.promoted && selectedCase && <section aria-label="厄运法师有限生活实践"><h3>有限警示、一次投掷与诚实记录</h3>
      <label className="warrior-case-picker">当前生活实践<select aria-label="选择当前厄运法师生活实践" value={selectedCase.id} disabled={locked || value.insideCase}
        onChange={event => setCaseId(event.target.value)}>{value.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="warrior-case-detail" aria-label={selectedCase.title}><h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen} · 实际结束 {selectedCase.closes} 次</p>
        {selectedCase.preparation && <p>本次实际准备：{selectedCase.preparation}</p>}
        {value.practice && <PracticeFacts practice={value.practice} />}
        {selectedCase.result && <section className="slice-notice" aria-label="厄运法师实际实践结果" aria-live="polite"><h5>本次尝试与报告</h5><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前厄运法师生活行动">{selectedCaseActions.map(actionButton)}</div>
        {value.insideCase && <p className="slice-muted">当前原物与接触尚待真实收束。先沿原路线取回原豆袋、用原绳安放原砝码或交还同一原纸；0行动收束保持可用。不退款，不传送，不抹去已付费用和失败。</p>}
        <details className="seer-fold"><summary>已观察的事实与本次方法边界</summary>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>尚无本次实际观察记录。</p>}
          <p>{value.environment}</p>
          {selectedCase.id === "uncertain-weight" && <p>艾妲只许可一次有边界的示范，原小砝码下无人。能力尝试花1行动、3灵性，知识18；失败只记录警示不明，不能当成确定未来。普通检查花1行动、0灵性，知识10。两种方法都须本人用同一完好原绳将原砝码放进原软接盘，再亲手把原砝码与原绳交回艾妲。失败后下周由在场主人重置同一原物，不能凭空换绳或自动归还。</p>}
          {selectedCase.id === "willing-throw" && <p>原成年塞拉重新同意这一次朝低桩的豆袋投掷，原环不动。能力尝试花1行动、5灵性与1份真实原积运，知识18；成功影响这一次实际投掷落空，失败则是未被影响的实际命中，费用不退。普通方法花1行动、0灵性，知识10，观察普通命中。每次原豆袋都落在2米外软垫，本人普通走2米取同一豆袋，再走2米回来亲手归还，共4米。投掷前撤回同意不投、不收费；投掷后撤回仍须取回原袋，不能复制原袋或控制塞拉思想。</p>}
          {selectedCase.id === "honest-forecast" && <p>只用普通方法，花1行动、0灵性、知识10，在同一MM4-NOTE-1记录实际警示、投掷、失败费用与原积运账。有限陈述LIMITED可核对；宣称保证未来GUARANTEED会被明确拒绝，原纸与接触保留，可更正，不奖励无限修改。核对通过后亲手交回同一原纸再报告，失败下周也只改同一张原纸。</p>}
          <p>三份有限报告各25，回顾25；只有能力成功且真实收束的相应报告各加8新掌握，最多一次。普通方法可完成切片，不增加能力掌握。没有概率之骰、重启、重掷、永久诅咒或指定必胜。</p>
        </details>
      </section>
    </section>}
    {value.promoted && <section className="slice-notice" aria-label="厄运法师继承原记录"><h3>旧故事、原物与同一积运继续保留</h3><p>{value.inheritedTools}</p>
      <p>怪物、机器、幸运者、灾祸教士与赢家的原能力、掌握、失败和历史继续保留。每真实周最多在贝克兰德原艾妲处安静节制积运一次，花1行动、0灵性，仅使同一原账增加1份且至多3份；所有接触都须先关闭。不会补健康、精神或灵性。</p>
    </section>}
    {value.promoted && <section aria-label="厄运法师可选交战"><h3>原后院中的费里斯·洛恩</h3>
      {value.encounter && <EncounterFacts encounter={value.encounter} />}
      <div className="warrior-action-list" role="group" aria-label="厄运法师交谈与迎战">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="厄运法师能力与消化"><h3>{playerText("当前实践与继承能力")}</h3>
      <progress className="cryptologist-progress" aria-label="厄运法师扮演进度" value={value.acting} max={100} />
      {value.abilities.map(ability => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p>{playerText("新防患练习与有限厄运的掌握从0开始；它们与本阶段加强数值均为G，不是已核原著新增能力。候选下一序列混乱行者3尚未获得。")}</p>
    </section>}
    {value.promoted && <details className="seer-fold"><summary>厄运法师独立原瓶 · 来源与去向</summary>{value.bottles.map(bottle => <article key={bottle.id}>
      <h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}<p>{value.supplies}</p></details>}
    <details className="seer-fold" aria-label={playerText("厄运法师能力与使用范围")}><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.risk}</p>
      <p>继承序列7被动幸运仍为独立波动，不花储备也不能用储备保证触发。序列6灾难感知、有限引灾与精神风暴继承，但原现场没有灾源时不能凭空造灾。序列5原积运真实耗尽后便不可继续付费施用。</p>
      <p>{playerText("原人物、物件、路线、新对手、检定、费用、有限数值与训练流程均为G。完整配方、晋升仪式、直接序列编号与完整职业技能表仍未核实，不把封印物混合表现改成普适权能。")}</p>
    </details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}

function EncounterFacts({ encounter: value }: { encounter: NonNullable<MisfortuneMageProjection["encounter"]> }) {
  const status: Record<string, string> = { AVAILABLE: "尚未进入交战", FIGHTING: "正在实际交战", RESOLVED: "已有实际结果", RETREATED: "本人已沿原出口离开", LOST: "本人已死亡" };
  const body: Record<string, string> = { RESISTING: "仍在抵抗", SURRENDERED: "仍活着，自行停止抵抗", DEAD: "同一原身体已死亡" };
  const outcome: Record<string, string> = { PLAYER_DEAD: "玩家原身体死亡", RETREATED: "本人沿原出口撤退", ENEMY_DEAD: "原费里斯死亡", ENEMY_SURRENDERED: "原费里斯自行停止抵抗" };
  return <section aria-label="厄运法师原费里斯与实际费用"><p>{value.name} · {value.targetId} · 危险度约序列{value.sequence}</p>
    <dl className="seer-facts"><div><dt>当前遭遇</dt><dd>{status[value.status] ?? value.status}</dd></div>
      <div><dt>原身体健康 / 精神</dt><dd>{value.enemyHealth} / {value.enemyMind} · {body[value.enemyStatus] ?? value.enemyStatus}</dd></div>
      <div><dt>原敌人剩余灵性</dt><dd>{value.enemySpirituality} / 40</dd></div>
      <div><dt>原距离与退出路线</dt><dd>起始相距{value.distanceMetres}米 · {value.originalExit} · 无追逐 · 无旁人</dd></div>
      <div><dt>原短棍 MM4-FERRIS-CLUB</dt><dd>仍为费里斯本人的原物，未传给玩家</dd></div></dl>
    <section className="slice-notice" aria-label="厄运法师本轮有限厄运" aria-live="polite" aria-atomic="true"><h4>本轮范围与实际花费</h4>
      <p>本轮默认保留积运；若在回合控制中明确选用，首次符合条件的B或K实付原积运1份与4灵性。B只有限减势；K需知识18并可能被抵抗，没有立即伤害或取消行动。</p>
      <p>原使用积运回合：{value.lastLuckRound ?? "尚未实际使用"} · 实际付费积运尝试 {value.luckAttempts} 次 · 有限厄运尝试 {value.misfortuneAttempts} 次。</p>
      <p>待生效厄运：{value.staggerReady ? "只等待本轮下一次实际正向身体或弧光贡献" : "当前没有待生效厄运"}。仅正向身体或弧光贡献能触发这一次减半；护术、意外与零贡献不触发。整顿心神会另行清除等待，未用效果在回合末或终局到期。</p>
      <p>费里斯当轮定心：{value.composureReady ? "当前回合抵抗新的有限厄运" : "当前没有定心保护"}。整顿心神实际花3灵性，清除待生效效果；保护只到本轮末，不永续。</p>
      <p>失败仍付费；没有可影响的后续行动不会退费，也不会改写已经发生的结果。继承被动幸运独立波动，不改变原积运，不保证命中。</p>
    </section>
    <details className="seer-fold"><summary>原人的有限能力与现场</summary><p>{value.story}</p>
      {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 每次{ability.cost}灵性 · 已实际施放{value.powerUses[ability.id]}次 · {ability.available ? "当前原灵性足够" : "当前不可使用"}</p>)}
      <p>原后院没有松动物件或可借用灾源。敌人原灵性不足时采用持本人原短棍的普通动作，不免费施术。旧奥德里与旧战斗记录不重开。</p>
      {value.enemyInjuries.map(injury => <p key={injury.id}>原敌人伤势：{injury.id} · {injury.severity === "LIGHT" ? "轻伤" : "重伤"} · {injury.treatedRevision === null ? "尚未治疗" : "已有实际治疗记录"}</p>)}
    </details>
    {value.terminal && <p className="slice-notice">原战斗第{value.terminal.round}回合结束：{outcome[value.terminal.outcome] ?? value.terminal.outcome}。当时原敌人健康{value.terminal.enemyHealth}、精神{value.terminal.enemyMind}、灵性{value.terminal.enemySpirituality}；同一原身体结局与实际费用保留，不能重新开战。</p>}
  </section>;
}

export default MisfortuneMagePanel;
