import { WRITER_ABILITIES } from '../writer/content.js';
import { ATTENDANT_MYSTERIES_ABILITIES } from '../attendant-mysteries/content.js';
import { BARREN_MATRIARCH_ABILITY_IDS } from '../barren-matriarch/types.js';
import { BALANCER_ABILITY_IDS } from '../balancer/types.js';
import { ENTROPY_DUKE_ABILITY_IDS } from '../entropy-duke/types.js';
import { BARREN_MATRIARCH_ABILITIES } from '../barren-matriarch/content.js';
import { BALANCER_ABILITIES } from '../balancer/content.js';
import { ENTROPY_DUKE_ABILITIES } from '../entropy-duke/content.js';
import { FATE_PROPHET_ABILITY_IDS } from '../fate-prophet/types.js';
import { FATE_PROPHET_ABILITIES } from '../fate-prophet/content.js';
import { ANCIENT_EVIL_ABILITY_IDS } from '../ancient-evil/types.js';
import { ANCIENT_EVIL_ABILITIES } from '../ancient-evil/content.js';
import { BLOOD_DUKE_ABILITY_IDS } from '../blood-duke/types.js';
import { BLOOD_DUKE_ABILITIES } from '../blood-duke/content.js';
import { ELDER_ABILITY_IDS } from '../elder/types.js';
import { ELDER_ABILITIES } from '../elder/content.js';
import { SAGE_ABILITY_IDS } from '../sage/types.js';
import { SAGE_ABILITIES } from '../sage/content.js';
import {FATE_TROJAN_ABILITIES} from '../fate-trojan/content.js';
import {FATE_TROJAN_ABILITY_IDS} from '../fate-trojan/types.js';
import {PLANESWALKER_ABILITIES} from '../planeswalker/content.js';
import {DEATH_CONSUL_ABILITIES} from '../death-consul/content.js';
import {WISDOM_ANGEL_ABILITIES} from '../wisdom-angel/content.js';
import {CONCEALMENT_SERVANT_ABILITIES} from '../concealment-servant/content.js';
import {LIFE_GIVER_ABILITIES} from '../life-giver/content.js';
import {KNOWLEDGE_MENTOR_ABILITIES} from '../knowledge-mentor/content.js';
import {DISCERNER_ABILITIES} from '../discerner/content.js';
import {CONQUEROR_ABILITIES} from '../conqueror/content.js';
import {WEATHER_WARLOCK_ABILITIES} from '../weather-warlock/content.js';
import {MIRACLE_WORKER_ABILITIES} from '../miracle-worker/content.js';
import {COFFIN_BEARER_ABILITIES} from '../coffin-bearer/content.js';
import {CHAOS_HUNTER_ABILITIES} from '../chaos-hunter/content.js';
import {FRENZY_MAGE_ABILITIES} from '../frenzy-mage/content.js';
import {CHAOS_WALKER_ABILITIES} from '../chaos-walker/content.js';
import {SILENT_DISCIPLE_ABILITIES} from '../silent-disciple/content.js';
import {BLATHERER_ABILITIES} from '../blatherer/content.js';
import {THREE_HEADED_TEMPLAR_ABILITIES} from '../three-headed-templar/content.js';
import {PROPHECY_MASTER_ABILITIES} from '../prophecy-master/content.js';
import { CALAMITY_DEMONESS_ABILITY_IDS } from '../calamity-demoness/types.js';
import {UNAGING_DEMONESS_ABILITIES} from '../unaging-demoness/content.js';
import { CALAMITY_DEMONESS_ABILITIES } from '../calamity-demoness/content.js';
import { GLORY_ABILITIES } from '../glory/content.js';
import {SILVER_KNIGHT_ABILITIES} from '../silver-knight/content.js';
import {DECEIT_MENTOR_ABILITIES} from '../deceit-mentor/content.js';
import {WANDERER_ABILITIES} from '../wanderer/content.js';
import {FERRYMAN_ABILITIES} from '../ferryman/content.js';
import { LIGHT_SEEKER_ABILITIES } from '../light-seeker/content.js';
import {JUSTICE_MENTOR_ABILITIES} from '../justice-mentor/content.js';
import { CATASTROPHE_ABILITIES } from '../catastrophe/content.js';
import {SEA_KING_ABILITIES} from '../sea-king/content.js';
import {INSIGHT_SCHOLAR_ABILITIES} from '../insight-scholar/content.js';
import {FEAR_BISHOP_ABILITIES} from '../fear-bishop/content.js';
import {SUMMONING_MASTER_ABILITIES} from '../summoning-master/content.js';
import {ARCANE_SCHOLAR_ABILITIES} from '../arcane-scholar/content.js';
import {DREAM_WEAVER_ABILITIES} from '../dream-weaver/content.js';
import { WAR_BISHOP_ABILITIES } from '../war-bishop/content.js';
import {ANCIENT_SCHOLAR_ABILITIES} from '../ancient-scholar/content.js';
import {ANCIENT_ALCHEMIST_ABILITIES} from '../ancient-alchemist/content.js';
import {IMPERATIVE_MAGE_ABILITIES} from '../imperative-mage/content.js';
import {FALLEN_EARL_ABILITIES} from '../fallen-earl/content.js';
import {MISFORTUNE_MAGE_ABILITIES} from '../misfortune-mage/content.js';
import {PUPPET_ABILITIES} from '../puppet/content.js';
import {DEVIL_ABILITIES} from '../devil/content.js';
import {BLACK_KNIGHT_ABILITIES} from '../black-knight/content.js';
import {MYSTIC_ABILITIES} from '../mystic/content.js';
import {DESPAIR_ABILITIES} from '../despair/content.js';
import {DEMON_HUNTER_ABILITIES} from '../demon-hunter/content.js';
import {PARASITE_ABILITIES} from '../parasite/content.js';
import {SECRETS_SORCERER_ABILITIES} from '../secrets-sorcerer/content.js';
import {UNDYING_ABILITIES} from '../undying/content.js';
import {UNSHADOWED_ABILITIES} from '../unshadowed/content.js';
import {CATACLYSM_PRIEST_ABILITIES} from '../cataclysm-priest/content.js';
import {PROPHET_ABILITIES} from '../prophet/content.js';
import {NIGHTWATCHER_ABILITIES} from '../nightwatcher/content.js';
import {WITCH_KING_ABILITIES} from '../witch-king/content.js';
import {ALCHEMIST_ABILITIES} from '../alchemist/content.js';
import {MANIPULATOR_ABILITIES} from '../manipulator/content.js';
import {IRON_BLOOD_KNIGHT_ABILITIES} from '../iron-blood-knight/content.js';
import {IRON_BLOOD_KNIGHT_ABILITY_IDS} from '../iron-blood-knight/types.js';
import { BIZARRO_SORCERER_ABILITIES } from '../bizarro-sorcerer/content.js';
import {DRUID_ABILITIES} from '../druid/content.js';
import {PUNISHMENT_KNIGHT_ABILITIES} from '../punishment-knight/content.js';
import {MENTOR_DISORDER_ABILITIES} from '../mentor-disorder/content.js';
import {WINNER_ABILITIES} from '../winner/content.js';
import {WRAITH_ABILITIES} from '../wraith/content.js';
import {DESIRE_APOSTLE_ABILITIES} from '../desire-apostle/content.js';
import {SHEPHERD_ABILITIES} from '../shepherd/content.js';
import {STAR_MYSTIC_ABILITIES} from '../star-mystic/content.js';
import {PAIN_ABILITIES} from '../pain/content.js';
import {GUARDIAN_ABILITIES} from '../guardian/content.js';
import {DREAM_STEALER_ABILITIES} from '../dream-stealer/content.js';
import {TRAVELER_ABILITIES} from '../traveler/content.js';
import {GATEKEEPER_ABILITIES} from '../gatekeeper/content.js';
import {PRIEST_OF_LIGHT_ABILITIES} from '../priest-of-light/content.js';
import {OCEAN_SINGER_ABILITIES} from '../ocean-singer/content.js';
import {MYSTICISM_MAGISTER_ABILITIES} from '../mysticism-magister/content.js';
import {SPIRIT_WARLOCK_ABILITIES} from '../spirit-warlock/content.js';
import {CRIMSON_SCHOLAR_ABILITIES} from '../crimson-scholar/content.js';
import {ASTRONOMER_ABILITIES} from '../astronomer/content.js';
import {DREAMWALKER_ABILITIES} from '../dreamwalker/content.js';
import {REAPER_ABILITIES} from '../reaper/content.js';
import {MARIONETTIST_ABILITIES} from '../marionettist/content.js';
import {BIOLOGIST_ABILITIES} from '../biologist/content.js';
import {JUDGE_ABILITIES} from '../judge/content.js';
import {CORRUPTION_BARON_ABILITIES} from '../corruption-baron/content.js';
import {CALAMITY_PRIEST_ABILITIES} from '../calamity-priest/content.js';
import {ZOMBIE_ABILITIES} from '../zombie/content.js';
import {DEMON_ABILITIES} from '../demon/content.js';
import {ROSE_BISHOP_ABILITIES} from '../rose-bishop/content.js';
import {SCROLL_PROFESSOR_ABILITIES} from '../scroll-professor/content.js';
import {PLEASURE_ABILITIES} from '../pleasure/content.js';
import {DAWN_PALADIN_ABILITIES} from '../dawn-paladin/content.js';
import {FIRE_THIEF_ABILITIES} from '../fire-thief/content.js';
import {RECORDER_ABILITIES} from '../recorder/content.js';
import {SPIRIT_GUIDE_ABILITIES} from '../spirit-guide/content.js';
import {NOTARY_ABILITIES} from '../notary/content.js';
import {WIND_BLESSED_ABILITIES} from '../wind-blessed/content.js';
import {POLYMATH_ABILITIES} from '../polymath/content.js';
import {SOOTHER_ABILITIES} from '../soother/content.js';
import {POTION_PROFESSOR_ABILITIES} from '../potion-professor/content.js';
import {ARTISAN_ABILITIES} from '../artisan/content.js';
import {HYPNOTIST_ABILITIES} from '../hypnotist/content.js';
import {CONSPIRATOR_ABILITIES} from '../conspirator/content.js';
import {FACELESS_ABILITIES} from '../faceless/content.js';
import {HARVESTPRIEST_ABILITIES} from '../harvestpriest/content.js';
import {PHYSICIAN_ABILITIES} from '../physician/content.js';
import {CULTIVATOR_ABILITIES} from '../cultivator/content.js';
import {INTERROGATOR_ABILITIES} from '../interrogator/content.js';
import {SHERIFF_ABILITIES} from '../sheriff/content.js';
import {ARBITER_ABILITIES} from '../arbiter/content.js';
import {BRIBER_ABILITIES} from '../briber/content.js';
import {BARBARIAN_ABILITIES} from '../barbarian/content.js';
import {LAWYER_ABILITIES} from '../lawyer/content.js';
import {LUCKY_ABILITIES} from '../lucky/content.js';
import {MACHINE_ABILITIES} from '../machine/content.js';
import {MONSTER_ABILITIES} from '../monster/content.js';
import {WEREWOLF_ABILITIES} from '../werewolf/content.js';
import {MADMAN_ABILITIES} from '../madman/content.js';
import {PRISONER_ABILITIES} from '../prisoner/content.js';
import {SERIAL_KILLER_ABILITIES} from '../serial-killer/content.js';
import {UNWINGED_ABILITIES} from '../unwinged/content.js';
import {CRIMINAL_ABILITIES} from '../criminal/content.js';
import {SHADOW_ASCETIC_ABILITIES} from '../shadow-ascetic/content.js';
import {LISTENER_ABILITIES} from '../listener/content.js';
import {SECRET_SUPPLICANT_ABILITIES} from '../secret-supplicant/content.js';
import {WIZARD_ABILITIES} from '../wizard/content.js';
import {COMBAT_SCHOLAR_ABILITIES} from '../combat-scholar/content.js';
import {PRYER_ABILITIES} from '../pryer/content.js';
import {WITCH_ABILITIES} from '../witch/content.js';
import {INSTIGATOR_ABILITIES} from '../instigator/content.js';
import {ASSASSIN_ABILITIES} from '../assassin/content.js';
import {WEAPONMASTER_ABILITIES} from '../weaponmaster/content.js';
import {GLADIATOR_ABILITIES} from '../gladiator/content.js';
import {WARRIOR_ABILITIES} from '../warrior/content.js';
import {CRYPTOLOGIST_ABILITIES} from '../cryptologist/content.js';
import {SWINDLER_ABILITIES} from '../swindler/content.js';
import {MARAUDER_ABILITIES} from '../marauder/content.js';
import {ASTROLOGER_ABILITIES} from '../astrologer/content.js';
import {TRICKMASTER_ABILITIES} from '../trickmaster/content.js';
import {APPRENTICE_ABILITIES} from '../apprentice/content.js';
import {SPIRITMEDIUM_ABILITIES} from '../spiritmedium/content.js';
import {GRAVEDIGGER_ABILITIES} from '../gravedigger/content.js';
import {CORPSECOLLECTOR_ABILITIES} from '../corpsecollector/content.js';
import {SUNPRIEST_ABILITIES} from '../sunpriest/content.js';
import {LIGHTPRAYER_ABILITIES} from '../lightprayer/content.js';
import {BARD_ABILITIES} from '../bard/content.js';
import {NAVIGATOR_ABILITIES} from '../navigator/content.js';
import {RAGER_ABILITIES} from '../rager/content.js';
import {SAILOR_ABILITIES} from '../sailor/content.js';
import {DETECTIVE_ABILITIES} from '../detective/content.js';
import {REASONER_ABILITIES} from '../reasoner/content.js';
import {READER_ABILITIES} from '../reader/content.js';
import {NIGHTMARE_ABILITIES} from '../nightmare/content.js';
import {MIDNIGHT_ABILITIES} from '../midnight/content.js';
import {SLEEPLESS_ABILITIES} from '../sleepless/content.js';
import {VAMPIRE_ABILITIES} from '../vampire/content.js';
import {APPRAISER_ABILITIES} from '../appraiser/content.js';
import {PSYCHOLOGIST_ABILITIES} from '../psychologist/content.js';
import {PYROMANIAC_ABILITIES} from '../pyromaniac/content.js';
import {MAGICIAN_ABILITIES} from '../magician/content.js';
import {TAMER_ABILITIES} from '../tamer/content.js';
import {APOTHECARY_ABILITIES} from '../apothecary/content.js';
import {ARCHAEOLOGIST_ABILITIES} from '../archaeologist/content.js';
import {SAVANT_ABILITIES} from '../savant/content.js';
import {MINDREADER_ABILITIES} from '../mindreader/content.js';
import {AUDIENCE_ABILITIES} from '../audience/content.js';
import {PROVOKER_ABILITIES} from '../provoker/content.js';
import {HUNTER_ABILITIES} from '../hunter/content.js';
import {HUNTER_ABILITY_IDS} from '../hunter/types.js';
import {CLOWN_ABILITIES} from '../clown/content.js';
import {createSeerPractice,applySeerPractice,projectSeerPractice,validateSeerPractice} from './practice.js';
import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import { SEER_ABILITIES, SEER_BATCH_IDS, SEER_CONSUMPTION_RISK, SEER_FORMULA, SEER_FORMULA_SOURCE, SEER_GUIDE, SEER_PRICES } from './content.js';
import { SEER_ABILITY_IDS, type ProgressionState, type SeerAction, type SeerBatch, type SeerCommand, type SeerProjection, type SeerState } from './types.js';

export interface SeerContext {
  roll(min: number, max: number): number;
  note(title: string, text: string): void;
  check(ability: PublicCoreStatKey, difficulty: number): PublicCheckResult;
}

export function emptyProgression(): ProgressionState {
  return { pathwayId: null, sequence: null, mastery: {}, acting: 0, promotionWeek: null };
}

function createBatch(number: number): SeerBatch {
  const id = `seer-batch-${number}`;
  return {
    id, labourSteps: 0, acquired: false, brewed: false,
    materials: SEER_FORMULA.map(material => ({
      id: `${id}:${material.id}`, name: material.name, quantity: material.quantity, unit: material.unit,
      source: `占卜俱乐部备料第${number}批${material.id === 'lava-octopus-blood' ? '，血液避光保存' : ''}`,
      holder: 'SUPPLIER',
    })),
  };
}

export function createSeerState(): SeerState {
  return {
    practice:createSeerPractice(), discovered: false, formulaKnown: false,
    resupply: { requestedWeek: null, deliveries: 0 },
    batches: SEER_BATCH_IDS.map((_, index) => createBatch(index + 1)),
    bottles: [], pollution: 0, omen: null, completedSources: [],
  };
}

function rule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const promoted = (s: SliceState) => s.progression.pathwayId === 'diviner' && (s.progression.sequence === 9||s.progression.sequence === 8||s.progression.sequence === 7||s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))));
const materialPrice = (batch: SeerBatch) => SEER_PRICES.auxiliaryMaterials + (batch.labourSteps === 2 ? 0 : SEER_PRICES.mainMaterials);
const bottleId = (batch: SeerBatch) => `${batch.id}:bottle`;
const batchNumber = (batch: Pick<SeerBatch, 'id'>) => Number(batch.id.slice('seer-batch-'.length));
const ordinaryWeeks = (s: SliceState) => Math.min(4, Math.max(0, (s.progression.promotionWeek ?? s.week) - 1));
const failedBatch = (seer: SeerState, batch: SeerBatch) => batch.brewed && seer.bottles.some(bottle =>
  bottle.batchId === batch.id && bottle.status === 'CONSUMED' && (bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE'));
const exhaustedSupply = (seer: SeerState) => seer.batches.length >= 3 && seer.bottles.length === seer.batches.length && seer.batches.every(batch => failedBatch(seer, batch));

function commonBlock(s: SliceState, actions = 0): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.actionsRemaining < actions) return '本周剩余行动不足。';
  return null;
}

function commandBlock(s: SliceState, command: Exclude<SeerCommand,{type:'PRACTICE'}|{type:'REFLECT'}>): string | null {
  const ap = ['DISCOVER', 'LEARN_FORMULA', 'REQUEST_SUPPLY', 'MATERIAL_WORK', 'BREW', 'DIVINE'].includes(command.type) ? 1 : 0;
  const common = commonBlock(s, ap);
  if (common) return common;
  if (command.type === 'DIVINE') {
    if (!promoted(s)) return '成为占卜家后才能主动占卜。';
    if (command.targetId !== 'FIRST_CASE' || s.arc.stage === 'ENDED' || s.world.city !== 'BACKLUND') return '当前没有可占卜的已知首案目标。';
    if (s.seer.omen && !s.seer.omen.used) return '已有一枚待使用的首案预示。';
    if (s.spirituality < 3) return '需要3点灵性。';
    return null;
  }
  if (s.progression.pathwayId!==null) return '你已选择非凡途径，不能改服占卜家魔药。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的占卜俱乐部。';
  if (command.type === 'DISCOVER') return s.seer.discovered ? '已经认识这位指导者。' : null;
  if (!s.seer.discovered) return '先拜访占卜俱乐部指导者。';
  if (command.type === 'LEARN_FORMULA') {
    if (s.seer.formulaKnown) return '已经掌握这份配方。';
    return s.cash < SEER_PRICES.formula ? '配方指导需要120便士。' : null;
  }
  if (!s.seer.formulaKnown) return '先完成配方指导。';
  if (command.type === 'REQUEST_SUPPLY') {
    if (s.seer.resupply.requestedWeek !== null) return '已经向指导者申请下一轮材料，请等到下一个真实周。';
    return exhaustedSupply(s.seer) ? null : '现有三批必须全部真实服用且晋升失败；剩余材料或未服原瓶不能重复补给。';
  }
  if (command.type === 'RECEIVE_SUPPLY') {
    const requestedWeek = s.seer.resupply.requestedWeek;
    if (requestedWeek === null) return '先向原指导者申请下一轮材料并完成备料准备。';
    if (!exhaustedSupply(s.seer)) return '仍有材料或未服原瓶，不能重复补给。';
    return s.week <= requestedWeek ? `材料最早第${requestedWeek + 1}周到货，需要推进到下一个真实周。` : null;
  }
  if (command.type === 'CONSUME') {
    if (command.confirmed !== true) return '服药需要单独确认。';
    const bottle = s.seer.bottles.find(candidate => candidate.id === command.bottleId);
    if (!bottle || bottle.status !== 'PREPARED') return '所选原瓶不存在或已经用完。';
    if (s.week < 5) return `普通生活已完成${ordinaryWeeks(s)}/4整周，第5周起可以服药。`;
    return null;
  }
  const batch = s.seer.batches.find(candidate => candidate.id === command.batchId);
  if (!batch) return '这批材料不存在。';
  if (command.type === 'MATERIAL_WORK') {
    if (batch.acquired) return '这批材料已经取得，不能追溯抵扣费用。';
    return batch.labourSteps >= 2 ? '这批两步劳动已经完成。' : null;
  }
  if (command.type === 'BUY_MATERIALS') {
    if (batch.acquired) return '这批材料已经交付。';
    return s.cash < materialPrice(batch) ? `这批采购需要${materialPrice(batch)}便士。` : null;
  }
  if (!batch.acquired) return '先取得这一整批材料。';
  if (batch.brewed) return '这批材料已经调配成原瓶。';
  if (!batch.materials.every((material, i) => material.holder === 'PLAYER' && material.quantity === SEER_FORMULA[i]!.quantity)) return '这一批现有材料数量不足。';
  return s.cash < SEER_PRICES.brewing ? '调配台使用需要60便士。' : null;
}

/** Mutates only the caller's working copy. The shared slice commits the whole intent. */
export function applySeerCommand(s: SliceState, command: SeerCommand, c: SeerContext): void {
  if(command.type==='PRACTICE'||command.type==='REFLECT'){applySeerPractice(s,command,c,(source,amount)=>awardSeerMastery(s,source,amount,c));return;}
  const blocked = commandBlock(s, command);
  rule(!blocked, blocked ?? '当前无法进行这项行动。');
  switch (command.type) {
    case 'DISCOVER':
      s.actionsRemaining -= 1;
      s.seer.discovered = true;
      c.note('一扇安静的门', `你拜访了${SEER_GUIDE}。对方愿意指导配方，并说明现有三批备料的购买与劳动交换方式。这次会面没有赋予你非凡能力。`);
      return;
    case 'LEARN_FORMULA':
      s.actionsRemaining -= 1;
      s.cash -= SEER_PRICES.formula;
      s.seer.formulaKnown = true;
      c.note('记下占卜家配方', `花费1行动、120便士，在指导下核对七项材料与用量。拉瓦章鱼血须避光保存。${SEER_FORMULA_SOURCE}`);
      return;
    case 'REQUEST_SUPPLY':
      s.actionsRemaining -= 1;
      s.seer.resupply.requestedWeek = s.week;
      c.note('申请下一轮占卜家材料', `花费1行动，向原${SEER_GUIDE}申请下一轮三批材料，并核对七料清单、准备避光存放位置。现有三批原瓶均已服用且未晋升；材料最早第${s.week + 1}周到货。申请不交付材料，也不抵扣后续材料、调配费用或每批两步劳动。`);
      return;
    case 'RECEIVE_SUPPLY': {
      const firstNumber = s.seer.batches.length + 1;
      s.seer.batches.push(...SEER_BATCH_IDS.map((_, index) => createBatch(firstNumber + index)));
      s.seer.resupply.deliveries += 1;
      s.seer.resupply.requestedWeek = null;
      c.note('占卜家新一轮备料到货', `原${SEER_GUIDE}确认第${firstNumber}至${firstNumber + 2}批七料已到货，0行动。新材料仍由供应方持有，须按原价购买或分别完成两步劳动后支付辅材费，再实际调配、确认服药。旧材料的消耗、原瓶与失败记录完整保留。`);
      return;
    }
    case 'MATERIAL_WORK': {
      const batch = s.seer.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      batch.labourSteps += 1;
      c.note(batch.labourSteps === 1 ? '完成抄录' : '完成盘点', batch.labourSteps === 1
        ? `你替俱乐部抄录公开藏书目录，第${batchNumber(batch)}批劳动进度1/2。再完成一次盘点，可抵该批600便士主材费；当前尚未取得材料。`
        : `你完成第${batchNumber(batch)}批备料盘点。两步劳动抵该批600便士主材费；仍需支付60便士五项辅材费，才会交付整批材料。`);
      return;
    }
    case 'BUY_MATERIALS': {
      const batch = s.seer.batches.find(candidate => candidate.id === command.batchId)!;
      const paid = materialPrice(batch);
      s.cash -= paid;
      batch.acquired = true;
      for (const material of batch.materials) material.holder = 'PLAYER';
      c.note('一批材料交付', `第${batchNumber(batch)}批七项材料已实际交到你手中，支付${paid}便士，0行动。${batch.labourSteps === 2 ? '两步劳动已抵扣本批主材费。' : '主材600便士、辅材60便士。'}拉瓦章鱼血继续避光保存；本批消耗后不会恢复。`);
      return;
    }
    case 'BREW': {
      const batch = s.seer.batches.find(candidate => candidate.id === command.batchId)!;
      s.actionsRemaining -= 1;
      s.cash -= SEER_PRICES.brewing;
      for (const material of batch.materials) { material.quantity = 0; material.holder = 'CONSUMED'; }
      batch.brewed = true;
      s.seer.bottles.push({ id: bottleId(batch), batchId: batch.id, inputIds: batch.materials.map(material => material.id), brewedWeek: s.week, status: 'PREPARED', outcome: null });
      c.note('一瓶占卜家魔药', `第${batchNumber(batch)}批七项材料已全部投入调配，花费1行动、60便士。所得原瓶单独保存，尚未服用；普通生活需完成4整周后才能确认服药。`);
      return;
    }
    case 'CONSUME': {
      const bottle = s.seer.bottles.find(candidate => candidate.id === command.bottleId)!;
      const result = c.check('will', 5);
      bottle.status = 'CONSUMED';
      bottle.outcome = result.tier;
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        const mentalCost = result.tier === 'GREAT_SUCCESS' ? 5 : 10;
        s.mind -= mentalCost;
        s.progression.pathwayId = 'diviner';
        s.progression.sequence = 9;
        s.progression.promotionWeek = s.week;
        s.progression.mastery = Object.fromEntries(SEER_ABILITY_IDS.map(id => [id, 0]));
        s.character.coreStats.perception = Math.min(500, s.character.coreStats.perception + 3);
        s.character.coreStats.will = Math.min(500, s.character.coreStats.will + 2);
        s.character.coreStats.knowledge = Math.min(500, s.character.coreStats.knowledge + 3);
        c.note('成为占卜家', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}：精神−${mentalCost}，感知+3、意志+2、知识+3。四项非凡能力从0掌握开始，灵性上限提高到30，当前灵性没有补满。`);
      } else {
        const severe = result.tier === 'GREAT_FAILURE';
        s.mind -= severe ? 40 : 20;
        s.health -= severe ? 20 : 10;
        s.seer.pollution = Math.min(100, s.seer.pollution + (severe ? 50 : 25));
        c.note(severe ? '指导者中断了晋升' : '魔药发生排异', `原瓶${bottle.id}已耗尽。意志判定${result.roll}/${result.chance}，${severe ? '灾难' : '失败'}：精神−${severe ? 40 : 20}、健康−${severe ? 20 : 10}、排异+${severe ? 50 : 25}。你仍是普通人。指导者处理了现场，未发生死亡；需要休养，重试须另备一瓶。`);
      }
      return;
    }
    case 'DIVINE': {
      s.actionsRemaining -= 1;
      s.spirituality -= 3;
      const result = c.check('knowledge', 12);
      if (result.tier === 'GREAT_SUCCESS' || result.tier === 'SUCCESS') {
        s.seer.omen = { targetId: 'FIRST_CASE', createdWeek: s.week, used: false };
        c.note('首案的预示', `你围绕已经见过的首案线索完成占卜，花费1行动、3灵性。知识判定${result.roll}/${result.chance}：得到一枚仅适用于首案的预示，下一次首案判定难度−5，用后消失。它没有指出未知人物或替你补齐证据。`);
        awardSeerMastery(s, 'first-case-divination', 8, c);
      } else {
        c.note('未形成可靠预示', `花费1行动、3灵性，知识判定${result.roll}/${result.chance}：${result.tier === 'GREAT_FAILURE' ? '灾难' : '失败'}。你没有取得可用预示，已经消耗的时间与灵性不退还。`);
      }
      return;
    }
  }
}

/** One source grants one packet to one known ability. Capped overflow is discarded. */
export function awardSeerMastery(s: SliceState, sourceId: string, amount: 5 | 8 | 25, c: SeerContext): void {
  if (s.progression.pathwayId===null || s.seer.completedSources.includes(sourceId)) return;
  rule(sourceId.length > 0 && sourceId.length <= 200, '成长来源编号无效。');
  rule([5, 8, 25].includes(amount), '成长数量无效。');
  s.seer.completedSources.push(sourceId);
  const pool = [...WRITER_ABILITIES,...CONQUEROR_ABILITIES,...ATTENDANT_MYSTERIES_ABILITIES,...BARREN_MATRIARCH_ABILITIES,...BALANCER_ABILITIES,...ENTROPY_DUKE_ABILITIES,...FATE_PROPHET_ABILITIES,...ANCIENT_EVIL_ABILITIES,...BLOOD_DUKE_ABILITIES,...ELDER_ABILITIES,...SAGE_ABILITIES,...CALAMITY_DEMONESS_ABILITIES,...GLORY_ABILITIES,...FATE_TROJAN_ABILITIES,...PLANESWALKER_ABILITIES,...DEATH_CONSUL_ABILITIES,...LIGHT_SEEKER_ABILITIES,...CATASTROPHE_ABILITIES,...WISDOM_ANGEL_ABILITIES,...CONCEALMENT_SERVANT_ABILITIES,...LIFE_GIVER_ABILITIES,...KNOWLEDGE_MENTOR_ABILITIES,...DISCERNER_ABILITIES,...WEATHER_WARLOCK_ABILITIES,...MIRACLE_WORKER_ABILITIES,...COFFIN_BEARER_ABILITIES,...CHAOS_HUNTER_ABILITIES,...FRENZY_MAGE_ABILITIES,...CHAOS_WALKER_ABILITIES,...SILENT_DISCIPLE_ABILITIES,...BLATHERER_ABILITIES,...THREE_HEADED_TEMPLAR_ABILITIES,...PROPHECY_MASTER_ABILITIES,...UNAGING_DEMONESS_ABILITIES,...SILVER_KNIGHT_ABILITIES,...DECEIT_MENTOR_ABILITIES,...WANDERER_ABILITIES,...FERRYMAN_ABILITIES,...JUSTICE_MENTOR_ABILITIES,...SEA_KING_ABILITIES,...INSIGHT_SCHOLAR_ABILITIES,...FEAR_BISHOP_ABILITIES,...SUMMONING_MASTER_ABILITIES,...ARCANE_SCHOLAR_ABILITIES,...DREAM_WEAVER_ABILITIES,...WAR_BISHOP_ABILITIES,...ANCIENT_SCHOLAR_ABILITIES,...ANCIENT_ALCHEMIST_ABILITIES,...IMPERATIVE_MAGE_ABILITIES,...FALLEN_EARL_ABILITIES,...MISFORTUNE_MAGE_ABILITIES,...PUPPET_ABILITIES,...DEVIL_ABILITIES,...BLACK_KNIGHT_ABILITIES,...MYSTIC_ABILITIES,...DESPAIR_ABILITIES,...DEMON_HUNTER_ABILITIES,...PARASITE_ABILITIES,...SECRETS_SORCERER_ABILITIES,...UNDYING_ABILITIES,...UNSHADOWED_ABILITIES,...CATACLYSM_PRIEST_ABILITIES,...PROPHET_ABILITIES,...NIGHTWATCHER_ABILITIES,...WITCH_KING_ABILITIES,...ALCHEMIST_ABILITIES,...MANIPULATOR_ABILITIES,...IRON_BLOOD_KNIGHT_ABILITIES,...BIZARRO_SORCERER_ABILITIES,...DRUID_ABILITIES,...PUNISHMENT_KNIGHT_ABILITIES,...MENTOR_DISORDER_ABILITIES,...WINNER_ABILITIES,...WRAITH_ABILITIES,...DESIRE_APOSTLE_ABILITIES,...SHEPHERD_ABILITIES,...STAR_MYSTIC_ABILITIES,...PAIN_ABILITIES,...GUARDIAN_ABILITIES,...DREAM_STEALER_ABILITIES,...TRAVELER_ABILITIES,...GATEKEEPER_ABILITIES,...PRIEST_OF_LIGHT_ABILITIES,...OCEAN_SINGER_ABILITIES,...MYSTICISM_MAGISTER_ABILITIES,...SPIRIT_WARLOCK_ABILITIES,...CRIMSON_SCHOLAR_ABILITIES,...ASTRONOMER_ABILITIES,...DREAMWALKER_ABILITIES,...REAPER_ABILITIES,...MARIONETTIST_ABILITIES,...BIOLOGIST_ABILITIES,...JUDGE_ABILITIES,...CORRUPTION_BARON_ABILITIES,...CALAMITY_PRIEST_ABILITIES,...ZOMBIE_ABILITIES,...DEMON_ABILITIES,...ROSE_BISHOP_ABILITIES,...SCROLL_PROFESSOR_ABILITIES,...PLEASURE_ABILITIES,...DAWN_PALADIN_ABILITIES,...FIRE_THIEF_ABILITIES,...RECORDER_ABILITIES,...SPIRIT_GUIDE_ABILITIES,...NOTARY_ABILITIES,...WIND_BLESSED_ABILITIES,...POLYMATH_ABILITIES,...SOOTHER_ABILITIES,...POTION_PROFESSOR_ABILITIES,...ARTISAN_ABILITIES,...HYPNOTIST_ABILITIES,...CONSPIRATOR_ABILITIES,...FACELESS_ABILITIES,...HARVESTPRIEST_ABILITIES,...PHYSICIAN_ABILITIES,...CULTIVATOR_ABILITIES,...INTERROGATOR_ABILITIES,...SHERIFF_ABILITIES,...ARBITER_ABILITIES,...BRIBER_ABILITIES,...BARBARIAN_ABILITIES,...LAWYER_ABILITIES,...LUCKY_ABILITIES,...MACHINE_ABILITIES,...MONSTER_ABILITIES,...WEREWOLF_ABILITIES,...MADMAN_ABILITIES,...PRISONER_ABILITIES,...SERIAL_KILLER_ABILITIES,...UNWINGED_ABILITIES,...CRIMINAL_ABILITIES,...SHADOW_ASCETIC_ABILITIES,...LISTENER_ABILITIES,...SECRET_SUPPLICANT_ABILITIES,...WIZARD_ABILITIES,...COMBAT_SCHOLAR_ABILITIES,...PRYER_ABILITIES,...WITCH_ABILITIES,...INSTIGATOR_ABILITIES,...ASSASSIN_ABILITIES,...WEAPONMASTER_ABILITIES,...GLADIATOR_ABILITIES,...WARRIOR_ABILITIES,...CRYPTOLOGIST_ABILITIES,...SWINDLER_ABILITIES,...MARAUDER_ABILITIES,...ASTROLOGER_ABILITIES,...TRICKMASTER_ABILITIES,...APPRENTICE_ABILITIES,...SPIRITMEDIUM_ABILITIES,...GRAVEDIGGER_ABILITIES,...CORPSECOLLECTOR_ABILITIES,...SUNPRIEST_ABILITIES,...LIGHTPRAYER_ABILITIES,...BARD_ABILITIES,...NAVIGATOR_ABILITIES,...RAGER_ABILITIES,...SAILOR_ABILITIES,...DETECTIVE_ABILITIES,...REASONER_ABILITIES,...READER_ABILITIES,...NIGHTMARE_ABILITIES,...MIDNIGHT_ABILITIES,...SLEEPLESS_ABILITIES,...VAMPIRE_ABILITIES,...APPRAISER_ABILITIES,...PSYCHOLOGIST_ABILITIES,...PYROMANIAC_ABILITIES,...MAGICIAN_ABILITIES,...TAMER_ABILITIES,...APOTHECARY_ABILITIES,...ARCHAEOLOGIST_ABILITIES,...SAVANT_ABILITIES,...SEER_ABILITIES,...CLOWN_ABILITIES,...HUNTER_ABILITIES,...AUDIENCE_ABILITIES,...MINDREADER_ABILITIES,...PROVOKER_ABILITIES].filter(ability => Object.hasOwn(s.progression.mastery, ability.id))
    .map(ability => ({ ...ability, value: s.progression.mastery[ability.id]!, weight: 5 - Math.floor(s.progression.mastery[ability.id]! / 100) }))
    .filter(ability => ability.weight > 0);
  const total = pool.reduce((sum, ability) => sum + ability.weight, 0);
  if (total === 0) return;
  let ticket = c.roll(1, total);
  const selected = pool.find(ability => { ticket -= ability.weight; return ticket <= 0; });
  rule(selected, '成长抽取结果无效。');
  const next = Math.min(500, selected.value + amount);
  s.progression.mastery[selected.id] = next;
  c.note('能力有了长进', `${selected.label}掌握度${selected.value}→${next}。本次${amount}点成长只分配给这一项已知能力${selected.value + amount > 500 ? '，超过500的部分作废' : ''}。`);
}

export function projectSeer(s: SliceState): SeerProjection {
  const actions: SeerAction[] = [];
  const add = (id: string, label: string, cost: string, command: Exclude<SeerCommand,{type:'PRACTICE'}|{type:'REFLECT'}>) => {
    const reason = commandBlock(s, command);
    actions.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  const isPromoted = promoted(s);
  if (!s.seer.discovered) {
    add('discover-seer', `拜访${SEER_GUIDE}`, '1行动 · 只建立渠道', { type: 'DISCOVER' });
  } else if (!s.seer.formulaKnown) {
    add('learn-seer-formula', '请指导者讲解配方', '1行动 · 120便士', { type: 'LEARN_FORMULA' });
  } else if (!isPromoted) {
    if (s.seer.resupply.requestedWeek !== null) {
      add('receive-seer-supply', '确认下一轮三批材料到货', `0行动 · 最早第${s.seer.resupply.requestedWeek + 1}周 · 必须跨过真实周末`, { type: 'RECEIVE_SUPPLY' });
    } else if (exhaustedSupply(s.seer)) {
      add('request-seer-supply', '向原指导者申请下一轮材料', '1行动 · 核对清单并准备存放 · 最早下一个真实周到货', { type: 'REQUEST_SUPPLY' });
    }
    for (const batch of s.seer.batches) {
      const number = batchNumber(batch);
      if (!batch.acquired) {
        if (batch.labourSteps < 2) add(`work-${batch.id}`, `第${number}批 · ${batch.labourSteps === 0 ? '抄录藏书目录' : '盘点备料'}`, `1行动 · 劳动${batch.labourSteps}/2，完成两步抵600便士主材费`, { type: 'MATERIAL_WORK', batchId: batch.id });
        add(`buy-${batch.id}`, `第${number}批 · 领取七项材料`, `0行动 · ${materialPrice(batch)}便士${batch.labourSteps === 2 ? '（主材费已抵扣，仅付五项辅材）' : '（主材600＋辅材60）'}`, { type: 'BUY_MATERIALS', batchId: batch.id });
      } else if (!batch.brewed) {
        add(`brew-${batch.id}`, `第${number}批 · 使用调配台`, '1行动 · 60便士 · 消耗本批全部材料', { type: 'BREW', batchId: batch.id });
      }
    }
  }
  if (s.seer.formulaKnown) {
    for (const bottle of s.seer.bottles) if (bottle.status === 'PREPARED') {
      add(`consume-${bottle.id}`, `服用第${batchNumber({ id: bottle.batchId })}批原瓶`, `0行动 · 独立确认 · 普通生活${ordinaryWeeks(s)}/4整周`, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    }
  }
  if (isPromoted && s.arc.stage !== 'ENDED') add('divine-first-case', '为已知首案准备预示', '1行动 · 3灵性 · 知识难度12 · 成功率' + computeCheckChance({ baseAbility: s.character.coreStats.knowledge, difficulty: 12, modifiers: [] }) + '%', { type: 'DIVINE', targetId: 'FIRST_CASE' });
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 5, modifiers: [] });
  const remaining = s.seer.batches.filter(batch => !batch.acquired).length;
  const prepared = s.seer.bottles.filter(bottle => bottle.status === 'PREPARED').length;
  return {
    practice:projectSeerPractice(s), title: isPromoted ? '占卜家 · 序列9' : s.seer.discovered ? '占卜家之路' : '非凡之路',
    discovered: s.seer.discovered, formulaKnown: s.seer.formulaKnown, promoted: isPromoted,
    formula: s.seer.formulaKnown ? SEER_FORMULA.map(({ name, quantity, unit }) => ({ name, quantity, unit })) : [],
    actions,
    bottles: s.seer.discovered ? s.seer.bottles.map(bottle => ({
      id: bottle.id,
      title: `第${batchNumber({ id: bottle.batchId })}批 · 占卜家魔药`,
      source: `${SEER_GUIDE}调配台，第${bottle.brewedWeek}周；仅由${bottle.batchId}的七项材料调配，原瓶${bottle.id}`,
      status: bottle.status === 'PREPARED' ? '已调配，尚未服用' : `已耗尽 · ${bottle.outcome === 'GREAT_SUCCESS' ? '大成功晋升' : bottle.outcome === 'SUCCESS' ? '成功晋升' : bottle.outcome === 'GREAT_FAILURE' ? '严重排异，中断晋升' : '排异，未晋升'}`,
      chance, command: { type: 'CONSUME', bottleId: bottle.id, confirmed: true },
    })) : [],
    abilities: isPromoted ? SEER_ABILITIES.filter(ability => Object.hasOwn(s.progression.mastery, ability.id)).map(ability => ({ ...ability, mastery: s.progression.mastery[ability.id]! })) : [],
    acting: !isPromoted?0:s.progression.sequence!==9?(s.clown.seerActingAtPromotion??100):s.progression.acting,
    digestion: isPromoted&&s.progression.sequence!==9?'占卜家魔药已消化，原有经历与四项能力保留。':!isPromoted ? `普通生活已完成${ordinaryWeeks(s)}/4整周；第5周起可在指导者面前服药。`
      : s.progression.acting >=100 ? '占卜家魔药已消化。掌握度仍按实际练习分别记录，可查看小丑晋升条件。' : s.progression.acting === 0 ? '刚刚服药，尚未积累有效扮演经历。' : `已留下扮演经历（${s.progression.acting}/100）。消化仍在进行；掌握度与扮演分别记录。`,
    pollution: s.seer.pollution,
    risk: s.seer.discovered ? `步骤：配方指导 → 采购或两步劳动后领取材料 → 调配 → 第5周起独立确认服药。每轮仅有3批，不自动补货；三批全已服用且失败后，可花1行动向原指导者申请下一轮，最早下一个真实周到货，材料与调配仍需原费用或劳动。供应方剩余${remaining}批，现有未服原瓶${prepared}瓶。${SEER_CONSUMPTION_RISK}${s.seer.omen && !s.seer.omen.used ? ' 当前保有一枚仅适用首案的预示。' : ''}` : '先接触可靠的指导者，了解获得配方与材料的办法。当前仍是普通人。',
  };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const shape = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).sort().join('|') === [...fields].sort().join('|');
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

/** Local save invariants: actual limited batches, their consumed ingredients and original bottles. */
export function validateSeerState(s: SliceState): boolean {
  const p: unknown = s.progression, raw: unknown = s.seer;
  if (!record(p) || !shape(p, ['pathwayId', 'sequence', 'mastery', 'acting', 'promotionWeek']) || !record(p.mastery) || !integer(p.acting, 0, 100)) return false;
  const isPromoted = p.pathwayId === 'diviner' && (p.sequence === 9||p.sequence === 8||p.sequence === 7||p.sequence === 6||p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))));
  const isSecretSupplicant=p.pathwayId==='hanged-man'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isSecretSupplicant&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...SECRET_SUPPLICANT_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?LISTENER_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?SHADOW_ASCETIC_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?ROSE_BISHOP_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?SHEPHERD_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?BLACK_KNIGHT_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?THREE_HEADED_TEMPLAR_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?ELDER_ABILITY_IDS:[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isMonster=p.pathwayId==='wheel'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isMonster&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...MONSTER_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?MACHINE_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?LUCKY_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?CALAMITY_PRIEST_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?WINNER_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?MISFORTUNE_MAGE_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?CHAOS_WALKER_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?FATE_PROPHET_ABILITY_IDS:[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isLawyer=p.pathwayId==='black-emperor'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isLawyer&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...LAWYER_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?BARBARIAN_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?BRIBER_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?CORRUPTION_BARON_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?MENTOR_DISORDER_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?FALLEN_EARL_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?FRENZY_MAGE_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?ENTROPY_DUKE_ABILITY_IDS:[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isArbiter=p.pathwayId==='justiciar'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isArbiter&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...ARBITER_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?SHERIFF_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?INTERROGATOR_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?JUDGE_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?PUNISHMENT_KNIGHT_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?IMPERATIVE_MAGE_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?CHAOS_HUNTER_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?BALANCER_ABILITY_IDS:[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isCultivator=p.pathwayId==='mother'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isCultivator&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...CULTIVATOR_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?PHYSICIAN_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?HARVESTPRIEST_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?BIOLOGIST_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?DRUID_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?ANCIENT_ALCHEMIST_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?COFFIN_BEARER_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?BARREN_MATRIARCH_ABILITIES.map(a=>a.id):[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isPrisoner=p.pathwayId==='chained'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isPrisoner&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...PRISONER_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?MADMAN_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?WEREWOLF_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?ZOMBIE_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?WRAITH_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?PUPPET_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?SILENT_DISCIPLE_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?ANCIENT_EVIL_ABILITY_IDS:[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isCriminal=p.pathwayId==='abyss'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isCriminal&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...CRIMINAL_ABILITIES.map(a=>a.id),...(p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?UNWINGED_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?SERIAL_KILLER_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?DEMON_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?DESIRE_APOSTLE_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?DEVIL_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?BLATHERER_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?BLOOD_DUKE_ABILITY_IDS:[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isPryer=p.pathwayId==='hermit'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isPryer&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...PRYER_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?COMBAT_SCHOLAR_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?WIZARD_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?SCROLL_PROFESSOR_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?STAR_MYSTIC_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?MYSTIC_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?PROPHECY_MASTER_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?SAGE_ABILITY_IDS:[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isAssassin=p.pathwayId==='demoness'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isAssassin&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...ASSASSIN_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?INSTIGATOR_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?WITCH_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?PLEASURE_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?PAIN_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?DESPAIR_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?UNAGING_DEMONESS_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?CALAMITY_DEMONESS_ABILITY_IDS:[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isWarrior=p.pathwayId==='warrior'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isWarrior&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...WARRIOR_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?GLADIATOR_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?WEAPONMASTER_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?DAWN_PALADIN_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?GUARDIAN_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?DEMON_HUNTER_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?SILVER_KNIGHT_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?GLORY_ABILITIES.map(a=>a.id):[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isMarauder=p.pathwayId==='error'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))));
  if(isMarauder&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...MARAUDER_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?SWINDLER_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))))?CRYPTOLOGIST_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||(p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?FIRE_THIEF_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?DREAM_STEALER_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?PARASITE_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?DECEIT_MENTOR_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?FATE_TROJAN_ABILITY_IDS:[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isApprentice=p.pathwayId==='door'&&(p.sequence===9||p.sequence===8||p.sequence===7||(p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))));
  if(isApprentice&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...APPRENTICE_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||(p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?TRICKMASTER_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||(p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))))?ASTROLOGER_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?RECORDER_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?TRAVELER_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?SECRETS_SORCERER_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?WANDERER_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?PLANESWALKER_ABILITIES.map(a=>a.id):[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isCorpsecollector=p.pathwayId==='death'&&(p.sequence===9||p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)));
  if(isCorpsecollector&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...CORPSECOLLECTOR_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?GRAVEDIGGER_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?SPIRITMEDIUM_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?SPIRIT_GUIDE_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?GATEKEEPER_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?UNDYING_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?FERRYMAN_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?DEATH_CONSUL_ABILITIES.map(a=>a.id):[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isBard=p.pathwayId==='sun'&&(p.sequence===9||p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)));
  if(isBard&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...BARD_ABILITIES.map(a=>a.id),...((p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?LIGHTPRAYER_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?SUNPRIEST_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?NOTARY_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?PRIEST_OF_LIGHT_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?UNSHADOWED_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?JUSTICE_MENTOR_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?LIGHT_SEEKER_ABILITIES.map(a=>a.id):[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isSailor=p.pathwayId==='tyrant'&&(p.sequence===9||p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)));
  if(isSailor&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...SAILOR_ABILITIES.map(a=>a.id),...(p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2))?RAGER_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?NAVIGATOR_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?WIND_BLESSED_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?OCEAN_SINGER_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?CATACLYSM_PRIEST_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?SEA_KING_ABILITIES.map(a=>a.id):[]),...(p.sequence===2?CATASTROPHE_ABILITIES.map(a=>a.id):[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isReader=p.pathwayId==='white-tower'&&(p.sequence===9||p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)));
  if(isReader&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...(p.sequence===2?WISDOM_ANGEL_ABILITIES.map(a=>a.id):[]),...READER_ABILITIES.map(a=>a.id),...(p.sequence!==9?REASONER_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?DETECTIVE_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?POLYMATH_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?MYSTICISM_MAGISTER_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?PROPHET_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?INSIGHT_SCHOLAR_ABILITIES.map(a=>a.id):[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isSleepless=p.pathwayId==='darkness'&&(p.sequence===9||p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)));
  if(isSleepless&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...(p.sequence===2?CONCEALMENT_SERVANT_ABILITIES.map(a=>a.id):[]),...SLEEPLESS_ABILITIES.map(a=>a.id),...(p.sequence!==9?MIDNIGHT_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?NIGHTMARE_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?SOOTHER_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?SPIRIT_WARLOCK_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?NIGHTWATCHER_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||p.sequence===2)?FEAR_BISHOP_ABILITIES.map(a=>a.id):[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isApothecary=p.pathwayId==='moon'&&(p.sequence===9||p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)));
  if(isApothecary&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...(p.sequence===2?LIFE_GIVER_ABILITIES:[]),...APOTHECARY_ABILITIES,...(p.sequence!==9?TAMER_ABILITIES:[]),...((p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?VAMPIRE_ABILITIES:[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?POTION_PROFESSOR_ABILITIES:[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?CRIMSON_SCHOLAR_ABILITIES:[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?WITCH_KING_ABILITIES:[]),...((p.sequence===3||p.sequence===2)?SUMMONING_MASTER_ABILITIES:[])].map(a=>a.id))||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isSavant=p.pathwayId==='paragon'&&(p.sequence===9||p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)));
  if(isSavant&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...(p.sequence===2?KNOWLEDGE_MENTOR_ABILITIES:[]),...SAVANT_ABILITIES,...(p.sequence!==9?ARCHAEOLOGIST_ABILITIES:[]),...((p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?APPRAISER_ABILITIES:[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?ARTISAN_ABILITIES:[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||p.sequence===2)))?ASTRONOMER_ABILITIES:[]),...((p.sequence===4||(p.sequence===3||p.sequence===2))?ALCHEMIST_ABILITIES:[]),...((p.sequence===3||p.sequence===2)?ARCANE_SCHOLAR_ABILITIES:[])].map(a=>a.id))||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isAudience=p.pathwayId==='audience'&&(p.sequence===9||p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))));
  if(isAudience&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...(p.sequence===1?WRITER_ABILITIES:[]),...((p.sequence===2||p.sequence===1)?DISCERNER_ABILITIES:[]),...AUDIENCE_ABILITIES,...(p.sequence!==9?MINDREADER_ABILITIES:[]),...((p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))))?PSYCHOLOGIST_ABILITIES:[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))))?HYPNOTIST_ABILITIES:[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))))?DREAMWALKER_ABILITIES:[]),...((p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1)))?MANIPULATOR_ABILITIES:[]),...((p.sequence===3||(p.sequence===2||p.sequence===1))?DREAM_WEAVER_ABILITIES:[])].map(a=>a.id))||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  const isHunter=p.pathwayId==='hunter'&&(p.sequence===9||p.sequence===8||p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))));
  if(isHunter&&(!integer(p.promotionWeek,5,s.week)||!shape(p.mastery,[...(p.sequence===1?CONQUEROR_ABILITIES.map(a=>a.id):[]),...((p.sequence===2||p.sequence===1)?WEATHER_WARLOCK_ABILITIES.map(a=>a.id):[]),...HUNTER_ABILITY_IDS,...(p.sequence!==9?PROVOKER_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))))?PYROMANIAC_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))))?CONSPIRATOR_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))))?REAPER_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1)))?IRON_BLOOD_KNIGHT_ABILITY_IDS:[]),...((p.sequence===3||(p.sequence===2||p.sequence===1))?WAR_BISHOP_ABILITIES.map(a=>a.id):[])])||!Object.values(p.mastery).every(v=>integer(v,0,500))))return false;
  if (!isPromoted && !isHunter && !isAudience && !isSavant && !isApothecary && !isSleepless && !isReader && !isSailor && !isBard && !isCorpsecollector && !isApprentice && !isMarauder && !isWarrior && !isAssassin && !isPryer && !isCultivator && !isArbiter && !isLawyer && !isMonster && !isCriminal && !isPrisoner && !isSecretSupplicant && (p.pathwayId !== null || p.sequence !== null || p.promotionWeek !== null || p.acting !== 0 || Object.keys(p.mastery).length !== 0)) return false;
  if (isPromoted && (!integer(p.promotionWeek, 5, s.week) || !shape(p.mastery, [...(p.sequence===1?ATTENDANT_MYSTERIES_ABILITIES.map(a=>a.id):[]),...SEER_ABILITY_IDS,...(p.sequence!==9?CLOWN_ABILITIES.map(a=>a.id):[]),...((p.sequence===7||p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))))?MAGICIAN_ABILITIES.map(a=>a.id):[]),...((p.sequence===6||p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))))?FACELESS_ABILITIES.map(a=>a.id):[]),...((p.sequence===5||(p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1))))?MARIONETTIST_ABILITIES.map(a=>a.id):[]),...((p.sequence===4||(p.sequence===3||(p.sequence===2||p.sequence===1)))?BIZARRO_SORCERER_ABILITIES.map(a=>a.id):[]),...((p.sequence===3||(p.sequence===2||p.sequence===1))?ANCIENT_SCHOLAR_ABILITIES.map(a=>a.id):[]),...((p.sequence===2||p.sequence===1)?MIRACLE_WORKER_ABILITIES.map(a=>a.id):[])]) || !Object.values(p.mastery).every(value => integer(value, 0, 500)))) return false;
  if (!record(raw) || !shape(raw, ['practice','discovered', 'formulaKnown', 'resupply', 'batches', 'bottles', 'pollution', 'omen', 'completedSources']) || typeof raw.discovered !== 'boolean' || typeof raw.formulaKnown !== 'boolean' || !integer(raw.pollution, 0, 100)) return false;
  if (!record(raw.resupply) || !shape(raw.resupply, ['requestedWeek', 'deliveries']) || !integer(raw.resupply.deliveries, 0, Math.max(0, s.week - 5)) || raw.resupply.requestedWeek !== null && !integer(raw.resupply.requestedWeek, 5, s.week)) return false;
  const deliveries = raw.resupply.deliveries as number;
  if (!Array.isArray(raw.batches) || raw.batches.length !== 3 * (deliveries + 1) || !Array.isArray(raw.bottles) || raw.bottles.length > raw.batches.length || !Array.isArray(raw.completedSources) || raw.completedSources.some(id => typeof id !== 'string' || id.length === 0 || id.length > 200) || new Set(raw.completedSources).size !== raw.completedSources.length) return false;
  if (raw.formulaKnown && !raw.discovered) return false;
  const seer = raw as unknown as SeerState;
  for (const [index, batch] of seer.batches.entries()) {
    if (!record(batch) || !shape(batch, ['id', 'materials', 'labourSteps', 'acquired', 'brewed']) || batch.id !== `seer-batch-${index + 1}` || !integer(batch.labourSteps, 0, 2) || typeof batch.acquired !== 'boolean' || typeof batch.brewed !== 'boolean' || !Array.isArray(batch.materials) || batch.materials.length !== 7) return false;
    if (batch.brewed && !batch.acquired || !seer.formulaKnown && (batch.acquired || batch.brewed || batch.labourSteps > 0)) return false;
    for (const [materialIndex, material] of batch.materials.entries()) {
      const expected = SEER_FORMULA[materialIndex]!;
      if (!record(material) || !shape(material, ['id', 'name', 'quantity', 'unit', 'source', 'holder']) || material.id !== `${batch.id}:${expected.id}` || material.name !== expected.name || material.unit !== expected.unit || typeof material.source !== 'string' || !material.source.length || material.source.length > 500) return false;
      if (material.quantity !== (batch.brewed ? 0 : expected.quantity) || material.holder !== (batch.brewed ? 'CONSUMED' : batch.acquired ? 'PLAYER' : 'SUPPLIER')) return false;
    }
    if (seer.bottles.filter(bottle => record(bottle) && bottle.batchId === batch.id).length !== (batch.brewed ? 1 : 0)) return false;
  }
  let successfulBottles = 0;
  for (const bottle of seer.bottles) {
    if (!record(bottle) || !shape(bottle, ['id', 'batchId', 'inputIds', 'brewedWeek', 'status', 'outcome']) || !integer(bottle.brewedWeek, 1, s.week) || !Array.isArray(bottle.inputIds)) return false;
    const batch = seer.batches.find(candidate => candidate.id === bottle.batchId);
    if (!batch || !batch.brewed || bottle.id !== bottleId(batch) || bottle.inputIds.length !== 7 || !bottle.inputIds.every((id, index) => id === batch.materials[index]!.id)) return false;
    if (bottle.status === 'PREPARED') { if (bottle.outcome !== null) return false; }
    else if (bottle.status === 'CONSUMED') { if (!['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(bottle.outcome as string) || s.week < 5) return false; }
    else return false;
    if (bottle.outcome === 'GREAT_SUCCESS' || bottle.outcome === 'SUCCESS') successfulBottles += 1;
  }
  if (!seer.batches.slice(0, deliveries * 3).every(batch => failedBatch(seer, batch))) return false;
  // Each later round can only be brewed after all three preceding bottles existed and a real week passed.
  let earliestRoundWeek = 5;
  for (let round = 0; round <= deliveries; round += 1) {
    const ids = new Set(seer.batches.slice(round * 3, round * 3 + 3).map(batch => batch.id));
    const bottles = seer.bottles.filter(bottle => ids.has(bottle.batchId));
    if (round > 0 && (s.week < earliestRoundWeek || bottles.some(bottle => bottle.brewedWeek < earliestRoundWeek))) return false;
    earliestRoundWeek = Math.max(earliestRoundWeek, ...bottles.map(bottle => bottle.brewedWeek)) + 1;
  }
  if (seer.resupply.requestedWeek !== null && (!seer.formulaKnown || isPromoted || !exhaustedSupply(seer) || seer.resupply.requestedWeek < Math.max(5 + deliveries, ...seer.bottles.map(bottle => bottle.brewedWeek)))) return false;
  if (successfulBottles !== (isPromoted ? 1 : 0) || !isPromoted && !isHunter && !isAudience && !isSavant && !isApothecary && !isSleepless && !isReader && !isSailor && !isBard && !isCorpsecollector && !isApprentice && !isMarauder && !isWarrior && !isAssassin && !isPryer && !isCultivator && !isArbiter && !isLawyer && !isMonster && !isCriminal && !isPrisoner && !isSecretSupplicant && seer.completedSources.length > 0 || seer.pollution > 0 && !s.writer?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.conqueror?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.fateProphet?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.fateProphet?.life.journal.length && !s.ancientEvil?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.ancientEvil?.life.journal.length && !s.bloodDuke?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.bloodDuke?.life.journal.length && !s.elder?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.elder?.life.journal.length && !s.sage?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.sage?.ritual.journal.length && !s.sage?.life.journal.length && !s.calamityDemoness?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.glory?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.fateTrojan?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.planeswalker?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.planeswalker?.ritual.visits.length && !s.planeswalker?.life.journal.length && !s.deathConsul?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.lightSeeker?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.catastrophe?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.wisdomAngel?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.concealmentServant?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.lifeGiver?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.weatherWarlock?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.miracleWorker?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.knowledgeMentor?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !s.discerner?.bottles.some(b=>b.outcome==='FAILURE'||b.outcome==='GREAT_FAILURE') && !seer.bottles.some(bottle => bottle.outcome === 'FAILURE' || bottle.outcome === 'GREAT_FAILURE')&&!s.clown?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.hunter?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.mindreader?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.audience?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.harvestpriest?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.physician?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.cultivator?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.interrogator?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.sheriff?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.arbiter?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.briber?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.barbarian?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.lawyer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.lucky?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.machine?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.monster?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.werewolf?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.madman?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.prisoner?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.serialKiller?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.unwinged?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.criminal?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.shadowAscetic?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.listener?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.secretSupplicant?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.wizard?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.combatScholar?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.pryer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.witch?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.instigator?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.assassin?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.weaponmaster?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.gladiator?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.warrior?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.cryptologist?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.swindler?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.marauder?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.astrologer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.trickmaster?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.apprentice?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.druid?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.punishmentKnight?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.mentorDisorder?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.winner?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.wraith?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.desireApostle?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.shepherd?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.starMystic?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.pain?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.guardian?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.dreamStealer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.traveler?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.gatekeeper?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.priestOfLight?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.oceanSinger?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.mysticismMagister?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.spiritWarlock?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.crimsonScholar?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.astronomer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.dreamwalker?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.reaper?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.cataclysmPriest?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.unshadowed?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.ferryman?.channels.some(channel=>channel.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE'))&&!s.justiceMentor?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.seaKing?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.insightScholar?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.fearBishop?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.summoningMaster?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.arcaneScholar?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.dreamWeaver?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.warBishop?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.miracleWorker?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.ancientScholar?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.coffinBearer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.ancientAlchemist?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.chaosHunter?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.imperativeMage?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.frenzyMage?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.fallenEarl?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.chaosWalker?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.misfortuneMage?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.silentDisciple?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.puppet?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.blatherer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.devil?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.threeHeadedTemplar?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.blackKnight?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.prophecyMaster?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.mystic?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.unagingDemoness?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.despair?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.silverKnight?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.demonHunter?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.deceitMentor?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.parasite?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.wanderer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!Object.values(s.wanderer.life.cases).some(r=>r.attempts.some(a=>a.pollutionAdded>0))&&!s.secretsSorcerer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.undying?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.prophet?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.nightwatcher?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.witchKing?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.alchemist?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.manipulator?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.ironBloodKnight?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.bizarroSorcerer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.marionettist?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.biologist?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.judge?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.corruptionBaron?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.calamityPriest?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.zombie?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.demon?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.roseBishop?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.scrollProfessor?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.pleasure?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.dawnPaladin?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.fireThief?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.recorder?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.spiritGuide?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.spiritmedium?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.gravedigger?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.corpsecollector?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.notary?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.sunpriest?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.lightprayer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.bard?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.windBlessed?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.navigator?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.rager?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.sailor?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.polymath?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.detective?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.reasoner?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.reader?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.soother?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.nightmare?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.midnight?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.sleepless?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.potionProfessor?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.vampire?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.artisan?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.appraiser?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.hypnotist?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.psychologist?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.conspirator?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.pyromaniac?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.faceless?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.magician?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.tamer?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.apothecary?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.archaeologist?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.savant?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')&&!s.provoker?.bottles.some(bottle=>bottle.outcome==='FAILURE'||bottle.outcome==='GREAT_FAILURE')) return false;
  if (seer.omen !== null && (!isPromoted || !record(seer.omen) || !shape(seer.omen, ['targetId', 'createdWeek', 'used']) || seer.omen.targetId !== 'FIRST_CASE' || !integer(seer.omen.createdWeek, p.promotionWeek as number, s.week) || typeof seer.omen.used !== 'boolean')) return false;
  return validateSeerPractice(s);
}
