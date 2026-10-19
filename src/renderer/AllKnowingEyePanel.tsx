import { useEffect, useRef, useState } from 'react';
import { playerText } from '../shared/player-text.js';
import type { AllKnowingEyeAction, AllKnowingEyeCommand, AllKnowingEyeProjection } from '../domain/all-knowing-eye/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'LEAVE', 'WITHDRAW_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP_METHOD', 'HAND_STOP', 'RETRIEVE_SLIDER', 'CLEAR_SIGHTLINE', 'RETURN_PAPERS', 'RETURN_RIG', 'EXIT_ROOM']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已安全中止，待普通续办', ACTIVE: '尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '已结束' };
const ENEMY_STATUS = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const PERMISSION = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回', CLOSED: '本次许可已结束' };
const WINDOW = { NONE: '尚未尝试', ACTIVE: '等待实际应用', FAILED: '判定失败', CHECK_FAILED: '后续独立操作失败', APPLIED: '已经实际应用', STOPPED: '已经停止', EXPIRED: '已经到期', INVALIDATED: '条件改变，已经失效' };
const POLICIES = { INHERITED_ONLY: '只用已学能力', BOUNDED_INSIGHT: '允许现场洞察', PENDING_FORECAST: '允许先机预判', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };

export interface AllKnowingEyePanelProps {
  value: AllKnowingEyeProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: AllKnowingEyeCommand) => void;
  onClose?: () => void;
}

/** The view never changes resources or manufactures commands: it submits a current public action verbatim. */
export function AllKnowingEyePanel({ value, busy, blocked = false, error = null, onCommand, onClose }: AllKnowingEyePanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: AllKnowingEyeAction; facts: string } | null>(null);
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

  function choose(action: AllKnowingEyeAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: AllKnowingEyeAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function actionControl(action: AllKnowingEyeAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `all-knowing-eye-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{copy(action.label)}</strong><span className="slice-modifiers">{copy(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`all-knowing-eye-reason-${action.id}`}>{copy(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="全知之眼当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="全知之眼当前资源">
      <h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>晋升、停止与归还原物不会免费恢复身体，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="全知之眼成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{copy(value.title)}</h2>
      <section aria-label="全知之眼阶段总览"><p>当前阶段：{inEncounter ? '可选真实遭遇' : value.promoted ? life.reflected ? '生活报告与反思已完成' : '原房间的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p><p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 全知之眼扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p></section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : copy(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">
        {value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="全知之眼目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked}
          onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{copy(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：院外的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{copy(bottle.title)} · {copy(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="全知之眼其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{copy(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {originalFacts()}
      {!value.promoted ? <section aria-label="全知之眼服药准备">
        <p>{copy(value.digestion)}</p><p>{copy(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{copy(selectedBottle.title)}</h3><p>{copy(selectedBottle.source)}</p><p>{copy(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{copy(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留智慧天使。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{copy(value.risk)}</p><p>{copy(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{copy(value.digestion)}</p><p>{copy(value.appearanceRecord)}</p><p>{copy(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{copy(ability.label)} · 掌握{ability.mastery}</h3><p>{copy(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{copy(value.environment)}关闭页面不会代替停止作用、归还原物与沿原路离开；已经发生的事件与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="全知之眼操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{copy(live?.label ?? '现场已变化')}</h3>
      <p>{live && copy(live.cost)}</p>
      {confirmedBottle && <><p>{copy(confirmedBottle.title)} · {copy(confirmedBottle.status)}</p><p>{copy(confirmedBottle.source)}</p><p>当前成功率{confirmedBottle.chance}%</p>
        <p>{copy(value.risk)}</p><p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。本阶不改变性别、姓名、年龄、性格与取向。也可取消并继续停留智慧天使。</p></>}
      {live?.command.type === 'BOUNDED_INSIGHT' && <p>本次消耗6灵性、2精神，知识18。成功只为30秒内、条件未变的一次后续独立交接核验提供+10帮助；仍须实际核验，不能揭示未观察的事实。失败、未应用或失效均保留已付代价，不增加掌握。</p>}
      {live?.command.type === 'PENDING_FORECAST' && <p>本次消耗8灵性、3精神，感知18。须亲眼观察已架起而尚未释放的同一滑块；成功只为30秒内一次后续独立接取提供+10帮助。方向改变、视线遮挡或撤回许可会使窗口失效，仍可普通手动制停。</p>}
      {live?.command.type === 'BUY_RIG' && <p>实付30便士、1行动，取得这套独立的无动力滑块和止动块。不会补充原示范器的储能；以后仍须亲手架起、接取或制停并收回同一原件。</p>}
      {live?.command.type === 'INVITE' && <p>本次邀请实付10便士、1行动；选择普通方法或能力帮助都须当面重新取得本次许可。拒绝、撤回或中途停止不退已付费用。</p>}
      {live?.command.type === 'WITHDRAW_CONSENT' && <p>撤回只停止未来的能力作用；已付代价与真实结果保留。必要的普通手动制停、拾取、还物和离开仍可继续。</p>}
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

  function originalFacts() {
    const place = { OUTSIDE: '原房间外的普通道路', EXIT: '原门外出口', TABLE: '原桌前', PLAYER: '本人手中' };
    return <details className="seer-fold"><summary>原房间、玛拉与旧物当前记录</summary>
      <section aria-label="原房间当前状态"><h3>同一房间与同两张原纸</h3>
        <p>{life.mara.name} · {life.mara.age}岁，{life.mara.alive ? '存活' : '已经死亡'}；健康{life.mara.health}/100、精神{life.mara.mind}/100，当前在{place[life.mara.location]}，累计实走{life.mara.travelMetres}米。</p>
        <p>原房间通路长{life.room.pathMetres}米；原门{life.room.exitOpen ? '开放，普通路线畅通' : '受阻'}。纸页、器具与人体各有实际位置，打开页面不会移动任何人或物。</p>
        {life.papers.map((paper, index) => <section key={paper.id}><h4>第{index + 1}张原纸</h4>
          <p>{paper.location === 'TABLE' ? '仍在原桌上' : '本人实际持有'}；{paper.firstReadWeek === null ? '尚无实际阅读记录' : `首次实际阅读：第${paper.firstReadWeek}周`}。</p>
          <p>{paper.text === null ? '尚未实际读过这张原纸。' : copy(paper.text)}</p>
        </section>)}
        <p>同一原示范器{life.device.location === 'TABLE' ? '仍在原桌上' : '由本人实际持有'}，剩余储能{life.device.charges}格；{life.device.filter === 'AMBER' ? '琥珀滤片' : life.device.filter === 'CLEAR' ? '透明滤片' : '尚未实际观察滤片'}，条件版本{life.device.conditionVersion}；已实做{life.device.demonstrations}次演示、实际换滤片{life.device.filterChanges}次。旧储能不会自动恢复，新滑块不用这台器具供能。</p>
        <p>当前身体：{value.currentGender === 'FEMALE' ? '女性' : value.currentGender === 'MALE' ? '男性' : '按本人记录'}。本阶不改变性别、姓名、年龄、性格与取向；过去的死亡与已发生的伤害不会撤销。</p>
      </section>
    </details>;
  }
  function lifeFacts() {
    const attempt = selectedCase?.attempts.at(-1), rig = life.rig, pendingWindow = life.pending;
    const current = selectedCase?.id === life.activeCase && selectedCase.contactOpen && !!attempt && !attempt.closed;
    const permissionText = (permission: keyof typeof PERMISSION) => permission === 'GRANTED' && !current ? '本案曾明确同意，当前无生效许可' : PERMISSION[permission];
    const seconds = pendingWindow ? Math.max(0, pendingWindow.expiresAt - life.clockSeconds) : 0;
    const currentWindow = current && attempt.method === 'ABILITY' && life.mara.present && life.irena.present && life.playerLocation === 'TABLE'
      && life.room.exitOpen && life.mara.location === 'TABLE' && life.irena.location === 'TABLE' && Object.values(attempt.permission).every(permission => permission === 'GRANTED')
      && pendingWindow?.caseId === selectedCase.id && pendingWindow.permissionVersion === attempt.permissionVersion
      && pendingWindow.conditionVersion === rig.conditionVersion && seconds >= 4;
    const insightOpen = currentWindow && pendingWindow.kind === 'INSIGHT' && attempt.insight.state === 'ACTIVE'
      && attempt.readFirst && attempt.readSecond && attempt.handoverObserved && !attempt.papersReturned && life.papers.every(paper => paper.location === 'PLAYER') && !attempt.handoverAttempted;
    const forecastOpen = currentWindow && pendingWindow.kind === 'FORECAST' && attempt.forecast.state === 'ACTIVE'
      && rig.location === 'TABLE' && rig.motion === 'COCKED' && rig.sliderLocation === 'RIG' && rig.sightline === 'CLEAR'
      && attempt.observedVersions.includes(rig.conditionVersion) && !attempt.catchAttempted;
    const location = { OUTSIDE: '原房间外的普通道路', EXIT: '原门外出口', TABLE: '原桌前', AWAY: '已经离场' };
    const spent = life.ledger.reduce((total, receipt) => ({
      actions: total.actions + Math.max(0, receipt.before.actions - receipt.after.actions),
      cash: total.cash + Math.max(0, receipt.before.cash - receipt.after.cash),
      spirituality: total.spirituality + Math.max(0, receipt.before.spirituality - receipt.after.spirituality),
      mind: total.mind + Math.max(0, receipt.before.mind - receipt.after.mind),
      health: total.health + Math.max(0, receipt.before.health - receipt.after.health),
    }), { actions: 0, cash: 0, spirituality: 0, mind: 0, health: 0 });
    return <section aria-label="全知之眼生活练习">
      <h3>{copy(selectedCase?.title ?? life.title)}</h3><p>{copy(selectedCase?.story ?? life.story)}</p>
      {selectedCase?.result && <p className="slice-notice">{copy(selectedCase.result)}</p>}
      <section aria-label="本案的独立许可"><h4>分别确认本次许可</h4>
        <p>{life.mara.name} · {life.mara.age}岁，当前在{location[life.mara.location]}；{life.irena.name} · {life.irena.age}岁，当前{life.irena.location === 'AWAY' ? '已经离场' : `在${location[life.irena.location]}`}。两人保有独立意愿。</p>
        <ul><li>原纸与场地许可：{permissionText(attempt?.permission.owner ?? 'UNASKED')}。</li>
          <li>技师本次参与许可：{permissionText(attempt?.permission.technician ?? 'UNASKED')}。</li>
          <li>本人使用能力：{permissionText(attempt?.permission.ability ?? 'UNASKED')}。</li></ul>
        <p>每次邀请实付10便士、1行动，每案重新询问。自己的决定不能代替他人同意；旧案许可不延续。撤回会停止未来能力作用，必要的普通手动制停、拾取、还物与离开仍可继续。</p>
      </section>
      <section aria-label="实际位置与归还"><h4>同一房间、实际身体与普通退路</h4>
        <p>本人在{location[life.playerLocation]}；本阶段累计实走{life.playerTravelMetres}米，现场时钟{life.clockSeconds}秒，本阶段实际经过{life.elapsedSeconds}秒。</p>
        <p>原门到原桌单程{life.room.pathMetres}米，进入与退出都须实际行走。{life.mara.name}累计实走{life.mara.travelMetres}米，{life.irena.name}累计实走{life.irena.travelMetres}米。原门{life.room.exitOpen ? '开放' : '受阻'}。</p>
        <p>{selectedCase?.returned ? '本案原纸、滑块与人员的实际收尾已完成。' : '关闭页面不能代替手动制停、取回滑块、归还原纸并沿原路退出。'}</p>
      </section>
      <section aria-label="独立无动力滑块"><h4>同一滑块与止动块</h4>
        <p>{rig.purchasedWeek === null ? `尚未取得；购买需${rig.price}便士、1行动。` : `第${rig.purchasedWeek}周已实付${rig.price}便士取得。`}
          当前{rig.location === 'SUPPLIER' ? '由技师保管' : rig.location === 'PLAYER' ? '由本人实际携带' : '实际放在原桌上'}；不用电力或灵性供能。</p>
        <p>滑块{rig.sliderLocation === 'RIG' ? '在原滑架上' : rig.sliderLocation === 'STOP_BLOCK' ? '在原止动块处' : '在地面，尚须拾取'}，{rig.motion === 'COCKED' ? '已经手动架起，尚未释放' : rig.motion === 'STOPPED' ? '已经实际停止' : '尚未架起'}；方向{rig.direction === 'LEFT' ? '向左' : '向右'}，视线{rig.sightline === 'CLEAR' ? '畅通' : '已被遮挡'}，条件版本{rig.conditionVersion}。</p>
        <p>实际移动{rig.movements}次、成功接取{rig.catches}次、手动制停{rig.manualStops}次。止动块仍是同一原件，买下与架起都不等于已经完成接取。</p>
      </section>
      <section aria-label="两项能力的有限窗口"><h4>只帮助一次后续真实操作</h4>
        <p>现场洞察：6灵性、2精神，知识18。须本次实读两张原纸并观察眼前交接；成功后30秒内，只为条件未变的一次独立交接核验提供+10帮助。</p>
        {insightOpen ? <p>现场洞察还剩{seconds}秒，等待一次真实交接核验。</p> : <p>当前没有可应用的现场洞察窗口；仍可普通比较原纸并核对交接。</p>}
        <p>先机预判：8灵性、3精神，感知18。须看见已架起、尚未释放的同一滑块；成功后30秒内，只为一次后续独立接取提供+10帮助。</p>
        {forecastOpen ? <p>先机预判还剩{seconds}秒，等待一次真实释放与接取。</p> : <p>当前没有可应用的先机预判窗口；仍可普通手动制停并取回原滑块。</p>}
        <p>施放本身不完成核验或接取，也不增加掌握。时间到期、方向改变、视线遮挡或许可撤回都会使未用窗口失效；不改写过去，不保证未来，也不揭示未观察的身份或罪责。</p>
        {attempt && <>
          <p>现场洞察：{attempt.insight.tier === null ? '尚未判定' : TIER[attempt.insight.tier]}，{attempt.insight.state === 'ACTIVE' && !insightOpen ? '原窗口当前不能应用' : WINDOW[attempt.insight.state]}，实际应用{attempt.insight.effects}次；先机预判：{attempt.forecast.tier === null ? '尚未判定' : TIER[attempt.forecast.tier]}，{attempt.forecast.state === 'ACTIVE' && !forecastOpen ? '原窗口当前不能应用' : WINDOW[attempt.forecast.state]}，实际应用{attempt.forecast.effects}次。</p>
          <p>后续独立交接核验：{attempt.handoverTier === null ? '尚未判定' : TIER[attempt.handoverTier]}；后续独立接取：{attempt.catchTier === null ? '尚未判定' : TIER[attempt.catchTier]}。失败与未应用窗口不增加掌握；每案每项新能力只在成功且实际应用后增加8掌握。</p>
          {attempt.handoverObservation && <p>本次所见：{copy(attempt.handoverObservation)}</p>}
        </>}
      </section>
      <p>本阶段生活已付：{spent.actions}行动、{spent.cash}便士、{spent.spirituality}灵性、{spent.mind}精神、{spent.health}健康。停止与还物不退已付代价。</p>
      {selectedCase && selectedCase.attempts.length > 1 && <details className="seer-fold"><summary>此前尝试与已付代价</summary>
        {selectedCase.attempts.slice(0, -1).map((previous, index) => <p key={`${previous.week}-${index}`}>第{previous.week}周：{previous.method === 'ABILITY' ? '曾选择能力帮助' : '普通续办'}；已付{previous.spiritualitySpent}灵性、{previous.mindSpent}精神，实走{previous.playerTravelMetres}米。现场洞察{previous.insight.tier === null ? '未判定' : TIER[previous.insight.tier]}、实际应用{previous.insight.effects}次；先机预判{previous.forecast.tier === null ? '未判定' : TIER[previous.forecast.tier]}、实际应用{previous.forecast.effects}次。原失败与已付代价保留。</p>)}
      </details>}
      <details className="seer-fold"><summary>本案范围、普通替代与退路</summary><ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        <p>{copy(life.environment)}</p><p>{life.reflected ? '三案报告与反思已保存。' : '三份报告各25扮演、反思25；普通完成同样有效，须先实际收束现场。'}</p>
      </details>
    </section>;
  }
  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    return <section aria-label="全知之眼可选真实交战">
      <h3>{copy(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{copy(encounter.story)}</p>
      <p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。他有自己的身体、精神、意愿与原杆。</p>
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4>
        <p>当前策略：{POLICIES[encounter.policy]}。{encounter.policyConfirmed ? '本场明确选择已经保存。' : '等待本场明确选择，默认显示不代表已经确认。'}开战后不能更换。</p>
        <p>可只用已学能力、只允许现场洞察、只允许先机预判、允许两项新能力，或只作普通行动。选择只保存策略，不施法、不购买原物，也不开始战斗。</p>
      </section>
      <section aria-label="战场位置与普通出口"><h4>可见动作与普通退路</h4>
        <p>本人在{scene.playerLocation === 'YARD' ? '独立石院内' : '石院外原路'}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；累计实走{scene.playerTravelMetres}米，现场经过{scene.clockSeconds}秒。普通出口开放，生还离场须实际走过4米。</p>
        <p>身体冲击路线{scene.visibleBodyLine ? '当前可见' : '当前不可见'}，当前条件版本{scene.conditionVersion}；{scene.observedConditionVersion === null ? '尚无本场实际观察' : `最近实际观察版本${scene.observedConditionVersion}`}。看见路线不等于已经出现待发攻击，旧观察不能保证未来。</p>
        <p>{life.mara.name}和{life.irena.name}在本场之外。原维克托的接触与交战记录独立保留；新对手不会替换旧人物或撤销旧结局。</p>
      </section>
      <section aria-label="对手原杆与有限资源"><h4>{enemy.name}自己的原杆</h4>
        <p>同一根{materials.weapon.massKg}千克原杆{materials.weapon.location === 'HAND' ? '仍在对手手中' : '已落在石院地面'}，完整度{materials.weapon.condition}/100；可见闪光储能{materials.weapon.charge}/{materials.weapon.capacity}。每次闪光实际消耗1格及7灵性，用尽后不会补充或转入本人库存。</p>
        <p>对手已实际使用闪光{enemy.powerUses.FLASH}次、精神压力{enemy.powerUses.MIND_PRESSURE}次、护术{enemy.powerUses.WARD}次、改变节奏与遮挡{enemy.powerUses.FEINT}次。护术消耗6灵性，精神压力消耗7灵性，变招消耗3灵性。</p>
      </section>
      <section aria-label="已有样本与原微光片"><h4>已经学会与实际持有的旧物</h4>
        <p>{encounter.flashSample.learnedWeek === null ? '闪光样本尚未实际学会。' : `闪光样本在第${encounter.flashSample.learnedWeek}周实际学会，仍须满足原使用条件。`}</p>
        <ul>{encounter.crafts.map(craft => <li key={craft.id}>{craft.id}：第{craft.createdWeek}周以原材料{craft.sourceKitId}制成，{craft.status === 'PLAYER' ? '本人尚持有同一原片' : `第${craft.usedWeek}周已实际耗尽`}。</li>)}</ul>
        <p>当前尚持有{encounter.remainingCraftIds.length}枚；使用只耗尽所选的实际原片，旧材料与已耗尽原片不会补回。</p>
      </section>
      <section aria-label="实战的有限能力"><h4>只影响之后的一次真实动作</h4>
        <p>现场洞察每轮最多一次：6灵性、2精神、知识18，须实际观察并通过抵抗。30秒内只为同一条件下下一次独立的本人行动提供+10帮助，不能重算已经完成的动作。</p>
        <p>先机预判每轮最多一次：8灵性、3精神、感知18，须实际观察并通过抵抗。30秒内只削弱随后一次可见身体冲击30，不能挡住精神压力。</p>
        <p>换轮、时间到期、条件改变或视线遮挡都会使未用窗口失效。失败、空窗口、失效或未实际应用都不增加掌握。</p>
        <p>{copy(value.inheritedTools)}</p>
      </section>
      <details className="seer-fold"><summary>交战消耗、抵抗与有限窗口</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{copy(fact)}</li>)}</ul></details>
    </section>;
  }
}
