import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ASSASSIN_ABILITY_IDS } from '../assassin/types.js';
import { INSTIGATOR_ABILITY_IDS } from '../instigator/types.js';
import { WITCH_ABILITY_IDS } from '../witch/types.js';
import { PLEASURE_ABILITY_IDS } from '../pleasure/types.js';
import { PAIN_ABILITY_IDS } from '../pain/types.js';
import { DESPAIR_ABILITY_IDS } from '../despair/types.js';
import { CALAMITY_DEMONESS_ABILITY_IDS } from '../calamity-demoness/types.js';
import { hasPainOpenPractice } from '../pain/encounter.js';
import { hasDespairEncounterLock } from '../despair/encounter.js';
import { hasDespairLifeLock } from '../despair/life.js';
import { createUnagingDemonessLifeState, applyUnagingDemonessActivity, projectUnagingDemonessLife, unagingDemonessLifeActions, validateUnagingDemonessLife, validateUnagingDemonessActivityCommand, hasUnagingDemonessLifeLock } from './life.js';
import { createUnagingDemonessEncounterState, applyUnagingDemonessEncounterCommand, projectUnagingDemonessEncounter, unagingDemonessEncounterActions, validateUnagingDemonessEncounter, validateUnagingDemonessEncounterCommand, hasUnagingDemonessEncounterLock } from './encounter.js';
import { UNAGING_DEMONESS_ABILITIES, UNAGING_DEMONESS_BOTTLE_IDS, UNAGING_DEMONESS_CONSUMPTION_RISK, UNAGING_DEMONESS_FORMULA_STATUS, UNAGING_DEMONESS_GUIDE, UNAGING_DEMONESS_LABOUR_STEPS, UNAGING_DEMONESS_LABOUR_TASKS, UNAGING_DEMONESS_MIN_DESPAIR_WEEKS, UNAGING_DEMONESS_POTION_SOURCES, UNAGING_DEMONESS_PREPARATIONS, UNAGING_DEMONESS_PRICES, UNAGING_DEMONESS_SOURCE_STATUS } from './content.js';
import { UNAGING_DEMONESS_ABILITY_IDS, UNAGING_DEMONESS_PREPARATION_IDS, type UnagingDemonessAcquisitionCommand, type UnagingDemonessAction, type UnagingDemonessBottle, type UnagingDemonessCommand, type UnagingDemonessProjection, type UnagingDemonessState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): UnagingDemonessBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createUnagingDemonessState(): UnagingDemonessState {
  return { guidanceKnown: false, bottles: UNAGING_DEMONESS_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, despairActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createUnagingDemonessLifeState(), encounter: createUnagingDemonessEncounterState() };
}
export const isUnagingDemoness = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 3;
const hasUnagingDemonessHistory = (s: SliceState) => s.progression.pathwayId === 'demoness' && [3, 2].includes(s.progression.sequence ?? 0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'demoness' && [4, 3, 2].includes(s.progression.sequence ?? 0) && s.assassin.discovered && s.assassin.guidanceKnown && s.instigator.guidanceKnown && s.witch.formulaKnown && s.pleasure.formulaKnown && s.pain.guidanceKnown && s.despair.guidanceKnown && s.despair.promotionWeek !== null;
export const hasUnagingDemonessOldPractice = (s: SliceState): boolean => hasPainOpenPractice(s) || hasDespairLifeLock(s) || hasDespairEncounterLock(s) || s.pain.encounter.fieldActive || s.despair.encounter.fieldActive || Object.values(s.assassin.cases).some(value => value.position !== 'START') || Object.values(s.instigator.cases).some(value => value.tension === 'HEATED') || [s.assassin, s.instigator, s.witch, s.pleasure, s.pain].some(stage => Object.values(stage.cases).some(value => value.status === 'PREPARED')) || Object.values(s.despair.life.cases).some(value => value.status === 'PREPARED');
export const hasUnagingDemonessRitualLock = (s: SliceState): boolean => s.unagingDemoness.preparedWeek !== null;
export const hasUnagingDemonessLock = (s: SliceState): boolean => hasUnagingDemonessRitualLock(s) || hasUnagingDemonessLifeLock(s) || hasUnagingDemonessEncounterLock(s);
const bottleNumber = (b: Pick<UnagingDemonessBottle, 'id'>) => Number(b.id.slice('unaging-demoness-potion-'.length));
const potionPrice = (b: UnagingDemonessBottle) => UNAGING_DEMONESS_PRICES.potion - (b.labourSteps === UNAGING_DEMONESS_LABOUR_STEPS ? UNAGING_DEMONESS_PRICES.labourCredit : 0);
const despairWeeks = (s: SliceState) => Math.max(0, (s.unagingDemoness.promotionWeek ?? s.week) - (s.despair.promotionWeek ?? s.week));
const exhaustedSupply = (state: UnagingDemonessState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${UNAGING_DEMONESS_GUIDE}介绍的独立不老魔女成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶unaging-demoness-potion-${number}；非绝望魔女或更早原瓶改装。序列3不老魔女已核实，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => UNAGING_DEMONESS_PREPARATION_IDS.every(id => s.unagingDemoness.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `绝望魔女魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.despair.promotionWeek === null || despairWeeks(s) < UNAGING_DEMONESS_MIN_DESPAIR_WEEKS) return `成为绝望魔女后已过${despairWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成既往身份记录核对、原镜路径核验与本人返回标记；购买原瓶不能代做专业准备。';
}
export function validateUnagingDemonessAcquisitionCommand(v: unknown): v is UnagingDemonessAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && UNAGING_DEMONESS_PREPARATION_IDS.includes(v.taskId as typeof UNAGING_DEMONESS_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^unaging-demoness-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isUnagingDemonessAcquisitionCommand = validateUnagingDemonessAcquisitionCommand;
export function validateUnagingDemonessCommand(v: unknown): v is UnagingDemonessCommand {
  return validateUnagingDemonessAcquisitionCommand(v) || validateUnagingDemonessActivityCommand(v) || validateUnagingDemonessEncounterCommand(v);
}
export function unagingDemonessAcquisitionBlock(s: SliceState, command: UnagingDemonessAcquisitionCommand): string | null {
  if (!validateUnagingDemonessAcquisitionCommand(command)) return '不老魔女准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasUnagingDemonessOldPractice(s) || hasUnagingDemonessLifeLock(s) || hasUnagingDemonessEncounterLock(s)) return '先实际结束旧接触、丝线与疾病播散，归还原物并收束旧准备和当前实践；旧人物、伤势、能力记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德UD3-GALLERY旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为绝望魔女并保留原指导渠道后，才能了解不老魔女之路。';
  if (hasUnagingDemonessHistory(s)) return '已经真实晋升不老魔女3，不能重复准备或服药；未服原瓶保留。';
  const state = s.unagingDemoness;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < UNAGING_DEMONESS_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的不老魔女原瓶。';
    return s.cash < UNAGING_DEMONESS_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批不老魔女原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的不老魔女准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选不老魔女独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= UNAGING_DEMONESS_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyUnagingDemonessAcquisition(s: SliceState, command: UnagingDemonessAcquisitionCommand, ctx: SeerContext): void {
  const reason = unagingDemonessAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.unagingDemoness;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= UNAGING_DEMONESS_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取不老魔女独立成品与专业准备指导', `花1行动、500便士。${UNAGING_DEMONESS_GUIDE}说明原渠道记录。${UNAGING_DEMONESS_FORMULA_STATUS}${UNAGING_DEMONESS_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = UNAGING_DEMONESS_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}${task.id === 'REVIEW_RECORDS' ? `实际核对自己的原绝望魔女晋升周${s.despair.promotionWeek}、原身体变化及既往服药和照护选择；这些已有记录未被修改。` : ''}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= UNAGING_DEMONESS_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(UNAGING_DEMONESS_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('不老魔女独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠人物同意、免费原镜、复活、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批不老魔女成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < UNAGING_DEMONESS_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`unaging-demoness-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶不老魔女原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.despairActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of UNAGING_DEMONESS_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为不老魔女', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；绝望魔女消化100与全部旧掌握保留，唯一新能力assassin.s3.mirror-passage掌握从0开始。灵性上限120，当前不补满；原身体、性别与创建年龄记录不改变。以本周作为年轻外观特征的登记日期，不改写出生和既往履历。刺客至绝望魔女的全部原瓶、劳务、原物、疾病与原敌伤势或死亡均保留；不免费补镜，不获得死亡复活、任意全球传送或高阶截留免疫。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '不老魔女魔药严重排异' : '不老魔女魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为绝望魔女，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyUnagingDemonessCommand(s: SliceState, command: UnagingDemonessCommand, ctx: SeerContext): void {
  if (!validateUnagingDemonessCommand(command)) throw new Error('不老魔女命令无效。');
  if (validateUnagingDemonessAcquisitionCommand(command)) return applyUnagingDemonessAcquisition(s, command, ctx);
  if (validateUnagingDemonessActivityCommand(command)) return applyUnagingDemonessActivity(s, command, ctx);
  if (validateUnagingDemonessEncounterCommand(command)) return applyUnagingDemonessEncounterCommand(s, command, ctx);
  throw new Error('未知不老魔女命令。');
}

export function projectUnagingDemoness(s: SliceState): UnagingDemonessProjection {
  const state = s.unagingDemoness, available = knownChannel(s), promoted = hasUnagingDemonessHistory(s), actions: UnagingDemonessAction[] = [];
  const acting = promoted ? (s.progression.sequence === 2 ? s.calamityDemoness.unagingDemonessActingAtPromotion ?? 100 : s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: UnagingDemonessAcquisitionCommand) => { const reason = unagingDemonessAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-unaging-demoness-guidance', '听取不老魔女成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of UNAGING_DEMONESS_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`unaging-demoness-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-unaging-demoness-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-unaging-demoness-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-unaging-demoness-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-unaging-demoness-supply', '申请下一批独立不老魔女成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${UNAGING_DEMONESS_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶不老魔女魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 绝望魔女消化${s.progression.acting}/100 · ${despairWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions: UnagingDemonessAction[] = available ? [...actions, ...unagingDemonessLifeActions(s), ...unagingDemonessEncounterActions(s)] : [];
  const preferred = allActions.find(action => action.enabled && action.command.type !== 'LEAVE_PREPARATION') ?? allActions.find(action => action.enabled);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '不老魔女·魔女序列3（原镜有限通行G）', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${UNAGING_DEMONESS_FORMULA_STATUS}${UNAGING_DEMONESS_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, preferredActionId: preferred?.id ?? null, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : available ? (allActions.find(action => action.reason)?.reason ?? '当前准备与演练已收束，可继续普通生活。') : '先走完绝望魔女之路。',
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 不老魔女成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为绝望魔女' : '排异，仍为绝望魔女'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? UNAGING_DEMONESS_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? UNAGING_DEMONESS_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting, digestion: promoted ? `绝望魔女消化${state.despairActingAtPromotion}/100留存；不老魔女扮演${acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `绝望魔女需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${despairWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完绝望魔女之路。',
    pollution: s.seer.pollution, risk: available ? UNAGING_DEMONESS_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    appearanceRecord: promoted ? `第${state.promotionWeek}周登记不老魔女年轻外观与长寿特征；原创建年龄${s.character.age}岁、性别${s.character.gender}与原身体履历仍保留，创建年龄不是重新计算的当前生理年龄，也未重置为18岁。不承诺固定寿命或免于死亡。` : '',
    inheritedHistory: available ? [
      `绝望魔女第${s.despair.promotionWeek}周真实晋升；${promoted ? `原消化${state.despairActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '刺客、教唆者、女巫、欢愉魔女、痛苦魔女与绝望魔女的全部原ID、掌握、原瓶、原材料、原物、许可与拒绝记录保留；原女巫身体变化不重复，旧掌握0仍为0。镜界道路有原核，具体两面原镜与全部定量均为本作G。',
      `原女巫身体记录：晋升前性别${s.witch.previousGender ?? '尚未记录'}；当前性别${s.character.gender}，原创建年龄${s.character.age}。本次晋升不改变这些记录。`,
      `原工具库存：粉剂${s.witch.tools.powderHeld}份、小镜${s.witch.tools.mirrorsHeld}面，已耗粉剂${s.witch.tools.powderUsed}份、小镜${s.witch.tools.mirrorsUsed}面；原小镜${s.witch.tools.mirrorPrepared ? '已准备' : '未准备'}，不补回。`,
      `原奥伦：${s.pain.encounter.enemyStatus}；原瓦伦${s.despair.encounter.targetId}：${s.despair.encounter.enemyStatus}，健康${s.despair.encounter.enemyHealth}/100、精神${s.despair.encounter.enemyMind}/100、灵性${s.despair.encounter.enemySpirituality}，原伤势${s.despair.encounter.enemyInjuries.length}处；当前病势${s.despair.encounter.enemyDisease}，既往真实病史与照护记录保留，离场与晋升不治疗或复活。`,
    ] : [],
    life: projectUnagingDemonessLife(s), encounter: projectUnagingDemonessEncounter(s), insideCase: hasUnagingDemonessLock(s),
    environment: available ? '原创G馆舍UD3-GALLERY：46岁原镜主人维瑞娜·肖UD3-VERA与41岁原观察员马库斯·赫尔UD3-MARCUS，后者在B端。START到原镜A4米、原镜A至B外部普通路18米；已知唯一镜内道路INNER_A至INNER_B6米。只有这两面原镜和这条受控道路，不接任意镜面网络。本人、原包、回执与封板须各自真实移动或操作，0行动收束不传送。' : '',
  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateUnagingDemonessState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.unagingDemoness;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'despairActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as UnagingDemonessState, promoted = hasUnagingDemonessHistory(s), firstWeek = s.despair.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + UNAGING_DEMONESS_MIN_DESPAIR_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !UNAGING_DEMONESS_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasUnagingDemonessLifeLock(s) || hasUnagingDemonessEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.despair.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.despairActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS, ...WITCH_ABILITY_IDS, ...PLEASURE_ABILITY_IDS, ...PAIN_ABILITY_IDS, ...DESPAIR_ABILITY_IDS, ...UNAGING_DEMONESS_ABILITY_IDS, ...(s.progression.sequence === 2 ? CALAMITY_DEMONESS_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.despairActingAtPromotion !== null || UNAGING_DEMONESS_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `unaging-demoness-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== UNAGING_DEMONESS_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.despair.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateUnagingDemonessLife(s) && validateUnagingDemonessEncounter(s);
}
export { UNAGING_DEMONESS_ABILITIES } from './content.js';
export { UNAGING_DEMONESS_ABILITY_IDS } from './types.js';
export type * from './types.js';
