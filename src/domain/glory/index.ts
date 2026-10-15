import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { WARRIOR_ABILITY_IDS } from '../warrior/types.js';
import { GLADIATOR_ABILITY_IDS } from '../gladiator/types.js';
import { WEAPONMASTER_ABILITY_IDS } from '../weaponmaster/types.js';
import { DAWN_PALADIN_ABILITY_IDS } from '../dawn-paladin/types.js';
import { GUARDIAN_ABILITY_IDS } from '../guardian/types.js';
import { DEMON_HUNTER_ABILITY_IDS } from '../demon-hunter/types.js';
import { SILVER_KNIGHT_ABILITY_IDS } from '../silver-knight/types.js';
import { hasSilverKnightOldPractice, hasSilverKnightRitualLock } from '../silver-knight/index.js';
import { hasSilverKnightLifeLock } from '../silver-knight/life.js';
import { hasSilverKnightEncounterLock } from '../silver-knight/encounter.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { createGloryLifeState, handleGloryLife, projectGloryLife, gloryLifeActions, validateGloryLifeState, validateGloryActivityCommand, hasGloryLifeLock } from './life.js';
import { createGloryEncounterState, applyGloryEncounterCommand, projectGloryEncounter, gloryEncounterActions, validateGloryEncounter, validateGloryEncounterCommand, hasGloryEncounterLock } from './encounter.js';
import { GLORY_ABILITIES, GLORY_INHERITED_ABILITIES, GLORY_BOTTLE_IDS, GLORY_CONSUMPTION_RISK, GLORY_FORMULA_STATUS, GLORY_GUIDE, GLORY_LABOUR_STEPS, GLORY_LABOUR_TASKS, GLORY_MIN_SILVER_KNIGHT_WEEKS, GLORY_POTION_SOURCES, GLORY_PREPARATIONS, GLORY_PRICES, GLORY_SOURCE_STATUS } from './content.js';
import { GLORY_ABILITY_IDS, GLORY_PREPARATION_IDS, type GloryAcquisitionBudget, type GloryAcquisitionEvent, type GloryAcquisitionCommand, type GloryAction, type GloryBottle, type GloryCommand, type GloryProjection, type GloryState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const GLORY_INHERITED_ABILITY_IDS = [...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS, ...WEAPONMASTER_ABILITY_IDS, ...DAWN_PALADIN_ABILITY_IDS, ...GUARDIAN_ABILITY_IDS, ...DEMON_HUNTER_ABILITY_IDS, ...SILVER_KNIGHT_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = GLORY_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): GloryBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createGloryState(): GloryState {
  return { guidanceKnown: false, bottles: GLORY_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, silverKnightActingAtPromotion: null,
    preparations: [], preparedWeek: null, acquisitionJournal: [], life: createGloryLifeState(), encounter: createGloryEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isGlory = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 2;
export const isGloryAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 3;
export const hasGloryHistory = (s: SliceState) => isGlory(s) && s.glory.promotionWeek !== null;
/** Each predecessor remains a real consumed original bottle at a non-future week. */
function sourceHistory(s: SliceState): boolean {
  if (!s.warrior.discovered || !s.warrior.guidanceKnown) return false;
  const first = s.warrior.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || !integer(first[0]!.consumedWeek, 1, s.week) || first[0]!.consumedWeek !== s.progression.promotionWeek) return false;
  let previous = first[0]!.consumedWeek!;
  for (const stage of [s.gladiator, s.weaponmaster, s.dawnPaladin, s.guardian, s.demonHunter, s.silverKnight]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.gladiator.warriorActingAtPromotion === 100 && s.weaponmaster.gladiatorActingAtPromotion === 100 &&
    s.dawnPaladin.weaponmasterActingAtPromotion === 100 && s.guardian.dawnPaladinActingAtPromotion === 100 &&
    s.demonHunter.guardianActingAtPromotion === 100 && s.silverKnight.demonHunterActingAtPromotion === 100;
}
const knownChannel = (s: SliceState) => (isGloryAcquisitionStage(s) || isGlory(s)) && sourceHistory(s);
/** These remain historical locks; none widens the exact-stage predecessor command gates. */
export function hasGloryOldPractice(s: SliceState): boolean {
  return hasSilverKnightOldPractice(s) || hasSilverKnightRitualLock(s) || hasSilverKnightLifeLock(s) || hasSilverKnightEncounterLock(s) ||
    s.warrior.practiceClub.custodian === 'PLAYER' ||
    Object.values(s.silverKnight.life.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.status === 'ACTIVE');
}
const silverKnightReportsComplete = (s: SliceState) => s.silverKnight.life.reflected &&
  Object.values(s.silverKnight.life.cases).length === 3 && Object.values(s.silverKnight.life.cases).every(c => c.status === 'RESOLVED' && !c.contactOpen && c.returned && c.closes === 1);
export const hasGloryOldSceneLock = hasGloryOldPractice;
export const hasGloryRitualLock = (s: SliceState): boolean => s.glory.preparedWeek !== null;
export const hasGloryLock = (s: SliceState): boolean => hasGloryRitualLock(s) || hasGloryLifeLock(s) || hasGloryEncounterLock(s);
const bottleNumber = (b: Pick<GloryBottle, 'id'>) => Number(b.id.slice('glory-potion-'.length));
const potionPrice = (b: GloryBottle) => GLORY_PRICES.potion - (b.labourSteps === GLORY_LABOUR_STEPS ? GLORY_PRICES.labourCredit : 0);
const silverKnightWeeks = (s: SliceState) => Math.max(0, (s.glory.promotionWeek ?? s.week) - (s.silverKnight.promotionWeek ?? s.week));
const exhaustedSupply = (state: GloryState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${GLORY_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列2荣耀者成品，独立封存编号glory-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => GLORY_PREPARATION_IDS.every(id => s.glory.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `银骑士魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.silverKnight.promotionWeek === null || silverKnightWeeks(s) < GLORY_MIN_SILVER_KNIGHT_WEEKS) return `成为银骑士后已过${silverKnightWeeks(s)}/12整周，尚不能准备本次服药。`;
  if (!silverKnightReportsComplete(s)) return '先完成银骑士的三份实际报告与反思，并收好旧训练现场。';
  return hasPreparations(s) ? null : '先分别完成已有银甲核对、负载规划与普通退路检查；领取药瓶不能代做专业准备。';
}
export function validateGloryAcquisitionCommand(v: unknown): v is GloryAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && GLORY_PREPARATION_IDS.includes(v.taskId as typeof GLORY_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^glory-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isGloryAcquisitionCommand = validateGloryAcquisitionCommand;
export function validateGloryCommand(v: unknown): v is GloryCommand {
  return validateGloryAcquisitionCommand(v) || validateGloryActivityCommand(v) || validateGloryEncounterCommand(v);
}
export function gloryAcquisitionBlock(s: SliceState, command: GloryAcquisitionCommand): string | null { return acquisitionBlock(s, command, false); }
function acquisitionBlock(s: SliceState, command: GloryAcquisitionCommand, historicalReplay: boolean): string | null {
  if (!validateGloryAcquisitionCommand(command)) return '荣耀者准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if ((!historicalReplay && hasGloryOldPractice(s)) || hasGloryLifeLock(s) || hasGloryEncounterLock(s)) return '先停止原银甲、借光和旧训练接触，归还借物并沿原路离开；当前实践也须收尾。旧人物、伤势和损耗继续保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德荣耀者专业交接处。';
  if (!knownChannel(s)) return '实际成为银骑士并保留原指导渠道后，才能了解荣耀者之路。';
  if (!isGloryAcquisitionStage(s)) return '已经晋升荣耀者2，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '战士至银骑士的18项掌握记录不完整，暂不能继续晋升。';
  const state = s.glory;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < GLORY_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的荣耀者原瓶。';
    return s.cash < GLORY_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批荣耀者原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的荣耀者准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选荣耀者独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= GLORY_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
function applyAcquisitionMutation(s: SliceState, command: GloryAcquisitionCommand, ctx: SeerContext, historicalReplay = false): void {
  const reason = acquisitionBlock(s, command, historicalReplay); if (reason) throw new Error(reason);
  const state = s.glory;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= GLORY_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取荣耀者独立成品与专业准备指导', `花1行动、500便士。${GLORY_GUIDE}说明原渠道记录。${GLORY_FORMULA_STATUS}${GLORY_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = GLORY_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= GLORY_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(GLORY_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('荣耀者独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批荣耀者成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < GLORY_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`glory-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶荣耀者原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.silverKnightActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of GLORY_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为荣耀者', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；银骑士消化100与原18项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满，身体性别保持。过去七阶的药瓶、劳务、同一件银甲、借物归属、人物身体与原敌伤亡记录全部留存。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '荣耀者魔药严重排异' : '荣耀者魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为银骑士，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
function acquisitionBudget(s: SliceState): GloryAcquisitionBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    pollution: s.seer.pollution, sequence: s.progression.sequence as 3 | 2, acting: s.progression.acting,
    coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery }, completedSources: [...s.seer.completedSources],
    injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
function acquisitionState(state: GloryState) {
  return { guidanceKnown: state.guidanceKnown, bottles: state.bottles, resupply: state.resupply,
    promotionWeek: state.promotionWeek, silverKnightActingAtPromotion: state.silverKnightActingAtPromotion,
    preparations: state.preparations, preparedWeek: state.preparedWeek };
}
/** The journal proves the cost of each particular bottle and preserves the actual failed attempts. */
export function applyGloryAcquisition(s: SliceState, command: GloryAcquisitionCommand, ctx: SeerContext): void {
  const reason = gloryAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const before = acquisitionBudget(s), actor: GloryAcquisitionEvent['actor'] = {
    name: s.character.name, gender: s.character.gender, pathwayId: 'warrior',
    silverKnightPromotionWeek: s.silverKnight.promotionWeek!, warriorPromotionWeek: s.progression.promotionWeek!,
  };
  let result: PublicCheckResult | null = null, randomBefore: number | null = null, randomAfter: number | null = null;
  const recording: SeerContext = { ...ctx, check(ability, difficulty) {
    if (result !== null || command.type !== 'CONSUME' || ability !== 'will' || difficulty !== 30) throw new Error('本次服药检定来源不一致。');
    randomBefore = s.random.cursor; result = structuredClone(ctx.check(ability, difficulty)); randomAfter = s.random.cursor;
    return result;
  } };
  applyAcquisitionMutation(s, command, recording);
  s.glory.acquisitionJournal.push({ week: s.week, date: structuredClone(s.date), revision: s.revision,
    command: structuredClone(command), actor, before, after: acquisitionBudget(s), randomBefore, randomAfter, check: result });
}
function validAcquisitionBudget(v: unknown): v is GloryAcquisitionBudget {
  if (!record(v) || !shape(v, ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk']) ||
    !integer(v.actions, 0, 100) || !integer(v.health, 1, 100) || !integer(v.mind, 1, 100) || !integer(v.spirituality, 0, 120) || !integer(v.cash) || !integer(v.pollution, 0, 100) ||
    (v.sequence !== 3 && v.sequence !== 2) || !integer(v.acting, 0, 100) || !record(v.coreStats) || !shape(v.coreStats, ['physique', 'perception', 'will', 'knowledge']) ||
    !Object.values(v.coreStats).every(n => integer(n, 0, 500)) || !record(v.mastery) || !shape(v.mastery, [...INHERITED_ABILITY_IDS, ...(v.sequence === 2 ? GLORY_ABILITY_IDS : [])]) ||
    !Object.values(v.mastery).every(n => integer(n, 0, 500)) || !Array.isArray(v.completedSources) || !v.completedSources.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200) ||
    new Set(v.completedSources).size !== v.completedSources.length || !Array.isArray(v.injuries) || !integer(v.injuryRisk)) return false;
  return v.injuries.every(i => record(i) && shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && i.id.length > 0 &&
    (i.severity === 'LIGHT' || i.severity === 'HEAVY') && integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
}
/** Replays only this new stage. Current old-scene locks cannot invalidate a past purchase;
 * the command itself checks them when committed, and promotion requires closed old reports.
 * This never re-rolls or mutates any predecessor's journal. */
export function validateGloryAcquisitionJournal(s: SliceState): boolean {
  try {
    const journal = s.glory.acquisitionJournal, expected = createGloryState();
    if (!Array.isArray(journal) || journal.length > 10000) return false;
    let previous: GloryAcquisitionEvent | null = null, nextCursor = 0;
    for (const raw of journal) {
      if (!record(raw) || !shape(raw, ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'randomBefore', 'randomAfter', 'check']) ||
        !integer(raw.week, s.silverKnight.promotionWeek ?? s.week, s.week) || !integer(raw.revision, 0, s.revision) || !isValidGameDate(raw.date) ||
        compareGameDates(raw.date, s.date) > 0 || raw.week !== Math.floor(gameDaysBetween(ORIGIN, raw.date) / 7) + 1 ||
        !validateGloryAcquisitionCommand(raw.command) || !validAcquisitionBudget(raw.before) || !validAcquisitionBudget(raw.after) || raw.before.sequence !== 3 ||
        !record(raw.actor) || !shape(raw.actor, ['name', 'gender', 'pathwayId', 'silverKnightPromotionWeek', 'warriorPromotionWeek']) ||
        typeof raw.actor.name !== 'string' || raw.actor.name.length === 0 || raw.actor.name.length > 500 || typeof raw.actor.gender !== 'string' || raw.actor.gender.length === 0 || raw.actor.gender.length > 500 ||
        raw.actor.pathwayId !== 'warrior' || raw.actor.silverKnightPromotionWeek !== s.silverKnight.promotionWeek || raw.actor.warriorPromotionWeek !== s.progression.promotionWeek) return false;
      const event = raw as unknown as GloryAcquisitionEvent;
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
        progression: { ...s.progression, pathwayId: 'warrior', sequence: b.sequence, acting: b.acting, mastery: { ...b.mastery } },
        seer: { ...s.seer, pollution: b.pollution, completedSources: [...b.completedSources] }, glory: expected };
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
    if (!same(acquisitionState(expected), acquisitionState(s.glory))) return false;
    if (previous) {
      // Other, already-authorized play may add growth, but cannot erase this inherited prefix.
      if (INHERITED_ABILITY_IDS.some(id => !integer(s.progression.mastery[id], previous!.after.mastery[id]!, 500)) ||
        !same(s.seer.completedSources.slice(0, previous.after.completedSources.length), previous.after.completedSources)) return false;
      if (s.glory.preparedWeek !== null && (!same(acquisitionBudget(s), previous.after) || previous.week !== s.week || !same(previous.date, s.date))) return false;
      if (isGlory(s) && (previous.command.type !== 'CONSUME' || previous.after.sequence !== 2 || previous.after.acting !== 0 ||
        !GLORY_ABILITY_IDS.every(id => previous!.after.mastery[id] === 0) || s.glory.silverKnightActingAtPromotion !== previous.before.acting)) return false;
    } else if (s.glory.guidanceKnown || isGlory(s)) return false;
    return true;
  } catch { return false; }
}

export function applyGloryCommand(s: SliceState, command: GloryCommand, ctx: SeerContext): void {
  if (!validateGloryCommand(command)) throw new Error('荣耀者命令无效。');
  if (validateGloryAcquisitionCommand(command)) return applyGloryAcquisition(s, command, ctx);
  if (validateGloryActivityCommand(command)) return handleGloryLife(s, command, ctx);
  if (validateGloryEncounterCommand(command)) return applyGloryEncounterCommand(s, command, ctx);
  throw new Error('未知荣耀者命令。');
}

export function projectGlory(s: SliceState): GloryProjection {
  const state = s.glory, available = knownChannel(s), promoted = isGlory(s), actions: GloryAction[] = [];
  const add = (id: string, label: string, cost: string, command: GloryAcquisitionCommand) => { const reason = gloryAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-glory-guidance', '听取荣耀者成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of GLORY_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`glory-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-glory-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-glory-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-glory-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-glory-supply', '申请下一批独立荣耀者成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${GLORY_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶荣耀者魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 银骑士消化${s.progression.acting}/100 · ${silverKnightWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '荣耀者·战士序列2', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${GLORY_FORMULA_STATUS}${GLORY_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available ? [...actions, ...gloryLifeActions(s), ...gloryEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 荣耀者成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为银骑士' : '排异，仍为银骑士'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? GLORY_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? [...GLORY_INHERITED_ABILITIES, ...GLORY_ABILITIES].map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `银骑士消化${state.silverKnightActingAtPromotion}/100留存；荣耀者扮演${s.progression.acting}/100。三项报告各25、反思25；普通完成同样可消化，掌握只计实际能力应用。` : available ? `银骑士需消化100（当前${s.progression.acting}/100）、晋3后12整周（当前${silverKnightWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完银骑士之路。',
    pollution: s.seer.pollution, risk: available ? GLORY_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `银骑士在第${s.silverKnight.promotionWeek}周晋升；${promoted ? `当时消化${state.silverKnightActingAtPromotion}/100已留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      `历阶消化：战士${s.gladiator.warriorActingAtPromotion}、格斗家${s.weaponmaster.gladiatorActingAtPromotion}、武器大师${s.dawnPaladin.weaponmasterActingAtPromotion}、黎明骑士${s.guardian.dawnPaladinActingAtPromotion}、守护者${s.demonHunter.guardianActingAtPromotion}、猎魔者${s.silverKnight.demonHunterActingAtPromotion}、银骑士${promoted ? state.silverKnightActingAtPromotion : s.progression.acting}。`,
      '前七阶的18项技巧随本人继承，晋升不会额外增加旧技巧的掌握。两项新技巧须实际应用并报告后成长。',
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；现有伤势${s.injuries.length}处，累计风险${s.injuryRisk}。本次晋升保持原身体。`,
      `旧训练场记录的银甲${s.silverKnight.life.armor.id}，当时完整度为${s.silverKnight.life.armor.integrity}，${s.silverKnight.life.armor.formed ? '已形成并收起' : '尚未形成'}。这是旧训练结束时的历史记录；同一件银甲后来的磨损和当前状态见本页修护室及庭院记录。`,
      `原训练棍仍由${s.warrior.practiceClub.custodian === 'MENTOR' ? '导师保管' : '本人保管'}，主人是${s.warrior.practiceClub.owner}；原守护同伴健康${s.guardian.practice.allyHealth}，过去的受伤没有被晋升抹去。`,
      `原灰烬哨卫健康${s.demonHunter.encounter.enemyHealth}/100、精神${s.demonHunter.encounter.enemyMind}/100、灵性${s.demonHunter.encounter.enemySpirituality}；${s.demonHunter.encounter.enemyStatus === 'DEAD' ? '已经死亡' : s.demonHunter.encounter.enemyStatus === 'SURRENDERED' ? '已经投降' : '保持此前接触结果'}。原目标的未用涂层${s.demonHunter.encounter.coatings.filter(c => c.status === 'SEALED').length}份仍留在原处。`,
      `旧训练场的埃尔达与诺兰保留原位置。原测力装置剩余负载${s.silverKnight.life.rig.remainingLoads}份，灯油${s.silverKnight.life.lamp.oil}份；已经归还的护垫、灯与刻笔都仍归原主人。`,
      `洛肯健康${s.silverKnight.encounter.post.enemyHealth}/100、精神${s.silverKnight.encounter.post.enemyMind}/100、灵性${s.silverKnight.encounter.post.resources.enemySpirituality}；${s.silverKnight.encounter.post.status === 'DEAD' ? '已经死亡' : s.silverKnight.encounter.post.status === 'SURRENDERED' ? '已经投降' : '保留此前的接触结果'}，原手杖与伤势留在他自己的记录里。`,
      `此前${s.silverKnight.encounter.hunts.filter(h => h.status === 'DEAD').length}只亲猎原体已死亡，${s.silverKnight.encounter.hunts.filter(h => h.status === 'SURRENDERED').length}只已投降；${s.silverKnight.encounter.remains.filter(r => r.status === 'CONSUMED').length}份遗骸已经耗用，旧祝福与祭坛材料不会再次补发。`,
    ] : [],
    life: projectGloryLife(s), encounter: projectGloryEncounter(s), insideCase: hasGloryLock(s),
    environment: available ? '修护室：门口0米，工作台2米，桥端8米，室外−2米，庭院−4米。41岁的西莉娅负责教学，36岁的埃文参与实践。每案重新确认同意，花20便士取得当次护具；有限护垫、同一件银甲与各人的身体持续留存。步行按实际距离耗时耗力，普通侧路与停止返程始终可选。' : '',

  };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateGloryState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.glory;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'silverKnightActingAtPromotion', 'preparations', 'preparedWeek', 'acquisitionJournal', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== GLORY_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations) || !Array.isArray(raw.acquisitionJournal)) return false;
  const state = raw as unknown as GloryState, promoted = isGlory(s), acquisitionStage = isGloryAcquisitionStage(s);
  const firstWeek = s.silverKnight.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + GLORY_MIN_SILVER_KNIGHT_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > GLORY_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !GLORY_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasGloryOldPractice(s) || hasGloryLifeLock(s) || hasGloryEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.silverKnight.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.silverKnightActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || !silverKnightReportsComplete(s) || hasGloryOldPractice(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...GLORY_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.silverKnightActingAtPromotion !== null || GLORY_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `glory-potion-${index + 1}` || !integer(b.labourSteps, 0, GLORY_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < GLORY_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== GLORY_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % GLORY_BOTTLE_IDS.length;
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
        if (!integer(s.silverKnight.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateGloryAcquisitionJournal(s) || !validateGloryLifeState(s) || !validateGloryEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { GLORY_ABILITIES } from './content.js';
export { GLORY_ABILITY_IDS } from './types.js';
export type * from './types.js';
