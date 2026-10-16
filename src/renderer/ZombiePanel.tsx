import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ZombieAction, ZombieCommand, ZombieProjection } from "../domain/zombie/types";
import type { WerewolfProjection } from "../domain/werewolf/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对本次现场", OBSERVED: "已有普通观察与现场边界", PREPARED: "已选择方法，尚未实际执行",
  EXAMINED: "已有实际结果，请完成收束再报告", RESOLVED: "已实际收束并提交有限报告",
};
const BODY_LABELS = { NORMAL: "本人处于日常姿态", BRACED: "本人仍在承受原负荷" } as const;
const COLD_LABELS = { NONE: "原冷盘尚无本次薄霜", ICED: "同一原冷盘仍有本次薄霜", THAWED: "同一原冷盘已实际回温" } as const;
const SPIRIT_LABELS = { ABSENT: "本次尚未接触赫姆", PRESENT: "原有幽魂赫姆仍在本次有限接触中", RELEASED: "已实际解除与赫姆的本次接触" } as const;

/** Earlier practice, moon costs and original bottles are history, never new S7 actions. */
export function ZombieWerewolfHistory({ werewolf,currentTitle="活尸（序列6）" }: { werewolf: WerewolfProjection;currentTitle?:string }) {
  return <section className="seer-panel zombie-panel" aria-label="狼人时期的经历">
    <h3>狼人时期的经历</h3>
    <p className="slice-notice">你已晋升{currentTitle}。这里保留狼人时期的原故事、实践、失败、实际返回、月圆代价与独立原瓶，只供回看。活尸的新诅咒替代原狼人、疯子诅咒，旧记录和八项原能力掌握继续保留。</p>
    <p>狼人扮演进度 {werewolf.acting} · 消化：{werewolf.digestion}</p>
    {(werewolf.story || werewolf.environment || werewolf.supplies) && <details className="seer-fold">
      <summary>狼人原故事与供给</summary>
      {werewolf.story && <p>{werewolf.story}</p>}{werewolf.environment && <p>{werewolf.environment}</p>}{werewolf.supplies && <p>{werewolf.supplies}</p>}
    </details>}
    {werewolf.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status === "RESOLVED" ? "已提交原报告" : "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方式与准备：{entry.preparation}</p>}
      <p>当时的现场：{entry.sceneOpen}</p><p>当时实际返回次数：{entry.returns}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold">
      <summary>狼人原月圆记录 · 仅作历史保留</summary>
      <p>{werewolf.moon.summary}</p>
      <p className="slice-muted">原阶段记录状态：{werewolf.moon.pending ? "当时尚有待处理记录" : "当时没有待处理记录"}。当前发作以活尸卷宗为准，不再收取旧诅咒成本。</p>
      {werewolf.moon.history.map((entry, index) => <p key={`${entry.week}-${index}`}>第{entry.week}周 · {entry.method === "GUARDED" ? "原哈伦工坊看守过夜" : "原地点独自过夜"} · 原实际精神消耗{entry.mentalCost}</p>)}
    </details>
    {werewolf.bottles.length > 0 && <details className="seer-fold">
      <summary>狼人原瓶 · 来源与去向</summary>
      {werewolf.bottles.map((bottle) => <article key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {werewolf.abilities.length > 0 && <details className="seer-fold">
      <summary>狼人时期能力记录</summary>
      {werewolf.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface ZombiePanelProps {
  zombie: ZombieProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ZombieCommand) => void;
}
function isCaseAction(action: ZombieAction): boolean { return "caseId" in action.command; }
function isEncounterAction(action: ZombieAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Local selection is reversible; only committed projections change bodies, scenes or costs. */
export function ZombiePanel({ zombie, resources, busy, blocked = false, error = null, onCommand }: ZombiePanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = zombie.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = zombie.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = zombie.actions.filter(isCaseAction);
  // Public CLOSE identifies the actual open contact, never old prose or a selected case.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const moonPending = zombie.moon.pending;
  const insidePractice = zombie.insideCase && (!moonPending || closeAction?.enabled === true);
  const sceneLocked = zombie.insideCase || moonPending;
  const selectedCase = (insidePractice ? zombie.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? zombie.cases.find((entry) => entry.id === selectedCaseId)
    ?? zombie.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? zombie.cases[0];
  const selectedCaseActions = selectedCase && (!moonPending || insidePractice) ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!insidePractice || action.command.type === "CLOSE")) : [];
  const moonActions = moonPending && !insidePractice ? zombie.actions.filter((action) => action.command.type === "HANDLE_MOON") : [];
  const encounterActions = sceneLocked ? [] : zombie.actions.filter(isEncounterAction);
  const growthActions = sceneLocked ? [] : zombie.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "HANDLE_MOON" && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = insidePractice ? closeAction : moonPending ? moonActions.find((action) => action.enabled) ?? moonActions[0]
    : !zombie.promoted ? zombie.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0] ?? encounterActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !zombie.promoted && !sceneLocked;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (insidePractice || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, insidePractice]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || zombie.promoted || sceneLocked)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, zombie.promoted, sceneLocked]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ZombieAction) {
    if (busy || interactionBlocked || sceneLocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || zombie.promoted || sceneLocked) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: ZombieAction) {
    const unavailable = insidePractice ? action.command.type !== "CLOSE" : moonPending && action.command.type !== "HANDLE_MOON";
    return <div className="seer-action magician-compact-action" key={action.id}>
      <button className={sceneLocked ? "slice-choice primary" : "slice-choice"} disabled={busy || interactionBlocked || unavailable || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || unavailable || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `zombie-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`zombie-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel zombie-panel seer-confirmation" aria-label="这瓶活尸魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); } }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="活尸服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{zombie.risk}</p>
      <p>晋升后新月圆诅咒替代原狼人、疯子诅咒。节制时仍有剧痛并暂时不能战斗，须实际度过本次发作；消化或一次看守不会永久解除诅咒。</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{zombie.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="zombie-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "zombie-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才消耗这一原瓶。暂不服用不消耗行动；保存失败会保留本次确认，等待原操作重试。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel zombie-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="活尸成长下一步">
      <span className="seer-seal">{zombie.promoted ? "序列 6" : "活尸晋升卷宗"}</span>
      <h3>{zombie.title}</h3>
      <p className="seer-next">{insidePractice
        ? <><strong>先实际收束本次接触：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束为0行动、0精神、0灵性，保留已付成本。</>
        : moonPending ? <><strong>先度过本次月圆：</strong>{nextAction?.label || "查看当前公开月圆处理选项"}。节制剧痛期间不能战斗，完成实际过夜后才能继续。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : zombie.promoted && zombie.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{zombie.digestion}</p>
    </section>

    {zombie.promoted && <section className="slice-notice" aria-label="活尸月圆诅咒与实际过夜">
      <h4>{moonPending ? "本次月圆尚未度过" : "活尸月圆诅咒"}</h4>
      <p>{zombie.moon.summary}</p>
      {moonPending && <p>节制带来的剧痛尚未结束，当前不能战斗；不会自动伤害他人或生成受害者。</p>}
      {moonActions.length > 0 && <div role="group" aria-label="本次活尸月圆处理选择">{moonActions.map(actionButton)}</div>}
      <details className="seer-fold"><summary>月圆代价与已公示事件</summary>
        <p>{playerText("新诅咒替代狼人、疯子旧诅咒，不叠加旧阶段收费。沿用已提前公示的有限G月相事件，不按每四周推算；后续未展开不代表诅咒消失。")}</p>
        <p>看守协助须在贝克兰德原哈伦工坊实际度过本次发作，扣除当前精神与10中的较小值；独自承受须在当前地点停止接触并实际过夜，扣除当前精神与20中的较小值。均为0行动、0灵性，精神为0仍可完成；不治疗、不奖励、不退还原成本。</p>
        <p>{playerText("消化与节制不能免费解咒，处理一次只结束当次发作。有限事件、看守方式和数值均为本作原创G。")}</p>
      </details>
      {zombie.moon.history.length > 0 && <details className="seer-fold"><summary>已经实际度过的活尸月圆</summary>
        {zombie.moon.history.map((entry, index) => <p key={`${entry.week}-${index}`}>第{entry.week}周 · {entry.method === "GUARDED" ? "原哈伦工坊看守过夜" : "原地点停止接触并独自过夜"} · 实际精神消耗{entry.mentalCost}</p>)}
      </details>}
    </section>}

    {zombie.promoted && zombie.environment && <section aria-label="当前活尸现场"><h4>当前现场</h4><p>{zombie.environment}</p></section>}
    {zombie.promoted && <section aria-label="当前承力、冷盘与幽魂接触">
      <h4>当前公开状态</h4>
      <p>当前本人身体：{BODY_LABELS[zombie.practice.body]}</p>
      <p>当前原冷盘：{COLD_LABELS[zombie.practice.cold]}</p>
      <p>当前幽魂接触：{SPIRIT_LABELS[zombie.practice.spirit]}</p>
    </section>}
    {selectedCase && (!moonPending || insidePractice) && <section aria-label="活尸有限实践">
      <h3>本人承力、同一冷盘与有限协助</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || sceneLocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {zombie.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前活尸实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察。先核对原现场与安全退路。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。选择方法不会提前承力、凝霜或建立幽魂接触。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="活尸实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="magician-action-list" role="group" aria-label="当前活尸实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {insidePractice && <p className="slice-muted">先按当前结束选项实际放松承力、回温原冷盘或解除本次幽魂接触，再报告或做其它事。结束不另抽随机、不奖励、不退款、不治疗，也不抹去原失败。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="magician-action-list" role="group" aria-label="活尸成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="活尸有限冲突">
      <h3>有限现场冲突</h3>
      <div className="magician-action-list" role="group" aria-label="活尸冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}

    {zombie.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{zombie.story}</p></details>}
    {zombie.discovered && <details className="seer-fold" aria-label="活尸成品来源与配方边界">
      <summary>成品来源、费用与配方边界</summary>
      <p>{playerText("须完成狼人消化100与十二个完整序列7周。G指导360便士；每瓶3320便士，或5步劳务抵扣3000便士后付320便士。三瓶独立成品分别取得、逐瓶确认，按意志24四档结算；失败仍耗用原瓶。")}</p>
      <p>{playerText("完整晋升配方、材料与剂量尚未核实；这里只提供有来源的G独立成品，用药指导不解锁调配。")}</p>
      {zombie.supplies && <p>{zombie.supplies}</p>}
    </details>}
    {zombie.discovered && zombie.bottles.length > 0 && <details className="seer-fold" open={!zombie.promoted}>
      <summary>活尸独立成品原瓶 · 来源与去向</summary>
      {zombie.bottles.map((bottle) => {
        const action = zombie.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !zombie.promoted ? "seer-bottle" : "magician-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !zombie.promoted && !sceneLocked && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `zombie-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`zombie-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {zombie.discovered && !zombie.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{zombie.risk}</p></details>}
    {zombie.promoted && <section aria-label="活尸能力与消化">
      <h3>能力与消化 · {zombie.abilities.length} 项训练记录</h3>
      <p>扮演进度 {zombie.acting} · 消化：{zombie.digestion}</p>
      <progress className="cryptologist-progress" aria-label="活尸扮演进度" value={zombie.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {zombie.pollution}</p>
      {zombie.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="活尸实践与能力边界"><summary>查看承力、寒冷与幽魂边界</summary>
        <p>继承囚犯、疯子、狼人八项原能力与掌握，只新增钢铁躯体和死亡术法两项记录。钢铁身体并非无敌或不死，精神攻击与太阳净化仍可克制；恢复不治疗污染或诅咒。</p>
        <p>本次能力实践实际执行各耗1行动、3灵性，普通方法耗1行动、0灵性；观察、准备与报告各耗1行动，撤回未执行准备与实际结束均为0行动。按钮显示当前可执行条件与实际成本。</p>
        <p>同一原窄道、负荷与原冷盘不会凭空更换。原有幽魂赫姆只自愿提供有限协助，不是复活死者、创造新幽魂，也不会给出全部真相。实际结束须放松承力、回温原盘或解除当次接触，结果与失败继续保留。</p>
        <p>{playerText("三项报告各25扮演进度，反思25，属于本作原创G的有限和平成长；不保证原著中无代价完成扮演或解除月圆诅咒。本阶段不开放序列5怨魂的虚化、穿墙、镜面跳跃或附体。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
