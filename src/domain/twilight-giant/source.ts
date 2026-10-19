import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { validateDivineHandState, hasDivineHandLock, hasDivineHandOldPractice, divineHandOriginals } from '../divine-hand/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import type { TwilightGiantOriginSnapshot, TwilightGiantOriginalResolution } from './types.js';
import { resolveTwilightGiantOriginals } from './originals.js';
import { compareGameDates } from '../game-calendar.js';
import { TWILIGHT_GIANT_FUTURE_BRANCH } from './material-content.js';
export const TWILIGHT_GIANT_FROZEN_SOURCE_KEYS = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter', 'silverKnight', 'glory', 'divineHand'] as const;
const digest = (v: unknown) => sha256Hex(stableStringify(v));
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export interface TwilightGiantBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number;
  spirituality: number; pollution: number; injuries: SliceState['injuries']; injuryRisk: number;
  status: SliceState['status']; sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type TwilightGiantFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export const twilightGiantOriginalPeopleAndObjects = (s: SliceState) => ({
  registry: divineHandOriginals(s),
  // Freeze actual inherited bodies, permission refusals, injuries and finite
  // stocks. No resident or device is moved into the new district.
  life: structuredClone(s.divineHand.life),
  encounter: structuredClone(s.divineHand.encounter),
});
export interface TwilightGiantSource {
  runId: string; actorId: string; revision: number; budget: TwilightGiantBudget; character: SliceState['character'];
  finance: TwilightGiantFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originals: ReturnType<typeof twilightGiantOriginalPeopleAndObjects>;
  originalsDigest: string; acquisition: TwilightGiantOriginSnapshot; acquisitionDigest: string;
  originalCharacteristics: TwilightGiantOriginalResolution;
}
export const twilightGiantBudget = (s: SliceState): TwilightGiantBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash, health: s.health, mind: s.mind,
  spirituality: s.spirituality, pollution: s.seer.pollution, injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk,
  status: s.status, sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const twilightGiantHistoryDigest = (s: SliceState) => digest(Object.fromEntries(TWILIGHT_GIANT_FROZEN_SOURCE_KEYS.map(k => [k, s[k]])));
export function twilightGiantAcquisitionSnapshot(s: SliceState): TwilightGiantOriginSnapshot {
  if (s.divineHand.promotionWeek === null) throw Error('缺少本人真实神明之手晋升。');
  const a = s.divineHand;
  return { bottles: structuredClone(a.bottles), resupply: structuredClone(a.resupply), promotionWeek: a.promotionWeek!, acquisitionJournal: structuredClone(a.acquisitionJournal) };
}
/** Strict cold admission only. Must never be called from an owned hot step.
 * Twelve actual S1 weeks are checked at consumption, not at W175 admission. */
export function twilightGiantSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'warrior' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的神明之手本人继续。';
  if (!validateDivineHandState(s) || s.divineHand.promotionWeek === null) return '原晋升、原人原物和实际履历未通过核验；原死亡终态不能作为和平活人来源。';
  if (s.progression.acting !== 100 || !s.divineHand.life.reflected) return '先完成神明之手真实实践、反思与消化。';
  if (hasDivineHandLock(s) || hasDivineHandOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧场地接触、收回或归还原物，再沿普通通路离开。';
  const stocked = s.divineHand.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  if (!stocked || compareGameDates(TWILIGHT_GIANT_FUTURE_BRANCH.transferDate, stocked.date) >= 0) return '原供货的实际日期尚未晚于本支线唯一性退出与封存；未解锁库存模板不算实体供货。';
  const originals = resolveTwilightGiantOriginals(twilightGiantAcquisitionSnapshot(s));
  if (!originals) return '三份原特性的总量或血缘尚未解决；历史独立4+保持只读，不能改标回收件。';
  return null;
}
export function createTwilightGiantSource(s: SliceState): TwilightGiantSource {
  const reason = twilightGiantSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = twilightGiantAcquisitionSnapshot(s), originals = twilightGiantOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, budget: twilightGiantBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier,
      nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }), random: { ...s.random },
    historyDigest: twilightGiantHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition,
    acquisitionDigest: digest(acquisition), originalCharacteristics: resolveTwilightGiantOriginals(acquisition)! };
}
/** Read-only predecessor view. No prior root, resident, injury, bottle, weapon,
 * device, paper, result or mastery value is healed/reset/relabelled. */
export function twilightGiantSourceView(s: SliceState, source: TwilightGiantSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date),
    actionsRemaining: b.actions, cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality,
    status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'warrior', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength), combat: null, activeEvent: null,
    eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null };
}
/** Cold import/reopen only; enclosing chapter replay validates its complete
 * journal and endpoint. A source hash alone is never an authority token. */
export function validateTwilightGiantSource(s: SliceState, source: TwilightGiantSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createTwilightGiantSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision ||
        source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 ||
        source.historyDigest !== twilightGiantHistoryDigest(s) || source.originalWorldDigest !== digest(s.world) ||
        source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, twilightGiantOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, twilightGiantAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createTwilightGiantSource(twilightGiantSourceView(s, source)), source);
  } catch { return false; }
}
