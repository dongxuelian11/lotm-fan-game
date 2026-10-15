import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CRIMINAL_ABILITY_IDS } from '../criminal/types.js';
import { UNWINGED_ABILITY_IDS } from '../unwinged/types.js';
import { SERIAL_KILLER_ABILITY_IDS } from '../serial-killer/types.js';
import { DEMON_ABILITY_IDS } from '../demon/types.js';
import { DESIRE_APOSTLE_ABILITY_IDS } from '../desire-apostle/types.js';
import { DEVIL_ABILITY_IDS } from '../devil/types.js';
import { criminalInside } from '../criminal/life.js';
import { unwingedInside } from '../unwinged/life.js';
import { serialKillerInside } from '../serial-killer/life.js';
import { demonInside } from '../demon/life.js';
import { desireApostleInside } from '../desire-apostle/life.js';
import { hasDevilLifeLock } from '../devil/life.js';
import { hasDevilEncounterLock } from '../devil/encounter.js';
import { createBlathererLifeState, applyBlathererActivity, projectBlathererLife, blathererLifeActions, validateBlathererLife, validateBlathererActivityCommand, hasBlathererLifeLock } from './life.js';
import { createBlathererEncounterState, applyBlathererEncounterCommand, projectBlathererEncounter, blathererEncounterActions, validateBlathererEncounter, validateBlathererEncounterCommand, hasBlathererEncounterLock } from './encounter.js';
import { BLATHERER_ABILITIES, BLATHERER_BOTTLE_IDS, BLATHERER_CONSUMPTION_RISK, BLATHERER_FORMULA_STATUS, BLATHERER_GUIDE, BLATHERER_LABOUR_STEPS, BLATHERER_LABOUR_TASKS, BLATHERER_MIN_DEVIL_WEEKS, BLATHERER_POTION_SOURCES, BLATHERER_PREPARATIONS, BLATHERER_PRICES, BLATHERER_SOURCE_STATUS } from './content.js';
import { BLATHERER_ABILITY_IDS, BLATHERER_PREPARATION_IDS, type BlathererAcquisitionCommand, type BlathererAction, type BlathererBottle, type BlathererCommand, type BlathererProjection, type BlathererState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): BlathererBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createBlathererState(): BlathererState {
  return { guidanceKnown: false, bottles: BLATHERER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, devilActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createBlathererLifeState(), encounter: createBlathererEncounterState() };
}
export const isBlatherer = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 3;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'abyss' && [4, 3].includes(s.progression.sequence ?? 0)
  && s.criminal.discovered && s.criminal.guidanceKnown && s.unwinged.guidanceKnown && s.serialKiller.guidanceKnown
  && s.demon.guidanceKnown && s.desireApostle.guidanceKnown && s.devil.guidanceKnown && s.devil.promotionWeek !== null;
export const hasBlathererOldPractice = (s: SliceState): boolean => criminalInside(s) || unwingedInside(s) || serialKillerInside(s)
  || demonInside(s) || desireApostleInside(s) || hasDevilLifeLock(s) || hasDevilEncounterLock(s)
  || s.demon.practice.body !== 'NORMAL' || s.demon.practice.flame === 'LIT'
  || s.desireApostle.practice.emotion === 'STRONG' || s.devil.life.stage.consented || s.devil.life.stage.pauseSeconds > 0 || s.devil.life.stage.emotion === 'STRONG'
  || [s.criminal, s.unwinged, s.serialKiller, s.demon, s.desireApostle].some(stage => Object.values(stage.cases).some(value => value.status === 'PREPARED'))
  || Object.values(s.devil.life.cases).some(value => value.status === 'PREPARED')
  || s.demon.encounter.status === 'FIGHTING' || s.desireApostle.encounter.status === 'FIGHTING'
  || s.desireApostle.encounter.seedPlanted || s.desireApostle.encounter.staggerReady
  || s.devil.encounter.seedPlanted || s.devil.encounter.staggerReady;
export const hasBlathererRitualLock = (s: SliceState): boolean => s.blatherer.preparedWeek !== null;
export const hasBlathererLock = (s: SliceState): boolean => hasBlathererRitualLock(s) || hasBlathererLifeLock(s) || hasBlathererEncounterLock(s);
const bottleNumber = (b: Pick<BlathererBottle, 'id'>) => Number(b.id.slice('blatherer-potion-'.length));
const potionPrice = (b: BlathererBottle) => BLATHERER_PRICES.potion - (b.labourSteps === BLATHERER_LABOUR_STEPS ? BLATHERER_PRICES.labourCredit : 0);
const devilWeeks = (s: SliceState) => Math.max(0, (s.blatherer.promotionWeek ?? s.week) - (s.devil.promotionWeek ?? s.week));
const exhaustedSupply = (state: BlathererState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${BLATHERER_GUIDE}介绍的独立呓语者成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶blatherer-potion-${number}；非魔鬼或更早原瓶改装。序列3呓语者名称与序列衔接仅有人物推断，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => BLATHERER_PREPARATION_IDS.every(id => s.blatherer.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `魔鬼魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.devil.promotionWeek === null || devilWeeks(s) < BLATHERER_MIN_DEVIL_WEEKS) return `成为魔鬼后已过${devilWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成既有深渊记录核对、有限低语边界核验与普通退出标记；购买原瓶不能代做专业准备。';
}
export function validateBlathererAcquisitionCommand(v: unknown): v is BlathererAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && BLATHERER_PREPARATION_IDS.includes(v.taskId as typeof BLATHERER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^blatherer-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isBlathererAcquisitionCommand = validateBlathererAcquisitionCommand;
export function validateBlathererCommand(v: unknown): v is BlathererCommand {
  return validateBlathererAcquisitionCommand(v) || validateBlathererActivityCommand(v) || validateBlathererEncounterCommand(v);
}
export function blathererAcquisitionBlock(s: SliceState, command: BlathererAcquisitionCommand): string | null {
  if (!validateBlathererAcquisitionCommand(command)) return '呓语者准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasBlathererOldPractice(s) || hasBlathererLifeLock(s) || hasBlathererEncounterLock(s)) return '先实际结束旧接触、演练、恶魔身体与火焰和原种子效果，归还原物并收束旧准备和当前实践；旧人物、伤势、良知变化与能力记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原旧货库旁BL3-QUIET-ROOM独立安静房间。';
  if (!knownChannel(s)) return '实际成为魔鬼并保留原指导渠道后，才能了解呓语者之路。';
  if (isBlatherer(s)) return '已经真实晋升呓语者3，不能重复准备或服药；未服原瓶保留。';
  const state = s.blatherer;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < BLATHERER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的呓语者原瓶。';
    return s.cash < BLATHERER_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批呓语者原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的呓语者准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选呓语者独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= BLATHERER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyBlathererAcquisition(s: SliceState, command: BlathererAcquisitionCommand, ctx: SeerContext): void {
  const reason = blathererAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.blatherer;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= BLATHERER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取呓语者独立成品与专业准备指导', `花1行动、500便士。${BLATHERER_GUIDE}说明原渠道记录。${BLATHERER_FORMULA_STATUS}${BLATHERER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = BLATHERER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}${task.id === 'REVIEW_RECORDS' ? `实际核对自己的原魔鬼晋升周${s.devil.promotionWeek}、仍由本人持有的原节目、已归还的原邀请与本人既往欲望试验及拒绝记录；这些已有记录未被修改。` : ''}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= BLATHERER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(BLATHERER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('呓语者独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠人物同意、声音效果、血晶、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批呓语者成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < BLATHERER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`blatherer-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶呓语者原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.devilActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of BLATHERER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为呓语者', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；魔鬼消化100与全部旧掌握保留，唯一新能力abyss.s3.limited-murmur掌握从0开始。灵性上限120，当前不补满；全部原瓶、劳务、原人物、原物与旧种子历史保留。原奥里克的伤势、投降或死亡不重开，旧恶魔紧绷、良知变化与恶欲风险不重置；不赠血晶、祭坛、免费召唤、天使腐化或全域疯狂。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '呓语者魔药严重排异' : '呓语者魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为魔鬼，旧消化、掌握、原人物历史与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyBlathererCommand(s: SliceState, command: BlathererCommand, ctx: SeerContext): void {
  if (!validateBlathererCommand(command)) throw new Error('呓语者命令无效。');
  if (validateBlathererAcquisitionCommand(command)) return applyBlathererAcquisition(s, command, ctx);
  if (validateBlathererActivityCommand(command)) return applyBlathererActivity(s, command, ctx);
  if (validateBlathererEncounterCommand(command)) return applyBlathererEncounterCommand(s, command, ctx);
  throw new Error('未知呓语者命令。');
}

export function projectBlatherer(s: SliceState): BlathererProjection {
  const state = s.blatherer, available = knownChannel(s), promoted = isBlatherer(s), actions: BlathererAction[] = [];
  const add = (id: string, label: string, cost: string, command: BlathererAcquisitionCommand) => { const reason = blathererAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-blatherer-guidance', '听取呓语者成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of BLATHERER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`blatherer-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-blatherer-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-blatherer-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-blatherer-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-blatherer-supply', '申请下一批独立呓语者成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${BLATHERER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶呓语者魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 魔鬼消化${s.progression.acting}/100 · ${devilWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const allActions: BlathererAction[] = available ? [...actions, ...blathererLifeActions(s), ...blathererEncounterActions(s)] : [];
  const preferred = allActions.find(action => action.enabled && action.command.type !== 'LEAVE_PREPARATION') ?? allActions.find(action => action.enabled);
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '呓语者·深渊候选序列3（人物推断／有限低语G）', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${BLATHERER_FORMULA_STATUS}${BLATHERER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: allActions, preferredActionId: preferred?.id ?? null, nextStep: preferred ? `下一步：${preferred.label}。${preferred.cost}。` : available ? (allActions.find(action => action.reason)?.reason ?? '当前准备与演练已收束，可继续普通生活。') : '先走完魔鬼之路。',
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 呓语者成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为魔鬼' : '排异，仍为魔鬼'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? BLATHERER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? BLATHERER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0, digestion: promoted ? `魔鬼消化${state.devilActingAtPromotion}/100留存；呓语者扮演${s.progression.acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功；和平100不保证原著安全消化，不恢复原有良知或清除紧绷。` : available ? `魔鬼需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${devilWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完魔鬼之路。',
    pollution: s.seer.pollution, risk: available ? BLATHERER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    inheritedTools: available ? `原节目${s.devil.life.stage.programId}仍由${s.devil.life.stage.programHolder}持有；原邀请${s.devil.life.invitation.id}由${s.devil.life.invitation.holder}保管；原记录纸${s.devil.life.account.id}由${s.devil.life.account.holder}保管。旧账册与旧记录纸保持原归属，新BL3-CARD、BL3-BELL、BL3-NOTE各为独立原物，不复制、传送或借晋升发放。` : '',
    inheritedHistory: available ? [
      `魔鬼第${s.devil.promotionWeek}周真实晋升；${promoted ? `原消化${state.devilActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '罪犯、折翼天使、连环杀手、恶魔、欲望使徒与魔鬼的全部原ID、掌握、原瓶、劳务、原人物、原物、许可与拒绝记录保留，旧掌握0仍为0。原人原来的种子不转移给新听者；新低语不能自动写入同意或事实。',
      `原恶魔紧绷${s.demon.strain}/3；原身体${s.demon.practice.body}、原火焰${s.demon.practice.flame}。原折翼天使良知变化${s.unwinged.conscienceLost ? '保留' : '尚未发生'}，晋升、和平实践与停止低语不免费消除恶欲、良知变化或历史代价。`,
      `原米蕾尔${s.devil.life.stage.subjectId}保有自己的${s.devil.life.stage.programId}；原蕾娜${s.devil.life.invitation.subjectId}${s.devil.life.invitation.declined ? '已经拒绝，拒绝仍保留' : '尚未作出该次拒绝'}；原欲望试验与本人的选择不会被新的诺拉替代。`,
      `原奥里克${s.devil.encounter.targetId}：${s.devil.encounter.enemyStatus}，健康${s.devil.encounter.enemyHealth}/100、精神${s.devil.encounter.enemyMind}/100、灵性${s.devil.encounter.enemySpirituality}，原伤势${s.devil.encounter.enemyInjuries.length}处；晋升和离场不治疗、重开或复活旧对手。`,
    ] : [],
    life: projectBlathererLife(s), encounter: projectBlathererEncounter(s), insideCase: hasBlathererLock(s),
    environment: available ? '原创G安静房间BL3-QUIET-ROOM的三处有限原场：入口START、原桌A距入口4米、声学凹室B距入口8米。本人、原罗安与46岁独立成年诺拉·温特BL3-NORA按各自真实普通路线行动；原卡BL3-CARD、原铃BL3-BELL与原笔记BL3-NOTE均各有实体与位置。低语仅6米当前听者，2秒输入、成功后30秒有限可见迟疑均为G；停止输入不会瞬间消除残留，须另行实际等待。诺拉可撤回，旁人在范围内须先实际离开；普通核实与原物借还不由能力代办，0行动收束仍实际走路，不远程发声或传送。' : '',
  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateBlathererState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.blatherer;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'devilActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as BlathererState, promoted = isBlatherer(s), firstWeek = s.devil.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + BLATHERER_MIN_DEVIL_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !BLATHERER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasBlathererOldPractice(s) || hasBlathererLifeLock(s) || hasBlathererEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.devil.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.devilActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS, ...DEMON_ABILITY_IDS, ...DESIRE_APOSTLE_ABILITY_IDS, ...DEVIL_ABILITY_IDS, ...BLATHERER_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.devilActingAtPromotion !== null || BLATHERER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `blatherer-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== BLATHERER_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.devil.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateBlathererLife(s) && validateBlathererEncounter(s);
}
export { BLATHERER_ABILITIES } from './content.js';
export { BLATHERER_ABILITY_IDS } from './types.js';
export type * from './types.js';
