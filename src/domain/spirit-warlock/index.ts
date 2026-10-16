import { MISFORTUNE_KNIGHT_ABILITY_IDS } from '../misfortune-knight/types.js';
import { CONCEALMENT_SERVANT_ABILITY_IDS } from '../concealment-servant/types.js';
import {FEAR_BISHOP_ABILITY_IDS} from '../fear-bishop/types.js';
import {NIGHTWATCHER_ABILITY_IDS} from '../nightwatcher/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SLEEPLESS_ABILITY_IDS } from '../sleepless/types.js';
import { MIDNIGHT_ABILITY_IDS } from '../midnight/types.js';
import { validateSpiritWarlockLife } from './life.js';
import { validateSpiritWarlockEncounter } from './encounter.js';
import { SOOTHER_ABILITY_IDS } from '../soother/types.js';
import { NIGHTMARE_ABILITY_IDS } from '../nightmare/types.js';
import {
  SPIRIT_WARLOCK_ABILITIES, SPIRIT_WARLOCK_BOTTLE_IDS, SPIRIT_WARLOCK_CONSUMPTION_RISK, SPIRIT_WARLOCK_FORMULA_STATUS,
  SPIRIT_WARLOCK_GUIDE, SPIRIT_WARLOCK_LABOUR_TASKS, SPIRIT_WARLOCK_MIN_SOOTHER_WEEKS, SPIRIT_WARLOCK_POTION_SOURCES, SPIRIT_WARLOCK_PRICES, SPIRIT_WARLOCK_SOURCE_STATUS,
} from './content.js';
import {
  SPIRIT_WARLOCK_ABILITY_IDS, SPIRIT_WARLOCK_CASE_IDS, type SpiritWarlockAcquisitionCommand, type SpiritWarlockAction,
  type SpiritWarlockBottle, type SpiritWarlockCommand, type SpiritWarlockProjection, type SpiritWarlockState,
} from './types.js';

export function createSpiritWarlockState(): SpiritWarlockState {
  return {
    guidanceKnown: false,
    bottles: SPIRIT_WARLOCK_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, sootherActingAtPromotion: null,
    cases: Object.fromEntries(SPIRIT_WARLOCK_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    companion: { status: 'UNMET', invitedWeek: null, acquiredWeek: null, releases: 0, deployments: 0, recalls: 0, source: 'SW5-LEAF-1' },
    practice: { note: 'TABLE', dreamOpen: false, deliveries: 0, returns: 0, coordinationChecks: 0 },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, pressure: 0, dreamLocked: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'darkness' && (s.progression.sequence === 5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)));
const isSoother = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.sleepless.discovered && s.sleepless.guidanceKnown && s.midnight.guidanceKnown && s.nightmare.guidanceKnown && s.soother.guidanceKnown && s.soother.promotionWeek !== null && (isSoother(s) || promoted(s));
const potionPrice = (bottle: SpiritWarlockBottle) => SPIRIT_WARLOCK_PRICES.potion - (bottle.labourSteps === 5 ? SPIRIT_WARLOCK_PRICES.labourCredit : 0);
const bottleNumber = (bottle: SpiritWarlockBottle) => Number(bottle.id.slice('spirit-warlock-potion-'.length));
const sootherWeeks = (s: SliceState) => Math.max(0, (s.spiritWarlock.promotionWeek ?? s.week) - (s.soother.promotionWeek ?? s.week));
const supplyExhausted = (state: SpiritWarlockState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SPIRIT_WARLOCK_GUIDE}的独立灵巫成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5灵巫魔药，原瓶spirit-warlock-potion-${number}，非不眠者、午夜诗人、梦魇或安魂师旧瓶改装。完整配方与晋升仪式资料待核。`;

function commandBlock(s: SliceState, command: SpiritWarlockAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if ((Object.values(s.spiritWarlock.cases).some(value => value.contactOpen) || s.spiritWarlock.practice.note === 'RECIPIENT' || s.spiritWarlock.practice.dreamOpen || s.spiritWarlock.companion.status === 'DEPLOYED')) return '先实际结束本次灵巫实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原值班室，找到赛琳。';
  if (!knownChannel(s)) return '成为安魂师并保有赛琳的指导渠道后，才能继续了解灵巫之路。';
  if (promoted(s)) return '你已完成灵巫晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.spiritWarlock.guidanceKnown) return '已经听过灵巫成品魔药的用药说明。';
    return s.cash < SPIRIT_WARLOCK_PRICES.guidance ? '灵巫用药指导需要460便士。' : null;
  }
  if (!s.spiritWarlock.guidanceKnown) return '先听赛琳说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.spiritWarlock.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.spiritWarlock) ? null : '须先用完现有全部灵巫原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.spiritWarlock.resupply.requestedWeek === null) return '尚未申请下一批灵巫补给。';
    if (s.week <= s.spiritWarlock.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.spiritWarlock) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.spiritWarlock.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选灵巫原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `安魂师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.soother.promotionWeek === null || sootherWeeks(s) < SPIRIT_WARLOCK_MIN_SOOTHER_WEEKS) return `成为安魂师后已度过${sootherWeeks(s)}/${SPIRIT_WARLOCK_MIN_SOOTHER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原值班室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applySpiritWarlockCommand(s: SliceState, command: SpiritWarlockAcquisitionCommand, c: SeerContext): void {
  rule(validateSpiritWarlockCommand(command) && isSpiritWarlockAcquisitionCommand(command), '灵巫准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SPIRIT_WARLOCK_PRICES.guidance;
      s.spiritWarlock.guidanceKnown = true;
      c.note('听取灵巫用药说明', `花费1行动、460便士，你向已认识的本作原创成年${SPIRIT_WARLOCK_GUIDE}继续请教，她向你说明从独立灵巫成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险。这些不是原来的不眠者、午夜诗人、梦魇或安魂师存药。${SPIRIT_WARLOCK_FORMULA_STATUS}安魂师消化须达100，晋升安魂师后满12整周才能服用；可提前筹备。${SPIRIT_WARLOCK_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.spiritWarlock.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = SPIRIT_WARLOCK_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在赛琳的原值班室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.spiritWarlock.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('灵巫原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原值班室劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；安魂师消化100且晋升安魂师后满12整周时，再独立确认服药。${SPIRIT_WARLOCK_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.spiritWarlock.resupply.requestedWeek = s.week;
      c.note('申请下一批灵巫魔药', `现有灵巫原瓶全部耗尽且未晋升。你花费1行动，请${SPIRIT_WARLOCK_GUIDE}从同一新渠道订下一批三瓶，并实际核验原值班室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.spiritWarlock.bottles.length + 1;
      s.spiritWarlock.resupply.deliveries += 1;
      for (let offset = 0; offset < SPIRIT_WARLOCK_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.spiritWarlock.bottles.push({ id: `spirit-warlock-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.spiritWarlock.resupply.requestedWeek = null;
      c.note('下一批灵巫原瓶到货', `第${s.week}周，赛琳的独立灵巫成品交接渠道本作G成品供给第${s.spiritWarlock.resupply.deliveries + 1}批三瓶实际到货，原瓶spirit-warlock-potion-${firstNumber}至spirit-warlock-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.spiritWarlock.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.spiritWarlock.sootherActingAtPromotion = s.progression.acting;
        s.spiritWarlock.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of SPIRIT_WARLOCK_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为灵巫', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。不眠者、午夜诗人、梦魇与安魂师全部原能力及原ID掌握完整继承，只新增灵体休憩与封存、实际灵体协助、梦魇与灵配合三项，从0掌握开始；安魂师消化成果与安魂师晋升周保留，灵巫扮演从0开始。灵性上限提高到100，当前灵性没有补满。身体可供已取得的灵休憩与封存，牙齿为媒介；仍须分别观察并邀请原庭院自然灵卷叶，晋升没有附赠灵体。依赖实际取得之灵协助，继承梦魇时本体仍不能移动；不获得死神体内冥界、飞行、土行或序列4厄运。原纸条仍属于赛琳，留在原桌上。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了灵巫晋升' : '灵巫魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是安魂师，消化与全部原有掌握保留，没有获得灵巫能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectSpiritWarlock(s: SliceState): SpiritWarlockProjection {
  const actions: SpiritWarlockAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? (([4, 3, 2, 1].includes(s.progression.sequence ?? 0))?s.nightwatcher.spiritWarlockActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: SpiritWarlockAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.spiritWarlock.guidanceKnown) add('learn-spirit-warlock-guidance', '请赛琳说明灵巫成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.spiritWarlock.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${SPIRIT_WARLOCK_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶灵巫魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.spiritWarlock.resupply.requestedWeek !== null) add('receive-spirit-warlock-supply', '确认下一批三瓶灵巫到货', `0行动 · 第${s.spiritWarlock.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.spiritWarlock)) add('request-spirit-warlock-supply', '向赛琳订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.spiritWarlock.guidanceKnown) {
    for (const bottle of s.spiritWarlock.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶灵巫魔药`, `0行动 · 独立确认 · 安魂师消化${isPromoted ? s.spiritWarlock.sootherActingAtPromotion : s.progression.acting}/100 · 晋升后${sootherWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.spiritWarlock.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.spiritWarlock.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '灵巫 · 序列5' : '灵巫之路', discovered: available,
    guidanceKnown: available && s.spiritWarlock.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    companion: null, practice: null,
    cases: [], environment: '', insideCase: (Object.values(s.spiritWarlock.cases).some(value => value.contactOpen) || s.spiritWarlock.practice.note === 'RECIPIENT' || s.spiritWarlock.practice.dreamOpen || s.spiritWarlock.companion.status === 'DEPLOYED'),
    ...(available ? { story: SPIRIT_WARLOCK_SOURCE_STATUS } : {}),
    supplies: available ? `${SPIRIT_WARLOCK_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.spiritWarlock.resupply.requestedWeek === null ? `已实际接收后续供给${s.spiritWarlock.resupply.deliveries}批。` : `第${s.spiritWarlock.resupply.requestedWeek}周提出请求，第${s.spiritWarlock.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.spiritWarlock.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 灵巫魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SPIRIT_WARLOCK_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `安魂师消化成果${s.spiritWarlock.sootherActingAtPromotion}/100已保留；灵巫扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成安魂师消化（${s.progression.acting}/100），并在晋升安魂师后度过12整周（${sootherWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完安魂师之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${SPIRIT_WARLOCK_CONSUMPTION_RISK}` : '成为安魂师后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isSpiritWarlockAcquisitionCommand(command: unknown): command is SpiritWarlockAcquisitionCommand {
  return validateSpiritWarlockCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateSpiritWarlockCommand(value: unknown): value is SpiritWarlockCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'INVITE_SPIRIT', 'RELEASE_SPIRIT', 'RECALL_SPIRIT', 'RETRIEVE_NOTE', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^spirit-warlock-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^spirit-warlock-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SPIRIT_WARLOCK_CASE_IDS.includes(value.caseId as typeof SPIRIT_WARLOCK_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && SPIRIT_WARLOCK_CASE_IDS.includes(value.caseId as typeof SPIRIT_WARLOCK_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateSpiritWarlockState(s: SliceState): boolean {
  const raw: unknown = s.spiritWarlock;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'sootherActingAtPromotion', 'cases', 'companion', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.sleepless) || !record(s.midnight) || !record(s.nightmare) || !record(s.soother)) return false;
  const firstSootherWeek = s.soother.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstSootherWeek + SPIRIT_WARLOCK_MIN_SOOTHER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SPIRIT_WARLOCK_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, SPIRIT_WARLOCK_CASE_IDS) || !record(raw.companion) || !record(raw.practice) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateSpiritWarlockLife(s)) return false;
  const spiritWarlock = raw as unknown as SpiritWarlockState, isPromoted = promoted(s);
  if (spiritWarlock.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!spiritWarlock.guidanceKnown || !integer(s.soother.promotionWeek, 1, s.week) || !integer(spiritWarlock.promotionWeek, firstConsumptionWeek, s.week) || spiritWarlock.sootherActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?MISFORTUNE_KNIGHT_ABILITY_IDS:[]),...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS, ...NIGHTMARE_ABILITY_IDS, ...SOOTHER_ABILITY_IDS, ...SPIRIT_WARLOCK_ABILITY_IDS,...(([4, 3, 2, 1].includes(s.progression.sequence ?? 0))?NIGHTWATCHER_ABILITY_IDS:[]),...([3, 2, 1].includes(s.progression.sequence ?? 0) ? FEAR_BISHOP_ABILITY_IDS : []),...((s.progression.sequence === 2||s.progression.sequence===1) ? CONCEALMENT_SERVANT_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (spiritWarlock.promotionWeek !== null || spiritWarlock.sootherActingAtPromotion !== null || SPIRIT_WARLOCK_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (spiritWarlock.practice.note !== 'TABLE' || spiritWarlock.practice.dreamOpen || spiritWarlock.practice.deliveries !== 0 || spiritWarlock.practice.returns !== 0 || spiritWarlock.practice.coordinationChecks !== 0) return false;
    const companion = spiritWarlock.companion;
    if (companion.status !== 'UNMET' || companion.invitedWeek !== null || companion.acquiredWeek !== null || companion.releases !== 0 || companion.deployments !== 0 || companion.recalls !== 0 || companion.source !== 'SW5-LEAF-1') return false;
    if (spiritWarlock.reflected || Object.values(spiritWarlock.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of spiritWarlock.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `spirit-warlock-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of spiritWarlock.bottles.entries()) {
    let stockWeek = firstSootherWeek;
    if (index < SPIRIT_WARLOCK_BOTTLE_IDS.length) {
      if (bottle.source !== SPIRIT_WARLOCK_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!spiritWarlock.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SPIRIT_WARLOCK_BOTTLE_IDS.length) - 1;
      if (index % SPIRIT_WARLOCK_BOTTLE_IDS.length === 0) {
        const previous = spiritWarlock.bottles.slice(index - SPIRIT_WARLOCK_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > spiritWarlock.promotionWeek!) return false;
    }
    if (!spiritWarlock.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > spiritWarlock.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > spiritWarlock.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== spiritWarlock.promotionWeek) return false;
    }
  }
  if (spiritWarlock.resupply.requestedWeek !== null && (!spiritWarlock.guidanceKnown || isPromoted || !supplyExhausted(spiritWarlock) || spiritWarlock.bottles.some(bottle => bottle.consumedWeek! > spiritWarlock.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'pressure', 'dreamLocked']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = spiritWarlock.encounter;
  if (![0, 1, 2].includes(e.pressure) || typeof e.dreamLocked !== 'boolean' || e.dreamLocked !== (e.pressure === 2)) return false;
  if (e.status !== 'FIGHTING' && s.combat?.encounterId !== 'FIRST_CASE' && (e.pressure !== 0 || e.dreamLocked)) return false;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, spiritWarlock.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'SPIRIT_WARLOCK_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(spiritWarlock.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (Object.values(spiritWarlock.cases).some(r => r.contactOpen || r.status === 'PREPARED') || spiritWarlock.practice.note !== 'TABLE' || spiritWarlock.practice.dreamOpen)) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'spirit-warlock-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateSpiritWarlockEncounter(s);
}

export { SPIRIT_WARLOCK_ABILITIES } from './content.js';
export type * from './types.js';
