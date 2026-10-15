import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { FearBishopAction, FearBishopCommand, FearBishopProjection } from "../domain/fear-bishop/types";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "本次尚未当面询问", GRANTED: "已当面同意本次有限用途", DECLINED: "已拒绝本次用途", REVOKED: "本次同意已撤回", CLOSED: "本次许可已结束" };
const LOCATION: Record<string, string> = { EXIT: "原普通出口", BENCH: "原隔离台", CORRIDOR_ENTRANCE: "原廊口", STORE: "原库房", OWNER: "伊迪丝本人处", PLAYER: "本人手中", CHAIR: "原座椅", CONTAINER: "原玻璃容器内", NONE: "已消散，无可返回原件" };
const RESIDUE_STATUS: Record<string, string> = { CONTAINED: "仍在原容器内", ON_BENCH: "仍在原隔离台", DISSOLVED: "已真实消散，不可恢复", SEALED: "同一原件已普通封存" };
const TRACE_STATUS: Record<string, string> = { PRESENT: "原痕迹仍在", DISSOLVED: "已真实消散", ISOLATED: "原痕迹仍在，已用原遮板隔离" };
const failedTier = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP", "WAKE", "CONFIRM_WAKE", "LEAVE_VOLUNTEER", "SEAL_RESIDUE", "RETURN_CONTAINER", "ISOLATE_TRACE", "RETURN_PLAYER", "RETURN_LAMP", "INSPECT", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const isExit = ({ command }: FearBishopAction) => EXIT_TYPES.has(command.type);
type Confirmation = { action: FearBishopAction; bottle: FearBishopProjection["bottles"][number]; facts: string };

export interface FearBishopPanelProps {
  value: FearBishopProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: FearBishopCommand) => void;
  /** Dismissing the view does not wake anyone, return an original or leave a real scene. */
  onClose?: () => void;
}

function confirmationFacts(value: FearBishopProjection, action: FearBishopAction) {
  return JSON.stringify({ promoted: value.promoted, preparations: value.preparations, preparedWeek: value.preparedWeek,
    bottles: value.bottles, resources: value.resources, risk: value.risk, digestion: value.digestion,
    currentGender: value.currentGender, action: { id: action.id, cost: action.cost, command: action.command } });
}

/** Public saved facts and typed intents are the only source of scene and resource changes. */
export function FearBishopPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: FearBishopPanelProps) {
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
  const attempt = life.currentAttempt;
  const selectedCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === "PREPARED")
    ?? life.cases.find(entry => entry.id === caseId)
    ?? life.cases.find(entry => entry.status !== "RESOLVED") ?? life.cases[0];
  const acquisitionActions = value.actions.filter(action => ACQUISITION_TYPES.has(action.command.type)
    && (!("bottleId" in action.command) || action.command.bottleId === selectedBottle?.id));
  const encounterActions = value.actions.filter(action => ENCOUNTER_TYPES.has(action.command.type));
  const lifeActions = value.actions.filter(action => !ACQUISITION_TYPES.has(action.command.type) && !ENCOUNTER_TYPES.has(action.command.type)
    && (!("caseId" in action.command) || action.command.caseId === selectedCase?.id));
  const currentActions = encounter.inside ? encounterActions : value.promoted ? lifeActions : acquisitionActions;
  const exitActions = currentActions.filter(isExit);
  const nextAction = currentActions.find(action => action.enabled && action.command.type === "CONSUME")
    ?? currentActions.find(action => action.enabled && !isExit(action))
    ?? currentActions.find(action => action.enabled) ?? currentActions[0];

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

  function submit(action: FearBishopAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: FearBishopAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const selectedId = action.command.bottleId;
      const bottle = value.bottles.find(entry => entry.id === selectedId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id;
      setConfirmation({ action, bottle, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  function actionList(actions: FearBishopAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `fear-bishop-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`fear-bishop-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="恐惧主教当前资源"><h4>当前实际资源</h4>
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
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="恐惧主教原人遭遇"><h4>{encounter.title}</h4>
      {enemy && <>
        <p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 本场G序列")}{enemy.sequence}等效。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} · {enemy.status === "DEAD" ? "已经真实死亡" : enemy.status === "SURRENDERED" ? "已投降停止抵抗" : "仍有独立意志"}。</p>
        <p>自己的原棍 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原院"}。新哈兰与旧布拉姆分别保存。</p>
      </>}
      <p>{encounter.story}</p>
      <details className="seer-fold"><summary>本场范围与战斗代价</summary>
        {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
        <p>双方只用共同战斗轮盘。安眠恐惧是可抵抗的有限压力，不是全场即死或永久削减意志；敌方专注可以抵抗本轮下一次压力。</p>
        <p>只可使用早先实际取得、仍在的同一个原卷叶。派出与协助占各自合法槽，实际召回记入原历史；没有原灵或资源不足时按普通动作回退。</p>
      </details>
    </section>;
  }
  function attemptFacts(entry: NonNullable<FearBishopProjection["life"]["currentAttempt"]>, index: number) {
    return <article key={index}>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "实际能力完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"} · {entry.closed ? "本次已收束" : "本次尚未收束"}。</p>
      {entry.abilityTier && <p>本案唯一能力判定：{TIER[entry.abilityTier]}。{failedTier(entry.abilityTier) && "失败结果与实付成本保留，不能重骰；可按公开选项普通收束。"}</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人普通行走 {entry.playerTravelMetres} 米。</p>
      <p>本人已付灵性 {entry.spiritualitySpent} · 托马斯已付精神 {entry.mindSpent}。停止与醒来不会退回这些代价。</p>
      <p>{entry.inspected ? "已实际检查原人、原物与出口。" : "尚未完成最终检查。"}</p>
    </article>;
  }
  function sceneFacts() {
    if (!selectedCase) return null;
    return <section aria-label="恐惧主教原人原物与普通退路"><h4>当前原人、原物与实际位置</h4>
      <p>本人在{LOCATION[life.playerLocation]} · 实际累计行走 {life.playerTravelMetres} 米 · 原现场累计 {life.clockSeconds} 秒。</p>
      {selectedCase.id !== "stop-signal" && <p>{life.edith.name} · {life.edith.age}岁 · {life.edith.id} · 当前在{LOCATION[life.edith.location]}。
        本次物主许可：{attempt ? CONSENT[attempt.ownerConsent] : "尚无本次已保存许可"}{attempt?.ownerConsentWeek == null ? "" : `，第${attempt.ownerConsentWeek}周记录`}。{!life.edith.willing && "伊迪丝当前不愿继续本次用途。"}</p>}
      {selectedCase.id === "contained-residue" && <section aria-label="唯一原凝片与原玻璃容器"><h4>有来源的无意识原凝片</h4>
        <p>{life.residue.id} · 归 {life.residue.owner} 所有 · 无生命、无独立意识。</p>
        <p>{life.residue.source}</p>
        <p>本次原记录：{attempt?.sourceRead ? "已亲自读取" : "尚未亲自读取"} · {attempt?.residuePlaced ? "已亲手放入原隔离台" : "尚未放入原隔离台"} · {attempt?.bystandersClear ? "旁人已实际撤开" : "尚未确认旁人撤开"}。</p>
        <p>原凝片：{RESIDUE_STATUS[life.residue.status]} · {LOCATION[life.residue.location]}。</p>
        <p>原玻璃容器 {life.container.id} · 归 {life.container.owner} 所有 · 当前在{LOCATION[life.container.location]}。</p>
        <p>{attempt?.containerReturned ? "本次原容器已亲手归还。" : "结束前须实际归还同一原容器；消散后归还空容器，失败则归还装着封存原凝片的容器。"}</p>
        <p className="slice-muted">仅本次物主许可、来源核对、原件放置与旁人撤开后，才可一次6灵性、知识18尝试。失败不造新凝片，成功不恢复原件；不能用于未知人物或原灵。</p>
      </section>}
      {selectedCase.id === "stop-signal" && <section aria-label="托马斯本次同意与原身体"><h4>{life.tomas.name} · 一次自愿低强体验</h4>
        <p>{life.tomas.id} · {life.tomas.age}岁成年人 · 健康 {life.tomas.health} / 100 · 精神 {life.tomas.mind} / 100。</p>
        <p>当前在{LOCATION[life.tomas.location]} · {life.tomas.state === "DROWSY" ? "原身体仍困倦，须实际醒来" : "原身体已清醒"} · 本人已实际走动 {life.tomas.travelMetres} 米。</p>
        <p>本次自愿同意：{attempt ? CONSENT[attempt.consent] : "尚无本次已保存同意"}{attempt?.consentWeek == null ? "" : `，第${attempt.consentWeek}周记录`}。{!life.tomas.willing && "托马斯当前不愿继续。"}</p>
        <p>停止口令“到此为止”：{attempt?.stopAgreed ? "本次已当面约定" : "本次尚未约定"}。</p>
        <p>有限压力：{life.tomas.effectActive ? `仍在持续，剩余 ${life.tomas.remainingSeconds} 秒` : "未生效或已经停止"}。
          {attempt?.stoppedBy ? `本次由${attempt.stoppedBy === "TOMAS" ? "托马斯本人" : "施术者"}实际叫停。` : "本次尚无主动停止记录。"}</p>
        <p>{attempt?.wakeConfirmed ? "已当面确认清醒。" : "本次尚未当面确认清醒。"}{attempt?.volunteerLeft ? "托马斯已实际走到出口。" : "托马斯尚无本次离场完成记录。"}</p>
        <p className="slice-muted">{playerText("一次5灵性、意志18；成功只短暂困倦并实耗2精神。停止立即结束本作G压力窗口，醒来与确认仍是独立步骤，精神不免费返还。必须当次知情同意，不默认对不知情的人练习。")}</p>
        {attempt?.ordinaryStory && <p>本次实际采用普通方法：由托马斯自述提前提供的虚构故事带来的感受，未将其改写成超凡成功。</p>}
        <p className="slice-muted">不读取秘密、强制真话或提供现实治疗。</p>
      </section>}
      {selectedCase.id === "corridor-exit" && <section aria-label="原灯与八米十二米实际路径"><h4>原灯与两条普通实路</h4>
        <p>{life.trace.id} · {TRACE_STATUS[life.trace.status]}。</p><p>{life.trace.source}</p>
        <p>原遮板 {life.shutter.id} · {life.shutter.location === "LOWERED" ? "已经实际放下" : "仍抬起"}。</p>
        <p>原廊8米 · 原普通侧路12米 · 本次侧路{attempt?.sideRouteChecked ? "已亲自检查" : "尚未亲自检查"}。</p>
        <p>本次实际路线：{attempt?.route === "CORRIDOR" ? "8米原廊" : attempt?.route === "SIDE" ? "12米普通侧路" : "尚未走入任一路线"}。</p>
        <p>原灯 {life.lamp.id} · 归 {life.lamp.owner} 所有 · 当前在{LOCATION[life.lamp.location]}。</p>
        <p>{attempt?.lampTaken ? "已实际取得同一原灯。" : "本次尚无实际取灯记录。"}{attempt?.lampReturned ? "已亲手交回伊迪丝。" : "本次尚无原灯归还完成记录。"}</p>
        <p className="slice-muted">一次6灵性、知识18；成功消散有来源原痕迹后走8米，失败用原遮板隔离后走12米侧路。沿实际来路返回并还灯，放弃也须普通走出；普通黑暗本身不是邪恶。</p>
      </section>}
      {attempt && <details className="seer-fold" open={failedTier(attempt.abilityTier) || attempt.consent === "REVOKED" || attempt.consent === "DECLINED"}>
        <summary>本次实际尝试与已付代价</summary><section aria-label="恐惧主教本次尝试与代价">{attemptFacts(attempt, 0)}</section>
      </details>}
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、毁弃、施压、归还或服药。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation fear-bishop-panel"
    aria-label="恐惧主教原瓶服用确认" aria-busy={busy || submittedId !== null}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmation.bottle.title}</h3>
    <p>原瓶：{confirmation.bottle.id}</p><p>来源：{confirmation.bottle.source}</p><p>{confirmation.bottle.status}</p>
    <p>当前成功率 {confirmation.bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
    <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。专业准备为本作G；完整配方与原著晋升仪式仍未知。")}</p>
    <section className="slice-notice seer-risk" aria-label="恐惧主教服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
    <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不退。失败后须实际恢复、筹另一独立原瓶，并重新检查场地。</p>
    <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶身体性别不改变，旧伤势与能力掌握保留；灵性上限120，当前灵性不补满。旧布拉姆结局与原卷叶状态不因晋升改写。</p>
    {resources()}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="fear-bishop-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
      <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "fear-bishop-confirm-reason" : undefined}
        onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
    </div>
    <p className="slice-muted">返回只取消未提交的确认，不代替实际退出准备。提交后等待同一次保存回执，失败时保留这一原意图。</p>
    {pendingNotice}{saveNotice}
  </section>;

  return <section className="seer-panel warrior-panel fear-bishop-panel" aria-label="恐惧主教" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="恐惧主教当前目标">
      <span className="seer-seal">{value.promoted ? "恐惧主教3 · 有限黑暗毁灭与安眠恐惧" : "守夜人4 → 恐惧主教3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">{playerText("恐惧主教3及安眠、恐惧结合的黑暗毁灭方向已核实；这里的有限场景与参数为本作G，完整配方与晋升仪式仍未知。")}</p>
    </section>
    {resources()}
    {!value.promoted && selectedBottle && <section aria-label="当前独立恐惧主教原瓶"><h4>本次原瓶</h4>
      <label>选择独立恐惧主教原瓶<select aria-label="选择独立恐惧主教原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前恐惧主教生活情境">
      <label>选择恐惧主教生活情境<select aria-label="选择恐惧主教生活情境" disabled={locked || life.insideCase || life.cases.some(entry => entry.status === "PREPARED")} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.method && <p>本次已保存准备：{selectedCase.method === "ABILITY" ? "能力方法" : "普通方法"}。</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施与报告各1行动；准备前须留足2行动。现场子步0行动，仍记录实际时间、位置、资源与原物后果。</p>
    </section>}

    {value.promoted && !encounter.inside && sceneFacts()}
    {value.promoted && encounter.inside && encounterFacts()}
    <section aria-label="恐惧主教当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {currentActions.length ? actionList(currentActions.filter(action => !isExit(action)), "恐惧主教公开行动") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {exitActions.length > 0 && <section aria-label="恐惧主教停止与普通收束"><h4>停止、醒来、还物与普通退出</h4>
        {actionList(exitActions, "恐惧主教零行动收束")}
        <p className="slice-muted">按公开选项0行动停止、唤醒、封存、归还及普通退出；已付精神与灵性不退。关闭页面不会代替这些动作。</p>
      </section>}
    </section>

    {value.promoted && <details className="seer-fold"><summary>三项实践的原观察与结果</summary>
      <section aria-label="恐惧主教生活记录">{life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4>
        <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束现场"}。</p>
        {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
        {entry.attempts.map(attemptFacts)}
      </article>)}<p>{life.environment}</p></section>
    </details>}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary>
      <section aria-label="恐惧主教成品与配方边界"><h4>{playerText("当前能力与使用范围")}</h4>
        <p>{playerText("黑暗序列3恐惧主教的安眠、恐惧结合与黑暗毁灭方向已核实。黑暗毁灭不等于隐秘权柄。下一阶隐秘之仆2的编号仍按人物线索推断，不展示未知完整配方或晋升仪式。")}</p>
        <p>{value.supplies}</p>{value.story && <p>{value.story}</p>}
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>从守夜人实际晋升周起须满12整周、原消化100；指导500便士，三项不同准备各1行动，当周准备另需1行动及120便士。三瓶独立成品各6200便士，或各完成五次真实劳务后800便士。</p>
        <p>当次准备：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}{playerText("。上述供给与准备为本作G。")}</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>{playerText("阿里安娜历史投影的黑潮属于天使表现，不能下放为初晋全图必中。原著存在减缓与反制；这里不据表现补出全场即死。残留凝片、短时压力与原廊痕迹均为有限原创G。")}</p>
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、旧布拉姆与原卷叶</summary>
      <section aria-label="恐惧主教继承记录"><h4>旧人原物仍是原记录</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>旧布拉姆的生死与原棍、梅森和伊尔瓦的清醒状态、原卷叶的取得、释放、再邀请及派出召回历史按已保存事实保留。晋升不会复活原人或赠送新灵。</p>
      </section>
      <section aria-label="恐惧主教能力与实际掌握"><h4>实际能力掌握</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>{playerText("有限黑暗毁灭与安眠恐惧参数为本作G；不把恐惧女妖技能直接当成本职业的独立固定公式。")}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>新原人的可选冲突</summary>
      {encounterFacts()}{actionList(encounterActions, "恐惧主教可选遭遇行动")}
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭恐惧主教页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
