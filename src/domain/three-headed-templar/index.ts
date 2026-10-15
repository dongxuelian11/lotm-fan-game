import { ELDER_ABILITY_IDS } from '../elder/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../secret-supplicant/types.js';
import { LISTENER_ABILITY_IDS } from '../listener/types.js';
import { SHADOW_ASCETIC_ABILITY_IDS } from '../shadow-ascetic/types.js';
import { ROSE_BISHOP_ABILITY_IDS } from '../rose-bishop/types.js';
import { SHEPHERD_ABILITY_IDS } from '../shepherd/types.js';
import { BLACK_KNIGHT_ABILITY_IDS } from '../black-knight/types.js';
import { secretSupplicantInside } from '../secret-supplicant/life.js';
import { listenerInside } from '../listener/life.js';
import { shadowAsceticInside } from '../shadow-ascetic/life.js';
import { roseBishopInside } from '../rose-bishop/life.js';
import { shepherdInside } from '../shepherd/life.js';
import { hasBlackKnightLifeLock } from '../black-knight/life.js';
import { hasBlackKnightEncounterLock } from '../black-knight/encounter.js';
import { createThreeHeadedTemplarLifeState, applyThreeHeadedTemplarActivity, projectThreeHeadedTemplarLife, threeHeadedTemplarLifeActions, validateThreeHeadedTemplarLife, validateThreeHeadedTemplarActivityCommand, hasThreeHeadedTemplarLifeLock } from './life.js';
import { createThreeHeadedTemplarEncounterState, applyThreeHeadedTemplarEncounterCommand, projectThreeHeadedTemplarEncounter, threeHeadedTemplarEncounterActions, validateThreeHeadedTemplarEncounter, validateThreeHeadedTemplarEncounterCommand, hasThreeHeadedTemplarEncounterLock } from './encounter.js';
import { THREE_HEADED_TEMPLAR_ABILITIES, THREE_HEADED_TEMPLAR_BOTTLE_IDS, THREE_HEADED_TEMPLAR_CONSUMPTION_RISK, THREE_HEADED_TEMPLAR_FORMULA_STATUS, THREE_HEADED_TEMPLAR_GUIDE, THREE_HEADED_TEMPLAR_LABOUR_STEPS, THREE_HEADED_TEMPLAR_LABOUR_TASKS, THREE_HEADED_TEMPLAR_MIN_BLACK_KNIGHT_WEEKS, THREE_HEADED_TEMPLAR_POTION_SOURCES, THREE_HEADED_TEMPLAR_PREPARATIONS, THREE_HEADED_TEMPLAR_PRICES, THREE_HEADED_TEMPLAR_SOURCE_STATUS } from './content.js';
import { THREE_HEADED_TEMPLAR_ABILITY_IDS, THREE_HEADED_TEMPLAR_PREPARATION_IDS, type ThreeHeadedTemplarAcquisitionCommand, type ThreeHeadedTemplarAction, type ThreeHeadedTemplarBottle, type ThreeHeadedTemplarCommand, type ThreeHeadedTemplarProjection, type ThreeHeadedTemplarState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): ThreeHeadedTemplarBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createThreeHeadedTemplarState(): ThreeHeadedTemplarState {
  return { guidanceKnown: false, bottles: THREE_HEADED_TEMPLAR_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, blackKnightActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createThreeHeadedTemplarLifeState(), encounter: createThreeHeadedTemplarEncounterState() };
}
export const isThreeHeadedTemplar = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 3;
export const hasThreeHeadedTemplarHistory = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && [3, 2].includes(s.progression.sequence ?? 0);
export const threeHeadedTemplarActing = (s: SliceState): number => s.progression.sequence === 2 ? s.elder?.threeHeadedTemplarActingAtPromotion ?? 0 : s.progression.acting;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && [4, 3, 2].includes(s.progression.sequence ?? 0)
  && s.secretSupplicant.discovered && s.secretSupplicant.guidanceKnown && s.listener.guidanceKnown && s.shadowAscetic.guidanceKnown
  && s.roseBishop.guidanceKnown && s.shepherd.guidanceKnown && s.blackKnight.guidanceKnown && s.blackKnight.promotionWeek !== null;
export const hasThreeHeadedTemplarOldPractice = (s: SliceState): boolean => secretSupplicantInside(s) || listenerInside(s) || shadowAsceticInside(s)
  || roseBishopInside(s) || shepherdInside(s) || hasBlackKnightLifeLock(s) || hasBlackKnightEncounterLock(s)
  || s.roseBishop.practice.shape !== 'NORMAL' || Object.values(s.shadowAscetic.cases).some(value => value.hidden)
  || [s.secretSupplicant, s.listener, s.shadowAscetic, s.roseBishop, s.shepherd].some(stage => Object.values(stage.cases).some(value => value.status === 'PREPARED'))
  || Object.values(s.blackKnight.life.cases).some(value => value.status === 'PREPARED')
  || s.blackKnight.life.shadow.bound || s.blackKnight.life.panel.bladeActive || s.blackKnight.life.card.borrowing
  || s.shepherd.encounter.blurReady || s.shepherd.encounter.status === 'FIGHTING'
  || s.blackKnight.encounter.shadowReady || s.blackKnight.encounter.bladeReady || s.blackKnight.encounter.wardIgnored;
export const hasThreeHeadedTemplarRitualLock = (s: SliceState): boolean => s.threeHeadedTemplar.preparedWeek !== null;
export const hasThreeHeadedTemplarLock = (s: SliceState): boolean => hasThreeHeadedTemplarRitualLock(s) || hasThreeHeadedTemplarLifeLock(s) || hasThreeHeadedTemplarEncounterLock(s);
const bottleNumber = (b: Pick<ThreeHeadedTemplarBottle, 'id'>) => Number(b.id.slice('three-headed-templar-potion-'.length));
const potionPrice = (b: ThreeHeadedTemplarBottle) => THREE_HEADED_TEMPLAR_PRICES.potion - (b.labourSteps === THREE_HEADED_TEMPLAR_LABOUR_STEPS ? THREE_HEADED_TEMPLAR_PRICES.labourCredit : 0);
const blackKnightWeeks = (s: SliceState) => Math.max(0, (s.threeHeadedTemplar.promotionWeek ?? s.week) - (s.blackKnight.promotionWeek ?? s.week));
const exhaustedSupply = (state: ThreeHeadedTemplarState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${THREE_HEADED_TEMPLAR_GUIDE}介绍的独立三首圣堂成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶three-headed-templar-potion-${number}；非黑骑士或更早原瓶改装。序列3三首圣堂已核实，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => THREE_HEADED_TEMPLAR_PREPARATION_IDS.every(id => s.threeHeadedTemplar.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `黑骑士魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.blackKnight.promotionWeek === null || blackKnightWeeks(s) < THREE_HEADED_TEMPLAR_MIN_BLACK_KNIGHT_WEEKS) return `成为黑骑士后已过${blackKnightWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成既有原灵记录核对、外放与本人借用边界核验和普通退出标记；购买原瓶不能代做专业准备。';
}
export function validateThreeHeadedTemplarAcquisitionCommand(v: unknown): v is ThreeHeadedTemplarAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && THREE_HEADED_TEMPLAR_PREPARATION_IDS.includes(v.taskId as typeof THREE_HEADED_TEMPLAR_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^three-headed-templar-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isThreeHeadedTemplarAcquisitionCommand = validateThreeHeadedTemplarAcquisitionCommand;
export function validateThreeHeadedTemplarCommand(v: unknown): v is ThreeHeadedTemplarCommand {
  return validateThreeHeadedTemplarAcquisitionCommand(v) || validateThreeHeadedTemplarActivityCommand(v) || validateThreeHeadedTemplarEncounterCommand(v);
}
export function threeHeadedTemplarAcquisitionBlock(s: SliceState, command: ThreeHeadedTemplarAcquisitionCommand): string | null {
  if (!validateThreeHeadedTemplarAcquisitionCommand(command)) return '三首圣堂准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasThreeHeadedTemplarOldPractice(s) || hasThreeHeadedTemplarLifeLock(s) || hasThreeHeadedTemplarEncounterLock(s)) return '先实际结束旧祈仪、接触、原身体变形、原物借用与黑骑士效果，归还原物并收束旧准备和当前实践；旧人物、伤势、原灵与隔离记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德THT3-SEALED-COURT旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为黑骑士并保留原指导渠道后，才能了解三首圣堂之路。';
  if (hasThreeHeadedTemplarHistory(s)) return '已经真实晋升三首圣堂3，不能重复准备或服药；未服原瓶保留。';
  const state = s.threeHeadedTemplar;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < THREE_HEADED_TEMPLAR_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的三首圣堂原瓶。';
    return s.cash < THREE_HEADED_TEMPLAR_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批三首圣堂原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的三首圣堂准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选三首圣堂独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= THREE_HEADED_TEMPLAR_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyThreeHeadedTemplarAcquisition(s: SliceState, command: ThreeHeadedTemplarAcquisitionCommand, ctx: SeerContext): void {
  const reason = threeHeadedTemplarAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.threeHeadedTemplar;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= THREE_HEADED_TEMPLAR_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取三首圣堂独立成品与专业准备指导', `花1行动、500便士。${THREE_HEADED_TEMPLAR_GUIDE}说明原渠道记录。${THREE_HEADED_TEMPLAR_FORMULA_STATUS}${THREE_HEADED_TEMPLAR_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = THREE_HEADED_TEMPLAR_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}${task.id === 'REVIEW_RECORDS' ? `实际核对自己的原黑骑士晋升周${s.blackKnight.promotionWeek}、原伊芮斯的实际放牧、塞德里克的永久释放与旧影体隔离记录；这些已有记录未被修改。` : ''}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= THREE_HEADED_TEMPLAR_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(THREE_HEADED_TEMPLAR_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('三首圣堂独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠人物同意、免费原灵、技能库、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批三首圣堂成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < THREE_HEADED_TEMPLAR_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`three-headed-templar-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶三首圣堂原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.blackKnightActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of THREE_HEADED_TEMPLAR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为三首圣堂', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；黑骑士消化100与全部旧掌握保留，唯一新能力hanged-man.s3.multiple-release掌握从0开始。灵性上限120，当前不补满；全部原灵、原储备和已选方法不补发。秘祈人至黑骑士的六阶原瓶、劳务、原物、原灵与原敌伤势或死亡均保留；塞德里克永久释放、伊芮斯实际放牧、旧独立影体永久隔离与原加里克投降均不改写。原核只确定可突破一次外放一位半神灵；本作G最多两位，主人仍一次只借一灵。新两灵必须逐一会面、付费准备并风险获得，本次不自动赠送。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '三首圣堂魔药严重排异' : '三首圣堂魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为黑骑士，旧消化、掌握、原灵与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyThreeHeadedTemplarCommand(s: SliceState, command: ThreeHeadedTemplarCommand, ctx: SeerContext): void {
  if (!validateThreeHeadedTemplarCommand(command)) throw new Error('三首圣堂命令无效。');
  if (validateThreeHeadedTemplarAcquisitionCommand(command)) return applyThreeHeadedTemplarAcquisition(s, command, ctx);
  if (validateThreeHeadedTemplarActivityCommand(command)) return applyThreeHeadedTemplarActivity(s, command, ctx);
  if (validateThreeHeadedTemplarEncounterCommand(command)) return applyThreeHeadedTemplarEncounterCommand(s, command, ctx);
  throw new Error('未知三首圣堂命令。');
}

export function projectThreeHeadedTemplar(s: SliceState): ThreeHeadedTemplarProjection {
  const state = s.threeHeadedTemplar, available = knownChannel(s), promoted = hasThreeHeadedTemplarHistory(s), actions: ThreeHeadedTemplarAction[] = [];
  const add = (id: string, label: string, cost: string, command: ThreeHeadedTemplarAcquisitionCommand) => { const reason = threeHeadedTemplarAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-three-headed-templar-guidance', '听取三首圣堂成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of THREE_HEADED_TEMPLAR_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`three-headed-templar-prepare-${task.id}`, task.title, '1行动 · 真实专业准备', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-three-headed-templar-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-three-headed-templar-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-three-headed-templar-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-three-headed-templar-supply', '申请下一批独立三首圣堂成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${THREE_HEADED_TEMPLAR_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶三首圣堂魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 黑骑士消化${s.progression.acting}/100 · ${blackKnightWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions: ThreeHeadedTemplarAction[] = available ? [...actions, ...threeHeadedTemplarLifeActions(s), ...threeHeadedTemplarEncounterActions(s)] : [];
  const preferred = allActions.find(action => action.enabled && action.command.type !== 'LEAVE_PREPARATION') ?? allActions.find(action => action.enabled);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '三首圣堂·倒吊人序列3', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${THREE_HEADED_TEMPLAR_FORMULA_STATUS}${THREE_HEADED_TEMPLAR_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, preferredActionId: preferred?.id ?? null, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : available ? (allActions.find(action => action.reason)?.reason ?? '当前准备与演练已收束，可继续普通生活。') : '先走完黑骑士之路。',
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 三首圣堂成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为黑骑士' : '排异，仍为黑骑士'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? THREE_HEADED_TEMPLAR_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? THREE_HEADED_TEMPLAR_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? threeHeadedTemplarActing(s) : 0, digestion: promoted ? `黑骑士消化${state.blackKnightActingAtPromotion}/100留存；三首圣堂扮演${threeHeadedTemplarActing(s)}/100。三项真实情境各25、反思25，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `黑骑士需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${blackKnightWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完黑骑士之路。',
    pollution: s.seer.pollution, risk: available ? THREE_HEADED_TEMPLAR_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    inheritedTools: available ? `原动物来源份额与血肉储备${s.roseBishop.reserve.points}/${s.roseBishop.reserve.max}保持，使用须实付原储备。旧原灵当前${s.shepherd.grazing.spirits.filter(spirit => spirit.status === 'GRAZED').length}位已放牧，与新源合计至多7位，每灵至多3项原已选方法。当前本人借用：${s.shepherd.grazing.activeSpiritId ?? '无'}；全局仍同时只借1灵。本切片本人仅借用旧伊芮斯的原已选技能，两位新源只供实际外放协作，未实现或暗赠新的本人借用技能库。旧低阶灵不因此升为半神，也不算作这两位外放原灵。` : '',
    inheritedHistory: available ? [
      `黑骑士第${s.blackKnight.promotionWeek}周真实晋升；${promoted ? `原消化${state.blackKnightActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '秘祈人、倾听者、隐修士、蔷薇主教、牧羊人与黑骑士的全部原ID、掌握、原瓶、劳务、原物、许可与拒绝记录保留，旧掌握0仍为0；双灵外放不送灵库、不复制原物，不变更旧放牧记录形状。',
      ...s.shepherd.grazing.spirits.map(spirit => `原灵${spirit.id === 'SH5-IRIS-1' ? '伊芮斯' : spirit.id === 'SH5-CEDRIC-1' ? '塞德里克' : spirit.id}（${spirit.id}）：${spirit.status}，取得周${spirit.acquiredWeek ?? '未取得'}，释放周${spirit.releasedWeek ?? '未释放'}；原已选方法${spirit.selectedAbilities.join('、') || '无'}。永久释放者不得召回或重新获得，已放牧者不被免费换成新灵。`),
      `旧独立影体${s.blackKnight.life.shade.creatureId ?? '尚未生成'}：${s.blackKnight.life.shade.status}，位置${s.blackKnight.life.shade.creatureLocation}，原隔离间${s.blackKnight.life.shade.roomStatus}；受控=${s.blackKnight.life.shade.controlled}。原紧急封条${s.blackKnight.life.shade.emergencySealUsed ? '已经实际耗用' : '未耗用'}，原破损灯罩${s.blackKnight.life.shade.glassHood}保持，永不作为可外放宠物或本次灵魂来源。`,
      `原加里克${s.blackKnight.encounter.targetId}：${s.blackKnight.encounter.enemyStatus}，健康${s.blackKnight.encounter.enemyHealth}/100、精神${s.blackKnight.encounter.enemyMind}/100、灵性${s.blackKnight.encounter.enemySpirituality}，原伤势${s.blackKnight.encounter.enemyInjuries.length}处；晋升和离场不治疗、重开或复活旧对手。`,
    ] : [],
    life: projectThreeHeadedTemplarLife(s), encounter: projectThreeHeadedTemplarEncounter(s), insideCase: hasThreeHeadedTemplarLock(s),
    environment: available ? '原创G原场THT3-SEALED-COURT：主人原站START，A距原站4米、B距原站8米，沿同一普通路线实走并计时。原卡THT3-CARD、左右原箱、原遮板与原灯均为唯一实体；两位此前已故的原创半神灵须从各自原封存容器风险获得，再实付启动和协作成本。外放至多2位是本作G有限实现，主人仍一次借1灵；撤回沿原路、不补满，普通本人逐处照料路线始终可用。所有新人物、范围、费用、物件和精确数值均为G。' : '',


  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateThreeHeadedTemplarState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.threeHeadedTemplar;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'blackKnightActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as ThreeHeadedTemplarState, promoted = hasThreeHeadedTemplarHistory(s), firstWeek = s.blackKnight.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + THREE_HEADED_TEMPLAR_MIN_BLACK_KNIGHT_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !THREE_HEADED_TEMPLAR_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasThreeHeadedTemplarOldPractice(s) || hasThreeHeadedTemplarLifeLock(s) || hasThreeHeadedTemplarEncounterLock(s))) return false;
  if (promoted) {
    if (s.progression.sequence === 2 && (s.elder?.threeHeadedTemplarActingAtPromotion !== 100 || !integer(s.elder?.promotionWeek, state.promotionWeek ?? s.week, s.week))) return false;
    if (!state.guidanceKnown || !integer(s.blackKnight.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.blackKnightActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS, ...SHADOW_ASCETIC_ABILITY_IDS, ...ROSE_BISHOP_ABILITY_IDS, ...SHEPHERD_ABILITY_IDS, ...BLACK_KNIGHT_ABILITY_IDS, ...THREE_HEADED_TEMPLAR_ABILITY_IDS, ...(s.progression.sequence === 2 ? ELDER_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.blackKnightActingAtPromotion !== null || THREE_HEADED_TEMPLAR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `three-headed-templar-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== THREE_HEADED_TEMPLAR_POTION_SOURCES[index]!.source) return false; }
    else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, state.promotionWeek ?? s.week) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % 3;
      if (b.stockedWeek !== state.bottles[batchStart]!.stockedWeek || state.bottles.slice(batchStart - 3, batchStart).some(previous => previous.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(previous.outcome ?? '') || !integer(previous.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
    }
    if (!state.guidanceKnown && (b.labourSteps !== 0 || b.status !== 'SUPPLIER')) return false;
    if (b.status === 'SUPPLIER') { if (b.acquiredWeek !== null || b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false; }
    else {
      if (!state.guidanceKnown || !integer(b.acquiredWeek, stockWeek, state.promotionWeek ?? s.week)) return false;
      if (b.status === 'PLAYER') { if (b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false; }
      else if (b.status === 'CONSUMED') {
        if (!integer(s.blackKnight.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateThreeHeadedTemplarLife(s) && validateThreeHeadedTemplarEncounter(s);
}
export { THREE_HEADED_TEMPLAR_ABILITIES } from './content.js';
export { THREE_HEADED_TEMPLAR_ABILITY_IDS } from './types.js';
export type * from './types.js';
