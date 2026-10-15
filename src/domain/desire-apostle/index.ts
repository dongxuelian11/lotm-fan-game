import { BLOOD_DUKE_ABILITY_IDS } from '../blood-duke/types.js';
import {BLATHERER_ABILITY_IDS} from '../blatherer/types.js';
import {DEVIL_ABILITY_IDS} from '../devil/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CRIMINAL_ABILITY_IDS } from '../criminal/types.js';
import { UNWINGED_ABILITY_IDS } from '../unwinged/types.js';
import { SERIAL_KILLER_ABILITY_IDS } from '../serial-killer/types.js';
import { DEMON_ABILITY_IDS } from '../demon/types.js';
import { desireApostleInside, validateDesireApostleLife } from './life.js';
import { demonInside } from '../demon/life.js';
import { validateDesireApostleEncounter } from './encounter.js';
import {
  DESIRE_APOSTLE_ABILITIES, DESIRE_APOSTLE_BOTTLE_IDS, DESIRE_APOSTLE_CONSUMPTION_RISK, DESIRE_APOSTLE_FORMULA_STATUS,
  DESIRE_APOSTLE_GUIDE, DESIRE_APOSTLE_LABOUR_TASKS, DESIRE_APOSTLE_MIN_DEMON_WEEKS, DESIRE_APOSTLE_POTION_SOURCES, DESIRE_APOSTLE_PRICES, DESIRE_APOSTLE_SOURCE_STATUS,
} from './content.js';
import {
  DESIRE_APOSTLE_ABILITY_IDS, DESIRE_APOSTLE_CASE_IDS, type DesireApostleAcquisitionCommand, type DesireApostleAction,
  type DesireApostleBottle, type DesireApostleCommand, type DesireApostlePractice, type DesireApostleProjection, type DesireApostleState,
} from './types.js';

export function freshDesireApostlePractice(): DesireApostlePractice {
  return { emotion: 'CALM', seed: 'NONE', pauseObserved: false, ledger: 'GUIDE', note: 'BLANK' };
}

export function createDesireApostleState(): DesireApostleState {
  return {
    guidanceKnown: false,
    bottles: DESIRE_APOSTLE_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, demonActingAtPromotion: null,
    cases: Object.fromEntries(DESIRE_APOSTLE_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: freshDesireApostlePractice(),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, emotion: 'CALM', seedPlanted: false, lastSeedRound: null, staggerReady: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'abyss' && (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isDemon = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.criminal.discovered && s.criminal.guidanceKnown && s.unwinged.guidanceKnown && s.serialKiller.guidanceKnown && s.demon.guidanceKnown && s.demon.promotionWeek !== null && (isDemon(s) || promoted(s));
const potionPrice = (bottle: DesireApostleBottle) => DESIRE_APOSTLE_PRICES.potion - (bottle.labourSteps === 5 ? DESIRE_APOSTLE_PRICES.labourCredit : 0);
const bottleNumber = (bottle: DesireApostleBottle) => Number(bottle.id.slice('desire-apostle-potion-'.length));
const demonWeeks = (s: SliceState) => Math.max(0, (s.desireApostle.promotionWeek ?? s.week) - (s.demon.promotionWeek ?? s.week));
const inheritedContactOpen = (s: SliceState) => demonInside(s) || s.demon.practice.body !== 'NORMAL' || s.demon.practice.flame === 'LIT';
const supplyExhausted = (state: DesireApostleState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${DESIRE_APOSTLE_GUIDE}的独立欲望使徒成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5欲望使徒魔药，原瓶desire-apostle-potion-${number}，非罪犯、折翼天使、连环杀手或恶魔旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: DesireApostleAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (desireApostleInside(s) || inheritedContactOpen(s)) return '先实际结束当前训练实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原旧货库练习室，找到罗安·费里。';
  if (!knownChannel(s)) return '成为恶魔并保有罗安·费里的指导渠道后，才能继续了解欲望使徒之路。';
  if (promoted(s)) return '你已完成欲望使徒晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.desireApostle.guidanceKnown) return '已经听过欲望使徒成品魔药的用药说明。';
    return s.cash < DESIRE_APOSTLE_PRICES.guidance ? '欲望使徒用药指导需要460便士。' : null;
  }
  if (!s.desireApostle.guidanceKnown) return '先听罗安·费里说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.desireApostle.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.desireApostle) ? null : '须先用完现有全部欲望使徒原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.desireApostle.resupply.requestedWeek === null) return '尚未申请下一批欲望使徒补给。';
    if (s.week <= s.desireApostle.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.desireApostle) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.desireApostle.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选欲望使徒原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `恶魔魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.demon.promotionWeek === null || demonWeeks(s) < DESIRE_APOSTLE_MIN_DEMON_WEEKS) return `成为恶魔后已度过${demonWeeks(s)}/${DESIRE_APOSTLE_MIN_DEMON_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原旧货库练习室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyDesireApostleCommand(s: SliceState, command: DesireApostleAcquisitionCommand, c: SeerContext): void {
  rule(validateDesireApostleCommand(command) && isDesireApostleAcquisitionCommand(command), '欲望使徒准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= DESIRE_APOSTLE_PRICES.guidance;
      s.desireApostle.guidanceKnown = true;
      c.note('听取欲望使徒用药说明', `花费1行动、460便士，你向已认识的本作原创成年${DESIRE_APOSTLE_GUIDE}继续请教，导师向你说明从独立欲望使徒成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原旧货库练习室安静场地与在场照护安排。这些不是原来的罪犯、折翼天使、连环杀手或恶魔存药。${DESIRE_APOSTLE_FORMULA_STATUS}恶魔消化须达100，晋升恶魔后满12整周才能服用；可提前筹备。${DESIRE_APOSTLE_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.desireApostle.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = DESIRE_APOSTLE_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在罗安·费里的原旧货库练习室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.desireApostle.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('欲望使徒原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原旧货库练习室劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；恶魔消化100且晋升恶魔后满12整周时，再独立确认服药。${DESIRE_APOSTLE_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.desireApostle.resupply.requestedWeek = s.week;
      c.note('申请下一批欲望使徒魔药', `现有欲望使徒原瓶全部耗尽且未晋升。你花费1行动，请${DESIRE_APOSTLE_GUIDE}从同一新渠道订下一批三瓶，并实际核验原旧货库练习室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.desireApostle.bottles.length + 1;
      s.desireApostle.resupply.deliveries += 1;
      for (let offset = 0; offset < DESIRE_APOSTLE_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.desireApostle.bottles.push({ id: `desire-apostle-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.desireApostle.resupply.requestedWeek = null;
      c.note('下一批欲望使徒原瓶到货', `第${s.week}周，罗安·费里的独立欲望使徒成品交接渠道本作G成品供给第${s.desireApostle.resupply.deliveries + 1}批三瓶实际到货，原瓶desire-apostle-potion-${firstNumber}至desire-apostle-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.desireApostle.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次欲望使徒服药准备', `原成年${DESIRE_APOSTLE_GUIDE}在原旧货库练习室实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.desireApostle.demonActingAtPromotion = s.progression.acting;
        s.desireApostle.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of DESIRE_APOSTLE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为欲望使徒', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。罪犯、折翼天使、连环杀手与恶魔全部原能力及原ID掌握完整继承，仅新增abyss.s5.emotion-seed与abyss.s5.catalysis两项，从0掌握开始；恶魔消化成果、原晋升周、原瓶、已完成实践、实际身体与火焰记录、良知丧失和已解决敌人记录均保持原样，欲望使徒扮演从0开始。灵性上限提高到100，当前灵性没有补满。强烈情绪中的种子与催化必须有当前真实条件、实际费用与判定；情绪平稳、欲望内敛会阻止操控催化。不读秘密，不永久控制人格，不自动造成心脏停跳。良知不恢复，恶欲与失控风险不消失；没有获得个体燃角招式、影化或序列4魔鬼能力。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了欲望使徒晋升' : '欲望使徒魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是恶魔，消化与全部原有掌握保留，没有获得欲望使徒能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectDesireApostle(s: SliceState): DesireApostleProjection {
  const actions: DesireApostleAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.devil.desireApostleActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: DesireApostleAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.desireApostle.guidanceKnown) add('learn-desire-apostle-guidance', '请罗安·费里说明欲望使徒成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.desireApostle.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${DESIRE_APOSTLE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶欲望使徒魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.desireApostle.resupply.requestedWeek !== null) add('receive-desire-apostle-supply', '确认下一批三瓶欲望使徒到货', `0行动 · 第${s.desireApostle.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.desireApostle)) add('request-desire-apostle-supply', '向罗安·费里订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.desireApostle.guidanceKnown) {
    for (const bottle of s.desireApostle.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶欲望使徒魔药`, `0行动 · 独立确认 · 恶魔消化${isPromoted ? s.desireApostle.demonActingAtPromotion : s.progression.acting}/100 · 晋升后${demonWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.desireApostle.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.desireApostle.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '欲望使徒 · 序列5' : '欲望使徒之路', discovered: available,
    guidanceKnown: available && s.desireApostle.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: null,
    ...(isPromoted && s.desireApostle.encounter.status === 'FIGHTING' && s.combat?.encounterId === 'DESIRE_APOSTLE_DISPUTE' ? { battle: { emotion: s.desireApostle.encounter.emotion, seedPlanted: s.desireApostle.encounter.seedPlanted, seedRound: s.desireApostle.encounter.lastSeedRound, staggerReady: s.desireApostle.encounter.staggerReady } } : {}),
    cases: [], environment: '', insideCase: (desireApostleInside(s) || inheritedContactOpen(s)),
    ...(available ? { story: DESIRE_APOSTLE_SOURCE_STATUS } : {}),
    supplies: available ? `${DESIRE_APOSTLE_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.desireApostle.resupply.requestedWeek === null ? `已实际接收后续供给${s.desireApostle.resupply.deliveries}批。` : `第${s.desireApostle.resupply.requestedWeek}周提出请求，第${s.desireApostle.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.desireApostle.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 欲望使徒魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? DESIRE_APOSTLE_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `恶魔消化成果${s.desireApostle.demonActingAtPromotion}/100已保留；欲望使徒扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成恶魔消化（${s.progression.acting}/100），并在晋升恶魔后度过12整周（${demonWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完恶魔之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${DESIRE_APOSTLE_CONSUMPTION_RISK}` : '成为恶魔后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isDesireApostleAcquisitionCommand(command: unknown): command is DesireApostleAcquisitionCommand {
  return validateDesireApostleCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateDesireApostleCommand(value: unknown): value is DesireApostleCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^desire-apostle-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^desire-apostle-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && DESIRE_APOSTLE_CASE_IDS.includes(value.caseId as typeof DESIRE_APOSTLE_CASE_IDS[number]);
  if (value.type === 'CATALYZE') return shape(value, ['type', 'caseId']) && value.caseId === 'eager-rehearsal';
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && DESIRE_APOSTLE_CASE_IDS.includes(value.caseId as typeof DESIRE_APOSTLE_CASE_IDS[number]) && (value.method === 'ORDINARY' || value.method === 'ABILITY' && value.caseId === 'eager-rehearsal');
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateDesireApostleState(s: SliceState): boolean {
  const raw: unknown = s.desireApostle;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'demonActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.criminal) || !record(s.unwinged) || !record(s.serialKiller) || !record(s.demon)) return false;
  const firstDemonWeek = s.demon.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstDemonWeek + DESIRE_APOSTLE_MIN_DEMON_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== DESIRE_APOSTLE_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, DESIRE_APOSTLE_CASE_IDS) || !record(raw.practice) || !record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'emotion', 'seedPlanted', 'lastSeedRound', 'staggerReady']) || !['STRONG', 'CALM'].includes(raw.encounter.emotion as string) || typeof raw.encounter.seedPlanted !== 'boolean' || typeof raw.encounter.staggerReady !== 'boolean' || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateDesireApostleLife(s)) return false;
  const desireApostle = raw as unknown as DesireApostleState, isPromoted = promoted(s);
  if (desireApostle.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!desireApostle.guidanceKnown || !integer(s.demon.promotionWeek, 1, s.week) || !integer(desireApostle.promotionWeek, firstConsumptionWeek, s.week) || desireApostle.demonActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS, ...DEMON_ABILITY_IDS, ...DESIRE_APOSTLE_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DEVIL_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?BLATHERER_ABILITY_IDS:[]),...(s.progression.sequence===2?BLOOD_DUKE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (desireApostle.promotionWeek !== null || desireApostle.demonActingAtPromotion !== null || DESIRE_APOSTLE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (Object.entries(freshDesireApostlePractice()).some(([key, value]) => desireApostle.practice[key as keyof DesireApostlePractice] !== value)) return false;
    if (desireApostle.reflected || Object.values(desireApostle.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of desireApostle.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `desire-apostle-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of desireApostle.bottles.entries()) {
    let stockWeek = firstDemonWeek;
    if (index < DESIRE_APOSTLE_BOTTLE_IDS.length) {
      if (bottle.source !== DESIRE_APOSTLE_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!desireApostle.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / DESIRE_APOSTLE_BOTTLE_IDS.length) - 1;
      if (index % DESIRE_APOSTLE_BOTTLE_IDS.length === 0) {
        const previous = desireApostle.bottles.slice(index - DESIRE_APOSTLE_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > desireApostle.promotionWeek!) return false;
    }
    if (!desireApostle.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > desireApostle.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > desireApostle.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== desireApostle.promotionWeek) return false;
    }
  }
  if (desireApostle.resupply.requestedWeek !== null && (!desireApostle.guidanceKnown || isPromoted || !supplyExhausted(desireApostle) || desireApostle.bottles.some(bottle => bottle.consumedWeek! > desireApostle.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0) && validateDesireApostleEncounter(s);
}

export { DESIRE_APOSTLE_ABILITIES } from './content.js';
export type * from './types.js';
