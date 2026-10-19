import { useEffect, useRef, useState } from 'react';
import { playerText } from '../shared/player-text.js';
import type { PureWhiteAngelAction, PureWhiteAngelCommand, PureWhiteAngelProjection } from '../domain/pure-white-angel/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'LEAVE', 'WITHDRAW_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP', 'OPEN_SHUTTER', 'RETRIEVE_SAMPLE', 'RETRIEVE_PAD', 'EXIT_GALLERY', 'ACKNOWLEDGE_REFUSAL']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已安全中止，待普通续办', ACTIVE: '尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '已结束' };
const ENEMY_STATUS = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const PERMISSION = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回', CLOSED: '本次许可已结束' };
const WINDOW = { NONE: '尚未尝试', ACTIVE: '等待实际应用', FAILED: '判定失败', CHECK_FAILED: '后续独立操作失败', APPLIED: '已经实际应用', STOPPED: '已经停止', EXPIRED: '已经到期', INVALIDATED: '条件改变，已经失效' };
const PERMISSION_LABEL = { OWNER: '玛拉的原采光廊许可', TECHNICIAN: '伊文本次参与', ABILITY: '本人本次使用能力' };
const POLICIES = { INHERITED_ONLY: '只用已学能力', FOCUSED_PURIFICATION: '允许净光定向', WARM_RADIANCE_GUARD: '允许温光护持', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };
const LOCATION: Record<string, string> = { OUTSIDE: '原采光廊外', ENTRY: '原入口', NEAR: '入口内两米处', SCREEN: '原遮板旁', OTHER: '廊内四米处', FAR: '六米尽头', SIDE: '九米侧路', AWAY: '已经离场' };

export interface PureWhiteAngelPanelProps {
  value: PureWhiteAngelProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: PureWhiteAngelCommand) => void;
  onClose?: () => void;
}

/** The view never changes resources or manufactures commands: it submits a current public action verbatim. */
export function PureWhiteAngelPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: PureWhiteAngelPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: PureWhiteAngelAction; facts: string } | null>(null);
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

  function choose(action: PureWhiteAngelAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: PureWhiteAngelAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function actionLabel(action: PureWhiteAngelAction) {
    return copy(action.label) + ('permission' in action.command ? `：${PERMISSION_LABEL[action.command.permission]}` : '');
  }
  function actionControl(action: PureWhiteAngelAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `pure-white-angel-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{actionLabel(action)}</strong><span className="slice-modifiers">{copy(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`pure-white-angel-reason-${action.id}`}>{copy(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="纯白天使当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="纯白天使当前资源">
      <h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>晋升、停止与归还原物不会免费恢复身体，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="纯白天使成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{copy(value.title)}</h2>
      <section aria-label="纯白天使阶段总览"><p>当前阶段：{inEncounter ? '可选真实遭遇' : value.promoted ? life.reflected ? '生活报告与反思已完成' : '原采光廊的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p><p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 纯白天使扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p></section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : next ? actionLabel(next) : copy(value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">
        {value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="纯白天使目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked}
          onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{copy(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：廊外前庭的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{copy(bottle.title)} · {copy(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="纯白天使其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{actionLabel(action)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {originalFacts()}
      {!value.promoted ? <section aria-label="纯白天使服药准备">
        <p>{copy(value.digestion)}</p><p>{copy(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{copy(selectedBottle.title)}</h3><p>{copy(selectedBottle.source)}</p><p>{copy(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{copy(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留逐光者。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{copy(value.risk)}</p><p>{copy(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{copy(value.digestion)}</p><p>{copy(value.appearanceRecord)}</p><p>{copy(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{copy(ability.label)} · 掌握{ability.mastery}</h3><p>{copy(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{copy(value.environment)}关闭页面不会代替停止作用、归还原物与沿原路离开；已经发生的事件与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="纯白天使操作确认" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!busy && !pending) setConfirmation(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const first = buttons[0], last = buttons.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeading.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h3 ref={confirmationHeading} tabIndex={-1}>{live ? actionLabel(live) : '现场已变化'}</h3>
      <p>{live && copy(live.cost)}</p>
      {confirmedBottle && <><p>{copy(confirmedBottle.title)} · {copy(confirmedBottle.status)}</p><p>{copy(confirmedBottle.source)}</p><p>当前成功率{confirmedBottle.chance}%</p>
        <p>{copy(value.risk)}</p><p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。本阶不改变性别、姓名、年龄、性格与取向。也可取消并继续停留逐光者。</p></>}
      {live?.command.type === 'FOCUSED_PURIFICATION' && <p>本次消耗8灵性、2精神，意志18。成功只为近距离观察过、无遮挡的同一样本和同一条件版本开启30秒窗口；随后仍须独立清理，另作意志18判定，窗口只提供+10帮助。实际成功才将唯一一份超自然残留从1减为0，原样本仍在。只有窗口真正帮助这次清理，报告时才增加8掌握；开窗本身不清理、不增掌握。</p>}
      {live?.command.type === 'WARM_RADIANCE_GUARD' && <p>本次消耗6灵性、2精神，知识18。成功只为本人已经登记的小幅练习冲击开启30秒、一次性的护持窗口。随后释放冲击仍使本人护垫耐久减少10；通常本人健康减少5，只有当时有效的护持才防止这5点损失。失败后仍可选择普通手柄复位。</p>}
      {live?.command.type === 'DECLARE_IMPACT' && <p>登记只声明下一次本人练习冲击，不立即释放。之后释放会磨损同一护垫10耐久，通常损失本人5健康；有效护持只防止这5点。也可改用普通手柄安全复位，同样磨损10耐久，不损失健康，不增加新能力掌握。</p>}
      {live?.command.type === 'RELEASE_IMPACT' && <p>这一次练习冲击会使同一护垫耐久减少10；通常本人健康减少5。只有作用当时仍有效的温光护持才防止这5点损失，施放成功不保证此刻仍有效。也可取消，选择普通手柄复位：安全完成，护垫仍有实际磨损，不增加新能力掌握。伤害只可通过之后的普通行动恢复。</p>}
      {live?.command.type === 'HANDLE_RESET' && <p>普通手柄复位安全完成本次检查，不损失健康；同一护垫仍实际磨损10耐久，不增加新能力掌握。它不会恢复之前已经损失的健康、灵性或精神。</p>}
      {live?.command.type === 'CLEANSE_SAMPLE' && <p>对已经近距离观察的同一原样本实际清理，另作意志18判定；有效净光窗口只提供+10帮助。成功把唯一一份超自然残留从1减为0，原样本保留且不能重新填充。失败仍保留已付代价。也可普通封存，残留仍为1，不算净化或新能力应用。</p>}
      {live?.command.type === 'BUY_SAMPLE' && <p>实付40便士、1行动，买下唯一一份超自然残留样本。之后只实际放置、检查并取回同一原件，清理完不补充残留，也不恢复原采光廊的油灯或旧设施。</p>}
      {live?.command.type === 'BUY_PAD' && <p>实付20便士、1行动，买下本人使用的这一原护垫；以后仍须实际佩戴、登记、使用与归还本人行囊。耐久损耗不会自动恢复。</p>}
      {live?.command.type === 'INVITE' && <p>本次邀请实付10便士、1行动；伊文·梅罗43岁，保有自己的意愿。玛拉本案许可、伊文参与和本人施术分别询问；玛拉同意本案实际消耗2精力。芦影可以拒绝来访并留在侧路，不阻止普通推进。拒绝、撤回或中止不退已付费用。</p>}
      {live?.command.type === 'WITHDRAW_CONSENT' && <p>撤回只停止未来的能力作用；已付代价与真实结果保留。普通停止、处理原遮板、取回样本、归还护垫和沿原路离开仍可继续，原物不会消失。</p>}
      {live?.command.type === 'ASK_SPIRIT' && <p>只询问芦影本次来访的独立意愿，不沿用旧许可。它可以明确拒绝并继续留在侧路；本次不会替它同意、移动或施放能力。</p>}
      {live?.command.type === 'ACKNOWLEDGE_REFUSAL' && <p>确认尊重芦影本次拒绝。它仍留在原侧路，原精力和行走记录保留；拒绝不阻止普通收尾或报告。</p>}
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
    const site = life.site;
    return <details className="seer-fold"><summary>原采光廊、玛拉、芦影与旧物当前记录</summary>
      <section aria-label="原采光廊当前状态"><h3>同一采光廊、原人和原物</h3>
        <p>{site.operatorName} · {site.operatorAge}岁；精力{site.operatorEnergy}/100，当前在{LOCATION[site.operatorLocation]}，累计实走{site.operatorMetres}米。</p>
        <p>{site.spiritName}是同一独立灵体；精力{site.spiritEnergy}/100，当前在{LOCATION[site.spiritLocation]}，累计实走{site.spiritMetres}米。旧探访许可不能代替本次选择，不强迫它参与。</p>
        <p>本人在{LOCATION[site.playerLocation]}，累计实走{site.playerMetres}米；同一原采光廊长{site.lengthMetres}米，现场时钟{site.elapsedSeconds}秒。普通出口开放，打开页面不会移动任何人或物。</p>
        <p>三米处原遮板{site.shutter.state === 'CLOSED' ? '关闭' : site.shutter.state === 'OPEN' ? '开放' : '损坏'}，耐久{site.shutter.durability}/100，已经实际操作{site.shutter.operations}次。损坏的遮板不能假装重新开关，仍可普通安全收物与离开。</p>
        <p>原油灯余油{site.lamp.oil}份；原遮罩在{site.cover.position === 'OWNER_STAND' ? '玛拉原架上' : '原屏架上'}，耐久{site.cover.durability}/100；原屏板耐久{site.screen.durability}/100，实际检查{site.screen.inspections}次。原光当前{site.light.mode === 'OFF' ? '已熄灭' : '仍在作用'}。</p>
        <p>同一字牌{site.board.location === 'FAR_STAND' ? '仍在六米尽头原架' : '由本人携带'}，归{site.board.owner === 'LS2-MARA' ? '玛拉' : '本人'}所有，{site.board.read ? '已有实际核读记录' : '尚未实际核读'}。油、遮罩、屏板、字牌和灵体不会因进入新阶段而补充、维修或替换。</p>
        <p>当前身体：{value.currentGender === 'FEMALE' ? '女性' : value.currentGender === 'MALE' ? '男性' : '按本人记录'}。本阶不改变性别、姓名、年龄、性格与取向；过去的死亡、投降与已发生的伤害保留。</p>
      </section>
    </details>;
  }
  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    return <section aria-label="纯白天使可选真实交战">
      <h3>{copy(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{copy(encounter.story)}</p>
      <p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。他有自己的身体、精神、意愿与原杆。</p>
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4>
        <p>当前策略：{POLICIES[encounter.policy]}。{encounter.policyConfirmed ? '本场明确选择已经保存。' : '等待本场明确选择，默认显示不代表已经确认。'}开战后不能更换。</p>
        <p>可只用已学能力、只允许净光定向、只允许温光护持、允许两项新能力，或只作普通行动。选择只保存策略，不施法、不购买原物，也不开始战斗。</p>
      </section>
      <section aria-label="战场位置与普通出口"><h4>廊外前庭与普通退路</h4>
        <p>本人在{scene.playerLocation === 'FORECOURT' ? '廊外独立前庭' : '前庭外原路'}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；累计实走{scene.playerTravelMetres}米，现场经过{scene.clockSeconds}秒。普通出口{scene.ordinaryExit === 'OPEN' ? '开放' : '受阻'}，生还离场须实际走过4米。这条退路与原采光廊的六米生活路线分别记录。</p>
        <p>身体冲击路线{scene.visibleBodyLine ? '当前可见' : '当前不可见'}，当前条件版本{scene.conditionVersion}；{scene.observedConditionVersion === null ? '尚无本场实际观察' : `最近实际观察版本${scene.observedConditionVersion}`}。看见目标不等于已经应用引导或挡住冲击。</p>
        <p>{life.site.operatorName}、{life.site.spiritName}与伊文·梅罗都不在本场。采光廊侧路是独立区域，不靠能力豁免旁人。旧欧文的原身体与死亡结局保留；新对手不会替换旧人物或撤销旧结局。</p>
      </section>
      <section aria-label="对手原杆与有限资源"><h4>{enemy.name}自己的原杆与遮罩</h4>
        <p>同一根{materials.weapon.massKg}千克原杆{materials.weapon.location === 'HAND' ? '仍在对手手中' : '已落在前庭地面'}，完整度{materials.weapon.condition}/100；光击储能{materials.weapon.charge}/{materials.weapon.capacity}。每次光击实际消耗1片及7灵性，用尽后不会补充或转入本人库存。</p>
        <p>对手已实际使用光击{enemy.powerUses.LIGHT_STRIKE}次、光护{enemy.powerUses.LIGHT_WARD}次、炫目压力{enemy.powerUses.DAZZLING_PRESSURE}次、关闭遮罩{enemy.powerUses.OBSCURE}次。光护消耗6灵性，炫目压力消耗7灵性并产生65精神压力，遮挡消耗3灵性、每轮最多一次。</p>
        <p>对手自己的同一原遮罩当前{materials.screen.hood === 'OPEN' ? '打开' : '关闭'}，耐久{materials.screen.durability}/100、实际操作{materials.screen.operations}次；遮挡改变视线与条件版本，之后仍须真实重新揭开与观察。</p>
      </section>
      <section aria-label="实战的有限能力"><h4>只影响之后的一次真实动作</h4>
        <p>净光定向：8灵性、2精神，意志18；须已经观察可见目标，并经过30%抵抗结算。30秒内只帮助随后一次针对同一目标的真实威胁攻击，增益30，用后结束；施放本身不造成胜利，也不重算已经完成的动作。</p>
        <p>温光护持：6灵性、2精神，知识18；须具备有效观察，并经过30%抵抗结算。30秒内只削弱随后一次可见身体效果30，不能挡住炫目压力的精神效果。</p>
        <p>每个实际行动经过5秒，每轮经过60秒；到期、条件变化或视线遮挡会使未用窗口失效。失败、空窗口或未实际应用都不增加掌握。本人普通续战恢复12灵性，对手没有自动恢复。</p>
        <p>对手行动比例：光击25%、光护20%、炫目压力20%、普通打击20%、遮挡10%、意外5%。抵抗与失败会真实改变结果。</p>
        <p>{copy(value.inheritedTools)}</p>
      </section>
      <details className="seer-fold"><summary>交战消耗、抵抗与有限窗口</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{copy(fact)}</li>)}</ul></details>
    </section>;
  }
  function lifeFacts() {
    const attempt = selectedCase?.attempts.at(-1), { sample, pad, site } = life, window = life.pending;
    const current = selectedCase?.id === life.activeCase && selectedCase.contactOpen && !!attempt && !attempt.closed;
    const permissionText = (permission: keyof typeof PERMISSION) => permission === 'GRANTED' && !current ? '本案曾明确同意，当前无生效许可' : PERMISSION[permission];
    const seconds = window ? Math.max(0, window.expiresAt - life.clockSeconds) : 0;
    const available = (type: 'CLEANSE_SAMPLE' | 'RELEASE_IMPACT') => value.actions.some(action => action.command.type === type && action.enabled);
    const sameWindow = current && attempt.method === 'ABILITY' && Object.values(attempt.permission).every(permission => permission === 'GRANTED')
      && window?.caseId === selectedCase.id && window.permissionVersion === attempt.permissionVersion && seconds >= 4
      && window.conditionVersion === life.conditionVersion && life.playerLocation === 'FAR' && site.playerLocation === 'FAR'
      && site.operatorLocation === 'SIDE' && site.spiritLocation === 'SIDE' && life.ivan.location === 'SIDE'
      && site.shutter.state === 'OPEN' && site.shutter.durability > 0 && !attempt.stopped;
    const focusedOpen = sameWindow && window.kind === 'FOCUSED' && attempt.focused.state === 'ACTIVE'
      && window.sampleVersion === sample.version && sample.location === 'FAR' && sample.residueUnits === 1 && !sample.contained
      && attempt.observedSampleVersions.includes(sample.version) && available('CLEANSE_SAMPLE');
    const guardOpen = sameWindow && window.kind === 'GUARD' && attempt.guard.state === 'ACTIVE'
      && pad.location === 'WORN' && attempt.impactDeclared && !attempt.impactReleased && !attempt.impactReset && available('RELEASE_IMPACT');
    const spent = life.ledger.reduce((total, receipt) => ({
      actions: total.actions + Math.max(0, receipt.before.actions - receipt.after.actions),
      cash: total.cash + Math.max(0, receipt.before.cash - receipt.after.cash),
      spirituality: total.spirituality + Math.max(0, receipt.before.spirituality - receipt.after.spirituality),
      mind: total.mind + Math.max(0, receipt.before.mind - receipt.after.mind),
      health: total.health + Math.max(0, receipt.before.health - receipt.after.health),
    }), { actions: 0, cash: 0, spirituality: 0, mind: 0, health: 0 });
    return <section aria-label="纯白天使生活练习">
      <h3>{copy(selectedCase?.title ?? life.title)}</h3><p>{copy(selectedCase?.story ?? life.story)}</p>
      {selectedCase?.result && <p className="slice-notice">{copy(selectedCase.result)}</p>}
      <section aria-label="本案的独立许可"><h4>分别确认本次许可</h4>
        <p>{site.operatorName} · {site.operatorAge}岁，当前在{LOCATION[site.operatorLocation]}；{life.ivan.name} · {life.ivan.age}岁，当前{life.ivan.location === 'AWAY' ? '已经离场' : `在${LOCATION[life.ivan.location]}`}。两人保有独立意愿。</p>
        <ul><li>原采光廊与玛拉许可：{permissionText(attempt?.permission.owner ?? 'UNASKED')}。</li>
          <li>技师本次参与许可：{permissionText(attempt?.permission.technician ?? 'UNASKED')}。</li>
          <li>本人使用能力：{permissionText(attempt?.permission.ability ?? 'UNASKED')}。</li></ul>
        <p>每次邀请实付10便士、1行动，每案重新询问；玛拉同意本案实际消耗2精力，不免费恢复。她可留在九米侧路；伊文须从入口实际走到侧路后才可施术。拒绝、撤回与停止不退已付费用，普通停术、收物和离开仍可继续。</p>
        <p>芦影本次意愿：{attempt?.spiritAsked ? attempt.spiritAnswer === 'DECLINED' ? `明确拒绝来访；${attempt.refusalAcknowledged ? '已确认尊重本次拒绝' : '待确认尊重本次拒绝'}` : '尚未得到本次答复' : '尚未询问本次来访'}。它仍在{LOCATION[site.spiritLocation]}，精力{site.spiritEnergy}/100；旧许可不代替它本次回答，拒绝不阻止普通推进，也不取得任何灵体能力。</p>
      </section>
      <section aria-label="实际位置与归还"><h4>原采光廊、实际身体与普通退路</h4>
        <p>本人在{LOCATION[life.playerLocation]}；本阶段累计实走{life.playerTravelMetres}米，现场时钟{life.clockSeconds}秒，本阶段实际经过{life.elapsedSeconds}秒。</p>
        <p>廊内从入口到尽头单程6米，普通出入仍须实际行走。玛拉累计实走{site.operatorMetres}米，伊文累计实走{life.ivan.travelMetres}米。普通出口开放；归还原物指实际放回本人行囊或约定持有人处。</p>
        <p>{selectedCase?.returned ? '本案原样本、护垫与人员的实际收尾已完成。' : '关闭页面不能代替停止作用、处理遮板、取回样本与护垫并沿原路退出。'}撤回、破损与失效不会删除原物，也不会把人传送出去。</p>
      </section>
      <section aria-label="同一原样本与本人护垫"><h4>唯一原样本与逐次磨损的本人原物</h4>
        <p>原样本：{sample.purchasedWeek === null ? `尚未取得；购买需${sample.price}便士、1行动。` : `第${sample.purchasedWeek}周已实付${sample.price}便士取得。`}
          当前{sample.location === 'SUPPLIER' ? '由供应方保管' : sample.location === 'PLAYER' ? '由本人实际携带' : '实际放在六米尽头'}，超自然残留{sample.residueUnits}份，{sample.contained ? '已普通封存' : sample.residueUnits === 0 ? '已经实际清理' : '尚未封存'}，原样本版本{sample.version}。</p>
        <p>这是一份超自然残留。清理把残留1变为0，同一原样本保留且不重新填充；普通封存保留残留1，不冒充净化。第三案不另发一份样本。</p>
        <p>本人护垫：{pad.purchasedWeek === null ? `尚未取得；购买需${pad.price}便士、1行动。` : `第${pad.purchasedWeek}周已实付${pad.price}便士取得。`}
          当前{pad.location === 'SUPPLIER' ? '由供应方保管' : pad.location === 'PLAYER' ? '在本人行囊' : '本人实际佩戴'}，耐久{pad.durability}/100。实际练习冲击{pad.impacts}次、普通手柄复位{pad.resets}次。</p>
        <p>释放小幅练习冲击：护垫耐久减少10，通常本人健康减少5；只有当时有效的温光护持才防止这5点损失。普通手柄复位：安全完成，不损失健康，护垫仍磨损10，不增加新能力掌握。两种方法都不会修复或重建原物。</p>
        <p>当前原遮板{site.shutter.state === 'OPEN' ? '开放' : site.shutter.state === 'CLOSED' ? '关闭' : '损坏'}，耐久{site.shutter.durability}/100、实际操作{site.shutter.operations}次；现场条件版本{life.conditionVersion}。第三案伊文须实际走到三米处关闭原遮板，再退回侧路；关闭改变条件并使旧窗口失效，本案不释放冲击。</p>
      </section>
      <section aria-label="两项能力的有限窗口"><h4>施放、暂存窗口与真实应用分别记录</h4>
        <p>净光定向：8灵性、2精神，意志18。须近距离观察同一无遮挡样本；成功后30秒内，只为同一样本和条件版本的后续意志18清理提供+10帮助。</p>
        {focusedOpen ? <p>净光定向还剩{seconds}秒，等待一次独立清理；尚未清除残留。</p> : <p>当前没有可应用的净光定向窗口；{sample.residueUnits === 0 ? '原样本残留已为0，不需要再次施放，也不能重新填充刷取应用。' : sample.contained ? '同一份残留已经普通封存，仍留在原样本中，未被净化。' : '可按当前操作普通走近封存，同一份残留保留在原样本中。'}</p>}
        <p>温光护持：6灵性、2精神，知识18。须实际佩戴原护垫并声明本人小幅冲击；成功后30秒内，只防止随后一次冲击的5健康损失。</p>
        {guardOpen ? <p>温光护持还剩{seconds}秒，等待本人一次实际练习冲击；尚未抵挡伤害。</p> : <p>当前没有可应用的温光护持窗口；仍可选择普通手柄复位，保留真实磨损与已经支付的成本。</p>}
        <p>施放本身不清除残留或抵挡伤害，也不增加掌握。到期、样本或现场版本改变、遮板关闭或许可撤回都会使未用窗口失效；停止不退费，既往伤害不被改写。</p>
        {attempt && <><p>净光定向：尝试{attempt.focused.attempts}次，成功开窗{attempt.focused.successes}次，{attempt.focused.tier === null ? '尚未判定' : TIER[attempt.focused.tier]}，{attempt.focused.state === 'ACTIVE' && !focusedOpen ? '原窗口当前不能应用' : WINDOW[attempt.focused.state]}，实际应用{attempt.focused.effects}次；温光护持：尝试{attempt.guard.attempts}次，成功开窗{attempt.guard.successes}次，{attempt.guard.tier === null ? '尚未判定' : TIER[attempt.guard.tier]}，{attempt.guard.state === 'ACTIVE' && !guardOpen ? '原窗口当前不能应用' : WINDOW[attempt.guard.state]}，实际应用{attempt.guard.effects}次。</p>
          <p>后续独立清理：{attempt.cleanseTier === null ? '尚未判定' : TIER[attempt.cleanseTier]}；{attempt.manualContained ? '本案已经普通封存，残留未被净化。' : ''}本人练习冲击：{attempt.impactReleased ? `已经实际释放，护持防止${attempt.healthPrevented}健康损失` : '尚未实际释放'}。{attempt.impactReset ? '本案已经普通手柄复位。' : ''}</p>
          <p>报告奖励：{selectedCase?.status === 'RESOLVED' ? '本案已报告，实际应用的掌握增量以当前能力记录为准' : '本案尚未报告，成功开窗不提前奖励'}。失败、未用或过期不增加掌握；每项新能力仅在真实应用并报告后增加8掌握，唯一原样本不能反复刷取奖励。</p></>}
      </section>
      <p>本阶段生活已付：{spent.actions}行动、{spent.cash}便士、{spent.spirituality}灵性、{spent.mind}精神、{spent.health}健康。停止与还物不退已付代价，恢复须通过普通生活行动。</p>
      <details className="seer-fold"><summary>本案范围、普通替代与退路</summary><ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        <p>{copy(life.environment)}</p><p>{life.reflected ? '三案报告与反思已保存。' : '三份报告各25扮演、反思25；普通完成同样有效，须先实际收束现场。'}</p>
      </details>
    </section>;
  }
}
