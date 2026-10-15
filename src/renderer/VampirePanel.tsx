import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { VampireAction, VampireCommand, VampireProjection } from "../domain/vampire/types";
import type { TamerProjection } from "../domain/tamer/types";
import type { ApothecaryCommand, ApothecaryProjection } from "../domain/apothecary/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

interface VampirePanelProps {
  vampire: VampireProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: VampireCommand) => void;
}

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未检查", EXAMINED: "已检查", RESOLVED: "已完成本次处置",
};

/** Prior-sequence care and bottle records remain readable without offering old growth actions. */
export function VampireApothecaryHistory({ apothecary, busy, blocked, onCommand }: {
  apothecary: ApothecaryProjection; busy: boolean; blocked: boolean;
  onCommand: (command: ApothecaryCommand) => void;
}) {
  const inheritedActions = apothecary.actions.filter((action) => action.command.type === "BUY_SUPPLIES"
    || action.command.type === "PREPARE_MEDICINE" || action.command.type === "USE_HEALING");
  return (
    <section className="seer-panel apothecary-panel" aria-label="药师时期的经历">
      <h3>药师时期的经历</h3>
      <p className="slice-notice">你已晋升吸血鬼。药师时期的接诊与原瓶仍可查阅，已继承的药物能力按当前条件继续使用；新的实践请回到吸血鬼卷宗。</p>
      <p>药师扮演进度 {apothecary.acting} · {apothecary.digestion}</p>
      <section className="seer-fold" aria-label="保留的药铺耗材">
        <h4>药铺实际耗材</h4>
        <dl className="seer-facts">
          <div><dt>可用游戏材料</dt><dd>{apothecary.clinic.materials}</dd></div>
          <div><dt>外伤护理剂</dt><dd>{apothecary.clinic.healing}</dd></div>
          <div><dt>安神剂</dt><dd>{apothecary.clinic.calming}</dd></div>
          <div><dt>已耗用/废弃份数</dt><dd>{apothecary.clinic.spent}</dd></div>
        </dl>
        <p className="slice-muted">这些药剂与材料仅为虚构游戏道具，不是现实药方或医疗建议。</p>
        {inheritedActions.length > 0 && <div className="seer-actions" role="group" aria-label="继承的药师行动">
          {inheritedActions.map((action) => <div className="seer-action" key={action.id}>
            <button className="slice-choice" disabled={busy || blocked || !action.enabled}
              onClick={() => onCommand(action.command)}
              aria-describedby={action.reason ? `inherited-apothecary-${action.id}` : undefined}>
              <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
            </button>
            {action.reason && <p className="seer-action-reason" id={`inherited-apothecary-${action.id}`}>{action.reason}</p>}
          </div>)}
        </div>}
      </section>
      {apothecary.cases.length > 0 && <section aria-label="药师接诊历史">
        {apothecary.cases.map((patient) => <details className="seer-fold" key={patient.id}>
          <summary>{patient.title} · {CASE_STATUS[patient.status] ?? patient.status}</summary>
          <p>{patient.story}</p>
          {patient.health !== null && <p>病人健康：{patient.health}</p>}
          {patient.mind !== null && <p>病人精神：{patient.mind}</p>}
          {patient.observations.length > 0 && <ul>{patient.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
          {patient.result && <p>{patient.result}</p>}
        </details>)}
      </section>}
      {apothecary.bottles.length > 0 && <details className="seer-fold">
        <summary>药师原瓶 · 来源与去向</summary>
        {apothecary.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
          <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        </article>)}
      </details>}
      {apothecary.abilities.length > 0 && <details className="seer-fold">
        <summary>已继承的药师能力</summary>
        {apothecary.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
      </details>}
    </section>
  );
}

const ANIMAL_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察", OBSERVED: "已取得观察记录", TRAINED: "已完成本次训练", ASSISTED: "已完成本次协助",
};

/** Earlier observations and bottle outcomes are records, never a new animal companion. */
export function TamerHistory({ tamer }: { tamer: TamerProjection }) {
  return <section className="seer-panel" aria-label="驯兽师时期的经历">
    <h3>驯兽师时期的经历</h3>
    <p className="slice-notice">这里保留驯兽师时期的观察、训练与原瓶记录。动物仍归原主人，这些经历不会生成新的同行动物；当前实践请回到吸血鬼卷宗。</p>
    <p>驯兽师扮演进度 {tamer.acting} · {tamer.digestion}</p>
    {tamer.animals.length > 0 && <section aria-label="驯兽师动物记录">
      {tamer.animals.map((animal) => <details className="seer-fold" key={animal.id}>
        <summary>{animal.title} · {ANIMAL_STATUS[animal.status] ?? animal.status}</summary>
        <p>{animal.story}</p>
        {animal.observations.length > 0 && <ul>{animal.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
        {animal.intent && <p>{animal.intent}</p>}
        <p>原动物位置：{animal.location}</p><p>保留饲料：{animal.foodHeld}</p>
      </details>)}
    </section>}
    {tamer.bottles.length > 0 && <details className="seer-fold">
      <summary>驯兽师原瓶 · 来源与去向</summary>
      {tamer.bottles.map((bottle) => <article className="vampire-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {tamer.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的驯兽师能力</summary>
      {tamer.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

const ENCOUNTER_COMMANDS = ["OBSERVE_ENCOUNTER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"];

/** All costs, environmental facts, availability and results come from the committed projection. */
export function VampirePanel({ vampire, resources, busy, blocked, onCommand }: VampirePanelProps) {
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = vampire.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = vampire.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const practiceActions = vampire.actions.filter((action) => action.command.type === "PRACTICE");
  const sceneActions = vampire.actions.filter((action) => ENCOUNTER_COMMANDS.includes(action.command.type));
  const sceneHasRecord = vampire.practices.some((practice) => practice.id === "vampire-dispute");
  const actionsForPractice = (id: string) => id === "vampire-dispute" ? sceneActions
    : practiceActions.filter((action) => action.command.type === "PRACTICE" && action.command.practiceId === id);
  const selectedPractice = vampire.practices.find((practice) => practice.id === selectedPracticeId)
    ?? vampire.practices.find((practice) => actionsForPractice(practice.id).some((action) => action.enabled))
    ?? vampire.practices[0];
  const selectedPracticeActions = selectedPractice ? actionsForPractice(selectedPractice.id) : [];
  const remainingActions = vampire.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "PRACTICE" && !ENCOUNTER_COMMANDS.includes(action.command.type));
  const nextAction = vampire.promoted
    ? selectedPracticeActions.find((action) => action.enabled) ?? remainingActions.find((action) => action.enabled)
      ?? selectedPracticeActions[0] ?? remainingActions[0]
    : vampire.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? remainingActions.find((action) => action.enabled) ?? remainingActions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !vampire.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || vampire.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, vampire.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: VampireAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || vampire.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }
  function actionButton(action: VampireAction) {
    return <div className="seer-action vampire-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || blocked || !action.enabled}
        onClick={() => onCommand(action.command)} aria-describedby={action.reason ? `vampire-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`vampire-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }

  if (confirming && selectedBottle && selectedAction) return (
    <section className="seer-panel vampire-panel seer-confirmation" aria-label="这瓶吸血鬼魔药的服用确认" aria-busy={busy}>
      <div className="slice-eyebrow">服用前，请再确认一次</div>
      <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
      <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
      <dl className="seer-facts">
        <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
        <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
        <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
        <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
      </dl>
      <section className="slice-notice seer-risk" aria-label="吸血鬼服用风险与四档结果">
        <strong>服用风险与四档结果</strong><p>{vampire.risk}</p>
      </section>
      <section aria-label="服药前当前资源" className="seer-current-resources">
        <h4>你现在的状态</h4>
        <dl className="seer-facts">
          <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
          <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
          <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
          <div><dt>污染</dt><dd>{vampire.pollution}</dd></div>
          <div><dt>现金</dt><dd>{resources.cash}</dd></div>
          <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
        </dl>
      </section>
      {selectedAction.reason && <p className="seer-action-reason" id="vampire-confirm-reason">{selectedAction.reason}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
        <button className="slice-button" disabled={confirmationLocked || !selectedAction.enabled} onClick={confirmBottle}
          aria-describedby={selectedAction.reason ? "vampire-confirm-reason" : undefined}>
          {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
        </button>
      </div>
      <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
    </section>
  );

  const bottleRecords = vampire.bottles.map((bottle) => {
    const action = !vampire.promoted ? vampire.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id) : undefined;
    return <article className="seer-bottle" key={bottle.id}>
      <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
      {action && <div>
        <button className="slice-button" disabled={busy || blocked || !action.enabled}
          ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
          onClick={() => openBottle(action)} aria-describedby={action.reason ? `vampire-bottle-${bottle.id}` : undefined}>
          查看并准备服用「{bottle.title}」
        </button>
        <p className="seer-small-note">{action.cost}</p>
        {action.reason && <p className="seer-action-reason" id={`vampire-bottle-${bottle.id}`}>{action.reason}</p>}
      </div>}
    </article>;
  });

  return <div className="seer-panel vampire-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="吸血鬼成长下一步">
      <span className="seer-seal">{vampire.promoted ? "序列 7" : "吸血鬼晋升准备"}</span>
      <h3>{vampire.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{vampire.promoted ? `扮演进度 ${vampire.acting} · ${vampire.digestion}` : vampire.digestion}</p>
    </section>

    {vampire.promoted && selectedPractice && <section aria-label="吸血鬼实践">
      <label className="seer-case-selector">选择一次实践
        <select value={selectedPractice.id} disabled={busy || blocked} onChange={(event) => setSelectedPracticeId(event.target.value)}>
          {vampire.practices.map((practice) => <option key={practice.id} value={practice.id}>{practice.title} · {practice.status}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前吸血鬼实践">
        <h3>{selectedPractice.title}</h3><p className="slice-muted">{selectedPractice.status}</p><p>{selectedPractice.story}</p>
        {selectedPractice.id === "vampire-dispute" && vampire.environment && <section className="slice-notice" aria-label="当前吸血鬼现场环境">
          <h4>现场与光照</h4><p>{vampire.environment}</p>
        </section>}
        <div className="vampire-action-list" role="group" aria-label="当前实践行动">{selectedPracticeActions.map(actionButton)}</div>
      </section>
    </section>}
    {vampire.promoted && !sceneHasRecord && (vampire.environment || sceneActions.length > 0) && <section aria-label="当前吸血鬼现场环境">
      <h4>现场与光照</h4>{vampire.environment && <p>{vampire.environment}</p>}
      <div className="vampire-action-list" role="group" aria-label="吸血鬼现场行动">{sceneActions.map(actionButton)}</div>
    </section>}
    {vampire.promoted && <section className="vampire-diet" aria-label="实际血食与身体状态">
      <h4>血食与身体照护</h4>
      <p>{vampire.bloodSummary}</p>
      <p className="slice-muted">{playerText("本阶段使用游戏设定（G）的自愿成年来源密封血食。购入与饮用分别结算，以每个行动显示的实际成本为准；不会自动捕食他人。")}</p>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{vampire.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>}
    {vampire.promoted && <details className="seer-fold">
      <summary>查看身体、血食与消化边界</summary>
      <p>你由人类服用魔药晋升，仍须完成实际扮演与消化，不适用天生血族的例外。</p>
      <p>本阶段再生只恢复有限身体创伤，不能复活，也不意味着能无视阳光或消除全部伤势。具体可用条件与恢复结果由当前记录给出。</p>
      <p>这里的密封血食与练习均为虚构游戏内容，不提供现实采集方法。供给与耗用保留实际记录，不把旁人或动物当作自动血源。</p>
    </details>}
    {remainingActions.length > 0 && <section aria-label={vampire.promoted ? "吸血鬼成长行动" : "吸血鬼成品药渠道"}>
      {!vampire.promoted && <h4>成品药与准备</h4>}
      <div className="seer-actions">{remainingActions.map(actionButton)}</div>
    </section>}
    {vampire.story && <p className="slice-muted">{vampire.story}</p>}
    {vampire.discovered && !vampire.promoted && <section aria-label="吸血鬼供货说明">
      {vampire.supplies && <p className="slice-notice">{vampire.supplies}</p>}
      <p className="slice-muted">{playerText("取得原瓶与确认服用是两个独立步骤。完整配方尚未核实，本阶段使用游戏设定（G）的有限成品药渠道；已知主材线索不等于可调配的完整配方。")}</p>
    </section>}
    {vampire.discovered && vampire.bottles.length > 0 && (vampire.promoted
      ? <details className="seer-fold"><summary>吸血鬼原瓶 · 来源与去向</summary>{bottleRecords}</details>
      : <section className="seer-bottles" aria-label="吸血鬼独立原瓶"><h3>吸血鬼独立原瓶</h3>{bottleRecords}</section>)}
    {vampire.discovered && !vampire.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{vampire.risk}</p></details>}
    {vampire.promoted && <details className="seer-fold" aria-label="吸血鬼能力与消化">
      <summary>能力与消化 · {vampire.abilities.length} 项能力</summary>
      <p>灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {vampire.pollution}</p>
      {vampire.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </details>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
  </div>;
}
