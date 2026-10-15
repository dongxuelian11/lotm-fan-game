import { BLOOD_DUKE_ABILITY_IDS } from '../blood-duke/types.js';
import {BLATHERER_ABILITY_IDS} from '../blatherer/types.js';
import {DEVIL_ABILITY_IDS} from '../devil/types.js';
import {DESIRE_APOSTLE_ABILITY_IDS} from '../desire-apostle/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CRIMINAL_ABILITY_IDS } from '../criminal/types.js';
import { UNWINGED_ABILITY_IDS } from '../unwinged/types.js';
import { validateDemonLife } from './life.js';
import { SERIAL_KILLER_ABILITY_IDS } from '../serial-killer/types.js';
import {
  DEMON_ABILITIES, DEMON_BOTTLE_IDS, DEMON_CONSUMPTION_RISK, DEMON_FORMULA_STATUS,
  DEMON_GUIDE, DEMON_LABOUR_TASKS, DEMON_MIN_SERIAL_KILLER_WEEKS, DEMON_POTION_SOURCES, DEMON_PRICES, DEMON_SOURCE_STATUS,
} from './content.js';
import {
  DEMON_ABILITY_IDS, DEMON_CASE_IDS, type DemonAcquisitionCommand, type DemonAction,
  type DemonBottle, type DemonCommand, type DemonProjection, type DemonState,
} from './types.js';

export function createDemonState(): DemonState {
  return {
    guidanceKnown: false,
    bottles: DEMON_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, serialKillerActingAtPromotion: null,
    cases: Object.fromEntries(DEMON_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { body: 'NORMAL', flame: 'NONE' }, strain: 0,
    threat: { active: false, noticed: false, verified: false, avoided: false },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'abyss' && (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isSerialKiller = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.criminal.discovered && s.criminal.guidanceKnown && s.unwinged.guidanceKnown && s.serialKiller.guidanceKnown && s.serialKiller.promotionWeek !== null && (isSerialKiller(s) || promoted(s));
const potionPrice = (bottle: DemonBottle) => DEMON_PRICES.potion - (bottle.labourSteps === 5 ? DEMON_PRICES.labourCredit : 0);
const bottleNumber = (bottle: DemonBottle) => Number(bottle.id.slice('demon-potion-'.length));
const serialKillerWeeks = (s: SliceState) => Math.max(0, (s.demon.promotionWeek ?? s.week) - (s.serialKiller.promotionWeek ?? s.week));
const supplyExhausted = (state: DemonState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${DEMON_GUIDE}的独立恶魔成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6恶魔魔药，原瓶demon-potion-${number}，非罪犯、折翼天使或连环杀手旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: DemonAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.demon.cases).some(value => value.contactOpen)) return '先实际结束本次恶魔实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原旧货库，找到罗安。';
  if (!knownChannel(s)) return '成为连环杀手并保有罗安的指导渠道后，才能继续了解恶魔之路。';
  if (promoted(s)) return '你已完成恶魔晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.demon.guidanceKnown) return '已经听过恶魔成品魔药的用药说明。';
    return s.cash < DEMON_PRICES.guidance ? '恶魔用药指导需要360便士。' : null;
  }
  if (!s.demon.guidanceKnown) return '先听罗安说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.demon.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.demon) ? null : '须先用完现有全部恶魔原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.demon.resupply.requestedWeek === null) return '尚未申请下一批恶魔补给。';
    if (s.week <= s.demon.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.demon) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.demon.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选恶魔原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `连环杀手魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.serialKiller.promotionWeek === null || serialKillerWeeks(s) < DEMON_MIN_SERIAL_KILLER_WEEKS) return `成为连环杀手后已度过${serialKillerWeeks(s)}/${DEMON_MIN_SERIAL_KILLER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原旧货库劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyDemonCommand(s: SliceState, command: DemonAcquisitionCommand, c: SeerContext): void {
  rule(validateDemonCommand(command) && isDemonAcquisitionCommand(command), '恶魔准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= DEMON_PRICES.guidance;
      s.demon.guidanceKnown = true;
      c.note('听取恶魔用药说明', `花费1行动、360便士，你向已认识的本作原创成年${DEMON_GUIDE}继续请教，他向你说明从独立恶魔成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的罪犯、折翼天使或连环杀手存药。${DEMON_FORMULA_STATUS}连环杀手消化须达100，晋升连环杀手后满12整周才能服用；可提前筹备。${DEMON_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.demon.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = DEMON_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在罗安的原旧货库实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.demon.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('恶魔原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原旧货库劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；连环杀手消化100且晋升连环杀手后满12整周时，再独立确认服药。${DEMON_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.demon.resupply.requestedWeek = s.week;
      c.note('申请下一批恶魔魔药', `现有恶魔原瓶全部耗尽且未晋升。你花费1行动，请${DEMON_GUIDE}从同一新渠道订下一批三瓶，并实际核验原旧货库的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.demon.bottles.length + 1;
      s.demon.resupply.deliveries += 1;
      for (let offset = 0; offset < DEMON_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.demon.bottles.push({ id: `demon-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.demon.resupply.requestedWeek = null;
      c.note('下一批恶魔原瓶到货', `第${s.week}周，罗安的独立恶魔成品交接渠道本作G成品供给第${s.demon.resupply.deliveries + 1}批三瓶实际到货，原瓶demon-potion-${firstNumber}至demon-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.demon.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.demon.serialKillerActingAtPromotion = s.progression.acting;
        s.demon.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of DEMON_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为恶魔', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。罪犯、折翼天使与连环杀手全部原能力及原ID掌握完整继承，只新增危险预感、恶魔化身体与有限火焰诅咒三项，从0掌握开始；连环杀手消化成果与连环杀手晋升周保留，恶魔扮演从0开始。灵性上限提高到80，当前灵性没有补满。不赠资源，欲望与恶意失控风险仍在；危急预感只在对方已经实际行动且将造成近期致命伤害时可能给出有限方向，不能知道计划细节，没有序列5欲望操纵。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了恶魔晋升' : '恶魔魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是连环杀手，消化与全部原有掌握保留，没有获得恶魔能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectDemon(s: SliceState): DemonProjection {
  const actions: DemonAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.desireApostle.demonActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: DemonAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.demon.guidanceKnown) add('learn-demon-guidance', '请罗安说明恶魔成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.demon.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${DEMON_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶恶魔魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.demon.resupply.requestedWeek !== null) add('receive-demon-supply', '确认下一批三瓶恶魔到货', `0行动 · 第${s.demon.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.demon)) add('request-demon-supply', '向罗安订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.demon.guidanceKnown) {
    for (const bottle of s.demon.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶恶魔魔药`, `0行动 · 独立确认 · 连环杀手消化${isPromoted ? s.demon.serialKillerActingAtPromotion : s.progression.acting}/100 · 晋升后${serialKillerWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.demon.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.demon.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '恶魔 · 序列6' : '恶魔之路', discovered: available,
    guidanceKnown: available && s.demon.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    strain: s.demon.strain,
    practice: { ...s.demon.practice },
    cases: [], environment: '', insideCase: Object.values(s.demon.cases).some(value => value.contactOpen),
    ...(available ? { story: DEMON_SOURCE_STATUS } : {}),
    supplies: available ? `${DEMON_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.demon.resupply.requestedWeek === null ? `已实际接收后续供给${s.demon.resupply.deliveries}批。` : `第${s.demon.resupply.requestedWeek}周提出请求，第${s.demon.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.demon.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 恶魔魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? DEMON_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `连环杀手消化成果${s.demon.serialKillerActingAtPromotion}/100已保留；恶魔扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成连环杀手消化（${s.progression.acting}/100），并在晋升连环杀手后度过12整周（${serialKillerWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完连环杀手之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${DEMON_CONSUMPTION_RISK}` : '成为连环杀手后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isDemonAcquisitionCommand(command: unknown): command is DemonAcquisitionCommand {
  return validateDemonCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateDemonCommand(value: unknown): value is DemonCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'COMPOSE', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^demon-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^demon-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'VERIFY', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && DEMON_CASE_IDS.includes(value.caseId as typeof DEMON_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && DEMON_CASE_IDS.includes(value.caseId as typeof DEMON_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateDemonState(s: SliceState): boolean {
  const raw: unknown = s.demon;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'serialKillerActingAtPromotion', 'cases', 'practice', 'strain', 'threat', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.criminal) || !record(s.unwinged) || !record(s.serialKiller)) return false;
  const firstSerialKillerWeek = s.serialKiller.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstSerialKillerWeek + DEMON_MIN_SERIAL_KILLER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== DEMON_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, DEMON_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'LANE_CLUE', 'VERIFY_FAILED', 'LANE_VERIFIED', 'BODY_VERIFIED', 'FLAME_VERIFIED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const demon = raw as unknown as DemonState, isPromoted = promoted(s);
  if (demon.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!demon.guidanceKnown || !integer(s.serialKiller.promotionWeek, 1, s.week) || !integer(demon.promotionWeek, firstConsumptionWeek, s.week) || demon.serialKillerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS, ...DEMON_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?DESIRE_APOSTLE_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DEVIL_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?BLATHERER_ABILITY_IDS:[]),...(s.progression.sequence===2?BLOOD_DUKE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (demon.promotionWeek !== null || demon.serialKillerActingAtPromotion !== null || DEMON_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (demon.reflected || Object.values(demon.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of demon.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `demon-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of demon.bottles.entries()) {
    let stockWeek = firstSerialKillerWeek;
    if (index < DEMON_BOTTLE_IDS.length) {
      if (bottle.source !== DEMON_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!demon.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / DEMON_BOTTLE_IDS.length) - 1;
      if (index % DEMON_BOTTLE_IDS.length === 0) {
        const previous = demon.bottles.slice(index - DEMON_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > demon.promotionWeek!) return false;
    }
    if (!demon.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > demon.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > demon.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== demon.promotionWeek) return false;
    }
  }
  if (demon.resupply.requestedWeek !== null && (!demon.guidanceKnown || isPromoted || !supplyExhausted(demon) || demon.bottles.some(bottle => bottle.consumedWeek! > demon.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = demon.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, demon.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'DEMON_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(demon.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.status !== 'ACTIVE' || s.activeEvent !== null || s.world.city !== 'BACKLUND' || Object.values(demon.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'demon-dispute').length;
  // This award belongs to the already resolved original encounter; a later real death does not erase that history.
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateDemonLife(s);
}

export { DEMON_ABILITIES } from './content.js';
export type * from './types.js';
