import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import type { WriterBottle, WriterAcquisitionEvent, WriterState } from '../writer/types.js';
import { validateWriterState, hasWriterLock, resolveWriterOriginalCharacteristics } from '../writer/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';

const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
/** Original bounded game continuation. Every prior person, object, bottle and
 * outcome is frozen; new civic institutions never reuse or reset those actors. */
export const VISIONARY_FROZEN_SOURCE_KEYS = [
  'audience', 'mindreader', 'psychologist', 'hypnotist', 'dreamwalker',
  'manipulator', 'dreamWeaver', 'discerner', 'writer',
] as const;
export interface VisionaryBudget {
  week: number; date: PublicGameDate; actions: number; cash: number;
  health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status'];
  sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type VisionaryFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface VisionaryAcquisitionSnapshot {
  bottles: WriterBottle[];
  consumptions: WriterAcquisitionEvent[];
  promotionWeek: number;
  /** Exact new recovery evidence; absent from unchanged original-three saves. */
  recovery?: { acquisitionJournal: WriterAcquisitionEvent[]; resupply: WriterState['resupply'] };
}
export interface VisionarySource {
  runId: string; actorId: string; revision: number; budget: VisionaryBudget;
  character: SliceState['character']; finance: VisionaryFinance; random: SliceState['random'];
  historyDigest: string; combatHistoryLength: number; combatHistoryDigest: string;
  originalWorldDigest: string; acquisition: VisionaryAcquisitionSnapshot; acquisitionDigest: string;
}
export const visionaryBudget = (s: SliceState): VisionaryBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats },
  completedSources: [...s.seer.completedSources],
});
export function visionaryHistoryDigest(s: SliceState): string {
  return digest(Object.fromEntries(VISIONARY_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
}
export function visionaryAcquisitionSnapshot(s: SliceState): VisionaryAcquisitionSnapshot {
  if (s.writer.promotionWeek === null) throw Error('尚无真实作家晋升记录。');
  return {
    bottles: structuredClone(s.writer.bottles),
    consumptions: structuredClone(s.writer.acquisitionJournal.filter(e => e.command.type === 'CONSUME')),
    promotionWeek: s.writer.promotionWeek,
    ...(s.writer.bottles.some(b => b.recovery) ? { recovery: {
      acquisitionJournal: structuredClone(s.writer.acquisitionJournal), resupply: structuredClone(s.writer.resupply),
    } } : {}),
  };
}
export function visionarySourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'audience' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的作家继续。';
  if (!validateWriterState(s) || s.writer.promotionWeek === null) return '原晋升与原人物、物品履历尚未通过核验。';
  if (s.progression.acting !== 100 || !s.writer.life.reflected) return '先完成作家的真实实践、反思和消化。';
  if (hasWriterLock(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先沿普通退路收束原现场，再听取新的指导。';
  if (s.date.year < 1352) return '此次公共救援制度转型尚未进入当前年代。';
  // Additional attempt bottles are not additional characteristics. Only the
  // verified recovery chain may move one of these three originals; independent
  // historical later-batch bottles remain readable but cannot enter this route.
  const originals = resolveWriterOriginalCharacteristics(s);
  if (!originals || originals.characteristics.length !== 3) return '原特性来源与三份总量尚有未解决的冲突，须先查清，不能重复领料。';
  if (!originals.embodiedOriginalBottleId || !originals.embodiedBottleId || originals.characteristics.filter(c => c.holder === 'EMBODIED').length !== 1) return '本人实际整合的原特性尚未核清。';
  return null;
}
export function createVisionarySource(s: SliceState): VisionarySource {
  const reason = visionarySourceBlock(s); if (reason) throw Error(reason);
  const acquisition = visionaryAcquisitionSnapshot(s);
  return {
    runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision,
    budget: visionaryBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek,
      lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: visionaryHistoryDigest(s),
    combatHistoryLength: s.combatHistory.length, combatHistoryDigest: digest(s.combatHistory),
    originalWorldDigest: digest(s.world), acquisition, acquisitionDigest: digest(acquisition),
  };
}
/** Only a read-only predecessor view; no old bottle, ally, casualty or outcome
 * is rewritten when the current chapter advances time or changes the body. */
export function visionarySourceView(s: SliceState, source: VisionarySource): SliceState {
  const b = source.budget;
  return {
    ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week,
    date: structuredClone(b.date), actionsRemaining: b.actions, cash: b.cash,
    health: b.health, mind: b.mind, spirituality: b.spirituality, status: 'ACTIVE',
    injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'audience', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validateVisionarySource(s: SliceState, source: VisionarySource): boolean {
  try {
    // At the actual handoff, the proposed source must equal this exact live
    // predecessor, not a self-consistent replacement view with extra money or
    // a different random cursor. Later owned transitions seal this source.
    if (!s.visionary.guidanceKnown && source.revision === s.revision)
      return same(createVisionarySource(s), source);
    if (source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor) return false;
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision ||
      source.historyDigest !== visionaryHistoryDigest(s) || source.originalWorldDigest !== digest(s.world) ||
      source.combatHistoryDigest !== digest(s.combatHistory.slice(0, source.combatHistoryLength)) ||
      !same(source.acquisition, visionaryAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createVisionarySource(visionarySourceView(s, source)), source);
  } catch { return false; }
}
