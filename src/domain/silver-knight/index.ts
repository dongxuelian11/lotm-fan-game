import { GLORY_ABILITY_IDS } from '../glory/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { WARRIOR_ABILITY_IDS } from '../warrior/types.js';
import { GLADIATOR_ABILITY_IDS } from '../gladiator/types.js';
import { WEAPONMASTER_ABILITY_IDS } from '../weaponmaster/types.js';
import { DAWN_PALADIN_ABILITY_IDS } from '../dawn-paladin/types.js';
import { GUARDIAN_ABILITY_IDS } from '../guardian/types.js';
import { DEMON_HUNTER_ABILITY_IDS } from '../demon-hunter/types.js';
import { hasGuardianOpenPractice } from '../guardian/encounter.js';
import { gladiatorInside } from '../gladiator/life.js';
import { hasDemonHunterEncounterLock } from '../demon-hunter/encounter.js';
import { hasDemonHunterLifeLock } from '../demon-hunter/life.js';
import { createSilverKnightRitualState, validateSilverKnightRitual, validateSilverKnightRitualCommand, applySilverKnightRitualCommand, projectSilverKnightRitual, silverKnightRitualActions, silverKnightAnchorBlock, writeSilverKnightAnchor, silverKnightRitualPreparationBlock, prepareSilverKnightRitual, cancelSilverKnightRitual, consumeSilverKnightRitual, currentSilverKnightRemains, currentSilverKnightBlessing, hasSilverKnightRitualLock } from './ritual.js';
import { createSilverKnightLifeState, applySilverKnightActivity, projectSilverKnightLife, silverKnightLifeActions, validateSilverKnightLife, validateSilverKnightActivityCommand, hasSilverKnightLifeLock } from './life.js';
import { createSilverKnightEncounterState, applySilverKnightEncounterCommand, projectSilverKnightEncounter, silverKnightEncounterActions, validateSilverKnightEncounter, validateSilverKnightEncounterCommand, hasSilverKnightEncounterLock } from './encounter.js';
import { SILVER_KNIGHT_ABILITIES, SILVER_KNIGHT_BOTTLE_IDS, SILVER_KNIGHT_CONSUMPTION_RISK, SILVER_KNIGHT_FORMULA_STATUS, SILVER_KNIGHT_GUIDE, SILVER_KNIGHT_LABOUR_STEPS, SILVER_KNIGHT_LABOUR_TASKS, SILVER_KNIGHT_MIN_DEMON_HUNTER_WEEKS, SILVER_KNIGHT_POTION_SOURCES, SILVER_KNIGHT_PREPARATIONS, SILVER_KNIGHT_PRICES, SILVER_KNIGHT_SOURCE_STATUS } from './content.js';
import { SILVER_KNIGHT_ABILITY_IDS, SILVER_KNIGHT_PREPARATION_IDS, type SilverKnightAcquisitionCommand, type SilverKnightAction, type SilverKnightBottle, type SilverKnightCommand, type SilverKnightProjection, type SilverKnightState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): SilverKnightBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createSilverKnightState(): SilverKnightState {
  return { guidanceKnown: false, bottles: SILVER_KNIGHT_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, demonHunterActingAtPromotion: null,
    preparations: [], preparedWeek: null, ritual: createSilverKnightRitualState(), life: createSilverKnightLifeState(), encounter: createSilverKnightEncounterState() };
}
export const isSilverKnight = (s: SliceState) => s.progression.pathwayId === 'warrior' && s.progression.sequence === 3;
export const hasSilverKnightHistory = (s: SliceState) => s.progression.pathwayId === 'warrior' && [3, 2].includes(s.progression.sequence ?? 0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'warrior' && [4, 3, 2].includes(s.progression.sequence ?? 0) && s.warrior.discovered && s.warrior.guidanceKnown && s.gladiator.guidanceKnown && s.weaponmaster.guidanceKnown && s.dawnPaladin.guidanceKnown && s.guardian.guidanceKnown && s.demonHunter.guidanceKnown && s.demonHunter.promotionWeek !== null;
export const hasSilverKnightOldPractice = (s: SliceState): boolean => hasGuardianOpenPractice(s) || gladiatorInside(s) || hasDemonHunterLifeLock(s) || hasDemonHunterEncounterLock(s) || [s.warrior, s.gladiator, s.weaponmaster, s.dawnPaladin, s.guardian].some(stage => Object.values(stage.cases).some(value => value.status === 'PREPARED')) || Object.values(s.demonHunter.life.cases).some(value => value.status === 'PREPARED');
export { hasSilverKnightRitualLock } from './ritual.js';
export const hasSilverKnightLock = (s: SliceState): boolean => hasSilverKnightRitualLock(s) || hasSilverKnightLifeLock(s) || hasSilverKnightEncounterLock(s);
const bottleNumber = (b: Pick<SilverKnightBottle, 'id'>) => Number(b.id.slice('silver-knight-potion-'.length));
const potionPrice = (b: SilverKnightBottle) => SILVER_KNIGHT_PRICES.potion - (b.labourSteps === SILVER_KNIGHT_LABOUR_STEPS ? SILVER_KNIGHT_PRICES.labourCredit : 0);
const demonHunterWeeks = (s: SliceState) => Math.max(0, (s.silverKnight.promotionWeek ?? s.week) - (s.demonHunter.promotionWeek ?? s.week));
const exhaustedSupply = (state: SilverKnightState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${SILVER_KNIGHT_GUIDE}介绍的独立银骑士成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶silver-knight-potion-${number}；非猎魔者或更早原瓶改装。序列3银骑士已核实，完整祭坛布局与配方未知，六种本人亲猎与原天使实际祝福另行完成。`;
const hasPreparations = (s: SliceState) => SILVER_KNIGHT_PREPARATION_IDS.every(id => s.silverKnight.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `猎魔者魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.demonHunter.promotionWeek === null || demonHunterWeeks(s) < SILVER_KNIGHT_MIN_DEMON_HUNTER_WEEKS) return `成为猎魔者后已过${demonHunterWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成亲猎条件核读、本人原锚记录与G祭坛布局实读；购买原瓶不能代做专业准备。';
}
export function validateSilverKnightAcquisitionCommand(v: unknown): v is SilverKnightAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && SILVER_KNIGHT_PREPARATION_IDS.includes(v.taskId as typeof SILVER_KNIGHT_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^silver-knight-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isSilverKnightAcquisitionCommand = validateSilverKnightAcquisitionCommand;
export function validateSilverKnightCommand(v: unknown): v is SilverKnightCommand {
  return validateSilverKnightAcquisitionCommand(v) || validateSilverKnightActivityCommand(v) || validateSilverKnightEncounterCommand(v) || validateSilverKnightRitualCommand(v);
}
export function silverKnightAcquisitionBlock(s: SliceState, command: SilverKnightAcquisitionCommand): string | null {
  if (!validateSilverKnightAcquisitionCommand(command)) return '银骑士准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasSilverKnightOldPractice(s) || hasSilverKnightLifeLock(s) || hasSilverKnightEncounterLock(s)) return '先实际结束旧训练、护人、原探针与接近路线，归还原物并收束旧准备和当前实践；旧人物、伤势与涂层记录保留。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德SK3-CHAPEL旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为猎魔者并保留原指导渠道后，才能了解银骑士之路。';
  if (hasSilverKnightHistory(s)) return '已经真实晋升银骑士3，不能重复准备或服药；未服原瓶保留。';
  const state = s.silverKnight;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null || state.ritual.activeAttemptId === null ? '没有本次尚未使用的祭坛准备。' : null;
  if (hasSilverKnightRitualLock(s) && !['PREPARE_PROMOTION', 'CONSUME'].includes(command.type)) return '先实际结束原礼堂内的会见或祭坛接触，不能隔空购买或劳动。';
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < SILVER_KNIGHT_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : command.taskId === 'RECORD_ANCHOR' ? silverKnightAnchorBlock(s) : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的银骑士原瓶。';
    const ritualReason = silverKnightRitualPreparationBlock(s); if (ritualReason) return ritualReason;
    return s.cash < SILVER_KNIGHT_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批银骑士原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的银骑士准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选银骑士独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    if (state.preparedWeek !== s.week || state.ritual.activeAttemptId === null) return '须1行动与140便士实际应用本周祭坛耗材；旧准备不能使用。';
    return silverKnightRitualPreparationBlock(s);
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= SILVER_KNIGHT_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applySilverKnightAcquisition(s: SliceState, command: SilverKnightAcquisitionCommand, ctx: SeerContext): void {
  const reason = silverKnightAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.silverKnight;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= SILVER_KNIGHT_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取银骑士独立成品与专业准备指导', `花1行动、500便士。${SILVER_KNIGHT_GUIDE}说明原渠道记录。${SILVER_KNIGHT_FORMULA_STATUS}${SILVER_KNIGHT_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = SILVER_KNIGHT_PREPARATIONS.find(p => p.id === command.taskId)!;
      if (task.id === 'RECORD_ANCHOR') writeSilverKnightAnchor(s);
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      prepareSilverKnightRitual(s); s.actionsRemaining--; s.cash -= SILVER_KNIGHT_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际应用本周原祭坛耗材', '花1行动、140便士，在本人亲手摆好的六种原遗骸旁实际应用一份原封护粉与祭坛材料，原奥瑞尔当周祝福就绪。本人在原祭坛，尚未饮药；须对所选原瓶独立确认。取消沿4米原路返回、已用耗材不复原、原遗骸留原槽；配方与原著精确布局仍未知。'); return;
    case 'LEAVE_PREPARATION':
      cancelSilverKnightRitual(s); state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动沿原祭坛到门处普通4米退出，未服原瓶保留，已用行动、140便士、封护粉及祭坛材料不返。当次祝福取消，六原遗骸仍在原槽，三项真实准备与原锚保留；下次须另约实际祝福并重新应用耗材。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(SILVER_KNIGHT_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('银骑士独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠六遗骸、锚册、人物同意或天使祝福。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批银骑士成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < SILVER_KNIGHT_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`silver-knight-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶银骑士原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      consumeSilverKnightRitual(s, bottle.id, result.tier);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.demonHunterActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of SILVER_KNIGHT_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为银骑士', `独立确认的原瓶${bottle.id}、本人六种亲猎原遗骸和本场原奥瑞尔祝福实际耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1，猎魔者消化100和全部旧掌握保留，三新掌握0。灵性上限120且当前不补满，身体性别不改变。旧六阶人物、原物、涂层、投降和伤势完整保留；不赠水银形态、随机好运或更高位能力。本人沿原祭坛普通4米回到门处。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '银骑士魔药严重排异' : '银骑士魔药排异', `原瓶${bottle.id}、本次六原遗骸、原祝福和已用祭坛耗材均耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为猎魔者，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原祭坛普通4米离开。可休养重筹另一原瓶，下一真实周实查同种新个体、重新亲猎与会见；旧死亡原体不复活，不自动发新遗骸。`);
      }
      return;
    }
  }
}
export function applySilverKnightCommand(s: SliceState, command: SilverKnightCommand, ctx: SeerContext): void {
  if (!validateSilverKnightCommand(command)) throw new Error('银骑士命令无效。');
  if (validateSilverKnightAcquisitionCommand(command)) return applySilverKnightAcquisition(s, command, ctx);
  if (validateSilverKnightActivityCommand(command)) return applySilverKnightActivity(s, command, ctx);
  if (validateSilverKnightEncounterCommand(command)) return applySilverKnightEncounterCommand(s, command, ctx);
  if (validateSilverKnightRitualCommand(command)) return applySilverKnightRitualCommand(s, command, ctx);
  throw new Error('未知银骑士命令。');
}

export function projectSilverKnight(s: SliceState): SilverKnightProjection {
  const state = s.silverKnight, available = knownChannel(s), promoted = hasSilverKnightHistory(s), actions: SilverKnightAction[] = [];
  const acting = s.progression.sequence === 2 ? s.glory.silverKnightActingAtPromotion ?? 100 : s.progression.acting;
  const add = (id: string, label: string, cost: string, command: SilverKnightAcquisitionCommand) => { const reason = silverKnightAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-silver-knight-guidance', '听取银骑士成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of SILVER_KNIGHT_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`silver-knight-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-silver-knight-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-silver-knight-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-silver-knight-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-silver-knight-supply', '申请下一批独立银骑士成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${SILVER_KNIGHT_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶银骑士魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 猎魔者消化${s.progression.acting}/100 · ${demonHunterWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const ritual = projectSilverKnightRitual(s), life = projectSilverKnightLife(s), encounter = projectSilverKnightEncounter(s);
  const allActions = available && s.progression.sequence !== 2 ? [...actions, ...silverKnightRitualActions(s), ...silverKnightLifeActions(s), ...silverKnightEncounterActions(s)] : [];
  const remains = currentSilverKnightRemains(s);
  let preferred: SilverKnightAction | undefined;
  let nextStep = '先走完战士至猎魔者的真实道路。';
  if (available) {
    if (promoted) { preferred = allActions.find(a => a.enabled); nextStep = s.progression.sequence === 2 ? '银骑士原经历已保留，当前前往荣耀者页面。此处银甲完整度为当时记录，后续实际携带与损耗见荣耀者页面。' : life.nextStep; }
    else if (hasSilverKnightRitualLock(s)) { preferred = (state.preparedWeek !== null ? actions.filter(a => a.command.type === 'CONSUME') : [...actions.filter(a => a.command.type === 'PREPARE_PROMOTION'), ...ritual.actions]).find(a => a.enabled); nextStep = preferred?.label ?? ritual.nextStep; }
    else if (!state.guidanceKnown) { preferred = actions.find(a => a.enabled); nextStep = '先听取原导师说明亲猎、实际祝福与四档风险。'; }
    else if (!hasPreparations(s)) { preferred = actions.find(a => a.command.type === 'PREPARE_TASK' && a.enabled); nextStep = preferred?.label ?? '先完成三项不同的真实准备。'; }
    else if (!state.bottles.some(b => b.status === 'PLAYER')) { preferred = actions.find(a => a.command.type === 'BUY_POTION' && a.enabled) ?? actions.find(a => a.command.type === 'POTION_WORK' && a.enabled) ?? actions.find(a => a.enabled); nextStep = '筹备一瓶独立成品；劳务只抵对应原瓶，六遗骸和祝福另行实际取得。'; }
    else if (remains.length < 6) { preferred = silverKnightEncounterActions(s).find(a => a.enabled); nextStep = `六种原亲猎遗骸已有${remains.length}/6；实际调查原目标，可选择退出留4。`; }
    else { preferred = ritual.actions.find(a => a.enabled); nextStep = currentSilverKnightBlessing(s) ? '本人走到原祭坛，逐一正确放好六原遗骸。' : '预约原奥瑞尔，亲身到原会见点出示记录并等待实际回应。'; }
  }
  return {
    title: '银骑士·战士序列3（六种亲猎与实际祝福G）', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${SILVER_KNIGHT_FORMULA_STATUS}${SILVER_KNIGHT_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, nextStep, preferredActionId: preferred?.id ?? null,
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 银骑士独立成品`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际祭坛准备后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? SILVER_KNIGHT_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? SILVER_KNIGHT_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? acting : 0, digestion: promoted ? `猎魔者消化${state.demonHunterActingAtPromotion}/100留存；银骑士扮演${acting}/100。三案报告各25、反思25为G，普通完成可消化，掌握只奖实际能力成功。` : available ? `猎魔者需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${demonHunterWeeks(s)}/12）；另须三准备、原锚、六种亲猎与实际祝福。` : '先走完猎魔者之路。',
    pollution: s.seer.pollution, risk: available ? SILVER_KNIGHT_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: promoted ? 120 : 112, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `原猎魔者第${s.demonHunter.promotionWeek}周晋升，${promoted ? `原消化${state.demonHunterActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}；战士、格斗家、武器大师、黎明骑士、守护者与猎魔者全部原记录保留。`,
      `原灰烬哨卫${s.demonHunter.encounter.targetId}：${s.demonHunter.encounter.enemyStatus}，健康${s.demonHunter.encounter.enemyHealth}/100、精神${s.demonHunter.encounter.enemyMind}/100、灵性${s.demonHunter.encounter.enemySpirituality}；原未用涂层${s.demonHunter.encounter.coatings.filter(c => c.status === 'SEALED').length}，不能转用新亲猎。`,
      `原训练棍${s.warrior.practiceClub.id}仍在${s.warrior.practiceClub.location}，原主人${s.warrior.practiceClub.owner}；原守护同伴健康${s.guardian.practice.allyHealth}，不因晋升治疗。`,
      '原晨曦剑继承，实质银甲、借光隐藏和传送细剑为已核方向；不下放特定祝福的水银形态、随机好运或序列2能力。',
    ] : [],
    ritual, life, encounter, insideCase: hasSilverKnightLock(s),
    environment: available ? '原创G原礼堂SK3-CHAPEL：原门OPEN，门至会见点6米、门至祭坛4米。锚册引用本人已发生的原训练与护人事件；六种亲猎在各自原矿区实例，死亡与遗骸独立保存。祭坛正确放位和原天使当场回应都须真实操作，不用材料清单冒充仪式。' : '',
  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateSilverKnightState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.silverKnight;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'demonHunterActingAtPromotion', 'preparations', 'preparedWeek', 'ritual', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as SilverKnightState, promoted = hasSilverKnightHistory(s), firstWeek = s.demonHunter.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + SILVER_KNIGHT_MIN_DEMON_HUNTER_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !SILVER_KNIGHT_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasSilverKnightLifeLock(s) || hasSilverKnightEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.demonHunter.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.demonHunterActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS, ...WEAPONMASTER_ABILITY_IDS, ...DAWN_PALADIN_ABILITY_IDS, ...GUARDIAN_ABILITY_IDS, ...DEMON_HUNTER_ABILITY_IDS, ...SILVER_KNIGHT_ABILITY_IDS, ...(s.progression.sequence === 2 ? GLORY_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.demonHunterActingAtPromotion !== null || SILVER_KNIGHT_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `silver-knight-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== SILVER_KNIGHT_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.demonHunter.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateSilverKnightRitual(s) && validateSilverKnightLife(s) && validateSilverKnightEncounter(s);
}
export { SILVER_KNIGHT_ABILITIES } from './content.js';
export { SILVER_KNIGHT_ABILITY_IDS } from './types.js';
export type * from './types.js';
