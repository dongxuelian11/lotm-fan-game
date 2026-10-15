import {WEATHER_WARLOCK_ABILITY_IDS} from '../weather-warlock/types.js';
import { WAR_BISHOP_ABILITY_IDS } from '../war-bishop/types.js';
import { IRON_BLOOD_KNIGHT_ABILITY_IDS } from '../iron-blood-knight/types.js';
import {REAPER_ABILITY_IDS} from '../reaper/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { HUNTER_ABILITY_IDS } from '../hunter/types.js';
import { PROVOKER_ABILITY_IDS } from '../provoker/types.js';
import { validateConspiratorLife } from './life.js';
import { PYROMANIAC_ABILITY_IDS } from '../pyromaniac/types.js';
import {
  CONSPIRATOR_ABILITIES, CONSPIRATOR_BOTTLE_IDS, CONSPIRATOR_CONSUMPTION_RISK, CONSPIRATOR_FORMULA_STATUS,
  CONSPIRATOR_GUIDE, CONSPIRATOR_LABOUR_TASKS, CONSPIRATOR_MIN_PYROMANIAC_WEEKS, CONSPIRATOR_POTION_SOURCES, CONSPIRATOR_PRICES, CONSPIRATOR_SOURCE_STATUS,
} from './content.js';
import {
  CONSPIRATOR_ABILITY_IDS, CONSPIRATOR_CASE_IDS, type ConspiratorAcquisitionCommand, type ConspiratorAction,
  type ConspiratorBottle, type ConspiratorCommand, type ConspiratorProjection, type ConspiratorState,
} from './types.js';

export function createConspiratorState(): ConspiratorState {
  return {
    guidanceKnown: false,
    bottles: CONSPIRATOR_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, pyromaniacActingAtPromotion: null,
    cases: Object.fromEntries(CONSPIRATOR_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0, notes: [], revised: false }])),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hunter' && (s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isPyromaniac = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.hunter.discovered && s.hunter.guidanceKnown && s.provoker.guidanceKnown && s.pyromaniac.guidanceKnown && s.pyromaniac.promotionWeek !== null && (isPyromaniac(s) || promoted(s));
const potionPrice = (bottle: ConspiratorBottle) => CONSPIRATOR_PRICES.potion - (bottle.labourSteps === 5 ? CONSPIRATOR_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ConspiratorBottle) => Number(bottle.id.slice('conspirator-potion-'.length));
const pyromaniacWeeks = (s: SliceState) => Math.max(0, (s.conspirator.promotionWeek ?? s.week) - (s.pyromaniac.promotionWeek ?? s.week));
const supplyExhausted = (state: ConspiratorState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${CONSPIRATOR_GUIDE}的独立阴谋家成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6阴谋家魔药，原瓶conspirator-potion-${number}，非猎人、挑衅者或纵火家旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: ConspiratorAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.conspirator.cases).some(value => value.contactOpen)) return '先实际结束本次阴谋家实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原货栈，找到索伦·里奇。';
  if (!knownChannel(s)) return '成为纵火家并保有索伦·里奇的指导渠道后，才能继续了解阴谋家之路。';
  if (promoted(s)) return '你已完成阴谋家晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.conspirator.guidanceKnown) return '已经听过阴谋家成品魔药的用药说明。';
    return s.cash < CONSPIRATOR_PRICES.guidance ? '阴谋家用药指导需要360便士。' : null;
  }
  if (!s.conspirator.guidanceKnown) return '先听索伦·里奇说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.conspirator.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.conspirator) ? null : '须先用完现有全部阴谋家原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.conspirator.resupply.requestedWeek === null) return '尚未申请下一批阴谋家补给。';
    if (s.week <= s.conspirator.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.conspirator) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.conspirator.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选阴谋家原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `纵火家魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.pyromaniac.promotionWeek === null || pyromaniacWeeks(s) < CONSPIRATOR_MIN_PYROMANIAC_WEEKS) return `成为纵火家后已度过${pyromaniacWeeks(s)}/${CONSPIRATOR_MIN_PYROMANIAC_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原货栈劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyConspiratorCommand(s: SliceState, command: ConspiratorAcquisitionCommand, c: SeerContext): void {
  rule(validateConspiratorCommand(command) && isConspiratorAcquisitionCommand(command), '阴谋家准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= CONSPIRATOR_PRICES.guidance;
      s.conspirator.guidanceKnown = true;
      c.note('听取阴谋家用药说明', `花费1行动、360便士，你向已认识的本作原创成年${CONSPIRATOR_GUIDE}继续请教，他向你说明从独立阴谋家成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的猎人或纵火家存药。${CONSPIRATOR_FORMULA_STATUS}纵火家消化须达100，晋升纵火家后满12整周才能服用；可提前筹备。${CONSPIRATOR_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.conspirator.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = CONSPIRATOR_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在索伦·里奇的原货栈实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.conspirator.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('阴谋家原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原货栈劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；纵火家消化100且晋升纵火家后满12整周时，再独立确认服药。${CONSPIRATOR_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.conspirator.resupply.requestedWeek = s.week;
      c.note('申请下一批阴谋家魔药', `现有阴谋家原瓶全部耗尽且未晋升。你花费1行动，请${CONSPIRATOR_GUIDE}从同一新渠道订下一批三瓶，并实际核验原货栈的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.conspirator.bottles.length + 1;
      s.conspirator.resupply.deliveries += 1;
      for (let offset = 0; offset < CONSPIRATOR_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.conspirator.bottles.push({ id: `conspirator-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.conspirator.resupply.requestedWeek = null;
      c.note('下一批阴谋家原瓶到货', `第${s.week}周，索伦·里奇的独立阴谋家成品交接渠道本作G成品供给第${s.conspirator.resupply.deliveries + 1}批三瓶实际到货，原瓶conspirator-potion-${firstNumber}至conspirator-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.conspirator.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.conspirator.pyromaniacActingAtPromotion = s.progression.acting;
        s.conspirator.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of CONSPIRATOR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为阴谋家', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。猎人、挑衅者与纵火家全部原能力及原ID掌握完整继承，新增有据谋划与针对性说服，两项均从0掌握开始；纵火家消化成果与纵火家晋升周保留，阴谋家扮演从0开始。灵性上限提高到80，当前灵性没有补满。推理有情报仍会失败，说服依赖已核事实和对象真实利益，对方可以拒绝；不使人降智、不洗脑、不获得序列5弱点收割或固定穿防。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了阴谋家晋升' : '阴谋家魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是纵火家，消化与全部原有掌握保留，没有获得阴谋家能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectConspirator(s: SliceState): ConspiratorProjection {
  const actions: ConspiratorAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.reaper.conspiratorActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: ConspiratorAcquisitionCommand) => {
    if (isPromoted && (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))) return;
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.conspirator.guidanceKnown) add('learn-conspirator-guidance', '请索伦·里奇说明阴谋家成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.conspirator.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${CONSPIRATOR_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶阴谋家魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.conspirator.resupply.requestedWeek !== null) add('receive-conspirator-supply', '确认下一批三瓶阴谋家到货', `0行动 · 第${s.conspirator.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.conspirator)) add('request-conspirator-supply', '向索伦·里奇订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.conspirator.guidanceKnown) {
    for (const bottle of s.conspirator.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶阴谋家魔药`, `0行动 · 独立确认 · 纵火家消化${isPromoted ? s.conspirator.pyromaniacActingAtPromotion : s.progression.acting}/100 · 晋升后${pyromaniacWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.conspirator.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.conspirator.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '阴谋家 · 序列6' : '阴谋家之路', discovered: available,
    guidanceKnown: available && s.conspirator.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: Object.values(s.conspirator.cases).some(value => value.contactOpen),
    ...(available ? { story: CONSPIRATOR_SOURCE_STATUS } : {}),
    supplies: available ? `${CONSPIRATOR_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.conspirator.resupply.requestedWeek === null ? `已实际接收后续供给${s.conspirator.resupply.deliveries}批。` : `第${s.conspirator.resupply.requestedWeek}周提出请求，第${s.conspirator.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.conspirator.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 阴谋家魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? CONSPIRATOR_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?'阴谋家魔药已消化；原方案、本人拒绝与修订记录保留。':isPromoted ? `纵火家消化成果${s.conspirator.pyromaniacActingAtPromotion}/100已保留；阴谋家扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成纵火家消化（${s.progression.acting}/100），并在晋升纵火家后度过12整周（${pyromaniacWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完纵火家之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${CONSPIRATOR_CONSUMPTION_RISK}` : '成为纵火家后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isConspiratorAcquisitionCommand(command: unknown): command is ConspiratorAcquisitionCommand {
  return validateConspiratorCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateConspiratorCommand(value: unknown): value is ConspiratorCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^conspirator-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^conspirator-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && CONSPIRATOR_CASE_IDS.includes(value.caseId as typeof CONSPIRATOR_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && CONSPIRATOR_CASE_IDS.includes(value.caseId as typeof CONSPIRATOR_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateConspiratorState(s: SliceState): boolean {
  const raw: unknown = s.conspirator;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'pyromaniacActingAtPromotion', 'cases', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.hunter) || !record(s.provoker) || !record(s.pyromaniac)) return false;
  const firstPyromaniacWeek = s.pyromaniac.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstPyromaniacWeek + CONSPIRATOR_MIN_PYROMANIAC_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== CONSPIRATOR_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, CONSPIRATOR_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'notes', 'revised'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'ROSTERS_CHECKED', 'DETOUR_REVISED', 'BACKUP_USED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0) || !Array.isArray(value.notes) || !value.notes.every(note => typeof note === 'string') || typeof value.revised !== 'boolean') return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const conspirator = raw as unknown as ConspiratorState, isPromoted = promoted(s);
  if (conspirator.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!conspirator.guidanceKnown || !integer(s.pyromaniac.promotionWeek, 1, s.week) || !integer(conspirator.promotionWeek, firstConsumptionWeek, s.week) || conspirator.pyromaniacActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===2?WEATHER_WARLOCK_ABILITY_IDS:[]),...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS, ...PYROMANIAC_ABILITY_IDS, ...CONSPIRATOR_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?REAPER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?IRON_BLOOD_KNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?WAR_BISHOP_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (conspirator.promotionWeek !== null || conspirator.pyromaniacActingAtPromotion !== null || CONSPIRATOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (conspirator.reflected || Object.values(conspirator.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0 || value.notes.length !== 0 || value.revised)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of conspirator.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `conspirator-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of conspirator.bottles.entries()) {
    let stockWeek = firstPyromaniacWeek;
    if (index < CONSPIRATOR_BOTTLE_IDS.length) {
      if (bottle.source !== CONSPIRATOR_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!conspirator.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / CONSPIRATOR_BOTTLE_IDS.length) - 1;
      if (index % CONSPIRATOR_BOTTLE_IDS.length === 0) {
        const previous = conspirator.bottles.slice(index - CONSPIRATOR_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > conspirator.promotionWeek!) return false;
    }
    if (!conspirator.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > conspirator.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > conspirator.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== conspirator.promotionWeek) return false;
    }
  }
  if (conspirator.resupply.requestedWeek !== null && (!conspirator.guidanceKnown || isPromoted || !supplyExhausted(conspirator) || conspirator.bottles.some(bottle => bottle.consumedWeek! > conspirator.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = conspirator.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, conspirator.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'CONSPIRATOR_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(conspirator.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && Object.values(conspirator.cases).some(r => r.contactOpen)) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'conspirator-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateConspiratorLife(s);
}

export { CONSPIRATOR_ABILITIES } from './content.js';
export type * from './types.js';
