import { useEffect, useRef, useState } from 'react';
import type { MercurySnakeAction, MercurySnakeCommand, MercurySnakeProjection } from '../domain/mercury-snake/types';
import { playerText } from '../shared/player-text.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const CLEANUP_ORDER = ['LEAVE', 'LEAVE_ENCOUNTER', 'LEAVE_PREPARATION', 'RETURN_PIECE', 'RETURN_TO_ENTRY', 'TAKE_PIECE', 'RETURN_TO_A', 'PUSH_BACK', 'RETURN_PARCEL', 'RETURN_OBJECT', 'RESTORE_VIEW', 'ABORT', 'STOP_METHOD', 'WITHDRAW_CONSENT'];
const CLEANUP = new Set(['ABORT', 'STOP_METHOD', 'TAKE_PIECE', 'RETURN_TO_A', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'PUSH_BACK', 'RETURN_PARCEL', 'RETURN_OBJECT', 'RESTORE_VIEW', 'LEAVE', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '尚未收束', EXAMINED: '待报告', RESOLVED: '已收束', CANCELLED: '已取消' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '仅同意本次有限练习', DECLINED: '已拒绝本次练习', REVOKED: '已撤回同意', WITHDRAWN: '已撤回同意', CLOSED: '本次接触已结束', ORDINARY: '仅同意普通处理' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const LOCATION: Record<string, string> = { START: '原门口', A: '四米处', B: '八米处', C: '另一原挡处', OUTSIDE: '室外', YARD: '独立小院' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface MercurySnakePanelProps {
  value: MercurySnakeProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: MercurySnakeCommand) => void;
  onClose?: () => void;
}

/** Only saved public facts are displayed; every operation remains a domain intent. */
export function MercurySnakePanel({ value, busy, blocked = false, error = null, onCommand, onClose }: MercurySnakePanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: MercurySnakeAction; facts: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  const facts = JSON.stringify(value);
  const locked = busy || blocked || error !== null || pending || value.resources?.health === 0;
  const { life, encounter } = value;
  // Display authored prose only; commands, identifiers and custom names stay exact.
  const prose = (text: string) => value.characterName ? text.split(value.characterName).map(playerText).join(value.characterName) : playerText(text);
  const encounterActionIds = new Set(encounter.actions.map(action => action.id));
  const activeCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === 'PREPARED');
  const selectedCase = activeCase ?? life.cases.find(entry => entry.id === goal)
    ?? life.cases.find(entry => !['RESOLVED', 'CANCELLED'].includes(entry.status)) ?? life.cases[0];
  const selectedBottle = value.bottles.find(bottle => bottle.id === goal)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const inEncounter = encounter.inside || (!activeCase && value.promoted && goal === 'encounter');
  const inside = value.insideCase || life.insideCase || encounter.inside;
  const complete = life.reflected && life.cases.every(entry => entry.status === 'RESOLVED');
  const encounterComplete = ['RESOLVED', 'RETREATED', 'LOST'].includes(encounter.status);
  const entries = value.actions.filter(action => inEncounter ? !encounterComplete && encounterActionIds.has(action.id)
    : value.promoted ? !complete && !ACQUISITION.has(action.command.type) && !encounterActionIds.has(action.id)
      && (!('caseId' in action.command) || action.command.caseId === selectedCase?.id)
      : ACQUISITION.has(action.command.type) && (!('bottleId' in action.command) || action.command.bottleId === selectedBottle?.id));
  const next = entries.find(action => action.enabled && action.id === value.preferredActionId)
    ?? entries.find(action => action.enabled && action.preferredAction)
    ?? entries.find(action => action.enabled && !CLEANUP.has(action.command.type) && action.command.type !== 'WITHDRAW_CONSENT')
    ?? entries.find(action => action.enabled) ?? entries[0];
  const cleanup = entries.filter(action => action !== next && action.enabled && (action.cleanup || CLEANUP.has(action.command.type) || action.command.type === 'WITHDRAW_CONSENT'))
    .sort((a, b) => CLEANUP_ORDER.indexOf(a.command.type) - CLEANUP_ORDER.indexOf(b.command.type)).slice(0, 2);
  const alternatives = entries.filter(action => action !== next && !cleanup.includes(action));
  const live = confirmation?.facts === facts ? value.actions.find(action => action.id === confirmation.action.id
    && JSON.stringify(action.command) === JSON.stringify(confirmation.action.command)) : undefined;
  const confirmedBottleId = live?.command.type === 'CONSUME' ? live.command.bottleId : null;
  const confirmedBottle = value.bottles.find(bottle => bottle.id === confirmedBottleId);
  const attempt = selectedCase ? (life.activeCase === selectedCase.id ? life.currentAttempt : null) ?? selectedCase.attempts.at(-1) ?? null : null;

  const phase = `${value.promoted ? 'life' : 'acquisition'}:${inEncounter ? 'encounter' : selectedCase?.id}:${next?.id}`;
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
  }, [confirmation]);

  function choose(action: MercurySnakeAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: MercurySnakeAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function resources() {
    const current = value.resources;
    return current && <section aria-label="水银之蛇当前资源">
      <h3>当前身体与资源</h3>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining}</p>
      <p>当前唯一幸运储备{value.luck.stored}/{value.luck.capacity} · 累计储存{value.luck.accumulated} · 已实际花费{value.luck.spent}。历史记录不能再次支用。</p>
      <p>原伤势{value.injuries.length}处 · 伤势风险{value.injuryRisk}。已付灵性、精神和费用照实保留；重启不恢复健康、旧伤、时间或已花费用。</p>
    </section>;
  }
  function actionControl(action: MercurySnakeAction) {
    return <div key={action.id} className="seer-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `mercury-snake-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{prose(action.label)}</strong><span className="slice-modifiers">{prose(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`mercury-snake-reason-${action.id}`}>{prose(action.reason)}</p>}
    </div>;
  }

  return <section className="seer-panel" aria-label="水银之蛇成长" aria-busy={busy || pending}>
    <h2 ref={heading} tabIndex={-1}>{prose(value.title)}</h2>
    <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : complete && !inEncounter ? '三案已结束，可返回普通生活；小院交战由你另行选择。' : inEncounter && encounterComplete ? '旁院经历已经结束，原物、费用与实际结果保留；可返回普通生活。' : prose(next?.label ?? value.nextStep)}</p>
    {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
    {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
    {resources()}
    {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
    <nav aria-label="水银之蛇目标">
      {value.promoted ? <>
        {life.cases.map(entry => <button key={entry.id} className="slice-button quiet" disabled={locked || inside || confirmation !== null || !['RESOLVED', 'CANCELLED'].includes(entry.status) && !life.actions.some(action => 'caseId' in action.command && action.command.caseId === entry.id)}
          aria-pressed={!inEncounter && selectedCase?.id === entry.id} onClick={() => setGoal(entry.id)}>{entry.title} · {STATUS[entry.status] ?? entry.status}</button>)}
        <button className="slice-button quiet" disabled={locked || inside || confirmation !== null} aria-pressed={inEncounter} onClick={() => setGoal('encounter')}>可选小院交战</button>
      </> : value.bottles.map(bottle => <button key={bottle.id} className="slice-button quiet" disabled={locked || life.insideCase || encounter.inside || confirmation !== null}
        aria-pressed={selectedBottle?.id === bottle.id} onClick={() => setGoal(bottle.id)}>{bottle.title} · {bottle.status}</button>)}
    </nav>
    {!value.promoted ? <>
      <p>{prose(value.supplies)}</p><p>{prose(value.risk)}</p>
      {selectedBottle && <section aria-label="独立原药瓶"><h3>{prose(selectedBottle.title)}</h3><p>{prose(selectedBottle.source)}</p><p>{selectedBottle.status} · 当前成功率{selectedBottle.chance}%</p></section>}
      <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{prose(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
      <p>当周服药场地准备：{value.preparedWeek === null ? '未完成' : `第${value.preparedWeek}周已支付，取消不退款`}。可选择继续停留先知。</p>
    </> : inEncounter ? encounterFacts() : lifeFacts()}
    {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
    {cleanup.length > 0 && <section aria-label="停止与普通退出"><h3>停止与普通退出</h3>{cleanup.map(actionControl)}</section>}
    {alternatives.length > 0 && <details><summary>其他操作、普通替代与退出</summary>{alternatives.map(actionControl)}</details>}
    <details><summary>能力、消化与继承经历</summary>
      <p>{prose(value.appearanceRecord)}</p><p>{prose(value.digestion)}</p><p>{prose(value.inheritedTools)}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{prose(entry)}</li>)}</ul>
      {value.abilities.map(ability => <section key={ability.id}><h3>{prose(ability.label)} · 掌握{ability.mastery}</h3><p>{prose(ability.description)}</p></section>)}
    </details>
    <details><summary>原机械工坊与普通退路</summary><p>{prose(value.environment)}</p><p>关闭页面不会代为停止、把原车推回、交还连接片或沿原路离场；已付代价、原物变化与旧伤保留。</p></details>
    {confirmation && <section role="dialog" aria-modal="true" aria-label="水银之蛇操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{prose(live?.label ?? '现场已变化')}</h3><p>{live ? prose(live.cost) : ''}</p><p>{prose(!value.promoted ? value.risk : inEncounter ? encounter.story : life.environment)}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.status}</p><p>{prose(confirmedBottle.source)}</p><p>当前成功率{confirmedBottle.chance}%</p></>}
      {live?.command.type === 'CONSUME' && <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备；失败保留已付代价。也可取消并继续停留先知。</p>}
      {resources()}{live?.reason && <p className="seer-action-reason">{prose(live.reason)}</p>}
      <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
      <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button>
      <p>取消不提交。关闭页面不能替代实际停止、交还原物和步行离场。</p>
    </section>}
  </section>;

  function lifeFacts() {
    const site = life.site, piece = life.pieces.find(entry => entry.caseId === selectedCase?.id);
    const currentScene = life.activeCase === selectedCase?.id;
    const relation = currentScene ? life.captured : null;
    const pendingWindow = currentScene ? life.pending : null;
    const owner = (id: string) => id === site.guide.id ? `原导师${site.guide.name}` : id === site.volunteer.id ? site.volunteer.name : '已变化的主人，须重新核对';
    const parcelLocation = site.parcel.location === 'CW3-CART' ? `在同一原车上，随车实际在${LOCATION[site.cart.location]}`
      : site.parcel.location === 'VERA' ? '由薇拉实际持有' : `实际在${LOCATION[site.parcel.location]}`;
    const castCount = attempt ? Number(attempt.restartTier !== null) + Number(attempt.anchorTier !== null) : 0;
    const returnLabel = attempt?.returnKind === 'RESTART' ? '同一车与原包已通过局部重启返回'
      : attempt?.returnKind === 'ORDINARY' ? '原物已通过普通推回或搬运归位，不计能力掌握' : '原物尚未完成返回';
    const windowEnd: Record<string, string> = { NONE: '尚无维系', ACTIVE: '联系仍在维系', FAILED: '尝试失败', APPLIED: '已实际应用一次', EXPIRED: '已经到期', MOVED: '位置改变后失效', STOPPED: '已经停止', WITHDRAWN: '许可撤回后失效', OCCLUDED: '视线遮挡后失效', CONDITION_CHANGED: '原物条件改变后失效' };
    return <section aria-label="水银之蛇原场事务">
      <h3>{prose(selectedCase?.title ?? life.title)}</h3><p>{prose(selectedCase?.story ?? life.story)}</p>
      <p>{prose(life.environment)}</p>
      {selectedCase?.result && <p className="slice-notice">{prose(selectedCase.result)}</p>}
      <section aria-label="原成年协作者的实际位置">
        <h4>{site.volunteer.name} · {site.volunteer.age}岁</h4>
        <p>薇拉实际在{LOCATION[site.volunteer.location]}；原导师{site.guide.name}实际在{LOCATION[site.guide.location]}。同一身体与原身份保留。</p>
        <p>薇拉健康{site.volunteer.health} · 精神{site.volunteer.mind} · 灵性{site.volunteer.spirituality} · 原伤势{site.volunteer.injuries.length}处。</p>
        <p>本人实际在{LOCATION[life.playerLocation]}，累计普通步行{life.playerTravelMetres}米，原现场时钟{life.clockSeconds}秒。现场时间只向前走。</p>
        <p>本阶段协作实际消耗薇拉{life.volunteerMindSpent}精神；不替旧身体生成新的精力储备。</p>
      </section>
      <section aria-label="同一原车与封包的实际位置和所有权">
        <h4>原车与唯一原封包</h4>
        <p>同一原车{site.cart.quantity}辆，归{owner(site.cart.owner)}所有，实际在{LOCATION[site.cart.location]}；当前由{site.cart.control === 'PLAYER' ? '本人' : '原导师'}控制。</p>
        <p>同一原封包{site.parcel.quantity}件，{site.parcel.massGrams}克，{site.parcel.sealed ? '封口完整' : '封口已变化'}，归{owner(site.parcel.owner)}所有；{parcelLocation}。</p>
        <p>原车累计实际释放{site.cart.releases}次、返回{site.cart.returns}次。重启只可能移动仍实际存在的同一车包；释放经历和费用照实保留。</p>
      </section>
      <section aria-label="原袋原签与原转盘">
        <h4>原袋、两原签和原转盘</h4>
        <p>原不透明袋{site.pouch.quantity}个，归{owner(site.pouch.owner)}所有，由薇拉持有；原签共{site.tags.reduce((count, tag) => count + tag.quantity, 0)}枚，{site.tags.filter(tag => tag.location === 'POUCH').length}枚在同一原袋内。</p>
        <p>{site.tags.map((tag, index) => `第${index + 1}枚原签归${owner(tag.owner)}所有，${tag.location === 'POUCH' ? '仍在原袋内' : '由薇拉亲手持有'}`).join('；')}。</p>
        <p>同一原转盘在{LOCATION[site.disc.location]}，归{owner(site.disc.owner)}所有，原指针{site.disc.pointer === null ? '尚未指向结果' : `仍指向${site.disc.pointer === 'A' ? '甲' : '乙'}区`}；同一原记录在{LOCATION[site.record.location]}。本案不重抽原签或原盘。</p>
      </section>
      {selectedCase && <p>本案原物许可：{CONSENT[selectedCase.permission.OWNER]}；具体能力许可：{CONSENT[selectedCase.permission.ABILITY]}。每案分别询问，随时可以拒绝或撤回。</p>}
      {piece ? <section aria-label="本案实际购入的有限连接片">
        <h4>本案唯一连接片</h4>
        <p>第{piece.boughtWeek}周实付{piece.paidPennies}便士购入{piece.quantity}件；当前{piece.location === 'HAND' ? '由本人持有' : piece.location === 'STAND' ? '在四米处原台上' : '已经实际交还'}，累计随本人移动{piece.travelMetres}米。</p>
        <p>实际用量剩余{piece.charges}/{piece.initialCharges} · 实际磨损{piece.wear} · 返回实际使用{piece.returnUses}/1 · 维系实际使用{piece.anchorUses}/1。施术成功不等于已经应用，耗尽不能续充。</p>
        {piece.initialCharges === 2 && <p>本案购入时明确含两份用量：一次维系与一次另行付费的重启，不能让同一份用量支付两次。</p>}
      </section> : <p>本案尚未购入连接片。可取消，或取得原物许可后选择不购片的普通路线。</p>}
      {relation && <section aria-label="有限原物关系记录">
        <h4>已经亲见的同一车包</h4>
        <p>只记录同一辆原车与同一件{relation.parcel.massGrams}克{relation.parcel.sealed ? '密封' : ''}原包在{LOCATION[relation.capturedLocation]}、原包在原车上的关系；两件仍各为一件，分别归{owner(relation.cart.owner)}、{owner(relation.parcel.owner)}所有。</p>
        <p>记录于原现场第{relation.capturedAt}秒，原记录期限第{relation.expiresAt}秒；当前原现场第{life.clockSeconds}秒。{relation.valid ? '记录仍有效，实际施用还须核对距离、视线、许可和原物。' : '这份记录已经失效或用毕，不能再次返回。'}</p>
        <p>当前条件记录{life.conditionVersion}，{life.viewBlocked ? '视线已遮挡' : '视线未被遮挡'}。没有记录可供恢复的健康、精神、灵性、日历、金钱或记忆。</p>
      </section>}
      {pendingWindow && <section aria-label="片刻维系的实际二十秒窗口">
        <h4>片刻维系还剩{life.pendingRemainingSeconds}秒</h4>
        <p>只维持这一份原车与原包关系，实际到原现场第{pendingWindow.expiresAt}秒结束。</p>
        <p>{piece?.initialCharges === 2 ? '仍须另付8灵性2精神发动局部重启，成功并实际返回才使用两份有限用量。' : '本案只有一份用量，用于核对维系后撤回的过程，不提供另一次重启；接下来撤回许可，再普通放车与归还。'}</p>
        <p>等待与步行都会推进现场时钟。物件移除、变位、视线遮挡、撤回或到期都会使联系失效，不补回原物，不退已付费用。</p>
      </section>}
      {attempt && <section aria-label="水银之蛇本次实际尝试">
        <h4>本次事实与实际消耗</h4>
        <p>第{attempt.week}周 · {attempt.method === 'ABILITY' ? '有限能力练习' : '普通归还'}；{attempt.closed ? '本次现场已收束' : '本次现场尚未收束'}。</p>
        {attempt.withdrawn && <p>本案许可已真实撤回，未用联系已经失效；只继续普通归物与退出。已完成的真实返回不会撤销。</p>}
        <p>本次实耗{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、{attempt.penniesSpent}便士；实际施术{castCount}次，实际能力应用{attempt.appliedAbilityIds.length}项。</p>
        <p>局部重启检定：{attempt.restartTier ? TIER[attempt.restartTier] : '尚未尝试'}；{attempt.restartApplied ? '已经实际返回一次' : '尚未实际应用'}。片刻维系检定：{attempt.anchorTier ? TIER[attempt.anchorTier] : '尚未尝试'}；{attempt.anchorApplied ? '已经实际辅助一次另付费重启' : '尚未实际应用'}。</p>
        <p>{windowEnd[attempt.windowEnd]}。{returnLabel}。</p>
        <p>本人实际走{attempt.playerTravelMetres}米，原导师实际走{attempt.guideTravelMetres}米，薇拉实际走{attempt.volunteerTravelMetres}米；实际经过{attempt.elapsedSeconds}秒。</p>
        <p>原车{attempt.readCart ? '已亲见' : '尚未亲见'}；原记录{attempt.readOriginal ? '已实际读取' : '尚未实际读取'}；{attempt.released ? '同一车包已经实际释放一次' : '本次尚未释放原车'}。</p>
        <p>{attempt.objectsReturned ? '原车包已实际归主。' : '原车包尚未交还。'}{attempt.returned ? '本案器件或普通流程已实际收尾。' : '本案仍须实际收尾。'}失败费用与普通返回结果都如实保留。</p>
      </section>}
      {selectedCase && selectedCase.observations.length > 0 && <details><summary>本案已取得的记录</summary><ul>{selectedCase.observations.map((fact, index) => <li key={index}>{prose(fact)}</li>)}</ul></details>}
      <details><summary>原现场与普通收尾</summary><p>{prose(life.source)}</p>
        <p>本人从门口走四米到原车旁，再走四米亲读原记录后返回。普通推回只搬动实际存在的车和车上物件；若原包卸下，须另走原路亲手提回。</p>
        <p>没有行动点也可停止、撤回、普通推回、取回连接片、归还原物并沿原路退出。取消与普通返回都不退款，不增加能力掌握。</p>
      </details>
    </section>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, site = encounter.site;
    return <section aria-label="水银之蛇独立小院冲突">
      <h3>{prose(encounter.title)}</h3><p>{prose(encounter.story)}</p>
      {enemy && <section aria-label="独立对手的原身体与原杖">
        <h4>{enemy.name} · {enemy.age}岁</h4>
        <p>健康{enemy.health} · 精神{enemy.mind} · 灵性{enemy.spirituality} · {ENEMY_STATUS[enemy.status]}。</p>
        <p>本人距离对手{enemy.distanceMetres}米；唯一原杖{enemy.weaponLocation === 'HAND' ? '由对手持有' : '实际留在小院'}。对手有独立抵抗与真实伤亡风险。</p>
      </section>}
      {site && <p>本人在{LOCATION[site.playerLocation]}，薇拉在{LOCATION[site.volunteer.location]}，原导师在{LOCATION[site.guide.location]}。累计普通步行{site.playerTravelMetres}米，原现场时钟{site.clockSeconds}秒。</p>}
      {encounter.piece && <p>本次独立连接片剩余{encounter.piece.charges}/{encounter.piece.initialCharges}份用量，实际磨损{encounter.piece.wear}，准备已付{encounter.piece.paidPennies}便士。</p>}
      <p>对手原刻片剩余{encounter.plates.filter(plate => plate.status === 'HELD').length}/{encounter.plates.length}枚；耗尽不会补充。</p>
      <p>片刻维系仅维持一次真实位置关系20秒，本身不减少冲量。仍须另付8灵性2精神发动局部重启，实际应用分别消耗一份连接片；两者合用最多减少30。只有可见且尚未结算的身体冲量适用，精神冲击不由这两项减轻。</p>
      <p>仅限活着的本人刚观察到的原位置与尚未结算的可见冲量。位置、条件改变，遮挡、撤回或到期都会使未用关系失效；不回滚伤势、死亡、对手行动、费用或经过时间。</p>
      <p>本院实际局部重启{encounter.restartApplications}次，片刻维系实际辅助{encounter.anchorApplications}次；本人距入院原位置{encounter.playerLocalMetres}米。实际位移不会被离场步骤抹掉。</p>
      {encounter.restart && site && <p>已付费的局部重启联系原定还剩{Math.max(0, encounter.restart.expiresAt - site.clockSeconds)}秒；只有原位置与当前条件仍吻合的下一次适用冲量才可实际使用。</p>}
      {encounter.anchor && site && <p>片刻维系的同一位置关系还剩{Math.max(0, encounter.anchor.expiresAt - site.clockSeconds)}秒；尚未应用不等于免伤，也不能补回已消耗用量。</p>}
      {encounter.lastActionSequence.length > 0 && <section aria-label="最近一回合实际施术与应用">
        <h4>实际行动、消耗与返回</h4>
        <ol>{encounter.lastActionSequence.map(action => <li key={`${action.actor}-${action.order}`}>
          <p>{action.actor === 'PLAYER' ? '本人' : '对手'}第{action.order + 1}步：{prose(action.label)}。原现场第{action.atSeconds}秒，实际经过{action.elapsedSeconds}秒。</p>
          <p>实付{action.paidCost}灵性、{action.mindCost}精神、{action.luckCost}幸运；{action.attempted ? `确实施术，${action.check ? TIER[action.check.tier] : action.succeeded ? '已经成功' : '未成功'}` : '本步没有新施术'}。连接片实耗{action.pieceChargePaid}份，实际磨损{action.pieceWearPaid}。</p>
          {action.windowGranted && <p>{action.windowGranted.kind === 'ANCHOR' ? '本步仅建立维系关系，尚未减少冲量。' : '本步仅建立有限返回窗口，仍待实际冲量。'}</p>}
          {action.windowsApplied.length > 0 && <p>本步实际应用：{action.windowsApplied.map(window => window.kind === 'RESTART' ? `局部重启减少${window.amount}` : '片刻维系辅助同一次返回，额外减轻0').join('；')}。</p>}
          {action.windowsCancelled.length > 0 && <p>本步有{action.windowsCancelled.length}份未用联系失效，已付代价保留。</p>}
          {(action.impulseMetres > 0 || action.returnedMetres > 0) && <p>本步实际冲量位移{action.impulseMetres}米，局部返回{action.returnedMetres}米；本人位置从距原点{action.playerPositionBefore}米变为{action.playerPositionAfter}米。</p>}
          {action.fallbackReason && <p>{prose(action.fallbackReason)}</p>}
        </li>)}</ol>
      </section>}
      <ul>{encounter.facts.map((fact, index) => <li key={index}>{prose(fact)}</li>)}</ul>
      <details><summary>对手实际行动盘与作用类型</summary><ul>{encounter.enemyAbilityWheel.map(action => <li key={action.id}>{prose(action.label)} · 权重{action.weight}</li>)}</ul></details>
    </section>;
  }
}
