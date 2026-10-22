import type { PublicCheckResult } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { HermitSource, HermitBudget, HermitFinance } from './source.js';
import type { HermitCandidateCommand, HermitPosition, HermitArchivist, HermitRecovery, HermitReading, HermitWindow, HermitCustody } from './content.js';
export { HERMIT_ORIGINAL_IDS, HERMIT_ABILITY_IDS } from './content.js';
export type { HermitOriginalId, HermitPosition, HermitArchivistId, HermitSegmentId, HermitConsent } from './content.js';
export type HermitCommand = HermitCandidateCommand
  | { type: 'TRAVEL'; to: string }
  | { type: 'RETURN_ON_FOOT' | 'APPROACH' | 'REST_OUTSIDE' | 'START_PRACTICE' | 'WAIT_10' | 'INSPECT_SIDE_PATH' | 'INSPECT_SLIT' | 'BLOCK_SLIT' | 'AFFIX_SEAL' | 'CLOSE_CONTACT' | 'PAUSE_SHIFT' };
export interface HermitFrame {
 budget: HermitBudget; finance: HermitFinance; random: SliceState['random']; location: string; nowSecond: number; weekAnchor: number;
}
export interface HermitScene {
 phase: 'PREPARATION' | 'PRACTICE'; status: 'ACTIVE' | 'ABORTED' | 'COMPLETED';
 playerPosition: HermitPosition; playerEnergy: number; playerTravelMetres: number; body: 'SOLID' | 'INFORMATION';
 owner: { id: 'PM3-IRIS'; name: string; age: number; alive: boolean; position: HermitPosition; energy: number; travelMetres: number; consent: 'UNASKED' | 'GRANTED' | 'WITHDRAWN' | 'CLOSED'; permissionVersion: number; permissionEventId: string | null; permissionWeek: number | null };
 workers: HermitArchivist[]; custody: HermitCustody;
 segments: Record<'A' | 'B', { inspectedEventId: string | null; open: boolean }>;
 sidePathEventId: string | null; slit: { inspectedEventId: string | null; connected: boolean; open: boolean; origin: 'MIDPOINT'; destination: 'DESTINATION'; metres: 3 };
 shutter: 'OPEN' | 'JAMMED' | 'CLEARED'; shutterEventId: string | null;
 recordVersion: number; moveLine: string | null; annotationEventId: string | null; reading: HermitReading | null;
 contact: boolean; window: HermitWindow | null; formMoved: boolean;
 seals: { id: string; status: 'BLANK' | 'WRITTEN' | 'APPLIED' | 'SPENT'; content: string | null; boughtEventId: string; writtenEventId: string | null; appliedEventId: string | null; recordVersion: number | null }[];
 moves: { eventId: string; actorId: string; from: HermitPosition; to: HermitPosition; metres: number; carriedRecord: boolean; mode: 'WALK' | 'INFORMATION' }[];
 receipts: { eventId: string; kind: string; actorId: string; position: HermitPosition; recordVersion: number }[];
 reportEventId: string | null; preparationReportEventId: string | null; returnReportEventId: string | null;
 informationCompleted: boolean; transferCompleted: boolean; manualCopyCompleted: boolean;
}
export interface HermitCompound {
 id: string; carrierId: string; status: 'PREPARED' | 'SUCCESS' | 'FAILED_EXPOSED' | 'FAILED_SEALED' | 'RECOVERED' | 'DEATH_REMAINS';
 location: string; originalIds: string[]; embodiedOriginalId: string; uniquenessId: 'HM222-UNIQUENESS';
 preparedEventId: string; consumedEventId: string | null; sealedEventId: string | null; sealedWeek: number | null; sealedSecond: number | null; recoveredEventId: string | null;
}
export interface HermitMaterials {
 originals: (Omit<HermitRecovery, 'holder'> & { holder: HermitRecovery['holder'] | 'SUPPLIER'; latestBottleId: string; location: string | null; compoundId: string | null; permissionWeek: number | null; sealedSecond: number | null })[];
 uniqueness: { id: 'HM222-UNIQUENESS'; holder: 'CUSTODIAN' | 'PLAYER' | 'COMPOUND' | 'EXPOSED' | 'SEALED' | 'FUSED' | 'DEATH_REMAINS'; verifiedEventId: string | null; acquiredEventId: string | null; location: string; compoundId: string | null };
 carriers: { id: string; status: 'SUPPLIER' | 'PLAYER' | 'SPENT'; boughtEventId: string | null }[];
 compounds: HermitCompound[];
}
export interface HermitPreparation {
 id: string; compoundId: string; actorId: string; sourceDigest: string; compoundDigest: string; passageEventId: string; location: string;
 preparedSecond: number; expiresSecond: number; status: 'READY' | 'SPENT' | 'INVALIDATED'; spentEventId: string | null;
}
export interface HermitEvent {
 id: string; revision: number; command: HermitCommand; before: HermitFrame; after: HermitFrame;
 randomReceipts: { id: string; check: PublicCheckResult; cursorBefore: number; cursorAfter: number }[];
 financeReceipts: { title: string; text: string }[]; notes: string[]; beforeDigest: string; afterDigest: string;
}
export interface HermitState {
 version: 1; guidanceKnown: boolean; source: HermitSource | null; frame: HermitFrame | null;
 promotionWeek: number | null; scene: HermitScene | null; materials: HermitMaterials | null;
 journal: HermitEvent[]; promotionStability: { preparations: HermitPreparation[] };
}
export interface HermitAction { id: string; label: string; cost: string; command: HermitCommand; enabled: boolean; reason: string | null; preferredAction?: boolean }
export interface HermitProjection {
 title: string; guidanceKnown: boolean; promoted: boolean; story: string; nextStep: string; risk: string;
 resources: { health: number; maxHealth: number; mind: number; maxMind: number; spirituality: number; maxSpirituality: number; cash: string; actionsRemaining: number; weeklyBudget: number };
 injuries: { id: string; severity: 'LIGHT' | 'HEAVY'; treated: boolean }[]; injuryRisk: number;
 abilities: { id: string; label: string; description: string; mastery: number }[];
 actions: HermitAction[]; sections: { id: string; title: string; lines: string[] }[]; insideCase: boolean;
}
export interface HermitSceneHost {
 eventId: string; revision: number; week: number; second: number; sequence: 1 | 0;
 actions: number; cash: number; health: number; mind: number; spirituality: number;
}
export interface HermitEffect { actions: number; cash: number; spirituality: number; mind: number; seconds: number; mastery?: string[] }
