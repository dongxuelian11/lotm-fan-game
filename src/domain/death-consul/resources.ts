import type { PublicGameDate } from '../../shared/contracts.js';
import { isValidGameDate } from '../game-calendar.js';
import { stableStringify } from '../canonical.js';

/** One finite site. The two chambers have a six-metre direct separation and a twelve-metre ordinary bypass. */
export const DEATH_CONSUL_LOCATIONS = ['ENTRY', 'NEAR', 'DOOR', 'OTHER', 'FAR', 'OUTSIDE'] as const;
export type DeathConsulLocation = typeof DEATH_CONSUL_LOCATIONS[number];
export type DeathConsulConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
export type DeathConsulSourceEra = 'ORIGINAL' | 'POST_CYCLE';
export const DEATH_CONSUL_POSITION_METRES: Readonly<Record<DeathConsulLocation, number>> = { ENTRY: 0, NEAR: 2, DOOR: 3, OTHER: 4, FAR: 6, OUTSIDE: -2 };
export const DEATH_CONSUL_ORDINARY_ROUTE_METRES = 12;
export const DEATH_CONSUL_SOURCES = {
  ORIGINAL: { operatorId: 'DC2-SELENE', operatorName: '塞琳·沃克', operatorAge: 44, operatorSource: 'ORIGINAL_SEAL_HOUSE_ADULT', residualId: 'DC2-ORIGINAL-ECHO', residualSource: 'ORIGINAL_SEALED_RESIDUE', materialId: 'DC2-ORIGINAL-SEAL', materialPrice: 20 },
  POST_CYCLE: { operatorId: 'DC2-VERA', operatorName: '薇拉·莫恩', operatorAge: 39, operatorSource: 'POST_CYCLE_SEAL_HOUSE_ADULT', residualId: 'DC2-POST-CYCLE-ECHO', residualSource: 'POST_CYCLE_SEALED_RESIDUE', materialId: 'DC2-POST-CYCLE-SEAL', materialPrice: 4 },
} as const;
export interface DeathConsulSiteState {
  id: 'DC2-CHAMBERS'; lengthMetres: 6; ordinaryRouteMetres: 12; ordinaryExit: 'OPEN'; elapsedSeconds: number;
  sourceEra: DeathConsulSourceEra | null; introducedWeek: number | null; introducedDate: PublicGameDate | null;
  playerLocation: DeathConsulLocation; playerMetres: number; playerPassageMetres: number;
  operatorId: string | null; operatorName: string | null; operatorAge: number | null; operatorSource: string | null;
  operatorLocation: DeathConsulLocation; operatorMetres: number; operatorPassageMetres: number; operatorEnergy: number;
  operatorConsent: DeathConsulConsent; operatorConsentWeek: number | null;
  door: { id: 'DC2-DOOR'; location: 'DOOR'; state: 'CLOSED' | 'OPEN' | 'BLOCKED'; operations: number };
  effect: { mode: 'OFF' | 'PALE_FLAME' | 'PASSAGE'; expiresAt: number | null };
  residual: { id: string | null; source: string | null; nature: 'SEALED_RESIDUAL_ECHO'; quantity: 1;
    location: 'ENTRY_STAND' | 'FAR_STAND' | 'PLAYER'; ordinaryMetres: number; passageMetres: number;
    strength: number; container: 'CLOSED' | 'OPEN'; seal: 'ORIGINAL' | 'BROKEN' | 'RESEALED'; scorch: number; heatSeconds: number };
  material: { id: string | null; acquired: boolean; paidPennies: number; remaining: number };
}
export function createDeathConsulSiteState(): DeathConsulSiteState {
  return { id: 'DC2-CHAMBERS', lengthMetres: 6, ordinaryRouteMetres: 12, ordinaryExit: 'OPEN', elapsedSeconds: 0,
    sourceEra: null, introducedWeek: null, introducedDate: null, playerLocation: 'ENTRY', playerMetres: 0, playerPassageMetres: 0,
    operatorId: null, operatorName: null, operatorAge: null, operatorSource: null, operatorLocation: 'ENTRY', operatorMetres: 0,
    operatorPassageMetres: 0, operatorEnergy: 100, operatorConsent: 'UNASKED', operatorConsentWeek: null,
    door: { id: 'DC2-DOOR', location: 'DOOR', state: 'CLOSED', operations: 0 }, effect: { mode: 'OFF', expiresAt: null },
    residual: { id: null, source: null, nature: 'SEALED_RESIDUAL_ECHO', quantity: 1, location: 'ENTRY_STAND', ordinaryMetres: 0,
      passageMetres: 0, strength: 3, container: 'CLOSED', seal: 'ORIGINAL', scorch: 0, heatSeconds: 0 },
    material: { id: null, acquired: false, paidPennies: 0, remaining: 0 } };
}
/** Called only by the first recorded face-to-face observation. No old person or spirit is reused. */
export function introduceDeathConsulSite(site: DeathConsulSiteState, era: DeathConsulSourceEra, week: number, date: PublicGameDate): void {
  if (site.sourceEra !== null || !Number.isSafeInteger(week) || week < 1 || !isValidGameDate(date)) throw new Error('封存室的当面介绍不可重复。');
  const source = DEATH_CONSUL_SOURCES[era];
  site.sourceEra = era; site.introducedWeek = week; site.introducedDate = structuredClone(date);
  site.operatorId = source.operatorId; site.operatorName = source.operatorName; site.operatorAge = source.operatorAge; site.operatorSource = source.operatorSource;
  site.residual.id = source.residualId; site.residual.source = source.residualSource;
}
/** Expiry changes effects only. It cannot move people, reseal a jar, restore material or clear scorch. */
export function advanceDeathConsulTime(site: DeathConsulSiteState, seconds: number): void {
  if (!Number.isSafeInteger(seconds) || seconds < 0 || !Number.isSafeInteger(site.elapsedSeconds + seconds)) throw new Error('封存室经过时间无效。');
  site.elapsedSeconds += seconds; site.residual.heatSeconds = Math.max(0, site.residual.heatSeconds - seconds);
  if (site.effect.expiresAt !== null && site.elapsedSeconds >= site.effect.expiresAt) stopDeathConsulEffects(site);
}
export function stopDeathConsulEffects(site: DeathConsulSiteState): void { site.effect.mode = 'OFF'; site.effect.expiresAt = null; }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export const isDeathConsulLocation = (v: unknown): v is DeathConsulLocation => DEATH_CONSUL_LOCATIONS.includes(v as DeathConsulLocation);
/** Shape and finite stock checks; life and combat ordered replay establish every actual change. */
export function validateDeathConsulSiteState(v: unknown): v is DeathConsulSiteState {
  if (!record(v) || !shape(v, Object.keys(createDeathConsulSiteState())) || v.id !== 'DC2-CHAMBERS' || v.lengthMetres !== 6 || v.ordinaryRouteMetres !== 12 || v.ordinaryExit !== 'OPEN' || !integer(v.elapsedSeconds) ||
    !isDeathConsulLocation(v.playerLocation) || !integer(v.playerMetres) || !integer(v.playerPassageMetres) || !isDeathConsulLocation(v.operatorLocation) || !integer(v.operatorMetres) ||
    !integer(v.operatorPassageMetres) || !integer(v.operatorEnergy, 0, 100) || v.operatorEnergy % 2 !== 0 || !['UNASKED', 'GRANTED', 'DECLINED', 'WITHDRAWN', 'CLOSED'].includes(String(v.operatorConsent))) return false;
  if (v.operatorConsent === 'UNASKED' ? v.operatorConsentWeek !== null : !integer(v.operatorConsentWeek, 1)) return false;
  const d = v.door, e = v.effect, r = v.residual, m = v.material;
  if (!record(d) || !shape(d, ['id', 'location', 'state', 'operations']) || d.id !== 'DC2-DOOR' || d.location !== 'DOOR' || !['CLOSED', 'OPEN', 'BLOCKED'].includes(String(d.state)) || !integer(d.operations)) return false;
  if (!record(e) || !shape(e, ['mode', 'expiresAt']) || !['OFF', 'PALE_FLAME', 'PASSAGE'].includes(String(e.mode)) || (e.mode === 'OFF' ? e.expiresAt !== null : !integer(e.expiresAt, v.elapsedSeconds + 1, v.elapsedSeconds + 20))) return false;
  if (!record(r) || !shape(r, ['id', 'source', 'nature', 'quantity', 'location', 'ordinaryMetres', 'passageMetres', 'strength', 'container', 'seal', 'scorch', 'heatSeconds']) || r.nature !== 'SEALED_RESIDUAL_ECHO' || r.quantity !== 1 ||
    !['ENTRY_STAND', 'FAR_STAND', 'PLAYER'].includes(String(r.location)) || !integer(r.ordinaryMetres) || !integer(r.passageMetres) || !integer(r.strength, 1, 3) || !['CLOSED', 'OPEN'].includes(String(r.container)) ||
    !['ORIGINAL', 'BROKEN', 'RESEALED'].includes(String(r.seal)) || !integer(r.scorch, 0, 1) || !integer(r.heatSeconds, 0, 20) || r.strength !== 3 - r.scorch * 2 || r.scorch === 0 && r.heatSeconds !== 0 || r.container === 'OPEN' && r.seal !== 'BROKEN') return false;
  if (!record(m) || !shape(m, ['id', 'acquired', 'paidPennies', 'remaining']) || typeof m.acquired !== 'boolean' || !integer(m.remaining, 0, 1) || !integer(m.paidPennies)) return false;
  if (v.sourceEra === null) return stableStringify(v) === stableStringify(createDeathConsulSiteState());
  if (!['ORIGINAL', 'POST_CYCLE'].includes(String(v.sourceEra)) || !integer(v.introducedWeek, 1) || !isValidGameDate(v.introducedDate)) return false;
  const source = DEATH_CONSUL_SOURCES[v.sourceEra as DeathConsulSourceEra];
  if (v.operatorId !== source.operatorId || v.operatorName !== source.operatorName || v.operatorAge !== source.operatorAge || v.operatorSource !== source.operatorSource || r.id !== source.residualId || r.source !== source.residualSource) return false;
  if (m.acquired ? m.id !== source.materialId || m.paidPennies !== source.materialPrice : m.id !== null || m.paidPennies !== 0 || m.remaining !== 0) return false;
  return r.seal !== 'RESEALED' || m.acquired && m.remaining === 0;
}
