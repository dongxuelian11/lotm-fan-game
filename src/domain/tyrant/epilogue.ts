import type { PublicCheckResult } from '../../shared/contracts.js';
import { emptyTyrantEffect, type TyrantCoastsState, type TyrantEffect, type TyrantHost, type TyrantSceneInjury } from './coasts.js';

/** A distinct finite accident after actual promotion. No old coast resident,
 * population, grain, characteristic or promotion receipt is moved or reset. */
export const TYRANT_EPILOGUE_LOCATION = 'TYRANT0-RESCUE';
export const TYRANT_EPILOGUE_ABILITY_IDS = ['tyrant.s0.bounded-storm', 'tyrant.s0.matter-energy'] as const;
export const TYRANT_EPILOGUE_COMMANDS = ['OBSERVE', 'ASK_PERMISSION', 'DIVERT_WATER', 'RESCUE_IVA', 'RESCUE_TOMAS', 'ISOLATE', 'SECURE_ROPE', 'BUY_CARRIER', 'VERIFY_ENERGY', 'VERIFY_MATERIAL', 'RELEASE_ENERGY', 'STOP_EFFECTS', 'WITHDRAW', 'REPORT'] as const;
export type TyrantEpilogueCommand = { type: typeof TYRANT_EPILOGUE_COMMANDS[number] };
type Receipt = { eventId: string; actorId: string; week: number; second: number };
type ResidentId = 'TYRANT0-IVA' | 'TYRANT0-TOMAS';
export interface TyrantEpilogueResident {
  id: ResidentId; name: string; age: number; position: number; location: string;
  injury: { id: string; severity: 'LIGHT' | 'HEAVY'; description: string; active: true };
  permission: (Receipt & { answer: 'ACCEPT' }) | null;
  arrival: (Receipt & { from: number; to: 0; travelledMeters: number; playerWalkedMeters: number; route: 'DIVERTED_WATER' | 'ORDINARY_SHORE' | 'ORIGINAL_ROPE'; diversionEventId: string | null }) | null;
}
export interface TyrantEpilogueState {
  version: 1; id: string; actorId: string; location: typeof TYRANT_EPILOGUE_LOCATION;
  origin: { runId: string; coastReviewEventIds: string[]; coastJournalEventIds: string[] };
  startedWeek: number; startedSecond: number; lastSecond: number;
  status: 'ACTIVE' | 'RESOLVED' | 'WITHDRAWN' | 'DEAD'; position: number; reported: boolean;
  observed: Receipt | null; residents: TyrantEpilogueResident[];
  water: { id: 'TYRANT0-ORIGINAL-WATER'; inlet: 'TYRANT0-INLET'; channel: 'TYRANT0-CHANNEL'; connected: boolean; isolated: Receipt | null };
  diversion: { attempted: boolean; passed: boolean; receipt: Receipt | null; expiresSecond: number | null; applied: boolean; assists: (Receipt & { residentId: ResidentId })[] };
  rope: { id: 'TYRANT0-ORIGINAL-ROPE'; ownerId: 'TYRANT0-HARBOUR-STORE'; condition: number; secured: Receipt | null; uses: number };
  pressure: { id: 'TYRANT0-ORIGINAL-PRESSURE'; sourceObjectId: 'TYRANT0-PRESSURE-CHAMBER'; position: 4; originalUnits: 36; remainingUnits: number;
    verification: (Receipt & { sourceObjectId: 'TYRANT0-PRESSURE-CHAMBER'; measuredUnits: number; independentMechanicalTest: true }) | null };
  carrier: { id: 'TYRANT0-ORIGINAL-CONDUIT'; ownerId: string; holder: 'STORE' | 'PLAYER' | 'CONNECTION' | 'SINK'; position: number; stock: 0 | 1; condition: number;
    bought: (Receipt & { cashCost: 24 }) | null; verification: (Receipt & { carrierId: 'TYRANT0-ORIGINAL-CONDUIT'; independentContinuityTest: true }) | null;
    consumed: (Receipt & { originalUnitsTransferred: number }) | null };
  sink: { id: 'TYRANT0-DRY-SINK'; position: 4; capacity: 36; absorbedUnits: number; verified: Receipt | null };
  release: { attempted: boolean; passed: boolean; receipt: Receipt | null; transferredUnits: number };
  playerInjuries: TyrantSceneInjury[];
  journal: { eventId: string; actorId: string; revision: number; week: number; command: TyrantEpilogueCommand;
    beforeSecond: number; afterSecond: number; from: number; to: number; walkedMeters: number;
    residentPositionsBefore: { id: ResidentId; position: number }[]; residentPositionsAfter: { id: ResidentId; position: number }[];
    energyBefore: number; energyAfter: number; sinkBefore: number; sinkAfter: number; carrierConsumedId: string | null;
    check: PublicCheckResult | null; effect: TyrantEffect; masteryGains: Record<string, number>; notes: string[] }[];
}
type CurrentInjury = { id: string; severity: 'LIGHT' | 'HEAVY'; acquiredRevision: number; treatedRevision: number | null };
const clone = <T>(v: T): T => structuredClone(v);
const passed = (check: PublicCheckResult | null) => check?.tier === 'SUCCESS' || check?.tier === 'GREAT_SUCCESS';
const alive = (h: TyrantHost) => h.status === 'ACTIVE' && h.health > 0 && h.mind > 0;
export const tyrantEpilogueNeedsCheck = (c: TyrantEpilogueCommand) => c.type === 'DIVERT_WATER' || c.type === 'RELEASE_ENERGY';
const rescueId = (c: TyrantEpilogueCommand): ResidentId | null => c.type === 'RESCUE_IVA' ? 'TYRANT0-IVA' : c.type === 'RESCUE_TOMAS' ? 'TYRANT0-TOMAS' : null;
const rescueResident = (s: TyrantEpilogueState, c: TyrantEpilogueCommand) => s.residents.find(r => r.id === rescueId(c));
const duration = (r: TyrantEpilogueResident) => r.id === 'TYRANT0-IVA' ? 32 : 56;
const liveDiversion = (s: TyrantEpilogueState, now: number, seconds: number) => s.diversion.passed && s.diversion.receipt !== null
  && s.diversion.expiresSecond !== null && now >= s.diversion.receipt.second && now + seconds <= s.diversion.expiresSecond
  && s.water.connected && s.water.isolated === null;
const allArrived = (s: TyrantEpilogueState) => s.residents.every(r => r.arrival !== null && r.position === 0);
const pressureSafe = (s: TyrantEpilogueState) => s.water.isolated !== null || s.pressure.remainingUnits === 0;
const receipt = (h: TyrantHost, seconds: number): Receipt => ({ eventId: h.eventId, actorId: h.actorId,
  week: h.week + Math.floor((h.nowSecond + seconds - h.weekAnchor) / 604800), second: h.nowSecond + seconds });

export function validateTyrantEpilogueCommand(value: unknown): value is TyrantEpilogueCommand {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
    && Object.keys(value).join('|') === 'type' && TYRANT_EPILOGUE_COMMANDS.some(t => t === (value as TyrantEpilogueCommand).type);
}
export function createTyrantEpilogue(coasts: TyrantCoastsState, input: { week: number; nowSecond: number; actorId?: string }): TyrantEpilogueState {
  if (input.actorId !== undefined && input.actorId !== coasts.actorId || !Number.isSafeInteger(input.week) || input.week < coasts.startWeek
    || !Number.isSafeInteger(input.nowSecond) || input.nowSecond < coasts.lastSecond || coasts.coasts.length !== 3
    || coasts.coasts.some(c => !c.review || !coasts.journal.some(j => j.id === c.review!.eventId && j.command.type === 'REVIEW_NEXT_WEEK' && j.command.coastId === c.id))) {
    throw Error('须由保留三处原海岸真实复核记录的同一本人进入；实际晋升另由当前角色校验。');
  }
  return { version: 1, id: `${coasts.runId}:finite-harbour-rescue`, actorId: coasts.actorId, location: TYRANT_EPILOGUE_LOCATION,
    origin: { runId: coasts.runId, coastReviewEventIds: coasts.coasts.map(c => c.review!.eventId), coastJournalEventIds: coasts.journal.map(j => j.id) },
    startedWeek: input.week, startedSecond: input.nowSecond, lastSecond: input.nowSecond, status: 'ACTIVE', position: 0, reported: false, observed: null,
    residents: [
      { id: 'TYRANT0-IVA', name: '伊芙', age: 32, position: 8, location: 'TYRANT0-EIGHT-METRE-PLATFORM',
        injury: { id: 'TYRANT0-IVA-ORIGINAL-SCRAPE', severity: 'LIGHT', description: '事故前段留下的小腿擦伤，尚未处理', active: true }, permission: null, arrival: null },
      { id: 'TYRANT0-TOMAS', name: '托马斯', age: 47, position: 14, location: 'TYRANT0-FOURTEEN-METRE-STAIR',
        injury: { id: 'TYRANT0-TOMAS-ORIGINAL-LEG-INJURY', severity: 'HEAVY', description: '事故前段造成的腿部重伤，需要后续医护', active: true }, permission: null, arrival: null },
    ],
    water: { id: 'TYRANT0-ORIGINAL-WATER', inlet: 'TYRANT0-INLET', channel: 'TYRANT0-CHANNEL', connected: true, isolated: null },
    diversion: { attempted: false, passed: false, receipt: null, expiresSecond: null, applied: false, assists: [] },
    rope: { id: 'TYRANT0-ORIGINAL-ROPE', ownerId: 'TYRANT0-HARBOUR-STORE', condition: 90, secured: null, uses: 0 },
    pressure: { id: 'TYRANT0-ORIGINAL-PRESSURE', sourceObjectId: 'TYRANT0-PRESSURE-CHAMBER', position: 4, originalUnits: 36, remainingUnits: 36, verification: null },
    carrier: { id: 'TYRANT0-ORIGINAL-CONDUIT', ownerId: 'TYRANT0-HARBOUR-STORE', holder: 'STORE', position: 0, stock: 1, condition: 80, bought: null, verification: null, consumed: null },
    sink: { id: 'TYRANT0-DRY-SINK', position: 4, capacity: 36, absorbedUnits: 0, verified: null },
    release: { attempted: false, passed: false, receipt: null, transferredUnits: 0 }, playerInjuries: [], journal: [],
  };
}
export function tyrantEpilogueCost(s: TyrantEpilogueState, c: TyrantEpilogueCommand, _h: TyrantHost): TyrantEffect {
  const e = emptyTyrantEffect();
  if (c.type === 'OBSERVE' || c.type === 'ASK_PERMISSION' || c.type === 'REPORT') e.seconds = 20;
  if (c.type === 'DIVERT_WATER') { e.actions = 1; e.spirituality = 20; e.mind = 8; e.seconds = 4; }
  if (c.type === 'RELEASE_ENERGY') { e.actions = 1; e.spirituality = 16; e.mind = 10; e.seconds = 4; }
  if (c.type === 'ISOLATE') e.seconds = 60;
  if (c.type === 'SECURE_ROPE') e.seconds = 45;
  if (c.type === 'BUY_CARRIER') { e.cashCost = 24; e.seconds = 30; }
  if (c.type === 'VERIFY_ENERGY' || c.type === 'VERIFY_MATERIAL') e.seconds = 20;
  if (c.type === 'WITHDRAW') e.seconds = 16;
  const resident = rescueResident(s, c); if (resident) e.seconds = duration(resident);
  return e;
}
export function tyrantEpilogueBlock(s: TyrantEpilogueState, c: TyrantEpilogueCommand, h: TyrantHost): string | null {
  if (!validateTyrantEpilogueCommand(c)) return '无效救援指令；不能填写伤势、居民许可、能量、成功或未来检定。';
  if (!alive(h) || h.sequence !== 0 || h.actorId !== s.actorId || h.location !== s.location || s.status === 'DEAD') return '须由同一实际晋升、仍在世的本人亲到原事故现场。';
  if (!h.eventId || !Number.isSafeInteger(h.revision) || !Number.isSafeInteger(h.nowSecond) || h.nowSecond < s.lastSecond
    || h.nowSecond < h.weekAnchor || h.nowSecond >= h.weekAnchor + 604800 || h.week < s.startedWeek
    || (s.journal.at(-1)?.revision ?? -1) >= h.revision || s.journal.some(j => j.eventId === h.eventId)) return '现场时刻、事件或版本已经失效，不能重复结算。';
  if (s.reported) return '这一次原事故已经如实交接。';
  if (c.type === 'REPORT') return s.status === 'WITHDRAWN' || allArrived(s) && pressureSafe(s) ? null : '先实际转移两位居民并隔离残压，或本人沿普通岸路撤离后如实交接未完成部分。';
  if (s.status !== 'ACTIVE') return '本次现场已经收束，只能报告真实结果。';
  const e = tyrantEpilogueCost(s, c, h);
  if (h.cash < e.cashCost || h.actions < e.actions || h.spirituality < e.spirituality || h.mind <= e.mind) return '实际现款、行动、灵性或精神不足；普通隔离、岸路、原绳救援和本人撤离不收现款或行动。';
  if (c.type === 'WITHDRAW') return null;
  if (c.type === 'OBSERVE') return s.observed ? '已亲眼核清这两位原居民、相连水道、岸路、原绳和压力装置。' : null;
  if (!s.observed) return '先亲眼观察原居民实际位置、旧伤、水道和普通退路。';
  if (c.type === 'ASK_PERMISSION') return s.residents.every(r => r.permission || r.arrival) ? '两位居民的本次求援答复已有实录，不能重复刷许可。' : null;
  if (c.type === 'ISOLATE') return s.water.isolated ? '原闸已经普通隔离，剩余压力仍封在同一个原腔内。' : null;
  if (c.type === 'SECURE_ROPE') return s.rope.secured ? '同一条原绳已经系在原岸桩，不能复制绳索。' : allArrived(s) ? '两位居民已经抵岸，无须再为练习架绳。' : null;
  if (c.type === 'STOP_EFFECTS') return s.diversion.expiresSecond === null || h.nowSecond > s.diversion.expiresSecond ? '当前没有仍有效的分流窗口。' : null;
  if (c.type === 'DIVERT_WATER') return s.diversion.attempted ? '同一原水道已经尝试一次分流；失败或过期后不能重抽。'
    : !s.water.connected || s.water.isolated || allArrived(s) ? '只为尚在原处的真实求援者分流当前相连水体；已隔离或已脱险后不能重造危险。'
    : !s.residents.every(r => r.permission) ? '先听清两位成年居民各自的本次求援答复。' : null;
  const resident = rescueResident(s, c);
  if (resident) {
    if (resident.arrival || resident.position === 0) return '这位原居民已经实际抵岸，不再重复救援或恢复伤势。';
    if (!resident.permission) return '先取得这位原居民本次同意，不能靠报告移动人。';
    return liveDiversion(s, h.nowSecond, e.seconds) || s.water.isolated || s.rope.secured && s.rope.condition >= 50 ? null
      : '须有覆盖完整往返的分流窗口，或先普通关闸疏出岸路、系好原绳；过期分流不保护本次脱险。';
  }
  if (c.type === 'BUY_CARRIER') return s.carrier.stock !== 1 || s.carrier.bought ? '库房只有这一件原导流芯，已购或已耗后不刷新。' : null;
  if (c.type === 'VERIFY_ENERGY') return !s.water.isolated ? '先普通关上原隔离闸，再在安全侧用原表独立实测残压与吸收槽。'
    : s.pressure.verification ? '同一封闭原腔已经独立实测，不反复刷核验。' : null;
  if (c.type === 'VERIFY_MATERIAL') return !s.carrier.bought || s.carrier.holder !== 'PLAYER' || s.carrier.consumed ? '先实付取得这一件尚未消耗的原导流芯。'
    : !s.pressure.verification || !s.sink.verified ? '先独立实测原压力与无人的原吸收槽，再实测原导流芯的接续。'
    : s.carrier.verification ? '同一件原材料已经独立完成接续实测，不能重复制造核验。' : null;
  if (c.type === 'RELEASE_ENERGY') return s.release.attempted ? '这一原压力源的有限转换已经尝试一次，不能重抽或补料重开。'
    : !allArrived(s) ? '先让两位原居民真实抵岸，不把尚待救援的人留下来练习转换。'
    : !s.water.isolated || !s.pressure.verification || s.pressure.verification.measuredUnits !== s.pressure.remainingUnits || !s.sink.verified ? '须先隔离并独立核验同一原压力和物理吸收槽，旧估计不能代替实测。'
    : !s.carrier.bought || !s.carrier.verification || s.carrier.holder !== 'CONNECTION' || s.carrier.position !== s.sink.position || s.carrier.consumed || s.carrier.condition < 50 ? '需要已经付费、实际接在原压力与吸收槽之间、独立实测且尚未消耗的那一件真实原导流芯。'
    : s.pressure.remainingUnits <= 0 || s.pressure.remainingUnits + s.sink.absorbedUnits > s.sink.capacity ? '同一原压力已耗尽或原槽容量不足，不能生成新能量。' : null;
  return '当前没有这项原事故行动。';
}
export function applyTyrantEpilogue(previous: TyrantEpilogueState, c: TyrantEpilogueCommand, h: TyrantHost): {
  state: TyrantEpilogueState; effect: TyrantEffect; notes: string[]; masteryGains: Record<string, number>; injuries: TyrantSceneInjury[];
} {
  const blocked = tyrantEpilogueBlock(previous, c, h); if (blocked) throw Error(blocked);
  if (tyrantEpilogueNeedsCheck(c) !== (h.check !== null)) throw Error('只有两项各一次的有限施术消费真实随机检定。');
  const s = clone(previous), e = tyrantEpilogueCost(previous, c, h), notes: string[] = [], masteryGains: Record<string, number> = {}, injuries: TyrantSceneInjury[] = [];
  const done = receipt(h, e.seconds), from = s.position; let walkedMeters = 0;
  const stop = () => { s.diversion.expiresSecond = null; };
  const resident = rescueResident(s, c);
  if (c.type === 'OBSERVE') {
    s.observed = done;
    notes.push('本人在零米安全岸台亲眼看清：伊芙在八米检修台，托马斯在十四米高阶，两人都留在原固定支撑面上。旧伤已经存在；水只来自眼前相连的原进水口与水道。普通隔离闸、岸路和原绳都可使用，未实测的残压不能当作已知能量。');
  } else if (c.type === 'ASK_PERMISSION') {
    for (const r of s.residents) if (!r.arrival && !r.permission) r.permission = { ...done, answer: 'ACCEPT' };
    notes.push('本人从原岸台分别呼问视线内的伊芙与托马斯，两位成年居民各自清楚同意沿安全岸路、原绳或有效分流通路接受协助。答复不改变位置或伤势。');
  } else if (c.type === 'DIVERT_WATER') {
    const success = passed(h.check);
    s.diversion.attempted = true; s.diversion.passed = success; s.diversion.receipt = done;
    s.diversion.expiresSecond = success ? done.second + 90 : null;
    notes.push(success ? '实际支付20灵性、8精神和1行动，将当前相连的原水暂时引向旁沟；九十秒后结束。居民仍在原处，只有实际脱险全程落在窗口内才记录应用。'
      : '这一次分流没有成立；20灵性、8精神和1行动已消耗，不能重抽。居民仍在各自原固定台阶上，普通隔离与原绳救援保持可用。');
  } else if (c.type === 'ISOLATE') {
    s.water.isolated = done; s.water.connected = false; stop(); walkedMeters = 8;
    notes.push(`本人沿安全岸面往返八米，用原手轮逐步关严隔离闸；水道停止进水并露出原岸路。原腔仍封存${s.pressure.remainingUnits}份实际残压，关闸没有生成或消耗这股能量。`);
  } else if (c.type === 'SECURE_ROPE') {
    s.rope.secured = done; s.rope.condition -= 2; walkedMeters = 8;
    notes.push('本人沿安全岸面往返八米，把唯一原绳固定在原岸桩并试紧，绳索磨损2。两位居民都可沿此普通支承路线被协助回岸；没有施术成本或额外受害者。');
  } else if (resident) {
    const assisted = liveDiversion(previous, h.nowSecond, e.seconds);
    const route = assisted ? 'DIVERTED_WATER' : s.water.isolated ? 'ORDINARY_SHORE' : 'ORIGINAL_ROPE';
    const oldPosition = resident.position; walkedMeters = oldPosition * 2;
    resident.position = 0; resident.location = 'TYRANT0-SAFE-SHORE';
    resident.arrival = { ...done, from: oldPosition, to: 0, travelledMeters: oldPosition, playerWalkedMeters: walkedMeters, route, diversionEventId: assisted ? s.diversion.receipt!.eventId : null };
    if (route === 'ORIGINAL_ROPE') { s.rope.condition -= 3; s.rope.uses++; }
    if (assisted) {
      s.diversion.assists.push({ ...done, residentId: resident.id });
      if (!s.diversion.applied) { masteryGains[TYRANT_EPILOGUE_ABILITY_IDS[0]] = 8; s.diversion.applied = true; }
    }
    notes.push(`本人从零米沿${route === 'DIVERTED_WATER' ? '仍在有效窗口内的分流通路' : route === 'ORDINARY_SHORE' ? '已普通隔离的原岸路' : '系妥的同一原绳路线'}实际抵达${oldPosition}米处，再协助${resident.name}返回零米安全岸台，往返${walkedMeters}米、${e.seconds}秒。${resident.name}的${resident.injury.severity === 'HEAVY' ? '重伤' : '擦伤'}保留，仍需后续医护。${assisted ? '本次完整脱险确实用了有效分流，原技巧本场最多增长一次掌握。' : '这次是普通实际救援，不补记过期或失败施术的掌握。'}`);
  } else if (c.type === 'BUY_CARRIER') {
    s.carrier.stock = 0; s.carrier.bought = { ...done, cashCost: 24 }; s.carrier.holder = 'PLAYER'; s.carrier.ownerId = h.actorId;
    notes.push('向原港务库房实付24便士，取得现场仅有的同一件原导流芯；原件状况80。购买没有实测接续、没有增加能量，也没有免费补货。');
  } else if (c.type === 'VERIFY_ENERGY') {
    walkedMeters = 8;
    s.pressure.verification = { ...done, sourceObjectId: s.pressure.sourceObjectId, measuredUnits: s.pressure.remainingUnits, independentMechanicalTest: true };
    s.sink.verified = done;
    notes.push(`本人沿安全岸面往返八米，读取原腔机械表并独立进行阀门回压实测，核明同一非生命原腔当前只有${s.pressure.remainingUnits}份残压；同时查看无人的四米干式吸收槽及其实际剩余容量${s.sink.capacity - s.sink.absorbedUnits}。这不是施术自动给出的结论。`);
  } else if (c.type === 'VERIFY_MATERIAL') {
    s.carrier.verification = { ...done, carrierId: s.carrier.id, independentContinuityTest: true };
    s.carrier.condition -= 1; s.carrier.holder = 'CONNECTION'; s.carrier.position = 4; walkedMeters = 8;
    notes.push('本人沿安全岸面往返八米，把同一原导流芯实际接在四米处原压力腔与相邻原吸收槽之间，亲手紧固原接头，再用独立的普通接续测试核验实体通路；原芯磨损1，留在四米原接续处。实测没有复制材料、释放压力或增长施术掌握。');
  } else if (c.type === 'RELEASE_ENERGY') {
    const success = passed(h.check), transferred = success ? s.pressure.remainingUnits : 0;
    s.release = { attempted: true, passed: success, receipt: done, transferredUnits: transferred };
    s.carrier.consumed = { ...done, originalUnitsTransferred: transferred }; s.carrier.holder = 'SINK'; s.carrier.condition = 0;
    s.pressure.remainingUnits -= transferred; s.sink.absorbedUnits += transferred;
    if (success) masteryGains[TYRANT_EPILOGUE_ABILITY_IDS[1]] = 8;
    notes.push(success ? `实际支付16灵性、10精神和1行动，经已独立实测的同一原导流芯，把原腔仅有的${transferred}份残压转换并释放到已核空的实体吸收槽；原腔现在剩${s.pressure.remainingUnits}份，原槽吸收${s.sink.absorbedUnits}份。唯一原芯烧结耗尽，此时才增长掌握8。`
      : `有限转换失败；16灵性、10精神和1行动已经支出，唯一原导流芯烧结耗尽。原吸收槽本次未接收能量，原腔仍封存${s.pressure.remainingUnits}份；原隔离闸保持关闭，不重抽、不补造新材料。`);
  } else if (c.type === 'STOP_EFFECTS') {
    stop(); notes.push('停止临时分流，所有已耗资源、旧伤、实际位置与原压力数量保持原样；尚未抵岸的人仍可走普通隔离岸路或原绳路线。');
  } else if (c.type === 'WITHDRAW') {
    walkedMeters = 8; s.position = -8; s.status = 'WITHDRAWN'; stop();
    notes.push('本人从零米安全岸台沿普通干岸路实走八米，抵达负八米值守避护处。两位居民保持各自真实位置与伤势，未完成的救援和原压力不会被报告补做。');
  } else if (c.type === 'REPORT') {
    s.reported = true; if (s.status === 'ACTIVE') s.status = 'RESOLVED'; stop();
    notes.push(`如实交接：${s.residents.map(r => `${r.name}在${r.position}米${r.arrival ? '已实际抵岸' : '尚未抵岸'}，原${r.injury.severity === 'HEAVY' ? '重伤' : '擦伤'}仍在`).join('；')}。原腔当前剩${s.pressure.remainingUnits}份，原槽实际吸收${s.sink.absorbedUnits}份，原导流芯${s.carrier.consumed ? '已消耗' : s.carrier.bought ? '已购且未耗' : '仍在原库房'}。`);
  }
  if (tyrantEpilogueNeedsCheck(c) && !passed(h.check)) {
    const heavy = h.check!.tier === 'GREAT_FAILURE'; e.health = heavy ? 16 : 6; e.mind += heavy ? 5 : 2;
    const injury: TyrantSceneInjury = { id: `${h.eventId}:finite-recoil`, severity: heavy ? 'HEAVY' : 'LIGHT', acquiredRevision: h.revision, treatedRevision: null };
    injuries.push(injury); s.playerInjuries.push(injury); notes.push(`本人承受这次实际反冲，新增${heavy ? '重伤' : '轻伤'}并损失${e.health}健康、额外${heavy ? 5 : 2}精神；居民原伤不被治疗，也没有人为增加危险来重复练习。`);
  }
  if (s.diversion.expiresSecond !== null && done.second > s.diversion.expiresSecond) stop();
  if (h.health - e.health <= 0 || h.mind - e.mind <= 0) { s.status = 'DEAD'; stop(); notes.push('本人因本次实际反冲死亡，不能继续施术、移动居民或交接。'); }
  if (s.carrier.holder === 'PLAYER') s.carrier.position = s.position;
  s.lastSecond = done.second;
  s.journal.push({ eventId: h.eventId, actorId: h.actorId, revision: h.revision, week: done.week, command: clone(c), beforeSecond: h.nowSecond, afterSecond: done.second,
    from, to: s.position, walkedMeters, residentPositionsBefore: previous.residents.map(r => ({ id: r.id, position: r.position })), residentPositionsAfter: s.residents.map(r => ({ id: r.id, position: r.position })),
    energyBefore: previous.pressure.remainingUnits, energyAfter: s.pressure.remainingUnits, sinkBefore: previous.sink.absorbedUnits, sinkAfter: s.sink.absorbedUnits,
    carrierConsumedId: c.type === 'RELEASE_ENERGY' ? s.carrier.id : null, check: clone(h.check), effect: clone(e), masteryGains: { ...masteryGains }, notes: [...notes] });
  return { state: s, effect: e, notes, masteryGains, injuries };
}
/** Positive public projection. Current injuries come from the current budget;
 * the immutable historical recoil ledger must never resurrect a healed wound. */
export function projectTyrantEpilogue(s: TyrantEpilogueState, currentInjuries: readonly CurrentInjury[] = s.playerInjuries, nowSecond = s.lastSecond) {
  const currentWindow = s.diversion.expiresSecond !== null && s.water.connected && nowSecond <= s.diversion.expiresSecond
    ? Math.max(0, s.diversion.expiresSecond - nowSecond) : 0;
  const injuryText = currentInjuries.length ? currentInjuries.map(i => `${i.severity === 'HEAVY' ? '重伤' : '轻伤'}${i.treatedRevision !== null ? '（已处置，仍在恢复）' : '（未处置）'}`).join('、') : '当前没有未恢复伤势';
  return { id: 'tyrant-epilogue', title: '旧港水道的一次真实救援',
    story: `伊芙在${s.residents[0]!.position}米、托马斯在${s.residents[1]!.position}米；${allArrived(s) ? '两人都已实际抵达安全岸台，原伤仍需医护' : '尚未抵岸的人仍在原固定支撑面上等待实际协助'}。原压力腔当前剩${s.pressure.remainingUnits}份，实体吸收槽已接收${s.sink.absorbedUnits}份。`,
    nextStep: s.status === 'DEAD' ? '本人的行动已经因死亡结束。' : s.reported ? '本次原事故已如实交接，可回普通生活。' : s.status === 'WITHDRAWN' ? '交接实际位置、旧伤、剩余压力与未完成的部分。' : '先救仍在原处的人；短暂分流、普通隔离岸路和原绳都能提供实际路线。',
    lines: [
      `本人在${s.position}米；${injuryText}。`,
      ...s.residents.map(r => `${r.name}（${r.age}岁）在${r.position}米${r.arrival ? '安全岸台，已实际脱险' : r.id === 'TYRANT0-IVA' ? '原检修台，尚未抵岸' : '原高阶，尚未抵岸'}；${r.injury.description}；${r.permission ? '本次已明确同意协助' : '尚未询问本次意愿'}。`),
      `原水道${s.water.connected ? '仍与原进水口实际相连' : '已被普通隔离闸切断'}；分流${currentWindow ? `窗口还剩${currentWindow}秒` : '当前无有效窗口'}。${s.diversion.applied ? '已在真实脱险中应用一次，掌握只增加一次' : s.diversion.attempted ? '已尝试，尚无实际应用记录' : '尚未尝试'}。`,
      `同一非生命压力腔当前剩${s.pressure.remainingUnits}份；原吸收槽实际接收${s.sink.absorbedUnits}份，剩余容量${s.sink.capacity - s.sink.absorbedUnits}。${s.pressure.verification ? '已独立实测原压力与原槽' : '尚须独立实测，账面数量不能代替核验'}。`,
      `原导流芯${s.carrier.consumed ? '已经实际烧结消耗，不能再用' : s.carrier.bought ? `已实付24便士取得，状况${s.carrier.condition}，${s.carrier.verification ? '已实际接在四米原腔与原槽之间并独立实测' : '尚未独立实测接续'}` : '仍在港务库房，仅有一件，24便士'}；原绳状况${s.rope.condition}，${s.rope.secured ? '已系妥' : '尚未系妥'}。`,
      '分流需1行动、20灵性、8精神，成功后的90秒内必须完成实际脱险；有限转换需1行动、16灵性、10精神，并消耗那一件已购且实测的原导流芯。每项只尝试一次，失败可能造成真实反冲伤。',
      '普通隔离、原岸路、原绳救援与本人撤离不收现款、灵性或行动；救援保留原伤，不创造能量、材料或新的受害者。',
    ] };
}
export function getTyrantEpilogueActions(s: TyrantEpilogueState, h: TyrantHost) {
  const labels: Record<TyrantEpilogueCommand['type'], string> = {
    OBSERVE: '看清两位居民、原水道与退路', ASK_PERMISSION: '分别询问两位居民本次求援意愿', DIVERT_WATER: '尝试一次九十秒原水分流',
    RESCUE_IVA: '实际往返八米检修台，协助伊芙抵岸', RESCUE_TOMAS: '实际往返十四米高阶，协助托马斯抵岸',
    ISOLATE: '用原手轮普通关闸，保留原腔残压', SECURE_ROPE: '在原岸桩上系妥同一原绳', BUY_CARRIER: '实付取得库房唯一原导流芯',
    VERIFY_ENERGY: '独立实测原腔残压与实体吸收槽', VERIFY_MATERIAL: '亲手紧固并独立实测原导流芯', RELEASE_ENERGY: '尝试向原吸收槽释放已核残压',
    STOP_EFFECTS: '立即停止临时分流', WITHDRAW: '本人沿普通干岸路实退八米', REPORT: '交接真实位置、旧伤与剩余压力',
  };
  const actions = TYRANT_EPILOGUE_COMMANDS.map(type => {
    const command: TyrantEpilogueCommand = { type }, e = tyrantEpilogueCost(s, command, h), reason = tyrantEpilogueBlock(s, command, h);
    return { command, label: labels[type], cost: `${e.cashCost}便士、${e.actions}行动、${e.spirituality}灵性、${e.mind}精神，实际${e.seconds}秒${type === 'DIVERT_WATER' ? '；有效窗口90秒' : type === 'RELEASE_ENERGY' ? '；消耗原导流芯，失败也不退还' : ''}`, enabled: reason === null, reason, preferredAction: false };
  });
  let preferred: TyrantEpilogueCommand['type'];
  if (s.status !== 'ACTIVE') preferred = 'REPORT';
  else if (!s.observed) preferred = 'OBSERVE';
  else if (s.residents.some(r => !r.permission && !r.arrival)) preferred = 'ASK_PERMISSION';
  else if (!allArrived(s)) {
    const remaining = s.residents.find(r => !r.arrival)!;
    if (liveDiversion(s, h.nowSecond, duration(remaining)) || s.water.isolated || s.rope.secured) preferred = remaining.id === 'TYRANT0-IVA' ? 'RESCUE_IVA' : 'RESCUE_TOMAS';
    else if (!s.diversion.attempted) preferred = 'DIVERT_WATER';
    else preferred = 'ISOLATE';
  } else if (!s.water.isolated) preferred = 'ISOLATE';
  else if (!s.pressure.verification) preferred = 'VERIFY_ENERGY';
  else if (!s.carrier.bought && !s.release.attempted) preferred = 'BUY_CARRIER';
  else if (!s.carrier.verification && !s.release.attempted) preferred = 'VERIFY_MATERIAL';
  else if (!s.release.attempted) preferred = 'RELEASE_ENERGY';
  else preferred = 'REPORT';
  const next = actions.find(a => a.command.type === preferred && a.enabled)
    ?? actions.find(a => a.command.type === 'ISOLATE' && a.enabled)
    ?? actions.find(a => a.command.type === 'RESCUE_IVA' && a.enabled)
    ?? actions.find(a => a.command.type === 'RESCUE_TOMAS' && a.enabled)
    ?? actions.find(a => a.command.type === 'REPORT' && a.enabled)
    ?? actions.find(a => a.command.type === 'WITHDRAW' && a.enabled);
  if (next) next.preferredAction = true;
  return actions;
}
