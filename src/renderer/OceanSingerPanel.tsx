import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { OceanSingerAction, OceanSingerCommand, OceanSingerProjection } from "../domain/ocean-singer/types";
import type { WindBlessedProjection } from "../domain/wind-blessed/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已有公开观察", PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待收束与报告", RESOLVED: "已提交有限报告",
};
const RITUAL_LOCATION = { DOCK: "原码头", COAST: "原近海仪式岸边", BELLY: "原活体奥布尼斯海怪腹中" };

/** Preserve the original S6 work and actual journeys without exposing old executable actions. */
export function OceanSingerWindBlessedHistory({ windBlessed }: { windBlessed: WindBlessedProjection }) {
  return <section className="seer-panel warrior-panel navigator-panel" aria-label="风眷者时期的经历">
    <h3>风眷者时期的经历</h3>
    <p className="slice-notice">你已晋升海洋歌者（序列5）。这里保留风眷者时期的原帆布、原低台往返、风刃练习、失败、实际结束、独立原瓶与能力，只供回看。</p>
    <p>风眷者扮演进度 {windBlessed.acting} · 消化：{windBlessed.digestion}</p>
    {(windBlessed.story || windBlessed.environment || windBlessed.supplies) && <details className="seer-fold">
      <summary>风眷者原故事与供给</summary>
      {windBlessed.story && <p>{windBlessed.story}</p>}
      {windBlessed.environment && <p>{windBlessed.environment}</p>}
      {windBlessed.supplies && <p>{windBlessed.supplies}</p>}
    </details>}
    <section aria-label="风眷者原低台往返历史">
      <h4>原低台实际位置与往返</h4>
      <dl className="seer-facts">
        <div><dt>原记录位置</dt><dd>{windBlessed.flight.position === "LOW_PLATFORM" ? "原低台台面" : "原地面"}</dd></div>
        <div><dt>实际登台</dt><dd>{windBlessed.flight.ascents} 次</dd></div>
        <div><dt>成功飞行返回</dt><dd>{windBlessed.flight.flightReturns} 次</dd></div>
        <div><dt>实际楼梯返回</dt><dd>{windBlessed.flight.stairReturns} 次</dd></div>
      </dl>
    </section>
    {windBlessed.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方案与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {windBlessed.bottles.length > 0 && <details className="seer-fold">
      <summary>风眷者原瓶 · 来源与去向</summary>
      {windBlessed.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {windBlessed.abilities.length > 0 && <details className="seer-fold">
      <summary>风眷者时期能力记录</summary>
      {windBlessed.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">晋升不重新结算旧实践，不补发原瓶，也不抹去失败与原成本。原水手、暴怒之民、航海家和风眷者的知识与掌握继续保留。</p>
  </section>;
}

export interface OceanSingerPanelProps {
  oceanSinger: OceanSingerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: OceanSingerCommand) => void;
}
function isCaseAction(action: OceanSingerAction): boolean { return "caseId" in action.command; }
function isRitualAction(action: OceanSingerAction): boolean {
  return ["REQUEST_RITUAL", "GO_RITUAL", "ENTER_RITUAL", "EXIT_RITUAL", "RETURN_DOCK"].includes(action.command.type);
}
function isAllyAction(action: OceanSingerAction): boolean {
  return ["MOVE_ALLY", "RETURN_ALLY", "CLEAR_ALLY"].includes(action.command.type);
}
function isEncounterAction(action: OceanSingerAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function RitualFacts({ ritual }: { ritual: OceanSingerProjection["ritual"] }) {
  return <>
    <dl className="seer-facts">
      <div><dt>实际位置</dt><dd>{RITUAL_LOCATION[ritual.location]}</dd></div>
      <div><dt>本次仪式</dt><dd>{ritual.status}</dd></div>
      <div><dt>外部防护水膜</dt><dd>{ritual.waterFilm ? "本次已实际付费启用" : "当前未启用"}</dd></div>
      <div><dt>实际赴仪式次数</dt><dd>{ritual.visits} 次</dd></div>
      <div><dt>腹中实际服药次数</dt><dd>{ritual.consumptions} 次</dd></div>
    </dl>
    <p>来源：{ritual.source}</p><p>{ritual.summary}</p>
  </>;
}

/** Only committed public positions, song effects and original commands drive this panel. */
export function OceanSingerPanel({ oceanSinger, resources, busy, blocked = false, error = null, onCommand }: OceanSingerPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = oceanSinger.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = oceanSinger.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = oceanSinger.actions.filter(isCaseAction);
  const ritualActions = oceanSinger.actions.filter(isRitualAction);
  const allyActions = oceanSinger.actions.filter(isAllyAction);
  const encounterActions = oceanSinger.actions.filter(isEncounterAction);
  // Public exit intents identify the current case; narrative history is never parsed as state.
  const exitAction = caseActions.find((action) => action.enabled && action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.enabled && action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId
    : allyActions.some((action) => action.enabled) ? "warned-rehearsal" : null;
  const selectedCase = (oceanSinger.insideCase ? oceanSinger.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? oceanSinger.cases.find((entry) => entry.id === selectedCaseId)
    ?? oceanSinger.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? oceanSinger.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const growthActions = oceanSinger.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action)
    && !isRitualAction(action) && !isAllyAction(action) && !isEncounterAction(action));
  const enabledConsume = oceanSinger.actions.find((action) => action.command.type === "CONSUME" && action.enabled);
  const nextAction = oceanSinger.ritual.location !== "DOCK"
    ? enabledConsume ?? ritualActions.find((action) => action.enabled && action.command.type === "ENTER_RITUAL")
      ?? ritualActions.find((action) => action.enabled && action.command.type === "EXIT_RITUAL")
      ?? ritualActions.find((action) => action.enabled && action.command.type === "RETURN_DOCK")
    : !oceanSinger.promoted
      ? growthActions.find((action) => action.enabled) ?? ritualActions.find((action) => action.enabled) ?? growthActions[0] ?? ritualActions[0]
      : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
        ?? allyActions.find((action) => action.enabled && action.command.type === "CLEAR_ALLY")
        ?? allyActions.find((action) => action.enabled && action.command.type === "RETURN_ALLY")
        ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
        ?? selectedCaseActions.find((action) => action.enabled) ?? allyActions.find((action) => action.enabled)
        ?? growthActions.find((action) => action.enabled) ?? encounterActions.find((action) => action.enabled)
        ?? selectedCaseActions[0] ?? growthActions[0];
  // A real belly visit is deliberately insideCase; that must not hide its enabled original-bottle intent.
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME"
    && !oceanSinger.promoted && oceanSinger.ritual.location === "BELLY";
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (oceanSinger.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, oceanSinger.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || oceanSinger.promoted || oceanSinger.ritual.location !== "BELLY")) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, oceanSinger.promoted, oceanSinger.ritual.location]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: OceanSingerAction) {
    if (busy || interactionBlocked || oceanSinger.promoted || oceanSinger.ritual.location !== "BELLY" || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || oceanSinger.promoted || oceanSinger.ritual.location !== "BELLY") return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: OceanSingerAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `ocean-singer-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`ocean-singer-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel ocean-singer-panel seer-confirmation" aria-label="这瓶海洋歌者魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); }
    }}>
    <div className="slice-eyebrow">腹中服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section aria-label="服药前实际仪式位置"><h4>本次已保存的仪式现场</h4><RitualFacts ritual={oceanSinger.ritual} /></section>
    <section className="slice-notice seer-risk" aria-label="海洋歌者服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{oceanSinger.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{oceanSinger.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="ocean-singer-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "ocean-singer-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶，每次赴仪式最多服用一瓶。暂不服用不耗行动或原瓶，也不会退出腹中；返回卷宗后可选择实际撤出。成败都须由船组实际撤出并返港，不自动补满资源或退还费用。保存失败时等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel ocean-singer-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="海洋歌者成长下一步">
      <span className="seer-seal">{oceanSinger.promoted ? "海洋歌者5" : "风眷者6 → 海洋歌者5"}</span>
      <h3>{oceanSinger.title}</h3>
      {oceanSinger.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : oceanSinger.insideCase ? "请查看当前公开的撤出、结束与返程选项。"
          : oceanSinger.promoted && oceanSinger.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{oceanSinger.digestion}</p>
      {oceanSinger.discovered && !oceanSinger.promoted && <p className="slice-muted">用药指导：{oceanSinger.guidanceKnown ? "已听取" : "尚未听取"}。须完成风眷者消化100与十二个完整序列6周；指导、逐瓶劳务、付款取得原瓶、预约仪式和腹中逐瓶确认分别进行。</p>}
      <p className="slice-muted">{playerText("完整配方尚未核实，材料、剂量与调配顺序保持未知；本阶段使用本作原创G渠道的独立成品。已核仪式是在活体奥布尼斯海怪腹中服药，黏液会反弹声音与灵性，且存在腐蚀危险。")}</p>
    </section>
    {(oceanSinger.discovered || oceanSinger.ritual.location !== "DOCK") && <section className="slice-notice" aria-label="海洋歌者实际仪式与往返" aria-live="polite" aria-atomic="true">
      <h3>原近海仪式、外部水膜与实际返程</h3>
      <RitualFacts ritual={oceanSinger.ritual} />
      <p>向原导师艾洛·芬奇预约后，最早下一真实周赴仪式。180便士是原普通船程与步行的往返预付费用；抵岸后另付120便士，由专业船组实际启用外部防护水膜并引导进入同一活体原海怪。</p>
      <p>{playerText("船组、原船与设备、有限安排、路线和费用均为本作原创G；原海怪OS5-BEAST-1由船组既有安排接应，不是玩家操控。外部水膜不是航海家的气泡能力，也不是现实潜水指导。")}</p>
      <p>腹中每次只服一瓶。成功、失败或放弃都保留0行动实际撤出与预付返港选项；撤出才结束水膜，返港才回到原码头。在岸边或腹中不能用普通生活、周结或切换卷宗代替返程。费用不退，还需再次预约下一次仪式。</p>
      {ritualActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="海洋歌者仪式行动">{ritualActions.map(actionButton)}</div>}
    </section>}
    {oceanSinger.promoted && oceanSinger.environment && <section aria-label="当前海洋歌者现场"><h4>当前现场</h4><p>{oceanSinger.environment}</p></section>}
    {oceanSinger.promoted && (oceanSinger.practice || allyActions.length > 0) && <section className="slice-notice" aria-label="海洋歌者同伴位置与歌声" aria-live="polite" aria-atomic="true">
      <h3>米娅的位置、歌声与实际影响</h3>
      {oceanSinger.practice && <dl className="seer-facts">
        <div><dt>同伴实际位置</dt><dd>{oceanSinger.practice.allyPosition}</dd></div>
        <div><dt>当前歌声</dt><dd>{oceanSinger.practice.song}</dd></div>
        <div><dt>同伴所受影响</dt><dd>{oceanSinger.practice.affected}</dd></div>
      </dl>}
      <p>{playerText("原成年码头工米娅在排练现场近处2米；本作原创G的有限歌声范围为5米。她接受请求后，沿原8米普通步行回路移到范围外等候，歌声结束后才能按公开选项走回原位；准备与切换卷宗都不会移动她。")}</p>
      <p>可以未移位就尝试歌声，但近处同伴可能真实分神，捂耳也不保证免疫。须先实际停止歌声，再以普通交谈与休息处理本次分神，并让同伴实际返回，才能报告。结束歌声不会自动消除影响或移动同伴，返回不自动结束歌声。</p>
      {oceanSinger.practice && oceanSinger.practice.history.length > 0 && <details className="seer-fold"><summary>同伴、歌声与潮流的原记录</summary>
        <ul>{oceanSinger.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      </details>}
      {allyActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="海洋歌者同伴行动">{allyActions.map(actionButton)}</div>}
    </section>}
    {selectedCase && <section aria-label="海洋歌者有限实践">
      <h3>预先告知的排练、浅层雷击与跨周潮流复核</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || oceanSinger.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {oceanSinger.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前海洋歌者实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；原参与者、原靶、潮流和各自许可均以已保存的公开记录为准。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备不会提前开启歌声、留下雷击痕迹或完成跨周复核。"}</p>
        </section>
        {selectedCase.id === "tidal-observation" && <p className="slice-notice">先保存原潮流观察，再等到更晚的真实一周才能实际复核。能力方法只在原标记码头水盆使用继承的水流感知与有限小水流；普通方法实际比较记录。这里没有发生潜水行程，不会因等待或切换卷宗自动完成。</p>}
        {selectedCase.result && <section className="slice-notice" aria-label="海洋歌者实际结果" aria-live="polite" aria-atomic="true"><h4>本次实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前海洋歌者实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {oceanSinger.insideCase && <p className="slice-muted">实际收束前不能返回普通生活或战斗。0行动、0精神、0灵性时仍可使用公开开放的停止、撤回、普通交谈与原路返回选项；不退款、不治疗、不奖励，也不抹去原失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="海洋歌者成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="海洋歌者有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">成年码头管事布伦持自己的普通棍，位于原空置私有码头工院2米处；真实出口与不追击约定保留。这个冲突现场没有米娅或其他同伴，不等于歌声能自动排除友方。浅层雷击和短句歌声各按一次实际行动付费、判定，可能失败或受到抵抗；不强迫投降，也不保证免伤。</p>
      <div className="warrior-action-list" role="group" aria-label="海洋歌者冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {oceanSinger.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{oceanSinger.story}</p></details>}
    {oceanSinger.discovered && oceanSinger.supplies && <section className="slice-notice" aria-label="海洋歌者成品来源与取得"><h4>实际供给与独立原瓶</h4><p>{oceanSinger.supplies}</p></section>}
    {oceanSinger.discovered && oceanSinger.bottles.length > 0 && <details className="seer-fold" open={!oceanSinger.promoted}>
      <summary>海洋歌者独立成品原瓶 · 来源与去向</summary>
      {oceanSinger.bottles.map((bottle) => {
        const action = oceanSinger.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !oceanSinger.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !oceanSinger.promoted && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `ocean-singer-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`ocean-singer-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {oceanSinger.discovered && !oceanSinger.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{oceanSinger.risk}</p></details>}
    {oceanSinger.promoted && <section aria-label="海洋歌者能力与消化">
      <h3>能力与消化 · {oceanSinger.abilities.length} 项训练记录</h3>
      <p>扮演进度 {oceanSinger.acting} · 消化：{oceanSinger.digestion}</p>
      <progress className="cryptologist-progress" aria-label="海洋歌者扮演进度" value={oceanSinger.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {oceanSinger.pollution}</p>
      {oceanSinger.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <details className="seer-fold" aria-label="海洋歌者能力边界">
        <summary>查看歌声、浅层雷击与水下活动边界</summary>
        <p>歌声可以产生不同影响，也可能影响同伴；捂耳不保证免疫，歌声不保证命中或全面穿透防御。有限排练保留普通手势与沟通，不强制睡眠或控制本人。</p>
        <p>浅层雷击只在本次获准的原空置3米凹室，对原固定湿炭靶实际施用一次；靶处没有其他身体或随身金属。它不召唤天气，也不提供无限破坏或战利品。</p>
        <p>{playerText("更长水下活动的知识不代表无限潜水或本次已实际下水；跨周复核以原观察和真实小水流为据。序列4的雷暴、海啸和大型海怪统御未开放。所有故事、距离、费用、判定与练习数值为本作原创G，不能当作现实安全保证。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
