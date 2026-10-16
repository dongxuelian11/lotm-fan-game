import { useEffect, useRef, useState } from 'react';
import type { ApocalypseDemonessAction, ApocalypseDemonessCommand, ApocalypseDemonessProjection } from '../domain/apocalypse-demoness/types.js';
import { playerText } from '../shared/player-text.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'LEAVE', 'WITHDRAW_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP_METHOD', 'STOP', 'RETURN_ACTOR', 'RETURN_PLATE', 'REMOVE_PLATE', 'EXIT_ROOM', 'ORDINARY_SEAL', 'RECOVER_ENERGY']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已停止，待普通收尾', ACTIVE: '现场尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '本人已死亡' };
const PLACE: Record<string, string> = { ENTRY: '附室门口', A: '原镜A旁', B: '原镜B旁', BOX: '原封存箱旁', OUTSIDE: '室外', YARD: '邻近修护院', PLAYER: '本人处', SUPPLIER: '供应方处', SUPPLY: '供应方处', CUSTODIAN: '保管者处', SOURCE_START: '旧馆门口', SOURCE_B: '旧馆原镜B旁' };
const PERMISSION: Record<string, string> = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回', CLOSED: '本次许可已结束' };
const WINDOW: Record<string, string> = { NONE: '尚未尝试', ACTIVE: '判定成功，尚待实际应用', APPLIED: '已实际应用', SPENT: '已耗用', FAILED: '判定失败', EXPIRED: '已经到期', WITHDRAWN: '撤回后已清除', STOPPED: '已经停止', INVALIDATED: '条件改变，已经失效' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const POLICIES: Record<string, string> = { INHERITED_ONLY: '只用已学能力', PULSE_CONTAINMENT: '允许脉冲收束', MIRROR_BUFFER: '允许镜面缓冲', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface ApocalypseDemonessPanelProps {
  value: ApocalypseDemonessProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: ApocalypseDemonessCommand) => void;
  /** Navigation alone never settles a pending pulse, returns objects or moves bodies. */
  onClose?: (() => void) | null;
}

export function ApocalypseDemonessPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: ApocalypseDemonessPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: ApocalypseDemonessAction; facts: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>()), returnActionId = useRef<string | null>(null);
  const facts = JSON.stringify(value), currentFacts = useRef(facts);
  currentFacts.current = facts;
  const locked = busy || blocked || error !== null || pending || value.resources === null || value.resources.health === 0;
  const { life, encounter } = value;
  // The domain projection is the sole current authority. Never fall back to the
  // frozen Calamity life snapshot, or create local bodies/items from old records.
  const site = life.site;
  const text = (prose: string) => value.characterName ? prose.split(value.characterName).map(playerText).join(value.characterName) : playerText(prose);
  const selectedBottle = value.bottles.find(bottle => bottle.id === goal)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const activeCase = life.cases.find(entry => entry.id === life.activeCase);
  const selectedCase = activeCase ?? life.cases.find(entry => entry.id === goal)
    ?? life.cases.find(entry => entry.status !== 'RESOLVED') ?? life.cases[0];
  const inEncounter = encounter.inside || (!activeCase && value.promoted && (goal === 'encounter' || goal === null && life.reflected));
  const inside = value.insideCase || life.insideCase || encounter.inside;
  const selectionLocked = locked || confirmation !== null || inside;
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
      submitted.current = null; submittedFacts.current = null; setPending(false);
      returnActionId.current = null; setConfirmation(null); heading.current?.focus();
    } else if (error !== null || confirmation && confirmation.facts !== facts) {
      returnActionId.current = null; setConfirmation(null); heading.current?.focus();
    }
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus();
    else if (returnActionId.current) (actionButtons.current.get(returnActionId.current) ?? heading.current)?.focus();
    else heading.current?.focus();
  }, [confirmation]);

  function choose(action: ApocalypseDemonessAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id; setConfirmation({ action, facts });
  }
  function submit(action: ApocalypseDemonessAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id; submittedFacts.current = facts; setPending(true); onCommand(action.command);
  }
  function actionControl(action: ApocalypseDemonessAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" data-action-id={action.id} disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `apocalypse-demoness-reason-${encodeURIComponent(action.id)}` : undefined} onClick={() => choose(action)}>
        <strong>{text(action.label)}</strong><span className="slice-modifiers">{text(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`apocalypse-demoness-reason-${encodeURIComponent(action.id)}`}>{text(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="末日魔女当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="末日魔女当前资源"><h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>健康恢复不代表旧伤已经消失。晋升与离场不会治疗伤势，也不会补满灵性、现场精力或耗材。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="末日魔女成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{text(value.title)}</h2>
      <section aria-label="末日魔女阶段总览">
        <p>当前阶段：{inEncounter ? `可选真实遭遇 · ${STATUS[encounter.status] ?? '当前记录'}` : value.promoted ? life.reflected ? '三份生活报告与反思已完成' : '原附室的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p>
        <p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 末日魔女扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p>
      </section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : text(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {blocked && <p role="status">请先处理当前阻塞事项，本页暂不能提交新操作。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">{value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="末日魔女目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked} onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{text(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：邻近修护院的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{text(bottle.title)} · {text(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="末日魔女其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{text(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {originalFacts()}
      {!value.promoted ? <section aria-label="末日魔女服药准备">
        <p>{text(value.digestion)}</p><p>{text(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{text(selectedBottle.title)}</h3><p>{text(selectedBottle.source)}</p><p>{text(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{text(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>指导500便士；每瓶6600便士，或为本瓶完成五项真实劳动后支付1100便士。三项专业准备各1行动，当周准备另需1行动、150便士。全部原瓶失败耗尽后，补货申请另需1行动、100便士，至少到下一真实周才能到货。</p>
        <p>须从实际灾难魔女晋升周起满12整周，消化100，完成旧三份报告、反思及本次专业准备。服药需健康高于20、精神高于40，并进行意志30检定；饮用本身不耗行动。供应方交付独立成品原瓶，未掌握完整配方，不能自行调配。</p>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留灾难魔女。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{text(value.risk)}</p><p>{text(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{text(value.digestion)}</p><p>{text(value.appearanceRecord)}</p><p>{text(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{text(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{text(ability.label)} · 掌握{ability.mastery}</h3><p>{text(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{text(value.environment)}关闭页面不会代替停手、封箱、归还护片与普通步行离场；实际时间、伤势与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="末日魔女操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{live ? text(live.label) : '现场已变化'}</h3><p>{live && text(live.cost)}</p>
      {confirmedBottle && <><p>{text(confirmedBottle.title)} · {text(confirmedBottle.status)}</p><p>{text(confirmedBottle.source)}</p><p>当前成功率{confirmedBottle.chance}%</p><p>{text(value.risk)}</p>
        <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。本阶不改变性别、姓名、年龄、性格与取向。原有十八项能力及其实际掌握保留，两项新能力从0开始；原镜、旧残留、旧负载、护片与参与者不会补充。也可取消并继续停留灾难魔女。</p></>}
      {live && ['PULSE_CONTAINMENT', 'MIRROR_BUFFER'].includes(live.command.type) && <p>{text(value.abilities.find(ability => ability.id === (live.command.type === 'PULSE_CONTAINMENT' ? 'assassin.s1.pulse-containment' : 'assassin.s1.mirror-buffer'))?.description ?? '')}</p>}
      {live && 'permission' in live.command && <p>本次针对：{live.command.permission === 'OWNER' ? `${site?.vera?.name ?? '原物主'}对原镜用途的许可` : live.command.permission === 'OPERATOR' ? `${site?.marcus?.name ?? '原保管者'}对原箱用途的许可` : live.command.permission === 'PARTICIPANT' ? '两位成人参与本案的许可' : '两位成人对本次有限能力用途的许可'}。{live.command.type === 'WITHDRAW_CONSENT' || live.command.type === 'DECLINE_CONSENT' ? '拒绝或撤回立即停止新施法与未用窗口；待发脉冲仍须普通处置，已发生代价保留。' : '只记录本次明确同意，之后仍可以撤回。'}</p>}
      {live?.command.type === 'ENCOUNTER_POLICY' && <p>本次明确选择：{POLICIES[live.command.policy]}。只保存本场策略，不施法、不购买材料、不开始战斗。</p>}
      {live?.command.type === 'ENCOUNTER_FIGHT' && <><p>这是与{encounter.enemy.name ?? '眼前的对手'}的真实交战。双方独立受伤、投降、撤退与死亡都将保存，普通死亡终结本周目。</p><p>本场策略：{POLICIES[encounter.policy]}。开战后不能更换；身体与精神作用分别结算，生还离场须实际步行4米。</p><p>{text(encounter.story)}</p></>}
      {live && operationFacts(live.command)}
      {!confirmedBottle && live?.command.type !== 'ENCOUNTER_FIGHT' && <p>{text(inEncounter ? encounter.story : value.promoted ? life.environment : value.story ?? value.risk)}</p>}
      {resources()}
      <p>已经支付的行动、金钱、灵性与精神不因失败、停止或撤回而返还；秒数不会倒退，既有伤害与真实磨损不会撤销。撤回不会替人离场，每个人仍须普通行走。</p>
      {live?.reason && <p className="seer-action-reason">{text(live.reason)}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一原瓶' : live?.command.type === 'ENCOUNTER_FIGHT' ? '确认开始真实交战' : '确认执行这一次操作'}</button></div>
      <p>取消不提交。只有收到已保存的新记录后，才能开始下一次操作。</p>
    </section>}
  </section>;

  function originalFacts() {
    return <section aria-label="末日魔女原人原物当前状态"><h3>同一身体、原镜与原箱</h3>
      {!site ? <p>尚无可核对的当前现场记录，不以旧快照推定人或物的位置。</p> : <>
        <p>本人当前在{PLACE[site.playerLocation]}，精力{site.playerEnergy}/100，累计普通步行{site.playerTravelMetres}米，现场时钟{site.clockSeconds}秒。</p>
        {[site.vera, site.marcus].map(adult => adult && <p key={adult.id}>{adult.name} · {adult.age}岁，当前在{PLACE[adult.location]}，独立精力{adult.energy}/100，累计实走{adult.travelMetres}米。镜面许可{PERMISSION[adult.mirrorConsent]}；箱体许可{PERMISSION[adult.boxConsent]}。</p>)}
        <p>同一原镜A{site.mirrorA ? site.mirrorA.intact ? '完好，仍在A处' : '受损，仍在A处' : '尚无当前记录'}；同一原镜B{site.mirrorB ? site.mirrorB.intact ? '完好，仍在B处' : '受损，仍在B处' : '尚无当前记录'}。</p>
        <p>原负载剩余{site.load.remainingLoads}次，已实际施加{site.load.appliedLoads}次；原残留{site.residue ? site.residue.status === 'CONSUMED' ? '已耗尽' : site.residue.status === 'HANDED_OVER' ? '已交还' : '仍封装' : '尚无当前记录'}。它们与本次单独购买的新材料分别记录。</p>
        <p>原箱{site.box.state === 'CLOSED' ? '已经闭合' : '仍然开启'}，{site.box.scorched ? '既有焦痕仍在' : '尚无焦痕'}；旧记录已有脉冲{site.box.pulses}次、{site.box.pulseSeconds}秒。新处置不会抹去已有损伤。</p>
        <p>旧生活护片共{site.plates.length}枚：{site.plates.map((plate, index) => `第${index + 1}枚${plate.status === 'RETURNED' ? '已归还' : '当前在' + PLACE[plate.location]}，剩余${plate.charges}次、磨损${plate.wear}${plate.scorched ? '、焦痕仍在' : ''}，原价${plate.paidPennies}便士`).join('；')}。</p>
      </>}
      <p>这里显示当前位置与余量；过去的到场、同意与交接记录只说明当时发生的事。新的实践须重新取得本案许可，不会恢复旧物或复制参与者。</p>
    </section>;
  }

  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    const known = scene.knownEnemyName !== null && enemy.name !== null;
    const remainingMarks = materials.marks.filter(mark => mark.status === 'HELD').length;
    return <section aria-label="末日魔女可选真实交战"><h3>{text(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{text(encounter.story)}</p>
      {known ? <p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。对手保有自己的身体与意愿。</p>
        : <p>尚未实际交谈，当前没有这位对手的姓名、年龄与身体记录。</p>}
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4><p>当前策略：{POLICIES[encounter.policy]}。{encounter.policyConfirmed ? '本场明确选择已经保存。' : '等待本场明确选择，默认显示不代表已经确认。'}开战后不能更换。</p></section>
      {known && <><section aria-label="战场位置与普通出口"><h4>真实位置与普通退路</h4>
        <p>本人在{PLACE[scene.playerLocation]}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；本人累计实走{scene.playerTravelMetres}米，对手累计实走{scene.enemyTravelMetres}米，交战现场经过{scene.clockSeconds}秒。普通出口开放，生还离场须实际走过4米。</p>
        <p>当前身体作用路线{scene.visibleBodyLine ? '可见' : '被遮挡'}；{scene.observedConditionVersion === null ? '尚无本场实际观察。' : '本场已记录实际观察，条件改变后须重新核对。'}</p>
        <p>{site?.vera ? `${site.vera.name}在${PLACE[site.vera.location]}，精力${site.vera.energy}/100` : '尚无原物主当前位置'}；{site?.marcus ? `${site.marcus.name}在${PLACE[site.marcus.location]}，精力${site.marcus.energy}/100` : '尚无原保管者当前位置'}。两人须实际走到室外才能进入本场，生活同意不包括战斗。</p>
      </section><section aria-label="对手原棍与有限印记"><h4>同一武器与三枚印记</h4>
        <p>对手同一根{materials.weapon.massKg}千克原棍{materials.weapon.location === 'HAND' ? '仍在对手手中' : '已落在邻近修护院地面'}。原印记剩余{remainingMarks}/{materials.marks.length}枚，已耗尽{materials.marks.length - remainingMarks}枚，不自动补充。</p>
        <p>身体印记已用{enemy.powerUses.BODY_MARK}次，精神印记已用{enemy.powerUses.MENTAL_MARK}次，侧移遮挡已用{enemy.powerUses.FEINT}次。身体作用与精神压力分别结算。</p>
        {enemy.pendingSource ? <p>当前{enemy.pendingSource.power === 'BODY_MARK' ? '身体' : '精神'}印记脉冲：于{enemy.pendingSource.declaredAt}秒开始蓄势，在现场时钟{enemy.pendingSource.readyAt}秒时具备释放条件；{enemy.pendingSource.observed ? '本人已经实际观察' : '本人尚未实际观察'}，{enemy.pendingSource.containmentUsed ? '这份来源的收束帮助已经用过' : '这份来源的收束帮助尚未用过'}。已经支付的印记与灵性不会补回。</p>
          : <p>当前没有尚待释放的印记脉冲；不能以过去的攻击或已耗印记再次取得收束帮助。</p>}
      </section></>}
      <section aria-label="末日魔女战斗护片"><h4>本场单独付费的护片</h4>
        {materials.plate ? <><p>本场护片{materials.plate.id}：已实付{materials.plate.paidPennies}便士，当前由本人持有，剩余{materials.plate.charges}/{materials.plate.initialCharges}次，实际磨损{materials.plate.wear}。</p>
          {materials.plate.charges === 0 && <p>本片次数已经耗尽，不能再提供镜面缓冲。</p>}</> : <p>本场护片尚未实际取得，到场交谈须另付20便士取得一枚三次护片。</p>}
        <p>旧战斗护片仍按原记录保留，不复制、不充能，也不冒充本场的新护片。</p>
      </section>
      <section aria-label="实战的有限能力"><h4>一次真实作用的有限帮助</h4>
        <p>脉冲收束须先实际观察当前待发源，只帮助一次普通攻击，增加30点攻势。镜面缓冲只抵减随后下一次可见身体作用30点，同时耗用本场护片一次并留下5点磨损；不能抵挡精神压力或撤销过去伤害。</p>
        <p>每次施放消耗8灵性、2精神和5秒，窗口最长20秒。移动、遮挡或到期会使窗口失效；成功施放而未实际应用不增加掌握。</p><p>{text(value.inheritedTools)}</p>
      </section>
      <details className="seer-fold"><summary>交战消耗、抵抗与实际时间记录</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{text(fact)}</li>)}</ul></details>
    </section>;
  }

  function lifeFacts() {
    const attempt = selectedCase?.id === life.activeCase ? life.currentAttempt : selectedCase?.attempts.at(-1);
    const current = selectedCase?.id === life.activeCase && !!selectedCase?.contactOpen && !!attempt && !attempt.closed;
    const permission = (key: 'owner' | 'operator' | 'participant' | 'ability') => {
      const state = attempt?.permission[key] ?? 'UNASKED';
      return state === 'GRANTED' && !current ? '本案曾明确同意，当前无生效许可' : PERMISSION[state];
    };
    const pendingWindow = current && life.pending?.caseId === selectedCase?.id ? life.pending : null;
    const usable = !!pendingWindow && life.pendingUsable && life.pendingRemainingSeconds > 0 && life.clockSeconds < pendingWindow.expiresAt;
    const useText = (state: string) => state === 'ACTIVE' && !current ? '曾施放成功，本次已结束且未应用' : WINDOW[state] ?? '已有记录';
    const residue = life.residue, load = life.load, plate = attempt?.plate;
    return <section aria-label="末日魔女生活练习"><h3>{text(selectedCase?.title ?? life.title)}</h3><p>{text(selectedCase?.story ?? life.story)}</p>
      {selectedCase?.result && <p className="slice-notice">{text(selectedCase.result)}</p>}
      {attempt && !current && <p>以下尝试是当次已保存经历；原人原物的当前位置以上方当前事实为准。</p>}
      <section aria-label="当前时钟与一次能力窗口"><h4>实际时间与下一次作用</h4>
        <p>现场时钟{life.clockSeconds}秒；本阶段实际经过{life.elapsedSeconds}秒。页面停留不会自行推进现场；等待须提交实际等待动作。</p>
        {pendingWindow ? <><p>{pendingWindow.kind === 'CONTAINMENT' ? '脉冲收束' : '镜面缓冲'}窗口：从{pendingWindow.createdAt}秒至{pendingWindow.expiresAt}秒，还剩{life.pendingRemainingSeconds}秒。</p>
          <p>{usable ? pendingWindow.kind === 'CONTAINMENT' ? '当前只可收束同一新封存来源的下一次待发脉冲，应用后用尽。' : '当前只可减轻本人随后承受的这一次真实冲击，仍会耗用本案护片并留下磨损。' : '当前窗口不可应用；余下时间、当前许可与真实条件须同时满足操作完成的要求。'}</p></>
          : <p>当前没有尚未耗用的能力窗口。成功施放、实际应用、失败、到期与停止分别记录。</p>}
        <p>两项能力均需8灵性、2精神和1秒；脉冲收束进行知识18检定，镜面缓冲进行意志18检定。窗口最长20秒，移动、遮挡、撤回与停手会使未用帮助失效。只有实际成功应用才增加掌握。</p>
      </section>
      <section aria-label="本案的独立许可"><h4>本次用途与当前同意</h4><ul>
        <li>{site?.vera?.name ?? '原物主'}的原镜用途许可：{permission('owner')}。</li><li>{site?.marcus?.name ?? '原保管者'}的原箱操作许可：{permission('operator')}。</li>
        <li>两位成人参与本案的许可：{permission('participant')}。</li><li>本次有限能力用途许可：{permission('ability')}。</li>
      </ul><p>每案单独询问，过去的同意不延续。拒绝或撤回后停止新施法，仍可普通封存、归还护片并步行离场；待发脉冲不会凭空消失，成人也不会自动回到室外。</p></section>
      <section aria-label="唯一新残留与脉冲处置"><h4>单独付费的一份新残留</h4>
        {residue ? <><p>新封存来源{residue.id}：已实付{residue.paidPennies}便士，当前在{PLACE[residue.location]}，剩余{residue.remaining}次，已实际消耗{residue.consumed}次。它来自成年工坊保管者，是一份虚构、非生物的封装材料。</p>
          <p>实际到货：{residue.receivedAt === null ? '尚未到货' : `${residue.receivedAt}秒`}；待发脉冲：{residue.pendingAt === null ? '当前没有' : `从${residue.pendingAt}秒起待处理`}；实际脉冲：{residue.appliedAt === null ? '尚未发生' : `已于${residue.appliedAt}秒发生`}。</p>
          <p>实际收束{residue.suppressed}次；{residue.ordinarySealed ? '已经通过普通方法封存。' : '尚未通过普通方法封存。'}消耗完毕不能再次施加，也不会补回旧残留。</p></>
          : <p>尚未购买新残留。整段实践只有一份新来源，须单独支付50便士并实际接收；旧残留仍按原记录耗尽。</p>}
        {attempt && <><p>脉冲收束：{attempt.containment.tier === null ? '尚未判定' : TIER[attempt.containment.tier]}，{useText(attempt.containment.state)}；实际尝试{attempt.containment.attempts}次，实际应用{attempt.containment.effects}次。</p>
          <p>本次脉冲{attempt.pulseApplied ? '已经实际发生' : '尚未实际发生'}，{attempt.pulseSuppressed ? '已实际收束' : '没有实际收束'}；{attempt.ordinarySealed ? '普通封存已完成' : '普通封存尚未完成'}；{attempt.boxScorchRecorded ? '本次箱体焦痕已经记录' : '没有新增箱体焦痕记录'}。既有焦痕继续保留。</p></>}
      </section>
      <section aria-label="一次新负载与本人冲击"><h4>有限新负载与镜面缓冲</h4>
        {load ? <><p>本次新负载{load.id}：已实付{load.paidPennies}便士，当前在{PLACE[load.location]}，剩余{load.remaining}次，已实际耗用{load.consumed}次。</p>
          <p>实际到货：{load.arrivedAt === null ? '尚未到货' : `${load.arrivedAt}秒`}；实际准备：{load.preparedAt === null ? '尚未准备' : `${load.preparedAt}秒`}；实际施加：{load.appliedAt === null ? '尚未施加' : `${load.appliedAt}秒`}。安全止挡保持接合。</p></>
          : <p>尚未购买新冲击负载，唯一新负载需30便士。原负载仍保持原来的耗尽记录。</p>}
        {attempt && <><p>镜面缓冲：{attempt.buffer.tier === null ? '尚未判定' : TIER[attempt.buffer.tier]}，{useText(attempt.buffer.state)}；实际尝试{attempt.buffer.attempts}次，实际应用{attempt.buffer.effects}次。</p>
          <p>本次冲击{attempt.loadApplied ? '已实际施加' : '尚未实际施加'}，减轻{attempt.impactReduction}点，实际损失{attempt.impactDamage}健康。</p></>}
        <p>真实冲击通常损失本人6健康；有效镜面缓冲减轻3点。普通承受同样耗用护片并留下磨损；能力不抵挡精神压力，不恢复已经失去的健康。</p>
      </section>
      <section aria-label="本案新护片与归还"><h4>实际安装与亲手归还</h4>
        {plate ? <><p>本案护片{plate.id}：已实付{plate.paidPennies}便士，{plate.status === 'RETURNED' ? '已经归还' : plate.status === 'INSTALLED' ? '已经实际安装' : '本人持有'}，当前在{PLACE[plate.location]}；剩余{plate.charges}次，实际磨损{plate.wear}，{plate.scorched ? '焦痕仍在' : '尚无焦痕'}。</p>
          <p>实际安装：{plate.installedAt === null ? '尚未安装' : `${plate.installedAt}秒`}；实际取下：{plate.removedAt === null ? '尚未取下' : `${plate.removedAt}秒`}；实际归还：{plate.returnedAt === null ? '尚未归还' : `${plate.returnedAt}秒`}。</p></>
          : <p>本案尚未取得新护片。每案准备分别支付20便士取得一枚一次护片，已耗尽的护片仍须实际取下并归还，费用不退。</p>}
      </section>
      <section aria-label="实际位置与普通退出"><h4>停手、收尾与普通离场</h4>
        <p>本阶段本人实际步行{life.playerTravelMetres}米，{site?.vera?.name ?? '原物主'}实走{life.veraTravelMetres}米，{site?.marcus?.name ?? '原保管者'}实走{life.marcusTravelMetres}米；每个人实际耗时并消耗自己的精力。</p>
        {attempt && <><p>本次已付{attempt.penniesSpent}便士、{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、{attempt.healthSpent}健康、{attempt.playerEnergySpent}本人精力，实际经过{attempt.elapsedSeconds}秒。</p>
          <p>{attempt.stopped ? '本次方法已经停止。' : '本次尚未明确停止方法。'}{attempt.exited ? '本人和两位成人已经实际走到室外。' : '处理待发脉冲与原箱、取下本案护片后，仍须普通步行离场，并在室外交还护片。'}</p></>}
        <p>室外休息需15便士、1行动、60秒，只恢复本人20现场精力。日常休养、换周和晋升不会免费补满现场精力，也不替成人行走。</p>
      </section>
      <details className="seer-fold"><summary>三案报告、反思与普通替代</summary>
        <ul>{life.cases.map(entry => <li key={entry.id}>{text(entry.title)}：{STATUS[entry.status] ?? '当前记录'}{entry.result ? `；${text(entry.result)}` : ''}。</li>)}</ul>
        <p>{life.reflected ? '三案报告与反思已保存。' : '每案实际收尾后可以如实报告，普通完成同样可消化；三份报告后再进行反思。'}</p>
        <ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{text(entry)}</li>)}</ul><p>{text(life.environment)}</p>
      </details>
    </section>;
  }

  function operationFacts(command: ApocalypseDemonessCommand) {
    switch (command.type) {
      case 'PREPARE': return <p>本案单独支付20便士取得一枚一次新护片；旧三枚生活护片的归还和余量不变。仍须分别取得当前许可并实际到场。</p>;
      case 'BUY_RESIDUE': return <p>独立支付50便士购买唯一一份新封装残留，须另行实际接收。它是虚构非生物材料，不补回已经耗尽的旧残留。</p>;
      case 'START_PULSE': return <p>这一步产生需要实际处置的待发脉冲。之后停止能力或撤回许可也不能直接离开，仍须实际处理或普通封存。</p>;
      case 'APPLY_PULSE': return <p>只对这份尚余一次的新来源实际施加脉冲；应用会耗尽来源与本案护片，记录真实磨损和焦痕。能力只收束下一次待发脉冲，不擦除旧损伤。</p>;
      case 'ORDINARY_SEAL': return <p>通过普通方法处理当前仍待发的来源，支付本步所列代价；不把普通封存记作能力应用。原箱与材料的真实状态、焦痕、费用保留。</p>;
      case 'BUY_LOAD': return <p>独立支付30便士购买唯一一次新冲击负载，之后仍须实际接收和准备。旧负载不会恢复。</p>;
      case 'APPLY_LOAD': return <p>真实冲击通常损失本人6健康；有效镜面缓冲只减轻3点。无论普通承受还是能力帮助，均实际耗用本案护片并留下磨损。</p>;
      case 'REMOVE_PLATE': return <p>本人须在护片的实际安装处亲手取下，并先处理待发脉冲与原箱；取下不等于已经归还。</p>;
      case 'RETURN_PLATE': return <p>本人和两位成人已经走到室外，在那里将同一枚新护片实际交还；即使次数已经耗尽也须归还，原支付费用不退。</p>;
      case 'EXIT_ROOM': return <p>本人和两位原成人沿普通路线实际走到室外，各自消耗真实步行时间与精力。须先处理待发脉冲并取下已安装的护片；到室外后还须实际交还同一护片。</p>;
      case 'RECOVER_ENERGY': return <p>本人在室外支付15便士、1行动，经过60秒恢复20现场精力。不会恢复旧耗材，也不会替两位成人恢复精力。</p>;
      case 'ENCOUNTER_TALK': return <p>实际走到邻近修护院交谈，另付20便士取得本场三次新护片；只到场交谈，不自动交战。两位原成人须已经实际走到室外，原伊瑞丝的身体与旧遭遇保留。</p>;
      case 'LEAVE_ENCOUNTER': return <p>本人实际沿普通出口走4米，消耗4秒和4精力。已有伤势、对手状态、印记与新护片的已耗次数继续保留。</p>;
      case 'STOP_METHOD': return <p>停止新的能力使用并清除未用窗口，保留已经付出的代价。待发脉冲须继续普通收尾，护片须亲手归还，每个人须普通行走离场。</p>;
      default: return null;
    }
  }
}
