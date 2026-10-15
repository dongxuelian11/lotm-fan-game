import {DEATH_CONSUL_ABILITY_IDS} from '../death-consul/types.js';
import {FERRYMAN_ABILITY_IDS} from '../ferryman/types.js';
import {UNDYING_ABILITY_IDS} from '../undying/types.js';
import {GATEKEEPER_ABILITY_IDS} from '../gatekeeper/types.js';
import {SPIRIT_GUIDE_ABILITY_IDS} from '../spirit-guide/types.js';
import {SPIRITMEDIUM_ABILITY_IDS} from '../spiritmedium/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../corpsecollector/types.js';
import {
  GRAVEDIGGER_ABILITIES, GRAVEDIGGER_BOTTLE_IDS, GRAVEDIGGER_CONSUMPTION_RISK, GRAVEDIGGER_FORMULA_STATUS,
  GRAVEDIGGER_GUIDE, GRAVEDIGGER_LABOUR_TASKS, GRAVEDIGGER_MIN_CORPSECOLLECTOR_WEEKS, GRAVEDIGGER_POTION_SOURCES, GRAVEDIGGER_PRICES, GRAVEDIGGER_SOURCE_STATUS,
} from './content.js';
import {
  GRAVEDIGGER_ABILITY_IDS, GRAVEDIGGER_CASE_IDS, type GravediggerAcquisitionCommand, type GravediggerAction,
  type GravediggerBottle, type GravediggerCommand, type GravediggerProjection, type GravediggerState,
} from './types.js';

export function createGravediggerState(): GravediggerState {
  return {
    guidanceKnown: false,
    bottles: GRAVEDIGGER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, corpsecollectorActingAtPromotion: null,
    cases: Object.fromEntries(GRAVEDIGGER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, mistakes: 0, conclusion: null }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'death' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isCorpsecollector = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.corpsecollector.discovered && s.corpsecollector.guidanceKnown && (isCorpsecollector(s) || promoted(s));
const potionPrice = (bottle: GravediggerBottle) => GRAVEDIGGER_PRICES.potion - (bottle.labourSteps === 3 ? GRAVEDIGGER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: GravediggerBottle) => Number(bottle.id.slice('gravedigger-potion-'.length));
const corpsecollectorWeeks = (s: SliceState) => Math.max(0, (s.gravedigger.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const supplyExhausted = (state: GravediggerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${GRAVEDIGGER_GUIDE}的新墓园器具库交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列8掘墓人魔药，原瓶gravedigger-potion-${number}，非收尸人旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: GravediggerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的独立殓房收货处，找到伊芙琳·沃斯。';
  if (!knownChannel(s)) return '成为收尸人并保有伊芙琳·沃斯的指导渠道后，才能继续掘墓人之路。';
  if (promoted(s)) return '你已完成掘墓人晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.gravedigger.guidanceKnown) return '已经听过掘墓人成品魔药的用药说明。';
    return s.cash < GRAVEDIGGER_PRICES.guidance ? '掘墓人用药指导需要180便士。' : null;
  }
  if (!s.gravedigger.guidanceKnown) return '先听伊芙琳·沃斯说明这批序列8原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.gravedigger.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.gravedigger) ? null : '须先用完现有全部掘墓人原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.gravedigger.resupply.requestedWeek === null) return '尚未申请下一批掘墓人补给。';
    if (s.week <= s.gravedigger.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.gravedigger) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.gravedigger.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选掘墓人原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `收尸人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || corpsecollectorWeeks(s) < GRAVEDIGGER_MIN_CORPSECOLLECTOR_WEEKS) return `成为收尸人后已度过${corpsecollectorWeeks(s)}/${GRAVEDIGGER_MIN_CORPSECOLLECTOR_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 3 ? '这瓶对应的三次殓房收货处劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyGravediggerCommand(s: SliceState, command: GravediggerAcquisitionCommand, c: SeerContext): void {
  rule(validateGravediggerCommand(command) && isGravediggerAcquisitionCommand(command), '掘墓人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= GRAVEDIGGER_PRICES.guidance;
      s.gravedigger.guidanceKnown = true;
      c.note('听取掘墓人用药说明', `花费1行动、180便士，${GRAVEDIGGER_GUIDE}向你说明从新墓园器具库交接渠道实际取得的三瓶序列8成品、逐瓶交付与四档风险。这些不是原来的收尸人存药。${GRAVEDIGGER_FORMULA_STATUS}收尸人消化须达100，首次晋升收尸人后满4整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.gravedigger.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = GRAVEDIGGER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊芙琳·沃斯的独立殓房收货处实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/3，原瓶仍由导师保管。${bottle.labourSteps === 3 ? '三次劳务只抵这瓶1050便士，仍须实际支付160便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应三次劳务后才能抵这瓶1050便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.gravedigger.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('掘墓人原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列8成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 3 ? '对应三次殓房收货处劳务抵扣1050便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；收尸人消化100且首次晋升后满4整周时，再独立确认服药。${GRAVEDIGGER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.gravedigger.resupply.requestedWeek = s.week;
      c.note('申请下一批掘墓人魔药', `现有掘墓人原瓶全部耗尽且未晋升。你花费1行动，请${GRAVEDIGGER_GUIDE}从同一新渠道订下一批三瓶，并实际核验独立殓房收货处的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付1210便士，或分别完成三次劳务后支付160便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.gravedigger.bottles.length + 1;
      s.gravedigger.resupply.deliveries += 1;
      for (let offset = 0; offset < GRAVEDIGGER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.gravedigger.bottles.push({ id: `gravedigger-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.gravedigger.resupply.requestedWeek = null;
      c.note('下一批掘墓人原瓶到货', `第${s.week}周，伊芙琳·沃斯的新墓园器具库交接渠道本作G成品供给第${s.gravedigger.resupply.deliveries + 1}批三瓶实际到货，原瓶gravedigger-potion-${firstNumber}至gravedigger-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按1210便士购买，或完成对应三次劳务再付160便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.gravedigger.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.gravedigger.corpsecollectorActingAtPromotion = s.progression.acting;
        s.gravedigger.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of GRAVEDIGGER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 3], ['perception', 3], ['will', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为掘墓人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+3、感知+3、意志+1，知识不变。三项收尸人能力及掌握完整继承，死亡之眼与初步灵体沟通从0掌握开始；收尸人消化成果和首次晋升周保留，掘墓人扮演从0开始。灵性上限提高到45，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了掘墓人晋升' : '掘墓人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是收尸人，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectGravedigger(s: SliceState): GravediggerProjection {
  const actions: GravediggerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: GravediggerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.gravedigger.guidanceKnown) add('learn-gravedigger-guidance', '请伊芙琳·沃斯说明掘墓人成品与风险', '1行动 · 180便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.gravedigger.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 3) add(`work-${bottle.id}`, `第${number}瓶 · ${GRAVEDIGGER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/3，完成三次抵该瓶1050便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶掘墓人魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列8原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.gravedigger.resupply.requestedWeek !== null) add('receive-gravedigger-supply', '确认下一批三瓶掘墓人到货', `0行动 · 第${s.gravedigger.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.gravedigger)) add('request-gravedigger-supply', '向伊芙琳·沃斯订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.gravedigger.guidanceKnown) {
    for (const bottle of s.gravedigger.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶掘墓人魔药`, `0行动 · 独立确认 · 收尸人消化${isPromoted ? s.gravedigger.corpsecollectorActingAtPromotion : s.progression.acting}/100 · 晋升后${corpsecollectorWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.gravedigger.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.gravedigger.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '掘墓人 · 序列8' : '掘墓人之路', discovered: available,
    guidanceKnown: available && s.gravedigger.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '',
    ...(available ? { story: GRAVEDIGGER_SOURCE_STATUS } : {}),
    supplies: available ? `${GRAVEDIGGER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.gravedigger.resupply.requestedWeek === null ? `已实际接收后续供给${s.gravedigger.resupply.deliveries}批。` : `第${s.gravedigger.resupply.requestedWeek}周提出请求，第${s.gravedigger.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.gravedigger.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 掘墓人魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/3`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? GRAVEDIGGER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?(s.spiritmedium.gravediggerActingAtPromotion??100):s.progression.acting) : 0,
    digestion: isPromoted ? `收尸人消化成果${s.gravedigger.corpsecollectorActingAtPromotion}/100已保留；掘墓人扮演${(s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?(s.spiritmedium.gravediggerActingAtPromotion??100):s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成收尸人消化（${s.progression.acting}/100），并在首次晋升收尸人后度过4整周（${corpsecollectorWeeks(s)}/4）。用药指导与原瓶可以提前准备。` : '先走完收尸人之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应三次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${GRAVEDIGGER_CONSUMPTION_RISK}` : '成为收尸人后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isGravediggerAcquisitionCommand(command: GravediggerCommand): command is GravediggerAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateGravediggerCommand(value: unknown): value is GravediggerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^gravedigger-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^gravedigger-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && GRAVEDIGGER_CASE_IDS.includes(value.caseId as typeof GRAVEDIGGER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && GRAVEDIGGER_CASE_IDS.includes(value.caseId as typeof GRAVEDIGGER_CASE_IDS[number]) && ['SPIRIT', 'ORDINARY'].includes(value.method as string);
  if (value.type === 'REPORT') return shape(value, ['type', 'caseId', 'conclusion']) && GRAVEDIGGER_CASE_IDS.includes(value.caseId as typeof GRAVEDIGGER_CASE_IDS[number]) && ['LIMITED', 'COMMAND'].includes(value.conclusion as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful examination/report transitions and exact source gates. */
export function validateGravediggerState(s: SliceState): boolean {
  const raw: unknown = s.gravedigger;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'corpsecollectorActingAtPromotion', 'cases', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.corpsecollector)) return false;
  const firstCorpsecollectorWeek = s.progression.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstCorpsecollectorWeek + GRAVEDIGGER_MIN_CORPSECOLLECTOR_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== GRAVEDIGGER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, GRAVEDIGGER_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'mistakes', 'conclusion'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || (!integer(value.withdrawals, 0) || !integer(value.mistakes, 0))) return false;
    if (value.method !== null && !['SPIRIT', 'ORDINARY'].includes(value.method as string)) return false;
    if (value.conclusion !== null && !['LIMITED', 'COMMAND'].includes(value.conclusion as string)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const gravedigger = raw as unknown as GravediggerState, isPromoted = promoted(s);
  if (gravedigger.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!gravedigger.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(gravedigger.promotionWeek, firstConsumptionWeek, s.week) || gravedigger.corpsecollectorActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?SPIRITMEDIUM_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?SPIRIT_GUIDE_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?GATEKEEPER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?UNDYING_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?FERRYMAN_ABILITY_IDS:[]),...(s.progression.sequence===2?DEATH_CONSUL_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (gravedigger.promotionWeek !== null || gravedigger.corpsecollectorActingAtPromotion !== null || GRAVEDIGGER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (gravedigger.reflected || Object.values(gravedigger.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.conclusion !== null || value.withdrawals !== 0 || value.mistakes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of gravedigger.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `gravedigger-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 3)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of gravedigger.bottles.entries()) {
    let stockWeek = firstCorpsecollectorWeek;
    if (index < GRAVEDIGGER_BOTTLE_IDS.length) {
      if (bottle.source !== GRAVEDIGGER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!gravedigger.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / GRAVEDIGGER_BOTTLE_IDS.length) - 1;
      if (index % GRAVEDIGGER_BOTTLE_IDS.length === 0) {
        const previous = gravedigger.bottles.slice(index - GRAVEDIGGER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > gravedigger.promotionWeek!) return false;
    }
    if (!gravedigger.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > gravedigger.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > gravedigger.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== gravedigger.promotionWeek) return false;
    }
  }
  if (gravedigger.resupply.requestedWeek !== null && (!gravedigger.guidanceKnown || isPromoted || !supplyExhausted(gravedigger) || gravedigger.bottles.some(bottle => bottle.consumedWeek! > gravedigger.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export type * from './types.js';
