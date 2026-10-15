import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { MARAUDER_ABILITY_IDS } from '../marauder/types.js';
import { SWINDLER_ABILITY_IDS } from '../swindler/types.js';
import { CRYPTOLOGIST_ABILITY_IDS } from '../cryptologist/types.js';
import { FIRE_THIEF_ABILITY_IDS } from '../fire-thief/types.js';
import { DREAM_STEALER_ABILITY_IDS } from '../dream-stealer/types.js';
import { PARASITE_ABILITY_IDS } from '../parasite/types.js';
import { DECEIT_MENTOR_ABILITY_IDS } from '../deceit-mentor/types.js';
import { hasDeceitMentorOldPractice, hasDeceitMentorRitualLock } from '../deceit-mentor/index.js';
import { hasDeceitMentorLifeLock } from '../deceit-mentor/life.js';
import { hasDeceitMentorEncounterLock } from '../deceit-mentor/encounter.js';
import { hasDreamStealerOpenPractice } from '../dream-stealer/encounter.js';
import { hasParasiteEncounterLock } from '../parasite/encounter.js';
import { hasParasiteLifeLock } from '../parasite/life.js';
import { createFateTrojanLifeState, applyFateTrojanActivity, projectFateTrojanLife, fateTrojanLifeActions, validateFateTrojanLife, validateFateTrojanActivityCommand, hasFateTrojanLifeLock } from './life.js';
import { createFateTrojanEncounterState, applyFateTrojanEncounterCommand, projectFateTrojanEncounter, fateTrojanEncounterActions, validateFateTrojanEncounter, validateFateTrojanEncounterCommand, hasFateTrojanEncounterLock } from './encounter.js';
import { FATE_TROJAN_ABILITIES, FATE_TROJAN_BOTTLE_IDS, FATE_TROJAN_CONSUMPTION_RISK, FATE_TROJAN_FORMULA_STATUS, FATE_TROJAN_GUIDE, FATE_TROJAN_LABOUR_STEPS, FATE_TROJAN_LABOUR_TASKS, FATE_TROJAN_MIN_DECEIT_MENTOR_WEEKS, FATE_TROJAN_POTION_SOURCES, FATE_TROJAN_PREPARATIONS, FATE_TROJAN_PRICES, FATE_TROJAN_SOURCE_STATUS } from './content.js';
import { FATE_TROJAN_ABILITY_IDS, FATE_TROJAN_PREPARATION_IDS, type FateTrojanAcquisitionCommand, type FateTrojanAction, type FateTrojanBottle, type FateTrojanCommand, type FateTrojanProjection, type FateTrojanState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
export const FATE_TROJAN_INHERITED_ABILITY_IDS = [...MARAUDER_ABILITY_IDS, ...SWINDLER_ABILITY_IDS, ...CRYPTOLOGIST_ABILITY_IDS, ...FIRE_THIEF_ABILITY_IDS, ...DREAM_STEALER_ABILITY_IDS, ...PARASITE_ABILITY_IDS, ...DECEIT_MENTOR_ABILITY_IDS] as const;
const INHERITED_ABILITY_IDS = FATE_TROJAN_INHERITED_ABILITY_IDS;
const freshBottle = (id: string, source: string, stockedWeek: number | null): FateTrojanBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createFateTrojanState(): FateTrojanState {
  return { guidanceKnown: false, bottles: FATE_TROJAN_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, deceitMentorActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createFateTrojanLifeState(), encounter: createFateTrojanEncounterState() };
}
/** Current playability and historical membership are deliberately separate. */
export const isFateTrojan = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 2;
export const isFateTrojanAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 3;
export const hasFateTrojanHistory = (s: SliceState) => isFateTrojan(s) && s.fateTrojan.promotionWeek !== null;
/** Each predecessor remains a real consumed original bottle at a non-future week. */
function sourceHistory(s: SliceState): boolean {
  if (!s.marauder.discovered || !s.marauder.guidanceKnown) return false;
  const first = s.marauder.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
  if (first.length !== 1 || !integer(first[0]!.consumedWeek, 1, s.week)) return false;
  let previous = first[0]!.consumedWeek!;
  for (const stage of [s.swindler, s.cryptologist, s.fireThief, s.dreamStealer, s.parasite, s.deceitMentor]) {
    if (!stage.guidanceKnown || !integer(stage.promotionWeek, previous, s.week)) return false;
    const bottles = stage.bottles.filter(b => b.status === 'CONSUMED' && success(b.outcome));
    if (bottles.length !== 1 || bottles[0]!.consumedWeek !== stage.promotionWeek || !integer(bottles[0]!.acquiredWeek, previous, stage.promotionWeek)) return false;
    previous = stage.promotionWeek;
  }
  return s.swindler.marauderActingAtPromotion === 100 && s.cryptologist.swindlerActingAtPromotion === 100 &&
    s.fireThief.cryptologistActingAtPromotion === 100 && s.dreamStealer.fireThiefActingAtPromotion === 100 &&
    s.parasite.dreamStealerActingAtPromotion === 100 && s.deceitMentor.parasiteActingAtPromotion === 100;
}
const knownChannel = (s: SliceState) => (isFateTrojanAcquisitionStage(s) || isFateTrojan(s)) && sourceHistory(s);
export function hasFateTrojanOldPractice(s: SliceState): boolean {
  return hasDeceitMentorOldPractice(s) || hasDeceitMentorRitualLock(s) || hasDeceitMentorLifeLock(s) || hasDeceitMentorEncounterLock(s) ||
    hasDreamStealerOpenPractice(s) || hasParasiteLifeLock(s) || hasParasiteEncounterLock(s) ||
    Object.values(s.deceitMentor.life.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.status === 'ACTIVE') ||
    Object.values(s.parasite.life.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.status === 'ACTIVE') ||
    s.parasite.life.host.mode !== 'NONE' || s.parasite.life.host.control !== 'HOST' || s.parasite.encounter.borrowed.some(p => p.closedSeconds === null) || s.parasite.encounter.thoughts.some(t => t.status === 'WITHHELD') ||
    s.marauder.dispute.weapon.custodian === 'PLAYER' || ['OBSERVED', 'READY', 'ACTIVE'].includes(s.marauder.dispute.stage) ||
    Object.values(s.marauder.originals).some(item => item.custodian === 'PLAYER') ||
    s.fireThief.encounter.status === 'FIGHTING' || s.dreamStealer.encounter.status === 'FIGHTING' ||
    s.fireThief.encounter.battleLoan.playerRounds > 0 || s.fireThief.encounter.battleLoan.targetRounds > 0;
}
export const hasFateTrojanOldSceneLock = hasFateTrojanOldPractice;
export const hasFateTrojanRitualLock = (s: SliceState): boolean => s.fateTrojan.preparedWeek !== null;
export const hasFateTrojanLock = (s: SliceState): boolean => hasFateTrojanRitualLock(s) || hasFateTrojanLifeLock(s) || hasFateTrojanEncounterLock(s);
const bottleNumber = (b: Pick<FateTrojanBottle, 'id'>) => Number(b.id.slice('fate-trojan-potion-'.length));
const potionPrice = (b: FateTrojanBottle) => FATE_TROJAN_PRICES.potion - (b.labourSteps === FATE_TROJAN_LABOUR_STEPS ? FATE_TROJAN_PRICES.labourCredit : 0);
const deceitMentorWeeks = (s: SliceState) => Math.max(0, (s.fateTrojan.promotionWeek ?? s.week) - (s.deceitMentor.promotionWeek ?? s.week));
const exhaustedSupply = (state: FateTrojanState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${FATE_TROJAN_GUIDE}第${Math.ceil(number / 3)}批、第${week}周实际到货的序列2命运木马成品，独立封存编号fate-trojan-potion-${number}。本瓶须另行取得并独立耗用。`;
const hasPreparations = (s: SliceState) => FATE_TROJAN_PREPARATION_IDS.every(id => s.fateTrojan.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `欺瞒导师魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.deceitMentor.promotionWeek === null || deceitMentorWeeks(s) < FATE_TROJAN_MIN_DECEIT_MENTOR_WEEKS) return `成为欺瞒导师后已过${deceitMentorWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成本人核验、既有关联追查与停止返还规划；购买原瓶不能代做专业准备。';
}
export function validateFateTrojanAcquisitionCommand(v: unknown): v is FateTrojanAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && FATE_TROJAN_PREPARATION_IDS.includes(v.taskId as typeof FATE_TROJAN_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^fate-trojan-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isFateTrojanAcquisitionCommand = validateFateTrojanAcquisitionCommand;
export function validateFateTrojanCommand(v: unknown): v is FateTrojanCommand {
  return validateFateTrojanAcquisitionCommand(v) || validateFateTrojanActivityCommand(v) || validateFateTrojanEncounterCommand(v);
}
export function fateTrojanAcquisitionBlock(s: SliceState, command: FateTrojanAcquisitionCommand): string | null {
  if (!validateFateTrojanAcquisitionCommand(command)) return '命运木马准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if (hasFateTrojanOldPractice(s) || hasFateTrojanLifeLock(s) || hasFateTrojanEncounterLock(s)) return '先实际结束旧寄生、原念头与暂窃窗口，归还原物并收束旧准备和当前实践；旧人物、伤势、能力记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德命运木马专业交接处。';
  if (!knownChannel(s)) return '实际成为欺瞒导师并保留原指导渠道后，才能了解命运木马之路。';
  if (!isFateTrojanAcquisitionStage(s)) return '已经晋升命运木马2，不能重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '偷盗者至欺瞒导师的12项掌握记录不完整，暂不能继续晋升。';
  const state = s.fateTrojan;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、专业准备与本次风险。' : s.cash < FATE_TROJAN_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听交接处说明独立成品来源、专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的命运木马原瓶。';
    return s.cash < FATE_TROJAN_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批命运木马原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的命运木马准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选命运木马独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= FATE_TROJAN_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyFateTrojanAcquisition(s: SliceState, command: FateTrojanAcquisitionCommand, ctx: SeerContext): void {
  const reason = fateTrojanAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.fateTrojan;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= FATE_TROJAN_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取命运木马独立成品与专业准备指导', `花1行动、500便士。${FATE_TROJAN_GUIDE}说明原渠道记录。${FATE_TROJAN_FORMULA_STATUS}${FATE_TROJAN_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = FATE_TROJAN_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= FATE_TROJAN_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，专业支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(FATE_TROJAN_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('命运木马独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，三项准备与当周场地检查仍须实际完成。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批命运木马成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < FATE_TROJAN_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`fate-trojan-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶命运木马原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.deceitMentorActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of FATE_TROJAN_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为命运木马', `本周检查后独立确认饮用的${bottle.id}耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；欺瞒导师消化100与原12项掌握保留，两项新掌握从0开始。灵性上限120，当前不补满，身体性别保持。过去各阶的药瓶、劳务、原物、人物身体、宿主自主权、念头、暂窃窗口与原敌伤亡记录全部留存。本人沿原出口离开，本次场地准备耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '命运木马魔药严重排异' : '命运木马魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为欺瞒导师，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyFateTrojanCommand(s: SliceState, command: FateTrojanCommand, ctx: SeerContext): void {
  if (!validateFateTrojanCommand(command)) throw new Error('命运木马命令无效。');
  if (validateFateTrojanAcquisitionCommand(command)) return applyFateTrojanAcquisition(s, command, ctx);
  if (validateFateTrojanActivityCommand(command)) return applyFateTrojanActivity(s, command, ctx);
  if (validateFateTrojanEncounterCommand(command)) return applyFateTrojanEncounterCommand(s, command, ctx);
  throw new Error('未知命运木马命令。');
}

export function projectFateTrojan(s: SliceState): FateTrojanProjection {
  const state = s.fateTrojan, available = knownChannel(s), promoted = isFateTrojan(s), actions: FateTrojanAction[] = [];
  const add = (id: string, label: string, cost: string, command: FateTrojanAcquisitionCommand) => { const reason = fateTrojanAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-fate-trojan-guidance', '听取命运木马成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of FATE_TROJAN_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`fate-trojan-prepare-${task.id}`, task.title, '1行动 · 专业准备', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-fate-trojan-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-fate-trojan-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-fate-trojan-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-fate-trojan-supply', '申请下一批独立命运木马成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${FATE_TROJAN_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶命运木马魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 欺瞒导师消化${s.progression.acting}/100 · ${deceitMentorWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '命运木马·错误序列2', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${FATE_TROJAN_FORMULA_STATUS}${FATE_TROJAN_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available ? [...actions, ...fateTrojanLifeActions(s), ...fateTrojanEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 命运木马成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为欺瞒导师' : '排异，仍为欺瞒导师'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? FATE_TROJAN_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? FATE_TROJAN_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `欺瞒导师消化${state.deceitMentorActingAtPromotion}/100留存；命运木马扮演${s.progression.acting}/100。三项报告各25、反思25；普通完成同样可消化，掌握只计实际能力应用。` : available ? `欺瞒导师需消化100（当前${s.progression.acting}/100）、晋3后12整周（当前${deceitMentorWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完欺瞒导师之路。',
    pollution: s.seer.pollution, risk: available ? FATE_TROJAN_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `欺瞒导师在第${s.deceitMentor.promotionWeek}周实际晋升；${promoted ? `当时消化${state.deceitMentorActingAtPromotion}/100已留存` : `当前消化${s.progression.acting}/100`}。十二整周从该周计算。`,
      `历阶消化：偷盗者${s.swindler.marauderActingAtPromotion}、诈骗师${s.cryptologist.swindlerActingAtPromotion}、解密学者${s.fireThief.cryptologistActingAtPromotion}、盗火人${s.dreamStealer.fireThiefActingAtPromotion}、窃梦家${s.parasite.dreamStealerActingAtPromotion}、寄生者${s.deceitMentor.parasiteActingAtPromotion}、欺瞒导师${promoted ? state.deceitMentorActingAtPromotion : s.progression.acting}。`,
      `十二项已有技巧的掌握值保持，详见下方能力列表。`,
      `健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；原伤势${s.injuries.length}处，累计风险${s.injuryRisk}，当前身体${s.character.gender === 'FEMALE' ? '女性' : '男性'}。`,
      `原宿主保持清醒并掌控自己的身体；此前实际进入${s.parasite.life.player.entries}次、分离${s.parasite.life.player.exits}次，记录保留。`,
      `此前原念头已执行${s.parasite.life.thought.executions}次、恢复${s.parasite.life.thought.recoveries}次；原人和原椅保持当时状态，不会随本次晋升重新生成。`,
      `原拉尔夫健康${s.parasite.encounter.enemyHealth}/100、精神${s.parasite.encounter.enemyMind}/100、灵性${s.parasite.encounter.enemySpirituality}，${s.parasite.encounter.enemyStatus === 'DEAD' ? '已死亡' : s.parasite.encounter.enemyStatus === 'SURRENDERED' ? '已投降' : '仍按原接触结果生活'}；原棍归属和位置保持。`,
      ...s.parasite.encounter.borrowed.map((power, index) => `此前第${index + 1}份暂借能力在${power.acquiredSeconds}秒取得、${power.expiresSeconds}秒到期，${power.closedSeconds === null ? '尚未关闭' : `已于${power.closedSeconds}秒关闭`}；原主${power.restoredToSource ? '已恢复' : '尚未恢复'}。`),
      `旧工坊的${s.deceitMentor.life.edith.name}和${s.deceitMentor.life.basil.name}仍在各自原位置，已有行程${s.deceitMentor.life.basil.travelMetres}米。原灯剩油${s.deceitMentor.life.lamp.oil}、余辉${s.deceitMentor.life.lamp.wickSeconds}秒；原蜡烛剩${s.deceitMentor.life.candle.remaining}。`,
      `旧纸签、原卡片及误判纠正记录均按当时经过保存，本次登记室使用另一组原件。`,
      `原吉迪恩健康${s.deceitMentor.encounter.enemyHealth}/100、精神${s.deceitMentor.encounter.enemyMind}/100、灵性${s.deceitMentor.encounter.enemySpirituality}，原伤势${s.deceitMentor.encounter.enemyInjuries.length}处；${s.deceitMentor.encounter.enemyStatus === 'DEAD' ? '已死亡' : s.deceitMentor.encounter.enemyStatus === 'SURRENDERED' ? '已投降' : '保留此前接触结果'}，原杖没有被复制。`,
    ] : [],
    life: projectFateTrojanLife(s), encounter: projectFateTrojanEncounter(s), insideCase: hasFateTrojanLock(s),
    environment: available ? '登记室：门口0米，登记桌2米，原柜6米，室外−2米。39岁的莉娜负责记录，43岁的维克托是原柜关联和原包裹的主人。每案单独取得当前同意，封签须实际付费，原人、原柜、原包裹与各人原身体持续保留。步行按真实距离计时，尚欠关联、原物或搬运责任时须在现场收束。' : '',

  };
}

/** Exact source identity and bounded chronological records; older modules own their detailed history. */
export function validateFateTrojanState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.fateTrojan;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'deceitMentorActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== FATE_TROJAN_BOTTLE_IDS.length * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as FateTrojanState, promoted = isFateTrojan(s), acquisitionStage = isFateTrojanAcquisitionStage(s);
  const firstWeek = s.deceitMentor.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + FATE_TROJAN_MIN_DECEIT_MENTOR_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (acquisitionStage && (!knownChannel(s) || !shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > FATE_TROJAN_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !FATE_TROJAN_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.eventQueue.length > 0 || s.pulse !== 'NONE' || hasFateTrojanOldPractice(s) || hasFateTrojanLifeLock(s) || hasFateTrojanEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !knownChannel(s) || !integer(s.deceitMentor.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.deceitMentorActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || hasFateTrojanOldPractice(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...FATE_TROJAN_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.deceitMentorActingAtPromotion !== null || FATE_TROJAN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `fate-trojan-potion-${index + 1}` || !integer(b.labourSteps, 0, FATE_TROJAN_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < FATE_TROJAN_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== FATE_TROJAN_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % FATE_TROJAN_BOTTLE_IDS.length;
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
        if (!integer(s.deceitMentor.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateFateTrojanLife(s) || !validateFateTrojanEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { FATE_TROJAN_ABILITIES } from './content.js';
export { FATE_TROJAN_ABILITY_IDS } from './types.js';
export type * from './types.js';
