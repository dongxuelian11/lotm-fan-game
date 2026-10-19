/** Private 208 candidate. Authored future fiction; never imports or mutates live 207. */
export const FATE_CONTENT_VERSION = 'f208-original-canal-v1' as const;
export const FATE_RULES = Object.freeze({
  sourceActivationLeadSeconds: 30,
  thirdBellAfterDepartureSeconds: 180,
  contribution: 40,
  structuralFailureAt: 35,
  graftCapacity: 45,
  graftSpirituality: 8,
  graftMental: 2,
  graftFailureMental: 4,
  graftKnowledgeDifficulty: 20,
  graftSeconds: 5,
  graftLifetimeSeconds: 30,
  graftDistanceMetres: 6,
  inspectSeconds: 20,
  prepareSeconds: 30,
  mainTransitSeconds: 40,
  sideTransitSeconds: 55,
  rescueSeconds: 20,
  retreatSeconds: 20,
  arrivalSeconds: 25,
  inspectionKitPennies: 4,
  preparationKitPennies: 12,
  recoveryInvestigationPennies: 18,
} as const);

/** The entire bounded pursuit table exists before any player choice. */
export const FATE_PURSUIT_TABLE = Object.freeze([
  { branch: 'SHIELD_MAIN', implementation: 'SADDLE_INTERNAL_LOAD', ordinaryBenefit: 'shield-prevents-spray-damage' },
  { branch: 'SIDE_CHANNEL', implementation: 'ORIGINAL_SADDLE_FOLLOWS_BOAT', ordinaryBenefit: 'quieter-water-longer-travel' },
  { branch: 'HOLD_OR_MOVE', implementation: 'EXISTING_INBOARD_TETHER_FOLLOWS_ORIGINAL_CRATE', ordinaryBenefit: 'stationary-boat-easier-rescue' },
] as const);
export type FateProbeBranch = typeof FATE_PURSUIT_TABLE[number]['branch'];

/** These are finite authored commercial commissions, not spawn templates. */
export const FATE_COMMISSIONS = Object.freeze([
  { id: 'F208-COMMISSION-1', boat: 'F208-BOAT-1', crate: 'F208-CRATE-1', owner: 'F208-OWNER-1', binding: 'F208-BINDING-1', saddle: 'F208-DOOM-SADDLE-1', well: 'F208-RELIEF-WELL-1', label: '第三钟的原箱', cargo: '陶制测量器', commissionSource: 'F208-PREEXISTING-COMMERCIAL-REGISTER-1' },
  { id: 'F208-COMMISSION-2', boat: 'F208-BOAT-2', crate: 'F208-CRATE-2', owner: 'F208-OWNER-2', binding: 'F208-BINDING-2', saddle: 'F208-DOOM-SADDLE-2', well: 'F208-RELIEF-WELL-2', label: '北闸的未交货单', cargo: '封存玻璃量具', commissionSource: 'F208-PREEXISTING-COMMERCIAL-REGISTER-2' },
  { id: 'F208-COMMISSION-3', boat: 'F208-BOAT-3', crate: 'F208-CRATE-3', owner: 'F208-OWNER-3', binding: 'F208-BINDING-3', saddle: 'F208-DOOM-SADDLE-3', well: 'F208-RELIEF-WELL-3', label: '石堤前的商运委托', cargo: '铜制校准件', commissionSource: 'F208-PREEXISTING-COMMERCIAL-REGISTER-3' },
] as const);
export type FateCommissionId = typeof FATE_COMMISSIONS[number]['id'];

/**
 * Objective fictional source: a surviving, bounded endpoint-lock of a former
 * high-order disaster relic. Its occurrence record is imported from the host's
 * world history BEFORE this scene, never created by inspecting or by an NPC.
 * The relic fixes this original commercial cargo's breakage at its recorded
 * bell. A persistent, finite inboard tether enforces the three authored paths.
 * The player redirects one already-active physical effect, not abstract fate.
 */
export const FATE_ORIGIN = Object.freeze({
  artifactId: 'F208-RELIC-SEVERED-KEEL',
  mechanism: 'PREEXISTING_HIGH_ORDER_ENDPOINT_LOCK',
  chainVersion: 'F208-THREE-PURSUITS-V1',
  endpoint: 'ORIGINAL_BOAT_CRATE_STRUCTURE',
  provenanceKind: 'HIGH_ORDER_RELIC_OCCURRENCE',
} as const);
