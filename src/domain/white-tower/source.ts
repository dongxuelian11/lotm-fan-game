import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { validateAllKnowingEyeState, hasAllKnowingEyeLock, hasAllKnowingEyeOldPractice, allKnowingEyeOriginals } from '../all-knowing-eye/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import type { WhiteTowerOriginSnapshot, WhiteTowerOriginalResolution } from './types.js';
import { resolveWhiteTowerOriginals } from './originals.js';
export const WHITE_TOWER_FROZEN_SOURCE_KEYS = ['reader', 'reasoner', 'detective', 'polymath', 'mysticismMagister', 'prophet', 'insightScholar', 'wisdomAngel', 'allKnowingEye'] as const;
const digest = (v: unknown) => sha256Hex(stableStringify(v));
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export interface WhiteTowerBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number;
  spirituality: number; pollution: number; injuries: SliceState['injuries']; injuryRisk: number;
  status: SliceState['status']; sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type WhiteTowerFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export const whiteTowerOriginalPeopleAndObjects = (s: SliceState) => ({
  wisdom: allKnowingEyeOriginals(s), rig: structuredClone(s.allKnowingEye.life.rig), irena: structuredClone(s.allKnowingEye.life.irena),
  // Entire old encounter includes source, death/surrender, actual charge and custody.
  encounter: structuredClone(s.allKnowingEye.encounter),
  crafts: structuredClone(s.mysticismMagister.crafts),
});
export interface WhiteTowerSource {
  runId: string; actorId: string; revision: number; budget: WhiteTowerBudget; character: SliceState['character'];
  finance: WhiteTowerFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originals: ReturnType<typeof whiteTowerOriginalPeopleAndObjects>;
  originalsDigest: string; acquisition: WhiteTowerOriginSnapshot; acquisitionDigest: string;
  originalCharacteristics: WhiteTowerOriginalResolution;
}
export const whiteTowerBudget = (s: SliceState): WhiteTowerBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash, health: s.health, mind: s.mind,
  spirituality: s.spirituality, pollution: s.seer.pollution, injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk,
  status: s.status, sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const whiteTowerHistoryDigest = (s: SliceState) => digest(Object.fromEntries(WHITE_TOWER_FROZEN_SOURCE_KEYS.map(k => [k, s[k]])));
export function whiteTowerAcquisitionSnapshot(s: SliceState): WhiteTowerOriginSnapshot {
  if (s.allKnowingEye.promotionWeek === null) throw Error('缺少本人真实全知之眼晋升。');
  const a = s.allKnowingEye;
  return { bottles: structuredClone(a.bottles), resupply: structuredClone(a.resupply), promotionWeek: a.promotionWeek!, acquisitionJournal: structuredClone(a.acquisitionJournal) };
}
/** Strict cold admission only. Must never be called from an owned hot step. */
export function whiteTowerSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'white-tower' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的全知之眼本人继续。';
  if (!validateAllKnowingEyeState(s) || s.allKnowingEye.promotionWeek === null) return '原晋升、原人原物和实际履历未通过核验。';
  if (s.progression.acting !== 100 || !s.allKnowingEye.life.reflected) return '先完成全知之眼真实实践、反思与消化。';
  if (hasAllKnowingEyeLock(s) || hasAllKnowingEyeOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧场地接触、收回或归还原物，再沿普通通路离开。';
  const originals = resolveWhiteTowerOriginals(whiteTowerAcquisitionSnapshot(s));
  if (!originals) return '三份原特性的总量或血缘尚未解决；历史独立4+保持只读，不能改标回收件。';
  if (originals.characteristics.some(c => c.holder === 'FAILED_REMAINS')) {
    const site = allKnowingEyeOriginals(s);
    if (!site.room.exitOpen || !site.mara.alive || site.mara.location !== 'EXIT') return '旧失败原件仍须回原资料室调查；先沿旧章普通收束，把原场与玛拉当前出口位置核清。';
  }
  return null;
}
export function createWhiteTowerSource(s: SliceState): WhiteTowerSource {
  const reason = whiteTowerSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = whiteTowerAcquisitionSnapshot(s), originals = whiteTowerOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, budget: whiteTowerBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier,
      nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }), random: { ...s.random },
    historyDigest: whiteTowerHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition,
    acquisitionDigest: digest(acquisition), originalCharacteristics: resolveWhiteTowerOriginals(acquisition)! };
}
/** Read-only predecessor view. No prior root, resident, injury, bottle, weapon,
 * device, paper, result or mastery value is healed/reset/relabelled. */
export function whiteTowerSourceView(s: SliceState, source: WhiteTowerSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date),
    actionsRemaining: b.actions, cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality,
    status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'white-tower', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength), combat: null, activeEvent: null,
    eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null };
}
/** Cold import/reopen only; enclosing chapter replay validates its complete
 * journal and endpoint. A source hash alone is never an authority token. */
export function validateWhiteTowerSource(s: SliceState, source: WhiteTowerSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createWhiteTowerSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision ||
        source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 ||
        source.historyDigest !== whiteTowerHistoryDigest(s) || source.originalWorldDigest !== digest(s.world) ||
        source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, whiteTowerOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, whiteTowerAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createWhiteTowerSource(whiteTowerSourceView(s, source)), source);
  } catch { return false; }
}
