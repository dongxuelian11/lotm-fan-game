import { ANCIENT_EVIL_ABILITY_IDS } from '../ancient-evil/types.js';
import {SILENT_DISCIPLE_ABILITY_IDS} from '../silent-disciple/types.js';
import {PUPPET_ABILITY_IDS} from '../puppet/types.js';
import {WRAITH_ABILITY_IDS} from '../wraith/types.js';
import {ZOMBIE_ABILITY_IDS} from '../zombie/types.js';
import {WEREWOLF_ABILITY_IDS} from '../werewolf/types.js';
import {MADMAN_ABILITY_IDS} from '../madman/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  PRISONER_ABILITIES, PRISONER_BOTTLE_IDS, PRISONER_CONSUMPTION_RISK, PRISONER_FORMULA_STATUS,
  PRISONER_GUIDE, PRISONER_POTION_SOURCES, PRISONER_PRICES, PRISONER_SOURCE_STATUS,
} from './content.js';
import {
  PRISONER_ABILITY_IDS, PRISONER_CASE_IDS, type PrisonerAcquisitionCommand, type PrisonerAction,
  type PrisonerBottle, type PrisonerCommand, type PrisonerProjection, type PrisonerState,
} from './types.js';

export function createPrisonerState(): PrisonerState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: PRISONER_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(PRISONER_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', holding: false, returns: 0,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'chained' && [9, 8, 7, 6, 5, 4, 3, 2].includes(s.progression.sequence!);
const potionPrice = (bottle: PrisonerBottle) => PRISONER_PRICES.potion - (bottle.labourSteps === 2 ? PRISONER_PRICES.labourCredit : 0);
const bottleNumber = (bottle: PrisonerBottle) => Number(bottle.id.slice('prisoner-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (prisoner: PrisonerState) => prisoner.bottles.length > 0 && prisoner.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${PRISONER_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的囚犯成品魔药，原瓶prisoner-potion-${number}。旧工坊供给为本作原创，完整配方尚未核实，未声称在旧工坊配制；取得此瓶不建立任何组织身份。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isPrisonerAcquisitionCommand(command: PrisonerCommand): command is PrisonerAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact intents only; life owns actual borrowing and return of the original wooden spacer. */
export function validatePrisonerCommand(value: unknown): value is PrisonerCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^prisoner-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^prisoner-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'RETURN', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && PRISONER_CASE_IDS.includes(value.caseId as typeof PRISONER_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && PRISONER_CASE_IDS.includes(value.caseId as typeof PRISONER_CASE_IDS[number]) && ['ABILITY', 'ORDINARY'].includes(value.method as string);
  return false;
}

function commandBlock(s: SliceState, command: PrisonerAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.prisoner.cases).some(caseState => caseState.holding)) return '先实际归还仍由你持有的原木垫块PR9-STOP-01。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到旧工坊管理员。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服囚犯魔药；未服的原瓶仍为你保留。';
  if (s.week < 5) return `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起才能拜访旧工坊管理员。`;
  if (command.type === 'DISCOVER') return s.prisoner.discovered ? '已经认识这位旧工坊管理员。' : null;
  if (!s.prisoner.discovered) return '先拜访旧工坊管理员。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.prisoner.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < PRISONER_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.prisoner.guidanceKnown) return '先听管理员说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.prisoner.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.prisoner) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.prisoner.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.prisoner.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.prisoner) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.prisoner.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选囚犯原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次旧工坊劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy; life owns evidence, original possession, return and withdrawal. */
export function applyPrisonerCommand(s: SliceState, command: PrisonerAcquisitionCommand, c: SeerContext): void {
  rule(validatePrisonerCommand(command) && isPrisonerAcquisitionCommand(command), '囚犯准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.prisoner.discovered = true;
      c.note('认识旧工坊管理员', `你在贝克兰德拜访了${PRISONER_GUIDE}，消耗1行动。这位成年管理员保管三瓶独立封存的囚犯成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。管理员与成品药渠道为本作原创G，不代表已知配方或可以在旧工坊制造魔药。${PRISONER_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= PRISONER_PRICES.guidance;
      s.prisoner.guidanceKnown = true;
      c.note('听取囚犯用药说明', `花费1行动、120便士，听管理员说明三瓶现有魔药的交付方式和指导服药的四档风险。${PRISONER_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。强壮身体、敏锐感知与普通物品运用分别记录掌握度。卡住的窗板、回声小室与共享出口都要先观察，再选择能力或普通方法；处理窗板时两种方法都会实际借用哈伦的原木垫块PR9-STOP-01，成功或失败后都必须实际归还，不能用一句报告代替，也不转移所有权或获得现金。节制与不伤害他人的实践是本作G扮演解释，不保证成长就能消除诅咒。${PRISONER_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.prisoner.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成普通工具编号核对' : '完成工作台与空箱整理', bottle.labourSteps === 1
        ? `你在管理员监督下核对普通工具的编号与现有清单，记录缺项，不接触异常物件，完成一次实际旧工坊劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由管理员保管。第二次整理劳务完成后可抵该瓶600便士。普通劳务不赋予非凡能力，也不产生异常知识污染。`
        : `你在哈伦指导下整理工作台与普通空箱，清出既有过道，归还清单和借用工具，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.prisoner.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('囚犯原瓶交付', `管理员将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次旧工坊劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${PRISONER_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.prisoner.resupply.requestedWeek = s.week;
      c.note('申请下一批囚犯魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${PRISONER_GUIDE}提出下一批三瓶的补给请求，并清点旧工坊收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由管理员持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.prisoner.resupply.deliveries += 1;
      const firstNumber = s.prisoner.resupply.deliveries * PRISONER_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < PRISONER_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.prisoner.bottles.push({ id: `prisoner-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.prisoner.resupply.requestedWeek = null;
      c.note('下一批囚犯原瓶到货', `第${s.week}周，本作G供给第${s.prisoner.resupply.deliveries + 1}批三瓶实际送到旧工坊，原瓶prisoner-potion-${firstNumber}至prisoner-potion-${firstNumber + 2}由管理员保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.prisoner.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'chained';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(PRISONER_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 1], ['knowledge', 0]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为囚犯', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+1、意志+1、知识不增加。强壮身体、敏锐感知与普通物品运用从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。你仍选择如何行动，可在三项本作G实践中稳住原窗板、核实回声与气流、为旁人留下共享出口，普通方法同样保留。窗板实践实际借用哈伦的原木垫块PR9-STOP-01，成功或失败后都须把同一原物归还，所有权与现金不变。节制与不伤害他人的成长是本作G扮演解释，不保证消除诅咒；不获得序列8理智换取提升与精神抵抗、序列7狼人愈合和利爪或序列6活尸护甲与尸体控制。囚犯只是虚构序列名称，不判定玩家犯罪、关押玩家或自动建立组织身份。${PRISONER_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '管理员中断了囚犯晋升' : '囚犯魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。管理员处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Life adds observed scenes and the readable state of the actual original. */
export function projectPrisoner(s: SliceState): PrisonerProjection {
  const actions: PrisonerAction[] = [], isPromoted = promoted(s), known = s.prisoner.discovered;
  const acting = isPromoted ? (s.progression.sequence===9?s.progression.acting:s.madman.prisonerActingAtPromotion??0) : 0;
  const add = (id: string, label: string, cost: string, command: PrisonerAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-prisoner', `拜访${PRISONER_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.prisoner.guidanceKnown) add('learn-prisoner-guidance', '请管理员说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.prisoner.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '普通工具编号核对' : '工作台与空箱整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶囚犯魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.prisoner.resupply.requestedWeek !== null) add('receive-prisoner-supply', '确认下一批三瓶到货', `0行动 · 第${s.prisoner.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.prisoner)) add('request-prisoner-supply', '向管理员订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.prisoner.guidanceKnown) {
    for (const bottle of s.prisoner.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶囚犯魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.prisoner.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.prisoner.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '囚犯 · 序列9' : '囚犯之路', discovered: known, guidanceKnown: s.prisoner.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${PRISONER_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.prisoner.resupply.requestedWeek === null ? `已实际接收后续供给${s.prisoner.resupply.deliveries}批。` : `第${s.prisoner.resupply.requestedWeek}周提出补给请求，第${s.prisoner.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: PRISONER_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.prisoner.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 囚犯成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `管理员保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? PRISONER_ABILITIES.map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可以拜访旧工坊管理员，了解渠道并独立选择服药。`
      : acting >= 100 ? '囚犯魔药已在本作G实践中消化；三项能力仍按各自实际练习分别记录掌握度。这是本段原创扮演解释，不保证成长就能消除诅咒。'
        : acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先观察卡住的窗板、回声小室与共享出口，再选择有限能力或普通方法，实际归还借用的原木垫块PR9-STOP-01后才能收尾。三段实践与反思的消化数值为本作原创G，节制与不伤害他人的成长不保证消除诅咒。'
          : `已留下囚犯扮演经历（${acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${PRISONER_CONSUMPTION_RISK}`
      : '完成4整周普通生活后，从第5周起拜访旧工坊管理员，了解囚犯成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [], insideCase: Object.values(s.prisoner.cases).some(caseState => caseState.holding), environment: '',
  };
}

/** Acquisition verifies shapes and provenance; life validates causal practice transitions. */
export function validatePrisonerState(s: SliceState): boolean {
  const raw: unknown = s.prisoner;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (raw.discovered && s.week < 5) return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== PRISONER_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, PRISONER_CASE_IDS)) return false;
  for (const [caseId, caseState] of Object.entries(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'holding', 'returns'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0) || !integer(caseState.returns, 0)) return false;
    if (caseState.method !== null && !['ABILITY', 'ORDINARY'].includes(caseState.method as string)) return false;
    if (!['NONE', 'SHUTTER_STEADIED', 'DRAFT_IDENTIFIED', 'EXIT_SHARED'].includes(caseState.outcome as string)) return false;
    if (typeof caseState.holding !== 'boolean') return false;
    if (caseId !== 'jammed-shutter' && (caseState.holding || caseState.returns !== 0)) return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const prisoner = raw as unknown as PrisonerState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'chained' && !isPromoted) return false;
  if (isPromoted) {
    if (!prisoner.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...PRISONER_ABILITY_IDS, ...([8, 7, 6, 5, 4, 3, 2].includes(s.progression.sequence!) ? MADMAN_ABILITY_IDS : []), ...([7, 6, 5, 4, 3, 2].includes(s.progression.sequence!) ? WEREWOLF_ABILITY_IDS : []), ...([6, 5, 4, 3, 2].includes(s.progression.sequence!) ? ZOMBIE_ABILITY_IDS : []), ...([5, 4, 3, 2].includes(s.progression.sequence!) ? WRAITH_ABILITY_IDS : []), ...([4, 3, 2].includes(s.progression.sequence!) ? PUPPET_ABILITY_IDS : []), ...([3, 2].includes(s.progression.sequence!) ? SILENT_DISCIPLE_ABILITY_IDS : []), ...(s.progression.sequence === 2 ? ANCIENT_EVIL_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (PRISONER_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || prisoner.reflected
    || Object.values(prisoner.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.outcome !== 'NONE' || caseState.holding || caseState.returns !== 0)) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of prisoner.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `prisoner-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 5;
    if (index < PRISONER_BOTTLE_IDS.length) {
      if (bottle.source !== PRISONER_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!prisoner.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / PRISONER_BOTTLE_IDS.length) - 1;
      if (index % PRISONER_BOTTLE_IDS.length === 0) {
        const previous = prisoner.bottles.slice(index - PRISONER_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!prisoner.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (prisoner.resupply.requestedWeek !== null && (!prisoner.guidanceKnown || !supplyExhausted(prisoner) || prisoner.bottles.some(bottle => bottle.consumedWeek! > prisoner.resupply.requestedWeek!) || s.progression.promotionWeek !== null && prisoner.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { PRISONER_ABILITIES } from './content.js';
export { PRISONER_CASE_IDS } from './types.js';
export type { PrisonerActivityCommand, PrisonerAction, PrisonerProjection } from './types.js';
