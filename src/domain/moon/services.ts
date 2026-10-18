import { MOON_STATIONS, type MoonStationId } from './content.js';
import { emptyMoonEffect, type MoonEffect, type MoonHost, type MoonModuleResult } from './ports.js';
export type { MoonStationId } from './content.js';
export type MoonServiceCommand = { stationId: MoonStationId; type: 'INSPECT' | 'BUY_SUPPLIES' | 'FIT' | 'BOOK' | 'WAIT' | 'CONDUCT_SERVICE' | 'VERIFY' | 'BUY_SPARE' | 'REPAIR_DAMAGE' | 'ORDER_OIL' | 'RECEIVE_OIL' | 'SUSPEND' | 'SHORE_RETURN' };
export interface MoonPassenger { id: string; name: string; age: number; origin: string; destination: string; location: string; status: 'WAITING' | 'ABOARD' | 'ARRIVED' | 'EVACUATED'; consent: boolean; injuries: string[] }
export interface MoonServiceWindow { id: string; startSecond: number; endSecond: number; day: number; weather: 'CLEAR' | 'DANGEROUS'; closure: string | null }
export interface MoonServiceBooking { id: string; window: MoonServiceWindow; bookedEventId: string; status: 'BOOKED' | 'MISSED' | 'CLOSED' | 'INTERRUPTED' | 'ARRIVED' | 'CANCELLED'; permission: boolean; serviceId: string | null }
export interface MoonServiceOperation { id: string; bookingId: string; phase: 'PREFLIGHT' | 'IGNITION' | 'BOARD' | 'DEPARTURE' | 'INTERRUPTION' | 'SHORE_RETURN' | 'DISEMBARK' | 'VERIFY'; second: number; passengerIds: string[]; positions: { id: string; location: string }[]; oilUsed: number; detail: string }
export interface MoonStation {
  id: MoonStationId; location: string; status: 'UNINSPECTED' | 'INSPECTED' | 'FITTED' | 'BOOKED' | 'IN_SERVICE' | 'ARRIVED' | 'VERIFIED' | 'SUSPENDED';
  lamp: { id: string; condition: number; fittedGlassId: string | null; lit: boolean }; boat: { id: string; condition: number; mooringId: string; fittedRopeId: string | null };
  crew: { id: string; name: string; age: number; willing: boolean; location: string }; passengers: MoonPassenger[];
  inspected: boolean; fitted: boolean; damaged: boolean; incidentOccurred: boolean; suppliesBought: boolean;
  supplier: { crates: number; spares: number; oilDeliveryStock: number }; stock: { glass: string[]; rope: string[]; oil: string[]; spares: string[] };
  consumedOil: string[]; installedSpareIds: string[]; bookings: MoonServiceBooking[]; operations: MoonServiceOperation[];
  oilOrders: { id: string; orderedWeek: number; eventId: string; receivedEventId: string | null }[];
  verifiedEventId: string | null; arrivalEventId: string | null;
}
export interface MoonServiceReceipt { id: string; revision: number; command: MoonServiceCommand; beforeSecond: number; afterSecond: number; effect: MoonEffect; notes: string[] }
export interface MoonServicesState { version: 1; runId: string; startWeek: number; stations: MoonStation[]; journal: MoonServiceReceipt[] }
const definition = (id: MoonStationId) => MOON_STATIONS.find(s => s.id === id)!;
const types = ['INSPECT','BUY_SUPPLIES','FIT','BOOK','WAIT','CONDUCT_SERVICE','VERIFY','BUY_SPARE','REPAIR_DAMAGE','ORDER_OIL','RECEIVE_OIL','SUSPEND','SHORE_RETURN'] as const;
export function validateMoonServiceCommand(v: unknown): v is MoonServiceCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).sort().join('|') === 'stationId|type' && MOON_STATIONS.some(s => s.id === c.stationId) && types.includes(c.type as MoonServiceCommand['type']);
}
export function createMoonServices(runId: string, startWeek: number): MoonServicesState {
  return { version: 1, runId, startWeek, journal: [], stations: MOON_STATIONS.map(d => ({
    id: d.id, location: d.location, status: 'UNINSPECTED', lamp: { id: d.lampId, condition: 54, fittedGlassId: null, lit: false },
    boat: { id: d.boatId, condition: 78, mooringId: `${d.boatId}:original-mooring`, fittedRopeId: null },
    crew: { ...d.crew, willing: true, location: `${d.location}:origin` },
    passengers: d.passengers.map(p => ({ ...p, origin: `${d.location}:origin`, destination: `${d.location}:destination`, location: `${d.location}:origin`, status: 'WAITING', consent: true, injuries: [] })),
    inspected: false, fitted: false, damaged: false, incidentOccurred: false, suppliesBought: false,
    supplier: { crates: 1, spares: 2, oilDeliveryStock: 4 }, stock: { glass: [], rope: [], oil: [], spares: [] },
    consumedOil: [], installedSpareIds: [], bookings: [], operations: [], oilOrders: [], verifiedEventId: null, arrivalEventId: null,
  })) };
}
/** Posted weather is tied to the absolute chapter day. Reopening never rerolls
 * it. Day two of each posted week closes all night departures; the other six
 * nights are clear. Each window lasts 20:00–24:00. */
export function moonWindow(day: number, stationId: MoonStationId): MoonServiceWindow {
  const dangerous = day % 7 === 1;
  return { id: `MOON-NIGHT:${stationId}:${day}`, day, startSecond: day * 86400 + 72000, endSecond: (day + 1) * 86400,
    weather: dangerous ? 'DANGEROUS' : 'CLEAR', closure: dangerous ? '已发布大风停航，原船不得离岸；下一晚恢复晴夜窗口。' : null };
}
export function nextMoonWindow(nowSecond: number, stationId: MoonStationId, usable = false): MoonServiceWindow {
  let day = Math.floor(nowSecond / 86400), w = moonWindow(day, stationId);
  if (nowSecond + 3600 > w.endSecond) w = moonWindow(++day, stationId);
  if (usable && w.weather === 'DANGEROUS') w = moonWindow(day + 1, stationId);
  return w;
}
const booking = (s: MoonStation) => s.bookings.find(b => b.status === 'BOOKED');
const serviceTime = 3600;
function serviceEffect(s: MoonStation, c: MoonServiceCommand, h: MoonHost): MoonEffect {
  const e = emptyMoonEffect();
  if (c.type === 'INSPECT') { e.actions = 1; e.seconds = 1800; }
  if (c.type === 'BUY_SUPPLIES') e.cashCost = 24;
  if (c.type === 'FIT') { e.actions = 1; e.cashCost = 12; e.seconds = 1800; }
  if (c.type === 'BOOK') e.seconds = 60;
  if (c.type === 'WAIT') e.seconds = Math.max(0, booking(s)!.window.startSecond - h.nowSecond);
  if (c.type === 'CONDUCT_SERVICE') {
    const w = booking(s)!.window;
    const closed = h.nowSecond < w.startSecond || h.nowSecond + serviceTime > w.endSecond || w.weather === 'DANGEROUS';
    e.actions = closed ? 0 : 1; e.seconds = closed ? 60 : serviceTime;
  }
  if (c.type === 'VERIFY') e.seconds = 60;
  if (c.type === 'BUY_SPARE') e.cashCost = 6;
  if (c.type === 'REPAIR_DAMAGE') { e.cashCost = 6; e.actions = 1; e.seconds = 1800; }
  if (c.type === 'ORDER_OIL') e.cashCost = 12;
  if (c.type === 'SUSPEND' || c.type === 'SHORE_RETURN') e.seconds = 1800;
  return e;
}
export function moonServiceBlock(state: MoonServicesState, c: MoonServiceCommand, h: MoonHost): string | null {
  if (!validateMoonServiceCommand(c)) return '这项夜航行动无效。';
  const s = state.stations.find(s => s.id === c.stationId)!;
  if (h.status !== 'ACTIVE' || h.location !== s.location) return '须本人沿普通道路到达这处渡口。';
  if (c.type === 'SUSPEND' || c.type === 'SHORE_RETURN') return null;
  if (state.journal.length >= 512) return '本次夜航记录已满，仍可沿普通道路离开。';
  if (s.verifiedEventId) return '这站已经核验过真实到达，不再制造新的夜航功绩。';
  if (c.type === 'INSPECT' && s.inspected) return '已经查过同一灯、船、缆桩与岸路。';
  if (c.type !== 'INSPECT' && !s.inspected) return '先亲眼走查原设备与普通岸上退路。';
  if (c.type === 'BUY_SUPPLIES' && (s.suppliesBought || s.supplier.crates < 1)) return '本地这一箱普通配件已经交付。';
  if (c.type === 'FIT' && (s.fitted || s.stock.glass.length !== 1 || s.stock.rope.length !== 1)) return '先取得本地实际玻璃遮片和绳索配件，不能重复安装。';
  if (c.type === 'BOOK' && (!s.fitted || s.damaged || booking(s) || s.arrivalEventId)) return '须修好原设备，且没有尚未结束的预约或已完成航次。';
  if ((c.type === 'WAIT' || c.type === 'CONDUCT_SERVICE') && !booking(s)) return '先向同一船员预约一个实际夜间窗口。';
  if (c.type === 'WAIT' && h.nowSecond >= booking(s)!.window.startSecond) return '预约开始时刻已经到达，可核查是否仍能安全开航。';
  if (c.type === 'CONDUCT_SERVICE') {
    const b = booking(s)!, w = b.window;
    if (h.nowSecond < w.startSecond) return '现在尚未入夜，须等到预约的真实开始时刻。';
    if (h.nowSecond + serviceTime <= w.endSecond && w.weather === 'CLEAR') {
      if (!s.fitted || s.damaged || s.lamp.condition < 70 || s.boat.condition < 60) return '原灯或原船当前不宜开航，先实际修理。';
      if (!b.permission || !s.crew.willing || s.passengers.some(p => !p.consent || p.location !== p.origin)) return '原船员或乘客当前未许可，或乘客不在登船岸。';
      if (!s.stock.oil.length) return '点灯需要一份已经付费到货的真实灯油。';
    }
  }
  if (c.type === 'VERIFY' && (!s.arrivalEventId || !s.passengers.every(p => p.status === 'ARRIVED' && p.location === p.destination) || !s.operations.some(o => o.phase === 'DISEMBARK'))) return '须先有这两名原乘客的真实下船与目的地位置，不能靠签字生成到达。';
  if (c.type === 'BUY_SPARE' && (s.supplier.spares < 1 || !s.damaged || s.stock.spares.length)) return '须有实际损坏且本地尚有未购备用件。';
  if (c.type === 'REPAIR_DAMAGE' && (!s.damaged || !s.stock.spares.length)) return '需要同一损坏设备和一份实际购买的备用件。';
  if (c.type === 'ORDER_OIL' && (s.supplier.oilDeliveryStock < 1 || s.oilOrders.some(o => !o.receivedEventId))) return '本次有限补给已用尽或还有未到货的预约。';
  if (c.type === 'RECEIVE_OIL' && !s.oilOrders.some(o => !o.receivedEventId && h.week > o.orderedWeek)) return '须先付12便士订购，至少经过下一真实周才能领取这一份灯油。';
  const e = serviceEffect(s, c, h);
  return h.actions < e.actions ? `需要${e.actions}次实际行动；普通停航与岸路返程仍可使用。` : h.cash < e.cashCost ? `需要${e.cashCost}便士；普通停航与岸路返程仍可使用。` : null;
}
export function applyMoonService(state: MoonServicesState, c: MoonServiceCommand, h: MoonHost): MoonModuleResult<MoonServicesState> {
  const reason = moonServiceBlock(state, c, h); if (reason) throw Error(reason);
  const n = structuredClone(state), s = n.stations.find(s => s.id === c.stationId)!, d = definition(s.id), e = serviceEffect(s, c, h), notes: string[] = [];
  const record = (phase: MoonServiceOperation['phase'], offset: number, detail: string, oilUsed = 0) => {
    s.operations.push({ id: `${h.eventId}:${phase}`, bookingId: booking(s)?.id ?? s.bookings.at(-1)?.id ?? 'shore-safety', phase, second: h.nowSecond + offset, passengerIds: s.passengers.map(p => p.id), positions: s.passengers.map(p => ({ id: p.id, location: p.location })), oilUsed, detail });
  };
  if (c.type === 'INSPECT') { s.inspected = true; s.status = 'INSPECTED'; notes.push('亲眼查过原灯遮板、渡船、缆桩和连接两岸的普通堤路；所有人仍在原岸，设备尚未修复。'); }
  if (c.type === 'BUY_SUPPLIES') { s.suppliesBought = true; s.supplier.crates--; s.stock.glass.push(`${s.lamp.id}:glass-1`); s.stock.rope.push(`${s.boat.id}:rope-1`); s.stock.oil.push(`${s.lamp.id}:oil-1`, `${s.lamp.id}:oil-2`); notes.push('实付24便士，从唯一现货箱取出一份玻璃遮片、一份绳索配件和两份灯芯灯油，供应余量相应减少。'); }
  if (c.type === 'FIT') { s.fitted = true; s.status = 'FITTED'; s.lamp.fittedGlassId = s.stock.glass.shift()!; s.boat.fittedRopeId = s.stock.rope.shift()!; s.lamp.condition = 90; notes.push('实付12便士与一次行动，把真实配件装到原灯和原船；没有换出另一艘船或新灯。'); }
  if (c.type === 'BOOK') { const previous = s.bookings.at(-1); const earliest = previous && ['CLOSED','MISSED','INTERRUPTED','CANCELLED'].includes(previous.status) ? Math.max(h.nowSecond + 60, previous.window.endSecond) : h.nowSecond + 60; const w = nextMoonWindow(earliest, s.id); s.crew.willing = true; s.passengers.forEach(p => { p.consent = true; }); s.bookings.push({ id: `${s.id}:booking-${s.bookings.length + 1}`, window: w, bookedEventId: h.eventId, status: 'BOOKED', permission: true, serviceId: null }); s.status = 'BOOKED'; notes.push(`向同一成年船员与两名乘客当面重新征得本航次许可，预约第${w.day + 1}天20时至24时的夜航。${w.closure ?? '这一晚已发布晴夜通航。'}`); }
  if (c.type === 'WAIT') notes.push('只等待至这次预约的实际开始时刻，身体、现款和工资不因等候得到补充。跨过实际周界时仍照常结生活与原债。');
  if (c.type === 'CONDUCT_SERVICE') {
    const b = booking(s)!, w = b.window;
    if (h.nowSecond + serviceTime > w.endSecond || w.weather === 'DANGEROUS') {
      b.status = w.weather === 'DANGEROUS' ? 'CLOSED' : 'MISSED'; s.status = 'SUSPENDED'; b.permission = false;
      notes.push(w.weather === 'DANGEROUS' ? '实地核查已发布的大风停航：未点灯、未登船、未离岸；先前费用保留，可以预约另一真实晴夜。' : '已错过足够完成航程的夜间时段：原乘客仍在岸上，未消耗灯油，原预约保留为错过。');
    } else {
      b.serviceId = `${s.id}:service-${s.bookings.length}`; s.status = 'IN_SERVICE'; record('PREFLIGHT', 0, '核对真实黑夜、晴夜、原船、船员和乘客许可、灯油与剩余时段。');
      s.consumedOil.push(s.stock.oil.shift()!); s.lamp.lit = true; record('IGNITION', 60, '实际点燃一份已购灯油。', 1);
      s.passengers.forEach(p => { p.status = 'ABOARD'; p.location = s.boat.id; }); record('BOARD', 180, '同一两名自愿成年人实际登船。');
      if (!s.incidentOccurred && d.incident !== 'NONE') {
        s.incidentOccurred = true;
        if (d.incident === 'DAMAGE') { s.damaged = true; s.lamp.condition -= 35; notes.push('原灯的旧铰链在离岸前断裂，已点的灯油耗去，原灯受损；本次不能取得完成服务的资格。'); }
        else { s.crew.willing = false; b.permission = false; notes.push('船员发现本人旧手腕不适，撤回本次继续开航许可；立即停止离岸，已点灯油和既有费用仍保留。'); }
        record('INTERRUPTION', 240, '真实设备故障或许可撤回，停止继续离岸。');
        s.passengers.forEach(p => { p.status = 'WAITING'; p.location = p.origin; }); s.crew.location = `${s.location}:origin`; record('SHORE_RETURN', 2040, '同一乘客经原踏板与已查堤路回原岸；返回原点不是到达目的地。');
        b.status = 'INTERRUPTED'; s.status = 'SUSPENDED';
      } else {
        record('DEPARTURE', 300, '同一船员实际划动同一渡船。');
        s.passengers.forEach(p => { p.status = 'ARRIVED'; p.location = p.destination; }); s.crew.location = `${s.location}:destination`;
        record('DISEMBARK', 2400, '同一两名乘客实际下船抵达各自目的地，玩家再沿已查堤路返回渡口事务点。');
        b.status = 'ARRIVED'; s.status = 'ARRIVED'; s.arrivalEventId = h.eventId; s.lamp.condition -= 3; s.boat.condition -= 2;
        notes.push(`${s.passengers.map(p => p.name).join('与')}已由原船员划船送达彼岸并实际下船；灯和船留下本次磨损。你沿原堤路返回渡口，耗时一小时。`);
      }
      s.lamp.lit = false;
    }
  }
  if (c.type === 'VERIFY') { s.status = 'VERIFIED'; s.verifiedEventId = h.eventId; record('VERIFY', 60, '读取已发生航次的下船与当前位置，未移动任何人。'); notes.push('核对这两名原乘客的真实下船、目的地位置和航次时刻；本次核验没有补造乘客或改变位置。'); }
  if (c.type === 'BUY_SPARE') { s.supplier.spares--; s.stock.spares.push(`${s.lamp.id}:spare-${2 - s.supplier.spares}`); notes.push('实付6便士购买一份有限备用铰链。'); }
  if (c.type === 'REPAIR_DAMAGE') { s.installedSpareIds.push(s.stock.spares.shift()!); s.damaged = false; s.lamp.condition = 90; s.status = 'FITTED'; notes.push('用已购备用件实付6便士与一次行动修复同一盏灯；失败预约、损耗灯油与原人位置全部保留。'); }
  if (c.type === 'ORDER_OIL') { s.supplier.oilDeliveryStock--; s.oilOrders.push({ id: `${s.lamp.id}:delivery-oil-${4 - s.supplier.oilDeliveryStock}`, orderedWeek: h.week, eventId: h.eventId, receivedEventId: null }); notes.push('实付12便士预订一份有限普通灯油；至少下一个真实周才到货。'); }
  if (c.type === 'RECEIVE_OIL') { const order = s.oilOrders.find(o => !o.receivedEventId && h.week > o.orderedWeek)!; order.receivedEventId = h.eventId; s.stock.oil.push(order.id); notes.push('实际接收先前付费订购的这一份灯油，记录到货，没有补回已烧掉的油。'); }
  if (c.type === 'SUSPEND' || c.type === 'SHORE_RETURN') {
    const b = booking(s); if (b) { b.status = 'CANCELLED'; b.permission = false; }
    s.lamp.lit = false;
    s.passengers.filter(p => p.status !== 'ARRIVED').forEach(p => { p.location = p.origin; p.status = 'WAITING'; });
    if (!s.arrivalEventId) s.status = 'SUSPENDED';
    record('SHORE_RETURN', e.seconds, '停止本航次，沿既有岸路返程；已抵达者留在真实目的地。');
    notes.push('停止继续开航，沿已查明的普通岸路安全返回。无行动和车费要求，实际花去半小时；费用、损坏和未完成的目的地到达全部保留。');
  }
  n.journal.push({ id: h.eventId, revision: h.revision, command: structuredClone(c), beforeSecond: h.nowSecond, afterSecond: h.nowSecond + e.seconds, effect: structuredClone(e), notes: [...notes] });
  return { state: n, effect: e, notes };
}
export function moonVerifiedReceipts(s: MoonServicesState): string[] {
  return s.stations.every(st => st.verifiedEventId && st.arrivalEventId && st.passengers.every(p => p.status === 'ARRIVED' && p.location === p.destination)) ? s.stations.flatMap(st => [st.arrivalEventId!, st.verifiedEventId!]) : [];
}
export function getMoonServiceActions(s: MoonServicesState, h: MoonHost) {
  const labels: Record<MoonServiceCommand['type'], string> = { INSPECT: '走查原灯、原船与普通退路', BUY_SUPPLIES: '购买实际灯具绳索和两份灯油', FIT: '付费修整原灯与原缆', BOOK: '向原船员与乘客预约下一夜航', WAIT: '等到预约夜间开始', CONDUCT_SERVICE: '实地核查并执行本次夜航', VERIFY: '核对两名原乘客的真实到达', BUY_SPARE: '购买一份备用铰链', REPAIR_DAMAGE: '修复同一受损灯具', ORDER_OIL: '付费订购一份隔周灯油', RECEIVE_OIL: '领取已到货的同一份灯油', SUSPEND: '立即停航并沿岸路返回', SHORE_RETURN: '沿普通岸路安全返程' };
  return s.stations.filter(st => st.location === h.location).flatMap(st => types.map(type => {
    const command: MoonServiceCommand = { type, stationId: st.id }, reason = moonServiceBlock(s, command, h);
    const cost = ((type === 'WAIT' || type === 'CONDUCT_SERVICE') && !booking(st)) ? emptyMoonEffect() : serviceEffect(st, command, h);
    return { command, label: `${definition(st.id).title}：${labels[type]}`, cost: `${cost.actions}行动、${cost.cashCost}便士；实际${Math.ceil(cost.seconds / 60)}分钟`, enabled: !reason, reason };
  }));
}
export function projectMoonServices(s: MoonServicesState, nowSecond: number) {
  const status: Record<MoonStation['status'], string> = { UNINSPECTED: '未走查', INSPECTED: '已走查', FITTED: '已修整', BOOKED: '已预约', IN_SERVICE: '航行中', ARRIVED: '实际到达待核验', VERIFIED: '已核验真实到达', SUSPENDED: '已停航' };
  return s.stations.map(st => {
    const next = nextMoonWindow(nowSecond, st.id), clear = nextMoonWindow(nowSecond, st.id, true), b = booking(st);
    return { id: `station-${st.id}`, title: definition(st.id).title, lines: [
      `进度：${status[st.status]}；原灯状况${st.lamp.condition}，原船状况${st.boat.condition}；${st.damaged ? '实际损坏待修' : '无未修损坏'}。`,
      `船员${st.crew.name}（${st.crew.age}岁）；${st.crew.willing ? '本次愿意参与' : '本次已撤回许可，须另约'}。已付费未用灯油${st.stock.oil.length}份，实际耗用${st.consumedOil.length}份。`,
      ...st.passengers.map(p => `${p.name}（${p.age}岁）：${p.location === p.origin ? '原登船岸' : p.location === p.destination ? '目的地彼岸' : p.location === `${st.location}:inner-shore-refuge` ? '后续事故的内岸避风点' : '同一渡船上'}，${st.arrivalEventId ? '原夜航已真实到达，之后位置如实续记' : '尚无目的地到达'}；${p.injuries.length ? p.injuries.join('、') : '无新增伤势'}。`),
      `下一公布窗口：第${next.day + 1}天20时至24时；${next.closure ?? '晴夜通航'}。下一可用晴夜为第${clear.day + 1}天。`,
      b ? `当前预约：第${b.window.day + 1}天20时至24时。` : '当前没有未结束的预约。',
      `已记录${st.bookings.length}次预约；未完成或取消的航次与原费用始终保留。停航与岸路返程不需行动或现款。`,
    ] };
  });
}
