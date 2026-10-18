import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { CrimsonScholarAction, CrimsonScholarCommand, CrimsonScholarProjection } from "../domain/crimson-scholar/types";
import type { PotionProfessorProjection } from "../domain/potion-professor/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场", OBSERVED: "已有现场记录", PREPARED: "已有待执行的准备",
  EXAMINED: "已有实际结果", RESOLVED: "已提交有限报告",
};
const EXIT_ORDER: readonly CrimsonScholarCommand["type"][] = ["END_RITUAL", "CLOSE", "RETURN", "WITHDRAW", "CANCEL_RITUAL"];
const isCaseAction = (action: CrimsonScholarAction) => "caseId" in action.command;
const isRitualAction = (action: CrimsonScholarAction) => ["REQUEST_RITUAL", "BEGIN_RITUAL", "END_RITUAL", "CANCEL_RITUAL"].includes(action.command.type);
const isEncounterAction = (action: CrimsonScholarAction) => action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";

/** Retain original bottles and actual laboratory outcomes without offering old growth again. */
export function CrimsonScholarPotionProfessorHistory({ potionProfessor }: { potionProfessor: PotionProfessorProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="魔药教授时期的经历">
    <h3>魔药教授时期的经历</h3>
    <p className="slice-notice">你已晋升深红学者。这里保留魔药教授时期的实践、材料、辅助药和晋升原瓶，只供回看；原掌握与已耗用记录保留，不再次结算旧成长。</p>
    <p>魔药教授扮演进度 {potionProfessor.acting} · 消化：{potionProfessor.digestion}</p>
    {potionProfessor.story && <p>{potionProfessor.story}</p>}
    {potionProfessor.supplies && <p>{potionProfessor.supplies}</p>}
    {potionProfessor.environment && <p>{potionProfessor.environment}</p>}
    <section aria-label="保留的魔药教授实验室记录">
      <h4>原实验室与辅助药</h4><p>{potionProfessor.laboratory.summary}</p><p>{potionProfessor.laboratory.materials}</p>
      {potionProfessor.laboratory.potions.map((potion) => <article className="warrior-history-bottle" key={potion.id}>
        <h4>{potion.title}</h4><p className="slice-muted">辅助药原瓶ID：{potion.id}</p>
        <p>来源：{potion.source}</p><p>{potion.status}</p>
        <p className="slice-muted">配制周：{potion.brewedWeek} · {potion.usedWeek === null ? "尚未耗用" : `耗用周：${potion.usedWeek}`}</p>
      </article>)}
      {potionProfessor.laboratory.potions.length === 0 && <p className="slice-muted">没有已配制成功的辅助药原瓶记录。</p>}
      <p className="slice-muted">原短效记录：静步{potionProfessor.laboratory.effects.quietStep ? "尚未结束" : "无持续效果"}；去味{potionProfessor.laboratory.effects.odorVeil ? "尚未结束" : "无持续效果"}；身体透明{potionProfessor.laboratory.effects.bodyVeil ? "尚未结束" : "无持续效果"}；衣物透明{potionProfessor.laboratory.effects.clothVeil ? "尚未结束" : "无持续效果"}。</p>
    </section>
    {potionProfessor.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary><p>{entry.story}</p>
      <p>现场：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.observations.map((observation, index) => <p key={index}>{observation}</p>)}
      {entry.preparation && <p>{entry.preparation}</p>}{entry.result && <p>{entry.result}</p>}
    </details>)}
    {potionProfessor.bottles.length > 0 && <details className="seer-fold" open>
      <summary>魔药教授晋升原瓶 · 来源与去向</summary>
      {potionProfessor.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {potionProfessor.abilities.length > 0 && <details className="seer-fold">
      <summary>魔药教授时期能力记录</summary>
      {potionProfessor.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface CrimsonScholarPanelProps {
  crimsonScholar: CrimsonScholarProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: CrimsonScholarCommand) => void;
}

/** Render saved public facts; local selection never prepares an event, moves a body or consumes a bottle. */
export function CrimsonScholarPanel({ crimsonScholar, resources, busy, blocked = false, error = null, onCommand }: CrimsonScholarPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = crimsonScholar.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = crimsonScholar.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = crimsonScholar.actions.filter(isCaseAction);
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const activeCaseId = closeCaseId ?? (crimsonScholar.practice?.location === "END" ? "moonlight-route" : null);
  const selectedCase = (crimsonScholar.insideCase ? crimsonScholar.cases.find((entry) => entry.id === activeCaseId) : undefined)
    ?? crimsonScholar.cases.find((entry) => entry.id === selectedCaseId)
    ?? crimsonScholar.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? crimsonScholar.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const ritualActions = crimsonScholar.actions.filter(isRitualAction);
  const encounterActions = crimsonScholar.actions.filter(isEncounterAction);
  const growthActions = crimsonScholar.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isRitualAction(action) && !isEncounterAction(action));
  const nextExit = EXIT_ORDER.map((type) => crimsonScholar.actions.find((action) => action.command.type === type && action.enabled)).find(Boolean);
  const nextAction = nextExit ?? crimsonScholar.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
    ?? [...selectedCaseActions, ...ritualActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
    ?? crimsonScholar.actions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !crimsonScholar.promoted;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (crimsonScholar.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, crimsonScholar.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || crimsonScholar.promoted)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, crimsonScholar.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: CrimsonScholarAction) {
    if (busy || interactionBlocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || crimsonScholar.promoted) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id); onCommand(selectedBottleAction.command);
  }
  function actionButton(action: CrimsonScholarAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `crimsonScholar-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`crimsonScholar-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section className="seer-panel warrior-panel seer-confirmation"
    aria-label="这瓶深红学者魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); } }}>
    <div className="slice-eyebrow">真实满月下，服用前再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div><div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div><div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice" aria-label="服药前的实际仪式"><h4>本次实际仪式</h4><p>{crimsonScholar.ritual.activeVisit}</p>
      <p>本次到访至多服用一瓶。仪式材料已在到场准备时耗用；暂不服用只关闭这次确认，若要离场须实际结束本次仪式。结束不会返还材料或改变已公告满月日期。</p>
    </section>
    <section className="slice-notice seer-risk" aria-label="深红学者服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{crimsonScholar.risk}</p></section>
    <section className="seer-current-resources" aria-label="服药前当前资源"><h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div><div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{crimsonScholar.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div><div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p id="crimsonScholar-confirm-reason" className="seer-action-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "crimsonScholar-confirm-reason" : undefined}>{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会消耗这一原瓶。关闭确认不扣原瓶或行动；保存失败时保留本次确认，等待原操作的重试回执。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="深红学者成长下一步">
      <span className="seer-seal">{crimsonScholar.promoted ? "序列 5" : "深红学者晋升卷宗"}</span><h3>{crimsonScholar.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>{nextExit ? "先处理当前退出或收束：" : "下一步："}</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{crimsonScholar.digestion}</p>
      <p className="slice-muted">月亮途径：药师9 → 驯兽师8 → 吸血鬼7 → 魔药教授6 → 深红学者5。原能力、原掌握与原瓶记录继续保留。</p>
      {!crimsonScholar.promoted && <p className="slice-muted">{playerText("原创G成熟条件为魔药教授消化100与十二个完整序列6周。指导460便士；每瓶4800便士，或完成本瓶5步劳务后付600便士。每批三瓶独立取得，耗尽后可跨周补给新原瓶，旧原瓶身份与失败记录保留，逐瓶确认并按意志26四档结算。实际可用条件与费用以公开选项为准。")}</p>}
      <p className="slice-muted">{playerText("完整晋升配方仍未知，不提供未核实的材料清单、用量或配制顺序。已知晋升仪式需要真实满月照耀，以及代表月相的金属、宝石与非人幻想生物的非凡血液；本阶段采用原创G封装材料包，不涉及人血或现实取材。")}</p>
    </section>

    <section className="slice-notice" aria-label="真实满月公告与晋升仪式">
      <h3>真实满月与原露天屋顶</h3><p>{crimsonScholar.ritual.summary}</p>
      <section aria-label="已发布的真实满月日期"><h4>已公告的月相事件</h4>
        {crimsonScholar.ritual.announcements.length > 0 ? <ul>{crimsonScholar.ritual.announcements.map((announcement, index) => <li key={index}>{announcement}</li>)}</ul>
          : <p className="slice-muted">尚无已发布的真实满月公告；不能自行推算一个可用日期。</p>}
      </section>
      <p>{crimsonScholar.ritual.reservation}</p><p>{crimsonScholar.ritual.activeVisit}</p>
      <p className="slice-muted">预约1行动，只约已公告的未来事件；须在该事件周付1行动与150便士，实际到原夜间药房露天屋顶完成材料准备。每次到访至多服一瓶；服药0行动。成功、失败或不服药提前离场，都须0行动实际结束本次仪式，材料均不返还。未开始的预约可0行动取消，已公告日期保持不变。区域满月不能代替真实满月，也不能免除材料。</p>
      {ritualActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="真实满月仪式行动">{ritualActions.map(actionButton)}</div>}
      {crimsonScholar.ritual.history.length > 0 && <details className="seer-fold" open><summary>实际到访、材料与原瓶记录</summary>
        {crimsonScholar.ritual.history.map((entry, index) => <p key={index}>{entry}</p>)}
      </details>}
    </section>

    {crimsonScholar.promoted && <section className="slice-notice" aria-label="深红学者能力边界">
      <h4>有限月相、月光闪现与原身体重组</h4>
      <p>区域满月或隐藏月亮的强度依赖知识，作用于有限场域，不改变真实天体。满月也可能使场域内适用的对象受益；隐藏月亮会遮去依赖的月光，不替你消除所有痕迹或风险。本场自愿参加的成年观察者与导师始终在场域外，条件与影响须先核对。</p>
      <p>{playerText("这是月光化，不是血液化。前两项使用原创G原5米区，第三项另用原10米通路区，两标记相距6米。三项能力实施各1行动并实际耗用3、3、6灵性；普通对照或步行各1行动、0灵性，不施法。月光闪现只沿已核对的6米路线实际移动原身体。关闭场域只停止场域，身体仍留在当前地点；须按公开选项沿原路返回，不会因关窗或交报告被送回。")}</p>
      <p>{playerText("原创G月光重组仅在仍开放的满月场域内，每次1行动、8灵性，只对健康1至99的存活原身体尝试恢复最多10健康，每周至多一次尝试，失败照耗；不清除伤势、不补精神或灵性、不能复活、复制身体或返还代价。完成消化不要求制造伤势或使用重组，三项和平实践及反思即可推进消化100。不会提前取得序列4的蝙蝠形态或月亮纸人。")}</p>
    </section>}
    {crimsonScholar.promoted && crimsonScholar.environment && <section aria-label="当前深红学者现场"><h4>当前现场</h4><p>{crimsonScholar.environment}</p></section>}
    {crimsonScholar.practice && <section className="slice-notice" aria-label="已保存的场域与身体位置">
      <h4>场域与原身体的实际位置</h4>
      <dl className="seer-facts">
        <div><dt>当前场域</dt><dd>{{ NONE: "无持续场域", FULL: "区域满月仍在持续", HIDDEN: "区域隐藏月亮仍在持续" }[crimsonScholar.practice.field]}</dd></div>
        <div><dt>原身体位置</dt><dd>{crimsonScholar.practice.location === "START" ? "原路线起点" : "6米路线终点，尚未原路返回"}</dd></div>
        <div><dt>实际外出</dt><dd>{crimsonScholar.practice.outboundTrips} 次</dd></div><div><dt>原路返回</dt><dd>{crimsonScholar.practice.returns} 次</dd></div>
        <div><dt>重组尝试</dt><dd>{crimsonScholar.practice.reassemblies} 次</dd></div><div><dt>最近重组尝试周</dt><dd>{crimsonScholar.practice.reassembledWeek ?? "尚未重组"}</dd></div>
      </dl>
    </section>}
    {selectedCase && <section aria-label="深红学者有限实践"><h3>满月、隐藏月亮与原路线</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || crimsonScholar.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {crimsonScholar.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前深红学者实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p><p className="slice-muted">现场：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="公开观察与影响"><h4>公开观察与影响</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次核对记录。场域条件、路线与参与者意愿以实际观察为准。</p>}
        </section>
        <section aria-label="本次实践准备"><h4>本次准备</h4><p>{selectedCase.preparation || "当前没有待执行的准备；选择准备不会提前开启场域、移动身体或取得结果。"}</p></section>
        {selectedCase.result && <section aria-label="月相与移动的实际结果" aria-live="polite" aria-atomic="true"><h4>实际结果</h4><p>{selectedCase.result}</p></section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前深红学者实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">撤回只撤销待执行准备；实际关闭场域、退离现场与原路返回各按公开行动完成。关闭和返回均为0行动、0精神、0灵性，不治疗、不退款、不抹去失败；即使资源不足也不必另付退出费用。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="深红学者成长与原路返回">{growthActions.map(actionButton)}</div>}
    {crimsonScholar.story && <p className="slice-muted">{crimsonScholar.story}</p>}
    {encounterActions.length > 0 && <section aria-label="深红学者有限冲突"><h3>有限冲突</h3>
      <p className="slice-muted">先完成公开的关闭、原路返回或仪式离场，再决定是否交涉或承担战斗风险。月光重组不能复活战死者，选择战斗不会提前取得胜利。</p>
      <div className="warrior-action-list" role="group" aria-label="深红学者冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {crimsonScholar.discovered && crimsonScholar.supplies && <section className="slice-notice" aria-label="深红学者成品原瓶供给"><h4>成品原瓶与实际供给</h4><p>{crimsonScholar.supplies}</p></section>}
    {crimsonScholar.discovered && crimsonScholar.bottles.length > 0 && <details className="seer-fold" open={!crimsonScholar.promoted}>
      <summary>深红学者独立成品原瓶 · 来源与去向</summary>
      {crimsonScholar.bottles.map((bottle) => {
        const action = crimsonScholar.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !crimsonScholar.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !crimsonScholar.promoted && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `crimsonScholar-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>{action.reason && <p className="seer-action-reason" id={`crimsonScholar-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {crimsonScholar.discovered && !crimsonScholar.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{crimsonScholar.risk}</p></details>}
    {crimsonScholar.promoted && <section aria-label="深红学者能力与消化"><h3>能力与消化 · {crimsonScholar.abilities.length} 项训练记录</h3>
      <p>扮演进度 {crimsonScholar.acting} · 消化：{crimsonScholar.digestion}</p><p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {crimsonScholar.pollution}</p>
      {crimsonScholar.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
