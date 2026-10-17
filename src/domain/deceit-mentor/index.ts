import { FATE_TROJAN_ABILITY_IDS } from '../fate-trojan/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { MARAUDER_ABILITY_IDS } from '../marauder/types.js';
import { SWINDLER_ABILITY_IDS } from '../swindler/types.js';
import { CRYPTOLOGIST_ABILITY_IDS } from '../cryptologist/types.js';
import { FIRE_THIEF_ABILITY_IDS } from '../fire-thief/types.js';
import { DREAM_STEALER_ABILITY_IDS } from '../dream-stealer/types.js';
import { PARASITE_ABILITY_IDS } from '../parasite/types.js';
import { hasDreamStealerOpenPractice } from '../dream-stealer/encounter.js';
import { hasParasiteEncounterLock } from '../parasite/encounter.js';
import { hasParasiteLifeLock } from '../parasite/life.js';
import { createDeceitMentorLifeState, applyDeceitMentorActivity, projectDeceitMentorLife, deceitMentorLifeActions, validateDeceitMentorLife, validateDeceitMentorActivityCommand, hasDeceitMentorLifeLock } from './life.js';
import { createDeceitMentorEncounterState, applyDeceitMentorEncounterCommand, projectDeceitMentorEncounter, deceitMentorEncounterActions, validateDeceitMentorEncounter, validateDeceitMentorEncounterCommand, hasDeceitMentorEncounterLock } from './encounter.js';
import { DECEIT_MENTOR_ABILITIES, DECEIT_MENTOR_BOTTLE_IDS, DECEIT_MENTOR_CONSUMPTION_RISK, DECEIT_MENTOR_FORMULA_STATUS, DECEIT_MENTOR_GUIDE, DECEIT_MENTOR_LABOUR_STEPS, DECEIT_MENTOR_LABOUR_TASKS, DECEIT_MENTOR_MIN_PARASITE_WEEKS, DECEIT_MENTOR_POTION_SOURCES, DECEIT_MENTOR_PREPARATIONS, DECEIT_MENTOR_PRICES, DECEIT_MENTOR_SOURCE_STATUS } from './content.js';
import { DECEIT_MENTOR_ABILITY_IDS, DECEIT_MENTOR_PREPARATION_IDS, type DeceitMentorAcquisitionCommand, type DeceitMentorAction, type DeceitMentorBottle, type DeceitMentorCommand, type DeceitMentorProjection, type DeceitMentorState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): DeceitMentorBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createDeceitMentorState(): DeceitMentorState {
  return { guidanceKnown: false, bottles: DECEIT_MENTOR_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, parasiteActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createDeceitMentorLifeState(), encounter: createDeceitMentorEncounterState() };
}
export const isDeceitMentor = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 3;
const hasDeceitMentorHistory = (s: SliceState) => s.progression.pathwayId === 'error' && [3, 2].includes(s.progression.sequence ?? 0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'error' && [4, 3, 2].includes(s.progression.sequence ?? 0) && s.marauder.discovered && s.marauder.guidanceKnown && s.swindler.guidanceKnown && s.cryptologist.guidanceKnown && s.fireThief.guidanceKnown && s.dreamStealer.guidanceKnown && s.parasite.guidanceKnown && s.parasite.promotionWeek !== null;
export const hasDeceitMentorOldPractice = (s: SliceState): boolean => hasDreamStealerOpenPractice(s) || hasParasiteLifeLock(s) || hasParasiteEncounterLock(s) || [s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer].some(stage => Object.values(stage.cases).some(value => value.status === 'PREPARED')) || Object.values(s.parasite.life.cases).some(value => value.status === 'PREPARED');
export const hasDeceitMentorRitualLock = (s: SliceState): boolean => s.deceitMentor.preparedWeek !== null;
export const hasDeceitMentorLock = (s: SliceState): boolean => hasDeceitMentorRitualLock(s) || hasDeceitMentorLifeLock(s) || hasDeceitMentorEncounterLock(s);
const bottleNumber = (b: Pick<DeceitMentorBottle, 'id'>) => Number(b.id.slice('deceit-mentor-potion-'.length));
const potionPrice = (b: DeceitMentorBottle) => DECEIT_MENTOR_PRICES.potion - (b.labourSteps === DECEIT_MENTOR_LABOUR_STEPS ? DECEIT_MENTOR_PRICES.labourCredit : 0);
const parasiteWeeks = (s: SliceState) => Math.max(0, (s.deceitMentor.promotionWeek ?? s.week) - (s.parasite.promotionWeek ?? s.week));
const exhaustedSupply = (state: DeceitMentorState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${DECEIT_MENTOR_GUIDE}介绍的独立欺瞒导师成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶deceit-mentor-potion-${number}；非寄生者或更早原瓶改装。序列3欺瞒导师已核实，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => DECEIT_MENTOR_PREPARATION_IDS.every(id => s.deceitMentor.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `寄生者魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.parasite.promotionWeek === null || parasiteWeeks(s) < DECEIT_MENTOR_MIN_PARASITE_WEEKS) return `成为寄生者后已过${parasiteWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成来源核对、效力边界确认与纠正返还规划；购买原瓶不能代做专业准备。';
}
export function validateDeceitMentorAcquisitionCommand(v: unknown): v is DeceitMentorAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && DECEIT_MENTOR_PREPARATION_IDS.includes(v.taskId as typeof DECEIT_MENTOR_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^deceit-mentor-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isDeceitMentorAcquisitionCommand = validateDeceitMentorAcquisitionCommand;
export function validateDeceitMentorCommand(v: unknown): v is DeceitMentorCommand {
  return validateDeceitMentorAcquisitionCommand(v) || validateDeceitMentorActivityCommand(v) || validateDeceitMentorEncounterCommand(v);
}
export function deceitMentorAcquisitionBlock(s: SliceState, command: DeceitMentorAcquisitionCommand): string | null {
  if (!validateDeceitMentorAcquisitionCommand(command)) return '欺瞒导师准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasDeceitMentorOldPractice(s) || hasDeceitMentorLifeLock(s) || hasDeceitMentorEncounterLock(s)) return '先实际结束旧寄生、原念头与暂窃窗口，归还原物并收束旧准备和当前实践；旧人物、伤势、能力记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德DM3-WORKSHOP旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为寄生者并保留原指导渠道后，才能了解欺瞒导师之路。';
  if (hasDeceitMentorHistory(s)) return '已经真实晋升欺瞒导师3，不能重复准备或服药；未服原瓶保留。';
  const state = s.deceitMentor;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < DECEIT_MENTOR_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的欺瞒导师原瓶。';
    return s.cash < DECEIT_MENTOR_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批欺瞒导师原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的欺瞒导师准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选欺瞒导师独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= DECEIT_MENTOR_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyDeceitMentorAcquisition(s: SliceState, command: DeceitMentorAcquisitionCommand, ctx: SeerContext): void {
  const reason = deceitMentorAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.deceitMentor;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= DECEIT_MENTOR_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取欺瞒导师独立成品与专业准备指导', `花1行动、500便士。${DECEIT_MENTOR_GUIDE}说明原渠道记录。${DECEIT_MENTOR_FORMULA_STATUS}${DECEIT_MENTOR_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = DECEIT_MENTOR_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= DECEIT_MENTOR_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(DECEIT_MENTOR_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('欺瞒导师独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠天使分身、偷取能力、人物同意、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批欺瞒导师成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < DECEIT_MENTOR_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`deceit-mentor-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶欺瞒导师原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.parasiteActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of DECEIT_MENTOR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为欺瞒导师', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；寄生者消化100与全部旧掌握保留，两项新掌握从0开始。灵性上限120，当前不补满；身体性别不改变。偷盗者至寄生者的全部原瓶、劳务、原物、原宿主自主权、原念头、暂窃窗口与原敌伤势或死亡均保留；不赠偷取能力或物品，不获得天使分身或命运木马能力。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '欺瞒导师魔药严重排异' : '欺瞒导师魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为寄生者，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyDeceitMentorCommand(s: SliceState, command: DeceitMentorCommand, ctx: SeerContext): void {
  if (!validateDeceitMentorCommand(command)) throw new Error('欺瞒导师命令无效。');
  if (validateDeceitMentorAcquisitionCommand(command)) return applyDeceitMentorAcquisition(s, command, ctx);
  if (validateDeceitMentorActivityCommand(command)) return applyDeceitMentorActivity(s, command, ctx);
  if (validateDeceitMentorEncounterCommand(command)) return applyDeceitMentorEncounterCommand(s, command, ctx);
  throw new Error('未知欺瞒导师命令。');
}

export function projectDeceitMentor(s: SliceState): DeceitMentorProjection {
  const state = s.deceitMentor, available = knownChannel(s), promoted = hasDeceitMentorHistory(s), actions: DeceitMentorAction[] = [];
  const acting = promoted ? (s.progression.sequence === 2 ? s.fateTrojan.deceitMentorActingAtPromotion ?? 100 : s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: DeceitMentorAcquisitionCommand) => { const reason = deceitMentorAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-deceit-mentor-guidance', '听取欺瞒导师成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of DECEIT_MENTOR_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`deceit-mentor-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-deceit-mentor-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-deceit-mentor-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-deceit-mentor-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-deceit-mentor-supply', '申请下一批独立欺瞒导师成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${DECEIT_MENTOR_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶欺瞒导师魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 寄生者消化${s.progression.acting}/100 · ${parasiteWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '欺瞒导师·错误序列3（有限规则欺瞒G）', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${DECEIT_MENTOR_FORMULA_STATUS}${DECEIT_MENTOR_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available ? [...actions, ...deceitMentorLifeActions(s), ...deceitMentorEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 欺瞒导师成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为寄生者' : '排异，仍为寄生者'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? DECEIT_MENTOR_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? DECEIT_MENTOR_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting, digestion: promoted ? `寄生者消化${state.parasiteActingAtPromotion}/100留存；欺瞒导师扮演${acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `寄生者需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${parasiteWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完寄生者之路。',
    pollution: s.seer.pollution, risk: available ? DECEIT_MENTOR_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `寄生者第${s.parasite.promotionWeek}周真实晋升；${promoted ? `原消化${state.parasiteActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '偷盗者、诈骗师、解密学者、盗火人、窃梦家和寄生者的全部原ID、掌握、原瓶、真实存货、窃取窗口与原代价保留；不赠偷取能力或物品，身体性别不改变。自然规律欺瞒和诈骗深化方向已核，具体有限场景与全部定量为本作G；不下放命运木马2、换命、主辅颠倒或源堡复活骗局。',
      `原宿主${s.parasite.life.host.id}仍为AWARE、由${s.parasite.life.host.control}决定身体，处于${s.parasite.life.host.location}；玩家原身体${s.parasite.life.player.presence}，位置${s.parasite.life.player.location}，实际进入${s.parasite.life.player.entries}次、分离${s.parasite.life.player.exits}次。`,
      `原念头目标${s.parasite.life.thought.targetId}当前${s.parasite.life.thought.targetPose}，暂停${s.parasite.life.thought.targetPaused ? '仍在' : '已恢复'}；原椅${s.parasite.life.thought.chairId}不复制，原坐下念头${s.parasite.life.thought.pending}，最近释放${s.parasite.life.thought.lastRelease}，执行${s.parasite.life.thought.executions}次、恢复${s.parasite.life.thought.recoveries}次。`,
      `原拉尔夫${s.parasite.encounter.targetId}：${s.parasite.encounter.enemyStatus}，健康${s.parasite.encounter.enemyHealth}/100、精神${s.parasite.encounter.enemyMind}/100，灵性余${s.parasite.encounter.enemySpirituality}、原伤势${s.parasite.encounter.enemyInjuries.length}处；唯一原棍${s.parasite.encounter.weapon.id}仍在${s.parasite.encounter.weapon.location}，主人${s.parasite.encounter.weapon.owner}，原庭院不重置。`,
      `盗火人原样本与原暂借窗口完整保留；寄生者原暂窃记录${s.parasite.encounter.borrowed.length}条，不因晋升生成新能力。`,
      ...s.parasite.encounter.borrowed.map(power => `原暂窃${power.id}源于${power.sourceId}，${power.abilityId}当前${power.status}，获得${power.acquiredSeconds}秒、原到期${power.expiresSeconds}秒、关闭${power.closedSeconds ?? '尚未'}，原主恢复${power.restoredToSource ? '是' : '否'}。`),
    ] : [],
    life: projectDeceitMentorLife(s), encounter: projectDeceitMentorEncounter(s), insideCase: hasDeceitMentorLock(s),
    environment: available ? '原创G原工坊DM3-WORKSHOP：43岁原物主人伊迪丝·芬DM3-EDITH在START接待桌，39岁记录者巴兹尔·摩尔DM3-BASIL在BENCH试验台。START→BENCH6米、BENCH→CABINET4米、START→CABINET10米，均为普通干廊，原门OPEN。唯一原灯、纸签、示意卡各有真实位置、许可和返还；有限欺瞒不改原燃料、物权、记忆或世界库存，普通退出不能远距收物。全部场景与数值为G。' : '',

  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateDeceitMentorState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.deceitMentor;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'parasiteActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as DeceitMentorState, promoted = hasDeceitMentorHistory(s), firstWeek = s.parasite.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + DECEIT_MENTOR_MIN_PARASITE_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !DECEIT_MENTOR_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasDeceitMentorLifeLock(s) || hasDeceitMentorEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.parasite.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.parasiteActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (s.progression.sequence === 2 && s.fateTrojan.deceitMentorActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...MARAUDER_ABILITY_IDS, ...SWINDLER_ABILITY_IDS, ...CRYPTOLOGIST_ABILITY_IDS, ...FIRE_THIEF_ABILITY_IDS, ...DREAM_STEALER_ABILITY_IDS, ...PARASITE_ABILITY_IDS, ...DECEIT_MENTOR_ABILITY_IDS, ...(s.progression.sequence === 2 ? FATE_TROJAN_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.parasiteActingAtPromotion !== null || DECEIT_MENTOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `deceit-mentor-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== DECEIT_MENTOR_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.parasite.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateDeceitMentorLife(s) && validateDeceitMentorEncounter(s);
}
export { DECEIT_MENTOR_ABILITIES } from './content.js';
export { DECEIT_MENTOR_ABILITY_IDS } from './types.js';
export type * from './types.js';
