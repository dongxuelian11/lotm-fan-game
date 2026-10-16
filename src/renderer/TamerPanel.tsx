import { useEffect, useRef, useState } from "react";
import type { TamerAction, TamerCommand, TamerProjection } from "../domain/tamer/types";
import type { ApothecaryCommand, ApothecaryProjection } from "../domain/apothecary/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const ANIMAL_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察",
  OBSERVED: "已取得观察记录",
  TRAINED: "已完成本次训练",
  ASSISTED: "已完成本次协助",
};
const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未检查", EXAMINED: "已检查", RESOLVED: "已完成本次处置",
};

interface TamerPanelProps {
  tamer: TamerProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: TamerCommand) => void;
}

/** Prior-sequence care and bottle records remain readable without offering old growth actions. */
export function ApothecaryHistory({ apothecary, busy, blocked, onCommand }: {
  apothecary: ApothecaryProjection; busy: boolean; blocked: boolean;
  onCommand: (command: ApothecaryCommand) => void;
}) {
  const inheritedActions = apothecary.actions.filter((action) => action.command.type === "BUY_SUPPLIES"
    || action.command.type === "PREPARE_MEDICINE" || action.command.type === "USE_HEALING");
  return (
    <section className="seer-panel apothecary-panel" aria-label="药师时期的经历">
      <h3>药师时期的经历</h3>
      <p className="slice-notice">你已晋升驯兽师。药师时期的接诊与原瓶仍可查阅，已经掌握的药物能力可继续使用；动物实践请回到驯兽师卷宗。</p>
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

/** Show only observed animal facts; original ownership and the limited visit never become a pet inventory. */
export function TamerPanel({ tamer, resources, busy, blocked, onCommand }: TamerPanelProps) {
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = tamer.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = tamer.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const animalActions = tamer.actions.filter((action) => "animalId" in action.command);
  const selectedAnimal = tamer.animals.find((animal) => animal.id === selectedAnimalId)
    ?? tamer.animals.find((animal) => animalActions.some((action) => action.command.type === "ASSIST" && action.command.animalId === animal.id))
    ?? tamer.animals.find((animal) => animalActions.some((action) => "animalId" in action.command && action.command.animalId === animal.id && action.enabled))
    ?? tamer.animals[0];
  const selectedAnimalActions = animalActions.filter((action) => "animalId" in action.command
    && action.command.animalId === selectedAnimal?.id);
  const returnAction = tamer.actions.find((action) => action.command.type === "RETURN_ANIMAL");
  const actions = tamer.actions.filter((action) => action.command.type !== "CONSUME"
    && action.command.type !== "RETURN_ANIMAL" && !("animalId" in action.command));
  const nextAction = tamer.promoted
    ? selectedAnimalActions.find((action) => action.enabled) ?? (tamer.companionName ? returnAction : undefined) ?? actions.find((action) => action.enabled) ?? selectedAnimalActions[0] ?? actions[0]
    : tamer.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !tamer.promoted;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || tamer.promoted)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, tamer.promoted]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: TamerAction) {
    if (busy || blocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || tamer.promoted) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: TamerAction) {
    return (
      <div className="seer-action" key={action.id}>
        <button
          className="slice-choice"
          disabled={busy || blocked || !action.enabled}
          onClick={() => onCommand(action.command)}
          aria-describedby={action.reason ? `tamer-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`tamer-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel tamer-panel seer-confirmation" aria-label="这瓶驯兽师魔药的服用确认" aria-busy={busy}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="驯兽师服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{tamer.risk}</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{tamer.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="tamer-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "tamer-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel tamer-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="驯兽师成长下一步">
        <span className="seer-seal">{tamer.promoted ? "序列 8" : "驯兽师成长卷宗"}</span>
        <h3>{tamer.title}</h3>
        {nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{tamer.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{tamer.digestion}</p>
        {!tamer.promoted && <p className="slice-muted">准备期间仍可工作、调查或休养，也可继续回看药师时期的经历。</p>}
      </section>

      {tamer.promoted && tamer.companionName && (
        <section className="slice-notice" aria-label="本次有限同行">
          <h3>本次同行：{tamer.companionName}</h3>
          <p>同行只限这次活动，动物仍归原主人。安排它返回后，才能继续其他生活与调查；返回不消耗行动。</p>
          {returnAction && <div className="seer-actions" role="group" aria-label="结束本次同行">{actionButton(returnAction)}</div>}
        </section>
      )}

      {tamer.promoted && selectedAnimal && (
        <section aria-label="驯兽师动物记录">
          <h3>观察、训练与协助</h3>
          <p className="slice-muted">与真实动物逐步相处。动物可以拒绝训练，所有权仍归原主人；本卷宗的同行与协助仅限已约定的活动。</p>
          <label className="seer-case-selector">
            选择动物记录
            <select value={selectedAnimal.id} disabled={busy || blocked} onChange={(event) => setSelectedAnimalId(event.target.value)}>
              {tamer.animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.title}</option>)}
            </select>
          </label>
          <section className="seer-current-case" aria-label="当前动物记录">
            <h4>{selectedAnimal.title}</h4>
            <p>{selectedAnimal.story}</p>
            <dl className="seer-facts">
              <div><dt>当前进展</dt><dd>{ANIMAL_STATUS[selectedAnimal.status] ?? selectedAnimal.status}</dd></div>
              <div><dt>实际位置</dt><dd>{selectedAnimal.location}</dd></div>
              <div><dt>持有的对应饲料</dt><dd>{selectedAnimal.foodHeld} 份</dd></div>
            </dl>
            <section className="seer-fold" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedAnimal.observations.length > 0
                ? <ul>{selectedAnimal.observations.map((observation, index) => <li key={`${selectedAnimal.id}-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未取得观察记录，不能判断它此刻的意图。</p>}
            </section>
            {selectedAnimal.intent !== null && (
              <section className="seer-fold" aria-label="已经观察到的动物意图">
                <h4>已经观察到的动物意图</h4>
                <p>{selectedAnimal.intent}</p>
              </section>
            )}
            <p className="slice-muted">训练会消耗这只动物对应的已购饲料。只阅读记录或切换动物不消耗行动。</p>
            {selectedAnimalActions.length > 0 && (
              <div className="seer-actions seer-reflection" role="group" aria-label="当前动物的互动行动">{selectedAnimalActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {actions.length > 0 && (
        <div className="seer-actions" role="group" aria-label="驯兽师成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {tamer.story && <p className="slice-muted">{tamer.story}</p>}

      {tamer.discovered && tamer.supplies && <p className="slice-notice">{tamer.supplies}</p>}
      {tamer.discovered && tamer.bottles.length > 0 && (
        <details className="seer-fold tamer-bottles" open={!tamer.promoted}>
          <summary>驯兽师独立成品原瓶 · 来源与去向</summary>
          {tamer.bottles.map((bottle) => {
            const action = tamer.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !tamer.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !tamer.promoted && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `tamer-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`tamer-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {tamer.discovered && !tamer.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{tamer.risk}</p></details>}
      {tamer.promoted && (
        <section className="tamer-abilities" aria-label="驯兽师能力与消化">
          <h3>能力与消化 · {tamer.abilities.length} 项能力</h3>
          <p>扮演进度 {tamer.acting} · 消化：{tamer.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {tamer.pollution}</p>
          {tamer.abilities.map((ability) => (
            <details className="seer-fold" key={ability.id}>
              <summary>{ability.label} · 掌握 {ability.mastery}</summary>
              <p>{ability.description}</p>
            </details>
          ))}
        </section>
      )}
      {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    </div>
  );
}
