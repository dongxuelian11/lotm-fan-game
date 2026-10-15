import { BARREN_MATRIARCH_ABILITY_IDS } from '../barren-matriarch/types.js';
import {COFFIN_BEARER_ABILITY_IDS} from '../coffin-bearer/types.js';
import {ANCIENT_ALCHEMIST_ABILITY_IDS} from '../ancient-alchemist/types.js';
import {DRUID_ABILITY_IDS} from '../druid/types.js';
import {BIOLOGIST_ABILITY_IDS} from '../biologist/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CULTIVATOR_ABILITY_IDS } from '../cultivator/types.js';
import { PHYSICIAN_ABILITY_IDS } from '../physician/types.js';
import {
  HARVESTPRIEST_ABILITIES, HARVESTPRIEST_BOTTLE_IDS, HARVESTPRIEST_CONSUMPTION_RISK, HARVESTPRIEST_FORMULA_STATUS,
  HARVESTPRIEST_GUIDE, HARVESTPRIEST_LABOUR_TASKS, HARVESTPRIEST_MIN_PHYSICIAN_WEEKS, HARVESTPRIEST_POTION_SOURCES, HARVESTPRIEST_PRICES, HARVESTPRIEST_SOURCE_STATUS,
} from './content.js';
import {
  HARVESTPRIEST_ABILITY_IDS, HARVESTPRIEST_CASE_IDS, type HarvestpriestAcquisitionCommand, type HarvestpriestAction,
  type HarvestpriestBottle, type HarvestpriestCommand, type HarvestpriestProjection, type HarvestpriestState,
} from './types.js';

export function createHarvestpriestState(): HarvestpriestState {
  return {
    guidanceKnown: false,
    bottles: HARVESTPRIEST_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, physicianActingAtPromotion: null,
    cases: Object.fromEntries(HARVESTPRIEST_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    reflected: false,
    plot: { waterPacks: 0, water: 0, waterUsed: 0, careWeek: null, harvestWeek: null, produce: 0, delivered: 0, planRecorded: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'mother' && (s.progression.sequence === 7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const isPhysician = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.cultivator.discovered && s.cultivator.guidanceKnown && s.physician.guidanceKnown && (isPhysician(s) || promoted(s));
const potionPrice = (bottle: HarvestpriestBottle) => HARVESTPRIEST_PRICES.potion - (bottle.labourSteps === 4 ? HARVESTPRIEST_PRICES.labourCredit : 0);
const bottleNumber = (bottle: HarvestpriestBottle) => Number(bottle.id.slice('harvestpriest-potion-'.length));
const physicianWeeks = (s: SliceState) => Math.max(0, (s.harvestpriest.promotionWeek ?? s.week) - (s.physician.promotionWeek ?? s.week));
const supplyExhausted = (state: HarvestpriestState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${HARVESTPRIEST_GUIDE}的独立丰收祭司成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列7丰收祭司魔药，原瓶harvestpriest-potion-${number}，非耕种者或医师旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: HarvestpriestAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.cultivator.cases).some(value => value.contactOpen)) return '先实际结束耕种者阶段尚未结束的注意与接触，再继续晋升。';
  if (Object.values(s.physician.cases).some(value => value.contactOpen)) return '先实际结束医师阶段尚未结束的练习，再继续晋升。';
  if (Object.values(s.harvestpriest.cases).some(value => value.contactOpen)) return '先实际结束本次丰收祭司实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的小苗圃，找到伊芙·莫兰。';
  if (!knownChannel(s)) return '成为医师并保有伊芙·莫兰的指导渠道后，才能继续了解丰收祭司之路。';
  if (promoted(s)) return '你已完成丰收祭司晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.harvestpriest.guidanceKnown) return '已经听过丰收祭司成品魔药的用药说明。';
    return s.cash < HARVESTPRIEST_PRICES.guidance ? '丰收祭司用药指导需要240便士。' : null;
  }
  if (!s.harvestpriest.guidanceKnown) return '先听伊芙·莫兰说明这批序列7原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.harvestpriest.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.harvestpriest) ? null : '须先用完现有全部丰收祭司原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.harvestpriest.resupply.requestedWeek === null) return '尚未申请下一批丰收祭司补给。';
    if (s.week <= s.harvestpriest.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.harvestpriest) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.harvestpriest.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选丰收祭司原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `医师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.physician.promotionWeek === null || physicianWeeks(s) < HARVESTPRIEST_MIN_PHYSICIAN_WEEKS) return `成为医师后已度过${physicianWeeks(s)}/${HARVESTPRIEST_MIN_PHYSICIAN_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 4 ? '这瓶对应的四次小苗圃劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyHarvestpriestCommand(s: SliceState, command: HarvestpriestAcquisitionCommand, c: SeerContext): void {
  rule(validateHarvestpriestCommand(command) && isHarvestpriestAcquisitionCommand(command), '丰收祭司准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= HARVESTPRIEST_PRICES.guidance;
      s.harvestpriest.guidanceKnown = true;
      c.note('听取丰收祭司用药说明', `花费1行动、240便士，你向已认识的本作原创成年${HARVESTPRIEST_GUIDE}继续请教，她向你说明从独立丰收祭司成品交接渠道实际取得的三瓶序列7成品、逐瓶交付与四档风险。这些不是原来的耕种者或医师存药。${HARVESTPRIEST_FORMULA_STATUS}医师消化须达100，晋升医师后满8整周才能服用；可提前筹备。${HARVESTPRIEST_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.harvestpriest.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = HARVESTPRIEST_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊芙·莫兰的小苗圃实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/4，原瓶仍由导师保管。${bottle.labourSteps === 4 ? '四次劳务只抵这瓶1800便士，仍须实际支付210便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应四次劳务后才能抵这瓶1800便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.harvestpriest.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('丰收祭司原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列7成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 4 ? '对应四次小苗圃劳务抵扣1800便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；医师消化100且晋升医师后满8整周时，再独立确认服药。${HARVESTPRIEST_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.harvestpriest.resupply.requestedWeek = s.week;
      c.note('申请下一批丰收祭司魔药', `现有丰收祭司原瓶全部耗尽且未晋升。你花费1行动，请${HARVESTPRIEST_GUIDE}从同一新渠道订下一批三瓶，并实际核验小苗圃的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付2010便士，或分别完成四次劳务后支付210便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.harvestpriest.bottles.length + 1;
      s.harvestpriest.resupply.deliveries += 1;
      for (let offset = 0; offset < HARVESTPRIEST_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.harvestpriest.bottles.push({ id: `harvestpriest-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.harvestpriest.resupply.requestedWeek = null;
      c.note('下一批丰收祭司原瓶到货', `第${s.week}周，伊芙·莫兰的独立丰收祭司成品交接渠道本作G成品供给第${s.harvestpriest.resupply.deliveries + 1}批三瓶实际到货，原瓶harvestpriest-potion-${firstNumber}至harvestpriest-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按2010便士购买，或完成对应四次劳务再付210便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.harvestpriest.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.harvestpriest.physicianActingAtPromotion = s.progression.acting;
        s.harvestpriest.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of HARVESTPRIEST_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为丰收祭司', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。三项耕种者与两项医师能力及原ID掌握完整继承，新增本作原创G的丰收照料与生命支持，两项均从0掌握开始；医师消化成果与医师晋升周保留，丰收祭司扮演从0开始。灵性上限提高到60，当前灵性没有补满。有限照料、生命支持与冲突中的防护均为本作原创G，不是已核完整法术表。不复制弗兰克在序列6的杂交改造，也不获得“生命手杖”的区域生命爆发；不凭空丰收、复活、治愈污染或改变天气。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了丰收祭司晋升' : '丰收祭司魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是医师，消化与全部五项原有掌握保留，没有获得丰收祭司能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectHarvestpriest(s: SliceState): HarvestpriestProjection {
  const actions: HarvestpriestAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?s.biologist.harvestpriestActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: HarvestpriestAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.harvestpriest.guidanceKnown) add('learn-harvestpriest-guidance', '请伊芙·莫兰说明丰收祭司成品与风险', '1行动 · 240便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.harvestpriest.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 4) add(`work-${bottle.id}`, `第${number}瓶 · ${HARVESTPRIEST_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/4，完成四次抵该瓶1800便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶丰收祭司魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列7原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.harvestpriest.resupply.requestedWeek !== null) add('receive-harvestpriest-supply', '确认下一批三瓶丰收祭司到货', `0行动 · 第${s.harvestpriest.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.harvestpriest)) add('request-harvestpriest-supply', '向伊芙·莫兰订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.harvestpriest.guidanceKnown) {
    for (const bottle of s.harvestpriest.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶丰收祭司魔药`, `0行动 · 独立确认 · 医师消化${isPromoted ? s.harvestpriest.physicianActingAtPromotion : s.progression.acting}/100 · 晋升后${physicianWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.harvestpriest.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.harvestpriest.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '丰收祭司 · 序列7' : '丰收祭司之路', discovered: available,
    guidanceKnown: available && s.harvestpriest.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', plot: '', insideCase: Object.values(s.harvestpriest.cases).some(value => value.contactOpen),
    ...(available ? { story: HARVESTPRIEST_SOURCE_STATUS } : {}),
    supplies: available ? `${HARVESTPRIEST_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.harvestpriest.resupply.requestedWeek === null ? `已实际接收后续供给${s.harvestpriest.resupply.deliveries}批。` : `第${s.harvestpriest.resupply.requestedWeek}周提出请求，第${s.harvestpriest.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.harvestpriest.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 丰收祭司魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/4`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? HARVESTPRIEST_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?'丰收祭司魔药已消化；原菜畦、实际水源与有限收获去向继续保留。':isPromoted ? `医师消化成果${s.harvestpriest.physicianActingAtPromotion}/100已保留；丰收祭司扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成医师消化（${s.progression.acting}/100），并在晋升医师后度过8整周（${physicianWeeks(s)}/8）。用药指导与原瓶可以提前准备。` : '先走完医师之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应四次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${HARVESTPRIEST_CONSUMPTION_RISK}` : '成为医师后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isHarvestpriestAcquisitionCommand(command: unknown): command is HarvestpriestAcquisitionCommand {
  return validateHarvestpriestCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateHarvestpriestCommand(value: unknown): value is HarvestpriestCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'BUY_WATER', 'HARVEST'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^harvestpriest-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^harvestpriest-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && HARVESTPRIEST_CASE_IDS.includes(value.caseId as typeof HARVESTPRIEST_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && HARVESTPRIEST_CASE_IDS.includes(value.caseId as typeof HARVESTPRIEST_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateHarvestpriestState(s: SliceState): boolean {
  const raw: unknown = s.harvestpriest;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'physicianActingAtPromotion', 'cases', 'reflected', 'plot']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.cultivator) || !record(s.physician)) return false;
  const firstPhysicianWeek = s.physician.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstPhysicianWeek + HARVESTPRIEST_MIN_PHYSICIAN_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== HARVESTPRIEST_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, HARVESTPRIEST_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'BED_SUPPORTED', 'YIELD_SHARED', 'PLAN_RECORDED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  if (!record(raw.plot) || !shape(raw.plot, ['waterPacks', 'water', 'waterUsed', 'careWeek', 'harvestWeek', 'produce', 'delivered', 'planRecorded'])) return false;
  if (!integer(raw.plot.waterPacks, 0, Math.floor(Number.MAX_SAFE_INTEGER / 2)) || !integer(raw.plot.water, 0, 2) || !integer(raw.plot.waterUsed, 0)) return false;
  if ((raw.plot.water as number) + (raw.plot.waterUsed as number) !== (raw.plot.waterPacks as number) * 2) return false;
  if (!integer(raw.plot.produce, 0, 3) || !integer(raw.plot.delivered, 0, 3) || typeof raw.plot.planRecorded !== 'boolean') return false;
  if (raw.plot.careWeek !== null && !integer(raw.plot.careWeek, firstActivityWeek, s.week)) return false;
  if (raw.plot.harvestWeek !== null && (raw.plot.careWeek === null || !integer(raw.plot.harvestWeek, (raw.plot.careWeek as number) + 1, s.week))) return false;
  if ((raw.plot.produce as number) + (raw.plot.delivered as number) !== (raw.plot.harvestWeek === null ? 0 : 3)) return false;
  const harvestpriest = raw as unknown as HarvestpriestState, isPromoted = promoted(s);
  if (harvestpriest.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!harvestpriest.guidanceKnown || !integer(s.physician.promotionWeek, 1, s.week) || !integer(harvestpriest.promotionWeek, firstConsumptionWeek, s.week) || harvestpriest.physicianActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS, ...HARVESTPRIEST_ABILITY_IDS,...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?BIOLOGIST_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?DRUID_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?ANCIENT_ALCHEMIST_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?COFFIN_BEARER_ABILITY_IDS:[]),...(s.progression.sequence===2?BARREN_MATRIARCH_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (harvestpriest.promotionWeek !== null || harvestpriest.physicianActingAtPromotion !== null || HARVESTPRIEST_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (harvestpriest.plot.waterPacks !== 0 || harvestpriest.plot.water !== 0 || harvestpriest.plot.waterUsed !== 0 || harvestpriest.plot.careWeek !== null || harvestpriest.plot.harvestWeek !== null || harvestpriest.plot.produce !== 0 || harvestpriest.plot.delivered !== 0 || harvestpriest.plot.planRecorded) return false;
    if (harvestpriest.reflected || Object.values(harvestpriest.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of harvestpriest.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `harvestpriest-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 4)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of harvestpriest.bottles.entries()) {
    let stockWeek = firstPhysicianWeek;
    if (index < HARVESTPRIEST_BOTTLE_IDS.length) {
      if (bottle.source !== HARVESTPRIEST_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!harvestpriest.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / HARVESTPRIEST_BOTTLE_IDS.length) - 1;
      if (index % HARVESTPRIEST_BOTTLE_IDS.length === 0) {
        const previous = harvestpriest.bottles.slice(index - HARVESTPRIEST_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > harvestpriest.promotionWeek!) return false;
    }
    if (!harvestpriest.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > harvestpriest.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > harvestpriest.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== harvestpriest.promotionWeek) return false;
    }
  }
  if (harvestpriest.resupply.requestedWeek !== null && (!harvestpriest.guidanceKnown || isPromoted || !supplyExhausted(harvestpriest) || harvestpriest.bottles.some(bottle => bottle.consumedWeek! > harvestpriest.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { HARVESTPRIEST_ABILITIES } from './content.js';
export type * from './types.js';
