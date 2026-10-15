import {THREE_HEADED_TEMPLAR_ABILITY_IDS} from '../three-headed-templar/types.js';
import {BLACK_KNIGHT_ABILITY_IDS} from '../black-knight/types.js';
import {SHEPHERD_ABILITY_IDS} from '../shepherd/types.js';
import {ROSE_BISHOP_ABILITY_IDS} from '../rose-bishop/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../secret-supplicant/types.js';
import { LISTENER_ABILITY_IDS } from '../listener/types.js';
import {
  SHADOW_ASCETIC_ABILITIES, SHADOW_ASCETIC_BOTTLE_IDS, SHADOW_ASCETIC_CONSUMPTION_RISK, SHADOW_ASCETIC_FORMULA_STATUS,
  SHADOW_ASCETIC_GUIDE, SHADOW_ASCETIC_LABOUR_TASKS, SHADOW_ASCETIC_MIN_LISTENER_WEEKS, SHADOW_ASCETIC_POTION_SOURCES, SHADOW_ASCETIC_PRICES, SHADOW_ASCETIC_SOURCE_STATUS,
} from './content.js';
import {
  SHADOW_ASCETIC_ABILITY_IDS, SHADOW_ASCETIC_CASE_IDS, type ShadowAsceticAcquisitionCommand, type ShadowAsceticAction,
  type ShadowAsceticBottle, type ShadowAsceticCommand, type ShadowAsceticProjection, type ShadowAsceticState,
} from './types.js';

export function createShadowAsceticState(): ShadowAsceticState {
  return {
    guidanceKnown: false,
    bottles: SHADOW_ASCETIC_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, listenerActingAtPromotion: null,
    cases: Object.fromEntries(SHADOW_ASCETIC_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', shadowOpen: false, hidden: false }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && (s.progression.sequence === 7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))));
const isListener = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.secretSupplicant.discovered && s.secretSupplicant.guidanceKnown && s.listener.guidanceKnown && (isListener(s) || promoted(s));
const potionPrice = (bottle: ShadowAsceticBottle) => SHADOW_ASCETIC_PRICES.potion - (bottle.labourSteps === 4 ? SHADOW_ASCETIC_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ShadowAsceticBottle) => Number(bottle.id.slice('shadow-ascetic-potion-'.length));
const listenerWeeks = (s: SliceState) => Math.max(0, (s.shadowAscetic.promotionWeek ?? s.week) - (s.listener.promotionWeek ?? s.week));
const supplyExhausted = (state: ShadowAsceticState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SHADOW_ASCETIC_GUIDE}的独立隐修士成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列7隐修士魔药，原瓶shadow-ascetic-potion-${number}，非秘祈人或倾听者旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: ShadowAsceticAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.secretSupplicant.cases).some(value => value.contactOpen)) return '先实际盖回秘祈人阶段原铜片的罩子，结束本次接触。';
  if (Object.values(s.listener.cases).some(value => value.contactOpen)) return '先实际离开倾听者阶段尚未退出的位置，结束本次接触。';
  if (Object.values(s.shadowAscetic.cases).some(value => value.shadowOpen)) return '先实际退出尚未结束的阴影藏匿。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的旧物间，找到伊森·洛弗。';
  if (!knownChannel(s)) return '成为倾听者并保有伊森·洛弗的指导渠道后，才能继续了解隐修士之路。';
  if (promoted(s)) return '你已完成隐修士晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.shadowAscetic.guidanceKnown) return '已经听过隐修士成品魔药的用药说明。';
    return s.cash < SHADOW_ASCETIC_PRICES.guidance ? '隐修士用药指导需要240便士。' : null;
  }
  if (!s.shadowAscetic.guidanceKnown) return '先听伊森·洛弗说明这批序列7原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.shadowAscetic.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.shadowAscetic) ? null : '须先用完现有全部隐修士原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.shadowAscetic.resupply.requestedWeek === null) return '尚未申请下一批隐修士补给。';
    if (s.week <= s.shadowAscetic.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.shadowAscetic) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.shadowAscetic.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选隐修士原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `倾听者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.listener.promotionWeek === null || listenerWeeks(s) < SHADOW_ASCETIC_MIN_LISTENER_WEEKS) return `成为倾听者后已度过${listenerWeeks(s)}/${SHADOW_ASCETIC_MIN_LISTENER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 4 ? '这瓶对应的四次旧物间劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyShadowAsceticCommand(s: SliceState, command: ShadowAsceticAcquisitionCommand, c: SeerContext): void {
  rule(validateShadowAsceticCommand(command) && isShadowAsceticAcquisitionCommand(command), '隐修士准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SHADOW_ASCETIC_PRICES.guidance;
      s.shadowAscetic.guidanceKnown = true;
      c.note('听取隐修士用药说明', `花费1行动、240便士，通过已有倾听者渠道，你再次找到原创成年${SHADOW_ASCETIC_GUIDE}，他向你说明从独立隐修士成品交接渠道实际取得的三瓶序列7成品、逐瓶交付与四档风险。这些不是原来的倾听者存药。${SHADOW_ASCETIC_FORMULA_STATUS}倾听者消化须达100，晋升倾听者后满8整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.shadowAscetic.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = SHADOW_ASCETIC_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊森·洛弗的旧物间实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/4，原瓶仍由导师保管。${bottle.labourSteps === 4 ? '四次劳务只抵这瓶1800便士，仍须实际支付210便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应四次劳务后才能抵这瓶1800便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.shadowAscetic.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('隐修士原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列7成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 4 ? '对应四次旧物间劳务抵扣1800便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；倾听者消化100且晋升倾听者后满8整周时，再独立确认服药。${SHADOW_ASCETIC_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.shadowAscetic.resupply.requestedWeek = s.week;
      c.note('申请下一批隐修士魔药', `现有隐修士原瓶全部耗尽且未晋升。你花费1行动，请${SHADOW_ASCETIC_GUIDE}从同一新渠道订下一批三瓶，并实际核验旧物间的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付2010便士，或分别完成四次劳务后支付210便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.shadowAscetic.bottles.length + 1;
      s.shadowAscetic.resupply.deliveries += 1;
      for (let offset = 0; offset < SHADOW_ASCETIC_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.shadowAscetic.bottles.push({ id: `shadow-ascetic-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.shadowAscetic.resupply.requestedWeek = null;
      c.note('下一批隐修士原瓶到货', `第${s.week}周，伊森·洛弗的独立隐修士成品交接渠道本作G成品供给第${s.shadowAscetic.resupply.deliveries + 1}批三瓶实际到货，原瓶shadow-ascetic-potion-${firstNumber}至shadow-ascetic-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按2010便士购买，或完成对应四次劳务再付210便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.shadowAscetic.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.shadowAscetic.listenerActingAtPromotion = s.progression.acting;
        s.shadowAscetic.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of SHADOW_ASCETIC_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为隐修士', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+2、知识+1。三项秘祈人能力与有限耳语倾听及其原ID掌握完整继承，仅新增阴影藏匿一项掌握从0开始；隐匿仍可被发现与攻击，不获得瞬移、分身或免疫；倾听者消化成果和晋升周保留，隐修士扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了隐修士晋升' : '隐修士魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是倾听者，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectShadowAscetic(s: SliceState): ShadowAsceticProjection {
  const actions: ShadowAsceticAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: ShadowAsceticAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.shadowAscetic.guidanceKnown) add('learn-shadow-ascetic-guidance', '请伊森·洛弗说明隐修士成品与风险', '1行动 · 240便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.shadowAscetic.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 4) add(`work-${bottle.id}`, `第${number}瓶 · ${SHADOW_ASCETIC_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/4，完成四次抵该瓶1800便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶隐修士魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列7原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.shadowAscetic.resupply.requestedWeek !== null) add('receive-shadow-ascetic-supply', '确认下一批三瓶隐修士到货', `0行动 · 第${s.shadowAscetic.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.shadowAscetic)) add('request-shadow-ascetic-supply', '向伊森·洛弗订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.shadowAscetic.guidanceKnown) {
    for (const bottle of s.shadowAscetic.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶隐修士魔药`, `0行动 · 独立确认 · 倾听者消化${isPromoted ? s.shadowAscetic.listenerActingAtPromotion : s.progression.acting}/100 · 晋升后${listenerWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.shadowAscetic.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.shadowAscetic.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '隐修士 · 序列7' : '隐修士之路', discovered: available,
    guidanceKnown: available && s.shadowAscetic.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: false,
    ...(available ? { story: SHADOW_ASCETIC_SOURCE_STATUS } : {}),
    supplies: available ? `${SHADOW_ASCETIC_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.shadowAscetic.resupply.requestedWeek === null ? `已实际接收后续供给${s.shadowAscetic.resupply.deliveries}批。` : `第${s.shadowAscetic.resupply.requestedWeek}周提出请求，第${s.shadowAscetic.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.shadowAscetic.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 隐修士魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/4`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SHADOW_ASCETIC_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?s.roseBishop.shadowAsceticActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?'隐修士魔药已消化，原阴影与有限观察经历保留。':isPromoted ? `倾听者消化成果${s.shadowAscetic.listenerActingAtPromotion}/100已保留；隐修士扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成倾听者消化（${s.progression.acting}/100），并在晋升倾听者后度过8整周（${listenerWeeks(s)}/8）。用药指导与原瓶可以提前准备。` : '先走完倾听者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应四次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${SHADOW_ASCETIC_CONSUMPTION_RISK}` : '成为倾听者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isShadowAsceticAcquisitionCommand(command: unknown): command is ShadowAsceticAcquisitionCommand {
  return validateShadowAsceticCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateShadowAsceticCommand(value: unknown): value is ShadowAsceticCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^shadow-ascetic-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^shadow-ascetic-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'REVEAL', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SHADOW_ASCETIC_CASE_IDS.includes(value.caseId as typeof SHADOW_ASCETIC_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && SHADOW_ASCETIC_CASE_IDS.includes(value.caseId as typeof SHADOW_ASCETIC_CASE_IDS[number]) && ['SHADOW', 'ORDINARY', 'BLOCKED_ROUTE'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions and actual shadow exit. */
export function validateShadowAsceticState(s: SliceState): boolean {
  const raw: unknown = s.shadowAscetic;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'listenerActingAtPromotion', 'cases', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.secretSupplicant) || !record(s.listener)) return false;
  const firstListenerWeek = s.listener.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstListenerWeek + SHADOW_ASCETIC_MIN_LISTENER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SHADOW_ASCETIC_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, SHADOW_ASCETIC_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'shadowOpen', 'hidden'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['SHADOW', 'ORDINARY', 'BLOCKED_ROUTE'].includes(value.method as string)) return false;
    if (!['NONE', 'LIGHT_CHECKED', 'ROUTE_CHECKED', 'WATCH_CHECKED'].includes(value.outcome as string)) return false;
    if (typeof value.shadowOpen !== 'boolean' || typeof value.hidden !== 'boolean') return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const shadowAscetic = raw as unknown as ShadowAsceticState, isPromoted = promoted(s);
  if (shadowAscetic.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!shadowAscetic.guidanceKnown || !integer(s.listener.promotionWeek, 1, s.week) || !integer(shadowAscetic.promotionWeek, firstConsumptionWeek, s.week) || shadowAscetic.listenerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS, ...SHADOW_ASCETIC_ABILITY_IDS,...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?ROSE_BISHOP_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?SHEPHERD_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3)?BLACK_KNIGHT_ABILITY_IDS:[]),...(s.progression.sequence===3?THREE_HEADED_TEMPLAR_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (shadowAscetic.promotionWeek !== null || shadowAscetic.listenerActingAtPromotion !== null || SHADOW_ASCETIC_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (shadowAscetic.reflected || Object.values(shadowAscetic.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.shadowOpen || value.hidden)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of shadowAscetic.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `shadow-ascetic-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 4)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of shadowAscetic.bottles.entries()) {
    let stockWeek = firstListenerWeek;
    if (index < SHADOW_ASCETIC_BOTTLE_IDS.length) {
      if (bottle.source !== SHADOW_ASCETIC_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!shadowAscetic.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SHADOW_ASCETIC_BOTTLE_IDS.length) - 1;
      if (index % SHADOW_ASCETIC_BOTTLE_IDS.length === 0) {
        const previous = shadowAscetic.bottles.slice(index - SHADOW_ASCETIC_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > shadowAscetic.promotionWeek!) return false;
    }
    if (!shadowAscetic.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > shadowAscetic.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > shadowAscetic.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== shadowAscetic.promotionWeek) return false;
    }
  }
  if (shadowAscetic.resupply.requestedWeek !== null && (!shadowAscetic.guidanceKnown || isPromoted || !supplyExhausted(shadowAscetic) || shadowAscetic.bottles.some(bottle => bottle.consumedWeek! > shadowAscetic.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { SHADOW_ASCETIC_ABILITIES } from './content.js';
export type * from './types.js';
