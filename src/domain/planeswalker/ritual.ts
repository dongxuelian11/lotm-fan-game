import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicCheckResult, PublicGameDate, PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';

/** These nine separated settlements and their exact route costs are authored practice, not universal cosmology. */
export const PLANESWALKER_RITUAL_SITE_IDS = ['PW2-COPPER', 'PW2-SALT', 'PW2-GLASS', 'PW2-REED', 'PW2-ASH', 'PW2-TIDE', 'PW2-BELL', 'PW2-LAMP', 'PW2-STONE'] as const;
export type PlaneswalkerRitualSiteId = typeof PLANESWALKER_RITUAL_SITE_IDS[number];
export type PlaneswalkerRitualLocation = 'LOCAL' | PlaneswalkerRitualSiteId;
const SIMPLE_COMMANDS = ['CHECK_ROUTE_COORDINATES', 'CHECK_ROUTE_PROTECTION', 'CHECK_ROUTE_RETURN', 'CONTACT_SETTLEMENT', 'HELP_SETTLEMENT', 'VERIFY_LEGEND', 'CHECK_RITUAL_RETURN_MARKER', 'RETURN_RITUAL', 'CLOSE_ROUTE_KIT'] as const;
export type PlaneswalkerRitualCommand =
  | { type: 'PREPARE_ROUTE_KIT'; siteId: PlaneswalkerRitualSiteId }
  | { type: typeof SIMPLE_COMMANDS[number] }
  | { type: 'DEPART_RITUAL'; confirmed: true };
export interface PlaneswalkerRitualResident {
  id: string; name: string; age: number; alive: true; location: PlaneswalkerRitualSiteId;
}
export interface PlaneswalkerRitualSite {
  id: PlaneswalkerRitualSiteId; name: string; worldId: 'WN3-REMOTE-WORLD';
  coordinates: { sourceId: string; oldDockId: 'WN3-REMOTE-DOCK'; eastMetres: number; northMetres: 0 };
  shelter: { id: string; enclosed: true; breathable: true; maintainedBy: string; location: PlaneswalkerRitualSiteId };
  returnMarker: { id: string; intact: true; destinationId: 'PW2-LOCAL-MARKER'; location: PlaneswalkerRitualSiteId };
  witness: PlaneswalkerRitualResident; reteller: PlaneswalkerRitualResident;
  object: { id: string; name: string; location: PlaneswalkerRitualSiteId; ownerId: string; condition: 'NEEDS_HELP' | 'REPAIRED'; change: string; changedWeek: number | null; changedByVisitId: string | null };
  record: { id: string; location: PlaneswalkerRitualSiteId; entry: null | { id: string; week: number; visitId: string; witnessId: string; objectId: string; text: string } };
  retelling: null | { week: number; visitId: string; speakerId: string; heardFromId: string; originalEntryId: string; originalObjectId: string; text: string };
  helpVisitId: string | null; helpWeek: number | null; verifiedVisitId: string | null; verifiedWeek: number | null; qualifiedWeek: number | null;
}
export interface PlaneswalkerRouteKit {
  id: string; source: 'PW2-PAID-ROUTE-PROVIDER'; purchasedWeek: number; price: 30;
  location: PlaneswalkerRitualLocation | 'PROVIDER_ARCHIVE';
  suit: { id: string; initialProtectionSeconds: 90; protectionSeconds: number; spentSeconds: number };
  energy: { id: string; status: 'UNUSED' | 'CONSUMED'; consumedFor: 'OUTBOUND' | 'RETURN' | null }[];
  routeSheet: { id: string; siteId: PlaneswalkerRitualSiteId; coordinateSourceId: string; localMarkerId: 'PW2-LOCAL-MARKER'; remoteMarkerId: string };
  archivedWeek: number | null;
}
export interface PlaneswalkerRitualVisit {
  id: string; siteId: PlaneswalkerRitualSiteId; purpose: 'HELP' | 'VERIFY'; week: number; date: PublicGameDate;
  phase: 'PREPARED' | 'AWAY' | 'RETURNED' | 'FAILED' | 'CLOSED';
  coordinatesRead: boolean; protectionChecked: boolean; returnPlanned: boolean; returnMarkerChecked: boolean;
  contactedResidentIds: string[]; departureTier: PublicResolutionTier | null; helpPerformed: boolean; verificationPerformed: boolean;
  result: 'NONE' | 'CANCELLED' | 'OUTBOUND_FAILURE' | 'INTERRUPTED' | 'HELPED' | 'VERIFIED';
  kit: PlaneswalkerRouteKit; elapsedSeconds: number;
  moves: { from: PlaneswalkerRitualLocation; to: PlaneswalkerRitualLocation; mode: 'STAR_WANDERING'; seconds: 10; originalBody: true; kitId: string; energyPieceId: string }[];
  paid: { actions: number; spirituality: number; pennies: number; energyPieces: number; protectionSeconds: number; mind: number; pollution: number };
}
interface RitualBudget { actions: number; spirituality: number; cash: number; health: number; mind: number; pollution: number }
interface RitualEvidence {
  visitId: string; siteId: PlaneswalkerRitualSiteId; bodyLocation: PlaneswalkerRitualLocation; kitId: string;
  coordinates: PlaneswalkerRitualSite['coordinates']; localMarkerId: 'PW2-LOCAL-MARKER'; remoteMarkerId: string;
  witnessId: string; retellerId: string; objectId: string; recordId: string; originalEntryId: string | null;
}
export interface PlaneswalkerRitualEvent {
  week: number; date: PublicGameDate; command: PlaneswalkerRitualCommand; knowledge: number;
  randomBefore: number; randomAfter: number; check: PublicCheckResult | null;
  before: RitualBudget; after: RitualBudget; evidence: RitualEvidence;
}
export interface PlaneswalkerRitualState {
  worldId: 'WN3-REMOTE-WORLD'; provider: { id: 'PW2-ROUTE-PROVIDER'; name: '玛伦·维斯'; age: 46; location: 'LOCAL' };
  localMarker: { id: 'PW2-LOCAL-MARKER'; location: 'LOCAL'; intact: true };
  playerLocation: PlaneswalkerRitualLocation; clockSeconds: number; offworldLegs: number; activeVisitId: string | null;
  sites: Record<PlaneswalkerRitualSiteId, PlaneswalkerRitualSite>; visits: PlaneswalkerRitualVisit[]; journal: PlaneswalkerRitualEvent[];
}
export interface PlaneswalkerRitualAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: PlaneswalkerRitualCommand }
export interface PlaneswalkerRitualProjection {
  title: string; story: string; environment: string; risk: string; inside: boolean; playerLocation: PlaneswalkerRitualLocation;
  locationLabel: string; qualified: boolean; qualifiedSites: number; qualifiedWeek: number | null; clockSeconds: number; offworldLegs: number;
  sites: (PlaneswalkerRitualSite & { status: string; task: string })[]; visits: PlaneswalkerRitualVisit[];
  currentVisit: PlaneswalkerRitualVisit | null; actions: PlaneswalkerRitualAction[];
}
const DEFINITIONS = [
  { id: 'PW2-COPPER', name: '铜脊聚居点', witness: '阿黛拉·赫斯', age: 42, reteller: '米洛·塞恩', retellerAge: 35, object: '温室通风手轮', change: '扶正脱槽的手轮并锁回原销，通风叶恢复转动', task: '与阿黛拉一起扶正温室原手轮，使用留在当地的原销重新锁紧。' },
  { id: 'PW2-SALT', name: '盐井聚居点', witness: '伊沃·默恩', age: 51, reteller: '赛拉·图恩', retellerAge: 38, object: '蓄水架滑轨', change: '抬回偏斜的原托架并扣紧旧卡扣，水罐恢复平稳', task: '在伊沃见证下抬正蓄水架原托架，扣紧仍在原位的旧卡扣。' },
  { id: 'PW2-GLASS', name: '琉砂聚居点', witness: '薇拉·寇林', age: 34, reteller: '艾蒙·卢克', retellerAge: 47, object: '照明反射板', change: '依原刻度转回反射板，作业台重获照明', task: '按薇拉指认的旧刻度手动转回原反射板，让作业台重新受光。' },
  { id: 'PW2-REED', name: '芦穹聚居点', witness: '多兰·佩斯', age: 58, reteller: '莉娅·法恩', retellerAge: 29, object: '培育槽闸片', change: '清走夹住原闸片的碎茎并复位，槽内水流恢复', task: '帮助多兰清走培育槽原闸片上的碎茎，再将同一闸片复位。' },
  { id: 'PW2-ASH', name: '灰湾聚居点', witness: '娜迪娅·鲁恩', age: 40, reteller: '奥尔森·里德', retellerAge: 53, object: '公共门内侧铰架', change: '托起下垂原铰架并旋紧原螺栓，内门恢复正常开合', task: '与娜迪娅托住下垂的内门铰架，旋紧原螺栓；外层密封舱不受影响。' },
  { id: 'PW2-TIDE', name: '潮痕聚居点', witness: '雷欧·艾斯', age: 31, reteller: '梅瑞·朗恩', retellerAge: 44, object: '储物升降轮', change: '把原绳索拨回轮槽并系回原环，储物篮恢复升降', task: '按雷欧指认把原绳索拨回轮槽，重新系到同一储物篮的原环。' },
  { id: 'PW2-BELL', name: '钟谷聚居点', witness: '埃达·摩斯', age: 49, reteller: '芬恩·维勒', retellerAge: 33, object: '报时钟击锤', change: '取出卡住的碎片并校回原击锤，公共钟恢复报时', task: '在埃达当面见证下清除报时钟内碎片，校回同一原击锤。' },
  { id: 'PW2-LAMP', name: '灯原聚居点', witness: '帕维尔·索恩', age: 45, reteller: '芮娜·斯托', retellerAge: 36, object: '航标灯原透镜架', change: '按原光纹刻线扶正透镜架，航标重现旧有清晰光纹', task: '帮助帕维尔扶正原透镜架，只恢复原有航标光纹，不制造新光源。' },
  { id: 'PW2-STONE', name: '石环聚居点', witness: '柯拉·温特', age: 55, reteller: '达里安·福斯', retellerAge: 41, object: '公共磨轮定位柄', change: '托稳同一磨轮并扣回原定位柄，轮轴恢复平稳', task: '与柯拉托稳公共磨轮，将同一定位柄扣回原轴槽。' },
] as const;
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const success = (tier: PublicResolutionTier | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const atStage = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 3;
const current = (r: PlaneswalkerRitualState) => r.visits.find(v => v.id === r.activeVisitId) ?? null;
function createSite(d: typeof DEFINITIONS[number], index: number): PlaneswalkerRitualSite {
  return { id: d.id, name: d.name, worldId: 'WN3-REMOTE-WORLD',
    coordinates: { sourceId: `${d.id}-COORDINATE-REGISTER`, oldDockId: 'WN3-REMOTE-DOCK', eastMetres: (index + 1) * 2000, northMetres: 0 },
    shelter: { id: `${d.id}-LIVING-HULL`, enclosed: true, breathable: true, maintainedBy: `${d.id}-WITNESS`, location: d.id },
    returnMarker: { id: `${d.id}-RETURN-MARKER`, intact: true, destinationId: 'PW2-LOCAL-MARKER', location: d.id },
    witness: { id: `${d.id}-WITNESS`, name: d.witness, age: d.age, alive: true, location: d.id },
    reteller: { id: `${d.id}-RETELLER`, name: d.reteller, age: d.retellerAge, alive: true, location: d.id },
    object: { id: `${d.id}-ORIGINAL`, name: d.object, location: d.id, ownerId: `${d.id}-WITNESS`, condition: 'NEEDS_HELP', change: d.change, changedWeek: null, changedByVisitId: null },
    record: { id: `${d.id}-LOCAL-BOOK`, location: d.id, entry: null }, retelling: null,
    helpVisitId: null, helpWeek: null, verifiedVisitId: null, verifiedWeek: null, qualifiedWeek: null };
}
export function createPlaneswalkerRitualState(): PlaneswalkerRitualState {
  const sites = Object.fromEntries(DEFINITIONS.map((d, i) => [d.id, createSite(d, i)])) as Record<PlaneswalkerRitualSiteId, PlaneswalkerRitualSite>;
  return { worldId: 'WN3-REMOTE-WORLD', provider: { id: 'PW2-ROUTE-PROVIDER', name: '玛伦·维斯', age: 46, location: 'LOCAL' },
    localMarker: { id: 'PW2-LOCAL-MARKER', location: 'LOCAL', intact: true }, playerLocation: 'LOCAL', clockSeconds: 0, offworldLegs: 0, activeVisitId: null, sites, visits: [], journal: [] };
}
function freshVisit(r: PlaneswalkerRitualState, siteId: PlaneswalkerRitualSiteId, week: number, date: PublicGameDate): PlaneswalkerRitualVisit {
  const id = `PW2-VISIT-${r.visits.length + 1}`, site = r.sites[siteId], kitId = `${id}-KIT`;
  return { id, siteId, purpose: site.helpVisitId === null ? 'HELP' : 'VERIFY', week, date: structuredClone(date), phase: 'PREPARED',
    coordinatesRead: false, protectionChecked: false, returnPlanned: false, returnMarkerChecked: false, contactedResidentIds: [],
    departureTier: null, helpPerformed: false, verificationPerformed: false, result: 'NONE', elapsedSeconds: 0, moves: [],
    paid: { actions: 1, spirituality: 0, pennies: 30, energyPieces: 0, protectionSeconds: 0, mind: 0, pollution: 0 },
    kit: { id: kitId, source: 'PW2-PAID-ROUTE-PROVIDER', purchasedWeek: week, price: 30, location: 'LOCAL', archivedWeek: null,
      suit: { id: `${kitId}-SUIT`, initialProtectionSeconds: 90, protectionSeconds: 90, spentSeconds: 0 },
      energy: [1, 2].map(n => ({ id: `${kitId}-ENERGY-${n}`, status: 'UNUSED' as const, consumedFor: null })),
      routeSheet: { id: `${kitId}-ROUTE-SHEET`, siteId, coordinateSourceId: site.coordinates.sourceId, localMarkerId: 'PW2-LOCAL-MARKER', remoteMarkerId: site.returnMarker.id } } };
}
export function validatePlaneswalkerRitualCommand(v: unknown): v is PlaneswalkerRitualCommand {
  if (!record(v)) return false;
  if (v.type === 'PREPARE_ROUTE_KIT') return shape(v, ['type', 'siteId']) && PLANESWALKER_RITUAL_SITE_IDS.includes(v.siteId as PlaneswalkerRitualSiteId);
  if (v.type === 'DEPART_RITUAL') return shape(v, ['type', 'confirmed']) && v.confirmed === true;
  return shape(v, ['type']) && SIMPLE_COMMANDS.includes(v.type as typeof SIMPLE_COMMANDS[number]);
}
export const hasPlaneswalkerRitualLock = (s: SliceState): boolean => s.planeswalker.ritual.activeVisitId !== null || s.planeswalker.ritual.playerLocation !== 'LOCAL';
function completeSite(r: PlaneswalkerRitualState, site: PlaneswalkerRitualSite): boolean {
  const first = r.visits.find(v => v.id === site.helpVisitId), second = r.visits.find(v => v.id === site.verifiedVisitId);
  return !!first && !!second && first !== second && first.siteId === site.id && second.siteId === site.id &&
    first.phase === 'CLOSED' && second.phase === 'CLOSED' && first.purpose === 'HELP' && second.purpose === 'VERIFY' && first.result === 'HELPED' && second.result === 'VERIFIED' &&
    first.kit.location === 'PROVIDER_ARCHIVE' && second.kit.location === 'PROVIDER_ARCHIVE' && first.kit.archivedWeek === first.week && second.kit.archivedWeek === second.week &&
    first.helpPerformed && second.verificationPerformed && first.moves.length === 2 && second.moves.length === 2 && second.week > first.week &&
    site.object.condition === 'REPAIRED' && site.object.changedByVisitId === first.id && site.record.entry?.visitId === first.id &&
    site.retelling?.visitId === second.id && site.retelling.originalEntryId === site.record.entry.id &&
    site.record.entry.witnessId === site.witness.id && site.record.entry.objectId === site.object.id && site.retelling.originalObjectId === site.object.id &&
    site.retelling.speakerId === site.reteller.id && site.retelling.heardFromId === site.witness.id && site.helpWeek === first.week && site.verifiedWeek === second.week && site.qualifiedWeek === second.week;
}
export const planeswalkerRitualQualified = (s: SliceState): boolean => {
  const r = s.planeswalker.ritual;
  return !hasPlaneswalkerRitualLock(s) && PLANESWALKER_RITUAL_SITE_IDS.every(id => completeSite(r, r.sites[id]));
};
function localBlock(r: PlaneswalkerRitualState, c: PlaneswalkerRitualCommand, week: number): string | null {
  const v = current(r);
  if (c.type === 'PREPARE_ROUTE_KIT') {
    if (v || r.playerLocation !== 'LOCAL') return '先实际返回本地并归档当前护具与余片。';
    const site = r.sites[c.siteId];
    if (site.qualifiedWeek !== null) return '这处已留下并核实传说，原居民、原物和记录保留。';
    if (site.helpWeek !== null && week <= site.helpWeek) return '须等初访之后的下一真实周，再赴当地听取转述。';
    if (site.helpVisitId !== null && !r.visits.some(x => x.id === site.helpVisitId && x.phase === 'CLOSED' && x.result === 'HELPED')) return '初访尚未完成真实返程与本地收束。';
    return null;
  }
  if (!v || v.phase === 'CLOSED' || v.week !== week) return '须本周正在进行的同一次路线准备或远行。';
  const site = r.sites[v.siteId];
  if (c.type === 'CLOSE_ROUTE_KIT') return r.playerLocation === 'LOCAL' && ['PREPARED', 'FAILED', 'RETURNED'].includes(v.phase) && v.kit.location === 'LOCAL' ? null : '本人和同一套原护具仍在异星，必须先支付回程资源实际回来。';
  if (c.type === 'CHECK_ROUTE_COORDINATES' || c.type === 'CHECK_ROUTE_PROTECTION' || c.type === 'CHECK_ROUTE_RETURN') {
    if (v.phase !== 'PREPARED' || r.playerLocation !== 'LOCAL') return '只可在本地出发前检查当次原路线与装备。';
    const done = c.type === 'CHECK_ROUTE_COORDINATES' ? v.coordinatesRead : c.type === 'CHECK_ROUTE_PROTECTION' ? v.protectionChecked : v.returnPlanned;
    return done ? '这次已经核过，不会重置原物或重复计数。' : null;
  }
  if (c.type === 'DEPART_RITUAL') return v.phase === 'PREPARED' && r.playerLocation === 'LOCAL' && v.coordinatesRead && v.protectionChecked && v.returnPlanned &&
    r.localMarker.intact && v.kit.location === 'LOCAL' && v.kit.suit.protectionSeconds === 90 && v.kit.energy.every(e => e.status === 'UNUSED') && v.departureTier === null ? null : '先实际核对当次目的地坐标、防护和回程原标记；每套原片只允许一次出程检验。';
  if (v.phase !== 'AWAY' || r.playerLocation !== site.id || v.kit.location !== site.id || !success(v.departureTier)) return '本人须已实际抵达所选异星聚居点的封闭生活舱。';
  if (c.type === 'CHECK_RITUAL_RETURN_MARKER') return !v.returnMarkerChecked && site.returnMarker.intact && r.localMarker.intact ? null : '须在当地亲查仍完好的原回程标记，每次远行重新核对。';
  if (c.type === 'RETURN_RITUAL') return v.returnMarkerChecked && site.returnMarker.intact && r.localMarker.intact && v.kit.suit.protectionSeconds >= 10 && v.kit.energy.filter(e => e.status === 'UNUSED').length === 1 ? null : '返程须已亲查当地原标记，保留同一护具10秒和当次剩余的一片原能源。';
  if (c.type === 'CONTACT_SETTLEMENT') return v.contactedResidentIds.length === 0 && site.shelter.breathable && site.shelter.enclosed && site.witness.alive && site.reteller.alive && site.witness.location === site.id && site.reteller.location === site.id ? null : '须当面接触这处真实生活舱内的原居民，不能用投影或本地代签。';
  if (v.contactedResidentIds.length !== 2 || !v.contactedResidentIds.includes(site.witness.id) || !v.contactedResidentIds.includes(site.reteller.id)) return '先在当地当面认识两位原居民，并亲看原物与原记录簿。';
  if (c.type === 'HELP_SETTLEMENT') return v.purpose === 'HELP' && !v.helpPerformed && site.helpVisitId === null && site.object.condition === 'NEEDS_HELP' && site.object.location === site.id && site.record.entry === null ? null : '只可在初访当地实际帮助一次，改变这一件原物并让原居民现场见证。';
  if (c.type === 'VERIFY_LEGEND') return v.purpose === 'VERIFY' && !v.verificationPerformed && site.helpWeek !== null && week > site.helpWeek && site.helpVisitId !== v.id && site.record.entry !== null && site.object.condition === 'REPAIRED' && site.object.location === site.id && site.verifiedVisitId === null ? null : '必须在初访之后的真实周再次到场，亲听另一位居民转述，并核同一原物与初访留下的原记录。';
  return '当前不能进行这一步。';
}
function priorPracticeOpen(s: SliceState): boolean {
  const old = s.wanderer.life, secret = s.secretsSorcerer.life;
  return s.wanderer.preparedWeek !== null || ['READY', 'FIGHTING'].includes(s.wanderer.encounter.status) || old.activeCase !== null ||
    old.playerLocation !== 'START' || old.suit.location === 'PLAYER' || old.anchor.location === 'PLAYER' || Object.values(old.cases).some(x => x.status === 'PREPARED') ||
    ['SURVEYED', 'PREPARED', 'FIGHTING', 'SEALED', 'FINISHED'].includes(s.secretsSorcerer.ritual.phase) ||
    secret.room.position === 'INSIDE' || secret.room.hidden || secret.pocket.linked || secret.pocket.mode !== 'NONE' || secret.banishment.location === 'AWAY' || secret.banishment.restrained ||
    Object.values(secret.cases).some(x => x.contactOpen || x.suspended || x.status === 'PREPARED') ||
    Object.values(s.recorder.cases).some(x => x.contactOpen) || Object.values(s.traveler.cases).some(x => x.contactOpen) ||
    s.traveler.ritual.at !== 'HOME' || s.traveler.practice.position !== 'ENTRY' || s.traveler.practice.companionPosition !== 'ENTRY' || s.traveler.practice.card !== 'DESK' || s.traveler.practice.consent ||
    Object.values(s.apprentice.cases).some(x => x.position === 'INSIDE') ||
    [s.apprentice.cases, s.trickmaster.cases, s.astrologer.cases, s.recorder.cases, s.traveler.cases].some(cases => Object.values(cases).some(x => x.status === 'PREPARED'));
}
function resourceBlock(b: RitualBudget, c: PlaneswalkerRitualCommand): string | null {
  if (c.type === 'PREPARE_ROUTE_KIT') {
    if (b.actions < 2 || b.spirituality < 24) return '开始每次远行须至少2行动和24灵性；备装花1行动，另留1行动给当地帮助或复核。';
    if (b.cash < 30) return '当次新路线护具和两片独立能源需要30便士。';
  }
  if (c.type === 'DEPART_RITUAL' && (b.actions < 1 || b.spirituality < 24 || b.mind <= 0)) return '出发仍须至少1行动、24灵性及清醒精神，不能耗掉当地工作与真实返程的预算。';
  if ((c.type === 'HELP_SETTLEMENT' || c.type === 'VERIFY_LEGEND') && b.actions < 1) return '当地帮助或复核实际需要1行动；资源不足仍可按原条件真实返回。';
  if (c.type === 'RETURN_RITUAL' && b.spirituality < 8) return '实际回程需要8灵性，不会在退出时补给或免费传回。';
  return null;
}
const budget = (s: SliceState): RitualBudget => ({ actions: s.actionsRemaining, spirituality: s.spirituality, cash: s.cash, health: s.health, mind: s.mind, pollution: s.seer.pollution });
export function blockPlaneswalkerRitualCommand(s: SliceState, c: PlaneswalkerRitualCommand): string | null {
  if (!validatePlaneswalkerRitualCommand(c)) return '旅法师仪式命令无效；出发需单独明确确认。';
  if (!atStage(s) || s.status !== 'ACTIVE' || s.health <= 0) return '新的仪式行动只可由仍活着的漫游者·门序列3进行。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (s.world.city !== 'BACKLUND') return '本地路线起点在贝克兰德，须先沿正常行程抵达。';
  if (!s.planeswalker.guidanceKnown) return '先听旅法师指导，认识独立路线供应者及异星风险。';
  if (s.planeswalker.preparedWeek !== null || priorPracticeOpen(s)) return '先实际收束旧现场与服药准备，不能让同一身体同时身处两地。';
  return localBlock(s.planeswalker.ritual, c, s.week) ?? resourceBlock(budget(s), c);
}
function evidence(r: PlaneswalkerRitualState, c: PlaneswalkerRitualCommand): RitualEvidence {
  const v = current(r), siteId = c.type === 'PREPARE_ROUTE_KIT' ? c.siteId : v!.siteId, site = r.sites[siteId];
  const visitId = c.type === 'PREPARE_ROUTE_KIT' ? `PW2-VISIT-${r.visits.length + 1}` : v!.id;
  return { visitId, siteId, bodyLocation: r.playerLocation, kitId: `${visitId}-KIT`, coordinates: structuredClone(site.coordinates), localMarkerId: r.localMarker.id,
    remoteMarkerId: site.returnMarker.id, witnessId: site.witness.id, retellerId: site.reteller.id, objectId: site.object.id, recordId: site.record.id, originalEntryId: site.record.entry?.id ?? null };
}
function charge(before: RitualBudget, c: PlaneswalkerRitualCommand, tier: PublicResolutionTier | null): RitualBudget {
  const b = { ...before };
  if (c.type === 'PREPARE_ROUTE_KIT') { b.actions--; b.cash -= 30; }
  if (c.type === 'HELP_SETTLEMENT' || c.type === 'VERIFY_LEGEND') b.actions--;
  if (c.type === 'DEPART_RITUAL' || c.type === 'RETURN_RITUAL') { b.spirituality -= 8; b.pollution = Math.min(100, b.pollution + (c.type === 'DEPART_RITUAL' && !success(tier) ? 2 : 1)); }
  if (c.type === 'DEPART_RITUAL' && !success(tier)) b.mind = Math.max(0, b.mind - 5);
  return b;
}
function spendPiece(v: PlaneswalkerRitualVisit, forLeg: 'OUTBOUND' | 'RETURN'): string {
  const piece = v.kit.energy.find(e => e.status === 'UNUSED')!;
  piece.status = 'CONSUMED'; piece.consumedFor = forLeg; v.paid.energyPieces++; v.paid.spirituality += 8; return piece.id;
}
function move(r: PlaneswalkerRitualState, v: PlaneswalkerRitualVisit, to: PlaneswalkerRitualLocation, pieceId: string): void {
  v.moves.push({ from: r.playerLocation, to, mode: 'STAR_WANDERING', seconds: 10, originalBody: true, kitId: v.kit.id, energyPieceId: pieceId });
  r.playerLocation = to; v.kit.location = to; r.clockSeconds += 10; r.offworldLegs++; v.elapsedSeconds += 10;
  v.kit.suit.protectionSeconds -= 10; v.kit.suit.spentSeconds += 10; v.paid.protectionSeconds += 10;
}
/** The same physical reducer is used for live actions and complete journal reconstruction. */
function evolve(r: PlaneswalkerRitualState, c: PlaneswalkerRitualCommand, week: number, date: PublicGameDate, tier: PublicResolutionTier | null, before: RitualBudget, after: RitualBudget): void {
  if (c.type === 'PREPARE_ROUTE_KIT') { const v = freshVisit(r, c.siteId, week, date); r.visits.push(v); r.activeVisitId = v.id; return; }
  const v = current(r)!, site = r.sites[v.siteId];
  v.paid.mind += before.mind - after.mind; v.paid.pollution += after.pollution - before.pollution;
  switch (c.type) {
    case 'CHECK_ROUTE_COORDINATES': v.coordinatesRead = true; break;
    case 'CHECK_ROUTE_PROTECTION': v.protectionChecked = true; break;
    case 'CHECK_ROUTE_RETURN': v.returnPlanned = true; break;
    case 'DEPART_RITUAL': {
      v.departureTier = tier; const piece = spendPiece(v, 'OUTBOUND');
      if (success(tier)) { move(r, v, site.id, piece); v.phase = 'AWAY'; }
      else v.phase = 'FAILED';
      break;
    }
    case 'CONTACT_SETTLEMENT': v.contactedResidentIds = [site.witness.id, site.reteller.id]; break;
    case 'HELP_SETTLEMENT':
      v.paid.actions++; v.helpPerformed = true; site.object.condition = 'REPAIRED'; site.object.changedWeek = week; site.object.changedByVisitId = v.id;
      site.helpVisitId = v.id; site.helpWeek = week;
      site.record.entry = { id: `${site.record.id}-ENTRY-1`, week, visitId: v.id, witnessId: site.witness.id, objectId: site.object.id,
        text: `${site.witness.name}当面见证来访者${site.object.change}，并在原簿留下这件事的记录。` }; break;
    case 'VERIFY_LEGEND':
      v.paid.actions++; v.verificationPerformed = true; site.verifiedVisitId = v.id; site.verifiedWeek = week;
      site.retelling = { week, visitId: v.id, speakerId: site.reteller.id, heardFromId: site.witness.id, originalEntryId: site.record.entry!.id, originalObjectId: site.object.id,
        text: `${site.reteller.name}当面对你转述：此前${site.witness.name}说过，来访者曾${site.object.change}。你核对了仍在当地的原物和第${site.helpWeek}周原簿记录。` }; break;
    case 'CHECK_RITUAL_RETURN_MARKER': v.returnMarkerChecked = true; break;
    case 'RETURN_RITUAL': { const piece = spendPiece(v, 'RETURN'); move(r, v, 'LOCAL', piece); v.phase = 'RETURNED'; break; }
    case 'CLOSE_ROUTE_KIT':
      v.result = v.phase === 'FAILED' ? 'OUTBOUND_FAILURE' : v.phase === 'PREPARED' ? 'CANCELLED' : v.verificationPerformed ? 'VERIFIED' : v.helpPerformed ? 'HELPED' : 'INTERRUPTED';
      v.phase = 'CLOSED'; v.kit.location = 'PROVIDER_ARCHIVE'; v.kit.archivedWeek = week; r.activeVisitId = null;
      if (v.verificationPerformed) site.qualifiedWeek = week;
      break;
  }
}
export function applyPlaneswalkerRitualCommand(s: SliceState, c: PlaneswalkerRitualCommand, ctx: SeerContext): void {
  const reason = blockPlaneswalkerRitualCommand(s, c); if (reason) throw new Error(reason);
  const r = s.planeswalker.ritual, before = budget(s), source = evidence(r, c), knowledge = s.character.coreStats.knowledge, randomBefore = s.random.cursor;
  const check = c.type === 'DEPART_RITUAL' ? structuredClone(ctx.check('knowledge', 20)) : null, after = charge(before, c, check?.tier ?? null);
  s.actionsRemaining = after.actions; s.spirituality = after.spirituality; s.cash = after.cash; s.mind = after.mind; s.seer.pollution = after.pollution;
  evolve(r, c, s.week, s.date, check?.tier ?? null, before, after);
  r.journal.push({ week: s.week, date: structuredClone(s.date), command: structuredClone(c), knowledge, randomBefore, randomAfter: s.random.cursor, check, before, after, evidence: source });
  const v = r.visits.find(x => x.id === source.visitId)!, site = r.sites[v.siteId];
  let detail = '';
  if (c.type === 'PREPARE_ROUTE_KIT') detail = `实付1行动、30便士，取得这次独立护具和两片能源。原护具90秒，每片只可用一次。此前远行和旧诺拉的原物不补充。`;
  if (c.type === 'DEPART_RITUAL') detail = success(check!.tier) ? '同一身体携当次原护具实际抵达当地封闭生活舱，出程消耗8灵性、一片能源、10秒防护，污染+1。舱内可正常呼吸，已有污染仍保留。' : '出程检验失败，身体仍在本地；8灵性和一片原能源已耗，精神−5、污染+2（以实际资源上限为准）。本套不能重试，可归档余物后另筹新套。';
  if (c.type === 'CONTACT_SETTLEMENT') detail = `本人当面见到${site.witness.name}（${site.witness.age}岁）和${site.reteller.name}（${site.reteller.age}岁），两人都住在${site.name}。原${site.object.name}与当地原簿仍在面前。`;
  if (c.type === 'HELP_SETTLEMENT') detail = `花1行动，${site.record.entry!.text}本次不会立即计作传说；须真实返回，在以后的周再次亲访。`;
  if (c.type === 'VERIFY_LEGEND') detail = `花1行动，${site.retelling!.text}仍须让本人和当次原护具真实返回后归档。`;
  if (c.type === 'RETURN_RITUAL') detail = '本人携同一套原物真实回到本地标记，另耗8灵性、一片能源、10秒防护，污染+1；本条已核准路线不另掷回程骰。';
  if (c.type === 'CLOSE_ROUTE_KIT') detail = `已在本地归档当次原护具及余片，防护剩${v.kit.suit.protectionSeconds}秒、未用片${v.kit.energy.filter(e => e.status === 'UNUSED').length}，均不充回、不转入旧库存。${v.result === 'VERIFIED' ? '这处实际帮助与后来当地转述已一并核实。' : '这次真实结果保留，可以正常生活。'}`;
  ctx.note(`异星九地：${LABELS[c.type]}`, `${site.name}。${detail || '已核对当次原路线、原物与当前标记，身体位置和已付成本如实保留。'}当前位置：${r.playerLocation === 'LOCAL' ? '贝克兰德本地路线台' : site.name}。`);
}
const LABELS: Record<PlaneswalkerRitualCommand['type'], string> = {
  PREPARE_ROUTE_KIT: '实付费用准备当次路线套件', CHECK_ROUTE_COORDINATES: '核读这处原坐标与封闭舱信号', CHECK_ROUTE_PROTECTION: '亲查当次护具与两片原能源',
  CHECK_ROUTE_RETURN: '核本地原标记与当次回程路线', DEPART_RITUAL: '确认污染风险后，本体实际出发', CONTACT_SETTLEMENT: '在当地当面认识原居民并查看原物',
  HELP_SETTLEMENT: '实际帮助当地居民并留下原簿记录', VERIFY_LEGEND: '亲听另一居民转述，核原物与初访记录', CHECK_RITUAL_RETURN_MARKER: '在当地亲查同一原回程标记',
  RETURN_RITUAL: '支付原回程资源，让本人真实返回', CLOSE_ROUTE_KIT: '在本地归档当次护具与余片',
};
function costText(c: PlaneswalkerRitualCommand): string {
  if (c.type === 'PREPARE_ROUTE_KIT') return '1行动、30便士；开始须至少2行动和24灵性';
  if (c.type === 'DEPART_RITUAL') return '8灵性、一片原能源、知识20；成功防护10秒/污染+1，失败精神−5/污染+2且仍在本地';
  if (c.type === 'RETURN_RITUAL') return '8灵性、一片原能源、防护10秒、污染+1；须当场核过原回程标记';
  if (c.type === 'HELP_SETTLEMENT' || c.type === 'VERIFY_LEGEND') return '1行动；本人必须实际在对应异星聚居点';
  if (c.type === 'CLOSE_ROUTE_KIT') return '0行动；仅本地可收束，余量归档不返还';
  return '0行动；当次原物与实际位置检查';
}
export function planeswalkerRitualActions(s: SliceState): PlaneswalkerRitualAction[] {
  if (!atStage(s)) return [];
  const r = s.planeswalker.ritual, v = current(r), out: PlaneswalkerRitualAction[] = [];
  const add = (command: PlaneswalkerRitualCommand, label = LABELS[command.type]) => { const reason = blockPlaneswalkerRitualCommand(s, command); out.push({ id: command.type + ('siteId' in command ? `:${command.siteId}` : ''), label, cost: costText(command), enabled: reason === null, reason, command }); };
  if (!v) {
    for (const id of PLANESWALKER_RITUAL_SITE_IDS) if (r.sites[id].qualifiedWeek === null) add({ type: 'PREPARE_ROUTE_KIT', siteId: id }, `${r.sites[id].name}：${r.sites[id].helpWeek === null ? '准备初访帮助' : '准备再次亲访核实'}`);
    return out;
  }
  if (v.phase === 'PREPARED') {
    if (!v.coordinatesRead) add({ type: 'CHECK_ROUTE_COORDINATES' });
    if (!v.protectionChecked) add({ type: 'CHECK_ROUTE_PROTECTION' });
    if (!v.returnPlanned) add({ type: 'CHECK_ROUTE_RETURN' });
    add({ type: 'DEPART_RITUAL', confirmed: true });
  }
  if (v.phase === 'AWAY') {
    if (!v.contactedResidentIds.length) add({ type: 'CONTACT_SETTLEMENT' });
    if (v.purpose === 'HELP' && !v.helpPerformed) add({ type: 'HELP_SETTLEMENT' });
    if (v.purpose === 'VERIFY' && !v.verificationPerformed) add({ type: 'VERIFY_LEGEND' });
    if (!v.returnMarkerChecked) add({ type: 'CHECK_RITUAL_RETURN_MARKER' });
    add({ type: 'RETURN_RITUAL' });
  }
  add({ type: 'CLOSE_ROUTE_KIT' }); return out;
}
export function projectPlaneswalkerRitual(s: SliceState): PlaneswalkerRitualProjection {
  const r = s.planeswalker.ritual, qualifiedSites = PLANESWALKER_RITUAL_SITE_IDS.filter(id => completeSite(r, r.sites[id])).length;
  return { title: '在本星球外九处留下传说', story: '前往同一既存异星上九处真实分离的聚居点。在当地帮一件看得见的忙，让原居民现场见证并留下原簿记录；实际返回后，等以后的一周再去，亲听另一位当地居民转述，并核同一原物和初访记录。九处都完成两次真实往返，才可准备晋升。已发生的事不会因服药失败消失。',
    environment: '九处生活舱位于旧异星停泊舱以东2至18公里的不同聚居点，相邻相距2公里，各有自己的原居民、原物、封闭空气和回程标记。路线台提供逐处原坐标资料；这里的尺度与通行条件只适用于这些已核路线。',
    risk: '每次新套件30便士与1行动，原护具90秒、独立能源两片；开始须至少2行动和24灵性。出程8灵性/一片、知识20，失败仍付费，精神−5、污染+2并留本地；成功和回程各用10秒防护并污染+1。回程另需8灵性/一片与现场核过的原标记。封闭舱只提供有限正常呼吸，不清除污染，不保证任意星空或绝境可返。远行时不能做本地工作、休养或过周；普通关闭不会传回。',
    inside: hasPlaneswalkerRitualLock(s), playerLocation: r.playerLocation, locationLabel: r.playerLocation === 'LOCAL' ? '贝克兰德本地路线台' : r.sites[r.playerLocation].name,
    qualified: planeswalkerRitualQualified(s), qualifiedSites, qualifiedWeek: qualifiedSites === 9 ? Math.max(...Object.values(r.sites).map(x => x.qualifiedWeek!)) : null,
    clockSeconds: r.clockSeconds, offworldLegs: r.offworldLegs, currentVisit: structuredClone(current(r)), visits: structuredClone(r.visits),
    sites: DEFINITIONS.map(d => { const site = r.sites[d.id]; return { ...structuredClone(site), task: d.task, status: completeSite(r, site) ? '当地传说已核实，完成真实返程' : site.verifiedWeek !== null ? '当地转述已核，尚待本地归档' : site.helpWeek !== null ? `第${site.helpWeek}周实际帮助已记录，须以后的一周再次亲访` : '尚未亲访帮助' }; }), actions: planeswalkerRitualActions(s) };
}
function validBudget(v: unknown): v is RitualBudget {
  return record(v) && shape(v, ['actions', 'spirituality', 'cash', 'health', 'mind', 'pollution']) && integer(v.actions, 0, 100) && integer(v.spirituality, 0, 120) && integer(v.cash) && integer(v.health, 1, 100) && integer(v.mind, 0, 100) && integer(v.pollution, 0, 100);
}
/** Reconstruct all originals, physical trips, payments and checks. No counter alone grants the nine-place qualification. */
export function validatePlaneswalkerRitual(s: SliceState): boolean {
  try {
    const r = s.planeswalker?.ritual, expected = createPlaneswalkerRitualState();
    if (!record(r) || !shape(r, Object.keys(expected)) || !Array.isArray(r.journal) || !Array.isArray(r.visits) || !record(r.sites) || !shape(r.sites, PLANESWALKER_RITUAL_SITE_IDS)) return false;
    if (!r.journal.length) return same(r, expected) && s.planeswalker.preparedWeek === null && !s.planeswalker.bottles.some(b => b.consumedWeek !== null || b.auxiliaryKit.checkedWeeks.length > 0) && s.planeswalker.promotionWeek === null;
    if (!s.planeswalker.guidanceKnown || s.wanderer.promotionWeek === null || s.progression.pathwayId !== 'door' || ![3, 2].includes(s.progression.sequence ?? 0)) return false;
    let previous: PlaneswalkerRitualEvent | null = null, lastWeek = s.wanderer.promotionWeek, nextCursor = 0, qualificationWeek: number | null = null;
    for (const raw of r.journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'command', 'knowledge', 'randomBefore', 'randomAfter', 'check', 'before', 'after', 'evidence']) ||
        !integer(raw.week, lastWeek, s.week) || !isValidGameDate(raw.date) || compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        previous && compareGameDates(raw.date, previous.date) < 0 || !validatePlaneswalkerRitualCommand(raw.command) || !integer(raw.knowledge, 0, 500) || !validBudget(raw.before) || !validBudget(raw.after) ||
        !integer(raw.randomBefore, nextCursor, s.random.cursor) || !integer(raw.randomAfter, raw.randomBefore, s.random.cursor)) return false;
      const e = raw as unknown as PlaneswalkerRitualEvent, c = e.command, wasOpen = expected.activeVisitId !== null;
      if (s.planeswalker.promotionWeek !== null && e.week > s.planeswalker.promotionWeek || localBlock(expected, c, e.week) || resourceBlock(e.before, c)) return false;
      if (wasOpen && previous && (e.week !== previous.week || !same(e.date, previous.date) || !same(e.before, previous.after) || e.knowledge !== previous.knowledge || e.randomBefore !== previous.randomAfter)) return false;
      if (!same(e.evidence, evidence(expected, c))) return false;
      if (c.type === 'DEPART_RITUAL') {
        if (!record(e.check) || e.check.baseAbility !== e.knowledge || e.randomAfter !== e.randomBefore + 1) return false;
        const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore);
        const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: e.knowledge, difficulty: 20, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(e.check, check) || random.cursor !== e.randomAfter) return false;
      } else if (e.check !== null || e.randomAfter !== e.randomBefore) return false;
      // Between visits ordinary learning can increase knowledge. Promotion adds at most one point, never a full-form grant.
      const now = s.character.coreStats.knowledge, promoted = s.planeswalker.promotionWeek !== null;
      if (e.knowledge > now || now < 500 && e.knowledge > now - (promoted ? 1 : 0) || now > (promoted ? 21 : 20) && now < 500 && e.knowledge !== now - (promoted ? 1 : 0) || now === 500 && e.knowledge < (promoted ? 499 : 500)) return false;
      const after = charge(e.before, c, e.check?.tier ?? null); if (!same(after, e.after)) return false;
      evolve(expected, c, e.week, e.date, e.check?.tier ?? null, e.before, after); expected.journal.push(structuredClone(e));
      if (PLANESWALKER_RITUAL_SITE_IDS.every(id => completeSite(expected, expected.sites[id]))) qualificationWeek ??= e.week;
      previous = e; lastWeek = e.week; nextCursor = e.randomAfter;
    }
    if (!same(r, expected)) return false;
    if (r.activeVisitId !== null) {
      if (!atStage(s) || s.status !== 'ACTIVE' || s.health <= 0 || s.activeEvent || s.combat || s.world.city !== 'BACKLUND' || s.planeswalker.preparedWeek !== null || priorPracticeOpen(s) ||
        !previous || s.week !== previous.week || !same(s.date, previous.date) || !same(budget(s), previous.after) || s.random.cursor !== previous.randomAfter || s.character.coreStats.knowledge !== previous.knowledge) return false;
    } else if (r.playerLocation !== 'LOCAL') return false;
    if (s.planeswalker.preparedWeek !== null && (qualificationWeek === null || s.planeswalker.preparedWeek < qualificationWeek)) return false;
    for (const bottle of s.planeswalker.bottles) {
      if (bottle.consumedWeek !== null && (qualificationWeek === null || bottle.consumedWeek < qualificationWeek)) return false;
      if (!Array.isArray(bottle.auxiliaryKit.checkedWeeks) || bottle.auxiliaryKit.checkedWeeks.some(week => qualificationWeek === null || !integer(week, qualificationWeek, s.week))) return false;
    }
    if (s.planeswalker.promotionWeek !== null && (qualificationWeek === null || s.planeswalker.promotionWeek < qualificationWeek || r.activeVisitId !== null)) return false;
    return true;
  } catch { return false; }
}
