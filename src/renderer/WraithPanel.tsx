import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WraithAction, WraithCommand, WraithProjection } from "../domain/wraith/types";
import type { ZombieProjection } from "../domain/zombie/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次现场", OBSERVED: "已有公开观察与现场边界", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，请完成收束再报告", RESOLVED: "已实际收束并提交有限报告",
};
const FORM_LABELS = { HUMAN: "本人已显现为人形", WRAITH: "本人当前处于怨魂形态" } as const;
const NODE_LABELS = { ROOM: "原工坊室内（ROOM）", ALCOVE: "四米外原壁龛（ALCOVE）" } as const;
const MIRROR_LABELS = { COVERED: "原室镜与原壁龛镜均已盖好", OPEN: "原室镜与原壁龛镜均已揭开，保留实际反射端点" } as const;
const HOST_LABELS = { SELF: "本人没有附在诺兰身上", NOLAN: "本人仍附在原成年参与者诺兰身上，须实际退出" } as const;
const FLAG_LABELS = { TABLE: "同一原信号旗 WF5-FLAG-1 在原桌上", RAISED: "同一原信号旗 WF5-FLAG-1 已举起，尚未放回原桌" } as const;
const NOTE_LABELS = { BLANK: "同一原记录纸 WF5-NOTE-1 尚未写本次记录", WRITTEN: "同一原记录纸 WF5-NOTE-1 已写，尚未交回", HANDED_OVER: "同一原记录纸 WF5-NOTE-1 已实际交回" } as const;
const OLD_BODY_LABELS = { NORMAL: "本人处于日常姿态", BRACED: "本人仍在承受原负荷" } as const;
const OLD_COLD_LABELS = { NONE: "原冷盘尚无本次薄霜", ICED: "同一原冷盘仍有本次薄霜", THAWED: "同一原冷盘已实际回温" } as const;
const OLD_SPIRIT_LABELS = { ABSENT: "本次尚未接触赫姆", PRESENT: "原有幽魂赫姆仍在本次有限接触中", RELEASED: "已实际解除与赫姆的本次接触" } as const;

/** Original S6 results, costs and objects remain read-only historical facts. */
export function WraithZombieHistory({ zombie,currentTitle="怨魂（序列5）" }: { zombie: ZombieProjection;currentTitle?:string }) {
  return <section className="seer-panel wraith-panel" aria-label="活尸时期的经历">
    <h3>活尸时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留活尸时期的原故事、承力、冷盘、赫姆接触、失败、月圆代价与独立原瓶，只供回看。{currentTitle.includes("木偶")?playerText("当前木偶4具体原著诅咒未核，按当前页明确G公告处理；旧发作不叠加。"):"怨魂的新诅咒替代旧阶段诅咒，旧记录与能力掌握继续保留。"}</p>
    <p>活尸扮演进度 {zombie.acting} · 消化：{zombie.digestion}</p>
    {zombie.story && <p>{zombie.story}</p>}
    {zombie.environment && <p>{zombie.environment}</p>}
    {zombie.supplies && <p>{zombie.supplies}</p>}
    <details className="seer-fold" aria-label="活尸原承力、冷盘与幽魂记录">
      <summary>原承力、冷盘与幽魂接触</summary>
      <dl className="seer-facts">
        <div><dt>原身体姿态</dt><dd>{OLD_BODY_LABELS[zombie.practice.body]}</dd></div>
        <div><dt>同一原冷盘</dt><dd>{OLD_COLD_LABELS[zombie.practice.cold]}</dd></div>
        <div><dt>原赫姆接触</dt><dd>{OLD_SPIRIT_LABELS[zombie.practice.spirit]}</dd></div>
        <div><dt>原污染记录</dt><dd>{zombie.pollution}</dd></div>
      </dl>
    </details>
    {zombie.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold" aria-label="活尸原月圆记录">
      <summary>活尸原月圆记录 · 仅作历史保留</summary>
      <p>{zombie.moon.summary}</p>
      <p className="slice-muted">原阶段记录状态：{zombie.moon.pending ? "当时尚有待处理记录" : "当时没有待处理记录"}。当前发作以怨魂卷宗为准，不重新收取活尸剧痛或狼人嗜血的旧成本。</p>
      {zombie.moon.history.map((entry, index) => <p key={`${entry.week}-${index}`}>第{entry.week}周 · {entry.method === "GUARDED" ? "原哈伦工坊看守过夜" : "原地点停止接触并独自过夜"} · 原实际精神消耗{entry.mentalCost}</p>)}
    </details>
    {zombie.bottles.length > 0 && <details className="seer-fold">
      <summary>活尸原瓶 · 来源与去向</summary>
      {zombie.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {zombie.risk && <details className="seer-fold"><summary>活尸原服用风险</summary><p>{zombie.risk}</p></details>}
    {zombie.abilities.length > 0 && <details className="seer-fold">
      <summary>活尸时期能力记录</summary>
      {zombie.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">旧实践不重新结算或发奖，不重置原冷盘、赫姆、原瓶或里德冲突的实际后果。新镜面与附体实践不会覆盖旧失败、风险或掌握。</p>
  </section>;
}

export interface WraithPanelProps {
  wraith: WraithProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: WraithCommand) => void;
}
function isCaseAction(action: WraithAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: WraithAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function allowedCaseAction(action: WraithAction): boolean {
  return action.command.type !== "PREPARE" || action.command.caseId !== "honest-account" || action.command.method === "ORDINARY";
}

/** Local selection never changes a saved form, host, endpoint, flag, note or cost. */
export function WraithPanel({ wraith, resources, busy, blocked = false, error = null, onCommand }: WraithPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = wraith.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = wraith.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = wraith.actions.filter(isCaseAction).filter(allowedCaseAction);
  // An actual CLOSE intent identifies its own contact; prose and old cases do not.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const moonPending = wraith.moon.pending;
  const physicalContactOpen = wraith.practice.form !== "HUMAN" || wraith.practice.node !== "ROOM"
    || wraith.practice.mirror !== "COVERED" || wraith.practice.host !== "SELF" || wraith.practice.flag !== "TABLE" || wraith.practice.note === "WRITTEN";
  const insidePractice = !!closeAction || physicalContactOpen || (wraith.insideCase && !moonPending);
  const sceneLocked = insidePractice || moonPending;
  const selectedCase = (insidePractice ? wraith.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? wraith.cases.find((entry) => entry.id === selectedCaseId)
    ?? wraith.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? wraith.cases[0];
  const selectedCaseActions = selectedCase && (!moonPending || insidePractice) ? caseActions.filter((action) => "caseId" in action.command
    && action.command.caseId === selectedCase.id && (!insidePractice || action.command.type === "CLOSE")) : [];
  const moonActions = moonPending && !insidePractice ? wraith.actions.filter((action) => action.command.type === "HANDLE_MOON") : [];
  const encounterActions = sceneLocked ? [] : wraith.actions.filter(isEncounterAction);
  const growthActions = sceneLocked ? [] : wraith.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "HANDLE_MOON" && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = insidePractice ? closeAction : moonPending ? moonActions.find((action) => action.enabled) ?? moonActions[0]
    : !wraith.promoted ? wraith.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0] ?? encounterActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !wraith.promoted && !sceneLocked;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (insidePractice || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, insidePractice]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || wraith.promoted || sceneLocked)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, wraith.promoted, sceneLocked]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: WraithAction) {
    if (busy || interactionBlocked || sceneLocked || wraith.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || wraith.promoted || sceneLocked) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: WraithAction) {
    const unavailable = insidePractice ? action.command.type !== "CLOSE" : moonPending && action.command.type !== "HANDLE_MOON";
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className={sceneLocked ? "slice-choice primary" : "slice-choice"} disabled={busy || interactionBlocked || unavailable || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || unavailable || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `wraith-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`wraith-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel wraith-panel seer-confirmation" aria-label="这瓶怨魂魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="怨魂服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{wraith.risk}</p>
      <p>晋升后怨魂月圆诅咒替代活尸、狼人、疯子的旧诅咒。选择不伤害他人时仍须承受极端虚弱，实际度过本次发作后才能继续；消化与看守不永久解除诅咒。</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{wraith.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="wraith-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "wraith-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel wraith-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="怨魂成长下一步">
      <span className="seer-seal">{wraith.promoted ? "序列 5" : "怨魂晋升卷宗"}</span><h3>{wraith.title}</h3>
      <p className="seer-next">{insidePractice
        ? <><strong>先实际返回或退出本次接触：</strong>{nextAction?.label || "查看当前公开的结束实践选项"}。结束为0行动、0精神、0灵性，保留已付成本。</>
        : moonPending ? <><strong>先度过本次月圆虚弱：</strong>{nextAction?.label || "查看当前公开月圆处理选项"}。极端虚弱期间不能战斗或进行普通活动，须先实际等过本次发作。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : wraith.promoted && wraith.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{wraith.digestion}</p>
    </section>

    {wraith.promoted && <section className="slice-notice" aria-label="怨魂月圆极端虚弱与实际度过">
      <h4>{moonPending ? "本次月圆极端虚弱尚未度过" : "怨魂月圆诅咒"}</h4>
      <p>{wraith.moon.summary}</p>
      {moonPending && <p>当前选择不伤害他人，须实际承受并度过极端虚弱；不会自动生成受害者，也不会通过扮演进度抹去本次发作。</p>}
      {moonActions.length > 0 && <div role="group" aria-label="本次怨魂月圆处理选择">{moonActions.map(actionButton)}</div>}
      <details className="seer-fold"><summary>虚弱代价与已公示事件</summary>
        <p>{playerText("怨魂新诅咒替代旧阶段诅咒，不叠加活尸剧痛、狼人嗜血或疯子旧成本。沿用八项已提前公示的有限G月相事件，不按每四周推算；后续未展开不代表诅咒消失。")}</p>
        <p>看守协助仅在贝克兰德原哈伦工坊、哈伦实际可提供协助时开放，扣除当前精神与10中的较小值；独自在当前地点承受则扣除当前精神与20中的较小值。两种方式均实际等过本次有限发作，耗0行动、0灵性，精神为0仍可结束。</p>
        <p>{playerText("不恢复健康或灵性，不增加扮演，不伤害他人，不退还既有成本；处理一次只结束当次发作。有限时段、看守与具体成本为本作原创G，不宣称原著有固定无风险解咒办法。")}</p>
      </details>
      {wraith.moon.history.length > 0 && <details className="seer-fold"><summary>已经实际度过的怨魂月圆</summary>
        {wraith.moon.history.map((entry, index) => <p key={`${entry.week}-${index}`}>第{entry.week}周 · {entry.method === "GUARDED" ? "原哈伦工坊协助承受并等过虚弱" : "原地点独自承受并等过虚弱"} · 实际精神消耗{entry.mentalCost}</p>)}
      </details>}
    </section>}

    {wraith.promoted && wraith.environment && <section aria-label="当前怨魂现场"><h4>当前现场</h4><p>{wraith.environment}</p></section>}
    {wraith.promoted && <section aria-label="已保存的形态、端点、附体与原物状态">
      <h4>当前公开状态</h4>
      <dl className="seer-facts">
        <div><dt>本人形态</dt><dd>{FORM_LABELS[wraith.practice.form]}</dd></div>
        <div><dt>本人所在端点</dt><dd>{NODE_LABELS[wraith.practice.node]}</dd></div>
        <div><dt>两面原镜</dt><dd>{MIRROR_LABELS[wraith.practice.mirror]}</dd></div>
        <div><dt>当前附体</dt><dd>{HOST_LABELS[wraith.practice.host]}</dd></div>
        <div><dt>原信号旗</dt><dd>{FLAG_LABELS[wraith.practice.flag]}</dd></div>
        <div><dt>原记录纸</dt><dd>{NOTE_LABELS[wraith.practice.note]}</dd></div>
      </dl>
      <p className="slice-muted">原室镜 WF5-MIRROR-ROOM 与原壁龛镜 WF5-MIRROR-ALCOVE 相距4米，两处有同一条安全普通侧廊相连。没有把另一具身体留在出发点。</p>
    </section>}
    {selectedCase && (!moonPending || insidePractice) && <section aria-label="怨魂有限实践">
      <h3>同一双镜、一次自愿举旗与如实记录</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || sceneLocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {wraith.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前怨魂实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对原现场、参与者与真实退路。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前跳跃、附体、举旗或写好记录。"}</p>
        </section>
        {selectedCase.id === "reflected-room" && <p className="slice-muted">能力执行耗1行动、3灵性、知识14判定，预付本次有限去回总预算。须经同一对已揭开的真实镜面去往原壁龛，并按结束选项经原镜返回原室、显现并盖镜；失败仍可能已到壁龛，须实际返回。普通方法沿原侧廊步行4米并沿原路返回，不算镜面跳跃。</p>}
        {selectedCase.id === "willing-signal" && <p className="slice-muted">原成年参与者诺兰只同意本次一次举旗，随时可停止。能力执行耗1行动、3灵性、知识14判定；成功后须实际退出同一诺兰并在原室显现，由他放回原旗。被排斥也须结束本次接触；普通方法只请他自愿举旗，不算附体。</p>}
        {selectedCase.id === "honest-account" && <p className="slice-muted">只提供普通方法：耗1行动、0灵性、知识10判定，在同一原记录纸写下有限实际结果。失败文字保留；结束时须实际交回原纸，后续重试仍使用同一原纸，不是真相神谕。</p>}
        {selectedCase.result && <section className="slice-notice" aria-label="怨魂实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前怨魂实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {insidePractice && <p className="slice-muted">必须先按当前公开结束选项完成真实返程、退出附体并放回原旗，或交回原纸，再报告或做其它事。结束耗0行动、0精神、0灵性，零剩余行动或零灵性仍可执行；不另抽结果、不退款、不治疗、不抹去失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="怨魂成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="怨魂有限冲突">
      <h3>有限现场冲突</h3>
      <p>原成年看守贝文持自己的普通短棍，位于日光下的工坊外院，相距2米，现场无其他成年参与者；原出口可用，对方不追击。观察当前反射条件不会凭空补出第二面镜子或场外跳跃出口。</p>
      <p>短暂附体可能被排斥，成功也在本次动作内实际退出；残留的一次动作迟疑不代表持续控制。灵魂伤害仍按共同战盘处理，不能保证秒杀；短暂怨魂化须在本槽结束前显现，不提供整轮免疫。</p>
      <div className="magician-action-list" role="group" aria-label="怨魂冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}

    {wraith.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{wraith.story}</p></details>}
    {wraith.discovered && <details className="seer-fold" aria-label="怨魂成品来源与配方边界">
      <summary>成品来源、费用与配方边界</summary>
      <p>{playerText("须完成活尸消化100与十二个完整序列6周。G指导460便士；每瓶4800便士，或5步劳务抵扣4200便士后付600便士。三瓶独立成品分别取得、逐瓶确认，按意志26四档结算；失败仍耗用原瓶，后续补货须实际跨周取得。")}</p>
      <p>{playerText("完整配方、材料与6→5晋升仪式细节尚未核实；这里只提供有来源的G独立成品与导师准备，不解锁调配，也不宣称原著无需仪式。晋升须先结束旧活尸接触并度过原待处理月圆。")}</p>
      {wraith.supplies && <p>{wraith.supplies}</p>}
    </details>}
    {wraith.discovered && wraith.bottles.length > 0 && <details className="seer-fold" open={!wraith.promoted}>
      <summary>怨魂独立成品原瓶 · 来源与去向</summary>
      {wraith.bottles.map((bottle) => {
        const action = wraith.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !wraith.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !wraith.promoted && !sceneLocked && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `wraith-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`wraith-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {wraith.discovered && !wraith.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{wraith.risk}</p></details>}
    {wraith.promoted && <section aria-label="怨魂能力与消化">
      <h3>能力与消化 · {wraith.abilities.length} 项训练记录</h3>
      <p>扮演进度 {wraith.acting} · 消化：{wraith.digestion}</p>
      <progress className="cryptologist-progress" aria-label="怨魂扮演进度" value={wraith.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {wraith.pollution}</p>
      {wraith.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="怨魂能力与来源边界"><summary>查看镜面、附体与和平成长边界</summary>
        <p>保留囚犯、疯子、狼人、活尸的原能力与掌握，只新增镜面移动、灵魂与附体两项掌握记录。本人化为怨魂，不会留下一具独立身体；本次镜面练习只带原有衣物，不携带手持物或同行者。</p>
        <p>{playerText("镜面移动依赖真实反射条件与端点；本次四米去回为原创G练习，莎伦个人曾展示的300米不是所有初晋升怨魂的固定范围。附体可能失败或被排斥，须实际退出，不能读取全部记忆、永久控制他人或获得无限同意。")}</p>
        <p>观察、准备、执行与报告各耗1行动；前两项能力执行各耗3灵性，普通方法耗0灵性。撤回尚未执行的准备与实际结束均为0行动、0灵性，结束不重复收费。</p>
        <p>{playerText("三项报告各25扮演，反思25；全部采用普通方法也可完成这条原创G和平成长线，普通方法不冒充能力成功。仅前两项真实成功的能力报告获得8点知识池掌握，不保证原著中无风险完美扮演，也不会自动解除诅咒。")}</p>
        <p>下一序列是被缚者途径序列4木偶，晋升请从对应入口查看；本页不提前提供无生命物附身、接触诅咒或其它序列4能力。</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
