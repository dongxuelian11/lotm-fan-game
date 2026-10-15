import { ALL_KNOWING_EYE_ABILITY_IDS } from '../all-knowing-eye/types.js';
import { WISDOM_ANGEL_ABILITY_IDS } from '../wisdom-angel/types.js';
import {INSIGHT_SCHOLAR_ABILITY_IDS} from '../insight-scholar/types.js';
import {PROPHET_ABILITY_IDS} from '../prophet/types.js';
import {MYSTICISM_MAGISTER_ABILITY_IDS} from '../mysticism-magister/types.js';
import {POLYMATH_ABILITY_IDS} from '../polymath/types.js';
import {DETECTIVE_ABILITY_IDS} from '../detective/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { READER_ABILITY_IDS } from '../reader/types.js';
import {
  REASONER_ABILITIES, REASONER_BOTTLE_IDS, REASONER_CONSUMPTION_RISK, REASONER_FORMULA_STATUS,
  REASONER_GUIDE, REASONER_LABOUR_TASKS, REASONER_MIN_READER_WEEKS, REASONER_POTION_SOURCES, REASONER_PRICES, REASONER_SOURCE_STATUS,
} from './content.js';
import {
  REASONER_ABILITY_IDS, REASONER_CASE_IDS, type ReasonerAcquisitionCommand, type ReasonerAction,
  type ReasonerBottle, type ReasonerCommand, type ReasonerProjection, type ReasonerState,
} from './types.js';

export function createReasonerState(): ReasonerState {
  return {
    guidanceKnown: false,
    bottles: REASONER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, readerActingAtPromotion: null,
    cases: Object.fromEntries(REASONER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, testId: null, conclusion: null, mistakes: 0 }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'white-tower' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))));
const isReader = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.reader.discovered && s.reader.guidanceKnown && (isReader(s) || promoted(s));
const potionPrice = (bottle: ReasonerBottle) => REASONER_PRICES.potion - (bottle.labourSteps === 3 ? REASONER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ReasonerBottle) => Number(bottle.id.slice('reasoner-potion-'.length));
const readerWeeks = (s: SliceState) => Math.max(0, (s.reasoner.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const supplyExhausted = (state: ReasonerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${REASONER_GUIDE}的新借阅馆交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列8推理学员魔药，原瓶reasoner-potion-${number}，非阅读者旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: ReasonerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原私人借阅馆，找到塞缪尔。';
  if (!knownChannel(s)) return '成为阅读者并保有塞缪尔的指导渠道后，才能继续推理学员之路。';
  if (promoted(s)) return '你已完成推理学员晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.reasoner.guidanceKnown) return '已经听过推理学员成品魔药的用药说明。';
    return s.cash < REASONER_PRICES.guidance ? '推理学员用药指导需要180便士。' : null;
  }
  if (!s.reasoner.guidanceKnown) return '先听塞缪尔说明这批序列8原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.reasoner.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.reasoner) ? null : '须先用完现有全部推理学员原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.reasoner.resupply.requestedWeek === null) return '尚未申请下一批推理学员补给。';
    if (s.week <= s.reasoner.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.reasoner) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.reasoner.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选推理学员原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `阅读者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || readerWeeks(s) < REASONER_MIN_READER_WEEKS) return `成为阅读者后已度过${readerWeeks(s)}/${REASONER_MIN_READER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 3 ? '这瓶对应的三次借阅馆劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyReasonerCommand(s: SliceState, command: ReasonerAcquisitionCommand, c: SeerContext): void {
  rule(validateReasonerCommand(command) && isReasonerAcquisitionCommand(command), '推理学员准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= REASONER_PRICES.guidance;
      s.reasoner.guidanceKnown = true;
      c.note('听取推理学员用药说明', `花费1行动、180便士，${REASONER_GUIDE}向你说明从新借阅馆交接渠道实际取得的三瓶序列8成品、逐瓶交付与四档风险。这些不是原来的阅读者存药。${REASONER_FORMULA_STATUS}阅读者消化须达100，首次晋升阅读者后满4整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.reasoner.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = REASONER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在塞缪尔的原私人借阅馆实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/3，原瓶仍由导师保管。${bottle.labourSteps === 3 ? '三次劳务只抵这瓶1050便士，仍须实际支付160便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应三次劳务后才能抵这瓶1050便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.reasoner.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('推理学员原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列8成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 3 ? '对应三次借阅馆劳务抵扣1050便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；阅读者消化100且首次晋升后满4整周时，再独立确认服药。${REASONER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.reasoner.resupply.requestedWeek = s.week;
      c.note('申请下一批推理学员魔药', `现有推理学员原瓶全部耗尽且未晋升。你花费1行动，请${REASONER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原私人借阅馆的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付1210便士，或分别完成三次劳务后支付160便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.reasoner.bottles.length + 1;
      s.reasoner.resupply.deliveries += 1;
      for (let offset = 0; offset < REASONER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.reasoner.bottles.push({ id: `reasoner-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.reasoner.resupply.requestedWeek = null;
      c.note('下一批推理学员原瓶到货', `第${s.week}周，塞缪尔的新借阅馆交接渠道本作G成品供给第${s.reasoner.resupply.deliveries + 1}批三瓶实际到货，原瓶reasoner-potion-${firstNumber}至reasoner-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按1210便士购买，或完成对应三次劳务再付160便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.reasoner.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.reasoner.readerActingAtPromotion = s.progression.acting;
        s.reasoner.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of REASONER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 3], ['will', 2], ['knowledge', 3]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为推理学员', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+3、意志+2、知识+3。三项阅读者能力及掌握完整继承，观察、逻辑推理与仪式专精从0掌握开始；阅读者消化成果和首次晋升周保留，推理学员扮演从0开始。灵性上限提高到45，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了推理学员晋升' : '推理学员魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是阅读者，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectReasoner(s: SliceState): ReasonerProjection {
  const actions: ReasonerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: ReasonerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.reasoner.guidanceKnown) add('learn-reasoner-guidance', '请塞缪尔说明推理学员成品与风险', '1行动 · 180便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.reasoner.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 3) add(`work-${bottle.id}`, `第${number}瓶 · ${REASONER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/3，完成三次抵该瓶1050便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶推理学员魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列8原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.reasoner.resupply.requestedWeek !== null) add('receive-reasoner-supply', '确认下一批三瓶推理学员到货', `0行动 · 第${s.reasoner.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.reasoner)) add('request-reasoner-supply', '向塞缪尔订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.reasoner.guidanceKnown) {
    for (const bottle of s.reasoner.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶推理学员魔药`, `0行动 · 独立确认 · 阅读者消化${isPromoted ? s.reasoner.readerActingAtPromotion : s.progression.acting}/100 · 晋升后${readerWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.reasoner.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.reasoner.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '推理学员 · 序列8' : '推理学员之路', discovered: available,
    guidanceKnown: available && s.reasoner.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '',
    ...(available ? { story: REASONER_SOURCE_STATUS } : {}),
    supplies: available ? `${REASONER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.reasoner.resupply.requestedWeek === null ? `已实际接收后续供给${s.reasoner.resupply.deliveries}批。` : `第${s.reasoner.resupply.requestedWeek}周提出请求，第${s.reasoner.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions: s.progression.pathwayId === 'white-tower' && (s.progression.sequence === 2||s.progression.sequence===1) ? [] : actions,
    bottles: available ? s.reasoner.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 推理学员魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/3`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? REASONER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?(s.detective.reasonerActingAtPromotion??100):s.progression.acting) : 0,
    digestion: isPromoted ? `阅读者消化成果${s.reasoner.readerActingAtPromotion}/100已保留；推理学员扮演${(s.progression.sequence === 2||s.progression.sequence===1) ? s.detective.reasonerActingAtPromotion : s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成阅读者消化（${s.progression.acting}/100），并在首次晋升阅读者后度过4整周（${readerWeeks(s)}/4）。用药指导与原瓶可以提前准备。` : '先走完阅读者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应三次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${REASONER_CONSUMPTION_RISK}` : '成为阅读者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const choiceId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value);

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isReasonerAcquisitionCommand(command: ReasonerCommand): command is ReasonerAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateReasonerCommand(value: unknown): value is ReasonerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^reasoner-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^reasoner-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'EXAMINE') return shape(value, ['type', 'caseId']) && REASONER_CASE_IDS.includes(value.caseId as typeof REASONER_CASE_IDS[number]);
  if (value.type === 'TEST') return shape(value, ['type', 'caseId', 'testId']) && REASONER_CASE_IDS.includes(value.caseId as typeof REASONER_CASE_IDS[number]) && choiceId(value.testId);
  if (value.type === 'CONCLUDE') return shape(value, ['type', 'caseId', 'conclusion']) && REASONER_CASE_IDS.includes(value.caseId as typeof REASONER_CASE_IDS[number]) && choiceId(value.conclusion);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions and evidence. */
export function validateReasonerState(s: SliceState): boolean {
  const raw: unknown = s.reasoner;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'readerActingAtPromotion', 'cases', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.reader)) return false;
  const firstReaderWeek = s.progression.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstReaderWeek + REASONER_MIN_READER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== REASONER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, REASONER_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'testId', 'conclusion', 'mistakes'])) return false;
    if (!['AVAILABLE', 'EXAMINED', 'TESTED', 'RESOLVED'].includes(value.status as string) || !integer(value.mistakes, 0)) return false;
    if (value.testId !== null && !choiceId(value.testId) || value.conclusion !== null && !choiceId(value.conclusion)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const reasoner = raw as unknown as ReasonerState, isPromoted = promoted(s);
  if (isPromoted && (s.progression.sequence === 2||s.progression.sequence===1) && (!reasoner.reflected || Object.values(reasoner.cases).some(c => c.status !== 'RESOLVED'))) return false;
  if (reasoner.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!reasoner.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(reasoner.promotionWeek, firstConsumptionWeek, s.week) || reasoner.readerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?ALL_KNOWING_EYE_ABILITY_IDS:[]),...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?DETECTIVE_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?POLYMATH_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?MYSTICISM_MAGISTER_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?PROPHET_ABILITY_IDS:[]),...([3, 2, 1].includes(s.progression.sequence ?? 0)?INSIGHT_SCHOLAR_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?WISDOM_ANGEL_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (reasoner.promotionWeek !== null || reasoner.readerActingAtPromotion !== null || REASONER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (reasoner.reflected || Object.values(reasoner.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.testId !== null || value.conclusion !== null || value.mistakes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of reasoner.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `reasoner-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 3)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of reasoner.bottles.entries()) {
    let stockWeek = firstReaderWeek;
    if (index < REASONER_BOTTLE_IDS.length) {
      if (bottle.source !== REASONER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!reasoner.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / REASONER_BOTTLE_IDS.length) - 1;
      if (index % REASONER_BOTTLE_IDS.length === 0) {
        const previous = reasoner.bottles.slice(index - REASONER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > reasoner.promotionWeek!) return false;
    }
    if (!reasoner.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > reasoner.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > reasoner.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== reasoner.promotionWeek) return false;
    }
  }
  if (reasoner.resupply.requestedWeek !== null && (!reasoner.guidanceKnown || isPromoted || !supplyExhausted(reasoner) || reasoner.bottles.some(bottle => bottle.consumedWeek! > reasoner.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export type * from './types.js';
