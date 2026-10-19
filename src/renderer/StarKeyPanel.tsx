import { useEffect, useRef, useState } from 'react';
import type { StarKeyAction, StarKeyCommand, StarKeyProjection } from '../domain/star-key/types.js';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const COMMON = new Set(['ABORT', 'LEAVE', 'WITHDRAW_CONSENT', 'DECLINE_CONSENT', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER', 'STOP_METHOD', 'RETURN_PARCEL', 'CLOSE_DOOR', 'WALK_ENTRY', 'EXIT_ROOM']);
const STATUS: Record<string, string> = { AVAILABLE: '尚未开始', OBSERVED: '已观察', PREPARED: '已准备', PAUSED: '已中止，待普通续办', ACTIVE: '尚未收束', EXAMINED: '待报告', READY: '已到场', FIGHTING: '正在交战', RESOLVED: '已收束', RETREATED: '已撤退', LOST: '已结束' };
const ENEMY_STATUS = { RESISTING: '仍可抵抗', SURRENDERED: '已投降', DEAD: '已死亡' };
const TIER = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const PERMISSION = { UNASKED: '尚未询问本次许可', GRANTED: '当前明确同意', DECLINED: '已拒绝', WITHDRAWN: '已经撤回', CLOSED: '本次许可已结束' };
const WINDOW = { NONE: '尚未尝试', ACTIVE: '等待实际应用', FAILED: '判定失败', CHECK_FAILED: '后续独立操作失败', APPLIED: '已经实际应用', STOPPED: '已经停止', EXPIRED: '已经到期', INVALIDATED: '条件改变，已经失效' };
const POLICIES = { INHERITED_ONLY: '只用已学能力', ENDPOINT_LOCATION: '允许端点定位', ANCHOR_MAINTENANCE: '允许锚点维系', ALL: '允许两项新能力', ORDINARY: '只作普通行动' };

export interface StarKeyPanelProps {
  value: StarKeyProjection;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
  onCommand: (command: StarKeyCommand) => void;
  onClose?: (() => void) | null;
}

/** The view never changes resources or manufactures commands: it submits a current public action verbatim. */
export function StarKeyPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: StarKeyPanelProps) {
  const [goal, setGoal] = useState<string | null>(null);
  const [extraId, setExtraId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: StarKeyAction; facts: string } | null>(null);
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

  function choose(action: StarKeyAction) {
    if (locked || confirmation || submitted.current !== null || !action.enabled) return;
    returnActionId.current = action.id;
    setConfirmation({ action, facts });
  }
  function submit(action: StarKeyAction) {
    if (locked || submitted.current !== null || !action.enabled || !live || live.id !== action.id || confirmation?.facts !== currentFacts.current) return;
    submitted.current = action.id;
    submittedFacts.current = facts;
    setPending(true);
    onCommand(action.command);
  }
  function actionControl(action: StarKeyAction) {
    return <div key={action.id} className="seer-action magician-compact-action">
      <button className="slice-choice" disabled={locked || confirmation !== null || !action.enabled}
        ref={node => { if (node) actionButtons.current.set(action.id, node); else actionButtons.current.delete(action.id); }}
        aria-describedby={action.reason ? `star-key-reason-${action.id}` : undefined} onClick={() => choose(action)}>
        <strong>{copy(action.label)}</strong><span className="slice-modifiers">{copy(action.cost)}</span>
      </button>
      {action.reason && <p className="seer-action-reason" id={`star-key-reason-${action.id}`}>{copy(action.reason)}</p>}
    </div>;
  }
  function resources() {
    const current = value.resources;
    if (!current) return <section aria-label="星之匙当前资源"><h3>身体与资源</h3><p>当前没有可核对的本人资源记录，暂不提交操作。</p></section>;
    return <section aria-label="星之匙当前资源">
      <h3>身体与资源</h3><p>{value.characterName}</p>
      <p>健康{current.health}/{current.maxHealth} · 精神{current.mind}/{current.maxMind} · 灵性{current.spirituality}/{current.maxSpirituality} · 排异{value.pollution}</p>
      <p>{current.cash} · 本周行动{current.actionsRemaining} · 现有伤势{value.injuries.length}处 · 累计风险{value.injuryRisk}</p>
      {value.injuries.length > 0 && <ul>{value.injuries.map((injury, index) => <li key={injury.id}>伤势{index + 1}：{injury.severity === 'HEAVY' ? '重伤' : '轻伤'} · {injury.treated ? '已经实际治疗' : '尚未治疗'}</li>)}</ul>}
      <p>晋升、停止与归还原物不会免费恢复身体，也不会返还已付灵性、精神或费用。</p>
    </section>;
  }

  return <section className="seer-panel" aria-label="星之匙成长" aria-busy={busy || pending}>
    <div inert={confirmation !== null}>
      <h2 ref={heading} tabIndex={-1}>{copy(value.title)}</h2>
      <section aria-label="星之匙阶段总览"><p>当前阶段：{inEncounter ? '可选真实遭遇' : value.promoted ? life.reflected ? '生活报告与反思已完成' : '原通行室的三项实践' : value.preparedWeek !== null ? '当周准备已支付，选择原瓶' : value.guidanceKnown ? '完成准备与取得原瓶' : '了解成品魔药渠道'}。</p><p>{value.promoted ? `生活报告${life.cases.filter(entry => entry.status === 'RESOLVED').length}/3 · 反思${life.reflected ? '已完成' : '尚未完成'} · 星之匙扮演${value.acting}/100` : `专业准备${value.preparations.filter(entry => entry.completedWeek !== null).length}/3`}</p></section>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 ? '本周目已经死亡，原身体、原人物与原物记录只读保留。' : copy(next?.label ?? value.nextStep)}</p>
      {error !== null && <p role="alert">{error}。当前仍显示上次已保存的记录，请用页面的重试操作处理同一次保存，勿再次提交。</p>}
      {(busy || pending) && error === null && <p role="status">正在结算并保存这一次操作，请稍候。</p>}
      {resources()}
      {!inside && onClose && <button className="slice-button quiet" disabled={locked || confirmation !== null} onClick={() => { if (!locked && !confirmation) onClose(); }}>返回普通生活</button>}
      <label className="seer-case-selector">
        {value.promoted ? '选择生活练习或可选遭遇' : '选择独立原瓶'}
        <select aria-label="星之匙目标" value={value.promoted ? inEncounter ? 'encounter' : selectedCase?.id ?? '' : selectedBottle?.id ?? ''}
          disabled={selectionLocked}
          onChange={event => { if (!selectionLocked) { setGoal(event.target.value); setExtraId(null); } }}>
          {value.promoted ? <>{life.cases.map(entry => <option key={entry.id} value={entry.id}>{copy(entry.title)} · {STATUS[entry.status] ?? '当前记录'}</option>)}<option value="encounter">可选：通行室外的交谈与争议</option></>
            : value.bottles.map(bottle => <option key={bottle.id} value={bottle.id}>{copy(bottle.title)} · {copy(bottle.status)}</option>)}
        </select>
      </label>
      {next && <section aria-label="当前主要操作"><h3>当前操作</h3>{actionControl(next)}</section>}
      {common.length > 0 && <section aria-label="恢复与收尾"><h3>恢复与收尾</h3>{common.map(actionControl)}</section>}
      {alternatives.length > 0 && <details className="seer-fold"><summary>其他操作与普通替代</summary>
        <label className="seer-case-selector">选择其他操作<select aria-label="星之匙其他操作" value={extra?.id ?? ''} disabled={locked || confirmation !== null} onChange={event => { if (!locked && confirmation === null) setExtraId(event.target.value); }}>
          {alternatives.map(action => <option key={action.id} value={action.id}>{copy(action.label)}{action.enabled ? '' : ' · 暂不可用'}</option>)}
        </select></label>{extra && actionControl(extra)}
      </details>}
      {originalFacts()}
      {!value.promoted ? <section aria-label="星之匙服药准备">
        <p>{copy(value.digestion)}</p><p>{copy(value.supplies)}</p>
        {selectedBottle && <section aria-label="独立原药瓶"><h3>{copy(selectedBottle.title)}</h3><p>{copy(selectedBottle.source)}</p><p>{copy(selectedBottle.status)} · 当前成功率{selectedBottle.chance}%</p></section>}
        <ul>{value.preparations.map(preparation => <li key={preparation.taskId}>{copy(preparation.title)}：{preparation.completedWeek === null ? '尚未完成' : `第${preparation.completedWeek}周已完成`}</li>)}</ul>
        <p>当周场地检查：{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周已支付，结束准备不退款`}。也可继续停留旅法师。</p>
        <details className="seer-fold"><summary>服药条件、失败代价与身体记录</summary><p>{copy(value.risk)}</p><p>{copy(value.appearanceRecord)}</p></details>
      </section> : inEncounter ? encounterFacts() : lifeFacts()}
      <details className="seer-fold"><summary>能力、消化与继承经历</summary>
        <p>{copy(value.digestion)}</p><p>{copy(value.appearanceRecord)}</p><p>{copy(value.inheritedTools)}</p>
        <ul>{value.inheritedHistory.map((entry, index) => <li key={index}>{copy(entry)}</li>)}</ul>
        {value.abilities.map(ability => <section key={ability.id}><h3>{copy(ability.label)} · 掌握{ability.mastery}</h3><p>{copy(ability.description)}</p></section>)}
      </details>
      <p className="seer-small-note">{copy(value.environment)}关闭页面不会代替停止作用、归还原物与沿原路离开；已经发生的事件与已付代价保留。</p>
    </div>
    {confirmation && <section className="seer-current-case" role="dialog" aria-modal="true" aria-label="星之匙操作确认" onKeyDown={event => {
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
        <p>{copy(value.risk)}</p><p>确认饮用所选原瓶。成功与失败均实际耗尽这一瓶及本次准备，失败保留已付代价。本阶不改变性别、姓名、年龄、性格与取向。也可取消并继续停留旅法师。</p></>}
      {live?.command.type === 'ENDPOINT_LOCATION' && <p>本次消耗8灵性、2精神，感知18。只有亲眼观察当前两端并通过判定，才会留下20秒内的一次有限线索；仍须另行普通步行4米核验。施放本身不移动身体或原包，也不增加掌握。失败、条件变化、未应用或到期均保留已付代价。</p>}
      {live?.command.type === 'ANCHOR_MAINTENANCE' && <p>本次消耗7灵性、2精神，知识18。通过判定后，只维系当前已知两端20秒，仍须另行携带同一原包普通步行4米才算实际应用。不是传送；到期或撤回不会自动带回身体与原包。</p>}
      {live?.command.type === 'INVITE' && <p>本次邀请的行动与费用按上方记录实际支付；每案重新确认场地、参与及能力许可。拒绝、撤回或中途停止不退已付费用。</p>}
      {live?.command.type === 'WITHDRAW_CONSENT' && <p>撤回会停止新施法与未用窗口，已付代价与真实结果保留。仍须普通步行归还同一原包、亲手关闭原遮门，再与玛拉实际离场。</p>}
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
    const { site } = life;
    const place = { ENTRY: '原入口', NEAR: '近台', FAR: '远台', OUTSIDE: '通行室外', REMOTE: '异星原地点' };
    const parcelPlace = { ENTRY_STAND: '原入口架上', PLAYER: '本人手中', REMOTE_STAND: '异星原架上' };
    const door = { CLOSED: '已关闭', OPEN: '已亲手打开', BLOCKED: '被门闩阻挡' };
    return <details className="seer-fold"><summary>原通行室、玛拉与旧物当前记录</summary>
      <section aria-label="原通行室当前状态"><h3>同一通行室、同一原封包</h3>
        <p>{site.operatorName} · {site.operatorAge}岁，当前在{place[site.operatorLocation]}，精力{site.operatorEnergy}/100，累计实走{site.operatorMetres}米。现场协调许可：{PERMISSION[site.operatorConsent]}{site.operatorConsentWeek === null ? '。' : `，第${site.operatorConsentWeek}周记录。`}</p>
        <p>本人当前在{place[site.playerLocation]}，累计普通步行{site.playerMetres}米、既往异星行程{site.playerAstralLegs}程。入口到近台2米，近台到远台4米；室外普通出口距入口2米。</p>
        <p>唯一原封包仍归本人所有，数量{site.parcel.quantity}，现在{parcelPlace[site.parcel.location]}；累计普通搬运{site.parcel.ordinaryMetres}米、既往异星行程{site.parcel.astralLegs}程。拿起与归还都操作同一原件。</p>
        <p>原遮门{door[site.door.state]}，累计实际操作{site.door.operations}次。原油灯余油{site.lamp.oilRemaining}份，已实际展示{site.lamp.shows}次；原屏{site.screen.state === 'BLANK' ? '空白' : '保留已比对记录'}，已实际应用{site.screen.applications}次。</p>
        <p>原两套路线护具均保留当前余量：{Object.values(site.kits).map(kit => `${kit.protectionSeconds}秒（${kit.status === 'ARCHIVED' ? '已归档' : kit.status === 'PLAYER' ? '实际持有' : '由供给方保管'}）`).join('、')}。打开页面与晋升都不补充原物。</p>
        <p>当前身体：{value.currentGender === 'FEMALE' ? '女性' : value.currentGender === 'MALE' ? '男性' : '按本人记录'}。姓名、性别、年龄、性格与取向不变；过去的死亡与已经发生的伤害保留。</p>
      </section>
    </details>;
  }

  function encounterFacts() {
    const { enemy, scene, materials } = encounter;
    const remainingMarks = materials.marks.filter(mark => mark.status === 'HELD').length;
    return <section aria-label="星之匙可选真实交战">
      <h3>{encounter.title} · {STATUS[encounter.status] ?? '当前记录'}</h3><p>{encounter.story}</p>
      <p>{enemy.name} · {enemy.age}岁；健康{enemy.health}/100、精神{enemy.mind}/100、灵性{enemy.spirituality}/120 · {ENEMY_STATUS[enemy.status]}。他保有独立身体与意愿。</p>
      <section aria-label="开战前的能力策略"><h4>先明确本场策略</h4>
        <p>当前策略：{POLICIES[encounter.policy]}。{encounter.policyConfirmed ? '本场明确选择已经保存。' : '等待本场明确选择，默认显示不代表已经确认。'}开战后不能更换。</p>
        <p>可只用已学能力、只允许端点定位、只允许锚点维系、允许两项新能力，或只作普通行动。选择只保存策略，不施法、不购买材料，也不开始战斗。</p>
      </section>
      <section aria-label="战场位置与普通出口"><h4>可见动作与普通退路</h4>
        <p>本人在{scene.playerLocation === 'YARD' ? '通行室外前庭内' : '前庭外原路'}，与{enemy.name}相距{Math.abs(scene.enemyCoordinate - scene.playerCoordinate)}米；本人累计实走{scene.playerTravelMetres}米，对手累计实走{scene.enemyTravelMetres}米，现场经过{scene.clockSeconds}秒。普通出口开放，生还离场须实际走过4米。</p>
        <p>当前动作路线{scene.visibleBodyLine ? '可见' : '被遮挡'}，现场条件版本{scene.conditionVersion}；{scene.observedConditionVersion === null ? '尚无本场实际观察' : `最近实际观察版本${scene.observedConditionVersion}`}。端点改变或被遮挡后，须重新观察。</p>
        <p>{life.site.operatorName}须先实际离开本场，生活许可不涵盖战斗。索伦与其他旧人的原身体、原物和结局独立保留。</p>
      </section>
      <section aria-label="对手原棍与有限印记"><h4>原棍与三枚有限印记</h4>
        <p>同一原棍{materials.weapon.location === 'HAND' ? '仍在对手手中' : '已落在前庭地面'}。原印记剩余{remainingMarks}/3枚，已耗尽{materials.marks.length - remainingMarks}枚；每次空间或精神标记实际耗7灵性及一枚原印记。耗尽后以原棍普通行动，不自动补充。</p>
        <p>已实际使用空间标记{enemy.powerUses.SPATIAL_MARK}次、精神标记{enemy.powerUses.MENTAL_MARK}次，改变位置与遮挡{enemy.powerUses.FEINT}次。身体与精神后果分别结算。</p>
      </section>
      <section aria-label="实战的有限能力"><h4>只影响之后的一次真实动作</h4>
        <p>端点定位：8灵性、2精神，感知18，须实际观察当前目标与位置并通过抵抗。20秒内只为同条件下随后一次自己的合格独立动作增加30优势。</p>
        <p>锚点维系：7灵性、2精神，知识18，须亲眼观察尚未结算的空间或精神标记与已知当前端点。20秒内只削弱随后一次合格作用30；不能挡普通棍击，也不改写已经结算的攻击。</p>
        <p>窗口不冻结对手或跳过回合。到期、移位、遮挡或退出使未用窗口失效；失败或未实际应用不增加掌握，停止不退费用。</p>
        <p>{value.inheritedTools}</p>
      </section>
      <details className="seer-fold"><summary>交战消耗、抵抗与有限窗口</summary><ul>{encounter.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul></details>
    </section>;
  }

  function lifeFacts() {
    const { site } = life;
    const attempt = selectedCase?.attempts.at(-1);
    const current = selectedCase?.id === life.activeCase && selectedCase.contactOpen && !!attempt && !attempt.closed;
    const permissionText = (permission: keyof typeof PERMISSION) => permission === 'GRANTED' && !current ? '本案曾明确同意，当前无生效许可' : PERMISSION[permission];
    const place = { ENTRY: '原入口', NEAR: '近台', FAR: '远台', OUTSIDE: '通行室外', REMOTE: '异星原地点' };
    const pendingWindow = life.pending;
    // The public projection owns physical, permission, sightline and expiry checks.
    const seconds = life.pendingRemainingSeconds;
    const activeWindow = current && life.pendingUsable && pendingWindow?.caseId === selectedCase.id;
    const endpointOpen = activeWindow && pendingWindow.kind === 'ENDPOINT' && attempt.endpoint.state === 'ACTIVE' && attempt.endpoint.remainingSeconds > 0;
    const anchorOpen = activeWindow && pendingWindow.kind === 'ANCHOR' && attempt.anchor.state === 'ACTIVE' && attempt.anchor.remainingSeconds > 0;
    const spent = life.ledger.reduce((total, receipt) => ({
      actions: total.actions + Math.max(0, receipt.before.actions - receipt.after.actions),
      cash: total.cash + Math.max(0, receipt.before.cash - receipt.after.cash),
      spirituality: total.spirituality + Math.max(0, receipt.before.spirituality - receipt.after.spirituality),
      mind: total.mind + Math.max(0, receipt.before.mind - receipt.after.mind),
    }), { actions: 0, cash: 0, spirituality: 0, mind: 0 });
    return <section aria-label="星之匙生活练习">
      <h3>{selectedCase?.title ?? life.title}</h3><p>{selectedCase?.story ?? life.story}</p>
      {selectedCase?.result && <p className="slice-notice">{selectedCase.result}</p>}
      <section aria-label="本案的独立许可"><h4>分别确认本次许可</h4>
        <p>{site.operatorName} · {site.operatorAge}岁，当前在{place[site.operatorLocation]}，精力{site.operatorEnergy}/100；{current && life.maraPresent ? '正在参与本次练习' : '目前没有参与中的邀请'}。她保有自己的决定。</p>
        <ul><li>原物与场地许可：{permissionText(attempt?.permission.owner ?? 'UNASKED')}。</li>
          <li>玛拉本次参与许可：{permissionText(attempt?.permission.operator ?? 'UNASKED')}。</li>
          <li>本人使用能力：{permissionText(attempt?.permission.ability ?? 'UNASKED')}。</li></ul>
        <p>每次邀请10便士、1行动，每案重新取得许可；拒绝或撤回不退款。自己的决定不能替代玛拉同意；撤回会停止新施法与未用窗口，普通归还和退出仍可继续。</p>
      </section>
      <section aria-label="实际位置与归还"><h4>同一身体、唯一原包与普通退路</h4>
        <p>本人在{place[site.playerLocation]}；本阶段累计实走{life.playerTravelMetres}米，现场时钟{life.clockSeconds}秒，本阶段实际经过{life.elapsedSeconds}秒。</p>
        <p>入口到近台2米，近台到远台4米。原封包{site.parcel.location === 'PLAYER' ? '仍在本人手中' : site.parcel.location === 'ENTRY_STAND' ? '已在原入口架上' : '仍在异星原架上'}，唯一原件数量{site.parcel.quantity}。普通步行核验、携包通过和走回原架均需实际时间与距离。</p>
        <p>{selectedCase?.returned ? '本案原包、遮门与人员的实际收尾已完成。' : '到期、撤回或关闭页面都不会移动身体与原包。须亲手停止、带回同一原包、关闭遮门，再沿普通道路与玛拉实际离场。'}</p>
      </section>
      <section aria-label="两项能力的有限窗口"><h4>施放与实际应用分开记录</h4>
        <p>端点定位：8灵性、2精神，感知18。须亲见当前本地端点并通过判定，取得20秒内的一次有限线索；随后仍须本人普通步行4米核验。</p>
        {endpointOpen ? <p>端点定位记录还剩{Math.min(seconds, attempt.endpoint.remainingSeconds)}秒，等待另一次普通步行核验；实际应用仍须走完整段且当前条件有效。</p>
          : <p>当前没有可应用的端点定位窗口；仍可在实际条件允许时普通步行核验。</p>}
        {endpointOpen && attempt.endpoint.clue && <p>本次有限线索：{attempt.endpoint.clue}</p>}
        <p>锚点维系：7灵性、2精神，知识18。只维系当前已知近台与远台20秒；随后仍须携带同一原包普通步行4米，才算实际应用。</p>
        {anchorOpen ? <p>锚点维系记录还剩{Math.min(seconds, attempt.anchor.remainingSeconds)}秒，等待另一次实际携包步行；实际应用仍须走完整段且当前条件有效。</p>
          : <p>当前没有可应用的锚点维系窗口；仍可在实际条件允许时普通携包走过。</p>}
        <p>这两项练习不传送、不复制物品，也不补充灯油或护具。施放本身不增加掌握；隐蔽、移位、遮挡、到期、停止或撤回会使未用窗口失效。只有成功并实际应用，才增加对应的8掌握。</p>
        {attempt && <>
          <p>端点定位：{attempt.endpoint.tier === null ? '尚未判定' : TIER[attempt.endpoint.tier]}，{attempt.endpoint.state === 'ACTIVE' && !endpointOpen ? '原窗口当前不能应用' : WINDOW[attempt.endpoint.state]}，实际应用{attempt.endpoint.effects}次；锚点维系：{attempt.anchor.tier === null ? '尚未判定' : TIER[attempt.anchor.tier]}，{attempt.anchor.state === 'ACTIVE' && !anchorOpen ? '原窗口当前不能应用' : WINDOW[attempt.anchor.state]}，实际应用{attempt.anchor.effects}次。</p>
          <p>后续独立步行核验：{attempt.verifyTier === null ? '尚未判定' : TIER[attempt.verifyTier]}，{attempt.walkVerified ? '已实际完成' : '尚未实际完成'}；后续实际携包通过：{attempt.carryTier === null ? '尚未判定' : TIER[attempt.carryTier]}，{attempt.walkCarried ? '已实际完成' : '尚未实际完成'}。失败与普通替代保留各自记录，不算作新能力应用。</p>
          <p>本次已付{attempt.penniesSpent}便士、{attempt.spiritualitySpent}灵性、{attempt.mindSpent}精神；本人实走{attempt.playerTravelMetres}米，玛拉实走{attempt.maraTravelMetres}米、消耗{attempt.operatorEnergySpent}精力。</p>
        </>}
      </section>
      <p>本阶段生活已付：{spent.actions}行动、{spent.cash}便士、{spent.spirituality}灵性、{spent.mind}精神。停止、归还与退出不退已付代价。</p>
      {selectedCase && selectedCase.attempts.length > 1 && <details className="seer-fold"><summary>此前尝试与已付代价</summary>
        {selectedCase.attempts.slice(0, -1).map((previous, index) => <p key={`${previous.week}-${index}`}>第{previous.week}周：{previous.method === 'ABILITY' ? '曾选择能力帮助' : '普通续办'}；已付{previous.penniesSpent}便士、{previous.spiritualitySpent}灵性、{previous.mindSpent}精神，实走{previous.playerTravelMetres}米。端点定位实际应用{previous.endpoint.effects}次，锚点维系实际应用{previous.anchor.effects}次。原失败与已付代价保留。</p>)}
      </details>}
      <details className="seer-fold"><summary>本案范围、普通替代与退路</summary><ul>{selectedCase?.observations.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
        <p>{life.environment}</p><p>{life.reflected ? '三案报告与反思已保存。' : '三份报告各25扮演、反思25；普通完成同样有效，须先实际收束现场。'}</p>
      </details>
    </section>;
  }
}
