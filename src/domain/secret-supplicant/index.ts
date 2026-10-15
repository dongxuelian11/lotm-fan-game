import { ELDER_ABILITY_IDS } from '../elder/types.js';
import {THREE_HEADED_TEMPLAR_ABILITY_IDS} from '../three-headed-templar/types.js';
import {BLACK_KNIGHT_ABILITY_IDS} from '../black-knight/types.js';
import {SHEPHERD_ABILITY_IDS} from '../shepherd/types.js';
import {ROSE_BISHOP_ABILITY_IDS} from '../rose-bishop/types.js';
import {SHADOW_ASCETIC_ABILITY_IDS} from '../shadow-ascetic/types.js';
import {LISTENER_ABILITY_IDS} from '../listener/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  SECRET_SUPPLICANT_ABILITIES, SECRET_SUPPLICANT_BOTTLE_IDS, SECRET_SUPPLICANT_CONSUMPTION_RISK, SECRET_SUPPLICANT_FORMULA_STATUS,
  SECRET_SUPPLICANT_GUIDE, SECRET_SUPPLICANT_POTION_SOURCES, SECRET_SUPPLICANT_PRICES, SECRET_SUPPLICANT_SOURCE_STATUS,
} from './content.js';
import {
  SECRET_SUPPLICANT_ABILITY_IDS, SECRET_SUPPLICANT_CASE_IDS, type SecretSupplicantAcquisitionCommand, type SecretSupplicantAction,
  type SecretSupplicantBottle, type SecretSupplicantCommand, type SecretSupplicantProjection, type SecretSupplicantState,
} from './types.js';

export function createSecretSupplicantState(): SecretSupplicantState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: SECRET_SUPPLICANT_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(SECRET_SUPPLICANT_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contactOpen: false, overclaims: 0,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))));
const potionPrice = (bottle: SecretSupplicantBottle) => SECRET_SUPPLICANT_PRICES.potion - (bottle.labourSteps === 2 ? SECRET_SUPPLICANT_PRICES.labourCredit : 0);
const bottleNumber = (bottle: SecretSupplicantBottle) => Number(bottle.id.slice('secret-supplicant-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (secretSupplicant: SecretSupplicantState) => secretSupplicant.bottles.length > 0 && secretSupplicant.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${SECRET_SUPPLICANT_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的秘祈人成品魔药，原瓶secret-supplicant-potion-${number}。旧物间供给为本作原创，完整配方尚未核实，未声称在旧物间配制；取得此瓶不建立任何组织身份。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isSecretSupplicantAcquisitionCommand(command: SecretSupplicantCommand): command is SecretSupplicantAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Exact intents only; reports carry a bounded claim and covering is a real action. */
export function validateSecretSupplicantCommand(value: unknown): value is SecretSupplicantCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^secret-supplicant-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^secret-supplicant-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'COVER', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && SECRET_SUPPLICANT_CASE_IDS.includes(value.caseId as typeof SECRET_SUPPLICANT_CASE_IDS[number]);
  if (value.type === 'PREPARE') return shape(value, ['type', 'caseId', 'method']) && SECRET_SUPPLICANT_CASE_IDS.includes(value.caseId as typeof SECRET_SUPPLICANT_CASE_IDS[number]) && ['MYSTIC', 'ORDINARY'].includes(value.method as string);
  if (value.type === 'REPORT') return shape(value, ['type', 'caseId', 'claim']) && SECRET_SUPPLICANT_CASE_IDS.includes(value.caseId as typeof SECRET_SUPPLICANT_CASE_IDS[number]) && ['LIMITED', 'CERTAIN'].includes(value.claim as string);
  return false;
}

function commandBlock(s: SliceState, command: SecretSupplicantAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (Object.values(s.secretSupplicant.cases).some(caseState => caseState.contactOpen)) return '先实际盖回原罩，结束仍在进行的本次接触。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到旧物管理员。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服秘祈人魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.secretSupplicant.discovered ? '已经认识这位旧物管理员。' : null;
  if (!s.secretSupplicant.discovered) return '先拜访旧物管理员。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.secretSupplicant.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < SECRET_SUPPLICANT_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.secretSupplicant.guidanceKnown) return '先听管理员说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.secretSupplicant.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.secretSupplicant) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.secretSupplicant.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.secretSupplicant.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.secretSupplicant) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.secretSupplicant.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选秘祈人原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次旧物间劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy; life owns observed evidence and actual cover/withdrawal actions. */
export function applySecretSupplicantCommand(s: SliceState, command: SecretSupplicantAcquisitionCommand, c: SeerContext): void {
  rule(validateSecretSupplicantCommand(command) && isSecretSupplicantAcquisitionCommand(command), '秘祈人准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.secretSupplicant.discovered = true;
      c.note('认识旧物管理员', `你在贝克兰德拜访了${SECRET_SUPPLICANT_GUIDE}，消耗1行动。这位成年管理员保管三瓶独立封存的秘祈人成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。管理员与成品药渠道为本作原创G，不代表已知配方或可以在旧物间制造魔药。${SECRET_SUPPLICANT_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= SECRET_SUPPLICANT_PRICES.guidance;
      s.secretSupplicant.guidanceKnown = true;
      c.note('听取秘祈人用药说明', `花费1行动、120便士，听管理员说明三瓶现有魔药的交付方式和指导服药的四档风险。${SECRET_SUPPLICANT_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。有限神秘感知、少量祭祀知识与有限仪式实践分别记录掌握度。先核对旧账、空碗与带罩旧物，再选择有限实践或普通核查；只报告实际观察到的有限结果。原罩取下后必须实际盖回，失败后也要结束接触，盖罩不消除已有后果，也不能保证免受神秘影响。普通学习与现实心理症状不等于神秘污染，不能把西里斯失控时的肉瘤与黑血用作稳定技能。${SECRET_SUPPLICANT_SOURCE_STATUS}`);
      return;
    case 'POTION_WORK': {
      const bottle = s.secretSupplicant.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成普通旧物编号核对' : '完成货架与空箱整理', bottle.labourSteps === 1
        ? `你在管理员监督下核对普通旧物的编号与现有清单，记录缺项，不接触异常旧物，完成一次实际旧物间劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由管理员保管。第二次整理劳务完成后可抵该瓶600便士。普通劳务不赋予非凡能力，也不产生异常知识污染。`
        : `你在伊森指导下整理货架与普通空箱，清出既有过道，归还清单和借用工具，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.secretSupplicant.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('秘祈人原瓶交付', `管理员将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次旧物间劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${SECRET_SUPPLICANT_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.secretSupplicant.resupply.requestedWeek = s.week;
      c.note('申请下一批秘祈人魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${SECRET_SUPPLICANT_GUIDE}提出下一批三瓶的补给请求，并清点旧物间收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由管理员持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.secretSupplicant.resupply.deliveries += 1;
      const firstNumber = s.secretSupplicant.resupply.deliveries * SECRET_SUPPLICANT_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < SECRET_SUPPLICANT_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.secretSupplicant.bottles.push({ id: `secret-supplicant-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.secretSupplicant.resupply.requestedWeek = null;
      c.note('下一批秘祈人原瓶到货', `第${s.week}周，本作G供给第${s.secretSupplicant.resupply.deliveries + 1}批三瓶实际送到旧物间，原瓶secret-supplicant-potion-${firstNumber}至secret-supplicant-potion-${firstNumber + 2}由管理员保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.secretSupplicant.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'hanged-man';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(SECRET_SUPPLICANT_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 0], ['perception', 1], ['will', 2], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为秘祈人', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质不增加、感知+1、意志+2、知识+1。有限神秘感知、少量祭祀知识与有限仪式实践从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。可以和平核对旧账、记录空碗没有回应的事实，辨认带罩旧物的有限迹象，再实际盖回原罩并如实报告；普通方法同样保留。不能把迹象说成完整答案，不能保证外部力量回应，不获得倾听耳语、血肉操控或灵魂放牧，也不自动加入任何组织。${SECRET_SUPPLICANT_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '管理员中断了秘祈人晋升' : '秘祈人魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。管理员处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** Life adds actual observed scenes, overclaims and the readable contact state. */
export function projectSecretSupplicant(s: SliceState): SecretSupplicantProjection {
  const actions: SecretSupplicantAction[] = [], isPromoted = promoted(s), known = s.secretSupplicant.discovered;
  const acting = isPromoted ? (s.progression.sequence===9?s.progression.acting:s.listener.secretSupplicantActingAtPromotion??0) : 0;
  const add = (id: string, label: string, cost: string, command: SecretSupplicantAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-secret-supplicant', `拜访${SECRET_SUPPLICANT_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.secretSupplicant.guidanceKnown) add('learn-secret-supplicant-guidance', '请管理员说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.secretSupplicant.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '普通旧物编号核对' : '货架与空箱整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶秘祈人魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.secretSupplicant.resupply.requestedWeek !== null) add('receive-secret-supplicant-supply', '确认下一批三瓶到货', `0行动 · 第${s.secretSupplicant.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.secretSupplicant)) add('request-secret-supplicant-supply', '向管理员订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.secretSupplicant.guidanceKnown) {
    for (const bottle of s.secretSupplicant.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶秘祈人魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.secretSupplicant.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.secretSupplicant.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '秘祈人 · 序列9' : '秘祈人之路', discovered: known, guidanceKnown: s.secretSupplicant.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${SECRET_SUPPLICANT_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.secretSupplicant.resupply.requestedWeek === null ? `已实际接收后续供给${s.secretSupplicant.resupply.deliveries}批。` : `第${s.secretSupplicant.resupply.requestedWeek}周提出补给请求，第${s.secretSupplicant.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: SECRET_SUPPLICANT_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.secretSupplicant.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 秘祈人成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `管理员保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SECRET_SUPPLICANT_ABILITIES.map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在管理员面前服药。`
      : acting >= 100 ? '秘祈人魔药已消化；有限神秘感知、少量祭祀知识与有限仪式实践仍按各自实际练习分别记录掌握度。'
        : acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先观察旧账、空碗与带罩旧物，再选择有限实践或普通方法；实际核查后如实报告，取下原罩后须先实际盖回。三段有限报告与最后反思可和平消化100，不要求伤害他人。'
          : `已留下秘祈人扮演经历（${acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${SECRET_SUPPLICANT_CONSUMPTION_RISK}`
      : '拜访旧物管理员，了解秘祈人成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [], insideCase: false, environment: '',
  };
}

/** Acquisition verifies shapes and provenance; life validates causal practice transitions. */
export function validateSecretSupplicantState(s: SliceState): boolean {
  const raw: unknown = s.secretSupplicant;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== SECRET_SUPPLICANT_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, SECRET_SUPPLICANT_CASE_IDS)) return false;
  for (const [caseId, caseState] of Object.entries(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'overclaims'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0) || !integer(caseState.overclaims, 0)) return false;
    if (caseState.method !== null && !['MYSTIC', 'ORDINARY'].includes(caseState.method as string)) return false;
    if (!['NONE', 'LEDGER_CHECKED', 'NO_REPLY', 'PRESENCE_NOTED'].includes(caseState.outcome as string)) return false;
    if (typeof caseState.contactOpen !== 'boolean' || caseState.contactOpen && caseId !== 'covered-token') return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const secretSupplicant = raw as unknown as SecretSupplicantState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'hanged-man' && !isPromoted) return false;
  if (isPromoted) {
    if (!secretSupplicant.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...SECRET_SUPPLICANT_ABILITY_IDS,...((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?LISTENER_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))))?SHADOW_ASCETIC_ABILITY_IDS:[]),...((s.progression.sequence===6||(s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?ROSE_BISHOP_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?SHEPHERD_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?BLACK_KNIGHT_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?THREE_HEADED_TEMPLAR_ABILITY_IDS:[]),...(s.progression.sequence===2?ELDER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (SECRET_SUPPLICANT_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || secretSupplicant.reflected
    || Object.values(secretSupplicant.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.method !== null || caseState.outcome !== 'NONE' || caseState.contactOpen || caseState.overclaims !== 0)) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of secretSupplicant.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `secret-supplicant-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < SECRET_SUPPLICANT_BOTTLE_IDS.length) {
      if (bottle.source !== SECRET_SUPPLICANT_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!secretSupplicant.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / SECRET_SUPPLICANT_BOTTLE_IDS.length) - 1;
      if (index % SECRET_SUPPLICANT_BOTTLE_IDS.length === 0) {
        const previous = secretSupplicant.bottles.slice(index - SECRET_SUPPLICANT_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!secretSupplicant.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (secretSupplicant.resupply.requestedWeek !== null && (!secretSupplicant.guidanceKnown || !supplyExhausted(secretSupplicant) || secretSupplicant.bottles.some(bottle => bottle.consumedWeek! > secretSupplicant.resupply.requestedWeek!) || s.progression.promotionWeek !== null && secretSupplicant.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { SECRET_SUPPLICANT_ABILITIES } from './content.js';
export { SECRET_SUPPLICANT_CASE_IDS } from './types.js';
export type { SecretSupplicantActivityCommand, SecretSupplicantAction, SecretSupplicantProjection } from './types.js';
