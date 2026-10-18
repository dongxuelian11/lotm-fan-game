/** Original, bounded game content. This is not a reconstruction of the novel's
 * undisclosed auxiliary formula. These records never amend an older bottle,
 * source or acquisition journal. A route is a lead, not a possession grant. */
export const RED_PRIEST_SOURCE_SHA256 = '469a6ac77052f92ac0dbd8e6ea39164592de6b4c8d8ea0405b080c1a015f7973';
export const RED_PRIEST_SOURCE_CASE = 'conqueror-natural-187795';
export const RED_PRIEST_SOURCE_BOTTLES = ['conqueror-potion-1', 'conqueror-potion-2', 'conqueror-potion-3'] as const;
export const RED_PRIEST_CHARACTERISTIC_IDS: readonly string[] = Object.freeze(RED_PRIEST_SOURCE_BOTTLES.map(id => `${id}:characteristic`));
export const RED_PRIEST_UNIQUENESS_ID = 'red-priest-uniqueness:iron-crown-1126';
export const RED_PRIEST_MATERIAL_IDS: readonly string[] = Object.freeze([...RED_PRIEST_CHARACTERISTIC_IDS, RED_PRIEST_UNIQUENESS_ID]);
export const RED_PRIEST_MATERIAL_LOCATIONS = {
  archive: 'backlund:professional-handoff-archive',
  firstSeal: 'backlund:western-quarantine-vault',
  secondSeal: 'backlund:riverside-quarantine-vault',
  thirdSeal: 'backlund:southern-quarantine-vault',
  relicArchive: 'backlund:old-custody-archive',
  relicVault: 'backlund:iron-crown-sealed-vault',
  workshop: 'backlund:sealed-compounding-room',
} as const;
export const RED_PRIEST_PRIOR_CONSUMPTIONS = [
  { bottleId: RED_PRIEST_SOURCE_BOTTLES[0], week: 175, revision: 696, roll: 70, chance: 46, outcome: 'FAILURE' },
  { bottleId: RED_PRIEST_SOURCE_BOTTLES[1], week: 183, revision: 722, roll: 89, chance: 46, outcome: 'FAILURE' },
  { bottleId: RED_PRIEST_SOURCE_BOTTLES[2], week: 191, revision: 748, roll: 8, chance: 46, outcome: 'SUCCESS' },
] as const;
/** Newly authored supplier investigation. Only dated host receipts can establish
 * that these leads really locate the original sealed residue of that bottle. */
export const RED_PRIEST_SUPPLIER_LEADS = [
  { bottleId: RED_PRIEST_SOURCE_BOTTLES[0], itemId: RED_PRIEST_CHARACTERISTIC_IDS[0]!,
    leadId: 'supplier-disposition:conqueror-potion-1', archiveId: RED_PRIEST_MATERIAL_LOCATIONS.archive,
    locationId: RED_PRIEST_MATERIAL_LOCATIONS.firstSeal, containerId: 'supplier-seal:conqueror-potion-1:original-residue',
    custodianId: 'supplier:western-quarantine-keeper',
    title: '核查第一次服药排异后的供应方处置',
    detail: '先查交接处的处置线索，再亲赴隔离库核对原封容器、原瓶记录和污染残余。尚未完成核验、净化与交接的物件不属于你。' },
  { bottleId: RED_PRIEST_SOURCE_BOTTLES[1], itemId: RED_PRIEST_CHARACTERISTIC_IDS[1]!,
    leadId: 'supplier-disposition:conqueror-potion-2', archiveId: RED_PRIEST_MATERIAL_LOCATIONS.archive,
    locationId: RED_PRIEST_MATERIAL_LOCATIONS.secondSeal, containerId: 'supplier-seal:conqueror-potion-2:original-residue',
    custodianId: 'supplier:riverside-quarantine-keeper',
    title: '核查第二次服药排异后的供应方处置',
    detail: '沿第二瓶自己的处置线索调查河岸隔离库。另一瓶的封签、检查或交接不能代替这份原件。' },
  { bottleId: RED_PRIEST_SOURCE_BOTTLES[2], itemId: RED_PRIEST_CHARACTERISTIC_IDS[2]!,
    leadId: 'supplier-disposition:conqueror-potion-3', archiveId: RED_PRIEST_MATERIAL_LOCATIONS.archive,
    locationId: RED_PRIEST_MATERIAL_LOCATIONS.thirdSeal, containerId: 'supplier-seal:conqueror-potion-3:original-residue',
    custodianId: 'supplier:southern-quarantine-keeper', title: '核查第三瓶实际排异后的供应方处置',
    detail: '只在第三瓶确有失败服药记录时追查其原封残余。若它已融合于本人或仍未服用，不会出现这条残余领取路线。' },
] as const;
export interface RedPriestRelicCustody {
  id: string; previousId: string | null; itemId: string; containerId: string;
  fromCustodianId: string | null; toCustodianId: string; locationId: string; year: number;
}
/** One ancient original, independently sealed. This chain is original fiction,
 * not a claim about a canonical incumbent. The host must verify it in its world
 * history and reject an existing simultaneous incumbent or another uniqueness. */
export const RED_PRIEST_RELIC_CUSTODY: readonly RedPriestRelicCustody[] = [
  { id: 'iron-crown:1126:sealing', previousId: null, itemId: RED_PRIEST_UNIQUENESS_ID,
    containerId: 'iron-crown:original-reliquary', fromCustodianId: null, toCustodianId: 'ancient:sealed-relic-wardens',
    locationId: 'ancient:iron-reliquary', year: 1126 },
  { id: 'iron-crown:1298:archive-transfer', previousId: 'iron-crown:1126:sealing', itemId: RED_PRIEST_UNIQUENESS_ID,
    containerId: 'iron-crown:original-reliquary', fromCustodianId: 'ancient:sealed-relic-wardens', toCustodianId: 'backlund:relic-archive-wardens',
    locationId: RED_PRIEST_MATERIAL_LOCATIONS.relicVault, year: 1298 },
  { id: 'iron-crown:1352:keeper-transfer', previousId: 'iron-crown:1298:archive-transfer', itemId: RED_PRIEST_UNIQUENESS_ID,
    containerId: 'iron-crown:original-reliquary', fromCustodianId: 'backlund:relic-archive-wardens', toCustodianId: 'backlund:iron-crown-keeper',
    locationId: RED_PRIEST_MATERIAL_LOCATIONS.relicVault, year: 1352 },
];
export interface RedPriestMaterialCost { cash: number; actions: number; spirituality: number }
export const RED_PRIEST_MATERIAL_COSTS = {
  TRACE_DISPOSITION: { cash: 30, actions: 1, spirituality: 0 },
  VERIFY_CONTAINER: { cash: 40, actions: 1, spirituality: 0 },
  PURIFY_REMAINS: { cash: 70, actions: 1, spirituality: 6 },
  TRANSFER_CUSTODY: { cash: 20, actions: 1, spirituality: 0 },
  INSPECT_RELIC: { cash: 40, actions: 1, spirituality: 0 },
  VERIFY_RELIC: { cash: 50, actions: 1, spirituality: 0 },
  TRANSFER_RELIC: { cash: 80, actions: 1, spirituality: 0 },
  PREPARE_COMPOUND: { cash: 120, actions: 1, spirituality: 8 },
} satisfies Record<string, RedPriestMaterialCost>;
export const RED_PRIEST_COMPOUND_INPUT_ROLES = ['CARRIER_FLUID', 'ISOLATION_MATERIAL', 'EMPTY_BOTTLE'] as const;
export interface RedPriestCompoundInput { id: string; role: typeof RED_PRIEST_COMPOUND_INPUT_ROLES[number] }
/** Three finite ordinary packs, never a fourth extraordinary characteristic.
 * Actual stock, payment and handoff must be verified by the host. More supplies
 * require a separately implemented world delivery, not an infinite work loop. */
export function redPriestCompoundSupply(ordinal: number, checkpointWeek = 200) {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 3) return null;
  const batchId = `red-priest:ordinary-compound-pack:${ordinal}`;
  return { batchId, providerId: 'backlund:sealed-workshop-supplier', availableWeek: checkpointWeek + ordinal - 1,
    inputs: RED_PRIEST_COMPOUND_INPUT_ROLES.map(role => ({ id: `${batchId}:${role}`, role })) };
}
