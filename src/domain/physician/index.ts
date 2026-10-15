import {COFFIN_BEARER_ABILITY_IDS} from '../coffin-bearer/types.js';
import {ANCIENT_ALCHEMIST_ABILITY_IDS} from '../ancient-alchemist/types.js';
import {DRUID_ABILITY_IDS} from '../druid/types.js';
import {BIOLOGIST_ABILITY_IDS} from '../biologist/types.js';
import {HARVESTPRIEST_ABILITY_IDS} from '../harvestpriest/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CULTIVATOR_ABILITY_IDS } from '../cultivator/types.js';
import {
  PHYSICIAN_ABILITIES, PHYSICIAN_BOTTLE_IDS, PHYSICIAN_CONSUMPTION_RISK, PHYSICIAN_FORMULA_STATUS,
  PHYSICIAN_GUIDE, PHYSICIAN_LABOUR_TASKS, PHYSICIAN_MIN_CULTIVATOR_WEEKS, PHYSICIAN_POTION_SOURCES, PHYSICIAN_PRICES, PHYSICIAN_SOURCE_STATUS,
} from './content.js';
import {
  PHYSICIAN_ABILITY_IDS, PHYSICIAN_CASE_IDS, type PhysicianAcquisitionCommand, type PhysicianAction,
  type PhysicianBottle, type PhysicianCommand, type PhysicianProjection, type PhysicianState,
} from './types.js';

export function createPhysicianState(): PhysicianState {
  return {
    guidanceKnown: false,
    bottles: PHYSICIAN_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, cultivatorActingAtPromotion: null,
    cases: Object.fromEntries(PHYSICIAN_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    reflected: false,
    clinic: { kitsBought: 0, dressings: 0, usedDressings: 0, patientHealth: 70, treated: false, referred: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'mother' && (s.progression.sequence === 8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))));
const isCultivator = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 9;
const knownChannel = (s: SliceState) => s.cultivator.discovered && s.cultivator.guidanceKnown && (isCultivator(s) || promoted(s));
const potionPrice = (bottle: PhysicianBottle) => PHYSICIAN_PRICES.potion - (bottle.labourSteps === 3 ? PHYSICIAN_PRICES.labourCredit : 0);
const bottleNumber = (bottle: PhysicianBottle) => Number(bottle.id.slice('physician-potion-'.length));
const cultivatorWeeks = (s: SliceState) => Math.max(0, (s.physician.promotionWeek ?? s.week) - (s.progression.promotionWeek ?? s.week));
const supplyExhausted = (state: PhysicianState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${PHYSICIAN_GUIDE}的新进阶成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列8医师魔药，原瓶physician-potion-${number}，非耕种者旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: PhysicianAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.cultivator.cases).some(value => value.contactOpen)) return '先实际结束耕种者阶段尚未结束的核对与交谈，再继续晋升。';
  if (Object.values(s.physician.cases).some(value => value.contactOpen)) return '先实际结束本次医师实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的小苗圃，找到伊芙·莫兰。';
  if (!knownChannel(s)) return '成为耕种者并保有伊芙·莫兰的指导渠道后，才能继续了解医师之路。';
  if (promoted(s)) return '你已完成医师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.physician.guidanceKnown) return '已经听过医师成品魔药的用药说明。';
    return s.cash < PHYSICIAN_PRICES.guidance ? '医师用药指导需要180便士。' : null;
  }
  if (!s.physician.guidanceKnown) return '先听伊芙·莫兰说明这批序列8原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.physician.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.physician) ? null : '须先用完现有全部医师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.physician.resupply.requestedWeek === null) return '尚未申请下一批医师补给。';
    if (s.week <= s.physician.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.physician) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.physician.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选医师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `耕种者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.progression.promotionWeek === null || cultivatorWeeks(s) < PHYSICIAN_MIN_CULTIVATOR_WEEKS) return `成为耕种者后已度过${cultivatorWeeks(s)}/${PHYSICIAN_MIN_CULTIVATOR_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 3 ? '这瓶对应的三次小苗圃劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyPhysicianCommand(s: SliceState, command: PhysicianAcquisitionCommand, c: SeerContext): void {
  rule(validatePhysicianCommand(command) && isPhysicianAcquisitionCommand(command), '医师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= PHYSICIAN_PRICES.guidance;
      s.physician.guidanceKnown = true;
      c.note('听取医师用药说明', `花费1行动、180便士，你向已认识的本作原创成年${PHYSICIAN_GUIDE}继续请教，她向你说明从新进阶成品交接渠道实际取得的三瓶序列8成品、逐瓶交付与四档风险。这些不是原来的耕种者存药。${PHYSICIAN_FORMULA_STATUS}耕种者消化须达100，首次晋升耕种者后满4整周才能服用；可提前筹备。${PHYSICIAN_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.physician.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = PHYSICIAN_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊芙·莫兰的小苗圃实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/3，原瓶仍由导师保管。${bottle.labourSteps === 3 ? '三次劳务只抵这瓶1050便士，仍须实际支付160便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应三次劳务后才能抵这瓶1050便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.physician.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('医师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列8成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 3 ? '对应三次小苗圃劳务抵扣1050便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；耕种者消化100且首次晋升后满4整周时，再独立确认服药。${PHYSICIAN_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.physician.resupply.requestedWeek = s.week;
      c.note('申请下一批医师魔药', `现有医师原瓶全部耗尽且未晋升。你花费1行动，请${PHYSICIAN_GUIDE}从同一新渠道订下一批三瓶，并实际核验小苗圃的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付1210便士，或分别完成三次劳务后支付160便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.physician.bottles.length + 1;
      s.physician.resupply.deliveries += 1;
      for (let offset = 0; offset < PHYSICIAN_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.physician.bottles.push({ id: `physician-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.physician.resupply.requestedWeek = null;
      c.note('下一批医师原瓶到货', `第${s.week}周，伊芙·莫兰的新进阶成品交接渠道本作G成品供给第${s.physician.resupply.deliveries + 1}批三瓶实际到货，原瓶physician-potion-${firstNumber}至physician-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按1210便士购买，或完成对应三次劳务再付160便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.physician.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 12);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.physician.cultivatorActingAtPromotion = s.progression.acting;
        s.physician.promotionWeek = s.week;
        s.progression.sequence = 8;
        s.progression.acting = 0;
        for (const id of PHYSICIAN_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为医师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。三项耕种者能力及原ID掌握完整继承，新增本作原创G的有限治疗与病况观察，两项均从0掌握开始；耕种者消化成果和首次晋升周保留，医师扮演从0开始。灵性上限提高到45，当前灵性没有补满。普通照料须消耗实有敷料，有限治疗须支付灵性，失败不返还成本；只处理本次已明确的轻微伤口。未知疲乏只记录不确定性，危险耳语须停止接触并转介，不以治疗消除污染、复活死者或提供现实处方。${PHYSICIAN_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了医师晋升' : '医师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是耕种者，消化与三项掌握保留，没有获得医师能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectPhysician(s: SliceState): PhysicianProjection {
  const actions: PhysicianAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? (s.progression.sequence===8?s.progression.acting:s.harvestpriest.physicianActingAtPromotion??0) : 0;
  const add = (id: string, label: string, cost: string, command: PhysicianAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.physician.guidanceKnown) add('learn-physician-guidance', '请伊芙·莫兰说明医师成品与风险', '1行动 · 180便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.physician.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 3) add(`work-${bottle.id}`, `第${number}瓶 · ${PHYSICIAN_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/3，完成三次抵该瓶1050便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶医师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列8原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.physician.resupply.requestedWeek !== null) add('receive-physician-supply', '确认下一批三瓶医师到货', `0行动 · 第${s.physician.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.physician)) add('request-physician-supply', '向伊芙·莫兰订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.physician.guidanceKnown) {
    for (const bottle of s.physician.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶医师魔药`, `0行动 · 独立确认 · 耕种者消化${isPromoted ? s.physician.cultivatorActingAtPromotion : s.progression.acting}/100 · 晋升后${cultivatorWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 12, modifiers: [] });
  const remaining = s.physician.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.physician.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '医师 · 序列8' : '医师之路', discovered: available,
    guidanceKnown: available && s.physician.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', clinic: '', insideCase: Object.values(s.physician.cases).some(value => value.contactOpen),
    ...(available ? { story: PHYSICIAN_SOURCE_STATUS } : {}),
    supplies: available ? `${PHYSICIAN_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.physician.resupply.requestedWeek === null ? `已实际接收后续供给${s.physician.resupply.deliveries}批。` : `第${s.physician.resupply.requestedWeek}周提出请求，第${s.physician.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.physician.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 医师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/3`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? PHYSICIAN_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `耕种者消化成果${s.physician.cultivatorActingAtPromotion}/100已保留；医师扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成耕种者消化（${s.progression.acting}/100），并在首次晋升耕种者后度过4整周（${cultivatorWeeks(s)}/4）。用药指导与原瓶可以提前准备。` : '先走完耕种者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应三次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${PHYSICIAN_CONSUMPTION_RISK}` : '成为耕种者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isPhysicianAcquisitionCommand(command: PhysicianCommand): command is PhysicianAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validatePhysicianCommand(value: unknown): value is PhysicianCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'BUY_KIT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^physician-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^physician-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && PHYSICIAN_CASE_IDS.includes(value.caseId as typeof PHYSICIAN_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && PHYSICIAN_CASE_IDS.includes(value.caseId as typeof PHYSICIAN_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validatePhysicianState(s: SliceState): boolean {
  const raw: unknown = s.physician;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'cultivatorActingAtPromotion', 'cases', 'reflected', 'clinic']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.cultivator)) return false;
  const firstCultivatorWeek = s.progression.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstCultivatorWeek + PHYSICIAN_MIN_CULTIVATOR_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== PHYSICIAN_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, PHYSICIAN_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'WOUND_IMPROVED', 'UNCERTAINTY_RECORDED', 'REFERRAL_ACCEPTED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  if (!record(raw.clinic) || !shape(raw.clinic, ['kitsBought', 'dressings', 'usedDressings', 'patientHealth', 'treated', 'referred'])) return false;
  if (!integer(raw.clinic.kitsBought, 0, Math.floor(Number.MAX_SAFE_INTEGER / 3)) || !integer(raw.clinic.dressings, 0, 3) || !integer(raw.clinic.usedDressings, 0)) return false;
  if ((raw.clinic.dressings as number) + (raw.clinic.usedDressings as number) !== (raw.clinic.kitsBought as number) * 3) return false;
  if (![70, 80, 90].includes(raw.clinic.patientHealth as number) || typeof raw.clinic.treated !== 'boolean' || typeof raw.clinic.referred !== 'boolean') return false;
  if (raw.clinic.treated !== ((raw.clinic.patientHealth as number) > 70)) return false;
  const physician = raw as unknown as PhysicianState, isPromoted = promoted(s);
  if (physician.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!physician.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !integer(physician.promotionWeek, firstConsumptionWeek, s.week) || physician.cultivatorActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS,...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))))?HARVESTPRIEST_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?BIOLOGIST_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?DRUID_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3)?ANCIENT_ALCHEMIST_ABILITY_IDS:[]),...(s.progression.sequence===3?COFFIN_BEARER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (physician.promotionWeek !== null || physician.cultivatorActingAtPromotion !== null || PHYSICIAN_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (physician.clinic.kitsBought !== 0 || physician.clinic.dressings !== 0 || physician.clinic.usedDressings !== 0 || physician.clinic.patientHealth !== 70 || physician.clinic.treated || physician.clinic.referred) return false;
    if (physician.reflected || Object.values(physician.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of physician.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `physician-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 3)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of physician.bottles.entries()) {
    let stockWeek = firstCultivatorWeek;
    if (index < PHYSICIAN_BOTTLE_IDS.length) {
      if (bottle.source !== PHYSICIAN_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!physician.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / PHYSICIAN_BOTTLE_IDS.length) - 1;
      if (index % PHYSICIAN_BOTTLE_IDS.length === 0) {
        const previous = physician.bottles.slice(index - PHYSICIAN_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > physician.promotionWeek!) return false;
    }
    if (!physician.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > physician.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > physician.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== physician.promotionWeek) return false;
    }
  }
  if (physician.resupply.requestedWeek !== null && (!physician.guidanceKnown || isPromoted || !supplyExhausted(physician) || physician.bottles.some(bottle => bottle.consumedWeek! > physician.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export type * from './types.js';
