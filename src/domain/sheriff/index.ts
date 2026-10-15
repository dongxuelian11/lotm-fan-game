import {CHAOS_HUNTER_ABILITY_IDS} from '../chaos-hunter/types.js';
import {IMPERATIVE_MAGE_ABILITY_IDS} from '../imperative-mage/types.js';
import {PUNISHMENT_KNIGHT_ABILITY_IDS} from '../punishment-knight/types.js';
import {JUDGE_ABILITY_IDS} from '../judge/types.js';
import {INTERROGATOR_ABILITY_IDS} from '../interrogator/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ARBITER_ABILITY_IDS } from '../arbiter/types.js';
import {
  SHERIFF_ABILITIES, SHERIFF_BOTTLE_IDS, SHERIFF_CONSUMPTION_RISK, SHERIFF_FORMULA_STATUS,
  SHERIFF_GUIDE, SHERIFF_LABOUR_TASKS, SHERIFF_MIN_ARBITER_WEEKS, SHERIFF_POTION_SOURCES, SHERIFF_PRICES, SHERIFF_SOURCE_STATUS,
} from './content.js';
import {
  SHERIFF_ABILITY_IDS, SHERIFF_CASE_IDS, type SheriffAcquisitionCommand, type SheriffAction,
  type SheriffBottle, type SheriffCommand, type SheriffProjection, type SheriffState,
} from './types.js';

export function createSheriffState(): SheriffState {
  return {
    guidanceKnown: false,
    bottles: SHERIFF_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, arbiterActingAtPromotion: null,
    cases: Object.fromEntries(SHERIFF_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'justiciar' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))));
const isArbiter = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.arbiter.discovered && s.arbiter.guidanceKnown && (isArbiter(s) || promoted(s));
const potionPrice = (bottle: SheriffBottle) => SHERIFF_PRICES.potion - (bottle.labourSteps === 3 ? SHERIFF_PRICES.labourCredit : 0);
const bottleNumber = (bottle: SheriffBottle) => Number(bottle.id.slice('sheriff-potion-'.length));
const arbiterWeeks = (s: SliceState) => Math.max(0, (s.sheriff.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const supplyExhausted = (state: SheriffState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SHERIFF_GUIDE}的新进阶成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列8治安官魔药，原瓶sheriff-potion-${number}，非仲裁人旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: SheriffAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.arbiter.cases).some(value => value.contactOpen)) return '先实际结束仲裁人阶段尚未结束的核对与交谈，再继续晋升。';
  if (Object.values(s.sheriff.cases).some(value => value.contactOpen)) return '先实际结束本次治安官实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的调解处，找到薇娜·贝尔。';
  if (!knownChannel(s)) return '成为仲裁人并保有薇娜·贝尔的指导渠道后，才能继续了解治安官之路。';
  if (promoted(s)) return '你已完成治安官晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.sheriff.guidanceKnown) return '已经听过治安官成品魔药的用药说明。';
    return s.cash < SHERIFF_PRICES.guidance ? '治安官用药指导需要180便士。' : null;
  }
  if (!s.sheriff.guidanceKnown) return '先听薇娜·贝尔说明这批序列8原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.sheriff.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.sheriff) ? null : '须先用完现有全部治安官原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.sheriff.resupply.requestedWeek === null) return '尚未申请下一批治安官补给。';
    if (s.week <= s.sheriff.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.sheriff) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.sheriff.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选治安官原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `仲裁人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || arbiterWeeks(s) < SHERIFF_MIN_ARBITER_WEEKS) return `成为仲裁人后已度过${arbiterWeeks(s)}/${SHERIFF_MIN_ARBITER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 3 ? '这瓶对应的三次调解处劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applySheriffCommand(s: SliceState, command: SheriffAcquisitionCommand, c: SeerContext): void {
  rule(validateSheriffCommand(command) && isSheriffAcquisitionCommand(command), '治安官准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SHERIFF_PRICES.guidance;
      s.sheriff.guidanceKnown = true;
      c.note('听取治安官用药说明', `花费1行动、180便士，你向已认识的本作原创成年${SHERIFF_GUIDE}继续请教，她向你说明从新进阶成品交接渠道实际取得的三瓶序列8成品、逐瓶交付与四档风险。这些不是原来的仲裁人存药。${SHERIFF_FORMULA_STATUS}仲裁人消化须达100，首次晋升仲裁人后满4整周才能服用；可提前筹备。${SHERIFF_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.sheriff.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = SHERIFF_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在薇娜·贝尔的调解处实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/3，原瓶仍由导师保管。${bottle.labourSteps === 3 ? '三次劳务只抵这瓶1050便士，仍须实际支付160便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应三次劳务后才能抵这瓶1050便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.sheriff.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('治安官原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列8成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 3 ? '对应三次调解处劳务抵扣1050便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；仲裁人消化100且首次晋升后满4整周时，再独立确认服药。${SHERIFF_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.sheriff.resupply.requestedWeek = s.week;
      c.note('申请下一批治安官魔药', `现有治安官原瓶全部耗尽且未晋升。你花费1行动，请${SHERIFF_GUIDE}从同一新渠道订下一批三瓶，并实际核验调解处的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付1210便士，或分别完成三次劳务后支付160便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.sheriff.bottles.length + 1;
      s.sheriff.resupply.deliveries += 1;
      for (let offset = 0; offset < SHERIFF_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.sheriff.bottles.push({ id: `sheriff-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.sheriff.resupply.requestedWeek = null;
      c.note('下一批治安官原瓶到货', `第${s.week}周，薇娜·贝尔的新进阶成品交接渠道本作G成品供给第${s.sheriff.resupply.deliveries + 1}批三瓶实际到货，原瓶sheriff-potion-${firstNumber}至sheriff-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按1210便士购买，或完成对应三次劳务再付160便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.sheriff.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.sheriff.arbiterActingAtPromotion = s.progression.acting;
        s.sheriff.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of SHERIFF_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 2], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为治安官', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+2、意志+1、知识+1。三项仲裁人能力及原ID掌握完整继承，新增有条件感应与追踪、图像重构，两项均从0掌握开始；仲裁人消化成果和首次晋升周保留，治安官扮演从0开始。灵性上限提高到45，当前灵性没有补满。只能重构亲眼见过的特征，感应须接近且目标没有有效屏蔽，追踪须有已知图像且不能跨越过长间隔；不是道德判罪、全域定位或真相证明，不获得审讯者的精神刺穿、法官的禁止或官方身份。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了治安官晋升' : '治安官魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是仲裁人，消化与三项掌握保留，没有获得治安官能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectSheriff(s: SliceState): SheriffProjection {
  const actions: SheriffAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? (s.progression.sequence===8?s.progression.acting:s.interrogator.sheriffActingAtPromotion??0) : 0;
  const add = (id: string, label: string, cost: string, command: SheriffAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.sheriff.guidanceKnown) add('learn-sheriff-guidance', '请薇娜·贝尔说明治安官成品与风险', '1行动 · 180便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.sheriff.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 3) add(`work-${bottle.id}`, `第${number}瓶 · ${SHERIFF_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/3，完成三次抵该瓶1050便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶治安官魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列8原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.sheriff.resupply.requestedWeek !== null) add('receive-sheriff-supply', '确认下一批三瓶治安官到货', `0行动 · 第${s.sheriff.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.sheriff)) add('request-sheriff-supply', '向薇娜·贝尔订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.sheriff.guidanceKnown) {
    for (const bottle of s.sheriff.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶治安官魔药`, `0行动 · 独立确认 · 仲裁人消化${isPromoted ? s.sheriff.arbiterActingAtPromotion : s.progression.acting}/100 · 晋升后${arbiterWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.sheriff.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.sheriff.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '治安官 · 序列8' : '治安官之路', discovered: available,
    guidanceKnown: available && s.sheriff.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: Object.values(s.sheriff.cases).some(value => value.contactOpen),
    ...(available ? { story: SHERIFF_SOURCE_STATUS } : {}),
    supplies: available ? `${SHERIFF_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.sheriff.resupply.requestedWeek === null ? `已实际接收后续供给${s.sheriff.resupply.deliveries}批。` : `第${s.sheriff.resupply.requestedWeek}周提出请求，第${s.sheriff.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.sheriff.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 治安官魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/3`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SHERIFF_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `仲裁人消化成果${s.sheriff.arbiterActingAtPromotion}/100已保留；治安官扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成仲裁人消化（${s.progression.acting}/100），并在首次晋升仲裁人后度过4整周（${arbiterWeeks(s)}/4）。用药指导与原瓶可以提前准备。` : '先走完仲裁人之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应三次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${SHERIFF_CONSUMPTION_RISK}` : '成为仲裁人后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isSheriffAcquisitionCommand(command: SheriffCommand): command is SheriffAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateSheriffCommand(value: unknown): value is SheriffCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^sheriff-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^sheriff-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SHERIFF_CASE_IDS.includes(value.caseId as typeof SHERIFF_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && SHERIFF_CASE_IDS.includes(value.caseId as typeof SHERIFF_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateSheriffState(s: SliceState): boolean {
  const raw: unknown = s.sheriff;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'arbiterActingAtPromotion', 'cases', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.arbiter)) return false;
  const firstArbiterWeek = s.progression.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstArbiterWeek + SHERIFF_MIN_ARBITER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SHERIFF_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, SHERIFF_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'PORTRAIT_RECORDED', 'LIMIT_RECORDED', 'ROUTE_RECHECKED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const sheriff = raw as unknown as SheriffState, isPromoted = promoted(s);
  if (sheriff.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!sheriff.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(sheriff.promotionWeek, firstConsumptionWeek, s.week) || sheriff.arbiterActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))))?INTERROGATOR_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?JUDGE_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?PUNISHMENT_KNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3)?IMPERATIVE_MAGE_ABILITY_IDS:[]),...(s.progression.sequence===3?CHAOS_HUNTER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (sheriff.promotionWeek !== null || sheriff.arbiterActingAtPromotion !== null || SHERIFF_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (sheriff.reflected || Object.values(sheriff.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of sheriff.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `sheriff-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 3)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of sheriff.bottles.entries()) {
    let stockWeek = firstArbiterWeek;
    if (index < SHERIFF_BOTTLE_IDS.length) {
      if (bottle.source !== SHERIFF_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!sheriff.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SHERIFF_BOTTLE_IDS.length) - 1;
      if (index % SHERIFF_BOTTLE_IDS.length === 0) {
        const previous = sheriff.bottles.slice(index - SHERIFF_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > sheriff.promotionWeek!) return false;
    }
    if (!sheriff.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > sheriff.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > sheriff.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== sheriff.promotionWeek) return false;
    }
  }
  if (sheriff.resupply.requestedWeek !== null && (!sheriff.guidanceKnown || isPromoted || !supplyExhausted(sheriff) || sheriff.bottles.some(bottle => bottle.consumedWeek! > sheriff.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export type * from './types.js';
