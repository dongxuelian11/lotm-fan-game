import { useEffect, useRef, useState } from 'react';
import type { DivineHandAction, DivineHandCommand, DivineHandProjection } from '../domain/divine-hand/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'LEAVE', 'WITHDRAW_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP_METHOD', 'STOP', 'RETURN_ACTOR', 'RETURN_PAD', 'RETURN_PLATE', 'REMOVE_PAD', 'EXIT_ROOM', 'RECOVER_ENERGY']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已中止，待普通续办', ACTIVE: '现场尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '本人已死亡' };
const PLACE: Record<string, string> = { ENTRY: '修护室门口', BENCH: '修护台旁', BRIDGE: '短桥另一端', OUTSIDE: '室外', YARD: '独立庭院', PLAYER: '本人处', SUPPLIER: '供应方处' };
const PERMISSION: Record<string, string> = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回', CLOSED: '本次许可已结束' };
const WINDOW: Record<string, string> = { NONE: '尚未尝试', ACTIVE: '尚待实际应用', APPLIED: '已实际应用', SPENT: '已耗用', FAILED: '判定失败', EXPIRED: '已经到期', WITHDRAWN: '撤回后已清除', STOPPED: '已经停止', INVALIDATED: '条件改变，已经失效' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const POLICIES: Record<string, string> = { INHERITED_ONLY: '只用已学能力', BEAM_STABILIZE: '允许接触稳持', ARMOR_CONVERGENCE: '允许护甲合势', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface DivineHandPanelProps {
  value: DivineHandProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: DivineHandCommand) => void;
  /** Navigation only; closing a page never moves bodies or settles an operation. */
  onClose?: (() => void) | null;
}

/** Public facts are rendered verbatim. Only the exact current projected command may be submitted. */
export function DivineHandPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: DivineHandPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: DivineHandAction; facts: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>()), returnActionId = useRef<string | null>(null);
  const facts = JSON.stringify(value), currentFacts = useRef(facts);
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

  function choose(action: DivineHandAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id; setConfirmation({ action, facts });
  }
  function submit(action: DivineHandAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id; submittedFacts.current = facts; setPending(true); onCommand(action.command);
  }
  function actionControl(action: DivineHandAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" data-action-id={action.id} disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `divine-hand-reason-${encodeURIComponent(action.id)}` : undefined} onClick={() => choose(action)}>
        <strong>{action.label}</strong><span className="slice-modifiers">{action.cost}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`divine-hand-reason-${encodeURIComponent(action.id)}`}>{action.reason}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="神明之手当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="神明之手当前资源"><h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>健康数值恢复不代表既有伤势已经消失。晋升与退出不治疗旧伤、不修复原甲，也不补满灵性或现场精力。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="神明之手成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{value.title}</h2>
      <section aria-label="神明之手阶段总览">
        <p>当前阶段：{inEncounter ? '可选真实遭遇' : value.promoted ? life.reflected ? '生活报告与反思已完成' : '原修护室的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p>
        <p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 神明之手扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p>
      </section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : next?.label ?? value.nextStep}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {blocked && <p role="status">请先处理当前阻塞事项，本页暂不能提交新操作。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">{value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="神明之手目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked} onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：修护室外的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{bottle.title} · {bottle.status}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="神明之手其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{action.label}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {originalFacts()}
      {!value.promoted ? <section aria-label="神明之手服药准备">
        <p>{value.digestion}</p><p>{value.supplies}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{selectedBottle.title}</h3><p>{selectedBottle.source}</p><p>{selectedBottle.status} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{preparation.title}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>指导500便士；每瓶分别完成五项劳动后余款1100便士。当周准备另需1行动、150便士；三项专业准备各1行动。现有原瓶全部失败耗尽后，补货申请另需1行动、100便士，至少到下一真实周才能到货。</p>
        <p>须从实际荣耀者晋升周起满12整周，消化100，并完成专业准备。交接处供应独立成品原瓶；未掌握完整配方，不能自行调配。</p>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留荣耀者。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{value.risk}</p><p>{value.appearanceRecord}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{value.digestion}</p><p>{value.appearanceRecord}</p><p>{value.inheritedTools}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{ability.label} · 掌握{ability.mastery}</h3><p>{ability.description}</p></section>)}
      </details>
      <p className="seer-small-note">{value.environment}关闭页面不会代替停手、归还物品与沿普通路离场；已经经过的时间、伤势与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="神明之手操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{live?.label ?? '现场已变化'}</h3><p>{live?.cost}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%</p><p>{value.risk}</p>
        <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。本阶不改变性别、姓名、年龄、性格与取向。原有二十项能力及其实际掌握保留，两项新能力从0开始；原甲、安全垫、旧负载与参与者不会补充。也可取消并继续停留荣耀者。</p></>}
      {live && ['BEAM_STABILIZE', 'ARMOR_CONVERGENCE'].includes(live.command.type) && <p>{value.abilities.find(ability => ability.id === (live.command.type === 'BEAM_STABILIZE' ? 'warrior.s1.beam-stabilize' : 'warrior.s1.armor-convergence'))?.description}</p>}
      {live && 'permission' in live.command && <p>本次针对：{live.command.permission === 'OWNER' ? `${life.site.celia.name}对原物用途的许可` : live.command.permission === 'OPERATOR' ? `${life.site.celia.name}操作本案的许可` : live.command.permission === 'PARTICIPANT' ? `${life.site.evan.name}参与本案的许可` : '两位成人对本次有限能力用途的许可'}。{live.command.type === 'WITHDRAW_CONSENT' || live.command.type === 'DECLINE_CONSENT' ? '拒绝或撤回会立即停止尚未用掉的帮助与接触，已经发生的代价保留。' : '只记录这一次明确同意，之后仍可以撤回。'}</p>}
      {live?.command.type === 'ENCOUNTER_POLICY' && <p>本次明确选择：{POLICIES[live.command.policy]}。只保存本场策略，不会施法、购买材料或开始战斗。</p>}
      {live?.command.type === 'ENCOUNTER_FIGHT' && <><p>这是与{encounter.enemy.name ?? '眼前的对手'}的真实交战。双方独立受伤、投降、撤退与死亡都将保存，普通死亡终结本周目。</p><p>本场策略：{POLICIES[encounter.policy]}。开战后不能更换；实际资源、可见身体作用和对象条件分别结算。</p><p>{encounter.story}</p></>}
      {!confirmedBottle && live?.command.type !== 'ENCOUNTER_FIGHT' && <p>{inEncounter ? encounter.story : value.promoted ? life.environment : value.story ?? value.risk}</p>}
      {resources()}
      <p>已经支付的行动、金钱、灵性与精神不因失败、停止或撤回而返还；秒数不会倒退，既有伤害与真实磨损不会撤销。许可只适用于本次用途，撤回后停止未用能力，人物仍须普通行走离场。</p>
      {live?.reason && <p className="seer-action-reason">{live.reason}</p>}
      <div className="seer-confirm-buttons"><button className="slice-button quiet" disabled={pending || busy} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button className="slice-button" disabled={locked || !live?.enabled} onClick={() => { if (live) submit(live); }}>{live?.command.type === 'CONSUME' ? '确认服用这一原瓶' : live?.command.type === 'ENCOUNTER_FIGHT' ? '确认开始真实交战' : '确认执行这一次操作'}</button></div>
      <p>取消不提交。只有收到已保存的新记录后，才能开始下一次操作。</p>
    </section>}
  </section>;

  function originalFacts() {
    const { site } = life;
    return <details className="seer-fold"><summary>原修护室、原人和旧物当前记录</summary>
      <section aria-label="原修护室当前状态"><h3>同一原甲与有限旧物</h3>
        <p>本人当前在{PLACE[site.playerLocation]}，精力{site.playerEnergy}/100，累计普通步行{site.playerTravelMetres}米，现场时钟{site.clockSeconds}秒。</p>
        <p>{site.celia.name} · {site.celia.age}岁，当前在{PLACE[site.celia.location]}，独立精力{site.celia.energy}/100，累计实走{site.celia.travelMetres}米。</p>
        <p>{site.evan.name} · {site.evan.age}岁，当前在{PLACE[site.evan.location]}，独立精力{site.evan.energy}/100，累计实走{site.evan.travelMetres}米。两人各有独立身体与当前意愿。</p>
        <p>同一银甲当前完整度{site.armor?.integrity ?? '尚无当前记录'}；{site.armorWorn ? '本人正在穿戴' : '本人没有穿戴'}。既有磨损保留；过去交接时的完整度不能当作现在的完整度。</p>
        <p>{site.celia.name}的原安全垫剩余{site.pads.remaining}份，已消耗{site.pads.consumed}份，当前在{PLACE[site.pads.location]}，{site.pads.worn ? '正在实际穿戴' : '没有穿戴'}。仍在台上的垫须另行取得当前许可并实际领取。</p>
        <p>原12千克负载剩余{site.load.remainingLoads}次，已实际施加{site.load.appliedLoads}次，安全止挡保持接合。已用尽的旧负载不会重置；新的承压须另有实付、实际准备的一次负载。</p>
        <p>旧护片共{site.plates.length}枚：{site.plates.length ? site.plates.map((plate, index) => `第${index + 1}枚余量${plate.charges}，在${PLACE[plate.location]}，原价${plate.paidPennies}便士`).join('；') : '尚无旧护片记录'}。已付、已耗和已归还分别保留。</p>
        <p>原桥{site.bridge.metres}米，普通侧路{site.bridge.sidePathMetres}米且开放；原能力过桥{site.bridge.crossings}次，普通过桥{site.bridge.ordinaryCrossings}次。旧许可已经结束，新的实践须重新询问。</p>
        <p>{value.appearanceRecord}</p>
      </section>
    </details>;
  }

  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    const known = scene.knownEnemyName !== null && enemy.name !== null;
    const remainingMarks = materials.marks.filter(mark => mark.status === 'HELD').length;
    return <section aria-label="神明之手可选真实交战"><h3>{encounter.title} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{encounter.story}</p>
      {known ? <p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。对手保有独立身体与意愿。</p>
        : <p>尚未实际交谈，当前没有这位对手的姓名、年龄与身体记录。</p>}
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4><p>当前策略：{POLICIES[encounter.policy]}。{encounter.policyConfirmed ? '本场明确选择已经保存。' : '等待本场明确选择，默认显示不代表已经确认。'}开战后不能更换。</p>
        <p>可只用已学能力、只允许接触稳持、只允许护甲合势、允许两项新能力，或只作普通行动。选择只保存策略，不施法、不购买材料，也不开始战斗。</p></section>
      {known && <><section aria-label="战场位置与普通出口"><h4>可见动作与普通退路</h4>
        <p>本人在{PLACE[scene.playerLocation]}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；本人累计实走{scene.playerTravelMetres}米，对手累计实走{scene.enemyTravelMetres}米，现场经过{scene.clockSeconds}秒。普通出口开放，生还离场须实际走过4米。</p>
        <p>当前身体作用路线{scene.visibleBodyLine ? '可见' : '被遮挡'}；{scene.observedConditionVersion === null ? '尚无本场实际观察。' : '已按当前记录实际观察。'}</p>
        <p>{life.site.celia.name}在{PLACE[life.site.celia.location]}，精力{life.site.celia.energy}/100；{life.site.evan.name}在{PLACE[life.site.evan.location]}，精力{life.site.evan.energy}/100。两人须实际离开战场，生活许可不涵盖战斗。</p>
      </section><section aria-label="对手原棍与有限印记"><h4>原棍与有限印记</h4>
        <p>对手同一根{materials.weapon.massKg}千克原棍{materials.weapon.location === 'HAND' ? '仍在对手手中' : '已落在庭院地面'}。原印记剩余{remainingMarks}/{materials.marks.length}枚，已耗尽{materials.marks.length - remainingMarks}枚，不自动补充。</p>
        <p>身体印记已用{enemy.powerUses.BODY_MARK}次，精神印记已用{enemy.powerUses.MENTAL_MARK}次，侧移遮挡已用{enemy.powerUses.FEINT}次。身体作用与精神压力分别结算。</p>
      </section></>}
      <section aria-label="实战的有限能力"><h4>一次真实作用的有限帮助</h4>
        <p>接触稳持只帮助本人实际接触、持有对象的下一次自身普通操作；护甲合势只抵减之后下一次可见身体作用。每项窗口20秒，到期、条件改变或退出后失效；施放成功而没有实际应用，不增加掌握。</p>
        <p>护甲合势使用同一原甲并保留真实磨损，不能抵挡精神作用；没有凭空补充的安全垫、护片或负载。生活帮助不冒充实战结果。</p><p>{value.inheritedTools}</p>
      </section><details className="seer-fold"><summary>交战消耗、抵抗与实际时间记录</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul></details>
    </section>;
  }

  function lifeFacts() {
    const { site } = life;
    const attempt = selectedCase?.id === life.activeCase ? life.currentAttempt : selectedCase?.attempts.at(-1);
    const current = selectedCase?.id === life.activeCase && !!selectedCase?.contactOpen && !!attempt && !attempt.closed;
    const permission = (key: 'owner' | 'operator' | 'participant' | 'ability') => {
      const state = attempt?.permission[key] ?? 'UNASKED';
      return state === 'GRANTED' && !current ? '本案曾明确同意，当前无生效许可' : PERMISSION[state];
    };
    const pendingWindow = current && life.pending?.caseId === selectedCase?.id ? life.pending : null;
    const usable = !!pendingWindow && life.pendingUsable && life.pendingRemainingSeconds > 0 && life.clockSeconds < pendingWindow.expiresAt;
    const useText = (state: string) => state === 'ACTIVE' && !current ? '曾施放成功，本次已结束且未应用' : WINDOW[state] ?? '已有记录';
    return <section aria-label="神明之手生活练习"><h3>{selectedCase?.title ?? life.title}</h3><p>{selectedCase?.story ?? life.story}</p>
      {selectedCase?.result && <p className="slice-notice">{selectedCase.result}</p>}
      <section aria-label="当前时钟与一次能力窗口"><h4>实际时间与下一次自身操作</h4>
        <p>现场时钟{life.clockSeconds}秒；本阶段实际经过{life.elapsedSeconds}秒。页面停留不会自行推进现场，等待须提交实际等待动作。</p>
        {pendingWindow ? <><p>{pendingWindow.kind === 'BEAM' ? '接触稳持' : '护甲合势'}窗口：从{pendingWindow.createdAt}秒至{pendingWindow.expiresAt}秒，还剩{life.pendingRemainingSeconds}秒。</p>
          <p>{usable ? pendingWindow.kind === 'BEAM' ? '当前只可帮助本人接触同一原梁的下一次真实手动检查，帮助消费一次。' : '当前只可抵减同一原甲随后承受的一次真实身体冲击，仍会消耗安全垫并留下磨损。' : '当前窗口不可应用；剩余时间、许可与实际条件须同时满足一次操作完成的要求。'}</p></>
          : <p>当前没有尚未耗用的能力窗口。成功施放、真实应用、失败、到期与停止各自记录。</p>}
        <p>两项能力的窗口均为20秒，只服务之后的一次真实操作。到期的那一刻不再有效；离开原梁、撤回许可或停手会清除未用帮助，已经付出的资源和时间保留。</p>
      </section>
      <section aria-label="本案的独立许可"><h4>本次用途与当前同意</h4><ul>
        <li>{site.celia.name}的物主许可：{permission('owner')}。</li><li>{site.celia.name}的操作许可：{permission('operator')}。</li>
        <li>{site.evan.name}的参与许可：{permission('participant')}。</li><li>两位成人对本次使用能力的许可：{permission('ability')}。</li>
      </ul><p>每案单独准备、单独询问，历史许可不延续。任何当前许可都可以撤回；撤回阻止新施法并结束尚未使用的帮助，不退已经支付的费用，也不会把参与者自动移到室外。</p></section>
      <section aria-label="原梁接触与实际检查"><h4>同一原梁的接触稳持</h4>
        <p>本人{current && attempt?.contact ? '当前实际接触原梁' : '当前没有本案有效的原梁接触'}。稳持帮助仅用于本人下一次手动检查；参与者保有自己的身体，不会获得远程或持续保护。</p>
        {attempt && <><p>接触稳持：{attempt.beam.tier === null ? '尚未判定' : TIER[attempt.beam.tier]}，{useText(attempt.beam.state)}；实际尝试{attempt.beam.attempts}次，实际应用{attempt.beam.effects}次。</p>
          <p>手动检查：{attempt.inspectionAt === null ? '尚未实际完成' : `于${attempt.inspectionAt}秒完成，${attempt.inspectionTier === null ? '按普通记录' : TIER[attempt.inspectionTier]}，实际帮助${attempt.inspectionBonus}点`}。</p></>}
      </section>
      <section aria-label="有限新负载与原甲磨损"><h4>同一原甲与一次实付新负载</h4>
        <p>旧12千克负载剩余{site.load.remainingLoads}次，已使用{site.load.appliedLoads}次。原安全垫剩余{site.pads.remaining}份，在{PLACE[site.pads.location]}，{site.pads.worn ? '已经实际穿戴' : '尚未穿戴'}；同一银甲当前完整度{site.armor?.integrity ?? '尚无当前记录'}。</p>
        {attempt?.load ? <><p>本案新负载：已实付{attempt.load.paidPennies}便士，{attempt.load.kilograms}千克，当前在{PLACE[attempt.load.location]}；剩余{attempt.load.remaining}次，已实际耗用{attempt.load.consumed}次。</p>
          <p>实际到货：{attempt.load.arrivedAt === null ? '尚未到货' : `${attempt.load.arrivedAt}秒`}；物主准备：{attempt.load.preparedAt === null ? '尚未准备' : `${attempt.load.preparedAt}秒`}；实际施加：{attempt.load.appliedAt === null ? '尚未施加' : `${attempt.load.appliedAt}秒`}。安全止挡保持接合。</p></>
          : <p>本案尚未购买新负载。购买、到货、物主准备与实际施加分别进行；没有新负载时可选择普通检查。</p>}
        {attempt && <><p>护甲合势：{attempt.armor.tier === null ? '尚未判定' : TIER[attempt.armor.tier]}，{useText(attempt.armor.state)}；实际尝试{attempt.armor.attempts}次，实际应用{attempt.armor.effects}次。</p>
          <p>本次真实冲击：减轻{attempt.impactReduction}点，仍损失{attempt.impactDamage}健康；原甲实际磨损{attempt.armorWear}点。{attempt.padReturned ? '原垫已经实际交回修护台。' : attempt.padRetrieved ? '已领取原垫，仍须实际交回。' : '本次尚未领取原垫。'}</p></>}
        <p>能力不能抵挡精神作用，也不能消除已发生的伤害。没有实际承压不记护甲应用；普通检查不会虚构一次冲击、消耗或减伤。</p>
      </section>
      <section aria-label="实际位置与普通退出"><h4>普通行走与离场</h4>
        <p>本人在{PLACE[site.playerLocation]}，精力{site.playerEnergy}/100；{site.celia.name}在{PLACE[site.celia.location]}，精力{site.celia.energy}/100；{site.evan.name}在{PLACE[site.evan.location]}，精力{site.evan.energy}/100。</p>
        <p>本阶段本人实走{life.playerTravelMetres}米，{site.celia.name}实走{life.celiaTravelMetres}米，{site.evan.name}实走{life.evanTravelMetres}米。修护台到室外4米，每个人的普通行走实际耗时、耗精力；换案不补充。</p>
        {attempt && <><p>本次已付{attempt.penniesSpent}便士、{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神、{attempt.healthSpent}健康、{attempt.playerEnergySpent}本人精力，实际经过{attempt.elapsedSeconds}秒。</p>
          <p>{attempt.stopped ? '本次方法已经停止。' : '本次尚未明确停止方法。'}{attempt.exited ? '本次三人已经实际走到室外。' : '停手并交还原垫后，仍须沿普通道路实际离场。'}</p></>}
        <p>停止与撤回不退款，普通离场不恢复旧负载、安全垫、护片或原甲。旧人物、旧争议和已有结局各自保留。</p>
      </section>
      {selectedCase && selectedCase.attempts.length > 1 && <details className="seer-fold"><summary>此前尝试与已付代价</summary>
        {selectedCase.attempts.slice(0, -1).map((previous, index) => <p key={`${previous.week}-${index}`}>第{previous.week}周：{previous.method === 'ABILITY' ? '能力方法' : '普通方法'}，已付{previous.penniesSpent}便士、{previous.spiritualitySpent}灵性、{previous.mindSpent}精神，实际经过{previous.elapsedSeconds}秒。接触稳持应用{previous.beam.effects}次，护甲合势应用{previous.armor.effects}次，原甲磨损{previous.armorWear}点；失败与撤回的已付代价保留。</p>)}
      </details>}
      <details className="seer-fold"><summary>本案范围、普通替代与退路</summary><ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>{life.environment}</p><p>{life.reflected ? '三案报告与反思已保存。' : '普通完成同样可以报告，须先实际收束现场并沿原路返回。'}</p>
      </details>
    </section>;
  }
}
