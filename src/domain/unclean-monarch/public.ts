import { CRIMINAL_ABILITY_IDS } from '../criminal/types.js';
import { UNWINGED_ABILITY_IDS } from '../unwinged/types.js';
import { SERIAL_KILLER_ABILITY_IDS } from '../serial-killer/types.js';
import { DEMON_ABILITY_IDS } from '../demon/types.js';
import { DESIRE_APOSTLE_ABILITY_IDS } from '../desire-apostle/types.js';
import { DEVIL_ABILITY_IDS } from '../devil/types.js';
import { BLATHERER_ABILITY_IDS } from '../blatherer/types.js';
import { BLOOD_DUKE_ABILITY_IDS } from '../blood-duke/types.js';
import { UNCLEAN_MONARCH_ABILITY_IDS } from '../unclean-monarch/types.js';
import { publicPryerFields as fields, publicPryerInjury } from '../sage/life.js';
import { publicAbyssOperation, publicAbyssOriginalSite } from '../blood-duke/public.js';
import type { UncleanMonarchOriginals } from './types.js';
import type { UncleanMonarchCombatPiece, UncleanMonarchEncounterBudget, UncleanMonarchFinanceSnapshot, UncleanMonarchForceReceipt, UncleanMonarchPlate } from './encounter.js';
export { publicAbyssOperation, publicAbyssOriginalSite };
const masteryIds = [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS, ...DEMON_ABILITY_IDS, ...DESIRE_APOSTLE_ABILITY_IDS, ...DEVIL_ABILITY_IDS, ...BLATHERER_ABILITY_IDS, ...BLOOD_DUKE_ABILITY_IDS, ...UNCLEAN_MONARCH_ABILITY_IDS];
export const publicUncleanMonarchMastery = (mastery: Record<string, number>): Record<string, number> => Object.fromEntries(masteryIds.filter(id => Object.hasOwn(mastery, id)).map(id => [id, mastery[id]!]));
export function publicUncleanMonarchBudget(b: UncleanMonarchEncounterBudget): UncleanMonarchEncounterBudget { return {
  ...fields(b, ['cash', 'actions', 'health', 'mind', 'spirituality', 'pollution', 'gender', 'sequence', 'acting', 'injuryRisk']),
  coreStats: fields(b.coreStats, ['physique', 'perception', 'will', 'knowledge']),
  mastery: publicUncleanMonarchMastery(b.mastery),
  completedSources: [...b.completedSources], injuries: b.injuries.map(publicPryerInjury),
}; }
export function publicUncleanMonarchFinance(f: UncleanMonarchFinanceSnapshot): UncleanMonarchFinanceSnapshot { return {
  ...fields(f, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'missedWeeks', 'credit']),
  debts: f.debts.map(d => fields(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek'])),
}; }
export function publicUncleanMonarchOriginals(o: UncleanMonarchOriginals): UncleanMonarchOriginals { return { site: publicAbyssOriginalSite(o.site), operation: publicAbyssOperation(o.operation), strain: o.strain }; }
export const publicUncleanMonarchPiece = (p: UncleanMonarchCombatPiece): UncleanMonarchCombatPiece => fields(p, ['id', 'ownerId', 'location', 'quantity', 'initialCharges', 'charges', 'wear', 'paidPennies']);
export const publicUncleanMonarchPlate = (p: UncleanMonarchPlate): UncleanMonarchPlate => fields(p, ['id', 'ownerId', 'status', 'usedRound', 'usedOrder']);
export const publicUncleanMonarchForceReceipt = (r: UncleanMonarchForceReceipt): UncleanMonarchForceReceipt => fields(r, ['id', 'targetId', 'power', 'kind', 'plateId', 'paidCost', 'round', 'order', 'atSeconds', 'position', 'visible', 'conditionVersion']);
