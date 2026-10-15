import {WEATHER_WARLOCK_ABILITY_IDS} from '../weather-warlock/types.js';
import { WAR_BISHOP_ABILITY_IDS } from '../war-bishop/types.js';
import { IRON_BLOOD_KNIGHT_ABILITY_IDS } from '../iron-blood-knight/types.js';
import {REAPER_ABILITY_IDS} from '../reaper/types.js';
import {CONSPIRATOR_ABILITY_IDS} from '../conspirator/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { HUNTER_ABILITY_IDS } from '../hunter/types.js';
import { PROVOKER_ABILITY_IDS } from '../provoker/types.js';
import {
  PYROMANIAC_ABILITIES, PYROMANIAC_BOTTLE_IDS, PYROMANIAC_CONSUMPTION_RISK, PYROMANIAC_FORMULA_STATUS,
  PYROMANIAC_GUIDE, PYROMANIAC_LABOUR_TASKS, PYROMANIAC_MIN_PROVOKER_WEEKS, PYROMANIAC_POTION_SOURCES, PYROMANIAC_PRICES,
} from './content.js';
import {
  PYROMANIAC_ABILITY_IDS, type PyromaniacAcquisitionCommand, type PyromaniacAction,
  type PyromaniacBottle, type PyromaniacCommand, type PyromaniacProjection, type PyromaniacState,
} from './types.js';

export function createPyromaniacState(): PyromaniacState {
  return {
    guidanceKnown: false,
    bottles: PYROMANIAC_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, provokerActingAtPromotion: null,
    practices: [], practiceAttempts: {},
    reflected: false,
    encounter: { status: 'AVAILABLE', surveyed: false, safeLane: false, attemptWeek: null, startHistoryIndex: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hunter' && (s.progression.sequence === 7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const isProvoker = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 8;
const knownChannel = (s: SliceState) => s.hunter.discovered && s.hunter.guidanceKnown && s.provoker.guidanceKnown && s.provoker.promotionWeek !== null && (isProvoker(s) || promoted(s));
const potionPrice = (bottle: PyromaniacBottle) => PYROMANIAC_PRICES.potion - (bottle.labourSteps === 4 ? PYROMANIAC_PRICES.labourCredit : 0);
const bottleNumber = (bottle: PyromaniacBottle) => Number(bottle.id.slice('pyromaniac-potion-'.length));
const provokerWeeks = (s: SliceState) => Math.max(0, (s.pyromaniac.promotionWeek ?? s.week) - (s.provoker.promotionWeek ?? s.week));
const supplyExhausted = (state: PyromaniacState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${PYROMANIAC_GUIDE}的新防火货栈渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列7纵火家魔药，原瓶pyromaniac-potion-${number}，非猎人或挑衅者旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: PyromaniacAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原仓库，找到索伦。';
  if (!knownChannel(s)) return '成为挑衅者并保有索伦的指导渠道后，才能继续纵火家之路。';
  if (promoted(s)) return '你已完成纵火家晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.pyromaniac.guidanceKnown) return '已经听过纵火家成品魔药的用药说明。';
    return s.cash < PYROMANIAC_PRICES.guidance ? '纵火家用药指导需要240便士。' : null;
  }
  if (!s.pyromaniac.guidanceKnown) return '先听索伦说明这批序列7原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.pyromaniac.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.pyromaniac) ? null : '须先用完现有全部纵火家原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.pyromaniac.resupply.requestedWeek === null) return '尚未申请下一批纵火家补给。';
    if (s.week <= s.pyromaniac.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.pyromaniac) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.pyromaniac.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选纵火家原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `挑衅者魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.provoker.promotionWeek === null || provokerWeeks(s) < PYROMANIAC_MIN_PROVOKER_WEEKS) return `成为挑衅者后已度过${provokerWeeks(s)}/${PYROMANIAC_MIN_PROVOKER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 4 ? '这瓶对应的四次仓库劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyPyromaniacCommand(s: SliceState, command: PyromaniacAcquisitionCommand, c: SeerContext): void {
  rule(isPyromaniacAcquisitionCommand(command), '纵火家准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= PYROMANIAC_PRICES.guidance;
      s.pyromaniac.guidanceKnown = true;
      c.note('听取纵火家用药说明', `花费1行动、240便士，${PYROMANIAC_GUIDE}向你说明从新防火货栈渠道实际取得的三瓶序列7成品、逐瓶交付与四档风险。这些不是原来的挑衅者存药。${PYROMANIAC_FORMULA_STATUS}挑衅者消化须达100，晋升挑衅者后满8整周才能服用；可提前筹备。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.pyromaniac.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = PYROMANIAC_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在索伦的原仓库实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/4，原瓶仍由导师保管。${bottle.labourSteps === 4 ? '四次劳务只抵这瓶1800便士，仍须实际支付210便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应四次劳务后才能抵这瓶1800便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.pyromaniac.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('纵火家原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列7成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 4 ? '对应四次仓库劳务抵扣1800便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；挑衅者消化100且晋升挑衅者后满8整周时，再独立确认服药。${PYROMANIAC_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.pyromaniac.resupply.requestedWeek = s.week;
      c.note('申请下一批纵火家魔药', `现有纵火家原瓶全部耗尽且未晋升。你花费1行动，请${PYROMANIAC_GUIDE}从同一新渠道订下一批三瓶，并实际核验原仓库的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付2010便士，或分别完成四次劳务后支付210便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.pyromaniac.bottles.length + 1;
      s.pyromaniac.resupply.deliveries += 1;
      for (let offset = 0; offset < PYROMANIAC_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.pyromaniac.bottles.push({ id: `pyromaniac-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.pyromaniac.resupply.requestedWeek = null;
      c.note('下一批纵火家原瓶到货', `第${s.week}周，索伦的新防火货栈渠道本作G成品供给第${s.pyromaniac.resupply.deliveries + 1}批三瓶实际到货，原瓶pyromaniac-potion-${firstNumber}至pyromaniac-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按2010便士购买，或完成对应四次劳务再付210便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.pyromaniac.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 18);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.pyromaniac.provokerActingAtPromotion = s.progression.acting;
        s.pyromaniac.promotionWeek = s.week;
        s.progression.sequence = 7;
        s.progression.acting = 0;
        for (const id of PYROMANIAC_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 3], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为纵火家', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+1、意志+3、知识+1。四项猎人与两项挑衅者能力及掌握完整继承，火焰操控、压缩火球、火焰长枪与火鸦从0掌握开始；挑衅者消化成果和既有晋升周保留，纵火家扮演从0开始。灵性上限提高到60，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了纵火家晋升' : '纵火家魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是挑衅者，原有消化与掌握保留。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectPyromaniac(s: SliceState): PyromaniacProjection {
  const actions: PyromaniacAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const add = (id: string, label: string, cost: string, command: PyromaniacAcquisitionCommand) => {
    if (isPromoted && (s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))) return;
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.pyromaniac.guidanceKnown) add('learn-pyromaniac-guidance', '请索伦说明纵火家成品与风险', '1行动 · 240便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.pyromaniac.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 4) add(`work-${bottle.id}`, `第${number}瓶 · ${PYROMANIAC_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/4，完成四次抵该瓶1800便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶纵火家魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列7原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.pyromaniac.resupply.requestedWeek !== null) add('receive-pyromaniac-supply', '确认下一批三瓶纵火家到货', `0行动 · 第${s.pyromaniac.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.pyromaniac)) add('request-pyromaniac-supply', '向索伦订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.pyromaniac.guidanceKnown) {
    for (const bottle of s.pyromaniac.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶纵火家魔药`, `0行动 · 独立确认 · 挑衅者消化${isPromoted ? s.pyromaniac.provokerActingAtPromotion : s.progression.acting}/100 · 晋升后${provokerWeeks(s)}/8整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] });
  const remaining = s.pyromaniac.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.pyromaniac.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '纵火家 · 序列7' : '纵火家之路', discovered: available,
    guidanceKnown: available && s.pyromaniac.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practices: [], environment: '',
    supplies: available ? `${PYROMANIAC_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.pyromaniac.resupply.requestedWeek === null ? `已实际接收后续供给${s.pyromaniac.resupply.deliveries}批。` : `第${s.pyromaniac.resupply.requestedWeek}周提出请求，第${s.pyromaniac.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.pyromaniac.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 纵火家魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/4`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? PYROMANIAC_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.conspirator.pyromaniacActingAtPromotion??100:s.progression.acting) : 0,
    digestion: (s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?'纵火家魔药已消化，原火焰实践与原瓶记录保留。':isPromoted ? `挑衅者消化成果${s.pyromaniac.provokerActingAtPromotion}/100已保留；纵火家扮演${s.progression.acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成挑衅者消化（${s.progression.acting}/100），并在晋升挑衅者后度过8整周（${provokerWeeks(s)}/8）。用药指导与原瓶可以提前准备。` : '先走完挑衅者之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应四次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服药。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${PYROMANIAC_CONSUMPTION_RISK}` : '成为挑衅者后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Commands are checked at the shared boundary and again before acquisition mutates state. */
export function validatePyromaniacCommand(value: unknown): value is PyromaniacCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'SURVEY_ENCOUNTER', 'CLEAR_LANE', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^pyromaniac-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^pyromaniac-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'PRACTICE') return shape(value, ['type', 'practiceId']) && typeof value.practiceId === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value.practiceId);
  return false;
}

export function isPyromaniacAcquisitionCommand(value: unknown): value is PyromaniacAcquisitionCommand {
  return validatePyromaniacCommand(value) && ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type);
}

/** Bottle conservation and promotion chronology live here; activity content/history is validated separately. */
export function validatePyromaniacState(s: SliceState): boolean {
  const raw: unknown = s.pyromaniac;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'provokerActingAtPromotion', 'practices', 'practiceAttempts', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.hunter) || !record(s.provoker)) return false;
  const firstProvokerWeek = s.provoker.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstProvokerWeek + PYROMANIAC_MIN_PROVOKER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== PYROMANIAC_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!Array.isArray(raw.practices) || !raw.practices.every(id => typeof id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(id)) || new Set(raw.practices).size !== raw.practices.length) return false;
  if (!record(raw.practiceAttempts) || !Object.entries(raw.practiceAttempts).every(([id, week]) => /^[a-z][a-z0-9-]{0,63}$/.test(id) && integer(week, firstConsumptionWeek, s.week))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'surveyed', 'safeLane', 'attemptWeek', 'startHistoryIndex'])) return false;
  if (!['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string) || typeof raw.encounter.surveyed !== 'boolean' || typeof raw.encounter.safeLane !== 'boolean') return false;
  if (raw.encounter.attemptWeek !== null && !integer(raw.encounter.attemptWeek, firstConsumptionWeek, s.week) || raw.encounter.startHistoryIndex !== null && !integer(raw.encounter.startHistoryIndex, 0, s.combatHistory.length)) return false;
  const state = raw as unknown as PyromaniacState, isPromoted = promoted(s);
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!state.guidanceKnown || !integer(s.provoker.promotionWeek, 11, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.provokerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===2?WEATHER_WARLOCK_ABILITY_IDS:[]),...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS, ...PYROMANIAC_ABILITY_IDS,...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?CONSPIRATOR_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?REAPER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?IRON_BLOOD_KNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?WAR_BISHOP_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (state.promotionWeek !== null || state.provokerActingAtPromotion !== null || PYROMANIAC_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (state.reflected || state.practices.length !== 0 || Object.keys(state.practiceAttempts).length !== 0) return false;
    if (state.encounter.status !== 'AVAILABLE' || state.encounter.surveyed || state.encounter.safeLane || state.encounter.attemptWeek !== null || state.encounter.startHistoryIndex !== null) return false;
  }
  // Validate record shapes before consulting previous stock batches.
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `pyromaniac-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 4)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of state.bottles.entries()) {
    let stockWeek = firstProvokerWeek;
    if (index < PYROMANIAC_BOTTLE_IDS.length) {
      if (bottle.source !== PYROMANIAC_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!state.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / PYROMANIAC_BOTTLE_IDS.length) - 1;
      if (index % PYROMANIAC_BOTTLE_IDS.length === 0) {
        const previous = state.bottles.slice(index - PYROMANIAC_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > state.promotionWeek!) return false;
    }
    if (!state.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > state.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > state.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== state.promotionWeek) return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || isPromoted || !supplyExhausted(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0);
}
