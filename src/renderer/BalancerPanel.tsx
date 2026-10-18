import { playerText } from '../shared/player-text.js';
import { useEffect, useRef, useState } from 'react';
import type { BalancerAction, BalancerCommand, BalancerProjection } from '../domain/balancer/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '尚未收束', EXAMINED: '待报告', RESOLVED: '已收束' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '仅同意本次有限练习', DECLINED: '已拒绝本次练习', REVOKED: '已撤回同意', WITHDRAWN: '已撤回同意', ORDINARY: '只同意本次普通操作', CLOSED: '本次接触已结束' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const LOCATION: Record<string, string> = { START: '原门口', A: '原标线处', B: '原空桌旁', OUTSIDE: '室外' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const PENDING_EFFECT: Record<string, string> = { IMBALANCE: '一次已观察的身体破绽', RESISTANCE: '一次有限身体抗御' };

export interface BalancerPanelProps {
  value: BalancerProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: BalancerCommand) => void;
  onClose?: () => void;
}

/** Only saved public facts are displayed; every operation remains a domain intent. */
export function BalancerPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: BalancerPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: BalancerAction; facts: string } | null>(null);
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
  const activeCase = life.cases.find(entry => entry.id === life.activeCase)
    ?? life.cases.find(entry => entry.contactOpen || entry.status === 'PREPARED');
  const selectedCase = activeCase ?? life.cases.find(entry => entry.id === goal)
    ?? life.cases.find(entry => entry.status !== 'RESOLVED') ?? life.cases[0];
  const selectedBottle = value.bottles.find(bottle => bottle.id === goal)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const inEncounter = encounter.inside || (!activeCase && value.promoted && (goal === 'encounter' || goal === null && encounter.status !== 'AVAILABLE'));
  const inside = value.insideCase || life.insideCase || encounter.inside;
  const entries = value.actions.filter(action => inEncounter ? ENCOUNTER.has(action.command.type)
    : value.promoted ? !ACQUISITION.has(action.command.type) && !ENCOUNTER.has(action.command.type)
      && (!('caseId' in action.command) || action.command.caseId === selectedCase?.id)
      : ACQUISITION.has(action.command.type) && (!('bottleId' in action.command) || action.command.bottleId === selectedBottle?.id));
  const next = entries.find(action => action.enabled && action.id === value.preferredActionId)
    ?? entries.find(action => action.enabled && action.preferredAction)
    ?? entries.find(action => action.enabled && !action.cleanup && !['LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'WITHDRAW'].includes(action.command.type))
    ?? entries.find(action => action.enabled) ?? entries[0];
  const alternatives = entries.filter(action => action !== next);
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

  function choose(action: BalancerAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: BalancerAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function resources() {
    const current = value.resources;
    return current && <section aria-label="平衡者当前资源">
      <h3>当前身体与资源</h3>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining}</p>
      <p>现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}。</p>
      {value.injuries.length > 0 && <ul aria-label="当前伤势与处置">{value.injuries.map((injury, index) => <li key={injury.id}>第{index + 1}处{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已实际处置，仍须休养' : '尚未处置'}</li>)}</ul>}
      <p>原伤继续生效。停止作用、归还原物与晋升不会免费治疗本人，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }
  function actionControl(action: BalancerAction) {
    return <div key={action.id} className="seer-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `balancer-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{playerText(action.label)}</strong><span className="slice-modifiers">{playerText(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`balancer-reason-${action.id}`}>{playerText(action.reason)}</p>}
    </div>;
  }

  return <section className="seer-panel" aria-label="平衡者成长" aria-busy={busy || pending}>
    <h2 ref={heading} tabIndex={-1}>{playerText(value.title)}</h2>
    <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : playerText(next?.label ?? value.nextStep)}</p>
    {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
    {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
    {resources()}
    {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
    <nav aria-label="平衡者目标">
      {value.promoted ? <>
        {life.cases.map(entry => <button key={entry.id} className="slice-button quiet" disabled={locked || inside || confirmation !== null || entry.status !== 'RESOLVED' && !life.actions.some(action => 'caseId' in action.command && action.command.caseId === entry.id)}
          aria-pressed={!inEncounter && selectedCase?.id === entry.id} onClick={() => setGoal(entry.id)}>{playerText(entry.title)} · {STATUS[entry.status] ?? entry.status}</button>)}
        <button className="slice-button quiet" disabled={locked || inside || confirmation !== null} aria-pressed={inEncounter} onClick={() => setGoal('encounter')}>可选原演练房交战</button>
      </> : value.bottles.map(bottle => <button key={bottle.id} className="slice-button quiet" disabled={locked || life.insideCase || encounter.inside || confirmation !== null}
        aria-pressed={selectedBottle?.id === bottle.id} onClick={() => setGoal(bottle.id)}>{playerText(bottle.title)} · {playerText(bottle.status)}</button>)}
    </nav>
    {!value.promoted ? <>
      <p>{playerText(value.supplies)}</p><p>{playerText(value.risk)}</p>
      {selectedBottle && <section aria-label="独立原药瓶"><h3>{playerText(selectedBottle.title)}</h3><p>{playerText(selectedBottle.source)}</p><p>{playerText(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
      <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{playerText(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
      <p>当周服药场地准备：{value.preparedWeek === null ? '未完成' : `第${value.preparedWeek}周已支付，取消不退款`}。可选择继续停留混乱猎手。</p>
    </> : inEncounter ? encounterFacts() : lifeFacts()}
    {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
    {alternatives.length > 0 && <details><summary>其他操作、普通替代与退出</summary>{alternatives.map(actionControl)}</details>}
    <details><summary>能力、消化与继承经历</summary>
      <p>{playerText(value.digestion)}</p><p>{playerText(value.appearanceRecord)}</p><p>{playerText(value.inheritedTools)}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      {value.abilities.map(ability => <section key={ability.id}><h3>{playerText(ability.label)} · 掌握{ability.mastery}</h3><p>{playerText(ability.description)}</p></section>)}
    </details>
    <details><summary>原演练房与普通退路</summary><p>{playerText(value.environment)}</p><p>关闭页面不会代为停止输入、等待影响到期、归还原封包、原标条与原纸，或带回同一护板沿原路离场；已经发生的事件与已付代价保留。</p></details>
    {confirmation && <section role="dialog" aria-modal="true" aria-label="平衡者操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{playerText(live?.label ?? '现场已变化')}</h3><p>{live && playerText(live.cost)}</p><p>{playerText(!value.promoted ? value.risk : inEncounter ? encounter.story : life.environment)}</p>
      {confirmedBottle && <><p>{playerText(confirmedBottle.title)} · {playerText(confirmedBottle.status)}</p><p>{playerText(confirmedBottle.source)}</p><p>当前成功率{confirmedBottle.chance}%</p></>}
      {live?.command.type === 'CONSUME' && <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备；失败保留已付代价。也可取消并继续停留混乱猎手。</p>}
      {resources()}{live?.reason && <p className="seer-action-reason">{playerText(live.reason)}</p>}
      <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
      <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button>
      <p>取消不提交。关闭页面不能替代实际停止、交还原物和步行离场。</p>
    </section>}
  </section>;

  function lifeFacts() {
    return <section aria-label="平衡者原场事务">
      <h3>{playerText(selectedCase?.title ?? life.title)}</h3>
      <p>{playerText(selectedCase?.story ?? life.story)}</p><p>{playerText(life.environment)}</p>
      {selectedCase?.result && <p className="slice-notice">{playerText(selectedCase.result)}</p>}
      {life.activeCase === selectedCase?.id && <p>{playerText(life.nextStep)}</p>}
      <p>本人实际在{LOCATION[life.playerLocation]}，累计普通步行{life.playerTravelMetres}米，原演练房时钟{life.clockSeconds}秒。</p>
      <section aria-label="平衡者原人与原物">
        <h4>{playerText(life.site.title)}</h4>
        <p>{playerText(life.site.volunteer)}；{playerText(life.site.guide)}。</p>
        <p>{playerText(life.site.parcel)}；{playerText(life.site.paper)}；{playerText(life.site.line)}。</p>
      </section>
      <section aria-label="平衡者唯一原护板">
        <h4>{playerText(life.guardPlate.title)}</h4>
        <p>完整度{life.guardPlate.integrity}/65 · 所有人：{life.guardPlate.owner} · {life.guardPlate.holder} · 位于{life.guardPlate.location}。</p>
        <p>{life.guardPlate.acquired ? '已实际支付30便士取得，不再补发或恢复磨损。' : '仍属薇娜库存，可支付30便士购买这同一块护板一次。'}</p>
        <p>有限抗御需亲持完整度至少15的护板。实际冲量仍损2健康，未成功护持则损5健康，均磨损15；普通承托平放不损健康或护板。</p>
      </section>
      {attempt && <section aria-label="平衡者本次实际尝试">
        <h4>本次许可、结果与实际消耗</h4>
        <p>{attempt.method === 'ABILITY' ? '有限能力练习' : '普通检查'}；当前记录许可：{CONSENT[attempt.consent]}。</p>
        {attempt.permissionWithdrawn && <p>已撤回的许可不能复用，新输入已经停止；仍须普通走近、亲手核实和归还原物。已付成本不退。</p>}
        {attempt.consent === 'DECLINED' && <p>本次许可已拒绝，不再索取同一许可；可以普通检查原物或安全承托，再实际归物离场。</p>}
        <p>本次实际消耗{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、{attempt.healthLost}健康；已普通步行{attempt.playerTravelMetres}米，实际经过{attempt.elapsedSeconds}秒。</p>
        <p>本次局部失衡感知：{attempt.sensingTier ? TIER[attempt.sensingTier] : '尚无实际尝试'}；本次有限抗御：{attempt.resistanceTier ? TIER[attempt.resistanceTier] : '尚无实际尝试'}。失败仍实际付费，普通操作不冒充能力成功。</p>
        {attempt.sensingAnswer && <p>本次可见结论：{playerText(attempt.sensingAnswer)}</p>}
        {selectedCase?.id !== 'measured-impact' && <p>{attempt.verifiedOffsetMm === null ? '尚未亲眼核实原包的实际偏移。' : `本人已到原桌旁亲核偏移${attempt.verifiedOffsetMm}毫米。`}遮挡仍须亲手移开；不能由物理偏差推断动机。</p>}
        {attempt.resistanceTier && <p>本次有限抗御还剩{attempt.effectRemainingSeconds}秒，仅供本人接下来一次可见实体冲量使用，最长30秒。页面停留不会自行计时，停止、撤回或实际等候均不退成本。</p>}
        {attempt.impact && <p>{attempt.impact.mode === 'ORDINARY_BRACE' ? '本人已普通承托并平放同一350克原封包' : attempt.impact.resistanceApplied ? '本人已用有限抗御承受同一350克原封包的实际冲量' : '本人已实际承受同一350克原封包的冲量，未获得有效护持'}：损{attempt.impact.healthLoss}健康，护板磨损{attempt.impact.plateWear}。同一次结果不能重做。</p>}
        <p>{attempt.resultRead ? '本人已在原物旁实际核验结果。' : '尚未在原物旁实际核验结果。'}{attempt.objectsReturned ? '原物已经实际归还。' : '本次尚无原物归还记录。'}{attempt.stopped ? '本次输入已实际停止。' : ''}{attempt.closed ? '本次现场已实际收束。' : '本次现场尚未实际收束，仍须归物与普通退出。'}</p>
        {attempt.evidence.length > 0 && <details><summary>本次当面取得的记录</summary><ul>{attempt.evidence.map((fact, index) => <li key={index}>{playerText(fact)}</li>)}</ul></details>}
      </section>}
      <details><summary>原现场与普通收尾</summary><ul>{life.facts.map((fact, index) => <li key={index}>{playerText(fact)}</li>)}</ul>
        <p>感知仅限四米内眼前真实偏移或遮挡；抗御不能保证免伤。必须亲自走到同一原物旁核验、取回和归还，再沿原路步行离场。停止不会倒转时间，也不返还成本或治疗旧伤。</p>
      </details>
    </section>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene;
    return <section aria-label="平衡者原演练房冲突">
      <h3>{playerText(encounter.title)}</h3><p>{playerText(encounter.story)}</p>
      {encounter.preparation && <p>第{encounter.preparation.week}周已实际整理注意力，支付{encounter.preparation.mindPaid}精神；取消与离场不退款。</p>}
      {enemy && <section aria-label="卡斯帕独立身体与心智">
        <h4>{enemy.name} · {enemy.age}岁 · 序列{enemy.sequence}施术者</h4>
        <p>健康{enemy.health} · 精神{enemy.mind} · 灵性{enemy.spirituality} · {ENEMY_STATUS[enemy.status]}。他保留独立的身体、心智与抵抗。</p>
        <p>唯一原杖{enemy.weaponLocation === 'HAND' ? '仍由本人持有' : '实际留在原场地面'}；伤亡与离场不会复制、自动拾回原物或复活旧人。</p>
        <p>本次实际使用弧光{enemy.powerUses.ARC_BOLT}次、屏护{enemy.powerUses.WARD}次、凝神{enemy.powerUses.COMPOSE}次、精神施压{enemy.powerUses.MENTAL_PRESSURE}次。</p>
        <ul>{enemy.abilities.map(ability => <li key={ability}>{playerText(ability)}</li>)}</ul>
      </section>}
      {scene && <p>本人在{LOCATION[scene.playerLocation]}，米拉在{LOCATION[scene.miraLocation]}，薇娜在{LOCATION[scene.guideLocation]}。普通出口开放，当前与卡斯帕相距{scene.distanceMetres}米，累计普通步行{scene.playerTravelMetres}米，原演练房时钟{scene.clockSeconds}秒。</p>}
      <p>唯一原护板完整度{life.guardPlate.integrity}/65，属于{life.guardPlate.owner}，由{life.guardPlate.holder}，位于{life.guardPlate.location}；原磨损保留。</p>
      <p>当前待用影响：{encounter.pendingKind ? PENDING_EFFECT[encounter.pendingKind] ?? '本次有限影响，详见已保存的现场记录' : '无'}。{encounter.composureReady ? '卡斯帕已凝神，本轮新输入仍须面对抵抗。' : '他仍可自行施术或抵抗。'}</p>
      <p>感知只利用眼前已经发生的身体攻击留下的破绽，不能预知下一步。抗御只抵挡下一次实际身体击打，不拦截弧光；弧光仍可能造成真实身体伤势。精神施压单独结算精神后果。</p>
      <ul>{encounter.facts.map((fact, index) => <li key={index}>{playerText(fact)}</li>)}</ul>
    </section>;
  }
}
