import { useEffect, useRef, useState } from 'react';
import type { CalamityDemonessAction, CalamityDemonessCommand, CalamityDemonessProjection } from '../domain/calamity-demoness/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const ENCOUNTER = new Set(['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const RETURN = new Set(['REMOVE_PLATE', 'RETURN_PLATE', 'RETURN_ADULTS', 'RETURN_ROUTE', 'COLLECT_RESIDUE', 'SEALED_HANDOVER', 'CLOSE_BOX', 'STOP', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const POSITION: Record<string, string> = { ENTRY: '附廊门口（0米）', A: '原镜A前（4米）', BOX: '原收容箱前（8米）', B: '原镜B前（12米）', OUTSIDE: '接触区外（门口外2米）', YARD: '独立后院（门口外4米）', SOURCE_START: '旧馆门口', SOURCE_B: '旧馆原镜B旁' };
const SOURCE_POSITION: Record<string, string> = { START: '旧馆门口', A: '旧馆原镜A旁', B: '旧馆原镜B旁', INNER_A: '旧镜路A侧', INNER_B: '旧镜路B侧' };
const ITEM_POSITION: Record<string, string> = { SUPPLY: '尚在供给处', PLAYER: '本人携带', A: '原镜A前', BOX: '原收容箱内或箱前', CUSTODIAN: '原保管者处' };
const PLATE_STATUS: Record<string, string> = { SUPPLY: '尚未领取', PLAYER: '本人持有', INSTALLED: '已安装', CONSUMED: '已耗尽', RETURNED: '已交还' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '已明确同意', WITHDRAWN: '已撤回', CLOSED: '已结束' };
const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '已收束，待报告', RESOLVED: '已报告或结束', READY: '已到场交谈', FIGHTING: '交战中', RETREATED: '已撤退', LOST: '本人已死亡' };
const ABILITY: Record<string, string> = { 'assassin.s2.mirror-screen': '短暂镜幕', 'assassin.s2.black-flame-channel': '封闭黑焰疏导' };
const POWER: Record<string, string> = { FORCE_STRIKE: '灵性冲击（每次5灵性）', GUARD: '一次屏护（每次4灵性）', DISRUPT: '扰断镜幕（每次3灵性）' };
type Attempt = NonNullable<CalamityDemonessProjection['life']['currentAttempt']>;
type Confirmation = { id: string; facts: string };
export interface CalamityDemonessPanelProps {
  value: CalamityDemonessProjection; busy: boolean; blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: CalamityDemonessCommand) => void;
  /** Navigation only; it cannot move people, return items or stop a power. */
  onClose?: () => void;
}

/** Render committed public facts. Each action confirms and submits its exact projected command once. */
export function CalamityDemonessPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: CalamityDemonessPanelProps) {
  const [caseId, setCaseId] = useState<string | null>(null), [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null), [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null), returnActionId = useRef<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>()), heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const facts = JSON.stringify(value), locked = busy || blocked || error !== null || submittedId !== null;
  const { life, encounter } = value;
  // Once the original people enter the later encounter, its continuation is authoritative.
  const site = encounter.site ?? life.site;
  const selected = life.cases.find(c => c.id === life.activeCase) ?? life.cases.find(c => c.contactOpen || c.status === 'PREPARED')
    ?? life.cases.find(c => c.id === caseId) ?? life.cases.find(c => c.status !== 'RESOLVED') ?? life.cases[0];
  const bottle = value.bottles.find(b => b.id === bottleId)
    ?? value.bottles.find(b => value.actions.some(a => a.enabled && 'bottleId' in a.command && a.command.bottleId === b.id)) ?? value.bottles[0];
  const acquisition = value.actions.filter(a => ACQUISITION.has(a.command.type) && (!('bottleId' in a.command) || a.command.bottleId === bottle?.id));
  const battle = value.actions.filter(a => ENCOUNTER.has(a.command.type));
  const daily = value.actions.filter(a => !ACQUISITION.has(a.command.type) && !ENCOUNTER.has(a.command.type) && (!('caseId' in a.command) || a.command.caseId === selected?.id));
  const currentActions = encounter.inside ? battle : value.promoted ? daily : acquisition;
  const sceneLocked = value.insideCase || life.inside || encounter.inside || value.preparedWeek !== null;
  const next = recommendedAction(), immediate = currentActions.filter(a => a.enabled || a === next);
  const liveConfirmation = confirmation?.facts === facts ? value.actions.find(a => a.id === confirmation.id) : undefined;
  const confirmedBottle = liveConfirmation && 'bottleId' in liveConfirmation.command
    ? value.bottles.find(b => 'bottleId' in liveConfirmation.command && b.id === liveConfirmation.command.bottleId) : undefined;

  function recommendedAction() {
    const enabled = currentActions.filter(a => a.enabled);
    const type = (...types: string[]) => enabled.find(a => types.includes(a.command.type));
    const walk = (to: string) => enabled.find(a => a.command.type === 'WALK' && a.command.to === to);
    if (!value.promoted) return type('CONSUME') ?? enabled[0] ?? currentActions[0];
    if (encounter.inside) return type('ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER') ?? currentActions[0];
    const a = life.currentAttempt;
    if (!a) return enabled[0] ?? currentActions[0];
    if (a.permissionWithdrawn && !a.stopped) return type('STOP') ?? enabled[0];
    if (type('WITHDRAW_PERMISSION')) return type('WITHDRAW_PERMISSION');
    if (!a.stopped && selected?.id === 'mirror-screen' && !a.loadApplied)
      return type('INSTALL_PLATE', 'SCREEN_MIRROR', 'APPLY_LOAD') ?? walk('A') ?? enabled[0];
    if (!a.stopped && selected?.id === 'black-flame-channel' && !a.pulseApplied && !a.residueHandedOver) {
      if (!a.clearanceConfirmed && a.method === 'ABILITY') return type('MOVE_ADULTS_OUTSIDE') ?? walk('ENTRY') ?? enabled[0];
      const work = type('INSTALL_PLATE', 'CLOSE_BOX', 'CHANNEL_BLACK_FLAME', 'COLLECT_RESIDUE', 'RETURN_ADULTS', 'SEALED_HANDOVER');
      if (work) return work;
      return walk(site.residue?.location === 'PLAYER' ? 'ENTRY' : 'BOX') ?? enabled[0];
    }
    if (a.permissionWithdrawn && a.stopped && !a.routeWalked) return type('ORDINARY_ROUTE') ?? walk('A') ?? enabled[0];
    if (a.routeWalked && !a.routeReturned) return type('RETURN_ROUTE') ?? enabled[0];
    if (!a.stopped) return type('STOP') ?? enabled[0];
    const cleanup = type('CLOSE_BOX', 'COLLECT_RESIDUE', 'REMOVE_PLATE', 'RETURN_ADULTS', 'SEALED_HANDOVER', 'RETURN_PLATE');
    if (cleanup) return cleanup;
    const plate = site.plates.find(p => p.id === a.plateId);
    if (plate?.location === 'A' || plate?.location === 'BOX') return walk(plate.location) ?? enabled[0];
    if (site.playerLocation !== 'ENTRY') return walk('ENTRY') ?? enabled[0];
    return type('INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'REPORT') ?? enabled[0] ?? currentActions[0];
  }
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    // Release the native top layer so the parent can retry its retained envelope.
    // Do not release the pending-intent lock until changed committed facts arrive.
    if (error !== null && confirmation) { dialog.current?.close?.(); setConfirmation(null); return; }
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null; submittedFacts.current = null; setSubmittedId(null); setConfirmation(null); setCaseId(null); heading.current?.focus();
    } else if (confirmation && submitted.current === null && confirmation.facts !== facts) setConfirmation(null);
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) {
      if (dialog.current?.showModal && !dialog.current.open) dialog.current.showModal();
      cancel.current?.focus();
    } else if (submitted.current === null && returnActionId.current) (buttons.current.get(returnActionId.current) ?? heading.current)?.focus();
  }, [confirmation, error]);
  function choose(action: CalamityDemonessAction) {
    if (locked || confirmation !== null || submitted.current !== null || !action.enabled) return;
    if (action.command.type === 'CONSUME' && !value.bottles.some(b => 'bottleId' in action.command && b.id === action.command.bottleId)) return;
    returnActionId.current = action.id; setConfirmation({ id: action.id, facts });
  }
  function submit(action: CalamityDemonessAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id); onCommand(action.command);
  }
  function actions(entries: CalamityDemonessAction[], label: string) {
    return entries.length > 0 && <div role="group" aria-label={label} className="warrior-action-list">{entries.map(a => <div className="seer-action warrior-compact-action" key={a.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !a.enabled} aria-describedby={a.reason ? `calamity-reason-${a.id}` : undefined}
        ref={node => { if (node) buttons.current.set(a.id, node); else buttons.current.delete(a.id); }} onClick={() => choose(a)}><strong>{a.label}</strong><span className="slice-modifiers">{a.cost}</span></button>
      {a.reason && <p id={`calamity-reason-${a.id}`} className="seer-action-reason">{a.reason}</p>}
    </div>)}</div>;
  }
  function resources(label = '灾难魔女当前资源') {
    const r = value.resources;
    return r && <section aria-label={label} className="seer-current-resources"><h3>当前身体与资源</h3><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health}/{r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind}/{r.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{r.spirituality}/{r.maxSpirituality}</dd></div><div><dt>排异</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>本周行动</dt><dd>{r.actionsRemaining}</dd></div>
      {value.promoted && site.introducedWeek !== null && <div><dt>本场精力</dt><dd>{site.playerEnergy}/100</dd></div>}
    </dl></section>;
  }
  function siteFacts() {
    const p = site, source = life.historicalScene;
    return <section className="seer-current-case" aria-label="灾难魔女原镜与当前物资"><h3>同两面原镜与实际耗用</h3>
      {source ? <><p>旧馆记录留存：原镜A（{source.mirrorA.id}）{source.mirrorA.intact ? '完好' : '受损'}，原镜B（{source.mirrorB.id}）{source.mirrorB.intact ? '完好' : '受损'}；当时均属{source.vera.name}。这是旧状态留存，下面显示同一原物后来的当前状态。</p>
        <p>旧馆当时经过{source.clockSeconds}秒，本人累计行走{source.playerTravelMetres}米、在{SOURCE_POSITION[source.playerLocation]}；原入口{source.entry.held ? '尚保持' : '已结束'}，原镜B封板{source.shutter.state === 'OPEN' ? '已打开' : '已关闭'}。</p></> : <p>尚未亲自核对原馆舍的两面镜子和原人的既往位置。</p>}
      <dl className="seer-facts">{[p.mirrorA, p.mirrorB].map((mirror, index) => <div key={index}><dt>同一原镜{index === 0 ? 'A' : 'B'}当前状态</dt><dd>{mirror ? `${mirror.intact ? '完好' : '受损'} · ${POSITION[mirror.location]} · 仍属${source?.vera.name ?? '原物主'}` : '尚未当面核对'}</dd></div>)}
        <div><dt>当前镜幕</dt><dd>{p.screen.active && p.screen.expiresAt !== null ? `尚余${Math.max(0, p.screen.expiresAt - p.clockSeconds)}秒 · 对应护片${p.screen.plateId}` : '没有有效镜幕'}</dd></div>
      </dl>
      {p.introducedWeek !== null && <><p>第{p.introducedWeek}周亲自登记，累计现场时间{p.clockSeconds}秒。普通步行、尝试和等待的实际经过都保留。</p>
        <dl className="seer-facts"><div><dt>唯一封闭负载</dt><dd>{p.load.id} · 初始{p.load.initialForce}单位 · 剩余{p.load.remainingLoads}次 · 已施加{p.load.appliedLoads}次 · 实际减势{p.load.bufferedForce} · 最终{p.load.finalForce}单位</dd></div>
          <div><dt>同一收容箱</dt><dd>{p.box.id} · {p.box.state === 'CLOSED' ? '已闭合' : '尚未闭合'} · {p.box.scorched ? '焦痕仍在' : '没有焦痕'} · 实际脉冲{p.box.pulses}次/{p.box.pulseSeconds}秒 · 封装交还{p.box.handovers}次</dd></div>
          <div><dt>唯一封装残留物</dt><dd>{p.residue ? `${p.residue.id} · ${p.residue.status === 'CONSUMED' ? '已耗尽' : p.residue.status === 'HANDED_OVER' ? '已封装交还' : '仍封装保留'} · ${ITEM_POSITION[p.residue.location]}` : '尚未随本案付费准备领取'}</dd></div>
        </dl>
        {p.residue && <p>这一份虚构、非生物残留物来自成年工坊保管者，随{p.residue.acquiredWithPlateId}在第{p.residue.acquiredWeek}周取得。失败后仍须携原封装物普通交还；箱体焦痕不会随结束清除。</p>}
        <h4>三案各自的唯一护片</h4><ul>{p.plates.map(plate => <li key={plate.id}>{plate.id} · {life.cases.find(c => c.id === plate.caseId)?.title ?? '本案'}：{PLATE_STATUS[plate.status]}，{ITEM_POSITION[plate.location]}；{plate.preparedWeek === null ? '尚未支付' : `第${plate.preparedWeek}周实付${plate.paidPennies}便士`}，剩余{plate.charges}次，实际磨损{plate.wear}，{plate.scorched ? '焦痕仍在' : '没有焦痕'}。</li>)}</ul>
        <p>附廊原镜A至B的普通路线单程8米。停止、换案和关闭页面都不会修镜、重置负载、补护片或恢复精力。</p>
      </>}
    </section>;
  }
  function peopleFacts() {
    const p = site, a = life.currentAttempt, source = life.historicalScene;
    return <section aria-label="灾难魔女原人位置与当前许可"><h3>原人位置与当前许可</h3>
      {source && <p>旧记录中的同一{source.vera.name}，{source.vera.age}岁，在{SOURCE_POSITION[source.vera.location]}；同一{source.marcus.name}，{source.marcus.age}岁，在{SOURCE_POSITION[source.marcus.location]}。旧位置只说明当时，进入附廊须本人沿普通旧廊实际走来。</p>}
      {p.introducedWeek === null ? <p>尚无本人的现场行程和本案当面许可。</p> : <><p>本人当前在{POSITION[p.playerLocation]}；本场精力{p.playerEnergy}/100，累计普通步行{p.playerTravelMetres}米。</p>
        {[p.vera, p.marcus].map(actor => actor && <p key={actor.id}>{actor.name}，{actor.age}岁（{actor.id}），当前在{POSITION[actor.location]}；独立精力{actor.energy}/100，累计普通步行{actor.travelMetres}米。当前镜面许可{CONSENT[actor.mirrorConsent]}，闭箱许可{CONSENT[actor.boxConsent]}。</p>)}
        {a ? <p className={a.permissionWithdrawn ? 'slice-notice seer-risk' : 'slice-notice'}>第{a.consentWeek}周本案许可：操作许可{CONSENT[a.operatorConsent]}；物主许可{CONSENT[a.ownerConsent]}；普通路线许可{CONSENT[a.routeConsent]}。{a.permissionWithdrawn ? '镜面许可已撤回，不能继续施术；普通路线按独立许可选择。' : '旧案同意不能代替本案当前答复。'}</p> : <p>当前没有正在进行的生活尝试；旧案许可不自动延续。</p>}
        <p>普通步行每米耗1秒和1精力。两位原成人各有自己的身体、位置和有限精力；到场、离开、返回与当面交接分别完成。</p>
        {p.actorMoves.length > 0 && <details><summary>两位原成人的实际行程</summary><ul>{p.actorMoves.map((move, i) => <li key={i}>{move.actorId === p.vera?.id ? p.vera.name : p.marcus?.name ?? '原参与者'}：{POSITION[move.from]} → {POSITION[move.to]}，普通步行{move.metres}米，耗{move.seconds}秒。</li>)}</ul></details>}
      </>}
      {a && <section aria-label="灾难魔女本次尝试"><h4>本次实际经过</h4>{attemptFacts(a, false)}</section>}
    </section>;
  }
  function attemptFacts(a: Attempt, historical: boolean) {
    const succeeded = a.abilityTier === 'SUCCESS' || a.abilityTier === 'GREAT_SUCCESS';
    const window = { NONE: '尚未尝试能力', ACTIVE: '有限窗口尚在', FAILED: '检定失败', EXPIRED: '有限窗口已到期', APPLIED: '已经实际应用', STOPPED: '已经停止作用' }[a.window];
    return <div><p>{historical ? '已保存经历' : '当前尝试'} · 第{a.week}周 · {a.method === 'ABILITY' ? '能力方法' : '普通方法'} · {a.closed ? '已实际收束' : '尚未收束'}。</p>
      <p>实耗{a.spiritualitySpent}灵性、{a.penniesSpent}便士、{a.energySpent}精力；实际步行{a.playerTravelMetres}米，经过{a.elapsedSeconds}秒。</p>
      <p>检定{a.abilityTier ? TIER[a.abilityTier] : '尚无'}；{succeeded && a.appliedAbilityIds.length === 0 ? '检定成功，但尚无实际应用。' : a.abilityTier && !succeeded ? '检定失败，已付成本保留。' : ''}实际应用：{a.appliedAbilityIds.map(id => ABILITY[id]).join('、') || '无'}。{window}。</p>
      <p>封闭负载{a.loadApplied ? `已实际施加，减势${a.bufferedForce}，同一护片磨损${a.plateWear}并耗尽` : '本案尚未施加'}；黑焰脉冲{a.pulseApplied ? '已实际作用10秒' : '本案尚未作用'}；残留物{a.residueHandedOver ? '已封装携回并当面交还' : '本案没有封装交还记录'}。</p>
      <p>普通8米路线{a.routeWalked ? '已经实际走到B' : '尚未走出'}，{a.routeReturned ? '已经实走8米返回A' : '本案没有返程记录'}。{a.permissionWithdrawn && '原物主已撤回镜面许可，未强行施术。'}{a.stopped ? '已经停止新的施术。' : '尚未明确停止新的施术。'}</p>
      <p>原护片{a.plateId}{a.plateReturned ? '已实际交回' : '仍须携回交还'}；现场核实{a.inspected ? '已完成' : '尚未完成'}。只有真正应用并报告的技巧才增加8掌握；普通方法、取消、失败和成功未应用不增加能力掌握。</p>
      {historical && <><p>这是当次已保存经历，原人原物的当前位置以上方当前事实为准。</p>{a.siteAtClose && <p>收束时本人在{POSITION[a.siteAtClose.playerLocation]}、精力{a.siteAtClose.playerEnergy}；当时箱盖{a.siteAtClose.box.state === 'CLOSED' ? '已闭合' : '尚未闭合'}，箱体{a.siteAtClose.box.scorched ? '留有焦痕' : '没有焦痕'}。</p>}</>}
    </div>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, plate = encounter.plate;
    return <section aria-label="灾难魔女可选遭遇"><h3>{encounter.title}</h3><p>{STATUS[encounter.status]}</p><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name}，{enemy.age}岁，序列{enemy.sequence}（{enemy.id}），留在独立后院；健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120；{enemy.status === 'DEAD' ? '已死亡，原身体留在后院' : enemy.status === 'SURRENDERED' ? '已投降，停止抵抗' : '仍有独立意志'}。</p>
        <p>她自己的原棍（{enemy.weaponId}）：{enemy.weaponLocation === 'HAND' ? `仍在${enemy.name}手中` : '留在后院原交战位置'}。</p><p>{Object.entries(enemy.powerUses).map(([id, count]) => `${POWER[id]}：${count}次`).join('；')}。</p></>}
      <section aria-label="灾难魔女战斗镜片"><h4>另行付费的有限战斗镜片</h4>{plate ? <p>{plate.id} · 本人携带同一片 · 实付{plate.paidPennies}便士 · 剩余{plate.charges}/{plate.initialCharges}次。{plate.charges === 0 ? '已经耗尽，不能再设置镜幕。' : '成功设置镜幕即耗一次；扰断、过期或未遇身体攻击均不返还。'}</p> : <p>尚未另行付费领取战斗镜片。</p>}
        {encounter.preparation && <p>第{encounter.preparation.week}周实付准备费{encounter.preparation.paidPennies}便士，取得这一片初始{encounter.preparation.initialCharges}次的镜片；原三片生活护片不能重复用作战斗补给。</p>}</section>
      <ul>{encounter.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
      <p>本场没有同伴参战，也没有友人天然免疫。馆内两面原镜不交给敌人；战斗使用本人另备的有限镜片。原科宾的投降和既往身体、原物记录保留，不会成为这位新对手。</p>
    </section>;
  }
  function operationDetails() {
    const command = liveConfirmation?.command;
    switch (command?.type) {
      case 'LEARN_GUIDANCE': return <p>只听取专业指导，支付1行动和500便士。劳动筹药、购买、准备与服药分别确认。</p>;
      case 'REQUEST_SUPPLY': return <p>花1行动申请后续独立原瓶，须等下一真实周再确认到货；申请不会立即补瓶或免除各瓶费用。</p>;
      case 'RECEIVE_SUPPLY': return <p>只接收已经实际到货的一批原瓶。每瓶仍须独立劳动或付费取得，不会自动饮用。</p>;
      case 'POTION_WORK': return <p>为所选原瓶完成一次真实劳动并保存进度。完成五次劳动后仍须支付900便士取得本瓶。</p>;
      case 'BUY_POTION': return <p>只支付所选原瓶列明的实际余款并领取这一瓶，不会自动准备或饮用。</p>;
      case 'PREPARE_PROMOTION': return <p>支付1行动和140便士，实际检查本周服药场地。退出使本次检查失效，费用不退；原瓶另行确认饮用才耗尽。</p>;
      case 'LEAVE_PREPARATION': return <p>实际结束本次场地检查，已付费用不退；未饮用的原瓶保留，下次须重新付费检查。</p>;
      case 'CONSUME': return <><p className="slice-notice seer-risk">{value.risk}</p><p>本瓶和本次检查无论成功失败都会耗尽，费用不退。失败后须实际恢复、另筹独立原瓶并重新检查；成功才新增两项初始掌握。十六项已有掌握、当前性别、旧伤与原人原物保持，不免费治疗、不补满当前灵性、不修复原镜。</p></>;
      case 'PREPARE': return <p>实付20便士领取本案唯一护片。{command.caseId === 'black-flame-channel' ? '同时取得成年工坊保管者提供的唯一封装虚构残留物，之后须本人走到原箱操作。' : '领取不等于已经走到原镜或安装。'}{command.method === 'ORDINARY' ? '选择普通方法，不增加新能力掌握。' : '准备不会自动施术。'}取消、撤回或失败都保留已付成本，原护片仍须实际交还。</p>;
      case 'ARRIVE_VERA': return <p>由旧馆门口的同一维瑞娜本人普通步行2米到附廊门口，耗2秒和她自己的2精力；不是复制身体或重置旧位置。</p>;
      case 'ARRIVE_MARCUS': return <p>由旧馆原镜B旁的同一马库斯本人普通步行24米到附廊门口，耗24秒和他自己的24精力；不是直接把旧记录当作当前到场。</p>;
      case 'WALK': return <p>本人沿普通道路实际走到{POSITION[command.to]}，按上方真实距离消耗时间和精力，并保留原物回收与普通返程余力。不会带走尚未取下的护片，也不会搬动原镜或传送两位成人。</p>;
      case 'INSTALL_PLATE': return <p>本人到达原镜或原箱的实际位置后，在本案当前许可下亲手安装同一护片。安装不施术、不补次数、不修复原镜。</p>;
      case 'SCREEN_MIRROR': return <p>支付1行动和6灵性，按知识难度20尝试最长30秒的短暂镜幕。须原物主当前许可、原镜完好且付费护片已装；成功开窗不等于已经应用。实际负载另行确认，失败成本照付。</p>;
      case 'APPLY_LOAD': return <p>实际施加唯一12单位封闭负载，并消耗本案同一护片，留下5磨损。镜幕仍有效才减势5、最终7；失败或到期由普通保护插片承接，另付5精力。停止与换案都不恢复负载或护片。</p>;
      case 'CLOSE_BOX': return <p>本人在原箱前亲手合上箱盖。闭箱不删除箱内残留物，不会抹去已经留下的焦痕。</p>;
      case 'MOVE_ADULTS_OUTSIDE': return <p>本人在门口确认后，同一两位成人各普通步行2米到接触区外，各耗2秒和2精力，并保留各自2精力返回。之后本人仍须实际走到已闭原箱前。</p>;
      case 'CHANNEL_BLACK_FLAME': return <p>支付1行动和6灵性，按知识难度20尝试一次10秒闭箱黑焰。须本人在原箱前、箱盖已闭、同一护片已装、两位成人确在区外且当前许可有效。成功耗尽唯一封装残留物与护片，原箱和原片焦痕保留；失败残留仍封装，须普通携回交还。不会清洗人的身体、灵魂或所有污染。</p>;
      case 'COLLECT_RESIDUE': return <p>本人在已闭原箱前实际取回同一份仍封装的残留物，并亲自携回门口；取回不等于已经交还，也不会生成第二份。</p>;
      case 'RETURN_ADULTS': return <p>本人在门口、原箱已闭且残留已经处置或封装携回，原两位成人各实走2米返回门口，各耗2秒和2精力；不是恢复精力或撤销此前行程。</p>;
      case 'SEALED_HANDOVER': return <p>本人携同一封装残留物到门口，当面交还已经实际返回的原保管者。按普通方法结束，不把交还冒充黑焰应用。</p>;
      case 'WITHDRAW_PERMISSION': return <p>当面听取维瑞娜撤回本案镜面许可。不得继续施术；普通路线许可独立保留，原20便士准备费不退，未用护片仍须亲手交还。</p>;
      case 'ORDINARY_ROUTE': return <p>已经停止施术并尊重撤回后，本人按独立普通路线许可，从A实际步行8米到B，耗8秒和8精力。另保留8米回A与4米回门口的余力，不施术、不增加能力掌握。</p>;
      case 'RETURN_ROUTE': return <p>本人从实际所在的B沿普通外路实走8米返回A，耗8秒和8精力，另留4精力回门口。这是普通步行，不是镜中任意传送。</p>;
      case 'REMOVE_PLATE': return <p>本人在同一护片的实际安装处，停止作用、闭箱并处理残留后亲手取下原片。消耗、磨损和焦痕保持，取下后仍须携回交还。</p>;
      case 'RETURN_PLATE': return <p>本人在门口亲手交还携带的同一护片。未用片保留未用事实；耗尽片保留磨损与焦痕，费用不退。</p>;
      case 'STOP': return <p>明确停止本次新的能力使用与尚在的镜幕。已付费用、灵性、路程和物品消耗保持；停止不会归还原物、移动成人或替本人走回门口。</p>;
      case 'WAIT_10': return <p>现场实际经过10秒，有限窗口可能到期。等待不延长镜幕、不补资源、不刷新本案尝试。</p>;
      case 'ENCOUNTER_TALK': return <p>取得此次同意后，同一维瑞娜与马库斯各普通步行2米到区外，各耗2秒和2精力；本人普通步行4米进入独立后院，耗4秒和4精力，另留2精力用于2米普通退出。只到场交谈，不自动交战。</p>;
      case 'PREPARE_ENCOUNTER': return <p>另付20便士取得本人携带的唯一战斗镜片，共3次耐用次数。成功设置镜幕即耗一次，只缓冲随后一次实际身体攻击45；扰断、到期或未应用都不退。三片生活护片和馆内两面原镜不会变成无限战斗补给。</p>;
      case 'ENCOUNTER_FIGHT': return <><p className="slice-notice seer-risk">你选择与45岁的伊瑞丝真正交战，双方独立身体、原武器和灵性可能带来伤势、撤退或死亡。</p><p>两位原成人已实际走到区外，本场没有同伴参战。镜幕只能使用当前剩余次数的付费战斗镜片，黑焰每轮最多一次真实尝试；全力防守整轮停止黑焰与普通攻击。开战不治疗旧伤、不补灵性、不重置镜片。</p></>;
      case 'LEAVE_ENCOUNTER': return <p>本人沿普通出口实际步行2米，耗2秒和2精力，携同一战斗镜片到区外。伊瑞丝和她的原棍留在后院，两位原成人仍在区外；不恢复任何人的资源。</p>;
      default: return <p>只执行上方列出的这一步，按当前已保存事实核对结果。确认不会自动代办下一步，也不会恢复已经消耗的资源。</p>;
    }
  }
  return <section className="seer-panel warrior-panel calamity-demoness-panel" aria-label="灾难魔女" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="灾难魔女当前目标"><span className="seer-seal">{value.promoted ? '灾难魔女 · 魔女途径序列2' : '不老魔女3 → 灾难魔女2'}</span><h2 ref={heading} tabIndex={-1}>{value.title}</h2><p>{value.story ?? life.story}</p>
      <p className="seer-next"><strong>下一步：</strong>{value.resources?.health === 0 || encounter.status === 'LOST' ? '本周目已经死亡，原身体、原人和原物记录只读保留。' : next ? `${next.label} · ${next.cost}${!next.enabled && next.reason ? `。${next.reason}` : ''}` : '当前没有待提交的现场步骤，可查看已保存经历或继续普通生活。'}</p>
      <p>{value.digestion}</p><p>十六项已有掌握保留；短暂镜幕与封闭黑焰疏导两项新技巧从0开始，按真正应用分别记录。</p></section>
    {resources()}<p className="slice-notice seer-risk">{value.risk}</p>
    {error !== null && <p role="alert">{typeof error === 'string' ? error : error.message} 当前仍显示上次已保存事实。{typeof error !== 'string' && error.retryable === false ? '请按保存错误提示重新加载。' : '请使用保存错误处的重试，继续同一操作；此处不会重复提交。'}</p>}
    {(busy || submittedId !== null) && <p role="status" aria-live="polite">正在等待同一次操作的保存回执；重复点击、清除错误或时间经过都不会再次扣除资源。</p>}
    {blocked && <p role="status">请先处理当前阻塞事项。本页暂不能提交新操作。</p>}
    {!value.promoted && <section aria-label="灾难魔女独立药瓶与准备"><h3>成品魔药与三项专业准备</h3><p>{value.supplies}</p>
      <label className="seer-case-selector">查看药瓶<select value={bottle?.id ?? ''} disabled={locked || confirmation !== null} onChange={e => setBottleId(e.target.value)}>{value.bottles.map(b => <option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}</select></label>
      {bottle && <article><h4>{bottle.title}</h4><p>{bottle.source}</p><p>当前状态：{bottle.status} · 当前成功率{bottle.chance}%</p></article>}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>当次场地检查：{value.preparedWeek === null ? '尚未进行' : `第${value.preparedWeek}周已完成`}。指导、购买、准备与饮用分别确认。</p>
      <p>从实际不老魔女晋升周起满12整周、消化100，并完成三项各1行动的专业准备；服药当周另付1行动与140便士检查场地。原瓶可独立劳动五次后付900便士，或直接付6400便士取得。</p>
      <p>原瓶耗尽后须申请下一批，再等下一真实周确认到货，各瓶费用独立。交接处供应成品，当前没有自行调配所需的完整配方；序列1尚未开放。</p></section>}
    {value.promoted && <><section aria-label="灾难魔女两项新技巧"><h3>两项新技巧</h3>{value.abilities.filter(a => Object.hasOwn(ABILITY, a.id)).map(a => <p key={a.id}><strong>{a.label} · 掌握{a.mastery}</strong>：{a.description}</p>)}</section>{siteFacts()}{peopleFacts()}
      {!encounter.inside && <section className="seer-current-case" aria-label="灾难魔女当前实践"><h3>本次实践</h3><label className="seer-case-selector">查看实践<select value={selected?.id ?? ''} disabled={locked || confirmation !== null || sceneLocked} onChange={e => setCaseId(e.target.value)}>{life.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? '已有记录'}</option>)}</select></label>
        {selected && <><h4>{selected.title} · {STATUS[selected.status] ?? '已有记录'}</h4><p>{selected.story}</p><ul>{selected.observations.map((fact, i) => <li key={i}>{fact}</li>)}</ul>{selected.result && <p className="slice-notice">{selected.result}</p>}{!life.currentAttempt && selected.attempts.at(-1) && <section aria-label="灾难魔女本案最近记录"><h4>本案最近的已保存经历</h4>{attemptFacts(selected.attempts.at(-1)!, true)}</section>}</>}
      </section>}{encounter.inside && encounterFacts()}</>}
    <section aria-label="灾难魔女当前行动"><h3>{sceneLocked ? '当前现场的下一步' : '当前可选行动'}</h3>{actions(immediate.filter(a => !RETURN.has(a.command.type)), '灾难魔女当前步骤')}
      {immediate.some(a => RETURN.has(a.command.type)) && <section aria-label="灾难魔女真实归还与普通收尾"><h4>{value.promoted ? '停止、交还与普通返回' : '实际结束本次准备'}</h4>{actions(immediate.filter(a => RETURN.has(a.command.type)), '灾难魔女实际停止与返回')}<p>每一步独立确认。关闭页面不等于现场收束；0行动的步骤仍支付列明的实际时间和精力。</p></section>}
      {currentActions.some(a => !immediate.includes(a)) && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actions(currentActions.filter(a => !immediate.includes(a)), '灾难魔女未满足条件的步骤')}</details>}
    </section>
    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>庭院里的可选冲突</summary>{encounterFacts()}{actions(battle, '灾难魔女可选遭遇行动')}</details>}
    {value.promoted && <details className="seer-fold"><summary>独立药瓶与专业准备记录</summary><p>{value.supplies}</p>{value.bottles.map(b => <article key={b.id}><h4>{b.title}</h4><p>{b.source}</p><p>已保存状态：{b.status}</p></article>)}<ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul></details>}
    {value.promoted && <details className="seer-fold"><summary>三案经历与实际应用</summary><p>{life.story}</p>{life.cases.map(c => <article key={c.id}><h4>{c.title} · {STATUS[c.status] ?? '已有记录'}</h4><p>{c.result ?? '尚无已报告结果。'} · 已实际收束{c.closes}次。</p>{c.attempts.map((a, i) => <div key={i}>{attemptFacts(a, true)}</div>)}</article>)}<p>三案如实报告各记录25消化，末次反思25；没有实际应用的技巧不增加掌握。</p></details>}
    <details className="seer-fold"><summary>身体与已有经历</summary><p>当前身体性别：{GENDER[value.currentGender] ?? value.currentGender}。十六项已有掌握保持原值；晋升不重复改变身体性别，不清旧伤，不补满当前灵性。</p><p>{value.appearanceRecord}</p><ul>{value.inheritedHistory.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
      {value.abilities.some(a => !Object.hasOwn(ABILITY, a.id)) && <section aria-label="灾难魔女十六项已有掌握"><h4>已有技巧与实际掌握</h4>{value.abilities.filter(a => !Object.hasOwn(ABILITY, a.id)).map(a => <p key={a.id}><strong>{a.label} · 掌握{a.mastery}</strong>：{a.description}</p>)}</section>}
      <p>{life.environment}</p><p>旧素描、原封包、原登记与科宾此前的投降都按既往记录保留。旧阶段页面只供查看已有记录，不重开旧实践、不复制身体或原物、不恢复伤势。镜路出口受阻须先从已知原入口实际返回，离镜后才可走普通外路。序列1尚未开放。</p></details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || sceneLocked || confirmation !== null} onClick={() => { if (!locked && !sceneLocked && !confirmation) onClose(); }}>关闭灾难魔女页面</button>}
    {confirmation && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="calamity-confirm-title" aria-describedby="calamity-confirm-cost"
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal}
      style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '85vh', overflow: 'auto', color: 'var(--slice-ink)', background: 'var(--slice-paper-light)', padding: 24 }}
      onCancel={e => { e.preventDefault(); if (!locked) setConfirmation(null); }} onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!locked) setConfirmation(null); }
        if (e.key === 'Tab') { const controls = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')), first = controls[0], last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
      }}><h3 id="calamity-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一药瓶' : '确认本次消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '当前条件已改变，请返回最新状态。'}</p><p id="calamity-confirm-cost">{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%；当次检查{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p></>}
      {operationDetails()}{resources('灾难魔女操作确认当前资源')}{liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button type="button" ref={cancel} className="slice-button quiet" disabled={locked} onClick={() => setConfirmation(null)}>取消，返回查看</button><button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作'}</button></div>
      <p className="slice-muted">取消不提交、不扣资源。提交后等待同一次保存回执；关闭确认或页面不能替代实际停手、交还和普通返回。</p>
    </dialog>}
  </section>;
}
