import { useEffect, useRef, useState } from 'react';
import type { FateTrojanAction, FateTrojanCommand, FateTrojanProjection } from '../domain/fate-trojan/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const RETURN = new Set(['RETURN_LINK', 'RETURN_SEAL', 'CLOSE_CABINET', 'STOP', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const CONFIRM = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'OBSERVE', 'PREPARE', 'TAKE_IDENTITY', 'TAKE_FATE', 'OPEN_CABINET', 'RETURN_LINK', 'CARRY_PARCEL', 'WALK', 'REPORT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const POSITION: Record<string, string> = { ENTRY: '登记室门口（0米）', DESK: '登记桌旁（2米）', CABINET: '原柜前（6米）', OUTSIDE: '室外（门口外2米）', YARD: '独立庭院（门口外4米）' };
const CONSENT: Record<string, string> = { UNASKED: '本案尚未询问', GRANTED: '已同意本案用途', WITHDRAWN: '已撤回本案许可', CLOSED: '本案许可已结束' };
const WINDOW: Record<string, string> = { NONE: '尚未形成身份窗口', ACTIVE: '身份窗口仍有效', FAILED: '检定失败，未取得联系', EXPIRED: '身份窗口已到期，仍须实际归还', RETURNED: '同一联系已实际归还' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '已收束，待报告', RESOLVED: '已报告或结束', READY: '已到场交谈', FIGHTING: '交战中', RETREATED: '已撤退', LOST: '本人已死亡' };
const POWER: Record<string, string> = { FORCE_STRIKE: '灵性冲击（每次5灵性）', GUARD: '一次屏护（每次4灵性）', DISCERN: '辨识联系（每次3灵性）' };
const ABILITY: Record<string, string> = { 'error.s2.identity-link': '身份关联', 'error.s2.fate-assumption': '命运承担' };
type Confirmation = { id: string; facts: string };
type Attempt = NonNullable<FateTrojanProjection['life']['currentAttempt']>;

export interface FateTrojanPanelProps {
  value: FateTrojanProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: FateTrojanCommand) => void;
  /** Navigation only. It does not return a link, cancel an obligation or move anyone. */
  onClose?: () => void;
}

/** Displays committed public facts and submits the corresponding original action object. */
export function FateTrojanPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: FateTrojanPanelProps) {
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

  // These suggestions select only already enabled public actions; they never execute a step.
  function recommendedAction() {
    const enabled = currentActions.filter(a => a.enabled);
    const type = (...types: string[]) => enabled.find(a => types.includes(a.command.type));
    const walk = (to: string) => enabled.find(a => a.command.type === 'WALK' && a.command.to === to);
    const a = life.currentAttempt, p = life.site;
    if (!value.promoted) return type('CONSUME') ?? enabled.find(a => !RETURN.has(a.command.type)) ?? enabled[0] ?? currentActions[0];
    if (encounter.inside) return type('ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER') ?? currentActions[0];
    if (!a) return enabled.find(a => !RETURN.has(a.command.type)) ?? enabled[0] ?? currentActions[0];
    const start = type('WITHDRAW_PERMISSION', 'TAKE_IDENTITY', 'TAKE_FATE');
    if (start) return start;
    const ordinaryIdentityDone = p.cabinet.ownerOpenings > a.siteAtStart.cabinet.ownerOpenings;
    const wantsIdentity = selected?.id === 'identity-link' && !a.identityUsed && !ordinaryIdentityDone && !a.stopped && !a.permissionWithdrawn
      && (a.method === 'ORDINARY' || a.window === 'ACTIVE' && (p.playerLocation === 'CABINET' ? life.playerCanOpenCabinet : p.link.windowExpiresAt !== null && p.link.windowExpiresAt - p.clockSeconds >= 8));
    const wantsParcel = selected?.id === 'fate-assumption' && !a.parcelCarried && (p.fate.status === 'ASSUMED' || !a.stopped && !a.permissionWithdrawn);
    if (wantsIdentity || wantsParcel) {
      const apply = type('CARRY_PARCEL', 'OPEN_CABINET') ?? walk('CABINET');
      if (apply) return apply;
    }
    if (p.cabinet.open) return type('CLOSE_CABINET') ?? walk('CABINET') ?? enabled[0];
    if (p.link.returnPending) return type('RETURN_LINK') ?? walk('DESK') ?? enabled[0];
    if (!a.stopped) return type('STOP') ?? enabled[0];
    if (!a.sealReturned) return type('RETURN_SEAL') ?? walk('DESK') ?? enabled[0];
    if (p.playerLocation !== 'ENTRY') return walk('ENTRY') ?? enabled[0];
    return type('INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT') ?? enabled[0] ?? currentActions[0];
  }

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    // A cleared error or an unchanged cloned projection is not a save receipt.
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

  function submit(action: FateTrojanAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id); onCommand(action.command);
  }
  function choose(action: FateTrojanAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (CONFIRM.has(action.command.type)) {
      if (action.command.type === 'CONSUME' && !value.bottles.some(b => 'bottleId' in action.command && b.id === action.command.bottleId)) return;
      returnActionId.current = action.id; setConfirmation({ id: action.id, facts });
    } else submit(action);
  }
  function actions(entries: FateTrojanAction[], label: string) {
    return entries.length > 0 && <div role="group" aria-label={label} className="warrior-action-list">{entries.map(a => <div className="seer-action warrior-compact-action" key={a.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !a.enabled}
        aria-describedby={a.reason ? `fate-trojan-reason-${a.id}` : undefined}
        ref={node => { if (node) buttons.current.set(a.id, node); else buttons.current.delete(a.id); }}
        onClick={() => choose(a)}><strong>{a.label}</strong><span className="slice-modifiers">{a.cost}</span></button>
      {a.reason && <p id={`fate-trojan-reason-${a.id}`} className="seer-action-reason">{a.reason}</p>}
    </div>)}</div>;
  }
  function resources(label = '命运木马当前资源') {
    const r = value.resources;
    return r && <section aria-label={label} className="seer-current-resources"><h3>当前身体与资源</h3><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health}/{r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind}/{r.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{r.spirituality}/{r.maxSpirituality}</dd></div><div><dt>排异</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>本周行动</dt><dd>{r.actionsRemaining}</dd></div>
      {value.promoted && life.site.introducedWeek !== null && <div><dt>本场精力</dt><dd>{life.site.playerEnergy}/100</dd></div>}
    </dl></section>;
  }
  function siteFacts() {
    const p = life.site;
    return <section className="seer-current-case" aria-label="命运木马登记室当前实况"><h3>原人、原柜与当前责任</h3>
      <p>门口0米，登记桌2米，原柜6米，室外在门口外2米。累计现场时间{p.clockSeconds}秒。</p>
      {p.introducedWeek === null ? <p>尚未亲自观察登记室。先当面核对原人、原柜的识别联系和待搬的原包裹。</p> : <>
        <p>第{p.introducedWeek}周亲自登记{p.introducedDate && `，${p.introducedDate.year}年${p.introducedDate.month}月${p.introducedDate.day}日`}。</p>
        <dl className="seer-facts">
          <div><dt>唯一原柜</dt><dd>始终归维克托所有 · {p.cabinet.open ? '柜门已打开' : '柜门已合上'}</dd></div>
          <div><dt>原柜目前识别谁</dt><dd>{p.cabinet.recognitionHolder === 'OWNER' ? '维克托' : '本人'} · 本人实际开柜{p.cabinet.playerOpenings}次，原主普通开柜{p.cabinet.ownerOpenings}次</dd></div>
          <div><dt>同一身份联系</dt><dd>原主为维克托 · 当前由{p.link.holder === 'OWNER' ? '维克托' : '本人'}持有</dd></div>
          <div><dt>身份联系归还</dt><dd>{p.link.returnPending ? '仍欠当面归还，另付4灵性' : '没有尚欠的身份联系'}</dd></div>
          <div><dt>当前使用条件</dt><dd>{life.playerCanOpenCabinet ? '本人可在剩余窗口内使用联系' : '本人当前不能使用这份联系'}；{life.ownerCanOpenCabinet ? '原主可使用自己的联系' : '原主当前不能使用该联系'}</dd></div>
          <div><dt>身份窗口</dt><dd>{p.link.windowExpiresAt === null ? '当前没有身份窗口' : `剩余${Math.max(0, p.link.windowExpiresAt - p.clockSeconds)}秒；到期仍须归还`}</dd></div>
          <div><dt>唯一原包裹</dt><dd>始终归维克托所有 · {p.parcel.location === 'CABINET' ? '在原柜内' : '已在室外'} · 实际搬运{p.parcel.ordinaryMetres}米{p.parcel.carriedBy === 'PLAYER' && '，由本人完成'}</dd></div>
          <div><dt>这一次搬运</dt><dd>{p.fate.status === 'COMPLETED' ? '已经实际完成' : p.fate.status === 'ASSUMED' ? '本人已接下，仍须亲自完成' : '原主原先的待办尚未完成'}</dd></div>
          <div><dt>当前责任人</dt><dd>{p.fate.debtor === 'OWNER' ? '维克托' : '本人'} · {p.fate.ownerRelieved ? '维克托已免除这一次待办' : '维克托未因能力免除这一次待办'}</dd></div>
          <div><dt>原报酬</dt><dd>约定{p.fate.offeredPennies}便士，暂存{p.fate.escrowPennies}便士，已付本人{p.fate.paidToPlayer}便士 · 当前受益人为{p.fate.benefitRecipient === 'OWNER' ? '维克托' : '本人'}</dd></div>
          <div><dt>实际搬运负担</dt><dd>完成时付{p.fate.burdenHealth}健康、{p.fate.burdenEnergy}精力；已付{p.fate.incurredHealth}健康、{p.fate.incurredEnergy}精力，普通行走另计</dd></div>
        </dl>
        <p className={p.link.returnPending || p.fate.status === 'ASSUMED' ? 'slice-notice seer-risk' : 'slice-notice'}>身份窗口到期、停止施术和关闭页面都不会归还联系，也不会免除已经接下的搬运。原人身体、姓名、原柜与原包裹的所有权始终保持。</p>
        <h4>各案原封签</h4>{p.seals.length ? <ul>{p.seals.map(seal => <li key={seal.id}>{life.cases.find(c => c.id === seal.caseId)?.title ?? '本案'}的唯一封签：第{seal.preparedWeek}周实付{seal.paidPennies}便士，{seal.charges ? '尚未使用' : '已经用尽'}，{seal.location === 'PLAYER' ? '本人随身，仍须交回莉娜' : '已在登记桌交回莉娜'}。</li>)}</ul> : <p>尚未支付或领取本案封签。</p>}
      </>}
    </section>;
  }
  function peopleFacts() {
    const p = life.site, a = life.currentAttempt;
    return <section aria-label="命运木马本人及原人位置与当前许可"><h3>当前位置与本案许可</h3>
      {p.introducedWeek === null ? <p>尚无本人的现场行程和当面许可记录。</p> : <>
        <p>本人当前在{POSITION[p.playerLocation]}；本场精力{p.playerEnergy}/100，累计普通步行{p.playerTravelMetres}米。</p>
        <p>{p.lina.name}，{p.lina.age}岁，负责记录，当前在{POSITION[p.lina.location]}；独立精力{p.lina.energy}/100，累计普通步行{p.lina.travelMetres}米。</p>
        <p>{p.victor.name}，{p.victor.age}岁，是原柜、原包裹和原识别联系的主人，当前在{POSITION[p.victor.location]}；独立精力{p.victor.energy}/100，累计普通步行{p.victor.travelMetres}米。</p>
        {a ? <p className={a.permissionWithdrawn ? 'slice-notice seer-risk' : 'slice-notice'}>第{a.consentWeek}周本案许可：莉娜{CONSENT[a.operatorConsent]}；维克托{CONSENT[a.ownerConsent]}。{a.permissionWithdrawn ? '准备费已经实付。原主撤回后不得取得联系，仍须交回原封签并亲自走回门口。' : '这次同意仅适用于本案；旧案不能代替当前答复。'}</p> : <p>当前没有正在使用的本案许可；每次新实践都须重新询问两人。</p>}
        <p>普通步行每米耗1秒、1精力，换案不补精力。亲自把原包裹从柜内搬到室外需8米步行，另付5健康与5精力负担，完成后才收到12便士。</p>
      </>}
      {a && <section aria-label="命运木马本次尝试"><h4>本次实际经过</h4>{attemptFacts(a, false)}</section>}
    </section>;
  }
  function attemptFacts(a: Attempt, historical: boolean) {
    const end = historical ? a.siteAtClose?.clockSeconds ?? life.site.clockSeconds : life.site.clockSeconds;
    const succeeded = a.abilityTier === 'SUCCESS' || a.abilityTier === 'GREAT_SUCCESS';
    return <div>
      <p>{historical ? '已保存经历' : '当前尝试'} · 第{a.week}周 · {a.method === 'ABILITY' ? '能力方法' : '普通方法'} · {a.closed ? '已实际收束' : '尚未收束'}。</p>
      <p>实耗{a.spiritualitySpent}灵性、{a.penniesSpent}便士、{a.energySpent}精力、{a.healthSpent}健康；收到{a.benefitReceived}便士。普通步行{a.playerTravelMetres}米，实际经过{a.elapsedSeconds}秒。</p>
      <p>检定{a.abilityTier ? TIER[a.abilityTier] : '尚无'}；{succeeded && a.appliedAbilityIds.length === 0 ? '检定成功，但尚无实际应用。' : a.abilityTier === 'FAILURE' || a.abilityTier === 'GREAT_FAILURE' ? '检定失败，已经支付的成本保留。' : ''}实际应用：{a.appliedAbilityIds.length ? a.appliedAbilityIds.map(id => ABILITY[id]).join('、') : '无'}。</p>
      <p>{WINDOW[a.window]}{a.window === 'ACTIVE' && a.windowExpiresAt !== null && `，剩余${Math.max(0, a.windowExpiresAt - end)}秒`}。{a.identityTaken ? `原联系${a.linkReturned ? '已另付4灵性当面归还' : '仍欠当面归还，另需4灵性'}；${a.identityUsed ? '已在有效窗口内实际开柜' : '没有在有效窗口内实际开柜'}。` : '本次未取得原身份联系。'}</p>
      <p>{a.fateTaken ? `已接下这一次原包裹搬运，${a.parcelCarried ? '本人已亲自完成' : '仍须本人完成，停止不能免除责任'}。` : '本次没有借能力接下搬运。'}{a.parcelCarried && `同一原包裹已实际搬到室外，5健康与5精力负担已经结算，报酬实收${a.benefitReceived}便士。`}</p>
      <p>莉娜{CONSENT[a.operatorConsent]}；维克托{CONSENT[a.ownerConsent]}。{a.permissionWithdrawn && '已读到原主撤回许可，未取得联系；准备费与真实往返仍保留。'}{a.stopped ? '已经停止新的施术。' : '本次尚未明确停止新的施术。'}原封签{a.sealReturned ? '已实际交回' : '仍须交回登记桌'}，最后核实{a.inspected ? '已完成' : '尚未完成'}。</p>
      <p>只有真正应用并报告的技巧才增加8掌握；普通开柜、普通搬运、失败、成功但未应用和撤回许可都不会冒充能力掌握。</p>
      {historical && <><p>这是当次记录；当前位置和责任以上方实况为准。</p>{a.siteAtClose && <p>收束时本人在{POSITION[a.siteAtClose.playerLocation]}、精力{a.siteAtClose.playerEnergy}；原联系由{a.siteAtClose.link.holder === 'OWNER' ? '维克托' : '本人'}持有，{a.siteAtClose.link.returnPending ? '仍欠归还' : '没有尚欠归还'}；原包裹在{a.siteAtClose.parcel.location === 'CABINET' ? '原柜内' : '室外'}。</p>}</>}
    </div>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy;
    return <section aria-label="命运木马可选遭遇"><h3>{encounter.title}</h3><p>{STATUS[encounter.status] ?? '已有接触记录'}</p><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name}，{enemy.age}岁，序列{enemy.sequence}，留在独立庭院；健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120；{enemy.status === 'DEAD' ? '已死亡，原身体留在庭院' : enemy.status === 'SURRENDERED' ? '已投降，停止抵抗' : '仍有独立意志'}。</p>
        <p>他原来的一根棍：{enemy.weaponLocation === 'HAND' ? `仍在${enemy.name}手中` : '留在庭院原交战位置'}。</p>
        <p>{Object.entries(enemy.powerUses).map(([id, count]) => `${POWER[id] ?? '已记录动作'}：${count}次`).join('；')}。</p></>}
      <ul>{encounter.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
      <p>本人、莉娜、维克托、原柜、包裹和身份联系以上方当前状态为准。到场和开战都不补资源，普通死亡不会即时复活。</p>
    </section>;
  }

  return <section className="seer-panel warrior-panel fate-trojan-panel" aria-label="命运木马" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="命运木马当前目标"><span className="seer-seal">{value.promoted ? '命运木马 · 错误序列2' : '欺瞒导师3 → 命运木马2'}</span>
      <h2 ref={heading} tabIndex={-1}>{value.title}</h2><p>{value.story ?? life.story}</p>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 || encounter.status === 'LOST' ? '本周目已经死亡，原身体、原人和原物记录只读保留。' : next ? `${next.label} · ${next.cost}${!next.enabled && next.reason ? `。${next.reason}` : ''}` : '当前没有待提交的现场步骤，可查看已保存经历或继续普通生活。'}</p>
      <p>{value.digestion}</p><p>十二项已有掌握保留；身份关联与命运承担两项新技巧从0开始，实际应用后分别记录。</p>
    </section>
    {resources()}
    <p className="slice-notice seer-risk">{value.risk}</p>
    {error !== null && <p role="alert">{typeof error === 'string' ? error : error.message} 当前仍显示上次已保存事实。{typeof error !== 'string' && error.retryable === false ? '请按保存错误提示重新加载。' : '请使用保存错误处的重试，继续同一操作；此处不会重复提交。'}</p>}
    {(busy || submittedId !== null) && <p role="status" aria-live="polite">正在等待同一次操作的保存回执；重复点击、清除错误或时间经过都不会再次扣除资源。</p>}

    {!value.promoted && <section aria-label="命运木马独立药瓶与准备"><h3>成品魔药与三项专业准备</h3><p>{value.supplies}</p>
      <label className="seer-case-selector">查看药瓶<select value={bottle?.id ?? ''} disabled={locked || confirmation !== null} onChange={e => setBottleId(e.target.value)}>
        {value.bottles.map(b => <option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}
      </select></label>
      {bottle && <article><h4>{bottle.title}</h4><p>{bottle.source}</p><p>当前状态：{bottle.status} · 当前成功率{bottle.chance}%</p></article>}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>当次场地检查：{value.preparedWeek === null ? '尚未进行' : `第${value.preparedWeek}周已完成`}。购买、准备与服药分别确认，不会自动饮用。</p>
      <p>须从实际欺瞒导师晋升周起满12整周、消化100，并完成三项各1行动的准备。服药当周另付1行动与140便士检查场地；退出会结束本次检查，未服原瓶保留，费用不退。</p>
      <p>现有原瓶全部失败耗尽后，须花1行动申请下一批，再等下一真实周确认到货；新原瓶仍逐瓶付费。专业交接处只供应成品，当前没有自行调配所需的完整配方。</p>
    </section>}
    {value.promoted && <><section aria-label="命运木马两项技巧"><h3>两项新技巧</h3>{value.abilities.filter(a => Object.hasOwn(ABILITY, a.id)).map(a => <p key={a.id}><strong>{a.label} · 掌握{a.mastery}</strong>：{a.description}</p>)}</section>{siteFacts()}{peopleFacts()}
      {!encounter.inside && <section className="seer-current-case" aria-label="命运木马当前实践"><h3>本次实践</h3>
        <label className="seer-case-selector">查看实践<select value={selected?.id ?? ''} disabled={locked || confirmation !== null || life.inside || life.cases.some(c => c.status === 'PREPARED')} onChange={e => setCaseId(e.target.value)}>
          {life.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? '已有记录'}</option>)}
        </select></label>
        {selected && <><h4>{selected.title} · {STATUS[selected.status] ?? '已有记录'}</h4><p>{selected.story}</p><ul>{selected.observations.map((fact, i) => <li key={i}>{fact}</li>)}</ul>{selected.result && <p className="slice-notice">{selected.result}</p>}
          {!life.currentAttempt && selected.attempts.at(-1) && <section aria-label="命运木马本案最近记录"><h4>本案最近的已保存经历</h4>{attemptFacts(selected.attempts.at(-1)!, true)}</section>}
        </>}
      </section>}
      {encounter.inside && encounterFacts()}
    </>}
    <section aria-label="命运木马当前行动"><h3>{sceneLocked ? '当前现场的下一步' : '当前可选行动'}</h3>
      {actions(immediate.filter(a => !RETURN.has(a.command.type)), '命运木马当前步骤')}
      {immediate.some(a => RETURN.has(a.command.type)) && <section aria-label="命运木马实际归还与普通收尾"><h4>{value.promoted ? '停止、归还与普通返回' : '实际结束本次准备'}</h4>
        {actions(immediate.filter(a => RETURN.has(a.command.type)), '命运木马实际停止与返回')}
        <p>{value.promoted ? '归还身份联系另需4灵性，并须亲自回到原主所在的登记桌。已接下的搬运须实际完成；随后合柜、交签、普通返回与核实分别完成。0行动也照常支付标明的灵性、精力与时间。' : '结束准备会使当次检查失效，原瓶仍保留；下次服药须重新检查并付费。'}</p>
      </section>}
      {currentActions.some(a => !immediate.includes(a)) && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actions(currentActions.filter(a => !immediate.includes(a)), '命运木马未满足条件的步骤')}</details>}
    </section>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>庭院里的可选冲突</summary>{encounterFacts()}{actions(battle, '命运木马可选遭遇行动')}</details>}
    {value.promoted && <details className="seer-fold"><summary>独立药瓶与专业准备记录</summary><p>{value.supplies}</p>
      {value.bottles.map(b => <article key={b.id}><h4>{b.title}</h4><p>{b.source}</p><p>已保存状态：{b.status}</p></article>)}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>已经饮用的原瓶已耗尽，未用原瓶仍按各自交付状态保留；当前没有自行调配所需的完整配方。</p>
    </details>}
    <details className="seer-fold"><summary>三案经历与实际应用</summary><p>{life.story}</p>
      {life.cases.map(c => <article key={c.id}><h4>{c.title} · {STATUS[c.status] ?? '已有记录'}</h4><p>{c.result ?? '尚无已报告结果。'} · 已实际收束{c.closes}次。</p>{c.attempts.map((a, i) => <div key={i}>{attemptFacts(a, true)}</div>)}</article>)}
      <p>{value.digestion}</p>
    </details>
    <details className="seer-fold"><summary>身体与已有经历</summary>
      <p>当前身体性别：{GENDER[value.currentGender] ?? value.currentGender}。十二项已有掌握保持原值；晋升不补满当前灵性，不清除旧伤，也不改变身体性别。</p>
      <ul>{value.inheritedHistory.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
      {value.abilities.some(a => !Object.hasOwn(ABILITY, a.id)) && <section aria-label="命运木马十二项已有掌握"><h4>已有技巧与实际掌握</h4>{value.abilities.filter(a => !Object.hasOwn(ABILITY, a.id)).map(a => <p key={a.id}><strong>{a.label} · 掌握{a.mastery}</strong>：{a.description}</p>)}</section>}
      <p>{life.environment}</p>
      <p>旧宿主、本人原身体、原拉尔夫、旧工坊与原吉迪恩保留各自已有经历。查看本页不会重新发放原物，也不会复活死者。</p>
    </details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || sceneLocked || confirmation !== null} onClick={() => { if (!locked && !sceneLocked && !confirmation) onClose(); }}>关闭命运木马页面</button>}

    {confirmation && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="fate-trojan-confirm-title" aria-describedby="fate-trojan-confirm-cost"
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
      <h3 id="fate-trojan-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一药瓶' : '确认本次消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '当前条件已改变，请返回最新状态。'}</p><p id="fate-trojan-confirm-cost">{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%；当次检查{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p></>}
      {liveConfirmation?.command.type === 'CONSUME' && <><p className="slice-notice seer-risk">{value.risk}</p>
        <p>本瓶和当次检查无论成功失败都会耗尽，已经付出的费用不退。失败须恢复身体、取得另一独立原瓶并重新检查；不能撤回已经提交的饮用。</p>
        <p>十二项已有掌握、当前性别、伤势与过去人物原物保持。只新增两项初始掌握，不免费治疗、不补满当前灵性。</p>
      </>}
      {liveConfirmation?.command.type === 'PREPARE' && <p>本案实付20便士，只领取这一枚原封签，并亲自走到登记桌。{liveConfirmation.command.method === 'ORDINARY' ? '选择普通方法，不增加能力掌握。' : '准备本身不会取得身份联系，也不会替你完成搬运。'}即使随后撤回许可、取消或检定失败，已付费用和实际路程仍保留；封签须亲自交回。</p>}
      {liveConfirmation?.command.type === 'TAKE_IDENTITY' && <p>本次支付1行动、8灵性并用掉本案封签，以知识难度20尝试取得同一原柜的识别联系。成功只留下20秒窗口，原主暂不能使用该联系；你须亲自走到柜前并另花4秒开柜。之后合柜、回到原主面前并另付4灵性归还。失败仍支付尝试成本。</p>}
      {liveConfirmation?.command.type === 'TAKE_FATE' && <p>本次支付1行动、8灵性并用掉本案封签，以意志难度20尝试接下维克托已经承担的这一次搬运。成功后这件责任转给本人，停止或等待都不会免除。必须亲自搬完原包裹，实际付5健康与5精力负担，加上普通步行耗费，才收到唯一的12便士报酬。检定失败仍支付尝试成本。</p>}
      {liveConfirmation?.command.type === 'RETURN_LINK' && <p>本人已回到登记桌、原柜已合上。另付4灵性，耗时2秒，将同一识别联系当面归还维克托，使原柜重新识别原主。到期和停止都不能免除这一步；已经支付的尝试费用不退。</p>}
      {liveConfirmation?.command.type === 'CARRY_PARCEL' && <p>本人从原柜前携同一包裹步行8米到室外，耗8秒、8精力，另承受5健康与5精力负担，随后仅领取一次12便士。原包裹仍归维克托所有。还须亲自返回原柜合门、到登记桌交签并回到门口，取消不会返还负担或复制包裹。</p>}
      {liveConfirmation?.command.type === 'OPEN_CABINET' && <p>{life.site.link.holder === 'PLAYER' ? '本人在当前身份窗口内花4秒打开这一个原柜，这才算实际应用身份关联；随后仍须亲手合柜、走回登记桌并另付4灵性归还联系。' : '使用维克托自己的身份普通开柜。他本人须实际往返8米、消耗8精力，连同开柜共12秒；这不会增加身份关联掌握。'}</p>}
      {liveConfirmation?.command.type === 'WALK' && <p>这一步只沿普通道路走到{POSITION[liveConfirmation.command.to]}，按按钮标明的真实距离消耗时间和精力。行走不会归还联系、解除搬运责任或补充资源。</p>}
      {liveConfirmation?.command.type === 'ENCOUNTER_TALK' && <p>取得两人本次明确同意后，莉娜与维克托各普通步行4米到室外，各耗4秒和4精力；本人随后步行4米到独立庭院，另耗4秒和4精力。到场只交谈，是否交战另作选择；和平离场也须实际步行2米、支付2精力。</p>}
      {liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' && <><p className="slice-notice seer-risk">你选择与46岁的伊莱亚斯真正交战。双方使用自己的身体、武器和灵性，可能受伤、撤退或死亡。</p><p>莉娜与维克托已实际离开交战位置，原柜、包裹与归还的联系保持当前状态。开战不会治疗伤势或补满任何资源。</p></>}
      {liveConfirmation?.command.type === 'LEAVE_ENCOUNTER' && <p>本人从庭院沿普通出口步行2米，耗2秒和2精力。莉娜与维克托仍在室外，伊莱亚斯和他的原棍留在庭院；这一步不恢复任何人的资源。</p>}
      {resources('命运木马操作确认当前资源')}
      {liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button type="button" ref={cancel} className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button>
        <button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button></div>
      <p className="slice-muted">取消不提交、不扣资源。提交后等待同一次保存回执；关闭确认或页面不能代替实际归还、履行责任与普通返回。</p>
    </dialog>}
  </section>;
}
