import {KNOWLEDGE_MENTOR_ABILITY_IDS} from '../knowledge-mentor/types.js';
import {ARCANE_SCHOLAR_ABILITY_IDS} from '../arcane-scholar/types.js';
import {ALCHEMIST_ABILITY_IDS} from '../alchemist/types.js';
import {ASTRONOMER_ABILITY_IDS} from '../astronomer/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SAVANT_ABILITY_IDS } from '../savant/types.js';
import { ARCHAEOLOGIST_ABILITY_IDS } from '../archaeologist/types.js';
import { validateArtisanLife } from './life.js';
import { APPRAISER_ABILITY_IDS } from '../appraiser/types.js';
import {
  ARTISAN_ABILITIES, ARTISAN_BOTTLE_IDS, ARTISAN_CONSUMPTION_RISK, ARTISAN_FORMULA_STATUS,
  ARTISAN_GUIDE, ARTISAN_LABOUR_TASKS, ARTISAN_MIN_APPRAISER_WEEKS, ARTISAN_POTION_SOURCES, ARTISAN_PRICES, ARTISAN_SOURCE_STATUS,
} from './content.js';
import {
  ARTISAN_ABILITY_IDS, ARTISAN_CASE_IDS, type ArtisanAcquisitionCommand, type ArtisanAction,
  type ArtisanBottle, type ArtisanCommand, type ArtisanProjection, type ArtisanState,
} from './types.js';

export function createArtisanState(): ArtisanState {
  return {
    guidanceKnown: false,
    bottles: ARTISAN_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, appraiserActingAtPromotion: null,
    cases: Object.fromEntries(ARTISAN_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    workshop: { kitsBought: 0, kitStock: 3, restockAfterWeek: null, copperShells: 0, spiritualPortions: 0, craftFailures: 0, lamp: null, tests: 0, delivered: false },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'paragon' && (s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isAppraiser = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.savant.discovered && s.savant.guidanceKnown && s.archaeologist.guidanceKnown && s.appraiser.guidanceKnown && s.appraiser.promotionWeek !== null && (isAppraiser(s) || promoted(s));
const potionPrice = (bottle: ArtisanBottle) => ARTISAN_PRICES.potion - (bottle.labourSteps === 5 ? ARTISAN_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ArtisanBottle) => Number(bottle.id.slice('artisan-potion-'.length));
const appraiserWeeks = (s: SliceState) => Math.max(0, (s.artisan.promotionWeek ?? s.week) - (s.appraiser.promotionWeek ?? s.week));
const supplyExhausted = (state: ArtisanState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${ARTISAN_GUIDE}的独立工匠成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6工匠魔药，原瓶artisan-potion-${number}，非通识者、考古学家或鉴定师旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: ArtisanAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.artisan.cases).some(value => value.contactOpen)) return '先实际结束本次工匠实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原工房，找到工坊导师。';
  if (!knownChannel(s)) return '成为鉴定师并保有工坊导师的指导渠道后，才能继续了解工匠之路。';
  if (promoted(s)) return '你已完成工匠晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.artisan.guidanceKnown) return '已经听过工匠成品魔药的用药说明。';
    return s.cash < ARTISAN_PRICES.guidance ? '工匠用药指导需要360便士。' : null;
  }
  if (!s.artisan.guidanceKnown) return '先听工坊导师说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.artisan.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.artisan) ? null : '须先用完现有全部工匠原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.artisan.resupply.requestedWeek === null) return '尚未申请下一批工匠补给。';
    if (s.week <= s.artisan.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.artisan) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.artisan.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选工匠原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `鉴定师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.appraiser.promotionWeek === null || appraiserWeeks(s) < ARTISAN_MIN_APPRAISER_WEEKS) return `成为鉴定师后已度过${appraiserWeeks(s)}/${ARTISAN_MIN_APPRAISER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原工房劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyArtisanCommand(s: SliceState, command: ArtisanAcquisitionCommand, c: SeerContext): void {
  rule(validateArtisanCommand(command) && isArtisanAcquisitionCommand(command), '工匠准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= ARTISAN_PRICES.guidance;
      s.artisan.guidanceKnown = true;
      c.note('听取工匠用药说明', `花费1行动、360便士，你向已认识的本作原创成年${ARTISAN_GUIDE}继续请教，他向你说明从独立工匠成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的通识者、考古学家或鉴定师存药。${ARTISAN_FORMULA_STATUS}鉴定师消化须达100，晋升鉴定师后满12整周才能服用；可提前筹备。${ARTISAN_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.artisan.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = ARTISAN_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在工坊导师的原工房实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.artisan.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('工匠原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原工房劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；鉴定师消化100且晋升鉴定师后满12整周时，再独立确认服药。${ARTISAN_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.artisan.resupply.requestedWeek = s.week;
      c.note('申请下一批工匠魔药', `现有工匠原瓶全部耗尽且未晋升。你花费1行动，请${ARTISAN_GUIDE}从同一新渠道订下一批三瓶，并实际核验原工房的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.artisan.bottles.length + 1;
      s.artisan.resupply.deliveries += 1;
      for (let offset = 0; offset < ARTISAN_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.artisan.bottles.push({ id: `artisan-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.artisan.resupply.requestedWeek = null;
      c.note('下一批工匠原瓶到货', `第${s.week}周，工坊导师的独立工匠成品交接渠道本作G成品供给第${s.artisan.resupply.deliveries + 1}批三瓶实际到货，原瓶artisan-potion-${firstNumber}至artisan-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.artisan.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.artisan.appraiserActingAtPromotion = s.progression.acting;
        s.artisan.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of ARTISAN_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为工匠', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。通识者、考古学家与鉴定师全部原能力及原ID掌握完整继承，新增机械奇物制作、较弱非凡器物制作与有限仪式固化，三项均从0掌握开始；鉴定师消化成果与鉴定师晋升周保留，工匠扮演从0开始。灵性上限提高到80，当前灵性没有补满。制作需要已知图纸、实际材料与原工房工具，不复制任意高阶效果、不清污、不凭普通废铁赋能；没有获得序列5星术。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了工匠晋升' : '工匠魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是鉴定师，消化与全部原有掌握保留，没有获得工匠能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectArtisan(s: SliceState): ArtisanProjection {
  const actions: ArtisanAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.astronomer.artisanActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: ArtisanAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.artisan.guidanceKnown) add('learn-artisan-guidance', '请工坊导师说明工匠成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.artisan.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${ARTISAN_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶工匠魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.artisan.resupply.requestedWeek !== null) add('receive-artisan-supply', '确认下一批三瓶工匠到货', `0行动 · 第${s.artisan.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.artisan)) add('request-artisan-supply', '向工坊导师订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.artisan.guidanceKnown) {
    for (const bottle of s.artisan.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶工匠魔药`, `0行动 · 独立确认 · 鉴定师消化${isPromoted ? s.artisan.appraiserActingAtPromotion : s.progression.acting}/100 · 晋升后${appraiserWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.artisan.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.artisan.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '工匠 · 序列6' : '工匠之路', discovered: available,
    guidanceKnown: available && s.artisan.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    workshop: isPromoted ? { summary: `原工房微光灯片教学：已购买${s.artisan.workshop.kitsBought}套材料，制造失败${s.artisan.workshop.craftFailures}次。${s.artisan.workshop.kitStock === 0 ? `原三套现货已耗尽，第${s.artisan.workshop.restockAfterWeek! + 1}周起付费补进。` : `工房本批剩余${s.artisan.workshop.kitStock}套。`}`, materials: `持有原铜壳${s.artisan.workshop.copperShells}件、G低强教学灵性材料${s.artisan.workshop.spiritualPortions}份。每次制造均耗各1及4灵性，失败不退料。`, lamp: s.artisan.workshop.lamp ? `ART6-LAMP-1 · ${s.artisan.workshop.delivered ? '原件已交付成年委托人，不在玩家包中' : '唯一原件由玩家持有'} · ${s.artisan.workshop.tests ? '已实际照亮原刻度一次，精神−1' : '尚未实测'}` : null, remainingUses: s.artisan.workshop.lamp?.charges ?? 0, delivered: s.artisan.workshop.delivered } : { summary: '', materials: '', lamp: null, remainingUses: 0, delivered: false },
    cases: [], environment: '', insideCase: Object.values(s.artisan.cases).some(value => value.contactOpen),
    ...(available ? { story: ARTISAN_SOURCE_STATUS } : {}),
    supplies: available ? `${ARTISAN_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.artisan.resupply.requestedWeek === null ? `已实际接收后续供给${s.artisan.resupply.deliveries}批。` : `第${s.artisan.resupply.requestedWeek}周提出请求，第${s.artisan.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.artisan.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 工匠魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? ARTISAN_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?'工匠魔药已消化；原图纸、材料、唯一成品与真实客户交付记录保留。':isPromoted ? `鉴定师消化成果${s.artisan.appraiserActingAtPromotion}/100已保留；工匠扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成鉴定师消化（${s.progression.acting}/100），并在晋升鉴定师后度过12整周（${appraiserWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完鉴定师之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${ARTISAN_CONSUMPTION_RISK}` : '成为鉴定师后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isArtisanAcquisitionCommand(command: unknown): command is ArtisanAcquisitionCommand {
  return validateArtisanCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateArtisanCommand(value: unknown): value is ArtisanCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'BUY_KIT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^artisan-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^artisan-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && ARTISAN_CASE_IDS.includes(value.caseId as typeof ARTISAN_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && ARTISAN_CASE_IDS.includes(value.caseId as typeof ARTISAN_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateArtisanState(s: SliceState): boolean {
  const raw: unknown = s.artisan;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'appraiserActingAtPromotion', 'cases', 'workshop', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.savant) || !record(s.archaeologist) || !record(s.appraiser)) return false;
  const firstAppraiserWeek = s.appraiser.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstAppraiserWeek + ARTISAN_MIN_APPRAISER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== ARTISAN_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, ARTISAN_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'DIAGRAM_UNDERSTOOD', 'LAMP_FABRICATED', 'LAMP_VERIFIED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const artisan = raw as unknown as ArtisanState, isPromoted = promoted(s);
  if (artisan.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!artisan.guidanceKnown || !integer(s.appraiser.promotionWeek, 1, s.week) || !integer(artisan.promotionWeek, firstConsumptionWeek, s.week) || artisan.appraiserActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===2?KNOWLEDGE_MENTOR_ABILITY_IDS:[]),...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS, ...APPRAISER_ABILITY_IDS, ...ARTISAN_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?ASTRONOMER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?ALCHEMIST_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?ARCANE_SCHOLAR_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (artisan.promotionWeek !== null || artisan.appraiserActingAtPromotion !== null || ARTISAN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (artisan.reflected || Object.values(artisan.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of artisan.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `artisan-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of artisan.bottles.entries()) {
    let stockWeek = firstAppraiserWeek;
    if (index < ARTISAN_BOTTLE_IDS.length) {
      if (bottle.source !== ARTISAN_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!artisan.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / ARTISAN_BOTTLE_IDS.length) - 1;
      if (index % ARTISAN_BOTTLE_IDS.length === 0) {
        const previous = artisan.bottles.slice(index - ARTISAN_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > artisan.promotionWeek!) return false;
    }
    if (!artisan.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > artisan.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > artisan.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== artisan.promotionWeek) return false;
    }
  }
  if (artisan.resupply.requestedWeek !== null && (!artisan.guidanceKnown || isPromoted || !supplyExhausted(artisan) || artisan.bottles.some(bottle => bottle.consumedWeek! > artisan.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = artisan.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, artisan.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'ARTISAN_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(artisan.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && Object.values(artisan.cases).some(r => r.contactOpen)) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'artisan-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateArtisanLife(s);
}

export { ARTISAN_ABILITIES } from './content.js';
export type * from './types.js';
