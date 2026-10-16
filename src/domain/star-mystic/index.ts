import { SAGE_ABILITY_IDS } from '../sage/types.js';
import {PROPHECY_MASTER_ABILITY_IDS} from '../prophecy-master/types.js';
import {MYSTIC_ABILITY_IDS} from '../mystic/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRYER_ABILITY_IDS } from '../pryer/types.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../combat-scholar/types.js';
import { WIZARD_ABILITY_IDS } from '../wizard/types.js';
import { SCROLL_PROFESSOR_ABILITY_IDS } from '../scroll-professor/types.js';
import { projectScrollProfessor, validateScrollProfessorCommand } from '../scroll-professor/index.js';
import { starMysticInside, validateStarMysticLife } from './life.js';
import { scrollProfessorInside } from '../scroll-professor/life.js';
import { validateStarMysticEncounter } from './encounter.js';
import {
  STAR_MYSTIC_ABILITIES, STAR_MYSTIC_BOTTLE_IDS, STAR_MYSTIC_CONSUMPTION_RISK, STAR_MYSTIC_FORMULA_STATUS,
  STAR_MYSTIC_GUIDE, STAR_MYSTIC_LABOUR_TASKS, STAR_MYSTIC_MIN_SCROLL_PROFESSOR_WEEKS, STAR_MYSTIC_POTION_SOURCES, STAR_MYSTIC_PRICES, STAR_MYSTIC_SOURCE_STATUS,
} from './content.js';
import {
  STAR_MYSTIC_ABILITY_IDS, STAR_MYSTIC_CASE_IDS, type StarMysticAcquisitionCommand, type StarMysticAction,
  type StarMysticBottle, type StarMysticCommand, type StarMysticPractice, type StarMysticProjection, type StarMysticState,
} from './types.js';

export function freshStarMysticPractice(): StarMysticPractice {
  return { lenses: 'SUPPLIER', screen: 'SHUT', markerSeen: false, cageActive: false, companionNode: 'WAITING', playerNode: 'ROOM', weatherSeen: false };
}

export function createStarMysticState(): StarMysticState {
  return {
    guidanceKnown: false,
    bottles: STAR_MYSTIC_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, scrollProfessorActingAtPromotion: null,
    cases: Object.fromEntries(STAR_MYSTIC_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0 }])),
    practice: freshStarMysticPractice(),
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null, focused: false, cageReady: false },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hermit' && (s.progression.sequence === 5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2));
const isScrollProfessor = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 6;
const knownChannel = (s: SliceState) => s.pryer.discovered && s.pryer.guidanceKnown && s.combatScholar.guidanceKnown && s.wizard.guidanceKnown && s.scrollProfessor.guidanceKnown && s.scrollProfessor.promotionWeek !== null && (isScrollProfessor(s) || promoted(s));
const potionPrice = (bottle: StarMysticBottle) => STAR_MYSTIC_PRICES.potion - (bottle.labourSteps === 5 ? STAR_MYSTIC_PRICES.labourCredit : 0);
const bottleNumber = (bottle: StarMysticBottle) => Number(bottle.id.slice('star-mystic-potion-'.length));
const scrollProfessorWeeks = (s: SliceState) => Math.max(0, (s.starMystic.promotionWeek ?? s.week) - (s.scrollProfessor.promotionWeek ?? s.week));
const inheritedContactOpen = (s: SliceState) => scrollProfessorInside(s);
const supplyExhausted = (state: StarMysticState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${STAR_MYSTIC_GUIDE}的独立星象师成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列5星象师魔药，原瓶star-mystic-potion-${number}，非窥秘人、格斗学者、巫师或卷轴教授旧瓶改装。完整配方与晋升仪式细节待核，导师实际执行G服药准备。`;

function commandBlock(s: SliceState, command: StarMysticAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (starMysticInside(s) || inheritedContactOpen(s)) return '先实际结束当前训练实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原法术教学室，找到伊蕾·莫文。';
  if (!knownChannel(s)) return '成为卷轴教授并保有伊蕾·莫文的指导渠道后，才能继续了解星象师之路。';
  if (promoted(s)) return '你已完成星象师晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.starMystic.guidanceKnown) return '已经听过星象师成品魔药的用药说明。';
    return s.cash < STAR_MYSTIC_PRICES.guidance ? '星象师用药指导需要460便士。' : null;
  }
  if (!s.starMystic.guidanceKnown) return '先听伊蕾·莫文说明这批序列5原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.starMystic.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.starMystic) ? null : '须先用完现有全部星象师原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.starMystic.resupply.requestedWeek === null) return '尚未申请下一批星象师补给。';
    if (s.week <= s.starMystic.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.starMystic) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.starMystic.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选星象师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.health <= 20 || s.mind <= 40) return '本次指导服药须健康高于20、精神高于40；先休养，以承受四档实际代价并保持可恢复。';
    if (s.progression.acting < 100) return `卷轴教授魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.scrollProfessor.promotionWeek === null || scrollProfessorWeeks(s) < STAR_MYSTIC_MIN_SCROLL_PROFESSOR_WEEKS) return `成为卷轴教授后已度过${scrollProfessorWeeks(s)}/${STAR_MYSTIC_MIN_SCROLL_PROFESSOR_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原法术教学室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyStarMysticCommand(s: SliceState, command: StarMysticAcquisitionCommand, c: SeerContext): void {
  rule(validateStarMysticCommand(command) && isStarMysticAcquisitionCommand(command), '星象师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= STAR_MYSTIC_PRICES.guidance;
      s.starMystic.guidanceKnown = true;
      c.note('听取星象师用药说明', `花费1行动、460便士，你向已认识的本作原创成年${STAR_MYSTIC_GUIDE}继续请教，导师向你说明从独立星象师成品交接渠道实际取得的三瓶序列5成品、逐瓶交付与四档风险，并实际核对原瓶、准备原法术教学室安静场地与在场照护安排。这些不是原来的窥秘人、格斗学者、巫师或卷轴教授存药。${STAR_MYSTIC_FORMULA_STATUS}卷轴教授消化须达100，晋升卷轴教授后满12整周才能服用；可提前筹备。${STAR_MYSTIC_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.starMystic.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = STAR_MYSTIC_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊蕾·莫文的原法术教学室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶4200便士，仍须实际支付600便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶4200便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.starMystic.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('星象师原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列5成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原法术教学室劳务抵扣4200便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；卷轴教授消化100且晋升卷轴教授后满12整周时，再独立确认服药。${STAR_MYSTIC_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.starMystic.resupply.requestedWeek = s.week;
      c.note('申请下一批星象师魔药', `现有星象师原瓶全部耗尽且未晋升。你花费1行动，请${STAR_MYSTIC_GUIDE}从同一新渠道订下一批三瓶，并实际核验原法术教学室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付4800便士，或分别完成五次劳务后支付600便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.starMystic.bottles.length + 1;
      s.starMystic.resupply.deliveries += 1;
      for (let offset = 0; offset < STAR_MYSTIC_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.starMystic.bottles.push({ id: `star-mystic-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.starMystic.resupply.requestedWeek = null;
      c.note('下一批星象师原瓶到货', `第${s.week}周，伊蕾·莫文的独立星象师成品交接渠道本作G成品供给第${s.starMystic.resupply.deliveries + 1}批三瓶实际到货，原瓶star-mystic-potion-${firstNumber}至star-mystic-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按4800便士购买，或完成对应五次劳务再付600便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.starMystic.bottles.find(candidate => candidate.id === command.bottleId)!;
      c.note('导师完成本次星象师服药准备', `原成年${STAR_MYSTIC_GUIDE}在原法术教学室实际核对你手中的原瓶${bottle.id}、检查本次安静场地并在场照护，按此前说明进行G指导服药准备。原著仪式细节仍未知，不把这些普通准备冒充已还原原著仪式。`);
      const result = c.check('will', 26);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.starMystic.scrollProfessorActingAtPromotion = s.progression.acting;
        s.starMystic.promotionWeek = s.week;
        s.progression.sequence = 5;
        s.progression.acting = 0;
        for (const id of STAR_MYSTIC_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为星象师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。窥秘人、格斗学者、巫师与卷轴教授全部原能力及原ID掌握完整继承，仅新增hermit.s5.mystic-sight与hermit.s5.star-cage两项，从0掌握开始；卷轴教授消化成果、原晋升周、原材料、原瓶、原卷轴、已学课程、真实制作和已解决敌人记录均保持原样，星象师扮演从0开始。灵性上限提高到100，当前灵性没有补满。增强窥秘视野仍受有限现场、纷乱和实际精神代价约束，星光囚笼可直接施展但仍需实际判定。原厚玻璃眼镜仍由伊蕾保管，须另行购买；没有自动教会任何未知法术。星象师属于窥秘人途径，不是天文学家；序列4神秘学家的神秘再现尚未获得。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了星象师晋升' : '星象师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是卷轴教授，消化与全部原有掌握保留，没有获得星象师能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectStarMystic(s: SliceState): StarMysticProjection {
  const actions: StarMysticAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2)?s.mystic.starMysticActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: StarMysticAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.starMystic.guidanceKnown) add('learn-star-mystic-guidance', '请伊蕾·莫文说明星象师成品与风险', '1行动 · 460便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.starMystic.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${STAR_MYSTIC_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶4200便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶星象师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列5原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.starMystic.resupply.requestedWeek !== null) add('receive-star-mystic-supply', '确认下一批三瓶星象师到货', `0行动 · 第${s.starMystic.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.starMystic)) add('request-star-mystic-supply', '向伊蕾·莫文订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.starMystic.guidanceKnown) {
    for (const bottle of s.starMystic.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶星象师魔药`, `0行动 · 独立确认 · 卷轴教授消化${isPromoted ? s.starMystic.scrollProfessorActingAtPromotion : s.progression.acting}/100 · 晋升后${scrollProfessorWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 26, modifiers: [] });
  const remaining = s.starMystic.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.starMystic.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '星象师 · 序列5' : '星象师之路', discovered: available,
    guidanceKnown: available && s.starMystic.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    practice: null,
    ...(isPromoted ? { workshop: projectScrollProfessor(s).workshop } : {}),
    cases: [], environment: '', insideCase: (starMysticInside(s) || inheritedContactOpen(s)),
    ...(available ? { story: STAR_MYSTIC_SOURCE_STATUS } : {}),
    supplies: available ? `${STAR_MYSTIC_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.starMystic.resupply.requestedWeek === null ? `已实际接收后续供给${s.starMystic.resupply.deliveries}批。` : `第${s.starMystic.resupply.requestedWeek}周提出请求，第${s.starMystic.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.starMystic.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 星象师魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? STAR_MYSTIC_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `卷轴教授消化成果${s.starMystic.scrollProfessorActingAtPromotion}/100已保留；星象师扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成卷轴教授消化（${s.progression.acting}/100），并在晋升卷轴教授后度过12整周（${scrollProfessorWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完卷轴教授之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${STAR_MYSTIC_CONSUMPTION_RISK}` : '成为卷轴教授后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isStarMysticAcquisitionCommand(command: unknown): command is StarMysticAcquisitionCommand {
  return validateStarMysticCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateStarMysticCommand(value: unknown): value is StarMysticCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'BUY_LENSES', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (['LEARN_SPELL', 'BUY_KIT', 'CRAFT_SCROLL', 'AUTHORIZE_SCROLL'].includes(value.type as string)) return validateScrollProfessorCommand(value);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^star-mystic-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^star-mystic-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && STAR_MYSTIC_CASE_IDS.includes(value.caseId as typeof STAR_MYSTIC_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && STAR_MYSTIC_CASE_IDS.includes(value.caseId as typeof STAR_MYSTIC_CASE_IDS[number]) && (value.method === 'ORDINARY' || value.method === 'ABILITY' && value.caseId !== 'uncertain-chart');
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateStarMysticState(s: SliceState): boolean {
  const raw: unknown = s.starMystic;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'scrollProfessorActingAtPromotion', 'cases', 'practice', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.pryer) || !record(s.combatScholar) || !record(s.wizard) || !record(s.scrollProfessor)) return false;
  const firstScrollProfessorWeek = s.scrollProfessor.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstScrollProfessorWeek + STAR_MYSTIC_MIN_SCROLL_PROFESSOR_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== STAR_MYSTIC_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, STAR_MYSTIC_CASE_IDS) || !record(raw.practice) || !record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek', 'focused', 'cageReady']) || typeof raw.encounter.focused !== 'boolean' || typeof raw.encounter.cageReady !== 'boolean' || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !Array.isArray(s.combatHistory) || !validateStarMysticLife(s)) return false;
  const starMystic = raw as unknown as StarMysticState, isPromoted = promoted(s);
  if (starMystic.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!starMystic.guidanceKnown || !integer(s.scrollProfessor.promotionWeek, 1, s.week) || !integer(starMystic.promotionWeek, firstConsumptionWeek, s.week) || starMystic.scrollProfessorActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS, ...WIZARD_ABILITY_IDS, ...SCROLL_PROFESSOR_ABILITY_IDS, ...STAR_MYSTIC_ABILITY_IDS,...((s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2)?MYSTIC_ABILITY_IDS:[]),...([3, 2].includes(s.progression.sequence ?? 0)?PROPHECY_MASTER_ABILITY_IDS:[]),...(s.progression.sequence===2?SAGE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (starMystic.promotionWeek !== null || starMystic.scrollProfessorActingAtPromotion !== null || STAR_MYSTIC_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (Object.entries(freshStarMysticPractice()).some(([key, value]) => starMystic.practice[key as keyof StarMysticPractice] !== value)) return false;
    if (starMystic.reflected || Object.values(starMystic.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of starMystic.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `star-mystic-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of starMystic.bottles.entries()) {
    let stockWeek = firstScrollProfessorWeek;
    if (index < STAR_MYSTIC_BOTTLE_IDS.length) {
      if (bottle.source !== STAR_MYSTIC_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!starMystic.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / STAR_MYSTIC_BOTTLE_IDS.length) - 1;
      if (index % STAR_MYSTIC_BOTTLE_IDS.length === 0) {
        const previous = starMystic.bottles.slice(index - STAR_MYSTIC_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > starMystic.promotionWeek!) return false;
    }
    if (!starMystic.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > starMystic.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > starMystic.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== starMystic.promotionWeek) return false;
    }
  }
  if (starMystic.resupply.requestedWeek !== null && (!starMystic.guidanceKnown || isPromoted || !supplyExhausted(starMystic) || starMystic.bottles.some(bottle => bottle.consumedWeek! > starMystic.resupply.requestedWeek!))) return false;
  return successes === (isPromoted ? 1 : 0) && validateStarMysticEncounter(s);
}

export { STAR_MYSTIC_ABILITIES } from './content.js';
export type * from './types.js';
