import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { validateThunderGodState, hasThunderGodLock, hasThunderGodOldPractice, thunderGodOriginals } from '../thunder-god/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import type { TyrantOriginSnapshot, TyrantOriginalResolution } from './types.js';
import { resolveTyrantOriginals } from './originals.js';
export const TYRANT_FROZEN_SOURCE_KEYS = ['sailor', 'rager', 'navigator', 'windBlessed', 'oceanSinger', 'cataclysmPriest', 'seaKing', 'catastrophe', 'thunderGod'] as const;
const digest = (v: unknown) => sha256Hex(stableStringify(v));
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export interface TyrantBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number;
  spirituality: number; pollution: number; injuries: SliceState['injuries']; injuryRisk: number;
  status: SliceState['status']; sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type TyrantFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export const tyrantOriginalPeopleAndObjects = (s: SliceState) => ({
  cove: thunderGodOriginals(s), life: structuredClone(s.thunderGod.life), encounter: structuredClone(s.thunderGod.encounter),
});
export interface TyrantSource {
  runId: string; actorId: string; revision: number; budget: TyrantBudget; character: SliceState['character'];
  finance: TyrantFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originals: ReturnType<typeof tyrantOriginalPeopleAndObjects>;
  originalsDigest: string; acquisition: TyrantOriginSnapshot; acquisitionDigest: string;
  originalCharacteristics: TyrantOriginalResolution;
}
export const tyrantBudget = (s: SliceState): TyrantBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash, health: s.health, mind: s.mind,
  spirituality: s.spirituality, pollution: s.seer.pollution, injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk,
  status: s.status, sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const tyrantHistoryDigest = (s: SliceState) => digest(Object.fromEntries(TYRANT_FROZEN_SOURCE_KEYS.map(k => [k, s[k]])));
export function tyrantAcquisitionSnapshot(s: SliceState): TyrantOriginSnapshot {
  if (s.thunderGod.promotionWeek === null) throw Error('缺少本人真实雷神晋升。');
  const a = s.thunderGod;
  return { bottles: structuredClone(a.bottles), resupply: structuredClone(a.resupply), promotionStability: structuredClone(a.promotionStability), promotionWeek: a.promotionWeek!, acquisitionJournal: structuredClone(a.acquisitionJournal) };
}
/** Strict cold admission only. Must never be called from an owned hot step. */
export function tyrantSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'tyrant' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的雷神本人继续。';
  if (!validateThunderGodState(s) || s.thunderGod.promotionWeek === null) return '原晋升、原人原物和实际履历未通过核验。';
  if (s.progression.acting !== 100 || !s.thunderGod.life.reflected || Object.values(s.thunderGod.life.cases).length !== 3 || Object.values(s.thunderGod.life.cases).some(c => c.status !== 'RESOLVED' || c.contactOpen || !c.returned)) return '先完成雷神真实实践、反思与消化。';
  if (hasThunderGodLock(s) || hasThunderGodOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧场地接触、收回或归还原物，再沿普通通路离开。';
  const originals = resolveTyrantOriginals(tyrantAcquisitionSnapshot(s));
  if (!originals) return '三份原特性的总量或血缘尚未解决；历史独立4+保持只读，不能改标回收件。';
  return null;
}
export function createTyrantSource(s: SliceState): TyrantSource {
  const reason = tyrantSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = tyrantAcquisitionSnapshot(s), originals = tyrantOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, budget: tyrantBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier,
      nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }), random: { ...s.random },
    historyDigest: tyrantHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition,
    acquisitionDigest: digest(acquisition), originalCharacteristics: resolveTyrantOriginals(acquisition)! };
}
/** Read-only predecessor view. No prior root, resident, injury, bottle, weapon,
 * device, paper, result or mastery value is healed/reset/relabelled. */
export function tyrantSourceView(s: SliceState, source: TyrantSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date),
    actionsRemaining: b.actions, cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality,
    status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'tyrant', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength), combat: null, activeEvent: null,
    eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null };
}
/** Cold import/reopen only; enclosing chapter replay validates its complete
 * journal and endpoint. A source hash alone is never an authority token. */
export function validateTyrantSource(s: SliceState, source: TyrantSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createTyrantSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision ||
        source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 ||
        source.historyDigest !== tyrantHistoryDigest(s) || source.originalWorldDigest !== digest(s.world) ||
        source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, tyrantOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, tyrantAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createTyrantSource(tyrantSourceView(s, source)), source);
  } catch { return false; }
}
