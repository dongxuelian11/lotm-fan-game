import { CIVILIZATION_ENLIGHTENER_ABILITY_IDS } from '../civilization-enlightener/types.js';
import {KNOWLEDGE_MENTOR_ABILITY_IDS} from '../knowledge-mentor/types.js';
import {ARCANE_SCHOLAR_ABILITY_IDS} from '../arcane-scholar/types.js';
import {ALCHEMIST_ABILITY_IDS} from '../alchemist/types.js';
import {ASTRONOMER_ABILITY_IDS} from '../astronomer/types.js';
import {ARTISAN_ABILITY_IDS} from '../artisan/types.js';
import {APPRAISER_ABILITY_IDS} from '../appraiser/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAVANT_ABILITY_IDS } from '../savant/types.js';
import {
  ARCHAEOLOGIST_ABILITIES, ARCHAEOLOGIST_BOTTLE_IDS, ARCHAEOLOGIST_CONSUMPTION_RISK, ARCHAEOLOGIST_FORMULA_STATUS,
  ARCHAEOLOGIST_GUIDE, ARCHAEOLOGIST_LABOUR_TASKS, ARCHAEOLOGIST_MIN_SAVANT_WEEKS, ARCHAEOLOGIST_POTION_SOURCES, ARCHAEOLOGIST_PRICES,
} from './content.js';
import {
  ARCHAEOLOGIST_ABILITY_IDS, ARCHAEOLOGIST_SITE_IDS, type ArchaeologistAcquisitionCommand, type ArchaeologistAction,
  type ArchaeologistBottle, type ArchaeologistCommand, type ArchaeologistProjection, type ArchaeologistState,
} from './types.js';

export function createArchaeologistState(): ArchaeologistState {
  return {
    guidanceKnown: false,
    bottles: ARCHAEOLOGIST_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, savantActingAtPromotion: null,
    sites: Object.fromEntries(ARCHAEOLOGIST_SITE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, approach: null }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'paragon' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))));
const isSavant = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.savant.discovered && s.savant.guidanceKnown && (isSavant(s) || promoted(s));
const potionPrice = (bottle: ArchaeologistBottle) => ARCHAEOLOGIST_PRICES.potion - (bottle.labourSteps === 3 ? ARCHAEOLOGIST_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ArchaeologistBottle) => Number(bottle.id.slice('archaeologist-potion-'.length));
const savantWeeks = (s: SliceState) => Math.max(0, (s.archaeologist.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const supplyExhausted = (state: ArchaeologistState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${ARCHAEOLOGIST_GUIDE}的新考察队交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列8考古学家魔药，原瓶archaeologist-potion-${number}，非通识者旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: ArchaeologistAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原工坊，找到埃德温。';
  if (!knownChannel(s)) return '成为通识者并保有埃德温的指导渠道后，才能继续考古学家之路。';
  if (promoted(s)) return '你已完成考古学家晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.archaeologist.guidanceKnown) return '已经听过考古学家成品魔药的用药说明。';
    return s.cash < ARCHAEOLOGIST_PRICES.guidance ? '考古学家用药指导需要180便士。' : null;
  }
  if (!s.archaeologist.guidanceKnown) return '先听埃德温说明这批序列8原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.archaeologist.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.archaeologist) ? null : '须先用完现有全部考古学家原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.archaeologist.resupply.requestedWeek === null) return '尚未申请下一批考古学家补给。';
    if (s.week <= s.archaeologist.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.archaeologist) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.archaeologist.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选考古学家原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `通识者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || savantWeeks(s) < ARCHAEOLOGIST_MIN_SAVANT_WEEKS) return `成为通识者后已度过${savantWeeks(s)}/${ARCHAEOLOGIST_MIN_SAVANT_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 3 ? '这瓶对应的三次工坊劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyArchaeologistCommand(s: SliceState, command: ArchaeologistAcquisitionCommand, c: SeerContext): void {
  rule(validateArchaeologistCommand(command) && !['SURVEY', 'EXPLORE', 'REFLECT'].includes(command.type), '考古学家准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= ARCHAEOLOGIST_PRICES.guidance;
      s.archaeologist.guidanceKnown = true;
      c.note('听取考古学家用药说明', `花费1行动、180便士，${ARCHAEOLOGIST_GUIDE}向你说明从新考察队交接渠道实际取得的三瓶序列8成品、逐瓶交付与四档风险。这些不是原来的通识者存药。${ARCHAEOLOGIST_FORMULA_STATUS}通识者消化须达100，首次晋升通识者后满6整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.archaeologist.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = ARCHAEOLOGIST_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在埃德温的原工坊实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/3，原瓶仍由导师保管。${bottle.labourSteps === 3 ? '三次劳务只抵这瓶1200便士，仍须实际支付170便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应三次劳务后才能抵这瓶1200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.archaeologist.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('考古学家原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列8成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 3 ? '对应三次工坊劳务抵扣1200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；通识者消化100且首次晋升后满6整周时，再独立确认服药。${ARCHAEOLOGIST_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.archaeologist.resupply.requestedWeek = s.week;
      c.note('申请下一批考古学家魔药', `现有考古学家原瓶全部耗尽且未晋升。你花费1行动，请${ARCHAEOLOGIST_GUIDE}从同一新渠道订下一批三瓶，并实际核验原工坊的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付1370便士，或分别完成三次劳务后支付170便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.archaeologist.bottles.length + 1;
      s.archaeologist.resupply.deliveries += 1;
      for (let offset = 0; offset < ARCHAEOLOGIST_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.archaeologist.bottles.push({ id: `archaeologist-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.archaeologist.resupply.requestedWeek = null;
      c.note('下一批考古学家原瓶到货', `第${s.week}周，埃德温的新考察队交接渠道本作G成品供给第${s.archaeologist.resupply.deliveries + 1}批三瓶实际到货，原瓶archaeologist-potion-${firstNumber}至archaeologist-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按1370便士购买，或完成对应三次劳务再付170便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.archaeologist.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.archaeologist.savantActingAtPromotion = s.progression.acting;
        s.archaeologist.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of ARCHAEOLOGIST_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 3], ['perception', 2], ['knowledge', 2]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为考古学家', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+3、感知+2、知识+2，意志不变。三项通识者能力及掌握完整继承，古代历史、野外考察与遗迹禁忌从0掌握开始；通识者消化成果和首次晋升周保留，考古学家扮演从0开始。灵性上限提高到45，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了考古学家晋升' : '考古学家魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是通识者，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectArchaeologist(s: SliceState): ArchaeologistProjection {
  const actions: ArchaeologistAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: ArchaeologistAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.archaeologist.guidanceKnown) add('learn-archaeologist-guidance', '请埃德温说明考古学家成品与风险', '1行动 · 180便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.archaeologist.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 3) add(`work-${bottle.id}`, `第${number}瓶 · ${ARCHAEOLOGIST_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/3，完成三次抵该瓶1200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶考古学家魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列8原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.archaeologist.resupply.requestedWeek !== null) add('receive-archaeologist-supply', '确认下一批三瓶考古学家到货', `0行动 · 第${s.archaeologist.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.archaeologist)) add('request-archaeologist-supply', '向埃德温订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.archaeologist.guidanceKnown) {
    for (const bottle of s.archaeologist.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶考古学家魔药`, `0行动 · 独立确认 · 通识者消化${isPromoted ? s.archaeologist.savantActingAtPromotion : s.progression.acting}/100 · 晋升后${savantWeeks(s)}/6整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.archaeologist.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.archaeologist.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '考古学家 · 序列8' : '考古学家之路', discovered: available,
    guidanceKnown: available && s.archaeologist.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    sites: [],
    supplies: available ? `${ARCHAEOLOGIST_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.archaeologist.resupply.requestedWeek === null ? `已实际接收后续供给${s.archaeologist.resupply.deliveries}批。` : `第${s.archaeologist.resupply.requestedWeek}周提出请求，第${s.archaeologist.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.archaeologist.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 考古学家魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/3`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? ARCHAEOLOGIST_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?s.appraiser.archaeologistActingAtPromotion??100:s.progression.acting) : 0,
    digestion:s.progression.pathwayId==='paragon'&&(s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?'考古学家魔药已消化，原实地考察记录保留。':isPromoted ? `通识者消化成果${s.archaeologist.savantActingAtPromotion}/100已保留；考古学家扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成通识者消化（${s.progression.acting}/100），并在首次晋升通识者后度过6整周（${savantWeeks(s)}/6）。用药指导与原瓶可以提前准备。` : '先走完通识者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应三次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${ARCHAEOLOGIST_CONSUMPTION_RISK}` : '成为通识者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateArchaeologistCommand(value: unknown): value is ArchaeologistCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^archaeologist-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^archaeologist-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'SURVEY') return shape(value, ['type', 'siteId']) && ARCHAEOLOGIST_SITE_IDS.includes(value.siteId as typeof ARCHAEOLOGIST_SITE_IDS[number]);
  if (value.type === 'EXPLORE') return shape(value, ['type', 'siteId', 'approach']) && ARCHAEOLOGIST_SITE_IDS.includes(value.siteId as typeof ARCHAEOLOGIST_SITE_IDS[number]) && ['COMPARE', 'CAREFUL'].includes(value.approach as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own site exploration history. */
export function validateArchaeologistState(s: SliceState): boolean {
  const raw: unknown = s.archaeologist;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'savantActingAtPromotion', 'sites', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.savant)) return false;
  const firstSavantWeek = s.progression.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstSavantWeek + ARCHAEOLOGIST_MIN_SAVANT_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== ARCHAEOLOGIST_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.sites) || !shape(raw.sites, ARCHAEOLOGIST_SITE_IDS)) return false;
  for (const value of Object.values(raw.sites)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'approach']) || !['AVAILABLE', 'SURVEYED', 'RESOLVED'].includes(value.status as string)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, 1, s.week) || value.approach !== null && !['COMPARE', 'CAREFUL'].includes(value.approach as string)) return false;
  }
  const archaeologist = raw as unknown as ArchaeologistState, isPromoted = promoted(s);
  if (archaeologist.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!archaeologist.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(archaeologist.promotionWeek, firstConsumptionWeek, s.week) || archaeologist.savantActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?CIVILIZATION_ENLIGHTENER_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?KNOWLEDGE_MENTOR_ABILITY_IDS:[]),...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?APPRAISER_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?ARTISAN_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?ASTRONOMER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?ALCHEMIST_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?ARCANE_SCHOLAR_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (archaeologist.promotionWeek !== null || archaeologist.savantActingAtPromotion !== null || ARCHAEOLOGIST_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (archaeologist.reflected || Object.values(archaeologist.sites).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.approach !== null)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of archaeologist.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `archaeologist-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 3)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of archaeologist.bottles.entries()) {
    let stockWeek = firstSavantWeek;
    if (index < ARCHAEOLOGIST_BOTTLE_IDS.length) {
      if (bottle.source !== ARCHAEOLOGIST_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!archaeologist.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / ARCHAEOLOGIST_BOTTLE_IDS.length) - 1;
      if (index % ARCHAEOLOGIST_BOTTLE_IDS.length === 0) {
        const previous = archaeologist.bottles.slice(index - ARCHAEOLOGIST_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > archaeologist.promotionWeek!) return false;
    }
    if (!archaeologist.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > archaeologist.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > archaeologist.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== archaeologist.promotionWeek) return false;
    }
  }
  if (archaeologist.resupply.requestedWeek !== null && (!archaeologist.guidanceKnown || isPromoted || !supplyExhausted(archaeologist) || archaeologist.bottles.some(bottle => bottle.consumedWeek! > archaeologist.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}
