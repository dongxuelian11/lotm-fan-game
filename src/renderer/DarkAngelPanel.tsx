import { useEffect, useRef, useState } from 'react';
import type { DarkAngelAction, DarkAngelCommand, DarkAngelProjection } from '../domain/dark-angel/types.js';
import { playerText } from '../shared/player-text.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'SET_COMBAT_POLICY', 'SET_COMBAT_SPIRIT', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'LEAVE', 'WITHDRAW_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP_METHOD', 'RETURN_TO_A', 'RETURN_TO_ENTRY', 'RETURN_CARD', 'RETURN_STRIP']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已停止，待普通收尾', ACTIVE: '现场尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '本人已死亡' };
const PLACE: Record<string, string> = { START: '原封存院门口', A: '四米处原桌', B: '八米处原封条', OUTSIDE: '室外', YARD: '相邻院落', COURT: '原院内', TABLE: '四米处原桌', INTERNAL: '本人内部', SEALED: '原封存匣', RELEASED: '已永久释放', DISSIPATED: '已消散', PLAYER: '本人处', OWNER: '原物主处', SUPPLIER: '供应方处', SUPPLY: '供应方处' };
const PERMISSION: Record<string, string> = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回', CLOSED: '本次许可已结束' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const WINDOW: Record<string, string> = { NONE: '尚未尝试', ACTIVE: '判定成功，尚待实际应用', APPLIED: '已实际应用', FAILED: '判定失败', EXPIRED: '已经到期', WITHDRAWN: '撤回后已清除', STOPPED: '已经停止', MOVED: '移动后已经失效', LIGHT: '强光中断后已清除' };
const POLICIES: Record<string, string> = { INHERITED_ONLY: '只用已学能力', GUIDANCE: '允许单灵引导', SHELTER: '允许单灵护持', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };
const METHODS: Record<string, string> = { SIGNAL: '有限信号', BRIEF_WARD: '短暂护持', LOW_GLOW: '微弱照明', STEADY_HOLD: '稳定持握', SCREEN: '有限屏护' };
const SPIRIT_STATUS: Record<string, string> = { SEALED: '仍在封存', GRAZED: '已经放牧', RELEASED: '已永久释放', DISSIPATED: '已消散' };
const OLD_SPIRITS: Record<string, string> = { 'SH5-IRIS-1': '伊芮斯', 'SH5-CEDRIC-1': '塞德里克' };
const OLD_METHODS: Record<string, string> = { 'light-touch': '微力触动', 'brief-ward': '短促防护', 'blur-mark': '模糊标记', 'courage-song': '勇气歌声' };
const ENEMY_STATUS: Record<string, string> = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };

export interface DarkAngelPanelProps {
  value: DarkAngelProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: DarkAngelCommand) => void;
  /** Navigation alone never applies a window, returns an item or moves a body. */
  onClose?: (() => void) | null;
}

export function DarkAngelPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: DarkAngelPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: DarkAngelAction; facts: string } | null>(null);
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

  function choose(action: DarkAngelAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id; setConfirmation({ action, facts });
  }
  function submit(action: DarkAngelAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id; submittedFacts.current = facts; setPending(true); onCommand(action.command);
  }
  function actionControl(action: DarkAngelAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" data-action-id={action.id} disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `dark-angel-reason-${encodeURIComponent(action.id)}` : undefined} onClick={() => choose(action)}>
        <strong>{text(action.label)}</strong><span className="slice-modifiers">{text(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`dark-angel-reason-${encodeURIComponent(action.id)}`}>{text(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="暗天使当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="暗天使当前资源"><h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>健康恢复不代表旧伤已经消失。晋升与离场不会治疗伤势，也不会补满灵性、原灵灵性或耗材。</p>
      {value.injuries.some(injury => !injury.treated) && <p>仍有未经治疗的旧伤。完成现场收尾后，返回普通生活前往公共诊所，实际支付60便士治疗，并安排真正的休养。</p>}
    </section>;
  }

  return <section className="seer-panel" aria-label="暗天使成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{text(value.title)}</h2>
      <section aria-label="暗天使阶段总览">
        <p>当前阶段：{inEncounter ? `可选真实遭遇 · ${STATUS[encounter.status] ?? '当前记录'}` : value.promoted ? life.reflected ? '三份生活报告与反思已完成' : '原封存院的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p>
        <p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 暗天使扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p>
      </section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : life.reflected && !inEncounter ? '生活报告与反思已完成，可以返回普通生活；相邻院落的争议由你自行选择。' : text(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {blocked && <p role="status">请先处理当前阻塞事项，本页暂不能提交新操作。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">{value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="暗天使目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked} onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{text(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：相邻院落的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{text(bottle.title)} · {text(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="暗天使其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{text(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {originalFacts()}
      {!value.promoted ? <section aria-label="暗天使服药准备">
        <p>{text(value.digestion)}</p><p>{text(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{text(selectedBottle.title)}</h3><p>{text(selectedBottle.source)}</p><p>{text(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{text(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>指导500便士、1行动；每瓶7200便士，或为本瓶完成五项各1行动的真实劳动，获得6000便士抵额后支付1200便士。三项专业准备各1行动，当周准备另需1行动、180便士。全部原瓶失败耗尽后，补货申请另需1行动、100便士，至少到下一真实周才能到货。</p>
        <p>须从实际长老晋升周起满12整周，消化100，完成旧三份报告、反思及本次专业准备。服药需健康高于20、精神高于40，并进行意志30检定；饮用本身不耗行动。供应方交付独立成品原瓶，未掌握完整配方，不能自行调配。</p>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留长老。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{text(value.risk)}</p><p>{text(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{text(value.digestion)}</p><p>{text(value.appearanceRecord)}</p><p>{text(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{text(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{text(ability.label)} · 掌握{ability.mastery}</h3><p>{text(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{text(value.environment)}关闭页面不会代替停手、归还原卡与封条、普通步行离场；实际时间、伤势与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="暗天使操作确认" onKeyDown={event => {
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
        <p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。本阶保留姓名、性别、年龄与既有性格。原有十五项能力及其实际掌握保留，两项新能力从0开始；原记录卡、原记录、旧耗材与参与者不会复制或补充。也可取消并继续停留长老。</p></>}
      {live && ['GUIDANCE', 'SHELTER'].includes(live.command.type) && <p>{text(value.abilities.find(ability => ability.id === (live.command.type === 'GUIDANCE' ? 'hanged-man.s1.single-spirit-guidance' : 'hanged-man.s1.single-spirit-shelter'))?.description ?? '')}</p>}
      {live && 'spiritId' in live.command && <p>本次明确选定：{site.spirits[live.command.spiritId].name}；原灵现有灵性{site.spirits[live.command.spiritId].spirituality}、完整度{site.spirits[live.command.spiritId].integrity}/100。已选方法：{site.spirits[live.command.spiritId].selectedAbilities.map(method => METHODS[method]).join('、') || '尚未选择'}。资源不足、已释放或无法使用时不会自动换成另一位原灵。</p>}
      {live && 'permission' in live.command && <p>本次针对：{live.command.permission === 'OWNER' ? `${site.owner.name}对原记录卡用途的许可` : `${site.owner.name}对本次有限能力用途的许可`}。{live.command.type === 'WITHDRAW_CONSENT' ? '撤回立即停止新施法并清除未用窗口；已付代价保留，同一原卡与封条仍须亲手归还。' : '只记录本案明确同意，之后仍可以撤回。'}</p>}
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
    return <section aria-label="暗天使原人原物当前状态"><h3>同一身体、原封存院与两位原灵</h3>
      <p>本人当前在{PLACE[site.playerLocation]}；累计普通步行{site.playerTravelMetres}米，现场时钟{site.clockSeconds}秒。</p>
      <p>{site.owner.name} · {site.owner.age}岁，当前在{PLACE[site.owner.location]}，{site.owner.willing ? '仍愿意接洽' : '当前拒绝接洽'}。本阶段实际步行{life.ownerTravelMetres}米；既往同意不代替每案的两项新许可。</p>
      <p>同一原卡{site.card.id}在{PLACE[site.card.location]}，数量{site.card.quantity}，累计实际行程{site.card.travelMetres}米。原左箱在{PLACE[site.leftBox.location]}，原右箱和远端封条在{PLACE[site.farSeal.location]}。</p>
      <p>原灯{site.lamp.on ? '已开启' : '已关闭'}；原遮板{site.shutter.state === 'CLOSED' ? '已关闭' : '已打开'}，控制绳仍长{site.shutter.cordMetres}米，控制端在{PLACE[site.shutter.controlAt]}。</p>
      <p>原残留仍被封存，基础压力{life.operation.residualPressure}，原封条实际磨损{life.operation.sealWear}。旧三份耗材：{life.operation.materials.map(material => `${material.id}${material.status === 'RETURNED' ? '已归还' : '在' + PLACE[material.location]}，剩余${material.charges}次，已耗${material.spentCharges}次`).join('；')}。</p>
      <section aria-label="两位原灵的当前余量"><h4>实际来源与已选方法</h4>
        {Object.values(site.spirits).map(spirit => <section key={spirit.id}><h5>{spirit.name} · {spirit.age}岁</h5>
          <p>{SPIRIT_STATUS[spirit.status]}，当前在{PLACE[spirit.location]}；原灵灵性{spirit.spirituality}，完整度{spirit.integrity}/100，实际行程{spirit.travelMetres}米。</p>
          <p>已选方法：{spirit.selectedAbilities.map(method => METHODS[method]).join('、') || '尚未选择'}。{spirit.interrupted ? '既往中断记录保留。' : '没有已记录的中断。'}</p>
        </section>)}
        <p>只使用明确选中的一位原灵及其已有方法。单灵引导需要有限信号，单灵护持需要短暂护持或有限屏护；一次原灵至少需3灵性。缺失、耗尽、已释放或已消散的来源不会补造。</p>
      </section>
      {encounter.grazing && <section aria-label="旧放牧来源的当前记录"><h4>旧来源与本人借用</h4>
        <p>当前借用来源：{encounter.grazing.activeSpiritId ? OLD_SPIRITS[encounter.grazing.activeSpiritId] ?? '已记录原灵' : '没有启用'}。</p>
        <ul>{encounter.grazing.spirits.map(spirit => <li key={spirit.id}>{OLD_SPIRITS[spirit.id] ?? '已记录原灵'}：{SPIRIT_STATUS[spirit.status] ?? '尚未放牧'}；实际已选方法{spirit.selectedAbilities.map(method => OLD_METHODS[method] ?? '已记录方法').join('、') || '无'}{spirit.releasedWeek !== null ? `；第${spirit.releasedWeek}周永久释放` : ''}。</li>)}</ul>
      </section>}
      {encounter.reserve && <section aria-label="旧血肉储备与实际份额"><h4>原储备继续使用</h4>
        <p>现有血肉储备{encounter.reserve.points}/{encounter.reserve.max}；已购买{encounter.reserve.packetsBought}份，现有记录{encounter.reserve.packets.length}份，其中已耗用{encounter.reserve.packets.filter(packet => packet.status === 'CONSUMED').length}份。晋升不会重置已用份额或补满储备。</p>
      </section>}
      <p>旧伊芮斯与其实际余量、塞德里克的永久释放、独立影体及旧对手的撤退经历继续保留。总放牧容量仍为7，最多外放两灵，本人一次只借一灵；晋升不增加魂灵库存。</p>
    </section>;
  }

  function lifeFacts() {
    const attempt = selectedCase?.id === life.activeCase ? life.currentAttempt : selectedCase?.attempts.at(-1);
    const current = selectedCase?.id === life.activeCase && !!selectedCase?.contactOpen && !!attempt && !attempt.closed;
    const strip = life.strips.find(entry => entry.caseId === selectedCase?.id);
    const pendingWindow = current && life.pending?.caseId === selectedCase?.id ? life.pending : null;
    const permitted = (permission: 'OWNER' | 'ABILITY') => {
      const state = selectedCase?.permission[permission] ?? 'UNASKED';
      return state === 'GRANTED' && (selectedCase?.status === 'EXAMINED' || selectedCase?.status === 'RESOLVED') ? '本案曾明确同意，当前已经结束' : PERMISSION[state];
    };
    return <section aria-label="暗天使生活练习"><h3>{text(selectedCase?.title ?? life.title)}</h3><p>{text(selectedCase?.story ?? life.story)}</p>
      {selectedCase?.result && <p className="slice-notice">{text(selectedCase.result)}</p>}
      {attempt && !current && <p>以下尝试是当次已保存经历；人物、原灵与原物的当前位置以上方当前事实为准。</p>}
      <section aria-label="当前时钟与一次能力窗口"><h4>实际时间与下一次作用</h4>
        <p>现场时钟{life.clockSeconds}秒；{attempt ? `本次实际经过${attempt.elapsedSeconds}秒。` : '本案尚无实际尝试。'}页面停留不会推进现场，等待须提交实际等待动作。</p>
        {pendingWindow ? <><p>{pendingWindow.abilityId === 'hanged-man.s1.single-spirit-guidance' ? '单灵引导' : '单灵护持'}窗口：从{pendingWindow.createdAt}秒至{pendingWindow.expiresAt}秒，还剩{life.pendingRemainingSeconds}秒。</p>
          <p>来源为{pendingWindow.sourceSpirit.name}的{METHODS[pendingWindow.selectedMethod]}，只针对{pendingWindow.cardId}、本案封条{pendingWindow.stripId}与第{pendingWindow.permissionVersion}次许可，位置为{PLACE[pendingWindow.location]}。开窗尚不等于实际应用。</p></>
          : <p>当前没有尚未耗用的能力窗口。成功施放、实际应用、失败、到期与停止分别记录。</p>}
        <p>每次支付本人8灵性、2精神及选定原灵3灵性，按知识18检定；失败总共损失4精神。成功窗口最长20秒，一次只能保留一个。移动、停止、撤回、强光或到期使未用窗口失效；已付成本不退。</p>
        {attempt && <p>本次检定：{attempt.castTier === null ? '尚未尝试' : TIER[attempt.castTier]}。{attempt.selectedSpiritId ? `选定${site.spirits[attempt.selectedSpiritId].name}，方法${attempt.selectedMethod ? METHODS[attempt.selectedMethod] : '尚未选择'}。` : '尚未选择本次施法原灵。'}窗口记录：{WINDOW[attempt.windowEnd]}。{attempt.withdrawn ? '本次许可已撤回。' : ''}{attempt.stopped ? '方法已经停止。' : ''}实际应用{attempt.appliedAbilityIds.length}项。</p>}
      </section>
      <section aria-label="本案的独立许可"><h4>原物用途与能力用途分别同意</h4><ul>
        <li>{site.owner.name}对本案原物用途的许可：{permitted('OWNER')}。</li>
        <li>{site.owner.name}对本案有限能力用途的许可：{permitted('ABILITY')}。</li>
      </ul><p>每案重新询问，可分别拒绝或撤回。原物主须实际从室外步行2米到门口；撤回清除未用窗口，不退款、不替人离场。普通方法仍可完成本案观察与收尾。</p></section>
      <section aria-label="本案有限封条"><h4>一份实际购买的新封条</h4>
        {strip ? <p>{strip.id}，数量{strip.quantity}，已实付{strip.paidPennies}便士；{strip.status === 'RETURNED' ? '已经归还' : '本人携带'}，当前在{PLACE[strip.location]}，剩余{strip.charges}次，实际磨损{strip.wear}，累计随行{strip.travelMetres}米。</p>
          : <p>尚未取得本案封条。准备需1行动、20便士，只购买本案一份一次新封条；旧耗材的余量保持原样。</p>}
        <p>成功开窗尚不耗用封条；实际能力应用才消耗1次并留下1点磨损。失败、撤回或到期不增加掌握，封条余量按实际应用保留，收尾仍须交还。</p>
      </section>
      <section aria-label="有限效果的实际测量"><h4>同一原卡、同一封存压力</h4>
        <p>单灵引导只让下一次实际阅读同一原卡的质量由3改善到6。单灵护持只让一次处理原封存压力时的局部承受压力由3减至1；原残留基础压力仍为3，原封存继续存在。</p>
        {attempt && <p>实际阅读质量{attempt.readingQuality}；本次操作基准压力{attempt.baselinePressure}，实际承受压力{attempt.feltPressure}。0表示尚无这次实际测量；普通方法按实际结果记录，不补发能力效果。</p>}
        <p>第三案先尝试单灵引导，再实际撤回未用窗口并走普通方法；已经支付的成本保留。本案原成年人不会因这些测量遭受身体或精神伤害。</p>
      </section>
      <section aria-label="实际位置与普通退出"><h4>停止、归物与普通离场</h4>
        {attempt && <><p>本次实耗本人{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神，原灵{attempt.spiritSpiritualitySpent}灵性、{attempt.spiritIntegrityLost}完整度；本人实走{attempt.playerTravelMetres}米，原物主实走{attempt.ownerTravelMetres}米，实际经过{attempt.elapsedSeconds}秒。</p>
          <p>{attempt.returned ? '本案封条已经亲手交还。' : '本案封条尚未交还。'}{attempt.closed ? '本次接触已经实际结束。' : '仍须完成普通返程与本次交接。'}</p></>}
        <p>门口至原桌4米、原桌至原封条4米；同一原卡在原桌取用并交还。停止后本人普通返回门口，关好原灯与遮板，归还本案封条；原物主再实际走2米回到室外，然后报告。</p>
        <p>原灯与遮板造成的强光会让实际受影响原灵损失20完整度并清除窗口。关闭光源不会抹去这笔伤害或既往中断。</p>
      </section>
      <details className="seer-fold"><summary>三案报告、反思与普通替代</summary><ul>{life.cases.map(entry => <li key={entry.id}>{text(entry.title)}：{STATUS[entry.status] ?? '当前记录'}{entry.result ? `；${text(entry.result)}` : ''}。</li>)}</ul>
        <p>{life.reflected ? '三案报告与反思已保存，无需继续购买材料。' : '每份真实报告消化25，三案之后反思另消化25；仅实际应用过的对应新能力在报告时增加掌握8。旧十五项掌握保持实际记录。'}</p>
        <ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{text(entry)}</li>)}</ul><p>{text(life.environment)}</p>
      </details>
    </section>;
  }

  function operationFacts(command: DarkAngelCommand) {
    switch (command.type) {
      case 'LEARN_GUIDANCE': return <p>支付500便士、1行动，了解封存院交接处的独立成品渠道与准备要求。指导不提供完整配方，也不自动取得或饮用原瓶。</p>;
      case 'POTION_WORK': return <p>只为所选独立原瓶完成一次真实劳动，消耗1行动。五项劳动合计抵6000便士，之后另付1200便士取得本瓶。</p>;
      case 'BUY_POTION': return <p>按本瓶当前列明价格，只领取这一独立成品原瓶。领取不代替准备与另行确认饮用。</p>;
      case 'REQUEST_SUPPLY': return <p>本批原瓶全部耗尽后，另付100便士、1行动申请下一批三瓶，至少跨一真实周才可接收。每瓶仍须分别劳动或付费取得。</p>;
      case 'PREPARE_PROMOTION': return <p>支付180便士、1行动检查本周服药场地。结束准备不退款；原瓶只有另行确认饮用时才耗尽。</p>;
      case 'LEAVE_PREPARATION': return <p>结束当周准备，保留未服用的原瓶。已付检查费不退，下次需重新准备。</p>;
      case 'PREPARE': return <p>本案支付20便士、1行动购买一份一次封条。{command.method === 'ORDINARY' ? '选择普通方法，如实完成阅读或压力处理，不奖励未发生的能力效果。' : '准备不施法，仍须真实到达原封条，明确选定原灵并实际应用。'}旧封存耗材和原灵余量不会补充。</p>;
      case 'GUIDANCE': case 'SHELTER': return <p>支付本人8灵性、2精神和选定原灵3灵性，按知识18检定，失败总损失4精神。成功只开启20秒的一次窗口，实际应用再消耗本案封条一次并留下1点磨损。停止、失败或撤回不会退款。</p>;
      case 'READ_ORIGINAL': return <p>本人须带着同一原卡实际到达原封条处，完成真实阅读。普通阅读质量3，有效单灵引导只将这一次提高到6。</p>;
      case 'PERFORM_OPERATION': return <p>实际处理原残留的一次封存压力。基础压力3，有效单灵护持只将本次局部承受压力减至1，原残留及基础压力不被消除。</p>;
      case 'WAIT_10': return <p>现场实际经过10秒，未用窗口可能到期。页面停留不会自行推进时钟，等待不返还行动或已付成本。</p>;
      case 'STOP_METHOD': return <p>停止本次方法并清除未用窗口，保留成本与磨损；之后仍须普通返回、亲手归还原卡及新封条。</p>;
      case 'RETURN_TO_A': return <p>本人携同一原卡，从原封条沿4米普通路返回原桌，未用窗口失效。已经支付的时间与原灵成本保留。</p>;
      case 'RETURN_CARD': return <p>在四米处原桌亲手归还同一原卡，数量仍为1；原卡的实际行程和既有记录继续保留。</p>;
      case 'RETURN_TO_ENTRY': return <p>本人从原桌沿4米普通路返回门口，已付成本、磨损和实际时间保留。</p>;
      case 'RETURN_STRIP': return <p>将本案同一份新封条亲手归还原物主，剩余次数和真实磨损继续保留，不能换取全新封条。</p>;
      case 'LEAVE': return <p>本人已经实际返回门口，完成归物与现场收尾后，原物主沿2米普通路回到室外。结束接触不治疗旧伤，也不补充灵性或耗材。</p>;
      case 'ABORT': return <p>停止本次方法并清除窗口，按实际位置普通返程、归还原卡和本案封条、关闭原灯与遮板。已付成本和真实行程继续保留。</p>;
      case 'REPORT': return <p>只报告已经发生且真实收尾的结果。每份报告消化25，只有实际应用的对应新能力增加掌握8；失败或未用窗口不增加掌握。</p>;
      case 'REFLECT': return <p>三案分别报告后进行一次反思，消化25。撤回和普通完成如实保留，不补发未发生的能力效果。</p>;
      case 'PREPARE_ENCOUNTER': return <p>另付30便士、1行动，实际取得本场三次封条。不会补满旧耗材、原灵或本人身心资源，也不自动开始交战。</p>;
      case 'SET_COMBAT_SPIRIT': return <p>只保存本场明确选中的原灵，不施法、不消耗资源，也不自动选择另一位。新能力仍要求该原灵拥有已选方法和足够灵性。</p>;
      case 'ENCOUNTER_TALK': return <p>本人从原门口沿4米普通路进入相邻院落交谈，不自动开战。玛拉须实际在室外；旧巴斯蒂安与布拉姆的撤退记录不变。</p>;
      case 'LEAVE_ENCOUNTER': return <p>本人沿普通出口实际走4米返回原门口。原身体、旧伤、对手状态、原灵消耗与有限印记继续保留。</p>;
      default: return null;
    }
  }

  function encounterFacts() {
    const { enemy, note, marks } = encounter;
    const remainingMarks = marks.filter(mark => mark.status === 'HELD').length;
    const selectedSpirit = encounter.selectedSpiritId ? site.spirits[encounter.selectedSpiritId] : null;
    return <section aria-label="暗天使可选真实交战"><h3>{text(encounter.title)} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{text(encounter.story)}</p>
      {enemy && <><p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。这是有独立身体与意愿的新对手，旧巴斯蒂安与布拉姆的经历仍完整保留。</p>
        <section aria-label="战场位置与普通出口"><h4>真实位置与普通退路</h4><p>本人当前在{PLACE[site.playerLocation]}；{enemy.name}在{PLACE[enemy.position]}，{site.playerLocation === 'YARD' ? `当前相距${enemy.distanceMetres}米。` : '本人尚未在该交战位置与他接触。'}累计本人实走{site.playerTravelMetres}米，现场时钟{site.clockSeconds}秒。</p>
          <p>{site.owner.name}当前在{PLACE[site.owner.location]}。她须实际在室外且旧现场收束，才能进入本场。生还者沿普通出口实走4米，死亡的身体保留在实际位置。</p></section>
        <section aria-label="对手原棍与有限印记"><h4>一根原棍，三枚有限印记</h4><p>原棍{enemy.weaponId}{enemy.weaponLocation === 'HAND' ? `仍在${enemy.name}手中` : '留在相邻院落地面'}。印记剩余{remainingMarks}/{marks.length}枚，已耗尽{marks.length - remainingMarks}枚，不自动补充。</p>
          <p>有限弧光已用{enemy.powerUses.ARC_BOLT}次，有限惊惧印记已用{enemy.powerUses.DREAD_MARK}次，屏护已用{enemy.powerUses.WARD}次，假动作已用{enemy.powerUses.FEINT}次。弧光和惊惧各耗7灵性及一枚印记，分别作用于身体和精神；屏护耗4灵性，假动作耗3灵性。</p>
        </section></>}
      <section aria-label="对手当前能力盘"><h4>对手的实际能力盘</h4>
        <ul>{encounter.enemyAbilityWheel.map(entry => <li key={entry.id}>{text(entry.label)} · 权重{entry.weight}</li>)}</ul>
        <p>印记或灵性不足时按对应普通行动结算，不能重复消耗已经耗尽的印记。</p>
      </section>
      <section aria-label="开战前的能力策略"><h4>先明确本场策略与单一原灵</h4><p>当前策略：{POLICIES[encounter.policy]}。开战前可以改变，选择本身不施法、不购买物品、不自动开战。</p>
        <p>选定原灵：{selectedSpirit ? `${selectedSpirit.name}，现有灵性${selectedSpirit.spirituality}、完整度${selectedSpirit.integrity}/100` : '尚未明确选择'}。不自动替换缺失、释放或耗尽的原灵；条件不足时按普通行动处理。</p></section>
      <section aria-label="暗天使战斗封条"><h4>本场单独付费的三次封条</h4>
        {note ? <p>{note.id}：已实付{note.paidPennies}便士，当前由本人持有，剩余{note.charges}/{note.initialCharges}次，实际磨损{note.wear}。</p>
          : <p>本场封条尚未取得。可另付30便士、1行动购买一份三次封条；旧封存耗材及原灵余量不会补充。</p>}
        <p>只有实际作用于下一次攻击或防护，才消耗同一封条一次并留下1点磨损。失败、到期或未应用不返还施法成本，不增加掌握。</p>
      </section>
      <section aria-label="实战的有限能力"><h4>一次真实作用的有限帮助</h4><p>单灵引导为20秒内同位置、同一可见对手的下一次真实普通攻击增加35。单灵护持只减轻下一次可见的身体或精神冲击30，各只能应用一次，一次只有一个新窗口。</p>
        <p>每次施放消耗本人8灵性、2精神、选定原灵3灵性及5秒，按知识18检定；失败总损失4精神。每轮60秒，移动、遮挡、假动作、强光或到期清除未用窗口；强光使实际受影响原灵损失20完整度。</p>
        <p>能力只协调已经取得且选择过方法的这一位原灵，不带来额外灵魂、普遍免伤或支配其他灵的权限。</p><p>{text(value.inheritedTools)}</p></section>
      <details className="seer-fold"><summary>交战消耗、抵抗与实际时间记录</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{text(fact)}</li>)}</ul></details>
    </section>;
  }
}
