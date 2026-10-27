import { stableStringify } from '../canonical.js';
import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import { JUSTICIAR_ABILITY_IDS, JUSTICIAR_EXIT_METRES, JUSTICIAR_PRACTICE_COSTS, JUSTICIAR_PRICES, JUSTICIAR_WORKERS, type JusticiarPosition, type JusticiarSegmentId, type JusticiarWorkerId } from './content.js';
import type { JusticiarCommand, JusticiarEffect, JusticiarScene, JusticiarSceneHost, JusticiarSource, JusticiarCargo } from './types.js';

const SCENE_COMMANDS = new Set(['LEAVE_ORIGINAL_COURT', 'ASK_OWNER', 'WITHDRAW_OWNER', 'APPROACH', 'INSPECT_EXIT', 'INSPECT_DEVICE', 'BUY_TOOLS', 'OPEN_EXIT', 'CLOSE_EXIT', 'ASK_WORKER', 'WITHDRAW_WORKER', 'ARRIVE_WORKER', 'EXIT_WORKER', 'INSPECT_SEGMENT', 'REMOVE_PIN', 'OPEN_SEGMENT', 'CLOSE_SEGMENT', 'CROSS', 'REPORT_EVACUATION', 'START_PRACTICE', 'CONSTRAIN_GATE', 'APPLY_CONSTRAINT', 'MANUAL_INSPECTION', 'DECLARE_ACTION', 'PRIORITIZE_ACTION', 'RESIST_PRIORITY', 'MOVE_CARGO', 'SECURE_CARGO', 'STOP_METHOD', 'END_CONTACT', 'WAIT_10', 'WALK_EXIT', 'REPORT_RETURN']);
const CLEANUP = new Set(['STOP_METHOD', 'END_CONTACT', 'WAIT_10', 'WITHDRAW_OWNER', 'WITHDRAW_WORKER', 'OPEN_EXIT', 'CLOSE_EXIT', 'EXIT_WORKER', 'WALK_EXIT', 'CLOSE_SEGMENT', 'REPORT_RETURN', 'REPORT_EVACUATION', 'ASK_OWNER', 'RESIST_PRIORITY']);
const worker = (s: JusticiarScene, id: JusticiarWorkerId) => s.workers.find(w => w.id === id);
const box = (s: JusticiarScene) => s.cargo.find(c => c.id === 'JU228-MAINTENANCE-BOX')!;
const permitted = (s: JusticiarScene, h: JusticiarSceneHost) => s.owner.alive && s.owner.consent === 'GRANTED' && s.owner.permissionWeek === h.week && !!s.owner.permissionEventId;
const outside = (s: JusticiarScene) => s.playerPosition === 'OUTSIDE' && s.owner.position === 'OUTSIDE' && s.workers.every(w => w.position === 'OUTSIDE');
const settled = (s: JusticiarScene) => outside(s) && !s.window && !s.contact && !s.segments.A.open && !s.segments.B.open && s.exit.door === 'CLOSED';
const workerFinished = (w: JusticiarScene['workers'][number]) => !!w.passage.a && !!w.passage.b && !!w.passage.exit;
const delivered = (s: JusticiarScene) => s.workers.every(workerFinished) && s.cargo.filter(c => c.carrierId !== 'PLAYER').every(c => c.position === 'OUTSIDE' && !!c.passage.a && !!c.passage.b && !!c.passage.exit);
const hasReceipt = (s: JusticiarScene, kind: string) => s.receipts.some(r => r.kind === kind);
const route = (segment: JusticiarSegmentId): { from: JusticiarPosition; to: JusticiarPosition } => segment === 'A' ? { from: 'ENTRY', to: 'MIDPOINT' } : { from: 'MIDPOINT', to: 'GATE' };
function crossing(s: JusticiarScene, c: Extract<JusticiarCommand, { type: 'CROSS' }>): JusticiarPosition | null {
  const at = c.actorId === 'PLAYER' ? s.playerPosition : worker(s, c.actorId)?.position, path = route(c.segment);
  return at === path.from ? path.to : at === path.to ? path.from : null;
}
function windowCurrent(s: JusticiarScene, h: JusticiarSceneHost, seconds = 0): boolean {
  const w = s.window;
  if (!w || w.actorId !== h.actorId || w.startPosition !== s.playerPosition || w.permissionVersion !== s.owner.permissionVersion || !permitted(s, h) || h.second < w.createdAt || h.second + seconds >= w.expiresAt || s.workers.some(x => x.position !== 'OUTSIDE')) return false;
  if (w.kind === 'GATE_CONSTRAINT') { const rope = s.gate; return s.contact && w.targetId === rope.id && w.targetVersion === rope.version && rope.location === 'GATE' && rope.integrity > 0 && !rope.loadEventId && s.segments.B.open; }
  const c = box(s), pending = s.pending; return !!pending && pending.id === w.pendingId && pending.actorId === h.actorId && pending.status === 'PENDING' && pending.cargoVersion === c.version && pending.position === s.playerPosition && !s.contact && w.targetId === c.id && w.targetVersion === c.version && c.visible && c.position === 'GATE' && !c.secured && !c.movedEventId;
}
function cost(c: JusticiarCommand, s: JusticiarScene): JusticiarEffect {
  const e: JusticiarEffect = { actions: 0, cash: 0, spirituality: 0, mind: 0, health: 0, seconds: 1 };
  if (c.type === 'ASK_WORKER' && !worker(s, c.workerId)?.paidEventId) e.cash = JUSTICIAR_PRICES.workerService;
  if (c.type === 'BUY_TOOLS') e.cash = JUSTICIAR_PRICES.ordinaryTools;
  if (['INSPECT_EXIT', 'INSPECT_SEGMENT', 'INSPECT_DEVICE', 'REMOVE_PIN', 'MANUAL_INSPECTION', 'SECURE_CARGO'].includes(c.type)) e.seconds = 30;
  if (c.type === 'REPORT_EVACUATION' || c.type === 'REPORT_RETURN') { e.actions = 1; e.seconds = 30; }
  if (c.type === 'CONSTRAIN_GATE' || c.type === 'PRIORITIZE_ACTION') { e.actions = 1; e.spirituality = 12; e.mind = 5; }
  if (c.type === 'APPLY_CONSTRAINT' || c.type === 'MOVE_CARGO') e.seconds = 2;
  if (c.type === 'MOVE_CARGO') e.seconds = 8;
  if (['APPROACH', 'ARRIVE_WORKER'].includes(c.type)) e.seconds = 2;
  if (c.type === 'LEAVE_ORIGINAL_COURT') e.seconds = 4;
  if (c.type === 'CROSS') e.seconds = 3;
  if (c.type === 'WALK_EXIT') e.seconds = JUSTICIAR_EXIT_METRES[s.playerPosition];
  if (c.type === 'EXIT_WORKER') e.seconds = JUSTICIAR_EXIT_METRES[worker(s, c.workerId)?.position ?? 'OUTSIDE'];
  if (c.type === 'WAIT_10') e.seconds = 10;
  return e;
}
export function createJusticiarScene(source: JusticiarSource): JusticiarScene {
  const site = source.originals.site, operation = source.originals.operation;
  if (!site.volunteer.alive || site.volunteer.location !== 'OUTSIDE' || site.guide.location !== 'OUTSIDE' || !['START', 'OUTSIDE'].includes(site.playerLocation) || operation.truth !== null || operation.effect !== null || operation.pending !== null || operation.division !== null || operation.aftermath !== null) throw Error('须先收好原练习室的实际作用，让薇娜和米拉真实退出。');
  const pin = (segment: JusticiarSegmentId) => ({ inspectedEventId: null, open: false, pin: { id: `JU228-ORIGINAL-PIN-${segment}`, position: 'INSERTED' as const, location: route(segment).from, travelMetres: 0, integrity: 100, wear: 0, version: 0, removedEventId: null } });
  const cargo = (id: JusticiarCargo['id'], carrierId: JusticiarCargo['carrierId'], position: JusticiarPosition): JusticiarCargo => ({ id, ownerId: carrierId, carrierId, position, travelMetres: 0, version: 0, visible: carrierId !== 'PLAYER', secured: carrierId !== 'PLAYER', offsetMetres: 0, movedEventId: null, passage: { a: null, b: null, exit: null } });
  return { phase: 'PREPARATION', status: 'ACTIVE', playerPosition: site.playerLocation === 'START' ? 'ORIGINAL_ENTRY' : 'OUTSIDE', playerTravelMetres: site.playerTravelMetres, originalDepartureEventId: null,
    owner: { id: 'JU228-KEEPER', name: '路易斯', age: 42, alive: true, position: 'OUTSIDE', consent: 'CLOSED', permissionVersion: 0, permissionWeek: null, permissionEventId: null },
    workers: JUSTICIAR_WORKERS.map(w => ({ ...w, alive: true, health: 100, energy: 80, position: 'OUTSIDE', walkedMetres: 0, consent: 'UNASKED', permissionVersion: 0, permissionEventId: null, paidEventId: null, arrivalEventId: null, passage: { a: null, b: null, exit: null } })),
    cargo: [cargo('JU228-CARGO-ADA', 'JU228-ADA', 'OUTSIDE'), cargo('JU228-CARGO-SIMON', 'JU228-SIMON', 'OUTSIDE'), cargo('JU228-MAINTENANCE-BOX', 'PLAYER', 'GATE')],
    originalOperation: structuredClone(operation), originalGuardPlate: { ...structuredClone(source.originals.guardPlate), location: site.playerLocation === 'START' ? 'ORIGINAL_ENTRY' : 'OUTSIDE' },
    segments: { A: pin('A'), B: pin('B') }, exit: { inspectedEventId: null, door: 'CLOSED' }, toolsBoughtEventId: null,
    device: { inspectedEventId: null, loadFinishedEventId: null, cargoFinishedEventId: null, loadMethod: 'NONE', cargoMethod: 'NONE' },
    gate: { id: 'JU228-ORIGINAL-GATE-B', location: 'GATE', integrity: 100, wear: 0, version: 0, loadEventId: null, dropCentimetres: 0 },
    supportPads: { initial: 2, remaining: 0, spentEventIds: [] }, pending: null,
    contact: false, window: null, moves: [], receipts: [], evacuationReportEventId: null, returnReportEventId: null, constraintApplied: false, priorityApplied: false };
}
export const isJusticiarSceneCommand = (c: JusticiarCommand): boolean => SCENE_COMMANDS.has(c.type);
export const justiciarSceneInside = (s: JusticiarScene): boolean => !settled(s) || s.owner.consent === 'GRANTED' || s.workers.some(w => w.consent === 'GRANTED');

export function justiciarSceneBlock(s: JusticiarScene, c: JusticiarCommand, h: JusticiarSceneHost): string | null {
  if (!isJusticiarSceneCommand(c)) return '这不是码头的现场行动。';
  if (h.health <= 0 || h.mind <= 0) return '本人已不能继续行动。';
  if (s.playerPosition === 'ORIGINAL_ENTRY' && c.type !== 'LEAVE_ORIGINAL_COURT') return '须先从原室入口沿开放原门实际走四米到室外。';
  const e = cost(c, s);
  if (h.actions < e.actions || h.cash < e.cash || h.spirituality < e.spirituality || h.mind <= e.mind) return '本次行动、费用、灵性或精神不足；不会先扣费用。';
  if (s.status === 'COMPLETED' && c.type !== 'START_PRACTICE') return '本次报告已完成，保留所有实际结果。';
  if (s.status === 'ABORTED' && !CLEANUP.has(c.type)) return '本次已停止；先从实际位置沿普通侧路退出并收好货闸。';
  if (s.window && !windowCurrent(s, h) && !CLEANUP.has(c.type)) return '短窗已失效；先结束接触，已付费用保留。';
  if (['APPROACH', 'REMOVE_PIN', 'OPEN_SEGMENT', 'CROSS', 'ASK_WORKER', 'ARRIVE_WORKER', 'BUY_TOOLS', 'INSPECT_DEVICE', 'CONSTRAIN_GATE', 'APPLY_CONSTRAINT', 'MANUAL_INSPECTION', 'DECLARE_ACTION', 'PRIORITIZE_ACTION', 'MOVE_CARGO', 'SECURE_CARGO'].includes(c.type) && !permitted(s, h)) return '须先取得路易斯对本周这次码头作业的新许可。';
  switch (c.type) {
    case 'LEAVE_ORIGINAL_COURT': return s.playerPosition !== 'ORIGINAL_ENTRY' || !!s.originalDepartureEventId ? '本人已经实际离开原室入口。' : null;
    case 'ASK_OWNER': return !settled(s) || !s.owner.alive || permitted(s, h) || s.phase === 'PREPARATION' && !!s.evacuationReportEventId ? '须先在码头外收好通路，再当面询问本次许可。' : null;
    case 'WITHDRAW_OWNER': return s.owner.consent !== 'GRANTED' ? '当前没有可撤回的许可。' : null;
    case 'INSPECT_EXIT': return s.playerPosition !== 'OUTSIDE' || !!s.exit.inspectedEventId ? '须在码头外查验尚未检查的普通侧门和连通各停靠点的侧路。' : null;
    case 'OPEN_EXIT': return !s.exit.inspectedEventId || s.exit.door === 'OPEN' ? '先查明普通侧路，再打开尚未开启的侧门。' : null;
    case 'CLOSE_EXIT': return !outside(s) || s.exit.door !== 'OPEN' ? '须所有人实际在码头外才能关闭侧门。' : null;
    case 'BUY_TOOLS': return s.playerPosition !== 'OUTSIDE' || !!s.toolsBoughtEventId ? '须在码头外领用尚未买过的普通拆销工具与绑带；旧工具不会重新收费。' : null;
    case 'APPROACH': return s.playerPosition !== 'OUTSIDE' || !s.exit.inspectedEventId || s.exit.door !== 'OPEN' ? '先查明并打开普通侧门，再亲走两米到入口。' : null;
    case 'WALK_EXIT': return ['OUTSIDE', 'ORIGINAL_ENTRY'].includes(s.playerPosition) || !s.exit.inspectedEventId || s.exit.door !== 'OPEN' ? '本人须在码头内，普通侧路已经查明且侧门开放。' : null;
    case 'INSPECT_SEGMENT': return !!s.segments[c.segment].inspectedEventId || s.playerPosition !== route(c.segment).from ? '须站在这段三米通道起点实际检查货闸与卡住的原销。' : null;
    case 'REMOVE_PIN': { const p = s.segments[c.segment]; return !p.inspectedEventId || p.pin.position !== 'INSERTED' || s.playerPosition !== route(c.segment).from || !s.toolsBoughtEventId || s.window ? '须在已查验货闸旁用实购工具拆下仍插在该闸的同一原销。' : null; }
    case 'OPEN_SEGMENT': return !s.segments[c.segment].inspectedEventId || s.segments[c.segment].pin.position === 'INSERTED' || s.segments[c.segment].open ? '须先亲查并实际拆下这道卡闸的原销，再拉动普通门索打开。' : null;
    case 'CLOSE_SEGMENT': return !s.segments[c.segment].open ? '这道货闸已经关闭。' : null;
    case 'CROSS': {
      const to = crossing(s, c), w = c.actorId === 'PLAYER' ? null : worker(s, c.actorId);
      if (!to || !s.segments[c.segment].inspectedEventId || !s.segments[c.segment].open || s.exit.door !== 'OPEN') return '须在已检查且开放的路段一端，并保留普通退路。';
      if (w) { const goods = s.cargo.find(x => x.carrierId === w.id); if (!w.alive || w.health <= 0 || w.consent !== 'GRANTED' || !w.paidEventId || !goods || goods.position !== w.position || !goods.secured) return '搬运者须仍自愿、已收工钱且与自己的真实货物同在这端。'; }
      return w && w.energy < 3 + JUSTICIAR_EXIT_METRES[to] ? '余力不足以走完这三米并沿普通侧路退出。' : null;
    }
    case 'INSPECT_DEVICE': return s.playerPosition !== 'GATE' || !!s.device.inspectedEventId || s.window || s.segments.B.pin.position === 'INSERTED' || s.segments.B.pin.location !== 'GATE' ? '须本人带原销实际到检修台，亲查本轮轴销和眼前箱件。' : null;
    case 'ASK_WORKER': { const w = worker(s, c.workerId); return s.phase !== 'PREPARATION' || h.actions < 1 || s.playerPosition !== 'OUTSIDE' || !w || !w.alive || w.age < 18 || w.position !== 'OUTSIDE' || w.consent === 'GRANTED' || workerFinished(w) || !s.device.inspectedEventId || !s.toolsBoughtEventId || !s.segments.A.open || !s.segments.B.open || s.exit.door !== 'OPEN' || w.energy < 16 ? '先由本人完成两卡闸普通拆销与查验，打开退路，再在码头外独立征求成年搬运者同意并留足报告行动。' : null; }
    case 'WITHDRAW_WORKER': return worker(s, c.workerId)?.consent !== 'GRANTED' ? '这位搬运者当前没有作业同意。' : null;
    case 'ARRIVE_WORKER': { const w = worker(s, c.workerId), goods = s.cargo.find(x => x.carrierId === c.workerId); return s.phase !== 'PREPARATION' || !w || !w.alive || w.position !== 'OUTSIDE' || w.consent !== 'GRANTED' || !w.paidEventId || workerFinished(w) || w.energy < 16 || s.exit.door !== 'OPEN' || goods?.position !== 'OUTSIDE' ? '须本人自愿、已经收取工钱，携同一货物实际走到入口并保留完整退出余力。' : null; }
    case 'EXIT_WORKER': { const w = worker(s, c.workerId), goods = s.cargo.find(x => x.carrierId === c.workerId); return !w || !w.alive || w.health <= 0 || w.position === 'OUTSIDE' || goods?.position !== w.position || !s.exit.inspectedEventId || s.exit.door !== 'OPEN' || w.energy < JUSTICIAR_EXIT_METRES[w.position] ? '须搬运者和同一货物仍在栈内，能沿开放的普通侧路实际退出。' : null; }
    case 'REPORT_EVACUATION': return s.phase !== 'PREPARATION' || !!s.evacuationReportEventId || !settled(s) || !delivered(s) || s.workers.some(w => !w.paidEventId) ? '须两人及各自货物分别走过两段并真实退出，最后收好全部通路。' : null;
    case 'START_PRACTICE': return h.sequence !== 0 || s.phase !== 'PREPARATION' || !s.evacuationReportEventId || !settled(s) ? '须本人已真实晋升，已有两人货物交接报告，并仍在码头外。' : null;
    case 'DECLARE_ACTION': return h.sequence !== 0 || s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || !s.device.inspectedEventId || !s.toolsBoughtEventId || s.pending !== null || s.window !== null || !box(s).visible || !!box(s).movedEventId || s.supportPads.remaining < 1 ? '须本人在查明的检修台旁，只声明一项本人亲手搬动同一箱件一米的待执行动作，并留有实购缓冲垫。' : null;
    case 'RESIST_PRIORITY': return s.window?.kind !== 'OWN_ACTION_PRIORITY' || s.pending?.status !== 'PENDING' ? '当前没有本人可拒绝的待执行优先动作。' : null;
    case 'CONSTRAIN_GATE': case 'PRIORITIZE_ACTION': {
      if (h.sequence !== 0 || s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || s.workers.some(w => w.position !== 'OUTSIDE') || !s.device.inspectedEventId || s.window || s.contact || s.supportPads.remaining < 1) return '须晋升后本人独自在已检查的检修台旁，两位搬运者仍在码头外，没有其他短窗。';
      if (c.type === 'CONSTRAIN_GATE') return !!s.device.loadFinishedEventId || !!s.gate.loadEventId || s.gate.integrity <= 0 || !s.segments.B.open || hasReceipt(s, 'CONSTRAIN_GATE') ? '须在后闸原绳旁、真实载荷尚未发生；这段原绳本轮只可开启一次短窗。' : null;
      const goods = box(s); return s.pending?.status !== 'PENDING' || s.pending.actorId !== h.actorId || s.pending.cargoVersion !== goods.version || hasReceipt(s, 'PRIORITIZE_ACTION') || !!s.device.cargoFinishedEventId || !goods.visible || goods.position !== 'GATE' || goods.secured || !!goods.movedEventId ? '须本人已经声明对眼前同一箱件的唯一待执行动作，目标仍未变化、固定或搬动。' : null;
    }
    case 'APPLY_CONSTRAINT': return s.supportPads.remaining < 1 || s.phase !== 'PRACTICE' || !!s.device.loadFinishedEventId || s.window?.kind !== 'GATE_CONSTRAINT' || !windowCurrent(s, h, e.seconds) ? '须持续接触同一物理货闸的原绳，在有效短窗内实际下放后闸原有重量。' : null;
    case 'MANUAL_INSPECTION': return s.supportPads.remaining < 1 || !s.segments.B.open || !!s.gate.loadEventId || s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || !s.device.inspectedEventId || !s.toolsBoughtEventId || !!s.device.loadFinishedEventId || s.window || s.contact ? '须本人在后闸原绳旁结束短窗，用既有绞盘和支撑完成这一次受控下放。' : null;
    case 'SECURE_CARGO': return s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || !s.device.inspectedEventId || !s.toolsBoughtEventId || box(s).secured || !!box(s).movedEventId || s.window || s.contact ? '须在已看清的箱件旁结束短窗，以既有绑带普通固定尚未搬过的同一箱件。' : null;
    case 'MOVE_CARGO': return s.supportPads.remaining < 1 || s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || !s.device.inspectedEventId || !!s.device.cargoFinishedEventId || !box(s).visible || box(s).position !== 'GATE' || s.workers.some(w => w.position !== 'OUTSIDE') || (s.window ? s.window.kind !== 'OWN_ACTION_PRIORITY' || !windowCurrent(s, h, e.seconds) : s.contact || !box(s).secured) ? '须本人在检修台，以本人待执行动作的有效优先短窗或实际普通固定搬动眼前同一箱件一米。' : null;
    case 'END_CONTACT': return !s.window && !s.contact ? '当前已经没有短窗或接触。' : null;
    case 'STOP_METHOD': return s.status === 'ABORTED' && !s.window && !s.contact && s.owner.consent !== 'GRANTED' && s.workers.every(w => w.consent !== 'GRANTED') ? '已经停止；仍须从各自位置普通退出。' : null;
    case 'WAIT_10': return !s.window ? '当前没有需要等待的短窗。' : null;
    case 'REPORT_RETURN': return s.phase !== 'PRACTICE' || !!s.returnReportEventId || !settled(s) || s.status !== 'ABORTED' && (!s.device.loadFinishedEventId || !s.device.cargoFinishedEventId) ? '须本人真实退出并关好通路；完成拆检搬运，或如实报告本次已经停止。' : null;
    default: return '当前没有这项现场行动。';
  }
}
function receipt(s: JusticiarScene, h: JusticiarSceneHost, kind: string, actorId = 'PLAYER', position = s.playerPosition): void {
  s.receipts.push({ eventId: h.eventId, kind, actorId, position, targetVersion: s.segments.B.pin.version });
}
function endWindow(s: JusticiarScene, h: JusticiarSceneHost, reason: string): void { if (s.window || s.contact) receipt(s, h, reason); s.window = null; s.contact = false; if (s.pending?.status === 'PENDING') { s.pending.status = 'CANCELLED'; s.pending.resolvedEventId = h.eventId; } }
function closeConsent(s: JusticiarScene): void {
  if (s.owner.consent === 'GRANTED') { s.owner.consent = 'CLOSED'; s.owner.permissionVersion++; }
  for (const w of s.workers) if (w.consent === 'GRANTED') { w.consent = 'CLOSED'; w.permissionVersion++; }
}
function move(s: JusticiarScene, h: JusticiarSceneHost, actorId: 'PLAYER' | JusticiarWorkerId, to: JusticiarPosition, metres: number): void {
  const w = actorId === 'PLAYER' ? null : worker(s, actorId)!, from = w ? w.position : s.playerPosition;
  const goods = w ? s.cargo.find(c => c.carrierId === w.id)! : null;
  if (w) { w.position = to; w.energy -= metres; w.walkedMetres += metres; goods!.position = to; goods!.travelMetres += metres; goods!.version++; }
  else { endWindow(s, h, 'MOVEMENT_ENDED_WINDOW'); s.playerPosition = to; s.originalGuardPlate.location = to; s.playerTravelMetres += metres; for (const segment of Object.values(s.segments)) if (segment.pin.position === 'PLAYER') { segment.pin.location = to; segment.pin.travelMetres += metres; segment.pin.version++; } }
  s.moves.push({ eventId: h.eventId, actorId, from, to, metres, seconds: metres, cargoId: goods?.id ?? null });
}
export function applyJusticiarScene(scene: JusticiarScene, command: JusticiarCommand, host: JusticiarSceneHost, check: (ability: PublicCoreStatKey, difficulty: number) => PublicCheckResult): { state: JusticiarScene; effect: JusticiarEffect; notes: string[] } {
  const blocked = justiciarSceneBlock(scene, command, host); if (blocked) throw Error(blocked);
  const s = structuredClone(scene), c = command, h = host, e = cost(c, s), notes: string[] = [];
  switch (c.type) {
    case 'LEAVE_ORIGINAL_COURT': move(s, h, 'PLAYER', 'OUTSIDE', 4); s.originalGuardPlate.location = 'OUTSIDE'; s.originalDepartureEventId = h.eventId; notes.push('本人沿开放原门亲走四米到室外；薇娜、43岁的米拉和原包裹线纸仍在室外；本人携同一护板退出，原完整度和旧对手的真实结果保留。'); break;
    case 'ASK_OWNER': s.status = 'ACTIVE'; s.owner.consent = 'GRANTED'; s.owner.permissionVersion++; s.owner.permissionWeek = h.week; s.owner.permissionEventId = h.eventId; notes.push('42岁的路易斯在码头外当面同意本周这次作业；任何人仍可撤回。'); break;
    case 'WITHDRAW_OWNER': s.owner.consent = 'WITHDRAWN'; s.owner.permissionVersion++; s.status = 'ABORTED'; endWindow(s, h, 'OWNER_WITHDREW'); notes.push('路易斯撤回本次许可，所有人在实际位置停止作业，普通侧路仍可退出。'); break;
    case 'INSPECT_EXIT': s.exit.inspectedEventId = h.eventId; notes.push('实际查明普通绞盘与承重支撑，以及连通入口、中段和检修台的侧路；即使两闸关闭也能普通走出。'); break;
    case 'OPEN_EXIT': s.exit.door = 'OPEN'; notes.push('手动打开已检查的普通侧门。'); break;
    case 'CLOSE_EXIT': s.exit.door = 'CLOSED'; notes.push('确认所有人已在码头外，手动关闭侧门。'); break;
    case 'BUY_TOOLS': s.toolsBoughtEventId = h.eventId; s.supportPads.remaining = 2; notes.push('实付30便士领用一套普通拆销工具、夹具、绑带和两块缓冲垫；工具可以继续使用，缓冲垫各用一次后耗尽。'); break;
    case 'APPROACH': move(s, h, 'PLAYER', 'ENTRY', 2); notes.push('本人从码头外实际走两米到入口。'); break;
    case 'WALK_EXIT': { const metres = JUSTICIAR_EXIT_METRES[s.playerPosition]; move(s, h, 'PLAYER', 'OUTSIDE', metres); notes.push(`本人沿普通侧路走${metres}米到码头外，短窗已结束。`); break; }
    case 'INSPECT_SEGMENT': s.segments[c.segment].inspectedEventId = h.eventId; notes.push(`在起点实际检查${c.segment}段三米通道及卡住这道货闸的原轴销。`); break;
    case 'REMOVE_PIN': { const p = s.segments[c.segment].pin; p.position = 'PLAYER'; p.location = s.playerPosition; p.wear++; p.version++; p.removedEventId = h.eventId; notes.push(`以普通工具拆下${c.segment}闸同一枚原销并实际拿在手中，磨损加一；货闸仍须另行打开。`); break; }
    case 'OPEN_SEGMENT': s.segments[c.segment].open = true; if (c.segment === 'B') s.gate.version++; notes.push(`用普通绞盘拉起并支撑已查明的${c.segment}段货闸。`); break;
    case 'CLOSE_SEGMENT': s.segments[c.segment].open = false; if (c.segment === 'B') s.gate.version++; notes.push(`拉动普通门索关闭${c.segment}段货闸，侧路仍保留。`); break;
    case 'CROSS': { const to = crossing(s, c)!; move(s, h, c.actorId, to, 3); if (c.actorId !== 'PLAYER' && to === route(c.segment).to) { worker(s, c.actorId)!.passage[c.segment === 'A' ? 'a' : 'b'] = h.eventId; s.cargo.find(x => x.carrierId === c.actorId)!.passage[c.segment === 'A' ? 'a' : 'b'] = h.eventId; } notes.push(`${c.actorId === 'PLAYER' ? '本人' : worker(s, c.actorId)!.name + '携同一货物'}实际走过${c.segment}段三米。`); break; }
    case 'INSPECT_DEVICE': s.device.inspectedEventId = h.eventId; for (const segment of Object.values(s.segments)) if (segment.pin.position === 'PLAYER' && segment.pin.location === 'GATE') { segment.pin.position = 'BENCH'; segment.pin.version++; } box(s).visible = true; notes.push('在检修台放下实持原销，查明眼前同一物理后闸、原绳、绞盘与支撑。该闸受控下落八厘米，普通支撑可以接住；同一箱件只需搬动一米，通常先调整支撑再搬运。两项实际操作各需一块已购买的缓冲垫。'); break;
    case 'ASK_WORKER': { const w = worker(s, c.workerId)!; w.consent = 'GRANTED'; w.permissionVersion++; w.permissionEventId = h.eventId; w.paidEventId ??= h.eventId; notes.push(`${w.name}独立同意本班搬运${e.cash ? '，实收20便士工钱' : '；已收本班工钱不再重复支付'}，仍在码头外。`); break; }
    case 'WITHDRAW_WORKER': { const w = worker(s, c.workerId)!; w.consent = 'WITHDRAWN'; w.permissionVersion++; s.status = 'ABORTED'; endWindow(s, h, 'WORKER_WITHDREW'); notes.push(`${w.name}撤回作业同意，本人和货物留在实际位置，可直接走普通侧路退出。`); break; }
    case 'ARRIVE_WORKER': { const w = worker(s, c.workerId)!; move(s, h, w.id, 'ENTRY', 2); w.arrivalEventId = h.eventId; w.passage.exit = null; s.cargo.find(x => x.carrierId === w.id)!.passage.exit = null; notes.push(`${w.name}携同一货物实际走两米到入口，消耗两点精力。`); break; }
    case 'EXIT_WORKER': { const w = worker(s, c.workerId)!, metres = JUSTICIAR_EXIT_METRES[w.position]; move(s, h, w.id, 'OUTSIDE', metres); w.passage.exit = h.eventId; s.cargo.find(x => x.carrierId === w.id)!.passage.exit = h.eventId; if (w.consent === 'GRANTED') { w.consent = 'CLOSED'; w.permissionVersion++; } if (!w.passage.a || !w.passage.b) s.status = 'ABORTED'; notes.push(`${w.name}携同一货物沿普通侧路走${metres}米退出，消耗同量精力；没有移动另一人或另一份货物。`); break; }
    case 'REPORT_EVACUATION': s.evacuationReportEventId = h.eventId; s.status = 'COMPLETED'; closeConsent(s); notes.push('逐一核实两位成人和两份货物的两段通行与普通退出，保留实际工钱、精力、路程和原销磨损。'); break;
    case 'START_PRACTICE': s.phase = 'PRACTICE'; s.status = 'ACTIVE'; closeConsent(s); s.device.inspectedEventId = null; notes.push('本人开始一轮独立检修；两位成年人均已结束同意并留在码头外。仍用同一后闸原绳与原箱件，须重新询问场地许可并检查，不新增测试载荷。'); break;
    case 'DECLARE_ACTION': s.pending = { id: `${h.eventId}:own-action`, actorId: h.actorId, cargoId: 'JU228-MAINTENANCE-BOX', cargoVersion: box(s).version, position: 'GATE', createdAt: h.second, status: 'PENDING', order: 'ORDINARY', resolvedEventId: null }; notes.push('本人声明一项尚未执行的动作：亲手把眼前同一箱件搬一米。普通顺序是先调整支撑再搬；这不是物体已经移动的证明。'); break;
    case 'RESIST_PRIORITY': s.pending!.order = 'RESISTED'; endWindow(s, h, 'OWN_ACTION_RESISTED'); notes.push('本人主动拒绝这次优先顺序，待执行动作取消，箱件留在原处，全部已付费用保留。可用普通绑带完成。'); break;
    case 'CONSTRAIN_GATE': case 'PRIORITIZE_ACTION': { const constraint = c.type === 'CONSTRAIN_GATE', target = constraint ? s.gate : box(s); s.contact = constraint; s.window = { kind: constraint ? 'GATE_CONSTRAINT' : 'OWN_ACTION_PRIORITY', actorId: h.actorId, startPosition: 'GATE', targetId: target.id, targetVersion: target.version, permissionVersion: s.owner.permissionVersion, createdAt: h.second + e.seconds, expiresAt: h.second + e.seconds + 20, pendingId: constraint ? null : s.pending!.id }; notes.push(`实付1行动、12灵性与5精神，开启二十秒${constraint ? '眼前同一物理后闸的有限约束' : '本人唯一待执行搬运动作的优先'}短窗；尚未下放或移动任何物体。`); break; }
    case 'APPLY_CONSTRAINT': { const result = check('will', JUSTICIAR_PRACTICE_COSTS.constraint.difficulty), success = ['SUCCESS', 'GREAT_SUCCESS'].includes(result.tier); s.supportPads.remaining--; s.supportPads.spentEventIds.push(h.eventId); s.gate.loadEventId = h.eventId; s.gate.dropCentimetres = success ? 3 : 8; s.gate.wear++; s.gate.integrity--; s.gate.version++; s.device.loadFinishedEventId = h.eventId; s.device.loadMethod = 'ABILITY'; if (success) { s.constraintApplied = true; e.mastery = [JUSTICIAR_ABILITY_IDS[0]]; notes.push('亲手用绞盘受控下放原闸，其原有重量真实拉动同一绳段。有限闸约束把这一次滑动从八厘米限制到三厘米，原闸磨损加一、完整度减一并消耗一块缓冲垫，支撑接住闸体。'); } else { e.mind += 2; notes.push('亲手下放时有限闸约束未能抵住原闸重量，绳真实滑动八厘米后由普通支撑接住；原闸磨损加一、完整度减一并消耗一块缓冲垫，额外损耗2精神。这次载荷已经发生，不会重新制造一次。'); } endWindow(s, h, 'CONSTRAINT_SPENT'); break; }
    case 'MANUAL_INSPECTION': s.supportPads.remaining--; s.supportPads.spentEventIds.push(h.eventId); s.gate.loadEventId = h.eventId; s.gate.dropCentimetres = 8; s.gate.wear++; s.gate.integrity--; s.gate.version++; s.device.loadFinishedEventId = h.eventId; s.device.loadMethod = 'ORDINARY'; notes.push('用既有普通绞盘与支撑下放同一后闸，绳真实移动八厘米后支撑接住；留下原闸磨损并消耗一块缓冲垫，不增加未应用技巧的掌握。'); break;
    case 'SECURE_CARGO': box(s).secured = true; box(s).version++; notes.push('用既有夹具与绑带实际固定眼前同一箱件，随后按普通顺序调整支撑和搬动箱件。'); break;
    case 'MOVE_CARGO': {
      const goods = box(s), ability = s.window?.kind === 'OWN_ACTION_PRIORITY'; let success = false;
      if (ability) { const result = check('will', JUSTICIAR_PRACTICE_COSTS.priority.difficulty); success = ['SUCCESS', 'GREAT_SUCCESS'].includes(result.tier); if (!success) e.mind += 2; }
      e.seconds = success ? 2 : 8; s.supportPads.remaining--; s.supportPads.spentEventIds.push(h.eventId);
      if (s.pending?.status === 'PENDING') { s.pending.status = 'COMPLETED'; s.pending.order = success ? 'PRIORITIZED' : ability ? 'RESISTED' : 'ORDINARY'; s.pending.resolvedEventId = h.eventId; }
      goods.offsetMetres++; goods.travelMetres++; goods.version++; goods.movedEventId = h.eventId; s.device.cargoFinishedEventId = h.eventId; s.device.cargoMethod = ability ? 'ABILITY' : 'ORDINARY'; s.playerTravelMetres++;
      s.moves.push({ eventId: h.eventId, actorId: 'PLAYER', from: 'GATE', to: 'GATE', metres: 1, seconds: e.seconds, cargoId: goods.id });
      if (success) { s.priorityApplied = true; e.mastery = [JUSTICIAR_ABILITY_IDS[1]]; }
      endWindow(s, h, 'OWN_ACTION_SPENT'); notes.push(success ? '本人这一项待执行动作取得优先：亲手搬同一箱件一米后调整支撑，用时2秒，消耗一块缓冲垫。只有这一次实际顺序改变计入掌握。' : ability ? '本人动作优先未抵住既有顺序，先普通调整支撑再亲手搬同一箱件一米，用时8秒，额外损2精神并消耗一块缓冲垫。没有掌握增长。' : '先以普通工具调整支撑，再亲手搬动固定的同一箱件一米，用时8秒并消耗一块缓冲垫，没有未应用技巧的掌握。'); break;
    }
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
export function desiredJusticiarSceneCommand(s: JusticiarScene, h: JusticiarSceneHost): JusticiarCommand | null {
  const cleanup = (): JusticiarCommand | null => {
    if (s.window || s.contact) return { type: 'END_CONTACT' };
    if (!outside(s)) { if (s.exit.door !== 'OPEN') return { type: 'OPEN_EXIT' }; const w = s.workers.find(x => x.position !== 'OUTSIDE'); return w ? { type: 'EXIT_WORKER', workerId: w.id } : { type: 'WALK_EXIT' }; }
    if (s.segments.B.open) return { type: 'CLOSE_SEGMENT', segment: 'B' };
    if (s.segments.A.open) return { type: 'CLOSE_SEGMENT', segment: 'A' };
    return s.exit.door === 'OPEN' ? { type: 'CLOSE_EXIT' } : null;
  };
  if (s.playerPosition === 'ORIGINAL_ENTRY') return { type: 'LEAVE_ORIGINAL_COURT' };
  if (s.returnReportEventId) return null;
  if (s.phase === 'PREPARATION' && s.evacuationReportEventId) return h.sequence === 0 ? { type: 'START_PRACTICE' } : null;
  if (s.window) { const c: JusticiarCommand = { type: s.window.kind === 'GATE_CONSTRAINT' ? 'APPLY_CONSTRAINT' : 'MOVE_CARGO' }; return !justiciarSceneBlock(s, c, h) ? c : { type: 'END_CONTACT' }; }
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
    const ability: JusticiarCommand = { type: 'CONSTRAIN_GATE' };
    return !hasReceipt(s, 'CONSTRAIN_GATE') && h.actions >= 2 && !justiciarSceneBlock(s, ability, h) ? ability : { type: 'MANUAL_INSPECTION' };
  }
  if (!s.device.cargoFinishedEventId) {
    if (!s.pending && !hasReceipt(s, 'PRIORITIZE_ACTION') && h.actions >= 2) return { type: 'DECLARE_ACTION' };
    const ability: JusticiarCommand = { type: 'PRIORITIZE_ACTION' };
    if (!hasReceipt(s, 'PRIORITIZE_ACTION') && h.actions >= 2 && !justiciarSceneBlock(s, ability, h)) return ability;
    return box(s).secured ? { type: 'MOVE_CARGO' } : { type: 'SECURE_CARGO' };
  }
  return cleanup();
}
function label(c: JusticiarCommand): string {
  if ('workerId' in c) return `${JUSTICIAR_WORKERS.find(w => w.id === c.workerId)!.name}${c.type === 'ASK_WORKER' ? '独立同意并核付本班工钱' : c.type === 'WITHDRAW_WORKER' ? '撤回作业同意' : c.type === 'ARRIVE_WORKER' ? '携货亲走两米到入口' : '携同一货物沿普通侧路退出'}`;
  if (c.type === 'CROSS') return `${c.actorId === 'PLAYER' ? '本人' : JUSTICIAR_WORKERS.find(w => w.id === c.actorId)!.name + '携同一货物'}亲走${c.segment}段三米`;
  if ('segment' in c) return `${c.type === 'INSPECT_SEGMENT' ? '亲查' : c.type === 'REMOVE_PIN' ? '以普通工具拆下原销，释放' : c.type === 'OPEN_SEGMENT' ? '打开' : '关闭'}${c.segment}段卡闸`;
  const labels: Partial<Record<JusticiarCommand['type'], string>> = { LEAVE_ORIGINAL_COURT: '沿原门亲走四米到原室外', ASK_OWNER: '当面询问路易斯本周本次作业许可', WITHDRAW_OWNER: '路易斯撤回本次作业许可', INSPECT_EXIT: '查明普通侧门与各处退路', OPEN_EXIT: '打开普通侧门', CLOSE_EXIT: '所有人退出后关闭侧门', BUY_TOOLS: '实购一套普通工具与绑带', APPROACH: '本人亲走两米到码头入口', WALK_EXIT: '本人沿普通侧路实际退出', INSPECT_DEVICE: '亲查后闸原绳、实际载荷与可见箱件', REPORT_EVACUATION: '报告两人两份货物的真实通行退出', START_PRACTICE: '本人开始独立检修搬运', CONSTRAIN_GATE: '实付开启有限闸约束', APPLY_CONSTRAINT: '在短窗内实际下放原闸重量', MANUAL_INSPECTION: '用普通绞盘与支撑下放原闸', DECLARE_ACTION: '声明本人唯一待执行搬运动作', PRIORITIZE_ACTION: '实付使本人这一次待执行动作优先', RESIST_PRIORITY: '本人拒绝优先并取消待执行动作', SECURE_CARGO: '普通夹具绑带固定同一箱件', MOVE_CARGO: '本人实际搬动同一箱件一米', END_CONTACT: '结束当前短窗并松手', WAIT_10: '实际等待十秒', STOP_METHOD: '停止本次作业并保留成本', REPORT_RETURN: '如实报告本轮检修搬运与返程' };
  return labels[c.type] ?? '继续实际行动';
}
export function justiciarSceneActions(s: JusticiarScene, h: JusticiarSceneHost): { command: JusticiarCommand; label: string; cost: string }[] {
  const commands: JusticiarCommand[] = [], add = (c: JusticiarCommand) => { if (isJusticiarSceneCommand(c) && !commands.some(x => stableStringify(x) === stableStringify(c))) commands.push(c); };
  const next = desiredJusticiarSceneCommand(s, h); if (next) add(next);
  if (s.status !== 'COMPLETED') {
    if (s.window || s.contact) { add({ type: 'END_CONTACT' }); if (s.window?.kind === 'OWN_ACTION_PRIORITY') add({ type: 'RESIST_PRIORITY' }); if (s.window) add({ type: 'WAIT_10' }); }
    if (!['OUTSIDE', 'ORIGINAL_ENTRY'].includes(s.playerPosition)) add({ type: 'WALK_EXIT' });
    if (s.exit.inspectedEventId && s.exit.door === 'CLOSED') add({ type: 'OPEN_EXIT' });
    for (const w of s.workers) { if (w.position !== 'OUTSIDE') add({ type: 'EXIT_WORKER', workerId: w.id }); if (w.consent === 'GRANTED') add({ type: 'WITHDRAW_WORKER', workerId: w.id }); }
    if (s.owner.consent === 'GRANTED') add({ type: 'WITHDRAW_OWNER' });
    if (s.status === 'ACTIVE') add({ type: 'STOP_METHOD' });
    if (s.status === 'ABORTED' && settled(s)) add({ type: 'ASK_OWNER' });
    if (s.phase === 'PRACTICE' && s.playerPosition === 'GATE' && !s.window) for (const type of ['CONSTRAIN_GATE', 'MANUAL_INSPECTION', 'DECLARE_ACTION', 'PRIORITIZE_ACTION', 'SECURE_CARGO', 'MOVE_CARGO'] as const) if (!justiciarSceneBlock(s, { type }, h)) add({ type });
  }
  return commands.map(c => { const e = cost(c, s); return { command: c, label: label(c), cost: [`${e.actions}行动`, ...(e.cash ? [`${e.cash}便士`] : []), ...(e.spirituality ? [`${e.spirituality}灵性`] : []), ...(e.mind ? [`${e.mind}精神`] : []), ...(c.type === 'MOVE_CARGO' && s.window ? ['耗1缓冲垫；成功本人顺序优先，失败普通完成并减2精神'] : []), `${e.seconds}秒`].join(' · ') }; });
}
