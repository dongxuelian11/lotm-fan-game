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
import { hasUnagingDemonessOldPractice, hasUnagingDemonessRitualLock } from '../unaging-demoness/index.js';
import { hasUnagingDemonessLifeLock } from '../unaging-demoness/life.js';
import { hasUnagingDemonessEncounterLock } from '../unaging-demoness/encounter.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createCalamityDemonessLifeState, handleCalamityDemonessLife, projectCalamityDemonessLife, calamityDemonessLifeActions, validateCalamityDemonessLifeState, validateCalamityDemonessActivityCommand, hasCalamityDemonessLifeLock } from './life.js';
import { createCalamityDemonessEncounterState, applyCalamityDemonessEncounterCommand, projectCalamityDemonessEncounter, calamityDemonessEncounterActions, validateCalamityDemonessEncounter, validateCalamityDemonessEncounterCommand, hasCalamityDemonessEncounterLock } from './encounter.js';
import { CALAMITY_DEMONESS_ABILITIES, CALAMITY_DEMONESS_INHERITED_ABILITIES, CALAMITY_DEMONESS_BOTTLE_IDS, CALAMITY_DEMONESS_CONSUMPTION_RISK, CALAMITY_DEMONESS_FORMULA_STATUS, CALAMITY_DEMONESS_GUIDE, CALAMITY_DEMONESS_LABOUR_STEPS, CALAMITY_DEMONESS_LABOUR_TASKS, CALAMITY_DEMONESS_MIN_UNAGING_DEMONESS_WEEKS, CALAMITY_DEMONESS_POTION_SOURCES, CALAMITY_DEMONESS_PREPARATIONS, CALAMITY_DEMONESS_PRICES, CALAMITY_DEMONESS_SOURCE_STATUS } from './content.js';
import { CALAMITY_DEMONESS_ABILITY_IDS, CALAMITY_DEMONESS_PREPARATION_IDS, type CalamityDemonessAcquisitionBudget, type CalamityDemonessAcquisitionEvent, type CalamityDemonessAcquisitionCommand, type CalamityDemonessAction, type CalamityDemonessBottle, type CalamityDemonessCommand, type CalamityDemonessProjection, type CalamityDemonessState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const CALAMITY_DEMONESS_INHERITED_ABILITY_IDS = [...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS, ...WITCH_ABILITY_IDS, ...PLEASURE_ABILITY_IDS, ...PAIN_ABILITY_IDS, ...DESPAIR_ABILITY_IDS, ...UNAGING_DEMONESS_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = CALAMITY_DEMONESS_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): CalamityDemonessBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createCalamityDemonessState(): CalamityDemonessState {
  return { guidanceKnown: false, bottles: CALAMITY_DEMONESS_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, unagingDemonessActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], life: createCalamityDemonessLifeState(), encounter: createCalamityDemonessEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isCalamityDemoness = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 2;
export const isCalamityDemonessAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 3;
export const hasCalamityDemonessHistory = (s: SliceState) => isCalamityDemoness(s) && s.calamityDemoness.promotionWeek !== null;
/** Original finished bottles and the two actually brewed stages have distinct histories.
 * Neither a brewedWeek nor an acquiredWeek is invented for a source that never stored it. */
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
  for (const stage of [s.pain, s.despair, s.unagingDemoness]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.instigator.assassinActingAtPromotion === 100 && s.witch.instigatorActingAtPromotion === 100 &&
    s.pleasure.witchActingAtPromotion === 100 && s.pain.pleasureActingAtPromotion === 100 &&
    s.despair.painActingAtPromotion === 100 && s.unagingDemoness.despairActingAtPromotion === 100;
}
const knownChannel = (s: SliceState) => (isCalamityDemonessAcquisitionStage(s) || isCalamityDemoness(s)) && sourceHistory(s);
/** These remain historical locks; none widens the exact-stage predecessor command gates. */
export function hasCalamityDemonessOldPractice(s: SliceState): boolean {
  return hasUnagingDemonessOldPractice(s) || hasUnagingDemonessRitualLock(s) || hasUnagingDemonessLifeLock(s) || hasUnagingDemonessEncounterLock(s) ||
    s.assassin.draft.custodian === 'PLAYER' || s.pleasure.practice.wrist !== 'FREE' ||
    Object.values(s.pleasure.cases).some(c => c.contactOpen) || Object.values(s.pain.cases).some(c => c.contactOpen) ||
    s.unagingDemoness.life.entry.held || s.unagingDemoness.life.playerLocation !== 'START' ||
    s.unagingDemoness.life.shutter.state !== 'OPEN' ||
    Object.values(s.unagingDemoness.life.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.status === 'ACTIVE');
}
const unagingDemonessReportsComplete = (s: SliceState) => s.unagingDemoness.life.reflected &&
  Object.values(s.unagingDemoness.life.cases).length === 3 && Object.values(s.unagingDemoness.life.cases).every(c => c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.closes === 1);
export const hasCalamityDemonessOldSceneLock = hasCalamityDemonessOldPractice;
export const hasCalamityDemonessRitualLock = (s: SliceState): boolean => s.calamityDemoness.preparedWeek !== null;
export const hasCalamityDemonessLock = (s: SliceState): boolean => hasCalamityDemonessRitualLock(s) || hasCalamityDemonessLifeLock(s) || hasCalamityDemonessEncounterLock(s);
const bottleNumber = (b: Pick<CalamityDemonessBottle, 'id'>) => Number(b.id.slice('calamity-demoness-potion-'.length));
const potionPrice = (b: CalamityDemonessBottle) => CALAMITY_DEMONESS_PRICES.potion - (b.labourSteps === CALAMITY_DEMONESS_LABOUR_STEPS ? CALAMITY_DEMONESS_PRICES.labourCredit : 0);
const unagingDemonessWeeks = (s: SliceState) => Math.max(0, (s.calamityDemoness.promotionWeek ?? s.week) - (s.unagingDemoness.promotionWeek ?? s.week));
const exhaustedSupply = (state: CalamityDemonessState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${CALAMITY_DEMONESS_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列2灾难魔女成品，独立封存编号calamity-demoness-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => CALAMITY_DEMONESS_PREPARATION_IDS.every(id => s.calamityDemoness.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `不老魔女魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.unagingDemoness.promotionWeek === null || unagingDemonessWeeks(s) < CALAMITY_DEMONESS_MIN_UNAGING_DEMONESS_WEEKS) return `成为不老魔女后已过${unagingDemonessWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!unagingDemonessReportsComplete(s)) return '先完成不老魔女的三份实际报告与反思，并收好旧训练现场。';
  return hasPreparations(s) ? null : '先分别完成原镜来源核对、封闭处置规划与普通返回路线检查；领取药瓶不能代做专业准备。';
}
export function validateCalamityDemonessAcquisitionCommand(v: unknown): v is CalamityDemonessAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && CALAMITY_DEMONESS_PREPARATION_IDS.includes(v.taskId as typeof CALAMITY_DEMONESS_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^calamity-demoness-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isCalamityDemonessAcquisitionCommand = validateCalamityDemonessAcquisitionCommand;
export function validateCalamityDemonessCommand(v: unknown): v is CalamityDemonessCommand {
  return validateCalamityDemonessAcquisitionCommand(v) || validateCalamityDemonessActivityCommand(v) || validateCalamityDemonessEncounterCommand(v);
}
export function calamityDemonessAcquisitionBlock(s: SliceState, command: CalamityDemonessAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: CalamityDemonessAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateCalamityDemonessAcquisitionCommand(command)) return '灾难魔女准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasCalamityDemonessOldPractice(s)) || hasCalamityDemonessLifeLock(s) || hasCalamityDemonessEncounterLock(s)) return '先停止旧镜路、丝线和原场接触，归还借物并沿普通路线离开；当前实践也须收尾。旧人物、原镜和伤势继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德灾难魔女专业交接处。';
  if (!knownChannel(s)) return '实际成为不老魔女并保留原指导渠道后，才能了解灾难魔女之路。';
  if (!isCalamityDemonessAcquisitionStage(s)) return '已经晋升灾难魔女2，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '刺客至不老魔女的16项掌握记录不完整，暂不能继续晋升。';
  const state = s.calamityDemoness;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < CALAMITY_DEMONESS_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的灾难魔女原瓶。';
    return s.cash < CALAMITY_DEMONESS_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批灾难魔女原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的灾难魔女准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选灾难魔女独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= CALAMITY_DEMONESS_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: CalamityDemonessAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.calamityDemoness;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= CALAMITY_DEMONESS_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取灾难魔女独立成品与专业准备指导', `花1行动、500便士。${CALAMITY_DEMONESS_GUIDE}说明原渠道记录。${CALAMITY_DEMONESS_FORMULA_STATUS}${CALAMITY_DEMONESS_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = CALAMITY_DEMONESS_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= CALAMITY_DEMONESS_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(CALAMITY_DEMONESS_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('灾难魔女独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批灾难魔女成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < CALAMITY_DEMONESS_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`calamity-demoness-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶灾难魔女原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.unagingDemonessActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of CALAMITY_DEMONESS_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为灾难魔女', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；不老魔女消化100与原16项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满，女巫时期的身体变化与当前女性状态保持。过去七阶的原瓶、材料、粉剂、丝线、同一对原镜、同意与拒绝、人物身体和原敌伤亡记录全部留存。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '灾难魔女魔药严重排异' : '灾难魔女魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为不老魔女，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): CalamityDemonessAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, sequence: s.progression.sequence as 3 | 2, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: CalamityDemonessState) {
  return { guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, unagingDemonessActingAtPromotion: state.unagingDemonessActingAtPromotion,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyCalamityDemonessAcquisition(s: SliceState, command: CalamityDemonessAcquisitionCommand, ctx: SeerContext): void {
  const reason = calamityDemonessAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const before = acquisitionBudget(s), actor: CalamityDemonessAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, pathwayId: 'demoness',
    unagingDemonessPromotionWeek: s.unagingDemoness.promotionWeek!, assassinPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.calamityDemoness.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: acquisitionBudget(s), randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is CalamityDemonessAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    (v.sequence !== 3 && v.sequence !== 2) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 2 ? CALAMITY_DEMONESS_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateCalamityDemonessAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.calamityDemoness.acquisitionJournal, expected = createCalamityDemonessState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: CalamityDemonessAcquisitionEvent | null = null, nextCursor = 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.unagingDemoness.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateCalamityDemonessAcquisitionCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 3 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'pathwayId', 'unagingDemonessPromotionWeek', 'assassinPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== s.character.gender ||
        raw.actor.pathwayId !== 'demoness' || raw.actor.unagingDemonessPromotionWeek !== s.unagingDemoness.promotionWeek || raw.actor.assassinPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as CalamityDemonessAcquisitionEvent;
      if (previous) {
        if (event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || event.revision <= previous.revision || previous.after.sequence === 2) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id]! < previous!.after.mastery[id]!) ||
          !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
        // A prepared site forbids intervening work or recovery; cancellation and drinking consume this exact budget.
        if (expected.preparedWeek !== null && (event.week !== previous.week || !same(event.date, previous.date) || !same(event.before, previous.after))) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && !same(event.before, previous.after)) return false;
      }
      const b = event.before;
      const shadow: SliceState = { ...s, status: 'ACTIVE', week: event.week, date: structuredClone(event.date), revision: event.revision,
        health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actionsRemaining: b.actions,
        injuries: structuredClone(b.injuries), injuryRisk: b.injuryRisk, activeEvent: null, combat: null, eventQueue: [], pulse: 'NONE',
        world: { ...s.world, city: 'BACKLUND' }, random: { seed: s.random.seed, cursor: event.randomBefore ?? 0 },
        character: { ...s.character, name: event.actor.name, gender: event.actor.gender, coreStats: { ...b.coreStats } },
        progression: { ...s.progression, pathwayId: 'demoness', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, calamityDemoness: expected };
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
      previous = event;
    }
    if (!same(acquisitionState(expected), acquisitionState(s.calamityDemoness))) return false;
    if (previous) {
      // Other, already-authorized play may add growth, but cannot erase this inherited prefix.
      if (INHERITED_ABILITY_IDS.some(id => !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500)) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.calamityDemoness.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      if (isCalamityDemoness(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 2 || previous.after.acting !== 0 ||
        !CALAMITY_DEMONESS_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.calamityDemoness.unagingDemonessActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.calamityDemoness.guidanceKnown || isCalamityDemoness(s)) return false;
    return true;
  } catch { return false; }
}

export function applyCalamityDemonessCommand(s: SliceState, command: CalamityDemonessCommand, ctx: SeerContext): void {
  if (!validateCalamityDemonessCommand(command)) throw new Error('灾难魔女命令无效。');
  if (validateCalamityDemonessAcquisitionCommand(command)) return applyCalamityDemonessAcquisition(s, command, ctx);
  if (validateCalamityDemonessActivityCommand(command)) return handleCalamityDemonessLife(s, command, ctx);
  if (validateCalamityDemonessEncounterCommand(command)) return applyCalamityDemonessEncounterCommand(s, command, ctx);
  throw new Error('未知灾难魔女命令。');
}

export function projectCalamityDemoness(s: SliceState): CalamityDemonessProjection {
  const state = s.calamityDemoness, available = knownChannel(s), promoted = isCalamityDemoness(s), actions: CalamityDemonessAction[] = [];
  const add = (id: string, label: string, cost: string, command: CalamityDemonessAcquisitionCommand) => { const reason = calamityDemonessAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-calamity-demoness-guidance', '听取灾难魔女成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of CALAMITY_DEMONESS_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`calamity-demoness-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-calamity-demoness-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-calamity-demoness-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-calamity-demoness-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-calamity-demoness-supply', '申请下一批独立灾难魔女成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${CALAMITY_DEMONESS_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶灾难魔女魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 不老魔女消化${s.progression.acting}/100 · ${unagingDemonessWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '灾难魔女·魔女序列2', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${CALAMITY_DEMONESS_FORMULA_STATUS}${CALAMITY_DEMONESS_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available ? [...actions, ...calamityDemonessLifeActions(s), ...calamityDemonessEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 灾难魔女成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为不老魔女' : '排异，仍为不老魔女'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? CALAMITY_DEMONESS_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...CALAMITY_DEMONESS_INHERITED_ABILITIES, ...CALAMITY_DEMONESS_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `不老魔女消化${state.unagingDemonessActingAtPromotion}/100留存；灾难魔女扮演${s.progression.acting}/100。三项报告各25、反思25；普通完成同样可消化，掌握只计实际能力应用。` : available ? `不老魔女需消化100（当前${s.progression.acting}/100）、晋3后12整周（当前${unagingDemonessWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完不老魔女之路。',
    pollution: s.seer.pollution, risk: available ? CALAMITY_DEMONESS_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    appearanceRecord: available ? `第${s.unagingDemoness.promotionWeek}周登记的不老魔女外观记录保留；原创建年龄${s.character.age}岁，当前性别${s.character.gender}。既往身体履历不重写，本次晋升不重复女巫身体转变。` : '',
    inheritedHistory: available ? [
      `不老魔女在第${s.unagingDemoness.promotionWeek}周晋升；${promoted ? `当时消化${state.unagingDemonessActingAtPromotion}/100已留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      `历阶消化：刺客${s.instigator.assassinActingAtPromotion}、教唆者${s.witch.instigatorActingAtPromotion}、女巫${s.pleasure.witchActingAtPromotion}、欢愉魔女${s.pain.pleasureActingAtPromotion}、痛苦魔女${s.despair.painActingAtPromotion}、绝望魔女${s.unagingDemoness.despairActingAtPromotion}、不老魔女${promoted ? state.unagingDemonessActingAtPromotion : s.progression.acting}。`,
      '前七阶16项技巧保持原身份与掌握，两项新技巧从0开始，共18项。原镜界通行掌握不会因晋升重置或自动增加。',
      `原女巫身体记录：晋升前性别${s.witch.previousGender ?? '尚未记录'}；当前性别${s.character.gender}，原创建年龄${s.character.age}。本次不重复身体转变。`,
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；现有伤势${s.injuries.length}处，累计风险${s.injuryRisk}。旧伤须实际诊疗和休养。`,
      `旧馆舍记录中的两面原镜${s.unagingDemoness.life.mirrorA.id}与${s.unagingDemoness.life.mirrorB.id}均属${s.unagingDemoness.life.mirrorA.owner}，原镜A${s.unagingDemoness.life.mirrorA.intact ? '完好' : '破损'}、原镜B${s.unagingDemoness.life.mirrorB.intact ? '完好' : '破损'}。同一对原镜此后的状态见附室记录。`,
      `原馆舍的维瑞娜${s.unagingDemoness.life.vera.age}岁、马库斯${s.unagingDemoness.life.marcus.age}岁；他们保有同一身体，旧许可不会替代当前同意。原画像${s.unagingDemoness.life.portrait.id}、封包${s.unagingDemoness.life.parcel.id}与登记册${s.unagingDemoness.life.register.id}仍留在各自旧记录中。`,
      `原工具库存：粉剂${s.witch.tools.powderHeld}份、小镜${s.witch.tools.mirrorsHeld}面，已耗粉剂${s.witch.tools.powderUsed}份、小镜${s.witch.tools.mirrorsUsed}面；原小镜${s.witch.tools.mirrorPrepared ? '已准备' : '未准备'}，没有补回。`,
      `原科宾健康${s.unagingDemoness.encounter.enemyHealth}/100、精神${s.unagingDemoness.encounter.enemyMind}/100、灵性${s.unagingDemoness.encounter.enemySpirituality}；${s.unagingDemoness.encounter.enemyStatus === 'DEAD' ? '已经死亡' : s.unagingDemoness.encounter.enemyStatus === 'SURRENDERED' ? '已经投降' : '保留原接触结果'}。他的原棍、伤势与结局继续留在旧小院。`,
      `原瓦伦健康${s.despair.encounter.enemyHealth}/100、精神${s.despair.encounter.enemyMind}/100、灵性${s.despair.encounter.enemySpirituality}，原伤势${s.despair.encounter.enemyInjuries.length}处，当前病势${s.despair.encounter.enemyDisease}；旧病史、照护与终局均保留。`,
    ] : [],
    life: projectCalamityDemonessLife(s), encounter: projectCalamityDemonessEncounter(s), insideCase: hasCalamityDemonessLock(s),
    environment: available ? '镜廊附室CD2-GALLERY-ANNEX：门口0米，原镜A4米，封闭箱8米，原镜B12米，室外−2米，庭院−4米。46岁的原物主维瑞娜与41岁的原观察员马库斯须从旧位置实际到场，并分别表达当前意愿。每案花20便士取得唯一保护插片，负载、残留物、精力、原镜和普通退出路线均有真实边界。' : '',

  };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateCalamityDemonessState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.calamityDemoness;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'unagingDemonessActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== CALAMITY_DEMONESS_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as CalamityDemonessState, promoted = isCalamityDemoness(s), acquisitionStage = isCalamityDemonessAcquisitionStage(s);
  const firstWeek = s.unagingDemoness.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + CALAMITY_DEMONESS_MIN_UNAGING_DEMONESS_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > CALAMITY_DEMONESS_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !CALAMITY_DEMONESS_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasCalamityDemonessOldPractice(s) || hasCalamityDemonessLifeLock(s) || hasCalamityDemonessEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.unagingDemoness.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.unagingDemonessActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !unagingDemonessReportsComplete(s) || hasCalamityDemonessOldPractice(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...CALAMITY_DEMONESS_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.unagingDemonessActingAtPromotion !== null || CALAMITY_DEMONESS_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `calamity-demoness-potion-${index + 1}` || !integer(b.labourSteps, 0, CALAMITY_DEMONESS_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < CALAMITY_DEMONESS_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== CALAMITY_DEMONESS_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % CALAMITY_DEMONESS_BOTTLE_IDS.length;
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
        if (!integer(s.unagingDemoness.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateCalamityDemonessAcquisitionJournal(s) || !validateCalamityDemonessLifeState(s) || !validateCalamityDemonessEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { CALAMITY_DEMONESS_ABILITIES } from './content.js';
export { CALAMITY_DEMONESS_ABILITY_IDS } from './types.js';
export type * from './types.js';
