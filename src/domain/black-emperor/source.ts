import type { SliceState } from '../slice/types.js';
import { validatePrinceOfAbolitionState, hasPrinceOfAbolitionLock, hasPrinceOfAbolitionOldPractice, resolvePrinceOfAbolitionOriginalsSnapshot } from '../prince-of-abolition/index.js';
import { PRINCE_OF_ABOLITION_SOURCE_KEYS } from '../prince-of-abolition/types.js';
import { PRINCE_OF_ABOLITION_CASE_IDS, getPrinceOfAbolitionCurrentSite } from '../prince-of-abolition/life.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates } from '../game-calendar.js';
import { BLACK_EMPEROR_ORIGINAL_IDS, BLACK_EMPEROR_SUCCESSION } from './content.js';
import type { BlackEmperorBudget, BlackEmperorSource } from './types.js';
export type { BlackEmperorBudget, BlackEmperorFinance, BlackEmperorSource } from './types.js';

export const BLACK_EMPEROR_FROZEN_SOURCE_KEYS = [...PRINCE_OF_ABOLITION_SOURCE_KEYS, 'princeOfAbolition'] as const;
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const blackEmperorBudget = (s: SliceState): BlackEmperorBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const blackEmperorHistoryDigest = (s: SliceState): string => digest(Object.fromEntries(BLACK_EMPEROR_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
export const blackEmperorAcquisitionSnapshot = (s: SliceState) => ({
  bottles: structuredClone(s.princeOfAbolition.bottles), resupply: structuredClone(s.princeOfAbolition.resupply),
  promotionWeek: s.princeOfAbolition.promotionWeek!, acquisitionJournal: structuredClone(s.princeOfAbolition.acquisitionJournal),
});
/** Read the live S1 endpoint, never the frozen S2 room or encounter start. */
export const blackEmperorOriginalPeopleAndObjects = (s: SliceState): BlackEmperorSource['originals'] => ({
  site: structuredClone(getPrinceOfAbolitionCurrentSite(s)), operation: structuredClone(s.princeOfAbolition.life.operation),
  gifts: structuredClone(s.princeOfAbolition.gifts),
});
export function blackEmperorSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'black-emperor' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的弑序亲王本人继续。';
  if (!validatePrinceOfAbolitionState(s) || s.princeOfAbolition.promotionWeek === null) return '原晋升、原人物与实际履历未通过核验。';
  const life = s.princeOfAbolition.life;
  if (s.progression.acting !== 100 || !life.reflected || !PRINCE_OF_ABOLITION_CASE_IDS.every(id => {
    const c = life.cases[id];
    return c.status === 'RESOLVED' && c.returned && !c.contactOpen && c.attempts.length > 0 && c.attempts.every(a => a.closed && a.returned && a.verified && a.landed && a.retrieved) && life.journal.some(e => e.command.type === 'REPORT' && e.command.caseId === id);
  }) || !life.journal.some(e => e.command.type === 'REFLECT')) return '先完成弑序亲王三案的真实报告、反思与完整消化；普通完成同样有效。';
  if (hasPrinceOfAbolitionLock(s) || hasPrinceOfAbolitionOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧能力、归还原物并结束旧现场的接触。';
  const site = getPrinceOfAbolitionCurrentSite(s), operation = life.operation;
  const encounter = s.princeOfAbolition.encounter;
  if (!['START', 'OUTSIDE'].includes(site.playerLocation) || site.siteId !== 'FM3-DELIVERY-PRACTICE' || site.activeCase !== null ||
      site.volunteer.id !== 'FM3-DARIAN' || !site.volunteer.alive || !site.volunteer.independentMind || site.volunteer.location !== 'OUTSIDE' ||
      site.guide.id !== 'GUIDE' || site.guide.location !== 'OUTSIDE' ||
      site.parcel.id !== 'FM3-PARCEL' || site.parcel.massGrams !== 400 || !site.parcel.sealed ||
      site.ball.id !== 'FM3-PRACTICE-BALL' || site.ball.massGrams !== 80 || !site.ball.soft ||
      site.paper.id !== 'FM3-ROUTE-PAPER' || site.paper.text !== '从A到B' ||
      [site.parcel, site.ball, site.paper].some(item => item.owner !== 'GUIDE' || item.holder !== 'GUIDE' || item.location !== 'OUTSIDE' || item.quantity !== 1) ||
      !same(site.pads, [{ id: 'FM3-PAD-B', location: 'B', padded: true, people: 0 }, { id: 'FM3-PAD-C', location: 'C', padded: true, people: 0 }]) ||
      operation.door !== 'OPEN' || operation.inputActive || operation.flight !== null || life.activeCase !== null || life.pending !== null || life.flight !== null || life.viewBlocked ||
      life.pieces.some(piece => piece.location !== 'RETURNED') || encounter.directed !== null || encounter.maintenance !== null || encounter.pendingKind !== null || encounter.pendingEffects.length > 0)
    return '本人须在原门口或室外，达里安与米蕾已实际离场；同一原包、原球与原纸仍由米蕾亲持，室内原垫保持原位，旧输入、投球与待用短窗均已停止。';
  const first = s.princeOfAbolition.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  const succession = BLACK_EMPEROR_SUCCESSION;
  if (!first || succession.formerOwnerAlive || succession.currentIncumbent !== null || succession.objectCount !== 1 ||
      compareGameDates(succession.death.date, succession.separation.date) > 0 ||
      compareGameDates(succession.separation.date, succession.custody.date) > 0 ||
      [succession.death.date, succession.separation.date, succession.custody.date].some(date => compareGameDates(date, first.date) >= 0)) return '前任死亡、析出与唯一性封存须各自早于本人最初取得成品指导。';
  const originals = resolvePrinceOfAbolitionOriginalsSnapshot(s.princeOfAbolition);
  if (!originals || originals.characteristics.length !== 3 || BLACK_EMPEROR_ORIGINAL_IDS.some(id => originals.characteristics.filter(item => item.originalBottleId === id).length !== 1) ||
      originals.characteristics.filter(item => item.holder === 'EMBODIED').length !== 1 || !originals.embodiedOriginalBottleId || !originals.embodiedBottleId) return '须核清同一三份原特性和本体内实际晋升的一份，额外独立原瓶不能改名进入。';
  const embodied = originals.characteristics.find(item => item.originalBottleId === originals.embodiedOriginalBottleId);
  const consumed = embodied?.consumptionHistory.at(-1);
  if (embodied?.holder !== 'EMBODIED' || !consumed || consumed.bottleId !== originals.embodiedBottleId || consumed.week !== s.princeOfAbolition.promotionWeek || !['SUCCESS', 'GREAT_SUCCESS'].includes(consumed.outcome)) return '本体内原特性须对应实际成功晋升的同一瓶与检定。';
  return null;
}
export function createBlackEmperorSource(s: SliceState): BlackEmperorSource {
  const reason = blackEmperorSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = blackEmperorAcquisitionSnapshot(s), originals = blackEmperorOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, character: structuredClone(s.character), budget: blackEmperorBudget(s),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: blackEmperorHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition, acquisitionDigest: digest(acquisition), originalCharacteristics: resolvePrinceOfAbolitionOriginalsSnapshot(s.princeOfAbolition)!,
  };
}
export function blackEmperorSourceView(s: SliceState, source: BlackEmperorSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date), actionsRemaining: b.actions,
    cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality, status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random }, progression: { ...s.progression, pathwayId: 'black-emperor', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validateBlackEmperorSource(s: SliceState, source: BlackEmperorSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createBlackEmperorSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision || source.random.seed !== s.random.seed ||
        source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 || source.historyDigest !== blackEmperorHistoryDigest(s) ||
        source.originalWorldDigest !== digest(s.world) || source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, blackEmperorOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, blackEmperorAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createBlackEmperorSource(blackEmperorSourceView(s, source)), source);
  } catch { return false; }
}
