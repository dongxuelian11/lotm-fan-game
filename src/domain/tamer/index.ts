import { LIFE_GIVER_ABILITY_IDS } from '../life-giver/types.js';
import {SUMMONING_MASTER_ABILITY_IDS} from '../summoning-master/types.js';
import {WITCH_KING_ABILITY_IDS} from '../witch-king/types.js';
import {CRIMSON_SCHOLAR_ABILITY_IDS} from '../crimson-scholar/types.js';
import {POTION_PROFESSOR_ABILITY_IDS} from '../potion-professor/types.js';
import {VAMPIRE_ABILITY_IDS} from '../vampire/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { APOTHECARY_ABILITY_IDS } from '../apothecary/types.js';
import {
  TAMER_ABILITIES, TAMER_BOTTLE_IDS, TAMER_CONSUMPTION_RISK, TAMER_FORMULA_STATUS,
  TAMER_GUIDE, TAMER_LABOUR_TASKS, TAMER_MIN_APOTHECARY_WEEKS, TAMER_POTION_SOURCES, TAMER_PRICES,
} from './content.js';
import {
  TAMER_ABILITY_IDS, TAMER_ANIMAL_IDS, type TamerAcquisitionCommand, type TamerAction,
  type TamerBottle, type TamerCommand, type TamerProjection, type TamerState,
} from './types.js';

export function createTamerState(): TamerState {
  return {
    guidanceKnown: false,
    bottles: TAMER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, apothecaryActingAtPromotion: null,
    animals: Object.fromEntries(TAMER_ANIMAL_IDS.map(id => [id, { observed: false, trained: false, helped: false, trainingAttemptWeek: null, helpAttemptWeek: null, location: 'HOME', foodPurchased: 0, foodHeld: 0, foodUsed: 0, foodWeek: null }])),
    companionId: null,
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'moon' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0))));
const isApothecary = (s: SliceState) => s.progression.pathwayId === 'moon' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.apothecary.discovered && s.apothecary.guidanceKnown && (isApothecary(s) || promoted(s));
const potionPrice = (bottle: TamerBottle) => TAMER_PRICES.potion - (bottle.labourSteps === 3 ? TAMER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: TamerBottle) => Number(bottle.id.slice('tamer-potion-'.length));
const apothecaryWeeks = (s: SliceState) => Math.max(0, (s.tamer.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const supplyExhausted = (state: TamerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${TAMER_GUIDE}的新照护站交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列8驯兽师魔药，原瓶tamer-potion-${number}，非药师旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: TamerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原诊所，找到艾琳。';
  if (!knownChannel(s)) return '成为药师并保有艾琳的指导渠道后，才能继续驯兽师之路。';
  if (promoted(s)) return '你已完成驯兽师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.tamer.guidanceKnown) return '已经听过驯兽师成品魔药的用药说明。';
    return s.cash < TAMER_PRICES.guidance ? '驯兽师用药指导需要180便士。' : null;
  }
  if (!s.tamer.guidanceKnown) return '先听艾琳说明这批序列8原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.tamer.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.tamer) ? null : '须先用完现有全部驯兽师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.tamer.resupply.requestedWeek === null) return '尚未申请下一批驯兽师补给。';
    if (s.week <= s.tamer.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.tamer) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.tamer.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选驯兽师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `药师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || apothecaryWeeks(s) < TAMER_MIN_APOTHECARY_WEEKS) return `成为药师后已度过${apothecaryWeeks(s)}/${TAMER_MIN_APOTHECARY_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 3 ? '这瓶对应的三次诊所劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyTamerCommand(s: SliceState, command: TamerAcquisitionCommand, c: SeerContext): void {
  rule(validateTamerCommand(command) && ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(command.type), '驯兽师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= TAMER_PRICES.guidance;
      s.tamer.guidanceKnown = true;
      c.note('听取驯兽师用药说明', `花费1行动、180便士，${TAMER_GUIDE}向你说明从新照护站交接渠道实际取得的三瓶序列8成品、逐瓶交付与四档风险。这些不是原来的药师存药。${TAMER_FORMULA_STATUS}药师消化须达100，首次晋升药师后满6整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.tamer.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = TAMER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在艾琳的原诊所实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/3，原瓶仍由导师保管。${bottle.labourSteps === 3 ? '三次劳务只抵这瓶1200便士，仍须实际支付170便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应三次劳务后才能抵这瓶1200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.tamer.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('驯兽师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列8成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 3 ? '对应三次诊所劳务抵扣1200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；药师消化100且首次晋升后满6整周时，再独立确认服药。${TAMER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.tamer.resupply.requestedWeek = s.week;
      c.note('申请下一批驯兽师魔药', `现有驯兽师原瓶全部耗尽且未晋升。你花费1行动，请${TAMER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原诊所的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付1370便士，或分别完成三次劳务后支付170便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.tamer.bottles.length + 1;
      s.tamer.resupply.deliveries += 1;
      for (let offset = 0; offset < TAMER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.tamer.bottles.push({ id: `tamer-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.tamer.resupply.requestedWeek = null;
      c.note('下一批驯兽师原瓶到货', `第${s.week}周，艾琳的新照护站交接渠道本作G成品供给第${s.tamer.resupply.deliveries + 1}批三瓶实际到货，原瓶tamer-potion-${firstNumber}至tamer-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按1370便士购买，或完成对应三次劳务再付170便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.tamer.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.tamer.apothecaryActingAtPromotion = s.progression.acting;
        s.tamer.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of TAMER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 4], ['perception', 2], ['will', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为驯兽师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+4、感知+2、意志+1，知识不变。三项药师能力及掌握完整继承，驯兽、理解动物意图与强健体魄从0掌握开始；药师消化成果和首次晋升周保留，驯兽师扮演从0开始。灵性上限提高到45，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了驯兽师晋升' : '驯兽师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是药师，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectTamer(s: SliceState): TamerProjection {
  const actions: TamerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: TamerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.tamer.guidanceKnown) add('learn-tamer-guidance', '请艾琳说明驯兽师成品与风险', '1行动 · 180便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.tamer.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 3) add(`work-${bottle.id}`, `第${number}瓶 · ${TAMER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/3，完成三次抵该瓶1200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶驯兽师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列8原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.tamer.resupply.requestedWeek !== null) add('receive-tamer-supply', '确认下一批三瓶驯兽师到货', `0行动 · 第${s.tamer.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.tamer)) add('request-tamer-supply', '向艾琳订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.tamer.guidanceKnown) {
    for (const bottle of s.tamer.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶驯兽师魔药`, `0行动 · 独立确认 · 药师消化${isPromoted ? s.tamer.apothecaryActingAtPromotion : s.progression.acting}/100 · 晋升后${apothecaryWeeks(s)}/6整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.tamer.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.tamer.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '驯兽师 · 序列8' : '驯兽师之路', discovered: available,
    guidanceKnown: available && s.tamer.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    animals: [], companionName: null,
    supplies: available ? `${TAMER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.tamer.resupply.requestedWeek === null ? `已实际接收后续供给${s.tamer.resupply.deliveries}批。` : `第${s.tamer.resupply.requestedWeek}周提出请求，第${s.tamer.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.tamer.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 驯兽师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/3`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? TAMER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0))))?s.vampire.tamerActingAtPromotion??100:s.progression.acting) : 0,
    digestion:s.progression.pathwayId==='moon'&&(s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0))))?'驯兽师魔药已消化，原动物及当面训练记录保留。':isPromoted ? `药师消化成果${s.tamer.apothecaryActingAtPromotion}/100已保留；驯兽师扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成药师消化（${s.progression.acting}/100），并在首次晋升药师后度过6整周（${apothecaryWeeks(s)}/6）。用药指导与原瓶可以提前准备。` : '先走完药师之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应三次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${TAMER_CONSUMPTION_RISK}` : '成为药师后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateTamerCommand(value: unknown): value is TamerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'RETURN_ANIMAL', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^tamer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^tamer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'BUY_FEED', 'TRAIN', 'INVITE', 'ASSIST'].includes(value.type as string)) return shape(value, ['type', 'animalId']) && TAMER_ANIMAL_IDS.includes(value.animalId as typeof TAMER_ANIMAL_IDS[number]);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful animal history and feed conservation. */
export function validateTamerState(s: SliceState): boolean {
  const raw: unknown = s.tamer;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'apothecaryActingAtPromotion', 'animals', 'companionId', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.apothecary)) return false;
  const firstApothecaryWeek = s.progression.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstApothecaryWeek + TAMER_MIN_APOTHECARY_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== TAMER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.animals) || !shape(raw.animals, TAMER_ANIMAL_IDS)) return false;
  if (raw.companionId !== null && !TAMER_ANIMAL_IDS.includes(raw.companionId as typeof TAMER_ANIMAL_IDS[number])) return false;
  for (const value of Object.values(raw.animals)) {
    if (!record(value) || !shape(value, ['observed', 'trained', 'helped', 'trainingAttemptWeek', 'helpAttemptWeek', 'location', 'foodPurchased', 'foodHeld', 'foodUsed', 'foodWeek'])) return false;
    if (typeof value.observed !== 'boolean' || typeof value.trained !== 'boolean' || typeof value.helped !== 'boolean' || !['HOME', 'WITH_PLAYER'].includes(value.location as string)) return false;
    if (!['trainingAttemptWeek', 'helpAttemptWeek', 'foodWeek'].every(key => value[key] === null || integer(value[key], 1, s.week))) return false;
    if (!['foodPurchased', 'foodHeld', 'foodUsed'].every(key => integer(value[key], 0))) return false;
  }
  const tamer = raw as unknown as TamerState, isPromoted = promoted(s);
  if (tamer.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!tamer.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(tamer.promotionWeek, firstConsumptionWeek, s.week) || tamer.apothecaryActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0))))?VAMPIRE_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0)))?POTION_PROFESSOR_ABILITY_IDS:[]),...((s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0)))?CRIMSON_SCHOLAR_ABILITY_IDS:[]),...(([4, 3, 2].includes(s.progression.sequence ?? 0))?WITCH_KING_ABILITY_IDS:[]),...([3, 2].includes(s.progression.sequence ?? 0) ? SUMMONING_MASTER_ABILITY_IDS : []),...(s.progression.sequence === 2 ? LIFE_GIVER_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (tamer.promotionWeek !== null || tamer.apothecaryActingAtPromotion !== null || TAMER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (tamer.reflected || tamer.companionId !== null || Object.values(tamer.animals).some(value => value.observed || value.trained || value.helped || value.trainingAttemptWeek !== null || value.helpAttemptWeek !== null || value.location !== 'HOME' || value.foodPurchased !== 0 || value.foodHeld !== 0 || value.foodUsed !== 0 || value.foodWeek !== null)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of tamer.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `tamer-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 3)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of tamer.bottles.entries()) {
    let stockWeek = firstApothecaryWeek;
    if (index < TAMER_BOTTLE_IDS.length) {
      if (bottle.source !== TAMER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!tamer.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / TAMER_BOTTLE_IDS.length) - 1;
      if (index % TAMER_BOTTLE_IDS.length === 0) {
        const previous = tamer.bottles.slice(index - TAMER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > tamer.promotionWeek!) return false;
    }
    if (!tamer.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > tamer.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > tamer.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== tamer.promotionWeek) return false;
    }
  }
  if (tamer.resupply.requestedWeek !== null && (!tamer.guidanceKnown || isPromoted || !supplyExhausted(tamer) || tamer.bottles.some(bottle => bottle.consumedWeek! > tamer.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}
