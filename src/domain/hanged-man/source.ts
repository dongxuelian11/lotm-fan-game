import type { SliceState } from '../slice/types.js';
import { validateDarkAngelState, hasDarkAngelLock, hasDarkAngelOldPractice, resolveDarkAngelOriginalsSnapshot } from '../dark-angel/index.js';
import { DARK_ANGEL_SOURCE_KEYS } from '../dark-angel/types.js';
import { DARK_ANGEL_CASE_IDS, getDarkAngelCurrentSite } from '../dark-angel/life.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates } from '../game-calendar.js';
import { HANGED_MAN_ORIGINAL_IDS, HANGED_MAN_SUCCESSION } from './content.js';
import type { HangedManBudget, HangedManSource } from './types.js';
export type { HangedManBudget, HangedManFinance, HangedManSource } from './types.js';

export const HANGED_MAN_FROZEN_SOURCE_KEYS = [...DARK_ANGEL_SOURCE_KEYS, 'darkAngel'] as const;
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const hangedManBudget = (s: SliceState): HangedManBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const hangedManHistoryDigest = (s: SliceState): string => digest(Object.fromEntries(HANGED_MAN_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
export const hangedManAcquisitionSnapshot = (s: SliceState) => ({
  bottles: structuredClone(s.darkAngel.bottles), resupply: structuredClone(s.darkAngel.resupply),
  promotionWeek: s.darkAngel.promotionWeek!, acquisitionJournal: structuredClone(s.darkAngel.acquisitionJournal),
});
/** S1's actual continuation owns these spirits and old materials. Never refill
 * them from the frozen S2 roots or a former encounter's start snapshot. */
export const hangedManOriginalPeopleAndObjects = (s: SliceState): HangedManSource['originals'] => ({
  site: structuredClone(getDarkAngelCurrentSite(s)), operation: structuredClone(s.darkAngel.life.operation),
  grazing: structuredClone(s.shepherd.grazing), reserve: structuredClone(s.roseBishop.reserve),
});
export function hangedManSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'hanged-man' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的暗天使本人继续。';
  if (!validateDarkAngelState(s) || s.darkAngel.promotionWeek === null) return '原晋升、原人物与实际履历未通过核验。';
  const life = s.darkAngel.life;
  if (s.progression.acting !== 100 || !life.reflected || !DARK_ANGEL_CASE_IDS.every(id => {
    const c = life.cases[id];
    return c.status === 'RESOLVED' && c.returned && !c.contactOpen && c.attempts.length > 0 && life.journal.some(e => e.command.type === 'REPORT' && e.command.caseId === id);
  }) || !life.journal.some(e => e.command.type === 'REFLECT')) return '先完成暗天使三案的真实报告、反思与完整消化；普通完成同样有效。';
  if (hasDarkAngelLock(s) || hasDarkAngelOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧能力、归还原物并结束旧现场的接触。';
  const site = getDarkAngelCurrentSite(s), operation = life.operation;
  if (!['START', 'OUTSIDE'].includes(site.playerLocation) || site.activeCase !== null || !site.owner.alive || site.owner.location !== 'OUTSIDE' ||
      site.card.location !== 'TABLE' || site.lamp.on || site.shutter.state !== 'CLOSED' ||
      Object.values(site.spirits).some(spirit => spirit.status === 'GRAZED' && spirit.location !== 'INTERNAL') ||
      !operation.contained || operation.focus !== null || operation.suppressedUntil !== null ||
      operation.materials.some(material => material.status !== 'RETURNED' || material.location !== 'OWNER')) return '本人须在原入口或院外，玛拉实际在院外，原卡和旧耗材已归还，原灵已内收。';
  const first = s.darkAngel.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  const succession = HANGED_MAN_SUCCESSION;
  if (!first || compareGameDates(succession.death.date, succession.separation.date) > 0 ||
      compareGameDates(succession.separation.date, succession.custody.date) > 0 ||
      [succession.death.date, succession.separation.date, succession.custody.date].some(date => compareGameDates(date, first.date) >= 0)) return '前任死亡、析出与唯一性封存须各自早于本人最初取得成品指导。';
  const originals = resolveDarkAngelOriginalsSnapshot(s.darkAngel);
  if (!originals || originals.characteristics.length !== 3 || HANGED_MAN_ORIGINAL_IDS.some(id => originals.characteristics.filter(item => item.originalBottleId === id).length !== 1) ||
      originals.characteristics.filter(item => item.holder === 'EMBODIED').length !== 1 || !originals.embodiedOriginalBottleId || !originals.embodiedBottleId) return '须核清同一三份原特性和本体内实际晋升的一份，额外独立原瓶不能改名进入。';
  const embodied = originals.characteristics.find(item => item.originalBottleId === originals.embodiedOriginalBottleId);
  const consumed = embodied?.consumptionHistory.at(-1);
  if (embodied?.holder !== 'EMBODIED' || !consumed || consumed.bottleId !== originals.embodiedBottleId || consumed.week !== s.darkAngel.promotionWeek || !['SUCCESS', 'GREAT_SUCCESS'].includes(consumed.outcome)) return '本体内原特性须对应实际成功晋升的同一瓶与检定。';
  return null;
}
export function createHangedManSource(s: SliceState): HangedManSource {
  const reason = hangedManSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = hangedManAcquisitionSnapshot(s), originals = hangedManOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, character: structuredClone(s.character), budget: hangedManBudget(s),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: hangedManHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition, acquisitionDigest: digest(acquisition), originalCharacteristics: resolveDarkAngelOriginalsSnapshot(s.darkAngel)!,
  };
}
export function hangedManSourceView(s: SliceState, source: HangedManSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date), actionsRemaining: b.actions,
    cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality, status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random }, progression: { ...s.progression, pathwayId: 'hanged-man', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validateHangedManSource(s: SliceState, source: HangedManSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createHangedManSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision || source.random.seed !== s.random.seed ||
        source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 || source.historyDigest !== hangedManHistoryDigest(s) ||
        source.originalWorldDigest !== digest(s.world) || source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, hangedManOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, hangedManAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createHangedManSource(hangedManSourceView(s, source)), source);
  } catch { return false; }
}
