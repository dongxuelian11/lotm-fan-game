import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ArtisanAction, ArtisanCommand, ArtisanProjection } from "../domain/artisan/types";
import type { AppraiserProjection } from "../domain/appraiser/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对事实",
  OBSERVED: "已有图纸、材料或原件记录",
  PREPARED: "已准备待执行的工序",
  EXAMINED: "已有原料或原件的实际结果",
  RESOLVED: "已提交本次有限报告",
};

/** Earlier inspected originals, limited findings and consumed bottles remain read-only history. */
export function ArtisanAppraiserHistory({ appraiser }: { appraiser: AppraiserProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="鉴定师时期的经历">
    <h3>鉴定师时期的经历</h3>
    <p className="slice-notice">你已晋升工匠。这里保留鉴定师时期的原件、有限鉴定结论、风险、原瓶与原ID，只供回看；旧成长不会在序列6再次结算扮演进度。</p>
    <p>鉴定师扮演进度 {appraiser.acting} · 消化：{appraiser.digestion}</p>
    {appraiser.story && <p>{appraiser.story}</p>}
    {appraiser.supplies && <p>{appraiser.supplies}</p>}
    {appraiser.environment && <p>{appraiser.environment}</p>}
    {appraiser.items.map((item) => <details className="seer-fold" key={item.id}>
      <summary>{item.title} · {item.status}</summary>
      <p className="slice-muted">原件ID：{item.id}</p><p>{item.story}</p>
      {item.observations.length > 0 && <ul>{item.observations.map((observation, index) => <li key={`${item.id}-${index}`}>{observation}</li>)}</ul>}
      {item.finding && <p>当时的有限鉴定：{item.finding}</p>}
      {item.risk && <p>原件风险与代价：{item.risk}</p>}
    </details>)}
    {appraiser.bottles.length > 0 && <details className="seer-fold" open>
      <summary>鉴定师原瓶 · 来源与去向</summary>
      {appraiser.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {appraiser.abilities.length > 0 && <details className="seer-fold">
      <summary>鉴定师时期能力记录</summary>
      {appraiser.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface ArtisanPanelProps {
  artisan: ArtisanProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ArtisanCommand) => void;
}

function isCaseAction(action: ArtisanAction): boolean {
  return "caseId" in action.command;
}
function isEncounterAction(action: ArtisanAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render public workshop facts and commands; never synthesize materials, products or effects. */
export function ArtisanPanel({ artisan, resources, busy, blocked = false, error = null, onCommand }: ArtisanPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = artisan.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = artisan.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = artisan.actions.filter(isCaseAction);
  // An actual public CLOSE identifies the open workshop scene; narrative history cannot lock it.
  const closeAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE");
  const closeCaseId = closeAction?.command.type === "CLOSE" ? closeAction.command.caseId : null;
  const selectedCase = (artisan.insideCase ? artisan.cases.find((entry) => entry.id === closeCaseId) : undefined)
    ?? artisan.cases.find((entry) => entry.id === selectedCaseId)
    ?? artisan.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? artisan.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = artisan.actions.filter(isEncounterAction);
  const growthActions = artisan.actions.filter((action) => action.command.type !== "CONSUME"
    && !isCaseAction(action) && !isEncounterAction(action));
  const nextAction = artisan.insideCase ? closeAction : !artisan.promoted
    ? artisan.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : [...selectedCaseActions, ...growthActions, ...encounterActions].find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? growthActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !artisan.promoted && !artisan.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (artisan.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, artisan.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || artisan.promoted || artisan.insideCase)) {
      setSelectedBottleId(null);
      setSubmittedBottleId(null);
      submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, artisan.promoted, artisan.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: ArtisanAction) {
    if (busy || interactionBlocked || artisan.insideCase || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId;
    submitted.current = null;
    setSubmittedBottleId(null);
    setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || artisan.promoted || artisan.insideCase) return;
    submitted.current = selectedBottle.id;
    setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: ArtisanAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => { if (!busy && !interactionBlocked && action.enabled) onCommand(action.command); }}
        aria-describedby={action.reason ? `artisan-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`artisan-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel seer-confirmation" aria-label="这瓶工匠魔药的服用确认" aria-busy={busy}
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
    <section className="slice-notice seer-risk" aria-label="工匠服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{artisan.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{artisan.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="artisan-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "artisan-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认后才会服用这一原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作的重试回执。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="工匠成长下一步">
      <span className="seer-seal">{artisan.promoted ? "序列 6" : "工匠晋升卷宗"}</span>
      <h3>{artisan.title}</h3>
      <p className="seer-next">{artisan.insideCase
        ? <><strong>先实际结束本次现场：</strong>{nextAction?.label || "查看当前公开结束选项"}。结束为0行动、0精神、0灵性；不另抽随机、不奖励、不退款、不治疗，原料消耗、原件去向、检验次数与失败记录继续保留。</>
        : nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{artisan.digestion}</p>
      {!artisan.promoted && <p className="slice-muted">服用前须完成鉴定师消化100与十二个完整序列7周。指导、每瓶劳务、付款取得成品与逐瓶确认分别进行，实际费用、成熟条件与下一周补给以当前公开记录为准；准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方与剂量仍未核实，指导仅说明有来源的独立成品原瓶。工匠制造须有已知图纸、原工房工具与实际原料；具体教学材料、微光灯片、故事、判定、费用与消化数值为本作原创G。")}</p>
    </section>

    {artisan.promoted && <section className="slice-notice" aria-label="工匠能力边界">
      <h4>已知图纸、真实原料与有限成品</h4>
      <p>{playerText("先读懂已知图纸，再在原工房使用原工具制造一枚G微光灯片，最后检验刻度并交付委托人本人。制造只用工匠能力，实际消耗4灵性、1只铜壳与1份教学灵性材料；失败仍耗料，可按公开补购选项重做。读图与交付保留普通方法，普通方法不能凭空造出非凡物。三项主实践可和平完成本阶段消化。")}</p>
      <p className="slice-muted">成功才生成一枚原件，初始只有3次有限照明。实际检验消耗1次照明与1精神；交付后同一原件及剩余2次由委托人保有。灯片没有光束攻击、驱邪或照见秘密的能力。材料包100便士、0行动，每批有限3套；耗尽须等实际下一周补给，不会因关闭现场退料或补满次数。</p>
    </section>}
    {artisan.promoted && artisan.environment && <section aria-label="当前工匠现场">
      <h4>当前现场</h4><p>{artisan.environment}</p>
    </section>}
    {artisan.promoted && <section className="slice-notice" aria-label="工房原料与灯片原件">
      <h3>工房原料与灯片原件</h3>
      <p>{artisan.workshop.summary}</p>
      <p>{artisan.workshop.materials}</p>
      {artisan.workshop.lamp ? <>
        <p>{artisan.workshop.lamp}</p>
        <dl className="seer-facts">
          <div><dt>原件剩余照明</dt><dd>{artisan.workshop.remainingUses} 次</dd></div>
          <div><dt>交付记录</dt><dd>{artisan.workshop.delivered ? "原件已交给委托人本人" : "原件尚未交给委托人"}</dd></div>
        </dl>
      </> : <p className="slice-muted">尚无制造成功的灯片原件。准备、失败或普通方法都不会生成成品。</p>}
      <p className="slice-muted">这里显示已保存的实际原料、原件与去向。执行前后的变化须等本次保存回执，不提前扣料或显示成功。</p>
    </section>}
    {selectedCase && <section aria-label="工匠有限实践">
      <h3>读图、制造、检验与本人交付</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || artisan.insideCase} onChange={(event) => setSelectedCaseId(event.target.value)}>
          {artisan.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前工匠实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">本次现场：{selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"}</p>
        <section aria-label="公开观察与原件记录"><h4>公开观察与原件记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际核对记录；图纸、原料、工具与原件均以已提交的公开记录为准。</p>}
        </section>
        <section aria-label="工序与准备"><h4>工序与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的工序。选择准备不会提前耗料、生成成品、检验或交付原件。"}</p>
        </section>
        {selectedCase.result && <section aria-label="原料、原件与实际结果" aria-live="polite" aria-atomic="true">
          <h4>原料、原件与实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前工匠实践行动">{selectedCaseActions.map(actionButton)}</div>}
        <p className="slice-muted">普通方法保留自己的条件与结果。撤回准备不等于实际退出；结束现场不会退料、退还精神或灵性、回收已交付原件，也不会抹去失败与已提交报告。是否可执行与成本以公开按钮为准。</p>
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="工匠成长行动">{growthActions.map(actionButton)}</div>}
    {artisan.story && <p className="slice-muted">{artisan.story}</p>}
    {encounterActions.length > 0 && <section aria-label="有限后门冲突">
      <h3>有限后门冲突</h3>
      <p className="slice-muted">可按公开选项与后门德文交涉，或承担普通短棍战的实际风险。微光灯片没有战斗能力；选择战斗不会提前取得胜利，交付过的原件不会自动回到玩家手中。</p>
      <div className="warrior-action-list" role="group" aria-label="后门冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {artisan.discovered && artisan.supplies && <section className="slice-notice" aria-label="工匠成品原瓶供给">
      <h4>成品原瓶与实际供给</h4><p>{artisan.supplies}</p>
    </section>}
    {artisan.discovered && artisan.bottles.length > 0 && <details className="seer-fold" open={!artisan.promoted}>
      <summary>工匠独立成品原瓶 · 来源与去向</summary>
      {artisan.bottles.map((bottle) => {
        const action = artisan.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !artisan.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !artisan.promoted && !artisan.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-describedby={action.reason ? `artisan-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`artisan-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {artisan.discovered && !artisan.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{artisan.risk}</p></details>}
    {artisan.promoted && <section aria-label="工匠能力与消化">
      <h3>能力与消化 · {artisan.abilities.length} 项训练记录</h3>
      <p>扮演进度 {artisan.acting} · 消化：{artisan.digestion}</p>
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {artisan.pollution}</p>
      {artisan.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
