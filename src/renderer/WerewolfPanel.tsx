import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WerewolfAction, WerewolfCommand, WerewolfProjection } from "../domain/werewolf/types";
import type { MadmanProjection } from "../domain/madman/types";
import type { PrisonerProjection } from "../domain/prisoner/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察", OBSERVED: "已观察现场与能力边界", PREPARED: "已选定方法并完成准备",
  EXAMINED: "已实际执行，请核对现场与返回记录", RESOLVED: "已提交本次实践报告",
};

/** Other-pathway history has no mutation callback or actionable controls. */
export function WerewolfMadmanHistory({ madman }: { madman: MadmanProjection }) {
  const title = "疯子时期的经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">这里保留疯子时期的渠道、原瓶与实践记录，只供回看；狼人继承原能力与自主短暂强化选择，不重置原掌握度。</p>
    <p>疯子扮演进度 {madman.acting} · 消化：{madman.digestion}</p>
    {madman.story && <p>{madman.story}</p>}
    {madman.supplies && <p>{madman.supplies}</p>}
    {madman.environment && <p>{madman.environment}</p>}
    {madman.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">当前尝试：{entry.burstOpen} · 实际停止次数：{entry.stops} · 实际强化次数：{entry.burstUses}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {madman.bottles.length > 0 && <details className="seer-fold" open>
      <summary>疯子原瓶 · 来源与去向</summary>
      {madman.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {madman.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {madman.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

/** Other-pathway history has no mutation callback or actionable controls. */
export function WerewolfPrisonerHistory({ prisoner }: { prisoner: PrisonerProjection }) {
  const title = "囚犯时期的经历";
  return <section className="seer-panel warrior-panel" aria-label={title}>
    <h3>{title}</h3>
    <p className="slice-notice">你已晋升狼人。这里保留囚犯时期的观察、准备、原木垫块借还、实际结果与原瓶来源，只供回看。</p>
    <p>囚犯扮演进度 {prisoner.acting} · 消化：{prisoner.digestion}</p>
    {prisoner.story && <p>{prisoner.story}</p>}
    {prisoner.supplies && <p>{prisoner.supplies}</p>}
    {prisoner.environment && <p>{prisoner.environment}</p>}
    {prisoner.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {entry.status === "EXAMINED" ? "已实际执行，请核对原物与结果" : CASE_STATUS[entry.status] ?? "状态待核实"}</summary>
      <p>{entry.story}</p><p className="slice-muted">原物去向：{entry.holding} · 实际归还次数：{entry.returns}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      {entry.preparation && <p>{entry.preparation}</p>}
      {entry.result && <p>{entry.result}</p>}
    </details>)}
    {prisoner.bottles.length > 0 && <details className="seer-fold" open>
      <summary>囚犯原瓶 · 来源与去向</summary>
      {prisoner.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {prisoner.abilities.length > 0 && <details className="seer-fold">
      <summary>已知能力记录</summary>
      {prisoner.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

function isCaseAction(action: WerewolfAction): boolean {
  return "caseId" in action.command;
}

interface WerewolfPanelProps {
  werewolf: WerewolfProjection;
  resources: SeerResources;
  busy: boolean;
  blocked: boolean;
  onCommand: (command: WerewolfCommand) => void;
}

/** Only committed public facts change the actual open attempt, chosen method, or report. */
export function WerewolfPanel({ werewolf, resources, busy, blocked, onCommand }: WerewolfPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => werewolf.cases[0]?.id ?? null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const selectedBottle = werewolf.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedAction = werewolf.actions.find(
    (action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId,
  );
  const insidePractice: boolean = werewolf.insideCase && !werewolf.moon.pending;
  const moonPending: boolean = werewolf.moon.pending;
  const sceneLocked: boolean = insidePractice || moonPending;
  const caseActions = werewolf.actions.filter(isCaseAction);
  // The public RETURN target identifies the actual open attempt; history and prose never create a lock.
  const returnAction = werewolf.actions.find((action) => action.command.type === "RETURN" && action.enabled)
    ?? werewolf.actions.find((action) => action.command.type === "RETURN");
  const returnCaseId = returnAction?.command.type === "RETURN" ? returnAction.command.caseId : null;
  const selectedCase = (insidePractice ? werewolf.cases.find((entry) => entry.id === returnCaseId) : undefined)
    ?? werewolf.cases.find((entry) => entry.id === selectedCaseId)
    ?? werewolf.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? werewolf.cases[0];
  const selectedCaseActions = selectedCase && !moonPending ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id
    && (!insidePractice || action.command.type === "RETURN")) : [];
  const actions = insidePractice ? [] : werewolf.actions.filter((action) => moonPending
    ? action.command.type === "HANDLE_MOON"
    : action.command.type !== "CONSUME" && action.command.type !== "HANDLE_MOON" && !isCaseAction(action));
  const nextAction = insidePractice
    ? selectedCaseActions.find((action) => action.command.type === "RETURN" && action.enabled) ?? selectedCaseActions.find((action) => action.command.type === "RETURN")
    : moonPending ? actions.find((action) => action.enabled) ?? actions[0]
    : werewolf.promoted
    ? selectedCaseActions.find((action) => action.enabled) ?? actions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? actions[0]
    : werewolf.actions.find((action) => action.enabled && action.command.type === "CONSUME")
      ?? actions.find((action) => action.enabled) ?? actions[0];
  useEffect(() => {
    if (selectedCase && (insidePractice || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [insidePractice, selectedCaseId, selectedCase]);
  // Next steps use the public action label; availability and costs stay authoritative.
  const nextLabel = nextAction?.label;
  const confirming = !!selectedBottle && selectedAction?.command.type === "CONSUME" && !werewolf.promoted && !sceneLocked;
  const confirmationLocked = busy || blocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedAction || werewolf.promoted || sceneLocked)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedAction, werewolf.promoted, sceneLocked]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: WerewolfAction) {
    if (busy || blocked || sceneLocked || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }

  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedAction?.enabled
      || selectedAction.command.type !== "CONSUME" || werewolf.promoted || sceneLocked) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedAction.command);
  }

  function actionButton(action: WerewolfAction) {
    return (
      <div className="seer-action warrior-compact-action" key={action.id}>
        <button
          className={sceneLocked ? "slice-choice primary" : "slice-choice"}
          disabled={busy || blocked || !action.enabled}
          onClick={() => {
            if (busy || blocked || !action.enabled) return;
            if (insidePractice && action.command.type !== "RETURN") return;
            if (moonPending && action.command.type !== "HANDLE_MOON") return;
            if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
            onCommand(action.command);
          }}
          aria-describedby={action.reason ? `werewolf-reason-${action.id}` : undefined}
        >
          <strong>{action.label}</strong>
          <span className="slice-modifiers">{action.cost}</span>
        </button>
        {action.reason && <p className="seer-action-reason" id={`werewolf-reason-${action.id}`}>{action.reason}</p>}
      </div>
    );
  }

  if (confirming && selectedBottle && selectedAction) {
    return (
      <section className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶狼人魔药的服用确认" aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            if (!confirmationLocked) setSelectedBottleId(null);
          }
        }}>
        <div className="slice-eyebrow">服用前，请再确认一次</div>
        <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
        <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
        <dl className="seer-facts">
          <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
          <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
          <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
          <div><dt>本次消耗</dt><dd>{selectedAction.cost}</dd></div>
        </dl>
        <section className="slice-notice seer-risk" aria-label="狼人服用风险与四档结果">
          <strong>服用风险与四档结果</strong>
          <p>{werewolf.risk}</p>
          <p>成功晋升会发生狼人身体变化，并承担反复到来的月圆诅咒：毛发增生、嗜血冲动与理智承压。实际过夜与精神成本不能靠消化、返回或一次看守永久消除，不会自动执行暴力。</p>
        </section>
        <section aria-label="服药前当前资源" className="seer-current-resources">
          <h4>你现在的状态</h4>
          <dl className="seer-facts">
            <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
            <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
            <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
            <div><dt>污染</dt><dd>{werewolf.pollution}</dd></div>
            <div><dt>现金</dt><dd>{resources.cash}</dd></div>
            <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
          </dl>
        </section>
        {selectedAction.reason && <p className="seer-action-reason" id="werewolf-confirm-reason">{selectedAction.reason}</p>}
        <div className="seer-confirm-buttons">
          <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
          <button
            className="slice-button"
            disabled={confirmationLocked || !selectedAction.enabled}
            onClick={confirmBottle}
            aria-describedby={selectedAction.reason ? "werewolf-confirm-reason" : undefined}
          >{busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}</button>
        </div>
        <p className="slice-muted seer-small-note">确认后才会服用这一瓶。暂不服用不消耗行动或原瓶。</p>
      </section>
    );
  }

  return (
    <div className="seer-panel warrior-panel" aria-busy={busy}>
      <section className="seer-summary" aria-label="狼人成长下一步">
        <span className="seer-seal">{werewolf.promoted ? "序列 7" : "狼人晋升卷宗"}</span>
        <h3>{werewolf.title}</h3>
        {insidePractice ? (
          <p className="seer-next"><strong>先实际收拾现场并返回：</strong>{nextLabel || "查看当前公开返回选项"}。返回不消耗行动、精神或灵性，资源全为0时仍可执行；不另抽随机、不奖励、不治疗、不退还此前成本，原尝试与实际返回次数继续保留。</p>
        ) : moonPending ? (
          <p className="seer-next"><strong>先度过本次月圆：</strong>{nextLabel || "查看当前公开月圆处理选项"}。实际过夜后才能继续普通生活；0行动、0灵性，精神为0仍可执行，实际成本与记录继续保留。</p>
        ) : werewolf.promoted && werewolf.acting >= 100 ? (
          <p className="seer-next">这一阶段的魔药已消化。可以继续生活与调查，或回看已完成的实践与原报告。</p>
        ) : nextAction ? (
          <p className="seer-next"><strong>下一步：</strong>{nextLabel}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</p>
        ) : <p className="seer-next">{werewolf.promoted ? "带着已掌握的本领继续生活与调查。" : "暂时没有可执行的成长行动。"}</p>}
        <p className="slice-muted">{werewolf.digestion}</p>
        {!werewolf.promoted && <p className="slice-muted">晋升需要疯子100消化与八个完整序列8周。准备期间仍可工作、调查或休养；晋升不会自动加入组织。</p>}
        <p className="slice-muted">{playerText("狼人身体变化、自愈与毒爪仅按公开能力和实际条件生效；不自动伤害他人，不提供未核实的黑暗法术。普通方法也可完成实践与消化。成年指导、独立成品、三项实践及具体数值属于游戏设定（G），晋升不会自动加入组织。")}</p>
      </section>

      {werewolf.promoted && <section className="slice-notice" aria-label="月圆诅咒与实际过夜">
        <h4>{moonPending ? "本次月圆尚未度过" : "月圆诅咒"}</h4>
        <p>{werewolf.moon.summary}</p>
        <p>{playerText("月圆会带来毛发增生、嗜血冲动与理智承压，不会自动执行暴力。本阶段只处理有限已公示G月相事件，并非原著精确天文历法；处理一次不会永久解除诅咒，下次月圆仍会到来。")}</p>
        <p>看守协助须实际留在贝克兰德的原哈伦工坊度过一夜，扣除当前精神与10中的较小值；独自承受须在当前地点停止接触并过夜，扣除当前精神与20中的较小值。两者均为0行动、0灵性，精神为0也可完成；不治疗、不奖励、不退还此前成本。</p>
        {moonPending && <div role="group" aria-label="本次月圆处理选择">{actions.map(actionButton)}</div>}
        {werewolf.moon.history.length > 0 && <details className="seer-fold" open>
          <summary>已经实际度过的月圆</summary>
          {werewolf.moon.history.map((entry, index) => <p key={`${entry.week}-${index}`}>第{entry.week}周 · {entry.method === "GUARDED" ? "原哈伦工坊看守过夜" : "原地点停止接触并独自过夜"} · 实际精神消耗{entry.mentalCost}</p>)}
        </details>}
      </section>}

      {werewolf.promoted && <section className="slice-notice warrior-environment" aria-label="现场与实际返回边界">
        <h4>现场与实际返回边界</h4>
        <p>{werewolf.environment || "尚未取得现场公开记录；已有伤口、原物、实际方法与结果须经观察和行动确认。"}</p>
      </section>}

      {selectedCase && !moonPending && (
        <section aria-label="狼人有限实践">
          <h3>现场观察与有限实践</h3>
          <label className="seer-case-selector">
            选择当前实践
            <select value={selectedCase.id} disabled={busy || blocked || sceneLocked} onChange={(event) => setSelectedCaseId(event.target.value)}>
              {werewolf.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
            </select>
          </label>
          <section className="seer-current-case warrior-case" aria-label="当前狼人实践">
            <h4>{selectedCase.title}</h4>
            <p>{selectedCase.story}</p>
            <p className="slice-muted">当前现场：{selectedCase.sceneOpen}</p>
            <p className="slice-muted">实际返回次数：{selectedCase.returns}</p>
            <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
            <section className="warrior-observations" aria-label="实际观察记录">
              <h4>实际观察记录</h4>
              {selectedCase.observations.length > 0
                ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-observation-${index}`}>{observation}</li>)}</ul>
                : <p className="slice-muted">尚未观察现场；原伤口、原物、具体条件与本次行动结果仍未知。</p>}
            </section>
            <section className="warrior-preparation" aria-label="实际方式与准备">
              <h4>实际方式与准备</h4>
              <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的准备记录；已完成的行动、实际返回与报告见原记录。"}</p>
            </section>
            <section className="slice-notice warrior-boundaries" aria-label="实践范围与节制边界">
              <h4>实践范围与节制边界</h4>
              <p>先观察原现场，再自主选择狼人能力（ABILITY）或普通方法（ORDINARY）。选择与准备不会自动执行；自愈只针对已有伤势，不制造伤口练习，毒爪只在公开的原物上检验。实际成本以公开按钮为准。</p>
              <p className="slice-muted">两种方法每次实际执行后都须单独收拾现场并返回，成功或失败均如此；只做准备不会打开实际现场。返回不消耗资源，不治疗、不退还此前成本；返回后才能报告或继续普通生活。毒性不等于必杀，身体与自愈能力不提供灵体、诅咒或污染治疗。</p>
            </section>
            {selectedCase.result && <section className="warrior-result" aria-label="实际执行与报告记录" aria-live="polite" aria-atomic="true">
              <h4>实际执行与报告记录</h4><p>{selectedCase.result}</p>
            </section>}
            {selectedCaseActions.length > 0 && (
              <div className="warrior-action-list" role="group" aria-label="当前狼人实践行动">{selectedCaseActions.map(actionButton)}</div>
            )}
          </section>
        </section>
      )}

      {!moonPending && actions.length > 0 && (
        <div className="warrior-action-list" role="group" aria-label="狼人成长行动">
          {actions.map(actionButton)}
        </div>
      )}

      {werewolf.story && <p className="slice-muted">{werewolf.story}</p>}

      {werewolf.discovered && <section className="slice-notice warrior-source" aria-label="狼人成品渠道与配方边界">
        <h4>成品渠道与配方边界</h4>
        <p>{playerText("完整配方尚未核实。本阶段只使用本作原创G渠道中的独立成品原瓶，不提供调配。来源、费用、劳动与后续补给条件以以下公开记录为准。")}</p>
        {werewolf.supplies && <p>{werewolf.supplies}</p>}
      </section>}
      {werewolf.discovered && werewolf.bottles.length > 0 && (
        <details className="seer-fold warrior-bottles" open={!werewolf.promoted}>
          <summary>独立成品原瓶 · 来源与去向</summary>
          {werewolf.bottles.map((bottle) => {
            const action = werewolf.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
            return (
              <article className={action && !werewolf.promoted ? "seer-bottle" : "seer-fold"} key={bottle.id}>
                <div><h4>{bottle.title}</h4><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
                {action && !werewolf.promoted && !sceneLocked && (
                  <div>
                    <button
                      className="slice-button"
                      disabled={busy || blocked || !action.enabled}
                      ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
                      onClick={() => openBottle(action)}
                      aria-describedby={action.reason ? `werewolf-bottle-reason-${bottle.id}` : undefined}
                    >查看并准备服用「{bottle.title}」</button>
                    <p className="seer-small-note">{action.cost}</p>
                    {action.reason && <p className="seer-action-reason" id={`werewolf-bottle-reason-${bottle.id}`}>{action.reason}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </details>
      )}

      {werewolf.discovered && !werewolf.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{werewolf.risk}</p></details>}
      {werewolf.promoted && (
        <section className="warrior-abilities" aria-label="狼人能力与消化">
          <h3>能力与消化 · {werewolf.abilities.length} 项训练记录</h3>
          <p className="slice-muted">{playerText("序列7保留囚犯与疯子时期能力及原掌握度，战斗中的短暂强化仍由每回合明确选择。狼人身体、自愈、毒爪的实际作用以公开记录为准；不提供序列6活尸能力，不凭空补出未核实的法术。")}</p>
          <p>扮演进度 {werewolf.acting} · 消化：{werewolf.digestion}</p>
          <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {werewolf.pollution}</p>
          {werewolf.abilities.map((ability) => (
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
