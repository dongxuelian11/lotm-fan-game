import type { SliceState } from '../slice/types.js';
import { validateMercurySnakeState, hasMercurySnakeLock, hasMercurySnakeOldPractice, resolveMercurySnakeOriginalsSnapshot } from '../mercury-snake/index.js';
import { MERCURY_SNAKE_SOURCE_KEYS } from '../mercury-snake/types.js';
import { MERCURY_SNAKE_CASE_IDS, getMercurySnakeCurrentSite } from '../mercury-snake/life.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates } from '../game-calendar.js';
import { WHEEL_OF_FORTUNE_ORIGINAL_IDS, WHEEL_OF_FORTUNE_SUCCESSION } from './content.js';
import type { WheelOfFortuneBudget, WheelOfFortuneSource } from './types.js';
export type { WheelOfFortuneBudget, WheelOfFortuneFinance, WheelOfFortuneSource } from './types.js';

export const WHEEL_OF_FORTUNE_FROZEN_SOURCE_KEYS = [...MERCURY_SNAKE_SOURCE_KEYS, 'mercurySnake'] as const;
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const wheelOfFortuneBudget = (s: SliceState): WheelOfFortuneBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const wheelOfFortuneHistoryDigest = (s: SliceState): string => digest(Object.fromEntries(WHEEL_OF_FORTUNE_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
export const wheelOfFortuneAcquisitionSnapshot = (s: SliceState) => ({
  bottles: structuredClone(s.mercurySnake.bottles), resupply: structuredClone(s.mercurySnake.resupply),
  promotionWeek: s.mercurySnake.promotionWeek!, acquisitionJournal: structuredClone(s.mercurySnake.acquisitionJournal),
});
/** Read the live S1 endpoint, never the frozen S2 room or encounter start. */
export const wheelOfFortuneOriginalPeopleAndObjects = (s: SliceState): WheelOfFortuneSource['originals'] => ({
  site: structuredClone(getMercurySnakeCurrentSite(s)), operation: structuredClone(s.mercurySnake.life.operation),
  luck: structuredClone(s.mercurySnake.luck),
});
export function wheelOfFortuneSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'wheel' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的水银之蛇本人继续。';
  if (!validateMercurySnakeState(s) || s.mercurySnake.promotionWeek === null) return '原晋升、原人物与实际履历未通过核验。';
  const life = s.mercurySnake.life;
  if (s.progression.acting !== 100 || !life.reflected || !MERCURY_SNAKE_CASE_IDS.every(id => {
    const c = life.cases[id];
    return c.status === 'RESOLVED' && c.returned && !c.contactOpen && c.attempts.length > 0 && life.journal.some(e => e.command.type === 'REPORT' && e.command.caseId === id);
  }) || !life.journal.some(e => e.command.type === 'REFLECT')) return '先完成水银之蛇三案的真实报告、反思与完整消化；普通完成同样有效。';
  if (hasMercurySnakeLock(s) || hasMercurySnakeOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧能力、归还原物并结束旧现场的接触。';
  const site = getMercurySnakeCurrentSite(s), operation = life.operation;
  if (!['START', 'OUTSIDE'].includes(site.playerLocation) || site.activeCase !== null || !site.volunteer.alive || site.volunteer.location !== 'OUTSIDE' || site.guide.location !== 'OUTSIDE' ||
      site.cart.location !== 'A' || site.cart.control !== 'GUIDE' || site.parcel.location !== 'CW3-CART' || !site.parcel.sealed || site.parcel.massGrams !== 400 ||
      site.pouch.location !== 'VERA' || site.tags.some(tag => tag.location !== 'POUCH') || site.disc.location !== 'A' || site.disc.control !== 'GUIDE' || site.record.location !== 'B' || site.forecast.location !== 'B' ||
      operation.door !== 'OPEN' || operation.forecast !== null || operation.correction !== null || life.pending !== null || life.viewBlocked || life.captured?.valid ||
      life.pieces.some(piece => piece.status !== 'RETURNED' || piece.location !== 'RETURNED') || s.mercurySnake.encounter.restart !== null || s.mercurySnake.encounter.anchor !== null)
    return '本人须在原门口或室外，艾妲与薇拉已实际离场；同一原车包盘袋签和旧记录仍在真实归还处，旧短窗与待用联系均已停止。';
  const first = s.mercurySnake.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  const succession = WHEEL_OF_FORTUNE_SUCCESSION;
  if (!first || compareGameDates(succession.death.date, succession.separation.date) > 0 ||
      compareGameDates(succession.separation.date, succession.custody.date) > 0 ||
      [succession.death.date, succession.separation.date, succession.custody.date].some(date => compareGameDates(date, first.date) >= 0)) return '前任死亡、析出与唯一性封存须各自早于本人最初取得成品指导。';
  const originals = resolveMercurySnakeOriginalsSnapshot(s.mercurySnake);
  if (!originals || originals.characteristics.length !== 3 || WHEEL_OF_FORTUNE_ORIGINAL_IDS.some(id => originals.characteristics.filter(item => item.originalBottleId === id).length !== 1) ||
      originals.characteristics.filter(item => item.holder === 'EMBODIED').length !== 1 || !originals.embodiedOriginalBottleId || !originals.embodiedBottleId) return '须核清同一三份原特性和本体内实际晋升的一份，额外独立原瓶不能改名进入。';
  const embodied = originals.characteristics.find(item => item.originalBottleId === originals.embodiedOriginalBottleId);
  const consumed = embodied?.consumptionHistory.at(-1);
  if (embodied?.holder !== 'EMBODIED' || !consumed || consumed.bottleId !== originals.embodiedBottleId || consumed.week !== s.mercurySnake.promotionWeek || !['SUCCESS', 'GREAT_SUCCESS'].includes(consumed.outcome)) return '本体内原特性须对应实际成功晋升的同一瓶与检定。';
  return null;
}
export function createWheelOfFortuneSource(s: SliceState): WheelOfFortuneSource {
  const reason = wheelOfFortuneSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = wheelOfFortuneAcquisitionSnapshot(s), originals = wheelOfFortuneOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, character: structuredClone(s.character), budget: wheelOfFortuneBudget(s),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: wheelOfFortuneHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition, acquisitionDigest: digest(acquisition), originalCharacteristics: resolveMercurySnakeOriginalsSnapshot(s.mercurySnake)!,
  };
}
export function wheelOfFortuneSourceView(s: SliceState, source: WheelOfFortuneSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date), actionsRemaining: b.actions,
    cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality, status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random }, progression: { ...s.progression, pathwayId: 'wheel', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validateWheelOfFortuneSource(s: SliceState, source: WheelOfFortuneSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createWheelOfFortuneSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision || source.random.seed !== s.random.seed ||
        source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 || source.historyDigest !== wheelOfFortuneHistoryDigest(s) ||
        source.originalWorldDigest !== digest(s.world) || source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, wheelOfFortuneOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, wheelOfFortuneAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createWheelOfFortuneSource(wheelOfFortuneSourceView(s, source)), source);
  } catch { return false; }
}
