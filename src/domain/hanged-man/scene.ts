import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import type { ThreeHeadedTemplarSpiritId, ThreeHeadedTemplarSpiritMethod } from '../three-headed-templar/life.js';
import { HANGED_MAN_ABILITY_IDS, HANGED_MAN_EXIT_METRES, HANGED_MAN_PRACTICE_COSTS, HANGED_MAN_PRICES, HANGED_MAN_WORKERS, type HangedManPosition, type HangedManSegmentId, type HangedManWorkerId } from './content.js';
import type { HangedManCommand, HangedManEffect, HangedManScene, HangedManSceneHost, HangedManSource } from './types.js';

const SCENE_COMMANDS = new Set([
  'LEAVE_ORIGINAL_COURT', 'RETURN_ON_FOOT', 'ASK_OWNER', 'WITHDRAW_OWNER', 'APPROACH', 'INSPECT_EXIT', 'INSPECT_DEVICE',
  'BUY_BRACE', 'BUY_SEAL', 'USE_WINCH', 'OPEN_EXIT', 'CLOSE_EXIT', 'ASK_WORKER', 'WITHDRAW_WORKER', 'ARRIVE_WORKER',
  'EXIT_WORKER', 'INSPECT_SEGMENT', 'OPEN_SEGMENT', 'CLOSE_SEGMENT', 'CROSS', 'REPORT_EVACUATION', 'START_PRACTICE',
  'BEAR_PRESSURE', 'TEST_PRESSURE', 'COOPERATIVE_SEAL', 'APPLY_SEAL', 'MANUAL_SEAL', 'STOP_METHOD', 'END_CONTACT', 'WAIT_10', 'WALK_EXIT', 'REPORT_RETURN',
]);
const CLEANUP = new Set(['STOP_METHOD', 'END_CONTACT', 'WAIT_10', 'WITHDRAW_OWNER', 'WITHDRAW_WORKER', 'USE_WINCH', 'OPEN_EXIT', 'CLOSE_EXIT', 'EXIT_WORKER', 'WALK_EXIT', 'RETURN_ON_FOOT', 'CLOSE_SEGMENT', 'REPORT_RETURN', 'REPORT_EVACUATION', 'ASK_OWNER']);
const METHODS: Record<ThreeHeadedTemplarSpiritId, ThreeHeadedTemplarSpiritMethod> = { 'THT3-HELENA': 'BRIEF_WARD', 'THT3-ROLAND': 'SCREEN' };
const worker = (s: HangedManScene, id: HangedManWorkerId) => s.workers.find(w => w.id === id);
const permitted = (s: HangedManScene, h: HangedManSceneHost) => s.owner.alive && s.owner.consent === 'GRANTED' && s.owner.permissionWeek === h.week && !!s.owner.permissionEventId;
const outside = (s: HangedManScene) => s.playerPosition === 'OUTSIDE' && s.owner.position === 'OUTSIDE' && s.workers.every(w => w.position === 'OUTSIDE');
const settled = (s: HangedManScene) => outside(s) && !s.window && !s.contact && !s.segments.A.open && !s.segments.B.open && s.exit.door === 'CLOSED';
const blankSeal = (s: HangedManScene) => s.seals.find(seal => seal.status === 'BLANK' && seal.charges === 1);
const hasReceipt = (s: HangedManScene, kind: string) => s.receipts.some(r => r.kind === kind);
const spiritDigest = (s: HangedManScene, id: ThreeHeadedTemplarSpiritId) => sha256Hex(stableStringify(s.spirits[id]));
const route = (segment: HangedManSegmentId): { from: HangedManPosition; to: HangedManPosition } => segment === 'A' ? { from: 'ENTRY', to: 'MIDPOINT' } : { from: 'MIDPOINT', to: 'GATE' };
function crossing(s: HangedManScene, c: Extract<HangedManCommand, { type: 'CROSS' }>): HangedManPosition | null {
  const at = c.actorId === 'PLAYER' ? s.playerPosition : worker(s, c.actorId)?.position, path = route(c.segment);
  return at === path.from ? path.to : at === path.to ? path.from : null;
}
function spiritReady(s: HangedManScene, id: ThreeHeadedTemplarSpiritId, payment = true): boolean {
  const sp = s.spirits[id], method = METHODS[id];
  return !!sp && sp.id === id && sp.status === 'GRAZED' && sp.location === 'INTERNAL' && !sp.interrupted && sp.integrity > 0 && sp.spirituality >= (payment ? 3 : 0) && sp.knownAbilities.includes(method) && sp.selectedAbilities.includes(method);
}
function windowCurrent(s: HangedManScene, h: HangedManSceneHost, seconds = 0): boolean {
  const w = s.window;
  if (!w || w.actorId !== h.actorId || w.startPosition !== s.playerPosition || w.targetId !== s.device.id || w.targetVersion !== s.device.revision || w.permissionVersion !== s.owner.permissionVersion || !permitted(s, h) || h.second < w.createdAt || h.second + seconds >= w.expiresAt) return false;
  return w.kind === 'PRESSURE_BEARING' || !!(s.contact && w.spiritId && spiritReady(s, w.spiritId, false) && w.selectedMethod === METHODS[w.spiritId] && w.spiritDigest === spiritDigest(s, w.spiritId) && s.seals.some(seal => seal.id === w.sealId && seal.status === 'BLANK' && seal.charges === 1));
}
function cost(c: HangedManCommand, s: HangedManScene): HangedManEffect {
  const e: HangedManEffect = { actions: 0, cash: 0, spirituality: 0, mind: 0, health: 0, seconds: 1 };
  if (c.type === 'ASK_WORKER' && !worker(s, c.workerId)?.paidEventId) e.cash = HANGED_MAN_PRICES.workerService;
  if (c.type === 'BUY_BRACE') e.cash = HANGED_MAN_PRICES.ordinaryBrace;
  if (c.type === 'BUY_SEAL') e.cash = HANGED_MAN_PRICES.seal;
  if (['INSPECT_EXIT', 'INSPECT_SEGMENT', 'INSPECT_DEVICE'].includes(c.type)) e.seconds = 30;
  if (c.type === 'REPORT_EVACUATION' || c.type === 'REPORT_RETURN') { e.actions = HANGED_MAN_PRACTICE_COSTS.report.actions; e.seconds = HANGED_MAN_PRACTICE_COSTS.report.seconds; }
  if (c.type === 'BEAR_PRESSURE' || c.type === 'COOPERATIVE_SEAL') { e.actions = 1; e.spirituality = 12; e.mind = 5; }
  if (c.type === 'TEST_PRESSURE') { e.seconds = 2; if (s.window?.kind === 'PRESSURE_BEARING') e.health = HANGED_MAN_PRACTICE_COSTS.pressureBearing.appliedHealth; }
  if (c.type === 'APPLY_SEAL' || c.type === 'MANUAL_SEAL') e.seconds = 5;
  if (c.type === 'LEAVE_ORIGINAL_COURT' || c.type === 'APPROACH' || c.type === 'ARRIVE_WORKER') e.seconds = 2;
  if (c.type === 'CROSS') e.seconds = 3;
  if (c.type === 'WALK_EXIT' || c.type === 'RETURN_ON_FOOT') e.seconds = HANGED_MAN_EXIT_METRES[s.playerPosition];
  if (c.type === 'EXIT_WORKER') e.seconds = HANGED_MAN_EXIT_METRES[worker(s, c.workerId)?.position ?? 'OUTSIDE'];
  if (c.type === 'WAIT_10') e.seconds = 10;
  return e;
}

/** This is the actual post-S1 handoff, not a fresh instance of the old court. */
export function createHangedManScene(source: HangedManSource): HangedManScene {
  const site = source.originals.site, operation = source.originals.operation;
  if (!site.owner.alive || site.owner.location !== 'OUTSIDE' || !['START', 'OUTSIDE'].includes(site.playerLocation) || operation.focus || operation.suppressedUntil !== null || !operation.contained) throw Error('须先收束原院的作用，让玛拉实际退出，并走回原院入口。');
  return {
    phase: 'PREPARATION', status: 'ACTIVE', playerPosition: site.playerLocation === 'START' ? 'ORIGINAL_ENTRY' : 'OUTSIDE', playerTravelMetres: site.playerTravelMetres, originalDepartureEventId: null,
    owner: { id: 'THT3-MARA', alive: site.owner.alive, position: 'OUTSIDE', consent: 'CLOSED', permissionVersion: 0, permissionWeek: null, permissionEventId: null },
    workers: HANGED_MAN_WORKERS.map(w => ({ ...w, alive: true, health: 100, energy: 80, position: 'OUTSIDE', walkedMetres: 0, consent: 'UNASKED', permissionVersion: 0, permissionEventId: null, paidEventId: null, arrivalEventId: null, passage: { a: null, b: null, exit: null } })),
    spirits: structuredClone(site.spirits), originalOperation: structuredClone(operation),
    segments: { A: { inspectedEventId: null, open: false }, B: { inspectedEventId: null, open: false } },
    exit: { inspectedEventId: null, door: 'CLOSED', winch: 'UNINSPECTED' },
    device: { id: 'HM223-LOCAL-LATCH', revision: 0, inspectedEventId: null, contained: true, sourcePressure: 3, braceBoughtEventId: null, braced: false, testEventId: null, testMethod: 'NONE', sealedEventId: null },
    seals: [], contact: false, window: null, moves: [], receipts: [], evacuationReportEventId: null, returnReportEventId: null, pressureApplied: false, cooperativeSealApplied: false,
  };
}
export const isHangedManSceneCommand = (c: HangedManCommand): boolean => SCENE_COMMANDS.has(c.type);
export const hangedManSceneInside = (s: HangedManScene): boolean => !settled(s) || s.owner.consent === 'GRANTED' || s.workers.some(w => w.consent === 'GRANTED');

/** Validate resources and all physical prerequisites before any payment or copy. */
export function hangedManSceneBlock(s: HangedManScene, c: HangedManCommand, h: HangedManSceneHost): string | null {
  if (!isHangedManSceneCommand(c)) return '这不是短压廊的现场行动。';
  if (h.health <= 0 || h.mind <= 0) return '本人已不能继续行动。';
  if (s.playerPosition === 'ORIGINAL_ENTRY' && c.type !== 'LEAVE_ORIGINAL_COURT') return '须先从原院入口实际走两米到院外。';
  const e = cost(c, s);
  if (h.actions < e.actions || h.cash < e.cash || h.spirituality < e.spirituality || h.mind <= e.mind || h.health <= e.health) return '本次行动、费用、灵性、精神或承压余力不足；不会先扣费用。';
  if (s.status === 'COMPLETED' && c.type !== 'START_PRACTICE') return '本次报告已完成，保留所有实际结果。';
  if (s.status === 'ABORTED' && !CLEANUP.has(c.type)) return '本次已停止；先用普通退路逐人退出并关好通路。';
  if (s.window && !windowCurrent(s, h) && !CLEANUP.has(c.type)) return '短窗已失效；先松手收束，已付费用保留。';
  const needsPermission = ['ASK_WORKER', 'ARRIVE_WORKER', 'BUY_BRACE', 'BEAR_PRESSURE', 'TEST_PRESSURE', 'COOPERATIVE_SEAL', 'APPLY_SEAL', 'MANUAL_SEAL'];
  if (needsPermission.includes(c.type) && !permitted(s, h)) return '须取得玛拉对本周这次短压廊作业的新许可。';
  switch (c.type) {
    case 'LEAVE_ORIGINAL_COURT': return s.playerPosition !== 'ORIGINAL_ENTRY' || !!s.originalDepartureEventId ? '本人已经实际离开原院入口。' : null;
    case 'ASK_OWNER': return !settled(s) || !s.owner.alive || permitted(s, h) || s.phase === 'PREPARATION' && !!s.evacuationReportEventId ? '须先在廊外收好通路，再向玛拉当面询问本次许可。' : null;
    case 'WITHDRAW_OWNER': return s.owner.consent !== 'GRANTED' ? '当前没有可以撤回的许可。' : null;
    case 'INSPECT_EXIT': return s.playerPosition !== 'OUTSIDE' || !!s.exit.inspectedEventId ? '须在廊外查验尚未检查的普通侧门、绞盘和各停靠点退路。' : null;
    case 'USE_WINCH': return !s.exit.inspectedEventId || s.exit.winch !== 'READY' ? '须先查明可用绞盘；已经锁好的绞盘不用重复操作。' : null;
    case 'OPEN_EXIT': return !s.exit.inspectedEventId || s.exit.winch !== 'LOCKED' || s.exit.door === 'OPEN' ? '先把已检查的绞盘锁好，再打开尚未开启的侧门。' : null;
    case 'CLOSE_EXIT': return !outside(s) || s.exit.door !== 'OPEN' ? '须所有人实际在廊外，才能关闭侧门。' : null;
    case 'APPROACH': return s.playerPosition !== 'OUTSIDE' || !s.exit.inspectedEventId || s.exit.door !== 'OPEN' ? '先查验并打开普通侧门，再实际走两米到入口。' : null;
    case 'WALK_EXIT': case 'RETURN_ON_FOOT': return ['OUTSIDE', 'ORIGINAL_ENTRY'].includes(s.playerPosition) || !s.exit.inspectedEventId || s.exit.door !== 'OPEN' ? '本人须在短廊内，普通侧门已检查且开放。' : null;
    case 'INSPECT_SEGMENT': return !!s.segments[c.segment].inspectedEventId || s.playerPosition !== route(c.segment).from ? '须到这段三米道路的起点，实际检查尚未查验的路段。' : null;
    case 'OPEN_SEGMENT': return !s.segments[c.segment].inspectedEventId || s.segments[c.segment].open ? '须先查验这一段，再打开尚未开启的普通门。' : null;
    case 'CLOSE_SEGMENT': return !s.segments[c.segment].open ? '这段普通门已经关闭。' : null;
    case 'CROSS': {
      const to = crossing(s, c), w = c.actorId === 'PLAYER' ? null : worker(s, c.actorId);
      if (!to || !s.segments[c.segment].inspectedEventId || !s.segments[c.segment].open || s.exit.door !== 'OPEN') return '须站在已查验且开放的路段一端，并保留普通退路。';
      if (c.actorId !== 'PLAYER' && (!w || !w.alive || w.health <= 0 || w.consent !== 'GRANTED' || !permitted(s, h))) return '这位成年人须仍然自愿且本次许可有效；撤回后仍可普通退出。';
      return w && w.energy < 3 + HANGED_MAN_EXIT_METRES[to] ? '余力不足以走完这三米并沿普通侧廊退出。' : null;
    }
    case 'INSPECT_DEVICE': return s.playerPosition !== 'GATE' || !!s.device.inspectedEventId || s.window ? '须本人来到封闩旁，实际查验本轮尚未检查的局部装置。' : null;
    case 'BUY_BRACE': return s.playerPosition !== 'GATE' || !s.device.inspectedEventId || !!s.device.braceBoughtEventId || s.window ? '须在已查验的装置旁领用并装好本次尚未购买的普通支撑。' : null;
    case 'ASK_WORKER': {
      const w = worker(s, c.workerId);
      if (s.phase !== 'PREPARATION' || h.actions < 1 || s.playerPosition !== 'OUTSIDE' || !w || !w.alive || w.health <= 0 || w.age < 18 || w.position !== 'OUTSIDE' || w.consent === 'GRANTED' || !!w.passage.exit) return '须在廊外向尚未完成本班的成年人独立询问，并先留足报告所需的一行动。';
      return !s.segments.A.inspectedEventId || !s.segments.B.inspectedEventId || !s.device.testEventId || s.device.testMethod !== 'ORDINARY' || s.exit.door !== 'OPEN' || w.energy < 16 ? '先完成装置的普通支撑测试、两段查验和侧门准备，并确认此人足够走完与退出。' : null;
    }
    case 'WITHDRAW_WORKER': return worker(s, c.workerId)?.consent !== 'GRANTED' ? '这位成年人当前没有作业同意可撤回。' : null;
    case 'ARRIVE_WORKER': {
      const w = worker(s, c.workerId);
      return s.phase !== 'PREPARATION' || !w || w.position !== 'OUTSIDE' || !w.alive || w.health <= 0 || w.consent !== 'GRANTED' || !w.paidEventId || w.passage.exit || s.exit.door !== 'OPEN' || w.energy < 16 ? '须本人自愿、已经收取本班工钱且保留完整退出余力，才能亲走到入口。' : null;
    }
    case 'EXIT_WORKER': {
      const w = worker(s, c.workerId);
      return !w || !w.alive || w.health <= 0 || w.position === 'OUTSIDE' || !s.exit.inspectedEventId || s.exit.door !== 'OPEN' || w.energy < HANGED_MAN_EXIT_METRES[w.position] ? '须这位成年人仍在廊内，并能沿已查明且开放的普通侧门实际退出。' : null;
    }
    case 'REPORT_EVACUATION': return s.phase !== 'PREPARATION' || !!s.evacuationReportEventId || !settled(s) || s.workers.some(w => !w.paidEventId || !w.passage.a || !w.passage.b || !w.passage.exit) || s.device.testMethod !== 'ORDINARY' ? '须两位成人各自走完两段、真实退出，普通测试已完成，最后关好所有通路。' : null;
    case 'START_PRACTICE': return h.sequence !== 0 || s.phase !== 'PREPARATION' || !s.evacuationReportEventId || !settled(s) ? '须本人真实晋升，已有两人的撤离报告，且所有人仍在廊外。' : null;
    case 'BUY_SEAL': return s.phase !== 'PRACTICE' || s.playerPosition !== 'OUTSIDE' || !!blankSeal(s) || !!s.device.sealedEventId ? '须在廊外购买本次尚未持有的新封条；已经贴好的封条不会免费重置。' : null;
    case 'BEAR_PRESSURE': case 'COOPERATIVE_SEAL': {
      if (h.sequence !== 0 || s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || s.workers.some(w => w.position !== 'OUTSIDE') || !s.device.inspectedEventId || s.window || s.contact) return '须晋升后本人独自在已检查的封闩旁，两位工人仍在廊外，且没有其他短窗。';
      if (c.type === 'BEAR_PRESSURE') return s.pressureApplied || !!s.device.testEventId ? '本轮已经完成实际测试，不能重复计入承压应用。' : null;
      return !!s.device.sealedEventId || !s.device.testEventId || !blankSeal(s) || !spiritReady(s, c.spiritId) ? '先实际测试，持有新封条，并选择仍内收可用、已选短暂屏护或局部遮护的同一原灵。' : null;
    }
    case 'TEST_PRESSURE': return s.playerPosition !== 'GATE' || !s.device.inspectedEventId || !!s.device.testEventId || (s.window ? s.window.kind !== 'PRESSURE_BEARING' || !windowCurrent(s, h, e.seconds) : !s.device.braced) ? '须在已检查的封闩旁，以有效承压短窗或已安装普通支撑完成本轮一次实际测试。' : null;
    case 'APPLY_SEAL': return s.phase !== 'PRACTICE' || !!s.device.sealedEventId || s.window?.kind !== 'COOPERATIVE_SEAL' || !windowCurrent(s, h, e.seconds) ? '须持续接触同一封闩和同一张新封条，并在有效协同短窗内实际贴封。' : null;
    case 'MANUAL_SEAL': return s.phase !== 'PRACTICE' || s.playerPosition !== 'GATE' || !s.device.inspectedEventId || !s.device.testEventId || s.window || s.contact || !blankSeal(s) || !!s.device.sealedEventId ? '先结束短窗，在已测试的封闩旁用同一张实购新封条手工贴封。' : null;
    case 'END_CONTACT': return !s.window && !s.contact ? '当前已没有短窗或接触。' : null;
    case 'STOP_METHOD': return s.status === 'ABORTED' && !s.window && !s.contact && s.owner.consent !== 'GRANTED' && s.workers.every(w => w.consent !== 'GRANTED') ? '已停止；仍按每个人的实际位置退出。' : null;
    case 'WAIT_10': return !s.window ? '当前没有需要等待的短窗。' : null;
    case 'REPORT_RETURN': return s.phase !== 'PRACTICE' || !!s.returnReportEventId || !settled(s) || s.status !== 'ABORTED' && (!s.device.testEventId || !s.device.sealedEventId) ? '须本人已真实退出并关好通路；完成实际测试和贴封，或如实记录已停止的练习。' : null;
    default: return '这一步不适用于短压廊。';
  }
}

function receipt(s: HangedManScene, h: HangedManSceneHost, kind: string, actorId = 'PLAYER', position = s.playerPosition): void {
  s.receipts.push({ eventId: h.eventId, kind, actorId, position, targetVersion: s.device.revision });
}
function endWindow(s: HangedManScene, h: HangedManSceneHost, reason: string): void {
  if (s.window || s.contact) receipt(s, h, reason);
  s.window = null; s.contact = false;
}
function closeConsent(s: HangedManScene): void {
  if (s.owner.consent === 'GRANTED') { s.owner.consent = 'CLOSED'; s.owner.permissionVersion++; }
  for (const w of s.workers) if (w.consent === 'GRANTED') { w.consent = 'CLOSED'; w.permissionVersion++; }
}
function move(s: HangedManScene, h: HangedManSceneHost, actorId: 'PLAYER' | HangedManWorkerId, to: HangedManPosition, metres: number): void {
  const w = actorId === 'PLAYER' ? null : worker(s, actorId)!, from = w ? w.position : s.playerPosition;
  if (w) { w.position = to; w.energy -= metres; w.walkedMetres += metres; }
  else { endWindow(s, h, 'MOVEMENT_ENDED_WINDOW'); s.playerPosition = to; s.playerTravelMetres += metres; }
  s.moves.push({ eventId: h.eventId, actorId, from, to, metres, seconds: metres });
}
export function applyHangedManScene(scene: HangedManScene, command: HangedManCommand, host: HangedManSceneHost): { state: HangedManScene; effect: HangedManEffect; notes: string[] } {
  const blocked = hangedManSceneBlock(scene, command, host); if (blocked) throw Error(blocked);
  const s = structuredClone(scene), c = command, h = host, e = cost(c, s), notes: string[] = [];
  switch (c.type) {
    case 'LEAVE_ORIGINAL_COURT': move(s, h, 'PLAYER', 'OUTSIDE', 2); s.originalDepartureEventId = h.eventId; notes.push('本人从原院入口实际走两米到院外；原人、原物与旧封存状态均未改变。'); break;
    case 'ASK_OWNER': s.status = 'ACTIVE'; s.owner.consent = 'GRANTED'; s.owner.permissionVersion++; s.owner.permissionWeek = h.week; s.owner.permissionEventId = h.eventId; receipt(s, h, 'OWNER_PERMISSION', s.owner.id, 'OUTSIDE'); notes.push('玛拉在廊外当面同意本周这次作业；原院许可没有沿用，她也没有重新进入廊内。'); break;
    case 'WITHDRAW_OWNER': s.owner.consent = 'WITHDRAWN'; s.owner.permissionVersion++; s.status = 'ABORTED'; endWindow(s, h, 'OWNER_WITHDREW'); notes.push('玛拉撤回本次许可，立即结束作用；所有人仍在实际位置，普通退路保留。'); break;
    case 'INSPECT_EXIT': s.exit.inspectedEventId = h.eventId; s.exit.winch = 'READY'; notes.push('查明普通绞盘、侧门和各停靠点的退路，入口、中点、封闩至廊外分别为两米、五米、八米；各处可拉动同一控制索。'); break;
    case 'USE_WINCH': s.exit.winch = 'LOCKED'; notes.push('就地拉动已检查的控制索，把普通绞盘锁稳；没有开启旧封存残余，也没有消耗行动点或工钱。'); break;
    case 'OPEN_EXIT': s.exit.door = 'OPEN'; notes.push('普通侧门已实际打开，各停靠点都能沿已查明退路步行离开。'); break;
    case 'CLOSE_EXIT': s.exit.door = 'CLOSED'; notes.push('所有人已在廊外，亲手关闭普通侧门。'); break;
    case 'APPROACH': move(s, h, 'PLAYER', 'ENTRY', 2); notes.push('本人实际走两米到短压廊入口。'); break;
    case 'WALK_EXIT': case 'RETURN_ON_FOOT': { const metres = HANGED_MAN_EXIT_METRES[s.playerPosition]; move(s, h, 'PLAYER', 'OUTSIDE', metres); notes.push(`本人沿普通侧廊实际走${metres}米退出；没有代替任何其他人移动。`); break; }
    case 'INSPECT_SEGMENT': s.segments[c.segment].inspectedEventId = h.eventId; notes.push(`本人在起点实际检查${c.segment}段三米道路。`); break;
    case 'OPEN_SEGMENT': s.segments[c.segment].open = true; notes.push(`${c.segment}段普通门已经打开。`); break;
    case 'CLOSE_SEGMENT': s.segments[c.segment].open = false; notes.push(`拉动已查明的门索关闭${c.segment}段；侧门退路仍保留。`); break;
    case 'CROSS': { const to = crossing(s, c)!; move(s, h, c.actorId, to, 3); if (c.actorId !== 'PLAYER' && to === route(c.segment).to) worker(s, c.actorId)!.passage[c.segment === 'A' ? 'a' : 'b'] = h.eventId; notes.push(`${c.actorId === 'PLAYER' ? '本人' : worker(s, c.actorId)!.name}实际走过${c.segment}段三米。`); break; }
    case 'INSPECT_DEVICE': s.device.inspectedEventId = h.eventId; notes.push('亲查已经机械隔离的局部封闩，它自有有限压力三；原院旧残余仍封存在原处。'); break;
    case 'BUY_BRACE': s.device.braceBoughtEventId = h.eventId; s.device.braced = true; notes.push(`实付${e.cash}便士领用现场普通支撑并装好；它会保留到后续检查。`); break;
    case 'ASK_WORKER': { const w = worker(s, c.workerId)!; w.consent = 'GRANTED'; w.permissionVersion++; w.permissionEventId = h.eventId; w.paidEventId ??= h.eventId; receipt(s, h, e.cash ? 'WORKER_PAID' : 'WORKER_RECONSENTED', w.id, w.position); notes.push(`${w.name}独立同意本班作业${e.cash ? `，实收${e.cash}便士` : '；本班工钱已收，不重复收费'}，仍在廊外。`); break; }
    case 'WITHDRAW_WORKER': { const w = worker(s, c.workerId)!; w.consent = 'WITHDRAWN'; w.permissionVersion++; s.status = 'ABORTED'; endWindow(s, h, 'WORKER_WITHDREW'); notes.push(`${w.name}撤回同意，仍在原位置；可沿普通侧门自主退出。`); break; }
    case 'ARRIVE_WORKER': { const w = worker(s, c.workerId)!; move(s, h, w.id, 'ENTRY', 2); w.arrivalEventId = h.eventId; notes.push(`${w.name}亲走两米到入口，真实消耗两点精力。`); break; }
    case 'EXIT_WORKER': { const w = worker(s, c.workerId)!, metres = HANGED_MAN_EXIT_METRES[w.position]; move(s, h, w.id, 'OUTSIDE', metres); w.passage.exit = h.eventId; if (w.consent === 'GRANTED') { w.consent = 'CLOSED'; w.permissionVersion++; } if (!w.passage.a || !w.passage.b) s.status = 'ABORTED'; notes.push(`${w.name}沿普通侧廊亲走${metres}米到廊外，消耗同量精力；费用与已走路程保留。`); break; }
    case 'REPORT_EVACUATION': s.evacuationReportEventId = h.eventId; s.status = 'COMPLETED'; closeConsent(s); notes.push('记录两位成人各自实际走过两段并退出的经过；工钱、余力、原灵与旧封存材料消耗如实保留。'); break;
    case 'START_PRACTICE': s.phase = 'PRACTICE'; s.status = 'ACTIVE'; closeConsent(s); s.device.revision++; s.device.inspectedEventId = null; s.device.testEventId = null; s.device.testMethod = 'NONE'; notes.push('开始本人独自进行的一轮新检查；两位工人留在廊外，既有普通支撑仍在，须重新询问玛拉并亲查封闩。'); break;
    case 'BUY_SEAL': s.seals.push({ id: `HM223-STRIP-${s.seals.length + 1}`, status: 'BLANK', charges: 1, boughtEventId: h.eventId, appliedEventId: null, targetVersion: null }); notes.push(`实付${e.cash}便士购买一张只能贴用一次的新封条。`); break;
    case 'BEAR_PRESSURE': case 'COOPERATIVE_SEAL': {
      const spiritId = c.type === 'COOPERATIVE_SEAL' ? c.spiritId : null;
      if (spiritId) s.spirits[spiritId].spirituality -= HANGED_MAN_PRACTICE_COSTS.cooperativeSeal.spiritSpirituality;
      s.contact = spiritId !== null;
      s.window = { kind: spiritId ? 'COOPERATIVE_SEAL' : 'PRESSURE_BEARING', actorId: h.actorId, startPosition: 'GATE', targetId: s.device.id, targetVersion: s.device.revision, permissionVersion: s.owner.permissionVersion, createdAt: h.second + e.seconds, expiresAt: h.second + e.seconds + 20, spiritId, spiritDigest: spiritId ? spiritDigest(s, spiritId) : null, selectedMethod: spiritId ? METHODS[spiritId] : null, sealId: spiritId ? blankSeal(s)!.id : null, applicationEventId: null };
      receipt(s, h, spiritId ? 'COOPERATIVE_STARTED' : 'PRESSURE_STARTED'); notes.push(`实付一行动、十二灵性、五精神${spiritId ? `，${s.spirits[spiritId].name}实付三灵性并保持内收` : ''}，从原位开启二十秒短窗；尚未发生应用。`); break;
    }
    case 'TEST_PRESSURE': { const ability = s.window?.kind === 'PRESSURE_BEARING'; s.device.testEventId = h.eventId; s.device.testMethod = ability ? 'ABILITY' : 'ORDINARY'; if (ability) { s.pressureApplied = true; s.window!.applicationEventId = h.eventId; e.mastery = [HANGED_MAN_ABILITY_IDS[0]]; receipt(s, h, 'PRESSURE_APPLIED'); } endWindow(s, h, 'TEST_FINISHED'); notes.push(ability ? '本人在短窗内实际承担三健康的局部压力，稳住封闩完成一次检查；源压力仍为三。' : '用已安装的普通支撑完成一次真实检查；不增加未应用技巧的掌握。'); break; }
    case 'APPLY_SEAL': case 'MANUAL_SEAL': { const ability = c.type === 'APPLY_SEAL', seal = ability ? s.seals.find(x => x.id === s.window!.sealId)! : blankSeal(s)!; seal.status = 'APPLIED'; seal.charges = 0; seal.appliedEventId = h.eventId; seal.targetVersion = s.device.revision; s.device.sealedEventId = h.eventId; if (ability) { s.cooperativeSealApplied = true; s.window!.applicationEventId = h.eventId; e.mastery = [HANGED_MAN_ABILITY_IDS[1]]; receipt(s, h, 'COOPERATIVE_APPLIED'); } endWindow(s, h, 'SEAL_FINISHED'); notes.push(ability ? '在同一原灵的有限遮护下，把同一张实购封条实际贴到封闩，唯一一次用量耗尽。' : '亲手把同一张实购封条贴到已测试的封闩，用量耗尽；没有获得未应用技巧的掌握。'); break; }
    case 'END_CONTACT': endWindow(s, h, 'CONTACT_ENDED'); notes.push('在当前位置结束短窗并松手，保留全部已付成本；没有移动或补充任何原灵。'); break;
    case 'STOP_METHOD': endWindow(s, h, 'METHOD_STOPPED'); closeConsent(s); s.status = 'ABORTED'; notes.push('停止本次未完成作业，结束当前许可；所有人仍须从各自位置实际退出，既有消耗不退。'); break;
    case 'WAIT_10': notes.push('实际等待十秒；有限短窗不会续期。'); break;
    case 'REPORT_RETURN': s.returnReportEventId = h.eventId; closeConsent(s); s.status = 'COMPLETED'; notes.push('如实记录本次完成或停止的练习和实际返程；只为确实发生的能力应用保留掌握。'); break;
  }
  receipt(s, h, c.type);
  if (s.window && !windowCurrent(s, { ...h, second: h.second + e.seconds })) { endWindow(s, h, 'WINDOW_EXPIRED'); notes.push('短窗在当前位置失效，已经支付的费用不退。'); }
  return { state: s, effect: e, notes };
}

/** Recommendations never re-buy a paid shift or repeatedly restart a cancelled window. */
export function desiredHangedManSceneCommand(s: HangedManScene, h: HangedManSceneHost): HangedManCommand | null {
  const simple = (type: 'ASK_OWNER' | 'INSPECT_EXIT' | 'USE_WINCH' | 'OPEN_EXIT' | 'CLOSE_EXIT' | 'APPROACH' | 'WALK_EXIT' | 'INSPECT_DEVICE' | 'BUY_BRACE' | 'TEST_PRESSURE' | 'STOP_METHOD' | 'END_CONTACT' | 'BUY_SEAL' | 'MANUAL_SEAL' | 'NEXT_WEEK' | 'WORK'): HangedManCommand => ({ type });
  const cleanup = (): HangedManCommand | null => {
    if (s.window || s.contact) return simple('END_CONTACT');
    if (!outside(s)) {
      if (s.exit.winch !== 'LOCKED') return simple('USE_WINCH');
      if (s.exit.door !== 'OPEN') return simple('OPEN_EXIT');
      const w = s.workers.find(person => person.position !== 'OUTSIDE');
      return w ? { type: 'EXIT_WORKER', workerId: w.id } : simple('WALK_EXIT');
    }
    if (s.segments.B.open) return { type: 'CLOSE_SEGMENT', segment: 'B' };
    if (s.segments.A.open) return { type: 'CLOSE_SEGMENT', segment: 'A' };
    if (s.exit.door === 'OPEN') return simple('CLOSE_EXIT');
    return null;
  };
  if (s.playerPosition === 'ORIGINAL_ENTRY') return { type: 'LEAVE_ORIGINAL_COURT' };
  if (s.returnReportEventId) return null;
  if (s.phase === 'PREPARATION' && s.evacuationReportEventId) return h.sequence === 0 ? { type: 'START_PRACTICE' } : null;
  if (s.window) { const apply: HangedManCommand = { type: s.window.kind === 'PRESSURE_BEARING' ? 'TEST_PRESSURE' : 'APPLY_SEAL' }; return !hangedManSceneBlock(s, apply, h) ? apply : simple('END_CONTACT'); }
  const evacuated = s.workers.every(w => !!w.passage.a && !!w.passage.b && !!w.passage.exit);
  if (s.status === 'ABORTED' || s.phase === 'PREPARATION' && evacuated || s.phase === 'PRACTICE' && !!s.device.sealedEventId) {
    const next = cleanup(); if (next) return next;
    if (h.actions < 1 && (s.owner.consent === 'GRANTED' || s.workers.some(w => w.consent === 'GRANTED'))) return simple('STOP_METHOD');
    if (s.phase === 'PRACTICE' || evacuated) return h.actions < 1 ? simple('NEXT_WEEK') : { type: s.phase === 'PRACTICE' ? 'REPORT_RETURN' : 'REPORT_EVACUATION' };
    return s.owner.consent === 'GRANTED' || s.workers.some(w => w.consent === 'GRANTED') ? simple('STOP_METHOD') : null;
  }
  if (!permitted(s, h)) {
    if (!settled(s)) return simple('STOP_METHOD');
    if (s.phase === 'PREPARATION') {
      if (h.actions < 1) return simple('NEXT_WEEK');
      const needed = s.workers.filter(w => !w.paidEventId).length * HANGED_MAN_PRICES.workerService + (s.device.braceBoughtEventId ? 0 : HANGED_MAN_PRICES.ordinaryBrace);
      if (h.cash < needed) return simple('WORK');
    }
    return simple('ASK_OWNER');
  }
  if (s.phase === 'PRACTICE' && !blankSeal(s) && !s.device.sealedEventId) return s.playerPosition === 'OUTSIDE' && h.cash >= HANGED_MAN_PRICES.seal && h.actions >= 1 ? simple('BUY_SEAL') : simple('STOP_METHOD');
  if (!s.exit.inspectedEventId) return simple('INSPECT_EXIT');
  if (s.exit.winch !== 'LOCKED') return simple('USE_WINCH');
  if (s.exit.door !== 'OPEN') return simple('OPEN_EXIT');
  const surveyed = !!s.device.inspectedEventId && !!s.device.testEventId;
  if (!surveyed) {
    if (s.playerPosition === 'OUTSIDE') return simple('APPROACH');
    if (s.playerPosition === 'ENTRY') return !s.segments.A.inspectedEventId ? { type: 'INSPECT_SEGMENT', segment: 'A' } : !s.segments.A.open ? { type: 'OPEN_SEGMENT', segment: 'A' } : { type: 'CROSS', actorId: 'PLAYER', segment: 'A' };
    if (s.playerPosition === 'MIDPOINT') return !s.segments.B.inspectedEventId ? { type: 'INSPECT_SEGMENT', segment: 'B' } : !s.segments.B.open ? { type: 'OPEN_SEGMENT', segment: 'B' } : { type: 'CROSS', actorId: 'PLAYER', segment: 'B' };
    if (!s.device.inspectedEventId) return simple('INSPECT_DEVICE');
    const bear: HangedManCommand = { type: 'BEAR_PRESSURE' };
    if (s.phase === 'PRACTICE' && !hasReceipt(s, 'PRESSURE_STARTED') && h.actions >= 2 && !hangedManSceneBlock(s, bear, h)) return bear;
    if (!s.device.braced) return h.cash >= HANGED_MAN_PRICES.ordinaryBrace ? simple('BUY_BRACE') : simple('STOP_METHOD');
    return simple('TEST_PRESSURE');
  }
  if (s.phase === 'PREPARATION') {
    if (s.playerPosition !== 'OUTSIDE') return simple('WALK_EXIT');
    if (h.actions < 1) return simple('STOP_METHOD');
    const unasked = s.workers.find(w => w.consent !== 'GRANTED' && !w.passage.exit);
    if (unasked) { const ask: HangedManCommand = { type: 'ASK_WORKER', workerId: unasked.id }; return !hangedManSceneBlock(s, ask, h) ? ask : simple('STOP_METHOD'); }
    const w = s.workers.find(person => !person.passage.exit);
    if (!w) return simple('STOP_METHOD');
    if (w.position === 'OUTSIDE') return { type: 'ARRIVE_WORKER', workerId: w.id };
    if (w.position === 'GATE') return { type: 'EXIT_WORKER', workerId: w.id };
    const segment = w.position === 'ENTRY' ? 'A' : 'B';
    return !s.segments[segment].open ? { type: 'OPEN_SEGMENT', segment } : { type: 'CROSS', actorId: w.id, segment };
  }
  if (s.playerPosition !== 'GATE') return simple('STOP_METHOD');
  if (!hasReceipt(s, 'COOPERATIVE_STARTED') && h.actions >= 2) for (const spiritId of ['THT3-HELENA', 'THT3-ROLAND'] as const) { const c: HangedManCommand = { type: 'COOPERATIVE_SEAL', spiritId }; if (!hangedManSceneBlock(s, c, h)) return c; }
  const manual = simple('MANUAL_SEAL'); return !hangedManSceneBlock(s, manual, h) ? manual : simple('STOP_METHOD');
}

function label(c: HangedManCommand): string {
  if ('workerId' in c) return `${HANGED_MAN_WORKERS.find(w => w.id === c.workerId)!.name}${c.type === 'ASK_WORKER' ? '独立同意并核付本班工钱' : c.type === 'WITHDRAW_WORKER' ? '撤回作业同意' : c.type === 'ARRIVE_WORKER' ? '亲走两米到入口' : '沿普通侧门实际退出'}`;
  if (c.type === 'CROSS') return `${c.actorId === 'PLAYER' ? '本人' : HANGED_MAN_WORKERS.find(w => w.id === c.actorId)!.name}亲走${c.segment}段三米`;
  if ('segment' in c) return `${c.type === 'INSPECT_SEGMENT' ? '现场查验' : c.type === 'OPEN_SEGMENT' ? '打开' : '关闭'}${c.segment}段普通门`;
  if (c.type === 'COOPERATIVE_SEAL') return `与${c.spiritId === 'THT3-HELENA' ? '赫莲娜的短暂屏护' : '罗兰的局部遮护'}协同贴封`;
  const labels: Partial<Record<HangedManCommand['type'], string>> = { LEAVE_ORIGINAL_COURT: '亲走两米离开原院入口', ASK_OWNER: '当面重询玛拉本次许可', WITHDRAW_OWNER: '玛拉撤回本次许可', APPROACH: '本人亲走两米到入口', INSPECT_EXIT: '查明普通绞盘、侧门与退路', INSPECT_DEVICE: '亲查眼前有限压力封闩', BUY_BRACE: '实购并安装普通支撑', BUY_SEAL: '实购一张新封条', USE_WINCH: '拉动普通绞盘并锁稳', OPEN_EXIT: '打开普通侧门', CLOSE_EXIT: '所有人退出后关闭侧门', REPORT_EVACUATION: '报告两位成人的真实撤离', START_PRACTICE: '独自开始有限练习', BEAR_PRESSURE: '实付成本开启有限承压', TEST_PRESSURE: '实际完成一次局部测试', APPLY_SEAL: '在短窗内贴上同一张封条', MANUAL_SEAL: '普通手工贴上同一张封条', STOP_METHOD: '停止本次作业并保留成本', END_CONTACT: '松手并结束当前短窗', WAIT_10: '实际等待十秒', WALK_EXIT: '本人沿普通侧廊退出', RETURN_ON_FOOT: '本人实际步行退出', REPORT_RETURN: '如实报告练习与返程' };
  return labels[c.type] ?? '继续现场行动';
}
export function hangedManSceneActions(s: HangedManScene, host?: HangedManSceneHost): { command: HangedManCommand; label: string; cost: string }[] {
  const h = host ?? { eventId: 'preview', revision: 0, actorId: s.window?.actorId ?? 'PLAYER', week: s.owner.permissionWeek ?? 0, second: s.window?.createdAt ?? 0, sequence: s.phase === 'PRACTICE' ? 0 as const : 1 as const, actions: 3, cash: 10000, health: 100, mind: 100, spirituality: 150 };
  const commands: HangedManCommand[] = [], add = (c: HangedManCommand) => { if (isHangedManSceneCommand(c) && !commands.some(other => stableStringify(other) === stableStringify(c))) commands.push(c); };
  const desired = desiredHangedManSceneCommand(s, h); if (desired) add(desired);
  if (s.status === 'COMPLETED') return commands.map(c => ({ command: c, label: label(c), cost: '0行动 · 1秒' }));
  if (s.window || s.contact) { add({ type: 'END_CONTACT' }); if (s.window) add({ type: 'WAIT_10' }); }
  if (s.playerPosition !== 'OUTSIDE' && s.playerPosition !== 'ORIGINAL_ENTRY') add({ type: 'WALK_EXIT' });
  if (s.exit.inspectedEventId && s.exit.winch === 'READY') add({ type: 'USE_WINCH' });
  if (s.exit.winch === 'LOCKED' && s.exit.door === 'CLOSED') add({ type: 'OPEN_EXIT' });
  for (const w of s.workers) { if (w.position !== 'OUTSIDE') add({ type: 'EXIT_WORKER', workerId: w.id }); if (w.consent === 'GRANTED') add({ type: 'WITHDRAW_WORKER', workerId: w.id }); }
  if (s.owner.consent === 'GRANTED') add({ type: 'WITHDRAW_OWNER' });
  if (s.status === 'ACTIVE') add({ type: 'STOP_METHOD' });
  if (s.status === 'ABORTED' && settled(s) && !s.returnReportEventId) add({ type: 'ASK_OWNER' });
  if (s.phase === 'PRACTICE' && s.playerPosition === 'GATE' && !s.window) {
    for (const spiritId of ['THT3-HELENA', 'THT3-ROLAND'] as const) { const c: HangedManCommand = { type: 'COOPERATIVE_SEAL', spiritId }; if (!hangedManSceneBlock(s, c, h)) add(c); }
    if (!hangedManSceneBlock(s, { type: 'MANUAL_SEAL' }, h)) add({ type: 'MANUAL_SEAL' });
  }
  return commands.map(c => { const e = cost(c, s), parts = [`${e.actions}行动`, ...(e.cash ? [`${e.cash}便士`] : []), ...(e.spirituality ? [`${e.spirituality}灵性`] : []), ...(e.mind ? [`${e.mind}精神`] : []), ...(e.health ? [`${e.health}健康`] : []), ...(c.type === 'COOPERATIVE_SEAL' ? ['原灵3灵性'] : []), `${e.seconds}秒`]; return { command: c, label: label(c), cost: parts.join(' · ') }; });
}
