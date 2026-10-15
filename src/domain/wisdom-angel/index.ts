import { ALL_KNOWING_EYE_ABILITY_IDS } from '../all-knowing-eye/types.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { READER_ABILITY_IDS } from '../reader/types.js';
import { REASONER_ABILITY_IDS } from '../reasoner/types.js';
import { DETECTIVE_ABILITY_IDS } from '../detective/types.js';
import { POLYMATH_ABILITY_IDS } from '../polymath/types.js';
import { MYSTICISM_MAGISTER_ABILITY_IDS } from '../mysticism-magister/types.js';
import { PROPHET_ABILITY_IDS } from '../prophet/types.js';
import { INSIGHT_SCHOLAR_ABILITY_IDS } from '../insight-scholar/types.js';
import { applyProphetInheritedFlash, blockProphetInheritedFlash } from '../mysticism-magister/life.js';
import { hasProphetRitualLock } from '../prophet/ritual.js';
import { hasProphetLifeLock } from '../prophet/life.js';
import { hasProphetEncounterLock } from '../prophet/encounter.js';
import { hasInsightScholarLifeLock } from '../insight-scholar/life.js';
import { hasInsightScholarEncounterLock } from '../insight-scholar/encounter.js';
import { createWisdomAngelLifeState, applyWisdomAngelActivity, projectWisdomAngelLife, wisdomAngelLifeActions, validateWisdomAngelLife, validateWisdomAngelActivityCommand, hasWisdomAngelLifeLock } from './life.js';
import { createWisdomAngelEncounterState, applyWisdomAngelEncounterCommand, projectWisdomAngelEncounter, wisdomAngelEncounterActions, validateWisdomAngelEncounter, validateWisdomAngelEncounterCommand, hasWisdomAngelEncounterLock } from './encounter.js';
import { WISDOM_ANGEL_ABILITIES, WISDOM_ANGEL_BOTTLE_IDS, WISDOM_ANGEL_CONSUMPTION_RISK, WISDOM_ANGEL_FORMULA_STATUS, WISDOM_ANGEL_GUIDE, WISDOM_ANGEL_LABOUR_STEPS, WISDOM_ANGEL_LABOUR_TASKS, WISDOM_ANGEL_MIN_INSIGHT_SCHOLAR_WEEKS, WISDOM_ANGEL_POTION_SOURCES, WISDOM_ANGEL_PREPARATIONS, WISDOM_ANGEL_PRICES, WISDOM_ANGEL_SOURCE_STATUS } from './content.js';
import { WISDOM_ANGEL_ABILITY_IDS, WISDOM_ANGEL_PREPARATION_IDS, type WisdomAngelAcquisitionCommand, type WisdomAngelAction, type WisdomAngelBottle, type WisdomAngelCommand, type WisdomAngelProjection, type WisdomAngelState } from './types.js';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (tier: string | null) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const failed = (tier: string | null) => tier === 'FAILURE' || tier === 'GREAT_FAILURE';
const INHERITED_ABILITY_IDS = [...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS, ...DETECTIVE_ABILITY_IDS, ...POLYMATH_ABILITY_IDS, ...MYSTICISM_MAGISTER_ABILITY_IDS, ...PROPHET_ABILITY_IDS, ...INSIGHT_SCHOLAR_ABILITY_IDS];
const freshBottle = (id: string, source: string, stockedWeek: number | null): WisdomAngelBottle => ({ id, source, stockedWeek, labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER', outcome: null });
export function createWisdomAngelState(): WisdomAngelState {
  return { guidanceKnown: false, bottles: WISDOM_ANGEL_POTION_SOURCES.map(({ id, source }) => freshBottle(id, source, null)),
    resupply: { requestedWeek: null, deliveries: 0 }, promotionWeek: null, insightScholarActingAtPromotion: null,
    preparations: [], preparedWeek: null, life: createWisdomAngelLifeState(), encounter: createWisdomAngelEncounterState() };
}
/** Historical membership never broadens the exact current-stage action guards. */
export const isWisdomAngel = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 2;
export const isWisdomAngelAcquisitionStage = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 3;
export const hasWisdomAngelHistory = (s: SliceState) => (isWisdomAngel(s)||(s.progression.pathwayId==='white-tower'&&s.progression.sequence===1)) && s.wisdomAngel.promotionWeek !== null;
const knownChannel = (s: SliceState) => s.progression.pathwayId === 'white-tower' && [3, 2, 1].includes(s.progression.sequence ?? 0) && s.reader.discovered && s.insightScholar.guidanceKnown && s.insightScholar.promotionWeek !== null;
export const hasWisdomAngelLock = (s: SliceState): boolean => s.progression.pathwayId==='white-tower' && [3,2].includes(s.progression.sequence??0) && (s.wisdomAngel.preparedWeek !== null || hasWisdomAngelLifeLock(s) || hasWisdomAngelEncounterLock(s));
const bottleNumber = (b: Pick<WisdomAngelBottle, 'id'>) => Number(b.id.slice('wisdom-angel-potion-'.length));
const potionPrice = (b: WisdomAngelBottle) => WISDOM_ANGEL_PRICES.potion - (b.labourSteps === WISDOM_ANGEL_LABOUR_STEPS ? WISDOM_ANGEL_PRICES.labourCredit : 0);
const insightScholarWeeks = (s: SliceState) => Math.max(0, (s.wisdomAngel.promotionWeek ?? s.week) - (s.insightScholar.promotionWeek ?? s.week));
const exhaustedSupply = (state: WisdomAngelState) => state.bottles.length >= 3 && state.bottles.every(b => b.status === 'CONSUMED' && failed(b.outcome));
const deliverySource = (number: number, week: number) => `${WISDOM_ANGEL_GUIDE}的独立智慧天使候选成品交接渠道本作G第${Math.ceil(number / 3)}批、第${week}周实际到货，独立封存序列2候选原瓶wisdom-angel-potion-${number}；非洞悉者候选或更早原瓶改装，候选名称、编号与能力尚未核实，配方和原著仪式仍未知，专业准备另行实际完成。`;
const hasPreparations = (s: SliceState) => WISDOM_ANGEL_PREPARATION_IDS.every(id => s.wisdomAngel.preparations.some(p => p.taskId === id));
/** Guard real open scenes, contacts and held originals without rewriting their archived history. */
function oldSceneOpen(s: SliceState): boolean {
  return s.insightScholar.preparedWeek !== null || hasInsightScholarLifeLock(s) || hasInsightScholarEncounterLock(s) ||
    Object.values(s.insightScholar.life.cases).some(v => v.contactOpen || v.status === 'PREPARED' || v.status === 'ACTIVE') ||
    hasProphetRitualLock(s) || hasProphetLifeLock(s) || hasProphetEncounterLock(s) ||
    Object.values(s.prophet.life.cases).some(v => v.contactOpen || v.effectActive || v.status === 'PREPARED') ||
    s.prophet.life.pages.location !== 'TABLE' ||
    Object.values(s.mysticismMagister.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
    s.mysticismMagister.practice.token !== 'OWNER' || s.mysticismMagister.practice.dreamOpen ||
    s.mysticismMagister.encounter.status === 'FIGHTING' ||
    Object.values(s.polymath.cases).some(v => v.contactOpen || v.status === 'PREPARED') ||
    s.polymath.encounter.status === 'FIGHTING';
}
function promotionBlock(s: SliceState): string | null {
  if (s.health <= 20 || s.mind <= 40) return '本次服药要求健康>20且精神>40；可以取消本次准备后正常休养，原瓶不会复原，旧伤须实际护理。';
  if (s.progression.acting !== 100) return `洞悉者候选魔药尚未完全消化，当前${s.progression.acting}/100。`;
  if (s.insightScholar.promotionWeek === null || insightScholarWeeks(s) < WISDOM_ANGEL_MIN_INSIGHT_SCHOLAR_WEEKS) return `成为洞悉者候选后已过${insightScholarWeeks(s)}/12整周，尚不能准备本次服药。`;
  return hasPreparations(s) ? null : '先分别实际完成原来源核验、当前条件说明、许可与有限能力边界核对；购买原瓶不能代做专业准备。';
}
export function validateWisdomAngelAcquisitionCommand(v: unknown): v is WisdomAngelAcquisitionCommand {
  if (!record(v) || typeof v.type !== 'string') return false;
  if (['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'PREPARE_PROMOTION', 'LEAVE_PREPARATION'].includes(v.type)) return shape(v, ['type']);
  if (v.type === 'PREPARE_TASK') return shape(v, ['type', 'taskId']) && WISDOM_ANGEL_PREPARATION_IDS.includes(v.taskId as typeof WISDOM_ANGEL_PREPARATION_IDS[number]);
  if (typeof v.bottleId !== 'string' || !/^wisdom-angel-potion-[1-9]\d{0,14}$/.test(v.bottleId)) return false;
  if (['POTION_WORK', 'BUY_POTION'].includes(v.type)) return shape(v, ['type', 'bottleId']);
  return v.type === 'CONSUME' && shape(v, ['type', 'bottleId', 'confirmed']) && v.confirmed === true;
}
export const isWisdomAngelAcquisitionCommand = validateWisdomAngelAcquisitionCommand;
export function validateWisdomAngelCommand(v: unknown): v is WisdomAngelCommand {
  return (record(v) && v.type === 'MAKE_INHERITED_FLASH' && shape(v, ['type'])) || validateWisdomAngelAcquisitionCommand(v) || validateWisdomAngelActivityCommand(v) || validateWisdomAngelEncounterCommand(v);
}
export function wisdomAngelAcquisitionBlock(s: SliceState, command: WisdomAngelAcquisitionCommand): string | null {
  if (!validateWisdomAngelAcquisitionCommand(command)) return '智慧天使候选准备命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体精神尚可；普通死亡不受指导服药保护。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (oldSceneOpen(s) || hasWisdomAngelLifeLock(s) || hasWisdomAngelEncounterLock(s)) return '先实际收束旧洞悉者、预言家与更早原场的接触、效果和准备，归还借持原件、原匣、包裹或原衣角；不能沿用旧同意或同时占用新场。';
  if (s.world.city !== 'BACKLUND') return '须沿实际行程回到贝克兰德塞缪尔原书房旁独立指导场。';
  if (!knownChannel(s)) return '实际成为洞悉者候选并保留原指导渠道后，才能了解智慧天使候选之路。';
  if (!isWisdomAngelAcquisitionStage(s)) return '已晋升智慧天使候选2，不能凭继承的洞悉者候选历史重复准备或服药；未服原瓶保留。';
  if (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return '须保留阅读者至洞悉者候选全部17项原掌握与合法原值，不能以补造或删除条目取得新晋升。';
  const state = s.wisdomAngel;
  if (command.type === 'LEAVE_PREPARATION') return state.preparedWeek === null ? '没有本次尚未使用的场地准备。' : null;
  if (state.preparedWeek !== null && command.type !== 'CONSUME') return '当前已经实际检查好服药场地；先独立确认饮药或0行动退出本次准备。';
  const ap = ['LEARN_GUIDANCE', 'POTION_WORK', 'REQUEST_SUPPLY', 'PREPARE_TASK', 'PREPARE_PROMOTION'].includes(command.type) ? 1 : 0;
  if (s.actionsRemaining < ap) return '本周剩余行动不足。';
  if (command.type === 'LEARN_GUIDANCE') return state.guidanceKnown ? '已经听取独立来源、未知配方与仪式边界以及本次四档风险。' : s.cash < WISDOM_ANGEL_PRICES.guidance ? '本次专业指导需要500便士。' : null;
  if (!state.guidanceKnown) return '先听原指导者说明独立成品来源、G专业准备与四档风险。';
  if (command.type === 'PREPARE_TASK') return state.preparations.some(p => p.taskId === command.taskId) ? '这一项专业准备已经真实完成，不能重复领取经历。' : null;
  if (command.type === 'PREPARE_PROMOTION') {
    const reason = promotionBlock(s); if (reason) return reason;
    if (!state.bottles.some(b => b.status === 'PLAYER')) return '先实际取得至少一瓶尚未服用的智慧天使候选原瓶。';
    return s.cash < WISDOM_ANGEL_PRICES.preparation ? '当次场地检查需要120便士。' : null;
  }
  if (command.type === 'REQUEST_SUPPLY') return state.resupply.requestedWeek !== null ? '已经申请下一批，必须等下一真实周实际到货。' : exhaustedSupply(state) ? null : '现有全部原瓶须真实服用且失败，才能申请下一批。';
  if (command.type === 'RECEIVE_SUPPLY') return state.resupply.requestedWeek === null ? '尚未申请下一批智慧天使候选原瓶。' : s.week <= state.resupply.requestedWeek ? '本周刚提出申请，下一真实周起才能确认到货。' : exhaustedSupply(state) ? null : '现有原瓶尚未全部耗尽失败。';
  if (!('bottleId' in command)) return '未知的智慧天使候选准备命令。';
  const bottle = state.bottles.find(b => b.id === command.bottleId);
  if (!bottle) return '所选智慧天使候选独立原瓶不存在。';
  if (command.type === 'CONSUME') {
    if (bottle.status !== 'PLAYER') return '所选原瓶尚未交付或已经耗尽。';
    const reason = promotionBlock(s); if (reason) return reason;
    return state.preparedWeek === s.week ? null : '须另付1行动与120便士完成本周当次场地检查；旧准备不能使用。';
  }
  if (bottle.status !== 'SUPPLIER') return '本瓶已经交付，不能重复购买或追溯抵扣劳务。';
  if (command.type === 'POTION_WORK') return bottle.labourSteps >= WISDOM_ANGEL_LABOUR_STEPS ? '本瓶五次实际劳务已经完成。' : null;
  return s.cash < potionPrice(bottle) ? `领取本瓶需要${potionPrice(bottle)}便士。` : null;
}

/** The application persists this working-copy mutation in its existing single transaction. */
export function applyWisdomAngelAcquisition(s: SliceState, command: WisdomAngelAcquisitionCommand, ctx: SeerContext): void {
  const reason = wisdomAngelAcquisitionBlock(s, command); if (reason) throw new Error(reason);
  const state = s.wisdomAngel;
  switch (command.type) {
    case 'LEARN_GUIDANCE':
      s.actionsRemaining--; s.cash -= WISDOM_ANGEL_PRICES.guidance; state.guidanceKnown = true;
      ctx.note('听取智慧天使候选独立成品与专业准备指导', `花1行动、500便士。${WISDOM_ANGEL_GUIDE}说明原渠道记录。${WISDOM_ANGEL_FORMULA_STATUS}${WISDOM_ANGEL_CONSUMPTION_RISK}`); return;
    case 'PREPARE_TASK': {
      const task = WISDOM_ANGEL_PREPARATIONS.find(p => p.id === command.taskId)!;
      s.actionsRemaining--; state.preparations.push({ taskId: task.id, completedWeek: s.week });
      ctx.note(task.title, `花1行动真实完成。${task.description}尚未检查本次服药场地，也未消耗原瓶；已有旧人物与原物不改写。`); return;
    }
    case 'PREPARE_PROMOTION':
      s.actionsRemaining--; s.cash -= WISDOM_ANGEL_PRICES.preparation; state.preparedWeek = s.week;
      ctx.note('实际检查本周服药场地', '花1行动、120便士，按已完成的三项专业准备检查本次原场，G支持安排就绪。尚未服药，须对所选原瓶独立确认。0行动退出也会清掉本次准备，不退款、不治疗；配方与原著仪式仍未知。'); return;
    case 'LEAVE_PREPARATION':
      state.preparedWeek = null;
      ctx.note('沿原出口结束本次服药准备', '0行动实际退出，未服原瓶保留，已用行动与120便士不返。三项真实专业经历保留；可以正常生活休养，下次须重新检查场地。'); return;
    case 'POTION_WORK': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!;
      s.actionsRemaining--; bottle.labourSteps++;
      ctx.note(WISDOM_ANGEL_LABOUR_TASKS[bottle.labourSteps - 1]!, `实际完成原瓶${bottle.id}第${bottle.labourSteps}/5项工作，花1行动。五次只抵本瓶5400便士，余款800便士；部分劳动不折现、不转给其他原瓶，也不替代三项专业准备。`); return;
    }
    case 'BUY_POTION': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, paid = potionPrice(bottle);
      s.cash -= paid; bottle.status = 'PLAYER'; bottle.acquiredWeek = s.week;
      ctx.note('智慧天使候选独立原瓶实际交付', `0行动、${paid}便士，实际领取${bottle.id}。${bottle.labourSteps === 5 ? '本瓶五项劳务抵5400便士。' : '未满五项劳动不部分抵扣。'}药瓶尚未服用，不附赠证据、未知内容、技能库、能力窗口、人物同意、准备或原著仪式。`); return;
    }
    case 'REQUEST_SUPPLY':
      s.actionsRemaining--; state.resupply.requestedWeek = s.week;
      ctx.note('实际申请下一批智慧天使候选成品', `原瓶全部失败耗尽，花1行动核对供货记录，最早第${s.week + 1}周接收新的三瓶。此刻没有新库存，原失败、成本与专业经历保留。`); return;
    case 'RECEIVE_SUPPLY': {
      const first = state.bottles.length + 1;
      for (let offset = 0; offset < WISDOM_ANGEL_BOTTLE_IDS.length; offset++) { const number = first + offset; state.bottles.push(freshBottle(`wisdom-angel-potion-${number}`, deliverySource(number, s.week), s.week)); }
      state.resupply.deliveries++; state.resupply.requestedWeek = null;
      ctx.note('新的三瓶智慧天使候选原瓶实际到货', `第${s.week}周，第${first}至${first + 2}瓶进入原供应方库存，0行动。尚未交付，仍须逐瓶6200便士或对应五项劳动后800便士；旧原瓶不会复原。`); return;
    }
    case 'CONSUME': {
      const bottle = state.bottles.find(b => b.id === command.bottleId)!, result = ctx.check('will', 30);
      bottle.status = 'CONSUMED'; bottle.outcome = result.tier; bottle.consumedWeek = s.week; bottle.preparationWeek = state.preparedWeek; state.preparedWeek = null;
      if (success(result.tier)) {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 8 : 15;
        s.mind -= mentalCost; state.insightScholarActingAtPromotion = s.progression.acting; state.promotionWeek = s.week;
        s.progression.sequence = 2; s.progression.acting = 0;
        for (const id of WISDOM_ANGEL_ABILITY_IDS) s.progression.mastery[id] = 0;
        for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = Math.min(500, s.character.coreStats[stat] + 1);
        ctx.note('实际成为智慧天使候选', `本周检查后独立确认饮用的${bottle.id}真实耗尽，意志${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。精神−${mentalCost}、四属性各+1；洞悉者候选消化100与全部旧17项掌握原值保留，两项新掌握从0开始。灵性上限仍120，当前不补满；身体性别不改变，本人旧轻重伤与累计风险不治疗、不重置；原FLASH/FROST/COURAGE样本、所有原微光片来源和耗尽记录保留；芬娜、奥斯里克、诺拉等原人的经历、原纸原匣与包裹去向不变，阿尔顿和哈罗德的原伤亡、投降及原棍去向均保留，不重开原遭遇、不复制身体、原物或技能。本人沿原出口实际离开，本次场地准备已经耗尽。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE', healthCost = severe ? 25 : 15, mindCost = severe ? 45 : 25, pollution = severe ? 60 : 30;
        s.health = Math.max(1, s.health - healthCost); s.mind = Math.max(1, s.mind - mindCost); s.seer.pollution = Math.min(100, s.seer.pollution + pollution);
        ctx.note(severe ? '智慧天使候选魔药严重排异' : '智慧天使候选魔药排异', `原瓶${bottle.id}与本次场地准备耗尽，意志${result.roll}/${result.chance}；健康−${healthCost}、精神−${mindCost}、排异+${pollution}。G专业支持仅将本次排异后的健康与精神保底到1，不保护普通死亡或战斗。仍为洞悉者候选，旧消化、掌握、身体与三项真实专业经历保留；本人经支持沿原出口实际离开，可休养重筹另一原瓶与1行动、120便士当次检查。`);
      }
      return;
    }
  }
}
/** The only old-method write available here is the already paid and provenance-bound producer. */
export function wisdomAngelInheritedFlashBlock(s: SliceState): string | null {
  if (!isWisdomAngel(s) || !hasWisdomAngelHistory(s)) return '须已实际成为阅读者序列2智慧天使候选（G），才能从本页延用旧制作入口。';
  if (hasWisdomAngelLock(s) || oldSceneOpen(s)) return '先实际收束当前及旧原物现场、许可、能力窗口、准备室和遭遇，再到旧工作台付费制作。';
  return blockProphetInheritedFlash(s);
}
export function applyWisdomAngelCommand(s: SliceState, command: WisdomAngelCommand, ctx: SeerContext): void {
  if (!validateWisdomAngelCommand(command)) throw new Error('智慧天使候选命令无效。');
  if (command.type === 'MAKE_INHERITED_FLASH') { const reason = wisdomAngelInheritedFlashBlock(s); if (reason) throw new Error(reason); return applyProphetInheritedFlash(s, ctx); }
  if (validateWisdomAngelAcquisitionCommand(command)) return applyWisdomAngelAcquisition(s, command, ctx);
  if (!isWisdomAngel(s)) throw new Error('新智慧天使候选实践与遭遇只向当前阅读者序列2候选开放，旧阶段历史不能代替当前资格。');
  if (validateWisdomAngelActivityCommand(command)) return applyWisdomAngelActivity(s, command, ctx);
  if (validateWisdomAngelEncounterCommand(command)) return applyWisdomAngelEncounterCommand(s, command, ctx);
  throw new Error('未知智慧天使候选命令。');
}

export function projectWisdomAngel(s: SliceState): WisdomAngelProjection {
  const state = s.wisdomAngel, available = knownChannel(s), promoted = hasWisdomAngelHistory(s), actions: WisdomAngelAction[] = [];
  const add = (id: string, label: string, cost: string, command: WisdomAngelAcquisitionCommand) => {
    const reason = wisdomAngelAcquisitionBlock(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (available && isWisdomAngelAcquisitionStage(s)) {
    if (!state.guidanceKnown) add('learn-wisdom-angel-guidance', '听取智慧天使候选成品与专业准备指导', '1行动 · 500便士', { type: 'LEARN_GUIDANCE' });
    else {
      for (const task of WISDOM_ANGEL_PREPARATIONS) if (!state.preparations.some(p => p.taskId === task.id)) add(`wisdom-angel-prepare-${task.id}`, task.title, '1行动 · 真实专业准备G', { type: 'PREPARE_TASK', taskId: task.id });
      if (state.preparedWeek === null) add('prepare-wisdom-angel-promotion', '实际检查本次服药场地', '1行动 · 120便士 · 仅本周有效', { type: 'PREPARE_PROMOTION' });
      else add('leave-wisdom-angel-preparation', '沿原出口结束本次准备', '0行动 · 不退成本 · 未服原瓶保留', { type: 'LEAVE_PREPARATION' });
      if (state.resupply.requestedWeek !== null) add('receive-wisdom-angel-supply', '确认下一批三瓶实际到货', `0行动 · 最早第${state.resupply.requestedWeek + 1}周`, { type: 'RECEIVE_SUPPLY' });
      else if (exhaustedSupply(state)) add('request-wisdom-angel-supply', '申请下一批独立智慧天使候选成品', '1行动 · 下一真实周起收货 · 每瓶另付费用', { type: 'REQUEST_SUPPLY' });
      for (const bottle of state.bottles) {
        if (bottle.status === 'SUPPLIER') {
          if (bottle.labourSteps < WISDOM_ANGEL_LABOUR_STEPS) add(`work-${bottle.id}`, `第${bottleNumber(bottle)}瓶 · ${WISDOM_ANGEL_LABOUR_TASKS[bottle.labourSteps]}`, `1行动 · 劳动${bottle.labourSteps}/5 · 五次抵5400便士`, { type: 'POTION_WORK', bottleId: bottle.id });
          add(`buy-${bottle.id}`, `领取第${bottleNumber(bottle)}瓶智慧天使候选魔药`, `0行动 · ${potionPrice(bottle)}便士`, { type: 'BUY_POTION', bottleId: bottle.id });
        } else if (bottle.status === 'PLAYER') add(`consume-${bottle.id}`, `独立确认服用第${bottleNumber(bottle)}瓶`, `0行动 · 洞悉者候选消化${s.progression.acting}/100 · ${insightScholarWeeks(s)}/12整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
      }
    }
  }
  if (promoted) {
    const reason = wisdomAngelInheritedFlashBlock(s);
    actions.push({ id: 'wisdom-angel-inherited-flash', label: '沿旧工艺另买原材料尝试一枚微光片', cost: '1行动 · 160便士 · 4灵性 · 知识16 · 每真实周一次', command: { type: 'MAKE_INHERITED_FLASH' }, enabled: reason === null, reason });
  }
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  return {
    title: promoted ? '智慧天使 · 阅读者序列2候选（G扩展）' : '智慧天使候选之路', discovered: available, guidanceKnown: available && state.guidanceKnown, promoted, formulaKnown: false, formula: [],
    ...(available ? { story: `${WISDOM_ANGEL_FORMULA_STATUS}${WISDOM_ANGEL_SOURCE_STATUS}` } : {}),
    supplies: available ? `供应方尚持${state.bottles.filter(b => b.status === 'SUPPLIER').length}瓶，你持未服原瓶${state.bottles.filter(b => b.status === 'PLAYER').length}瓶，已耗尽${state.bottles.filter(b => b.status === 'CONSUMED').length}瓶。每瓶6200便士或本瓶五项真实劳动后800便士；现有全部失败耗尽才可花1行动申请，跨真实周到货仍须逐瓶实际付费。` : '',
    actions: available && s.progression.sequence!==1 ? [...actions, ...(promoted ? [...wisdomAngelLifeActions(s), ...wisdomAngelEncounterActions(s)] : [])] : [],
    bottles: available ? state.bottles.map(b => ({
      id: b.id, title: `第${bottleNumber(b)}瓶 · 智慧天使候选独立成品魔药`,
      source: `${b.source}${b.acquiredWeek === null ? '尚未交付。' : `第${b.acquiredWeek}周交付。`}${b.preparationWeek === null ? '' : `第${b.preparationWeek}周实际场地检查后服用。`}`,
      status: b.status === 'SUPPLIER' ? `供应方保管 · 劳动${b.labourSteps}/5` : b.status === 'PLAYER' ? '已交付，尚未服用' : `原瓶已耗尽 · ${b.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : b.outcome === 'SUCCESS' ? '成功晋升' : b.outcome === 'GREAT_FAILURE' ? '严重排异，仍为洞悉者候选' : '排异，仍为洞悉者候选'}`,
      chance, command: { type: 'CONSUME', bottleId: b.id, confirmed: true },
    })) : [],
    preparations: available ? WISDOM_ANGEL_PREPARATIONS.map(p => ({ taskId: p.id, title: p.title, completedWeek: state.preparations.find(v => v.taskId === p.id)?.completedWeek ?? null })) : [],
    preparedWeek: available ? state.preparedWeek : null,
    abilities: promoted ? WISDOM_ANGEL_ABILITIES.map(a => ({ ...a, mastery: s.progression.mastery[a.id] ?? 0 })) : [],
    acting: promoted ? (s.progression.sequence===1?s.allKnowingEye.wisdomAngelActingAtPromotion??100:s.progression.acting) : 0,
    digestion: promoted ? `洞悉者候选消化${state.insightScholarActingAtPromotion}/100留存；智慧天使候选扮演${s.progression.sequence===1?s.allKnowingEye.wisdomAngelActingAtPromotion:s.progression.acting}/100。三案各实际报告25、一次反思25，普通完成同样可消化；每项新能力每案只在真实应用后最多增加8掌握，成功开窗而未使用不奖掌握。旧三案与旧反思不重复记为本阶经历。` : available ? `洞悉者候选需消化100（当前${s.progression.acting}/100）、从其实际晋升周起12整周（当前${insightScholarWeeks(s)}/12）；另须三项不同专业准备与本周场地检查。` : '先走完洞悉者候选之路。',
    pollution: s.seer.pollution, risk: available ? WISDOM_ANGEL_CONSUMPTION_RISK : '',
    resources: available ? { health: s.health, maxHealth: 100, mind: s.mind, maxMind: 100, spirituality: s.spirituality, maxSpirituality: 120, cash: `${s.cash}便士`, actionsRemaining: s.actionsRemaining } : null,
    currentGender: s.character.gender,
    inheritedHistory: available ? [
      `洞悉者候选第${s.insightScholar.promotionWeek}周真实晋升；${promoted ? `原消化${state.insightScholarActingAtPromotion}/100留存` : `当前消化${s.progression.acting}/100`}。通用首次晋升周${s.progression.promotionWeek}不作为本阶十二周起点。`,
      '阅读者至洞悉者候选七阶全部17个原ID与原掌握（包括0值）、各阶原消化快照、旧瓶失败及原场景历史保留。本阶只增加两项原创G候选能力，不改变身体性别、不创建新身体，也不把候选名称和编号冒充已核原著。',
      `本人健康${s.health}/100、精神${s.mind}/100、灵性${s.spirituality}/120；原伤势记录${s.injuries.length}项，未治疗重伤${s.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null).length}项、累计风险${s.injuryRisk}，不会因晋升自动治疗或清零。`,
      ...(['FLASH', 'FROST', 'COURAGE'] as const).map(id => { const sample = s.polymath.samples[id]; return `原博学者样本${id}：观察周${sample.observedWeek ?? '无'}、理解周${sample.understoodWeek ?? '无'}、实际学会周${sample.learnedWeek ?? '尚未'}；不随候选晋升免费解锁。`; }),
      ...s.mysticismMagister.crafts.map(craft => `原微光片${craft.id}：来自${craft.sourceKitId}、第${craft.createdWeek}周实际制造，当前${craft.status}、实用周${craft.usedWeek ?? '尚未'}、原效力${craft.power}；不补片、不改ID或来源。`),
      `原洞悉者纸页${s.insightScholar.life.original.id}在${s.insightScholar.life.original.location}、${s.insightScholar.life.copy.id}在${s.insightScholar.life.copy.location}；原匣${s.insightScholar.life.box.id}在${s.insightScholar.life.box.location}，余储能${s.insightScholar.life.box.charges}，不补充或换成新示范器。原封栏${s.insightScholar.life.barrier.id}仍为${s.insightScholar.life.barrier.state}，原包${s.insightScholar.life.parcel.id}在${s.insightScholar.life.parcel.location}。`,
      `原窗${s.prophet.life.shutter.id}销仍为${s.prophet.life.shutter.pin}，原页${s.prophet.life.pages.id}仍在${s.prophet.life.pages.location}；原包${s.prophet.life.parcel.id}仍在${s.prophet.life.parcel.location}，原钳${s.prophet.life.pliers.id}仍归${s.prophet.life.pliers.location}。`,
      ...(s.insightScholar.encounter.approachWeek === null ? [] : [`原阿尔顿IS3-ALTON：遭遇${s.insightScholar.encounter.status}，健康${s.insightScholar.encounter.enemyHealth}/100、精神${s.insightScholar.encounter.enemyMind}/100、灵性${s.insightScholar.encounter.enemySpirituality}/120，${s.insightScholar.encounter.enemyStatus}；原棍IS3-ALTON-CLUB在${s.insightScholar.encounter.weaponLocation}，原和平收尾、伤亡或投降不重开。`]),
      ...(s.prophet.encounter.approachWeek === null ? [] : [`原哈罗德PF4-HAROLD：健康${s.prophet.encounter.enemy.health}/100、精神${s.prophet.encounter.enemy.mind}/100，${s.prophet.encounter.enemy.status}；原棍${s.prophet.encounter.enemy.weaponId}在${s.prophet.encounter.enemy.weaponLocation}，不因新晋升复原。`]),
      '芬娜、奥斯里克、诺拉等原人的身体、同意、有限陈述和实际后果保留；已消耗预言家原封装包、原衣角借还与旧实践记录均不改写，旧同意不延伸到玛拉的新现场。',
    ] : [],
    life: projectWisdomAngelLife(s), encounter: projectWisdomAngelEncounter(s), insideCase: hasWisdomAngelLock(s),
    environment: available ? '原创G：贝克兰德独立指导场与玛拉（43岁成年人）的原记录核验场。只有两份真实有日期的原记录和一个初始两次储能的原示范器；亲手取读、当前许可、有限推断、实际演示、条件变更、核验、逐件归还与普通离场分别发生。既有洞悉者原场与物件保持原状态；智慧天使名称、序列2对应、新能力和所有新场景数值仍是未核实G候选。' : '',
  };
}

/** Exact source identities and finite week chronology; old modules retain ownership of their histories. */
export function validateWisdomAngelState(s: SliceState): boolean { try { return validateState(s); } catch { return false; } }
function validateState(s: SliceState): boolean {
  const raw: unknown = s.wisdomAngel;
  if (!record(raw) || !shape(raw, ['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'insightScholarActingAtPromotion', 'preparations', 'preparedWeek', 'life', 'encounter']) || typeof raw.guidanceKnown !== 'boolean') return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, s.week) || !Array.isArray(raw.bottles) || raw.bottles.length !== 3 * (raw.resupply.deliveries + 1) || !Array.isArray(raw.preparations)) return false;
  const state = raw as unknown as WisdomAngelState, promoted = hasWisdomAngelHistory(s), acquisitionStage = isWisdomAngelAcquisitionStage(s);
  const firstWeek = s.insightScholar.promotionWeek ?? s.week, firstConsumptionWeek = firstWeek + WISDOM_ANGEL_MIN_INSIGHT_SCHOLAR_WEEKS, lastAcquisitionWeek = state.promotionWeek ?? s.week;
  if (state.guidanceKnown && (!knownChannel(s) || !integer(s.insightScholar.promotionWeek, 1, s.week))) return false;
  if (acquisitionStage && (!shape(s.progression.mastery, INHERITED_ABILITY_IDS) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500)))) return false;
  if (state.preparations.length > WISDOM_ANGEL_PREPARATION_IDS.length || new Set(state.preparations.map(p => p.taskId)).size !== state.preparations.length) return false;
  for (const p of state.preparations) if (!record(p) || !shape(p, ['taskId', 'completedWeek']) || !WISDOM_ANGEL_PREPARATION_IDS.includes(p.taskId) || !integer(p.completedWeek, firstWeek, lastAcquisitionWeek)) return false;
  if (!state.guidanceKnown && (state.preparations.length || state.preparedWeek !== null || state.resupply.deliveries !== 0 || state.resupply.requestedWeek !== null)) return false;
  if (state.preparedWeek !== null && (!integer(state.preparedWeek, firstConsumptionWeek, s.week) || state.preparedWeek !== s.week || !state.guidanceKnown || !acquisitionStage || !hasPreparations(s) || !state.bottles.some(b => b.status === 'PLAYER') || s.progression.acting !== 100 || s.status !== 'ACTIVE' || s.health <= 20 || s.mind <= 40 || s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || oldSceneOpen(s) || hasWisdomAngelLifeLock(s) || hasWisdomAngelEncounterLock(s))) return false;
  if (promoted) {
    if (!state.guidanceKnown || !integer(s.insightScholar.promotionWeek, 1, s.week) || !integer(state.promotionWeek, firstConsumptionWeek, s.week) || state.insightScholarActingAtPromotion !== 100 || state.preparedWeek !== null || state.resupply.requestedWeek !== null || !hasPreparations(s) || oldSceneOpen(s)) return false;
    if (!shape(s.progression.mastery, [...(s.progression.sequence===1?ALL_KNOWING_EYE_ABILITY_IDS:[]), ...INHERITED_ABILITY_IDS, ...WISDOM_ANGEL_ABILITY_IDS]) || !Object.values(s.progression.mastery).every(v => integer(v, 0, 500))) return false;
  } else if (state.promotionWeek !== null || state.insightScholarActingAtPromotion !== null || WISDOM_ANGEL_ABILITY_IDS.some(id => Object.hasOwn(s.progression.mastery, id))) return false;
  let successes = 0;
  for (const [index, b] of state.bottles.entries()) {
    if (!record(b) || !shape(b, ['id', 'source', 'stockedWeek', 'labourSteps', 'acquiredWeek', 'consumedWeek', 'preparationWeek', 'status', 'outcome']) || b.id !== `wisdom-angel-potion-${index + 1}` || !integer(b.labourSteps, 0, WISDOM_ANGEL_LABOUR_STEPS)) return false;
    const stockWeek = b.stockedWeek ?? firstWeek;
    if (index < WISDOM_ANGEL_BOTTLE_IDS.length) {
      if (b.stockedWeek !== null || b.source !== WISDOM_ANGEL_POTION_SOURCES[index]!.source) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.stockedWeek, firstConsumptionWeek + 1, lastAcquisitionWeek) || b.source !== deliverySource(index + 1, b.stockedWeek)) return false;
      const batchStart = index - index % WISDOM_ANGEL_BOTTLE_IDS.length;
      if (b.stockedWeek !== state.bottles[batchStart]!.stockedWeek) return false;
      // Every earlier bottle must have failed before this batch's real delivery week.
      if (state.bottles.slice(0, batchStart).some(previous => previous.status !== 'CONSUMED' || !failed(previous.outcome) || !integer(previous.consumedWeek, firstConsumptionWeek, stockWeek - 1))) return false;
    }
    if (!state.guidanceKnown && (b.labourSteps !== 0 || b.status !== 'SUPPLIER')) return false;
    if (b.status === 'SUPPLIER') {
      if (b.acquiredWeek !== null || b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
    } else {
      if (!state.guidanceKnown || !integer(b.acquiredWeek, stockWeek, lastAcquisitionWeek)) return false;
      if (b.status === 'PLAYER') {
        if (b.consumedWeek !== null || b.outcome !== null || b.preparationWeek !== null) return false;
      } else if (b.status === 'CONSUMED') {
        if (!integer(s.insightScholar.promotionWeek, 1, s.week) || !integer(b.consumedWeek, Math.max(firstConsumptionWeek, b.acquiredWeek), lastAcquisitionWeek) || b.preparationWeek !== b.consumedWeek || (!success(b.outcome) && !failed(b.outcome)) || !hasPreparations(s) || state.preparations.some(p => p.completedWeek > b.consumedWeek!) || !promoted && (!acquisitionStage || s.progression.acting !== 100)) return false;
        if (success(b.outcome)) { successes++; if (b.consumedWeek !== state.promotionWeek) return false; }
      } else return false;
    }
  }
  if (state.resupply.requestedWeek !== null && (!integer(state.resupply.requestedWeek, firstConsumptionWeek, s.week) || !state.guidanceKnown || !acquisitionStage || state.preparedWeek !== null || !exhaustedSupply(state) || state.bottles.some(b => b.consumedWeek! > state.resupply.requestedWeek!))) return false;
  if (successes !== (promoted ? 1 : 0) || !validateWisdomAngelLife(s) || !validateWisdomAngelEncounter(s)) return false;
  if (promoted) {
    const acting = Object.values(state.life.cases).filter(c => c.status === 'RESOLVED').length * 25 + (state.life.reflected ? 25 : 0);
    if (s.progression.acting !== acting) return false;
  }
  return true;
}
export { WISDOM_ANGEL_ABILITIES } from './content.js';
export { WISDOM_ANGEL_ABILITY_IDS } from './types.js';
export type * from './types.js';
