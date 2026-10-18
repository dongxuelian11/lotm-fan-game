import { useEffect, useRef, useState } from 'react';
import type { FateProphetAction, FateProphetCommand, FateProphetProjection } from '../domain/fate-prophet/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '尚未收束', EXAMINED: '待报告', RESOLVED: '已收束' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '仅同意本次有限练习', DECLINED: '已拒绝本次练习', REVOKED: '已撤回同意', WITHDRAWN: '已撤回同意', ORDINARY: '只同意本次普通操作', CLOSED: '本次接触已结束' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const LOCATION: Record<string, string> = { START: '原门口', A: '操作处', B: '左侧终点', C: '右侧终点', OUTSIDE: '室外' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const PENDING_EFFECT: Record<string, string> = { FORESIGHT: '本次事件先兆', HAZARD_ADJUSTMENT: '本次有限风险调整', DEVIATION_BUFFER: '继承的有限偏移', FUTURE_IMPEDIMENT: '继承的有限阻滞' };

export interface FateProphetPanelProps {
  value: FateProphetProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: FateProphetCommand) => void;
  onClose?: () => void;
}

/** Only saved public facts are displayed; every operation remains a domain intent. */
export function FateProphetPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: FateProphetPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: FateProphetAction; facts: string } | null>(null);
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
    ?? entries.find(action => action.enabled && !['LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'WITHDRAW'].includes(action.command.type))
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

  function choose(action: FateProphetAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: FateProphetAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function resources() {
    const current = value.resources;
    return current && <section aria-label="先知当前资源">
      <h3>当前身体与资源</h3>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining}</p>
      <p>现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}。</p>
      {value.injuries.length > 0 && <ul aria-label="当前伤势与处置">{value.injuries.map((injury, index) => <li key={injury.id}>第{index + 1}处{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已实际处置，仍须休养' : '尚未处置'}</li>)}</ul>}
      <p>唯一幸运储备{value.luck.stored}/{value.luck.capacity} · 累计积累{value.luck.accumulated}份 · 实际消耗{value.luck.spent}份。须实际积累，晋升不会补满。</p>
      <p>原伤继续生效。停止作用、归还原物与晋升不会免费治疗本人，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }
  function actionControl(action: FateProphetAction) {
    return <div key={action.id} className="seer-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `fate-prophet-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`fate-prophet-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }

  return <section className="seer-panel" aria-label="先知成长" aria-busy={busy || pending}>
    <h2 ref={heading} tabIndex={-1}>{value.title}</h2>
    <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : next?.label ?? value.nextStep}</p>
    {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
    {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
    {resources()}
    {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
    <nav aria-label="先知目标">
      {value.promoted ? <>
        {life.cases.map(entry => <button key={entry.id} className="slice-button quiet" disabled={locked || inside || confirmation !== null || entry.status !== 'RESOLVED' && !life.actions.some(action => 'caseId' in action.command && action.command.caseId === entry.id)}
          aria-pressed={!inEncounter && selectedCase?.id === entry.id} onClick={() => setGoal(entry.id)}>{entry.title} · {STATUS[entry.status] ?? entry.status}</button>)}
        <button className="slice-button quiet" disabled={locked || inside || confirmation !== null} aria-pressed={inEncounter} onClick={() => setGoal('encounter')}>可选原工坊交战</button>
      </> : value.bottles.map(bottle => <button key={bottle.id} className="slice-button quiet" disabled={locked || life.insideCase || encounter.inside || confirmation !== null}
        aria-pressed={selectedBottle?.id === bottle.id} onClick={() => setGoal(bottle.id)}>{bottle.title} · {bottle.status}</button>)}
    </nav>
    {!value.promoted ? <>
      <p>{value.supplies}</p><p>{value.risk}</p>
      {selectedBottle && <section aria-label="独立原药瓶"><h3>{selectedBottle.title}</h3><p>{selectedBottle.source}</p><p>{selectedBottle.status} · 当前成功率{selectedBottle.chance}%</p></section>}
      <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{preparation.title}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
      <p>当周服药场地准备：{value.preparedWeek === null ? '未完成' : `第${value.preparedWeek}周已支付，取消不退款`}。可选择继续停留混乱行者。</p>
    </> : inEncounter ? encounterFacts() : lifeFacts()}
    {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
    {alternatives.length > 0 && <details><summary>其他操作、普通替代与退出</summary>{alternatives.map(actionControl)}</details>}
    <details><summary>能力、消化与继承经历</summary>
      <p>{value.digestion}</p><p>{value.appearanceRecord}</p><p>{value.inheritedTools}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      {value.abilities.map(ability => <section key={ability.id}><h3>{ability.label} · 掌握{ability.mastery}</h3><p>{ability.description}</p></section>)}
    </details>
    <details><summary>原工坊与普通退路</summary><p>{value.environment}</p><p>关闭页面不会代为停止输入、等待影响到期、归还原车、原签与原盘或沿原路离场；已经发生的事件与已付代价保留。</p></details>
    {confirmation && <section role="dialog" aria-modal="true" aria-label="先知操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{live?.label ?? '现场已变化'}</h3><p>{live?.cost}</p><p>{!value.promoted ? value.risk : inEncounter ? encounter.story : life.environment}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%</p></>}
      {live?.command.type === 'CONSUME' && <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备；失败保留已付代价。也可取消并继续停留混乱行者。</p>}
      {resources()}{live?.reason && <p className="seer-action-reason">{live.reason}</p>}
      <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
      <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button>
      <p>取消不提交。关闭页面不能替代实际停止、交还原物和步行离场。</p>
    </section>}
  </section>;

  function lifeFacts() {
    return <section aria-label="先知原场事务">
      <h3>{selectedCase?.title ?? life.title}</h3><p>{selectedCase?.story ?? life.story}</p><p>{life.environment}</p>
      {selectedCase?.result && <p className="slice-notice">{selectedCase.result}</p>}
      {life.activeCase === selectedCase?.id && <p>{life.nextStep}</p>}
      <p>本人实际在{LOCATION[life.playerLocation]}，累计普通步行{life.playerTravelMetres}米，原工坊时钟{life.clockSeconds}秒。</p>
      <section aria-label="先知原人与原物">
        <h4>{life.site.title}</h4>
        <p>{life.site.volunteer}{life.site.guide}</p>
        <p>{life.site.cart}{life.site.parcel}</p>
        <p>{life.site.disc}{life.site.record}{life.site.pouch}</p>
      </section>
      {attempt && <section aria-label="先知本次实际尝试">
        <h4>本次许可、结果与实际消耗</h4>
        <p>{attempt.method === 'ABILITY' ? '有限能力练习' : '普通检查'}；当前记录许可：{CONSENT[attempt.consent]}。</p>
        {attempt.consent === 'WITHDRAWN' && <p>已撤回的许可不能复用，禁止新施术；可普通检查、归物和离场，已付成本不退。</p>}
        {attempt.consent === 'DECLINED' && <p>本人已拒绝此次能力练习，不再索取许可；可以普通检查原物或停止离开。</p>}
        {attempt.conditionChanged && <p className="slice-notice">原机械条件已实际改变，旧预感作废。之后只按改变后的现场普通处理一次。</p>}
        <p>本次实际消耗{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、{attempt.luckSpent}份原幸运；已普通步行{attempt.playerTravelMetres}米，实际经过{attempt.elapsedSeconds}秒。</p>
        <p>单次事件预感：{attempt.foresightTier ? TIER[attempt.foresightTier] : '尚无实际尝试'}；有限风险调整：{attempt.adjustmentTier ? TIER[attempt.adjustmentTier] : '尚无实际尝试'}。失败仍实际付费。</p>
        <p>{attempt.clue ?? '尚无亲自取得的机械条件线索。'}{attempt.forecastValid ? '本次预感仍在有限有效期内，不能保证后来结果。' : '当前没有可用的本次预感。'}</p>
        <p>待用修正还剩{attempt.correctionRemainingSeconds}秒。只影响当前同一原物尚未发生的一次事件；停止、撤回或到期不退成本。页面停留不会自行计时。</p>
        <p>{attempt.eventResult ?? '尚无已经亲见的本次事件结果。'}已经发生的事件只保留一次结果，不能重置、重抽或事后改写。</p>
        <p>{attempt.stopped ? '本次输入已实际停止。' : '仍按当前现场步骤处理。'}{attempt.closed ? '本次现场已实际收束。' : '本次现场尚未实际收束，仍须归物与普通退出。'}</p>
        {attempt.evidence.length > 0 && <details><summary>本次当面取得的记录</summary><ul>{attempt.evidence.map((fact, index) => <li key={index}>{fact}</li>)}</ul></details>}
      </section>}
      <details><summary>原现场与普通收尾</summary><ul>{life.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
        <p>门口到操作处四米，操作处到左右终点各四米。必须本人走到原物旁，把同一原车和包手推回原位，交还原物后普通离场；退出不退款，也不治疗旧伤。</p>
      </details>
    </section>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene;
    return <section aria-label="先知原工坊冲突">
      <h3>{encounter.title}</h3><p>{encounter.story}</p>
      {encounter.preparation && <p>第{encounter.preparation.week}周已实际整理注意力，支付{encounter.preparation.mindPaid}精神；取消与离场不退款。</p>}
      {enemy && <section aria-label="洛温独立身体与心智">
        <h4>{enemy.name} · {enemy.age}岁 · 序列{enemy.sequence}施术者</h4>
        <p>健康{enemy.health} · 精神{enemy.mind} · 灵性{enemy.spirituality} · {ENEMY_STATUS[enemy.status]}。他保留独立的身体、心智与抵抗。</p>
        <p>唯一原杖{enemy.weaponLocation === 'HAND' ? '仍由本人持有' : '实际留在原场地面'}；伤亡与离场不会复制、自动拾回原物或复活旧人。</p>
        <p>本次实际使用弧光{enemy.powerUses.ARC_BOLT}次、屏护{enemy.powerUses.WARD}次、凝神{enemy.powerUses.COMPOSE}次。</p>
        <ul>{enemy.abilities.map(ability => <li key={ability}>{ability}</li>)}</ul>
      </section>}
      {scene && <p>本人在{LOCATION[scene.playerLocation] ?? scene.playerLocation}，薇拉在{LOCATION[scene.veraLocation] ?? scene.veraLocation}，艾妲在{LOCATION[scene.guideLocation] ?? scene.guideLocation}。普通出口开放，当前与洛温相距{scene.distanceMetres}米，累计普通步行{scene.playerTravelMetres}米，原工坊时钟{scene.clockSeconds}秒。</p>}
      <p>当前待用影响：{encounter.pendingKind ? PENDING_EFFECT[encounter.pendingKind] : '无'}。{encounter.composureReady ? '洛温已凝神，本轮新输入仍须面对抵抗。' : '他仍可自行施术或抵抗。'}</p>
      <p>生活中的机械试验不代替交战结果。此处身体攻击与精神冲击分别结算，伤势、投降、撤退与死亡都按本次真实经过保留。</p>
      <ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
    </section>;
  }
}
