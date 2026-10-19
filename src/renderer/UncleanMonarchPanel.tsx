import { useEffect, useRef, useState } from 'react';
import type { UncleanMonarchAction, UncleanMonarchCommand, UncleanMonarchProjection } from '../domain/unclean-monarch/types.js';
import { playerText } from '../shared/player-text.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'SET_COMBAT_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'LEAVE', 'WITHDRAW_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP_METHOD', 'RETURN_TO_A', 'RETURN_TO_ENTRY', 'RETURN_CARD', 'RETURN_PIECE']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已停止，待普通收尾', ACTIVE: '现场尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '本人已死亡', CANCELLED: '已停止，未写完成报告' };
const PLACE: Record<string, string> = { START: '原安静室门口', A: '四米处原桌', B: '八米处原铃', OUTSIDE: '室外', YARD: '相邻院落', NORA: '诺拉本人处', PLAYER: '本人处', OWNER: '原物主处', SUPPLIER: '供应方处', SUPPLY: '供应方处' };
const PERMISSION: Record<string, string> = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回', CLOSED: '本次许可已结束' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const WINDOW: Record<string, string> = { NONE: '尚未尝试', ACTIVE: '判定成功，尚待实际应用', APPLIED: '已实际应用', FAILED: '判定失败', EXPIRED: '已经到期', WITHDRAWN: '撤回后已清除', STOPPED: '已经停止', MOVED: '移动后已经失效', CONDITION_CHANGED: '现场条件变化后已清除', OCCLUDED: '遮挡后已经失效' };
const POLICIES: Record<string, string> = { INHERITED_ONLY: '只用已学能力', BINDING: '允许冲动收束', INTERFERENCE: '允许定向扰动', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface UncleanMonarchPanelProps {
  value: UncleanMonarchProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: UncleanMonarchCommand) => void;
  /** Navigation alone never applies a window, returns an item or moves a body. */
  onClose?: (() => void) | null;
}

export function UncleanMonarchPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: UncleanMonarchPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: UncleanMonarchAction; facts: string } | null>(null);
  const [pending, setPending] = useState(false);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), confirmationHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>()), returnActionId = useRef<string | null>(null);
  const facts = JSON.stringify(value), currentFacts = useRef(facts);
  currentFacts.current = facts;
  const locked = busy || blocked || error !== null || pending || value.resources === null || value.resources.health === 0;
  const { life, encounter } = value;
  // The domain projection is the sole current authority. Never fall back to the
  // frozen predecessor snapshot, or create local bodies/items from old records.
  const site = life.site;
  const text = (prose: string) => value.characterName ? prose.split(value.characterName).map(playerText).join(value.characterName) : playerText(prose);
  const selectedBottle = value.bottles.find(bottle => bottle.id === goal)
    ?? value.bottles.find(bottle => value.actions.some(action => action.enabled && 'bottleId' in action.command && action.command.bottleId === bottle.id))
    ?? value.bottles[0];
  const activeCase = life.cases.find(entry => entry.id === life.activeCase);
  const selectedCase = activeCase ?? life.cases.find(entry => entry.id === goal)
    ?? life.cases.find(entry => entry.status !== 'RESOLVED') ?? life.cases[0];
  const inEncounter = encounter.inside || (!activeCase && value.promoted && goal === 'encounter');
  const inside = value.insideCase || life.inside || life.insideCase || encounter.inside || value.preparedWeek !== null;
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

  function choose(action: UncleanMonarchAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id; setConfirmation({ action, facts });
  }
  function submit(action: UncleanMonarchAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id; submittedFacts.current = facts; setPending(true); onCommand(action.command);
  }
  function actionControl(action: UncleanMonarchAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" data-action-id={action.id} disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `unclean-monarch-reason-${encodeURIComponent(action.id)}` : undefined} onClick={() => choose(action)}>
        <strong>{text(action.label)}</strong><span className="slice-modifiers">{text(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`unclean-monarch-reason-${encodeURIComponent(action.id)}`}>{text(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="污秽君王当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="污秽君王当前资源"><h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>健康恢复不代表旧伤已经消失。晋升与离场不会治疗伤势，也不会补满灵性或耗材。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="污秽君王成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{text(value.title)}</h2>
      <section aria-label="污秽君王阶段总览">
        <p>当前阶段：{inEncounter ? `可选真实遭遇 · ${STATUS[encounter.status] ?? '当前记录'}` : value.promoted ? life.reflected ? '三份生活报告与反思已完成' : '原安静室的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p>
        <p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 污秽君王扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p>
      </section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : life.reflected && !inEncounter ? '生活报告与反思已完成，可以返回普通生活；相邻院落的争议由你自行选择。' : text(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {blocked && <p role="status">请先处理当前阻塞事项，本页暂不能提交新操作。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">{value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="污秽君王目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked} onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{text(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：相邻院落的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{text(bottle.title)} · {text(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="污秽君王其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{text(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {originalFacts()}
      {!value.promoted ? <section aria-label="污秽君王服药准备">
        <p>{text(value.digestion)}</p><p>{text(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{text(selectedBottle.title)}</h3><p>{text(selectedBottle.source)}</p><p>{text(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{text(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>指导500便士、1行动；每瓶7200便士，或为本瓶完成五项各1行动的真实劳动，获得6000便士抵额后支付1200便士。三项专业准备各1行动，当周准备另需1行动、180便士。全部原瓶失败耗尽后，补货申请另需1行动、100便士，至少到下一真实周才能到货。</p>
        <p>须从实际鲜血大公晋升周起满12整周，消化100，保留原有十六项能力的实际掌握，并完成旧三份报告、反思及本次专业准备。服药需健康高于20、精神高于40，并进行意志30检定；饮用本身不耗行动。供应方交付独立成品原瓶，未掌握完整配方，不能自行调配。</p>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留鲜血大公。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{text(value.risk)}</p><p>{text(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{text(value.digestion)}</p><p>{text(value.appearanceRecord)}</p><p>{text(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{text(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{text(ability.label)} · 掌握{ability.mastery}</h3><p>{text(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{text(value.environment)}关闭页面不会代替停手、归还原卡与本案耗材、普通步行离场；实际时间、伤势与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="污秽君王操作确认" onKeyDown={event => {
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
        <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。本阶保留姓名、性别、年龄与既有性格。原有十六项能力及其实际掌握保留，两项新能力从0开始；原卡、原铃、原纸记录、旧耗材与参与者不会复制或补充。也可取消并继续停留鲜血大公。</p></>}
      {live && ['IMPULSE_BINDING', 'FOCUSED_INTERFERENCE'].includes(live.command.type) && <p>{text(value.abilities.find(ability => ability.id === (live.command.type === 'IMPULSE_BINDING' ? 'abyss.s1.impulse-binding' : 'abyss.s1.focused-interference'))?.description ?? '')}</p>}
      {live && 'permission' in live.command && <p>本次针对：{live.command.permission === 'OWNER' ? `${site.volunteer.name}对原卡用途的许可` : `${site.volunteer.name}对本次有限能力用途的许可`}。{live.command.type === 'WITHDRAW_CONSENT' ? '撤回立即停止新施法并清除未用窗口；已付代价保留，同一原卡与本案耗材仍须亲手归还。' : '只记录本案明确同意，之后仍可以撤回。'}</p>}
      {live?.command.type === 'SET_COMBAT_POLICY' && <p>本次明确选择：{POLICIES[live.command.policy]}。只保存本场策略，不施法、不购买材料、不开始战斗。</p>}
      {live?.command.type === 'ENCOUNTER_FIGHT' && <><p>这是与{encounter.enemy?.name ?? '眼前的对手'}的真实交战。双方独立受伤、投降、撤退与死亡都将保存，普通死亡终结本周目。</p><p>本场策略：{POLICIES[encounter.policy]}。开战后不能更换；身体与精神作用分别结算，生还离场须实际步行4米。</p><p>{text(encounter.story)}</p></>}
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
    return <section aria-label="污秽君王原人原物当前状态"><h3>同一安静室、原卡与原成人</h3>
      <p>本人当前在{PLACE[site.playerLocation]}，累计普通步行{site.playerTravelMetres}米，现场时钟{site.clockSeconds}秒。</p>
      <p>{site.volunteer.name} · {site.volunteer.age}岁，当前在{PLACE[site.volunteer.location]}；{site.volunteer.alive ? '仍然在世' : '原身体已经死亡'}，{site.volunteer.willing ? '愿意听取本次询问' : '不愿继续参与'}。每案的原物用途与能力用途仍须分别取得当前许可。</p>
      <p>累计本阶段协作耗力{life.volunteerEffortSpent}/12。每案首次实际协作阅读或铃声排练耗力3；单纯询问同意不消耗，换案、换周与晋升不清零。</p>
      <p>{site.guide.name}当前在{PLACE[site.guide.location]}，累计实际步行{site.guide.travelMetres}米。</p>
      <p>原卡{site.card.id}在{PLACE[site.card.location]}，数量{site.card.quantity}，累计实际行程{site.card.travelMetres}米；物主仍是{site.volunteer.name}。</p>
      <p>原铃{site.bell.id}与原纸{site.note.id}均在{PLACE[site.bell.location]}，各只有一件；原纸已有{site.note.records.length}份记录。</p>
      <p>普通门路{life.operation.door === 'OPEN' ? '保持开放' : '当前关闭'}；{life.operation.inputActive ? '仍有实际输入，须先停手' : '当前没有持续输入'}。铃声排练累计记录{life.operation.bellRehearsals}次，旧恶魔负荷当前为{encounter.strain}。</p>
      <p>当前位置、原物与既往伤害按已保存事实保留。新的短暂练习不能复制原卡、替换成人，也不会恢复旧对手或补回旧耗材。</p>
    </section>;
  }

  function lifeFacts() {
    const attempt = selectedCase?.id === life.activeCase ? life.currentAttempt : selectedCase?.attempts.at(-1);
    const current = selectedCase?.id === life.activeCase && !!selectedCase?.contactOpen && !!attempt && !attempt.closed;
    const piece = life.pieces.find(entry => entry.caseId === selectedCase?.id);
    const window = current && life.pending?.caseId === selectedCase?.id ? life.pending : null;
    const permitted = (permission: 'OWNER' | 'ABILITY') => {
      const state = selectedCase?.permission[permission] ?? 'UNASKED';
      return state === 'GRANTED' && (selectedCase?.status === 'EXAMINED' || selectedCase?.status === 'RESOLVED') ? '本案曾明确同意，当前已经结束' : PERMISSION[state];
    };
    return <section aria-label="污秽君王生活练习"><h3>{text(selectedCase?.title ?? life.title)}</h3><p>{text(selectedCase?.story ?? life.story)}</p>
      {selectedCase?.result && <p className="slice-notice">{text(selectedCase.result)}</p>}
      {attempt && !current && <p>以下尝试是当次已保存经历；同一成人与原物的当前位置以上方当前事实为准。</p>}
      <section aria-label="当前时钟与一次能力窗口"><h4>实际时间与下一次作用</h4>
        <p>现场时钟{life.clockSeconds}秒；{attempt ? `本次实际经过${attempt.elapsedSeconds}秒。` : '本案尚无实际尝试。'}页面停留不会自行推进现场，等待须提交实际等待动作。</p>
        {window ? <><p>{window.abilityId === 'abyss.s1.impulse-binding' ? '冲动收束' : '定向扰动'}窗口：从{window.createdAt}秒至{window.expiresAt}秒，还剩{life.pendingRemainingSeconds}秒。</p>
          <p>仅限本次许可、同一原卡{window.cardId}、同一耗材{window.pieceId}和当前实际位置；尚须真正应用，成功开窗不等于已经取得效果。</p></>
          : <p>当前没有尚未耗用的能力窗口。成功施放、实际应用、失败、到期与停止分别记录。</p>}
        <p>两项能力每次实耗8灵性、2精神和1秒，按意志18检定；失败总损失4精神。一次只保留一个20秒窗口，只作用于下一次符合条件的真实操作。移动、遮挡、撤回、停止或到期使未用窗口失效，已付成本不退。</p>
        {attempt && <p>窗口记录：{attempt.windowEnd === 'ACTIVE' && !current ? '曾施放成功，本次已结束且未应用' : WINDOW[attempt.windowEnd]}。实际应用{attempt.appliedAbilityIds.length}项能力；未应用的成功施放不增加掌握。</p>}
      </section>
      <section aria-label="本案的独立许可"><h4>原物用途与能力用途分别同意</h4><ul>
        <li>{site.volunteer.name}对本案原卡用途的许可：{permitted('OWNER')}。</li>
        <li>{site.volunteer.name}对本案有限能力用途的许可：{permitted('ABILITY')}。</li>
      </ul><p>每案重新询问，可以拒绝或撤回。撤回立即停止新施法并清除未用窗口；已付成本保留，同一原卡仍须当面归还，本人仍须从普通门路离开。</p></section>
      <section aria-label="本案的一次耗材"><h4>一件实付耗材，一次真实作用</h4>
        {piece ? <p>本案耗材{piece.id}，已实付{piece.paidPennies}便士；{piece.status === 'RETURNED' ? '已经归还' : '本人携带'}，当前在{PLACE[piece.location]}，剩余{piece.charges}次，实际磨损{piece.wear}。</p>
          : <p>本案尚未取得耗材。准备需1行动、20便士，独立购买一件一次耗材，旧卡、原铃与旧耗材不会复制。</p>}
        <p>只有实际应用能力才消耗同一件耗材一次并留下1点磨损；失败、未应用、到期或撤回不扣次数，已付施法成本仍保留。次数与磨损不会随换案恢复。</p>
      </section>
      <section aria-label="有限作用与普通核对"><h4>先观察实际来源，再完成一次普通操作</h4>
        <p>冲动收束须先察觉本人在核对原卡时真实出现的急躁冲动。成功后，只给下一次知识20的原件核对增加35，仍可能失败；原卡内容不会因此增加。</p>
        <p>定向扰动须先有诺拉自愿参加的真实铃声排练，并确认她可观察的强烈紧张。成功后，只把下一次尚待发生的可见敲击或打断压力从45减到15，最多减轻30。</p>
        {attempt && <><p>本次施放检定：{attempt.castTier === null ? '尚未尝试' : TIER[attempt.castTier]}；原件核对检定：{attempt.checkTier === null ? '尚未尝试' : TIER[attempt.checkTier]}。{attempt.checkBase === null ? '尚无原件核对判定。' : `本次实际核对基础${attempt.checkBase}，其中冲动收束增加${attempt.checkBonus}。`}</p>
          <p>本次操作基准压力{attempt.baselinePressure}，实际承受压力{attempt.feltPressure}；{attempt.verified ? '已经完成实际核验' : '尚未完成实际核验'}，{attempt.manual ? '已经进行普通补查' : '尚未进行普通补查'}。</p></>}
        <p>一次操作结束后，现场条件随之改变，不能用旧情绪或旧冲动反复获益。能力不改写思想，也不能使诺拉接受邀请、产生感情或服从命令。</p>
      </section>
      <section aria-label="实际位置与普通退出"><h4>停止、归物与普通离场</h4>
        {attempt && <><p>本次已付{attempt.penniesSpent}便士、{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神；本人实走{attempt.playerTravelMetres}米，实际经过{attempt.elapsedSeconds}秒。</p>
          <p>{attempt.stopped ? '本次方法已经停止。' : '本次尚未明确停止方法。'}{attempt.cardReturned ? '同一原卡已经当面归还。' : attempt.cardTaken ? '原卡已借持，尚须当面归还。' : '本次尚未领取原卡。'}{attempt.closed ? '本次接触已经实际结束。' : '仍须完成普通返程和本次交接。'}</p></>}
        <p>门口到诺拉所在原桌4米，原桌到原铃4米。核对后沿原路回到诺拉处交还同一原卡，再返回门口交还本案耗材并结束接触。普通门路始终保留。</p>
        <p>尚未购买耗材、只有观察记录或本周行动已经用完时，仍可停止并按实际位置普通离场。关闭页面不会代替停手、归物与行走。</p>
      </section>
      <details className="seer-fold"><summary>三案报告、反思与普通替代</summary><ul>{life.cases.map(entry => <li key={entry.id}>{text(entry.title)}：{STATUS[entry.status] ?? '当前记录'}{entry.result ? `；${text(entry.result)}` : ''}。</li>)}</ul>
        <p>{life.reflected ? '三案报告与反思已保存，可以返回普通生活。' : '每份如实报告消化25，三案之后一次反思另消化25。普通完成、失败后普通补查和撤回可以如实报告；只有实际应用过的能力在首次报告时增加掌握8。'}</p>
        <ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{text(entry)}</li>)}</ul><p>{text(life.environment)}</p>
      </details>
    </section>;
  }

  function operationFacts(command: UncleanMonarchCommand) {
    switch (command.type) {
      case 'LEARN_GUIDANCE': return <p>支付500便士、1行动，听取独立成品渠道与本阶准备要求。指导不提供完整配方，也不自动获得、准备或饮用药瓶。</p>;
      case 'POTION_WORK': return <p>只为所选独立原瓶完成一次真实劳动，消耗1行动。五项劳动合计抵6000便士，之后仍须另付1200便士取得本瓶。</p>;
      case 'BUY_POTION': return <p>支付本瓶当前列明价格，只领取这一独立成品原瓶。领取不代替专业准备、当周检查或另行确认饮用。</p>;
      case 'REQUEST_SUPPLY': return <p>本批原瓶全部失败耗尽后，另付100便士、1行动申请下一批三瓶。至少跨一真实周才可接收；每瓶仍须分别劳动或付费取得。</p>;
      case 'PREPARE_PROMOTION': return <p>支付180便士、1行动检查本周服药场地。结束准备不退款；所选原瓶只有另行确认饮用时才耗尽。</p>;
      case 'LEAVE_PREPARATION': return <p>结束当周准备，保留未服用的独立原瓶；已付检查费不退，下次需重新准备。可以继续停留鲜血大公。</p>;
      case 'PREPARE': return <p>本案支付20便士、1行动，独立取得一件一次耗材。{command.method === 'ORDINARY' ? '选用普通方法，实际核对不增加未应用能力的掌握。' : '准备本身不施法，还须取得许可、步行到场并完成实际操作。'}已付费用不因停止或撤回返还。</p>;
      case 'READ_ORIGINAL': return <p>本人须到原铃处，亲自阅读原卡与原纸已有内容。本案首次实际协作阅读或排练使诺拉累计本阶段协作耗力增加3，此后同案不重复扣除。</p>;
      case 'NOTICE_IMPULSE': return <p>只记录本人在本次原卡核对中真实出现的急躁冲动。观察不施法，也不替代之后的原件核对。</p>;
      case 'REHEARSE_BELL': return <p>在诺拉本次明确同意后，以同一原铃进行一次真实排练。本案首次实际协作使累计本阶段协作耗力增加3；不能把过去的铃声当作新来源。</p>;
      case 'CONFIRM_EMOTION': return <p>确认本次自愿排练中可观察的强烈紧张，只为这一次尚待发生的操作提供有限来源。未观察到的想法和隐藏意图不作推断。</p>;
      case 'IMPULSE_BINDING': return <p>支付8灵性、2精神和1秒，按意志18尝试冲动收束。成功只开启20秒一次窗口，让下一次知识20的原件核对增加35，仍可能失败；失败总损失4精神。实际应用才耗用本案耗材一次。</p>;
      case 'FOCUSED_INTERFERENCE': return <p>支付8灵性、2精神和1秒，按意志18尝试定向扰动。须有当前许可与刚才确认的真实强烈紧张；成功只为下一次可见打断减轻30，最长20秒且只用一次，失败总损失4精神。</p>;
      case 'CHECK_ORIGINAL': return <p>对同一原卡进行一次真实知识20核对。有效冲动收束只为这一次增加35并耗用本案耗材一次；结果仍以实际判定为准，不会自动成功或补出原卡没有的内容。</p>;
      case 'PERFORM_OPERATION': return <p>真正完成当前尚待发生的铃声操作。有效定向扰动只把这次可见打断压力从45减到15，并耗用同一件耗材一次；操作结束改变现场条件，不重复利用旧来源。</p>;
      case 'MANUAL_OPERATION': return <p>停止依赖能力，按原卡与原铃实际完成普通核对。失败或撤回的施法成本保留，没有真正应用的能力不增加掌握。</p>;
      case 'OCCLUDE': return <p>实际遮挡当前视线，立即清除尚未应用的能力窗口，已付成本保留。恢复视线也不会恢复旧窗口。</p>;
      case 'RESTORE_VIEW': return <p>重新打开当前视线，便于普通核对和收尾；已经结束的窗口不会恢复。</p>;
      case 'WAIT_10': return <p>现场实际经过10秒，未用窗口可能到期；停留页面不会自行消耗或延长窗口。已付费用与精神、灵性消耗保留。</p>;
      case 'STOP_METHOD': return <p>停止新的能力使用并清除未用窗口，保留所有已付成本。仍须携同一原卡沿普通路返回，当面归还后结束接触。</p>;
      case 'RETURN_TO_A': return <p>本人携实际持有的同一原卡，从原铃沿4米普通路回到诺拉处。经过真实时间，未用窗口随移动失效。</p>;
      case 'RETURN_CARD': return <p>本人已实际回到诺拉身边，当面交还手中同一原卡。原卡仍属于诺拉，不会产生替代卡或复制件。</p>;
      case 'RETURN_TO_ENTRY': return <p>本人从诺拉所在原桌沿4米普通路返回门口，保留实际时间、已付代价与原物行程。</p>;
      case 'RETURN_PIECE': return <p>在门口亲手交还本案同一件耗材。剩余次数与真实磨损按原记录保留，不补充、不退款。</p>;
      case 'LEAVE': return <p>原卡与本案耗材均已归还、能力已停止后，从普通门路结束本次接触。不会移动诺拉、返还施法成本或抹去失败。</p>;
      case 'ABORT': return <p>立即停止本次方法、清除未用窗口，按当前实际距离普通返回并交还已借原卡及本案耗材。即使尚未购买或本周行动用尽，也保留普通退路；没有实际工作的观察不能写成完成报告。</p>;
      case 'REPORT': return <p>只报告本案已经实际完成并收尾的结果，消化25。只有本案真正应用过的能力增加掌握8；无实际工作、只有施放成功或已撤回未用的窗口不会得到掌握。</p>;
      case 'REFLECT': return <p>三案分别如实报告后，进行一次反思并消化25。普通完成与撤回记录保留，不补发未发生的能力效果。</p>;
      case 'PREPARE_ENCOUNTER': return <p>旧现场实际收尾后，另付30便士、1行动取得本场一件三次耗材。不会补回旧物、身心资源或恶魔负荷，也不自动开战。</p>;
      case 'ENCOUNTER_TALK': return <p>诺拉须先从原桌经门口亲自走8米到室外，仍由她持有的原卡随她同行；罗安已在室外。之后本人从门口走4米进入相邻院落交谈，不自动开战。</p>;
      case 'LEAVE_ENCOUNTER': return <p>本人沿普通出口实走4米、经过4秒返回原门口。原身体、旧伤、对手独立状态、原棍与已耗铭片继续保留。</p>;
      default: return null;
    }
  }

  function encounterFacts() {
    const { enemy, piece, plates } = encounter;
    const remainingPlates = plates.filter(plate => plate.status === 'HELD').length;
    return <section aria-label="污秽君王可选真实交战"><h3>{text(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{text(encounter.story)}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。他有独立身体与意愿；旧埃德里克、奥里克与加雷斯的经历继续保留。</p>
        <section aria-label="战场位置与普通出口"><h4>真实位置与普通退路</h4><p>本人当前在{PLACE[site.playerLocation]}；{enemy.name}在{PLACE[enemy.position]}，{site.playerLocation === 'YARD' ? `当前相距${enemy.distanceMetres}米。` : '本人尚未在该交战位置与他接触。'}累计本人实走{site.playerTravelMetres}米，现场时钟{site.clockSeconds}秒。</p>
          <p>{site.volunteer.name}当前在{PLACE[site.volunteer.location]}，原卡在{PLACE[site.card.location]}。她须实际走到室外后，本人才进入院落；生还者仍须沿普通出口走4米，死亡的身体保留在实际位置。</p></section>
        <section aria-label="对手原棍与有限铭片"><h4>一根原棍，三枚有限铭片</h4><p>原棍{enemy.weaponId}{enemy.weaponLocation === 'HAND' ? `仍在${enemy.name}手中` : '留在相邻院落地面'}。铭片剩余{remainingPlates}/{plates.length}枚，已耗尽{plates.length - remainingPlates}枚，不自动补充。</p>
          <p>有限弧光已用{enemy.powerUses.ARC_BOLT}次，惊惧脉冲已用{enemy.powerUses.DREAD_PULSE}次，格挡已用{enemy.powerUses.GUARD}次，平息呼吸已用{enemy.powerUses.CALM_BREATH}次。弧光与惊惧各耗7灵性及一枚铭片，分别造成身体75、精神65的攻势；格挡耗4灵性，平息呼吸耗3灵性。</p>
        </section></>}
      <section aria-label="对手当前能力盘"><h4>对手的实际能力盘</h4><ul>{encounter.enemyAbilityWheel.map(entry => <li key={entry.id}>{text(entry.label)} · 权重{entry.weight}</li>)}</ul>
        <p>铭片或灵性不足时按对应普通行动结算，不会透支已耗尽的铭片或获得免费能力。</p></section>
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4><p>当前策略：{POLICIES[encounter.policy]}。开战前可以改变；选择策略不施法、不购买物品、不自动开战。</p></section>
      <section aria-label="污秽君王战斗耗材"><h4>本场单独付费的三次耗材</h4>
        {piece ? <p>{piece.id}：已实付{piece.paidPennies}便士，当前由本人持有，剩余{piece.charges}/{piece.initialCharges}次，实际磨损{piece.wear}。</p>
          : <p>本场耗材尚未取得。可另付30便士、1行动购买一件三次耗材；旧生活耗材、身体资源与恶魔负荷不会补充或清零。</p>}
        <p>只有真正作用于下一次攻击，才耗用同一件耗材一次并留下1点磨损。失败、到期、条件改变或未应用不扣次数，已付施法成本仍保留。</p>
      </section>
      <section aria-label="实战的有限能力"><h4>一次真实作用的有限帮助</h4><p>冲动收束为20秒内同位置、同一可见对手的下一次普通攻击增加35。定向扰动须有实际观察的强烈情绪并经过对手抵抗，只减轻下一次可见身体或精神攻击30。各只能应用一次，一次只有一个新窗口。</p>
        <p>每次施放实耗8灵性、2精神及5秒，按意志18检定；失败总损失4精神。每轮60秒；对手平息呼吸、遮挡、换位或窗口到期会清除未用作用。旧火焰与硬化的资源、恶魔负荷和既往良知经历照常保留。</p><p>{text(value.inheritedTools)}</p></section>
      <details className="seer-fold"><summary>交战消耗、抵抗与实际时间记录</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{text(fact)}</li>)}</ul></details>
    </section>;
  }
}
