import { useEffect, useRef, useState } from 'react';
import { playerText } from '../shared/player-text.js';
import type { BeautyGoddessAction, BeautyGoddessCommand, BeautyGoddessProjection } from '../domain/beauty-goddess/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME', 'CONFIRM_TRANSFORMATION', 'DECLINE_TRANSFORMATION']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER', 'BUY_BATTLE_LAMP', 'PREPARE_BATTLE_PIECE']);
const COMMON = new Set(['ABORT', 'RETURN_HOME', 'REVOKE_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'DECLINE_TRANSFORMATION', 'RETURN_GUEST', 'RETURN_WEIGHT', 'RETURN_PIECES', 'RETURN_LAMP', 'LOWER_SHUTTER', 'EXTINGUISH_LAMP']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已安全中止，待普通续办', ACTIVE: '尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '已结束' };
const ENEMY_STATUS = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const PERMISSION = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回' };
const POLICIES = { INHERITED_ONLY: '只用已学能力', SELF_POISE: '允许辉映调息', BOUNDED_MOONFORM: '允许月辉定形', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };
const GENDER = (gender: string | null) => gender === 'FEMALE' ? '女性' : gender === 'MALE' ? '男性' : '尚无记录';

export interface BeautyGoddessPanelProps {
  value: BeautyGoddessProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: BeautyGoddessCommand) => void;
  onClose?: () => void;
}

/** The view never changes resources or manufactures commands: it submits a current public action verbatim. */
export function BeautyGoddessPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: BeautyGoddessPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: BeautyGoddessAction; facts: string } | null>(null);
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

  function choose(action: BeautyGoddessAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: BeautyGoddessAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function actionControl(action: BeautyGoddessAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `beauty-goddess-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{copy(action.label)}</strong><span className="slice-modifiers">{copy(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`beauty-goddess-reason-${action.id}`}>{copy(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="美神当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="美神当前资源">
      <h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>晋升、停止与归还原物不会免费恢复身体，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="美神成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{copy(value.title)}</h2>
      <section aria-label="美神阶段总览"><p>当前阶段：{inEncounter ? '可选真实遭遇' : value.promoted ? life.reflected ? '生活报告与反思已完成' : '玻璃屋门廊的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p><p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 美神扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p></section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : copy(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">
        {value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="美神目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked}
          onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{copy(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：门廊外的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{copy(bottle.title)} · {copy(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="美神其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{copy(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {transformationFacts()}
      {guestFacts()}
      {!value.promoted ? <section aria-label="美神服药准备">
        <p>{copy(value.digestion)}</p><p>{copy(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{copy(selectedBottle.title)}</h3><p>{copy(selectedBottle.source)}</p><p>{copy(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{copy(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留创生者。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{copy(value.risk)}</p><p>{copy(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{copy(value.digestion)}</p><p>{copy(value.appearanceRecord)}</p><p>{copy(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{copy(ability.label)} · 掌握{ability.mastery}</h3><p>{copy(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{copy(value.environment)}关闭页面不会代替停止作用、归还原物与沿原路离开；已经发生的事件与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="美神操作确认" onKeyDown={event => {
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
        <p>{copy(value.risk)}</p><p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。也可取消并继续停留创生者。</p></>}
      {(live?.command.type === 'CONFIRM_TRANSFORMATION' || live?.command.type === 'CONSUME') && <section aria-label="本次身体变化确认"><h4>晋升成功后的身体变化</h4><p>{value.currentGender === 'MALE' ? '当前身体为男性。成功晋升美神后，身体会成为女性。' : value.currentGender === 'FEMALE' ? '当前身体已经为女性。成功晋升美神后仍为女性。' : '成功晋升美神后，身体会成为女性。'}</p><p>只有成功服药后才发生这一结果；服药失败不改变原有身体性别。姓名、年龄、性格与性取向不因这次晋升而改变。</p><p>{live.command.type === 'CONFIRM_TRANSFORMATION' ? '这次仅确认你已了解并接受身体变化，不会服药，也不会立即改变身体。服用哪一瓶仍须另行确认。' : '已保存的身体变化确认不代替本次服药选择。'}也可以取消或拒绝，并继续停留序列2创生者。</p></section>}
      {live?.command.type === 'DECLINE_TRANSFORMATION' && <p>拒绝后继续停留序列2创生者，不服药、不改变身体。若已经支付当周准备，停止准备不会退款。</p>}
      {live?.command.type === 'ENCOUNTER_POLICY' && <p>本次明确选择：{POLICIES[live.command.policy]}。只保存本场策略，不会施法、购买材料或开始战斗。</p>}
      {live?.command.type === 'ENCOUNTER_FIGHT' && <><p>这是与{encounter.enemy.name}的真实交战。双方独立受伤、投降、撤退与死亡都将保存，普通死亡终结本周目。生活练习不代替交战结果。</p><p>本场策略：{POLICIES[encounter.policy]}。开战后不能更换；能力是否真正可用仍按实际资源与抵抗结算。</p><p>{copy(encounter.story)}</p></>}
      {!confirmedBottle && live?.command.type !== 'ENCOUNTER_FIGHT' && <p>{copy(inEncounter ? encounter.story : value.promoted ? life.environment : value.story ?? value.risk)}</p>}
      {resources()}
      <p>已经支付的行动、金钱、灵性与精神不因停止而返还；撤回超凡许可会阻止新的能力作用，退出不撤销已经发生的事实和实际伤害。</p>
      {live?.reason && <p className="seer-action-reason">{copy(live.reason)}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONFIRM_TRANSFORMATION' ? '确认接受晋升后的身体变化' : live?.command.type === 'DECLINE_TRANSFORMATION' ? '确认拒绝，继续停留创生者' : live?.command.type === 'CONSUME' ? '确认服用这一原瓶' : live?.command.type === 'ENCOUNTER_FIGHT' ? '确认开始真实交战' : '确认执行这一次操作'}</button>
      </div>
      <p>取消不提交。只有收到已保存的新记录后，才能开始下一次操作。</p>
    </section>}
  </section>;

  function transformationFacts() {
    const decision = value.transformation.decision;
    return <section aria-label="美神身体变化记录"><h3>身体变化与自己的选择</h3>
      <p>当前身体：{GENDER(value.currentGender)}；晋升前身体：{GENDER(value.originalGender ?? value.currentGender)}。</p>
      <p>{value.promoted ? '已成功晋升美神，当前身体为女性。' : '成功晋升美神会使男性身体成为女性，原本为女性则保持女性；失败不改变原有身体性别。'}</p>
      <p>姓名、年龄、性格与性取向不因这次晋升而改变。</p>
      <p>{decision === 'ACCEPTED' ? `第${value.transformation.acknowledgedWeek}周已单独确认接受身体变化。` : decision === 'DECLINED' ? '已经拒绝身体变化，可以继续停留序列2创生者。' : '尚未确认身体变化。可以先了解、拒绝，或继续停留序列2创生者。'}{value.transformation.outcome === 'FEMALE' ? '成功服药后的身体结果已保存。' : '尚未发生成功服药后的身体变化。'}</p>
    </section>;
  }

  function guestFacts() {
    const partner = life.partner;
    return <section aria-label="同一流灯的当前资源"><h3>流灯的身体与选择</h3>
      <p>{partner.name}是独立的成年灵界来客，仍使用自己的原身体与原声片。</p>
      <p>健康{partner.health}/100 · 精神{partner.mind}/100 · 精力{partner.stamina}/100 · {partner.status === 'ALIVE' ? '存活' : '已经死亡'}。</p>
      <p>目前在{partner.location === 'HOME' ? '原玻璃屋内' : partner.location === 'YARD' ? '现场院内' : '原普通通路'}，累计普通行走{partner.ordinaryDistanceM}米；原声片仍属于流灯。{partner.willing ? '当前愿意商谈；每案仍须重新询问明确许可。' : '当前不愿参与，不能代其同意或换一个身体。'}</p>
      <p>只有实际安排并支付休息，才按保存的结果恢复精力与精神；休息不恢复健康，也不能使死者复活。</p>
      <details className="seer-fold"><summary>实际付费休息记录</summary>{partner.restHistory.length ? <ul>{partner.restHistory.map((rest, index) => <li key={`${rest.week}-${index}`}>第{rest.week}周实付{rest.paidPennies}便士；精力{rest.staminaBefore}→{rest.staminaAfter}，精神{rest.mindBefore}→{rest.mindAfter}，健康维持{rest.healthUnchanged}。</li>)}</ul> : <p>没有实际付费休息记录。</p>}</details>
    </section>;
  }

  function lifeFacts() {
    const p = life.practice, attempt = selectedCase?.attempts.at(-1), permission = selectedCase?.permission;
    const current = p.activeCase === selectedCase?.id && selectedCase?.contactOpen;
    const permissionText = (state: keyof typeof PERMISSION, id: 'SM3-LUMEN' | 'BG1-DARIA42' | 'PLAYER') => state === 'GRANTED' && (!current || !life.currentConsents.some(entry => entry.id === id && entry.consented)) ? '本案曾明确同意，当前无生效许可' : PERMISSION[state];
    const spent = attempt?.receipts.reduce((total, receipt) => ({
      spirituality: total.spirituality + Math.max(0, receipt.before.spirituality - receipt.after.spirituality),
      mind: total.mind + Math.max(0, receipt.before.mind - receipt.after.mind),
      health: total.health + Math.max(0, receipt.before.health - receipt.after.health),
      cash: total.cash + Math.max(0, receipt.before.cash - receipt.after.cash),
      actions: total.actions + Math.max(0, receipt.before.actions - receipt.after.actions),
      stamina: total.stamina + receipt.guestStaminaSpent, oil: total.oil + receipt.lampFuelBurned,
      walked: total.walked + receipt.playerWalkedMetres, guestWalked: total.guestWalked + receipt.guestWalkedMetres, seconds: total.seconds + receipt.elapsedSeconds,
    }), { spirituality: 0, mind: 0, health: 0, cash: 0, actions: 0, stamina: 0, oil: 0, walked: 0, guestWalked: 0, seconds: 0 });
    const holder = { 'BG1-DARIA42': '达莉娅本人', PLAYER: '本人', 'SM3-LUMEN': '流灯', TABLE: '两米外的原桌', PAD: '原软垫' };
    const poiseSeconds = p.pendingPoise ? Math.max(0, p.pendingPoise.expiresAt - p.elapsedSeconds) : 0;
    const moonformSeconds = p.pendingMoonform ? Math.max(0, p.pendingMoonform.expiresAt - p.elapsedSeconds) : 0;
    return <section aria-label="美神生活练习">
      <h3>{copy(selectedCase?.title ?? life.title)}</h3><p>{copy(selectedCase?.story ?? life.source)}</p>
      {selectedCase?.preparation && <p>{copy(selectedCase.preparation)}</p>}
      {selectedCase?.result && <p className="slice-notice">{copy(selectedCase.result)}</p>}
      <section aria-label="本案的独立许可"><h4>各自决定本次是否参与</h4>
        <p>{p.caretaker.name} · {p.caretaker.age}岁，仍在原玻璃屋照看自己的灯与镇纸。</p>
        {permission && <ul><li>流灯的本次搬运：{permissionText(permission.guest, 'SM3-LUMEN')}。</li><li>达莉娅的原物与光照范围：{permissionText(permission.caretaker, 'BG1-DARIA42')}。</li><li>本人使用自身能力：{permissionText(permission.selfPower, 'PLAYER')}。</li></ul>}
        <p>本人调息不代表他人同意搬运。每案各自重新选择；撤回后停止未来作用，已付费用与已经发生的事实保留。</p>
      </section>
      <section aria-label="实际位置与归还"><h4>原身体、路程与归还</h4>
        <p>本人在{p.playerLocation === 'HOME' ? '原玻璃屋内' : '门廊外原路'}，屋内位置距起点{p.ownerOffsetMetres}米；流灯在原屋内距起点{p.guestOffsetMetres}米。本人累计实走{p.playerTravelMetres}米，现场经过{p.elapsedSeconds}秒。</p>
        <p>达莉娅的同一块{p.weight.massGrams}克玻璃镇纸，目前由{holder[p.weight.holder]}保管。{selectedCase?.returned ? '本案实际还物与归程已完成。' : '还物与归程尚未全部完成。'}</p>
        <p>普通往返与亲手拾取、放置、归还始终是安全退路。流灯愿意搬运时，去程实际耗6精力，回程实际耗3精力；不能用关闭页面代替行走。</p>
      </section>
      <section aria-label="原灯遮板与实付月片"><h4>实际光照与有限材料</h4>
        <p>达莉娅的原灯由{p.lamp.holder === 'PLAYER' ? '本人' : '达莉娅本人'}保管，{p.lamp.lit ? '已经点亮' : '目前熄灭'}；剩余灯油可燃{p.lamp.fuelSeconds}秒，已实际燃烧{p.lamp.fuelBurnedSeconds}秒。</p>
        <p>{p.lamp.oilPurchasedWeek === null ? '尚未购买灯油，没有可免费补出的燃料。' : `第${p.lamp.oilPurchasedWeek}周已实付${p.lamp.oilPrice}便士购买${p.lamp.oilSeconds}秒灯油。`}遮板{p.shutter.position === 'RAISED' ? '已经抬起，光路开放' : '已经放下，光路受阻'}。</p>
        <ul>{p.pieces.map((piece, index) => <li key={piece.id}>第{index + 1}片月片：{piece.status === 'SUPPLIER' ? '尚未购买，仍在商店' : piece.status === 'READY' ? '已经实付购买，尚未耗用' : '已经耗尽'}；{piece.holder === 'SHOP' ? '由商店保管' : piece.holder === 'PLAYER' ? '本人实际持有' : '已经实放返还盘'}。{piece.purchasedWeek !== null && `第${piece.purchasedWeek}周实付${piece.price}便士。`}{piece.spentWeek !== null && `第${piece.spentWeek}周已耗用。`}</li>)}</ul>
        <p>耗尽月片仍须作为同一实物归还。旧案留在返还盘的原珠不在本人库存，也不会变成这里的新月片。</p>
      </section>
      <section aria-label="两项能力的有限窗口"><h4>先施放，再做真实动作</h4>
        <p>辉映调息消耗6灵性、2精神，只在30秒内帮助本人随后一次普通精细动作，加值10。施放本身不完成放置，也不增加掌握。</p>
        {p.pendingPoise && poiseSeconds > 0 ? <p>辉映调息还剩{poiseSeconds}秒，等待一次真实精细操作。</p> : <p>当前没有可应用的辉映调息窗口。</p>}
        <p>月辉定形消耗8灵性、3精神与一片实付月片，只在原灯实际点亮、光路开放且当前许可有效时，帮助一次待办的真实搬运。它不创造物质、治疗身体或改变他人的意愿。</p>
        {p.pendingMoonform && moonformSeconds > 0 ? <p>月辉定形还剩{moonformSeconds}秒；随后独立搬运仍可能失败。遮光、撤回或到期会取消剩余作用，已付代价保留。</p> : <p>当前没有可应用的月辉定形窗口；仍可普通拾取、放置与归还。</p>}
        {attempt && <p>本次能力判定：{attempt.outcome === null ? '尚未进行' : TIER[attempt.outcome]}；独立普通操作：{attempt.operationOutcome === null ? '尚未进行' : TIER[attempt.operationOutcome]}。失败原物仍可普通拾取，只有成功应用并完成报告才增加对应掌握。</p>}
      </section>
      {spent && <p>本次已付：{spent.actions}行动、{spent.cash}便士、{spent.spirituality}灵性、{spent.mind}精神、{spent.health}健康；流灯耗{spent.stamina}精力，灯油燃烧{spent.oil}秒。本人实走{spent.walked}米，流灯实走{spent.guestWalked}米，经过{spent.seconds}秒。</p>}
      {selectedCase && selectedCase.attempts.length > 1 && <details className="seer-fold"><summary>此前尝试与已付代价</summary><ul>{selectedCase.attempts.slice(0, -1).map((previous, index) => <li key={`${previous.invitedWeek}-${index}`}>第{previous.invitedWeek}周：{previous.method === 'ABILITY' ? '曾选择能力帮助' : '普通续办'}；{previous.outcome === null ? '没有能力判定' : `能力${TIER[previous.outcome]}`}；{previous.operationOutcome === null ? '没有独立操作判定' : `独立操作${TIER[previous.operationOutcome]}`}。原失败、已耗材料与已付代价保留。</li>)}</ul></details>}
      <details className="seer-fold"><summary>本案范围、普通替代与退路</summary><ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul><p>{copy(life.environment)}</p><p>{life.reflected ? '三案报告与反思已保存。' : '报告与反思只记录已经真实发生并收束的经历。'}</p></details>
    </section>;
  }

  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    const location = (place: 'PLAYER' | 'YARD' | 'RETURN_TRAY') => place === 'PLAYER' ? '本人实际持有' : place === 'YARD' ? '留在实际石院' : '已经实放返还盘';
    return <section aria-label="美神可选真实交战">
      <h3>{copy(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{copy(encounter.story)}</p>
      <p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。</p>
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4>
        <p>当前策略：{POLICIES[encounter.policy]}。{encounter.policyConfirmed ? '本场明确选择已经保存。' : '等待本场明确选择，默认显示不代表已经确认。'}开战后不能更换。是否实际施放仍取决于可用动作、真实资源与对方抵抗。</p>
        <p>可以只用已学能力、只允许辉映调息、只允许月辉定形、允许两项新能力，或只作普通行动。选择策略本身不施法、不购买材料，也不使流灯到场。</p>
      </section>
      <p>本人在{scene.playerLocation === 'YARD' ? '独立石院内' : '石院外原路'}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；累计实走{scene.playerTravelMetres}米，现场经过{scene.clockSeconds}秒。普通出口开放，离场须实际走过4米。</p>
      <p>流灯仍留在原家，达莉娅与旧人物不在战场。旧原珠不在手，不会自动补回原纸、动物、药剂、精力或材料；依赖的实际资源不可用时只能按普通动作应对。</p>
      <section aria-label="独立战场灯与有限月片"><h4>本场真正持有的材料</h4>
        {materials.lamp ? <p>第{materials.lamp.purchasedWeek}周实付{materials.lamp.paidPennies}便士购买的独立战场灯：{location(materials.lamp.location)}，{materials.lamp.lit ? '实际点亮' : '目前熄灭'}；剩余燃料{materials.lamp.fuelSeconds}/{materials.lamp.capacitySeconds}秒，{materials.lamp.blocked ? '灯罩受遮挡' : '灯罩没有遮挡'}。</p> : <p>尚未购买战场灯，没有本场可用光源；生活原灯仍归达莉娅保管。</p>}
        {materials.pieces.length ? <ul>{materials.pieces.map((piece, index) => <li key={piece.id}>第{index + 1}枚战场月片：第{piece.purchasedWeek}周实付{piece.paidPennies}便士，{piece.status === 'READY' ? '尚未耗用' : '已经耗尽'}；{location(piece.location)}。{piece.spentWeek !== null && `第${piece.spentWeek}周实际耗用。`}</li>)}</ul> : <p>没有已购买的战场月片；最多另行实付购买3枚。</p>}
        <p>战场灯、战场月片与生活借用物各有独立实物。失败同样付出代价；用尽月片仍须亲手收回，生还离场先还物，再走四米原路。</p>
      </section>
      <section aria-label="对手原月杆与有限资源"><h4>对手自己的原月杆</h4>
        <p>同一根{materials.weapon.massKg}千克月杆{materials.weapon.location === 'HAND' ? '仍在对手手中' : '已落在原石院地面'}，完整度{materials.weapon.condition}/100；可见冲击储能{materials.weapon.charge}/{materials.weapon.capacity}。资源用尽后仍是同一根杆，离场不会取得或复制它。</p>
        <p>对手已实际使用月光冲击{enemy.powerUses.MOON_BOLT}次、精神压力{enemy.powerUses.MIND_PRESSURE}次、护持{enemy.powerUses.WARD}次、注意抵抗{enemy.powerUses.ATTENTION}次、遮灯{enemy.powerUses.SHADE}次。</p>
      </section>
      <p>辉映调息每轮最多一次，花6灵性、2精神，只给随后一次真正可用的本人动作加值25。月辉定形每轮最多一次，花8灵性、3精神与一枚实际月片，在有效灯光下尝试削弱一次可见身体冲击30；它不能挡住精神压力，也不能保证无伤。</p>
      <details className="seer-fold"><summary>交战消耗、抵抗与有限窗口</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{copy(fact)}</li>)}</ul></details>
    </section>;
  }
}
