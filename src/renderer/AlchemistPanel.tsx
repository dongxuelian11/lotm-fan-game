import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { AlchemistAction, AlchemistCommand, AlchemistProjection } from "../domain/alchemist/types";
import type { AstronomerProjection } from "../domain/astronomer/types";
import type { SeerResources } from "./SeerPanel";
import "./seer-styles.css";

const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察原现场", OBSERVED: "已核对原物与边界", PREPARED: "已准备，尚未实施",
  ACTIVE: "实践中，仍须停止与收回", EXAMINED: "已实际结束，等待报告", RESOLVED: "已提交有限报告",
};
const ENCOUNTER_STATUS: Record<string, string> = {
  AVAILABLE: "尚未实际交谈", READY: "已交谈，可和平离开", FIGHTING: "实际战斗中",
  RESOLVED: "原冲突已结束", RETREATED: "已沿原出口撤离", LOST: "原冲突已造成真实失败",
};
const LOCATION: Record<string, string> = {
  PLAYER: "由玩家本人保管", BENCH_START: "原工作台起点", BENCH_END: "原工作台终点",
  GUARD_MARK: "原一米防护标记", YARD: "原院地面", OUTSIDE: "已在场地外",
  OWNER: "原主人处", WORKBENCH: "同一原工作台", HAND: "仍在原对手手中",
};
const RITUAL_TYPES = ["PURCHASE_PLOT", "OPEN_RITUAL", "SURVEY", "DRAIN_LIFE", "LEAVE_RITUAL"];
const ENCOUNTER_TYPES = ["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"];
const EXIT_TYPES = ["LEAVE_RITUAL", "STOP_CREATION", "RETURN_CREATION", "RETURN_MATERIAL", "CLOSE", "WITHDRAW", "LEAVE_ENCOUNTER"];

type Plot = AlchemistProjection["ritual"]["plots"][number];
type Confirmation = { action: AlchemistAction; plotId: string | null };

/** Earlier observations and original outcomes remain read-only after promotion. */
export function AlchemistAstronomerHistory({ astronomer }: { astronomer: AstronomerProjection }) {
  return <section className="seer-panel warrior-panel" aria-label="天文学家时期的经历">
    <h3>天文学家时期的经历</h3>
    <p className="slice-notice">原星图、原仪器校准、夜间实测、失败与旧原瓶继续保留，只供回看；晋升不会重做旧实践或重领成长。</p>
    <p>天文学家扮演进度 {astronomer.acting} · 消化：{astronomer.digestion}</p>
    <details className="seer-fold"><summary>天文学家原故事与供给</summary>
      {astronomer.story && <p>{astronomer.story}</p>}<p>{astronomer.environment}</p><p>{astronomer.supplies}</p>
    </details>
    {astronomer.practice && <section aria-label="原仪器与实测记录">
      <p>原仪器偏移 {astronomer.practice.instrumentOffset} · 实际测量 {astronomer.practice.measurements} 次</p>
      <p>原校准：{astronomer.practice.calibratedWeek === null ? "尚无实际校准" : `第${astronomer.practice.calibratedWeek}周`}；原夜测：{astronomer.practice.observedWeek === null ? "尚无实际夜测" : `第${astronomer.practice.observedWeek}周`}。</p>
    </section>}
    {astronomer.cases.map((entry) => <details className="seer-fold" key={entry.id}>
      <summary>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</summary>
      <p>原案卷：{entry.id}</p><p>{entry.story}</p>
      {entry.observations.length > 0 && <ul>{entry.observations.map((text, index) => <li key={`${entry.id}-${index}`}>{text}</li>)}</ul>}
      {entry.preparation && <p>当时的准备：{entry.preparation}</p>}
      <p>{entry.contactOpen} · 实际结束 {entry.closes} 次</p>
      {entry.result && <p>当时的结果与报告：{entry.result}</p>}
    </details>)}
    {astronomer.bottles.length > 0 && <details className="seer-fold"><summary>天文学家原瓶 · 来源与去向</summary>
      {astronomer.bottles.map((bottle) => <article key={bottle.id}><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></article>)}
    </details>}
    {astronomer.abilities.length > 0 && <details className="seer-fold"><summary>天文学家时期能力记录</summary>
      {astronomer.abilities.map((ability) => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
    </details>}
  </section>;
}

export interface AlchemistPanelProps {
  alchemist: AlchemistProjection;
  resources: SeerResources;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  readOnly?: boolean;
  onCommand: (command: AlchemistCommand) => void;
}

function PlotFacts({ plot }: { plot: Plot }) {
  return <>
    <p>原地块：{plot.id} · {plot.status}</p>
    <p>来源：{plot.source}</p><p>归属：{plot.owner === "PLAYER" ? "玩家独立持有" : plot.owner} · 边界：{plot.boundary}</p>
    <dl className="seer-facts">
      <div><dt>原植物</dt><dd>活株 {plot.livePlants} · 已死 {plot.deadPlants}</dd></div>
      <div><dt>原土壤</dt><dd>{plot.soil.id} · 活力 {plot.soil.vitality} · {plot.soil.status === "SAND" ? "已经沙化" : plot.soil.status}</dd></div>
      <div><dt>原水池</dt><dd>{plot.pool.id} · 现存 {plot.pool.waterLitres} 升 · {plot.pool.status === "DRY" ? "已经干涸" : plot.pool.status}</dd></div>
      <div><dt>实际购入</dt><dd>第{plot.purchasedWeek}周 · 最早第{plot.plannedWeek}周入场</dd></div>
      <div><dt>实际抽取</dt><dd>{plot.drainedWeek === null ? "尚未抽取生命力" : `第${plot.drainedWeek}周已抽取，损毁保留`}</dd></div>
      <div><dt>本地块服用的原瓶</dt><dd>{plot.consumedBottleId ?? "尚未在这里服药"}</dd></div>
    </dl>
    <p>{plot.summary}</p>
    <details className="seer-fold"><summary>{plot.id}的每株原植物与土水来源</summary>
      <p>土壤来源：{plot.soil.source}</p><p>水池来源：{plot.pool.source}</p>
      <ul>{plot.plants.map((plant) => <li key={plant.id}>{plant.id} · {plant.kind} · {plant.status === "DEAD" ? "已死" : plant.status} · {plant.location}<p className="slice-muted">来源：{plant.source}</p></li>)}</ul>
    </details>
  </>;
}

function RitualFacts({ ritual }: { ritual: AlchemistProjection["ritual"] }) {
  const current = ritual.plots.find((plot) => plot.id === ritual.currentPlotId);
  return <>
    <h4>{ritual.title}</h4><p>{ritual.status}</p>
    <p>{ritual.appointment}</p>
    <p>本人位置：{LOCATION[ritual.playerLocation] ?? ritual.playerLocation}</p>
    <p>本周服药窗口：{ritual.windowOpen ? "当前原地块已抽取，本人仍在本周现场" : "当前没有合格窗口"}</p>
    {current ? <PlotFacts plot={current} /> : <p className="slice-muted">尚无当前地块。已经结束的原地块仍保存在下方记录中。</p>}
  </>;
}

/** Display committed public facts; never synthesize an action target or ability availability. */
export function AlchemistPanel({ alchemist: value, resources, busy, blocked = false, error = null, readOnly = false, onCommand }: AlchemistPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [acceptedDrain, setAcceptedDrain] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const returnActionId = useRef<string | null>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const locked = busy || blocked || error !== null || readOnly;
  const confirmationLocked = locked || submittedId !== null;
  const isDrain = confirmation?.action.command.type === "DRAIN_LIFE";
  const samePlot = !confirmation || confirmation.plotId === value.ritual.currentPlotId;
  const liveConfirmation = confirmation && samePlot ? value.actions.find((action) => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const selectedBottleId = confirmation?.action.command.type === "CONSUME" ? confirmation.action.command.bottleId : null;
  const selectedBottle = value.bottles.find((bottle) => bottle.id === selectedBottleId);
  const caseActions = value.actions.filter((action) => "caseId" in action.command);
  const selectedCase = value.life.cases.find((entry) => entry.contactOpen || entry.status === "PREPARED")
    ?? value.life.cases.find((entry) => entry.id === caseId)
    ?? value.life.cases.find((entry) => caseActions.some((action) => action.enabled && "caseId" in action.command && action.command.caseId === entry.id))
    ?? value.life.cases[0];
  const selectedCaseActions = selectedCase ? caseActions.filter((action) => "caseId" in action.command && action.command.caseId === selectedCase.id) : [];
  const ritualActions = value.actions.filter((action) => RITUAL_TYPES.includes(action.command.type));
  const encounterActions = value.actions.filter((action) => ENCOUNTER_TYPES.includes(action.command.type));
  const bottleActions = value.actions.filter((action) => "bottleId" in action.command);
  const growthActions = value.actions.filter((action) => !("caseId" in action.command) && !("bottleId" in action.command)
    && !RITUAL_TYPES.includes(action.command.type) && !ENCOUNTER_TYPES.includes(action.command.type));
  const nextExit = EXIT_TYPES.map((type) => value.actions.find((action) => action.enabled && action.command.type === type)).find(Boolean);
  const nextAction = nextExit ?? value.actions.find((action) => action.enabled) ?? value.actions[0];
  const currentPlot = value.ritual.plots.find((plot) => plot.id === value.ritual.currentPlotId);

  useEffect(() => {
    if (selectedCase && (value.life.inside || caseId === null)) setCaseId(selectedCase.id);
  }, [selectedCase, value.life.inside, caseId]);
  useEffect(() => {
    const committedDrain = isDrain && submittedId !== null && currentPlot !== undefined && currentPlot.drainedWeek !== null;
    if (confirmation && (readOnly || (!busy && error === null && (!liveConfirmation || value.promoted
      || (isDrain ? committedDrain : !selectedBottle))))) {
      setConfirmation(null); setAcceptedDrain(false); setSubmittedId(null); submitted.current = null;
    }
  }, [confirmation, liveConfirmation, selectedBottle, busy, error, readOnly, value.promoted, isDrain, submittedId, currentPlot?.drainedWeek]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function openConfirmation(action: AlchemistAction) {
    if (locked || !action.enabled || value.promoted) return;
    if (action.command.type === "CONSUME" && !value.bottles.some((bottle) => action.command.type === "CONSUME" && bottle.id === action.command.bottleId)) return;
    if (action.command.type !== "DRAIN_LIFE" && action.command.type !== "CONSUME") return;
    returnActionId.current = action.id; submitted.current = null; setSubmittedId(null); setAcceptedDrain(false);
    setConfirmation({ action, plotId: value.ritual.currentPlotId });
  }
  function confirmAction() {
    if (confirmationLocked || submitted.current !== null || !confirmation || !samePlot || !liveConfirmation?.enabled
      || (isDrain ? !acceptedDrain : !selectedBottle)) return;
    submitted.current = confirmation.action.id; setSubmittedId(confirmation.action.id);
    onCommand(liveConfirmation.command);
  }
  function actionButton(action: AlchemistAction) {
    return <div className="seer-action warrior-compact-action" key={action.id}>
      <button className="slice-choice" disabled={locked || !action.enabled}
        ref={(node) => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `alchemist-reason-${action.id}` : undefined}
        onClick={() => {
          if (locked || !action.enabled) return;
          if (action.command.type === "CONSUME" || action.command.type === "DRAIN_LIFE") openConfirmation(action);
          else { if ("caseId" in action.command) setCaseId(action.command.caseId); onCommand(action.command); }
        }}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
      {action.reason && <p className="seer-action-reason" id={`alchemist-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。" : "请使用保存错误处的重试，继续同一原操作，不要再次抽取或服药。"}
  </p>;

  if (confirmation) return <section className="seer-panel warrior-panel alchemist-panel seer-confirmation"
    aria-label={isDrain ? "原地块生命力抽取的独立确认" : "这瓶炼金术士魔药的服用确认"} aria-busy={busy}
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!confirmationLocked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">{isDrain ? "这一步会永久损毁当前原地块" : "同一原瓶与当前原地块窗口"}</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{isDrain ? "独立确认抽取本地块全部生命力" : selectedBottle?.title ?? "原瓶已不再可用"}</h3>
    {selectedBottle && <><p>原瓶：{selectedBottle.id}</p><p>来源：{selectedBottle.source}</p><p>{selectedBottle.status} · 服用成功率 {selectedBottle.chance}%</p></>}
    <section className="slice-notice" aria-label="确认前的当前原地块"><RitualFacts ritual={value.ritual} /></section>
    <p>本次成本：{liveConfirmation?.cost ?? confirmation.action.cost}</p>
    {isDrain ? <>
      <section className="slice-notice seer-risk" aria-label="抽取的不可逆后果">
        <h4>原植物会死亡，原土壤沙化，原水池干涸</h4>
        <p>{value.ritual.consequence}</p>
        <p>离场、服药失败或以后再试都不会恢复这块土地。之后尝试须重新付费取得另一块独立原地块，并等到下一真实周；不复活旧植物，不重置旧土水。</p>
        <p>可以拒绝抽取，0行动离场，并继续作为天文学家生活。这个封闭场地不包含人或动物。</p>
      </section>
      <label className="slice-notice"><input type="checkbox" checked={acceptedDrain} disabled={confirmationLocked}
        onChange={(event) => setAcceptedDrain(event.target.checked)} />我理解并接受这一原地块全部植物死亡、土壤沙化和水池干涸，且不会自动恢复。</label>
    </> : <>
      <section className="slice-notice seer-risk" aria-label="炼金术士服用风险与四档结果"><h4>服用风险与四档结果</h4><p>{value.risk}</p></section>
      <p>只在本周实际抽取后的同一原地块内服用。成功或失败都耗用这一原瓶并退出现场；失败仍保留所有原植物死亡、沙化土壤与干涸水池。</p>
      <section aria-label="服药前当前资源"><h4>当前角色资源</h4><dl className="seer-facts">
        <div><dt>健康</dt><dd>{resources.health} / {resources.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{resources.mind} / {resources.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{resources.spirituality} / {resources.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{value.pollution}</dd></div>
        <div><dt>现金</dt><dd>{resources.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{resources.actionsRemaining}</dd></div>
      </dl></section>
    </>}
    <p className="slice-muted">{playerText("仪式特征已知、完整条件待核；本作导师方案G。此地块尺度、费用、等待时间与操作不是原著完整仪式，也不是现实操作说明。")}</p>
    {liveConfirmation?.reason && <p className="seer-action-reason" id="alchemist-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={confirmationLocked} onClick={() => setConfirmation(null)}>{isDrain ? "暂不抽取，返回原地块" : "暂不服用，返回原地块"}</button>
      <button className="slice-button" disabled={confirmationLocked || !liveConfirmation?.enabled || (isDrain && !acceptedDrain)}
        aria-describedby={liveConfirmation?.reason ? "alchemist-confirm-reason" : undefined} onClick={confirmAction}>
        {busy ? "正在结算并保存…" : isDrain ? "确认不可逆抽取本地块生命力" : `确认服用「${selectedBottle?.title ?? "原瓶"}」`}
      </button>
    </div>
    <p className="slice-muted">确认后只提交这一次原操作。保存失败等待外层重试，不重新抽取、服药或扣费。</p>{saveNotice}
  </section>;

  return <div className="seer-panel warrior-panel alchemist-panel" aria-busy={busy}>
    <section className="seer-summary" aria-label="炼金术士成长下一步">
      <span className="seer-seal">{value.promoted ? "炼金术士4" : "天文学家5 → 炼金术士4"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next">{nextAction ? <><strong>下一步：</strong>{nextAction.label}{!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}</>
        : value.acting >= 100 ? "这一阶段已消化，可以继续生活或回看实际记录。" : "请先查看当前公开条件与原物记录。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">通识者途径的炼金术士（序列4）。序列3奥秘学者尚未开放。</p>
      {readOnly && <p className="slice-notice">当前为只读记录，不能重复取得原物、抽取生命力、服药或结算成长。</p>}
    </section>
    {growthActions.length > 0 && <div className="warrior-action-list" role="group" aria-label="炼金术士成长行动">{growthActions.map(actionButton)}</div>}
    {value.discovered && <section className="slice-notice" aria-label="炼金术士配方与导师方案边界">
      <h3>{playerText("当前渠道仅提供成品魔药")}</h3>
      <p>{playerText("仪式特征已知、完整条件待核；本作导师方案G。取得有来源的成品原瓶，不编造材料或调配步骤。")}</p>
      <p>{value.supplies}</p>
      <p>晋升由你选择。可以保留活着的原地块、0行动离场，继续天文学家阶段；抽取后的损毁不会因失败、退出或重试消失。</p>
    </section>}
    {value.discovered && <section aria-label="炼金术士当前实际原地块">
      <RitualFacts ritual={value.ritual} />
      <p className="slice-muted">{value.ritual.source}</p><p>{value.ritual.boundary}</p>
      <p className="slice-notice">{value.ritual.consequence}</p>
      <div className="warrior-action-list" role="group" aria-label="原地块准备、抽取与零行动离场">{ritualActions.map(actionButton)}</div>
      <p className="slice-muted">购买取得实际植物、活土与池水，须下一真实周再入场。只在本人实际入场时占用现场；随时可用公开的0行动离场按钮结束。抽取后离场会失去本次服药窗口，损毁仍然保留。</p>
      {value.ritual.plots.filter((plot) => plot.id !== value.ritual.currentPlotId).length > 0 && <details className="seer-fold"><summary>已结束的原地块与永久损毁记录</summary>
        {value.ritual.plots.filter((plot) => plot.id !== value.ritual.currentPlotId).map((plot) => <article key={plot.id} aria-label={`${plot.id}原地块历史`}><PlotFacts plot={plot} /></article>)}
      </details>}
    </section>}
    {value.bottles.length > 0 && <section aria-label="炼金术士原瓶与独立来源"><h3>原瓶 · 来源与去向</h3>
      {value.bottles.map((bottle) => <article className="seer-bottle" key={bottle.id}>
        <div><h4>{bottle.title}</h4><p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p></div>
        <div className="warrior-action-list">{bottleActions.filter((action) => "bottleId" in action.command && action.command.bottleId === bottle.id).map(actionButton)}</div>
      </article>)}
    </section>}
    {value.promoted && <section aria-label="炼金术士亲手制造的有限原物">
      <h3>亲手制造的原物与剩余供能</h3><p>{value.life.story}</p>
      {value.life.creations.length === 0 ? <p>尚未亲手造出本阶段原物。先实际取得组件，再亲手制造；买到的成品不算本人造物。</p>
        : value.life.creations.map((creation) => <article className="seer-current-case" key={creation.id} aria-label={`${creation.id}原造物`}>
          <h4>{creation.kind === "GUARD_FRAME" ? "本人制造的原小型防护框" : "本人制造的原小型传信箱"}</h4>
          <p>原造物：{creation.id} · 第{creation.manufacturedWeek}周制造</p><p>来源：{creation.source}</p>
          <p>原组件：{creation.componentIds.join("、")}</p><p>制造者：{creation.madeBy} · 归属：{creation.owner} · 保管：{creation.custodian}</p>
          <dl className="seer-facts"><div><dt>当前原物位置</dt><dd>{LOCATION[creation.location] ?? creation.location}</dd></div>
            <div><dt>有限供能</dt><dd>{creation.charge} / 3</dd></div><div><dt>原物耐久</dt><dd>{creation.durability} / 100</dd></div>
            <div><dt>当前有限生命状态</dt><dd>{creation.active ? "已激活，仍须明确停止" : "已停止或尚未激活"}</dd></div></dl>
        </article>)}
      <details className="seer-fold"><summary>原组件包、原包裹与受托原材料</summary>
        {value.life.materials.map((material) => <p key={material.id}>{material.id} · {material.status} · {material.source} · 原组件：{material.componentIds.join("、")}</p>)}
        <p>原测试包裹：{value.life.parcel.id} · {value.life.parcel.weightGrams}克 · 归属 {value.life.parcel.owner} · 保管 {value.life.parcel.custodian} · {LOCATION[value.life.parcel.location] ?? value.life.parcel.location}</p>
        <p>受托原材料：{value.life.entrustedMaterial.id} · 归属 {value.life.entrustedMaterial.owner} · 保管 {value.life.entrustedMaterial.custodian} · {LOCATION[value.life.entrustedMaterial.location] ?? value.life.entrustedMaterial.location}</p>
      </details>
      <p className="slice-muted">{playerText("只作用于本人制造的小型原物，距离、供能和寿命按本作G有限练习。停止不返还消耗，不产生永恒独立灵魂或额外免费队友；进入战斗不会复制原防护框或补满供能。")}</p>
    </section>}
    {value.promoted && selectedCase && <section aria-label="炼金术士有限生活实践">
      <h3>{value.life.title}</h3>
      <label className="seer-case-selector">选择当前生活实践<select value={selectedCase.id} disabled={locked || value.life.inside || selectedCase.status === "PREPARED"}
        onChange={(event) => setCaseId(event.target.value)}>{value.life.cases.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}</select></label>
      <section className="seer-current-case warrior-case" aria-label="当前炼金术士生活实践">
        <h4>{selectedCase.title}</h4><p>{selectedCase.story}</p>
        <p>{CASE_STATUS[selectedCase.status] ?? selectedCase.status} · {selectedCase.contactOpen ? "现场仍须实际收束" : "现场已结束或尚未开始"}</p>
        <p>本次方法：{selectedCase.method === "ABILITY" ? "付出实际成本的有限能力实践" : selectedCase.method === "ORDINARY" ? "普通方法，不增加能力掌握" : "尚未选择准备"}</p>
        <section aria-label="公开观察与原物记录"><h4>公开观察与原物记录</h4>
          {selectedCase.observations.length > 0 ? <ul>{selectedCase.observations.map((text, index) => <li key={`${selectedCase.id}-${index}`}>{text}</li>)}</ul>
            : <p className="slice-muted">先观察原现场、原物与实际退出方式。</p>}
        </section>
        {selectedCase.id === "maker-account" && <p className="slice-notice">普通工作台与原作品记录只用于比较用途和代价。无生命模型没有被赋魂，不进行生命制造；须归还受托的同一原材料。</p>}
        {selectedCase.result && <section className="slice-notice" aria-label="炼金术士实际生活结果" aria-live="polite"><h4>实际结果</h4><p>{selectedCase.result}</p></section>}
        <div className="warrior-action-list" role="group" aria-label="当前炼金术士生活行动">{selectedCaseActions.map(actionButton)}</div>
        <p className="slice-muted">停止、收回与归还沿原现场实际完成，0行动出口以当前公开资格为准。失败及已付成本保留；收束后须下一真实周才能重试。</p>
      </section>
    </section>}
    {value.promoted && <section aria-label="炼金术士可选原院冲突">
      <h3>{value.encounter.title}</h3><p>{value.encounter.story}</p>
      <p>{ENCOUNTER_STATUS[value.encounter.status] ?? value.encounter.status} · {value.encounter.inside ? "本人仍在当前原院遭遇中" : "当前没有未结束的遭遇现场"}</p>
      <p>同一原对手：{value.encounter.enemy.name} · {value.encounter.enemy.age}岁 · {value.encounter.enemy.id} · 健康 {value.encounter.enemy.health} · 精神 {value.encounter.enemy.mind}</p>
      <p>原对手状态：{value.encounter.enemy.status === "DEAD" ? "原本人已真正死亡" : value.encounter.enemy.status === "SURRENDERED" ? "仍活着，已自行停止抵抗" : value.encounter.enemy.status}；原棍 {value.encounter.enemy.weaponId} · {LOCATION[value.encounter.enemy.weaponLocation] ?? value.encounter.enemy.weaponLocation}。</p>
      <p className="slice-muted">交谈后可0行动和平离开。战斗使用同一实际防护框的剩余供能与耐久，没有原框则普通应对；战斗仍可能留下真实伤势或死亡，服药指导保护不适用。</p>
      <div className="warrior-action-list" role="group" aria-label="原院交谈、战斗与零行动退出">{encounterActions.map(actionButton)}</div>
    </section>}
    {value.promoted && <section aria-label="炼金术士能力与消化"><h3>能力与消化</h3>
      <p>扮演进度 {value.acting} · {value.digestion}</p><progress className="cryptologist-progress" aria-label="炼金术士扮演进度" value={value.acting} max={100} />
      {value.abilities.map((ability) => <details className="seer-fold" key={ability.id}><summary>{ability.label} · 掌握 {ability.mastery}</summary><p>{ability.description}</p></details>)}
      <p className="slice-muted">新能力从实际练习成长；普通比较不冒充施术。序列3奥秘学者及更高阶段尚未开放。</p>
    </section>}
    <details className="seer-fold"><summary>{playerText("能力与使用范围")}</summary>{value.story && <p>{value.story}</p>}<p>{value.environment}</p><p>{value.risk}</p></details>
    {busy && <p className="slice-notice" role="status">正在结算并保存，请稍候。</p>}{saveNotice}
  </div>;
}
