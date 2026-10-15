import { FATE_PROPHET_ABILITY_IDS } from '../fate-prophet/types.js';
import {CHAOS_WALKER_ABILITY_IDS} from '../chaos-walker/types.js';
import {MISFORTUNE_MAGE_ABILITY_IDS} from '../misfortune-mage/types.js';
import {WINNER_ABILITY_IDS} from '../winner/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { MONSTER_ABILITY_IDS } from '../monster/types.js';
import { MACHINE_ABILITY_IDS } from '../machine/types.js';
import { validateCalamityPriestLife } from './life.js';
import { LUCKY_ABILITY_IDS } from '../lucky/types.js';
import {
  CALAMITY_PRIEST_ABILITIES, CALAMITY_PRIEST_BOTTLE_IDS, CALAMITY_PRIEST_CONSUMPTION_RISK, CALAMITY_PRIEST_FORMULA_STATUS,
  CALAMITY_PRIEST_GUIDE, CALAMITY_PRIEST_LABOUR_TASKS, CALAMITY_PRIEST_MIN_LUCKY_WEEKS, CALAMITY_PRIEST_POTION_SOURCES, CALAMITY_PRIEST_PRICES, CALAMITY_PRIEST_SOURCE_STATUS,
} from './content.js';
import {
  CALAMITY_PRIEST_ABILITY_IDS, CALAMITY_PRIEST_CASE_IDS, type CalamityPriestAcquisitionCommand, type CalamityPriestAction,
  type CalamityPriestBottle, type CalamityPriestCommand, type CalamityPriestProjection, type CalamityPriestState,
} from './types.js';

export function createCalamityPriestState(): CalamityPriestState {
  return {
    guidanceKnown: false,
    bottles: CALAMITY_PRIEST_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, luckyActingAtPromotion: null,
    cases: Object.fromEntries(CALAMITY_PRIEST_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { hazard: 'UNASSESSED', board: 'RESTING', contact: 'NONE' },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'wheel' && (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isLucky = (s: SliceState) => s.progression.pathwayId === 'wheel' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.monster.discovered && s.monster.guidanceKnown && s.machine.guidanceKnown && s.lucky.guidanceKnown && s.lucky.promotionWeek !== null && (isLucky(s) || promoted(s));
const potionPrice = (bottle: CalamityPriestBottle) => CALAMITY_PRIEST_PRICES.potion - (bottle.labourSteps === 5 ? CALAMITY_PRIEST_PRICES.labourCredit : 0);
const bottleNumber = (bottle: CalamityPriestBottle) => Number(bottle.id.slice('calamity-priest-potion-'.length));
const luckyWeeks = (s: SliceState) => Math.max(0, (s.calamityPriest.promotionWeek ?? s.week) - (s.lucky.promotionWeek ?? s.week));
const supplyExhausted = (state: CalamityPriestState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${CALAMITY_PRIEST_GUIDE}的独立灾祸教士成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6灾祸教士魔药，原瓶calamity-priest-potion-${number}，非怪物、机器或幸运者旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: CalamityPriestAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.calamityPriest.cases).some(value => value.contactOpen)) return '先实际结束本次灾祸教士实践的接触，再继续。';
  if (Object.values(s.lucky.cases).some(value => value.contactOpen) || Object.values(s.machine.cases).some(value => value.contactOpen) || Object.values(s.monster.cases).some(value => value.contactOpen)) return '先实际结束原序列尚未收束的接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原报时铺，找到艾妲·芬恩。';
  if (!knownChannel(s)) return '成为幸运者并保有艾妲·芬恩的指导渠道后，才能继续了解灾祸教士之路。';
  if (promoted(s)) return '你已完成灾祸教士晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.calamityPriest.guidanceKnown) return '已经听过灾祸教士成品魔药的用药说明。';
    return s.cash < CALAMITY_PRIEST_PRICES.guidance ? '灾祸教士用药指导需要360便士。' : null;
  }
  if (!s.calamityPriest.guidanceKnown) return '先听艾妲·芬恩说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.calamityPriest.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.calamityPriest) ? null : '须先用完现有全部灾祸教士原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.calamityPriest.resupply.requestedWeek === null) return '尚未申请下一批灾祸教士补给。';
    if (s.week <= s.calamityPriest.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.calamityPriest) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.calamityPriest.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选灾祸教士原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `幸运者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.lucky.promotionWeek === null || luckyWeeks(s) < CALAMITY_PRIEST_MIN_LUCKY_WEEKS) return `成为幸运者后已度过${luckyWeeks(s)}/${CALAMITY_PRIEST_MIN_LUCKY_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原报时铺劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyCalamityPriestCommand(s: SliceState, command: CalamityPriestAcquisitionCommand, c: SeerContext): void {
  rule(validateCalamityPriestCommand(command) && isCalamityPriestAcquisitionCommand(command), '灾祸教士准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= CALAMITY_PRIEST_PRICES.guidance;
      s.calamityPriest.guidanceKnown = true;
      c.note('听取灾祸教士用药说明', `花费1行动、360便士，你向已认识的本作原创成年${CALAMITY_PRIEST_GUIDE}继续请教，她向你说明从独立灾祸教士成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的怪物、机器或幸运者存药。${CALAMITY_PRIEST_FORMULA_STATUS}幸运者消化须达100，晋升幸运者后满12整周才能服用；可提前筹备。${CALAMITY_PRIEST_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.calamityPriest.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = CALAMITY_PRIEST_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在艾妲·芬恩的原报时铺实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.calamityPriest.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('灾祸教士原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原报时铺劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；幸运者消化100且晋升幸运者后满12整周时，再独立确认服药。${CALAMITY_PRIEST_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.calamityPriest.resupply.requestedWeek = s.week;
      c.note('申请下一批灾祸教士魔药', `现有灾祸教士原瓶全部耗尽且未晋升。你花费1行动，请${CALAMITY_PRIEST_GUIDE}从同一新渠道订下一批三瓶，并实际核验原报时铺的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.calamityPriest.bottles.length + 1;
      s.calamityPriest.resupply.deliveries += 1;
      for (let offset = 0; offset < CALAMITY_PRIEST_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.calamityPriest.bottles.push({ id: `calamity-priest-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.calamityPriest.resupply.requestedWeek = null;
      c.note('下一批灾祸教士原瓶到货', `第${s.week}周，艾妲·芬恩的独立灾祸教士成品交接渠道本作G成品供给第${s.calamityPriest.resupply.deliveries + 1}批三瓶实际到货，原瓶calamity-priest-potion-${firstNumber}至calamity-priest-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.calamityPriest.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.calamityPriest.luckyActingAtPromotion = s.progression.acting;
        s.calamityPriest.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of CALAMITY_PRIEST_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为灾祸教士', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。怪物、机器与幸运者全部原能力及原ID掌握完整继承，只新增灾祸察觉、招灾与精神风暴三项，从0掌握开始；幸运者消化成果与幸运者晋升周保留，灾祸教士扮演从0开始。灵性上限提高到80，当前灵性没有补满。不赠资源；察觉仍需现实核实，主动招灾可能波及自己与同伴，幸运只可帮助避开大部分灾祸，不能保证无伤。精神风暴只造成有限眩晕或混乱，不控制意愿或改写记忆；没有序列5幸运储存与主动控运。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了灾祸教士晋升' : '灾祸教士魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是幸运者，消化与全部原有掌握保留，没有获得灾祸教士能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectCalamityPriest(s: SliceState): CalamityPriestProjection {
  const actions: CalamityPriestAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.winner.calamityPriestActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: CalamityPriestAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.calamityPriest.guidanceKnown) add('learn-calamity-priest-guidance', '请艾妲·芬恩说明灾祸教士成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.calamityPriest.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${CALAMITY_PRIEST_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶灾祸教士魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.calamityPriest.resupply.requestedWeek !== null) add('receive-calamity-priest-supply', '确认下一批三瓶灾祸教士到货', `0行动 · 第${s.calamityPriest.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.calamityPriest)) add('request-calamity-priest-supply', '向艾妲·芬恩订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.calamityPriest.guidanceKnown) {
    for (const bottle of s.calamityPriest.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶灾祸教士魔药`, `0行动 · 独立确认 · 幸运者消化${isPromoted ? s.calamityPriest.luckyActingAtPromotion : s.progression.acting}/100 · 晋升后${luckyWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.calamityPriest.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.calamityPriest.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '灾祸教士 · 序列6' : '灾祸教士之路', discovered: available,
    guidanceKnown: available && s.calamityPriest.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: { ...s.calamityPriest.practice },
    cases: [], environment: '', insideCase: Object.values(s.calamityPriest.cases).some(value => value.contactOpen),
    ...(available ? { story: CALAMITY_PRIEST_SOURCE_STATUS } : {}),
    supplies: available ? `${CALAMITY_PRIEST_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.calamityPriest.resupply.requestedWeek === null ? `已实际接收后续供给${s.calamityPriest.resupply.deliveries}批。` : `第${s.calamityPriest.resupply.requestedWeek}周提出请求，第${s.calamityPriest.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.calamityPriest.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 灾祸教士魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? CALAMITY_PRIEST_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `幸运者消化成果${s.calamityPriest.luckyActingAtPromotion}/100已保留；灾祸教士扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成幸运者消化（${s.progression.acting}/100），并在晋升幸运者后度过12整周（${luckyWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完幸运者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${CALAMITY_PRIEST_CONSUMPTION_RISK}` : '成为幸运者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isCalamityPriestAcquisitionCommand(command: unknown): command is CalamityPriestAcquisitionCommand {
  return validateCalamityPriestCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateCalamityPriestCommand(value: unknown): value is CalamityPriestCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^calamity-priest-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^calamity-priest-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && CALAMITY_PRIEST_CASE_IDS.includes(value.caseId as typeof CALAMITY_PRIEST_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && CALAMITY_PRIEST_CASE_IDS.includes(value.caseId as typeof CALAMITY_PRIEST_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateCalamityPriestState(s: SliceState): boolean {
  const raw: unknown = s.calamityPriest;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'luckyActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.monster) || !record(s.machine) || !record(s.lucky)) return false;
  const firstLuckyWeek = s.lucky.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstLuckyWeek + CALAMITY_PRIEST_MIN_LUCKY_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== CALAMITY_PRIEST_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, CALAMITY_PRIEST_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'RACK_SECURED', 'BOARD_RECORDED', 'FOCUS_RECORDED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const calamityPriest = raw as unknown as CalamityPriestState, isPromoted = promoted(s);
  if (calamityPriest.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!calamityPriest.guidanceKnown || !integer(s.lucky.promotionWeek, 1, s.week) || !integer(calamityPriest.promotionWeek, firstConsumptionWeek, s.week) || calamityPriest.luckyActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...MONSTER_ABILITY_IDS, ...MACHINE_ABILITY_IDS, ...LUCKY_ABILITY_IDS, ...CALAMITY_PRIEST_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?WINNER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?MISFORTUNE_MAGE_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?CHAOS_WALKER_ABILITY_IDS:[]),...(s.progression.sequence===2?FATE_PROPHET_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (calamityPriest.promotionWeek !== null || calamityPriest.luckyActingAtPromotion !== null || CALAMITY_PRIEST_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (calamityPriest.reflected || Object.values(calamityPriest.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of calamityPriest.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `calamity-priest-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of calamityPriest.bottles.entries()) {
    let stockWeek = firstLuckyWeek;
    if (index < CALAMITY_PRIEST_BOTTLE_IDS.length) {
      if (bottle.source !== CALAMITY_PRIEST_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!calamityPriest.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / CALAMITY_PRIEST_BOTTLE_IDS.length) - 1;
      if (index % CALAMITY_PRIEST_BOTTLE_IDS.length === 0) {
        const previous = calamityPriest.bottles.slice(index - CALAMITY_PRIEST_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > calamityPriest.promotionWeek!) return false;
    }
    if (!calamityPriest.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > calamityPriest.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > calamityPriest.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== calamityPriest.promotionWeek) return false;
    }
  }
  if (calamityPriest.resupply.requestedWeek !== null && (!calamityPriest.guidanceKnown || isPromoted || !supplyExhausted(calamityPriest) || calamityPriest.bottles.some(bottle => bottle.consumedWeek! > calamityPriest.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = calamityPriest.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, calamityPriest.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'CALAMITY_PRIEST_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(calamityPriest.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.status !== 'ACTIVE' || s.activeEvent !== null || s.world.city !== 'BACKLUND' || Object.values(calamityPriest.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'calamity-priest-dispute').length;
  // A later real death does not erase this original resolved encounter and its earned award.
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateCalamityPriestLife(s);
}

export { CALAMITY_PRIEST_ABILITIES } from './content.js';
export type * from './types.js';
