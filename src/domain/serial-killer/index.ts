import { BLOOD_DUKE_ABILITY_IDS } from '../blood-duke/types.js';
import {BLATHERER_ABILITY_IDS} from '../blatherer/types.js';
import {DEVIL_ABILITY_IDS} from '../devil/types.js';
import {DESIRE_APOSTLE_ABILITY_IDS} from '../desire-apostle/types.js';
import {DEMON_ABILITY_IDS} from '../demon/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CRIMINAL_ABILITY_IDS } from '../criminal/types.js';
import { UNWINGED_ABILITY_IDS } from '../unwinged/types.js';
import {
  SERIAL_KILLER_ABILITIES, SERIAL_KILLER_BOTTLE_IDS, SERIAL_KILLER_CONSUMPTION_RISK, SERIAL_KILLER_FORMULA_STATUS,
  SERIAL_KILLER_GUIDE, SERIAL_KILLER_LABOUR_TASKS, SERIAL_KILLER_MIN_UNWINGED_WEEKS, SERIAL_KILLER_POTION_SOURCES, SERIAL_KILLER_PRICES, SERIAL_KILLER_SOURCE_STATUS,
} from './content.js';
import {
  SERIAL_KILLER_ABILITY_IDS, SERIAL_KILLER_CASE_IDS, type SerialKillerAcquisitionCommand, type SerialKillerAction,
  type SerialKillerBottle, type SerialKillerCommand, type SerialKillerProjection, type SerialKillerState,
} from './types.js';

export function createSerialKillerState(): SerialKillerState {
  return {
    guidanceKnown: false,
    bottles: SERIAL_KILLER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, unwingedActingAtPromotion: null,
    cases: Object.fromEntries(SERIAL_KILLER_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closures: 0, overclaims: 0 }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'abyss' && (s.progression.sequence === 7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const isUnwinged = (s: SliceState) => s.progression.pathwayId === 'abyss' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.criminal.discovered && s.criminal.guidanceKnown && s.unwinged.guidanceKnown && s.unwinged.conscienceLost === true && (isUnwinged(s) || promoted(s));
const potionPrice = (bottle: SerialKillerBottle) => SERIAL_KILLER_PRICES.potion - (bottle.labourSteps === 4 ? SERIAL_KILLER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: SerialKillerBottle) => Number(bottle.id.slice('serial-killer-potion-'.length));
const unwingedWeeks = (s: SliceState) => Math.max(0, (s.serialKiller.promotionWeek ?? s.week) - (s.unwinged.promotionWeek ?? s.week));
const supplyExhausted = (state: SerialKillerState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SERIAL_KILLER_GUIDE}的独立连环杀手成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列7连环杀手魔药，原瓶serial-killer-potion-${number}，非罪犯或折翼天使旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: SerialKillerAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.criminal.cases).some(value => value.holding)) return '先实际归还罪犯阶段原工钱袋，再继续晋升。';
  if (Object.values(s.unwinged.cases).some(value => value.urgeOpen)) return '先实际停手，结束折翼天使阶段尚未处理的恶欲冲动。';
  if (Object.values(s.serialKiller.cases).some(value => value.contactOpen)) return '先实际关闭连环杀手阶段尚未结束的仪式接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的旧货库，找到罗安·费里。';
  if (!knownChannel(s)) return '成为折翼天使并保有罗安·费里的指导渠道后，才能继续了解连环杀手之路。';
  if (promoted(s)) return '你已完成连环杀手晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.serialKiller.guidanceKnown) return '已经听过连环杀手成品魔药的用药说明。';
    return s.cash < SERIAL_KILLER_PRICES.guidance ? '连环杀手用药指导需要240便士。' : null;
  }
  if (!s.serialKiller.guidanceKnown) return '先听罗安·费里说明这批序列7原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.serialKiller.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.serialKiller) ? null : '须先用完现有全部连环杀手原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.serialKiller.resupply.requestedWeek === null) return '尚未申请下一批连环杀手补给。';
    if (s.week <= s.serialKiller.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.serialKiller) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.serialKiller.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选连环杀手原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `折翼天使魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.unwinged.promotionWeek === null || unwingedWeeks(s) < SERIAL_KILLER_MIN_UNWINGED_WEEKS) return `成为折翼天使后已度过${unwingedWeeks(s)}/${SERIAL_KILLER_MIN_UNWINGED_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 4 ? '这瓶对应的四次旧货库劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applySerialKillerCommand(s: SliceState, command: SerialKillerAcquisitionCommand, c: SeerContext): void {
  rule(validateSerialKillerCommand(command) && isSerialKillerAcquisitionCommand(command), '连环杀手准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SERIAL_KILLER_PRICES.guidance;
      s.serialKiller.guidanceKnown = true;
      c.note('听取连环杀手用药说明', `花费1行动、240便士，通过已有折翼天使渠道，你再次找到原创成年${SERIAL_KILLER_GUIDE}，他向你说明从独立连环杀手成品交接渠道实际取得的三瓶序列7成品、逐瓶交付与四档风险。这些不是原来的罪犯或折翼天使存药。角色已经失去原有良知的事实不会恢复；此次进阶仍有排异与后续接触风险。${SERIAL_KILLER_FORMULA_STATUS}折翼天使消化须达100，晋升折翼天使后满8整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.serialKiller.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = SERIAL_KILLER_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在罗安·费里的旧货库实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/4，原瓶仍由导师保管。${bottle.labourSteps === 4 ? '四次劳务只抵这瓶1800便士，仍须实际支付210便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应四次劳务后才能抵这瓶1800便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.serialKiller.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('连环杀手原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列7成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 4 ? '对应四次旧货库劳务抵扣1800便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；折翼天使消化100且晋升折翼天使后满8整周时，再独立确认服药。${SERIAL_KILLER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.serialKiller.resupply.requestedWeek = s.week;
      c.note('申请下一批连环杀手魔药', `现有连环杀手原瓶全部耗尽且未晋升。你花费1行动，请${SERIAL_KILLER_GUIDE}从同一新渠道订下一批三瓶，并实际核验旧货库的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付2010便士，或分别完成四次劳务后支付210便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.serialKiller.bottles.length + 1;
      s.serialKiller.resupply.deliveries += 1;
      for (let offset = 0; offset < SERIAL_KILLER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.serialKiller.bottles.push({ id: `serial-killer-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.serialKiller.resupply.requestedWeek = null;
      c.note('下一批连环杀手原瓶到货', `第${s.week}周，罗安·费里的独立连环杀手成品交接渠道本作G成品供给第${s.serialKiller.resupply.deliveries + 1}批三瓶实际到货，原瓶serial-killer-potion-${firstNumber}至serial-killer-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按2010便士购买，或完成对应四次劳务再付210便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.serialKiller.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.serialKiller.unwingedActingAtPromotion = s.progression.acting;
        s.serialKiller.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of SERIAL_KILLER_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 2]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为连环杀手', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+2。三项罪犯能力与折翼天使非人身体及其原ID掌握完整继承，仅新增恶魔知识与仪式实践两项掌握从0开始；角色已经失去原有良知的事实与恶欲风险永久保留，不恢复良知，也没有新增身体变化。不自动获得具体战斗法术、危险预知或欲望操纵；折翼天使消化成果和晋升周保留，连环杀手扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了连环杀手晋升' : '连环杀手魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是折翼天使，原有消化与掌握保留，已经失去原有良知的事实与恶欲风险也保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectSerialKiller(s: SliceState): SerialKillerProjection {
  const actions: SerialKillerAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: SerialKillerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.serialKiller.guidanceKnown) add('learn-serial-killer-guidance', '请罗安·费里说明连环杀手成品与风险', '1行动 · 240便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.serialKiller.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 4) add(`work-${bottle.id}`, `第${number}瓶 · ${SERIAL_KILLER_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/4，完成四次抵该瓶1800便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶连环杀手魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列7原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.serialKiller.resupply.requestedWeek !== null) add('receive-serial-killer-supply', '确认下一批三瓶连环杀手到货', `0行动 · 第${s.serialKiller.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.serialKiller)) add('request-serial-killer-supply', '向罗安·费里订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.serialKiller.guidanceKnown) {
    for (const bottle of s.serialKiller.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶连环杀手魔药`, `0行动 · 独立确认 · 良知丧失保留 · 进阶排异风险 · 折翼天使消化${isPromoted ? s.serialKiller.unwingedActingAtPromotion : s.progression.acting}/100 · 晋升后${unwingedWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.serialKiller.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.serialKiller.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '连环杀手 · 序列7' : '连环杀手之路', discovered: available,
    guidanceKnown: available && s.serialKiller.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: Object.values(s.serialKiller.cases).some(value => value.contactOpen),
    ...(available ? { story: SERIAL_KILLER_SOURCE_STATUS } : {}),
    supplies: available ? `${SERIAL_KILLER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.serialKiller.resupply.requestedWeek === null ? `已实际接收后续供给${s.serialKiller.resupply.deliveries}批。` : `第${s.serialKiller.resupply.requestedWeek}周提出请求，第${s.serialKiller.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.serialKiller.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 连环杀手魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/4`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SERIAL_KILLER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?s.demon.serialKillerActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?'连环杀手魔药已消化，原仪式与有限调查经历保留。':isPromoted ? `折翼天使消化成果${s.serialKiller.unwingedActingAtPromotion}/100已保留；连环杀手扮演${s.progression.acting}/100，能力掌握分别记录；良知丧失仍保留，本作G学习与约束不保证原著无害消化。`
      : available ? `服药前需完成折翼天使消化（${s.progression.acting}/100），并在晋升折翼天使后度过8整周（${unwingedWeeks(s)}/8）。用药指导与原瓶可以提前准备。` : '先走完折翼天使之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应四次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${SERIAL_KILLER_CONSUMPTION_RISK}` : '成为折翼天使后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isSerialKillerAcquisitionCommand(command: unknown): command is SerialKillerAcquisitionCommand {
  return validateSerialKillerCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateSerialKillerCommand(value: unknown): value is SerialKillerCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^serial-killer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^serial-killer-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SERIAL_KILLER_CASE_IDS.includes(value.caseId as typeof SERIAL_KILLER_CASE_IDS[number]);
  if (value.type === 'REPORT') return shape(value, ['type', 'caseId', 'claim']) && SERIAL_KILLER_CASE_IDS.includes(value.caseId as typeof SERIAL_KILLER_CASE_IDS[number]) && ['LIMITED', 'CERTAIN'].includes(value.claim as string);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && SERIAL_KILLER_CASE_IDS.includes(value.caseId as typeof SERIAL_KILLER_CASE_IDS[number]) && ['RITUAL', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions and actual contact closure. */
export function validateSerialKillerState(s: SliceState): boolean {
  const raw: unknown = s.serialKiller;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'unwingedActingAtPromotion', 'cases', 'reflected']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.criminal) || !record(s.unwinged)) return false;
  const firstUnwingedWeek = s.unwinged.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstUnwingedWeek + SERIAL_KILLER_MIN_UNWINGED_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SERIAL_KILLER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, SERIAL_KILLER_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closures', 'overclaims'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['RITUAL', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'CATALOGUED', 'CIRCLE_CLOSED', 'DEDICATION_CORRECTED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closures, 0) || !integer(value.overclaims, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const serialKiller = raw as unknown as SerialKillerState, isPromoted = promoted(s);
  if (serialKiller.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!serialKiller.guidanceKnown || !integer(s.unwinged.promotionWeek, 1, s.week) || !integer(serialKiller.promotionWeek, firstConsumptionWeek, s.week) || serialKiller.unwingedActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS,...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?DEMON_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?DESIRE_APOSTLE_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DEVIL_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?BLATHERER_ABILITY_IDS:[]),...(s.progression.sequence===2?BLOOD_DUKE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (serialKiller.promotionWeek !== null || serialKiller.unwingedActingAtPromotion !== null || SERIAL_KILLER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (serialKiller.reflected || Object.values(serialKiller.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closures !== 0 || value.overclaims !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of serialKiller.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `serial-killer-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 4)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of serialKiller.bottles.entries()) {
    let stockWeek = firstUnwingedWeek;
    if (index < SERIAL_KILLER_BOTTLE_IDS.length) {
      if (bottle.source !== SERIAL_KILLER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!serialKiller.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SERIAL_KILLER_BOTTLE_IDS.length) - 1;
      if (index % SERIAL_KILLER_BOTTLE_IDS.length === 0) {
        const previous = serialKiller.bottles.slice(index - SERIAL_KILLER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > serialKiller.promotionWeek!) return false;
    }
    if (!serialKiller.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > serialKiller.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > serialKiller.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== serialKiller.promotionWeek) return false;
    }
  }
  if (serialKiller.resupply.requestedWeek !== null && (!serialKiller.guidanceKnown || isPromoted || !supplyExhausted(serialKiller) || serialKiller.bottles.some(bottle => bottle.consumedWeek! > serialKiller.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { SERIAL_KILLER_ABILITIES } from './content.js';
export type * from './types.js';
