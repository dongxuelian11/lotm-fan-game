/** R217 isolated candidate. These are original finite scene rules, not a
 * canonical Death0 formula/ritual. They do not authorize source admission. */
import type { PublicGameDate } from '../../shared/contracts.js';
import { compareGameDates } from '../game-calendar.js';
import { DEATH_MATERIAL_POLICY, DEATH_MATERIAL_LOCATIONS } from './content.js';
import type { DeathLegacyAccess, DeathMaterialPolicy, DeathOriginalResolution, DeathSuccession } from './types.js';

export interface DeathMaterialRuntimePolicy extends DeathMaterialPolicy {
  operationSeconds: 1800; composeSeconds: 3600; stabilitySeconds: 3600;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
/** The parent authorized actual investigation/labour/handover time of 1800s,
 * composition/preparation 3600s and sealing 600s. The engine advances its one
 * frame clock; no second clock, extra travel AP or free week is created here. */
export const DEATH_RUNTIME_MATERIAL_POLICY: DeathMaterialRuntimePolicy = freeze({
  ...structuredClone(DEATH_MATERIAL_POLICY), operationSeconds: 1800,
  composeSeconds: 3600, stabilitySeconds: 3600,
});
export const DEATH_LEGACY_CUSTODIAN = freeze({
  id: 'DE0-S1-REMAINS-CUSTODIAN', role: '原服药支持室现任成年保管人',
  adult: true, location: DEATH_MATERIAL_LOCATIONS.originalRoom,
});
export const DEATH_WORKSHOP_CUSTODIAN = freeze({
  id: 'DE0-WORKSHOP-CUSTODIAN', role: '调配室现任成年保管人',
  adult: true, location: DEATH_MATERIAL_LOCATIONS.workshop,
});
export const DEATH_LEGACY_LABOUR = freeze({
  label: '核对这一原残余的封存号、原件标签与承接架，整理并交回同一保管档夹',
  actions: 1, credit: 8, cashGain: 0, repeatsPerOriginal: 0,
});
/** Creates only the chapter's explicitly authored current physical entities.
 * The old failed receipt is never rewritten and does not itself grant access.
 * Public remains stay UNLOCATED with null observations until actual inspection.
 * No departed historical person or old used container is reused as this scene. */
export function createDeathLegacySites(resolved: DeathOriginalResolution): DeathLegacyAccess[] {
  return resolved.characteristics.filter(item => item.holder === 'FAILED_REMAINS').map(item => {
    if (!Number.isSafeInteger(item.consumeRevision) || item.consumeRevision! < 1) {
      throw Error('原失败回执尚未核明，不能建立本章现时调查对象。');
    }
    return {
      originalBottleId: item.originalBottleId, latestBottleId: item.latestBottleId,
      characteristicId: item.id, consumeRevision: item.consumeRevision!,
      physicalId: `DE0-LEGACY:${item.originalBottleId}:${item.consumeRevision}`,
      sceneId: 'DE0-S1-ORIGINAL-ROOM', location: DEATH_MATERIAL_LOCATIONS.originalRoom,
      custodianId: DEATH_LEGACY_CUSTODIAN.id, custodianPresent: true,
      accessible: true, residualPresent: true, physicalVersion: 1,
      investigation: null, handover: null,
    };
  });
}
/** A dated authored record, never a claim that somebody just gave permission.
 * Caller separately observes archive records, current physical object/holder,
 * current vacancy, and the custodian's current response. */
export function deathSuccessionAt(date: PublicGameDate): DeathSuccession | null {
  const succession = DEATH_RUNTIME_MATERIAL_POLICY.succession;
  return compareGameDates(date, succession.transfer.date) < 0 ? null : structuredClone(succession);
}
export function deathSuccessionRecordIds(s: DeathSuccession): string[] {
  return [s.termination.eventId, s.separation.eventId, s.transfer.eventId,
    ...s.characteristicCustody.flatMap(item => [item.separation.eventId, item.transfer.eventId])];
}

/** Three independent present-day adults; none is Nora, the departed Vera or
 * the dead Alden. Authored initial willingness is not a permission receipt.
 * The private engine persists this finite scene alongside its full journal. */
export type DeathMaterialScene = import('./types.js').DeathMaterialScene;
export function createDeathMaterialScene(): DeathMaterialScene {
  return { version: 1,
    receivingTray: { id: 'DE0-WORKSHOP-RECEIVING-TRAY', location: DEATH_MATERIAL_LOCATIONS.workshop, present: true, accessible: true, conditionVersion: 1 },
    legacy: { custodianId: DEATH_LEGACY_CUSTODIAN.id, adult: true, location: DEATH_LEGACY_CUSTODIAN.location,
      custodianPresent: true, accessible: true, conditionVersion: 1, response: 'ALLOW' },
    uniqueness: { objectId: 'DE0-U1', seal: DEATH_RUNTIME_MATERIAL_POLICY.succession.seal, objectCount: 1,
      location: DEATH_MATERIAL_LOCATIONS.vault, custodianId: 'DE0-UNIQUENESS-CUSTODIAN', adult: true,
      custodianPresent: true, accessible: true, present: true, physicalVersion: 1, incumbentActorId: null,
      predecessorStillEmbodied: false, custodianEmbodied: false, response: 'ALLOW', permission: null },
    workshop: { custodianId: DEATH_WORKSHOP_CUSTODIAN.id, adult: true, location: DEATH_WORKSHOP_CUSTODIAN.location,
      custodianPresent: true, accessible: true, conditionVersion: 1, response: 'ALLOW', permission: null },
  };
}
/** Private engine calls only for the matching in-person ASK, or the explicit
 * in-person preparation command. An earlier refusal/withdrawal is preserved;
 * travelling, another week or another ASK cannot manufacture renewed consent.
 * Actual scene presence/access/version are checked by the caller and reducer. */
export function deathMaterialPermissionReply(
  response: 'ALLOW' | 'REFUSED' | 'WITHDRAWN', previous: import('./types.js').DeathPermission | null,
  host: Pick<import('./types.js').DeathMaterialHost, 'actorId' | 'eventId' | 'revision' | 'week' | 'location' | 'status'>,
  purpose: 'INVESTIGATE' | 'HANDOVER' | 'SERVICE', personId: string, location: string, conditionVersion: number,
): import('./types.js').DeathPermission {
  if (host.status !== 'ACTIVE' || host.location !== location || !personId || !host.actorId || !host.eventId ||
    !Number.isSafeInteger(conditionVersion) || conditionVersion < 1 || !Number.isSafeInteger(host.revision) || host.revision < 1 ||
    !Number.isSafeInteger(host.week) || host.week < 1) throw Error('本人或成年保管人尚未在当前现场，不能记录本次许可。');
  const status = previous && previous.status !== 'ALLOW' ? previous.status : response;
  return { personId, actorId: host.actorId, purpose, status, eventId: host.eventId, week: host.week,
    revision: host.revision, location, conditionVersion };
}
