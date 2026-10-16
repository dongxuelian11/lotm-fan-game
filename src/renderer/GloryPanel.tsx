import { useEffect, useRef, useState } from 'react';
import type { GloryAction, GloryCommand, GloryProjection } from '../domain/glory/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const RETURN = new Set(['RETURN_PLATE', 'RETURN_ACTOR', 'REMOVE_PAD', 'STOP', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const CONFIRM = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'OBSERVE', 'PREPARE', 'TEMPER_ARMOR', 'RAISE_GUARD', 'APPLY_LOAD', 'CROSS_BRIDGE', 'ORDINARY_CROSS', 'RETURN_ACTOR', 'WEAR_PAD', 'REMOVE_PAD', 'WALK', 'REPORT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const POSITION: Record<string, string> = { ENTRY: '修护室门口（0米）', BENCH: '修护台旁（2米）', BRIDGE: '短桥另一端（8米）', OUTSIDE: '室外（门口外2米）', YARD: '独立庭院（门口外4米）' };
const CONSENT: Record<string, string> = { UNASKED: '本案尚未询问', GRANTED: '已同意本案用途', WITHDRAWN: '已撤回本案许可', CLOSED: '本案许可已结束' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '已收束，待报告', RESOLVED: '已报告或结束', READY: '已到场交谈', FIGHTING: '交战中', RETREATED: '已撤退', LOST: '本人已死亡' };
const POWER: Record<string, string> = { FORCE_STRIKE: '灵性重击（每次5灵性）', GUARD: '一次屏护（每次4灵性）', DISCERN: '辨识护持（每次3灵性）' };
const ABILITY: Record<string, string> = { 'warrior.s2.armor-temper': '银甲淬护', 'warrior.s2.close-guard': '近身护持' };
type Confirmation = { id: string; facts: string };
type Attempt = NonNullable<GloryProjection['life']['currentAttempt']>;

export interface GloryPanelProps {
  value: GloryProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: GloryCommand) => void;
  /** Navigation only. Closing a page never stops a load or moves a body. */
  onClose?: () => void;
}

/** Only committed public facts are shown. The exact projected command is submitted once. */
export function GloryPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: GloryPanelProps) {
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
  const next = recommendedAction();
  const immediate = currentActions.filter(a => a.enabled || a === next);
  const liveConfirmation = confirmation?.facts === facts ? value.actions.find(a => a.id === confirmation.id) : undefined;
  const confirmedBottle = liveConfirmation && 'bottleId' in liveConfirmation.command
    ? value.bottles.find(b => 'bottleId' in liveConfirmation.command && b.id === liveConfirmation.command.bottleId) : undefined;
  const sceneLocked = value.insideCase || life.inside || encounter.inside || value.preparedWeek !== null;

  // Guidance only selects already-enabled public actions; it never invents or runs a step.
  function recommendedAction() {
    const enabled = currentActions.filter(a => a.enabled);
    const type = (...types: string[]) => enabled.find(a => types.includes(a.command.type));
    const walk = (to: string) => enabled.find(a => a.command.type === 'WALK' && a.command.to === to);
    if (!value.promoted) return type('CONSUME') ?? enabled[0] ?? currentActions[0];
    if (encounter.inside) return type('ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER') ?? currentActions[0];
    const a = life.currentAttempt, p = life.site;
    if (!a) return enabled[0] ?? currentActions[0];
    if (a.permissionWithdrawn && !a.stopped) return type('STOP') ?? enabled[0];
    const withdrawal = type('WITHDRAW_PERMISSION');
    if (withdrawal) return withdrawal;
    if (!a.stopped && !a.permissionWithdrawn) {
      if (selected?.id === 'armor-temper' && !a.loadApplied) {
        const work = type('WEAR_PAD', 'TEMPER_ARMOR', 'APPLY_LOAD');
        if (work) return work;
      }
      if (selected?.id !== 'armor-temper' && !a.crossed) {
        const crossing = type('RAISE_GUARD', 'CROSS_BRIDGE', 'ORDINARY_CROSS');
        if (crossing) return crossing;
      }
    }
    if (a.permissionWithdrawn && a.stopped && !a.crossed) {
      const ordinary = type('ORDINARY_CROSS');
      if (ordinary) return ordinary;
    }
    if (!a.stopped) return type('STOP') ?? enabled[0];
    if (p.pads.worn) return type('REMOVE_PAD') ?? enabled[0];
    if (a.crossed && !a.actorReturned) return type('RETURN_ACTOR') ?? enabled[0];
    if (!a.plateReturned) return type('RETURN_PLATE') ?? walk('BENCH') ?? enabled[0];
    if (p.playerLocation !== 'ENTRY') return walk('ENTRY') ?? enabled[0];
    return type('INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT') ?? enabled[0] ?? currentActions[0];
  }

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    // A failed save must release the native top layer so the parent can retry
    // its retained envelope. Keep the submission lock until committed facts change.
    if (error !== null && confirmation) { dialog.current?.close?.(); setConfirmation(null); return; }
    // Error dismissal and an unchanged cloned projection do not acknowledge persistence.
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

  function submit(action: GloryAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id); onCommand(action.command);
  }
  function choose(action: GloryAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (CONFIRM.has(action.command.type)) {
      if (action.command.type === 'CONSUME' && !value.bottles.some(b => 'bottleId' in action.command && b.id === action.command.bottleId)) return;
      returnActionId.current = action.id; setConfirmation({ id: action.id, facts });
    } else submit(action);
  }
  function actions(entries: GloryAction[], label: string) {
    return entries.length > 0 && <div role="group" aria-label={label} className="warrior-action-list">{entries.map(a => <div className="seer-action warrior-compact-action" key={a.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !a.enabled}
        aria-describedby={a.reason ? `glory-reason-${a.id}` : undefined}
        ref={node => { if (node) buttons.current.set(a.id, node); else buttons.current.delete(a.id); }}
        onClick={() => choose(a)}><strong>{a.label}</strong><span className="slice-modifiers">{a.cost}</span></button>
      {a.reason && <p id={`glory-reason-${a.id}`} className="seer-action-reason">{a.reason}</p>}
    </div>)}</div>;
  }
  function resources(label = '荣耀者当前资源') {
    const r = value.resources;
    return r && <section aria-label={label} className="seer-current-resources"><h3>当前身体与资源</h3><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health}/{r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind}/{r.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{r.spirituality}/{r.maxSpirituality}</dd></div><div><dt>排异</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>本周行动</dt><dd>{r.actionsRemaining}</dd></div>
      {value.promoted && life.site.introducedWeek !== null && <div><dt>本场精力</dt><dd>{life.site.playerEnergy}/100</dd></div>}
    </dl></section>;
  }
  function siteFacts() {
    const p = life.site, armor = p.armor;
    return <section className="seer-current-case" aria-label="荣耀者同一银甲与当前物资"><h3>同一银甲与实际耗用</h3>
      <p>白银骑士时期的银甲继续由本人持有。旧记录只反映当时的状态；下方当前完整度记录同一件银甲此后的实际磨损。</p>
      <dl className="seer-facts">
        <div><dt>白银骑士时期留存完整度</dt><dd>{life.historicalArmorIntegrity}/100 · 当时已形成、已停止作用</dd></div>
        <div><dt>同一件银甲当前完整度</dt><dd>{armor === null ? '尚未当面核对' : `${armor.integrity}/100`}</dd></div>
        <div><dt>目前穿戴</dt><dd>{p.armorWorn ? '本人正在穿戴' : '本人未穿戴'}；{armor?.formed ? '仍为已形成的原甲' : '尚未核对已形成银甲'}</dd></div>
        <div><dt>淬护窗口</dt><dd>{p.temper.active && p.temper.expiresAt !== null ? `还剩${Math.max(0, p.temper.expiresAt - p.clockSeconds)}秒` : '当前没有有效淬护'}</dd></div>
      </dl>
      <p className="slice-muted">原物编号：{life.armorIdentity}。晋升、换案、停止与重新进入页面都不修复磨损。</p>
      {p.introducedWeek === null ? <p>尚未亲自观察修护室。先当面核对同一银甲、原负载与普通退路。</p> : <>
        <p>第{p.introducedWeek}周亲自登记{p.introducedDate && `，${p.introducedDate.year}年${p.introducedDate.month}月${p.introducedDate.day}日`}。累计现场时间{p.clockSeconds}秒。</p>
        <dl className="seer-facts">
          <div><dt>安全垫片</dt><dd>剩余{p.pads.remaining}枚 · 已耗{p.pads.consumed}枚 · {p.pads.worn ? '本人已穿好' : p.pads.location === 'PLAYER' ? '本人携带，尚未穿好' : '已在修护台'}</dd></div>
          <div><dt>原校准负载</dt><dd>{p.load.kilograms}千克 · 剩余{p.load.remainingLoads}次 · 已施加{p.load.appliedLoads}次 · 限位装置已接合</dd></div>
          <div><dt>桥面与普通侧路</dt><dd>桥面{p.bridge.metres}米，侧路{p.bridge.sidePathMetres}米；普通侧路开放</dd></div>
          <div><dt>已经实际过桥</dt><dd>桥面{p.bridge.crossings}次 · 普通侧路{p.bridge.ordinaryCrossings}次</dd></div>
          <div><dt>当前近护</dt><dd>{p.guard.active && p.guard.expiresAt !== null ? `${p.guard.actorId === p.celia.id ? p.celia.name : p.evan.name} · 还剩${Math.max(0, p.guard.expiresAt - p.clockSeconds)}秒` : '当前没有生效的同伴近护'}</dd></div>
          <div><dt>修护室已付分担负担</dt><dd>{p.guard.sharedHealth}健康 · {p.guard.sharedEnergy}额外精力；普通行走另计</dd></div>
        </dl>
        <h4>各案实付护片</h4>{p.plates.length ? <ul>{p.plates.map(plate => <li key={plate.id}>{life.cases.find(c => c.id === plate.caseId)?.title ?? '本案'}：第{plate.preparedWeek}周实付{plate.paidPennies}便士，{plate.charges ? '尚未耗用' : '已经耗尽'}，{plate.location === 'PLAYER' ? '本人随身，仍须交回修护台' : '已实际交回修护台'}。</li>)}</ul> : <p>尚未支付或领取本案护片。</p>}
        <p>安全垫片由西莉娅保管。原负载实际施加才消耗垫片；有效淬护仍磨损原银甲5。已用的垫片、护片和负载不会随换案补回。</p>
      </>}
    </section>;
  }
  function peopleFacts() {
    const p = life.site, a = life.currentAttempt;
    return <section aria-label="荣耀者当前位置与本案许可"><h3>当前位置与本案许可</h3>
      {p.introducedWeek === null ? <p>尚无本人的现场行程和当面许可记录。</p> : <>
        <p>本人当前在{POSITION[p.playerLocation]}；本场精力{p.playerEnergy}/100，累计普通步行{p.playerTravelMetres}米。</p>
        <p>{p.celia.name}，{p.celia.age}岁，当前在{POSITION[p.celia.location]}；独立精力{p.celia.energy}/100，累计普通步行{p.celia.travelMetres}米。</p>
        <p>{p.evan.name}，{p.evan.age}岁，当前在{POSITION[p.evan.location]}；独立精力{p.evan.energy}/100，累计普通步行{p.evan.travelMetres}米。</p>
        {a ? <p className={a.permissionWithdrawn ? 'slice-notice seer-risk' : 'slice-notice'}>第{a.consentWeek}周本案许可：操作许可{CONSENT[a.operatorConsent]}；当事人的能力许可{CONSENT[a.ownerConsent]}；普通侧路许可{CONSENT[a.routeConsent]}。{a.permissionWithdrawn ? '当事人已撤回能力许可，不能继续施术；仍可按当前同意选择普通侧路。准备费和实际往返都会保留。' : '这次同意仅适用于本案，旧案不能代替当前答复。'}</p> : <p>当前没有正在使用的本案许可；每次新实践都须重新询问两人。</p>}
        <p>普通步行每米耗1秒、1精力，换案不补精力。近护成功后须本人和对方实际走过6米桥面，才由本人承担5健康与额外5精力；普通侧路单程8米，不增加新能力掌握。</p>
      </>}
      {a && <section aria-label="荣耀者本次尝试"><h4>本次实际经过</h4>{attemptFacts(a, false)}</section>}
    </section>;
  }
  function attemptFacts(a: Attempt, historical: boolean) {
    const succeeded = a.abilityTier === 'SUCCESS' || a.abilityTier === 'GREAT_SUCCESS';
    const window = { NONE: '尚未尝试能力', ACTIVE: '有限防护仍有效', FAILED: '检定失败', EXPIRED: '有限防护已到期', APPLIED: '已实际应用防护', STOPPED: '已经停止防护' }[a.window];
    return <div>
      <p>{historical ? '已保存经历' : '当前尝试'} · 第{a.week}周 · {a.method === 'ABILITY' ? '能力方法' : '普通方法'} · {a.closed ? '已实际收束' : '尚未收束'}。</p>
      <p>实耗{a.spiritualitySpent}灵性、{a.penniesSpent}便士、{a.energySpent}精力、{a.healthSpent}健康。实际步行{a.playerTravelMetres}米，经过{a.elapsedSeconds}秒；原银甲本案磨损{a.armorWear}。</p>
      <p>检定{a.abilityTier ? TIER[a.abilityTier] : '尚无'}；{succeeded && a.appliedAbilityIds.length === 0 ? '检定成功，但尚无实际应用。' : a.abilityTier && !succeeded ? '检定失败，已经支付的成本保留。' : ''}实际应用：{a.appliedAbilityIds.map(id => ABILITY[id]).join('、') || '无'}。</p>
      <p>{window}。原负载{a.loadApplied ? '已实际施加并消耗1枚垫片' : '本案尚未施加'}；{a.crossed ? `本人和同一参与者已实际走过${a.crossingMethod === 'BRIDGE' ? '6米桥面' : '8米普通侧路'}` : '本案尚未实际过桥'}。</p>
      <p>{a.permissionWithdrawn && '已读到当事人撤回能力许可，未强行施术。'}{a.stopped ? '已经停止新的施术。' : '本次尚未明确停止新的施术。'}原护片{a.plateReturned ? '已实际交回' : '仍须交回修护台'}，现场核实{a.inspected ? '已完成' : '尚未完成'}。</p>
      <p>只有真正应用并报告的技巧才增加8掌握；普通方法、失败、成功但未应用和撤回许可都不会冒充能力掌握。</p>
      {historical && <><p>这是当次经历，当前位置和完整度以上方当前状态为准。</p>{a.siteAtClose && <p>收束时本人在{POSITION[a.siteAtClose.playerLocation]}、精力{a.siteAtClose.playerEnergy}；当时同一银甲完整度{a.siteAtClose.armor?.integrity ?? '尚未核对'}，安全垫片剩余{a.siteAtClose.pads.remaining}枚。</p>}</>}
    </div>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="荣耀者可选遭遇"><h3>{encounter.title}</h3><p>{STATUS[encounter.status] ?? '尚未接触'}</p><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name}，{enemy.age}岁，序列{enemy.sequence}，留在独立庭院；健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120；{enemy.status === 'DEAD' ? '已死亡，原身体留在庭院' : enemy.status === 'SURRENDERED' ? '已投降，停止抵抗' : '仍有独立意志'}。</p>
        <p>他原来的一根棍：{enemy.weaponLocation === 'HAND' ? `仍在${enemy.name}手中` : '留在庭院原交战位置'}。</p>
        <p>{Object.entries(enemy.powerUses).map(([id, count]) => `${POWER[id] ?? '已记录动作'}：${count}次`).join('；')}。</p></>}
      <ul>{encounter.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
      <p>本场没有同伴参战；近身护持只用于本人守势，成功时本人承担5健康。原银甲的当前磨损以上方为准。到场和开战都不补资源，原洛肯的身体、原棍和此前结局另按旧记录保留。</p>
    </section>;
  }
  function lifeConfirmation() {
    switch (liveConfirmation?.command.type) {
      case 'TEMPER_ARMOR': return <p>支付1行动和6灵性，以知识难度20尝试淬护身上同一件原银甲。成功最多维持30秒，仍须实际施加负载才算应用，届时磨损5完整度并消耗1枚垫片。失败照付尝试成本，可由普通安全垫和限位承接。</p>;
      case 'RAISE_GUARD': return <p>支付1行动和6灵性，以意志难度20尝试照应就在身旁、当前同意的埃文。成功只形成30秒窗口；须另行实际同走6米桥面才算应用，并由本人付5健康与额外5精力。失败仍付尝试成本，可以改走普通侧路。</p>;
      case 'APPLY_LOAD': return <p>实际施加这一次12千克校准负载，消耗1枚原安全垫片。淬护有效也会磨损同一银甲5完整度；失败或到期由普通安全垫和限位承接。实际承压、磨损与耗材都不会因停止或换案撤回。</p>;
      case 'CROSS_BRIDGE': return <p>本人和当前同意的埃文各用自己的身体步行6米、耗6秒，各付6精力。本人另承担5健康与5精力，共付11精力；不向对方转移伤害，不获得报酬。之后两人仍须沿8米普通侧路实际返回。</p>;
      case 'ORDINARY_CROSS': return <p>本人和当前同意普通路线的同一参与者，各沿8米普通侧路步行，各付8精力、耗8秒。已撤回的能力许可保持撤回，不施术、不取得新能力掌握。还须沿普通侧路一起返回并交回护片。</p>;
      case 'RETURN_ACTOR': return <p>本人和原过桥者沿8米普通侧路一起返回修护台，各付8精力、耗8秒。此前的施术、护片费用和个人负担保持；随后还须交回护片，再由本人步行2米回到门口。</p>;
      case 'WEAR_PAD': return <p>在修护台亲手穿好本案有限的原安全垫和已有银甲。穿戴不会补充垫片，也不会修复银甲；负载使用后须先停止防护，再实际脱下并交回安全垫。</p>;
      case 'REMOVE_PAD': return <p>本人在修护台、有限防护已经停止，亲手脱下并交回同一安全垫。已耗垫片和银甲磨损保持；银甲仍归本人所有。</p>;
      default: return null;
    }
  }
  return <section className="seer-panel warrior-panel glory-panel" aria-label="荣耀者" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="荣耀者当前目标"><span className="seer-seal">{value.promoted ? '荣耀者 · 战士途径序列2' : '白银骑士3 → 荣耀者2'}</span>
      <h2 ref={heading} tabIndex={-1}>{value.title}</h2><p>{value.story ?? life.story}</p>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 || encounter.status === 'LOST' ? '本周目已经死亡，原身体、原人和原物记录只读保留。' : next ? `${next.label} · ${next.cost}${!next.enabled && next.reason ? `。${next.reason}` : ''}` : '当前没有待提交的现场步骤，可查看已保存经历或继续普通生活。'}</p>
      <p>{value.digestion}</p><p>十八项已有掌握保留；银甲淬护与近身护持两项新技巧从0开始，实际应用后分别记录。</p>
    </section>
    {resources()}
    <p className="slice-notice seer-risk">{value.risk}</p>
    {error !== null && <p role="alert">{typeof error === 'string' ? error : error.message} 当前仍显示上次已保存事实。{typeof error !== 'string' && error.retryable === false ? '请按保存错误提示重新加载。' : '请使用保存错误处的重试，继续同一操作；此处不会重复提交。'}</p>}
    {(busy || submittedId !== null) && <p role="status" aria-live="polite">正在等待同一次操作的保存回执；重复点击、清除错误或时间经过都不会再次扣除资源。</p>}
    {blocked && <p role="status">请先处理当前阻塞事项。本页暂不能提交新操作。</p>}

    {!value.promoted && <section aria-label="荣耀者独立药瓶与准备"><h3>成品魔药与三项专业准备</h3><p>{value.supplies}</p>
      <label className="seer-case-selector">查看药瓶<select value={bottle?.id ?? ''} disabled={locked || confirmation !== null} onChange={e => setBottleId(e.target.value)}>
        {value.bottles.map(b => <option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}
      </select></label>
      {bottle && <article><h4>{bottle.title}</h4><p>{bottle.source}</p><p>当前状态：{bottle.status} · 当前成功率{bottle.chance}%</p></article>}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>当次场地检查：{value.preparedWeek === null ? '尚未进行' : `第${value.preparedWeek}周已完成`}。指导、购买、准备与服药分别确认，不会自动饮用。</p>
      <p>须从实际白银骑士晋升周起满12整周、消化100，并完成三项各1行动的准备。服药当周另付1行动与140便士检查场地；退出会结束本次检查，未服原瓶保留，费用不退。</p>
      <p>现有原瓶全部失败耗尽后，须花1行动申请下一批，再等下一真实周确认到货；新原瓶仍逐瓶付费。专业交接处只供应成品，当前没有自行调配所需的完整配方。</p>
    </section>}
    {value.promoted && <><section aria-label="荣耀者两项新技巧"><h3>两项新技巧</h3>{value.abilities.filter(a => Object.hasOwn(ABILITY, a.id)).map(a => <p key={a.id}><strong>{a.label} · 掌握{a.mastery}</strong>：{a.description}</p>)}</section>{siteFacts()}{peopleFacts()}
      {!encounter.inside && <section className="seer-current-case" aria-label="荣耀者当前实践"><h3>本次实践</h3>
        <label className="seer-case-selector">查看实践<select value={selected?.id ?? ''} disabled={locked || confirmation !== null || sceneLocked} onChange={e => setCaseId(e.target.value)}>
          {life.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? '已有记录'}</option>)}
        </select></label>
        {selected && <><h4>{selected.title} · {STATUS[selected.status] ?? '已有记录'}</h4><p>{selected.story}</p><ul>{selected.observations.map((fact, i) => <li key={i}>{fact}</li>)}</ul>{selected.result && <p className="slice-notice">{selected.result}</p>}
          {!life.currentAttempt && selected.attempts.at(-1) && <section aria-label="荣耀者本案最近记录"><h4>本案最近的已保存经历</h4>{attemptFacts(selected.attempts.at(-1)!, true)}</section>}
        </>}
      </section>}
      {encounter.inside && encounterFacts()}
    </>}
    <section aria-label="荣耀者当前行动"><h3>{sceneLocked ? '当前现场的下一步' : '当前可选行动'}</h3>
      {actions(immediate.filter(a => !RETURN.has(a.command.type)), '荣耀者当前步骤')}
      {immediate.some(a => RETURN.has(a.command.type)) && <section aria-label="荣耀者实际归还与普通收尾"><h4>{value.promoted ? '停止、归还与普通返回' : '实际结束本次准备'}</h4>
        {actions(immediate.filter(a => RETURN.has(a.command.type)), '荣耀者实际停止与返回')}
        <p>{value.promoted ? '停止作用、归还本案护具、亲自走回门口与核实现场分别完成。已付费用、承受的负担和甲片磨损都会保留；0行动也照常支付标明的精力与时间。' : '结束准备会使当次检查失效，原瓶仍保留；下次服药须重新检查并付费。'}</p>
      </section>}
      {currentActions.some(a => !immediate.includes(a)) && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actions(currentActions.filter(a => !immediate.includes(a)), '荣耀者未满足条件的步骤')}</details>}
    </section>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>庭院里的可选冲突</summary>{encounterFacts()}{actions(battle, '荣耀者可选遭遇行动')}</details>}
    {value.promoted && <details className="seer-fold"><summary>独立药瓶与专业准备记录</summary><p>{value.supplies}</p>
      {value.bottles.map(b => <article key={b.id}><h4>{b.title}</h4><p>{b.source}</p><p>已保存状态：{b.status}</p></article>)}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>已经饮用的原瓶已耗尽，未用原瓶仍按各自交付状态保留。</p>
    </details>}
    {value.promoted && <details className="seer-fold"><summary>三案经历与实际应用</summary><p>{life.story}</p>
      {life.cases.map(c => <article key={c.id}><h4>{c.title} · {STATUS[c.status] ?? '已有记录'}</h4><p>{c.result ?? '尚无已报告结果。'} · 已实际收束{c.closes}次。</p>{c.attempts.map((a, i) => <div key={i}>{attemptFacts(a, true)}</div>)}</article>)}
      <p>报告已经实际完成的经过才记录本案消化；成功但尚未应用、失败与普通方法不会冒充新技巧掌握。</p>
    </details>}
    <details className="seer-fold"><summary>身体与已有经历</summary>
      <p>当前身体性别：{GENDER[value.currentGender] ?? value.currentGender}。十八项已有掌握保持原值；晋升不补满当前灵性，不清除旧伤，也不改变身体性别。</p>
      <ul>{value.inheritedHistory.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
      {value.abilities.some(a => !Object.hasOwn(ABILITY, a.id)) && <section aria-label="荣耀者十八项已有掌握"><h4>已有技巧与实际掌握</h4>{value.abilities.filter(a => !Object.hasOwn(ABILITY, a.id)).map(a => <p key={a.id}><strong>{a.label} · 掌握{a.mastery}</strong>：{a.description}</p>)}</section>}
      <p>{life.environment}</p>
      <p>原训练同伴、借用器物、已耗尽的遗骸和祝福，以及此前敌人的结局都按原经历保留。旧阶段页面只供查看已有记录，不会重开旧实践、发放原物或恢复伤势。</p>
    </details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || sceneLocked || confirmation !== null} onClick={() => { if (!locked && !sceneLocked && !confirmation) onClose(); }}>关闭荣耀者页面</button>}

    {confirmation && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="glory-confirm-title" aria-describedby="glory-confirm-cost"
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
      <h3 id="glory-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一药瓶' : '确认本次消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '当前条件已改变，请返回最新状态。'}</p><p id="glory-confirm-cost">{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%；当次检查{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p></>}
      {liveConfirmation?.command.type === 'CONSUME' && <><p className="slice-notice seer-risk">{value.risk}</p>
        <p>本瓶和当次检查无论成功失败都会耗尽，已经付出的费用不退。失败须恢复身体、取得另一独立原瓶并重新检查；不能撤回已经提交的饮用。</p>
        <p>十八项已有掌握、当前性别、伤势与过去人物原物保持。成功才新增两项初始掌握；不免费治疗、不补满当前灵性，也不修复原银甲。</p>
      </>}
      {liveConfirmation?.command.type === 'LEARN_GUIDANCE' && <p>本次只听取专业指导并支付500便士和1行动。取得独立原瓶、检查场地与饮用分别选择、分别确认。</p>}
      {liveConfirmation?.command.type === 'BUY_POTION' && <p>本次只支付按钮列明的余款并领取所选独立原瓶，不会自动检查场地或饮用。</p>}
      {liveConfirmation?.command.type === 'PREPARE_PROMOTION' && <p>本次支付140便士和1行动，检查只在本周有效。退出不退费用；原瓶只有另行确认饮用才消耗。</p>}
      {liveConfirmation?.command.type === 'PREPARE' && <p>本案实付20便士，领取本案护具并亲自走到修护台。{liveConfirmation.command.method === 'ORDINARY' ? '选择普通方法，不增加新能力掌握。' : '准备本身不会加强银甲，也不会替参与者走过桥面。'}随后取消、撤回许可或检定失败，已付费用和实际路程仍保留，护具须亲自交回。</p>}
      {liveConfirmation?.command.type === 'WALK' && <p>只沿普通道路走到{POSITION[liveConfirmation.command.to]}，按标明的真实距离消耗时间和精力。行走不会把参与者或银甲传送到另一处，也不会补充资源。</p>}
      {lifeConfirmation()}
      {liveConfirmation?.command.type === 'ENCOUNTER_TALK' && <p>取得本次同意后，两位修护室参与者各普通步行4米到室外，各耗4秒和4精力。本人在门口花4秒穿上同一件已形成的银甲，再普通步行4米进入独立庭院，另耗4秒和4精力。到场只交谈，交战另作选择；保留2米普通退出路线及2精力。</p>}
      {liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' && <><p className="slice-notice seer-risk">你选择与45岁的马丁真正交战。双方使用各自身体、武器和灵性，可能受伤、撤退或死亡。</p><p>两位修护室参与者已实际离开交战位置。本场没有同伴；近身护持只用于本人守势，成功时本人另付5健康。银甲淬护沿用已有银甲并会实际磨损。开战不会治疗伤势、修复银甲或补满资源。</p></>}
      {liveConfirmation?.command.type === 'LEAVE_ENCOUNTER' && <p>本人沿普通出口步行2米，耗2秒和2精力。马丁和他的原棍留在庭院，两位修护室参与者仍在室外；这一步不恢复任何人的资源。</p>}
      {resources('荣耀者操作确认当前资源')}
      {liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button type="button" ref={cancel} className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button></div>
      <p className="slice-muted">取消不提交、不扣资源。提交后等待同一次保存回执；关闭确认或页面不能代替实际停止、归还与普通返回。</p>
    </dialog>}
  </section>;
}
