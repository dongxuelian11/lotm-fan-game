import { PALE_EMPEROR_ABILITY_IDS } from '../pale-emperor/types.js';
import {DEATH_CONSUL_ABILITY_IDS} from '../death-consul/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { compareGameDates, formatGameDate, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../corpsecollector/types.js';
import { GRAVEDIGGER_ABILITY_IDS } from '../gravedigger/types.js';
import { SPIRITMEDIUM_ABILITY_IDS } from '../spiritmedium/types.js';
import { SPIRIT_GUIDE_ABILITY_IDS } from '../spirit-guide/types.js';
import { GATEKEEPER_ABILITY_IDS } from '../gatekeeper/types.js';
import { UNDYING_ABILITY_IDS } from '../undying/types.js';
import { hasUndyingRitualLock } from '../undying/ritual.js';
import { hasUndyingLifeLock, hasUndyingOldPractice } from '../undying/life.js';
import { hasUndyingEncounterLock } from '../undying/encounter.js';
import { createFerrymanLifeState, applyFerrymanActivity, projectFerrymanLife, ferrymanLifeActions, validateFerrymanLife, validateFerrymanActivityCommand, hasFerrymanLifeLock } from './life.js';
import { createFerrymanEncounterState, applyFerrymanEncounterCommand, projectFerrymanEncounter, ferrymanEncounterActions, validateFerrymanEncounter, validateFerrymanEncounterCommand, hasFerrymanEncounterLock } from './encounter.js';
import { createFerrymanEraState, arriveFerrymanEra, applyFerrymanEraCommand, projectFerrymanEra, ferrymanEraActions, validateFerrymanEra, validateFerrymanEraCommand } from './era.js';
import { FERRYMAN_ABILITIES, FERRYMAN_CONSUMPTION_RISK, FERRYMAN_FORMULA_STATUS, FERRYMAN_LABOUR_STEPS, FERRYMAN_LABOUR_TASKS, FERRYMAN_MIN_UNDYING_WEEKS, FERRYMAN_PREPARATIONS, FERRYMAN_PROVIDERS, FERRYMAN_SOURCE_STATUS, ferrymanBottleId, ferrymanPotionSource, ferrymanPrices } from './content.js';
import { FERRYMAN_ABILITY_IDS, FERRYMAN_PREPARATION_IDS, type FerrymanAcquisitionCommand, type FerrymanAction, type FerrymanBottle, type FerrymanChannel, type FerrymanChannelId, type FerrymanCommand, type FerrymanProjection, type FerrymanState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const sameDate = (a: PublicGameDate | null, b: PublicGameDate | null) => a !== null && b !== null && compareGameDates(a, b) === 0;
const START_DATE: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const weekFor = (date: PublicGameDate) => Math.floor(gameDaysBetween(START_DATE, date) / 7) + 1;
const postCycle = (s: SliceState) => s.longChapter.cycleDeathDate !== null;
const handedOff = (s: SliceState) => s.longChapter.handoff !== null;
const channelIdFor = (s: SliceState): FerrymanChannelId => postCycle(s) ? 'POST_CYCLE' : 'ORIGINAL';
const freshBottle = (channel: FerrymanChannelId, number: number, s: SliceState): FerrymanBottle => ({ id: ferrymanBottleId(channel, number), source: ferrymanPotionSource(channel, number, s.week), stockedWeek: s.week, stockedDate: { ...s.date }, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, paidPennies: 0, expiredDate: null, status: 'SUPPLIER', outcome: null });
export function createFerrymanState(): FerrymanState {
  return { guidanceKnown: false, channels: [], promotionWeek: null, promotionDate: null, undyingActingAtPromotion: null, life: createFerrymanLifeState(), encounter: createFerrymanEncounterState(), era: createFerrymanEraState() };
}
export const isFerryman = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 3;
const hasFerrymanHistory = (s: SliceState) => s.progression.pathwayId === 'death' && [3, 2, 1].includes(s.progression.sequence ?? 0);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'death' && [4, 3, 2, 1].includes(s.progression.sequence ?? 0) && s.corpsecollector.discovered && s.undying.guidanceKnown && s.undying.promotionWeek !== null && (!postCycle(s) || handedOff(s));
export const activeFerrymanChannel = (s: SliceState): FerrymanChannel | null => s.ferryman.channels.find(c => c.agreementClosedDate === null) ?? null;
export const hasFerrymanRitualLock = (s: SliceState): boolean => s.ferryman.channels.some(c => c.preparedWeek !== null);
export const hasFerrymanLock = (s: SliceState): boolean => hasFerrymanRitualLock(s) || hasFerrymanLifeLock(s) || hasFerrymanEncounterLock(s);
const potionPrice = (c: FerrymanChannel, b: FerrymanBottle) => ferrymanPrices(c.id).potion - (b.labourSteps === FERRYMAN_LABOUR_STEPS ? ferrymanPrices(c.id).labourCredit : 0);
const undyingWeeks = (s: SliceState) => Math.max(0, (s.ferryman.promotionWeek ?? s.week) - (s.undying.promotionWeek ?? s.week));
const exhaustedSupply = (c: FerrymanChannel) => c.bottles.length >= 3 && c.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const hasPreparations = (c: FerrymanChannel) => FERRYMAN_PREPARATION_IDS.every(id => c.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState, c: FerrymanChannel): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；先退出本次准备后实际休养。';
  if (s.progression.acting !== 100) return `不死者魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.undying.promotionWeek === null || undyingWeeks(s) < FERRYMAN_MIN_UNDYING_WEEKS) return `成为不死者后已过${undyingWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(c) ? null : '须在当前真实渠道分别完成路线、身份边界与普通返程三项准备；旧渠道准备不能转用。';
}
export function validateFerrymanAcquisitionCommand(v: unknown): v is FerrymanAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && FERRYMAN_PREPARATION_IDS.includes(v.taskId as typeof FERRYMAN_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^ferryman-(original|post-cycle)-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isFerrymanAcquisitionCommand = validateFerrymanAcquisitionCommand;
export function validateFerrymanCommand(v: unknown): v is FerrymanCommand {
  return validateFerrymanAcquisitionCommand(v) || validateFerrymanActivityCommand(v) || validateFerrymanEncounterCommand(v) || validateFerrymanEraCommand(v);
}
export function ferrymanAcquisitionBlock(s: SliceState, command: FerrymanAcquisitionCommand): string | null {
  if (!validateFerrymanAcquisitionCommand(command)) return '摆渡人准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不能借专业指导或周期复活。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前事件、真实战斗和未结周账。';
  if (hasUndyingRitualLock(s) || s.undying.ritual.activeVisitId !== null || hasUndyingLifeLock(s) || hasUndyingEncounterLock(s) || hasUndyingOldPractice(s) || hasFerrymanLifeLock(s) || hasFerrymanEncounterLock(s)) return '先实际收束旧仪式、原簿原物、灵体与遭遇，以及当前现场；旧同意不替代本次许可。';
  if (!knownChannel(s)) return postCycle(s) ? '先完成真实首次周期、有限寻回并在居所外公开确认转往摆渡人渠道。' : '须实际成为不死者并保留原指导知识，才能了解摆渡人之路。';
  if (hasFerrymanHistory(s)) return '已经真实晋升摆渡人3，不能重复准备或服药；原瓶和旧周期历史保留。';
  if (s.world.city !== 'BACKLUND') return '须本人实际回到贝克兰德的本次独立接待处。';
  if (!postCycle(s) && !['NONE', 'CANCELLED'].includes(s.longChapter.phase)) return '先沿居所原出口取消尚未完成的长期入驻准备。';
  const c = activeFerrymanChannel(s);
  if (command.type === 'LEAVE_PREPARATION') return c?.preparedWeek == null ? '没有尚未使用的当前场地准备。' : null;
  if (c?.preparedWeek != null && command.type !== 'CONSUME') return '本周服药场地已检查；先独立确认原瓶或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (c) return '当前时代的原供应人已经实际介绍，不能重复领取来源或库存。';
    const id = channelIdFor(s), price = s.ferryman.guidanceKnown ? 0 : ferrymanPrices(id).guidance;
    if (s.ferryman.channels.some(v => v.id === id)) return '这个时代的原渠道已经结束，不能复原约定、库存或旧人。';
    return s.cash < price ? `本次独立指导需要${price}便士。` : null;
  }
  if (!c || c.id !== channelIdFor(s)) return '先以真实1行动介绍当前时代的新来源；旧知识、旧供应人和旧原瓶不能替代。';
  if (postCycle(s) && s.ferryman.era.location !== 'RECEPTION') return '先沿实际12米普通路线进入当前摆渡人接待处。';
  if (command.type === 'PREPARE_TASK') return c.preparations.some(p => p.taskId === command.taskId) ? '当前渠道这一项专业准备已经真实完成。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s, c); if (reason) return reason;
    if (!c.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶当前渠道尚未服用的原瓶。';
    return s.cash < ferrymanPrices(c.id).preparation ? `本周检查需要${ferrymanPrices(c.id).preparation}便士。` : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return c.resupply.requestedWeek !== null ? '已申请下一批，须下一真实周起实际收货。' : exhaustedSupply(c) ? null : '当前渠道全部原瓶须真实失败耗尽，才能申请补货。';
  if (command.type === 'RECEIVE_SUPPLY') return c.resupply.requestedWeek === null ? '尚未申请当前渠道下一批原瓶。' : s.week <= c.resupply.requestedWeek ? '本周刚申请，下一真实周起才能到货。' : exhaustedSupply(c) ? null : '当前原瓶尚未全部失败耗尽。';
  if (!('bottleId' in command)) return '未知摆渡人准备命令。';
  const b = c.bottles.find(v => v.id === command.bottleId);
  if (!b) return '所选当前渠道原瓶不存在；旧时代原瓶不能转用。';
  if (command.type === 'CONSUME') {
    if (b.status !== 'PLAYER') return '所选原瓶尚未交付、已耗尽或已过期。';
    const reason = promotionBlock(s, c); if (reason) return reason;
    return c.preparedWeek === s.week ? null : `须另付1行动与${ferrymanPrices(c.id).preparation}便士检查本周场地。`;
  }
  if (b.status !== 'SUPPLIER') return '本瓶已交付、耗尽或过期，不能追溯抵扣或再次购买。';
  if (command.type === 'POTION_WORK') return b.labourSteps >= FERRYMAN_LABOUR_STEPS ? '本瓶五项真实劳务已经完成。' : null;
  return s.cash < potionPrice(c, b) ? `领取本瓶需要${potionPrice(c, b)}便士。` : null;
}
function closePreparation(s: SliceState, c: FerrymanChannel, outcome: 'CONSUMED' | 'CANCELLED', bottleId: string | null) {
  const window = c.preparationWindows.at(-1)!;
  window.closedWeek = s.week; window.closedDate = { ...s.date }; window.outcome = outcome; window.bottleId = bottleId; c.preparedWeek = null;
}
/** Called only by the real one-way first-cycle transition, before its clock advance. */
export function closeFerrymanOriginalEra(s: SliceState, departureDate: PublicGameDate, cycleDate: PublicGameDate): void {
  const c = s.ferryman.channels.find(v => v.id === 'ORIGINAL'); if (!c || c.agreementClosedDate !== null) return;
  if (c.preparedWeek !== null) throw new Error('须先真实取消摆渡人本周服药准备，不能携开放窗口进入长期居所。');
  if (!isValidGameDate(departureDate) || !isValidGameDate(cycleDate) || compareGameDates(departureDate, c.introducedDate) < 0 || compareGameDates(cycleDate, departureDate) < 0 || hasFerrymanHistory(s)) throw new Error('原摆渡人渠道关闭日期或序列无效。');
  c.agreementClosedDate = { ...departureDate };
  if (c.resupply.requestedWeek !== null) c.resupply.cancelledDate = { ...departureDate };
  for (const b of c.bottles) if (b.status !== 'CONSUMED') { b.status = 'EXPIRED'; b.expiredDate = { ...cycleDate }; }
}
export function applyFerrymanAcquisition(s: SliceState, command: FerrymanAcquisitionCommand, ctx: SeerContext): void {
  const reason = ferrymanAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  if (command.type === 'LEARN_GUIDANCE') {
    const id = channelIdFor(s), paid = s.ferryman.guidanceKnown ? 0 : ferrymanPrices(id).guidance, alreadyAtReception = s.ferryman.era.location === 'RECEPTION';
    s.actionsRemaining--; s.cash -= paid;
    s.ferryman.channels.push({ id, provider: { ...FERRYMAN_PROVIDERS[id] }, introducedWeek: s.week, introducedDate: { ...s.date }, guidancePaid: paid, agreementClosedDate: null,
      bottles: [1, 2, 3].map(n => freshBottle(id, n, s)), resupply: { requestedWeek: null, requestedDate: null, cancelledDate: null, deliveries: 0 }, preparations: [], preparedWeek: null, preparationWindows: [] });
    s.ferryman.guidanceKnown = true; if (id === 'POST_CYCLE') arriveFerrymanEra(s);
    ctx.note('实际介绍本时代摆渡人独立来源', `花1行动、${paid}便士，实际接触${FERRYMAN_PROVIDERS[id].name}（${FERRYMAN_PROVIDERS[id].id}，本次介绍时${FERRYMAN_PROVIDERS[id].ageAtIntroduction}岁）。${id === 'POST_CYCLE' ? `${alreadyAtReception ? '本人已沿普通道路实际到达当前接待处，本次不重复行走。' : '从原居所外沿12米干燥普通道路步行12秒，到新接待处。'}莱娜只介绍新来源，不是供应人，不召回旧导师。` : '这是本次原时代的独立供应人，不是旧伊芙琳提供新药。'}${paid === 0 ? '保留已学知识不重复收费，实际新介绍仍花行动。' : ''}${FERRYMAN_FORMULA_STATUS}${FERRYMAN_CONSUMPTION_RISK}`); return;
  }
  const c = activeFerrymanChannel(s)!, prices = ferrymanPrices(c.id);
  switch (command.type) {
    case 'PREPARE_TASK': {
      const task = FERRYMAN_PREPARATIONS.find(v => v.id === command.taskId)!; s.actionsRemaining--;
      c.preparations.push({ id: `ferryman-${c.id}-${task.id}`, taskId: task.id, completedWeek: s.week, completedDate: { ...s.date } });
      ctx.note(task.title, `花1行动，在当前${c.provider.name}的真实渠道完成。${task.description}尚未检查本次服药场地，尚未用原瓶。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= prices.preparation; c.preparedWeek = s.week;
      c.preparationWindows.push({ id: `ferryman-${c.id}-preparation-${c.preparationWindows.length + 1}`, preparedWeek: s.week, preparedDate: { ...s.date }, closedWeek: null, closedDate: null, outcome: null, bottleId: null });
      ctx.note('实际检查本周摆渡人服药场地', `花1行动、${prices.preparation}便士，仅本周当前渠道有效。尚未服药，须对同一原瓶独立确认；0行动可沿原出口退出，不返还成本。`); return;
    case 'LEAVE_PREPARATION':
      closePreparation(s, c, 'CANCELLED', null); ctx.note('沿普通出口结束本次准备', `0行动退出，${prices.preparation}便士与已用行动不退；未服原瓶和真实准备历史保留。`); return;
    case 'POTION_WORK': {
      const b = c.bottles.find(v => v.id === command.bottleId)!; s.actionsRemaining--; b.labourSteps++;
      ctx.note(FERRYMAN_LABOUR_TASKS[b.labourSteps - 1]!, `花1行动，原瓶${b.id}劳动${b.labourSteps}/5；只有本瓶五项全部完成才抵${prices.labourCredit}便士，仍付${prices.potion - prices.labourCredit}便士。不能转给另瓶或另一时代，也不能代做专业准备。`); return;
    }
    case 'BUY_POTION': {
      const b = c.bottles.find(v => v.id === command.bottleId)!, paid = potionPrice(c, b); s.cash -= paid; b.paidPennies = paid; b.status = 'PLAYER'; b.acquiredWeek = s.week;
      ctx.note('当前摆渡人原瓶实际交付', `0行动、${paid}便士，实际收到同一原瓶${b.id}。不足五项劳动不折现；不附赠准备、消化、人物同意、灵体或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; c.resupply.requestedWeek = s.week; c.resupply.requestedDate = { ...s.date };
      ctx.note('实际申请当前渠道下一批成品', `花1行动，${c.provider.name}登记原失败记录。最早第${s.week + 1}周实际接收三瓶，此刻没有新库存，旧失败不复原。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = c.bottles.length + 1; for (let i = 0; i < 3; i++) c.bottles.push(freshBottle(c.id, first + i, s));
      c.resupply.deliveries++; c.resupply.requestedWeek = null; c.resupply.requestedDate = null;
      ctx.note('当前供应人三瓶新原瓶实际到货', `第${s.week}周，第${first}至${first + 2}原瓶实际到货，0行动。尚未交付，各自仍需${prices.potion}便士或五项对应劳动后${prices.potion - prices.labourCredit}便士；旧折扣不转移。`); return;
    }
    case 'CONSUME': {
      const b = c.bottles.find(v => v.id === command.bottleId)!, result = ctx.check('will', 30);
      b.status = 'CONSUMED'; b.outcome = result.tier; b.consumedWeek = s.week; b.preparationWeek = c.preparedWeek; closePreparation(s, c, 'CONSUMED', b.id);
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15; s.mind = Math.max(1, s.mind - mentalCost);
        s.ferryman.undyingActingAtPromotion = s.progression.acting; s.ferryman.promotionWeek = s.week; s.ferryman.promotionDate = { ...s.date };
        s.progression.sequence = 3; s.progression.acting = 0;
        for (const id of FERRYMAN_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为摆渡人', `${b.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}；精神−${mentalCost}、四属性各+1。新掌握0，灵性上限120且当前不补满，身体性别不改变。不死者消化100与旧人物、原物、死亡及已发生的周期历史保留。序列4周期资格在${formatGameDate(s.date)}结束，不再因旧周年死亡，也不能即时战斗复活。本人经普通出口结束本次场地准备。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', health = severe ? 25 : 15, mind = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - health); s.mind = Math.max(1, s.mind - mind); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '摆渡人魔药严重排异' : '摆渡人魔药排异', `${b.id}和本周准备真实耗尽，意志${result.roll}/${result.chance}；健康−${health}、精神−${mind}、排异+${pollution}。仅此次药物排异保底1，不保护普通死亡或战斗。仍是不死者，三项当前渠道准备和全部旧历史保留；实际退出后须休养、筹新瓶并重新付费检查场地。`);
      }
      return;
    }
  }
}
export function applyFerrymanCommand(s: SliceState, command: FerrymanCommand, ctx: SeerContext): void {
  if (!validateFerrymanCommand(command)) throw new Error('摆渡人命令无效。');
  if (validateFerrymanAcquisitionCommand(command)) return applyFerrymanAcquisition(s, command, ctx);
  if (validateFerrymanActivityCommand(command)) return applyFerrymanActivity(s, command, ctx);
  if (validateFerrymanEncounterCommand(command)) return applyFerrymanEncounterCommand(s, command, ctx);
  if (validateFerrymanEraCommand(command)) return applyFerrymanEraCommand(s, command, ctx);
  throw new Error('未知摆渡人命令。');
}

export function projectFerryman(s: SliceState): FerrymanProjection {
  const state = s.ferryman, available = knownChannel(s), promoted = hasFerrymanHistory(s), c = activeFerrymanChannel(s), actions: FerrymanAction[] = [];
  const acting = promoted ? ((s.progression.sequence === 2||s.progression.sequence===1) ? s.deathConsul.ferrymanActingAtPromotion ?? 0 : s.progression.acting) : 0;
  const prices = ferrymanPrices(c?.id ?? channelIdFor(s));
  const add = (id: string, label: string, cost: string, command: FerrymanAcquisitionCommand) => { const reason = ferrymanAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!c) add('learn-ferryman-guidance', state.guidanceKnown ? '实际介绍后世摆渡人新供应人' : '听取本时代摆渡人成品与专业准备指导', `1行动 · ${state.guidanceKnown ? 0 : prices.guidance}便士${postCycle(s) && s.ferryman.era.location !== 'RECEPTION' ? ' · 实际步行12米/12秒G' : ''}`, { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of FERRYMAN_PREPARATIONS) if (!c.preparations.some(p => p.taskId === task.id)) add(`ferryman-prepare-${task.id}`, task.title, '1行动 · 当前渠道专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (c.preparedWeek === null) add('prepare-ferryman-promotion', '实际检查本次摆渡人服药场地', `1行动 · ${prices.preparation}便士 · 仅本周有效`, { type: 'PREPARE_PROMOTION' });
      else add('leave-ferryman-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (c.resupply.requestedWeek !== null) add('receive-ferryman-supply', '确认当前渠道下一批三瓶实际到货', `0行动 · 最早第${c.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(c)) add('request-ferryman-supply', '申请当前渠道下一批独立成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      c.bottles.forEach((b, index) => {
        if (b.status === 'SUPPLIER') {
          if (b.labourSteps < 5) add(`work-${b.id}`, `第${index + 1}瓶 · ${FERRYMAN_LABOUR_TASKS[b.labourSteps]}`, `1行动 · 劳动${b.labourSteps}/5 · 五次抵${prices.labourCredit}便士`, { type: 'POTION_WORK', bottleId: b.id });
          add(`buy-${b.id}`, `领取第${index + 1}瓶摆渡人魔药`, `0行动 · ${potionPrice(c, b)}便士`, { type: 'BUY_POTION', bottleId: b.id });
        } else if (b.status === 'PLAYER') add(`consume-${b.id}`, `独立确认服用第${index + 1}瓶`, `0行动 · 不死者消化${s.progression.acting}/100 · ${undyingWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: b.id, confirmed: true });
      });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  const oldEnemy = s.undying.encounter.enemy;
  return {
    title: '摆渡人·死神序列3（有限往返G）', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${FERRYMAN_FORMULA_STATUS}${FERRYMAN_SOURCE_STATUS}` } : {}),
    currentChannel: available && c ? { id: c.id, provider: `${c.provider.name}（${c.provider.id}），本次介绍时${c.provider.ageAtIntroduction}岁`, introduced: `${formatGameDate(c.introducedDate)} · 第${c.introducedWeek}周实际介绍`, prices: { ...prices } } : null,
    channelHistory: available ? state.channels.flatMap(channel => [
      `${channel.id === 'ORIGINAL' ? '原时代' : '后世当前时代'}原供应人${channel.provider.name}（${channel.provider.id}）：${formatGameDate(channel.introducedDate)}第${channel.introducedWeek}周实际介绍，指导实付${channel.guidancePaid}便士；${channel.agreementClosedDate ? `${formatGameDate(channel.agreementClosedDate)}约定真实结束，当前生死与联系未知，不再接单。` : '本次约定未结束。'}`,
      ...channel.bottles.map(b => `${b.id}：${b.status === 'EXPIRED' ? `未服原瓶已于${formatGameDate(b.expiredDate!)}过期` : b.status === 'CONSUMED' ? `原瓶已耗尽，第${b.consumedWeek}周结果${b.outcome}` : b.status === 'PLAYER' ? '玩家持有尚未服用的原瓶' : '原供应人库存'}；本瓶劳动${b.labourSteps}/5、实际药款${b.paidPennies}便士。`),
      ...(channel.resupply.cancelledDate ? [`原第${channel.resupply.requestedWeek}周补货申请于${formatGameDate(channel.resupply.cancelledDate)}随约定取消；不在后世交货。`] : []),
      ...channel.preparations.map(p => `${p.id}：第${p.completedWeek}周真实准备${channel.agreementClosedDate ? '，只保留历史，不能转用新渠道。' : '。'}`),
      ...channel.preparationWindows.map(p => `${p.id}：第${p.preparedWeek}周检查，实付${ferrymanPrices(channel.id).preparation}便士；${p.outcome === 'CONSUMED' ? `同一原瓶${p.bottleId}服用后结束` : p.outcome === 'CANCELLED' ? '本人实际取消，不退成本' : '本周尚未使用'}。`),
    ]) : [],
    supplies: available ? c ? `当前${c.provider.name}持${c.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${c.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${c.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶${prices.potion}便士或本瓶五项劳动后${prices.potion - prices.labourCredit}便士；全部失败耗尽后才能真实跨周补货，旧时代折扣不能转用。` : '尚未实际介绍当前时代供应人；旧指导知识不产生新库存、同意或约定。' : '',
    actions: available ? [...actions, ...ferrymanLifeActions(s), ...ferrymanEncounterActions(s), ...ferrymanEraActions(s)] : [],
    bottles: available && c ? c.bottles.map((b, index) => ({ id: b.id, title: `第${index + 1}瓶 · 当前摆渡人成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周实付${b.paidPennies}便士交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周检查后服用。`}`, status: b.status === 'SUPPLIER' ? `当前供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : b.status === 'EXPIRED' ? '旧原瓶已过期' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为不死者' : '排异，仍为不死者'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? FERRYMAN_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: c?.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? c?.preparedWeek ?? null : null,
    abilities: promoted ? FERRYMAN_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting, digestion: promoted ? `不死者原消化${state.undyingActingAtPromotion}/100留存；摆渡人扮演${acting}/100。三案各25、反思25为本作G，普通完成可消化；新掌握只来自对应能力实际成功并报告。` : available ? `不死者需消化100（当前${s.progression.acting}/100）、晋4后12整周（当前${undyingWeeks(s)}/12）；另须当前渠道三项专业准备和本周场地检查。` : '先走完不死者之路。',
    pollution: s.seer.pollution, risk: available ? FERRYMAN_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `不死者第${s.undying.promotionWeek}周真实晋升；${promoted ? `原消化${state.undyingActingAtPromotion}/100留存，${formatGameDate(state.promotionDate!)}晋升3后不再触发序列4周期` : `当前消化${s.progression.acting}/100，序列4周期仍适用`}。`,
      `原首六十年周年${s.undying.lifecycle.expectedCycleDate ? formatGameDate(s.undying.lifecycle.expectedCycleDate) : '未登记'}；实际经历${s.undying.lifecycle.experiencedCycles}次周期，${postCycle(s) ? '原死亡、七天后同体复起与三项有限寻回保留，不能重置或保证恢复全部记忆。' : '没有凭空经历周期，晋升无需强行先死一次。'}`,
      `原欧文${oldEnemy.id}：健康${oldEnemy.health}/100、精神${oldEnemy.mind}/100；${oldEnemy.status === 'DEAD' ? '已死亡，不会复活' : oldEnemy.status === 'SURRENDERED' ? '已投降，原伤势保留' : postCycle(s) ? '旧时代记录，其当前生死与联系未知' : '原遭遇历史保留'}。唯一原棍${oldEnemy.weaponId}保留原去向${oldEnemy.weaponLocation}，不作为新罗温的武器。`,
      postCycle(s) ? '原伊芙琳已在长期章节登记83岁故去，不是后世新供应人；乔里当前生命与联系未知。原灰羽已真实释放，后世当前联系未知，不会免费回来帮战；当前芦羽是另一个已有来源的当地友善灵。' : `原伊芙琳、乔里、原灰羽SG6-GRAY-FEATHER及其实际约定与去向保持；原灰羽当前记录${s.gatekeeper.companion.status}，不会自动成为新案来客或免费战友。`,
      `唯一原簿${s.undying.life.book.id}仍保存${s.undying.life.book.entries.length}条真实来源记录，原回信与原物去向不重造。身体性别不改变；晋升不治疗旧人、重置伤势或提供即时战斗复活。`,
    ] : [],
    life: projectFerrymanLife(s), encounter: projectFerrymanEncounter(s), era: projectFerrymanEra(s), insideCase: hasFerrymanLock(s),
    environment: available ? '当前中转室FR3-TRANSFER-HOUSE及新原人只在本次晋升后实际到场登记。玛拉FR3-MARA45岁在START，伊兰FR3-ILAN33岁在FAR；当地原灵芦羽FR3-REED在NEAR，不是旧灰羽或已故亲人。普通干廊START至NEAR4米、NEAR至FAR6米；灵体另有16米普通迂回道。两原端点、两份原灵材、原签FR3-TAG、原罐FR3-JAR、原回信FR3-REPLY各有真实去向。全部为原创G，没有永控、任意复活或虚构同意。' : '',
  };
}

export function validateFerrymanState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.ferryman;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'channels', 'promotionWeek', 'promotionDate', 'undyingActingAtPromotion', 'life', 'encounter', 'era']) || typeof raw.guidanceKnown !== 'boolean' || !Array.isArray(raw.channels) || raw.channels.length > 2) return false;
  const state = raw as unknown as FerrymanState, promoted = hasFerrymanHistory(s), firstWeek = (s.undying.promotionWeek ?? s.week), firstConsume = firstWeek + FERRYMAN_MIN_UNDYING_WEEKS;
  if (state.guidanceKnown !== (state.channels.length > 0) || state.channels.length && !(s.progression.pathwayId === 'death' && [4, 3, 2, 1].includes(s.progression.sequence ?? 0) && s.undying.guidanceKnown && s.undying.promotionWeek !== null)) return false;
  if (new Set(state.channels.map(c => c.id)).size !== state.channels.length || state.channels.filter(c => c.agreementClosedDate === null).length > 1) return false;
  if (state.channels.length === 2 && (state.channels[0]!.id !== 'ORIGINAL' || state.channels[1]!.id !== 'POST_CYCLE')) return false;
  let successes = 0;
  for (const [channelIndex, c] of state.channels.entries()) {
    if (!record(c) || !shape(c, ['id', 'provider', 'introducedWeek', 'introducedDate', 'guidancePaid', 'agreementClosedDate', 'bottles', 'resupply', 'preparations', 'preparedWeek', 'preparationWindows']) || !['ORIGINAL', 'POST_CYCLE'].includes(c.id)) return false;
    const provider = FERRYMAN_PROVIDERS[c.id], prices = ferrymanPrices(c.id);
    if (!record(c.provider) || !shape(c.provider, ['id', 'name', 'ageAtIntroduction']) || c.provider.id !== provider.id || c.provider.name !== provider.name || c.provider.ageAtIntroduction !== provider.ageAtIntroduction) return false;
    if (!isValidGameDate(c.introducedDate) || !integer(c.introducedWeek, firstWeek, state.promotionWeek ?? s.week) || weekFor(c.introducedDate) !== c.introducedWeek || s.undying.lifecycle.promotionDate === null || compareGameDates(c.introducedDate, s.undying.lifecycle.promotionDate) < 0 || compareGameDates(c.introducedDate, s.date) > 0 || c.guidancePaid !== (channelIndex === 0 ? prices.guidance : 0)) return false;
    if (c.id === 'POST_CYCLE' && (!handedOff(s) || c.agreementClosedDate !== null || compareGameDates(c.introducedDate, s.longChapter.handoff!.date) < 0)) return false;
    const closed = c.agreementClosedDate !== null;
    if (closed && (c.id !== 'ORIGINAL' || !isValidGameDate(c.agreementClosedDate) || !sameDate(c.agreementClosedDate, s.longChapter.departureDate) || !postCycle(s) || compareGameDates(c.agreementClosedDate!, c.introducedDate) < 0 || c.preparedWeek !== null)) return false;
    if (c.id === 'ORIGINAL' && postCycle(s) && !closed) return false;
    const lastWeek = closed ? s.longChapter.departureWeek! : state.promotionWeek ?? s.week, lastDate = closed ? c.agreementClosedDate! : state.promotionDate ?? s.date;
    if (!record(c.resupply) || !shape(c.resupply, ['requestedWeek', 'requestedDate', 'cancelledDate', 'deliveries']) || !integer(c.resupply.deliveries, 0, s.week) || !Array.isArray(c.bottles) || c.bottles.length !== 3 * (c.resupply.deliveries + 1) || !Array.isArray(c.preparations) || !Array.isArray(c.preparationWindows)) return false;
    if (c.preparations.length > 3 || new Set(c.preparations.map(p => p.taskId)).size !== c.preparations.length) return false;
    for (const p of c.preparations) if (!record(p) || !shape(p, ['id', 'taskId', 'completedWeek', 'completedDate']) || !FERRYMAN_PREPARATION_IDS.includes(p.taskId) || p.id !== `ferryman-${c.id}-${p.taskId}` || !integer(p.completedWeek, c.introducedWeek, lastWeek) || !isValidGameDate(p.completedDate) || weekFor(p.completedDate) !== p.completedWeek || compareGameDates(p.completedDate, c.introducedDate) < 0 || compareGameDates(p.completedDate, lastDate) > 0) return false;
    if (c.preparedWeek !== null && (closed || promoted || c.preparedWeek !== s.week || !hasPreparations(c) || s.progression.acting !== 100 || !c.bottles.some(b => b.status === 'PLAYER') || hasFerrymanLifeLock(s) || hasFerrymanEncounterLock(s))) return false;
    for (const [i, window] of c.preparationWindows.entries()) {
      if (!record(window) || !shape(window, ['id', 'preparedWeek', 'preparedDate', 'closedWeek', 'closedDate', 'outcome', 'bottleId']) || window.id !== `ferryman-${c.id}-preparation-${i + 1}` || !integer(window.preparedWeek, Math.max(firstConsume, c.introducedWeek), lastWeek) || !isValidGameDate(window.preparedDate) || weekFor(window.preparedDate) !== window.preparedWeek || compareGameDates(window.preparedDate, lastDate) > 0 || !hasPreparations(c) || c.preparations.some(p => compareGameDates(p.completedDate, window.preparedDate) > 0)) return false;
      const previous = c.preparationWindows[i - 1]; if (previous && (previous.closedDate === null || compareGameDates(previous.closedDate, window.preparedDate) > 0)) return false;
      if (window.outcome === null) { if (i !== c.preparationWindows.length - 1 || c.preparedWeek !== window.preparedWeek || window.closedWeek !== null || window.closedDate !== null || window.bottleId !== null || closed) return false; }
      else {
        if (!['CANCELLED', 'CONSUMED'].includes(window.outcome) || window.closedWeek !== window.preparedWeek || !isValidGameDate(window.closedDate) || !sameDate(window.closedDate, window.preparedDate)) return false;
        if (window.outcome === 'CANCELLED') { if (window.bottleId !== null) return false; }
        else if (!c.bottles.some(b => b.id === window.bottleId && b.status === 'CONSUMED' && b.preparationWeek === window.preparedWeek)) return false;
      }
    }
    if ((c.preparationWindows.filter(w => w.outcome === null).length === 1) !== (c.preparedWeek !== null)) return false;
    for (const [index, b] of c.bottles.entries()) {
      if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'stockedDate', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'paidPennies', 'expiredDate', 'status', 'outcome']) || b.id !== ferrymanBottleId(c.id, index + 1) || b.source !== ferrymanPotionSource(c.id, index + 1, b.stockedWeek) || !integer(b.labourSteps, 0, 5) || !integer(b.stockedWeek, c.introducedWeek, lastWeek) || !isValidGameDate(b.stockedDate) || weekFor(b.stockedDate) !== b.stockedWeek || compareGameDates(b.stockedDate, c.introducedDate) < 0 || compareGameDates(b.stockedDate, lastDate) > 0) return false;
      if (index < 3) { if (b.stockedWeek !== c.introducedWeek || !sameDate(b.stockedDate, c.introducedDate)) return false; }
      else {
        const batchStart = index - index % 3;
        if (b.stockedWeek !== c.bottles[batchStart]!.stockedWeek || !sameDate(b.stockedDate, c.bottles[batchStart]!.stockedDate) || c.bottles.slice(batchStart - 3, batchStart).some(p => p.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(p.outcome ?? '') || !integer(p.consumedWeek, firstConsume, b.stockedWeek - 1))) return false;
      }
      if (b.acquiredWeek === null) { if (b.paidPennies !== 0 || !['SUPPLIER', 'EXPIRED'].includes(b.status)) return false; }
      else if (!integer(b.acquiredWeek, b.stockedWeek, lastWeek) || b.paidPennies !== potionPrice(c, b) || b.status === 'SUPPLIER') return false;
      if (b.status === 'CONSUMED') {
        if (b.expiredDate !== null || !integer(b.acquiredWeek, b.stockedWeek, lastWeek) || !integer(b.consumedWeek, Math.max(firstConsume, b.acquiredWeek), lastWeek) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || c.preparationWindows.filter(w => w.outcome === 'CONSUMED' && w.bottleId === b.id && w.preparedWeek === b.preparationWeek).length !== 1 || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; const w = c.preparationWindows.find(w => w.bottleId === b.id)!; if (closed || b.consumedWeek !== state.promotionWeek || !sameDate(w.closedDate, state.promotionDate)) return false; }
      } else {
        if (!['SUPPLIER', 'PLAYER', 'EXPIRED'].includes(b.status) || b.consumedWeek !== null || b.preparationWeek !== null || b.outcome !== null) return false;
        if (b.status === 'EXPIRED') { if (!closed || !isValidGameDate(b.expiredDate) || !sameDate(b.expiredDate, s.longChapter.cycleDeathDate)) return false; }
        else if (closed || b.expiredDate !== null || b.status === 'PLAYER' && b.acquiredWeek === null) return false;
      }
    }
    if (c.resupply.requestedWeek === null) { if (c.resupply.requestedDate !== null || c.resupply.cancelledDate !== null) return false; }
    else {
      if (!integer(c.resupply.requestedWeek, firstConsume, lastWeek) || !isValidGameDate(c.resupply.requestedDate) || weekFor(c.resupply.requestedDate) !== c.resupply.requestedWeek || compareGameDates(c.resupply.requestedDate, c.bottles.at(-1)!.stockedDate) < 0 || compareGameDates(c.resupply.requestedDate, lastDate) > 0 || !exhaustedSupply(c) || c.bottles.some(b => b.consumedWeek! > c.resupply.requestedWeek!)) return false;
      if (closed ? !sameDate(c.resupply.cancelledDate, c.agreementClosedDate) : c.resupply.cancelledDate !== null || promoted) return false;
    }
  }
  if (promoted) {
    const c = activeFerrymanChannel(s);
    if (!c || !state.guidanceKnown || !integer(state.promotionWeek, firstConsume, s.week) || !isValidGameDate(state.promotionDate) || weekFor(state.promotionDate) !== state.promotionWeek || compareGameDates(state.promotionDate, s.date) > 0 || state.undyingActingAtPromotion !== 100 || c.preparedWeek !== null || !hasPreparations(c)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?PALE_EMPEROR_ABILITY_IDS:[]),...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS, ...SPIRIT_GUIDE_ABILITY_IDS, ...GATEKEEPER_ABILITY_IDS, ...UNDYING_ABILITY_IDS, ...FERRYMAN_ABILITY_IDS,...((s.progression.sequence === 2||s.progression.sequence===1) ? DEATH_CONSUL_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.promotionDate !== null || state.undyingActingAtPromotion !== null || FERRYMAN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  return successes === (promoted ? 1 : 0) && validateFerrymanLife(s) && validateFerrymanEncounter(s) && validateFerrymanEra(s);
}
export { FERRYMAN_ABILITIES } from './content.js';
export { FERRYMAN_ABILITY_IDS } from './types.js';
export type * from './types.js';
