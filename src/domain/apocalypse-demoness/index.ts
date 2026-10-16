import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ASSASSIN_ABILITY_IDS } from '../assassin/types.js';
import { INSTIGATOR_ABILITY_IDS } from '../instigator/types.js';
import { WITCH_ABILITY_IDS } from '../witch/types.js';
import { PLEASURE_ABILITY_IDS } from '../pleasure/types.js';
import { PAIN_ABILITY_IDS } from '../pain/types.js';
import { DESPAIR_ABILITY_IDS } from '../despair/types.js';
import { UNAGING_DEMONESS_ABILITY_IDS } from '../unaging-demoness/types.js';
import { CALAMITY_DEMONESS_ABILITY_IDS } from '../calamity-demoness/types.js';
import { hasCalamityDemonessLock, hasCalamityDemonessOldSceneLock } from '../calamity-demoness/index.js';
import { validateCalamityDemonessSiteState } from '../calamity-demoness/life.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks, compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createApocalypseDemonessLifeState, initializeApocalypseDemonessLifeState, applyApocalypseDemonessLifeCommand, projectApocalypseDemonessLife, apocalypseDemonessLifeActions, validateApocalypseDemonessLifeState, validateApocalypseDemonessActivityCommand, hasApocalypseDemonessLifeLock, apocalypseDemonessLifeMasteryGains } from './life.js';
import { createApocalypseDemonessEncounterState, applyApocalypseDemonessEncounterCommand, projectApocalypseDemonessEncounter, apocalypseDemonessEncounterActions, validateApocalypseDemonessEncounterState, validateApocalypseDemonessEncounterCommand, hasApocalypseDemonessEncounterLock } from './encounter.js';
import { APOCALYPSE_DEMONESS_ABILITIES, APOCALYPSE_DEMONESS_INHERITED_ABILITIES, APOCALYPSE_DEMONESS_BOTTLE_IDS, APOCALYPSE_DEMONESS_CONSUMPTION_RISK, APOCALYPSE_DEMONESS_FORMULA_STATUS, APOCALYPSE_DEMONESS_GUIDE, APOCALYPSE_DEMONESS_LABOUR_STEPS, APOCALYPSE_DEMONESS_LABOUR_TASKS, APOCALYPSE_DEMONESS_MIN_CALAMITY_DEMONESS_WEEKS, APOCALYPSE_DEMONESS_POTION_SOURCES, APOCALYPSE_DEMONESS_PREPARATIONS, APOCALYPSE_DEMONESS_PRICES, APOCALYPSE_DEMONESS_SOURCE_STATUS } from './content.js';
import { APOCALYPSE_DEMONESS_ABILITY_IDS, APOCALYPSE_DEMONESS_PREPARATION_IDS, APOCALYPSE_DEMONESS_SOURCE_KEYS, type ApocalypseDemonessFinanceSnapshot, type ApocalypseDemonessOriginals, type ApocalypseDemonessSourceHistory, type ApocalypseDemonessAcquisitionBudget, type ApocalypseDemonessAcquisitionEvent, type ApocalypseDemonessAcquisitionCommand, type ApocalypseDemonessAction, type ApocalypseDemonessBottle, type ApocalypseDemonessCommand, type ApocalypseDemonessProjection, type ApocalypseDemonessState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const APOCALYPSE_DEMONESS_INHERITED_ABILITY_IDS = [...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS, ...WITCH_ABILITY_IDS, ...PLEASURE_ABILITY_IDS, ...PAIN_ABILITY_IDS, ...DESPAIR_ABILITY_IDS, ...UNAGING_DEMONESS_ABILITY_IDS, ...CALAMITY_DEMONESS_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = APOCALYPSE_DEMONESS_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): ApocalypseDemonessBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createApocalypseDemonessState(): ApocalypseDemonessState {
  return { guidanceKnown: false, bottles: APOCALYPSE_DEMONESS_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, calamityDemonessActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], sourceHistory: null, sourceScene: null, life: createApocalypseDemonessLifeState(), encounter: createApocalypseDemonessEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isApocalypseDemoness = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 1;
export const isApocalypseDemonessAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 2;
export const hasApocalypseDemonessHistory = (s: SliceState) => isApocalypseDemoness(s) && s.apocalypseDemoness.promotionWeek !== null;
/** Validate each actual predecessor's consumed independent bottle without inventing past play. */
function sourceHistory(s: SliceState): boolean {
  if (!s.assassin.discovered || !s.assassin.guidanceKnown || s.character.gender !== 'FEMALE' || s.witch.previousGender === null) return false;
  const first = s.assassin.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || !integer(first[0]!.consumedWeek, 1, s.week) || first[0]!.consumedWeek !== s.progression.promotionWeek ||
    !integer(first[0]!.acquiredWeek, 1, first[0]!.consumedWeek)) return false;
  let previous = first[0]!.consumedWeek!;
  const instigator = s.instigator, instigatorBottle = instigator.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (!instigator.guidanceKnown || !integer(instigator.promotionWeek, previous, s.week) || instigatorBottle.length !== 1 ||
    instigatorBottle[0]!.consumedWeek !== instigator.promotionWeek || !integer(instigatorBottle[0]!.acquiredWeek, previous, instigator.promotionWeek)) return false;
  previous = instigator.promotionWeek;
  for (const stage of [s.witch, s.pleasure]) {
    if (!stage.formulaKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || !integer(bottles[0]!.brewedWeek, previous, stage.promotionWeek)) return false;
    const bottle = bottles[0]!, batch = stage.batches.find(b => b.id === bottle.batchId);
    if (!batch || !batch.acquired || !batch.brewed || !batch.materials.length || bottle.inputIds.length !== batch.materials.length ||
      new Set(bottle.inputIds).size !== bottle.inputIds.length || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id) ||
      batch.materials.some(m => m.holder !== 'CONSUMED' || m.quantity !== 0)) return false;
    previous = stage.promotionWeek;
  }
  for (const stage of [s.pain, s.despair, s.unagingDemoness, s.calamityDemoness]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.instigator.assassinActingAtPromotion === 100 && s.witch.instigatorActingAtPromotion === 100 &&
    s.pleasure.witchActingAtPromotion === 100 && s.pain.pleasureActingAtPromotion === 100 &&
    s.despair.painActingAtPromotion === 100 && s.unagingDemoness.despairActingAtPromotion === 100 && s.calamityDemoness.unagingDemonessActingAtPromotion === 100;
}
export function apocalypseDemonessSourceHistory(s: SliceState): ApocalypseDemonessSourceHistory {
  return Object.fromEntries(APOCALYPSE_DEMONESS_SOURCE_KEYS.map(key => [key, structuredClone(s[key])])) as ApocalypseDemonessSourceHistory;
}
function sourceHistoryDigest(s: SliceState): string {
  return sha256Hex(stableStringify(s.apocalypseDemoness.sourceHistory ?? apocalypseDemonessSourceHistory(s)));
}
function sourceIdentityDigest(s: SliceState): string {
  const { coreStats: _stats, ...identity } = s.character;
  return sha256Hex(stableStringify(identity));
}
const knownChannel = (s: SliceState) => (isApocalypseDemonessAcquisitionStage(s) || isApocalypseDemoness(s)) && sourceHistory(s);
/** Old commands close at S1; their completed records are retained exactly. */
export function hasApocalypseDemonessOldPractice(s: SliceState): boolean {
  return hasCalamityDemonessOldSceneLock(s) || hasCalamityDemonessLock(s);
}
const calamityDemonessReportsComplete = (s: SliceState) => s.calamityDemoness.life.reflected &&
  Object.keys(s.calamityDemoness.life.cases).length === 3 && Object.values(s.calamityDemoness.life.cases).every(c =>
    c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.closes === 1 && c.attempts.length > 0 &&
    c.attempts.every(attempt => attempt.week <= s.week) && c.attempts.at(-1)!.closed && c.attempts.at(-1)!.inspected &&
    c.attempts.at(-1)!.plateReturned);
/** Frozen provenance only. After promotion, new-stage life/encounter own the
 * continuing originals; this accessor never reads their live state as history. */
export const apocalypseDemonessOriginals = (s: SliceState): ApocalypseDemonessOriginals => structuredClone({
  site: s.calamityDemoness.encounter.currentSite ?? s.calamityDemoness.life.site,
  combatPlate: s.calamityDemoness.encounter.plate,
});
export const hasApocalypseDemonessOldSceneLock = hasApocalypseDemonessOldPractice;
export const hasApocalypseDemonessRitualLock = (s: SliceState): boolean => s.apocalypseDemoness.preparedWeek !== null;
export const hasApocalypseDemonessLock = (s: SliceState): boolean => hasApocalypseDemonessRitualLock(s) || hasApocalypseDemonessLifeLock(s) || hasApocalypseDemonessEncounterLock(s);
const bottleNumber = (b: Pick<ApocalypseDemonessBottle, 'id'>) => Number(b.id.slice('apocalypse-demoness-potion-'.length));
const potionPrice = (b: ApocalypseDemonessBottle) => APOCALYPSE_DEMONESS_PRICES.potion - (b.labourSteps === APOCALYPSE_DEMONESS_LABOUR_STEPS ? APOCALYPSE_DEMONESS_PRICES.labourCredit : 0);
const calamityDemonessWeeks = (s: SliceState) => Math.max(0, (s.apocalypseDemoness.promotionWeek ?? s.week) - (s.calamityDemoness.promotionWeek ?? s.week));
const exhaustedSupply = (state: ApocalypseDemonessState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${APOCALYPSE_DEMONESS_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列1末日魔女成品，独立封存编号apocalypse-demoness-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => APOCALYPSE_DEMONESS_PREPARATION_IDS.every(id => s.apocalypseDemoness.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `灾难魔女魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.calamityDemoness.promotionWeek === null || calamityDemonessWeeks(s) < APOCALYPSE_DEMONESS_MIN_CALAMITY_DEMONESS_WEEKS) return `成为灾难魔女后已过${calamityDemonessWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!calamityDemonessReportsComplete(s)) return '先完成灾难魔女的三份实际报告与反思，并收好旧展廊现场。';
  return hasPreparations(s) ? null : '先分别核对八阶实际来源与既往报告、原镜及有限来源边界和普通返回路线；领取药瓶不能代做专业准备。';
}
export function validateApocalypseDemonessAcquisitionCommand(v: unknown): v is ApocalypseDemonessAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && APOCALYPSE_DEMONESS_PREPARATION_IDS.includes(v.taskId as typeof APOCALYPSE_DEMONESS_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^apocalypse-demoness-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isApocalypseDemonessAcquisitionCommand = validateApocalypseDemonessAcquisitionCommand;
export function validateApocalypseDemonessCommand(v: unknown): v is ApocalypseDemonessCommand {
  return validateApocalypseDemonessAcquisitionCommand(v) || validateApocalypseDemonessActivityCommand(v) || validateApocalypseDemonessEncounterCommand(v);
}
export function apocalypseDemonessAcquisitionBlock(s: SliceState, command: ApocalypseDemonessAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: ApocalypseDemonessAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateApocalypseDemonessAcquisitionCommand(command)) return '末日魔女准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasApocalypseDemonessOldPractice(s)) || hasApocalypseDemonessLifeLock(s) || hasApocalypseDemonessEncounterLock(s)) return '先停止旧现场的接触和能力、归还原物，再沿普通路线离开；旧人物、伤势与实战后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原展廊附室旁的安静交接处。';
  if (!knownChannel(s)) return '实际成为灾难魔女并保留原指导渠道后，才能了解末日魔女之路。';
  const originalSite = s.calamityDemoness.encounter.currentSite;
  if (!originalSite || originalSite.playerLocation !== 'OUTSIDE' || originalSite.vera?.location !== 'OUTSIDE' || originalSite.marcus?.location !== 'OUTSIDE' || originalSite.screen.active || originalSite.box.state !== 'CLOSED' || originalSite.plates.some(plate => plate.status !== 'RETURNED' || plate.location !== 'CUSTODIAN')) return '须本人和两名原成人都已沿普通路线离开原附室与旧庭院，收好原箱并归还旧护片，再办理本次交接。';
  if (!isApocalypseDemonessAcquisitionStage(s)) return '已经晋升末日魔女1，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '刺客至灾难魔女的18项掌握记录不完整，暂不能继续晋升。';
  const state = s.apocalypseDemoness;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE' && !calamityDemonessReportsComplete(s)) return '先完成灾难魔女三份生活报告与反思，再核对这次晋升的既往记录。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < APOCALYPSE_DEMONESS_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的末日魔女原瓶。';
    return s.cash < APOCALYPSE_DEMONESS_PRICES.preparation ? '当次场地检查需要150便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY' && s.cash < APOCALYPSE_DEMONESS_PRICES.resupply) return '申请下一批需要100便士实际费用。';
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批末日魔女原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的末日魔女准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选末日魔女独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与150便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= APOCALYPSE_DEMONESS_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: ApocalypseDemonessAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.apocalypseDemoness;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      state.sourceHistory = apocalypseDemonessSourceHistory(s);
      state.sourceScene = { week: s.week, date: structuredClone(s.date), revision: s.revision, random: { ...s.random },
        budget: acquisitionBudget(s), finance: apocalypseDemonessFinanceSnapshot(s), identityDigest: sourceIdentityDigest(s), historyDigest: sourceHistoryDigest(s),
        character: structuredClone(s.character), originals: apocalypseDemonessOriginals(s), combatHistoryLength: s.combatHistory.length, combatHistoryDigest: sha256Hex(stableStringify(s.combatHistory)), city: 'BACKLUND' };
      s.actionsRemaining--; s.cash -= APOCALYPSE_DEMONESS_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取末日魔女独立成品与专业准备指导', `花1行动、500便士。${APOCALYPSE_DEMONESS_GUIDE}说明原渠道记录。${APOCALYPSE_DEMONESS_FORMULA_STATUS}${APOCALYPSE_DEMONESS_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = APOCALYPSE_DEMONESS_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= APOCALYPSE_DEMONESS_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、150便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与150便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(APOCALYPSE_DEMONESS_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款1100便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('末日魔女独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; s.cash -= APOCALYPSE_DEMONESS_PRICES.resupply; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批末日魔女成品', `原瓶全部失败耗尽，花1行动与100便士核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < APOCALYPSE_DEMONESS_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`apocalypse-demoness-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶末日魔女原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6600便士或对应五项劳动后1100便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.calamityDemonessActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 1; s.progression.acting = 0;
        if (!s.seer.completedSources.includes('demoness-s1')) s.seer.completedSources.push('demoness-s1');
        initializeApocalypseDemonessLifeState(s);
        for (const id of APOCALYPSE_DEMONESS_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为末日魔女', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；灾难魔女消化100与原18项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满。性别、姓名、年龄、性格与取向不改写。旧伤、原人及受托物、过去八阶的原瓶、劳务与实际结果全部留存。同一对原镜、原箱与旧焦痕保留；维瑞娜和马库斯保留各自真实位置与精力，旧护片归还状态与原战斗镜片剩余次数均不变。耗尽的旧负载和旧残留不补回，旧许可不续用。伊瑞丝按原身体、判断、位置与消耗留在原庭院；旧人的死亡、遗物与投降结果各自保留。晋升不治疗或移动任何原人原物。本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '末日魔女魔药严重排异' : '末日魔女魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为灾难魔女，旧消化、掌握、服药前性别、身体伤势与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、150便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): ApocalypseDemonessAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
/** Snapshot the real ordinary economy; neither potion preparation nor a zero-AP
 * command creates a parallel wallet or next week's allowance. */
export function apocalypseDemonessFinanceSnapshot(s: ApocalypseDemonessFinanceSnapshot): ApocalypseDemonessFinanceSnapshot {
  return { weeklyBudget: s.weeklyBudget, lifeTier: s.lifeTier, nextLifeTier: s.nextLifeTier,
    debts: structuredClone(s.debts), missedWeeks: s.missedWeeks, credit: s.credit };
}
export function validateApocalypseDemonessFinanceSnapshot(v: unknown, week: number): v is ApocalypseDemonessFinanceSnapshot {
  if (!record(v) || !shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) ||
    !integer(v.weeklyBudget, 1, 100) || typeof v.lifeTier !== 'string' || !Object.hasOwn(SLICE_LIFE, v.lifeTier) ||
    typeof v.nextLifeTier !== 'string' || !Object.hasOwn(SLICE_LIFE, v.nextLifeTier) || !integer(v.missedWeeks) ||
    !['NORMAL', 'NOTICE', 'SUSPENDED'].includes(String(v.credit)) || !Array.isArray(v.debts)) return false;
  return new Set(v.debts.map(d => record(d) ? d.id : null)).size === v.debts.length && v.debts.every(d =>
    record(d) && shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) &&
    typeof d.id === 'string' && d.id.length > 0 && typeof d.source === 'string' && d.source.length > 0 &&
    integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
function acquisitionBoundary(e: ApocalypseDemonessAcquisitionEvent) {
  const budget = structuredClone(e.after), finance = structuredClone(e.finance);
  if (budget.actions > 0 || e.command.type === 'PREPARE_PROMOTION') return { budget, finance, week: e.week,
    date: e.date, pulse: 'NONE' as const, billAmount: 0, eventId: null, receipts: [] as { week: number; title: string; text: string }[] };
  const result = resolveSliceWeeklyFinance({ ...finance, cash: budget.cash, week: e.week, revision: e.revision, pulse: 'BILL', billAmount: 0 });
  const advanced = result.eventId === null && result.state.pulse === 'ADVANCE';
  const receipts = result.receipts.map(r => ({ week: e.week, ...r }));
  if (advanced) receipts.push({ week: e.week + 1, title: '新的一周', text: `日期推进7天，本周${finance.weeklyBudget}次行动。` });
  return { budget: { ...budget, cash: result.state.cash, actions: advanced ? finance.weeklyBudget : 0 },
    finance: apocalypseDemonessFinanceSnapshot({ ...finance, ...result.state, lifeTier: advanced ? result.state.nextLifeTier : finance.lifeTier }),
    week: e.week + (advanced ? 1 : 0), date: advanced ? addGameWeeks(e.date, 1) : e.date,
    pulse: advanced ? 'NONE' as const : result.state.pulse, billAmount: advanced ? 0 : result.state.billAmount,
    eventId: result.eventId, receipts };
}
function adjacentAcquisitionsMatch(previous: ApocalypseDemonessAcquisitionEvent, next: ApocalypseDemonessAcquisitionEvent): boolean {
  const expected = acquisitionBoundary(previous);
  return next.week === expected.week && same(next.date, expected.date) && next.cursorBefore === previous.cursorAfter &&
    same(next.before, expected.budget) && same(next.finance, expected.finance) && expected.eventId === null;
}
export function apocalypseDemonessCompletedAcquisitionBudgetMatches(s: SliceState, e: ApocalypseDemonessAcquisitionEvent): boolean {
  const expected = acquisitionBoundary(e);
  if (!same(acquisitionBudget(s), expected.budget) || !same(apocalypseDemonessFinanceSnapshot(s), expected.finance) ||
    s.week !== expected.week || !same(s.date, expected.date) || s.random.cursor !== e.cursorAfter ||
    s.pulse !== expected.pulse || s.billAmount !== expected.billAmount || s.eventQueue.length > 0 || s.combat !== null) return false;
  if (expected.eventId === null ? s.activeEvent !== null : s.activeEvent?.id !== expected.eventId) return false;
  const titles = ['本周生活费', '生活费如实记账', '本周约定还款', '账目结清', '新的一周'];
  const receipts = s.chronicle.filter((entry, index) => entry.id === `record-${s.revision}-${index}` && titles.includes(entry.title));
  return same(receipts.map(({ week, title, text }) => ({ week, title, text })), expected.receipts);
}
function ordinaryCoreGrowth(before: SliceState['character']['coreStats'], after: SliceState['character']['coreStats']): boolean {
  return before.physique === after.physique && before.perception === after.perception && before.will === after.will &&
    integer(after.knowledge, before.knowledge, Math.max(before.knowledge, 20));
}
function acquisitionState(state: ApocalypseDemonessState) {
  return { guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, calamityDemonessActingAtPromotion: state.calamityDemonessActingAtPromotion, sourceHistory: state.sourceHistory, sourceScene: state.sourceScene,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyApocalypseDemonessAcquisition(s: SliceState, command: ApocalypseDemonessAcquisitionCommand, ctx: SeerContext): void {
  const reason = apocalypseDemonessAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const cursorBefore = s.random.cursor, before = acquisitionBudget(s), actor: ApocalypseDemonessAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, age: s.character.age, sourceIdentityDigest: sourceIdentityDigest(s), sourceHistoryDigest: ['LEARN_GUIDANCE', 'CONSUME'].includes(command.type) ? sourceHistoryDigest(s) : null, pathwayId: 'demoness',
    calamityDemonessPromotionWeek: s.calamityDemoness.promotionWeek!, assassinPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.apocalypseDemoness.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: acquisitionBudget(s), finance: apocalypseDemonessFinanceSnapshot(s), cursorBefore, cursorAfter: s.random.cursor, randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is ApocalypseDemonessAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    !['MALE', 'FEMALE'].includes(String(v.gender)) || (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? APOCALYPSE_DEMONESS_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateApocalypseDemonessAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.apocalypseDemoness.acquisitionJournal, expected = createApocalypseDemonessState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: ApocalypseDemonessAcquisitionEvent | null = null, nextCursor = s.apocalypseDemoness.sourceScene?.random.cursor ?? 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'finance', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.calamityDemoness.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateApocalypseDemonessAcquisitionCommand(raw.command) || !validateApocalypseDemonessFinanceSnapshot(raw.finance, raw.week) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 2 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'calamityDemonessPromotionWeek', 'assassinPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== raw.before.gender || raw.actor.age !== s.character.age ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || raw.actor.sourceIdentityDigest !== sourceIdentityDigest(s) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'demoness' || raw.actor.calamityDemonessPromotionWeek !== s.calamityDemoness.promotionWeek || raw.actor.assassinPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as ApocalypseDemonessAcquisitionEvent;
      if (!integer(event.cursorBefore, nextCursor, s.random.cursor) || event.cursorAfter !== event.cursorBefore + (event.command.type === 'CONSUME' ? 1 : 0) || !integer(event.cursorAfter, 0, s.random.cursor) ||
        (event.command.type === 'CONSUME' && (event.randomBefore !== event.cursorBefore || event.randomAfter !== event.cursorAfter))) return false;
      if (event.actor.sourceHistoryDigest !== null && event.actor.sourceHistoryDigest !== sourceHistoryDigest(s)) return false;
      if (event.after.gender !== event.before.gender) return false;
      if ([...event.before.injuries, ...event.after.injuries].some(injury => injury.acquiredRevision > event.revision || injury.treatedRevision !== null && injury.treatedRevision > event.revision)) return false;
      if (previous) {
        if (event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || event.revision <= previous.revision || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (!ordinaryCoreGrowth(previous.after.coreStats, event.before.coreStats) || event.before.acting !== previous.after.acting ||
          INHERITED_ABILITY_IDS.some(id => event.before.mastery[id] !== previous!.after.mastery[id]) ||
          !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
        // A prepared site forbids intervening work or recovery; cancellation and drinking consume this exact budget.
        if (expected.preparedWeek !== null && (event.week !== previous.week || !same(event.date, previous.date) || !same(event.before, previous.after) || !same(event.finance, previous.finance))) return false;
        if (event.revision === previous.revision + 1 && !adjacentAcquisitionsMatch(previous, event)) return false;
      }
      const b = event.before;
      const shadow: SliceState = { ...s, ...(s.apocalypseDemoness.sourceHistory ? structuredClone(s.apocalypseDemoness.sourceHistory) : {}), status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        ...structuredClone(event.finance), health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, combatHistory: s.combatHistory.slice(0, s.apocalypseDemoness.sourceScene?.combatHistoryLength ?? s.combatHistory.length), activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.cursorBefore },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'demoness', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, apocalypseDemoness: expected };
      let checks = 0;
      const context: SeerContext = { note() {}, roll() { throw new Error('购药准备没有额外随机来源。'); }, check(ability, difficulty) {
        if (++checks !== 1 || event.command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30 ||
          !integer(event.randomBefore, nextCursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) throw new Error('服药随机来源不一致。');
        const random = new DeterministicActionRandomStream(s.random.seed, event.randomBefore);
        const check = resolveNormalCheck({ ability: 'will', baseAbility: b.coreStats.will, difficulty: 30, modifiers: [], roll: random.nextInt(1, 100) });
        if (!same(check, event.check) || random.cursor !== event.randomAfter) throw new Error('服药结果与原随机记录不符。');
        shadow.random.cursor = random.cursor; nextCursor = random.cursor; return check;
      } };
      applyAcquisitionMutation(shadow, event.command, context, true);
      if (!same(acquisitionBudget(shadow), event.after)) return false;
      if (event.command.type === 'CONSUME' ? checks !== 1 : checks !== 0 || event.check !== null || event.randomBefore !== null || event.randomAfter !== null) return false;
      nextCursor = event.cursorAfter; previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.apocalypseDemoness))) return false;
    if (previous) {
      if (s.character.gender !== previous.after.gender || !ordinaryCoreGrowth(previous.after.coreStats, s.character.coreStats)) return false;
      // No post-guidance source-stage command may manufacture growth on the inherited skills.
      if (INHERITED_ABILITY_IDS.some(id => isApocalypseDemoness(s) ? !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500) : s.progression.mastery[id] !== previous!.after.mastery[id]) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.apocalypseDemoness.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || !same(apocalypseDemonessFinanceSnapshot(s), previous.finance) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && !apocalypseDemonessCompletedAcquisitionBudgetMatches(s, previous)) return false;
      if (isApocalypseDemoness(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 1 || previous.after.acting !== 0 ||
        !APOCALYPSE_DEMONESS_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.apocalypseDemoness.calamityDemonessActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.apocalypseDemoness.guidanceKnown || isApocalypseDemoness(s)) return false;
    return true;
  } catch { return false; }
}

export function applyApocalypseDemonessCommand(s: SliceState, command: ApocalypseDemonessCommand, ctx: SeerContext): void {
  if (!validateApocalypseDemonessCommand(command)) throw new Error('末日魔女命令无效。');
  if (validateApocalypseDemonessAcquisitionCommand(command)) return applyApocalypseDemonessAcquisition(s, command, ctx);
  if (validateApocalypseDemonessActivityCommand(command)) return applyApocalypseDemonessLifeCommand(s, command, ctx);
  if (validateApocalypseDemonessEncounterCommand(command)) return applyApocalypseDemonessEncounterCommand(s, command, ctx);
  throw new Error('未知末日魔女命令。');
}

/** Acquisition actions remain separate so the panel can compose actual life
 * and encounter actions without duplicating the potion protocol. */
export function apocalypseDemonessAcquisitionActions(s: SliceState): ApocalypseDemonessAction[] {
  if (!knownChannel(s) || isApocalypseDemoness(s)) return [];
  const state = s.apocalypseDemoness, actions: ApocalypseDemonessAction[] = [];
  const add = (id: string, label: string, cost: string, command: ApocalypseDemonessAcquisitionCommand) => {
    const reason = apocalypseDemonessAcquisitionBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason, ...(['LEAVE_PREPARATION'].includes(command.type) ? { cleanup: true } : {}) });
  };
  if (!state.guidanceKnown) add('learn-apocalypse-demoness-guidance', '听取末日魔女成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
  else {
    for (const task of APOCALYPSE_DEMONESS_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`apocalypse-demoness-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
    if (state.preparedWeek === null) add('prepare-apocalypse-demoness-promotion', '实际检查本次服药场地', '1行动 · 150便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
    else add('leave-apocalypse-demoness-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
    if (state.resupply.requestedWeek !== null) add('receive-apocalypse-demoness-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
    else if (exhaustedSupply(state)) add('request-apocalypse-demoness-supply', '申请下一批独立末日魔女成品', '1行动 · 100便士 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
    for (const bottle of state.bottles) {
      if (bottle.status === 'SUPPLIER') {
        if (bottle.labourSteps < APOCALYPSE_DEMONESS_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${APOCALYPSE_DEMONESS_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶末日魔女魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
      } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶末日魔女魔药`, `0行动 · 灾难魔女消化${s.progression.acting}/100 · ${calamityDemonessWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  return actions;
}
function preferredApocalypseDemonessAction(s: SliceState, actions: ApocalypseDemonessAction[]): ApocalypseDemonessAction | undefined {
  const enabled = actions.filter(action => action.enabled), life = projectApocalypseDemonessLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.preferredAction) ?? enabled.find(action => action.id === preferredId) ??
    enabled.find(action => !action.cleanup && !['LEAVE_PREPARATION', 'RETURN_HOME', 'LEAVE_ENCOUNTER', 'ABORT'].includes(action.command.type)) ?? enabled[0];
}
export function projectApocalypseDemoness(s: SliceState): ApocalypseDemonessProjection {
  const state = s.apocalypseDemoness, available = knownChannel(s), promoted = isApocalypseDemoness(s);
  const actions = available ? [...apocalypseDemonessAcquisitionActions(s), ...apocalypseDemonessLifeActions(s), ...apocalypseDemonessEncounterActions(s)] : [];
  const preferred = preferredApocalypseDemonessAction(s, actions), chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '末日魔女·魔女序列1', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    formulaKnown: false, formula: [], ...(available ? { story: `${APOCALYPSE_DEMONESS_FORMULA_STATUS}${APOCALYPSE_DEMONESS_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6600便士，或为本瓶完成五项真实劳动后支付1100便士；全部失败耗尽后才能申请下一批，跨真实周收货并逐瓶另行取得。` : '',
    actions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : actions.find(a => a.reason)?.reason ?? (promoted ? '已完成记录保留，可以继续正常生活。' : '先完成灾难魔女的实际经历。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 末日魔女成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周当次场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为灾难魔女' : '排异，仍为灾难魔女'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? APOCALYPSE_DEMONESS_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...APOCALYPSE_DEMONESS_INHERITED_ABILITIES, ...APOCALYPSE_DEMONESS_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `灾难魔女消化${state.calamityDemonessActingAtPromotion}/100留存；末日魔女扮演${s.progression.acting}/100。三份生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。` : available ? `灾难魔女需消化100（当前${s.progression.acting}/100）、晋2后12整周（当前${calamityDemonessWeeks(s)}/12），完成三份旧报告与反思；另须三项专业准备和当周场地检查。` : '先完成灾难魔女的实际经历。',
    pollution: s.seer.pollution, risk: available ? APOCALYPSE_DEMONESS_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    characterName: s.character.name, currentGender: s.character.gender, originalGender: s.witch.previousGender ?? s.character.gender,
    appearanceRecord: available ? `${s.character.name}，原创建年龄${s.character.age}岁；当前${s.character.gender === 'FEMALE' ? '女性' : '男性'}。晋升不改变性别、姓名、年龄、性格与取向，旧伤仍须正常休养。` : '',
    injuries: available ? s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })) : [], injuryRisk: s.injuryRisk,
    inheritedTools: available ? `同一对原镜仍在各自实际位置，原箱保留既有焦痕。维瑞娜、马库斯与本人从真实位置继续，旧许可已结束，须按每案重新询问。旧封闭负载余${apocalypseDemonessOriginals(s).site.load.remainingLoads}次，旧护片各余${apocalypseDemonessOriginals(s).site.plates.map(plate => plate.charges).join('、')}次且已归还；原战斗镜片${apocalypseDemonessOriginals(s).combatPlate?.id ?? "尚未领取"}余${apocalypseDemonessOriginals(s).combatPlate?.charges ?? 0}次，原持有人${apocalypseDemonessOriginals(s).combatPlate ? "本人" : "供应方"}保持不变。本次新来源、新负载和新护片须分别付费取得，旧耗用不恢复。` : '',
    inheritedHistory: available ? [
      `灾难魔女在第${s.calamityDemoness.promotionWeek}周实际晋升；${promoted ? `原消化${state.calamityDemonessActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      '前八阶18项技巧保持原值，未掌握的项目仍为零；成功晋升只新增两项零掌握。',
      '刺客至灾难魔女的八阶原瓶、每次失败、实际成本、原人原物和旧敌人的结局完整保留。',
      '新实践在同一展廊附室进行，只用本次单独购入的有限非生物来源与冲击负载；旧负载、残留、伤势、护片与损耗不重置。每个人须实际步行，场外恢复需要真实成本，精力不会自动补满。',
    ] : [],
    life: projectApocalypseDemonessLife(s), encounter: projectApocalypseDemonessEncounter(s), insideCase: hasApocalypseDemonessLock(s),
    environment: available ? '原展廊附室的两面原镜、封闭容器与普通出口继续使用。维瑞娜与马库斯从各自真实位置出发，重新同意并亲自步行到场。脉冲、护持、负载与本人承受都有有限来源、时间和成本；停止或撤回后仍须收好实际物件、归还本案护片并沿普通路线离开。' : '',
  };
}

/** Chronology is checked separately from deterministic per-command replay. */
export function validateApocalypseDemonessJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.apocalypseDemoness.acquisitionJournal;
    let cursor = 0;
    for (let n = 0; n < events.length; n++) {
      const event = events[n]!, previous = events[n - 1];
      if (previous) {
        if (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (event.revision === previous.revision + 1 && !adjacentAcquisitionsMatch(previous, event)) return false;
        if (previous.command.type === 'PREPARE_PROMOTION' && (event.week !== previous.week || !same(event.date, previous.date) || !['CONSUME', 'LEAVE_PREPARATION'].includes(event.command.type) || !same(event.before, previous.after))) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id] !== previous.after.mastery[id]) || !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      }
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) return false;
        cursor = event.randomAfter;
      }
    }
    // The three independent replays still share one public command sequence,
    // resource budget and random stream. Gaps permit actual ordinary play;
    // directly adjacent commits cannot manufacture recovery or another draw.
    type SharedBudget = Pick<ApocalypseDemonessAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { week: number; date: PublicGameDate; revision: number; before: SharedBudget; after: SharedBudget; finance: ApocalypseDemonessFinanceSnapshot; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null };
    const shared = (budget: SharedBudget): SharedBudget => ({ actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash });
    const timeline: Timeline[] = events.map(event => ({ week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), finance: event.finance, randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.cursorAfter }));
    const promotion = events.find(event => event.after.sequence === 1);
    for (const event of s.apocalypseDemoness.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision, before: shared(event.before), after: shared(event.after), finance: event.finance,
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.randomAfter ?? event.randomCursor });
    }
    const encounter = s.apocalypseDemoness.encounter, preparation = encounter.preparation;
    const reflection = s.apocalypseDemoness.life.journal.find(event => event.command.type === 'REFLECT');
    if (preparation) {
      // Encounter receipts store resulting revisions; acquisition/life store input revisions.
      if (!promotion || !reflection || preparation.revision - 1 <= reflection.revision || preparation.week < reflection.week || compareGameDates(preparation.date, reflection.date) < 0) return false;
      timeline.push({ week: preparation.week, date: preparation.date, revision: preparation.revision - 1,
        before: shared(preparation.before), after: shared(preparation.after), finance: preparation.finance, randomBefore: null, randomAfter: null, recordedCursor: preparation.randomCursor });
      for (const event of encounter.journal) timeline.push({ week: event.week, date: event.date, revision: event.revision - 1,
        before: shared(event.before), after: shared(event.after), finance: event.finance, randomBefore: null, randomAfter: null, recordedCursor: event.randomCursor });
    }
    timeline.sort((a, b) => a.revision - b.revision);
    cursor = 0; let exactCursor: number | null = null;
    for (let n = 0; n < timeline.length; n++) {
      const event = timeline[n]!, previous = timeline[n - 1];
      const direct = !!previous && event.revision === previous.revision + 1;
      const priorAcquisition = direct ? events.find(e => e.revision === previous!.revision) : undefined;
      if (priorAcquisition) {
        const settled = acquisitionBoundary(priorAcquisition);
        if (event.week !== settled.week || !same(event.date, settled.date) || !same(event.before, shared(settled.budget)) || !same(event.finance, settled.finance) || settled.eventId !== null) return false;
      }
      if (direct && !priorAcquisition && previous!.after.actions > 0 && !same(event.finance, previous!.finance)) return false;
      // The reflected life scene is unlocked. A direct encounter approach must
      // see the actual public weekly reconciliation, including zero-AP bills.
      if (direct && reflection && previous!.revision === reflection.revision && previous!.after.actions === 0) {
        const finance = reflection.finance;
        const result = resolveSliceWeeklyFinance({ ...finance, cash: reflection.after.cash, week: reflection.week, revision: reflection.revision, pulse: 'BILL', billAmount: 0 });
        const advanced = result.eventId === null && result.state.pulse === 'ADVANCE';
        const nextFinance = apocalypseDemonessFinanceSnapshot({ ...finance, ...result.state, lifeTier: advanced ? result.state.nextLifeTier : finance.lifeTier });
        if (result.eventId !== null || event.week !== reflection.week + (advanced ? 1 : 0) ||
          !same(event.date, advanced ? addGameWeeks(reflection.date, 1) : reflection.date) ||
          !same(event.before, { ...reflection.after, cash: result.state.cash, actions: advanced ? finance.weeklyBudget : 0 }) || !same(event.finance, nextFinance)) return false;
      }
      const adjacent = direct && (priorAcquisition !== undefined || event.week === previous!.week && previous!.after.actions > 0);
      if (!adjacent) exactCursor = null;
      if (previous && (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || adjacent && !priorAcquisition && !same(event.before, previous.after))) return false;
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor) || exactCursor !== null && event.randomBefore !== exactCursor) return false;
        cursor = event.randomAfter; exactCursor = event.randomAfter;
      }
      if (event.recordedCursor !== null) {
        if (!integer(event.recordedCursor, cursor, s.random.cursor) || exactCursor !== null && event.recordedCursor !== exactCursor) return false;
        cursor = event.recordedCursor; exactCursor = event.recordedCursor;
      }
    }
    const tail = timeline.at(-1);
    if (tail && s.revision === tail.revision + 1 && s.week === tail.week && tail.after.actions > 0 &&
      (!same(s.date, tail.date) || !same(shared(acquisitionBudget(s)), tail.after) || exactCursor !== null && exactCursor !== s.random.cursor)) return false;
    return true;
  } catch { return false; }
}


/** Freeze all eight predecessor roots exactly. Only the new-stage live scene
 * continues; source snapshots never become duplicate inventory. */
export function validateApocalypseDemonessSource(s: SliceState): boolean {
  try {
    const state = s.apocalypseDemoness, history = state.sourceHistory, scene = state.sourceScene, first = state.acquisitionJournal[0];
    if (!history || !scene || !first || !shape(history, APOCALYPSE_DEMONESS_SOURCE_KEYS) ||
      !shape(scene, ['week', 'date', 'revision', 'random', 'budget', 'finance', 'identityDigest', 'historyDigest', 'character', 'originals', 'combatHistoryLength', 'combatHistoryDigest', 'city']) ||
      !shape(scene.random, ['seed', 'cursor']) || scene.random.seed !== s.random.seed || !integer(scene.random.cursor, 0, s.random.cursor) ||
      !integer(scene.combatHistoryLength, 0, s.combatHistory.length) || scene.combatHistoryDigest !== sha256Hex(stableStringify(s.combatHistory.slice(0, scene.combatHistoryLength))) ||
      scene.city !== 'BACKLUND' || scene.identityDigest !== sourceIdentityDigest(s) || scene.historyDigest !== sourceHistoryDigest(s) ||
      !validateApocalypseDemonessFinanceSnapshot(scene.finance, scene.week) || !same(scene.finance, first.finance) ||
      !shape(scene.originals, ['site', 'combatPlate']) || !validateCalamityDemonessSiteState(scene.originals.site) ||
      !same(scene.originals, apocalypseDemonessOriginals({ ...s, ...history })) ||
      scene.character.gender !== scene.budget.gender || !same(scene.character.coreStats, scene.budget.coreStats) ||
      sourceIdentityDigest({ ...s, character: scene.character }) !== scene.identityDigest || first.command.type !== 'LEARN_GUIDANCE' ||
      scene.week !== first.week || scene.revision !== first.revision || !same(scene.date, first.date) ||
      !same(scene.budget, first.before) || scene.random.cursor !== first.cursorBefore || first.actor.sourceHistoryDigest !== scene.historyDigest) return false;
    // No predecessor resource exception: the old encounter.currentSite and old
    // life.site are different immutable historical checkpoints. New operations
    // are proven against sourceScene.originals by the new life/encounter replay.
    return same(apocalypseDemonessSourceHistory(s), history);
  } catch { return false; }
}

export const validateApocalypseDemonessInheritedState = validateApocalypseDemonessSource;
/** Historical validation reads the genuine paid-guidance S2 checkpoint. This
 * view never writes to the live state, and never invents predecessor actions. */
export function apocalypseDemonessInheritedView(s: SliceState): SliceState {
  const { sourceHistory: history, sourceScene: scene } = s.apocalypseDemoness;
  if (!isApocalypseDemoness(s) || !s.apocalypseDemoness.guidanceKnown || !history || !scene) return s;
  const budget = scene.budget;
  return { ...s, ...structuredClone(history), status: 'ACTIVE', week: scene.week, date: structuredClone(scene.date), revision: scene.revision,
    ...structuredClone(scene.finance), health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash, actionsRemaining: budget.actions,
    injuries: structuredClone(budget.injuries), injuryRisk: budget.injuryRisk, random: { ...scene.random },
    activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', ending: null,
    world: { ...s.world, city: 'BACKLUND' }, character: structuredClone(scene.character),
    progression: { ...s.progression, pathwayId: 'demoness', sequence: 2, acting: budget.acting, mastery: { ...budget.mastery } },
    seer: { ...s.seer, pollution: budget.pollution, completedSources: [...budget.completedSources] },
    combatHistory: s.combatHistory.slice(0, scene.combatHistoryLength), apocalypseDemoness: createApocalypseDemonessState() };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateApocalypseDemonessState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.apocalypseDemoness;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'calamityDemonessActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'sourceHistory', 'sourceScene', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== APOCALYPSE_DEMONESS_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as ApocalypseDemonessState, promoted = isApocalypseDemoness(s), acquisitionStage = isApocalypseDemonessAcquisitionStage(s);
  const firstWeek = s.calamityDemoness.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + APOCALYPSE_DEMONESS_MIN_CALAMITY_DEMONESS_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !validateApocalypseDemonessSource(s))) return false;
  if (!state.guidanceKnown && (state.sourceHistory !== null || state.sourceScene !== null)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > APOCALYPSE_DEMONESS_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !APOCALYPSE_DEMONESS_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasApocalypseDemonessOldPractice(s) || hasApocalypseDemonessLifeLock(s) || hasApocalypseDemonessEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.calamityDemoness.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.calamityDemonessActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !calamityDemonessReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...APOCALYPSE_DEMONESS_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.calamityDemonessActingAtPromotion !== null || APOCALYPSE_DEMONESS_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `apocalypse-demoness-potion-${index + 1}` || !integer(b.labourSteps, 0, APOCALYPSE_DEMONESS_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < APOCALYPSE_DEMONESS_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== APOCALYPSE_DEMONESS_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % APOCALYPSE_DEMONESS_BOTTLE_IDS.length;
      if (b.stockedWeek !== state.bottles[batchStart]!.stockedWeek || state.bottles.slice(0, batchStart).some(previous => previous.status !== 'CONSUMED' || !failed(previous.outcome) || !integer(previous.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
    }
    if (!state.guidanceKnown && (b.labourSteps !== 0 || b.status !== 'SUPPLIER')) return false;
    if (b.status === 'SUPPLIER') {
      if (b.acquiredWeek !== null || b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.acquiredWeek, stockWeek, lastAcquisitionWeek)) return false;
      if (b.status === 'PLAYER') {
        if (b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
      } else if (b.status === 'CONSUMED') {
        if (!integer(s.calamityDemoness.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateApocalypseDemonessAcquisitionJournal(s) || !validateApocalypseDemonessJournalContinuity(s) || !validateApocalypseDemonessLifeState(s) || !validateApocalypseDemonessEncounterState(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting || !s.seer.completedSources.includes('demoness-s1')) return false;
    const promotedReceipt = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
    if (!promotedReceipt) return false;
    const expectedMastery = { ...promotedReceipt.after.mastery };
    for (const [id, gain] of Object.entries(apocalypseDemonessLifeMasteryGains(s))) {
      if (!APOCALYPSE_DEMONESS_ABILITY_IDS.includes(id as typeof APOCALYPSE_DEMONESS_ABILITY_IDS[number]) || !integer(gain, 0, 24)) return false;
      expectedMastery[id] = Math.min(500, expectedMastery[id]! + gain);
    }
    for (const round of s.combatHistory) if (round.apocalypseDemonessOutcome) {
      for (const action of [...round.apocalypseDemonessOutcome.playerActions, ...round.apocalypseDemonessOutcome.enemyActions]) {
        for (const id of action.masteryApplied) expectedMastery[id] = Math.min(500, expectedMastery[id]! + 8);
      }
    }
    if (!same(s.progression.mastery, expectedMastery)) return false;
  }
  if (!promoted && s.seer.completedSources.includes('demoness-s1')) return false;
  return true;
}
export { APOCALYPSE_DEMONESS_ABILITIES } from './content.js';
export { APOCALYPSE_DEMONESS_ABILITY_IDS } from './types.js';
export type * from './types.js';

export const handleApocalypseDemoness = applyApocalypseDemonessCommand;

/** Historical membership accepts the actual sequence-one record; current commands remain exact-stage gated. */
export const validateApocalypseDemonessHistory = validateApocalypseDemonessState;
