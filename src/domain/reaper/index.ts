import {WEATHER_WARLOCK_ABILITY_IDS} from '../weather-warlock/types.js';
import { WAR_BISHOP_ABILITY_IDS } from '../war-bishop/types.js';
import { IRON_BLOOD_KNIGHT_ABILITY_IDS } from '../iron-blood-knight/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { HUNTER_ABILITY_IDS } from '../hunter/types.js';
import { PROVOKER_ABILITY_IDS } from '../provoker/types.js';
import { validateReaperLife } from './life.js';
import { validateReaperEncounter } from './encounter.js';
import { CONSPIRATOR_ABILITY_IDS } from '../conspirator/types.js';
import { PYROMANIAC_ABILITY_IDS } from '../pyromaniac/types.js';
import {
  REAPER_ABILITIES, REAPER_BOTTLE_IDS, REAPER_CONSUMPTION_RISK, REAPER_FORMULA_STATUS,
  REAPER_GUIDE, REAPER_LABOUR_TASKS, REAPER_MIN_CONSPIRATOR_WEEKS, REAPER_POTION_SOURCES, REAPER_PRICES, REAPER_SOURCE_STATUS,
} from './content.js';
import {
  REAPER_ABILITY_IDS, REAPER_CASE_IDS, type ReaperAcquisitionCommand, type ReaperAction,
  type ReaperBottle, type ReaperCommand, type ReaperProjection, type ReaperState,
} from './types.js';

export function createReaperState(): ReaperState {
  return {
    guidanceKnown: false,
    bottles: REAPER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, conspiratorActingAtPromotion: null,
    cases: Object.fromEntries(REAPER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0, notes: [], practice: { attempts: 0, signals: 0, windowOpen: false, windowUses: 0, siteCleared: false } }])),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, weakness: { sourceRound: null, available: false, observations: 0, uses: 0 } },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hunter' && (s.progression.sequence === 5 || (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isConspirator = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.hunter.discovered && s.hunter.guidanceKnown && s.provoker.guidanceKnown && s.pyromaniac.guidanceKnown && s.conspirator.guidanceKnown && s.conspirator.promotionWeek !== null && (isConspirator(s) || promoted(s));
const potionPrice = (bottle: ReaperBottle) => REAPER_PRICES.potion - (bottle.labourSteps === 5 ? REAPER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ReaperBottle) => Number(bottle.id.slice('reaper-potion-'.length));
const conspiratorWeeks = (s: SliceState) => Math.max(0, (s.reaper.promotionWeek ?? s.week) - (s.conspirator.promotionWeek ?? s.week));
const supplyExhausted = (state: ReaperState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${REAPER_GUIDE}的独立收割者成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5收割者魔药，原瓶reaper-potion-${number}，非猎人、挑衅者、纵火家或阴谋家旧瓶改装。完整配方与晋升仪式资料待核。`;

function commandBlock(s: SliceState, command: ReaperAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.reaper.cases).some(value => value.contactOpen || value.practice.windowOpen)) return '先实际结束本次收割者实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原货栈，找到索伦·里奇。';
  if (!knownChannel(s)) return '成为阴谋家并保有索伦·里奇的指导渠道后，才能继续了解收割者之路。';
  if (promoted(s)) return '你已完成收割者晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.reaper.guidanceKnown) return '已经听过收割者成品魔药的用药说明。';
    return s.cash < REAPER_PRICES.guidance ? '收割者用药指导需要420便士。' : null;
  }
  if (!s.reaper.guidanceKnown) return '先听索伦·里奇说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.reaper.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.reaper) ? null : '须先用完现有全部收割者原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.reaper.resupply.requestedWeek === null) return '尚未申请下一批收割者补给。';
    if (s.week <= s.reaper.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.reaper) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.reaper.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选收割者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `阴谋家魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.conspirator.promotionWeek === null || conspiratorWeeks(s) < REAPER_MIN_CONSPIRATOR_WEEKS) return `成为阴谋家后已度过${conspiratorWeeks(s)}/${REAPER_MIN_CONSPIRATOR_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原货栈劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyReaperCommand(s: SliceState, command: ReaperAcquisitionCommand, c: SeerContext): void {
  rule(validateReaperCommand(command) && isReaperAcquisitionCommand(command), '收割者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= REAPER_PRICES.guidance;
      s.reaper.guidanceKnown = true;
      c.note('听取收割者用药说明', `花费1行动、420便士，你向已认识的本作原创成年${REAPER_GUIDE}继续请教，他向你说明从独立收割者成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险。这些不是原来的猎人、挑衅者、纵火家或阴谋家存药。${REAPER_FORMULA_STATUS}阴谋家消化须达100，晋升阴谋家后满12整周才能服用；可提前筹备。${REAPER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.reaper.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = REAPER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在索伦·里奇的原货栈实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4000便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.reaper.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('收割者原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原货栈劳务抵扣4000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；阴谋家消化100且晋升阴谋家后满12整周时，再独立确认服药。${REAPER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.reaper.resupply.requestedWeek = s.week;
      c.note('申请下一批收割者魔药', `现有收割者原瓶全部耗尽且未晋升。你花费1行动，请${REAPER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原货栈的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4600便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.reaper.bottles.length + 1;
      s.reaper.resupply.deliveries += 1;
      for (let offset = 0; offset < REAPER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.reaper.bottles.push({ id: `reaper-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.reaper.resupply.requestedWeek = null;
      c.note('下一批收割者原瓶到货', `第${s.week}周，索伦·里奇的独立收割者成品交接渠道本作G成品供给第${s.reaper.resupply.deliveries + 1}批三瓶实际到货，原瓶reaper-potion-${firstNumber}至reaper-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4600便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.reaper.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.reaper.conspiratorActingAtPromotion = s.progression.acting;
        s.reaper.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of REAPER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为收割者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。猎人、挑衅者、纵火家与阴谋家全部原能力及原ID掌握完整继承，新增弱点观察与精准打击，两项均从0掌握开始；阴谋家消化成果与阴谋家晋升周保留，收割者扮演从0开始。灵性上限提高到100，当前灵性没有补满。观察弱点和配合窗口的高伤仍可能失败，不保证必中必杀；不获得序列4火焰化、铁血军团或丧钟物品规则。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了收割者晋升' : '收割者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是阴谋家，消化与全部原有掌握保留，没有获得收割者能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectReaper(s: SliceState): ReaperProjection {
  const actions: ReaperAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) ? s.ironBloodKnight.reaperActingAtPromotion ?? 100 : s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: ReaperAcquisitionCommand) => {
    if (isPromoted && (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))) return;
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.reaper.guidanceKnown) add('learn-reaper-guidance', '请索伦·里奇说明收割者成品与风险', '1行动 · 420便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.reaper.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${REAPER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶收割者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.reaper.resupply.requestedWeek !== null) add('receive-reaper-supply', '确认下一批三瓶收割者到货', `0行动 · 第${s.reaper.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.reaper)) add('request-reaper-supply', '向索伦·里奇订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.reaper.guidanceKnown) {
    for (const bottle of s.reaper.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶收割者魔药`, `0行动 · 独立确认 · 阴谋家消化${isPromoted ? s.reaper.conspiratorActingAtPromotion : s.progression.acting}/100 · 晋升后${conspiratorWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.reaper.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.reaper.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '收割者 · 序列5' : '收割者之路', discovered: available,
    guidanceKnown: available && s.reaper.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: Object.values(s.reaper.cases).some(value => value.contactOpen || value.practice.windowOpen),
    ...(available ? { story: REAPER_SOURCE_STATUS } : {}),
    supplies: available ? `${REAPER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.reaper.resupply.requestedWeek === null ? `已实际接收后续供给${s.reaper.resupply.deliveries}批。` : `第${s.reaper.resupply.requestedWeek}周提出请求，第${s.reaper.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.reaper.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 收割者魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? REAPER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted && (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) ? '收割者魔药已消化；原弱点观察、实际窗口、原瓶与实践记录保留。' : isPromoted ? `阴谋家消化成果${s.reaper.conspiratorActingAtPromotion}/100已保留；收割者扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成阴谋家消化（${s.progression.acting}/100），并在晋升阴谋家后度过12整周（${conspiratorWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完阴谋家之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${REAPER_CONSUMPTION_RISK}` : '成为阴谋家后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isReaperAcquisitionCommand(command: unknown): command is ReaperAcquisitionCommand {
  return validateReaperCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateReaperCommand(value: unknown): value is ReaperCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^reaper-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^reaper-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'SIGNAL') return shape(value, ['type', 'caseId']) && value.caseId === 'moving-shutter';
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && REAPER_CASE_IDS.includes(value.caseId as typeof REAPER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && REAPER_CASE_IDS.includes(value.caseId as typeof REAPER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateReaperState(s: SliceState): boolean {
  const raw: unknown = s.reaper;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'conspiratorActingAtPromotion', 'cases', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.hunter) || !record(s.provoker) || !record(s.pyromaniac) || !record(s.conspirator)) return false;
  const firstConspiratorWeek = s.conspirator.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstConspiratorWeek + REAPER_MIN_CONSPIRATOR_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== REAPER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, REAPER_CASE_IDS) || !validateReaperLife(s)) return false;
  const reaper = raw as unknown as ReaperState, isPromoted = promoted(s);
  if (reaper.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!reaper.guidanceKnown || !integer(s.conspirator.promotionWeek, 1, s.week) || !integer(reaper.promotionWeek, firstConsumptionWeek, s.week) || reaper.conspiratorActingAtPromotion !== 100) return false;
    if ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) && (!record(s.ironBloodKnight) || !integer(s.ironBloodKnight.promotionWeek, reaper.promotionWeek!, s.week) || s.ironBloodKnight.reaperActingAtPromotion !== 100)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===2?WEATHER_WARLOCK_ABILITY_IDS:[]),...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS, ...PYROMANIAC_ABILITY_IDS, ...CONSPIRATOR_ABILITY_IDS, ...REAPER_ABILITY_IDS, ...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)) ? IRON_BLOOD_KNIGHT_ABILITY_IDS : []),...((s.progression.sequence===3||s.progression.sequence===2)?WAR_BISHOP_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (reaper.promotionWeek !== null || reaper.conspiratorActingAtPromotion !== null || REAPER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (reaper.reflected || Object.values(reaper.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0 || value.notes.length !== 0 || value.practice.attempts !== 0 || value.practice.signals !== 0 || value.practice.windowOpen || value.practice.windowUses !== 0 || value.practice.siteCleared)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of reaper.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `reaper-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of reaper.bottles.entries()) {
    let stockWeek = firstConspiratorWeek;
    if (index < REAPER_BOTTLE_IDS.length) {
      if (bottle.source !== REAPER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!reaper.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / REAPER_BOTTLE_IDS.length) - 1;
      if (index % REAPER_BOTTLE_IDS.length === 0) {
        const previous = reaper.bottles.slice(index - REAPER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > reaper.promotionWeek!) return false;
    }
    if (!reaper.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > reaper.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > reaper.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== reaper.promotionWeek) return false;
    }
  }
  if (reaper.resupply.requestedWeek !== null && (!reaper.guidanceKnown || isPromoted || !supplyExhausted(reaper) || reaper.bottles.some(bottle => bottle.consumedWeek! > reaper.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'weakness']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = reaper.encounter;
  if (!record(e.weakness) || !shape(e.weakness, ['sourceRound', 'available', 'observations', 'uses']) || typeof e.weakness.available !== 'boolean' || !integer(e.weakness.observations, 0) || !integer(e.weakness.uses, 0, e.weakness.observations)) return false;
  if (e.weakness.available ? !integer(e.weakness.sourceRound, 1) || e.weakness.observations <= e.weakness.uses : e.weakness.sourceRound !== null) return false;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, reaper.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'REAPER_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(reaper.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && Object.values(reaper.cases).some(r => r.contactOpen || r.status === 'PREPARED' || r.practice.windowOpen)) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'reaper-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateReaperEncounter(s);
}

export { REAPER_ABILITIES } from './content.js';
export type * from './types.js';
