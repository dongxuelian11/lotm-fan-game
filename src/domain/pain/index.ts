import { CALAMITY_DEMONESS_ABILITY_IDS } from '../calamity-demoness/types.js';
import {UNAGING_DEMONESS_ABILITY_IDS} from '../unaging-demoness/types.js';
import {DESPAIR_ABILITY_IDS} from '../despair/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ASSASSIN_ABILITY_IDS } from '../assassin/types.js';
import { INSTIGATOR_ABILITY_IDS } from '../instigator/types.js';
import { WITCH_ABILITY_IDS } from '../witch/types.js';
import { PLEASURE_ABILITY_IDS } from '../pleasure/types.js';
import { painInside, validatePainLife } from './life.js';
import { pleasureInside } from '../pleasure/life.js';
import { validatePainEncounter } from './encounter.js';
import {
  PAIN_ABILITIES, PAIN_BOTTLE_IDS, PAIN_CONSUMPTION_RISK, PAIN_FORMULA_STATUS,
  PAIN_GUIDE, PAIN_LABOUR_TASKS, PAIN_MIN_PLEASURE_WEEKS, PAIN_POTION_SOURCES, PAIN_PRICES, PAIN_SOURCE_STATUS,
} from './content.js';
import {
  PAIN_ABILITY_IDS, PAIN_CASE_IDS, type PainAcquisitionCommand, type PainAction,
  type PainBottle, type PainCommand, type PainPractice, type PainProjection, type PainState,
} from './types.js';

export function freshPainPractice(): PainPractice {
  return { playerNode: 'ENTRY', companionNode: 'WAITING', marker: 'RACK', tableRows: 0, careNote: 'BLANK', simulatedOnly: true };
}

export function createPainState(): PainState {
  return {
    guidanceKnown: false,
    bottles: PAIN_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, pleasureActingAtPromotion: null,
    cases: Object.fromEntries(PAIN_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: freshPainPractice(),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, silkPrepared: false, boundRound: null, fieldActive: false, enemyDisease: 0, diseaseApplications: 0, lastDiseaseRound: null, care: 'NONE', enemyHealth: 100, enemyStatus: 'NOT_MET' },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'demoness' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const isPleasure = (s: SliceState) => s.progression.pathwayId === 'demoness' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.assassin.discovered && s.assassin.guidanceKnown && s.instigator.guidanceKnown && s.witch.formulaKnown && s.pleasure.formulaKnown && s.pleasure.promotionWeek !== null && (isPleasure(s) || promoted(s));
const potionPrice = (bottle: PainBottle) => PAIN_PRICES.potion - (bottle.labourSteps === 5 ? PAIN_PRICES.labourCredit : 0);
const bottleNumber = (bottle: PainBottle) => Number(bottle.id.slice('pain-potion-'.length));
const pleasureWeeks = (s: SliceState) => Math.max(0, (s.pain.promotionWeek ?? s.week) - (s.pleasure.promotionWeek ?? s.week));
const inheritedContactOpen = (s: SliceState) => pleasureInside(s) || s.pleasure.practice.wrist !== 'FREE' || s.pleasure.practice.fireSilk === 'ON_FRAME';
const supplyExhausted = (state: PainState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${PAIN_GUIDE}的独立痛苦魔女成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5痛苦魔女魔药，原瓶pain-potion-${number}，非刺客、教唆者、女巫或欢愉魔女旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: PainAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (painInside(s) || inheritedContactOpen(s)) return '先实际结束当前训练实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原独立练习场，找到诺艾拉·温瑟。';
  if (!knownChannel(s)) return '成为欢愉魔女并保有诺艾拉·温瑟的指导渠道后，才能继续了解痛苦魔女之路。';
  if (promoted(s)) return '你已完成痛苦魔女晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.pain.guidanceKnown) return '已经听过痛苦魔女成品魔药的用药说明。';
    return s.cash < PAIN_PRICES.guidance ? '痛苦魔女用药指导需要460便士。' : null;
  }
  if (!s.pain.guidanceKnown) return '先听诺艾拉·温瑟说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.pain.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.pain) ? null : '须先用完现有全部痛苦魔女原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.pain.resupply.requestedWeek === null) return '尚未申请下一批痛苦魔女补给。';
    if (s.week <= s.pain.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.pain) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.pain.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选痛苦魔女原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `欢愉魔女魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.pleasure.promotionWeek === null || pleasureWeeks(s) < PAIN_MIN_PLEASURE_WEEKS) return `成为欢愉魔女后已度过${pleasureWeeks(s)}/${PAIN_MIN_PLEASURE_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原独立练习场劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyPainCommand(s: SliceState, command: PainAcquisitionCommand, c: SeerContext): void {
  rule(validatePainCommand(command) && isPainAcquisitionCommand(command), '痛苦魔女准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= PAIN_PRICES.guidance;
      s.pain.guidanceKnown = true;
      c.note('听取痛苦魔女用药说明', `花费1行动、460便士，你向已认识的本作原创成年${PAIN_GUIDE}继续请教，导师向你说明从独立痛苦魔女成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原独立练习场安静场地与在场照护安排。这些不是原来的刺客、教唆者、女巫或欢愉魔女存药。${PAIN_FORMULA_STATUS}欢愉魔女消化须达100，晋升欢愉魔女后满12整周才能服用；可提前筹备。${PAIN_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.pain.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = PAIN_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在诺艾拉·温瑟的原独立练习场实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.pain.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('痛苦魔女原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原独立练习场劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；欢愉魔女消化100且晋升欢愉魔女后满12整周时，再独立确认服药。${PAIN_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.pain.resupply.requestedWeek = s.week;
      c.note('申请下一批痛苦魔女魔药', `现有痛苦魔女原瓶全部耗尽且未晋升。你花费1行动，请${PAIN_GUIDE}从同一新渠道订下一批三瓶，并实际核验原独立练习场的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.pain.bottles.length + 1;
      s.pain.resupply.deliveries += 1;
      for (let offset = 0; offset < PAIN_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.pain.bottles.push({ id: `pain-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.pain.resupply.requestedWeek = null;
      c.note('下一批痛苦魔女原瓶到货', `第${s.week}周，诺艾拉·温瑟的独立痛苦魔女成品交接渠道本作G成品供给第${s.pain.resupply.deliveries + 1}批三瓶实际到货，原瓶pain-potion-${firstNumber}至pain-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.pain.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次痛苦魔女服药准备', `原成年${PAIN_GUIDE}在原独立练习场实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.pain.pleasureActingAtPromotion = s.progression.acting;
        s.pain.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of PAIN_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为痛苦魔女', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。刺客、教唆者、女巫与欢愉魔女全部原能力及原ID掌握完整继承，仅新增assassin.s5.disease一项，从0掌握开始；欢愉魔女消化成果、原晋升周、原材料、原瓶、粉剂与镜子、真实蛛丝练习、拒绝与已解决敌人记录均保持原样，痛苦魔女扮演从0开始。灵性上限提高到100，当前灵性没有补满。原女巫身体与性别变化记录原样保留，本次不发生第二次身体转变，不新增强制身份或关系。超自然疾病可渐进加深，但停播散或离开范围不自动治愈既有病势；没有友军天然免疫。成年拉维妮与原物仍在原位置，和平模拟不向她施加疾病，不假装获得实际疾病能力掌握。序列4绝望的神话形态与更大范围瘟疫尚未获得。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了痛苦魔女晋升' : '痛苦魔女魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是欢愉魔女，消化与全部原有掌握保留，没有获得痛苦魔女能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectPain(s: SliceState): PainProjection {
  const actions: PainAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.despair.painActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: PainAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.pain.guidanceKnown) add('learn-pain-guidance', '请诺艾拉·温瑟说明痛苦魔女成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.pain.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${PAIN_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶痛苦魔女魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.pain.resupply.requestedWeek !== null) add('receive-pain-supply', '确认下一批三瓶痛苦魔女到货', `0行动 · 第${s.pain.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.pain)) add('request-pain-supply', '向诺艾拉·温瑟订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.pain.guidanceKnown) {
    for (const bottle of s.pain.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶痛苦魔女魔药`, `0行动 · 独立确认 · 欢愉魔女消化${isPromoted ? s.pain.pleasureActingAtPromotion : s.progression.acting}/100 · 晋升后${pleasureWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.pain.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.pain.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '痛苦魔女 · 序列5' : '痛苦魔女之路', discovered: available,
    guidanceKnown: available && s.pain.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: null,
    diseaseState: { fieldActive: s.pain.encounter.fieldActive, enemyDisease: s.pain.encounter.enemyDisease, diseaseApplications: s.pain.encounter.diseaseApplications, care: s.pain.encounter.care, enemyHealth: s.pain.encounter.enemyHealth, enemyStatus: s.pain.encounter.enemyStatus },
    inheritedTools: available ? `原女巫耗材仍可使用：粉末${s.witch.tools.powderHeld}份，小镜${s.witch.tools.mirrorsHeld}面；${s.witch.tools.mirrorPrepared ? '已单独准备一面替身镜' : '尚未单独准备替身镜'}。补给60便士、1行动；备镜0行动、0灵性，战斗实际消耗同一原镜。` : '',
    bodyChange: available ? '原女巫晋升时的身体与性别变化记录完整保留，本次不发生第二次身体转变，不替玩家决定自称、关系或意愿。' : '',
    cases: [], environment: '', insideCase: (painInside(s) || inheritedContactOpen(s)),
    ...(available ? { story: PAIN_SOURCE_STATUS } : {}),
    supplies: available ? `${PAIN_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.pain.resupply.requestedWeek === null ? `已实际接收后续供给${s.pain.resupply.deliveries}批。` : `第${s.pain.resupply.requestedWeek}周提出请求，第${s.pain.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.pain.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 痛苦魔女魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? PAIN_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `欢愉魔女消化成果${s.pain.pleasureActingAtPromotion}/100已保留；痛苦魔女扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成欢愉魔女消化（${s.progression.acting}/100），并在晋升欢愉魔女后度过12整周（${pleasureWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完欢愉魔女之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${PAIN_CONSUMPTION_RISK}` : '成为欢愉魔女后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isPainAcquisitionCommand(command: unknown): command is PainAcquisitionCommand {
  return validatePainCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validatePainCommand(value: unknown): value is PainCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'BUY_SUPPLIES', 'PREPARE_MIRROR', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'ENCOUNTER_AID'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^pain-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^pain-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && PAIN_CASE_IDS.includes(value.caseId as typeof PAIN_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && PAIN_CASE_IDS.includes(value.caseId as typeof PAIN_CASE_IDS[number]) && value.method === 'ORDINARY';
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validatePainState(s: SliceState): boolean {
  const raw: unknown = s.pain;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'pleasureActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.assassin) || !record(s.instigator) || !record(s.witch) || !record(s.pleasure)) return false;
  const firstPleasureWeek = s.pleasure.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstPleasureWeek + PAIN_MIN_PLEASURE_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== PAIN_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, PAIN_CASE_IDS) || !record(raw.practice) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validatePainLife(s)) return false;
  const pain = raw as unknown as PainState, isPromoted = promoted(s);
  if (pain.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!pain.guidanceKnown || !integer(s.pleasure.promotionWeek, 1, s.week) || !integer(pain.promotionWeek, firstConsumptionWeek, s.week) || pain.pleasureActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS, ...WITCH_ABILITY_IDS, ...PLEASURE_ABILITY_IDS, ...PAIN_ABILITY_IDS,...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DESPAIR_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?UNAGING_DEMONESS_ABILITY_IDS:[]),...(s.progression.sequence===2?CALAMITY_DEMONESS_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (pain.promotionWeek !== null || pain.pleasureActingAtPromotion !== null || PAIN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (Object.entries(freshPainPractice()).some(([key, value]) => pain.practice[key as keyof PainPractice] !== value)) return false;
    if (pain.reflected || Object.values(pain.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of pain.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `pain-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of pain.bottles.entries()) {
    let stockWeek = firstPleasureWeek;
    if (index < PAIN_BOTTLE_IDS.length) {
      if (bottle.source !== PAIN_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!pain.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / PAIN_BOTTLE_IDS.length) - 1;
      if (index % PAIN_BOTTLE_IDS.length === 0) {
        const previous = pain.bottles.slice(index - PAIN_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > pain.promotionWeek!) return false;
    }
    if (!pain.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > pain.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > pain.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== pain.promotionWeek) return false;
    }
  }
  if (pain.resupply.requestedWeek !== null && (!pain.guidanceKnown || isPromoted || !supplyExhausted(pain) || pain.bottles.some(bottle => bottle.consumedWeek! > pain.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0) && validatePainEncounter(s);
}

export { PAIN_ABILITIES } from './content.js';
export type * from './types.js';
