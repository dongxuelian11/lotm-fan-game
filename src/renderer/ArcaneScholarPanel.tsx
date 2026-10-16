import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { ArcaneScholarAction, ArcaneScholarCommand, ArcaneScholarProjection } from "../domain/arcane-scholar/types";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const LOCATION: Record<string, string> = {
  PLAYER: "本人随身", BENCH_START: "原台起点", BENCH_END: "原台终点", GUARD_MARK: "原一米护架标记", YARD: "原工院", OWNER: "内尔处",
};
const LOAD: Record<string, string> = { IDLE: "未布置", ARMED: "已限位准备，尚未触发", RUNNING: "正在低载荷运行，须实际停机", STOPPED: "已经实际停机" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const failedTier = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告",
};
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["RETURN_NOTE", "STOP_LOAD", "MANUAL_STOP", "STOP_LINK", "RECYCLE_FUSE", "RETURN_ORIGINALS", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const isExit = ({ command }: ArcaneScholarAction) => EXIT_TYPES.has(command.type);
type Confirmation = { action: ArcaneScholarAction; bottle: ArcaneScholarProjection["bottles"][number]; facts: string };

export interface ArcaneScholarPanelProps {
  value: ArcaneScholarProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: ArcaneScholarCommand) => void;
  /** Closing the view never stops a load, returns an original or ends the real scene. */
  onClose?: () => void;
}

function confirmationFacts(value: ArcaneScholarProjection, action: ArcaneScholarAction) {
  return JSON.stringify({ promoted: value.promoted, preparations: value.preparations, preparedWeek: value.preparedWeek,
    bottles: value.bottles, resources: value.resources, risk: value.risk, digestion: value.digestion, currentGender: value.currentGender,
    action: { id: action.id, cost: action.cost, command: action.command } });
}

/** Only committed public facts are rendered; local selections never manufacture, recharge or move the original objects. */
export function ArcaneScholarPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: ArcaneScholarPanelProps) {
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
  const encounter = value.encounter;
  const life = value.life;
  const attempt = value.life.currentAttempt;
  const selectedCase = value.life.cases.find(entry => entry.id === life.activeCase)
    ?? value.life.cases.find(entry => entry.contactOpen || entry.status === "PREPARED")
    ?? value.life.cases.find(entry => entry.id === caseId)
    ?? value.life.cases.find(entry => entry.status !== "RESOLVED")
    ?? value.life.cases[0];
  const acquisitionActions = value.actions.filter(action => ACQUISITION_TYPES.has(action.command.type)
    && (!("bottleId" in action.command) || action.command.bottleId === selectedBottle?.id));
  const encounterActions = value.actions.filter(action => ENCOUNTER_TYPES.has(action.command.type));
  const lifeActions = value.actions.filter(action => !ACQUISITION_TYPES.has(action.command.type) && !ENCOUNTER_TYPES.has(action.command.type));
  const currentLifeActions = lifeActions.filter(action => !("caseId" in action.command) || action.command.caseId === selectedCase?.id);
  const currentActions = encounter.inside ? encounterActions : value.promoted ? currentLifeActions : acquisitionActions;
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

  function submit(action: ArcaneScholarAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: ArcaneScholarAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const selectedId = action.command.bottleId;
      const bottle = value.bottles.find(entry => entry.id === selectedId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id;
      setConfirmation({ action, bottle, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  function actionList(actions: ArcaneScholarAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `arcane-scholar-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`arcane-scholar-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="奥秘学者当前资源"><h4>当前实际资源</h4>
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
  function attemptFacts(entry: NonNullable<ArcaneScholarProjection["life"]["currentAttempt"]>, index: number) {
    const failed = failedTier(entry.analysisTier) || failedTier(entry.linkTier);
    return <div key={index}>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "实际能力完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"} · {entry.closed ? "本次已收束" : "本次尚未收束"}。</p>
      {failed && <p>本次能力尝试失败，已付成本保留。可按公开行动普通比较、本人送纸或用原手柄停机，不把失败改写为能力成功。</p>}
      {entry.recordsRead && <p>已读原制造记录；实际基准 {entry.baselines.map(sample => `第${sample.sample}次：${sample.transferSeconds}秒、${sample.openingMm}毫米`).join("；") || "尚未测量"}。</p>}
      {entry.analysisTier && <p>有限解析：{TIER[entry.analysisTier]}。{entry.boundedSetting ?? "尚无本次有限匹配设置。"}</p>}
      {entry.linkTier && <p>有限协同：{TIER[entry.linkTier]} · {entry.linkStopped ? "已明确停止" : entry.linkRemainingSeconds > 0 ? `剩余${entry.linkRemainingSeconds}秒` : "没有持续协同"}。</p>}
      {entry.loadTriggered && <p>已实际触发原低载荷 · {entry.loadStopped ? entry.manualStop ? "原手柄普通停机" : "已经停止负载" : "仍需停机"} · 原熔片 {entry.fuseId}。</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人行走 {entry.ownerTravelMetres} 米 · 原盒移动 {entry.boxTravelMetres} 米。</p>
      <p>已付灵性 {entry.spiritualitySpent} · 原盒储能消耗 {entry.boxChargeSpent} · 原护架储能消耗 {entry.frameChargeSpent} · 原护架耐久损失 {entry.frameDurabilityLost}。</p>
      <p>原纸{entry.noteReturned ? "已实际归还" : entry.noteTaken ? "仍须实际归还" : "本次未借出"} · 原造物{entry.originalsReturned ? "已亲手取回" : "尚无本次取回记录"}。</p>
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、补能、启动协同或服药。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation arcane-scholar-panel"
    aria-label="奥秘学者原瓶服用确认" aria-busy={busy || submittedId !== null}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmation.bottle.title}</h3>
    <p>原瓶：{confirmation.bottle.id}</p><p>来源：{confirmation.bottle.source}</p><p>{confirmation.bottle.status}</p>
    <p>当前成功率 {confirmation.bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
    <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。专业准备与场地检查均为本作G；完整配方与原著晋升仪式仍未知。")}</p>
    <section className="slice-notice seer-risk" aria-label="奥秘学者服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
    <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不会退回。专业经历保留；重试须休养、筹另一独立原瓶并重新检查场地。</p>
    <p>当前角色身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶身体性别不改变，旧伤势与旧能力掌握保留；灵性上限仍为120，当前灵性不补满。两原造物不充能、不修复，旧园地不复苏，旧人不复活。</p>
    {resources()}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="arcane-scholar-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
      <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "arcane-scholar-confirm-reason" : undefined}
        onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
    </div>
    <p className="slice-muted">返回只取消未提交的确认。提交后等待同一次保存回执，失败时保留这一原意图。</p>
    {pendingNotice}{saveNotice}
  </section>;

  return <section className="seer-panel warrior-panel arcane-scholar-panel" aria-label="奥秘学者" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="奥秘学者当前目标">
      <span className="seer-seal">{value.promoted ? "奥秘学者3 · 有限研究与原物协同" : "炼金术士4 → 奥秘学者3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">{playerText("序列3编号为原文跨段推定；本次有限解析与两原件协同为本作G。完整配方、晋升仪式与新能力表仍未知。")}</p>
    </section>
    {resources()}

    {!value.promoted && selectedBottle && <section aria-label="当前独立奥秘学者原瓶"><h4>本次原瓶</h4>
      <label>选择独立奥秘学者原瓶<select aria-label="选择独立奥秘学者原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}

    {value.promoted && <section aria-label="两件唯一原造物"><h4>仍是原盒与原护架</h4>
      {life.creations.length ? <dl className="seer-facts">{life.creations.map(original => <div key={original.id}>
        <dt>{original.kind === "MESSENGER_BOX" ? "原小轮盒" : "原护架"} · {original.id}</dt>
        <dd>储能 {original.charge} / 3 · 耐久 {original.durability} / 100 · {LOCATION[original.location] ?? original.location} · {original.active ? "正在赋灵" : "已停用"}</dd>
      </div>)}</dl> : <p>当前没有已保存的原造物；页面不会生成替代件。</p>}
      <p className="slice-muted">两件原物各只有一份，生活与战斗共用这份储能、耐久和位置。补能须原物随身、停用且未损坏；1行动、40便士和3灵性补至3次，不修复耐久。</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前奥秘学者生活情境">
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.method && <p>本次已保存准备：{selectedCase.method === "ABILITY" ? "能力方法" : "普通方法"}。</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">普通方法同样可完成；掌握只记录实际能力成功。关闭页面不会停机、归还原纸或取回原造物。</p>
    </section>}
    {value.promoted && !encounter.inside && <section aria-label="奥秘学者当前原场"><h4>眼前原台与本次事实</h4>
      <p>{life.workbenchId} · 本人在{LOCATION[life.ownerNode]}{attempt && ` · 实际经过 ${attempt.elapsedSeconds} 秒`}。原台起止相隔2米，护架作业标记距起点一米。</p>
      {selectedCase && selectedCase.id !== "tolerance-map" && <p>内尔（38岁，AR3-NELL）：{attempt?.consented ? "已知情同意本次限定实践" : "尚无本次已保存同意"}。海伦娜旧包裹和黄铜片的同意不延续到此案。</p>}
      {selectedCase?.id === "tolerance-map" && <section aria-label="实际资料与有限研究"><h4>先取得资料，再作有限比较</h4>
        <p>{attempt?.recordsRead ? "已实际阅读两原件的原制造记录。" : "尚未实际阅读本次制造记录，不能凭空取得结构知识。"}</p>
        {attempt?.baselines.length ? <ul>{attempt.baselines.map(sample => <li key={sample.sample}>第{sample.sample}次普通基准：原盒往返 {sample.boxTravelMetres} 米，移送用时 {sample.transferSeconds} 秒，开口 {sample.openingMm} 毫米。</li>)}</ul>
          : <p>尚无本次基准读数，须实际测量。</p>}
        <p>{attempt?.analysisTier ? `本次有限解析：${TIER[attempt.analysisTier]}。` : "尚未尝试有限解析。"}</p>
        {attempt?.boundedSetting ? <p>实际取得的有限设置：{attempt.boundedSetting}</p> : <p>尚未取得有限匹配设置；页面不会提供隐藏答案。</p>}
        <p className="slice-muted">研究只针对已读记录和两次可见测量。失败后可普通比较原读数，不是读出隐藏真相或制造新装备。</p>
      </section>}
      {selectedCase?.id === "timed-transfer" && <section aria-label="唯一受托原测试纸"><h4>原纸实际在谁手里</h4>
        <p>{life.note.id} · 所有人内尔（{life.note.owner}） · {life.note.custodian === "AR3-NELL" ? "内尔保管" : life.note.custodian === "PLAYER" ? "本人持有" : "唯一原盒承载"} · {LOCATION[life.note.location]}。</p>
        <p>{attempt?.noteDelivered ? "已经实际送达原台终点。" : "本次尚无实际送达记录。"}{attempt?.noteReturned ? "原纸已亲手归还内尔。" : "结束前仍须核对并归还同一原纸。"}</p>
        <p className="slice-muted">协同失败仍可本人普通持纸走完2米，送达和归还是两件实际动作；没有另一张纸或额外搬运者。</p>
      </section>}
      {selectedCase?.id !== "tolerance-map" && <section aria-label="有限协同当前状态"><h4>只连接在场的两原件</h4>
        <p>{attempt?.linkTier ? `本次协同检定：${TIER[attempt.linkTier]}。` : "本次尚未启动协同。"}
          {attempt?.linkStopped ? "已经明确停止。" : attempt && attempt.linkRemainingSeconds > 0 ? `剩余 ${attempt.linkRemainingSeconds} 秒。` : "当前没有持续协同。"}</p>
        <p className="slice-muted">{playerText("30秒与6米为本作G上限。一次启动实际消耗5灵性和两原件各1储能；失败不退成本，可停止并普通收束。")}</p>
      </section>}
      {selectedCase?.id === "fault-isolation" && <section aria-label="原低载荷装置与熔片"><h4>真实触发、停机与回收</h4>
        <p>原装置 {life.load.deviceId} · {LOAD[life.load.status]}。普通原手柄 {life.load.handleId} 始终保留实际停机退路。</p>
        <p>{attempt?.loadTriggered ? "本次已实际触发低载荷。" : "本次尚未实际触发低载荷。"}{attempt?.loadStopped ? attempt.manualStop ? "本人已用原手柄普通停机。" : "本次已实际停止负载。" : "尚无本次停机完成记录。"}</p>
        {attempt?.fuseId ? life.fuses.filter(fuse => fuse.id === attempt.fuseId).map(fuse => <p key={fuse.id}>本次原熔片 {fuse.id} · 已付 {fuse.paidPennies}便士 · {fuse.consumed ? "已实际消耗" : "尚未消耗"} · {fuse.location === "RECYCLING_BOX" ? "已拆下，放入原回收盒" : "仍在原装置，结束前须拆下回收"}。</p>)
          : <p>本次尚未取得原熔片；不显示免费材料或虚构消耗。</p>}
        <p className="slice-muted">能力失败仍保留已花材料和实际耐久损失，原手柄0行动可停机。停机、回收熔片和取回原件须分别完成。</p>
      </section>}
      {attempt && <details className="seer-fold" open={failedTier(attempt.analysisTier) || failedTier(attempt.linkTier)}>
        <summary>本次实际尝试与已付代价</summary><section aria-label="奥秘学者本次尝试与代价">{attemptFacts(attempt, 0)}</section>
      </details>}
    </section>}

    <section aria-label="奥秘学者当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {currentActions.length ? actionList(currentActions.filter(action => !isExit(action)), "奥秘学者公开行动") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {exitActions.length > 0 && <section aria-label="奥秘学者停止与普通退路"><h4>停止与普通退路</h4>{actionList(exitActions, "奥秘学者普通收束行动")}
        <p className="slice-muted">停机、停用协同、还纸与取回原件须按实际情况完成；关闭页面不会代替这些动作，已付成本不退。</p>
      </section>}
    </section>

    {value.promoted && life.cases.length > 0 && <details className="seer-fold"><summary>三项研究情境与原尝试记录</summary>
      <section aria-label="奥秘学者生活记录"><h4>选择情境或回看实际结果</h4>
        <label>选择奥秘学者生活情境<select aria-label="选择奥秘学者生活情境" disabled={locked || life.insideCase || life.cases.some(entry => entry.status === "PREPARED")} value={selectedCase?.id ?? ""} onChange={event => setCaseId(event.target.value)}>
          {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
        </select></label>
        {life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4><p>{entry.story}</p>
          <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束现场"} · {entry.returned ? "已实际归位" : "尚无本项归位记录"}。</p>
          {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
          {entry.attempts.map(attemptFacts)}
        </article>)}<p>{life.source}</p><p>{life.environment}</p>
      </section>
    </details>}
    {value.promoted && <details className="seer-fold"><summary>原造物来源、实际补能与材料</summary>
      <section aria-label="奥秘学者原物与补能记录">
        {life.creations.map(original => <article key={original.id}><h4>{original.id}</h4><p>{original.source}</p><p>第{original.manufacturedWeek}周亲手制造 · 原部件 {original.componentIds.join("、")}。</p></article>)}
        {life.recharges.length ? <ul>{life.recharges.map(entry => <li key={entry.id}>第{entry.week}周 · {entry.objectId} · 原补能材料 {entry.materialId}：{entry.source}。已付{entry.paidPennies}便士和{entry.spiritualitySpent}灵性，材料已消耗；储能 {entry.previousCharge}→{entry.resultingCharge}，耐久 {entry.durabilityBefore}→{entry.durabilityAfter}。</li>)}</ul> : <p>本阶尚无实际补能记录；低储能不会因开页或晋升自动补齐。</p>}
        {life.fuses.map(fuse => <p key={fuse.id}>第{fuse.week}周原熔片 {fuse.id} · {fuse.source} · 已付{fuse.paidPennies}便士 · {fuse.consumed ? "已经消耗" : "尚未消耗"} · {fuse.location === "RECYCLING_BOX" ? "原回收盒" : "原装置"}。</p>)}
      </section>
    </details>}

    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary>
      <section aria-label="奥秘学者成品与配方边界"><h4>{playerText("专业支持与独立成品")}</h4>
        <p>{playerText("序列3编号由原文不同段落跨段推定，没有本次直接编号句；完整配方、材料用量、原著晋升仪式与新能力表仍未知。三项专业准备与当周场地检查不冒称原著仪式。")}</p>
        <p>{value.supplies}</p>{value.story && <p>{value.story}</p>}
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>从炼金术士实际晋升周起须满12整周、原消化100；专业指导500便士，三项不同准备各1行动，当周场地检查另需1行动及120便士。</p>
        <p>当次场地检查：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}。</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、旧园地与旧人记录</summary>
      <section aria-label="奥秘学者继承记录"><h4>已经发生的旧经历</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>旧园地、旧原人、旧委托与旧瓶均按已保存记录保留。晋升不复苏原园地，不复活旧奥斯里克，不重造原盒、原架或已归还的受托物。</p>
      </section>
      <section aria-label="奥秘学者能力边界"><h4>本阶有限能力与实际掌握</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>{playerText("给自制物注入有限生命与抽取区域生命的仪式仍归炼金术士4；本阶新增解析、协同均明确为本作G。没有万能制造、免费神器、永久独立灵魂或无限军团；序列2名称与能力本次未核。")}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && encounter.enemy && <details className="seer-fold" open={encounter.inside}><summary>新原人的可选冲突</summary>
      <section aria-label="奥秘学者原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
        <p>{encounter.enemy.name} · {encounter.enemy.age}岁 · {encounter.enemy.id}{playerText(" · 本场G序列")}{encounter.enemy.sequence}等效。</p>
        <p>健康 {encounter.enemy.health} · 精神 {encounter.enemy.mind} · 独立灵性 {encounter.enemy.spirituality} · {encounter.enemy.status === "DEAD" ? "已经真实死亡" : encounter.enemy.status === "SURRENDERED" ? "已投降停止抵抗，仍是原人" : "仍有独立意志"}。</p>
        <p>他自己的原棍 {encounter.enemy.weaponId} · {encounter.enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原院"}。</p>
        <ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
        <p>科尔温是本次新原人，与旧奥斯里克分别保存。交谈时仅携入本人当时实际持有且已停用的原件；普通离场须带回实际携入物，死亡则原物留场。没有复制原棍、额外库存或复活。</p>
        {!encounter.inside && actionList(encounterActions, "奥秘学者可选遭遇行动")}
      </section>
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭奥秘学者页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
