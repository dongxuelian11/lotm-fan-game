import { useEffect, useRef, useState } from 'react';
import { playerText } from '../shared/player-text.js';
import type { MisfortuneKnightAction, MisfortuneKnightCommand, MisfortuneKnightProjection } from '../domain/misfortune-knight/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER', 'BUY_BATTLE_PLATE']);
const COMMON = new Set(['ABORT', 'RETURN_HOME', 'REVOKE_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP_RELEASE', 'CLEAR_DOOR', 'RETURN_BOX', 'RETURN_PLATE', 'RETURN_TOOLS', 'MANUAL_STOP']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已安全中止，待普通续办', ACTIVE: '尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '已结束' };
const ENEMY_STATUS = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const PERMISSION = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回' };
const POLICIES = { INHERITED_ONLY: '只用已学能力', GUIDED_MISHAP: '允许厄势导引', BOUNDED_NIGHT_GUARD: '允许隐夜护持', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };

export interface MisfortuneKnightPanelProps {
  value: MisfortuneKnightProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: MisfortuneKnightCommand) => void;
  onClose?: () => void;
}

/** The view never changes resources or manufactures commands: it submits a current public action verbatim. */
export function MisfortuneKnightPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: MisfortuneKnightPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: MisfortuneKnightAction; facts: string } | null>(null);
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

  function choose(action: MisfortuneKnightAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: MisfortuneKnightAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function actionControl(action: MisfortuneKnightAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `misfortune-knight-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{copy(action.label)}</strong><span className="slice-modifiers">{copy(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`misfortune-knight-reason-${action.id}`}>{copy(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="厄难骑士当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="厄难骑士当前资源">
      <h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>晋升、停止与归还原物不会免费恢复身体，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="厄难骑士成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{copy(value.title)}</h2>
      <section aria-label="厄难骑士阶段总览"><p>当前阶段：{inEncounter ? '可选真实遭遇' : value.promoted ? life.reflected ? '生活报告与反思已完成' : '原房间的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p><p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 厄难骑士扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p></section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : copy(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">
        {value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="厄难骑士目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked}
          onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{copy(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：院外的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{copy(bottle.title)} · {copy(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="厄难骑士其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{copy(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {originalFacts()}
      {!value.promoted ? <section aria-label="厄难骑士服药准备">
        <p>{copy(value.digestion)}</p><p>{copy(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{copy(selectedBottle.title)}</h3><p>{copy(selectedBottle.source)}</p><p>{copy(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{copy(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留隐秘之仆。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{copy(value.risk)}</p><p>{copy(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{copy(value.digestion)}</p><p>{copy(value.appearanceRecord)}</p><p>{copy(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{copy(ability.label)} · 掌握{ability.mastery}</h3><p>{copy(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{copy(value.environment)}关闭页面不会代替停止作用、归还原物与沿原路离开；已经发生的事件与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="厄难骑士操作确认" onKeyDown={event => {
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
        <p>{copy(value.risk)}</p><p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。也可取消并继续停留隐秘之仆。</p></>}
      {live?.command.type === 'GUIDED_MISHAP' && <p>本次消耗6灵性、2精神，意志18；只为30秒内一次尚未发生的原盒接取提供帮助。仍须亲手接取并独立判定，失败不改写已经发生的动作。</p>}
      {live?.command.type === 'BOUNDED_NIGHT_GUARD' && <p>本次消耗8灵性、3精神，知识18，木板实际磨损10，失败也保留磨损。只有随后真实释放的校准轻触才能应用；未释放、过期或撤回不增加掌握。</p>}
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
    const o = life.originals;
    const place: Record<string, string> = { EXIT: '原门外出口', ROOM: '同一原房间内', START: '原保管起点', PLAYER: '本人手中', TABLE: '原桌上' };
    return <details className="seer-fold"><summary>原房间、艾琳与旧物当前记录</summary>
      <section aria-label="原房间当前状态"><h3>同一房间与原物</h3>
        <p>艾琳 · {o.erin.age}岁，{o.erin.alive ? '存活' : '已经死亡'}；健康{o.erin.health}/100、精神{o.erin.mind}/100，当前在{place[o.erin.location] ?? '已记录位置'}。</p>
        <p>原房间长{o.room.lengthMetres}米；{o.room.concealed ? `仍有有限隐秘，剩余${o.room.remainingSeconds}秒` : '正常可见'}。原门{ o.room.doorBlocked ? '受阻，须先停用能力再普通疏通' : '开放，普通路线畅通'}。</p>
        <p>艾琳的同一原封签盒在{place[o.box.location] ?? '已记录位置'}，累计实际搬动{o.box.travelMetres}米。原纸页仍在原房间，原有文字与物权记录保留。</p>
        <p>原弱标记{o.trace.exists ? '仍存在' : '当前不存在'}，无生命、无独立意识；实际检索{o.trace.searches}次，其中延迟{o.trace.delayedSearches}次、共{o.trace.totalDelaySeconds}秒。固定锚灯{o.anchorLight.on ? '开启' : '关闭'}。</p>
        <p>当前身体：{value.currentGender === 'FEMALE' ? '女性' : value.currentGender === 'MALE' ? '男性' : '按本人记录'}。本阶不改变性别、姓名、年龄、性格与取向；过去的死亡与已发生的伤害不会撤销。</p>
      </section>
    </details>;
  }
  function lifeFacts() {
    const p = life.practice, o = life.originals, attempt = selectedCase?.attempts.at(-1), permission = selectedCase?.permission;
    const current = p.activeCase === selectedCase?.id && selectedCase?.contactOpen;
    const permissionText = (state: keyof typeof PERMISSION, id: 'CS2-ERIN' | 'MK1-MILO44' | 'PLAYER') => state === 'GRANTED' && (!current || !life.currentConsents.some(entry => entry.id === id && entry.consented)) ? '本案曾明确同意，当前无生效许可' : PERMISSION[state];
    const holder = { START: '原保管起点', PLAYER: '本人手中', BOARD: '原斜板上', TRAY: '米洛的原托盘内', PAD: '原桌上的软垫上', TABLE: '原桌上' };
    const weight = { OWNER: '米洛保管', REST: '已放妥，尚未架起', ARMED: '已架起，尚未释放', RELEASED: '已经释放，须普通制停', STOPPED: '已实际停止' };
    const guidedSeconds = p.pendingGuided ? Math.max(0, p.pendingGuided.expiresAt - p.elapsedSeconds) : 0;
    const guardSeconds = p.pendingGuard ? Math.max(0, p.pendingGuard.expiresAt - p.elapsedSeconds) : 0;
    const canUseWindow = current && p.playerLocation === 'ROOM' && p.playerOffsetMetres <= 4 && !o.room.doorBlocked && life.currentConsents.length === 3 && life.currentConsents.every(entry => entry.consented);
    const guidedOpen = canUseWindow && p.pendingGuided?.caseId === selectedCase?.id && guidedSeconds >= 2 && p.rig.parcelPending && p.rig.tilted && p.boxHolder === 'BOARD' && p.tray.location === 'ROOM';
    const guardOpen = canUseWindow && p.pendingGuard?.caseId === selectedCase?.id && guardSeconds >= 1 && p.plate.holder === 'PLAYER' && p.rig.weightState === 'ARMED';
    const spent = attempt?.receipts.reduce((total, receipt) => ({
      spirituality: total.spirituality + Math.max(0, receipt.before.spirituality - receipt.after.spirituality),
      mind: total.mind + Math.max(0, receipt.before.mind - receipt.after.mind),
      health: total.health + Math.max(0, receipt.before.health - receipt.after.health),
      cash: total.cash + Math.max(0, receipt.before.cash - receipt.after.cash),
      actions: total.actions + Math.max(0, receipt.before.actions - receipt.after.actions),
      wear: total.wear + receipt.plateWear, walked: total.walked + receipt.playerWalkedMetres,
      boxMoved: total.boxMoved + receipt.boxMovedMetres, seconds: total.seconds + receipt.elapsedSeconds,
      releasedForce: total.releasedForce + receipt.releasedForce, absorbedForce: total.absorbedForce + receipt.absorbedForce,
    }), { spirituality: 0, mind: 0, health: 0, cash: 0, actions: 0, wear: 0, walked: 0, boxMoved: 0, seconds: 0, releasedForce: 0, absorbedForce: 0 });
    return <section aria-label="厄难骑士生活练习">
      <h3>{copy(selectedCase?.title ?? life.title)}</h3><p>{copy(selectedCase?.story ?? life.source)}</p>
      {selectedCase?.preparation && <p>{copy(selectedCase.preparation)}</p>}
      {selectedCase?.result && <p className="slice-notice">{copy(selectedCase.result)}</p>}
      <section aria-label="本案的独立许可"><h4>分别确认本次许可</h4>
        <p>艾琳 · {o.erin.age}岁；米洛 · {p.technician.age}岁。两人在6米出口外的安全处，原盒归艾琳，工具归米洛。</p>
        {permission && <ul><li>艾琳的原盒与场地：{permissionText(permission.owner, 'CS2-ERIN')}。</li><li>米洛的本次工具用途：{permissionText(permission.technician, 'MK1-MILO44')}。</li><li>本人使用自身能力：{permissionText(permission.selfPower, 'PLAYER')}。</li></ul>}
        <p>本人愿意施术不能代替物主或技师同意。每案重新询问；撤回会停止未来作用，原费用、磨损和已经发生的动作保留。</p>
      </section>
      <section aria-label="实际位置与归还"><h4>原盒、路程与普通退路</h4>
        <p>本人在{p.playerLocation === 'YARD' ? '院子里' : p.playerOffsetMetres === 6 ? '原房间入口' : '原房间内'}，室内位置距起点{p.playerOffsetMetres}米；累计实走{p.playerTravelMetres}米，现场经过{p.elapsedSeconds}秒。</p>
        <p>同一原盒在{holder[p.boxHolder]}，距原起点{p.boxOffsetMetres}米。原门{o.room.doorBlocked ? '实际受阻，先停载再普通清门' : '开放'}；{selectedCase?.returned ? '本案实际还物与归程已完成' : '原物工具与普通归程仍须核对'}。</p>
        <p>院子到房间入口单程40米。屋内按0、2、4、6米实际行走；普通拾取、搬运、归还和沿原路退出都按真实动作结算。</p>
      </section>
      <section aria-label="原托盘木板与待发动作"><h4>当前工具和待发生的动作</h4>
        <p>米洛的同一托盘{p.tray.location === 'ROOM' ? `在原房间${p.tray.offsetMetres}米处` : '仍由米洛保管'}。斜板{p.rig.tilted ? '已经倾斜' : '尚未倾斜或已放平'}；{p.rig.parcelPending ? '原盒滑动尚未发生，等待真实接取' : '当前没有待接取的原盒滑动'}。</p>
        <p>同一木板{p.plate.holder === 'PLAYER' ? '由本人实际手持' : '由米洛保管'}，完整度{p.plate.integrity}/65；已磨损{p.plate.wear}，实际承接轻触{p.plate.impacts}次。</p>
        <p>校准轻锤：{weight[p.rig.weightState]}；已实际释放{p.rig.releases}次，当前剩余作用{p.rig.remainingForce}刻度，累计吸收{p.rig.absorbedForce}刻度。工具{p.rig.borrowed ? '尚未全部归还' : '由米洛保管'}。</p>
        <p>练习只让本人手持的木板承接校准轻触，艾琳和米洛不进入受击线。施术失败留下真实磨损；停载、普通制停与归还不会修复木板。</p>
      </section>
      <section aria-label="两项能力的有限窗口"><h4>先准备，再实际应用</h4>
        <p>厄势导引消耗6灵性、2精神，意志18。30秒内只给4米内一次尚未发生的原盒普通接取加10；接取仍须独立判定，失败后原盒留在软垫，须亲手拾取。</p>
        {guidedOpen ? <p>厄势导引还剩{guidedSeconds}秒，等待一次真实接取。</p> : <p>当前没有可应用的厄势导引窗口。</p>}
        <p>隐夜护持消耗8灵性、3精神，知识18，并让同一木板磨损10。须先架起尚未释放的轻锤；30秒内只吸收随后一次对手持木板的10刻度轻触。</p>
        {guardOpen ? <p>隐夜护持还剩{guardSeconds}秒，等待一次真实轻触。</p> : <p>当前没有可应用的隐夜护持窗口；仍可普通停载、还物并离开。</p>}
        <p>施放本身不完成接取或释放，也不增加掌握。过期、走到出口、原门受阻或许可撤回会取消未用作用；不能改写过去，也不保证接取成功。</p>
        {attempt && <p>本次能力判定：{attempt.outcome === null ? '尚未进行' : TIER[attempt.outcome]}；独立普通接取：{attempt.operationOutcome === null ? '尚未进行' : TIER[attempt.operationOutcome]}。</p>}
      </section>
      {spent && <p>本次已付：{spent.actions}行动、{spent.cash}便士、{spent.spirituality}灵性、{spent.mind}精神、{spent.health}健康；木板磨损{spent.wear}。本人实走{spent.walked}米、原盒实移{spent.boxMoved}米，经过{spent.seconds}秒；释放{spent.releasedForce}刻度、实际吸收{spent.absorbedForce}刻度。</p>}
      {selectedCase && selectedCase.attempts.length > 1 && <details className="seer-fold"><summary>此前尝试与已付代价</summary><ul>{selectedCase.attempts.slice(0, -1).map((previous, index) => <li key={`${previous.invitedWeek}-${index}`}>第{previous.invitedWeek}周：{previous.method === 'ABILITY' ? '曾选择能力帮助' : '普通续办'}；{previous.outcome === null ? '没有能力判定' : `能力${TIER[previous.outcome]}`}；{previous.operationOutcome === null ? '没有普通接取判定' : `普通接取${TIER[previous.operationOutcome]}`}。原失败、木板磨损与已付代价保留。</li>)}</ul></details>}
      <details className="seer-fold"><summary>本案范围、普通替代与退路</summary><ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul><p>{copy(life.environment)}</p><p>{life.reflected ? '三案报告与反思已保存。' : '报告与反思只记录已实际发生并收束的经历；普通完成同样可以报告。'}</p></details>
    </section>;
  }
  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    const plate = materials.plate;
    const location = (place: 'PLAYER' | 'YARD' | 'RETURN_TRAY') => place === 'PLAYER' ? '本人实际持有' : place === 'YARD' ? '留在石院地面' : '已经实放返还盘';
    return <section aria-label="厄难骑士可选真实交战">
      <h3>{copy(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{copy(encounter.story)}</p>
      <p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。</p>
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4>
        <p>当前策略：{POLICIES[encounter.policy]}。{encounter.policyConfirmed ? '本场明确选择已经保存。' : '等待本场明确选择，默认显示不代表已经确认。'}开战后不能更换。</p>
        <p>可只用已学能力、只允许厄势导引、只允许隐夜护持、允许两项新能力，或只作普通行动。选择只保存策略，不施法、不购买原物，也不开始战斗。</p>
      </section>
      <section aria-label="战场位置与普通出口"><h4>可见动作与普通退路</h4>
        <p>本人在{scene.playerLocation === 'YARD' ? '独立石院内' : '石院外原路'}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；累计实走{scene.playerTravelMetres}米，现场经过{scene.clockSeconds}秒。普通出口开放，生还离场须实际走过4米。</p>
        <p>身体冲击路线{scene.visibleBodyLine ? '当前可见' : '当前不可见'}；落点空地{scene.floorLineClear ? '当前畅通' : '当前受阻'}。路线可见不等于已经出现待发攻击，能力仍须等待真实身体冲击窗口。</p>
        <p>艾琳和米洛在本场之外。旧卷叶只能依照原封存、派出与召回记录提供已有的有限协助；缺少实际资源时按普通行动应对。</p>
      </section>
      <section aria-label="本场独立木板"><h4>实际持有的护持木板</h4>
        {plate ? <p>第{plate.purchasedWeek}周实付{plate.paidPennies}便士取得的同一战场木板：{location(plate.location)}，完整度{plate.integrity}/{plate.initialIntegrity}；每次护持尝试磨损{plate.wearPerAttempt}，失败同样保留磨损，换轮不免费修复。</p>
          : <p>尚未购买战场木板；生活借用的米洛原木板不会自动出现在战场。</p>}
        <p>本场木板与生活借用物各自保留实际来源和去向。生还结束后亲手放回返还盘，再沿普通原路离场。</p>
      </section>
      <section aria-label="对手原杆与有限资源"><h4>奥尔登自己的原杆</h4>
        <p>同一根{materials.weapon.massKg}千克原杆{materials.weapon.location === 'HAND' ? '仍在对手手中' : '已落在石院地面'}，完整度{materials.weapon.condition}/100；可见冲击储能{materials.weapon.charge}/{materials.weapon.capacity}。用尽后仍是同一根杆，不会自动补充或转到本人库存。</p>
        <p>对手已实际使用暗色冲击{enemy.powerUses.DARK_BOLT}次、精神压力{enemy.powerUses.MIND_PRESSURE}次、护持{enemy.powerUses.WARD}次、集中抵抗{enemy.powerUses.ATTENTION}次、阻挡落点{enemy.powerUses.BLOCK_LINE}次。</p>
      </section>
      <section aria-label="实战的有限能力"><h4>只影响尚未发生的身体冲击</h4>
        <p>厄势导引每轮最多一次：6灵性、2精神、意志18。须观察到同一次可见待发身体攻击，且有实际畅通落点；抵抗结算后只削弱这次未来冲击25。</p>
        <p>隐夜护持每轮最多一次：8灵性、3精神、知识18，并让实际木板磨损10。30秒内只削弱一次待发身体冲击30，不能挡住精神压力。失败、空窗口、失效或未实际应用都不增加掌握。</p>
      </section>
      <details className="seer-fold"><summary>交战消耗、抵抗与有限窗口</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{copy(fact)}</li>)}</ul></details>
    </section>;
  }
}
