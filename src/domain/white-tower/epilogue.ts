import type { PublicCheckResult } from '../../shared/contracts.js';
import type { WhiteTowerHost, WhiteTowerEffect } from './ports.js';
import { whiteTowerPassagesComplete, type WhiteTowerPassagesState, type WhiteTowerSceneInjury } from './passages.js';

/** One original non-living gate, one independent adult and one physical
 * opponent. No old chapter resident, empty charger or paper is moved here. */
export type WhiteTowerEpilogueCommand = { type: 'OBSERVE' | 'ASK_PERMISSION' | 'STRUCTURAL_INSIGHT' | 'VERIFY_STRUCTURE' | 'CLEAR_SCREEN' | 'BOUNDED_WEAK_POINT' | 'EXPLOIT_WEAK_POINT' | 'SECURE_GATE' | 'UNLOAD_STRUT' | 'CROSS' | 'STOP_EFFECTS' | 'ORDINARY_SIDE_EXIT' | 'WITHDRAW' | 'REPORT' };
export interface WhiteTowerEpilogueState {
  id: string; actorId: string; location: 'WT0-GATE'; startedWeek: number; startedSecond: number; lastSecond: number;
  status: 'ACTIVE' | 'RESOLVED' | 'WITHDRAWN'; position: number; reported: boolean;
  resident: { id: 'WT0-SERA'; name: string; age: number; position: number; consent: 'UNASKED' | 'ACCEPT' | 'WITHDRAWN'; routePermission: 'NONE' | 'SIDE_ONLY' | 'GATE_AND_SIDE';
    permissionHistory: { eventId: string; second: number; position: number; answer: 'ACCEPT' | 'WITHDRAWN'; routePermission: 'NONE' | 'SIDE_ONLY' | 'GATE_AND_SIDE'; reason: string }[];
    injuries: string[]; arrival: { eventId: string; second: number; route: 'GATE_THEN_SIDE' | 'SIDE' } | null; crossedEventId: string | null };
  gate: { id: 'WT0-GATE-1'; ownerId: 'WT0-SERA'; position: 4; condition: number; version: number; visible: boolean; open: boolean; locked: boolean;
    latch: { id: 'WT0-GATE-LATCH-1'; condition: number; engaged: boolean };
    strut: { id: 'WT0-GATE-STRUT-1'; position: number; condition: number; loaded: boolean; holder: 'SITE' | 'PLAYER' };
    lever: { id: 'WT0-GATE-LEVER-1'; condition: number; position: number; holder: 'SITE' | 'PLAYER' }; screen: { id: 'WT0-GATE-SCREEN-1'; closed: boolean; removedEventId: string | null } };
  opponent: { id: 'WT0-ROOK'; name: string; age: number; position: number; toolId: 'WT0-ROOK-WRENCH'; toolCondition: number; stoppedByLatch: boolean;
    reconstruction: { eventId: string; fromVersion: number; toVersion: number; position: number; second: number } | null };
  observations: { eventId: string; version: number; second: number }[];
  verifications: { eventId: string; version: number; second: number; assisted: boolean; apparatusId: 'WT0-GATE-1'; independentMechanicalTest: true }[];
  insight: { attempted: boolean; passed: boolean; version: number | null; expiresSecond: number | null; applied: boolean };
  weakness: { attempted: boolean; passed: boolean; version: number | null; expiresSecond: number | null; applied: boolean; joint: 'LOWER_LINK' | null };
  playerInjuries: WhiteTowerSceneInjury[];
  journal: { eventId: string; revision: number; command: WhiteTowerEpilogueCommand; beforeSecond: number; afterSecond: number;
    from: number; to: number; walkedMeters: number; residentFrom: number; residentTo: number; gateVersion: number;
    check: PublicCheckResult | null; effect: WhiteTowerEffect; masteryGains: Record<string, number>; notes: string[] }[];
}
const TYPES = ['OBSERVE', 'ASK_PERMISSION', 'STRUCTURAL_INSIGHT', 'VERIFY_STRUCTURE', 'CLEAR_SCREEN', 'BOUNDED_WEAK_POINT', 'EXPLOIT_WEAK_POINT', 'SECURE_GATE', 'UNLOAD_STRUT', 'CROSS', 'STOP_EFFECTS', 'ORDINARY_SIDE_EXIT', 'WITHDRAW', 'REPORT'] as const;
const clone = <T>(v: T): T => structuredClone(v);
const skill = (c: WhiteTowerEpilogueCommand) => c.type === 'STRUCTURAL_INSIGHT' || c.type === 'BOUNDED_WEAK_POINT';
const pass = (c: PublicCheckResult | null) => c?.tier === 'SUCCESS' || c?.tier === 'GREAT_SUCCESS';
const observed = (s: WhiteTowerEpilogueState) => s.observations.some(o => o.version === s.gate.version);
const verified = (s: WhiteTowerEpilogueState) => s.verifications.some(v => v.version === s.gate.version && v.apparatusId === s.gate.id) && s.gate.visible;
const liveInsight = (s: WhiteTowerEpilogueState, now: number, duration: number) => s.insight.passed && !s.insight.applied && s.insight.version === s.gate.version && s.insight.expiresSecond !== null && now + duration <= s.insight.expiresSecond && s.gate.visible;
const liveWeakness = (s: WhiteTowerEpilogueState, now: number, duration: number) => s.weakness.passed && !s.weakness.applied && s.weakness.version === s.gate.version && s.weakness.expiresSecond !== null && now + duration <= s.weakness.expiresSecond && s.gate.visible && s.weakness.joint === 'LOWER_LINK';
const exitDistance = (s: WhiteTowerEpilogueState) => s.position === 0 ? 12 : Math.abs(12 - s.position);
const emptyEffect = (): WhiteTowerEffect => ({ cashCost: 0, cashGain: 0, actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 0, toLocation: null });
export function validateWhiteTowerEpilogueCommand(v: unknown): v is WhiteTowerEpilogueCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).join('|') === 'type' && TYPES.some(t => t === (v as WhiteTowerEpilogueCommand).type);
}
export function createWhiteTowerEpilogue(passages: WhiteTowerPassagesState, input: { week: number; nowSecond: number; actorId?: string }): WhiteTowerEpilogueState {
  if (!whiteTowerPassagesComplete(passages) || input.actorId !== undefined && input.actorId !== passages.actorId) throw Error('须由完成三处真实通行与下一周原处复核的同一本人进入。');
  return { id: 'white-tower-original-mechanical-gate', actorId: passages.actorId, location: 'WT0-GATE', startedWeek: input.week, startedSecond: input.nowSecond, lastSecond: input.nowSecond,
    status: 'ACTIVE', position: 0, reported: false,
    resident: { id: 'WT0-SERA', name: '瑟拉', age: 39, position: 0, consent: 'UNASKED', routePermission: 'NONE', permissionHistory: [], injuries: [], arrival: null, crossedEventId: null },
    gate: { id: 'WT0-GATE-1', ownerId: 'WT0-SERA', position: 4, condition: 82, version: 1, visible: true, open: false, locked: false,
      latch: { id: 'WT0-GATE-LATCH-1', condition: 80, engaged: false }, strut: { id: 'WT0-GATE-STRUT-1', position: 0, condition: 75, loaded: false, holder: 'SITE' },
      lever: { id: 'WT0-GATE-LEVER-1', condition: 78, position: 0, holder: 'SITE' }, screen: { id: 'WT0-GATE-SCREEN-1', closed: false, removedEventId: null } },
    opponent: { id: 'WT0-ROOK', name: '闸工罗克', age: 44, position: 6, toolId: 'WT0-ROOK-WRENCH', toolCondition: 70, stoppedByLatch: false, reconstruction: null },
    observations: [], verifications: [], insight: { attempted: false, passed: false, version: null, expiresSecond: null, applied: false }, weakness: { attempted: false, passed: false, version: null, expiresSecond: null, applied: false, joint: null }, playerInjuries: [], journal: [] };
}
export function whiteTowerEpilogueCost(s: WhiteTowerEpilogueState, c: WhiteTowerEpilogueCommand, h: WhiteTowerHost): WhiteTowerEffect {
  const e = emptyEffect();
  if (c.type === 'OBSERVE' || c.type === 'ASK_PERMISSION' || c.type === 'REPORT') e.seconds = 20;
  if (c.type === 'STRUCTURAL_INSIGHT') { e.actions = 1; e.spirituality = 12; e.mind = 8; e.seconds = 4; }
  if (c.type === 'BOUNDED_WEAK_POINT') { e.actions = 1; e.spirituality = 16; e.mind = 10; e.seconds = 3; }
  if (c.type === 'VERIFY_STRUCTURE') e.seconds = (liveInsight(s, h.nowSecond, 8) ? 8 : 20) + (!s.opponent.reconstruction && !s.gate.locked ? 6 : 0);
  if (c.type === 'CLEAR_SCREEN') e.seconds = 20;
  if (c.type === 'EXPLOIT_WEAK_POINT') e.seconds = 6;
  if (c.type === 'SECURE_GATE') e.seconds = 90;
  if (c.type === 'UNLOAD_STRUT') e.seconds = 30;
  if (c.type === 'CROSS') e.seconds = 16;
  if (c.type === 'ORDINARY_SIDE_EXIT' || c.type === 'WITHDRAW') e.seconds = exitDistance(s) * 2 + (s.gate.strut.loaded ? 30 : 0);
  return e;
}
export function whiteTowerEpilogueBlock(s: WhiteTowerEpilogueState, c: WhiteTowerEpilogueCommand, h: WhiteTowerHost): string | null {
  if (!validateWhiteTowerEpilogueCommand(c)) return '无效的原闸行动；不能填写施术成功、居民意愿或结构版本。';
  if (h.status !== 'ACTIVE' || h.sequence !== 0 || h.actorId !== s.actorId || h.location !== s.location) return '须同一实际晋升且在世的本人亲在原机械闸现场。';
  if (!Number.isSafeInteger(h.nowSecond) || h.nowSecond < s.lastSecond || h.week < s.startedWeek || (s.journal.at(-1)?.revision ?? -1) >= h.revision || s.journal.some(r => r.eventId === h.eventId)) return '现场时刻、事件或版本已失效，不能重复施术。';
  if (s.reported) return '本次实际交接已经完成。';
  if (c.type === 'REPORT') return s.status === 'ACTIVE' || s.position !== 12 ? '先沿普通侧路实际抵达安全出口，再报告每个人真实位置与伤损。' : null;
  if (s.status !== 'ACTIVE') return '本次现场行动已经收束，只能如实报告。';
  const e = whiteTowerEpilogueCost(s, c, h);
  if (h.cash < e.cashCost || h.actions < e.actions || h.spirituality < e.spirituality || h.mind <= e.mind) return '行动、灵性或精神不足；普通锁定、卸力及侧路不需行动或现款。';
  if (c.type === 'WITHDRAW') return null;
  if (c.type === 'STOP_EFFECTS') return s.insight.expiresSecond === null && s.weakness.expiresSecond === null ? '当前没有仍维持的临时结构窗口。' : null;
  if (c.type === 'UNLOAD_STRUT') return !s.gate.strut.loaded ? '原撑杆当前未承载，不重复卸力或恢复工具。' : null;
  if (c.type === 'ORDINARY_SIDE_EXIT') return !s.observations.length || s.resident.position !== s.position || s.resident.consent !== 'ACCEPT' ? '先看清普通侧路并当面取得同处瑟拉本次同行意愿；本人随时可独自实退。' : null;
  if (c.type === 'SECURE_GATE') return !s.observations.length || s.gate.locked || s.position !== 0 ? '须在入口看清原闸后，用原止动扣慢慢卸力、锁定；既已锁定不再重复磨损。' : null;
  if (c.type === 'CROSS') return s.position !== 0 || s.resident.position !== 0 || s.resident.consent !== 'ACCEPT' || s.resident.routePermission !== 'GATE_AND_SIDE' || s.resident.crossedEventId || !s.gate.open || (!s.gate.locked && (!s.gate.strut.loaded || s.gate.strut.condition < 50)) ? '同处居民须当次愿走闸道，且同一闸已被原扣可靠锁开或由完好的原撑杆实承重。' : null;
  if (s.position !== 0) return '结构操作在原入口完成；人已过闸后，可普通卸载并沿侧路离开。';
  if (c.type === 'OBSERVE') return observed(s) ? '这一实际版本已亲眼观察；全知不会让观察穿透遮挡。' : !s.gate.visible ? '原遮屏实际挡住结构，先亲手移开遮屏。' : null;
  if (c.type === 'CLEAR_SCREEN') return !s.gate.screen.closed || s.gate.screen.removedEventId ? '原遮屏没有挡住结构，或已经实际移开。' : null;
  if (c.type === 'ASK_PERMISSION') {
    if (!s.observations.length || s.resident.position !== s.position) return '先观察眼前原闸和侧路，再当面询问同处成年居民。';
    const scope = verified(s) || s.gate.locked || !s.opponent.reconstruction ? 'GATE_AND_SIDE' : 'SIDE_ONLY';
    return s.resident.consent === 'ACCEPT' && s.resident.routePermission === scope ? '本人本次相同范围的许可仍有效，不能重复刷答复。' : null;
  }
  if (!s.gate.visible || !observed(s)) return '须看见并重新观察当前同一原闸版本；旧观察和知识窗口不能跨过真实重构或遮挡。';
  if (c.type === 'VERIFY_STRUCTURE') return verified(s) ? '当前同一版本已经独立实测，不反复刷核验或掌握。' : s.gate.condition < 50 ? '原件已不足以安全试载，改用原止动扣和普通侧路。' : null;
  if (c.type === 'STRUCTURAL_INSIGHT') return s.insight.attempted ? '本场结构洞察已经尝试一次，失败也不能重抽。' : verified(s) || s.gate.locked ? '当前结构已独立核验或已普通锁定，无须再为它制造洞察窗口。' : s.resident.consent !== 'ACCEPT' ? '须先取得同处原器材保管人本次操作许可。' : null;
  if (c.type === 'BOUNDED_WEAK_POINT') return s.weakness.attempted ? '本场有限弱点已经尝试一次，不能反复制造。' : !verified(s) || s.gate.locked || s.gate.open || s.resident.consent !== 'ACCEPT' || s.resident.routePermission !== 'GATE_AND_SIDE' ? '须独立核实当前可见非生命结构、重新取得本次许可，且原闸仍未打开或锁定。' : null;
  if (c.type === 'EXPLOIT_WEAK_POINT') return !liveWeakness(s, h.nowSecond, e.seconds) || !verified(s) || s.resident.consent !== 'ACCEPT' || s.gate.open ? '只有同一可见且未重构的已核原闸，在十秒窗口内才能用原杠杆实际利用这一处弱点。' : null;
  return '当前没有这项现场行动。';
}
export function applyWhiteTowerEpilogue(previous: WhiteTowerEpilogueState, c: WhiteTowerEpilogueCommand, h: WhiteTowerHost): { state: WhiteTowerEpilogueState; effect: WhiteTowerEffect; notes: string[]; masteryGains: Record<string, number>; injuries: WhiteTowerSceneInjury[] } {
  const blocked = whiteTowerEpilogueBlock(previous, c, h); if (blocked) throw Error(blocked);
  if (skill(c) !== (h.check !== null)) throw Error('只有两项各一次的有限技巧消费真实随机检定。');
  const s = clone(previous), e = whiteTowerEpilogueCost(previous, c, h), notes: string[] = [], masteryGains: Record<string, number> = {}, injuries: WhiteTowerSceneInjury[] = [];
  const from = s.position, residentFrom = s.resident.position; let walkedMeters = 0;
  const stop = () => { s.insight.expiresSecond = null; s.weakness.expiresSecond = null; };
  const consent = (answer: 'ACCEPT' | 'WITHDRAWN', scope: WhiteTowerEpilogueState['resident']['routePermission'], reason: string) => { s.resident.consent = answer; s.resident.routePermission = scope; s.resident.permissionHistory.push({ eventId: h.eventId, second: h.nowSecond + e.seconds, position: s.resident.position, answer, routePermission: scope, reason }); if (answer === 'WITHDRAWN') stop(); };
  const injury = (severity: 'LIGHT' | 'HEAVY', suffix: string) => { const i: WhiteTowerSceneInjury = { id: `${h.eventId}:${suffix}`, severity, acquiredRevision: h.revision, treatedRevision: null }; injuries.push(i); s.playerInjuries.push(i); };
  const unload = () => { s.gate.lever.holder = 'PLAYER'; s.gate.lever.position = s.position; s.gate.strut.loaded = false; s.gate.strut.holder = 'PLAYER'; s.gate.strut.position = s.position; s.gate.strut.condition = Math.max(0, s.gate.strut.condition - 2); if (!s.gate.locked) { s.gate.open = false; s.gate.version++; stop(); } notes.push('本人用原杠杆控制载荷，慢慢卸下同一撑杆并收回；未锁定的闸沿原轨落稳，既有磨损和伤势保留。'); };
  if (c.type === 'OBSERVE') { s.observations.push({ eventId: h.eventId, version: s.gate.version, second: h.nowSecond + e.seconds }); notes.push(`亲眼观察原闸${s.gate.id}版本${s.gate.version}、四米处下连接杆、六米处闸工罗克及十二米普通侧路；瑟拉仍在零米入口。原止动扣、撑杆和杠杆属于这座闸，均有原件和磨损记录。`); }
  else if (c.type === 'ASK_PERMISSION') { const scope = verified(s) || s.gate.locked || !s.opponent.reconstruction ? 'GATE_AND_SIDE' : 'SIDE_ONLY'; consent('ACCEPT', scope, scope === 'SIDE_ONLY' ? '闸已变形，我现在只同意走已看清的侧路；重新实测后再问我是否走闸。' : '我愿在机械安全条件满足后同行；闸道或侧路都可以。'); notes.push(`瑟拉（39岁）当面答复${scope === 'SIDE_ONLY' ? '只愿沿普通侧路离开' : '愿在实测安全后走闸道，也愿走普通侧路'}；她仍在${s.resident.position}米，没有因答复被移动。`); }
  else if (skill(c)) {
    const insight = c.type === 'STRUCTURAL_INSIGHT', succeeded = pass(h.check), window = insight ? s.insight : s.weakness;
    Object.assign(window, { attempted: true, passed: succeeded, version: s.gate.version, expiresSecond: succeeded ? h.nowSecond + e.seconds + (insight ? 30 : 10) : null });
    if (!insight) s.weakness.joint = succeeded ? 'LOWER_LINK' : null;
    notes.push(succeeded ? insight ? '实际支付12灵性、8精神与1行动，看清同一可见下连接杆的受力关系；完成后三十秒内只帮助下一次独立实测，不提供未来、隐藏结构或自动成功。' : '实际支付16灵性、10精神与1行动，在当前已独立核实的非生命下连接杆上造出唯一一处短暂薄弱点；完成后十秒内须亲手实际利用，尚未开闸或增加掌握。' : `本次${insight ? '结构洞察' : '有限弱点'}检定失败，灵性、精神和行动已经消耗；本场不能重抽，普通锁定与侧路仍可用。`);
    if (!succeeded) { const severe = h.check!.tier === 'GREAT_FAILURE'; e.health = severe ? 16 : 6; e.mind += severe ? 5 : 2; injury(severe ? 'HEAVY' : 'LIGHT', 'structural-strain'); if (!insight && severe) { s.gate.condition -= 3; s.gate.version++; s.resident.injuries.push('原连接杆回震飞出碎屑，在入口造成一次擦伤'); consent('WITHDRAWN', 'NONE', '碎屑刚伤到我，我先留在原入口；请普通锁好闸，再来问我。'); notes.push('原杆回震，瑟拉在原入口实际擦伤并撤回；她没有被强制继续带走。'); } }
  }
  else if (c.type === 'VERIFY_STRUCTURE') {
    const assisted = liveInsight(previous, h.nowSecond, 8), testSeconds = assisted ? 8 : 20;
    walkedMeters = 4; s.gate.lever.holder = 'PLAYER'; s.gate.lever.condition--; s.verifications.push({ eventId: h.eventId, version: s.gate.version, second: h.nowSecond + testSeconds, assisted, apparatusId: s.gate.id, independentMechanicalTest: true });
    if (assisted) { s.insight.applied = true; s.insight.expiresSecond = null; masteryGains['reader.s0.structural-insight'] = 8; }
    notes.push(`本人沿安全前沿实走两米、用原杠杆轻试受力并实退两米，对同一版本完成独立机械核验；${assisted ? '三十秒内的洞察真正帮助定位试载点，对应掌握仅此一次增加8。' : '按普通观察逐项核验，没有凭施术结果自动通过，也不增长洞察掌握。'}`);
    if (!s.opponent.reconstruction && !s.gate.locked) {
      const oldVersion = s.gate.version; s.gate.version++; s.gate.condition -= 4; s.gate.visible = false; s.gate.screen.closed = true; s.opponent.toolCondition -= 4;
      s.opponent.reconstruction = { eventId: h.eventId, fromVersion: oldVersion, toVersion: s.gate.version, position: 6, second: h.nowSecond + e.seconds };
      consent('WITHDRAWN', 'NONE', '对方刚换了连接方式，我不按刚才的结果走；先处理遮挡、重新核实，再问我。');
      notes.push(`核验结束后六秒，六米处的罗克用他自己的原扳手实际换接承力杆，原闸从版本${oldVersion}变成${s.gate.version}，并放下原遮屏。旧核验和所有旧窗口失效；瑟拉当即撤回，仍在零米。看清旧结构并不能阻止真实反制。`);
    }
  }
  else if (c.type === 'CLEAR_SCREEN') { walkedMeters = 4; s.gate.screen.closed = false; s.gate.screen.removedEventId = h.eventId; s.gate.visible = true; notes.push('本人沿安全前沿走两米，亲手卷起同一遮屏并退回两米；只恢复当前可见性，没有恢复旧版本或旧施术窗口，须重新观察与实测。'); }
  else if (c.type === 'EXPLOIT_WEAK_POINT') { walkedMeters = 4; s.gate.lever.holder = 'PLAYER'; s.gate.lever.condition -= 5; s.gate.strut.condition -= 5; s.gate.strut.position = 4; s.gate.strut.loaded = true; s.gate.strut.holder = 'SITE'; s.gate.open = true; s.gate.condition -= 12; s.gate.version++; s.weakness.applied = true; masteryGains['reader.s0.bounded-weak-point'] = 8; stop(); notes.push('六秒内亲到两米安全前沿，用同一原杠杆真正利用下连接杆的唯一弱点，松开卡死的承力并放入原撑杆，然后退回入口。原闸实际开启、撑杆实际带载，原杆损12、杠杆和撑杆各损5；此时才增加有限弱点掌握8。瑟拉尚未移动。'); }
  else if (c.type === 'SECURE_GATE') { walkedMeters = 4; s.gate.lever.holder = 'PLAYER'; s.gate.latch.condition -= 5; s.gate.latch.engaged = true; s.gate.locked = true; s.gate.open = true; s.gate.version++; s.opponent.stoppedByLatch = true; stop(); notes.push('本人在安全前沿用原杠杆逐步卸力，九十秒后把同一止动扣实际锁入闸轨；原扣磨损5，闸保持敞开，罗克的另一侧手柄被原扣挡住。无需施术、现款或行动；旧结构窗口随实际版本变化失效。'); }
  else if (c.type === 'UNLOAD_STRUT') { walkedMeters = 4; unload(); }
  else if (c.type === 'CROSS') { walkedMeters = 8; s.position = 8; s.resident.position = 8; s.resident.crossedEventId = h.eventId; s.gate.condition--; if (s.gate.strut.loaded) s.gate.strut.condition--; stop(); notes.push('当次仍同意走闸道的瑟拉和本人，从零米连续实走八米、十六秒，穿过同一已可靠锁定或实际撑稳的原闸。原件承重磨损1，瑟拉既有伤势保留；仍须沿四米普通侧路到安全出口。'); }
  else if (c.type === 'STOP_EFFECTS') { stop(); notes.push('立即停止当前临时窗口；已耗资源、实际伤势、结构变化和所有人位置全部保留。'); }
  else if (c.type === 'ORDINARY_SIDE_EXIT' || c.type === 'WITHDRAW') {
    if (s.gate.strut.loaded) { walkedMeters += 4; unload(); }
    walkedMeters += exitDistance(s); const accompany = c.type === 'ORDINARY_SIDE_EXIT'; s.position = 12; s.status = accompany ? 'RESOLVED' : 'WITHDRAWN'; stop();
    if (accompany) { s.resident.position = 12; s.resident.arrival = { eventId: h.eventId, second: h.nowSecond + e.seconds, route: s.resident.crossedEventId ? 'GATE_THEN_SIDE' : 'SIDE' }; }
    notes.push(`本人${accompany ? '与同处且当次愿意的瑟拉' : '独自'}沿普通侧路实走${exitDistance(previous)}米抵达十二米安全出口。${accompany ? '瑟拉实际抵达已记录。' : `瑟拉仍在原来的${s.resident.position}米处，没有随报告迁移。`}所有原件、失败、费用和伤损保留。`);
  }
  else { s.reported = true; notes.push(`如实交接：本人已在十二米安全出口；瑟拉实际在${s.resident.position}米，${s.resident.arrival ? '本次真实抵达' : '本次尚未抵达，须由现场值守人员继续处理'}。原闸版本${s.gate.version}、状况${s.gate.condition}，原撑杆${s.gate.strut.loaded ? '仍带载' : '已卸载或未使用'}；不补报施术成功或移动居民。`); }
  if (s.insight.expiresSecond !== null && h.nowSecond + e.seconds > s.insight.expiresSecond) s.insight.expiresSecond = null;
  if (s.weakness.expiresSecond !== null && h.nowSecond + e.seconds > s.weakness.expiresSecond) s.weakness.expiresSecond = null;
  if (!s.gate.visible || s.insight.version !== s.gate.version) s.insight.expiresSecond = null;
  if (!s.gate.visible || s.weakness.version !== s.gate.version) s.weakness.expiresSecond = null;
  if (h.health - e.health <= 0 || h.mind - e.mind <= 0) { s.status = 'WITHDRAWN'; stop(); notes.push('本次实际代价已使本人死亡，不能继续控制原闸或移动居民。'); }
  if (s.gate.lever.holder === 'PLAYER') s.gate.lever.position = s.position;
  if (s.gate.strut.holder === 'PLAYER') s.gate.strut.position = s.position;
  s.lastSecond = h.nowSecond + e.seconds;
  s.journal.push({ eventId: h.eventId, revision: h.revision, command: clone(c), beforeSecond: h.nowSecond, afterSecond: s.lastSecond, from, to: s.position, walkedMeters, residentFrom, residentTo: s.resident.position, gateVersion: s.gate.version, check: clone(h.check), effect: clone(e), masteryGains: { ...masteryGains }, notes: [...notes] });
  return { state: s, effect: e, notes, masteryGains, injuries };
}
export function projectWhiteTowerEpilogue(s: WhiteTowerEpilogueState) {
  return { id: 'white-tower-epilogue', title: '原机械闸的一次实际反制', story: s.journal.at(-1)?.notes.join('') ?? '瑟拉与本人实际同在原闸零米入口。闸工罗克正从另一侧阻拦检修人员离开；先看清原结构和普通侧路，再询问瑟拉当次意愿。', nextStep: s.reported ? '实际交接已经结束，可回普通生活。' : s.status !== 'ACTIVE' ? '报告每个人实际位置、费用和原件伤损。' : '新技巧每项只尝试一次，原止动扣、普通卸载和侧路可独立收束。', lines: [
    `本人${s.position}米；瑟拉（${s.resident.age}岁）${s.resident.position}米，${s.resident.consent === 'ACCEPT' ? s.resident.routePermission === 'SIDE_ONLY' ? '当次只同意侧路' : '当次同意安全闸道或侧路' : s.resident.consent === 'WITHDRAWN' ? '已撤回同行，须当面重新问' : '未询问当次意愿'}；${s.resident.injuries.join('、') || '无本场新增伤势'}。`,
    `原非生命机械闸${s.gate.id}：四米处，版本${s.gate.version}，状况${s.gate.condition}，${s.gate.visible ? '当前可见' : '被原遮屏实际遮挡'}；${s.gate.locked ? '原扣已锁开' : s.gate.open ? '原撑杆正撑开' : '尚未打开'}。`,
    `罗克始终在${s.opponent.position}米；${s.opponent.reconstruction ? `已实际将原闸由版本${s.opponent.reconstruction.fromVersion}重构到${s.opponent.reconstruction.toVersion}` : '尚未进行其有限重构'}；原扳手状况${s.opponent.toolCondition}。`,
    `原撑杆${s.gate.strut.id}在${s.gate.strut.position}米，状况${s.gate.strut.condition}，${s.gate.strut.loaded ? '实际承重，退场前须普通卸载' : '未带载'}；原止动扣${s.gate.latch.condition}，原杠杆${s.gate.lever.condition}。`,
    `结构洞察：${s.insight.applied ? '已帮助一次独立实测，掌握增8' : s.insight.attempted ? '已尝试，未证明实际应用' : '尚未尝试'}；有限弱点：${s.weakness.applied ? '已用原杠杆真正利用一次，掌握增8' : s.weakness.attempted ? '已尝试，未证明实际应用' : '尚未尝试'}。`,
    '洞察12灵性/8精神、30秒；弱点16灵性/10精神、10秒，各1行动且仅一次。观察、独立实测、实际利用是不同动作；遮挡、重构与真实条件变化会使旧窗口失效。',
    '免费普通锁定、撑杆卸载、十二米侧路和本人独退一直保留；退出不抹去失败、伤势或原居民实际位置。',
  ] };
}
export function getWhiteTowerEpilogueActions(s: WhiteTowerEpilogueState, h: WhiteTowerHost) {
  const labels: Record<WhiteTowerEpilogueCommand['type'], string> = { OBSERVE: '观察当前原闸、对方与侧路', ASK_PERMISSION: '当面重新询问瑟拉本次同行意愿', STRUCTURAL_INSIGHT: '尝试一次可见结构洞察', VERIFY_STRUCTURE: '本人独立实测当前原结构', CLEAR_SCREEN: '亲手卷起原遮屏后退回', BOUNDED_WEAK_POINT: '尝试造一处十秒有限弱点', EXPLOIT_WEAK_POINT: '用原杠杆实际利用这一处弱点', SECURE_GATE: '用原止动扣普通卸力并锁开闸', UNLOAD_STRUT: '普通卸载并收回原撑杆', CROSS: '与当次愿意的瑟拉实走八米过闸', STOP_EFFECTS: '立即停止临时结构窗口', ORDINARY_SIDE_EXIT: '与同处愿意的瑟拉沿普通侧路离开', WITHDRAW: '本人独自卸力并沿侧路实退', REPORT: '如实交接实际位置与原件伤损' };
  const actions = TYPES.map(type => { const command: WhiteTowerEpilogueCommand = { type }, e = whiteTowerEpilogueCost(s, command, h), reason = whiteTowerEpilogueBlock(s, command, h); return { command, label: labels[type], cost: `${e.actions}行动、${e.spirituality}灵性、${e.mind}精神，实际${e.seconds}秒${type === 'STRUCTURAL_INSIGHT' ? '；成功后30秒内须独立核验' : type === 'BOUNDED_WEAK_POINT' ? '；成功后10秒内须真正利用' : ''}`, enabled: reason === null, reason, preferredAction: false }; });
  let preferred: WhiteTowerEpilogueCommand['type'];
  if (s.status !== 'ACTIVE') preferred = 'REPORT';
  else if (s.position === 8) preferred = 'ORDINARY_SIDE_EXIT';
  else if (!s.gate.visible) preferred = 'CLEAR_SCREEN';
  else if (!observed(s)) preferred = 'OBSERVE';
  else if (s.gate.open && (s.gate.locked || s.gate.strut.loaded)) preferred = s.resident.consent === 'ACCEPT' && s.resident.routePermission === 'GATE_AND_SIDE' ? 'CROSS' : 'ASK_PERMISSION';
  else if (!s.resident.permissionHistory.length) preferred = 'ASK_PERMISSION';
  else if (!s.insight.attempted && !verified(s)) preferred = 'STRUCTURAL_INSIGHT';
  else if (!verified(s)) preferred = 'VERIFY_STRUCTURE';
  else if (s.resident.consent !== 'ACCEPT' || s.resident.routePermission !== 'GATE_AND_SIDE') preferred = 'ASK_PERMISSION';
  else if (!s.weakness.attempted) preferred = 'BOUNDED_WEAK_POINT';
  else if (liveWeakness(s, h.nowSecond, 6)) preferred = 'EXPLOIT_WEAK_POINT';
  else preferred = 'SECURE_GATE';
  const next = actions.find(a => a.command.type === preferred && a.enabled) ?? actions.find(a => a.command.type === 'SECURE_GATE' && a.enabled) ?? actions.find(a => a.command.type === 'ORDINARY_SIDE_EXIT' && a.enabled) ?? actions.find(a => a.command.type === 'WITHDRAW' && a.enabled);
  if (next) next.preferredAction = true;
  return actions;
}
