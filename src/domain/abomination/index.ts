import { ANCIENT_EVIL_INHERITED_ABILITY_IDS, hasAncientEvilOldPractice, hasAncientEvilLock, validateAncientEvilState } from '../ancient-evil/index.js';
import { ANCIENT_EVIL_ABILITY_IDS } from '../ancient-evil/types.js';
import { validatePrisonerState } from '../prisoner/index.js';
import { validateMadmanState } from '../madman/index.js';
import { validateWerewolfState } from '../werewolf/index.js';
import { validateZombieState } from '../zombie/index.js';
import { validateWraithState } from '../wraith/index.js';
import { validatePuppetState } from '../puppet/index.js';
import { validateSilentDiscipleState } from '../silent-disciple/index.js';
import { SLICE_LIFE } from '../../content/slice-events.js';
import { abominationFinanceSnapshot, abominationCompletedBudgetMatches, initializeAbominationEncounterState } from './encounter.js';
import { resolveSliceWeeklyFinance } from '../slice/weekly-finance.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { addGameWeeks, compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createAbominationLifeState, initializeAbominationLifeState, applyAbominationLifeCommand, projectAbominationLife, abominationLifeActions, validateAbominationLifeState, validateAbominationActivityCommand, hasAbominationLifeLock, abominationLifeMasteryGains } from './life.js';
import { createAbominationEncounterState, applyAbominationEncounterCommand, projectAbominationEncounter, abominationEncounterActions, validateAbominationEncounterState, validateAbominationEncounterCommand, hasAbominationEncounterLock } from './encounter.js';
import { ABOMINATION_ABILITIES, ABOMINATION_INHERITED_ABILITIES, ABOMINATION_BOTTLE_IDS, ABOMINATION_FORMULA_STATUS, ABOMINATION_LABOUR_STEPS, ABOMINATION_LABOUR_TASKS, ABOMINATION_MIN_ANCIENT_EVIL_WEEKS, ABOMINATION_POTION_SOURCES, ABOMINATION_PREPARATIONS, abominationPrices, abominationSourceLabel, abominationPotionSource, abominationConsumptionRisk, ABOMINATION_SOURCE_STATUS } from './content.js';
import { ABOMINATION_ABILITY_IDS, ABOMINATION_PREPARATION_IDS, ABOMINATION_SOURCE_KEYS, type AbominationFinance, type AbominationOriginals, type AbominationSourceHistory, type AbominationAcquisitionBudget, type AbominationAcquisitionEvent, type AbominationAcquisitionCommand, type AbominationAction, type AbominationBottle, type AbominationCommand, type AbominationProjection, type AbominationState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const ABOMINATION_INHERITED_ABILITY_IDS = [...ANCIENT_EVIL_INHERITED_ABILITY_IDS, ...ANCIENT_EVIL_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = ABOMINATION_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): AbominationBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createAbominationState(): AbominationState {
  return { guidanceKnown: false, sourceWeek: null, bottles: ABOMINATION_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, ancientEvilActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], sourceHistory: null, sourceScene: null, life: createAbominationLifeState(), encounter: createAbominationEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isAbomination = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 1;
export const isAbominationAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 2;
export const hasAbominationHistory = (s: SliceState) => isAbomination(s) && s.abomination.promotionWeek !== null;
/** Source stages retain their real purchase, brewing and ritual shapes. Detailed
 * predecessor validators run on the frozen S2 source, never an invented history. */
function sourceHistory(s: SliceState): boolean {
  if (!s.prisoner.discovered || !s.prisoner.guidanceKnown) return false;
  const first = s.prisoner.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || !integer(first[0]!.consumedWeek, 1, s.week) || first[0]!.consumedWeek !== s.progression.promotionWeek ||
    !integer(first[0]!.acquiredWeek, 1, first[0]!.consumedWeek)) return false;
  let previous = first[0]!.consumedWeek!;
  for (const stage of [s.madman, s.werewolf, s.zombie, s.wraith, s.puppet, s.silentDisciple, s.ancientEvil]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.madman.prisonerActingAtPromotion === 100 && s.werewolf.madmanActingAtPromotion === 100 &&
    s.zombie.werewolfActingAtPromotion === 100 && s.wraith.zombieActingAtPromotion === 100 &&
    s.puppet.wraithActingAtPromotion === 100 && s.silentDisciple.puppetActingAtPromotion === 100 && s.ancientEvil.silentDiscipleActingAtPromotion === 100;
}
export function abominationSourceHistory(s: SliceState): AbominationSourceHistory {
  return Object.fromEntries(ABOMINATION_SOURCE_KEYS.map(key => [key, structuredClone(s[key])])) as AbominationSourceHistory;
}
function sourceHistoryDigest(s: SliceState): string {
  return sha256Hex(stableStringify(s.abomination.sourceHistory ?? abominationSourceHistory(s)));
}
function sourceIdentityDigest(s: SliceState): string {
  const { coreStats: _stats, ...identity } = s.character;
  return sha256Hex(stableStringify(identity));
}
const knownChannel = (s: SliceState) => (isAbominationAcquisitionStage(s) || isAbomination(s)) && sourceHistory(s);
/** Once guidance freezes the source, old commands close and completed records stay exact. */
export function hasAbominationOldPractice(s: SliceState): boolean {
  return hasAncientEvilOldPractice(s) || hasAncientEvilLock(s);
}
const ancientEvilReportsComplete = (s: SliceState) => s.ancientEvil.life.reflected &&
  Object.keys(s.ancientEvil.life.cases).length === 3 && Object.values(s.ancientEvil.life.cases).every(c =>
    c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.closes === 1 && c.attempts.length > 0 &&
    c.attempts.every(a => a.week <= s.week) && c.attempts.at(-1)!.closed && c.attempts.at(-1)!.inspected);
export const abominationOriginals = (s: SliceState): AbominationOriginals => ({
  site: structuredClone(s.silentDisciple.life), operation: structuredClone(s.ancientEvil.life.operation),
  blocks: structuredClone(s.ancientEvil.encounter.blocks),
});
/** Read only the live original room, never the old source.snapshot. */
function sourceClosed(originals: AbominationOriginals): boolean {
  const { site, operation } = originals;
  return site.siteId === 'SD3-QUIET-ROOM' && site.playerLocation === 'START' && site.activeCase === null &&
    site.volunteer.id === 'SD3-ELSA' && site.volunteer.bodyId === 'SD3-ELSA' && site.volunteer.alive && site.volunteer.form === 'HUMAN' &&
    site.volunteer.location === 'OUTSIDE' && site.clothing.id === 'SD3-CLOTHES' && site.clothing.location === 'ELSA' && site.clothing.worn &&
    site.bag.id === 'SD3-BAG' && site.bag.location === 'ELSA' && site.guide.id === 'HARLAN' && site.guide.location === 'OUTSIDE' &&
    site.tray.id === 'SD3-TRAY' && site.tray.location === 'A' && site.tray.privacy === 'PRIVATE' && site.note.id === 'SD3-NOTE' && site.note.location === 'B' &&
    !Object.values(site.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.status === 'ACTIVE') &&
    operation.door === 'OPEN' && !operation.inputActive && operation.form === null;
}
export { getAbominationCurrentSite } from './life.js';
export const hasAbominationOldSceneLock = hasAbominationOldPractice;
export const hasAbominationRitualLock = (s: SliceState): boolean => s.abomination.preparedWeek !== null;
export const hasAbominationLock = (s: SliceState): boolean => hasAbominationRitualLock(s) || hasAbominationLifeLock(s) || hasAbominationEncounterLock(s);
const bottleNumber = (b: Pick<AbominationBottle, 'id'>) => Number(b.id.slice('abomination-potion-'.length));
const potionPrice = (s: SliceState, b: AbominationBottle) => { const p = abominationPrices(); return p.potion - (b.labourSteps === ABOMINATION_LABOUR_STEPS ? p.labourCredit : 0); };
const ancientEvilWeeks = (s: SliceState) => Math.max(0, (s.abomination.promotionWeek ?? s.week) - (s.ancientEvil.promotionWeek ?? s.week));
const exhaustedSupply = (state: AbominationState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (s: SliceState, number: number, week: number) => abominationPotionSource(number, week);
const hasPreparations = (s: SliceState) => ABOMINATION_PREPARATION_IDS.every(id => s.abomination.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `古代邪物魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.ancientEvil.promotionWeek === null || ancientEvilWeeks(s) < ABOMINATION_MIN_ANCIENT_EVIL_WEEKS) return `成为古代邪物后已过${ancientEvilWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!ancientEvilReportsComplete(s)) return '先完成古代邪物的三份实际报告与反思，并收好旧核验现场。';
  return hasPreparations(s) ? null : '先分别核对八阶原瓶与同一原物、局部精神束障和短促震声的有限边界、普通返回路线；领取药瓶不能代做专业准备。';
}
export function validateAbominationAcquisitionCommand(v: unknown): v is AbominationAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && ABOMINATION_PREPARATION_IDS.includes(v.taskId as typeof ABOMINATION_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^abomination-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isAbominationAcquisitionCommand = validateAbominationAcquisitionCommand;
export function validateAbominationCommand(v: unknown): v is AbominationCommand {
  return validateAbominationAcquisitionCommand(v) || validateAbominationActivityCommand(v) || validateAbominationEncounterCommand(v);
}
export function abominationAcquisitionBlock(s: SliceState, command: AbominationAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: AbominationAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateAbominationAcquisitionCommand(command)) return '神孽准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasAbominationOldPractice(s)) || hasAbominationLifeLock(s) || hasAbominationEncounterLock(s)) return '先停止旧现场的接触和能力、归还原物，再沿普通路线离开；旧人物、伤势与实战后果继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德当前时代的独立交接处。';
  if (!sourceClosed(abominationOriginals(s))) return '先实际收束原安静室，停止输入与已有变形，原衣与包归同一埃尔莎，让本人在门口、埃尔莎与哈伦在室外，再进行服药交接。';
  if (!knownChannel(s)) return '实际成为古代邪物并保留当前时代真实指导渠道后，才能了解神孽之路。';
  if (!isAbominationAcquisitionStage(s)) return '已经晋升神孽1，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '囚犯至古代邪物的19项掌握记录不完整，暂不能继续晋升。';
  const state = s.abomination, prices = abominationPrices();
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE' && !ancientEvilReportsComplete(s)) return '先完成古代邪物三份生活报告与反思，再核对这次晋升的既往记录。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < prices.guidance ? `本次专业指导需要${prices.guidance}便士。` : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的神孽原瓶。';
    return s.cash < prices.preparation ? `当次场地检查需要${prices.preparation}便士。` : null;
  }
  if (command.type === 'REQUEST_SUPPLY' && s.cash < prices.resupply) return `申请下一批需要${prices.resupply}便士实际费用。`;
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批神孽原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的神孽准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选神孽独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : `须另付1行动与${prices.preparation}便士完成本周当次场地检查；旧准备不能使用。`;
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= ABOMINATION_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(s, bottle) ? `领取本瓶需要${potionPrice(s, bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: AbominationAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.abomination, prices = abominationPrices();
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      state.sourceHistory = abominationSourceHistory(s);
      state.sourceScene = { week: s.week, date: structuredClone(s.date), revision: s.revision, random: { ...s.random },
        budget: abominationAcquisitionBudget(s), finance: abominationFinanceSnapshot(s), identityDigest: sourceIdentityDigest(s), historyDigest: sourceHistoryDigest(s),
        character: structuredClone(s.character), originals: abominationOriginals(s), combatHistoryLength: s.combatHistory.length, combatHistoryDigest: sha256Hex(stableStringify(s.combatHistory)), city: 'BACKLUND' };
      s.actionsRemaining--; s.cash -= prices.guidance; state.guidanceKnown = true; state.sourceWeek = s.week;
      state.bottles.forEach((b, i) => { b.stockedWeek = s.week; b.source = abominationPotionSource(i + 1, s.week); });
      ctx.note('听取神孽独立成品与专业准备指导', `花1行动、${prices.guidance}便士。${abominationSourceLabel()}说明当前渠道记录。${ABOMINATION_FORMULA_STATUS}${abominationConsumptionRisk()}`); return;
    case 'PREPARE_TASK': {
      const task = ABOMINATION_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= prices.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', `花1行动、${prices.preparation}便士，按三项真实专业准备检查本周场地。须另外确认饮用所选原瓶；退出不退款、不治疗。`); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', `0行动实际退出，未服原瓶保留，已用行动与${prices.preparation}便士不返。可以继续真实生活休养。`); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(ABOMINATION_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶${prices.labourCredit}便士，余款${prices.labourBalance}便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(s, bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('神孽独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? `本瓶五项劳务抵${prices.labourCredit}便士。` : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; s.cash -= prices.resupply; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批神孽成品', `原瓶全部失败耗尽，花1行动与${prices.resupply}便士核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < ABOMINATION_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`abomination-potion-${number}`, deliverySource(s, number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶神孽原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶${prices.potion}便士或对应五项劳动后${prices.labourBalance}便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.ancientEvilActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 1; s.progression.acting = 0;
        if (!s.seer.completedSources.includes('chained-s1')) s.seer.completedSources.push('chained-s1');
        initializeAbominationLifeState(s);
        initializeAbominationEncounterState(s);
        for (const id of ABOMINATION_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为神孽', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；古代邪物消化100与原19项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满。姓名、性别、年龄、既有性格与旧伤不改写。同一原安静室、埃尔莎、哈伦与原衣包盘纸继续留存，三块旧木块保持耗尽，旧人物伤势、生死及投降不改写。本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '神孽魔药严重排异' : '神孽魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为古代邪物，旧消化、掌握、服药前性别、身体伤势与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、${prices.preparation}便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function validFinance(v: unknown, week: number): v is AbominationFinance {
  return record(v) && shape(v, ['weeklyBudget', 'lifeTier', 'nextLifeTier', 'debts', 'missedWeeks', 'credit']) &&
    integer(v.weeklyBudget, 1, 100) && typeof v.lifeTier === 'string' && Object.hasOwn(SLICE_LIFE, v.lifeTier) &&
    typeof v.nextLifeTier === 'string' && Object.hasOwn(SLICE_LIFE, v.nextLifeTier) && integer(v.missedWeeks) &&
    ['NORMAL', 'NOTICE', 'SUSPENDED'].includes(String(v.credit)) && Array.isArray(v.debts) && v.debts.every(d =>
      record(d) && shape(d, ['id', 'source', 'remaining', 'weeklyPayment', 'createdWeek']) && typeof d.id === 'string' && d.id.length > 0 &&
      typeof d.source === 'string' && d.source.length > 0 && integer(d.remaining) && integer(d.weeklyPayment, 1) && integer(d.createdWeek, 0, week));
}
/** Between adjacent public inputs the only unlocked automatic change is the
 * existing weekly bill/debt transition. No new economy or free recovery exists. */
function adjacentAcquisitionMatches(previous: AbominationAcquisitionEvent, event: AbominationAcquisitionEvent): boolean {
  if (event.cursorBefore !== previous.cursorAfter) return false;
  if (previous.after.actions > 0 || previous.command.type === 'PREPARE_PROMOTION') return event.week === previous.week &&
    same(event.date, previous.date) && same(event.before, previous.after) && same(event.finance, previous.finance);
  const result = resolveSliceWeeklyFinance({ ...previous.finance, cash: previous.after.cash, week: previous.week,
    revision: previous.revision, pulse: 'BILL', billAmount: 0 });
  if (result.eventId !== null || result.state.pulse !== 'ADVANCE') return false;
  const finance = abominationFinanceSnapshot({ ...previous.finance, ...result.state,
    weeklyBudget: previous.finance.weeklyBudget, lifeTier: result.state.nextLifeTier });
  return event.week === previous.week + 1 && same(event.date, addGameWeeks(previous.date, 1)) && same(event.finance, finance) &&
    same(event.before, { ...previous.after, cash: result.state.cash, actions: previous.finance.weeklyBudget });
}
function acquisitionTitle(event: AbominationAcquisitionEvent, state: AbominationState): string {
  const command = event.command;
  if (command.type === 'PREPARE_TASK') return ABOMINATION_PREPARATIONS.find(p => p.id === command.taskId)!.title;
  if (command.type === 'POTION_WORK') return ABOMINATION_LABOUR_TASKS[state.bottles.find(b => b.id === command.bottleId)!.labourSteps - 1]!;
  if (command.type === 'CONSUME') return event.check?.tier === 'GREAT_FAILURE' ? '神孽魔药严重排异' : event.check?.tier === 'FAILURE' ? '神孽魔药排异' : '实际成为神孽';
  return ({ LEARN_GUIDANCE: '听取神孽独立成品与专业准备指导', BUY_POTION: '神孽独立原瓶实际交付',
    PREPARE_PROMOTION: '实际检查本周服药场地', LEAVE_PREPARATION: '沿原出口结束本次服药准备',
    REQUEST_SUPPLY: '实际申请下一批神孽成品', RECEIVE_SUPPLY: '新的三瓶神孽原瓶实际到货' } as const)[command.type];
}
export function abominationAcquisitionBudget(s: SliceState): AbominationAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, gender: s.character.gender, sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: AbominationState) {
  return { guidanceKnown: state.guidanceKnown, sourceWeek: state.sourceWeek, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, ancientEvilActingAtPromotion: state.ancientEvilActingAtPromotion, sourceHistory: state.sourceHistory, sourceScene: state.sourceScene,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyAbominationAcquisition(s: SliceState, command: AbominationAcquisitionCommand, ctx: SeerContext): void {
  const reason = abominationAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const cursorBefore = s.random.cursor, before = abominationAcquisitionBudget(s), actor: AbominationAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, age: s.character.age, sourceIdentityDigest: sourceIdentityDigest(s), sourceHistoryDigest: ['LEARN_GUIDANCE', 'CONSUME'].includes(command.type) ? sourceHistoryDigest(s) : null, pathwayId: 'chained',
    ancientEvilPromotionWeek: s.ancientEvil.promotionWeek!, prisonerPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.abomination.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: abominationAcquisitionBudget(s), finance: abominationFinanceSnapshot(s), cursorBefore, cursorAfter: s.random.cursor, randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is AbominationAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'gender', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    !['MALE', 'FEMALE'].includes(String(v.gender)) || (v.sequence !== 2 && v.sequence !== 1) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 1 ? ABOMINATION_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateAbominationAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.abomination.acquisitionJournal, expected = createAbominationState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: AbominationAcquisitionEvent | null = null, nextCursor = s.abomination.sourceScene?.random.cursor ?? 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'finance', 'cursorBefore', 'cursorAfter', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.ancientEvil.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateAbominationAcquisitionCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || !validFinance(raw.finance, raw.week) || raw.before.sequence !== 2 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'age', 'sourceHistoryDigest', 'sourceIdentityDigest', 'pathwayId', 'ancientEvilPromotionWeek', 'prisonerPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== raw.before.gender || raw.actor.age !== s.character.age ||
        typeof raw.actor.sourceIdentityDigest !== 'string' || raw.actor.sourceIdentityDigest !== sourceIdentityDigest(s) ||
        (['LEARN_GUIDANCE', 'CONSUME'].includes(raw.command.type) ? typeof raw.actor.sourceHistoryDigest !== 'string' || !/^[0-9a-f]{64}$/.test(raw.actor.sourceHistoryDigest) : raw.actor.sourceHistoryDigest !== null) ||
        raw.actor.pathwayId !== 'chained' || raw.actor.ancientEvilPromotionWeek !== s.ancientEvil.promotionWeek || raw.actor.prisonerPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as AbominationAcquisitionEvent;
      if (!integer(event.cursorBefore, nextCursor, s.random.cursor) || event.cursorAfter !== event.cursorBefore + (event.command.type === 'CONSUME' ? 1 : 0) || !integer(event.cursorAfter, 0, s.random.cursor) ||
        (event.command.type === 'CONSUME' && (event.randomBefore !== event.cursorBefore || event.randomAfter !== event.cursorAfter))) return false;
      if (event.actor.sourceHistoryDigest !== null && event.actor.sourceHistoryDigest !== sourceHistoryDigest(s)) return false;
      if (event.after.gender !== event.before.gender) return false;
      if ([...event.before.injuries, ...event.after.injuries].some(injury => injury.acquiredRevision > event.revision || injury.treatedRevision !== null && injury.treatedRevision > event.revision)) return false;
      if (previous) {
        if (event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || event.revision <= previous.revision || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id] !== previous!.after.mastery[id]) ||
          !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
        // A prepared site forbids intervening work or recovery; cancellation and drinking consume this exact budget.
        if (expected.preparedWeek !== null && (event.week !== previous.week || !same(event.date, previous.date) || !same(event.before, previous.after))) return false;
        if (event.revision === previous.revision + 1 && !adjacentAcquisitionMatches(previous, event)) return false;
      }
      const b = event.before;
      const shadow: SliceState = { ...s, ...(s.abomination.sourceHistory ? structuredClone(s.abomination.sourceHistory) : {}), status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, combatHistory: s.combatHistory.slice(0, s.abomination.sourceScene?.combatHistoryLength ?? s.combatHistory.length), activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        ...structuredClone(event.finance), world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.cursorBefore },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'chained', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, abomination: expected };
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
      if (!same(abominationAcquisitionBudget(shadow), event.after)) return false;
      if (event.command.type === 'CONSUME' ? checks !== 1 : checks !== 0 || event.check !== null || event.randomBefore !== null || event.randomAfter !== null) return false;
      nextCursor = event.cursorAfter; previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.abomination))) return false;
    if (previous) {
      if (s.character.gender !== previous.after.gender) return false;
      // No post-guidance source-stage command may manufacture growth on the inherited skills.
      if (INHERITED_ABILITY_IDS.some(id => isAbomination(s) ? !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500) : s.progression.mastery[id] !== previous!.after.mastery[id]) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.abomination.preparedWeek !== null && (!same(abominationAcquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      if (s.revision === previous.revision + 1 && s.abomination.preparedWeek === null &&
        !abominationCompletedBudgetMatches(s, previous.after, previous.finance, previous.week, previous.date,
          s.revision, previous.cursorAfter, acquisitionTitle(previous, s.abomination))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(abominationAcquisitionBudget(s), previous.after) || s.random.cursor !== previous.cursorAfter)) return false;
      if (isAbomination(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 1 || previous.after.acting !== 0 ||
        !ABOMINATION_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.abomination.ancientEvilActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.abomination.guidanceKnown || isAbomination(s)) return false;
    return true;
  } catch { return false; }
}

export function applyAbominationCommand(s: SliceState, command: AbominationCommand, ctx: SeerContext): void {
  if (!validateAbominationCommand(command)) throw new Error('神孽命令无效。');
  if (validateAbominationAcquisitionCommand(command)) return applyAbominationAcquisition(s, command, ctx);
  if (validateAbominationActivityCommand(command)) return applyAbominationLifeCommand(s, command, ctx);
  if (validateAbominationEncounterCommand(command)) return applyAbominationEncounterCommand(s, command, ctx);
  throw new Error('未知神孽命令。');
}

/** Acquisition actions remain separate so the panel can compose actual life
 * and encounter actions without duplicating the potion protocol. */
export function abominationAcquisitionActions(s: SliceState): AbominationAction[] {
  if (!knownChannel(s) || isAbomination(s)) return [];
  const state = s.abomination, prices = abominationPrices(), actions: AbominationAction[] = [];
  const add = (id: string, label: string, cost: string, command: AbominationAcquisitionCommand) => {
    const reason = abominationAcquisitionBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason, ...(['LEAVE_PREPARATION'].includes(command.type) ? { cleanup: true } : {}) });
  };
  if (!state.guidanceKnown) add('learn-abomination-guidance', '听取神孽成品与专业准备指导', `1行动 · ${prices.guidance}便士`, { type: 'LEARN_GUIDANCE' });
  else {
    for (const task of ABOMINATION_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`abomination-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
    if (state.preparedWeek === null) add('prepare-abomination-promotion', '实际检查本次服药场地', `1行动 · ${prices.preparation}便士 · 仅本周有效`, { type: 'PREPARE_PROMOTION' });
    else add('leave-abomination-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
    if (state.resupply.requestedWeek !== null) add('receive-abomination-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
    else if (exhaustedSupply(state)) add('request-abomination-supply', '申请下一批独立神孽成品', `1行动 · ${prices.resupply}便士 · 下一真实周起收货`, { type: 'REQUEST_SUPPLY' });
    for (const bottle of state.bottles) {
      if (bottle.status === 'SUPPLIER') {
        if (bottle.labourSteps < ABOMINATION_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${ABOMINATION_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵${prices.labourCredit}便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶神孽魔药`, `0行动 · ${potionPrice(s, bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
      } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶神孽魔药`, `0行动 · 古代邪物消化${s.progression.acting}/100 · ${ancientEvilWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  return actions;
}
function preferredAbominationAction(s: SliceState, actions: AbominationAction[]): AbominationAction | undefined {
  const enabled = actions.filter(action => action.enabled), life = projectAbominationLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.preferredAction) ?? enabled.find(action => action.id === preferredId) ??
    enabled.find(action => !action.cleanup && !['LEAVE_PREPARATION', 'RETURN_HOME', 'LEAVE_ENCOUNTER', 'ABORT'].includes(action.command.type)) ?? enabled[0];
}
export function projectAbomination(s: SliceState): AbominationProjection {
  const state = s.abomination, available = knownChannel(s), promoted = isAbomination(s), prices = abominationPrices();
  const actions = available ? [...abominationAcquisitionActions(s), ...abominationLifeActions(s), ...abominationEncounterActions(s)] : [];
  const preferred = preferredAbominationAction(s, actions), chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '神孽·被缚者序列1', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted,
    sourceLabel: available ? abominationSourceLabel() : '', prices: available ? prices : null,
    formulaKnown: false, formula: [], ...(available ? { story: `${ABOMINATION_FORMULA_STATUS}${ABOMINATION_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶${prices.potion}便士，或为本瓶完成五项真实劳动后支付${prices.labourBalance}便士；全部失败耗尽后才能申请下一批，跨真实周收货并逐瓶另行取得。` : '',
    actions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : actions.find(a => a.reason)?.reason ?? (promoted ? '已完成记录保留，可以继续正常生活。' : '先完成古代邪物的实际经历。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 神孽成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周当次场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为古代邪物' : '排异，仍为古代邪物'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? ABOMINATION_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...ABOMINATION_INHERITED_ABILITIES, ...ABOMINATION_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `古代邪物消化${state.ancientEvilActingAtPromotion}/100留存；神孽扮演${s.progression.acting}/100。三份生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。` : available ? `古代邪物需消化100（当前${s.progression.acting}/100）、晋2后12整周（当前${ancientEvilWeeks(s)}/12），完成三份旧报告与反思；另须三项专业准备和当周场地检查。` : '先完成古代邪物的实际经历。',
    pollution: s.seer.pollution, risk: available ? abominationConsumptionRisk() : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    characterName: s.character.name, currentGender: s.character.gender,
    appearanceRecord: available ? `${s.character.name}，原创建年龄${s.character.age}岁；当前${s.character.gender === 'FEMALE' ? '女性' : '男性'}。晋升不改变性别、姓名、年龄、性格与取向，旧伤仍须正常休养。` : '',
    injuries: available ? s.injuries.map(i => ({ id: i.id, severity: i.severity, treated: i.treatedRevision !== null })) : [], injuryRisk: s.injuryRisk,
    inheritedTools: available ? '八阶独立原瓶、同一原安静室、埃尔莎、哈伦、原衣、原包、原盘与原记录逐一保留来源。衣物和包仍属埃尔莎，旧木块保持耗尽；旧伤和旧人物结果不刷新。每案重新取得可撤回许可并实际购入一件新耗材及其唯一测试源；只记录本阶段真实协作的累计耗力。' : '',
    inheritedHistory: available ? [
      `古代邪物在第${s.ancientEvil.promotionWeek}周实际晋升；${promoted ? `原消化${state.ancientEvilActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从这次晋升计算。`,
      '前八阶19项掌握保持原值，原零项不补齐；成功晋升只增加两项零掌握。',
      `原安静室本人实际步行${abominationOriginals(s).site.playerTravelMetres}米、原现场时间${abominationOriginals(s).site.clockSeconds}秒；原衣与原包仍属同一埃尔莎，旧木块${abominationOriginals(s).blocks.filter(b => b.status === 'SPENT').length}块已耗尽。`,
      '莱娜原死亡及遗落兵器、卡尔德原投降与未治疗旧伤继续保留。新庭院遭遇有自己的成年人、原杖和有限护片；旧记录不会复活或重开。',
    ] : [],
    life: projectAbominationLife(s), encounter: projectAbominationEncounter(s), insideCase: hasAbominationLock(s),
    environment: available ? ABOMINATION_SOURCE_STATUS : '',
  };
}

/** Chronology is checked separately from deterministic per-command replay. */
export function validateAbominationJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.abomination.acquisitionJournal;
    let cursor = 0;
    for (let n = 0; n < events.length; n++) {
      const event = events[n]!, previous = events[n - 1];
      if (previous) {
        if (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || previous.after.sequence === 1 || event.before.gender !== previous.after.gender) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && (!same(event.before, previous.after) || event.cursorBefore !== previous.cursorAfter)) return false;
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
    type SharedBudget = Pick<AbominationAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { week: number; date: PublicGameDate; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null; maxDraws?: number };
    const shared = (budget: SharedBudget): SharedBudget => ({ actions: budget.actions, health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash });
    const timeline: Timeline[] = events.map(event => ({ week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.cursorAfter }));
    const promotion = events.find(event => event.after.sequence === 1);
    for (const event of s.abomination.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      timeline.push({ week: event.week, date: event.date, revision: event.revision, before: shared(event.before), after: shared(event.after),
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: event.randomAfter ?? event.randomCursor, maxDraws: event.command.type === 'BRIEF_CRY' ? 2 : 1 });
    }
    const encounter = s.abomination.encounter, preparation = encounter.preparation;
    const reflection = s.abomination.life.journal.find(event => event.command.type === 'REFLECT');
    if (preparation) {
      // Encounter receipts store resulting revisions; acquisition/life store input revisions.
      if (!promotion || !reflection || preparation.revision - 1 <= reflection.revision || preparation.week < reflection.week || compareGameDates(preparation.date, reflection.date) < 0) return false;
      timeline.push({ week: preparation.week, date: preparation.date, revision: preparation.revision - 1,
        before: shared(preparation.before), after: shared(preparation.after), randomBefore: null, randomAfter: null, recordedCursor: preparation.randomCursor });
      for (const event of encounter.journal) timeline.push({ week: event.week, date: event.date, revision: event.revision - 1,
        before: shared(event.before), after: shared(event.after), randomBefore: null, randomAfter: null, recordedCursor: event.randomCursor });
    }
    timeline.sort((a, b) => a.revision - b.revision);
    cursor = 0; let exactCursor: number | null = null;
    for (let n = 0; n < timeline.length; n++) {
      const event = timeline[n]!, previous = timeline[n - 1];
      const adjacent = !!previous && event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0;
      if (!adjacent) exactCursor = null;
      if (previous && (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || adjacent && !same(event.before, previous.after))) return false;
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || !integer(event.randomAfter, event.randomBefore + 1, event.randomBefore + (event.maxDraws ?? 1)) || !integer(event.randomAfter, 0, s.random.cursor) || exactCursor !== null && event.randomBefore !== exactCursor) return false;
        cursor = event.randomAfter; exactCursor = event.randomAfter;
      }
      if (event.recordedCursor !== null) {
        if (!integer(event.recordedCursor, cursor, s.random.cursor) || exactCursor !== null && event.recordedCursor !== exactCursor) return false;
        cursor = event.recordedCursor; exactCursor = event.recordedCursor;
      }
    }
    const tail = timeline.at(-1);
    if (tail && s.revision === tail.revision + 1 && s.week === tail.week && tail.after.actions > 0 &&
      (!same(s.date, tail.date) || !same(shared(abominationAcquisitionBudget(s)), tail.after) || exactCursor !== null && exactCursor !== s.random.cursor)) return false;
    return true;
  } catch { return false; }
}


/** All eight predecessor roots remain exact. The separately cloned new site
 * and inventory are the only live continuation after promotion. */
export function validateAbominationSource(s: SliceState): boolean {
  try {
    const state = s.abomination, history = state.sourceHistory, scene = state.sourceScene, first = state.acquisitionJournal[0];
    if (!history || !scene || !first || !shape(history, ABOMINATION_SOURCE_KEYS) ||
      !shape(scene, ['week', 'date', 'revision', 'random', 'budget', 'identityDigest', 'historyDigest', 'character', 'originals', 'combatHistoryLength', 'combatHistoryDigest', 'city', 'finance']) ||
      !shape(scene.random, ['seed', 'cursor']) || scene.random.seed !== s.random.seed || !integer(scene.random.cursor, 0, s.random.cursor) ||
      !integer(scene.combatHistoryLength, 0, s.combatHistory.length) || scene.combatHistoryDigest !== sha256Hex(stableStringify(s.combatHistory.slice(0, scene.combatHistoryLength))) ||
      scene.city !== 'BACKLUND' || scene.identityDigest !== sourceIdentityDigest(s) || scene.historyDigest !== sourceHistoryDigest(s) ||
      !shape(scene.originals, ['site', 'operation', 'blocks']) || !sourceClosed(scene.originals) || !validFinance(scene.finance, scene.week) || !same(scene.finance, first.finance) ||
      !same(scene.originals, abominationOriginals({ ...s, ...history })) ||
      scene.character.gender !== scene.budget.gender || !same(scene.character.coreStats, scene.budget.coreStats) ||
      sourceIdentityDigest({ ...s, character: scene.character }) !== scene.identityDigest || first.command.type !== 'LEARN_GUIDANCE' ||
      scene.week !== first.week || scene.revision !== first.revision || !same(scene.date, first.date) ||
      !same(scene.budget, first.before) || scene.random.cursor !== first.cursorBefore || first.actor.sourceHistoryDigest !== scene.historyDigest) return false;
    const historical = abominationInheritedView(s);
    if (![validatePrisonerState, validateMadmanState, validateWerewolfState, validateZombieState, validateWraithState,
      validatePuppetState, validateSilentDiscipleState, validateAncientEvilState].every(validate => validate(historical))) return false;
    return same(abominationSourceHistory(s), history) && same(abominationOriginals(s), scene.originals);

  } catch { return false; }
}

export const validateAbominationInheritedState = validateAbominationSource;
/** Historical validation reads the genuine paid-guidance S2 checkpoint. This
 * view never writes to the live state, and never invents predecessor actions. */
export function abominationInheritedView(s: SliceState): SliceState {
  const { sourceHistory: history, sourceScene: scene } = s.abomination;
  if ((!isAbomination(s) && !isAbominationAcquisitionStage(s)) || !s.abomination.guidanceKnown || !history || !scene) return s;
  const budget = scene.budget;
  return { ...s, ...structuredClone(history), status: 'ACTIVE', week: scene.week, date: structuredClone(scene.date), revision: scene.revision,
    health: budget.health, mind: budget.mind, spirituality: budget.spirituality, cash: budget.cash, actionsRemaining: budget.actions,
    injuries: structuredClone(budget.injuries), injuryRisk: budget.injuryRisk, random: { ...scene.random },
    activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE', ending: null,
    ...structuredClone(scene.finance), world: { ...s.world, city: 'BACKLUND' }, character: structuredClone(scene.character),
    progression: { ...s.progression, pathwayId: 'chained', sequence: 2, acting: budget.acting, mastery: { ...budget.mastery } },
    seer: { ...s.seer, pollution: budget.pollution, completedSources: [...budget.completedSources] },
    combatHistory: s.combatHistory.slice(0, scene.combatHistoryLength), abomination: createAbominationState() };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateAbominationState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.abomination;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'sourceWeek', 'bottles', 'resupply', 'promotionWeek', 'ancientEvilActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'sourceHistory', 'sourceScene', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== ABOMINATION_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as AbominationState, promoted = isAbomination(s), acquisitionStage = isAbominationAcquisitionStage(s);
  const firstWeek = s.ancientEvil.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + ABOMINATION_MIN_ANCIENT_EVIL_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !validateAbominationSource(s) || !integer(state.sourceWeek, firstWeek, lastAcquisitionWeek))) return false;
  if (!state.guidanceKnown && (state.sourceHistory !== null || state.sourceScene !== null || state.sourceWeek !== null)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > ABOMINATION_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !ABOMINATION_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasAbominationOldPractice(s) || hasAbominationLifeLock(s) || hasAbominationEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.ancientEvil.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.ancientEvilActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !ancientEvilReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...ABOMINATION_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.ancientEvilActingAtPromotion !== null || ABOMINATION_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `abomination-potion-${index + 1}` || !integer(b.labourSteps, 0, ABOMINATION_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < ABOMINATION_BOTTLE_IDS.length) {
      if (state.guidanceKnown ? b.stockedWeek !== state.sourceWeek || b.source !== abominationPotionSource(index + 1, state.sourceWeek!) : b.stockedWeek !== null || b.source !== ABOMINATION_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(s, index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % ABOMINATION_BOTTLE_IDS.length;
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
        if (!integer(s.ancientEvil.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateAbominationAcquisitionJournal(s) || !validateAbominationJournalContinuity(s) || !validateAbominationLifeState(s) || !validateAbominationEncounterState(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting || !s.seer.completedSources.includes('chained-s1')) return false;
    const promotedReceipt = state.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.after.sequence === 1);
    if (!promotedReceipt) return false;
    const expectedMastery = { ...promotedReceipt.after.mastery };
    for (const [id, gain] of Object.entries(abominationLifeMasteryGains(s))) {
      if (!ABOMINATION_ABILITY_IDS.includes(id as typeof ABOMINATION_ABILITY_IDS[number]) || !integer(gain, 0, 24)) return false;
      expectedMastery[id] = Math.min(500, expectedMastery[id]! + gain);
    }
    for (const round of s.combatHistory) if (round.abominationOutcome) {
      for (const action of [...round.abominationOutcome.playerActions, ...round.abominationOutcome.enemyActions]) {
        for (const id of action.masteryApplied) expectedMastery[id] = Math.min(500, expectedMastery[id]! + 8);
      }
    }
    if (!same(s.progression.mastery, expectedMastery)) return false;
  }
  if (!promoted && s.seer.completedSources.includes('chained-s1')) return false;
  return true;
}
export { ABOMINATION_ABILITIES } from './content.js';
export { ABOMINATION_ABILITY_IDS } from './types.js';
export type * from './types.js';

export const handleAbomination = applyAbominationCommand;

/** Historical membership accepts the actual sequence-one record; current commands remain exact-stage gated. */
export const validateAbominationHistory = validateAbominationState;
