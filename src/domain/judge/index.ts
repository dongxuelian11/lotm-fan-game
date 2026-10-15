import {CHAOS_HUNTER_ABILITY_IDS} from '../chaos-hunter/types.js';
import {IMPERATIVE_MAGE_ABILITY_IDS} from '../imperative-mage/types.js';
import {PUNISHMENT_KNIGHT_ABILITY_IDS} from '../punishment-knight/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ARBITER_ABILITY_IDS } from '../arbiter/types.js';
import { SHERIFF_ABILITY_IDS } from '../sheriff/types.js';
import { validateJudgeLife } from './life.js';
import { INTERROGATOR_ABILITY_IDS } from '../interrogator/types.js';
import {
  JUDGE_ABILITIES, JUDGE_BOTTLE_IDS, JUDGE_CONSUMPTION_RISK, JUDGE_FORMULA_STATUS,
  JUDGE_GUIDE, JUDGE_LABOUR_TASKS, JUDGE_MIN_INTERROGATOR_WEEKS, JUDGE_POTION_SOURCES, JUDGE_PRICES, JUDGE_SOURCE_STATUS,
} from './content.js';
import {
  JUDGE_ABILITY_IDS, JUDGE_CASE_IDS, type JudgeAcquisitionCommand, type JudgeAction,
  type JudgeBottle, type JudgeCommand, type JudgeProjection, type JudgeState,
} from './types.js';

export function createJudgeState(): JudgeState {
  return {
    guidanceKnown: false,
    bottles: JUDGE_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, interrogatorActingAtPromotion: null,
    cases: Object.fromEntries(JUDGE_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { audience: 'READY', boundary: 'CLEAR', token: 'ON_TABLE', lineTestedBy: 'NONE', tokenTestedBy: 'NONE' },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'justiciar' && (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)));
const isInterrogator = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.arbiter.discovered && s.arbiter.guidanceKnown && s.sheriff.guidanceKnown && s.interrogator.guidanceKnown && s.interrogator.promotionWeek !== null && (isInterrogator(s) || promoted(s));
const potionPrice = (bottle: JudgeBottle) => JUDGE_PRICES.potion - (bottle.labourSteps === 5 ? JUDGE_PRICES.labourCredit : 0);
const bottleNumber = (bottle: JudgeBottle) => Number(bottle.id.slice('judge-potion-'.length));
const interrogatorWeeks = (s: SliceState) => Math.max(0, (s.judge.promotionWeek ?? s.week) - (s.interrogator.promotionWeek ?? s.week));
const supplyExhausted = (state: JudgeState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${JUDGE_GUIDE}的独立法官成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6法官魔药，原瓶judge-potion-${number}，非仲裁人、治安官或审讯者旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: JudgeAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.judge.cases).some(value => value.contactOpen)) return '先实际结束本次法官实践的接触，再继续。';
  if (Object.values(s.interrogator.cases).some(value => value.contactOpen) || Object.values(s.sheriff.cases).some(value => value.contactOpen) || Object.values(s.arbiter.cases).some(value => value.contactOpen)) return '先实际结束原序列尚未收束的接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原调解处，找到薇娜·贝尔。';
  if (!knownChannel(s)) return '成为审讯者并保有薇娜·贝尔的指导渠道后，才能继续了解法官之路。';
  if (promoted(s)) return '你已完成法官晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.judge.guidanceKnown) return '已经听过法官成品魔药的用药说明。';
    return s.cash < JUDGE_PRICES.guidance ? '法官用药指导需要360便士。' : null;
  }
  if (!s.judge.guidanceKnown) return '先听薇娜·贝尔说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.judge.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.judge) ? null : '须先用完现有全部法官原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.judge.resupply.requestedWeek === null) return '尚未申请下一批法官补给。';
    if (s.week <= s.judge.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.judge) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.judge.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选法官原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `审讯者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.interrogator.promotionWeek === null || interrogatorWeeks(s) < JUDGE_MIN_INTERROGATOR_WEEKS) return `成为审讯者后已度过${interrogatorWeeks(s)}/${JUDGE_MIN_INTERROGATOR_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原调解处劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyJudgeCommand(s: SliceState, command: JudgeAcquisitionCommand, c: SeerContext): void {
  rule(validateJudgeCommand(command) && isJudgeAcquisitionCommand(command), '法官准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= JUDGE_PRICES.guidance;
      s.judge.guidanceKnown = true;
      c.note('听取法官用药说明', `花费1行动、360便士，你向已认识的本作原创成年${JUDGE_GUIDE}继续请教，她向你说明从独立法官成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的仲裁人、治安官或审讯者存药。${JUDGE_FORMULA_STATUS}审讯者消化须达100，晋升审讯者后满12整周才能服用；可提前筹备。${JUDGE_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.judge.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = JUDGE_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在薇娜·贝尔的原调解处实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.judge.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('法官原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原调解处劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；审讯者消化100且晋升审讯者后满12整周时，再独立确认服药。${JUDGE_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.judge.resupply.requestedWeek = s.week;
      c.note('申请下一批法官魔药', `现有法官原瓶全部耗尽且未晋升。你花费1行动，请${JUDGE_GUIDE}从同一新渠道订下一批三瓶，并实际核验原调解处的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.judge.bottles.length + 1;
      s.judge.resupply.deliveries += 1;
      for (let offset = 0; offset < JUDGE_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.judge.bottles.push({ id: `judge-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.judge.resupply.requestedWeek = null;
      c.note('下一批法官原瓶到货', `第${s.week}周，薇娜·贝尔的独立法官成品交接渠道本作G成品供给第${s.judge.resupply.deliveries + 1}批三瓶实际到货，原瓶judge-potion-${firstNumber}至judge-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.judge.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.judge.interrogatorActingAtPromotion = s.progression.acting;
        s.judge.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of JUDGE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为法官', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。仲裁人、治安官与审讯者全部原能力及原ID掌握完整继承，只新增质变权威与有限禁止两项，从0掌握开始；审讯者消化成果与审讯者晋升周保留，法官扮演从0开始。灵性上限提高到80，当前灵性没有补满。不赠物件；权威不保证真话，禁令仅限当前原现场且短暂可抵抗，不永久封禁能力。所有范围与双方同约束为G，序列5惩戒骑士的额外惩罚、囚禁和死亡打击没有下放。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了法官晋升' : '法官魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是审讯者，消化与全部原有掌握保留，没有获得法官能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectJudge(s: SliceState): JudgeProjection {
  const actions: JudgeAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?s.punishmentKnight.judgeActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: JudgeAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.judge.guidanceKnown) add('learn-judge-guidance', '请薇娜·贝尔说明法官成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.judge.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${JUDGE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶法官魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.judge.resupply.requestedWeek !== null) add('receive-judge-supply', '确认下一批三瓶法官到货', `0行动 · 第${s.judge.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.judge)) add('request-judge-supply', '向薇娜·贝尔订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.judge.guidanceKnown) {
    for (const bottle of s.judge.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶法官魔药`, `0行动 · 独立确认 · 审讯者消化${isPromoted ? s.judge.interrogatorActingAtPromotion : s.progression.acting}/100 · 晋升后${interrogatorWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.judge.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.judge.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '法官 · 序列6' : '法官之路', discovered: available,
    guidanceKnown: available && s.judge.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: { ...s.judge.practice },
    cases: [], environment: '', insideCase: Object.values(s.judge.cases).some(value => value.contactOpen),
    ...(available ? { story: JUDGE_SOURCE_STATUS } : {}),
    supplies: available ? `${JUDGE_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.judge.resupply.requestedWeek === null ? `已实际接收后续供给${s.judge.resupply.deliveries}批。` : `第${s.judge.resupply.requestedWeek}周提出请求，第${s.judge.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.judge.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 法官魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? JUDGE_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `审讯者消化成果${s.judge.interrogatorActingAtPromotion}/100已保留；法官扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成审讯者消化（${s.progression.acting}/100），并在晋升审讯者后度过12整周（${interrogatorWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完审讯者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${JUDGE_CONSUMPTION_RISK}` : '成为审讯者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isJudgeAcquisitionCommand(command: unknown): command is JudgeAcquisitionCommand {
  return validateJudgeCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateJudgeCommand(value: unknown): value is JudgeCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^judge-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^judge-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && JUDGE_CASE_IDS.includes(value.caseId as typeof JUDGE_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && JUDGE_CASE_IDS.includes(value.caseId as typeof JUDGE_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateJudgeState(s: SliceState): boolean {
  const raw: unknown = s.judge;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'interrogatorActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.arbiter) || !record(s.sheriff) || !record(s.interrogator)) return false;
  const firstInterrogatorWeek = s.interrogator.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstInterrogatorWeek + JUDGE_MIN_INTERROGATOR_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== JUDGE_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, JUDGE_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'ATTENTION_RECORDED', 'BOUNDARY_RECORDED', 'TOKEN_RECORDED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const judge = raw as unknown as JudgeState, isPromoted = promoted(s);
  if (judge.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!judge.guidanceKnown || !integer(s.interrogator.promotionWeek, 1, s.week) || !integer(judge.promotionWeek, firstConsumptionWeek, s.week) || judge.interrogatorActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS, ...INTERROGATOR_ABILITY_IDS, ...JUDGE_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?PUNISHMENT_KNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3)?IMPERATIVE_MAGE_ABILITY_IDS:[]),...(s.progression.sequence===3?CHAOS_HUNTER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (judge.promotionWeek !== null || judge.interrogatorActingAtPromotion !== null || JUDGE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (judge.reflected || Object.values(judge.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of judge.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `judge-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of judge.bottles.entries()) {
    let stockWeek = firstInterrogatorWeek;
    if (index < JUDGE_BOTTLE_IDS.length) {
      if (bottle.source !== JUDGE_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!judge.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / JUDGE_BOTTLE_IDS.length) - 1;
      if (index % JUDGE_BOTTLE_IDS.length === 0) {
        const previous = judge.bottles.slice(index - JUDGE_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > judge.promotionWeek!) return false;
    }
    if (!judge.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > judge.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > judge.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== judge.promotionWeek) return false;
    }
  }
  if (judge.resupply.requestedWeek !== null && (!judge.guidanceKnown || isPromoted || !supplyExhausted(judge) || judge.bottles.some(bottle => bottle.consumedWeek! > judge.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = judge.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, judge.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'JUDGE_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(judge.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.status !== 'ACTIVE' || s.activeEvent !== null || s.world.city !== 'BACKLUND' || Object.values(judge.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'judge-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateJudgeLife(s);
}

export { JUDGE_ABILITIES } from './content.js';
export type * from './types.js';
