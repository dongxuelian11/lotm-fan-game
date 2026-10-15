import { BALANCER_ABILITY_IDS } from '../balancer/types.js';
import {CHAOS_HUNTER_ABILITY_IDS} from '../chaos-hunter/types.js';
import { isImperativeMage } from './combat.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ARBITER_ABILITY_IDS } from '../arbiter/types.js';
import { SHERIFF_ABILITY_IDS } from '../sheriff/types.js';
import { INTERROGATOR_ABILITY_IDS } from '../interrogator/types.js';
import { JUDGE_ABILITY_IDS } from '../judge/types.js';
import { PUNISHMENT_KNIGHT_ABILITY_IDS } from '../punishment-knight/types.js';
import { hasJudgeOpenPractice } from '../judge/encounter.js';
import { punishmentKnightInside } from '../punishment-knight/life.js';
import {
  createImperativeMageLifeState, validateImperativeMageLife, validateImperativeMageActivityCommand,
  imperativeMageLifeActions, projectImperativeMageLife, hasImperativeMageLifeLock, applyImperativeMageActivity,
} from './life.js';
import {
  createImperativeMageEncounterState, validateImperativeMageEncounter, validateImperativeMageEncounterCommand,
  imperativeMageEncounterActions, projectImperativeMageEncounter, hasImperativeMageEncounterLock, applyImperativeMageEncounterCommand,
} from './encounter.js';
import {
  IMPERATIVE_MAGE_ABILITIES, IMPERATIVE_MAGE_BOTTLE_IDS, IMPERATIVE_MAGE_CONSUMPTION_RISK, IMPERATIVE_MAGE_FORMULA_STATUS,
  IMPERATIVE_MAGE_GUIDE, IMPERATIVE_MAGE_LABOUR_STEPS, IMPERATIVE_MAGE_LABOUR_TASKS, IMPERATIVE_MAGE_MIN_PUNISHMENT_KNIGHT_WEEKS,
  IMPERATIVE_MAGE_POTION_SOURCES, IMPERATIVE_MAGE_PRICES, IMPERATIVE_MAGE_SOURCE_STATUS,
} from './content.js';
import {
  IMPERATIVE_MAGE_ABILITY_IDS, type ImperativeMageAcquisitionCommand, type ImperativeMageAction,
  type ImperativeMageBottle, type ImperativeMageCommand, type ImperativeMageProjection, type ImperativeMageState,
} from './types.js';

export function createImperativeMageState(): ImperativeMageState {
  return {
    guidanceKnown: false,
    bottles: IMPERATIVE_MAGE_POTION_SOURCES.map(({ id, source }) => ({ id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null,
    punishmentKnightActingAtPromotion: null,
    life: createImperativeMageLifeState(),
    encounter: createImperativeMageEncounterState(),
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export { isImperativeMage } from './combat.js';
const hasImperativeMageHistory=(s:SliceState)=>s.progression.pathwayId==='justiciar'&&[4,3,2].includes(s.progression.sequence!);
const isPunishmentKnight = (s: SliceState) => s.progression.pathwayId === 'justiciar' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.arbiter.discovered && s.arbiter.guidanceKnown && s.sheriff.guidanceKnown && s.interrogator.guidanceKnown && s.judge.guidanceKnown && s.punishmentKnight.guidanceKnown && s.punishmentKnight.promotionWeek !== null && (isPunishmentKnight(s) || hasImperativeMageHistory(s));
const potionPrice = (bottle: ImperativeMageBottle) => IMPERATIVE_MAGE_PRICES.potion - (bottle.labourSteps === IMPERATIVE_MAGE_LABOUR_STEPS ? IMPERATIVE_MAGE_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ImperativeMageBottle) => Number(bottle.id.slice('imperative-mage-potion-'.length));
const punishmentKnightWeeks = (s: SliceState) => Math.max(0, (s.imperativeMage.promotionWeek ?? s.week) - (s.punishmentKnight.promotionWeek ?? s.week));
const supplyExhausted = (state: ImperativeMageState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const oldPracticeOpen = (s: SliceState) => hasJudgeOpenPractice(s) || punishmentKnightInside(s)
  || [s.arbiter, s.sheriff, s.interrogator, s.judge, s.punishmentKnight].some(stage => Object.values(stage.cases).some(value => value.contactOpen || value.status === 'PREPARED'));

const deliverySource = (number: number, week: number) => `${IMPERATIVE_MAGE_GUIDE}的独立律令法师成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4律令法师魔药，原瓶imperative-mage-potion-${number}，非任何旧序列原瓶改装。完整配方与晋升仪式细节待核，导师实际执行G专业服药准备。`;

function commandBlock(s: SliceState, command: ImperativeMageAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (oldPracticeOpen(s)) return '先实际结束旧实践的接触、原物复位或尚未实施的准备，再继续。';
  if (hasImperativeMageLifeLock(s) || hasImperativeMageEncounterLock(s)) return '先实际收束律令法师的演练、原物与普通步行路线，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原调解处，找到薇娜·贝尔。';
  if (!knownChannel(s)) return '成为惩戒骑士并保有薇娜·贝尔的原指导渠道后，才能继续了解律令法师之路。';
  if (hasImperativeMageHistory(s)) return '你已完成律令法师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.imperativeMage.guidanceKnown) return '已经听过律令法师成品魔药的用药说明。';
    return s.cash < IMPERATIVE_MAGE_PRICES.guidance ? '律令法师用药指导需要540便士。' : null;
  }
  if (!s.imperativeMage.guidanceKnown) return '先听薇娜·贝尔说明这批序列4原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.imperativeMage.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.imperativeMage) ? null : '须先用完现有全部律令法师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.imperativeMage.resupply.requestedWeek === null) return '尚未申请下一批律令法师补给。';
    if (s.week <= s.imperativeMage.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.imperativeMage) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.imperativeMage.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选律令法师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受实际代价并保持可恢复。';
    if (s.progression.acting !== 100) return `惩戒骑士魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.punishmentKnight.promotionWeek === null || punishmentKnightWeeks(s) < IMPERATIVE_MAGE_MIN_PUNISHMENT_KNIGHT_WEEKS) return `成为惩戒骑士后已度过${punishmentKnightWeeks(s)}/${IMPERATIVE_MAGE_MIN_PUNISHMENT_KNIGHT_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= IMPERATIVE_MAGE_LABOUR_STEPS ? '这瓶对应的五次原调解处劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Called on the slice's working copy. All commands validate before any resource or scene mutation. */
export function applyImperativeMageCommand(s: SliceState, command: ImperativeMageCommand, c: SeerContext): void {
  rule(validateImperativeMageCommand(command), '律令法师命令无效。');
  if (validateImperativeMageActivityCommand(command)) {
    applyImperativeMageActivity(s, command, c, (id, amount = 8) => {
      rule((IMPERATIVE_MAGE_ABILITY_IDS.some(known => known === id) || id === 'justiciar.s6.prohibition') && Object.hasOwn(s.progression.mastery, id), '不能奖励尚未获得的新能力或继承禁令。');
      s.progression.mastery[id] = Math.min(500, s.progression.mastery[id]! + amount);
    });
    return;
  }
  if (validateImperativeMageEncounterCommand(command)) { applyImperativeMageEncounterCommand(s, command, c); return; }
  rule(isImperativeMageAcquisitionCommand(command), '律令法师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= IMPERATIVE_MAGE_PRICES.guidance;
      s.imperativeMage.guidanceKnown = true;
      c.note('听取律令法师用药说明', `花费1行动、540便士，你向已认识的本作原创成年${IMPERATIVE_MAGE_GUIDE}继续请教。导师实际核对原瓶、准备原调解处安静场地与在场照护，说明三瓶独立序列4成品与四档风险。${IMPERATIVE_MAGE_FORMULA_STATUS}惩戒骑士消化须达100，晋升后满12整周才能服用；可提前筹备。${IMPERATIVE_MAGE_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.imperativeMage.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = IMPERATIVE_MAGE_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在薇娜·贝尔的原调解处实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶5300便士，仍须实际支付1500便士才会交付；不折现、不生成材料。' : '完成对应五次劳务后才能抵这瓶5300便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.imperativeMage.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('律令法师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列4成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原调解处劳务抵扣5300便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；惩戒骑士消化100且晋升后满12整周时，再独立确认服药。${IMPERATIVE_MAGE_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.imperativeMage.resupply.requestedWeek = s.week;
      c.note('申请下一批律令法师魔药', `现有律令法师原瓶全部耗尽且未晋升。你花费1行动，请${IMPERATIVE_MAGE_GUIDE}从同一渠道订下一批三瓶，并实际核验原调解处收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付6800便士，或分别完成五次劳务后支付1500便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.imperativeMage.bottles.length + 1;
      s.imperativeMage.resupply.deliveries += 1;
      for (let offset = 0; offset < IMPERATIVE_MAGE_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.imperativeMage.bottles.push({ id: `imperative-mage-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.imperativeMage.resupply.requestedWeek = null;
      c.note('下一批律令法师原瓶到货', `第${s.week}周，同一G独立渠道第${s.imperativeMage.resupply.deliveries + 1}批三瓶实际到货，原瓶imperative-mage-potion-${firstNumber}至imperative-mage-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按6800便士购买，或完成对应五次劳务再付1500便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.imperativeMage.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次律令法师服药准备', `原成年${IMPERATIVE_MAGE_GUIDE}在原调解处实际核对你手中的原瓶${bottle.id}、准备本次安静场地并在场照护，执行本作G专业准备。原著仪式细节仍未知，不把这些准备冒充已还原原著仪式。`);
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
        s.imperativeMage.punishmentKnightActingAtPromotion = s.progression.acting;
        s.imperativeMage.promotionWeek = s.week;
        s.progression.sequence = 4;
        s.progression.acting = 0;
        for (const id of IMPERATIVE_MAGE_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        c.note('完成律令法师晋升', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${great ? '大成功' : '成功'}：精神−${mentalCost}${great ? '' : `、灵性实际−${spiritualCost}（规则成本15，最低0）`}，四属性各+1。惩戒骑士消化成果100/100单独保留，律令法师扮演从0开始；只新增justiciar.s4.intimidation、justiciar.s4.deprivation两项0掌握。灵性上限120，当前灵性没有补满。仲裁人、治安官、审讯者、法官与惩戒骑士五个旧阶段的原ID、原瓶、原人物、原物、伤势和旧迪恩结果全部保留；原PK5-SOFT-PAD-1仍在原支架STAND，阿伦仍FREE，原禁令NONE，PK5-NOTE-1原纸仍HANDED_OVER；不重置旧实践，不重启旧迪恩。晋升当下同一实际身体与性别不变；两项新能力均有有限对象与失败边界，不免费开放神话形态。${IMPERATIVE_MAGE_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        const mentalCost = severe ? 45 : 25;
        const healthCost = severe ? 25 : 15;
        s.mind = Math.max(1, s.mind - mentalCost);
        s.health = Math.max(1, s.health - healthCost);
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 60 : 30));
        c.note(severe ? '导师中断了律令法师晋升' : '律令法师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：健康−${healthCost}、精神−${mentalCost}、排异+${severe ? 60 : 30}；仅本次G指导服药的健康与精神最低1。你仍是惩戒骑士，消化与全部旧掌握保留，尚未获得律令法师能力。导师实际处理排异后仍须休养；重试须另购现有新原瓶，保护不适用于战斗或其它危险。`);
      }
      return;
    }
  }
}

export function projectImperativeMage(s: SliceState): ImperativeMageProjection {
  const actions: ImperativeMageAction[] = [], available = knownChannel(s), promoted = hasImperativeMageHistory(s);
  const acting = promoted ? ((s.progression.sequence===3||s.progression.sequence===2)?s.chaosHunter.imperativeMageActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: ImperativeMageAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!s.imperativeMage.guidanceKnown) add('learn-imperative-mage-guidance', '请薇娜·贝尔说明律令法师成品与风险', '1行动 · 540便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.imperativeMage.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < IMPERATIVE_MAGE_LABOUR_STEPS) add(`work-${bottle.id}`, `第${number}瓶 · ${IMPERATIVE_MAGE_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶5300便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶律令法师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列4原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.imperativeMage.resupply.requestedWeek !== null) add('receive-imperative-mage-supply', '确认下一批三瓶律令法师到货', `0行动 · 第${s.imperativeMage.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.imperativeMage)) add('request-imperative-mage-supply', '向薇娜·贝尔订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.imperativeMage.guidanceKnown && !promoted) for (const bottle of s.imperativeMage.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶律令法师魔药`, `0行动 · 独立确认 · 惩戒骑士消化${s.progression.acting}/100 · 晋升后${punishmentKnightWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  const remaining = s.imperativeMage.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.imperativeMage.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    ...projectImperativeMageLife(s),
    ...projectImperativeMageEncounter(s),
    title: promoted ? '律令法师 · 序列4' : '律令法师之路', discovered: available,
    guidanceKnown: available && s.imperativeMage.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: IMPERATIVE_MAGE_SOURCE_STATUS } : {}),
    supplies: available ? `${IMPERATIVE_MAGE_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.imperativeMage.resupply.requestedWeek === null ? `已实际接收后续供给${s.imperativeMage.resupply.deliveries}批。` : `第${s.imperativeMage.resupply.requestedWeek}周提出请求，第${s.imperativeMage.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    bodyChange: available ? '晋升当下保留同一实际身体与性别。威慑和暂时剥夺均为有限可抵抗能力；本切片没有免费神话形态、无条件死亡宣告、永久能力剥夺或世界法则改写。' : '',
    inheritedTools: available ? '仲裁人、治安官、审讯者、法官与惩戒骑士五个旧阶段的原能力、原ID掌握和实际历史完整保留。原薇娜·贝尔与成年阿伦、已解决的旧迪恩、PK5-SOFT-PAD-1原软垫、PK5-LINE-1原线和PK5-NOTE-1原纸均保持既有状态。原惩戒、有限囚禁、既有伤口裁决及精神刺穿均未删除；本次有限战盘只选择其中适用项，不伪称每一旧能力都在本轮主动生效。新戏法大师仍用本人的原FLASH，玩家没有复制或学会它，不取得官方身份。' : '',
    actions: [...actions, ...imperativeMageLifeActions(s), ...imperativeMageEncounterActions(s)],
    bottles: available ? s.imperativeMage.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 律令法师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5` : bottle.status === 'PLAYER' ? '已交付，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? IMPERATIVE_MAGE_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: promoted ? `惩戒骑士消化成果${s.imperativeMage.punishmentKnightActingAtPromotion}/100已保留；律令法师扮演${acting}/100，能力掌握分别记录。` : available ? `服药前需完成惩戒骑士消化（${s.progression.acting}/100），并在晋升后度过12整周（${punishmentKnightWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完惩戒骑士之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${IMPERATIVE_MAGE_CONSUMPTION_RISK}` : '成为惩戒骑士后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const bottleId = (value: unknown) => typeof value === 'string' && /^imperative-mage-potion-[1-9]\d{0,14}$/.test(value);

export function isImperativeMageAcquisitionCommand(value: unknown): value is ImperativeMageAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && bottleId(value.bottleId);
  return value.type === 'CONSUME' && shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && bottleId(value.bottleId);
}
export function validateImperativeMageCommand(value: unknown): value is ImperativeMageCommand {
  return isImperativeMageAcquisitionCommand(value) || validateImperativeMageActivityCommand(value) || validateImperativeMageEncounterCommand(value);
}

/** Exact identities and chronology are validated before delegated scene invariants. */
export function validateImperativeMageState(s: SliceState): boolean {
  try { return validateImperativeMageStateRecord(s); } catch { return false; }
}
function validateImperativeMageStateRecord(s: SliceState): boolean {
  const raw: unknown = s.imperativeMage;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'punishmentKnightActingAtPromotion', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.arbiter) || !record(s.sheriff) || !record(s.interrogator) || !record(s.judge) || !record(s.punishmentKnight)) return false;
  if (!record(raw.life) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory)) return false;
  const firstPunishmentKnightWeek = s.punishmentKnight.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstPunishmentKnightWeek + IMPERATIVE_MAGE_MIN_PUNISHMENT_KNIGHT_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== IMPERATIVE_MAGE_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  const state = raw as unknown as ImperativeMageState, promoted = hasImperativeMageHistory(s);
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.punishmentKnight.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.punishmentKnightActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS, ...INTERROGATOR_ABILITY_IDS, ...JUDGE_ABILITY_IDS, ...PUNISHMENT_KNIGHT_ABILITY_IDS, ...IMPERATIVE_MAGE_ABILITY_IDS,...((s.progression.sequence===3||s.progression.sequence===2)?CHAOS_HUNTER_ABILITY_IDS:[]),...(s.progression.sequence===2?BALANCER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.punishmentKnightActingAtPromotion !== null || IMPERATIVE_MAGE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  // First validate every record shape, so a later batch cannot dereference malformed predecessors.
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `imperative-mage-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, IMPERATIVE_MAGE_LABOUR_STEPS)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of state.bottles.entries()) {
    let stockWeek = firstPunishmentKnightWeek;
    if (index < IMPERATIVE_MAGE_BOTTLE_IDS.length) {
      if (bottle.source !== IMPERATIVE_MAGE_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!state.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / IMPERATIVE_MAGE_BOTTLE_IDS.length) - 1;
      if (index % IMPERATIVE_MAGE_BOTTLE_IDS.length === 0) {
        const previous = state.bottles.slice(index - IMPERATIVE_MAGE_BOTTLE_IDS.length, index);
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
  return successes === (promoted ? 1 : 0) && validateImperativeMageLife(s) && validateImperativeMageEncounter(s);
}

export { IMPERATIVE_MAGE_ABILITIES } from './content.js';
export { IMPERATIVE_MAGE_CASE_IDS } from './life.js';
export type * from './types.js';
