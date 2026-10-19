/** One finite physical gallery, shared by all life cases and the optional encounter. */
export const LIGHT_SEEKER_LOCATIONS = ['ENTRY', 'NEAR', 'SCREEN', 'OTHER', 'FAR', 'SIDE'] as const;
export type LightSeekerLocation = typeof LIGHT_SEEKER_LOCATIONS[number];
export type LightSeekerConsent = 'UNASKED' | 'GRANTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';
export const LIGHT_SEEKER_POSITION_METRES: Readonly<Record<LightSeekerLocation, number>> = {
  ENTRY: 0, NEAR: 2, SCREEN: 3, OTHER: 4, FAR: 6, SIDE: 9,
};
export interface LightSeekerSiteState {
  id: 'LS2-GALLERY'; lengthMetres: 6; ordinaryExit: 'OPEN'; elapsedSeconds: number;
  playerLocation: LightSeekerLocation; playerMetres: number;
  operatorId: 'LS2-MARA'; operatorName: '玛拉'; operatorAge: 46;
  operatorLocation: LightSeekerLocation; operatorMetres: number; operatorEnergy: number;
  operatorConsent: LightSeekerConsent; operatorConsentWeek: number | null;
  spiritId: 'LS2-REED'; spiritName: '芦影';
  spiritLocation: 'ENTRY' | 'SIDE'; spiritMetres: number; spiritEnergy: number;
  spiritConsent: LightSeekerConsent; spiritConsentWeek: number | null;
  shutter: { id: 'LS2-SHUTTER'; location: 'SCREEN'; state: 'CLOSED' | 'OPEN' | 'BROKEN'; durability: number; operations: number };
  lamp: { id: 'LS2-LAMP'; oil: number };
  cover: { id: 'LS2-COVER'; position: 'OWNER_STAND' | 'SCREEN'; durability: number };
  screen: { id: 'LS2-SCREEN'; location: 'SCREEN'; durability: number; inspections: number };
  light: { mode: 'OFF' | 'PLAIN' | 'GUIDED' | 'LIMITED'; expiresAt: number | null };
  board: { id: 'LS2-MARK'; inscription: 'NORTH_ARCH'; location: 'FAR_STAND' | 'PLAYER'; owner: 'LS2-MARA' | 'PLAYER'; read: boolean };
}
export function createLightSeekerSiteState(): LightSeekerSiteState {
  return {
    id: 'LS2-GALLERY', lengthMetres: 6, ordinaryExit: 'OPEN', elapsedSeconds: 0,
    playerLocation: 'ENTRY', playerMetres: 0,
    operatorId: 'LS2-MARA', operatorName: '玛拉', operatorAge: 46,
    operatorLocation: 'ENTRY', operatorMetres: 0, operatorEnergy: 100, operatorConsent: 'UNASKED', operatorConsentWeek: null,
    spiritId: 'LS2-REED', spiritName: '芦影', spiritLocation: 'SIDE', spiritMetres: 0, spiritEnergy: 100, spiritConsent: 'UNASKED', spiritConsentWeek: null,
    shutter: { id: 'LS2-SHUTTER', location: 'SCREEN', state: 'CLOSED', durability: 100, operations: 0 },
    lamp: { id: 'LS2-LAMP', oil: 3 },
    cover: { id: 'LS2-COVER', position: 'OWNER_STAND', durability: 100 },
    screen: { id: 'LS2-SCREEN', location: 'SCREEN', durability: 100, inspections: 0 },
    light: { mode: 'OFF', expiresAt: null },
    board: { id: 'LS2-MARK', inscription: 'NORTH_ARCH', location: 'FAR_STAND', owner: 'LS2-MARA', read: false },
  };
}
/** A limited-light window wraps the already paid, same-visit plain light.
 * Its expiry ends the limiting effect, not that light. Only STOP extinguishes it.
 * Neither kind of expiry moves people, returns objects or closes the physical shutter. */
export function advanceLightSeekerTime(site: LightSeekerSiteState, seconds: number): void {
  if (!Number.isSafeInteger(seconds) || seconds < 0 || !Number.isSafeInteger(site.elapsedSeconds + seconds)) throw new Error('采光廊经过时间无效。');
  site.elapsedSeconds += seconds;
  if (site.light.expiresAt !== null && site.elapsedSeconds >= site.light.expiresAt) {
    site.light.mode = site.light.mode === 'LIMITED' ? 'PLAIN' : 'OFF';
    site.light.expiresAt = null;
  }
}
export function stopLightSeekerLight(site: LightSeekerSiteState): void {
  site.light.mode = 'OFF'; site.light.expiresAt = null;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const isLocation = (v: unknown): v is LightSeekerLocation => LIGHT_SEEKER_LOCATIONS.includes(v as LightSeekerLocation);
function consentValid(consent: unknown, week: unknown): boolean {
  if (!['UNASKED', 'GRANTED', 'DECLINED', 'WITHDRAWN', 'CLOSED'].includes(String(consent))) return false;
  if (consent === 'UNASKED') return week === null;
  return integer(week, 1);
}
/** Shape, identities and conserved stocks. Ordered life/combat replay proves actual provenance. */
export function validateLightSeekerSiteState(v: unknown): v is LightSeekerSiteState {
  if (!record(v) || !shape(v, [
    'id', 'lengthMetres', 'ordinaryExit', 'elapsedSeconds', 'playerLocation', 'playerMetres',
    'operatorId', 'operatorName', 'operatorAge', 'operatorLocation', 'operatorMetres', 'operatorEnergy', 'operatorConsent', 'operatorConsentWeek',
    'spiritId', 'spiritName', 'spiritLocation', 'spiritMetres', 'spiritEnergy', 'spiritConsent', 'spiritConsentWeek',
    'shutter', 'lamp', 'cover', 'screen', 'light', 'board',
  ]) || v.id !== 'LS2-GALLERY' || v.lengthMetres !== 6 || v.ordinaryExit !== 'OPEN' || !integer(v.elapsedSeconds) || !isLocation(v.playerLocation) || !integer(v.playerMetres)) return false;
  if (v.operatorId !== 'LS2-MARA' || v.operatorName !== '玛拉' || v.operatorAge !== 46 || !isLocation(v.operatorLocation) ||
      !integer(v.operatorMetres) || !integer(v.operatorEnergy, 0, 100) || v.operatorEnergy % 2 !== 0 || !consentValid(v.operatorConsent, v.operatorConsentWeek)) return false;
  const operatorTrips = (100 - v.operatorEnergy) / 2;
  if (v.operatorMetres % 3 !== 0 || v.operatorMetres < operatorTrips * 3 || v.operatorMetres > operatorTrips * 9 ||
      operatorTrips === 0 && (v.operatorMetres !== 0 || v.operatorLocation !== 'ENTRY')) return false;
  if (v.spiritId !== 'LS2-REED' || v.spiritName !== '芦影' || !['ENTRY', 'SIDE'].includes(String(v.spiritLocation)) ||
      !integer(v.spiritMetres) || v.spiritMetres % 9 !== 0 || !integer(v.spiritEnergy, 0, 100) || v.spiritEnergy !== 100 - v.spiritMetres / 9 * 2 ||
      !consentValid(v.spiritConsent, v.spiritConsentWeek) || (v.spiritLocation === 'SIDE') !== (v.spiritMetres / 9 % 2 === 0)) return false;
  const { shutter, lamp, cover, screen, light, board } = v;
  if (!record(shutter) || !shape(shutter, ['id', 'location', 'state', 'durability', 'operations']) || shutter.id !== 'LS2-SHUTTER' || shutter.location !== 'SCREEN' ||
      !['CLOSED', 'OPEN', 'BROKEN'].includes(String(shutter.state)) || !integer(shutter.durability, 0, 100) || !integer(shutter.operations, 0, 100) || shutter.durability !== 100 - shutter.operations ||
      (shutter.state === 'BROKEN') !== (shutter.durability === 0)) return false;
  if (!record(lamp) || !shape(lamp, ['id', 'oil']) || lamp.id !== 'LS2-LAMP' || !integer(lamp.oil, 0, 3)) return false;
  if (!record(cover) || !shape(cover, ['id', 'position', 'durability']) || cover.id !== 'LS2-COVER' || !['OWNER_STAND', 'SCREEN'].includes(String(cover.position)) || cover.durability !== 100) return false;
  if (!record(screen) || !shape(screen, ['id', 'location', 'durability', 'inspections']) || screen.id !== 'LS2-SCREEN' || screen.location !== 'SCREEN' ||
      !integer(screen.durability, 0, 100) || !integer(screen.inspections, 0, 100) || screen.durability !== 100 - screen.inspections) return false;
  if (!record(light) || !shape(light, ['mode', 'expiresAt']) || !['OFF', 'PLAIN', 'GUIDED', 'LIMITED'].includes(String(light.mode))) return false;
  if (light.mode === 'OFF' || light.mode === 'PLAIN') { if (light.expiresAt !== null) return false; }
  else if (!integer(light.expiresAt, v.elapsedSeconds + 1, v.elapsedSeconds + 20)) return false;
  return record(board) && shape(board, ['id', 'inscription', 'location', 'owner', 'read']) && board.id === 'LS2-MARK' && board.inscription === 'NORTH_ARCH' &&
    ['FAR_STAND', 'PLAYER'].includes(String(board.location)) && ['LS2-MARA', 'PLAYER'].includes(String(board.owner)) &&
    (board.location === 'PLAYER') === (board.owner === 'PLAYER') && typeof board.read === 'boolean';
}
