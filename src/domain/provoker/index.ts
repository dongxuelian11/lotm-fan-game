import { CONQUEROR_ABILITY_IDS } from '../conqueror/types.js';
import {WEATHER_WARLOCK_ABILITY_IDS} from '../weather-warlock/types.js';
import { WAR_BISHOP_ABILITY_IDS } from '../war-bishop/types.js';
import { IRON_BLOOD_KNIGHT_ABILITY_IDS } from '../iron-blood-knight/types.js';
import {REAPER_ABILITY_IDS} from '../reaper/types.js';
import {CONSPIRATOR_ABILITY_IDS} from '../conspirator/types.js';
import {PYROMANIAC_ABILITIES} from '../pyromaniac/content.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { HUNTER_ABILITY_IDS } from '../hunter/types.js';
import {
  PROVOKER_ABILITIES, PROVOKER_BOTTLE_IDS, PROVOKER_CONSUMPTION_RISK, PROVOKER_FORMULA_STATUS,
  PROVOKER_GUIDE, PROVOKER_LABOUR_TASKS, PROVOKER_MIN_HUNTER_WEEKS, PROVOKER_POTION_SOURCES, PROVOKER_PRICES,
} from './content.js';
import {
  PROVOKER_ABILITY_IDS, PROVOKER_CASE_IDS, type ProvokerAcquisitionCommand, type ProvokerAction,
  type ProvokerBottle, type ProvokerProjection, type ProvokerState,
} from './types.js';

export function createProvokerState(): ProvokerState {
  return {
    guidanceKnown: false,
    bottles: PROVOKER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, hunterActingAtPromotion: null,
    cases: Object.fromEntries(PROVOKER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, choice: null }])),
    reflected: false,
    encounter: { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null, enemyStatus: 'RESISTING' },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hunter' && (s.progression.sequence === 8||s.progression.sequence === 7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))));
const isHunter = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.hunter.discovered && s.hunter.guidanceKnown && (isHunter(s) || promoted(s));
const potionPrice = (bottle: ProvokerBottle) => PROVOKER_PRICES.potion - (bottle.labourSteps === 3 ? PROVOKER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ProvokerBottle) => Number(bottle.id.slice('provoker-potion-'.length));
const hunterWeeks = (s: SliceState) => Math.max(0, (s.provoker.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const supplyExhausted = (state: ProvokerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${PROVOKER_GUIDE}的新仓库渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列8挑衅者魔药，原瓶provoker-potion-${number}，非猎人旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: ProvokerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原仓库，找到索伦。';
  if (!knownChannel(s)) return '成为猎人并保有索伦的指导渠道后，才能继续挑衅者之路。';
  if (promoted(s)) return '你已完成挑衅者晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.provoker.guidanceKnown) return '已经听过挑衅者成品魔药的用药说明。';
    return s.cash < PROVOKER_PRICES.guidance ? '挑衅者用药指导需要180便士。' : null;
  }
  if (!s.provoker.guidanceKnown) return '先听索伦说明这批序列8原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.provoker.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.provoker) ? null : '须先用完现有全部挑衅者原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.provoker.resupply.requestedWeek === null) return '尚未申请下一批挑衅者补给。';
    if (s.week <= s.provoker.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.provoker) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.provoker.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选挑衅者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `猎人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || hunterWeeks(s) < PROVOKER_MIN_HUNTER_WEEKS) return `成为猎人后已度过${hunterWeeks(s)}/${PROVOKER_MIN_HUNTER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 3 ? '这瓶对应的三次仓库劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyProvokerCommand(s: SliceState, command: ProvokerAcquisitionCommand, c: SeerContext): void {
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= PROVOKER_PRICES.guidance;
      s.provoker.guidanceKnown = true;
      c.note('听取挑衅者用药说明', `花费1行动、180便士，${PROVOKER_GUIDE}向你说明从新仓库渠道实际取得的三瓶序列8成品、逐瓶交付与四档风险。这些不是原来的猎人存药。${PROVOKER_FORMULA_STATUS}猎人消化须达100，首次晋升猎人后满6整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.provoker.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = PROVOKER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在索伦的原仓库实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/3，原瓶仍由导师保管。${bottle.labourSteps === 3 ? '三次劳务只抵这瓶1200便士，仍须实际支付170便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应三次劳务后才能抵这瓶1200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.provoker.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('挑衅者原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列8成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 3 ? '对应三次仓库劳务抵扣1200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；猎人消化100且首次晋升后满6整周时，再独立确认服药。${PROVOKER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.provoker.resupply.requestedWeek = s.week;
      c.note('申请下一批挑衅者魔药', `现有挑衅者原瓶全部耗尽且未晋升。你花费1行动，请${PROVOKER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原仓库的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付1370便士，或分别完成三次劳务后支付170便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.provoker.bottles.length + 1;
      s.provoker.resupply.deliveries += 1;
      for (let offset = 0; offset < PROVOKER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.provoker.bottles.push({ id: `provoker-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.provoker.resupply.requestedWeek = null;
      c.note('下一批挑衅者原瓶到货', `第${s.week}周，索伦的新仓库渠道本作G成品供给第${s.provoker.resupply.deliveries + 1}批三瓶实际到货，原瓶provoker-potion-${firstNumber}至provoker-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按1370便士购买，或完成对应三次劳务再付170便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.provoker.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.provoker.hunterActingAtPromotion = s.progression.acting;
        s.provoker.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of PROVOKER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 2], ['will', 3], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为挑衅者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+2、意志+3、知识+1。四项猎人能力及掌握完整继承，挑衅与敌意吸引从0掌握开始；猎人消化成果和首次晋升周保留，挑衅者扮演从0开始。灵性上限提高到45，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了挑衅者晋升' : '挑衅者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是猎人，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectProvoker(s: SliceState): ProvokerProjection {
  const actions: ProvokerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: ProvokerAcquisitionCommand) => {
    if (isPromoted && (s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))) return;
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.provoker.guidanceKnown) add('learn-provoker-guidance', '请索伦说明挑衅者成品与风险', '1行动 · 180便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.provoker.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 3) add(`work-${bottle.id}`, `第${number}瓶 · ${PROVOKER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/3，完成三次抵该瓶1200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶挑衅者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列8原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.provoker.resupply.requestedWeek !== null) add('receive-provoker-supply', '确认下一批三瓶挑衅者到货', `0行动 · 第${s.provoker.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.provoker)) add('request-provoker-supply', '向索伦订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.provoker.guidanceKnown) {
    for (const bottle of s.provoker.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶挑衅者魔药`, `0行动 · 独立确认 · 猎人消化${isPromoted ? s.provoker.hunterActingAtPromotion : s.progression.acting}/100 · 晋升后${hunterWeeks(s)}/6整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.provoker.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.provoker.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '挑衅者 · 序列8' : '挑衅者之路', discovered: available,
    guidanceKnown: available && s.provoker.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [],
    supplies: available ? `${PROVOKER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.provoker.resupply.requestedWeek === null ? `已实际接收后续供给${s.provoker.resupply.deliveries}批。` : `第${s.provoker.resupply.requestedWeek}周提出请求，第${s.provoker.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.provoker.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 挑衅者魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/3`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? PROVOKER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?s.pyromaniac.provokerActingAtPromotion??100:s.progression.acting) : 0,
    digestion: s.progression.pathwayId==='hunter'&&(s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?'挑衅者魔药已消化，原实践和两项能力保留。':isPromoted ? `猎人消化成果${s.provoker.hunterActingAtPromotion}/100已保留；挑衅者扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成猎人消化（${s.progression.acting}/100），并在首次晋升猎人后度过6整周（${hunterWeeks(s)}/6）。用药指导与原瓶可以提前准备。` : '先走完猎人之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应三次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${PROVOKER_CONSUMPTION_RISK}` : '成为猎人后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Acquisition owns bottle identity and promotion chronology; adventure owns case/encounter history. */
export function validateProvokerState(s: SliceState): boolean {
  const raw: unknown = s.provoker;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'hunterActingAtPromotion', 'cases', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.hunter)) return false;
  const firstHunterWeek = s.progression.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstHunterWeek + PROVOKER_MIN_HUNTER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== PROVOKER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, PROVOKER_CASE_IDS)) return false;
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'choice']) || !['AVAILABLE', 'OBSERVED', 'COMPLETED'].includes(value.status as string)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, 1, s.week) || value.choice !== null && !['CHALLENGE', 'DEESCALATE', 'ATTRACT', 'WAIT'].includes(value.choice as string)) return false;
  }
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'attemptWeek', 'startHistoryIndex', 'enemyStatus'])) return false;
  if (!['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(raw.encounter.enemyStatus as string)) return false;
  if (raw.encounter.attemptWeek !== null && !integer(raw.encounter.attemptWeek, 1, s.week) || raw.encounter.startHistoryIndex !== null && !integer(raw.encounter.startHistoryIndex, 0, s.combatHistory.length)) return false;
  const provoker = raw as unknown as ProvokerState, isPromoted = promoted(s);
  if (provoker.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!provoker.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(provoker.promotionWeek, firstConsumptionWeek, s.week) || provoker.hunterActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence === 1 ? CONQUEROR_ABILITY_IDS : []),...((s.progression.sequence===2||s.progression.sequence===1)?WEATHER_WARLOCK_ABILITY_IDS:[]),...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?PYROMANIAC_ABILITIES.map(a=>a.id):[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?CONSPIRATOR_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?REAPER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?IRON_BLOOD_KNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?WAR_BISHOP_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (provoker.promotionWeek !== null || provoker.hunterActingAtPromotion !== null || PROVOKER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (provoker.reflected || Object.values(provoker.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.choice !== null)) return false;
    if (provoker.encounter.status !== 'AVAILABLE' || provoker.encounter.attemptWeek !== null || provoker.encounter.startHistoryIndex !== null || provoker.encounter.enemyStatus !== 'RESISTING') return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of provoker.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `provoker-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 3)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of provoker.bottles.entries()) {
    let stockWeek = firstHunterWeek;
    if (index < PROVOKER_BOTTLE_IDS.length) {
      if (bottle.source !== PROVOKER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!provoker.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / PROVOKER_BOTTLE_IDS.length) - 1;
      if (index % PROVOKER_BOTTLE_IDS.length === 0) {
        const previous = provoker.bottles.slice(index - PROVOKER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > provoker.promotionWeek!) return false;
    }
    if (!provoker.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > provoker.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > provoker.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== provoker.promotionWeek) return false;
    }
  }
  if (provoker.resupply.requestedWeek !== null && (!provoker.guidanceKnown || isPromoted || !supplyExhausted(provoker) || provoker.bottles.some(bottle => bottle.consumedWeek! > provoker.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}
