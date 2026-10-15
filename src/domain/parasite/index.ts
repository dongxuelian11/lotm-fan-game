import {FATE_TROJAN_ABILITY_IDS} from '../fate-trojan/types.js';
import {DECEIT_MENTOR_ABILITY_IDS} from '../deceit-mentor/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { MARAUDER_ABILITY_IDS } from '../marauder/types.js';
import { SWINDLER_ABILITY_IDS } from '../swindler/types.js';
import { CRYPTOLOGIST_ABILITY_IDS } from '../cryptologist/types.js';
import { FIRE_THIEF_ABILITY_IDS } from '../fire-thief/types.js';
import { DREAM_STEALER_ABILITY_IDS } from '../dream-stealer/types.js';
import { dreamStealerInside } from '../dream-stealer/life.js';
import { fireThiefInside } from '../fire-thief/life.js';
import {
  createParasiteLifeState, validateParasiteLife, validateParasiteActivityCommand,
  parasiteLifeActions, projectParasiteLife, hasParasiteLifeLock, applyParasiteActivity,
} from './life.js';
import {
  createParasiteEncounterState, validateParasiteEncounter, validateParasiteEncounterCommand,
  parasiteEncounterActions, projectParasiteEncounter, hasParasiteEncounterLock, applyParasiteEncounterCommand,
} from './encounter.js';
import {
  PARASITE_ABILITIES, PARASITE_BOTTLE_IDS, PARASITE_CONSUMPTION_RISK, PARASITE_FORMULA_STATUS,
  PARASITE_GUIDE, PARASITE_LABOUR_STEPS, PARASITE_LABOUR_TASKS, PARASITE_MIN_DREAM_STEALER_WEEKS,
  PARASITE_POTION_SOURCES, PARASITE_PRICES, PARASITE_SOURCE_STATUS,
} from './content.js';
import {
  PARASITE_ABILITY_IDS, type ParasiteAcquisitionCommand, type ParasiteAction,
  type ParasiteBottle, type ParasiteCommand, type ParasiteProjection, type ParasiteState,
} from './types.js';

export function createParasiteState(): ParasiteState {
  return {
    guidanceKnown: false,
    bottles: PARASITE_POTION_SOURCES.map(({ id, source }) => ({ id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null,
    dreamStealerActingAtPromotion: null,
    life: createParasiteLifeState(),
    encounter: createParasiteEncounterState(),
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isParasite = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 4;
const hasParasiteHistory=(s:SliceState)=>s.progression.pathwayId==='error'&&[4,3,2].includes(s.progression.sequence!);
const isDreamStealer = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.marauder.discovered && s.marauder.guidanceKnown && s.swindler.guidanceKnown && s.cryptologist.guidanceKnown && s.fireThief.guidanceKnown && s.dreamStealer.guidanceKnown && s.dreamStealer.promotionWeek !== null && (isDreamStealer(s) || hasParasiteHistory(s));
const potionPrice = (bottle: ParasiteBottle) => PARASITE_PRICES.potion - (bottle.labourSteps === PARASITE_LABOUR_STEPS ? PARASITE_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ParasiteBottle) => Number(bottle.id.slice('parasite-potion-'.length));
const dreamStealerWeeks = (s: SliceState) => Math.max(0, (s.parasite.promotionWeek ?? s.week) - (s.dreamStealer.promotionWeek ?? s.week));
const supplyExhausted = (state: ParasiteState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const oldPracticeOpen = (s: SliceState) => dreamStealerInside(s) || fireThiefInside(s) || [s.marauder, s.swindler, s.cryptologist, s.fireThief, s.dreamStealer].some(stage => Object.values(stage.cases).some(value => value.status === 'PREPARED'));
const deliverySource = (number: number, week: number) => `${PARASITE_GUIDE}的独立寄生者成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4寄生者魔药，原瓶parasite-potion-${number}，非任何旧序列原瓶改装。完整配方与晋升仪式细节待核，导师实际执行G专业服药准备。`;

function commandBlock(s: SliceState, command: ParasiteAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (oldPracticeOpen(s)) return '先实际结束旧实践的接触、原物复位或尚未实施的准备，再继续。';
  if (hasParasiteLifeLock(s) || hasParasiteEncounterLock(s)) return '先实际结束寄生者的有限接触或当前借用，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原练习室，找到艾德温·洛克。';
  if (!knownChannel(s)) return '成为窃梦家并保有艾德温·洛克的原指导渠道后，才能继续了解寄生者之路。';
  if (hasParasiteHistory(s)) return '你已完成寄生者晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.parasite.guidanceKnown) return '已经听过寄生者成品魔药的用药说明。';
    return s.cash < PARASITE_PRICES.guidance ? '寄生者用药指导需要540便士。' : null;
  }
  if (!s.parasite.guidanceKnown) return '先听艾德温·洛克说明这批序列4原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.parasite.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.parasite) ? null : '须先用完现有全部寄生者原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.parasite.resupply.requestedWeek === null) return '尚未申请下一批寄生者补给。';
    if (s.week <= s.parasite.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.parasite) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.parasite.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选寄生者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受实际代价并保持可恢复。';
    if (s.progression.acting !== 100) return `窃梦家魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.dreamStealer.promotionWeek === null || dreamStealerWeeks(s) < PARASITE_MIN_DREAM_STEALER_WEEKS) return `成为窃梦家后已度过${dreamStealerWeeks(s)}/${PARASITE_MIN_DREAM_STEALER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= PARASITE_LABOUR_STEPS ? '这瓶对应的五次原练习室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Called on the slice's working copy. All commands validate before any resource or scene mutation. */
export function applyParasiteCommand(s: SliceState, command: ParasiteCommand, c: SeerContext): void {
  rule(validateParasiteCommand(command), '寄生者命令无效。');
  if (validateParasiteActivityCommand(command)) {
    applyParasiteActivity(s, command, c, (id, amount = 8) => {
      rule(PARASITE_ABILITY_IDS.includes(id) && Object.hasOwn(s.progression.mastery, id), '不能奖励尚未获得的寄生者能力。');
      s.progression.mastery[id] = Math.min(500, s.progression.mastery[id]! + amount);
    });
    return;
  }
  if (validateParasiteEncounterCommand(command)) { applyParasiteEncounterCommand(s, command, c); return; }
  rule(isParasiteAcquisitionCommand(command), '寄生者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= PARASITE_PRICES.guidance;
      s.parasite.guidanceKnown = true;
      c.note('听取寄生者用药说明', `花费1行动、540便士，你向已认识的本作原创成年${PARASITE_GUIDE}继续请教。导师实际核对原瓶、准备原练习室安静场地与在场照护，说明三瓶独立序列4成品与四档风险。${PARASITE_FORMULA_STATUS}窃梦家消化须达100，晋升后满12整周才能服用；可提前筹备。${PARASITE_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.parasite.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = PARASITE_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在艾德温·洛克的原练习室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶5300便士，仍须实际支付1500便士才会交付；不折现、不生成材料。' : '完成对应五次劳务后才能抵这瓶5300便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.parasite.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('寄生者原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列4成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原练习室劳务抵扣5300便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；窃梦家消化100且晋升后满12整周时，再独立确认服药。${PARASITE_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.parasite.resupply.requestedWeek = s.week;
      c.note('申请下一批寄生者魔药', `现有寄生者原瓶全部耗尽且未晋升。你花费1行动，请${PARASITE_GUIDE}从同一渠道订下一批三瓶，并实际核验原练习室收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付6800便士，或分别完成五次劳务后支付1500便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.parasite.bottles.length + 1;
      s.parasite.resupply.deliveries += 1;
      for (let offset = 0; offset < PARASITE_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.parasite.bottles.push({ id: `parasite-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.parasite.resupply.requestedWeek = null;
      c.note('下一批寄生者原瓶到货', `第${s.week}周，同一G独立渠道第${s.parasite.resupply.deliveries + 1}批三瓶实际到货，原瓶parasite-potion-${firstNumber}至parasite-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按6800便士购买，或完成对应五次劳务再付1500便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.parasite.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次寄生者服药准备', `原成年${PARASITE_GUIDE}在原练习室实际核对你手中的原瓶${bottle.id}、准备本次安静场地并在场照护，执行本作G专业准备。原著仪式细节仍未知，不把这些准备冒充已还原原著仪式。`);
      const result = c.check('will', 28);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const great = result.tier === 'GREAT_SUCCESS';
        const mentalCost = great ? 4 : 8;
        const spiritualCost = great ? 0 : Math.min(15, s.spirituality);
        s.mind = Math.max(1, s.mind - mentalCost);
        s.spirituality -= spiritualCost;
        s.parasite.dreamStealerActingAtPromotion = s.progression.acting;
        s.parasite.promotionWeek = s.week;
        s.progression.sequence = 4;
        s.progression.acting = 0;
        for (const id of PARASITE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        c.note('成为寄生者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${great ? '大成功' : '成功'}：精神−${mentalCost}${great ? '' : `、灵性实际−${spiritualCost}（规则成本15，最低0）`}，四属性各+1。窃梦家消化成果100/100单独保留，寄生者扮演从0开始；全部旧原ID掌握、性别、原人物、原物与真实历史完整保留，只新增有限寄生和延后念头两项0掌握。灵性上限120，当前灵性没有补满；没有附赠被窃能力或外部第二身体。初步寄生不读取思想，全面控制须另行取得本次有限任务同意；可以延后显现窃得的当前念头，不再强制本人立即执行。所有后续实践仍须实际准备、支付代价与收束。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        const mentalCost = severe ? 45 : 25;
        const healthCost = severe ? 25 : 15;
        s.mind = Math.max(1, s.mind - mentalCost);
        s.health = Math.max(1, s.health - healthCost);
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 60 : 30));
        c.note(severe ? '导师中断了寄生者晋升' : '寄生者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：健康−${healthCost}、精神−${mentalCost}、排异+${severe ? 60 : 30}；仅本次G指导服药的健康与精神最低1。你仍是窃梦家，消化与全部旧掌握保留，尚未获得寄生者能力。导师实际处理排异后仍须休养；重试须另购现有新原瓶，保护不适用于战斗或其它危险。`);
      }
      return;
    }
  }
}

export function projectParasite(s: SliceState): ParasiteProjection {
  const actions: ParasiteAction[] = [], available = knownChannel(s), promoted = hasParasiteHistory(s);
  const acting = promoted ? ((s.progression.sequence===3||s.progression.sequence===2)?s.deceitMentor.parasiteActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: ParasiteAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!s.parasite.guidanceKnown) add('learn-parasite-guidance', '请艾德温·洛克说明寄生者成品与风险', '1行动 · 540便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.parasite.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < PARASITE_LABOUR_STEPS) add(`work-${bottle.id}`, `第${number}瓶 · ${PARASITE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶5300便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶寄生者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列4原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.parasite.resupply.requestedWeek !== null) add('receive-parasite-supply', '确认下一批三瓶寄生者到货', `0行动 · 第${s.parasite.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.parasite)) add('request-parasite-supply', '向艾德温·洛克订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.parasite.guidanceKnown && !promoted) for (const bottle of s.parasite.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶寄生者魔药`, `0行动 · 独立确认 · 窃梦家消化${s.progression.acting}/100 · 晋升后${dreamStealerWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  const remaining = s.parasite.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.parasite.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    ...projectParasiteLife(s),
    ...projectParasiteEncounter(s),
    title: promoted ? '寄生者 · 序列4' : '寄生者之路', discovered: available,
    guidanceKnown: available && s.parasite.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: PARASITE_SOURCE_STATUS } : {}),
    supplies: available ? `${PARASITE_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.parasite.resupply.requestedWeek === null ? `已实际接收后续供给${s.parasite.resupply.deliveries}批。` : `第${s.parasite.resupply.requestedWeek}周提出请求，第${s.parasite.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions: [...actions, ...parasiteLifeActions(s), ...parasiteEncounterActions(s)],
    bottles: available ? s.parasite.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 寄生者魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5` : bottle.status === 'PLAYER' ? '已交付，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? PARASITE_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: promoted ? `窃梦家消化成果${s.parasite.dreamStealerActingAtPromotion}/100已保留；寄生者扮演${acting}/100，能力掌握分别记录。` : available ? `服药前需完成窃梦家消化（${s.progression.acting}/100），并在晋升后度过12整周（${dreamStealerWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完窃梦家之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${PARASITE_CONSUMPTION_RISK}` : '成为窃梦家后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const bottleId = (value: unknown) => typeof value === 'string' && /^parasite-potion-[1-9]\d{0,14}$/.test(value);

export function isParasiteAcquisitionCommand(value: unknown): value is ParasiteAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && bottleId(value.bottleId);
  return value.type === 'CONSUME' && shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && bottleId(value.bottleId);
}
export function validateParasiteCommand(value: unknown): value is ParasiteCommand {
  return isParasiteAcquisitionCommand(value) || validateParasiteActivityCommand(value) || validateParasiteEncounterCommand(value);
}

/** Exact identities and chronology are validated before delegated scene invariants. */
export function validateParasiteState(s: SliceState): boolean {
  try { return validateParasiteStateRecord(s); } catch { return false; }
}
function validateParasiteStateRecord(s: SliceState): boolean {
  const raw: unknown = s.parasite;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'dreamStealerActingAtPromotion', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.marauder) || !record(s.swindler) || !record(s.cryptologist) || !record(s.fireThief) || !record(s.dreamStealer)) return false;
  if (!record(raw.life) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory)) return false;
  const firstDreamStealerWeek = s.dreamStealer.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstDreamStealerWeek + PARASITE_MIN_DREAM_STEALER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== PARASITE_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  const state = raw as unknown as ParasiteState, promoted = hasParasiteHistory(s);
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.dreamStealer.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.dreamStealerActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...MARAUDER_ABILITY_IDS, ...SWINDLER_ABILITY_IDS, ...CRYPTOLOGIST_ABILITY_IDS, ...FIRE_THIEF_ABILITY_IDS, ...DREAM_STEALER_ABILITY_IDS, ...PARASITE_ABILITY_IDS,...((s.progression.sequence===3||s.progression.sequence===2)?DECEIT_MENTOR_ABILITY_IDS:[]),...(s.progression.sequence===2?FATE_TROJAN_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.dreamStealerActingAtPromotion !== null || PARASITE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  // First validate every record shape, so a later batch cannot dereference malformed predecessors.
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `parasite-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, PARASITE_LABOUR_STEPS)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of state.bottles.entries()) {
    let stockWeek = firstDreamStealerWeek;
    if (index < PARASITE_BOTTLE_IDS.length) {
      if (bottle.source !== PARASITE_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!state.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / PARASITE_BOTTLE_IDS.length) - 1;
      if (index % PARASITE_BOTTLE_IDS.length === 0) {
        const previous = state.bottles.slice(index - PARASITE_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (promoted && stockWeek > state.promotionWeek!) return false;
    }
    if (!state.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || promoted && bottle.acquiredWeek! > state.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (promoted ? bottle.consumedWeek! > state.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== state.promotionWeek) return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || promoted || !supplyExhausted(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateParasiteLife(s) && validateParasiteEncounter(s);
}

export { PARASITE_ABILITIES } from './content.js';
export { PARASITE_CASE_IDS } from './life.js';
export type * from './types.js';
