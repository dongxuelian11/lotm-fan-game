import type { SunHost, SunEffect } from './ports.js';
import type { SunServiceReceipt } from './types.js';
import { stableStringify } from '../canonical.js';

/** Authored ordinary work. Neither job is a hidden ability or probability gate. */
export const SUN_SERVICES = [
  { id: 'washhouse-heat', location: 'SUN0-WASHHOUSE', title: '洗衣房热水修复', price: 18, residentId: 'SUN0-TOMAS', residentName: '托马斯·黑尔', age: 58, apparatusId: 'SUN0-BOILER-1' },
  { id: 'stair-evacuation', location: 'SUN0-STAIR', title: '邻楼后阶转移', price: 12, residentId: 'SUN0-LENA', residentName: '莉娜·奥尔', age: 57, apparatusId: 'SUN0-STRETCHER-1' },
] as const;
export type SunServiceId = typeof SUN_SERVICES[number]['id'];
const TYPES = ['SURVEY', 'BUY_SUPPLIES', 'STOP_SERVICE', 'COOL_AND_FIT', 'RUN_HEAT_SERVICE', 'CLEAR_STAIR', 'CARRY_RESIDENT', 'VERIFY_SERVICE', 'RETURN_ON_FOOT'] as const;
export type SunServiceCommand = { type: typeof TYPES[number]; serviceId: SunServiceId };
export interface SunSceneInjury { id: string; severity: 'LIGHT' | 'HEAVY'; acquiredRevision: number; treatedRevision: null }
export interface SunResident {
  id: string; name: string; age: number; position: number; health: number; injuries: string[];
  consent: 'UNASKED' | 'ACCEPT' | 'WITHDRAWN'; travelledMeters: number;
}
export interface SunHeatPlant {
  id: 'SUN0-BOILER-1'; condition: number; version: number; cutoffClosed: boolean; pressure: number;
  repairedJoint: boolean; oldGasketsWaste: number; installedGasketIds: string[];
  fuel: { id: string; holder: 'OWNER' | 'BURNED' }[];
  fuelPurchase: { id: string; payerId: 'SUN0-NADIA'; price: 12; paid: true };
  bundles: { id: string; ownerId: string; washed: boolean; location: 'COUNTER' | 'COURTYARD' }[];
  cassette: { id: 'SUN0-RETIRED-CASSETTE'; contained: number; exposed: number; neutralized: number; total: 4 };
}
export interface SunServiceSite {
  id: SunServiceId; location: string; playerPosition: number; resident: SunResident; helper: SunResident;
  apparatus: { id: string; condition: number; version: number };
  supplies: { ids: string[]; stock: number; boughtEventId: string | null; usedEventId: string | null };
  survey: { eventId: string; second: number } | null;
  work: { eventId: string; second: number } | null;
  completion: { eventId: string; week: number; second: number; residentPosition: number; apparatusVersion: number } | null;
  review: { eventId: string; week: number; second: number; apparatusVersion: number } | null;
  heat: SunHeatPlant | null;
  stair: { cartId: 'SUN0-ASH-CART'; cartPosition: number; cartCleared: boolean; leverId: 'SUN0-STAIR-LEVER'; slingInstalledId: string | null } | null;
}
export interface SunServicesState {
  version: 1; runId: string; actorId: string; startWeek: number; startSecond: number; lastSecond: number;
  sites: SunServiceSite[]; playerInjuries: SunSceneInjury[];
  journal: { id: string; revision: number; command: SunServiceCommand; host: SunHost; beforeSecond: number; afterSecond: number;
    walkedMeters: number; residentFrom: number; residentTo: number; consumedIds: string[]; effect: SunEffect; notes: string[] }[];
}
const clone = <T>(v: T): T => structuredClone(v);
const definition = (id: SunServiceId) => SUN_SERVICES.find(x => x.id === id)!;
export const sunServiceLocation = (id: SunServiceId): string => definition(id).location;
const blank = (): SunEffect => ({ cashCost: 0, cashGain: 0, actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 0, toLocation: null });
const person = (id: string, name: string, age: number, position: number, injuries: string[] = []): SunResident => ({ id, name, age, position, health: 100, injuries, consent: 'UNASKED', travelledMeters: 0 });
export function createSunServices(runId: string, actorId: string, startWeek: number, nowSecond: number): SunServicesState {
  if (!runId || !actorId || !Number.isSafeInteger(startWeek) || startWeek < 1 || !Number.isSafeInteger(nowSecond) || nowSecond < 0) throw Error('居民服务的原人和实际起点无效。');
  return { version: 1, runId, actorId, startWeek, startSecond: nowSecond, lastSecond: nowSecond, playerInjuries: [], journal: [], sites: SUN_SERVICES.map(d => ({
    id: d.id, location: d.location, playerPosition: 0,
    resident: person(d.residentId, d.residentName, d.age, d.id === 'stair-evacuation' ? 12 : 0, d.id === 'stair-evacuation' ? ['原有脚踝扭伤，仍需普通照料'] : []),
    helper: d.id === 'washhouse-heat' ? person('SUN0-NADIA', '娜迪娅·韦尔', 41, 0) : person('SUN0-ELLIS', '埃利斯·贝尔', 32, 0),
    apparatus: { id: d.apparatusId, condition: d.id === 'washhouse-heat' ? 70 : 90, version: 1 },
    supplies: { ids: d.id === 'washhouse-heat' ? ['SUN0-GASKET-1', 'SUN0-GASKET-2'] : ['SUN0-SLING-1'], stock: d.id === 'washhouse-heat' ? 2 : 1, boughtEventId: null, usedEventId: null },
    survey: null, work: null, completion: null, review: null,
    heat: d.id !== 'washhouse-heat' ? null : { id: 'SUN0-BOILER-1', condition: 70, version: 1, cutoffClosed: false, pressure: 4, repairedJoint: false, oldGasketsWaste: 0, installedGasketIds: [],
      fuel: [{ id: 'SUN0-OWNER-FUEL-1', holder: 'OWNER' }, { id: 'SUN0-OWNER-FUEL-2', holder: 'OWNER' }], fuelPurchase: { id: 'SUN0-OWNER-FUEL-PAID', payerId: 'SUN0-NADIA', price: 12, paid: true },
      bundles: [{ id: 'SUN0-CLOTH-1', ownerId: 'SUN0-TOMAS', washed: false, location: 'COUNTER' }, { id: 'SUN0-CLOTH-2', ownerId: 'SUN0-NADIA', washed: false, location: 'COUNTER' }],
      cassette: { id: 'SUN0-RETIRED-CASSETTE', contained: 4, exposed: 0, neutralized: 0, total: 4 } },
    stair: d.id !== 'stair-evacuation' ? null : { cartId: 'SUN0-ASH-CART', cartPosition: 6, cartCleared: false, leverId: 'SUN0-STAIR-LEVER', slingInstalledId: null },
  })) };
}
export function validateSunServiceCommand(v: unknown): v is SunServiceCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join('|') !== 'serviceId|type') return false;
  const c = v as SunServiceCommand;
  return TYPES.includes(c.type) && SUN_SERVICES.some(d => d.id === c.serviceId) &&
    (!['COOL_AND_FIT', 'RUN_HEAT_SERVICE'].includes(c.type) || c.serviceId === 'washhouse-heat') &&
    (!['CLEAR_STAIR', 'CARRY_RESIDENT'].includes(c.type) || c.serviceId === 'stair-evacuation');
}
export function sunServiceCost(_s: SunServicesState, c: SunServiceCommand, _h: SunHost): SunEffect {
  const e = blank();
  if (c.type === 'SURVEY') e.seconds = 60;
  if (c.type === 'BUY_SUPPLIES') { e.cashCost = definition(c.serviceId).price; e.seconds = 30; }
  if (c.type === 'STOP_SERVICE') e.seconds = 30;
  if (c.type === 'COOL_AND_FIT') { e.actions = 1; e.seconds = 600; }
  if (c.type === 'RUN_HEAT_SERVICE' || c.type === 'CARRY_RESIDENT') { e.actions = 1; e.seconds = 180; }
  if (c.type === 'CLEAR_STAIR') { e.actions = 1; e.seconds = 300; }
  if (c.type === 'VERIFY_SERVICE') e.seconds = 30;
  if (c.type === 'RETURN_ON_FOOT') e.seconds = 60;
  return e;
}
export function sunServicesBlock(s: SunServicesState, c: SunServiceCommand, h: SunHost): string | null {
  if (!validateSunServiceCommand(c)) return '无效的居民服务行动，不能填写居民结果或检定。';
  const p = s.sites.find(x => x.id === c.serviceId);
  if (!p || h.actorId !== s.actorId || h.status !== 'ACTIVE' || h.sequence !== 1 || h.location !== p.location) return '须同一在世纯白天使本人亲到这处居民现场。';
  if (!Number.isSafeInteger(h.nowSecond) || h.nowSecond < s.lastSecond || h.week < s.startWeek || h.revision <= (s.journal.at(-1)?.revision ?? -1) || !h.eventId || s.journal.some(j => j.id === h.eventId)) return '实际时间或动作次序无效，不能重复结算。';
  if (h.check !== null) return '普通工作不接收施术检定或重新掷骰。';
  if (c.type === 'RETURN_ON_FOOT' || c.type === 'STOP_SERVICE') return null;
  if (c.type === 'SURVEY') return p.survey ? '这处原人、原物与普通退路已经实勘。' : null;
  if (!p.survey) return '先查明真实居民、器材和普通退路。';
  if (p.resident.consent !== 'ACCEPT' || p.helper.consent !== 'ACCEPT') return '当前本人或协助者未同意继续；仍可停止和离开。';
  if (p.review) return '这项真实服务已经交接，不能重复发料或制造功绩。';
  if (c.type === 'BUY_SUPPLIES' && (p.supplies.boughtEventId || p.supplies.stock !== p.supplies.ids.length)) return '这一份有限普通材料已经购买，不能重新领取。';
  if (c.type === 'COOL_AND_FIT' && (!p.heat?.cutoffClosed || !p.supplies.boughtEventId || p.work || p.supplies.usedEventId)) return '须先切断原炉供料并买下两枚真实垫片，再冷却修补同一接头。';
  if (c.type === 'RUN_HEAT_SERVICE' && (!p.heat?.repairedJoint || !p.heat.cutoffClosed || !p.work || p.completion || p.heat.fuel.filter(f => f.holder === 'OWNER').length !== 2)) return '须先修好同一接头；原热水服务只完成一次，并消耗一份店主已付费燃料。';
  if (c.type === 'CLEAR_STAIR' && (!p.stair || p.stair.cartCleared || p.work || !p.supplies.boughtEventId)) return '先取得原吊带，再用原杠杆把同一灰车移入侧凹处。';
  if (c.type === 'CARRY_RESIDENT' && (!p.stair?.cartCleared || !p.work || !p.supplies.boughtEventId || p.supplies.usedEventId || p.completion || p.resident.position !== 12)) return '须先清开真实楼梯，并用已购吊带和原担架转移仍在楼上的莉娜。';
  if (c.type === 'VERIFY_SERVICE' && (!p.completion || p.resident.position !== 0 || p.playerPosition !== 0 || p.apparatus.version !== p.completion.apparatusVersion)) return '须已有实际热水服务或同一居民抵达院内，不能凭交接生成结果。';
  const e = sunServiceCost(s, c, h);
  return h.actions < e.actions ? '行动不足；可免费停止、普通返回，再工作休养后续做。' : h.cash < e.cashCost ? `需本人实付${e.cashCost}便士；可免费返回工作筹款，原材料不会自动补发。` : null;
}
export function applySunServices(previous: SunServicesState, c: SunServiceCommand, h: SunHost): { state: SunServicesState; effect: SunEffect; notes: string[]; injuries: SunSceneInjury[] } {
  const reason = sunServicesBlock(previous, c, h); if (reason) throw Error(reason);
  const s = clone(previous), p = s.sites.find(x => x.id === c.serviceId)!, e = sunServiceCost(s, c, h), notes: string[] = [], consumedIds: string[] = [];
  const residentFrom = p.resident.position, completedSecond = h.nowSecond + e.seconds, completionWeek = h.week + Math.floor((completedSecond - h.weekAnchor) / 604800); let walkedMeters = 0;
  if (c.type === 'SURVEY') {
    p.survey = { eventId: h.eventId, second: completedSecond }; p.resident.consent = 'ACCEPT'; p.helper.consent = 'ACCEPT'; walkedMeters = c.serviceId === 'washhouse-heat' ? 8 : 12;
    notes.push(c.serviceId === 'washhouse-heat' ? '娜迪娅和托马斯当面请求修好热水回管。你查明原切断柄、漏接头、两包原衣物和院内退路；旧封闭筛筒有四份残留，仍完整封存，没有取用旧采光廊样本。店主此前实付12便士买下的两份燃料各有原编号。' : '莉娜请求协助下楼，原脚踝伤仍在。你和埃利斯查看十二米楼梯、六米处原灰车、原杠杆、担架及普通侧路；尚未搬人或移车。');
  } else if (c.type === 'BUY_SUPPLIES') { p.supplies.stock = 0; p.supplies.boughtEventId = h.eventId; notes.push(`本人支付${e.cashCost}便士取得${p.supplies.ids.length}件已编号普通材料；供应方余量归零，没有修理或移动居民。`); }
  else if (c.type === 'STOP_SERVICE') { if (p.heat) p.heat.cutoffClosed = true; notes.push('从安全侧停止继续作业，原料、损伤和居民实际位置保留；没有代替未完成的服务。'); }
  else if (c.type === 'COOL_AND_FIT') {
    const heat = p.heat!; heat.pressure = 0; heat.oldGasketsWaste = 2; heat.installedGasketIds = [...p.supplies.ids]; heat.repairedJoint = true; heat.condition = 84; heat.version++;
    p.apparatus.condition = heat.condition; p.apparatus.version = heat.version; p.supplies.usedEventId = h.eventId; consumedIds.push(...p.supplies.ids); p.work = { eventId: h.eventId, second: completedSecond }; walkedMeters = 8;
    notes.push('你关闭供料后沿原排水道泄压冷却，把两枚旧垫片移入废料盒、两枚已购垫片装进同一回管接头，普通修补完成。原筛筒和两个居民均未改变。');
  } else if (c.type === 'RUN_HEAT_SERVICE') {
    const heat = p.heat!; const fuel = heat.fuel.find(f => f.holder === 'OWNER')!; fuel.holder = 'BURNED'; consumedIds.push(fuel.id); heat.condition -= 2; heat.version++; heat.pressure = 0; heat.cutoffClosed = true;
    heat.bundles.forEach(b => { b.washed = true; b.location = 'COURTYARD'; }); p.resident.travelledMeters += 16; p.helper.travelledMeters += 8;
    p.apparatus.condition = heat.condition; p.apparatus.version = heat.version; walkedMeters = 16;
    p.completion = { eventId: h.eventId, week: completionWeek, second: completedSecond, residentPosition: 0, apparatusVersion: heat.version };
    notes.push('娜迪娅实际使用第一份原燃料试炉，两包原衣物各完成一次热水服务。你和两人沿原工道把原衣物带回院内，炉体磨损2并安全停炉；另一份原燃料仍在店主处。');
  } else if (c.type === 'CLEAR_STAIR') {
    p.stair!.cartPosition = -2; p.stair!.cartCleared = true; p.work = { eventId: h.eventId, second: completedSecond }; p.apparatus.version++; walkedMeters = 12; p.helper.travelledMeters += 12;
    notes.push('你与埃利斯用原杠杆把同一灰车从六米平台推入侧凹处，再沿原阶返回院内。楼梯实际清开，莉娜仍在十二米楼上，没有提前被算作获救。');
  } else if (c.type === 'CARRY_RESIDENT') {
    p.stair!.slingInstalledId = p.supplies.ids[0]!; p.supplies.usedEventId = h.eventId; consumedIds.push(...p.supplies.ids); walkedMeters = 24;
    p.resident.position = 0; p.resident.travelledMeters += 12; p.helper.travelledMeters += 24; p.apparatus.condition -= 2; p.apparatus.version++;
    p.completion = { eventId: h.eventId, week: completionWeek, second: completedSecond, residentPosition: 0, apparatusVersion: p.apparatus.version };
    notes.push('你与埃利斯走上十二米楼梯，把莉娜放入已购吊带和原担架，实际抬到院内照料点。原脚踝伤没有消失；担架磨损2，同一吊带留在原担架上。');
  } else if (c.type === 'VERIFY_SERVICE') {
    p.review = { eventId: h.eventId, week: completionWeek, second: completedSecond, apparatusVersion: p.apparatus.version };
    notes.push('本人核对已发生的原衣物服务或原居民院内抵达、器材损耗与用料。交接只读取真实结果，不生成一次新服务，也不增加技巧掌握。');
  } else { if (p.heat) p.heat.cutoffClosed = true; walkedMeters = p.playerPosition; p.playerPosition = 0; notes.push('本人停止作业、收妥原工具，沿普通路返回入口；未完成工作和原居民位置照实保留，无需行动或现款。'); }
  s.lastSecond = completedSecond; s.journal.push({ id: h.eventId, revision: h.revision, command: clone(c), host: clone(h), beforeSecond: h.nowSecond, afterSecond: completedSecond, walkedMeters, residentFrom, residentTo: p.resident.position, consumedIds, effect: clone(e), notes: [...notes] });
  return { state: s, effect: e, notes, injuries: [] };
}
export function canLeaveSunServices(s: SunServicesState, location?: string): boolean { return s.sites.filter(p => !location || p.location === location).every(p => p.playerPosition === 0 && (!p.heat || p.heat.cutoffClosed || !p.survey)); }
export function sunServiceVerifiedReceipts(s: SunServicesState): SunServiceReceipt[] {
  return s.sites.filter(p => p.survey && p.work && p.supplies.usedEventId && p.completion && p.review && p.review.second > p.completion.second && p.review.week >= p.completion.week && p.resident.position === 0 && p.playerPosition === 0 && p.apparatus.version === p.completion.apparatusVersion && p.review.apparatusVersion === p.apparatus.version &&
    (p.heat ? p.heat.repairedJoint && p.heat.cutoffClosed && p.heat.bundles.every(b => b.washed && b.location === 'COURTYARD') && p.heat.fuel.filter(f => f.holder === 'BURNED').length === 1 : p.stair?.cartCleared && p.stair.slingInstalledId === p.supplies.ids[0]))
    .map(p => ({ serviceId: p.id, residentId: p.resident.id, apparatusId: p.apparatus.id, passedEventId: p.completion!.eventId, passedWeek: p.completion!.week, reviewedEventId: p.review!.eventId, reviewedWeek: p.review!.week }));
}
export const sunServicesComplete = (s: SunServicesState): boolean => sunServiceVerifiedReceipts(s).length === 2;
export function validateSunServicesState(v: unknown): v is SunServicesState {
  try {
    const s = v as SunServicesState;
    if (!s || typeof s !== 'object' || s.version !== 1 || !Array.isArray(s.journal) || !Array.isArray(s.sites)) return false;
    let replay = createSunServices(s.runId, s.actorId, s.startWeek, s.startSecond);
    for (const j of s.journal) replay = applySunServices(replay, j.command, j.host).state;
    return stableStringify(replay) === stableStringify(s);
  } catch { return false; }
}
export function nextSunServiceCommand(s: SunServicesState): SunServiceCommand | null {
  for (const p of s.sites) {
    if (p.review) continue;
    const type: SunServiceCommand['type'] = !p.survey ? 'SURVEY' : p.heat && !p.heat.cutoffClosed ? 'STOP_SERVICE' : !p.supplies.boughtEventId ? 'BUY_SUPPLIES' : !p.work ? p.heat ? 'COOL_AND_FIT' : 'CLEAR_STAIR' : !p.completion ? p.heat ? 'RUN_HEAT_SERVICE' : 'CARRY_RESIDENT' : 'VERIFY_SERVICE';
    return { type, serviceId: p.id };
  }
  return null;
}
export function getSunServiceActions(s: SunServicesState, h: SunHost) {
  const labels: Record<SunServiceCommand['type'], string> = { SURVEY: '查看居民、原物和普通退路', BUY_SUPPLIES: '实付购买本处有限普通材料', STOP_SERVICE: '从安全侧普通停止作业', COOL_AND_FIT: '冷却原炉并换入两枚已购垫片', RUN_HEAT_SERVICE: '实际试炉并完成两包原衣物服务', CLEAR_STAIR: '用原杠杆把灰车移到侧凹处', CARRY_RESIDENT: '用原担架实际抬莉娜到院内', VERIFY_SERVICE: '核对已发生服务与真实到达', RETURN_ON_FOOT: '停止作业并沿普通路返回' };
  const next = nextSunServiceCommand(s);
  return s.sites.flatMap(p => TYPES.filter(type => validateSunServiceCommand({ type, serviceId: p.id })).map(type => {
    const command: SunServiceCommand = { type, serviceId: p.id }, e = sunServiceCost(s, command, h), reason = sunServicesBlock(s, command, h);
    return { command, label: `${definition(p.id).title}：${labels[type]}`, cost: `${e.actions}行动、${e.cashCost}便士，实际${e.seconds}秒；普通工作无需检定`, enabled: !reason, reason, preferredAction: !reason && next?.serviceId === p.id && next.type === type };
  }));
}
export function projectSunServices(s: SunServicesState) {
  return { id: 'sun-services', title: '热水修复与居民下楼', lines: s.sites.flatMap(p => [
    `${definition(p.id).title}：${p.review ? '真实结果已交接' : p.completion ? '实际服务完成待交接' : p.work ? '普通施工完成' : p.survey ? '已实勘' : '待亲到实勘'}；${p.resident.name}（${p.resident.age}岁）位于${p.resident.position === 0 ? '院内' : `${p.resident.position}米楼上`}，${p.resident.injuries.join('；') || '无原伤'}。`,
    `本人${p.playerPosition}米；原${p.apparatus.id}状况${p.apparatus.condition}，普通材料${p.supplies.usedEventId ? '已经实际使用' : p.supplies.boughtEventId ? '已付费持有' : `供应方${p.supplies.stock}件`}。`,
    ...(p.heat ? [`店主此前已付12便士的两份原燃料：已耗${p.heat.fuel.filter(f => f.holder === 'BURNED').length}，剩余${p.heat.fuel.filter(f => f.holder === 'OWNER').length}；四份旧筛筒残留仍封存在独立原件中。`] : [`原灰车在${p.stair!.cartPosition}米${p.stair!.cartCleared ? '侧凹处' : '楼梯平台'}；原担架与吊带没有被换成新物。`]),
  ]).concat('两件工作共4行动、本人30便士普通材料；实际作业与居民抵达才计结果。停止和普通返程无需行动或现款。') };
}
