import { useEffect, useRef, useState } from 'react';
import { playerText } from '../shared/player-text.js';
import type { WriterAction, WriterCommand, WriterProjection } from '../domain/writer/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'SET_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'CANCEL_ARRANGEMENT', 'RETURN_BOOK', 'RETURN_HOME', 'CLOSE', 'WITHDRAW', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已安全中止，待普通续办', ACTIVE: '尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '已结束' };
const ENEMY_STATUS = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const PERMISSION = { UNKNOWN: '尚未取得本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回' };
const NODE = { NEAR: '原近桌', FAR: '六米外原远桌' };
const POLICIES = { HOLD: '保留两项新技巧，普通应对', RECIPROCAL_INSIGHT: '允许互知线索', PLAUSIBLE_ARRANGEMENT: '允许合理安排', BOTH: '允许两项有限技巧' };

export interface WriterPanelProps {
  value: WriterProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: WriterCommand) => void;
  onClose?: () => void;
}

/** The view never changes resources or manufactures commands: it submits a current public action verbatim. */
export function WriterPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: WriterPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: WriterAction; facts: string } | null>(null);
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
  const locked = busy || blocked || error !== null || pending || value.resources?.health === 0;
  const { life, encounter } = value;
  const selectedBottle = value.bottles.find(bottle => bottle.id === goal)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const activeCase = life.cases.find(entry => entry.id === life.practice.activeCase);
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

  function choose(action: WriterAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: WriterAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function actionControl(action: WriterAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `writer-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{copy(action.label)}</strong><span className="slice-modifiers">{copy(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`writer-reason-${action.id}`}>{copy(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section aria-label="作家当前资源">
      <h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>晋升、停止与归还原物不会免费恢复身体，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="作家成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{copy(value.title)}</h2>
      <section aria-label="作家阶段总览"><p>当前阶段：{inEncounter ? '可选真实遭遇' : value.promoted ? life.reflected ? '生活报告与反思已完成' : '三项阅读室实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p><p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 作家扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p></section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : copy(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">
        {value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="作家目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked}
          onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{copy(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：石庭中的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{copy(bottle.title)} · {copy(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="作家其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{copy(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {!value.promoted ? <section aria-label="作家服药准备">
        <p>{copy(value.digestion)}</p><p>{copy(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{copy(selectedBottle.title)}</h3><p>{copy(selectedBottle.source)}</p><p>{copy(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{copy(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留洞悉者。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{copy(value.risk)}</p><p>{copy(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{copy(value.digestion)}</p><p>{copy(value.appearanceRecord)}</p><p>{copy(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{copy(ability.label)} · 掌握{ability.mastery}</h3><p>{copy(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{copy(value.environment)}关闭页面不会代替停止作用、归还原物与沿原路离开；已经发生的事件与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="作家操作确认" onKeyDown={event => {
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
        <p>{copy(value.risk)}</p><p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。也可取消并继续停留洞悉者。</p></>}
      {live?.command.type === 'ENCOUNTER_FIGHT' && <><p>这是与{encounter.enemy.name}的真实交战。双方独立受伤、投降、撤退与死亡都将保存，普通死亡终结本周目。生活练习不代替交战结果。</p><p>{copy(encounter.story)}</p></>}
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

  function lifeFacts() {
    const p = life.practice, attempt = selectedCase?.attempts.at(-1);
    const permission = selectedCase?.permission ?? attempt?.evidence.permission;
    const spent = attempt?.receipts.reduce((total, receipt) => ({
      spirituality: total.spirituality + Math.max(0, receipt.before.spirituality - receipt.after.spirituality),
      mind: total.mind + Math.max(0, receipt.before.mind - receipt.after.mind),
      health: total.health + Math.max(0, receipt.before.health - receipt.after.health),
      cash: total.cash + Math.max(0, receipt.before.cash - receipt.after.cash),
      walked: total.walked + receipt.ownerWalkedMetres, seconds: total.seconds + receipt.elapsedSeconds,
    }), { spirituality: 0, mind: 0, health: 0, cash: 0, walked: 0, seconds: 0 });
    const bookHolder = p.book.holder === 'SHELF' ? '原书架' : p.book.holder === 'OWNER' ? value.characterName : p.participants.find(person => person.id === p.book.holder)?.name ?? '原持有人';
    const pendingWindow = p.pendingArrangement ? Math.max(0, p.pendingArrangement.executeAt - p.elapsedSeconds) : null;
    return <section aria-label="作家生活练习">
      <h3>{copy(selectedCase?.title ?? life.title)}</h3><p>{copy(selectedCase?.story ?? life.source)}</p>
      {selectedCase?.preparation && <p>{copy(selectedCase.preparation)}</p>}
      {selectedCase?.result && <p className="slice-notice">{copy(selectedCase.result)}</p>}
      <section aria-label="阅读室原两位成年人"><h4>本次阅读室中的人</h4>
        <ul>{p.participants.map(person => <li key={person.id}>{person.name} · {person.age}岁 · {person.present ? '实际在场' : '当前不在场'} · {NODE[person.node]} · 已实际步行{person.walkedMetres}米</li>)}</ul>
        <p>每次事项与操作分别征得同意；拒绝和撤回后仍可选择普通办理。两人离开阅读室后不会出现在石庭交战中。</p>
      </section>
      {attempt && <section aria-label="本次许可与实际消耗"><h4>本次许可与代价</h4>
        <p>第{attempt.invitedWeek}周邀请 · {attempt.method === 'ABILITY' ? '有限能力与普通退路' : '普通操作'}。</p>
        {permission && <p>能力许可：{PERMISSION[permission.ability]}；原物操作许可：{PERMISSION[permission.material]}。</p>}
        {permission?.ability === 'WITHDRAWN' && <p>超凡许可已经撤回，不能继续施加新的能力作用；原有消耗与完成的事实保留。</p>}
        <p>能力判定：{attempt.outcome === null ? '尚无实际判定' : TIER[attempt.outcome]}；{attempt.evidence.abilityApplied ? '本次能力已实际生效' : '没有计作能力成功'}。{attempt.evidence.returned ? '原物已交还，本人已沿原路返回。' : '仍须实际交还原物并走回原处。'}</p>
        {spent && <p>本次实耗{spent.spirituality}灵性、{spent.mind}精神、{spent.health}健康、{spent.cash}便士；本人实际步行{spent.walked}米，经过{spent.seconds}秒。</p>}
        {attempt.evidence.aborted && <p>本次已经安全中止。再次办理须普通续办并支付实际费用，先前结果与代价保留，不能重新抽取能力结果。</p>}
      </section>}
      <section aria-label="原书、门铃与实际位置"><h4>同一原书与原现场</h4>
        <p>本人在{NODE[p.ownerNode]}，已实际步行{p.ownerWalkedMetres}米，现场累计经过{p.elapsedSeconds}秒。关闭页面不会推进时间。</p>
        <p>原书属于{p.participants.find(person => person.id === p.book.ownerId)?.name ?? '原物主'}，当前在{bookHolder}，位于{NODE[p.book.node]}。</p>
        <p>原门{p.door.open ? '开放' : '关闭'}；原门铃{p.bell.ready ? '可以使用' : '尚未就绪'}，实际响过{p.bell.rings}次；原邀请记录已有{p.invitation.entries.length}次邀请。</p>
        {p.record.reportId !== null && <p>同一原报告由本人持有，位于{NODE[p.record.node]}。展示原件不会复制另一份报告。</p>}
        {p.introduction ? <p>已经亲自向对方介绍姓名{p.introduction.name}，并实际展示先前完成的洞悉者报告。对方只知道当次实际看到的内容。</p> : <p>尚未在此展示姓名与已经完成的洞悉者报告；不会凭空取得对方对自己的认识。</p>}
        {p.knownClues.length > 0 && <ul>{p.knownClues.map((clue, index) => <li key={`${clue.caseId}-${index}`}>{copy(clue.text)}</li>)}</ul>}
      </section>
      <section aria-label="合理安排的当前窗口"><h4>合理安排</h4>
        {p.pendingArrangement ? <p>一次归还原书的安排仍待发生，还剩{pendingWindow}秒。须明确等待，并在执行时再次满足原门、路线和许可条件；关门或撤回许可可使它失效。</p> : <p>当前没有等待执行的安排。已经执行的归还不能重写，普通归还仍须实际走动和交接。</p>}
        <p>互知线索：尝试{p.abilityUses['audience.s1.reciprocal-insight'].attempts}次、成功{p.abilityUses['audience.s1.reciprocal-insight'].successes}次、实际生效{p.abilityUses['audience.s1.reciprocal-insight'].applied}次；合理安排：尝试{p.abilityUses['audience.s1.plausible-arrangement'].attempts}次、成功{p.abilityUses['audience.s1.plausible-arrangement'].successes}次、实际生效{p.abilityUses['audience.s1.plausible-arrangement'].applied}次。</p>
      </section>
      {selectedCase && selectedCase.attempts.length > 1 && <details className="seer-fold"><summary>此前尝试与已付代价</summary><ul>{selectedCase.attempts.slice(0, -1).map((previous, index) => <li key={`${previous.invitedWeek}-${index}`}>第{previous.invitedWeek}周：{previous.evidence.aborted ? '已安全中止' : previous.evidence.returned ? '已实际收尾' : '已有现场记录'}；{previous.outcome === null ? '没有能力判定' : `能力${TIER[previous.outcome]}`}，原结果与已付代价继续保留。</li>)}</ul></details>}
      <details className="seer-fold"><summary>本案范围、普通替代与退路</summary><ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul><p>{copy(life.environment)}</p><p>{life.reflected ? '三案报告与反思已保存。' : '报告与反思只记录已经真实发生并收束的经历。'}</p></details>
    </section>;
  }
  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    return <section aria-label="作家可选真实交战">
      <h3>{copy(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{copy(encounter.story)}</p>
      {encounter.preparation && <p>第{encounter.preparation.week}周实际到场，已付{encounter.preparation.actionsPaid}行动；和平离场不退款。</p>}
      <p>{enemy.name} · {enemy.age}岁 · 序列{enemy.sequence}；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。</p>
      <p>当前策略：{POLICIES[encounter.policy]}。是否实际施放取决于当前动作、资源与抵抗；失败仍支付代价。</p>
      <p>本人在{scene.playerLocation === 'COURT' ? '原石庭' : '原阅读室'}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；实际步行{scene.playerTravelMetres}米，现场经过{scene.clockSeconds}秒，普通出口开放。</p>
      <p>{scene.knownPlayerName === null ? '尚未实际交换姓名，不能凭空取得互知线索的前提。' : <>已经实际交谈，对方知道本人姓名{scene.knownPlayerName}；这不提供其他私密信息。</>}阅读室中的两位成年人和旧相识没有到场。</p>
      <section aria-label="对手的同一原杖"><h4>对手原物</h4><p>同一根{materials.weapon.massKg}千克原杖{materials.weapon.location === 'HAND' ? '仍在对手手中' : '已落在原石庭地面'}，完整度{materials.weapon.condition}/100。离场不会取得或复制原杖。</p></section>
      <p>对手已实际使用心灵脉冲{enemy.powerUses.MIND_PULSE}次、屏护{enemy.powerUses.WARD}次、注意抵抗{enemy.powerUses.ATTENTION}次。资源不足时仍可用原杖普通应对。</p>
      <details className="seer-fold"><summary>交战消耗、抵抗与有限窗口</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{copy(fact)}</li>)}</ul></details>
    </section>;
  }
}
