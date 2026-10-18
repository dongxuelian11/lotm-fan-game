import { playerText } from "../shared/player-text.js";
import { useEffect, useRef, useState } from 'react';
import type { CatastropheAction, CatastropheCommand, CatastropheProjection } from '../domain/catastrophe/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const RETURN = new Set(['STOP_EFFECT', 'RECOVER_BUOY', 'DRAIN_WATER', 'CLOSE_GATE', 'CHECK_MOORING', 'RETURN_KEEPER', 'EXIT_SITE', 'INSPECT', 'CLOSE', 'WITHDRAW', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const CONFIRM = new Set(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'STORM_FIELD', 'WATER_PRESSURE', 'ENCOUNTER_FIGHT']);
const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const POSITION: Record<string, string> = { EXIT: '范围外原干路出口', CONTROL: '原控制位', PLATFORM: '原干燥交战平台' };
const GATE: Record<string, string> = { CLOSED: '已关闭', OPEN: '已打开', BROKEN: '已损坏，不能当作已修好' };
const CONSENT: Record<string, string> = { UNASKED: '尚未当面询问', GRANTED: '已同意该次用途', DECLINED: '已拒绝该次用途', WITHDRAWN: '已撤回该次许可', CLOSED: '该次许可已结束' };
const WINDOW: Record<string, string> = { NONE: '尚未尝试', ACTIVE: '窗口尚未到期，应用仍须当前条件', FAILED: '检定失败', STOPPED: '已明确停止', EXPIRED: '实际时间已到期' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '已收束，待报告', RESOLVED: '已报告或和平结束', READY: '已到场交谈', FIGHTING: '真实交战中', RETREATED: '已实际撤退', LOST: '本人实际死亡' };
type Confirmation = { id: string; facts: string };
type Attempt = NonNullable<CatastropheProjection['life']['currentAttempt']>;

export interface CatastrophePanelProps {
  value: CatastropheProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: CatastropheCommand) => void;
  /** Navigation only: dismissing this view never stops effects or returns people, water or objects. */
  onClose?: () => void;
}

/** The saved public projection is the only source of resource, permission and scene facts. */
export function CatastrophePanel({ value, busy, blocked = false, error = null, onCommand, onClose }: CatastrophePanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null);
  const returnActionId = useRef<string | null>(null), buttons = useRef(new Map<string, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null), dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const facts = JSON.stringify(value), locked = busy || blocked || error !== null || submittedId !== null;
  const { life, encounter } = value;
  const selected = life.cases.find(c => c.id === life.activeCase)
    ?? life.cases.find(c => c.contactOpen || c.status === 'PREPARED')
    ?? life.cases.find(c => c.id === caseId) ?? life.cases.find(c => c.status !== 'RESOLVED') ?? life.cases[0];
  const bottle = value.bottles.find(b => b.id === bottleId)
    ?? value.bottles.find(b => value.actions.some(a => a.enabled && 'bottleId' in a.command && a.command.bottleId === b.id)) ?? value.bottles[0];
  const acquisition = value.actions.filter(a => ACQUISITION.has(a.command.type) && (!('bottleId' in a.command) || a.command.bottleId === bottle?.id));
  const battle = value.actions.filter(a => ENCOUNTER.has(a.command.type));
  const daily = value.actions.filter(a => !ACQUISITION.has(a.command.type) && !ENCOUNTER.has(a.command.type) && (!('caseId' in a.command) || a.command.caseId === selected?.id));
  const currentActions = encounter.inside ? battle : value.promoted ? daily : acquisition;
  const next = currentActions.find(a => a.enabled && a.command.type === 'CONSUME')
    ?? currentActions.find(a => a.enabled && !RETURN.has(a.command.type) && a.command.type !== 'WAIT_10')
    ?? currentActions.find(a => a.enabled && RETURN.has(a.command.type)) ?? currentActions.find(a => a.enabled) ?? currentActions[0];
  const immediate = currentActions.filter(a => a.enabled || a === next);
  const liveConfirmation = confirmation?.facts === facts ? value.actions.find(a => a.id === confirmation.id) : undefined;
  const confirmedBottle = liveConfirmation && 'bottleId' in liveConfirmation.command
    ? value.bottles.find(b => 'bottleId' in liveConfirmation.command && b.id === liveConfirmation.command.bottleId) : undefined;

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    // Clearing an error or waiting is not a commit receipt. Keep the original
    // intent locked until new saved public facts arrive without a save error.
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); setCaseId(null); heading.current?.focus();
    } else if (confirmation && submitted.current === null && confirmation.facts !== facts) setConfirmation(null);
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) {
      if (dialog.current?.showModal && !dialog.current.open) dialog.current.showModal();
      cancel.current?.focus();
    } else if (submitted.current === null && returnActionId.current) {
      (buttons.current.get(returnActionId.current) ?? heading.current)?.focus();
    }
  }, [confirmation, error]);

  function submit(action: CatastropheAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id); onCommand(action.command);
  }
  function choose(action: CatastropheAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (CONFIRM.has(action.command.type)) {
      if (action.command.type === 'CONSUME' && !value.bottles.some(b => 'bottleId' in action.command && b.id === action.command.bottleId)) return;
      returnActionId.current = action.id; setConfirmation({ id: action.id, facts });
    } else submit(action);
  }
  function actions(entries: CatastropheAction[], label: string) {
    return entries.length > 0 && <div role="group" aria-label={label} className="warrior-action-list">{entries.map(a => <div className="seer-action warrior-compact-action" key={a.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !a.enabled}
        aria-describedby={a.reason ? `catastrophe-reason-${a.id}` : undefined}
        ref={node => { if (node) buttons.current.set(a.id, node); else buttons.current.delete(a.id); }}
        onClick={() => choose(a)}><strong>{a.label}</strong><span className="slice-modifiers">{a.cost}</span></button>
      {a.reason && <p id={`catastrophe-reason-${a.id}`} className="seer-action-reason">{a.reason}</p>}
    </div>)}</div>;
  }
  function resources(label = '天灾当前资源') {
    const r = value.resources;
    return r && <section aria-label={label} className="seer-current-resources"><h3>当前实际资源</h3><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health}/{r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind}/{r.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{r.spirituality}/{r.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>本周行动</dt><dd>{r.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function siteFacts() {
    const site = life.site;
    return <section aria-label="天灾当前原水与原物" className="seer-current-case"><h3>同一原小湾的当前实况</h3>
      <p>{site.id} · 本次有限边界{site.boundaryMetres}米 · 累计实际{site.clockSeconds}秒 · {life.sitePhase === 'ENCOUNTER' ? '当前为可选遭遇阶段，同一份实况继续累计' : '当前为有限实践阶段'}。</p>
      <dl className="seer-facts">
        <div><dt>同一原海水 {site.water.id}</dt><dd>海湾{site.water.bayUnits}单位 / 水道{site.water.channelUnits}单位 / 原总量{site.water.originalUnits}单位</dd></div>
        <div><dt>原闸 {site.gate.id}</dt><dd>{GATE[site.gate.position]} · 耐久{site.gate.durability}/100 · 实际操作{site.gate.operations}次</dd></div>
        <div><dt>原浮标 {site.buoy.id}</dt><dd>距原泊位{site.buoy.offsetMetres}米{site.buoy.offsetMetres === 0 ? '，当前已在原泊位' : '，仍须用原卷具实际回收'}</dd></div>
        <div><dt>原系索 {site.mooring.id}</dt><dd>耐久{site.mooring.durability}/100</dd></div>
        <div><dt>原卷具 {site.winch.id}</dt><dd>耐久{site.winch.durability}/100</dd></div>
        <div><dt>原工作轮 {site.wheel.id}</dt><dd>耐久{site.wheel.durability}/100 · 累计实际转动{site.wheel.turns}次</dd></div>
      </dl>
      <p className={site.gate.position !== 'OPEN' || site.water.channelUnits === 0 ? 'slice-notice' : undefined}>
        {site.gate.position !== 'OPEN' ? '原闸当前未打开，水压应用受阻。' : site.water.channelUnits === 0 ? '当前水道没有原水，水压应用受阻。' : life.sitePhase === 'ENCOUNTER' ? '当前原闸开放且水道有原水；战斗仍须实际抽中并支付动作槽、灵性与原水消耗。' : '当前原闸开放且水道有原水；仍须满足本次许可、能力窗口及实际动作条件。'}
        关闸不会消失水道原水；停止窗口也不代替普通排回。
      </p>
      <p>{playerText("水量按本页所示单位计量；原水只在同一海湾与已有水道间实际转移。三案、交谈与战斗共用这份实况，观察、报告和开战不补水或修复耐久。")}</p>
      <p>原浮标、系索、闸、卷具与工作轮均归同一诺拉保管；普通轮转不自动证明新能力已应用。</p>
    </section>;
  }
  function positions() {
    const site = life.site;
    const attempt = life.currentAttempt;
    return <section aria-label="天灾当前许可与真实位置"><h3>当前原人、许可与真实退路</h3>
      <p>本人当前在{POSITION[site.playerPosition]}，累计实际行走{site.playerTravelMetres}米。</p>
      <p>同一{site.keeper.name}{site.keeper.age}岁 · {site.keeper.id} · 存活 · 当前在{POSITION[site.keeper.position]}；精力{site.keeper.energy}/100，累计实际行走{site.keeper.travelMetres}米。</p>
      <p className={attempt?.ownerConsent === 'WITHDRAWN' || attempt?.ownerConsent === 'DECLINED' ? 'slice-notice seer-risk' : 'slice-notice'}>
        当前实践许可：{attempt ? CONSENT[attempt.ownerConsent] : '没有进行中的本次实践许可，旧案许可不能复用'}。
        {attempt?.ownerConsentWeek !== null && attempt?.ownerConsentWeek !== undefined && `本次询问记录来自第${attempt.ownerConsentWeek}周。`}
        {attempt?.ownerConsent === 'WITHDRAWN' && '当前撤回优先于先前成功窗口；禁止继续新应用，已付成本与窗口记录保留，仍须单独停止和普通收束。'}
      </p>
      <p>诺拉往返原控制位与范围外出口各需真实走6米、支付2精力；停止、报告或关闭页面不会把她送回原位。</p>
      <p>本人实践进出原控制位各2米、2秒；可选交谈也须实际清场后沿干路进出原平台各2米、2秒。原物磨损、原水位置与双方原身体按已保存的实际动作延续。</p>
      {attempt && <section aria-label="天灾当前窗口与实际应用"><h4>本次付费尝试与真实应用</h4>{attemptFacts(attempt, false)}</section>}
    </section>;
  }
  function attemptFacts(a: Attempt, historical: boolean) {
    return <div>
      <p>{historical ? '历史记录' : '当前尝试'} · 第{a.week}周 · {a.method === 'ABILITY' ? '能力方法准备' : '普通方法准备'} · {a.closed ? '本次已实际收束' : '本次尚未收束'}。</p>
      <p>实际经过{a.elapsedSeconds}秒；本次本人行走{a.playerTravelMetres}米，诺拉行走{a.keeperTravelMetres}米、实付{a.keeperEnergySpent}精力；实付{a.spiritualitySpent}灵性。</p>
      {([['有限风浪', a.storm], ['原水压力', a.pressure]] as const).map(([label, use]) => <p key={label}>
        {label}：尝试{use.attempts} / 检定成功{use.successes} / 实际应用{use.effects}；{use.tier ? TIER[use.tier] : '尚无检定'}，{WINDOW[use.state]}，窗口剩余{use.remainingSeconds}秒 / 最多10秒；{use.stopped ? '已实际确认停术' : use.attempts > 0 ? '本次仍须明确停术' : '本次尚未施术'}。
      </p>)}
      <p>本次实际应用的新能力：{a.appliedAbilityIds.length ? a.appliedAbilityIds.map(id => value.abilities.find(ability => ability.id === id)?.label ?? id).join('、') : '无。成功开窗、普通转轮或仅完成报告都不算新能力应用'}。</p>
      {historical && <p>当时许可：{CONSENT[a.ownerConsent]}；{a.consentWithdrawn ? '明确撤回的记录保留' : '未记录后续撤回'}。此处是该次历史，当前人和原物位置以上方实况为准。</p>}
      <p>本次原浮标：{a.buoyMoved ? a.buoyRecovered ? '确实移出后已用原卷具实拉归位' : '确实移出，尚未实拉归位' : '未实际移出，不能声称移送成功'}。</p>
      <p>本次原水：{a.waterAdmitted ? a.waterDrained ? '确实引入后已实际排回原湾' : '确实引入，尚未实际排回' : '未实际引入'}；原轮{a.wheelTurned ? '本次确实转动' : '本次未转动'}，{a.manualWheel ? '包含普通手柄实际转动' : '本次未用普通手柄'}。</p>
      <p>诺拉本次{a.keeperCleared ? a.keeperReturned ? '已沿6米干路实际退出作用区并实际走回' : '已沿6米干路实际退出作用区，尚未走回' : '未实际退出作用区'}；本人{a.exited ? '已沿原2米干路实际退出' : a.entered ? '已实际进入，仍须普通走回出口' : '尚未实际进入'}。</p>
      <p>{a.gateChecked ? a.gateBlocked ? '本次已亲眼查见原闸阻挡，原记录保留。' : '本次已实际检查原闸。' : '本次尚未实际检查原闸。'}{a.inspected ? '已完成最终原人原物核查。' : '本次尚未完成最终核查。'}</p>
    </div>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="天灾原人可选遭遇"><h3>{encounter.title}</h3><p>{STATUS[encounter.status] ?? encounter.status}</p><p>{encounter.story}</p>
      {enemy && <><p>同一{enemy.name}{enemy.age}岁 · {enemy.id}{playerText(" · 原创G序列")}{enemy.sequence}等效。H{enemy.health}/100 · M{enemy.mind}/100 · 独立S{enemy.spirituality}/120；{enemy.status === 'DEAD' ? '已经真实死亡' : enemy.status === 'SURRENDERED' ? '已投降，停止抵抗' : '仍有独立意志'}。</p>
        <p>自己的唯一原棍{enemy.weaponId}在{enemy.weaponLocation === 'HAND' ? `${enemy.name}手中` : '原干燥平台'}。已实际支付风浪{enemy.powerUses.STORM}次、水压{enemy.powerUses.PRESSURE}次；原闸操作{enemy.powerUses.GATE}次。</p></>}
      <p>当前原水、闸和人物位置见上方同一小湾实况；旧实践位置只属于相应历史记录，不另算一个当前身体。原本尼迪克特、昆廷及其生死与原棍保持各自历史。</p>
      <ul>{encounter.facts.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <p className="slice-muted">这是可选冲突。有限风水不提供自动友军豁免；共同伤势、撤退和死亡规则照常结算，战斗不另奖新掌握。</p>
    </section>;
  }

  return <section className="seer-panel warrior-panel catastrophe-panel" aria-label="天灾有限切片" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="天灾当前目标"><span className="seer-seal">{value.promoted ? playerText("天灾 · 暴君序列2") : '海王3 → 天灾2'}</span>
      <h2 ref={heading} tabIndex={-1}>{value.title}</h2><p>{value.story ?? life.story}</p>
      <p className="seer-next"><strong>下一步：</strong>{next ? `${next.label} · ${next.cost}${!next.enabled && next.reason ? `。${next.reason}` : ''}` : '当前没有可提交的现场操作，可以查看已保存记录。'}</p>
      <p>{value.digestion}</p>
      <p>{playerText("本阶段可尝试有限风浪与水压，须使用当前海湾与水道，并承担实际费用、距离限制与风险。下一序列1尚未开放。")}</p>
    </section>
    {resources()}
    <p className="slice-notice seer-risk">{value.risk}</p>
    {error !== null && <p role="alert">{playerText(typeof error === 'string' ? error : error.message)} 当前仍显示上次已保存事实。{typeof error !== 'string' && error.retryable === false ? '请按保存错误提示重新加载。' : '请使用保存错误处的重试，继续同一原操作；此处不会重复提交。'}</p>}
    {(busy || submittedId !== null) && <p role="status" aria-live="polite">正在等待同一次操作的保存回执；重复点击、清除错误或时间经过都不会再次消耗资源。</p>}

    {!value.promoted && <section aria-label="天灾独立原瓶与专业准备"><h3>独立原瓶与本周专业准备</h3><p>{value.supplies}</p>
      <label className="seer-case-selector">查看原瓶<select value={bottle?.id ?? ''} disabled={locked || confirmation !== null} onChange={e => setBottleId(e.target.value)}>
        {value.bottles.map(b => <option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}
      </select></label>
      {bottle && <article><h4>{bottle.title} · {bottle.id}</h4><p>{bottle.source}</p><p>当前状态{bottle.status} · 当前成功率{bottle.chance}%</p></article>}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未实际完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>当次准备：{value.preparedWeek === null ? '尚无已保存检查' : `第${value.preparedWeek}周已检查`}。取得原瓶、完成准备与真正服药是分别提交的动作。</p>
      <p>{playerText("从实际海王晋升周起满12整周、海王消化100；指导500便士。每瓶6200便士，或各自五次真实劳务抵5400便士后支付800便士；当周检查另付1行动、120便士。")}</p>
      <p>现有原瓶耗尽后须实际花1行动申请，下一真实周起才能收到仍须逐瓶付费的独立库存；不能重新取得已喝掉的原瓶，每瓶失败记录与当次成本保留。</p>
    </section>}

    {value.promoted && <>{siteFacts()}{positions()}
      {!encounter.inside && <section className="seer-current-case" aria-label="天灾当前实践"><h3>本次有限实践</h3>
        <label className="seer-case-selector">查看实践<select value={selected?.id ?? ''} disabled={locked || confirmation !== null || life.insideCase || life.cases.some(c => c.status === 'PREPARED')} onChange={e => setCaseId(e.target.value)}>
          {life.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? c.status}</option>)}
        </select></label>
        {selected && <><h4>{selected.title} · {STATUS[selected.status] ?? selected.status}</h4><p>{selected.story}</p><ul>{selected.observations.map((x, i) => <li key={i}>{x}</li>)}</ul>{selected.result && <p className="slice-notice">{selected.result}</p>}
          {!life.currentAttempt && selected.attempts.at(-1) && <section aria-label="天灾本案最后一次历史"><h4>本案最后一次已保存记录</h4>{attemptFacts(selected.attempts.at(-1)!, true)}</section>}
        </>}
      </section>}
      {encounter.inside && encounterFacts()}
    </>}

    <section aria-label="天灾当前行动"><h3>{value.insideCase ? '当前现场的下一步' : '当前可选行动'}</h3>
      {actions(immediate.filter(a => !RETURN.has(a.command.type)), '天灾公开行动')}
      {immediate.some(a => RETURN.has(a.command.type)) && <section aria-label="天灾停止与普通收束"><h4>停止、归水、归物与普通退出</h4>
        {actions(immediate.filter(a => RETURN.has(a.command.type)), '天灾零行动收束')}
        <p>现场0行动收尾仍有实际秒数、移动与工具代价。停止窗口、排回原水、关闸、回收原浮标和原人返程分别完成；不退已付灵性，不修复损耗。</p>
      </section>}
      {currentActions.some(a => !immediate.includes(a)) && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actions(currentActions.filter(a => !immediate.includes(a)), '天灾尚不可提交的步骤')}</details>}
    </section>

    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>独立原人的可选冲突</summary>{encounterFacts()}{actions(battle, '天灾可选遭遇行动')}</details>}
    {value.promoted && <details className="seer-fold"><summary>独立原瓶与专业准备记录</summary><p>{value.supplies}</p>
      {value.bottles.map(b => <article key={b.id}><h4>{b.title} · {b.id}</h4><p>{b.source}</p><p>已保存状态：{b.status}</p></article>)}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未实际完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>{playerText("本渠道提供独立成品，并要求完成专业准备，不提供完整配方或自行调配；已耗原瓶不能再次服用。")}</p>
    </details>}
    <details className="seer-fold"><summary>三案历史与新掌握</summary><p>{life.story}</p>
      {life.cases.map(c => <article key={c.id}><h4>{c.title} · {STATUS[c.status] ?? c.status}</h4><p>{c.result ?? '尚无实际报告结果。'} · 已实际收束{c.closes}次。</p>{c.attempts.map((a, i) => <div key={i}>{attemptFacts(a, true)}</div>)}</article>)}
      {value.abilities.map(a => <p key={a.id}>{a.label} · 掌握{a.mastery}：{a.description}</p>)}
      <p>检定成功只形成有限窗口；只有实际新能力应用才记录效用并在本案报告时发一次掌握。普通收束可以报告，不能改写成魔法应用。</p><p>{value.digestion}</p>
    </details>
    <details className="seer-fold"><summary>原身体、七阶继承与来源边界</summary>
      <p>当前身体性别：{GENDER[value.currentGender] ?? value.currentGender}。旧20项掌握与原七阶历史保留；本阶不改变身体性别，不复活旧死者、不免费治疗或补满当前灵性。</p>
      <ul>{value.inheritedHistory.map((x, i) => <li key={i}>{x}</li>)}</ul><p>{value.environment}</p>
      <p>本阶不重做序列4地震海啸仪式，也不使用序列0挑战神灵的仪式。旧原人原物不是新场可免费领取的库存。</p>
    </details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || value.insideCase || confirmation !== null} onClick={() => { if (!locked && !value.insideCase && !confirmation) onClose(); }}>关闭天灾页面</button>}

    {confirmation && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="catastrophe-confirm-title" aria-describedby="catastrophe-confirm-cost"
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal}
      style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '85vh', overflow: 'auto', color: 'var(--slice-ink)', background: 'var(--slice-paper-light)', padding: 24 }}
      onCancel={e => { e.preventDefault(); if (!locked) setConfirmation(null); }}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!locked) setConfirmation(null); }
        if (e.key === 'Tab') {
          const controls = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const first = controls[0], last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      {error !== null && <p role="status">保存尚未成功，原确认保持锁定。请使用保存错误处的重试。</p>}
      <h3 id="catastrophe-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次真实消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '实际公开条件已改变，请返回最新状态。'}</p><p id="catastrophe-confirm-cost">{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.id} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%；当次检查{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p></>}
      {liveConfirmation?.command.type === 'CONSUME' && <><p className="slice-notice seer-risk">{value.risk}</p>
        <p>本瓶和当次准备成功失败均耗尽，已付成本不退。失败后须真实恢复、筹另一独立原瓶并重新检查；不能撤回已提交的服药。</p>
        <p>{playerText("保留旧20掌握、七阶原人原物、旧失败与死亡、当前伤势及风险；当前灵性不补满。本次晋升使用独立成品，并须完成专业准备。")}</p>
      </>}
      {liveConfirmation?.command.type === 'STORM_FIELD' && <p>7灵性、意志20；成功只开启最多10秒有限风浪窗口，必须另选实际移动同一原浮标才有应用。失败照付；本次没有实际移动就不奖掌握。当前撤回许可后禁止应用，仍可0行动明确停术与普通收束。</p>}
      {liveConfirmation?.command.type === 'WATER_PRESSURE' && <p>6灵性、知识20；成功只开启最多10秒原水压力窗口。须当前原闸打开、水道已有同一原水，并另做真实推轮才有应用；普通手柄转动不算压力应用。当前撤回或关闸会阻止后续应用，停止也不代替实际排水。</p>}
      {liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' && <><p>与同一CT2-VALE维尔承担真实冲突；当前原水、原闸与损耗直接进入战斗，不重置资源。共同伤势、死亡和撤退规则照常。</p>{resources('天灾开战确认当前资源')}<p>保管员必须已经沿原干路实际离开施术区；这不是风水能力自动排除友军。</p></>}
      {liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button type="button" ref={cancel} className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作'}</button></div>
      <p className="slice-muted">取消只关闭未提交的确认，不代替实际退出准备或收束现场。提交后等待同一次保存回执，不重复付费。</p>
    </dialog>}
  </section>;
}
