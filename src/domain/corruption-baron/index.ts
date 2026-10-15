import { ENTROPY_DUKE_ABILITY_IDS } from '../entropy-duke/types.js';
import {FRENZY_MAGE_ABILITY_IDS} from '../frenzy-mage/types.js';
import {FALLEN_EARL_ABILITY_IDS} from '../fallen-earl/types.js';
import {MENTOR_DISORDER_ABILITY_IDS} from '../mentor-disorder/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { LAWYER_ABILITY_IDS } from '../lawyer/types.js';
import { BARBARIAN_ABILITY_IDS } from '../barbarian/types.js';
import { validateCorruptionBaronLife } from './life.js';
import { BRIBER_ABILITY_IDS } from '../briber/types.js';
import {
  CORRUPTION_BARON_ABILITIES, CORRUPTION_BARON_BOTTLE_IDS, CORRUPTION_BARON_CONSUMPTION_RISK, CORRUPTION_BARON_FORMULA_STATUS,
  CORRUPTION_BARON_GUIDE, CORRUPTION_BARON_LABOUR_TASKS, CORRUPTION_BARON_MIN_BRIBER_WEEKS, CORRUPTION_BARON_POTION_SOURCES, CORRUPTION_BARON_PRICES, CORRUPTION_BARON_SOURCE_STATUS,
} from './content.js';
import {
  CORRUPTION_BARON_ABILITY_IDS, CORRUPTION_BARON_CASE_IDS, type CorruptionBaronAcquisitionCommand, type CorruptionBaronAction,
  type CorruptionBaronBottle, type CorruptionBaronCommand, type CorruptionBaronProjection, type CorruptionBaronState,
} from './types.js';

export function createCorruptionBaronState(): CorruptionBaronState {
  return {
    guidanceKnown: false,
    bottles: CORRUPTION_BARON_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, briberActingAtPromotion: null,
    cases: Object.fromEntries(CORRUPTION_BARON_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { clauseOrder: 'ORIGINAL', marker: 'CRADLED', route: 'READY' },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isBriber = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.lawyer.discovered && s.lawyer.guidanceKnown && s.barbarian.formulaKnown && s.briber.formulaKnown && s.briber.promotionWeek !== null && (isBriber(s) || promoted(s));
const potionPrice = (bottle: CorruptionBaronBottle) => CORRUPTION_BARON_PRICES.potion - (bottle.labourSteps === 5 ? CORRUPTION_BARON_PRICES.labourCredit : 0);
const bottleNumber = (bottle: CorruptionBaronBottle) => Number(bottle.id.slice('corruption-baron-potion-'.length));
const briberWeeks = (s: SliceState) => Math.max(0, (s.corruptionBaron.promotionWeek ?? s.week) - (s.briber.promotionWeek ?? s.week));
const supplyExhausted = (state: CorruptionBaronState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${CORRUPTION_BARON_GUIDE}的独立腐化男爵成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6腐化男爵魔药，原瓶corruption-baron-potion-${number}，非律师、野蛮人或贿赂者旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: CorruptionBaronAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.corruptionBaron.cases).some(value => value.contactOpen)) return '先实际结束本次腐化男爵实践的接触，再继续。';
  if (Object.values(s.briber.cases).some(value => value.contactOpen) || Object.values(s.barbarian.cases).some(value => value.contactOpen) || Object.values(s.lawyer.cases).some(value => value.contactOpen)) return '先实际结束原序列尚未收束的接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原契约铺，找到米蕾·沃德。';
  if (!knownChannel(s)) return '成为贿赂者并保有米蕾·沃德的指导渠道后，才能继续了解腐化男爵之路。';
  if (promoted(s)) return '你已完成腐化男爵晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.corruptionBaron.guidanceKnown) return '已经听过腐化男爵成品魔药的用药说明。';
    return s.cash < CORRUPTION_BARON_PRICES.guidance ? '腐化男爵用药指导需要360便士。' : null;
  }
  if (!s.corruptionBaron.guidanceKnown) return '先听米蕾·沃德说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.corruptionBaron.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.corruptionBaron) ? null : '须先用完现有全部腐化男爵原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.corruptionBaron.resupply.requestedWeek === null) return '尚未申请下一批腐化男爵补给。';
    if (s.week <= s.corruptionBaron.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.corruptionBaron) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.corruptionBaron.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选腐化男爵原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `贿赂者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.briber.promotionWeek === null || briberWeeks(s) < CORRUPTION_BARON_MIN_BRIBER_WEEKS) return `成为贿赂者后已度过${briberWeeks(s)}/${CORRUPTION_BARON_MIN_BRIBER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原契约铺劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyCorruptionBaronCommand(s: SliceState, command: CorruptionBaronAcquisitionCommand, c: SeerContext): void {
  rule(validateCorruptionBaronCommand(command) && isCorruptionBaronAcquisitionCommand(command), '腐化男爵准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= CORRUPTION_BARON_PRICES.guidance;
      s.corruptionBaron.guidanceKnown = true;
      c.note('听取腐化男爵用药说明', `花费1行动、360便士，你向已认识的本作原创成年${CORRUPTION_BARON_GUIDE}继续请教，她向你说明从独立腐化男爵成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的律师、野蛮人或贿赂者存药。${CORRUPTION_BARON_FORMULA_STATUS}贿赂者消化须达100，晋升贿赂者后满12整周才能服用；可提前筹备。${CORRUPTION_BARON_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.corruptionBaron.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = CORRUPTION_BARON_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在米蕾·沃德的原契约铺实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.corruptionBaron.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('腐化男爵原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原契约铺劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；贿赂者消化100且晋升贿赂者后满12整周时，再独立确认服药。${CORRUPTION_BARON_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.corruptionBaron.resupply.requestedWeek = s.week;
      c.note('申请下一批腐化男爵魔药', `现有腐化男爵原瓶全部耗尽且未晋升。你花费1行动，请${CORRUPTION_BARON_GUIDE}从同一新渠道订下一批三瓶，并实际核验原契约铺的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.corruptionBaron.bottles.length + 1;
      s.corruptionBaron.resupply.deliveries += 1;
      for (let offset = 0; offset < CORRUPTION_BARON_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.corruptionBaron.bottles.push({ id: `corruption-baron-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.corruptionBaron.resupply.requestedWeek = null;
      c.note('下一批腐化男爵原瓶到货', `第${s.week}周，米蕾·沃德的独立腐化男爵成品交接渠道本作G成品供给第${s.corruptionBaron.resupply.deliveries + 1}批三瓶实际到货，原瓶corruption-baron-potion-${firstNumber}至corruption-baron-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.corruptionBaron.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.corruptionBaron.briberActingAtPromotion = s.progression.acting;
        s.corruptionBaron.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of CORRUPTION_BARON_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为腐化男爵', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。律师、野蛮人与贿赂者全部原能力及原ID掌握完整继承，只新增扭曲一项，从0掌握开始；贿赂者消化成果与贿赂者晋升周保留，腐化男爵扮演从0开始。灵性上限提高到80，当前灵性没有补满。不赠物件或礼物；只有限偏转既有语言、行动与意图，短效可抵抗，不凭空改写事实或永久控制。继承贿赂不要求目标自愿接下；没有序列5混乱或序列4正式放大、利用。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了腐化男爵晋升' : '腐化男爵魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是贿赂者，消化与全部原有掌握保留，没有获得腐化男爵能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectCorruptionBaron(s: SliceState): CorruptionBaronProjection {
  const actions: CorruptionBaronAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.mentorDisorder.corruptionBaronActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: CorruptionBaronAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.corruptionBaron.guidanceKnown) add('learn-corruption-baron-guidance', '请米蕾·沃德说明腐化男爵成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.corruptionBaron.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${CORRUPTION_BARON_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶腐化男爵魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.corruptionBaron.resupply.requestedWeek !== null) add('receive-corruption-baron-supply', '确认下一批三瓶腐化男爵到货', `0行动 · 第${s.corruptionBaron.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.corruptionBaron)) add('request-corruption-baron-supply', '向米蕾·沃德订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.corruptionBaron.guidanceKnown) {
    for (const bottle of s.corruptionBaron.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶腐化男爵魔药`, `0行动 · 独立确认 · 贿赂者消化${isPromoted ? s.corruptionBaron.briberActingAtPromotion : s.progression.acting}/100 · 晋升后${briberWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.corruptionBaron.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.corruptionBaron.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '腐化男爵 · 序列6' : '腐化男爵之路', discovered: available,
    guidanceKnown: available && s.corruptionBaron.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: { ...s.corruptionBaron.practice },
    gifts: { held: available ? s.briber.gifts.filter(g => g.location === 'PLAYER').length : 0, given: available ? s.briber.gifts.filter(g => g.location === 'GIVEN').length : 0, summary: available ? '沿用贿赂者时期的同一原木筹库存；实际给出后不自动归还，目标未自愿接下也不因此否定贿赂。' : '' },
    cases: [], environment: '', insideCase: Object.values(s.corruptionBaron.cases).some(value => value.contactOpen),
    ...(available ? { story: CORRUPTION_BARON_SOURCE_STATUS } : {}),
    supplies: available ? `${CORRUPTION_BARON_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.corruptionBaron.resupply.requestedWeek === null ? `已实际接收后续供给${s.corruptionBaron.resupply.deliveries}批。` : `第${s.corruptionBaron.resupply.requestedWeek}周提出请求，第${s.corruptionBaron.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.corruptionBaron.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 腐化男爵魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? CORRUPTION_BARON_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `贿赂者消化成果${s.corruptionBaron.briberActingAtPromotion}/100已保留；腐化男爵扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成贿赂者消化（${s.progression.acting}/100），并在晋升贿赂者后度过12整周（${briberWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完贿赂者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${CORRUPTION_BARON_CONSUMPTION_RISK}` : '成为贿赂者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isCorruptionBaronAcquisitionCommand(command: unknown): command is CorruptionBaronAcquisitionCommand {
  return validateCorruptionBaronCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateCorruptionBaronCommand(value: unknown): value is CorruptionBaronCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'BUY_GIFTS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^corruption-baron-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^corruption-baron-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && CORRUPTION_BARON_CASE_IDS.includes(value.caseId as typeof CORRUPTION_BARON_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && CORRUPTION_BARON_CASE_IDS.includes(value.caseId as typeof CORRUPTION_BARON_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateCorruptionBaronState(s: SliceState): boolean {
  const raw: unknown = s.corruptionBaron;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'briberActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.lawyer) || !record(s.barbarian) || !record(s.briber)) return false;
  const firstBriberWeek = s.briber.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstBriberWeek + CORRUPTION_BARON_MIN_BRIBER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== CORRUPTION_BARON_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, CORRUPTION_BARON_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'ORDER_RECORDED', 'ROLL_RECORDED', 'ROUTE_RECORDED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const corruptionBaron = raw as unknown as CorruptionBaronState, isPromoted = promoted(s);
  if (corruptionBaron.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!corruptionBaron.guidanceKnown || !integer(s.briber.promotionWeek, 1, s.week) || !integer(corruptionBaron.promotionWeek, firstConsumptionWeek, s.week) || corruptionBaron.briberActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS, ...BRIBER_ABILITY_IDS, ...CORRUPTION_BARON_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?MENTOR_DISORDER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?FALLEN_EARL_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?FRENZY_MAGE_ABILITY_IDS:[]),...(s.progression.sequence===2?ENTROPY_DUKE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (corruptionBaron.promotionWeek !== null || corruptionBaron.briberActingAtPromotion !== null || CORRUPTION_BARON_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (corruptionBaron.reflected || Object.values(corruptionBaron.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of corruptionBaron.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `corruption-baron-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of corruptionBaron.bottles.entries()) {
    let stockWeek = firstBriberWeek;
    if (index < CORRUPTION_BARON_BOTTLE_IDS.length) {
      if (bottle.source !== CORRUPTION_BARON_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!corruptionBaron.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / CORRUPTION_BARON_BOTTLE_IDS.length) - 1;
      if (index % CORRUPTION_BARON_BOTTLE_IDS.length === 0) {
        const previous = corruptionBaron.bottles.slice(index - CORRUPTION_BARON_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > corruptionBaron.promotionWeek!) return false;
    }
    if (!corruptionBaron.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > corruptionBaron.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > corruptionBaron.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== corruptionBaron.promotionWeek) return false;
    }
  }
  if (corruptionBaron.resupply.requestedWeek !== null && (!corruptionBaron.guidanceKnown || isPromoted || !supplyExhausted(corruptionBaron) || corruptionBaron.bottles.some(bottle => bottle.consumedWeek! > corruptionBaron.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = corruptionBaron.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, corruptionBaron.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'CORRUPTION_BARON_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(corruptionBaron.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.status !== 'ACTIVE' || s.activeEvent !== null || s.world.city !== 'BACKLUND' || Object.values(corruptionBaron.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'corruption-baron-dispute').length;
  // Later actual death cannot erase the old resolved encounter and earned history.
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateCorruptionBaronLife(s);
}

export { CORRUPTION_BARON_ABILITIES } from './content.js';
export type * from './types.js';
