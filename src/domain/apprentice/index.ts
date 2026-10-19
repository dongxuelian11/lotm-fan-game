import {PLANESWALKER_ABILITY_IDS} from '../planeswalker/types.js';
import {WANDERER_ABILITY_IDS} from '../wanderer/types.js';
import {SECRETS_SORCERER_ABILITY_IDS} from '../secrets-sorcerer/types.js';
import {TRAVELER_ABILITY_IDS} from '../traveler/types.js';
import {RECORDER_ABILITY_IDS} from '../recorder/types.js';
import {ASTROLOGER_ABILITY_IDS} from '../astrologer/types.js';
import {TRICKMASTER_ABILITY_IDS} from '../trickmaster/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  APPRENTICE_ABILITIES, APPRENTICE_BOTTLE_IDS, APPRENTICE_CONSUMPTION_RISK, APPRENTICE_FORMULA_STATUS,
  APPRENTICE_GUIDE, APPRENTICE_POTION_SOURCES, APPRENTICE_PRICES, APPRENTICE_SOURCE_STATUS,
} from './content.js';
import {
  APPRENTICE_ABILITY_IDS, APPRENTICE_CASE_IDS, type ApprenticeAcquisitionCommand, type ApprenticeAction,
  type ApprenticeBottle, type ApprenticeCommand, type ApprenticeProjection, type ApprenticeState,
} from './types.js';

export function createApprenticeState(): ApprenticeState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: APPRENTICE_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(APPRENTICE_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, mistakes: 0, conclusion: null, position: 'OUTSIDE', ordinaryOpen: false,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'door' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const potionPrice = (bottle: ApprenticeBottle) => APPRENTICE_PRICES.potion - (bottle.labourSteps === 2 ? APPRENTICE_PRICES.labourCredit : 0);
const bottleNumber = (bottle: ApprenticeBottle) => Number(bottle.id.slice('apprentice-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (apprentice: ApprenticeState) => apprentice.bottles.length > 0 && apprentice.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${APPRENTICE_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的学徒成品魔药，原瓶apprentice-potion-${number}。档案工作间供给为本作原创，完整配方尚未核实，未声称在档案工作间配制；取得此瓶不建立任何家族或组织身份。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isApprenticeAcquisitionCommand(command: ApprenticeCommand): command is ApprenticeAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Only exact, typed intents cross the boundary; acquisition cannot substitute an unknown command. */
export function validateApprenticeCommand(value: unknown): value is ApprenticeCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^apprentice-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^apprentice-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'RETURN', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && APPRENTICE_CASE_IDS.includes(value.caseId as typeof APPRENTICE_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && APPRENTICE_CASE_IDS.includes(value.caseId as typeof APPRENTICE_CASE_IDS[number]) && ['DOOR', 'ORDINARY'].includes(value.method as string);
  if (value.type === 'REPORT') return shape(value, ['type', 'caseId', 'conclusion']) && APPRENTICE_CASE_IDS.includes(value.caseId as typeof APPRENTICE_CASE_IDS[number]) && ['LIMITED', 'CERTAIN'].includes(value.conclusion as string);
  return false;
}

function commandBlock(s: SliceState, command: ApprenticeAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到档案工作间导师。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服学徒魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.apprentice.discovered ? '已经认识这位档案工作间导师。' : null;
  if (!s.apprentice.discovered) return '先拜访档案工作间导师。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.apprentice.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < APPRENTICE_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.apprentice.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.apprentice.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.apprentice) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.apprentice.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.apprentice.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.apprentice) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.apprentice.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选学徒原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次档案工作间劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy. Finite local door passages are dispatched separately. */
export function applyApprenticeCommand(s: SliceState, command: ApprenticeAcquisitionCommand, c: SeerContext): void {
  rule(validateApprenticeCommand(command) && isApprenticeAcquisitionCommand(command), '学徒准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.apprentice.discovered = true;
      c.note('认识独立档案工作间导师', `你在贝克兰德拜访了${APPRENTICE_GUIDE}，消耗1行动。这位成年独立锁匠在工作间接待你，保管三瓶独立封存的学徒成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。导师与成品药渠道为本作原创G，不代表已知配方或可以在档案工作间制造魔药。${APPRENTICE_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= APPRENTICE_PRICES.guidance;
      s.apprentice.guidanceKnown = true;
      c.note('听取学徒用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的交付方式和指导服药的四档风险。${APPRENTICE_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。${APPRENTICE_SOURCE_STATUS}本阶段只有开门一项天赋能力；实践必须核对眼前原门、另一侧位置与普通退路，普通开锁或绕行也能完成有限协助。本人穿过不自动打开原锁，更不能带同伴一起穿过；远距离传送、记录法术与序列8戏法均未获得。接触导师与服药都不建立教会或其它组织身份。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.apprentice.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成原钥匙编号核对' : '完成档案通道整理', bottle.labourSteps === 1
        ? `你在锁匠监督下核对原钥匙编号与借还清单，记录缺号与交接次序，完成一次实际档案工作间劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由档案工作间保管。完成第二次通道整理后可抵该瓶600便士。核对不赋予开门能力，也不把原钥匙交给你保管。`
        : `你在诺拉指导下整理档案工作间外间的既有普通通道并归还所借清扫工具，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.apprentice.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('学徒原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次档案工作间劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${APPRENTICE_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.apprentice.resupply.requestedWeek = s.week;
      c.note('申请下一批学徒魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${APPRENTICE_GUIDE}提出下一批三瓶的补给请求，并清点档案工作间收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.apprentice.resupply.deliveries += 1;
      const firstNumber = s.apprentice.resupply.deliveries * APPRENTICE_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < APPRENTICE_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.apprentice.bottles.push({ id: `apprentice-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.apprentice.resupply.requestedWeek = null;
      c.note('下一批学徒原瓶到货', `第${s.week}周，本作G供给第${s.apprentice.resupply.deliveries + 1}批三瓶实际送到档案工作间，原瓶apprentice-potion-${firstNumber}至apprentice-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.apprentice.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'door';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(APPRENTICE_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 0], ['perception', 2], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为学徒', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质不变、感知+2、意志+2、知识+1。开门能力从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。你能以开门让本人通过眼前可适用的有限障碍，但不会自动打开原锁或移动同伴；应先核对原门、去处与普通退路。不获得远距离传送、记录法术或序列8戏法，也不自动加入任何组织。${APPRENTICE_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了学徒晋升' : '学徒魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** The activity module adds finite passages, actual positions and observed original routes. */
export function projectApprentice(s: SliceState): ApprenticeProjection {
  const actions: ApprenticeAction[] = [], isPromoted = promoted(s), known = s.apprentice.discovered;
  const add = (id: string, label: string, cost: string, command: ApprenticeAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-apprentice', `拜访${APPRENTICE_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.apprentice.guidanceKnown) add('learn-apprentice-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.apprentice.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '原钥匙编号核对' : '档案通道整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶学徒魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.apprentice.resupply.requestedWeek !== null) add('receive-apprentice-supply', '确认下一批三瓶到货', `0行动 · 第${s.apprentice.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.apprentice)) add('request-apprentice-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.apprentice.guidanceKnown) {
    for (const bottle of s.apprentice.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶学徒魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.apprentice.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.apprentice.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '学徒 · 序列9' : '学徒之路', discovered: known, guidanceKnown: s.apprentice.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${APPRENTICE_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.apprentice.resupply.requestedWeek === null ? `已实际接收后续供给${s.apprentice.resupply.deliveries}批。` : `第${s.apprentice.resupply.requestedWeek}周提出补给请求，第${s.apprentice.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: APPRENTICE_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.apprentice.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 学徒成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? APPRENTICE_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?(s.trickmaster.apprenticeActingAtPromotion??100):s.progression.acting) : 0,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : (s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))) ? '学徒魔药已消化（100/100）；原能力、三份报告和真实门状态保留。' : s.progression.acting >= 100 ? '学徒魔药已消化；能力掌握仍按实际开门与对原障碍、位置和退路的有限核实记录。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先核对原门、去处与退路，再选择本人开门或普通方法；完成实际返回后如实报告，未验证的通行能力与同伴位置仍须保留。'
          : `已留下学徒扮演经历（${s.progression.acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${APPRENTICE_CONSUMPTION_RISK}`
      : '拜访档案工作间导师，了解学徒成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [],
    insideCaseId: APPRENTICE_CASE_IDS.find(id => s.apprentice.cases[id]?.position === 'INSIDE') ?? null,
    environment: '',
  };
}

/** Finite-original conservation and provenance. The activity module validates evidence boundaries and case transitions. */
export function validateApprenticeState(s: SliceState): boolean {
  const raw: unknown = s.apprentice;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== APPRENTICE_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, APPRENTICE_CASE_IDS)) return false;
  for (const caseState of Object.values(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'mistakes', 'conclusion', 'position', 'ordinaryOpen'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0)) return false;
    if (!integer(caseState.mistakes, 0)) return false;
    if (!['OUTSIDE', 'INSIDE'].includes(caseState.position as string) || typeof caseState.ordinaryOpen !== 'boolean') return false;
    if (caseState.method !== null && !['DOOR', 'ORDINARY'].includes(caseState.method as string)) return false;
    if (caseState.conclusion !== null && !['LIMITED', 'CERTAIN'].includes(caseState.conclusion as string)) return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const apprentice = raw as unknown as ApprenticeState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'door' && !isPromoted) return false;
  if (isPromoted) {
    if (!apprentice.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery,[...APPRENTICE_ABILITY_IDS,...((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?TRICKMASTER_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?ASTROLOGER_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?RECORDER_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?TRAVELER_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?SECRETS_SORCERER_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?WANDERER_ABILITY_IDS:[]),...(s.progression.sequence===2?PLANESWALKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (APPRENTICE_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || apprentice.reflected
    || Object.values(apprentice.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.mistakes !== 0 || caseState.conclusion !== null || caseState.position !== 'OUTSIDE' || caseState.ordinaryOpen)) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of apprentice.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `apprentice-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < APPRENTICE_BOTTLE_IDS.length) {
      if (bottle.source !== APPRENTICE_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!apprentice.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / APPRENTICE_BOTTLE_IDS.length) - 1;
      if (index % APPRENTICE_BOTTLE_IDS.length === 0) {
        const previous = apprentice.bottles.slice(index - APPRENTICE_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!apprentice.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (apprentice.resupply.requestedWeek !== null && (!apprentice.guidanceKnown || !supplyExhausted(apprentice) || apprentice.bottles.some(bottle => bottle.consumedWeek! > apprentice.resupply.requestedWeek!) || s.progression.promotionWeek !== null && apprentice.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { APPRENTICE_ABILITIES } from './content.js';
export { APPRENTICE_CASE_IDS } from './types.js';
export type { ApprenticeActivityCommand, ApprenticeAction, ApprenticeProjection } from './types.js';
