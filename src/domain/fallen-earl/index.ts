import { ENTROPY_DUKE_ABILITY_IDS } from '../entropy-duke/types.js';
import {FRENZY_MAGE_ABILITY_IDS} from '../frenzy-mage/types.js';
import { isFallenEarl } from './combat.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { LAWYER_ABILITY_IDS } from '../lawyer/types.js';
import { BARBARIAN_ABILITY_IDS } from '../barbarian/types.js';
import { BRIBER_ABILITY_IDS } from '../briber/types.js';
import { CORRUPTION_BARON_ABILITY_IDS } from '../corruption-baron/types.js';
import { MENTOR_DISORDER_ABILITY_IDS } from '../mentor-disorder/types.js';
import { corruptionBaronInside } from '../corruption-baron/life.js';
import { mentorDisorderInside } from '../mentor-disorder/life.js';
import {
  createFallenEarlLifeState, validateFallenEarlLife, validateFallenEarlActivityCommand,
  fallenEarlLifeActions, projectFallenEarlLife, hasFallenEarlLifeLock, applyFallenEarlActivity,
} from './life.js';
import {
  createFallenEarlEncounterState, validateFallenEarlEncounter, validateFallenEarlEncounterCommand,
  fallenEarlEncounterActions, projectFallenEarlEncounter, hasFallenEarlEncounterLock, applyFallenEarlEncounterCommand,
} from './encounter.js';
import {
  FALLEN_EARL_ABILITIES, FALLEN_EARL_BOTTLE_IDS, FALLEN_EARL_CONSUMPTION_RISK, FALLEN_EARL_FORMULA_STATUS,
  FALLEN_EARL_GUIDE, FALLEN_EARL_LABOUR_STEPS, FALLEN_EARL_LABOUR_TASKS, FALLEN_EARL_MIN_MENTOR_DISORDER_WEEKS,
  FALLEN_EARL_POTION_SOURCES, FALLEN_EARL_PRICES, FALLEN_EARL_SOURCE_STATUS,
} from './content.js';
import {
  FALLEN_EARL_ABILITY_IDS, type FallenEarlAcquisitionCommand, type FallenEarlAction,
  type FallenEarlBottle, type FallenEarlCommand, type FallenEarlProjection, type FallenEarlState,
} from './types.js';

export function createFallenEarlState(): FallenEarlState {
  return {
    guidanceKnown: false,
    bottles: FALLEN_EARL_POTION_SOURCES.map(({ id, source }) => ({ id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null,
    mentorDisorderActingAtPromotion: null,
    life: createFallenEarlLifeState(),
    encounter: createFallenEarlEncounterState(),
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export { isFallenEarl } from './combat.js';
const hasFallenEarlHistory=(s:SliceState)=>s.progression.pathwayId==='black-emperor'&&[4,3,2].includes(s.progression.sequence!);
const isMentorDisorder = (s: SliceState) => s.progression.pathwayId === 'black-emperor' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.lawyer.discovered && s.lawyer.guidanceKnown && s.barbarian.formulaKnown && s.briber.formulaKnown && s.corruptionBaron.guidanceKnown && s.mentorDisorder.guidanceKnown && s.mentorDisorder.promotionWeek !== null && (isMentorDisorder(s) || hasFallenEarlHistory(s));
const potionPrice = (bottle: FallenEarlBottle) => FALLEN_EARL_PRICES.potion - (bottle.labourSteps === FALLEN_EARL_LABOUR_STEPS ? FALLEN_EARL_PRICES.labourCredit : 0);
const bottleNumber = (bottle: FallenEarlBottle) => Number(bottle.id.slice('fallen-earl-potion-'.length));
const mentorDisorderWeeks = (s: SliceState) => Math.max(0, (s.fallenEarl.promotionWeek ?? s.week) - (s.mentorDisorder.promotionWeek ?? s.week));
const supplyExhausted = (state: FallenEarlState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const oldPracticeOpen = (s: SliceState) => corruptionBaronInside(s) || mentorDisorderInside(s)
  || ['PENDING', 'ADJUSTED'].includes(s.corruptionBaron.practice.clauseOrder)
  || ['ROLLING', 'SIDE_POCKET'].includes(s.corruptionBaron.practice.marker)
  || ['MOVING', 'DIVERTED'].includes(s.corruptionBaron.practice.route)
  || [s.lawyer, s.barbarian, s.briber, s.corruptionBaron, s.mentorDisorder].some(stage => Object.values(stage.cases).some(value => value.contactOpen || value.status === 'PREPARED'));

const deliverySource = (number: number, week: number) => `${FALLEN_EARL_GUIDE}的独立堕落伯爵成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4堕落伯爵魔药，原瓶fallen-earl-potion-${number}，非任何旧序列原瓶改装。完整配方与晋升仪式细节待核，导师实际执行G专业服药准备。`;

function commandBlock(s: SliceState, command: FallenEarlAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (oldPracticeOpen(s)) return '先实际结束旧实践的接触、原物复位或尚未实施的准备，再继续。';
  if (hasFallenEarlLifeLock(s) || hasFallenEarlEncounterLock(s)) return '先实际收束堕落伯爵的演练、原物与普通步行路线，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原契约铺，找到米蕾·沃德。';
  if (!knownChannel(s)) return '成为混乱导师并保有米蕾·沃德的原指导渠道后，才能继续了解堕落伯爵之路。';
  if (hasFallenEarlHistory(s)) return '你已完成堕落伯爵晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.fallenEarl.guidanceKnown) return '已经听过堕落伯爵成品魔药的用药说明。';
    return s.cash < FALLEN_EARL_PRICES.guidance ? '堕落伯爵用药指导需要540便士。' : null;
  }
  if (!s.fallenEarl.guidanceKnown) return '先听米蕾·沃德说明这批序列4原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.fallenEarl.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.fallenEarl) ? null : '须先用完现有全部堕落伯爵原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.fallenEarl.resupply.requestedWeek === null) return '尚未申请下一批堕落伯爵补给。';
    if (s.week <= s.fallenEarl.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.fallenEarl) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.fallenEarl.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选堕落伯爵原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受实际代价并保持可恢复。';
    if (s.progression.acting !== 100) return `混乱导师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.mentorDisorder.promotionWeek === null || mentorDisorderWeeks(s) < FALLEN_EARL_MIN_MENTOR_DISORDER_WEEKS) return `成为混乱导师后已度过${mentorDisorderWeeks(s)}/${FALLEN_EARL_MIN_MENTOR_DISORDER_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= FALLEN_EARL_LABOUR_STEPS ? '这瓶对应的五次原契约铺劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Called on the slice's working copy. All commands validate before any resource or scene mutation. */
export function applyFallenEarlCommand(s: SliceState, command: FallenEarlCommand, c: SeerContext): void {
  rule(validateFallenEarlCommand(command), '堕落伯爵命令无效。');
  if (validateFallenEarlActivityCommand(command)) {
    applyFallenEarlActivity(s, command, c, (id, amount = 8) => {
      rule(FALLEN_EARL_ABILITY_IDS.includes(id) && Object.hasOwn(s.progression.mastery, id), '不能奖励尚未获得的堕落伯爵能力。');
      s.progression.mastery[id] = Math.min(500, s.progression.mastery[id]! + amount);
    });
    return;
  }
  if (validateFallenEarlEncounterCommand(command)) { applyFallenEarlEncounterCommand(s, command, c); return; }
  rule(isFallenEarlAcquisitionCommand(command), '堕落伯爵准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= FALLEN_EARL_PRICES.guidance;
      s.fallenEarl.guidanceKnown = true;
      c.note('听取堕落伯爵用药说明', `花费1行动、540便士，你向已认识的本作原创成年${FALLEN_EARL_GUIDE}继续请教。导师实际核对原瓶、准备原契约铺安静场地与在场照护，说明三瓶独立序列4成品与四档风险。${FALLEN_EARL_FORMULA_STATUS}混乱导师消化须达100，晋升后满12整周才能服用；可提前筹备。${FALLEN_EARL_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.fallenEarl.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = FALLEN_EARL_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在米蕾·沃德的原契约铺实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶5300便士，仍须实际支付1500便士才会交付；不折现、不生成材料。' : '完成对应五次劳务后才能抵这瓶5300便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.fallenEarl.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('堕落伯爵原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列4成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原契约铺劳务抵扣5300便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；混乱导师消化100且晋升后满12整周时，再独立确认服药。${FALLEN_EARL_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.fallenEarl.resupply.requestedWeek = s.week;
      c.note('申请下一批堕落伯爵魔药', `现有堕落伯爵原瓶全部耗尽且未晋升。你花费1行动，请${FALLEN_EARL_GUIDE}从同一渠道订下一批三瓶，并实际核验原契约铺收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付6800便士，或分别完成五次劳务后支付1500便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.fallenEarl.bottles.length + 1;
      s.fallenEarl.resupply.deliveries += 1;
      for (let offset = 0; offset < FALLEN_EARL_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.fallenEarl.bottles.push({ id: `fallen-earl-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.fallenEarl.resupply.requestedWeek = null;
      c.note('下一批堕落伯爵原瓶到货', `第${s.week}周，同一G独立渠道第${s.fallenEarl.resupply.deliveries + 1}批三瓶实际到货，原瓶fallen-earl-potion-${firstNumber}至fallen-earl-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按6800便士购买，或完成对应五次劳务再付1500便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.fallenEarl.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次堕落伯爵服药准备', `原成年${FALLEN_EARL_GUIDE}在原契约铺实际核对你手中的原瓶${bottle.id}、准备本次安静场地并在场照护，执行本作G专业准备。原著仪式细节仍未知，不把这些准备冒充已还原原著仪式。`);
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
        s.fallenEarl.mentorDisorderActingAtPromotion = s.progression.acting;
        s.fallenEarl.promotionWeek = s.week;
        s.progression.sequence = 4;
        s.progression.acting = 0;
        for (const id of FALLEN_EARL_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        c.note('完成堕落伯爵晋升', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${great ? '大成功' : '成功'}：精神−${mentalCost}${great ? '' : `、灵性实际−${spiritualCost}（规则成本15，最低0）`}，四属性各+1。混乱导师消化成果100/100单独保留，堕落伯爵扮演从0开始；只新增black-emperor.s4.bestow、black-emperor.s4.magnify、black-emperor.s4.exploit三项0掌握。灵性上限120，当前灵性没有补满。律师、野蛮人、贿赂者、腐化男爵与混乱导师五个旧阶段的原ID、原瓶、原人物、原物、伤势和旧里斯结果全部保留；原两枚木筹仍已复位、赛恩的原路线已收束，MD5-NOTE-1原纸仍已交妥。原briber.gifts的每份原礼物、去向与历史完全不改，不另建库存、不补发旧物。晋升当下同一实际身体与性别不变；三项新能力均有有限对象与失败边界，不免费开放神话形态。${FALLEN_EARL_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        const mentalCost = severe ? 45 : 25;
        const healthCost = severe ? 25 : 15;
        s.mind = Math.max(1, s.mind - mentalCost);
        s.health = Math.max(1, s.health - healthCost);
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 60 : 30));
        c.note(severe ? '导师中断了堕落伯爵晋升' : '堕落伯爵魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：健康−${healthCost}、精神−${mentalCost}、排异+${severe ? 60 : 30}；仅本次G指导服药的健康与精神最低1。你仍是混乱导师，消化与全部旧掌握保留，尚未获得堕落伯爵能力。导师实际处理排异后仍须休养；重试须另购现有新原瓶，保护不适用于战斗或其它危险。`);
      }
      return;
    }
  }
}

export function projectFallenEarl(s: SliceState): FallenEarlProjection {
  const actions: FallenEarlAction[] = [], available = knownChannel(s), promoted = hasFallenEarlHistory(s);
  const acting = promoted ? ((s.progression.sequence===3||s.progression.sequence===2)?s.frenzyMage.fallenEarlActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: FallenEarlAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!s.fallenEarl.guidanceKnown) add('learn-fallen-earl-guidance', '请米蕾·沃德说明堕落伯爵成品与风险', '1行动 · 540便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.fallenEarl.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < FALLEN_EARL_LABOUR_STEPS) add(`work-${bottle.id}`, `第${number}瓶 · ${FALLEN_EARL_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶5300便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶堕落伯爵魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列4原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.fallenEarl.resupply.requestedWeek !== null) add('receive-fallen-earl-supply', '确认下一批三瓶堕落伯爵到货', `0行动 · 第${s.fallenEarl.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.fallenEarl)) add('request-fallen-earl-supply', '向米蕾·沃德订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.fallenEarl.guidanceKnown && !promoted) for (const bottle of s.fallenEarl.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶堕落伯爵魔药`, `0行动 · 独立确认 · 混乱导师消化${s.progression.acting}/100 · 晋升后${mentorDisorderWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  const remaining = s.fallenEarl.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.fallenEarl.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    ...projectFallenEarlLife(s),
    ...projectFallenEarlEncounter(s),
    title: promoted ? '堕落伯爵 · 序列4' : '堕落伯爵之路', discovered: available,
    guidanceKnown: available && s.fallenEarl.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: FALLEN_EARL_SOURCE_STATUS } : {}),
    supplies: available ? `${FALLEN_EARL_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.fallenEarl.resupply.requestedWeek === null ? `已实际接收后续供给${s.fallenEarl.resupply.deliveries}批。` : `第${s.fallenEarl.resupply.requestedWeek}周提出请求，第${s.fallenEarl.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    bodyChange: available ? '晋升当下保留同一实际身体与性别。赠予、放大与利用均为有限能力；本切片没有免费神话形态、额外身体、无限飞行或停住时间。' : '',
    inheritedTools: available ? '律师、野蛮人、贿赂者、腐化男爵与混乱导师的原能力和实际历史完整保留；原米蕾·沃德、成年伊芙和赛恩、旧里斯、MD5-RED-1与MD5-BLUE-1两原筹、MD5-ROUTE-MARKER原路标和MD5-NOTE-1原纸保持既有状态。礼物始终只用原briber.gifts库存：晋升不重置、不复制、不补发；新购买仍为逐份有独立ID的真实原物。旧精神抗性与技能保留，不伪称当前无来源攻击下的主动免疫贡献。' : '',
    actions: [...actions, ...fallenEarlLifeActions(s), ...fallenEarlEncounterActions(s)],
    bottles: available ? s.fallenEarl.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 堕落伯爵魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5` : bottle.status === 'PLAYER' ? '已交付，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? FALLEN_EARL_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: promoted ? `混乱导师消化成果${s.fallenEarl.mentorDisorderActingAtPromotion}/100已保留；堕落伯爵扮演${acting}/100，能力掌握分别记录。` : available ? `服药前需完成混乱导师消化（${s.progression.acting}/100），并在晋升后度过12整周（${mentorDisorderWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完混乱导师之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${FALLEN_EARL_CONSUMPTION_RISK}` : '成为混乱导师后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const bottleId = (value: unknown) => typeof value === 'string' && /^fallen-earl-potion-[1-9]\d{0,14}$/.test(value);

export function isFallenEarlAcquisitionCommand(value: unknown): value is FallenEarlAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && bottleId(value.bottleId);
  return value.type === 'CONSUME' && shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && bottleId(value.bottleId);
}
export function validateFallenEarlCommand(value: unknown): value is FallenEarlCommand {
  return isFallenEarlAcquisitionCommand(value) || validateFallenEarlActivityCommand(value) || validateFallenEarlEncounterCommand(value);
}

/** Exact identities and chronology are validated before delegated scene invariants. */
export function validateFallenEarlState(s: SliceState): boolean {
  try { return validateFallenEarlStateRecord(s); } catch { return false; }
}
function validateFallenEarlStateRecord(s: SliceState): boolean {
  const raw: unknown = s.fallenEarl;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'mentorDisorderActingAtPromotion', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.lawyer) || !record(s.barbarian) || !record(s.briber) || !record(s.corruptionBaron) || !record(s.mentorDisorder)) return false;
  if (!record(raw.life) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory)) return false;
  const firstMentorDisorderWeek = s.mentorDisorder.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstMentorDisorderWeek + FALLEN_EARL_MIN_MENTOR_DISORDER_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== FALLEN_EARL_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  const state = raw as unknown as FallenEarlState, promoted = hasFallenEarlHistory(s);
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.mentorDisorder.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.mentorDisorderActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS, ...BRIBER_ABILITY_IDS, ...CORRUPTION_BARON_ABILITY_IDS, ...MENTOR_DISORDER_ABILITY_IDS, ...FALLEN_EARL_ABILITY_IDS,...((s.progression.sequence===3||s.progression.sequence===2)?FRENZY_MAGE_ABILITY_IDS:[]),...(s.progression.sequence===2?ENTROPY_DUKE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.mentorDisorderActingAtPromotion !== null || FALLEN_EARL_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  // First validate every record shape, so a later batch cannot dereference malformed predecessors.
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `fallen-earl-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, FALLEN_EARL_LABOUR_STEPS)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of state.bottles.entries()) {
    let stockWeek = firstMentorDisorderWeek;
    if (index < FALLEN_EARL_BOTTLE_IDS.length) {
      if (bottle.source !== FALLEN_EARL_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!state.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / FALLEN_EARL_BOTTLE_IDS.length) - 1;
      if (index % FALLEN_EARL_BOTTLE_IDS.length === 0) {
        const previous = state.bottles.slice(index - FALLEN_EARL_BOTTLE_IDS.length, index);
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
  return successes === (promoted ? 1 : 0) && validateFallenEarlLife(s) && validateFallenEarlEncounter(s);
}

export { FALLEN_EARL_ABILITIES } from './content.js';
export { FALLEN_EARL_CASE_IDS } from './life.js';
export type * from './types.js';
