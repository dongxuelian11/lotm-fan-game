import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { TravelerAction, TravelerCommand, TravelerProjection } from "../domain/traveler/types";
import type { RecorderProjection } from "../domain/recorder/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场",
  OBSERVED: "已有公开观察",
  PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告",
  RESOLVED: "已提交有限报告",
};

/** The previous sequence is read-only: no copying, refill or replay of old outcomes. */
export function TravelerRecorderHistory({ recorder }: { recorder: RecorderProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="记录官时期的经历">
    <h3>记录官时期的经历</h3>
    <p className="slice-notice">你已晋升旅行家（序列5）。这里保留记录官时期的原示范、原记录、实际释放、失败、导师资源、旧案与独立原瓶，只供回看。</p>
    <p>记录官扮演进度 {recorder.acting} · 消化：{recorder.digestion}</p>
    <section aria-label="继承原记录与当前容量">
      <h4>继承原记录与当前容量</h4>
      <dl className="seer-facts">{recorder.capacities.map((capacity) => <div key={capacity.tier}>
        <dt>{capacity.label}</dt><dd>{capacity.used} / {capacity.maximum}<small> · {capacity.boundary}</small></dd>
      </div>)}</dl>
      <p className="slice-muted">神性记录容量以当前公开投影为准；初晋旅行家为4。空位不是已学会的能力，不填充新技能。低、中阶本阶段仍用已核实的20与8，不虚构更高容量。</p>
      {recorder.records.length === 0 ? <p className="slice-muted">尚无已成功储存的原记录；空容量不能释放能力。</p>
        : <details className="seer-fold" open><summary>已保存的原记录 · {recorder.records.length} 份</summary>
          {recorder.records.map((record) => <article className="warrior-history-bottle" key={record.id}>
            <h4>{record.label} · 序列 {record.sequence} · {record.status === "STORED" ? "尚未释放" : "已释放，原记录已消耗"}</h4>
            <p className="slice-muted">原记录ID：{record.id}</p><p>来源：{record.source}</p>
            <p className="slice-muted">原示范ID：{record.sourceDemoId} · 第{record.createdWeek}周实际记录{record.releasedWeek !== null ? ` · 第${record.releasedWeek}周实际释放` : ""}</p>
          </article>)}
        </details>}
    </section>
    {(recorder.demonstrations ?? []).length > 0 && <details className="seer-fold">
      <summary>亲见原示范与实际记录结果</summary>
      {(recorder.demonstrations ?? []).map((demo) => <article className="warrior-history-bottle" key={demo.id}>
        <h4>{demo.label} · {demo.actorName}</h4>
        <p>原示范ID：{demo.id} · 第{demo.week}周 · 版本{demo.revision}</p>
        <p>{demo.success ? "原示范已亲见，本次记录成功。" : "原示范已亲见，本次记录失败；已耗行动与双方灵性保留，没有新增记录。"}</p>
      </article>)}
    </details>}
    {recorder.samples.length > 0 && <details className="seer-fold">
      <summary>原示范来源与导师资源</summary>
      {recorder.samples.map((sample) => <section key={sample.id} aria-label={`${sample.label}的原示范来源`}>
        <h4>{sample.label}</h4><p>来源：{sample.source}</p>
        <p>示范者当前灵性 {sample.instructorSpirituality} · 已储存 {sample.stored} 份 · {sample.lastAttemptWeek === null ? "尚未实际尝试记录" : `最近尝试：第${sample.lastAttemptWeek}周`}</p>
      </section>)}
      <p className="slice-muted">诺拉·维恩仍是原序列8示范者，晋升不会提高她的序列、补满她的灵性或补出旅行示范。艾文·盖尔是另一个实际负责仪式护送的成年旅行家。</p>
    </details>}
    {(recorder.story || recorder.environment || recorder.supplies) && <details className="seer-fold">
      <summary>记录官原故事与供给</summary>
      {recorder.story && <p>{recorder.story}</p>}
      {recorder.environment && <p>{recorder.environment}</p>}
      {recorder.supplies && <p>{recorder.supplies}</p>}
    </details>}
    {recorder.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方案与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {recorder.bottles.length > 0 && <details className="seer-fold">
      <summary>记录官原瓶 · 来源与去向</summary>
      {recorder.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {recorder.abilities.length > 0 && <details className="seer-fold">
      <summary>记录官时期能力记录</summary>
      {recorder.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">这里只展示已保存的原记录，不重新结算旧案、发奖或抹去失败。原记录仍是一次性原份，释放后耗尽；历史示范不会自动再录，原能力ID与掌握继续保留。</p>
  </section>;
}

export interface TravelerPanelProps {
  traveler: TravelerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: TravelerCommand) => void;
}

function isCaseAction(action: TravelerAction): boolean { return "caseId" in action.command; }
function isRitualAction(action: TravelerAction): boolean {
  return action.command.type === "RITUAL_DEPART" || action.command.type === "PLACE_COORDINATE" || action.command.type === "RITUAL_RETURN";
}
function isEncounterAction(action: TravelerAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render committed public observations and submit the original projected intent unchanged. */
export function TravelerPanel({ traveler, resources, busy, blocked = false, error = null, onCommand }: TravelerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = traveler.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = traveler.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = traveler.actions.filter(isCaseAction);
  // Only public exit intents locate a currently open scene; prose is never parsed as state.
  const exitAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "WITHDRAW" && action.enabled);
  const fallbackExit = caseActions.find((action) => action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId
    : fallbackExit && "caseId" in fallbackExit.command ? fallbackExit.command.caseId : null;
  const selectedCase = (traveler.insideCase ? traveler.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? traveler.cases.find((entry) => entry.id === selectedCaseId)
    ?? traveler.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? traveler.cases[0];
  // Public enabled intents remain usable inside the scene, including zero-resource exits.
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = traveler.actions.filter(isEncounterAction);
  const ritualActions = traveler.actions.filter(isRitualAction);
  const growthActions = traveler.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action) && !isRitualAction(action));
  const nextAction = !traveler.promoted
    ? ritualActions.find((action) => action.enabled && action.command.type === "PLACE_COORDINATE")
      ?? ritualActions.find((action) => action.enabled && action.command.type === "RITUAL_RETURN")
      ?? traveler.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled && action.command.type === "LEARN_GUIDANCE")
      ?? ritualActions.find((action) => action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? ritualActions[0] ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
      ?? selectedCaseActions.find((action) => action.enabled)
      ?? growthActions.find((action) => action.enabled)
      ?? encounterActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !traveler.promoted && !traveler.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (traveler.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, traveler.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || traveler.promoted || traveler.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, traveler.promoted, traveler.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: TravelerAction) {
    if (busy || interactionBlocked || traveler.insideCase || traveler.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || traveler.promoted || traveler.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: TravelerAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `traveler-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`traveler-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel traveler-panel seer-confirmation" aria-label="这瓶旅行家魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方仍未核实，本次使用有来源的独立成品原瓶。须先由本人完成灵界深处四个相异、彼此遥远地点的特殊坐标并实际返程。服药将实际发生不可控灵界漫游，借原坐标辨认自我与帮助回归；本次原创G导师照护按四档结果结算，不保证所有旅行家晋升安全。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="旅行家服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{traveler.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{traveler.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="traveler-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "traveler-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel traveler-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="旅行家成长下一步">
      <span className="seer-seal">{traveler.promoted ? "旅行家5" : "记录官6 → 旅行家5"}</span>
      <h3>{traveler.title}</h3>
      {traveler.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : traveler.insideCase ? "请查看当前公开的结束实践选项。"
          : traveler.promoted && traveler.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{traveler.digestion}</p>
      {traveler.discovered && !traveler.promoted && <p className="slice-muted">用药指导：{traveler.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得原瓶与逐瓶确认分别进行；实际费用、成熟条件与安全恢复范围以公开记录为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方、材料、剂量与调配顺序仍未知。本阶段使用有来源的原创G独立成品，实际完成灵界深处四处特殊坐标；服药时经历不可控漫游，原坐标帮助辨认自我与回归。不是只在普通房间饮药，也不提供虚构配方。")}</p>
    </section>

    {traveler.promoted && traveler.environment && <section aria-label="当前旅行家现场">
      <h4>当前现场</h4><p>{traveler.environment}</p>
    </section>}
    {traveler.ritual && <section className="slice-notice" aria-label="四处特殊坐标与实际返程">
      <h3>四处特殊坐标与实际返程</h3>
      <dl className="seer-facts">
        <div><dt>本人当前实际所在</dt><dd>{traveler.ritual.at}</dd></div>
        <div><dt>护送者艾文当前灵性</dt><dd>{traveler.ritual.escortSpirituality}</dd></div>
      </dl>
      <ul>{traveler.ritual.coordinates.map((site) => <li key={site.id}><strong>{site.label}</strong>：{site.status}</li>)}</ul>
      <p className="slice-muted">四处均在灵界深处，景象各异且彼此遥远，并非普通房间的四角。本人实际随成年旅行家艾文·盖尔出发，亲自放置坐标后再实际返回；诺拉仍是原序列8导师。</p>
      <p className="slice-muted">{playerText("本作原创G护送每次出发80便士、1行动；艾文去程3灵性并保留返程3灵性。本人出发前须有2灵性，放置时才消耗2灵性、0行动。可不放置直接返程，返程0行动且使用艾文已留的3灵性，费用与已发生的路程不会撤销。跨周后再次实际到访时才结算艾文有限休息，不能免费召回或重置资源。")}</p>
      {ritualActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="旅行家仪式行动">{ritualActions.map(actionButton)}</div>}
      {traveler.ritual.history.length > 0 && <details className="seer-fold">
        <summary>实际出发、坐标、返程与漫游记录</summary>
        <ul>{traveler.ritual.history.map((entry, index) => <li key={`ritual-${index}`}>{entry}</li>)}</ul>
      </details>}
    </section>}
    {!traveler.ritual && ritualActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="旅行家仪式行动">{ritualActions.map(actionButton)}</div>}
    {traveler.promoted && traveler.practice && <section className="slice-notice" aria-label="本人原卡与同伴实际位置" aria-live="polite" aria-atomic="true">
      <h3>本人、原卡与同伴实际位置</h3>
      <dl className="seer-facts">
        <div><dt>本人身体</dt><dd>{traveler.practice.position}</dd></div>
        <div><dt>教学原卡</dt><dd>{traveler.practice.card}</dd></div>
        <div><dt>成年场务米拉</dt><dd>{traveler.practice.companion}</dd></div>
      </dl>
      {traveler.practice.history.length > 0 && <ul>{traveler.practice.history.map((entry, index) => <li key={`practice-${index}`}>{entry}</li>)}</ul>}
      <p className="slice-muted">准备不会移动本人、同伴或原卡。实际旅行为已核对的六米有限路线；无形之手只取当前可见、未锁桌上的导师原卡TR5-CARD-1。同行须由在场成年米拉当面接受本次有限约定，不凭历史同意带走任何人。</p>
    </section>}
    {selectedCase && <section aria-label="旅行家有限实践">
      <h3>有限旅行、原卡取还与自愿同行</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || traveler.insideCase}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {traveler.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前旅行家实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；本人身体、同一原卡与米拉的实际位置均以已保存的公开记录为准。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备只记录方案与当面约定，不提前传送、取卡或移动同伴；效果只在实际执行并保存后显示。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="旅行家实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前旅行家实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {traveler.insideCase && <p className="slice-muted">返回生活前须实际结束当前接触：本人或同行两人沿普通六米路径走回原处；取卡实践须沿普通两米路径归还同一原卡并走回。0行动、0精神、0灵性时仍可使用已开放的结束或撤回选项；不是免费传送，不退款、治疗、清除失败或自动结束旧接触。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="旅行家成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="旅行家有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">成年仓库守门人贝兰持自己的普通短棍，私人空厅的真实出口与普通两米距离以实际现场为准。可交涉或承担真实战斗风险；有限成对短途旅行须实际移位并返回，使用记录须消耗已有的一份原记录。两者都有真实灵性成本，不保证命中、逃离、胜利或免伤。</p>
      <div className="warrior-action-list" role="group" aria-label="旅行家冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {traveler.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{traveler.story}</p></details>}
    {traveler.discovered && traveler.supplies && <section className="slice-notice" aria-label="旅行家成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{traveler.supplies}</p>
    </section>}
    {traveler.discovered && traveler.bottles.length > 0 && <details className="seer-fold" open={!traveler.promoted}>
      <summary>旅行家独立成品原瓶 · 来源与去向</summary>
      {traveler.bottles.map((bottle) => {
        const action = traveler.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !traveler.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !traveler.promoted && !traveler.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `traveler-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`traveler-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {traveler.discovered && !traveler.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{traveler.risk}</p></details>}
    {traveler.promoted && <section aria-label="旅行家能力与消化">
      <h3>能力与消化 · {traveler.abilities.length} 项训练记录</h3>
      <p>扮演进度 {traveler.acting} · 消化：{traveler.digestion}</p>
      <progress className="cryptologist-progress" aria-label="旅行家扮演进度" value={traveler.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {traveler.pollution}</p>
      {traveler.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="旅行家能力边界">
        <summary>查看旅行、无形之手与继承记录边界</summary>
        <p>旅行借助灵界定位并实际移动本人身体，也可携带自愿同伴；阻隔、定位和实际条件会限制效果，不是任意目的地必达。本阶段只提供已核对的六米有限路径，没有世界任意传送菜单，也不虚构通用人数或重量上限。</p>
        <p>无形之手在本阶段实际取到同一张导师木制图卡TR5-CARD-1；卡片在可见、未上锁的两米桌上且有明确许可。不会隔着不透明容器取物、复制原卡或改变所有权。结束时本人普通步行归还原卡并走回。</p>
        <p>场务米拉是独立在场的原创成年人。本次当面同意只覆盖这一段六米旅行或普通同行；准备不移动她，撤回取消本次同意，结束由两人普通步行返回。失败与灵性成本保留，报告或跨周不会自动移动身体或归还原卡。</p>
        <p>记录官的原记录、示范、能力ID与掌握继续保留，已释放的原份不会复原。新神性容量为4而非四份现成技能；低阶20与中阶8继续采用已核实容量。本阶段没有新的高位示范，不免费获得旅行记录。</p>
        <p>{playerText("没有序列4的隐秘空间、口袋空间或放逐能力。四处仪式坐标、护送路线、导师照护、距离、费用、判定与消化数值中本作具体实现均为原创G；有限仪式保护不延伸到战斗或一切旅行家晋升。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
