import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PsychologistAction, PsychologistCommand, PsychologistProjection } from "../domain/psychologist/types";
import type { AudienceProjection } from "../domain/audience/types";
import type { MindreaderProjection } from "../domain/mindreader/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

interface PsychologistPanelProps {
  psychologist: PsychologistProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: PsychologistCommand) => void;
}

/** Earlier observations, shallow readings and original bottles remain read-only. */
function AudiencePathwayRecords({ pathway, name }: { pathway: AudienceProjection | MindreaderProjection; name: string }) {
  return <>
    {pathway.scenes.length > 0 && <section aria-label={`${name}社会情境历史`}>
      {pathway.scenes.map((scene) => <details className="seer-fold" key={scene.id}>
        <summary>{scene.title} · {scene.status}</summary>
        <p>{scene.story}</p>
        {scene.observations.length > 0 && <ul>{scene.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
        {"interpretation" in scene && scene.interpretation && <p>当时的解读：{scene.interpretation}</p>}
        {"impression" in scene && scene.impression && <p>当时读取的浅层印象：{scene.impression}</p>}
        {"dialogue" in scene && scene.dialogue && <p>交谈与核实记录：{scene.dialogue}</p>}
      </details>)}
    </section>}
    {pathway.formulaKnown && pathway.formula.length > 0 && <details className="seer-fold">
      <summary>已学过的{name}配方</summary>
      <ul className="seer-formula">{pathway.formula.map((material) => <li key={material.name}><span>{material.name}</span><strong>{material.quantity} {material.unit}</strong></li>)}</ul>
    </details>}
    {pathway.bottles.length > 0 && <details className="seer-fold">
      <summary>{name}原瓶 · 来源与去向</summary>
      {pathway.bottles.map((bottle) => <article className="psychologist-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {pathway.abilities.length > 0 && <details className="seer-fold">
      <summary>已继承的{name}能力</summary>
      {pathway.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </>;
}

export function PsychologistAudienceHistory({ audience }: { audience: AudienceProjection }) {
  return <section className="seer-panel" aria-label="观众时期的经历">
    <h3>观众时期的经历</h3>
    <p className="slice-notice">这里保留观众时期的观察、解读和原瓶记录。当前实践请回到心理医生卷宗。</p>
    <p>观众扮演进度 {audience.acting} · {audience.digestion}</p>
    <p>交往信任：{audience.trust}</p>
    <AudiencePathwayRecords pathway={audience} name="观众" />
  </section>;
}

export function MindreaderHistory({ mindreader }: { mindreader: MindreaderProjection }) {
  return <section className="seer-panel" aria-label="读心者时期的经历">
    <h3>读心者时期的经历</h3>
    <p className="slice-notice">这里保留读心者时期的亲见线索、浅层读取、实际交谈和原瓶记录。当前实践请回到心理医生卷宗。</p>
    <p>读心者扮演进度 {mindreader.acting} · {mindreader.digestion}</p>
    <AudiencePathwayRecords pathway={mindreader} name="读心者" />
  </section>;
}

const ENCOUNTER_COMMANDS = ["OBSERVE_ENCOUNTER", "ENCOUNTER_TALK", "ENCOUNTER_FIGHT"];

/** All costs, environmental facts, availability and results come from the committed projection. */
export function PsychologistPanel({ psychologist, resources, busy, blocked, onCommand }: PsychologistPanelProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = psychologist.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = psychologist.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = psychologist.actions.filter((action) => "caseId" in action.command);
  const encounterActions = psychologist.actions.filter((action) => ENCOUNTER_COMMANDS.includes(action.command.type));
  const encounterHasScene = psychologist.scenes.some((scene) => scene.id === "psychologist-dispute");
  const actionsForScene = (id: string) => id === "psychologist-dispute" ? encounterActions
    : caseActions.filter((action) => "caseId" in action.command && action.command.caseId === id);
  const selectedScene = psychologist.scenes.find((scene) => scene.id === selectedSceneId)
    ?? psychologist.scenes.find((scene) => actionsForScene(scene.id).some((action) => action.enabled))
    ?? psychologist.scenes[0];
  const selectedSceneActions = selectedScene ? actionsForScene(selectedScene.id) : [];
  const remainingActions = psychologist.actions.filter((action) => action.command.type !== "CONSUME"
    && !("caseId" in action.command) && !ENCOUNTER_COMMANDS.includes(action.command.type));
  const nextAction = psychologist.promoted
    ? selectedSceneActions.find((action) => action.enabled) ?? remainingActions.find((action) => action.enabled)
      ?? selectedSceneActions[0] ?? remainingActions[0]
    : psychologist.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? remainingActions.find((action) => action.enabled) ?? remainingActions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !psychologist.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || psychologist.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, psychologist.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: PsychologistAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || psychologist.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }
  function actionButton(action: PsychologistAction) {
    return <div className="seer-action psychologist-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || blocked || !action.enabled}
        onClick={() => onCommand(action.command)} aria-describedby={action.reason ? `psychologist-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`psychologist-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }

  if (confirming && selectedBottle && selectedAction) return (
    <section className="seer-panel psychologist-panel seer-confirmation" aria-label="这瓶心理医生魔药的服用确认" aria-busy={busy}>
      <div className="slice-eyebrow">服用前，请再确认一次</div>
      <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
      <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
      <dl className="seer-facts">
        <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
        <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
        <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
        <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
      </dl>
      <section className="slice-notice seer-risk" aria-label="心理医生服用风险与四档结果">
        <strong>服用风险与四档结果</strong><p>{psychologist.risk}</p>
      </section>
      <section aria-label="服药前当前资源" className="seer-current-resources">
        <h4>你现在的状态</h4>
        <dl className="seer-facts">
          <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
          <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
          <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
          <div><dt>污染</dt><dd>{psychologist.pollution}</dd></div>
          <div><dt>现金</dt><dd>{resources.cash}</dd></div>
          <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
        </dl>
      </section>
      {selectedAction.reason && <p className="seer-action-reason" id="psychologist-confirm-reason">{selectedAction.reason}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
        <button className="slice-button" disabled={confirmationLocked || !selectedAction.enabled} onClick={confirmBottle}
          aria-describedby={selectedAction.reason ? "psychologist-confirm-reason" : undefined}>
          {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
        </button>
      </div>
      <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
    </section>
  );

  const bottleRecords = psychologist.bottles.map((bottle) => {
    const action = !psychologist.promoted ? psychologist.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id) : undefined;
    return <article className="seer-bottle" key={bottle.id}>
      <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
      {action && <div>
        <button className="slice-button" disabled={busy || blocked || !action.enabled}
          ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
          onClick={() => openBottle(action)} aria-describedby={action.reason ? `psychologist-bottle-${bottle.id}` : undefined}>
          查看并准备服用「{bottle.title}」
        </button>
        <p className="seer-small-note">{action.cost}</p>
        {action.reason && <p className="seer-action-reason" id={`psychologist-bottle-${bottle.id}`}>{action.reason}</p>}
      </div>}
    </article>;
  });

  return <div className="seer-panel psychologist-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="心理医生成长下一步">
      <span className="seer-seal">{psychologist.promoted ? "序列 7" : "心理医生晋升准备"}</span>
      <h3>{psychologist.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</> : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{psychologist.promoted ? `扮演进度 ${psychologist.acting} · ${psychologist.digestion}` : psychologist.digestion}</p>
    </section>

    {psychologist.promoted && selectedScene && <section aria-label="心理医生社会情境">
      <label className="seer-case-selector">选择社会情境
        <select value={selectedScene.id} disabled={busy || blocked} onChange={(event) => setSelectedSceneId(event.target.value)}>
          {psychologist.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {scene.status}</option>)}
        </select>
      </label>
      <section className="seer-current-case" aria-label="当前心理医生情境">
        <h3>{selectedScene.title}</h3><p className="slice-muted">{selectedScene.status}</p><p>{selectedScene.story}</p>
        {selectedScene.id !== "psychologist-dispute" && <p className={`slice-notice psychologist-consent${selectedScene.consent ? "" : " withdrawn"}`} role="status">
          {selectedScene.consent ? "当事人已同意本次支持；可以选择结束会谈。" : "当事人未同意或已退出本次支持。以当前公开的可用行动为准。"}
        </p>}
        <section className="seer-fold" aria-label="亲眼观察到的线索">
          <h4>亲眼观察到的线索</h4>
          {selectedScene.observations.length > 0
            ? <ul>{selectedScene.observations.map((observation, index) => <li key={`${selectedScene.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚未留下可用的观察记录。</p>}
        </section>
        <section className="seer-fold" aria-label="本次浅层印象">
          <h4>本次浅层印象</h4>
          {selectedScene.impression ? <p>{selectedScene.impression}</p> : <p className="slice-muted">尚无已公开的浅层读取记录。</p>}
        </section>
        {selectedScene.id === "psychologist-dispute" && psychologist.environment && <section className="slice-notice" aria-label="当前心理医生现场环境">
          <h4>现场与交涉</h4><p>{psychologist.environment}</p>
        </section>}
        <div className="psychologist-action-list" role="group" aria-label="当前情境的处理方式">{selectedSceneActions.map(actionButton)}</div>
      </section>
    </section>}
    {psychologist.promoted && !encounterHasScene && (psychologist.environment || encounterActions.length > 0) && <details className="seer-fold">
      <summary>查看现场与可选争端</summary>
      <section aria-label="当前心理医生现场环境">
        <h4>现场与交涉</h4>{psychologist.environment && <p>{psychologist.environment}</p>}
        <div className="psychologist-action-list" role="group" aria-label="心理医生现场行动">{encounterActions.map(actionButton)}</div>
      </section>
    </details>}
    {psychologist.promoted && <details className="seer-fold">
      <summary>查看会谈边界与战斗风险</summary>
      <p>这些是原创游戏中的成年当事人与有限情境。支持以本人同意为前提，可以退出；暂时平静不表示临床治愈，也不表示污染被净化。</p>
      <p>观察、浅层印象和实际交谈各自保留。没有公开读取记录时，不推测隐私、深层记忆或完整真相。</p>
      <p>争端可以交涉。精神攻击不会自动造成肉体死亡；真实的拳脚、武器打击仍会造成伤势或死亡。</p>
    </details>}
    {remainingActions.length > 0 && <section aria-label={psychologist.promoted ? "心理医生成长行动" : "心理医生成品药渠道"}>
      {!psychologist.promoted && <h4>成品药与准备</h4>}
      <div className="seer-actions">{remainingActions.map(actionButton)}</div>
    </section>}
    {psychologist.discovered && !psychologist.promoted && <section aria-label="心理医生供货说明">
      {psychologist.supplies && <p className="slice-notice">{psychologist.supplies}</p>}
      <p className="slice-muted">{playerText("完整配方尚未核实。本阶段使用明确标记为游戏设定（G）的有限成品药渠道；取得原瓶与确认服用是两个独立步骤。")}</p>
    </section>}
    {psychologist.discovered && psychologist.bottles.length > 0 && (psychologist.promoted
      ? <details className="seer-fold"><summary>心理医生原瓶 · 来源与去向</summary>{bottleRecords}</details>
      : <section className="seer-bottles" aria-label="心理医生独立原瓶"><h3>心理医生独立原瓶</h3>{bottleRecords}</section>)}
    {psychologist.discovered && !psychologist.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{psychologist.risk}</p></details>}
    {psychologist.promoted && <details className="seer-fold" aria-label="心理医生能力与消化">
      <summary>能力与消化 · {psychologist.abilities.length} 项能力</summary>
      <p>灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {psychologist.pollution}</p>
      {psychologist.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </details>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
  </div>;
}
