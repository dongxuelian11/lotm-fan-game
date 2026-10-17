import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import type { MisfortuneKnightBottle, MisfortuneKnightAcquisitionEvent, MisfortuneKnightState } from '../misfortune-knight/types.js';
import { validateMisfortuneKnightState, hasMisfortuneKnightLock, hasMisfortuneKnightOldPractice, resolveMisfortuneKnightOriginalCharacteristics } from '../misfortune-knight/index.js';
import { getMisfortuneKnightOriginals } from '../misfortune-knight/life.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';

const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
/** Original bounded game continuation. Every prior person, object, bottle and
 * outcome is frozen; new civic institutions never reuse or reset those actors. */
export const DARKNESS_FROZEN_SOURCE_KEYS = [
  'sleepless', 'midnight', 'nightmare', 'soother', 'spiritWarlock', 'nightwatcher',
  'fearBishop', 'concealmentServant', 'misfortuneKnight',
] as const;
export interface DarknessBudget {
  week: number; date: PublicGameDate; actions: number; cash: number;
  health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status'];
  sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type DarknessFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface DarknessAcquisitionSnapshot {
  bottles: MisfortuneKnightBottle[];
  consumptions: MisfortuneKnightAcquisitionEvent[];
  promotionWeek: number;
  acquisitionJournal: MisfortuneKnightAcquisitionEvent[]; resupply: MisfortuneKnightState['resupply'];
}
export interface DarknessSource {
  runId: string; actorId: string; revision: number; budget: DarknessBudget;
  character: SliceState['character']; finance: DarknessFinance; random: SliceState['random'];
  historyDigest: string; combatHistoryLength: number; combatHistoryDigest: string;
  originals: ReturnType<typeof getMisfortuneKnightOriginals>; originalPractice: SliceState['misfortuneKnight']['life']['practice'];
  originalsDigest: string; originalPracticeDigest: string;
  originalWorldDigest: string; acquisition: DarknessAcquisitionSnapshot; acquisitionDigest: string;
}
export const darknessBudget = (s: SliceState): DarknessBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats },
  completedSources: [...s.seer.completedSources],
});
export function darknessHistoryDigest(s: SliceState): string {
  return digest(Object.fromEntries(DARKNESS_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
}
export function darknessAcquisitionSnapshot(s: SliceState): DarknessAcquisitionSnapshot {
  if (s.misfortuneKnight.promotionWeek === null) throw Error('尚无真实厄难骑士晋升记录。');
  return {
    bottles: structuredClone(s.misfortuneKnight.bottles),
    consumptions: structuredClone(s.misfortuneKnight.acquisitionJournal.filter(e => e.command.type === 'CONSUME')),
    promotionWeek: s.misfortuneKnight.promotionWeek,
    acquisitionJournal: structuredClone(s.misfortuneKnight.acquisitionJournal),
    resupply: structuredClone(s.misfortuneKnight.resupply),
  };
}
export function darknessSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'darkness' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的厄难骑士继续。';
  if (!validateMisfortuneKnightState(s) || s.misfortuneKnight.promotionWeek === null) return '原晋升与原人物、物品履历尚未通过核验。';
  if (s.progression.acting !== 100 || !s.misfortuneKnight.life.reflected) return '先完成厄难骑士的真实实践、反思和消化。';
  if (hasMisfortuneKnightLock(s) || hasMisfortuneKnightOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先沿普通退路收束原现场，再听取新的指导。';
  // Additional attempt bottles are not additional characteristics. Only the
  // verified recovery chain may move one of these three originals; independent
  // historical later-batch bottles remain readable but cannot enter this route.
  const originals = resolveMisfortuneKnightOriginalCharacteristics(s);
  if (!originals || originals.characteristics.length !== 3) return '原特性来源与三份总量尚有未解决的冲突，须先查清，不能重复领料。';
  if (!originals.embodiedOriginalBottleId || !originals.embodiedBottleId || originals.characteristics.filter(c => c.holder === 'EMBODIED').length !== 1) return '本人实际整合的原特性尚未核清。';
  return null;
}
export function createDarknessSource(s: SliceState): DarknessSource {
  const reason = darknessSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = darknessAcquisitionSnapshot(s);
  return {
    runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision,
    budget: darknessBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek,
      lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: darknessHistoryDigest(s),
    combatHistoryLength: s.combatHistory.length, combatHistoryDigest: digest(s.combatHistory),
    originals: structuredClone(getMisfortuneKnightOriginals(s)), originalsDigest: digest(getMisfortuneKnightOriginals(s)),
    originalPractice: structuredClone(s.misfortuneKnight.life.practice), originalPracticeDigest: digest(s.misfortuneKnight.life.practice),
    originalWorldDigest: digest(s.world), acquisition, acquisitionDigest: digest(acquisition),
  };
}
/** Only a read-only predecessor view; no old bottle, ally, casualty or outcome
 * is rewritten when the current chapter advances time or changes the body. */
export function darknessSourceView(s: SliceState, source: DarknessSource): SliceState {
  const b = source.budget;
  return {
    ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week,
    date: structuredClone(b.date), actionsRemaining: b.actions, cash: b.cash,
    health: b.health, mind: b.mind, spirituality: b.spirituality, status: 'ACTIVE',
    injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'darkness', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validateDarknessSource(s: SliceState, source: DarknessSource): boolean {
  try {
    // At the actual handoff, the proposed source must equal this exact live
    // predecessor, not a self-consistent replacement view with extra money or
    // a different random cursor. Later owned transitions seal this source.
    if (!s.darkness.guidanceKnown && source.revision === s.revision)
      return same(createDarknessSource(s), source);
    if (source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor) return false;
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision ||
      !same(source.originals, getMisfortuneKnightOriginals(s)) || source.originalsDigest !== digest(source.originals) ||
      !same(source.originalPractice, s.misfortuneKnight.life.practice) || source.originalPracticeDigest !== digest(source.originalPractice) ||
      source.historyDigest !== darknessHistoryDigest(s) || source.originalWorldDigest !== digest(s.world) ||
      source.combatHistoryDigest !== digest(s.combatHistory.slice(0, source.combatHistoryLength)) ||
      !same(source.acquisition, darknessAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createDarknessSource(darknessSourceView(s, source)), source);
  } catch { return false; }
}
