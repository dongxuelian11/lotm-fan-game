import { LIGHT_SEEKER_ABILITY_IDS } from '../light-seeker/types.js';
import {JUSTICE_MENTOR_ABILITY_IDS} from '../justice-mentor/types.js';
import {UNSHADOWED_ABILITY_IDS} from '../unshadowed/types.js';
import {PRIEST_OF_LIGHT_ABILITY_IDS} from '../priest-of-light/types.js';
import {NOTARY_ABILITY_IDS} from '../notary/types.js';
import {SUNPRIEST_ABILITY_IDS} from '../sunpriest/types.js';
import {LIGHTPRAYER_ABILITY_IDS} from '../lightprayer/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import {
  BARD_ABILITIES, BARD_BOTTLE_IDS, BARD_CONSUMPTION_RISK, BARD_FORMULA_STATUS,
  BARD_GUIDE, BARD_POTION_SOURCES, BARD_PRICES, BARD_SOURCE_STATUS,
} from './content.js';
import {
  BARD_ABILITY_IDS, BARD_CASE_IDS, type BardAcquisitionCommand, type BardAction,
  type BardBottle, type BardCommand, type BardProjection, type BardState,
} from './types.js';

export function createBardState(): BardState {
  return {
    discovered: false, guidanceKnown: false,
    bottles: BARD_POTION_SOURCES.map(({ id, source }) => ({
      id, source, labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null,
    })),
    resupply: { requestedWeek: null, deliveries: 0 },
    cases: Object.fromEntries(BARD_CASE_IDS.map(id => [id, {
      status: 'AVAILABLE', attemptWeek: null, mode: null, consent: false, withdrawals: 0,
    }])),
    reflected: false,
  };
}

function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'sun' && (s.progression.sequence === 9||s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))));
const potionPrice = (bottle: BardBottle) => BARD_PRICES.potion - (bottle.labourSteps === 2 ? BARD_PRICES.labourCredit : 0);
const bottleNumber = (bottle: BardBottle) => Number(bottle.id.slice('bard-potion-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const supplyExhausted = (bard: BardState) => bard.bottles.length > 0 && bard.bottles.every(bottle => bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const deliverySource = (number: number, week: number) => `${BARD_GUIDE}的本作G供给第${Math.ceil(number / 3)}批，第${week}周实收入库；独立封存的歌颂者成品魔药，原瓶bard-potion-${number}。公共音乐室供给为本作原创，已核材料片段不足以构成完整制造配方，未声称在公共音乐室配制。`;
const acquisitionCommands = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'];
export function isBardAcquisitionCommand(command: BardCommand): command is BardAcquisitionCommand {
  return acquisitionCommands.includes(command.type);
}

/** Only exact, typed intents cross the boundary; acquisition cannot substitute an unknown command. */
export function validateBardCommand(value: unknown): value is BardCommand {
  if (!record(value)) return false;
  if (['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT'].includes(value.type as string)) return shape(value, ['type']);
  if (['POTION_WORK', 'BUY_POTION'].includes(value.type as string)) return shape(value, ['type', 'bottleId']) && typeof value.bottleId === 'string' && /^bard-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (value.type === 'CONSUME') return shape(value, ['type', 'bottleId', 'confirmed']) && value.confirmed === true && typeof value.bottleId === 'string' && /^bard-potion-[1-9]\d{0,14}$/.test(value.bottleId);
  if (['OBSERVE', 'PERFORM', 'WITHDRAW'].includes(value.type as string)) return shape(value, ['type', 'caseId']) && BARD_CASE_IDS.includes(value.caseId as typeof BARD_CASE_IDS[number]);
  if (value.type === 'AGREE') return shape(value, ['type', 'caseId', 'mode']) && BARD_CASE_IDS.includes(value.caseId as typeof BARD_CASE_IDS[number]) && ['SONG', 'TALK'].includes(value.mode as string);
  return false;
}

function commandBlock(s: SliceState, command: BardAcquisitionCommand): string | null {
  const actions = ['DISCOVER', 'LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY'].includes(command.type) ? 1 : 0;
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德，找到公共音乐室导师。';
  if (s.progression.pathwayId !== null || s.progression.sequence !== null) return '你已选择一条非凡途径，不能改服歌颂者魔药；未服的原瓶仍为你保留。';
  if (command.type === 'DISCOVER') return s.bard.discovered ? '已经认识这位公共音乐室导师。' : null;
  if (!s.bard.discovered) return '先拜访公共音乐室导师。';
  if (command.type === 'LEARN_GUIDANCE') {
    if (s.bard.guidanceKnown) return '已经听过这批成品魔药的用药说明。';
    return s.cash < BARD_PRICES.guidance ? '用药指导需要120便士。' : null;
  }
  if (!s.bard.guidanceKnown) return '先听导师说明原瓶来源与服药风险。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.bard.resupply.requestedWeek !== null) return '已有一笔补给请求，先等下一周实际到货。';
    return !supplyExhausted(s.bard) ? '须先用完现有全部原瓶且仍未晋升，才能申请下一批。' : null;
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    if (s.bard.resupply.requestedWeek === null) return '尚未申请下一批补给。';
    if (s.week <= s.bard.resupply.requestedWeek) return '本周才提出补给请求，下一真实周起才能收货。';
    return !supplyExhausted(s.bard) ? '现有原瓶尚未全部耗尽失败，不能重复补货。' : null;
  }
  const bottle = s.bard.bottles.find(candidate => candidate.id === command.bottleId);
  if (!bottle) return '所选歌颂者原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经用完。';
    return s.week < 5 ? `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。` : null;
  }
  if (bottle.status !== 'SUPPLIER') return '这瓶魔药已经交付，不能重复购买或追溯抵扣费用。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= 2 ? '这瓶对应的两次公共音乐室劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取这瓶魔药需要${potionPrice(bottle)}便士。` : null;
}

/** Mutates the caller's working copy. Voluntary music-room activities are dispatched separately. */
export function applyBardCommand(s: SliceState, command: BardAcquisitionCommand, c: SeerContext): void {
  rule(validateBardCommand(command) && isBardAcquisitionCommand(command), '歌颂者准备命令无效。');
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.bard.discovered = true;
      c.note('认识独立公共音乐室导师', `你在贝克兰德拜访了${BARD_GUIDE}，消耗1行动。这间向自愿来访者开放的公共音乐室由成年独立导师照看，保管三瓶独立封存的歌颂者成品魔药，愿意说明来源与用药风险，也接受实际劳务抵扣部分药价。这次接触没有赋予非凡能力，也没有建立任何教会或组织身份。导师与成品药渠道为本作原创G，不代表已知配方或可以在公共音乐室制造魔药。${BARD_SOURCE_STATUS}`);
      return;
    case 'LEARN_GUIDANCE':
      s.actionsRemaining -= 1;
      s.cash -= BARD_PRICES.guidance;
      s.bard.guidanceKnown = true;
      c.note('听取歌颂者用药说明', `花费1行动、120便士，听导师说明三瓶现有魔药的交付方式和指导服药的四档风险。${BARD_FORMULA_STATUS}普通生活需满4整周；普通人可以先了解多条渠道，成功晋升只能选择其中一条。${BARD_SOURCE_STATUS}歌声赞颂与勇气协调分别记录；实践必须实际发声、确认听众能听见并取得本次同意。普通谈话也可协助；歌声不能强制服从，也不提供神圣光束、圣水、复活或高序列净化。接触导师与服药都不建立教会或其它组织身份。`);
      return;
    case 'POTION_WORK': {
      const bottle = s.bard.bottles.find(candidate => candidate.id === command.bottleId)!;
      s.actionsRemaining -= 1;
      bottle.labourSteps += 1;
      c.note(bottle.labourSteps === 1 ? '完成公共乐谱清点' : '完成音乐室座椅整理', bottle.labourSteps === 1
        ? `你照音乐室借阅清单核对现存乐谱的编号、缺页与归属，完成一次实际公共音乐室劳务，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度1/2；原瓶仍由公共音乐室保管。完成第二次座椅整理后可抵该瓶600便士。清点不赋予非凡歌声、勇气或协调能力。`
        : `你在米瑞尔指导下擦拭音乐室既有座椅、排好普通过道并归还所借抹布，消耗1行动。第${bottleNumber(bottle)}瓶劳动进度2/2，只抵这瓶600便士药价；仍须支付60便士才会交付原瓶，不折现，不赠送材料或工具。`);
      return;
    }
    case 'BUY_POTION': {
      const bottle = s.bard.bottles.find(candidate => candidate.id === command.bottleId)!;
      const paid = potionPrice(bottle);
      s.cash -= paid;
      bottle.status = 'PLAYER';
      bottle.acquiredWeek = s.week;
      c.note('歌颂者原瓶交付', `导师将第${bottleNumber(bottle)}瓶现成魔药${bottle.id}交到你手中，支付${paid}便士，0行动。${bottle.labourSteps === 2 ? '对应的两次公共音乐室劳务抵扣600便士。' : '未完成的劳务不折现或部分抵扣。'}原瓶尚未服用；每批三瓶，不自动补货。全部耗尽仍未晋升时，可以另花1行动申请下一批，等下一周后收货。${BARD_FORMULA_STATUS}`);
      return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.bard.resupply.requestedWeek = s.week;
      c.note('申请下一批歌颂者魔药', `现有原瓶全部耗尽且未晋升。你花费1行动，向${BARD_GUIDE}提出下一批三瓶的补给请求，并清点公共音乐室收货处。本周没有新增原瓶；第${s.week + 1}周起可确认收货。新瓶仍由导师持有，须另付660便士，或各自完成两次劳务再付60便士才能领取。该成品药供给为本作原创G。`);
      return;
    case 'RECEIVE_SUPPLY': {
      s.bard.resupply.deliveries += 1;
      const firstNumber = s.bard.resupply.deliveries * BARD_BOTTLE_IDS.length + 1;
      for (let offset = 0; offset < BARD_BOTTLE_IDS.length; offset += 1) {
        const number = firstNumber + offset;
        s.bard.bottles.push({ id: `bard-potion-${number}`, source: deliverySource(number, s.week), labourSteps: 0, acquiredWeek: null, consumedWeek: null, status: 'SUPPLIER', outcome: null });
      }
      s.bard.resupply.requestedWeek = null;
      c.note('下一批歌颂者原瓶到货', `第${s.week}周，本作G供给第${s.bard.resupply.deliveries + 1}批三瓶实际送到公共音乐室，原瓶bard-potion-${firstNumber}至bard-potion-${firstNumber + 2}由导师保管，0行动。旧瓶与排异记录全部保留。收货没有免费把魔药交给你；每瓶仍须付660便士，或完成对应两次劳务再付60便士。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.bard.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.consumedWeek = s.week;
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'sun';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(BARD_ABILITY_IDS.map(id => [id, 0]));
        s.progression.acting = 0;
        for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 3], ['knowledge', 1]] as const) {
          s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + increase);
        }
        c.note('成为歌颂者', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，体质+2、感知+1、意志+3、知识+1。两项歌颂者能力从0掌握开始，扮演从0开始；灵性上限提高到30，当前灵性没有补满。实际歌声可以有限鼓舞自己与同伴的勇气、力量及敏捷，仍需可听见的共同声场与自愿参与。不能强制服从、无声施法、发出神圣光束、制造圣水、复活或直接清除污染，也不自动加入教会。${BARD_SOURCE_STATUS}`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '导师中断了歌颂者晋升' : '歌颂者魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。导师处理了现场，未发生死亡；需要休养，重试须领取另一瓶现存魔药。`);
      }
      return;
    }
  }
}

/** The activity module adds finite meetings and observations actually made. */
export function projectBard(s: SliceState): BardProjection {
  const actions: BardAction[] = [], isPromoted = promoted(s), known = s.bard.discovered;
  const add = (id: string, label: string, cost: string, command: BardAcquisitionCommand) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!known) add('discover-bard', `拜访${BARD_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  else if (!s.bard.guidanceKnown) add('learn-bard-guidance', '请导师说明成品魔药与风险', '1行动 · 120便士 · 用药指导', { type: 'LEARN_GUIDANCE' });
  else if (s.progression.pathwayId === null) {
    for (const bottle of s.bard.bottles) if (bottle.status === 'SUPPLIER') {
      const number = bottleNumber(bottle);
      if (bottle.labourSteps < 2) add(`work-${bottle.id}`, `第${number}瓶 · ${bottle.labourSteps === 0 ? '公共乐谱清点' : '音乐室座椅整理'}`, `1行动 · 劳动${bottle.labourSteps}/2，完成两次抵该瓶600便士`, { type: 'POTION_WORK', bottleId: bottle.id });
      add(`buy-${bottle.id}`, `领取第${number}瓶歌颂者魔药`, `0行动 · ${potionPrice(bottle)}便士 · 交付现有原瓶`, { type: 'BUY_POTION', bottleId: bottle.id });
    }
    if (s.bard.resupply.requestedWeek !== null) add('receive-bard-supply', '确认下一批三瓶到货', `0行动 · 第${s.bard.resupply.requestedWeek + 1}周起 · 到货后仍须逐瓶购买`, { type: 'RECEIVE_SUPPLY' });
    else if (supplyExhausted(s.bard)) add('request-bard-supply', '向导师订下一批并准备收货', '1行动 · 下一周起到货 · 每瓶药价照常', { type: 'REQUEST_SUPPLY' });
  }
  if (s.bard.guidanceKnown) {
    for (const bottle of s.bard.bottles) if (bottle.status === 'PLAYER') {
      add(`consume-${bottle.id}`, `服用第${bottleNumber(bottle)}瓶歌颂者魔药`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.bard.bottles.filter(bottle => bottle.status === 'SUPPLIER').length;
  const held = s.bard.bottles.filter(bottle => bottle.status === 'PLAYER').length;
  return {
    title: isPromoted ? '歌颂者 · 序列9' : '歌颂者之路', discovered: known, guidanceKnown: s.bard.guidanceKnown,
    promoted: isPromoted, formulaKnown: false, formula: [],
    supplies: known ? `${BARD_FORMULA_STATUS}供应方剩余${remaining}瓶，你持有未服原瓶${held}瓶。${s.bard.resupply.requestedWeek === null ? `已实际接收后续供给${s.bard.resupply.deliveries}批。` : `第${s.bard.resupply.requestedWeek}周提出补给请求，第${s.bard.resupply.requestedWeek + 1}周起可以收货。`}` : '',
    ...(known ? { story: BARD_SOURCE_STATUS } : {}),
    actions,
    bottles: known ? s.bard.bottles.map(bottle => ({
      id: bottle.id, title: `第${bottleNumber(bottle)}瓶 · 歌颂者成品魔药`,
      source: `${bottle.source}${bottle.acquiredWeek === null ? '尚未交付。' : `第${bottle.acquiredWeek}周交付给你；原瓶${bottle.id}。`}`,
      status: bottle.status === 'SUPPLIER' ? `导师保管 · 劳动${bottle.labourSteps}/2`
        : bottle.status === 'PLAYER' ? '已交付，尚未服用'
          : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? BARD_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: isPromoted ? ((s.progression.sequence===8||s.progression.sequence===7||s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?(s.lightprayer.bardActingAtPromotion??100):s.progression.acting) : 0,
    digestion: !isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在导师面前服药。`
      : s.progression.sequence!==9 ? '歌颂者魔药已消化；晋升前100扮演与旧经历保留，能力掌握继续分别记录。' : s.progression.acting >= 100 ? '歌颂者魔药已消化；能力掌握仍按实际歌声、共同声场与有限鼓舞分别记录。'
        : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。先倾听本人需求，再约定歌声或普通谈话；勇气不等于无视危险，更不等于替别人作决定。'
          : `已留下歌颂者扮演经历（${s.progression.acting}/100）；消化与能力掌握分别记录。`,
    pollution: s.seer.pollution,
    risk: known ? `步骤：用药指导 → 购买，或完成该瓶两次劳务再付款领取 → 第5周起独立确认服药。每批3瓶，不自动补货；全部耗尽仍未晋升时，可以另花1行动请求下一批，下一真实周起确认到货，药价照常。普通人可以了解多条渠道，但成功晋升只能选择一条；其它途径未服的原瓶保留，不能改服。${BARD_CONSUMPTION_RISK}`
      : '拜访公共音乐室导师，了解歌颂者成品魔药的来源和风险。普通人可以先认识不同渠道，成功晋升只能选择一条途径。',
    cases: [], environment: '',
  };
}

/** Finite-original conservation and provenance. The activity module validates consent and case transitions. */
export function validateBardState(s: SliceState): boolean {
  const raw: unknown = s.bard;
  if (!record(raw) || !shape(raw, ['discovered', 'guidanceKnown', 'bottles', 'resupply', 'cases', 'reflected'])) return false;
  if (typeof raw.discovered !== 'boolean' || typeof raw.guidanceKnown !== 'boolean' || raw.guidanceKnown && !raw.discovered || typeof raw.reflected !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5))) return false;
  if (raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  if (!Array.isArray(raw.bottles) || raw.bottles.length !== BARD_BOTTLE_IDS.length * ((raw.resupply.deliveries as number) + 1)) return false;
  if (!record(s.progression) || !record(s.progression.mastery)) return false;
  if (!record(raw.cases) || !shape(raw.cases, BARD_CASE_IDS)) return false;
  for (const caseState of Object.values(raw.cases)) {
    if (!record(caseState) || !shape(caseState, ['status', 'attemptWeek', 'mode', 'consent', 'withdrawals'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'AGREED', 'RESOLVED'].includes(caseState.status as string) || !integer(caseState.withdrawals, 0)) return false;
    if (typeof caseState.consent !== 'boolean') return false;
    if (caseState.mode !== null && !['SONG', 'TALK'].includes(caseState.mode as string)) return false;
    if (caseState.attemptWeek !== null && !integer(caseState.attemptWeek, Math.max(5, s.progression.promotionWeek ?? 5), s.week)) return false;
  }
  const bard = raw as unknown as BardState, isPromoted = promoted(s);
  if (s.progression.pathwayId === 'sun' && !isPromoted) return false;
  if (isPromoted) {
    if (!bard.guidanceKnown || !integer(s.progression.promotionWeek, 5, s.week) || !shape(s.progression.mastery, [...BARD_ABILITY_IDS,...((s.progression.sequence===8||s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?LIGHTPRAYER_ABILITY_IDS:[]),...((s.progression.sequence===7||(s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))))?SUNPRIEST_ABILITY_IDS:[]),...((s.progression.sequence===6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?NOTARY_ABILITY_IDS:[]),...((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?PRIEST_OF_LIGHT_ABILITY_IDS:[]),...((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?UNSHADOWED_ABILITY_IDS:[]),...((s.progression.sequence===3||s.progression.sequence===2)?JUSTICE_MENTOR_ABILITY_IDS:[]),...(s.progression.sequence===2?LIGHT_SEEKER_ABILITY_IDS:[])]) || !Object.values(s.progression.mastery).every(value => integer(value, 0, 500))) return false;
  } else if (BARD_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id)) || bard.reflected
    || Object.values(bard.cases).some(caseState => caseState.status !== 'AVAILABLE' || caseState.attemptWeek !== null || caseState.withdrawals !== 0 || caseState.mode !== null || caseState.consent)) return false;
  let successes = 0;
  const deliveryWeeks: number[] = [];
  for (const [index, bottle] of bard.bottles.entries()) {
    if (!record(bottle) || !shape(bottle, ['id', 'source', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'status', 'outcome'])) return false;
    if (bottle.id !== `bard-potion-${index + 1}` || typeof bottle.source !== 'string' || !integer(bottle.labourSteps, 0, 2)) return false;
    let stockWeek = 1;
    if (index < BARD_BOTTLE_IDS.length) {
      if (bottle.source !== BARD_POTION_SOURCES[index]!.source) return false;
    } else {
      const sourceWeek = bottle.source.match(/，第(\d+)周实收入库；/);
      stockWeek = sourceWeek ? Number(sourceWeek[1]) : 0;
      if (!bard.guidanceKnown || !integer(stockWeek, 6, s.week) || bottle.source !== deliverySource(index + 1, stockWeek)) return false;
      const batchIndex = Math.floor(index / BARD_BOTTLE_IDS.length) - 1;
      if (index % BARD_BOTTLE_IDS.length === 0) {
        const previous = bard.bottles.slice(index - BARD_BOTTLE_IDS.length, index);
        if (previous.some(original => original.status !== 'CONSUMED' || !['FAILURE', 'GREAT_FAILURE'].includes(original.outcome as string) || !integer(original.consumedWeek, 5, stockWeek - 1))) return false;
        deliveryWeeks.push(stockWeek);
      } else if (deliveryWeeks[batchIndex] !== stockWeek) return false;
    }
    if (!bard.guidanceKnown && (bottle.labourSteps !== 0 || bottle.status !== 'SUPPLIER')) return false;
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
  if (bard.resupply.requestedWeek !== null && (!bard.guidanceKnown || !supplyExhausted(bard) || bard.bottles.some(bottle => bottle.consumedWeek! > bard.resupply.requestedWeek!) || s.progression.promotionWeek !== null && bard.resupply.requestedWeek > s.progression.promotionWeek)) return false;
  return successes === (isPromoted ? 1 : 0);
}

export { BARD_ABILITIES } from './content.js';
export { BARD_CASE_IDS } from './types.js';
export type { BardActivityCommand, BardAction, BardProjection } from './types.js';
