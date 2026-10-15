import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { SeaKingAction, SeaKingCommand, SeaKingProjection } from "../domain/sea-king/types";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "本次尚未当面询问", GRANTED: "已当面同意本次有限用途", DECLINED: "已拒绝本次用途", REVOKED: "本次同意已撤回", CLOSED: "本次许可已结束" };
const LOCATION: Record<string, string> = { EXIT: "原入口与普通出口", PIER: "原干燥码头", LEDGE: "原干燥边沿", VANTAGE: "原观察台", OWNER: "原主人处", PLAYER: "本人手中", DINGHY: "同一原艇中", MARK: "六十米外原浮标处", RECESS: "原浅凹槽", SIDE_BERTH: "旁泊位" };
const FRAGMENT = { BLUE_CLOTH: "蓝布", ONE_BELL: "一声铃" };
const HYPOTHESIS = { CURRENT: "水流带动", HAND_MOVED: "有人移动" };
const failedTier = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["ROW_RETURN", "TIE_BOAT", "STOP_WATER", "WAIT_WINDOW", "RETURN_PLAYER", "RETURN_ITEMS", "INSPECT", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const isExit = ({ command }: SeaKingAction) => EXIT_TYPES.has(command.type);
type Confirmation = { action: SeaKingAction; bottle: SeaKingProjection["bottles"][number]; facts: string };

export interface SeaKingPanelProps {
  value: SeaKingProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: SeaKingCommand) => void;
  /** Dismissing the view does not return an original object or leave the actual scene. */
  onClose?: () => void;
}

function confirmationFacts(value: SeaKingProjection, action: SeaKingAction) {
  return JSON.stringify({ promoted: value.promoted, preparations: value.preparations, preparedWeek: value.preparedWeek,
    bottles: value.bottles, resources: value.resources, risk: value.risk, digestion: value.digestion,
    currentGender: value.currentGender, action: { id: action.id, cost: action.cost, command: action.command } });
}

/** Public saved facts and typed intents are the only source of scene and resource changes. */
export function SeaKingPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: SeaKingPanelProps) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const summaryHeading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const locked = busy || blocked || error !== null || submittedId !== null;
  const publicFacts = JSON.stringify(value);
  const liveConfirmation = confirmation ? value.actions.find(action => action.id === confirmation.action.id
    && confirmationFacts(value, action) === confirmation.facts) : undefined;
  const selectedBottle = value.bottles.find(bottle => bottle.id === bottleId)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && "bottleId" in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const { life, encounter } = value;
  const selectedCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === "PREPARED")
    ?? life.cases.find(entry => entry.id === caseId)
    ?? life.cases.find(entry => entry.status !== "RESOLVED") ?? life.cases[0];
  const attempt = life.currentAttempt ?? selectedCase?.attempts.at(-1) ?? null;
  const acquisitionActions = value.actions.filter(action => ACQUISITION_TYPES.has(action.command.type)
    && (!("bottleId" in action.command) || action.command.bottleId === selectedBottle?.id));
  const encounterActions = value.actions.filter(action => ENCOUNTER_TYPES.has(action.command.type));
  const lifeActions = value.actions.filter(action => !ACQUISITION_TYPES.has(action.command.type) && !ENCOUNTER_TYPES.has(action.command.type)
    && (!("caseId" in action.command) || action.command.caseId === selectedCase?.id));
  const currentActions = encounter.inside ? encounterActions : value.promoted ? lifeActions : acquisitionActions;
  const nextAction = currentActions.find(action => action.enabled && action.command.type === "CONSUME")
    ?? currentActions.find(action => action.enabled && !isExit(action))
    ?? currentActions.find(action => action.enabled) ?? currentActions[0];
  const immediateActions = currentActions.filter(action => action.enabled || action === nextAction);
  const exitActions = immediateActions.filter(isExit);
  const unavailableActions = currentActions.filter(action => !immediateActions.includes(action));

  useEffect(() => { summaryHeading.current?.focus(); }, []);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== publicFacts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); setCaseId(null);
      summaryHeading.current?.focus();
    }
    if (confirmation && submitted.current === null && !busy && error === null && !liveConfirmation) setConfirmation(null);
  }, [publicFacts, busy, error, confirmation, liveConfirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? summaryHeading.current)?.focus();
  }, [confirmation]);

  function submit(action: SeaKingAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: SeaKingAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const selectedId = action.command.bottleId;
      const bottle = value.bottles.find(entry => entry.id === selectedId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id;
      setConfirmation({ action, bottle, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  function actionList(actions: SeaKingAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `sea-king-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`sea-king-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="海王当前资源"><h4>当前实际资源</h4>
      <dl className="seer-facts">
        <div><dt>健康</dt><dd>{current.health} / {current.maxHealth}</dd></div>
        <div><dt>精神</dt><dd>{current.mind} / {current.maxMind}</dd></div>
        <div><dt>灵性</dt><dd>{current.spirituality} / {current.maxSpirituality}</dd></div>
        <div><dt>污染</dt><dd>{value.pollution}</dd></div>
        <div><dt>现金</dt><dd>{current.cash}</dd></div>
        <div><dt>剩余行动</dt><dd>{current.actionsRemaining}</dd></div>
      </dl>
    </section>;
  }
  // Scene and encounter facts below use only the saved public projection.
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="海王原人遭遇"><h4>{encounter.title}</h4>
      {enemy && <>
        <p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 本场原创G序列")}{enemy.sequence}等效。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {enemy.status === "DEAD" ? "已经真实死亡" : enemy.status === "SURRENDERED" ? "已投降停止抵抗" : "仍有独立意志"}。</p>
        <p>自己的原棍 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原干燥码头"}。昆廷与旧本尼迪克特分别保存。</p>
      </>}
      <p>当前水源：{encounter.waterSource === "SEAWATER" ? "相连真实海水" : encounter.waterSource === "NONE" ? "没有可用真实海水，控水只能普通回退" : "尚无本场公开记录"}。双方原身体相距2米，原干燥出口开放，无追逐。</p>
      <details className="seer-fold"><summary>本场范围与战斗代价</summary>
        <p>{encounter.story}</p>
        {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
        <p>有限风、水与旧强雷使用各自实际灵性及原掌握。资源或真实水源不足时普通回退，不免费施术；伤势与死亡仍由共同轮盘结算。</p>
        <p>本场施术区没有第三人；这是当前净空场况，不是全游戏自动排除友军伤害。旧艇与原划手不被卷入或复制到此处。</p>
      </details>
    </section>;
  }
  function attemptFacts(entry: NonNullable<SeaKingProjection["life"]["currentAttempt"]>, index: number) {
    return <article key={index}>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "能力辅助后实际完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"} · {entry.closed ? "本次已收束" : "本次尚未收束"}。</p>
      {entry.abilityTier && <p>本案唯一能力判定：{TIER[entry.abilityTier]}。{failedTier(entry.abilityTier) && "失败与实付成本保留，不能重骰；仍可普通完成或退出。"}</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人普通行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}。</p>
      {(entry.boatTravelMetres > 0 || entry.orinEnergySpent > 0) && <p>本次原艇实走 {entry.boatTravelMetres} 米 · 奥林实付精力 {entry.orinEnergySpent}。</p>}
      {(entry.hookWear > 0 || entry.windlassWear > 0) && <p>本次原短钩磨损 {entry.hookWear} · 原卷具磨损 {entry.windlassWear}；不会因收束补回。</p>}
      <p>{entry.inspected ? "已实际检查原人、原物与出口。" : "尚未完成最终检查。"}</p>
    </article>;
  }
  function sceneFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    return <section aria-label="海王原人原物与普通退路"><h4>当前原人、原物与实际位置</h4>
      <p>本人在{LOCATION[life.playerLocation]} · 实际累计行走 {life.playerTravelMetres} 米 · 原现场累计 {life.clockSeconds} 秒。</p>
      <p>{life.selma.name} · {life.selma.age}岁 · {life.selma.id} · 当前在{LOCATION[life.selma.location]}。本次物主许可：{attempt ? CONSENT[attempt.ownerConsent] : "尚无本次已保存许可"}。{!life.selma.willing && "原主人当前不愿继续。"}</p>
      <p>同一原海图 {life.chart.id} 在{LOCATION[life.chart.location]}；{attempt?.chartRead ? "已亲自读取" : "尚未亲自读取"}。{attempt?.boundaryChecked ? `已按${life.buoys.originalCount}个原浮标实测本案${life.buoys.boundaryMetres}米有限边界` : "尚未按原浮标实测本案边界"}。</p>
      {selectedCase.id === "remote-dinghy" && <section aria-label="同一原艇与实际划手"><h4>原艇、原划手与六十米水路</h4>
        <p>{life.orin.name} · {life.orin.age}岁 · {life.orin.id} · {life.orin.present ? `当前在${LOCATION[life.orin.location]}` : "当前不在场"} · 剩余精力 {life.orin.energy} · 累计实际行程 {life.orin.travelMetres} 米。</p>
        <p>划手本次许可：{attempt ? CONSENT[attempt.orinConsent] : "尚无本次已保存许可"}。{!life.orin.willing && "奥林已拒绝继续本次用途。"}</p>
        <p>同一原艇 {life.dinghy.id} · 在{LOCATION[life.dinghy.location]} · 船上{life.dinghy.occupant === life.orin.id ? "只有同一原奥林" : "无人"} · 空载 {life.dinghy.cargoUnits} · 船体 {life.dinghy.hull} · 累计实走 {life.dinghy.travelMetres} 米。</p>
        <p>同一原缆 {life.mooring.id} · {life.mooring.tied ? "已系泊" : "尚未系回"} · 耐久 {life.mooring.durability}。{attempt?.returnedBy === "WIND" ? "本次原艇已由有限风力助返。" : attempt?.returnedBy === "OARS" ? "本次原人已普通划返。" : attempt?.rowedOut ? "本次已划到原浮标，尚无返程完成记录。" : "本次尚未实际出发，不能算作能力成功。"}</p>
        <p className="slice-muted">可在出发前拒绝；到浮标后可普通划返60米，再系原缆、下艇，本人沿4米干岸回出口。子步0行动仍实付划手精力与时间，船上原人不会同时在岸。</p>
      </section>}
      {selectedCase.id === "wet-recess" && <section aria-label="原海水与同一标牌工具"><h4>原水、原标牌与有限窗口</h4>
        <p>原凹槽 {life.recess.id} · 相连海湾 {life.recess.connectedTo} · 槽内 {life.recess.waterUnits} 单位水 · 暂移海湾 {life.recess.displacedToCove} 单位水。</p>
        <p className={attempt?.windowRemaining ? "slice-notice" : undefined}>本次窗口剩余 {attempt?.windowRemaining ?? 0} 秒 / 最多20秒 · 已实际经过 {attempt?.windowElapsed ?? 0} 秒。{attempt?.waterReturned ? "同一20单位水已回原凹槽。" : attempt?.waterMoved ? "同一原水暂在相连海湾，可随时停止令其返回。" : "本次没有移开原水，不能视为干地。"}</p>
        <p>{attempt?.assistantChecked ? "已亲眼确认原助手在干岸。" : "尚未亲眼确认原助手在干岸。"}奥林当前{life.orin.present ? `在${LOCATION[life.orin.location]}` : "不在场"}。</p>
        <p>同一原牌 {life.plate.id} · 在{LOCATION[life.plate.location]}。{attempt?.plateReturned ? "本次已亲手交回原主人。" : attempt?.plateTaken ? "本次已实际取起，仍须交还。" : "本次尚未实际取起。"}</p>
        <p>原短钩 {life.hook.id} · 在{LOCATION[life.hook.location]} · 耐久 {life.hook.durability}；原卷具 {life.windlass.id} · 在{LOCATION[life.windlass.location]} · 耐久 {life.windlass.durability}。</p>
        <p className="slice-muted">短钩在窗口内取同一原牌耗2秒、耐久1；窗口结束或能力失败可用普通卷具耗6秒、耐久2。先让原水返回，再沿4米干岸携原物回出口交还。</p>
      </section>}
      {selectedCase.id === "calm-water-record" && <section aria-label="有限水面片段与原证词"><h4>先写假说，再问原人与读签注</h4>
        <p>同一原浮桶 {life.barrel.id} · 当前在{LOCATION[life.barrel.location]}；不会因看过往移动。{attempt?.calmChecked ? "已亲眼确认当前原水面平静。" : "尚未现场确认当前水面平静。"}</p>
        <p>本次实际片段：{attempt?.calmChecked && (attempt.abilityTier === "SUCCESS" || attempt.abilityTier === "GREAT_SUCCESS") && attempt.fragments.length ? attempt.fragments.map(fragment => FRAGMENT[fragment]).join("、") : "尚无已取得的片段"}。片段本身不指认人物。</p>
        <p>当前假说：{attempt?.hypothesis ? HYPOTHESIS[attempt.hypothesis] : "尚未提出"}。{!!attempt?.hypothesisHistory.length && `原假说记录：${attempt.hypothesisHistory.map(hypothesis => HYPOTHESIS[hypothesis]).join(" → ")}。`}</p>
        <p>原人当面询问：塞尔玛{attempt?.selmaAsked ? "已问" : "未问"}、奥林{attempt?.orinAsked ? "已问" : "未问"}。原交班签注 {life.handoverRecord.id} 在{LOCATION[life.handoverRecord.location]}，{attempt?.ownerEvidenceRead ? "已亲自读取" : "尚未亲自读取"}。</p>
        <p>{attempt?.verified ? "已据真实证词及原签注核实，最初假说仍保留。" : "尚未完成原证词与签注核实，假说不是事实。"}{attempt?.recordReturned ? "原签注已亲手归还。" : life.handoverRecord.location === "PLAYER" ? "仍须保管并交还同一原签注。" : "原签注仍由原主人保管。"}</p>
        <p className="slice-muted">原观察台往返各3米，问原助手另须实际走返岸路。普通问询也能完成；看水面不改写昨天，不把片段当作定罪依据。</p>
      </section>}
      {selectedCase.observations.length > 0 && <section aria-label="本案已取得的原观察"><h4>目前已取得的证据</h4>
        <ul>{selectedCase.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
      </section>}
      {attempt && <details className="seer-fold" open={failedTier(attempt.abilityTier) || attempt.ownerConsent === "DECLINED" || attempt.orinConsent === "DECLINED"}>
        <summary>本次实际尝试与已付代价</summary><section aria-label="海王本次尝试与代价">{attemptFacts(attempt, 0)}</section>
      </details>}
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、展示、取还原物或服药。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation sea-king-panel"
    aria-label="海王原瓶服用确认" aria-busy={busy || submittedId !== null}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmation.bottle.title}</h3>
    <p>原瓶：{confirmation.bottle.id}</p><p>来源：{confirmation.bottle.source}</p><p>{confirmation.bottle.status}</p>
    <p>当前成功率 {confirmation.bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
    <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。海王序列3已有原文依据；完整配方与原著晋升仪式仍未核，本次采用独立成品与专业准备G。")}</p>
    <section className="slice-notice seer-risk" aria-label="海王服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
    <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不退。失败后须实际恢复、筹另一独立原瓶，并重新检查场地。</p>
    <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶身体性别不改变，旧伤势与能力掌握保留；灵性上限120，当前灵性不补满。旧本尼迪克特生死、原人原物与旧海岸损毁不因晋升改写。</p>
    {resources()}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="sea-king-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
      <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "sea-king-confirm-reason" : undefined}
        onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
    </div>
    <p className="slice-muted">返回只取消未提交的确认，不代替实际退出准备。提交后等待同一次保存回执，失败时保留这一原意图。</p>
    {pendingNotice}{saveNotice}
  </section>;

  return <section className="seer-panel warrior-panel sea-king-panel" aria-label="海王" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="海王当前目标">
      <span className="seer-seal">{value.promoted ? playerText("海王 · 暴君序列3（有限海域G）") : "灾难主祭4 → 海王3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">{playerText("序列3海王已核实；当前只开放有限海域实践G。下一序列2天灾尚未开放。")}</p>
    </section>
    {resources()}
    {!value.promoted && selectedBottle && <section aria-label="当前独立海王原瓶"><h4>本次原瓶</h4>
      <label>选择独立海王原瓶<select aria-label="选择独立海王原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前海王生活情境">
      <label>选择海王生活情境<select aria-label="选择海王生活情境" disabled={locked || life.insideCase || life.cases.some(entry => entry.status === "PREPARED")} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.method && <p>本次已保存准备：{selectedCase.method === "ABILITY" ? "能力方法" : "普通方法"}。</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施与报告各1行动；准备前须留足2行动。现场子步0行动，仍记录实际时间、位置、资源与原物后果。</p>
    </section>}

    {value.promoted && !encounter.inside && sceneFacts()}
    {value.promoted && encounter.inside && encounterFacts()}
    <section aria-label="海王当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {immediateActions.length ? actionList(immediateActions.filter(action => !isExit(action)), "海王公开行动") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {exitActions.length > 0 && <section aria-label="海王停止与普通收束"><h4>归还原物与普通退出</h4>
        {actionList(exitActions, "海王零行动收束")}
        <p className="slice-muted">按公开选项0行动归还、检查并沿实际路线退出；已付灵性、划手精力与原工具损耗不退。关闭页面不会代替这些动作。</p>
      </section>}
      {unavailableActions.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>
        {actionList(unavailableActions, "海王尚不可提交的步骤")}
      </details>}
    </section>

    {value.promoted && <details className="seer-fold"><summary>三项实践的原观察与结果</summary>
      <section aria-label="海王生活记录">{life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4>
        <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束现场"}。</p>
        {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
        {entry.attempts.map(attemptFacts)}
      </article>)}<p>{life.environment}</p></section>
    </details>}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary>
      <section aria-label="海王成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
        <p>{playerText("原文已核实灾难主祭4 → 海王3 → 天灾2；下一阶天灾本阶段不开放。完整配方、材料用量、调配顺序及海王晋升仪式仍未核实。")}</p>
        <p>{value.supplies}</p>
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>从灾难主祭实际晋升周起满12整周、原消化100；指导500便士，三项不同准备各1行动，当周准备另需1行动及120便士。三瓶独立成品各6200便士，或各完成五次真实劳务后800便士。</p>
        <p>当次准备：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}{playerText("。独立成品渠道、专业支持与以上全部数值均为本作G，不冒充原著完整配方或晋升仪式。")}</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>旧序列4的地震海啸仪式不会作为本阶任务重做。普通海域所有权不等于魔法掌控，域外不获得免费力量或信息。</p>
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>{playerText("有限海域能力与使用范围")}</summary>
      <section aria-label={playerText("海王能力与使用范围")}><h4>实际掌握与有限范围</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>{playerText("原文第三部58章直述序列3海王，第四部83章给出4→3→2称号链。第三部229章支持在自己掌控海域中远距离施加风力；另有排开遗迹海水、带空气同行与平静水面看有限过往的案例，仍需实际调查。")}</p>
        <p>{playerText("原文未给出本作距离、水量、消耗或初晋强度。96米边界、20水量单位及三项故事均为G限界，不直接照搬资深考特曼的强度，不授予任意历史或全海眼线。")}</p>
        <p>海神权杖是相关半神物品，详细眼线例证不能当作职业自带海生物、信徒库，也不能一律说成天使能力。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、旧本尼迪克特与原物</summary>
      <section aria-label="海王继承记录"><h4>序列4经历只读保留</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>旧本尼迪克特的生死与原棍、西尔瓦与原浮具、原绳损耗、原盘积水、原石焦痕及各处海岸真实损毁均保留；不复活、不免费复原，不重做原序列4地震海啸仪式。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>新原人的可选冲突</summary>
      {encounterFacts()}{actionList(encounterActions, "海王可选遭遇行动")}
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭海王页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
