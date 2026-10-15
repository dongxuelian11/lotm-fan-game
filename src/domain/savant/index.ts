import { CIVILIZATION_ENLIGHTENER_ABILITY_IDS } from '../civilization-enlightener/types.js';
import {KNOWLEDGE_MENTOR_ABILITY_IDS} from '../knowledge-mentor/types.js';
import {ARCANE_SCHOLAR_ABILITY_IDS} from '../arcane-scholar/types.js';
import {ALCHEMIST_ABILITY_IDS} from '../alchemist/types.js';
import {ASTRONOMER_ABILITY_IDS} from '../astronomer/types.js';
import {ARTISAN_ABILITY_IDS} from '../artisan/types.js';
import {APPRAISER_ABILITY_IDS} from '../appraiser/types.js';
import {ARCHAEOLOGIST_ABILITIES} from '../archaeologist/content.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  SAVANT_ABILITIES, SAVANT_BOTTLE_IDS, SAVANT_CONSUMPTION_RISK, SAVANT_FORMULA_STATUS,
  SAVANT_GUIDE, SAVANT_POTION_SOURCES, SAVANT_PRICES,
} from './content.js';
import {
  SAVANT_ABILITY_IDS, SAVANT_PROJECT_IDS, type SavantAcquisitionCommand, type SavantAction,
  type SavantBottle, type SavantCommand, type SavantProjection, type SavantState,
} from './types.js';

export function createSavantState(): SavantState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: SAVANT_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    projects: Object.fromEntries(SAVANT_PROJECT_IDS.map(id => [id, {
      status: 'UNREAD' as const, attemptWeek: null, materials: 'SUPPLIER' as const, tool: 'WORKSHOP' as const,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'paragon' && (s.progression.sequence === 9 || s.progression.sequence === 8 || s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))));
const potionPrice = (bottle: SavantBottle) => SAVANT_PRICES.potion - (bottle.labourSteps === 2 ? SAVANT_PRICES.labourCredit : 0);
const bottleNumber = (bottle: SavantBottle) => Number(bottle.id.slice('savant-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (savant: SavantState) => savant.bottles.length > 0 && savant.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SAVANT_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的通识者成品魔药，原瓶savant-potion-${number}。工坊供给为本作原创，完整配方资料待核，未声称在工坊配制。`;
const craftCommands = ['STUDY', 'PREPARE', 'CRAFT', 'DELIVER', 'RETURN_TOOLS', 'REFLECT'];

/** Only exact, typed intents cross the boundary; acquisition cannot substitute an unknown command. */
export function validateSavantCommand(value: unknown): value is SavantCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^savant-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^savant-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['STUDY', 'PREPARE', 'CRAFT', 'DELIVER', 'RETURN_TOOLS'].includes(value.type as string)) return shape(value, ['type', 'projectId']) && SAVANT_PROJECT_IDS.includes(value.projectId as typeof SAVANT_PROJECT_IDS[number]);
  return false;
}

function commandBlock(s: SliceState, command: SavantAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到工坊导师。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服通识者魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.savant.discovered ? '已经认识这位工坊导师。' : null;
  if (!s.savant.discovered) return '先拜访工坊导师。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.savant.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < SAVANT_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.savant.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.savant.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.savant) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.savant.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.savant.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.savant) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.savant.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选通识者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次工坊劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy. Workshop project commands are dispatched separately. */
export function applySavantCommand(s: SliceState, command: SavantAcquisitionCommand, c: SeerContext): void {
  rule(validateSavantCommand(command) && !craftCommands.includes(command.type), '通识者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.savant.discovered = true;
      c.note('认识工坊导师', `你在贝克兰德拜访了${SAVANT_GUIDE}，消耗1行动。工坊保管三瓶独立封存的通识者成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力。导师与成品药渠道为本作原创G，不代表已知配方或可以在工坊制造魔药。`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SAVANT_PRICES.guidance;
      s.savant.guidanceKnown = true;
      c.note('听取通识者用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的交付方式和指导服药的四档风险。${SAVANT_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。通识者增强记忆、学习和实践，仍需亲自学习知识、使用真实工具与材料。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.savant.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成工坊清点' : '完成工作台整理', bottle.labourSteps === 1
        ? `你照清单核对普通工具与货架，完成一次实际工坊劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由工坊保管。完成第二次工作台整理后可抵该瓶600便士。清点不赋予非凡记忆或未知知识。`
        : `你按导师要求清理工作台与普通零件存放处，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.savant.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('通识者原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次工坊劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${SAVANT_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.savant.resupply.requestedWeek = s.week;
      c.note('申请下一批通识者魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${SAVANT_GUIDE}提出下一批三瓶的补给请求，并清点工坊收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.savant.resupply.deliveries += 1;
      const firstNumber = s.savant.resupply.deliveries * SAVANT_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < SAVANT_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.savant.bottles.push({ id: `savant-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.savant.resupply.requestedWeek = null;
      c.note('下一批通识者原瓶到货', `第${s.week}周，本作G供给第${s.savant.resupply.deliveries + 1}批三瓶实际送到工坊，原瓶savant-potion-${firstNumber}至savant-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.savant.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'paragon';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(SAVANT_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['perception', 2], ['will', 2], ['knowledge', 6]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为通识者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，感知+2、意志+2、知识+6，体质不变。三项通识者能力从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。记忆与学习能力不等于无所不知；普通维修仍须先读资料，再备材料与工具，不能鉴定未知神奇物品或制作非凡器物。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了通识者晋升' : '通识者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Workshop projection is merged by the craft module, which owns learned-plan disclosure. */
export function projectSavant(s: SliceState): SavantProjection {
  const actions: SavantAction[] = [], isPromoted = promoted(s), known = s.savant.discovered;
  const add = (id: string, label: string, cost: string, command: SavantAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-savant', `拜访${SAVANT_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.savant.guidanceKnown) add('learn-savant-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.savant.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '工坊清点' : '工作台整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶通识者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.savant.resupply.requestedWeek !== null) add('receive-savant-supply', '确认下一批三瓶到货', `0行动 · 第${s.savant.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.savant)) add('request-savant-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.savant.guidanceKnown) {
    for (const bottle of s.savant.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶通识者魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.savant.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.savant.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '通识者 · 序列9' : '通识者之路', discovered: known, guidanceKnown: s.savant.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${SAVANT_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.savant.resupply.requestedWeek === null ? `已实际接收后续供给${s.savant.resupply.deliveries}批。` : `第${s.savant.resupply.requestedWeek}周提出补给请求，第${s.savant.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: known ? s.savant.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 通识者成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SAVANT_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? (s.progression.sequence!==9?s.archaeologist.savantActingAtPromotion??100:s.progression.acting) : 0,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : s.progression.sequence!==9?'通识者已消化，原图纸、制作成果与能力保留。': s.progression.acting >= 100 ? '通识者魔药已消化，能力掌握仍按实际学习与实践分别记录。可查看考古学家晋升条件。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先学习项目图纸，再把知识用于普通维修。'
          : `已留下通识者扮演经历（${s.progression.acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${SAVANT_CONSUMPTION_RISK}`
      : '拜访工坊导师，了解通识者成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    projects: [],
  };
}

/** Finite-original conservation and provenance. Craft additionally validates its own state transitions. */
export function validateSavantState(s: SliceState): boolean {
  const raw: unknown = s.savant;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'projects', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SAVANT_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.projects) || !shape(raw.projects, SAVANT_PROJECT_IDS)) return false;
  for (const project of Object.values(raw.projects)) {
    if (!record(project) || !shape(project, ['status', 'attemptWeek', 'materials', 'tool'])) return false;
    if (!['UNREAD', 'LEARNED', 'READY', 'DELIVERED'].includes(project.status as string) || !['SUPPLIER', 'WORKBENCH', 'CONSUMED'].includes(project.materials as string) || !['WORKSHOP', 'PLAYER'].includes(project.tool as string)) return false;
    if (project.attemptWeek !== null && !integer(project.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const savant = raw as unknown as SavantState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'paragon' && !isPromoted) return false;
  if (isPromoted) {
    if (!savant.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...(s.progression.sequence===1?CIVILIZATION_ENLIGHTENER_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?KNOWLEDGE_MENTOR_ABILITY_IDS:[]),...SAVANT_ABILITY_IDS,...(s.progression.sequence!==9?ARCHAEOLOGIST_ABILITIES.map(a=>a.id):[]),...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?APPRAISER_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?ARTISAN_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?ASTRONOMER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?ALCHEMIST_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?ARCANE_SCHOLAR_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (SAVANT_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || savant.reflected || Object.values(savant.projects).some(project => project.status !== 'UNREAD' || project.attemptWeek !== null || project.materials !== 'SUPPLIER' || project.tool !== 'WORKSHOP')) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of savant.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `savant-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < SAVANT_BOTTLE_IDS.length) {
      if (bottle.source !== SAVANT_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!savant.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SAVANT_BOTTLE_IDS.length) - 1;
      if (index % SAVANT_BOTTLE_IDS.length === 0) {
        const previous = savant.bottles.slice(index - SAVANT_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!savant.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (savant.resupply.requestedWeek !== null && (!savant.guidanceKnown || !supplyExhausted(savant) || savant.bottles.some(bottle => bottle.consumedWeek! > savant.resupply.requestedWeek!) || s.progression.promotionWeek !== null && savant.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}
