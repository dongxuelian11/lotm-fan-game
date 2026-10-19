import type { SliceState } from '../slice/types.js';
import { validateNatureWalkerState, hasNatureWalkerLock, resolveNatureWalkerOriginalsSnapshot } from '../nature-walker/index.js';
import { NATURE_WALKER_SOURCE_KEYS } from '../nature-walker/types.js';
import { NATURE_WALKER_CASE_IDS, getNatureWalkerCurrentSite } from '../nature-walker/life.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates } from '../game-calendar.js';
import { MOTHER_ORIGINAL_IDS, MOTHER_SUCCESSION } from './content.js';
import type { MotherBudget, MotherSource } from './types.js';
export type { MotherBudget, MotherFinance, MotherSource } from './types.js';

export const MOTHER_FROZEN_SOURCE_KEYS = [...NATURE_WALKER_SOURCE_KEYS, 'natureWalker'] as const;
const digest = (value: unknown): string => sha256Hex(stableStringify(value));
const same = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const motherBudget = (s: SliceState): MotherBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash,
  health: s.health, mind: s.mind, spirituality: s.spirituality, pollution: s.seer.pollution,
  injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk, status: s.status,
  sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const motherHistoryDigest = (s: SliceState): string => digest(Object.fromEntries(MOTHER_FROZEN_SOURCE_KEYS.map(key => [key, s[key]])));
export const motherAcquisitionSnapshot = (s: SliceState) => ({
  bottles: structuredClone(s.natureWalker.bottles), resupply: structuredClone(s.natureWalker.resupply),
  promotionWeek: s.natureWalker.promotionWeek!, promotionDate: structuredClone(s.natureWalker.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.week === s.natureWalker.promotionWeek && e.check && ['SUCCESS', 'GREAT_SUCCESS'].includes(e.check.tier))!.date), acquisitionJournal: structuredClone(s.natureWalker.acquisitionJournal),
});
/** Read the live S1 endpoint, never the frozen S2 room or encounter start. */
export const motherOriginalPeopleAndObjects = (s: SliceState): MotherSource['originals'] => ({
  site: structuredClone(s.natureWalker.life.site!), operation: structuredClone(s.natureWalker.life.operation),
  rootPad: structuredClone(s.natureWalker.life.rootPad!),
});
export function motherSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'mother' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由仍活着的自然行者本人继续。';
  if (!validateNatureWalkerState(s) || s.natureWalker.promotionWeek === null) return '原晋升、原人物与实际履历未通过核验。';
  const life = s.natureWalker.life;
  if (s.progression.acting !== 100 || !life.reflected || !NATURE_WALKER_CASE_IDS.every(id => {
    const c = life.cases[id];
    return c.status === 'RESOLVED' && c.returned && !c.contactOpen && c.attempts.length > 0 && life.journal.some(e => e.command.type === 'REPORT' && e.command.caseId === id);
  }) || !life.journal.some(e => e.command.type === 'REFLECT')) return '先完成自然行者三案的真实报告、反思与完整消化；普通完成同样有效。';
  // The authenticated S2 checkpoint owns predecessor locks; their exact-stage
  // guards deliberately reject a raw S1. New S1 locks and objects stay live.
  if (hasNatureWalkerLock(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先停止旧能力、归还原物并结束旧现场的接触。';
  const site = life.site, operation = life.operation, pad = life.rootPad;
  if (!site || !pad || !['START', 'OUTSIDE'].includes(site.playerLocation) || site.activeCase !== null || life.activeCase !== null ||
      site.owner.id !== 'CB3-ADA' || site.owner.age !== 46 || !site.owner.alive || !site.owner.independentMind || site.owner.location !== 'OUTSIDE' ||
      site.recipient.id !== 'CB3-LENA' || site.recipient.age !== 39 || !site.recipient.alive || !site.recipient.independentMind || site.recipient.location !== 'OUTSIDE' ||
      site.samples.length !== 3 || !['CB3-LIVE-1', 'CB3-LIVE-2'].every(id => site.samples.some(p => p.id === id && p.alive && p.vitality > 0 && p.quantity === 1 && p.location === 'OUTSIDE' && p.holder === (id === 'CB3-LIVE-1' ? 'RECIPIENT' : 'OWNER'))) ||
      !site.samples.some(p => p.id === 'CB3-DRY-1' && !p.alive && p.vitality === 0 && p.massGrams === 100 && p.quantity === 1 && p.holder === 'OWNER' && p.location === 'OUTSIDE') ||
      [site.paper, site.box, site.tag, ...site.pads].some(p => p.holder !== 'OWNER' || p.location !== 'OUTSIDE') || site.box.sampleId !== null ||
      pad.id !== 'BM2-ROOT-PAD' || pad.owner !== 'PLAYER' || pad.holder !== 'PLAYER' || pad.location !== site.playerLocation ||
      Object.values(operation).some(value => value !== null)) return '须本人在原入口或室外；艾达与莉娜在室外实际持有两株原活苗，原枯样仍死，原匣、牌、纸与片均已归存，原根垫仍由本人持有，旧作用已经停止。';
  const first = s.natureWalker.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  const succession = MOTHER_SUCCESSION;
  if (!first || compareGameDates(succession.death.date, succession.separation.date) > 0 ||
      compareGameDates(succession.separation.date, succession.custody.date) > 0 ||
      [succession.death.date, succession.separation.date, succession.custody.date].some(date => compareGameDates(date, first.date) >= 0)) return '前任死亡、析出与唯一性封存须各自早于本人最初取得成品指导。';
  const originals = resolveNatureWalkerOriginalsSnapshot(s.natureWalker);
  if (!originals || originals.characteristics.length !== 3 || MOTHER_ORIGINAL_IDS.some(id => originals.characteristics.filter(item => item.originalBottleId === id).length !== 1) ||
      originals.characteristics.filter(item => item.holder === 'EMBODIED').length !== 1 || !originals.embodiedOriginalBottleId || !originals.embodiedBottleId) return '须核清同一三份原特性和本体内实际晋升的一份，额外独立原瓶不能改名进入。';
  const embodied = originals.characteristics.find(item => item.originalBottleId === originals.embodiedOriginalBottleId);
  const consumed = embodied?.consumptionHistory.at(-1);
  if (embodied?.holder !== 'EMBODIED' || !consumed || consumed.bottleId !== originals.embodiedBottleId || consumed.week !== s.natureWalker.promotionWeek || !['SUCCESS', 'GREAT_SUCCESS'].includes(consumed.outcome)) return '本体内原特性须对应实际成功晋升的同一瓶与检定。';
  return null;
}
export function createMotherSource(s: SliceState): MotherSource {
  const reason = motherSourceBlock(s); if (reason) throw Error(reason);
  const acquisition = motherAcquisitionSnapshot(s), originals = motherOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, character: structuredClone(s.character), budget: motherBudget(s),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    random: { ...s.random }, historyDigest: motherHistoryDigest(s), originalWorldDigest: digest(s.world), combatHistoryLength: s.combatHistory.length,
    combatHistoryDigest: digest(s.combatHistory), originals, originalsDigest: digest(originals), acquisition, acquisitionDigest: digest(acquisition), originalCharacteristics: resolveNatureWalkerOriginalsSnapshot(s.natureWalker)!,
  };
}
export function motherSourceView(s: SliceState, source: MotherSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date), actionsRemaining: b.actions,
    cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality, status: b.status, injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk,
    character: structuredClone(source.character), random: { ...source.random }, progression: { ...s.progression, pathwayId: 'mother', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, combatHistory: s.combatHistory.slice(0, source.combatHistoryLength),
    combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null,
  };
}
export function validateMotherSource(s: SliceState, source: MotherSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return same(createMotherSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision || source.random.seed !== s.random.seed ||
        source.random.cursor > s.random.cursor || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 || source.historyDigest !== motherHistoryDigest(s) ||
        source.originalWorldDigest !== digest(s.world) || source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== digest(s.combatHistory) ||
        !same(source.originals, motherOriginalPeopleAndObjects(s)) || source.originalsDigest !== digest(source.originals) ||
        !same(source.acquisition, motherAcquisitionSnapshot(s)) || source.acquisitionDigest !== digest(source.acquisition)) return false;
    return same(createMotherSource(motherSourceView(s, source)), source);
  } catch { return false; }
}
