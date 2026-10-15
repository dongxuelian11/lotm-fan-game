import { MISFORTUNE_KNIGHT_ABILITY_IDS } from '../misfortune-knight/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SLEEPLESS_ABILITY_IDS } from '../sleepless/types.js';
import { MIDNIGHT_ABILITY_IDS } from '../midnight/types.js';
import { NIGHTMARE_ABILITY_IDS } from '../nightmare/types.js';
import { SOOTHER_ABILITY_IDS } from '../soother/types.js';
import { SPIRIT_WARLOCK_ABILITY_IDS } from '../spirit-warlock/types.js';
import { NIGHTWATCHER_ABILITY_IDS } from '../nightwatcher/types.js';
import { CONCEALMENT_SERVANT_ABILITY_IDS } from '../concealment-servant/types.js';
import { hasNightwatcherRitualLock } from '../nightwatcher/ritual.js';
import { hasNightwatcherLifeLock } from '../nightwatcher/life.js';
import { hasNightwatcherEncounterLock } from '../nightwatcher/encounter.js';
import { createFearBishopLifeState, applyFearBishopActivity, projectFearBishopLife, fearBishopLifeActions, validateFearBishopLife, validateFearBishopActivityCommand, hasFearBishopLifeLock } from './life.js';
import { createFearBishopEncounterState, applyFearBishopEncounterCommand, projectFearBishopEncounter, fearBishopEncounterActions, validateFearBishopEncounter, validateFearBishopEncounterCommand, hasFearBishopEncounterLock } from './encounter.js';
import { FEAR_BISHOP_ABILITIES, FEAR_BISHOP_BOTTLE_IDS, FEAR_BISHOP_CONSUMPTION_RISK, FEAR_BISHOP_FORMULA_STATUS, FEAR_BISHOP_GUIDE, FEAR_BISHOP_LABOUR_STEPS, FEAR_BISHOP_LABOUR_TASKS, FEAR_BISHOP_MIN_NIGHTWATCHER_WEEKS, FEAR_BISHOP_POTION_SOURCES, FEAR_BISHOP_PREPARATIONS, FEAR_BISHOP_PRICES, FEAR_BISHOP_SOURCE_STATUS } from './content.js';
import { FEAR_BISHOP_ABILITY_IDS, FEAR_BISHOP_PREPARATION_IDS, type FearBishopAcquisitionCommand, type FearBishopAction, type FearBishopBottle, type FearBishopCommand, type FearBishopProjection, type FearBishopState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): FearBishopBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createFearBishopState(): FearBishopState {
  return { guidanceKnown: false, bottles: FEAR_BISHOP_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, nightwatcherActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createFearBishopLifeState(), encounter: createFearBishopEncounterState() };
}
export const isFearBishop = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 3;
const hasFearBishopHistory = (s: SliceState) => s.progression.pathwayId === 'darkness' && [3, 2, 1].includes(s.progression.sequence ?? 0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'darkness' && [4, 3, 2, 1].includes(s.progression.sequence ?? 0) && s.sleepless.discovered && s.nightwatcher.guidanceKnown && s.nightwatcher.promotionWeek !== null;
export const hasFearBishopLock = (s: SliceState): boolean => s.fearBishop.preparedWeek !== null || hasFearBishopLifeLock(s) || hasFearBishopEncounterLock(s);
const bottleNumber = (b: Pick<FearBishopBottle, 'id'>) => Number(b.id.slice('fear-bishop-potion-'.length));
const potionPrice = (b: FearBishopBottle) => FEAR_BISHOP_PRICES.potion - (b.labourSteps === FEAR_BISHOP_LABOUR_STEPS ? FEAR_BISHOP_PRICES.labourCredit : 0);
const nightwatcherWeeks = (s: SliceState) => Math.max(0, (s.fearBishop.promotionWeek ?? s.week) - (s.nightwatcher.promotionWeek ?? s.week));
const exhaustedSupply = (state: FearBishopState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${FEAR_BISHOP_GUIDE}的独立恐惧主教成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列3原瓶fear-bishop-potion-${number}；非守夜人或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => FEAR_BISHOP_PREPARATION_IDS.every(id => s.fearBishop.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `守夜人魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.nightwatcher.promotionWeek === null || nightwatcherWeeks(s) < FEAR_BISHOP_MIN_NIGHTWATCHER_WEEKS) return `成为守夜人后已过${nightwatcherWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成残留来源核对、停止信号约定与普通撤离演练；购买原瓶不能代做专业准备。';
}
export function validateFearBishopAcquisitionCommand(v: unknown): v is FearBishopAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && FEAR_BISHOP_PREPARATION_IDS.includes(v.taskId as typeof FEAR_BISHOP_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^fear-bishop-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isFearBishopAcquisitionCommand = validateFearBishopAcquisitionCommand;
export function validateFearBishopCommand(v: unknown): v is FearBishopCommand {
  return validateFearBishopAcquisitionCommand(v) || validateFearBishopActivityCommand(v) || validateFearBishopEncounterCommand(v);
}
export function fearBishopAcquisitionBlock(s: SliceState, command: FearBishopAcquisitionCommand): string | null {
  if (!validateFearBishopAcquisitionCommand(command)) return '恐惧主教准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasNightwatcherRitualLock(s) || hasNightwatcherLifeLock(s) || hasNightwatcherEncounterLock(s) ||
      Object.values(s.nightwatcher.life.cases).some(v => v.status === 'PREPARED') ||
      Object.values(s.spiritWarlock.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      s.spiritWarlock.practice.note !== 'TABLE' || s.spiritWarlock.practice.dreamOpen || s.spiritWarlock.companion.status === 'DEPLOYED' ||
      Object.values(s.soother.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      Object.values(s.nightmare.cases).some(v => v.status === 'PREPARED' || v.status === 'DREAM_RECORDED') ||
      hasFearBishopLifeLock(s) || hasFearBishopEncounterLock(s)) return '先实际收束旧守夜人准备室、梦境与原物现场，并召回已派出的同一个卷叶；不能沿用旧同意或同时占用新场。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原安静准备室旁的独立指导场。';
  if (!knownChannel(s)) return '实际成为守夜人并保留原指导渠道后，才能了解恐惧主教之路。';
  if (hasFearBishopHistory(s)) return '已经真实晋升恐惧主教3，不能重复准备或服药；未服原瓶保留。';
  const state = s.fearBishop;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < FEAR_BISHOP_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的恐惧主教原瓶。';
    return s.cash < FEAR_BISHOP_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批恐惧主教原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的恐惧主教准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选恐惧主教独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= FEAR_BISHOP_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyFearBishopAcquisition(s: SliceState, command: FearBishopAcquisitionCommand, ctx: SeerContext): void {
  const reason = fearBishopAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.fearBishop;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= FEAR_BISHOP_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取恐惧主教独立成品与专业准备指导', `花1行动、500便士。${FEAR_BISHOP_GUIDE}说明原渠道记录。${FEAR_BISHOP_FORMULA_STATUS}${FEAR_BISHOP_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = FEAR_BISHOP_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= FEAR_BISHOP_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(FEAR_BISHOP_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('恐惧主教独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠灵体、毁弃许可、人物同意、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批恐惧主教成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < FEAR_BISHOP_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`fear-bishop-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶恐惧主教原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.nightwatcherActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of FEAR_BISHOP_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为恐惧主教', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；守夜人消化100与全部旧掌握保留，两项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变；原卷叶取得、封存或释放状态、原纸与原车保留，原布拉姆已有伤亡和原棍去向不变；晋升不创建新灵。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '恐惧主教魔药严重排异' : '恐惧主教魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为守夜人，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applyFearBishopCommand(s: SliceState, command: FearBishopCommand, ctx: SeerContext): void {
  if (!validateFearBishopCommand(command)) throw new Error('恐惧主教命令无效。');
  if (validateFearBishopAcquisitionCommand(command)) return applyFearBishopAcquisition(s, command, ctx);
  if (validateFearBishopActivityCommand(command)) return applyFearBishopActivity(s, command, ctx);
  if (validateFearBishopEncounterCommand(command)) return applyFearBishopEncounterCommand(s, command, ctx);
  throw new Error('未知恐惧主教命令。');
}

export function projectFearBishop(s: SliceState): FearBishopProjection {
  const state = s.fearBishop, available = knownChannel(s), promoted = hasFearBishopHistory(s), actions: FearBishopAction[] = [];
  const acting = promoted ? ((s.progression.sequence === 2||s.progression.sequence===1) ? s.concealmentServant.fearBishopActingAtPromotion ?? 0 : s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: FearBishopAcquisitionCommand) => { const reason = fearBishopAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-fear-bishop-guidance', '听取恐惧主教成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of FEAR_BISHOP_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`fear-bishop-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-fear-bishop-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-fear-bishop-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-fear-bishop-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-fear-bishop-supply', '申请下一批独立恐惧主教成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${FEAR_BISHOP_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶恐惧主教魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 守夜人消化${s.progression.acting}/100 · ${nightwatcherWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '恐惧主教 · 序列3' : '恐惧主教之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${FEAR_BISHOP_FORMULA_STATUS}${FEAR_BISHOP_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或对应五项真实劳动后800便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available && s.progression.sequence!==1 ? [...actions, ...fearBishopLifeActions(s), ...fearBishopEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 恐惧主教成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为守夜人' : '排异，仍为守夜人'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? FEAR_BISHOP_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? FEAR_BISHOP_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting, digestion: promoted ? `守夜人消化${state.nightwatcherActingAtPromotion}/100留存；恐惧主教扮演${acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `守夜人需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${nightwatcherWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完守夜人之路。',
    pollution: s.seer.pollution, risk: available ? FEAR_BISHOP_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `守夜人第${s.nightwatcher.promotionWeek}周真实晋升；${promoted ? `原消化${state.nightwatcherActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`,
      '不眠者至守夜人的全部原ID与掌握、原瓶、旧仪式与原实践保留；本次不改变身体性别，不把恐惧女妖的物种能力写入职业。',
      `唯一原灵${s.spiritWarlock.companion.source}：当前${s.spiritWarlock.companion.status}，第${s.spiritWarlock.companion.acquiredWeek ?? '未取得'}周取得；原派出${s.spiritWarlock.companion.deployments}次、实际召回${s.spiritWarlock.companion.recalls}次、释放${s.spiritWarlock.companion.releases}次，最近邀请周${s.spiritWarlock.companion.invitedWeek ?? '无'}。不会免费重邀、复活或赠送新灵。`,
      `原灵巫纸SW5-NOTE-1仍在${s.spiritWarlock.practice.note}；原守夜人纸${s.nightwatcher.life.practice.note.id}仍在${s.nightwatcher.life.practice.note.location}，原空车${s.nightwatcher.life.cart.id}仍在${s.nightwatcher.life.cart.location}，原轮${s.nightwatcher.life.cart.wheel}。`,
      ...(s.nightwatcher.encounter.approachWeek === null ? [] : [`原布拉姆NW4-BRAM：健康${s.nightwatcher.encounter.enemy.health}/100、精神${s.nightwatcher.encounter.enemy.mind}/100；${s.nightwatcher.encounter.enemy.status === 'DEAD' ? '已死亡，不会复活' : s.nightwatcher.encounter.enemy.status === 'SURRENDERED' ? '已投降，原伤势保留' : '仍为独立原人'}。原棍${s.nightwatcher.encounter.enemy.weaponId}${s.nightwatcher.encounter.enemy.weaponLocation === 'HAND' ? '仍在他手中' : '仍在原院地面'}，不因新晋升复原。`]),
      ...(['mason', 'ilva'] as const).map(key => s.nightwatcher.life.people[key]).map(p => `原${p.name}${p.id}：${p.alive ? '仍活着' : '已经死亡'}、${p.asleep ? '仍在原梦境中' : '当前清醒'}，仍在${p.location}；旧身体、同意与经历不复制。`),
      `原专业人员${s.nightwatcher.ritual.expert.id}${s.nightwatcher.ritual.expert.alive ? '仍活着' : '已经死亡'}；序列4原封装包及已消耗记录保留，不改装为序列3准备。`,
    ] : [],
    life: projectFearBishopLife(s), encounter: projectFearBishopEncounter(s), insideCase: hasFearBishopLock(s),
    environment: available ? '贝克兰德原安静准备室NW4-HALL旁独立库房与隔离试验台，46岁原保管员FB3-EDITH伊迪丝持有自己的原残留凝片、容器与原灯。原正廊8米、普通侧路12米，实际出口始终开放。34岁新成年志愿者FB3-TOMAS托马斯只在本人当次有限同意后参与，停止后仍须真实醒来与确认。场景、物件、距离与数值均为原创G，不是隐秘领域或现实治疗。' : '',
  };
}

/** Finite data and chronology checks. Earlier history remains owned by its original modules. */
export function validateFearBishopState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.fearBishop;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'nightwatcherActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as FearBishopState, promoted = hasFearBishopHistory(s), firstWeek = s.nightwatcher.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + FEAR_BISHOP_MIN_NIGHTWATCHER_WEEKS;
  if (s.progression.pathwayId === 'darkness' && (s.progression.sequence === 2||s.progression.sequence===1) && s.concealmentServant.fearBishopActingAtPromotion !== 100) return false;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !FEAR_BISHOP_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasFearBishopLifeLock(s) || hasFearBishopEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.nightwatcher.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.nightwatcherActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?MISFORTUNE_KNIGHT_ABILITY_IDS:[]),...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS, ...NIGHTMARE_ABILITY_IDS, ...SOOTHER_ABILITY_IDS, ...SPIRIT_WARLOCK_ABILITY_IDS, ...NIGHTWATCHER_ABILITY_IDS, ...FEAR_BISHOP_ABILITY_IDS, ...((s.progression.sequence === 2||s.progression.sequence===1) ? CONCEALMENT_SERVANT_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.nightwatcherActingAtPromotion !== null || FEAR_BISHOP_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `fear-bishop-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== FEAR_BISHOP_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.nightwatcher.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateFearBishopLife(s) && validateFearBishopEncounter(s);
}
export { FEAR_BISHOP_ABILITIES } from './content.js';
export { FEAR_BISHOP_ABILITY_IDS } from './types.js';
export type * from './types.js';
