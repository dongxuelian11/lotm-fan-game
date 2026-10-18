import { ANCIENT_EVIL_ABILITY_IDS } from '../ancient-evil/types.js';
import {SILENT_DISCIPLE_ABILITY_IDS} from '../silent-disciple/types.js';
import {PUPPET_ABILITY_IDS} from '../puppet/types.js';
import {WRAITH_ABILITY_IDS} from '../wraith/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRISONER_ABILITY_IDS } from '../prisoner/types.js';
import { MADMAN_ABILITY_IDS } from '../madman/types.js';
import { validateZombieLife } from './life.js';
import { WEREWOLF_MOON_EVENTS } from '../werewolf/content.js';
import { WEREWOLF_ABILITY_IDS } from '../werewolf/types.js';
import {
  ZOMBIE_ABILITIES, ZOMBIE_BOTTLE_IDS, ZOMBIE_CONSUMPTION_RISK, ZOMBIE_FORMULA_STATUS,
  ZOMBIE_GUIDE, ZOMBIE_LABOUR_TASKS, ZOMBIE_MIN_WEREWOLF_WEEKS, ZOMBIE_POTION_SOURCES, ZOMBIE_PRICES, ZOMBIE_SOURCE_STATUS,
} from './content.js';
import {
  ZOMBIE_ABILITY_IDS, ZOMBIE_CASE_IDS, type ZombieAcquisitionCommand, type ZombieAction,
  type ZombieBottle, type ZombieCommand, type ZombieProjection, type ZombieState,
} from './types.js';

export function createZombieState(): ZombieState {
  return {
    guidanceKnown: false,
    bottles: ZOMBIE_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, werewolfActingAtPromotion: null,
    cases: Object.fromEntries(ZOMBIE_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: { body: 'NORMAL', cold: 'NONE', spirit: 'ABSENT' },
    moon: { pendingWeek: null, history: [] },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'chained' && [6, 5, 4, 3, 2].includes(s.progression.sequence!);
const isWerewolf = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.prisoner.discovered && s.prisoner.guidanceKnown && s.madman.guidanceKnown && s.werewolf.guidanceKnown && s.werewolf.promotionWeek !== null && (isWerewolf(s) || promoted(s));
const potionPrice = (bottle: ZombieBottle) => ZOMBIE_PRICES.potion - (bottle.labourSteps === 5 ? ZOMBIE_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ZombieBottle) => Number(bottle.id.slice('zombie-potion-'.length));
const werewolfWeeks = (s: SliceState) => Math.max(0, (s.zombie.promotionWeek ?? s.week) - (s.werewolf.promotionWeek ?? s.week));
const supplyExhausted = (state: ZombieState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${ZOMBIE_GUIDE}的独立活尸成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6活尸魔药，原瓶zombie-potion-${number}，非囚犯、疯子或狼人旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: ZombieAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.zombie.moon.pendingWeek !== null || s.werewolf.moon.pendingWeek !== null) return '先实际度过当前月圆发作。';
  if (Object.values(s.zombie.cases).some(value => value.contactOpen)) return '先实际结束本次活尸实践的接触，再继续。';
  if (Object.values(s.werewolf.cases).some(value => value.sceneOpen) || Object.values(s.madman.cases).some(value => value.burstOpen) || Object.values(s.prisoner.cases).some(value => value.holding)) return '先实际结束原序列尚未收束的接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原旧工坊，找到哈伦。';
  if (!knownChannel(s)) return '成为狼人并保有哈伦的指导渠道后，才能继续了解活尸之路。';
  if (promoted(s)) return '你已完成活尸晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.zombie.guidanceKnown) return '已经听过活尸成品魔药的用药说明。';
    return s.cash < ZOMBIE_PRICES.guidance ? '活尸用药指导需要360便士。' : null;
  }
  if (!s.zombie.guidanceKnown) return '先听哈伦说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.zombie.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.zombie) ? null : '须先用完现有全部活尸原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.zombie.resupply.requestedWeek === null) return '尚未申请下一批活尸补给。';
    if (s.week <= s.zombie.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.zombie) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.zombie.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选活尸原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `狼人魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.werewolf.promotionWeek === null || werewolfWeeks(s) < ZOMBIE_MIN_WEREWOLF_WEEKS) return `成为狼人后已度过${werewolfWeeks(s)}/${ZOMBIE_MIN_WEREWOLF_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原旧工坊劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyZombieCommand(s: SliceState, command: ZombieAcquisitionCommand, c: SeerContext): void {
  rule(validateZombieCommand(command) && isZombieAcquisitionCommand(command), '活尸准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= ZOMBIE_PRICES.guidance;
      s.zombie.guidanceKnown = true;
      c.note('听取活尸用药说明', `花费1行动、360便士，你向已认识的本作原创成年${ZOMBIE_GUIDE}继续请教，他向你说明从独立活尸成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的囚犯、疯子或狼人存药。${ZOMBIE_FORMULA_STATUS}狼人消化须达100，晋升狼人后满12整周才能服用；可提前筹备。${ZOMBIE_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.zombie.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = ZOMBIE_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在哈伦的原旧工坊实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.zombie.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('活尸原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原旧工坊劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；狼人消化100且晋升狼人后满12整周时，再独立确认服药。${ZOMBIE_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.zombie.resupply.requestedWeek = s.week;
      c.note('申请下一批活尸魔药', `现有活尸原瓶全部耗尽且未晋升。你花费1行动，请${ZOMBIE_GUIDE}从同一新渠道订下一批三瓶，并实际核验原旧工坊的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.zombie.bottles.length + 1;
      s.zombie.resupply.deliveries += 1;
      for (let offset = 0; offset < ZOMBIE_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.zombie.bottles.push({ id: `zombie-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.zombie.resupply.requestedWeek = null;
      c.note('下一批活尸原瓶到货', `第${s.week}周，哈伦的独立活尸成品交接渠道本作G成品供给第${s.zombie.resupply.deliveries + 1}批三瓶实际到货，原瓶zombie-potion-${firstNumber}至zombie-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.zombie.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.zombie.werewolfActingAtPromotion = s.progression.acting;
        s.zombie.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of ZOMBIE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为活尸', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。囚犯、疯子与狼人全部原能力及原ID掌握完整继承，只新增钢铁身体与有限死亡魔法两项，从0掌握开始；狼人消化成果与狼人晋升周保留，活尸扮演从0开始。灵性上限提高到80，当前灵性没有补满。不赠资源；钢铁身体不等于无敌，精神攻击与太阳净化仍可伤害乃至杀死你，没有序列5虚化、穿墙、镜面跳跃或附身。序列6满月时以节制引发的剧痛取代先前序列的发作形态，发作时不能战斗；原月相告示与旧记录保留，不重复处罚同一场。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了活尸晋升' : '活尸魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是狼人，消化与全部原有掌握保留，没有获得活尸能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

function zombieMoonSummary(s: SliceState): string {
  if (s.progression.sequence === 2) return '旧活尸月相与剧痛处置记录完整保留；当前古代邪物的具体月圆规则仍未知。晋升不消除诅咒，也不重复施加旧阶段发作。';
  if((s.progression.sequence===4||[3, 2].includes(s.progression.sequence!)))return '旧活尸月相与剧痛处置完整保留。当前木偶4具体诅咒未核；只执行当前页面有限G公告，不叠收旧诅咒。';
  if(s.progression.sequence===5)return "旧活尸月相与剧痛处置记录保留；当前适用怨魂月圆虚弱，请在怨魂面板查看。同一场不重复，不叠加旧狼人或活尸诅咒。";
  const next = WEREWOLF_MOON_EVENTS.find(event => event.week >= s.week && !s.werewolf.moon.history.some(entry => entry.week === event.week) && !s.zombie.moon.history.some(entry => entry.week === event.week));
  return `活尸节制满月冲动会承受剧痛，本次发作期间不能战斗；不能用普通替代食物、消化或节制保证治愈诅咒。${next ? `下一场提前公示：第${next.week}周「${next.title}」，来源：${next.source}。` : '已登记有限事件之后的月相尚未展开，不代表诅咒消失。'}沿用原八场G月相告示，不按每四周推算；旧狼人记录保留，同一场不重复结算。`;
}

export function projectZombie(s: SliceState): ZombieProjection {
  const actions: ZombieAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||[3, 2].includes(s.progression.sequence!)))?s.wraith.zombieActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: ZombieAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.zombie.guidanceKnown) add('learn-zombie-guidance', '请哈伦说明活尸成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.zombie.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${ZOMBIE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶活尸魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.zombie.resupply.requestedWeek !== null) add('receive-zombie-supply', '确认下一批三瓶活尸到货', `0行动 · 第${s.zombie.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.zombie)) add('request-zombie-supply', '向哈伦订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.zombie.guidanceKnown) {
    for (const bottle of s.zombie.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶活尸魔药`, `0行动 · 独立确认 · 狼人消化${isPromoted ? s.zombie.werewolfActingAtPromotion : s.progression.acting}/100 · 晋升后${werewolfWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.zombie.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.zombie.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '活尸 · 序列6' : '活尸之路', discovered: available,
    guidanceKnown: available && s.zombie.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: { ...s.zombie.practice },
    cases: [], environment: '', insideCase: Object.values(s.zombie.cases).some(value => value.contactOpen) || s.zombie.moon.pendingWeek !== null,
    moon: { pending: s.zombie.moon.pendingWeek !== null, summary: available ? zombieMoonSummary(s) : '', history: s.zombie.moon.history.map(entry => ({ ...entry })) },
    ...(available ? { story: ZOMBIE_SOURCE_STATUS } : {}),
    supplies: available ? `${ZOMBIE_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.zombie.resupply.requestedWeek === null ? `已实际接收后续供给${s.zombie.resupply.deliveries}批。` : `第${s.zombie.resupply.requestedWeek}周提出请求，第${s.zombie.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.zombie.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 活尸魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? ZOMBIE_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `狼人消化成果${s.zombie.werewolfActingAtPromotion}/100已保留；活尸扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成狼人消化（${s.progression.acting}/100），并在晋升狼人后度过12整周（${werewolfWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完狼人之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${ZOMBIE_CONSUMPTION_RISK}` : '成为狼人后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isZombieAcquisitionCommand(command: unknown): command is ZombieAcquisitionCommand {
  return validateZombieCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateZombieCommand(value: unknown): value is ZombieCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^zombie-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^zombie-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && ZOMBIE_CASE_IDS.includes(value.caseId as typeof ZOMBIE_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && ZOMBIE_CASE_IDS.includes(value.caseId as typeof ZOMBIE_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  if (value.type === 'HANDLE_MOON') return shape(value, ['type', 'method']) && ['GUARDED', 'ALONE'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateZombieState(s: SliceState): boolean {
  const raw: unknown = s.zombie;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'werewolfActingAtPromotion', 'cases', 'practice', 'moon', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.prisoner) || !record(s.madman) || !record(s.werewolf)) return false;
  if (!record(raw.moon) || !shape(raw.moon, ['pendingWeek', 'history']) || !Array.isArray(raw.moon.history)) return false;
  const firstWerewolfWeek = s.werewolf.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstWerewolfWeek + ZOMBIE_MIN_WEREWOLF_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== ZOMBIE_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, ZOMBIE_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'LOAD_HANDLED', 'COLD_RECORDED', 'MARK_CORROBORATED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const zombie = raw as unknown as ZombieState, isPromoted = promoted(s);
  if (zombie.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!zombie.guidanceKnown || !integer(s.werewolf.promotionWeek, 1, s.week) || !integer(zombie.promotionWeek, firstConsumptionWeek, s.week) || zombie.werewolfActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...PRISONER_ABILITY_IDS, ...([8, 7, 6, 5, 4, 3, 2].includes(s.progression.sequence!) ? MADMAN_ABILITY_IDS : []), ...([7, 6, 5, 4, 3, 2].includes(s.progression.sequence!) ? WEREWOLF_ABILITY_IDS : []), ...([6, 5, 4, 3, 2].includes(s.progression.sequence!) ? ZOMBIE_ABILITY_IDS : []), ...([5, 4, 3, 2].includes(s.progression.sequence!) ? WRAITH_ABILITY_IDS : []), ...([4, 3, 2].includes(s.progression.sequence!) ? PUPPET_ABILITY_IDS : []), ...([3, 2].includes(s.progression.sequence!) ? SILENT_DISCIPLE_ABILITY_IDS : []), ...(s.progression.sequence === 2 ? ANCIENT_EVIL_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (zombie.promotionWeek !== null || zombie.werewolfActingAtPromotion !== null || ZOMBIE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (zombie.reflected || Object.values(zombie.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of zombie.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `zombie-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of zombie.bottles.entries()) {
    let stockWeek = firstWerewolfWeek;
    if (index < ZOMBIE_BOTTLE_IDS.length) {
      if (bottle.source !== ZOMBIE_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!zombie.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / ZOMBIE_BOTTLE_IDS.length) - 1;
      if (index % ZOMBIE_BOTTLE_IDS.length === 0) {
        const previous = zombie.bottles.slice(index - ZOMBIE_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > zombie.promotionWeek!) return false;
    }
    if (!zombie.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > zombie.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > zombie.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== zombie.promotionWeek) return false;
    }
  }
  if (zombie.resupply.requestedWeek !== null && (!zombie.guidanceKnown || isPromoted || !supplyExhausted(zombie) || zombie.bottles.some(bottle => bottle.consumedWeek! > zombie.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = zombie.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, zombie.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'ZOMBIE_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(zombie.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.status !== 'ACTIVE' || s.activeEvent !== null || s.world.city !== 'BACKLUND' || zombie.moon.pendingWeek !== null || Object.values(zombie.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'zombie-dispute').length;
  // A later real death does not erase the original resolved encounter and its earned award.
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateZombieLife(s);
}

export { ZOMBIE_ABILITIES } from './content.js';
export type * from './types.js';
