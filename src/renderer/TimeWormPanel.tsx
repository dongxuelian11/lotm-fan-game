import { useEffect, useRef, useState } from 'react';
import type { TimeWormAction, TimeWormCommand, TimeWormProjection } from '../domain/time-worm/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'LEAVE', 'WITHDRAW_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP_METHOD', 'CANCEL_LOOK', 'EXIT_ROOM', 'RECOVER_ENERGY']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已中止，待普通续办', ACTIVE: '尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '已结束' };
const ENEMY_STATUS = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const PERMISSION = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回', CLOSED: '本次许可已结束' };
const DECLARATION: Record<string, string> = { PENDING: '已声明，尚未查看', DELAYED: '仍在实际等待', EXECUTED: '已实际查看', CANCELLED: '本次查看已取消' };
const INTERVAL: Record<string, string> = { NONE: '尚未取得', STORED: '已暂存，尚未释放', RELEASED: '已释放，等待本人实际比对', APPLIED: '已经实际应用', SPENT: '已经实际应用', FAILED: '判定失败', EXPIRED: '已经到期', WITHDRAWN: '撤回后已清除', STOPPED: '已经停止', INVALIDATED: '条件改变，已经失效' };
const PLACE = { ENTRY: '原入口', DESK: '登记桌', CABINET: '原柜前', OUTSIDE: '登记室外', YARD: '庭院' };
const POLICIES = { INHERITED_ONLY: '只用已学能力', SHORT_TIME_THEFT: '允许短时窃取', TIME_RELEASE: '先付费短时窃取再尝试释放', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };

export interface TimeWormPanelProps {
  value: TimeWormProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: TimeWormCommand) => void;
  onClose?: (() => void) | null;
}

/** The view never changes resources or manufactures commands: it submits a current public action verbatim. */
export function TimeWormPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: TimeWormPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: TimeWormAction; facts: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submitted = useRef<string | null>(null);
  const submittedFacts = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnActionId = useRef<string | null>(null);
  // Public prose is authored in the projection; names and text remain verbatim.
  const copy = (text: string) => text;
  const facts = JSON.stringify(value);
  const currentFacts = useRef(facts);
  currentFacts.current = facts;
  const locked = busy || blocked || error !== null || pending || value.resources === null || value.resources.health === 0;
  const { life, encounter } = value;
  const selectedBottle = value.bottles.find(bottle => bottle.id === goal)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const activeCase = life.cases.find(entry => entry.id === life.activeCase);
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
  const common = entries.filter(action => action !== next && (COMMON.has(action.command.type) || action.cleanup)).slice(0, 2);
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

  function choose(action: TimeWormAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: TimeWormAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function actionControl(action: TimeWormAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `time-worm-reason-${encodeURIComponent(action.id)}` : undefined} onClick={() => choose(action)}>
        <strong>{copy(action.label)}</strong><span className="slice-modifiers">{copy(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`time-worm-reason-${encodeURIComponent(action.id)}`}>{copy(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="时之虫当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="时之虫当前资源">
      <h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>健康数值恢复不代表既有伤势已经消失。晋升、停止与退出不会免费治疗重伤，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="时之虫成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{copy(value.title)}</h2>
      <section aria-label="时之虫阶段总览"><p>当前阶段：{inEncounter ? '可选真实遭遇' : value.promoted ? life.reflected ? '生活报告与反思已完成' : '原登记室的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p><p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 时之虫扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p></section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : copy(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">
        {value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="时之虫目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked}
          onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{copy(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：登记室外的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{copy(bottle.title)} · {copy(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="时之虫其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{copy(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {originalFacts()}
      {!value.promoted ? <section aria-label="时之虫服药准备">
        <p>{copy(value.digestion)}</p><p>{copy(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{copy(selectedBottle.title)}</h3><p>{copy(selectedBottle.source)}</p><p>{copy(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{copy(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>指导500便士；每瓶6600便士，分别完成本瓶五项劳动后余款1100便士。当周准备另需1行动、150便士；三项专业准备各1行动。现有原瓶全部失败耗尽后，补货申请另需1行动、100便士，至少到下一真实周才能到货。</p>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留命运木马。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{copy(value.risk)}</p><p>{copy(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{copy(value.digestion)}</p><p>{copy(value.appearanceRecord)}</p><p>{copy(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{copy(ability.label)} · 掌握{ability.mastery}</h3><p>{copy(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{copy(value.environment)}关闭页面不会代替结束本次查看与沿原路离开；已经经过的时间、既有伤势与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="时之虫操作确认" onKeyDown={event => {
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
        <p>{copy(value.risk)}</p><p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。本阶不改变性别、姓名、年龄、性格与取向。也可取消并继续停留命运木马。</p></>}
      {live?.command.type === 'SHORT_TIME_THEFT' && <p>本次消耗8灵性、2精神，以感知18判定，并实际经过1秒。只针对已经声明、仍未执行的同一次普通查看；成功后从施放结束起延迟3秒。失败没有暂存时段，维克托仍可普通查看。一次声明只尝试一次，施放成功本身不增加掌握。</p>}
      {live?.command.type === 'TIME_RELEASE' && <p>本次消耗6灵性、2精神，以意志18判定，并实际经过1秒。只能释放本次实际取得、尚未耗用的时段，每次声明只尝试一次。成功后，须另做一次同一原包标签的真实比对，且比对结束严格早于到期，才消耗帮助并获得8判定助益；比对另耗1精力、1秒，以知识16判定。到期的那一刻不再可用；本人使用不解除维克托余下的等待。</p>}
      {live?.command.type === 'PREPARE' && <p>本次准备实际支付1行动、20便士；每次实践重新确认参与者、原包与当前许可。普通方法同样可以完成报告；拒绝、撤回或中途停止不退已付费用。</p>}
      {live?.command.type === 'WITHDRAW_CONSENT' && <p>撤回会阻止新施法并清除尚未使用的暂存时段，已经经过的延迟、已付代价与真实结果保留。撤回原主查看许可会取消本次查看；仅撤回能力许可时，目标仍须等到原到期时间，或另行取消查看。本人、莉娜与维克托仍须实际普通离场。</p>}
      {live?.command.type === 'RECOVER_ENERGY' && <p>只在原登记室外、没有进行中的练习或遭遇时付费休息。本次实际支付1行动、15便士，经过60秒，恢复20精力且最多100；这不治疗旧伤，也不退回已经消耗的时间。</p>}
      {live?.command.type === 'ENCOUNTER_POLICY' && <p>本次明确选择：{POLICIES[live.command.policy]}。只保存本场策略，不会施法、购买材料或开始战斗。</p>}
      {(live?.command.type === 'ENCOUNTER_POLICY' && live.command.policy === 'TIME_RELEASE' || live?.command.type === 'ENCOUNTER_FIGHT' && encounter.policy === 'TIME_RELEASE') && <p>这项策略先付8灵性、2精神尝试短时窃取；只有成功取得实际未用时段后，才再付6灵性、2精神尝试释放。两次都尝试时合计14灵性、4精神；失败也保留已付代价，仍须随后真实普通打击才应用帮助。</p>}
      {live?.command.type === 'ENCOUNTER_FIGHT' && <><p>这是与{encounter.enemy?.name ?? '眼前的对手'}的真实交战。双方独立受伤、投降、撤退与死亡都将保存，普通死亡终结本周目。生活练习不代替交战结果。</p><p>本场策略：{POLICIES[encounter.policy]}。开战后不能更换；能力是否真正可用仍按实际资源与抵抗结算。</p><p>{copy(encounter.story)}</p></>}
      {!confirmedBottle && live?.command.type !== 'ENCOUNTER_FIGHT' && <p>{copy(inEncounter ? encounter.story : value.promoted ? life.environment : value.story ?? value.risk)}</p>}
      {resources()}
      <p>已经支付的行动、金钱、灵性与精神不因停止而返还；已经过去的秒数不会倒退，不增加周行动。撤回阻止新施法，退出不撤销已发生的事实和实际伤害。</p>
      {live?.reason && <p className="seer-action-reason">{copy(live.reason)}</p>}
      <div className="seer-confirm-buttons">
        <button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一原瓶' : live?.command.type === 'ENCOUNTER_FIGHT' ? '确认开始真实交战' : '确认执行这一次操作'}</button>
      </div>
      <p>取消不提交。只有收到已保存的新记录后，才能开始下一次操作。</p>
    </section>}
  </section>;

  function originalFacts() {
    const { site } = life;
    return <details className="seer-fold"><summary>原登记室、原人和旧物当前记录</summary>
      <section aria-label="原登记室当前状态"><h3>同一登记室、唯一原包</h3>
        <p>本人当前在{PLACE[site.playerLocation]}，精力{site.playerEnergy}/100，累计普通步行{site.playerTravelMetres}米，现场时钟{site.clockSeconds}秒。</p>
        <p>{site.lina.name} · {site.lina.age}岁，当前在{PLACE[site.lina.location]}，独立精力{site.lina.energy}/100，累计实走{site.lina.travelMetres}米。</p>
        <p>{site.victor.name} · {site.victor.age}岁，当前在{PLACE[site.victor.location]}，独立精力{site.victor.energy}/100，累计实走{site.victor.travelMetres}米。两人保有独立身体与当前意愿。</p>
        <p>门口0米，登记桌2米，原柜6米，室外在门口外2米。登记桌与室外原包相距4米；普通行走实际计算距离、时间与精力。</p>
        <p>唯一原包数量{site.parcel.quantity}，仍归{site.victor.name}所有，当前在{site.parcel.location === 'OUTSIDE' ? '登记室外原处' : '原柜内'}，累计实际搬运{site.parcel.ordinaryMetres}米。查看与比对不会复制或重新搬运包裹。</p>
        <p>原柜{site.cabinet.open ? '已打开' : '已关闭'}，当前识别{site.cabinet.recognitionHolder === 'OWNER' ? '原主' : '本人'}；原身份联系由{site.link.holder === 'OWNER' ? '原主' : '本人'}持有，{site.link.returnPending ? '仍有待归还记录' : '没有待归还联系'}。</p>
        <p>旧搬运义务{site.fate.status === 'COMPLETED' ? '已经完成' : site.fate.status === 'ASSUMED' ? '已经承担' : '仍待处理'}，原报酬已实付本人{site.fate.paidToPlayer}便士，暂存{site.fate.escrowPennies}便士；原负担已付{site.fate.incurredHealth}健康、{site.fate.incurredEnergy}额外精力。这次查看不会重开旧义务或再次领取报酬。</p>
        <p>旧封签仍归{site.lina.name}所有：{site.seals.length ? site.seals.map((seal, index) => `第${index + 1}枚余量${seal.charges}，${seal.location === 'DESK' ? '在登记桌' : '仍由本人持有'}`).join('；') : '当前没有封签记录'}。旧许可不代替本次同意，原封签也不变成本次新库存。</p>
        <p>当前身体：{value.currentGender === 'FEMALE' ? '女性' : value.currentGender === 'MALE' ? '男性' : '按本人记录'}。姓名、性别、年龄、性格与取向不因本阶改变；过去的伤害、撤退与死亡各自保留。</p>
      </section>
    </details>;
  }

  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    const known = scene.knownEnemyName !== null && enemy.name !== null;
    const remainingMarks = materials.marks.filter(mark => mark.status === 'HELD').length;
    return <section aria-label="时之虫可选真实交战">
      <h3>{encounter.title} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{encounter.story}</p>
      {known ? <p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。他保有独立身体与意愿。</p>
        : <p>尚未实际交谈，当前没有这位对手的姓名、年龄与身体记录。</p>}
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4>
        <p>当前策略：{POLICIES[encounter.policy]}。{encounter.policyConfirmed ? '本场明确选择已经保存。' : '等待本场明确选择，默认显示不代表已经确认。'}开战后不能更换。</p>
        <p>可只用已学能力、只允许短时窃取、选择先窃取再释放、允许两项新能力，或只作普通行动。选择只保存策略，不施法、不购买材料，也不开始战斗。</p>
        {encounter.policy === 'TIME_RELEASE' && <p>释放策略先付8灵性、2精神尝试短时窃取，成功取得未用时段后再付6灵性、2精神尝试释放。两次都尝试时合计14灵性、4精神；失败成本保留，随后仍须实际普通打击。</p>}
      </section>
      {known && <>
        <section aria-label="战场位置与普通出口"><h4>可见动作与普通退路</h4>
          <p>本人在{scene.playerLocation === 'YARD' ? '登记室外庭院内' : '庭院外原路'}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；本人累计实走{scene.playerTravelMetres}米，对手累计实走{scene.enemyTravelMetres}米，现场经过{scene.clockSeconds}秒。普通出口开放，生还离场须实际走过4米。</p>
          <p>当前动作路线{scene.visibleBodyLine ? '可见' : '被遮挡'}，现场条件版本{scene.conditionVersion}；{scene.observedConditionVersion === null ? '尚无本场实际观察' : `最近实际观察版本${scene.observedConditionVersion}`}。</p>
          <p>莉娜与维克托须先真实离开本场，生活许可不涵盖战斗。其他原人的身体、旧物和已有结局独立保留。</p>
        </section>
        <section aria-label="对手原棍与有限印记"><h4>原棍与三枚有限印记</h4>
          <p>同一根2千克原棍{materials.weapon.location === 'HAND' ? '仍在对手手中' : '已落在庭院地面'}。原印记剩余{remainingMarks}/3枚，已耗尽{materials.marks.length - remainingMarks}枚；身体或精神标记每次实际耗7灵性及一枚原印记，耗尽后只能依实际条件行动，不自动补充。</p>
          <p>已实际使用身体标记{enemy.powerUses.BODY_MARK}次、精神标记{enemy.powerUses.MENTAL_MARK}次，改变位置与遮挡{enemy.powerUses.FEINT}次。身体标记会造成身体威胁，身体与精神后果分别结算。</p>
        </section>
      </>}
      <section aria-label="实战的有限能力"><h4>只影响之后的一次真实动作</h4>
        <p>短时窃取：8灵性、2精神，感知18，对手有30%抵抗机会；只针对当前可见、还未执行的下一动作，成功后延迟该动作3秒。只有后续真实身体或精神作用受到30减势，才记录对应应用；不能改写先前伤害。</p>
        <p>暂存时段释放：6灵性、2精神，意志18；先有同一次成功窃取留下的未用时段，才能尝试释放。随后本人的真实普通打击须在原到期前完成，才能消耗一次30优势；完成时间正好等于到期也无效；释放失败也支付费用。</p>
        <p>释放只消费本人暂存时段，目标余下延迟仍保留；没有额外回合或周行动。到期、遮挡或退出会清除未用窗口，施放成功但未真正应用不增加掌握。</p>
        <p>{value.inheritedTools}</p>
      </section>
      <details className="seer-fold"><summary>交战消耗、抵抗与实际时间记录</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul></details>
    </section>;
  }

  function lifeFacts() {
    const { site } = life;
    const attempt = selectedCase?.id === life.activeCase ? life.currentAttempt : selectedCase?.attempts.at(-1);
    const current = selectedCase?.id === life.activeCase && selectedCase?.contactOpen && !!attempt && !attempt.closed;
    const permissionText = (permission: keyof typeof PERMISSION) => permission === 'GRANTED' && !current ? '本案曾明确同意，当前无生效许可' : PERMISSION[permission];
    const declaration = current ? life.declaration : attempt?.declaration;
    const reserve = current && life.pending?.caseId === selectedCase?.id && life.pending.declarationId === declaration?.id ? life.pending : null;
    // Local wall time never advances the scene. Only committed public facts do.
    const usable = !!reserve && life.pendingUsable && life.pendingRemainingSeconds > 0 && life.clockSeconds < reserve.expiresAt;
    const useText = (use: NonNullable<typeof attempt>['theft']) => use.state === 'ACTIVE'
      ? current ? '施放已成功，尚待实际应用' : '施放曾成功，本次已结束且未应用' : INTERVAL[use.state] ?? '当前记录';
    return <section aria-label="时之虫生活练习">
      <h3>{selectedCase?.title ?? life.title}</h3><p>{selectedCase?.story ?? life.story}</p>
      {selectedCase?.result && <p className="slice-notice">{selectedCase.result}</p>}
      <section aria-label="当前时钟与待执行查看"><h4>这一次查看与实际时间</h4>
        <p>现场时钟{life.clockSeconds}秒；本阶段实际经过{life.elapsedSeconds}秒。页面停留不会自行推进现场，等待须提交实际等待动作。</p>
        {declaration ? <>
          <p>{site.victor.name}对同一原包标签的本次查看：{declaration.state === 'DELAYED' && current && life.targetRemainingSeconds === 0 ? '延迟已到点，尚待普通执行' : DECLARATION[declaration.state]}。</p>
          <p>声明于{declaration.declaredAt}秒，原定{declaration.baselineDueAt}秒。{declaration.delayStartedAt === null ? '尚未发生能力延迟。' : `本次延迟从${declaration.delayStartedAt}秒开始，原定到${declaration.dueAt}秒；已实际延迟${declaration.delayedSeconds}秒。`}</p>
          {current && declaration.state === 'DELAYED' && <p>目标还须等待{life.targetRemainingSeconds}秒；到点后仍须另一次实际普通查看，不会自动完成。</p>}
          {declaration.executedAt !== null && <p>已于{declaration.executedAt}秒实际完成查看，不能再窃取这次已经发生的动作。</p>}
          {declaration.cancelledAt !== null && <p>已于{declaration.cancelledAt}秒取消这次查看，已流逝的{declaration.delayedSeconds}秒与原费用保留。</p>}
        </> : <p>当前没有已声明的待执行查看。普通基线与新声明分别记录，已经执行的动作不能再作为窃取目标。</p>}
        {attempt && <p>普通基线：{attempt.baselineAt === null ? '尚未实际查看' : `已于${attempt.baselineAt}秒实际完成`}。</p>}
      </section>
      <section aria-label="本案的独立许可"><h4>本次许可</h4>
        <ul><li>{site.victor.name}的本次查看许可：{permissionText(attempt?.permission.owner ?? 'UNASKED')}。</li>
          <li>{site.lina.name}的本次见证许可：{permissionText(attempt?.permission.observer ?? 'UNASKED')}。</li>
          <li>本人使用能力：{permissionText(attempt?.permission.ability ?? 'UNASKED')}。</li></ul>
        <p>每次准备1行动、20便士，每次重新取得同意。拒绝或撤回不退款；本人不能代替两位成人同意。原主撤回会取消本次查看，撤回能力许可则清除本人未用时段，目标已经成立的延迟仍保留。</p>
      </section>
      <section aria-label="暂存时段与实际应用"><h4>暂存、释放与实际应用</h4>
        {reserve ? <><p>本人暂存时段：{INTERVAL[reserve.state]}；还剩{life.pendingRemainingSeconds}秒，到{reserve.expiresAt}秒到期。</p>
          <p>{usable ? reserve.state === 'STORED' ? '当前可尝试释放这同一份时段；尚未发生本人比对应用。' : '当前可用在下一次真实标签比对，帮助只消费一次。' : '当前没有可应用的暂存时段；原余量不能保证一次新操作赶在到期前结束。'}</p></>
          : <p>当前没有尚未用掉的暂存时段。已经释放、耗用、失败、到期与停止均按下方实际记录保留。</p>}
        <p>短时窃取：8灵性、2精神，感知18；施放实际1秒，只延迟同一待执行查看3秒，每次声明仅尝试一次。失败也付费，目标仍可普通查看。</p>
        <p>暂存时段释放：6灵性、2精神，意志18；施放实际1秒。只释放本人真实未用的时段，每次声明仅尝试一次。</p>
        <p>标签比对另耗1精力、1秒，知识16。只有比对结束时严格早于到期，才能消费8点帮助；到期的那一刻已无帮助。真实比对判定成功或失败都记录该次实际应用；释放成功本身不算应用。</p>
        <p>本人消费时段不解除维克托余下的3秒延迟。目标实际等待后执行才记录短时窃取应用；取消查看不冒充应用。停止或撤回清除未用余量，不能返还已流逝时间、增加周行动、倒转伤势或重写旧结果。</p>
        {attempt && <>
          <p>短时窃取：{attempt.theft.tier === null ? '尚未判定' : TIER[attempt.theft.tier]}，{useText(attempt.theft)}，实际应用{attempt.theft.effects}次；暂存时段释放：{attempt.release.tier === null ? '尚未判定' : TIER[attempt.release.tier]}，{useText(attempt.release)}，实际应用{attempt.release.effects}次。</p>
          <p>本人实际比对：{attempt.comparisonAttempted ? `${attempt.comparisonTier === null ? '已记录' : TIER[attempt.comparisonTier]}，实际帮助${attempt.comparisonBonus}点，于${attempt.comparisonAt}秒完成` : '尚未发生'}。</p>
          <p>本次已付{attempt.penniesSpent}便士、{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神；实际经过{attempt.elapsedSeconds}秒。{attempt.stopped ? '本次方法已经停止。' : '本次尚未明确停止方法。'}</p>
        </>}
        <p>三案分别记录，单案每项能力最多8掌握；只有实际应用并提交报告才增加掌握，普通完成同样可以报告。</p>
      </section>
      <section aria-label="实际位置与普通退出"><h4>普通行走与离场</h4>
        <p>本人在{PLACE[site.playerLocation]}，精力{site.playerEnergy}/100；莉娜在{PLACE[site.lina.location]}，精力{site.lina.energy}/100；维克托在{PLACE[site.victor.location]}，精力{site.victor.energy}/100。</p>
        <p>本阶段本人实走{life.playerTravelMetres}米，莉娜实走{life.linaTravelMetres}米，维克托实走{life.victorTravelMetres}米。登记桌到室外4米，每个人的普通行走实际耗时、耗精力；换案不补充。</p>
        {attempt && <p>本次本人已耗{attempt.playerEnergySpent}精力，莉娜已耗{attempt.linaEnergySpent}精力，维克托已耗{attempt.victorEnergySpent}精力。{attempt.exited ? '本次参与者已经实际离场。' : '须先完成或取消待办，再沿普通道路实际离场。'}</p>}
        <p>唯一原包仍在{site.parcel.location === 'OUTSIDE' ? '室外原处' : '原柜内'}；原搬运及报酬保持原记录。到期、撤回和关闭页面都不会移动身体或原物。</p>
      </section>
      {selectedCase && selectedCase.attempts.length > 1 && <details className="seer-fold"><summary>此前尝试与已付代价</summary>
        {selectedCase.attempts.slice(0, -1).map((previous, index) => <p key={`${previous.week}-${index}`}>第{previous.week}周：{previous.method === 'ABILITY' ? '能力方法' : '普通方法'}；已付{previous.penniesSpent}便士、{previous.spiritualitySpent}灵性、{previous.mindSpent}精神，实际经过{previous.elapsedSeconds}秒。短时窃取应用{previous.theft.effects}次，暂存时段释放应用{previous.release.effects}次；原失败、等待与已付代价保留。</p>)}
      </details>}
      <details className="seer-fold"><summary>本案范围、普通替代与退路</summary><ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>{life.environment}</p><p>{life.reflected ? '三案报告与反思已保存。' : '三份报告各25扮演、反思25；普通完成同样有效，须先实际收束现场。'}</p>
      </details>
    </section>;
  }
}
