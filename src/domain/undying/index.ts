import {DEATH_CONSUL_ABILITY_IDS} from '../death-consul/types.js';
import {FERRYMAN_ABILITY_IDS} from '../ferryman/types.js';
import type { PublicGameDate } from '../../shared/contracts.js';
import { isValidGameDate, compareGameDates, formatGameDate } from '../game-calendar.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../corpsecollector/types.js';
import { GRAVEDIGGER_ABILITY_IDS } from '../gravedigger/types.js';
import { SPIRITMEDIUM_ABILITY_IDS } from '../spiritmedium/types.js';
import { SPIRIT_GUIDE_ABILITY_IDS } from '../spirit-guide/types.js';
import { GATEKEEPER_ABILITY_IDS } from '../gatekeeper/types.js';
import {
  createUndyingRitualState, currentUndyingVisit, hasUndyingRitualLock, canConsumeUndyingRitual,
  closeUndyingRitual, validateUndyingRitualState, validateUndyingRitualCommand,
  applyUndyingRitualCommand, undyingRitualActions, projectUndyingRitual,
} from './ritual.js';
import {
  createUndyingLifeState, validateUndyingLife, projectUndyingLife, undyingLifeActions,
  hasUndyingLifeLock, validateUndyingActivityCommand,
} from './life.js';
import {
  createUndyingEncounterState, validateUndyingEncounter, projectUndyingEncounter,
  undyingEncounterActions, hasUndyingEncounterLock, validateUndyingEncounterCommand,
  applyUndyingEncounter,
} from './encounter.js';
import {
  UNDYING_ABILITIES, UNDYING_BOTTLE_IDS, UNDYING_CONSUMPTION_RISK, UNDYING_FORMULA_STATUS,
  UNDYING_GUIDE, UNDYING_LABOUR_STEPS, UNDYING_LABOUR_TASKS, UNDYING_MIN_GATEKEEPER_WEEKS,
  UNDYING_POTION_SOURCES, UNDYING_PRICES, UNDYING_RITUAL_SOURCE, UNDYING_SOURCE_STATUS, UNDYING_LIFECYCLE_BOUNDARY,
} from './content.js';
import {
  UNDYING_ABILITY_IDS, type UndyingAcquisitionCommand, type UndyingAction, type UndyingBottle,
  type UndyingCommand, type UndyingProjection, type UndyingState, type UndyingLifecycle,
} from './types.js';

const freshBottle = (id: string, source: string, stockedWeek: number | null): UndyingBottle => ({
  id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
  ritualId: null, ritualWindowWeek: null,
});
export function createUndyingState(): UndyingState {
  return {
    guidanceKnown: false, bottles: UNDYING_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, gatekeeperActingAtPromotion: null,
    lifecycle: { promotionDate: null, expectedCycleDate: null, experiencedCycles: 0, status: 'NOT_PROMOTED' },
    ritual: createUndyingRitualState(), life: createUndyingLifeState(), encounter: createUndyingEncounterState(),
  };
}
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isUndying = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 4;
const hasUndyingHistory = (s:SliceState) => isUndying(s)||(s.progression.pathwayId==='death'&&(s.progression.sequence===3||s.progression.sequence===2));
const isGatekeeper = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.corpsecollector.discovered && s.corpsecollector.guidanceKnown && s.gravedigger.guidanceKnown && s.spiritmedium.guidanceKnown && s.spiritGuide.guidanceKnown && s.gatekeeper.guidanceKnown && s.gatekeeper.promotionWeek !== null && (isGatekeeper(s) || hasUndyingHistory(s));
const bottleNumber = (bottle: Pick<UndyingBottle, 'id'>) => Number(bottle.id.slice('undying-potion-'.length));
const potionPrice = (bottle: UndyingBottle) => UNDYING_PRICES.potion - (bottle.labourSteps === UNDYING_LABOUR_STEPS ? UNDYING_PRICES.labourCredit : 0);
const gatekeeperWeeks = (s: SliceState) => Math.max(0, (s.undying.promotionWeek ?? s.week) - (s.gatekeeper.promotionWeek ?? s.week));
const exhaustedSupply = (state: UndyingState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${UNDYING_GUIDE}的独立不死者成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4不死者原瓶undying-potion-${number}，非收尸人至看门人旧瓶改装。完整配方仍未知，当前专业指导仪式与原封装包须另行准备。`;

export function undyingAcquisitionBlock(s: SliceState, command: UndyingAcquisitionCommand): string | null {
  const state = s.undying, ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (Object.values(s.gatekeeper.cases).some(scene => scene.contactOpen || scene.status === 'PREPARED')
    || s.gatekeeper.practice.marker !== 'DESK' || s.gatekeeper.practice.gateOpen || s.gatekeeper.companion.status === 'DEPLOYED'
    || hasUndyingLifeLock(s) || hasUndyingEncounterLock(s)) return '先实际结束原看门人现场、关门并取回同一原木标记，派出的原灰羽须召回；静息入驻不阻塞准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '须实际返回贝克兰德的原纪念工作室与许可纪念准备室。';
  if (!knownChannel(s)) return '先成为看门人并保有伊芙琳的原指导渠道。';
  if (hasUndyingHistory(s)) return '已经完成不死者晋升，不能重复准备或服药；未用原瓶保留。';
  if (hasUndyingRitualLock(s) && command.type !== 'CONSUME') return '你仍实际在原纪念准备室内；完成当前专业准备后独立确认饮药，或0行动沿原出口离场。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (state.guidanceKnown) return '已经听过不死者成品来源、未知完整仪式与专业指导方案G风险。';
    return s.cash < UNDYING_PRICES.guidance ? '本次指导需要520便士。' : null;
  }
  if (!state.guidanceKnown) return '先听伊芙琳说明成品来源、实际专业准备与四档风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (state.resupply.requestedWeek !== null) return '已申请后续三瓶，须等下一真实周实际到货。';
    return exhaustedSupply(state) ? null : '现有全部原瓶须真实耗尽且失败，才能申请后续供给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (state.resupply.requestedWeek === null) return '尚未申请后续不死者原瓶。';
    if (s.week <= state.resupply.requestedWeek) return '下一真实周起才能实际接收后续原瓶。';
    return exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = state.bottles.find(item => item.id === command.bottleId);
  if (!bottle) return '所选不死者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '须独立确认本次饮用这瓶原魔药；准备核对的确认不能替代。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未实际交付，或已经耗尽。';
    if (s.health <= 20 || s.mind <= 40) return '服药前须健康>20且精神>40；可0行动退出后正常休养，原预约和付费不回退。';
    if (s.progression.acting !== 100) return `看门人尚未完全消化，当前扮演${s.progression.acting}/100。`;
    if (s.gatekeeper.promotionWeek === null || gatekeeperWeeks(s) < UNDYING_MIN_GATEKEEPER_WEEKS) return `成为看门人后已度过${gatekeeperWeeks(s)}/12整周。`;
    if (!isValidGameDate(s.date) || s.date.year > 999939) return '当前日期无法登记六十年后的G预期周年。';
    return canConsumeUndyingRitual(s) ? null : '须本周亲自到原厅，由当前活着且自愿的乔里使用本次原包完成准备，并明确核对；缺席、离场、失效监督或旧窗口不能替代。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已交付，不能重复购买或追溯抵扣劳动。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= UNDYING_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the working copy supplied by the shared, atomic intent boundary. */
export function applyUndyingAcquisition(s: SliceState, command: UndyingAcquisitionCommand, c: SeerContext): void {
  rule(validateUndyingAcquisitionCommand(command), '不死者准备命令无效。');
  const blocked = undyingAcquisitionBlock(s, command); rule(blocked === null, blocked ?? '当前无法继续。');
  const state = s.undying;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1; s.cash -= UNDYING_PRICES.guidance; state.guidanceKnown = true;
      c.note('听取不死者专业指导方案G', `花1行动、520便士，向原导师${UNDYING_GUIDE}了解原瓶来源、专业监督准备与四档风险。${UNDYING_FORMULA_STATUS}${UNDYING_RITUAL_SOURCE}`); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!;
      s.actionsRemaining -= 1; bottle.labourSteps += 1;
      c.note(UNDYING_LABOUR_TASKS[bottle.labourSteps - 1]!, `为第${bottleNumber(bottle)}原瓶实际完成一次对应劳务，花1行动，现为${bottle.labourSteps}/5。完成五次仅抵本瓶5100便士，仍须支付1500便士；部分劳动不折现或转移。原瓶仍在供应方，不产生完整配方、仪式包或完成的仪式。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      c.note('不死者独立原瓶实际交付', `支付${paid}便士、0行动，实际取得${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五次劳动抵5100便士，另付1500便士。' : '原价6600便士，未完成五次劳动不部分抵扣。'}没有附送仪式包、完整配方或完成的仪式；尚未服用。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1; state.resupply.requestedWeek = s.week;
      c.note('申请后三瓶不死者成品', `现有全部原瓶已耗尽失败。花1行动核对原记录，最早第${s.week + 1}周实际到货三瓶；此刻没有新瓶。每瓶仍需6600便士或本瓶五次劳动后1500便士，旧原瓶与已用仪式包不会重置。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < UNDYING_BOTTLE_IDS.length; offset += 1) {
        const number = first + offset; state.bottles.push(freshBottle(`undying-potion-${number}`, deliverySource(number, s.week), s.week));
      }
      state.resupply.deliveries += 1; state.resupply.requestedWeek = null;
      c.note('后续三瓶不死者成品实际到货', `第${s.week}周，第${first}至${first + 2}独立原瓶实际入供应方库存，0行动，尚未付费交付。所有旧失败原瓶、仪式包及收尸人至看门人的既往实际历史、原灰羽约定与次数完整保留。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(item => item.id === command.bottleId)!, visit = currentUndyingVisit(s);
      rule(visit !== undefined && visit.windowWeek === s.week, '缺少本周原厅当前专业准备窗口。');
      const result = c.check('will', 28);
      bottle.status = 'CONSUMED'; bottle.consumedWeek = s.week; bottle.outcome = result.tier;
      bottle.ritualId = visit.id; bottle.ritualWindowWeek = visit.windowWeek;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mindCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind = Math.max(1, s.mind - mindCost); state.gatekeeperActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        state.lifecycle = { promotionDate: { ...s.date }, expectedCycleDate: expectedUndyingCycleDate(s.date), experiencedCycles: 0, status: 'REGISTERED_NOT_EXPERIENCED' };
        s.progression.sequence = 4; s.progression.acting = 0;
        for (const id of UNDYING_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        closeUndyingRitual(s, bottle.id);
        c.note('在当前专业准备窗口中成为不死者', `${bottle.id}于原厅本次预约${visit.id}耗尽。意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}；精神−${mindCost}、四属性各+1。看门人消化100与旧掌握保留，一项新掌握从0，灵性上限120但当前不补满，身体性别不变。本次唯一仪式包实际耗尽，你仍在原厅，须0行动沿普通出口实际离开；乔里位置不变。收尸人至看门人旧史、原灰羽及其全部真实约定和次数保留。已登记实际晋升日与六十年G预期周年，尚未经历任何周期性死亡或复活；普通死亡规则不变。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        closeUndyingRitual(s, bottle.id);
        c.note(severe ? '不死者魔药严重排异' : '不死者魔药排异', `${bottle.id}于${visit.id}耗尽；意志${result.roll}/${result.chance}，健康−${healthCost}、精神−${mindCost}、排异+${pollution}。本作G监督仅让此次药物排异保底1；仍为看门人，旧消化100、身体、原物事实、原灰羽及旧掌握完整保留。本次唯一仪式包实际耗尽，你仍在原厅，须0行动沿普通出口实际离开，乔里仍留原厅。可正常休养，另一原瓶须另付费预约、下一真实周取得新原包并重新到场；旧窗口不能重复使用。`);
      }
      return;
    }
  }
}
export function applyUndyingCommand(s: SliceState, command: UndyingCommand, c: SeerContext): void {
  rule(validateUndyingCommand(command), '不死者命令无效。');
  if (validateUndyingAcquisitionCommand(command)) return applyUndyingAcquisition(s, command, c);
  if (validateUndyingRitualCommand(command)) return applyUndyingRitualCommand(s, command, c);
  if (validateUndyingEncounterCommand(command)) return applyUndyingEncounter(s, command, c);
  throw new Error('不死者生活实践须由共享入口结算实际掌握与消化。');
}

export function projectUndying(s: SliceState): UndyingProjection {
  const state = s.undying, available = knownChannel(s), promoted = hasUndyingHistory(s), known = available && state.guidanceKnown, actions: UndyingAction[] = [];
  const add = (id: string, label: string, cost: string, command: UndyingAcquisitionCommand) => {
    const reason = undyingAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!known) add('learn-undying-guidance', '了解不死者成品、未知完整仪式与专业指导方案G', '1行动 · 520便士', { type: 'LEARN_GUIDANCE' });
    else {
      if (state.resupply.requestedWeek !== null) add('receive-undying-supply', '确认后三瓶成品实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周 · 尚须逐瓶付费`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-undying-supply', '申请后三瓶独立成品', '1行动 · 下一真实周起到货', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${UNDYING_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5100便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶不死者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 不附送仪式包`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `在当前专业准备窗口服用第${bottleNumber(bottle)}瓶`, `0行动 · 独立确认 · 看门人${s.progression.acting}/100 · ${gatekeeperWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  return {
    title: promoted ? '不死者 · 序列4' : '不死者之路', discovered: available, guidanceKnown: known, promoted,
    formulaKnown: false, formula: [], actions: available && s.progression.sequence!==3 && s.progression.sequence!==2 ? [...actions, ...undyingRitualActions(s), ...undyingLifeActions(s), ...undyingEncounterActions(s)] : [],
    bottles: known ? state.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 独立不死者成品`, source: `${bottle.source}${bottle.ritualId ? `第${bottle.ritualWindowWeek}周在原厅预约${bottle.ritualId}专业准备窗口服用；本次原包与原瓶均耗尽。` : ''}`,
      status: bottle.status === 'SUPPLIER' ? '原供应方持有，未交付' : bottle.status === 'PLAYER' ? '你实际持有，尚未服用' : `原瓶已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，仍为看门人' : '排异，仍为看门人'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? UNDYING_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: promoted ? ((s.progression.sequence===3||s.progression.sequence===2)?s.ferryman.undyingActingAtPromotion??100:s.progression.acting) : 0,
    digestion: promoted ? `看门人消化${state.gatekeeperActingAtPromotion}/100与原掌握保留；不死者扮演${(s.progression.sequence===3||s.progression.sequence===2)?s.ferryman.undyingActingAtPromotion:s.progression.acting}/100。` : available ? `看门人消化需100（当前${s.progression.acting}/100），晋升后满12整周（${gatekeeperWeeks(s)}/12）；当前专业准备与原封装包须另行完成，可选择保持看门人。` : '先完成看门人之路。',
    pollution: s.seer.pollution, risk: known ? UNDYING_CONSUMPTION_RISK : '先通过原导师了解不死者成品来源与实际仪式风险。',
    supplies: known ? `供应方持有${state.bottles.filter(bottle => bottle.status === 'SUPPLIER').length}瓶，你持有未用原瓶${state.bottles.filter(bottle => bottle.status === 'PLAYER').length}瓶。${state.resupply.requestedWeek === null ? `后续实际到货${state.resupply.deliveries}批。` : `第${state.resupply.requestedWeek}周申请，下一真实周起实际到货。`}成品配方仍未知，原瓶、付费预约与专业准备分别结算，旧仪式不能代替。` : '',
    ...(available ? { story: `${UNDYING_FORMULA_STATUS}${UNDYING_RITUAL_SOURCE}${UNDYING_SOURCE_STATUS}` } : {}),
    lifecycle: { ...state.lifecycle, promotionDate: state.lifecycle.promotionDate ? { ...state.lifecycle.promotionDate } : null, expectedCycleDate: state.lifecycle.expectedCycleDate ? { ...state.lifecycle.expectedCycleDate } : null,
      summary: state.lifecycle.status === 'CYCLE_DEAD' ? `原首六十年周年${formatGameDate(state.lifecycle.expectedCycleDate!)}已真实到达；原身体在供养居所周期性死亡，尚未复起（完成周期0次）。` : state.lifecycle.experiencedCycles === 1 ? `原晋升日${formatGameDate(state.lifecycle.promotionDate!)}与首周年${formatGameDate(state.lifecycle.expectedCycleDate!)}保留；已实际经历首次死亡与同一身体复起，完成周期1次。${state.lifecycle.status === 'PARTIAL_RECOVERY' ? '三个原来源已有限寻回，精神稳定；大量人生记忆仍未恢复。' : '当前部分失忆，须逐一实际寻回原来源。'}` : promoted ? `实际晋升：${formatGameDate(state.lifecycle.promotionDate!)}；G预期周年：${formatGameDate(state.lifecycle.expectedCycleDate!)}。六十年周期尚未实际经历（0次）；没有死亡、复活、失忆或恢复记忆的完成记录。` : '尚未晋升，未登记周期日期；六十年周期尚未实际经历。', boundary: known ? ((s.progression.sequence===3||s.progression.sequence===2)?'已经真实晋升摆渡人，原不死者周期诅咒不再触发；原登记、已发生周期与寻回记录保留，不提供普通战死复活。':UNDYING_LIFECYCLE_BOUNDARY) : '' },
    ritual: projectUndyingRitual(s), life: projectUndyingLife(s), encounter: projectUndyingEncounter(s),
    insideCase: hasUndyingRitualLock(s) || hasUndyingLifeLock(s) || hasUndyingEncounterLock(s),
    environment: available ? '原纪念工作室、乔里所在的持照纪念准备室UDY4-HALL、UDY4-ARCHIVE原档案室及普通净空庭院。原灰羽SG6-GRAY-FEATHER仍是原灵，旧约定、递信、入驻、派出、召回和木标记历史不重置或复制。' : '',
  };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateUndyingAcquisitionCommand(v: unknown): v is UndyingAcquisitionCommand {
  if (!record(v)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(String(v.type))) return shape(v, ['type']);
  if (typeof v.bottleId !== 'string' || !/^undying-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(String(v.type))) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isUndyingAcquisitionCommand = validateUndyingAcquisitionCommand;
export function validateUndyingCommand(v: unknown): v is UndyingCommand {
  return validateUndyingAcquisitionCommand(v) || validateUndyingRitualCommand(v) || validateUndyingActivityCommand(v) || validateUndyingEncounterCommand(v);
}
export function validateUndyingState(s: SliceState): boolean {
  try { return validateState(s); } catch { return false; }
}
function validateState(s: SliceState): boolean {
  const raw: unknown = s.undying;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'gatekeeperActingAtPromotion', 'lifecycle', 'ritual', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.gatekeeper) || !record(s.corpsecollector)) return false;
  const firstWeek = s.gatekeeper.promotionWeek ?? s.week, earliestConsumption = firstWeek + UNDYING_MIN_GATEKEEPER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - earliestConsumption))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, earliestConsumption, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1)) return false;
  const state = raw as unknown as UndyingState, promoted = hasUndyingHistory(s), latestAcquisition = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.gatekeeper.promotionWeek, 1, s.week) || !integer(state.promotionWeek, earliestConsumption, s.week) || state.gatekeeperActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS, ...SPIRIT_GUIDE_ABILITY_IDS, ...GATEKEEPER_ABILITY_IDS, ...UNDYING_ABILITY_IDS,...((s.progression.sequence===3||s.progression.sequence===2)?FERRYMAN_ABILITY_IDS:[]),...(s.progression.sequence===2?DEATH_CONSUL_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.gatekeeperActingAtPromotion !== null || UNDYING_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome', 'ritualId', 'ritualWindowWeek']) || bottle.id !== `undying-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  if (!validateUndyingLifecycle(state.lifecycle, s, promoted)) return false;
  if (!validateUndyingRitualState(s) || !validateUndyingLife(s) || !validateUndyingEncounter(s)) return false;
  let successes = 0;
  const usedVisits = new Set<string>();
  for (const [index, bottle] of state.bottles.entries()) {
    if (index < 3) {
      if (bottle.stockedWeek !== null || bottle.source !== UNDYING_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(bottle.stockedWeek, earliestConsumption + 1, latestAcquisition) || bottle.source !== deliverySource(index + 1, bottle.stockedWeek)) return false;
      const start = Math.floor(index / 3) * 3;
      if (bottle.stockedWeek !== state.bottles[start]!.stockedWeek || state.bottles.slice(0, start).some(old => old.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(old.outcome ?? '') || !integer(old.consumedWeek, earliestConsumption, bottle.stockedWeek! - 1))) return false;
    }
    const stockWeek = bottle.stockedWeek ?? firstWeek;
    if (!state.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(bottle.acquiredWeek, stockWeek, latestAcquisition)) return false;
      if (bottle.status === 'PLAYER') { if (bottle.consumedWeek !== null || bottle.outcome !== null) return false; }
      else if (bottle.status === 'CONSUMED') {
        if (!integer(s.gatekeeper.promotionWeek, 1, s.week) || !integer(bottle.consumedWeek, Math.max(earliestConsumption, bottle.acquiredWeek), latestAcquisition) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome ?? '')) return false;
        if (!promoted && s.progression.acting !== 100) return false;
        if (typeof bottle.ritualId !== 'string' || usedVisits.has(bottle.ritualId) || bottle.ritualWindowWeek !== bottle.consumedWeek) return false;
        usedVisits.add(bottle.ritualId);
        const visit = state.ritual.visits.find(item => item.id === bottle.ritualId);
        if (!visit || visit.consumedBottleId !== bottle.id || visit.windowWeek !== bottle.consumedWeek || (visit.closedWeek !== null && visit.closedWeek !== bottle.consumedWeek) || !['OPEN', 'CLOSED'].includes(visit.status)) return false;
      } else return false;
    }
    if (bottle.status !== 'CONSUMED' && (bottle.ritualId !== null || bottle.ritualWindowWeek !== null)) return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') { successes += 1; if (bottle.consumedWeek !== state.promotionWeek) return false; }
  }
  if (state.ritual.visits.some(visit => visit.consumedBottleId !== null && !state.bottles.some(bottle => bottle.id === visit.consumedBottleId && bottle.ritualId === visit.id && bottle.status === 'CONSUMED'))) return false;
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || promoted || !exhaustedSupply(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0);
}

/** A G anniversary record only. No time is advanced and no death or revival is executed. */
export function expectedUndyingCycleDate(date: PublicGameDate): PublicGameDate {
  rule(isValidGameDate(date) && date.year <= 999939, '无法登记六十年后的G预期周年。');
  const year = date.year + 60;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return { epoch: 'FIFTH_EPOCH', year, month: date.month, day: date.month === 2 && date.day === 29 && !leap ? 28 : date.day };
}
function validateUndyingLifecycle(value: unknown, s: SliceState, promoted: boolean): value is UndyingLifecycle {
  if (!record(value) || !shape(value, ['promotionDate', 'expectedCycleDate', 'experiencedCycles', 'status']) || ![0, 1].includes(value.experiencedCycles as number)) return false;
  if (!promoted) return value.status === 'NOT_PROMOTED' && value.promotionDate === null && value.expectedCycleDate === null && value.experiencedCycles === 0;
  if (!isValidGameDate(value.promotionDate) || !isValidGameDate(value.expectedCycleDate) || !isValidGameDate(s.date) || compareGameDates(value.promotionDate, s.date) > 0 || value.promotionDate.year > 999939 || compareGameDates(expectedUndyingCycleDate(value.promotionDate), value.expectedCycleDate) !== 0) return false;
  if (value.status === 'REGISTERED_NOT_EXPERIENCED') return value.experiencedCycles === 0 && !s.longChapter?.cycleDeathDate;
  const l = s.longChapter;
  if (!l || l.phase !== value.status || !l.cycleDeathDate || compareGameDates(l.cycleDeathDate, value.expectedCycleDate) !== 0 || !l.body || l.body.id !== `${s.runId}:body`) return false;
  if (value.status === 'CYCLE_DEAD') return value.experiencedCycles === 0 && s.status === 'ACTIVE' && s.health === 0 && l.revivedDate === null;
  return ['AMNESIAC', 'PARTIAL_RECOVERY'].includes(String(value.status)) && value.experiencedCycles === 1 && l.revivedDate !== null && (l.handoff !== null && l.phase === 'PARTIAL_RECOVERY' || s.health > 0 && s.status === 'ACTIVE');
}

export { UNDYING_ABILITIES } from './content.js';
export { createUndyingRitualState, currentUndyingVisit, hasUndyingRitualLock, canConsumeUndyingRitual, closeUndyingRitual, validateUndyingRitualState, validateUndyingRitualCommand, applyUndyingRitualCommand, undyingRitualActions, projectUndyingRitual } from './ritual.js';
export type * from './types.js';
