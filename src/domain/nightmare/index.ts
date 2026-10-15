import { MISFORTUNE_KNIGHT_ABILITY_IDS } from '../misfortune-knight/types.js';
import { CONCEALMENT_SERVANT_ABILITY_IDS } from '../concealment-servant/types.js';
import {FEAR_BISHOP_ABILITY_IDS} from '../fear-bishop/types.js';
import {NIGHTWATCHER_ABILITY_IDS} from '../nightwatcher/types.js';
import {SPIRIT_WARLOCK_ABILITY_IDS} from '../spirit-warlock/types.js';
import {SOOTHER_ABILITY_IDS} from '../soother/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SLEEPLESS_ABILITY_IDS } from '../sleepless/types.js';
import { MIDNIGHT_ABILITY_IDS } from '../midnight/types.js';
import {
  NIGHTMARE_ABILITIES, NIGHTMARE_BOTTLE_IDS, NIGHTMARE_CONSUMPTION_RISK, NIGHTMARE_FORMULA_STATUS,
  NIGHTMARE_GUIDE, NIGHTMARE_LABOUR_TASKS, NIGHTMARE_MIN_MIDNIGHT_WEEKS, NIGHTMARE_POTION_SOURCES, NIGHTMARE_PRICES,
} from './content.js';
import {
  NIGHTMARE_ABILITY_IDS, NIGHTMARE_CASE_IDS, type NightmareAcquisitionCommand, type NightmareAction,
  type NightmareBottle, type NightmareCommand, type NightmareProjection, type NightmareState,
} from './types.js';

export function createNightmareState(): NightmareState {
  return {
    guidanceKnown: false,
    bottles: NIGHTMARE_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, midnightActingAtPromotion: null,
    cases: Object.fromEntries(NIGHTMARE_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, dreamRecord: null }])),
    reflected: false,
    encounter: { status: 'AVAILABLE', observed: false, bystanderCleared: false, attemptWeek: null, startHistoryIndex: null, pressure: 0, dreamLocked: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'darkness' && (s.progression.sequence === 7||(s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0))));
const isMidnight = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.sleepless.discovered && s.sleepless.guidanceKnown && s.midnight.guidanceKnown && (isMidnight(s) || promoted(s));
const potionPrice = (bottle: NightmareBottle) => NIGHTMARE_PRICES.potion - (bottle.labourSteps === 4 ? NIGHTMARE_PRICES.labourCredit : 0);
const bottleNumber = (bottle: NightmareBottle) => Number(bottle.id.slice('nightmare-potion-'.length));
const midnightWeeks = (s: SliceState) => Math.max(0, (s.nightmare.promotionWeek ?? s.week) - (s.midnight.promotionWeek ?? s.week));
const supplyExhausted = (state: NightmareState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${NIGHTMARE_GUIDE}的新夜间协助交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列7梦魇魔药，原瓶nightmare-potion-${number}，非不眠者或午夜诗人旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: NightmareAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原值班室，找到赛琳。';
  if (!knownChannel(s)) return '成为午夜诗人并保有赛琳的指导渠道后，才能继续梦魇之路。';
  if (promoted(s)) return '你已完成梦魇晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.nightmare.guidanceKnown) return '已经听过梦魇成品魔药的用药说明。';
    return s.cash < NIGHTMARE_PRICES.guidance ? '梦魇用药指导需要240便士。' : null;
  }
  if (!s.nightmare.guidanceKnown) return '先听赛琳说明这批序列7原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.nightmare.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.nightmare) ? null : '须先用完现有全部梦魇原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.nightmare.resupply.requestedWeek === null) return '尚未申请下一批梦魇补给。';
    if (s.week <= s.nightmare.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.nightmare) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.nightmare.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选梦魇原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `午夜诗人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.midnight.promotionWeek === null || midnightWeeks(s) < NIGHTMARE_MIN_MIDNIGHT_WEEKS) return `成为午夜诗人后已度过${midnightWeeks(s)}/${NIGHTMARE_MIN_MIDNIGHT_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 4 ? '这瓶对应的四次值班室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyNightmareCommand(s: SliceState, command: NightmareAcquisitionCommand, c: SeerContext): void {
  rule(validateNightmareCommand(command) && isNightmareAcquisitionCommand(command), '梦魇准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= NIGHTMARE_PRICES.guidance;
      s.nightmare.guidanceKnown = true;
      c.note('听取梦魇用药说明', `花费1行动、240便士，${NIGHTMARE_GUIDE}向你说明从新夜间协助交接渠道实际取得的三瓶序列7成品、逐瓶交付与四档风险。这些不是原来的午夜诗人存药。${NIGHTMARE_FORMULA_STATUS}午夜诗人消化须达100，晋升午夜诗人后满8整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.nightmare.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = NIGHTMARE_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在赛琳的原值班室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/4，原瓶仍由导师保管。${bottle.labourSteps === 4 ? '四次劳务只抵这瓶1800便士，仍须实际支付210便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应四次劳务后才能抵这瓶1800便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.nightmare.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('梦魇原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列7成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 4 ? '对应四次值班室劳务抵扣1800便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；午夜诗人消化100且晋升后满8整周时，再独立确认服药。${NIGHTMARE_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.nightmare.resupply.requestedWeek = s.week;
      c.note('申请下一批梦魇魔药', `现有梦魇原瓶全部耗尽且未晋升。你花费1行动，请${NIGHTMARE_GUIDE}从同一新渠道订下一批三瓶，并实际核验原值班室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付2010便士，或分别完成四次劳务后支付210便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.nightmare.bottles.length + 1;
      s.nightmare.resupply.deliveries += 1;
      for (let offset = 0; offset < NIGHTMARE_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.nightmare.bottles.push({ id: `nightmare-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.nightmare.resupply.requestedWeek = null;
      c.note('下一批梦魇原瓶到货', `第${s.week}周，赛琳的新夜间协助交接渠道本作G成品供给第${s.nightmare.resupply.deliveries + 1}批三瓶实际到货，原瓶nightmare-potion-${firstNumber}至nightmare-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按2010便士购买，或完成对应四次劳务再付210便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.nightmare.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.nightmare.midnightActingAtPromotion = s.progression.acting;
        s.nightmare.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of NIGHTMARE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 2], ['will', 4], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为梦魇', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+2、意志+4、知识+1。三项不眠者与两项午夜诗人能力及掌握完整继承，有限入梦与梦境记录核实从0掌握开始；午夜诗人消化成果和晋升周保留，梦魇扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了梦魇晋升' : '梦魇魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是午夜诗人，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectNightmare(s: SliceState): NightmareProjection {
  const actions: NightmareAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: NightmareAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.nightmare.guidanceKnown) add('learn-nightmare-guidance', '请赛琳说明梦魇成品与风险', '1行动 · 240便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.nightmare.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 4) add(`work-${bottle.id}`, `第${number}瓶 · ${NIGHTMARE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/4，完成四次抵该瓶1800便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶梦魇魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列7原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.nightmare.resupply.requestedWeek !== null) add('receive-nightmare-supply', '确认下一批三瓶梦魇到货', `0行动 · 第${s.nightmare.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.nightmare)) add('request-nightmare-supply', '向赛琳订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.nightmare.guidanceKnown) {
    for (const bottle of s.nightmare.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶梦魇魔药`, `0行动 · 独立确认 · 午夜诗人消化${isPromoted ? s.nightmare.midnightActingAtPromotion : s.progression.acting}/100 · 晋升后${midnightWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.nightmare.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.nightmare.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '梦魇 · 序列7' : '梦魇之路', discovered: available,
    guidanceKnown: available && s.nightmare.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '',
    supplies: available ? `${NIGHTMARE_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.nightmare.resupply.requestedWeek === null ? `已实际接收后续供给${s.nightmare.resupply.deliveries}批。` : `第${s.nightmare.resupply.requestedWeek}周提出请求，第${s.nightmare.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.nightmare.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 梦魇魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/4`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? NIGHTMARE_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)))?s.soother.nightmareActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)))?'梦魇魔药已消化，原梦境与现实复核记录保留。':isPromoted ? `午夜诗人消化成果${s.nightmare.midnightActingAtPromotion}/100已保留；梦魇扮演${s.progression.acting}/100，能力掌握分别记录。人类服药后仍须消化，也不会自动获得教会或其它组织身份。`
      : available ? `服药前需完成午夜诗人消化（${s.progression.acting}/100），并在晋升午夜诗人后度过8整周（${midnightWeeks(s)}/8）。用药指导与原瓶可以提前准备。` : '先走完午夜诗人之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应四次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${NIGHTMARE_CONSUMPTION_RISK}` : '成为午夜诗人后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isNightmareAcquisitionCommand(command: unknown): command is NightmareAcquisitionCommand {
  return validateNightmareCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateNightmareCommand(value: unknown): value is NightmareCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'OBSERVE_ENCOUNTER', 'CLEAR_BYSTANDER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^nightmare-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^nightmare-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PREPARE', 'SESSION', 'VERIFY', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && NIGHTMARE_CASE_IDS.includes(value.caseId as typeof NIGHTMARE_CASE_IDS[number]);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions and encounter history. */
export function validateNightmareState(s: SliceState): boolean {
  const raw: unknown = s.nightmare;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'midnightActingAtPromotion', 'cases', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.sleepless) || !record(s.midnight)) return false;
  const firstMidnightWeek = s.midnight.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstMidnightWeek + NIGHTMARE_MIN_MIDNIGHT_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== NIGHTMARE_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, NIGHTMARE_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'dreamRecord'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'DREAM_RECORDED', 'RESOLVED', 'WITHDRAWN'].includes(value.status as string) || value.dreamRecord !== null && (typeof value.dreamRecord !== 'string' || value.dreamRecord.length === 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'observed', 'bystanderCleared', 'attemptWeek', 'startHistoryIndex', 'pressure', 'dreamLocked'])) return false;
  if (!['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string) || typeof raw.encounter.observed !== 'boolean' || typeof raw.encounter.bystanderCleared !== 'boolean' || !integer(raw.encounter.pressure, 0, 2) || typeof raw.encounter.dreamLocked !== 'boolean') return false;
  if (raw.encounter.attemptWeek !== null && !integer(raw.encounter.attemptWeek, firstActivityWeek, s.week)) return false;
  if (raw.encounter.startHistoryIndex !== null && !integer(raw.encounter.startHistoryIndex, 0, s.combatHistory.length)) return false;
  const nightmare = raw as unknown as NightmareState, isPromoted = promoted(s);
  if (nightmare.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!nightmare.guidanceKnown || !integer(s.midnight.promotionWeek, 9, s.week) || !integer(nightmare.promotionWeek, firstConsumptionWeek, s.week) || nightmare.midnightActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?MISFORTUNE_KNIGHT_ABILITY_IDS:[]),...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS, ...NIGHTMARE_ABILITY_IDS,...((s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)))?SOOTHER_ABILITY_IDS:[]),...((s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)))?SPIRIT_WARLOCK_ABILITY_IDS:[]),...(([4, 3, 2, 1].includes(s.progression.sequence ?? 0))?NIGHTWATCHER_ABILITY_IDS:[]),...([3, 2, 1].includes(s.progression.sequence ?? 0) ? FEAR_BISHOP_ABILITY_IDS : []),...((s.progression.sequence === 2||s.progression.sequence===1) ? CONCEALMENT_SERVANT_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (nightmare.promotionWeek !== null || nightmare.midnightActingAtPromotion !== null || NIGHTMARE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (nightmare.reflected || Object.values(nightmare.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.dreamRecord !== null)
      || nightmare.encounter.status !== 'AVAILABLE' || nightmare.encounter.observed || nightmare.encounter.bystanderCleared
      || nightmare.encounter.attemptWeek !== null || nightmare.encounter.startHistoryIndex !== null || nightmare.encounter.pressure !== 0 || nightmare.encounter.dreamLocked) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of nightmare.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `nightmare-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 4)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of nightmare.bottles.entries()) {
    let stockWeek = firstMidnightWeek;
    if (index < NIGHTMARE_BOTTLE_IDS.length) {
      if (bottle.source !== NIGHTMARE_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!nightmare.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / NIGHTMARE_BOTTLE_IDS.length) - 1;
      if (index % NIGHTMARE_BOTTLE_IDS.length === 0) {
        const previous = nightmare.bottles.slice(index - NIGHTMARE_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > nightmare.promotionWeek!) return false;
    }
    if (!nightmare.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > nightmare.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > nightmare.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== nightmare.promotionWeek) return false;
    }
  }
  if (nightmare.resupply.requestedWeek !== null && (!nightmare.guidanceKnown || isPromoted || !supplyExhausted(nightmare) || nightmare.bottles.some(bottle => bottle.consumedWeek! > nightmare.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { NIGHTMARE_ABILITIES } from './content.js';
export type * from './types.js';
