import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from "react";
import type { DreamWeaverAction, DreamWeaverCommand, DreamWeaverProjection } from "../domain/dream-weaver/types";
import "./seer-styles.css";

const GENDER: Record<string, string> = { FEMALE: "女性", MALE: "男性", female: "女性", male: "男性" };
const NODE: Record<string, string> = { NEAR: "原近桌", FAR: "原远桌" };
const CASE_STATUS: Record<string, string> = {
  AVAILABLE: "尚未观察", OBSERVED: "已观察", PREPARED: "已准备", ACTIVE: "现场尚未收束", EXAMINED: "待报告", RESOLVED: "已报告",
};
const ACQUISITION_TYPES = new Set(["LEARN_GUIDANCE", "REQUEST_SUPPLY", "RECEIVE_SUPPLY", "PREPARE_PROMOTION", "LEAVE_PREPARATION", "PREPARE_TASK", "POTION_WORK", "BUY_POTION", "CONSUME"]);
const ENCOUNTER_TYPES = new Set(["ENCOUNTER_TALK", "ENCOUNTER_FIGHT", "LEAVE_ENCOUNTER", "AID_ENEMY"]);
const EXIT_TYPES = new Set(["STOP_IMAGE", "REJOIN_IDENTITY", "WAIT_IDENTITY", "REVOKE_CONSENT", "RETURN_MESSAGE", "CLOSE", "WITHDRAW", "LEAVE_PREPARATION", "LEAVE_ENCOUNTER"]);
const isExit = ({ command }: DreamWeaverAction) => EXIT_TYPES.has(command.type)
  || command.type === "MOVE" && command.actor === "OWNER" && command.to === "NEAR";
type Confirmation = { action: DreamWeaverAction; bottle: DreamWeaverProjection["bottles"][number]; facts: string };

export interface DreamWeaverPanelProps {
  value: DreamWeaverProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: DreamWeaverCommand) => void;
  /** Closing the view never moves the owner, returns an original or ends a real contact. */
  onClose?: () => void;
}

function confirmationFacts(value: DreamWeaverProjection, action: DreamWeaverAction) {
  return JSON.stringify({ promoted: value.promoted, preparations: value.preparations, preparedWeek: value.preparedWeek,
    bottles: value.bottles, resources: value.resources, risk: value.risk, currentGender: value.currentGender,
    action: { id: action.id, cost: action.cost, command: action.command } });
}

/** Only committed public facts are rendered; local selections create neither identities nor knowledge. */
export function DreamWeaverPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: DreamWeaverPanelProps) {
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
  const practice = value.life.practice;
  const attempt = value.life.currentAttempt;
  const selectedCase = value.life.cases.find(entry => entry.id === practice?.activeCase)
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

  function submit(action: DreamWeaverAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = publicFacts; setSubmittedId(action.id);
    onCommand(action.command);
  }
  function choose(action: DreamWeaverAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (action.command.type === "CONSUME") {
      const selectedId = action.command.bottleId;
      const bottle = value.bottles.find(entry => entry.id === selectedId);
      if (!bottle || value.promoted) return;
      returnActionId.current = action.id;
      setConfirmation({ action, bottle, facts: confirmationFacts(value, action) });
    } else submit(action);
  }
  function actionList(actions: DreamWeaverAction[], title: string) {
    return <div className="warrior-action-list" role="group" aria-label={title}>
      {actions.map(action => <div className="seer-action warrior-compact-action" key={action.id}>
        <button className="slice-choice" disabled={locked || !action.enabled}
          ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
          aria-describedby={action.reason ? `dream-weaver-reason-${action.id}` : undefined}
          onClick={() => choose(action)}><strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span></button>
        {action.reason && <p className="seer-action-reason" id={`dream-weaver-reason-${action.id}`}>{action.reason}</p>}
      </div>)}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section className="seer-current-resources" aria-label="织梦人当前资源"><h4>当前实际资源</h4>
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
  function attemptFacts(entry: NonNullable<DreamWeaverProjection["life"]["currentAttempt"]>, index: number) {
    const failed = entry.identityAttempted && !entry.identityCreated || entry.imageAttempted && !entry.imageCreated;
    return <div key={index}>
      <p>第{entry.week}周 · {entry.method === "ABILITY" ? "能力准备" : "普通准备"} · {entry.result === "ABILITY" ? "实际能力完成" : entry.result === "ORDINARY" ? "普通方法完成" : "尚无完成结果"} · {entry.closed ? "本次已收束" : "本次尚未收束"}。</p>
      {failed && <p>本次能力尝试失败，原成本保留，可走普通方法。</p>}
      <p>实际经过 {entry.elapsedSeconds} 秒 · 本人行走 {entry.ownerTravelMetres} 米 · 身份行走 {entry.identityTravelMetres} 米；已付灵性 {entry.spiritualitySpent}、本人精神 {entry.ownerMindSpent}、欧文精神 {entry.owenMindSpent}。</p>
      <p>身份：{entry.identityCreated ? `${entry.identityId} · ${entry.identityEnd === "REJOINED" ? "已明确归并" : entry.identityEnd === "EXPIRED" ? "已经真实到期" : "尚在场"}` : entry.identityAttempted ? "尝试后未形成" : "未创建"}；原纸{entry.messageReturned ? "已实际归还" : entry.messageTaken ? "仍需亲手归还" : "未取走"}。</p>
      {entry.imageAttempted && <p>梦像{entry.imageCreated ? "实际形成" : "尝试失败"} · {entry.imageBelieved ? "曾相信" : "未相信"} · {entry.imageRecognized ? "已辨认" : "未辨认"} · {entry.imageStopped ? "已停止" : entry.imageCreated ? "尚未停止" : "无形象可停"}；{entry.bellChecked ? "已核对唯一原铃" : "尚未核对原铃"}。</p>}
    </div>;
  }
  const saveNotice = error !== null && <p className="slice-notice" role="status">
    {playerText(typeof error === "string" ? error : error.message)} 当前仍显示上次已保存的记录。
    {typeof error !== "string" && error.retryable === false ? "请按错误提示重新加载。"
      : "请使用保存错误处的重试，继续同一原操作；不要重复付费、建立身份、征求同意或服药。"}
  </p>;
  const pendingNotice = (busy || submittedId !== null) && error === null
    ? <p className="slice-notice" role="status">正在结算并保存这一原操作，请稍候。</p> : null;

  if (confirmation) return <section className="seer-panel warrior-panel seer-confirmation dream-weaver-panel"
    aria-label="织梦人原瓶服用确认" aria-busy={busy || submittedId !== null}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!locked) setConfirmation(null); } }}>
    <div className="slice-eyebrow">这一原瓶 · 独立服药确认</div>
    <h3 ref={confirmationHeading} tabIndex={-1}>{confirmation.bottle.title}</h3>
    <p>原瓶：{confirmation.bottle.id}</p><p>来源：{confirmation.bottle.source}</p><p>{confirmation.bottle.status}</p>
    <p>当前成功率 {confirmation.bottle.chance}% · 本次消耗：{confirmation.action.cost}</p>
    <p>本次场地检查：{value.preparedWeek === null ? "尚无已保存的检查" : `第${value.preparedWeek}周`}{playerText("。专业准备与场地检查均为本作G；完整配方与原著晋升仪式仍未知。")}</p>
    <section className="slice-notice seer-risk" aria-label="织梦人服用风险与四档结果"><h4>实际风险与四档结果</h4><p>{value.risk}</p></section>
    <p>成功或失败都会耗尽这一原瓶及当次场地准备，已付成本不会退回。专业经历保留；重试须休养、筹另一独立原瓶并重新检查场地。</p>
    <p>当前角色身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶身体性别不改变，旧伤势、旧人格记录与旧能力掌握保留；灵性上限仍为120，当前灵性不补满。原万人聚会与七滴泪不重造，也不成为本次准备。</p>
    {resources()}
    {liveConfirmation?.reason && <p className="seer-action-reason" id="dream-weaver-confirm-reason">{liveConfirmation.reason}</p>}
    <div className="seer-confirm-buttons">
      <button className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>暂不服用，返回准备</button>
      <button className="slice-button" disabled={locked || !liveConfirmation?.enabled}
        aria-describedby={liveConfirmation?.reason ? "dream-weaver-confirm-reason" : undefined}
        onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>确认服用这一原瓶</button>
    </div>
    <p className="slice-muted">返回只取消未提交的确认。提交后等待同一次保存回执，失败时保留这一原意图。</p>
    {pendingNotice}{saveNotice}
  </section>;

  return <section className="seer-panel warrior-panel dream-weaver-panel" aria-label="织梦人" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="织梦人当前目标">
      <span className="seer-seal">{value.promoted ? "织梦人3 · 有限身份与梦像" : "操纵师4 → 织梦人3"}</span>
      <h3 ref={summaryHeading} tabIndex={-1}>{value.title}</h3>
      <p className="seer-next"><strong>下一步：</strong>{nextAction ? `${nextAction.label}${!nextAction.enabled && nextAction.reason ? `。${nextAction.reason}` : ""}`
        : value.acting >= 100 ? "本阶实践已消化，可以继续普通生活。" : "查看本次公开条件，或继续普通生活。"}</p>
      <p>{value.digestion}</p>
    </section>
    {resources()}

    {!value.promoted && selectedBottle && <section aria-label="当前独立织梦人原瓶"><h4>本次原瓶</h4>
      <label>选择独立织梦人原瓶<select aria-label="选择独立织梦人原瓶" disabled={locked} value={selectedBottle.id} onChange={event => setBottleId(event.target.value)}>
        {value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
      </select></label><p>{selectedBottle.id} · {selectedBottle.status}</p>
    </section>}

    {value.promoted && !encounter.inside && selectedCase && <section className="seer-current-case" aria-label="当前织梦人生活情境">
      <h4>{selectedCase.title} · {CASE_STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p>
      {selectedCase.preparation && <p>{selectedCase.preparation}</p>}
      {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
      <p className="slice-muted">普通方法同样可完成；能力掌握只记录实际成功。关闭页面不会消解身份或归还原物。</p>
    </section>}
    {value.promoted && !encounter.inside && practice && <section aria-label="织梦人当前原场"><h4>本人、身份与眼前原物</h4>
      <p>原场 {practice.sceneId} · 本人在{NODE[practice.ownerNode]}{attempt && ` · 实际经过 ${attempt.elapsedSeconds} 秒`}。</p>
      <section aria-label="单一外部身份当前状态">
        {practice.identity ? <><p>当前唯一外部身份：{practice.identity.id} · 原姓名 {practice.identity.originalName} · 在{NODE[practice.identity.node]}。</p>
          <p>剩余 {practice.identity.remainingSeconds} 秒 · 有限范围 {practice.identity.limitMetres}{playerText(" 米（G）。本人位置不随身份移动或归并改变。")}</p></>
          : <p>当前没有在场的外部身份。</p>}
        <p>与本人思想、心思共通，只传递实际看到与读到的内容。身份没有另一份灵性、装备或真钱，不能搬运原纸。</p>
      </section>
      <section aria-label="原留言实体"><h4>唯一原纸的实际去向</h4>
        <p>{practice.message.id} · 所有人 {practice.participants[practice.message.ownerId].name}（{practice.message.ownerId}） · {practice.message.holder === "FAR_DESK" ? "仍在原远桌" : `本人持有，实际在${NODE[practice.ownerNode]}`}。</p>
      </section>
      <section aria-label="实际读取的已知内容"><h4>本人实际已知的留言</h4>
        {practice.knownMessage ? <><p>{practice.knownMessage.text}</p><p>知识来源 {practice.knownMessage.sourceId} · 第{practice.knownMessage.readWeek}周由{practice.knownMessage.reader === "IDENTITY" ? "远桌身份实际读取后共通给本人" : "本人在远桌实际读取"}。已读不等于原纸已送到，也不代表本次读取授权。</p></>
          : <p>尚未实际读取，留言内容未知；共通心思不会自动取得远处消息。</p>}
      </section>
      {selectedCase?.id === "woven-bell" && <section aria-label="有限梦像与原铜铃"><h4>可停止的形象与唯一原铃</h4>
        <p>原铜铃 {practice.bell.id} · 仍在原近桌 · 两道环纹，实体只有一个。</p>
        <p>{practice.image ? `${practice.image.id}只是一项有限梦像；${practice.image.believed ? "欧文当前相信" : attempt?.imageRecognized ? "欧文已辨认，不再相信" : "欧文尚未相信"}，可以明确停止。` : "当前没有正在施加影响的梦像。"}</p>
        <p>相信时的实际精神代价与辨认后的结果分别保存；形象不是现实造物。停止后仍须普通核对原铃。</p>
      </section>}
      <p>本次同意：{value.life.currentConsents.map(entry => `${practice.participants[entry.id].name}${entry.consented ? "已同意此案" : "当前未同意此案"}`).join("；")}。旧同意不能继承。</p>
      {attempt && <details className="seer-fold" open={attempt.identityAttempted && !attempt.identityCreated || attempt.imageAttempted && !attempt.imageCreated}>
        <summary>本次实际尝试与已付代价</summary><section aria-label="织梦人本次尝试与代价">{attemptFacts(attempt, 0)}</section>
      </details>}
    </section>}

    <section aria-label="织梦人当前行动"><h4>{value.insideCase ? "当前现场的下一步" : "当前可选行动"}</h4>
      {currentActions.length ? actionList(currentActions.filter(action => !isExit(action)), "织梦人公开行动") : <p className="slice-muted">当前没有可提交的公开行动。</p>}
      {exitActions.length > 0 && <section aria-label="织梦人停止与普通退路"><h4>停止与普通退路</h4>{actionList(exitActions, "织梦人普通收束行动")}
        <p className="slice-muted">实际停止、归还与走回须分别完成；关闭页面不会代替这些动作，已付成本不退。</p>
      </section>}
    </section>

    {value.promoted && practice && <details className="seer-fold"><summary>两位成年人的本次同意与状态</summary>
      <section aria-label="织梦人本次成年参与者"><h4>分别确认，只限此案</h4>
        <p>只交流本人姓名、已见原路与本案内容。原留言案另含读取及本人取还原纸；铜铃案只有欧文知情承担有限精神后果，艾丽丝只旁观。任何人均可停止。</p>
        <ul>{Object.values(practice.participants).map(person => <li key={person.id}><strong>{person.name}</strong> · {person.age}岁 · {person.id}
          <p>在{NODE[person.node]} · 健康 {person.health} / 100 · 精神 {person.mind} / 100 · {value.life.currentConsents.find(entry => entry.id === person.id)?.consented ? "本次明确同意" : "当前未同意"}。</p>
        </li>)}</ul>
        <p>上案、旧米拉或万人集会的同意均不能延续至此。当前撤回后仍保留普通走返、还纸和停止能力的退路。</p>
      </section>
    </details>}
    {value.promoted && value.life.cases.length > 0 && <details className="seer-fold"><summary>三项生活情境与原尝试记录</summary>
      <section aria-label="织梦人生活记录"><h4>选择情境或回看原结果</h4>
        <label>选择织梦人生活情境<select aria-label="选择织梦人生活情境" disabled={locked || value.life.insideCase} value={selectedCase?.id ?? ""} onChange={event => setCaseId(event.target.value)}>
          {value.life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {CASE_STATUS[entry.status] ?? entry.status}</option>)}
        </select></label>
        {value.life.cases.map(entry => <article key={entry.id}><h4>{entry.title}</h4><p>{entry.story}</p>
          <p>{entry.result ?? "尚无实际结果。"} · 已实际收束 {entry.closes} 次 · {entry.contactOpen ? "原现场尚未结束" : "没有本项未结束接触"} · {entry.returned ? "已实际归位" : "尚无本项归位记录"}。</p>
          {entry.observations.length > 0 && <ul>{entry.observations.map((fact, index) => <li key={index}>{fact}</li>)}</ul>}
          {entry.attempts.map(attemptFacts)}
        </article>)}<p>{value.life.environment}</p>
      </section>
    </details>}

    <details className="seer-fold"><summary>独立成品、专业准备与配方边界</summary>
      <section aria-label="织梦人成品与配方边界"><h4>{playerText("专业支持与独立成品")}</h4>
        <p>{playerText("完整配方、材料用量与原著晋升仪式仍未知。三项专业准备与场地检查不冒称原著仪式，也不复用操纵师的万人共鸣窗口。")}</p>
        <p>{value.supplies}</p>{value.story && <p>{value.story}</p>}
        <ul>{value.preparations.map(entry => <li key={entry.taskId}>{entry.title}：{entry.completedWeek === null ? "尚未实际完成" : `第${entry.completedWeek}周已完成`}</li>)}</ul>
        <p>当次场地检查：{value.preparedWeek === null ? "没有已保存的本次准备" : `第${value.preparedWeek}周`}。</p>
        {value.bottles.map(bottle => <article key={bottle.id}><h4>{bottle.title}</h4><p>{bottle.id} · {bottle.status}</p><p>{bottle.source}</p></article>)}
        <p>{value.risk}</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原身体、旧人格与继承记录</summary>
      <section aria-label="织梦人继承记录"><h4>同一身体与已经发生的旧经历</h4>
        <p>当前身体：{GENDER[value.currentGender] ?? value.currentGender}。本阶不改变性别。</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>旧七滴泪、万人聚会与已归并人格只作历史；旧同意不能继承为本次两位成年人的交流授权。旧伤势、原人投降与疾病不会因晋升自动清除。</p>
      </section>
      <section aria-label="织梦人能力边界"><h4>本阶有限能力与实际掌握</h4>
        {value.abilities.map(ability => <p key={ability.id}>{ability.label} · 掌握 {ability.mastery}：{ability.description}</p>)}
        <p>外部身份与本人思想共通，只能使用实际取得的知识；没有独立灵魂、第二份灵性或装备。结束不移动本人、不复活伤亡；形象不是现实造物，不提前获得洞察者2权柄。</p>
      </section>
    </details>
    <details className="seer-fold"><summary>原场地与普通生活</summary><p>{value.environment}</p></details>
    {value.promoted && encounter.enemy && <details className="seer-fold" open={encounter.inside}><summary>新原人的可选冲突</summary>
      <section aria-label="织梦人原人遭遇"><h4>{encounter.title}</h4><p>{encounter.story}</p>
        <p>{encounter.enemy.name} · {encounter.enemy.age}岁 · {encounter.enemy.id}{playerText(" · 本场G序列")}{encounter.enemy.sequence}等效。</p>
        <p>健康 {encounter.enemy.health} · 精神 {encounter.enemy.mind} · 独立灵性 {encounter.enemy.spirituality} · {encounter.enemy.status === "DEAD" ? "已经真实死亡" : encounter.enemy.status === "SURRENDERED" ? "已投降停止抵抗，仍是原人" : "仍有独立意志"}。</p>
        <p>他自己的原棍 {encounter.enemy.weaponId} · {encounter.enemy.weaponLocation === "HAND" ? "仍在原人手中" : "留在原院"}。</p>
        <ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
        <p>原精神瘟疫强度 {encounter.mentalPlague}，离场不自动清除。精神降到0只表示投降，普通伤势与死亡仍按共同规则结算。</p>
        {encounter.helpHistory.length > 0 && <ul>{encounter.helpHistory.map((entry, index) => <li key={index}>第{entry.week}周原人实际专业稳定：{entry.before}→{entry.after}，{entry.fee}便士；原健康与精神不补满。</li>)}</ul>}
        {!encounter.inside && actionList(encounterActions, "织梦人可选遭遇行动")}
      </section>
    </details>}
    {onClose && <button className="slice-button quiet" disabled={locked} onClick={() => { if (!locked) onClose(); }}>关闭织梦人页面</button>}
    {pendingNotice}{saveNotice}
  </section>;
}
