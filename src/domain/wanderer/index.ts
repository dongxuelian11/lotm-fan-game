import {PLANESWALKER_ABILITY_IDS} from '../planeswalker/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APPRENTICE_ABILITY_IDS } from '../apprentice/types.js';
import { TRICKMASTER_ABILITY_IDS } from '../trickmaster/types.js';
import { ASTROLOGER_ABILITY_IDS } from '../astrologer/types.js';
import { RECORDER_ABILITY_IDS } from '../recorder/types.js';
import { TRAVELER_ABILITY_IDS } from '../traveler/types.js';
import { SECRETS_SORCERER_ABILITY_IDS } from '../secrets-sorcerer/types.js';
import { hasSecretsSorcererOldPractice } from '../secrets-sorcerer/index.js';
import { hasSecretsSorcererRitualLock } from '../secrets-sorcerer/ritual.js';
import { hasSecretsSorcererLifeLock } from '../secrets-sorcerer/life.js';
import { createWandererLifeState, applyWandererActivity, projectWandererLife, wandererLifeActions, validateWandererLife, validateWandererActivityCommand, hasWandererLifeLock } from './life.js';
import { createWandererEncounterState, applyWandererEncounterCommand, projectWandererEncounter, wandererEncounterActions, validateWandererEncounter, validateWandererEncounterCommand, hasWandererEncounterLock } from './encounter.js';
import { WANDERER_ABILITIES, WANDERER_BOTTLE_IDS, WANDERER_CONSUMPTION_RISK, WANDERER_FORMULA_STATUS, WANDERER_GUIDE, WANDERER_LABOUR_STEPS, WANDERER_LABOUR_TASKS, WANDERER_MIN_SECRETS_SORCERER_WEEKS, WANDERER_POTION_SOURCES, WANDERER_PREPARATIONS, WANDERER_PRICES, WANDERER_SOURCE_STATUS } from './content.js';
import { WANDERER_ABILITY_IDS, WANDERER_PREPARATION_IDS, type WandererAcquisitionCommand, type WandererAction, type WandererBottle, type WandererCommand, type WandererProjection, type WandererState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): WandererBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createWandererState(): WandererState {
  return { guidanceKnown: false, bottles: WANDERER_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, secretsSorcererActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createWandererLifeState(), encounter: createWandererEncounterState() };
}
export const isWanderer = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 3;
const hasWandererHistory=(s:SliceState)=>s.progression.pathwayId==='door'&&[3,2].includes(s.progression.sequence??0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'door' && [4, 3, 2].includes(s.progression.sequence ?? 0) && s.apprentice.discovered && s.secretsSorcerer.guidanceKnown && s.secretsSorcerer.promotionWeek !== null;
export const hasWandererRitualLock = (s: SliceState): boolean => s.wanderer.preparedWeek !== null;
export const hasWandererLock = (s: SliceState): boolean => hasWandererRitualLock(s) || hasWandererLifeLock(s) || hasWandererEncounterLock(s);
const bottleNumber = (b: Pick<WandererBottle, 'id'>) => Number(b.id.slice('wanderer-potion-'.length));
const potionPrice = (b: WandererBottle) => WANDERER_PRICES.potion - (b.labourSteps === WANDERER_LABOUR_STEPS ? WANDERER_PRICES.labourCredit : 0);
const secretsSorcererWeeks = (s: SliceState) => Math.max(0, (s.wanderer.promotionWeek ?? s.week) - (s.secretsSorcerer.promotionWeek ?? s.week));
const exhaustedSupply = (state: WandererState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${WANDERER_GUIDE}介绍的独立漫游者成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶wanderer-potion-${number}；非秘法师或更早原瓶改装。序列3漫游者已核实，完整配方和原著晋升仪式仍未核实，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => WANDERER_PREPARATION_IDS.every(id => s.wanderer.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `秘法师魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.secretsSorcerer.promotionWeek === null || secretsSorcererWeeks(s) < WANDERER_MIN_SECRETS_SORCERER_WEEKS) return `成为秘法师后已过${secretsSorcererWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成目的地核读、防护边界复核与回程规划；购买原瓶不能代做专业准备。';
}
export function validateWandererAcquisitionCommand(v: unknown): v is WandererAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && WANDERER_PREPARATION_IDS.includes(v.taskId as typeof WANDERER_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^wanderer-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isWandererAcquisitionCommand = validateWandererAcquisitionCommand;
export function validateWandererCommand(v: unknown): v is WandererCommand {
  return validateWandererAcquisitionCommand(v) || validateWandererActivityCommand(v) || validateWandererEncounterCommand(v);
}
export function wandererAcquisitionBlock(s: SliceState, command: WandererAcquisitionCommand): string | null {
  if (!validateWandererAcquisitionCommand(command)) return '漫游者准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasSecretsSorcererRitualLock(s) || hasSecretsSorcererLifeLock(s) || hasSecretsSorcererOldPractice(s) ||
      s.secretsSorcerer.life.pocket.linked || s.secretsSorcerer.life.pocket.mode !== 'NONE' ||
      Object.values(s.secretsSorcerer.life.cases).some(v => v.suspended) ||
      hasWandererLifeLock(s) || hasWandererEncounterLock(s)) return '先实际收束旧秘法师仪式、原门、原包及暂时放逐，连同旧旅行实践；原活体封存、归档和原伤势记录保留，旧许可不代替新案同意。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德WN3-WORKSHOP旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为秘法师并保留原指导渠道后，才能了解漫游者之路。';
  if (hasWandererHistory(s)) return '漫游者晋升已经完成，不能重复准备或服药；未服原瓶保留。';
  const state = s.wanderer;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < WANDERER_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的漫游者原瓶。';
    return s.cash < WANDERER_PRICES.preparation ? '当次场地检查需要140便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批漫游者原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的漫游者准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选漫游者独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与140便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= WANDERER_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyWandererAcquisition(s: SliceState, command: WandererAcquisitionCommand, ctx: SeerContext): void {
  const reason = wandererAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.wanderer;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= WANDERER_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取漫游者独立成品与专业准备指导', `花1行动、500便士。${WANDERER_GUIDE}说明原渠道记录。${WANDERER_FORMULA_STATUS}${WANDERER_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = WANDERER_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= WANDERER_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、140便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与140便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(WANDERER_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5500便士，余款900便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('漫游者独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5500便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠坐标全知、免疫、防护资源、人物同意、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批漫游者成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < WANDERER_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`wanderer-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶漫游者原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6400便士或对应五项劳动后900便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.secretsSorcererActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of WANDERER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为漫游者', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；秘法师消化100与全部旧掌握保留，两项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变。学徒至秘法师的全部原瓶、记录库、原门、口袋原物及代价、原活体封存与原框去向、原敌伤势或死亡均保留；不赠记录或物品，不获得真空免疫或全知导航。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '漫游者魔药严重排异' : '漫游者魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为秘法师，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、140便士当次检查。`);
      }
      return;
    }
  }
}
export function applyWandererCommand(s: SliceState, command: WandererCommand, ctx: SeerContext): void {
  if (!validateWandererCommand(command)) throw new Error('漫游者命令无效。');
  if (validateWandererAcquisitionCommand(command)) return applyWandererAcquisition(s, command, ctx);
  if (validateWandererActivityCommand(command)) return applyWandererActivity(s, command, ctx);
  if (validateWandererEncounterCommand(command)) return applyWandererEncounterCommand(s, command, ctx);
  throw new Error('未知漫游者命令。');
}

export function projectWanderer(s: SliceState): WandererProjection {
  const state = s.wanderer, available = knownChannel(s), promoted = hasWandererHistory(s), actions: WandererAction[] = [];
  const add = (id: string, label: string, cost: string, command: WandererAcquisitionCommand) => { const reason = wandererAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-wanderer-guidance', '听取漫游者成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of WANDERER_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`wanderer-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-wanderer-promotion', '实际检查本次服药场地', '1行动 · 140便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-wanderer-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-wanderer-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-wanderer-supply', '申请下一批独立漫游者成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${WANDERER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5500便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶漫游者魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 秘法师消化${s.progression.acting}/100 · ${secretsSorcererWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: '漫游者·门序列3（有限离世往返G）', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${WANDERER_FORMULA_STATUS}${WANDERER_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6400便士或对应五项真实劳动后900便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available ? [...actions, ...wandererLifeActions(s), ...wandererEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 漫游者成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为秘法师' : '排异，仍为秘法师'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? WANDERER_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? WANDERER_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? (s.progression.sequence===2?s.planeswalker.wandererActingAtPromotion??100:s.progression.acting) : 0, digestion: s.progression.sequence===2?'漫游者消化100已保留；原旅程与人物物品记录不变。':promoted ? `秘法师消化${state.secretsSorcererActingAtPromotion}/100留存；漫游者扮演${s.progression.acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `秘法师需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${secretsSorcererWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完秘法师之路。',
    pollution: s.seer.pollution, risk: available ? WANDERER_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `秘法师第${s.secretsSorcerer.promotionWeek}周真实晋升；${promoted ? `原消化${state.secretsSorcererActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '学徒至秘法师的全部原ID、掌握、原瓶、实际记录库与原空间口袋物品及原代价保留；不赠记录或物品，身体性别不改变。漫游者本体离世方向已核，指定端点、防护、供给、返回和全部定量为本作G；旅法师2与星之匙1不开放。',
      `原房间${s.secretsSorcerer.life.room.id}同一门${s.secretsSorcerer.life.room.doorId}：本人仍在${s.secretsSorcerer.life.room.position}，真实进入${s.secretsSorcerer.life.room.entries}次、退出${s.secretsSorcerer.life.room.exits}次；原米拉仍在${s.secretsSorcerer.life.room.companionPosition}，不复制同伴。`,
      `原挎包${s.secretsSorcerer.life.pocket.id}保留${s.secretsSorcerer.life.pocket.capacity}个物位，链接${s.secretsSorcerer.life.pocket.linked ? '仍在' : '已停'}；原封石实际负面已支付${s.secretsSorcerer.life.pocket.buzzCosts}次，不因晋升抹掉。`,
      ...s.secretsSorcerer.life.pocket.items.map(item => `同一原物${item.id}归${item.owner}，当前在${item.location}，存入${item.stores}次、取出${item.takes}次、归还${item.returns}次。`),
      ...s.secretsSorcerer.ritual.targets.filter(target => target.surveyedWeek !== null).map(target => `原目标${target.entityId}：${target.status}，健康${target.body.health}/100、精神${target.body.mind}/100，原伤势${target.body.injuries.length}处。活体封存不是死亡，原死者不复活。`),
      ...s.secretsSorcerer.ritual.cases.map(box => `原封框${box.id}仍在${box.location}、由${box.custody}保管，内部原目标${box.targetId ?? '无'}，剩余原充能${box.charges}；旧4仪式不充作新3仪式。`),
    ] : [],
    life: projectWandererLife(s), encounter: projectWandererEncounter(s), insideCase: hasWandererLock(s),
    environment: available ? '原创G原工作场WN3-WORKSHOP，41岁委托人诺拉·维恩WN3-NORA在START，37岁归档员埃利亚斯·诺特WN3-ELIAS在OFFICE；本人沿4米到PAD、6米到OFFICE或10米干廊实际步行。原远处停泊舱WN3-REMOTE-DOCK已有记录和同一原封包；只有本次原信号、原锚和借用护具核实后才可独立确认有限离世，NPC不随行。原护具、原锚、两片供给各有唯一去向，耗尽不补，普通退出不能将异星身体传回。全部场景与数值为G。' : '',



  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateWandererState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.wanderer;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'secretsSorcererActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as WandererState, promoted = hasWandererHistory(s), firstWeek = s.secretsSorcerer.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + WANDERER_MIN_SECRETS_SORCERER_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !WANDERER_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasWandererLifeLock(s) || hasWandererEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.secretsSorcerer.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.secretsSorcererActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...APPRENTICE_ABILITY_IDS, ...TRICKMASTER_ABILITY_IDS, ...ASTROLOGER_ABILITY_IDS, ...RECORDER_ABILITY_IDS, ...TRAVELER_ABILITY_IDS, ...SECRETS_SORCERER_ABILITY_IDS, ...WANDERER_ABILITY_IDS,...(s.progression.sequence===2?PLANESWALKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.secretsSorcererActingAtPromotion !== null || WANDERER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `wanderer-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== WANDERER_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.secretsSorcerer.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateWandererLife(s) && validateWandererEncounter(s);
}
export { WANDERER_ABILITIES } from './content.js';
export { WANDERER_ABILITY_IDS } from './types.js';
export type * from './types.js';
