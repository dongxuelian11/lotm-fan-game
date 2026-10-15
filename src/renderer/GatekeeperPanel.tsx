import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { GatekeeperAction, GatekeeperCommand, GatekeeperProjection } from "../domain/gatekeeper/types";
import type { SpiritGuideProjection } from "../domain/spirit-guide/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场",
  OBSERVED: "已有公开观察",
  PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告",
  RESOLVED: "已提交有限报告",
};

/** Preserve the S6 original messenger agreement, letter, fees, failures and mastery without new permission. */
export function GatekeeperSpiritGuideHistory({ spiritGuide }: { spiritGuide: SpiritGuideProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="死灵导师时期的经历">
    <h3>死灵导师时期的经历</h3>
    <p className="slice-notice">你已晋升看门人（序列5）。这里保留死灵导师时期的有限信使约定、原信递送、实际答复、已付费用、亡者之语、失败、实际结束与独立原瓶，只供回看。</p>
    <p>死灵导师扮演进度 {spiritGuide.acting} · 消化：{spiritGuide.digestion}</p>
    {(spiritGuide.story || spiritGuide.environment || spiritGuide.supplies) && <details className="seer-fold">
      <summary>死灵导师原故事与供给</summary>
      {spiritGuide.story && <p>{spiritGuide.story}</p>}
      {spiritGuide.environment && <p>{spiritGuide.environment}</p>}
      {spiritGuide.supplies && <p>{spiritGuide.supplies}</p>}
    </details>}
    <section className="slice-notice" aria-label="死灵导师原信使约定与原信去向">
      <h4>灰羽的旧约定、原信与实际答复</h4>
      <dl className="seer-facts">
        <div><dt>旧有限信使约定</dt><dd>{spiritGuide.messenger.recruited ? "曾实际招募灰羽，仅适用原有限条款" : "当时未实际招募灰羽"}</dd></div>
        <div><dt>旧约定已付费用</dt><dd>{spiritGuide.messenger.feePaid}便士</dd></div>
        <div><dt>旧原信实际递送次数</dt><dd>{spiritGuide.messenger.deliveries}</dd></div>
        <div><dt>旧密封教学信原件</dt><dd>{spiritGuide.messenger.letter === "RECIPIENT" ? "仍在原收件人手中，不因晋升取回或重置" : "仍在导师房间的原桌上"}</dd></div>
        <div><dt>旧实际答复</dt><dd>{spiritGuide.messenger.replyReceived ? "已实际带回当时的有限答复" : "当时尚未实际带回答复"}</dd></div>
      </dl>
      <p className="slice-muted">旧约定只覆盖当时的一封教学信与一次有限答复，不能授权现在进入体内冥界、派出协作或参加冲突。本阶段须向同一灰羽重新提出自愿短驻约定并实际支付新费用；不能据旧招募记录声称它已经进入身体。</p>
    </section>
    {spiritGuide.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方案与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <p className="slice-muted">这里展示死灵导师原记录，不重新结算旧实践、发奖、抹去失败或把旧约定续作新许可。灰羽仍是同一个原灵体；旧信的原件去向、答复和费用保持原样，新木牌不替换旧信。原能力ID与掌握继续保留。</p>
    {spiritGuide.bottles.length > 0 && <details className="seer-fold">
      <summary>死灵导师原瓶 · 来源与去向</summary>
      {spiritGuide.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {spiritGuide.abilities.length > 0 && <details className="seer-fold">
      <summary>死灵导师时期能力记录</summary>
      {spiritGuide.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface GatekeeperPanelProps {
  gatekeeper: GatekeeperProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: GatekeeperCommand) => void;
}

function isCaseAction(action: GatekeeperAction): boolean { return "caseId" in action.command; }
function isSpiritAction(action: GatekeeperAction): boolean {
  return ["INVITE_SPIRIT", "RELEASE_SPIRIT", "RECALL_SPIRIT", "RETRIEVE_MARKER"].includes(action.command.type);
}
function isEncounterAction(action: GatekeeperAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render committed public observations and submit the original projected intent unchanged. */
export function GatekeeperPanel({ gatekeeper, resources, busy, blocked = false, error = null, onCommand }: GatekeeperPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = gatekeeper.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = gatekeeper.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = gatekeeper.actions.filter(isCaseAction);
  // Only public exit intents locate a currently open scene; prose is never parsed as state.
  const exitAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "WITHDRAW" && action.enabled);
  const fallbackExit = caseActions.find((action) => action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId
    : gatekeeper.actions.some((action) => action.command.type === "RETRIEVE_MARKER" && action.enabled) ? "shared-task"
      : fallbackExit && "caseId" in fallbackExit.command ? fallbackExit.command.caseId : null;
  const selectedCase = (gatekeeper.insideCase ? gatekeeper.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? gatekeeper.cases.find((entry) => entry.id === selectedCaseId)
    ?? gatekeeper.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? gatekeeper.cases[0];
  // Public enabled intents remain usable inside the scene, including zero-resource exits.
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = gatekeeper.actions.filter(isEncounterAction);
  const spiritActions = gatekeeper.actions.filter(isSpiritAction);
  const growthActions = gatekeeper.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action) && !isSpiritAction(action));
  const nextAction = !gatekeeper.promoted
    ? gatekeeper.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
      ?? (gatekeeper.insideCase ? spiritActions.find((action) => action.enabled && action.command.type === "RETRIEVE_MARKER")
        ?? spiritActions.find((action) => action.enabled && action.command.type === "RECALL_SPIRIT") : undefined)
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
      ?? selectedCaseActions.find((action) => action.enabled)
      ?? spiritActions.find((action) => action.enabled && action.command.type === "INVITE_SPIRIT")
      ?? growthActions.find((action) => action.enabled)
      ?? encounterActions.find((action) => action.enabled)
      ?? spiritActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !gatekeeper.promoted && !gatekeeper.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (gatekeeper.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, gatekeeper.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || gatekeeper.promoted || gatekeeper.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, gatekeeper.promoted, gatekeeper.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: GatekeeperAction) {
    if (busy || interactionBlocked || gatekeeper.insideCase || gatekeeper.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || gatekeeper.promoted || gatekeeper.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: GatekeeperAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `gatekeeper-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`gatekeeper-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel gatekeeper-panel seer-confirmation" aria-label="这瓶看门人魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方与晋升仪式细节仍待核实；本次只确认本作原创G导师准备与指导流程中的这一成品原瓶，不表示无需仪式，也不虚构仪式材料或步骤。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="看门人服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{gatekeeper.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{gatekeeper.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="gatekeeper-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "gatekeeper-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel gatekeeper-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="看门人成长下一步">
      <span className="seer-seal">{gatekeeper.promoted ? "看门人5" : "死灵导师6 → 看门人5"}</span>
      <h3>{gatekeeper.title}</h3>
      {gatekeeper.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : gatekeeper.insideCase ? "请查看当前公开的结束实践选项。"
          : gatekeeper.promoted && gatekeeper.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{gatekeeper.digestion}</p>
      {gatekeeper.discovered && !gatekeeper.promoted && <p className="slice-muted">用药指导：{gatekeeper.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得原瓶与逐瓶确认分别进行；实际费用、成熟条件与安全恢复范围以公开记录为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与晋升仪式细节尚未核实，材料、剂量、调配顺序及具体仪式要求保持未知，不能据此断言无需仪式。本阶段采用本作原创G的独立成品渠道、导师准备与指导服药流程，不提供虚构材料表。")}</p>
    </section>

    {gatekeeper.promoted && gatekeeper.environment && <section aria-label="当前看门人现场">
      <h4>当前现场</h4><p>{gatekeeper.environment}</p>
    </section>}
    {gatekeeper.promoted && gatekeeper.companion && <section className="slice-notice" aria-label="看门人原灵体与实际经历">
      <h3>{gatekeeper.companion.name} · 原灵体记录</h3>
      <dl className="seer-facts">
        <div><dt>原灵体来源</dt><dd>{gatekeeper.companion.source}</dd></div>
        <div><dt>当前实际状态</dt><dd>{gatekeeper.companion.status}</dd></div>
      </dl>
      {gatekeeper.companion.history.length > 0
        ? <ul>{gatekeeper.companion.history.map((entry, index) => <li key={`${gatekeeper.companion!.source}-${index}`}>{entry}</li>)}</ul>
        : <p className="slice-muted">尚无已保存的邀请、收容或协作经历。</p>}
      <p className="slice-muted">晋升不会自动获得灵体。灰羽SG6-GRAY-FEATHER是死灵导师时期的同一个低强原灵体；旧单信约定不授权体内短驻，须实际邀请成功、灰羽自愿接受新约定且本人支付12便士后，才进入本人体内的有限小冥界。失败不收费用，已耗行动与灵性保留。</p>
      <p className="slice-muted">同一灰羽在体内休憩本身不会阻断普通生活，也不会额外免费行动。召回只让实际派出的原灰羽返回体内，不取回木牌或结束其他接触。和平释放须按公开行动让同一灰羽离开身体、回到导师原工作室的原栖架；经历与费用不重置，下次入内须重新邀请。</p>
    </section>}
    {gatekeeper.promoted && gatekeeper.practice && <section className="slice-notice" aria-label="看门人原木牌与当前冥界之门">
      <h3>原木牌与当前冥界之门</h3>
      <dl className="seer-facts">
        <div><dt>原木牌去向</dt><dd>{gatekeeper.practice.marker}</dd></div>
        <div><dt>当前冥界之门</dt><dd>{gatekeeper.practice.gate}</dd></div>
      </dl>
      <p>{gatekeeper.practice.summary}</p>
      <p className="slice-muted">新教学木牌GK5-MARKER-1始终属于导师，与旧密封教学信是两件不同原物。结束接触或召回灰羽不会自动取回原木牌；须让同意保管的成年看守交回，本人沿相邻两米普通路径实际往返。门限练习时本人实际步行十米到空置凹室，结束维持、完全关门后再沿原路返回；固定布条不脱离原锚点，没有人物或物品被传送。</p>
    </section>}
    {spiritActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="看门人原灵体与原件行动">{spiritActions.map(actionButton)}</div>}
    {selectedCase && <section aria-label="看门人有限实践">
      <h3>有限休憩、原木牌协作与可控门限</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || gatekeeper.insideCase}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {gatekeeper.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前看门人实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；同一灰羽、原木牌去向与冥界之门状态均以已保存的公开记录为准。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备只记录方案，不会提前取得灰羽、递送原木牌、走到凹室或开启冥界之门；效果只在实际执行并保存后显示。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="看门人实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前看门人实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {gatekeeper.insideCase && <p className="slice-muted">返回生活前须实际结束当前接触、完全关闭正在维持的门并实际返回、召回已派出的灰羽，以及取回尚由看守保管的原木牌。0行动、0精神、0灵性时仍可使用已开放的结束、召回、取回或撤回选项；不会另抽随机、发奖、退款、治疗或清除原失败。体内安静休憩的灰羽本身不会冻结普通生活，无须为继续生活强制释放；释放同样为0行动，是否开放以当前公开选项为准。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="看门人成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="看门人有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">旧纪念院的成年看守洛克持自己的普通短棍，私人空院的真实出口与普通两米距离以实际现场为准。可选择交涉或承担真实战斗风险。短暂开门只影响原对手的站姿并在本次行动内关闭；实际在体内的灰羽才可短暂离体协助并返回，均有真实灵性成本，不保证命中、胜利或免伤，不放逐对手或凭空获得灵体。</p>
      <div className="warrior-action-list" role="group" aria-label="看门人冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {gatekeeper.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{gatekeeper.story}</p></details>}
    {gatekeeper.discovered && gatekeeper.supplies && <section className="slice-notice" aria-label="看门人成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{gatekeeper.supplies}</p>
    </section>}
    {gatekeeper.discovered && gatekeeper.bottles.length > 0 && <details className="seer-fold" open={!gatekeeper.promoted}>
      <summary>看门人独立成品原瓶 · 来源与去向</summary>
      {gatekeeper.bottles.map((bottle) => {
        const action = gatekeeper.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !gatekeeper.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !gatekeeper.promoted && !gatekeeper.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `gatekeeper-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`gatekeeper-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {gatekeeper.discovered && !gatekeeper.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{gatekeeper.risk}</p></details>}
    {gatekeeper.promoted && <section aria-label="看门人能力与消化">
      <h3>能力与消化 · {gatekeeper.abilities.length} 项训练记录</h3>
      <p>扮演进度 {gatekeeper.acting} · 消化：{gatekeeper.digestion}</p>
      <progress className="cryptologist-progress" aria-label="看门人扮演进度" value={gatekeeper.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {gatekeeper.pollution}</p>
      {gatekeeper.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="看门人能力边界">
        <summary>查看体内冥界、原灰羽协助与冥界之门边界</summary>
        <p>{playerText("看门人的身体形成专属、有限的体内冥界，可供实际取得的灵体休憩和有限协助；本阶段容量限定为同一个低强灰羽，这是本作原创G的练习范围。晋升不会赠送灵体库，不把灰羽的协助变成本人永久学会的全部技能，也不构成对任意高位存在的无敌监牢。")}</p>
        <p>体内休憩不冻结本人普通生活。协作须实际派出同一灰羽，召回让它真正回到体内；和平释放让原灰羽回到原工作室栖架，下次进入须重新接受约定并付费。旧信使约定、旧信去向和已付费用不会因此延长、重置或退款。</p>
        <p>冥界之门具有吸引灵体及实物的能力，也会遭抵抗，高位者可能脱离。本阶段只在本人实际走到的空置私有凹室进行有限、需维持的三米门限练习；灰羽先释放在十米外原栖架，试验区没有其他同伴或松散贵重物。固定布条只轻微绷向原锚点，必须显式关门再步行回原室，不是世界传送或复活。</p>
        <p>灰羽SG6-GRAY-FEATHER、新木牌GK5-MARKER-1、固定布条GK5-CLOTH-1与旧教学信都保留各自原身份。普通本人递送和普通风力核对也能完成和平消化，不虚构灵体入内、开门或能力收益；原能力ID与掌握继续保留。</p>
        <p>本阶段不会获得序列4的不死与复活，也不赠送特殊戒指、高位灵体、船只或旅行能力。若本人在战斗中实际死亡，体内原灵体在该死亡现场离体，不传送回原栖架，也不提供暗中救援。</p>
        <p>{playerText("三项有限实践、导师准备、容量、费用、距离、判定与消化数值均为本作原创G。完整魔药配方与晋升仪式细节仍待核实，不能断言无需仪式；实际条件、失败与成本依公开选项结算。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
