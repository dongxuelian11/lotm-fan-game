import { PALE_EMPEROR_ABILITY_IDS } from '../pale-emperor/types.js';
import {DEATH_CONSUL_ABILITY_IDS} from '../death-consul/types.js';
import {FERRYMAN_ABILITY_IDS} from '../ferryman/types.js';
import {UNDYING_ABILITY_IDS} from '../undying/types.js';
import {GATEKEEPER_ABILITY_IDS} from '../gatekeeper/types.js';
import {SPIRIT_GUIDE_ABILITY_IDS} from '../spirit-guide/types.js';
import {SPIRITMEDIUM_ABILITY_IDS} from '../spiritmedium/types.js';
import {GRAVEDIGGER_ABILITY_IDS} from '../gravedigger/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  CORPSECOLLECTOR_ABILITIES, CORPSECOLLECTOR_BOTTLE_IDS, CORPSECOLLECTOR_CONSUMPTION_RISK, CORPSECOLLECTOR_FORMULA_STATUS,
  CORPSECOLLECTOR_GUIDE, CORPSECOLLECTOR_POTION_SOURCES, CORPSECOLLECTOR_PRICES, CORPSECOLLECTOR_SOURCE_STATUS,
} from './content.js';
import {
  CORPSECOLLECTOR_ABILITY_IDS, CORPSECOLLECTOR_CASE_IDS, type CorpsecollectorAcquisitionCommand, type CorpsecollectorAction,
  type CorpsecollectorBottle, type CorpsecollectorCommand, type CorpsecollectorProjection, type CorpsecollectorState,
} from './types.js';

export function createCorpsecollectorState(): CorpsecollectorState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: CORPSECOLLECTOR_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(CORPSECOLLECTOR_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, mistakes: 0, conclusion: null,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'death' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))));
const potionPrice = (bottle: CorpsecollectorBottle) => CORPSECOLLECTOR_PRICES.potion - (bottle.labourSteps === 2 ? CORPSECOLLECTOR_PRICES.labourCredit : 0);
const bottleNumber = (bottle: CorpsecollectorBottle) => Number(bottle.id.slice('corpsecollector-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (corpsecollector: CorpsecollectorState) => corpsecollector.bottles.length > 0 && corpsecollector.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${CORPSECOLLECTOR_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的收尸人成品魔药，原瓶corpsecollector-potion-${number}。殓房供给为本作原创，已核材料片段不足以构成完整制造配方，未声称在殓房配制。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isCorpsecollectorAcquisitionCommand(command: CorpsecollectorCommand): command is CorpsecollectorAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Only exact, typed intents cross the boundary; acquisition cannot substitute an unknown command. */
export function validateCorpsecollectorCommand(value: unknown): value is CorpsecollectorCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^corpsecollector-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^corpsecollector-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && CORPSECOLLECTOR_CASE_IDS.includes(value.caseId as typeof CORPSECOLLECTOR_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && CORPSECOLLECTOR_CASE_IDS.includes(value.caseId as typeof CORPSECOLLECTOR_CASE_IDS[number]) && ['SIGHT', 'ORDINARY'].includes(value.method as string);
  if (value.type === 'REPORT') return shape(value, ['type', 'caseId', 'conclusion']) && CORPSECOLLECTOR_CASE_IDS.includes(value.caseId as typeof CORPSECOLLECTOR_CASE_IDS[number]) && ['LIMITED', 'CERTAIN'].includes(value.conclusion as string);
  return false;
}

function commandBlock(s: SliceState, command: CorpsecollectorAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到殓房导师。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服收尸人魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.corpsecollector.discovered ? '已经认识这位殓房导师。' : null;
  if (!s.corpsecollector.discovered) return '先拜访殓房导师。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.corpsecollector.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < CORPSECOLLECTOR_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.corpsecollector.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.corpsecollector.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.corpsecollector) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.corpsecollector.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.corpsecollector.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.corpsecollector) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.corpsecollector.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选收尸人原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次殓房劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy. Finite mortuary observations are dispatched separately. */
export function applyCorpsecollectorCommand(s: SliceState, command: CorpsecollectorAcquisitionCommand, c: SeerContext): void {
  rule(validateCorpsecollectorCommand(command) && isCorpsecollectorAcquisitionCommand(command), '收尸人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.corpsecollector.discovered = true;
      c.note('认识独立殓房导师', `你在贝克兰德拜访了${CORPSECOLLECTOR_GUIDE}，消耗1行动。这位成年独立登记员在工作间接待你，保管三瓶独立封存的收尸人成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。导师与成品药渠道为本作原创G，不代表已知配方或可以在殓房制造魔药。${CORPSECOLLECTOR_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= CORPSECOLLECTOR_PRICES.guidance;
      s.corpsecollector.guidanceKnown = true;
      c.note('听取收尸人用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的交付方式和指导服药的四档风险。${CORPSECOLLECTOR_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。${CORPSECOLLECTOR_SOURCE_STATUS}尸体特质、天然灵视与不死生物知识分别记录；实践必须核对眼前对象与原登记资料，普通核实也能完成有限协助。灵视不能直接判断凶手，不提供死亡之眼、通灵问答或复活。接触导师与服药都不建立教会或其它组织身份。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.corpsecollector.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成原登记号核对' : '完成殓房通道整理', bottle.labourSteps === 1
        ? `你在登记员监督下核对已去除身份信息的原登记号清单，记录编号缺页与交接次序，完成一次实际殓房劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由殓房保管。完成第二次通道整理后可抵该瓶600便士。核对不赋予尸体特质、灵视或不死生物知识。`
        : `你在伊芙琳指导下清理殓房外间的既有普通通道并归还所借抹布，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.corpsecollector.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('收尸人原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次殓房劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${CORPSECOLLECTOR_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.corpsecollector.resupply.requestedWeek = s.week;
      c.note('申请下一批收尸人魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${CORPSECOLLECTOR_GUIDE}提出下一批三瓶的补给请求，并清点殓房收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.corpsecollector.resupply.deliveries += 1;
      const firstNumber = s.corpsecollector.resupply.deliveries * CORPSECOLLECTOR_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < CORPSECOLLECTOR_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.corpsecollector.bottles.push({ id: `corpsecollector-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.corpsecollector.resupply.requestedWeek = null;
      c.note('下一批收尸人原瓶到货', `第${s.week}周，本作G供给第${s.corpsecollector.resupply.deliveries + 1}批三瓶实际送到殓房，原瓶corpsecollector-potion-${firstNumber}至corpsecollector-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.corpsecollector.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'death';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(CORPSECOLLECTOR_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 2], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为收尸人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+2、意志+2、知识+1。三项收尸人能力从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。你的体温变低，体能增强，可以有限承受腐烂、寒冷和死亡气息，并获得天然灵视与部分不死生物知识；无智慧亡灵可能误认你为同类。不能免疫一切毒素或伤害、使所有幽灵友善、直接断言凶手、使用死亡之眼或通灵问答，也不自动加入任何组织。${CORPSECOLLECTOR_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了收尸人晋升' : '收尸人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** The activity module adds finite mortuary cases and observations actually made. */
export function projectCorpsecollector(s: SliceState): CorpsecollectorProjection {
  const actions: CorpsecollectorAction[] = [], isPromoted = promoted(s), known = s.corpsecollector.discovered;
  const add = (id: string, label: string, cost: string, command: CorpsecollectorAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-corpsecollector', `拜访${CORPSECOLLECTOR_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.corpsecollector.guidanceKnown) add('learn-corpsecollector-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.corpsecollector.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '原登记号核对' : '殓房通道整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶收尸人魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.corpsecollector.resupply.requestedWeek !== null) add('receive-corpsecollector-supply', '确认下一批三瓶到货', `0行动 · 第${s.corpsecollector.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.corpsecollector)) add('request-corpsecollector-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.corpsecollector.guidanceKnown) {
    for (const bottle of s.corpsecollector.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶收尸人魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.corpsecollector.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.corpsecollector.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '收尸人 · 序列9' : '收尸人之路', discovered: known, guidanceKnown: s.corpsecollector.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${CORPSECOLLECTOR_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.corpsecollector.resupply.requestedWeek === null ? `已实际接收后续供给${s.corpsecollector.resupply.deliveries}批。` : `第${s.corpsecollector.resupply.requestedWeek}周提出补给请求，第${s.corpsecollector.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: CORPSECOLLECTOR_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.corpsecollector.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 收尸人成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? CORPSECOLLECTOR_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?(s.gravedigger.corpsecollectorActingAtPromotion??100):s.progression.acting) : 0,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : (s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))) ? '收尸人晋升前100扮演已经保留；当前更高序列成长另行记录。'
      : s.progression.acting >= 100 ? '收尸人魔药已消化；能力掌握仍按真实检查、有限灵视和谨慎知识应用分别记录。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先核对原登记和眼前对象，再选择有限灵视或普通方法；只有提交有边界的报告才完成协助，未知死因与凶手仍须保留。'
          : `已留下收尸人扮演经历（${s.progression.acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${CORPSECOLLECTOR_CONSUMPTION_RISK}`
      : '拜访殓房导师，了解收尸人成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [], environment: '',
  };
}

/** Finite-original conservation and provenance. The activity module validates evidence boundaries and case transitions. */
export function validateCorpsecollectorState(s: SliceState): boolean {
  const raw: unknown = s.corpsecollector;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== CORPSECOLLECTOR_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, CORPSECOLLECTOR_CASE_IDS)) return false;
  for (const caseState of Object.values(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'mistakes', 'conclusion'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0)) return false;
    if (!integer(caseState.mistakes, 0)) return false;
    if (caseState.method !== null && !['SIGHT', 'ORDINARY'].includes(caseState.method as string)) return false;
    if (caseState.conclusion !== null && !['LIMITED', 'CERTAIN'].includes(caseState.conclusion as string)) return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const corpsecollector = raw as unknown as CorpsecollectorState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'death' && !isPromoted) return false;
  if (isPromoted) {
    if (!corpsecollector.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...(s.progression.sequence===1?PALE_EMPEROR_ABILITY_IDS:[]),...CORPSECOLLECTOR_ABILITY_IDS,...((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?GRAVEDIGGER_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))))?SPIRITMEDIUM_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?SPIRIT_GUIDE_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))))?GATEKEEPER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1)))?UNDYING_ABILITY_IDS:[]),...((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?FERRYMAN_ABILITY_IDS:[]),...((s.progression.sequence===2||s.progression.sequence===1)?DEATH_CONSUL_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (CORPSECOLLECTOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || corpsecollector.reflected
    || Object.values(corpsecollector.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.mistakes !== 0 || caseState.conclusion !== null)) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of corpsecollector.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `corpsecollector-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < CORPSECOLLECTOR_BOTTLE_IDS.length) {
      if (bottle.source !== CORPSECOLLECTOR_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!corpsecollector.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / CORPSECOLLECTOR_BOTTLE_IDS.length) - 1;
      if (index % CORPSECOLLECTOR_BOTTLE_IDS.length === 0) {
        const previous = corpsecollector.bottles.slice(index - CORPSECOLLECTOR_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!corpsecollector.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (corpsecollector.resupply.requestedWeek !== null && (!corpsecollector.guidanceKnown || !supplyExhausted(corpsecollector) || corpsecollector.bottles.some(bottle => bottle.consumedWeek! > corpsecollector.resupply.requestedWeek!) || s.progression.promotionWeek !== null && corpsecollector.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { CORPSECOLLECTOR_ABILITIES } from './content.js';
export { CORPSECOLLECTOR_CASE_IDS } from './types.js';
export type { CorpsecollectorActivityCommand, CorpsecollectorAction, CorpsecollectorProjection } from './types.js';
