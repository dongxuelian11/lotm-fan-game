import { ELDER_ABILITY_IDS } from '../elder/types.js';
import {THREE_HEADED_TEMPLAR_ABILITY_IDS} from '../three-headed-templar/types.js';
import {BLACK_KNIGHT_ABILITY_IDS} from '../black-knight/types.js';
import {SHEPHERD_ABILITY_IDS} from '../shepherd/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../secret-supplicant/types.js';
import { LISTENER_ABILITY_IDS } from '../listener/types.js';
import { validateRoseBishopLife } from './life.js';
import { SHADOW_ASCETIC_ABILITY_IDS } from '../shadow-ascetic/types.js';
import {
  ROSE_BISHOP_ABILITIES, ROSE_BISHOP_BOTTLE_IDS, ROSE_BISHOP_CONSUMPTION_RISK, ROSE_BISHOP_FORMULA_STATUS,
  ROSE_BISHOP_GUIDE, ROSE_BISHOP_LABOUR_TASKS, ROSE_BISHOP_MIN_SHADOW_ASCETIC_WEEKS, ROSE_BISHOP_POTION_SOURCES, ROSE_BISHOP_PRICES, ROSE_BISHOP_SOURCE_STATUS,
} from './content.js';
import {
  ROSE_BISHOP_ABILITY_IDS, ROSE_BISHOP_CASE_IDS, type RoseBishopAcquisitionCommand, type RoseBishopAction,
  type RoseBishopBottle, type RoseBishopCommand, type RoseBishopProjection, type RoseBishopState,
} from './types.js';

export function createRoseBishopState(): RoseBishopState {
  return {
    guidanceKnown: false,
    bottles: ROSE_BISHOP_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, shadowAsceticActingAtPromotion: null,
    cases: Object.fromEntries(ROSE_BISHOP_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    reserve: { points: 0, max: 3, packetsBought: 0, lastPurchaseWeek: null, packets: [] },
    practice: { shape: 'NORMAL' },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isShadowAscetic = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.secretSupplicant.discovered && s.secretSupplicant.guidanceKnown && s.listener.guidanceKnown && s.shadowAscetic.guidanceKnown && s.shadowAscetic.promotionWeek !== null && (isShadowAscetic(s) || promoted(s));
const potionPrice = (bottle: RoseBishopBottle) => ROSE_BISHOP_PRICES.potion - (bottle.labourSteps === 5 ? ROSE_BISHOP_PRICES.labourCredit : 0);
const bottleNumber = (bottle: RoseBishopBottle) => Number(bottle.id.slice('rose-bishop-potion-'.length));
const shadowAsceticWeeks = (s: SliceState) => Math.max(0, (s.roseBishop.promotionWeek ?? s.week) - (s.shadowAscetic.promotionWeek ?? s.week));
const supplyExhausted = (state: RoseBishopState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${ROSE_BISHOP_GUIDE}的独立蔷薇主教成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6蔷薇主教魔药，原瓶rose-bishop-potion-${number}，非秘祈人、倾听者或隐修士旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: RoseBishopAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.roseBishop.cases).some(value => value.contactOpen)) return '先实际结束本次蔷薇主教实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原旧物间，找到伊森。';
  if (!knownChannel(s)) return '成为隐修士并保有伊森的指导渠道后，才能继续了解蔷薇主教之路。';
  if (promoted(s)) return '你已完成蔷薇主教晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.roseBishop.guidanceKnown) return '已经听过蔷薇主教成品魔药的用药说明。';
    return s.cash < ROSE_BISHOP_PRICES.guidance ? '蔷薇主教用药指导需要360便士。' : null;
  }
  if (!s.roseBishop.guidanceKnown) return '先听伊森说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.roseBishop.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.roseBishop) ? null : '须先用完现有全部蔷薇主教原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.roseBishop.resupply.requestedWeek === null) return '尚未申请下一批蔷薇主教补给。';
    if (s.week <= s.roseBishop.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.roseBishop) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.roseBishop.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选蔷薇主教原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `隐修士魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.shadowAscetic.promotionWeek === null || shadowAsceticWeeks(s) < ROSE_BISHOP_MIN_SHADOW_ASCETIC_WEEKS) return `成为隐修士后已度过${shadowAsceticWeeks(s)}/${ROSE_BISHOP_MIN_SHADOW_ASCETIC_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原旧物间劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyRoseBishopCommand(s: SliceState, command: RoseBishopAcquisitionCommand, c: SeerContext): void {
  rule(validateRoseBishopCommand(command) && isRoseBishopAcquisitionCommand(command), '蔷薇主教准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= ROSE_BISHOP_PRICES.guidance;
      s.roseBishop.guidanceKnown = true;
      c.note('听取蔷薇主教用药说明', `花费1行动、360便士，你向已认识的本作原创成年${ROSE_BISHOP_GUIDE}继续请教，他向你说明从独立蔷薇主教成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的秘祈人、倾听者或隐修士存药。${ROSE_BISHOP_FORMULA_STATUS}隐修士消化须达100，晋升隐修士后满12整周才能服用；可提前筹备。${ROSE_BISHOP_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.roseBishop.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = ROSE_BISHOP_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊森的原旧物间实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.roseBishop.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('蔷薇主教原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原旧物间劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；隐修士消化100且晋升隐修士后满12整周时，再独立确认服药。${ROSE_BISHOP_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.roseBishop.resupply.requestedWeek = s.week;
      c.note('申请下一批蔷薇主教魔药', `现有蔷薇主教原瓶全部耗尽且未晋升。你花费1行动，请${ROSE_BISHOP_GUIDE}从同一新渠道订下一批三瓶，并实际核验原旧物间的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.roseBishop.bottles.length + 1;
      s.roseBishop.resupply.deliveries += 1;
      for (let offset = 0; offset < ROSE_BISHOP_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.roseBishop.bottles.push({ id: `rose-bishop-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.roseBishop.resupply.requestedWeek = null;
      c.note('下一批蔷薇主教原瓶到货', `第${s.week}周，伊森的独立蔷薇主教成品交接渠道本作G成品供给第${s.roseBishop.resupply.deliveries + 1}批三瓶实际到货，原瓶rose-bishop-potion-${firstNumber}至rose-bishop-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.roseBishop.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.roseBishop.shadowAsceticActingAtPromotion = s.progression.acting;
        s.roseBishop.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of ROSE_BISHOP_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为蔷薇主教', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。秘祈人、倾听者与隐修士全部原能力及原ID掌握完整继承，只新增血肉塑形与有限自体修复两项，从0掌握开始；隐修士消化成果与隐修士晋升周保留，蔷薇主教扮演从0开始。灵性上限提高到80，当前灵性没有补满。必须另行购买并使用真实动物来源份额才有血肉储备；食物不治疗，失败照耗，没有放牧、窃取灵魂或复活。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了蔷薇主教晋升' : '蔷薇主教魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是隐修士，消化与全部原有掌握保留，没有获得蔷薇主教能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectRoseBishop(s: SliceState): RoseBishopProjection {
  const actions: RoseBishopAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.shepherd.roseBishopActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: RoseBishopAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.roseBishop.guidanceKnown) add('learn-rose-bishop-guidance', '请伊森说明蔷薇主教成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.roseBishop.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${ROSE_BISHOP_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶蔷薇主教魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.roseBishop.resupply.requestedWeek !== null) add('receive-rose-bishop-supply', '确认下一批三瓶蔷薇主教到货', `0行动 · 第${s.roseBishop.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.roseBishop)) add('request-rose-bishop-supply', '向伊森订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.roseBishop.guidanceKnown) {
    for (const bottle of s.roseBishop.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶蔷薇主教魔药`, `0行动 · 独立确认 · 隐修士消化${isPromoted ? s.roseBishop.shadowAsceticActingAtPromotion : s.progression.acting}/100 · 晋升后${shadowAsceticWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.roseBishop.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.roseBishop.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '蔷薇主教 · 序列6' : '蔷薇主教之路', discovered: available,
    guidanceKnown: available && s.roseBishop.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    reserve: { summary: isPromoted ? `血肉储备${s.roseBishop.reserve.points}/3；已买${s.roseBishop.reserve.packetsBought}份动物来源封装原物。每真实周最多购1份，1行动40便士；另花1行动消耗选定原份补1储备，不治疗、不自动补充。` : '', points: s.roseBishop.reserve.points, max: 3, packetsBought: s.roseBishop.reserve.packetsBought, lastPurchaseWeek: s.roseBishop.reserve.lastPurchaseWeek, packets: s.roseBishop.reserve.packets.map(packet => ({ ...packet })) },
    practice: { ...s.roseBishop.practice },
    cases: [], environment: '', insideCase: Object.values(s.roseBishop.cases).some(value => value.contactOpen),
    ...(available ? { story: ROSE_BISHOP_SOURCE_STATUS } : {}),
    supplies: available ? `${ROSE_BISHOP_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.roseBishop.resupply.requestedWeek === null ? `已实际接收后续供给${s.roseBishop.resupply.deliveries}批。` : `第${s.roseBishop.resupply.requestedWeek}周提出请求，第${s.roseBishop.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.roseBishop.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 蔷薇主教魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? ROSE_BISHOP_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `隐修士消化成果${s.roseBishop.shadowAsceticActingAtPromotion}/100已保留；蔷薇主教扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成隐修士消化（${s.progression.acting}/100），并在晋升隐修士后度过12整周（${shadowAsceticWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完隐修士之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${ROSE_BISHOP_CONSUMPTION_RISK}` : '成为隐修士后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isRoseBishopAcquisitionCommand(command: unknown): command is RoseBishopAcquisitionCommand {
  return validateRoseBishopCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateRoseBishopCommand(value: unknown): value is RoseBishopCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'BUY_RATION', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (value.type === 'TAKE_RATION') return shape(value, ['type', 'packetId']) && typeof value.packetId === 'string' && /^rose-bishop-ration-[1-9]\d{0,14}$/.test(value.packetId);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^rose-bishop-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^rose-bishop-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && ROSE_BISHOP_CASE_IDS.includes(value.caseId as typeof ROSE_BISHOP_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && ROSE_BISHOP_CASE_IDS.includes(value.caseId as typeof ROSE_BISHOP_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateRoseBishopState(s: SliceState): boolean {
  const raw: unknown = s.roseBishop;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'shadowAsceticActingAtPromotion', 'cases', 'reserve', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.secretSupplicant) || !record(s.listener) || !record(s.shadowAscetic)) return false;
  const firstShadowAsceticWeek = s.shadowAscetic.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstShadowAsceticWeek + ROSE_BISHOP_MIN_SHADOW_ASCETIC_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== ROSE_BISHOP_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, ROSE_BISHOP_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'RING_VERIFIED', 'GRIP_VERIFIED', 'LESSON_VERIFIED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const roseBishop = raw as unknown as RoseBishopState, isPromoted = promoted(s);
  if (roseBishop.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!roseBishop.guidanceKnown || !integer(s.shadowAscetic.promotionWeek, 1, s.week) || !integer(roseBishop.promotionWeek, firstConsumptionWeek, s.week) || roseBishop.shadowAsceticActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS, ...SHADOW_ASCETIC_ABILITY_IDS, ...ROSE_BISHOP_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?SHEPHERD_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?BLACK_KNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?THREE_HEADED_TEMPLAR_ABILITY_IDS:[]),...(s.progression.sequence===2?ELDER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (roseBishop.promotionWeek !== null || roseBishop.shadowAsceticActingAtPromotion !== null || ROSE_BISHOP_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (roseBishop.reflected || Object.values(roseBishop.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of roseBishop.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `rose-bishop-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of roseBishop.bottles.entries()) {
    let stockWeek = firstShadowAsceticWeek;
    if (index < ROSE_BISHOP_BOTTLE_IDS.length) {
      if (bottle.source !== ROSE_BISHOP_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!roseBishop.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / ROSE_BISHOP_BOTTLE_IDS.length) - 1;
      if (index % ROSE_BISHOP_BOTTLE_IDS.length === 0) {
        const previous = roseBishop.bottles.slice(index - ROSE_BISHOP_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > roseBishop.promotionWeek!) return false;
    }
    if (!roseBishop.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > roseBishop.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > roseBishop.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== roseBishop.promotionWeek) return false;
    }
  }
  if (roseBishop.resupply.requestedWeek !== null && (!roseBishop.guidanceKnown || isPromoted || !supplyExhausted(roseBishop) || roseBishop.bottles.some(bottle => bottle.consumedWeek! > roseBishop.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = roseBishop.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, roseBishop.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'ROSE_BISHOP_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(roseBishop.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.status !== 'ACTIVE' || s.activeEvent !== null || s.world.city !== 'BACKLUND' || Object.values(roseBishop.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'rose-bishop-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || s.status === 'DEAD' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateRoseBishopLife(s);
}

export { ROSE_BISHOP_ABILITIES } from './content.js';
export type * from './types.js';
