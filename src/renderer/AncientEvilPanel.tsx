import { useEffect, useRef, useState } from 'react';
import type { AncientEvilAction, AncientEvilCommand, AncientEvilProjection } from '../domain/ancient-evil/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['BUY_BLOCKS', 'PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '尚未收束', EXAMINED: '待报告', RESOLVED: '已收束' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '仅同意本次有限练习', DECLINED: '已拒绝本次练习', REVOKED: '已撤回同意', WITHDRAWN: '已撤回同意', CLOSED: '本次接触已结束' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const LOCATION: Record<string, string> = { START: '原门口', A: '四米处', B: '八米处', OUTSIDE: '室外' };
const FORM: Record<string, string> = { HUMAN: '人形', RABBIT: '兔形' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface AncientEvilPanelProps {
  value: AncientEvilProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: AncientEvilCommand) => void;
  onClose?: () => void;
}

/** Only saved public facts are displayed; every operation remains a domain intent. */
export function AncientEvilPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: AncientEvilPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: AncientEvilAction; facts: string } | null>(null);
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
  const inEncounter = encounter.inside || (!activeCase && value.promoted && goal === 'encounter');
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

  function choose(action: AncientEvilAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: AncientEvilAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function resources() {
    const current = value.resources;
    return current && <section aria-label="古代邪物当前资源">
      <h3>当前身体与资源</h3>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining}</p>
      <p>原伤继续生效。停止作用、复原、归还原物与晋升不会免费治疗本人，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }
  function actionControl(action: AncientEvilAction) {
    return <div key={action.id} className="seer-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `ancient-evil-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`ancient-evil-reason-${action.id}`}>{action.reason}</p>}
    </div>;
  }

  return <section className="seer-panel" aria-label="古代邪物成长" aria-busy={busy || pending}>
    <h2 ref={heading} tabIndex={-1}>{value.title}</h2>
    <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : next?.label ?? value.nextStep}</p>
    {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
    {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
    {resources()}
    {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
    <nav aria-label="古代邪物目标">
      {value.promoted ? <>
        {life.cases.map(entry => <button key={entry.id} className="slice-button quiet" disabled={locked || inside || confirmation !== null || entry.status !== 'RESOLVED' && !life.actions.some(action => 'caseId' in action.command && action.command.caseId === entry.id)}
          aria-pressed={!inEncounter && selectedCase?.id === entry.id} onClick={() => setGoal(entry.id)}>{entry.title} · {STATUS[entry.status] ?? entry.status}</button>)}
        <button className="slice-button quiet" disabled={locked || inside || confirmation !== null} aria-pressed={inEncounter} onClick={() => setGoal('encounter')}>可选原房间交战</button>
      </> : value.bottles.map(bottle => <button key={bottle.id} className="slice-button quiet" disabled={locked || life.insideCase || encounter.inside || confirmation !== null}
        aria-pressed={selectedBottle?.id === bottle.id} onClick={() => setGoal(bottle.id)}>{bottle.title} · {bottle.status}</button>)}
    </nav>
    {!value.promoted ? <>
      <p>{value.supplies}</p><p>{value.risk}</p>
      {selectedBottle && <section aria-label="独立原药瓶"><h3>{selectedBottle.title}</h3><p>{selectedBottle.source}</p><p>{selectedBottle.status} · 当前成功率{selectedBottle.chance}%</p></section>}
      <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{preparation.title}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
      <p>当周服药场地准备：{value.preparedWeek === null ? '未完成' : `第${value.preparedWeek}周已支付，取消不退款`}。可选择继续停留沉默门徒。</p>
    </> : inEncounter ? encounterFacts() : lifeFacts()}
    {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
    {alternatives.length > 0 && <details><summary>其他操作、普通替代与退出</summary>{alternatives.map(actionControl)}</details>}
    <details><summary>能力、消化与继承经历</summary>
      <p>{value.digestion}</p><p>{value.inheritedTools}</p><ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      {value.abilities.map(ability => <section key={ability.id}><h3>{ability.label} · 掌握{ability.mastery}</h3><p>{ability.description}</p></section>)}
    </details>
    <details><summary>原安静房间与普通退路</summary><p>{value.environment}</p><p>关闭页面不会代为停用、等待复原、归还原衣物与原包或沿原路离场；已付代价与旧伤保留。</p></details>
    {confirmation && <section role="dialog" aria-modal="true" aria-label="古代邪物操作确认" onKeyDown={event => {
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
      {live?.command.type === 'CONSUME' && <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备；失败保留已付代价。也可取消并继续停留沉默门徒。</p>}
      {resources()}{live?.reason && <p className="seer-action-reason">{live.reason}</p>}
      <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
      <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button>
      <p>取消不提交。关闭页面不能替代实际停止、交还原物和步行离场。</p>
    </section>}
  </section>;

  function lifeFacts() {
    const site = life.site, form = life.operation.form;
    const remaining = form ? Math.max(0, form.expiresAt - life.clockSeconds) : 0;
    return <section aria-label="古代邪物原场事务">
      <h3>{selectedCase?.title ?? life.title}</h3><p>{selectedCase?.story ?? life.story}</p><p>{life.environment}</p>
      {selectedCase?.result && <p className="slice-notice">{selectedCase.result}</p>}
      {life.activeCase === selectedCase?.id && <p>{life.nextStep}</p>}
      <section aria-label="埃尔莎同一原身体">
        <h4>{site.volunteer.name} · {site.volunteer.age}岁</h4>
        <p>同一原身体当前为{FORM[site.volunteer.form]}，实际在{LOCATION[site.volunteer.location]}。原身份不随外形改变，也没有另一个身体留在原处。</p>
        <p>健康{site.volunteer.health} · 精神{site.volunteer.mind} · 灵性{site.volunteer.spirituality} · 原伤势{site.volunteer.injuries.length}处。变形与复原不治疗、不补满资源。</p>
        <p>本人实际在{LOCATION[life.playerLocation]}，累计普通步行{life.playerTravelMetres}米，原室时钟{life.clockSeconds}秒。</p>
      </section>
      <section aria-label="古代邪物原衣物与原包">
        <h4>原衣物与原包的实际去向</h4>
        <p>原衣物{site.clothing.quantity}套，{site.clothing.location === 'TRAY' ? '仍在原私密托盘' : '由埃尔莎本人持有'}，{site.clothing.worn ? '已实际穿着' : '尚未实际穿回'}；原包{site.bag.quantity}个，{site.bag.location === 'TRAY' ? '仍在同一托盘' : '由埃尔莎本人持有'}。</p>
        <p>原托盘在{LOCATION[site.tray.location]}，更衣与归物在私密处完成。原身体复原后仍须实际穿回同一原衣并取回原包。</p>
        <p>同一原纸在{LOCATION[site.note.location]}；原导师{site.guide.name}在{LOCATION[site.guide.location]}。</p>
      </section>
      <p>新输入{life.operation.inputActive ? '仍在进行，尚须实际停止' : '当前没有持续输入'}；本次同一身体的兔形还剩{remaining}秒。停止或撤回不代办复原。</p>
      {remaining > 0 && <p className="slice-notice">本练习兔形最长90秒。可以0行动、0灵性实际等待当前剩余时间；按原身份引导结束自己本次变形须另付成本并检定，失败仍付费。页面停留不会自行计时。</p>}
      {attempt && <section aria-label="古代邪物本次实际尝试">
        <h4>本次许可、结果与实际消耗</h4>
        <p>第{attempt.week}周 · {attempt.method === 'ABILITY' ? '有限能力练习' : '普通核对'}；当前记录许可：{CONSENT[attempt.consent]}。</p>
        {attempt.permissionWithdrawn && <p>已撤回的许可不能复用，禁止新变形；收尾只可结束自己本次仍在持续的效果，或实际等待。</p>}
        <p>本次实际消耗{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、{attempt.penniesSpent}便士；实际应用{attempt.appliedAbilityIds.length}项，已移动{attempt.playerTravelMetres}米，实际经过{attempt.elapsedSeconds}秒。</p>
        <p>持续变形：{attempt.formTier ? TIER[attempt.formTier] : '尚无实际尝试'}；解咒引导：{attempt.guidanceTier ? TIER[attempt.guidanceTier] : '尚无实际尝试'}。失败的真实消耗保留，普通核对不冒充能力成功。</p>
        <p>原身份{attempt.identityRead ? '已当面读取' : '尚未当面读取'}；原纸{attempt.noteRead ? '已实际读取' : '尚未实际读取'}；同一身体身份{attempt.identityCompared ? '已实际核对' : '尚未实际核对'}{attempt.comparedForm ? `，当时为${FORM[attempt.comparedForm]}` : ''}。解咒引导只针对自己本案仍在持续且身份已核对的变形。</p>
        <p>已实际等待{attempt.waitedSeconds}秒；{attempt.released ? '已实际引导复原' : attempt.expired ? '原形态已按实际时钟消退' : '尚无复原记录'}。{attempt.itemsReturned ? '原衣与原包已实际归还并穿回。' : attempt.itemsStored ? '原衣与原包已存妥，尚未实际归还。' : '本次没有存放原衣与原包。'}{attempt.closed ? '本次现场已实际收束。' : '本次现场尚未实际收束。'}</p>
        {attempt.evidence.length > 0 && <details><summary>本次当面取得的记录</summary><ul>{attempt.evidence.map((fact, index) => <li key={index}>{fact}</li>)}</ul></details>}
      </section>}
      <details><summary>原现场与普通收尾</summary><ul>{life.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
        <p>沿门口、四米处和八米处相邻步行，身体复原后真实归物，再沿原路离场。退出不退款，不清旧伤。</p>
      </details>
    </section>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, scene = encounter.scene;
    return <section aria-label="古代邪物原房间冲突">
      <h3>{encounter.title}</h3><p>{encounter.story}</p>
      {enemy && <section aria-label="莱娜同一原身体">
        <h4>{enemy.name} · {enemy.age}岁 · 织梦人</h4>
        <p>健康{enemy.health} · 精神{enemy.mind} · 灵性{enemy.spirituality} · {ENEMY_STATUS[enemy.status]}。同一原身体当前为{FORM[enemy.form]}，剩余变形{enemy.formRemainingSeconds}秒。</p>
        <p>唯一原杖{enemy.weaponLocation === 'HAND' ? '仍由本人持有' : '实际留在原场地面'}；身体复原不自动拾回原杖。仍有独立抵抗与实际伤亡风险。</p>
      </section>}
      {scene && <p>原安静房间：本人在{LOCATION[scene.playerLocation] ?? scene.playerLocation}，埃尔莎在{LOCATION[scene.elsaLocation] ?? scene.elsaLocation}，哈伦在{LOCATION[scene.guideLocation] ?? scene.guideLocation}。原出口开放，当前相距{scene.distanceMetres}米，累计普通步行{scene.playerTravelMetres}米，原室时钟{scene.clockSeconds}秒。</p>}
      <ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
    </section>;
  }
}
