import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { NotaryProjection } from "../domain/notary/types";
import type { PriestOfLightAction, PriestOfLightCommand, PriestOfLightProjection } from "../domain/priest-of-light/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已有公开观察", PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待收束与报告", RESOLVED: "已提交有限报告",
};
const RITUAL_LOCATION = { GUIDE: "原导师处", CHAMBER: "原遮光地窖外间", ICE: "原不化坚冰中，身体实际被埋入" };

/** Old contracts and original tools remain factual history, never executable replacement actions. */
export function PriestOfLightNotaryHistory({ notary }: { notary: NotaryProjection }) {
  return <section className="seer-panel magician-panel priest-of-light-panel" aria-label="公证人时期的经历">
    <h3>公证人时期的经历</h3>
    <p className="slice-notice">你已晋升光之祭司（序列5）。这里保留公证人时期的原条款、本人签名、原测量工具、拒绝与失败、实际归还和能力掌握，只供回看。</p>
    <p>公证人扮演进度 {notary.acting} · 消化：{notary.digestion}</p>
    <section aria-label="公证人原契约与原工具状态">
      <h4>原签名、原契约与同一测量工具</h4>
      <dl className="seer-facts">
        <div><dt>本人签名认可</dt><dd>{notary.contract.signed ? "已明确签名认可原短契约" : "尚未签名认可"}</dd></div>
        <div><dt>原契约义务</dt><dd>{notary.contract.active ? "原归还承诺仍有效" : "当前没有生效中的契约义务"}</dd></div>
        <div><dt>同一原测量工具</dt><dd>{notary.contract.tool === "PLAYER" ? "本人实际持有" : "原工作间桌上"}</dd></div>
        <div><dt>原契约履行记录</dt><dd>{notary.contract.fulfilled ? "已经实际归还并履行原承诺" : "尚无原契约履行记录"}</dd></div>
      </dl>
      <p className="slice-muted">晋升与回看不会补签契约、归还原物或重新结算旧实践；状态以已保存的原记录为准。</p>
    </section>
    {(notary.story || notary.environment || notary.supplies) && <details className="seer-fold">
      <summary>公证人原故事与材料供给</summary>
      {notary.story && <p>{notary.story}</p>}{notary.environment && <p>{notary.environment}</p>}{notary.supplies && <p>{notary.supplies}</p>}
    </details>}
    {notary.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方法与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    {notary.formulaKnown && notary.formula.length > 0 && <details className="seer-fold">
      <summary>公证人时期已知配方</summary>
      <ul className="seer-formula">{notary.formula.map((material) => <li key={material.name}>
        <span>{material.name}</span><strong>{material.quantity} {material.unit}</strong>
      </li>)}</ul>
    </details>}
    {notary.bottles.length > 0 && <details className="seer-fold">
      <summary>公证人独立原瓶 · 来源与去向</summary>
      {notary.bottles.map((bottle) => <article className="magician-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {notary.abilities.length > 0 && <details className="seer-fold">
      <summary>公证人时期能力记录</summary>
      {notary.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
    <p className="slice-muted">原歌颂者、祈光人、太阳神官和公证人的知识与掌握继续保留。旧案不补发原瓶、材料或奖励，原拒绝、失败与成本继续存在。</p>
  </section>;
}

export interface PriestOfLightPanelProps {
  priestOfLight: PriestOfLightProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: PriestOfLightCommand) => void;
}
function isCaseAction(action: PriestOfLightAction): boolean { return "caseId" in action.command; }
function isRitualAction(action: PriestOfLightAction): boolean {
  return ["REQUEST_RITUAL", "GO_RITUAL", "BEGIN_RITUAL", "END_RITUAL", "RETURN_GUIDE"].includes(action.command.type);
}
function isLanternAction(action: PriestOfLightAction): boolean {
  return ["MOVE_LANTERN", "RETURN_LANTERN", "CLEAR_SPIRIT"].includes(action.command.type);
}
function isEncounterAction(action: PriestOfLightAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}
function RitualFacts({ ritual }: { ritual: PriestOfLightProjection["ritual"] }) {
  return <>
    <dl className="seer-facts">
      <div><dt>实际位置</dt><dd>{RITUAL_LOCATION[ritual.location]}</dd></div>
      <div><dt>本次仪式</dt><dd>{ritual.status}</dd></div>
      <div><dt>外部黑暗</dt><dd>{ritual.darkness ? "已实际完成普通遮光，无外部光照" : "当前未处于完整遮光中"}</dd></div>
      <div><dt>原不化坚冰</dt><dd>{ritual.nonMeltingIce ? "身体已实际埋入同一原不化坚冰" : "身体当前未埋入原不化坚冰"}</dd></div>
      <div><dt>原成年协助者</dt><dd>{ritual.helperPresent ? "原导师与协助者实际在场" : "当前没有仪式协助者在场"}</dd></div>
      <div><dt>实际赴仪式次数</dt><dd>{ritual.visits} 次</dd></div>
      <div><dt>坚冰中实际服药次数</dt><dd>{ritual.consumptions} 次</dd></div>
    </dl>
    <p>来源：{ritual.source}</p><p>{ritual.summary}</p>
  </>;
}

/** Only saved public bodies, original bottles and explicit action projections change this view. */
export function PriestOfLightPanel({ priestOfLight, resources, busy, blocked = false, error = null, onCommand }: PriestOfLightPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = priestOfLight.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = priestOfLight.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = priestOfLight.actions.filter(isCaseAction);
  const ritualActions = priestOfLight.actions.filter(isRitualAction);
  const lanternActions = priestOfLight.actions.filter(isLanternAction);
  const encounterActions = priestOfLight.actions.filter(isEncounterAction);
  const exitAction = caseActions.find((action) => action.enabled && action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.enabled && action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId
    : lanternActions.some((action) => action.enabled) ? "mixed-company" : null;
  const selectedCase = (priestOfLight.insideCase ? priestOfLight.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? priestOfLight.cases.find((entry) => entry.id === selectedCaseId)
    ?? priestOfLight.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? priestOfLight.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const growthActions = priestOfLight.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action)
    && !isRitualAction(action) && !isLanternAction(action) && !isEncounterAction(action));
  const enabledConsume = priestOfLight.actions.find((action) => action.command.type === "CONSUME" && action.enabled);
  // Being physically buried is insideCase too; its real bottle and emergency exits take priority.
  const nextAction = priestOfLight.ritual.location !== "GUIDE"
    ? enabledConsume ?? ritualActions.find((action) => action.enabled && action.command.type === "BEGIN_RITUAL")
      ?? ritualActions.find((action) => action.enabled && action.command.type === "END_RITUAL")
      ?? ritualActions.find((action) => action.enabled && action.command.type === "RETURN_GUIDE")
    : !priestOfLight.promoted
      ? growthActions.find((action) => action.enabled) ?? ritualActions.find((action) => action.enabled) ?? growthActions[0] ?? ritualActions[0]
      : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
        ?? lanternActions.find((action) => action.enabled && action.command.type === "CLEAR_SPIRIT")
        ?? lanternActions.find((action) => action.enabled && action.command.type === "RETURN_LANTERN")
        ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
        ?? selectedCaseActions.find((action) => action.enabled) ?? lanternActions.find((action) => action.enabled)
        ?? growthActions.find((action) => action.enabled) ?? encounterActions.find((action) => action.enabled)
        ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME"
    && !priestOfLight.promoted && priestOfLight.ritual.location === "ICE";
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (priestOfLight.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, priestOfLight.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || priestOfLight.promoted || priestOfLight.ritual.location !== "ICE")) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, priestOfLight.promoted, priestOfLight.ritual.location]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: PriestOfLightAction) {
    if (busy || interactionBlocked || priestOfLight.promoted || priestOfLight.ritual.location !== "ICE" || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || priestOfLight.promoted || priestOfLight.ritual.location !== "ICE") return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: PriestOfLightAction) {
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `priest-of-light-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`priest-of-light-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作，继续同一原操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel magician-panel priest-of-light-panel seer-confirmation" aria-label="这瓶光之祭司魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); } }}>
    <div className="slice-eyebrow">真实坚冰与外部黑暗中，独立确认这一原瓶</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一原瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section aria-label="服药前实际仪式位置"><h4>本次已保存的仪式现场</h4><RitualFacts ritual={priestOfLight.ritual} /></section>
    <section className="slice-notice seer-risk" aria-label="光之祭司服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{priestOfLight.risk}</p></section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{priestOfLight.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="priest-of-light-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "priest-of-light-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才由原成年导师通过原预备仪式通道喂入这一真实原瓶，每次赴仪式最多一瓶。暂不服用不耗行动或原瓶，也不会移出坚冰；返回卷宗后可选0行动实际解埋与返程。成败都保留原瓶耗用、费用和实际结果，不退款或补满资源。保存失败时等待同一原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel magician-panel priest-of-light-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="光之祭司成长下一步">
      <span className="seer-seal">{priestOfLight.promoted ? "光之祭司5" : "公证人6 → 光之祭司5"}</span>
      <h3>{priestOfLight.title}</h3>
      {priestOfLight.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : priestOfLight.insideCase ? "请查看当前公开的解埋、结束、复位与返程选项。"
          : priestOfLight.promoted && priestOfLight.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{priestOfLight.digestion}</p>
      {priestOfLight.discovered && !priestOfLight.promoted && <p className="slice-muted">服用前须完成公证人消化100与十二个完整序列6周。学习配方、每批五步劳务、取得实际六料、调配独立原瓶、预约下一周仪式和逐瓶确认分别提交。</p>}
      <p className="slice-muted">已核仪式需要纯粹的外部黑暗，身体实际埋入正常情况下不化的坚冰，并实际服下魔药。这里使用普通遮光与原不化坚冰，不是光之祭司制造黑暗领域、创造冰块或在梦中服用虚假魔药。</p>
    </section>
    {(priestOfLight.discovered || priestOfLight.ritual.location !== "GUIDE") && <section className="slice-notice" aria-label="光之祭司实际仪式与往返" aria-live="polite" aria-atomic="true">
      <h3>原遮光地窖、同一不化坚冰与实际解埋</h3><RitualFacts ritual={priestOfLight.ritual} />
      <p>向原导师预约后，最早下一真实周赴原地窖。180便士预付原普通路线往返，另付120便士请原成年协助者核对普通遮光、使用既有封存专业仪式冰料PL5-ICE-1并实际埋入原身体。普通冰不能替代这块原不化坚冰。</p>
      <p>{playerText("原成年导师通过原预备狭窄仪式通道喂入同一真实原瓶。供冰来源、通道与协助安排是本作原创G抽象，不提供现实低温或仪式操作指导，也不保证绝对安全。")}</p>
      <p>服药前后、成功失败或放弃都保留0行动实际解埋：由协助者实际打开原冰室、移动原冰并移出身体；随后按预付原路步行回到导师处。解埋才结束遮光与埋冰状态，同一原冰仍保留，不会被法术凭空消耗或重造。</p>
      <p>在地窖或坚冰中不能用普通生活、周结或切换卷宗代替返程。原费用不退，每次仪式最多服用一瓶，再次尝试须另约下一真实周。</p>
      {ritualActions.length > 0 && <div className="magician-action-list" role="group" aria-label="光之祭司仪式行动">{ritualActions.map(actionButton)}</div>}
    </section>}
    {priestOfLight.promoted && priestOfLight.environment && <section aria-label="当前光之祭司现场"><h4>当前现场</h4><p>{priestOfLight.environment}</p></section>}
    {priestOfLight.promoted && (priestOfLight.practice || lanternActions.length > 0) && <section className="slice-notice" aria-label="光之祭司原灯与净化光环" aria-live="polite" aria-atomic="true">
      <h3>原灯、友好小灵体与实际光环状态</h3>
      {priestOfLight.practice && <dl className="seer-facts">
        <div><dt>原灯与栖灯实际位置</dt><dd>{priestOfLight.practice.lanternPosition}</dd></div>
        <div><dt>当前净化光环</dt><dd>{priestOfLight.practice.aura}</dd></div>
        <div><dt>栖灯所受影响</dt><dd>{priestOfLight.practice.distressed}</dd></div>
      </dl>}
      <p>{playerText("原成年协助者与原灯中的友好小灵体“栖灯”起初都在近处2米；本作原创G光环范围为5米。净化光环也会影响友方灵体。可先请原主人带着同一原灯和栖灯，沿原8米普通路线移到范围外；准备与切换卷宗不会替他们移动。")}</p>
      <p>未移位就开启光环可能使近处栖灯短暂不适、受到驱避，但它没有因此死亡或被净化消失。须先0行动停止光环，再由原主人以普通照料处理本次不适，最后让主人携原灯和栖灯沿原8米路线实际返回，才能报告；三步分别执行。</p>
      {priestOfLight.practice && priestOfLight.practice.history.length > 0 && <details className="seer-fold"><summary>原照明、残留与原灯记录</summary>
        <ul>{priestOfLight.practice.history.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      </details>}
      {lanternActions.length > 0 && <div className="magician-action-list" role="group" aria-label="光之祭司原灯与灵体行动">{lanternActions.map(actionButton)}</div>}
    </section>}
    {selectedCase && <section aria-label="光之祭司有限实践">
      <h3>有限照明、原残留与友好同行者</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || priestOfLight.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {priestOfLight.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前光之祭司实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；原工作间、原石板、原灯和在场者均以已保存记录为准。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备不会提前照明、减轻原残留、开启光环或移动原灯。"}</p>
        </section>
        {selectedCase.id === "darkened-walk" && <p className="slice-notice">本次仅在原3米暗工作间实际使用有限圣光，或请导师摆放原普通小灯比较；没有替任何人治疗或消除所有恐惧。</p>}
        {selectedCase.id === "bounded-cleansing" && <p className="slice-notice">目标是同一原空置石板上有限的旧死亡残留，不是活人或任意污染。圣光只可能有限减轻这一原残留；普通方法由导师实际使用原普通密封容器移走原石板，不冒充能力净化，也不重造残留。</p>}
        {selectedCase.result && <section className="slice-notice" aria-label="光之祭司实际结果" aria-live="polite" aria-atomic="true"><h4>本次实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前光之祭司实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {priestOfLight.insideCase && <p className="slice-muted">实际收束前不能返回普通生活或战斗。0行动、0精神、0灵性时仍保留公开开放的停止光环、撤回准备、主人照料与原灯实际返回选项；不退款、不治疗、不奖励，也不抹去原失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="光之祭司成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="光之祭司有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">原成年普通门房凯恩持自己的普通棍，位于原空置私家庭院2米处，真实出口与不追击约定保留。现场没有灵体或同伴。凯恩是普通人，不贴“邪恶”标签，也不因太阳途径获得对人的虚构特效；圣光按普通攻击与实际掌握结算。</p>
      <p className="slice-muted">继承短赞歌仍实际耗费灵性，不创造自我回充。和平现场的净化光环不会自动排除友方灵体，也不变成对普通人的额外惩罚。</p>
      <div className="magician-action-list" role="group" aria-label="光之祭司冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {priestOfLight.discovered && priestOfLight.supplies && <section className="slice-notice" aria-label="光之祭司实际六料与批次"><h4>实际六料与独立批次</h4><p>{priestOfLight.supplies}</p></section>}
    {priestOfLight.formulaKnown && priestOfLight.formula.length > 0 && <details className="seer-fold" aria-label="光之祭司已知配方">
      <summary>查看已知光之祭司配方 · {priestOfLight.formula.length} 种材料</summary>
      <ul className="seer-formula">{priestOfLight.formula.map((material) => <li key={material.name}>
        <span>{material.name}</span><strong>{material.quantity === null ? playerText("原著未给量") : `${material.quantity} ${material.unit}`}</strong>
        {material.note && <small>{material.note}</small>}
      </li>)}</ul>
      <p className="slice-muted">{playerText("黎明雄鸡之王红冠的原著用量未给出，G供货为一份原批，不补编克重。完整配方不另加纯水；调配顺序未完整核实，原导师指导流程为本作原创G。领取同批六料与实际调配分别提交，六件原材料耗用后才产生对应独立原瓶。")}</p>
    </details>}
    {priestOfLight.discovered && priestOfLight.bottles.length > 0 && <details className="seer-fold" open={!priestOfLight.promoted}>
      <summary>光之祭司独立原瓶 · 原材料来源与去向</summary>
      {priestOfLight.bottles.map((bottle) => {
        const action = priestOfLight.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !priestOfLight.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !priestOfLight.promoted && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `priest-of-light-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`priest-of-light-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {priestOfLight.discovered && !priestOfLight.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{priestOfLight.risk}</p></details>}
    {priestOfLight.promoted && <section aria-label="光之祭司能力与消化">
      <h3>能力与消化 · {priestOfLight.abilities.length} 项训练记录</h3>
      <p>扮演进度 {priestOfLight.acting} · 消化：{priestOfLight.digestion}</p>
      <progress className="cryptologist-progress" aria-label="光之祭司扮演进度" value={priestOfLight.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {priestOfLight.pollution}</p>
      {priestOfLight.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <details className="seer-fold" aria-label="光之祭司能力边界">
        <summary>查看圣光、净化光环与原物边界</summary>
        <p>圣光只处理本次获准的有限照明、同一原残留或真实战斗目标，不是治疗、复活、清除所有恐惧或解决一切污染。</p>
        <p>净化光环可能影响友好灵体，必须实际停止、处理影响并由主人带原灯返回。栖灯始终是原主人灯中的同一友好灵体，不是玩家宠物、道具或奖励；不会因失败被写成死亡或净化消失。</p>
        <p>{playerText("序列4无暗领域与非凡特性净化未开放；不创造不化坚冰、不重置原石板残留、不据人的身份或道德标签制造战斗加成。故事、距离、费用、判定与有限照料是本作原创G，不是现实安全保证。")}</p>
      </details>
    </section>}
    {priestOfLight.story && <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary><p>{priestOfLight.story}</p></details>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
