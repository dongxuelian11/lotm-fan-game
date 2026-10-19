import type { PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { SunHost, SunEffect } from './ports.js';
import { sunServicesComplete, sunServiceVerifiedReceipts, type SunServicesState, type SunHeatPlant, type SunResident, type SunSceneInjury } from './services.js';
import type { SunServiceReceipt } from './types.js';

const RADIANCE = 'sun.s0.directed-solar-radiance', WARD = 'sun.s0.bounded-radiance-ward';
const TYPES = ['OBSERVE', 'OPEN_SIGHT_SLOT', 'CLOSE_SHUTTER', 'WAIT_STEAM', 'DIRECTED_RADIANCE', 'APPLY_PURIFICATION', 'RADIANCE_WARD', 'GUIDE_SHORT_ROUTE', 'STOP_EFFECTS', 'CUTOFF_AND_SEAL', 'ORDINARY_EXIT', 'WITHDRAW', 'REPORT', 'REPAIR_BOILER'] as const;
export type SunEpilogueCommand = { type: typeof TYPES[number] };
interface SunWindow { attempted: boolean; passed: boolean; applied: boolean; version: number | null; expiresSecond: number | null }
interface SunIncidentOrigin { heat: SunHeatPlant; resident: SunResident; helper: SunResident; shelteredResident: SunResident; receipts: SunServiceReceipt[] }
export interface SunEpilogueState {
  id: 'sun-original-washhouse-valve'; actorId: string; location: 'SUN0-WASHHOUSE'; startedWeek: number; startedSecond: number; lastSecond: number;
  status: 'ACTIVE' | 'RESOLVED' | 'WITHDRAWN'; position: number; reported: boolean; observed: boolean; conditionVersion: number;
  /** Immutable service-end snapshot; the fields below are the sole current continuation of these original objects. */
  origin: SunIncidentOrigin; heat: SunHeatPlant; resident: SunResident; helper: SunResident; shelteredResident: SunResident;
  initialMovement: { residentFrom: 0; residentTo: 8; residentMeters: 8; helperMeters: 4; fuelId: string };
  shutter: { id: 'SUN0-BOILER-SHUTTER'; open: boolean; openedOnce: boolean; clearUntilSecond: number | null };
  shield: { id: 'SUN0-HEAT-SHIELD'; condition: number; stripId: string | null; targetId: string };
  supplies: { focus: { id: 'SUN0-FOCUS-INSERT'; stock: 0 | 1; purchased: boolean; spent: boolean }; strip: { id: 'SUN0-HEAT-STRIP'; stock: 0 | 1; purchased: boolean; spent: boolean }; valve: { id: 'SUN0-SPARE-VALVE'; stock: 0 | 1; purchased: boolean; installed: boolean } };
  radiance: SunWindow; ward: SunWindow; playerInjuries: SunSceneInjury[];
  arrival: { eventId: string; second: number; route: 'SHORT' | 'SIDE'; residentMeters: number; helperMeters: number; thermalHealthLoss: number } | null;
  repairedEventId: string | null;
  journal: { eventId: string; revision: number; command: SunEpilogueCommand; host: SunHost; beforeSecond: number; afterSecond: number;
    residentFrom: number; residentTo: number; effect: SunEffect; check: PublicCheckResult | null; masteryGains: Record<string, number>; notes: string[] }[];
}
const clone = <T>(v: T): T => structuredClone(v);
const blank = (): SunEffect => ({ cashCost: 0, cashGain: 0, actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 0, toLocation: null });
const fresh = (): SunWindow => ({ attempted: false, passed: false, applied: false, version: null, expiresSecond: null });
const skill = (c: SunEpilogueCommand) => c.type === 'DIRECTED_RADIANCE' || c.type === 'RADIANCE_WARD';
const pass = (c: PublicCheckResult | null) => c?.tier === 'SUCCESS' || c?.tier === 'GREAT_SUCCESS';
const visible = (s: SunEpilogueState, second: number, duration: number) => s.shutter.open && s.shutter.clearUntilSecond !== null && second + duration <= s.shutter.clearUntilSecond;
const live = (w: SunWindow, s: SunEpilogueState, second: number, duration: number) => w.passed && !w.applied && w.version === s.conditionVersion && w.expiresSecond !== null && second + duration <= w.expiresSecond;
const endEffects = (s: SunEpilogueState) => { s.radiance.expiresSecond = null; s.ward.expiresSecond = null; };
export function validateSunEpilogueCommand(v: unknown): v is SunEpilogueCommand { return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).join('|') === 'type' && TYPES.includes((v as SunEpilogueCommand).type); }
function fromOrigin(origin: SunIncidentOrigin, actorId: string, week: number, nowSecond: number): SunEpilogueState {
  if (!actorId || !Number.isSafeInteger(week) || week < 1 || !Number.isSafeInteger(nowSecond) || nowSecond < 0 || origin.resident.position !== 0 || origin.helper.position !== 0 || origin.shelteredResident.position !== 0 || origin.heat.id !== 'SUN0-BOILER-1' || !origin.heat.repairedJoint || origin.heat.fuel.filter(f => f.holder === 'OWNER').length !== 1 || origin.heat.cassette.contained !== 4) throw Error('须从同一修好原炉、院内原居民与剩余一份店主燃料接续。');
  const heat = clone(origin.heat), resident = clone(origin.resident), helper = clone(origin.helper), fuel = heat.fuel.find(f => f.holder === 'OWNER')!;
  fuel.holder = 'BURNED'; heat.condition = Math.max(0, heat.condition - 10); heat.version++; heat.cutoffClosed = false; heat.pressure = 3;
  heat.cassette.contained = 0; heat.cassette.exposed = 4;
  resident.position = 8; resident.travelledMeters += 8; resident.consent = 'UNASKED'; helper.travelledMeters += 4; helper.consent = 'UNASKED';
  return { id: 'sun-original-washhouse-valve', actorId, location: 'SUN0-WASHHOUSE', startedWeek: week, startedSecond: nowSecond, lastSecond: nowSecond,
    status: 'ACTIVE', position: 0, reported: false, observed: false, conditionVersion: 1, origin: clone(origin), heat, resident, helper, shelteredResident: clone(origin.shelteredResident),
    initialMovement: { residentFrom: 0, residentTo: 8, residentMeters: 8, helperMeters: 4, fuelId: fuel.id },
    shutter: { id: 'SUN0-BOILER-SHUTTER', open: false, openedOnce: false, clearUntilSecond: null }, shield: { id: 'SUN0-HEAT-SHIELD', condition: 80, stripId: null, targetId: resident.id },
    supplies: { focus: { id: 'SUN0-FOCUS-INSERT', stock: 1, purchased: false, spent: false }, strip: { id: 'SUN0-HEAT-STRIP', stock: 1, purchased: false, spent: false }, valve: { id: 'SUN0-SPARE-VALVE', stock: 1, purchased: false, installed: false } },
    radiance: fresh(), ward: fresh(), playerInjuries: [], arrival: null, repairedEventId: null, journal: [] };
}
export function createSunEpilogue(services: SunServicesState, input: { week: number; nowSecond: number; actorId?: string }): SunEpilogueState {
  if (!sunServicesComplete(services) || input.actorId !== undefined && input.actorId !== services.actorId || input.nowSecond < services.lastSecond || input.week < services.startWeek) throw Error('须由完成两件真实居民服务的同一本人接续。');
  const washhouse = services.sites.find(p => p.id === 'washhouse-heat')!, stairs = services.sites.find(p => p.id === 'stair-evacuation')!;
  return fromOrigin({ heat: clone(washhouse.heat!), resident: clone(washhouse.resident), helper: clone(washhouse.helper), shelteredResident: clone(stairs.resident), receipts: sunServiceVerifiedReceipts(services) }, services.actorId, input.week, input.nowSecond);
}
export function sunEpilogueCost(_s: SunEpilogueState, c: SunEpilogueCommand, _h: SunHost): SunEffect {
  const e = blank();
  if (c.type === 'OBSERVE' || c.type === 'REPORT') e.seconds = 20;
  if (c.type === 'OPEN_SIGHT_SLOT') e.seconds = 10;
  if (c.type === 'CLOSE_SHUTTER') e.seconds = 5;
  if (c.type === 'WAIT_STEAM') e.seconds = 45;
  if (c.type === 'DIRECTED_RADIANCE') { e.actions = 1; e.cashCost = 8; e.spirituality = 14; e.mind = 8; e.seconds = 8; }
  if (c.type === 'APPLY_PURIFICATION') e.seconds = 5;
  if (c.type === 'RADIANCE_WARD') { e.actions = 1; e.cashCost = 6; e.spirituality = 12; e.mind = 6; e.seconds = 5; }
  if (c.type === 'GUIDE_SHORT_ROUTE') { e.actions = 1; e.seconds = 20; }
  if (c.type === 'STOP_EFFECTS') e.seconds = 2;
  if (c.type === 'CUTOFF_AND_SEAL') e.seconds = 120;
  if (c.type === 'ORDINARY_EXIT' || c.type === 'WITHDRAW') e.seconds = 180;
  if (c.type === 'REPAIR_BOILER') { e.actions = 1; e.cashCost = 12; e.seconds = 600; }
  return e;
}
export function sunEpilogueBlock(s: SunEpilogueState, c: SunEpilogueCommand, h: SunHost): string | null {
  if (!validateSunEpilogueCommand(c)) return '无效的洗衣房处置；不能提供施术结果、居民位置或现成净化证明。';
  if (h.actorId !== s.actorId || h.sequence !== 0 || h.status !== 'ACTIVE' || h.location !== s.location) return '须同一仍存活的太阳本人在原洗衣房行动。';
  if (!h.eventId || !Number.isSafeInteger(h.nowSecond) || h.nowSecond < s.lastSecond || h.week < s.startedWeek || h.revision <= (s.journal.at(-1)?.revision ?? -1) || s.journal.some(j => j.eventId === h.eventId)) return '真实时间、动作次序或已结算事件无效。';
  if (c.type === 'REPORT') return s.status === 'ACTIVE' ? '先实际撤人或本人退出，再交接当前结果。' : s.reported ? '这次实际结果已经交接。' : null;
  if (c.type === 'REPAIR_BOILER') return !s.observed || !s.heat.cutoffClosed || s.heat.pressure !== 0 ? '须先观察并从安全侧实际停炉泄压。' : s.repairedEventId || s.supplies.valve.stock !== 1 ? '同一泄压阀已经普通修复，不能复制配件。' : h.actions < 1 || h.cash < 12 ? '普通修复需1行动和本人12便士；可以离场工作后回来修同一台原炉。' : null;
  if (s.status !== 'ACTIVE') return '本次事故已经结束，仍保留实际位置、伤势与损耗。';
  if (['STOP_EFFECTS', 'CUTOFF_AND_SEAL', 'WITHDRAW'].includes(c.type)) return null;
  if (c.type === 'OBSERVE') return s.observed ? '原炉、居民位置和普通侧道已亲眼查明。' : null;
  if (!s.observed) return '先观察原炉、原居民、退路和能从安全侧操作的切断柄。';
  if (c.type === 'ORDINARY_EXIT') return !s.heat.cutoffClosed || s.heat.pressure !== 0 ? '先从安全侧切断供料、泄压并封住原排气槽。' : s.resident.consent !== 'ACCEPT' || s.helper.consent !== 'ACCEPT' ? '居民或原操作员当前不愿同行，仍可本人退出。' : null;
  if (c.type === 'OPEN_SIGHT_SLOT') return s.shutter.openedOnce || s.heat.cutoffClosed ? '本次原观察口已开过，或原炉已经安全封闭；不能靠反复开口重试施术。' : null;
  if (c.type === 'CLOSE_SHUTTER') return !s.shutter.open ? '原遮板已经关闭。' : null;
  if (c.type === 'APPLY_PURIFICATION') return s.heat.cassette.exposed !== 4 || !visible(s, h.nowSecond, 5) || !live(s.radiance, s, h.nowSecond, 5) ? '同一原排气槽须仍清晰可见，四份残留仍在，且本次30秒窗口及条件版本均有效。' : null;
  if (c.type === 'DIRECTED_RADIANCE' && (s.radiance.attempted || s.heat.cassette.exposed !== 4 || !visible(s, h.nowSecond, 8) || s.supplies.focus.stock !== 1)) return '这股四份原残留须经原观察口可见，本次只尝试一次；不透明遮板和密汽会阻断定向辉光。';
  if (c.type === 'RADIANCE_WARD' && (s.ward.attempted || s.resident.position !== 8 || s.resident.consent !== 'ACCEPT' || s.helper.consent !== 'ACCEPT' || s.shield.targetId !== s.resident.id || s.supplies.strip.stock !== 1)) return '原居民须仍在八米烘衣区并同意此次有限护持；同一原隔热板只尝试一次。';
  if (c.type === 'GUIDE_SHORT_ROUTE' && (s.resident.position !== 8 || s.resident.consent !== 'ACCEPT' || s.helper.consent !== 'ACCEPT')) return '只可带仍在八米处、当前愿意的同一居民实走短路。';
  const e = sunEpilogueCost(s, c, h);
  return h.actions < e.actions ? '行动不足；普通停炉、侧道撤人和本人退出不消耗行动。' : h.cash < e.cashCost ? `本人需实付${e.cashCost}便士；没有现款仍能普通停炉和撤人。` : h.spirituality < e.spirituality || h.mind <= e.mind ? '灵性或精神不足，仍可选择普通停炉和侧道。' : null;
}
export function applySunEpilogue(previous: SunEpilogueState, c: SunEpilogueCommand, h: SunHost): { state: SunEpilogueState; effect: SunEffect; notes: string[]; injuries: SunSceneInjury[]; masteryGains: Record<string, number> } {
  const reason = sunEpilogueBlock(previous, c, h); if (reason) throw Error(reason);
  if (skill(c) !== (h.check !== null)) throw Error('只有两项有限施术消费中央产生的真实检定，普通动作不接收检定。');
  const s = clone(previous), e = sunEpilogueCost(s, c, h), notes: string[] = [], injuries: SunSceneInjury[] = [], masteryGains: Record<string, number> = {};
  const residentFrom = s.resident.position, afterSecond = h.nowSecond + e.seconds;
  const cutoff = () => {
    s.heat.cutoffClosed = true; s.heat.pressure = 0; s.heat.cassette.contained += s.heat.cassette.exposed; s.heat.cassette.exposed = 0;
    s.shutter.open = false; s.shutter.clearUntilSecond = null; s.conditionVersion++; endEffects(s);
  };
  if (c.type === 'OBSERVE') {
    s.observed = true; s.resident.consent = 'ACCEPT'; s.helper.consent = 'ACCEPT';
    notes.push('同一娜迪娅和托马斯沿原工道进入本次班次，最后一份店主已付燃料实际烧掉。另一只旧泄压阀破裂，先前换好的垫片仍在；原筛筒四份残留落入同一排气槽。托马斯在八米烘衣区请求撤离，也同意一次有限隔热护持；娜迪娅守在安全切断柄旁。莉娜仍在院内照料点，原脚踝伤未改变。遮板与蒸汽会挡住定向辉光，普通侧道可用。');
  } else if (c.type === 'OPEN_SIGHT_SLOT') {
    s.shutter.open = true; s.shutter.openedOnce = true; s.shutter.clearUntilSecond = afterSecond + 30; s.conditionVersion++; s.heat.pressure = Math.max(0, s.heat.pressure - 1); endEffects(s);
    notes.push('你从安全侧拉开原观察口，实际排出一格余压，短暂稀释近处蒸汽；同一排气槽可见30秒。没有穿透铁板或净化任何残留。');
  } else if (c.type === 'CLOSE_SHUTTER') {
    s.shutter.open = false; s.shutter.clearUntilSecond = null; s.conditionVersion++; endEffects(s);
    notes.push('原不透明遮板实际落下，光路被阻断，条件版本改变；先前成功开出的窗口也不能穿板使用。');
  } else if (c.type === 'WAIT_STEAM') { notes.push('实际等待45秒，观察口的薄汽重新聚拢。原四份残留、炉体损坏和人员位置都未凭等待消失。'); }
  else if (skill(c)) {
    const isRadiance = c.type === 'DIRECTED_RADIANCE', w = isRadiance ? s.radiance : s.ward, item = isRadiance ? s.supplies.focus : s.supplies.strip;
    item.stock = 0; item.purchased = true; item.spent = true;
    if (!isRadiance) s.shield.stripId = s.supplies.strip.id;
    w.attempted = true; w.passed = pass(h.check); w.version = s.conditionVersion; w.expiresSecond = w.passed ? afterSecond + 30 : null;
    notes.push(isRadiance ? `本人实付8便士、14灵性和8精神，耗去唯一聚光插片。${w.passed ? '对同一可见排气槽开出30秒定向窗口；尚未实际清除残留。' : '定向辉光未能稳定，四份残留仍在原处，不能重试本次施术。'}` : `本人实付6便士、12灵性和6精神，耗用唯一隔热衬片。${w.passed ? '原隔热板得到30秒一次性护持，只对应托马斯随后这一次短路热冲击，尚未发生救援。' : '护持失败，衬片已耗，托马斯仍在原烘衣区。'}`);
    if (!w.passed) {
      const severe = h.check!.tier === 'GREAT_FAILURE'; e.health = severe ? 20 : 8;
      const injury: SunSceneInjury = { id: `${h.eventId}:sun-thermal-injury`, severity: severe ? 'HEAVY' : 'LIGHT', acquiredRevision: h.revision, treatedRevision: null };
      injuries.push(injury); s.playerInjuries.push(injury); notes.push(`本人损失${e.health}健康并留下${severe ? '重' : '轻'}伤；已付费用和实际骰值不退，普通停炉和侧道仍在。`);
    }
  } else if (c.type === 'APPLY_PURIFICATION') {
    s.heat.cassette.neutralized += s.heat.cassette.exposed; s.heat.cassette.exposed = 0; s.radiance.applied = true; s.radiance.expiresSecond = null; masteryGains[RADIANCE] = 8;
    notes.push('定向辉光实际作用于同一排气槽的四份无生命残留，原件由外露转为已中和；新技巧掌握增8。没有净化任何人、疾病、灵魂或旧章样本，原炉仍须停炉。');
  } else if (c.type === 'GUIDE_SHORT_ROUTE') {
    const burst = s.heat.pressure > 0 && !s.heat.cutoffClosed, wardApplied = burst && live(s.ward, s, h.nowSecond, e.seconds) && s.shield.targetId === s.resident.id;
    const loss = burst && !wardApplied ? 8 : 0;
    s.resident.health = Math.max(0, s.resident.health - loss); if (loss) s.resident.injuries.push('本次短路热汽造成轻度烫伤，仍需普通照料');
    if (wardApplied) { s.ward.applied = true; s.ward.expiresSecond = null; masteryGains[WARD] = 8; }
    s.shield.condition -= 5; s.resident.position = 0; s.resident.travelledMeters += 8; s.helper.travelledMeters += 4;
    s.arrival = { eventId: h.eventId, second: afterSecond, route: 'SHORT', residentMeters: 8, helperMeters: 4, thermalHealthLoss: loss };
    endEffects(s); notes.push(`托马斯持同一隔热板实走八米回到院内，娜迪娅也沿原四米控制通道退出。${wardApplied ? '一次有效护持确实挡住这次8健康热冲击，掌握增8。' : loss ? '没有有效护持，托马斯实受8健康烫伤，不能写成无伤救援。' : '原炉已经停下，没有热冲击需要防护，故不给护持掌握。'}原隔热板磨损5；仍须如实处置原炉与残留。`);
  } else if (c.type === 'CUTOFF_AND_SEAL') { cutoff(); notes.push('从安全侧实际拉下原切断柄、泄尽余压，并关闭原排气槽的机械封板。未中和残留转为封闭存放，没有凭空消灭；原泄压阀损坏与两份已烧燃料保留。'); }
  else if (c.type === 'ORDINARY_EXIT') {
    const distance = s.resident.position === 0 ? 0 : 18; s.resident.position = 0; s.resident.travelledMeters += distance; s.helper.travelledMeters += 4;
    if (!s.arrival) s.arrival = { eventId: h.eventId, second: afterSecond, route: 'SIDE', residentMeters: distance, helperMeters: 4, thermalHealthLoss: 0 };
    s.status = 'RESOLVED'; endEffects(s); notes.push('在真实停炉后，托马斯沿已查明的十八米普通侧道来到院内，娜迪娅沿控制通道退出。没有花费行动或新现款；原伤、损坏和已用材料全部保留。');
  } else if (c.type === 'STOP_EFFECTS') { endEffects(s); notes.push('本人停止两种临时光效；原炉的热源与残留没有因此自动消失，居民也没有被移动。'); }
  else if (c.type === 'WITHDRAW') { cutoff(); s.status = 'WITHDRAWN'; s.position = 0; notes.push(`本人先从安全侧停炉泄压、封闭原槽，再沿普通侧道离场。托马斯仍在实际${s.resident.position}米处，由原操作员照看；未移动者不会被报告为已经获救。`); }
  else if (c.type === 'REPAIR_BOILER') {
    s.supplies.valve.stock = 0; s.supplies.valve.purchased = true; s.supplies.valve.installed = true; s.repairedEventId = h.eventId;
    s.heat.condition = s.origin.heat.condition; s.heat.version++; notes.push('本人实付12便士与一次行动购入唯一备用泄压阀，修复同一台原炉至事发前状况。先前服务磨损、全部烧掉的燃料、残留去向与人员伤势不恢复。');
  } else {
    s.reported = true; notes.push(`如实交接：${s.resident.name}${s.resident.position === 0 ? '已在院内' : `仍在原${s.resident.position}米烘衣区`}，健康${s.resident.health}；莉娜仍在院内且原脚踝伤存在。原炉状况${s.heat.condition}，两份原燃料均耗尽；四份残留中和${s.heat.cassette.neutralized}、封闭${s.heat.cassette.contained}、外露${s.heat.cassette.exposed}。尝试而未实际应用的技巧不增加掌握。`);
  }
  if (s.shutter.clearUntilSecond !== null && afterSecond > s.shutter.clearUntilSecond) s.radiance.expiresSecond = null;
  for (const w of [s.radiance, s.ward]) if (w.expiresSecond !== null && afterSecond > w.expiresSecond) w.expiresSecond = null;
  if (s.resident.consent !== 'ACCEPT' || s.helper.consent !== 'ACCEPT') endEffects(s);
  if (s.arrival && s.heat.cutoffClosed && s.heat.pressure === 0 && s.status === 'ACTIVE') { s.status = 'RESOLVED'; endEffects(s); }
  if (h.health <= e.health || h.mind <= e.mind) { s.status = 'WITHDRAWN'; endEffects(s); notes.push('本人实际生命或精神耗尽，现场原件和未转移居民留在原处，不能从死亡继续。'); }
  s.lastSecond = afterSecond;
  s.journal.push({ eventId: h.eventId, revision: h.revision, command: clone(c), host: clone(h), beforeSecond: h.nowSecond, afterSecond, residentFrom, residentTo: s.resident.position, effect: clone(e), check: clone(h.check), masteryGains: { ...masteryGains }, notes: [...notes] });
  return { state: s, effect: e, notes, injuries, masteryGains };
}
/** Structural reducer replay; the owning chapter additionally authenticates origin against its actual two services. */
export function validateSunEpilogueState(v: unknown): v is SunEpilogueState {
  try { const s = v as SunEpilogueState; if (!s || typeof s !== 'object' || !Array.isArray(s.journal)) return false;
    let replay = fromOrigin(s.origin, s.actorId, s.startedWeek, s.startedSecond);
    for (const j of s.journal) replay = applySunEpilogue(replay, j.command, j.host).state;
    return stableStringify(replay) === stableStringify(s);
  } catch { return false; }
}
export function projectSunEpilogue(s: SunEpilogueState) {
  return { story: s.journal.at(-1)?.notes.join(' ') ?? '同一洗衣房的原泄压阀在最后一份店主燃料投入后破裂。托马斯在八米烘衣区，娜迪娅在安全切断柄旁；莉娜仍在院内。可有限施术，也可普通停炉并沿侧道撤人。',
    nextStep: s.reported ? '本次实际结果已交接；普通生活仍可继续，原炉若未修好可日后实付修理。' : s.status !== 'ACTIVE' ? '如实交接原居民位置、伤势、燃料及残留去向。' : !s.observed ? '先观察原炉、原居民和安全切断柄。' : !s.heat.cutoffClosed ? '有限技巧可尝试一次；任何时候都可从安全侧普通停炉，再沿侧道撤人。' : '沿普通侧道撤人；不需要新现款或行动。',
    lines: [
      `原炉${s.heat.id}：状况${s.heat.condition}，余压${s.heat.pressure}；${s.heat.cutoffClosed ? '已经真实切断供料' : '尚未操作安全切断柄'}。原两份店主燃料已烧掉${s.heat.fuel.filter(f => f.holder === 'BURNED').length}份。`,
      `同一旧筛筒共4份残留：已中和${s.heat.cassette.neutralized}、封闭原槽${s.heat.cassette.contained}、仍外露${s.heat.cassette.exposed}；不会重新填满旧样本。`,
      `${s.resident.name}（${s.resident.age}岁）：${s.resident.position === 0 ? '院内' : '八米烘衣区'}，健康${s.resident.health}；${s.resident.injuries.join('；') || '无新增伤势'}。莉娜仍在院内，${s.shelteredResident.injuries.join('；')}。`,
      `定向辉光${s.radiance.applied ? '实际中和原残留，掌握增8' : s.radiance.attempted ? '本次已尝试，尚无实际中和' : '尚未尝试'}；有限辉光护持${s.ward.applied ? '真正抵挡一次热冲击，掌握增8' : s.ward.attempted ? '本次已尝试，未证明挡住实际热冲击' : '尚未尝试'}。`,
      '定向辉光8便士/14灵性/8精神，护持6便士/12灵性/6精神，各1行动且仅一次；成功后30秒内须实际应用。失败本人损失8健康并留下轻伤，严重失败20健康并重伤，可以死亡；所有费用照付。遮板、蒸汽、变更条件和到期可以阻断效果。',
      '安全侧停炉120秒、普通侧道撤人180秒，不需行动和现款；本人独退不代替搬走居民。原泄压阀可另付12便士和1行动普通修复，不能补回燃料或清除伤势。',
    ] };
}
export function getSunEpilogueActions(s: SunEpilogueState, h: SunHost) {
  const labels: Record<SunEpilogueCommand['type'], string> = { OBSERVE: '查看原炉、居民与普通退路', OPEN_SIGHT_SLOT: '从安全侧拉开原观察口', CLOSE_SHUTTER: '关闭原遮板阻断光路', WAIT_STEAM: '原地等45秒观察蒸汽变化', DIRECTED_RADIANCE: '尝试一次定向太阳辉光', APPLY_PURIFICATION: '在有效窗口中实际净化原槽残留', RADIANCE_WARD: '尝试一次有限辉光护持', GUIDE_SHORT_ROUTE: '引导托马斯实走八米短路', STOP_EFFECTS: '立即停止临时光效', CUTOFF_AND_SEAL: '普通切断供料、泄压并封闭原槽', ORDINARY_EXIT: '沿普通侧道实际撤人', WITHDRAW: '本人停炉后独自沿侧道退出', REPORT: '如实交接实际人员与损耗', REPAIR_BOILER: '实付普通修复同一原泄压阀' };
  const actions = TYPES.map(type => { const command: SunEpilogueCommand = { type }, e = sunEpilogueCost(s, command, h), reason = sunEpilogueBlock(s, command, h); return { command, label: labels[type], cost: `${e.actions}行动、${e.cashCost}便士、${e.spirituality}灵性、${e.mind}精神，实际${e.seconds}秒${type === 'GUIDE_SHORT_ROUTE' ? '；热源未停且无有效护持时，居民承受8健康烫伤' : skill(command) ? '；仅一次，失败本人8健康/轻伤，严重失败20健康/重伤，可死亡' : ''}`, enabled: !reason, reason, preferredAction: false }; });
  const desired: SunEpilogueCommand['type'] = s.status !== 'ACTIVE' ? 'REPORT' : !s.observed ? 'OBSERVE' : !s.shutter.openedOnce && !s.heat.cutoffClosed ? 'OPEN_SIGHT_SLOT' : live(s.radiance, s, h.nowSecond, 5) && visible(s, h.nowSecond, 5) && s.heat.cassette.exposed > 0 ? 'APPLY_PURIFICATION' : !s.radiance.attempted && visible(s, h.nowSecond, 8) ? 'DIRECTED_RADIANCE' : !s.ward.attempted && !s.arrival ? 'RADIANCE_WARD' : live(s.ward, s, h.nowSecond, 20) && !s.arrival ? 'GUIDE_SHORT_ROUTE' : !s.heat.cutoffClosed ? 'CUTOFF_AND_SEAL' : 'ORDINARY_EXIT';
  const next = actions.find(a => a.command.type === desired && a.enabled) ?? actions.find(a => a.command.type === 'CUTOFF_AND_SEAL' && a.enabled) ?? actions.find(a => a.command.type === 'ORDINARY_EXIT' && a.enabled) ?? actions.find(a => a.command.type === 'WITHDRAW' && a.enabled);
  if (next) next.preferredAction = true;
  return actions;
}
