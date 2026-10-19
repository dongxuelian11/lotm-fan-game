import { useEffect, useRef, useState } from 'react';
import { playerText } from '../shared/player-text.js';
import type { CivilizationEnlightenerAction, CivilizationEnlightenerCommand, CivilizationEnlightenerProjection } from '../domain/civilization-enlightener/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'MANUAL_STOP', 'RETURN_ORIGINALS', 'RETURN_WRENCH', 'RETURN_HOME', 'CLOSE', 'WITHDRAW', 'REVOKE_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已安全中止，待普通续办', ACTIVE: '尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '已结束' };
const ENEMY_STATUS = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const PERMISSION = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回' };
const LOCATION = { PLAYER: '本人随身', BENCH_START: '工台近端', BENCH_END: '工台远端', GUARD_MARK: '原护架标记', YARD: '独立工院' };
const SHIM = { SUPPLIER: '仍由工坊保管，尚未购买', PLAYER: '已实付购买，尚未耗用', CONSUMED: '已经耗用' };
const NODE = { NEAR: '工台近端', FAR: '两米外的工台远端' };
const POLICIES = { INHERITED_ONLY: '只用已学能力', PROCESS_ANALYSIS: '允许工艺析解', OPERATIONAL_GUIDANCE: '允许操作启示', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };

export interface CivilizationEnlightenerPanelProps {
  value: CivilizationEnlightenerProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: CivilizationEnlightenerCommand) => void;
  onClose?: () => void;
}

/** The view never changes resources or manufactures commands: it submits a current public action verbatim. */
export function CivilizationEnlightenerPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: CivilizationEnlightenerPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: CivilizationEnlightenerAction; facts: string } | null>(null);
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

  function choose(action: CivilizationEnlightenerAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: CivilizationEnlightenerAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function actionControl(action: CivilizationEnlightenerAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `civilization-enlightener-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{copy(action.label)}</strong><span className="slice-modifiers">{copy(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`civilization-enlightener-reason-${action.id}`}>{copy(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    return current && <section aria-label="文明启蒙者当前资源">
      <h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>晋升、停止与归还原物不会免费恢复身体，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="文明启蒙者成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{copy(value.title)}</h2>
      <section aria-label="文明启蒙者阶段总览"><p>当前阶段：{inEncounter ? '可选真实遭遇' : value.promoted ? life.reflected ? '生活报告与反思已完成' : '三项工坊实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p><p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 文明启蒙者扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p></section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : copy(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">
        {value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="文明启蒙者目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked}
          onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{copy(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：工院中的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{copy(bottle.title)} · {copy(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="文明启蒙者其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{copy(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {!value.promoted ? <section aria-label="文明启蒙者服药准备">
        <p>{copy(value.digestion)}</p><p>{copy(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{copy(selectedBottle.title)}</h3><p>{copy(selectedBottle.source)}</p><p>{copy(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{copy(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留知识导师。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{copy(value.risk)}</p><p>{copy(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{copy(value.digestion)}</p><p>{copy(value.appearanceRecord)}</p><p>{copy(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{copy(ability.label)} · 掌握{ability.mastery}</h3><p>{copy(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{copy(value.environment)}关闭页面不会代替停止作用、归还原物与沿原路离开；已经发生的事件与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="文明启蒙者操作确认" onKeyDown={event => {
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
        <p>{copy(value.risk)}</p><p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。也可取消并继续停留知识导师。</p></>}
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

  function originalFacts() {
    return <section aria-label="同一原盒与原架"><h4>两件原物的当前资源</h4>
      {life.creations.length ? <ul>{life.creations.map(original => <li key={original.id}>
        {original.kind === 'MESSENGER_BOX' ? '原小轮盒' : '原护架'} · {original.id}：储能{original.charge}/3，耐久{original.durability}/100；{LOCATION[original.location]}，{original.active ? '正在驱动' : '已经停用'}。
      </li>)}</ul> : <p>当前没有可用原物记录，须先核对实际持有的原件。</p>}
      <p>两件原物沿用各自的制造记录。分析、授课、晋升与换页不会补能；没有储能时不作自动演示。诊断后仍须用真实工具、付费材料与亲手工作修理。</p>
    </section>;
  }

  function lifeFacts() {
    const p = life.practice, attempt = selectedCase?.attempts.at(-1), permission = selectedCase?.permission;
    const current = p.activeCase === selectedCase?.id && selectedCase?.contactOpen;
    const permissionText = (state: keyof typeof PERMISSION) => state === 'GRANTED' && !current ? '本案曾明确同意，当前无生效许可' : PERMISSION[state];
    const spent = attempt?.receipts.reduce((total, receipt) => ({
      spirituality: total.spirituality + Math.max(0, receipt.before.spirituality - receipt.after.spirituality),
      mind: total.mind + Math.max(0, receipt.before.mind - receipt.after.mind),
      health: total.health + Math.max(0, receipt.before.health - receipt.after.health),
      cash: total.cash + Math.max(0, receipt.before.cash - receipt.after.cash),
      walked: total.walked + receipt.ownerWalkedMetres, seconds: total.seconds + receipt.elapsedSeconds,
    }), { spirituality: 0, mind: 0, health: 0, cash: 0, walked: 0, seconds: 0 });
    const repair = selectedCase?.attempts.flatMap(previous => previous.receipts).find(receipt => receipt.command.type === 'REPAIR_FRAME');
    const frameBefore = repair?.originalsBefore.find(original => original.id === 'AL4-FRAME-1');
    const frameAfter = repair?.originalsAfter.find(original => original.id === 'AL4-FRAME-1');
    const analysis = p.abilityUses['paragon.s1.process-analysis'], guidance = p.abilityUses['paragon.s1.operational-guidance'];
    return <section aria-label="文明启蒙者生活练习">
      <h3>{copy(selectedCase?.title ?? life.title)}</h3><p>{copy(selectedCase?.story ?? life.source)}</p>
      {selectedCase?.preparation && <p>{copy(selectedCase.preparation)}</p>}
      {selectedCase?.result && <p className="slice-notice">{copy(selectedCase.result)}</p>}
      <section aria-label="维拉的本次参与"><h4>维拉的本次选择</h4>
        <p>{p.participant.name} · {p.participant.age}岁 · {p.participant.present ? '实际在场' : '当前不在场'} · {NODE[p.participant.node]} · 已实际步行{p.participant.walkedMetres}米。</p>
        {permission && <p>能力许可：{permissionText(permission.ability)}；普通教学许可：{permissionText(permission.teaching)}。</p>}
        <p>每案重新邀请，分别询问能力与普通教学许可。先前的同意不沿用；维拉可以拒绝或撤回。她的原包裹仍由她持有，本次练习不借用包裹。</p>
      </section>
      {attempt && <section aria-label="本次许可与实际消耗"><h4>本次许可与代价</h4>
        <p>第{attempt.invitedWeek}周邀请 · {attempt.method === 'ABILITY' ? '有限能力与普通退路' : '普通操作'}。</p>
        {permission?.ability === 'WITHDRAWN' && <p>超凡许可已经撤回，不能继续施加新的能力作用；原有消耗与完成的事实保留。</p>}
        <p>能力判定：{attempt.outcome === null ? '尚无实际判定' : TIER[attempt.outcome]}；{attempt.evidence.abilityApplied ? '对应能力已实际应用' : '尚未计作能力实际应用'}。{attempt.evidence.returned ? '原物已收回、扳手已归还，本人已沿原路返回，维拉已离场。' : '仍须停止负载、收回原物、归还扳手并实际走回入口。'}</p>
        {spent && <p>本次实耗{spent.spirituality}灵性、{spent.mind}精神、{spent.health}健康、{spent.cash}便士；本人实际步行{spent.walked}米，经过{spent.seconds}秒。</p>}
        {attempt.receipts.some(receipt => receipt.command.type === 'ABORT') && <p>本次已经安全中止。之后只能付费普通续办；原失败、消耗、已用垫片与已完成修理保留，不能重抽能力结果。</p>}
      </section>}
      {originalFacts()}
      <section aria-label="原工台、工具与实际位置"><h4>同一工台与实际工具</h4>
        <p>沃德原工作台 · {p.workbenchId}。本人在{NODE[p.ownerNode]}，已实际步行{p.ownerWalkedMetres}米，现场累计经过{p.elapsedSeconds}秒。关闭页面不会推进时间或代替归还。</p>
        <p>原挡条仍在工坊原架；低载负荷{p.stopBar.loadRunning ? '仍在运行，须实际停载' : '已经停止'}。原手动停机柄在{NODE[p.handle.node]}。</p>
        <p>沃德的唯一普通扳手{p.wrench.holder === 'PLAYER' ? '仍由本人借用' : '已在沃德原架'}，位于{NODE[p.wrench.node]}；借出{p.wrench.loans}次、实际归还{p.wrench.returns}次。</p>
        <p>唯一黄铜垫片：{SHIM[p.shim.status]}，价格{p.shim.price}便士。{p.shim.consumedWeek !== null && `已在第${p.shim.consumedWeek}周的实际修理中耗用，不能再买出同一片。`}</p>
        {attempt && <p>本次原制造记录：{attempt.receipts.some(receipt => receipt.command.type === 'READ_RECORDS') ? '已亲自读取' : '尚未亲自读取'}；亲手检查：{attempt.receipts.some(receipt => receipt.command.type === 'HAND_INSPECT') ? '已实际完成' : '尚未实际完成'}。</p>}
        {frameBefore && frameAfter ? <p>本案实际修理：同一原架耐久{frameBefore.durability}→{frameAfter.durability}，储能{frameBefore.charge}→{frameAfter.charge}。黄铜垫片已经耗用；诊断本身没有修复原件。</p> : selectedCase?.id === 'worn-bearing' && <p>本次尚无实际修理记录。成功诊断后仍须借用扳手、购买并耗用垫片，亲手完成修理；仅此实际修理可增加5耐久，最多100。</p>}
      </section>
      <section aria-label="普通停载与有限教学"><h4>一项普通停载操作</h4>
        <p>原手柄已由本人实际示范{p.handle.demonstrations}次；普通停载{p.handle.ordinaryStops}次；维拉实际停载{p.handle.learnerStops}次。</p>
        {p.pendingGuidance ? <p>操作启示窗口还剩{Math.max(0, p.pendingGuidance.expiresAt - p.elapsedSeconds)}秒，只给随后一次独立普通尝试加值{p.pendingGuidance.bonus}。维拉仍须自己尝试；当前许可、原负载与实际位置须继续满足条件，界面等待不会自动执行。</p> : <p>当前没有待应用的教学窗口。施术失败、窗口结束或学习失败后，仍可由本人亲手拉下原手柄普通停载。</p>}
        {attempt && <p>维拉的独立尝试：{attempt.learnerOutcome === null ? '尚无实际判定' : TIER[attempt.learnerOutcome]}；{attempt.evidence.ordinaryStepLearned ? '已实际完成这一项普通操作' : '尚无完成这一项普通操作的记录'}。这不会赋予维拉非凡能力。</p>}
        <p>工艺析解：尝试{analysis.attempts}次、成功{analysis.successes}次、实际应用{analysis.applied}次；操作启示：尝试{guidance.attempts}次、成功{guidance.successes}次、实际应用{guidance.applied}次。</p>
        <p>只有对应能力实际成功应用并完成报告，才增加该项掌握；普通完成和撤回许可不会增加新能力掌握。</p>
      </section>
      {selectedCase && selectedCase.attempts.length > 1 && <details className="seer-fold"><summary>此前尝试与已付代价</summary><ul>{selectedCase.attempts.slice(0, -1).map((previous, index) => <li key={`${previous.invitedWeek}-${index}`}>第{previous.invitedWeek}周：{previous.receipts.some(receipt => receipt.command.type === 'ABORT') ? '已安全中止' : previous.evidence.returned ? '已实际收尾' : '已有现场记录'}；{previous.outcome === null ? '没有能力判定' : `能力${TIER[previous.outcome]}`}；{previous.learnerOutcome === null ? '没有独立学习判定' : `独立学习${TIER[previous.learnerOutcome]}`}。原结果、已耗材料与已付代价继续保留。</li>)}</ul></details>}
      <details className="seer-fold"><summary>本案范围、普通替代与退路</summary><ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul><p>{copy(life.environment)}</p><p>{life.reflected ? '三案报告与反思已保存。' : '报告与反思只记录已经真实发生并收束的经历。'}</p></details>
    </section>;
  }

  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    return <section aria-label="文明启蒙者可选真实交战">
      <h3>{copy(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{copy(encounter.story)}</p>
      <p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。</p>
      <p>当前策略：{POLICIES[encounter.policy]}。开战后不能更换；是否实际施放取决于当次观察、动作、资源与抵抗，失败仍支付代价。</p>
      <p>本人在{scene.playerLocation === 'YARD' ? '独立工院' : '原工坊'}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；实际步行{scene.playerTravelMetres}米，现场经过{scene.clockSeconds}秒，普通出口开放，离场须实际走过4米。</p>
      <p>维拉与旧案中的人没有到场；先前已经死亡或投降的对手保留原结局。精神耗尽而投降与身体死亡分别记录。</p>
      {originalFacts()}
      <section aria-label="对手原杖与可见机械"><h4>对手的原物与有限资源</h4>
        <p>同一根{materials.weapon.massKg}千克原杖{materials.weapon.location === 'HAND' ? '仍在对手手中' : '已落在原工院地面'}，完整度{materials.weapon.condition}/100。离场不会取得或复制原杖。</p>
        <p>原可见机械储能{materials.mechanism.charge}/{materials.mechanism.capacity}，只按实际剩余资源运作。</p>
      </section>
      <p>对手已实际使用机械脉冲{enemy.powerUses.MECHANICAL_PULSE}次、护持{enemy.powerUses.WARD}次、注意抵抗{enemy.powerUses.ATTENTION}次。资源不足时仍可用原杖普通应对。</p>
      <details className="seer-fold"><summary>交战消耗、抵抗与有限窗口</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{copy(fact)}</li>)}</ul></details>
    </section>;
  }
}
