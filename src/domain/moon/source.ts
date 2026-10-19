import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import type { BeautyGoddessBottle, BeautyGoddessAcquisitionEvent, BeautyGoddessState } from '../beauty-goddess/types.js';
import { validateBeautyGoddessState, hasBeautyGoddessLock, hasBeautyGoddessOldPractice, resolveBeautyGoddessOriginalCharacteristics } from '../beauty-goddess/index.js';
import { getBeautyGoddessGuest } from '../beauty-goddess/life.js';
import { compareGameDates } from '../game-calendar.js';
import { MOON_VACANCY_DATE } from './content.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';

const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
/** Original bounded game continuation. Every prior person, object, bottle and
 * outcome is frozen; new civic institutions never reuse or reset those actors. */
export const MOON_FROZEN_SOURCE_KEYS = [
  'apothecary', 'tamer', 'vampire', 'potionProfessor', 'crimsonScholar',
  'witchKing', 'summoningMaster', 'lifeGiver', 'beautyGoddess',
] as const;
export interface MoonBudget {
  week: number; date: PublicGameDate; actions: number; cash: number;
  health: number; mind: number; spirituality: number; pollution: number;
  injuries: SliceState['injuries']; injuryRisk: number; status: SliceState['status'];
  sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type MoonFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export interface MoonAcquisitionSnapshot {
  bottles: BeautyGoddessBottle[];
  consumptions: BeautyGoddessAcquisitionEvent[];
  promotionWeek: number;
  acquisitionJournal: BeautyGoddessAcquisitionEvent[]; resupply: BeautyGoddessState['resupply'];
}
export interface MoonSource {
  runId: string; actorId: string; revision: number; budget: MoonBudget;
  character: SliceState['character']; finance: MoonFinance; random: SliceState['random'];
  historyDigest: string; combatHistoryLength: number; combatHistoryDigest: string;
  originalPartner: SliceState['summoningMaster']['life']['partner']; originalPartnerDigest: string;
  originalWorldDigest: string; acquisition: MoonAcquisitionSnapshot; acquisitionDigest: string;
}
export const moonBudget = (s: SliceState): MoonBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats },
  completedSources: [...s.seer.completedSources],
});
export function moonHistoryDigest(s: SliceState): string {
  return digest(Object.fromEntries(MOON_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
}
export function moonAcquisitionSnapshot(s: SliceState): MoonAcquisitionSnapshot {
  if (s.beautyGoddess.promotionWeek === null) throw Error('尚无真实美神晋升记录。');
  return {
    bottles: structuredClone(s.beautyGoddess.bottles),
    consumptions: structuredClone(s.beautyGoddess.acquisitionJournal.filter(e => e.command.type === 'CONSUME')),
    promotionWeek: s.beautyGoddess.promotionWeek,
    acquisitionJournal: structuredClone(s.beautyGoddess.acquisitionJournal),
    resupply: structuredClone(s.beautyGoddess.resupply),
  };
}
export function moonSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'moon' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的美神继续。';
  if (!validateBeautyGoddessState(s) || s.beautyGoddess.promotionWeek === null) return '原晋升与原人物、物品履历尚未通过核验。';
  if (s.progression.acting !== 100 || !s.beautyGoddess.life.reflected) return '先完成美神的真实实践、反思和消化。';
  if (hasBeautyGoddessLock(s) || hasBeautyGoddessOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先沿普通退路收束原现场，再听取新的指导。';
  if (compareGameDates(s.date, MOON_VACANCY_DATE) <= 0) return '银湾的未来变故尚未发生，当前仍没有可交接的空位。';
  // Additional attempt bottles are not additional characteristics. Only the
  // verified recovery chain may move one of these three originals; independent
  // historical later-batch bottles remain readable but cannot enter this route.
  const originals = resolveBeautyGoddessOriginalCharacteristics(s);
  if (!originals || originals.characteristics.length !== 3) return '原特性来源与三份总量尚有未解决的冲突，须先查清，不能重复领料。';
  if (!originals.embodiedOriginalBottleId || !originals.embodiedBottleId || originals.characteristics.filter(c => c.holder === 'EMBODIED').length !== 1) return '本人实际整合的原特性尚未核清。';
  return null;
}
export function createMoonSource(s: SliceState): MoonSource {
  const reason = moonSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = moonAcquisitionSnapshot(s);
  return {
    runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision,
    budget: moonBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek,
      lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: moonHistoryDigest(s),
    combatHistoryLength: s.combatHistory.length, combatHistoryDigest: digest(s.combatHistory),
    originalPartner: structuredClone(getBeautyGoddessGuest(s)), originalPartnerDigest: digest(getBeautyGoddessGuest(s)),
    originalWorldDigest: digest(s.world), acquisition, acquisitionDigest: digest(acquisition),
  };
}
/** Only a read-only predecessor view; no old bottle, ally, casualty or outcome
 * is rewritten when the current chapter advances time or changes the body. */
export function moonSourceView(s: SliceState, source: MoonSource): SliceState {
  const b = source.budget;
  return {
    ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week,
    date: structuredClone(b.date), actionsRemaining: b.actions, cash: b.cash,
    health: b.health, mind: b.mind, spirituality: b.spirituality, status: 'ACTIVE',
    injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'moon', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validateMoonSource(s: SliceState, source: MoonSource): boolean {
  try {
    // At the actual handoff, the proposed source must equal this exact live
    // predecessor, not a self-consistent replacement view with extra money or
    // a different random cursor. Later owned transitions seal this source.
    if (!s.moon.guidanceKnown && source.revision === s.revision)
      return same(createMoonSource(s), source);
    if (source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor) return false;
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision ||
      !same(source.originalPartner, getBeautyGoddessGuest(s)) || source.originalPartnerDigest !== digest(source.originalPartner) ||
      source.historyDigest !== moonHistoryDigest(s) || source.originalWorldDigest !== digest(s.world) ||
      source.combatHistoryDigest !== digest(s.combatHistory.slice(0, source.combatHistoryLength)) ||
      !same(source.acquisition, moonAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createMoonSource(moonSourceView(s, source)), source);
  } catch { return false; }
}
