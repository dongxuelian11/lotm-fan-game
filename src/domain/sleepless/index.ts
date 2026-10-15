import { CONCEALMENT_SERVANT_ABILITY_IDS } from '../concealment-servant/types.js';
import {FEAR_BISHOP_ABILITY_IDS} from '../fear-bishop/types.js';
import {NIGHTWATCHER_ABILITY_IDS} from '../nightwatcher/types.js';
import {SPIRIT_WARLOCK_ABILITY_IDS} from '../spirit-warlock/types.js';
import {SOOTHER_ABILITY_IDS} from '../soother/types.js';
import {NIGHTMARE_ABILITY_IDS} from '../nightmare/types.js';
import {MIDNIGHT_ABILITY_IDS} from '../midnight/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  SLEEPLESS_ABILITIES, SLEEPLESS_BOTTLE_IDS, SLEEPLESS_CONSUMPTION_RISK, SLEEPLESS_FORMULA_STATUS,
  SLEEPLESS_GUIDE, SLEEPLESS_POTION_SOURCES, SLEEPLESS_PRICES,
} from './content.js';
import {
  SLEEPLESS_ABILITY_IDS, SLEEPLESS_WATCH_IDS, type SleeplessAcquisitionCommand, type SleeplessAction,
  type SleeplessBottle, type SleeplessCommand, type SleeplessProjection, type SleeplessState,
} from './types.js';

export function createSleeplessState(): SleeplessState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: SLEEPLESS_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    watches: Object.fromEntries(SLEEPLESS_WATCH_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null,
    }])) as SleeplessState['watches'],
    reflected: false,
    encounter: { status: 'AVAILABLE', observed: false, night: false, attemptWeek: null, startHistoryIndex: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'darkness' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0))));
const potionPrice = (bottle: SleeplessBottle) => SLEEPLESS_PRICES.potion - (bottle.labourSteps === 2 ? SLEEPLESS_PRICES.labourCredit : 0);
const bottleNumber = (bottle: SleeplessBottle) => Number(bottle.id.slice('sleepless-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (sleepless: SleeplessState) => sleepless.bottles.length > 0 && sleepless.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SLEEPLESS_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的不眠者成品魔药，原瓶sleepless-potion-${number}。值班室供给为本作原创，完整配方资料待核，未声称在值班室配制。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isSleeplessAcquisitionCommand(command: SleeplessCommand): command is SleeplessAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Only exact, typed intents cross the boundary; acquisition cannot substitute an unknown command. */
export function validateSleeplessCommand(value: unknown): value is SleeplessCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'OBSERVE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^sleepless-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^sleepless-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'SURVEY') return shape(value, ['type', 'watchId']) && SLEEPLESS_WATCH_IDS.includes(value.watchId as typeof SLEEPLESS_WATCH_IDS[number]);
  if (value.type === 'WATCH') return shape(value, ['type', 'watchId', 'approach']) && SLEEPLESS_WATCH_IDS.includes(value.watchId as typeof SLEEPLESS_WATCH_IDS[number]) && ['OBSERVE', 'REPORT'].includes(value.approach as string);
  return false;
}

function commandBlock(s: SliceState, command: SleeplessAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到守夜导师。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服不眠者魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.sleepless.discovered ? '已经认识这位守夜导师。' : null;
  if (!s.sleepless.discovered) return '先拜访守夜导师。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.sleepless.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < SLEEPLESS_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.sleepless.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.sleepless.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.sleepless) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.sleepless.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.sleepless.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.sleepless) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.sleepless.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选不眠者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次值班室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy. Night-watch commands are dispatched separately. */
export function applySleeplessCommand(s: SliceState, command: SleeplessAcquisitionCommand, c: SeerContext): void {
  rule(validateSleeplessCommand(command) && isSleeplessAcquisitionCommand(command), '不眠者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.sleepless.discovered = true;
      c.note('认识守夜导师', `你在贝克兰德拜访了${SLEEPLESS_GUIDE}，消耗1行动。值班室保管三瓶独立封存的不眠者成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。导师与成品药渠道为本作原创G，不代表已知配方或可以在值班室制造魔药。`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SLEEPLESS_PRICES.guidance;
      s.sleepless.guidanceKnown = true;
      c.note('听取不眠者用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的交付方式和指导服药的四档风险。${SLEEPLESS_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。不眠者能够在黑暗中视物，夜间保持清醒，随夜色加深增强力量、敏捷与感知；白天仍需休息。接触导师与服药都不建立教会或其它组织身份。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.sleepless.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成值班室清点' : '完成交班登记', bottle.labourSteps === 1
        ? `你照清单核对普通工具与货架，完成一次实际值班室劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由值班室保管。完成第二次交班登记后可抵该瓶600便士。清点不赋予黑暗视物或危险感应。`
        : `你按导师要求整理普通灯具的交接记录与值班簿，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.sleepless.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('不眠者原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次值班室劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${SLEEPLESS_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.sleepless.resupply.requestedWeek = s.week;
      c.note('申请下一批不眠者魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${SLEEPLESS_GUIDE}提出下一批三瓶的补给请求，并清点值班室收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.sleepless.resupply.deliveries += 1;
      const firstNumber = s.sleepless.resupply.deliveries * SLEEPLESS_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < SLEEPLESS_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.sleepless.bottles.push({ id: `sleepless-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.sleepless.resupply.requestedWeek = null;
      c.note('下一批不眠者原瓶到货', `第${s.week}周，本作G供给第${s.sleepless.resupply.deliveries + 1}批三瓶实际送到值班室，原瓶sleepless-potion-${firstNumber}至sleepless-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.sleepless.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'darkness';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(SLEEPLESS_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 3], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为不眠者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+3、意志+2、知识+1。三项不眠者能力从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。睡眠需求减少，白天仍需休息；危险感应不等于知道来源，面对怪物仍可能需要外部弹药或工具。不获得序列8催眠诗歌或序列7入梦能力，也不自动加入教会。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了不眠者晋升' : '不眠者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Watch projection is merged by the watch module, which owns observations and encounter disclosure. */
export function projectSleepless(s: SliceState): SleeplessProjection {
  const actions: SleeplessAction[] = [], isPromoted = promoted(s), known = s.sleepless.discovered;
  const add = (id: string, label: string, cost: string, command: SleeplessAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-sleepless', `拜访${SLEEPLESS_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.sleepless.guidanceKnown) add('learn-sleepless-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.sleepless.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '值班室清点' : '交班登记'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶不眠者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.sleepless.resupply.requestedWeek !== null) add('receive-sleepless-supply', '确认下一批三瓶到货', `0行动 · 第${s.sleepless.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.sleepless)) add('request-sleepless-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.sleepless.guidanceKnown) {
    for (const bottle of s.sleepless.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶不眠者魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.sleepless.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.sleepless.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '不眠者 · 序列9' : '不眠者之路', discovered: known, guidanceKnown: s.sleepless.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${SLEEPLESS_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.sleepless.resupply.requestedWeek === null ? `已实际接收后续供给${s.sleepless.resupply.deliveries}批。` : `第${s.sleepless.resupply.requestedWeek}周提出补给请求，第${s.sleepless.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: known ? s.sleepless.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 不眠者成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SLEEPLESS_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? (s.progression.sequence!==9?(s.midnight.sleeplessActingAtPromotion??100):s.progression.acting) : 0,
    digestion: isPromoted&&s.progression.sequence!==9?'不眠者阶段已消化，保留原夜班与休整记录。':!isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : s.progression.acting >= 100 ? '不眠者魔药已消化；能力掌握仍按实际守夜与核实分别记录。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先亲自勘察守夜现场，减少睡眠也要保留白天休息。'
          : `已留下不眠者扮演经历（${s.progression.acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${SLEEPLESS_CONSUMPTION_RISK}`
      : '拜访守夜导师，了解不眠者成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    watches: [], environment: '',
  };
}

/** Finite-original conservation and provenance. The watch module additionally validates its own state transitions and combat history. */
export function validateSleeplessState(s: SliceState): boolean {
  const raw: unknown = s.sleepless;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'watches', 'reflected', 'encounter'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SLEEPLESS_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.watches) || !shape(raw.watches, SLEEPLESS_WATCH_IDS)) return false;
  for (const watch of Object.values(raw.watches)) {
    if (!record(watch) || !shape(watch, ['status', 'attemptWeek', 'method'])) return false;
    if (!['AVAILABLE', 'SURVEYED', 'RESOLVED'].includes(watch.status as string) || watch.method !== null && !['OBSERVE', 'REPORT'].includes(watch.method as string)) return false;
    if (watch.attemptWeek !== null && !integer(watch.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'observed', 'night', 'attemptWeek', 'startHistoryIndex'])) return false;
  if (!['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string) || typeof raw.encounter.observed !== 'boolean' || typeof raw.encounter.night !== 'boolean') return false;
  if (raw.encounter.attemptWeek !== null && !integer(raw.encounter.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  if (raw.encounter.startHistoryIndex !== null && !integer(raw.encounter.startHistoryIndex, 0, s.combatHistory.length)) return false;
  const sleepless = raw as unknown as SleeplessState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'darkness' && !isPromoted) return false;
  if (isPromoted) {
    if (!sleepless.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...SLEEPLESS_ABILITY_IDS,...(s.progression.sequence!==9?MIDNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0))))?NIGHTMARE_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0)))?SOOTHER_ABILITY_IDS:[]),...((s.progression.sequence===5||([4, 3, 2].includes(s.progression.sequence ?? 0)))?SPIRIT_WARLOCK_ABILITY_IDS:[]),...(([4, 3, 2].includes(s.progression.sequence ?? 0))?NIGHTWATCHER_ABILITY_IDS:[]),...([3, 2].includes(s.progression.sequence ?? 0) ? FEAR_BISHOP_ABILITY_IDS : []),...(s.progression.sequence === 2 ? CONCEALMENT_SERVANT_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (SLEEPLESS_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || sleepless.reflected
    || Object.values(sleepless.watches).some(watch => watch.status !== 'AVAILABLE' || watch.attemptWeek !== null || watch.method !== null)
    || sleepless.encounter.status !== 'AVAILABLE' || sleepless.encounter.observed || sleepless.encounter.night
    || sleepless.encounter.attemptWeek !== null || sleepless.encounter.startHistoryIndex !== null) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of sleepless.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `sleepless-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < SLEEPLESS_BOTTLE_IDS.length) {
      if (bottle.source !== SLEEPLESS_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!sleepless.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SLEEPLESS_BOTTLE_IDS.length) - 1;
      if (index % SLEEPLESS_BOTTLE_IDS.length === 0) {
        const previous = sleepless.bottles.slice(index - SLEEPLESS_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!sleepless.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week)) return false;
    if (s.progression.promotionWeek !== null && bottle.acquiredWeek! > s.progression.promotionWeek) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(5, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (s.progression.promotionWeek !== null && bottle.consumedWeek! > s.progression.promotionWeek) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== s.progression.promotionWeek) return false;
    }
  }
  if (sleepless.resupply.requestedWeek !== null && (!sleepless.guidanceKnown || !supplyExhausted(sleepless) || sleepless.bottles.some(bottle => bottle.consumedWeek! > sleepless.resupply.requestedWeek!) || s.progression.promotionWeek !== null && sleepless.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}
