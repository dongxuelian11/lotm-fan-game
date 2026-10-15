import { BARREN_MATRIARCH_ABILITY_IDS } from '../barren-matriarch/types.js';
import {COFFIN_BEARER_ABILITY_IDS} from '../coffin-bearer/types.js';
import {ANCIENT_ALCHEMIST_ABILITY_IDS} from '../ancient-alchemist/types.js';
import {DRUID_ABILITY_IDS} from '../druid/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CULTIVATOR_ABILITY_IDS } from '../cultivator/types.js';
import { PHYSICIAN_ABILITY_IDS } from '../physician/types.js';
import { validateBiologistLife } from './life.js';
import { HARVESTPRIEST_ABILITY_IDS } from '../harvestpriest/types.js';
import {
  BIOLOGIST_ABILITIES, BIOLOGIST_BOTTLE_IDS, BIOLOGIST_CONSUMPTION_RISK, BIOLOGIST_FORMULA_STATUS,
  BIOLOGIST_GUIDE, BIOLOGIST_LABOUR_TASKS, BIOLOGIST_MIN_HARVESTPRIEST_WEEKS, BIOLOGIST_POTION_SOURCES, BIOLOGIST_PRICES, BIOLOGIST_SOURCE_STATUS,
} from './content.js';
import {
  BIOLOGIST_ABILITY_IDS, BIOLOGIST_CASE_IDS, type BiologistAcquisitionCommand, type BiologistAction,
  type BiologistBottle, type BiologistCommand, type BiologistProjection, type BiologistState,
} from './types.js';

export function createBiologistState(): BiologistState {
  return {
    guidanceKnown: false,
    bottles: BIOLOGIST_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, harvestpriestActingAtPromotion: null,
    cases: Object.fromEntries(BIOLOGIST_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { sampleRecorded: false, warningsRecorded: false },
    trial: { careWeek: null, verifiedWeek: null, waterUsed: 0, location: 'BENCH', status: 'IDLE' },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'mother' && (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isHarvestpriest = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.cultivator.discovered && s.cultivator.guidanceKnown && s.physician.guidanceKnown && s.harvestpriest.guidanceKnown && s.harvestpriest.promotionWeek !== null && (isHarvestpriest(s) || promoted(s));
const potionPrice = (bottle: BiologistBottle) => BIOLOGIST_PRICES.potion - (bottle.labourSteps === 5 ? BIOLOGIST_PRICES.labourCredit : 0);
const bottleNumber = (bottle: BiologistBottle) => Number(bottle.id.slice('biologist-potion-'.length));
const harvestpriestWeeks = (s: SliceState) => Math.max(0, (s.biologist.promotionWeek ?? s.week) - (s.harvestpriest.promotionWeek ?? s.week));
const supplyExhausted = (state: BiologistState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${BIOLOGIST_GUIDE}的独立生物学家成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6生物学家魔药，原瓶biologist-potion-${number}，非耕种者、医师或丰收祭司旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: BiologistAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.biologist.cases).some(value => value.contactOpen)) return '先实际结束本次生物学家实践的接触，再继续。';
  if (Object.values(s.harvestpriest.cases).some(value => value.contactOpen) || Object.values(s.physician.cases).some(value => value.contactOpen) || Object.values(s.cultivator.cases).some(value => value.contactOpen)) return '先实际结束原序列尚未收束的接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原苗圃温室，找到伊芙·莫兰。';
  if (!knownChannel(s)) return '成为丰收祭司并保有伊芙·莫兰的指导渠道后，才能继续了解生物学家之路。';
  if (promoted(s)) return '你已完成生物学家晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.biologist.guidanceKnown) return '已经听过生物学家成品魔药的用药说明。';
    return s.cash < BIOLOGIST_PRICES.guidance ? '生物学家用药指导需要360便士。' : null;
  }
  if (!s.biologist.guidanceKnown) return '先听伊芙·莫兰说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.biologist.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.biologist) ? null : '须先用完现有全部生物学家原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.biologist.resupply.requestedWeek === null) return '尚未申请下一批生物学家补给。';
    if (s.week <= s.biologist.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.biologist) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.biologist.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选生物学家原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `丰收祭司魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.harvestpriest.promotionWeek === null || harvestpriestWeeks(s) < BIOLOGIST_MIN_HARVESTPRIEST_WEEKS) return `成为丰收祭司后已度过${harvestpriestWeeks(s)}/${BIOLOGIST_MIN_HARVESTPRIEST_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原苗圃温室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyBiologistCommand(s: SliceState, command: BiologistAcquisitionCommand, c: SeerContext): void {
  rule(validateBiologistCommand(command) && isBiologistAcquisitionCommand(command), '生物学家准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= BIOLOGIST_PRICES.guidance;
      s.biologist.guidanceKnown = true;
      c.note('听取生物学家用药说明', `花费1行动、360便士，你向已认识的本作原创成年${BIOLOGIST_GUIDE}继续请教，她向你说明从独立生物学家成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的耕种者、医师或丰收祭司存药。${BIOLOGIST_FORMULA_STATUS}丰收祭司消化须达100，晋升丰收祭司后满12整周才能服用；可提前筹备。${BIOLOGIST_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.biologist.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = BIOLOGIST_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊芙·莫兰的原苗圃温室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.biologist.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('生物学家原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原苗圃温室劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；丰收祭司消化100且晋升丰收祭司后满12整周时，再独立确认服药。${BIOLOGIST_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.biologist.resupply.requestedWeek = s.week;
      c.note('申请下一批生物学家魔药', `现有生物学家原瓶全部耗尽且未晋升。你花费1行动，请${BIOLOGIST_GUIDE}从同一新渠道订下一批三瓶，并实际核验原苗圃温室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.biologist.bottles.length + 1;
      s.biologist.resupply.deliveries += 1;
      for (let offset = 0; offset < BIOLOGIST_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.biologist.bottles.push({ id: `biologist-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.biologist.resupply.requestedWeek = null;
      c.note('下一批生物学家原瓶到货', `第${s.week}周，伊芙·莫兰的独立生物学家成品交接渠道本作G成品供给第${s.biologist.resupply.deliveries + 1}批三瓶实际到货，原瓶biologist-potion-${firstNumber}至biologist-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.biologist.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.biologist.harvestpriestActingAtPromotion = s.progression.acting;
        s.biologist.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of BIOLOGIST_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为生物学家', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。耕种者、医师与丰收祭司全部原能力及原ID掌握完整继承，只新增有限样本研究与有限对照实践两项，从0掌握开始；丰收祭司消化成果与丰收祭司晋升周保留，生物学家扮演从0开始。灵性上限提高到80，当前灵性没有补满。不赠样本、苗木或原水；研究依赖眼前原样本与原苗、真实材料、时间和复核，允许失败，不保证全知鉴定、新品种、可食性或凭空产量。当前有限实践均为G，序列5德鲁伊催化、动物变化与沼泽没有下放。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了生物学家晋升' : '生物学家魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是丰收祭司，消化与全部原有掌握保留，没有获得生物学家能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectBiologist(s: SliceState): BiologistProjection {
  const actions: BiologistAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.druid.biologistActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: BiologistAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.biologist.guidanceKnown) add('learn-biologist-guidance', '请伊芙·莫兰说明生物学家成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.biologist.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${BIOLOGIST_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶生物学家魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.biologist.resupply.requestedWeek !== null) add('receive-biologist-supply', '确认下一批三瓶生物学家到货', `0行动 · 第${s.biologist.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.biologist)) add('request-biologist-supply', '向伊芙·莫兰订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.biologist.guidanceKnown) {
    for (const bottle of s.biologist.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶生物学家魔药`, `0行动 · 独立确认 · 丰收祭司消化${isPromoted ? s.biologist.harvestpriestActingAtPromotion : s.progression.acting}/100 · 晋升后${harvestpriestWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.biologist.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.biologist.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '生物学家 · 序列6' : '生物学家之路', discovered: available,
    guidanceKnown: available && s.biologist.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: { ...s.biologist.practice }, trial: { ...s.biologist.trial },
    water: { held: s.harvestpriest.plot.water, used: s.harvestpriest.plot.waterUsed, summary: `仍使用伊芙原畦旁同一标记格的原水：现有${s.harvestpriest.plot.water}份，累计已用${s.harvestpriest.plot.waterUsed}份，其中本次温室对照实用${s.biologist.trial.waterUsed}份；每次取1份到同苗圃温室，没有第二库存。` },
    cases: [], environment: '', insideCase: Object.values(s.biologist.cases).some(value => value.contactOpen),
    ...(available ? { story: BIOLOGIST_SOURCE_STATUS.replace('序列5德鲁伊的催化、动物变化和沼泽不下放。', '序列5已核的潜地能力未下放，具体动物变化清单尚未核实。') } : {}),
    supplies: available ? `${BIOLOGIST_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.biologist.resupply.requestedWeek === null ? `已实际接收后续供给${s.biologist.resupply.deliveries}批。` : `第${s.biologist.resupply.requestedWeek}周提出请求，第${s.biologist.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.biologist.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 生物学家魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? BIOLOGIST_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `丰收祭司消化成果${s.biologist.harvestpriestActingAtPromotion}/100已保留；生物学家扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成丰收祭司消化（${s.progression.acting}/100），并在晋升丰收祭司后度过12整周（${harvestpriestWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完丰收祭司之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${BIOLOGIST_CONSUMPTION_RISK}` : '成为丰收祭司后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isBiologistAcquisitionCommand(command: unknown): command is BiologistAcquisitionCommand {
  return validateBiologistCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateBiologistCommand(value: unknown): value is BiologistCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'BUY_WATER'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^biologist-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^biologist-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'VERIFY') return shape(value, ['type', 'caseId']) && value.caseId === 'paired-seedling';
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && BIOLOGIST_CASE_IDS.includes(value.caseId as typeof BIOLOGIST_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && BIOLOGIST_CASE_IDS.includes(value.caseId as typeof BIOLOGIST_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateBiologistState(s: SliceState): boolean {
  const raw: unknown = s.biologist;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'harvestpriestActingAtPromotion', 'cases', 'practice', 'trial', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.cultivator) || !record(s.physician) || !record(s.harvestpriest)) return false;
  const firstHarvestpriestWeek = s.harvestpriest.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstHarvestpriestWeek + BIOLOGIST_MIN_HARVESTPRIEST_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== BIOLOGIST_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, BIOLOGIST_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'SAMPLE_RECORDED', 'TRIAL_RECORDED', 'RETURN_RECORDED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const biologist = raw as unknown as BiologistState, isPromoted = promoted(s);
  if (biologist.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!biologist.guidanceKnown || !integer(s.harvestpriest.promotionWeek, 1, s.week) || !integer(biologist.promotionWeek, firstConsumptionWeek, s.week) || biologist.harvestpriestActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS, ...HARVESTPRIEST_ABILITY_IDS, ...BIOLOGIST_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?DRUID_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?ANCIENT_ALCHEMIST_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?COFFIN_BEARER_ABILITY_IDS:[]),...(s.progression.sequence===2?BARREN_MATRIARCH_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (biologist.promotionWeek !== null || biologist.harvestpriestActingAtPromotion !== null || BIOLOGIST_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (biologist.reflected || Object.values(biologist.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of biologist.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `biologist-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of biologist.bottles.entries()) {
    let stockWeek = firstHarvestpriestWeek;
    if (index < BIOLOGIST_BOTTLE_IDS.length) {
      if (bottle.source !== BIOLOGIST_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!biologist.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / BIOLOGIST_BOTTLE_IDS.length) - 1;
      if (index % BIOLOGIST_BOTTLE_IDS.length === 0) {
        const previous = biologist.bottles.slice(index - BIOLOGIST_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > biologist.promotionWeek!) return false;
    }
    if (!biologist.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > biologist.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > biologist.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== biologist.promotionWeek) return false;
    }
  }
  if (biologist.resupply.requestedWeek !== null && (!biologist.guidanceKnown || isPromoted || !supplyExhausted(biologist) || biologist.bottles.some(bottle => bottle.consumedWeek! > biologist.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = biologist.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, biologist.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'BIOLOGIST_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(biologist.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.status !== 'ACTIVE' || s.activeEvent !== null || s.world.city !== 'BACKLUND' || Object.values(biologist.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'biologist-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateBiologistLife(s);
}

export { BIOLOGIST_ABILITIES } from './content.js';
export type * from './types.js';
