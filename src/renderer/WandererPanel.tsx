import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { WandererAction, WandererCommand, WandererProjection } from "../domain/wanderer/types";
import { WANDERER_FORMULA_STATUS, WANDERER_SOURCE_STATUS } from "../domain/wanderer/content";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const CASE_STATUS: Record<string, string> = { AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告" };
const TIER: Record<string, string> = { GREAT_SUCCESS: "大成功", SUCCESS: "成功", FAILURE: "失败", GREAT_FAILURE: "严重失败" };
const CONSENT: Record<string, string> = { UNASKED: "本次尚未当面询问", GRANTED: "已同意本次有限用途", DECLINED: "已拒绝本次用途", REVOKED: "本次许可已撤回", CLOSED: "本次许可已结束" };
const LOCATION: Record<string, string> = { START: "诺拉原接待处START", PAD: "本地原锚台PAD", OFFICE: "埃利亚斯原办公室OFFICE", REMOTE: "异星原停泊舱REMOTE", OWNER: "原主人处", NORA: "诺拉本人处", PLAYER: "同一身体随身保管", OWNER_ARCHIVE: "原归档人处" };
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER"]);
const EXIT_TYPES = new Set(["STOP", "STOP_CONTACT", "RETURN_LOCAL", "RETURN_PLAYER", "RETURN_ITEMS", "RETURN_SUIT", "RETURN_ANCHOR", "RETURN_PACKET", "GO_ANCHOR", "RECOVER_ANCHOR", "INSPECT", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const isExit = ({ command }: WandererAction) => EXIT_TYPES.has(command.type);
const failedTier = (tier: string | null) => tier === "FAILURE" || tier === "GREAT_FAILURE";
type Confirmation = { action: WandererAction; facts: string; bottle?: WandererProjection["bottles"][number] };

export interface WandererPanelProps {
  value: WandererProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: WandererCommand) => void;
  /** Closing the view does not move a body, return an original item or end a scene. */
  onClose?: () => void;
}

/** Public saved facts are authoritative; this view submits typed intents without simulating travel. */
export function WandererPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: WandererPanelProps) {
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
  const publicFacts = JSON.stringify(value);
  const locked = busy || blocked || error !== null || submittedId !== null;
  const liveConfirmation = confirmation && confirmation.facts === publicFacts
    ? value.actions.find(action => action.id === confirmation.action.id) : undefined;
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
  const remoteReturn = life.playerLocation === "REMOTE" ? currentActions.find(action => action.command.type === "RETURN_LOCAL") : undefined;
  const remoteStep = life.playerLocation === "REMOTE" ? currentActions.find(action => action.enabled && ["CHECK_RETURN_MARKER", "TAKE_PACKET"].includes(action.command.type)) : undefined;
  const optionalExposure = (action: WandererAction) => ["VIEW_HORIZON", "WAIT_EXPOSURE"].includes(action.command.type);
  const nextAction = currentActions.find(action => action.enabled && action.command.type === "CONSUME")
    ?? remoteStep ?? (remoteReturn?.enabled ? remoteReturn : undefined)
    ?? currentActions.find(action => action.enabled && !isExit(action) && !optionalExposure(action))
    ?? currentActions.find(action => action.enabled && !optionalExposure(action))
    ?? remoteReturn ?? currentActions.find(action => action.enabled) ?? currentActions[0];
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

  function submit(action: WandererAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: WandererAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const id = action.command.bottleId, bottle = value.bottles.find(entry => entry.id === id);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id; setConfirmation({ action, bottle, facts: publicFacts });
    } else if (action.command.type === "DEPART" || action.command.type === "VIEW_HORIZON") {
      returnActionId.current = action.id; setConfirmation({ action, facts: publicFacts });
    } else submit(action);
  }
  function actionList(actions: WandererAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `wanderer-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`wanderer-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="漫游者当前资源"><h4>当前实际资源</h4>
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
    return <section aria-label="漫游者原人遭遇"><h4>{encounter.title}</h4>
      {enemy && <>
        <p>{enemy.name} · {enemy.age}岁 · {enemy.id}{playerText(" · 本场原创G序列")}{enemy.sequence}等效。</p>
        <p>健康 {enemy.health} · 精神 {enemy.mind} · 独立灵性 {enemy.spirituality} / 120 · {enemy.status === "DEAD" ? "已经真实死亡" : enemy.status === "SURRENDERED" ? "已投降停止抵抗" : "仍有独立意志"}。</p>
        <p>自己的唯一原杖 {enemy.weaponId} · {enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原干院"}。新卡西安与旧半神B分别保存，旧人不复活。</p>
      </>}
      {encounter.scene && <p>原场地 {encounter.scene.courtId} · 普通出口{encounter.scene.ordinaryExit === "OPEN" ? "实际开放" : "不可通行"} · 当前第三人 {encounter.scene.thirdPartiesInArea} 人 · 本人当前{encounter.scene.playerPosition === "ORIGIN" ? "仍在原位置" : "在原侧位"}。
        {encounter.scene.clearanceConfirmed ? "已实际确认净空。" : "尚未实际确认净空。"}</p>}
      <p>双方原身体初始相距2米，普通出口开放、无追逐。新原敌人的资源、原杖和结局不会由关闭页面重置。</p>
      <details className="seer-fold"><summary>本场范围与战斗代价</summary>
        <p>{encounter.story}</p>{encounter.facts.map((fact, index) => <p key={index}>{fact}</p>)}
        <p>本地侧避6灵性、感知18，实际侧移1米再回1米，成功减势36；星界定位6灵性、知识18，成功仅给自身优势30，不直接伤人。只有继承小电击或普通攻击构成伤势威胁。</p>
        <p>旧戏法与旅行仍按旧实际掌握缩放；资源不足只能普通0灵性回退。新能力不消耗或复制旧记录库，本场没有任意星空打击目标。伤势、死亡与撤退按共同轮盘保留。</p>
      </details>
    </section>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、服药、离世或耗用原片。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) {
    const bottle = confirmation.bottle;
    const depart = confirmation.action.command.type === "DEPART";
    const title = bottle ? bottle.title : depart ? "是否前往同一异星原停泊舱？" : "是否主动查看异星地平线？";
    return <section className="seer-panel warrior-panel seer-confirmation wanderer-panel"
      aria-label={bottle ? "漫游者原瓶服用确认" : depart ? "漫游者离世前往确认" : "漫游者查看天空确认"}
      aria-busy={busy || submittedId !== null}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
      <div className="slice-eyebrow">{bottle ? "这一原瓶 · 独立服药确认" : depart ? "本体真实离世 · 独立确认" : "可选观察 · 独立污染风险确认"}</div>
      <h3 ref={confirmationHeading} tabIndex={-1}>{title}</h3>
      {bottle ? <>
        <p>原瓶：{bottle.id}</p><p>来源：{bottle.source}</p><p>{bottle.status}</p>
        <p>当前成功率 {bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
        <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。当前渠道提供成品原瓶与独立专业准备，不提供完整的自行调配方法。")}</p>
        <section className="slice-notice seer-risk" aria-label="漫游者服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
        <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不退。失败后须实际恢复、筹另一独立原瓶，再重新检查本周场地。</p>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。身体性别不改变，旧伤势与全部旧掌握保留；灵性上限仍120，当前灵性不补满。原活体封印、原记录库、原门与口袋原物保持真实去向，不赠新记录或原物，不复活旧死亡档。</p>
      </> : <>
        <p className="slice-notice seer-risk">{playerText("星空存在严重污染危险。须确认当前停泊舱、原护具余量与返回条件；漫游能力不提供真空免疫，也不能保证任何绝境都能返回。")}</p>
        {depart ? <>
          <p>出发须当前灵性至少18、两片原供给、同一护具90秒，并已实际核对原目的信号与回程锚。出程耗8灵性及1片，知识20一次检定；失败仍耗成本，精神−5、污染+2，同一身体留在PAD，原包仍在REMOTE，不能免费重试。</p>
          <p>{playerText("成功才是同一身体经10秒G转移到REMOTE。回程另耗8灵性与剩余1片，须实核原回程标记，10秒回PAD。保留回程预算不等于星空普遍安全；停止或关闭页面不会传回本人。")}</p>
          <p>可以暂不前往，再按当前公开步骤普通归还、检查与收束。已借出的原护具须实际归还；原包未取回就如实报告。</p>
        </> : <>
          <p>{playerText("这是自选动作：实际2秒，精神−6、污染+3。观察可能带来危险，没有额外奖励或完整的宇宙知识。")}</p>
          <p>可以不看天空，闭目或遮挡视线，核对原回程标记并使用原有8灵性和剩余1片返回。取消此确认只是不看，不会自动回到本地。</p>
        </>}
        <p>本次公开代价：{confirmation.action.cost}</p>{journeyFacts()}
      </>}
      {resources()}
      {liveConfirmation?.reason && <p className="seer-action-reason" id="wanderer-confirm-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>{bottle ? "暂不服用，返回准备" : depart ? "暂不前往，返回现场" : "不看天空，返回现场"}</button>
        <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
          aria-describedby={liveConfirmation?.reason ? "wanderer-confirm-reason" : undefined}
          onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{bottle ? "确认服用这一原瓶" : depart ? "确认承担风险并前往" : "确认查看并承担污染"}</button>
      </div>
      <p className="slice-muted">取消仅关闭未提交的确认，不更改身体、物品或现场。提交后等待同一次保存回执，失败时保留这一原意图。</p>
      {pendingNotice}{saveNotice}
    </section>;
  }

  return <section className="seer-panel warrior-panel wanderer-panel" aria-label="漫游者" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="漫游者当前目标">
      <span className="seer-seal">{value.promoted ? playerText("漫游者 · 门序列3（有限离世往返G）") : "秘法师4 → 漫游者3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.resources?.health === 0 || encounter.status === "LOST" ? "本周目已经死亡，原身体位置与原物记录只读保留。"
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}</p>
      <p className="slice-muted">{playerText("漫游者为序列3，可在已核路线与当前防护范围内真实远行。下一阶段旅法师为序列2，达到条件后可查看独立晋升准备。")}</p>
      <p className="slice-muted" style={{ overflowWrap: "anywhere" }}>晋升不会复活旧死亡档，也不会改写已有原身体、原物与实际经历。</p>
    </section>
    {resources()}
    {!value.promoted && selectedBottle && <section aria-label="当前独立漫游者原瓶"><h4>本次原瓶</h4>
      <label>选择独立漫游者原瓶<select aria-label="选择独立漫游者原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}
    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前漫游者生活情境">
      <label>选择漫游者生活情境<select aria-label="选择漫游者生活情境" disabled={locked || life.insideCase || life.cases.some(entry => entry.status === "PREPARED")} value={selectedCase.id} onChange={event => setCaseId(event.target.value)}>
        {life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
      </select></label>
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.method && <p>本次已保存准备：{selectedCase.method === "ABILITY" ? "能力方法" : "普通方法"}。</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">观察、准备、实施与报告各1行动；准备前须留足2行动。现场子步0行动，仍实付秒、米、灵性与原物成本；三案报告25、反思25，共13行动。</p>
    </section>}
    <section aria-label="漫游者当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {immediateActions.length ? actionList(immediateActions.filter(action => !isExit(action)), "漫游者公开行动") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {exitActions.length > 0 && <section aria-label="漫游者停止与实际收束"><h4>{life.playerLocation === "REMOTE" ? "用原资源实际回程" : "停止、归还与本地普通退出"}</h4>
        {actionList(exitActions, "漫游者实际回程与收束")}
        <p className="slice-muted">本地可按公开步骤0行动、0灵性普通收束；异星回程仍需8灵性、剩余原片与已核原锚。零灵性、停止或关闭页面都不会把REMOTE的本人传回。实付成本不退。</p>
      </section>}
      {unavailableActions.length > 0 && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actionList(unavailableActions, "漫游者尚不可提交的步骤")}</details>}
    </section>
    {value.promoted && !encounter.inside && sceneFacts()}
    {value.promoted && encounter.inside && encounterFacts()}
    {value.promoted && <details className="seer-fold"><summary>三项实践的原观察与结果</summary>
      <section aria-label="漫游者生活记录">{life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4>
        <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束现场"}。</p>
        {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
        {entry.attempts.map(attemptFacts)}
      </article>)}<p>{life.environment}</p></section>
    </details>}
    <details className="seer-fold"><summary>{playerText("独立成品与晋升准备")}</summary>
      <section aria-label="漫游者成品与配方边界"><h4>{playerText("独立成品与晋升准备")}</h4>
        <p>{playerText(WANDERER_FORMULA_STATUS)}</p><p>{value.supplies}</p>
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>导师赫斯特·沃尔，52岁，WN3-HESTER。指导500便士；独立原瓶6400便士，或每瓶五次实际劳务后900便士；三项准备各1行动。当周场地准备另付1行动与140便士，秘法师实际晋升满12整周且原消化100才可继续。</p>
        <p>当次准备：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}{playerText("。原瓶与当次专业准备分别结算，已完成的旧阶段仪式不能代替本次准备。")}</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>{playerText("能力范围与实际掌握")}</summary>
      <section aria-label={playerText("漫游者能力与使用范围")}><h4>有限往返，不提供无限生存</h4>
        <p>{playerText(WANDERER_SOURCE_STATUS)}</p>{value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>只有能力实际成功、完成对应原物作用并报告才增加对应掌握8；原地失败、主动不前往、普通方法完成和未取回说明均不赠能力掌握。原护具与两原片不会因报告或关页自动补充。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、旧封印与继承原物</summary>
      <section aria-label="漫游者继承记录"><h4>旧学徒至秘法师经历只读保留</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>旧真实记录库、原门、口袋原物、原活体A和原框、旧敌B的真实伤势与结局全部保留。晋升不赠记录、原瓶或口袋物品，不免费治伤、开封、复活或改写旧两个死亡档。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>新原人的可选冲突</summary>{encounterFacts()}{actionList(encounterActions, "漫游者可选遭遇行动")}</details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭漫游者页面</button>}
    {pendingNotice}{saveNotice}
  </section>;

  // Scene helpers read original objects and body positions from the committed public projection.
  function journeyFacts() {
    return <section aria-label="漫游者原身体与往返预算"><h4>同一身体、原锚与实际回程资源</h4>
      <p className={life.playerLocation === "REMOTE" ? "slice-notice" : undefined}>本人当前在{LOCATION[life.playerLocation]}。
        {value.resources?.health === 0 ? "原身体已真实死亡，当前位置及随身原物保留，不提供一键恢复。"
          : life.playerLocation === "REMOTE" ? "身体已实际离开本地，关页、停止或普通退出不会传回。" : "本地普通干廊仍须本人实际行走。"}</p>
      <p>同一原锚 {life.anchor.id} · 在{LOCATION[life.anchor.location]} · {life.anchor.status === "CALIBRATED" ? "已实核校准" : "尚未校准"} · 累计普通行程 {life.anchor.travelMetres} 米。
        {life.anchor.location === "PAD" && "原锚真实留PAD，尚未归还诺拉。"}</p>
      <p>同一原护具 {life.suit.id} · 在{LOCATION[life.suit.location]} · 防护剩余 {life.suit.protectionSeconds} / 90 秒 · 累计异星实耗 {life.suit.remoteSeconds} 秒 · 实际离世段数 {life.suit.offworldLegs}。
        {life.suit.location === "OWNER" ? "原主人仍持有或已实际收回，余量不自动补充。" : "随同一身体携带，仍须真实回START交还。"}</p>
      <p>原两能量片 {life.energy.id} · 剩余 {life.energy.remaining} / 2 片 · 已耗 {life.energy.spent} 片。出程8灵性+1片，回程另8灵性+1片，不能复制、充满或返还已付成本。</p>
      <p>固定本地端点 {life.endpoints.localId} · {life.endpoints.localIntact ? "原端点完好" : "原端点失效"}；异星原舱 {life.endpoints.remoteId} · {life.endpoints.remoteSignal ? "当前原信号存在" : "当前无有效信号"}；原回程标记{life.endpoints.remoteReturnMarkerIntact ? "仍完整" : "已失效"}。</p>
      <p>当前检查：护具{attempt?.suitChecked ? "已亲自检查" : "尚未完成本次检查"}，出程信号与回程预算{attempt?.departureChecked ? "已实际核对" : "尚未完成本次核对"}，异星原回程标记{attempt?.returnMarkerChecked ? "已在原舱核实" : "尚未在原舱核实"}。</p>
      {life.playerLocation === "REMOTE" && <p className="slice-notice seer-risk">防护仅在异星实际动作中消耗；页面等待不会自行扣秒、施术或移动。主动等待每次10秒；护具耗尽后的暴露动作会损失健康15、精神5。可不看天空，按真实条件返回；零灵性不创造免费退路。</p>}
    </section>;
  }
  function attemptFacts(entry: NonNullable<WandererProjection["life"]["currentAttempt"]>, index: number) {
    return <article key={index}>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "能力实际作用后完成" : entry.result === "ORDINARY" ? "普通方法或如实未前往完成" : "尚无完成结果"} · {entry.closed ? "本次已收束" : "本次尚未收束"}。</p>
      {entry.abilityTier && <p>本案唯一能力判定：{TIER[entry.abilityTier]}。{failedTier(entry.abilityTier) && "失败与实付成本保留，不能重骰；可按当前实际位置普通收束，不算能力成功。"}</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人普通行走 {entry.playerTravelMetres} 米 · 已付灵性 {entry.spiritualitySpent} · 原片实耗 {entry.energySpent}。</p>
      {entry.playerMoves.map((move, moveIndex) => <p key={moveIndex}>{LOCATION[move.from]} → {LOCATION[move.to]}：{move.mode === "WALK" ? `普通${move.metres}米、${move.seconds}秒` : `${playerText("同一本体G离世转移")}${move.seconds}秒，不虚报普通行走距离`}。
        {move.anchorCarried && "携同一原锚。"}{move.suitCarried && "携同一原护具。"}{move.packetCarried && "携同一原包。"}</p>)}
      {(entry.departureConfirmed || entry.departed || entry.failedDeparture) && <p>{entry.failedDeparture ? "出程真实失败，同一身体留本地PAD，原片与灵性已付，原包未取回。" : entry.returnedLocal ? "同一身体已实际从REMOTE回PAD，回程成本保留。" : entry.departed ? "同一身体已实际到REMOTE，尚未完成回程。" : "已经确认出发，按保存记录核实实际结果。"}</p>}
      {(entry.remoteSeconds > 0 || entry.pollutionAdded > 0) && <p>本案异星实际耗时 {entry.remoteSeconds} 秒 · 防护不足的损伤动作 {entry.exposureActions} 次 · 健康实损 {entry.healthLost} · 精神实损 {entry.mindLost} · 污染实增 {entry.pollutionAdded}。
        {entry.horizonViewed ? "本次主动看过天际，污染后果保留，没有额外奖励。" : "本次没有主动看天际，不据此声称宇宙安全。"}</p>}
      {(entry.manualAlignment || entry.manualComparison) && <p>已真实使用20秒人工核对原记录；失败和普通方法不增加能力掌握。</p>}
      {entry.nonreturnFiled && <p>已如实登记未取回原包，不是假称送达；原包仍按真实保管位置保存。</p>}
      {entry.stopped && <p>已停止本次工作；停止不移动身体、不归还物品、不退资源。</p>}
      <p>{entry.inspected ? "已实际检查原身体、原物去向与收束条件。" : "尚未完成最终实际检查。"}</p>
    </article>;
  }
  function sceneFacts() {
    if (!selectedCase || selectedCase.status === "AVAILABLE") return null;
    return <section aria-label="漫游者原人原物与真实位置"><h4>当前原人、原物与实际位置</h4>
      <p>原现场 {life.siteId} · 实际累计 {life.clockSeconds} 秒 · 本人累计普通行走 {life.playerTravelMetres} 米。</p>
      <p>{life.nora.name} · {life.nora.age}岁 · {life.nora.id} · 当前在{LOCATION[life.nora.location]}。本案许可：{attempt ? CONSENT[attempt.ownerConsent] : "尚无本案已保存许可"}，旧案同意不延续。{!life.nora.willing && "诺拉当前不愿继续，不能强迫交付。"}</p>
      <p>{life.elias.name} · {life.elias.age}岁 · {life.elias.id} · 当前在{LOCATION[life.elias.location]}。本案受理许可：{attempt ? CONSENT[attempt.recipientConsent] : "尚无本案已保存许可"}。{!life.elias.willing && "埃利亚斯当前不愿接收。"}</p>
      <p>原普通门 {life.door.id} · {life.door.state === "OPEN" ? "实际开放" : "不可通行"}。START到PAD4米、PAD到OFFICE6米、START到OFFICE10米；这些是本地普通干廊，不是异星普通回城路线。</p>
      {journeyFacts()}
      <section aria-label="同一原封包与实际交接"><h4>原包只一份，去向按实保存</h4>
        <p>同一原封包 {life.packet.id} · 数量 {life.packet.quantity} · 原主 {life.packet.owner} · 当前在{LOCATION[life.packet.location]} · 原封条{life.packet.sealed ? "完整" : "已打开"}。</p>
        <p>来源：此前有记录的委托运送（{life.packet.source}），最初就在原停泊舱；不是能力生成、复制或凭空取得。原包累计普通行程 {life.packet.travelMetres} 米 · 离世段数 {life.packet.offworldLegs}。</p>
        <p>{life.packet.location === "OWNER_ARCHIVE" ? "埃利亚斯已实际接收同一原包归档。" : life.packet.location === "REMOTE" ? "原包仍在REMOTE，未取回就只登记真实未取回说明。" : life.packet.location === "PLAYER" ? "原包由本人实际携带，尚未归档。" : "同一原包已回原主手中，不能冒称已交档案员。"}</p>
        {selectedCase.id === "original-handoff" && <p>本案原封条与出返记录{attempt?.packetRecordsChecked ? "已实际检查" : "尚未实际检查"}；两份真实坐标时间{attempt?.recordsCompared ? "已实际比对" : "尚未实际比对"}。比对不是解密未知宇宙秘密。</p>}
      </section>
      <details className="seer-fold"><summary>固定端点的来源与有限防护</summary>
        <p>坐标来源 {life.endpoints.coordinateSource}{playerText("，为赫斯特原档案中已记录的固定G端点；原舱其他占用者 ")}{life.endpoints.occupants} 人，不复制诺拉或埃利亚斯，不携同伴过星空。</p>
        <p>护具与90秒储量均为虚构游戏防护，不是现实航天操作程序。当前检查只涉及这个原锚、原信号与原护具，不证明任意星空安全，也不授予真空免疫。</p>
      </details>
      {selectedCase.observations.length > 0 && <section aria-label="本案已取得的原观察"><h4>目前已取得的证据</h4><ul>{selectedCase.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul></section>}
      {attempt && <details className="seer-fold" open={failedTier(attempt.abilityTier) || attempt.failedDeparture || attempt.stopped || attempt.ownerConsent === "DECLINED" || attempt.recipientConsent === "DECLINED"}>
        <summary>本次实际尝试与已付代价</summary><section aria-label="漫游者本次尝试与代价">{attemptFacts(attempt, 0)}</section>
      </details>}
    </section>;
  }
}
