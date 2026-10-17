import { useEffect, useRef, useState } from 'react';
import { playerText } from '../shared/player-text.js';
import type { PaleEmperorAction, PaleEmperorCommand, PaleEmperorProjection } from '../domain/pale-emperor/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'LEAVE', 'WITHDRAW_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已安全中止，待普通续办', ACTIVE: '尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '已结束' };
const ENEMY_STATUS = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const PERMISSION = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回' };
const WINDOW = { NONE: '尚未尝试', ACTIVE: '等待实际应用', FAILED: '判定失败', APPLIED: '已经实际应用', STOPPED: '已经停止', EXPIRED: '已经到期', INVALIDATED: '条件改变，已经失效' };
const POLICIES = { INHERITED_ONLY: '只用已学能力', RESIDUAL_QUIETING: '允许残响安定', SPIRITUAL_INTERDICTION: '允许灵迹阻隔', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };
const LOCATION: Record<string, string> = { RECEPTION: '当代接待处', ENTRY: '附室入口', NEAR: '近台', FAR: '远台', EXIT: '附室出口', AWAY: '已经离场', PLAYER: '本人手中', NORA: '诺拉手中', BOX: '普通安全箱内', STAND: '原支架上' };

export interface PaleEmperorPanelProps {
  value: PaleEmperorProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: PaleEmperorCommand) => void;
  onClose?: () => void;
}

/** The view never changes resources or manufactures commands: it submits a current public action verbatim. */
export function PaleEmperorPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: PaleEmperorPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: PaleEmperorAction; facts: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  // Protect exact user-supplied names, including names that contain editorial words.
  const copy = (text: string) => value.characterName ? text.split(value.characterName).map(playerText).join(value.characterName) : playerText(text);
  const facts = JSON.stringify(value);
  const currentFacts = useRef(facts);
  currentFacts.current = facts;
  const locked = busy || blocked || error !== null || pending || value.resources === null || value.resources.health === 0;
  const { life, encounter } = value;
  const selectedBottle = value.bottles.find(bottle => bottle.id === goal)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const activeCase = life.cases.find(entry => entry.id === life.activeCase);
  const selectedCase = activeCase ?? life.cases.find(entry => entry.id === goal)
    ?? life.cases.find(entry => entry.status !== 'RESOLVED') ?? life.cases[0];
  const inEncounter = encounter.inside || (!activeCase && value.promoted && (goal === 'encounter' || goal === null && life.reflected));
  const inside = value.insideCase || life.insideCase || encounter.inside;
  const selectionLocked = locked || confirmation !== null || (value.promoted ? inside : life.insideCase || encounter.inside);
  const entries = value.actions.filter(action => inEncounter ? ENCOUNTER.has(action.command.type)
    : value.promoted ? !ACQUISITION.has(action.command.type) && !ENCOUNTER.has(action.command.type)
      && (!('caseId' in action.command) || action.command.caseId === selectedCase?.id)
      : ACQUISITION.has(action.command.type) && (!('bottleId' in action.command) || action.command.bottleId === selectedBottle?.id));
  const next = entries.find(action => action.enabled && action.id === value.preferredActionId)
    ?? entries.find(action => action.enabled && action.preferredAction)
    ?? entries.find(action => action.enabled && !action.cleanup && !COMMON.has(action.command.type))
    ?? entries.find(action => action.enabled) ?? entries[0];
  const common = entries.filter(action => action !== next && (COMMON.has(action.command.type) || action.cleanup));
  const alternatives = entries.filter(action => action !== next && !common.includes(action));
  const extra = alternatives.find(action => action.id === extraId) ?? alternatives[0];
  const live = confirmation?.facts === facts ? value.actions.find(action => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmedBottleId = live?.command.type === 'CONSUME' ? live.command.bottleId : null;
  const confirmedBottle = value.bottles.find(bottle => bottle.id === confirmedBottleId);
  const phase = `${value.promoted}:${inEncounter}:${selectedCase?.id}:${selectedBottle?.id}:${next?.id}`;

  useEffect(() => { if (!confirmation && !pending) heading.current?.focus(); }, [phase]);
  useEffect(() => {
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null;
      submittedFacts.current = null;
      setPending(false);
      returnActionId.current = null;
      setConfirmation(null);
      heading.current?.focus();
    } else if (error !== null || confirmation && confirmation.facts !== facts) {
      returnActionId.current = null;
      setConfirmation(null);
      heading.current?.focus();
    }
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? heading.current)?.focus();
    else heading.current?.focus();
  }, [confirmation]);

  function choose(action: PaleEmperorAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: PaleEmperorAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function actionLabel(action: PaleEmperorAction) {
    return copy(action.label) + ('permission' in action.command ? `：${action.command.permission === 'CUSTODIAN' ? '诺拉本次保管参与' : '本人本次使用能力'}` : action.command.type === 'INVITE' ? `：${action.command.method === 'ORDINARY' ? '普通处理' : '尝试有限能力'}` : '');
  }
  function actionControl(action: PaleEmperorAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `pale-emperor-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{actionLabel(action)}</strong><span className="slice-modifiers">{copy(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`pale-emperor-reason-${action.id}`}>{copy(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="苍白皇帝当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="苍白皇帝当前资源">
      <h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>晋升、停止与归还原物不会免费恢复身体，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="苍白皇帝成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{copy(value.title)}</h2>
      <section aria-label="苍白皇帝阶段总览"><p>当前阶段：{inEncounter ? '可选真实遭遇' : value.promoted ? life.reflected ? '生活报告与反思已完成' : '附室的三项残响实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p><p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 苍白皇帝扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p></section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，身体、人物与原物记录只读保留。' : next ? actionLabel(next) : copy(value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">
        {value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="苍白皇帝目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked}
          onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{copy(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：附室外前庭的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{copy(bottle.title)} · {copy(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="苍白皇帝其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{actionLabel(action)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {!value.promoted ? <section aria-label="苍白皇帝服药准备">
        <p>{copy(value.digestion)}</p><p>{copy(value.sourceLabel)}</p><p>{copy(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{copy(selectedBottle.title)}</h3><p>{copy(selectedBottle.source)}</p><p>{copy(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{copy(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留死亡执政官。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{copy(value.risk)}</p><p>{copy(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{copy(value.digestion)}</p><p>{copy(value.appearanceRecord)}</p><p>{copy(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{copy(ability.label)} · 掌握{ability.mastery}</h3><p>{copy(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{copy(value.environment)}关闭页面不会代替停止作用、归还原物与沿原路离开；已经发生的事件与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="苍白皇帝操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{live ? actionLabel(live) : '现场已变化'}</h3>
      <p>{live && copy(live.cost)}</p>
      {confirmedBottle && <><p>{copy(confirmedBottle.title)} · {copy(confirmedBottle.status)}</p><p>{copy(confirmedBottle.source)}</p><p>当前成功率{confirmedBottle.chance}%</p>
        <p>{copy(value.risk)}</p><p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。本阶不改变性别、姓名、年龄、性格与取向。也可取消并继续停留死亡执政官。</p></>}
      {live && actionConsequences(live)}
      {live?.command.type === 'ENCOUNTER_POLICY' && <p>本次明确选择：{POLICIES[live.command.policy]}。只保存本场策略，不会施法、购买材料或开始战斗。</p>}
      {live?.command.type === 'ENCOUNTER_FIGHT' && <><p>这是与{encounter.enemy.name}的真实交战。双方独立受伤、投降、撤退与死亡都将保存，普通死亡终结本周目。生活练习不代替交战结果。</p><p>本场策略：{POLICIES[encounter.policy]}。开战后不能更换；能力是否真正可用仍按实际资源与抵抗结算。</p><p>{copy(encounter.story)}</p></>}
      {!confirmedBottle && live?.command.type !== 'ENCOUNTER_FIGHT' && <p>{copy(inEncounter ? encounter.story : value.promoted ? life.environment : value.story ?? value.risk)}</p>}
      {resources()}
      <p>已经支付的行动、金钱、灵性与精神不因停止而返还；撤回超凡许可会阻止新的能力作用，退出不撤销已经发生的事实和实际伤害。</p>
      {live?.reason && <p className="seer-action-reason">{copy(live.reason)}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一原瓶' : live?.command.type === 'ENCOUNTER_FIGHT' ? '确认开始真实交战' : '确认执行这一次操作'}</button>
      </div>
      <p>取消不提交。只有收到已保存的新记录后，才能开始下一次操作。</p>
    </section>}
  </section>;

  function actionConsequences(action: PaleEmperorAction) {
    const details: Record<string, string> = {
      WALK_TO_ANNEX: '实付1行动，沿12米普通道路步行12秒。到场后的邀请另需1行动与10便士；首次购买两条封条另付8便士。到场不会免费恢复身体，也不会把旧人物或旧物搬来。',
      BUY_SEALS: '实付8便士，取得仅有的两条原封条，每条4便士。每次重新封口实际耗用一条，用尽后不再补充；普通安全箱可用于最后收尾，不必购买第三条。',
      INVITE: '本次邀请实付1行动与10便士。42岁的诺拉·贝尔实际走4米到近台，消耗2精力。保管参与和本人施术分别取得本次许可；拒绝或撤回不退已付费用。',
      CONSENT: '只确认所列的这一项当前许可。保管参与许可包括借用附室的同一容器和原盖，之后须归还；能力许可不会代替诺拉未来的同意。容器只有非人格残留。',
      DECLINE_CONSENT: '记录这一次拒绝，不施放能力。已付邀请费与实际行走保留，可以采用当前可用的普通处理或安全收尾。',
      RESIDUAL_QUIETING: '本次消耗8灵性、2精神，意志18。成功只对已经观察的同一容器开启20秒窗口，躁动暂由2降至0；随后必须另行亲手合盖，开窗本身不算应用，也不增加掌握。停止、到期或实际应用结束后，原躁动恢复2，原盖和擦痕保留。',
      SPIRITUAL_INTERDICTION: '本次消耗7灵性、2精神，知识18。成功只对已观察的4米线路开启20秒窗口；随后真实搬运同一容器，才可能阻隔一次指定残响传播。诺拉仍须当前同意、实际同行并消耗精力；开窗本身不移动人物、容器或增加掌握。',
      FIT_LID: '用4秒亲手合上同一原盖。只有当时仍有效的残响安定窗口才计一次实际应用；随后原躁动恢复2，盖仍保持合拢，仍须实用封条封口与归还原物。',
      ORDINARY_FIT: '用原屏普通合盖，实际花12秒并使同一容器增加1处擦痕。不获得未应用能力的掌握，已支付的灵性与精神不返还。',
      CARRY_VESSEL: '本人和同一容器实际移动4米，诺拉同行4米并消耗2精力。只有在这4秒内仍有效的灵迹阻隔才阻隔一次传播；不是传送，之后仍须合盖、封口和普通返程。',
      SCREENED_CARRY: '展开同一原屏，普通搬运4米并额外花4秒，同一容器增加1处擦痕；诺拉实际同行并消耗2精力。不增加未应用能力的掌握。',
      RESEAL: '实际耗用1条已经买下、尚未用过的原封条，花2秒封口。以后重新打开会破坏这次封口，不会产生新的封条。',
      WITHDRAW_CONSENT: '撤回立即停止尚未应用的窗口，不退款、不搬运、不补充封条。之后只能按当前可用的普通方式收物，诺拉不会被迫继续能力实践。',
      MANUAL_RETURN: '用同一原屏和安全箱收物，本人独自把同一容器从远台实搬4米回近台，留下实际擦痕；诺拉的撤回、已付成本与已用封条保留。',
      RETURN_LOAN: '实际安全装箱，并把同一容器和原盖归还附室。停止窗口不会抹去擦痕、移动记录或封条消耗，归还后仍须沿路离开。',
      WAIT_WINDOW: '等待这一次20秒窗口自然到期，已经支付的灵性和精神不退。原躁动恢复2；原盖、封条、擦痕和位置照实保留。',
      STOP: '只停止尚未应用的窗口，不返还已付代价，不替代合盖、归还和实际步行。原残留仍在。',
      ABORT: '普通安全收物、归还同一容器和盖。诺拉实际走出附室，本人从当前台架沿现场道路与12米普通道路回接待处。已付行动、费用和损耗不返还，也不视为完成报告。',
      LEAVE: '当前作用已结束、同一原物已安全归还后，诺拉实际离开，本人沿现场道路和12米普通道路走回接待处。零行动点不等于零用时或原地传送。',
      REPORT: '花1行动，按本案真实结果增加25扮演。只有本案已经实际应用的能力才增加8掌握，各一次；失败开窗、到期和撤回都不会提前奖励。普通完成也可报告。',
      REFLECT: '花1行动，总结三份已完成的实际报告，增加25扮演。此前的失败、撤回、旧伤和原物损耗继续保留。',
    };
    return details[action.command.type] ? <p>{details[action.command.type]}</p> : null;
  }

  function lifeFacts() {
    const { site, nora } = life, attempt = selectedCase?.attempts.at(-1);
    const current = !!attempt && !!selectedCase && !attempt.closed && selectedCase.id === life.activeCase && selectedCase.contactOpen;
    const window = life.pending, seconds = window ? Math.max(0, window.expiresAt - life.clockSeconds) : 0;
    const isUsable = !!site && !!nora && !!attempt && !!selectedCase && !!window && current && attempt.method === 'ABILITY'
      && attempt.permission.custodian === 'GRANTED' && attempt.permission.ability === 'GRANTED'
      && window?.caseId === selectedCase.id && window.vesselId === site.vessel.id && window.vesselVersion === site.vessel.version
      && window.conditionVersion === life.conditionVersion && window.permissionVersion === attempt.permissionVersion
      && attempt.observedVersion === site.vessel.version && seconds >= 4 && site.door.state === 'OPEN'
      && site.screen.state === 'RETRACTED' && site.vessel.lid === 'OPEN' && !site.box.closed
      && nora.present && nora.location === life.playerLocation && life.playerLocation === site.vessel.location
      && (window.kind === 'QUIETING' ? selectedCase.id === 'quiet-lid' && window.line === null
        : selectedCase.id === 'guarded-carry' && window.line?.[0] === site.vessel.location && window.line?.[1] === (site.vessel.location === 'NEAR' ? 'FAR' : 'NEAR'))
      && value.actions.some(action => action.enabled && action.command.type === (window.kind === 'QUIETING' ? 'FIT_LID' : 'CARRY_VESSEL'));
    const permission = (state: keyof typeof PERMISSION) => state === 'GRANTED' && !current ? '本案曾明确同意，当前无生效许可' : PERMISSION[state];
    return <section aria-label="苍白皇帝附室实践">
      <h3>{copy(selectedCase?.title ?? life.title)} · {STATUS[selectedCase?.status ?? 'AVAILABLE'] ?? '当前记录'}</h3>
      <p>{copy(selectedCase?.story ?? life.story)}</p>
      {selectedCase?.result && <p>{copy(selectedCase.result)}</p>}
      {!site || !nora ? <p>尚未实际到达附室，没有当前借用的容器或在场保管员。先沿接待处旁的普通道路到场。</p> : <>
        <section aria-label="附室当前人物与原物"><h4>当前人物与同一原物</h4>
          <p>{copy(life.source)}</p>
          <p>{nora.name} · {nora.age}岁；健康{nora.health}/100、精神{nora.mind}/100、精力{nora.energy}/100，当前在{LOCATION[nora.location]}，{nora.present ? '本次在场' : '本次不在场'}；累计实走{nora.travelMetres}米。</p>
          <p>本人在{LOCATION[life.playerLocation]}，累计实走{life.playerTravelMetres}米；现场经过{life.clockSeconds}秒，两台相距{site.lengthMetres}米，接待处普通道路{site.ordinaryRoadMetres}米。普通出口开放。</p>
          <p>唯一原容器在{LOCATION[site.vessel.location]}，{site.vessel.holder === 'PLAYER' ? '由本人借用保管' : '由附室保管'}；躁动{site.vessel.agitation}/2，原盖{site.vessel.lid === 'OPEN' ? '打开' : '合拢'}，封口{site.vessel.seal === 'INTACT' ? '完整' : site.vessel.seal === 'BROKEN' ? '已被重新打开' : '尚未封条封口'}，擦痕{site.vessel.scuffs}处；累计实搬{site.vessel.travelledMetres}米。</p>
          <p>原盖在{site.lid.location === 'VESSEL' ? '同一容器上' : '原台架上'}，实操作{site.lid.operations}次；原屏{site.screen.state === 'DEPLOYED' ? '已展开' : '已收起'}，原门{site.door.state === 'OPEN' ? '打开' : '关闭'}，安全箱{site.box.closed ? '合拢' : '打开'}。</p>
          <p>原封条仅{site.seals.length}条：本人剩余{site.seals.filter(seal => seal.state === 'PLAYER').length}条、已用{site.seals.filter(seal => seal.state === 'USED').length}条、尚未购买{site.seals.filter(seal => seal.state === 'SUPPLIER').length}条。每条4便士，用尽不补发。</p>
          <p>实际借用{site.loan.grants}次，实际归还{site.loan.returns}次；{site.loan.grantedWeek === null ? '尚无本次借用' : site.loan.returnedWeek === null ? '本次借物仍须归还' : '最近一次借物已经归还'}。原残留不变成人或可支配的灵魂。</p>
        </section>
        {attempt && <section aria-label="本次许可与实际代价"><h4>本次许可与实际代价</h4>
          <p>保管参与：{permission(attempt.permission.custodian)}；本人施术：{permission(attempt.permission.ability)}。许可分别记录，先前同意不代替当前选择。</p>
          <p>本次已经消耗{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、诺拉{attempt.noraEnergySpent}精力；本人实走{attempt.playerTravelMetres}米，诺拉实走{attempt.noraTravelMetres}米，原容器实搬{attempt.vesselTravelMetres}米，经过{attempt.elapsedSeconds}秒。</p>
          <p>{attempt.loanReturned ? '本次同一原物已归还。' : '本次仍须安全归还同一原物。'}{attempt.closed ? '本次人员已实际离场。' : '收尾和离场仍须实际完成。'}</p>
        </section>}
        <section aria-label="两项残响能力的有限窗口"><h4>短暂作用与实际应用</h4>
          {isUsable && window ? <p role="status">{window.kind === 'QUIETING' ? '残响安定' : '灵迹阻隔'}还剩{seconds}秒，等待{window.kind === 'QUIETING' ? '亲手合盖' : '实际搬运同一容器'}；当前条件允许这一次后续操作。</p>
            : <p>{window ? '先前开窗记录当前不可应用；请按当前可用操作收尾。' : '当前没有尚待实际应用的有效窗口。'}</p>}
          {attempt && <ul>{([['残响安定', attempt.quieting], ['灵迹阻隔', attempt.interdiction]] as const).map(([name, use]) => <li key={name}>{name}：{use.state === 'ACTIVE' && !isUsable ? '当前条件下不能应用' : WINDOW[use.state]} · 尝试{use.attempts}次 · 成功开窗{use.successes}次 · 实际应用{use.effects}次{use.tier ? ` · 最近判定${TIER[use.tier]}` : ''}</li>)}</ul>}
          <p>施放成功只开窗，不代替合盖或搬运，也不立即增加掌握。每案报告时只奖励已经实际应用的能力；停止或到期恢复原躁动2，原物位置、原盖、封条与擦痕保留。</p>
          <p>残响安定8灵性、2精神，意志18；灵迹阻隔7灵性、2精神，知识18。两种窗口均20秒，当前门屏、原物、许可或条件改变即可能失效。普通处理仍保留实际用时、精力与损耗。</p>
        </section>
      </>}
      <details className="seer-fold"><summary>本案已观察的情况与旧经历</summary>
        <ul>{selectedCase?.observations.map((observation, index) => <li key={index}>{copy(observation)}</li>)}</ul>
        <p>{copy(value.inheritedTools)}</p><p>旧封存室、中转室和旧人物的历史位置不会变成本附室的在场许可；晋升不启动新的六十年周期或即时复生。</p>
      </details>
    </section>;
  }

  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    return <section aria-label="苍白皇帝可选真实交战">
      <h3>{copy(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{copy(encounter.story)}</p>
      <p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。自己的身体、精神、原棍与有限灵印独立保留。</p>
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4>
        <p>当前策略：{POLICIES[encounter.policy]}。{encounter.policyConfirmed ? '本场明确选择已经保存。' : '等待本场明确选择，默认显示不代表已经确认。'}开战后不能更换。</p>
        <p>可只用已学能力、只允许残响安定、只允许灵迹阻隔、允许两项新能力，或只作普通行动。选择只保存策略，不施法、不购买材料，也不开始战斗。</p>
      </section>
      <section aria-label="战场位置与有限原物"><h4>前庭位置与有限原物</h4>
        <p>本人在{scene.playerLocation === 'FORECOURT' ? '附室外独立前庭' : '前庭外普通路'}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；累计实走{scene.playerTravelMetres}米，现场经过{scene.clockSeconds}秒。普通出口开放，离场仍须实际步行。</p>
        <p>当前视线{scene.visibleBodyLine ? '可通' : '受阻'}；{scene.observedConditionVersion === scene.conditionVersion ? '已有本条件下的实际观察' : '条件已改变或尚未实际观察'}。诺拉与旧场人物均不在本场。</p>
        <p>同一根{materials.weapon.massKg}千克原棍{materials.weapon.location === 'HAND' ? '在阿尔登手中' : '落在前庭地面'}，完整度{materials.weapon.condition}/100。原灵印剩余{materials.marks.remaining}/{materials.marks.capacity}枚，已经耗尽{materials.marks.pieces.filter(mark => mark.state === 'SPENT').length}枚，不会补充。</p>
        <p>原遮屏{materials.screen.hood === 'OPEN' ? '打开' : '关闭'}，耐久{materials.screen.durability}/100，实际操作{materials.screen.operations}次；原门{materials.door.state === 'OPEN' ? '打开' : '关闭'}。遮挡会改变当前视线和作用条件。</p>
        <p>对手实际使用苍白冲击{enemy.powerUses.PALE_STRIKE}次、灵性压力{enemy.powerUses.SPIRIT_PRESSURE}次、定神{enemy.powerUses.STEADY}次、关闭遮屏{enemy.powerUses.CLOSE_SCREEN}次。苍白冲击每次耗7灵性与1枚原灵印，灵性压力耗7灵性，定神耗6灵性，关闭遮屏耗3灵性；耗尽后使用可行的普通动作。</p>
      </section>
      <section aria-label="实战的有限残响作用"><h4>只影响随后的一次合格作用</h4>
        <p>残响安定：8灵性、2精神，意志18及实际抵抗。20秒内只减少已观察同一来源下一次实际灵性压力30。灵迹阻隔：7灵性、2精神，知识18及实际抵抗，20秒内只减轻随后一次合格灵性或精神冲击30。</p>
        <p>身体棍击不在这两项能力的保护范围；已经结算的伤害不会改写。没有实际合格作用命中，窗口到期就结束，不增加掌握。施放成功不保证窗口之后仍有效。</p>
        <p>每个实际行动5秒，每轮60秒；继续下一轮只恢复本人12灵性，对手不会自动恢复。精神耗尽仍可活着停战，真实身体死亡终结本周目。</p>
        <p>{copy(value.inheritedTools)}</p>
      </section>
      <details className="seer-fold"><summary>交战消耗、抵抗与作用范围</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{copy(fact)}</li>)}</ul></details>
    </section>;
  }
}
