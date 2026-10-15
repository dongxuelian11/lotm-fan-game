import { SAGE_ABILITY_IDS } from '../sage/types.js';
import {PROPHECY_MASTER_ABILITY_IDS} from '../prophecy-master/types.js';
import {MYSTIC_ABILITY_IDS} from '../mystic/types.js';
import {STAR_MYSTIC_ABILITY_IDS} from '../star-mystic/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { PRYER_ABILITY_IDS } from '../pryer/types.js';
import { COMBAT_SCHOLAR_ABILITY_IDS } from '../combat-scholar/types.js';
import { validateScrollProfessorLife } from './life.js';
import { WIZARD_ABILITY_IDS, WIZARD_SPELL_IDS } from '../wizard/types.js';
import { WIZARD_SPELLS } from '../wizard/content.js';
import {
  SCROLL_PROFESSOR_ABILITIES, SCROLL_PROFESSOR_BOTTLE_IDS, SCROLL_PROFESSOR_CONSUMPTION_RISK, SCROLL_PROFESSOR_FORMULA_STATUS,
  SCROLL_PROFESSOR_SCROLLS, SCROLL_PROFESSOR_GUIDE, SCROLL_PROFESSOR_LABOUR_TASKS, SCROLL_PROFESSOR_MIN_WIZARD_WEEKS, SCROLL_PROFESSOR_POTION_SOURCES, SCROLL_PROFESSOR_PRICES, SCROLL_PROFESSOR_SOURCE_STATUS,
} from './content.js';
import {
  SCROLL_PROFESSOR_ABILITY_IDS, SCROLL_PROFESSOR_SCROLL_KINDS, SCROLL_PROFESSOR_CASE_IDS, type ScrollProfessorAcquisitionCommand, type ScrollProfessorAction,
  type ScrollProfessorBottle, type ScrollProfessorCommand, type ScrollProfessorProjection, type ScrollProfessorState,
} from './types.js';

export function createScrollProfessorState(): ScrollProfessorState {
  return {
    guidanceKnown: false,
    bottles: SCROLL_PROFESSOR_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    promotionWeek: null, wizardActingAtPromotion: null,
    cases: Object.fromEntries(SCROLL_PROFESSOR_CASE_IDS.map(id => [id, { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, closes: 0, usedScrollIds: [] }])),
    workshop: { kitsBought: 0, lastKitWeek: null, materials: [], craftAttempts: 0, craftFailures: 0, scrolls: [] },
    reflected: false,
    encounter: { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null },
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const promoted = (s: SliceState) => s.progression.pathwayId === 'hermit' && (s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2)));
const isWizard = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 7;
const knownChannel = (s: SliceState) => s.pryer.discovered && s.pryer.guidanceKnown && s.combatScholar.guidanceKnown && s.wizard.guidanceKnown && s.wizard.promotionWeek !== null && (isWizard(s) || promoted(s));
const potionPrice = (bottle: ScrollProfessorBottle) => SCROLL_PROFESSOR_PRICES.potion - (bottle.labourSteps === 5 ? SCROLL_PROFESSOR_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ScrollProfessorBottle) => Number(bottle.id.slice('scroll-professor-potion-'.length));
const wizardWeeks = (s: SliceState) => Math.max(0, (s.scrollProfessor.promotionWeek ?? s.week) - (s.wizard.promotionWeek ?? s.week));
const supplyExhausted = (state: ScrollProfessorState) => state.bottles.length >= 3 && state.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SCROLL_PROFESSOR_GUIDE}的独立卷轴教授成品交接渠道本作G成品供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的序列6卷轴教授魔药，原瓶scroll-professor-potion-${number}，非窥秘人、格斗学者或巫师旧瓶改装。完整配方资料待核。`;

function commandBlock(s: SliceState, command: ScrollProfessorAcquisitionCommand): string | null {
  const actions = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.scrollProfessor.cases).some(value => value.contactOpen)) return '先实际结束本次卷轴教授实践的接触，再继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的原法术教学室，找到伊蕾。';
  if (!knownChannel(s)) return '成为巫师并保有伊蕾的指导渠道后，才能继续了解卷轴教授之路。';
  if (promoted(s)) return '你已完成卷轴教授晋升，不能重复服用或继续准备这份魔药；未服原瓶仍保留。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.scrollProfessor.guidanceKnown) return '已经听过卷轴教授成品魔药的用药说明。';
    return s.cash < SCROLL_PROFESSOR_PRICES.guidance ? '卷轴教授用药指导需要360便士。' : null;
  }
  if (!s.scrollProfessor.guidanceKnown) return '先听伊蕾说明这批序列6原瓶的来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.scrollProfessor.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一真实周实际到货。';
    return supplyExhausted(s.scrollProfessor) ? null : '须先用完现有全部卷轴教授原瓶且仍未晋升，才能申请下一批。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.scrollProfessor.resupply.requestedWeek === null) return '尚未申请下一批卷轴教授补给。';
    if (s.week <= s.scrollProfessor.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return supplyExhausted(s.scrollProfessor) ? null : '现有原瓶尚未全部耗尽失败，不能重复补货。';
  }
  const bottle = s.scrollProfessor.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选卷轴教授原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '本次选定原瓶的服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    if (s.progression.acting < 100) return `巫师魔药尚未消化，扮演${s.progression.acting}/100。`;
    if (s.wizard.promotionWeek === null || wizardWeeks(s) < SCROLL_PROFESSOR_MIN_WIZARD_WEEKS) return `成为巫师后已度过${wizardWeeks(s)}/${SCROLL_PROFESSOR_MIN_WIZARD_WEEKS}整周，尚不能服药。`;
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 5 ? '这瓶对应的五次原法术教学室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates only the caller's working copy; the shared slice commits the whole intent. */
export function applyScrollProfessorCommand(s: SliceState, command: ScrollProfessorAcquisitionCommand, c: SeerContext): void {
  rule(validateScrollProfessorCommand(command) && isScrollProfessorAcquisitionCommand(command), '卷轴教授准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SCROLL_PROFESSOR_PRICES.guidance;
      s.scrollProfessor.guidanceKnown = true;
      c.note('听取卷轴教授用药说明', `花费1行动、360便士，你向已认识的本作原创成年${SCROLL_PROFESSOR_GUIDE}继续请教，她向你说明从独立卷轴教授成品交接渠道实际取得的三瓶序列6成品、逐瓶交付与四档风险。这些不是原来的窥秘人、格斗学者或巫师存药。${SCROLL_PROFESSOR_FORMULA_STATUS}巫师消化须达100，晋升巫师后满12整周才能服用；可提前筹备。${SCROLL_PROFESSOR_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.scrollProfessor.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      const task = SCROLL_PROFESSOR_LABOUR_TASKS[bottle.labourSteps - 1]!;
      c.note(`完成${task}`, `你在伊蕾的原法术教学室实际完成${task}，消耗1行动。第${bottleNumber(bottle)}瓶劳动${bottle.labourSteps}/5，原瓶仍由导师保管。${bottle.labourSteps === 5 ? '五次劳务只抵这瓶3000便士，仍须实际支付320便士才会交付；不折现，也不产生材料或他人的货物。' : '完成对应五次劳务后才能抵这瓶3000便士，未完成时不部分抵扣。'}`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.scrollProfessor.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('卷轴教授原瓶交付', `导师将第${bottleNumber(bottle)}瓶序列6成品魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 5 ? '对应五次原法术教学室劳务抵扣3000便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；巫师消化100且晋升巫师后满12整周时，再独立确认服药。${SCROLL_PROFESSOR_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.scrollProfessor.resupply.requestedWeek = s.week;
      c.note('申请下一批卷轴教授魔药', `现有卷轴教授原瓶全部耗尽且未晋升。你花费1行动，请${SCROLL_PROFESSOR_GUIDE}从同一新渠道订下一批三瓶，并实际核验原法术教学室的收货清单。本周没有新增原瓶；第${s.week + 1}周起可确认到货。每瓶仍须另付3320便士，或分别完成五次劳务后支付320便士。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.scrollProfessor.bottles.length + 1;
      s.scrollProfessor.resupply.deliveries += 1;
      for (let offset = 0; offset < SCROLL_PROFESSOR_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.scrollProfessor.bottles.push({ id: `scroll-professor-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.scrollProfessor.resupply.requestedWeek = null;
      c.note('下一批卷轴教授原瓶到货', `第${s.week}周，伊蕾的独立卷轴教授成品交接渠道本作G成品供给第${s.scrollProfessor.resupply.deliveries + 1}批三瓶实际到货，原瓶scroll-professor-potion-${firstNumber}至scroll-professor-potion-${firstNumber + 2}由导师保管，0行动。旧原瓶、失败和排异记录保留。到货没有免费交付；新瓶须分别按3320便士购买，或完成对应五次劳务再付320便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.scrollProfessor.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 24);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.scrollProfessor.wizardActingAtPromotion = s.progression.acting;
        s.scrollProfessor.promotionWeek = s.week;
        s.progression.sequence = 6;
        s.progression.acting = 0;
        for (const id of SCROLL_PROFESSOR_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为卷轴教授', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+1、感知+1、意志+1、知识+1。窥秘人、格斗学者与巫师全部原能力及原ID掌握完整继承，只新增卷轴制造一项，从0掌握开始；巫师消化成果与巫师晋升周保留，卷轴教授扮演从0开始。灵性上限提高到80，当前灵性没有补满。卷轴须以真实G灵性材料将本人已学术式事先写入，成功才有独立实体；晋升不自动学习法术。卷轴只烧用一次、使用仍可能失败；没有序列5星象或序列4神秘再现。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了卷轴教授晋升' : '卷轴教授魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是巫师，消化与全部原有掌握保留，没有获得卷轴教授能力。导师处理了这次服药排异，未发生死亡；需要休养，重试须领取另一瓶现有成品。`);
      }
      return;
    }
  }
}

export function projectScrollProfessor(s: SliceState): ScrollProfessorProjection {
  const actions: ScrollProfessorAction[] = [], available = knownChannel(s), isPromoted = promoted(s);
  const acting = isPromoted ? ((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))?s.starMystic.scrollProfessorActingAtPromotion??100:s.progression.acting) : 0;
  const add = (id: string, label: string, cost: string, command: ScrollProfessorAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && !isPromoted) {
    if (!s.scrollProfessor.guidanceKnown) add('learn-scroll-professor-guidance', '请伊蕾说明卷轴教授成品与风险', '1行动 · 360便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
    else {
      for (const bottle of s.scrollProfessor.bottles) if (bottle.status === 'SUPPLIER') {
        const number = bottleNumber(bottle);
        if (bottle.labourSteps < 5) add(`work-${bottle.id}`, `第${number}瓶 · ${SCROLL_PROFESSOR_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5，完成五次抵该瓶3000便士`, { type: 'POTION_WORK', bottleId: bottle.id });
        add(`buy-${bottle.id}`, `领取第${number}瓶卷轴教授魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有序列6原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
      }
      if (s.scrollProfessor.resupply.requestedWeek !== null) add('receive-scroll-professor-supply', '确认下一批三瓶卷轴教授到货', `0行动 · 第${s.scrollProfessor.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
      else if (supplyExhausted(s.scrollProfessor)) add('request-scroll-professor-supply', '向伊蕾订下一批并核验收货清单', '1行动 · 下一真实周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
    }
  }
  if (available && s.scrollProfessor.guidanceKnown) {
    for (const bottle of s.scrollProfessor.bottles) if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶卷轴教授魔药`, `0行动 · 独立确认 · 巫师消化${isPromoted ? s.scrollProfessor.wizardActingAtPromotion : s.progression.acting}/100 · 晋升后${wizardWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 24, modifiers: [] });
  const remaining = s.scrollProfessor.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.scrollProfessor.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '卷轴教授 · 序列6' : '卷轴教授之路', discovered: available,
    guidanceKnown: available && s.scrollProfessor.guidanceKnown, promoted: isPromoted, formulaKnown: false, formula: [],
    workshop: isPromoted ? {
      summary: `已购买${s.scrollProfessor.workshop.kitsBought}包原创G制卷材料，制造${s.scrollProfessor.workshop.craftAttempts}次、失败${s.scrollProfessor.workshop.craftFailures}次。每包100便士、1行动、4份独立实体材料，每个真实周最多买1包；制造每次1行动、2灵性、1份材料，失败照耗。卷轴跨周保留，启动耗1灵性并一次烧尽，使用仍可能失败。`,
      materials: s.scrollProfessor.workshop.materials.map(material => ({ ...material })),
      lessons: WIZARD_SPELLS.map(spell => ({ ...spell, learned: s.wizard.lessons[spell.id]!.learned })),
      scrolls: s.scrollProfessor.workshop.scrolls.map(scroll => ({ ...scroll, title: SCROLL_PROFESSOR_SCROLLS[scroll.kind].title, source: `第${scroll.createdWeek}周以原创G材料${scroll.materialId}制成；制造者序列${scroll.makerSequence}，制造时卷轴掌握${scroll.inscriptionMastery}，原卷轴${scroll.id}。` })),
    } : { summary: '', materials: [], lessons: [], scrolls: [] },
    cases: [], environment: '', insideCase: Object.values(s.scrollProfessor.cases).some(value => value.contactOpen),
    ...(available ? { story: SCROLL_PROFESSOR_SOURCE_STATUS } : {}),
    supplies: available ? `${SCROLL_PROFESSOR_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.scrollProfessor.resupply.requestedWeek === null ? `已实际接收后续供给${s.scrollProfessor.resupply.deliveries}批。` : `第${s.scrollProfessor.resupply.requestedWeek}周提出请求，第${s.scrollProfessor.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: available ? s.scrollProfessor.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 卷轴教授魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/5`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SCROLL_PROFESSOR_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: isPromoted ? `巫师消化成果${s.scrollProfessor.wizardActingAtPromotion}/100已保留；卷轴教授扮演${acting}/100，能力掌握分别记录。`
      : available ? `服药前需完成巫师消化（${s.progression.acting}/100），并在晋升巫师后度过12整周（${wizardWeeks(s)}/12）。用药指导与原瓶可以提前准备。` : '先走完巫师之路。',
    pollution: s.seer.pollution,
    risk: available ? `步骤：用药指导 → 购买，或完成对应五次劳务后付款领取 → 满足消化与成熟条件 → 独立确认服用本次选定原瓶。每批3瓶；全部耗尽失败后，可以花1行动请求下一批，下一真实周起确认到货，每瓶费用与劳务不变。${SCROLL_PROFESSOR_CONSUMPTION_RISK}` : '成为巫师后，可向原导师了解下一序列。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

const acquisitionCommands = ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isScrollProfessorAcquisitionCommand(command: unknown): command is ScrollProfessorAcquisitionCommand {
  return validateScrollProfessorCommand(command) && acquisitionCommands.includes(command.type);
}

/** Exact command boundaries are shared by the public bridge and both domain entry points. */
export function validateScrollProfessorCommand(value: unknown): value is ScrollProfessorCommand {
  if (!record(value)) return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'BUY_KIT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(value.type as string)) return shape(value, ['type']);
  if (value.type === 'CRAFT_SCROLL') return shape(value, ['type', 'kind']) && SCROLL_PROFESSOR_SCROLL_KINDS.includes(value.kind as typeof SCROLL_PROFESSOR_SCROLL_KINDS[number]);
  if (value.type === 'LEARN_SPELL') return shape(value, ['type', 'spellId']) && WIZARD_SPELL_IDS.includes(value.spellId as typeof WIZARD_SPELL_IDS[number]);
  if (value.type === 'AUTHORIZE_SCROLL') return shape(value, ['type', 'scrollId', 'authorized']) && typeof value.scrollId === 'string' && /^scroll-professor-scroll-[1-9]\d{0,14}$/.test(value.scrollId) && typeof value.authorized === 'boolean';
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^scroll-professor-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^scroll-professor-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SCROLL_PROFESSOR_CASE_IDS.includes(value.caseId as typeof SCROLL_PROFESSOR_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && SCROLL_PROFESSOR_CASE_IDS.includes(value.caseId as typeof SCROLL_PROFESSOR_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

/** Acquisition owns bottle identity and promotion chronology; activities own meaningful case transitions, actual stopping, and exact outcome/source gates. */
export function validateScrollProfessorState(s: SliceState): boolean {
  const raw: unknown = s.scrollProfessor;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'wizardActingAtPromotion', 'cases', 'workshop', 'reflected', 'encounter']) || typeof raw.guidanceKnown !== 'boolean' || typeof raw.reflected !== 'boolean') return false;
  if (!record(s.progression) || !record(s.progression.mastery) || !record(s.pryer) || !record(s.combatScholar) || !record(s.wizard)) return false;
  const firstWizardWeek = s.wizard.promotionWeek ?? s.week;
  const firstConsumptionWeek = firstWizardWeek + SCROLL_PROFESSOR_MIN_WIZARD_WEEKS;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - firstConsumptionWeek))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, firstConsumptionWeek, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SCROLL_PROFESSOR_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(raw.cases) || !shape(raw.cases, SCROLL_PROFESSOR_CASE_IDS)) return false;
  const firstActivityWeek = Math.max(firstConsumptionWeek, typeof raw.promotionWeek === 'number' ? raw.promotionWeek : firstConsumptionWeek);
  for (const value of Object.values(raw.cases)) {
    if (!record(value) || !shape(value, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes', 'usedScrollIds'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(value.status as string) || !integer(value.withdrawals, 0)) return false;
    if (value.method !== null && !['ABILITY', 'ORDINARY'].includes(value.method as string)) return false;
    if (!['NONE', 'PAPER_VERIFIED', 'WARD_VERIFIED', 'LESSON_VERIFIED'].includes(value.outcome as string)) return false;
    if (typeof value.contactOpen !== 'boolean' || !integer(value.closes, 0) || !Array.isArray(value.usedScrollIds)) return false;
    if (value.attemptWeek !== null && !integer(value.attemptWeek, firstActivityWeek, s.week)) return false;
  }
  const scrollProfessor = raw as unknown as ScrollProfessorState, isPromoted = promoted(s);
  if (scrollProfessor.guidanceKnown && !knownChannel(s)) return false;
  if (isPromoted) {
    if (!scrollProfessor.guidanceKnown || !integer(s.wizard.promotionWeek, 1, s.week) || !integer(scrollProfessor.promotionWeek, firstConsumptionWeek, s.week) || scrollProfessor.wizardActingAtPromotion !== 100) return false;
    if (!shape(s.progression.mastery, [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS, ...WIZARD_ABILITY_IDS, ...SCROLL_PROFESSOR_ABILITY_IDS,...((s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2))?STAR_MYSTIC_ABILITY_IDS:[]),...((s.progression.sequence===4||s.progression.sequence===3||s.progression.sequence===2)?MYSTIC_ABILITY_IDS:[]),...([3, 2].includes(s.progression.sequence ?? 0)?PROPHECY_MASTER_ABILITY_IDS:[]),...(s.progression.sequence===2?SAGE_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (scrollProfessor.promotionWeek !== null || scrollProfessor.wizardActingAtPromotion !== null || SCROLL_PROFESSOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
    if (scrollProfessor.reflected || Object.values(scrollProfessor.cases).some(value => value.status !== 'AVAILABLE' || value.attemptWeek !== null || value.method !== null || value.outcome !== 'NONE' || value.withdrawals !== 0 || value.contactOpen || value.closes !== 0 || !Array.isArray(value.usedScrollIds) || value.usedScrollIds.length !== 0)) return false;
  }
  // Check every record before reading a preceding batch, so malformed saves return false rather than throw.
  for (const [index, bottle] of scrollProfessor.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `scroll-professor-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 5)) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of scrollProfessor.bottles.entries()) {
    let stockWeek = firstWizardWeek;
    if (index < SCROLL_PROFESSOR_BOTTLE_IDS.length) {
      if (bottle.source !== SCROLL_PROFESSOR_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!scrollProfessor.guidanceKnown || !integer(stockWeek, firstConsumptionWeek + 1, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SCROLL_PROFESSOR_BOTTLE_IDS.length) - 1;
      if (index % SCROLL_PROFESSOR_BOTTLE_IDS.length === 0) {
        const previous = scrollProfessor.bottles.slice(index - SCROLL_PROFESSOR_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
      if (isPromoted && stockWeek > scrollProfessor.promotionWeek!) return false;
    }
    if (!scrollProfessor.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
    if (bottle.status === 'SUPPLIER') {
      if (bottle.acquiredWeek !== null || bottle.consumedWeek !== null || bottle.outcome !== null) return false;
      continue;
    }
    if (!integer(bottle.acquiredWeek, stockWeek, s.week) || isPromoted && bottle.acquiredWeek! > scrollProfessor.promotionWeek!) return false;
    if (bottle.status === 'PLAYER') {
      if (bottle.consumedWeek !== null || bottle.outcome !== null) return false;
    } else if (bottle.status === 'CONSUMED') {
      if (!integer(bottle.consumedWeek, Math.max(firstConsumptionWeek, bottle.acquiredWeek!), s.week) || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string)) return false;
      if (isPromoted ? bottle.consumedWeek! > scrollProfessor.promotionWeek! : s.progression.acting !== 100) return false;
    } else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') {
      successes += 1;
      if (bottle.consumedWeek !== scrollProfessor.promotionWeek) return false;
    }
  }
  if (scrollProfessor.resupply.requestedWeek !== null && (!scrollProfessor.guidanceKnown || isPromoted || !supplyExhausted(scrollProfessor) || scrollProfessor.bottles.some(bottle => bottle.consumedWeek! > scrollProfessor.resupply.requestedWeek!))) return false;
  if (!record(raw.encounter) || !shape(raw.encounter, ['status', 'startHistoryIndex', 'attemptWeek']) || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(raw.encounter.status as string)) return false;
  const e = scrollProfessor.encounter;
  if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek !== null && !integer(e.attemptWeek, scrollProfessor.promotionWeek ?? s.week, s.week)) return false;
  if (!isPromoted && (e.status !== 'AVAILABLE' || e.startHistoryIndex !== null || e.attemptWeek !== null)) return false;
  if (e.status !== 'AVAILABLE' && e.attemptWeek === null || e.status === 'AVAILABLE' && e.startHistoryIndex !== null) return false;
  if ((e.status === 'FIGHTING') !== (s.combat?.encounterId === 'SCROLL_PROFESSOR_DISPUTE')) return false;
  if (['FIGHTING', 'RETREATED', 'LOST'].includes(e.status) && e.startHistoryIndex === null) return false;
  if (e.attemptWeek !== null && !Object.values(scrollProfessor.cases).some(r => r.status === 'RESOLVED')) return false;
  if (e.status === 'FIGHTING' && (e.attemptWeek !== s.week || s.status !== 'ACTIVE' || s.activeEvent !== null || s.world.city !== 'BACKLUND' || Object.values(scrollProfessor.cases).some(r => r.contactOpen || r.status === 'PREPARED'))) return false;
  if (e.status === 'LOST' && s.status !== 'DEAD') return false;
  const effective = e.startHistoryIndex !== null && s.combatHistory.slice(e.startHistoryIndex).some(r => r.retreat === 'NONE' && r.moves.some(move => move.actor === 'PLAYER' && (move.selfGain > 0 || move.enemyReduction > 0)));
  const disputeAwards = s.seer.completedSources.filter(source => source === 'scroll-professor-dispute').length;
  // A later Sage death cannot erase an award earned while this old S6 encounter
  // was actually resolved. Death during the original S6 stage still cannot award it.
  const laterSageDeath = s.status === 'DEAD' && s.progression.pathwayId === 'hermit' && s.progression.sequence === 2 &&
    e.attemptWeek !== null && integer(s.sage?.promotionWeek, e.attemptWeek, s.week) && s.sage.prophecyMasterActingAtPromotion === 100;
  if (disputeAwards > 1 || disputeAwards === 1 && (e.status !== 'RESOLVED' || s.status === 'DEAD' && !laterSageDeath || !effective)) return false;
  return successes === (isPromoted ? 1 : 0) && validateScrollProfessorLife(s);
}

export { SCROLL_PROFESSOR_ABILITIES } from './content.js';
export type * from './types.js';
