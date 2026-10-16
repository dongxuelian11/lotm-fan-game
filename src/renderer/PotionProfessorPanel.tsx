import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { PotionProfessorAction, PotionProfessorCommand, PotionProfessorProjection } from "../domain/potion-professor/types";
import type { VampireProjection } from "../domain/vampire/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场",
  OBSERVED: "已有条件与药剂记录",
  PREPARED: "已准备待执行的验证",
  EXAMINED: "已有药剂或教学的实际结果",
  RESOLVED: "已提交本次有限报告",
};

/** Earlier blood provisions, practice outcomes and consumed originals remain read-only history. */
export function PotionProfessorVampireHistory({ vampire }: { vampire: VampireProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="吸血鬼时期的经历">
    <h3>吸血鬼时期的经历</h3>
    <p className="slice-notice">你已晋升魔药教授。这里保留吸血鬼时期的故事、供血、原瓶与能力，只供回看；旧成长不会在序列6再次结算扮演进度。当前供血按公共入口的实际条件继续进行。</p>
    <p>吸血鬼扮演进度 {vampire.acting} · 消化：{vampire.digestion}</p>
    {vampire.story && <p>{vampire.story}</p>}
    {vampire.supplies && <p>{vampire.supplies}</p>}
    {vampire.environment && <p>{vampire.environment}</p>}
    <section aria-label="吸血鬼供血记录"><h4>保留的供血记录</h4><p>{vampire.bloodSummary}</p></section>
    {vampire.practices.map((practice) => <details className="seer-fold" key={practice.id}>
      <summary>{practice.title} · {practice.status}</summary>
      <p className="slice-muted">实践ID：{practice.id}</p><p>{practice.story}</p>
    </details>)}
    {vampire.bottles.length > 0 && <details className="seer-fold" open>
      <summary>吸血鬼原瓶 · 来源与去向</summary>
      {vampire.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {vampire.abilities.length > 0 && <details className="seer-fold">
      <summary>吸血鬼时期能力记录</summary>
      {vampire.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface PotionProfessorPanelProps {
  potionProfessor: PotionProfessorProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: PotionProfessorCommand) => void;
}

function isCaseAction(action: PotionProfessorAction): boolean {
  return "caseId" in action.command;
}
function isLaboratoryAction(action: PotionProfessorAction): boolean {
  return action.command.type === "BUY_KIT" || action.command.type === "BREW_ASSISTANCE";
}
function isEncounterAction(action: PotionProfessorAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

const ASSISTANCE_LABELS = { QUIET_STEP: "静步辅助药", ODOR_VEIL: "去味辅助药", BODY_VEIL: "身体透明辅助药", CLOTH_VEIL: "衣物透明辅助药" } as const;

/** Show only saved laboratory facts and public commands; never synthesize a bottle or effect. */
export function PotionProfessorPanel({ potionProfessor, resources, busy, blocked = false, error = null, onCommand }: PotionProfessorPanelProps) {
  const [selectedBrewId, setSelectedBrewId] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = potionProfessor.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = potionProfessor.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = potionProfessor.actions.filter(isCaseAction);
  // An actual public CLOSE identifies the open practice scene; narrative history cannot lock it.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (potionProfessor.insideCase ? potionProfessor.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? potionProfessor.cases.find((entry) => entry.id === selectedCaseId)
    ?? potionProfessor.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? potionProfessor.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = potionProfessor.actions.filter(isEncounterAction);
  const laboratoryActions = potionProfessor.actions.filter(isLaboratoryAction);
  const brewActions = laboratoryActions.filter((action) => action.command.type === "BREW_ASSISTANCE");
  const selectedBrew = brewActions.find((action) => action.id === selectedBrewId)
    ?? brewActions.find((action) => action.enabled) ?? brewActions[0];
  const growthActions = potionProfessor.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action) && !isLaboratoryAction(action));
  const nextAction = potionProfessor.insideCase ? closeAction : !potionProfessor.promoted
    ? potionProfessor.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...laboratoryActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !potionProfessor.promoted && !potionProfessor.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (potionProfessor.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, potionProfessor.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || potionProfessor.promoted || potionProfessor.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, potionProfessor.promoted, potionProfessor.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: PotionProfessorAction) {
    if (busy || interactionBlocked || potionProfessor.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || potionProfessor.promoted || potionProfessor.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: PotionProfessorAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `potionProfessor-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`potionProfessor-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶魔药教授魔药的服用确认" aria-busy={busy}
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
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="魔药教授服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{potionProfessor.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{potionProfessor.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="potionProfessor-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "potionProfessor-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试回执。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="魔药教授成长下一步">
      <span className="seer-seal">{potionProfessor.promoted ? "序列 6" : "魔药教授晋升卷宗"}</span>
      <h3>{potionProfessor.title}</h3>
      <p className="seer-next">{potionProfessor.insideCase
        ? <><strong>先实际结束本次现场：</strong>{nextAction?.label || "查看当前公开结束选项"}{playerText("。在本次已付事项内确认G短效已实际结束并退离，0行动、0精神、0灵性。结束全部辅助药效，不另抽随机、不奖励、不退款、不治疗；已消耗原瓶、材料、灵性与失败记录继续保留，不能跳过退出直接继续生活。")}</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{potionProfessor.digestion}</p>
      {!potionProfessor.promoted && <p className="slice-muted">{playerText("服用前须完成吸血鬼消化100与十二个完整序列7周。G指导360便士；每瓶3320便士，或完成5步劳务后付320便士。三瓶成品分别取得、逐瓶确认，按意志24四档结算；失败消耗原瓶，仍可休养与等下一周补给。实际可用条件与费用以公开选项为准。")}</p>}
      <p className="slice-muted">{playerText("完整晋升魔药配方与剂量仍未核实，指导仅说明有来源的独立成品原瓶。本阶段辅助药采用G抽象封闭教学卡与虚构灵性材料，不提供现实制作步骤；辅助药不会触发晋升。具体故事、短效时长、成本、判定与消化数值为本作原创G。")}</p>
    </section>

    {potionProfessor.promoted && <section className="slice-notice" aria-label="魔药教授能力边界">
      <h4>四种独立辅助药，各有实际原瓶与代价</h4>
      <p>静步、去味、身体透明、衣物透明分别配制。静步通道须实际耗用一瓶静步药验证；分开痕迹的实践在一次明确行动内依次耗用身体透明、衣物透明、去味三瓶，逐项记录身体、衣物与气味的处理。身体透明不会自动让衣物透明，也不会消除气味。</p>
      <p>前两项的主验证使用魔药教授能力与实际成品原瓶；普通观察不代替药效验证。第三项面对自愿参加的成年人，按对方理解程度开展有限教学，可采用公开普通方法。三项主实践可和平完成本阶段消化。</p>
      <p className="slice-muted">{playerText("材料包100便士、0行动，含4份G教学灵性材料，每批有限3包。每次配制1行动、2灵性与1份材料；失败仍消耗材料和灵性，不生成成品，可在实际下一周补给后重做。辅助药只用于本阶段已付事项内的有限短效验证，不额外提供战斗免伤或战斗隐身。")}</p>
    </section>}
    {potionProfessor.promoted && potionProfessor.environment && <section aria-label="当前魔药教授现场">
      <h4>当前现场</h4><p>{potionProfessor.environment}</p>
    </section>}
    {potionProfessor.promoted && <section className="slice-notice" aria-label="实验室材料与辅助药原瓶">
      <h3>实验室材料与辅助药原瓶</h3>
      <p>{potionProfessor.laboratory.summary}</p><p>{potionProfessor.laboratory.materials}</p>
      <p className="slice-muted">辅助药原瓶与晋升魔药分开保存。配制、使用与失败只在保存回执后更新；不会提前扣料、补库存或显示成功。</p>
      {potionProfessor.laboratory.potions.length > 0 ? <details className="seer-fold" open>
        <summary>辅助药原瓶 · 实际持有与耗用记录</summary>
        {potionProfessor.laboratory.potions.map((potion) => <article className="warrior-history-bottle" key={potion.id}>
          <h4>{potion.title}</h4><p className="slice-muted">辅助药原瓶ID：{potion.id} · {ASSISTANCE_LABELS[potion.kind]}</p>
          <p>来源：{potion.source}</p><p>{potion.status}</p>
          <p className="slice-muted">配制周：{potion.brewedWeek} · {potion.usedWeek === null ? "尚未耗用" : `耗用周：${potion.usedWeek}`}</p>
        </article>)}
      </details> : <p className="slice-muted">尚无已配制成功的辅助药原瓶。准备与失败不会生成成品。</p>}
      <section aria-label="已保存的辅助药短效">
        <h4>本次实际短效</h4>
        <dl className="seer-facts">
          <div><dt>静步</dt><dd>{potionProfessor.laboratory.effects.quietStep ? "本次短效尚未结束" : "无持续药效"}</dd></div>
          <div><dt>气味</dt><dd>{potionProfessor.laboratory.effects.odorVeil ? "本次去味短效尚未结束" : "无持续去味药效"}</dd></div>
          <div><dt>身体</dt><dd>{potionProfessor.laboratory.effects.bodyVeil ? "本次身体透明短效尚未结束" : "无持续身体透明药效"}</dd></div>
          <div><dt>衣物</dt><dd>{potionProfessor.laboratory.effects.clothVeil ? "本次衣物透明短效尚未结束" : "无持续衣物透明药效"}</dd></div>
        </dl>
      </section>
      {laboratoryActions.length > 0 && <div role="group" aria-label="辅助药配制与材料行动">
        {laboratoryActions.filter((action) => action.command.type === "BUY_KIT").map(actionButton)}
        {selectedBrew && <>
          <label className="seer-case-selector">选择要配制的辅助药
            <select value={selectedBrew.id} disabled={busy || interactionBlocked || potionProfessor.insideCase}
              onChange={(event) => setSelectedBrewId(event.target.value)}>
              {brewActions.map((action) => <option key={action.id} value={action.id}>{action.command.type === "BREW_ASSISTANCE" ? ASSISTANCE_LABELS[action.command.kind] : action.label}</option>)}
            </select>
          </label>
          {actionButton(selectedBrew)}
        </>}
      </div>}
    </section>}
    {selectedCase && <section aria-label="魔药教授有限实践">
      <h3>静步、分开痕迹与自愿教学</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || potionProfessor.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {potionProfessor.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前魔药教授实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次现场：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="公开观察与药剂记录"><h4>公开观察与药剂记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际核对记录；现场条件、原瓶与对方意愿均以已提交的公开记录为准。</p>}
        </section>
        <section aria-label="验证与准备"><h4>验证与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的验证。选择准备不会提前耗药、配制成品、改变短效或完成教学。"}</p>
        </section>
        {selectedCase.result && <section aria-label="辅助药与实际结果" aria-live="polite" aria-atomic="true">
          <h4>辅助药与实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前魔药教授实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">{playerText("普通方法保留自己的条件与结果。撤回准备不等于实际退出；实际结束须确认G短效结束并退离，不退还原瓶、材料、精神或灵性，也不抹去失败与已提交报告。是否可执行与成本以公开按钮为准。")}</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="魔药教授成长行动">{growthActions.map(actionButton)}</div>}
    {potionProfessor.story && <p className="slice-muted">{potionProfessor.story}</p>}
    {encounterActions.length > 0 && <section aria-label="有限后门冲突">
      <h3>有限后门冲突</h3>
      <p className="slice-muted">先结束辅助药现场，再按公开选项与后门艾文交涉，或承担普通短棍战的实际风险。辅助药不额外提供战斗免伤或隐身；选择战斗不会提前取得胜利，耗用过的原瓶不会自动补回。</p>
      <div className="warrior-action-list" role="group" aria-label="后门冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {potionProfessor.discovered && potionProfessor.supplies && <section className="slice-notice" aria-label="魔药教授成品原瓶供给">
      <h4>成品原瓶与实际供给</h4><p>{potionProfessor.supplies}</p>
    </section>}
    {potionProfessor.discovered && potionProfessor.bottles.length > 0 && <details className="seer-fold" open={!potionProfessor.promoted}>
      <summary>魔药教授独立成品原瓶 · 来源与去向</summary>
      {potionProfessor.bottles.map((bottle) => {
        const action = potionProfessor.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !potionProfessor.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !potionProfessor.promoted && !potionProfessor.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `potionProfessor-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`potionProfessor-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {potionProfessor.discovered && !potionProfessor.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{potionProfessor.risk}</p></details>}
    {potionProfessor.promoted && <section aria-label="魔药教授能力与消化">
      <h3>能力与消化 · {potionProfessor.abilities.length} 项训练记录</h3>
      <p>扮演进度 {potionProfessor.acting} · 消化：{potionProfessor.digestion}</p>
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {potionProfessor.pollution}</p>
      {potionProfessor.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
