import {SILENT_DISCIPLE_ABILITY_IDS} from '../silent-disciple/types.js';
import {PUPPET_ABILITY_IDS} from '../puppet/types.js';
import {WRAITH_ABILITY_IDS} from '../wraith/types.js';
import {ZOMBIE_ABILITY_IDS} from '../zombie/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRISONER_ABILITY_IDS } from '../prisoner/types.js';
import { MADMAN_ABILITY_IDS } from '../madman/types.js';
import {
  WEREWOLF_ABILITIES, WEREWOLF_BOTTLE_IDS, WEREWOLF_CONSUMPTION_RISK, WEREWOLF_FORMULA_STATUS,
  WEREWOLF_GUIDE, WEREWOLF_LABOUR_TASKS, WEREWOLF_MIN_MADMAN_WEEKS, WEREWOLF_MOON_EVENTS, WEREWOLF_POTION_SOURCES, WEREWOLF_PRICES, WEREWOLF_SOURCE_STATUS,
} from './content.js';
import {
  WEREWOLF_ABILITY_IDS, WEREWOLF_CASE_IDS, type WerewolfAcquisitionCommand, type WerewolfAction,
  type WerewolfBottle, type WerewolfCommand, type WerewolfProjection, type WerewolfState,
} from './types.js';

export function createWerewolfState(): WerewolfState {
  return {
    guidanceKnown: false,
    bottles: WEREWOLF_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, madmanActingAtPromotion: null,
    cases: Object.fromEntries(WEREWOLF_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', sceneOpen: false, returns: 0 }])),
    reflected: false,
    moon: { pendingWeek: null, history: [] },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'chained' && (s.progression.sequence === 7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))));
const isMadman = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.prisoner.discovered && s.prisoner.guidanceKnown && s.madman.guidanceKnown && (isMadman(s) || promoted(s));
const potionPrice = (bottle: WerewolfBottle) => WEREWOLF_PRICES.potion - (bottle.labourSteps === 4 ? WEREWOLF_PRICES.labourCredit : 0);
const bottleNumber = (bottle: WerewolfBottle) => Number(bottle.id.slice('werewolf-potion-'.length));
const madmanWeeks = (s: SliceState) => Math.max(0, (s.werewolf.promotionWeek ?? s.week) - (s.madman.promotionWeek ?? s.week));
const supplyExhausted = (state: WerewolfState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${WEREWOLF_GUIDE}的独立狼人成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列7狼人魔药，原瓶werewolf-potion-${number}，非囚犯或疯子旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: WerewolfAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.prisoner.cases).some(value => value.holding)) return '先实际归还囚犯阶段原木垫块PR9-STOP-01，再继续晋升。';
  if (Object.values(s.madman.cases).some(value => value.burstOpen)) return '先实际停止并结束疯子阶段尚未收束的实践。';
  if (Object.values(s.werewolf.cases).some(value => value.sceneOpen)) return '先实际返回，结束狼人阶段尚未退出的实践现场。';
  if (s.werewolf.moon.pendingWeek !== null) return '先实际处理本次月圆发作，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的旧工坊，找到哈伦·维斯。';
  if (!knownChannel(s)) return '成为疯子并保有哈伦·维斯的指导渠道后，才能继续了解狼人之路。';
  if (promoted(s)) return '你已完成狼人晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.werewolf.guidanceKnown) return '已经听过狼人成品魔药的用药说明。';
    return s.cash < WEREWOLF_PRICES.guidance ? '狼人用药指导需要240便士。' : null;
  }
  if (!s.werewolf.guidanceKnown) return '先听哈伦·维斯说明这批序列7原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.werewolf.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.werewolf) ? null : '须先用完现有全部狼人原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.werewolf.resupply.requestedWeek === null) return '尚未申请下一批狼人补给。';
    if (s.week <= s.werewolf.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.werewolf) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.werewolf.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选狼人原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `疯子魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.madman.promotionWeek === null || madmanWeeks(s) < WEREWOLF_MIN_MADMAN_WEEKS) return `成为疯子后已度过${madmanWeeks(s)}/${WEREWOLF_MIN_MADMAN_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 4 ? '这瓶对应的四次旧工坊劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyWerewolfCommand(s: SliceState, command: WerewolfAcquisitionCommand, c: SeerContext): void {
  rule(validateWerewolfCommand(command) && isWerewolfAcquisitionCommand(command), '狼人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= WEREWOLF_PRICES.guidance;
      s.werewolf.guidanceKnown = true;
      c.note('听取狼人用药说明', `花费1行动、240便士，通过已有疯子渠道，你再次找到原创成年${WEREWOLF_GUIDE}，他向你说明从独立狼人成品交接渠道实际取得的三瓶序列7成品、逐瓶交付与四档风险。这些不是原来的囚犯或疯子存药。晋升将带来狼人身体变化与每月满月诅咒：失去大部分理智、长出黑毛、强烈嗜血；节制或消化不能免除。${WEREWOLF_FORMULA_STATUS}疯子消化须达100，晋升疯子后满8整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.werewolf.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = WEREWOLF_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在哈伦·维斯的旧工坊实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/4，原瓶仍由导师保管。${bottle.labourSteps === 4 ? '四次劳务只抵这瓶1800便士，仍须实际支付210便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应四次劳务后才能抵这瓶1800便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.werewolf.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('狼人原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列7成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 4 ? '对应四次旧工坊劳务抵扣1800便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；疯子消化100且晋升疯子后满8整周时，再独立确认服药。${WEREWOLF_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.werewolf.resupply.requestedWeek = s.week;
      c.note('申请下一批狼人魔药', `现有狼人原瓶全部耗尽且未晋升。你花费1行动，请${WEREWOLF_GUIDE}从同一新渠道订下一批三瓶，并实际核验旧工坊的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付2010便士，或分别完成四次劳务后支付210便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.werewolf.bottles.length + 1;
      s.werewolf.resupply.deliveries += 1;
      for (let offset = 0; offset < WEREWOLF_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.werewolf.bottles.push({ id: `werewolf-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.werewolf.resupply.requestedWeek = null;
      c.note('下一批狼人原瓶到货', `第${s.week}周，哈伦·维斯的独立狼人成品交接渠道本作G成品供给第${s.werewolf.resupply.deliveries + 1}批三瓶实际到货，原瓶werewolf-potion-${firstNumber}至werewolf-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按2010便士购买，或完成对应四次劳务再付210便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.werewolf.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.werewolf.madmanActingAtPromotion = s.progression.acting;
        s.werewolf.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of WEREWOLF_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 1], ['knowledge', 0]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为狼人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+1、意志+1、知识+0。三项囚犯与两项疯子能力及其原ID掌握完整继承，仅新增狼人身体、强大愈合力和有毒爪牙三项掌握从0开始。身体变化与每月满月诅咒保留：满月时失去大部分理智、长出黑毛与强烈嗜血，节制或消化不能免除。不自动获得未核黑暗法术、活尸钢铁身体或怨魂附身；疯子消化成果和晋升周保留，狼人扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了狼人晋升' : '狼人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是疯子，原有消化与掌握保留，不会提前获得狼人身体能力或月圆处理记录。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectWerewolf(s: SliceState): WerewolfProjection {
  const actions: WerewolfAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: WerewolfAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.werewolf.guidanceKnown) add('learn-werewolf-guidance', '请哈伦·维斯说明狼人成品与风险', '1行动 · 240便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.werewolf.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 4) add(`work-${bottle.id}`, `第${number}瓶 · ${WEREWOLF_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/4，完成四次抵该瓶1800便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶狼人魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列7原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.werewolf.resupply.requestedWeek !== null) add('receive-werewolf-supply', '确认下一批三瓶狼人到货', `0行动 · 第${s.werewolf.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.werewolf)) add('request-werewolf-supply', '向哈伦·维斯订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.werewolf.guidanceKnown) {
    for (const bottle of s.werewolf.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶狼人魔药`, `0行动 · 独立确认 · 狼人身体变化 · 每月满月诅咒不能消除 · 进阶排异风险 · 疯子消化${isPromoted ? s.werewolf.madmanActingAtPromotion : s.progression.acting}/100 · 晋升后${madmanWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.werewolf.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.werewolf.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  const nextMoon = WEREWOLF_MOON_EVENTS.find(event => event.week >= s.week && !s.werewolf.moon.history.some(entry => entry.week === event.week));
  return {
    title: isPromoted ? '狼人 · 序列7' : '狼人之路', discovered: available,
    guidanceKnown: available && s.werewolf.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    cases: [], environment: '', insideCase: Object.values(s.werewolf.cases).some(value => value.sceneOpen) || s.werewolf.moon.pendingWeek !== null,
    moon: { pending: s.werewolf.moon.pendingWeek !== null, summary: (s.progression.sequence===4||s.progression.sequence===3)?'旧狼人记录保留，当前木偶4具体原诅咒未核；仅执行木偶页另行明确的有限G公告，不叠加旧发作。':s.progression.sequence===5?'旧狼人月相记录保留。当前适用怨魂虚弱，不叠加旧狼人或活尸诅咒。':s.progression.sequence===6?'旧狼人月相记录保留。当前适用活尸的新诅咒，请在活尸面板查看；不重复施加狼人发作。':available ? `狼人满月诅咒不能靠节制或消化消除。${nextMoon ? `下一场已登记告示：第${nextMoon.week}周「${nextMoon.title}」，来源：${nextMoon.source}。` : '本阶段八场已登记告示已过；后续月相事件尚未展开，不代表诅咒消失。'}这是提前公示的有限本作G事件，不是原著月历，不按四周自动推算。` : '', history: s.werewolf.moon.history.map(entry => ({ ...entry })) },
    ...(available ? { story: WEREWOLF_SOURCE_STATUS } : {}),
    supplies: available ? `${WEREWOLF_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.werewolf.resupply.requestedWeek === null ? `已实际接收后续供给${s.werewolf.resupply.deliveries}批。` : `第${s.werewolf.resupply.requestedWeek}周提出请求，第${s.werewolf.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.werewolf.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 狼人魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/4`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? WEREWOLF_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?s.zombie.werewolfActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?'狼人魔药已消化，原现场与月相记录保留；活尸新诅咒取代旧诅咒。':isPromoted ? `疯子消化成果${s.werewolf.madmanActingAtPromotion}/100已保留；狼人扮演${s.progression.acting}/100，能力掌握分别记录；狼人身体变化与满月诅咒仍保留，本作G节制与不伤害他人的成长不保证免除诅咒。`
      : available ? `服药前需完成疯子消化（${s.progression.acting}/100），并在晋升疯子后度过8整周（${madmanWeeks(s)}/8）。用药指导与原瓶可以提前准备。` : '先走完疯子之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应四次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${WEREWOLF_CONSUMPTION_RISK}` : '成为疯子后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isWerewolfAcquisitionCommand(command: unknown): command is WerewolfAcquisitionCommand {
  return validateWerewolfCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateWerewolfCommand(value: unknown): value is WerewolfCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^werewolf-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^werewolf-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'RETURN', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && WEREWOLF_CASE_IDS.includes(value.caseId as typeof WEREWOLF_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && WEREWOLF_CASE_IDS.includes(value.caseId as typeof WEREWOLF_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  if (value.type === 'HANDLE_MOON') return shape(value, ['type', 'method']) && ['GUARDED', 'ALONE'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions and actual return; life hooks own monthly scheduling. */
export function validateWerewolfState(s: SliceState): boolean {
  const raw: unknown = s.werewolf;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'madmanActingAtPromotion', 'cases', 'reflected', 'moon']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.prisoner) || !record(s.madman)) return false;
  const firstMadmanWeek = s.madman.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstMadmanWeek + WEREWOLF_MIN_MADMAN_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== WEREWOLF_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, WEREWOLF_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'sceneOpen', 'returns'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'RECOVERY_RECORDED', 'MARK_CONTAINED', 'ROUTE_CHECKED'].includes(value.outcome as string)) return false;
    if (typeof value.sceneOpen !== 'boolean' || !integer(value.returns, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  if (!record(raw.moon) || !shape(raw.moon, ['pendingWeek', 'history']) || !Array.isArray(raw.moon.history)) return false;
  const moonWeeks = new Set<number>();
  for (const entry of raw.moon.history) {
    if (!record(entry) || !shape(entry, ['week', 'method', 'mentalCost'])) return false;
    if (!integer(entry.week, 1, s.week) || !WEREWOLF_MOON_EVENTS.some(event => event.week === entry.week) || moonWeeks.has(entry.week as number)) return false;
    if (!['GUARDED', 'ALONE'].includes(entry.method as string) || !integer(entry.mentalCost, 0, entry.method === 'GUARDED' ? 10 : 20)) return false;
    moonWeeks.add(entry.week as number);
  }
  const pendingMoonWeek = raw.moon.pendingWeek;
  if (pendingMoonWeek !== null && (s.progression.sequence!==7||!promoted(s) || !integer(pendingMoonWeek, 1, s.week) || pendingMoonWeek !== s.week || !WEREWOLF_MOON_EVENTS.some(event => event.week === pendingMoonWeek) || moonWeeks.has(pendingMoonWeek as number))) return false;
  const werewolf = raw as unknown as WerewolfState, isPromoted = promoted(s);
  if (werewolf.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!werewolf.guidanceKnown || !integer(s.madman.promotionWeek, 1, s.week) || !integer(werewolf.promotionWeek, firstConsumptionWeek, s.week) || werewolf.madmanActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS, ...WEREWOLF_ABILITY_IDS,...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))?ZOMBIE_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))?WRAITH_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3)?PUPPET_ABILITY_IDS:[]),...(s.progression.sequence===3?SILENT_DISCIPLE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (werewolf.moon.history.length !== 0 || werewolf.moon.pendingWeek !== null) return false;
    if (werewolf.promotionWeek !== null || werewolf.madmanActingAtPromotion !== null || WEREWOLF_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (werewolf.reflected || Object.values(werewolf.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.sceneOpen || value.returns !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of werewolf.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `werewolf-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 4)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of werewolf.bottles.entries()) {
    let stockWeek = firstMadmanWeek;
    if (index < WEREWOLF_BOTTLE_IDS.length) {
      if (bottle.source !== WEREWOLF_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!werewolf.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / WEREWOLF_BOTTLE_IDS.length) - 1;
      if (index % WEREWOLF_BOTTLE_IDS.length === 0) {
        const previous = werewolf.bottles.slice(index - WEREWOLF_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > werewolf.promotionWeek!) return false;
    }
    if (!werewolf.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > werewolf.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > werewolf.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== werewolf.promotionWeek) return false;
    }
  }
  if (werewolf.resupply.requestedWeek !== null && (!werewolf.guidanceKnown || isPromoted || !supplyExhausted(werewolf) || werewolf.bottles.some(bottle => bottle.consumedWeek! > werewolf.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { WEREWOLF_ABILITIES } from './content.js';
export type * from './types.js';
