import { useEffect, useRef, useState } from 'react';
import type { LightSeekerAction, LightSeekerCommand, LightSeekerProjection } from '../domain/light-seeker/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const RETURN = new Set(['STOP', 'CLOSE_SHUTTER', 'RETURN_COVER', 'RETURN_OPERATOR', 'RETIRE_SPIRIT', 'INSPECT_SCREEN', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const CONFIRM = new Set(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'PERFORM', 'ENCOUNTER_FIGHT']);
const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const POSITION: Record<string, string> = { ENTRY: '入口（0米）', NEAR: '近端（2米）', SCREEN: '遮板旁（3米）', OTHER: '遮板另一侧（4米）', FAR: '廊道尽头（6米）', SIDE: '侧路外端（9米）' };
const SHUTTER: Record<string, string> = { CLOSED: '已关闭', OPEN: '已打开', BROKEN: '已损坏' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '已同意本次用途', DECLINED: '已拒绝本次用途', WITHDRAWN: '已撤回本次许可', CLOSED: '本次许可已结束' };
const LIGHT: Record<string, string> = { OFF: '已停光', PLAIN: '普通照明仍亮着', GUIDED: '定向光辉', LIMITED: '有限收光' };
const WINDOW: Record<string, string> = { NONE: '尚未尝试', ACTIVE: '窗口仍有效', FAILED: '检定失败，未形成窗口', STOPPED: '已明确停止', EXPIRED: '窗口已到期' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '已收束，待报告', RESOLVED: '已报告或和平结束', READY: '已到场交谈', FIGHTING: '交战中', RETREATED: '已撤退', LOST: '本人已死亡' };
const POWER: Record<string, string> = { LIGHT_STRIKE: '光击', LIGHT_WARD: '光照防护', SHUTTER_CLOSE: '普通关闸' };
type Confirmation = { id: string; facts: string };
type Attempt = NonNullable<LightSeekerProjection['life']['currentAttempt']>;

export interface LightSeekerPanelProps {
  value: LightSeekerProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: LightSeekerCommand) => void;
  /** Navigation only. Closing this panel does not move anyone or clean up the site. */
  onClose?: () => void;
}

/** Current people, resources and permissions come only from the saved public projection. */
export function LightSeekerPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: LightSeekerPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null);
  const returnActionId = useRef<string | null>(null), buttons = useRef(new Map<string, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null), dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  // A comparison fingerprint stays internal; it is never rendered as game information.
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
  const confirmedCase = liveConfirmation && 'caseId' in liveConfirmation.command
    ? life.cases.find(c => 'caseId' in liveConfirmation.command && c.id === liveConfirmation.command.caseId) : undefined;

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    // A cleared error, elapsed browser time or another click is not a commit receipt.
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

  function submit(action: LightSeekerAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id); onCommand(action.command);
  }
  function choose(action: LightSeekerAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (CONFIRM.has(action.command.type)) {
      if (action.command.type === 'CONSUME' && !value.bottles.some(b => 'bottleId' in action.command && b.id === action.command.bottleId)) return;
      returnActionId.current = action.id; setConfirmation({ id: action.id, facts });
    } else submit(action);
  }
  function actions(entries: LightSeekerAction[], label: string) {
    return entries.length > 0 && <div role="group" aria-label={label} className="warrior-action-list">{entries.map(a => <div className="seer-action warrior-compact-action" key={a.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !a.enabled}
        aria-describedby={a.reason ? `light-seeker-reason-${a.id}` : undefined}
        ref={node => { if (node) buttons.current.set(a.id, node); else buttons.current.delete(a.id); }}
        onClick={() => choose(a)}><strong>{a.label}</strong><span className="slice-modifiers">{a.cost}</span></button>
      {a.reason && <p id={`light-seeker-reason-${a.id}`} className="seer-action-reason">{a.reason}</p>}
    </div>)}</div>;
  }
  function resources(label = '逐光者当前资源') {
    const r = value.resources;
    return r && <section aria-label={label} className="seer-current-resources"><h3>当前资源</h3><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health}/{r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind}/{r.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{r.spirituality}/{r.maxSpirituality}</dd></div><div><dt>污染</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>本周行动</dt><dd>{r.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function siteFacts() {
    const site = life.site;
    return <section aria-label="逐光者当前采光廊与原物" className="seer-current-case"><h3>采光廊当前实况</h3>
      <p>{site.id} · 有顶直廊{site.lengthMetres}米 · 累计经过{site.elapsedSeconds}秒 · {life.sitePhase === 'ENCOUNTER' ? '当前为可选遭遇阶段' : '当前为生活实践阶段'}。</p>
      <dl className="seer-facts">
        <div><dt>遮光闸 {site.shutter.id}</dt><dd>{SHUTTER[site.shutter.state]} · 位于遮板旁（3米） · 耐久{site.shutter.durability}/100 · 已操作{site.shutter.operations}次</dd></div>
        <div><dt>油灯 {site.lamp.id}</dt><dd>剩余灯油{site.lamp.oil}份 · 普通核读每次用1份油、4秒</dd></div>
        <div><dt>遮罩 {site.cover.id}</dt><dd>{site.cover.position === 'OWNER_STAND' ? '在玛拉的架子上' : '已放在屏架上'} · 耐久{site.cover.durability}/100</dd></div>
        <div><dt>屏板 {site.screen.id}</dt><dd>位于遮板旁（3米） · 耐久{site.screen.durability}/100 · 已检查{site.screen.inspections}次</dd></div>
        <div><dt>刻字板 {site.board.id}</dt><dd>{site.board.location === 'FAR_STAND' ? '在廊道尽头的固定架上' : '由本人持有'} · 当前保管：{site.board.owner === site.operatorId ? site.operatorName : '本人'} · {site.board.read ? `已核读：${site.board.inscription}` : '尚未核读刻字'}</dd></div>
        <div><dt>当前光照</dt><dd>{LIGHT[site.light.mode]}{site.light.expiresAt !== null && ` · 窗口剩余${Math.max(0, site.light.expiresAt - site.elapsedSeconds)}秒 / 最多20秒`}</dd></div>
        <div><dt>普通出口</dt><dd>{site.ordinaryExit === 'OPEN' ? '开放，可沿原地面实际行走' : '当前不能通行'}</dd></div>
      </dl>
      <p className="slice-notice">{site.shutter.state === 'OPEN' ? '遮光闸当前打开；继续应用仍须当前许可、有效窗口及实际位置。' : site.shutter.state === 'BROKEN' ? '遮光闸已经损坏，不能当作已修好或光路通畅。' : '遮光闸当前关闭，定向光路受阻。'}遮板不封住旁边的普通地面，退出仍须亲自走完原路。</p>
      <p>三案与可选遭遇共用这里的同一套物品。观察、报告和开战不会补灯油或修复磨损。收光到期后，先前点起的普通照明仍亮着，须明确停光；停光不会归物、关闸或把人送回。</p>
    </section>;
  }
  function positions() {
    const site = life.site;
    return <section aria-label="逐光者当前许可与真实位置"><h3>人、灵与当前许可</h3>
      <p>本人当前在{POSITION[site.playerLocation]}，累计行走{site.playerMetres}米。</p>
      <p>{site.operatorName}{site.operatorAge}岁 · {site.operatorId} · 当前在{POSITION[site.operatorLocation]}；精力{site.operatorEnergy}/100，累计行走{site.operatorMetres}米。</p>
      <p className="slice-notice">{site.operatorName}的当前许可：{CONSENT[site.operatorConsent]}。{site.operatorConsentWeek !== null && `询问记录来自第${site.operatorConsentWeek}周。`}旧案同意不能代替这次询问。</p>
      <p>友善灵{site.spiritName} · {site.spiritId} · 当前在{POSITION[site.spiritLocation]}；精力{site.spiritEnergy}/100，累计行走{site.spiritMetres}米。</p>
      <p className={site.spiritConsent === 'WITHDRAWN' || site.spiritConsent === 'DECLINED' ? 'slice-notice seer-risk' : 'slice-notice'}>
        {site.spiritName}的当前许可：{CONSENT[site.spiritConsent]}。{site.spiritConsentWeek !== null && `询问记录来自第${site.spiritConsentWeek}周。`}
        {site.spiritConsent === 'WITHDRAWN' && '当前撤回优先于先前成功窗口，禁止继续本次应用；已付成本和成功记录保留，仍须单独停光并普通收尾。'}
      </p>
      <p>{site.operatorName}往返入口与尽头，每程6米、6秒、2精力；{site.spiritName}往返侧路与入口，每程9米、9秒、2精力，且须光已灭并取得当前许可。友善不等于免受光照影响，它也不是可随时领取的灵体物品。</p>
      <p>本人按普通地面实际行走，每米1秒。0行动操作仍会花时间、精力或灯油；停止、报告和关闭页面都不代替返程。</p>
      {life.currentAttempt && <section aria-label="逐光者当前窗口与实际应用"><h4>本次尝试与实际应用</h4>{attemptFacts(life.currentAttempt, false)}</section>}
    </section>;
  }
  function attemptFacts(a: Attempt, historical: boolean) {
    const successful = a.abilityTier === 'SUCCESS' || a.abilityTier === 'GREAT_SUCCESS';
    const end = historical ? (a.siteAtClose?.elapsedSeconds ?? life.site.elapsedSeconds) : life.site.elapsedSeconds;
    const remaining = a.window === 'ACTIVE' && a.windowExpiresAt !== null ? Math.max(0, a.windowExpiresAt - end) : 0;
    return <div>
      <p>{historical ? '历史记录' : '当前尝试'} · 第{a.week}周 · {a.method === 'ABILITY' ? '能力方法' : '普通方法'} · {a.closed ? '已实际收束' : '尚未收束'}。</p>
      <p>本次经过{a.elapsedSeconds}秒，实付{a.spiritualitySpent}灵性；本人行走{a.playerTravelMetres}米，玛拉行走{a.operatorTravelMetres}米、实付{a.operatorEnergySpent}精力，芦影行走{a.spiritTravelMetres}米、实付{a.spiritEnergySpent}精力。</p>
      <p>实施：{a.performed ? '已完成本次付费步骤' : '尚未实施'}；检定：{a.abilityTier ? TIER[a.abilityTier] : '本次没有能力检定'}；{WINDOW[a.window]}，窗口剩余{remaining}秒 / 最多20秒。{a.lightStopped ? '已明确停光。' : a.performed && a.spiritualitySpent > 0 ? '还须明确停光。' : ''}</p>
      <p>{successful && a.appliedAbilityIds.length === 0 ? historical ? '本次检定成功，但没有实际应用。' : '本次检定成功，尚未实际应用。' : a.abilityTier === 'FAILURE' || a.abilityTier === 'GREAT_FAILURE' ? '本次检定失败，实际消耗保留。' : ''}实际应用：{a.appliedAbilityIds.length ? a.appliedAbilityIds.map(id => value.abilities.find(ability => ability.id === id)?.label ?? id).join('、') : '无'}。成功开窗本身不增加掌握，须实际应用并报告。</p>
      <p>刻字{a.markerRead ? a.lampRead ? '已用普通灯油核读' : '已在定向光辉下核读' : '尚未核读'}；屏板{a.screenInspected ? '已实际检查并记录磨损' : '本次尚未检查'}；玛拉{a.operatorWentFar ? a.operatorReturned ? '确实到过尽头并已走回' : '确实到过尽头，尚未走回' : '本次尚未走到尽头'}。</p>
      <p>芦影{a.spiritVisited ? a.spiritRetired ? '确实来过入口，之后已沿侧路退回' : '确实来到入口，尚未退回' : '本次尚未到访'}；{a.permissionWithdrawn ? '本次探访许可已明确撤回，未应用的成功如实保留' : '本次没有撤回记录'}。</p>
      <p>最终核查{a.inspected ? '已完成' : '尚未完成'}；{a.interrupted ? '本次中途退出，按实际经过记录' : '本次记录按已执行步骤保留'}。</p>
      {historical && <><p>当时许可：玛拉{CONSENT[a.operatorConsent]}，芦影{CONSENT[a.spiritConsent]}。这是该次历史；当前位置、精力和许可以上方实况为准。</p>
        <p>当时使用{a.siteAtStart.id}的{a.siteAtStart.shutter.id}与{a.siteAtStart.lamp.id}；开始时灯油{a.siteAtStart.lamp.oil}份、遮光闸耐久{a.siteAtStart.shutter.durability}/100。{a.siteAtClose && `收束时灯油${a.siteAtClose.lamp.oil}份、遮光闸耐久${a.siteAtClose.shutter.durability}/100；本人在${POSITION[a.siteAtClose.playerLocation]}。`}</p></>}
    </div>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="逐光者可选遭遇"><h3>{encounter.title}</h3><p>{STATUS[encounter.status] ?? encounter.status}</p><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name}{enemy.age}岁 · {enemy.id} · 当前在{POSITION[enemy.location]} · 健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120；{enemy.status === 'DEAD' ? '已死亡' : enemy.status === 'SURRENDERED' ? '已投降，停止抵抗' : '仍有独立意志'}。</p>
        <p>唯一的棍棒{enemy.weaponId}：{enemy.weaponLocation === 'HAND' ? `仍在${enemy.name}手中` : '留在遮板另一侧（4米）的交战地点'}。{Object.entries(enemy.powerUses).map(([id, count]) => `${POWER[id] ?? id}${count}次`).join('；')}。</p></>}
      <ul>{encounter.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
      <p>当前遮光闸、灯油、人和灵的位置见上方实况。双方承担真实伤势、撤退和死亡后果；有限收光只抵减符合条件的一次光击，不抵挡棍击，战斗不会增加新技巧掌握。</p>
    </section>;
  }

  return <section className="seer-panel warrior-panel light-seeker-panel" aria-label="逐光者有限切片" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="逐光者当前目标"><span className="seer-seal">{value.promoted ? '逐光者 · 太阳序列2' : '正义导师3 → 逐光者2'}</span>
      <h2 ref={heading} tabIndex={-1}>{value.title}</h2><p>{value.story ?? life.story}</p>
      <p className="seer-next"><strong>下一步：</strong>{next ? `${next.label} · ${next.cost}${!next.enabled && next.reason ? `。${next.reason}` : ''}` : '当前没有可提交的现场操作，可以查看已保存记录。'}</p>
      <p>{value.digestion}</p><p>在已有采光廊练习定向光辉与有限收光。光路、距离、当前许可与实际消耗都会影响结果；下一序列尚未开放。</p>
    </section>
    {resources()}
    <p className="slice-notice seer-risk">{value.risk}</p>
    {error !== null && <p role="alert">{typeof error === 'string' ? error : error.message} 当前仍显示上次已保存事实。{typeof error !== 'string' && error.retryable === false ? '请按保存错误提示重新加载。' : '请使用保存错误处的重试，继续同一操作；此处不会重复提交。'}</p>}
    {(busy || submittedId !== null) && <p role="status" aria-live="polite">正在等待同一次操作的保存回执；重复点击、清除错误或时间经过都不会再次消耗资源。</p>}

    {!value.promoted && <section aria-label="逐光者独立药瓶与专业准备"><h3>独立药瓶与本周准备</h3><p>{value.supplies}</p>
      <label className="seer-case-selector">查看药瓶<select value={bottle?.id ?? ''} disabled={locked || confirmation !== null} onChange={e => setBottleId(e.target.value)}>
        {value.bottles.map(b => <option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}
      </select></label>
      {bottle && <article><h4>{bottle.title} · {bottle.id}</h4><p>{bottle.source}</p><p>当前状态：{bottle.status} · 当前成功率{bottle.chance}%</p></article>}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>当次准备：{value.preparedWeek === null ? '尚无已保存检查' : `第${value.preparedWeek}周已检查`}。取得药瓶、完成准备与真正服药是分别提交的动作。</p>
      <p>从实际正义导师晋升周起满12整周、正义导师消化100；指导500便士。每瓶6200便士，或完成本瓶五次劳务抵5400便士后支付800便士；当周检查另付1行动、120便士。</p>
      <p>现有药瓶全部失败耗尽后，须花1行动申请，下一真实周起确认到货，新库存仍须逐瓶付费。已喝掉的药瓶不会回来，失败与成本保留。</p>
    </section>}

    {value.promoted && <>{siteFacts()}{positions()}
      {!encounter.inside && <section className="seer-current-case" aria-label="逐光者当前实践"><h3>本次实践</h3>
        <label className="seer-case-selector">查看实践<select value={selected?.id ?? ''} disabled={locked || confirmation !== null || life.insideCase || life.cases.some(c => c.status === 'PREPARED')} onChange={e => setCaseId(e.target.value)}>
          {life.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? c.status}</option>)}
        </select></label>
        {selected && <><h4>{selected.title} · {STATUS[selected.status] ?? selected.status}</h4><p>{selected.story}</p><ul>{selected.observations.map((fact, i) => <li key={i}>{fact}</li>)}</ul>{selected.result && <p className="slice-notice">{selected.result}</p>}
          {!life.currentAttempt && selected.attempts.at(-1) && <section aria-label="逐光者本案最后一次历史"><h4>本案最后一次已保存记录</h4>{attemptFacts(selected.attempts.at(-1)!, true)}</section>}
        </>}
      </section>}
      {encounter.inside && encounterFacts()}
    </>}

    <section aria-label="逐光者当前行动"><h3>{value.insideCase ? '当前现场的下一步' : '当前可选行动'}</h3>
      {actions(immediate.filter(a => !RETURN.has(a.command.type)), '逐光者公开行动')}
      {immediate.some(a => RETURN.has(a.command.type)) && <section aria-label="逐光者停止与普通收束"><h4>停光、归物与普通退出</h4>
        {actions(immediate.filter(a => RETURN.has(a.command.type)), '逐光者零行动收束')}
        <p>0行动收尾仍有实际秒数、距离与消耗。停光、关闭遮光闸、归还遮罩、人与灵返程分别完成；已付灵性不退，磨损不会恢复。</p>
      </section>}
      {currentActions.some(a => !immediate.includes(a)) && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actions(currentActions.filter(a => !immediate.includes(a)), '逐光者尚不可提交的步骤')}</details>}
    </section>

    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>采光廊的可选冲突</summary>{encounterFacts()}{actions(battle, '逐光者可选遭遇行动')}</details>}
    {value.promoted && <details className="seer-fold"><summary>独立药瓶与专业准备记录</summary><p>{value.supplies}</p>
      {value.bottles.map(b => <article key={b.id}><h4>{b.title} · {b.id}</h4><p>{b.source}</p><p>已保存状态：{b.status}</p></article>)}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>本渠道提供独立成品与专业准备，尚没有可供自行调配的完整配方。已耗药瓶不能再次服用。</p>
    </details>}
    <details className="seer-fold"><summary>三案历史与新掌握</summary><p>{life.story}</p>
      {life.cases.map(c => <article key={c.id}><h4>{c.title} · {STATUS[c.status] ?? c.status}</h4><p>{c.result ?? '尚无实际报告结果。'} · 已收束{c.closes}次。</p>{c.attempts.map((a, i) => <div key={i}>{attemptFacts(a, true)}</div>)}</article>)}
      {value.abilities.map(a => <p key={a.id}>{a.label} · 掌握{a.mastery}：{a.description}</p>)}
      <p>检定成功只形成20秒窗口。每案仅实际应用并报告的新能力增加一次8掌握；普通灯油核读、普通返程和未应用的成功不会获得这项奖励。</p><p>{value.digestion}</p>
    </details>
    <details className="seer-fold"><summary>身体与已有经历</summary>
      <p>当前身体性别：{GENDER[value.currentGender] ?? value.currentGender}。十八项已有掌握与历阶人物、物品和遭遇保持；本阶不改变身体性别，不免费治疗或补满当前灵性。</p>
      <ul>{value.inheritedHistory.map((fact, i) => <li key={i}>{fact}</li>)}</ul><p>{value.environment}</p>
    </details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || value.insideCase || confirmation !== null} onClick={() => { if (!locked && !value.insideCase && !confirmation) onClose(); }}>关闭逐光者页面</button>}

    {confirmation && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="light-seeker-confirm-title" aria-describedby="light-seeker-confirm-cost"
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
      <h3 id="light-seeker-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一药瓶' : '确认本次消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '当前条件已改变，请返回最新状态。'}</p><p id="light-seeker-confirm-cost">{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.id} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%；当次检查{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p></>}
      {liveConfirmation?.command.type === 'CONSUME' && <><p className="slice-notice seer-risk">{value.risk}</p>
        <p>本瓶和当次准备成功失败均耗尽，已付成本不退。失败后须恢复、筹另一独立药瓶并重新检查；不能撤回已提交的服药。</p>
        <p>十八项已有掌握、身体性别、当前伤势与风险保持，当前灵性不补满。购买或准备不会自动服药。</p>
      </>}
      {liveConfirmation?.command.type === 'PERFORM' && <>
        <p>{confirmedCase?.method === 'ORDINARY' ? confirmedCase.id === 'marker-path' ? '本次采用普通核读。实施后仍须陪同玛拉实走6米，再消耗1份灯油、4秒读取同一刻字板。' : confirmedCase.id === 'withdrawn-visit' ? '本次采用普通遮罩方法：1行动、0灵性、4秒，不点起光。芦影仍须当前同意，实际站在入口，且同一遮罩已经放在屏架上。之后也须由它沿侧路实际退回，再归还遮罩。' : '本次采用普通方法：先付3灵性、4秒建立照明，随后须停光、关好遮光闸，再普通返程。' : confirmedCase?.id === 'marker-path' ? '本次支付7灵性、10秒，进行意志20检定；成功只打开最多20秒的定向光辉窗口。必须另行陪同玛拉实走6米，再核读4秒，才算实际应用。失败仍付成本，可改用现有油灯。' : '本次先付3灵性、4秒建立照明，再付6灵性、6秒进行知识20检定，合计9灵性、10秒。成功只打开最多20秒的收光窗口；失败保留普通照明和已付消耗，仍须明确停光。'}</p>
        <p>{confirmedCase?.id === 'withdrawn-visit' ? '芦影撤回探访许可后不得继续本次实际应用；即使检定成功，也不能凭窗口领取掌握。它须在光灭且重新同意后，才可沿侧路实际来访。' : '实际应用须满足当前许可、光路、位置与遮罩条件。成功开窗后没有实际应用，就不增加新技巧掌握。'}停光与普通收尾不退灵性。</p>
        {resources('逐光者实施确认当前资源')}
      </>}
      {liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' && <><p>与同一欧文·赛尔承担真实冲突。当前遮光闸、灯油与磨损直接延续，双方有独立身体和灵性；开战可能导致伤势、撤退或死亡。</p>{resources('逐光者开战确认当前资源')}<p>玛拉与芦影必须已实际离开交战位置。有限收光不会自动排除友军，也不会替你抵挡棍击。</p></>}
      {liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button type="button" ref={cancel} className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button></div>
      <p className="slice-muted">取消只关闭未提交的确认。提交后等待同一次保存回执，不重复付费；实际停光和退出仍须现场操作。</p>
    </dialog>}
  </section>;
}
