import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WinnerAction, WinnerCommand, WinnerProjection } from "../domain/winner/types";
import type { CalamityPriestProjection } from "../domain/calamity-priest/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";
import "./cryptologist-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次现场", OBSERVED: "已有公开观察与现场边界", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，请完成收束再报告", RESOLVED: "已实际收束并提交有限报告",
};
const COUNTER_LABELS = { GUIDE: "同一原木筹 WN5-COUNTER-1 在艾妲手中", TRAY: "同一原木筹 WN5-COUNTER-1 已落在原软接盘内，尚未交回", CAUGHT: "同一原木筹 WN5-COUNTER-1 已实际接稳，尚未交回" } as const;
const RING_LABELS = { OWNER: "同一原环 WN5-RING-1 在塞拉手中", MAT: "同一原环 WN5-RING-1 已落在原软垫上，尚须由塞拉取回" } as const;
const NOTE_LABELS = { BLANK: "同一原记录纸 WN5-NOTE-1 尚未写本次记录", WRITTEN: "同一原记录纸 WN5-NOTE-1 已写，尚未交回", HANDED_OVER: "同一原记录纸 WN5-NOTE-1 已实际交回" } as const;
const OLD_HAZARD_LABELS = { UNASSESSED: "尚未完成当时的风险核查", NOTICED: "已留意当时风险，尚未实际收束", SECURED: "已实际退出并做好当时风险收束" } as const;
const OLD_BOARD_LABELS = { RESTING: "同一原板仍在原支架上", UNSTABLE: "同一原板不稳，尚未固定", FALLEN: "同一原板已落下，尚未固定", SECURED: "同一原板已实际固定收好" } as const;
const OLD_CONTACT_LABELS = { NONE: "当时尚未开始接触", FOCUSED: "当时的短暂精神接触仍在", RELEASED: "当时的精神接触已实际解除" } as const;

/** Prior results and original objects remain historical facts, with no replay controls. */
export function WinnerCalamityPriestHistory({ calamityPriest, currentTitle="赢家（序列5）" }: { calamityPriest: CalamityPriestProjection; currentTitle?:string }) {
  return <section className="seer-panel winner-panel" aria-label="灾祸教士时期的经历">
    <h3>灾祸教士时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留灾祸教士时期的原故事、风险核查、原板、有限精神接触、失败与独立原瓶，只供回看。</p>
    <p>灾祸教士扮演进度 {calamityPriest.acting} · 消化：{calamityPriest.digestion}</p>
    {calamityPriest.story && <p>{calamityPriest.story}</p>}
    {calamityPriest.environment && <p>{calamityPriest.environment}</p>}
    {calamityPriest.supplies && <p>{calamityPriest.supplies}</p>}
    <details className="seer-fold" aria-label="灾祸教士原现场记录">
      <summary>原风险、原板与精神接触</summary>
      <dl className="seer-facts">
        <div><dt>原风险核查</dt><dd>{OLD_HAZARD_LABELS[calamityPriest.practice.hazard]}</dd></div>
        <div><dt>同一原板</dt><dd>{OLD_BOARD_LABELS[calamityPriest.practice.board]}</dd></div>
        <div><dt>原精神接触</dt><dd>{OLD_CONTACT_LABELS[calamityPriest.practice.contact]}</dd></div>
        <div><dt>原污染记录</dt><dd>{calamityPriest.pollution}</dd></div>
      </dl>
    </details>
    {calamityPriest.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {calamityPriest.bottles.length > 0 && <details className="seer-fold">
      <summary>灾祸教士原瓶 · 来源与去向</summary>
      {calamityPriest.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {calamityPriest.risk && <details className="seer-fold"><summary>灾祸教士原服用风险</summary><p>{calamityPriest.risk}</p></details>}
    {calamityPriest.abilities.length > 0 && <details className="seer-fold">
      <summary>灾祸教士时期能力记录</summary>
      {calamityPriest.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">旧实践不重新结算或发奖，不重置原板、原瓶或杜兰冲突的实际后果。新储运不会抹去旧失败，也不会补发或取代原被动幸运。</p>
  </section>;
}

export interface WinnerPanelProps {
  winner: WinnerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: WinnerCommand) => void;
}
function isCaseAction(action: WinnerAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: WinnerAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function allowedCaseAction(action: WinnerAction): boolean {
  return action.command.type !== "PREPARE" || action.command.caseId !== "honest-account" || action.command.method === "ORDINARY";
}

/** Selection changes only local focus; every result and resource comes from the saved projection. */
export function WinnerPanel({ winner, resources, busy, blocked = false, error = null, onCommand }: WinnerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = winner.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = winner.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = winner.actions.filter(isCaseAction).filter(allowedCaseAction);
  // An explicit public CLOSE identifies the current contact; old prose never does.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const insidePractice = winner.insideCase || !!closeAction || winner.practice.counter !== "GUIDE"
    || winner.practice.ring !== "OWNER" || winner.practice.note === "WRITTEN";
  const selectedCase = (insidePractice ? winner.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? winner.cases.find((entry) => entry.id === selectedCaseId)
    ?? winner.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? winner.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command
    && action.command.caseId === selectedCase.id && (!insidePractice || action.command.type === "CLOSE")) : [];
  const accumulateActions = winner.promoted && !insidePractice ? winner.actions.filter((action) => action.command.type === "ACCUMULATE") : [];
  const encounterActions = insidePractice ? [] : winner.actions.filter(isEncounterAction);
  const growthActions = insidePractice ? [] : winner.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "ACCUMULATE" && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = insidePractice ? closeAction : !winner.promoted
    ? winner.actions.find((action) => action.command.type === "CONSUME" && action.enabled) ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...accumulateActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? accumulateActions[0] ?? growthActions[0] ?? encounterActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !winner.promoted && !insidePractice;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (insidePractice || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, insidePractice]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || winner.promoted || insidePractice)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, winner.promoted, insidePractice]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: WinnerAction) {
    if (busy || interactionBlocked || insidePractice || winner.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || winner.promoted || insidePractice) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: WinnerAction) {
    const unavailable = insidePractice && action.command.type !== "CLOSE";
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className={insidePractice ? "slice-choice primary" : "slice-choice"} disabled={busy || interactionBlocked || unavailable || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || unavailable || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `winner-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`winner-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel winner-panel seer-confirmation" aria-label="这瓶赢家魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="赢家服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{winner.risk}</p></section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{winner.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="winner-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "winner-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。晋升不赠送储运，也不补满灵性。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel winner-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="赢家成长下一步">
      <span className="seer-seal">{winner.promoted ? "序列 5" : "赢家晋升卷宗"}</span><h3>{winner.title}</h3>
      <p className="seer-next">{insidePractice
        ? <><strong>先实际归还原物并结束本次接触：</strong>{nextAction?.label || "查看当前公开的结束实践选项"}。结束为0行动、0精神、0灵性、0储运，保留已付成本。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : winner.promoted && winner.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{winner.digestion}</p>
    </section>
    {winner.promoted && <section className="slice-notice" aria-label="赢家实际储运">
      <h3>已保存储运 {winner.luck.stored} / {winner.luck.capacity}</h3>
      <dl className="seer-facts">
        <div><dt>最近一次实际积累</dt><dd>{winner.luck.lastAccumulateWeek === null ? "尚未实际积累" : `第${winner.luck.lastAccumulateWeek}周`}</dd></div>
        <div><dt>累计实际积累</dt><dd>{winner.luck.accumulated}</dd></div>
        <div><dt>累计实际消耗</dt><dd>{winner.luck.spent}</dd></div>
      </dl>
      <p>{winner.luck.summary}</p>
      <p>在贝克兰德原报时铺艾妲的指导室，以一段实际节制平静积累1份储运：1行动、0灵性，每个真实周最多一次，上限3份。晋升时从0开始；本次积累不治疗健康、精神或灵性。</p>
      {winner.luck.stored === 0 && <p>当前没有可花费储运。可先结束接触，再查看积累条件；本周已积累过则须等下一真实周。也可选择普通方法继续实践。</p>}
      {accumulateActions.length > 0 && <div className="magician-action-list" role="group" aria-label="赢家积累储运行动">{accumulateActions.map(actionButton)}</div>}
      {insidePractice && <p className="slice-muted">先实际归还原物并结束本次接触，不能在接触中积累储运。</p>}
      <details className="seer-fold"><summary>储运来源与花费边界</summary>
        <p>{playerText("能力实践每次实际执行消耗2灵性与1份储运，失败仍付费；选方法尚未施用。储运容量、每周积累与消耗数值是本作原创G，不宣称原著有固定计量或人人等额坏运债。")}</p>
        <p>这份储备只属于本人，不因买药、普通休养、报告、晋升或战斗结束而自动补充，也不能转给他人。保留原被动幸运的独立判定，不能花储运强制触发、任意重掷或改写已发生结果。</p>
      </details>
    </section>}
    {winner.promoted && winner.environment && <section aria-label="当前赢家现场"><h4>当前现场</h4><p>{winner.environment}</p></section>}
    {winner.promoted && <section aria-label="已保存的原木筹、原环与原纸状态">
      <h4>当前公开原物状态</h4>
      <dl className="seer-facts">
        <div><dt>原木筹</dt><dd>{COUNTER_LABELS[winner.practice.counter]}</dd></div>
        <div><dt>原环</dt><dd>{RING_LABELS[winner.practice.ring]}</dd></div>
        <div><dt>原记录纸</dt><dd>{NOTE_LABELS[winner.practice.note]}</dd></div>
      </dl>
      <p className="slice-muted">原轻木筹由艾妲在低台原软接盘上方放下；原成年塞拉用自己的原环向软垫上的低木钉投一次。两处均净空，无人在落物下方。</p>
    </section>}
    {selectedCase && <section aria-label="赢家有限实践">
      <h3>一枚原木筹、一次自愿投环与如实记录</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || insidePractice} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {winner.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前赢家实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对原物、本人许可与净空现场。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前扣储运、接住木筹、影响投环或写好记录。"}</p>
        </section>
        {selectedCase.id === "falling-counter" && <p className="slice-muted">{playerText("能力执行耗1行动、2灵性、1份储运，以知识9判定，较本作G原难度14增加10个百分点的成功机会，不改变原随机结果；成功不保证，失败仍消耗并让同一原木筹落在原软接盘中。普通方法耗1行动、0灵性、0储运，以知识12判定，通过实际软接盘接稳原木筹，不算能力成功。两种方法都须实际把同一原木筹交还艾妲。")}</p>}
        {selectedCase.id === "willing-aim" && <p className="slice-muted">原成年塞拉只同意本次一次安全投环，随时可停止。能力执行耗1行动、2灵性、1份储运、知识14判定，有限厄运可能使本次投环偏离；失败仍消耗，不保证对方失手。普通方法以知识10观察同一次实际投环，不施加厄运。两种方法都由塞拉实际取回同一原环，再结束本次许可；没有持续诅咒、情绪或身体控制。</p>}
        {selectedCase.id === "honest-account" && <p className="slice-muted">只提供普通方法：耗1行动、0灵性、0储运、知识10判定，在同一原纸写下有限实际结果。失败文字保留；结束时须亲手交回原纸，后续重试仍使用同一原纸，不是真相神谕。</p>}
        {selectedCase.result && <section className="slice-notice" aria-label="赢家实际结果" aria-live="polite" aria-atomic="true"><h4>本次实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前赢家实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {insidePractice && <p className="slice-muted">必须先按当前公开结束选项归还同一原木筹、由塞拉取回同一原环，或交回原纸，再报告或做其它事。结束耗0行动、0精神、0灵性、0储运，零剩余行动仍可执行；不另抽结果、不退款、不治疗、不抹去失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="赢家成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="赢家有限冲突">
      <h3>有限现场冲突</h3>
      <p>原成年奥德里持自己的普通短棍，位于日光下的净空外院，相距2米，没有旁人、松动物或可用灾源；原出口可实际退出，对方不追击。可以交涉，战斗有真实伤亡风险。</p>
      <p>战前默认保留储运；只在本轮明确选择花费后，首个实际符合条件的自保或干扰才消耗2灵性与1份储运，每轮合计最多一份。有限厄运可能失败，失败照常消耗；观察不会制造灾源，储运也不保证胜利或抵销意外。</p>
      <div className="magician-action-list" role="group" aria-label="赢家冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {winner.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{winner.story}</p></details>}
    {winner.discovered && <details className="seer-fold" aria-label="赢家成品来源与配方边界">
      <summary>成品来源、费用与配方边界</summary>
      <p>{playerText("须完成灾祸教士消化100与十二个完整序列6周。G指导460便士；每瓶4800便士，或5步劳务抵扣4200便士后付600便士。三瓶独立成品分别取得、逐瓶确认，按意志26四档结算；失败仍耗用原瓶，后续补货须实际跨周取得。")}</p>
      <p>{playerText("完整配方、材料与6→5晋升仪式细节尚未核实；这里只提供有来源的G独立成品与导师准备，不解锁调配，也不宣称原著无需仪式。晋升须先结束旧灾祸教士接触；健康须高于20、精神须高于40，成功后灵性上限100但不补满。")}</p>
      {winner.supplies && <p>{winner.supplies}</p>}
    </details>}
    {winner.discovered && winner.bottles.length > 0 && <details className="seer-fold" open={!winner.promoted}>
      <summary>赢家独立成品原瓶 · 来源与去向</summary>
      {winner.bottles.map((bottle) => {
        const action = winner.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !winner.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !winner.promoted && !insidePractice && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `winner-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`winner-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {winner.discovered && !winner.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{winner.risk}</p></details>}
    {winner.promoted && <section aria-label="赢家能力与消化">
      <h3>能力与消化 · {winner.abilities.length} 项训练记录</h3>
      <p>扮演进度 {winner.acting} · 消化：{winner.digestion}</p>
      <progress className="cryptologist-progress" aria-label="赢家扮演进度" value={winner.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {winner.pollution}</p>
      {winner.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <details className="seer-fold" aria-label="赢家能力与来源边界"><summary>查看有限控运与和平成长边界</summary>
        <p>{playerText("保留怪物、机器、幸运者与灾祸教士的原能力、掌握和污染，只新增储运与有限厄运两项掌握记录。部分控制自身幸运、节制积累与有限影响敌方厄运有原著依据；具体容量、次数、难度与场景是本作原创G。")}</p>
        <p>观察、准备、执行与报告各耗1行动；前两项能力执行各耗2灵性与1份储运，普通方法耗0灵性、0储运。撤回尚未执行的准备与实际结束均为0行动，不重复收费。</p>
        <p>{playerText("三项报告各25扮演，反思25；全部采用普通方法也可完成这条原创G和平成长线，不会自动填满储运。仅前两项真实成功的能力报告获得8点知识池掌握，普通方法不冒充能力成功。")}</p>
        <p>幸运有边界，不保证胜利、全部真相或任意重掷，不改写过去。本页保留赢家序列5的能力范围；序列4晋升请从对应入口查看，不把混合封印物的水银化、重启或其它高阶效果下放。</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
