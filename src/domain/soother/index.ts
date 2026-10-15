import { MISFORTUNE_KNIGHT_ABILITY_IDS } from '../misfortune-knight/types.js';
import { CONCEALMENT_SERVANT_ABILITY_IDS } from '../concealment-servant/types.js';
import {FEAR_BISHOP_ABILITY_IDS} from '../fear-bishop/types.js';
import {NIGHTWATCHER_ABILITY_IDS} from '../nightwatcher/types.js';
import {SPIRIT_WARLOCK_ABILITY_IDS} from '../spirit-warlock/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SLEEPLESS_ABILITY_IDS } from '../sleepless/types.js';
import { MIDNIGHT_ABILITY_IDS } from '../midnight/types.js';
import { validateSootherLife } from './life.js';
import { NIGHTMARE_ABILITY_IDS } from '../nightmare/types.js';
import {
  SOOTHER_ABILITIES, SOOTHER_BOTTLE_IDS, SOOTHER_CONSUMPTION_RISK, SOOTHER_FORMULA_STATUS,
  SOOTHER_GUIDE, SOOTHER_LABOUR_TASKS, SOOTHER_MIN_NIGHTMARE_WEEKS, SOOTHER_POTION_SOURCES, SOOTHER_PRICES, SOOTHER_SOURCE_STATUS,
} from './content.js';
import {
  SOOTHER_ABILITY_IDS, SOOTHER_CASE_IDS, type SootherAcquisitionCommand, type SootherAction,
  type SootherBottle, type SootherCommand, type SootherProjection, type SootherState,
} from './types.js';

export function createSootherState(): SootherState {
  return {
    guidanceKnown: false,
    bottles: SOOTHER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, nightmareActingAtPromotion: null,
    cases: Object.fromEntries(SOOTHER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0, notes: [], revised: false }])),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, pressure: 0, dreamLocked: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'darkness' && (s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)));
const isNightmare = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.sleepless.discovered && s.sleepless.guidanceKnown && s.midnight.guidanceKnown && s.nightmare.guidanceKnown && s.nightmare.promotionWeek !== null && (isNightmare(s) || promoted(s));
const potionPrice = (bottle: SootherBottle) => SOOTHER_PRICES.potion - (bottle.labourSteps === 5 ? SOOTHER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: SootherBottle) => Number(bottle.id.slice('soother-potion-'.length));
const nightmareWeeks = (s: SliceState) => Math.max(0, (s.soother.promotionWeek ?? s.week) - (s.nightmare.promotionWeek ?? s.week));
const supplyExhausted = (state: SootherState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SOOTHER_GUIDE}的独立安魂师成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6安魂师魔药，原瓶soother-potion-${number}，非不眠者、午夜诗人或梦魇旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: SootherAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.soother.cases).some(value => value.contactOpen)) return '先实际结束本次安魂师实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原值班室，找到赛琳。';
  if (!knownChannel(s)) return '成为梦魇并保有赛琳的指导渠道后，才能继续了解安魂师之路。';
  if (promoted(s)) return '你已完成安魂师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.soother.guidanceKnown) return '已经听过安魂师成品魔药的用药说明。';
    return s.cash < SOOTHER_PRICES.guidance ? '安魂师用药指导需要360便士。' : null;
  }
  if (!s.soother.guidanceKnown) return '先听赛琳说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.soother.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.soother) ? null : '须先用完现有全部安魂师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.soother.resupply.requestedWeek === null) return '尚未申请下一批安魂师补给。';
    if (s.week <= s.soother.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.soother) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.soother.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选安魂师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `梦魇魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.nightmare.promotionWeek === null || nightmareWeeks(s) < SOOTHER_MIN_NIGHTMARE_WEEKS) return `成为梦魇后已度过${nightmareWeeks(s)}/${SOOTHER_MIN_NIGHTMARE_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原值班室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applySootherCommand(s: SliceState, command: SootherAcquisitionCommand, c: SeerContext): void {
  rule(validateSootherCommand(command) && isSootherAcquisitionCommand(command), '安魂师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SOOTHER_PRICES.guidance;
      s.soother.guidanceKnown = true;
      c.note('听取安魂师用药说明', `花费1行动、360便士，你向已认识的本作原创成年${SOOTHER_GUIDE}继续请教，她向你说明从独立安魂师成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的不眠者、午夜诗人或梦魇存药。${SOOTHER_FORMULA_STATUS}梦魇消化须达100，晋升梦魇后满12整周才能服用；可提前筹备。${SOOTHER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.soother.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = SOOTHER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在赛琳的原值班室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.soother.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('安魂师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原值班室劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；梦魇消化100且晋升梦魇后满12整周时，再独立确认服药。${SOOTHER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.soother.resupply.requestedWeek = s.week;
      c.note('申请下一批安魂师魔药', `现有安魂师原瓶全部耗尽且未晋升。你花费1行动，请${SOOTHER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原值班室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.soother.bottles.length + 1;
      s.soother.resupply.deliveries += 1;
      for (let offset = 0; offset < SOOTHER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.soother.bottles.push({ id: `soother-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.soother.resupply.requestedWeek = null;
      c.note('下一批安魂师原瓶到货', `第${s.week}周，赛琳的独立安魂师成品交接渠道本作G成品供给第${s.soother.resupply.deliveries + 1}批三瓶实际到货，原瓶soother-potion-${firstNumber}至soother-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.soother.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.soother.nightmareActingAtPromotion = s.progression.acting;
        s.soother.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of SOOTHER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为安魂师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。不眠者、午夜诗人与梦魇全部原能力及原ID掌握完整继承，新增看见灵体与有限安抚，两项均从0掌握开始；梦魇消化成果与梦魇晋升周保留，安魂师扮演从0开始。灵性上限提高到80，当前灵性没有补满。安抚灵体可能被抵抗，看见不等于知道真相，安抚不等于净化；强烈恐惧烙印也未必能独自消除。继承梦魇的本体不能移动限制，不获得序列5灵巫封灵或放灵助攻。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了安魂师晋升' : '安魂师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是梦魇，消化与全部原有掌握保留，没有获得安魂师能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectSoother(s: SliceState): SootherProjection {
  const actions: SootherAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)))?s.spiritWarlock.sootherActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: SootherAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.soother.guidanceKnown) add('learn-soother-guidance', '请赛琳说明安魂师成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.soother.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${SOOTHER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶安魂师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.soother.resupply.requestedWeek !== null) add('receive-soother-supply', '确认下一批三瓶安魂师到货', `0行动 · 第${s.soother.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.soother)) add('request-soother-supply', '向赛琳订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.soother.guidanceKnown) {
    for (const bottle of s.soother.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶安魂师魔药`, `0行动 · 独立确认 · 梦魇消化${isPromoted ? s.soother.nightmareActingAtPromotion : s.progression.acting}/100 · 晋升后${nightmareWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.soother.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.soother.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '安魂师 · 序列6' : '安魂师之路', discovered: available,
    guidanceKnown: available && s.soother.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: Object.values(s.soother.cases).some(value => value.contactOpen),
    ...(available ? { story: SOOTHER_SOURCE_STATUS } : {}),
    supplies: available ? `${SOOTHER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.soother.resupply.requestedWeek === null ? `已实际接收后续供给${s.soother.resupply.deliveries}批。` : `第${s.soother.resupply.requestedWeek}周提出请求，第${s.soother.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.soother.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 安魂师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SOOTHER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: (s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)))?'安魂师魔药已消化；原安抚、核实与真实结束记录保留。':isPromoted ? `梦魇消化成果${s.soother.nightmareActingAtPromotion}/100已保留；安魂师扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成梦魇消化（${s.progression.acting}/100），并在晋升梦魇后度过12整周（${nightmareWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完梦魇之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${SOOTHER_CONSUMPTION_RISK}` : '成为梦魇后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isSootherAcquisitionCommand(command: unknown): command is SootherAcquisitionCommand {
  return validateSootherCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateSootherCommand(value: unknown): value is SootherCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^soother-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^soother-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SOOTHER_CASE_IDS.includes(value.caseId as typeof SOOTHER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && SOOTHER_CASE_IDS.includes(value.caseId as typeof SOOTHER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateSootherState(s: SliceState): boolean {
  const raw: unknown = s.soother;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'nightmareActingAtPromotion', 'cases', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.sleepless) || !record(s.midnight) || !record(s.nightmare)) return false;
  const firstNightmareWeek = s.nightmare.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstNightmareWeek + SOOTHER_MIN_NIGHTMARE_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SOOTHER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, SOOTHER_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'notes', 'revised'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'WOLF_PACIFIED', 'WOLF_OBSERVED', 'ECHO_COMPARED', 'WINDOW_CHECKED', 'NAME_PACIFIED', 'NAME_RECORDED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0) || !Array.isArray(value.notes) || !value.notes.every(note => typeof note === 'string') || typeof value.revised !== 'boolean') return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const soother = raw as unknown as SootherState, isPromoted = promoted(s);
  if (soother.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!soother.guidanceKnown || !integer(s.nightmare.promotionWeek, 1, s.week) || !integer(soother.promotionWeek, firstConsumptionWeek, s.week) || soother.nightmareActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?MISFORTUNE_KNIGHT_ABILITY_IDS:[]),...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS, ...NIGHTMARE_ABILITY_IDS, ...SOOTHER_ABILITY_IDS,...((s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)))?SPIRIT_WARLOCK_ABILITY_IDS:[]),...(([4, 3, 2, 1].includes(s.progression.sequence ?? 0))?NIGHTWATCHER_ABILITY_IDS:[]),...([3, 2, 1].includes(s.progression.sequence ?? 0) ? FEAR_BISHOP_ABILITY_IDS : []),...((s.progression.sequence === 2||s.progression.sequence===1) ? CONCEALMENT_SERVANT_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (soother.promotionWeek !== null || soother.nightmareActingAtPromotion !== null || SOOTHER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (soother.reflected || Object.values(soother.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0 || value.notes.length !== 0 || value.revised)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of soother.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `soother-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of soother.bottles.entries()) {
    let stockWeek = firstNightmareWeek;
    if (index < SOOTHER_BOTTLE_IDS.length) {
      if (bottle.source !== SOOTHER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!soother.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SOOTHER_BOTTLE_IDS.length) - 1;
      if (index % SOOTHER_BOTTLE_IDS.length === 0) {
        const previous = soother.bottles.slice(index - SOOTHER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > soother.promotionWeek!) return false;
    }
    if (!soother.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > soother.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > soother.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== soother.promotionWeek) return false;
    }
  }
  if (soother.resupply.requestedWeek !== null && (!soother.guidanceKnown || isPromoted || !supplyExhausted(soother) || soother.bottles.some(bottle => bottle.consumedWeek! > soother.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'pressure', 'dreamLocked']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = soother.encounter;
  if (!integer(e.pressure, 0, 2) || typeof e.dreamLocked !== 'boolean' || e.dreamLocked && e.pressure !== 2 || e.status !== 'FIGHTING' && (e.pressure !== 0 || e.dreamLocked)) return false;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, soother.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'SOOTHER_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(soother.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || Object.values(soother.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'soother-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateSootherLife(s);
}

export { SOOTHER_ABILITIES } from './content.js';
export type * from './types.js';
