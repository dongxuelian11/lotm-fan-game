import {DEATH_CONSUL_ABILITY_IDS} from '../death-consul/types.js';
import {FERRYMAN_ABILITY_IDS} from '../ferryman/types.js';
import {UNDYING_ABILITY_IDS} from '../undying/types.js';
import {GATEKEEPER_ABILITY_IDS} from '../gatekeeper/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../corpsecollector/types.js';
import { GRAVEDIGGER_ABILITY_IDS } from '../gravedigger/types.js';
import { validateSpiritGuideLife, spiritGuideInside } from './life.js';
import { SPIRITMEDIUM_ABILITY_IDS } from '../spiritmedium/types.js';
import {
  SPIRIT_GUIDE_ABILITIES, SPIRIT_GUIDE_BOTTLE_IDS, SPIRIT_GUIDE_CONSUMPTION_RISK, SPIRIT_GUIDE_FORMULA_STATUS,
  SPIRIT_GUIDE_GUIDE, SPIRIT_GUIDE_LABOUR_TASKS, SPIRIT_GUIDE_MIN_SPIRITMEDIUM_WEEKS, SPIRIT_GUIDE_POTION_SOURCES, SPIRIT_GUIDE_PRICES, SPIRIT_GUIDE_SOURCE_STATUS,
} from './content.js';
import {
  SPIRIT_GUIDE_ABILITY_IDS, SPIRIT_GUIDE_CASE_IDS, type SpiritGuideAcquisitionCommand, type SpiritGuideAction,
  type SpiritGuideBottle, type SpiritGuideCommand, type SpiritGuideProjection, type SpiritGuideState,
} from './types.js';

export function createSpiritGuideState(): SpiritGuideState {
  return {
    guidanceKnown: false,
    bottles: SPIRIT_GUIDE_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, spiritmediumActingAtPromotion: null,
    cases: Object.fromEntries(SPIRIT_GUIDE_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    reflected: false,
    messenger: { recruited: false, deliveries: 0, letter: 'DESK', replyReceived: false, feePaid: 0 },
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'death' && (s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isSpiritmedium = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.corpsecollector.discovered && s.corpsecollector.guidanceKnown && s.gravedigger.guidanceKnown && s.spiritmedium.guidanceKnown && s.spiritmedium.promotionWeek !== null && (isSpiritmedium(s) || promoted(s));
const potionPrice = (bottle: SpiritGuideBottle) => SPIRIT_GUIDE_PRICES.potion - (bottle.labourSteps === 5 ? SPIRIT_GUIDE_PRICES.labourCredit : 0);
const bottleNumber = (bottle: SpiritGuideBottle) => Number(bottle.id.slice('spirit-guide-potion-'.length));
const spiritmediumWeeks = (s: SliceState) => Math.max(0, (s.spiritGuide.promotionWeek ?? s.week) - (s.spiritmedium.promotionWeek ?? s.week));
const supplyExhausted = (state: SpiritGuideState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SPIRIT_GUIDE_GUIDE}的独立死灵导师成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6死灵导师魔药，原瓶spirit-guide-potion-${number}，非收尸人、掘墓人或通灵者旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: SpiritGuideAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (spiritGuideInside(s)) return '先实际结束本次死灵导师实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原纪念工作室，找到伊芙琳·沃斯。';
  if (!knownChannel(s)) return '成为通灵者并保有伊芙琳·沃斯的指导渠道后，才能继续了解死灵导师之路。';
  if (promoted(s)) return '你已完成死灵导师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.spiritGuide.guidanceKnown) return '已经听过死灵导师成品魔药的用药说明。';
    return s.cash < SPIRIT_GUIDE_PRICES.guidance ? '死灵导师用药指导需要360便士。' : null;
  }
  if (!s.spiritGuide.guidanceKnown) return '先听伊芙琳·沃斯说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.spiritGuide.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.spiritGuide) ? null : '须先用完现有全部死灵导师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.spiritGuide.resupply.requestedWeek === null) return '尚未申请下一批死灵导师补给。';
    if (s.week <= s.spiritGuide.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.spiritGuide) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.spiritGuide.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选死灵导师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `通灵者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.spiritmedium.promotionWeek === null || spiritmediumWeeks(s) < SPIRIT_GUIDE_MIN_SPIRITMEDIUM_WEEKS) return `成为通灵者后已度过${spiritmediumWeeks(s)}/${SPIRIT_GUIDE_MIN_SPIRITMEDIUM_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原纪念工作室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applySpiritGuideCommand(s: SliceState, command: SpiritGuideAcquisitionCommand, c: SeerContext): void {
  rule(validateSpiritGuideCommand(command) && isSpiritGuideAcquisitionCommand(command), '死灵导师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SPIRIT_GUIDE_PRICES.guidance;
      s.spiritGuide.guidanceKnown = true;
      c.note('听取死灵导师用药说明', `花费1行动、360便士，你向已认识的本作原创成年${SPIRIT_GUIDE_GUIDE}继续请教，导师向你说明从独立死灵导师成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的收尸人、掘墓人或通灵者存药。${SPIRIT_GUIDE_FORMULA_STATUS}通灵者消化须达100，晋升通灵者后满12整周才能服用；可提前筹备。${SPIRIT_GUIDE_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.spiritGuide.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = SPIRIT_GUIDE_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊芙琳·沃斯的原纪念工作室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.spiritGuide.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('死灵导师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原纪念工作室劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；通灵者消化100且晋升通灵者后满12整周时，再独立确认服药。${SPIRIT_GUIDE_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.spiritGuide.resupply.requestedWeek = s.week;
      c.note('申请下一批死灵导师魔药', `现有死灵导师原瓶全部耗尽且未晋升。你花费1行动，请${SPIRIT_GUIDE_GUIDE}从同一新渠道订下一批三瓶，并实际核验原纪念工作室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.spiritGuide.bottles.length + 1;
      s.spiritGuide.resupply.deliveries += 1;
      for (let offset = 0; offset < SPIRIT_GUIDE_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.spiritGuide.bottles.push({ id: `spirit-guide-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.spiritGuide.resupply.requestedWeek = null;
      c.note('下一批死灵导师原瓶到货', `第${s.week}周，伊芙琳·沃斯的独立死灵导师成品交接渠道本作G成品供给第${s.spiritGuide.resupply.deliveries + 1}批三瓶实际到货，原瓶spirit-guide-potion-${firstNumber}至spirit-guide-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.spiritGuide.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.spiritGuide.spiritmediumActingAtPromotion = s.progression.acting;
        s.spiritGuide.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of SPIRIT_GUIDE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为死灵导师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。收尸人、掘墓人与通灵者全部原能力及原ID掌握完整继承，新增有限灵界沟通与招募、亡者之语，两项均从0掌握开始；通灵者消化成果与通灵者晋升周保留，死灵导师扮演从0开始。灵性上限提高到80，当前灵性没有补满。灵界沟通不是所有灵无条件服从，灰羽尚未招募，不产生免费信使或战斗随从；亡者之语直接针对灵体但可被抵抗。不获得序列5冥界之门或体内亡灵监狱。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了死灵导师晋升' : '死灵导师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是通灵者，消化与全部原有掌握保留，没有获得死灵导师能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectSpiritGuide(s: SliceState): SpiritGuideProjection {
  const actions: SpiritGuideAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.gatekeeper.spiritGuideActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: SpiritGuideAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.spiritGuide.guidanceKnown) add('learn-spirit-guide-guidance', '请伊芙琳·沃斯说明死灵导师成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.spiritGuide.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${SPIRIT_GUIDE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶死灵导师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.spiritGuide.resupply.requestedWeek !== null) add('receive-spirit-guide-supply', '确认下一批三瓶死灵导师到货', `0行动 · 第${s.spiritGuide.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.spiritGuide)) add('request-spirit-guide-supply', '向伊芙琳·沃斯订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.spiritGuide.guidanceKnown) {
    for (const bottle of s.spiritGuide.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶死灵导师魔药`, `0行动 · 独立确认 · 通灵者消化${isPromoted ? s.spiritGuide.spiritmediumActingAtPromotion : s.progression.acting}/100 · 晋升后${spiritmediumWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.spiritGuide.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.spiritGuide.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '死灵导师 · 序列6' : '死灵导师之路', discovered: available,
    guidanceKnown: available && s.spiritGuide.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: spiritGuideInside(s),
    messenger: { ...s.spiritGuide.messenger },
    ...(available ? { story: SPIRIT_GUIDE_SOURCE_STATUS } : {}),
    supplies: available ? `${SPIRIT_GUIDE_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.spiritGuide.resupply.requestedWeek === null ? `已实际接收后续供给${s.spiritGuide.resupply.deliveries}批。` : `第${s.spiritGuide.resupply.requestedWeek}周提出请求，第${s.spiritGuide.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.spiritGuide.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 死灵导师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SPIRIT_GUIDE_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?'死灵导师魔药已消化；原灰羽单次递信约定、原信位置与实际实践保留。':isPromoted ? `通灵者消化成果${s.spiritGuide.spiritmediumActingAtPromotion}/100已保留；死灵导师扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成通灵者消化（${s.progression.acting}/100），并在晋升通灵者后度过12整周（${spiritmediumWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完通灵者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${SPIRIT_GUIDE_CONSUMPTION_RISK}` : '成为通灵者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isSpiritGuideAcquisitionCommand(command: unknown): command is SpiritGuideAcquisitionCommand {
  return validateSpiritGuideCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateSpiritGuideCommand(value: unknown): value is SpiritGuideCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^spirit-guide-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^spirit-guide-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SPIRIT_GUIDE_CASE_IDS.includes(value.caseId as typeof SPIRIT_GUIDE_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && SPIRIT_GUIDE_CASE_IDS.includes(value.caseId as typeof SPIRIT_GUIDE_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateSpiritGuideState(s: SliceState): boolean {
  const raw: unknown = s.spiritGuide;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'spiritmediumActingAtPromotion', 'cases', 'reflected', 'messenger', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.corpsecollector) || !record(s.gravedigger) || !record(s.spiritmedium) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory)) return false;
  const firstSpiritmediumWeek = s.spiritmedium.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstSpiritmediumWeek + SPIRIT_GUIDE_MIN_SPIRITMEDIUM_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SPIRIT_GUIDE_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, SPIRIT_GUIDE_CASE_IDS)) return false;
  if (!record(raw.messenger) || !shape(raw.messenger, ['recruited', 'deliveries', 'letter', 'replyReceived', 'feePaid'])) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'MESSENGER_RECRUITED', 'TERMS_REVIEWED', 'MESSENGER_DELIVERED', 'HAND_DELIVERED', 'ECHO_QUIETED', 'BARRIER_RECORDED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const spiritGuide = raw as unknown as SpiritGuideState, isPromoted = promoted(s);
  if (spiritGuide.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!spiritGuide.guidanceKnown || !integer(s.spiritmedium.promotionWeek, 1, s.week) || !integer(spiritGuide.promotionWeek, firstConsumptionWeek, s.week) || spiritGuide.spiritmediumActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS, ...SPIRIT_GUIDE_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?GATEKEEPER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?UNDYING_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?FERRYMAN_ABILITY_IDS:[]),...(s.progression.sequence===2?DEATH_CONSUL_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (spiritGuide.promotionWeek !== null || spiritGuide.spiritmediumActingAtPromotion !== null || SPIRIT_GUIDE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (spiritGuide.reflected || Object.values(spiritGuide.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of spiritGuide.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `spirit-guide-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of spiritGuide.bottles.entries()) {
    let stockWeek = firstSpiritmediumWeek;
    if (index < SPIRIT_GUIDE_BOTTLE_IDS.length) {
      if (bottle.source !== SPIRIT_GUIDE_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!spiritGuide.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SPIRIT_GUIDE_BOTTLE_IDS.length) - 1;
      if (index % SPIRIT_GUIDE_BOTTLE_IDS.length === 0) {
        const previous = spiritGuide.bottles.slice(index - SPIRIT_GUIDE_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > spiritGuide.promotionWeek!) return false;
    }
    if (!spiritGuide.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > spiritGuide.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > spiritGuide.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== spiritGuide.promotionWeek) return false;
    }
  }
  if (spiritGuide.resupply.requestedWeek !== null && (!spiritGuide.guidanceKnown || isPromoted || !supplyExhausted(spiritGuide) || spiritGuide.bottles.some(bottle => bottle.consumedWeek! > spiritGuide.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = spiritGuide.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, spiritGuide.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'SPIRIT_GUIDE_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(spiritGuide.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || Object.values(spiritGuide.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'spirit-guide-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateSpiritGuideLife(s);
}

export { SPIRIT_GUIDE_ABILITIES } from './content.js';
export type * from './types.js';
