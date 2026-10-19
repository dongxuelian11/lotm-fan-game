import type { PublicCheckResult } from '../../shared/contracts.js';

/** Standalone ordinary evacuation. No runtime imports, promotion, materials,
 * religion changes or random checks. The enclosing authority commits effects
 * and this state atomically and reconstructs private host facts during replay. */
export const DARKNESS_EVACUATION_LOCATION = '黑夜街区登记处';
export const DARKNESS_EVACUATION_POINTS = [0, 10, 25, 40, 55, 70, 90, 110] as const;
export type DarknessEvacuationPoint = typeof DARKNESS_EVACUATION_POINTS[number];
export const DARKNESS_RESIDENT_IDS = ['DN-LENA', 'DN-JONAH', 'DN-ADA', 'DN-NOAH'] as const;
export type DarknessResidentId = typeof DARKNESS_RESIDENT_IDS[number];
export type DarknessLampId = 'DN-LAMP-1' | 'DN-LAMP-2';
export type DarknessEvacuationCommand =
  | { type: 'SURVEY_DAY' | 'BUY_SUPPLIES' | 'WAIT_NIGHT' | 'BEGIN_NIGHT' | 'SHIELD_FALSE_LIGHT' | 'RELAY_INSTRUCTIONS' | 'RELEASE' | 'REPORT' | 'ORDINARY_RETURN' }
  | { type: 'WALK'; to: DarknessEvacuationPoint; pace: 'CAREFUL' | 'DIRECT' }
  | { type: 'REGISTER_RESIDENT' | 'REVIEW_PERMISSION' | 'ESCORT'; residentId: DarknessResidentId }
  | { type: 'OBSERVE'; hazard: 'FALSE_LIGHT' | 'NOISE' }
  | { type: 'LIGHT' | 'EXTINGUISH'; lampId: DarknessLampId };
export interface DarknessEvacuationHost {
  eventId: string; revision: number; week: number; actorId: string; location: string;
  nowSecond: number; weekAnchor: number; sequence: 1 | 0; status: 'ACTIVE' | 'DEAD';
  cash: number; actions: number; health: number; mind: number; spirituality: number;
  check: PublicCheckResult | null;
}
export interface DarknessEvacuationEffect {
  cashCost: number; cashGain: number; actions: number; spirituality: number;
  mind: number; health: number; seconds: number; toLocation: string | null;
}
export interface DarknessEvacuationInjury { id: string; eventId: string; second: number; cause: 'FALSE_LIGHT' | 'NOISE'; description: string }
export interface DarknessEvacuationResident {
  id: DarknessResidentId; name: string; age: number; home: DarknessEvacuationPoint; position: DarknessEvacuationPoint;
  /** This person's authored willingness is private chapter state, not player input. */
  willingness: 'ACCEPT' | 'DECLINE' | 'PAUSE_FOR_FALSE_LIGHT' | 'PAUSE_FOR_NOISE'; dialogue: string;
  consent: 'UNASKED' | 'ACCEPT' | 'DECLINE'; registeredEventId: string | null;
  permissionEventId: string | null; permissionHistory: { eventId: string; answer: 'ACCEPT' | 'DECLINE'; position: DarknessEvacuationPoint; second: number }[];
  injuries: DarknessEvacuationInjury[];
  arrival: { eventId: string; second: number; nightId: number | null } | null;
}
export interface DarknessEvacuationReceipt {
  id: string; revision: number; command: DarknessEvacuationCommand; beforeSecond: number; afterSecond: number;
  from: DarknessEvacuationPoint; to: DarknessEvacuationPoint; walkedMeters: number;
  residents: { id: DarknessResidentId; position: DarknessEvacuationPoint; arrivalEventId: string | null }[];
  oilUsedSeconds: number; effect: DarknessEvacuationEffect; notes: string[];
}
export interface DarknessEvacuationState {
  version: 1; runId: string; actorId: string; startWeek: number; lastSecond: number;
  position: DarknessEvacuationPoint; escortId: DarknessResidentId | null;
  residents: DarknessEvacuationResident[]; playerInjuries: DarknessEvacuationInjury[];
  survey: { startedEventId: string | null; walkedEdges: number[] };
  supplies: { purchaseEventId: string | null; stock: 0 | 1;
    lamps: { id: DarknessLampId; condition: number; oilSeconds: number; lit: boolean }[];
    rope: { id: 'DN-ROPE-1'; condition: number; usedMeters: number } | null; totalOilUsedSeconds: number };
  nights: { id: number; openedEventId: string; startSecond: number; endSecond: number }[];
  falseLight: { appearedEventId: string | null; observedEventId: string | null; shieldedEventId: string | null; injuryEventId: string | null };
  noise: { appearedEventId: string | null; observedEventId: string | null; markedEventId: string | null; relayedResidentIds: DarknessResidentId[]; injuryEventId: string | null };
  returnedAfterArrivalsEventId: string | null; reportEventId: string | null; journal: DarknessEvacuationReceipt[];
}
const simpleTypes = ['SURVEY_DAY', 'BUY_SUPPLIES', 'WAIT_NIGHT', 'BEGIN_NIGHT', 'SHIELD_FALSE_LIGHT', 'RELAY_INSTRUCTIONS', 'RELEASE', 'REPORT', 'ORDINARY_RETURN'] as const;
const atDay = (second: number) => second % 86400 >= 21600 && second % 86400 < 72000;
const nightId = (second: number) => Math.floor((second - 72000) / 86400);
const currentNight = (s: DarknessEvacuationState, h: DarknessEvacuationHost) => s.nights.find(n => h.nowSecond >= n.startSecond && h.nowSecond < n.endSecond);
const resident = (s: DarknessEvacuationState, id: DarknessResidentId) => s.residents.find(p => p.id === id)!;
const replyFor = (s: DarknessEvacuationState, p: DarknessEvacuationResident): 'ACCEPT' | 'DECLINE' => p.willingness === 'ACCEPT' || (p.willingness === 'PAUSE_FOR_FALSE_LIGHT' && s.falseLight.shieldedEventId !== null) || (p.willingness === 'PAUSE_FOR_NOISE' && s.noise.markedEventId !== null) ? 'ACCEPT' : 'DECLINE';
const allArrived = (s: DarknessEvacuationState) => s.residents.every(p => p.arrival && p.position === 110);
const daySurveyComplete = (s: DarknessEvacuationState) => s.survey.startedEventId !== null && s.survey.walkedEdges.length === DARKNESS_EVACUATION_POINTS.length - 1 && s.residents.every(p => p.registeredEventId !== null);
const usedNightLamp = (s: DarknessEvacuationState) => s.journal.some(r => r.command.type === 'LIGHT' && r.oilUsedSeconds > 0 && s.nights.some(n => r.beforeSecond >= n.startSecond && r.afterSecond < n.endSecond));
const fullyHandled = (s: DarknessEvacuationState) => s.falseLight.shieldedEventId !== null && s.noise.markedEventId !== null;
const oilAt = (s: DarknessEvacuationState, lamp: DarknessEvacuationState['supplies']['lamps'][number], second: number) => Math.max(0, lamp.oilSeconds - (lamp.lit ? second - s.lastSecond : 0));
const enoughLight = (s: DarknessEvacuationState, h: DarknessEvacuationHost, seconds: number) => s.supplies.lamps.some(l => l.lit && l.condition > 0 && oilAt(s, l, h.nowSecond) >= seconds);
const emptyEffect = (): DarknessEvacuationEffect => ({ cashCost: 0, cashGain: 0, actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 0, toLocation: null });

export function validateDarknessEvacuationCommand(value: unknown): value is DarknessEvacuationCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>, keys = Object.keys(c).sort().join('|');
  if (simpleTypes.some(t => t === c.type)) return keys === 'type';
  if (c.type === 'WALK') return keys === 'pace|to|type' && DARKNESS_EVACUATION_POINTS.some(p => p === c.to) && (c.pace === 'CAREFUL' || c.pace === 'DIRECT');
  if (c.type === 'REGISTER_RESIDENT' || c.type === 'REVIEW_PERMISSION' || c.type === 'ESCORT') return keys === 'residentId|type' && DARKNESS_RESIDENT_IDS.some(id => id === c.residentId);
  if (c.type === 'OBSERVE') return keys === 'hazard|type' && (c.hazard === 'FALSE_LIGHT' || c.hazard === 'NOISE');
  return (c.type === 'LIGHT' || c.type === 'EXTINGUISH') && keys === 'lampId|type' && (c.lampId === 'DN-LAMP-1' || c.lampId === 'DN-LAMP-2');
}

export function createDarknessEvacuation(runId: string, actorId: string, startWeek: number, nowSecond: number): DarknessEvacuationState {
  const people = [
    { id: 'DN-LENA', name: '莱娜', age: 32, home: 0, dialogue: '我愿意同行，每到下一段先说明方向。' },
    { id: 'DN-JONAH', name: '乔纳', age: 41, home: 10, dialogue: '我愿意慢慢走，听不清时先停下来。' },
    { id: 'DN-ADA', name: '艾达', age: 36, home: 25, dialogue: '我愿意接受搀扶，但不要拉着我走。' },
    { id: 'DN-NOAH', name: '诺亚', age: 58, home: 40, dialogue: '我愿意走侧路，到了转弯处请再告诉我。' },
  ] as const;
  return { version: 1, runId, actorId, startWeek, lastSecond: nowSecond, position: 0, escortId: null,
    residents: people.map(p => ({ ...p, position: p.home, willingness: 'ACCEPT', consent: 'UNASKED', registeredEventId: null, permissionEventId: null, permissionHistory: [], injuries: [], arrival: null })),
    playerInjuries: [], survey: { startedEventId: null, walkedEdges: [] },
    supplies: { purchaseEventId: null, stock: 1, lamps: [], rope: null, totalOilUsedSeconds: 0 }, nights: [],
    falseLight: { appearedEventId: null, observedEventId: null, shieldedEventId: null, injuryEventId: null },
    noise: { appearedEventId: null, observedEventId: null, markedEventId: null, relayedResidentIds: [], injuryEventId: null },
    returnedAfterArrivalsEventId: null, reportEventId: null, journal: [] };
}

export function darknessEvacuationCost(s: DarknessEvacuationState, c: DarknessEvacuationCommand, h: DarknessEvacuationHost): DarknessEvacuationEffect {
  const e = emptyEffect();
  if (c.type === 'SURVEY_DAY') { e.actions = 1; e.seconds = 120; }
  if (c.type === 'REGISTER_RESIDENT' || c.type === 'REVIEW_PERMISSION') e.seconds = 60;
  if (c.type === 'BUY_SUPPLIES') { e.cashCost = 108; e.seconds = 120; }
  if (c.type === 'WAIT_NIGHT') e.seconds = (Math.floor(h.nowSecond / 86400) + (atDay(h.nowSecond) || h.nowSecond % 86400 < 21600 ? 0 : 1)) * 86400 + 72000 - h.nowSecond;
  if (c.type === 'BEGIN_NIGHT') { e.actions = 1; e.seconds = 60; }
  if (c.type === 'OBSERVE' || c.type === 'SHIELD_FALSE_LIGHT' || c.type === 'RELAY_INSTRUCTIONS') e.seconds = 30;
  if (c.type === 'ESCORT' || c.type === 'RELEASE') e.seconds = 10;
  if (c.type === 'LIGHT' || c.type === 'EXTINGUISH') e.seconds = 5;
  if (c.type === 'WALK') e.seconds = Math.abs(c.to - s.position) * (c.pace === 'CAREFUL' ? 2 : 1) * (s.escortId ? 2 : 1);
  if (c.type === 'ORDINARY_RETURN') e.seconds = s.position * 2 * (s.escortId ? 2 : 1);
  if (c.type === 'REPORT') { e.actions = 1; e.seconds = 120; }
  return e;
}

export function darknessEvacuationBlock(s: DarknessEvacuationState, c: DarknessEvacuationCommand, h: DarknessEvacuationHost): string | null {
  if (!validateDarknessEvacuationCommand(c)) return '无效的撤离指令；位置、许可、伤势和费用不能由公开指令填写。';
  if (h.status !== 'ACTIVE' || h.actorId !== s.actorId || h.location !== DARKNESS_EVACUATION_LOCATION) return '须同一在世角色沿普通道路亲自来到这个新街区。';
  const last = s.journal.at(-1);
  if (!Number.isSafeInteger(h.nowSecond) || h.nowSecond < s.lastSecond || (last && h.revision <= last.revision) || s.journal.some(r => r.id === h.eventId)) return '时刻、版本或事件标识已经失效；由中央事务返回原回执，不能再次扣费。';
  const e = darknessEvacuationCost(s, c, h), night = currentNight(s, h);
  if (c.type === 'SURVEY_DAY' && (s.position !== 0 || s.survey.startedEventId || !atDay(h.nowSecond) || !atDay(h.nowSecond + e.seconds))) return '白昼在登记处开始一次实勘；必须随后亲走每一段，不能重复登记进度。';
  if (c.type === 'REGISTER_RESIDENT' || c.type === 'REVIEW_PERMISSION') {
    const p = resident(s, c.residentId), answer = replyFor(s, p);
    if (p.position !== s.position || p.arrival) return '只能当面询问当前同处且尚未到达的原居民。';
    if (c.type === 'REGISTER_RESIDENT' && (!s.survey.startedEventId || p.registeredEventId || !atDay(h.nowSecond) || !atDay(h.nowSecond + e.seconds))) return '先在白昼开始实勘，再到原居民实际位置登记一次。';
    if (c.type === 'REVIEW_PERMISSION' && p.consent === answer) return '本人意愿没有变化，不重复制造许可记录。';
  }
  if (c.type === 'BUY_SUPPLIES' && (s.position !== 0 || s.supplies.stock !== 1 || s.supplies.purchaseEventId)) return '只在登记处购买原有一组两灯、油和绳，不补出新库存。';
  if (c.type === 'WAIT_NIGHT' && (s.position !== 0 || s.escortId !== null || (!atDay(h.nowSecond) && !night))) return '在登记处独自等待下一次20时；当前入夜且尚未开始时可直接开始。';
  if (c.type === 'BEGIN_NIGHT') {
    if (s.position !== 0 || atDay(h.nowSecond) || !daySurveyComplete(s) || !s.supplies.purchaseEventId) return '须白昼亲走40米街、30米侧路和40米安全屋通路、登记四人并购买原工具，然后实际入夜。';
    if (s.nights.some(n => n.id === nightId(h.nowSecond)) || s.reportEventId) return '这一夜已开始，或本次真实撤离已经报告完成。';
    if (h.nowSecond + e.seconds >= (nightId(h.nowSecond) + 1) * 86400 + 21600) return '本夜已没有足够时间开始；普通撤离始终可用。';
  }
  if (c.type === 'OBSERVE') {
    const hazard = c.hazard === 'FALSE_LIGHT' ? s.falseLight : s.noise, point = c.hazard === 'FALSE_LIGHT' ? 25 : 55;
    if (!night || h.nowSecond + e.seconds >= night.endSecond || s.position !== point || !hazard.appearedEventId || hazard.observedEventId) return `须在本次真实夜间亲到${point}米处观察一次已经出现的异常。`;
  }
  if (c.type === 'SHIELD_FALSE_LIGHT' && (!night || h.nowSecond + e.seconds >= night.endSecond || s.position !== 25 || !s.falseLight.observedEventId || s.falseLight.shieldedEventId)) return '须在25米处看清同一错误灯号后，亲手遮住它。';
  if (c.type === 'RELAY_INSTRUCTIONS') {
    if (!night || h.nowSecond + e.seconds >= night.endSecond || s.position !== 55 || !s.noise.observedEventId || !s.supplies.rope || s.supplies.rope.condition <= 0) return '须在55米处看清噪声遮蔽，并用原绳标出普通侧路，近身传令。';
    if (s.noise.markedEventId && (!s.escortId || s.noise.relayedResidentIds.includes(s.escortId))) return '这里已标好原绳，当前同行者也已听清，不重复刷处理次数。';
  }
  if (c.type === 'LIGHT' || c.type === 'EXTINGUISH') {
    const l = s.supplies.lamps.find(l => l.id === c.lampId);
    if (!l) return '须先实际买到这盏原灯。';
    if (c.type === 'LIGHT' && (l.condition <= 0 || oilAt(s, l, h.nowSecond) <= 5 || (l.lit && oilAt(s, l, h.nowSecond) > 0))) return '原灯已亮、已损坏或油已实际耗尽，仍可沿触墙慢行的普通退路走。';
    if (c.type === 'EXTINGUISH' && (!l.lit || oilAt(s, l, h.nowSecond) <= 0)) return '这盏灯当前没有燃烧。';
  }
  if (c.type === 'ESCORT') {
    const p = resident(s, c.residentId);
    if (s.escortId || p.arrival || p.position !== s.position || p.consent !== 'ACCEPT') return '只能搀扶当前同处、已独立同意且尚未抵达的一位原居民。';
  }
  if (c.type === 'RELEASE' && !s.escortId) return '当前没有正在搀扶的人。';
  if (c.type === 'WALK') {
    if (Math.abs(DARKNESS_EVACUATION_POINTS.indexOf(c.to) - DARKNESS_EVACUATION_POINTS.indexOf(s.position)) !== 1) return '只能亲走相邻的一段实际道路，不能跳到安全屋。';
    if (s.escortId && resident(s, s.escortId).consent !== 'ACCEPT') return '同行者已撤回许可；请停下，不能继续带走。';
    if (c.pace === 'DIRECT' && (!atDay(h.nowSecond) || !atDay(h.nowSecond + e.seconds)) && !enoughLight(s, h, e.seconds)) return '夜间快走需要足够覆盖本段的实存灯油；零油仍可触墙慢行。';
  }
  if (c.type === 'ORDINARY_RETURN' && (s.position === 0 || (s.escortId && resident(s, s.escortId).consent !== 'ACCEPT'))) return '已经在普通出口，或同行者已撤回许可须先停下。';
  if (c.type === 'REPORT' && (s.reportEventId || s.position !== 0 || !s.returnedAfterArrivalsEventId || !allArrived(s) || !fullyHandled(s) || !usedNightLamp(s) || s.residents.some(p => p.arrival?.nightId === null))) return '须四位原居民逐人真实夜间抵达、实际点灯耗油、处理误灯与噪声，再亲走普通返程；报告不能补造到达。';
  return e.actions > 0 && h.actions < e.actions ? `需要${e.actions}次行动；普通慢行、搀扶、停下和返程仍为0行动。` : e.cashCost > 0 && h.cash < e.cashCost ? `需要${e.cashCost}便士；普通慢行与返程不收费用。` : null;
}

/** Burn actual lamp-seconds, including time spent in the enclosing chapter.
 * No command, report, cancellation or new night replenishes a lamp. */
function burnUntil(s: DarknessEvacuationState, second: number): number {
  let used = 0;
  for (const lamp of s.supplies.lamps) if (lamp.lit) {
    const burn = Math.min(lamp.oilSeconds, second - s.lastSecond);
    lamp.oilSeconds -= burn; used += burn; if (lamp.oilSeconds === 0) lamp.lit = false;
  }
  s.lastSecond = second; s.supplies.totalOilUsedSeconds += used; return used;
}

export function applyDarknessEvacuation(state: DarknessEvacuationState, c: DarknessEvacuationCommand, h: DarknessEvacuationHost): { state: DarknessEvacuationState; effect: DarknessEvacuationEffect; notes: string[] } {
  const reason = darknessEvacuationBlock(state, c, h); if (reason) throw Error(reason);
  const s = structuredClone(state), e = darknessEvacuationCost(s, c, h), notes: string[] = [], from = s.position;
  let oilUsed = burnUntil(s, h.nowSecond), walkedMeters = 0;
  const markArrival = () => {
    if (!s.escortId || s.position !== 110) return;
    const p = resident(s, s.escortId), arrivalSecond = h.nowSecond + e.seconds;
    const n = s.nights.find(n => arrivalSecond >= n.startSecond && arrivalSecond < n.endSecond);
    p.arrival = { eventId: h.eventId, second: arrivalSecond, nightId: n?.id ?? null };
    notes.push(`${p.name}亲自走完最后40米通路，抵达110米安全屋，保留全部既有伤势。`); s.escortId = null;
  };
  const move = (to: DarknessEvacuationPoint) => {
    walkedMeters += Math.abs(s.position - to); s.position = to;
    if (s.escortId) resident(s, s.escortId).position = to;
    markArrival();
    if (to === 0 && allArrived(s)) s.returnedAfterArrivalsEventId = h.eventId;
  };
  const harm = (cause: 'FALSE_LIGHT' | 'NOISE') => {
    const hazard = cause === 'FALSE_LIGHT' ? s.falseLight : s.noise;
    if (hazard.injuryEventId) return;
    hazard.injuryEventId = h.eventId;
    const injury: DarknessEvacuationInjury = { id: `${h.eventId}:${cause}`, eventId: h.eventId, second: h.nowSecond + e.seconds, cause, description: cause === 'FALSE_LIGHT' ? '误随灯号，在同一台阶擦伤' : '噪声遮住指令，在同一侧路碰伤' };
    if (s.escortId) {
      const p = resident(s, s.escortId); p.injuries.push(injury); p.consent = 'DECLINE';
      p.willingness = cause === 'FALSE_LIGHT' ? 'PAUSE_FOR_FALSE_LIGHT' : 'PAUSE_FOR_NOISE';
      p.dialogue = '我先停在这里，处理好这次实际危险后再来问我，不能继续拉走我。'; p.permissionEventId = h.eventId;
      p.permissionHistory.push({ eventId: h.eventId, answer: 'DECLINE', position: c.type === 'WALK' ? c.to : s.position, second: h.nowSecond + e.seconds });
    } else { s.playerInjuries.push(injury); e.health -= 3; }
    const lamp = s.supplies.lamps.find(l => l.lit); if (lamp) lamp.condition = Math.max(0, lamp.condition - 10);
    if (s.supplies.rope) s.supplies.rope.condition = Math.max(0, s.supplies.rope.condition - 5);
    notes.push(`${injury.description}；本次伤势及原灯、原绳磨损永久续记，不随退出抹除。`);
  };
  if (c.type === 'SURVEY_DAY') { s.survey.startedEventId = h.eventId; notes.push('实付一次行动开始白昼实勘；四人还在各自位置，道路尚须逐段亲走。'); }
  if (c.type === 'REGISTER_RESIDENT' || c.type === 'REVIEW_PERMISSION') {
    const p = resident(s, c.residentId), answer = replyFor(s, p);
    if (c.type === 'REGISTER_RESIDENT') p.registeredEventId = h.eventId;
    p.consent = answer; p.permissionEventId = h.eventId;
    if (answer === 'ACCEPT' && p.willingness !== 'ACCEPT') p.dialogue = '刚才的危险已处理，我现在愿意重新接受慢行搀扶；已有碰伤仍在。';
    p.permissionHistory.push({ eventId: h.eventId, answer, position: p.position, second: h.nowSecond + e.seconds });
    if (answer === 'DECLINE' && s.escortId === p.id) s.escortId = null;
    notes.push(`${p.name}（${p.age}岁）在${p.position}米处本人答复${answer === 'ACCEPT' ? '愿意接受普通搀扶' : '不愿继续同行'}；只登记这一个人的答复，没有改变信仰或任何位置。${answer === 'ACCEPT' ? p.dialogue : '本人选择留下，普通出口仍可由你自己返回。'}`);
  }
  if (c.type === 'BUY_SUPPLIES') {
    s.supplies.purchaseEventId = h.eventId; s.supplies.stock = 0;
    s.supplies.lamps = (['DN-LAMP-1', 'DN-LAMP-2'] as const).map(id => ({ id, condition: 100, oilSeconds: 3600, lit: false }));
    s.supplies.rope = { id: 'DN-ROPE-1', condition: 100, usedMeters: 0 };
    notes.push('原两灯各36便士、实存灯油12、原绳24，共108便士；油分装两灯各可燃3600秒，不借用任何旧章物件。');
  }
  if (c.type === 'WAIT_NIGHT') notes.push('只等待真实20时，灯若未熄仍实际耗油；工资、行动、健康和已到达居民均不刷新。');
  if (c.type === 'BEGIN_NIGHT') {
    const id = nightId(h.nowSecond);
    s.nights.push({ id, openedEventId: h.eventId, startSecond: id * 86400 + 72000, endSecond: (id + 1) * 86400 + 21600 });
    s.falseLight.appearedEventId ??= h.eventId; s.noise.appearedEventId ??= h.eventId;
    notes.push('实际入夜，25米处出现错误灯号，55米处作坊噪声遮住喊声；先前处理、伤势、灯油与所有人位置全部保留。');
  }
  if (c.type === 'OBSERVE') {
    (c.hazard === 'FALSE_LIGHT' ? s.falseLight : s.noise).observedEventId = h.eventId;
    notes.push(c.hazard === 'FALSE_LIGHT' ? '在25米处看清错误灯朝向断阶；可亲手遮光，也可触墙慢行绕过。' : '在55米处听清同一作坊噪声盖过远处口令；可用原绳标路并当面传令，也可近身慢行。');
  }
  if (c.type === 'SHIELD_FALSE_LIGHT') { s.falseLight.shieldedEventId = h.eventId; notes.push('亲手扣上同一错误灯的遮板，消除这一个错误灯号；没有改变任何人的意志。'); }
  if (c.type === 'RELAY_INSTRUCTIONS') {
    if (!s.noise.markedEventId) { s.noise.markedEventId = h.eventId; s.supplies.rope!.usedMeters = 2; s.supplies.rope!.condition -= 1; }
    if (s.escortId) s.noise.relayedResidentIds.push(s.escortId);
    notes.push(s.escortId ? `贴近${resident(s, s.escortId).name}传清侧路口令；作坊仍有噪声，只保证这位同行者实际听到。` : '在55米路口系好原绳的2米导引段，标明30米侧路方向；作坊噪声仍在，之后同行者须近身传令或慢行。');
  }
  if (c.type === 'LIGHT' || c.type === 'EXTINGUISH') { s.supplies.lamps.find(l => l.id === c.lampId)!.lit = c.type === 'LIGHT'; notes.push(`${c.lampId}${c.type === 'LIGHT' ? '实际点亮，开始按秒耗油' : '实际熄灭，余油如实保留'}。`); }
  if (c.type === 'ESCORT') { s.escortId = c.residentId; notes.push(`开始搀扶当前同处且自愿的${resident(s, c.residentId).name}；尚未移动一步。`); }
  if (c.type === 'RELEASE') { notes.push(`停止搀扶${resident(s, s.escortId!).name}；双方仍在${s.position}米，已有伤势不变。`); s.escortId = null; }
  if (c.type === 'WALK') {
    const edge = Math.min(DARKNESS_EVACUATION_POINTS.indexOf(from), DARKNESS_EVACUATION_POINTS.indexOf(c.to));
    if (s.survey.startedEventId && atDay(h.nowSecond) && atDay(h.nowSecond + e.seconds) && !s.survey.walkedEdges.includes(edge)) s.survey.walkedEdges.push(edge);
    if (c.pace === 'DIRECT' && !atDay(h.nowSecond) && s.falseLight.appearedEventId) {
      if (from === 25 && c.to === 40 && !s.falseLight.shieldedEventId) harm('FALSE_LIGHT');
      if (from === 55 && c.to === 70 && (!s.noise.markedEventId || (s.escortId !== null && !s.noise.relayedResidentIds.includes(s.escortId)))) harm('NOISE');
    }
    move(c.to);
    if (s.escortId && resident(s, s.escortId).consent === 'DECLINE') { notes.push(`${resident(s, s.escortId).name}因刚发生的碰伤撤回继续同行许可，在实际位置停下。`); s.escortId = null; }
    notes.push(`从${from}米亲走至${c.to}米，${walkedMeters}米耗时${e.seconds}秒；${c.pace === 'CAREFUL' ? '触墙近身慢行，不要求灯油或行动' : '按实际灯照和路况前行'}。`);
  }
  if (c.type === 'ORDINARY_RETURN') {
    move(0); s.escortId = null; s.supplies.lamps.forEach(l => { l.lit = false; });
    notes.push(`先熄原灯，再沿同一${walkedMeters}米实路触墙慢行返回登记处，耗时${e.seconds}秒；只有原本同处且自愿同行者随行，其他人保持实际位置，抵达者留在安全屋。`);
  }
  if (c.type === 'REPORT') { s.reportEventId = h.eventId; notes.push('实付一次行动逐项报告四个原人的夜间实际到达、伤势、原灯油绳损耗及本人普通返程；没有补造任何位置或抹除失败。'); }
  oilUsed += burnUntil(s, h.nowSecond + e.seconds);
  s.journal.push({ id: h.eventId, revision: h.revision, command: structuredClone(c), beforeSecond: h.nowSecond, afterSecond: h.nowSecond + e.seconds,
    from, to: s.position, walkedMeters, residents: s.residents.map(p => ({ id: p.id, position: p.position, arrivalEventId: p.arrival?.eventId ?? null })),
    oilUsedSeconds: oilUsed, effect: structuredClone(e), notes: [...notes] });
  return { state: s, effect: e, notes };
}

/** Gate travel at the physical exit. Refusing consent never prevents the player
 * from releasing assistance and returning alone; arrived residents stay put. */
export const canLeaveDarknessEvacuation = (s: DarknessEvacuationState): boolean => s.position === 0 && s.escortId === null;
export function darknessEvacuationVerifiedReceipts(s: DarknessEvacuationState): string[] {
  if (!s.reportEventId || !s.returnedAfterArrivalsEventId || !allArrived(s) || !daySurveyComplete(s) || !fullyHandled(s) || !usedNightLamp(s) || s.residents.some(p => p.arrival?.nightId === null)) return [];
  return [s.survey.startedEventId!, ...s.residents.map(p => p.registeredEventId!), s.supplies.purchaseEventId!,
    ...s.nights.map(n => n.openedEventId), s.falseLight.observedEventId!, s.falseLight.shieldedEventId!, s.noise.observedEventId!, s.noise.markedEventId!,
    ...s.residents.map(p => p.arrival!.eventId), s.returnedAfterArrivalsEventId, s.reportEventId];
}
export function projectDarknessEvacuation(s: DarknessEvacuationState, nowSecond: number) {
  return { id: 'darkness-evacuation', title: '四位成年人的长夜撤离', lines: [
    `本人：${s.position}米；街0–40米、侧路40–70米、安全屋通路70–110米。`,
    `已到达${s.residents.filter(p => p.arrival && p.position === 110).length}/4；当前搀扶${s.escortId ? resident(s, s.escortId).name : '无人'}。`,
    ...s.residents.map(p => `${p.name}（${p.age}岁）：${p.position}米，${p.consent === 'ACCEPT' ? '本人同意' : p.consent === 'DECLINE' ? '本人拒绝或撤回' : '尚未当面询问'}；${p.arrival ? '真实到达已记录' : '尚未到达'}；${p.injuries.map(i => i.description).join('、') || '无本章新增伤势'}。`),
    ...s.supplies.lamps.map(l => `${l.id}：状况${l.condition}，余油${oilAt(s, l, Math.max(s.lastSecond, nowSecond))}灯秒；${l.lit && oilAt(s, l, Math.max(s.lastSecond, nowSecond)) > 0 ? '正在燃烧' : '未亮'}。`),
    `原绳${s.supplies.rope ? `状况${s.supplies.rope.condition}，${s.supplies.rope.usedMeters ? '2米导引段仍系在55米路口，其余随身' : '全部随身未使用'}` : '尚未购买'}；实耗灯油${s.supplies.totalOilUsedSeconds}灯秒（外部流逝时间在下次事务结算）。`,
    `本人新增伤势：${s.playerInjuries.map(i => i.description).join('、') || '无'}；误灯${s.falseLight.shieldedEventId ? '已亲手遮住' : '未处理'}，噪声${s.noise.markedEventId ? '已标侧路，仍须给同行者传令' : '未处理'}。`,
    s.reportEventId ? '四人真实到达与本人返程已报告；不再刷新居民或奖励。' : '普通慢行、停下与返程不需钱或行动，报告不能代替实际抵达。',
  ] };
}
