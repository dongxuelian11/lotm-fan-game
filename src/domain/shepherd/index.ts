import { ELDER_ABILITY_IDS } from '../elder/types.js';
import {THREE_HEADED_TEMPLAR_ABILITY_IDS} from '../three-headed-templar/types.js';
import {BLACK_KNIGHT_ABILITY_IDS} from '../black-knight/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../secret-supplicant/types.js';
import { LISTENER_ABILITY_IDS } from '../listener/types.js';
import { SHADOW_ASCETIC_ABILITY_IDS } from '../shadow-ascetic/types.js';
import { ROSE_BISHOP_ABILITY_IDS } from '../rose-bishop/types.js';
import { projectRoseBishop, validateRoseBishopCommand } from '../rose-bishop/index.js';
import { shepherdInside, validateShepherdLife } from './life.js';
import { validateShepherdEncounter } from './encounter.js';
import {
  SHEPHERD_ABILITIES, SHEPHERD_BOTTLE_IDS, SHEPHERD_CONSUMPTION_RISK, SHEPHERD_FORMULA_STATUS,
  SHEPHERD_GUIDE, SHEPHERD_LABOUR_TASKS, SHEPHERD_MIN_ROSE_BISHOP_WEEKS, SHEPHERD_POTION_SOURCES, SHEPHERD_PRICES, SHEPHERD_SOURCE_STATUS, SHEPHERD_SPIRITS,
} from './content.js';
import {
  SHEPHERD_ABILITY_IDS, SHEPHERD_CASE_IDS, SHEPHERD_SPIRIT_IDS, SHEPHERD_MAX_SELECTED_ABILITIES, type ShepherdAcquisitionCommand, type ShepherdAction,
  type ShepherdBottle, type ShepherdCommand, type ShepherdPractice, type ShepherdProjection, type ShepherdState,
} from './types.js';

export function freshShepherdPractice(): ShepherdPractice {
  return { paper: 'TABLE', chorusOpen: false, note: 'BLANK', playerNode: 'DESK' };
}

export function createShepherdState(): ShepherdState {
  return {
    guidanceKnown: false,
    bottles: SHEPHERD_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, roseBishopActingAtPromotion: null,
    grazing: { met: false, activeSpiritId: null, spirits: SHEPHERD_SPIRIT_IDS.map(id => ({ id, status: 'UNMET', attemptWeek: null, acquiredWeek: null, releasedWeek: null, selectedAbilities: [] })) },
    cases: Object.fromEntries(SHEPHERD_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: freshShepherdPractice(),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, blurReady: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isRoseBishop = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.secretSupplicant.discovered && s.secretSupplicant.guidanceKnown && s.listener.guidanceKnown && s.shadowAscetic.guidanceKnown && s.roseBishop.guidanceKnown && s.roseBishop.promotionWeek !== null && (isRoseBishop(s) || promoted(s));
const potionPrice = (bottle: ShepherdBottle) => SHEPHERD_PRICES.potion - (bottle.labourSteps === 5 ? SHEPHERD_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ShepherdBottle) => Number(bottle.id.slice('shepherd-potion-'.length));
const roseBishopWeeks = (s: SliceState) => Math.max(0, (s.shepherd.promotionWeek ?? s.week) - (s.roseBishop.promotionWeek ?? s.week));
const inheritedContactOpen = (s: SliceState) => s.roseBishop.practice.shape !== 'NORMAL' || Object.values(s.roseBishop.cases).some(value => value.contactOpen);
const supplyExhausted = (state: ShepherdState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SHEPHERD_GUIDE}的独立牧羊人成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5牧羊人魔药，原瓶shepherd-potion-${number}，非秘祈人、倾听者、隐修士或蔷薇主教旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: ShepherdAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (shepherdInside(s) || inheritedContactOpen(s)) return '先实际结束当前训练实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原旧物间，找到伊森·洛弗。';
  if (!knownChannel(s)) return '成为蔷薇主教并保有伊森·洛弗的指导渠道后，才能继续了解牧羊人之路。';
  if (promoted(s)) return '你已完成牧羊人晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.shepherd.guidanceKnown) return '已经听过牧羊人成品魔药的用药说明。';
    return s.cash < SHEPHERD_PRICES.guidance ? '牧羊人用药指导需要460便士。' : null;
  }
  if (!s.shepherd.guidanceKnown) return '先听伊森·洛弗说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.shepherd.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.shepherd) ? null : '须先用完现有全部牧羊人原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.shepherd.resupply.requestedWeek === null) return '尚未申请下一批牧羊人补给。';
    if (s.week <= s.shepherd.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.shepherd) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.shepherd.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选牧羊人原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `蔷薇主教魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.roseBishop.promotionWeek === null || roseBishopWeeks(s) < SHEPHERD_MIN_ROSE_BISHOP_WEEKS) return `成为蔷薇主教后已度过${roseBishopWeeks(s)}/${SHEPHERD_MIN_ROSE_BISHOP_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原旧物间劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyShepherdCommand(s: SliceState, command: ShepherdAcquisitionCommand, c: SeerContext): void {
  rule(validateShepherdCommand(command) && isShepherdAcquisitionCommand(command), '牧羊人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SHEPHERD_PRICES.guidance;
      s.shepherd.guidanceKnown = true;
      c.note('听取牧羊人用药说明', `花费1行动、460便士，你向已认识的本作原创成年${SHEPHERD_GUIDE}继续请教，导师向你说明从独立牧羊人成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原旧物间安静场地与在场照护安排。这些不是原来的秘祈人、倾听者、隐修士或蔷薇主教存药。${SHEPHERD_FORMULA_STATUS}蔷薇主教消化须达100，晋升蔷薇主教后满12整周才能服用；可提前筹备。${SHEPHERD_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.shepherd.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = SHEPHERD_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊森·洛弗的原旧物间实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.shepherd.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('牧羊人原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原旧物间劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；蔷薇主教消化100且晋升蔷薇主教后满12整周时，再独立确认服药。${SHEPHERD_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.shepherd.resupply.requestedWeek = s.week;
      c.note('申请下一批牧羊人魔药', `现有牧羊人原瓶全部耗尽且未晋升。你花费1行动，请${SHEPHERD_GUIDE}从同一新渠道订下一批三瓶，并实际核验原旧物间的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.shepherd.bottles.length + 1;
      s.shepherd.resupply.deliveries += 1;
      for (let offset = 0; offset < SHEPHERD_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.shepherd.bottles.push({ id: `shepherd-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.shepherd.resupply.requestedWeek = null;
      c.note('下一批牧羊人原瓶到货', `第${s.week}周，伊森·洛弗的独立牧羊人成品交接渠道本作G成品供给第${s.shepherd.resupply.deliveries + 1}批三瓶实际到货，原瓶shepherd-potion-${firstNumber}至shepherd-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.shepherd.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次牧羊人服药准备', `原成年${SHEPHERD_GUIDE}在原旧物间实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.shepherd.roseBishopActingAtPromotion = s.progression.acting;
        s.shepherd.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of SHEPHERD_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为牧羊人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。秘祈人、倾听者、隐修士与蔷薇主教全部原能力及原ID掌握完整继承，仅新增hanged-man.s5.grazing与hanged-man.s5.borrowed-arts两项，从0掌握开始；蔷薇主教消化成果、原晋升周、原瓶、原份额、血肉储备、真实取用和已解决敌人记录均保持原样，牧羊人扮演从0开始。灵性上限提高到100，当前灵性没有补满。放牧容量7，但没有获得任何免费原灵或法术；须实际会面和逐灵选择至多3项原灵已经学会的方法，同一时刻只有1灵可启用，另可使用自身原能力。原灵留在体内，不产生额外身体；本人的灵性支付借用成本。未得到序列4黑骑士的灵肉之刃或统御阴影。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了牧羊人晋升' : '牧羊人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是蔷薇主教，消化与全部原有掌握保留，没有获得牧羊人能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectShepherd(s: SliceState): ShepherdProjection {
  const actions: ShepherdAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.blackKnight.shepherdActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: ShepherdAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.shepherd.guidanceKnown) add('learn-shepherd-guidance', '请伊森·洛弗说明牧羊人成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.shepherd.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${SHEPHERD_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶牧羊人魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.shepherd.resupply.requestedWeek !== null) add('receive-shepherd-supply', '确认下一批三瓶牧羊人到货', `0行动 · 第${s.shepherd.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.shepherd)) add('request-shepherd-supply', '向伊森·洛弗订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.shepherd.guidanceKnown) {
    for (const bottle of s.shepherd.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶牧羊人魔药`, `0行动 · 独立确认 · 蔷薇主教消化${isPromoted ? s.shepherd.roseBishopActingAtPromotion : s.progression.acting}/100 · 晋升后${roseBishopWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.shepherd.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.shepherd.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '牧羊人 · 序列5' : '牧羊人之路', discovered: available,
    guidanceKnown: available && s.shepherd.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: null, grazing: null,
    ...(isPromoted ? { reserve: projectRoseBishop(s).reserve } : {}),
    cases: [], environment: '', insideCase: (shepherdInside(s) || inheritedContactOpen(s)),
    ...(available ? { story: SHEPHERD_SOURCE_STATUS } : {}),
    supplies: available ? `${SHEPHERD_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.shepherd.resupply.requestedWeek === null ? `已实际接收后续供给${s.shepherd.resupply.deliveries}批。` : `第${s.shepherd.resupply.requestedWeek}周提出请求，第${s.shepherd.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.shepherd.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 牧羊人魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SHEPHERD_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, description: !s.shepherd.grazing.met && ability.id === 'hanged-man.s5.borrowed-arts' ? '每次实际施用仅能借当前1个已放牧原灵的已选能力，加上自己原有能力，灵性由本人支付。灵魂间可瞬时切换，切换本身0行动0灵性，本切片在回合边界选择，不复制永久掌握、不创造外部独立同伴。尚未会面原灵，不公开其具体已学方法或把空位当成现有能力。' : ability.description, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `蔷薇主教消化成果${s.shepherd.roseBishopActingAtPromotion}/100已保留；牧羊人扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成蔷薇主教消化（${s.progression.acting}/100），并在晋升蔷薇主教后度过12整周（${roseBishopWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完蔷薇主教之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${SHEPHERD_CONSUMPTION_RISK}` : '成为蔷薇主教后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isShepherdAcquisitionCommand(command: unknown): command is ShepherdAcquisitionCommand {
  return validateShepherdCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateShepherdCommand(value: unknown): value is ShepherdCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'MEET_SPIRITS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['BUY_RATION', 'TAKE_RATION'].includes(value.type as string)) return validateRoseBishopCommand(value);
  if (value.type === 'ACTIVATE_SPIRIT') return shape(value, ['type', 'spiritId']) && (value.spiritId === null || SHEPHERD_SPIRIT_IDS.includes(value.spiritId as typeof SHEPHERD_SPIRIT_IDS[number]));
  if (value.type === 'RELEASE_SPIRIT') return shape(value, ['type', 'spiritId', 'confirmed']) && value.confirmed === true && SHEPHERD_SPIRIT_IDS.includes(value.spiritId as typeof SHEPHERD_SPIRIT_IDS[number]);
  if (value.type === 'GRAZE') {
    if (!shape(value, ['type', 'spiritId', 'abilityIds']) || !Array.isArray(value.abilityIds) || value.abilityIds.length < 1 || value.abilityIds.length > SHEPHERD_MAX_SELECTED_ABILITIES || new Set(value.abilityIds).size !== value.abilityIds.length) return false;
    const source = SHEPHERD_SPIRITS.find(spirit => spirit.id === value.spiritId);
    return source !== undefined && value.abilityIds.every(id => typeof id === 'string' && source.knownAbilities.some(ability => ability.id === id));
  }
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^shepherd-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^shepherd-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SHEPHERD_CASE_IDS.includes(value.caseId as typeof SHEPHERD_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && SHEPHERD_CASE_IDS.includes(value.caseId as typeof SHEPHERD_CASE_IDS[number]) && (value.method === 'ORDINARY' || value.method === 'ABILITY' && value.caseId !== 'limited-account');
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateShepherdState(s: SliceState): boolean {
  const raw: unknown = s.shepherd;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'roseBishopActingAtPromotion', 'grazing', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.secretSupplicant) || !record(s.listener) || !record(s.shadowAscetic) || !record(s.roseBishop)) return false;
  const firstRoseBishopWeek = s.roseBishop.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstRoseBishopWeek + SHEPHERD_MIN_ROSE_BISHOP_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SHEPHERD_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.grazing) || !record(raw.cases) || !shape(raw.cases, SHEPHERD_CASE_IDS) || !record(raw.practice) || !record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'blurReady']) || typeof raw.encounter.blurReady !== 'boolean' || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateShepherdLife(s)) return false;
  const shepherd = raw as unknown as ShepherdState, isPromoted = promoted(s);
  if (shepherd.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!shepherd.guidanceKnown || !integer(s.roseBishop.promotionWeek, 1, s.week) || !integer(shepherd.promotionWeek, firstConsumptionWeek, s.week) || shepherd.roseBishopActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS, ...SHADOW_ASCETIC_ABILITY_IDS, ...ROSE_BISHOP_ABILITY_IDS, ...SHEPHERD_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?BLACK_KNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?THREE_HEADED_TEMPLAR_ABILITY_IDS:[]),...(s.progression.sequence===2?ELDER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (shepherd.promotionWeek !== null || shepherd.roseBishopActingAtPromotion !== null || SHEPHERD_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (Object.entries(freshShepherdPractice()).some(([key, value]) => shepherd.practice[key as keyof ShepherdPractice] !== value)) return false;
    if (shepherd.reflected || Object.values(shepherd.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of shepherd.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `shepherd-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of shepherd.bottles.entries()) {
    let stockWeek = firstRoseBishopWeek;
    if (index < SHEPHERD_BOTTLE_IDS.length) {
      if (bottle.source !== SHEPHERD_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!shepherd.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SHEPHERD_BOTTLE_IDS.length) - 1;
      if (index % SHEPHERD_BOTTLE_IDS.length === 0) {
        const previous = shepherd.bottles.slice(index - SHEPHERD_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > shepherd.promotionWeek!) return false;
    }
    if (!shepherd.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > shepherd.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > shepherd.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== shepherd.promotionWeek) return false;
    }
  }
  if (shepherd.resupply.requestedWeek !== null && (!shepherd.guidanceKnown || isPromoted || !supplyExhausted(shepherd) || shepherd.bottles.some(bottle => bottle.consumedWeek! > shepherd.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0) && validateShepherdEncounter(s);
}

export { SHEPHERD_ABILITIES } from './content.js';
export type * from './types.js';
