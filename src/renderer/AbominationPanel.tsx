import { useEffect, useRef, useState } from 'react';
import type { AbominationAction, AbominationCommand, AbominationProjection } from '../domain/abomination/types';
import { playerText } from '../shared/player-text.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const CLEANUP_ORDER = ['LEAVE', 'LEAVE_ENCOUNTER', 'LEAVE_PREPARATION', 'RETURN_PIECE', 'RETURN_TO_ENTRY', 'TAKE_PIECE', 'RETURN_TO_A', 'ABORT', 'STOP_METHOD', 'WITHDRAW_CONSENT'];
const CLEANUP = new Set(['ABORT', 'STOP_METHOD', 'TAKE_PIECE', 'RETURN_TO_A', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '尚未收束', EXAMINED: '待报告', RESOLVED: '已收束', CANCELLED: '已取消' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '仅同意本次有限练习', DECLINED: '已拒绝本次练习', REVOKED: '已撤回同意', WITHDRAWN: '已撤回同意', CLOSED: '本次接触已结束' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const LOCATION: Record<string, string> = { START: '原门口', A: '四米处', B: '八米处', OUTSIDE: '室外', YARD: '独立小院' };
const FORM: Record<string, string> = { HUMAN: '人形', RABBIT: '兔形' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface AbominationPanelProps {
  value: AbominationProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: AbominationCommand) => void;
  onClose?: () => void;
}

/** Only saved public facts are displayed; every operation remains a domain intent. */
export function AbominationPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: AbominationPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: AbominationAction; facts: string } | null>(null);
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
  const entries = value.actions.filter(action => inEncounter ? encounterActionIds.has(action.id)
    : value.promoted ? !complete && !ACQUISITION.has(action.command.type) && !encounterActionIds.has(action.id)
      && (!('caseId' in action.command) || action.command.caseId === selectedCase?.id)
      : ACQUISITION.has(action.command.type) && (!('bottleId' in action.command) || action.command.bottleId === selectedBottle?.id));
  const next = entries.find(action => action.enabled && action.command.type === 'WAIT_1' && life.cue !== null && life.cue.delayRemainingSeconds > 0)
    ?? entries.find(action => action.enabled && action.id === value.preferredActionId)
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

  function choose(action: AbominationAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: AbominationAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function resources() {
    const current = value.resources;
    return current && <section aria-label="神孽当前资源">
      <h3>当前身体与资源</h3>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining}</p>
      <p>原伤势{value.injuries.length}处 · 伤势风险{value.injuryRisk}。已付灵性、精神和费用照实保留；停止、归物与晋升不会免费治疗。</p>
    </section>;
  }
  function actionControl(action: AbominationAction) {
    return <div key={action.id} className="seer-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `abomination-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{prose(action.label)}</strong><span className="slice-modifiers">{prose(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`abomination-reason-${action.id}`}>{prose(action.reason)}</p>}
    </div>;
  }

  return <section className="seer-panel" aria-label="神孽成长" aria-busy={busy || pending}>
    <h2 ref={heading} tabIndex={-1}>{prose(value.title)}</h2>
    <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : complete && !inEncounter ? '三案已结束，可返回普通生活；小院交战由你另行选择。' : prose(next?.label ?? value.nextStep)}</p>
    {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
    {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
    {resources()}
    {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
    <nav aria-label="神孽目标">
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
      <p>当周服药场地准备：{value.preparedWeek === null ? '未完成' : `第${value.preparedWeek}周已支付，取消不退款`}。可选择继续停留古代邪物。</p>
    </> : inEncounter ? encounterFacts() : lifeFacts()}
    {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
    {cleanup.length > 0 && <section aria-label="停止与普通退出"><h3>停止与普通退出</h3>{cleanup.map(actionControl)}</section>}
    {alternatives.length > 0 && <details><summary>其他操作、普通替代与退出</summary>{alternatives.map(actionControl)}</details>}
    <details><summary>能力、消化与继承经历</summary>
      <p>{prose(value.appearanceRecord)}</p><p>{prose(value.digestion)}</p><p>{prose(value.inheritedTools)}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{prose(entry)}</li>)}</ul>
      {value.abilities.map(ability => <section key={ability.id}><h3>{prose(ability.label)} · 掌握{ability.mastery}</h3><p>{prose(ability.description)}</p></section>)}
    </details>
    <details><summary>原安静房间与普通退路</summary><p>{prose(value.environment)}</p><p>关闭页面不会代为停止、等候已开始的延迟、交还本次器件或沿原路离场；已付代价与旧伤保留。</p></details>
    {confirmation && <section role="dialog" aria-modal="true" aria-label="神孽操作确认" onKeyDown={event => {
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
      {live?.command.type === 'CONSUME' && <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备；失败保留已付代价。也可取消并继续停留古代邪物。</p>}
      {resources()}{live?.reason && <p className="seer-action-reason">{prose(live.reason)}</p>}
      <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
      <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button>
      <p>取消不提交。关闭页面不能替代实际停止、交还原物和步行离场。</p>
    </section>}
  </section>;

  function lifeFacts() {
    const site = life.site, piece = life.pieces.find(entry => entry.caseId === selectedCase?.id);
    const currentScene = life.activeCase === selectedCase?.id;
    const cue = currentScene ? life.cue : null;
    const pulse = currentScene ? life.pulse : null;
    const pendingWindow = currentScene ? life.pending : null;
    return <section aria-label="神孽原场事务">
      <h3>{prose(selectedCase?.title ?? life.title)}</h3><p>{prose(selectedCase?.story ?? life.story)}</p>
      <p>{prose(life.environment)}</p>
      {selectedCase?.result && <p className="slice-notice">{prose(selectedCase.result)}</p>}
      <section aria-label="埃尔莎同一原身体">
        <h4>{site.volunteer.name} · {site.volunteer.age}岁</h4>
        <p>同一原身体当前为{FORM[site.volunteer.form]}，实际在{LOCATION[site.volunteer.location]}。原身份、身体和随身原物保持同一份。</p>
        <p>健康{site.volunteer.health} · 精神{site.volunteer.mind} · 灵性{site.volunteer.spirituality} · 原伤势{site.volunteer.injuries.length}处。</p>
        <p>本人实际在{LOCATION[life.playerLocation]}，累计普通步行{life.playerTravelMetres}米，原室时钟{life.clockSeconds}秒。</p>
        <p>本阶段协作耗力{life.volunteerEffortSpent}/12。只累计本阶段已经发生的协作。</p>
      </section>
      <section aria-label="神孽原物实际去向">
        <h4>原衣物、原包、原托盘与原纸</h4>
        <p>原衣物{site.clothing.quantity}套，{site.clothing.location === 'TRAY' ? '仍在原私密托盘' : '由埃尔莎本人持有'}，{site.clothing.worn ? '已实际穿着' : '尚未实际穿回'}；原包{site.bag.quantity}个，{site.bag.location === 'TRAY' ? '仍在同一托盘' : '由埃尔莎本人持有'}。</p>
        <p>唯一原托盘在{LOCATION[site.tray.location]}；唯一原纸在{LOCATION[site.note.location]}；原导师{site.guide.name}在{LOCATION[site.guide.location]}。</p>
        <p>原衣物与原包随埃尔莎实际行走，本案新耗材单独记录。旧木块的耗尽记录保留。</p>
      </section>
      {selectedCase && <p>本案原物许可：{CONSENT[selectedCase.permission.OWNER]}；具体能力许可：{CONSENT[selectedCase.permission.ABILITY]}。旧案许可不复用。</p>}
      {piece && <section aria-label="神孽本案有限器件">
        <h4>{piece.kind === 'voice-piece' ? '本案唯一震声器件' : '本案唯一束障器件'}</h4>
        <p>第{piece.boughtWeek}周实付{piece.paidPennies}便士购入{piece.quantity}件；当前{piece.location === 'HAND' ? '由本人持有' : piece.location === 'TRAY' ? '在四米处原托盘' : '已实际交还'}，累计随本人移动{piece.travelMetres}米。</p>
        <p>能力用量剩余{piece.charges}/1 · 实际磨损{piece.wear}；唯一测试源剩余{piece.testCharges}/1 · 已实际使用{piece.testUses}次。用完不能刷新。</p>
      </section>}
      {pendingWindow && <p className="slice-notice">灵性束障还剩{life.pendingRemainingSeconds}秒，只作用于当前这一次可见精神脉冲，最多减轻30；身体攻击不减。移动、遮挡、撤回或到期会结束未用窗口，费用不退。</p>}
      {pulse && <p>当前唯一测试脉冲为精神作用（{pulse.kind}），原压力{pulse.pressure}；{pulse.resolved ? '已实际触发并耗尽。' : '仍待本人实际触发，尚未产生测试结果。'}</p>}
      {cue && <section aria-label="神孽实际三秒等待">
        <h4>同一原身体的可见手势</h4>
        <p>{cue.executed ? '原定手势已实际执行一次。' : `原定手势尚未执行，实际延迟还剩${cue.delayRemainingSeconds}秒。`}已施加延迟{cue.delayImposedSeconds}秒。</p>
        {cue.delayRemainingSeconds > 0 && <p className="slice-notice">仍须逐秒实际等待；0行动也能继续。撤回会停止新输入，已经施加的延迟仍按实际时间结束。页面停留不会自行计时。</p>}
        <p>不改变原身体与位置，不增加行动次数；已付成本保留。</p>
      </section>}
      {attempt && <section aria-label="神孽本次实际尝试">
        <h4>本次事实与实际消耗</h4>
        <p>第{attempt.week}周 · {attempt.method === 'ABILITY' ? '有限能力练习' : '普通核对'}；{attempt.closed ? '本次现场已收束' : '本次现场尚未收束'}。</p>
        {attempt.withdrawn && <p>本案许可已真实撤回，不能新施术；尚未走完的已施加延迟仍须实际等待。</p>}
        <p>本次实耗{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、{attempt.penniesSpent}便士；实际应用{attempt.appliedAbilityIds.length}项。</p>
        <p>本人实际走{attempt.playerTravelMetres}米，埃尔莎实际走{attempt.volunteerTravelMetres}米；实际经过{attempt.elapsedSeconds}秒。</p>
        <p>原托盘{attempt.readTray ? '已亲见' : '尚未亲见'}；原纸{attempt.readOriginal ? '已实际读取' : '尚未实际读取'}。施术{attempt.castTier ? TIER[attempt.castTier] : '尚未尝试'}{attempt.resisted ? '，对方实际抵抗' : ''}。</p>
        {attempt.baselinePressure > 0 && <p>本次精神脉冲实际压力{attempt.baselinePressure}→{attempt.feltPressure}；{attempt.checkTier ? `实际观察${TIER[attempt.checkTier]}` : '尚无观察检定结果'}。</p>}
        <p>{attempt.verified ? '唯一事件已实际结束。' : '唯一事件尚未结束。'}{attempt.returned ? '器件已实际交还。' : '器件尚未实际交还。'}失败的消耗与普通结果都按事实保留。</p>
      </section>}
      {selectedCase && selectedCase.observations.length > 0 && <details><summary>本案已取得的记录</summary><ul>{selectedCase.observations.map((fact, index) => <li key={index}>{prose(fact)}</li>)}</ul></details>}
      <details><summary>原现场与普通收尾</summary><p>{prose(life.source)}</p>
        <p>本人沿门口、四米处原托盘与八米处原纸之间普通行走；停止后仍须取回本案器件、沿原路回门口并实际交还。退出不退款，不清旧伤。</p>
      </details>
    </section>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, site = encounter.site;
    return <section aria-label="神孽独立小院冲突">
      <h3>{prose(encounter.title)}</h3><p>{prose(encounter.story)}</p>
      {enemy && <section aria-label="罗德里克同一原身体">
        <h4>{enemy.name} · {enemy.age}岁</h4>
        <p>健康{enemy.health} · 精神{enemy.mind} · 灵性{enemy.spirituality} · {ENEMY_STATUS[enemy.status]}。</p>
        <p>同一原身体当前为{FORM[enemy.form]}，剩余变形{enemy.formRemainingSeconds}秒；唯一原杖{enemy.weaponLocation === 'HAND' ? '由本人持有' : '实际留在小院'}。有独立抵抗与真实伤亡风险。</p>
      </section>}
      {site && <p>本人在{LOCATION[site.playerLocation]}，埃尔莎在{LOCATION[site.volunteer.location]}，原导师在{LOCATION[site.guide.location]}。累计普通步行{site.playerTravelMetres}米，原现场时钟{site.clockSeconds}秒。</p>}
      {encounter.piece && <p>本次独立器件剩余{encounter.piece.charges}/{encounter.piece.initialCharges}份用量，实际磨损{encounter.piece.wear}，准备已付{encounter.piece.paidPennies}便士。</p>}
      <p>对手原刻片剩余{encounter.plates.filter(plate => plate.status === 'HELD').length}/{encounter.plates.length}枚；耗尽不会补充。</p>
      {encounter.lastForceReceipt && <p>最近真实力量来源：精神刻片冲击（{encounter.lastForceReceipt.kind}），实际消耗{encounter.lastForceReceipt.paidCost}灵性与1枚刻片，发生在第{encounter.lastForceReceipt.round}回合第{encounter.lastForceReceipt.order + 1}槽。</p>}
      <ul>{encounter.facts.map((fact, index) => <li key={index}>{prose(fact)}</li>)}</ul>
      <details><summary>对手实际行动盘与作用类型</summary><ul>{encounter.enemyAbilityWheel.map(action => <li key={action.id}>{prose(action.label)} · 权重{action.weight}</li>)}</ul></details>
    </section>;
  }
}
