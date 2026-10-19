import type { SliceState } from '../slice/types.js';
import { validateAbominationState, hasAbominationLock, hasAbominationOldPractice, resolveAbominationOriginalsSnapshot } from '../abomination/index.js';
import { ABOMINATION_SOURCE_KEYS } from '../abomination/types.js';
import { ABOMINATION_CASE_IDS, getAbominationCurrentSite } from '../abomination/life.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates } from '../game-calendar.js';
import { CHAINED_ORIGINAL_IDS, CHAINED_SUCCESSION } from './content.js';
import type { ChainedBudget, ChainedSource } from './types.js';
export type { ChainedBudget, ChainedFinance, ChainedSource } from './types.js';

export const CHAINED_FROZEN_SOURCE_KEYS = [...ABOMINATION_SOURCE_KEYS, 'abomination'] as const;
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const chainedBudget = (s: SliceState): ChainedBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const chainedHistoryDigest = (s: SliceState): string => digest(Object.fromEntries(CHAINED_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
export const chainedAcquisitionSnapshot = (s: SliceState) => ({
  bottles: structuredClone(s.abomination.bottles), resupply: structuredClone(s.abomination.resupply),
  promotionWeek: s.abomination.promotionWeek!, acquisitionJournal: structuredClone(s.abomination.acquisitionJournal),
});
/** Read the live S1 endpoint, never the frozen S2 room or encounter start. */
export const chainedOriginalPeopleAndObjects = (s: SliceState): ChainedSource['originals'] => ({
  site: structuredClone(getAbominationCurrentSite(s)), operation: structuredClone(s.abomination.life.operation),
  blocks: structuredClone(s.abomination.encounter.blocks),
});
export function chainedSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'chained' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的神孽本人继续。';
  if (!validateAbominationState(s) || s.abomination.promotionWeek === null) return '原晋升、原人物与实际履历未通过核验。';
  const life = s.abomination.life;
  if (s.progression.acting !== 100 || !life.reflected || !ABOMINATION_CASE_IDS.every(id => {
    const c = life.cases[id];
    return c.status === 'RESOLVED' && c.returned && !c.contactOpen && c.attempts.length > 0 && life.journal.some(e => e.command.type === 'REPORT' && e.command.caseId === id);
  }) || !life.journal.some(e => e.command.type === 'REFLECT')) return '先完成神孽三案的真实报告、反思与完整消化；普通完成同样有效。';
  if (hasAbominationLock(s) || hasAbominationOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧能力、归还原物并结束旧现场的接触。';
  const site = getAbominationCurrentSite(s), operation = life.operation;
  if (!['START', 'OUTSIDE'].includes(site.playerLocation) || site.activeCase !== null || !site.volunteer.alive || site.volunteer.form !== 'HUMAN' || site.volunteer.location !== 'OUTSIDE' ||
      site.clothing.location !== 'ELSA' || !site.clothing.worn || site.bag.location !== 'ELSA' || site.guide.location !== 'OUTSIDE' || site.tray.location !== 'A' || site.tray.privacy !== 'PRIVATE' || site.note.location !== 'B' ||
      operation.door !== 'OPEN' || operation.inputActive || operation.form !== null || life.pending !== null ||
      (life.pulse !== null && !life.pulse.resolved) || (life.cue !== null && !life.cue.executed && life.cue.delayRemainingSeconds > 0) ||
      life.pieces.some(piece => piece.status !== 'RETURNED' || piece.location !== 'RETURNED') || s.abomination.encounter.barrier !== null || s.abomination.encounter.cry !== null || s.abomination.encounter.hesitationSeconds > 0)
    return '本人须在原入口或室外，埃尔莎与哈伦已实际离场，原衣包归埃尔莎、原盘纸留原处，原门开放且旧作用已停止。';
  const first = s.abomination.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  const succession = CHAINED_SUCCESSION;
  if (!first || compareGameDates(succession.death.date, succession.separation.date) > 0 ||
      compareGameDates(succession.separation.date, succession.custody.date) > 0 ||
      [succession.death.date, succession.separation.date, succession.custody.date].some(date => compareGameDates(date, first.date) >= 0)) return '前任死亡、析出与唯一性封存须各自早于本人最初取得成品指导。';
  const originals = resolveAbominationOriginalsSnapshot(s.abomination);
  if (!originals || originals.characteristics.length !== 3 || CHAINED_ORIGINAL_IDS.some(id => originals.characteristics.filter(item => item.originalBottleId === id).length !== 1) ||
      originals.characteristics.filter(item => item.holder === 'EMBODIED').length !== 1 || !originals.embodiedOriginalBottleId || !originals.embodiedBottleId) return '须核清同一三份原特性和本体内实际晋升的一份，额外独立原瓶不能改名进入。';
  const embodied = originals.characteristics.find(item => item.originalBottleId === originals.embodiedOriginalBottleId);
  const consumed = embodied?.consumptionHistory.at(-1);
  if (embodied?.holder !== 'EMBODIED' || !consumed || consumed.bottleId !== originals.embodiedBottleId || consumed.week !== s.abomination.promotionWeek || !['SUCCESS', 'GREAT_SUCCESS'].includes(consumed.outcome)) return '本体内原特性须对应实际成功晋升的同一瓶与检定。';
  return null;
}
export function createChainedSource(s: SliceState): ChainedSource {
  const reason = chainedSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = chainedAcquisitionSnapshot(s), originals = chainedOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, character: structuredClone(s.character), budget: chainedBudget(s),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: chainedHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition, acquisitionDigest: digest(acquisition), originalCharacteristics: resolveAbominationOriginalsSnapshot(s.abomination)!,
  };
}
export function chainedSourceView(s: SliceState, source: ChainedSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date), actionsRemaining: b.actions,
    cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality, status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random }, progression: { ...s.progression, pathwayId: 'chained', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validateChainedSource(s: SliceState, source: ChainedSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createChainedSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision || source.random.seed !== s.random.seed ||
        source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 || source.historyDigest !== chainedHistoryDigest(s) ||
        source.originalWorldDigest !== digest(s.world) || source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, chainedOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, chainedAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createChainedSource(chainedSourceView(s, source)), source);
  } catch { return false; }
}
