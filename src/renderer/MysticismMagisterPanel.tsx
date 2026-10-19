import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { MysticismMagisterAction, MysticismMagisterCommand, MysticismMagisterProjection } from "../domain/mysticism-magister/types";
import type { PolymathProjection } from "../domain/polymath/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未核对现场",
  OBSERVED: "已有公开观察",
  PREPARED: "已准备，尚未实际执行",
  EXAMINED: "已有实际结果，待结束与报告",
  RESOLVED: "已提交有限报告",
};

/** Preserve actual S6 demonstrations, analysis, failures, closures and original samples as read-only history. */
export function MysticismMagisterPolymathHistory({ polymath }: { polymath: PolymathProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="博学者时期的经历">
    <h3>博学者时期的经历</h3>
    <p className="slice-notice">你已晋升秘术导师（序列5）。这里保留博学者时期三案的亲见示范、分析、有限模仿、失败、实际结束、原样本与独立原瓶，只供回看。</p>
    <p>博学者扮演进度 {polymath.acting} · 消化：{polymath.digestion}</p>
    {(polymath.story || polymath.environment || polymath.supplies) && <details className="seer-fold">
      <summary>博学者原故事与供给</summary>
      {polymath.story && <p>{polymath.story}</p>}
      {polymath.environment && <p>{polymath.environment}</p>}
      {polymath.supplies && <p>{polymath.supplies}</p>}
    </details>}
    {polymath.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? "原实践记录"}</summary>
      <p className="slice-muted">原案卷ID：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((observation, index) => <li key={`${entry.id}-${index}`}>{observation}</li>)}</ul>}
      {entry.preparation && <p>当时的方案与准备：{entry.preparation}</p>}
      <p>当时的接触：{entry.contactOpen} · 实际结束次数：{entry.closes}</p>
      {entry.result && <p>当时的实际结果与报告：{entry.result}</p>}
    </details>)}
    <details className="seer-fold" aria-label="博学者原样本与学习记录">
      <summary>原样本、实际来源与已保存的学习</summary>
      {polymath.samples.length > 0 ? polymath.samples.map((sample) => <article className="seer-current-case" key={sample.id} aria-label={sample.label}>
        <h4>{sample.label}</h4><p className="slice-muted">原样本ID：{sample.id}</p><p>来源：{sample.source}</p>
        <dl className="seer-facts">
          <div><dt>亲见示范</dt><dd>{sample.observed ? "已亲见" : "尚未亲见"}</dd></div>
          <div><dt>分析结果</dt><dd>{sample.understood ? "已分析成功" : "尚未分析成功"}</dd></div>
          <div><dt>模仿结果</dt><dd>{sample.learned ? "已成功模仿" : "尚未成功模仿"}</dd></div>
        </dl>
        <p className="slice-muted">{sample.boundary}</p>
      </article>) : <p className="slice-muted">原记录中尚无公开的亲见样本。</p>}
      <p className="slice-muted">晋升不补发样本，不将亲见或分析改写为已学会，也不重新结算旧实践。原能力ID、掌握、样本来源和失败继续保留；这里没有重新分析、模仿或领取旧原物的操作。</p>
    </details>
    {polymath.bottles.length > 0 && <details className="seer-fold">
      <summary>博学者原瓶 · 来源与去向</summary>
      {polymath.bottles.map((bottle) => <article className="warrior-history-bottle" key={bottle.id}>
        <h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p>
        <p>来源：{bottle.source}</p><p>{bottle.status}</p>
      </article>)}
    </details>}
    {polymath.abilities.length > 0 && <details className="seer-fold">
      <summary>博学者时期能力记录</summary>
      {polymath.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface MysticismMagisterPanelProps {
  mysticismMagister: MysticismMagisterProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: MysticismMagisterCommand) => void;
}

function isCaseAction(action: MysticismMagisterAction): boolean { return "caseId" in action.command; }
function isLinkAction(action: MysticismMagisterAction): boolean {
  return action.command.type === "RETURN_TOKEN" || action.command.type === "VERIFY_DREAM";
}
function isCraftAction(action: MysticismMagisterAction): boolean {
  return action.command.type === "MAKE_TOKEN" || action.command.type === "TEST_TOKEN";
}
function isEncounterAction(action: MysticismMagisterAction): boolean {
  return action.command.type === "ENCOUNTER_TALK" || action.command.type === "ENCOUNTER_FIGHT";
}

/** Render committed public observations and submit the original projected intent unchanged. */
export function MysticismMagisterPanel({ mysticismMagister, resources, busy, blocked = false, error = null, onCommand }: MysticismMagisterPanelProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [submittedBottleId, setSubmittedBottleId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const returnBottleId = useRef<string | null>(null);
  const bottleButtons = useRef(new Map<string, HTMLButtonElement>());
  const interactionBlocked = blocked || error !== null;
  const selectedBottle = mysticismMagister.bottles.find((bottle) => bottle.id === selectedBottleId);
  const selectedBottleAction = mysticismMagister.actions.find((action) => action.command.type === "CONSUME" && action.command.bottleId === selectedBottleId);
  const caseActions = mysticismMagister.actions.filter(isCaseAction);
  // Only public exit intents locate a currently open scene; prose is never parsed as state.
  const exitAction = caseActions.find((action) => action.command.type === "CLOSE" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "WITHDRAW" && action.enabled)
    ?? caseActions.find((action) => action.command.type === "CLOSE")
    ?? caseActions.find((action) => action.command.type === "WITHDRAW");
  const openCaseId = exitAction && "caseId" in exitAction.command ? exitAction.command.caseId : null;
  const selectedCase = (mysticismMagister.insideCase ? mysticismMagister.cases.find((entry) => entry.id === openCaseId) : undefined)
    ?? mysticismMagister.cases.find((entry) => entry.id === selectedCaseId)
    ?? mysticismMagister.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? mysticismMagister.cases[0];
  // Public enabled intents remain usable inside the scene, including zero-resource exits.
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const encounterActions = mysticismMagister.actions.filter(isEncounterAction);
  const linkActions = mysticismMagister.actions.filter(isLinkAction);
  const craftActions = mysticismMagister.actions.filter(isCraftAction);
  const growthActions = mysticismMagister.actions.filter((action) => action.command.type !== "CONSUME" && !isCaseAction(action) && !isEncounterAction(action) && !isLinkAction(action) && !isCraftAction(action));
  const nextAction = !mysticismMagister.promoted
    ? mysticismMagister.actions.find((action) => action.command.type === "CONSUME" && action.enabled)
      ?? growthActions.find((action) => action.enabled) ?? growthActions[0]
    : selectedCaseActions.find((action) => action.enabled && action.command.type === "CLOSE")
      ?? linkActions.find((action) => action.enabled && action.command.type === "VERIFY_DREAM")
      ?? craftActions.find((action) => action.enabled && action.command.type === "TEST_TOKEN")
      ?? selectedCaseActions.find((action) => action.enabled && action.command.type === "WITHDRAW")
      ?? selectedCaseActions.find((action) => action.enabled)
      ?? linkActions.find((action) => action.enabled)
      ?? growthActions.find((action) => action.enabled)
      ?? craftActions.find((action) => action.enabled)
      ?? encounterActions.find((action) => action.enabled)
      ?? selectedCaseActions[0] ?? linkActions[0] ?? growthActions[0] ?? craftActions[0];
  const confirming = !!selectedBottle && selectedBottleAction?.command.type === "CONSUME" && !mysticismMagister.promoted && !mysticismMagister.insideCase;
  const confirmationLocked = busy || interactionBlocked || submittedBottleId !== null;

  useEffect(() => {
    if (selectedCase && (mysticismMagister.insideCase || !selectedCaseId)) setSelectedCaseId(selectedCase.id);
  }, [selectedCase, selectedCaseId, mysticismMagister.insideCase]);
  useEffect(() => {
    if (selectedBottleId && (!selectedBottle || !selectedBottleAction || mysticismMagister.promoted || mysticismMagister.insideCase)) {
      setSelectedBottleId(null); setSubmittedBottleId(null); submitted.current = null;
    }
  }, [selectedBottleId, selectedBottle, selectedBottleAction, mysticismMagister.promoted, mysticismMagister.insideCase]);
  useEffect(() => {
    if (confirming) confirmationHeading.current?.focus();
    else if (returnBottleId.current) bottleButtons.current.get(returnBottleId.current)?.focus();
  }, [confirming, selectedBottleId]);

  function openBottle(action: MysticismMagisterAction) {
    if (busy || interactionBlocked || mysticismMagister.insideCase || mysticismMagister.promoted || !action.enabled || action.command.type !== "CONSUME") return;
    returnBottleId.current = action.command.bottleId; submitted.current = null;
    setSubmittedBottleId(null); setSelectedBottleId(action.command.bottleId);
  }
  function confirmBottle() {
    if (confirmationLocked || submitted.current !== null || !selectedBottle || !selectedBottleAction?.enabled
      || selectedBottleAction.command.type !== "CONSUME" || mysticismMagister.promoted || mysticismMagister.insideCase) return;
    submitted.current = selectedBottle.id; setSubmittedBottleId(selectedBottle.id);
    onCommand(selectedBottleAction.command);
  }
  function actionButton(action: MysticismMagisterAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={busy || interactionBlocked || !action.enabled}
        onClick={() => {
          if (busy || interactionBlocked || !action.enabled) return;
          if ("caseId" in action.command) setSelectedCaseId(action.command.caseId);
          onCommand(action.command);
        }} aria-describedby={action.reason ? `mysticism-magister-reason-${action.id}` : undefined}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`mysticism-magister-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试操作。"}
  </p>;

  if (confirming && selectedBottle && selectedBottleAction) return <section
    className="seer-panel warrior-panel mysticism-magister-panel seer-confirmation" aria-label="这瓶秘术导师魔药的服用确认" aria-busy={busy}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setSelectedBottleId(null); }
    }}>
    <div className="slice-eyebrow">服用前，请再确认一次</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{selectedBottle.title}</h3>
    <p className="seer-bottle-source">来源：{selectedBottle.source}</p>
    <p className="slice-muted">{playerText("完整配方、晋升仪式与具体法术清单仍待核实；本次只确认本作原创G指导流程中的这一成品原瓶，不表示无需仪式。")}</p>
    <dl className="seer-facts">
      <div><dt>这一瓶</dt><dd>{selectedBottle.id}</dd></div>
      <div><dt>当前状态</dt><dd>{selectedBottle.status}</dd></div>
      <div><dt>服药成功率</dt><dd>{selectedBottle.chance}%</dd></div>
      <div><dt>本次消耗</dt><dd>{selectedBottleAction.cost}</dd></div>
    </dl>
    <section className="slice-notice seer-risk" aria-label="秘术导师服用风险与四档结果">
      <h4>服用风险与四档结果</h4><p>{mysticismMagister.risk}</p>
    </section>
    <section className="seer-current-resources" aria-label="服药前当前资源">
      <h4>你现在的状态</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{mysticismMagister.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl>
    </section>
    {selectedBottleAction.reason && <p className="seer-action-reason" id="mysticism-magister-confirm-reason">{selectedBottleAction.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setSelectedBottleId(null)}>暂不服用</button>
      <button className="slice-button" disabled={confirmationLocked || !selectedBottleAction.enabled} onClick={confirmBottle}
        aria-describedby={selectedBottleAction.reason ? "mysticism-magister-confirm-reason" : undefined}>
        {busy ? "正在结算并保存…" : `确认服用「${selectedBottle.title}」`}
      </button>
    </div>
    <p className="slice-muted seer-small-note">确认才服用这一独立原瓶。暂不服用不消耗行动或原瓶；保存失败时保留本次确认，等待原操作重试，不重新服药。</p>
    {saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel mysticism-magister-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="秘术导师成长下一步">
      <span className="seer-seal">{mysticismMagister.promoted ? "秘术导师5" : "博学者6 → 秘术导师5"}</span>
      <h3>{mysticismMagister.title}</h3>
      {mysticismMagister.promoted && selectedCase && <p><strong>当前目标：</strong>{selectedCase.title}</p>}
      <p className="seer-next">{nextAction
        ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : mysticismMagister.insideCase ? "请查看当前公开的结束实践选项。"
          : mysticismMagister.promoted && mysticismMagister.acting >= 100 ? "这一阶段已消化，可以继续生活与调查，或回看实际记录。" : "暂时没有可执行的成长行动。"}</p>
      <p className="slice-muted">{mysticismMagister.digestion}</p>
      {mysticismMagister.discovered && !mysticismMagister.promoted && <p className="slice-muted">用药指导：{mysticismMagister.guidanceKnown ? "已听取" : "尚未听取"}。指导、每瓶劳务、付款取得原瓶与逐瓶确认分别进行；实际费用、成熟条件与安全恢复范围以公开记录为准。准备期间仍可继续普通生活。</p>}
      <p className="slice-muted">{playerText("完整魔药配方、晋升仪式与具体法术清单尚未核实，材料、剂量、调配顺序及仪式要求保持未知，不能据此断言无需仪式。本阶段采用本作原创G的独立成品渠道、普通导师准备与指导服药流程。")}</p>
    </section>

    {mysticismMagister.promoted && mysticismMagister.environment && <section aria-label="当前秘术导师现场">
      <h4>当前现场</h4><p>{mysticismMagister.environment}</p>
    </section>}
    {mysticismMagister.promoted && (mysticismMagister.practice || linkActions.length > 0) && <section className="slice-notice" aria-label="秘术导师原布片与梦境核实">
      <h3>原布片、实际梦境与清醒核实</h3>
      {mysticismMagister.practice && <>
        <dl className="seer-facts">
          <div><dt>原布片去向</dt><dd>{mysticismMagister.practice.token}</dd></div>
          <div><dt>实际梦境与核实状态</dt><dd>{mysticismMagister.practice.dream}</dd></div>
        </dl>
        <p>{mysticismMagister.practice.summary}</p>
      </>}
      <p className="slice-muted">原布片MM5-CLOTH-1始终属于成年诺亚，仅在约定中暂借。实际仪式须重新确认本人的同意与当次入睡，玩家身体留在原书房。梦中所得在清醒核实前只是待核实说法；结束接触后，须沿原公共走道普通步行40米，向清醒的诺亚核实并返回。</p>
      <p className="slice-muted">请分别结束当前接触、清醒核实与归还原布片。结束不会自动归还，归还也不会代替结束梦境；报告前须已核实且原布片已回到本人手中。失败后仍可按公开选项结束并归还，原成本保留。</p>
      {linkActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="原布片归还与清醒核实行动">{linkActions.map(actionButton)}</div>}
    </section>}
    {mysticismMagister.promoted && <section aria-label="秘术导师实际制品与原料来源">
      <h3>真实制作的一次性微光原件</h3>
      <p className="slice-muted">每件原件都来自一次实际购买并耗用的灵性材料包，强度在制作时固定。成功制作才有原件，失败仍消耗材料和灵性。测试会在原固定空置3米试验凹室实际耗用指定原件；已耗用记录保留，不补充次数。</p>
      {mysticismMagister.crafts.length > 0 ? mysticismMagister.crafts.map((craft) => <article className="seer-current-case" key={craft.id} aria-label={`一次性原件 ${craft.id}`}>
        <h4>{craft.id}</h4><p>来源：{craft.source}</p>
        <dl className="seer-facts">
          <div><dt>原件状态</dt><dd>{craft.status}</dd></div>
          <div><dt>制作时固定强度</dt><dd>{craft.power}</dd></div>
        </dl>
        {craftActions.filter((action) => action.command.type === "TEST_TOKEN" && action.command.itemId === craft.id).map(actionButton)}
      </article>) : <p className="slice-muted">尚无实际制作成功的微光原件。</p>}
      {craftActions.filter((action) => action.command.type === "MAKE_TOKEN").map(actionButton)}
      <p className="slice-muted">完成有限制作案后，才可按公开条件进行可选的每周一次真实备制，须已有学会的FLASH原样本并再次支付实际费用。备制不是和平消化的必需步骤，也不会自动得到原料、永久装备或新技能。</p>
    </section>}
    {selectedCase && <section aria-label="秘术导师有限实践">
      <h3>有物联系、有限制作与谨慎教导</h3>
      <label className="seer-case-selector">选择当前实践
        <select value={selectedCase.id} disabled={busy || interactionBlocked || mysticismMagister.insideCase}
          onChange={(event) => setSelectedCaseId(event.target.value)}>
          {mysticismMagister.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? "状态待核实"}</option>)}
        </select>
      </label>
      <section className="seer-current-case warrior-case" aria-label="当前秘术导师实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p className="slice-muted">实践状态：{CASE_STATUS[selectedCase.status] ?? "状态待核实"} · {selectedCase.contactOpen} · 实际结束次数：{selectedCase.closes}</p>
        <section aria-label="公开观察与原记录"><h4>公开观察与原记录</h4>
          {selectedCase.observations.length > 0
            ? <ul>{selectedCase.observations.map((observation, index) => <li key={`${selectedCase.id}-${index}`}>{observation}</li>)}</ul>
            : <p className="slice-muted">尚无本次实际观察；原布片、成年参与者的当次意愿、实际材料和教导结果均以已保存的公开记录为准。</p>}
        </section>
        <section aria-label="本次方法与准备"><h4>本次方法与准备</h4>
          <p className={selectedCase.preparation ? undefined : "slice-muted"}>{selectedCase.preparation || "当前没有待执行的实践。准备不会提前开始梦境、制成原件或完成教导；效果只在实际执行并保存后显示。"}</p>
        </section>
        {selectedCase.result && <section className="slice-notice" aria-label="秘术导师实际结果" aria-live="polite" aria-atomic="true">
          <h4>本次实际结果</h4><p>{selectedCase.result}</p>
        </section>}
        {selectedCaseActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="当前秘术导师实践行动">{selectedCaseActions.map(actionButton)}</div>}
        {mysticismMagister.insideCase && <p className="slice-muted">返回生活前须按公开选项实际结束当前接触。0行动、0精神、0灵性时仍可使用已开放的结束或撤回选项；不会另抽随机、发奖、退款、治疗或清除原失败。撤回不归还借物，结束不代替清醒核实或实际测试；各自作用以原选项和已保存记录为准。</p>}
      </section>
    </section>}
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="秘术导师成长行动">{growthActions.map(actionButton)}</div>}
    {encounterActions.length > 0 && <section aria-label="秘术导师有限冲突">
      <h3>可选的有限现场冲突</h3>
      <p className="slice-muted">按公开选项选择交涉或承担真实战斗风险。成年罗文和自己的普通棍位于原空置私人工院，现实出口保留。仪式不会变成瞬发梦境攻击；继承闪光须实际学会原样本，一次性制品须确实制作并仍由玩家持有。伤势、反击、原件消耗与退出以实际结算为准。</p>
      <div className="warrior-action-list" role="group" aria-label="秘术导师冲突行动">{encounterActions.map(actionButton)}</div>
    </section>}
    {mysticismMagister.story && <details className="seer-fold"><summary>{playerText("经历与能力说明")}</summary><p>{mysticismMagister.story}</p></details>}
    {mysticismMagister.discovered && mysticismMagister.supplies && <section className="slice-notice" aria-label="秘术导师成品来源与取得">
      <h4>实际供给与独立原瓶</h4><p>{mysticismMagister.supplies}</p>
    </section>}
    {mysticismMagister.discovered && mysticismMagister.bottles.length > 0 && <details className="seer-fold" open={!mysticismMagister.promoted}>
      <summary>秘术导师独立成品原瓶 · 来源与去向</summary>
      {mysticismMagister.bottles.map((bottle) => {
        const action = mysticismMagister.actions.find((candidate) => candidate.command.type === "CONSUME" && candidate.command.bottleId === bottle.id);
        return <article className={action && !mysticismMagister.promoted ? "seer-bottle" : "warrior-history-bottle"} key={bottle.id}>
          <div><h4>{bottle.title}</h4><p className="slice-muted">原瓶ID：{bottle.id}</p><p>来源：{bottle.source}</p><small>{bottle.status}</small></div>
          {action && !mysticismMagister.promoted && !mysticismMagister.insideCase && <div>
            <button className="slice-button" disabled={busy || interactionBlocked || !action.enabled} onClick={() => openBottle(action)}
              ref={(node) => { if (node) bottleButtons.current.set(bottle.id, node); else bottleButtons.current.delete(bottle.id); }}
              aria-label={`查看并准备服用「${bottle.title}」 · 原瓶 ${bottle.id}`}
              aria-describedby={action.reason ? `mysticism-magister-bottle-${bottle.id}` : undefined}>查看并准备服用「{bottle.title}」</button>
            <p className="seer-small-note">{action.cost}</p>
            {action.reason && <p className="seer-action-reason" id={`mysticism-magister-bottle-${bottle.id}`}>{action.reason}</p>}
          </div>}
        </article>;
      })}
    </details>}
    {mysticismMagister.discovered && !mysticismMagister.promoted && <details className="seer-fold"><summary>查看服用风险与四档结果</summary><p>{mysticismMagister.risk}</p></details>}
    {mysticismMagister.promoted && <section aria-label="秘术导师能力与消化">
      <h3>能力与消化 · {mysticismMagister.abilities.length} 项训练记录</h3>
      <p>扮演进度 {mysticismMagister.acting} · 消化：{mysticismMagister.digestion}</p>
      <progress className="cryptologist-progress" aria-label="秘术导师扮演进度" value={mysticismMagister.acting} max={100} />
      <p className="slice-muted">灵性 {resources.spirituality} / {resources.maxSpirituality} · 污染 {mysticismMagister.pollution}</p>
      {mysticismMagister.abilities.map((ability) => <details className="seer-fold" key={ability.id}>
        <summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p>
      </details>)}
      <details className="seer-fold" aria-label="秘术导师能力边界">
        <summary>查看有物联系、实际耗料与有限教导边界</summary>
        <p>{playerText("秘术仪式须有目标本人的真实物品建立联系，并在当次执行确认同意与入睡；它不是梦魇能力，也不搬运玩家身体或同行者。原著艾德雯娜的一千海里个案不能当作新晋秘术导师的默认范围。")}</p>
        <p>{playerText("制造式模仿需要相关知识与实际超凡材料，并可能失败。本次短暂微光原件为原创G，只使用已实际学会的FLASH原样本与当次耗用材料；模拟圣光的原著个案不赠送完整技能库。")}</p>
        <p>普通方法不制造魔法制品。有限教导只核对成年塔莉娅本人独立完成的来源、出口与材料清单；她没有因此获得序列5或复制来的永久魔法能力，也不保证服从。</p>
        <p>{playerText("旧阅读者、推理学员、守知者与博学者的原能力ID、掌握、原样本和原物继续保留。三项有限实践、和平消化、导师准备、费用与具体判定均为本作原创G；失败、消耗与有限报告按已保存记录呈现，不预支序列4的未来预言。")}</p>
      </details>
    </section>}
    {busy && <p role="status" className="slice-notice">正在结算并保存，请稍候。</p>}
    {saveNotice}
  </div>;
}
