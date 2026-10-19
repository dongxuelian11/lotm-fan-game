import {
  HERMIT_ABILITIES, HERMIT_ARCHIVISTS, HERMIT_MOVE_LINE, HERMIT_PRACTICE_COSTS, HERMIT_PRICES,
  type HermitArchivist, type HermitPosition,
} from './content.js';
import type { HermitSource } from './source.js';
import type { HermitCommand, HermitEffect, HermitScene, HermitSceneHost } from './types.js';

const EXIT_METRES: Record<HermitPosition, number> = { OUTSIDE: 0, ENTRY: 2, MIDPOINT: 5, DESTINATION: 8 };
const SCENE_COMMANDS = new Set([
  'APPROACH', 'REST_OUTSIDE', 'START_PRACTICE', 'WAIT_10',
  'ASK_OWNER', 'WITHDRAW_OWNER', 'REGISTER_MOVE_LINE', 'READ_RECORD', 'BUY_SEAL',
  'HANDOVER_RECORD', 'RECEIVE_RECORD', 'RETURN_RECORD', 'ASK_ARCHIVIST', 'WITHDRAW_ARCHIVIST',
  'ARRIVE_ARCHIVIST', 'EXIT_ARCHIVIST', 'INSPECT_SEGMENT', 'OPEN_SEGMENT', 'CLOSE_SEGMENT',
  'CROSS', 'INSPECT_SIDE_PATH', 'INSPECT_SLIT', 'BLOCK_SLIT', 'REPORT_PASSAGE',
  'ENTER_INFORMATION_FORM', 'CROSS_INFORMATION_ROUTE', 'RECONSTRUCT', 'TOUCH_READ_RECORD',
  'TRANSFER_READ_LINE', 'END_CONTACT', 'CLOSE_CONTACT', 'ORDINARY_COPY_SEAL', 'CLEAR_SHUTTER',
  'WALK_SIDE_PATH', 'AFFIX_SEAL', 'PAUSE_SHIFT', 'REPORT_RETURN',
]);
const STOP_COMMANDS = new Set(['WITHDRAW_OWNER', 'WITHDRAW_ARCHIVIST', 'PAUSE_SHIFT', 'END_CONTACT', 'CLOSE_CONTACT', 'RECONSTRUCT', 'WAIT_10', 'BLOCK_SLIT', 'CLOSE_SEGMENT']);
const OUTSIDE_COMMANDS = new Set(['RETURN_ON_FOOT', 'WALK_SIDE_PATH', 'EXIT_ARCHIVIST', 'RETURN_RECORD', 'CLOSE_SEGMENT', 'END_CONTACT', 'CLOSE_CONTACT', 'RECONSTRUCT', 'PAUSE_SHIFT', 'WITHDRAW_OWNER', 'WITHDRAW_ARCHIVIST', 'WAIT_10']);
const clone = <T>(value: T): T => structuredClone(value);
const emptyEffect = (): HermitEffect => ({ actions: 0, cash: 0, spirituality: 0, mind: 0, seconds: 1 });
const worker = (s: HermitScene, id: string): HermitArchivist | undefined => s.workers.find(w => w.id === id);
const consent = (s: HermitScene, h: HermitSceneHost): boolean => s.owner.alive && s.owner.consent === 'GRANTED' && s.owner.permissionEventId !== null && s.owner.permissionWeek === h.week;
const peopleOutside = (s: HermitScene): boolean => s.playerPosition === 'OUTSIDE' && s.owner.position === 'OUTSIDE' && s.workers.every(w => w.position === 'OUTSIDE');
const safeClosed = (s: HermitScene): boolean => peopleOutside(s) && s.body === 'SOLID' && !s.window && !s.contact && s.custody.holder === 'OWNER' && s.custody.position === s.owner.position;
const currentRead = (s: HermitScene, h: HermitSceneHost): boolean => consent(s, h) && !!s.reading && s.reading.permissionVersion === s.owner.permissionVersion && s.reading.ownerPermissionEventId === s.owner.permissionEventId && s.reading.recordVersion === s.recordVersion && s.reading.position === s.playerPosition && s.custody.position === s.playerPosition && s.reading.actualText === s.moveLine;
const latestBlank = (s: HermitScene) => s.seals.find(seal => seal.status === 'BLANK');
const latestWritten = (s: HermitScene) => [...s.seals].reverse().find(seal => seal.status === 'WRITTEN' && seal.recordVersion === s.recordVersion);
const receipt = (s: HermitScene, h: HermitSceneHost, kind: string, actorId = 'PLAYER', position = s.playerPosition): void => {
  s.receipts.push({ eventId: h.eventId, kind, actorId, position, recordVersion: s.recordVersion });
};
const hasReceipt = (s: HermitScene, kind: string, eventId?: string | null): boolean => s.receipts.some(r => r.kind === kind && (eventId === undefined || r.eventId === eventId));
const route = (segment: 'A' | 'B'): { from: HermitPosition; to: HermitPosition } => segment === 'A' ? { from: 'ENTRY', to: 'MIDPOINT' } : { from: 'MIDPOINT', to: 'DESTINATION' };
function target(s: HermitScene, c: Extract<HermitCommand, { type: 'CROSS' }>): HermitPosition | null {
  const position = c.actorId === 'PLAYER' ? s.playerPosition : worker(s, c.actorId)?.position;
  const path = route(c.segment);
  return position === path.from ? path.to : position === path.to ? path.from : null;
}
function energyBlock(energy: number, paid: number, destination: HermitPosition): string | null {
  return energy < paid + EXIT_METRES[destination] ? '精力不足以完成这一步并沿普通侧廊退出；须先真实回到馆外休息。' : null;
}
function cost(c: HermitCommand, s: HermitScene): HermitEffect {
  const e = emptyEffect();
  if (['INSPECT_SEGMENT', 'INSPECT_SIDE_PATH', 'INSPECT_SLIT', 'REPORT_PASSAGE', 'REPORT_RETURN'].includes(c.type)) { e.actions = 1; e.seconds = 30; }
  if (c.type === 'ASK_ARCHIVIST') e.cash = HERMIT_PRICES.archivistService;
  if (c.type === 'BUY_SEAL') e.cash = HERMIT_PRICES.seal;
  if (c.type === 'CLEAR_SHUTTER') { e.cash = HERMIT_PRICES.shutterKit; e.seconds = 60; }
  if (c.type === 'REST_OUTSIDE') e.seconds = 1800;
  if (c.type === 'APPROACH' || c.type === 'ARRIVE_ARCHIVIST') e.seconds = 2;
  if (c.type === 'CROSS' || c.type === 'CROSS_INFORMATION_ROUTE') e.seconds = 3;
  if (c.type === 'RETURN_ON_FOOT' || c.type === 'WALK_SIDE_PATH') e.seconds = EXIT_METRES[s.playerPosition];
  if (c.type === 'EXIT_ARCHIVIST') e.seconds = EXIT_METRES[worker(s, c.archivistId)?.position ?? 'OUTSIDE'];
  if (c.type === 'WAIT_10') e.seconds = 10;
  if (c.type === 'REGISTER_MOVE_LINE' || c.type === 'READ_RECORD' || c.type === 'ORDINARY_COPY_SEAL') e.seconds = 15;
  if (c.type === 'TRANSFER_READ_LINE') e.seconds = 5;
  if (c.type === 'ENTER_INFORMATION_FORM') { e.actions = 1; e.spirituality = HERMIT_PRACTICE_COSTS.informationForm.spirituality; e.mind = HERMIT_PRACTICE_COSTS.informationForm.mind; }
  if (c.type === 'TOUCH_READ_RECORD') { e.actions = 1; e.spirituality = HERMIT_PRACTICE_COSTS.readline.spirituality; e.mind = HERMIT_PRACTICE_COSTS.readline.mind; }
  return e;
}

/** Copy only continuing people and the one owned record. The inherited archive leaf,
 * source journals, spent materials and old ability mastery remain in the frozen source. */
export function createHermitScene(source: HermitSource): HermitScene {
  const original = source.originals.site;
  const iris = original.iris;
  if (!iris || !iris.alive || iris.location !== 'OUTSIDE' || original.playerLocation !== 'OUTSIDE' || original.body !== 'SOLID' || original.form.active || original.record?.id !== 'PM3-BOUNDARY-RECORD' || original.record.location !== 'OWNER' || original.record.quantity !== 1) throw Error('原人、原物须真实归还并在馆外，才能继续本次搬迁。');
  return {
    phase: 'PREPARATION', status: 'ACTIVE', playerPosition: 'OUTSIDE', playerEnergy: original.playerEnergy,
    playerTravelMetres: original.playerTravelMetres, body: 'SOLID',
    owner: { id: 'PM3-IRIS', name: iris.name, age: iris.age, alive: iris.alive, position: 'OUTSIDE', energy: iris.energy, travelMetres: iris.travelMetres, consent: 'CLOSED', permissionVersion: 0, permissionEventId: null, permissionWeek: null },
    workers: HERMIT_ARCHIVISTS.map(w => ({ ...w, alive: true, health: 100, energy: 80, position: 'OUTSIDE', walkedMetres: 0, consent: 'UNASKED', permissionVersion: 0, arrivalEventId: null, permissionEventId: null, passage: { a: null, b: null, sideExit: null } })),
    custody: { recordId: 'PM3-BOUNDARY-RECORD', quantity: 1, ownerId: 'PM3-IRIS', holder: 'OWNER', position: 'OUTSIDE', handoverEventId: null, receivedEventId: null, returnEventId: null, boxId: 'HM222-ARCHIVE-BOX', sealed: false },
    segments: { A: { inspectedEventId: null, open: false }, B: { inspectedEventId: null, open: false } },
    sidePathEventId: null, slit: { inspectedEventId: null, connected: true, open: true, origin: 'MIDPOINT', destination: 'DESTINATION', metres: 3 },
    shutter: 'OPEN', shutterEventId: null, recordVersion: 0, moveLine: null, annotationEventId: null, reading: null,
    contact: false, window: null, formMoved: false, seals: [], moves: [], receipts: [], reportEventId: null,
    preparationReportEventId: null, returnReportEventId: null, informationCompleted: false, transferCompleted: false, manualCopyCompleted: false,
  };
}
export const isHermitSceneCommand = (command: HermitCommand): boolean => SCENE_COMMANDS.has(command.type);
export const hermitSceneInside = (s: HermitScene): boolean => !safeClosed(s) || s.segments.A.open || s.segments.B.open || s.workers.some(w => w.consent === 'GRANTED') || s.owner.consent === 'GRANTED';

/** All preconditions, including costs and the ordinary exit reserve, are checked
 * before cloning or changing state. A refused action has no receipt or expense. */
export function hermitSceneBlock(s: HermitScene, c: HermitCommand, h: HermitSceneHost): string | null {
  if (!isHermitSceneCommand(c)) return '这不是本现场的行动。';
  if (h.health <= 0 || h.mind <= 0) return '本人已不能继续行动。';
  const e = cost(c, s);
  if (h.actions < e.actions || h.cash < e.cash || h.spirituality < e.spirituality || h.mind <= e.mind) return '本次行动、费用、灵性或精神不足；不会先收费用再拒绝。';
  if (s.status === 'COMPLETED' && !['START_PRACTICE', 'REST_OUTSIDE'].includes(c.type)) return '本次报告已经完成；保留实际交接结果。';
  if (s.body === 'INFORMATION' && c.type !== 'CROSS_INFORMATION_ROUTE' && !STOP_COMMANDS.has(c.type)) return '先在本人当前停靠位置重新凝聚，不能同时保留实体行动。';
  if (s.status === 'ABORTED' && !OUTSIDE_COMMANDS.has(c.type) && !['ASK_OWNER', 'REST_OUTSIDE', 'REPORT_RETURN', 'START_PRACTICE'].includes(c.type)) return '本次已中断；先沿普通路归还记录并让所有人退出，再当面重新询问。';
  const ownerNeeded = ['REGISTER_MOVE_LINE', 'READ_RECORD', 'HANDOVER_RECORD', 'RECEIVE_RECORD', 'ASK_ARCHIVIST', 'ENTER_INFORMATION_FORM', 'TOUCH_READ_RECORD', 'TRANSFER_READ_LINE', 'ORDINARY_COPY_SEAL', 'AFFIX_SEAL'];
  if (ownerNeeded.includes(c.type) && !consent(s, h)) return '须取得艾瑞丝对本周本次记录、阅读和保管的独立许可。';
  if (s.window && h.second >= s.window.expiresAt && !STOP_COMMANDS.has(c.type)) return '短窗已到期；先停止并在实际位置收束。';
  switch (c.type) {
    case 'START_PRACTICE': return h.sequence !== 0 || s.phase !== 'PREPARATION' || !s.preparationReportEventId || !safeClosed(s) ? '须真实晋升、完成搬迁报告且所有人原物已在馆外。' : null;
    case 'ASK_OWNER': return !safeClosed(s) || s.owner.consent === 'GRANTED' && s.owner.permissionWeek === h.week && s.status !== 'ABORTED' || !s.owner.alive || s.phase === 'PREPARATION' && !!s.preparationReportEventId ? '须在馆外对仍持有原记录的艾瑞丝重新当面询问。' : null;
    case 'WITHDRAW_OWNER': return s.owner.consent !== 'GRANTED' ? '当前没有可撤回的所有者许可。' : null;
    case 'ASK_ARCHIVIST': {
      const w = worker(s, c.archivistId);
      if (h.actions < (s.phase === 'PRACTICE' ? 3 : 1)) return '须先留足本班实际应用与报告的行动，再分别支付工钱。';
      return !w || !w.alive || w.age < 18 || w.health <= 0 || w.position !== 'OUTSIDE' || s.playerPosition !== 'OUTSIDE' || w.consent === 'GRANTED' || !s.sidePathEventId || !s.segments.A.inspectedEventId || !s.segments.B.inspectedEventId ? '先查清两段路与普通退路，再在馆外分别询问仍自愿的成年档案员并支付本班工钱。' : energyBlock(w.energy, 8, 'DESTINATION');
    }
    case 'WITHDRAW_ARCHIVIST': return worker(s, c.archivistId)?.consent !== 'GRANTED' ? '该人当前没有可撤回的作业许可。' : null;
    case 'ARRIVE_ARCHIVIST': {
      const w = worker(s, c.archivistId);
      return !w || !w.alive || w.health <= 0 || w.consent !== 'GRANTED' || w.position !== 'OUTSIDE' || !consent(s, h) || !s.sidePathEventId ? '须本人已同意并实付本班工钱，才会亲走到入口。' : energyBlock(w.energy, 2, 'ENTRY');
    }
    case 'EXIT_ARCHIVIST': {
      const w = worker(s, c.archivistId);
      return !w || w.position === 'OUTSIDE' ? '该人已经在馆外。' : !s.sidePathEventId ? '普通侧廊尚未实际检查。' : energyBlock(w.energy, EXIT_METRES[w.position], 'OUTSIDE');
    }
    case 'REST_OUTSIDE': return s.playerPosition !== 'OUTSIDE' || s.body !== 'SOLID' || s.window || s.contact ? '须本人先真实退出、结束短窗和接触，才能休息。' : s.playerEnergy >= 100 ? '本人精力已满。' : null;
    case 'APPROACH': return s.playerPosition !== 'OUTSIDE' || !s.sidePathEventId ? '先在馆外检查普通侧廊，再走到入口。' : energyBlock(s.playerEnergy, 2, 'ENTRY');
    case 'RETURN_ON_FOOT': case 'WALK_SIDE_PATH': return s.playerPosition === 'OUTSIDE' ? '本人已在馆外。' : !s.sidePathEventId ? '普通侧廊尚未检查。' : energyBlock(s.playerEnergy, EXIT_METRES[s.playerPosition], 'OUTSIDE');
    case 'INSPECT_SIDE_PATH': return s.sidePathEventId ? '普通侧廊已检查。' : s.playerPosition !== 'OUTSIDE' ? '须从馆外实际检查各停靠点的普通退出路线。' : null;
    case 'INSPECT_SEGMENT': return s.segments[c.segment].inspectedEventId ? '这一段已经实际检查。' : s.playerPosition !== route(c.segment).from ? '须本人先走到这段路的起点再检查。' : null;
    case 'OPEN_SEGMENT': return !s.segments[c.segment].inspectedEventId || s.segments[c.segment].open ? '须先检查尚未打开的这一段。' : c.segment === 'B' && s.shutter === 'JAMMED' ? '挡板仍卡住，开门不能凭空修好机械障碍。' : null;
    case 'CLOSE_SEGMENT': return !s.segments[c.segment].open ? '这一段已经关闭。' : null;
    case 'CROSS': {
      const to = target(s, c), w = c.actorId === 'PLAYER' ? null : worker(s, c.actorId);
      if (!to || !s.segments[c.segment].inspectedEventId || !s.segments[c.segment].open || c.segment === 'B' && s.shutter === 'JAMMED') return '本人须在这段已查明且仍开放的三米道路的一端。';
      if (c.actorId !== 'PLAYER' && (!w || w.consent !== 'GRANTED' || !w.alive || w.health <= 0 || !consent(s, h))) return '须该成年档案员仍自愿，且保管许可仍有效。';
      return energyBlock(w ? w.energy : s.playerEnergy, 3, to);
    }
    case 'REGISTER_MOVE_LINE': return s.playerPosition !== s.owner.position || s.custody.holder !== 'OWNER' || s.custody.position !== s.owner.position || s.annotationEventId !== null ? '须在原记录仍由艾瑞丝实际持有时由她当面新写本次搬迁批注；不能改写旧文字。' : null;
    case 'READ_RECORD': return s.custody.position !== s.playerPosition || !s.annotationEventId || s.moveLine !== HERMIT_MOVE_LINE || s.window ? '须本人在同一原页旁，取得现行阅读许可后实际阅读新批注。' : null;
    case 'HANDOVER_RECORD': {
      const mira = worker(s, 'HM222-MIRA'), niles = worker(s, 'HM222-NILES');
      if (s.custody.holder === 'OWNER') return !mira || mira.consent !== 'GRANTED' || mira.position !== s.owner.position || s.playerPosition !== s.owner.position || !currentRead(s, h) ? '须在艾瑞丝与米拉同处馆外时，先亲读新批注，再把同一记录交给已同意的米拉。' : null;
      return s.custody.holder !== 'HM222-MIRA' || !mira || !niles || mira.position !== 'MIDPOINT' || niles.position !== 'MIDPOINT' || s.custody.position !== 'MIDPOINT' || s.playerPosition !== 'MIDPOINT' || mira.consent !== 'GRANTED' || niles.consent !== 'GRANTED' ? '须米拉、奈尔斯和同一封箱实际在中点，当面交接。' : null;
    }
    case 'RECEIVE_RECORD': return s.custody.holder !== 'HM222-NILES' || s.custody.position !== 'DESTINATION' || worker(s, 'HM222-NILES')?.position !== 'DESTINATION' || s.workers.some(w => w.position !== 'DESTINATION' || !w.passage.a || !w.passage.b) || !!s.custody.receivedEventId ? '须奈尔斯亲自把原箱搬到终点，再当面写收件回执。' : null;
    case 'RETURN_RECORD': return s.custody.holder === 'OWNER' || s.custody.position !== s.owner.position || s.owner.position !== 'OUTSIDE' || s.playerPosition !== 'OUTSIDE' || !s.owner.alive ? '实际持箱人须沿普通侧廊把同一箱送到馆外，由艾瑞丝亲自接收。' : null;
    case 'INSPECT_SLIT': return s.phase !== 'PRACTICE' || s.playerPosition !== 'MIDPOINT' || s.slit.inspectedEventId ? '须在本次练习的中点亲查三米检修缝及两端凝聚空位。' : null;
    case 'BLOCK_SLIT': return s.phase !== 'PRACTICE' || !s.slit.open ? '检修缝当前未开放。' : null;
    case 'ENTER_INFORMATION_FORM': return h.sequence !== 0 || s.phase !== 'PRACTICE' || s.shutter !== 'JAMMED' || s.playerPosition !== s.slit.origin || s.body !== 'SOLID' || s.window || s.contact || !s.slit.inspectedEventId || !s.slit.connected || !s.slit.open ? '须以实体在已查验的缝隙起点，确认三米连接、终点凝聚位和当前许可；只通过本人。' : energyBlock(s.playerEnergy, HERMIT_PRACTICE_COSTS.informationForm.energy, s.slit.destination);
    case 'CROSS_INFORMATION_ROUTE': return s.body !== 'INFORMATION' || s.window?.kind !== 'PERSONAL_FORM' || s.formMoved || s.playerPosition !== s.slit.origin || !s.slit.inspectedEventId || !s.slit.connected || !s.slit.open || !consent(s, h) || h.second + e.seconds >= s.window.expiresAt ? '有限信息短窗、现行许可或已检查的连通缝隙已失效；不得继续移动。' : null;
    case 'RECONSTRUCT': return s.body !== 'INFORMATION' || s.window?.kind !== 'PERSONAL_FORM' ? '本人已是实体，没有需要重复付费或重组的分身。' : null;
    case 'BUY_SEAL': return s.phase !== 'PRACTICE' || s.playerPosition !== 'OUTSIDE' || s.custody.position !== 'OUTSIDE' || !!latestBlank(s) ? '须在馆外购买本次尚未持有的一枚新空白封签。' : null;
    case 'TOUCH_READ_RECORD': return h.sequence !== 0 || s.phase !== 'PRACTICE' || s.body !== 'SOLID' || s.window || !currentRead(s, h) || !latestBlank(s) ? '须实体在同一记录旁，重新亲读当前版本并同时接触已购空白封签。' : energyBlock(s.playerEnergy, HERMIT_PRACTICE_COSTS.readline.energy, s.playerPosition);
    case 'TRANSFER_READ_LINE': {
      const w = s.window, seal = s.seals.find(item => item.id === w?.sealId);
      return w?.kind !== 'READLINE' || !s.contact || !currentRead(s, h) || w.readingEventId !== s.reading?.readEventId || w.permissionVersion !== s.owner.permissionVersion || w.targetVersion !== s.recordVersion || !seal || seal.status !== 'BLANK' ? '须持续接触同一原页和封签，在15秒内完成实际已读文字的转录。' : null;
    }
    case 'ORDINARY_COPY_SEAL': return s.phase !== 'PRACTICE' || s.window || !currentRead(s, h) || !latestBlank(s) ? '须实际亲读当前原页，并有同一枚实购空白封签，才能普通手抄。' : null;
    case 'AFFIX_SEAL': return s.phase !== 'PRACTICE' || s.window || s.custody.position !== s.playerPosition || s.custody.holder === 'OWNER' || !latestWritten(s) ? '须在实际原箱旁，把本次已写成的同一封签贴到箱上。' : null;
    case 'CLEAR_SHUTTER': return s.phase !== 'PRACTICE' || s.shutter !== 'JAMMED' || !['MIDPOINT', 'DESTINATION'].includes(s.playerPosition) || s.window ? '须实体到卡住的挡板旁，实付有限工具并亲手清障。' : null;
    case 'END_CONTACT': case 'CLOSE_CONTACT': return !s.contact && !s.window ? '当前已经没有接触或短窗。' : null;
    case 'WAIT_10': return !s.window ? '当前没有可等待到期的短窗。' : null;
    case 'PAUSE_SHIFT': return s.status === 'ABORTED' ? '本班已经暂停；仍须真实归还原物并退出。' : null;
    case 'REPORT_PASSAGE': return s.phase !== 'PREPARATION' || !!s.preparationReportEventId || s.status !== 'ACTIVE' || !safeClosed(s) || s.segments.A.open || s.segments.B.open || !s.custody.receivedEventId || !s.custody.returnEventId || !hasReceipt(s, 'OWNER_RECEIVED', s.custody.returnEventId) || s.workers.some(w => !w.passage.a || !w.passage.b || !w.passage.sideExit) ? '须两名成年人各自走完两段并沿侧廊退出，原箱真实签收、归还及所有者确认，最后关闭道路与接触。' : null;
    case 'REPORT_RETURN': return s.phase !== 'PRACTICE' || !!s.returnReportEventId || !safeClosed(s) || s.segments.A.open || s.segments.B.open || !s.custody.returnEventId || !hasReceipt(s, 'OWNER_RECEIVED', s.custody.returnEventId) || s.status !== 'ABORTED' && (!s.custody.receivedEventId || !s.custody.sealed || !(s.informationCompleted || s.shutter === 'CLEARED') || !(s.transferCompleted || s.manualCopyCompleted) || s.workers.some(w => !w.passage.a || !w.passage.b || !w.passage.sideExit)) ? '须同一记录已真实交还，所有人已退出、实体无短窗、道路关闭；未完成的练习只能如实记录为中断。' : null;
    default: return '这一步不适用于本现场。';
  }
}

function finishWindow(s: HermitScene, h: HermitSceneHost, e: HermitEffect, why: string): void {
  if (s.window?.kind === 'PERSONAL_FORM') {
    s.body = 'SOLID';
    receipt(s, h, 'RECONSTRUCTED');
    if (s.formMoved) {
      s.informationCompleted = true;
      e.mastery = [...(e.mastery ?? []), HERMIT_ABILITIES[0]!.id];
      receipt(s, h, 'INFORMATION_PASSAGE_COMPLETED');
    }
  }
  if (s.window) receipt(s, h, why);
  s.window = null;
  s.contact = false;
  s.formMoved = false;
}
function move(s: HermitScene, h: HermitSceneHost, actorId: string, to: HermitPosition, metres: number, mode: 'WALK' | 'INFORMATION' = 'WALK'): void {
  const person = actorId === 'PLAYER' ? null : worker(s, actorId)!;
  const from = person ? person.position : s.playerPosition;
  const carriedRecord = person !== null && s.custody.holder === person.id;
  if (person) { person.position = to; person.energy -= metres; person.walkedMetres += metres; }
  else { s.playerPosition = to; s.playerTravelMetres += metres; if (mode === 'WALK') s.playerEnergy -= metres; s.reading = null; s.contact = false; }
  if (carriedRecord) { s.custody.position = to; s.contact = false; s.reading = null; }
  s.moves.push({ eventId: h.eventId, actorId, from, to, metres, carriedRecord, mode });
}
export function applyHermitScene(scene: HermitScene, command: HermitCommand, host: HermitSceneHost): { state: HermitScene; effect: HermitEffect; notes: string[] } {
  const blocked = hermitSceneBlock(scene, command, host);
  if (blocked) throw Error(blocked);
  const s = clone(scene), c = command, h = host, e = cost(c, s), notes: string[] = [];
  // Contact and its read permission do not travel with the player or the page.
  if (s.window?.kind === 'READLINE' && (['APPROACH', 'RETURN_ON_FOOT', 'WALK_SIDE_PATH', 'HANDOVER_RECORD', 'RETURN_RECORD'].includes(c.type) || c.type === 'CROSS' && c.actorId === 'PLAYER' || c.type === 'EXIT_ARCHIVIST' && s.custody.holder === c.archivistId || c.type === 'CROSS' && s.custody.holder === c.actorId)) finishWindow(s, h, e, 'CONTACT_INTERRUPTED');
  switch (c.type) {
    case 'START_PRACTICE':
      s.phase = 'PRACTICE'; s.status = 'ACTIVE'; s.owner.consent = 'CLOSED'; s.owner.permissionEventId = null; s.owner.permissionWeek = null;
      s.custody.handoverEventId = null; s.custody.receivedEventId = null; s.custody.returnEventId = null; s.custody.sealed = false;
      s.reading = null; s.reportEventId = null;
      s.workers.forEach(w => { w.consent = 'CLOSED'; w.arrivalEventId = null; w.permissionEventId = null; w.passage = { a: null, b: null, sideExit: null }; });
      receipt(s, h, 'PRACTICE_STARTED'); notes.push('仍是同一现场、同一所有者与原记录；两人须重新同意、收取本班工钱并亲自到场。'); break;
    case 'ASK_OWNER':
      if (s.status === 'ABORTED') {
        s.custody.handoverEventId = null; s.custody.receivedEventId = null; s.custody.returnEventId = null;
        s.workers.forEach(w => { w.consent = 'CLOSED'; w.arrivalEventId = null; w.permissionEventId = null; w.passage = { a: null, b: null, sideExit: null }; });
      }
      s.status = 'ACTIVE'; s.owner.consent = 'GRANTED'; s.owner.permissionVersion += 1; s.owner.permissionEventId = h.eventId; s.owner.permissionWeek = h.week; s.reading = null;
      receipt(s, h, 'OWNER_PERMISSION', s.owner.id, s.owner.position); notes.push('艾瑞丝在馆外当面授予本周、本次记录的阅读、搬运与普通归还许可；她没有进入廊内。'); break;
    case 'WITHDRAW_OWNER':
      s.owner.consent = 'WITHDRAWN'; s.owner.permissionVersion += 1; s.status = 'ABORTED'; s.reading = null;
      finishWindow(s, h, e, 'OWNER_WITHDREW'); receipt(s, h, 'OWNER_WITHDREW', s.owner.id, s.owner.position);
      notes.push('所有者已撤回许可；停止练习，只保留实际费用与已走路程，接下来普通归还同一记录。'); break;
    case 'ASK_ARCHIVIST': {
      const w = worker(s, c.archivistId)!;
      w.consent = 'GRANTED'; w.permissionVersion += 1; w.permissionEventId = h.eventId; w.arrivalEventId = null; w.passage = { a: null, b: null, sideExit: null };
      receipt(s, h, 'PAID_SHIFT_PERMISSION', w.id, w.position); notes.push(`${w.name}本人同意本班搬迁，实收${e.cash}便士；这一步没有移动她或他。`); break;
    }
    case 'WITHDRAW_ARCHIVIST': {
      const w = worker(s, c.archivistId)!;
      w.consent = 'WITHDRAWN'; w.permissionVersion += 1; s.status = 'ABORTED'; s.reading = null;
      finishWindow(s, h, e, 'WORKER_WITHDREW'); receipt(s, h, 'WORKER_WITHDREW', w.id, w.position);
      notes.push(`${w.name}撤回作业同意；本人和实物仍在当前地点，可自主沿普通侧廊退出。`); break;
    }
    case 'ARRIVE_ARCHIVIST': {
      const w = worker(s, c.archivistId)!;
      move(s, h, w.id, 'ENTRY', 2); w.arrivalEventId = h.eventId;
      receipt(s, h, 'WORKER_ARRIVED', w.id, w.position); notes.push(`${w.name}实际走2米到入口，支付2精力和2秒。`); break;
    }
    case 'EXIT_ARCHIVIST': {
      const w = worker(s, c.archivistId)!, metres = EXIT_METRES[w.position];
      if (!w.passage.a || !w.passage.b || !s.custody.receivedEventId) s.status = 'ABORTED';
      move(s, h, w.id, 'OUTSIDE', metres); w.passage.sideExit = h.eventId;
      if (w.consent === 'GRANTED') w.consent = 'CLOSED';
      receipt(s, h, 'WORKER_EXITED', w.id, 'OUTSIDE'); notes.push(`${w.name}沿已查明的普通侧廊实际走${metres}米到馆外${s.custody.holder === w.id ? '，亲自携带原箱与其中的封签' : ''}；不另付行动点或工钱。`); break;
    }
    case 'REST_OUTSIDE': {
      const restored = Math.min(20, 100 - s.playerEnergy); s.playerEnergy += restored;
      receipt(s, h, 'OUTSIDE_REST'); notes.push(`本人在馆外实休1800秒，恢复${restored}精力；没有治疗伤势、补灵性或替别人恢复精力。`); break;
    }
    case 'APPROACH': move(s, h, 'PLAYER', 'ENTRY', 2); notes.push('本人实际走2米进入入口，支付2精力与2秒，普通退出余力仍保留。'); break;
    case 'RETURN_ON_FOOT': case 'WALK_SIDE_PATH': {
      const metres = EXIT_METRES[s.playerPosition]; move(s, h, 'PLAYER', 'OUTSIDE', metres);
      notes.push(`本人沿已检查的普通侧廊走${metres}米回到馆外；不会携走由别人持有的封箱。`); break;
    }
    case 'INSPECT_SIDE_PATH': s.sidePathEventId = h.eventId; receipt(s, h, 'SIDE_PATH_INSPECTED'); notes.push('实际查清入口、中点、终点各自通往馆外的普通侧廊，分别为2、5、8米。'); break;
    case 'INSPECT_SEGMENT': s.segments[c.segment].inspectedEventId = h.eventId; receipt(s, h, `SEGMENT_${c.segment}_INSPECTED`); notes.push(`本人在路段起点查验${c.segment}段的三米实路；查验不等于有人通过。`); break;
    case 'OPEN_SEGMENT': s.segments[c.segment].open = true; receipt(s, h, `SEGMENT_${c.segment}_OPENED`); notes.push(`${c.segment}段普通门已实际打开。`); break;
    case 'CLOSE_SEGMENT': s.segments[c.segment].open = false; receipt(s, h, `SEGMENT_${c.segment}_CLOSED`); notes.push(`${c.segment}段普通门已关闭；普通侧廊仍可退出。`); break;
    case 'CROSS': {
      const to = target(s, c)!; move(s, h, c.actorId, to, 3);
      if (c.actorId !== 'PLAYER') { const w = worker(s, c.actorId)!; if (to === route(c.segment).to) w.passage[c.segment === 'A' ? 'a' : 'b'] = h.eventId; }
      notes.push(`${c.actorId === 'PLAYER' ? '本人' : worker(s, c.actorId)!.name}实际通过${c.segment}段3米，支付3精力、3秒${s.custody.holder === c.actorId ? '，同一原箱随持有人移动' : ''}。`); break;
    }
    case 'REGISTER_MOVE_LINE': s.moveLine = HERMIT_MOVE_LINE; s.recordVersion += 1; s.annotationEventId = h.eventId; s.reading = null; receipt(s, h, 'OWNER_NEW_ANNOTATION', s.owner.id, s.owner.position); notes.push('艾瑞丝在原记录上亲笔新增本次搬迁批注；没有填补或改写任何旧文字。'); break;
    case 'READ_RECORD':
      if (s.custody.sealed) {
        s.seals.forEach(seal => { if (seal.status === 'APPLIED') seal.status = 'SPENT'; });
        s.transferCompleted = false; s.manualCopyCompleted = false; receipt(s, h, 'APPLIED_SEAL_BROKEN_FOR_READING');
      }
      s.custody.sealed = false;
      s.reading = { recordId: 'PM3-BOUNDARY-RECORD', ownerPermissionEventId: s.owner.permissionEventId!, permissionVersion: s.owner.permissionVersion, recordVersion: s.recordVersion, readEventId: h.eventId, readAt: h.second + e.seconds, position: s.playerPosition, actualText: s.moveLine! };
      s.contact = true; receipt(s, h, 'ACTUAL_READ'); notes.push(`本人取得现行许可，实际打开原箱并读到新批注：“${s.reading.actualText}”。其他旧文、缺文仍未知。`); break;
    case 'HANDOVER_RECORD':
      s.custody.holder = s.custody.holder === 'OWNER' ? 'HM222-MIRA' : 'HM222-NILES';
      s.custody.position = worker(s, s.custody.holder)!.position; s.custody.handoverEventId = h.eventId; s.contact = false; s.reading = null;
      receipt(s, h, s.custody.holder === 'HM222-MIRA' ? 'OWNER_TO_MIRA' : 'MIRA_TO_NILES', s.custody.holder, s.custody.position);
      notes.push(`同一原箱当面交到${worker(s, s.custody.holder)!.name}手中，所有权仍归艾瑞丝；原记录数量始终为1。`); break;
    case 'RECEIVE_RECORD':
      s.custody.receivedEventId = h.eventId; receipt(s, h, 'DESTINATION_RECEIVED', 'HM222-NILES', 'DESTINATION');
      if (s.phase === 'PRACTICE') { s.shutter = 'JAMMED'; s.shutterEventId = h.eventId; s.segments.B.open = false; receipt(s, h, 'RETURN_SHUTTER_JAMMED', 'HM222-NILES', 'DESTINATION'); }
      notes.push(s.phase === 'PRACTICE' ? '奈尔斯在终点真实签收原箱。返程挡板随即卡住箱宽通道；三米检修缝的连通与普通侧廊分别保留，封箱不会化成信息。' : '奈尔斯在终点真实签收同一原箱；两位档案员仍须亲自退出并把原箱归还。'); break;
    case 'RETURN_RECORD':
      s.custody.holder = 'OWNER'; s.custody.position = s.owner.position; s.custody.returnEventId = h.eventId;
      s.owner.consent = 'CLOSED'; s.contact = false; s.reading = null;
      receipt(s, h, 'OWNER_RECEIVED', s.owner.id, s.owner.position); notes.push('艾瑞丝在馆外从实际持箱人手里接回同一原箱并当面确认；所有权未转移，阅读与保管接触已关闭。'); break;
    case 'INSPECT_SLIT': s.slit.inspectedEventId = h.eventId; receipt(s, h, 'SLIT_AND_RECONSTRUCTION_POSITIONS_INSPECTED'); notes.push('本人实际核对三米检修缝、起点与终点的凝聚空位；检修缝无法容纳原箱。'); break;
    case 'BLOCK_SLIT': s.slit.open = false; finishWindow(s, h, e, 'SLIT_BLOCKED'); receipt(s, h, 'SLIT_BLOCKED'); notes.push('检修缝被遮断，停止前进并在本人已到达的位置凝聚；没有返回起点的传送。'); break;
    case 'ENTER_INFORMATION_FORM':
      s.playerEnergy -= HERMIT_PRACTICE_COSTS.informationForm.energy; s.body = 'INFORMATION'; s.formMoved = false; s.reading = null;
      s.window = { kind: 'PERSONAL_FORM', createdAt: h.second, expiresAt: h.second + HERMIT_PRACTICE_COSTS.informationForm.seconds, startPosition: s.playerPosition, permissionVersion: s.owner.permissionVersion, targetVersion: s.recordVersion, readingEventId: null, recordId: null, sealId: null };
      receipt(s, h, 'INFORMATION_FORM_PAID'); notes.push('实付1行动、18灵性、6精神和10精力，其中已含凝聚储备；本人短窗最多10秒，原箱、原页和封签仍由原持箱人保管。'); break;
    case 'CROSS_INFORMATION_ROUTE': move(s, h, 'PLAYER', s.slit.destination, s.slit.metres, 'INFORMATION'); s.formMoved = true; receipt(s, h, 'INFORMATION_MOVED'); notes.push('只有本人沿已查验检修缝实际移动3米到终点；没有运送封箱、复制身体或恢复伤势。'); break;
    case 'RECONSTRUCT': finishWindow(s, h, e, 'INFORMATION_STOPPED'); notes.push('本人在当前真实停靠位重新凝聚；凝聚已预付，只有实际通过后的凝聚才增长掌握。'); break;
    case 'BUY_SEAL': {
      const id = `${h.eventId}:seal`;
      s.seals.push({ id, status: 'BLANK', content: null, boughtEventId: h.eventId, writtenEventId: null, appliedEventId: null, recordVersion: null });
      receipt(s, h, 'NEW_SEAL_PACKED_WITH_BOX', s.custody.holder, s.custody.position); notes.push('实付20便士取得一枚新空白封签，放入馆外同一原箱的耗材袋；随实际持箱人运送，不随本人信息移动。'); break;
    }
    case 'TOUCH_READ_RECORD':
      s.playerEnergy -= HERMIT_PRACTICE_COSTS.readline.energy; s.contact = true;
      s.window = { kind: 'READLINE', createdAt: h.second, expiresAt: h.second + HERMIT_PRACTICE_COSTS.readline.seconds, startPosition: s.playerPosition, permissionVersion: s.owner.permissionVersion, targetVersion: s.recordVersion, readingEventId: s.reading!.readEventId, recordId: s.custody.recordId, sealId: latestBlank(s)!.id };
      receipt(s, h, 'READLINE_WINDOW_PAID'); notes.push('实付1行动、12灵性、5精神与3精力，开始最多15秒的同页同封签接触；开窗没有产生文字或掌握。'); break;
    case 'TRANSFER_READ_LINE': case 'ORDINARY_COPY_SEAL': {
      const seal = c.type === 'TRANSFER_READ_LINE' ? s.seals.find(item => item.id === s.window!.sealId)! : latestBlank(s)!;
      if (c.type === 'TRANSFER_READ_LINE' && h.second + e.seconds >= s.window!.expiresAt) {
        seal.status = 'SPENT'; seal.content = null; seal.writtenEventId = h.eventId; seal.recordVersion = s.recordVersion;
        receipt(s, h, 'PARTIAL_TRANSFER_SPENT'); finishWindow(s, h, e, 'WINDOW_EXPIRED');
        notes.push('实际写入尚未完成，15秒短窗到期；该枚封签已有不完整笔迹而耗尽，费用不退，不增长掌握。'); break;
      }
      const text = Array.from(s.reading!.actualText).slice(0, HERMIT_PRACTICE_COSTS.readline.maxCharacters).join('');
      seal.status = 'WRITTEN'; seal.content = text; seal.writtenEventId = h.eventId; seal.recordVersion = s.recordVersion;
      if (c.type === 'TRANSFER_READ_LINE') receipt(s, h, 'TRANSFER_WRITTEN');
      else receipt(s, h, 'MANUAL_COPY_WRITTEN');
      s.window = null; s.contact = false;
      notes.push(`同一枚实购封签实际写成“${text}”，已耗用，原记录完全不变；仍须亲手贴上原箱。`); break;
    }
    case 'AFFIX_SEAL': {
      const seal = latestWritten(s)!; seal.status = 'APPLIED'; seal.appliedEventId = h.eventId; s.custody.sealed = true; s.contact = false;
      if (hasReceipt(s, 'TRANSFER_WRITTEN', seal.writtenEventId)) { s.transferCompleted = true; e.mastery = [...(e.mastery ?? []), HERMIT_ABILITIES[1]!.id]; }
      if (hasReceipt(s, 'MANUAL_COPY_WRITTEN', seal.writtenEventId)) s.manualCopyCompleted = true;
      receipt(s, h, 'SEAL_PHYSICALLY_AFFIXED'); notes.push('本人把已写成的同一枚封签实际贴到原箱；封签不能再用，原箱仍由实际持箱人保管。'); break;
    }
    case 'CLEAR_SHUTTER': s.shutter = 'CLEARED'; s.shutterEventId = h.eventId; receipt(s, h, 'PAID_MANUAL_SHUTTER_CLEAR'); notes.push('实付30便士有限工具，实体本人花60秒亲手清开挡板；能力没有修好机械装置。'); break;
    case 'END_CONTACT': case 'CLOSE_CONTACT': finishWindow(s, h, e, 'CONTACT_CLOSED'); s.reading = null; notes.push('已停止接触和短窗；已付资源不退还，实物仍留在原持有人手中。'); break;
    case 'WAIT_10': notes.push('实际经过10秒；没有续期、回补资源或移动任何人。'); break;
    case 'PAUSE_SHIFT':
      s.status = 'ABORTED'; s.reading = null; finishWindow(s, h, e, 'SHIFT_PAUSED'); s.owner.consent = 'CLOSED';
      s.workers.forEach(w => { if (w.consent === 'GRANTED') w.consent = 'CLOSED'; });
      receipt(s, h, 'SHIFT_PAUSED'); notes.push('本班停止，保留全部费用、路程、签收与原物当前位置；仍须沿普通侧廊归还并退出，重新服务须另付新班工钱。'); break;
    case 'REPORT_PASSAGE': s.reportEventId = h.eventId; s.preparationReportEventId = h.eventId; s.status = 'COMPLETED'; s.owner.consent = 'CLOSED'; receipt(s, h, 'PREPARATION_REPORTED'); notes.push('已核实两位成年人的两段实际通行、普通退出、原箱交接、终点签收与所有者接回确认；晋升准备据此成立。'); break;
    case 'REPORT_RETURN': s.reportEventId = h.eventId; s.returnReportEventId = h.eventId; if (s.status !== 'ABORTED') s.status = 'COMPLETED'; s.owner.consent = 'CLOSED'; receipt(s, h, s.status === 'ABORTED' ? 'ABORTED_RETURN_REPORTED' : 'PRACTICE_RETURN_REPORTED'); notes.push(s.status === 'ABORTED' ? '原人原物已经普通退出并归还；本次练习如实记为中断，不补造能力成功。' : '同一原箱、原记录与实耗封签已交回，所有人实体退出且接触与道路关闭；两种方法只按实际回执记录。'); break;
  }
  if (s.window && h.second + e.seconds >= s.window.expiresAt) { finishWindow(s, h, e, 'WINDOW_EXPIRED'); notes.push('有限短窗已真实到期，在当前有效位置收束，不撤回已发生的位移。'); }
  return { state: s, effect: e, notes };
}

/** One bounded next step, with surveys and the remaining AP checked before wages.
 * Outside rest always consumes actual time. Ordinary exits never need AP or cash. */
export function desiredHermitSceneCommand(s: HermitScene, h: HermitSceneHost): HermitCommand | null {
  const command = (type: 'WALK_SIDE_PATH' | 'APPROACH' | 'REST_OUTSIDE' | 'NEXT_WEEK' | 'PAUSE_SHIFT' | 'END_CONTACT' | 'RETURN_RECORD'): HermitCommand => ({ type });
  const closeGates = (): HermitCommand | null => s.segments.B.open ? { type: 'CLOSE_SEGMENT', segment: 'B' } : s.segments.A.open ? { type: 'CLOSE_SEGMENT', segment: 'A' } : null;
  const leave = (): HermitCommand | null => {
    if (s.window || s.contact) return command('END_CONTACT');
    if (s.playerPosition !== 'OUTSIDE') return command('WALK_SIDE_PATH');
    const insideWorker = s.workers.find(w => w.position !== 'OUTSIDE');
    if (insideWorker) return { type: 'EXIT_ARCHIVIST', archivistId: insideWorker.id };
    if (s.custody.holder !== 'OWNER') return command('RETURN_RECORD');
    return closeGates();
  };
  if (s.body === 'INFORMATION') {
    const cross: HermitCommand = { type: 'CROSS_INFORMATION_ROUTE' };
    return !s.formMoved && !hermitSceneBlock(s, cross, h) ? cross : { type: 'RECONSTRUCT' };
  }
  if (s.window) {
    const transfer: HermitCommand = { type: 'TRANSFER_READ_LINE' };
    return !hermitSceneBlock(s, transfer, h) ? transfer : command('END_CONTACT');
  }
  if (s.phase === 'PREPARATION' && s.preparationReportEventId) return h.sequence === 0 ? { type: 'START_PRACTICE' } : null;
  if (s.phase === 'PRACTICE' && s.returnReportEventId) return null;
  if (s.status === 'ABORTED') {
    const cleanup = leave(); if (cleanup) return cleanup;
    if (s.phase === 'PRACTICE' && s.custody.returnEventId) return h.actions < 1 ? command('NEXT_WEEK') : { type: 'REPORT_RETURN' };
    if (h.actions < (s.phase === 'PRACTICE' ? 3 : 1)) return command('NEXT_WEEK');
    return { type: 'ASK_OWNER' };
  }
  if (s.custody.returnEventId) {
    const cleanup = leave(); if (cleanup) return cleanup;
    if (h.actions < 1) return command('NEXT_WEEK');
    return { type: s.phase === 'PREPARATION' ? 'REPORT_PASSAGE' : 'REPORT_RETURN' };
  }
  const surveysDone = !!s.sidePathEventId && !!s.segments.A.inspectedEventId && !!s.segments.B.inspectedEventId && (s.phase === 'PREPARATION' || !!s.slit.inspectedEventId);
  if (!surveysDone) {
    if (h.actions < 1) {
      if (s.playerPosition !== 'OUTSIDE') return command('WALK_SIDE_PATH');
      const gate = closeGates(); if (gate) return gate;
      if (s.owner.consent === 'GRANTED' || s.workers.some(w => w.consent === 'GRANTED')) return command('PAUSE_SHIFT');
      return command('NEXT_WEEK');
    }
    if (s.playerPosition === 'OUTSIDE' && s.playerEnergy < 12) return command('REST_OUTSIDE');
    if (!s.sidePathEventId) return { type: 'INSPECT_SIDE_PATH' };
    if (s.playerPosition === 'OUTSIDE') return command('APPROACH');
    if (!s.segments.A.inspectedEventId) return { type: 'INSPECT_SEGMENT', segment: 'A' };
    if (s.playerPosition === 'ENTRY') return !s.segments.A.open ? { type: 'OPEN_SEGMENT', segment: 'A' } : { type: 'CROSS', actorId: 'PLAYER', segment: 'A' };
    if (!s.segments.B.inspectedEventId) return { type: 'INSPECT_SEGMENT', segment: 'B' };
    if (s.phase === 'PRACTICE' && !s.slit.inspectedEventId) return { type: 'INSPECT_SLIT' };
  }
  const shiftStarted = s.workers.some(w => w.consent === 'GRANTED') || s.custody.holder !== 'OWNER';
  if (!shiftStarted && !s.custody.receivedEventId) {
    if (s.playerPosition !== 'OUTSIDE') return command('WALK_SIDE_PATH');
    const gates = closeGates(); if (gates) return gates;
    if (s.playerEnergy < (s.phase === 'PRACTICE' ? 30 : 16)) return command('REST_OUTSIDE');
    const neededAP = s.phase === 'PRACTICE' ? 3 : 1;
    if (h.actions < neededAP) return s.owner.consent === 'GRANTED' ? command('PAUSE_SHIFT') : command('NEXT_WEEK');
    const cashNeeded = HERMIT_PRICES.archivistService * 2 + (s.phase === 'PRACTICE' && !latestBlank(s) ? HERMIT_PRICES.seal : 0);
    if (h.cash < cashNeeded) return s.owner.consent === 'GRANTED' ? command('PAUSE_SHIFT') : { type: 'WORK' };
    if (s.phase === 'PRACTICE' && (h.spirituality < 30 || h.mind <= 11)) return s.owner.consent === 'GRANTED' ? command('PAUSE_SHIFT') : { type: 'REST' };
  }
  if (!consent(s, h)) {
    if (!safeClosed(s)) return command('PAUSE_SHIFT');
    return { type: 'ASK_OWNER' };
  }
  if (!s.annotationEventId) return { type: 'REGISTER_MOVE_LINE' };
  if (s.custody.holder === 'OWNER') {
    if (!currentRead(s, h)) return { type: 'READ_RECORD' };
    if (s.phase === 'PRACTICE' && !latestBlank(s)) return { type: 'BUY_SEAL' };
    const unasked = s.workers.find(w => w.consent !== 'GRANTED');
    if (unasked) return { type: 'ASK_ARCHIVIST', archivistId: unasked.id };
    return { type: 'HANDOVER_RECORD' };
  }
  if (!s.custody.receivedEventId) {
    const outsideWorker = s.workers.find(w => w.position === 'OUTSIDE');
    if (outsideWorker) return { type: 'ARRIVE_ARCHIVIST', archivistId: outsideWorker.id };
    if (s.playerPosition === 'OUTSIDE') return command('APPROACH');
    if (!s.segments.A.open) return { type: 'OPEN_SEGMENT', segment: 'A' };
    if (s.playerPosition === 'ENTRY') return { type: 'CROSS', actorId: 'PLAYER', segment: 'A' };
    const atEntry = s.workers.find(w => w.position === 'ENTRY');
    if (atEntry) return { type: 'CROSS', actorId: atEntry.id, segment: 'A' };
    if (s.custody.holder === 'HM222-MIRA') return { type: 'HANDOVER_RECORD' };
    if (s.shutter === 'JAMMED') return { type: 'CLEAR_SHUTTER' };
    if (!s.segments.B.open) return { type: 'OPEN_SEGMENT', segment: 'B' };
    const atMidpoint = s.workers.find(w => w.position === 'MIDPOINT');
    if (atMidpoint) return { type: 'CROSS', actorId: atMidpoint.id, segment: 'B' };
    return { type: 'RECEIVE_RECORD' };
  }
  if (s.phase === 'PREPARATION') return leave();
  if (!s.informationCompleted && s.shutter === 'JAMMED') {
    if (s.playerPosition === 'OUTSIDE') return s.playerEnergy < 30 ? command('REST_OUTSIDE') : command('APPROACH');
    if (s.playerPosition === 'ENTRY') return !s.segments.A.open ? { type: 'OPEN_SEGMENT', segment: 'A' } : { type: 'CROSS', actorId: 'PLAYER', segment: 'A' };
    const enter: HermitCommand = { type: 'ENTER_INFORMATION_FORM' };
    if (!hermitSceneBlock(s, enter, h)) return enter;
    if (s.playerEnergy < 18) return command('WALK_SIDE_PATH');
    return { type: 'CLEAR_SHUTTER' };
  }
  if (!(s.transferCompleted || s.manualCopyCompleted) || !s.custody.sealed) {
    if (s.playerPosition === 'OUTSIDE') return s.playerEnergy < 20 ? command('REST_OUTSIDE') : command('APPROACH');
    if (s.playerPosition === 'ENTRY') return !s.segments.A.open ? { type: 'OPEN_SEGMENT', segment: 'A' } : { type: 'CROSS', actorId: 'PLAYER', segment: 'A' };
    if (s.playerPosition === 'MIDPOINT') return !s.segments.B.open ? { type: 'OPEN_SEGMENT', segment: 'B' } : { type: 'CROSS', actorId: 'PLAYER', segment: 'B' };
    if (latestWritten(s)) return { type: 'AFFIX_SEAL' };
    if (!latestBlank(s)) return command('PAUSE_SHIFT');
    if (!currentRead(s, h)) return { type: 'READ_RECORD' };
    const touch: HermitCommand = { type: 'TOUCH_READ_RECORD' };
    return h.actions >= 2 && !hermitSceneBlock(s, touch, h) ? touch : { type: 'ORDINARY_COPY_SEAL' };
  }
  return leave();
}

function label(c: HermitCommand): string {
  if (c.type === 'ASK_ARCHIVIST') return `询问${c.archivistId === 'HM222-MIRA' ? '米拉' : '奈尔斯'}并实付本班工钱`;
  if (c.type === 'ARRIVE_ARCHIVIST') return `${c.archivistId === 'HM222-MIRA' ? '米拉' : '奈尔斯'}亲走到入口`;
  if (c.type === 'EXIT_ARCHIVIST') return `${c.archivistId === 'HM222-MIRA' ? '米拉' : '奈尔斯'}沿侧廊退出`;
  if (c.type === 'WITHDRAW_ARCHIVIST') return `${c.archivistId === 'HM222-MIRA' ? '米拉' : '奈尔斯'}撤回作业同意`;
  if (c.type === 'CROSS') return `${c.actorId === 'PLAYER' ? '本人' : c.actorId === 'HM222-MIRA' ? '米拉' : '奈尔斯'}亲走${c.segment}段三米`;
  if (c.type === 'INSPECT_SEGMENT') return `现场查验${c.segment}段三米路`;
  if (c.type === 'OPEN_SEGMENT' || c.type === 'CLOSE_SEGMENT') return `${c.type === 'OPEN_SEGMENT' ? '打开' : '关闭'}${c.segment}段普通门`;
  const labels: Partial<Record<HermitCommand['type'], string>> = {
    APPROACH: '本人亲走到入口', WALK_SIDE_PATH: '本人沿普通侧廊退出', REST_OUTSIDE: '馆外实际休息半小时', START_PRACTICE: '回到原现场开始有限练习',
    ASK_OWNER: '当面重询艾瑞丝本次许可', WITHDRAW_OWNER: '艾瑞丝撤回本次许可', REGISTER_MOVE_LINE: '请艾瑞丝亲写本次搬迁批注', READ_RECORD: '亲读同一记录的新批注',
    BUY_SEAL: '实购新封签并放入原箱', HANDOVER_RECORD: '在场双方亲手交接原箱', RECEIVE_RECORD: '奈尔斯在终点实际签收', RETURN_RECORD: '艾瑞丝在馆外亲自接回原箱',
    INSPECT_SIDE_PATH: '查明普通侧廊退路', INSPECT_SLIT: '亲查三米检修缝与凝聚位', BLOCK_SLIT: '检修缝被实际遮断', ENTER_INFORMATION_FORM: '支付成本并短暂化为信息',
    CROSS_INFORMATION_ROUTE: '只有本人通过三米检修缝', RECONSTRUCT: '在当前停靠位重新凝聚', TOUCH_READ_RECORD: '持续接触亲读原页和空白封签', TRANSFER_READ_LINE: '实际转录有限已读文字',
    ORDINARY_COPY_SEAL: '在同一封签上普通手抄', AFFIX_SEAL: '亲手把已写封签贴到原箱', CLEAR_SHUTTER: '实付工具并手动清开挡板', END_CONTACT: '立即结束短窗与接触', CLOSE_CONTACT: '立即结束短窗与接触',
    WAIT_10: '实际等待十秒', PAUSE_SHIFT: '暂停本班并准备普通归还', REPORT_PASSAGE: '报告真实通行与所有者确认', REPORT_RETURN: '如实报告原人原物归还', NEXT_WEEK: '在馆外进入下一周', WORK: '普通工作筹集实际费用', REST: '普通休养恢复本人状态',
  };
  return labels[c.type] ?? '继续现场行动';
}
export function hermitSceneActions(s: HermitScene, host?: HermitSceneHost): { command: HermitCommand; label: string; cost: string }[] {
  const h: HermitSceneHost = host ?? { eventId: 'preview', revision: 0, week: s.owner.permissionWeek ?? 0, second: s.window ? s.window.createdAt + 1 : 0, sequence: s.phase === 'PRACTICE' ? 0 : 1, actions: 100, cash: 100000, health: 100, mind: 100, spirituality: 150 };
  const commands: HermitCommand[] = [];
  const add = (c: HermitCommand): void => { if (isHermitSceneCommand(c) && !commands.some(other => JSON.stringify(other) === JSON.stringify(c))) commands.push(c); };
  const desired = desiredHermitSceneCommand(s, h); if (desired) add(desired);
  if (s.phase === 'PREPARATION' && s.preparationReportEventId) add({ type: 'START_PRACTICE' });
  if (s.playerPosition === 'OUTSIDE') {
    if (s.segments.A.open) add({ type: 'CLOSE_SEGMENT', segment: 'A' });
    if (s.segments.B.open) add({ type: 'CLOSE_SEGMENT', segment: 'B' });
  }
  if (s.body === 'INFORMATION') { add({ type: 'RECONSTRUCT' }); add({ type: 'WAIT_10' }); add({ type: 'BLOCK_SLIT' }); }
  else if (s.window) { add({ type: 'END_CONTACT' }); add({ type: 'WAIT_10' }); }
  else {
    if (s.playerPosition !== 'OUTSIDE') add({ type: 'WALK_SIDE_PATH' });
    if (s.contact) add({ type: 'END_CONTACT' });
    if (s.phase === 'PRACTICE' && s.shutter === 'JAMMED' && ['MIDPOINT', 'DESTINATION'].includes(s.playerPosition)) add({ type: 'CLEAR_SHUTTER' });
    if (s.phase === 'PRACTICE' && s.reading && latestBlank(s)) add({ type: 'ORDINARY_COPY_SEAL' });
    for (const w of s.workers) {
      if (w.position !== 'OUTSIDE') add({ type: 'EXIT_ARCHIVIST', archivistId: w.id });
      if (w.consent === 'GRANTED') add({ type: 'WITHDRAW_ARCHIVIST', archivistId: w.id });
    }
    if (s.owner.consent === 'GRANTED') add({ type: 'WITHDRAW_OWNER' });
    if (s.status === 'ACTIVE' && (s.owner.consent === 'GRANTED' || s.workers.some(w => w.consent === 'GRANTED'))) add({ type: 'PAUSE_SHIFT' });
    if (s.playerPosition === 'OUTSIDE' && s.playerEnergy < 100) add({ type: 'REST_OUTSIDE' });
  }
  return commands.slice(0, 12).map(c => {
    const e = cost(c, s);
    const parts = [e.actions ? `${e.actions}行动` : '0行动', ...(e.cash ? [`${e.cash}便士`] : []), ...(e.spirituality ? [`${e.spirituality}灵性`] : []), ...(e.mind ? [`${e.mind}精神`] : []), `${e.seconds}秒`];
    if (c.type === 'ENTER_INFORMATION_FORM') parts.push('10精力，预付凝聚');
    else if (c.type === 'TOUCH_READ_RECORD') parts.push('3精力');
    else if (['APPROACH', 'ARRIVE_ARCHIVIST', 'CROSS', 'WALK_SIDE_PATH', 'EXIT_ARCHIVIST'].includes(c.type)) parts.push(`${e.seconds}精力`);
    return { command: c, label: label(c), cost: parts.join('·') };
  });
}
