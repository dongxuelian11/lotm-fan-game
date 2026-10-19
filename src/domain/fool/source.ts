import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { validateAttendantMysteriesState, hasAttendantMysteriesLock } from '../attendant-mysteries/index.js';
import { snapshotFoolS1Source, foolS1SnapshotDigest, type FoolMaterialsOrigin } from './materials.js';
import { cargoWeight } from '../attendant-mysteries/town.js';
import type { FogHostFacts } from './fog.js';
import { foolUniquenessCustody, foolWorldDigest } from './world.js';

const hash = (value: unknown) => sha256Hex(stableStringify(value));
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export const FOOL_FROZEN_SOURCE_KEYS = ['clown', 'magician', 'faceless', 'marionettist', 'bizarroSorcerer', 'ancientScholar', 'miracleWorker', 'attendantMysteries', 'longChapter'] as const;
export type FoolSourceFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface FoolBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number; spirituality: number;
  pollution: number; injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status'];
  sequence: 1 | 0; acting: number; mastery: Record<string, number>; coreStats: SliceState['character']['coreStats'];
  completedSources: string[];
}
export interface FoolSource {
  runId: string; actorId: string; revision: number; budget: FoolBudget; finance: FoolSourceFinance;
  character: SliceState['character']; random: SliceState['random']; sourceHistoryDigest: string;
  town: Pick<FogHostFacts, 'townEpoch' | 'townRegionId' | 'townPlot' | 'townResidents' | 'externalLiveWormIds' | 'cart'>;
  emergencyWorkUsed: boolean; combatHistoryLength: number; combatHistoryDigest: string; materialsOrigin: FoolMaterialsOrigin; worldDigest: string;
}
export const foolBudget = (s: SliceState): FoolBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting, mastery: { ...s.progression.mastery },
  coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export function foolFrozenSourceDigest(s: SliceState): string {
  return hash({ roots: Object.fromEntries(FOOL_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])),
    seerOriginals: { practice: s.seer.practice, discovered: s.seer.discovered, formulaKnown: s.seer.formulaKnown, resupply: s.seer.resupply, batches: s.seer.batches, bottles: s.seer.bottles, omen: s.seer.omen } });
}
export function foolSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'diviner' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的诡秘侍者继续。';
  if (!validateAttendantMysteriesState(s) || s.attendantMysteries.promotionWeek === null) return '原晋升、城镇和继承履历未通过核验。';
  if (s.progression.acting !== 100 || !s.attendantMysteries.life.reflected) return '先完成本阶三项实践、反思与消化。';
  if (hasAttendantMysteriesLock(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先真实收束原镇外出、原工房与争议，回到当代接待处。';
  const t = s.attendantMysteries.town;
  if (!t || t.operatorAt !== 'base' || t.plot !== 'new-alder-clearing' || !t.region || t.cart.location !== 'base' || !t.cart.hired) return '须回到新白榆镇同一接待处，原运输车也须实际在此。';
  const current = t.originals.filter(o => o.status === 'CONTROLLED' && o.wormId !== null);
  if (current.length !== 24 || current.some(o => o.location !== t.plot || !t.worms.some(w => w.id === o.wormId && w.status === 'ASSIGNED')) || t.worms.filter(w => w.status === 'ASSIGNED').length !== 24) return '须保留原镇二十四位受控原居民与各自实际分虫；本线不会补发居民或灵之虫。';
  if (s.date.year < 1653) return '该独立遗产尚未进入本年代的真实交接。';
  return null;
}
export function createFoolSource(s: SliceState): FoolSource {
  const reason = foolSourceBlock(s); if (reason) throw Error(reason);
  const actorId = `${s.runId}:original-player`, checkpoint = { week: s.week, date: structuredClone(s.date), revision: s.revision };
  const town = s.attendantMysteries.town!;
  const townSource: FoolSource['town'] = { townEpoch: town.epoch, townRegionId: town.region!.id, townPlot: town.plot!,
    townResidents: town.originals.filter(o => o.status === 'CONTROLLED').map(o => ({bodyId:o.bodyId,wormId:o.wormId!,location:o.location,controlled:true,health:o.health})),
    externalLiveWormIds: [...town.worms.filter(w => w.status === 'ASSIGNED').map(w => w.id), ...(s.bizarroSorcerer.life.worms.split - s.bizarroSorcerer.life.worms.recalled - s.bizarroSorcerer.life.worms.lost === 1 ? ['BR4-SPIRIT-WORM-1'] : [])],
    cart: {id:'town-cart-1',hired:town.cart.hired,holder:town.cart.holder,location:town.cart.location,freeCapacityKg:town.cart.capacityKg-cargoWeight(town.cart.goods)} };
  const sourceSnapshot = snapshotFoolS1Source(s.attendantMysteries);
  const materialsOrigin: FoolMaterialsOrigin = { version: 1, actorId, checkpoint, sourceSnapshot,
    snapshotDigest: foolS1SnapshotDigest(sourceSnapshot), uniquenessCustody: foolUniquenessCustody(checkpoint) };
  return { runId: s.runId, actorId, revision: s.revision, budget: foolBudget(s),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier,
      nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    character: structuredClone(s.character), random: { ...s.random }, sourceHistoryDigest: foolFrozenSourceDigest(s),
    town: townSource, emergencyWorkUsed: s.attendantMysteries.reception.work.emergencyUsed, combatHistoryLength: s.combatHistory.length, combatHistoryDigest: hash(s.combatHistory), materialsOrigin,
    worldDigest: foolWorldDigest(checkpoint) };
}
/** Read-only predecessor view. New living positions, resource payments and the
 * active godhood ledger belong to the new chapter; old records are never reset. */
export function foolSourceView(s: SliceState, origin: FoolSource): SliceState {
  const b = origin.budget;
  return { ...s, ...structuredClone(origin.finance), week: b.week, date: structuredClone(b.date), revision: origin.revision,
    status: 'ACTIVE', health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
    injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, random: { ...origin.random }, character: structuredClone(origin.character),
    activeEvent: null, eventQueue: [], combat: null, pulse: 'NONE', billAmount: 0, ending: null,
    progression: { ...s.progression, pathwayId: 'diviner', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, origin.combatHistoryLength),
  };
}
export function validateFoolSource(s: SliceState, origin: FoolSource): boolean {
  try {
    if (origin.runId !== s.runId || origin.actorId !== `${s.runId}:original-player` || origin.revision > s.revision ||
      origin.sourceHistoryDigest !== foolFrozenSourceDigest(s) ||
      origin.combatHistoryDigest !== hash(s.combatHistory.slice(0, origin.combatHistoryLength)) ||
      !same(origin.materialsOrigin.sourceSnapshot, snapshotFoolS1Source(s.attendantMysteries)) ||
      origin.materialsOrigin.snapshotDigest !== foolS1SnapshotDigest(origin.materialsOrigin.sourceSnapshot)) return false;
    const view = foolSourceView(s, origin);
    return same(createFoolSource(view), origin);
  } catch { return false; }
}
