import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { InsightScholarAction, InsightScholarCommand, InsightScholarProjection } from "../domain/insight-scholar/types";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "本次尚未当面询问", GRANTED: "已当面同意本次有限用途", DECLINED: "已拒绝本次用途", REVOKED: "本次同意已撤回", CLOSED: "本次许可已结束" };
const LOCATION: Record<string, string> = { EXIT: "原入口与普通出口", DESK: "原桌", BENCH: "原校验台", JUNCTION: "原转角", STORE: "原库房", OWNER: "原主人处", PLAYER: "本人手中" };
const HYPOTHESIS = { COPY_ERROR: "抄件漏记", MISSING_DELIVERY: "交付缺失" };
const PREDICTION = { LIT: "亮灯", DARK: "不亮" };
const ROUTE = { SHORT: "旧记录中的短廊", SIDE: "六米普通旁路" };
const failedTier = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["RETURN_PAPERS", "RETURN_BOX", "RETURN_PLAYER", "RETURN_PARCEL", "INSPECT", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const isExit = ({ command }: InsightScholarAction) => EXIT_TYPES.has(command.type);
type Confirmation = { action: InsightScholarAction; bottle: InsightScholarProjection["bottles"][number]; facts: string };

export interface InsightScholarPanelProps {
  value: InsightScholarProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: InsightScholarCommand) => void;
  /** Dismissing the view does not return an original object or leave the actual scene. */
  onClose?: () => void;
}

function confirmationFacts(value: InsightScholarProjection, action: InsightScholarAction) {
  return JSON.stringify({ promoted: value.promoted, preparations: value.preparations, preparedWeek: value.preparedWeek,
    bottles: value.bottles, resources: value.resources, risk: value.risk, digestion: value.digestion,
    currentGender: value.currentGender, action: { id: action.id, cost: action.cost, command: action.command } });
}

/** Public saved facts and typed intents are the only source of scene and resource changes. */
export function InsightScholarPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: InsightScholarPanelProps) {
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
  const inheritedActions = value.actions.filter(action => action.command.type === "MAKE_INHERITED_FLASH");
  const lifeActions = value.actions.filter(action => action.command.type !== "MAKE_INHERITED_FLASH" && !ACQUISITION_TYPES.has(action.command.type) && !ENCOUNTER_TYPES.has(action.command.type)
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

  function submit(action: InsightScholarAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: InsightScholarAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const selectedId = action.command.bottleId;
      const bottle = value.bottles.find(entry => entry.id === selectedId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id;
      setConfirmation({ action, bottle, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  function actionList(actions: InsightScholarAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `insight-scholar-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`insight-scholar-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="洞悉者当前资源"><h4>当前实际资源</h4>
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
    return <section aria-label="洞悉者原人遭遇"><h4>{encounter.title}</h4>
      {enemy && <>
        <p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 本场原创G序列")}{enemy.sequence}等效。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} · {enemy.status === "DEAD" ? "已经真实死亡" : enemy.status === "SURRENDERED" ? "已投降停止抵抗" : "仍有独立意志"}。</p>
        <p>本场实际亲见方法：{enemy.seenPowers.length ? enemy.seenPowers.map(power => power === "FLASH" ? "闪光（FLASH）" : "护术（WARD）").join("、") : "尚无"}。</p>
        <p>自己的原棍 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原院"}。新阿尔顿与旧哈罗德分别保存。</p>
      </>}
      <p>双方原身体相距2米，净空原庭的普通出口开放，无追逐；可以先交谈，再选择是否开战。</p>
      <details className="seer-fold"><summary>本场范围与战斗代价</summary>
        <p>{encounter.story}</p>
        {encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
        <p>方法辨析只比较本场已亲眼见到的实际施法，不预读下一动作，不自动复制能力。尚无实见时按普通避让回退。</p>
        <p>旧片段预见仍须解释，旧有限模仿只用实际学会的方法；微光片必须消费库存中同一原件。资源不足时按普通动作回退，胜败与伤势仍由共同轮盘结算。</p>
      </details>
    </section>;
  }
  function attemptFacts(entry: NonNullable<InsightScholarProjection["life"]["currentAttempt"]>, index: number) {
    return <article key={index}>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "能力辅助后实际完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"} · {entry.closed ? "本次已收束" : "本次尚未收束"}。</p>
      {entry.abilityTier && <p>本案唯一能力判定：{TIER[entry.abilityTier]}。{failedTier(entry.abilityTier) && "失败结果与实付成本保留，不能重骰；仍可普通核对、修正并收束。"}</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人普通行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent}。</p>
      <p>{entry.inspected ? "已实际检查原人、原物与出口。" : "尚未完成最终检查。"}</p>
    </article>;
  }
  function sceneFacts() {
    if (!selectedCase) return null;
    return <section aria-label="洞悉者原人原物与普通退路"><h4>当前原人、原物与实际位置</h4>
      <p>本人在{LOCATION[life.playerLocation]} · 实际累计行走 {life.playerTravelMetres} 米 · 原现场累计 {life.clockSeconds} 秒。</p>
      <p>{life.fenna.name} · {life.fenna.age}岁 · {life.fenna.id} · 当前在{LOCATION[life.fenna.location]}。{!life.fenna.willing && "芬娜当前不愿继续本次用途。"}</p>
      <p>本次物主许可：{attempt ? CONSENT[attempt.ownerConsent] : "尚无本次已保存许可"}{attempt?.ownerConsentWeek == null ? "" : `，第${attempt.ownerConsentWeek}周记录`}。</p>
      {selectedCase.id === "copy-discrepancy" && <section aria-label="两张原纸与待核假说"><h4>比较两份原件，再核实假说</h4>
        <p>原件 {life.original.id} · 归 {life.original.owner} 所有 · 当前在{LOCATION[life.original.location]}。</p>
        <p>抄件 {life.copy.id} · 归 {life.copy.owner} 所有 · 当前在{LOCATION[life.copy.location]}。</p>
        <p>{attempt?.readBoth ? "已亲手取读两张原纸。" : "尚未亲手取读两张原纸。"}{attempt?.manualCompared ? "已逐行人工核对。" : attempt?.compared ? "已完成本次有限比较。" : "尚未完成比较。"}</p>
        <p>当前假说：{attempt?.hypothesis ? HYPOTHESIS[attempt.hypothesis] : "尚未提出"}。</p>
        {!!attempt?.hypothesisHistory.length && <p>实际假说记录：{attempt.hypothesisHistory.map(value => HYPOTHESIS[value]).join(" → ")}。</p>}
        <p>{attempt?.ownerEvidenceRead ? "已当面读取原主人的交接签注。" : "尚未当面取得原交接签注，假说还不是事实。"}
          {attempt?.verified ? "已据原件与真实签注完成核实。" : "尚未完成最终核实。"}</p>
        <p>{attempt?.papersReturned ? "两张同一原纸已亲手归还原桌。" : "本次两张原纸尚无归还完成记录。"}</p>
        <p className="slice-muted">关联只给出有限比较提示，不判定谁说谎；可根据新证据修正原假说。结束前须把两张原纸还到原桌，再实际走回出口。</p>
      </section>}
      {selectedCase.id === "known-method" && <section aria-label="同一原示范匣与预测复核"><h4>同一示范匣，两次实际展示</h4>
        <p>{life.osric.name} · {life.osric.age}岁 · {life.osric.id} · {life.osric.present ? "本人当前在场" : "本人当前不在场"} · {life.osric.willing ? "可当面询问本次展示" : "本人已拒绝继续展示"}。</p>
        <p>记录员本次许可：{attempt ? CONSENT[attempt.recorderConsent] : "尚无本次已保存许可"}。{attempt?.recordRead ? "已亲自读取原操作记录。" : "尚未亲自读取原操作记录。"}</p>
        <p>原示范匣 {life.box.id} · 归 {life.box.owner} 所有 · 当前在{LOCATION[life.box.location]}。</p>
        <p>原匣剩余储能 {life.box.charges} / 2 · 累计实际展示 {life.box.demonstrations} 次。</p>
        <p>{attempt?.firstDemoSeen ? "已亲眼看见原人第一次操作亮灯，原匣已真实消耗一格储能。" : "尚未亲眼观察第一次实际展示。"}</p>
        <p>已保存预测：{attempt?.prediction ? PREDICTION[attempt.prediction] : "尚未提出"}。</p>
        <p>{attempt?.secondDemoSeen ? "原人已操作同一原匣完成第二次展示。" : "第二次实际展示尚未发生，预测还不是结果。"}
          {attempt?.observedResult ? `已实际观察结果：${PREDICTION[life.box.output]}。` : "尚未完成结果观察。"}
          {attempt?.revised ? "已依据实际结果完成预测复核，最初预测仍保留。" : "尚未完成预测复核。"}</p>
        <p>{attempt?.boxReturned ? "同一原匣已实际归还；剩余储能按原记录保留。" : "本次同一原匣尚无归还完成记录。"}</p>
        <p className="slice-muted">先读原操作记录与观察，再提出预测、观察结果并复核。只使用原匣的两格储能，不免费充能、不复制匣的能力；结束前归还同一原匣。</p>
      </section>}
      {selectedCase.id === "revised-route" && <section aria-label="旧记录与当前原路"><h4>旧记录、当前封栏与普通旁路</h4>
        <p>原路线记录 {life.routeRecord.id} · 归 {life.routeRecord.owner} 所有 · 仍在{LOCATION[life.routeRecord.location]}。</p>
        <p>{attempt?.oldRouteRead ? "已亲自读取旧路线记录。" : "尚未亲自读取旧路线记录。"}</p>
        <p>原转角距入口2米，普通旁路从转角到原库房6米；本人须实际走到现场核查。</p>
        <p>{attempt?.scouted ? `已亲眼查看原封栏 ${life.barrier.id}：${life.barrier.state === "CLOSED" ? "仍关闭" : life.barrier.state}。` : "尚未亲自侦察转角，旧记录不能保证当前可通行。"}</p>
        <p>本次实际选择：{attempt?.route ? ROUTE[attempt.route] : "尚未选择路线"}。
          {attempt?.shortBlocked && (life.playerLocation === "JUNCTION" ? "原短廊实际被挡，本人仍在转角，可改走普通旁路。" : "本次曾实际遇到短廊封挡；当前原位置按上方记录保留。")}</p>
        {!!attempt?.routeHistory.length && <p>已保存路线选择：{attempt.routeHistory.map(value => ROUTE[value]).join(" → ")}。</p>}
        <p>同一原包 {life.parcel.id} · 归 {life.parcel.owner} 所有 · 当前在{LOCATION[life.parcel.location]}。</p>
        <p>{attempt?.parcelTaken ? "本次已亲手取得同一原包。" : "本次尚无实际取包记录。"}{attempt?.parcelReturned ? "已亲手交回原主人。" : "本次原包尚无交还完成记录。"}</p>
        <p className="slice-muted">只核对旧记录与当前所见，不遥知原包内容，也不让封栏凭能力打开。取包后须实际走回6米旁路和2米入口，再亲手交给主人。</p>
      </section>}
      {selectedCase.observations.length > 0 && <section aria-label="本案已取得的原观察"><h4>目前已取得的证据</h4>
        <ul>{selectedCase.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
      </section>}
      {attempt && <details className="seer-fold" open={failedTier(attempt.abilityTier) || attempt.ownerConsent === "DECLINED" || attempt.recorderConsent === "DECLINED"}>
        <summary>本次实际尝试与已付代价</summary><section aria-label="洞悉者本次尝试与代价">{attemptFacts(attempt, 0)}</section>
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

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation insight-scholar-panel"
    aria-label="洞悉者原瓶服用确认" aria-busy={busy || submittedId !== null}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmation.bottle.title}</h3>
    <p>原瓶：{confirmation.bottle.id}</p><p>来源：{confirmation.bottle.source}</p><p>{confirmation.bottle.status}</p>
    <p>当前成功率 {confirmation.bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
    <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。名称与序列3对应、三项新增实践均为候选G；完整配方与原著晋升仪式仍未核。")}</p>
    <section className="slice-notice seer-risk" aria-label="洞悉者服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
    <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不退。失败后须实际恢复、筹另一独立原瓶，并重新检查场地。</p>
    <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶身体性别不改变，旧伤势与能力掌握保留；灵性上限120，当前灵性不补满。旧哈罗德结局、原人原物及微光片库存不因晋升改写。</p>
    {resources()}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="insight-scholar-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
      <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "insight-scholar-confirm-reason" : undefined}
        onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
    </div>
    <p className="slice-muted">返回只取消未提交的确认，不代替实际退出准备。提交后等待同一次保存回执，失败时保留这一原意图。</p>
    {pendingNotice}{saveNotice}
  </section>;

  return <section className="seer-panel warrior-panel insight-scholar-panel" aria-label="洞悉者" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="洞悉者当前目标">
      <span className="seer-seal">{value.promoted ? playerText("洞悉者 · 阅读者序列3") : playerText("预言家4 → 洞悉者3")}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">{playerText("本阶段开放三项有限实践；晋升须取得独立成品并完成专业准备。")}</p>
    </section>
    {resources()}
    {!value.promoted && selectedBottle && <section aria-label="当前独立洞悉者原瓶"><h4>本次原瓶</h4>
      <label>选择独立洞悉者原瓶<select aria-label="选择独立洞悉者原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前洞悉者生活情境">
      <label>选择洞悉者生活情境<select aria-label="选择洞悉者生活情境" disabled={locked || life.insideCase || life.cases.some(entry => entry.status === "PREPARED")} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.method && <p>本次已保存准备：{selectedCase.method === "ABILITY" ? "能力方法" : "普通方法"}。</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施与报告各1行动；准备前须留足2行动。现场子步0行动，仍记录实际时间、位置、资源与原物后果。</p>
    </section>}

    {value.promoted && !encounter.inside && sceneFacts()}
    {value.promoted && encounter.inside && encounterFacts()}
    <section aria-label="洞悉者当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {currentActions.length ? actionList(currentActions.filter(action => !isExit(action)), "洞悉者公开行动") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {exitActions.length > 0 && <section aria-label="洞悉者停止与普通收束"><h4>归还原物与普通退出</h4>
        {actionList(exitActions, "洞悉者零行动收束")}
        <p className="slice-muted">按公开选项0行动归还、检查并沿实际路线退出；已付灵性与原匣储能不退。关闭页面不会代替这些动作。</p>
      </section>}
    </section>

    {value.promoted && <details className="seer-fold"><summary>三项实践的原观察与结果</summary>
      <section aria-label="洞悉者生活记录">{life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4>
        <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束现场"}。</p>
        {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
        {entry.attempts.map(attemptFacts)}
      </article>)}<p>{life.environment}</p></section>
    </details>}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary>
      <section aria-label="洞悉者成品与配方边界"><h4>{playerText("当前能力与使用范围")}</h4>
        <p>{playerText("本阶段可尝试有限证据关联与方法辨析；仍须依靠当前原件、原人和现场。晋升使用独立成品，并须完成专业准备。")}</p>
        <p>{value.supplies}</p>
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>从预言家实际晋升周起须满12整周、原消化100；指导500便士，三项不同准备各1行动，当周准备另需1行动及120便士。三瓶独立成品各6200便士，或各完成五次真实劳务后800便士。</p>
        <p>当次准备：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}{playerText("。上述供给与准备为本作G。")}</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>旧序列4预言仍是待解释的有限片段与梦象。这里不提供全知真相、任意弱点、自动复制或新技能库，能力提示不能代替原件、原人和当前现场。</p>
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、旧哈罗德与原物</summary>
      <section aria-label="洞悉者继承记录"><h4>旧人原物仍是原记录</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>旧哈罗德的健康、抵抗状态与原棍，诺拉、埃德温、乔纳斯的原物后果均按已保存记录保留。微光片保留原编号、来源及消费历史，不因晋升补发。</p>
      </section>
      <section aria-label="洞悉者能力与实际掌握"><h4>实际能力掌握</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>{playerText("证据关联与方法辨析均为本作G；实际掌握和使用范围以已保存事实为准。")}</p>
      </section>
      {value.promoted && !encounter.inside && inheritedActions.length > 0 && <section aria-label="沿用旧微光片工艺"><h4>沿用原工艺与真实成本</h4>
        {actionList(inheritedActions, "洞悉者继承制作行动")}
      </section>}
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>新原人的可选冲突</summary>
      {encounterFacts()}{actionList(encounterActions, "洞悉者可选遭遇行动")}
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭洞悉者页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
