import type { SliceState } from '../slice/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { validatePureWhiteAngelState, hasPureWhiteAngelLock, hasPureWhiteAngelOldPractice, pureWhiteAngelOriginals } from '../pure-white-angel/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import type { SunOriginSnapshot, SunOriginalResolution } from './types.js';
import { resolveSunOriginals } from './originals.js';
import { compareGameDates } from '../game-calendar.js';
import { SUN_FUTURE_BRANCH } from './material-content.js';
export const SUN_FROZEN_SOURCE_KEYS = ['bard', 'lightprayer', 'sunpriest', 'notary', 'priestOfLight', 'unshadowed', 'justiceMentor', 'lightSeeker', 'pureWhiteAngel'] as const;
const digest = (v: unknown) => sha256Hex(stableStringify(v));
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export interface SunBudget {
  week: number; date: PublicGameDate; actions: number; cash: number; health: number; mind: number;
  spirituality: number; pollution: number; injuries: SliceState['injuries']; injuryRisk: number;
  status: SliceState['status']; sequence: 1 | 0; acting: number; mastery: Record<string, number>;
  coreStats: SliceState['character']['coreStats']; completedSources: string[];
}
export type SunFinance = Pick<SliceState, 'weeklyBudget' | 'wagePaidWeek' | 'lifeTier' | 'nextLifeTier' | 'debts' | 'missedWeeks' | 'credit'>;
export const sunOriginalPeopleAndObjects = (s: SliceState) => ({
  gallery: pureWhiteAngelOriginals(s),
  // Freeze actual inherited bodies, permission refusals, injuries and finite
  // stocks. No resident or device is moved into the new district.
  life: structuredClone(s.pureWhiteAngel.life),
  encounter: structuredClone(s.pureWhiteAngel.encounter),
});
export interface SunSource {
  runId: string; actorId: string; revision: number; budget: SunBudget; character: SliceState['character'];
  finance: SunFinance; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originals: ReturnType<typeof sunOriginalPeopleAndObjects>;
  originalsDigest: string; acquisition: SunOriginSnapshot; acquisitionDigest: string;
  originalCharacteristics: SunOriginalResolution;
}
export const sunBudget = (s: SliceState): SunBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash, health: s.health, mind: s.mind,
  spirituality: s.spirituality, pollution: s.seer.pollution, injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk,
  status: s.status, sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const sunHistoryDigest = (s: SliceState) => digest(Object.fromEntries(SUN_FROZEN_SOURCE_KEYS.map(k => [k, s[k]])));
export function sunAcquisitionSnapshot(s: SliceState): SunOriginSnapshot {
  if (s.pureWhiteAngel.promotionWeek === null) throw Error('缺少本人真实纯白天使晋升。');
  const a = s.pureWhiteAngel;
  return { bottles: structuredClone(a.bottles), resupply: structuredClone(a.resupply), promotionWeek: a.promotionWeek!, acquisitionJournal: structuredClone(a.acquisitionJournal) };
}
/** Strict cold admission only. Must never be called from an owned hot step. */
export function sunSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'sun' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的纯白天使本人继续。';
  if (!validatePureWhiteAngelState(s) || s.pureWhiteAngel.promotionWeek === null) return '原晋升、原人原物和实际履历未通过核验。';
  if (s.progression.acting !== 100 || !s.pureWhiteAngel.life.reflected) return '先完成纯白天使真实实践、反思与消化。';
  if (hasPureWhiteAngelLock(s) || hasPureWhiteAngelOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧场地接触、收回或归还原物，再沿普通通路离开。';
  const stocked = s.pureWhiteAngel.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  if (!stocked || compareGameDates(SUN_FUTURE_BRANCH.transferDate, stocked.date) >= 0) return '原供货的实际日期尚未晚于本支线唯一性退出与封存；未解锁库存模板不算实体供货。';
  const originals = resolveSunOriginals(sunAcquisitionSnapshot(s));
  if (!originals) return '三份原特性的总量或血缘尚未解决；历史独立4+保持只读，不能改标回收件。';
  if (originals.characteristics.some(c => c.holder === 'FAILED_REMAINS')) {
    const site = pureWhiteAngelOriginals(s);
    if (site.playerLocation !== 'ENTRY' || site.ordinaryExit !== 'OPEN' || site.light.mode !== 'OFF' || !['ENTRY','SIDE'].includes(site.operatorLocation)) return '旧失败原件仍须回原采光廊调查；先实际停止原光、走回入口并核清玛拉当前原位。';
  }
  return null;
}
export function createSunSource(s: SliceState): SunSource {
  const reason = sunSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = sunAcquisitionSnapshot(s), originals = sunOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, budget: sunBudget(s), character: structuredClone(s.character),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier,
      nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }), random: { ...s.random },
    historyDigest: sunHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition,
    acquisitionDigest: digest(acquisition), originalCharacteristics: resolveSunOriginals(acquisition)! };
}
/** Read-only predecessor view. No prior root, resident, injury, bottle, weapon,
 * device, paper, result or mastery value is healed/reset/relabelled. */
export function sunSourceView(s: SliceState, source: SunSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date),
    actionsRemaining: b.actions, cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality,
    status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'sun', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] },
    combatHistory: s.combatHistory.slice(0, source.combatHistoryLength), combat: null, activeEvent: null,
    eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null };
}
/** Cold import/reopen only; enclosing chapter replay validates its complete
 * journal and endpoint. A source hash alone is never an authority token. */
export function validateSunSource(s: SliceState, source: SunSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createSunSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision ||
        source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 ||
        source.historyDigest !== sunHistoryDigest(s) || source.originalWorldDigest !== digest(s.world) ||
        source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, sunOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, sunAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createSunSource(sunSourceView(s, source)), source);
  } catch { return false; }
}
