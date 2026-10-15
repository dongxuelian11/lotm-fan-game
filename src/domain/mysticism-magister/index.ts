import { ALL_KNOWING_EYE_ABILITY_IDS } from '../all-knowing-eye/types.js';
import { WISDOM_ANGEL_ABILITY_IDS } from '../wisdom-angel/types.js';
import {INSIGHT_SCHOLAR_ABILITY_IDS} from '../insight-scholar/types.js';
import {PROPHET_ABILITY_IDS} from '../prophet/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { READER_ABILITY_IDS } from '../reader/types.js';
import { REASONER_ABILITY_IDS } from '../reasoner/types.js';
import { validateMysticismMagisterLife } from './life.js';
import { validateMysticismMagisterEncounter } from './encounter.js';
import { POLYMATH_ABILITY_IDS } from '../polymath/types.js';
import { DETECTIVE_ABILITY_IDS } from '../detective/types.js';
import {
  MYSTICISM_MAGISTER_ABILITIES, MYSTICISM_MAGISTER_BOTTLE_IDS, MYSTICISM_MAGISTER_CONSUMPTION_RISK, MYSTICISM_MAGISTER_FORMULA_STATUS,
  MYSTICISM_MAGISTER_GUIDE, MYSTICISM_MAGISTER_LABOUR_TASKS, MYSTICISM_MAGISTER_MIN_POLYMATH_WEEKS, MYSTICISM_MAGISTER_POTION_SOURCES, MYSTICISM_MAGISTER_PRICES, MYSTICISM_MAGISTER_SOURCE_STATUS,
} from './content.js';
import {
  MYSTICISM_MAGISTER_ABILITY_IDS, MYSTICISM_MAGISTER_CASE_IDS, type MysticismMagisterAcquisitionCommand, type MysticismMagisterAction,
  type MysticismMagisterBottle, type MysticismMagisterCommand, type MysticismMagisterProjection, type MysticismMagisterState,
} from './types.js';

export function createMysticismMagisterState(): MysticismMagisterState {
  return {
    guidanceKnown: false,
    bottles: MYSTICISM_MAGISTER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, polymathActingAtPromotion: null,
    cases: Object.fromEntries(MYSTICISM_MAGISTER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { token: 'OWNER', dreamOpen: false, dreamResult: 'NONE', dreamAttempts: 0, kitsUsed: 0, teachingChecks: 0 },
    crafts: [], craftAttemptWeek: null,
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'white-tower' && (s.progression.sequence === 5||(s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)));
const isPolymath = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.reader.discovered && s.reader.guidanceKnown && s.reasoner.guidanceKnown && s.detective.guidanceKnown && s.polymath.guidanceKnown && s.polymath.promotionWeek !== null && (isPolymath(s) || promoted(s));
const potionPrice = (bottle: MysticismMagisterBottle) => MYSTICISM_MAGISTER_PRICES.potion - (bottle.labourSteps === 5 ? MYSTICISM_MAGISTER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: MysticismMagisterBottle) => Number(bottle.id.slice('mysticism-magister-potion-'.length));
const polymathWeeks = (s: SliceState) => Math.max(0, (s.mysticismMagister.promotionWeek ?? s.week) - (s.polymath.promotionWeek ?? s.week));
const supplyExhausted = (state: MysticismMagisterState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${MYSTICISM_MAGISTER_GUIDE}的独立秘术导师成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5秘术导师魔药，原瓶mysticism-magister-potion-${number}，非阅读者、推理学员、守知者或博学者旧瓶改装。完整配方与晋升仪式资料待核。`;

function commandBlock(s: SliceState, command: MysticismMagisterAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.mysticismMagister.cases).some(value => value.contactOpen) || s.mysticismMagister.practice.dreamOpen) return '先实际结束本次秘术导师实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原借阅馆，找到塞缪尔。';
  if (!knownChannel(s)) return '成为博学者并保有塞缪尔的指导渠道后，才能继续了解秘术导师之路。';
  if (promoted(s)) return '你已完成秘术导师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.mysticismMagister.guidanceKnown) return '已经听过秘术导师成品魔药的用药说明。';
    return s.cash < MYSTICISM_MAGISTER_PRICES.guidance ? '秘术导师用药指导需要460便士。' : null;
  }
  if (!s.mysticismMagister.guidanceKnown) return '先听塞缪尔说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.mysticismMagister.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.mysticismMagister) ? null : '须先用完现有全部秘术导师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.mysticismMagister.resupply.requestedWeek === null) return '尚未申请下一批秘术导师补给。';
    if (s.week <= s.mysticismMagister.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.mysticismMagister) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.mysticismMagister.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选秘术导师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `博学者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.polymath.promotionWeek === null || polymathWeeks(s) < MYSTICISM_MAGISTER_MIN_POLYMATH_WEEKS) return `成为博学者后已度过${polymathWeeks(s)}/${MYSTICISM_MAGISTER_MIN_POLYMATH_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原借阅馆劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyMysticismMagisterCommand(s: SliceState, command: MysticismMagisterAcquisitionCommand, c: SeerContext): void {
  rule(validateMysticismMagisterCommand(command) && isMysticismMagisterAcquisitionCommand(command), '秘术导师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= MYSTICISM_MAGISTER_PRICES.guidance;
      s.mysticismMagister.guidanceKnown = true;
      c.note('听取秘术导师用药说明', `花费1行动、460便士，你向已认识的本作原创成年${MYSTICISM_MAGISTER_GUIDE}继续请教，他向你说明从独立秘术导师成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险。这些不是原来的阅读者、推理学员、守知者或博学者存药。${MYSTICISM_MAGISTER_FORMULA_STATUS}博学者消化须达100，晋升博学者后满12整周才能服用；可提前筹备。${MYSTICISM_MAGISTER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.mysticismMagister.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = MYSTICISM_MAGISTER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在塞缪尔的原借阅馆实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.mysticismMagister.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('秘术导师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原借阅馆劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；博学者消化100且晋升博学者后满12整周时，再独立确认服药。${MYSTICISM_MAGISTER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.mysticismMagister.resupply.requestedWeek = s.week;
      c.note('申请下一批秘术导师魔药', `现有秘术导师原瓶全部耗尽且未晋升。你花费1行动，请${MYSTICISM_MAGISTER_GUIDE}从同一新渠道订下一批三瓶，并实际核验原借阅馆的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.mysticismMagister.bottles.length + 1;
      s.mysticismMagister.resupply.deliveries += 1;
      for (let offset = 0; offset < MYSTICISM_MAGISTER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.mysticismMagister.bottles.push({ id: `mysticism-magister-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.mysticismMagister.resupply.requestedWeek = null;
      c.note('下一批秘术导师原瓶到货', `第${s.week}周，塞缪尔的独立秘术导师成品交接渠道本作G成品供给第${s.mysticismMagister.resupply.deliveries + 1}批三瓶实际到货，原瓶mysticism-magister-potion-${firstNumber}至mysticism-magister-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.mysticismMagister.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.mysticismMagister.polymathActingAtPromotion = s.progression.acting;
        s.mysticismMagister.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of MYSTICISM_MAGISTER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为秘术导师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。阅读者、推理学员、守知者与博学者全部原能力及原ID掌握完整继承，只新增“联系物秘术仪式”和“材料依托制造模仿”两项，从0掌握开始；博学者消化成果与博学者晋升周保留，秘术导师扮演从0开始。灵性上限提高到100，当前灵性没有补满。博学者全部实际样本与原物历史保持原样，未学会的样本不会自动学会。秘术须真实联系物与有限仪式，身体不传送；制造须相关知识和实际消耗非凡材料，不赠材料或弱闪原件，不获得任意技能库或序列4预言家的未来预言。MM5-CLOTH-1仍在原主人诺亚手中，原博学者杯与水仍留原处。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了秘术导师晋升' : '秘术导师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是博学者，消化与全部原有掌握保留，没有获得秘术导师能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectMysticismMagister(s: SliceState): MysticismMagisterProjection {
  const actions: MysticismMagisterAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?s.prophet.mysticismMagisterActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: MysticismMagisterAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.mysticismMagister.guidanceKnown) add('learn-mysticism-magister-guidance', '请塞缪尔说明秘术导师成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.mysticismMagister.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${MYSTICISM_MAGISTER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶秘术导师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.mysticismMagister.resupply.requestedWeek !== null) add('receive-mysticism-magister-supply', '确认下一批三瓶秘术导师到货', `0行动 · 第${s.mysticismMagister.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.mysticismMagister)) add('request-mysticism-magister-supply', '向塞缪尔订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.mysticismMagister.guidanceKnown) {
    for (const bottle of s.mysticismMagister.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶秘术导师魔药`, `0行动 · 独立确认 · 博学者消化${isPromoted ? s.mysticismMagister.polymathActingAtPromotion : s.progression.acting}/100 · 晋升后${polymathWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.mysticismMagister.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.mysticismMagister.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '秘术导师 · 序列5' : '秘术导师之路', discovered: available,
    guidanceKnown: available && s.mysticismMagister.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: null, crafts: [],
    cases: [], environment: '', insideCase: Object.values(s.mysticismMagister.cases).some(value => value.contactOpen) || s.mysticismMagister.practice.dreamOpen,
    ...(available ? { story: MYSTICISM_MAGISTER_SOURCE_STATUS } : {}),
    supplies: available ? `${MYSTICISM_MAGISTER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.mysticismMagister.resupply.requestedWeek === null ? `已实际接收后续供给${s.mysticismMagister.resupply.deliveries}批。` : `第${s.mysticismMagister.resupply.requestedWeek}周提出请求，第${s.mysticismMagister.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions: s.progression.pathwayId === 'white-tower' && (s.progression.sequence === 2||s.progression.sequence===1) ? [] : actions,
    bottles: available ? s.mysticismMagister.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 秘术导师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? MYSTICISM_MAGISTER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `博学者消化成果${s.mysticismMagister.polymathActingAtPromotion}/100已保留；秘术导师扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成博学者消化（${s.progression.acting}/100），并在晋升博学者后度过12整周（${polymathWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完博学者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${MYSTICISM_MAGISTER_CONSUMPTION_RISK}` : '成为博学者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isMysticismMagisterAcquisitionCommand(command: unknown): command is MysticismMagisterAcquisitionCommand {
  return validateMysticismMagisterCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateMysticismMagisterCommand(value: unknown): value is MysticismMagisterCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'RETURN_TOKEN', 'VERIFY_DREAM', 'MAKE_TOKEN', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^mysticism-magister-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^mysticism-magister-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && MYSTICISM_MAGISTER_CASE_IDS.includes(value.caseId as typeof MYSTICISM_MAGISTER_CASE_IDS[number]);
  if (value.type === 'TEST_TOKEN') return shape(value, ['type', 'itemId']) && typeof value.itemId === 'string' && /^MM5-FLASH-[1-9]\d{0,14}$/.test(value.itemId);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && MYSTICISM_MAGISTER_CASE_IDS.includes(value.caseId as typeof MYSTICISM_MAGISTER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateMysticismMagisterState(s: SliceState): boolean {
  const raw: unknown = s.mysticismMagister;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'polymathActingAtPromotion', 'cases', 'practice', 'crafts', 'craftAttemptWeek', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.reader) || !record(s.reasoner) || !record(s.detective) || !record(s.polymath)) return false;
  const firstPolymathWeek = s.polymath.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstPolymathWeek + MYSTICISM_MAGISTER_MIN_POLYMATH_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== MYSTICISM_MAGISTER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, MYSTICISM_MAGISTER_CASE_IDS) || !Object.values(raw.cases).every(record)) return false;
  if (!record(raw.practice) || !shape(raw.practice, ['token', 'dreamOpen', 'dreamResult', 'dreamAttempts', 'kitsUsed', 'teachingChecks']) || !Array.isArray(raw.crafts)) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !validateMysticismMagisterLife(s)) return false;
  const mysticismMagister = raw as unknown as MysticismMagisterState, isPromoted = promoted(s);
  if (mysticismMagister.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!mysticismMagister.guidanceKnown || !integer(s.polymath.promotionWeek, 1, s.week) || !integer(mysticismMagister.promotionWeek, firstConsumptionWeek, s.week) || mysticismMagister.polymathActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?ALL_KNOWING_EYE_ABILITY_IDS:[]),...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS, ...DETECTIVE_ABILITY_IDS, ...POLYMATH_ABILITY_IDS, ...MYSTICISM_MAGISTER_ABILITY_IDS,...((s.progression.sequence===4||s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?PROPHET_ABILITY_IDS:[]),...([3, 2, 1].includes(s.progression.sequence ?? 0)?INSIGHT_SCHOLAR_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?WISDOM_ANGEL_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (mysticismMagister.promotionWeek !== null || mysticismMagister.polymathActingAtPromotion !== null || MYSTICISM_MAGISTER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (mysticismMagister.practice.token !== 'OWNER' || mysticismMagister.practice.dreamOpen || mysticismMagister.practice.dreamResult !== 'NONE' || mysticismMagister.practice.dreamAttempts !== 0 || mysticismMagister.practice.kitsUsed !== 0 || mysticismMagister.practice.teachingChecks !== 0 || mysticismMagister.crafts.length !== 0 || mysticismMagister.craftAttemptWeek !== null) return false;
    if (mysticismMagister.reflected || Object.values(mysticismMagister.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of mysticismMagister.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `mysticism-magister-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of mysticismMagister.bottles.entries()) {
    let stockWeek = firstPolymathWeek;
    if (index < MYSTICISM_MAGISTER_BOTTLE_IDS.length) {
      if (bottle.source !== MYSTICISM_MAGISTER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!mysticismMagister.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / MYSTICISM_MAGISTER_BOTTLE_IDS.length) - 1;
      if (index % MYSTICISM_MAGISTER_BOTTLE_IDS.length === 0) {
        const previous = mysticismMagister.bottles.slice(index - MYSTICISM_MAGISTER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > mysticismMagister.promotionWeek!) return false;
    }
    if (!mysticismMagister.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > mysticismMagister.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > mysticismMagister.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== mysticismMagister.promotionWeek) return false;
    }
  }
  if (mysticismMagister.resupply.requestedWeek !== null && (!mysticismMagister.guidanceKnown || isPromoted || !supplyExhausted(mysticismMagister) || mysticismMagister.bottles.some(bottle => bottle.consumedWeek! > mysticismMagister.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = mysticismMagister.encounter;
  if (isPromoted && (s.progression.sequence === 2||s.progression.sequence===1) && e.status === 'FIGHTING') return false;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, mysticismMagister.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'MYSTICISM_MAGISTER_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(mysticismMagister.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (Object.values(mysticismMagister.cases).some(r => r.contactOpen) || mysticismMagister.practice.dreamOpen)) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'mysticism-magister-dispute').length;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateMysticismMagisterEncounter(s);
}

export { MYSTICISM_MAGISTER_ABILITIES } from './content.js';
export type * from './types.js';
