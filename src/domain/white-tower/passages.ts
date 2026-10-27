import type { PublicCheckResult } from '../../shared/contracts.js';
import type { WhiteTowerHost, WhiteTowerEffect } from './ports.js';
import type { WhiteTowerPassageReceipt } from './types.js';
export type { WhiteTowerPassageReceipt } from './types.js';

/** Three authored, ordinary repair sites. A public command cannot provide a
 * resident's answer, a distance, a material, a check or a completion receipt. */
export const WHITE_TOWER_PASSAGES = [
  { id: 'market-steps', location: 'WT0-MARKET', title: '市场台阶', length: 24, obstacle: 8,
    residentId: 'WT0-IVA', name: '伊娃', age: 34, apparatusId: 'WT0-MARKET-RAIL', apparatus: '原台阶扶栏',
    problem: '最下两级踏面松动，扶栏底脚已偏；须垫实踏面并固定原底脚', materials: '两块普通踏板、四枚螺栓、标识绳和手扳工具', price: 42, repairPrice: 18 },
  { id: 'canal-gallery', location: 'WT0-CANAL', title: '运河检修廊', length: 30, obstacle: 10,
    residentId: 'WT0-LEON', name: '利昂', age: 46, apparatusId: 'WT0-CANAL-HINGE', apparatus: '原检修廊铰链盖板',
    problem: '原盖板铰销松脱，开口横在检修廊中间；须支撑卸力后装入普通铰销', materials: '普通铰销、两根支撑木、止动扣、标识绳和手扳工具', price: 54, repairPrice: 24 },
  { id: 'apartment-alley', location: 'WT0-ALLEY', title: '公寓后巷', length: 18, obstacle: 6,
    residentId: 'WT0-MINA', name: '米娜', age: 29, apparatusId: 'WT0-ALLEY-GRATE', apparatus: '原后巷排水格栅',
    problem: '原格栅翘起，泥水遮住落脚点；须清沟、固定格栅并铺防滑标识', materials: '普通卡箍、防滑砂、两块垫木、标识绳和手扳工具', price: 36, repairPrice: 18 },
] as const;
export type WhiteTowerPassageId = typeof WHITE_TOWER_PASSAGES[number]['id'];
export type WhiteTowerPassageCommand = { type: 'SURVEY' | 'ASK_PERMISSION' | 'BUY_MATERIALS' | 'BUILD' | 'ACCEPT_WORK' | 'PASS_RESIDENT' | 'REVIEW_NEXT_WEEK' | 'BUY_REPAIR' | 'REPAIR' | 'UNLOAD' | 'RETURN_ON_FOOT'; passageId: WhiteTowerPassageId };
export interface WhiteTowerSceneInjury { id: string; severity: 'LIGHT' | 'HEAVY'; acquiredRevision: number; treatedRevision: null }
export interface WhiteTowerPassageRoute {
  id: WhiteTowerPassageId; location: string; playerPosition: number;
  resident: { id: string; name: string; age: number; position: number; consent: 'UNASKED' | 'ACCEPT' | 'WITHDRAWN';
    permissionHistory: { eventId: string; second: number; position: number; answer: 'ACCEPT' | 'WITHDRAWN'; reason: string }[];
    injuries: string[] };
  apparatus: { id: string; ownerId: string; position: number; condition: number; version: number; loaded: boolean; fixed: boolean };
  survey: { eventId: string; second: number; walkedMeters: number } | null;
  materials: { id: string; stock: 0 | 1; boughtEventId: string | null; consumedEventId: string | null;
    tool: { id: string; holder: 'SUPPLIER' | 'PLAYER' | 'SITE'; condition: number };
    repair: { id: string; stock: 0 | 1; boughtEventId: string | null; consumedEventId: string | null } };
  construction: { eventId: string; passed: boolean; check: PublicCheckResult; repairedEventId: string | null } | null;
  acceptance: { eventId: string; apparatusVersion: number; second: number } | null;
  passage: { eventId: string; week: number; second: number; from: number; to: number; walkedMeters: number; permissionEventId: string } | null;
  review: { eventId: string; week: number; second: number; apparatusVersion: number; residentPosition: number; walkedMeters: number } | null;
}
export interface WhiteTowerPassagesState {
  version: 1; runId: string; actorId: string; startWeek: number; lastSecond: number;
  routes: WhiteTowerPassageRoute[]; playerInjuries: WhiteTowerSceneInjury[];
  journal: { id: string; revision: number; command: WhiteTowerPassageCommand; beforeSecond: number; afterSecond: number;
    from: number; to: number; walkedMeters: number; residentFrom: number; residentTo: number;
    apparatusId: string; apparatusVersion: number; materialsConsumed: string[]; effect: WhiteTowerEffect; check: PublicCheckResult | null; notes: string[] }[];
}
export type WhiteTowerPassageState = WhiteTowerPassagesState;
const TYPES = ['SURVEY', 'ASK_PERMISSION', 'BUY_MATERIALS', 'BUILD', 'ACCEPT_WORK', 'PASS_RESIDENT', 'REVIEW_NEXT_WEEK', 'BUY_REPAIR', 'REPAIR', 'UNLOAD', 'RETURN_ON_FOOT'] as const;
const clone = <T>(v: T): T => structuredClone(v);
const definition = (id: WhiteTowerPassageId) => WHITE_TOWER_PASSAGES.find(p => p.id === id)!;
const route = (s: WhiteTowerPassagesState, id: WhiteTowerPassageId) => s.routes.find(p => p.id === id)!;
const emptyEffect = (): WhiteTowerEffect => ({ cashCost: 0, cashGain: 0, actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 0, toLocation: null });
const passed = (c: PublicCheckResult | null) => c?.tier === 'SUCCESS' || c?.tier === 'GREAT_SUCCESS';
export function validateWhiteTowerPassageCommand(v: unknown): v is WhiteTowerPassageCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).sort().join('|') === 'passageId|type' && TYPES.some(t => t === c.type) && WHITE_TOWER_PASSAGES.some(p => p.id === c.passageId);
}
export function createWhiteTowerPassages(runId: string, actorId: string, startWeek: number, nowSecond: number): WhiteTowerPassagesState {
  return { version: 1, runId, actorId, startWeek, lastSecond: nowSecond, playerInjuries: [], journal: [],
    routes: WHITE_TOWER_PASSAGES.map(p => ({ id: p.id, location: p.location, playerPosition: 0,
      resident: { id: p.residentId, name: p.name, age: p.age, position: 0, consent: 'UNASKED', permissionHistory: [], injuries: [] },
      apparatus: { id: p.apparatusId, ownerId: p.residentId, position: p.obstacle, condition: 35, version: 1, loaded: false, fixed: false },
      survey: null, materials: { id: `${p.apparatusId}:materials`, stock: 1, boughtEventId: null, consumedEventId: null,
        tool: { id: `${p.apparatusId}:tool`, holder: 'SUPPLIER', condition: 100 },
        repair: { id: `${p.apparatusId}:repair`, stock: 1, boughtEventId: null, consumedEventId: null } },
      construction: null, acceptance: null, passage: null, review: null })) };
}
export function whiteTowerPassageCost(s: WhiteTowerPassagesState, c: WhiteTowerPassageCommand, _h: WhiteTowerHost): WhiteTowerEffect {
  const r = route(s, c.passageId), p = definition(c.passageId), e = emptyEffect();
  if (c.type === 'SURVEY') { e.actions = 1; e.seconds = p.obstacle * 4 + 120; }
  if (c.type === 'ASK_PERMISSION') e.seconds = 30;
  if (c.type === 'BUY_MATERIALS') { e.cashCost = p.price; e.seconds = 60; }
  if (c.type === 'BUY_REPAIR') { e.cashCost = p.repairPrice; e.seconds = 60; }
  if (c.type === 'BUILD' || c.type === 'REPAIR') { e.actions = 1; e.seconds = p.obstacle * 2 + (c.type === 'BUILD' ? 300 : 180); }
  if (c.type === 'ACCEPT_WORK') e.seconds = 60 + (r.playerPosition === 0 ? p.obstacle * 2 : 0);
  if (c.type === 'PASS_RESIDENT') e.seconds = p.length * 2;
  if (c.type === 'REVIEW_NEXT_WEEK') { e.actions = 1; e.seconds = p.length * 2 + 120; }
  if (c.type === 'UNLOAD') e.seconds = 60;
  if (c.type === 'RETURN_ON_FOOT') e.seconds = r.playerPosition * 2 + (r.apparatus.loaded && !r.apparatus.fixed ? 60 : 0);
  return e;
}
export function whiteTowerPassageBlock(s: WhiteTowerPassagesState, c: WhiteTowerPassageCommand, h: WhiteTowerHost): string | null {
  if (!validateWhiteTowerPassageCommand(c)) return '无效的通路指令；不能自行填入居民许可、检定或通过报告。';
  const r = route(s, c.passageId), p = definition(c.passageId);
  if (h.status !== 'ACTIVE' || h.sequence !== 1 || h.actorId !== s.actorId || h.location !== r.location) return '须由同一在世本人亲到这条原通路；晋升后保留既有通行记录。';
  if (!Number.isSafeInteger(h.nowSecond) || h.nowSecond < s.lastSecond || h.week < s.startWeek || (s.journal.at(-1)?.revision ?? -1) >= h.revision || s.journal.some(j => j.id === h.eventId)) return '现场时刻、版本或事件已失效，不能重复消费同一回执。';
  const e = whiteTowerPassageCost(s, c, h);
  if (h.cash < e.cashCost || h.actions < e.actions) return '实际现款或行动不足；卸载、收工具和本人普通退场始终不收费。';
  if (c.type === 'RETURN_ON_FOOT') return r.playerPosition === 0 && r.materials.tool.holder !== 'SITE' && !r.apparatus.loaded ? '本人和随身工具已在入口。' : null;
  if (c.type === 'UNLOAD') return !r.apparatus.loaded || r.apparatus.fixed || r.playerPosition !== p.obstacle ? '只有本人位于原施工点且临时支撑仍带载时才须卸载。' : null;
  if (c.type === 'SURVEY') return r.survey || r.playerPosition !== 0 ? '从原入口亲走到阻点实测并原路返回，每处只登记一次。' : null;
  if (!r.survey) return '先亲走实勘这条通路，辨明原器材和阻点。';
  if (c.type === 'ASK_PERMISSION') {
    if (r.playerPosition !== r.resident.position || r.passage) return '须在通过前当面询问这一个原居民，不能隔处制造许可。';
    if (r.resident.consent === 'ACCEPT') return '这一个人的本次许可仍有效，不重复制造答复。';
    return r.apparatus.loaded && !r.apparatus.fixed ? '原支撑还在危险带载，居民已撤回；先普通卸载并实退。' : null;
  }
  if (c.type === 'BUY_MATERIALS') return r.playerPosition !== 0 || !r.materials.stock || r.materials.boughtEventId ? '只在本处入口购买这一份有限普通材料与原工具。' : null;
  if (c.type === 'BUY_REPAIR') return r.playerPosition !== 0 || !r.construction || r.construction.passed || r.construction.repairedEventId || !r.materials.repair.stock || r.materials.repair.boughtEventId ? '仅施工失败后，在本处入口购买唯一的普通备用材料；没有无限补货。' : null;
  if (c.type === 'BUILD' || c.type === 'REPAIR') {
    if (r.playerPosition !== 0 || r.resident.position !== 0 || r.resident.consent !== 'ACCEPT' || r.materials.tool.holder !== 'PLAYER' || r.apparatus.loaded) return '须先卸载退回入口、带齐原工具，并取得同处居民当前许可。';
    if (c.type === 'BUILD') return !r.materials.boughtEventId || r.materials.consumedEventId || r.construction ? '每处只用已经付费的原材料施工一次；失败后走普通维修。' : null;
    return !r.construction || r.construction.passed || r.construction.repairedEventId || !r.materials.repair.boughtEventId || r.materials.repair.consumedEventId ? '须有本处实际施工失败及同一已购备用包；不能凭空维修或重复返料。' : null;
  }
  if (c.type === 'ACCEPT_WORK') return ![0, p.obstacle].includes(r.playerPosition) || r.resident.consent !== 'ACCEPT' || !r.construction || (!r.construction.passed && !r.construction.repairedEventId) || r.acceptance ? '须本人在原施工点对已完成的机械施工承重验收；失败原件须先普通维修。' : null;
  if (c.type === 'PASS_RESIDENT') return r.playerPosition !== 0 || r.resident.position !== 0 || r.resident.consent !== 'ACCEPT' || !r.acceptance || r.acceptance.apparatusVersion !== r.apparatus.version || !r.apparatus.fixed || r.passage ? '先验收同一原器材并亲返入口，再陪同仍愿意的原居民实际走完全程。' : null;
  if (c.type === 'REVIEW_NEXT_WEEK') return r.playerPosition !== 0 || !r.passage || r.review || h.week <= r.passage.week || h.nowSecond <= r.passage.second || r.resident.position !== p.length || !r.apparatus.fixed ? '须至少下一真实周本人重回同一通路，亲走原处并见到实际通过后留在终点的同一居民。' : null;
  return '当前没有这项通路行动。';
}
export function applyWhiteTowerPassage(previous: WhiteTowerPassagesState, c: WhiteTowerPassageCommand, h: WhiteTowerHost): { state: WhiteTowerPassagesState; effect: WhiteTowerEffect; notes: string[]; injuries: WhiteTowerSceneInjury[] } {
  const blocked = whiteTowerPassageBlock(previous, c, h); if (blocked) throw Error(blocked);
  if ((c.type === 'BUILD') !== (h.check !== null)) throw Error('只有本处第一次机械施工消费一次真实独立检定。');
  const s = clone(previous), r = route(s, c.passageId), p = definition(c.passageId), e = whiteTowerPassageCost(s, c, h);
  const from = r.playerPosition, residentFrom = r.resident.position, notes: string[] = [], consumed: string[] = [], injuries: WhiteTowerSceneInjury[] = [];
  const completionWeek = h.week + Math.floor((h.nowSecond + e.seconds - h.weekAnchor) / 604800);
  let walkedMeters = 0;
  const permission = (answer: 'ACCEPT' | 'WITHDRAWN', reason: string) => { r.resident.consent = answer; r.resident.permissionHistory.push({ eventId: h.eventId, second: h.nowSecond + e.seconds, position: r.resident.position, answer, reason }); };
  const unload = () => { r.apparatus.loaded = false; r.materials.tool.holder = 'PLAYER'; notes.push('亲手卸下临时载荷并收回同一工具；已耗材料和原件损伤不返还，居民没有移动。'); };
  if (c.type === 'SURVEY') { walkedMeters = p.obstacle * 2; r.survey = { eventId: h.eventId, second: h.nowSecond + e.seconds, walkedMeters }; notes.push(`本人从入口走到${p.obstacle}米阻点、实测后原路返回，共${walkedMeters}米。${p.problem}；${r.resident.name}仍在入口，原器材属于本人。`); }
  else if (c.type === 'ASK_PERMISSION') { permission('ACCEPT', r.construction ? '临时载荷已解除，同意用已查明的普通维修继续；须再验收后才走。' : '同意修理我的原器材；机械验收完成后我会自己走过去。'); notes.push(`${r.resident.name}（${r.resident.age}岁）当面明确同意本处普通施工和验收后步行；没有改变位置，也不授予其他人的许可。`); }
  else if (c.type === 'BUY_MATERIALS') { r.materials.stock = 0; r.materials.boughtEventId = h.eventId; r.materials.tool.holder = 'PLAYER'; notes.push(`实付${p.price}便士购买本处唯一一份${p.materials}，工具${r.materials.tool.id}随本人携带；未取用旧章原物。`); }
  else if (c.type === 'BUY_REPAIR') { r.materials.repair.stock = 0; r.materials.repair.boughtEventId = h.eventId; notes.push(`实付${p.repairPrice}便士买下这处唯一备用包${r.materials.repair.id}；只补普通消耗材料，不创造原器材。`); }
  else if (c.type === 'BUILD' || c.type === 'REPAIR') {
    walkedMeters = p.obstacle; r.playerPosition = p.obstacle; r.materials.tool.holder = 'SITE'; r.materials.tool.condition -= c.type === 'BUILD' ? 5 : 3; r.apparatus.loaded = true; r.apparatus.version++;
    if (c.type === 'BUILD') {
      r.materials.consumedEventId = h.eventId; consumed.push(r.materials.id); r.construction = { eventId: h.eventId, passed: passed(h.check), check: clone(h.check!), repairedEventId: null };
      r.apparatus.condition = passed(h.check) ? 85 : 45;
      if (!passed(h.check)) { const severe = h.check!.tier === 'GREAT_FAILURE'; e.health = severe ? 8 : 4; const injury: WhiteTowerSceneInjury = { id: `${h.eventId}:ordinary-repair-injury`, severity: severe ? 'HEAVY' : 'LIGHT', acquiredRevision: h.revision, treatedRevision: null }; s.playerInjuries.push(injury); injuries.push(injury); permission('WITHDRAWN', '支撑试装发生偏移；我先留在入口，请卸载后再来问我。'); }
      notes.push(`本人携原料实走${walkedMeters}米，在原器材上完成一次机械施工。${passed(h.check) ? '试装成立，仍须独立承重验收，居民尚未通过。' : '试装偏移，普通材料已耗并造成本人实际伤势；居民当次撤回许可，留在入口。可免费卸载收工具并退回，购唯一备用包后再取得许可维修。'}`);
    } else { r.materials.repair.consumedEventId = h.eventId; consumed.push(r.materials.repair.id); r.construction!.repairedEventId = h.eventId; r.apparatus.condition = 80; notes.push(`本人携同一工具实走${walkedMeters}米，按已查明的偏移卸力、换入备用材料并重新固定；普通维修完成，不重掷第一次施工，也不增加技巧掌握。`); }
  }
  else if (c.type === 'ACCEPT_WORK') { walkedMeters = r.playerPosition === 0 ? p.obstacle : 0; r.playerPosition = p.obstacle; r.acceptance = { eventId: h.eventId, apparatusVersion: r.apparatus.version, second: h.nowSecond + e.seconds }; r.apparatus.fixed = true; r.apparatus.loaded = false; r.materials.tool.holder = 'PLAYER'; r.apparatus.condition--; notes.push('本人逐一机械检查连接、施加实际承重并收回原工具；固定材料留在原处。验收不等于居民已经走过。'); }
  else if (c.type === 'PASS_RESIDENT') { walkedMeters = p.length; r.playerPosition = p.length; r.resident.position = p.length; r.apparatus.condition--; r.passage = { eventId: h.eventId, week: completionWeek, second: h.nowSecond + e.seconds, from: 0, to: p.length, walkedMeters, permissionEventId: r.resident.permissionHistory.at(-1)!.eventId }; notes.push(`${r.resident.name}在本次本人许可下，和你从0米实际步行${p.length}米到达终点，耗时${e.seconds}秒。原器材承重磨损1，下一真实周须原处复核；报告不能代替这次步行。`); }
  else if (c.type === 'REVIEW_NEXT_WEEK') { walkedMeters = p.length; r.playerPosition = p.length; r.apparatus.condition = Math.max(0, r.apparatus.condition - Math.min(20, (h.week - r.passage!.week) * 2)); r.review = { eventId: h.eventId, week: completionWeek, second: h.nowSecond + e.seconds, apparatusVersion: r.apparatus.version, residentPosition: r.resident.position, walkedMeters }; notes.push(`第${h.week}真实周，本人再走同一${p.length}米通路，检查同一原器材并在原终点见到${r.resident.name}。首次实步在第${r.passage!.week}周；周间磨损保留，没有自动迁人或复制报告。`); }
  else if (c.type === 'UNLOAD') unload();
  else { if (r.apparatus.loaded && !r.apparatus.fixed) unload(); if (r.materials.tool.holder === 'SITE') r.materials.tool.holder = 'PLAYER'; walkedMeters = r.playerPosition; r.playerPosition = 0; notes.push(`本人沿已走原路实际退回${walkedMeters}米至入口，原工具随身；${r.resident.name}仍在其实际${r.resident.position}米处，未通过者不会被报告移动。`); }
  s.lastSecond = h.nowSecond + e.seconds;
  s.journal.push({ id: h.eventId, revision: h.revision, command: clone(c), beforeSecond: h.nowSecond, afterSecond: s.lastSecond, from, to: r.playerPosition, walkedMeters, residentFrom, residentTo: r.resident.position, apparatusId: r.apparatus.id, apparatusVersion: r.apparatus.version, materialsConsumed: consumed, effect: clone(e), check: clone(h.check), notes: [...notes] });
  return { state: s, effect: e, notes, injuries };
}
export function canLeaveWhiteTowerPassages(s: WhiteTowerPassagesState, location?: string): boolean {
  return s.routes.filter(r => location === undefined || r.location === location).every(r => r.playerPosition === 0 && !r.apparatus.loaded && r.materials.tool.holder !== 'SITE');
}
export function whiteTowerPassageVerifiedReceipts(s: WhiteTowerPassagesState): WhiteTowerPassageReceipt[] {
  return s.routes.filter(r => r.survey && r.materials.consumedEventId && r.acceptance && r.passage && r.review && r.review.week > r.passage.week && r.review.second > r.passage.second && r.review.residentPosition === definition(r.id).length && r.resident.position === definition(r.id).length && r.apparatus.fixed && r.acceptance.apparatusVersion === r.apparatus.version && r.review.apparatusVersion === r.apparatus.version && r.playerPosition === 0).map(r => ({ passageId: r.id, residentId: r.resident.id, apparatusId: r.apparatus.id, passedEventId: r.passage!.eventId, passedWeek: r.passage!.week, reviewedEventId: r.review!.eventId, reviewedWeek: r.review!.week }));
}
export const whiteTowerPassagesComplete = (s: WhiteTowerPassagesState): boolean => whiteTowerPassageVerifiedReceipts(s).length === WHITE_TOWER_PASSAGES.length;
export const whiteTowerPassagesBlock = whiteTowerPassageBlock;
export const applyWhiteTowerPassages = applyWhiteTowerPassage;
export const canLeaveWhiteTowerPassage = canLeaveWhiteTowerPassages;
export function projectWhiteTowerPassages(s: WhiteTowerPassagesState) {
  return { id: 'white-tower-passages', title: '三处原通路、实际居民与隔周复核', lines: s.routes.map(r => { const p = definition(r.id); return `${p.title}：本人${r.playerPosition}米，${r.resident.name}（${r.resident.age}岁）${r.resident.position}米/${p.length}米；许可${r.resident.consent === 'ACCEPT' ? '本人同意' : r.resident.consent === 'WITHDRAWN' ? '已撤回' : '未问'}；原器材${r.apparatus.id}状况${r.apparatus.condition}，版本${r.apparatus.version}。${r.review ? `第${r.review.week}周已实走复核` : r.passage ? `第${r.passage.week}周已实际通过，待下一真实周回访` : r.acceptance ? '已机械验收，尚未过人' : r.construction ? r.construction.passed || r.construction.repairedEventId ? '已施工，待验收' : '施工失败，可卸载退场并普通维修' : r.survey ? '已实勘' : '待亲到实勘'}；材料${r.materials.consumedEventId ? '已耗' : r.materials.boughtEventId ? '已实付持有' : '未买'}，原工具${r.materials.tool.holder === 'PLAYER' ? '随身' : r.materials.tool.holder === 'SITE' ? '仍在原施工点' : '尚未购买'}。`; }).concat('每处材料和备用包各仅一份；免费卸载、收工具和本人实退始终可用。普通施工没有借用旧纸张、滑块或耗尽充能器，也不增加旧技巧掌握。') };
}
export function getWhiteTowerPassageActions(s: WhiteTowerPassagesState, h: WhiteTowerHost) {
  const labels: Record<WhiteTowerPassageCommand['type'], string> = { SURVEY: '亲走阻点实勘后返回', ASK_PERMISSION: '当面询问这位居民当前许可', BUY_MATERIALS: '购买本处有限普通材料与工具', BUILD: '亲到原器材进行机械施工', ACCEPT_WORK: '本人独立承重验收并收工具', PASS_RESIDENT: '陪同这位原居民实际走完全程', REVIEW_NEXT_WEEK: '下一真实周亲走原处复核', BUY_REPAIR: '购买本处唯一备用材料包', REPAIR: '用已购备用材料普通维修', UNLOAD: '普通卸载并收回原工具', RETURN_ON_FOOT: '本人沿原路实退至入口' };
  const actions = s.routes.flatMap(r => TYPES.map(type => { const command: WhiteTowerPassageCommand = { type, passageId: r.id }, e = whiteTowerPassageCost(s, command, h), reason = whiteTowerPassageBlock(s, command, h); return { command, label: `${definition(r.id).title}：${labels[type]}`, cost: `${e.actions}行动、${e.cashCost}便士，实际${e.seconds}秒${type === 'BUILD' ? '；一次真实施工检定，失败可普通维修' : ''}`, enabled: reason === null, reason, preferredAction: false }; }));
  const r = s.routes.find(p => p.location === h.location);
  if (r) {
    let type: WhiteTowerPassageCommand['type'];
    if (r.playerPosition !== 0) type = r.apparatus.loaded && !r.apparatus.fixed && r.construction && (r.construction.passed || r.construction.repairedEventId) ? 'ACCEPT_WORK' : 'RETURN_ON_FOOT';
    else if (!r.survey) type = 'SURVEY';
    else if (r.resident.consent !== 'ACCEPT' && !r.passage) type = 'ASK_PERMISSION';
    else if (!r.materials.boughtEventId) type = 'BUY_MATERIALS';
    else if (!r.construction) type = 'BUILD';
    else if (!r.construction.passed && !r.construction.repairedEventId) type = r.materials.repair.boughtEventId ? 'REPAIR' : 'BUY_REPAIR';
    else if (!r.acceptance) type = 'ACCEPT_WORK';
    else if (!r.passage) type = 'PASS_RESIDENT';
    else type = 'REVIEW_NEXT_WEEK';
    const next = actions.find(a => a.command.passageId === r.id && a.command.type === type && a.enabled); if (next) next.preferredAction = true;
  }
  return actions;
}
