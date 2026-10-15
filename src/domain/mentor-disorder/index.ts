import { ENTROPY_DUKE_ABILITY_IDS } from '../entropy-duke/types.js';
import {FRENZY_MAGE_ABILITY_IDS} from '../frenzy-mage/types.js';
import {FALLEN_EARL_ABILITY_IDS} from '../fallen-earl/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { LAWYER_ABILITY_IDS } from '../lawyer/types.js';
import { BARBARIAN_ABILITY_IDS } from '../barbarian/types.js';
import { BRIBER_ABILITY_IDS } from '../briber/types.js';
import { CORRUPTION_BARON_ABILITY_IDS } from '../corruption-baron/types.js';
import { mentorDisorderInside, validateMentorDisorderLife } from './life.js';
import { corruptionBaronInside } from '../corruption-baron/life.js';
import { validateMentorDisorderEncounter } from './encounter.js';
import {
  MENTOR_DISORDER_ABILITIES, MENTOR_DISORDER_BOTTLE_IDS, MENTOR_DISORDER_CONSUMPTION_RISK, MENTOR_DISORDER_FORMULA_STATUS,
  MENTOR_DISORDER_GUIDE, MENTOR_DISORDER_LABOUR_TASKS, MENTOR_DISORDER_MIN_CORRUPTION_BARON_WEEKS, MENTOR_DISORDER_POTION_SOURCES, MENTOR_DISORDER_PRICES, MENTOR_DISORDER_SOURCE_STATUS,
} from './content.js';
import {
  MENTOR_DISORDER_ABILITY_IDS, MENTOR_DISORDER_CASE_IDS, type MentorDisorderAcquisitionCommand, type MentorDisorderAction,
  type MentorDisorderBottle, type MentorDisorderCommand, type MentorDisorderPractice, type MentorDisorderProjection, type MentorDisorderState,
} from './types.js';

export function freshMentorDisorderPractice(): MentorDisorderPractice {
  return { markers: 'SORTED', route: 'READY', note: 'BLANK' };
}

export function createMentorDisorderState(): MentorDisorderState {
  return {
    guidanceKnown: false,
    bottles: MENTOR_DISORDER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, corruptionBaronActingAtPromotion: null,
    cases: Object.fromEntries(MENTOR_DISORDER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: freshMentorDisorderPractice(),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && (s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isCorruptionBaron = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.lawyer.discovered && s.lawyer.guidanceKnown && s.barbarian.formulaKnown && s.briber.formulaKnown && s.corruptionBaron.guidanceKnown && s.corruptionBaron.promotionWeek !== null && (isCorruptionBaron(s) || promoted(s));
const potionPrice = (bottle: MentorDisorderBottle) => MENTOR_DISORDER_PRICES.potion - (bottle.labourSteps === 5 ? MENTOR_DISORDER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: MentorDisorderBottle) => Number(bottle.id.slice('mentor-disorder-potion-'.length));
const corruptionBaronWeeks = (s: SliceState) => Math.max(0, (s.mentorDisorder.promotionWeek ?? s.week) - (s.corruptionBaron.promotionWeek ?? s.week));
const inheritedContactOpen = (s: SliceState) => corruptionBaronInside(s) || ['PENDING', 'ADJUSTED'].includes(s.corruptionBaron.practice.clauseOrder) || ['ROLLING', 'SIDE_POCKET'].includes(s.corruptionBaron.practice.marker) || ['MOVING', 'DIVERTED'].includes(s.corruptionBaron.practice.route) || [s.lawyer, s.barbarian, s.briber].some(previous => Object.values(previous.cases).some(value => value.contactOpen));
const supplyExhausted = (state: MentorDisorderState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${MENTOR_DISORDER_GUIDE}的独立混乱导师成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5混乱导师魔药，原瓶mentor-disorder-potion-${number}，非律师、野蛮人、贿赂者或腐化男爵旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: MentorDisorderAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (mentorDisorderInside(s) || inheritedContactOpen(s)) return '先实际结束当前训练实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原契约铺，找到米蕾·沃德。';
  if (!knownChannel(s)) return '成为腐化男爵并保有米蕾·沃德的指导渠道后，才能继续了解混乱导师之路。';
  if (promoted(s)) return '你已完成混乱导师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.mentorDisorder.guidanceKnown) return '已经听过混乱导师成品魔药的用药说明。';
    return s.cash < MENTOR_DISORDER_PRICES.guidance ? '混乱导师用药指导需要460便士。' : null;
  }
  if (!s.mentorDisorder.guidanceKnown) return '先听米蕾·沃德说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.mentorDisorder.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.mentorDisorder) ? null : '须先用完现有全部混乱导师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.mentorDisorder.resupply.requestedWeek === null) return '尚未申请下一批混乱导师补给。';
    if (s.week <= s.mentorDisorder.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.mentorDisorder) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.mentorDisorder.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选混乱导师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `腐化男爵魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.corruptionBaron.promotionWeek === null || corruptionBaronWeeks(s) < MENTOR_DISORDER_MIN_CORRUPTION_BARON_WEEKS) return `成为腐化男爵后已度过${corruptionBaronWeeks(s)}/${MENTOR_DISORDER_MIN_CORRUPTION_BARON_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原契约铺劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyMentorDisorderCommand(s: SliceState, command: MentorDisorderAcquisitionCommand, c: SeerContext): void {
  rule(validateMentorDisorderCommand(command) && isMentorDisorderAcquisitionCommand(command), '混乱导师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= MENTOR_DISORDER_PRICES.guidance;
      s.mentorDisorder.guidanceKnown = true;
      c.note('听取混乱导师用药说明', `花费1行动、460便士，你向已认识的本作原创成年${MENTOR_DISORDER_GUIDE}继续请教，导师向你说明从独立混乱导师成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原契约铺安静场地与在场照护安排。这些不是原来的律师、野蛮人、贿赂者或腐化男爵存药。${MENTOR_DISORDER_FORMULA_STATUS}腐化男爵消化须达100，晋升腐化男爵后满12整周才能服用；可提前筹备。${MENTOR_DISORDER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.mentorDisorder.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = MENTOR_DISORDER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在米蕾·沃德的原契约铺实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.mentorDisorder.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('混乱导师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原契约铺劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；腐化男爵消化100且晋升腐化男爵后满12整周时，再独立确认服药。${MENTOR_DISORDER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.mentorDisorder.resupply.requestedWeek = s.week;
      c.note('申请下一批混乱导师魔药', `现有混乱导师原瓶全部耗尽且未晋升。你花费1行动，请${MENTOR_DISORDER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原契约铺的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.mentorDisorder.bottles.length + 1;
      s.mentorDisorder.resupply.deliveries += 1;
      for (let offset = 0; offset < MENTOR_DISORDER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.mentorDisorder.bottles.push({ id: `mentor-disorder-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.mentorDisorder.resupply.requestedWeek = null;
      c.note('下一批混乱导师原瓶到货', `第${s.week}周，米蕾·沃德的独立混乱导师成品交接渠道本作G成品供给第${s.mentorDisorder.resupply.deliveries + 1}批三瓶实际到货，原瓶mentor-disorder-potion-${firstNumber}至mentor-disorder-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.mentorDisorder.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次混乱导师服药准备', `原成年${MENTOR_DISORDER_GUIDE}在原契约铺实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.mentorDisorder.corruptionBaronActingAtPromotion = s.progression.acting;
        s.mentorDisorder.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of MENTOR_DISORDER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为混乱导师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。律师、野蛮人、贿赂者与腐化男爵全部原能力及原ID掌握完整继承，仅新增black-emperor.s5.disorder一项，从0掌握开始；腐化男爵消化成果、原晋升周、原瓶、已完成实践、原物去向和已解决敌人记录均保持原样，混乱导师扮演从0开始。灵性上限提高到100，当前灵性没有补满。有限混乱只作用于已有动作或实际轨迹，必须有当前真实条件、费用与判定，不瞬移、不永久控制人格，不免疫所有精神影响。不获得序列4赋予、放大、利用或建筑尺度变化，也不把特定手套三分钟后的自身混乱当作通用序列代价。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了混乱导师晋升' : '混乱导师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是腐化男爵，消化与全部原有掌握保留，没有获得混乱导师能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectMentorDisorder(s: SliceState): MentorDisorderProjection {
  const actions: MentorDisorderAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.fallenEarl.mentorDisorderActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: MentorDisorderAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.mentorDisorder.guidanceKnown) add('learn-mentor-disorder-guidance', '请米蕾·沃德说明混乱导师成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.mentorDisorder.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${MENTOR_DISORDER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶混乱导师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.mentorDisorder.resupply.requestedWeek !== null) add('receive-mentor-disorder-supply', '确认下一批三瓶混乱导师到货', `0行动 · 第${s.mentorDisorder.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.mentorDisorder)) add('request-mentor-disorder-supply', '向米蕾·沃德订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.mentorDisorder.guidanceKnown) {
    for (const bottle of s.mentorDisorder.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶混乱导师魔药`, `0行动 · 独立确认 · 腐化男爵消化${isPromoted ? s.mentorDisorder.corruptionBaronActingAtPromotion : s.progression.acting}/100 · 晋升后${corruptionBaronWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.mentorDisorder.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.mentorDisorder.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '混乱导师 · 序列5' : '混乱导师之路', discovered: available,
    guidanceKnown: available && s.mentorDisorder.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: { ...s.mentorDisorder.practice },
    gifts: { held: available ? s.briber.gifts.filter(g => g.location === 'PLAYER').length : 0, given: available ? s.briber.gifts.filter(g => g.location === 'GIVEN').length : 0, summary: available ? '沿用贿赂者时期的同一原木筹库存；实际给出后不自动归还，目标未自愿接下也不因此否定贿赂。' : '' },
    cases: [], environment: '', insideCase: (mentorDisorderInside(s) || inheritedContactOpen(s)),
    ...(available ? { story: MENTOR_DISORDER_SOURCE_STATUS } : {}),
    supplies: available ? `${MENTOR_DISORDER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.mentorDisorder.resupply.requestedWeek === null ? `已实际接收后续供给${s.mentorDisorder.resupply.deliveries}批。` : `第${s.mentorDisorder.resupply.requestedWeek}周提出请求，第${s.mentorDisorder.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.mentorDisorder.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 混乱导师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? MENTOR_DISORDER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `腐化男爵消化成果${s.mentorDisorder.corruptionBaronActingAtPromotion}/100已保留；混乱导师扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成腐化男爵消化（${s.progression.acting}/100），并在晋升腐化男爵后度过12整周（${corruptionBaronWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完腐化男爵之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${MENTOR_DISORDER_CONSUMPTION_RISK}` : '成为腐化男爵后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isMentorDisorderAcquisitionCommand(command: unknown): command is MentorDisorderAcquisitionCommand {
  return validateMentorDisorderCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateMentorDisorderCommand(value: unknown): value is MentorDisorderCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'BUY_GIFTS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^mentor-disorder-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^mentor-disorder-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && MENTOR_DISORDER_CASE_IDS.includes(value.caseId as typeof MENTOR_DISORDER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && MENTOR_DISORDER_CASE_IDS.includes(value.caseId as typeof MENTOR_DISORDER_CASE_IDS[number]) && (value.method === 'ORDINARY' || value.method === 'ABILITY' && value.caseId !== 'honest-account');
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateMentorDisorderState(s: SliceState): boolean {
  const raw: unknown = s.mentorDisorder;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'corruptionBaronActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.lawyer) || !record(s.barbarian) || !record(s.briber) || !record(s.corruptionBaron)) return false;
  const firstCorruptionBaronWeek = s.corruptionBaron.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstCorruptionBaronWeek + MENTOR_DISORDER_MIN_CORRUPTION_BARON_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== MENTOR_DISORDER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, MENTOR_DISORDER_CASE_IDS) || !record(raw.practice) || !record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateMentorDisorderLife(s)) return false;
  const mentorDisorder = raw as unknown as MentorDisorderState, isPromoted = promoted(s);
  if (mentorDisorder.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!mentorDisorder.guidanceKnown || !integer(s.corruptionBaron.promotionWeek, 1, s.week) || !integer(mentorDisorder.promotionWeek, firstConsumptionWeek, s.week) || mentorDisorder.corruptionBaronActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS, ...BRIBER_ABILITY_IDS, ...CORRUPTION_BARON_ABILITY_IDS, ...MENTOR_DISORDER_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?FALLEN_EARL_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?FRENZY_MAGE_ABILITY_IDS:[]),...(s.progression.sequence===2?ENTROPY_DUKE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (mentorDisorder.promotionWeek !== null || mentorDisorder.corruptionBaronActingAtPromotion !== null || MENTOR_DISORDER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (Object.entries(freshMentorDisorderPractice()).some(([key, value]) => mentorDisorder.practice[key as keyof MentorDisorderPractice] !== value)) return false;
    if (mentorDisorder.reflected || Object.values(mentorDisorder.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of mentorDisorder.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `mentor-disorder-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of mentorDisorder.bottles.entries()) {
    let stockWeek = firstCorruptionBaronWeek;
    if (index < MENTOR_DISORDER_BOTTLE_IDS.length) {
      if (bottle.source !== MENTOR_DISORDER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!mentorDisorder.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / MENTOR_DISORDER_BOTTLE_IDS.length) - 1;
      if (index % MENTOR_DISORDER_BOTTLE_IDS.length === 0) {
        const previous = mentorDisorder.bottles.slice(index - MENTOR_DISORDER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > mentorDisorder.promotionWeek!) return false;
    }
    if (!mentorDisorder.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > mentorDisorder.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > mentorDisorder.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== mentorDisorder.promotionWeek) return false;
    }
  }
  if (mentorDisorder.resupply.requestedWeek !== null && (!mentorDisorder.guidanceKnown || isPromoted || !supplyExhausted(mentorDisorder) || mentorDisorder.bottles.some(bottle => bottle.consumedWeek! > mentorDisorder.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0) && validateMentorDisorderEncounter(s);
}

export { MENTOR_DISORDER_ABILITIES } from './content.js';
export type * from './types.js';
