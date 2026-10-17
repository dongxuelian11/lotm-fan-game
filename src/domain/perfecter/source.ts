import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import type { CivilizationEnlightenerBottle, CivilizationEnlightenerAcquisitionEvent, CivilizationEnlightenerState } from '../civilization-enlightener/types.js';
import { validateCivilizationEnlightenerState, hasCivilizationEnlightenerLock, hasCivilizationEnlightenerOldPractice, resolveCivilizationEnlightenerOriginalCharacteristics } from '../civilization-enlightener/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';

const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
/** Original bounded game continuation. Every prior person, object, bottle and
 * outcome is frozen; new civic institutions never reuse or reset those actors. */
export const PERFECTER_FROZEN_SOURCE_KEYS = [
  'savant', 'archaeologist', 'appraiser', 'artisan', 'astronomer',
  'alchemist', 'arcaneScholar', 'knowledgeMentor', 'civilizationEnlightener',
] as const;
export interface PerfecterBudget {
  week: number; date: PublicGameDate; actions: number; cash: number;
  health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status'];
  sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type PerfecterFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface PerfecterAcquisitionSnapshot {
  bottles: CivilizationEnlightenerBottle[];
  consumptions: CivilizationEnlightenerAcquisitionEvent[];
  promotionWeek: number;
  /** Exact new recovery evidence; absent from unchanged original-three saves. */
  recovery?: { acquisitionJournal: CivilizationEnlightenerAcquisitionEvent[]; resupply: CivilizationEnlightenerState['resupply'] };
}
export interface PerfecterSource {
  runId: string; actorId: string; revision: number; budget: PerfecterBudget;
  character: SliceState['character']; finance: PerfecterFinance; random: SliceState['random'];
  historyDigest: string; combatHistoryLength: number; combatHistoryDigest: string;
  originalDevices: SliceState['alchemist']['life']['creations']; originalDevicesDigest: string;
  originalWorldDigest: string; acquisition: PerfecterAcquisitionSnapshot; acquisitionDigest: string;
}
export const perfecterBudget = (s: SliceState): PerfecterBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats },
  completedSources: [...s.seer.completedSources],
});
export function perfecterHistoryDigest(s: SliceState): string {
  return digest(Object.fromEntries(PERFECTER_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
}
export function perfecterAcquisitionSnapshot(s: SliceState): PerfecterAcquisitionSnapshot {
  if (s.civilizationEnlightener.promotionWeek === null) throw Error('尚无真实文明启蒙者晋升记录。');
  return {
    bottles: structuredClone(s.civilizationEnlightener.bottles),
    consumptions: structuredClone(s.civilizationEnlightener.acquisitionJournal.filter(e => e.command.type === 'CONSUME')),
    promotionWeek: s.civilizationEnlightener.promotionWeek,
    ...(s.civilizationEnlightener.bottles.some(b => b.recovery) ? { recovery: {
      acquisitionJournal: structuredClone(s.civilizationEnlightener.acquisitionJournal), resupply: structuredClone(s.civilizationEnlightener.resupply),
    } } : {}),
  };
}
export function perfecterSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的文明启蒙者继续。';
  if (!validateCivilizationEnlightenerState(s) || s.civilizationEnlightener.promotionWeek === null) return '原晋升与原人物、物品履历尚未通过核验。';
  if (s.progression.acting !== 100 || !s.civilizationEnlightener.life.reflected) return '先完成文明启蒙者的真实实践、反思和消化。';
  if (hasCivilizationEnlightenerLock(s) || hasCivilizationEnlightenerOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先沿普通退路收束原现场，再听取新的指导。';
  if (s.date.year < 1353) return '此次城市工艺转型尚未进入当前年代。';
  // Additional attempt bottles are not additional characteristics. Only the
  // verified recovery chain may move one of these three originals; independent
  // historical later-batch bottles remain readable but cannot enter this route.
  const originals = resolveCivilizationEnlightenerOriginalCharacteristics(s);
  if (!originals || originals.characteristics.length !== 3) return '原特性来源与三份总量尚有未解决的冲突，须先查清，不能重复领料。';
  if (!originals.embodiedOriginalBottleId || !originals.embodiedBottleId || originals.characteristics.filter(c => c.holder === 'EMBODIED').length !== 1) return '本人实际整合的原特性尚未核清。';
  return null;
}
export function createPerfecterSource(s: SliceState): PerfecterSource {
  const reason = perfecterSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = perfecterAcquisitionSnapshot(s);
  return {
    runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision,
    budget: perfecterBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek,
      lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: perfecterHistoryDigest(s),
    combatHistoryLength: s.combatHistory.length, combatHistoryDigest: digest(s.combatHistory),
    originalDevices: structuredClone(s.alchemist.life.creations), originalDevicesDigest: digest(s.alchemist.life.creations),
    originalWorldDigest: digest(s.world), acquisition, acquisitionDigest: digest(acquisition),
  };
}
/** Only a read-only predecessor view; no old bottle, ally, casualty or outcome
 * is rewritten when the current chapter advances time or changes the body. */
export function perfecterSourceView(s: SliceState, source: PerfecterSource): SliceState {
  const b = source.budget;
  return {
    ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week,
    date: structuredClone(b.date), actionsRemaining: b.actions, cash: b.cash,
    health: b.health, mind: b.mind, spirituality: b.spirituality, status: 'ACTIVE',
    injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'paragon', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validatePerfecterSource(s: SliceState, source: PerfecterSource): boolean {
  try {
    // At the actual handoff, the proposed source must equal this exact live
    // predecessor, not a self-consistent replacement view with extra money or
    // a different random cursor. Later owned transitions seal this source.
    if (!s.perfecter.guidanceKnown && source.revision === s.revision)
      return same(createPerfecterSource(s), source);
    if (source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor) return false;
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision ||
      !same(source.originalDevices, s.alchemist.life.creations) || source.originalDevicesDigest !== digest(source.originalDevices) ||
      source.historyDigest !== perfecterHistoryDigest(s) || source.originalWorldDigest !== digest(s.world) ||
      source.combatHistoryDigest !== digest(s.combatHistory.slice(0, source.combatHistoryLength)) ||
      !same(source.acquisition, perfecterAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createPerfecterSource(perfecterSourceView(s, source)), source);
  } catch { return false; }
}
