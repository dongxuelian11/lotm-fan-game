import { CONQUEROR_ABILITY_IDS } from '../conqueror/types.js';
import { WAR_BISHOP_ABILITY_IDS } from '../war-bishop/types.js';
import { hasWarBishopLock } from '../war-bishop/index.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { HUNTER_ABILITY_IDS } from '../hunter/types.js';
import { PROVOKER_ABILITY_IDS } from '../provoker/types.js';
import { PYROMANIAC_ABILITY_IDS } from '../pyromaniac/types.js';
import { CONSPIRATOR_ABILITY_IDS } from '../conspirator/types.js';
import { REAPER_ABILITY_IDS } from '../reaper/types.js';
import { IRON_BLOOD_KNIGHT_ABILITY_IDS } from '../iron-blood-knight/types.js';
import { applyIronBloodTeamCommand, blockIronBloodTeamCommand, hasIronBloodRite } from '../iron-blood-knight/team.js';
import { ironBloodInside } from '../iron-blood-knight/life.js';
import { isInsideIronBloodEncounter } from '../iron-blood-knight/encounter.js';
import { createWeatherWarlockLifeState, applyWeatherWarlockActivity, projectWeatherWarlockLife, weatherWarlockLifeActions, validateWeatherWarlockLife, validateWeatherWarlockActivityCommand, hasWeatherWarlockLifeLock } from './life.js';
import { createWeatherWarlockEncounterState, applyWeatherWarlockEncounterCommand, projectWeatherWarlockEncounter, weatherWarlockEncounterActions, validateWeatherWarlockEncounter, validateWeatherWarlockEncounterCommand, hasWeatherWarlockEncounterLock } from './encounter.js';
import { WEATHER_WARLOCK_ABILITIES, WEATHER_WARLOCK_BOTTLE_IDS, WEATHER_WARLOCK_CONSUMPTION_RISK, WEATHER_WARLOCK_FORMULA_STATUS, WEATHER_WARLOCK_GUIDE, WEATHER_WARLOCK_LABOUR_STEPS, WEATHER_WARLOCK_LABOUR_TASKS, WEATHER_WARLOCK_MIN_WAR_BISHOP_WEEKS, WEATHER_WARLOCK_POTION_SOURCES, WEATHER_WARLOCK_PREPARATIONS, WEATHER_WARLOCK_PRICES, WEATHER_WARLOCK_SOURCE_STATUS } from './content.js';
import { WEATHER_WARLOCK_ABILITY_IDS, WEATHER_WARLOCK_PREPARATION_IDS, type WeatherWarlockAcquisitionCommand, type WeatherWarlockAction, type WeatherWarlockBottle, type WeatherWarlockCommand, type WeatherWarlockProjection, type WeatherWarlockState, type WeatherWarlockTeamCommand } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const freshBottle = (id: string, source: string, stockedWeek: number | null): WeatherWarlockBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createWeatherWarlockState(): WeatherWarlockState {
  return { guidanceKnown: false, bottles: WEATHER_WARLOCK_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, warBishopActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createWeatherWarlockLifeState(), encounter: createWeatherWarlockEncounterState() };
}
export const isWeatherWarlock = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 2;
export const hasWeatherWarlockHistory = (s: SliceState) => isWeatherWarlock(s) || (s.progression.pathwayId === 'hunter' && s.progression.sequence === 1);
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'hunter' && [3, 2, 1].includes(s.progression.sequence ?? 0) && s.hunter.discovered && s.warBishop.guidanceKnown && s.warBishop.promotionWeek !== null;
export const hasWeatherWarlockLock = (s: SliceState): boolean => s.weatherWarlock.preparedWeek !== null || hasWeatherWarlockLifeLock(s) || hasWeatherWarlockEncounterLock(s);
const bottleNumber = (b: Pick<WeatherWarlockBottle, 'id'>) => Number(b.id.slice('weather-warlock-potion-'.length));
const potionPrice = (b: WeatherWarlockBottle) => WEATHER_WARLOCK_PRICES.potion - (b.labourSteps === WEATHER_WARLOCK_LABOUR_STEPS ? WEATHER_WARLOCK_PRICES.labourCredit : 0);
const warBishopWeeks = (s: SliceState) => Math.max(0, (s.weatherWarlock.promotionWeek ?? s.week) - (s.warBishop.promotionWeek ?? s.week));
const exhaustedSupply = (state: WeatherWarlockState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''));
const deliverySource = (number: number, week: number) => `${WEATHER_WARLOCK_GUIDE}的独立天气术士成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列2原瓶weather-warlock-potion-${number}；非战争主教或更早原瓶改装，配方和原著仪式仍未知，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => WEATHER_WARLOCK_PREPARATION_IDS.every(id => s.weatherWarlock.preparations.some(p => p.taskId === id));
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原。';
  if (s.progression.acting !== 100) return `战争主教魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.warBishop.promotionWeek === null || warBishopWeeks(s) < WEATHER_WARLOCK_MIN_WAR_BISHOP_WEEKS) return `成为战争主教后已过${warBishopWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成路线踏查、器材清点与中止求助演练；购买原瓶不能代做专业准备。';
}
export function validateWeatherWarlockAcquisitionCommand(v: unknown): v is WeatherWarlockAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && WEATHER_WARLOCK_PREPARATION_IDS.includes(v.taskId as typeof WEATHER_WARLOCK_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^weather-warlock-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isWeatherWarlockAcquisitionCommand = validateWeatherWarlockAcquisitionCommand;
export function validateWeatherWarlockTeamCommand(v: unknown): v is WeatherWarlockTeamCommand {
  return record(v) && shape(v, ['type']) && ['REST_TEAM', 'RECOVER_TEAM'].includes(String(v.type));
}
export function blockWeatherWarlockTeamCommand(s: SliceState, command: WeatherWarlockTeamCommand): string | null {
  if (!validateWeatherWarlockTeamCommand(command)) return '天气术士原队伍休整命令无效。';
  if (s.progression.sequence === 1) return '征服者阶段请通过本阶段生活入口安排原队伍休整。';
  if (!knownChannel(s)) return '实际成为战争主教或天气术士并保有原队伍后才能安排休整。';
  if (hasWeatherWarlockLock(s)) return '先实际收束天气术士场地准备、实践或遭遇，再让原成员在家休整。';
  return blockIronBloodTeamCommand(s, command);
}
export function applyWeatherWarlockTeamCommand(s: SliceState, command: WeatherWarlockTeamCommand, ctx: SeerContext): void {
  const reason = blockWeatherWarlockTeamCommand(s, command); if (reason) throw new Error(reason);
  applyIronBloodTeamCommand(s, command, ctx);
}
export function weatherWarlockRecoveryActions(s: SliceState): WeatherWarlockAction[] {
  if (!knownChannel(s) || s.progression.sequence === 1) return [];
  return ([['REST_TEAM', '为原队伍安排在家休整', '0行动 · 40便士 · 下一真实周才恢复'],
    ['RECOVER_TEAM', '确认原成员跨周后的有限恢复', '0行动 · 至多健康+20、精力+8 · 不复活、不自动到场']] as const).map(([type, label, cost]) => {
    const command: WeatherWarlockTeamCommand = { type }, reason = blockWeatherWarlockTeamCommand(s, command);
    return { id: `weather-warlock-team-${type.toLowerCase()}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function validateWeatherWarlockCommand(v: unknown): v is WeatherWarlockCommand {
  return validateWeatherWarlockTeamCommand(v) || validateWeatherWarlockAcquisitionCommand(v) || validateWeatherWarlockActivityCommand(v) || validateWeatherWarlockEncounterCommand(v);
}
export function weatherWarlockAcquisitionBlock(s: SliceState, command: WeatherWarlockAcquisitionCommand): string | null {
  if (!validateWeatherWarlockAcquisitionCommand(command)) return '天气术士准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasWarBishopLock(s) || hasIronBloodRite(s) || ironBloodInside(s) || isInsideIronBloodEncounter(s) ||
      Object.values(s.ironBloodKnight.life.cases).some(v => v.status === 'PREPARED') ||
      Object.values(s.reaper.cases).some(v => v.contactOpen || v.practice.windowOpen || v.status === 'PREPARED') ||
      Object.values(s.conspirator.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
      hasWeatherWarlockLifeLock(s) || hasWeatherWarlockEncounterLock(s) || s.ironBloodKnight.team.members.some(m => m.present)) return '先实际收束旧准备、形态、队伍联系与现场接触，不能同时占用原场。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德原货栈与训练院。';
  if (!knownChannel(s)) return '实际成为战争主教并保留原指导渠道后，才能了解天气术士之路。';
  if (hasWeatherWarlockHistory(s)) return '已经真实晋升天气术士2，不能重复准备或服药；未服原瓶保留。';
  const state = s.weatherWarlock;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取成品来源、未知配方与仪式边界以及本次风险。' : s.cash < WEATHER_WARLOCK_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的天气术士原瓶。';
    return s.cash < WEATHER_WARLOCK_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批天气术士原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的天气术士准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选天气术士独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= WEATHER_WARLOCK_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyWeatherWarlockAcquisition(s: SliceState, command: WeatherWarlockAcquisitionCommand, ctx: SeerContext): void {
  const reason = weatherWarlockAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.weatherWarlock;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= WEATHER_WARLOCK_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取天气术士独立成品与专业准备指导', `花1行动、500便士。${WEATHER_WARLOCK_GUIDE}说明原渠道记录。${WEATHER_WARLOCK_FORMULA_STATUS}${WEATHER_WARLOCK_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = WEATHER_WARLOCK_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧成员与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= WEATHER_WARLOCK_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(WEATHER_WARLOCK_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('天气术士独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠天气库存、军队、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批天气术士成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < WEATHER_WARLOCK_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`weather-warlock-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶天气术士原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mentalCost); state.warBishopActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of WEATHER_WARLOCK_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为天气术士', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；战争主教消化100与全部旧掌握保留，三项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不再变化，30位原成员没有被召来、治疗或复制。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '天气术士魔药严重排异' : '天气术士魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为战争主教，旧消化、掌握、身体与三项真实专业经历保留；可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
export function applyWeatherWarlockCommand(s: SliceState, command: WeatherWarlockCommand, ctx: SeerContext): void {
  if (!validateWeatherWarlockCommand(command)) throw new Error('天气术士命令无效。');
  if (validateWeatherWarlockTeamCommand(command)) return applyWeatherWarlockTeamCommand(s, command, ctx);
  if (validateWeatherWarlockAcquisitionCommand(command)) return applyWeatherWarlockAcquisition(s, command, ctx);
  if (validateWeatherWarlockActivityCommand(command)) return applyWeatherWarlockActivity(s, command, ctx);
  if (validateWeatherWarlockEncounterCommand(command)) return applyWeatherWarlockEncounterCommand(s, command, ctx);
  throw new Error('未知天气术士命令。');
}

export function projectWeatherWarlock(s: SliceState): WeatherWarlockProjection {
  const state = s.weatherWarlock, available = knownChannel(s), promoted = hasWeatherWarlockHistory(s), actions: WeatherWarlockAction[] = [];
  const add = (id: string, label: string, cost: string, command: WeatherWarlockAcquisitionCommand) => { const reason = weatherWarlockAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (available && !promoted) {
    if (!state.guidanceKnown) add('learn-weather-warlock-guidance', '听取天气术士成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of WEATHER_WARLOCK_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`weather-warlock-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-weather-warlock-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-weather-warlock-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-weather-warlock-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-weather-warlock-supply', '申请下一批独立天气术士成品', '1行动 · 下一真实周起收货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${WEATHER_WARLOCK_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶天气术士魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 战争主教消化${s.progression.acting}/100 · ${warBishopWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '天气术士 · 序列2' : '天气术士之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${WEATHER_WARLOCK_FORMULA_STATUS}${WEATHER_WARLOCK_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或对应五项真实劳动后800便士；全部失败耗尽才可申请真实跨周补货。` : '',
    actions: available && s.progression.sequence !== 1 ? [...actions, ...weatherWarlockRecoveryActions(s), ...weatherWarlockLifeActions(s), ...weatherWarlockEncounterActions(s)] : [],
    bottles: available ? state.bottles.map(b => ({ id: b.id, title: `第${bottleNumber(b)}瓶 · 天气术士成品魔药`, source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`, status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为战争主教' : '排异，仍为战争主教'}`, chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true } })) : [],
    preparations: available ? WEATHER_WARLOCK_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [], preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? WEATHER_WARLOCK_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? (s.progression.sequence === 1 ? s.conqueror.weatherWarlockActingAtPromotion ?? 100 : s.progression.acting) : 0, digestion: promoted ? `战争主教消化${state.warBishopActingAtPromotion}/100留存；天气术士扮演${s.progression.sequence === 1 ? s.conqueror.weatherWarlockActingAtPromotion : s.progression.acting}/100。三项真实情境各25、反思25均为G，普通完成同样可消化，掌握只奖真实能力成功。` : available ? `战争主教需消化100（当前${s.progression.acting}/100）、晋3后12整周（当前${warBishopWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完战争主教之路。',
    pollution: s.seer.pollution, risk: available ? WEATHER_WARLOCK_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender, originalGender: s.ironBloodKnight.originalGender,
    inheritedHistory: available ? [`战争主教第${s.warBishop.promotionWeek}周真实晋升；${promoted ? `原消化${state.warBishopActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。`, '猎人至战争主教的全部原ID与掌握、原身体变化和旧遭遇结局保持；本次不再改变身体性别。', '30位原成员只有一份健康、精力、意愿与位置；本章引用原G1五人，每次须真实重新到场，旧邀请不是当前在场。'] : [],
    life: projectWeatherWarlockLife(s), encounter: projectWeatherWarlockEncounter(s), insideCase: hasWeatherWarlockLock(s),
    environment: available ? '贝克兰德原货栈与独立石院。旧30人平时各自返家，本章只引用G1五位成人；原物、路线、专业准备、三项情境与有限距离时间均标本作G。' : '',
  };
}

/** Finite data/chronology checks; old history and member resources have their original single owner. */
export function validateWeatherWarlockState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.weatherWarlock;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'warBishopActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as WeatherWarlockState, promoted = hasWeatherWarlockHistory(s), firstWeek = s.warBishop.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + WEATHER_WARLOCK_MIN_WAR_BISHOP_WEEKS;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (state.preparations.length > 3 || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !WEATHER_WARLOCK_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, state.promotionWeek ?? s.week)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || promoted || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || hasWeatherWarlockLifeLock(s) || hasWeatherWarlockEncounterLock(s))) return false;
  if (s.progression.pathwayId === 'hunter' && s.progression.sequence === 1 && (s.conqueror.weatherWarlockActingAtPromotion !== 100 || hasWeatherWarlockLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.warBishop.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.warBishopActingAtPromotion !== 100 || state.preparedWeek !== null || !hasPreparations(s)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence === 1 ? CONQUEROR_ABILITY_IDS : []),...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS, ...PYROMANIAC_ABILITY_IDS, ...CONSPIRATOR_ABILITY_IDS, ...REAPER_ABILITY_IDS, ...IRON_BLOOD_KNIGHT_ABILITY_IDS, ...WAR_BISHOP_ABILITY_IDS, ...WEATHER_WARLOCK_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.warBishopActingAtPromotion !== null || WEATHER_WARLOCK_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `weather-warlock-potion-${index + 1}` || !integer(b.labourSteps, 0, 5)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < 3) { if (b.stockedWeek !== null || b.source !== WEATHER_WARLOCK_POTION_SOURCES[index]!.source) return false; }
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
        if (!integer(s.warBishop.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), state.promotionWeek ?? s.week) || b.preparationWeek !== b.consumedWeek || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '') || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && s.progression.acting !== 100) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateWeatherWarlockLife(s) && validateWeatherWarlockEncounter(s);
}
export { WEATHER_WARLOCK_ABILITIES } from './content.js';
export { WEATHER_WARLOCK_ABILITY_IDS } from './types.js';
export type * from './types.js';
