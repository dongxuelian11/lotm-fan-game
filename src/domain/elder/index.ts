import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../secret-supplicant/types.js';
import { LISTENER_ABILITY_IDS } from '../listener/types.js';
import { SHADOW_ASCETIC_ABILITY_IDS } from '../shadow-ascetic/types.js';
import { ROSE_BISHOP_ABILITY_IDS } from '../rose-bishop/types.js';
import { SHEPHERD_ABILITY_IDS } from '../shepherd/types.js';
import { BLACK_KNIGHT_ABILITY_IDS } from '../black-knight/types.js';
import { THREE_HEADED_TEMPLAR_ABILITY_IDS } from '../three-headed-templar/types.js';
import { hasThreeHeadedTemplarOldPractice, hasThreeHeadedTemplarRitualLock } from '../three-headed-templar/index.js';
import { hasThreeHeadedTemplarLifeLock } from '../three-headed-templar/life.js';
import { hasThreeHeadedTemplarEncounterLock } from '../three-headed-templar/encounter.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createElderLifeState, handleElderLife, projectElderLife, elderLifeActions, validateElderLifeState, validateElderActivityCommand, hasElderLifeLock } from './life.js';
import { createElderEncounterState, applyElderEncounterCommand, projectElderEncounter, elderEncounterActions, validateElderEncounter, validateElderEncounterCommand, hasElderEncounterLock } from './encounter.js';
import { ELDER_ABILITIES, ELDER_INHERITED_ABILITIES, ELDER_BOTTLE_IDS, ELDER_CONSUMPTION_RISK, ELDER_FORMULA_STATUS, ELDER_GUIDE, ELDER_LABOUR_STEPS, ELDER_LABOUR_TASKS, ELDER_MIN_THREE_HEADED_TEMPLAR_WEEKS, ELDER_POTION_SOURCES, ELDER_PREPARATIONS, ELDER_PRICES, ELDER_SOURCE_STATUS } from './content.js';
import { ELDER_ABILITY_IDS, ELDER_PREPARATION_IDS, type ElderAcquisitionBudget, type ElderAcquisitionEvent, type ElderAcquisitionCommand, type ElderAction, type ElderBottle, type ElderCommand, type ElderProjection, type ElderState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const ELDER_INHERITED_ABILITY_IDS = [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS, ...SHADOW_ASCETIC_ABILITY_IDS, ...ROSE_BISHOP_ABILITY_IDS, ...SHEPHERD_ABILITY_IDS, ...BLACK_KNIGHT_ABILITY_IDS, ...THREE_HEADED_TEMPLAR_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = ELDER_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): ElderBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createElderState(): ElderState {
  return { guidanceKnown: false, bottles: ELDER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, threeHeadedTemplarActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], life: createElderLifeState(), encounter: createElderEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isElder = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 2;
export const isElderAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 3;
export const hasElderHistory = (s: SliceState) => isElder(s) && s.elder.promotionWeek !== null;
/** The seven actual Hanged Man finished-potion histories retain their distinct original bottles. */
function sourceHistory(s: SliceState): boolean {
  if (!s.secretSupplicant.discovered || !s.secretSupplicant.guidanceKnown) return false;
  const first = s.secretSupplicant.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || !integer(first[0]!.consumedWeek, 1, s.week) || first[0]!.consumedWeek !== s.progression.promotionWeek ||
    !integer(first[0]!.acquiredWeek, 1, first[0]!.consumedWeek)) return false;
  let previous = first[0]!.consumedWeek!;
  for (const stage of [s.listener, s.shadowAscetic, s.roseBishop, s.shepherd, s.blackKnight, s.threeHeadedTemplar]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.listener.secretSupplicantActingAtPromotion === 100 && s.shadowAscetic.listenerActingAtPromotion === 100 &&
    s.roseBishop.shadowAsceticActingAtPromotion === 100 && s.shepherd.roseBishopActingAtPromotion === 100 &&
    s.blackKnight.shepherdActingAtPromotion === 100 && s.threeHeadedTemplar.blackKnightActingAtPromotion === 100;
}
const knownChannel = (s: SliceState) => (isElderAcquisitionStage(s) || isElder(s)) && sourceHistory(s);
/** These remain historical locks; none widens the exact-stage predecessor command gates. */
export function hasElderOldPractice(s: SliceState): boolean {
  return hasThreeHeadedTemplarOldPractice(s) || hasThreeHeadedTemplarRitualLock(s) || hasThreeHeadedTemplarLifeLock(s) || hasThreeHeadedTemplarEncounterLock(s) ||
    s.threeHeadedTemplar.life.playerLocation !== 'START' || Object.values(s.threeHeadedTemplar.life.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.status === 'ACTIVE');
}
const threeHeadedTemplarReportsComplete = (s: SliceState) => s.threeHeadedTemplar.life.reflected &&
  Object.values(s.threeHeadedTemplar.life.cases).length === 3 && Object.entries(s.threeHeadedTemplar.life.cases).every(([id, c]) => c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.closes === 1 &&
    c.attempts.every(attempt => attempt.week <= s.week) && s.seer.completedSources.includes(`three-headed-templar-life-${id}`)) &&
  s.seer.completedSources.includes('three-headed-templar-reflection');
export const hasElderOldSceneLock = hasElderOldPractice;
export const hasElderRitualLock = (s: SliceState): boolean => s.elder.preparedWeek !== null;
export const hasElderLock = (s: SliceState): boolean => hasElderRitualLock(s) || hasElderLifeLock(s) || hasElderEncounterLock(s);
const bottleNumber = (b: Pick<ElderBottle, 'id'>) => Number(b.id.slice('elder-potion-'.length));
const potionPrice = (b: ElderBottle) => ELDER_PRICES.potion - (b.labourSteps === ELDER_LABOUR_STEPS ? ELDER_PRICES.labourCredit : 0);
const threeHeadedTemplarWeeks = (s: SliceState) => Math.max(0, (s.elder.promotionWeek ?? s.week) - (s.threeHeadedTemplar.promotionWeek ?? s.week));
const exhaustedSupply = (state: ElderState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${ELDER_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列2秽语长老成品，独立封存编号elder-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => ELDER_PREPARATION_IDS.every(id => s.elder.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `三首圣堂魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.threeHeadedTemplar.promotionWeek === null || threeHeadedTemplarWeeks(s) < ELDER_MIN_THREE_HEADED_TEMPLAR_WEEKS) return `成为三首圣堂后已过${threeHeadedTemplarWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!threeHeadedTemplarReportsComplete(s)) return '先完成三首圣堂的三份实际报告与反思，并收好旧训练现场。';
  return hasPreparations(s) ? null : '先分别核对原瓶与原灵记录、低语及合唱边界和普通离场路线；领取药瓶不能代做专业准备。';
}
export function validateElderAcquisitionCommand(v: unknown): v is ElderAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && ELDER_PREPARATION_IDS.includes(v.taskId as typeof ELDER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^elder-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isElderAcquisitionCommand = validateElderAcquisitionCommand;
export function validateElderCommand(v: unknown): v is ElderCommand {
  return validateElderAcquisitionCommand(v) || validateElderActivityCommand(v) || validateElderEncounterCommand(v);
}
export function elderAcquisitionBlock(s: SliceState, command: ElderAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: ElderAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateElderAcquisitionCommand(command)) return '秽语长老准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasElderOldPractice(s)) || hasElderLifeLock(s) || hasElderEncounterLock(s)) return '先收束旧祈仪、原身体变形、原影与原灵外放，归还借物并沿普通路线离开；当前实践也须收尾。旧人物、原灵、原物与伤势继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德秽语长老专业交接处。';
  if (!knownChannel(s)) return '实际成为三首圣堂并保留原指导渠道后，才能了解秽语长老之路。';
  if (!isElderAcquisitionStage(s)) return '已经晋升秽语长老2，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '秘祈人至三首圣堂的13项掌握记录不完整，暂不能继续晋升。';
  const state = s.elder;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < ELDER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的秽语长老原瓶。';
    return s.cash < ELDER_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批秽语长老原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的秽语长老准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选秽语长老独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= ELDER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: ElderAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.elder;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= ELDER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取秽语长老独立成品与专业准备指导', `花1行动、500便士。${ELDER_GUIDE}说明原渠道记录。${ELDER_FORMULA_STATUS}${ELDER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = ELDER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= ELDER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(ELDER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('秽语长老独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批秽语长老成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < ELDER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`elder-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶秽语长老原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.threeHeadedTemplarActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of ELDER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为秽语长老', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；三首圣堂消化100与原13项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满；身体性别和旧伤保持。过去七阶的原瓶、原血肉储备、原灵、已选技巧、许可与拒绝、人物身体和原敌伤亡记录全部留存。总放牧7位、同时至多2位外放、本人同时借1灵的边界保持，不新增原灵或补满资源。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '秽语长老魔药严重排异' : '秽语长老魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为三首圣堂，旧消化、掌握、身体、原灵与三项真实准备经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): ElderAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, sequence: s.progression.sequence as 3 | 2, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: ElderState) {
  return { guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, threeHeadedTemplarActingAtPromotion: state.threeHeadedTemplarActingAtPromotion,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyElderAcquisition(s: SliceState, command: ElderAcquisitionCommand, ctx: SeerContext): void {
  const reason = elderAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const before = acquisitionBudget(s), actor: ElderAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, pathwayId: 'hanged-man',
    threeHeadedTemplarPromotionWeek: s.threeHeadedTemplar.promotionWeek!, secretSupplicantPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.elder.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: acquisitionBudget(s), randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is ElderAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    (v.sequence !== 3 && v.sequence !== 2) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 2 ? ELDER_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return new Set(v.injuries.map(i => record(i) ? i.id : null)).size === v.injuries.length && v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateElderAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.elder.acquisitionJournal, expected = createElderState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: ElderAcquisitionEvent | null = null, nextCursor = 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.threeHeadedTemplar.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateElderAcquisitionCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 3 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'pathwayId', 'threeHeadedTemplarPromotionWeek', 'secretSupplicantPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.name !== s.character.name || raw.actor.gender !== s.character.gender ||
        raw.actor.pathwayId !== 'hanged-man' || raw.actor.threeHeadedTemplarPromotionWeek !== s.threeHeadedTemplar.promotionWeek || raw.actor.secretSupplicantPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as ElderAcquisitionEvent;
      if ([...event.before.injuries, ...event.after.injuries].some(injury => injury.acquiredRevision > event.revision || injury.treatedRevision !== null && injury.treatedRevision > event.revision)) return false;
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
        progression: { ...s.progression, pathwayId: 'hanged-man', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, elder: expected };
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
    if (!same(acquisitionState(expected), acquisitionState(s.elder))) return false;
    if (previous) {
      // Other, already-authorized play may add growth, but cannot erase this inherited prefix.
      if (INHERITED_ABILITY_IDS.some(id => !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500)) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.elder.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      // With no intervening command, a closed acquisition action cannot mint recovery, cash or mastery.
      if (s.revision === previous.revision + 1 && s.week === previous.week && previous.after.actions > 0 &&
        (!same(s.date, previous.date) || !same(acquisitionBudget(s), previous.after) || previous.randomAfter !== null && s.random.cursor !== previous.randomAfter)) return false;
      if (isElder(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 2 || previous.after.acting !== 0 ||
        !ELDER_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.elder.threeHeadedTemplarActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.elder.guidanceKnown || isElder(s)) return false;
    return true;
  } catch { return false; }
}

export function applyElderCommand(s: SliceState, command: ElderCommand, ctx: SeerContext): void {
  if (!validateElderCommand(command)) throw new Error('秽语长老命令无效。');
  if (validateElderAcquisitionCommand(command)) return applyElderAcquisition(s, command, ctx);
  if (validateElderActivityCommand(command)) return handleElderLife(s, command, ctx);
  if (validateElderEncounterCommand(command)) return applyElderEncounterCommand(s, command, ctx);
  throw new Error('未知秽语长老命令。');
}

/** Prefer the open scene's own concrete next step, otherwise a forward action. */
function preferredElderAction(s: SliceState, actions: ElderAction[]): ElderAction | undefined {
  const enabled = actions.filter(action => action.enabled);
  const life = projectElderLife(s);
  const preferredId = 'preferredActionId' in life ? life.preferredActionId : null;
  return enabled.find(action => action.id === preferredId) ?? enabled.find(action => !['LEAVE_PREPARATION', 'WITHDRAW_PERMISSION', 'STOP', 'WAIT_10'].includes(action.command.type)) ?? enabled[0];
}

export function projectElder(s: SliceState): ElderProjection {
  const state = s.elder, available = knownChannel(s), promoted = isElder(s), actions: ElderAction[] = [];
  const add = (id: string, label: string, cost: string, command: ElderAcquisitionCommand) => { const reason = elderAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-elder-guidance', '听取秽语长老成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of ELDER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`elder-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-elder-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-elder-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-elder-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-elder-supply', '申请下一批独立秽语长老成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${ELDER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶秽语长老魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 三首圣堂消化${s.progression.acting}/100 · ${threeHeadedTemplarWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions = available ? [...actions, ...elderLifeActions(s), ...elderEncounterActions(s)] : [];
  const preferred = preferredElderAction(s, allActions);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '秽语长老·倒吊人序列2', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${ELDER_FORMULA_STATUS}${ELDER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : allActions.find(a => a.reason)?.reason ?? (promoted ? '已完成的记录保留，可继续正常生活。' : '先走完三首圣堂之路。'), preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 秽语长老成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为三首圣堂' : '排异，仍为三首圣堂'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? ELDER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...ELDER_INHERITED_ABILITIES, ...ELDER_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `三首圣堂消化${state.threeHeadedTemplarActingAtPromotion}/100留存；秽语长老扮演${s.progression.acting}/100。晋升后三项生活报告各25、反思25；普通完成同样可消化，掌握只计真实成功应用。晋升准备不替代生活报告。` : available ? `三首圣堂需消化100（当前${s.progression.acting}/100）、晋3后12整周（当前${threeHeadedTemplarWeeks(s)}/12），完成三份旧报告和反思；另须三项专业准备与当周场地检查。` : '先走完三首圣堂之路。',
    pollution: s.seer.pollution, risk: available ? ELDER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender, appearanceRecord: available ? `原创建年龄${s.character.age}岁、当前性别${s.character.gender}。本次晋升不改写身体、外观与旧伤。` : '',
    inheritedTools: available ? `原血肉储备${s.roseBishop.reserve.points}/${s.roseBishop.reserve.max}，使用须实际支付。旧牧羊人原灵${s.shepherd.grazing.spirits.filter(spirit => spirit.status === 'GRAZED').length}位、封存院原灵${Object.values(s.threeHeadedTemplar.life.spirits).filter(spirit => spirit.status === 'GRAZED').length}位仍各自保有原记录，合计至多7位，每灵至多3项已选方法。同时外放至多2位，本人同时借用1灵；合唱只调用一位现存原灵，不添加新名册。` : '',
    inheritedHistory: available ? [
      `三首圣堂在第${s.threeHeadedTemplar.promotionWeek}周实际晋升；${promoted ? `原消化${state.threeHeadedTemplarActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      `历阶消化：秘祈人${s.listener.secretSupplicantActingAtPromotion}、倾听者${s.shadowAscetic.listenerActingAtPromotion}、隐修士${s.roseBishop.shadowAsceticActingAtPromotion}、蔷薇主教${s.shepherd.roseBishopActingAtPromotion}、牧羊人${s.blackKnight.shepherdActingAtPromotion}、黑骑士${s.threeHeadedTemplar.blackKnightActingAtPromotion}、三首圣堂${promoted ? state.threeHeadedTemplarActingAtPromotion : s.progression.acting}。`,
      '前七阶13项技巧保持原ID与掌握，两项新技巧从0开始，共15项。旧掌握0仍为0，不因晋升自动精熟。',
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；现有伤势${s.injuries.length}处，累计风险${s.injuryRisk}。旧伤须真实诊疗和休养。`,
      ...s.shepherd.grazing.spirits.map(spirit => `原灵${spirit.id === 'SH5-IRIS-1' ? '伊芮斯' : '塞德里克'}：${spirit.status}，实际取得周${spirit.acquiredWeek ?? '未取得'}，永久释放周${spirit.releasedWeek ?? '未释放'}；实际已选方法${spirit.selectedAbilities.join('、') || '无'}。`),
      ...Object.values(s.threeHeadedTemplar.life.spirits).map(spirit => `封存院原灵${spirit.id}：${spirit.status === 'GRAZED' ? '已放牧' : spirit.status === 'RELEASED' ? '已永久释放' : '尚未交接'}，灵性${spirit.spirituality}/30、完整度${spirit.integrity}/100；实际取得周${spirit.acquiredWeek ?? '未取得'}，永久释放周${spirit.releasedWeek ?? '未释放'}。原记录与消耗保持，晋升不赠送或替换原灵。`),
      `旧独立影体${s.blackKnight.life.shade.creatureId ?? '尚未生成'}：${s.blackKnight.life.shade.status}，原位置${s.blackKnight.life.shade.creatureLocation}，隔离间${s.blackKnight.life.shade.roomStatus}。原封条${s.blackKnight.life.shade.emergencySealUsed ? '已耗用' : '未耗用'}、原灯罩${s.blackKnight.life.shade.glassHood}；不能成为合唱来源。`,
      `原加里克：${s.blackKnight.encounter.enemyStatus === 'DEAD' ? '已死亡' : s.blackKnight.encounter.enemyStatus === 'SURRENDERED' ? '已投降' : '仍有抵抗能力'}，健康${s.blackKnight.encounter.enemyHealth}/100、精神${s.blackKnight.encounter.enemyMind}/100、灵性${s.blackKnight.encounter.enemySpirituality}，原伤势${s.blackKnight.encounter.enemyInjuries.length}处。`,
      `原布拉姆：${s.threeHeadedTemplar.encounter.enemyStatus === 'DEAD' ? '已死亡' : s.threeHeadedTemplar.encounter.enemyStatus === 'SURRENDERED' ? '已投降' : '仍有抵抗能力'}，健康${s.threeHeadedTemplar.encounter.enemyHealth}/100、精神${s.threeHeadedTemplar.encounter.enemyMind}/100、灵性${s.threeHeadedTemplar.encounter.enemySpirituality}，原伤势${s.threeHeadedTemplar.encounter.enemyInjuries.length}处。晋升不治疗、重开或复活旧对手。`,
      '玛拉、原卡、左右原箱、原灯、原遮板和同一封存院路线继续保留；旧许可不能代替新案同意。',
    ] : [],
    life: projectElderLife(s), encounter: projectElderEncounter(s), insideCase: hasElderLock(s),
    environment: available ? '同一封存院THT3-SEALED-COURT：START至A4米，A至B4米。本人沿原路实际步行，玛拉、原卡、左右原箱、原灯与原遮板保持同一实体。生活练习须成功晋升后逐案重新征得同意，购买本案独立封签，有限施用后真实归还、关灯并离场；普通核对始终可行。' : '',
  };
}

/** Acquisition uses one chronological resource/RNG timeline, never a fabricated successful bottle. */
export function validateElderJournalContinuity(s: SliceState): boolean {
  try {
    const events = s.elder.acquisitionJournal;
    let cursor = 0;
    for (let n = 0; n < events.length; n++) {
      const event = events[n]!, previous = events[n - 1];
      if (previous) {
        if (event.revision <= previous.revision || event.week < previous.week || compareGameDates(event.date, previous.date) < 0 || previous.after.sequence === 2) return false;
        if (event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && !same(event.before, previous.after)) return false;
        if (previous.command.type === 'PREPARE_PROMOTION' && (event.week !== previous.week || !same(event.date, previous.date) || !['CONSUME', 'LEAVE_PREPARATION'].includes(event.command.type) || !same(event.before, previous.after))) return false;
        if (INHERITED_ABILITY_IDS.some(id => event.before.mastery[id]! < previous.after.mastery[id]!) || !same(event.before.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      }
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) return false;
        cursor = event.randomAfter;
      }
    }
    // Acquisition and life independently replay, but must share the same resources
    // and random stream at every directly adjacent commit across the boundary.
    type SharedBudget = Pick<ElderAcquisitionBudget, 'actions' | 'health' | 'mind' | 'spirituality' | 'cash'>;
    type Timeline = { phase: 'ACQUISITION' | 'LIFE' | 'ENCOUNTER'; week: number; date: PublicGameDate | null; revision: number; before: SharedBudget; after: SharedBudget; randomBefore: number | null; randomAfter: number | null; recordedCursor: number | null };
    const shared = (b: SharedBudget): SharedBudget => ({ actions: b.actions, health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash });
    const timeline: Timeline[] = events.map(event => ({ phase: 'ACQUISITION', week: event.week, date: event.date, revision: event.revision,
      before: shared(event.before), after: shared(event.after), randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: null }));
    const promotion = events.find(event => event.after.sequence === 2);
    for (const event of s.elder.life.journal) {
      if (!promotion || event.revision <= promotion.revision || event.week < promotion.week || compareGameDates(event.date, promotion.date) < 0) return false;
      const b = event.budget;
      timeline.push({ phase: 'LIFE', week: event.week, date: event.date, revision: event.revision,
        before: { actions: b.actionsBefore, health: b.healthBefore, mind: b.mindBefore, spirituality: b.spiritualityBefore, cash: b.cashBefore },
        after: { actions: b.actionsAfter, health: b.healthAfter, mind: b.mindAfter, spirituality: b.spiritualityAfter, cash: b.cashAfter },
        randomBefore: event.randomBefore, randomAfter: event.randomAfter, recordedCursor: null });
    }
    const prep = s.elder.encounter.preparation;
    if (prep) {
      const lastLife = s.elder.life.journal.at(-1);
      // Encounter stores the resulting commit revision; acquisition/life store its input.
      if (!promotion || !lastLife || prep.revision - 1 <= lastLife.revision || prep.week < lastLife.week) return false;
      timeline.push({ phase: 'ENCOUNTER', week: prep.week, date: null, revision: prep.revision - 1,
        before: shared(prep.before), after: shared(prep.after), randomBefore: null, randomAfter: null, recordedCursor: prep.randomCursor });
    }
    timeline.sort((a, b) => a.revision - b.revision);
    cursor = 0;
    for (let i = 0; i < timeline.length; i++) {
      const event = timeline[i]!, previous = timeline[i - 1];
      if (previous && (event.revision <= previous.revision || event.week < previous.week || event.date !== null && previous.date !== null && compareGameDates(event.date, previous.date) < 0 ||
        event.phase === 'ACQUISITION' && previous.phase !== 'ACQUISITION' || event.phase === 'LIFE' && previous.phase === 'ENCOUNTER' ||
        event.revision === previous.revision + 1 && event.week === previous.week && previous.after.actions > 0 && !same(event.before, previous.after))) return false;
      if (event.randomBefore !== null) {
        if (!integer(event.randomBefore, cursor, s.random.cursor) || event.randomAfter !== event.randomBefore + 1 || !integer(event.randomAfter, 0, s.random.cursor)) return false;
        cursor = event.randomAfter;
      }
      if (event.recordedCursor !== null) {
        if (!integer(event.recordedCursor, cursor, s.random.cursor)) return false;
        cursor = event.recordedCursor;
      }
    }
    const tail = timeline.at(-1);
    if (tail && s.revision === tail.revision + 1 && s.week === tail.week && tail.after.actions > 0 &&
      (tail.date !== null && !same(s.date, tail.date) || !same(shared(acquisitionBudget(s)), tail.after) ||
        tail.randomAfter !== null && tail.randomAfter !== s.random.cursor || tail.recordedCursor !== null && tail.recordedCursor !== s.random.cursor)) return false;
    return true;
  } catch { return false; }
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateElderState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.elder;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'threeHeadedTemplarActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== ELDER_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as ElderState, promoted = isElder(s), acquisitionStage = isElderAcquisitionStage(s);
  const firstWeek = s.threeHeadedTemplar.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + ELDER_MIN_THREE_HEADED_TEMPLAR_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > ELDER_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !ELDER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasElderOldPractice(s) || hasElderLifeLock(s) || hasElderEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.threeHeadedTemplar.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.threeHeadedTemplarActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !threeHeadedTemplarReportsComplete(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...ELDER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.threeHeadedTemplarActingAtPromotion !== null || ELDER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `elder-potion-${index + 1}` || !integer(b.labourSteps, 0, ELDER_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < ELDER_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== ELDER_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % ELDER_BOTTLE_IDS.length;
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
        if (!integer(s.threeHeadedTemplar.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateElderAcquisitionJournal(s) || !validateElderJournalContinuity(s) || !validateElderLifeState(s) || !validateElderEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { ELDER_ABILITIES } from './content.js';
export { ELDER_ABILITY_IDS } from './types.js';
export type * from './types.js';

