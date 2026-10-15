import { ANCIENT_EVIL_ABILITY_IDS } from '../ancient-evil/types.js';
import {SILENT_DISCIPLE_ABILITY_IDS} from '../silent-disciple/types.js';
import {PUPPET_ABILITY_IDS} from '../puppet/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRISONER_ABILITY_IDS } from '../prisoner/types.js';
import { MADMAN_ABILITY_IDS } from '../madman/types.js';
import { WEREWOLF_ABILITY_IDS } from '../werewolf/types.js';
import { ZOMBIE_ABILITY_IDS } from '../zombie/types.js';
import { wraithInside, validateWraithLife } from './life.js';
import { zombieInside } from '../zombie/life.js';
import { WEREWOLF_MOON_EVENTS } from '../werewolf/content.js';
import { validateWraithEncounter } from './encounter.js';
import {
  WRAITH_ABILITIES, WRAITH_BOTTLE_IDS, WRAITH_CONSUMPTION_RISK, WRAITH_FORMULA_STATUS,
  WRAITH_GUIDE, WRAITH_LABOUR_TASKS, WRAITH_MIN_ZOMBIE_WEEKS, WRAITH_POTION_SOURCES, WRAITH_PRICES, WRAITH_SOURCE_STATUS,
} from './content.js';
import {
  WRAITH_ABILITY_IDS, WRAITH_CASE_IDS, type WraithAcquisitionCommand, type WraithAction,
  type WraithBottle, type WraithCommand, type WraithPractice, type WraithProjection, type WraithState,
} from './types.js';

export function freshWraithPractice(): WraithPractice {
  return { form: 'HUMAN', node: 'ROOM', mirror: 'COVERED', host: 'SELF', flag: 'TABLE', note: 'BLANK' };
}

export function createWraithState(): WraithState {
  return {
    guidanceKnown: false,
    bottles: WRAITH_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, zombieActingAtPromotion: null,
    cases: Object.fromEntries(WRAITH_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: freshWraithPractice(),
    moon: { pendingWeek: null, history: [] },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, lastPossessionRound: null, staggerReady: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'chained' && [5, 4, 3, 2].includes(s.progression.sequence!);
const isZombie = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.prisoner.discovered && s.prisoner.guidanceKnown && s.madman.guidanceKnown && s.werewolf.guidanceKnown && s.zombie.guidanceKnown && s.zombie.promotionWeek !== null && (isZombie(s) || promoted(s));
const potionPrice = (bottle: WraithBottle) => WRAITH_PRICES.potion - (bottle.labourSteps === 5 ? WRAITH_PRICES.labourCredit : 0);
const bottleNumber = (bottle: WraithBottle) => Number(bottle.id.slice('wraith-potion-'.length));
const zombieWeeks = (s: SliceState) => Math.max(0, (s.wraith.promotionWeek ?? s.week) - (s.zombie.promotionWeek ?? s.week));
const inheritedContactOpen = (s: SliceState) => zombieInside(s) || s.zombie.practice.body !== 'NORMAL' || s.zombie.practice.cold === 'ICED' || s.zombie.practice.spirit === 'PRESENT'
  || s.werewolf.moon.pendingWeek !== null || Object.values(s.werewolf.cases).some(value => value.sceneOpen)
  || Object.values(s.madman.cases).some(value => value.burstOpen) || Object.values(s.prisoner.cases).some(value => value.holding);
const supplyExhausted = (state: WraithState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${WRAITH_GUIDE}的独立怨魂成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5怨魂魔药，原瓶wraith-potion-${number}，非囚犯、疯子、狼人或活尸旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: WraithAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.wraith.moon.pendingWeek !== null || s.zombie.moon.pendingWeek !== null || s.werewolf.moon.pendingWeek !== null) return '先实际度过当前月圆发作，再继续怨魂准备或晋升。';
  if (wraithInside(s) || inheritedContactOpen(s)) return '先实际结束当前训练实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原旧工坊，找到哈伦·维斯。';
  if (!knownChannel(s)) return '成为活尸并保有哈伦·维斯的指导渠道后，才能继续了解怨魂之路。';
  if (promoted(s)) return '你已完成怨魂晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.wraith.guidanceKnown) return '已经听过怨魂成品魔药的用药说明。';
    return s.cash < WRAITH_PRICES.guidance ? '怨魂用药指导需要460便士。' : null;
  }
  if (!s.wraith.guidanceKnown) return '先听哈伦·维斯说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.wraith.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.wraith) ? null : '须先用完现有全部怨魂原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.wraith.resupply.requestedWeek === null) return '尚未申请下一批怨魂补给。';
    if (s.week <= s.wraith.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.wraith) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.wraith.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选怨魂原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting !== 100) return `活尸魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.zombie.promotionWeek === null || zombieWeeks(s) < WRAITH_MIN_ZOMBIE_WEEKS) return `成为活尸后已度过${zombieWeeks(s)}/${WRAITH_MIN_ZOMBIE_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原旧工坊劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyWraithCommand(s: SliceState, command: WraithAcquisitionCommand, c: SeerContext): void {
  rule(validateWraithCommand(command) && isWraithAcquisitionCommand(command), '怨魂准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= WRAITH_PRICES.guidance;
      s.wraith.guidanceKnown = true;
      c.note('听取怨魂用药说明', `花费1行动、460便士，你向已认识的本作原创成年${WRAITH_GUIDE}继续请教，导师向你说明从独立怨魂成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原旧工坊安静场地与在场照护安排。这些不是原来的囚犯、疯子、狼人或活尸存药。${WRAITH_FORMULA_STATUS}活尸消化须达100，晋升活尸后满12整周才能服用；可提前筹备。${WRAITH_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.wraith.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = WRAITH_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在哈伦·维斯的原旧工坊实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.wraith.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('怨魂原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原旧工坊劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；活尸消化100且晋升活尸后满12整周时，再独立确认服药。${WRAITH_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.wraith.resupply.requestedWeek = s.week;
      c.note('申请下一批怨魂魔药', `现有怨魂原瓶全部耗尽且未晋升。你花费1行动，请${WRAITH_GUIDE}从同一新渠道订下一批三瓶，并实际核验原旧工坊的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.wraith.bottles.length + 1;
      s.wraith.resupply.deliveries += 1;
      for (let offset = 0; offset < WRAITH_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.wraith.bottles.push({ id: `wraith-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.wraith.resupply.requestedWeek = null;
      c.note('下一批怨魂原瓶到货', `第${s.week}周，哈伦·维斯的独立怨魂成品交接渠道本作G成品供给第${s.wraith.resupply.deliveries + 1}批三瓶实际到货，原瓶wraith-potion-${firstNumber}至wraith-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.wraith.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次怨魂服药准备', `原成年${WRAITH_GUIDE}在原旧工坊实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.wraith.zombieActingAtPromotion = s.progression.acting;
        s.wraith.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of WRAITH_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为怨魂', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。囚犯、疯子、狼人和活尸全部原能力及原ID掌握完整继承，仅新增chained.s5.reflection-step与chained.s5.spirit-possession两项，从0掌握开始；活尸消化成果、原晋升周、原瓶、已完成实践、原物交接、亡者协助、已解决敌人与旧月相记录均保持原样，怨魂扮演从0开始。灵性上限提高到100，当前灵性没有补满。本体在实际练习中才能转为怨魂，不在起点另留身体；镜面移动需要真实反射面，附身可失败、可被排斥且必须实际退出，不读记忆或永久操控。满月极端虚弱取代活尸剧痛与狼人嗜血，旧历史保留，同一场不重复结算；必须实际度过已公告发作，消化与和平实践不能保证治愈诅咒。没有序列4木偶器物操控、纸人联系或诅咒之源能力。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了怨魂晋升' : '怨魂魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是活尸，消化与全部原有掌握保留，没有获得怨魂能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

function wraithMoonSummary(s: SliceState): string {
  if (s.progression.sequence === 2) return '旧怨魂月相与处置记录完整保留；当前古代邪物的具体月圆规则仍未知。晋升不消除诅咒，也不重复施加旧阶段发作。';
  if((s.progression.sequence===4||[3, 2].includes(s.progression.sequence!)))return '旧怨魂月相与处置记录保留；木偶4具体原著诅咒未核，不能沿用5吸灵条款。当前仅执行木偶页明示的有限G公告。';
  const next = WEREWOLF_MOON_EVENTS.find(event => event.week >= s.week
    && !s.werewolf.moon.history.some(entry => entry.week === event.week)
    && !s.zombie.moon.history.some(entry => entry.week === event.week)
    && !s.wraith.moon.history.some(entry => entry.week === event.week));
  return `怨魂不吞食人类灵魂的满月分支会承受极端虚弱，本次发作期间不能战斗或继续普通活动；须实际等待本次有限G发作结束。原工坊的哈伦当面守望至多消耗10精神，当前地点独处至多20精神，不恢复健康、精神或灵性，不增加扮演，不伤害他人。${next ? `下一场提前公示：第${next.week}周「${next.title}」，来源：${next.source}。` : '已登记有限事件之后的月相尚未展开，不代表诅咒消失。'}沿用原八场G月相告示，不按每四周推算；新发作替换旧活尸剧痛与狼人嗜血，旧记录保留，同一场不重复结算。消化、节制和和平报告都不保证解除诅咒。`;
}

export function projectWraith(s: SliceState): WraithProjection {
  const actions: WraithAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||[3, 2].includes(s.progression.sequence!))?s.puppet.wraithActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: WraithAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.wraith.guidanceKnown) add('learn-wraith-guidance', '请哈伦·维斯说明怨魂成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.wraith.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${WRAITH_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶怨魂魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.wraith.resupply.requestedWeek !== null) add('receive-wraith-supply', '确认下一批三瓶怨魂到货', `0行动 · 第${s.wraith.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.wraith)) add('request-wraith-supply', '向哈伦·维斯订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.wraith.guidanceKnown) {
    for (const bottle of s.wraith.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶怨魂魔药`, `0行动 · 独立确认 · 活尸消化${isPromoted ? s.wraith.zombieActingAtPromotion : s.progression.acting}/100 · 晋升后${zombieWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.wraith.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.wraith.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '怨魂 · 序列5' : '怨魂之路', discovered: available,
    guidanceKnown: available && s.wraith.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: { ...s.wraith.practice },
    moon: { pending: s.wraith.moon.pendingWeek !== null, summary: available ? wraithMoonSummary(s) : '', history: s.wraith.moon.history.map(entry => ({ ...entry })) },
    ...(isPromoted && s.wraith.encounter.status === 'FIGHTING' && s.combat?.encounterId === 'WRAITH_DISPUTE' ? { battle: { lastPossessionRound: s.wraith.encounter.lastPossessionRound, staggerReady: s.wraith.encounter.staggerReady } } : {}),
    cases: [], environment: '', insideCase: (wraithInside(s) || inheritedContactOpen(s)),
    ...(available ? { story: WRAITH_SOURCE_STATUS } : {}),
    supplies: available ? `${WRAITH_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.wraith.resupply.requestedWeek === null ? `已实际接收后续供给${s.wraith.resupply.deliveries}批。` : `第${s.wraith.resupply.requestedWeek}周提出请求，第${s.wraith.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.wraith.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 怨魂魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? WRAITH_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `活尸消化成果${s.wraith.zombieActingAtPromotion}/100已保留；怨魂扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成活尸消化（${s.progression.acting}/100），并在晋升活尸后度过12整周（${zombieWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完活尸之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${WRAITH_CONSUMPTION_RISK}` : '成为活尸后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isWraithAcquisitionCommand(command: unknown): command is WraithAcquisitionCommand {
  return validateWraithCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateWraithCommand(value: unknown): value is WraithCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^wraith-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^wraith-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && WRAITH_CASE_IDS.includes(value.caseId as typeof WRAITH_CASE_IDS[number]);
  if (value.type === 'HANDLE_MOON') return shape(value, ['type', 'method']) && (value.method === 'GUARDED' || value.method === 'ALONE');
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && WRAITH_CASE_IDS.includes(value.caseId as typeof WRAITH_CASE_IDS[number]) && (value.method === 'ORDINARY' || value.method === 'ABILITY' && value.caseId !== 'honest-account');
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateWraithState(s: SliceState): boolean {
  const raw: unknown = s.wraith;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'zombieActingAtPromotion', 'cases', 'practice', 'moon', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.prisoner) || !record(s.madman) || !record(s.werewolf) || !record(s.zombie)) return false;
  if (![s.prisoner.cases, s.madman.cases, s.werewolf.cases, s.zombie.cases].every(value => record(value) && Object.values(value).every(record))
    || !record(s.zombie.practice) || !record(s.zombie.moon) || !Array.isArray(s.zombie.moon.history)
    || !record(s.werewolf.moon) || !Array.isArray(s.werewolf.moon.history)) return false;
  const firstZombieWeek = s.zombie.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstZombieWeek + WRAITH_MIN_ZOMBIE_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== WRAITH_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, WRAITH_CASE_IDS) || !record(raw.practice) || !record(raw.moon) || !record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'lastPossessionRound', 'staggerReady']) || typeof raw.encounter.staggerReady !== 'boolean' || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateWraithLife(s)) return false;
  const wraith = raw as unknown as WraithState, isPromoted = promoted(s);
  if (wraith.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (inheritedContactOpen(s)) return false;
    if (!wraith.guidanceKnown || !integer(s.zombie.promotionWeek, 1, s.week) || !integer(wraith.promotionWeek, firstConsumptionWeek, s.week) || wraith.zombieActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...PRISONER_ABILITY_IDS, ...([8, 7, 6, 5, 4, 3, 2].includes(s.progression.sequence!) ? MADMAN_ABILITY_IDS : []), ...([7, 6, 5, 4, 3, 2].includes(s.progression.sequence!) ? WEREWOLF_ABILITY_IDS : []), ...([6, 5, 4, 3, 2].includes(s.progression.sequence!) ? ZOMBIE_ABILITY_IDS : []), ...([5, 4, 3, 2].includes(s.progression.sequence!) ? WRAITH_ABILITY_IDS : []), ...([4, 3, 2].includes(s.progression.sequence!) ? PUPPET_ABILITY_IDS : []), ...([3, 2].includes(s.progression.sequence!) ? SILENT_DISCIPLE_ABILITY_IDS : []), ...(s.progression.sequence === 2 ? ANCIENT_EVIL_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (wraith.moon.pendingWeek !== null || wraith.moon.history.length !== 0) return false;
    if (wraith.promotionWeek !== null || wraith.zombieActingAtPromotion !== null || WRAITH_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (Object.entries(freshWraithPractice()).some(([key, value]) => wraith.practice[key as keyof WraithPractice] !== value)) return false;
    if (wraith.reflected || Object.values(wraith.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of wraith.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `wraith-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of wraith.bottles.entries()) {
    let stockWeek = firstZombieWeek;
    if (index < WRAITH_BOTTLE_IDS.length) {
      if (bottle.source !== WRAITH_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!wraith.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / WRAITH_BOTTLE_IDS.length) - 1;
      if (index % WRAITH_BOTTLE_IDS.length === 0) {
        const previous = wraith.bottles.slice(index - WRAITH_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > wraith.promotionWeek!) return false;
    }
    if (!wraith.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > wraith.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > wraith.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== wraith.promotionWeek) return false;
    }
  }
  if (wraith.resupply.requestedWeek !== null && (!wraith.guidanceKnown || isPromoted || !supplyExhausted(wraith) || wraith.bottles.some(bottle => bottle.consumedWeek! > wraith.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0) && validateWraithEncounter(s);
}

export { WRAITH_ABILITIES } from './content.js';
export type * from './types.js';
