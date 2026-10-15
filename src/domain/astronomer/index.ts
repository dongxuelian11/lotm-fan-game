import { CIVILIZATION_ENLIGHTENER_ABILITY_IDS } from '../civilization-enlightener/types.js';
import {KNOWLEDGE_MENTOR_ABILITY_IDS} from '../knowledge-mentor/types.js';
import {ARCANE_SCHOLAR_ABILITY_IDS} from '../arcane-scholar/types.js';
import {ALCHEMIST_ABILITY_IDS} from '../alchemist/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAVANT_ABILITY_IDS } from '../savant/types.js';
import { ARCHAEOLOGIST_ABILITY_IDS } from '../archaeologist/types.js';
import { validateAstronomerLife } from './life.js';
import { validateAstronomerEncounter } from './encounter.js';
import { ARTISAN_ABILITY_IDS } from '../artisan/types.js';
import { APPRAISER_ABILITY_IDS } from '../appraiser/types.js';
import {
  ASTRONOMER_ABILITIES, ASTRONOMER_BOTTLE_IDS, ASTRONOMER_CONSUMPTION_RISK, ASTRONOMER_FORMULA_STATUS,
  ASTRONOMER_GUIDE, ASTRONOMER_LABOUR_TASKS, ASTRONOMER_MIN_ARTISAN_WEEKS, ASTRONOMER_POTION_SOURCES, ASTRONOMER_PRICES, ASTRONOMER_SOURCE_STATUS,
} from './content.js';
import {
  ASTRONOMER_ABILITY_IDS, ASTRONOMER_CASE_IDS, type AstronomerAcquisitionCommand, type AstronomerAction,
  type AstronomerBottle, type AstronomerCommand, type AstronomerProjection, type AstronomerState,
} from './types.js';

export function createAstronomerState(): AstronomerState {
  return {
    guidanceKnown: false,
    bottles: ASTRONOMER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, artisanActingAtPromotion: null,
    cases: Object.fromEntries(ASTRONOMER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { instrumentOffset: 2, calibratedWeek: null, observedWeek: null, measurements: 0 },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'paragon' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))));
const isArtisan = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.savant.discovered && s.savant.guidanceKnown && s.archaeologist.guidanceKnown && s.appraiser.guidanceKnown && s.artisan.guidanceKnown && s.artisan.promotionWeek !== null && (isArtisan(s) || promoted(s));
const potionPrice = (bottle: AstronomerBottle) => ASTRONOMER_PRICES.potion - (bottle.labourSteps === 5 ? ASTRONOMER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: AstronomerBottle) => Number(bottle.id.slice('astronomer-potion-'.length));
const artisanWeeks = (s: SliceState) => Math.max(0, (s.astronomer.promotionWeek ?? s.week) - (s.artisan.promotionWeek ?? s.week));
const supplyExhausted = (state: AstronomerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${ASTRONOMER_GUIDE}的独立天文学家成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5天文学家魔药，原瓶astronomer-potion-${number}，非通识者、考古学家、鉴定师或工匠旧瓶改装。完整配方与晋升仪式资料待核。`;

function commandBlock(s: SliceState, command: AstronomerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.astronomer.cases).some(value => value.contactOpen)) return '先实际结束本次天文学家实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原工房，找到埃德温·沃德。';
  if (!knownChannel(s)) return '成为工匠并保有埃德温·沃德的指导渠道后，才能继续了解天文学家之路。';
  if (promoted(s)) return '你已完成天文学家晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.astronomer.guidanceKnown) return '已经听过天文学家成品魔药的用药说明。';
    return s.cash < ASTRONOMER_PRICES.guidance ? '天文学家用药指导需要440便士。' : null;
  }
  if (!s.astronomer.guidanceKnown) return '先听埃德温·沃德说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.astronomer.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.astronomer) ? null : '须先用完现有全部天文学家原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.astronomer.resupply.requestedWeek === null) return '尚未申请下一批天文学家补给。';
    if (s.week <= s.astronomer.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.astronomer) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.astronomer.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选天文学家原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `工匠魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.artisan.promotionWeek === null || artisanWeeks(s) < ASTRONOMER_MIN_ARTISAN_WEEKS) return `成为工匠后已度过${artisanWeeks(s)}/${ASTRONOMER_MIN_ARTISAN_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原工房劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyAstronomerCommand(s: SliceState, command: AstronomerAcquisitionCommand, c: SeerContext): void {
  rule(validateAstronomerCommand(command) && isAstronomerAcquisitionCommand(command), '天文学家准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= ASTRONOMER_PRICES.guidance;
      s.astronomer.guidanceKnown = true;
      c.note('听取天文学家用药说明', `花费1行动、440便士，你向已认识的本作原创成年${ASTRONOMER_GUIDE}继续请教，他向你说明从独立天文学家成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险。这些不是原来的通识者、考古学家、鉴定师或工匠存药。${ASTRONOMER_FORMULA_STATUS}工匠消化须达100，晋升工匠后满12整周才能服用；可提前筹备。${ASTRONOMER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.astronomer.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = ASTRONOMER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在埃德温·沃德的原工房实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4100便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4100便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.astronomer.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('天文学家原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原工房劳务抵扣4100便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；工匠消化100且晋升工匠后满12整周时，再独立确认服药。${ASTRONOMER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.astronomer.resupply.requestedWeek = s.week;
      c.note('申请下一批天文学家魔药', `现有天文学家原瓶全部耗尽且未晋升。你花费1行动，请${ASTRONOMER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原工房的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4700便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.astronomer.bottles.length + 1;
      s.astronomer.resupply.deliveries += 1;
      for (let offset = 0; offset < ASTRONOMER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.astronomer.bottles.push({ id: `astronomer-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.astronomer.resupply.requestedWeek = null;
      c.note('下一批天文学家原瓶到货', `第${s.week}周，埃德温·沃德的独立天文学家成品交接渠道本作G成品供给第${s.astronomer.resupply.deliveries + 1}批三瓶实际到货，原瓶astronomer-potion-${firstNumber}至astronomer-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4700便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.astronomer.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.astronomer.artisanActingAtPromotion = s.progression.acting;
        s.astronomer.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of ASTRONOMER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为天文学家', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。通识者、考古学家、鉴定师与工匠全部原能力及原ID掌握完整继承，只新增明确原创G“短时专注校准”，从0掌握开始；工匠消化成果与工匠晋升周保留，天文学家扮演从0开始。灵性上限提高到100，当前灵性没有补满。短时专注只使用自己的有限注意力，可能失败；具体原著星术仍未核实，不获得星象真相、星光束、天气控制或序列4炼金术士的灵魂与生命赋予。原观测台仪器仍属于组织并留在原屋顶，ART6-LAMP-1仍留在原客户处。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了天文学家晋升' : '天文学家魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是工匠，消化与全部原有掌握保留，没有获得天文学家能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectAstronomer(s: SliceState): AstronomerProjection {
  const actions: AstronomerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?s.alchemist.astronomerActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: AstronomerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.astronomer.guidanceKnown) add('learn-astronomer-guidance', '请埃德温·沃德说明天文学家成品与风险', '1行动 · 440便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.astronomer.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${ASTRONOMER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4100便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶天文学家魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.astronomer.resupply.requestedWeek !== null) add('receive-astronomer-supply', '确认下一批三瓶天文学家到货', `0行动 · 第${s.astronomer.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.astronomer)) add('request-astronomer-supply', '向埃德温·沃德订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.astronomer.guidanceKnown) {
    for (const bottle of s.astronomer.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶天文学家魔药`, `0行动 · 独立确认 · 工匠消化${isPromoted ? s.astronomer.artisanActingAtPromotion : s.progression.acting}/100 · 晋升后${artisanWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.astronomer.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.astronomer.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '天文学家 · 序列5' : '天文学家之路', discovered: available,
    guidanceKnown: available && s.astronomer.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: isPromoted ? { ...s.astronomer.practice } : null,
    cases: [], environment: '', insideCase: Object.values(s.astronomer.cases).some(value => value.contactOpen),
    ...(available ? { story: ASTRONOMER_SOURCE_STATUS } : {}),
    supplies: available ? `${ASTRONOMER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.astronomer.resupply.requestedWeek === null ? `已实际接收后续供给${s.astronomer.resupply.deliveries}批。` : `第${s.astronomer.resupply.requestedWeek}周提出请求，第${s.astronomer.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.astronomer.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 天文学家魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? ASTRONOMER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `工匠消化成果${s.astronomer.artisanActingAtPromotion}/100已保留；天文学家扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成工匠消化（${s.progression.acting}/100），并在晋升工匠后度过12整周（${artisanWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完工匠之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${ASTRONOMER_CONSUMPTION_RISK}` : '成为工匠后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isAstronomerAcquisitionCommand(command: unknown): command is AstronomerAcquisitionCommand {
  return validateAstronomerCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateAstronomerCommand(value: unknown): value is AstronomerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^astronomer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^astronomer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && ASTRONOMER_CASE_IDS.includes(value.caseId as typeof ASTRONOMER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && ASTRONOMER_CASE_IDS.includes(value.caseId as typeof ASTRONOMER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateAstronomerState(s: SliceState): boolean {
  const raw: unknown = s.astronomer;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'artisanActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.savant) || !record(s.archaeologist) || !record(s.appraiser) || !record(s.artisan)) return false;
  const firstArtisanWeek = s.artisan.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstArtisanWeek + ASTRONOMER_MIN_ARTISAN_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== ASTRONOMER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, ASTRONOMER_CASE_IDS) || !validateAstronomerLife(s)) return false;
  const astronomer = raw as unknown as AstronomerState, isPromoted = promoted(s);
  if (astronomer.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!astronomer.guidanceKnown || !integer(s.artisan.promotionWeek, 1, s.week) || !integer(astronomer.promotionWeek, firstConsumptionWeek, s.week) || astronomer.artisanActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?CIVILIZATION_ENLIGHTENER_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?KNOWLEDGE_MENTOR_ABILITY_IDS:[]),...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS, ...APPRAISER_ABILITY_IDS, ...ARTISAN_ABILITY_IDS, ...ASTRONOMER_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?ALCHEMIST_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?ARCANE_SCHOLAR_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (astronomer.promotionWeek !== null || astronomer.artisanActingAtPromotion !== null || ASTRONOMER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (astronomer.practice.instrumentOffset !== 2 || astronomer.practice.calibratedWeek !== null || astronomer.practice.observedWeek !== null || astronomer.practice.measurements !== 0) return false;
    if (astronomer.reflected || Object.values(astronomer.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of astronomer.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `astronomer-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of astronomer.bottles.entries()) {
    let stockWeek = firstArtisanWeek;
    if (index < ASTRONOMER_BOTTLE_IDS.length) {
      if (bottle.source !== ASTRONOMER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!astronomer.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / ASTRONOMER_BOTTLE_IDS.length) - 1;
      if (index % ASTRONOMER_BOTTLE_IDS.length === 0) {
        const previous = astronomer.bottles.slice(index - ASTRONOMER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > astronomer.promotionWeek!) return false;
    }
    if (!astronomer.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > astronomer.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > astronomer.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== astronomer.promotionWeek) return false;
    }
  }
  if (astronomer.resupply.requestedWeek !== null && (!astronomer.guidanceKnown || isPromoted || !supplyExhausted(astronomer) || astronomer.bottles.some(bottle => bottle.consumedWeek! > astronomer.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = astronomer.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, astronomer.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'ASTRONOMER_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(astronomer.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && Object.values(astronomer.cases).some(r => r.contactOpen || r.status === 'PREPARED')) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'astronomer-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateAstronomerEncounter(s);
}

export { ASTRONOMER_ABILITIES } from './content.js';
export type * from './types.js';
