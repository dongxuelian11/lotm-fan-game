import type { SliceState } from '../slice/types.js';
import { validateUncleanMonarchState, hasUncleanMonarchLock, hasUncleanMonarchOldPractice, resolveUncleanMonarchOriginalsSnapshot } from '../unclean-monarch/index.js';
import { UNCLEAN_MONARCH_SOURCE_KEYS } from '../unclean-monarch/types.js';
import { UNCLEAN_MONARCH_CASE_IDS, getUncleanMonarchCurrentSite } from '../unclean-monarch/life.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates } from '../game-calendar.js';
import { ABYSS_ORIGINAL_IDS, ABYSS_SUCCESSION } from './content.js';
import type { AbyssBudget, AbyssSource } from './types.js';
export type { AbyssBudget, AbyssFinance, AbyssSource } from './types.js';

export const ABYSS_FROZEN_SOURCE_KEYS = [...UNCLEAN_MONARCH_SOURCE_KEYS, 'uncleanMonarch'] as const;
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const abyssBudget = (s: SliceState): AbyssBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const abyssHistoryDigest = (s: SliceState): string => digest(Object.fromEntries(ABYSS_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
export const abyssAcquisitionSnapshot = (s: SliceState) => ({
  bottles: structuredClone(s.uncleanMonarch.bottles), resupply: structuredClone(s.uncleanMonarch.resupply),
  promotionWeek: s.uncleanMonarch.promotionWeek!, acquisitionJournal: structuredClone(s.uncleanMonarch.acquisitionJournal),
});
/** Read the live S1 endpoint, never the frozen S2 room or encounter start. */
export const abyssOriginalPeopleAndObjects = (s: SliceState): AbyssSource['originals'] => ({
  site: structuredClone(getUncleanMonarchCurrentSite(s)), operation: structuredClone(s.uncleanMonarch.life.operation),
  strain: s.demon.strain,
});
export function abyssSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'abyss' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的污秽君王本人继续。';
  if (!validateUncleanMonarchState(s) || s.uncleanMonarch.promotionWeek === null) return '原晋升、原人物与实际履历未通过核验。';
  const life = s.uncleanMonarch.life;
  if (s.progression.acting !== 100 || !life.reflected || !UNCLEAN_MONARCH_CASE_IDS.every(id => {
    const c = life.cases[id];
    return c.status === 'RESOLVED' && c.returned && !c.contactOpen && c.attempts.length > 0 && life.journal.some(e => e.command.type === 'REPORT' && e.command.caseId === id);
  }) || !life.journal.some(e => e.command.type === 'REFLECT')) return '先完成污秽君王三案的真实报告、反思与完整消化；普通完成同样有效。';
  if (hasUncleanMonarchLock(s) || hasUncleanMonarchOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧能力、归还原物并结束旧现场的接触。';
  const site = getUncleanMonarchCurrentSite(s), operation = life.operation;
  if (!['START', 'OUTSIDE'].includes(site.playerLocation) || site.activeCase !== null || !site.volunteer.alive || site.volunteer.location !== 'OUTSIDE' ||
      site.card.location !== 'NORA' || site.guide.location !== 'OUTSIDE' || site.bell.location !== 'B' || site.note.location !== 'B' ||
      operation.door !== 'OPEN' || operation.inputActive || operation.impulse !== null || operation.emotion !== null || operation.restraintUntil !== null || operation.hesitationUntil !== null ||
      life.pending !== null || life.impulse !== null || life.emotion !== null || (life.pulse !== null && !life.pulse.resolved) ||
      life.pieces.some(piece => piece.status !== 'RETURNED' || piece.location !== 'OWNER')) return '本人须在原入口或室外，诺拉和罗安已实际离场，原卡归诺拉、旧片归原保管人，原门开放且旧作用已停止。';
  const first = s.uncleanMonarch.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  const succession = ABYSS_SUCCESSION;
  if (!first || compareGameDates(succession.death.date, succession.separation.date) > 0 ||
      compareGameDates(succession.separation.date, succession.custody.date) > 0 ||
      [succession.death.date, succession.separation.date, succession.custody.date].some(date => compareGameDates(date, first.date) >= 0)) return '前任死亡、析出与唯一性封存须各自早于本人最初取得成品指导。';
  const originals = resolveUncleanMonarchOriginalsSnapshot(s.uncleanMonarch);
  if (!originals || originals.characteristics.length !== 3 || ABYSS_ORIGINAL_IDS.some(id => originals.characteristics.filter(item => item.originalBottleId === id).length !== 1) ||
      originals.characteristics.filter(item => item.holder === 'EMBODIED').length !== 1 || !originals.embodiedOriginalBottleId || !originals.embodiedBottleId) return '须核清同一三份原特性和本体内实际晋升的一份，额外独立原瓶不能改名进入。';
  const embodied = originals.characteristics.find(item => item.originalBottleId === originals.embodiedOriginalBottleId);
  const consumed = embodied?.consumptionHistory.at(-1);
  if (embodied?.holder !== 'EMBODIED' || !consumed || consumed.bottleId !== originals.embodiedBottleId || consumed.week !== s.uncleanMonarch.promotionWeek || !['SUCCESS', 'GREAT_SUCCESS'].includes(consumed.outcome)) return '本体内原特性须对应实际成功晋升的同一瓶与检定。';
  return null;
}
export function createAbyssSource(s: SliceState): AbyssSource {
  const reason = abyssSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = abyssAcquisitionSnapshot(s), originals = abyssOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, character: structuredClone(s.character), budget: abyssBudget(s),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: abyssHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition, acquisitionDigest: digest(acquisition), originalCharacteristics: resolveUncleanMonarchOriginalsSnapshot(s.uncleanMonarch)!,
  };
}
export function abyssSourceView(s: SliceState, source: AbyssSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date), actionsRemaining: b.actions,
    cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality, status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random }, progression: { ...s.progression, pathwayId: 'abyss', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validateAbyssSource(s: SliceState, source: AbyssSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createAbyssSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision || source.random.seed !== s.random.seed ||
        source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 || source.historyDigest !== abyssHistoryDigest(s) ||
        source.originalWorldDigest !== digest(s.world) || source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, abyssOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, abyssAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createAbyssSource(abyssSourceView(s, source)), source);
  } catch { return false; }
}
