import { stableStringify } from '../canonical.js';
import { validateGlorySiteState } from '../glory/life.js';
import type { SliceState } from '../slice/types.js';
import { TWILIGHT_WORKER_IDS, TWILIGHT_SEGMENTS, emptyTwilightWorksEffect, type TwilightWorksState, type TwilightWorksOrigin, type TwilightWorksCommand, type TwilightWorksHost, type TwilightWorkerId, type TwilightSegment, type TwilightPassageReceipt } from './works-types.js';
export * from './works-types.js';
const clone = <T>(v: T): T => structuredClone(v);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const simple = ['SURVEY', 'WALK_RETURN_ROUTE', 'REPAIR_BEAM_JOINT', 'APPROACH', 'RETREAT', 'REST_OUTSIDE', 'REVIEW'];
const personal = ['ASK_WORKER', 'WITHDRAW_CONSENT', 'ARRIVE_WORKER', 'SAFE_EXIT'];
const worker = (s: TwilightWorksState, id: TwilightWorkerId) => s.workers.find(w => w.id === id)!;
const fitted = (s: TwilightWorksState, segment: TwilightSegment) => s.supports.find(p => p.segment === segment && p.holder === 'FITTED');
const currentTraversals = (s: TwilightWorksState, id: TwilightWorkerId) => s.traversals.filter(t => t.workerId === id && t.arrivalEventId === worker(s, id).arrivalEventId);
const safeCompleted = (s: TwilightWorksState, id: TwilightWorkerId) => currentTraversals(s, id).length === 2 && s.exits.some(e => e.workerId === id && e.arrivalEventId === worker(s, id).arrivalEventId && e.safe && e.from === 8);
const returnMetres = (position: number) => position === 8 ? 12 : position === 5 ? 7 : position === 2 ? 4 : 0;
export function validateTwilightWorksCommand(v: unknown): v is TwilightWorksCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>, keys = Object.keys(c).sort().join('|');
  if (simple.includes(String(c.type))) return keys === 'type';
  if (personal.includes(String(c.type))) return keys === 'type|workerId' && TWILIGHT_WORKER_IDS.includes(c.workerId as TwilightWorkerId);
  if (['BUY_SUPPORT', 'FIT_SUPPORT'].includes(String(c.type))) return keys === 'segment|type' && TWILIGHT_SEGMENTS.includes(c.segment as TwilightSegment);
  return c.type === 'CROSS_SEGMENT' && keys === 'segment|type|workerId' && TWILIGHT_SEGMENTS.includes(c.segment as TwilightSegment) && TWILIGHT_WORKER_IDS.includes(c.workerId as TwilightWorkerId);
}
export function createTwilightWorksFromOrigin(o: TwilightWorksOrigin): TwilightWorksState {
  if (!o.actorId || !/^[a-f0-9]{64}$/.test(o.sourceDigest) || !validateGlorySiteState(o.site) || o.site.playerLocation !== 'OUTSIDE' || o.site.bridge.ordinaryPath !== 'OPEN' || o.site.temper.active || o.site.guard.active || !Number.isSafeInteger(o.week) || o.week < 1 || !Number.isSafeInteger(o.second) || o.second < o.site.clockSeconds || !Number.isSafeInteger(o.revision) || o.revision < 0) throw Error('须从已核验、已离场的同一神明之手当前原现场接续。');
  return { id: 'TG220-BRIDGE-WORKS', location: 'GL2-REPAIR-ROOM', actorId: o.actorId, sourceDigest: o.sourceDigest, origin: clone(o), lastSecond: o.second,
    position: -2, playerEnergy: o.site.playerEnergy, playerTravelMetres: 0, investigationEventId: null, routeEventId: null, reviewedEventId: null,
    beam: { id: 'TG220-BRIDGE-BEAM', originalBridgeId: o.site.bridge.id, position: 5, introducedEventId: null, surveyedIntegrity: 60, integrity: 60, version: 0, restoredOrdinaryCeiling: 70, repairEventIds: [] },
    cart: { id: 'TG220-MARA-HANDCART', ownerId: 'TG220-MARA', position: 8, integrity: 76, axle: { id: 'TG220-MARA-AXLE', version: 0, jammed: false, remainingPush: 0, strain: 0 } },
    supports: [], traversals: [], exits: [], journal: [],
    workers: [{ id: 'TG220-MARA', bodyId: 'TG220-MARA-BODY', name: '玛拉·里德', age: 38, alive: true, health: 100, energy: 80, position: -2, travelledMetres: 0, injuries: [], consent: 'UNASKED', consentWeek: null, hireEventId: null, arrivalEventId: null },
      { id: 'TG220-OSRIC', bodyId: 'TG220-OSRIC-BODY', name: '奥斯里克·韦尔', age: 44, alive: true, health: 100, energy: 78, position: -2, travelledMetres: 0, injuries: [], consent: 'UNASKED', consentWeek: null, hireEventId: null, arrivalEventId: null }] };
}
/** Call only AFTER complete source admission; this checks local handoff, not campaign provenance. */
export function createTwilightWorks(source: SliceState, input: { actorId: string; sourceDigest: string; nowSecond: number }): TwilightWorksState {
  if (source.status !== 'ACTIVE' || source.progression.pathwayId !== 'warrior' || source.progression.sequence !== 1 || source.health <= 0 || source.mind <= 0 || source.divineHand.promotionWeek === null || !source.divineHand.life.reflected || source.divineHand.life.activeCase !== null || source.divineHand.life.pending !== null) throw Error('只接续真实存活且原生活收尾的序列1；不得从死亡记录改写。');
  return createTwilightWorksFromOrigin({ actorId: input.actorId, sourceDigest: input.sourceDigest, week: source.week, second: input.nowSecond, revision: source.revision, site: clone(source.glory.life.site) });
}
export function twilightWorksCost(s: TwilightWorksState, c: TwilightWorksCommand) {
  const e = emptyTwilightWorksEffect();
  if (c.type === 'SURVEY') e.seconds = 60;
  if (c.type === 'WALK_RETURN_ROUTE') { e.seconds = 24; e.playerEnergy = 4; }
  if (c.type === 'ASK_WORKER') { e.seconds = 30; e.cashCost = 12; }
  if (c.type === 'WITHDRAW_CONSENT') e.seconds = 1;
  if (c.type === 'ARRIVE_WORKER') e.seconds = 4;
  if (c.type === 'APPROACH') { e.seconds = s.position === 8 ? 8 : s.position === 5 ? 3 : 4; e.playerEnergy = 1; }
  if (c.type === 'BUY_SUPPORT') { e.cashCost = 24; e.seconds = 300; }
  if (c.type === 'FIT_SUPPORT') { e.actions = 1; e.seconds = 180; e.playerEnergy = 2; }
  if (c.type === 'REPAIR_BEAM_JOINT') { e.actions = 1; e.cashCost = 18; e.seconds = 600; e.playerEnergy = 2; }
  if (c.type === 'CROSS_SEGMENT') { e.actions = c.segment === 'A' ? 1 : 0; e.seconds = 6; e.playerEnergy = 2; }
  if (c.type === 'RETREAT' || c.type === 'SAFE_EXIT') {
    const metres = c.type === 'SAFE_EXIT' ? returnMetres(worker(s, c.workerId).position) : returnMetres(s.position);
    e.seconds = Math.max(1, metres * (s.playerEnergy < 3 ? 10 : 1));
    e.playerEnergy = c.type === 'RETREAT' ? Math.min(3, s.playerEnergy) : 0;
  }
  if (c.type === 'REST_OUTSIDE') { e.seconds = 1800; e.playerEnergyRecovered = Math.min(20, 100 - s.playerEnergy); }
  if (c.type === 'REVIEW') e.seconds = 60;
  return e;
}
export function twilightWorksBlock(s: TwilightWorksState, c: TwilightWorksCommand, h: TwilightWorksHost): string | null {
  if (!validateTwilightWorksCommand(c)) return '无效动作；命令不能提供同意、骰值、材料或通行证明。';
  if (h.actorId !== s.actorId || h.sourceDigest !== s.sourceDigest || h.location !== s.location || h.status !== 'ACTIVE' || h.sequence !== 1 || h.health <= 0 || h.mind <= 0) return '须同一存活序列1本人及已核验原现场。';
  if (!h.eventId || !Number.isSafeInteger(h.nowSecond) || h.nowSecond < s.lastSecond || !Number.isSafeInteger(h.week) || h.week < s.origin.week || h.revision <= (s.journal.at(-1)?.host.revision ?? s.origin.revision) || s.journal.some(j => j.host.eventId === h.eventId) || h.check !== null) return '时间、顺序或检定无效；普通工作不抽骰。';
  if (c.type === 'RETREAT') return s.position === -2 ? '本人已在室外。' : null;
  if (c.type === 'SAFE_EXIT') return worker(s, c.workerId).position === -2 ? '该工人已在室外，不能复制退出。' : null;
  if (c.type === 'WITHDRAW_CONSENT') return worker(s, c.workerId).consent !== 'GRANTED' ? '没有仍有效的该人同意。' : null;
  if (c.type === 'REST_OUTSIDE') return s.position !== -2 ? '须先真实回到室外休息。' : s.playerEnergy === 100 ? '精力已满。' : null;
  if (s.reviewedEventId) return '两份真实通行已交接；只能实际收尾或休息，不能重复计数。';
  if (c.type === 'SURVEY') return s.investigationEventId ? '已查看同一原桥与本次原车。' : null;
  if (!s.investigationEventId) return '先从安全侧查看原桥、两端与普通侧路。';
  if (c.type === 'WALK_RETURN_ROUTE' && (s.routeEventId || s.position !== -2)) return '从室外完整走查普通侧路一次并回到室外。';
  if (c.type === 'APPROACH' && s.position === 2) return '本人已在工作台。';
  if (c.type === 'ASK_WORKER') {
    const w = worker(s, c.workerId);
    if (s.position !== -2 || w.position !== -2 || safeCompleted(s, w.id) || w.consent === 'GRANTED' && w.consentWeek === h.week) return '须向仍在室外且本次尚未完成的本人重新询问；同周有效同意不重复收费。';
  }
  if (c.type === 'ARRIVE_WORKER') {
    const w = worker(s, c.workerId);
    if (w.position !== -2 || w.consent !== 'GRANTED' || w.consentWeek !== h.week || !w.hireEventId || !s.routeEventId || w.energy < 12) return '须本周本人已明确同意、已付此次工钱、核实退路并留足往返精力。';
  }
  if (c.type === 'BUY_SUPPORT' && (s.position !== 2 || s.supports.some(p => p.segment === c.segment && p.holder === 'PLAYER'))) return '须本人在工作台接货；同段不能重复持有未安装支撑。';
  if (c.type === 'FIT_SUPPORT' && (s.position !== 2 || !s.routeEventId || !s.supports.some(p => p.segment === c.segment && p.holder === 'PLAYER'))) return '须在安全工作台使用本人实际已购本段支撑，先核实普通返回路。';
  if (c.type === 'REPAIR_BEAM_JOINT' && (s.position !== 2 || s.beam.integrity >= s.beam.restoredOrdinaryCeiling)) return '须从工作台实付修理仍有损坏的原接头；不能超过普通修理上限。';
  if (c.type === 'CROSS_SEGMENT') {
    const w = worker(s, c.workerId), p = fitted(s, c.segment), from = c.segment === 'A' ? 2 : 5;
    if (!s.routeEventId || s.position !== from || w.position !== from || w.consent !== 'GRANTED' || w.consentWeek !== h.week || w.energy < 6 || !w.arrivalEventId || currentTraversals(s, w.id).some(t => t.segment === c.segment) || c.segment === 'B' && !currentTraversals(s, w.id).some(t => t.segment === 'A')) return '本人和同意者须实际同在该段起点，前段记录须来自此次真实到场；保留退路精力。';
    if (s.beam.integrity < 65 || !p || p.integrity < 40 || p.passagesRemaining < 1) return '原梁或新支撑不足；可普通撤回，另实付修梁或更换耗损支撑。';
  }
  if (c.type === 'REVIEW' && (s.position !== -2 || !TWILIGHT_WORKER_IDS.every(id => safeCompleted(s, id)))) return '须两位本人均实际完成两段通行、亲自安全退出，本人也回到室外后复核。';
  const e = twilightWorksCost(s, c);
  return h.actions < e.actions ? '行动不足；普通退出不需行动。' : h.cash < e.cashCost ? `须实付${e.cashCost}便士，旧物不补满。` : s.playerEnergy < e.playerEnergy + 3 ? '须为普通退路保留3精力；可先退出休息。' : null;
}
export function applyTwilightWorks(previous: TwilightWorksState, c: TwilightWorksCommand, h: TwilightWorksHost) {
  const reason = twilightWorksBlock(previous, c, h); if (reason) throw Error(reason);
  const s = clone(previous), e = twilightWorksCost(s, c), notes: string[] = [];
  if (c.type === 'SURVEY') { s.investigationEventId = h.eventId; s.beam.introducedEventId = h.eventId; s.beam.version++;
    notes.push('从安全侧查明同一六米桥的两段各三米、原梁松动接头60完整度和八米普通侧路。新登场成年玛拉38岁、奥斯里克44岁仍在室外；玛拉原车在远端。旧西莉娅、埃文、银甲、垫片与负载不变。'); }
  else if (c.type === 'WALK_RETURN_ROUTE') { s.routeEventId = h.eventId; s.playerTravelMetres += 24; notes.push('本人沿四米门道、八米普通侧路到远端，再原路返回室外；实走24米，记录可退路线。'); }
  else if (c.type === 'ASK_WORKER') { const w = worker(s, c.workerId); w.consent = 'GRANTED'; w.consentWeek = h.week; w.hireEventId = h.eventId; notes.push(`${w.name}本人明确同意本周普通通行，实付12便士本次工钱；仍在室外，尚未到场。`); }
  else if (c.type === 'WITHDRAW_CONSENT') { worker(s, c.workerId).consent = 'WITHDRAWN'; notes.push('该人撤回本次作业同意；立即禁止继续通行，费用不退，位置没有自动改变，可自主沿普通退路退出。'); }
  else if (c.type === 'ARRIVE_WORKER') { const w = worker(s, c.workerId); w.position = 2; w.travelledMetres += 4; w.energy -= 2; w.arrivalEventId = h.eventId; notes.push(`${w.name}本人从室外走四米到工作台，精力实耗2；未移动任何旧工人。`); }
  else if (c.type === 'APPROACH') { s.playerTravelMetres += s.position === 8 ? 8 : Math.abs(s.position - 2); s.position = 2; notes.push('本人沿普通通道实际到工作台；远端返回使用八米侧路。'); }
  else if (c.type === 'BUY_SUPPORT') { s.supports.push({ id: `TG220-SUPPORT:${h.eventId}:${c.segment}`, segment: c.segment, paidPennies: 24, boughtEventId: h.eventId, installedEventId: null, holder: 'PLAYER', integrity: 100, passagesRemaining: 2 }); notes.push(`实付24便士取得并运到工作台的一件全新${c.segment}段支撑；不是补充旧垫片或原负载。`); }
  else if (c.type === 'FIT_SUPPORT') { const p = s.supports.find(x => x.segment === c.segment && x.holder === 'PLAYER')!, old = fitted(s, c.segment); if (old) old.holder = 'RETIRED'; p.holder = 'FITTED'; p.installedEventId = h.eventId; s.beam.version++; notes.push(`用安全侧长柄夹具安装同一已购${c.segment}段支撑；旧支撑按原剩余退役，不退款或修复。`); }
  else if (c.type === 'REPAIR_BEAM_JOINT') { s.beam.integrity = s.beam.restoredOrdinaryCeiling; s.beam.version++; s.beam.repairEventIds.push(h.eventId); notes.push('实付18便士新接头螺栓和1行动，普通修复同一梁至70；绝不修复旧银甲或回填耗材。'); }
  else if (c.type === 'CROSS_SEGMENT') { const w = worker(s, c.workerId), p = fitted(s, c.segment)!, from = c.segment === 'A' ? 2 : 5, to = c.segment === 'A' ? 5 : 8;
    s.position = to; w.position = to; s.playerTravelMetres += 3; w.travelledMetres += 3; w.energy -= 2; p.integrity -= 10; p.passagesRemaining--; s.beam.integrity--; s.beam.version++;
    s.traversals.push({ workerId: w.id, arrivalEventId: w.arrivalEventId!, segment: c.segment, eventId: h.eventId, supportId: p.id, from, to, metres: 3 }); notes.push(`${w.name}与本人实际走完${c.segment}段三米；支撑损耗10并用去一次额定通行，原梁损耗1。尚须亲自退出才计安全通行。`); }
  else if (c.type === 'SAFE_EXIT') { const w = worker(s, c.workerId), from = w.position, metres = returnMetres(from); w.position = -2; w.travelledMetres += metres; w.energy = Math.max(0, w.energy - Math.ceil(metres / 4)); w.consent = 'CLOSED';
    s.exits.push({ workerId: w.id, arrivalEventId: w.arrivalEventId!, eventId: h.eventId, second: h.nowSecond + e.seconds, from, metres, safe: w.alive && w.health > 0 }); notes.push(`${w.name}自主沿普通退路实走${metres}米到室外；本人和其他人的位置不随之改变。中途撤回不冒充完整通行。`); }
  else if (c.type === 'RETREAT') { const metres = returnMetres(s.position); s.playerTravelMetres += metres; s.position = -2; notes.push(`本人停止工作并实走${metres}米普通退路；精力不足时慢行。未移动任何其他人，材料和损坏保留。`); }
  else if (c.type === 'REST_OUTSIDE') notes.push(`本人在室外实际休息1800秒恢复${e.playerEnergyRecovered}精力；不回血、不修甲、不替别人恢复精力。`);
  else { s.reviewedEventId = h.eventId; notes.push('复核两位成人各自的本次到场、两段真实通行和普通安全退出。仅形成两份本作内部准备事实，不自动晋升。'); }
  s.playerEnergy = s.playerEnergy - e.playerEnergy + e.playerEnergyRecovered; s.lastSecond = h.nowSecond + e.seconds;
  s.journal.push({ command: clone(c), host: clone(h), effect: clone(e), notes: [...notes] }); return { state: s, effect: e, notes };
}
/** Preliminary facts deliberately do not assert completion or grant potion eligibility. */
export function twilightWorksPreparationFacts(s: TwilightWorksState) {
  const a = fitted(s, 'A'), b = fitted(s, 'B');
  return s.investigationEventId && s.routeEventId && a?.installedEventId && b?.installedEventId ? { actorId: s.actorId, sourceDigest: s.sourceDigest, investigationEventId: s.investigationEventId, routeEventId: s.routeEventId, supportEventIds: [a.boughtEventId, b.boughtEventId] as [string, string], bridgeId: 'GL2-BRIDGE' as const, observedBridgeVersion: s.beam.version } : null;
}
export function twilightWorksVerifiedPassages(s: TwilightWorksState): TwilightPassageReceipt[] {
  if (!s.reviewedEventId || !TWILIGHT_WORKER_IDS.every(id => safeCompleted(s, id))) return [];
  return TWILIGHT_WORKER_IDS.map((id): TwilightPassageReceipt => { const w = worker(s, id), ts = currentTraversals(s, id), exit = s.exits.find(e => e.workerId === id && e.arrivalEventId === w.arrivalEventId && e.safe && e.from === 8)!;
    return { serviceId: id === 'TG220-MARA' ? 'TG220-PASSAGE-MARA' : 'TG220-PASSAGE-OSRIC', actorId: s.actorId, workerId: id, bridgeId: 'GL2-BRIDGE', sourceDigest: s.sourceDigest, arrivedEventId: w.arrivalEventId!, segments: ts.map(({ segment, from, to, metres, eventId, supportId }) => ({ segment, from, to, metres, eventId, supportId })), crossedEventId: ts[1]!.eventId, safeExitEventId: exit.eventId, reviewedEventId: s.reviewedEventId!, week: s.journal.find(j => j.host.eventId === s.reviewedEventId)!.host.week };
  });
}
export function validateTwilightWorksState(v: unknown): v is TwilightWorksState {
  try { const s = v as TwilightWorksState; if (!s || !Array.isArray(s.journal)) return false; let r = createTwilightWorksFromOrigin(s.origin); for (const j of s.journal) r = applyTwilightWorks(r, j.command, j.host).state; return same(r, s); } catch { return false; }
}
/** Sole continuing physical view; origin is history. Never write this over immutable S1 journals. */
export function twilightWorksCurrentOriginals(s: TwilightWorksState) {
  const site = clone(s.origin.site); site.playerEnergy = s.playerEnergy; site.playerTravelMetres += s.playerTravelMetres;
  site.playerLocation = s.position === -2 ? 'OUTSIDE' : s.position === 2 ? 'BENCH' : 'BRIDGE'; site.clockSeconds = s.lastSecond;
  site.bridge.crossings += s.traversals.filter(t => t.segment === 'B').length;
  site.bridge.ordinaryCrossings += s.traversals.filter(t => t.segment === 'B').length;
  return { site, exactPlayerPosition: s.position };
}
export function projectTwilightWorks(s: TwilightWorksState) {
  return { title: '原桥两段普通工作', lines: [`同一${s.origin.site.bridge.id}，原梁${s.beam.integrity}/70；本人${s.position}米，精力${s.playerEnergy}。`, ...s.workers.map(w => `${w.name}，${w.age}岁，${w.position}米，精力${w.energy}；${w.consent}；${safeCompleted(s, w.id) ? '实际完成并安全退出' : '尚未形成完整通行'}`), ...s.supports.map(p => `${p.id}：实付24便士，${p.holder}，完整度${p.integrity}，额定通行剩余${p.passagesRemaining}。`), `复核安全通行${twilightWorksVerifiedPassages(s).length}/2。旧银甲${s.origin.site.armor?.integrity ?? 0}、旧垫片${s.origin.site.pads.remaining}、旧负载${s.origin.site.load.remainingLoads}保持原值。`] };
}
export function getTwilightWorksActions(s: TwilightWorksState, h: TwilightWorksHost) {
  const commands: TwilightWorksCommand[] = [
    ...simple.map(type => ({ type }) as TwilightWorksCommand),
    ...TWILIGHT_WORKER_IDS.flatMap(workerId => personal.map(type => ({ type, workerId }) as TwilightWorksCommand)),
    ...TWILIGHT_SEGMENTS.flatMap(segment => [{ type: 'BUY_SUPPORT' as const, segment }, { type: 'FIT_SUPPORT' as const, segment }, ...TWILIGHT_WORKER_IDS.map(workerId => ({ type: 'CROSS_SEGMENT' as const, segment, workerId }))]),
  ];
  const labels: Record<TwilightWorksCommand['type'], string> = { SURVEY: '查看原桥与真实普通退路', WALK_RETURN_ROUTE: '亲走普通退路并返回', REPAIR_BEAM_JOINT: '实付修复原梁接头', APPROACH: '本人走到工作台', RETREAT: '本人沿普通退路退出', REST_OUTSIDE: '室外真实休息半小时', REVIEW: '复核两次真实通行和退出', ASK_WORKER: '询问本人并实付此次工钱', WITHDRAW_CONSENT: '读取该人撤回作业同意', ARRIVE_WORKER: '同意者亲走四米到场', SAFE_EXIT: '该人自主走普通退路', BUY_SUPPORT: '实付购买一件本段新支撑', FIT_SUPPORT: '真实安装已购支撑', CROSS_SEGMENT: '与同意者实走该段三米' };
  return commands.map(command => { const effect = twilightWorksCost(s, command), reason = twilightWorksBlock(s, command, h); return { command, label: `${labels[command.type]}${'workerId' in command ? `：${worker(s, command.workerId).name}` : ''}${'segment' in command ? `（${command.segment}段）` : ''}`, cost: `${effect.actions}行动、${effect.cashCost}便士、${effect.playerEnergy}精力、${effect.seconds}秒`, enabled: !reason, reason, preferredAction: false }; });
}
