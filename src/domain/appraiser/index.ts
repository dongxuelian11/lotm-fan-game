import { CIVILIZATION_ENLIGHTENER_ABILITY_IDS } from '../civilization-enlightener/types.js';
import {KNOWLEDGE_MENTOR_ABILITY_IDS} from '../knowledge-mentor/types.js';
import {ARCANE_SCHOLAR_ABILITY_IDS} from '../arcane-scholar/types.js';
import {ALCHEMIST_ABILITY_IDS} from '../alchemist/types.js';
import {ASTRONOMER_ABILITY_IDS} from '../astronomer/types.js';
import {ARTISAN_ABILITY_IDS} from '../artisan/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAVANT_ABILITY_IDS } from '../savant/types.js';
import { ARCHAEOLOGIST_ABILITY_IDS } from '../archaeologist/types.js';
import {
  APPRAISER_ABILITIES, APPRAISER_BOTTLE_IDS, APPRAISER_CONSUMPTION_RISK, APPRAISER_FORMULA_STATUS,
  APPRAISER_GUIDE, APPRAISER_LABOUR_TASKS, APPRAISER_MIN_ARCHAEOLOGIST_WEEKS, APPRAISER_POTION_SOURCES, APPRAISER_PRICES,
} from './content.js';
import {
  APPRAISER_ABILITY_IDS, APPRAISER_ITEM_IDS, type AppraiserAcquisitionCommand, type AppraiserAction,
  type AppraiserBottle, type AppraiserCommand, type AppraiserProjection, type AppraiserState,
} from './types.js';

export function createAppraiserState(): AppraiserState {
  return {
    guidanceKnown: false,
    bottles: APPRAISER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, archaeologistActingAtPromotion: null,
    cases: {
      'echo-brooch': { status: 'AVAILABLE', attemptWeek: null, identifiedWeek: null, method: null, uses: 0 },
      'warm-lamp': { status: 'AVAILABLE', attemptWeek: null, identifiedWeek: null, method: null, uses: 0 },
      'needle-box': { status: 'AVAILABLE', attemptWeek: null, identifiedWeek: null, method: null, uses: 0 },
    },
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'paragon' && (s.progression.sequence === 7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))));
const isArchaeologist = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.savant.discovered && s.savant.guidanceKnown && s.archaeologist.guidanceKnown && s.archaeologist.promotionWeek !== null && (isArchaeologist(s) || promoted(s));
const potionPrice = (bottle: AppraiserBottle) => APPRAISER_PRICES.potion - (bottle.labourSteps === 4 ? APPRAISER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: AppraiserBottle) => Number(bottle.id.slice('appraiser-potion-'.length));
const archaeologistWeeks = (s: SliceState) => Math.max(0, (s.appraiser.promotionWeek ?? s.week) - (s.archaeologist.promotionWeek ?? s.week));
const supplyExhausted = (state: AppraiserState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${APPRAISER_GUIDE}的新器物保管所交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列7鉴定师魔药，原瓶appraiser-potion-${number}，非通识者或考古学家旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: AppraiserAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的工坊，找到工坊导师。';
  if (!knownChannel(s)) return '成为考古学家并保有工坊导师的指导渠道后，才能继续鉴定师之路。';
  if (promoted(s)) return '你已完成鉴定师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.appraiser.guidanceKnown) return '已经听过鉴定师成品魔药的用药说明。';
    return s.cash < APPRAISER_PRICES.guidance ? '鉴定师用药指导需要240便士。' : null;
  }
  if (!s.appraiser.guidanceKnown) return '先听工坊导师说明这批序列7原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.appraiser.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.appraiser) ? null : '须先用完现有全部鉴定师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.appraiser.resupply.requestedWeek === null) return '尚未申请下一批鉴定师补给。';
    if (s.week <= s.appraiser.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.appraiser) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.appraiser.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选鉴定师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `考古学家魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.archaeologist.promotionWeek === null || archaeologistWeeks(s) < APPRAISER_MIN_ARCHAEOLOGIST_WEEKS) return `成为考古学家后已度过${archaeologistWeeks(s)}/${APPRAISER_MIN_ARCHAEOLOGIST_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 4 ? '这瓶对应的四次工坊劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyAppraiserCommand(s: SliceState, command: AppraiserAcquisitionCommand, c: SeerContext): void {
  rule(isAppraiserAcquisitionCommand(command), '鉴定师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= APPRAISER_PRICES.guidance;
      s.appraiser.guidanceKnown = true;
      c.note('听取鉴定师用药说明', `花费1行动、240便士，${APPRAISER_GUIDE}向你说明从新器物保管所交接渠道实际取得的三瓶序列7成品、逐瓶交付与四档风险。这些不是原来的考古学家存药。${APPRAISER_FORMULA_STATUS}考古学家消化须达100，晋升考古学家后满8整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.appraiser.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = APPRAISER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在导师的工坊实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/4，原瓶仍由导师保管。${bottle.labourSteps === 4 ? '四次劳务只抵这瓶1800便士，仍须实际支付210便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应四次劳务后才能抵这瓶1800便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.appraiser.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('鉴定师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列7成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 4 ? '对应四次工坊劳务抵扣1800便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；考古学家消化100且晋升考古学家后满8整周时，再独立确认服药。${APPRAISER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.appraiser.resupply.requestedWeek = s.week;
      c.note('申请下一批鉴定师魔药', `现有鉴定师原瓶全部耗尽且未晋升。你花费1行动，请${APPRAISER_GUIDE}从同一新渠道订下一批三瓶，并实际核验工坊的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付2010便士，或分别完成四次劳务后支付210便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.appraiser.bottles.length + 1;
      s.appraiser.resupply.deliveries += 1;
      for (let offset = 0; offset < APPRAISER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.appraiser.bottles.push({ id: `appraiser-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.appraiser.resupply.requestedWeek = null;
      c.note('下一批鉴定师原瓶到货', `第${s.week}周，工坊导师的新器物保管所交接渠道本作G成品供给第${s.appraiser.resupply.deliveries + 1}批三瓶实际到货，原瓶appraiser-potion-${firstNumber}至appraiser-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按2010便士购买，或完成对应四次劳务再付210便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.appraiser.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.appraiser.archaeologistActingAtPromotion = s.progression.acting;
        s.appraiser.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of APPRAISER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 3], ['will', 1], ['knowledge', 3]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为鉴定师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+3、意志+1、知识+3。三项通识者与三项考古学家能力及掌握完整继承，器物鉴定、隐患辨识与谨慎使用三项本作G掌握拆分从0开始；考古学家消化成果和既有晋升周保留，鉴定师扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了鉴定师晋升' : '鉴定师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是考古学家，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectAppraiser(s: SliceState): AppraiserProjection {
  const actions: AppraiserAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: AppraiserAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.appraiser.guidanceKnown) add('learn-appraiser-guidance', '请工坊导师说明鉴定师成品与风险', '1行动 · 240便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.appraiser.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 4) add(`work-${bottle.id}`, `第${number}瓶 · ${APPRAISER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/4，完成四次抵该瓶1800便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶鉴定师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列7原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.appraiser.resupply.requestedWeek !== null) add('receive-appraiser-supply', '确认下一批三瓶鉴定师到货', `0行动 · 第${s.appraiser.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.appraiser)) add('request-appraiser-supply', '向工坊导师订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.appraiser.guidanceKnown) {
    for (const bottle of s.appraiser.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶鉴定师魔药`, `0行动 · 独立确认 · 考古学家消化${isPromoted ? s.appraiser.archaeologistActingAtPromotion : s.progression.acting}/100 · 晋升后${archaeologistWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.appraiser.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.appraiser.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '鉴定师 · 序列7' : '鉴定师之路', discovered: available,
    guidanceKnown: available && s.appraiser.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    items: [], environment: '',
    supplies: available ? `${APPRAISER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.appraiser.resupply.requestedWeek === null ? `已实际接收后续供给${s.appraiser.resupply.deliveries}批。` : `第${s.appraiser.resupply.requestedWeek}周提出请求，第${s.appraiser.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.appraiser.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 鉴定师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/4`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? APPRAISER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?s.artisan.appraiserActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?'鉴定师魔药已消化，原鉴别与原瓶记录保留。':isPromoted ? `考古学家消化成果${s.appraiser.archaeologistActingAtPromotion}/100已保留；鉴定师扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成考古学家消化（${s.progression.acting}/100），并在晋升考古学家后度过8整周（${archaeologistWeeks(s)}/8）。用药指导与原瓶可以提前准备。` : '先走完考古学家之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应四次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${APPRAISER_CONSUMPTION_RISK}` : '成为考古学家后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Commands are checked at the shared boundary and again before acquisition mutates state. */
export function validateAppraiserCommand(value: unknown): value is AppraiserCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^appraiser-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^appraiser-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['EXAMINE', 'IDENTIFY', 'TEST', 'REPORT'].includes(value.type as string)) return shape(value, ['type', 'itemId']) && typeof value.itemId === 'string' && APPRAISER_ITEM_IDS.some(id => id === value.itemId);
  return false;
}

export function isAppraiserAcquisitionCommand(value: unknown): value is AppraiserAcquisitionCommand {
  return validateAppraiserCommand(value) && ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type);
}

/** Bottle conservation and promotion chronology live here; activity content/history is validated separately. */
export function validateAppraiserState(s: SliceState): boolean {
  const raw: unknown = s.appraiser;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'archaeologistActingAtPromotion', 'cases', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.savant) || !record(s.archaeologist)) return false;
  const firstArchaeologistWeek = s.archaeologist.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstArchaeologistWeek + APPRAISER_MIN_ARCHAEOLOGIST_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== APPRAISER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, APPRAISER_ITEM_IDS)) return false;
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'identifiedWeek', 'method', 'uses'])) return false;
    if (!['AVAILABLE', 'EXAMINED', 'IDENTIFIED', 'RESOLVED'].includes(value.status as string) || !integer(value.uses, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstConsumptionWeek, s.week) || value.identifiedWeek !== null && !integer(value.identifiedWeek, firstConsumptionWeek, s.week)) return false;
    if (value.method !== null && !['TEST', 'REPORT'].includes(value.method as string)) return false;
  }
  const state = raw as unknown as AppraiserState, isPromoted = promoted(s);
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!state.guidanceKnown || !integer(s.archaeologist.promotionWeek, 11, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.archaeologistActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?CIVILIZATION_ENLIGHTENER_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?KNOWLEDGE_MENTOR_ABILITY_IDS:[]),...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS, ...APPRAISER_ABILITY_IDS,...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?ARTISAN_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?ASTRONOMER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?ALCHEMIST_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?ARCANE_SCHOLAR_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
    if (Object.values(state.cases).some(value => value.identifiedWeek !== null && value.identifiedWeek < state.promotionWeek! || value.attemptWeek !== null && value.attemptWeek < state.promotionWeek!)) return false;
  } else {
    if (state.promotionWeek !== null || state.archaeologistActingAtPromotion !== null || APPRAISER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (state.reflected || APPRAISER_ITEM_IDS.some(id => {
      const value = state.cases[id];
      return value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.identifiedWeek !== null || value.method !== null || value.uses !== 0;
    })) return false;
  }

  // Validate record shapes before consulting previous stock batches.
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `appraiser-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 4)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of state.bottles.entries()) {
    let stockWeek = firstArchaeologistWeek;
    if (index < APPRAISER_BOTTLE_IDS.length) {
      if (bottle.source !== APPRAISER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!state.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / APPRAISER_BOTTLE_IDS.length) - 1;
      if (index % APPRAISER_BOTTLE_IDS.length === 0) {
        const previous = state.bottles.slice(index - APPRAISER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > state.promotionWeek!) return false;
    }
    if (!state.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > state.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > state.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== state.promotionWeek) return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || isPromoted || !supplyExhausted(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}
