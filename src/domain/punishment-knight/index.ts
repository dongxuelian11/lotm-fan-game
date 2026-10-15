import {CHAOS_HUNTER_ABILITY_IDS} from '../chaos-hunter/types.js';
import {IMPERATIVE_MAGE_ABILITY_IDS} from '../imperative-mage/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ARBITER_ABILITY_IDS } from '../arbiter/types.js';
import { SHERIFF_ABILITY_IDS } from '../sheriff/types.js';
import { INTERROGATOR_ABILITY_IDS } from '../interrogator/types.js';
import { JUDGE_ABILITY_IDS } from '../judge/types.js';
import { punishmentKnightInside, validatePunishmentKnightLife } from './life.js';
import { hasJudgeOpenPractice } from '../judge/encounter.js';
import { validatePunishmentKnightEncounter } from './encounter.js';
import {
  PUNISHMENT_KNIGHT_ABILITIES, PUNISHMENT_KNIGHT_BOTTLE_IDS, PUNISHMENT_KNIGHT_CONSUMPTION_RISK, PUNISHMENT_KNIGHT_FORMULA_STATUS,
  PUNISHMENT_KNIGHT_GUIDE, PUNISHMENT_KNIGHT_LABOUR_TASKS, PUNISHMENT_KNIGHT_MIN_JUDGE_WEEKS, PUNISHMENT_KNIGHT_POTION_SOURCES, PUNISHMENT_KNIGHT_PRICES, PUNISHMENT_KNIGHT_SOURCE_STATUS,
} from './content.js';
import {
  PUNISHMENT_KNIGHT_ABILITY_IDS, PUNISHMENT_KNIGHT_CASE_IDS, type PunishmentKnightAcquisitionCommand, type PunishmentKnightAction,
  type PunishmentKnightBottle, type PunishmentKnightCommand, type PunishmentKnightPractice, type PunishmentKnightProjection, type PunishmentKnightState,
} from './types.js';

export function freshPunishmentKnightPractice(): PunishmentKnightPractice {
  return { pad: 'STAND', partner: 'FREE', rule: 'NONE', note: 'BLANK' };
}

export function createPunishmentKnightState(): PunishmentKnightState {
  return {
    guidanceKnown: false,
    bottles: PUNISHMENT_KNIGHT_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, judgeActingAtPromotion: null,
    cases: Object.fromEntries(PUNISHMENT_KNIGHT_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: freshPunishmentKnightPractice(),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'justiciar' && (s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3));
const isJudge = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.arbiter.discovered && s.arbiter.guidanceKnown && s.sheriff.guidanceKnown && s.interrogator.guidanceKnown && s.judge.guidanceKnown && s.judge.promotionWeek !== null && (isJudge(s) || promoted(s));
const potionPrice = (bottle: PunishmentKnightBottle) => PUNISHMENT_KNIGHT_PRICES.potion - (bottle.labourSteps === 5 ? PUNISHMENT_KNIGHT_PRICES.labourCredit : 0);
const bottleNumber = (bottle: PunishmentKnightBottle) => Number(bottle.id.slice('punishment-knight-potion-'.length));
const judgeWeeks = (s: SliceState) => Math.max(0, (s.punishmentKnight.promotionWeek ?? s.week) - (s.judge.promotionWeek ?? s.week));
const inheritedContactOpen = (s: SliceState) => hasJudgeOpenPractice(s) || [s.arbiter, s.sheriff, s.interrogator, s.judge].some(previous => Object.values(previous.cases).some(value => value.contactOpen));
const supplyExhausted = (state: PunishmentKnightState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${PUNISHMENT_KNIGHT_GUIDE}的独立惩戒骑士成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5惩戒骑士魔药，原瓶punishment-knight-potion-${number}，非仲裁人、治安官、审讯者或法官旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: PunishmentKnightAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (punishmentKnightInside(s) || inheritedContactOpen(s)) return '先实际结束当前训练实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原调解处，找到薇娜·贝尔。';
  if (!knownChannel(s)) return '成为法官并保有薇娜·贝尔的指导渠道后，才能继续了解惩戒骑士之路。';
  if (promoted(s)) return '你已完成惩戒骑士晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.punishmentKnight.guidanceKnown) return '已经听过惩戒骑士成品魔药的用药说明。';
    return s.cash < PUNISHMENT_KNIGHT_PRICES.guidance ? '惩戒骑士用药指导需要460便士。' : null;
  }
  if (!s.punishmentKnight.guidanceKnown) return '先听薇娜·贝尔说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.punishmentKnight.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.punishmentKnight) ? null : '须先用完现有全部惩戒骑士原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.punishmentKnight.resupply.requestedWeek === null) return '尚未申请下一批惩戒骑士补给。';
    if (s.week <= s.punishmentKnight.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.punishmentKnight) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.punishmentKnight.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选惩戒骑士原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `法官魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.judge.promotionWeek === null || judgeWeeks(s) < PUNISHMENT_KNIGHT_MIN_JUDGE_WEEKS) return `成为法官后已度过${judgeWeeks(s)}/${PUNISHMENT_KNIGHT_MIN_JUDGE_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原调解处劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyPunishmentKnightCommand(s: SliceState, command: PunishmentKnightAcquisitionCommand, c: SeerContext): void {
  rule(validatePunishmentKnightCommand(command) && isPunishmentKnightAcquisitionCommand(command), '惩戒骑士准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= PUNISHMENT_KNIGHT_PRICES.guidance;
      s.punishmentKnight.guidanceKnown = true;
      c.note('听取惩戒骑士用药说明', `花费1行动、460便士，你向已认识的本作原创成年${PUNISHMENT_KNIGHT_GUIDE}继续请教，导师向你说明从独立惩戒骑士成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原调解处安静场地与在场照护安排。这些不是原来的仲裁人、治安官、审讯者或法官存药。${PUNISHMENT_KNIGHT_FORMULA_STATUS}法官消化须达100，晋升法官后满12整周才能服用；可提前筹备。${PUNISHMENT_KNIGHT_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.punishmentKnight.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = PUNISHMENT_KNIGHT_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在薇娜·贝尔的原调解处实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.punishmentKnight.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('惩戒骑士原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原调解处劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；法官消化100且晋升法官后满12整周时，再独立确认服药。${PUNISHMENT_KNIGHT_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.punishmentKnight.resupply.requestedWeek = s.week;
      c.note('申请下一批惩戒骑士魔药', `现有惩戒骑士原瓶全部耗尽且未晋升。你花费1行动，请${PUNISHMENT_KNIGHT_GUIDE}从同一新渠道订下一批三瓶，并实际核验原调解处的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.punishmentKnight.bottles.length + 1;
      s.punishmentKnight.resupply.deliveries += 1;
      for (let offset = 0; offset < PUNISHMENT_KNIGHT_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.punishmentKnight.bottles.push({ id: `punishment-knight-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.punishmentKnight.resupply.requestedWeek = null;
      c.note('下一批惩戒骑士原瓶到货', `第${s.week}周，薇娜·贝尔的独立惩戒骑士成品交接渠道本作G成品供给第${s.punishmentKnight.resupply.deliveries + 1}批三瓶实际到货，原瓶punishment-knight-potion-${firstNumber}至punishment-knight-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.punishmentKnight.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次惩戒骑士服药准备', `原成年${PUNISHMENT_KNIGHT_GUIDE}在原调解处实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.punishmentKnight.judgeActingAtPromotion = s.progression.acting;
        s.punishmentKnight.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of PUNISHMENT_KNIGHT_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为惩戒骑士', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。仲裁人、治安官、审讯者与法官全部原能力及原ID掌握完整继承，只新增惩戒强化、有限囚禁与既有伤口裁决三项，从0掌握开始；法官消化成果、原晋升周、原瓶、已完成实践、原物去向和已解决敌人记录均保持原样，惩戒骑士扮演从0开始。灵性上限提高到100，当前灵性没有补满。惩戒须有当前实际违反宣告的动作，有限囚禁可失败或挣脱，伤口裁决须针对当前敌人实际已有的伤口，不是一句话必杀。练习只用原软垫与本人自愿的短暂停步，不制造伤势；没有获得官方身份或组织归属。序列4律令法师的能力剥夺与高阶律令尚未取得。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了惩戒骑士晋升' : '惩戒骑士魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是法官，消化与全部原有掌握保留，没有获得惩戒骑士能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectPunishmentKnight(s: SliceState): PunishmentKnightProjection {
  const actions: PunishmentKnightAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||s.progression.sequence===3)?s.imperativeMage.punishmentKnightActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: PunishmentKnightAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.punishmentKnight.guidanceKnown) add('learn-punishment-knight-guidance', '请薇娜·贝尔说明惩戒骑士成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.punishmentKnight.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${PUNISHMENT_KNIGHT_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶惩戒骑士魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.punishmentKnight.resupply.requestedWeek !== null) add('receive-punishment-knight-supply', '确认下一批三瓶惩戒骑士到货', `0行动 · 第${s.punishmentKnight.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.punishmentKnight)) add('request-punishment-knight-supply', '向薇娜·贝尔订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.punishmentKnight.guidanceKnown) {
    for (const bottle of s.punishmentKnight.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶惩戒骑士魔药`, `0行动 · 独立确认 · 法官消化${isPromoted ? s.punishmentKnight.judgeActingAtPromotion : s.progression.acting}/100 · 晋升后${judgeWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.punishmentKnight.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.punishmentKnight.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '惩戒骑士 · 序列5' : '惩戒骑士之路', discovered: available,
    guidanceKnown: available && s.punishmentKnight.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: { ...s.punishmentKnight.practice },
    cases: [], environment: '', insideCase: (punishmentKnightInside(s) || inheritedContactOpen(s)),
    ...(available ? { story: PUNISHMENT_KNIGHT_SOURCE_STATUS } : {}),
    supplies: available ? `${PUNISHMENT_KNIGHT_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.punishmentKnight.resupply.requestedWeek === null ? `已实际接收后续供给${s.punishmentKnight.resupply.deliveries}批。` : `第${s.punishmentKnight.resupply.requestedWeek}周提出请求，第${s.punishmentKnight.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.punishmentKnight.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 惩戒骑士魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? PUNISHMENT_KNIGHT_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `法官消化成果${s.punishmentKnight.judgeActingAtPromotion}/100已保留；惩戒骑士扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成法官消化（${s.progression.acting}/100），并在晋升法官后度过12整周（${judgeWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完法官之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${PUNISHMENT_KNIGHT_CONSUMPTION_RISK}` : '成为法官后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isPunishmentKnightAcquisitionCommand(command: unknown): command is PunishmentKnightAcquisitionCommand {
  return validatePunishmentKnightCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validatePunishmentKnightCommand(value: unknown): value is PunishmentKnightCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^punishment-knight-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^punishment-knight-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && PUNISHMENT_KNIGHT_CASE_IDS.includes(value.caseId as typeof PUNISHMENT_KNIGHT_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && PUNISHMENT_KNIGHT_CASE_IDS.includes(value.caseId as typeof PUNISHMENT_KNIGHT_CASE_IDS[number]) && (value.method === 'ORDINARY' || value.method === 'ABILITY' && value.caseId !== 'wound-record');
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validatePunishmentKnightState(s: SliceState): boolean {
  const raw: unknown = s.punishmentKnight;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'judgeActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.arbiter) || !record(s.sheriff) || !record(s.interrogator) || !record(s.judge)) return false;
  const firstJudgeWeek = s.judge.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstJudgeWeek + PUNISHMENT_KNIGHT_MIN_JUDGE_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== PUNISHMENT_KNIGHT_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, PUNISHMENT_KNIGHT_CASE_IDS) || !record(raw.practice) || !record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validatePunishmentKnightLife(s)) return false;
  const punishmentKnight = raw as unknown as PunishmentKnightState, isPromoted = promoted(s);
  if (punishmentKnight.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!punishmentKnight.guidanceKnown || !integer(s.judge.promotionWeek, 1, s.week) || !integer(punishmentKnight.promotionWeek, firstConsumptionWeek, s.week) || punishmentKnight.judgeActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS, ...INTERROGATOR_ABILITY_IDS, ...JUDGE_ABILITY_IDS, ...PUNISHMENT_KNIGHT_ABILITY_IDS,...((s.progression.sequence===4||s.progression.sequence===3)?IMPERATIVE_MAGE_ABILITY_IDS:[]),...(s.progression.sequence===3?CHAOS_HUNTER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (punishmentKnight.promotionWeek !== null || punishmentKnight.judgeActingAtPromotion !== null || PUNISHMENT_KNIGHT_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (Object.entries(freshPunishmentKnightPractice()).some(([key, value]) => punishmentKnight.practice[key as keyof PunishmentKnightPractice] !== value)) return false;
    if (punishmentKnight.reflected || Object.values(punishmentKnight.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of punishmentKnight.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `punishment-knight-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of punishmentKnight.bottles.entries()) {
    let stockWeek = firstJudgeWeek;
    if (index < PUNISHMENT_KNIGHT_BOTTLE_IDS.length) {
      if (bottle.source !== PUNISHMENT_KNIGHT_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!punishmentKnight.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / PUNISHMENT_KNIGHT_BOTTLE_IDS.length) - 1;
      if (index % PUNISHMENT_KNIGHT_BOTTLE_IDS.length === 0) {
        const previous = punishmentKnight.bottles.slice(index - PUNISHMENT_KNIGHT_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > punishmentKnight.promotionWeek!) return false;
    }
    if (!punishmentKnight.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > punishmentKnight.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > punishmentKnight.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== punishmentKnight.promotionWeek) return false;
    }
  }
  if (punishmentKnight.resupply.requestedWeek !== null && (!punishmentKnight.guidanceKnown || isPromoted || !supplyExhausted(punishmentKnight) || punishmentKnight.bottles.some(bottle => bottle.consumedWeek! > punishmentKnight.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0) && validatePunishmentKnightEncounter(s);
}

export { PUNISHMENT_KNIGHT_ABILITIES } from './content.js';
export type * from './types.js';
