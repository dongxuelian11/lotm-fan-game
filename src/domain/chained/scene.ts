import { stableStringify } from '../canonical.js';
import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import { CHAINED_ABILITY_IDS, CHAINED_EXIT_METRES, CHAINED_PRACTICE_COSTS, CHAINED_PRICES, CHAINED_WORKERS, type ChainedPosition, type ChainedSegmentId, type ChainedWorkerId } from './content.js';
import type { ChainedCommand, ChainedEffect, ChainedScene, ChainedSceneHost, ChainedSource, ChainedCargo } from './types.js';

const SCENE_COMMANDS = new Set(['LEAVE_ORIGINAL_COURT', 'ASK_OWNER', 'WITHDRAW_OWNER', 'APPROACH', 'INSPECT_EXIT', 'INSPECT_DEVICE', 'BUY_TOOLS', 'OPEN_EXIT', 'CLOSE_EXIT', 'ASK_WORKER', 'WITHDRAW_WORKER', 'ARRIVE_WORKER', 'EXIT_WORKER', 'INSPECT_SEGMENT', 'REMOVE_PIN', 'OPEN_SEGMENT', 'CLOSE_SEGMENT', 'CROSS', 'REPORT_EVACUATION', 'START_PRACTICE', 'BIND_ROPE', 'APPLY_BINDING', 'MANUAL_INSPECTION', 'BEAR_IMPACT', 'MOVE_CARGO', 'SECURE_CARGO', 'STOP_METHOD', 'END_CONTACT', 'WAIT_10', 'WALK_EXIT', 'REPORT_RETURN']);
const CLEANUP = new Set(['STOP_METHOD', 'END_CONTACT', 'WAIT_10', 'WITHDRAW_OWNER', 'WITHDRAW_WORKER', 'OPEN_EXIT', 'CLOSE_EXIT', 'EXIT_WORKER', 'WALK_EXIT', 'CLOSE_SEGMENT', 'REPORT_RETURN', 'REPORT_EVACUATION', 'ASK_OWNER']);
const worker = (s: ChainedScene, id: ChainedWorkerId) => s.workers.find(w => w.id === id);
const box = (s: ChainedScene) => s.cargo.find(c => c.id === 'CH225-MAINTENANCE-BOX')!;
const permitted = (s: ChainedScene, h: ChainedSceneHost) => s.owner.alive && s.owner.consent === 'GRANTED' && s.owner.permissionWeek === h.week && !!s.owner.permissionEventId;
const outside = (s: ChainedScene) => s.playerPosition === 'OUTSIDE' && s.owner.position === 'OUTSIDE' && s.workers.every(w => w.position === 'OUTSIDE');
const settled = (s: ChainedScene) => outside(s) && !s.window && !s.contact && !s.segments.A.open && !s.segments.B.open && s.exit.door === 'CLOSED';
const workerFinished = (w: ChainedScene['workers'][number]) => !!w.passage.a && !!w.passage.b && !!w.passage.exit;
const delivered = (s: ChainedScene) => s.workers.every(workerFinished) && s.cargo.filter(c => c.carrierId !== 'PLAYER').every(c => c.position === 'OUTSIDE' && !!c.passage.a && !!c.passage.b && !!c.passage.exit);
const hasReceipt = (s: ChainedScene, kind: string) => s.receipts.some(r => r.kind === kind);
const route = (segment: ChainedSegmentId): { from: ChainedPosition; to: ChainedPosition } => segment === 'A' ? { from: 'ENTRY', to: 'MIDPOINT' } : { from: 'MIDPOINT', to: 'GATE' };
function crossing(s: ChainedScene, c: Extract<ChainedCommand, { type: 'CROSS' }>): ChainedPosition | null {
  const at = c.actorId === 'PLAYER' ? s.playerPosition : worker(s, c.actorId)?.position, path = route(c.segment);
  return at === path.from ? path.to : at === path.to ? path.from : null;
}
function windowCurrent(s: ChainedScene, h: ChainedSceneHost, seconds = 0): boolean {
  const w = s.window;
  if (!w || w.actorId !== h.actorId || w.startPosition !== s.playerPosition || w.permissionVersion !== s.owner.permissionVersion || !permitted(s, h) || h.second < w.createdAt || h.second + seconds >= w.expiresAt || s.workers.some(x => x.position !== 'OUTSIDE')) return false;
  if (w.kind === 'LOCAL_BINDING') { const rope = s.rope; return s.contact && w.targetId === rope.id && w.targetVersion === rope.version && rope.location === 'GATE' && rope.integrity > 0 && !rope.loadEventId && s.segments.B.open; }
  const c = box(s); return !s.contact && w.targetId === c.id && w.targetVersion === c.version && c.visible && c.position === 'GATE' && !c.secured && !c.movedEventId;
}
function cost(c: ChainedCommand, s: ChainedScene): ChainedEffect {
  const e: ChainedEffect = { actions: 0, cash: 0, spirituality: 0, mind: 0, health: 0, seconds: 1 };
  if (c.type === 'ASK_WORKER' && !worker(s, c.workerId)?.paidEventId) e.cash = CHAINED_PRICES.workerService;
  if (c.type === 'BUY_TOOLS') e.cash = CHAINED_PRICES.ordinaryTools;
  if (['INSPECT_EXIT', 'INSPECT_SEGMENT', 'INSPECT_DEVICE', 'REMOVE_PIN', 'MANUAL_INSPECTION', 'SECURE_CARGO'].includes(c.type)) e.seconds = 30;
  if (c.type === 'REPORT_EVACUATION' || c.type === 'REPORT_RETURN') { e.actions = 1; e.seconds = 30; }
  if (c.type === 'BIND_ROPE' || c.type === 'BEAR_IMPACT') { e.actions = 1; e.spirituality = 12; e.mind = 5; }
  if (c.type === 'APPLY_BINDING' || c.type === 'MOVE_CARGO') e.seconds = 2;
  if (['APPROACH', 'ARRIVE_WORKER'].includes(c.type)) e.seconds = 2;
  if (c.type === 'LEAVE_ORIGINAL_COURT') e.seconds = 4;
  if (c.type === 'CROSS') e.seconds = 3;
  if (c.type === 'WALK_EXIT') e.seconds = CHAINED_EXIT_METRES[s.playerPosition];
  if (c.type === 'EXIT_WORKER') e.seconds = CHAINED_EXIT_METRES[worker(s, c.workerId)?.position ?? 'OUTSIDE'];
  if (c.type === 'WAIT_10') e.seconds = 10;
  return e;
}
export function createChainedScene(source: ChainedSource): ChainedScene {
  const site = source.originals.site, operation = source.originals.operation;
  if (!site.volunteer.alive || site.volunteer.location !== 'OUTSIDE' || site.guide.location !== 'OUTSIDE' || !['START', 'OUTSIDE'].includes(site.playerLocation) || operation.inputActive || operation.form !== null) throw Error('须先收好原安静室的实际作用，让埃尔莎和哈伦真实退出。');
  const pin = (segment: ChainedSegmentId) => ({ inspectedEventId: null, open: false, pin: { id: `CH225-ORIGINAL-PIN-${segment}`, position: 'INSERTED' as const, location: route(segment).from, travelMetres: 0, integrity: 100, wear: 0, version: 0, removedEventId: null } });
  const cargo = (id: ChainedCargo['id'], carrierId: ChainedCargo['carrierId'], position: ChainedPosition): ChainedCargo => ({ id, carrierId, position, travelMetres: 0, version: 0, visible: carrierId !== 'PLAYER', secured: carrierId !== 'PLAYER', offsetMetres: 0, movedEventId: null, passage: { a: null, b: null, exit: null } });
  return { phase: 'PREPARATION', status: 'ACTIVE', playerPosition: site.playerLocation === 'START' ? 'ORIGINAL_ENTRY' : 'OUTSIDE', playerTravelMetres: site.playerTravelMetres, originalDepartureEventId: null,
    owner: { id: 'CH225-KEEPER', name: '伯纳德', age: 42, alive: true, position: 'OUTSIDE', consent: 'CLOSED', permissionVersion: 0, permissionWeek: null, permissionEventId: null },
    workers: CHAINED_WORKERS.map(w => ({ ...w, alive: true, health: 100, energy: 80, position: 'OUTSIDE', walkedMetres: 0, consent: 'UNASKED', permissionVersion: 0, permissionEventId: null, paidEventId: null, arrivalEventId: null, passage: { a: null, b: null, exit: null } })),
    cargo: [cargo('CH225-CARGO-VERA', 'CH225-VERA', 'OUTSIDE'), cargo('CH225-CARGO-EDWIN', 'CH225-EDWIN', 'OUTSIDE'), cargo('CH225-MAINTENANCE-BOX', 'PLAYER', 'GATE')],
    originalOperation: structuredClone(operation), originalBlocks: structuredClone(source.originals.blocks),
    segments: { A: pin('A'), B: pin('B') }, exit: { inspectedEventId: null, door: 'CLOSED' }, toolsBoughtEventId: null,
    device: { inspectedEventId: null, loadFinishedEventId: null, cargoFinishedEventId: null, loadMethod: 'NONE', cargoMethod: 'NONE' },
    rope: { id: 'CH225-ORIGINAL-ROPE-B', location: 'GATE', integrity: 100, wear: 0, version: 0, loadEventId: null, dropCentimetres: 0 },
    contact: false, window: null, moves: [], receipts: [], evacuationReportEventId: null, returnReportEventId: null, bindingApplied: false, impactBurdenApplied: false };
}
export const isChainedSceneCommand = (c: ChainedCommand): boolean => SCENE_COMMANDS.has(c.type);
export const chainedSceneInside = (s: ChainedScene): boolean => !settled(s) || s.owner.consent === 'GRANTED' || s.workers.some(w => w.consent === 'GRANTED');

export function chainedSceneBlock(s: ChainedScene, c: ChainedCommand, h: ChainedSceneHost): string | null {
  if (!isChainedSceneCommand(c)) return '这不是闸廊的现场行动。';
  if (h.health <= 0 || h.mind <= 0) return '本人已不能继续行动。';
  if (s.playerPosition === 'ORIGINAL_ENTRY' && c.type !== 'LEAVE_ORIGINAL_COURT') return '须先从原室入口沿开放原门实际走四米到室外。';
  const e = cost(c, s);
  if (h.actions < e.actions || h.cash < e.cash || h.spirituality < e.spirituality || h.mind <= e.mind) return '本次行动、费用、灵性或精神不足；不会先扣费用。';
  if (s.status === 'COMPLETED' && c.type !== 'START_PRACTICE') return '本次报告已完成，保留所有实际结果。';
  if (s.status === 'ABORTED' && !CLEANUP.has(c.type)) return '本次已停止；先从实际位置沿普通侧路退出并收好货闸。';
  if (s.window && !windowCurrent(s, h) && !CLEANUP.has(c.type)) return '短窗已失效；先结束接触，已付费用保留。';
  if (['APPROACH', 'REMOVE_PIN', 'OPEN_SEGMENT', 'CROSS', 'ASK_WORKER', 'ARRIVE_WORKER', 'BUY_TOOLS', 'INSPECT_DEVICE', 'BIND_ROPE', 'APPLY_BINDING', 'MANUAL_INSPECTION', 'BEAR_IMPACT', 'MOVE_CARGO', 'SECURE_CARGO'].includes(c.type) && !permitted(s, h)) return '须先取得伯纳德对本周这次闸廊作业的新许可。';
  switch (c.type) {
    case 'LEAVE_ORIGINAL_COURT': return s.playerPosition !== 'ORIGINAL_ENTRY' || !!s.originalDepartureEventId ? '本人已经实际离开原室入口。' : null;
    case 'ASK_OWNER': return !settled(s) || !s.owner.alive || permitted(s, h) || s.phase === 'PREPARATION' && !!s.evacuationReportEventId ? '须先在廊外收好通路，再当面询问本次许可。' : null;
    case 'WITHDRAW_OWNER': return s.owner.consent !== 'GRANTED' ? '当前没有可撤回的许可。' : null;
    case 'INSPECT_EXIT': return s.playerPosition !== 'OUTSIDE' || !!s.exit.inspectedEventId ? '须在廊外查验尚未检查的普通侧门和连通各停靠点的侧路。' : null;
    case 'OPEN_EXIT': return !s.exit.inspectedEventId || s.exit.door === 'OPEN' ? '先查明普通侧路，再打开尚未开启的侧门。' : null;
    case 'CLOSE_EXIT': return !outside(s) || s.exit.door !== 'OPEN' ? '须所有人实际在廊外才能关闭侧门。' : null;
    case 'BUY_TOOLS': return s.playerPosition !== 'OUTSIDE' || !!s.toolsBoughtEventId ? '须在廊外领用尚未买过的普通拆销工具与绑带；旧工具不会重新收费。' : null;
    case 'APPROACH': return s.playerPosition !== 'OUTSIDE' || !s.exit.inspectedEventId || s.exit.door !== 'OPEN' ? '先查明并打开普通侧门，再亲走两米到入口。' : null;
    case 'WALK_EXIT': return ['OUTSIDE', 'ORIGINAL_ENTRY'].includes(s.playerPosition) || !s.exit.inspectedEventId || s.exit.door !== 'OPEN' ? '本人须在闸廊内，普通侧路已经查明且侧门开放。' : null;
    case 'INSPECT_SEGMENT': return !!s.segments[c.segment].inspectedEventId || s.playerPosition !== route(c.segment).from ? '须站在这段三米通道起点实际检查货闸与卡住的原销。' : null;
    case 'REMOVE_PIN': { const p = s.segments[c.segment]; return !p.inspectedEventId || p.pin.position !== 'INSERTED' || s.playerPosition !== route(c.segment).from || !s.toolsBoughtEventId || s.window ? '须在已查验货闸旁用实购工具拆下仍插在该闸的同一原销。' : null; }
    case 'OPEN_SEGMENT': return !s.segments[c.segment].inspectedEventId || s.segments[c.segment].pin.position === 'INSERTED' || s.segments[c.segment].open ? '须先亲查并实际拆下这道卡闸的原销，再拉动普通门索打开。' : null;
    case 'CLOSE_SEGMENT': return !s.segments[c.segment].open ? '这道货闸已经关闭。' : null;
    case 'CROSS': {
      const to = crossing(s, c), w = c.actorId === 'PLAYER' ? null : worker(s, c.actorId);
      if (!to || !s.segments[c.segment].inspectedEventId || !s.segments[c.segment].open || s.exit.door !== 'OPEN') return '须在已检查且开放的路段一端，并保留普通退路。';
      if (w) { const goods = s.cargo.find(x => x.carrierId === w.id); if (!w.alive || w.health <= 0 || w.consent !== 'GRANTED' || !w.paidEventId || !goods || goods.position !== w.position || !goods.secured) return '搬运者须仍自愿、已收工钱且与自己的真实货物同在这端。'; }
      return w && w.energy < 3 + CHAINED_EXIT_METRES[to] ? '余力不足以走完这三米并沿普通侧路退出。' : null;
    }
    case 'INSPECT_DEVICE': return s.playerPosition !== 'GATE' || !!s.device.inspectedEventId || s.window || s.segments.B.pin.position === 'INSERTED' || s.segments.B.pin.location !== 'GATE' ? '须本人带原销实际到检修台，亲查本轮轴销和眼前箱件。' : null;
    case 'ASK_WORKER': { const w = worker(s, c.workerId); return s.phase !== 'PREPARATION' || h.actions < 1 || s.playerPosition !== 'OUTSIDE' || !w || !w.alive || w.age < 18 || w.position !== 'OUTSIDE' || w.consent === 'GRANTED' || workerFinished(w) || !s.device.inspectedEventId || !s.toolsBoughtEventId || !s.segments.A.open || !s.segments.B.open || s.exit.door !== 'OPEN' || w.energy < 16 ? '先由本人完成两卡闸普通拆销与查验，打开退路，再在廊外独立征求成年搬运者同意并留足报告行动。' : null; }
    case 'WITHDRAW_WORKER': return worker(s, c.workerId)?.consent !== 'GRANTED' ? '这位搬运者当前没有作业同意。' : null;
    case 'ARRIVE_WORKER': { const w = worker(s, c.workerId), goods = s.cargo.find(x => x.carrierId === c.workerId); return s.phase !== 'PREPARATION' || !w || !w.alive || w.position !== 'OUTSIDE' || w.consent !== 'GRANTED' || !w.paidEventId || workerFinished(w) || w.energy < 16 || s.exit.door !== 'OPEN' || goods?.position !== 'OUTSIDE' ? '须本人自愿、已经收取工钱，携同一货物实际走到入口并保留完整退出余力。' : null; }
    case 'EXIT_WORKER': { const w = worker(s, c.workerId), goods = s.cargo.find(x => x.carrierId === c.workerId); return !w || !w.alive || w.health <= 0 || w.position === 'OUTSIDE' || goods?.position !== w.position || !s.exit.inspectedEventId || s.exit.door !== 'OPEN' || w.energy < CHAINED_EXIT_METRES[w.position] ? '须搬运者和同一货物仍在栈内，能沿开放的普通侧路实际退出。' : null; }
    case 'REPORT_EVACUATION': return s.phase !== 'PREPARATION' || !!s.evacuationReportEventId || !settled(s) || !delivered(s) || s.workers.some(w => !w.paidEventId) ? '须两人及各自货物分别走过两段并真实退出，最后收好全部通路。' : null;
    case 'START_PRACTICE': return h.sequence !== 0 || s.phase !== 'PREPARATION' || !s.evacuationReportEventId || !settled(s) ? '须本人已真实晋升，已有两人货物交接报告，并仍在廊外。' : null;
    case 'BIND_ROPE': case 'BEAR_IMPACT': {
      if (h.sequence !== 0 || s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || s.workers.some(w => w.position !== 'OUTSIDE') || !s.device.inspectedEventId || s.window || s.contact) return '须晋升后本人独自在已检查的检修台旁，两位搬运者仍在廊外，没有其他短窗。';
      if (c.type === 'BIND_ROPE') return !!s.device.loadFinishedEventId || !!s.rope.loadEventId || s.rope.integrity <= 0 || !s.segments.B.open || hasReceipt(s, 'BIND_ROPE') ? '须在后闸原绳旁、真实载荷尚未发生；这段原绳本轮只可开启一次短窗。' : null;
      const goods = box(s); return hasReceipt(s, 'BEAR_IMPACT') || !!s.device.cargoFinishedEventId || !goods.visible || goods.position !== 'GATE' || goods.secured || !!goods.movedEventId ? '须眼前同一箱件的滑动方向已经查明、尚未固定或移动，下一次冲击只落在本人。' : null;
    }
    case 'APPLY_BINDING': return s.phase !== 'PRACTICE' || !!s.device.loadFinishedEventId || s.window?.kind !== 'LOCAL_BINDING' || !windowCurrent(s, h, e.seconds) ? '须持续接触同一原绳，在有效短窗内实际下放后闸原有重量。' : null;
    case 'MANUAL_INSPECTION': return !s.segments.B.open || !!s.rope.loadEventId || s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || !s.device.inspectedEventId || !s.toolsBoughtEventId || !!s.device.loadFinishedEventId || s.window || s.contact ? '须本人在后闸原绳旁结束短窗，用既有绞盘和支撑完成这一次受控下放。' : null;
    case 'SECURE_CARGO': return s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || !s.device.inspectedEventId || !s.toolsBoughtEventId || box(s).secured || !!box(s).movedEventId || s.window || s.contact ? '须在已看清的箱件旁结束短窗，以既有绑带普通固定尚未搬过的同一箱件。' : null;
    case 'MOVE_CARGO': return s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || !s.device.inspectedEventId || !!s.device.cargoFinishedEventId || !box(s).visible || box(s).position !== 'GATE' || s.workers.some(w => w.position !== 'OUTSIDE') || (s.window ? s.window.kind !== 'IMPACT_BURDEN' || !windowCurrent(s, h, e.seconds) : s.contact || !box(s).secured) ? '须本人在检修台，以有效单次承担短窗或实际普通固定搬动眼前同一箱件一米。' : null;
    case 'END_CONTACT': return !s.window && !s.contact ? '当前已经没有短窗或接触。' : null;
    case 'STOP_METHOD': return s.status === 'ABORTED' && !s.window && !s.contact && s.owner.consent !== 'GRANTED' && s.workers.every(w => w.consent !== 'GRANTED') ? '已经停止；仍须从各自位置普通退出。' : null;
    case 'WAIT_10': return !s.window ? '当前没有需要等待的短窗。' : null;
    case 'REPORT_RETURN': return s.phase !== 'PRACTICE' || !!s.returnReportEventId || !settled(s) || s.status !== 'ABORTED' && (!s.device.loadFinishedEventId || !s.device.cargoFinishedEventId) ? '须本人真实退出并关好通路；完成拆检搬运，或如实报告本次已经停止。' : null;
    default: return '当前没有这项现场行动。';
  }
}
function receipt(s: ChainedScene, h: ChainedSceneHost, kind: string, actorId = 'PLAYER', position = s.playerPosition): void {
  s.receipts.push({ eventId: h.eventId, kind, actorId, position, targetVersion: s.segments.B.pin.version });
}
function endWindow(s: ChainedScene, h: ChainedSceneHost, reason: string): void { if (s.window || s.contact) receipt(s, h, reason); s.window = null; s.contact = false; }
function closeConsent(s: ChainedScene): void {
  if (s.owner.consent === 'GRANTED') { s.owner.consent = 'CLOSED'; s.owner.permissionVersion++; }
  for (const w of s.workers) if (w.consent === 'GRANTED') { w.consent = 'CLOSED'; w.permissionVersion++; }
}
function move(s: ChainedScene, h: ChainedSceneHost, actorId: 'PLAYER' | ChainedWorkerId, to: ChainedPosition, metres: number): void {
  const w = actorId === 'PLAYER' ? null : worker(s, actorId)!, from = w ? w.position : s.playerPosition;
  const goods = w ? s.cargo.find(c => c.carrierId === w.id)! : null;
  if (w) { w.position = to; w.energy -= metres; w.walkedMetres += metres; goods!.position = to; goods!.travelMetres += metres; goods!.version++; }
  else { endWindow(s, h, 'MOVEMENT_ENDED_WINDOW'); s.playerPosition = to; s.playerTravelMetres += metres; for (const segment of Object.values(s.segments)) if (segment.pin.position === 'PLAYER') { segment.pin.location = to; segment.pin.travelMetres += metres; segment.pin.version++; } }
  s.moves.push({ eventId: h.eventId, actorId, from, to, metres, seconds: metres, cargoId: goods?.id ?? null });
}
export function applyChainedScene(scene: ChainedScene, command: ChainedCommand, host: ChainedSceneHost, check: (ability: PublicCoreStatKey, difficulty: number) => PublicCheckResult): { state: ChainedScene; effect: ChainedEffect; notes: string[] } {
  const blocked = chainedSceneBlock(scene, command, host); if (blocked) throw Error(blocked);
  const s = structuredClone(scene), c = command, h = host, e = cost(c, s), notes: string[] = [];
  switch (c.type) {
    case 'LEAVE_ORIGINAL_COURT': move(s, h, 'PLAYER', 'OUTSIDE', 4); s.originalDepartureEventId = h.eventId; notes.push('本人沿开放原门亲走四米到室外；埃尔莎、哈伦、原衣包盘纸、耗尽旧块，以及罗德里克的投降和旧伤保持原状。'); break;
    case 'ASK_OWNER': s.status = 'ACTIVE'; s.owner.consent = 'GRANTED'; s.owner.permissionVersion++; s.owner.permissionWeek = h.week; s.owner.permissionEventId = h.eventId; notes.push('42岁的伯纳德在闸廊外当面同意本周这次作业；任何人仍可撤回。'); break;
    case 'WITHDRAW_OWNER': s.owner.consent = 'WITHDRAWN'; s.owner.permissionVersion++; s.status = 'ABORTED'; endWindow(s, h, 'OWNER_WITHDREW'); notes.push('伯纳德撤回本次许可，所有人在实际位置停止作业，普通侧路仍可退出。'); break;
    case 'INSPECT_EXIT': s.exit.inspectedEventId = h.eventId; notes.push('实际查明普通绞盘与承重支撑，以及连通入口、中段和检修台的侧路；即使两闸关闭也能普通走出。'); break;
    case 'OPEN_EXIT': s.exit.door = 'OPEN'; notes.push('手动打开已检查的普通侧门。'); break;
    case 'CLOSE_EXIT': s.exit.door = 'CLOSED'; notes.push('确认所有人已在廊外，手动关闭侧门。'); break;
    case 'BUY_TOOLS': s.toolsBoughtEventId = h.eventId; notes.push('实付30便士领用一套普通拆销工具、夹具与绑带，后续仍使用同一套。'); break;
    case 'APPROACH': move(s, h, 'PLAYER', 'ENTRY', 2); notes.push('本人从廊外实际走两米到入口。'); break;
    case 'WALK_EXIT': { const metres = CHAINED_EXIT_METRES[s.playerPosition]; move(s, h, 'PLAYER', 'OUTSIDE', metres); notes.push(`本人沿普通侧路走${metres}米到廊外，短窗已结束。`); break; }
    case 'INSPECT_SEGMENT': s.segments[c.segment].inspectedEventId = h.eventId; notes.push(`在起点实际检查${c.segment}段三米通道及卡住这道货闸的原轴销。`); break;
    case 'REMOVE_PIN': { const p = s.segments[c.segment].pin; p.position = 'PLAYER'; p.location = s.playerPosition; p.wear++; p.version++; p.removedEventId = h.eventId; notes.push(`以普通工具拆下${c.segment}闸同一枚原销并实际拿在手中，磨损加一；货闸仍须另行打开。`); break; }
    case 'OPEN_SEGMENT': s.segments[c.segment].open = true; notes.push(`用普通绞盘拉起并支撑已查明的${c.segment}段货闸。`); break;
    case 'CLOSE_SEGMENT': s.segments[c.segment].open = false; notes.push(`拉动普通门索关闭${c.segment}段货闸，侧路仍保留。`); break;
    case 'CROSS': { const to = crossing(s, c)!; move(s, h, c.actorId, to, 3); if (c.actorId !== 'PLAYER' && to === route(c.segment).to) { worker(s, c.actorId)!.passage[c.segment === 'A' ? 'a' : 'b'] = h.eventId; s.cargo.find(x => x.carrierId === c.actorId)!.passage[c.segment === 'A' ? 'a' : 'b'] = h.eventId; } notes.push(`${c.actorId === 'PLAYER' ? '本人' : worker(s, c.actorId)!.name + '携同一货物'}实际走过${c.segment}段三米。`); break; }
    case 'INSPECT_DEVICE': s.device.inspectedEventId = h.eventId; for (const segment of Object.values(s.segments)) if (segment.pin.position === 'PLAYER' && segment.pin.location === 'GATE') { segment.pin.position = 'BENCH'; segment.pin.version++; } box(s).visible = true; notes.push('在检修台放下实持原销，查明后闸同一原绳、绞盘与支撑。原闸下放时的原有重量将使绳滑动八厘米；眼前箱件下一米搬运会对本人产生八健康冲击，两种载荷都只处理一次。'); break;
    case 'ASK_WORKER': { const w = worker(s, c.workerId)!; w.consent = 'GRANTED'; w.permissionVersion++; w.permissionEventId = h.eventId; w.paidEventId ??= h.eventId; notes.push(`${w.name}独立同意本班搬运${e.cash ? '，实收20便士工钱' : '；已收本班工钱不再重复支付'}，仍在廊外。`); break; }
    case 'WITHDRAW_WORKER': { const w = worker(s, c.workerId)!; w.consent = 'WITHDRAWN'; w.permissionVersion++; s.status = 'ABORTED'; endWindow(s, h, 'WORKER_WITHDREW'); notes.push(`${w.name}撤回作业同意，本人和货物留在实际位置，可直接走普通侧路退出。`); break; }
    case 'ARRIVE_WORKER': { const w = worker(s, c.workerId)!; move(s, h, w.id, 'ENTRY', 2); w.arrivalEventId = h.eventId; w.passage.exit = null; s.cargo.find(x => x.carrierId === w.id)!.passage.exit = null; notes.push(`${w.name}携同一货物实际走两米到入口，消耗两点精力。`); break; }
    case 'EXIT_WORKER': { const w = worker(s, c.workerId)!, metres = CHAINED_EXIT_METRES[w.position]; move(s, h, w.id, 'OUTSIDE', metres); w.passage.exit = h.eventId; s.cargo.find(x => x.carrierId === w.id)!.passage.exit = h.eventId; if (w.consent === 'GRANTED') { w.consent = 'CLOSED'; w.permissionVersion++; } if (!w.passage.a || !w.passage.b) s.status = 'ABORTED'; notes.push(`${w.name}携同一货物沿普通侧路走${metres}米退出，消耗同量精力；没有移动另一人或另一份货物。`); break; }
    case 'REPORT_EVACUATION': s.evacuationReportEventId = h.eventId; s.status = 'COMPLETED'; closeConsent(s); notes.push('逐一核实两位成人和两份货物的两段通行与普通退出，保留实际工钱、精力、路程和原销磨损。'); break;
    case 'START_PRACTICE': s.phase = 'PRACTICE'; s.status = 'ACTIVE'; closeConsent(s); s.device.inspectedEventId = null; notes.push('本人开始一轮独立检修；两位成年人均已结束同意并留在廊外。仍用同一后闸原绳与原箱件，须重新询问场地许可并检查，不新增测试载荷。'); break;
    case 'BIND_ROPE': case 'BEAR_IMPACT': { const binding = c.type === 'BIND_ROPE', target = binding ? s.rope : box(s); s.contact = binding; s.window = { kind: binding ? 'LOCAL_BINDING' : 'IMPACT_BURDEN', actorId: h.actorId, startPosition: 'GATE', targetId: target.id, targetVersion: target.version, permissionVersion: s.owner.permissionVersion, createdAt: h.second + e.seconds, expiresAt: h.second + e.seconds + 20 }; notes.push(`实付1行动、12灵性与5精神，开启二十秒${binding ? '持续接触后闸同一原绳' : '只承担本人下一次已见箱件冲击'}的单次短窗，实际载荷尚未发生。`); break; }
    case 'APPLY_BINDING': { const result = check('will', CHAINED_PRACTICE_COSTS.binding.difficulty), success = ['SUCCESS', 'GREAT_SUCCESS'].includes(result.tier); s.rope.loadEventId = h.eventId; s.rope.dropCentimetres = success ? 3 : 8; s.rope.wear++; s.rope.integrity--; s.rope.version++; s.device.loadFinishedEventId = h.eventId; s.device.loadMethod = 'ABILITY'; if (success) { s.bindingApplied = true; e.mastery = [CHAINED_ABILITY_IDS[0]]; notes.push('亲手用绞盘受控下放原闸，其原有重量真实拉动同一绳段。局部束缚把这一次滑动从八厘米限制到三厘米，原绳磨损加一、完整度减一，支撑接住闸体。'); } else { e.mind += 2; notes.push('亲手下放时局部束缚未能抵住原闸重量，绳真实滑动八厘米后由普通支撑接住；原绳磨损加一、完整度减一，额外损耗2精神。这次载荷已经发生，不会重新制造一次。'); } endWindow(s, h, 'BINDING_SPENT'); break; }
    case 'MANUAL_INSPECTION': s.rope.loadEventId = h.eventId; s.rope.dropCentimetres = 8; s.rope.wear++; s.rope.integrity--; s.rope.version++; s.device.loadFinishedEventId = h.eventId; s.device.loadMethod = 'ORDINARY'; notes.push('用既有普通绞盘与支撑下放同一后闸，绳真实移动八厘米后支撑接住；留下原绳磨损，不增加未应用技巧的掌握。'); break;
    case 'SECURE_CARGO': box(s).secured = true; box(s).version++; notes.push('用既有夹具与绑带实际固定眼前同一箱件，随后普通搬运不产生该次滑动冲击。'); break;
    case 'MOVE_CARGO': { const goods = box(s), ability = s.window?.kind === 'IMPACT_BURDEN'; let success = false; if (ability) { const result = check('perception', CHAINED_PRACTICE_COSTS.impactBurden.difficulty); success = ['SUCCESS', 'GREAT_SUCCESS'].includes(result.tier); e.health = success ? 3 : 8; if (!success) e.mind += 2; } goods.offsetMetres++; goods.travelMetres++; goods.version++; goods.movedEventId = h.eventId; s.device.cargoFinishedEventId = h.eventId; s.device.cargoMethod = ability ? 'ABILITY' : 'ORDINARY'; s.playerTravelMetres++; s.moves.push({ eventId: h.eventId, actorId: 'PLAYER', from: 'GATE', to: 'GATE', metres: 1, seconds: 2, cargoId: goods.id }); if (success) { s.impactBurdenApplied = true; e.mastery = [CHAINED_ABILITY_IDS[1]]; } endWindow(s, h, 'KNOWN_IMPACT_SPENT'); notes.push(ability ? `本人搬动眼前同一箱件一米，实际承受${e.health}健康冲击${success ? '；有限冲击承担仅减轻本人这一次冲击' : '；检定失败并额外损耗2精神，未增加掌握'}。` : '固定后的同一箱件被本人普通搬动一米，没有该次滑动冲击，也不增加未应用技巧掌握。'); break; }
    case 'END_CONTACT': endWindow(s, h, 'CONTACT_ENDED'); notes.push('在原位置松手结束短窗，保留已付行动、灵性与精神。'); break;
    case 'STOP_METHOD': endWindow(s, h, 'METHOD_STOPPED'); closeConsent(s); s.status = 'ABORTED'; notes.push('停止本次作业并结束当次许可，全部实际费用与位置保留，仍须逐人普通退出。'); break;
    case 'WAIT_10': notes.push('实际等待十秒，短窗不续期。'); break;
    case 'REPORT_RETURN': s.returnReportEventId = h.eventId; closeConsent(s); s.status = 'COMPLETED'; notes.push('如实报告本人本轮拆检搬运或停止，以及普通实际返程；仅保留确实应用成功的技巧掌握。'); break;
  }
  receipt(s, h, c.type);
  if (s.window && !windowCurrent(s, { ...h, second: h.second + e.seconds })) { endWindow(s, h, 'WINDOW_EXPIRED'); notes.push('短窗到期或条件改变而结束，已付费用保留。'); }
  return { state: s, effect: e, notes };
}

/** Static next-action selection: it does not simulate, charge, or roll. */
export function desiredChainedSceneCommand(s: ChainedScene, h: ChainedSceneHost): ChainedCommand | null {
  const cleanup = (): ChainedCommand | null => {
    if (s.window || s.contact) return { type: 'END_CONTACT' };
    if (!outside(s)) { if (s.exit.door !== 'OPEN') return { type: 'OPEN_EXIT' }; const w = s.workers.find(x => x.position !== 'OUTSIDE'); return w ? { type: 'EXIT_WORKER', workerId: w.id } : { type: 'WALK_EXIT' }; }
    if (s.segments.B.open) return { type: 'CLOSE_SEGMENT', segment: 'B' };
    if (s.segments.A.open) return { type: 'CLOSE_SEGMENT', segment: 'A' };
    return s.exit.door === 'OPEN' ? { type: 'CLOSE_EXIT' } : null;
  };
  if (s.playerPosition === 'ORIGINAL_ENTRY') return { type: 'LEAVE_ORIGINAL_COURT' };
  if (s.returnReportEventId) return null;
  if (s.phase === 'PREPARATION' && s.evacuationReportEventId) return h.sequence === 0 ? { type: 'START_PRACTICE' } : null;
  if (s.window) { const c: ChainedCommand = { type: s.window.kind === 'LOCAL_BINDING' ? 'APPLY_BINDING' : 'MOVE_CARGO' }; return !chainedSceneBlock(s, c, h) ? c : { type: 'END_CONTACT' }; }
  if (s.status === 'ABORTED' || s.phase === 'PREPARATION' && delivered(s) || s.phase === 'PRACTICE' && !!s.device.loadFinishedEventId && !!s.device.cargoFinishedEventId) {
    const next = cleanup(); if (next) return next;
    if (h.actions < 1 && (s.owner.consent === 'GRANTED' || s.workers.some(w => w.consent === 'GRANTED'))) return { type: 'STOP_METHOD' };
    if (s.phase === 'PRACTICE' || delivered(s)) return h.actions < 1 ? { type: 'NEXT_WEEK' } : { type: s.phase === 'PRACTICE' ? 'REPORT_RETURN' : 'REPORT_EVACUATION' };
    return { type: 'ASK_OWNER' };
  }
  if (!permitted(s, h)) {
    if (!settled(s)) return { type: 'STOP_METHOD' };
    if (h.actions < 1) return { type: 'NEXT_WEEK' };
    const needed = s.workers.filter(w => !w.paidEventId).length * 20 + (s.toolsBoughtEventId ? 0 : 30);
    if (h.cash < needed) return { type: 'WORK' };
    return { type: 'ASK_OWNER' };
  }
  if (!s.exit.inspectedEventId) return { type: 'INSPECT_EXIT' };
  if (!s.toolsBoughtEventId) return { type: 'BUY_TOOLS' };
  if (s.exit.door !== 'OPEN') return { type: 'OPEN_EXIT' };
  if (!s.device.inspectedEventId) {
    if (s.playerPosition === 'OUTSIDE') return { type: 'APPROACH' };
    if (s.playerPosition === 'ENTRY' || s.playerPosition === 'MIDPOINT') { const segment = s.playerPosition === 'ENTRY' ? 'A' : 'B', p = s.segments[segment]; return !p.inspectedEventId ? { type: 'INSPECT_SEGMENT', segment } : p.pin.position === 'INSERTED' ? { type: 'REMOVE_PIN', segment } : !p.open ? { type: 'OPEN_SEGMENT', segment } : { type: 'CROSS', actorId: 'PLAYER', segment }; }
    return { type: 'INSPECT_DEVICE' };
  }
  if (s.phase === 'PREPARATION') {
    if (!s.segments.A.open) return { type: 'OPEN_SEGMENT', segment: 'A' };
    if (!s.segments.B.open) return { type: 'OPEN_SEGMENT', segment: 'B' };
    if (s.playerPosition !== 'OUTSIDE') return { type: 'WALK_EXIT' };
    const w = s.workers.find(x => !workerFinished(x)); if (!w) return { type: 'STOP_METHOD' };
    if (w.consent !== 'GRANTED') return { type: 'ASK_WORKER', workerId: w.id };
    if (w.position === 'OUTSIDE') return { type: 'ARRIVE_WORKER', workerId: w.id };
    if (w.position === 'GATE') return { type: 'EXIT_WORKER', workerId: w.id };
    const segment = w.position === 'ENTRY' ? 'A' : 'B'; return !s.segments[segment].open ? { type: 'OPEN_SEGMENT', segment } : { type: 'CROSS', actorId: w.id, segment };
  }
  if (!s.device.loadFinishedEventId) {
    const ability: ChainedCommand = { type: 'BIND_ROPE' };
    return !hasReceipt(s, 'BIND_ROPE') && h.actions >= 2 && !chainedSceneBlock(s, ability, h) ? ability : { type: 'MANUAL_INSPECTION' };
  }
  if (!s.device.cargoFinishedEventId) {
    const ability: ChainedCommand = { type: 'BEAR_IMPACT' };
    if (!hasReceipt(s, 'BEAR_IMPACT') && h.actions >= 2 && !chainedSceneBlock(s, ability, h)) return ability;
    return box(s).secured ? { type: 'MOVE_CARGO' } : { type: 'SECURE_CARGO' };
  }
  return cleanup();
}
function label(c: ChainedCommand): string {
  if ('workerId' in c) return `${CHAINED_WORKERS.find(w => w.id === c.workerId)!.name}${c.type === 'ASK_WORKER' ? '独立同意并核付本班工钱' : c.type === 'WITHDRAW_WORKER' ? '撤回作业同意' : c.type === 'ARRIVE_WORKER' ? '携货亲走两米到入口' : '携同一货物沿普通侧路退出'}`;
  if (c.type === 'CROSS') return `${c.actorId === 'PLAYER' ? '本人' : CHAINED_WORKERS.find(w => w.id === c.actorId)!.name + '携同一货物'}亲走${c.segment}段三米`;
  if ('segment' in c) return `${c.type === 'INSPECT_SEGMENT' ? '亲查' : c.type === 'REMOVE_PIN' ? '以普通工具拆下原销，释放' : c.type === 'OPEN_SEGMENT' ? '打开' : '关闭'}${c.segment}段卡闸`;
  const labels: Partial<Record<ChainedCommand['type'], string>> = { LEAVE_ORIGINAL_COURT: '沿原门亲走四米到原室外', ASK_OWNER: '当面询问伯纳德本周本次作业许可', WITHDRAW_OWNER: '伯纳德撤回本次作业许可', INSPECT_EXIT: '查明普通侧门与各处退路', OPEN_EXIT: '打开普通侧门', CLOSE_EXIT: '所有人退出后关闭侧门', BUY_TOOLS: '实购一套普通工具与绑带', APPROACH: '本人亲走两米到闸廊入口', WALK_EXIT: '本人沿普通侧路实际退出', INSPECT_DEVICE: '亲查后闸原绳、实际载荷与可见箱件', REPORT_EVACUATION: '报告两人两份货物的真实通行退出', START_PRACTICE: '本人开始独立检修搬运', BIND_ROPE: '实付开启局部束缚', APPLY_BINDING: '在短窗内实际下放原闸重量', MANUAL_INSPECTION: '用普通绞盘与支撑下放原闸', BEAR_IMPACT: '实付承担本人下一次已见箱件冲击', SECURE_CARGO: '普通夹具绑带固定同一箱件', MOVE_CARGO: '本人实际搬动同一箱件一米', END_CONTACT: '结束当前短窗并松手', WAIT_10: '实际等待十秒', STOP_METHOD: '停止本次作业并保留成本', REPORT_RETURN: '如实报告本轮检修搬运与返程' };
  return labels[c.type] ?? '继续实际行动';
}
export function chainedSceneActions(s: ChainedScene, h: ChainedSceneHost): { command: ChainedCommand; label: string; cost: string }[] {
  const commands: ChainedCommand[] = [], add = (c: ChainedCommand) => { if (isChainedSceneCommand(c) && !commands.some(x => stableStringify(x) === stableStringify(c))) commands.push(c); };
  const next = desiredChainedSceneCommand(s, h); if (next) add(next);
  if (s.status !== 'COMPLETED') {
    if (s.window || s.contact) { add({ type: 'END_CONTACT' }); if (s.window) add({ type: 'WAIT_10' }); }
    if (!['OUTSIDE', 'ORIGINAL_ENTRY'].includes(s.playerPosition)) add({ type: 'WALK_EXIT' });
    if (s.exit.inspectedEventId && s.exit.door === 'CLOSED') add({ type: 'OPEN_EXIT' });
    for (const w of s.workers) { if (w.position !== 'OUTSIDE') add({ type: 'EXIT_WORKER', workerId: w.id }); if (w.consent === 'GRANTED') add({ type: 'WITHDRAW_WORKER', workerId: w.id }); }
    if (s.owner.consent === 'GRANTED') add({ type: 'WITHDRAW_OWNER' });
    if (s.status === 'ACTIVE') add({ type: 'STOP_METHOD' });
    if (s.status === 'ABORTED' && settled(s)) add({ type: 'ASK_OWNER' });
    if (s.phase === 'PRACTICE' && s.playerPosition === 'GATE' && !s.window) for (const type of ['BIND_ROPE', 'MANUAL_INSPECTION', 'BEAR_IMPACT', 'SECURE_CARGO', 'MOVE_CARGO'] as const) if (!chainedSceneBlock(s, { type }, h)) add({ type });
  }
  return commands.map(c => { const e = cost(c, s); return { command: c, label: label(c), cost: [`${e.actions}行动`, ...(e.cash ? [`${e.cash}便士`] : []), ...(e.spirituality ? [`${e.spirituality}灵性`] : []), ...(e.mind ? [`${e.mind}精神`] : []), ...(c.type === 'MOVE_CARGO' && s.window ? ['成功减3健康，失败减8健康并减2精神'] : []), `${e.seconds}秒`].join(' · ') }; });
}
