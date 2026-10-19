import { BLOOD_DUKE_ABILITY_IDS } from '../blood-duke/types.js';
import {BLATHERER_ABILITY_IDS} from '../blatherer/types.js';
import {DEVIL_ABILITY_IDS} from '../devil/types.js';
import {DESIRE_APOSTLE_ABILITY_IDS} from '../desire-apostle/types.js';
import {DEMON_ABILITY_IDS} from '../demon/types.js';
import {SERIAL_KILLER_ABILITY_IDS} from '../serial-killer/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CRIMINAL_ABILITY_IDS } from '../criminal/types.js';
import {
  UNWINGED_ABILITIES, UNWINGED_BOTTLE_IDS, UNWINGED_CONSUMPTION_RISK, UNWINGED_FORMULA_STATUS,
  UNWINGED_CHANGE_WARNING, UNWINGED_GUIDE, UNWINGED_LABOUR_TASKS, UNWINGED_MIN_CRIMINAL_WEEKS, UNWINGED_POTION_SOURCES, UNWINGED_PRICES, UNWINGED_SOURCE_STATUS,
} from './content.js';
import {
  UNWINGED_ABILITY_IDS, UNWINGED_CASE_IDS, type UnwingedAcquisitionCommand, type UnwingedAction,
  type UnwingedBottle, type UnwingedCommand, type UnwingedProjection, type UnwingedState,
} from './types.js';

export function createUnwingedState(): UnwingedState {
  return {
    guidanceKnown: false,
    bottles: UNWINGED_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, criminalActingAtPromotion: null,
    cases: Object.fromEntries(UNWINGED_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', urgeOpen: false, restraints: 0 }])),
    reflected: false, conscienceLost: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'abyss' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const isCriminal = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.criminal.discovered && s.criminal.guidanceKnown && (isCriminal(s) || promoted(s));
const potionPrice = (bottle: UnwingedBottle) => UNWINGED_PRICES.potion - (bottle.labourSteps === 3 ? UNWINGED_PRICES.labourCredit : 0);
const bottleNumber = (bottle: UnwingedBottle) => Number(bottle.id.slice('unwinged-potion-'.length));
const criminalWeeks = (s: SliceState) => Math.max(0, (s.unwinged.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const supplyExhausted = (state: UnwingedState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${UNWINGED_GUIDE}的新进阶成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列8折翼天使魔药，原瓶unwinged-potion-${number}，非罪犯旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: UnwingedAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.criminal.cases).some(value => value.holding)) return '先实际归还罪犯阶段原工钱袋，再继续晋升。';
  if (Object.values(s.unwinged.cases).some(value => value.urgeOpen)) return '先实际停手，结束本次尚未处理的恶欲冲动。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的旧货库，找到罗安·费里。';
  if (!knownChannel(s)) return '成为罪犯并保有罗安·费里的指导渠道后，才能继续了解折翼天使之路。';
  if (promoted(s)) return '你已完成折翼天使晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.unwinged.guidanceKnown) return '已经听过折翼天使成品魔药的用药说明。';
    return s.cash < UNWINGED_PRICES.guidance ? '折翼天使用药指导需要180便士。' : null;
  }
  if (!s.unwinged.guidanceKnown) return '先听罗安·费里说明这批序列8原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.unwinged.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.unwinged) ? null : '须先用完现有全部折翼天使原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.unwinged.resupply.requestedWeek === null) return '尚未申请下一批折翼天使补给。';
    if (s.week <= s.unwinged.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.unwinged) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.unwinged.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选折翼天使原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true || command.acceptedChange !== true) return '本次原瓶的服药与角色良知丧失、恶欲加剧变化需要分别确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `罪犯魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || criminalWeeks(s) < UNWINGED_MIN_CRIMINAL_WEEKS) return `成为罪犯后已度过${criminalWeeks(s)}/${UNWINGED_MIN_CRIMINAL_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 3 ? '这瓶对应的三次旧货库劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyUnwingedCommand(s: SliceState, command: UnwingedAcquisitionCommand, c: SeerContext): void {
  rule(validateUnwingedCommand(command) && isUnwingedAcquisitionCommand(command), '折翼天使准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= UNWINGED_PRICES.guidance;
      s.unwinged.guidanceKnown = true;
      c.note('听取折翼天使用药说明', `花费1行动、180便士，你向已认识的本作原创成年${UNWINGED_GUIDE}继续请教，他向你说明从新进阶成品交接渠道实际取得的三瓶序列8成品、逐瓶交付与四档风险。这些不是原来的罪犯存药。${UNWINGED_FORMULA_STATUS}罪犯消化须达100，首次晋升罪犯后满4整周才能服用；可提前筹备。${UNWINGED_CHANGE_WARNING}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.unwinged.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = UNWINGED_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在罗安·费里的旧货库实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/3，原瓶仍由导师保管。${bottle.labourSteps === 3 ? '三次劳务只抵这瓶1050便士，仍须实际支付160便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应三次劳务后才能抵这瓶1050便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.unwinged.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('折翼天使原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列8成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 3 ? '对应三次旧货库劳务抵扣1050便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；罪犯消化100且首次晋升后满4整周时，再独立确认服药。${UNWINGED_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.unwinged.resupply.requestedWeek = s.week;
      c.note('申请下一批折翼天使魔药', `现有折翼天使原瓶全部耗尽且未晋升。你花费1行动，请${UNWINGED_GUIDE}从同一新渠道订下一批三瓶，并实际核验旧货库的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付1210便士，或分别完成三次劳务后支付160便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.unwinged.bottles.length + 1;
      s.unwinged.resupply.deliveries += 1;
      for (let offset = 0; offset < UNWINGED_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.unwinged.bottles.push({ id: `unwinged-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.unwinged.resupply.requestedWeek = null;
      c.note('下一批折翼天使原瓶到货', `第${s.week}周，罗安·费里的新进阶成品交接渠道本作G成品供给第${s.unwinged.resupply.deliveries + 1}批三瓶实际到货，原瓶unwinged-potion-${firstNumber}至unwinged-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按1210便士购买，或完成对应三次劳务再付160便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.unwinged.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.unwinged.criminalActingAtPromotion = s.progression.acting;
        s.unwinged.promotionWeek = s.week;
        s.unwinged.conscienceLost = true;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of UNWINGED_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为折翼天使', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+1、意志不增加、知识+1。三项罪犯能力及原ID掌握完整继承，只新增非人身体，从0掌握开始；未核实的具体恶魔法术不自动获得；罪犯消化成果和首次晋升周保留，折翼天使扮演从0开始。灵性上限提高到45，当前灵性没有补满。虚构角色失去原有良知，恶欲加剧；系统不会替玩家实施犯罪，之后克制也不会恢复原有良知。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了折翼天使晋升' : '折翼天使魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是罪犯，原有良知、消化与三项掌握保留，没有触发折翼天使的角色变化。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectUnwinged(s: SliceState): UnwingedProjection {
  const actions: UnwingedAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? (s.progression.sequence===8?s.progression.acting:s.serialKiller.unwingedActingAtPromotion??0) : 0;
  const add = (id: string, label: string, cost: string, command: UnwingedAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.unwinged.guidanceKnown) add('learn-unwinged-guidance', '请罗安·费里说明折翼天使成品与风险', '1行动 · 180便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.unwinged.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 3) add(`work-${bottle.id}`, `第${number}瓶 · ${UNWINGED_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/3，完成三次抵该瓶1050便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶折翼天使魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列8原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.unwinged.resupply.requestedWeek !== null) add('receive-unwinged-supply', '确认下一批三瓶折翼天使到货', `0行动 · 第${s.unwinged.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.unwinged)) add('request-unwinged-supply', '向罗安·费里订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.unwinged.guidanceKnown) {
    for (const bottle of s.unwinged.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶折翼天使魔药`, `0行动 · 独立确认 · 罪犯消化${isPromoted ? s.unwinged.criminalActingAtPromotion : s.progression.acting}/100 · 晋升后${criminalWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true, acceptedChange: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.unwinged.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.unwinged.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '折翼天使 · 序列8' : '折翼天使之路', discovered: available,
    guidanceKnown: available && s.unwinged.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: Object.values(s.unwinged.cases).some(value => value.urgeOpen),
    conscienceLost: isPromoted && s.unwinged.conscienceLost, changeWarning: available ? UNWINGED_CHANGE_WARNING : '',
    ...(available ? { story: UNWINGED_SOURCE_STATUS } : {}),
    supplies: available ? `${UNWINGED_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.unwinged.resupply.requestedWeek === null ? `已实际接收后续供给${s.unwinged.resupply.deliveries}批。` : `第${s.unwinged.resupply.requestedWeek}周提出请求，第${s.unwinged.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.unwinged.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 折翼天使魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/3`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true, acceptedChange: true },
    })) : [],
    abilities: isPromoted ? UNWINGED_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `罪犯消化成果${s.unwinged.criminalActingAtPromotion}/100已保留；折翼天使扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成罪犯消化（${s.progression.acting}/100），并在首次晋升罪犯后度过4整周（${criminalWeeks(s)}/4）。用药指导与原瓶可以提前准备。` : '先走完罪犯之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应三次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药并接受这瓶原药的角色变化。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${UNWINGED_CONSUMPTION_RISK}` : '成为罪犯后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isUnwingedAcquisitionCommand(command: UnwingedCommand): command is UnwingedAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateUnwingedCommand(value: unknown): value is UnwingedCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^unwinged-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed', 'acceptedChange']) && value.confirmed === true && value.acceptedChange === true && typeof value.bottleId === 'string' && /^unwinged-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'STAND_DOWN', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && UNWINGED_CASE_IDS.includes(value.caseId as typeof UNWINGED_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && UNWINGED_CASE_IDS.includes(value.caseId as typeof UNWINGED_CASE_IDS[number]) && ['BODY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual restraint, and exact outcome/source gates. */
export function validateUnwingedState(s: SliceState): boolean {
  const raw: unknown = s.unwinged;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'criminalActingAtPromotion', 'conscienceLost', 'cases', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean' || typeof raw.conscienceLost !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.criminal)) return false;
  const firstCriminalWeek = s.progression.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstCriminalWeek + UNWINGED_MIN_CRIMINAL_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== UNWINGED_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, UNWINGED_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'urgeOpen', 'restraints'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['BODY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'GRIP_RELEASED', 'REFUSAL_ACCEPTED', 'CLAIM_CORRECTED'].includes(value.outcome as string)) return false;
    if (typeof value.urgeOpen !== 'boolean' || !integer(value.restraints, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const unwinged = raw as unknown as UnwingedState, isPromoted = promoted(s);
  if (unwinged.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!unwinged.guidanceKnown || !unwinged.conscienceLost || !integer(s.progression.promotionWeek, 5, s.week) || !integer(unwinged.promotionWeek, firstConsumptionWeek, s.week) || unwinged.criminalActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?SERIAL_KILLER_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?DEMON_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?DESIRE_APOSTLE_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DEVIL_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?BLATHERER_ABILITY_IDS:[]),...(s.progression.sequence===2?BLOOD_DUKE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (unwinged.conscienceLost || unwinged.promotionWeek !== null || unwinged.criminalActingAtPromotion !== null || UNWINGED_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (unwinged.reflected || Object.values(unwinged.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.urgeOpen || value.restraints !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of unwinged.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `unwinged-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 3)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of unwinged.bottles.entries()) {
    let stockWeek = firstCriminalWeek;
    if (index < UNWINGED_BOTTLE_IDS.length) {
      if (bottle.source !== UNWINGED_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!unwinged.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / UNWINGED_BOTTLE_IDS.length) - 1;
      if (index % UNWINGED_BOTTLE_IDS.length === 0) {
        const previous = unwinged.bottles.slice(index - UNWINGED_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > unwinged.promotionWeek!) return false;
    }
    if (!unwinged.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > unwinged.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > unwinged.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== unwinged.promotionWeek) return false;
    }
  }
  if (unwinged.resupply.requestedWeek !== null && (!unwinged.guidanceKnown || isPromoted || !supplyExhausted(unwinged) || unwinged.bottles.some(bottle => bottle.consumedWeek! > unwinged.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export type * from './types.js';
