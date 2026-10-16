import { ALL_KNOWING_EYE_ABILITY_IDS } from '../all-knowing-eye/types.js';
import { WISDOM_ANGEL_ABILITY_IDS } from '../wisdom-angel/types.js';
import {INSIGHT_SCHOLAR_ABILITY_IDS} from '../insight-scholar/types.js';
import {PROPHET_ABILITY_IDS} from '../prophet/types.js';
import {MYSTICISM_MAGISTER_ABILITY_IDS} from '../mysticism-magister/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { READER_ABILITY_IDS } from '../reader/types.js';
import { REASONER_ABILITY_IDS } from '../reasoner/types.js';
import { validatePolymathLife } from './life.js';
import { DETECTIVE_ABILITY_IDS } from '../detective/types.js';
import {
  POLYMATH_ABILITIES, POLYMATH_BOTTLE_IDS, POLYMATH_CONSUMPTION_RISK, POLYMATH_FORMULA_STATUS,
  POLYMATH_SAMPLES, POLYMATH_GUIDE, POLYMATH_LABOUR_TASKS, POLYMATH_MIN_DETECTIVE_WEEKS, POLYMATH_POTION_SOURCES, POLYMATH_PRICES, POLYMATH_SOURCE_STATUS,
} from './content.js';
import {
  POLYMATH_ABILITY_IDS, POLYMATH_CASE_IDS, POLYMATH_SAMPLE_IDS, type PolymathAcquisitionCommand, type PolymathAction,
  type PolymathBottle, type PolymathCommand, type PolymathProjection, type PolymathState,
} from './types.js';

export function createPolymathState(): PolymathState {
  return {
    guidanceKnown: false,
    bottles: POLYMATH_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, detectiveActingAtPromotion: null,
    cases: Object.fromEntries(POLYMATH_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    samples: { FLASH: { observedWeek: null, understoodWeek: null, learnedWeek: null, analysisAttemptWeek: null }, FROST: { observedWeek: null, understoodWeek: null, learnedWeek: null, analysisAttemptWeek: null }, COURAGE: { observedWeek: null, understoodWeek: null, learnedWeek: null, analysisAttemptWeek: null } },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'white-tower' && (s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)));
const isDetective = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.reader.discovered && s.reader.guidanceKnown && s.reasoner.guidanceKnown && s.detective.guidanceKnown && s.detective.promotionWeek !== null && (isDetective(s) || promoted(s));
const potionPrice = (bottle: PolymathBottle) => POLYMATH_PRICES.potion - (bottle.labourSteps === 5 ? POLYMATH_PRICES.labourCredit : 0);
const bottleNumber = (bottle: PolymathBottle) => Number(bottle.id.slice('polymath-potion-'.length));
const detectiveWeeks = (s: SliceState) => Math.max(0, (s.polymath.promotionWeek ?? s.week) - (s.detective.promotionWeek ?? s.week));
const supplyExhausted = (state: PolymathState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${POLYMATH_GUIDE}的独立博学者成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6博学者魔药，原瓶polymath-potion-${number}，非阅读者、推理学员或守知者旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: PolymathAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.polymath.cases).some(value => value.contactOpen)) return '先实际结束本次博学者实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原借阅馆，找到塞缪尔。';
  if (!knownChannel(s)) return '成为守知者并保有塞缪尔的指导渠道后，才能继续了解博学者之路。';
  if (promoted(s)) return '你已完成博学者晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.polymath.guidanceKnown) return '已经听过博学者成品魔药的用药说明。';
    return s.cash < POLYMATH_PRICES.guidance ? '博学者用药指导需要360便士。' : null;
  }
  if (!s.polymath.guidanceKnown) return '先听塞缪尔说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.polymath.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.polymath) ? null : '须先用完现有全部博学者原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.polymath.resupply.requestedWeek === null) return '尚未申请下一批博学者补给。';
    if (s.week <= s.polymath.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.polymath) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.polymath.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选博学者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `守知者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.detective.promotionWeek === null || detectiveWeeks(s) < POLYMATH_MIN_DETECTIVE_WEEKS) return `成为守知者后已度过${detectiveWeeks(s)}/${POLYMATH_MIN_DETECTIVE_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原借阅馆劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyPolymathCommand(s: SliceState, command: PolymathAcquisitionCommand, c: SeerContext): void {
  rule(validatePolymathCommand(command) && isPolymathAcquisitionCommand(command), '博学者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= POLYMATH_PRICES.guidance;
      s.polymath.guidanceKnown = true;
      c.note('听取博学者用药说明', `花费1行动、360便士，你向已认识的本作原创成年${POLYMATH_GUIDE}继续请教，他向你说明从独立博学者成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的阅读者、推理学员或守知者存药。${POLYMATH_FORMULA_STATUS}守知者消化须达100，晋升守知者后满12整周才能服用；可提前筹备。${POLYMATH_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.polymath.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = POLYMATH_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在塞缪尔的原借阅馆实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.polymath.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('博学者原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原借阅馆劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；守知者消化100且晋升守知者后满12整周时，再独立确认服药。${POLYMATH_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.polymath.resupply.requestedWeek = s.week;
      c.note('申请下一批博学者魔药', `现有博学者原瓶全部耗尽且未晋升。你花费1行动，请${POLYMATH_GUIDE}从同一新渠道订下一批三瓶，并实际核验原借阅馆的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.polymath.bottles.length + 1;
      s.polymath.resupply.deliveries += 1;
      for (let offset = 0; offset < POLYMATH_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.polymath.bottles.push({ id: `polymath-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.polymath.resupply.requestedWeek = null;
      c.note('下一批博学者原瓶到货', `第${s.week}周，塞缪尔的独立博学者成品交接渠道本作G成品供给第${s.polymath.resupply.deliveries + 1}批三瓶实际到货，原瓶polymath-potion-${firstNumber}至polymath-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.polymath.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.polymath.detectiveActingAtPromotion = s.progression.acting;
        s.polymath.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of POLYMATH_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为博学者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。阅读者、推理学员与守知者全部原能力及原ID掌握完整继承，新增非凡能力辨析与有限弱化模仿，两项均从0掌握开始；守知者消化成果与守知者晋升周保留，博学者扮演从0开始。灵性上限提高到80，当前灵性没有补满。亲见不等于理解，理解不等于学会；模仿可能失败，成功也弱于原版。不赠封印物2-081或完整技能库，不获得序列5秘术导师的千里仪式入梦或制造。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了博学者晋升' : '博学者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是守知者，消化与全部原有掌握保留，没有获得博学者能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectPolymath(s: SliceState): PolymathProjection {
  const actions: PolymathAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?s.mysticismMagister.polymathActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: PolymathAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.polymath.guidanceKnown) add('learn-polymath-guidance', '请塞缪尔说明博学者成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.polymath.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${POLYMATH_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶博学者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.polymath.resupply.requestedWeek !== null) add('receive-polymath-supply', '确认下一批三瓶博学者到货', `0行动 · 第${s.polymath.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.polymath)) add('request-polymath-supply', '向塞缪尔订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.polymath.guidanceKnown) {
    for (const bottle of s.polymath.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶博学者魔药`, `0行动 · 独立确认 · 守知者消化${isPromoted ? s.polymath.detectiveActingAtPromotion : s.progression.acting}/100 · 晋升后${detectiveWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.polymath.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.polymath.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '博学者 · 序列6' : '博学者之路', discovered: available,
    guidanceKnown: available && s.polymath.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    samples: isPromoted ? POLYMATH_SAMPLES.filter(sample => s.polymath.samples[sample.id].observedWeek !== null).map(sample => ({ ...sample, observed: true, understood: s.polymath.samples[sample.id].understoodWeek !== null, learned: s.polymath.samples[sample.id].learnedWeek !== null })) : [],
    cases: [], environment: '', insideCase: Object.values(s.polymath.cases).some(value => value.contactOpen),
    ...(available ? { story: POLYMATH_SOURCE_STATUS } : {}),
    supplies: available ? `${POLYMATH_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.polymath.resupply.requestedWeek === null ? `已实际接收后续供给${s.polymath.resupply.deliveries}批。` : `第${s.polymath.resupply.requestedWeek}周提出请求，第${s.polymath.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions: s.progression.pathwayId === 'white-tower' && (s.progression.sequence === 2||s.progression.sequence===1) ? [] : actions,
    bottles: available ? s.polymath.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 博学者魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? POLYMATH_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?'博学者魔药已消化；原样本、分析、模仿与真实结束记录保留。':isPromoted ? `守知者消化成果${s.polymath.detectiveActingAtPromotion}/100已保留；博学者扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成守知者消化（${s.progression.acting}/100），并在晋升守知者后度过12整周（${detectiveWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完守知者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${POLYMATH_CONSUMPTION_RISK}` : '成为守知者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isPolymathAcquisitionCommand(command: unknown): command is PolymathAcquisitionCommand {
  return validatePolymathCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validatePolymathCommand(value: unknown): value is PolymathCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^polymath-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^polymath-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'ANALYSE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && POLYMATH_CASE_IDS.includes(value.caseId as typeof POLYMATH_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && POLYMATH_CASE_IDS.includes(value.caseId as typeof POLYMATH_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validatePolymathState(s: SliceState): boolean {
  const raw: unknown = s.polymath;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'detectiveActingAtPromotion', 'cases', 'samples', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.reader) || !record(s.reasoner) || !record(s.detective)) return false;
  const firstDetectiveWeek = s.detective.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstDetectiveWeek + POLYMATH_MIN_DETECTIVE_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== POLYMATH_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, POLYMATH_CASE_IDS) || !record(raw.samples) || !shape(raw.samples, POLYMATH_SAMPLE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'FLASH_IMITATED', 'FLASH_COMPARED', 'FROST_IMITATED', 'WATER_COMPARED', 'COURAGE_IMITATED', 'WORDS_COMPARED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const polymath = raw as unknown as PolymathState, isPromoted = promoted(s);
  if (polymath.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!polymath.guidanceKnown || !integer(s.detective.promotionWeek, 1, s.week) || !integer(polymath.promotionWeek, firstConsumptionWeek, s.week) || polymath.detectiveActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?ALL_KNOWING_EYE_ABILITY_IDS:[]),...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS, ...DETECTIVE_ABILITY_IDS, ...POLYMATH_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?MYSTICISM_MAGISTER_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?PROPHET_ABILITY_IDS:[]),...([3, 2, 1].includes(s.progression.sequence ?? 0)?INSIGHT_SCHOLAR_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?WISDOM_ANGEL_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (polymath.promotionWeek !== null || polymath.detectiveActingAtPromotion !== null || POLYMATH_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (polymath.reflected || Object.values(polymath.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of polymath.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `polymath-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of polymath.bottles.entries()) {
    let stockWeek = firstDetectiveWeek;
    if (index < POLYMATH_BOTTLE_IDS.length) {
      if (bottle.source !== POLYMATH_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!polymath.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / POLYMATH_BOTTLE_IDS.length) - 1;
      if (index % POLYMATH_BOTTLE_IDS.length === 0) {
        const previous = polymath.bottles.slice(index - POLYMATH_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > polymath.promotionWeek!) return false;
    }
    if (!polymath.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > polymath.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > polymath.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== polymath.promotionWeek) return false;
    }
  }
  if (polymath.resupply.requestedWeek !== null && (!polymath.guidanceKnown || isPromoted || !supplyExhausted(polymath) || polymath.bottles.some(bottle => bottle.consumedWeek! > polymath.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = polymath.encounter;
  if (isPromoted && (s.progression.sequence === 2||s.progression.sequence===1) && e.status === 'FIGHTING') return false;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, polymath.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'POLYMATH_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(polymath.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || Object.values(polymath.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'polymath-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validatePolymathLife(s);
}

export { POLYMATH_ABILITIES } from './content.js';
export type * from './types.js';
