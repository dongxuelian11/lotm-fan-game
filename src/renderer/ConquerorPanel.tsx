import { useEffect, useRef, useState } from 'react';
import { playerText } from '../shared/player-text.js';
import type { ConquerorAction, ConquerorCommand, ConquerorProjection } from '../domain/conqueror/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'SET_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['REST_TEAM', 'RECOVER_TEAM', 'COOL_DOWN', 'RETURN_HOME', 'ABORT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已安全中止，待普通续办', ACTIVE: '尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '已结束' };
const ENEMY_STATUS = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const TOOL_NAMES = { 'yard-cart': '原撬杆', 'iron-target': '原钳', 'withdrawn-permission': '原绑带' };
const PERMISSION = { UNKNOWN: '尚未取得本次许可', GRANTED: '仅同意本次约定操作', WITHDRAWN: '超凡许可已经撤回，仅同意普通搬运' };

export interface ConquerorPanelProps {
  value: ConquerorProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: ConquerorCommand) => void;
  onClose?: () => void;
}

/** The view never changes resources or manufactures commands: it submits a current public action verbatim. */
export function ConquerorPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: ConquerorPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: ConquerorAction; facts: string } | null>(null);
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
  const selectedBottle = value.bottles.find(bottle => bottle.id === goal)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const activeCase = life.cases.find(entry => entry.id === life.practice.activeCase);
  const selectedCase = activeCase ?? life.cases.find(entry => entry.id === goal)
    ?? life.cases.find(entry => entry.status !== 'RESOLVED') ?? life.cases[0];
  const inEncounter = encounter.inside || (!activeCase && value.promoted && goal === 'encounter');
  const inside = value.insideCase || life.insideCase || encounter.inside;
  const entries = value.actions.filter(action => inEncounter ? ENCOUNTER.has(action.command.type)
    : value.promoted ? !ACQUISITION.has(action.command.type) && !ENCOUNTER.has(action.command.type)
      && (!('caseId' in action.command) || action.command.caseId === selectedCase?.id)
      : ACQUISITION.has(action.command.type) && (!('bottleId' in action.command) || action.command.bottleId === selectedBottle?.id));
  const next = entries.find(action => action.enabled && action.id === value.preferredActionId)
    ?? entries.find(action => action.enabled && action.preferredAction)
    ?? entries.find(action => action.enabled && !action.cleanup && !COMMON.has(action.command.type))
    ?? entries.find(action => action.enabled) ?? entries[0];
  const common = entries.filter(action => action !== next && (COMMON.has(action.command.type) || action.cleanup)).slice(0, 3);
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

  function choose(action: ConquerorAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: ConquerorAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function actionControl(action: ConquerorAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `conqueror-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{playerText(action.label)}</strong><span className="slice-modifiers">{playerText(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`conqueror-reason-${action.id}`}>{playerText(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section aria-label="征服者当前资源">
      <h3>身体与资源</h3>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      <p>原伤继续生效。停止、冷却、归还原物与晋升不会免费治疗本人，也不会返还已付灵性、精力或费用。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="征服者成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{playerText(value.title)}</h2>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : playerText(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">
        {value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="征服者目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={locked || confirmation !== null || (value.promoted ? inside : life.insideCase || encounter.inside)}
          onChange={event => { setGoal(event.target.value); setExtraId(null); }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{playerText(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：铸工外院的通行争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{playerText(bottle.title)} · {playerText(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="征服者其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => setExtraId(event.target.value)}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{playerText(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {!value.promoted ? <section aria-label="征服者服药准备">
        <p>{playerText(value.digestion)}</p><p>{playerText(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{playerText(selectedBottle.title)}</h3><p>{playerText(selectedBottle.source)}</p><p>{playerText(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{playerText(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留天气术士。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{playerText(value.risk)}</p><p>{playerText(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{playerText(value.digestion)}</p><p>{playerText(value.appearanceRecord)}</p><p>{playerText(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{playerText(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{playerText(ability.label)} · 掌握{ability.mastery}</h3><p>{playerText(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{playerText(value.environment)}关闭页面不会代替实际停止、冷却、归还原物、走回原处与成员返家；已经发生的事件与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="征服者操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{playerText(live?.label ?? '现场已变化')}</h3>
      <p>{live && playerText(live.cost)}</p>
      {confirmedBottle && <><p>{playerText(confirmedBottle.title)} · {playerText(confirmedBottle.status)}</p><p>{playerText(confirmedBottle.source)}</p><p>当前成功率{confirmedBottle.chance}%</p>
        <p>{playerText(value.risk)}</p><p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。也可取消并继续停留天气术士。</p></>}
      {live?.command.type === 'ENCOUNTER_FIGHT' && <><p>这是与{encounter.enemy.name}的真实交战。双方独立受伤、投降、撤退与死亡都将保存，普通死亡终结本周目。生活练习不代替交战结果。</p><p>{playerText(encounter.story)}</p></>}
      {!confirmedBottle && live?.command.type !== 'ENCOUNTER_FIGHT' && <p>{playerText(inEncounter ? encounter.story : value.promoted ? life.environment : value.story ?? value.risk)}</p>}
      {resources()}
      <p>已经支付的行动、金钱、灵性与各人的精力不因停止而返还；冷却不修复原物，退出不撤销实际伤害。</p>
      {live?.reason && <p className="seer-action-reason">{playerText(live.reason)}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一原瓶' : live?.command.type === 'ENCOUNTER_FIGHT' ? '确认开始真实交战' : '确认执行这一次操作'}</button>
      </div>
      <p>取消不提交。只有收到已保存的新记录后，才能开始下一次操作。</p>
    </section>}
  </section>;

  function lifeFacts() {
    const p = life.practice, attempt = selectedCase?.attempts.at(-1);
    const spent = attempt?.receipts.reduce((sum, receipt) => ({
      spirituality: sum.spirituality + Math.max(0, receipt.before.spirituality - receipt.after.spirituality),
      mind: sum.mind + Math.max(0, receipt.before.mind - receipt.after.mind),
      health: sum.health + Math.max(0, receipt.before.health - receipt.after.health),
      cash: sum.cash + Math.max(0, receipt.before.cash - receipt.after.cash),
      walked: sum.walked + receipt.ownerWalkedMetres,
      seconds: sum.seconds + receipt.elapsedSeconds,
      energy: sum.energy + receipt.memberCosts.reduce((total, member) => total + member.energySpent, 0),
    }), { spirituality: 0, mind: 0, health: 0, cash: 0, walked: 0, seconds: 0, energy: 0 });
    return <section aria-label="征服者生活练习">
      <h3>{playerText(selectedCase?.title ?? life.title)}</h3><p>{playerText(selectedCase?.story ?? life.source)}</p>
      {selectedCase?.preparation && <p>{playerText(selectedCase.preparation)}</p>}
      {selectedCase?.result && <p className="slice-notice">{playerText(selectedCase.result)}</p>}
      <section aria-label="原五位同伴的实际状态"><h4>同一批原同伴</h4>
        <ul>{life.members.map(member => <li key={member.id}>{member.name}：健康{member.health}/100 · 精力{member.energy}/20 · {member.willing ? '当前自愿' : '当前不愿参与'} · {member.present ? '实际在场' : '未到场'} · {member.location === 'HOME' ? '原家中' : '原训练院'}{member.distanceMetres === null ? '' : ` · 距本人${member.distanceMetres}米`}{!member.present ? member.eligible ? ' · 可再邀请' : ' · 当前不能邀请' : ''}</li>)}</ul>
        <p>{life.restRequestedWeek === null ? '休整须实际支付40便士，并在下一真实周确认有限恢复；不会立即补满。' : `第${life.restRequestedWeek}周已支付原成员休整费；须经过下一真实周，再确认至多恢复20健康、8精力。`}</p>
        <p>原五人各自保有身体与意愿。未到场、拒绝、疲劳或离开的人不能被当作新兵或远处力量。</p>
      </section>
      {attempt && <section aria-label="本次许可与实际消耗"><h4>本次许可与代价</h4>
        <p>第{attempt.invitedWeek}周邀请 · {attempt.method === 'ABILITY' ? '有限能力与普通退路' : '普通操作'} · {PERMISSION[attempt.evidence.permission]}。</p>
        {attempt.evidence.permission === 'WITHDRAWN' && <p>听到停止后，不再施加超凡作用。只能按当前同意普通搬运，或安全收尾；先前邀请不能覆盖撤回。</p>}
        <p>能力判定：{attempt.outcome === null ? '尚无实际判定' : TIER[attempt.outcome]}；{attempt.evidence.abilityApplied ? '本次能力已实际生效' : '没有计作能力成功'}。{attempt.evidence.returned ? '原工具与五人已经实际归还、返家。' : '仍须沿原路归还工具并让同伴实际回家。'}</p>
        {attempt.evidence.aborted && <p>本次已安全中止，实际代价与已发生的效果保留。再次办理仍须跨周重新邀请，只能普通续办，不能重抽本次能力结果。</p>}
        {spent && <p>本次实耗{spent.spirituality}灵性、{spent.mind}精神、{spent.health}健康、{spent.cash}便士；五人合计实耗{spent.energy}精力。本人实际步行{spent.walked}米、经过{spent.seconds}秒。</p>}
      </section>}
      {selectedCase && selectedCase.attempts.length > 1 && <details className="seer-fold"><summary>此前尝试与已付代价</summary><ul>{selectedCase.attempts.slice(0, -1).map((previous, index) => <li key={`${previous.invitedWeek}-${index}`}>
        第{previous.invitedWeek}周：{previous.evidence.aborted ? '已安全中止' : previous.evidence.returned ? '已实际收尾' : '已有现场记录'}；{previous.outcome === null ? '没有能力判定' : `能力${TIER[previous.outcome]}`}；
        实耗{previous.receipts.reduce((total, receipt) => total + Math.max(0, receipt.before.spirituality - receipt.after.spirituality), 0)}灵性，五人合计实耗{previous.receipts.reduce((total, receipt) => total + receipt.memberCosts.reduce((sum, member) => sum + member.energySpent, 0), 0)}精力，实际经过{previous.receipts.reduce((total, receipt) => total + receipt.elapsedSeconds, 0)}秒。原结果继续保留。
      </li>)}</ul></details>}
      <section aria-label="原现场与热量冷却"><h4>原现场与原物</h4>
        <p>本人在{p.ownerNode === 'ENTRY' ? '原入口' : '五米外原工位'}，现场累计经过{p.elapsedSeconds}秒。关闭页面不推进冷却时间。</p>
        <p>同一原车已推进{p.cart.movedMetres}米，剩余阻力{p.cart.resistance}；同一原木箱已搬动{p.crate.movedMetres}米。</p>
        <p>原铁件完整度{p.iron.integrity}/100 · 实际热损{p.iron.heatDamage} · 温度{p.iron.temperature}℃ · 还须明确冷却{p.iron.cooldownSeconds}秒。原挡板{p.backstop.charred ? '已留下焦痕' : '尚无焦痕'}。</p>
        <p>原桶还剩{p.water.remainingMl}毫升水，已实际使用{p.water.usedMl}毫升。停止与冷却不修复热损，也不补回原水。</p>
        <p>{p.tools.map(tool => `${TOOL_NAMES[tool.caseId]}${tool.holder === 'RACK' ? '在原架' : '随本人在原工位'}`).join('；')}。</p>
        <p>阵势合力：尝试{p.abilityUses['hunter.s1.formation-momentum'].attempts}次、成功{p.abilityUses['hunter.s1.formation-momentum'].successes}次、实际生效{p.abilityUses['hunter.s1.formation-momentum'].applied}次；焰势凝束：尝试{p.abilityUses['hunter.s1.focused-flame'].attempts}次、成功{p.abilityUses['hunter.s1.focused-flame'].successes}次、实际生效{p.abilityUses['hunter.s1.focused-flame'].applied}次。</p>
      </section>
      <details className="seer-fold"><summary>本案范围、普通替代与退路</summary><ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{playerText(entry)}</li>)}</ul><p>{playerText(life.environment)}</p><p>{life.reflected ? '三案报告与反思已保存。' : '报告与反思只记录已经真实发生并收束的经历。'}</p></details>
    </section>;
  }
  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    return <section aria-label="征服者可选真实交战">
      <h3>{playerText(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{playerText(encounter.story)}</p>
      {encounter.preparation && <p>第{encounter.preparation.week}周实际到场，已付{encounter.preparation.actionsPaid}行动；和平离场不退款。</p>}
      <p>{enemy.name} · {enemy.age}岁 · 序列{enemy.sequence}；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。</p>
      <p>当前策略：{encounter.policy === 'FOCUS_FLAME' ? '允许焰势凝束，实际抽中且条件足够时才施放' : '保留焰势凝束，抽中时普通应对'}。原队员没有到场，阵势合力不会提供力量。</p>
      <p>本人在{scene.playerLocation === 'YARD' ? '原外院' : '原工坊'}，与罗南相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；实际步行{scene.playerTravelMetres}米，现场经过{scene.clockSeconds}秒，普通出口开放。</p>
      <section aria-label="对手原铁杖与原水"><h4>原物与实际热量</h4>
        <p>罗南的同一根{materials.weapon.massKg}千克原铁杖{materials.weapon.location === 'HAND' ? '仍在他手中' : '已落在原院地面'}；温度{materials.weapon.temperatureC}℃，耐久{materials.weapon.condition}/100，实际受热{materials.weapon.heatingPulses}次、变形{materials.weapon.deformations}次。</p>
        <p>他自有的原水还剩{materials.water.remainingLitres}/{materials.water.initialLitres}升，实际用水冷却{materials.water.uses}次。冷却不会修复损坏，离场不会取走或复制这些原物。</p>
      </section>
      <p>他已实际使用火流{enemy.powerUses.FIRE_JET}次、屏护{enemy.powerUses.WARD}次、原水冷却{enemy.powerUses.COOL_WEAPON}次、精神施压{enemy.powerUses.MENTAL_PRESSURE}次。</p>
      <details className="seer-fold"><summary>交战消耗、抵抗与冷却规则</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{playerText(fact)}</li>)}</ul></details>
    </section>;
  }
}
