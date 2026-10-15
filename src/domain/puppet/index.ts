import {SILENT_DISCIPLE_ABILITY_IDS} from '../silent-disciple/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRISONER_ABILITY_IDS } from '../prisoner/types.js';
import { MADMAN_ABILITY_IDS } from '../madman/types.js';
import { WEREWOLF_ABILITY_IDS } from '../werewolf/types.js';
import { ZOMBIE_ABILITY_IDS } from '../zombie/types.js';
import { WRAITH_ABILITY_IDS } from '../wraith/types.js';
import { prisonerInside } from '../prisoner/life.js';
import { madmanInside } from '../madman/life.js';
import { zombieInside } from '../zombie/life.js';
import { wraithInside } from '../wraith/life.js';
import {
  createPuppetLifeState, validatePuppetLife, validatePuppetActivityCommand,
  puppetLifeActions, projectPuppetLife, hasPuppetLifeLock, applyPuppetActivity, initializePuppetMoon,
} from './life.js';
import {
  createPuppetEncounterState, validatePuppetEncounter, validatePuppetEncounterCommand,
  puppetEncounterActions, projectPuppetEncounter, hasPuppetEncounterLock, applyPuppetEncounterCommand,
} from './encounter.js';
import {
  PUPPET_ABILITIES, PUPPET_BOTTLE_IDS, PUPPET_CONSUMPTION_RISK, PUPPET_FORMULA_STATUS,
  PUPPET_GUIDE, PUPPET_LABOUR_STEPS, PUPPET_LABOUR_TASKS, PUPPET_MIN_WRAITH_WEEKS,
  PUPPET_POTION_SOURCES, PUPPET_PRICES, PUPPET_SOURCE_STATUS,
} from './content.js';
import {
  PUPPET_ABILITY_IDS, type PuppetAcquisitionCommand, type PuppetAction,
  type PuppetBottle, type PuppetCommand, type PuppetProjection, type PuppetState,
} from './types.js';

export function createPuppetState(): PuppetState {
  return {
    guidanceKnown: false,
    bottles: PUPPET_POTION_SOURCES.map(({ id, source }) => ({ id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null,
    wraithActingAtPromotion: null,
    life: createPuppetLifeState(),
    encounter: createPuppetEncounterState(),
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isPuppet = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 4;
const hasPuppetHistory=(s:SliceState)=>s.progression.pathwayId==='chained'&&[4,3].includes(s.progression.sequence!);
const isWraith = (s: SliceState) => s.progression.pathwayId === 'chained' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.prisoner.discovered && s.prisoner.guidanceKnown && s.madman.guidanceKnown && s.werewolf.guidanceKnown && s.zombie.guidanceKnown && s.wraith.guidanceKnown && s.wraith.promotionWeek !== null && (isWraith(s) || hasPuppetHistory(s));
const potionPrice = (bottle: PuppetBottle) => PUPPET_PRICES.potion - (bottle.labourSteps === PUPPET_LABOUR_STEPS ? PUPPET_PRICES.labourCredit : 0);
const bottleNumber = (bottle: PuppetBottle) => Number(bottle.id.slice('puppet-potion-'.length));
const wraithWeeks = (s: SliceState) => Math.max(0, (s.puppet.promotionWeek ?? s.week) - (s.wraith.promotionWeek ?? s.week));
const supplyExhausted = (state: PuppetState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const oldPracticeOpen = (s: SliceState) => prisonerInside(s) || madmanInside(s)
  || Object.values(s.werewolf.cases).some(value => value.sceneOpen) || zombieInside(s) || wraithInside(s)
  || s.zombie.practice.body !== 'NORMAL' || s.zombie.practice.cold === 'ICED' || s.zombie.practice.spirit === 'PRESENT'
  || s.werewolf.moon.pendingWeek !== null || s.zombie.moon.pendingWeek !== null || s.wraith.moon.pendingWeek !== null
  || [s.prisoner, s.madman, s.werewolf, s.zombie, s.wraith].some(stage => Object.values(stage.cases).some(value => value.status === 'PREPARED'));

const deliverySource = (number: number, week: number) => `${PUPPET_GUIDE}的独立木偶成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4木偶魔药，原瓶puppet-potion-${number}，非任何旧序列原瓶改装。完整配方与晋升仪式细节待核，导师实际执行G专业服药准备。`;

function commandBlock(s: SliceState, command: PuppetAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (oldPracticeOpen(s)) return '先实际结束旧实践的接触、原物复位或尚未实施的准备，再继续。';
  if (hasPuppetLifeLock(s) || hasPuppetEncounterLock(s)) return '先实际收束木偶的演练、原物与普通步行路线，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原旧工坊，找到哈伦·维斯。';
  if (!knownChannel(s)) return '成为怨魂并保有哈伦·维斯的原指导渠道后，才能继续了解木偶之路。';
  if (hasPuppetHistory(s)) return '你已完成木偶晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.puppet.guidanceKnown) return '已经听过木偶成品魔药的用药说明。';
    return s.cash < PUPPET_PRICES.guidance ? '木偶用药指导需要540便士。' : null;
  }
  if (!s.puppet.guidanceKnown) return '先听哈伦·维斯说明这批序列4原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.puppet.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.puppet) ? null : '须先用完现有全部木偶原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.puppet.resupply.requestedWeek === null) return '尚未申请下一批木偶补给。';
    if (s.week <= s.puppet.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.puppet) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.puppet.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选木偶原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受实际代价并保持可恢复。';
    if (s.progression.acting !== 100) return `怨魂魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.wraith.promotionWeek === null || wraithWeeks(s) < PUPPET_MIN_WRAITH_WEEKS) return `成为怨魂后已度过${wraithWeeks(s)}/${PUPPET_MIN_WRAITH_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= PUPPET_LABOUR_STEPS ? '这瓶对应的五次原旧工坊劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Called on the slice's working copy. All commands validate before any resource or scene mutation. */
export function applyPuppetCommand(s: SliceState, command: PuppetCommand, c: SeerContext): void {
  rule(validatePuppetCommand(command), '木偶命令无效。');
  if (validatePuppetActivityCommand(command)) {
    applyPuppetActivity(s, command, c, (id, amount = 8) => {
      rule(PUPPET_ABILITY_IDS.includes(id) && Object.hasOwn(s.progression.mastery, id), '不能奖励尚未获得的木偶能力。');
      s.progression.mastery[id] = Math.min(500, s.progression.mastery[id]! + amount);
    });
    return;
  }
  if (validatePuppetEncounterCommand(command)) { applyPuppetEncounterCommand(s, command, c); return; }
  rule(isPuppetAcquisitionCommand(command), '木偶准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= PUPPET_PRICES.guidance;
      s.puppet.guidanceKnown = true;
      c.note('听取木偶用药说明', `花费1行动、540便士，你向已认识的本作原创成年${PUPPET_GUIDE}继续请教。导师实际核对原瓶、准备原旧工坊安静场地与在场照护，说明三瓶独立序列4成品与四档风险。${PUPPET_FORMULA_STATUS}怨魂消化须达100，晋升后满12整周才能服用；可提前筹备。${PUPPET_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.puppet.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = PUPPET_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在哈伦·维斯的原旧工坊实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶5300便士，仍须实际支付1500便士才会交付；不折现、不生成材料。' : '完成对应五次劳务后才能抵这瓶5300便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.puppet.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('木偶原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列4成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原旧工坊劳务抵扣5300便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；怨魂消化100且晋升后满12整周时，再独立确认服药。${PUPPET_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.puppet.resupply.requestedWeek = s.week;
      c.note('申请下一批木偶魔药', `现有木偶原瓶全部耗尽且未晋升。你花费1行动，请${PUPPET_GUIDE}从同一渠道订下一批三瓶，并实际核验原旧工坊收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付6800便士，或分别完成五次劳务后支付1500便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.puppet.bottles.length + 1;
      s.puppet.resupply.deliveries += 1;
      for (let offset = 0; offset < PUPPET_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.puppet.bottles.push({ id: `puppet-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.puppet.resupply.requestedWeek = null;
      c.note('下一批木偶原瓶到货', `第${s.week}周，同一G独立渠道第${s.puppet.resupply.deliveries + 1}批三瓶实际到货，原瓶puppet-potion-${firstNumber}至puppet-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按6800便士购买，或完成对应五次劳务再付1500便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.puppet.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次木偶服药准备', `原成年${PUPPET_GUIDE}在原旧工坊实际核对你手中的原瓶${bottle.id}、准备本次安静场地并在场照护，执行本作G专业准备。原著仪式细节仍未知，不把这些准备冒充已还原原著仪式。`);
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
        s.puppet.wraithActingAtPromotion = s.progression.acting;
        s.puppet.promotionWeek = s.week;
        s.progression.sequence = 4;
        s.progression.acting = 0;
        for (const id of PUPPET_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        initializePuppetMoon(s);
        c.note('成为木偶', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${great ? '大成功' : '成功'}：精神−${mentalCost}${great ? '' : `、灵性实际−${spiritualCost}（规则成本15，最低0）`}，四属性各+1。怨魂消化成果100/100单独保留，木偶扮演从0开始；新增chained.s4.object-motion、chained.s4.cursed-form与chained.s4.curse-link三项0掌握。器物影响、自身木偶或魔法纸人形态与已建立联系的诅咒属于原著能力方向，本次有限实践、条件、数值与代价均为本作原创G，不冒充完整技能表。灵性上限120，当前灵性没有补满。囚犯、疯子、狼人、活尸与怨魂的原ID、原瓶、原人物、原物、伤势、旧贝文结局与月相历史完整保留；旧身体已在ROOM显形、退出原诺兰并盖镜，原旗仍在原桌，WF5-NOTE-1既有交付不重开。晋升当下身体与性别不变，不生成第二身体或免费物品。原哈伦另实际张贴PU4-MOON-1、PU4-MOON-2两张未来工坊告示，分别在本次晋升后第3和第8周形成有限G发作，不套用怨魂吞魂规则，不叠收旧狼人或活尸成本；木偶具体原著诅咒细节仍未核实。全部后续实践仍须实际准备、支付代价与收束。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        const mentalCost = severe ? 45 : 25;
        const healthCost = severe ? 25 : 15;
        s.mind = Math.max(1, s.mind - mentalCost);
        s.health = Math.max(1, s.health - healthCost);
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 60 : 30));
        c.note(severe ? '导师中断了木偶晋升' : '木偶魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：健康−${healthCost}、精神−${mentalCost}、排异+${severe ? 60 : 30}；仅本次G指导服药的健康与精神最低1。你仍是怨魂，消化与全部旧掌握保留，尚未获得木偶能力。导师实际处理排异后仍须休养；重试须另购现有新原瓶，保护不适用于战斗或其它危险。`);
      }
      return;
    }
  }
}

export function projectPuppet(s: SliceState): PuppetProjection {
  const actions: PuppetAction[] = [], available = knownChannel(s), promoted = hasPuppetHistory(s);
  const acting = promoted ? (s.progression.sequence===3?s.silentDisciple.puppetActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: PuppetAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!s.puppet.guidanceKnown) add('learn-puppet-guidance', '请哈伦·维斯说明木偶成品与风险', '1行动 · 540便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.puppet.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < PUPPET_LABOUR_STEPS) add(`work-${bottle.id}`, `第${number}瓶 · ${PUPPET_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶5300便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶木偶魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列4原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.puppet.resupply.requestedWeek !== null) add('receive-puppet-supply', '确认下一批三瓶木偶到货', `0行动 · 第${s.puppet.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.puppet)) add('request-puppet-supply', '向哈伦·维斯订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.puppet.guidanceKnown && !promoted) for (const bottle of s.puppet.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶木偶魔药`, `0行动 · 独立确认 · 怨魂消化${s.progression.acting}/100 · 晋升后${wraithWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  const remaining = s.puppet.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.puppet.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    ...projectPuppetLife(s),
    ...projectPuppetEncounter(s),
    title: promoted ? '木偶 · 序列4' : '木偶之路', discovered: available,
    guidanceKnown: available && s.puppet.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: PUPPET_SOURCE_STATUS } : {}),
    supplies: available ? `${PUPPET_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.puppet.resupply.requestedWeek === null ? `已实际接收后续供给${s.puppet.resupply.deliveries}批。` : `第${s.puppet.resupply.requestedWeek}周提出请求，第${s.puppet.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    bodyChange: available ? '晋升当下保留同一实际人形身体与性别；后续须付费检定才能把自己实际转为神秘木偶或魔法纸人，并显式恢复。没有起点第二具身体、衣物复制、永久无敌或职业自带月冕免疫。' : '',
    inheritedTools: available ? '沿用囚犯、疯子、狼人、活尸与怨魂的全部原能力和实际历史；同一原哈伦、原成年诺兰、旧贝文结局、两面原镜、WF5-FLAG-1原旗与WF5-NOTE-1原纸保持旧状态。全部旧月相记录保留，木偶使用另行公示的有限G事件，不叠收旧发作。' : '',
    actions: [...actions, ...puppetLifeActions(s), ...puppetEncounterActions(s)],
    bottles: available ? s.puppet.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 木偶魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5` : bottle.status === 'PLAYER' ? '已交付，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? PUPPET_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: promoted ? `怨魂消化成果${s.puppet.wraithActingAtPromotion}/100已保留；木偶扮演${acting}/100，能力掌握分别记录。` : available ? `服药前需完成怨魂消化（${s.progression.acting}/100），并在晋升后度过12整周（${wraithWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完怨魂之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${PUPPET_CONSUMPTION_RISK}` : '成为怨魂后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const bottleId = (value: unknown) => typeof value === 'string' && /^puppet-potion-[1-9]\d{0,14}$/.test(value);

export function isPuppetAcquisitionCommand(value: unknown): value is PuppetAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && bottleId(value.bottleId);
  return value.type === 'CONSUME' && shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && bottleId(value.bottleId);
}
export function validatePuppetCommand(value: unknown): value is PuppetCommand {
  return isPuppetAcquisitionCommand(value) || validatePuppetActivityCommand(value) || validatePuppetEncounterCommand(value);
}

/** Exact identities and chronology are validated before delegated scene invariants. */
export function validatePuppetState(s: SliceState): boolean {
  try { return validatePuppetStateRecord(s); } catch { return false; }
}
function validatePuppetStateRecord(s: SliceState): boolean {
  const raw: unknown = s.puppet;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'wraithActingAtPromotion', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.prisoner) || !record(s.madman) || !record(s.werewolf) || !record(s.zombie) || !record(s.wraith)) return false;
  if (!record(raw.life) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory)) return false;
  const firstWraithWeek = s.wraith.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstWraithWeek + PUPPET_MIN_WRAITH_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== PUPPET_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  const state = raw as unknown as PuppetState, promoted = hasPuppetHistory(s);
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.wraith.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.wraithActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS, ...WEREWOLF_ABILITY_IDS, ...ZOMBIE_ABILITY_IDS, ...WRAITH_ABILITY_IDS, ...PUPPET_ABILITY_IDS,...(s.progression.sequence===3?SILENT_DISCIPLE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.wraithActingAtPromotion !== null || PUPPET_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  // First validate every record shape, so a later batch cannot dereference malformed predecessors.
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `puppet-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, PUPPET_LABOUR_STEPS)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of state.bottles.entries()) {
    let stockWeek = firstWraithWeek;
    if (index < PUPPET_BOTTLE_IDS.length) {
      if (bottle.source !== PUPPET_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!state.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / PUPPET_BOTTLE_IDS.length) - 1;
      if (index % PUPPET_BOTTLE_IDS.length === 0) {
        const previous = state.bottles.slice(index - PUPPET_BOTTLE_IDS.length, index);
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
  return successes === (promoted ? 1 : 0) && validatePuppetLife(s) && validatePuppetEncounter(s);
}

export { PUPPET_ABILITIES } from './content.js';
export { PUPPET_CASE_IDS } from './life.js';
export type * from './types.js';
