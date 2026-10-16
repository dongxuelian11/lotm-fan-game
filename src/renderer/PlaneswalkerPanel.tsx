import { useEffect, useRef, useState } from 'react';
import type { PlaneswalkerAction, PlaneswalkerCommand, PlaneswalkerProjection } from '../domain/planeswalker/types';
import './seer-styles.css';

const ACQUISITION = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION', 'CONSUME']);
const RITUAL = new Set(['PREPARE_ROUTE_KIT', 'CHECK_ROUTE_COORDINATES', 'CHECK_ROUTE_PROTECTION', 'CHECK_ROUTE_RETURN', 'DEPART_RITUAL', 'CONTACT_SETTLEMENT', 'HELP_SETTLEMENT', 'VERIFY_LEGEND', 'CHECK_RITUAL_RETURN_MARKER', 'RETURN_RITUAL', 'CLOSE_ROUTE_KIT']);
const ENCOUNTER = new Set(['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER']);
const RETURN = new Set(['CHECK_RITUAL_RETURN_MARKER', 'RETURN_RITUAL', 'CLOSE_ROUTE_KIT', 'READ_RETURN_MARKER', 'RETURN_LOCAL', 'RETURN_PARCEL', 'ARCHIVE_KIT', 'STOP', 'CLOSE_DOOR', 'UNBLOCK_DOOR', 'CLEANUP', 'WAIT_10', 'INSPECT', 'LEAVE', 'CLOSE', 'WITHDRAW', 'WITHDRAW_PERMISSION', 'LEAVE_PREPARATION', 'LEAVE_ENCOUNTER']);
const CONFIRM = new Set(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'POTION_WORK', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'PREPARE_ROUTE_KIT', 'DEPART_RITUAL', 'HELP_SETTLEMENT', 'VERIFY_LEGEND', 'OBSERVE', 'PREPARE', 'PERFORM', 'BUY_KIT', 'DEPART', 'READ_PATTERN', 'APPLY_PATTERN', 'REPORT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT']);
const GENDER: Record<string, string> = { FEMALE: '女性', MALE: '男性', female: '女性', male: '男性' };
const POSITION: Record<string, string> = { ENTRY: '本地通行室入口（0米）', NEAR: '本地室内近端（2米）', FAR: '本地室内远端（6米）', OUTSIDE: '本地室外（距入口2米）', REMOTE: '异星聚居点的封闭生活舱' };
const CONSENT: Record<string, string> = { UNASKED: '尚未询问', GRANTED: '已同意本案用途', DECLINED: '已拒绝本案用途', WITHDRAWN: '已撤回本案许可', CLOSED: '本案许可已结束' };
const DOOR: Record<string, string> = { CLOSED: '已关闭', OPEN: '已打开', BLOCKED: '已闩住' };
const PARCEL: Record<string, string> = { ENTRY_STAND: '本地入口原架', PLAYER: '本人手中，随本人实际位置', REMOTE_STAND: '异星原架' };
const EFFECT: Record<string, string> = { OFF: '没有正在维持的作用', TRANSIT: '象征通行窗口', PATTERN: '短暂光纹窗口' };
const WINDOW: Record<string, string> = { NONE: '尚未尝试', ACTIVE: '窗口仍有效', FAILED: '检定失败，未形成窗口', STOPPED: '已明确停止', EXPIRED: '窗口已到期' };
const TIER: Record<string, string> = { GREAT_SUCCESS: '大成功', SUCCESS: '成功', FAILURE: '失败', GREAT_FAILURE: '严重失败' };
const STATUS: Record<string, string> = { AVAILABLE: '尚未接触', OBSERVED: '已观察', PREPARED: '已准备', ACTIVE: '现场尚未收束', EXAMINED: '已收束，待报告', RESOLVED: '已报告或结束', READY: '已到场交谈', FIGHTING: '交战中', RETREATED: '已撤退', LOST: '本人已死亡' };
const PHASE: Record<string, string> = { PREPARED: '本地已备装，尚未出发', AWAY: '本人正在异星', RETURNED: '已实际返回，待归档', FAILED: '出程失败，仍在本地', CLOSED: '本次已在本地归档' };
const VISIT_RESULT: Record<string, string> = { NONE: '尚未完成', CANCELLED: '本地取消', OUTBOUND_FAILURE: '出程失败', INTERRUPTED: '中途返回', HELPED: '已实际帮助', VERIFIED: '已亲访核实转述' };
const POWER: Record<string, string> = { VECTOR_STRIKE: '有限定点折光击', REFRACT_WARD: '一次折光屏护', CLOSE_DOOR: '普通关闭原门' };
type Confirmation = { id: string; facts: string };
type Visit = NonNullable<PlaneswalkerProjection['ritual']['currentVisit']>;
type Site = PlaneswalkerProjection['ritual']['sites'][number];
type Attempt = NonNullable<PlaneswalkerProjection['life']['currentAttempt']>;

export interface PlaneswalkerPanelProps {
  value: PlaneswalkerProjection;
  busy: boolean;
  blocked?: boolean;
  error?: { message: string; retryable?: boolean } | string | null;
  onCommand: (command: PlaneswalkerCommand) => void;
  /** Navigation only. This never returns a body, stops an effect, or ends a preparation. */
  onClose?: () => void;
}

/** Only public saved facts are displayed; every submitted command comes from value.actions. */
export function PlaneswalkerPanel({ value, busy, blocked = false, error = null, onCommand, onClose }: PlaneswalkerPanelProps) {
  const [siteId, setSiteId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [bottleId, setBottleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const submitted = useRef<string | null>(null), submittedFacts = useRef<string | null>(null);
  const confirmationRef = useRef<Confirmation | null>(null);
  const returnActionId = useRef<string | null>(null), buttons = useRef(new Map<string, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null), dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const { ritual, life, encounter } = value;
  const facts = JSON.stringify(value);
  const deceased = encounter.status === 'LOST' || value.resources?.health === 0;
  const locked = busy || blocked || error !== null || submittedId !== null || deceased;
  const selectedSite = ritual.sites.find(s => s.id === ritual.currentVisit?.siteId)
    ?? ritual.sites.find(s => s.id === siteId)
    ?? ritual.sites.find(s => value.actions.some(a => a.enabled && a.command.type === 'PREPARE_ROUTE_KIT' && a.command.siteId === s.id))
    ?? ritual.sites.find(s => s.qualifiedWeek === null) ?? ritual.sites[0];
  const selectedCase = life.cases.find(c => c.id === life.activeCase)
    ?? life.cases.find(c => c.contactOpen || c.status === 'PREPARED')
    ?? life.cases.find(c => c.id === caseId) ?? life.cases.find(c => c.status !== 'RESOLVED') ?? life.cases[0];
  const bottle = value.bottles.find(b => b.id === bottleId)
    ?? value.bottles.find(b => value.actions.some(a => a.enabled && 'bottleId' in a.command && a.command.bottleId === b.id)) ?? value.bottles[0];
  const acquisition = value.actions.filter(a => ACQUISITION.has(a.command.type) && (!('bottleId' in a.command) || a.command.bottleId === bottle?.id));
  const routes = value.actions.filter(a => RITUAL.has(a.command.type) && (!('siteId' in a.command) || a.command.siteId === selectedSite?.id));
  const battle = value.actions.filter(a => ENCOUNTER.has(a.command.type));
  const daily = value.actions.filter(a => !ACQUISITION.has(a.command.type) && !RITUAL.has(a.command.type) && !ENCOUNTER.has(a.command.type) && (!('caseId' in a.command) || a.command.caseId === selectedCase?.id));
  const currentActions = ritual.inside ? routes : encounter.inside ? battle : value.preparedWeek !== null ? acquisition
    : value.promoted ? daily : value.guidanceKnown && !ritual.qualified ? [...routes, ...acquisition] : acquisition;
  const next = currentActions.find(a => a.enabled && a.command.type === 'CONSUME')
    ?? currentActions.find(a => a.enabled && !RETURN.has(a.command.type))
    ?? currentActions.find(a => a.enabled) ?? currentActions[0];
  const immediate = currentActions.filter(a => a.enabled || a === next || RETURN.has(a.command.type));
  const liveConfirmation = confirmation?.facts === facts ? value.actions.find(a => a.id === confirmation.id) : undefined;
  const confirmedBottle = liveConfirmation && 'bottleId' in liveConfirmation.command
    ? value.bottles.find(b => 'bottleId' in liveConfirmation.command && b.id === liveConfirmation.command.bottleId) : undefined;
  const confirmedCase = liveConfirmation && 'caseId' in liveConfirmation.command
    ? life.cases.find(c => 'caseId' in liveConfirmation.command && c.id === liveConfirmation.command.caseId) : undefined;
  const confirmedSite = liveConfirmation?.command.type === 'PREPARE_ROUTE_KIT'
    ? ritual.sites.find(s => liveConfirmation.command.type === 'PREPARE_ROUTE_KIT' && s.id === liveConfirmation.command.siteId) : selectedSite;
  const sceneLocked = value.insideCase || ritual.inside || ritual.currentVisit !== null || ritual.playerLocation !== 'LOCAL'
    || life.inside || life.insideCase || life.cases.some(c => c.contactOpen || c.status === 'PREPARED')
    || encounter.inside || value.preparedWeek !== null;
  const realArrivals = ritual.visits.filter(v => v.moves.some(m => m.from === 'LOCAL' && m.to === v.siteId)).length;
  const roundTrips = ritual.visits.filter(v => v.moves.some(m => m.from === 'LOCAL' && m.to === v.siteId) && v.moves.some(m => m.from === v.siteId && m.to === 'LOCAL')).length;

  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    // A cleared error, new object identity, or elapsed time is not a saved state change.
    if (!busy && error === null && submittedFacts.current !== null && submittedFacts.current !== facts) {
      submitted.current = null; submittedFacts.current = null; confirmationRef.current = null;
      setSubmittedId(null); setConfirmation(null); heading.current?.focus();
    } else if (confirmation && submitted.current === null && confirmation.facts !== facts) {
      confirmationRef.current = null; setConfirmation(null);
    }
  }, [facts, busy, error, confirmation]);
  useEffect(() => {
    if (confirmation) {
      if (dialog.current?.showModal && !dialog.current.open) dialog.current.showModal();
      cancel.current?.focus();
    } else if (submitted.current === null && returnActionId.current) {
      (buttons.current.get(returnActionId.current) ?? heading.current)?.focus();
    }
  }, [confirmation, error]);

  function dismissConfirmation() {
    if (locked || submitted.current !== null) return;
    confirmationRef.current = null; setConfirmation(null);
  }
  function submit(action: PlaneswalkerAction) {
    if (locked || submitted.current !== null || !action.enabled) return;
    if (confirmationRef.current && (confirmationRef.current.facts !== facts || confirmationRef.current.id !== action.id)) return;
    if (!value.actions.includes(action)) return;
    submitted.current = action.id; submittedFacts.current = facts; setSubmittedId(action.id); onCommand(action.command);
  }
  function choose(action: PlaneswalkerAction) {
    if (locked || confirmationRef.current !== null || submitted.current !== null || !action.enabled) return;
    if (CONFIRM.has(action.command.type)) {
      if (action.command.type === 'CONSUME' && !value.bottles.some(b => 'bottleId' in action.command && b.id === action.command.bottleId)) return;
      returnActionId.current = action.id;
      const choice = { id: action.id, facts }; confirmationRef.current = choice; setConfirmation(choice);
    } else submit(action);
  }
  function actions(entries: PlaneswalkerAction[], label: string) {
    return entries.length > 0 && <div role="group" aria-label={label} className="warrior-action-list">{entries.map(a => <div className="seer-action warrior-compact-action" key={a.id}>
      <button type="button" className="slice-choice" disabled={locked || confirmation !== null || !a.enabled}
        aria-describedby={a.reason ? `planeswalker-reason-${a.id}` : undefined}
        ref={node => { if (node) buttons.current.set(a.id, node); else buttons.current.delete(a.id); }}
        onClick={() => choose(a)}><strong>{a.label}</strong><span className="slice-modifiers">{a.cost}</span></button>
      {a.reason && <p id={`planeswalker-reason-${a.id}`} className="seer-action-reason">{a.reason}</p>}
    </div>)}</div>;
  }
  function resources(label = '旅法师当前身体与资源') {
    const r = value.resources;
    return r && <section aria-label={label} className="seer-current-resources"><h3>当前身体与资源</h3><dl className="seer-facts">
      <div><dt>健康</dt><dd>{r.health}/{r.maxHealth}</dd></div><div><dt>精神</dt><dd>{r.mind}/{r.maxMind}</dd></div>
      <div><dt>灵性</dt><dd>{r.spirituality}/{r.maxSpirituality}</dd></div><div><dt>污染与排异</dt><dd>{value.pollution}</dd></div>
      <div><dt>现金</dt><dd>{r.cash}</dd></div><div><dt>本周行动</dt><dd>{r.actionsRemaining}</dd></div>
    </dl></section>;
  }
  function sourceFacts() {
    const prices = value.prices;
    return <><p>{value.sourceLabel}</p>{prices && <p>专业指导{prices.guidance}便士；每瓶{prices.potion}便士，或本瓶五项劳务抵{prices.labourCredit}便士后付{prices.labourBalance}便士。当周检查另付1行动、{prices.preparation}便士。</p>}
      {value.formula.length > 0 && <section aria-label="明确已有辅助物"><h4>明确已有辅助物</h4><ul>{value.formula.map(item => <li key={item.name}>{item.name}：每瓶{item.quantity}{item.unit}</li>)}</ul>
        <p>三件辅助原物随各自药瓶的独立封存箱交付；是否已持有、检查或耗尽，以所选原瓶的记录为准。完整主材料与自行调配方法尚未开放。</p>
      </section>}
    </>;
  }
  function siteFacts(site: Site) {
    return <article aria-label={`${site.name}实际履历`}><h4>{site.name} · {site.status}</h4><p>{site.task}</p>
      <p>位于异星原停泊舱以东{site.coordinates.eastMetres / 1000}公里；坐标记录{site.coordinates.sourceId}。生活舱{site.shelter.id}提供封闭空气，不能消除污染。</p>
      <dl className="seer-facts">
        <div><dt>初访见证人</dt><dd>{site.witness.name}，{site.witness.age}岁，仍在{site.name}</dd></div>
        <div><dt>后来转述人</dt><dd>{site.reteller.name}，{site.reteller.age}岁，仍在{site.name}</dd></div>
        <div><dt>当地同一原物</dt><dd>{site.object.name} · {site.object.id} · {site.object.condition === 'REPAIRED' ? '已经修复' : '尚待帮助'}</dd></div>
        <div><dt>实际帮助</dt><dd>{site.helpWeek === null ? '尚无' : `第${site.helpWeek}周 · ${site.helpVisitId}`}</dd></div>
        <div><dt>亲访核实转述</dt><dd>{site.verifiedWeek === null ? '尚无，须初访之后的真实周再来' : `第${site.verifiedWeek}周 · ${site.verifiedVisitId}`}</dd></div>
        <div><dt>传说与返程核验</dt><dd>{site.qualifiedWeek === null ? '尚未全部完成' : `第${site.qualifiedWeek}周已完成`}</dd></div>
      </dl>
      <p>{site.object.changedWeek === null ? '这件原物尚未因你的帮助改变。' : `第${site.object.changedWeek}周，${site.object.change}；对应初访${site.object.changedByVisitId}。`}</p>
      <p>当地原簿{site.record.id}：{site.record.entry ? `第${site.record.entry.week}周，${site.record.entry.text}（原条目${site.record.entry.id}）` : '尚未留下本次事迹记录。'}</p>
      <p>{site.retelling ? `${site.reteller.name}在第${site.retelling.week}周转述：${site.retelling.text}；核对同一原条目${site.retelling.originalEntryId}、同一原物${site.retelling.originalObjectId}。` : `${site.reteller.name}的后来转述尚未当面核实。`}</p>
      <p>当前回程原标记{site.returnMarker.id}通向本地原标记{site.returnMarker.destinationId}，本次抵达后仍须亲查。</p>
    </article>;
  }
  function routeLocation(location: Visit['kit']['location']) {
    return location === 'LOCAL' ? '贝克兰德本地路线台' : location === 'PROVIDER_ARCHIVE' ? '供应者的本次原件档案' : ritual.sites.find(s => s.id === location)?.name ?? location;
  }
  function visitFacts(visit: Visit, historical: boolean) {
    return <article aria-label={historical ? `${visit.id}已保存远行` : '当前远行原件与位置'}>
      <h4>{historical ? '已保存行程' : '本次正在进行的行程'} · {visit.id}</h4>
      <p>第{visit.week}周，{ritual.sites.find(s => s.id === visit.siteId)?.name ?? visit.siteId} · {visit.purpose === 'HELP' ? '初访帮助' : '后来亲访核实'} · {PHASE[visit.phase]} · {VISIT_RESULT[visit.result]}。</p>
      {!historical && <p className="slice-notice"><strong>本人实际位置：{ritual.locationLabel}。</strong>原身体与本次套件一起移动；关闭页面不会改变位置。</p>}
      <dl className="seer-facts">
        <div><dt>当次独立套件</dt><dd>{visit.kit.id} · 第{visit.kit.purchasedWeek}周实付{visit.kit.price}便士</dd></div>
        <div><dt>套件当前位置</dt><dd>{routeLocation(visit.kit.location)}</dd></div>
        <div><dt>同一原护具</dt><dd>{visit.kit.suit.id} · 剩{visit.kit.suit.protectionSeconds}/{visit.kit.suit.initialProtectionSeconds}秒，已耗{visit.kit.suit.spentSeconds}秒</dd></div>
        <div><dt>原能源余量</dt><dd>{visit.kit.energy.filter(e => e.status === 'UNUSED').length}/{visit.kit.energy.length}片</dd></div>
        <div><dt>本次实耗</dt><dd>{visit.paid.actions}行动、{visit.paid.spirituality}灵性、{visit.paid.pennies}便士、{visit.paid.energyPieces}片能源</dd></div>
        <div><dt>本次身体代价</dt><dd>精神−{visit.paid.mind}、污染+{visit.paid.pollution}；已用防护{visit.paid.protectionSeconds}秒</dd></div>
      </dl>
      <ul>{visit.kit.energy.map(piece => <li key={piece.id}>{piece.id}：{piece.status === 'UNUSED' ? '原片未用' : piece.consumedFor === 'OUTBOUND' ? '已耗于本次出程' : '已耗于本次回程'}</li>)}</ul>
      <p>本次坐标{visit.coordinatesRead ? '已核读' : '尚未核读'}；防护{visit.protectionChecked ? '已亲查' : '尚未亲查'}；本地回程计划{visit.returnPlanned ? '已核实' : '尚未核实'}；当地回程原标记{visit.returnMarkerChecked ? '已亲查' : '尚未亲查'}。</p>
      <p>出程检定：{visit.departureTier ? TIER[visit.departureTier] : '尚未进行'}。实际帮助{visit.helpPerformed ? '已完成' : '尚未完成'}，后来转述复核{visit.verificationPerformed ? '已完成' : '尚未完成'}。</p>
      {visit.moves.length > 0 && <ul>{visit.moves.map((move, i) => <li key={i}>{routeLocation(move.from)} → {routeLocation(move.to)}：同一身体与套件{move.kitId}，实耗{move.seconds}秒防护和原片{move.energyPieceId}。</li>)}</ul>}
      {!historical && <p className="slice-notice seer-risk">回程仍需8灵性、同一套件的一片未用原能源、10秒防护，以及在当地亲查过的原标记。人在异星时不能在本地工作、休养或过周；回来后还须归档原件。生活舱的空气不抵消污染。</p>}
      {historical && <p>以上是当次记录，原余量随该次套件归档；当前身体与资源以上方实况为准。</p>}
    </article>;
  }
  function lifeFacts() {
    const p = encounter.inside && encounter.site ? encounter.site : life.site;
    return <section className="seer-current-case" aria-label="旅法师通行室当前实况"><h3>本人、原物与当前通路</h3>
      {p.introducedWeek === null ? <p>尚未当面认识玛拉或检查本次通行室。先观察当前实践。</p> : <>
        <p className="slice-notice"><strong>本人实际在{POSITION[p.playerLocation]}{p.playerLocation === 'REMOTE' && p.verifiedEndpoint ? `（${p.verifiedEndpoint.title}）` : ''}。</strong>普通步行累计{p.playerMetres}米，实际星界通行{p.playerAstralLegs}程；现场累计{p.elapsedSeconds}秒。</p>
        <p>{p.operatorName}，{p.operatorAge}岁，在{POSITION[p.operatorLocation]}；精力{p.operatorEnergy}/100，普通步行累计{p.operatorMetres}米。她的身体留在实际位置。</p>
        <p className={p.operatorConsent === 'WITHDRAWN' || p.operatorConsent === 'DECLINED' ? 'slice-notice seer-risk' : 'slice-notice'}>当前许可：{CONSENT[p.operatorConsent]}。{p.operatorConsentWeek !== null && `第${p.operatorConsentWeek}周当面询问。`}每案重新询问，已付费用不延长许可。</p>
        <dl className="seer-facts">
          <div><dt>唯一原封包</dt><dd>{p.parcel.id} · {PARCEL[p.parcel.location]} · 数量{p.parcel.quantity}</dd></div>
          <div><dt>原包实际路程</dt><dd>普通搬运{p.parcel.ordinaryMetres}米，星界通行{p.parcel.astralLegs}程</dd></div>
          <div><dt>原遮门</dt><dd>{p.door.id} · {DOOR[p.door.state]} · 实际操作{p.door.operations}次</dd></div>
          <div><dt>原油灯</dt><dd>{p.lamp.id} · 剩{p.lamp.oilRemaining}份灯油，已实看{p.lamp.shows}次</dd></div>
          <div><dt>本人已知光纹</dt><dd>{p.lamp.patternKnown ? '已亲见并理解三环光纹' : '尚未亲见理解'}</dd></div>
          <div><dt>同一原屏</dt><dd>{p.screen.id} · {p.screen.state === 'MATCHED' ? '已有真实对照记录' : '尚无真实对照'} · 实际应用{p.screen.applications}次</dd></div>
          <div><dt>当前作用</dt><dd>{EFFECT[p.effect.mode]}{p.effect.expiresAt !== null && ` · 剩${Math.max(0, p.effect.expiresAt - p.elapsedSeconds)}秒`}</dd></div>
          <div><dt>异星回程原标记</dt><dd>{p.returnMarkerRead ? '本次已在当地亲读' : '本次尚未在当地亲读'}</dd></div>
          <div><dt>本地近远两垫</dt><dd>{p.localPadsKnown ? '本人已沿普通路实查两端' : '尚未实查两端'}</dd></div>
        </dl>
        {p.verifiedEndpoint && <p>已核端点：{p.verifiedEndpoint.title}；此前第{p.verifiedEndpoint.qualifiedWeek}周本人完成传说核验。原坐标{p.verifiedEndpoint.coordinateId}，原回程标记{p.verifiedEndpoint.returnMarkerId}。</p>}
        <ul>{Object.values(p.kits).map(kit => <li key={kit.id}>{kit.id}：{kit.status === 'SUPPLIER' ? `供应方保管，尚未实付${kit.pricePennies}便士` : `${kit.status === 'PLAYER' ? '本案已持有' : '本案已归档'}，第${kit.purchasedWeek}周实付${kit.paidPennies}便士`}；原防护剩{kit.protectionSeconds}/{kit.initialProtectionSeconds}秒，已实际通行{kit.astralLegs}程。</li>)}</ul>
        <p className="slice-notice seer-risk">前往异星的象征通行让同一身体携同一原包真正到达。出发和返回各耗10秒防护、污染各+1；返回另付8灵性且须亲读当地原标记。停止或窗口到期不把身体送回来。</p>
        <p>本地普通出口{p.ordinaryExit === 'OPEN' ? '开放' : '不可通行'}。普通道路只连接通行室与室外，不能从异星步行回家。实际回到本地后，仍须停止作用、放回原包、关好原门、归档护具并收束接触。</p>
      </>}
      {life.currentAttempt && <section aria-label="旅法师当前尝试"><h4>本次已发生的步骤</h4>{attemptFacts(life.currentAttempt, false)}</section>}
    </section>;
  }
  function attemptFacts(a: Attempt, historical: boolean) {
    const end = historical ? (a.siteAtClose?.elapsedSeconds ?? a.siteAtStart.elapsedSeconds + a.elapsedSeconds) : life.site.elapsedSeconds;
    return <div><p>第{a.week}周 · {a.method === 'ABILITY' ? '能力方法' : '普通方法'} · {a.closed ? '已实际收束' : '尚未收束'}。实际经过{a.elapsedSeconds}秒，实耗{a.spiritualitySpent}灵性、{a.penniesSpent}便士，污染+{a.pollutionAdded}。</p>
      <p>普通步行{a.playerTravelMetres}米，实际星界通行{a.playerAstralLegs}程，实耗防护{a.protectionSpent}秒；玛拉精力−{a.operatorEnergySpent}。</p>
      <p>实施{a.performed ? '已进行' : '尚未进行'}；检定{a.abilityTier ? TIER[a.abilityTier] : '尚无'}；{WINDOW[a.window]}{a.window === 'ACTIVE' && a.windowExpiresAt !== null ? `，剩${Math.max(0, a.windowExpiresAt - end)}秒` : ''}；作用{a.effectStopped ? '已明确停止' : '尚无明确停止记录'}。</p>
      <p>端点{a.endpointsChecked ? '已核读' : '尚未核读'}，原光纹{a.patternRead ? '已亲见理解' : '尚未亲见理解'}。{a.departed ? '本人已携原包实际出发。' : '本次没有实际异星出发。'}{a.returnedLocal ? '已付费真实返回本地。' : ''}原包{a.parcelReturned ? '已亲手放回' : '尚无本次放回记录'}，护具{a.kitArchived ? '已归档' : '尚无本次归档记录'}。</p>
      <p>{a.patternApplied ? '已把短暂光纹实际投到原屏完成对照。' : '没有本次光纹实际应用。'}{a.manualComparison ? '已按实读原记录完成普通比对。' : ''}实际应用技巧：{a.appliedAbilityIds.length ? a.appliedAbilityIds.map(id => value.abilities.find(ability => ability.id === id)?.label ?? id).join('、') : '无'}。</p>
      <p>{a.permissionWithdrawn ? '玛拉已在本次明确撤回许可，未应用的成功不增加掌握。' : `本次许可：${CONSENT[a.operatorConsent]}。`}{a.inspected ? '已核实真实结果。' : '尚待核实真实结果。'}{a.interrupted && '中止的经过和消耗保留。'}</p>
      {historical && <p>这是当次已保存记录。{a.siteAtClose && `收束时本人在${POSITION[a.siteAtClose.playerLocation]}，原包在${PARCEL[a.siteAtClose.parcel.location]}，原门${DOOR[a.siteAtClose.door.state]}。`}当前位置和资源以上方为准。</p>}
    </div>;
  }
  function encounterFacts() {
    const enemy = encounter.enemy, p = encounter.site ?? life.site;
    return <section aria-label="旅法师可选遭遇"><h3>{encounter.title}</h3><p>{STATUS[encounter.status] ?? encounter.status}</p><p>{encounter.story}</p>
      {enemy && <><p>{enemy.name}，{enemy.age}岁，序列{enemy.sequence}；当前在{POSITION[enemy.location]}。健康{enemy.health}/100、精神{enemy.mind}/100、独立灵性{enemy.spirituality}/120；{enemy.status === 'DEAD' ? '已死亡，身体留在原处' : enemy.status === 'SURRENDERED' ? '已投降，停止抵抗' : '仍在抵抗'}。</p>
        <p>他的同一原棍{enemy.weaponId}：{enemy.weaponLocation === 'HAND' ? `仍在${enemy.name}手中` : `留在${POSITION[enemy.weaponLocation]}`}。</p>
        <p>{Object.entries(enemy.powerUses).map(([id, count]) => `${POWER[id] ?? id}实际使用${count}次`).join('；')}。</p></>}
      <p>本人在{POSITION[p.playerLocation]}，玛拉在{POSITION[p.operatorLocation]}；同一原门{DOOR[p.door.state]}，原包在{PARCEL[p.parcel.location]}。</p>
      <ul>{encounter.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
      <p className="slice-notice seer-risk">交谈后仍可普通离开。真正开战会使用当前身体、原武器与各自灵性，双方可能受伤、撤退或死亡；不会补充资源，战斗不增加本阶技巧掌握。</p>
    </section>;
  }

  return <section className="seer-panel warrior-panel planeswalker-panel" aria-label="旅法师" aria-busy={busy || submittedId !== null}>
    <section className="seer-summary" aria-label="旅法师当前目标"><span className="seer-seal">{value.promoted ? '旅法师 · 门序列2' : '漫游者3 → 旅法师2'}</span>
      <h2 ref={heading} tabIndex={-1}>{value.title}</h2>
      <p className="seer-next"><strong>下一步：</strong>{deceased ? '本人已死亡。本页只保留查看，不能继续行动。' : next ? `${next.label} · ${next.cost}${!next.enabled && next.reason ? `。${next.reason}` : ''}` : '当前没有可提交的步骤，可查看已保存经历。'}</p>
      <p>{value.digestion}</p>
    </section>
    {resources()}
    {deceased && <p role="status" className="slice-notice seer-risk">本人已死亡。身体、原物、伤势与消耗保留；切换页面不会复活。</p>}
    {error !== null && <p role="alert">{typeof error === 'string' ? error : error.message} 当前仍显示上次已保存事实。{typeof error !== 'string' && error.retryable === false ? '请按保存错误提示重新加载。' : '请使用保存错误处的重试，继续同一操作；此处不会重复提交。'}</p>}
    {(busy || submittedId !== null) && <p role="status" aria-live="polite">正在保存本次操作。重复点击、清除错误或等待都不会再次提交或扣除资源。</p>}

    {value.guidanceKnown && !value.promoted && <section className="seer-current-case" aria-label="旅法师九处传说与当前路线"><h3>{ritual.title}</h3>
      <p className="slice-notice"><strong>已核实传说与返程：{ritual.qualifiedSites}/9处。</strong>{ritual.qualifiedWeek !== null && `第${ritual.qualifiedWeek}周全部完成。`}已实际抵达{realArrivals}次，完成真实往返{roundTrips}次。</p>
      <p>九处各需一次初访帮助、一次后来真实周的亲访复核，共18次成功到场并返回。失败出程、仅在本地准备或重复查看不会代替这些行程。</p>
      <p>{ritual.story}</p><p className="slice-notice seer-risk">{ritual.risk}</p>
      <p><strong>本人当前在{ritual.locationLabel}。</strong>累计真实出返{ritual.offworldLegs}程，路线经过{ritual.clockSeconds}秒。</p>
      <label className="seer-case-selector">选择聚居点<select value={selectedSite?.id ?? ''} disabled={locked || confirmation !== null || ritual.inside || ritual.currentVisit !== null} onChange={e => setSiteId(e.target.value)}>
        {ritual.sites.map(site => <option key={site.id} value={site.id}>{site.name} · {site.status}</option>)}
      </select></label>
      {ritual.currentVisit && visitFacts(ritual.currentVisit, false)}
      {selectedSite && siteFacts(selectedSite)}
    </section>}

    {!value.promoted && <section aria-label="旅法师独立药瓶与准备"><h3>独立药瓶与本周准备</h3>
      {!value.guidanceKnown && <p>{value.story}</p>}{sourceFacts()}<p>{value.supplies}</p>
      {value.bottles.length > 0 && <label className="seer-case-selector">查看药瓶<select value={bottle?.id ?? ''} disabled={locked || confirmation !== null || ritual.inside} onChange={e => setBottleId(e.target.value)}>
        {value.bottles.map(b => <option key={b.id} value={b.id}>{b.title} · {b.status}</option>)}
      </select></label>}
      {bottle && <article><h4>{bottle.title} · {bottle.id}</h4><p>{bottle.source}</p><p>当前状态：{bottle.status} · 当前成功率{bottle.chance}%</p></article>}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul>
      <p>当次场地与辅助箱检查：{value.preparedWeek === null ? '尚未进行' : `第${value.preparedWeek}周已完成`}。专业学习、各瓶劳务、购买、当周检查和饮用分别进行。</p>
      {value.preparedWeek !== null ? <p className="slice-notice seer-risk">{value.risk}</p> : <details className="seer-fold"><summary>服药条件、真实成本与失败风险</summary><p>{value.risk}</p></details>}
    </section>}

    {value.promoted && <>{lifeFacts()}
      {!encounter.inside && <section className="seer-current-case" aria-label="旅法师当前实践"><h3>本次实践</h3>
        <label className="seer-case-selector">查看实践<select value={selectedCase?.id ?? ''} disabled={locked || confirmation !== null || life.inside || life.insideCase || life.cases.some(c => c.contactOpen || c.status === 'PREPARED')} onChange={e => setCaseId(e.target.value)}>
          {life.cases.map(c => <option key={c.id} value={c.id}>{c.title} · {STATUS[c.status] ?? c.status}</option>)}
        </select></label>
        {selectedCase && <><h4>{selectedCase.title} · {STATUS[selectedCase.status] ?? selectedCase.status}</h4><p>{selectedCase.story}</p><ul>{selectedCase.observations.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
          {selectedCase.result && <p className="slice-notice">{selectedCase.result}</p>}
          {!life.currentAttempt && selectedCase.attempts.at(-1) && <section aria-label="旅法师本案最近记录"><h4>本案最近已保存经历</h4>{attemptFacts(selectedCase.attempts.at(-1)!, true)}</section>}
        </>}
      </section>}
      {encounter.inside && encounterFacts()}
    </>}

    <section aria-label="旅法师当前行动"><h3>{sceneLocked ? '当前现场的下一步' : '当前可选行动'}</h3>
      {actions(immediate.filter(a => !RETURN.has(a.command.type)), '旅法师当前步骤')}
      {immediate.some(a => RETURN.has(a.command.type)) && <section aria-label="旅法师真实返回与收尾"><h4>{ritual.inside ? '核回程标记、实际返回与本地归档' : value.promoted ? '停止作用、真实返回与普通收尾' : '沿原出口结束当次准备'}</h4>
        {actions(immediate.filter(a => RETURN.has(a.command.type)), '旅法师实际停止与返回')}
        <p>这里每一步都按所示位置、资源和成本执行。关闭页面不替代本人返回、原物交还或当次准备结束。</p>
      </section>}
      {currentActions.some(a => !immediate.includes(a)) && <details className="seer-fold"><summary>其它步骤与未满足条件</summary>{actions(currentActions.filter(a => !immediate.includes(a)), '旅法师尚未满足条件的步骤')}</details>}
    </section>

    {value.promoted && !encounter.inside && <details className="seer-fold"><summary>通行室的可选冲突</summary>{encounterFacts()}{actions(battle, '旅法师可选遭遇行动')}</details>}
    {value.guidanceKnown && <details className="seer-fold"><summary>九处传说与已保存远行 · {ritual.qualifiedSites}/9处</summary>
      <p>{ritual.environment}</p><p>已实际抵达{realArrivals}次，完成真实往返{roundTrips}次。以下按各处原记录保留，服药失败不会抹去事迹。</p>
      {ritual.sites.map(site => <details key={site.id}><summary>{site.name} · {site.status}</summary>{siteFacts(site)}
        {ritual.visits.filter(visit => visit.siteId === site.id && visit.id !== ritual.currentVisit?.id).map(visit => <details key={visit.id}><summary>第{visit.week}周 · {visit.purpose === 'HELP' ? '初访' : '复访'} · {VISIT_RESULT[visit.result]} · {visit.id}</summary>{visitFacts(visit, true)}</details>)}
      </details>)}
    </details>}
    {value.promoted && <><details className="seer-fold"><summary>原瓶、辅助原物与专业准备记录</summary>{sourceFacts()}<p>{value.supplies}</p>
      {value.bottles.map(b => <details key={b.id}><summary>{b.title} · {b.status}</summary><p>{b.id} · {b.source}</p></details>)}
      <ul>{value.preparations.map(p => <li key={p.taskId}>{p.title}：{p.completedWeek === null ? '尚未完成' : `第${p.completedWeek}周已完成`}</li>)}</ul><p>{value.risk}</p>
    </details>
      <details className="seer-fold"><summary>三案经历与实际技巧掌握</summary><p>{life.story}</p>
        {life.cases.map(c => <details key={c.id}><summary>{c.title} · {STATUS[c.status] ?? c.status}</summary><p>{c.result ?? '尚无已报告结果。'} · 已实际收束{c.closes}次。</p>{c.attempts.map((a, i) => <div key={i}>{attemptFacts(a, true)}</div>)}</details>)}
        {value.abilities.map(a => <p key={a.id}>{a.label} · 掌握{a.mastery}：{a.description}</p>)}
        <p>检定成功不等于实际应用。每案只有确实使用并如实报告的技巧才增加掌握；普通核读、未使用的成功和撤回后的停止不会得到能力掌握。</p><p>{value.digestion}</p>
      </details></>}
    <details className="seer-fold"><summary>身体与此前经历</summary><p>当前身体性别：{GENDER[value.currentGender] ?? value.currentGender}。已有掌握、原伤势和累计风险保留；晋升不会补满当前灵性。</p>
      <ul>{value.inheritedHistory.map((fact, i) => <li key={i}>{fact}</li>)}</ul><p>{value.environment}</p>
    </details>
    {onClose && <button type="button" className="slice-button quiet" disabled={locked || sceneLocked || confirmation !== null} onClick={() => { if (!locked && !sceneLocked && !confirmationRef.current) onClose(); }}>关闭旅法师页面</button>}

    {confirmation && <dialog ref={dialog} className="seer-panel seer-confirmation" aria-labelledby="planeswalker-confirm-title" aria-describedby="planeswalker-confirm-cost"
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal}
      style={{ width: 'min(760px, calc(100vw - 32px))', maxHeight: '85vh', overflow: 'auto', color: 'var(--slice-ink)', background: 'var(--slice-paper-light)', padding: 24 }}
      onCancel={e => { e.preventDefault(); dismissConfirmation(); }}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dismissConfirmation(); }
        if (e.key === 'Tab') {
          const controls = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const first = controls[0], last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      {error !== null && <p role="status">保存尚未成功，本次确认保持锁定。请使用保存错误处的重试。</p>}
      <h3 id="planeswalker-confirm-title">{liveConfirmation?.command.type === 'CONSUME' ? '独立确认服用这一药瓶' : liveConfirmation?.command.type === 'DEPART_RITUAL' || liveConfirmation?.command.type === 'DEPART' ? '确认原身体实际前往异星' : liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' ? '确认真正交战' : '确认本次消耗与风险'}</h3>
      <p>{liveConfirmation?.label ?? '当前条件已改变，请返回最新状态。'}</p><p id="planeswalker-confirm-cost">{liveConfirmation?.cost ?? '原确认已失效，不提交。'}</p>
      {confirmedBottle && <><p>{confirmedBottle.title} · {confirmedBottle.id} · {confirmedBottle.status}</p><p>{confirmedBottle.source}</p><p>当前成功率{confirmedBottle.chance}%；当次检查{value.preparedWeek === null ? '尚未完成' : `第${value.preparedWeek}周`}。</p></>}
      {liveConfirmation?.command.type === 'CONSUME' && <><p className="slice-notice seer-risk">{value.risk}</p><p>这一原瓶、它专属箱中的三条辅助原件和本次检查均会耗尽，成功失败都不退费。失败保留九处真实传说；再次尝试须另一原瓶、新辅助原件和付费重检。</p></>}
      {liveConfirmation?.command.type === 'PREPARE_ROUTE_KIT' && <><p>本次目的地：{confirmedSite?.name}。花1行动与30便士取得这一程的新护具和两片独立能源，随后仍须分别核坐标、防护与回程，再单独确认出发。</p><p>可在本地归档取消，但已付成本不退；未用余量不会补进旧护具或旧能源库存。</p></>}
      {liveConfirmation?.command.type === 'DEPART_RITUAL' && <><p className="slice-notice seer-risk">{ritual.risk}</p>
        <p>这一步让原身体前往{selectedSite?.name}。知识检定失败仍耗8灵性和一片原能源，精神−5、污染+2，身体留在本地；成功实耗10秒防护、污染+1并到达当地。</p>
        {ritual.currentVisit && visitFacts(ritual.currentVisit, false)}
        <p>另须为真实回程保留8灵性、一片原能源和10秒防护，到场后亲查原回程标记。不能靠关闭页面、工作或休养回到本地。</p>
      </>}
      {liveConfirmation?.command.type === 'PERFORM' && <><p>{confirmedCase?.method === 'ORDINARY' ? '采用普通方法，只核对已经实读的记录，不产生光纹或异星通行，也不增加能力掌握。' : confirmedCase?.id === 'pattern-reproduction' ? '尝试短暂复现已经亲见理解的原灯光纹。成功后仍须原门开放，并在窗口内实际把光纹投到原屏完成对照，才算应用。' : '尝试有限象征通行。成功只开启窗口，尚未移动本人或原包；还须当前许可、原门开放和足额保护，才能另行实际出发。'}</p>
        <p>{confirmedCase?.id === 'withdrawn-transit' ? '本案付费实施后，玛拉会明确撤回现场协调许可。读取她当前的决定，停止并普通收尾；本案不能出发，未应用的成功不增加掌握。' : '失败同样支付成本，之后仍须按原物与身体的实际位置停止、返回和收束。'}</p>
      </>}
      {liveConfirmation?.command.type === 'DEPART' && <><p className="slice-notice seer-risk">本人携唯一原封包，通过当前象征通路前往{life.site.verifiedEndpoint?.title ?? '已核异星端点'}。出程消耗10秒原防护、污染+1。玛拉留在本地，不生成另一个身体。</p>
        <p>返回仍需亲读当地原标记、另付8灵性、10秒原防护及污染+1。原包{life.site.parcel.id}当前在{PARCEL[life.site.parcel.location]}；本案护具{life.site.kits['symbolic-transit'].id}剩{life.site.kits['symbolic-transit'].protectionSeconds}秒。窗口停止或到期不会自动返回。</p></>}
      {liveConfirmation?.command.type === 'READ_PATTERN' && <p>本人亲见同一原灯的三环光纹，真实消耗一份灯油。只有亲见理解的这一式样可用于本案有限复现，不产生未知图案、物质、人物或能力库。</p>}
      {liveConfirmation?.command.type === 'APPLY_PATTERN' && <p>用当前仍有效的窗口，在同一原屏上实际比对短暂光纹，经过4秒。原灯、原屏与已耗灯油保留；成功施术但未完成这一步不算实际应用。</p>}
      {liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' && <><p className="slice-notice seer-risk">你选择与{encounter.enemy?.name ?? '当前对手'}真正交战。双方沿用当前健康、精神、独立灵性与原武器，可能受伤、撤退或死亡。</p>{encounterFacts()}</>}
      {resources('旅法师操作确认当前资源')}
      {liveConfirmation?.reason && <p className="seer-action-reason">{liveConfirmation.reason}</p>}
      <div className="seer-confirm-buttons"><button type="button" ref={cancel} className="slice-button quiet" disabled={locked} onClick={dismissConfirmation}>取消，返回查看</button>
        <button type="button" className="slice-button" disabled={locked || !liveConfirmation?.enabled} onClick={() => { if (liveConfirmation) submit(liveConfirmation); }}>{liveConfirmation?.command.type === 'CONSUME' ? '确认服用这一药瓶' : liveConfirmation?.command.type === 'DEPART_RITUAL' || liveConfirmation?.command.type === 'DEPART' ? '确认承担风险，本体实际出发' : liveConfirmation?.command.type === 'ENCOUNTER_FIGHT' ? '确认真正交战' : '确认执行这一次操作'}</button></div>
      <p className="slice-muted">取消不提交、不扣资源。提交后等待同一次保存结果；关闭确认或页面不能代替实际停止与退出。</p>
    </dialog>}
  </section>;
}
