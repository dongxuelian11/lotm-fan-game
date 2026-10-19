import type { SliceState } from '../slice/types.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { compareGameDates } from '../game-calendar.js';
import { validateApocalypseDemonessState, hasApocalypseDemonessLock, hasApocalypseDemonessOldPractice, apocalypseDemonessOriginals } from '../apocalypse-demoness/index.js';
import { projectOriginalLineage } from '../apocalypse-demoness/source.js';
import type { ApocalypseDemonessOriginalCharacteristics } from '../apocalypse-demoness/types.js';
import type { DemonessBudget, DemonessFinance } from './types.js';
import { DEMONESS_SUCCESSION } from './content.js';
export const DEMONESS_FROZEN_SOURCE_KEYS = ['assassin', 'instigator', 'witch', 'pleasure', 'pain', 'despair', 'unagingDemoness', 'calamityDemoness', 'apocalypseDemoness'] as const;
export const demonessDigest = (value: unknown): string => sha256Hex(stableStringify(value));
export const sameDemoness = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);
export const demonessHistoryDigest = (s: SliceState): string => demonessDigest(Object.fromEntries(DEMONESS_FROZEN_SOURCE_KEYS.map(k => [k, s[k]])));
export const demonessBudget = (s: SliceState): DemonessBudget => ({
  week: s.week, date: structuredClone(s.date), actions: s.actionsRemaining, cash: s.cash, health: s.health, mind: s.mind,
  spirituality: s.spirituality, pollution: s.seer.pollution, injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk,
  status: s.status, sequence: s.progression.sequence as 1 | 0, acting: s.progression.acting,
  mastery: { ...s.progression.mastery }, coreStats: { ...s.character.coreStats }, completedSources: [...s.seer.completedSources],
});
export const demonessOriginalPeopleAndObjects = (s: SliceState) => ({
  // At the actual 688 S2 boundary the authority is encounter.currentSite.
  // After the genuine S1 route the S1 life owns the continuing live originals.
  inheritedAtGuidance: structuredClone(s.apocalypseDemoness.sourceScene!.originals),
  liveSite: structuredClone(s.apocalypseDemoness.life.site!),
  life: structuredClone(s.apocalypseDemoness.life), encounter: structuredClone(s.apocalypseDemoness.encounter),
});
export interface DemonessSource {
  runId: string; actorId: string; revision: number; budget: DemonessBudget; finance: DemonessFinance;
  character: SliceState['character']; random: SliceState['random']; historyDigest: string; originalWorldDigest: string;
  combatHistoryLength: number; combatHistoryDigest: string; originals: ReturnType<typeof demonessOriginalPeopleAndObjects>;
  originalsDigest: string; actualS1PromotionWeek: number; originalCharacteristics: ApocalypseDemonessOriginalCharacteristics;
  bottles: SliceState['apocalypseDemoness']['bottles'];
}
export function demonessSourceBlock(s: SliceState): string | null {
  if (s.progression.pathwayId !== 'demoness' || s.progression.sequence !== 1 || s.status !== 'ACTIVE') return '须由已经真正晋升、仍活着的末日魔女本人继续。';
  if (!validateApocalypseDemonessState(s) || s.apocalypseDemoness.promotionWeek === null) return '原晋升、失败原瓶、八阶来源及实际行动尚未通过核验。';
  const a = s.apocalypseDemoness;
  if (s.progression.acting !== 100 || !a.life.reflected || Object.values(a.life.cases).some(c => c.status !== 'RESOLVED' || c.contactOpen || !c.returned)) return '先完成末日魔女三份真实实践、反思与完整消化。';
  if (hasApocalypseDemonessLock(s) || hasApocalypseDemonessOldPractice(s) || s.combat || s.activeEvent || s.eventQueue.length || s.pulse !== 'NONE') return '先完成旧现场清理，逐人沿普通道路真正离开。';
  if (s.world.city !== 'BACKLUND') return '本人须实际回到贝克兰德。';
  if (!a.sourceScene || !sameDemoness(a.sourceScene.originals, apocalypseDemonessOriginals(s))) return '原展廊的权威承接原物与实际指导记录不一致。';
  const p = a.life.site;
  if (!p || p.playerLocation !== 'OUTSIDE' || p.vera?.location !== 'OUTSIDE' || p.marcus?.location !== 'OUTSIDE' || !p.vera.alive || !p.marcus.alive || p.screen.active || p.box.state !== 'CLOSED') return '原成人与本人须实际在室外，原镜与原箱的持续作用须已经停止。';
  const guidance = a.acquisitionJournal.find(e => e.command.type === 'LEARN_GUIDANCE');
  if (!guidance || compareGameDates(DEMONESS_SUCCESSION.custody.date, guidance.date) >= 0) return '原供货日期尚未晚于前任退出与同物封存，不能把未解锁库存当作既成供货。';
  const lineage = projectOriginalLineage(a);
  if (!lineage || lineage.characteristics.length !== 3 || !lineage.embodiedBottleId || !lineage.embodiedOriginalBottleId || lineage.characteristics.filter(x => x.holder === 'EMBODIED').length !== 1) return '三份原特性的真实血缘或去向尚不完整；历史独立第四份不能改标成回收件。';
  return null;
}
export function createDemonessSource(s: SliceState): DemonessSource {
  const reason = demonessSourceBlock(s); if (reason) throw Error(reason);
  const originals = demonessOriginalPeopleAndObjects(s);
  return { runId: s.runId, actorId: `${s.runId}:original-player`, revision: s.revision, budget: demonessBudget(s),
    finance: structuredClone({ weeklyBudget: s.weeklyBudget, wagePaidWeek: s.wagePaidWeek, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier, debts: s.debts, missedWeeks: s.missedWeeks, credit: s.credit }),
    character: structuredClone(s.character), random: { ...s.random }, historyDigest: demonessHistoryDigest(s), originalWorldDigest: demonessDigest(s.world),
    combatHistoryLength: s.combatHistory.length, combatHistoryDigest: demonessDigest(s.combatHistory), originals, originalsDigest: demonessDigest(originals),
    actualS1PromotionWeek: s.apocalypseDemoness.promotionWeek!, originalCharacteristics: structuredClone(projectOriginalLineage(s.apocalypseDemoness)!), bottles: structuredClone(s.apocalypseDemoness.bottles) };
}
/** Read-only frozen predecessor view; identities, gender, NPCs and consumed stock are not edited. */
export function demonessSourceView(s: SliceState, source: DemonessSource): SliceState {
  const b = source.budget;
  return { ...s, ...structuredClone(source.finance), revision: source.revision, week: b.week, date: structuredClone(b.date),
    actionsRemaining: b.actions, cash: b.cash, health: b.health, mind: b.mind, spirituality: b.spirituality, status: b.status,
    injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, character: structuredClone(source.character), random: { ...source.random },
    progression: { ...s.progression, pathwayId: 'demoness', sequence: 1, acting: b.acting, mastery: { ...b.mastery } },
    seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, combat: null, activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0, ending: null };
}
export function validateDemonessSource(s: SliceState, source: DemonessSource, phase: 'HANDOFF' | 'COLD_REOPEN'): boolean {
  try {
    if (phase === 'HANDOFF') return sameDemoness(createDemonessSource(s), source);
    if (source.runId !== s.runId || source.actorId !== `${s.runId}:original-player` || source.revision > s.revision || source.budget.status !== 'ACTIVE' || source.budget.sequence !== 1 ||
      source.random.seed !== s.random.seed || source.random.cursor > s.random.cursor || source.historyDigest !== demonessHistoryDigest(s) || source.originalWorldDigest !== demonessDigest(s.world) ||
      source.combatHistoryLength !== s.combatHistory.length || source.combatHistoryDigest !== demonessDigest(s.combatHistory) || source.originalsDigest !== demonessDigest(source.originals) ||
      !sameDemoness(source.originals, demonessOriginalPeopleAndObjects(s))) return false;
    return sameDemoness(createDemonessSource(demonessSourceView(s, source)), source);
  } catch { return false; }
}
