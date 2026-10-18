import type { PublicGameDate } from '../../shared/contracts.js';
import { compareGameDates } from '../game-calendar.js';

/** Original, finite future branch only. None of these sentences establish the
 * canonical S0 recipe or retroactively terminate a canonical incumbent. */
export const DARKNESS_MATERIAL_LOCATIONS = {
  supplier: '贝克兰德原房间旁交接处', originalRoom: '贝克兰德原房间旁交接处',
  archive: '长夜保管档案室', vault: '长夜封存室', workshop: '长夜调配室',
} as const;
export const DARKNESS_CHARACTERISTIC_BOTTLES = ['misfortune-knight-potion-1', 'misfortune-knight-potion-2', 'misfortune-knight-potion-3'] as const;
export const DARKNESS_LABOUR_TASKS = ['SEAL_REGISTER', 'CRATE_AUDIT', 'SUPPLY_LIST', 'TRANSIT_RECEIPT', 'DELIVERY_REVIEW'] as const;
export const DARKNESS_CARRIER_BATCHES = [
  { id: 'darkness-carrier-1', label: '一号普通承载包', price: 360 },
  { id: 'darkness-carrier-2', label: '二号普通承载包', price: 390 },
  { id: 'darkness-carrier-3', label: '三号普通承载包', price: 420 },
] as const;
export const DARKNESS_UNIQUENESS_ID = 'DN0-UNIQUENESS-1';
export const DARKNESS_UNIQUENESS_SEAL = 'DN0-ONE-ORIGINAL-SEAL';
export const DARKNESS_LEGACY_SITE_ID = 'BACKLUND_ORIGINAL_ROOM_HANDOVER';
export const DARKNESS_GUIDE_ID = 'darkness-guide:celine';
export const DARKNESS_FUTURE_BRANCH = {
  id: 'darkness-original-future-1353', predecessorId: 'darkness-future-predecessor:vera-nox', predecessorName: '薇拉·诺克斯',
  custodianId: 'darkness-custodian:lucia-veil', custodianName: '露西娅·维尔',
  terminationDate: { epoch: 'FIFTH_EPOCH', year: 1353, month: 1, day: 8 },
  transferDate: { epoch: 'FIFTH_EPOCH', year: 1353, month: 1, day: 9 },
  terminationEventId: 'DN0-TERMINATION-1353-0108', separationEventId: 'DN0-SEPARATION-1353-0108', transferEventId: 'DN0-CUSTODY-1353-0109',
  story: '保管档案记载，实际容纳同一黑暗唯一性的薇拉·诺克斯于1353年1月8日在长夜旧塔倒塌时死亡；现场确认其原身体死亡、容纳终止，同一原件从遗体析出。次日由成年见证人在场，交予从未容纳的露西娅·维尔封存。原封签与两次交接记录仍在，露西娅只保管这同一原件，没有容纳它。',
} as const;
export interface DarknessSuccessionFacts {
  branchId: string; uniquenessId: string; seal: string; objectCount: number;
  predecessorActorId: string; predecessorStillEmbodied: boolean;
  termination: { id: string; date: PublicGameDate; cause: 'ACTUAL_DEATH' } | null;
  separation: { id: string; date: PublicGameDate; objectId: string } | null;
  transfer: { id: string; date: PublicGameDate; objectId: string; toActorId: string; custodyOnly: true } | null;
  incumbentActorId: string | null; custodianActorId: string | null; location: string | null; deliveryAllowed: boolean;
}
/** The enclosing private original-branch world may use this authored dated
 * event, after its real clock reaches the transfer. Never accept this object
 * from a public command, imported certificate or projection. */
export function darknessSuccessionAt(date: PublicGameDate): DarknessSuccessionFacts | null {
  const b = DARKNESS_FUTURE_BRANCH;
  if (compareGameDates(date, b.transferDate) < 0) return null;
  return { branchId: b.id, uniquenessId: DARKNESS_UNIQUENESS_ID, seal: DARKNESS_UNIQUENESS_SEAL, objectCount: 1,
    predecessorActorId: b.predecessorId, predecessorStillEmbodied: false,
    termination: { id: b.terminationEventId, date: { ...b.terminationDate }, cause: 'ACTUAL_DEATH' },
    separation: { id: b.separationEventId, date: { ...b.terminationDate }, objectId: DARKNESS_UNIQUENESS_ID },
    transfer: { id: b.transferEventId, date: { ...b.transferDate }, objectId: DARKNESS_UNIQUENESS_ID, toActorId: b.custodianId, custodyOnly: true },
    incumbentActorId: null, custodianActorId: b.custodianId, location: DARKNESS_MATERIAL_LOCATIONS.vault, deliveryAllowed: true };
}
export const DARKNESS_PROMOTION_ABILITY_IDS = ['darkness.s0.short-concealment', 'darkness.s0.bounded-misfortune-diversion'] as const;
export const DARKNESS_CONSUMPTION = { difficulty: 61, bonus: 40, actions: 1, spirituality: 30, successMind: 12,
  failureHealth: 45, failureMind: 40, failurePollution: 35, greatFailureHealth: 110, greatFailureMind: 100, greatFailurePollution: 70 } as const;
export const DARKNESS_STABILITY = { actions: 1, cash: 100, spirituality: 12, mind: 8, seconds: 3600, validSeconds: 604800 } as const;
