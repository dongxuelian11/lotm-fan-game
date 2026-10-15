import { ANCIENT_EVIL_ABILITY_IDS } from '../ancient-evil/types.js';
import {SILENT_DISCIPLE_ABILITY_IDS} from '../silent-disciple/types.js';
import {PUPPET_ABILITY_IDS} from '../puppet/types.js';
import {WRAITH_ABILITY_IDS} from '../wraith/types.js';
import {ZOMBIE_ABILITY_IDS} from '../zombie/types.js';
import {WEREWOLF_ABILITY_IDS} from '../werewolf/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRISONER_ABILITY_IDS } from '../prisoner/types.js';
import {
  MADMAN_ABILITIES, MADMAN_BOTTLE_IDS, MADMAN_CONSUMPTION_RISK, MADMAN_FORMULA_STATUS,
  MADMAN_GUIDE, MADMAN_LABOUR_TASKS, MADMAN_MIN_PRISONER_WEEKS, MADMAN_POTION_SOURCES, MADMAN_PRICES, MADMAN_SOURCE_STATUS,
} from './content.js';
import {
  MADMAN_ABILITY_IDS, MADMAN_CASE_IDS, type MadmanAcquisitionCommand, type MadmanAction,
  type MadmanBottle, type MadmanCommand, type MadmanProjection, type MadmanState,
} from './types.js';

export function createMadmanState(): MadmanState {
  return {
    guidanceKnown: false,
    bottles: MADMAN_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, prisonerActingAtPromotion: null,
    cases: Object.fromEntries(MADMAN_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', burstOpen: false, stops: 0, burstUses: 0 }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'chained' && [8, 7, 6, 5, 4, 3, 2].includes(s.progression.sequence!);
const isPrisoner = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.prisoner.discovered && s.prisoner.guidanceKnown && (isPrisoner(s) || promoted(s));
const potionPrice = (bottle: MadmanBottle) => MADMAN_PRICES.potion - (bottle.labourSteps === 3 ? MADMAN_PRICES.labourCredit : 0);
const bottleNumber = (bottle: MadmanBottle) => Number(bottle.id.slice('madman-potion-'.length));
const prisonerWeeks = (s: SliceState) => Math.max(0, (s.madman.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const supplyExhausted = (state: MadmanState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${MADMAN_GUIDE}的新进阶成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列8疯子魔药，原瓶madman-potion-${number}，非囚犯旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: MadmanAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.prisoner.cases).some(value => value.holding)) return '先实际归还囚犯阶段原木垫块PR9-STOP-01，再继续晋升。';
  if (Object.values(s.madman.cases).some(value => value.burstOpen)) return '先实际停止并结束本次尚未收束的实践，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的旧工坊，找到哈伦·维斯。';
  if (!knownChannel(s)) return '成为囚犯并保有哈伦·维斯的指导渠道后，才能继续了解疯子之路。';
  if (promoted(s)) return '你已完成疯子晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.madman.guidanceKnown) return '已经听过疯子成品魔药的用药说明。';
    return s.cash < MADMAN_PRICES.guidance ? '疯子用药指导需要180便士。' : null;
  }
  if (!s.madman.guidanceKnown) return '先听哈伦·维斯说明这批序列8原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.madman.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.madman) ? null : '须先用完现有全部疯子原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.madman.resupply.requestedWeek === null) return '尚未申请下一批疯子补给。';
    if (s.week <= s.madman.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.madman) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.madman.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选疯子原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `囚犯魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || prisonerWeeks(s) < MADMAN_MIN_PRISONER_WEEKS) return `成为囚犯后已度过${prisonerWeeks(s)}/${MADMAN_MIN_PRISONER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 3 ? '这瓶对应的三次旧工坊劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyMadmanCommand(s: SliceState, command: MadmanAcquisitionCommand, c: SeerContext): void {
  rule(validateMadmanCommand(command) && isMadmanAcquisitionCommand(command), '疯子准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= MADMAN_PRICES.guidance;
      s.madman.guidanceKnown = true;
      c.note('听取疯子用药说明', `花费1行动、180便士，你向已认识的本作原创成年${MADMAN_GUIDE}继续请教，他向你说明从新进阶成品交接渠道实际取得的三瓶序列8成品、逐瓶交付与四档风险。这些不是原来的囚犯存药。${MADMAN_FORMULA_STATUS}囚犯消化须达100，首次晋升囚犯后满4整周才能服用；可提前筹备。${MADMAN_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.madman.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = MADMAN_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在哈伦·维斯的旧工坊实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/3，原瓶仍由导师保管。${bottle.labourSteps === 3 ? '三次劳务只抵这瓶1050便士，仍须实际支付160便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应三次劳务后才能抵这瓶1050便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.madman.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('疯子原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列8成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 3 ? '对应三次旧工坊劳务抵扣1050便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；囚犯消化100且首次晋升后满4整周时，再独立确认服药。${MADMAN_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.madman.resupply.requestedWeek = s.week;
      c.note('申请下一批疯子魔药', `现有疯子原瓶全部耗尽且未晋升。你花费1行动，请${MADMAN_GUIDE}从同一新渠道订下一批三瓶，并实际核验旧工坊的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付1210便士，或分别完成三次劳务后支付160便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.madman.bottles.length + 1;
      s.madman.resupply.deliveries += 1;
      for (let offset = 0; offset < MADMAN_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.madman.bottles.push({ id: `madman-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.madman.resupply.requestedWeek = null;
      c.note('下一批疯子原瓶到货', `第${s.week}周，哈伦·维斯的新进阶成品交接渠道本作G成品供给第${s.madman.resupply.deliveries + 1}批三瓶实际到货，原瓶madman-potion-${firstNumber}至madman-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按1210便士购买，或完成对应三次劳务再付160便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.madman.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.madman.prisonerActingAtPromotion = s.progression.acting;
        s.madman.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of MADMAN_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为疯子', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识不增加。三项囚犯能力及原ID掌握完整继承，新增牺牲当前理智与部分精神抵抗，两项均从0掌握开始；不下放狼人或活尸能力；囚犯消化成果和首次晋升周保留，疯子扮演从0开始。灵性上限提高到45，当前灵性没有补满。晋升没有自动激活爆发；之后只有玩家选择并实际执行才消耗10精神与2灵性换取有限增强，停止不恢复精神或退款。序列名称不是现实诊断；节制与成长不保证消除诅咒。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了疯子晋升' : '疯子魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是囚犯，消化与三项掌握保留，没有自动激活疯子爆发。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectMadman(s: SliceState): MadmanProjection {
  const actions: MadmanAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? (s.progression.sequence===8?s.progression.acting:s.werewolf.madmanActingAtPromotion??0) : 0;
  const add = (id: string, label: string, cost: string, command: MadmanAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.madman.guidanceKnown) add('learn-madman-guidance', '请哈伦·维斯说明疯子成品与风险', '1行动 · 180便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.madman.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 3) add(`work-${bottle.id}`, `第${number}瓶 · ${MADMAN_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/3，完成三次抵该瓶1050便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶疯子魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列8原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.madman.resupply.requestedWeek !== null) add('receive-madman-supply', '确认下一批三瓶疯子到货', `0行动 · 第${s.madman.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.madman)) add('request-madman-supply', '向哈伦·维斯订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.madman.guidanceKnown) {
    for (const bottle of s.madman.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶疯子魔药`, `0行动 · 独立确认 · 囚犯消化${isPromoted ? s.madman.prisonerActingAtPromotion : s.progression.acting}/100 · 晋升后${prisonerWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.madman.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.madman.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '疯子 · 序列8' : '疯子之路', discovered: available,
    guidanceKnown: available && s.madman.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: Object.values(s.madman.cases).some(value => value.burstOpen),
    ...(available ? { story: MADMAN_SOURCE_STATUS } : {}),
    supplies: available ? `${MADMAN_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.madman.resupply.requestedWeek === null ? `已实际接收后续供给${s.madman.resupply.deliveries}批。` : `第${s.madman.resupply.requestedWeek}周提出请求，第${s.madman.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.madman.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 疯子魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/3`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? MADMAN_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `囚犯消化成果${s.madman.prisonerActingAtPromotion}/100已保留；疯子扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成囚犯消化（${s.progression.acting}/100），并在首次晋升囚犯后度过4整周（${prisonerWeeks(s)}/4）。用药指导与原瓶可以提前准备。` : '先走完囚犯之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应三次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${MADMAN_CONSUMPTION_RISK}` : '成为囚犯后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isMadmanAcquisitionCommand(command: MadmanCommand): command is MadmanAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateMadmanCommand(value: unknown): value is MadmanCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^madman-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^madman-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'STOP', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && MADMAN_CASE_IDS.includes(value.caseId as typeof MADMAN_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && MADMAN_CASE_IDS.includes(value.caseId as typeof MADMAN_CASE_IDS[number]) && ['BURST', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateMadmanState(s: SliceState): boolean {
  const raw: unknown = s.madman;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'prisonerActingAtPromotion', 'cases', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.prisoner)) return false;
  const firstPrisonerWeek = s.progression.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstPrisonerWeek + MADMAN_MIN_PRISONER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== MADMAN_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, MADMAN_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'burstOpen', 'stops', 'burstUses'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['BURST', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'STOP_HEEDED', 'GATE_RELEASED', 'NOTE_SET_ASIDE'].includes(value.outcome as string)) return false;
    if (typeof value.burstOpen !== 'boolean' || !integer(value.stops, 0) || !integer(value.burstUses, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const madman = raw as unknown as MadmanState, isPromoted = promoted(s);
  if (madman.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!madman.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(madman.promotionWeek, firstConsumptionWeek, s.week) || madman.prisonerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...PRISONER_ABILITY_IDS, ...([8, 7, 6, 5, 4, 3, 2].includes(s.progression.sequence!) ? MADMAN_ABILITY_IDS : []), ...([7, 6, 5, 4, 3, 2].includes(s.progression.sequence!) ? WEREWOLF_ABILITY_IDS : []), ...([6, 5, 4, 3, 2].includes(s.progression.sequence!) ? ZOMBIE_ABILITY_IDS : []), ...([5, 4, 3, 2].includes(s.progression.sequence!) ? WRAITH_ABILITY_IDS : []), ...([4, 3, 2].includes(s.progression.sequence!) ? PUPPET_ABILITY_IDS : []), ...([3, 2].includes(s.progression.sequence!) ? SILENT_DISCIPLE_ABILITY_IDS : []), ...(s.progression.sequence === 2 ? ANCIENT_EVIL_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (madman.promotionWeek !== null || madman.prisonerActingAtPromotion !== null || MADMAN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (madman.reflected || Object.values(madman.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.burstOpen || value.stops !== 0 || value.burstUses !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of madman.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `madman-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 3)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of madman.bottles.entries()) {
    let stockWeek = firstPrisonerWeek;
    if (index < MADMAN_BOTTLE_IDS.length) {
      if (bottle.source !== MADMAN_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!madman.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / MADMAN_BOTTLE_IDS.length) - 1;
      if (index % MADMAN_BOTTLE_IDS.length === 0) {
        const previous = madman.bottles.slice(index - MADMAN_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > madman.promotionWeek!) return false;
    }
    if (!madman.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > madman.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > madman.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== madman.promotionWeek) return false;
    }
  }
  if (madman.resupply.requestedWeek !== null && (!madman.guidanceKnown || isPromoted || !supplyExhausted(madman) || madman.bottles.some(bottle => bottle.consumedWeek! > madman.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export type * from './types.js';
