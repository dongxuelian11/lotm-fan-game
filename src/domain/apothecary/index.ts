import { BEAUTY_GODDESS_ABILITY_IDS } from '../beauty-goddess/types.js';
import { LIFE_GIVER_ABILITY_IDS } from '../life-giver/types.js';
import {SUMMONING_MASTER_ABILITY_IDS} from '../summoning-master/types.js';
import {WITCH_KING_ABILITY_IDS} from '../witch-king/types.js';
import {CRIMSON_SCHOLAR_ABILITY_IDS} from '../crimson-scholar/types.js';
import {POTION_PROFESSOR_ABILITY_IDS} from '../potion-professor/types.js';
import {VAMPIRE_ABILITY_IDS} from '../vampire/types.js';
import {TAMER_ABILITIES} from '../tamer/content.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  APOTHECARY_ABILITIES, APOTHECARY_BOTTLE_IDS, APOTHECARY_CONSUMPTION_RISK, APOTHECARY_FORMULA_STATUS,
  APOTHECARY_GUIDE, APOTHECARY_POTION_SOURCES, APOTHECARY_PRICES, APOTHECARY_CASES,
} from './content.js';
import {
  APOTHECARY_ABILITY_IDS, APOTHECARY_CASE_IDS, type ApothecaryAcquisitionCommand, type ApothecaryAction,
  type ApothecaryBottle, type ApothecaryCommand, type ApothecaryProjection, type ApothecaryState,
} from './types.js';

export function createApothecaryState(): ApothecaryState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: APOTHECARY_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    clinic: { purchased: 0, materials: 0, healing: 0, calming: 0, spent: 0, supplyWeek: null },
    cases: Object.fromEntries(APOTHECARY_CASES.map(({ id, health, mind }) => [id, {
      status: 'AVAILABLE' as const, choice: null, health, mind,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'moon' && (s.progression.sequence === 9 || s.progression.sequence === 8 || s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0))));
const potionPrice = (bottle: ApothecaryBottle) => APOTHECARY_PRICES.potion - (bottle.labourSteps === 2 ? APOTHECARY_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ApothecaryBottle) => Number(bottle.id.slice('apothecary-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (apothecary: ApothecaryState) => apothecary.bottles.length > 0 && apothecary.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${APOTHECARY_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的药师成品魔药，原瓶apothecary-potion-${number}。诊所供给为本作原创，完整配方资料待核，未声称在诊所配制。`;
const clinicCommands = ['BUY_SUPPLIES', 'PREPARE_MEDICINE', 'USE_HEALING', 'EXAMINE', 'CARE', 'REFLECT'];

/** Only exact, typed intents cross the boundary; acquisition cannot substitute an unknown command. */
export function validateApothecaryCommand(value: unknown): value is ApothecaryCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'BUY_SUPPLIES', 'USE_HEALING', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^apothecary-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^apothecary-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'PREPARE_MEDICINE') return shape(value, ['type', 'kind']) && ['HEALING', 'CALMING'].includes(value.kind as string);
  if (value.type === 'EXAMINE') return shape(value, ['type', 'caseId']) && APOTHECARY_CASE_IDS.includes(value.caseId as typeof APOTHECARY_CASE_IDS[number]);
  if (value.type === 'CARE') return shape(value, ['type', 'caseId', 'choice']) && APOTHECARY_CASE_IDS.includes(value.caseId as typeof APOTHECARY_CASE_IDS[number]) && ['CARE', 'REFER'].includes(value.choice as string);
  return false;
}

function commandBlock(s: SliceState, command: ApothecaryAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到诊所导师。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服药师魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.apothecary.discovered ? '已经认识这位诊所导师。' : null;
  if (!s.apothecary.discovered) return '先拜访诊所导师。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.apothecary.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < APOTHECARY_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.apothecary.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.apothecary.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.apothecary) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.apothecary.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.apothecary.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.apothecary) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.apothecary.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选药师原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次诊所劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy. Clinic commands are dispatched separately. */
export function applyApothecaryCommand(s: SliceState, command: ApothecaryAcquisitionCommand, c: SeerContext): void {
  rule(validateApothecaryCommand(command) && !clinicCommands.includes(command.type), '药师准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.apothecary.discovered = true;
      c.note('认识诊所导师', `你在贝克兰德拜访了${APOTHECARY_GUIDE}，消耗1行动。诊所保管三瓶独立封存的药师成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力。导师与成品药渠道为本作原创G，不代表已知配方或可以在诊所制造魔药。`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= APOTHECARY_PRICES.guidance;
      s.apothecary.guidanceKnown = true;
      c.note('听取药师用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的交付方式和指导服药的四档风险。${APOTHECARY_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。药师能配制护理药物并观察身体和气场线索；观察不是绝对诊断，药物不能复活、再生肢体或清除非凡污染。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.apothecary.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成诊所清点' : '完成药材柜整理', bottle.labourSteps === 1
        ? `你照清单核对诊所的普通器具与封存货架，完成一次实际诊所劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由诊所保管。完成第二次药材柜整理后可抵该瓶600便士。清点不赋予非凡能力，也不会获得晋升魔药配方。`
        : `你按导师要求整理诊所货柜与普通器具存放处，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.apothecary.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('药师原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次诊所劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${APOTHECARY_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.apothecary.resupply.requestedWeek = s.week;
      c.note('申请下一批药师魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${APOTHECARY_GUIDE}提出下一批三瓶的补给请求，并清点诊所收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.apothecary.resupply.deliveries += 1;
      const firstNumber = s.apothecary.resupply.deliveries * APOTHECARY_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < APOTHECARY_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.apothecary.bottles.push({ id: `apothecary-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.apothecary.resupply.requestedWeek = null;
      c.note('下一批药师原瓶到货', `第${s.week}周，本作G供给第${s.apothecary.resupply.deliveries + 1}批三瓶实际送到诊所，原瓶apothecary-potion-${firstNumber}至apothecary-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.apothecary.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'moon';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(APOTHECARY_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['perception', 3], ['will', 3], ['knowledge', 4]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为药师', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，感知+3、意志+3、知识+4，体质不变。三项药师能力从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。这些数值为本作G平衡。药物需要真实材料提前配制；身体和气场观察不是绝对诊断。不能复活、再生肢体或清除非凡污染，强壮体魄与驯兽仍属于后续序列。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了药师晋升' : '药师魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Clinic projection is merged separately, keeping unexamined case information private. */
export function projectApothecary(s: SliceState): ApothecaryProjection {
  const actions: ApothecaryAction[] = [], isPromoted = promoted(s), known = s.apothecary.discovered;
  const add = (id: string, label: string, cost: string, command: ApothecaryAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-apothecary', `拜访${APOTHECARY_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.apothecary.guidanceKnown) add('learn-apothecary-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.apothecary.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '诊所清点' : '药材柜整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶药师魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.apothecary.resupply.requestedWeek !== null) add('receive-apothecary-supply', '确认下一批三瓶到货', `0行动 · 第${s.apothecary.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.apothecary)) add('request-apothecary-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.apothecary.guidanceKnown) {
    for (const bottle of s.apothecary.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶药师魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.apothecary.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.apothecary.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '药师 · 序列9' : '药师之路', discovered: known, guidanceKnown: s.apothecary.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${APOTHECARY_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.apothecary.resupply.requestedWeek === null ? `已实际接收后续供给${s.apothecary.resupply.deliveries}批。` : `第${s.apothecary.resupply.requestedWeek}周提出补给请求，第${s.apothecary.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    actions,
    bottles: known ? s.apothecary.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 药师成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? APOTHECARY_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? (s.progression.sequence!==9?s.tamer.apothecaryActingAtPromotion??100:s.progression.acting) : 0,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : s.progression.sequence!==9?'药师已消化，原护理记录、药剂与能力保留。': s.progression.acting >= 100 ? '药师魔药已消化；药物、观察和毒素抗性仍有各自边界，可查看驯兽师晋升条件。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先观察实际情况，再选择护理或转诊。'
          : `已留下药师扮演经历（${s.progression.acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${APOTHECARY_CONSUMPTION_RISK}`
      : '拜访诊所导师，了解药师成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    clinic: { materials: s.apothecary.clinic.materials, healing: s.apothecary.clinic.healing, calming: s.apothecary.clinic.calming, spent: s.apothecary.clinic.spent },
    cases: [],
  };
}

/** Finished-bottle conservation and provenance; clinic owns treatment/conservation semantics. */
export function validateApothecaryState(s: SliceState): boolean {
  const raw: unknown = s.apothecary;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'clinic', 'cases', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== APOTHECARY_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.clinic) || !shape(raw.clinic, ['purchased', 'materials', 'healing', 'calming', 'spent', 'supplyWeek'])) return false;
  const clinic = raw.clinic;
  if (!['purchased', 'materials', 'healing', 'calming', 'spent'].every(key => integer(clinic[key], 0))) return false;
  if (raw.clinic.supplyWeek !== null && !integer(raw.clinic.supplyWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  if (!record(raw.cases) || !shape(raw.cases, APOTHECARY_CASE_IDS)) return false;
  for (const patient of Object.values(raw.cases)) {
    if (!record(patient) || !shape(patient, ['status', 'choice', 'health', 'mind'])) return false;
    if (!['AVAILABLE', 'EXAMINED', 'RESOLVED'].includes(patient.status as string) || ![null, 'CARE', 'REFER'].includes(patient.choice as null | string)) return false;
    if (!integer(patient.health, 0, 100) || !integer(patient.mind, 0, 100)) return false;
    if ((patient.status === 'RESOLVED') !== (patient.choice !== null)) return false;
  }
  const apothecary = raw as unknown as ApothecaryState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'moon' && !isPromoted) return false;
  if (isPromoted) {
    if (!apothecary.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...(s.progression.sequence===1?BEAUTY_GODDESS_ABILITY_IDS:[]),...APOTHECARY_ABILITY_IDS,...(s.progression.sequence!==9?TAMER_ABILITIES.map(a=>a.id):[]),...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0))))?VAMPIRE_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)))?POTION_PROFESSOR_ABILITY_IDS:[]),...((s.progression.sequence===5||([4, 3, 2, 1].includes(s.progression.sequence ?? 0)))?CRIMSON_SCHOLAR_ABILITY_IDS:[]),...(([4, 3, 2, 1].includes(s.progression.sequence ?? 0))?WITCH_KING_ABILITY_IDS:[]),...([3, 2, 1].includes(s.progression.sequence ?? 0) ? SUMMONING_MASTER_ABILITY_IDS : []),...((s.progression.sequence === 2||s.progression.sequence===1) ? LIFE_GIVER_ABILITY_IDS : [])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else {
    if (APOTHECARY_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || apothecary.reflected) return false;
    if (apothecary.clinic.purchased !== 0 || apothecary.clinic.materials !== 0 || apothecary.clinic.healing !== 0 || apothecary.clinic.calming !== 0 || apothecary.clinic.spent !== 0 || apothecary.clinic.supplyWeek !== null) return false;
    if (APOTHECARY_CASES.some(({ id, health, mind }) => {
      const patient = apothecary.cases[id]!;
      return patient.status !== 'AVAILABLE' || patient.choice !== null || patient.health !== health || patient.mind !== mind;
    })) return false;
  }
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of apothecary.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `apothecary-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < APOTHECARY_BOTTLE_IDS.length) {
      if (bottle.source !== APOTHECARY_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!apothecary.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / APOTHECARY_BOTTLE_IDS.length) - 1;
      if (index % APOTHECARY_BOTTLE_IDS.length === 0) {
        const previous = apothecary.bottles.slice(index - APOTHECARY_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!apothecary.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (apothecary.resupply.requestedWeek !== null && (!apothecary.guidanceKnown || !supplyExhausted(apothecary) || apothecary.bottles.some(bottle => bottle.consumedWeek! > apothecary.resupply.requestedWeek!) || s.progression.promotionWeek !== null && apothecary.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}
