import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { validateStarKeyState, hasStarKeyLock, hasStarKeyOldPractice, starKeyOriginals } from '../star-key/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import type { DoorOriginSnapshot, DoorOriginalResolution } from './types.js';
import { resolveDoorOriginals } from './originals.js';
import { compareGameDates } from '../game-calendar.js';
import { DOOR_FUTURE_BRANCH } from './material-content.js';
export const DOOR_FROZEN_SOURCE_KEYS = ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer', 'wanderer', 'planeswalker', 'starKey'] as const;
const digest = (v: unknown) => sha256Hex(stableStringify(v));
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export interface DoorBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number;
  spirituality: number; pollution: number; injuries: SliceState['injuries']; injuryRisk: number;
  status: SliceState['status']; sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type DoorFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export const doorOriginalPeopleAndObjects = (s: SliceState) => ({
  gallery: starKeyOriginals(s),
  // Freeze actual inherited bodies, permission refusals, injuries and finite
  // stocks. No resident or device is moved into the new district.
  life: structuredClone(s.starKey.life),
  encounter: structuredClone(s.starKey.encounter),
});
export interface DoorSource {
  runId: string; actorId: string; revision: number; budget: DoorBudget; character: SliceState['character'];
  finance: DoorFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originals: ReturnType<typeof doorOriginalPeopleAndObjects>;
  originalsDigest: string; acquisition: DoorOriginSnapshot; acquisitionDigest: string;
  originalCharacteristics: DoorOriginalResolution;
}
export const doorBudget = (s: SliceState): DoorBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash, health: s.health, mind: s.mind,
  spirituality: s.spirituality, pollution: s.seer.pollution, injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk,
  status: s.status, sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const doorHistoryDigest = (s: SliceState) => digest(Object.fromEntries(DOOR_FROZEN_SOURCE_KEYS.map(k => [k, s[k]])));
export function doorAcquisitionSnapshot(s: SliceState): DoorOriginSnapshot {
  if (s.starKey.promotionWeek === null) throw Error('缺少本人真实星之匙晋升。');
  const a = s.starKey;
  return { bottles: structuredClone(a.bottles), resupply: structuredClone(a.resupply), promotionWeek: a.promotionWeek!, acquisitionJournal: structuredClone(a.acquisitionJournal) };
}
/** Strict cold admission only. Must never be called from an owned hot step. */
export function doorSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'door' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的星之匙本人继续。';
  if (!validateStarKeyState(s) || s.starKey.promotionWeek === null) return '原晋升、原人原物和实际履历未通过核验。';
  if (s.progression.acting !== 100 || !s.starKey.life.reflected) return '先完成星之匙真实实践、反思与消化。';
  if (hasStarKeyLock(s) || hasStarKeyOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧场地接触、收回或归还原物，再沿普通通路离开。';
  const stocked = s.starKey.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  if (!stocked || compareGameDates(DOOR_FUTURE_BRANCH.transferDate, stocked.date) >= 0) return '原供货的实际日期尚未晚于本支线唯一性退出与封存；未解锁库存模板不算实体供货。';
  const originals = resolveDoorOriginals(doorAcquisitionSnapshot(s));
  if (!originals) return '三份原特性的总量或血缘尚未解决；历史独立4+保持只读，不能改标回收件。';
  return null;
}
export function createDoorSource(s: SliceState): DoorSource {
  const reason = doorSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = doorAcquisitionSnapshot(s), originals = doorOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, budget: doorBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier,
      nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }), random: { ...s.random },
    historyDigest: doorHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition,
    acquisitionDigest: digest(acquisition), originalCharacteristics: resolveDoorOriginals(acquisition)! };
}
/** Read-only predecessor view. No prior root, resident, injury, bottle, weapon,
 * device, paper, result or mastery value is healed/reset/relabelled. */
export function doorSourceView(s: SliceState, source: DoorSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date),
    actionsRemaining: b.actions, cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality,
    status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'door', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength), combat: null, activeEvent: null,
    eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null };
}
/** Cold import/reopen only; enclosing chapter replay validates its complete
 * journal and endpoint. A source hash alone is never an authority token. */
export function validateDoorSource(s: SliceState, source: DoorSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createDoorSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision ||
        source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 ||
        source.historyDigest !== doorHistoryDigest(s) || source.originalWorldDigest !== digest(s.world) ||
        source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, doorOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, doorAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createDoorSource(doorSourceView(s, source)), source);
  } catch { return false; }
}
