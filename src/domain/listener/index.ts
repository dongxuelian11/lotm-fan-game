import {THREE_HEADED_TEMPLAR_ABILITY_IDS} from '../three-headed-templar/types.js';
import {BLACK_KNIGHT_ABILITY_IDS} from '../black-knight/types.js';
import {SHEPHERD_ABILITY_IDS} from '../shepherd/types.js';
import {ROSE_BISHOP_ABILITY_IDS} from '../rose-bishop/types.js';
import {SHADOW_ASCETIC_ABILITY_IDS} from '../shadow-ascetic/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { SECRET_SUPPLICANT_ABILITY_IDS } from '../secret-supplicant/types.js';
import {
  LISTENER_ABILITIES, LISTENER_BOTTLE_IDS, LISTENER_CONSUMPTION_RISK, LISTENER_FORMULA_STATUS,
  LISTENER_GUIDE, LISTENER_LABOUR_TASKS, LISTENER_MIN_SECRET_SUPPLICANT_WEEKS, LISTENER_POTION_SOURCES, LISTENER_PRICES, LISTENER_SOURCE_STATUS,
} from './content.js';
import {
  LISTENER_ABILITY_IDS, LISTENER_CASE_IDS, type ListenerAcquisitionCommand, type ListenerAction,
  type ListenerBottle, type ListenerCommand, type ListenerProjection, type ListenerState,
} from './types.js';

export function createListenerState(): ListenerState {
  return {
    guidanceKnown: false,
    bottles: LISTENER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, secretSupplicantActingAtPromotion: null,
    cases: Object.fromEntries(LISTENER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, verified: false, overclaims: 0 }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))));
const isSecretSupplicant = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.secretSupplicant.discovered && s.secretSupplicant.guidanceKnown && (isSecretSupplicant(s) || promoted(s));
const potionPrice = (bottle: ListenerBottle) => LISTENER_PRICES.potion - (bottle.labourSteps === 3 ? LISTENER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ListenerBottle) => Number(bottle.id.slice('listener-potion-'.length));
const secretSupplicantWeeks = (s: SliceState) => Math.max(0, (s.listener.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const supplyExhausted = (state: ListenerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${LISTENER_GUIDE}的新进阶成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列8倾听者魔药，原瓶listener-potion-${number}，非秘祈人旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: ListenerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.secretSupplicant.cases).some(value => value.contactOpen)) return '先实际盖回秘祈人阶段原铜片的罩子，结束本次接触。';
  if (Object.values(s.listener.cases).some(value => value.contactOpen)) return '先实际离开本次倾听位置，结束尚在进行的接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的旧物间，找到伊森·洛弗。';
  if (!knownChannel(s)) return '成为秘祈人并保有伊森·洛弗的指导渠道后，才能继续了解倾听者之路。';
  if (promoted(s)) return '你已完成倾听者晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.listener.guidanceKnown) return '已经听过倾听者成品魔药的用药说明。';
    return s.cash < LISTENER_PRICES.guidance ? '倾听者用药指导需要180便士。' : null;
  }
  if (!s.listener.guidanceKnown) return '先听伊森·洛弗说明这批序列8原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.listener.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.listener) ? null : '须先用完现有全部倾听者原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.listener.resupply.requestedWeek === null) return '尚未申请下一批倾听者补给。';
    if (s.week <= s.listener.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.listener) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.listener.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选倾听者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `秘祈人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || secretSupplicantWeeks(s) < LISTENER_MIN_SECRET_SUPPLICANT_WEEKS) return `成为秘祈人后已度过${secretSupplicantWeeks(s)}/${LISTENER_MIN_SECRET_SUPPLICANT_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 3 ? '这瓶对应的三次旧物间劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyListenerCommand(s: SliceState, command: ListenerAcquisitionCommand, c: SeerContext): void {
  rule(validateListenerCommand(command) && isListenerAcquisitionCommand(command), '倾听者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= LISTENER_PRICES.guidance;
      s.listener.guidanceKnown = true;
      c.note('听取倾听者用药说明', `花费1行动、180便士，你向已认识的本作原创成年${LISTENER_GUIDE}继续请教，他向你说明从新进阶成品交接渠道实际取得的三瓶序列8成品、逐瓶交付与四档风险。这些不是原来的秘祈人存药。${LISTENER_FORMULA_STATUS}秘祈人消化须达100，首次晋升秘祈人后满4整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.listener.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = LISTENER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊森·洛弗的旧物间实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/3，原瓶仍由导师保管。${bottle.labourSteps === 3 ? '三次劳务只抵这瓶1050便士，仍须实际支付160便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应三次劳务后才能抵这瓶1050便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.listener.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('倾听者原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列8成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 3 ? '对应三次旧物间劳务抵扣1050便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；秘祈人消化100且首次晋升后满4整周时，再独立确认服药。${LISTENER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.listener.resupply.requestedWeek = s.week;
      c.note('申请下一批倾听者魔药', `现有倾听者原瓶全部耗尽且未晋升。你花费1行动，请${LISTENER_GUIDE}从同一新渠道订下一批三瓶，并实际核验旧物间的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付1210便士，或分别完成三次劳务后支付160便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.listener.bottles.length + 1;
      s.listener.resupply.deliveries += 1;
      for (let offset = 0; offset < LISTENER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.listener.bottles.push({ id: `listener-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.listener.resupply.requestedWeek = null;
      c.note('下一批倾听者原瓶到货', `第${s.week}周，伊森·洛弗的新进阶成品交接渠道本作G成品供给第${s.listener.resupply.deliveries + 1}批三瓶实际到货，原瓶listener-potion-${firstNumber}至listener-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按1210便士购买，或完成对应三次劳务再付160便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.listener.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.listener.secretSupplicantActingAtPromotion = s.progression.acting;
        s.listener.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of LISTENER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['perception', 1], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为倾听者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质不增加、感知+1、意志+2、知识+1。三项秘祈人能力及原ID掌握完整继承，新增有限耳语倾听从0掌握开始，不自动获得未知扭曲力量或通用法术表；秘祈人消化成果和首次晋升周保留，倾听者扮演从0开始。灵性上限提高到45，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了倾听者晋升' : '倾听者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是秘祈人，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectListener(s: SliceState): ListenerProjection {
  const actions: ListenerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? (s.progression.sequence===8?s.progression.acting:s.shadowAscetic.listenerActingAtPromotion??0) : 0;
  const add = (id: string, label: string, cost: string, command: ListenerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.listener.guidanceKnown) add('learn-listener-guidance', '请伊森·洛弗说明倾听者成品与风险', '1行动 · 180便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.listener.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 3) add(`work-${bottle.id}`, `第${number}瓶 · ${LISTENER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/3，完成三次抵该瓶1050便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶倾听者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列8原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.listener.resupply.requestedWeek !== null) add('receive-listener-supply', '确认下一批三瓶倾听者到货', `0行动 · 第${s.listener.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.listener)) add('request-listener-supply', '向伊森·洛弗订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.listener.guidanceKnown) {
    for (const bottle of s.listener.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶倾听者魔药`, `0行动 · 独立确认 · 秘祈人消化${isPromoted ? s.listener.secretSupplicantActingAtPromotion : s.progression.acting}/100 · 晋升后${secretSupplicantWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.listener.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.listener.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '倾听者 · 序列8' : '倾听者之路', discovered: available,
    guidanceKnown: available && s.listener.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: false,
    ...(available ? { story: LISTENER_SOURCE_STATUS } : {}),
    supplies: available ? `${LISTENER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.listener.resupply.requestedWeek === null ? `已实际接收后续供给${s.listener.resupply.deliveries}批。` : `第${s.listener.resupply.requestedWeek}周提出请求，第${s.listener.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.listener.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 倾听者魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/3`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? LISTENER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `秘祈人消化成果${s.listener.secretSupplicantActingAtPromotion}/100已保留；倾听者扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成秘祈人消化（${s.progression.acting}/100），并在首次晋升秘祈人后度过4整周（${secretSupplicantWeeks(s)}/4）。用药指导与原瓶可以提前准备。` : '先走完秘祈人之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应三次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${LISTENER_CONSUMPTION_RISK}` : '成为秘祈人后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isListenerAcquisitionCommand(command: ListenerCommand): command is ListenerAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateListenerCommand(value: unknown): value is ListenerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^listener-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^listener-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'LEAVE', 'VERIFY', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && LISTENER_CASE_IDS.includes(value.caseId as typeof LISTENER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && LISTENER_CASE_IDS.includes(value.caseId as typeof LISTENER_CASE_IDS[number]) && ['LISTEN', 'ORDINARY'].includes(value.method as string);
  if (value.type === 'REPORT') return shape(value, ['type', 'caseId', 'claim']) && LISTENER_CASE_IDS.includes(value.caseId as typeof LISTENER_CASE_IDS[number]) && ['LIMITED', 'CERTAIN'].includes(value.claim as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual departure from contact, and exact outcome/source gates. */
export function validateListenerState(s: SliceState): boolean {
  const raw: unknown = s.listener;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'secretSupplicantActingAtPromotion', 'cases', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.secretSupplicant)) return false;
  const firstSecretSupplicantWeek = s.progression.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstSecretSupplicantWeek + LISTENER_MIN_SECRET_SUPPLICANT_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== LISTENER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, LISTENER_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'verified', 'overclaims'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['LISTEN', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'KNOCK_CHECKED', 'FRAGMENT_RETAINED', 'DISTANCE_CHECKED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || typeof value.verified !== 'boolean' || !integer(value.overclaims, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const listener = raw as unknown as ListenerState, isPromoted = promoted(s);
  if (listener.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!listener.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(listener.promotionWeek, firstConsumptionWeek, s.week) || listener.secretSupplicantActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...SECRET_SUPPLICANT_ABILITY_IDS, ...LISTENER_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))))?SHADOW_ASCETIC_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?ROSE_BISHOP_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?SHEPHERD_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3)?BLACK_KNIGHT_ABILITY_IDS:[]),...(s.progression.sequence===3?THREE_HEADED_TEMPLAR_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (listener.promotionWeek !== null || listener.secretSupplicantActingAtPromotion !== null || LISTENER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (listener.reflected || Object.values(listener.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.verified || value.overclaims !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of listener.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `listener-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 3)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of listener.bottles.entries()) {
    let stockWeek = firstSecretSupplicantWeek;
    if (index < LISTENER_BOTTLE_IDS.length) {
      if (bottle.source !== LISTENER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!listener.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / LISTENER_BOTTLE_IDS.length) - 1;
      if (index % LISTENER_BOTTLE_IDS.length === 0) {
        const previous = listener.bottles.slice(index - LISTENER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > listener.promotionWeek!) return false;
    }
    if (!listener.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > listener.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > listener.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== listener.promotionWeek) return false;
    }
  }
  if (listener.resupply.requestedWeek !== null && (!listener.guidanceKnown || isPromoted || !supplyExhausted(listener) || listener.bottles.some(bottle => bottle.consumedWeek! > listener.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export type * from './types.js';
