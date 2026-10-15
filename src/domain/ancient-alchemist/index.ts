import {COFFIN_BEARER_ABILITY_IDS} from '../coffin-bearer/types.js';
import { isAncientAlchemist } from './combat.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { CULTIVATOR_ABILITY_IDS } from '../cultivator/types.js';
import { PHYSICIAN_ABILITY_IDS } from '../physician/types.js';
import { HARVESTPRIEST_ABILITY_IDS } from '../harvestpriest/types.js';
import { BIOLOGIST_ABILITY_IDS } from '../biologist/types.js';
import { DRUID_ABILITY_IDS } from '../druid/types.js';
import { hasBiologistOpenPractice } from '../biologist/encounter.js';
import { druidInside } from '../druid/life.js';
import {
  createAncientAlchemistLifeState, validateAncientAlchemistLife, validateAncientAlchemistActivityCommand,
  ancientAlchemistLifeActions, projectAncientAlchemistLife, hasAncientAlchemistLifeLock, applyAncientAlchemistActivity,
} from './life.js';
import {
  createAncientAlchemistEncounterState, validateAncientAlchemistEncounter, validateAncientAlchemistEncounterCommand,
  ancientAlchemistEncounterActions, projectAncientAlchemistEncounter, hasAncientAlchemistEncounterLock, applyAncientAlchemistEncounterCommand,
} from './encounter.js';
import {
  ANCIENT_ALCHEMIST_ABILITIES, ANCIENT_ALCHEMIST_BOTTLE_IDS, ANCIENT_ALCHEMIST_CONSUMPTION_RISK, ANCIENT_ALCHEMIST_FORMULA_STATUS,
  ANCIENT_ALCHEMIST_GUIDE, ANCIENT_ALCHEMIST_LABOUR_STEPS, ANCIENT_ALCHEMIST_LABOUR_TASKS, ANCIENT_ALCHEMIST_MIN_DRUID_WEEKS,
  ANCIENT_ALCHEMIST_POTION_SOURCES, ANCIENT_ALCHEMIST_PRICES, ANCIENT_ALCHEMIST_SOURCE_STATUS,
} from './content.js';
import {
  ANCIENT_ALCHEMIST_ABILITY_IDS, type AncientAlchemistAcquisitionCommand, type AncientAlchemistAction,
  type AncientAlchemistBottle, type AncientAlchemistCommand, type AncientAlchemistProjection, type AncientAlchemistState,
} from './types.js';

export function createAncientAlchemistState(): AncientAlchemistState {
  return {
    guidanceKnown: false,
    bottles: ANCIENT_ALCHEMIST_POTION_SOURCES.map(({ id, source }) => ({ id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null,
    druidActingAtPromotion: null,
    life: createAncientAlchemistLifeState(),
    encounter: createAncientAlchemistEncounterState(),
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export { isAncientAlchemist } from './combat.js';
const hasAncientAlchemistHistory=(s:SliceState)=>s.progression.pathwayId==='mother'&&[4,3].includes(s.progression.sequence!);
const isDruid = (s: SliceState) => s.progression.pathwayId === 'mother' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.cultivator.discovered && s.cultivator.guidanceKnown && s.physician.guidanceKnown && s.harvestpriest.guidanceKnown && s.biologist.guidanceKnown && s.druid.guidanceKnown && s.druid.promotionWeek !== null && (isDruid(s) || hasAncientAlchemistHistory(s));
const potionPrice = (bottle: AncientAlchemistBottle) => ANCIENT_ALCHEMIST_PRICES.potion - (bottle.labourSteps === ANCIENT_ALCHEMIST_LABOUR_STEPS ? ANCIENT_ALCHEMIST_PRICES.labourCredit : 0);
const bottleNumber = (bottle: AncientAlchemistBottle) => Number(bottle.id.slice('ancient-alchemist-potion-'.length));
const druidWeeks = (s: SliceState) => Math.max(0, (s.ancientAlchemist.promotionWeek ?? s.week) - (s.druid.promotionWeek ?? s.week));
const supplyExhausted = (state: AncientAlchemistState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const oldPracticeOpen = (s: SliceState) => hasBiologistOpenPractice(s) || druidInside(s)
  || s.druid.practice.marker !== 'BOX' || s.druid.practice.seedlings !== 'RESTING' || s.druid.practice.note === 'WRITTEN'
  || [s.cultivator, s.physician, s.harvestpriest, s.biologist, s.druid].some(stage => Object.values(stage.cases).some(value => value.contactOpen || value.status === 'PREPARED'));

const deliverySource = (number: number, week: number) => `${ANCIENT_ALCHEMIST_GUIDE}的独立古代炼金师成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4古代炼金师魔药，原瓶ancient-alchemist-potion-${number}，非任何旧序列原瓶改装。完整配方与晋升仪式细节待核，导师实际执行G专业服药准备。`;

function commandBlock(s: SliceState, command: AncientAlchemistAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (oldPracticeOpen(s)) return '先实际结束旧实践的接触、原物复位或尚未实施的准备，再继续。';
  if (hasAncientAlchemistLifeLock(s) || hasAncientAlchemistEncounterLock(s)) return '先实际收束古代炼金师的演练、原物与普通步行路线，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原苗圃训练园，找到伊芙·莫兰。';
  if (!knownChannel(s)) return '成为德鲁伊并保有伊芙·莫兰的原指导渠道后，才能继续了解古代炼金师之路。';
  if (hasAncientAlchemistHistory(s)) return '你已完成古代炼金师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.ancientAlchemist.guidanceKnown) return '已经听过古代炼金师成品魔药的用药说明。';
    return s.cash < ANCIENT_ALCHEMIST_PRICES.guidance ? '古代炼金师用药指导需要540便士。' : null;
  }
  if (!s.ancientAlchemist.guidanceKnown) return '先听伊芙·莫兰说明这批序列4原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.ancientAlchemist.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.ancientAlchemist) ? null : '须先用完现有全部古代炼金师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.ancientAlchemist.resupply.requestedWeek === null) return '尚未申请下一批古代炼金师补给。';
    if (s.week <= s.ancientAlchemist.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.ancientAlchemist) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.ancientAlchemist.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选古代炼金师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受实际代价并保持可恢复。';
    if (s.progression.acting !== 100) return `德鲁伊魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.druid.promotionWeek === null || druidWeeks(s) < ANCIENT_ALCHEMIST_MIN_DRUID_WEEKS) return `成为德鲁伊后已度过${druidWeeks(s)}/${ANCIENT_ALCHEMIST_MIN_DRUID_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= ANCIENT_ALCHEMIST_LABOUR_STEPS ? '这瓶对应的五次原苗圃训练园劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Called on the slice's working copy. All commands validate before any resource or scene mutation. */
export function applyAncientAlchemistCommand(s: SliceState, command: AncientAlchemistCommand, c: SeerContext): void {
  rule(validateAncientAlchemistCommand(command), '古代炼金师命令无效。');
  if (validateAncientAlchemistActivityCommand(command)) {
    applyAncientAlchemistActivity(s, command, c, (id, amount = 8) => {
      rule(ANCIENT_ALCHEMIST_ABILITY_IDS.some(known => known === id) && Object.hasOwn(s.progression.mastery, id), '不能奖励尚未获得的古代炼金师能力。');
      s.progression.mastery[id] = Math.min(500, s.progression.mastery[id]! + amount);
    });
    return;
  }
  if (validateAncientAlchemistEncounterCommand(command)) { applyAncientAlchemistEncounterCommand(s, command, c); return; }
  rule(isAncientAlchemistAcquisitionCommand(command), '古代炼金师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= ANCIENT_ALCHEMIST_PRICES.guidance;
      s.ancientAlchemist.guidanceKnown = true;
      c.note('听取古代炼金师用药说明', `花费1行动、540便士，你向已认识的本作原创成年${ANCIENT_ALCHEMIST_GUIDE}继续请教。导师实际核对原瓶、准备原苗圃训练园安静场地与在场照护，说明三瓶独立序列4成品与四档风险。${ANCIENT_ALCHEMIST_FORMULA_STATUS}德鲁伊消化须达100，晋升后满12整周才能服用；可提前筹备。${ANCIENT_ALCHEMIST_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.ancientAlchemist.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = ANCIENT_ALCHEMIST_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊芙·莫兰的原苗圃训练园实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶5300便士，仍须实际支付1500便士才会交付；不折现、不生成材料。' : '完成对应五次劳务后才能抵这瓶5300便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.ancientAlchemist.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('古代炼金师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列4成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原苗圃训练园劳务抵扣5300便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；德鲁伊消化100且晋升后满12整周时，再独立确认服药。${ANCIENT_ALCHEMIST_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.ancientAlchemist.resupply.requestedWeek = s.week;
      c.note('申请下一批古代炼金师魔药', `现有古代炼金师原瓶全部耗尽且未晋升。你花费1行动，请${ANCIENT_ALCHEMIST_GUIDE}从同一渠道订下一批三瓶，并实际核验原苗圃训练园收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付6800便士，或分别完成五次劳务后支付1500便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.ancientAlchemist.bottles.length + 1;
      s.ancientAlchemist.resupply.deliveries += 1;
      for (let offset = 0; offset < ANCIENT_ALCHEMIST_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.ancientAlchemist.bottles.push({ id: `ancient-alchemist-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.ancientAlchemist.resupply.requestedWeek = null;
      c.note('下一批古代炼金师原瓶到货', `第${s.week}周，同一G独立渠道第${s.ancientAlchemist.resupply.deliveries + 1}批三瓶实际到货，原瓶ancient-alchemist-potion-${firstNumber}至ancient-alchemist-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按6800便士购买，或完成对应五次劳务再付1500便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.ancientAlchemist.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次古代炼金师服药准备', `原成年${ANCIENT_ALCHEMIST_GUIDE}在原苗圃训练园实际核对你手中的原瓶${bottle.id}、准备本次安静场地并在场照护，执行本作G专业准备。原著仪式细节仍未知，不把这些准备冒充已还原原著仪式。`);
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
        s.ancientAlchemist.druidActingAtPromotion = s.progression.acting;
        s.ancientAlchemist.promotionWeek = s.week;
        s.progression.sequence = 4;
        s.progression.acting = 0;
        for (const id of ANCIENT_ALCHEMIST_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        c.note('完成古代炼金师晋升', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${great ? '大成功' : '成功'}：精神−${mentalCost}${great ? '' : `、灵性实际−${spiritualCost}（规则成本15，最低0）`}，四属性各+1。德鲁伊消化成果100/100单独保留，古代炼金师扮演从0开始；只新增mother.s4.vital-knit、mother.s4.living-matrix两项0掌握。灵性上限120，当前灵性没有补满。耕种者、医师、丰收祭司、生物学家与德鲁伊五个旧阶段的原ID、原瓶、原人物、原物、伤势和旧马伦结果全部保留；原DR5-MARKER-1仍在原盒，原土SETTLED、原双苗RESTING、原DR5-LIFE-NOTE-1仍HANDED_OVER；不重置旧实践，不重启旧马伦。晋升当下同一实际身体与性别不变；生命炼成方向不等于无代价复活、造人造魂或无限食物，两项新能力的有限原型与成本均为G。${ANCIENT_ALCHEMIST_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        const mentalCost = severe ? 45 : 25;
        const healthCost = severe ? 25 : 15;
        s.mind = Math.max(1, s.mind - mentalCost);
        s.health = Math.max(1, s.health - healthCost);
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 60 : 30));
        c.note(severe ? '导师中断了古代炼金师晋升' : '古代炼金师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：健康−${healthCost}、精神−${mentalCost}、排异+${severe ? 60 : 30}；仅本次G指导服药的健康与精神最低1。你仍是德鲁伊，消化与全部旧掌握保留，尚未获得古代炼金师能力。导师实际处理排异后仍须休养；重试须另购现有新原瓶，保护不适用于战斗或其它危险。`);
      }
      return;
    }
  }
}

export function projectAncientAlchemist(s: SliceState): AncientAlchemistProjection {
  const actions: AncientAlchemistAction[] = [], available = knownChannel(s), promoted = hasAncientAlchemistHistory(s);
  const acting = promoted ? (s.progression.sequence===3?s.coffinBearer.ancientAlchemistActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: AncientAlchemistAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !promoted) {
    if (!s.ancientAlchemist.guidanceKnown) add('learn-ancient-alchemist-guidance', '请伊芙·莫兰说明古代炼金师成品与风险', '1行动 · 540便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.ancientAlchemist.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < ANCIENT_ALCHEMIST_LABOUR_STEPS) add(`work-${bottle.id}`, `第${number}瓶 · ${ANCIENT_ALCHEMIST_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶5300便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶古代炼金师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列4原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.ancientAlchemist.resupply.requestedWeek !== null) add('receive-ancient-alchemist-supply', '确认下一批三瓶古代炼金师到货', `0行动 · 第${s.ancientAlchemist.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.ancientAlchemist)) add('request-ancient-alchemist-supply', '向伊芙·莫兰订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.ancientAlchemist.guidanceKnown && !promoted) for (const bottle of s.ancientAlchemist.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶古代炼金师魔药`, `0行动 · 独立确认 · 德鲁伊消化${s.progression.acting}/100 · 晋升后${druidWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  const remaining = s.ancientAlchemist.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.ancientAlchemist.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    ...projectAncientAlchemistLife(s),
    ...projectAncientAlchemistEncounter(s),
    title: promoted ? '古代炼金师 · 序列4' : '古代炼金师之路', discovered: available,
    guidanceKnown: available && s.ancientAlchemist.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: ANCIENT_ALCHEMIST_SOURCE_STATUS } : {}),
    supplies: available ? `${ANCIENT_ALCHEMIST_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.ancientAlchemist.resupply.requestedWeek === null ? `已实际接收后续供给${s.ancientAlchemist.resupply.deliveries}批。` : `第${s.ancientAlchemist.resupply.requestedWeek}周提出请求，第${s.ancientAlchemist.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    bodyChange: available ? '晋升当下保留同一实际身体与性别。生命炼成方向只落实为两个明确G有限原型；原活苗修补与60秒活性基质不等于复活、造人、创造灵魂、动物变形或无限食物。没有免费神话形态。' : '',
    inheritedTools: available ? '耕种者、医师、丰收祭司、生物学家与德鲁伊五个旧阶段的原能力、原ID掌握和实际历史完整保留。原伊芙·莫兰、旧马伦的既有结局、原三种普通动物与三种超凡生物资料、原研习册、DR5-MARKER-1原标记、原土、原双苗与DR5-LIFE-NOTE-1原纸均保持既有状态。旧潜地仍需原已知浅土和3灵性，旧生命支援仍需实际伤势及4灵性；没有免费治疗或重启旧人旧物。新苗、材料包、有限基质与护腕均是另外登记的原创G实物，不取得教会身份。' : '',
    actions: [...actions, ...ancientAlchemistLifeActions(s), ...ancientAlchemistEncounterActions(s)],
    bottles: available ? s.ancientAlchemist.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 古代炼金师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5` : bottle.status === 'PLAYER' ? '已交付，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? ANCIENT_ALCHEMIST_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: promoted ? `德鲁伊消化成果${s.ancientAlchemist.druidActingAtPromotion}/100已保留；古代炼金师扮演${acting}/100，能力掌握分别记录。` : available ? `服药前需完成德鲁伊消化（${s.progression.acting}/100），并在晋升后度过12整周（${druidWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完德鲁伊之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${ANCIENT_ALCHEMIST_CONSUMPTION_RISK}` : '成为德鲁伊后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const bottleId = (value: unknown) => typeof value === 'string' && /^ancient-alchemist-potion-[1-9]\d{0,14}$/.test(value);

export function isAncientAlchemistAcquisitionCommand(value: unknown): value is AncientAlchemistAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && bottleId(value.bottleId);
  return value.type === 'CONSUME' && shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && bottleId(value.bottleId);
}
export function validateAncientAlchemistCommand(value: unknown): value is AncientAlchemistCommand {
  return isAncientAlchemistAcquisitionCommand(value) || validateAncientAlchemistActivityCommand(value) || validateAncientAlchemistEncounterCommand(value);
}

/** Exact identities and chronology are validated before delegated scene invariants. */
export function validateAncientAlchemistState(s: SliceState): boolean {
  try { return validateAncientAlchemistStateRecord(s); } catch { return false; }
}
function validateAncientAlchemistStateRecord(s: SliceState): boolean {
  const raw: unknown = s.ancientAlchemist;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'druidActingAtPromotion', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.cultivator) || !record(s.physician) || !record(s.harvestpriest) || !record(s.biologist) || !record(s.druid)) return false;
  if (!record(raw.life) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory)) return false;
  const firstDruidWeek = s.druid.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstDruidWeek + ANCIENT_ALCHEMIST_MIN_DRUID_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== ANCIENT_ALCHEMIST_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  const state = raw as unknown as AncientAlchemistState, promoted = hasAncientAlchemistHistory(s);
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.druid.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.druidActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS, ...HARVESTPRIEST_ABILITY_IDS, ...BIOLOGIST_ABILITY_IDS, ...DRUID_ABILITY_IDS, ...ANCIENT_ALCHEMIST_ABILITY_IDS,...(s.progression.sequence===3?COFFIN_BEARER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.druidActingAtPromotion !== null || ANCIENT_ALCHEMIST_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  // First validate every record shape, so a later batch cannot dereference malformed predecessors.
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `ancient-alchemist-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, ANCIENT_ALCHEMIST_LABOUR_STEPS)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of state.bottles.entries()) {
    let stockWeek = firstDruidWeek;
    if (index < ANCIENT_ALCHEMIST_BOTTLE_IDS.length) {
      if (bottle.source !== ANCIENT_ALCHEMIST_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!state.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / ANCIENT_ALCHEMIST_BOTTLE_IDS.length) - 1;
      if (index % ANCIENT_ALCHEMIST_BOTTLE_IDS.length === 0) {
        const previous = state.bottles.slice(index - ANCIENT_ALCHEMIST_BOTTLE_IDS.length, index);
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
  return successes === (promoted ? 1 : 0) && validateAncientAlchemistLife(s) && validateAncientAlchemistEncounter(s);
}

export { ANCIENT_ALCHEMIST_ABILITIES } from './content.js';
export { ANCIENT_ALCHEMIST_CASE_IDS } from './life.js';
export type * from './types.js';
