import { SAGE_ABILITY_IDS } from '../sage/types.js';
import {PROPHECY_MASTER_ABILITY_IDS} from '../prophecy-master/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRYER_ABILITY_IDS } from '../pryer/types.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../combat-scholar/types.js';
import { WIZARD_ABILITY_IDS } from '../wizard/types.js';
import { SCROLL_PROFESSOR_ABILITY_IDS } from '../scroll-professor/types.js';
import { STAR_MYSTIC_ABILITY_IDS } from '../star-mystic/types.js';
import { projectScrollProfessor, validateScrollProfessorCommand } from '../scroll-professor/index.js';
import { applyScrollProfessorActivity, scrollProfessorActions } from '../scroll-professor/life.js';
import { STAR_MYSTIC_LENSES_ID, STAR_MYSTIC_LENSES_PRICE } from '../star-mystic/content.js';
import { createMysticRitualState, validateMysticRitual, validateMysticRitualCommand, mysticRitualActions, projectMysticRitual, hasMysticRitualLock, hasMysticOldPracticeLock, applyMysticRitualCommand } from './ritual.js';
import {
  createMysticLifeState, validateMysticLife, validateMysticActivityCommand,
  mysticLifeActions, projectMysticLife, hasMysticLifeLock, applyMysticActivity,
} from './life.js';
import {
  createMysticEncounterState, validateMysticEncounter, validateMysticEncounterCommand,
  mysticEncounterActions, projectMysticEncounter, hasMysticEncounterLock, applyMysticEncounterCommand,
} from './encounter.js';
import {
  MYSTIC_ABILITIES, MYSTIC_BOTTLE_IDS, MYSTIC_CONSUMPTION_RISK, MYSTIC_FORMULA_STATUS,
  MYSTIC_GUIDE, MYSTIC_LABOUR_STEPS, MYSTIC_LABOUR_TASKS, MYSTIC_MIN_STAR_MYSTIC_WEEKS,
  MYSTIC_POTION_SOURCES, MYSTIC_PRICES, MYSTIC_SOURCE_STATUS,
} from './content.js';
import {
  MYSTIC_ABILITY_IDS, type MysticAcquisitionCommand, type MysticAction,
  type MysticBottle, type MysticCommand, type MysticProjection, type MysticState, type MysticWorkshopCommand,
} from './types.js';

export function createMysticState(): MysticState {
  return {
    guidanceKnown: false,
    bottles: MYSTIC_POTION_SOURCES.map(({ id, source }) => ({ id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null,
    starMysticActingAtPromotion: null,
    ritual: createMysticRitualState(),
    life: createMysticLifeState(),
    encounter: createMysticEncounterState(),
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export const isMystic = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 4;
const hasMysticHistory=(s:SliceState)=>s.progression.pathwayId==='hermit'&&[4,3,2].includes(s.progression.sequence!);
const isStarMystic = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 5;
const knownChannel = (s: SliceState) => s.pryer.discovered && s.pryer.guidanceKnown && s.combatScholar.guidanceKnown && s.wizard.guidanceKnown && s.scrollProfessor.guidanceKnown && s.starMystic.guidanceKnown && s.starMystic.promotionWeek !== null && (isStarMystic(s) || hasMysticHistory(s));
const potionPrice = (bottle: MysticBottle) => MYSTIC_PRICES.potion - (bottle.labourSteps === MYSTIC_LABOUR_STEPS ? MYSTIC_PRICES.labourCredit : 0);
const bottleNumber = (bottle: MysticBottle) => Number(bottle.id.slice('mystic-potion-'.length));
const starMysticWeeks = (s: SliceState) => Math.max(0, (s.mystic.promotionWeek ?? s.week) - (s.starMystic.promotionWeek ?? s.week));
const supplyExhausted = (state: MysticState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const oldPracticeOpen = hasMysticOldPracticeLock;
const deliverySource = (number: number, week: number) => `${MYSTIC_GUIDE}的独立神秘学家成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列4神秘学家魔药，原瓶mystic-potion-${number}，非任何旧序列原瓶改装。完整配方与晋升仪式细节待核，导师实际执行G专业服药准备。`;

function commandBlock(s: SliceState, command: MysticAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'BUY_LENSES'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (oldPracticeOpen(s)) return '先实际结束旧实践的接触、原物复位或尚未实施的准备，再继续。';
  if (hasMysticLifeLock(s) || hasMysticEncounterLock(s) || hasMysticRitualLock(s)) return '先实际收束神秘学家的演练、原物与普通步行路线，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原教学室，找到伊蕾·莫文。';
  if (!knownChannel(s)) return '成为星象师并保有伊蕾·莫文的原指导渠道后，才能继续了解神秘学家之路。';
  if (command.type === 'BUY_LENSES') return s.starMystic.practice.lenses !== 'SUPPLIER' ? '同一原眼镜已经实际购入，不能复制。' : s.cash < STAR_MYSTIC_LENSES_PRICE ? '原眼镜仍须实付80便士。' : null;
  if (hasMysticHistory(s)) return '你已完成神秘学家晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.mystic.guidanceKnown) return '已经听过神秘学家成品魔药的用药说明。';
    return s.cash < MYSTIC_PRICES.guidance ? '神秘学家用药指导需要540便士。' : null;
  }
  if (!s.mystic.guidanceKnown) return '先听伊蕾·莫文说明这批序列4原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.mystic.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.mystic) ? null : '须先用完现有全部神秘学家原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.mystic.resupply.requestedWeek === null) return '尚未申请下一批神秘学家补给。';
    if (s.week <= s.mystic.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.mystic) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.mystic.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选神秘学家原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (!s.mystic.ritual.complete || s.mystic.ritual.sample.status !== 'RETURNED') return '先真实完成同一原滴三项不同成功分析，0行动安全关闭，再0行动把同一密封原滴归还导师。';
    if (s.starMystic.practice.lenses !== 'WORN') return '必须持有并佩戴同一副原厚镜片眼镜。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受实际代价并保持可恢复。';
    if (s.progression.acting !== 100) return `星象师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.starMystic.promotionWeek === null || starMysticWeeks(s) < MYSTIC_MIN_STAR_MYSTIC_WEEKS) return `成为星象师后已度过${starMysticWeeks(s)}/${MYSTIC_MIN_STAR_MYSTIC_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= MYSTIC_LABOUR_STEPS ? '这瓶对应的五次原教学室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

export function isMysticWorkshopCommand(value: unknown): value is MysticWorkshopCommand {
  return record(value) && ['LEARN_SPELL', 'BUY_KIT', 'CRAFT_SCROLL', 'AUTHORIZE_SCROLL'].includes(value.type as string) && validateScrollProfessorCommand(value);
}
function workshopReason(s: SliceState, command: MysticWorkshopCommand): string | null {
  if (!isMystic(s)) return '先完成神秘学家晋升，再从当前工房继续原课程与制卷。';
  if (hasMysticRitualLock(s) || hasMysticLifeLock(s) || hasMysticEncounterLock(s) || oldPracticeOpen(s)) return '先实际收束当前样本、接触、原路线与旧实践。';
  const action = scrollProfessorActions(s).find(a => a.command.type === command.type &&
    (command.type !== 'LEARN_SPELL' || a.command.type === 'LEARN_SPELL' && a.command.spellId === command.spellId) &&
    (command.type !== 'CRAFT_SCROLL' || a.command.type === 'CRAFT_SCROLL' && a.command.kind === command.kind) &&
    (command.type !== 'AUTHORIZE_SCROLL' || a.command.type === 'AUTHORIZE_SCROLL' && a.command.scrollId === command.scrollId && a.command.authorized === command.authorized));
  return action ? action.reason : '当前没有这项可执行的原工房操作。';
}
function mysticWorkshopActions(s: SliceState): MysticAction[] {
  if (!isMystic(s)) return [];
  return scrollProfessorActions(s).filter(a => isMysticWorkshopCommand(a.command)).map(a => {
    const command = a.command as MysticWorkshopCommand, reason = workshopReason(s, command);
    return { ...a, id: `mystic-workshop-${a.id}`, command, reason, enabled: reason === null };
  });
}

/** Called on the slice's working copy. All commands validate before any resource or scene mutation. */
export function applyMysticCommand(s: SliceState, command: MysticCommand, c: SeerContext): void {
  rule(validateMysticCommand(command), '神秘学家命令无效。');
  if (validateMysticRitualCommand(command)) { applyMysticRitualCommand(s, command, c); return; }
  if (isMysticWorkshopCommand(command)) {
    const blocked = workshopReason(s, command); rule(!blocked, blocked ?? '原工房当前不可用。');
    applyScrollProfessorActivity(s, command, c, () => {}); return;
  }
  if (validateMysticActivityCommand(command)) {
    applyMysticActivity(s, command, c, (id, amount = 8) => {
      rule(MYSTIC_ABILITY_IDS.includes(id) && Object.hasOwn(s.progression.mastery, id), '不能奖励尚未获得的神秘学家能力。');
      s.progression.mastery[id] = Math.min(500, s.progression.mastery[id]! + amount);
    });
    return;
  }
  if (validateMysticEncounterCommand(command)) { applyMysticEncounterCommand(s, command, c); return; }
  rule(isMysticAcquisitionCommand(command), '神秘学家准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'BUY_LENSES':
      s.actionsRemaining -= 1; s.cash -= STAR_MYSTIC_LENSES_PRICE; s.starMystic.practice.lenses = 'WORN';
      c.note('购买并实际佩戴原厚镜片', `实付1行动、80便士，向伊蕾取得唯一原眼镜${STAR_MYSTIC_LENSES_ID}并实际戴好。更新同一星象师原物状态，不生成第二副、不改原标记、囚笼、天气或旧实践结果，也不启动分析或窥视。`); return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= MYSTIC_PRICES.guidance;
      s.mystic.guidanceKnown = true;
      c.note('听取神秘学家用药说明', `花费1行动、540便士，你向已认识的本作原创成年${MYSTIC_GUIDE}继续请教。导师实际核对原瓶、准备原教学室安静场地与在场照护，说明三瓶独立序列4成品与四档风险。${MYSTIC_FORMULA_STATUS}星象师消化须达100，晋升后满12整周，并实际完成原滴分析、关闭与归还后才能服用；可提前筹备。${MYSTIC_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.mystic.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = MYSTIC_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊蕾·莫文的原教学室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶5300便士，仍须实际支付1500便士才会交付；不折现、不生成材料。' : '完成对应五次劳务后才能抵这瓶5300便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.mystic.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('神秘学家原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列4成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原教学室劳务抵扣5300便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；星象师消化100且晋升后满12整周时，再独立确认服药。${MYSTIC_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.mystic.resupply.requestedWeek = s.week;
      c.note('申请下一批神秘学家魔药', `现有神秘学家原瓶全部耗尽且未晋升。你花费1行动，请${MYSTIC_GUIDE}从同一渠道订下一批三瓶，并实际核验原教学室收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付6800便士，或分别完成五次劳务后支付1500便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.mystic.bottles.length + 1;
      s.mystic.resupply.deliveries += 1;
      for (let offset = 0; offset < MYSTIC_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.mystic.bottles.push({ id: `mystic-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.mystic.resupply.requestedWeek = null;
      c.note('下一批神秘学家原瓶到货', `第${s.week}周，同一G独立渠道第${s.mystic.resupply.deliveries + 1}批三瓶实际到货，原瓶mystic-potion-${firstNumber}至mystic-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按6800便士购买，或完成对应五次劳务再付1500便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.mystic.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次神秘学家服药准备', `原成年${MYSTIC_GUIDE}在原教学室实际核对你手中的原瓶${bottle.id}、准备本次安静场地并在场照护，执行本作G专业准备。已实际核对原册三项不同成功分析与归还同一原滴的记录；已知仪式部分已完成，其余仪式细节仍未知，不把G准备冒充完整原著仪式。`);
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
        s.mystic.starMysticActingAtPromotion = s.progression.acting;
        s.mystic.promotionWeek = s.week;
        s.progression.sequence = 4;
        s.progression.acting = 0;
        for (const id of MYSTIC_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        c.note('成为神秘学家', `原魔药${bottle.id}已耗尽。意志${result.roll}/${result.chance}，${great ? '大成功' : '成功'}：精神−${mentalCost}${great ? '' : `、灵性实际−${spiritualCost}（规则15，最低0）`}，四属性各+1。星象师消化100快照保留，神秘学家扮演从0开始；只新增hermit.s4.mystical-reenactment与hermit.s4.shared-sight两项0掌握。灵性上限120，当前灵性没有补满。全部旧能力ID、原人、眼镜、标记、天气、囚笼、原布莱斯真实结果及原材料、原卷与授权不变。原一滴已完整分析并原样归还，没有饮血或耗作魔药；其余完整仪式细节仍未知。无新增身体或性别变化，不附赠法术、神话形态、命运幸运或序列3预见；后续神秘再现必须本人真实研究并学会有限原术。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        const mentalCost = severe ? 45 : 25;
        const healthCost = severe ? 25 : 15;
        s.mind = Math.max(1, s.mind - mentalCost);
        s.health = Math.max(1, s.health - healthCost);
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 60 : 30));
        c.note(severe ? '导师中断了神秘学家晋升' : '神秘学家魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：健康−${healthCost}、精神−${mentalCost}、排异+${severe ? 60 : 30}；仅本次G指导服药的健康与精神最低1。你仍是星象师，消化与全部旧掌握保留，尚未获得神秘学家能力。导师实际处理排异后仍须休养；重试须另购现有新原瓶，保护不适用于战斗或其它危险。`);
      }
      return;
    }
  }
}

export function projectMystic(s: SliceState): MysticProjection {
  const actions: MysticAction[] = [], available = knownChannel(s), promoted = hasMysticHistory(s);
  const acting = promoted ? ([3, 2].includes(s.progression.sequence ?? 0)?s.prophecyMaster.mysticActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: MysticAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && s.starMystic.practice.lenses === 'SUPPLIER') add('buy-mystic-original-lenses', '实际购买并佩戴原星象师厚镜片', '1行动 · 80便士 · 唯一原SM5-LENS-1', { type: 'BUY_LENSES' });
  if (available && !promoted) {
    if (!s.mystic.guidanceKnown) add('learn-mystic-guidance', '请伊蕾·莫文说明神秘学家成品与风险', '1行动 · 540便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.mystic.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < MYSTIC_LABOUR_STEPS) add(`work-${bottle.id}`, `第${number}瓶 · ${MYSTIC_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶5300便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶神秘学家魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列4原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.mystic.resupply.requestedWeek !== null) add('receive-mystic-supply', '确认下一批三瓶神秘学家到货', `0行动 · 第${s.mystic.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.mystic)) add('request-mystic-supply', '向伊蕾·莫文订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.mystic.guidanceKnown && !promoted) for (const bottle of s.mystic.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶神秘学家魔药`, `0行动 · 独立确认 · 星象师消化${s.progression.acting}/100 · 晋升后${starMysticWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 28, modifiers: [] });
  const remaining = s.mystic.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.mystic.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    ...projectMysticRitual(s),
    ...projectMysticLife(s),
    ...projectMysticEncounter(s),
    title: promoted ? '神秘学家 · 序列4' : '神秘学家之路', discovered: available,
    guidanceKnown: available && s.mystic.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: MYSTIC_SOURCE_STATUS } : {}),
    supplies: available ? `${MYSTIC_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.mystic.resupply.requestedWeek === null ? `已实际接收后续供给${s.mystic.resupply.deliveries}批。` : `第${s.mystic.resupply.requestedWeek}周提出请求，第${s.mystic.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    bodyChange: available ? '原身体与性别保持，没有新增转变；不附赠神话形态或序列3预言大师的模糊预见。' : '',
    inheritedTools: available ? `原厚镜片${STAR_MYSTIC_LENSES_ID}：${s.starMystic.practice.lenses === 'SUPPLIER' ? '仍由原供应方保管，须实际购入' : s.starMystic.practice.lenses === 'WORN' ? '已持有并实际佩戴' : '本人手持'}。原材料、原卷、制造时序列与掌握、已学课程及逐张授权原样保留，不因晋升补发。` : '',
    ...(promoted ? { workshop: projectScrollProfessor(s).workshop } : {}),
    actions: [...actions, ...mysticRitualActions(s), ...mysticLifeActions(s), ...mysticEncounterActions(s), ...mysticWorkshopActions(s)],
    bottles: available ? s.mystic.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 神秘学家魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5` : bottle.status === 'PLAYER' ? '已交付，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: promoted ? MYSTIC_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: promoted ? `星象师消化成果${s.mystic.starMysticActingAtPromotion}/100已保留；神秘学家扮演${acting}/100，能力掌握分别记录。` : available ? `服药前需完成星象师消化（${s.progression.acting}/100），并在晋升后度过12整周（${starMysticWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完星象师之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 完全分析原一滴、关闭并归还 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${MYSTIC_CONSUMPTION_RISK}` : '成为星象师后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const bottleId = (value: unknown) => typeof value === 'string' && /^mystic-potion-[1-9]\d{0,14}$/.test(value);

export function isMysticAcquisitionCommand(value: unknown): value is MysticAcquisitionCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'BUY_LENSES'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && bottleId(value.bottleId);
  return value.type === 'CONSUME' && shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && bottleId(value.bottleId);
}
export function validateMysticCommand(value: unknown): value is MysticCommand {
  return isMysticAcquisitionCommand(value) || isMysticWorkshopCommand(value) || validateMysticRitualCommand(value) || validateMysticActivityCommand(value) || validateMysticEncounterCommand(value);
}

/** Exact identities and chronology are validated before delegated scene invariants. */
export function validateMysticState(s: SliceState): boolean {
  try { return validateMysticStateRecord(s); } catch { return false; }
}
function validateMysticStateRecord(s: SliceState): boolean {
  const raw: unknown = s.mystic;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'starMysticActingAtPromotion', 'ritual', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.pryer) || !record(s.combatScholar) || !record(s.wizard) || !record(s.scrollProfessor) || !record(s.starMystic)) return false;
  if (!record(raw.ritual) || !record(raw.life) || !record(raw.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory)) return false;
  const firstStarMysticWeek = s.starMystic.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstStarMysticWeek + MYSTIC_MIN_STAR_MYSTIC_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== MYSTIC_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  const state = raw as unknown as MysticState, promoted = hasMysticHistory(s);
  if (state.guidanceKnown && !knownChannel(s)) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.starMystic.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.starMysticActingAtPromotion !== 100 || !state.ritual.complete || state.ritual.sample.status !== 'RETURNED' || state.ritual.sample.returnedWeek === null || state.ritual.sample.returnedWeek > state.promotionWeek! || s.starMystic.practice.lenses === 'SUPPLIER') return false;
    if (!shape(s.progression.mastery, [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS, ...WIZARD_ABILITY_IDS, ...SCROLL_PROFESSOR_ABILITY_IDS, ...STAR_MYSTIC_ABILITY_IDS, ...MYSTIC_ABILITY_IDS,...([3, 2].includes(s.progression.sequence ?? 0)?PROPHECY_MASTER_ABILITY_IDS:[]),...(s.progression.sequence===2?SAGE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.starMysticActingAtPromotion !== null || MYSTIC_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  // First validate every record shape, so a later batch cannot dereference malformed predecessors.
  for (const [index, bottle] of state.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `mystic-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, MYSTIC_LABOUR_STEPS)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of state.bottles.entries()) {
    let stockWeek = firstStarMysticWeek;
    if (index < MYSTIC_BOTTLE_IDS.length) {
      if (bottle.source !== MYSTIC_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!state.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / MYSTIC_BOTTLE_IDS.length) - 1;
      if (index % MYSTIC_BOTTLE_IDS.length === 0) {
        const previous = state.bottles.slice(index - MYSTIC_BOTTLE_IDS.length, index);
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
      if (!state.ritual.complete || state.ritual.sample.status !== 'RETURNED' || state.ritual.sample.returnedWeek === null || state.ritual.sample.returnedWeek > (bottle.consumedWeek ?? 0)) return false;
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (promoted ? bottle.consumedWeek! > state.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== state.promotionWeek) return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!state.guidanceKnown || promoted || !supplyExhausted(state) || state.bottles.some(bottle => bottle.consumedWeek! > state.resupply.requestedWeek!))) return false;
  return successes === (promoted ? 1 : 0) && validateMysticRitual(s) && validateMysticLife(s) && validateMysticEncounter(s);
}

export { MYSTIC_ABILITIES } from './content.js';
export { MYSTIC_CASE_IDS } from './life.js';
export { hasMysticRitualLock } from './ritual.js';
export type * from './types.js';
