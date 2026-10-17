import type { PublicGameDate } from '../../shared/contracts.js';
import { isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';

/** Authored bounded scene. REMOTE is a different planet, never a point on the local metre line. */
export const PLANESWALKER_LOCATIONS = ['ENTRY', 'NEAR', 'FAR', 'OUTSIDE', 'REMOTE'] as const;
export type PlaneswalkerLocation = typeof PLANESWALKER_LOCATIONS[number];
export type PlaneswalkerLocalLocation = Exclude<PlaneswalkerLocation, 'REMOTE'>;
export type PlaneswalkerConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
export const PLANESWALKER_POSITION_METRES: Readonly<Record<PlaneswalkerLocalLocation, number>> = { ENTRY: 0, NEAR: 2, FAR: 6, OUTSIDE: -2 };
export const PLANESWALKER_KIT_CASE_IDS = ['symbolic-transit', 'withdrawn-transit'] as const;
export type PlaneswalkerKitCaseId = typeof PLANESWALKER_KIT_CASE_IDS[number];
export interface PlaneswalkerVerifiedEndpoint {
  planetId: string; siteId: string; title: string; coordinateId: string; returnMarkerId: string; qualifiedWeek: number;
}
export interface PlaneswalkerLifeRouteKit {
  id: string; source: 'MARA_PAID_ROUTE_PROTECTION'; caseId: PlaneswalkerKitCaseId; pricePennies: 20;
  status: 'SUPPLIER' | 'PLAYER' | 'ARCHIVED'; purchasedWeek: number | null; archivedWeek: number | null;
  paidPennies: number; initialProtectionSeconds: 90; protectionSeconds: number; astralLegs: number;
}
export interface PlaneswalkerSiteState {
  id: 'PW2-TRANSIT-HALL'; localMarkerId: 'PW2-LOCAL-MARKER'; elapsedSeconds: number; ordinaryExit: 'OPEN';
  introducedWeek: number | null; introducedDate: PublicGameDate | null;
  playerLocation: PlaneswalkerLocation; playerMetres: number; playerAstralLegs: number;
  operatorId: 'PW2-MARA'; operatorName: '玛拉'; operatorAge: 42;
  operatorLocation: PlaneswalkerLocalLocation; operatorMetres: number; operatorEnergy: number;
  operatorConsent: PlaneswalkerConsent; operatorConsentWeek: number | null;
  door: { id: 'PW2-SHUTTER'; state: 'CLOSED' | 'OPEN' | 'BLOCKED'; operations: number };
  parcel: { id: 'PW2-PARCEL'; owner: 'PLAYER'; quantity: 1; location: 'ENTRY_STAND' | 'PLAYER' | 'REMOTE_STAND'; ordinaryMetres: number; astralLegs: number };
  lamp: { id: 'PW2-HALL-LAMP'; oilRemaining: number; patternKnown: boolean; shows: number };
  screen: { id: 'PW2-SCREEN'; state: 'BLANK' | 'MATCHED'; applications: number };
  effect: { mode: 'OFF' | 'TRANSIT' | 'PATTERN'; expiresAt: number | null };
  verifiedEndpoint: PlaneswalkerVerifiedEndpoint | null; returnMarkerRead: boolean; localPadsKnown: boolean;
  kits: Record<PlaneswalkerKitCaseId, PlaneswalkerLifeRouteKit>;
}
function kit(caseId: PlaneswalkerKitCaseId): PlaneswalkerLifeRouteKit {
  return { id: caseId === 'symbolic-transit' ? 'PW2-LIFE-KIT-TRANSIT' : 'PW2-LIFE-KIT-WITHDRAWN', source: 'MARA_PAID_ROUTE_PROTECTION', caseId,
    pricePennies: 20, status: 'SUPPLIER', purchasedWeek: null, archivedWeek: null, paidPennies: 0, initialProtectionSeconds: 90, protectionSeconds: 90, astralLegs: 0 };
}
export function createPlaneswalkerSiteState(): PlaneswalkerSiteState {
  return { id: 'PW2-TRANSIT-HALL', localMarkerId: 'PW2-LOCAL-MARKER', elapsedSeconds: 0, ordinaryExit: 'OPEN', introducedWeek: null, introducedDate: null,
    playerLocation: 'ENTRY', playerMetres: 0, playerAstralLegs: 0, operatorId: 'PW2-MARA', operatorName: '玛拉', operatorAge: 42,
    operatorLocation: 'ENTRY', operatorMetres: 0, operatorEnergy: 100, operatorConsent: 'UNASKED', operatorConsentWeek: null,
    door: { id: 'PW2-SHUTTER', state: 'CLOSED', operations: 0 },
    parcel: { id: 'PW2-PARCEL', owner: 'PLAYER', quantity: 1, location: 'ENTRY_STAND', ordinaryMetres: 0, astralLegs: 0 },
    lamp: { id: 'PW2-HALL-LAMP', oilRemaining: 3, patternKnown: false, shows: 0 }, screen: { id: 'PW2-SCREEN', state: 'BLANK', applications: 0 },
    effect: { mode: 'OFF', expiresAt: null }, verifiedEndpoint: null, returnMarkerRead: false, localPadsKnown: false,
    kits: { 'symbolic-transit': kit('symbolic-transit'), 'withdrawn-transit': kit('withdrawn-transit') } };
}
/** Expiry extinguishes only the effect. No return, free refill, rollback, or copied person/object. */
export function advancePlaneswalkerTime(site: PlaneswalkerSiteState, seconds: number): void {
  if (!Number.isSafeInteger(seconds) || seconds < 0 || !Number.isSafeInteger(site.elapsedSeconds + seconds)) throw new Error('通行室经过时间无效。');
  site.elapsedSeconds += seconds;
  if (site.effect.expiresAt !== null && site.elapsedSeconds >= site.effect.expiresAt) stopPlaneswalkerEffects(site);
}
export function stopPlaneswalkerEffects(site: PlaneswalkerSiteState): void { site.effect.mode = 'OFF'; site.effect.expiresAt = null; }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export const isPlaneswalkerLocation = (v: unknown): v is PlaneswalkerLocation => PLANESWALKER_LOCATIONS.includes(v as PlaneswalkerLocation);
export const isPlaneswalkerLocalLocation = (v: unknown): v is PlaneswalkerLocalLocation => isPlaneswalkerLocation(v) && v !== 'REMOTE';
export function validatePlaneswalkerEndpoint(v: unknown): v is PlaneswalkerVerifiedEndpoint {
  return record(v) && shape(v, ['planetId', 'siteId', 'title', 'coordinateId', 'returnMarkerId', 'qualifiedWeek']) &&
    ['planetId', 'siteId', 'title', 'coordinateId', 'returnMarkerId'].every(k => typeof v[k] === 'string' && (v[k] as string).length > 0 && (v[k] as string).length <= 160) && integer(v.qualifiedWeek, 1);
}
/** Finite stocks and local/astral separation. Ordered life and encounter replay prove actual changes. */
export function validatePlaneswalkerSiteState(v: unknown): v is PlaneswalkerSiteState {
  const initial = createPlaneswalkerSiteState();
  if (!record(v) || !shape(v, Object.keys(initial)) || v.id !== initial.id || v.localMarkerId !== initial.localMarkerId || v.ordinaryExit !== 'OPEN' || !integer(v.elapsedSeconds) ||
    !isPlaneswalkerLocation(v.playerLocation) || !integer(v.playerMetres) || !integer(v.playerAstralLegs) || !isPlaneswalkerLocalLocation(v.operatorLocation) ||
    v.operatorId !== initial.operatorId || v.operatorName !== initial.operatorName || v.operatorAge !== 42 || !integer(v.operatorMetres) || !integer(v.operatorEnergy, 0, 100) ||
    !['UNASKED', 'GRANTED', 'DECLINED', 'WITHDRAWN', 'CLOSED'].includes(String(v.operatorConsent)) || typeof v.returnMarkerRead !== 'boolean' || typeof v.localPadsKnown !== 'boolean') return false;
  if (v.operatorConsent === 'UNASKED' ? v.operatorConsentWeek !== null : !integer(v.operatorConsentWeek, 1)) return false;
  const d = v.door, p = v.parcel, l = v.lamp, s = v.screen, e = v.effect;
  if (!record(d) || !shape(d, Object.keys(initial.door)) || d.id !== initial.door.id || !['OPEN', 'CLOSED', 'BLOCKED'].includes(String(d.state)) || !integer(d.operations)) return false;
  if (!record(p) || !shape(p, Object.keys(initial.parcel)) || p.id !== initial.parcel.id || p.owner !== 'PLAYER' || p.quantity !== 1 ||
    !['ENTRY_STAND', 'PLAYER', 'REMOTE_STAND'].includes(String(p.location)) || !integer(p.ordinaryMetres) || !integer(p.astralLegs) || p.astralLegs > v.playerAstralLegs) return false;
  if (!record(l) || !shape(l, Object.keys(initial.lamp)) || l.id !== initial.lamp.id || typeof l.patternKnown !== 'boolean' || !integer(l.shows, 0, 1) || l.shows !== (l.patternKnown ? 1 : 0) || l.oilRemaining !== 3 - l.shows) return false;
  if (!record(s) || !shape(s, Object.keys(initial.screen)) || s.id !== initial.screen.id || !['BLANK', 'MATCHED'].includes(String(s.state)) || !integer(s.applications) || (s.state === 'BLANK' ? s.applications !== 0 : s.applications < 1) || s.applications > 0 && !l.patternKnown) return false;
  if (!record(e) || !shape(e, Object.keys(initial.effect)) || !['OFF', 'TRANSIT', 'PATTERN'].includes(String(e.mode)) ||
    (e.mode === 'OFF' ? e.expiresAt !== null : !integer(e.expiresAt, v.elapsedSeconds + 1, v.elapsedSeconds + 20))) return false;
  if (!record(v.kits) || !shape(v.kits, PLANESWALKER_KIT_CASE_IDS)) return false;
  for (const id of PLANESWALKER_KIT_CASE_IDS) {
    const k = v.kits[id], original = initial.kits[id];
    if (!record(k) || !shape(k, Object.keys(original)) || k.id !== original.id || k.caseId !== id || k.source !== original.source || k.pricePennies !== 20 || k.initialProtectionSeconds !== 90 ||
      !['SUPPLIER', 'PLAYER', 'ARCHIVED'].includes(String(k.status)) || !integer(k.astralLegs, 0, id === 'symbolic-transit' ? 2 : 0) || k.protectionSeconds !== 90 - 10 * k.astralLegs) return false;
    if (k.status === 'SUPPLIER' ? stableStringify(k) !== stableStringify(original) : k.paidPennies !== 20 || !integer(k.purchasedWeek, 1) ||
      (k.status === 'ARCHIVED' ? !integer(k.archivedWeek, k.purchasedWeek as number) : k.archivedWeek !== null)) return false;
  }
  if (v.introducedWeek === null) return stableStringify(v) === stableStringify(initial);
  return v.localPadsKnown === true && integer(v.introducedWeek, 1) && isValidGameDate(v.introducedDate) && validatePlaneswalkerEndpoint(v.verifiedEndpoint) && v.verifiedEndpoint.qualifiedWeek <= v.introducedWeek;
}
