import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import type { ConquerorBottle, ConquerorAcquisitionEvent } from '../conqueror/types.js';
import { validateConquerorState, hasConquerorLock } from '../conqueror/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';

const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
/** Old living people and original equipment remain these exact historical
 * entities. New national armies never become replacements for this team. */
export const RED_PRIEST_FROZEN_SOURCE_KEYS = [
  'hunter', 'provoker', 'pyromaniac', 'conspirator', 'reaper',
  'ironBloodKnight', 'warBishop', 'weatherWarlock', 'conqueror',
] as const;
export interface RedPriestBudget {
  week: number; date: PublicGameDate; actions: number; cash: number;
  health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status'];
  sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type RedPriestFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface RedPriestAcquisitionSnapshot {
  bottles: ConquerorBottle[];
  consumptions: ConquerorAcquisitionEvent[];
  promotionWeek: number;
}
export interface RedPriestSource {
  runId: string; actorId: string; revision: number; budget: RedPriestBudget;
  character: SliceState['character']; finance: RedPriestFinance; random: SliceState['random'];
  historyDigest: string; combatHistoryLength: number; combatHistoryDigest: string;
  originalWorldDigest: string; acquisition: RedPriestAcquisitionSnapshot; acquisitionDigest: string;
}
export const redPriestBudget = (s: SliceState): RedPriestBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats },
  completedSources: [...s.seer.completedSources],
});
export function redPriestHistoryDigest(s: SliceState): string {
  return digest(Object.fromEntries(RED_PRIEST_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
}
export function redPriestAcquisitionSnapshot(s: SliceState): RedPriestAcquisitionSnapshot {
  if (s.conqueror.promotionWeek === null) throw Error('尚无真实征服者晋升记录。');
  return {
    bottles: structuredClone(s.conqueror.bottles),
    consumptions: structuredClone(s.conqueror.acquisitionJournal.filter(e => e.command.type === 'CONSUME')),
    promotionWeek: s.conqueror.promotionWeek,
  };
}
export function redPriestSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'hunter' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的征服者继续。';
  if (!validateConquerorState(s) || s.conqueror.promotionWeek === null) return '原晋升与实际军团、物品履历尚未通过核验。';
  if (s.progression.acting !== 100 || !s.conqueror.life.reflected) return '先完成征服者的真实实践、反思和消化。';
  if (hasConquerorLock(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先沿普通退路收束原现场，不得把未完成的交战带入新战争。';
  if (s.date.year < 1353) return '北大陆此次危机尚未进入当前年代，可先继续现有生活。';
  // This chapter has exactly three originals. A historical later-batch save is
  // readable, but cannot mint a fourth characteristic through this storyline.
  const bottles = s.conqueror.bottles;
  if (bottles.length !== 3 || bottles.some((b, i) => b.id !== `conqueror-potion-${i + 1}`)) return '原特性来源与三份总量尚有未解决的冲突，须先查清，不能重复领料。';
  if (bottles.filter(b => b.status === 'CONSUMED' && (b.outcome === 'SUCCESS' || b.outcome === 'GREAT_SUCCESS')).length !== 1) return '本人实际整合的原特性尚未核清。';
  return null;
}
export function createRedPriestSource(s: SliceState): RedPriestSource {
  const reason = redPriestSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = redPriestAcquisitionSnapshot(s);
  return {
    runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision,
    budget: redPriestBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek,
      lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: redPriestHistoryDigest(s),
    combatHistoryLength: s.combatHistory.length, combatHistoryDigest: digest(s.combatHistory),
    originalWorldDigest: digest(s.world), acquisition, acquisitionDigest: digest(acquisition),
  };
}
/** Only a read-only predecessor view; no old bottle, ally, casualty or outcome
 * is rewritten when the current chapter advances time or changes the body. */
export function redPriestSourceView(s: SliceState, source: RedPriestSource): SliceState {
  const b = source.budget;
  return {
    ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week,
    date: structuredClone(b.date), actionsRemaining: b.actions, cash: b.cash,
    health: b.health, mind: b.mind, spirituality: b.spirituality, status: 'ACTIVE',
    injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'hunter', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validateRedPriestSource(s: SliceState, source: RedPriestSource): boolean {
  try {
    // At the actual handoff, the proposed source must equal this exact live
    // predecessor, not a self-consistent replacement view with extra money or
    // a different random cursor. Later owned transitions seal this source.
    if (!s.redPriest.guidanceKnown && source.revision === s.revision)
      return same(createRedPriestSource(s), source);
    if (source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor) return false;
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision ||
      source.historyDigest !== redPriestHistoryDigest(s) || source.originalWorldDigest !== digest(s.world) ||
      source.combatHistoryDigest !== digest(s.combatHistory.slice(0, source.combatHistoryLength)) ||
      !same(source.acquisition, redPriestAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createRedPriestSource(redPriestSourceView(s, source)), source);
  } catch { return false; }
}
