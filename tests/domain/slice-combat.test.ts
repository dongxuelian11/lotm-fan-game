import {createElderState} from '../../src/domain/elder/index.js';
import {createSageState} from '../../src/domain/sage/index.js';
import {createCalamityDemonessState} from '../../src/domain/calamity-demoness/index.js';
import {createGloryState} from '../../src/domain/glory/index.js';
import {createFateTrojanState} from '../../src/domain/fate-trojan/index.js';
import {createPlaneswalkerState} from '../../src/domain/planeswalker/index.js';
import {createDeathConsulState} from '../../src/domain/death-consul/index.js';
import {createLightSeekerState} from '../../src/domain/light-seeker/index.js';
import {createCatastropheState} from '../../src/domain/catastrophe/index.js';
import {createWisdomAngelState} from '../../src/domain/wisdom-angel/index.js';
import {createConcealmentServantState} from '../../src/domain/concealment-servant/index.js';
import {createLifeGiverState} from '../../src/domain/life-giver/index.js';
import {createKnowledgeMentorState} from '../../src/domain/knowledge-mentor/index.js';
import {createDiscernerState} from '../../src/domain/discerner/index.js';
import {createWeatherWarlockState} from '../../src/domain/weather-warlock/index.js';
import {createMiracleWorkerState} from '../../src/domain/miracle-worker/index.js';
import {createCoffinBearerState} from '../../src/domain/coffin-bearer/index.js';
import {createChaosHunterState} from '../../src/domain/chaos-hunter/index.js';
import {createFrenzyMageState} from '../../src/domain/frenzy-mage/index.js';
import {createChaosWalkerState} from '../../src/domain/chaos-walker/index.js';
import {createSilentDiscipleState} from '../../src/domain/silent-disciple/index.js';
import {createBlathererState} from '../../src/domain/blatherer/index.js';
import {createThreeHeadedTemplarState} from '../../src/domain/three-headed-templar/index.js';
import {createProphecyMasterState} from '../../src/domain/prophecy-master/index.js';
import {createUnagingDemonessState} from '../../src/domain/unaging-demoness/index.js';
import {createSilverKnightState} from '../../src/domain/silver-knight/index.js';
import {createDeceitMentorState} from '../../src/domain/deceit-mentor/index.js';
import {createWandererState} from '../../src/domain/wanderer/index.js';
import {createFerrymanState} from '../../src/domain/ferryman/index.js';
import {createJusticeMentorState} from '../../src/domain/justice-mentor/index.js';
import {createSeaKingState} from '../../src/domain/sea-king/index.js';
import {createInsightScholarState} from '../../src/domain/insight-scholar/index.js';
import {createFearBishopState} from '../../src/domain/fear-bishop/index.js';
import {createSummoningMasterState} from '../../src/domain/summoning-master/index.js';
import {createArcaneScholarState} from '../../src/domain/arcane-scholar/index.js';
import {createDreamWeaverState} from '../../src/domain/dream-weaver/index.js';
import {createWarBishopState} from '../../src/domain/war-bishop/index.js';
import {createAncientScholarState} from '../../src/domain/ancient-scholar/index.js';
import {createLongChapterState} from '../../src/domain/long-chapter/index.js';
import {createAncientAlchemistState} from '../../src/domain/ancient-alchemist/index.js';
import {createImperativeMageState} from '../../src/domain/imperative-mage/index.js';
import {createFallenEarlState} from '../../src/domain/fallen-earl/index.js';
import {createMisfortuneMageState} from '../../src/domain/misfortune-mage/index.js';
import {createPuppetState} from '../../src/domain/puppet/index.js';
import {createDevilState} from '../../src/domain/devil/index.js';
import {createBlackKnightState} from '../../src/domain/black-knight/index.js';
import {createMysticState} from '../../src/domain/mystic/index.js';
import {createDespairState} from '../../src/domain/despair/index.js';
import {createDemonHunterState} from '../../src/domain/demon-hunter/index.js';
import {createParasiteState} from '../../src/domain/parasite/index.js';
import {createSecretsSorcererState} from '../../src/domain/secrets-sorcerer/index.js';
import {createUndyingState} from '../../src/domain/undying/index.js';
import {createUnshadowedState} from '../../src/domain/unshadowed/index.js';
import {createCataclysmPriestState} from '../../src/domain/cataclysm-priest/index.js';
import {createProphetState} from '../../src/domain/prophet/index.js';
import {createNightwatcherState} from '../../src/domain/nightwatcher/index.js';
import {createWitchKingState} from '../../src/domain/witch-king/index.js';
import {createAlchemistState} from '../../src/domain/alchemist/index.js';
import {createManipulatorState} from '../../src/domain/manipulator/index.js';
import {createIronBloodKnightState} from '../../src/domain/iron-blood-knight/index.js';
import {createBizarroSorcererState} from '../../src/domain/bizarro-sorcerer/index.js';
import {createDruidState} from '../../src/domain/druid/index.js';
import {createPunishmentKnightState} from '../../src/domain/punishment-knight/index.js';
import {createMentorDisorderState} from '../../src/domain/mentor-disorder/index.js';
import {createWinnerState} from '../../src/domain/winner/index.js';
import {createWraithState} from '../../src/domain/wraith/index.js';
import {createDesireApostleState} from '../../src/domain/desire-apostle/index.js';
import {createShepherdState} from '../../src/domain/shepherd/index.js';
import {createStarMysticState} from '../../src/domain/star-mystic/index.js';
import {createPainState} from '../../src/domain/pain/index.js';
import {createGuardianState} from '../../src/domain/guardian/index.js';
import {createDreamStealerState} from '../../src/domain/dream-stealer/index.js';
import {createTravelerState} from '../../src/domain/traveler/index.js';
import {createGatekeeperState} from '../../src/domain/gatekeeper/index.js';
import {createPriestOfLightState} from '../../src/domain/priest-of-light/index.js';
import {createOceanSingerState} from '../../src/domain/ocean-singer/index.js';
import {createMysticismMagisterState} from '../../src/domain/mysticism-magister/index.js';
import {createSpiritWarlockState} from '../../src/domain/spirit-warlock/index.js';
import {createCrimsonScholarState} from '../../src/domain/crimson-scholar/index.js';
import {createAstronomerState} from '../../src/domain/astronomer/index.js';
import {createDreamwalkerState} from '../../src/domain/dreamwalker/index.js';
import {createReaperState} from '../../src/domain/reaper/index.js';
import {createMarionettistState} from '../../src/domain/marionettist/index.js';
import {createBiologistState} from '../../src/domain/biologist/index.js';
import {createJudgeState} from '../../src/domain/judge/index.js';
import {createCorruptionBaronState} from '../../src/domain/corruption-baron/index.js';
import {createCalamityPriestState} from '../../src/domain/calamity-priest/index.js';
import {createZombieState} from '../../src/domain/zombie/index.js';
import {createDemonState} from '../../src/domain/demon/index.js';
import {createRoseBishopState} from '../../src/domain/rose-bishop/index.js';
import {createScrollProfessorState} from '../../src/domain/scroll-professor/index.js';
import {createPleasureState} from '../../src/domain/pleasure/index.js';
import {createDawnPaladinState} from '../../src/domain/dawn-paladin/index.js';
import {createFireThiefState} from '../../src/domain/fire-thief/index.js';
import {createRecorderState} from '../../src/domain/recorder/index.js';
import {createSpiritGuideState} from '../../src/domain/spirit-guide/index.js';
import {createNotaryState} from '../../src/domain/notary/index.js';
import {createWindBlessedState} from '../../src/domain/wind-blessed/index.js';
import {createPolymathState} from '../../src/domain/polymath/index.js';
import {createSootherState} from '../../src/domain/soother/index.js';
import {createPotionProfessorState} from '../../src/domain/potion-professor/index.js';
import {createArtisanState} from '../../src/domain/artisan/index.js';
import {createHypnotistState} from '../../src/domain/hypnotist/index.js';
import {createConspiratorState} from '../../src/domain/conspirator/index.js';
import {createFacelessState} from '../../src/domain/faceless/index.js';
import {createHarvestpriestState} from '../../src/domain/harvestpriest/index.js';
import {createPhysicianState} from '../../src/domain/physician/index.js';
import {createCultivatorState} from '../../src/domain/cultivator/index.js';
import {createInterrogatorState} from '../../src/domain/interrogator/index.js';
import {createSheriffState} from '../../src/domain/sheriff/index.js';
import {createArbiterState} from '../../src/domain/arbiter/index.js';
import {createBriberState} from '../../src/domain/briber/index.js';
import {createBarbarianState} from '../../src/domain/barbarian/index.js';
import {createLawyerState} from '../../src/domain/lawyer/index.js';
import {createLuckyState} from '../../src/domain/lucky/index.js';
import {createMachineState} from '../../src/domain/machine/index.js';
import {createMonsterState} from '../../src/domain/monster/index.js';
import {createWerewolfState} from '../../src/domain/werewolf/index.js';
import {createMadmanState} from '../../src/domain/madman/index.js';
import {createPrisonerState} from '../../src/domain/prisoner/index.js';
import {createSerialKillerState} from '../../src/domain/serial-killer/index.js';
import {createUnwingedState} from '../../src/domain/unwinged/index.js';
import {createCriminalState} from '../../src/domain/criminal/index.js';
import {createShadowAsceticState} from '../../src/domain/shadow-ascetic/index.js';
import {createListenerState} from '../../src/domain/listener/index.js';
import {createSecretSupplicantState} from '../../src/domain/secret-supplicant/index.js';
import {createWizardState} from '../../src/domain/wizard/index.js';
import {createCombatScholarState} from '../../src/domain/combat-scholar/index.js';
import {createPryerState} from '../../src/domain/pryer/index.js';
import {createWitchState} from '../../src/domain/witch/index.js';
import {createInstigatorState} from '../../src/domain/instigator/index.js';
import {createAssassinState} from '../../src/domain/assassin/index.js';
import {createWeaponmasterState} from '../../src/domain/weaponmaster/index.js';
import {createGladiatorState} from '../../src/domain/gladiator/index.js';
import {createWarriorState} from '../../src/domain/warrior/index.js';
import {createCryptologistState} from '../../src/domain/cryptologist/index.js';
import {createSwindlerState} from '../../src/domain/swindler/index.js';
import {createMarauderState} from '../../src/domain/marauder/index.js';
import {createAstrologerState} from '../../src/domain/astrologer/index.js';
import {createTrickmasterState} from '../../src/domain/trickmaster/index.js';
import {createApprenticeState} from '../../src/domain/apprentice/index.js';
import {createSpiritmediumState} from '../../src/domain/spiritmedium/index.js';
import {createGravediggerState} from '../../src/domain/gravedigger/index.js';
import {createCorpsecollectorState} from '../../src/domain/corpsecollector/index.js';
import {createSunpriestState} from '../../src/domain/sunpriest/index.js';
import {createLightprayerState} from '../../src/domain/lightprayer/index.js';
import {createBardState} from '../../src/domain/bard/index.js';
import {createNavigatorState} from '../../src/domain/navigator/index.js';
import {createRagerState} from '../../src/domain/rager/index.js';
import {createSailorState} from '../../src/domain/sailor/index.js';
import {createDetectiveState} from '../../src/domain/detective/index.js';
import {createReasonerState} from '../../src/domain/reasoner/index.js';
import {createReaderState} from '../../src/domain/reader/index.js';
import {createNightmareState} from '../../src/domain/nightmare/index.js';
import {createMidnightState} from '../../src/domain/midnight/index.js';
import {createSleeplessState} from '../../src/domain/sleepless/index.js';
import {createVampireState} from '../../src/domain/vampire/index.js';
import {createAppraiserState} from '../../src/domain/appraiser/index.js';
import {createPsychologistState} from '../../src/domain/psychologist/index.js';
import {createPyromaniacState} from '../../src/domain/pyromaniac/index.js';
import {createMagicianState} from '../../src/domain/magician/index.js';
import {createTamerState} from '../../src/domain/tamer/index.js';
import {createApothecaryState} from '../../src/domain/apothecary/index.js';
import {createArchaeologistState} from '../../src/domain/archaeologist/index.js';
import {createSavantState} from '../../src/domain/savant/index.js';
import {createTownState} from '../../src/domain/town/index.js';
import {createMindreaderState} from '../../src/domain/mindreader/index.js';
import {createAudienceState} from '../../src/domain/audience/index.js';
import {createProvokerState} from '../../src/domain/provoker/index.js';
import {createHunterState} from '../../src/domain/hunter/index.js';
import {createClownState} from '../../src/domain/clown/index.js';
import {emptyProgression,createSeerState} from '../../src/domain/seer/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { consequenceWeights, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  return {
    schemaVersion: 176, contentVersion: 'elder-v176',
    elder:createElderState(),sage:createSageState(),
    calamityDemoness:createCalamityDemonessState(), glory:createGloryState(), fateTrojan:createFateTrojanState(), planeswalker:createPlaneswalkerState(), deathConsul:createDeathConsulState(), lightSeeker:createLightSeekerState(), catastrophe:createCatastropheState(), wisdomAngel:createWisdomAngelState(), concealmentServant:createConcealmentServantState(), lifeGiver:createLifeGiverState(), knowledgeMentor:createKnowledgeMentorState(), discerner:createDiscernerState(), weatherWarlock:createWeatherWarlockState(), miracleWorker:createMiracleWorkerState(), coffinBearer:createCoffinBearerState(), chaosHunter:createChaosHunterState(), frenzyMage:createFrenzyMageState(), chaosWalker:createChaosWalkerState(), silentDisciple:createSilentDiscipleState(), blatherer:createBlathererState(), threeHeadedTemplar:createThreeHeadedTemplarState(), prophecyMaster:createProphecyMasterState(), unagingDemoness:createUnagingDemonessState(), silverKnight:createSilverKnightState(), deceitMentor:createDeceitMentorState(), wanderer:createWandererState(), ferryman:createFerrymanState(), justiceMentor:createJusticeMentorState(), seaKing:createSeaKingState(), insightScholar:createInsightScholarState(), fearBishop:createFearBishopState(), summoningMaster:createSummoningMasterState(), arcaneScholar:createArcaneScholarState(), dreamWeaver:createDreamWeaverState(), warBishop:createWarBishopState(), ancientScholar:createAncientScholarState(), longChapter:createLongChapterState(), ancientAlchemist:createAncientAlchemistState(), imperativeMage:createImperativeMageState(), fallenEarl:createFallenEarlState(), misfortuneMage:createMisfortuneMageState(), puppet:createPuppetState(), devil:createDevilState(), blackKnight:createBlackKnightState(), mystic:createMysticState(), despair:createDespairState(), demonHunter:createDemonHunterState(), parasite:createParasiteState(), secretsSorcerer:createSecretsSorcererState(), undying:createUndyingState(), unshadowed:createUnshadowedState(), cataclysmPriest:createCataclysmPriestState(), prophet:createProphetState(), nightwatcher:createNightwatcherState(), witchKing:createWitchKingState(), alchemist:createAlchemistState(), manipulator:createManipulatorState(), ironBloodKnight:createIronBloodKnightState(), bizarroSorcerer:createBizarroSorcererState(), druid:createDruidState(), punishmentKnight:createPunishmentKnightState(), mentorDisorder:createMentorDisorderState(), winner:createWinnerState(), wraith:createWraithState(), desireApostle:createDesireApostleState(), shepherd:createShepherdState(), starMystic:createStarMysticState(), pain:createPainState(), guardian:createGuardianState(), dreamStealer:createDreamStealerState(), traveler:createTravelerState(), gatekeeper:createGatekeeperState(), priestOfLight:createPriestOfLightState(), oceanSinger:createOceanSingerState(), mysticismMagister:createMysticismMagisterState(), spiritWarlock:createSpiritWarlockState(), crimsonScholar:createCrimsonScholarState(), astronomer:createAstronomerState(), dreamwalker:createDreamwalkerState(), reaper:createReaperState(), marionettist:createMarionettistState(), biologist:createBiologistState(), judge:createJudgeState(), corruptionBaron:createCorruptionBaronState(), calamityPriest:createCalamityPriestState(), zombie:createZombieState(), demon:createDemonState(), roseBishop:createRoseBishopState(), scrollProfessor:createScrollProfessorState(), pleasure:createPleasureState(), dawnPaladin:createDawnPaladinState(), fireThief:createFireThiefState(), recorder:createRecorderState(), spiritGuide:createSpiritGuideState(), notary:createNotaryState(), windBlessed:createWindBlessedState(), polymath:createPolymathState(), soother:createSootherState(), potionProfessor:createPotionProfessorState(), artisan:createArtisanState(), hypnotist:createHypnotistState(), conspirator:createConspiratorState(), faceless:createFacelessState(), harvestpriest:createHarvestpriestState(), physician:createPhysicianState(), cultivator:createCultivatorState(), interrogator:createInterrogatorState(), sheriff:createSheriffState(), arbiter:createArbiterState(), briber:createBriberState(), barbarian:createBarbarianState(), lawyer:createLawyerState(), lucky:createLuckyState(), machine:createMachineState(), monster:createMonsterState(), werewolf:createWerewolfState(), madman:createMadmanState(), prisoner:createPrisonerState(), serialKiller:createSerialKillerState(), unwinged:createUnwingedState(), criminal:createCriminalState(), shadowAscetic:createShadowAsceticState(), listener:createListenerState(), secretSupplicant:createSecretSupplicantState(), wizard:createWizardState(), combatScholar:createCombatScholarState(), pryer:createPryerState(), witch:createWitchState(), instigator:createInstigatorState(), assassin:createAssassinState(), weaponmaster:createWeaponmasterState(), gladiator:createGladiatorState(), warrior:createWarriorState(), cryptologist:createCryptologistState(), swindler:createSwindlerState(), marauder:createMarauderState(), astrologer:createAstrologerState(), trickmaster:createTrickmasterState(), apprentice:createApprenticeState(), spiritmedium:createSpiritmediumState(), gravedigger:createGravediggerState(), corpsecollector:createCorpsecollectorState(), sunpriest:createSunpriestState(), lightprayer:createLightprayerState(), bard:createBardState(), navigator:createNavigatorState(), rager:createRagerState(), sailor:createSailorState(), detective:createDetectiveState(), reasoner:createReasonerState(), reader:createReaderState(), nightmare:createNightmareState(), midnight:createMidnightState(), sleepless:createSleeplessState(), vampire:createVampireState(), appraiser:createAppraiserState(), psychologist:createPsychologistState(), pyromaniac:createPyromaniacState(), magician:createMagicianState(), tamer:createTamerState(), apothecary:createApothecaryState(), archaeologist:createArchaeologistState(), savant:createSavantState(), town:createTownState(), mindreader:createMindreaderState(), audience:createAudienceState(), provoker:createProvokerState(), hunter:createHunterState(), clown:createClownState(), caseArchive:[], progression:emptyProgression(), seer:createSeerState(), runId: 'combat-test', revision: 8, status: 'ACTIVE',
    character: { name: '测试角色', portraitId: '1', originId: '1', originName: '测试', professionId: '1',
      professionName: '测试', age: 22, gender: '男', education: '普通', learningBonus: 0, weeklyWage: 10,
      coreStats: { physique: 15, perception: 15, will: 15, knowledge: 15 }, birthplace:{id:'test',label:'测试'}, appearanceDescription:'普通外观', traits:[{id:'t1',label:'勤勉'},{id:'t2',label:'警觉'}],flaw:{id:'f1',label:'畏缩'},acceptedConditionIds:[],creationCosts:{professionInitialPence:20,familyTransferPence:0,conditionCostPence:0,educationCostPence:0} },
    week: 1, date: { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 }, actionsRemaining: 2, weeklyBudget: 3, wagePaidWeek: null,
    cash: 20, lifeTier: 'ORDINARY', nextLifeTier: 'ORDINARY', health: 100, mind: 100, spirituality: 15,
    injuries: [], injuryRisk: 0, debts: [], missedWeeks: 0, credit: 'NORMAL', knownTargets: [], completedTopics: [],
    knowledge: [], chronicle: [], activeEvent: null, eventQueue: [], pulse: 'NONE', billAmount: 0,
    lastMedicalInviteWeek: null, aid: 'NONE', aidInjuryIds: [], marketUnlocked: false, careKnown: false,
    arc: { stage: 'COMBAT', startWeek: 1, completedAWeek: 1, bPaid: false, managementAlert: 0, immediateTransferPrevented:false, originalLedger: false,
      credibleWitness: false, fullCrossLedger: false, necessaryCrossLedger: false, reportWeek: null, credibleReport: false,
      crisis: false, workers: null, accountability: null, hazard: null, relationship: 'NO_RELATION', transferPending: false },
    world: { city: 'BACKLUND', messageChannel: true, audrey: 'AVAILABLE', intermediaryAvailable: true,
      maeveAvailable: true, manager: 'ACTIVE', successorRegistered: false, organizationAvailable: true,
      organizationEligible: false, organizationArrived: false, bell: 'ACTIVE', bellHolder: 'CARRIER', bellAtScene: true,
      bellFactKnown: true, transferKnown: false, carrierAlive: true, carrierCanResist: true, destructionSource: null,
      responsibilityEvidence: false, recordsAvailable: true, careAvailable: true, aidBatchAvailable: true },
    combat: { encounterId:'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0,
      enemyStatus: 'RESISTING', lastRound: null },
    lastCombatRound: null, combatHistory:[], lastCheck: null, lastResult: null, ending: null, random: { seed: 'ordinary-round', cursor: 0 },
  };
}

/** Keep the production cursor advancing while prescribing audited wheel results. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, minimum, maximum) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum);
    expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}

afterEach(() => vi.restoreAllMocks());

describe('ordinary combat wheels', () => {
  it('keeps the independently sampled 45/40/15 ordinary count template', () => {
    expect(ORDINARY_COUNT_WHEEL.map(({ weight }) => weight)).toEqual([45, 40, 15]);
    expect(ORDINARY_COUNT_WHEEL.reduce((sum, entry) => sum + Number(entry.id) * entry.weight / 100, 0)).toBeCloseTo(1.7);
  });

  it('normalizes exactly ×1.25, with all five abilities remaining legal', () => {
    const attack = ordinaryAbilityWheel(false, 'ATTACK');
    expect(attack.map(({ weight }) => weight)).toEqual([50 / 110 * 100, 20 / 110 * 100, 20 / 110 * 100, 15 / 110 * 100, 5 / 110 * 100]);
    const defend = ordinaryAbilityWheel(false, 'DEFEND');
    expect(defend.map(({ weight }) => weight)).toEqual([40 / 105 * 100, 25 / 105 * 100, 20 / 105 * 100, 15 / 105 * 100, 5 / 105 * 100]);
    expect(defend.every(({ weight }) => weight > 0)).toBe(true);
    expect(defend.reduce((sum, entry) => sum + entry.weight, 0)).toBeCloseTo(100);
  });

  it('does not invent control/preparation categories or an armed probability bonus', () => {
    const neutral = ordinaryAbilityWheel(false, null);
    for (const stance of ['CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(ordinaryAbilityWheel(false, stance)).toEqual(neutral);
    }
    expect(ordinaryAbilityWheel(true, null).map(({ weight }) => weight)).toEqual([40, 20, 20, 15, 5]);
    expect(ordinaryAbilityWheel(true, null)[0]?.label).toBe('短棍打击');
    neutral[0]!.weight = 0;
    expect(ordinaryAbilityWheel(false, null)[0]?.weight).toBe(40);
  });

  it.each([
    [0, 65, 30, 5], [1, 55, 30, 15], [2, 45, 30, 25], [6, 5, 30, 65],
    [7, 0, 25, 75], [9, 0, 5, 95], [10, 0, 0, 100], [1000, 0, 0, 100],
  ])('shifts risk k=%i from light first and then heavy', (k, light, heavy, death) => {
    expect(consequenceWeights(k)).toEqual({ light, heavy, death });
  });
  it.each([-1, 0.5, NaN, Infinity])('rejects invalid risk %s', (risk) => {
    expect(() => consequenceWeights(risk)).toThrow();
  });
});

describe('ordinary duel round resolution', () => {
  it('draws both counts independently and alternates actions until each count is consumed', () => {
    const state = fixture();
    // player 3 / enemy 2; all strikes; player wins and the enemy takes light injury.
    const draws = scriptRolls(86, 85, 1, 1, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCountRoll).toBe(86);
    expect(round.enemyCountRoll).toBe(85);
    expect([round.playerCount, round.enemyCount]).toEqual([3, 2]);
    expect(round.moves.map(({ actor }) => actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.playerAdvantage).toBe(151);
    expect(round.enemyAdvantage).toBe(146);
    expect(round.winChance).toBeCloseTo(151 / 297 * 100);
    expect(outcome).toBe('CONTINUE');
    expect(state.combat?.enemyHealth).toBe(90);
    expect(state.combat?.enemyRisk).toBe(0);
    expect(state.health).toBe(100);
    expect(state.random.cursor).toBe(9);
    expect(draws).toHaveBeenCalledTimes(9);
    expect(state.combat?.round).toBe(2);
    expect(state.combat?.lastRound).toBe(round);
    expect(state.lastCombatRound).toBe(round);
    expect(state.revision).toBe(8);
    expect(state.arc.stage).toBe('COMBAT');
  });

  it('swaps the first actor every round and uses the actual armed/unarmed strike effects', () => {
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(45, 45, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY');
    expect(round.moves.map(({ actor, selfGain }) => [actor, selfGain])).toEqual([['ENEMY', 16], ['PLAYER', 12]]);
  });

  it('accumulates effects only for the current round without applying strike health damage twice', () => {
    const state = fixture();
    // 3 actions each: player strike/block/opening, enemy block/distance/miss.
    scriptRolls(86, 86, 1, 161, 201, 321, 281, 400, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(117); // 115 + 12 + 8 - 10 - 8
    expect(round.enemyAdvantage).toBe(104); // 114 - 10
    expect(state.health).toBe(100);
    expect(state.combat!.enemyHealth).toBe(90);
    expect(state.combat!.enemyInjuries).toHaveLength(1);
    vi.restoreAllMocks();
    // Both miss next round; no earlier attack/contribution carries over.
    scriptRolls(1, 1, 400, 440, 1);
    const next = resolveSliceCombatRound(state, 'ATTACK');
    expect(next.round.playerAdvantage).toBe(115);
    expect(next.round.enemyAdvantage).toBe(114);
    expect(next.round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(90);
  });

  it('does not create wounds or a consequence draw from a non-damaging winning move', () => {
    const state = fixture();
    scriptRolls(1, 1, 201, 161, 1);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.round.winner).toBe('PLAYER');
    expect(result.round.consequenceWeights).toBeNull();
    expect(result.outcome).toBe('CONTINUE');
    expect(state.combat!.enemyInjuries).toEqual([]);
    expect(state.random.cursor).toBe(5);
  });

  it('persists injuries and increases risk only when the defeated actor was already injured', () => {
    const state = fixture();
    for (const k of [0, 1, 2]) {
      // Actor order alternates; both strike so either can be injured.
      scriptRolls(1, 1, 1, 1, 1_000_000, 1);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe('CONTINUE');
      expect(result.round.consequenceWeights?.death).toBe(5 + k * 10);
      expect(state.injuryRisk).toBe(k);
      expect(state.injuries).toHaveLength(k + 1);
      expect(state.health).toBe(90 - k * 10);
      expect(state.combat!.enemyRisk).toBe(0);
      expect(state.injuries[k]).toMatchObject({ severity: 'LIGHT', acquiredRevision: 9, treatedRevision: null });
      vi.restoreAllMocks();
    }
    expect(new Set(state.injuries.map(({ id }) => id)).size).toBe(3);
  });

  it('treatment and restored current health do not erase existing injury risk', () => {
    const state = fixture();
    state.injuries = [{ id: 'old', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    state.injuryRisk = 2;
    scriptRolls(1, 1, 1, 1, 1_000_000, 1);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.round.consequenceWeights?.death).toBe(35);
    expect(state.injuryRisk).toBe(3);
    expect(state.injuries[0]?.treatedRevision).toBe(2);
  });

  it('makes a surviving enemy surrender only after applying its heavy injury', () => {
    const state = fixture();
    scriptRolls(1, 1, 1, 400, 1, 66);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('ENEMY_SURRENDERED');
    expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED', enemyRisk: 0 });
    expect(state.combat!.enemyInjuries[0]?.severity).toBe('HEAVY');
    expect(result.round.consequence).toContain('投降');
  });

  it.each(['PLAYER', 'ENEMY'] as const)('performs true final death for %s with no invented saves', (loser) => {
    const state = fixture();
    scriptRolls(1, 1, 1, 1, loser === 'PLAYER' ? 1_000_000 : 1, 96);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe(`${loser}_DEAD`);
    expect(loser === 'PLAYER' ? state.health : state.combat!.enemyHealth).toBe(0);
    expect(state.random.cursor).toBe(6);
    expect(result.round.consequence).toContain('最终死亡');
    // The caller owns run finalization and world continuity.
    expect(state.status).toBe('ACTIVE');
    expect(state.ending).toBeNull();
  });

  it.each(['PLAYER', 'ENEMY'] as const)('treats health zero after ordinary injury as %s final death', (loser) => {
    const state = fixture();
    if (loser === 'PLAYER') state.health = 10;
    else state.combat!.enemyHealth = 30;
    scriptRolls(1, 1, 1, 1, loser === 'PLAYER' ? 1_000_000 : 1, loser === 'PLAYER' ? 1 : 66);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe(`${loser}_DEAD`);
    if (loser === 'ENEMY') expect(state.combat!.enemyStatus).toBe('DEAD');
    expect(result.round.consequence).not.toContain('投降');
  });

  it('uses capped ordinary core and resource-state penalties without double-counting injury tags', () => {
    const state = fixture();
    state.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    state.health = 50; state.mind = 25; state.spirituality = 3;
    state.injuries = [{ id: 'old', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    scriptRolls(1, 1, 440, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(72); // (100 + cap 20) × (1 - cap 40%)
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(4.5); // one complete continuing round
  });

  it('replays the exact result and stream cursor after serialization without Math.random', () => {
    const state = fixture(); state.random.cursor = 5;
    const duplicate = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'DEFEND')).toEqual(resolveSliceCombatRound(duplicate, 'DEFEND'));
    expect(state).toEqual(duplicate);
    expect(state.random.cursor).toBeGreaterThan(5);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('rejects an ended encounter without consuming randomness or changing state', () => {
    const state = fixture(); state.combat!.enemyStatus = 'SURRENDERED';
    const before = structuredClone(state);
    expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow();
    expect(state).toEqual(before);
  });
});

describe('ordinary retreat', () => {
  it('spends all player actions and immediately exits on a 50% success without attacks or injury', () => {
    const state = fixture(); state.spirituality = 5;
    scriptRolls(86, 86, 50);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED');
    expect(result.round.retreat).toBe('SUCCESS');
    expect(result.round.winner).toBe('ENEMY');
    expect(result.round.moves).toEqual([]);
    expect(result.round.consequenceWeights).toBeNull();
    expect(state.health).toBe(100);
    expect(state.spirituality).toBe(5);
    expect(state.random.cursor).toBe(3);
  });

  it('checks retreat at the first player turn, including after an enemy-first action', () => {
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(86, 86, 1, 50);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED');
    expect(result.round.moves).toHaveLength(1);
    expect(result.round.moves[0]?.actor).toBe('ENEMY');
    expect(state.health).toBe(100);
    expect(state.injuries).toEqual([]);
    expect(state.random.cursor).toBe(4);
  });

  it('does not attack after failure and still resolves the normal loss and injury', () => {
    const state = fixture();
    scriptRolls(86, 45, 51, 1, 1_000_000, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('CONTINUE');
    expect(result.round.retreat).toBe('FAILURE');
    expect(result.round.moves.map(({ actor }) => actor)).toEqual(['ENEMY']);
    expect(result.round.winner).toBe('ENEMY');
    expect(state.health).toBe(90);
    expect(state.injuries).toHaveLength(1);
  });

  it('does not manufacture enemy wounds if the failed retreat still wins the round', () => {
    const state = fixture();
    scriptRolls(1, 1, 51, 1, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('CONTINUE');
    expect(result.round.winner).toBe('PLAYER');
    expect(result.round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(100);
    expect(state.random.cursor).toBe(5);
  });
});

describe('injured resolved losses count independently of immediate threat',()=>{
 it.each(['PLAYER','ENEMY'] as const)('increments %s risk on harmless loss without a wound or consequence draw',loser=>{
   const state=fixture();
   const injury={id:'existing',severity:'LIGHT' as const,acquiredRevision:1,treatedRevision:null};
   if(loser==='PLAYER'){state.injuries=[injury];state.injuryRisk=1;state.health=90;}
   else{state.combat!.enemyInjuries=[injury];state.combat!.enemyRisk=1;state.combat!.enemyHealth=90;}
   const draws=scriptRolls(1,1,440,400,loser==='PLAYER'?1_000_000:1);
   const result=resolveSliceCombatRound(state,'ATTACK');
   expect(result.outcome).toBe('CONTINUE');
   expect(loser==='PLAYER'?state.injuryRisk:state.combat!.enemyRisk).toBe(2);
   expect(loser==='PLAYER'?state.health:state.combat!.enemyHealth).toBe(90);
   expect(loser==='PLAYER'?state.injuries:state.combat!.enemyInjuries).toHaveLength(1);
   expect(result.round.consequenceWeights).toBeNull();
   expect(result.round.consequence).toContain('累计风险增加至2');
   expect(result.round.consequence).toContain('35%');
   expect(draws).toHaveBeenCalledTimes(5);
 });
 it('does not turn a harmless loss into death even when accumulated risk exceeds the death cap',()=>{
   const state=fixture();state.injuries=[{id:'old',severity:'HEAVY',acquiredRevision:1,treatedRevision:2}];state.injuryRisk=10;
   scriptRolls(1,1,440,400,1_000_000);
   const result=resolveSliceCombatRound(state,'ATTACK');
   expect(state.injuryRisk).toBe(11);expect(state.health).toBe(100);expect(result.outcome).toBe('CONTINUE');expect(result.round.consequenceWeights).toBeNull();
 });
 it('persists harmless-loss risk across replay, and a following actual loss uses the incremented risk',()=>{
   const state=fixture();state.injuries=[{id:'old',severity:'LIGHT',acquiredRevision:1,treatedRevision:null}];state.health=90;
   const original=structuredClone(state);
   scriptRolls(1,1,440,400,1_000_000);resolveSliceCombatRound(state,'ATTACK');vi.restoreAllMocks();
   scriptRolls(1,1,440,400,1_000_000);resolveSliceCombatRound(original,'ATTACK');vi.restoreAllMocks();
   expect(original).toEqual(state);expect(state.injuryRisk).toBe(1);
   const saved=JSON.parse(JSON.stringify(state)) as SliceState;
   scriptRolls(1,1,1,1,1_000_000,1);const next=resolveSliceCombatRound(saved,'ATTACK');
   expect(next.round.consequenceWeights?.death).toBe(25);expect(saved.injuryRisk).toBe(2);expect(saved.health).toBe(80);
 });
 it('successful retreat is not a resolved injured loss and leaves k unchanged',()=>{
   const state=fixture();state.injuries=[{id:'old',severity:'LIGHT',acquiredRevision:1,treatedRevision:null}];state.injuryRisk=3;
   scriptRolls(1,1,1);const result=resolveSliceCombatRound(state,'RETREAT');
   expect(result.outcome).toBe('RETREATED');expect(state.injuryRisk).toBe(3);expect(state.health).toBe(100);
 });
 it('true healing still clears risk accumulated through harmless defeats',()=>{
   const state=fixture();state.injuries=[{id:'old',severity:'LIGHT',acquiredRevision:1,treatedRevision:null}];state.injuryRisk=3;state.health=90;
   scriptRolls(1,1,440,400,1_000_000);resolveSliceCombatRound(state,'ATTACK');vi.restoreAllMocks();
   expect(state.injuryRisk).toBe(4);state.combat=null;state.arc.stage='NOT_STARTED';
   const healed=applySliceIntent(state,{type:'ACTION',action:'REST'});
   expect(healed.injuries).toEqual([]);expect(healed.injuryRisk).toBe(0);expect(healed.health).toBe(100);
 });
});
