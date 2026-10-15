import { GLORY_ABILITY_IDS } from '../glory/types.js';
import {SILVER_KNIGHT_ABILITY_IDS} from '../silver-knight/types.js';
import {DEMON_HUNTER_ABILITY_IDS} from '../demon-hunter/types.js';
import {GUARDIAN_ABILITY_IDS} from '../guardian/types.js';
import {DAWN_PALADIN_ABILITY_IDS} from '../dawn-paladin/types.js';
import {WEAPONMASTER_ABILITY_IDS} from '../weaponmaster/types.js';
import {GLADIATOR_ABILITY_IDS} from '../gladiator/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  WARRIOR_ABILITIES, WARRIOR_BOTTLE_IDS, WARRIOR_CONSUMPTION_RISK, WARRIOR_FORMULA_STATUS,
  WARRIOR_GUIDE, WARRIOR_PRACTICE_CLUB, WARRIOR_POTION_SOURCES, WARRIOR_PRICES, WARRIOR_SOURCE_STATUS,
} from './content.js';
import {
  WARRIOR_ABILITY_IDS, WARRIOR_CASE_IDS, type WarriorAcquisitionCommand, type WarriorAction,
  type WarriorBottle, type WarriorCommand, type WarriorProjection, type WarriorState,
} from './types.js';

export function createWarriorState(): WarriorState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: WARRIOR_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(WARRIOR_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE',
    }])),
    practiceClub: { ...WARRIOR_PRACTICE_CLUB },
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'warrior' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const potionPrice = (bottle: WarriorBottle) => WARRIOR_PRICES.potion - (bottle.labourSteps === 2 ? WARRIOR_PRICES.labourCredit : 0);
const bottleNumber = (bottle: WarriorBottle) => Number(bottle.id.slice('warrior-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (warrior: WarriorState) => warrior.bottles.length > 0 && warrior.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${WARRIOR_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的战士成品魔药，原瓶warrior-potion-${number}。训练场供给为本作原创，完整配方尚未核实，未声称在训练场配制；取得此瓶不建立任何家族或组织身份。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isWarriorAcquisitionCommand(command: WarriorCommand): command is WarriorAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Only exact, typed intents cross the boundary; acquisition cannot substitute an unknown command. */
export function validateWarriorCommand(value: unknown): value is WarriorCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'RETURN_TOOL'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^warrior-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^warrior-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'REPORT', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && WARRIOR_CASE_IDS.includes(value.caseId as typeof WARRIOR_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && WARRIOR_CASE_IDS.includes(value.caseId as typeof WARRIOR_CASE_IDS[number]) && ['POWER', 'TEAM'].includes(value.method as string);
  return false;
}

function commandBlock(s: SliceState, command: WarriorAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到训练场导师。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服战士魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.warrior.discovered ? '已经认识这位训练场导师。' : null;
  if (!s.warrior.discovered) return '先拜访训练场导师。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.warrior.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < WARRIOR_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.warrior.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.warrior.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.warrior) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.warrior.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.warrior.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.warrior) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.warrior.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选战士原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次训练场劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy; life activities own the real club loan. */
export function applyWarriorCommand(s: SliceState, command: WarriorAcquisitionCommand, c: SeerContext): void {
  rule(validateWarriorCommand(command) && isWarriorAcquisitionCommand(command), '战士准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.warrior.discovered = true;
      c.note('认识独立训练场导师', `你在贝克兰德拜访了${WARRIOR_GUIDE}，消耗1行动。这位成年独立导师在训练场接待你，保管三瓶独立封存的战士成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。导师与成品药渠道为本作原创G，不代表已知配方或可以在训练场制造魔药。${WARRIOR_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= WARRIOR_PRICES.guidance;
      s.warrior.guidanceKnown = true;
      c.note('听取战士用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的交付方式和指导服药的四档风险。${WARRIOR_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。${WARRIOR_SOURCE_STATUS}本阶段按强健体魄、持械训练与克制施力三个本作G训练分类记录掌握度；实践必须先检查真实负重、支点、旁人和退路，普通团队方法也能完成现场协助。练习棍只在实际借出后由你持有，所有权仍属导师，归还不会变出第二根棍。力量增长不带来恐惧免疫、徒手防弹或自动精通所有武器。接触导师与服药都不建立教会或其它组织身份。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.warrior.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成训练场器械点验' : '完成沙袋与支架整理', bottle.labourSteps === 1
        ? `你在导师监督下逐件检查训练场器械编号、支架与借还清单，记录磨损和缺件，完成一次实际训练场劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由训练场保管。完成第二次沙袋与支架整理后可抵该瓶600便士。点验不赋予非凡能力，也不把训练棍或其它器械交给你保管。`
        : `你在奥斯温指导下整理训练场的沙袋与器械支架，并将点验清单归还原柜，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.warrior.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('战士原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次训练场劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${WARRIOR_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.warrior.resupply.requestedWeek = s.week;
      c.note('申请下一批战士魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${WARRIOR_GUIDE}提出下一批三瓶的补给请求，并清点训练场收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.warrior.resupply.deliveries += 1;
      const firstNumber = s.warrior.resupply.deliveries * WARRIOR_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < WARRIOR_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.warrior.bottles.push({ id: `warrior-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.warrior.resupply.requestedWeek = null;
      c.note('下一批战士原瓶到货', `第${s.week}周，本作G供给第${s.warrior.resupply.deliveries + 1}批三瓶实际送到训练场，原瓶warrior-potion-${firstNumber}至warrior-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.warrior.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'warrior';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(WARRIOR_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 4], ['perception', 1], ['will', 1], ['knowledge', 0]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为战士', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+4、感知+1、意志+1、知识不增加。强健体魄、持械训练与克制施力三个本作G训练分类从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。你能对现场真实障碍练习有限施力，也可与团队合作；训练棍仍须实际借用和归还。不会自动精通所有武器，没有恐惧免疫、徒手防弹或序列6的晨曦铠甲与光之风暴，也不自动加入任何组织。${WARRIOR_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了战士晋升' : '战士魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Life projection adds only observed scenes and the actual club custody. */
export function projectWarrior(s: SliceState): WarriorProjection {
  const actions: WarriorAction[] = [], isPromoted = promoted(s), known = s.warrior.discovered;
  const add = (id: string, label: string, cost: string, command: WarriorAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-warrior', `拜访${WARRIOR_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.warrior.guidanceKnown) add('learn-warrior-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.warrior.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '训练场器械点验' : '沙袋与支架整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶战士魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.warrior.resupply.requestedWeek !== null) add('receive-warrior-supply', '确认下一批三瓶到货', `0行动 · 第${s.warrior.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.warrior)) add('request-warrior-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.warrior.guidanceKnown) {
    for (const bottle of s.warrior.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶战士魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.warrior.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.warrior.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '战士 · 序列9' : '战士之路', discovered: known, guidanceKnown: s.warrior.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${WARRIOR_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.warrior.resupply.requestedWeek === null ? `已实际接收后续供给${s.warrior.resupply.deliveries}批。` : `第${s.warrior.resupply.requestedWeek}周提出补给请求，第${s.warrior.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: WARRIOR_SOURCE_STATUS } : {}),
    actions: s.progression.sequence === 2 ? [] : actions,
    bottles: known ? s.warrior.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 战士成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? WARRIOR_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?(s.gladiator.warriorActingAtPromotion??100):s.progression.acting) : 0,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : (s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))||s.progression.acting >= 100) ? '战士魔药已消化；三个本作G训练分类仍按实际施力、持械训练与克制实践分别记录。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先观察真实障碍、负重与旁人，再选择有限力量或团队协作；完成作业后如实报告，借到的练习棍须实际归还。'
          : `已留下战士扮演经历（${s.progression.acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${WARRIOR_CONSUMPTION_RISK}`
      : '拜访训练场导师，了解战士成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [],
    tool: null,
    environment: '',
  };
}

/** Acquisition validates provenance and shapes; life owns causal activity transitions. */
export function validateWarriorState(s: SliceState): boolean {
  const raw: unknown = s.warrior;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected', 'practiceClub'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== WARRIOR_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, WARRIOR_CASE_IDS)) return false;
  for (const caseState of Object.values(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'WORKED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0)) return false;
    if (caseState.method !== null && !['POWER', 'TEAM'].includes(caseState.method as string)) return false;
    if (!['NONE', 'GATE_SECURED', 'CONTROLLED_STRIKE', 'TROLLEY_DELIVERED'].includes(caseState.outcome as string)) return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const club = raw.practiceClub;
  if (!record(club) || !shape(club, ['id', 'owner', 'custodian', 'location', 'version'])
    || club.id !== WARRIOR_PRACTICE_CLUB.id || club.owner !== WARRIOR_PRACTICE_CLUB.owner
    || !['MENTOR', 'PLAYER'].includes(club.custodian as string)
    || !['training-rack', 'player:hand'].includes(club.location as string) || !integer(club.version, 1)) return false;
  if (club.custodian === 'MENTOR' && club.location !== 'training-rack' || club.custodian === 'PLAYER' && club.location !== 'player:hand') return false;
  const warrior = raw as unknown as WarriorState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'warrior' && !isPromoted) return false;
  if (isPromoted) {
    if (!warrior.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery,[...WARRIOR_ABILITY_IDS,...((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?GLADIATOR_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?WEAPONMASTER_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?DAWN_PALADIN_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?GUARDIAN_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?DEMON_HUNTER_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?SILVER_KNIGHT_ABILITY_IDS:[]),...(s.progression.sequence===2?GLORY_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (WARRIOR_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || warrior.reflected
    || club.custodian !== 'MENTOR' || club.location !== 'training-rack' || club.version !== 1
    || Object.values(warrior.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.outcome !== 'NONE')) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of warrior.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `warrior-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < WARRIOR_BOTTLE_IDS.length) {
      if (bottle.source !== WARRIOR_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!warrior.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / WARRIOR_BOTTLE_IDS.length) - 1;
      if (index % WARRIOR_BOTTLE_IDS.length === 0) {
        const previous = warrior.bottles.slice(index - WARRIOR_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!warrior.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (warrior.resupply.requestedWeek !== null && (!warrior.guidanceKnown || !supplyExhausted(warrior) || warrior.bottles.some(bottle => bottle.consumedWeek! > warrior.resupply.requestedWeek!) || s.progression.promotionWeek !== null && warrior.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { WARRIOR_ABILITIES } from './content.js';
export { WARRIOR_CASE_IDS } from './types.js';
export type { WarriorActivityCommand, WarriorAction, WarriorProjection } from './types.js';
