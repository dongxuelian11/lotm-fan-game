import { BLOOD_DUKE_ABILITY_IDS } from '../blood-duke/types.js';
import {BLATHERER_ABILITY_IDS} from '../blatherer/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CRIMINAL_ABILITY_IDS } from '../criminal/types.js';
import { UNWINGED_ABILITY_IDS } from '../unwinged/types.js';
import { SERIAL_KILLER_ABILITY_IDS } from '../serial-killer/types.js';
import { DEMON_ABILITY_IDS } from '../demon/types.js';
import { DESIRE_APOSTLE_ABILITY_IDS } from '../desire-apostle/types.js';
import { criminalInside } from '../criminal/life.js';
import { unwingedInside } from '../unwinged/life.js';
import { serialKillerInside } from '../serial-killer/life.js';
import { demonInside } from '../demon/life.js';
import { desireApostleInside } from '../desire-apostle/life.js';
import {
  createDevilLifeState, validateDevilLife, validateDevilActivityCommand,
  devilLifeActions, projectDevilLife, hasDevilLifeLock, applyDevilActivity,
} from './life.js';
import {
  createDevilEncounterState, validateDevilEncounter, validateDevilEncounterCommand,
  devilEncounterActions, projectDevilEncounter, hasDevilEncounterLock, applyDevilEncounterCommand,
} from './encounter.js';
import {
  DEVIL_ABILITIES, DEVIL_BOTTLE_IDS, DEVIL_CONSUMPTION_RISK, DEVIL_FORMULA_STATUS,
  DEVIL_GUIDE, DEVIL_LABOUR_STEPS, DEVIL_LABOUR_TASKS, DEVIL_MIN_DESIRE_APOSTLE_WEEKS,
  DEVIL_POTION_SOURCES, DEVIL_PRICES, DEVIL_SOURCE_STATUS,
} from './content.js';
import {
  DEVIL_ABILITY_IDS, type DevilAcquisitionCommand, type DevilAction,
  type DevilBottle, type DevilCommand, type DevilProjection, type DevilState,
} from './types.js';

export function createDevilState(): DevilState {
  return {
    guidanceKnown: false,
    bottles: DEVIL_POTION_SOURCES.map(({ id, source }) => ({ id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null,
    desireApostleActingAtPromotion: null,
    life: createDevilLifeState(),
    encounter: createDevilEncounterState(),
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isDevil = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 4;
const hasDevilHistory=(s:SliceState)=>s.progression.pathwayId==='abyss'&&[4,3,2].includes(s.progression.sequence!);
const isDesireApostle = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.criminal.discovered && s.criminal.guidanceKnown && s.unwinged.guidanceKnown && s.serialKiller.guidanceKnown && s.demon.guidanceKnown && s.desireApostle.guidanceKnown && s.desireApostle.promotionWeek !== null && (isDesireApostle(s) || hasDevilHistory(s));
const potionPrice = (bottle: DevilBottle) => DEVIL_PRICES.potion - (bottle.labourSteps === DEVIL_LABOUR_STEPS ? DEVIL_PRICES.labourCredit : 0);
const bottleNumber = (bottle: DevilBottle) => Number(bottle.id.slice('devil-potion-'.length));
const desireApostleWeeks = (s: SliceState) => Math.max(0, (s.devil.promotionWeek ?? s.week) - (s.desireApostle.promotionWeek ?? s.week));
const supplyExhausted = (state: DevilState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const oldPracticeOpen = (s: SliceState) => criminalInside(s) || unwingedInside(s) || serialKillerInside(s)
  || demonInside(s) || desireApostleInside(s)
  || s.demon.practice.body !== 'NORMAL' || s.demon.practice.flame === 'LIT'
  || [s.criminal, s.unwinged, s.serialKiller, s.demon, s.desireApostle].some(stage => Object.values(stage.cases).some(value => value.status === 'PREPARED'));

const deliverySource = (number: number, week: number) => `${DEVIL_GUIDE}的独立魔鬼成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4魔鬼魔药，原瓶devil-potion-${number}，非任何旧序列原瓶改装。完整配方与晋升仪式细节待核，导师实际执行G专业服药准备。`;

function commandBlock(s: SliceState, command: DevilAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (oldPracticeOpen(s)) return '先实际结束旧实践的接触、原物复位或尚未实施的准备，再继续。';
  if (hasDevilLifeLock(s) || hasDevilEncounterLock(s)) return '先实际收束魔鬼的演练、原物与普通步行路线，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原旧货库练习室，找到罗安·费里。';
  if (!knownChannel(s)) return '成为欲望使徒并保有罗安·费里的原指导渠道后，才能继续了解魔鬼之路。';
  if (hasDevilHistory(s)) return '你已完成魔鬼晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.devil.guidanceKnown) return '已经听过魔鬼成品魔药的用药说明。';
    return s.cash < DEVIL_PRICES.guidance ? '魔鬼用药指导需要540便士。' : null;
  }
  if (!s.devil.guidanceKnown) return '先听罗安·费里说明这批序列4原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.devil.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.devil) ? null : '须先用完现有全部魔鬼原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.devil.resupply.requestedWeek === null) return '尚未申请下一批魔鬼补给。';
    if (s.week <= s.devil.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.devil) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.devil.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选魔鬼原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受实际代价并保持可恢复。';
    if (s.progression.acting !== 100) return `欲望使徒魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.desireApostle.promotionWeek === null || desireApostleWeeks(s) < DEVIL_MIN_DESIRE_APOSTLE_WEEKS) return `成为欲望使徒后已度过${desireApostleWeeks(s)}/${DEVIL_MIN_DESIRE_APOSTLE_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= DEVIL_LABOUR_STEPS ? '这瓶对应的五次原旧货库练习室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Called on the slice's working copy. All commands validate before any resource or scene mutation. */
export function applyDevilCommand(s: SliceState, command: DevilCommand, c: SeerContext): void {
  rule(validateDevilCommand(command), '魔鬼命令无效。');
  if (validateDevilActivityCommand(command)) {
    applyDevilActivity(s, command, c, (id, amount = 8) => {
      rule(DEVIL_ABILITY_IDS.includes(id) && Object.hasOwn(s.progression.mastery, id), '不能奖励尚未获得的魔鬼能力。');
      s.progression.mastery[id] = Math.min(500, s.progression.mastery[id]! + amount);
    });
    return;
  }
  if (validateDevilEncounterCommand(command)) { applyDevilEncounterCommand(s, command, c); return; }
  rule(isDevilAcquisitionCommand(command), '魔鬼准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= DEVIL_PRICES.guidance;
      s.devil.guidanceKnown = true;
      c.note('听取魔鬼用药说明', `花费1行动、540便士，你向已认识的本作原创成年${DEVIL_GUIDE}继续请教。导师实际核对原瓶、准备原旧货库练习室安静场地与在场照护，说明三瓶独立序列4成品与四档风险。${DEVIL_FORMULA_STATUS}欲望使徒消化须达100，晋升后满12整周才能服用；可提前筹备。${DEVIL_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.devil.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = DEVIL_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在罗安·费里的原旧货库练习室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶5300便士，仍须实际支付1500便士才会交付；不折现、不生成材料。' : '完成对应五次劳务后才能抵这瓶5300便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.devil.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('魔鬼原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列4成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原旧货库练习室劳务抵扣5300便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；欲望使徒消化100且晋升后满12整周时，再独立确认服药。${DEVIL_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.devil.resupply.requestedWeek = s.week;
      c.note('申请下一批魔鬼魔药', `现有魔鬼原瓶全部耗尽且未晋升。你花费1行动，请${DEVIL_GUIDE}从同一渠道订下一批三瓶，并实际核验原旧货库练习室收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付6800便士，或分别完成五次劳务后支付1500便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.devil.bottles.length + 1;
      s.devil.resupply.deliveries += 1;
      for (let offset = 0; offset < DEVIL_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.devil.bottles.push({ id: `devil-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.devil.resupply.requestedWeek = null;
      c.note('下一批魔鬼原瓶到货', `第${s.week}周，同一G独立渠道第${s.devil.resupply.deliveries + 1}批三瓶实际到货，原瓶devil-potion-${firstNumber}至devil-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按6800便士购买，或完成对应五次劳务再付1500便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.devil.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次魔鬼服药准备', `原成年${DEVIL_GUIDE}在原旧货库练习室实际核对你手中的原瓶${bottle.id}、准备本次安静场地并在场照护，执行本作G专业准备。原著仪式细节仍未知，不把这些准备冒充已还原原著仪式。`);
      const result = c.check('will', 28);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const great = result.tier === 'GREAT_SUCCESS';
        const mentalCost = great ? 4 : 8;
        const spiritualCost = great ? 0 : Math.min(15, s.spirituality);
        s.mind = Math.max(1, s.mind - mentalCost);
        s.spirituality -= spiritualCost;
        s.devil.desireApostleActingAtPromotion = s.progression.acting;
        s.devil.promotionWeek = s.week;
        s.progression.sequence = 4;
        s.progression.acting = 0;
        for (const id of DEVIL_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        c.note('成为魔鬼', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${great ? '大成功' : '成功'}：精神−${mentalCost}${great ? '' : `、灵性实际−${spiritualCost}（规则成本15，最低0）`}，四属性各+1。欲望使徒消化成果100/100单独保留，魔鬼扮演从0开始；只新增abyss.s4.desire-focus与abyss.s4.catalytic-pressure两项0掌握，名称和强化机制均为本作原创G，不冒充已核实的序列4完整技能表。灵性上限120，当前灵性没有补满。罪犯、折翼天使、连环杀手、恶魔与欲望使徒的原ID、原瓶、原人物、原物、伤势、紧绷、良知与恶欲风险及旧敌生死完整保留；旧DA5-LEDGER-1、DA5-NOTE-1与旧种子历史没有重置。身体与性别没有变化；不赠堕落之笛物品效果、免费契约、灵魂所有权或高位权柄。强烈情绪前提和可抵抗性仍存在，所有后续实践仍须实际准备、支付代价与收束。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        const mentalCost = severe ? 45 : 25;
        const healthCost = severe ? 25 : 15;
        s.mind = Math.max(1, s.mind - mentalCost);
        s.health = Math.max(1, s.health - healthCost);
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 60 : 30));
        c.note(severe ? '导师中断了魔鬼晋升' : '魔鬼魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：健康−${healthCost}、精神−${mentalCost}、排异+${severe ? 60 : 30}；仅本次G指导服药的健康与精神最低1。你仍是欲望使徒，消化与全部旧掌握保留，尚未获得魔鬼能力。导师实际处理排异后仍须休养；重试须另购现有新原瓶，保护不适用于战斗或其它危险。`);
      }
      return;
    }
  }
}

export function projectDevil(s: SliceState): DevilProjection {
  const actions: DevilAction[] = [], available = knownChannel(s), promoted = hasDevilHistory(s);
  const acting = promoted ? ((s.progression.sequence===3||s.progression.sequence===2)?s.blatherer.devilActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: DevilAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!s.devil.guidanceKnown) add('learn-devil-guidance', '请罗安·费里说明魔鬼成品与风险', '1行动 · 540便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.devil.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < DEVIL_LABOUR_STEPS) add(`work-${bottle.id}`, `第${number}瓶 · ${DEVIL_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶5300便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶魔鬼魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列4原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.devil.resupply.requestedWeek !== null) add('receive-devil-supply', '确认下一批三瓶魔鬼到货', `0行动 · 第${s.devil.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.devil)) add('request-devil-supply', '向罗安·费里订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.devil.guidanceKnown && !promoted) for (const bottle of s.devil.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶魔鬼魔药`, `0行动 · 独立确认 · 欲望使徒消化${s.progression.acting}/100 · 晋升后${desireApostleWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  const remaining = s.devil.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.devil.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    ...projectDevilLife(s),
    ...projectDevilEncounter(s),
    title: promoted ? '魔鬼 · 序列4' : '魔鬼之路', discovered: available,
    guidanceKnown: available && s.devil.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: DEVIL_SOURCE_STATUS } : {}),
    supplies: available ? `${DEVIL_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.devil.resupply.requestedWeek === null ? `已实际接收后续供给${s.devil.resupply.deliveries}批。` : `第${s.devil.resupply.requestedWeek}周提出请求，第${s.devil.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    bodyChange: available ? '本次晋升不改变身体与性别；原折翼天使身体变化、良知损失与恶欲风险不被洗去。魔鬼4与恶魔6为不同序列，不开放序列3与更高能力。' : '',
    inheritedTools: available ? `沿用罪犯、折翼天使、连环杀手、恶魔与欲望使徒的全部原能力和实际历史。旧恶魔紧绷${s.demon.strain}/3保持原值，须普通收束且不会治愈全部精神问题；原记录册DA5-LEDGER-1、原记录纸DA5-NOTE-1、旧种子与费兰、莫顿的结局不会重开。` : '',
    strain: s.demon.strain,
    actions: [...actions, ...devilLifeActions(s), ...devilEncounterActions(s)],
    bottles: available ? s.devil.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 魔鬼魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5` : bottle.status === 'PLAYER' ? '已交付，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? DEVIL_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: promoted ? `欲望使徒消化成果${s.devil.desireApostleActingAtPromotion}/100已保留；魔鬼扮演${acting}/100，能力掌握分别记录。` : available ? `服药前需完成欲望使徒消化（${s.progression.acting}/100），并在晋升后度过12整周（${desireApostleWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完欲望使徒之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${DEVIL_CONSUMPTION_RISK}` : '成为欲望使徒后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const bottleId = (value: unknown) => typeof value === 'string' && /^devil-potion-[1-9]\d{0,14}$/.test(value);

export function isDevilAcquisitionCommand(value: unknown): value is DevilAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && bottleId(value.bottleId);
  return value.type === 'CONSUME' && shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && bottleId(value.bottleId);
}
export function validateDevilCommand(value: unknown): value is DevilCommand {
  return isDevilAcquisitionCommand(value) || validateDevilActivityCommand(value) || validateDevilEncounterCommand(value);
}

/** Exact identities and chronology are validated before delegated scene invariants. */
export function validateDevilState(s: SliceState): boolean {
  try { return validateDevilStateRecord(s); } catch { return false; }
}
function validateDevilStateRecord(s: SliceState): boolean {
  const raw: unknown = s.devil;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'desireApostleActingAtPromotion', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.criminal) || !record(s.unwinged) || !record(s.serialKiller) || !record(s.demon) || !record(s.desireApostle)) return false;
  if (!record(raw.life) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory)) return false;
  const firstDesireApostleWeek = s.desireApostle.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstDesireApostleWeek + DEVIL_MIN_DESIRE_APOSTLE_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== DEVIL_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  const state = raw as unknown as DevilState, promoted = hasDevilHistory(s);
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.desireApostle.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.desireApostleActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS, ...DEMON_ABILITY_IDS, ...DESIRE_APOSTLE_ABILITY_IDS, ...DEVIL_ABILITY_IDS,...((s.progression.sequence===3||s.progression.sequence===2)?BLATHERER_ABILITY_IDS:[]),...(s.progression.sequence===2?BLOOD_DUKE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.desireApostleActingAtPromotion !== null || DEVIL_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  // First validate every record shape, so a later batch cannot dereference malformed predecessors.
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `devil-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, DEVIL_LABOUR_STEPS)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of state.bottles.entries()) {
    let stockWeek = firstDesireApostleWeek;
    if (index < DEVIL_BOTTLE_IDS.length) {
      if (bottle.source !== DEVIL_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!state.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / DEVIL_BOTTLE_IDS.length) - 1;
      if (index % DEVIL_BOTTLE_IDS.length === 0) {
        const previous = state.bottles.slice(index - DEVIL_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (promoted && stockWeek > state.promotionWeek!) return false;
    }
    if (!state.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || promoted && bottle.acquiredWeek! > state.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (promoted ? bottle.consumedWeek! > state.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== state.promotionWeek) return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || promoted || !supplyExhausted(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateDevilLife(s) && validateDevilEncounter(s);
}

export { DEVIL_ABILITIES } from './content.js';
export { DEVIL_CASE_IDS } from './life.js';
export type * from './types.js';
