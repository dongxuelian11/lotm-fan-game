import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SLEEPLESS_ABILITY_IDS } from '../sleepless/types.js';
import { MIDNIGHT_ABILITY_IDS } from '../midnight/types.js';
import { NIGHTMARE_ABILITY_IDS } from '../nightmare/types.js';
import { SOOTHER_ABILITY_IDS } from '../soother/types.js';
import { SPIRIT_WARLOCK_ABILITY_IDS } from '../spirit-warlock/types.js';
import { NIGHTWATCHER_ABILITY_IDS } from '../nightwatcher/types.js';
import { FEAR_BISHOP_ABILITY_IDS } from '../fear-bishop/types.js';
import { hasNightwatcherRitualLock } from '../nightwatcher/ritual.js';
import { hasNightwatcherLifeLock } from '../nightwatcher/life.js';
import { hasNightwatcherEncounterLock } from '../nightwatcher/encounter.js';
import { hasFearBishopLifeLock } from '../fear-bishop/life.js';
import { hasFearBishopEncounterLock } from '../fear-bishop/encounter.js';
import { createConcealmentServantLifeState, applyConcealmentServantActivity, projectConcealmentServantLife, concealmentServantLifeActions, validateConcealmentServantLife, validateConcealmentServantActivityCommand, hasConcealmentServantLifeLock } from './life.js';
import { createConcealmentServantEncounterState, applyConcealmentServantEncounterCommand, projectConcealmentServantEncounter, concealmentServantEncounterActions, validateConcealmentServantEncounter, validateConcealmentServantEncounterCommand, hasConcealmentServantEncounterLock } from './encounter.js';
import { CONCEALMENT_SERVANT_ABILITIES, CONCEALMENT_SERVANT_BOTTLE_IDS, CONCEALMENT_SERVANT_CONSUMPTION_RISK, CONCEALMENT_SERVANT_FORMULA_STATUS, CONCEALMENT_SERVANT_GUIDE, CONCEALMENT_SERVANT_LABOUR_STEPS, CONCEALMENT_SERVANT_LABOUR_TASKS, CONCEALMENT_SERVANT_MIN_FEAR_BISHOP_WEEKS, CONCEALMENT_SERVANT_POTION_SOURCES, CONCEALMENT_SERVANT_PREPARATIONS, CONCEALMENT_SERVANT_PRICES, CONCEALMENT_SERVANT_SOURCE_STATUS } from './content.js';
import { CONCEALMENT_SERVANT_ABILITY_IDS, CONCEALMENT_SERVANT_PREPARATION_IDS, type ConcealmentServantAcquisitionCommand, type ConcealmentServantAction, type ConcealmentServantBottle, type ConcealmentServantCommand, type ConcealmentServantProjection, type ConcealmentServantState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
const INHERITED_ABILITY_IDS = [...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS, ...NIGHTMARE_ABILITY_IDS, ...SOOTHER_ABILITY_IDS, ...SPIRIT_WARLOCK_ABILITY_IDS, ...NIGHTWATCHER_ABILITY_IDS, ...FEAR_BISHOP_ABILITY_IDS];
const freshBottle = (id: string, source: string, stockedWeek: number | null): ConcealmentServantBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createConcealmentServantState(): ConcealmentServantState {
  return { guidanceKnown: false, bottles: CONCEALMENT_SERVANT_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, fearBishopActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createConcealmentServantLifeState(), encounter: createConcealmentServantEncounterState() };
}
/** Historical membership never broadens the exact current-stage action guards. */
export const isConcealmentServant = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 2;
export const isConcealmentServantAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 3;
export const hasConcealmentServantHistory = (s: SliceState) => isConcealmentServant(s) && s.concealmentServant.promotionWeek !== null;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'darkness' && [3, 2].includes(s.progression.sequence ?? 0) && s.sleepless.discovered && s.fearBishop.guidanceKnown && s.fearBishop.promotionWeek !== null;
export const hasConcealmentServantLock = (s: SliceState): boolean => s.concealmentServant.preparedWeek !== null || hasConcealmentServantLifeLock(s) || hasConcealmentServantEncounterLock(s);
const bottleNumber = (b: Pick<ConcealmentServantBottle, 'id'>) => Number(b.id.slice('concealment-servant-potion-'.length));
const potionPrice = (b: ConcealmentServantBottle) => CONCEALMENT_SERVANT_PRICES.potion - (b.labourSteps === CONCEALMENT_SERVANT_LABOUR_STEPS ? CONCEALMENT_SERVANT_PRICES.labourCredit : 0);
const fearBishopWeeks = (s: SliceState) => Math.max(0, (s.concealmentServant.promotionWeek ?? s.week) - (s.fearBishop.promotionWeek ?? s.week));
const exhaustedSupply = (state: ConcealmentServantState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && failed(b.outcome));
const deliverySource = (number: number, week: number) => `${CONCEALMENT_SERVANT_GUIDE}的独立隐秘之仆成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列2原瓶concealment-servant-potion-${number}；非恐惧主教或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => CONCEALMENT_SERVANT_PREPARATION_IDS.every(id => s.concealmentServant.preparations.some(p => p.taskId === id));
function oldSceneOpen(s: SliceState): boolean {
  return s.fearBishop.preparedWeek !== null || hasFearBishopLifeLock(s) || hasFearBishopEncounterLock(s) ||
    Object.values(s.fearBishop.life.cases).some(v => v.contactOpen || v.status === 'PREPARED' || v.status === 'ACTIVE') ||
    s.fearBishop.life.tomas.effectActive || s.fearBishop.life.tomas.state !== 'AWAKE' ||
    s.fearBishop.life.container.location === 'PLAYER' || s.fearBishop.life.lamp.location === 'PLAYER' ||
    hasNightwatcherRitualLock(s) || hasNightwatcherLifeLock(s) || hasNightwatcherEncounterLock(s) ||
    Object.values(s.nightwatcher.life.cases).some(v => v.status === 'PREPARED') ||
    Object.values(s.spiritWarlock.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
    s.spiritWarlock.practice.note !== 'TABLE' || s.spiritWarlock.practice.dreamOpen || s.spiritWarlock.companion.status === 'DEPLOYED' ||
    Object.values(s.soother.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
    Object.values(s.nightmare.cases).some(v => v.status === 'PREPARED' || v.status === 'DREAM_RECORDED');
}
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原，旧伤须实际护理。';
  if (s.progression.acting !== 100) return `恐惧主教魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.fearBishop.promotionWeek === null || fearBishopWeeks(s) < CONCEALMENT_SERVANT_MIN_FEAR_BISHOP_WEEKS) return `成为恐惧主教后已过${fearBishopWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成房间边界与原门核对、当次许可和返程演练、弱追踪与反制界限核对；购买原瓶不能代做专业准备。';
}
export function validateConcealmentServantAcquisitionCommand(v: unknown): v is ConcealmentServantAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(v.type)) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && CONCEALMENT_SERVANT_PREPARATION_IDS.includes(v.taskId as typeof CONCEALMENT_SERVANT_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^concealment-servant-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(v.type)) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isConcealmentServantAcquisitionCommand = validateConcealmentServantAcquisitionCommand;
export function validateConcealmentServantCommand(v: unknown): v is ConcealmentServantCommand {
  return validateConcealmentServantAcquisitionCommand(v) || validateConcealmentServantActivityCommand(v) || validateConcealmentServantEncounterCommand(v);
}
export function concealmentServantAcquisitionBlock(s: SliceState, command: ConcealmentServantAcquisitionCommand): string | null {
  if (!validateConcealmentServantAcquisitionCommand(command)) return '隐秘之仆准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (oldSceneOpen(s) || hasConcealmentServantLifeLock(s) || hasConcealmentServantEncounterLock(s)) return '先实际收束旧恐惧主教与更早的原场、梦境、原物和准备，原志愿者须停止并真实醒来，已派出卷叶须实际召回；不能沿用旧同意或同时占用新场。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原准备室旁独立指导场。';
  if (!knownChannel(s)) return '实际成为恐惧主教并保留原指导渠道后，才能了解隐秘之仆之路。';
  if (!isConcealmentServantAcquisitionStage(s)) return '已晋升隐秘之仆2，不能凭继承的恐惧主教历史重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '须保留不眠者至恐惧主教全部16项原掌握与合法原值，不能以补造或删除条目取得新晋升。';
  const state = s.concealmentServant;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取独立来源、未知配方与仪式边界以及本次四档风险。' : s.cash < CONCEALMENT_SERVANT_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的隐秘之仆原瓶。';
    return s.cash < CONCEALMENT_SERVANT_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批隐秘之仆原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的隐秘之仆准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选隐秘之仆独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= CONCEALMENT_SERVANT_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyConcealmentServantAcquisition(s: SliceState, command: ConcealmentServantAcquisitionCommand, ctx: SeerContext): void {
  const reason = concealmentServantAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.concealmentServant;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= CONCEALMENT_SERVANT_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取隐秘之仆独立成品与专业准备指导', `花1行动、500便士。${CONCEALMENT_SERVANT_GUIDE}说明原渠道记录。${CONCEALMENT_SERVANT_FORMULA_STATUS}${CONCEALMENT_SERVANT_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = CONCEALMENT_SERVANT_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= CONCEALMENT_SERVANT_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(CONCEALMENT_SERVANT_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('隐秘之仆独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠灵体、隐秘窗口、搬物许可、人物同意、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批隐秘之仆成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < CONCEALMENT_SERVANT_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`concealment-servant-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶隐秘之仆原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.fearBishopActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of CONCEALMENT_SERVANT_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为隐秘之仆', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；恐惧主教消化100与全部旧16项掌握原值保留，两项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变，本人旧轻重伤与累计风险不治疗、不重置；原卷叶取得、封存、释放、再邀请、派出和召回记录及原纸原车保留；阿兰、布拉姆和哈兰已有伤亡、原棍去向及旧志愿者精神消耗不变，不创建新身体或新灵。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '隐秘之仆魔药严重排异' : '隐秘之仆魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为恐惧主教，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applyConcealmentServantCommand(s: SliceState, command: ConcealmentServantCommand, ctx: SeerContext): void {
  if (!validateConcealmentServantCommand(command)) throw new Error('隐秘之仆命令无效。');
  if (validateConcealmentServantAcquisitionCommand(command)) return applyConcealmentServantAcquisition(s, command, ctx);
  if (!isConcealmentServant(s)) throw new Error('新隐秘之仆实践与遭遇只向当前黑暗序列2开放，旧阶段历史不能代替当前资格。');
  if (validateConcealmentServantActivityCommand(command)) return applyConcealmentServantActivity(s, command, ctx);
  if (validateConcealmentServantEncounterCommand(command)) return applyConcealmentServantEncounterCommand(s, command, ctx);
  throw new Error('未知隐秘之仆命令。');
}

export function projectConcealmentServant(s: SliceState): ConcealmentServantProjection {
  const state = s.concealmentServant, available = knownChannel(s), promoted = isConcealmentServant(s), actions: ConcealmentServantAction[] = [];
  const add = (id: string, label: string, cost: string, command: ConcealmentServantAcquisitionCommand) => {
    const reason = concealmentServantAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && isConcealmentServantAcquisitionStage(s)) {
    if (!state.guidanceKnown) add('learn-concealment-servant-guidance', '听取隐秘之仆成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of CONCEALMENT_SERVANT_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`concealment-servant-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-concealment-servant-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-concealment-servant-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-concealment-servant-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-concealment-servant-supply', '申请下一批独立隐秘之仆成品', '1行动 · 下一真实周起收货 · 每瓶另付费用', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < CONCEALMENT_SERVANT_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${CONCEALMENT_SERVANT_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶隐秘之仆魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 恐惧主教消化${s.progression.acting}/100 · ${fearBishopWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '隐秘之仆 · 序列2候选G' : '隐秘之仆之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${CONCEALMENT_SERVANT_FORMULA_STATUS}${CONCEALMENT_SERVANT_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或本瓶五项真实劳动后800便士；现有全部失败耗尽才可花1行动申请，跨真实周到货仍须逐瓶实际付费。` : '',
    actions: available ? [...actions, ...(promoted ? [...concealmentServantLifeActions(s), ...concealmentServantEncounterActions(s)] : [])] : [],
    bottles: available ? state.bottles.map(b => ({
      id: b.id, title: `第${bottleNumber(b)}瓶 · 隐秘之仆独立成品魔药`,
      source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为恐惧主教' : '排异，仍为恐惧主教'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true },
    })) : [],
    preparations: available ? CONCEALMENT_SERVANT_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [],
    preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? CONCEALMENT_SERVANT_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? s.progression.acting : 0,
    digestion: promoted ? `恐惧主教消化${state.fearBishopActingAtPromotion}/100留存；隐秘之仆扮演${s.progression.acting}/100。三案各实际报告25、一次反思25，普通完成同样可消化；每项新能力每案只在真实应用后最多增加8掌握，成功开窗而未使用不奖掌握。旧三案与旧反思不重复记为本阶经历。` : available ? `恐惧主教需消化100（当前${s.progression.acting}/100）、从其实际晋升周起12整周（当前${fearBishopWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完恐惧主教之路。',
    pollution: s.seer.pollution, risk: available ? CONCEALMENT_SERVANT_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `恐惧主教第${s.fearBishop.promotionWeek}周真实晋升；${promoted ? `原消化${state.fearBishopActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。通用首次晋升周${s.progression.promotionWeek}不作为本阶十二周起点。`,
      '不眠者至恐惧主教七阶全部16个原ID与原掌握（包括0值）、旧原瓶失败及旧场景历史保留；本阶不改变身体性别、不创建新身体。',
      `本人健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；原伤势记录${s.injuries.length}项，未治疗重伤${s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length}项、累计风险${s.injuryRisk}，不会因晋升自动治疗或清零。`,
      `唯一原灵${s.spiritWarlock.companion.source}：当前${s.spiritWarlock.companion.status}，取得周${s.spiritWarlock.companion.acquiredWeek ?? '未取得'}、最近邀请周${s.spiritWarlock.companion.invitedWeek ?? '无'}；原释放${s.spiritWarlock.companion.releases}次、派出${s.spiritWarlock.companion.deployments}次、召回${s.spiritWarlock.companion.recalls}次。不会免费重邀、复制原灵或赠送灵体库。`,
      `原恐惧主教凝片${s.fearBishop.life.residue.id}保持${s.fearBishop.life.residue.status}、原弱踪${s.fearBishop.life.trace.id}保持${s.fearBishop.life.trace.status}；原容器${s.fearBishop.life.container.id}在${s.fearBishop.life.container.location}、原灯${s.fearBishop.life.lamp.id}在${s.fearBishop.life.lamp.location}，不改为新案物件。`,
      `原托马斯${s.fearBishop.life.tomas.id}健康${s.fearBishop.life.tomas.health}、精神${s.fearBishop.life.tomas.mind}、${s.fearBishop.life.tomas.state}，仍在${s.fearBishop.life.tomas.location}；旧消耗不退回，旧同意不延伸到新房间。`,
      ...(s.fearBishop.encounter.approachWeek === null ? [] : [`原哈兰FB3-HARLAN：${s.fearBishop.encounter.enemyStatus}，健康${s.fearBishop.encounter.enemyHealth}、精神${s.fearBishop.encounter.enemyMind}、灵性${s.fearBishop.encounter.enemySpirituality}；原棍FB3-HARLAN-CLUB仍在${s.fearBishop.encounter.weaponLocation}，不重开原遭遇或转给玩家。`]),
      ...(s.nightwatcher.encounter.approachWeek === null ? [] : [`原布拉姆${s.nightwatcher.encounter.enemy.id}：${s.nightwatcher.encounter.enemy.status}、健康${s.nightwatcher.encounter.enemy.health}；原棍${s.nightwatcher.encounter.enemy.weaponId}在${s.nightwatcher.encounter.enemy.weaponLocation}，既有死亡保留，不复制为新敌。`]),
      '原阿兰的既有死亡、凯尔和奥林的既有投降，以及原纸、原车、已耗尽守夜人仪式包均按各自真实历史保留；隐秘不删除旧记录。',
    ] : [],
    life: projectConcealmentServantLife(s), encounter: projectConcealmentServantEncounter(s), insideCase: hasConcealmentServantLock(s),
    environment: available ? '原创G：贝克兰德独立指导场与CS2-ROOM同一6米普通房间，38岁成年保管员艾琳、原封签盒CS2-CASE-1和原记录页CS2-PAGE-1；只有原木门和原门闩。原身体、原物和所有权保留，许可撤回、解除隐秘、普通解闩与原路出入都须实际完成；隐秘最多60秒、弱踪检索最多阻延一次20秒。旧恐惧主教原场保持原状态。' : '',
  };
}

/** Exact source identities and finite week chronology; old modules retain ownership of their histories. */
export function validateConcealmentServantState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.concealmentServant;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'fearBishopActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as ConcealmentServantState, promoted = isConcealmentServant(s), acquisitionStage = isConcealmentServantAcquisitionStage(s);
  const firstWeek = s.fearBishop.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + CONCEALMENT_SERVANT_MIN_FEAR_BISHOP_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !integer(s.fearBishop.promotionWeek, 1, s.week))) return false;
  if (acquisitionStage && (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > CONCEALMENT_SERVANT_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !CONCEALMENT_SERVANT_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || oldSceneOpen(s) || hasConcealmentServantLifeLock(s) || hasConcealmentServantEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.fearBishop.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.fearBishopActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...INHERITED_ABILITY_IDS, ...CONCEALMENT_SERVANT_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.fearBishopActingAtPromotion !== null || CONCEALMENT_SERVANT_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `concealment-servant-potion-${index + 1}` || !integer(b.labourSteps, 0, CONCEALMENT_SERVANT_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < CONCEALMENT_SERVANT_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== CONCEALMENT_SERVANT_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % CONCEALMENT_SERVANT_BOTTLE_IDS.length;
      if (b.stockedWeek !== state.bottles[batchStart]!.stockedWeek) return false;
      // Every earlier bottle must have failed before this batch's real delivery week.
      if (state.bottles.slice(0, batchStart).some(previous => previous.status !== 'CONSUMED' || !failed(previous.outcome) || !integer(previous.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
    }
    if (!state.guidanceKnown && (b.labourSteps !== 0 || b.status !== 'SUPPLIER')) return false;
    if (b.status === 'SUPPLIER') {
      if (b.acquiredWeek !== null || b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.acquiredWeek, stockWeek, lastAcquisitionWeek)) return false;
      if (b.status === 'PLAYER') {
        if (b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
      } else if (b.status === 'CONSUMED') {
        if (!integer(s.fearBishop.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateConcealmentServantLife(s) || !validateConcealmentServantEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { CONCEALMENT_SERVANT_ABILITIES } from './content.js';
export { CONCEALMENT_SERVANT_ABILITY_IDS } from './types.js';
export type * from './types.js';
