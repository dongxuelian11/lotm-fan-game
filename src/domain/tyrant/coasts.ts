import type { PublicCheckResult } from '../../shared/contracts.js';

/** R215 original-game simulation. Population, grain, prices, distances and the
 * twelve-week window are authored rules, not quotations from the novel. */
export const TYRANT_COASTS = [
  { id: 'north', location: 'TYRANT0-NORTH', title: '北岸灯港', cohortId: 'TYRANT0-NORTH-ORIGINAL', population: 90000, grain: 15 },
  { id: 'east', location: 'TYRANT0-EAST', title: '东岸礁港', cohortId: 'TYRANT0-EAST-ORIGINAL', population: 90000, grain: 15 },
  { id: 'south', location: 'TYRANT0-SOUTH', title: '南岸浅港', cohortId: 'TYRANT0-SOUTH-ORIGINAL', population: 90000, grain: 6 },
] as const;
export const TYRANT_EVIDENCE_WEEKS = 12;
export const TYRANT_REQUIRED_FOLLOWERS = 200000;
export type TyrantCoastId = typeof TYRANT_COASTS[number]['id'];
export interface TyrantSeaVoyage {
  eventId: string; from: string; to: string; departWeek: number; arriveWeek: number;
  departSecond: number; arriveSecond: number; cashCost: number; actions: number; cargoId: string | null;
}
/** The central authoritative host supplies actual current state and paid voyages.
 * None of these values is accepted in a public coast/challenge command. */
export interface TyrantHost {
  actorId: string; eventId: string; revision: number; status: string; sequence: number | null;
  week: number; weekAnchor: number; nowSecond: number; location: string;
  cash: number; actions: number; health: number; mind: number; spirituality: number;
  check: PublicCheckResult | null; seaVoyages?: TyrantSeaVoyage[];
}
export interface TyrantEffect {
  cashCost: number; cashGain: number; actions: number; spirituality: number;
  mind: number; health: number; seconds: number; toLocation: string | null;
}
export interface TyrantSceneInjury { id: string; severity: 'LIGHT' | 'HEAVY'; acquiredRevision: number; treatedRevision: null }
export const emptyTyrantEffect = (): TyrantEffect => ({ cashCost: 0, cashGain: 0, actions: 0, spirituality: 0, mind: 0, health: 0, seconds: 0, toLocation: null });
export const TYRANT_COAST_COMMANDS = ['SURVEY', 'ASK_PERMISSION', 'FULFILL', 'REVIEW_NEXT_WEEK', 'RENEW', 'REFUSE', 'COERCE', 'ASK_TRANSFER', 'LOAD_TRANSFER', 'DELIVER_TRANSFER', 'DISCARD_CARGO', 'RETURN_TO_HARBOR'] as const;
export type TyrantCoastCommand = { type: typeof TYRANT_COAST_COMMANDS[number]; coastId: TyrantCoastId };
/** Fixed, disjoint original member ranges. Each row is an intersection, never
 * three independent population totals that could refer to different people. */
export interface TyrantCoastCohort {
  id: string; firstMember: number; lastMember: number; living: number;
  fears: boolean; obeys: boolean; believes: boolean;
}
export interface TyrantCoast {
  id: TyrantCoastId; location: string; grain: number; playerPosition: number;
  surveyedEventId: string | null; status: 'UNVISITED' | 'OPEN' | 'PENDING_REVIEW' | 'RESOLVED' | 'REFUSED' | 'COERCED';
  cohorts: TyrantCoastCohort[];
  permission: { eventId: string; week: number; answer: 'ACCEPT' | 'REFUSE' | 'WITHDRAWN'; reason: string } | null;
  permissionHistory: { eventId: string; week: number; answer: 'ACCEPT' | 'REFUSE' | 'WITHDRAWN'; reason: string }[];
  fulfillment: { eventId: string; week: number; second: number; grain: 3; check: PublicCheckResult; passed: boolean; permissionEventId: string } | null;
  review: { eventId: string; week: number; second: number; fulfillmentEventId: string; expiresWeek: number } | null;
  transferPermission: { eventId: string; week: number; answer: 'ACCEPT' | 'REFUSE'; reason: string } | null;
}
export interface TyrantGrainParcel {
  id: string; source: 'north' | 'east'; destination: 'south'; grain: 3;
  loadedEventId: string; loadedWeek: number; loadedSecond: number;
  status: 'CARRIED' | 'DELIVERED' | 'LOST'; deliveredEventId: string | null; voyageEventId: string | null; lostEventId: string | null;
}
export interface TyrantCoastsState {
  version: 1; runId: string; actorId: string; startWeek: number; lastSecond: number;
  coasts: TyrantCoast[]; parcels: TyrantGrainParcel[];
  journal: { id: string; revision: number; command: TyrantCoastCommand; week: number; beforeSecond: number; afterSecond: number;
    grainBefore: number; grainAfter: number; from: number; to: number; effect: TyrantEffect; check: PublicCheckResult | null; notes: string[] }[];
}
const clone = <T>(v: T): T => structuredClone(v);
const definition = (id: TyrantCoastId) => TYRANT_COASTS.find(c => c.id === id)!;
const coast = (s: TyrantCoastsState, id: TyrantCoastId) => s.coasts.find(c => c.id === id)!;
const passed = (c: PublicCheckResult | null) => c?.tier === 'SUCCESS' || c?.tier === 'GREAT_SUCCESS';
const endWeek = (h: TyrantHost, seconds: number) => h.week + Math.floor((h.nowSecond + seconds - h.weekAnchor) / 604800);
export const tyrantCoastNeedsCheck = (c: TyrantCoastCommand) => c.type === 'FULFILL' || c.type === 'RENEW';
export const carriedTyrantParcel = (s: TyrantCoastsState): TyrantGrainParcel | null => s.parcels.find(p => p.status === 'CARRIED') ?? null;
export function validateTyrantCoastCommand(value: unknown): value is TyrantCoastCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  return Object.keys(c).sort().join('|') === 'coastId|type' && TYRANT_COAST_COMMANDS.some(t => t === c.type) && TYRANT_COASTS.some(p => p.id === c.coastId);
}
export function createTyrantCoasts(runId: string, actorId: string, startWeek: number, nowSecond: number): TyrantCoastsState {
  return { version: 1, runId, actorId, startWeek, lastSecond: nowSecond, parcels: [], journal: [], coasts: TYRANT_COASTS.map(p => ({
    id: p.id, location: p.location, grain: p.grain, playerPosition: 0, surveyedEventId: null, status: 'UNVISITED',
    cohorts: [0, 1, 2].map(n => ({ id: `${p.cohortId}-${n + 1}`, firstMember: n * 30000 + 1, lastMember: (n + 1) * 30000, living: 30000, fears: false, obeys: false, believes: false })),
    permission: null, permissionHistory: [], fulfillment: null, review: null, transferPermission: null,
  })) };
}
export function tyrantCoastCost(s: TyrantCoastsState, c: TyrantCoastCommand, _h: TyrantHost): TyrantEffect {
  const e = emptyTyrantEffect();
  if (c.type === 'SURVEY') { e.actions = 1; e.seconds = 180; }
  if (c.type === 'ASK_PERMISSION' || c.type === 'ASK_TRANSFER' || c.type === 'REFUSE') e.seconds = 120;
  if (c.type === 'FULFILL' || c.type === 'RENEW') { e.actions = 1; e.seconds = 600; e.spirituality = 6; }
  if (c.type === 'REVIEW_NEXT_WEEK') { e.actions = 1; e.seconds = 600; }
  if (c.type === 'COERCE') { e.actions = 1; e.seconds = 600; e.spirituality = 12; }
  if (c.type === 'LOAD_TRANSFER') { e.cashCost = 180; e.actions = 1; e.seconds = 600; }
  if (c.type === 'DELIVER_TRANSFER') { e.actions = 1; e.seconds = 600; }
  if (c.type === 'DISCARD_CARGO') e.seconds = 60;
  if (c.type === 'RETURN_TO_HARBOR') e.seconds = coast(s, c.coastId).playerPosition * 2;
  return e;
}
function parcelVoyage(s: TyrantCoastsState, h: TyrantHost): TyrantSeaVoyage | undefined {
  const p = carriedTyrantParcel(s); if (!p) return undefined;
  return h.seaVoyages?.find(v => v.cargoId === p.id && v.from === definition(p.source).location && v.to === definition('south').location
    && v.departSecond >= p.loadedSecond && v.departWeek >= p.loadedWeek && v.arriveSecond <= h.nowSecond && v.arriveWeek <= h.week
    && v.arriveSecond - v.departSecond === 604800 && v.arriveWeek === v.departWeek + 1 && v.cashCost === 60 && v.actions === 1
    && !s.parcels.some(other => other.status === 'DELIVERED' && other.voyageEventId === v.eventId));
}
export function tyrantCoastBlock(s: TyrantCoastsState, c: TyrantCoastCommand, h: TyrantHost): string | null {
  if (!validateTyrantCoastCommand(c)) return '无效海岸指令；不能自行填写人口、许可、粮食或运输回执。';
  const r = coast(s, c.coastId);
  if (h.status !== 'ACTIVE' || h.health <= 0 || h.sequence !== 1 || h.actorId !== s.actorId || h.location !== r.location) return '须同一在世雷神本人亲到这处原海岸。';
  if (!Number.isSafeInteger(h.nowSecond) || h.nowSecond < s.lastSecond || h.week < s.startWeek || h.nowSecond < h.weekAnchor || h.nowSecond >= h.weekAnchor + 604800 || (s.journal.at(-1)?.revision ?? -1) >= h.revision || s.journal.some(j => j.id === h.eventId)) return '现场时间、版本或事件已失效，不能重复领取同一回执。';
  const e = tyrantCoastCost(s, c, h);
  if (h.cash < e.cashCost || h.actions < e.actions || h.spirituality < e.spirituality) return '实际便士、行动或灵性不足；普通返港不收费、不耗行动。';
  if (c.type === 'RETURN_TO_HARBOR') return r.playerPosition === 0 ? '本人已经在这处港口。' : null;
  if (c.type === 'DISCARD_CARGO') return carriedTyrantParcel(s) ? null : '本人没有携带中的原粮包，不能重复丢弃。';
  if (r.playerPosition !== 0) return '先沿原三十米堤岸实际返港，再办理下一项行动。';
  if (c.type === 'SURVEY') return r.surveyedEventId ? '这处固定九万人群已经实际勘察，不另造人口。' : null;
  if (c.type === 'DELIVER_TRANSFER') return c.coastId !== 'south' || !carriedTyrantParcel(s) || !parcelVoyage(s, h) ? '须携同一原粮包，完成实付60便士、1行动和1真实周的北岸或东岸至南岸航程。' : null;
  if (!r.surveyedEventId) return '先亲到这处港口实勘固定原人群与有限存粮。';
  if (c.type === 'ASK_TRANSFER') {
    if (c.coastId === 'south') return '只有北岸或东岸可向南岸调拨；没有凭空补货。';
    return r.transferPermission?.week === h.week ? '本周已问过原粮主，请尊重这一次答复。' : null;
  }
  if (c.type === 'LOAD_TRANSFER') return c.coastId === 'south' || r.status === 'COERCED' || carriedTyrantParcel(s) || r.grain < 6 || r.transferPermission?.answer !== 'ACCEPT' || r.transferPermission.week !== h.week || endWeek(h, e.seconds) !== h.week || s.parcels.some(p => p.id === `${r.transferPermission?.eventId}:grain-parcel`) ? '须当周原粮主许可、空的随身货位和至少6粮；装3粮后必须为原岸保留3粮，每次许可只装一包。' : null;
  if (c.type === 'ASK_PERMISSION') {
    if (r.status === 'COERCED') return '胁迫造成的服从不等于信仰，此原人群不再签订本次晋升契约。';
    if (r.permission?.week === h.week) return '本周已得到这一原人群答复，不反复询问刷许可。';
    if (r.status === 'PENDING_REVIEW') return '上一份原粮已经交付，须下周复核，不覆盖旧履约。';
    if (r.status === 'RESOLVED' && r.review && h.week < r.review.expiresWeek) return '这份人群证据仍有效，无须重签。';
    return null;
  }
  if (c.type === 'REFUSE') return r.status === 'REFUSED' || r.status === 'COERCED' ? '当前已经没有有效自愿约定。' : null;
  if (c.type === 'COERCE') return r.status === 'COERCED' ? '胁迫记录已经成立，不能重复制造同一人群。' : null;
  if (c.type === 'FULFILL' || c.type === 'RENEW') {
    if (r.permission?.answer !== 'ACCEPT' || r.permission.week !== h.week || endWeek(h, e.seconds) !== h.week || r.grain < 3 || r.status === 'COERCED') return '须取得当周真实许可并从本处现存粮实际付出3粮；跨周许可失效。';
    if (c.type === 'FULFILL') return r.fulfillment ? '已有原履约历史；失效或失败后须续约，不能伪装第一次。' : null;
    return !r.fulfillment || r.status === 'PENDING_REVIEW' || (r.status === 'RESOLVED' && r.review && h.week < r.review.expiresWeek) ? '只有原履约失败、被拒或十二周证据到期后才可实际付3粮续约。' : null;
  }
  if (c.type === 'REVIEW_NEXT_WEEK') return r.status !== 'PENDING_REVIEW' || !r.fulfillment || h.week <= r.fulfillment.week || h.nowSecond <= r.fulfillment.second ? '须原履约后的下一真实周，本人回来确认同一批仍在世居民的实际选择。' : null;
  return '当前没有这项海岸行动。';
}
export function applyTyrantCoast(previous: TyrantCoastsState, c: TyrantCoastCommand, h: TyrantHost): { state: TyrantCoastsState; effect: TyrantEffect; notes: string[]; injuries: TyrantSceneInjury[] } {
  const blocked = tyrantCoastBlock(previous, c, h); if (blocked) throw Error(blocked);
  if (tyrantCoastNeedsCheck(c) !== (h.check !== null)) throw Error('只有实际履约或续约护堤使用一次独立检定；公开指令不能指定成败。');
  const s = clone(previous), r = coast(s, c.coastId), e = tyrantCoastCost(s, c, h), notes: string[] = [], injuries: TyrantSceneInjury[] = [];
  const grainBefore = r.grain, from = r.playerPosition, completedWeek = endWeek(h, e.seconds);
  const permission = (answer: 'ACCEPT' | 'REFUSE' | 'WITHDRAWN', reason: string) => { r.permission = { eventId: h.eventId, week: completedWeek, answer, reason }; r.permissionHistory.push(clone(r.permission)); };
  if (c.type === 'SURVEY') { r.surveyedEventId = h.eventId; r.status = 'OPEN'; notes.push(`亲走原堤核对${definition(r.id).title}固定九万人群及${r.grain}粮；原成员不与另外两岸重复，未承诺服从或信仰。`); }
  else if (c.type === 'ASK_PERMISSION') { const accepted = r.grain >= 3; permission(accepted ? 'ACCEPT' : 'REFUSE', accepted ? '原居民同意三粮救济和实际护堤；先履约，下周再由原居民作出是否继续追随的答复。' : '现存粮不足三份，居民拒绝空头救济；须先调拨真实粮包。'); if (!accepted) r.status = 'REFUSED'; notes.push(r.permission!.reason); }
  else if (c.type === 'FULFILL' || c.type === 'RENEW') {
    r.grain -= 3; r.playerPosition = 30; r.review = null;
    r.fulfillment = { eventId: h.eventId, week: completedWeek, second: h.nowSecond + e.seconds, grain: 3, check: clone(h.check!), passed: passed(h.check), permissionEventId: r.permission!.eventId };
    r.status = 'PENDING_REVIEW';
    for (const g of r.cohorts) { g.fears = true; g.obeys = passed(h.check); g.believes = false; }
    if (!passed(h.check)) { e.health = h.check!.tier === 'GREAT_FAILURE' ? 8 : 4; const injury: TyrantSceneInjury = { id: `${h.eventId}:shore-injury`, severity: h.check!.tier === 'GREAT_FAILURE' ? 'HEAVY' : 'LIGHT', acquiredRevision: h.revision, treatedRevision: null }; injuries.push(injury); }
    notes.push(`实际消耗原岸3粮与6灵性，本人走到30米堤端护堤。${passed(h.check) ? '海浪受到限制，同一原人群畏惧这份力量并按撤离指令行动；是否相信你仍须下周真实复核。' : '护堤失败并造成本人真实伤势；三粮仍已交付、不能返还，居民虽畏惧力量却没有服从或信仰。'}须沿原路返港。`);
  }
  else if (c.type === 'REVIEW_NEXT_WEEK') {
    r.playerPosition = 30;
    if (r.fulfillment!.passed) { r.status = 'RESOLVED'; for (const g of r.cohorts) { g.obeys = true; g.believes = true; } r.review = { eventId: h.eventId, week: completedWeek, second: h.nowSecond + e.seconds, fulfillmentEventId: r.fulfillment!.eventId, expiresWeek: completedWeek + TYRANT_EVIDENCE_WEEKS }; notes.push(`第${completedWeek}周当面确认同一原人群仍畏惧、服从并相信你；证据至第${r.review.expiresWeek}周开始失效，届时必须重付现粮续约并隔周复核。`); }
    else { r.status = 'REFUSED'; permission('REFUSE', '居民记得失败，明确拒绝继续服从与信仰；保留既有损耗，可下一周重谈并实际付粮重做。'); notes.push(r.permission!.reason); }
  }
  else if (c.type === 'REFUSE') { r.status = 'REFUSED'; r.review = null; for (const g of r.cohorts) { g.obeys = false; g.believes = false; } permission('WITHDRAWN', '本人解除约定，居民自由离开追随关系；旧成本、原人数与历史保留。'); notes.push(r.permission!.reason); }
  else if (c.type === 'COERCE') { r.status = 'COERCED'; r.review = null; for (const g of r.cohorts) { g.fears = true; g.obeys = true; g.believes = false; } permission('WITHDRAWN', '暴力只迫使居民屈从；原人群拒绝信仰，不计入晋升氛围。'); notes.push(r.permission!.reason); }
  else if (c.type === 'ASK_TRANSFER') { const accepted = r.grain >= 6 && r.status !== 'COERCED'; r.transferPermission = { eventId: h.eventId, week: completedWeek, answer: accepted ? 'ACCEPT' : 'REFUSE', reason: accepted ? '原粮主同意当周取三粮送南岸，原岸必须留三粮。' : '原粮主拒绝调拨：不足以保留三粮，或胁迫破坏了许可。' }; notes.push(r.transferPermission.reason); }
  else if (c.type === 'LOAD_TRANSFER') { r.grain -= 3; s.parcels.push({ id: `${r.transferPermission!.eventId}:grain-parcel`, source: c.coastId as 'north' | 'east', destination: 'south', grain: 3, loadedEventId: h.eventId, loadedWeek: completedWeek, loadedSecond: h.nowSecond + e.seconds, status: 'CARRIED', deliveredEventId: null, voyageEventId: null, lostEventId: null }); notes.push('实付180便士、1行动和600秒装上同一三粮包；原岸留足三粮。须再实付60便士、1行动及1真实周乘相邻海路到南岸，正常安全航线损耗为零。'); }
  else if (c.type === 'DELIVER_TRANSFER') { const p = carriedTyrantParcel(s)!; p.status = 'DELIVERED'; p.deliveredEventId = h.eventId; p.voyageEventId = parcelVoyage(previous, h)!.eventId; r.grain += p.grain; notes.push(`再付1行动和600秒卸下原粮包${p.id}，南岸收到原3粮；包裹已结清，不能重复装卸领取。`); }
  else if (c.type === 'DISCARD_CARGO') { const p = carriedTyrantParcel(s)!; p.status = 'LOST'; p.lostEventId = h.eventId; notes.push(`丢弃原粮包${p.id}；实际3粮永久损失，不返回原岸也不到达南岸。`); }
  else { notes.push(`本人沿原堤真实走回${r.playerPosition}米至港口；没有移动人群或补粮。`); r.playerPosition = 0; }
  s.lastSecond = h.nowSecond + e.seconds;
  s.journal.push({ id: h.eventId, revision: h.revision, command: clone(c), week: completedWeek, beforeSecond: h.nowSecond, afterSecond: s.lastSecond, grainBefore, grainAfter: r.grain, from, to: r.playerPosition, effect: clone(e), check: clone(h.check), notes: [...notes] });
  return { state: s, effect: e, notes, injuries };
}
/** Invoke on actual host death/abandonment in the same transaction. No refund. */
export function loseTyrantCargo(previous: TyrantCoastsState, eventId: string, reason: 'DEATH' | 'DISCARD'): TyrantCoastsState {
  const s = clone(previous); for (const p of s.parcels) if (p.status === 'CARRIED') { p.status = 'LOST'; p.lostEventId = `${eventId}:${reason}`; } return s;
}
export const canLeaveTyrantCoasts = (s: TyrantCoastsState, location?: string): boolean => s.coasts.filter(c => location === undefined || c.location === location).every(c => c.playerPosition === 0);
export function tyrantCoastEvidence(s: TyrantCoastsState, week: number) {
  const validRoster = s.coasts.length === TYRANT_COASTS.length && TYRANT_COASTS.every(p => {
    const matches = s.coasts.filter(r => r.id === p.id); if (matches.length !== 1) return false;
    const r = matches[0]!;
    return r.location === p.location && r.cohorts.length === 3 && [0, 1, 2].every(n => {
      const group = r.cohorts.filter(g => g.id === `${p.cohortId}-${n + 1}`); if (group.length !== 1) return false;
      const g = group[0]!; return g.firstMember === n * 30000 + 1 && g.lastMember === (n + 1) * 30000
        && Number.isSafeInteger(g.living) && g.living >= 0 && g.living <= 30000;
    });
  });
  const groups = s.coasts.flatMap(r => {
    const fulfillment = s.journal.find(j => j.id === r.fulfillment?.eventId && j.command.coastId === r.id
      && (j.command.type === 'FULFILL' || j.command.type === 'RENEW') && j.grainBefore - j.grainAfter === 3 && passed(j.check));
    const review = s.journal.find(j => j.id === r.review?.eventId && j.command.coastId === r.id && j.command.type === 'REVIEW_NEXT_WEEK');
    const current = validRoster && r.status === 'RESOLVED' && r.fulfillment !== null && r.fulfillment.passed && fulfillment !== undefined
      && r.review !== null && review !== undefined && r.review.fulfillmentEventId === r.fulfillment.eventId
      && r.review.week > r.fulfillment.week && r.review.week === review.week && r.review.expiresWeek === r.review.week + TYRANT_EVIDENCE_WEEKS
      && r.review.week <= week && week < r.review.expiresWeek;
    return r.cohorts.map(g => ({ ...g, coastId: r.id, current, reviewedEventId: r.review?.eventId ?? null, expiresWeek: r.review?.expiresWeek ?? null }));
  });
  const intersection = groups.reduce((n, g) => n + (g.current && g.fears && g.obeys && g.believes ? g.living : 0), 0);
  return { week, groups, validRoster, intersection, required: TYRANT_REQUIRED_FOLLOWERS, ready: intersection >= TYRANT_REQUIRED_FOLLOWERS };
}
export function projectTyrantCoasts(s: TyrantCoastsState, week: number) {
  const evidence = tyrantCoastEvidence(s, week), parcel = carriedTyrantParcel(s);
  return { id: 'tyrant-coasts', title: '三岸原人群与当前追随', lines: s.coasts.map(r => `${definition(r.id).title}：原九万人，现存${r.cohorts.reduce((n, g) => n + g.living, 0)}人；存粮${r.grain}，本人距港${r.playerPosition}米；${r.status === 'COERCED' ? '胁迫，永不计入本次证据' : r.status === 'RESOLVED' && r.review ? week < r.review.expiresWeek ? `已复核，到第${r.review.expiresWeek}周失效` : '旧证据已失效，须三粮续约并隔周复核' : r.status === 'PENDING_REVIEW' ? `待第${r.fulfillment!.week + 1}周起复核` : r.status === 'REFUSED' ? '居民拒绝，须尊重答复' : '尚未建立当前追随'}。`).concat(`当前同一在世原成员同时恐惧、服从、信仰的交集${evidence.intersection}/${evidence.required}；不能相加三种不同人群。`, parcel ? `随身${parcel.id}：原3粮，待真实航运和南岸交付。` : '随身无粮包。', '全图初始共36粮，等周不补货。调拨总价240便士、3行动、1200秒加1真实周；一包三粮，原岸保留三粮。') };
}
export function getTyrantCoastActions(s: TyrantCoastsState, h: TyrantHost) {
  const labels: Record<TyrantCoastCommand['type'], string> = { SURVEY: '实勘原海岸', ASK_PERMISSION: '询问当前救济许可', FULFILL: '交付三粮并实际护堤', REVIEW_NEXT_WEEK: '隔周当面复核', RENEW: '重付三粮续约护堤', REFUSE: '解除约定', COERCE: '胁迫居民（不产生信仰）', ASK_TRANSFER: '询问本周三粮调拨许可', LOAD_TRANSFER: '付费装上原三粮包', DELIVER_TRANSFER: '在南岸交付同一原粮包', DISCARD_CARGO: '丢弃随身原粮包', RETURN_TO_HARBOR: '沿原堤实际返港' };
  const actions = s.coasts.flatMap(r => TYRANT_COAST_COMMANDS.map(type => { const command: TyrantCoastCommand = { type, coastId: r.id }, effect = tyrantCoastCost(s, command, h), reason = tyrantCoastBlock(s, command, h); return { command, label: `${definition(r.id).title}：${labels[type]}`, cost: `${effect.cashCost}便士、${effect.actions}行动、${effect.spirituality}灵性、${effect.seconds}秒${type === 'FULFILL' || type === 'RENEW' ? '，现存3粮' : ''}`, enabled: reason === null, reason, preferredAction: false }; }));
  const r = s.coasts.find(p => p.location === h.location);
  if (r) {
    const parcel = carriedTyrantParcel(s), expired = r.status === 'RESOLVED' && r.review !== null && h.week >= r.review.expiresWeek;
    let type: TyrantCoastCommand['type'] | null = r.playerPosition > 0 ? 'RETURN_TO_HARBOR' : parcel && r.id === 'south' ? 'DELIVER_TRANSFER' : !r.surveyedEventId ? 'SURVEY' : r.status === 'PENDING_REVIEW' ? 'REVIEW_NEXT_WEEK' : r.status === 'COERCED' || (r.status === 'RESOLVED' && !expired) ? null : r.permission?.answer !== 'ACCEPT' || r.permission.week !== h.week ? 'ASK_PERMISSION' : r.fulfillment ? 'RENEW' : 'FULFILL';
    if (r.id !== 'south' && !parcel && r.grain >= 6 && coast(s, 'south').grain < 3 && type === null) type = r.transferPermission?.answer === 'ACCEPT' && r.transferPermission.week === h.week ? 'LOAD_TRANSFER' : 'ASK_TRANSFER';
    const next = actions.find(a => a.command.coastId === r.id && a.command.type === type && a.enabled); if (next) next.preferredAction = true;
  }
  return actions;
}
export const applyTyrantCoastCommand = applyTyrantCoast;
export const blockTyrantCoastCommand = tyrantCoastBlock;
export const tyrantCoastsComplete = (s: TyrantCoastsState, week: number): boolean => tyrantCoastEvidence(s, week).ready;
