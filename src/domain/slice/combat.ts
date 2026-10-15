import { resolvePaleEmperorCombatRound } from './pale-emperor-combat.js';
import { isPaleEmperor, paleEmperorAbilityWheel, PALE_EMPEROR_COUNT_WHEEL } from '../pale-emperor/combat.js';
import { resolvePureWhiteAngelCombatRound } from './pure-white-angel-combat.js';
import { isPureWhiteAngel, pureWhiteAngelAbilityWheel, PURE_WHITE_ANGEL_COUNT_WHEEL } from '../pure-white-angel/combat.js';
import { resolveThunderGodCombatRound } from './thunder-god-combat.js';
import { isThunderGod, thunderGodAbilityWheel, THUNDER_GOD_COUNT_WHEEL } from '../thunder-god/combat.js';
import { resolveTimeWormCombatRound } from './time-worm-combat.js';
import { resolveStarKeyCombatRound } from './star-key-combat.js';
import { resolveAllKnowingEyeCombatRound } from './all-knowing-eye-combat.js';
import { isTimeWorm, timeWormAbilityWheel, TIME_WORM_COUNT_WHEEL } from '../time-worm/combat.js';
import { isStarKey, starKeyAbilityWheel, STAR_KEY_COUNT_WHEEL } from '../star-key/combat.js';
import { isAllKnowingEye, allKnowingEyeAbilityWheel, ALL_KNOWING_EYE_COUNT_WHEEL } from '../all-knowing-eye/combat.js';
import { resolveMisfortuneKnightCombatRound } from './misfortune-knight-combat.js';
import { isMisfortuneKnight, misfortuneKnightAbilityWheel, MISFORTUNE_KNIGHT_COUNT_WHEEL } from '../misfortune-knight/combat.js';
import { resolveBeautyGoddessCombatRound } from './beauty-goddess-combat.js';
import { isBeautyGoddess, beautyGoddessAbilityWheel, BEAUTY_GODDESS_COUNT_WHEEL } from '../beauty-goddess/combat.js';
import { resolveCivilizationEnlightenerCombatRound } from './civilization-enlightener-combat.js';
import { isCivilizationEnlightener, civilizationEnlightenerAbilityWheel, CIVILIZATION_ENLIGHTENER_COUNT_WHEEL } from '../civilization-enlightener/combat.js';
import { resolveWriterCombatRound } from './writer-combat.js';
import { isWriter, writerAbilityWheel, WRITER_COUNT_WHEEL } from '../writer/combat.js';
import { resolveConquerorCombatRound } from './conqueror-combat.js';
import { isConqueror, conquerorAbilityWheel, CONQUEROR_COUNT_WHEEL } from '../conqueror/combat.js';
import { resolveAttendantMysteriesCombatRound } from './attendant-mysteries-combat.js';
import { isAttendantMysteries, attendantMysteriesAbilityWheel, ATTENDANT_MYSTERIES_COUNT_WHEEL } from '../attendant-mysteries/combat.js';
import { resolveBarrenMatriarchCombatRound } from './barren-matriarch-combat.js';
import { resolveBalancerCombatRound } from './balancer-combat.js';
import { resolveEntropyDukeCombatRound } from './entropy-duke-combat.js';
import { isBarrenMatriarch, barrenMatriarchAbilityWheel, BARREN_MATRIARCH_COUNT_WHEEL } from '../barren-matriarch/combat.js';
import { isBalancer, balancerAbilityWheel, BALANCER_COUNT_WHEEL } from '../balancer/combat.js';
import { isEntropyDuke, entropyDukeAbilityWheel, ENTROPY_DUKE_COUNT_WHEEL } from '../entropy-duke/combat.js';
import { resolveFateProphetCombatRound } from './fate-prophet-combat.js';
import { isFateProphet, fateProphetAbilityWheel, FATE_PROPHET_COUNT_WHEEL } from '../fate-prophet/combat.js';
import { resolveAncientEvilCombatRound } from './ancient-evil-combat.js';
import { isAncientEvil, ancientEvilAbilityWheel, ANCIENT_EVIL_COUNT_WHEEL } from '../ancient-evil/combat.js';
import { resolveBloodDukeCombatRound } from './blood-duke-combat.js';
import { isBloodDuke, bloodDukeAbilityWheel, BLOOD_DUKE_COUNT_WHEEL } from '../blood-duke/combat.js';
import { resolveElderCombatRound } from './elder-combat.js';
import { isElder, elderAbilityWheel, ELDER_COUNT_WHEEL } from '../elder/combat.js';
import { resolveSageCombatRound } from './sage-combat.js';
import { resolveCalamityDemonessCombatRound } from './calamity-demoness-combat.js';
import { resolveGloryCombatRound } from './glory-combat.js';
import {resolveFateTrojanCombatRound} from './fate-trojan-combat.js';
import {resolvePlaneswalkerCombatRound} from './planeswalker-combat.js';
import {resolveDeathConsulCombatRound} from './death-consul-combat.js';
import {resolveLightSeekerCombatRound} from './light-seeker-combat.js';
import {resolveCatastropheCombatRound} from './catastrophe-combat.js';
import {resolveWisdomAngelCombatRound} from './wisdom-angel-combat.js';
import {resolveConcealmentServantCombatRound} from './concealment-servant-combat.js';
import {resolveLifeGiverCombatRound} from './life-giver-combat.js';
import {resolveKnowledgeMentorCombatRound} from './knowledge-mentor-combat.js';
import { isSage, sageAbilityWheel, SAGE_COUNT_WHEEL } from '../sage/combat.js';
import { isCalamityDemoness, calamityDemonessAbilityWheel, CALAMITY_DEMONESS_COUNT_WHEEL } from '../calamity-demoness/combat.js';
import { isGlory, gloryAbilityWheel, GLORY_COUNT_WHEEL } from '../glory/combat.js';
import {isFateTrojan,fateTrojanAbilityWheel,FATE_TROJAN_COUNT_WHEEL} from '../fate-trojan/combat.js';
import {isPlaneswalker,planeswalkerAbilityWheel,PLANESWALKER_COUNT_WHEEL} from '../planeswalker/combat.js';
import {isDeathConsul,deathConsulAbilityWheel,DEATH_CONSUL_COUNT_WHEEL} from '../death-consul/combat.js';
import {isLightSeeker,lightSeekerAbilityWheel,LIGHT_SEEKER_COUNT_WHEEL} from '../light-seeker/combat.js';
import {isCatastrophe,catastropheAbilityWheel,CATASTROPHE_COUNT_WHEEL} from '../catastrophe/combat.js';
import {isWisdomAngel,wisdomAngelAbilityWheel,WISDOM_ANGEL_COUNT_WHEEL} from '../wisdom-angel/combat.js';
import {isConcealmentServant,concealmentServantAbilityWheel,CONCEALMENT_SERVANT_COUNT_WHEEL} from '../concealment-servant/combat.js';
import {isLifeGiver,lifeGiverAbilityWheel,LIFE_GIVER_COUNT_WHEEL} from '../life-giver/combat.js';
import {isKnowledgeMentor,knowledgeMentorAbilityWheel,KNOWLEDGE_MENTOR_COUNT_WHEEL} from '../knowledge-mentor/combat.js';
import {resolveDiscernerCombatRound} from './discerner-combat.js';
import {isDiscerner,discernerAbilityWheel,DISCERNER_COUNT_WHEEL} from '../discerner/combat.js';
import {resolveWeatherWarlockCombatRound} from './weather-warlock-combat.js';
import {isWeatherWarlock,weatherWarlockAbilityWheel,WEATHER_WARLOCK_COUNT_WHEEL} from '../weather-warlock/combat.js';
import {resolveMiracleWorkerCombatRound} from './miracle-worker-combat.js';
import {isMiracleWorker,miracleWorkerAbilityWheel,MIRACLE_WORKER_COUNT_WHEEL} from '../miracle-worker/combat.js';
import {resolveCoffinBearerCombatRound} from './coffin-bearer-combat.js';
import {isCoffinBearer,coffinBearerAbilityWheel,COFFIN_BEARER_COUNT_WHEEL} from '../coffin-bearer/combat.js';
import {resolveChaosHunterCombatRound} from './chaos-hunter-combat.js';
import {isChaosHunter,chaosHunterAbilityWheel,CHAOS_HUNTER_COUNT_WHEEL} from '../chaos-hunter/combat.js';
import {resolveFrenzyMageCombatRound} from './frenzy-mage-combat.js';
import {isFrenzyMage,frenzyMageAbilityWheel,FRENZY_MAGE_COUNT_WHEEL} from '../frenzy-mage/combat.js';
import {resolveChaosWalkerCombatRound} from './chaos-walker-combat.js';
import {isChaosWalker,chaosWalkerAbilityWheel,CHAOS_WALKER_COUNT_WHEEL} from '../chaos-walker/combat.js';
import {resolveSilentDiscipleCombatRound} from './silent-disciple-combat.js';
import {isSilentDisciple,silentDiscipleAbilityWheel,SILENT_DISCIPLE_COUNT_WHEEL} from '../silent-disciple/combat.js';
import {resolveBlathererCombatRound} from './blatherer-combat.js';
import {isBlatherer,blathererAbilityWheel,BLATHERER_COUNT_WHEEL} from '../blatherer/combat.js';
import {resolveThreeHeadedTemplarCombatRound} from './three-headed-templar-combat.js';
import {isThreeHeadedTemplar,threeHeadedTemplarAbilityWheel,THREE_HEADED_TEMPLAR_COUNT_WHEEL} from '../three-headed-templar/combat.js';
import {resolveProphecyMasterCombatRound} from './prophecy-master-combat.js';
import {isProphecyMaster,prophecyMasterAbilityWheel,PROPHECY_MASTER_COUNT_WHEEL} from '../prophecy-master/combat.js';
import {resolveUnagingDemonessCombatRound} from './unaging-demoness-combat.js';
import {isUnagingDemoness,unagingDemonessAbilityWheel,UNAGING_DEMONESS_COUNT_WHEEL} from '../unaging-demoness/combat.js';
import {resolveSilverKnightCombatRound} from './silver-knight-combat.js';
import {isSilverKnight,silverKnightAbilityWheel,SILVER_KNIGHT_COUNT_WHEEL} from '../silver-knight/combat.js';
import {resolveDeceitMentorCombatRound} from './deceit-mentor-combat.js';
import {isDeceitMentor,deceitMentorAbilityWheel,DECEIT_MENTOR_COUNT_WHEEL} from '../deceit-mentor/combat.js';
import {resolveWandererCombatRound} from './wanderer-combat.js';
import {isWanderer,wandererAbilityWheel,WANDERER_COUNT_WHEEL} from '../wanderer/combat.js';
import {resolveFerrymanCombatRound} from './ferryman-combat.js';
import {isFerryman,ferrymanAbilityWheel,FERRYMAN_COUNT_WHEEL} from '../ferryman/combat.js';
import {resolveJusticeMentorCombatRound} from './justice-mentor-combat.js';
import {isJusticeMentor,justiceMentorAbilityWheel,JUSTICE_MENTOR_COUNT_WHEEL} from '../justice-mentor/combat.js';
import {resolveSeaKingCombatRound} from './sea-king-combat.js';
import {isSeaKing,seaKingAbilityWheel,SEA_KING_COUNT_WHEEL} from '../sea-king/combat.js';
import {resolveInsightScholarCombatRound} from './insight-scholar-combat.js';
import {isInsightScholar,insightScholarAbilityWheel,INSIGHT_SCHOLAR_COUNT_WHEEL} from '../insight-scholar/combat.js';
import {resolveFearBishopCombatRound} from './fear-bishop-combat.js';
import {isFearBishop,fearBishopAbilityWheel,FEAR_BISHOP_COUNT_WHEEL} from '../fear-bishop/combat.js';
import {resolveSummoningMasterCombatRound} from './summoning-master-combat.js';
import {isSummoningMaster,summoningMasterAbilityWheel,SUMMONING_MASTER_COUNT_WHEEL} from '../summoning-master/combat.js';
import {resolveArcaneScholarCombatRound} from './arcane-scholar-combat.js';
import {isArcaneScholar,arcaneScholarAbilityWheel,ARCANE_SCHOLAR_COUNT_WHEEL} from '../arcane-scholar/combat.js';
import {resolveDreamWeaverCombatRound} from './dream-weaver-combat.js';
import {isDreamWeaver,dreamWeaverAbilityWheel,DREAM_WEAVER_COUNT_WHEEL} from '../dream-weaver/combat.js';
import {resolveWarBishopCombatRound} from './war-bishop-combat.js';
import {isWarBishop,warBishopAbilityWheel,WAR_BISHOP_COUNT_WHEEL,type WarBishopPolicy} from '../war-bishop/combat.js';
import {resolveAncientScholarCombatRound} from './ancient-scholar-combat.js';
import {isAncientScholar,ancientScholarAbilityWheel,ANCIENT_SCHOLAR_COUNT_WHEEL} from '../ancient-scholar/combat.js';
import {resolveAncientAlchemistCombatRound} from './ancient-alchemist-combat.js';
import {isAncientAlchemist,ancientAlchemistAbilityWheel,ANCIENT_ALCHEMIST_COUNT_WHEEL} from '../ancient-alchemist/combat.js';
import {resolveImperativeMageCombatRound} from './imperative-mage-combat.js';
import {isImperativeMage,imperativeMageAbilityWheel,IMPERATIVE_MAGE_COUNT_WHEEL} from '../imperative-mage/combat.js';
import {resolveFallenEarlCombatRound} from './fallen-earl-combat.js';
import {isFallenEarl,fallenEarlAbilityWheel,FALLEN_EARL_COUNT_WHEEL} from '../fallen-earl/combat.js';
import {resolveMisfortuneMageCombatRound} from './misfortune-mage-combat.js';
import {isMisfortuneMage,misfortuneMageAbilityWheel,MISFORTUNE_MAGE_COUNT_WHEEL} from '../misfortune-mage/combat.js';
import {resolvePuppetCombatRound} from './puppet-combat.js';
import {isPuppet,puppetAbilityWheel,PUPPET_COUNT_WHEEL} from '../puppet/combat.js';
import {resolveDevilCombatRound} from './devil-combat.js';
import {isDevil,devilAbilityWheel,DEVIL_COUNT_WHEEL} from '../devil/combat.js';
import {resolveBlackKnightCombatRound} from './black-knight-combat.js';
import {isBlackKnight,blackKnightAbilityWheel,BLACK_KNIGHT_COUNT_WHEEL} from '../black-knight/combat.js';
import {resolveMysticCombatRound} from './mystic-combat.js';
import {isMystic,mysticAbilityWheel,MYSTIC_COUNT_WHEEL} from '../mystic/combat.js';
import {resolveDespairCombatRound} from './despair-combat.js';
import {isDespair,despairAbilityWheel,DESPAIR_COUNT_WHEEL} from '../despair/combat.js';
import { DEMON_HUNTER_COUNT_WHEEL, beginDemonHunterCombatRound, consumeDemonHunterDefense, currentDemonHunterCombatSource, demonHunterAbilityWheel, demonHunterActionCount, demonHunterEnemyActionCount, drawDemonHunterAbility, drawDemonHunterEnemyAbility, finishDemonHunterCombatRound, isDemonHunter, projectDemonHunterCombat, resolveDemonHunterCombatAbility, resolveDemonHunterEnemyAbility } from '../demon-hunter/combat.js';
import { PARASITE_COUNT_WHEEL, createParasiteRoundContext, currentParasiteCombatSource, decideParasiteEnemyIntent, drawParasiteAbility, drawParasiteEnemyAbility, finishParasiteCombatRound, isParasite, parasiteAbilityWheel, parasiteActionCount, parasiteEnemyActionCount, projectParasiteCombat, resolveParasiteCombatAbility, resolveParasiteEnemyIntent } from '../parasite/combat.js';
import { SECRETS_SORCERER_COUNT_WHEEL, createSecretsSorcererRecorderRound, currentSecretsSorcererCombatSource, drawSecretsSorcererAbility, drawSecretsSorcererEnemyAbility, finishSecretsSorcererCombatRound, hasSecretsSorcererCombat, isSecretsSorcerer, projectSecretsSorcererCombat, resolveSecretsSorcererCombatAbility, resolveSecretsSorcererEnemyAbility, secretsSorcererAbilityWheel, secretsSorcererActionCount, secretsSorcererEnemyActionCount } from '../secrets-sorcerer/combat.js';
import { hasSecretsSorcererOpponent } from '../secrets-sorcerer/ritual.js';
import { UNDYING_COUNT_WHEEL, undyingAbilityWheel, undyingActionCount, beginUndyingCombatRound, currentUndyingCombatSource, drawUndyingAbility, finishUndyingCombatRound, isUndying, resolveUndyingCombatAbility } from '../undying/combat.js';
import { UNSHADOWED_COUNT_WHEEL, unshadowedAbilityWheel, unshadowedActionCount, beginUnshadowedCombatRound, currentUnshadowedCombatSource, drawUnshadowedAbility, finishUnshadowedCombatRound, isUnshadowed, resolveUnshadowedCombatAbility } from '../unshadowed/combat.js';
import { CATACLYSM_PRIEST_COUNT_WHEEL, cataclysmPriestAbilityWheel, cataclysmPriestActionCount, beginCataclysmPriestCombatRound, currentCataclysmPriestCombatSource, drawCataclysmPriestAbility, finishCataclysmPriestCombatRound, isCataclysmPriest, resolveCataclysmPriestCombatAbility } from '../cataclysm-priest/combat.js';
import { PROPHET_COUNT_WHEEL, prophetAbilityWheel, prophetActionCount, beginProphetCombatRound, currentProphetCombatSource, drawProphetAbility, finishProphetCombatRound, isProphet, resolveProphetCombatAbility } from '../prophet/combat.js';
import { NIGHTWATCHER_COUNT_WHEEL, nightwatcherAbilityWheel, nightwatcherActionCount, beginNightwatcherCombatRound, currentNightwatcherCombatSource, drawNightwatcherAbility, finishNightwatcherCombatRound, isNightwatcher, resolveNightwatcherCombatAbility } from '../nightwatcher/combat.js';
import { WITCH_KING_COUNT_WHEEL, witchKingAbilityWheel, witchKingActionCount, beginWitchKingCombatRound, currentWitchKingCombatSource, drawWitchKingAbility, finishWitchKingCombatRound, isWitchKing, resolveWitchKingCombatAbility } from '../witch-king/combat.js';
import { ALCHEMIST_COUNT_WHEEL, alchemistAbilityWheel, alchemistActionCount, beginAlchemistCombatRound, consumeAlchemistGuard, currentAlchemistCombatSource, drawAlchemistAbility, finishAlchemistCombatRound, isAlchemist, resolveAlchemistCombatAbility } from '../alchemist/combat.js';
import { MANIPULATOR_COUNT_WHEEL, beginManipulatorCombatRound, currentManipulatorCombatSource, drawManipulatorAbility, finishManipulatorCombatRound, isManipulator, manipulatorAbilityWheel, manipulatorActionCount, resolveManipulatorCombatAbility } from '../manipulator/combat.js';
import {
  IRON_BLOOD_COUNT_WHEEL, beginIronBloodCombatRound, currentIronBloodCombatSource, drawIronBloodAbility,
  finishIronBloodCombatRound, ironBloodAbilityWheel, ironBloodActionCount, isIronBloodKnight,
  resolveIronBloodCombatAbility, shareIronBloodHealthDamage, type IronBloodSharePolicy,
} from '../iron-blood-knight/combat.js';
import {
  BIZARRO_SORCERER_COUNT_WHEEL, bizarroSorcererAbilityWheel, bizarroSorcererActionCount,
  currentBizarroSorcererCombatSource, drawBizarroSorcererAbility, isBizarroSorcerer, resolveBizarroSorcererCombatAbility,
} from '../bizarro-sorcerer/combat.js';
import { currentBizarroAttempt, hasBizarroRitualOpponent } from '../bizarro-sorcerer/ritual.js';
import { applyBizarroPlayerCounterplay, bizarroEnemyActionCount, createBizarroRoundContext,
  drawBizarroEnemyAbility, resolveBizarroEnemyAbility, projectBizarroCombat } from '../bizarro-sorcerer/ritual-combat.js';
import {
  WINNER_COUNT_WHEEL, consumeWinnerStagger, currentWinnerCombatSource, drawWinnerAbility,
  drawWinnerPassiveLuck, finishWinnerCombatRound, isWinner, resolveWinnerCombatAbility,
  winnerAbilityWheel, winnerActionCount, type WinnerLuckPolicy,
} from '../winner/combat.js';
import {
  WRAITH_COUNT_WHEEL, consumeWraithStagger, currentWraithCombatSource, drawWraithAbility,
  finishWraithCombatRound, isWraith, resolveWraithCombatAbility, wraithAbilityWheel, wraithActionCount,
} from '../wraith/combat.js';
import {
  SHEPHERD_COUNT_WHEEL, consumeShepherdBlur, currentShepherdCombatSource, drawShepherdAbility,
  finishShepherdCombatRound, isShepherd, resolveShepherdCombatAbility, shepherdAbilityWheel, shepherdActionCount,
} from '../shepherd/combat.js';
import {
  STAR_MYSTIC_COUNT_WHEEL, consumeStarMysticCage, currentStarMysticCombatSource, drawStarMysticAbility,
  finishStarMysticCombatRound, isStarMystic, resolveStarMysticCombatAbility, starMysticAbilityWheel, starMysticActionCount,
} from '../star-mystic/combat.js';
import {
  PAIN_COUNT_WHEEL, beginPainCombatRound, consumePainEnemyStrike, currentPainCombatSource,
  drawPainAbility, finishPainCombatRound, isPain, painAbilityWheel, painActionCount, resolvePainCombatAbility,
} from '../pain/combat.js';
import {
  GUARDIAN_COUNT_WHEEL, beginGuardianCombatRound, consumeGuardianDefense, currentGuardianCombatSource,
  drawGuardianAbility, finishGuardianCombatRound, guardianAbilityWheel, guardianActionCount,
  isGuardian, resolveGuardianCombatAbility,
} from '../guardian/combat.js';
import {
  DREAM_STEALER_COUNT_WHEEL, consumeDreamStealerEnemyIntent, createDreamStealerRoundContext,
  currentDreamStealerCombatSource, decideDreamStealerEnemyIntent, drawDreamStealerAbility,
  dreamStealerAbilityWheel, dreamStealerActionCount, finishDreamStealerCombatRound, isDreamStealer,
  resolveDreamStealerCombatAbility,
} from '../dream-stealer/combat.js';
import {
  TRAVELER_COUNT_WHEEL, createTravelerRecorderRound, currentTravelerCombatSource, drawTravelerAbility, isTraveler,
  travelerAbilityWheel, travelerActionCount, resolveTravelerCombatAbility,
} from '../traveler/combat.js';
import {
  GATEKEEPER_COUNT_WHEEL, currentGatekeeperCombatSource, drawGatekeeperAbility, isGatekeeper,
  gatekeeperAbilityWheel, gatekeeperActionCount, resolveGatekeeperCombatAbility, releaseGatekeeperSpiritOnDeath,
} from '../gatekeeper/combat.js';
import {
  PRIEST_OF_LIGHT_COUNT_WHEEL, currentPriestOfLightCombatSource, drawPriestOfLightAbility, isPriestOfLight,
  priestOfLightAbilityWheel, priestOfLightActionCount, resolvePriestOfLightCombatAbility,
} from '../priest-of-light/combat.js';
import {
  OCEAN_SINGER_COUNT_WHEEL, currentOceanSingerCombatSource, drawOceanSingerAbility, isOceanSinger,
  oceanSingerAbilityWheel, oceanSingerActionCount, resolveOceanSingerCombatAbility,
} from '../ocean-singer/combat.js';
import {
  MYSTICISM_MAGISTER_COUNT_WHEEL, currentMysticismMagisterCombatSource, drawMysticismMagisterAbility, isMysticismMagister,
  mysticismMagisterAbilityWheel, mysticismMagisterActionCount, resolveMysticismMagisterCombatAbility,
} from '../mysticism-magister/combat.js';
import {
  SPIRIT_WARLOCK_COUNT_WHEEL, currentSpiritWarlockCombatSource, drawSpiritWarlockAbility, isSpiritWarlock,
  spiritWarlockAbilityWheel, spiritWarlockActionCount, resolveSpiritWarlockCombatAbility,
  finishSpiritWarlockCombatRound, releaseSpiritWarlockCombatDream, resolveSpiritWarlockEnemyAction,
} from '../spirit-warlock/combat.js';
import {
  CRIMSON_SCHOLAR_COUNT_WHEEL, currentCrimsonScholarCombatSource, drawCrimsonScholarAbility, isCrimsonScholar,
  crimsonScholarAbilityWheel, crimsonScholarActionCount, resolveCrimsonScholarCombatAbility,
  finishCrimsonScholarCombatRound,
} from '../crimson-scholar/combat.js';
import {
  ASTRONOMER_COUNT_WHEEL, currentAstronomerCombatSource, drawAstronomerAbility, isAstronomer,
  astronomerAbilityWheel, astronomerActionCount, resolveAstronomerCombatAbility,
} from '../astronomer/combat.js';
import {
  DREAMWALKER_COUNT_WHEEL, currentDreamwalkerCombatSource, drawDreamwalkerAbility, isDreamwalker,
  dreamwalkerAbilityWheel, dreamwalkerActionCount, resolveDreamwalkerCombatAbility,
} from '../dreamwalker/combat.js';
import {
  REAPER_COUNT_WHEEL, currentReaperCombatSource, drawReaperAbility, finishReaperCombatRound, isReaper,
  reaperAbilityWheel, reaperActionCount, resolveReaperCombatAbility,
} from '../reaper/combat.js';
import {
  MARIONETTIST_COUNT_WHEEL, currentMarionettistCombatSource, drawMarionettistAbility, isMarionettist,
  marionettistAbilityWheel, marionettistActionCount, resolveMarionettistCombatAbility,
} from '../marionettist/combat.js';
import {
  BIOLOGIST_COUNT_WHEEL, biologistAbilityWheel, biologistActionCount, currentBiologistCombatSource,
  drawBiologistAbility, isBiologist, resolveBiologistCombatAbility,
} from '../biologist/combat.js';
import {
  DRUID_COUNT_WHEEL, druidAbilityWheel, druidActionCount, currentDruidCombatSource,
  drawDruidAbility, isDruid, resolveDruidCombatAbility,
} from '../druid/combat.js';
import {
  JUDGE_COUNT_WHEEL, createJudgeRoundContext, currentJudgeCombatSource, drawJudgeAbility,
  finishJudgeCombatRound, isJudge, judgeAbilityWheel, judgeActionCount,
  judgeEnemyProhibition, resolveJudgeCombatAbility,
} from '../judge/combat.js';
import {
  PUNISHMENT_KNIGHT_COUNT_WHEEL, createPunishmentKnightRoundContext, currentPunishmentKnightCombatSource,
  drawPunishmentKnightAbility, finishPunishmentKnightCombatRound, isPunishmentKnight,
  punishmentKnightAbilityWheel, punishmentKnightActionCount, punishmentKnightEnemyProhibition,
  recordPunishmentKnightBreach, consumePunishmentKnightConfinement, resolvePunishmentKnightCombatAbility,
} from '../punishment-knight/combat.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import {
  MENTOR_DISORDER_COUNT_WHEEL, consumeMentorDisorderWeakening, consumeMentorDisorderStrike,
  mentorDisorderAbilityWheel, mentorDisorderActionCount, createMentorDisorderRoundContext,
  currentMentorDisorderCombatSource, drawMentorDisorderAbility, finishMentorDisorderCombatRound,
  isMentorDisorder, resolveMentorDisorderCombatAbility,
} from '../mentor-disorder/combat.js';
import {
  CORRUPTION_BARON_COUNT_WHEEL, consumeCorruptionBaronWeakening, corruptionBaronAbilityWheel,
  corruptionBaronActionCount, createCorruptionBaronRoundContext, currentCorruptionBaronCombatSource,
  drawCorruptionBaronAbility, finishCorruptionBaronCombatRound, isCorruptionBaron, resolveCorruptionBaronCombatAbility,
} from '../corruption-baron/combat.js';
import {
  PLEASURE_COUNT_WHEEL, consumePleasureSilkBinding, currentPleasureCombatSource,
  drawPleasureAbility, finishPleasureCombatRound, isPleasure, pleasureAbilityWheel,
  pleasureActionCount, releasePleasureSilkBinding, resolvePleasureCombatAbility,
} from '../pleasure/combat.js';
import {
  DAWN_PALADIN_COUNT_WHEEL, consumeDawnPaladinArmor, currentDawnPaladinCombatSource,
  dawnPaladinAbilityWheel, dawnPaladinActionCount, drawDawnPaladinAbility,
  finishDawnPaladinCombatRound, isDawnPaladin, resolveDawnPaladinCombatAbility,
} from '../dawn-paladin/combat.js';
import { currentArtisanCombatSource, isArtisan } from '../artisan/combat.js';
import {
  HARVESTPRIEST_COUNT_WHEEL, currentHarvestpriestCombatSource, drawHarvestpriestAbility, isHarvestpriest,
  harvestpriestAbilityWheel, harvestpriestActionCount, resolveHarvestpriestCombatAbility,
} from '../harvestpriest/combat.js';
import {
  PHYSICIAN_COUNT_WHEEL, currentPhysicianCombatSource, drawPhysicianAbility, isPhysician,
  physicianAbilityWheel, physicianActionCount, resolvePhysicianCombatAbility,
} from '../physician/combat.js';
import {
  CULTIVATOR_COUNT_WHEEL, currentCultivatorCombatSource, drawCultivatorAbility, isCultivator,
  cultivatorAbilityWheel, cultivatorActionCount, resolveCultivatorCombatAbility,
} from '../cultivator/combat.js';
import {
  CALAMITY_PRIEST_COUNT_WHEEL, calamityPriestAbilityWheel, calamityPriestActionCount,
  currentCalamityPriestCombatSource, drawCalamityPriestAbility, drawCalamityPriestPassiveLuck,
  isCalamityPriest, resolveCalamityPriestCombatAbility,
} from '../calamity-priest/combat.js';
import {
  LUCKY_COUNT_WHEEL, currentLuckyCombatSource, drawLuckyAbility, drawLuckyPassiveLuck, isLucky,
  luckyAbilityWheel, luckyActionCount, luckyPassiveLuckConsequence, resolveLuckyCombatAbility,
} from '../lucky/combat.js';
import {
  MACHINE_COUNT_WHEEL, currentMachineCombatSource, drawMachineAbility, isMachine,
  machineAbilityWheel, machineActionCount, resolveMachineCombatAbility,
} from '../machine/combat.js';
import {
  BRIBER_COUNT_WHEEL, briberAbilityWheel, briberActionCount, consumeBriberWeakening,
  createBriberRoundContext, drawBriberAbility, finishBriberCombatRound, isBriber, resolveBriberCombatAbility,
} from '../briber/combat.js';
import {
  BARBARIAN_COUNT_WHEEL, currentBarbarianCombatSource, drawBarbarianAbility, isBarbarian,
  barbarianAbilityWheel, barbarianActionCount, resolveBarbarianCombatAbility,
} from '../barbarian/combat.js';
import {
  INTERROGATOR_COUNT_WHEEL, currentInterrogatorCombatSource, drawInterrogatorAbility, isInterrogator,
  interrogatorAbilityWheel, interrogatorActionCount, resolveInterrogatorCombatAbility,
} from '../interrogator/combat.js';
import {
  SHERIFF_COUNT_WHEEL, currentSheriffCombatSource, drawSheriffAbility, isSheriff,
  sheriffAbilityWheel, sheriffActionCount, resolveSheriffCombatAbility,
} from '../sheriff/combat.js';
import {
  ARBITER_COUNT_WHEEL, arbiterAbilityWheel, arbiterActionCount, currentArbiterCombatSource,
  drawArbiterAbility, isArbiter, resolveArbiterCombatAbility,
} from '../arbiter/combat.js';
import {
  LAWYER_COUNT_WHEEL, currentLawyerCombatSource, drawLawyerAbility, isLawyer,
  lawyerAbilityWheel, lawyerActionCount, resolveLawyerCombatAbility,
} from '../lawyer/combat.js';
import {
  MONSTER_COUNT_WHEEL, currentMonsterCombatSource, drawMonsterAbility, isMonster,
  monsterAbilityWheel, monsterActionCount, resolveMonsterCombatAbility,
} from '../monster/combat.js';
import {
  ZOMBIE_COUNT_WHEEL, currentZombieCombatSource, drawZombieAbility, isZombie,
  zombieAbilityWheel, zombieActionCount, resolveZombieCombatAbility,
} from '../zombie/combat.js';
import {
  WEREWOLF_COUNT_WHEEL, currentWerewolfCombatSource, drawWerewolfAbility, isWerewolf,
  werewolfAbilityWheel, werewolfActionCount, resolveWerewolfCombatAbility, type WerewolfRoundContext,
} from '../werewolf/combat.js';
import {
  MADMAN_COUNT_WHEEL, currentMadmanCombatSource, drawMadmanAbility, isMadman,
  madmanAbilityWheel, madmanActionCount, resolveMadmanCombatAbility,
  type MadmanBurstPolicy, type MadmanRoundPolicy,
} from '../madman/combat.js';
import {
  PRISONER_COUNT_WHEEL, prisonerAbilityWheel, prisonerActionCount, currentPrisonerCombatSource,
  drawPrisonerAbility, isPrisoner, resolvePrisonerCombatAbility,
} from '../prisoner/combat.js';
import {
  DESIRE_APOSTLE_COUNT_WHEEL, consumeDesireApostleStagger, currentDesireApostleCombatSource,
  desireApostleAbilityWheel, desireApostleActionCount, drawDesireApostleAbility, finishDesireApostleCombatRound,
  isDesireApostle, observeDesireApostleEnemyOpening, resolveDesireApostleCombatAbility,
} from '../desire-apostle/combat.js';
import {
  DEMON_COUNT_WHEEL, currentDemonCombatSource, demonAbilityWheel, demonActionCount,
  drawDemonAbility, isDemon, resolveDemonCombatAbility,
} from '../demon/combat.js';
import {
  SERIAL_KILLER_COUNT_WHEEL, serialKillerAbilityWheel, serialKillerActionCount, currentSerialKillerCombatSource,
  drawSerialKillerAbility, isSerialKiller, resolveSerialKillerCombatAbility,
} from '../serial-killer/combat.js';
import {
  UNWINGED_COUNT_WHEEL, unwingedAbilityWheel, unwingedActionCount, currentUnwingedCombatSource,
  drawUnwingedAbility, isUnwinged, resolveUnwingedCombatAbility,
} from '../unwinged/combat.js';
import {
  CRIMINAL_COUNT_WHEEL, criminalAbilityWheel, criminalActionCount, currentCriminalCombatSource,
  drawCriminalAbility, isCriminal, resolveCriminalCombatAbility,
} from '../criminal/combat.js';
import {
  ROSE_BISHOP_COUNT_WHEEL, currentRoseBishopCombatSource, drawRoseBishopAbility, isRoseBishop,
  resolveRoseBishopCombatAbility, roseBishopAbilityWheel, roseBishopActionCount,
} from '../rose-bishop/combat.js';
import {
  SHADOW_ASCETIC_COUNT_WHEEL, drawShadowAsceticAbility, isShadowAscetic, shadowAsceticAbilityWheel,
  shadowAsceticActionCount, resolveShadowAsceticCombatAbility,
} from '../shadow-ascetic/combat.js';
import {
  LISTENER_COUNT_WHEEL, drawListenerAbility, isListener, listenerAbilityWheel, listenerActionCount,
  resolveListenerCombatAbility,
} from '../listener/combat.js';
import {
  SECRET_SUPPLICANT_COUNT_WHEEL, drawSecretSupplicantAbility, isSecretSupplicant,
  resolveSecretSupplicantCombatAbility, secretSupplicantAbilityWheel, secretSupplicantActionCount,
} from '../secret-supplicant/combat.js';
import {
  SCROLL_PROFESSOR_COUNT_WHEEL, currentScrollProfessorCombatSource, drawScrollProfessorAbility, isScrollProfessor,
  resolveScrollProfessorCombatAbility, scrollProfessorAbilityWheel, scrollProfessorActionCount,
} from '../scroll-professor/combat.js';
import {
  WIZARD_COUNT_WHEEL, drawWizardAbility, isWizard, resolveWizardCombatAbility,
  wizardAbilityWheel, wizardActionCount,
} from '../wizard/combat.js';
import {
  COMBAT_SCHOLAR_COUNT_WHEEL, combatScholarAbilityWheel, combatScholarActionCount,
  drawCombatScholarAbility, isCombatScholar, resolveCombatScholarCombatAbility,
} from '../combat-scholar/combat.js';
import {
  PRYER_COUNT_WHEEL, drawPryerAbility, isPryer, pryerAbilityWheel, pryerActionCount,
  resolvePryerCombatAbility,
} from '../pryer/combat.js';
import {
  AUDIENCE_COUNT_WHEEL, audienceAbilityWheel, audienceActionCount,
  drawAudienceAbility, isAudience, resolveAudienceCombatAbility,
} from '../audience/combat.js';
import {
  PSYCHOLOGIST_COUNT_WHEEL, drawPsychologistAbility, isPsychologist, psychologistAbilityWheel,
  psychologistActionCount, resolvePsychologistCombatAbility,
} from '../psychologist/combat.js';
import {
  MINDREADER_COUNT_WHEEL, drawMindreaderAbility, isMindreader, mindreaderAbilityWheel,
  mindreaderActionCount, resolveMindreaderCombatAbility,
} from '../mindreader/combat.js';
import {
  CLOWN_COUNT_WHEEL, clownAbilityWheel, clownActionCount, currentClownDangerSource,
  drawClownAbility, isClown, resolveClownCombatAbility,
} from '../clown/combat.js';
import {
  MAGICIAN_COUNT_WHEEL, drawMagicianAbility, isMagician, magicianAbilityWheel,
  magicianActionCount, resolveMagicianCombatAbility, resolveMagicianFigurineReplacement,
} from '../magician/combat.js';
import {
  drawSeerAbility, isSeer, resolveSeerCombatAbility, SEER_COUNT_WHEEL,
  seerAbilityWheel, seerActionCount,
} from '../seer/combat.js';
import {
  HUNTER_COUNT_WHEEL, currentHunterApproachSource, currentHunterDangerSource,
  drawHunterAbility, hunterAbilityWheel, hunterActionCount, isHunter,
  resolveHunterCombatAbility, resolveHunterTrap,
} from '../hunter/combat.js';
import {
  PROVOKER_COUNT_WHEEL, drawProvokerAbility, isProvoker, provokerAbilityWheel,
  provokerActionCount, resolveProvokerCombatAbility,
} from '../provoker/combat.js';
import {
  PYROMANIAC_COUNT_WHEEL, drawPyromaniacAbility, isPyromaniac, pyromaniacAbilityWheel,
  pyromaniacActionCount, resolvePyromaniacCombatAbility,
} from '../pyromaniac/combat.js';
import {
  VAMPIRE_COUNT_WHEEL, currentPotionProfessorCombatSource, drawVampireAbility, isVampire, vampireAbilityWheel,
  vampireActionCount, resolveVampireCombatAbility,
} from '../vampire/combat.js';
import {
  SLEEPLESS_COUNT_WHEEL, drawSleeplessAbility, isSleepless, sleeplessAbilityWheel,
  sleeplessActionCount, resolveSleeplessCombatAbility,
} from '../sleepless/combat.js';
import {
  MIDNIGHT_COUNT_WHEEL, drawMidnightAbility, isMidnight, midnightAbilityWheel,
  midnightActionCount, resolveMidnightCombatAbility,
} from '../midnight/combat.js';
import {
  NIGHTMARE_COUNT_WHEEL, currentSootherNightSource, drawNightmareAbility, finishNightmareCombatRound, hasNightmareCombat,
  isSootherCombat, nightmareDreamLocked,
  nightmareAbilityWheel, nightmareActionCount, releaseNightmareDream,
  resolveNightmareCombatAbility, resolveNightmareEnemyAction,
} from '../nightmare/combat.js';
import {
  READER_COUNT_WHEEL, currentReaderActionSource, drawReaderAbility, isReader, readerAbilityWheel,
  readerActionCount, resolveReaderCombatAbility,
} from '../reader/combat.js';
import {
  REASONER_COUNT_WHEEL, consumeReasonerInterference, currentReasonerCombatSource,
  drawReasonerAbility, isReasoner, reasonerAbilityWheel, reasonerActionCount, resolveReasonerCombatAbility,
} from '../reasoner/combat.js';
import {
  DETECTIVE_COUNT_WHEEL, createDetectiveRoundObservations, detectiveAbilityWheel, detectiveActionCount,
  consumePolymathInterference, currentPolymathCombatSource, drawDetectiveAbility, hasDetectiveCombat,
  isPolymath, observeDetectiveEnemyAction, resolveDetectiveCombatAbility,
} from '../detective/combat.js';
import {
  SAILOR_COUNT_WHEEL, consumeSailorScales, drawSailorAbility, isSailor, sailorAbilityWheel, sailorActionCount,
  resolveSailorCombatAbility,
} from '../sailor/combat.js';
import {
  RAGER_COUNT_WHEEL, drawRagerAbility, hasRagerWrath, isRager, ragerAbilityWheel, ragerActionCount,
  resolveRagerCombatAbility, resolveRagerPhysicalExchange, type RagerRagePolicy, type RagerRoundPolicy,
} from '../rager/combat.js';
import {
  NAVIGATOR_COUNT_WHEEL, consumeNavigatorWater, currentWindBlessedCombatSource, drawNavigatorAbility, hasNavigatorCombat, isWindBlessed,
  navigatorAbilityWheel, navigatorActionCount, resolveNavigatorCombatAbility,
} from '../navigator/combat.js';
import {
  BARD_COUNT_WHEEL, bardAbilityWheel, bardActionCount, createBardRoundContext, drawBardAbility,
  finishBardCombatRound, isBard, resolveBardCombatAbility, type BardEffectContext,
} from '../bard/combat.js';
import {
  LIGHTPRAYER_COUNT_WHEEL, currentLightprayerCombatSource, drawLightprayerAbility, isLightprayer,
  lightprayerAbilityWheel, lightprayerActionCount, resolveLightprayerCombatAbility,
} from '../lightprayer/combat.js';
import {
  SUNPRIEST_COUNT_WHEEL, createNotaryRoundContext, currentNotaryCombatSource, currentSunpriestCombatSource,
  drawSunpriestAbility, finishNotaryCombatRound, hasSunpriestCombat, isNotary,
  sunpriestAbilityWheel, sunpriestActionCount, resolveSunpriestCombatAbility,
} from '../sunpriest/combat.js';
import {
  APPRENTICE_COUNT_WHEEL, apprenticeAbilityWheel, apprenticeActionCount,
  currentApprenticeCombatSource, drawApprenticeAbility, isApprentice, resolveApprenticeCombatAbility,
} from '../apprentice/combat.js';
import {
  ASTROLOGER_COUNT_WHEEL, astrologerAbilityWheel, astrologerActionCount,
  currentAstrologerCombatSource, currentRecorderCombatSource, drawAstrologerAbility, hasAstrologerCombat,
  isRecorder, resolveAstrologerCombatAbility, storedRecorderCombatRecord, type RecorderRoundContext,
} from '../astrologer/combat.js';
import {
  TRICKMASTER_COUNT_WHEEL, currentTrickmasterCombatSource, drawTrickmasterAbility,
  isTrickmaster, resolveTrickmasterCombatAbility, trickmasterAbilityWheel, trickmasterActionCount,
} from '../trickmaster/combat.js';
import {
  CORPSECOLLECTOR_COUNT_WHEEL, corpsecollectorAbilityWheel, corpsecollectorActionCount,
  currentCorpsecollectorCombatSource, drawCorpsecollectorAbility, isCorpsecollector, resolveCorpsecollectorCombatAbility,
} from '../corpsecollector/combat.js';
import {
  GRAVEDIGGER_COUNT_WHEEL, currentGravediggerCombatSource, drawGravediggerAbility,
  gravediggerAbilityWheel, gravediggerActionCount, isGravedigger, resolveGravediggerCombatAbility,
} from '../gravedigger/combat.js';
import {
  SPIRITMEDIUM_COUNT_WHEEL, currentSpiritGuideCombatSource, currentSpiritmediumCombatSource, drawSpiritmediumAbility,
  spiritmediumAbilityWheel, spiritmediumActionCount, hasSpiritmediumCombat, isSpiritGuide, resolveSpiritmediumCombatAbility,
} from '../spiritmedium/combat.js';
import {
  MARAUDER_COUNT_WHEEL, currentMarauderCombatSource, drawMarauderAbility, isMarauder,
  marauderAbilityWheel, marauderActionCount, marauderEnemyArmed, marauderPlayerHoldsClub,
  resolveMarauderCombatAbility,
} from '../marauder/combat.js';
import {
  SWINDLER_COUNT_WHEEL, consumeSwindlerMisdirection, currentSwindlerCombatSource, drawSwindlerAbility,
  isSwindler, observeSwindlerEnemyAction, resolveSwindlerCombatAbility, swindlerAbilityWheel, swindlerActionCount,
} from '../swindler/combat.js';
import {
  FIRE_THIEF_COUNT_WHEEL, beginFireThiefCombatRound, createFireThiefRoundObservations,
  currentFireThiefCombatSource, drawFireThiefAbility, fireThiefAbilityWheel, fireThiefActionCount,
  isFireThief, observeFireThiefEnemyAction, resolveFireThiefCombatAbility, resolveFireThiefEnemyAction,
} from '../fire-thief/combat.js';
import {
  CRYPTOLOGIST_COUNT_WHEEL, createCryptologistRoundObservations, cryptologistAbilityWheel,
  cryptologistActionCount, currentCryptologistCombatSource, drawCryptologistAbility, isCryptologist,
  observeCryptologistEnemyAction, resolveCryptologistCombatAbility,
} from '../cryptologist/combat.js';
import {
  WARRIOR_COUNT_WHEEL, currentWarriorCombatSource, drawWarriorAbility, isWarrior,
  resolveWarriorCombatAbility, warriorAbilityWheel, warriorActionCount,
} from '../warrior/combat.js';
import {
  GLADIATOR_COUNT_WHEEL, currentGladiatorCombatSource, drawGladiatorAbility, gladiatorAbilityWheel,
  gladiatorActionCount, isGladiator, resolveGladiatorCombatAbility,
} from '../gladiator/combat.js';
import {
  WEAPONMASTER_COUNT_WHEEL, currentWeaponmasterCombatSource, drawWeaponmasterAbility, isWeaponmaster,
  observeWeaponmasterEnemyAction, resolveWeaponmasterCombatAbility, weaponmasterAbilityWheel, weaponmasterActionCount,
} from '../weaponmaster/combat.js';
import {
  ASSASSIN_COUNT_WHEEL, assassinAbilityWheel, assassinActionCount, currentAssassinCombatSource,
  drawAssassinAbility, isAssassin, resolveAssassinCombatAbility,
} from '../assassin/combat.js';
import {
  INSTIGATOR_COUNT_WHEEL, drawInstigatorAbility, instigatorAbilityWheel, instigatorActionCount,
  isInstigator, resolveInstigatorCombatAbility,
} from '../instigator/combat.js';
import {
  WITCH_COUNT_WHEEL, drawWitchAbility, isWitch, resolveWitchCombatAbility,
  witchAbilityWheel, witchActionCount,
} from '../witch/combat.js';
import type {
  SliceCombatMove, SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry,
} from './types.js';

type Actor = SliceCombatMove['actor'];
type MoveId = 'STRIKE' | 'BLOCK' | 'OPENING' | 'DISTANCE' | 'MISS';
type CombatOutcome = 'ENEMY_SEALED' | 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
type ConsequenceWeights = NonNullable<SliceCombatRound['consequenceWeights']>;

/** Ordinary first-encounter template only; this is not a global action-count cap. */
export const ORDINARY_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 45 }),
  Object.freeze({ id: '2', label: '2次', weight: 40 }),
  Object.freeze({ id: '3', label: '3次', weight: 15 }),
]);

/** Trained Appraiser S7 counts (G); ordinary foes keep their own template. */
export const APPRAISER_COUNT_WHEEL: readonly SliceWheelEntry[] = Object.freeze([
  Object.freeze({ id: '1', label: '1次', weight: 15 }),
  Object.freeze({ id: '2', label: '2次', weight: 20 }),
  Object.freeze({ id: '3', label: '3次', weight: 25 }),
  Object.freeze({ id: '4', label: '4次', weight: 20 }),
  Object.freeze({ id: '5', label: '5次', weight: 15 }),
  Object.freeze({ id: '6', label: '6次', weight: 5 }),
]);

function isAppraiser(state: SliceState): boolean {
  return state.progression.pathwayId === 'paragon' && state.progression.sequence === 7;
}

export function appraiserActionCount(roll: number): number {
  return roll <= 15 ? 1 : roll <= 35 ? 2 : roll <= 60 ? 3 : roll <= 80 ? 4 : roll <= 95 ? 5 : 6;
}

const ABILITIES: readonly {
  id: MoveId; label: string; weight: number; selfGain: number; enemyReduction: number;
}[] = [
  { id: 'STRIKE', label: '普通打击', weight: 40, selfGain: 12, enemyReduction: 0 },
  { id: 'BLOCK', label: '格挡护身', weight: 20, selfGain: 0, enemyReduction: 10 },
  { id: 'OPENING', label: '寻找空当', weight: 20, selfGain: 8, enemyReduction: 0 },
  { id: 'DISTANCE', label: '拉开距离', weight: 15, selfGain: 0, enemyReduction: 8 },
  { id: 'MISS', label: '动作落空', weight: 5, selfGain: 0, enemyReduction: 0 },
];

// Only the documented ordinary attack and explicit block are classified. The
// ordinary template does not specify control/preparation categories, so those
// stances cannot silently turn OPENING or DISTANCE into new kinds of abilities.
function abilityTickets(stance: SliceStance | null): number[] {
  return ABILITIES.map((ability) => ability.weight * (
    (stance === 'ATTACK' && ability.id === 'STRIKE') ||
    (stance === 'DEFEND' && ability.id === 'BLOCK') ? 5 : 4
  ));
}

/** Public exact normalized percentages; neutral stance is null. */
export function ordinaryAbilityWheel(armed: boolean, stance: SliceStance | null): SliceWheelEntry[] {
  const tickets = abilityTickets(stance);
  const total = tickets.reduce((sum, weight) => sum + weight, 0);
  return ABILITIES.map((ability, index) => ({
    id: ability.id,
    label: ability.id === 'STRIKE' && armed ? '短棍打击' : ability.label,
    weight: tickets[index]! / total * 100,
  }));
}

/** The player's progression selects a profile; the carrier keeps its own one. */
export function playerAbilityWheel(state: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  // S7 appraisal and S6 craft do not turn ordinary duels into item powers.
  // The finite S6 lamp only illuminates daily inspections and never enters this wheel.
  const wheel = isTimeWorm(state) ? timeWormAbilityWheel(state,stance) : isStarKey(state) ? starKeyAbilityWheel(state,stance) : isPaleEmperor(state) ? paleEmperorAbilityWheel(state,stance) : isPureWhiteAngel(state) ? pureWhiteAngelAbilityWheel(state,stance) : isThunderGod(state) ? thunderGodAbilityWheel(state,stance) : isAllKnowingEye(state) ? allKnowingEyeAbilityWheel(state,stance) : isMisfortuneKnight(state) ? misfortuneKnightAbilityWheel(state,stance) : isBeautyGoddess(state) ? beautyGoddessAbilityWheel(state,stance) : isCivilizationEnlightener(state) ? civilizationEnlightenerAbilityWheel(state,stance) : isWriter(state) ? writerAbilityWheel(state,stance) : isConqueror(state) ? conquerorAbilityWheel(state,stance) : isAttendantMysteries(state) ? attendantMysteriesAbilityWheel(state,stance) : isBarrenMatriarch(state) ? barrenMatriarchAbilityWheel(state,stance) : isBalancer(state) ? balancerAbilityWheel(state,stance) : isEntropyDuke(state) ? entropyDukeAbilityWheel(state,stance) : isFateProphet(state) ? fateProphetAbilityWheel(state,stance) : isAncientEvil(state) ? ancientEvilAbilityWheel(state,stance) : isBloodDuke(state) ? bloodDukeAbilityWheel(state,stance) : isElder(state) ? elderAbilityWheel(state,stance) : isSage(state) ? sageAbilityWheel(state,stance) : isCalamityDemoness(state) ? calamityDemonessAbilityWheel(state,stance) : isGlory(state) ? gloryAbilityWheel(state,stance) : isFateTrojan(state) ? fateTrojanAbilityWheel(state,stance) : isPlaneswalker(state) ? planeswalkerAbilityWheel(state,stance) : isDeathConsul(state) ? deathConsulAbilityWheel(state,stance) : isLightSeeker(state) ? lightSeekerAbilityWheel(state,stance) : isCatastrophe(state) ? catastropheAbilityWheel(state,stance) : isWisdomAngel(state) ? wisdomAngelAbilityWheel(state,stance) : isConcealmentServant(state) ? concealmentServantAbilityWheel(state,stance) : isLifeGiver(state) ? lifeGiverAbilityWheel(state,stance) : isKnowledgeMentor(state) ? knowledgeMentorAbilityWheel(state,stance) : isDiscerner(state) ? discernerAbilityWheel(state,stance) : isWeatherWarlock(state) ? weatherWarlockAbilityWheel(state,stance) : isCoffinBearer(state) ? coffinBearerAbilityWheel(state, stance) : isChaosHunter(state) ? chaosHunterAbilityWheel(state, stance) : isFrenzyMage(state) ? frenzyMageAbilityWheel(state, stance) : isChaosWalker(state) ? chaosWalkerAbilityWheel(state, stance) : isSilentDisciple(state) ? silentDiscipleAbilityWheel(state, stance) : isBlatherer(state) ? blathererAbilityWheel(state, stance) : isThreeHeadedTemplar(state) ? threeHeadedTemplarAbilityWheel(state, stance) : isProphecyMaster(state) ? prophecyMasterAbilityWheel(state, stance) : isUnagingDemoness(state) ? unagingDemonessAbilityWheel(state, stance) : (isSilverKnight(state)||state.combat?.encounterId==='SILVER_KNIGHT_HUNT') ? silverKnightAbilityWheel(state, stance) : isDeceitMentor(state) ? deceitMentorAbilityWheel(state, stance) : isWanderer(state) ? wandererAbilityWheel(state, stance) : isFerryman(state) ? ferrymanAbilityWheel(state, stance) : isJusticeMentor(state) ? justiceMentorAbilityWheel(state, stance) : isSeaKing(state) ? seaKingAbilityWheel(state, stance) : isInsightScholar(state) ? insightScholarAbilityWheel(state, stance) : isFearBishop(state) ? fearBishopAbilityWheel(state, stance) : isSummoningMaster(state) ? summoningMasterAbilityWheel(state, stance) : isArcaneScholar(state) ? arcaneScholarAbilityWheel(state, stance) : isDreamWeaver(state) ? dreamWeaverAbilityWheel(state, stance) : isWarBishop(state) ? warBishopAbilityWheel(state, stance) : isMiracleWorker(state) ? miracleWorkerAbilityWheel(state, stance) : isAncientScholar(state) ? ancientScholarAbilityWheel(state, stance) : isAncientAlchemist(state) ? ancientAlchemistAbilityWheel(state, stance) : isImperativeMage(state) ? imperativeMageAbilityWheel(state, stance) : isFallenEarl(state) ? fallenEarlAbilityWheel(state, stance) : isMisfortuneMage(state) ? misfortuneMageAbilityWheel(state, stance) : isPuppet(state) ? puppetAbilityWheel(state, stance) : isDevil(state) ? devilAbilityWheel(state, stance) : isBlackKnight(state) ? blackKnightAbilityWheel(state, stance) : isMystic(state) ? mysticAbilityWheel(state, stance) : isDespair(state) ? despairAbilityWheel(state, stance) : isDemonHunter(state) ? demonHunterAbilityWheel(state, stance) : isParasite(state) ? parasiteAbilityWheel(state, stance) : hasSecretsSorcererCombat(state) ? secretsSorcererAbilityWheel(state, stance) : isUndying(state) ? undyingAbilityWheel(state, stance) : isUnshadowed(state) ? unshadowedAbilityWheel(state, stance) : isCataclysmPriest(state) ? cataclysmPriestAbilityWheel(state, stance) : isProphet(state) ? prophetAbilityWheel(state, stance) : isNightwatcher(state) ? nightwatcherAbilityWheel(state, stance) : isWitchKing(state) ? witchKingAbilityWheel(state, stance) : isAlchemist(state) ? alchemistAbilityWheel(state, stance) : isManipulator(state) ? manipulatorAbilityWheel(state, stance) : isIronBloodKnight(state) ? ironBloodAbilityWheel(state, stance) : isBizarroSorcerer(state) ? bizarroSorcererAbilityWheel(state, stance) : isShepherd(state) ? shepherdAbilityWheel(stance, state)
    : isPain(state) ? painAbilityWheel(stance, state)
    : isGuardian(state) ? guardianAbilityWheel(stance, state)
    : isDreamStealer(state) ? dreamStealerAbilityWheel(state, stance)
    : isTraveler(state) ? travelerAbilityWheel(state, stance)
    : isGatekeeper(state) ? gatekeeperAbilityWheel(state, stance)
    : isPriestOfLight(state) ? priestOfLightAbilityWheel(state, stance)
    : isOceanSinger(state) ? oceanSingerAbilityWheel(state, stance)
    : isMysticismMagister(state) ? mysticismMagisterAbilityWheel(state, stance)
    : isSpiritWarlock(state) ? spiritWarlockAbilityWheel(state, stance)
    : isCrimsonScholar(state) ? crimsonScholarAbilityWheel(state, stance)
    : isAstronomer(state) ? astronomerAbilityWheel(state, stance)
    : isDreamwalker(state) ? dreamwalkerAbilityWheel(state, stance)
    : isReaper(state) ? reaperAbilityWheel(state, stance)
    : isMarionettist(state) ? marionettistAbilityWheel(state, stance)
    : isDruid(state) ? druidAbilityWheel(stance, state)
    : isBiologist(state) ? biologistAbilityWheel(stance, state)
    : isHarvestpriest(state) ? harvestpriestAbilityWheel(stance, state)
    : isPhysician(state) ? physicianAbilityWheel(stance, state)
    : isCultivator(state) ? cultivatorAbilityWheel(stance, state)
    : isWinner(state) ? winnerAbilityWheel(stance, state)
    : isCalamityPriest(state) ? calamityPriestAbilityWheel(stance, state)
    : isLucky(state) ? luckyAbilityWheel(stance, state)
    : isMachine(state) ? machineAbilityWheel(stance, state)
    : isMentorDisorder(state) ? mentorDisorderAbilityWheel(stance, state)
    : isCorruptionBaron(state) ? corruptionBaronAbilityWheel(stance, state)
    : isBriber(state) ? briberAbilityWheel(stance, state)
    : isBarbarian(state) ? barbarianAbilityWheel(stance, state)
    : isPunishmentKnight(state) ? punishmentKnightAbilityWheel(stance, state)
    : isJudge(state) ? judgeAbilityWheel(stance, state)
    : isInterrogator(state) ? interrogatorAbilityWheel(stance, state)
    : isSheriff(state) ? sheriffAbilityWheel(stance, state)
    : isArbiter(state) ? arbiterAbilityWheel(stance, state)
    : isLawyer(state) ? lawyerAbilityWheel(stance, state)
    : isMonster(state) ? monsterAbilityWheel(stance, state)
    : isWraith(state) ? wraithAbilityWheel(stance, state)
    : isZombie(state) ? zombieAbilityWheel(stance, state)
    : isWerewolf(state) ? werewolfAbilityWheel(stance, state)
    : isMadman(state) ? madmanAbilityWheel(stance, state)
    : isPrisoner(state) ? prisonerAbilityWheel(stance, state)
    : isDesireApostle(state) ? desireApostleAbilityWheel(stance, state)
    : isDemon(state) ? demonAbilityWheel(stance, state)
    : isSerialKiller(state) ? serialKillerAbilityWheel(stance, state)
    : isUnwinged(state) ? unwingedAbilityWheel(stance, state)
    : isCriminal(state) ? criminalAbilityWheel(stance, state)
    : isRoseBishop(state) ? roseBishopAbilityWheel(stance, state)
    : isShadowAscetic(state) ? shadowAsceticAbilityWheel(stance, state)
    : isListener(state) ? listenerAbilityWheel(stance, state)
    : isSecretSupplicant(state) ? secretSupplicantAbilityWheel(stance, state)
    : isStarMystic(state) ? starMysticAbilityWheel(stance, state)
    : isScrollProfessor(state) ? scrollProfessorAbilityWheel(stance, state)
    : isWizard(state) ? wizardAbilityWheel(stance, state)
    : isCombatScholar(state) ? combatScholarAbilityWheel(stance, state)
    : isPryer(state) ? pryerAbilityWheel(stance, state)
    : isPleasure(state) ? pleasureAbilityWheel(stance, state)
    : isWitch(state) ? witchAbilityWheel(stance, state)
    : isInstigator(state) ? instigatorAbilityWheel(stance, state)
    : isAssassin(state) ? assassinAbilityWheel(stance, state)
    : isDawnPaladin(state) ? dawnPaladinAbilityWheel(stance, state)
    : isWeaponmaster(state) ? weaponmasterAbilityWheel(stance, state)
    : isGladiator(state) ? gladiatorAbilityWheel(stance, state)
    : isWarrior(state) ? warriorAbilityWheel(stance, state)
    : isFireThief(state) ? fireThiefAbilityWheel(stance)
    : isCryptologist(state) ? cryptologistAbilityWheel(stance, state)
    : isSwindler(state) ? swindlerAbilityWheel(stance, state)
    : isMarauder(state) ? marauderAbilityWheel(stance, state)
    : hasAstrologerCombat(state) ? astrologerAbilityWheel(stance, state.progression.sequence ?? 7)
    : isTrickmaster(state) ? trickmasterAbilityWheel(stance)
    : isApprentice(state) ? apprenticeAbilityWheel(stance)
    : hasSpiritmediumCombat(state) ? spiritmediumAbilityWheel(stance, state.progression.sequence!)
    : isGravedigger(state) ? gravediggerAbilityWheel(stance)
    : isCorpsecollector(state) ? corpsecollectorAbilityWheel(stance)
    : hasSunpriestCombat(state) ? sunpriestAbilityWheel(stance, state.progression.sequence!)
    : isLightprayer(state) ? lightprayerAbilityWheel(stance)
    : isBard(state) ? bardAbilityWheel(stance)
    : hasNavigatorCombat(state) ? navigatorAbilityWheel(stance, state.progression.sequence!)
    : isRager(state) ? ragerAbilityWheel(stance)
    : isSailor(state) ? sailorAbilityWheel(stance)
    : hasDetectiveCombat(state) ? detectiveAbilityWheel(stance, state.progression.sequence!)
    : isReasoner(state) ? reasonerAbilityWheel(stance)
    : isReader(state) ? readerAbilityWheel(stance)
    : hasNightmareCombat(state) ? nightmareAbilityWheel(stance)
    : isMidnight(state) ? midnightAbilityWheel(stance)
    : isSleepless(state) ? sleeplessAbilityWheel(stance)
    : isVampire(state) ? vampireAbilityWheel(stance)
    : isPsychologist(state) ? psychologistAbilityWheel(stance, state.progression.sequence!)
    : isPyromaniac(state) ? pyromaniacAbilityWheel(stance)
    : isMagician(state) ? magicianAbilityWheel(state, stance)
    : isClown(state) ? clownAbilityWheel(stance)
    : isSeer(state) ? seerAbilityWheel(stance)
    : isMindreader(state) ? mindreaderAbilityWheel(stance)
    : isAudience(state) ? audienceAbilityWheel(stance)
    : isProvoker(state) ? provokerAbilityWheel(stance)
    : isHunter(state) ? hunterAbilityWheel(stance) : ordinaryAbilityWheel(state.town.clubLocation==='HAND', stance);
  return state.town.clubLocation==='HAND'||marauderPlayerHoldsClub(state)?wheel.map(e=>(e.id==='STRIKE'||e.id==='BODY_STRIKE'||e.id==='TRICK_ATTACK'||e.id==='sun.s9.praise'||e.id==='sun.s8.light'||e.id==='sun.s7.holy-light'||e.id==='tyrant.s7.water-control'||e.id==='tyrant.s8.fury'||e.id==='tyrant.s9.physique'||e.id==='darkness.s9.night-vigor'||e.id==='darkness.s8.physical-training'||e.id==='reader.s9.ritual-tool'||e.id==='reader.s8.calculated-strike'||e.id==='reader.s7.weapon-combat')?{...e,label:marauderPlayerHoldsClub(state)?'持握塞蒙原短棍打击':'持握原短棍打击'}:e):wheel;
}

export function playerCountWheel(state: SliceState): SliceWheelEntry[] {
  return (isTimeWorm(state) ? TIME_WORM_COUNT_WHEEL : isStarKey(state) ? STAR_KEY_COUNT_WHEEL : isPaleEmperor(state) ? PALE_EMPEROR_COUNT_WHEEL : isPureWhiteAngel(state) ? PURE_WHITE_ANGEL_COUNT_WHEEL : isThunderGod(state) ? THUNDER_GOD_COUNT_WHEEL : isAllKnowingEye(state) ? ALL_KNOWING_EYE_COUNT_WHEEL : isMisfortuneKnight(state) ? MISFORTUNE_KNIGHT_COUNT_WHEEL : isBeautyGoddess(state) ? BEAUTY_GODDESS_COUNT_WHEEL : isCivilizationEnlightener(state) ? CIVILIZATION_ENLIGHTENER_COUNT_WHEEL : isWriter(state) ? WRITER_COUNT_WHEEL : isConqueror(state) ? CONQUEROR_COUNT_WHEEL : isAttendantMysteries(state) ? ATTENDANT_MYSTERIES_COUNT_WHEEL : isBarrenMatriarch(state) ? BARREN_MATRIARCH_COUNT_WHEEL : isBalancer(state) ? BALANCER_COUNT_WHEEL : isEntropyDuke(state) ? ENTROPY_DUKE_COUNT_WHEEL : isFateProphet(state) ? FATE_PROPHET_COUNT_WHEEL : isAncientEvil(state) ? ANCIENT_EVIL_COUNT_WHEEL : isBloodDuke(state) ? BLOOD_DUKE_COUNT_WHEEL : isElder(state) ? ELDER_COUNT_WHEEL : isSage(state) ? SAGE_COUNT_WHEEL : isCalamityDemoness(state) ? CALAMITY_DEMONESS_COUNT_WHEEL : isGlory(state) ? GLORY_COUNT_WHEEL : isFateTrojan(state) ? FATE_TROJAN_COUNT_WHEEL : isPlaneswalker(state) ? PLANESWALKER_COUNT_WHEEL : isDeathConsul(state) ? DEATH_CONSUL_COUNT_WHEEL : isLightSeeker(state) ? LIGHT_SEEKER_COUNT_WHEEL : isCatastrophe(state) ? CATASTROPHE_COUNT_WHEEL : isWisdomAngel(state) ? WISDOM_ANGEL_COUNT_WHEEL : isConcealmentServant(state) ? CONCEALMENT_SERVANT_COUNT_WHEEL : isLifeGiver(state) ? LIFE_GIVER_COUNT_WHEEL : isKnowledgeMentor(state) ? KNOWLEDGE_MENTOR_COUNT_WHEEL : isDiscerner(state) ? DISCERNER_COUNT_WHEEL : isWeatherWarlock(state) ? WEATHER_WARLOCK_COUNT_WHEEL : isCoffinBearer(state) ? COFFIN_BEARER_COUNT_WHEEL : isChaosHunter(state) ? CHAOS_HUNTER_COUNT_WHEEL : isFrenzyMage(state) ? FRENZY_MAGE_COUNT_WHEEL : isChaosWalker(state) ? CHAOS_WALKER_COUNT_WHEEL : isSilentDisciple(state) ? SILENT_DISCIPLE_COUNT_WHEEL : isBlatherer(state) ? BLATHERER_COUNT_WHEEL : isThreeHeadedTemplar(state) ? THREE_HEADED_TEMPLAR_COUNT_WHEEL : isProphecyMaster(state) ? PROPHECY_MASTER_COUNT_WHEEL : isUnagingDemoness(state) ? UNAGING_DEMONESS_COUNT_WHEEL : (isSilverKnight(state)||state.combat?.encounterId==='SILVER_KNIGHT_HUNT') ? SILVER_KNIGHT_COUNT_WHEEL : isDeceitMentor(state) ? DECEIT_MENTOR_COUNT_WHEEL : isWanderer(state) ? WANDERER_COUNT_WHEEL : isFerryman(state) ? FERRYMAN_COUNT_WHEEL : isJusticeMentor(state) ? JUSTICE_MENTOR_COUNT_WHEEL : isSeaKing(state) ? SEA_KING_COUNT_WHEEL : isInsightScholar(state) ? INSIGHT_SCHOLAR_COUNT_WHEEL : isFearBishop(state) ? FEAR_BISHOP_COUNT_WHEEL : isSummoningMaster(state) ? SUMMONING_MASTER_COUNT_WHEEL : isArcaneScholar(state) ? ARCANE_SCHOLAR_COUNT_WHEEL : isDreamWeaver(state) ? DREAM_WEAVER_COUNT_WHEEL : isWarBishop(state) ? WAR_BISHOP_COUNT_WHEEL : isMiracleWorker(state) ? MIRACLE_WORKER_COUNT_WHEEL : isAncientScholar(state) ? ANCIENT_SCHOLAR_COUNT_WHEEL : isAncientAlchemist(state) ? ANCIENT_ALCHEMIST_COUNT_WHEEL : isImperativeMage(state) ? IMPERATIVE_MAGE_COUNT_WHEEL : isFallenEarl(state) ? FALLEN_EARL_COUNT_WHEEL : isMisfortuneMage(state) ? MISFORTUNE_MAGE_COUNT_WHEEL : isPuppet(state) ? PUPPET_COUNT_WHEEL : isDevil(state) ? DEVIL_COUNT_WHEEL : isBlackKnight(state) ? BLACK_KNIGHT_COUNT_WHEEL : isMystic(state) ? MYSTIC_COUNT_WHEEL : isDespair(state) ? DESPAIR_COUNT_WHEEL : isDemonHunter(state) ? DEMON_HUNTER_COUNT_WHEEL : isParasite(state) ? PARASITE_COUNT_WHEEL : hasSecretsSorcererCombat(state) ? SECRETS_SORCERER_COUNT_WHEEL : isUndying(state) ? UNDYING_COUNT_WHEEL : isUnshadowed(state) ? UNSHADOWED_COUNT_WHEEL : isCataclysmPriest(state) ? CATACLYSM_PRIEST_COUNT_WHEEL : isProphet(state) ? PROPHET_COUNT_WHEEL : isNightwatcher(state) ? NIGHTWATCHER_COUNT_WHEEL : isWitchKing(state) ? WITCH_KING_COUNT_WHEEL : isAlchemist(state) ? ALCHEMIST_COUNT_WHEEL : isManipulator(state) ? MANIPULATOR_COUNT_WHEEL : isIronBloodKnight(state) ? IRON_BLOOD_COUNT_WHEEL : isBizarroSorcerer(state) ? BIZARRO_SORCERER_COUNT_WHEEL : isWinner(state) ? WINNER_COUNT_WHEEL : isShepherd(state) ? SHEPHERD_COUNT_WHEEL : isStarMystic(state) ? STAR_MYSTIC_COUNT_WHEEL : isPain(state) ? PAIN_COUNT_WHEEL : isGuardian(state) ? GUARDIAN_COUNT_WHEEL : isDreamStealer(state) ? DREAM_STEALER_COUNT_WHEEL : isTraveler(state) ? TRAVELER_COUNT_WHEEL : isGatekeeper(state) ? GATEKEEPER_COUNT_WHEEL : isPriestOfLight(state) ? PRIEST_OF_LIGHT_COUNT_WHEEL : isOceanSinger(state) ? OCEAN_SINGER_COUNT_WHEEL : isMysticismMagister(state) ? MYSTICISM_MAGISTER_COUNT_WHEEL : isSpiritWarlock(state) ? SPIRIT_WARLOCK_COUNT_WHEEL : isCrimsonScholar(state) ? CRIMSON_SCHOLAR_COUNT_WHEEL : isAstronomer(state) ? ASTRONOMER_COUNT_WHEEL : isDreamwalker(state) ? DREAMWALKER_COUNT_WHEEL : isReaper(state) ? REAPER_COUNT_WHEEL : isMarionettist(state) ? MARIONETTIST_COUNT_WHEEL : isDruid(state) ? DRUID_COUNT_WHEEL : isBiologist(state) ? BIOLOGIST_COUNT_WHEEL : isHarvestpriest(state) ? HARVESTPRIEST_COUNT_WHEEL : isPhysician(state) ? PHYSICIAN_COUNT_WHEEL : isCultivator(state) ? CULTIVATOR_COUNT_WHEEL : isCalamityPriest(state) ? CALAMITY_PRIEST_COUNT_WHEEL : isLucky(state) ? LUCKY_COUNT_WHEEL : isMachine(state) ? MACHINE_COUNT_WHEEL : isMentorDisorder(state) ? MENTOR_DISORDER_COUNT_WHEEL : isCorruptionBaron(state) ? CORRUPTION_BARON_COUNT_WHEEL : isBriber(state) ? BRIBER_COUNT_WHEEL : isBarbarian(state) ? BARBARIAN_COUNT_WHEEL : isPunishmentKnight(state) ? PUNISHMENT_KNIGHT_COUNT_WHEEL : isJudge(state) ? JUDGE_COUNT_WHEEL : isInterrogator(state) ? INTERROGATOR_COUNT_WHEEL : isSheriff(state) ? SHERIFF_COUNT_WHEEL : isArbiter(state) ? ARBITER_COUNT_WHEEL : isLawyer(state) ? LAWYER_COUNT_WHEEL : isMonster(state) ? MONSTER_COUNT_WHEEL : isWraith(state) ? WRAITH_COUNT_WHEEL : isZombie(state) ? ZOMBIE_COUNT_WHEEL : isWerewolf(state) ? WEREWOLF_COUNT_WHEEL : isMadman(state) ? MADMAN_COUNT_WHEEL : isPrisoner(state) ? PRISONER_COUNT_WHEEL : isDesireApostle(state) ? DESIRE_APOSTLE_COUNT_WHEEL : isDemon(state) ? DEMON_COUNT_WHEEL : isSerialKiller(state) ? SERIAL_KILLER_COUNT_WHEEL : isUnwinged(state) ? UNWINGED_COUNT_WHEEL : isCriminal(state) ? CRIMINAL_COUNT_WHEEL : isRoseBishop(state) ? ROSE_BISHOP_COUNT_WHEEL : isShadowAscetic(state) ? SHADOW_ASCETIC_COUNT_WHEEL : isListener(state) ? LISTENER_COUNT_WHEEL : isSecretSupplicant(state) ? SECRET_SUPPLICANT_COUNT_WHEEL : isScrollProfessor(state) ? SCROLL_PROFESSOR_COUNT_WHEEL : isWizard(state) ? WIZARD_COUNT_WHEEL : isCombatScholar(state) ? COMBAT_SCHOLAR_COUNT_WHEEL : isPryer(state) ? PRYER_COUNT_WHEEL : isPleasure(state) ? PLEASURE_COUNT_WHEEL : isWitch(state) ? WITCH_COUNT_WHEEL : isInstigator(state) ? INSTIGATOR_COUNT_WHEEL : isAssassin(state) ? ASSASSIN_COUNT_WHEEL : isDawnPaladin(state) ? DAWN_PALADIN_COUNT_WHEEL : isWeaponmaster(state) ? WEAPONMASTER_COUNT_WHEEL : isGladiator(state) ? GLADIATOR_COUNT_WHEEL : isWarrior(state) ? WARRIOR_COUNT_WHEEL : isFireThief(state) ? FIRE_THIEF_COUNT_WHEEL : isCryptologist(state) ? CRYPTOLOGIST_COUNT_WHEEL : isSwindler(state) ? SWINDLER_COUNT_WHEEL : isMarauder(state) ? MARAUDER_COUNT_WHEEL : hasAstrologerCombat(state) ? ASTROLOGER_COUNT_WHEEL : isTrickmaster(state) ? TRICKMASTER_COUNT_WHEEL : isApprentice(state) ? APPRENTICE_COUNT_WHEEL : hasSpiritmediumCombat(state) ? SPIRITMEDIUM_COUNT_WHEEL : isGravedigger(state) ? GRAVEDIGGER_COUNT_WHEEL : isCorpsecollector(state) ? CORPSECOLLECTOR_COUNT_WHEEL : hasSunpriestCombat(state) ? SUNPRIEST_COUNT_WHEEL : isLightprayer(state) ? LIGHTPRAYER_COUNT_WHEEL : isBard(state) ? BARD_COUNT_WHEEL : hasNavigatorCombat(state) ? NAVIGATOR_COUNT_WHEEL : isRager(state) ? RAGER_COUNT_WHEEL : isSailor(state) ? SAILOR_COUNT_WHEEL : hasDetectiveCombat(state) ? DETECTIVE_COUNT_WHEEL : isReasoner(state) ? REASONER_COUNT_WHEEL : isReader(state) ? READER_COUNT_WHEEL : hasNightmareCombat(state) ? NIGHTMARE_COUNT_WHEEL : isMidnight(state) ? MIDNIGHT_COUNT_WHEEL : isSleepless(state) ? SLEEPLESS_COUNT_WHEEL : isVampire(state) ? VAMPIRE_COUNT_WHEEL : isAppraiser(state) || isArtisan(state) ? APPRAISER_COUNT_WHEEL : isPsychologist(state) ? PSYCHOLOGIST_COUNT_WHEEL : isPyromaniac(state) ? PYROMANIAC_COUNT_WHEEL : isMagician(state) ? MAGICIAN_COUNT_WHEEL : isClown(state) ? CLOWN_COUNT_WHEEL : isSeer(state) ? SEER_COUNT_WHEEL
    : isMindreader(state) ? MINDREADER_COUNT_WHEEL
    : isAudience(state) ? AUDIENCE_COUNT_WHEEL
    : isProvoker(state) ? PROVOKER_COUNT_WHEEL
    : isHunter(state) ? HUNTER_COUNT_WHEEL : ORDINARY_COUNT_WHEEL)
    .map((entry) => ({ ...entry }));
}

/** k is the number of defeats sustained while already injured, not injury count. */
export function consequenceWeights(k: number): ConsequenceWeights {
  if (!Number.isSafeInteger(k) || k < 0) throw new RangeError('伤势风险计数无效');
  const death = Math.min(100, 5 + Math.min(k, 10) * 10);
  const shifted = death - 5;
  return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death };
}

/** Conditional next losing injury-branch weights; not an unconditional round death chance. */
export function nextLosingInjuryWeights(s: Pick<SliceState, 'injuries' | 'injuryRisk'>): ConsequenceWeights {
  return consequenceWeights(s.injuries.length ? s.injuryRisk + 1 : 0);
}

export function statusPenalty(current: number, maximum: number): number {
  const fraction = Math.max(0, Math.min(1, current / maximum));
  if (fraction > 0.75) return 0;
  if (fraction > 0.5) return 0.05;
  if (fraction > 0.25) return 0.1;
  return 0.2;
}

export function baseAdvantage(
  core: number, health: number, mind: number, spirituality: number, tier = 100, maxSpirituality = 15,
): number {
  const penalty = Math.min(0.4,
    statusPenalty(health, 100) + statusPenalty(mind, 100) + statusPenalty(spirituality, maxSpirituality));
  return (tier + Math.min(core, tier * 0.2)) * (1 - penalty);
}

function drawAbility(random: DeterministicActionRandomStream, stance: SliceStance | null) {
  // Integer tickets preserve the exact ×1.25 ratio; do not round public percentages.
  const tickets = abilityTickets(stance);
  let roll = random.nextInt(1, tickets.reduce((sum, weight) => sum + weight, 0));
  for (let index = 0; index < ABILITIES.length; index += 1) {
    roll -= tickets[index]!;
    if (roll <= 0) return ABILITIES[index]!;
  }
  throw new Error('普通能力盘权重无效');
}

function actionCount(roll: number): number {
  return roll <= 45 ? 1 : roll <= 85 ? 2 : 3;
}

/**
 * Resolve a complete duel round on a caller-owned draft. Arc/ending
 * transitions and revision commits belong to the application/domain caller.
 */
export function resolveSliceCombatRound(
  state: SliceState, stance: SliceStance, ragePolicy: RagerRagePolicy = 'HOLD',
  madmanPolicy: MadmanBurstPolicy = 'HOLD', recordingId: string | null = null,
  winnerPolicy: WinnerLuckPolicy = 'HOLD', ironBloodPolicy: IronBloodSharePolicy = 'HOLD', puppetCurse = false, warBishopPolicy: WarBishopPolicy = 'HOLD',
): { round: SliceCombatRound; outcome: CombatOutcome } {
  if(state.combat?.encounterId==='COFFIN_BEARER_DISPUTE')return resolveCoffinBearerCombatRound(state,stance);
  if(state.combat?.encounterId==='CHAOS_HUNTER_DISPUTE')return resolveChaosHunterCombatRound(state,stance);
  if(state.combat?.encounterId==='FRENZY_MAGE_DISPUTE')return resolveFrenzyMageCombatRound(state,stance);
  if(state.combat?.encounterId==='CHAOS_WALKER_DISPUTE')return resolveChaosWalkerCombatRound(state,stance,winnerPolicy);
  if(state.combat?.encounterId==='SILENT_DISCIPLE_DISPUTE')return resolveSilentDiscipleCombatRound(state,stance,puppetCurse,madmanPolicy);
  if(state.combat?.encounterId==='BLATHERER_COURT')return resolveBlathererCombatRound(state,stance);
  if(state.combat?.encounterId==='THREE_HEADED_TEMPLAR_DISPUTE')return resolveThreeHeadedTemplarCombatRound(state,stance);
  if(state.combat?.encounterId==='PROPHECY_MASTER_DISPUTE')return resolveProphecyMasterCombatRound(state,stance);
  if(state.combat?.encounterId==='UNAGING_DEMONESS_DISPUTE')return resolveUnagingDemonessCombatRound(state,stance);
  if(state.combat?.encounterId==='SILVER_KNIGHT_HUNT'||state.combat?.encounterId==='SILVER_KNIGHT_DISPUTE')return resolveSilverKnightCombatRound(state,stance);
  if(state.combat?.encounterId==='DECEIT_MENTOR_DISPUTE'||isDeceitMentor(state))return resolveDeceitMentorCombatRound(state,stance);
  if(state.combat?.encounterId==='WANDERER_DISPUTE'||isWanderer(state))return resolveWandererCombatRound(state,stance);
  if(state.combat?.encounterId==='FERRYMAN_DISPUTE'||isFerryman(state))return resolveFerrymanCombatRound(state,stance);
  if(state.combat?.encounterId==='JUSTICE_MENTOR_DISPUTE'||isJusticeMentor(state))return resolveJusticeMentorCombatRound(state,stance);
  if(state.combat?.encounterId==='SEA_KING_DISPUTE'||isSeaKing(state))return resolveSeaKingCombatRound(state,stance);
  if(state.combat?.encounterId==='INSIGHT_SCHOLAR_DISPUTE'||isInsightScholar(state))return resolveInsightScholarCombatRound(state,stance);
  if(state.combat?.encounterId==='FEAR_BISHOP_DISPUTE'||isFearBishop(state))return resolveFearBishopCombatRound(state,stance);
  if(state.combat?.encounterId==='SUMMONING_MASTER_DISPUTE'||isSummoningMaster(state))return resolveSummoningMasterCombatRound(state,stance);
  if(state.combat?.encounterId==='ARCANE_SCHOLAR_DISPUTE'||isArcaneScholar(state))return resolveArcaneScholarCombatRound(state,stance);
  if(state.combat?.encounterId==='DREAM_WEAVER_DISPUTE'||isDreamWeaver(state))return resolveDreamWeaverCombatRound(state,stance);
  if(state.combat?.encounterId==='PALE_EMPEROR_DISPUTE')return resolvePaleEmperorCombatRound(state,stance);
  if(state.combat?.encounterId==='PURE_WHITE_ANGEL_DISPUTE')return resolvePureWhiteAngelCombatRound(state,stance);
  if(state.combat?.encounterId==='THUNDER_GOD_DISPUTE')return resolveThunderGodCombatRound(state,stance);
  if(state.combat?.encounterId==='TIME_WORM_DISPUTE')return resolveTimeWormCombatRound(state,stance);
  if(state.combat?.encounterId==='STAR_KEY_DISPUTE')return resolveStarKeyCombatRound(state,stance);
  if(state.combat?.encounterId==='ALL_KNOWING_EYE_DISPUTE')return resolveAllKnowingEyeCombatRound(state,stance);
  if(state.combat?.encounterId==='MISFORTUNE_KNIGHT_DISPUTE')return resolveMisfortuneKnightCombatRound(state,stance);
  if(state.combat?.encounterId==='BEAUTY_GODDESS_DISPUTE')return resolveBeautyGoddessCombatRound(state,stance);
  if(state.combat?.encounterId==='CIVILIZATION_ENLIGHTENER_DISPUTE')return resolveCivilizationEnlightenerCombatRound(state,stance);
  if(state.combat?.encounterId==='WRITER_DISPUTE')return resolveWriterCombatRound(state,stance);
  if(state.combat?.encounterId==='CONQUEROR_DISPUTE')return resolveConquerorCombatRound(state,stance);
  if(state.combat?.encounterId==='ATTENDANT_MYSTERIES_DISPUTE')return resolveAttendantMysteriesCombatRound(state,stance);
  if(state.combat?.encounterId==='BARREN_MATRIARCH_DISPUTE')return resolveBarrenMatriarchCombatRound(state,stance);
  if(state.combat?.encounterId==='BALANCER_DISPUTE')return resolveBalancerCombatRound(state,stance);
  if(state.combat?.encounterId==='ENTROPY_DUKE_DISPUTE')return resolveEntropyDukeCombatRound(state,stance);
  if(state.combat?.encounterId==='FATE_PROPHET_DISPUTE')return resolveFateProphetCombatRound(state,stance,winnerPolicy);
  if(state.combat?.encounterId==='ANCIENT_EVIL_DISPUTE')return resolveAncientEvilCombatRound(state,stance,puppetCurse,madmanPolicy);
  if(state.combat?.encounterId==='BLOOD_DUKE_DISPUTE')return resolveBloodDukeCombatRound(state,stance);
  if(state.combat?.encounterId==='ELDER_DISPUTE')return resolveElderCombatRound(state,stance);
  if(state.combat?.encounterId==='SAGE_DISPUTE')return resolveSageCombatRound(state,stance);
  if(state.combat?.encounterId==='CALAMITY_DEMONESS_DISPUTE')return resolveCalamityDemonessCombatRound(state,stance);
  if(state.combat?.encounterId==='GLORY_DISPUTE')return resolveGloryCombatRound(state,stance);
  if(state.combat?.encounterId==='FATE_TROJAN_DISPUTE')return resolveFateTrojanCombatRound(state,stance);
  if(state.combat?.encounterId==='PLANESWALKER_DISPUTE')return resolvePlaneswalkerCombatRound(state,stance);
  if(state.combat?.encounterId==='DEATH_CONSUL_DISPUTE')return resolveDeathConsulCombatRound(state,stance);
  if(state.combat?.encounterId==='LIGHT_SEEKER_DISPUTE')return resolveLightSeekerCombatRound(state,stance);
  if(state.combat?.encounterId==='CATASTROPHE_DISPUTE')return resolveCatastropheCombatRound(state,stance);
  if(state.combat?.encounterId==='WISDOM_ANGEL_DISPUTE')return resolveWisdomAngelCombatRound(state,stance);
  if(state.combat?.encounterId==='CONCEALMENT_SERVANT_DISPUTE')return resolveConcealmentServantCombatRound(state,stance);
  if(state.combat?.encounterId==='LIFE_GIVER_DISPUTE')return resolveLifeGiverCombatRound(state,stance);
  if(state.combat?.encounterId==='KNOWLEDGE_MENTOR_DISPUTE')return resolveKnowledgeMentorCombatRound(state,stance);
  if(state.combat?.encounterId==='DISCERNER_DISPUTE')return resolveDiscernerCombatRound(state,stance);
  if(state.combat?.encounterId==='WEATHER_WARLOCK_DISPUTE')return resolveWeatherWarlockCombatRound(state,stance,warBishopPolicy);
  if(state.combat?.encounterId==='WAR_BISHOP_DISPUTE'||isWarBishop(state))return resolveWarBishopCombatRound(state,stance,warBishopPolicy);
  if(state.combat?.encounterId==='MIRACLE_WORKER_DISPUTE')return resolveMiracleWorkerCombatRound(state,stance);
  if(state.combat?.encounterId==='ANCIENT_SCHOLAR_DISPUTE'||isAncientScholar(state))return resolveAncientScholarCombatRound(state,stance);
  if(state.combat?.encounterId==='ANCIENT_ALCHEMIST_DISPUTE'||isAncientAlchemist(state))return resolveAncientAlchemistCombatRound(state,stance);
  if(state.combat?.encounterId==='IMPERATIVE_MAGE_DISPUTE'||isImperativeMage(state))return resolveImperativeMageCombatRound(state,stance);
  if(state.combat?.encounterId==='FALLEN_EARL_DISPUTE'||isFallenEarl(state))return resolveFallenEarlCombatRound(state,stance);
  if(state.combat?.encounterId==='MISFORTUNE_MAGE_DISPUTE'||isMisfortuneMage(state))return resolveMisfortuneMageCombatRound(state,stance,winnerPolicy);
  if(state.combat?.encounterId==='PUPPET_DISPUTE'||isPuppet(state))return resolvePuppetCombatRound(state,stance,puppetCurse,madmanPolicy);
  if(state.combat?.encounterId==='DEVIL_DISPUTE'||isDevil(state))return resolveDevilCombatRound(state,stance);
  if(state.combat?.encounterId==='BLACK_KNIGHT_DISPUTE'||isBlackKnight(state))return resolveBlackKnightCombatRound(state,stance);
  if(state.combat?.encounterId==='MYSTIC_DISPUTE'||isMystic(state))return resolveMysticCombatRound(state,stance);
  if(state.combat?.encounterId==='DESPAIR_DISPUTE'||isDespair(state))return resolveDespairCombatRound(state,stance);
  const combat = state.combat;
  if (!combat || state.status !== 'ACTIVE' || combat.enemyStatus !== 'RESISTING' ||
      state.health <= 0 || combat.enemyHealth <= 0) {
    throw new Error('当前没有可以继续的战斗');
  }
  if ((combat.encounterId === 'DEMON_HUNTER_DISPUTE' || isDemonHunter(state)) && !currentDemonHunterCombatSource(state)) {
    throw new Error('猎魔者缺少当前原身体、原哨卫或首案来源；先结束真实生活接触。');
  }
  if ((combat.encounterId === 'PARASITE_DISPUTE' || isParasite(state)) && !currentParasiteCombatSource(state)) {
    throw new Error('缺少寄生者当前原身体、原活敌、接触收束或连续回合来源。');
  }
  if ((combat.encounterId === 'UNDYING_DISPUTE' || isUndying(state)) && !currentUndyingCombatSource(state)) {
    throw new Error('缺少不死者当前原欧文、原棍、原身体或连续回合来源。');
  }
  if ((combat.encounterId === 'UNSHADOWED_DISPUTE' || isUnshadowed(state)) && !currentUnshadowedCombatSource(state)) {
    throw new Error('缺少无暗者当前原埃德蒙、原棍、实际净空原石院或连续回合来源。');
  }
  if ((combat.encounterId === 'CATACLYSM_PRIEST_DISPUTE' || isCataclysmPriest(state)) && !currentCataclysmPriestCombatSource(state)) {
    throw new Error('缺少灾难主祭当前原本尼迪克特、原棍、原码头或连续回合来源。');
  }
  if ((combat.encounterId === 'PROPHET_DISPUTE' || isProphet(state)) && !currentProphetCombatSource(state)) {
    throw new Error('缺少预言家当前原哈罗德、原短棍或连续回合来源。');
  }
  if ((combat.encounterId === 'NIGHTWATCHER_DISPUTE' || isNightwatcher(state)) && !currentNightwatcherCombatSource(state)) {
    throw new Error('缺少守夜人本场原布拉姆·洛、原短棍或连续回合来源。');
  }
  if ((combat.encounterId === 'WITCH_KING_DISPUTE' || isWitchKing(state)) && !currentWitchKingCombatSource(state)) {
    throw new Error('巫王只支持当前原多里安、原棍、原练习院与连续回合，不借旧对手或自动复制原纸');
  }
  if ((combat.encounterId === 'ALCHEMIST_DISPUTE' || isAlchemist(state)) && !currentAlchemistCombatSource(state)) {
    throw new Error('炼金术士只支持当前原奥斯里克、原棍、原工坊空院与连续回合，不借旧对手或复制造物');
  }
  if ((combat.encounterId === 'MANIPULATOR_DISPUTE' || isManipulator(state)) && !currentManipulatorCombatSource(state)) {
    throw new Error('操纵师只支持当前同场原鲁兰、原棍与连续回合；不能借首案或旧马斯心灵来源');
  }
  if ((combat.encounterId === 'IRON_BLOOD_DISPUTE' || isIronBloodKnight(state)) && !currentIronBloodCombatSource(state)) {
    throw new Error('铁血骑士当前原加里克、原空石院、原队员或连续回合来源无效');
  }
  if (hasSecretsSorcererCombat(state) && !hasSecretsSorcererOpponent(state)) throw new Error('秘法师原石拱的实际原活敌、原框箱、本人到场或连续回合来源无效');
  if ((combat.encounterId === 'BIZARRO_RITUAL' || isBizarroSorcerer(state)) && !hasBizarroRitualOpponent(state)) {
    throw new Error('诡法师原钟院的实际原活体、独立场次、连续回合或本人的真实到场来源无效');
  }
  if ((combat.encounterId === 'WINNER_DISPUTE' || isWinner(state)) && !currentWinnerCombatSource(state)) {
    throw new Error('赢家只支持实际到场的奥德里原日光外院冲突；不能借旧对手、假目标或未收束练习来源');
  }
  if ((combat.encounterId === 'SHEPHERD_DISPUTE' || isShepherd(state)) && !currentShepherdCombatSource(state)) {
    throw new Error('牧羊人只支持实际到场的埃尔顿原日光空院冲突；不能借首案、旧维恩或虚构原灵来源');
  }
  if ((combat.encounterId === 'STAR_MYSTIC_DISPUTE' || isStarMystic(state)) && !currentStarMysticCombatSource(state)) {
    throw new Error('星象师只支持真实到场的布莱斯原空院冲突；不能借首案伪造原敌、眼镜或未来信息');
  }
  if ((combat.encounterId === 'PAIN_DISPUTE' || isPain(state)) && !currentPainCombatSource(state)) {
    throw new Error('痛苦魔女只支持本段实际到场的原奥伦空院冲突；首案携铃者不借用此处疾病场、原丝线或原敌');
  }
  if ((combat.encounterId === 'GUARDIAN_DISPUTE' || isGuardian(state)) && !currentGuardianCombatSource(state)) {
    throw new Error('守护者的原身体、当前实际原敌、连续回合或日常守护收束来源无效');
  }
  if ((combat.encounterId === 'DREAM_STEALER_DISPUTE' || isDreamStealer(state)) && !currentDreamStealerCombatSource(state)) {
    throw new Error('窃梦家的当前原身体、可见普通活敌、真实到场、连续回合或念头实践收束来源无效');
  }
  if ((combat.encounterId === 'TRAVELER_DISPUTE' || (isTraveler(state) && combat.encounterId !== 'SECRETS_SORCERER_RITUAL')) && !currentTravelerCombatSource(state)) {
    throw new Error('旅行家的当前原身体、原活敌、真实到场、连续回合或原路线、木牌与同伴收束来源无效');
  }
  if ((combat.encounterId === 'GATEKEEPER_DISPUTE' || isGatekeeper(state)) && !currentGatekeeperCombatSource(state)) {
    throw new Error('看门人的当前原身体、2米原活敌、真实到场、连续回合或实际关门、接触、原灵与原木牌收束来源无效');
  }
  if ((combat.encounterId === 'PRIEST_OF_LIGHT_DISPUTE' || isPriestOfLight(state)) && !currentPriestOfLightCombatSource(state)) {
    throw new Error('光之祭司的当前原身体、2米原活敌、真实到场、连续回合或实际光环、友好灵体与冰内仪式收束来源无效');
  }
  if ((combat.encounterId === 'OCEAN_SINGER_DISPUTE' || isOceanSinger(state)) && !currentOceanSingerCombatSource(state)) {
    throw new Error('海洋歌者的当前原身体、2米原活敌、真实到场、连续回合或实际歌声、同伴与海岸仪式收束来源无效');
  }
  if ((combat.encounterId === 'MYSTICISM_MAGISTER_DISPUTE' || isMysticismMagister(state)) && !currentMysticismMagisterCombatSource(state)) {
    throw new Error('秘术导师的当前原身体、2米原活敌、真实到场、连续回合或实际接触与仪式收束来源无效');
  }
  if ((combat.encounterId === 'SPIRIT_WARLOCK_DISPUTE' || isSpiritWarlock(state)) && !currentSpiritWarlockCombatSource(state)) {
    throw new Error('灵巫的当前原身体、原活敌、真实到场、连续回合或生活接触收束来源无效');
  }
  if ((combat.encounterId === 'CRIMSON_SCHOLAR_DISPUTE' || isCrimsonScholar(state)) && !currentCrimsonScholarCombatSource(state)) {
    throw new Error('深红学者的当前原身体、原活敌、真实夜间到场、连续回合与实践收束来源无效');
  }
  if ((combat.encounterId === 'ASTRONOMER_DISPUTE' || isAstronomer(state)) && !currentAstronomerCombatSource(state)) {
    throw new Error('天文学家的当前到场、原身体、回合记录、三项报告收束与原活敌来源无效');
  }
  if ((combat.encounterId === 'DREAMWALKER_DISPUTE' || isDreamwalker(state)) && !currentDreamwalkerCombatSource(state)) {
    throw new Error('梦境行者的当前到场、清醒活敌、回合记录、仪式与练习收束来源无效');
  }
  if ((combat.encounterId === 'REAPER_DISPUTE' || isReaper(state)) && !currentReaperCombatSource(state)) {
    throw new Error('收割者的当前到场、回合记录、练习收束与维克真实活敌来源无效');
  }
  if ((combat.encounterId === 'MARIONETTIST_DISPUTE' || isMarionettist(state)) && !currentMarionettistCombatSource(state)) {
    throw new Error('秘偶大师的本场真实活人、回合记录、练习收束或原身体唯一来源无效');
  }
  if ((combat.encounterId === 'DRUID_DISPUTE' || isDruid(state)) && !currentDruidCombatSource(state)) {
    throw new Error('德鲁伊的当前原活体、连续回合、已知现场或新旧实践实际收束来源无效');
  }
  if ((combat.encounterId === 'BIOLOGIST_DISPUTE' || isBiologist(state)) && !currentBiologistCombatSource(state)) {
    throw new Error('生物学家的当前到场、回合记录、原苗木实践收束与洛恩真实活体来源无效');
  }
  if ((combat.encounterId === 'PUNISHMENT_KNIGHT_DISPUTE' || isPunishmentKnight(state)) && !currentPunishmentKnightCombatSource(state)) {
    throw new Error('惩戒骑士的当前到场、原活敌、连续回合与新旧实践收束来源无效');
  }
  if ((combat.encounterId === 'JUDGE_DISPUTE' || isJudge(state)) && !currentJudgeCombatSource(state)) {
    throw new Error('法官的当前到场、回合记录、练习收束与埃文真实活体来源无效');
  }
  if ((combat.encounterId === 'MENTOR_DISORDER_DISPUTE' || isMentorDisorder(state)) && !currentMentorDisorderCombatSource(state)) {
    throw new Error('混乱导师的当前到场、回合记录、原练习收束与里斯真实活体来源无效');
  }
  if ((combat.encounterId === 'CORRUPTION_BARON_DISPUTE' || isCorruptionBaron(state)) && !currentCorruptionBaronCombatSource(state)) {
    throw new Error('腐化男爵的当前到场、回合记录、练习收束与沃恩真实活体来源无效');
  }
  if ((combat.encounterId === 'CALAMITY_PRIEST_DISPUTE' || isCalamityPriest(state)) && !currentCalamityPriestCombatSource(state)) {
    throw new Error('灾祸教士的当前到场、回合记录、练习收束与杜兰真实活体来源无效');
  }
  if ((combat.encounterId === 'WRAITH_DISPUTE' || isWraith(state)) && !currentWraithCombatSource(state)) {
    throw new Error('原工坊独立日光外院的实际到场、完整显形本人、回合记录与贝文活体来源无效，或满月虚弱尚未度过');
  }
  if ((combat.encounterId === 'ZOMBIE_DISPUTE' || isZombie(state)) && !currentZombieCombatSource(state)) {
    throw new Error('活尸的真实对手与原现场、月相处理、练习收束或当前回合来源无效');
  }
  if ((combat.encounterId === 'DESIRE_APOSTLE_DISPUTE' || isDesireApostle(state)) && !currentDesireApostleCombatSource(state)) {
    throw new Error('欲望使徒只支持实际到场的费兰原日光空院冲突；不能借首案、莫顿或虚构情绪来源');
  }
  if ((combat.encounterId === 'DEMON_DISPUTE' || isDemon(state)) && !currentDemonCombatSource(state)) {
    throw new Error('原旧货库独立外院的实际到场、正常本人身体、已熄练习火、回合记录与莫顿活体来源无效');
  }
  if ((combat.encounterId === 'ROSE_BISHOP_DISPUTE' || isRoseBishop(state)) && !currentRoseBishopCombatSource(state)) {
    throw new Error('原独立日光外院的实际到场、正常本人身体、回合记录与维恩活体来源无效');
  }
  if ((combat.encounterId === 'SCROLL_PROFESSOR_DISPUTE' || isScrollProfessor(state)) && !currentScrollProfessorCombatSource(state)) {
    throw new Error('原卷轴教学空院的当前到场、回合记录与卡尔活体来源无效');
  }
  if ((combat.encounterId === 'PLEASURE_DISPUTE' || isPleasure(state)) && !currentPleasureCombatSource(state)) {
    throw new Error('原独立练习空院的当前到场、回合记录、丝线状态与马伦来源无效');
  }
  if ((combat.encounterId === 'DAWN_PALADIN_DISPUTE' || isDawnPaladin(state)) && !currentDawnPaladinCombatSource(state)) {
    throw new Error('原训练场外空院的实际到场、回合记录、剑甲状态与罗尔德来源无效');
  }
  if ((combat.encounterId === 'FIRE_THIEF_DISPUTE' || isFireThief(state)) && !currentFireThiefCombatSource(state)) {
    throw new Error('原导师练习场外空院的当前到场、回合记录与贝林来源无效');
  }
  if ((combat.encounterId === 'RECORDER_DISPUTE' || isRecorder(state)) && !currentRecorderCombatSource(state)) {
    throw new Error('原教学室外空院的当前到场、回合记录与弥尔来源无效');
  }
  if (recordingId !== null && (typeof recordingId !== 'string' || !isRecorder(state) ||
      storedRecorderCombatRecord(state, recordingId) === null)) {
    throw new TypeError('当前序列或选定原记录无效；只能选择本人的真实未释放记录');
  }
  if (combat.encounterId === 'WIND_BLESSED_DISPUTE' && !currentWindBlessedCombatSource(state)) {
    throw new Error('原维修院外院的当前到场、地面位置、回合记录与鲁恩来源无效');
  }
  if ((combat.encounterId === 'SPIRIT_GUIDE_DISPUTE' || isSpiritGuide(state)) && !currentSpiritGuideCombatSource(state)) {
    throw new Error('原纪念工作室外空院的当前到场、回合记录与迪恩来源无效');
  }
  if (combat.encounterId === 'NOTARY_DISPUTE' && !currentNotaryCombatSource(state)) {
    throw new Error('原小教堂工作间外空院的当前到场、回合记录与布伦来源无效');
  }
  if (combat.encounterId === 'POLYMATH_DISPUTE' && !currentPolymathCombatSource(state)) {
    throw new Error('原借阅馆教学室外空院的当前到场、回合记录与伊恩来源无效');
  }
  if (combat.encounterId === 'ARTISAN_DISPUTE' && !currentArtisanCombatSource(state)) {
    throw new Error('原工房外院的当前到场与对手来源无效');
  }
  if (combat.encounterId === 'POTION_PROFESSOR_DISPUTE' && !currentPotionProfessorCombatSource(state)) {
    throw new Error('原夜间药房外院的当前到场、原灯影与对手来源无效');
  }
  if (combat.encounterId === 'SOOTHER_DISPUTE' && !currentSootherNightSource(state)) {
    throw new Error('原夜间值班室外空院的当前到场、回合记录与阿兰来源无效');
  }
  if (!Number.isSafeInteger(combat.round) || combat.round < 1) throw new RangeError('战斗回合无效');
  if (!(['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const).includes(stance)) {
    throw new TypeError('战术姿态无效');
  }
  if (ragePolicy !== 'HOLD' && ragePolicy !== 'RELEASE_FIRST') throw new TypeError('怒击策略无效');
  if (ragePolicy === 'RELEASE_FIRST' && !hasRagerWrath(state)) throw new TypeError('当前序列不能选择怒击策略');
  if (madmanPolicy !== 'HOLD' && madmanPolicy !== 'BURST_FIRST') throw new TypeError('理智爆发策略无效');
  if (madmanPolicy === 'BURST_FIRST' && !isMadman(state) && !isWerewolf(state) && !isZombie(state) && !isWraith(state)) throw new TypeError('当前序列不能选择理智爆发策略');
  if (winnerPolicy !== 'HOLD' && winnerPolicy !== 'SPEND_FIRST') throw new TypeError('积运策略无效');
  if (winnerPolicy === 'SPEND_FIRST' && !isWinner(state)) throw new TypeError('当前序列不能选择积运策略');
  const fireThiefExpiration = isFireThief(state) ? beginFireThiefCombatRound(state) : null;
  const madmanRound: MadmanRoundPolicy = { policy: madmanPolicy, triggered: false, mentalCost: 0, spiritualCost: 0 };
  const recorderRound: RecorderRoundContext = { recordingId, released: false };
  const travelerRecorderRound = createTravelerRecorderRound(state);
  const secretsSorcererRecorderRound = createSecretsSorcererRecorderRound(state);
  const rageRound: RagerRoundPolicy = { policy: ragePolicy, released: false };
  const random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
  const winner = isWinner(state);
  const winnerSource = winner ? currentWinnerCombatSource(state) : null;
  const calamityPriest = isCalamityPriest(state);
  const calamityPriestSource = calamityPriest ? currentCalamityPriestCombatSource(state) : null;
  const lucky = isLucky(state);
  const luckySource = lucky ? currentLuckyCombatSource(state) : null;
  // Passive luck has its own single draw before either participant's counts.
  const passiveLuck = winner
    ? drawWinnerPassiveLuck(state, stance, 1 - statusPenalty(state.health, 100), random, winnerSource)
    : calamityPriest
    ? drawCalamityPriestPassiveLuck(state, stance, 1 - statusPenalty(state.health, 100), random, calamityPriestSource)
    : lucky
    ? drawLuckyPassiveLuck(state, stance, 1 - statusPenalty(state.health, 100), random, luckySource) : null;
  // Separate draws even when both participants use the same distribution.
  const playerCountRoll = random.nextInt(1, 100);
  const enemyCountRoll = random.nextInt(1, 100);
  const first: Actor = combat.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
  const druid = isDruid(state);
  const druidSource = druid ? currentDruidCombatSource(state) : null;
  const biologist = isBiologist(state);
  const biologistSource = biologist ? currentBiologistCombatSource(state) : null;
  const harvestpriest = isHarvestpriest(state);
  const harvestpriestSource = harvestpriest ? currentHarvestpriestCombatSource(state) : null;
  const physician = isPhysician(state);
  const physicianSource = physician ? currentPhysicianCombatSource(state) : null;
  const cultivator = isCultivator(state);
  const cultivatorSource = cultivator ? currentCultivatorCombatSource(state) : null;
  const machine = isMachine(state);
  const machineSource = machine ? currentMachineCombatSource(state) : null;
  const mentorDisorder = isMentorDisorder(state);
  const mentorDisorderRound = mentorDisorder ? createMentorDisorderRoundContext(state) : null;
  const corruptionBaron = isCorruptionBaron(state);
  const corruptionBaronRound = corruptionBaron ? createCorruptionBaronRoundContext(state) : null;
  const briber = isBriber(state);
  const briberRound = briber ? createBriberRoundContext(state) : null;
  const barbarian = isBarbarian(state);
  const barbarianSource = barbarian ? currentBarbarianCombatSource(state) : null;
  const punishmentKnight = isPunishmentKnight(state);
  const punishmentKnightRound = punishmentKnight ? createPunishmentKnightRoundContext(state) : null;
  const judge = isJudge(state);
  const judgeRound = judge ? createJudgeRoundContext(state) : null;
  const interrogator = isInterrogator(state);
  const interrogatorSource = interrogator ? currentInterrogatorCombatSource(state) : null;
  const sheriff = isSheriff(state);
  const sheriffSource = sheriff ? currentSheriffCombatSource(state) : null;
  const arbiter = isArbiter(state);
  const arbiterSource = arbiter ? currentArbiterCombatSource(state) : null;
  const lawyer = isLawyer(state);
  const lawyerSource = lawyer ? currentLawyerCombatSource(state) : null;
  const monster = isMonster(state);
  const monsterSource = monster ? currentMonsterCombatSource(state) : null;
  const wraith = isWraith(state);
  const wraithSource = wraith ? currentWraithCombatSource(state) : null;
  const zombie = isZombie(state);
  const zombieSource = zombie ? currentZombieCombatSource(state) : null;
  const werewolf = isWerewolf(state);
  const werewolfSource = werewolf ? currentWerewolfCombatSource(state) : null;
  const werewolfRound: WerewolfRoundContext = { regenUsed: false };
  const madman = isMadman(state);
  const madmanSource = madman ? currentMadmanCombatSource(state) : null;
  const prisoner = isPrisoner(state);
  const prisonerSource = prisoner ? currentPrisonerCombatSource(state) : null;
  const desireApostle = isDesireApostle(state);
  const desireApostleSource = desireApostle ? currentDesireApostleCombatSource(state) : null;
  const demon = isDemon(state);
  const demonSource = demon ? currentDemonCombatSource(state) : null;
  const serialKiller = isSerialKiller(state);
  const serialKillerSource = serialKiller ? currentSerialKillerCombatSource(state) : null;
  const unwinged = isUnwinged(state);
  const unwingedSource = unwinged ? currentUnwingedCombatSource(state) : null;
  const criminal = isCriminal(state);
  const criminalSource = criminal ? currentCriminalCombatSource(state) : null;
  const shepherd = isShepherd(state);
  const shepherdSource = shepherd ? currentShepherdCombatSource(state) : null;
  const roseBishop = isRoseBishop(state);
  const roseBishopSource = roseBishop ? currentRoseBishopCombatSource(state) : null;
  const shadowAscetic = isShadowAscetic(state);
  const listener = isListener(state);
  const secretSupplicant = isSecretSupplicant(state);
  const starMystic = isStarMystic(state);
  const starMysticSource = starMystic ? currentStarMysticCombatSource(state) : null;
  const scrollProfessor = isScrollProfessor(state);
  const scrollProfessorSource = scrollProfessor ? currentScrollProfessorCombatSource(state) : null;
  const wizard = isWizard(state);
  const combatScholar = isCombatScholar(state);
  const pryer = isPryer(state);
  const pain = isPain(state);
  const painSource = pain ? currentPainCombatSource(state) : null;
  const painRoundLabel = pain ? beginPainCombatRound(state, stance) : null;
  const pleasure = isPleasure(state);
  const pleasureSource = pleasure ? currentPleasureCombatSource(state) : null;
  const witch = isWitch(state);
  const instigator = isInstigator(state);
  const assassin = isAssassin(state);
  const assassinSource = assassin ? currentAssassinCombatSource(state) : null;
  const demonHunter = isDemonHunter(state);
  const demonHunterEnemy = combat.encounterId === 'DEMON_HUNTER_DISPUTE';
  const demonHunterSource = demonHunter ? currentDemonHunterCombatSource(state) : null;
  const demonHunterRound = demonHunter ? beginDemonHunterCombatRound(state, stance) : null;
  const guardian = isGuardian(state);
  const guardianSource = guardian ? currentGuardianCombatSource(state) : null;
  const guardianRound = guardian ? beginGuardianCombatRound(state, stance) : null;
  const dawnPaladin = isDawnPaladin(state);
  const dawnPaladinSource = dawnPaladin ? currentDawnPaladinCombatSource(state) : null;
  const weaponmaster = isWeaponmaster(state);
  const weaponmasterSource = weaponmaster ? currentWeaponmasterCombatSource(state) : null;
  const gladiator = isGladiator(state);
  const gladiatorSource = gladiator ? currentGladiatorCombatSource(state) : null;
  const warrior = isWarrior(state);
  const warriorSource = warrior ? currentWarriorCombatSource(state) : null;
  const parasite = isParasite(state);
  const parasiteEnemy = combat.encounterId === 'PARASITE_DISPUTE';
  const parasiteSource = parasite ? currentParasiteCombatSource(state) : null;
  const parasiteRound = parasite ? createParasiteRoundContext(state) : null;
  const dreamStealer = isDreamStealer(state);
  const dreamStealerSource = dreamStealer ? currentDreamStealerCombatSource(state) : null;
  const dreamStealerRound = dreamStealer ? createDreamStealerRoundContext(state) : null;
  const fireThief = isFireThief(state);
  const fireThiefSource = fireThief ? currentFireThiefCombatSource(state) : null;
  const fireThiefObservations = fireThief ? createFireThiefRoundObservations(state) : null;
  const fireThiefEnemyRound: BardEffectContext | null = fireThief ? { pendingSupportBudgets: [], finished: false } : null;
  const cryptologist = isCryptologist(state);
  const cryptologistSource = cryptologist ? currentCryptologistCombatSource(state) : null;
  const cryptologistObservations = cryptologist ? createCryptologistRoundObservations(state) : null;
  const swindler = isSwindler(state);
  const swindlerSource = swindler ? currentSwindlerCombatSource(state) : null;
  const marauder = isMarauder(state);
  const marauderSource = marauder ? currentMarauderCombatSource(state) : null;
  const astrologer = hasAstrologerCombat(state);
  const recorder = isRecorder(state);
  const astrologerSource = astrologer ? currentAstrologerCombatSource(state) : null;
  const trickmaster = isTrickmaster(state);
  const trickmasterSource = trickmaster ? currentTrickmasterCombatSource(state) : null;
  const apprentice = isApprentice(state);
  const apprenticeSource = apprentice ? currentApprenticeCombatSource(state) : null;
  const spiritmedium = hasSpiritmediumCombat(state);
  const spiritGuide = isSpiritGuide(state);
  const spiritmediumSource = spiritmedium ? currentSpiritmediumCombatSource(state) : null;
  const gravedigger = isGravedigger(state);
  const gravediggerSource = gravedigger ? currentGravediggerCombatSource(state) : null;
  const corpsecollector = isCorpsecollector(state);
  const corpsecollectorSource = corpsecollector ? currentCorpsecollectorCombatSource(state) : null;
  const sunpriest = hasSunpriestCombat(state);
  const notary = isNotary(state);
  const notaryRound = notary ? createNotaryRoundContext(state) : undefined;
  const sunpriestSource = sunpriest ? currentSunpriestCombatSource(state) : null;
  const lightprayer = isLightprayer(state);
  const lightprayerSource = lightprayer ? currentLightprayerCombatSource(state) : null;
  const bard = isBard(state);
  const bardRound = bard ? createBardRoundContext(state) : null;
  const navigator = hasNavigatorCombat(state);
  const windBlessed = isWindBlessed(state);
  const rager = isRager(state);
  const sailor = isSailor(state);
  const detective = hasDetectiveCombat(state);
  const polymath = isPolymath(state);
  // New for every round, populated only after each actual enemy action. Never consult old rounds.
  const detectiveObservations = detective ? createDetectiveRoundObservations(state) : null;
  const reasoner = isReasoner(state);
  const reasonerSource = reasoner ? currentReasonerCombatSource(state) : null;
  const reader = isReader(state);
  const readerSource = reader ? currentReaderActionSource(state) : null;
  const nightmare = hasNightmareCombat(state);
  const soother = isSootherCombat(state);
  const midnight = isMidnight(state);
  const sleepless = isSleepless(state);
  const vampire = isVampire(state);
  const potionProfessor = vampire && state.progression.sequence === 6;
  const traveler = isTraveler(state);
  const gatekeeper = isGatekeeper(state);
  const priestOfLight = isPriestOfLight(state);
  const oceanSinger = isOceanSinger(state);
  const mysticismMagister = isMysticismMagister(state);
  const spiritWarlock = isSpiritWarlock(state);
  const crimsonScholar = isCrimsonScholar(state);
  const astronomer = isAstronomer(state);
  const dreamwalker = isDreamwalker(state);
  const psychologist = isPsychologist(state);
  const hypnotist = psychologist && state.progression.sequence === 6;
  const pyromaniac = isPyromaniac(state);
  const marionettist = isMarionettist(state);
  const undying = isUndying(state);
  const undyingRound = undying ? beginUndyingCombatRound(state) : null;
  const unshadowed = isUnshadowed(state);
  const unshadowedRound = unshadowed ? beginUnshadowedCombatRound(state) : null;
  const cataclysmPriest = isCataclysmPriest(state);
  const cataclysmPriestRound = cataclysmPriest ? beginCataclysmPriestCombatRound(state) : null;
  const prophet = isProphet(state);
  const prophetRound = prophet ? beginProphetCombatRound(state) : null;
  const nightwatcher = isNightwatcher(state);
  const nightwatcherRound = nightwatcher ? beginNightwatcherCombatRound(state) : null;
  const witchKing = isWitchKing(state);
  const witchKingRound = witchKing ? beginWitchKingCombatRound(state) : null;
  const alchemist = isAlchemist(state);
  const alchemistRound = alchemist ? beginAlchemistCombatRound(state) : null;
  const manipulator = isManipulator(state);
  const manipulatorRound = manipulator ? beginManipulatorCombatRound(state) : null;
  const ironBlood = isIronBloodKnight(state);
  const ironBloodRound = ironBlood ? beginIronBloodCombatRound(state, ironBloodPolicy) : null;
  const secretsSorcerer = isSecretsSorcerer(state);
  const secretsSorcererEnemy = combat.encounterId === 'SECRETS_SORCERER_RITUAL';
  const bizarro = isBizarroSorcerer(state);
  const bizarroEnemy = combat.encounterId === 'BIZARRO_RITUAL';
  const bizarroRound = bizarroEnemy ? createBizarroRoundContext() : null;
  const reaper = isReaper(state);
  const magician = isMagician(state);
  const clown = isClown(state);
  const seer = isSeer(state);
  const mindreader = isMindreader(state);
  const audience = isAudience(state);
  const provoker = isProvoker(state);
  const hunter = isHunter(state);
  const apothecary=state.progression.pathwayId==='moon'&&state.progression.sequence===9;
  const tamer=state.progression.pathwayId==='moon'&&state.progression.sequence===8;
  const savant = state.progression.pathwayId==='paragon'&&state.progression.sequence===9;
  const archaeologist=state.progression.pathwayId==='paragon'&&state.progression.sequence===8;
  const appraiser = isAppraiser(state);
  const artisan = isArtisan(state);
  const maxSpirituality = demonHunter || parasite || secretsSorcerer || undying || unshadowed || cataclysmPriest || prophet || nightwatcher || witchKing || bizarro || ironBlood || manipulator || alchemist ? 120 : druid || punishmentKnight || mentorDisorder || winner || wraith || desireApostle || shepherd || starMystic || pain || guardian || dreamStealer || traveler || gatekeeper || priestOfLight || oceanSinger || mysticismMagister || spiritWarlock || crimsonScholar || astronomer || dreamwalker || reaper || marionettist ? 100 : biologist || judge || corruptionBaron || calamityPriest || zombie || demon || roseBishop || scrollProfessor || pleasure || dawnPaladin || fireThief || recorder || spiritGuide || notary || windBlessed || polymath || soother || potionProfessor || (state.progression.pathwayId==='diviner'||state.progression.pathwayId==='hunter'||state.progression.pathwayId==='audience'||state.progression.pathwayId==='paragon')&&state.progression.sequence===6?80:harvestpriest || interrogator || lucky || briber || werewolf || serialKiller || shadowAscetic || wizard || witch || weaponmaster || cryptologist || astrologer || spiritmedium || sunpriest || navigator || detective || nightmare || vampire || psychologist || magician || pyromaniac || appraiser ? 60 : physician || sheriff || machine || barbarian || madman || unwinged || listener || combatScholar || instigator || gladiator || swindler || trickmaster || gravedigger || lightprayer || rager || reasoner || midnight || clown || provoker || mindreader || archaeologist || tamer ? 45 : seer || hunter || audience || savant || apothecary || sleepless || reader || sailor || bard || corpsecollector || apprentice || marauder || warrior || assassin || pryer || secretSupplicant || criminal || prisoner || monster || lawyer || arbiter || cultivator ? 30 : 15;
  const enemyName = demonHunterEnemy ? projectDemonHunterCombat(state).enemyName : parasiteEnemy ? projectParasiteCombat(state).enemyName : secretsSorcererEnemy ? projectSecretsSorcererCombat(state).enemyName : undying ? '持自己原普通短棍的46岁原档案室值守欧文·戴尔' : unshadowed ? '持自己原普通短棍的47岁原档案院值守埃德蒙·塔尔' : cataclysmPriest ? '持自己原普通短棍的48岁原码头看守本尼迪克特·维尔' : prophet ? '持自己原普通短棍的46岁原档案馆值守哈罗德·布伦特' : nightwatcher ? '持自己原普通短棍的45岁原值夜人布拉姆·洛' : witchKing ? '持自己原普通短棍的42岁原夜间守院人多里安' : alchemist ? '持自己原普通短棍的44岁原奥斯里克' : manipulator ? '持自己原普通短棍的40岁原仓库看守鲁兰' : ironBlood ? '持自己原普通短棍的成年原看守加里克' : bizarroEnemy ? projectBizarroCombat(state).enemyName : combat.encounterId === 'DRUID_DISPUTE' ? '持自己原普通短棍的成年普通园工马伦' : combat.encounterId === 'PUNISHMENT_KNIGHT_DISPUTE' ? '持自己原普通短棍的成年普通人迪恩' : combat.encounterId === 'MENTOR_DISORDER_DISPUTE' ? '持自己原普通短棍的成年普通人里斯' : combat.encounterId === 'WINNER_DISPUTE' ? '持自己原普通短棍的成年普通人奥德里' : combat.encounterId === 'WRAITH_DISPUTE' ? '持自己原普通短棍的成年普通人贝文' : combat.encounterId === 'DESIRE_APOSTLE_DISPUTE' ? '持自己原普通短棍的成年普通看守费兰' : combat.encounterId === 'SHEPHERD_DISPUTE' ? '持自己原普通短棍的成年普通门廊看守埃尔顿' : combat.encounterId === 'STAR_MYSTIC_DISPUTE' ? '持自己原普通短棍的成年普通空院看守布莱斯' : combat.encounterId === 'PAIN_DISPUTE' ? '本段持自己原普通短棍的成年普通看守奥伦' : combat.encounterId === 'GUARDIAN_DISPUTE' ? '持自己原普通短棍的成年普通看门人埃德温' : combat.encounterId === 'DREAM_STEALER_DISPUTE' ? '持自己原普通短棍的成年纸箱房值守马洛' : combat.encounterId === 'TRAVELER_DISPUTE' ? '持自己原普通短棍的成年仓库守门人贝兰' : combat.encounterId === 'GATEKEEPER_DISPUTE' ? '持自己原普通短棍的成年旧纪念院看守洛克' : combat.encounterId === 'PRIEST_OF_LIGHT_DISPUTE' ? '持自己原普通短棍的普通门房凯恩' : combat.encounterId === 'OCEAN_SINGER_DISPUTE' ? '持自己原普通短棍的码头管事布伦' : combat.encounterId === 'MYSTICISM_MAGISTER_DISPUTE' ? '持自己原普通短棍的罗文' : combat.encounterId === 'SPIRIT_WARLOCK_DISPUTE' ? '持自己原普通短棍的奥林' : combat.encounterId === 'CRIMSON_SCHOLAR_DISPUTE' ? '持自己原普通短棍的西德' : combat.encounterId === 'ASTRONOMER_DISPUTE' ? '持自己原普通短棍的霍伯' : combat.encounterId === 'DREAMWALKER_DISPUTE' ? '持自己原普通短棍的清醒马斯' : combat.encounterId === 'REAPER_DISPUTE' ? '持自己原普通短棍的维克' : combat.encounterId === 'MARIONETTIST_DISPUTE' ? '持自己原普通短棍的多恩' : combat.encounterId === 'BIOLOGIST_DISPUTE' ? '持自己原普通短棍的洛恩' : combat.encounterId === 'JUDGE_DISPUTE' ? '持自己原普通短棍的埃文' : combat.encounterId === 'CORRUPTION_BARON_DISPUTE' ? '持自己原普通短棍的沃恩' : combat.encounterId === 'CALAMITY_PRIEST_DISPUTE' ? '持自己原普通短棍的杜兰' : combat.encounterId === 'ZOMBIE_DISPUTE' ? '持自己原普通短棍的里德' : combat.encounterId === 'DEMON_DISPUTE' ? '持自己原普通短棍的莫顿' : combat.encounterId === 'ROSE_BISHOP_DISPUTE' ? '持自己原普通短棍的维恩' : combat.encounterId === 'SCROLL_PROFESSOR_DISPUTE' ? '持自己原普通短棍的卡尔' : combat.encounterId === 'PLEASURE_DISPUTE' ? '持自己原普通短棍的马伦' : combat.encounterId === 'DAWN_PALADIN_DISPUTE' ? '持自己原普通短棍的罗尔德' : combat.encounterId === 'FIRE_THIEF_DISPUTE' ? '持自己原普通短棍的歌颂者贝林' : combat.encounterId === 'RECORDER_DISPUTE' ? '持普通短棍的弥尔' : combat.encounterId === 'SPIRIT_GUIDE_DISPUTE' ? '持普通短棍的迪恩' : combat.encounterId === 'NOTARY_DISPUTE' ? '持普通短棍的布伦' : combat.encounterId === 'WIND_BLESSED_DISPUTE' ? '持普通短棍的鲁恩' : combat.encounterId === 'POLYMATH_DISPUTE' ? '持普通短棍的伊恩' : combat.encounterId === 'SOOTHER_DISPUTE' ? '持普通短棍的阿兰' : combat.encounterId === 'ARTISAN_DISPUTE' ? '持普通短棍的德文' : combat.encounterId === 'CONSPIRATOR_DISPUTE' ? '持普通短棍的奥伦' : combat.encounterId === 'FACELESS_DISPUTE' ? '持普通短棍的达恩' : combat.encounterId === 'MARAUDER_DISPUTE' ? '塞蒙'
    : combat.encounterId === 'NIGHTMARE_DISPUTE' ? '持棍凯尔'
    : combat.encounterId === 'MIDNIGHT_DISPUTE' ? '持棍贺恩'
    : combat.encounterId === 'SLEEPLESS_WATCH' ? '持棍拉夫'
    : combat.encounterId === 'VAMPIRE_DISPUTE' ? '布鲁克'
    : combat.encounterId === 'POTION_PROFESSOR_DISPUTE' ? '持普通短棍的艾文'
    : combat.encounterId === 'PSYCHOLOGIST_DISPUTE' ? '布莱斯'
    : combat.encounterId === 'HYPNOTIST_DISPUTE' ? '持普通短棍的罗温'
    : combat.encounterId === 'PYROMANIAC_DISPUTE' ? '短棍阻拦者哈恩'
    : combat.encounterId === 'CLOWN_RESCUE' ? '勒索者'
    : combat.encounterId === 'MAGICIAN_DISPUTE' ? '堵住剧场后巷的莫里'
    : combat.encounterId === 'PROVOKER_DISPUTE' ? '威斯'
    : combat.encounterId === 'HUNTER_CARGO' ? '拦路者' : '携铃者';
  const stats = state.character.coreStats;
  // Shadow Ascetic S7 core15/25/25/35, tier450, floor45 and max60 are G.
  // Listener S8 core15/20/30/35, tier300, floor30 and max45 are G.
  // Secret Supplicant S9 core10/20/35/35, tier200, floor20 and max30 are G.
  // Serial Killer S7 core30/35/20/15; tier450, floor45 and max60 are G.
  // Unwinged S8 shares core30/35/20/15; tier300, floor30 and max45 are G.
  // Criminal S9 core30/35/20/15, tier200, floor20 and max30 are G.
  // Prisoner S9 core35/35/15/15, tier200, floor20 and max30 are G.
  // Madman S8 inherits core35/35/15/15, with G tier300, floor30 and max45.
  // Werewolf S7 inherits core35/35/15/15, with G tier450, floor45 and max60.
  // Monster and Lawyer S9 core25/45/15/15, tier200, floor20 and max30 are G.
  // Machine and Barbarian S8 core30/40/15/15, tier300, floor30 and max45 are G.
  // Lucky S7 retains the S8 core and body budgets; only tier450/floor45/max60 are new.
  // Briber S7 inherits core30/40/15/15; tier450, floor45 and max60 are G.
  // Arbiter S9 core35/30/20/15, tier200, floor20 and max30 are G.
  // Sheriff S8 retains core35/30/20/15 with G tier300, floor30 and max45.
  // Interrogator S7 inherits core35/30/20/15, with G tier450, floor45 and max60.
  // Cultivator S9 core30/30/15/25, tier200, floor20 and max30 are explicit G.
  // Physician S8 inherits G core30/30/15/25, with G tier300, floor30 and max45.
  // Harvest Priest S7 retains G core30/30/15/25, with G tier450, floor45 and max60.
  // Druid S5 inherits core20/15/20/45 at G tier900/floor90/max100; S6 stays unchanged.
  // Biologist S6 core20/15/20/45, tier650/floor65 and max80 are explicit G.
  // Astronomer S5 G core30/30/25/15, tier900/floor90/max100.
  // Crimson Scholar S5 explicit G core35/25/25/15, tier900/floor90/max100.
  // Spirit Warlock S5 explicit G core35/25/25/15, tier900/floor90/max100.
  // Dream Stealer, Traveler, Gatekeeper, Priest of Light and Ocean Singer S5 explicit G core35/25/25/15, tier900/floor90/max100.
  // Mysticism Magister S5 explicit G core35/25/25/15, tier900/floor90/max100.
  const core = parasite || secretsSorcerer || undying || unshadowed || cataclysmPriest || prophet || nightwatcher || witchKing || dreamStealer || traveler || gatekeeper || priestOfLight || oceanSinger || mysticismMagister || spiritWarlock || crimsonScholar
    ? stats.physique * 0.35 + stats.perception * 0.25 + stats.will * 0.25 + stats.knowledge * 0.15
    : astronomer || alchemist
    ? stats.physique * 0.3 + stats.perception * 0.3 + stats.will * 0.25 + stats.knowledge * 0.15
    : druid || biologist
    ? stats.physique * 0.2 + stats.perception * 0.15 + stats.will * 0.2 + stats.knowledge * 0.45
    : harvestpriest || physician || cultivator
    ? stats.physique * 0.3 + stats.perception * 0.3 + stats.will * 0.15 + stats.knowledge * 0.25
    // Punishment Knight S5 inherits core30/20/35/15 at tier900/floor90/max100; Judge S6 unchanged.
    : punishmentKnight || judge
    ? stats.physique * 0.3 + stats.perception * 0.2 + stats.will * 0.35 + stats.knowledge * 0.15
    : interrogator || sheriff || arbiter
    ? stats.physique * 0.35 + stats.perception * 0.3 + stats.will * 0.2 + stats.knowledge * 0.15
    // Winner S5 inherits core15/20/40/25 at tier900/floor90/max100; Calamity Priest S6 is unchanged.
    : winner || calamityPriest
    ? stats.physique * 0.15 + stats.perception * 0.2 + stats.will * 0.4 + stats.knowledge * 0.25
    // Corruption Baron S6 G core35/15/20/30, tier650/floor65 and max80.
    : mentorDisorder || corruptionBaron
    ? stats.physique * 0.35 + stats.perception * 0.15 + stats.will * 0.2 + stats.knowledge * 0.3
    : lucky || briber || machine || barbarian
    ? stats.physique * 0.3 + stats.perception * 0.4 + stats.will * 0.15 + stats.knowledge * 0.15
    : monster || lawyer
    ? stats.physique * 0.25 + stats.perception * 0.45 + stats.will * 0.15 + stats.knowledge * 0.15
    // Wraith S5 inherits core50/20/15/15; tier900/floor90/max100 are G. Zombie S6 is unchanged.
    : wraith || zombie
    ? stats.physique * 0.5 + stats.perception * 0.2 + stats.will * 0.15 + stats.knowledge * 0.15
    : werewolf || madman || prisoner
    ? stats.physique * 0.35 + stats.perception * 0.35 + stats.will * 0.15 + stats.knowledge * 0.15
    // Desire Apostle S5 inherits core35/30/15/20 at tier900/floor90/max100; S6 stays unchanged.
    : desireApostle || demon
    ? stats.physique * 0.35 + stats.perception * 0.3 + stats.will * 0.15 + stats.knowledge * 0.2
    : serialKiller || unwinged || criminal
    ? stats.physique * 0.3 + stats.perception * 0.35 + stats.will * 0.2 + stats.knowledge * 0.15
    // Shepherd S5 inherits core50/20/20/10; tier900/floor90/max100 are G.
    // Rose Bishop S6 remains tier650/floor65/max80 with unchanged own budgets.
    : shepherd || roseBishop
    ? stats.physique * 0.5 + stats.perception * 0.2 + stats.will * 0.2 + stats.knowledge * 0.1
    : shadowAscetic
    ? stats.physique * 0.15 + stats.perception * 0.25 + stats.will * 0.25 + stats.knowledge * 0.35
    : listener
    ? stats.physique * 0.15 + stats.perception * 0.2 + stats.will * 0.3 + stats.knowledge * 0.35
    : secretSupplicant
    ? stats.physique * 0.1 + stats.perception * 0.2 + stats.will * 0.35 + stats.knowledge * 0.35
    // Hermit S5 inherits core10/30/25/35; new tier900/floor90/max100 are explicit G.
    // S6 remains tier650/floor65/max80 with every original budget unchanged.
    : starMystic || scrollProfessor
    ? stats.physique * 0.1 + stats.perception * 0.3 + stats.will * 0.25 + stats.knowledge * 0.35
    : wizard
    ? stats.physique * 0.15 + stats.perception * 0.25 + stats.will * 0.25 + stats.knowledge * 0.35
    : combatScholar
    ? stats.physique * 0.2 + stats.perception * 0.25 + stats.will * 0.25 + stats.knowledge * 0.3
    : pryer
    ? stats.physique * 0.15 + stats.perception * 0.2 + stats.will * 0.3 + stats.knowledge * 0.35
    : pain || pleasure
    ? stats.physique * 0.25 + stats.perception * 0.3 + stats.will * 0.3 + stats.knowledge * 0.15
    : witch
    ? stats.physique * 0.2 + stats.perception * 0.15 + stats.will * 0.3 + stats.knowledge * 0.35
    : assassin || instigator
    ? stats.physique * 0.3 + stats.perception * 0.35 + stats.will * 0.2 + stats.knowledge * 0.15
    : demonHunter || guardian || dawnPaladin || weaponmaster
    ? stats.physique * 0.45 + stats.perception * 0.2 + stats.will * 0.25 + stats.knowledge * 0.1
    : warrior || gladiator
    ? stats.physique * 0.5 + stats.perception * 0.2 + stats.will * 0.2 + stats.knowledge * 0.1
    : fireThief
    ? stats.physique * 0.3 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.15
    : cryptologist
    ? stats.physique * 0.2 + stats.perception * 0.35 + stats.will * 0.2 + stats.knowledge * 0.25
    : marauder || swindler
    ? stats.physique * 0.25 + stats.perception * 0.35 + stats.will * 0.2 + stats.knowledge * 0.2
    : recorder
    ? stats.physique * 0.3 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.15
    : astrologer
    ? stats.physique * 0.15 + stats.perception * 0.4 + stats.will * 0.2 + stats.knowledge * 0.25
    : apprentice || trickmaster
    ? stats.physique * 0.2 + stats.perception * 0.4 + stats.will * 0.2 + stats.knowledge * 0.2
    : spiritGuide
    ? stats.physique * 0.3 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.15
    : spiritmedium
    ? stats.physique * 0.15 + stats.perception * 0.3 + stats.will * 0.3 + stats.knowledge * 0.25
    : notary
    ? stats.physique * 0.3 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.15
    : sunpriest
    ? stats.physique * 0.2 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.25
    : bard || lightprayer || corpsecollector || gravedigger
    ? stats.physique * 0.2 + stats.perception * 0.3 + stats.will * 0.25 + stats.knowledge * 0.25
    : windBlessed
    ? stats.physique * 0.3 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.15
    : navigator
    ? stats.physique * 0.4 + stats.perception * 0.25 + stats.will * 0.25 + stats.knowledge * 0.1
    : rager || sailor
    ? stats.physique * 0.45 + stats.perception * 0.25 + stats.will * 0.2 + stats.knowledge * 0.1
    : polymath
    ? stats.physique * 0.3 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.15
    : reader || reasoner || detective
    ? stats.physique * 0.1 + stats.perception * 0.3 + stats.will * 0.2 + stats.knowledge * 0.4
    // S6 keeps every inherited budget, changing only core30/25/30/15 and max80.
    : soother
    ? stats.physique * 0.3 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.15
    : nightmare
    ? stats.physique * 0.1 + stats.perception * 0.25 + stats.will * 0.4 + stats.knowledge * 0.25
    : midnight
    ? stats.physique * 0.1 + stats.perception * 0.3 + stats.will * 0.35 + stats.knowledge * 0.25
    : sleepless
    ? stats.physique * 0.1 + stats.perception * 0.35 + stats.will * 0.3 + stats.knowledge * 0.25
    // S6 changes only its finite core and resource ceiling; all inherited move budgets stay S7.
    : potionProfessor
    ? stats.physique * 0.3 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.15
    : vampire
    ? stats.physique * 0.2 + stats.perception * 0.3 + stats.will * 0.3 + stats.knowledge * 0.2
    // S6 core30/25/30/15 is finite G, retaining tier450/floor45 and all S7 effect budgets.
    : manipulator || dreamwalker || hypnotist
    ? stats.physique * 0.3 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.15
    : psychologist
    ? stats.physique * 0.05 + stats.perception * 0.25 + stats.will * 0.4 + stats.knowledge * 0.3
    // S5 finite G core35/30/20/15; precise targeting is a paid action, not a passive damage multiplier.
    : reaper || ironBlood
    ? stats.physique * 0.35 + stats.perception * 0.3 + stats.will * 0.2 + stats.knowledge * 0.15
    : pyromaniac
    ? stats.physique * 0.3 + stats.perception * 0.25 + stats.will * 0.3 + stats.knowledge * 0.15
    : marionettist || bizarro
    ? stats.physique * 0.15 + stats.perception * 0.3 + stats.will * 0.3 + stats.knowledge * 0.25
    : magician
    ? stats.physique * 0.2 + stats.perception * 0.3 + stats.will * 0.15 + stats.knowledge * 0.35
    : clown
    ? stats.physique * 0.4 + stats.perception * 0.35 + stats.will * 0.15 + stats.knowledge * 0.1
    : seer
    ? stats.physique * 0.1 + stats.perception * 0.4 + stats.will * 0.2 + stats.knowledge * 0.3
    : mindreader
    ? stats.physique * 0.05 + stats.perception * 0.4 + stats.will * 0.3 + stats.knowledge * 0.25
    : audience
    ? stats.physique * 0.05 + stats.perception * 0.45 + stats.will * 0.2 + stats.knowledge * 0.3
    : provoker
    ? stats.physique * 0.35 + stats.perception * 0.3 + stats.will * 0.25 + stats.knowledge * 0.1
    : hunter
    ? stats.physique * 0.4 + stats.perception * 0.3 + stats.will * 0.1 + stats.knowledge * 0.2
    : apothecary || tamer ? stats.physique*.15+stats.perception*.3+stats.will*.3+stats.knowledge*.25
    // S6 finite G: core30/25/30/15, tier450/floor45; ordinary moves stay unchanged.
    : artisan ? stats.physique*.3+stats.perception*.25+stats.will*.3+stats.knowledge*.15
    : appraiser ? stats.physique*.15+stats.perception*.35+stats.will*.25+stats.knowledge*.25
    : savant || archaeologist ? stats.physique*.2+stats.perception*.35+stats.will*.2+stats.knowledge*.25
    : Object.values(stats).reduce((sum, value) => sum + value, 0) / 4;
  const playerBase = baseAdvantage(core, state.health, state.mind, state.spirituality, demonHunter || parasite || secretsSorcerer || undying || unshadowed || cataclysmPriest || prophet || nightwatcher || witchKing || bizarro || ironBlood || manipulator || alchemist ? 1250 : druid || punishmentKnight || mentorDisorder || winner || wraith || desireApostle || shepherd || starMystic || pain || guardian || dreamStealer || traveler || gatekeeper || priestOfLight || oceanSinger || mysticismMagister || spiritWarlock || crimsonScholar || astronomer || dreamwalker || reaper || marionettist ? 900 : biologist || judge || corruptionBaron || calamityPriest || zombie || demon || roseBishop || scrollProfessor || pleasure || dawnPaladin ? 650 : fireThief || harvestpriest || interrogator || lucky || briber || werewolf || serialKiller || shadowAscetic || wizard || witch || weaponmaster || cryptologist || astrologer || spiritmedium || sunpriest || navigator || detective || nightmare || vampire || psychologist || magician || pyromaniac || appraiser || artisan ? 450 : physician || sheriff || machine || barbarian || madman || unwinged || listener || combatScholar || instigator || gladiator || swindler || trickmaster || gravedigger || lightprayer || rager || reasoner || midnight || clown || provoker || mindreader || archaeologist || tamer ? 300 : seer || hunter || audience || savant || apothecary || sleepless || reader || sailor || bard || corpsecollector || apprentice || marauder || warrior || assassin || pryer || secretSupplicant || criminal || prisoner || monster || lawyer || arbiter || cultivator ? 200 : 100, maxSpirituality);
  const enemyBase = demonHunterEnemy ? baseAdvantage(20, combat.enemyHealth, combat.enemyMind, state.demonHunter.encounter.enemySpirituality, 850, 36) : parasiteEnemy ? baseAdvantage(18, combat.enemyHealth, combat.enemyMind, state.parasite.encounter.enemySpirituality, 650, 32) : secretsSorcererEnemy ? baseAdvantage(20, combat.enemyHealth, combat.enemyMind, state.secretsSorcerer.ritual.enemySpirituality, 1250, 40) : bizarroEnemy ? baseAdvantage(20, combat.enemyHealth, combat.enemyMind, state.bizarroSorcerer.ritual.enemySpirituality, 1250, 40) : fireThief
    ? baseAdvantage(14, combat.enemyHealth, combat.enemyMind, state.fireThief.encounter.enemySpirituality, 200, 30)
    : baseAdvantage(14, combat.enemyHealth, combat.enemyMind, 15);
  const round: SliceCombatRound = {
    round: combat.round, stance, first,
    playerCount: demonHunter ? demonHunterActionCount(playerCountRoll) : parasite ? parasiteActionCount(playerCountRoll) : secretsSorcererEnemy ? secretsSorcererActionCount(playerCountRoll) : undying ? undyingActionCount(playerCountRoll) : unshadowed ? unshadowedActionCount(playerCountRoll) : cataclysmPriest ? cataclysmPriestActionCount(playerCountRoll) : prophet ? prophetActionCount(playerCountRoll) : nightwatcher ? nightwatcherActionCount(playerCountRoll) : witchKing ? witchKingActionCount(playerCountRoll) : alchemist ? alchemistActionCount(playerCountRoll) : manipulator ? manipulatorActionCount(playerCountRoll) : ironBlood ? ironBloodActionCount(playerCountRoll) : bizarro ? bizarroSorcererActionCount(playerCountRoll) : winner ? winnerActionCount(playerCountRoll)
      : shepherd ? shepherdActionCount(playerCountRoll)
      : starMystic ? starMysticActionCount(playerCountRoll)
      : pain ? painActionCount(playerCountRoll)
      : guardian ? guardianActionCount(playerCountRoll)
      : dreamStealer ? dreamStealerActionCount(playerCountRoll)
      : traveler ? travelerActionCount(playerCountRoll)
      : gatekeeper ? gatekeeperActionCount(playerCountRoll)
      : priestOfLight ? priestOfLightActionCount(playerCountRoll)
      : oceanSinger ? oceanSingerActionCount(playerCountRoll)
      : mysticismMagister ? mysticismMagisterActionCount(playerCountRoll)
      : spiritWarlock ? spiritWarlockActionCount(playerCountRoll)
      : crimsonScholar ? crimsonScholarActionCount(playerCountRoll)
      : astronomer ? astronomerActionCount(playerCountRoll)
      : dreamwalker ? dreamwalkerActionCount(playerCountRoll)
      : reaper ? reaperActionCount(playerCountRoll)
      : marionettist ? marionettistActionCount(playerCountRoll)
      : druid ? druidActionCount(playerCountRoll)
      : biologist ? biologistActionCount(playerCountRoll)
      : harvestpriest ? harvestpriestActionCount(playerCountRoll)
      : physician ? physicianActionCount(playerCountRoll)
      : cultivator ? cultivatorActionCount(playerCountRoll)
      : calamityPriest ? calamityPriestActionCount(playerCountRoll)
      : lucky ? luckyActionCount(playerCountRoll)
      : machine ? machineActionCount(playerCountRoll)
      : mentorDisorder ? mentorDisorderActionCount(playerCountRoll)
      : corruptionBaron ? corruptionBaronActionCount(playerCountRoll)
      : briber ? briberActionCount(playerCountRoll)
      : barbarian ? barbarianActionCount(playerCountRoll)
      : punishmentKnight ? punishmentKnightActionCount(playerCountRoll)
      : judge ? judgeActionCount(playerCountRoll)
      : interrogator ? interrogatorActionCount(playerCountRoll)
      : sheriff ? sheriffActionCount(playerCountRoll)
      : arbiter ? arbiterActionCount(playerCountRoll)
      : lawyer ? lawyerActionCount(playerCountRoll)
      : monster ? monsterActionCount(playerCountRoll)
      : wraith ? wraithActionCount(playerCountRoll)
      : zombie ? zombieActionCount(playerCountRoll)
      : werewolf ? werewolfActionCount(playerCountRoll)
      : madman ? madmanActionCount(playerCountRoll)
      : prisoner ? prisonerActionCount(playerCountRoll)
      : desireApostle ? desireApostleActionCount(playerCountRoll)
      : demon ? demonActionCount(playerCountRoll)
      : serialKiller ? serialKillerActionCount(playerCountRoll)
      : unwinged ? unwingedActionCount(playerCountRoll)
      : criminal ? criminalActionCount(playerCountRoll)
      : roseBishop ? roseBishopActionCount(playerCountRoll)
      : shadowAscetic ? shadowAsceticActionCount(playerCountRoll)
      : listener ? listenerActionCount(playerCountRoll)
      : secretSupplicant ? secretSupplicantActionCount(playerCountRoll)
      : scrollProfessor ? scrollProfessorActionCount(playerCountRoll)
      : wizard ? wizardActionCount(playerCountRoll)
      : combatScholar ? combatScholarActionCount(playerCountRoll)
      : pryer ? pryerActionCount(playerCountRoll)
      : pleasure ? pleasureActionCount(playerCountRoll)
      : witch ? witchActionCount(playerCountRoll)
      : instigator ? instigatorActionCount(playerCountRoll)
      : assassin ? assassinActionCount(playerCountRoll)
      : dawnPaladin ? dawnPaladinActionCount(playerCountRoll)
      : weaponmaster ? weaponmasterActionCount(playerCountRoll)
      : gladiator ? gladiatorActionCount(playerCountRoll)
      : warrior ? warriorActionCount(playerCountRoll)
      : fireThief ? fireThiefActionCount(playerCountRoll)
      : cryptologist ? cryptologistActionCount(playerCountRoll)
      : swindler ? swindlerActionCount(playerCountRoll)
      : marauder ? marauderActionCount(playerCountRoll)
      : astrologer ? astrologerActionCount(playerCountRoll)
      : trickmaster ? trickmasterActionCount(playerCountRoll)
      : apprentice ? apprenticeActionCount(playerCountRoll)
      : spiritmedium ? spiritmediumActionCount(playerCountRoll)
      : gravedigger ? gravediggerActionCount(playerCountRoll)
      : corpsecollector ? corpsecollectorActionCount(playerCountRoll)
      : sunpriest ? sunpriestActionCount(playerCountRoll)
      : lightprayer ? lightprayerActionCount(playerCountRoll)
      : bard ? bardActionCount(playerCountRoll)
      : navigator ? navigatorActionCount(playerCountRoll)
      : rager ? ragerActionCount(playerCountRoll)
      : sailor ? sailorActionCount(playerCountRoll)
      : detective ? detectiveActionCount(playerCountRoll)
      : reasoner ? reasonerActionCount(playerCountRoll)
      : reader ? readerActionCount(playerCountRoll)
      : nightmare ? nightmareActionCount(playerCountRoll)
      : midnight ? midnightActionCount(playerCountRoll)
      : sleepless ? sleeplessActionCount(playerCountRoll)
      : vampire ? vampireActionCount(playerCountRoll)
      : appraiser || artisan ? appraiserActionCount(playerCountRoll)
      : psychologist ? psychologistActionCount(playerCountRoll)
      : pyromaniac ? pyromaniacActionCount(playerCountRoll)
      : magician ? magicianActionCount(playerCountRoll)
      : clown ? clownActionCount(playerCountRoll) : seer ? seerActionCount(playerCountRoll)
      : mindreader ? mindreaderActionCount(playerCountRoll)
      : audience ? audienceActionCount(playerCountRoll)
      : provoker ? provokerActionCount(playerCountRoll)
      : hunter ? hunterActionCount(playerCountRoll) : actionCount(playerCountRoll),
    enemyCount: demonHunterEnemy ? demonHunterEnemyActionCount(enemyCountRoll) : parasiteEnemy ? parasiteEnemyActionCount(enemyCountRoll) : secretsSorcererEnemy ? secretsSorcererEnemyActionCount(enemyCountRoll) : bizarroEnemy ? bizarroEnemyActionCount(enemyCountRoll) : fireThief ? bardActionCount(enemyCountRoll) : actionCount(enemyCountRoll),
    playerCountRoll, enemyCountRoll, moves: [], playerAdvantage: playerBase, enemyAdvantage: enemyBase,
    winChance: 0, winner: null, consequence: '', consequenceWeights: null, retreat: 'NONE',
    ...(madman || werewolf || zombie || wraith ? { madmanBurst: { ...madmanRound } } : {}),
    ...(passiveLuck ? { passiveLuck } : {}),
  };
  const gains = { PLAYER: passiveLuck?.bonus ?? 0, ENEMY: 0 };
  const reductions = { PLAYER: 0, ENEMY: 0 };
  const threatened = { PLAYER: false, ENEMY: false };
  // Anger changes only later draws in this round, never count, agency, or damage rules.
  let enemyAngered = false;
  // A failed attempt opens at most one response on a later actual strike.
  // This local flag is never persisted, stacked, or carried to another round.
  let marauderCounterWindow = false;
  // Mental pressure never grants permission for a physical wound or death.
  let mentalPressure = false;

  const updateAdvantages = () => {
    round.playerAdvantage = Math.max(demonHunter || parasite || secretsSorcerer || undying || unshadowed || cataclysmPriest || prophet || nightwatcher || witchKing || bizarro || ironBlood || manipulator || alchemist ? 125 : druid || punishmentKnight || mentorDisorder || winner || wraith || desireApostle || shepherd || starMystic || pain || guardian || dreamStealer || traveler || gatekeeper || priestOfLight || oceanSinger || mysticismMagister || spiritWarlock || crimsonScholar || astronomer || dreamwalker || reaper || marionettist ? 90 : biologist || judge || corruptionBaron || calamityPriest || zombie || demon || roseBishop || scrollProfessor || pleasure || dawnPaladin ? 65 : fireThief || harvestpriest || interrogator || lucky || briber || werewolf || serialKiller || shadowAscetic || wizard || witch || weaponmaster || cryptologist || astrologer || spiritmedium || sunpriest || navigator || detective || nightmare || vampire || psychologist || magician || pyromaniac || appraiser || artisan ? 45 : physician || sheriff || machine || barbarian || madman || unwinged || listener || combatScholar || instigator || gladiator || swindler || trickmaster || gravedigger || lightprayer || rager || reasoner || midnight || clown || provoker || mindreader || archaeologist || tamer ? 30 : seer || hunter || audience || savant || apothecary || sleepless || reader || sailor || bard || corpsecollector || apprentice || marauder || warrior || assassin || pryer || secretSupplicant || criminal || prisoner || monster || lawyer || arbiter || cultivator ? 20 : 10, playerBase + gains.PLAYER - reductions.PLAYER);
    round.enemyAdvantage = Math.max(demonHunterEnemy ? 85 : parasiteEnemy ? 65 : secretsSorcererEnemy || bizarroEnemy ? 125 : fireThief ? 20 : 10, enemyBase + gains.ENEMY - reductions.ENEMY);
    round.winChance = round.playerAdvantage / (round.playerAdvantage + round.enemyAdvantage) * 100;
  };
  const finish = (outcome: CombatOutcome) => {
    if (winner) {
      const cleanup = finishWinnerCombatRound(state);
      if (cleanup) round.consequence += cleanup;
    }
    if (wraith) {
      const cleanup = finishWraithCombatRound(state);
      if (cleanup) round.consequence += cleanup;
    }
    if (desireApostle) {
      const cleanup = finishDesireApostleCombatRound(state, outcome === 'CONTINUE');
      if (cleanup) round.consequence += cleanup;
    }
    if (shepherd) {
      const cleanup = finishShepherdCombatRound(state);
      if (cleanup) round.consequence += cleanup;
    }
    if (starMystic) {
      const cleanup = finishStarMysticCombatRound(state);
      if (cleanup) round.consequence += cleanup;
    }
    if (pain) {
      if (painRoundLabel) round.consequence = painRoundLabel + round.consequence;
      const ending = finishPainCombatRound(state, outcome === 'CONTINUE');
      if (ending) round.consequence += ending;
      round.painOutcome = { enemyHealth: combat.enemyHealth, enemyStatus: combat.enemyStatus,
        enemyDisease: state.pain.encounter.enemyDisease, diseaseApplications: state.pain.encounter.diseaseApplications };
    }
    if (demonHunterRound) {
      round.consequence = demonHunterRound.label + round.consequence;
      const snapshot = finishDemonHunterCombatRound(state, demonHunterRound, outcome === 'CONTINUE');
      if (snapshot) {
        round.demonHunterOutcome = snapshot;
        round.consequence += '本轮未用意图隐蔽结束；原哨卫有限灵性、已用预警、原涂层和观察记录保留，不补货。临时晨曦剑到原定期限或离场时消散。';
      }
    }
    if (guardianRound) {
      round.consequence = guardianRound.label + round.consequence;
      const expiration = finishGuardianCombatRound(state, outcome === 'CONTINUE');
      if (expiration) round.consequence += expiration;
    }
    if (parasiteRound) {
      const snapshot = finishParasiteCombatRound(state, parasiteRound);
      if (snapshot) {
        round.parasiteOutcome = snapshot;
        round.consequence += '本轮实际经过60秒（G）；窃取的待行动念头于轮末放弃，不强迫本人执行或取得关联法术。原目标灵性、禁用能力与完整借用期限保留。';
      }
    }
    if (dreamStealerRound) finishDreamStealerCombatRound(dreamStealerRound);
    if (gatekeeper && outcome === 'PLAYER_DEAD') {
      const released = releaseGatekeeperSpiritOnDeath(state);
      if (released) round.consequence += released;
    }
    if (spiritWarlock) {
      const cleanup = finishSpiritWarlockCombatRound(state, outcome === 'CONTINUE');
      if (cleanup) round.consequence += cleanup;
    }
    if (crimsonScholar) finishCrimsonScholarCombatRound(state);
    if (reaper) {
      const expiration = finishReaperCombatRound(state, outcome === 'CONTINUE');
      if (expiration) round.consequence += expiration;
    }
    if (fireThiefExpiration) round.consequence = fireThiefExpiration + round.consequence;
    if (passiveLuck) round.consequence = luckyPassiveLuckConsequence(passiveLuck) + round.consequence;
    if (madman || werewolf || zombie || wraith) {
      round.madmanBurst = { ...madmanRound };
      if (stance === 'RETREAT') round.consequence += '撤退不触发理智爆发，精神与灵性爆发成本均为0。';
      else if (madmanPolicy === 'BURST_FIRST' && !madmanRound.triggered) {
        round.consequence += '本轮没有满足来源与资源条件的有效身体攻击，未支付理智爆发成本。';
      }
    }
    if (marauderCounterWindow) round.consequence += '本轮未等到实际打击，取棍失败的反击机会已失效。';
    if (punishmentKnightRound) {
      const expiration = finishPunishmentKnightCombatRound(punishmentKnightRound);
      if (expiration) round.consequence += expiration;
    }
    if (judgeRound) {
      const expiration = finishJudgeCombatRound(judgeRound);
      if (expiration) round.consequence += expiration;
    }
    if (mentorDisorderRound) {
      const expiration = finishMentorDisorderCombatRound(mentorDisorderRound);
      if (expiration) round.consequence += expiration;
    }
    if (corruptionBaronRound) {
      const expiration = finishCorruptionBaronCombatRound(corruptionBaronRound);
      if (expiration) round.consequence += expiration;
    }
    if (briberRound) {
      const expiration = finishBriberCombatRound(briberRound);
      if (expiration) round.consequence += expiration;
    }
    if (notaryRound) {
      const expiration = finishNotaryCombatRound(notaryRound);
      if (expiration) round.consequence += expiration;
    }
    if (fireThiefEnemyRound) {
      const expiration = finishBardCombatRound(fireThiefEnemyRound);
      if (expiration) round.consequence += `贝林：${expiration}`;
    }
    if (bardRound) {
      const expiration = finishBardCombatRound(bardRound);
      if (expiration) round.consequence += expiration;
    }
    if (pleasure) {
      const expiration = finishPleasureCombatRound(state, outcome === 'CONTINUE');
      if (expiration) round.consequence += expiration;
    }
    if (dawnPaladin) {
      const expiration = finishDawnPaladinCombatRound(state, outcome === 'CONTINUE');
      if (expiration) round.consequence += expiration;
    }
    if (outcome !== 'CONTINUE') {
      delete combat.weaponmasterWeakPoint;
      delete combat.swindlerDeceit;
      delete combat.reasonerInterference;
      delete combat.sailorScalesReady;
      delete combat.wrathCharge;
      delete combat.navigatorWater;
    }
    if (nightmare) {
      if (nightmareDreamLocked(state)) round.consequence += '本轮结束，解除剩余梦境牵制、恢复本体行动，牵引积累归0。';
      finishNightmareCombatRound(state, outcome === 'CONTINUE');
    }
    updateAdvantages();
    if (secretsSorcererEnemy) round.secretsSorcererOutcome = finishSecretsSorcererCombatRound(state);
    if (bizarroEnemy) {
      const r = state.bizarroSorcerer.ritual, a = currentBizarroAttempt(state)!;
      round.bizarroOutcome = { targetId: r.currentTargetId!, attemptId: r.attemptId!, enemyHealth: combat.enemyHealth,
        enemyMind: combat.enemyMind, enemySpirituality: r.enemySpirituality, enemyStatus: combat.enemyStatus === 'DEAD' ? 'DEAD' : 'RESISTING',
        playerAttackCount: a.playerAttackCount, deathWitnessIds: combat.enemyStatus === 'DEAD' && !r.invalidReason ? [...r.witnesses.presentIds] : [],
        viewObstructed: r.witnesses.viewObstructed, unsafe: r.witnesses.unsafe };
      if (bizarroRound?.diversion) round.consequence += '本轮剩余的一次幻术诱导到期，不跨回合保留。';
    }
    if (undyingRound) {
      round.consequence += finishUndyingCombatRound(state, undyingRound, outcome === 'CONTINUE');
      round.undyingOutcome = undyingRound.outcome;
    }
    if (unshadowedRound) {
      round.consequence += finishUnshadowedCombatRound(state, unshadowedRound, outcome === 'CONTINUE');
      round.unshadowedOutcome = unshadowedRound.outcome;
    }
    if (cataclysmPriestRound) {
      round.consequence += finishCataclysmPriestCombatRound(state, cataclysmPriestRound, outcome === 'CONTINUE');
      round.cataclysmPriestOutcome = cataclysmPriestRound.outcome;
    }
    if (prophetRound) {
      round.consequence += finishProphetCombatRound(state, prophetRound, outcome === 'CONTINUE');
      round.prophetOutcome = prophetRound.outcome;
    }
    if (nightwatcherRound) {
      round.consequence += finishNightwatcherCombatRound(state, nightwatcherRound, outcome === 'CONTINUE');
      round.nightwatcherOutcome = nightwatcherRound.outcome;
    }
    if (witchKingRound) {
      round.consequence += finishWitchKingCombatRound(state, witchKingRound, outcome === 'CONTINUE');
      round.witchKingOutcome = witchKingRound.outcome;
    }
    if (alchemistRound) {
      round.consequence += finishAlchemistCombatRound(state, alchemistRound, outcome === 'CONTINUE');
      round.alchemistOutcome = alchemistRound.outcome;
    }
    if (manipulatorRound) {
      round.consequence += finishManipulatorCombatRound(state, manipulatorRound);
      round.manipulatorOutcome = manipulatorRound.outcome;
    }
    if (ironBloodRound) {
      round.consequence += finishIronBloodCombatRound(state, ironBloodRound, outcome === 'CONTINUE');
      round.ironBloodOutcome = ironBloodRound.outcome;
    }
    combat.lastRound = round;
    state.lastCombatRound = round;
    combat.round += 1;
    state.random.cursor = random.cursor;
    // Only a complete continuing round grants the normal resource recovery.
    if (outcome === 'CONTINUE') state.spirituality = Math.min(maxSpirituality, state.spirituality + maxSpirituality * 0.1);
    return { round, outcome };
  };

  if (manipulator && combat.enemyMind <= 0) {
    combat.enemyStatus = 'SURRENDERED'; round.winner = 'PLAYER';
    round.consequence = '同一原鲁兰因已有精神瘟疫耗竭而自行停止抵抗，精神0但仍活着，放下自己的原棍；没有心灵控制保证或精神伤害判死。';
    return finish('ENEMY_SURRENDERED');
  }
  const remaining = { PLAYER: round.playerCount, ENEMY: round.enemyCount };
  const order: Actor[] = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] : ['ENEMY', 'PLAYER'];
  // New S5 only: the ordinary opponent makes exactly one present decision.
  // No future list, RNG peek or extra draw at execution. All older profiles
  // still draw their ordinary action at the original point below.
  if (parasiteEnemy && parasiteRound) decideParasiteEnemyIntent(state, parasiteRound, drawParasiteEnemyAbility(random));
  if (dreamStealerRound) decideDreamStealerEnemyIntent(state, dreamStealerRound, drawAbility(random, null).id);
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) {
    for (const actor of order) {
      if (remaining[actor] === 0) continue;
      if (actor === 'PLAYER' && stance === 'RETREAT') {
        const releasedSilk = pleasure ? releasePleasureSilkBinding(state) : null;
        if (releasedSilk) round.moves.push({ actor, label: releasedSilk, selfGain: 0, enemyReduction: 0 });
        const releasedDream = (nightmare && nightmareDreamLocked(state)) || (spiritWarlock && state.spiritWarlock.encounter.dreamLocked);
        if (nightmare) releaseNightmareDream(state);
        if (spiritWarlock) releaseSpiritWarlockCombatDream(state);
        if (releasedDream) round.moves.push({ actor, label: '先解除梦境牵制、恢复本体行动，再沿原普通出口尝试撤退；牵引积累归0', selfGain: 0, enemyReduction: 0 });
        remaining.PLAYER = 0;
        // Same actual route as the ordinary encounter. No movement ability is
        // granted by S9, and the new cross-tier retreat candidate is not assumed.
        if (random.nextInt(1, 100) <= 50) {
          round.retreat = 'SUCCESS';
          round.winner = 'ENEMY';
          round.consequence = demonHunterEnemy ? '本人沿原独立侧院的实际普通出口退出；同一原DH4-CINDER-GUARD及其H/M/S留在原处，无追逐、瞬移、拖带或夺物。自己的伤势与已耗涂层保留。' : parasiteEnemy ? '本人沿原干燥庭院实际普通出口退出，原拉尔夫与自己的PR4-RALF-CLUB留在原处，没有追逐或瞬移；原身体、伤势、已付灵性与能力暂窃记录保留。' : secretsSorcererEnemy ? '本人提起同一空原框箱，在这次成功撤退中沿已核实的地面出口走出原石拱8米固有界；原兽无法追出，原健康、伤势与有限灵性保留。没有免费瞬移、获胜或捕获，仍需交还同一原箱。' : undying ? '本人沿原档案石院净空普通出口实际退出，原欧文与自己的UDY4-OWEN-CLUB留在原处；没有追逐、瞬移、夺棍或原灰羽移动，实付灵性、伤势与周期未经历登记保留。' : unshadowed ? '本人沿原石院开放普通出口实际退出，无暗领域没有物理墙；原埃德蒙与自己的UD4-EDMUND-CLUB留在原处，没有追逐、瞬移或夺棍。原地面焦痕、真实伤势和实付灵性保留。' : cataclysmPriest ? '本人沿原石码头净空干燥普通出口实际退出，原本尼迪克特·维尔与自己的CP4-BENEDICT-CLUB留在原处；没有追逐、瞬移或夺棍，有限风水雷结束，实付灵性不返还、不治疗。' : prophet ? '本人沿原档案馆空院净空普通出口实际离开，原哈罗德·布伦特与自己的PF4-HAROLD-CLUB留在原处；没有追逐、瞬移或夺棍，已耗原片与灵性不退、不治疗。' : nightwatcher ? '本人沿原练习院净空普通出口实际离开，原布拉姆·洛与自己的NW4-BRAM-CLUB留在原处；没有追逐或瞬移，原灵随后实际召回，实付灵性不退、不治疗。' : witchKing ? '本人沿原练习院的净空普通出口实际离开，原多里安与自己的WK4-DORIAN-CLUB留在原处；没有追逐或瞬移，已耗原纸与灵性不退，不治疗。' : alchemist ? '你沿原工坊空院的普通净空出口实际退出，原奥斯里克和自己的原棍留在原处；本人停止并取回同一原护架，储能、耐久、健康与实付灵性保留，没有追逐或瞬移。' : manipulator ? '你沿原仓库净空外院的原普通出口实际退出，原鲁兰和自己的原棍留在原地；原健康、精神与已经形成的精神瘟疫保留，没有追逐、瞬移、夺棍或离场自动治愈。' : ironBlood ? '你沿原空石院的原普通出口实际撤离，加里克与自己的原短棍留在现场；受邀队员随后沿原路返家，原健康和精力保留。没有追逐、瞬移或夺棍。' : bizarroEnemy ? '本人沿已勘察原通道实际退出原钟8米界，原兽受固有边界限制不能追出；原身体、旧伤和实付资源保留，没有瞬移或免费逃生。' : combat.encounterId === 'PUNISHMENT_KNIGHT_DISPUTE'
            ? '你沿原调解处日光净空外院的原普通出口实际退出，迪恩和自己的原短棍留在原处，没有追逐、瞬移或夺棍。本轮单次禁令、待用惩戒与有限囚禁全部结束，原伤势与实际消耗保留；已退出者不再承受后续伤害。'
            : combat.encounterId === 'MENTOR_DISORDER_DISPUTE'
            ? '你沿原契约铺日光净空外院的原普通出口安全撤离，里斯和自己的原短棍留在原处，没有瞬移、移物或进入追逐。本轮有限混乱与待用贿赂结束，原伤势与实际消耗保留，已给原礼物留在原地面，不退款、不归还；已退出者不再承受后续攻击。'
            : combat.encounterId === 'WINNER_DISPUTE'
            ? '你沿原日光净空外院的实际原出口退出，奥德里和自己的原短棍留在原处，没有追逐、瞬移或夺棍。有限厄运随本轮结束，剩余积运、实付灵性与原伤势保留，已退出者不再承受后续攻击。'
            : combat.encounterId === 'WRAITH_DISPUTE'
            ? '你沿原工坊日光净空外院的实际原出口退出，贝文和自己的原短棍留在原处，没有追逐、镜跳、拖带或夺棍。本人已完整显形，附身早已在当次动作内退出，迟疑随本场结束；实付灵性、原伤势和月相记录保留，已退出者不再承受后续攻击。'
            : combat.encounterId === 'DESIRE_APOSTLE_DISPUTE'
            ? '你沿原日光净空外院的实际原出口退出，费兰和自己的原短棍留在原处，没有追逐、瞬移或夺棍。种子与迟疑随本场结束，实付灵性、旧负荷与原伤势保留，已退出者不再承受后续攻击。'
            : combat.encounterId === 'SHEPHERD_DISPUTE'
            ? '你沿原指导室日光净空外院的实际原出口退出，成年普通门廊看守埃尔顿和自己的原短棍留在原处；没有追逐、瞬移、夺棍或独立召唤体。原伤势、实付灵性与储备保留，临时模糊结束，已有原灵和当前选择保留，已撤离者不再承受后续攻击。'
            : combat.encounterId === 'STAR_MYSTIC_DISPUTE'
            ? '你沿原教学室净空外院的实际原出口退出，成年普通空院看守布莱斯和自己的原短棍留在原处；没有追逐、瞬移、夺棍或拖带同伴。原伤势、精神与灵性消耗保留，已燃毁原卷轴不返还，剩余牢笼与聚焦结束，原厚眼镜戴回，已撤离者不再承受后续攻击。'
            : combat.encounterId === 'PAIN_DISPUTE'
            ? '你沿原净空外院的实际原出口退出，原身体与自有原物一起离开；同一原奥伦和自己的原短棍留在原处。没有追逐、夺棍、瞬移或同伴拖带，疾病场停止，但原病况、伤势与实付资源全部保留。'
            : combat.encounterId === 'GUARDIAN_DISPUTE'
            ? '你沿原训练场外院的实际原出口安全退出，自己的原身体与实际持有物一起离开；埃德温和自己的原短棍留在原处。没有追逐、瞬移、夺棍或同伴拖带，临时剑甲清除，伤势与实付灵性保留。'
            : combat.encounterId === 'DREAM_STEALER_DISPUTE'
            ? '你沿原纸箱房私人庭院的实际原出口安全退出，自己的原身体与实际持有物一起离开。马洛和自己的原棍留在原处，没有追逐、瞬移、夺棍或持续思想删除；他可重新决定，伤势与实付灵性保留，已撤离的你不再承受后续伤害。'
            : combat.encounterId === 'TRAVELER_DISPUTE'
            ? '你沿原仓库私人厅实际普通出口安全退出，原身体与自有装备一起离开；贝兰和自己的原棍留在原现场，没有追逐、免费瞬移、拖带贝兰或夺棍。伤势、实付灵性与原记录消耗保留；已撤离的你不再承受后续伤害。'
            : combat.encounterId === 'GATEKEEPER_DISPUTE'
            ? '你沿原私人庭院身后的实际原出口安全退出，没有瞬移、追逐、拖带成年旧纪念院看守洛克或夺走他的原棍。洛克与自己的原棍留在原现场；原伤势与实际灵性消耗保留，冥界门当次已关，实际仍在体内的同一原灰羽随玩家原身体退出，没有被清空、免费回家或追加逃生动作，已撤离的你不再承受后续伤害。'
            : combat.encounterId === 'PRIEST_OF_LIGHT_DISPUTE'
            ? '你沿原私人庭院身后的实际原出口安全退出，没有瞬移、追逐、拖带普通门房凯恩或夺走他的原棍。凯恩与自己的原棍留在原现场；原伤势与实际灵性消耗保留，圣光与短吟当次结束，已撤离的你不再承受后续伤害。'
            : combat.encounterId === 'OCEAN_SINGER_DISPUTE'
            ? `你沿原私人码头作业院身后的实际原出口安全退出，没有瞬移、追逐、拖带码头管事布伦或夺走他的原棍。布伦与自己的原棍留在原现场；原伤势与实际灵性消耗保留，短促歌声已经结束，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'MYSTICISM_MAGISTER_DISPUTE'
            ? `你沿原私人工院的实际原出口安全撤离，没有瞬移、追逐、拖带罗文或夺走他的原棍。原伤势与实际消耗保留，已耗原闪光物不补充，未耗原件仍由你持有；已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'SPIRIT_WARLOCK_DISPUTE'
            ? `你沿原独立净空私人庭院身后的实际原出口安全退出，没有瞬移、追逐或拖带人物物件。${enemyName}与自己的原棍留在原现场；原伤势和实际消耗保留，梦境与原灵出动实际收束，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'CRIMSON_SCHOLAR_DISPUTE'
            ? `你沿原私人月照庭院身后的实际原出口安全退出，没有瞬移、追逐或拖带人物物件。${enemyName}与自己的原棍留在原现场，原伤势和实际灵性消耗保留，没有遗留月光重组效果，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'ASTRONOMER_DISPUTE'
            ? `你沿原观测台外院身后的实际原出口安全退出，没有瞬移、追逐或拖带人物物件。${enemyName}与自己的原棍留在原现场；原仪器与客户原灯未移动，原伤势和灵性消耗保留，短时专注不留下持续效果，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'DREAMWALKER_DISPUTE'
            ? `你沿原会所后庭身后的实际原出口安全退出，没有梦境瞬移、拖带人物物件或进入追逐。${enemyName}与自己的原棍留在原现场；原伤势和灵性消耗保留，没有建立或遗留梦境控制，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'REAPER_DISPUTE'
            ? `你沿原空石院身后的实际后门安全退出，没有瞬移、拖带人物物件或进入追逐。${enemyName}与自己的原棍留在原现场；原伤势和消耗保留，剩余弱点窗口结束，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'MARIONETTIST_DISPUTE'
            ? `你沿原前院身后的实际后门安全退出，没有瞬移、拖带人物物件或进入追逐。${enemyName}与其原棍留在原现场；原伤势与消耗保留，灵体之线本轮有限迟缓结束，没有秘偶随行。`
            : combat.encounterId === 'DRUID_DISPUTE'
            ? '你的原身体沿原花园边庭身后净空的原干燥普通侧路和出口实际退出，马伦与自己的原普通短棍留在原处。任何已用的短地下潜行均已当次再出、壤土稳定，没有免费地下逃生、地下驻留、追逐、埋敌或夺棍；原伤势与实付灵性保留，已撤离者不再承受后续伤害。'
            : combat.encounterId === 'BIOLOGIST_DISPUTE'
            ? `你沿原温室净空外院的原普通出口安全撤离，没有瞬移、移物或进入追逐。${enemyName}和自己的原短棍留在现场，原苗木仍在原温室；原伤势和实际灵性消耗保留，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'JUDGE_DISPUTE'
            ? `你沿原调解处净空外院的原普通出口安全撤离，没有瞬移、移物或进入追逐。${enemyName}和自己的原短棍留在现场；原伤势和实际灵性消耗保留，已撤离的你不再承受后续伤害，不延续禁令或追加惩戒。`
            : combat.encounterId === 'CORRUPTION_BARON_DISPUTE'
            ? `你沿原契约铺净空外院的原普通出口安全撤离，没有瞬移、移物或进入追逐。${enemyName}和自己的原短棍留在现场；原伤势和实际消耗保留，已赠原物留在地面，不退款、不归还，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'CALAMITY_PRIEST_DISPUTE'
            ? `你沿原净空外院的原普通出口安全撤离，没有瞬移或进入追逐。${enemyName}和自己的原短棍留在现场；原伤势与实际消耗保留，撤退不抽被动幸运，也不凭空制造灾害，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'ZOMBIE_DISPUTE'
            ? `你沿原净空外院的原普通出口安全撤离，没有瞬移或进入追逐。${enemyName}和自己的原短棍留在现场；实际灵性消耗、原伤势与月相记录保留，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'DEMON_DISPUTE'
            ? `你沿原旧货库独立外院的原普通出口安全撤离，没有瞬移或进入追逐。${enemyName}和自己的原短棍留在现场；实际灵性消耗、负荷与原伤势保留，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'ROSE_BISHOP_DISPUTE'
            ? `你沿原独立日光外院的原普通出口安全撤离，没有瞬移或进入追逐。${enemyName}和自己的原短棍留在现场；已耗血肉储备与灵性不返还，原伤势保留，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'SCROLL_PROFESSOR_DISPUTE'
            ? `你沿原卷轴教学空院的原普通出口安全撤离，没有瞬移或进入追逐。${enemyName}和自己的原短棍留在现场；已燃毁的原卷轴不返还，未使用原件保留，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'PLEASURE_DISPUTE'
            ? `你沿原独立练习空院的原普通出口安全撤离，没有瞬移或进入追逐。${enemyName}和自己的原短棍留在现场；丝线与束缚已实际解除，原消耗和伤势保留，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'DAWN_PALADIN_DISPUTE'
            ? `你沿原训练场外空院的原普通出口安全撤离，没有瞬移或进入追逐。${enemyName}和自己的原短棍留在现场；剑甲临时状态随离场清除，已发生的消耗和伤势保留，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'FIRE_THIEF_DISPUTE'
            ? `你沿原导师练习场外空院的原出口安全撤离，没有瞬移或进入追逐。${enemyName}和原棍留在现场；剩余暂借窗口在安全离开后的实际等候中结束，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'RECORDER_DISPUTE'
            ? `你沿原教学室外空院的普通出口安全撤离，没有传送、穿门或进入追逐。${enemyName}和自己的原短棍留在现场，已消耗的记录不返还，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'SPIRIT_GUIDE_DISPUTE'
            ? `你沿原纪念工作室外空院的普通出口安全撤离，没有瞬移或进入追逐；未借用生活信使掩护。${enemyName}和自己的原短棍留在现场，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'NOTARY_DISPUTE'
            ? `你沿原小教堂工作间外空院的普通出口安全撤离，没有瞬移或进入追逐。${enemyName}和自己的原短棍留在现场，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'WIND_BLESSED_DISPUTE'
            ? `你沿原维修院外院的普通出口安全撤离，没有使用飞行、瞬移或进入追逐。${enemyName}和自己的原短棍留在现场，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'POLYMATH_DISPUTE'
            ? `你沿原借阅馆教学室外空院的普通出口安全撤离，没有瞬移或进入追逐。${enemyName}和自己的原短棍留在现场，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'SOOTHER_DISPUTE'
            ? `你沿原夜间值班室外空院的普通出口安全撤离，没有瞬移或进入追逐。${enemyName}和自己的原短棍留在现场，已撤离的你不再承受后续伤害。`
            : combat.encounterId === 'POTION_PROFESSOR_DISPUTE'
            ? `你沿原药房外院的实际出口安全撤离，未飞越墙壁，也未进入追逐。${enemyName}和自己的原短棍留在现场，已撤离的你不再承受后续伤害。`
            : `你已安全撤离。${enemyName}保住了现场，已撤离的你不再承受后续伤害。`;
          return finish('RETREATED');
        }
        round.retreat = 'FAILURE';
        continue;
      }
      remaining[actor] -= 1;
      const opponent: Actor = actor === 'PLAYER' ? 'ENEMY' : 'PLAYER';
      if (actor === 'PLAYER' && druid) {
        const ability = resolveDruidCombatAbility(
          state, drawDruidAbility(random, stance), 1 - statusPenalty(state.health, 100), random, druidSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && biologist) {
        const ability = resolveBiologistCombatAbility(
          state, drawBiologistAbility(random, stance), 1 - statusPenalty(state.health, 100), random, biologistSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && harvestpriest) {
        const ability = resolveHarvestpriestCombatAbility(
          state, drawHarvestpriestAbility(random, stance), 1 - statusPenalty(state.health, 100), random, harvestpriestSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && physician) {
        const ability = resolvePhysicianCombatAbility(
          state, drawPhysicianAbility(random, stance), 1 - statusPenalty(state.health, 100), random, physicianSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && cultivator) {
        const ability = resolveCultivatorCombatAbility(
          state, drawCultivatorAbility(random, stance), 1 - statusPenalty(state.health, 100), random, cultivatorSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && winner) {
        const ability = resolveWinnerCombatAbility(
          state, drawWinnerAbility(random, stance), 1 - statusPenalty(state.health, 100), random, winnerSource, winnerPolicy,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && calamityPriest) {
        const ability = resolveCalamityPriestCombatAbility(
          state, drawCalamityPriestAbility(random, stance), 1 - statusPenalty(state.health, 100), random, calamityPriestSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && lucky) {
        const ability = resolveLuckyCombatAbility(
          state, drawLuckyAbility(random, stance), 1 - statusPenalty(state.health, 100), random, luckySource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && machine) {
        const ability = resolveMachineCombatAbility(
          state, drawMachineAbility(random, stance), 1 - statusPenalty(state.health, 100), random, machineSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && mentorDisorderRound) {
        const ability = resolveMentorDisorderCombatAbility(
          state, drawMentorDisorderAbility(random, stance), 1 - statusPenalty(state.health, 100), random, mentorDisorderRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && corruptionBaronRound) {
        const ability = resolveCorruptionBaronCombatAbility(
          state, drawCorruptionBaronAbility(random, stance), 1 - statusPenalty(state.health, 100), random, corruptionBaronRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && briberRound) {
        const ability = resolveBriberCombatAbility(
          state, drawBriberAbility(random, stance), 1 - statusPenalty(state.health, 100), random, briberRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && barbarian) {
        const ability = resolveBarbarianCombatAbility(
          state, drawBarbarianAbility(random, stance), 1 - statusPenalty(state.health, 100), random, barbarianSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && punishmentKnightRound) {
        const ability = resolvePunishmentKnightCombatAbility(
          state, drawPunishmentKnightAbility(random, stance), 1 - statusPenalty(state.health, 100), random, punishmentKnightRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && judgeRound) {
        const ability = resolveJudgeCombatAbility(
          state, drawJudgeAbility(random, stance), 1 - statusPenalty(state.health, 100), random, judgeRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && interrogator) {
        const ability = resolveInterrogatorCombatAbility(
          state, drawInterrogatorAbility(random, stance), 1 - statusPenalty(state.health, 100), random, interrogatorSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && sheriff) {
        const ability = resolveSheriffCombatAbility(
          state, drawSheriffAbility(random, stance), 1 - statusPenalty(state.health, 100), random, sheriffSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && arbiter) {
        const ability = resolveArbiterCombatAbility(
          state, drawArbiterAbility(random, stance), 1 - statusPenalty(state.health, 100), random, arbiterSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && lawyer) {
        const ability = resolveLawyerCombatAbility(
          state, drawLawyerAbility(random, stance), 1 - statusPenalty(state.health, 100), random, lawyerSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && monster) {
        const ability = resolveMonsterCombatAbility(
          state, drawMonsterAbility(random, stance), 1 - statusPenalty(state.health, 100), random, monsterSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && wraith) {
        const ability = resolveWraithCombatAbility(
          state, drawWraithAbility(random, stance), 1 - statusPenalty(state.health, 100), random, wraithSource, madmanRound,
        );
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && zombie) {
        const ability = resolveZombieCombatAbility(
          state, drawZombieAbility(random, stance), 1 - statusPenalty(state.health, 100), random, zombieSource, madmanRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && werewolf) {
        const ability = resolveWerewolfCombatAbility(
          state, drawWerewolfAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
          werewolfRound, madmanRound, werewolfSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && madman) {
        const ability = resolveMadmanCombatAbility(
          state, drawMadmanAbility(random, stance), 1 - statusPenalty(state.health, 100), random, madmanRound, madmanSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && prisoner) {
        const ability = resolvePrisonerCombatAbility(
          state, drawPrisonerAbility(random, stance), 1 - statusPenalty(state.health, 100), random, prisonerSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && desireApostle) {
        const ability = resolveDesireApostleCombatAbility(
          state, drawDesireApostleAbility(random, stance), 1 - statusPenalty(state.health, 100), random, desireApostleSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && demon) {
        const ability = resolveDemonCombatAbility(
          state, drawDemonAbility(random, stance), 1 - statusPenalty(state.health, 100), random, demonSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && serialKiller) {
        const ability = resolveSerialKillerCombatAbility(
          state, drawSerialKillerAbility(random, stance), 1 - statusPenalty(state.health, 100), random, serialKillerSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && unwinged) {
        const ability = resolveUnwingedCombatAbility(
          state, drawUnwingedAbility(random, stance), 1 - statusPenalty(state.health, 100), random, unwingedSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && criminal) {
        const ability = resolveCriminalCombatAbility(
          state, drawCriminalAbility(random, stance), 1 - statusPenalty(state.health, 100), random, criminalSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && shepherd) {
        const ability = resolveShepherdCombatAbility(
          state, drawShepherdAbility(random, stance), 1 - statusPenalty(state.health, 100), random, shepherdSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && roseBishop) {
        const ability = resolveRoseBishopCombatAbility(
          state, drawRoseBishopAbility(random, stance), 1 - statusPenalty(state.health, 100), random, roseBishopSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && shadowAscetic) {
        const ability = resolveShadowAsceticCombatAbility(
          state, drawShadowAsceticAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && listener) {
        const ability = resolveListenerCombatAbility(
          state, drawListenerAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && secretSupplicant) {
        const ability = resolveSecretSupplicantCombatAbility(
          state, drawSecretSupplicantAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && starMystic) {
        const ability = resolveStarMysticCombatAbility(
          state, drawStarMysticAbility(random, stance), 1 - statusPenalty(state.health, 100), random, starMysticSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && scrollProfessor) {
        const ability = resolveScrollProfessorCombatAbility(
          state, drawScrollProfessorAbility(random, stance), 1 - statusPenalty(state.health, 100), random, scrollProfessorSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && wizard) {
        const ability = resolveWizardCombatAbility(
          state, drawWizardAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && combatScholar) {
        const ability = resolveCombatScholarCombatAbility(
          state, drawCombatScholarAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && pryer) {
        const ability = resolvePryerCombatAbility(
          state, drawPryerAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && pain) {
        const ability = resolvePainCombatAbility(
          state, drawPainAbility(random, stance), 1 - statusPenalty(state.health, 100), random, painSource, stance,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && pleasure) {
        const ability = resolvePleasureCombatAbility(
          state, drawPleasureAbility(random, stance), 1 - statusPenalty(state.health, 100), random, pleasureSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && witch) {
        const ability = resolveWitchCombatAbility(
          state, drawWitchAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && instigator) {
        const ability = resolveInstigatorCombatAbility(
          state, drawInstigatorAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && assassin) {
        const ability = resolveAssassinCombatAbility(
          state, drawAssassinAbility(random, stance), 1 - statusPenalty(state.health, 100), random, assassinSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && guardianRound) {
        const ability = resolveGuardianCombatAbility(
          state, drawGuardianAbility(random, stance), 1 - statusPenalty(state.health, 100), random, guardianRound, guardianSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens && !guardianRound.defending) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && dawnPaladin) {
        const ability = resolveDawnPaladinCombatAbility(
          state, drawDawnPaladinAbility(random, stance), 1 - statusPenalty(state.health, 100), random, dawnPaladinSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && weaponmaster) {
        const ability = resolveWeaponmasterCombatAbility(
          state, drawWeaponmasterAbility(random, stance), 1 - statusPenalty(state.health, 100), random, weaponmasterSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && gladiator) {
        const ability = resolveGladiatorCombatAbility(
          state, drawGladiatorAbility(random, stance), 1 - statusPenalty(state.health, 100), random, gladiatorSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && warrior) {
        const ability = resolveWarriorCombatAbility(
          state, drawWarriorAbility(random, stance), 1 - statusPenalty(state.health, 100), random, warriorSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && demonHunterRound) {
        const ability = resolveDemonHunterCombatAbility(state, drawDemonHunterAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, demonHunterRound, demonHunterSource);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && parasiteRound) {
        const ability = resolveParasiteCombatAbility(state, drawParasiteAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, parasiteRound, parasiteSource);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && dreamStealerRound) {
        const ability = resolveDreamStealerCombatAbility(
          state, drawDreamStealerAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
          dreamStealerRound, dreamStealerSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && fireThief && fireThiefObservations) {
        const ability = resolveFireThiefCombatAbility(
          state, drawFireThiefAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
          fireThiefObservations, fireThiefSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && cryptologist && cryptologistObservations) {
        const ability = resolveCryptologistCombatAbility(
          state, drawCryptologistAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
          remaining, cryptologistObservations, cryptologistSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && swindler) {
        const ability = resolveSwindlerCombatAbility(
          state, drawSwindlerAbility(random, stance), 1 - statusPenalty(state.health, 100), random, remaining, swindlerSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && marauder) {
        const attentionBefore = state.marauder.dispute.attention;
        const ability = resolveMarauderCombatAbility(
          state, drawMarauderAbility(random, stance), 1 - statusPenalty(state.health, 100), random, marauderSource,
        );
        if (marauderSource?.encounterId === 'MARAUDER_DISPUTE' && state.marauder.dispute.attention > attentionBefore) {
          marauderCounterWindow = true;
        }
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && astrologer) {
        const ability = resolveAstrologerCombatAbility(
          state, drawAstrologerAbility(random, stance, state.progression.sequence ?? 7),
          1 - statusPenalty(state.health, 100), random, astrologerSource, recorderRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && trickmaster) {
        const ability = resolveTrickmasterCombatAbility(
          state, drawTrickmasterAbility(random, stance), 1 - statusPenalty(state.health, 100), random, trickmasterSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && apprentice) {
        const ability = resolveApprenticeCombatAbility(
          state, drawApprenticeAbility(random, stance), 1 - statusPenalty(state.health, 100), random, apprenticeSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && spiritmedium) {
        const ability = resolveSpiritmediumCombatAbility(
          state, drawSpiritmediumAbility(random, stance, state.progression.sequence!), 1 - statusPenalty(state.health, 100), random, spiritmediumSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && gravedigger) {
        const ability = resolveGravediggerCombatAbility(
          state, drawGravediggerAbility(random, stance), 1 - statusPenalty(state.health, 100), random, gravediggerSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && corpsecollector) {
        const ability = resolveCorpsecollectorCombatAbility(
          state, drawCorpsecollectorAbility(random, stance), 1 - statusPenalty(state.health, 100), random, corpsecollectorSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && sunpriest) {
        const ability = resolveSunpriestCombatAbility(
          state, drawSunpriestAbility(random, stance, state.progression.sequence!), 1 - statusPenalty(state.health, 100), random,
          sunpriestSource, notaryRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && lightprayer) {
        const ability = resolveLightprayerCombatAbility(
          state, drawLightprayerAbility(random, stance), 1 - statusPenalty(state.health, 100), random, lightprayerSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && bardRound) {
        const ability = resolveBardCombatAbility(
          state, drawBardAbility(random, stance), 1 - statusPenalty(state.health, 100), random, bardRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && navigator) {
        const ability = resolveNavigatorCombatAbility(
          state, drawNavigatorAbility(random, stance, state.progression.sequence!), 1 - statusPenalty(state.health, 100), random, rageRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && rager) {
        const ability = resolveRagerCombatAbility(
          state, drawRagerAbility(random, stance), 1 - statusPenalty(state.health, 100), random, rageRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && sailor) {
        const ability = resolveSailorCombatAbility(
          state, drawSailorAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && detective) {
        const ability = resolveDetectiveCombatAbility(
          state, drawDetectiveAbility(random, stance, state.progression.sequence!), 1 - statusPenalty(state.health, 100), random, detectiveObservations!,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && reasoner) {
        const ability = resolveReasonerCombatAbility(
          state, drawReasonerAbility(random, stance), 1 - statusPenalty(state.health, 100), random, reasonerSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && reader) {
        const ability = resolveReaderCombatAbility(
          state, drawReaderAbility(random, stance), 1 - statusPenalty(state.health, 100), random, readerSource,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && nightmare) {
        const ability = resolveNightmareCombatAbility(
          state, drawNightmareAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && midnight) {
        const ability = resolveMidnightCombatAbility(
          state, drawMidnightAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && sleepless) {
        const ability = resolveSleeplessCombatAbility(
          state, drawSleeplessAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && vampire) {
        const ability = resolveVampireCombatAbility(
          state, drawVampireAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && secretsSorcererEnemy) {
        const ability = resolveSecretsSorcererCombatAbility(state, drawSecretsSorcererAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, currentSecretsSorcererCombatSource(state), secretsSorcererRecorderRound);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        if (ability.captured) {
          round.winner = 'PLAYER';
          round.consequence = '同一原半神活着封入本人当前原框箱，ENEMY_SEALED；剩余动作立即停止，未抽共享胜负或伤势盘。不是投降、死亡或NPC代捕，须独立确认服药并实际退出归还。';
          return finish('ENEMY_SEALED');
        }
        continue;
      }
      if (actor === 'PLAYER' && traveler) {
        const ability = resolveTravelerCombatAbility(
          state, drawTravelerAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
          currentTravelerCombatSource(state), travelerRecorderRound,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && gatekeeper) {
        const ability = resolveGatekeeperCombatAbility(
          state, drawGatekeeperAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && priestOfLight) {
        const ability = resolvePriestOfLightCombatAbility(
          state, drawPriestOfLightAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && oceanSinger) {
        const ability = resolveOceanSingerCombatAbility(
          state, drawOceanSingerAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && mysticismMagister) {
        const ability = resolveMysticismMagisterCombatAbility(
          state, drawMysticismMagisterAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && spiritWarlock) {
        const ability = resolveSpiritWarlockCombatAbility(
          state, drawSpiritWarlockAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && crimsonScholar) {
        const ability = resolveCrimsonScholarCombatAbility(
          state, drawCrimsonScholarAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && astronomer) {
        const ability = resolveAstronomerCombatAbility(
          state, drawAstronomerAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && undying && undyingRound) {
        const ability = resolveUndyingCombatAbility(state, drawUndyingAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, undyingRound);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && unshadowed && unshadowedRound) {
        const ability = resolveUnshadowedCombatAbility(state, drawUnshadowedAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, unshadowedRound);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && cataclysmPriest && cataclysmPriestRound) {
        const ability = resolveCataclysmPriestCombatAbility(state, drawCataclysmPriestAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, cataclysmPriestRound);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && prophet && prophetRound) {
        const ability = resolveProphetCombatAbility(state, drawProphetAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, prophetRound);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && nightwatcher && nightwatcherRound) {
        const ability = resolveNightwatcherCombatAbility(state, drawNightwatcherAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, nightwatcherRound);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && witchKing && witchKingRound) {
        const ability = resolveWitchKingCombatAbility(state, drawWitchKingAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, witchKingRound);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && alchemist && alchemistRound) {
        const ability = resolveAlchemistCombatAbility(state, drawAlchemistAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, alchemistRound);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && manipulator && manipulatorRound) {
        const ability = resolveManipulatorCombatAbility(state, drawManipulatorAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, manipulatorRound);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        if (ability.mentalPressure) mentalPressure = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        if (combat.enemyMind <= 0) {
          combat.enemyStatus = 'SURRENDERED'; round.winner = 'PLAYER';
          round.consequence = '同一原鲁兰精神实际耗竭至0，自行停止抵抗并放下自己的原棍；原身体仍活着，不把精神损耗当作死亡或万能控制。';
          return finish('ENEMY_SURRENDERED');
        }
        continue;
      }
      if (actor === 'PLAYER' && dreamwalker) {
        const ability = resolveDreamwalkerCombatAbility(
          state, drawDreamwalkerAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        if (ability.mentalPressure) mentalPressure = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && psychologist) {
        const ability = resolvePsychologistCombatAbility(
          state, drawPsychologistAbility(random, stance, state.progression.sequence!), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        if (ability.mentalPressure) mentalPressure = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && ironBlood && ironBloodRound) {
        const ability = resolveIronBloodCombatAbility(state, drawIronBloodAbility(random, state, stance),
          1 - statusPenalty(state.health, 100), random, ironBloodRound);
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        if (ability.angersEnemy) enemyAngered = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && reaper) {
        const ability = resolveReaperCombatAbility(
          state, drawReaperAbility(random, state, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        if (ability.angersEnemy) enemyAngered = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && pyromaniac) {
        const ability = resolvePyromaniacCombatAbility(
          state, drawPyromaniacAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        if (ability.angersEnemy) enemyAngered = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && bizarro) {
        const id = drawBizarroSorcererAbility(random, state, stance), before = state.spirituality;
        const original = resolveBizarroSorcererCombatAbility(state, id, 1 - statusPenalty(state.health, 100), currentBizarroSorcererCombatSource(state));
        const ability = bizarroRound ? applyBizarroPlayerCounterplay(state, id, original, before, bizarroRound) : original;
        gains.PLAYER += ability.selfGain; reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && marionettist) {
        const id = drawMarionettistAbility(random, state, stance), before = state.spirituality;
        const original = resolveMarionettistCombatAbility(state, id, 1 - statusPenalty(state.health, 100));
        const ability = bizarroRound ? applyBizarroPlayerCounterplay(state, id, original, before, bizarroRound) : original;
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && magician) {
        const ability = resolveMagicianCombatAbility(
          state, drawMagicianAbility(random, state, stance), 1 - statusPenalty(state.health, 100),
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && clown) {
        const ability = resolveClownCombatAbility(
          state, drawClownAbility(random, stance), 1 - statusPenalty(state.health, 100),
          currentClownDangerSource(state),
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && seer) {
        const ability = resolveSeerCombatAbility(
          state, drawSeerAbility(random, stance), 1 - statusPenalty(state.health, 100),
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && mindreader) {
        const ability = resolveMindreaderCombatAbility(
          state, drawMindreaderAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && audience) {
        const ability = resolveAudienceCombatAbility(
          state, drawAudienceAbility(random, stance), 1 - statusPenalty(state.health, 100),
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && provoker) {
        const ability = resolveProvokerCombatAbility(
          state, drawProvokerAbility(random, stance), 1 - statusPenalty(state.health, 100), random,
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        if (ability.angersEnemy) enemyAngered = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'PLAYER' && hunter) {
        const ability = resolveHunterCombatAbility(
          state, drawHunterAbility(random, stance), 1 - statusPenalty(state.health, 100),
          currentHunterDangerSource(state),
        );
        gains.PLAYER += ability.selfGain;
        reductions.ENEMY += ability.enemyReduction;
        if (ability.threatens) threatened.ENEMY = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'ENEMY' && demonHunterEnemy && demonHunterRound) {
        const ability = resolveDemonHunterEnemyAbility(state, drawDemonHunterEnemyAbility(random),
          1 - statusPenalty(combat.enemyHealth, 100), demonHunterRound);
        gains.ENEMY += ability.selfGain; reductions.PLAYER += ability.enemyReduction;
        if (ability.threatens) threatened.PLAYER = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'ENEMY' && parasiteEnemy && parasiteRound) {
        const ability = resolveParasiteEnemyIntent(state, parasiteRound, 1 - statusPenalty(combat.enemyHealth, 100));
        gains.ENEMY += ability.selfGain; reductions.PLAYER += ability.enemyReduction;
        if (ability.threatens) threatened.PLAYER = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        if (remaining.ENEMY > 0) decideParasiteEnemyIntent(state, parasiteRound, drawParasiteEnemyAbility(random));
        continue;
      }
      if (actor === 'ENEMY' && secretsSorcererEnemy) {
        const ability = resolveSecretsSorcererEnemyAbility(state, drawSecretsSorcererEnemyAbility(random), 1 - statusPenalty(combat.enemyHealth, 100));
        gains.ENEMY += ability.selfGain; reductions.PLAYER += ability.enemyReduction;
        if (ability.threatens) threatened.PLAYER = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'ENEMY' && bizarroRound) {
        const ability = resolveBizarroEnemyAbility(state, drawBizarroEnemyAbility(random), 1 - statusPenalty(combat.enemyHealth, 100), bizarroRound);
        gains.ENEMY += ability.selfGain; reductions.PLAYER += ability.enemyReduction;
        if (ability.threatens) threatened.PLAYER = true;
        round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
        continue;
      }
      if (actor === 'ENEMY' && fireThief && fireThiefEnemyRound && fireThiefObservations) {
        const id = drawBardAbility(random, null);
        const ability = resolveFireThiefEnemyAction(state, id, false, random, fireThiefEnemyRound,
          1 - statusPenalty(combat.enemyHealth, 100), fireThiefSource);
        if (ability) {
          gains.ENEMY += ability.selfGain;
          reductions.PLAYER += ability.enemyReduction;
          if (ability.threatens) threatened.PLAYER = true;
          round.moves.push({ actor, label: ability.label, selfGain: ability.selfGain, enemyReduction: ability.enemyReduction });
          // The actual held-club body contribution is observable; song support is not a second body fact.
          if (id === 'sun.s9.praise') observeFireThiefEnemyAction(state, fireThiefObservations, 'STRIKE',
            Math.min(16 * (1 - statusPenalty(combat.enemyHealth, 100)), ability.selfGain));
        }
        continue;
      }
      const dreamStealerDecision = actor === 'ENEMY' && dreamStealerRound
        ? consumeDreamStealerEnemyIntent(state, dreamStealerRound) : null;
      const ability = dreamStealerDecision
        ? ABILITIES.find(a => a.id === dreamStealerDecision.id)!
        : drawAbility(random, actor === 'PLAYER' ? stance : enemyAngered ? 'ATTACK' : null);
      const dreamResponse = actor === 'ENEMY' && spiritWarlock
        ? resolveSpiritWarlockEnemyAction(state, random, ability.id === 'STRIKE')
        : actor === 'ENEMY' && nightmare
        ? resolveNightmareEnemyAction(state, random, ability.id === 'STRIKE') : null;
      // Read the original item's current custody for every move, including
      // enemy moves that follow a successful theft in this same round.
      const armed = actor === 'ENEMY' ? undying || unshadowed || cataclysmPriest || prophet || nightwatcher || witchKing || alchemist || manipulator || druid || punishmentKnight || mentorDisorder || winner || wraith || desireApostle || shepherd || starMystic || pain || guardian ? true : marauderEnemyArmed(state) : state.town.clubLocation === 'HAND';
      const originalGain = ability.id === 'STRIKE' && armed ? 16 : ability.selfGain;
      const navigatorResponse = actor === 'ENEMY' && navigator
        ? consumeNavigatorWater(state, ability.id, originalGain, ability.enemyReduction) : null;
      const swindlerResponse = actor === 'ENEMY' && (swindler || cryptologist) ? consumeSwindlerMisdirection(state) : null;
      // The finite Judge prohibition is evaluated in actual action order, after
      // the ordinary slot draw. It affects only later STRIKE slots, never defenses.
      const judgeResponse = actor === 'ENEMY' && judgeRound
        ? judgeEnemyProhibition(state, judgeRound, ability.id) : null;
      const priorSuppression = Boolean(dreamStealerDecision?.stolen || dreamResponse?.suppressed || navigatorResponse?.suppressed || swindlerResponse || judgeResponse);
      const punishmentProhibition = actor === 'ENEMY' && punishmentKnightRound
        ? punishmentKnightEnemyProhibition(state, punishmentKnightRound, ability.id, random, priorSuppression) : null;
      const suppressed = priorSuppression || Boolean(punishmentProhibition?.blocked);
      const punishmentConfinement = actor === 'ENEMY' && punishmentKnightRound
        ? consumePunishmentKnightConfinement(state, punishmentKnightRound, ability.id, originalGain, suppressed) : null;
      // The same ordinary OPENING keeps its original 8 gain; this scene alone supplies visible self-settling.
      const desireApostleOpening = actor === 'ENEMY' && desireApostle
        ? observeDesireApostleEnemyOpening(state, ability.id, suppressed, desireApostleSource) : null;
      const desireApostleStagger = actor === 'ENEMY' && desireApostle
        ? consumeDesireApostleStagger(state, ability.id, originalGain, suppressed, desireApostleSource) : null;
      const winnerStagger = actor === 'ENEMY' && winner
        ? consumeWinnerStagger(state, ability.id, originalGain, suppressed, winnerSource) : null;
      const wraithStagger = actor === 'ENEMY' && wraith
        ? consumeWraithStagger(state, ability.id, originalGain, suppressed, wraithSource) : null;
      const marauderReaction = actor === 'ENEMY' && ability.id === 'STRIKE' && !suppressed && marauderCounterWindow ? 4 : 0;
      if (marauderReaction > 0) marauderCounterWindow = false;
      // A suppressed slot is still consumed, but it is not an actual impact.
      const sailorResponse = actor === 'ENEMY' && (sailor || rager || navigator) && !suppressed
        ? consumeSailorScales(state, ability.id) : null;
      const demonHunterDefense = actor === 'ENEMY' && demonHunterRound && !suppressed
        ? consumeDemonHunterDefense(state, demonHunterRound, ability.id, originalGain) : null;
      const guardianDefense = actor === 'ENEMY' && guardianRound
        ? consumeGuardianDefense(state, guardianRound, ability.id, originalGain, suppressed) : null;
      const dawnArmorResponse = actor === 'ENEMY' && dawnPaladin
        ? consumeDawnPaladinArmor(state, ability.id, originalGain, suppressed) : null;
      const painStrikeResponse = actor === 'ENEMY' && pain
        ? consumePainEnemyStrike(state, ability.id, originalGain, suppressed) : null;
      const pleasureSilkResponse = actor === 'ENEMY' && pleasure
        ? consumePleasureSilkBinding(state, ability.id, originalGain, suppressed) : null;
      const shepherdBlurResponse = actor === 'ENEMY' && shepherd
        ? consumeShepherdBlur(state, ability.id, originalGain, suppressed, shepherdSource) : null;
      const starMysticCageResponse = actor === 'ENEMY' && starMystic
        ? consumeStarMysticCage(state, ability.id, originalGain, suppressed, starMysticSource) : null;
      const ordinaryGain = suppressed ? 0 : (originalGain + marauderReaction) * (dreamResponse?.physicalMultiplier ?? 1) *
        (sailorResponse?.physicalMultiplier ?? 1) * (navigatorResponse?.contributionMultiplier ?? 1) *
        (dawnArmorResponse?.physicalMultiplier ?? 1) * (guardianDefense?.physicalMultiplier ?? 1) * (demonHunterDefense?.physicalMultiplier ?? 1) * (pleasureSilkResponse?.physicalMultiplier ?? 1) * (painStrikeResponse?.physicalMultiplier ?? 1) * (starMysticCageResponse?.physicalMultiplier ?? 1) * (shepherdBlurResponse?.physicalMultiplier ?? 1) * (desireApostleStagger?.physicalMultiplier ?? 1) * (wraithStagger?.physicalMultiplier ?? 1) * (winnerStagger?.physicalMultiplier ?? 1) * (punishmentConfinement?.physicalMultiplier ?? 1);
      const reasonerResponse = actor === 'ENEMY' && polymath
        ? consumePolymathInterference(state, ordinaryGain)
        : actor === 'ENEMY' && (reasoner || detective) ? consumeReasonerInterference(state, ordinaryGain) : null;
      const beforeDisorderGain = reasonerResponse?.selfGain ?? ordinaryGain;
      const mentorDisorderStrike = actor === 'ENEMY' && mentorDisorderRound
        ? consumeMentorDisorderStrike(state, mentorDisorderRound, ability.id, beforeDisorderGain, suppressed) : null;
      const unweakenedGain = beforeDisorderGain * (mentorDisorderStrike?.physicalMultiplier ?? 1);
      const unweakenedReduction = suppressed ? 0 : ability.enemyReduction * (navigatorResponse?.contributionMultiplier ?? 1);
      // This is an actual enemy slot targeting the player. Resolve first, then
      // weaken only these contributions; never alter earlier moves or add one.
      const briberResponse = actor === 'ENEMY' && mentorDisorderRound && !suppressed
        ? consumeMentorDisorderWeakening(state, mentorDisorderRound, 'PLAYER', unweakenedGain, unweakenedReduction)
        : actor === 'ENEMY' && corruptionBaronRound && !suppressed
        ? consumeCorruptionBaronWeakening(state, corruptionBaronRound, 'PLAYER', unweakenedGain, unweakenedReduction)
        : actor === 'ENEMY' && briberRound && !suppressed
        ? consumeBriberWeakening(state, briberRound, 'PLAYER', unweakenedGain, unweakenedReduction) : null;
      const selfGain = briberResponse?.selfGain ?? unweakenedGain;
      const punishmentBreach = actor === 'ENEMY' && punishmentKnightRound
        ? recordPunishmentKnightBreach(state, punishmentKnightRound, ability.id, selfGain, Boolean(punishmentProhibition?.resisted)) : null;
      const wrathExchange = actor === 'ENEMY' && (rager || navigator)
        ? resolveRagerPhysicalExchange(state, actor, ability.id, selfGain) : null;
      const alchemistGuard = actor === 'ENEMY' && alchemistRound
        ? consumeAlchemistGuard(state, alchemistRound, ability.id, selfGain, suppressed) : null;
      const enemyReduction = briberResponse?.enemyReduction ?? unweakenedReduction;
      gains[actor] += selfGain;
      reductions[opponent] += enemyReduction;
      if (ability.id === 'STRIKE' && !suppressed && selfGain > 0) threatened[opponent] = true;
      const trap = actor === 'ENEMY' && hunter
        ? resolveHunterTrap(state, currentHunterApproachSource(state, ability.id)) : null;
      if (trap) reductions.ENEMY += trap.enemyReduction;
      round.moves.push({
        // The prepared scene effect is reported on the triggering strike. It
        // adds no player action, redraw, attack, or damage permission.
        actor, label: `${ability.id === 'STRIKE' && armed
          ? `短棍打击${trap ? `；${trap.label}` : ''}` : desireApostleOpening ?? ability.label}${desireApostleStagger ? `；${desireApostleStagger.label}` : ''}${wraithStagger ? `；${wraithStagger.label}` : ''}${winnerStagger ? `；${winnerStagger.label}` : ''}${marauderReaction ? '；察觉取棍后的本轮反击+4（G），已消耗' : ''}${dreamResponse ? `；${dreamResponse.label}` : ''}${reasonerResponse?.label ?? ''}${sailorResponse ? `；${sailorResponse.label}` : ''}${navigatorResponse ? `；${navigatorResponse.label}` : ''}${wrathExchange ? `；${wrathExchange}` : ''}${alchemistGuard ? `；${alchemistGuard}` : ''}${swindlerResponse ? `；${swindlerResponse}` : ''}${mentorDisorderStrike ? `；${mentorDisorderStrike.label}` : ''}${briberResponse ? `；${briberResponse.label}` : ''}${dawnArmorResponse ? `；${dawnArmorResponse.label}` : ''}${guardianDefense ? `；${guardianDefense.label}` : ''}${demonHunterDefense ? `；${demonHunterDefense.label}` : ''}${pleasureSilkResponse ? `；${pleasureSilkResponse.label}` : ''}${painStrikeResponse ? `；${painStrikeResponse.label}` : ''}${starMysticCageResponse ? `；${starMysticCageResponse.label}` : ''}${shepherdBlurResponse ? `；${shepherdBlurResponse.label}` : ''}${judgeResponse ? `；${judgeResponse}` : ''}${punishmentProhibition ? `；${punishmentProhibition.label}` : ''}${punishmentConfinement ? `；${punishmentConfinement.label}` : ''}${punishmentBreach ? `；${punishmentBreach}` : ''}${dreamStealerDecision?.stolen ? '；当前这一原念头已被窃取：本次原敌槽贡献0，随后恢复自行决定；没有永久删除、重抽该槽或复制能力' : ''}`,
        selfGain, enemyReduction,
      });
      if (actor === 'ENEMY' && weaponmaster) observeWeaponmasterEnemyAction(state, ability.id, suppressed);
      if (actor === 'ENEMY' && (swindler || cryptologist) && !suppressed) observeSwindlerEnemyAction(state, ability.id);
      if (actor === 'ENEMY' && cryptologistObservations && !suppressed) {
        observeCryptologistEnemyAction(state, cryptologistObservations, ability.id, selfGain);
      }
      if (actor === 'ENEMY' && detectiveObservations) observeDetectiveEnemyAction(detectiveObservations, ability.id);
      // Only now, after the actual original slot, can the living opponent
      // decide its next action. A stolen decision cancels no later decision.
      if (dreamStealerDecision && dreamStealerRound && remaining.ENEMY > 0) {
        decideDreamStealerEnemyIntent(state, dreamStealerRound, drawAbility(random, null).id);
      }
    }
  }
  updateAdvantages();
  // A million-point draw retains fractional probability rather than truncating to d100.
  round.winner = random.nextInt(1, 1_000_000) <= round.winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  if ((guardianRound?.defending || demonHunterRound?.defending) && round.winner === 'PLAYER') {
    round.consequence = `你守住原地，但整轮没有攻击${enemyName}；对方健康、伤势与风险保持原值，不抽敌方伤势、死亡或投降，不自动追加攻击。须后续主动迎战或沿原出口撤退。`;
    return finish('CONTINUE');
  }
  const loser: Actor = round.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER';
  // k counts every resolved defeat while already injured, including a round
  // with no effective strike. Threat still gates injury/death consequences.
  const injuries = loser === 'PLAYER' ? state.injuries : combat.enemyInjuries;
  let risk = loser === 'PLAYER' ? state.injuryRisk : combat.enemyRisk;
  const riskIncreased = injuries.length > 0;
  if (riskIncreased) risk += 1;
  if (loser === 'PLAYER') state.injuryRisk = risk;
  else combat.enemyRisk = risk;
  if ((psychologist || dreamwalker) && loser === 'ENEMY' && mentalPressure && !threatened.ENEMY) {
    // Keep the actual shared consequence draw, but interpret these weights as
    // mental strain only. No physical severity, injury, or death is pending.
    round.consequenceWeights = consequenceWeights(risk);
    const roll = random.nextInt(1, 100);
    round.consequenceRoll = roll;
    const damage = roll <= round.consequenceWeights.light ? 10
      : roll <= round.consequenceWeights.light + round.consequenceWeights.heavy ? 25 : 40;
    combat.enemyMind = Math.max(0, combat.enemyMind - damage);
    round.consequence = `${enemyName}本轮承受精神冲击，后果盘${roll}/100对应精神损耗${damage}（G），精神余量${combat.enemyMind}；健康与原伤势不变，不是死亡或意志控制。`;
    if (combat.enemyMind <= 40) {
      combat.enemyStatus = 'SURRENDERED';
      round.consequence += `${enemyName}仍然活着，自行放下短棍、停止抵抗；没有成为受控者。`;
      return finish('ENEMY_SURRENDERED');
    }
    return finish('CONTINUE');
  }
  if (!threatened[loser]) {
    round.consequence = loser === 'PLAYER'
      ? '你本回合处于下风，但没有承受有效致伤攻击，未增加伤势。'
      : `${enemyName}本回合处于下风，但没有承受有效致伤攻击，未增加伤势。`;
    if (riskIncreased) round.consequence += `已有伤势下再次败北，累计风险增加至${risk}；后续带伤再败的死亡权重将升至${consequenceWeights(risk + 1).death}%。本回合不抽后果盘。`;
    return finish('CONTINUE');
  }

  round.consequenceWeights = consequenceWeights(risk);
  const roll = random.nextInt(1, 100);
  const severity = roll <= round.consequenceWeights.light ? 'LIGHT'
    : roll <= round.consequenceWeights.light + round.consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
  if (magician) {
    // Retain the actual draw even when a real prepared item prevents its pending
    // physical consequence. No death/health/injury mutation has happened yet.
    round.consequenceRoll = roll;
    round.pendingConsequence = severity;
    if (loser === 'PLAYER') {
      const replacement = resolveMagicianFigurineReplacement(state, severity);
      if (replacement) {
        round.consequence = `你本回合败北，后果盘${roll}/100。${replacement.label}`;
        return finish('CONTINUE');
      }
    }
  }
  if (secretsSorcererEnemy) round.consequenceRoll = roll;
  const subject = loser === 'PLAYER' ? '你' : enemyName;
  if (severity === 'DEATH') {
    if (loser === 'PLAYER') state.health = 0;
    else { combat.enemyHealth = 0; combat.enemyStatus = 'DEAD'; }
    round.consequence = demonHunterEnemy
      ? `在原独立侧院与DH4-CINDER-GUARD的冲突中，${subject}真实死亡；原身体、实付资源与原涂层记录保留，不复活、不召同伴或重生旧人。`
      : parasiteEnemy
      ? `在与原拉尔夫的原干燥庭院冲突中，${subject}真实死亡；窃取念头和借用能力不能替死、复制身体或复活，原身体、原棍与实付资源保留。`
      : undying
      ? `在与原欧文的原档案石院冲突中，${subject}真实死亡；六十年周期尚未实际经历，本阶段不复活、不复制身体或灵魂还原，原身体与各自原物留在现场，原灰羽历史和实付成本保留。`
      : unshadowed
      ? `在与原埃德蒙的原石院冲突中，${subject}真实死亡；有限领域、净化光与耀斑不免死、不复活，原身体、各自原物与地面焦痕留在原处，实付灵性保留。`
      : cataclysmPriest
      ? `在原石码头与本尼迪克特的冲突中，${subject}真实死亡；有限风、水、雷不免死、不复活，原身体与原物留在原处，实付资源保留。`
      : prophet
      ? `在与原哈罗德的原档案馆空院冲突中，${subject}真实死亡；有限预警和弱闪光不免死、不复活，原身体与原物留在现场，实付资源保留。`
      : nightwatcher
      ? `在与原布拉姆·洛的原练习院冲突中，${subject}真实死亡；有限厄运、梦境和同一原卷叶不免死、不复活，原身体与原物留在现场，实付资源保留。`
      : witchKing
      ? `在与原多里安的原练习院冲突中，${subject}进入共同物理死亡分支；真实死亡，有限原纸替身不豁免本次死亡、不自动复活，原身体与各自原物留在现场，已付原纸和灵性保留。`
      : alchemist
      ? `在与同一原奥斯里克的工坊空院冲突中，${subject}进入共同物理死亡分支；原护架没有替死、免伤或复活，各自原身体与原物留在现场，储能、耐久和实际消耗保留。`
      : manipulator
      ? `在与同一原鲁兰的仓库冲突中，${subject}进入共同物理死亡分支；有限心灵接触、鳞片与虚拟人格不替死或复活，原身体和各自原物留在现场，已形成的精神瘟疫与实际成本保留。`
      : combat.encounterId === 'DRUID_DISPUTE'
      ? `在与成年普通园工马伦的原花园边庭冲突中，${subject}进入共同死亡分支；没有真实保命或同伴救援，最终死亡。原身体与各自原物留在稳定的原地面，任何已用的地下潜行均已当次再出，实付灵性不返还；不是把马伦埋入地面，也没有地下免伤或复活。`
      : combat.encounterId === 'PUNISHMENT_KNIGHT_DISPUTE'
      ? `在与成年普通人迪恩的原调解处日光外院冲突中，${subject}进入共同死亡分支；没有真实保命或同伴救援，最终死亡。原身体与各自原物留在现场，本轮单次禁令、待用惩戒与有限囚禁结束，实付灵性不退回；不是伤口裁断直接处决。`
      : combat.encounterId === 'MENTOR_DISORDER_DISPUTE'
      ? `在与成年普通人里斯的原契约铺日光外院冲突中，${subject}进入共同死亡分支；没有真实保命能力或同伴救援，最终死亡。原身体与各自原物留在现场，有限混乱与待用贿赂结束，实付灵性和已给原礼物不退回；不是混乱自动致死。`
      : combat.encounterId === 'WINNER_DISPUTE'
      ? `在与成年普通人奥德里的原日光外院冲突中，${subject}进入共同死亡分支；实际积运不保证保命，没有同伴救援，最终死亡。原身体与各自原物留在现场，有限厄运结束，实付积运与灵性不退回。`
      : combat.encounterId === 'WRAITH_DISPUTE'
      ? `在与成年普通人贝文的原工坊日光外院冲突中，${subject}进入共同死亡分支；没有保命或同伴救援，最终死亡。原身体与各自原物留在现场，实付灵性不退回；附身当次已退出，迟疑结束，不复活、不自动吞魂。`
      : combat.encounterId === 'DESIRE_APOSTLE_DISPUTE'
      ? `在与成年普通看守费兰的原日光外院冲突中，${subject}进入共同死亡分支；没有保命或同伴救援，最终死亡。原身体与各自原物留在现场，实付灵性不退回，种子与短暂迟疑结束；不是情绪能力自动致死。`
      : combat.encounterId === 'SHEPHERD_DISPUTE'
      ? `在与成年普通门廊看守埃尔顿的原日光外院冲突中，${subject}进入死亡分支；没有真实保命或同伴救援，最终死亡。原身体与各自原物留在原处，实付灵性与储备不返还，临时模糊结束；不复活、不自动吞灵或增加原灵库存。`
      : combat.encounterId === 'STAR_MYSTIC_DISPUTE'
      ? `在与成年普通空院看守布莱斯的原外院冲突中，${subject}进入死亡分支；没有真实可用的保命或同伴救援，最终死亡。原身体与各自原物留在原处，已付精神、灵性与已燃原卷轴不返还，临时牢笼与聚焦结束。`
      : combat.encounterId === 'GUARDIAN_DISPUTE'
      ? `这场与成年普通看门人埃德温的原外院冲突中，${subject}进入死亡分支；守护不豁免实际伤势或死亡，没有同伴救援，最终死亡。原身体与各自原物留在原处，实付灵性不退回，临时剑甲结束。`
      : combat.encounterId === 'DREAM_STEALER_DISPUTE'
      ? `这场与成年纸箱房值守马洛的原私人庭院冲突中，${subject}进入死亡分支；没有真实可用的保命能力或同伴救援，最终死亡。原身体与各自原物留在原现场，实付灵性不退回；念头窃取不会复活死者、形成寄生或永久复制能力。`
      : combat.encounterId === 'TRAVELER_DISPUTE'
      ? `这场与成年仓库守门人贝兰的原私人厅冲突中，${subject}进入死亡分支；没有真实可用的保命能力或同伴救援，最终死亡。原身体与各自原物留在现场，实付旅行灵性和原记录消耗不返还，没有免费逃生、复活或补充记录。`
      : combat.encounterId === 'GATEKEEPER_DISPUTE'
      ? `这场与成年旧纪念院看守洛克的原私人庭院冲突中，${subject}进入死亡分支；没有真实可用的保命能力或同伴救援，最终死亡。原身体与各自原物留在现场，冥界门已在实际动作内完全关闭，不复活、不补灵性、不自动招来死者。`
      : combat.encounterId === 'PRIEST_OF_LIGHT_DISPUTE'
      ? `这场与普通门房凯恩的原私人庭院冲突中，${subject}进入死亡分支；没有真实可用的保命能力或同伴救援，最终死亡。原身体与各自原物留在现场，圣光与短吟当次结束，不复活、不补灵性。`
      : combat.encounterId === 'OCEAN_SINGER_DISPUTE'
      ? `${subject}在原私人码头作业院的真实冲突中进入死亡分支；没有真实可用的保命能力或同伴救援，最终死亡。原身体与各自原物留在现场，歌声已经结束，不复活、不补灵性。`
      : `${subject}进入死亡分支；没有真实可用的保命能力或队友救援，最终死亡。`;
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  const injury: SliceInjury = {
    id: `${state.runId}:combat:${round.round}:${loser}:${state.revision + 1}:${injuries.length}`,
    severity, acquiredRevision: state.revision + 1, treatedRevision: null,
  };
  injuries.push(injury);
  const damage = severity === 'LIGHT' ? 10 : 30;
  const ironBloodShare = loser === 'PLAYER' && ironBloodRound
    ? shareIronBloodHealthDamage(state, damage, ironBloodRound, severity) : null;
  if (loser === 'PLAYER') state.health = Math.max(0, state.health - (ironBloodShare?.ownerDamage ?? damage));
  else combat.enemyHealth = Math.max(0, combat.enemyHealth - damage);
  const remainingHealth = loser === 'PLAYER' ? state.health : combat.enemyHealth;
  round.consequence = demonHunterEnemy
    ? `${subject}在原侧院与DH4-CINDER-GUARD交战中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${damage}；守护和隐蔽意图不消除真实伤势。`
    : parasiteEnemy
    ? `${subject}在原干燥庭院受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${damage}；暂窃不豁免共同伤势或治疗原身体。`
    : undying
    ? `${subject}在原档案石院受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${damage}；有限封印与死者之语不豁免共同真实伤势，不恢复健康。`
    : unshadowed
    ? `${subject}在原石院受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${damage}；有限领域、净化光与耀斑不豁免共同真实伤势。`
    : cataclysmPriest
    ? `${subject}在原石码头冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${damage}；有限风、水、雷不豁免共同真实伤势。`
    : prophet
    ? `${subject}在原档案馆空院与原哈罗德的真实冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${damage}；有限预警与弱闪光不豁免共同伤势。`
    : nightwatcher
    ? `${subject}在原练习院受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${damage}；有限厄运、梦境与同一原卷叶不豁免共同伤势或恢复健康。`
    : witchKing
    ? `${subject}在原练习院受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${damage}；同一原纸的有限减势不豁免共同伤势，不因月光化恢复原健康或返还原纸。`
    : alchemist
    ? `${subject}在原工坊空院受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${damage}；同一原护架的有限防守不豁免共同伤势，原储能和耐久另行保留。`
    : manipulator
    ? `${subject}在原仓库冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${damage}；鳞片与虚拟人格不豁免本次共同身体伤势，原精神损耗及精神瘟疫另行保留。`
    : ironBlood
    ? `${subject}在原空石院的冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康实际减少${ironBloodShare?.ownerDamage ?? damage}；短暂钢铁/火焰形态不豁免这次真实伤势与带伤风险。`
    : combat.encounterId === 'DRUID_DISPUTE'
    ? `${subject}在与成年普通园工马伦的原花园边庭冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${damage}；任何已用的地下潜行均已当次再出、壤土稳定，有限减势不豁免这次共同真实伤势，也没有埋敌或改写地形。`
    : combat.encounterId === 'PUNISHMENT_KNIGHT_DISPUTE'
    ? `${subject}在与成年普通人迪恩的原调解处日光外院冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${damage}；禁令、惩戒与囚禁不豁免共同真实伤势，伤口裁断不会直接改写健康。`
    : combat.encounterId === 'MENTOR_DISORDER_DISPUTE'
    ? `${subject}在与成年普通人里斯的原契约铺日光外院冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${damage}；有限混乱和贿赂不豁免共同真实伤势。`
    : combat.encounterId === 'WINNER_DISPUTE'
    ? `${subject}在与成年普通人奥德里的原日光外院冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${damage}；有限好运或厄运不豁免共同真实伤势。`
    : combat.encounterId === 'WRAITH_DISPUTE'
    ? `${subject}在与成年普通人贝文的原工坊外院冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${damage}；灵魂创伤与身体打击的真实健康后果由共同战盘结算，短暂灵化不豁免伤势。`
    : combat.encounterId === 'SHEPHERD_DISPUTE'
    ? `${subject}在与成年普通门廊看守埃尔顿的原日光外院冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${damage}；借用原灵不豁免共同真实伤势。`
    : combat.encounterId === 'STAR_MYSTIC_DISPUTE'
    ? `${subject}在与成年普通空院看守布莱斯的原外院冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${damage}；星光牢笼不豁免共同真实伤势。`
    : combat.encounterId === 'GUARDIAN_DISPUTE'
    ? `${subject}在原外院与埃德温的实际冲突中受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${damage}；守护没有消除这次真实伤势。`
    : `${subject}受到${severity === 'LIGHT' ? '轻' : '重'}伤，健康减少${damage}。`;
  if (ironBloodShare?.label) round.consequence += ironBloodShare.label;
  if (remainingHealth === 0) {
    if (loser === 'ENEMY') combat.enemyStatus = 'DEAD';
    round.consequence += demonHunterEnemy
      ? '原身体健康降至0，真实死亡；同一原身体、有限资源和涂层记录保留，没有巨人形态保命或原敌重生。'
      : parasiteEnemy
      ? '原身体健康降至0，真实死亡；原拉尔夫与本人各自身体、原棍和借用记录留在原场景，不复活、不寄生逃生。'
      : undying
      ? '原身体健康降至0，真实死亡；六十年周期登记不是普通死亡复活，原记录与旧灰羽历史保持，不补身体、灵魂或实付资源。'
      : unshadowed
      ? '原身体健康降至0，真实死亡；无暗者能力不复活、不复制身体或退还灵性，同一原地面的焦痕保留。'
      : cataclysmPriest
      ? '原身体健康降至0，真实死亡；有限风、水、雷不复活、不造新身体、不退实付资源。'
      : prophet
      ? '原身体健康降至0，真实死亡；有限预警与原微光片不能复活、换身体或退回实付资源。'
      : nightwatcher
      ? '原身体健康降至0，最终死亡；有限梦境、厄运和原卷叶不能复活，各自原身体与原物仍在原院。'
      : witchKing
      ? '原身体健康降至0，真实死亡；没有原纸自动替死、月光复活或新身体。已经消耗的原紙与灵性不退款。'
      : alchemist
      ? '原身体健康降至0，最终死亡；原护架不是生命替身，不复活或复制原人，原件和实际消耗保留。'
      : manipulator
      ? '原身体健康降至0，最终死亡；没有人格替死、精神免伤或复活，各自原身体与原物留在仓库。'
      : combat.encounterId === 'DRUID_DISPUTE'
      ? '与马伦交手时原健康降至0，没有保命或同伴救援，最终死亡；原身体与各自原物留在原花园边庭稳定地面，任何已用的地下潜行均已当次再出，没有地下驻留、复活或返还实付灵性。'
      : combat.encounterId === 'PUNISHMENT_KNIGHT_DISPUTE'
      ? '与迪恩交手时原健康降至0，没有保命或同伴救援，最终死亡；原身体与各自原物留在原调解处外院，单次禁令、待用惩戒与有限囚禁全部结束，不复活或返还实付灵性。'
      : combat.encounterId === 'MENTOR_DISORDER_DISPUTE'
      ? '与里斯交手时原健康降至0，没有保命或同伴救援，最终死亡；原身体与各自原物留在原处，有限混乱与待用贿赂结束，不复活、不退回实付灵性或已给原礼物。'
      : combat.encounterId === 'WINNER_DISPUTE'
      ? '与奥德里交手时原健康降至0，没有保命或同伴救援，最终死亡；原身体与各自原物留在原处，有限厄运结束，不复活或退回实付积运与灵性。'
      : combat.encounterId === 'WRAITH_DISPUTE'
      ? '与贝文交手时原健康降至0，没有保命或同伴救援，最终死亡；原身体与各自原物留在原处，附身早已退出，迟疑结束，不复活、不退回实付灵性或自动吞魂。'
      : combat.encounterId === 'DESIRE_APOSTLE_DISPUTE'
      ? '与费兰交手时原健康降至0且没有保命或同伴救援，最终死亡；原身体与原物留在现场，种子与迟疑结束，不复活、不退回实付灵性。'
      : combat.encounterId === 'SHEPHERD_DISPUTE'
      ? '在与成年普通门廊看守埃尔顿交手的原日光外院健康降至0，没有保命或同伴救援，最终死亡；原身体与各自原物留在原处，已付灵性与储备不返还，临时模糊结束，不自动吞灵、放牧或复活。'
      : combat.encounterId === 'STAR_MYSTIC_DISPUTE'
      ? '在与成年普通空院看守布莱斯交手的原外院健康降至0，没有真实保命或同伴救援，最终死亡；原身体与各自原物留在原处，星光不复活、实付精神与灵性不返还。'
      : combat.encounterId === 'GUARDIAN_DISPUTE'
      ? '在与成年普通看门人埃德温交手的原外院健康降至0且没有保命或同伴救援，最终死亡；守护不复活或返还实付灵性，各自原物留在原处。'
      : combat.encounterId === 'DREAM_STEALER_DISPUTE'
      ? '在与成年纸箱房值守马洛交手的原私人庭院健康降至0且没有保命或同伴救援，最终死亡。原身体与各自原物留在原现场，不复活、不补灵性、不形成寄生。'
      : combat.encounterId === 'TRAVELER_DISPUTE'
      ? '在与成年仓库守门人贝兰交手的原私人厅健康降至0且没有保命或同伴救援，最终死亡。原身体与各自原物留在现场，没有免费逃生、复活或补充记录。'
      : combat.encounterId === 'GATEKEEPER_DISPUTE'
      ? '在与成年旧纪念院看守洛克交手的原私人庭院健康降至0且没有保命或同伴救援，最终死亡。原身体与各自原物留在现场，冥界门已在实际动作内完全关闭，不复活、不补灵性、不自动招来死者。'
      : combat.encounterId === 'PRIEST_OF_LIGHT_DISPUTE'
      ? '在与普通门房凯恩交手的原私人庭院健康降至0且没有保命或同伴救援，最终死亡。原身体与各自原物留在现场，圣光与短吟当次结束，不复活、不补灵性。'
      : combat.encounterId === 'OCEAN_SINGER_DISPUTE'
      ? '在原私人码头作业院健康降至0且没有保命或同伴救援，最终死亡。原身体与各自原物留在现场，歌声已经结束，不复活、不补灵性。'
      : '健康降至0且没有保命或救援，最终死亡。';
    return finish(loser === 'PLAYER' ? 'PLAYER_DEAD' : 'ENEMY_DEAD');
  }
  if (loser === 'ENEMY' && severity === 'HEAVY' && !bizarroEnemy && !secretsSorcererEnemy) {
    combat.enemyStatus = 'SURRENDERED';
    round.consequence += demonHunterEnemy
      ? '同一原哨卫因真实重伤停止抵抗，仍活着并留在原侧院；没有虚构原棍、强制和平或永久控制。'
      : parasiteEnemy
      ? '同一原拉尔夫因真实重伤自行停止抵抗，仍活着，放下自己的PR4-RALF-CLUB；原棍归属不变，没有强迫永久服从。'
      : undying
      ? '原欧文仍活着，因真实重伤自行停止抵抗，把自己的UDY4-OWEN-CLUB放在原石院；原棍归属不变，有限封印没有剥离灵魂或强迫永久服从。'
      : unshadowed
      ? '同一原埃德蒙仍活着，因真实重伤自行停止抵抗，将自己的UD4-EDMUND-CLUB放在原石院；原棍归属不变，净化光没有贴邪恶标签或强迫永久服从。'
      : cataclysmPriest
      ? '原本尼迪克特·维尔仍活着，因真实重伤自行停止抵抗，把自己的CP4-BENEDICT-CLUB放在原石码头；原棍归属不变，有限风、水、雷没有强迫永久服从。'
      : prophet
      ? '原哈罗德·布伦特仍活着，因真实重伤自行停止抵抗，将自己的PF4-HAROLD-CLUB放在原档案馆空院；原棍归属不变，预警与弱闪光没有强迫永久服从。'
      : nightwatcher
      ? '同一原布拉姆·洛仍活着，因真实重伤自行停止抵抗，把自己的NW4-BRAM-CLUB放在原院；原棍归属不变，不是梦境强制永久服从。'
      : witchKing
      ? '同一原多里安仍活着，因真实重伤自行停止抵抗，把自己的WK4-DORIAN-CLUB放在原院；原棍归属不变，有限枷锁没有强迫永久服从。'
      : alchemist
      ? '同一原奥斯里克仍活着，因真实重伤自行停止抵抗，并把自己的AL4-OSRIC-CLUB放在原院；原棍归属不变，不以赋灵强迫其意愿。'
      : manipulator
      ? '同一原鲁兰仍活着，因真实重伤自行停止抵抗，并将自己的原短棍MP4-RULAN-CLUB放在原仓库；原棍归属不变，心灵能力没有保证控制，已经形成的精神瘟疫不随投降消失。'
      : ironBlood
      ? '加里克仍然活着，自行停止抵抗并将自己的原短棍IB4-GARRICK-CLUB放在原空石院；原棍归属不变，战友联系与形态没有强迫他的意愿。'
      : combat.encounterId === 'DRUID_DISPUTE'
      ? '成年普通园工马伦仍然活着，在原花园边庭自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，地下潜行没有强迫其意愿、埋入本人或使其成为植物。各自原身体都在稳定原地面，不治疗或返还实付灵性。'
      : combat.encounterId === 'PUNISHMENT_KNIGHT_DISPUTE'
      ? '成年普通人迪恩仍然活着，在原调解处日光外院自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，禁令、惩戒、囚禁或伤口裁断没有强迫其意愿。本轮全部短效结束，不自动夺棍、治伤或补灵性。'
      : combat.encounterId === 'MENTOR_DISORDER_DISPUTE'
      ? '成年普通人里斯仍然活着，在原契约铺日光外院自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，有限混乱与贿赂没有强迫其意愿。已给原礼物仍在本场地面，不自动夺棍或归还礼物。'
      : combat.encounterId === 'WINNER_DISPUTE'
      ? '成年普通人奥德里仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，有限厄运没有强迫投降，不自动夺棍、取得箱子或补充积运。'
      : combat.encounterId === 'WRAITH_DISPUTE'
      ? '成年普通人贝文仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，附身早已在当次动作内退出，没有控制本人意愿或强迫投降，迟疑随本场结束。'
      : combat.encounterId === 'DESIRE_APOSTLE_DISPUTE'
      ? '成年普通看守费兰仍然活着，在原外院自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，情绪催化没有强迫投降，种子与迟疑随本场结束。'
      : combat.encounterId === 'SHEPHERD_DISPUTE'
      ? '成年普通门廊看守埃尔顿仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，模糊或鼓舞没有强迫其意愿，没有自动吞灵或增加原灵库存。'
      : combat.encounterId === 'PAIN_DISPUTE'
      ? '本段原成年普通看守奥伦仍活着，自行停止抵抗并放下自己的原短棍；原棍归属不变，疾病或丝线没有强迫其意愿，原病况不因投降治愈。'
      : combat.encounterId === 'GUARDIAN_DISPUTE'
      ? '成年普通看门人埃德温仍活着，在原外院自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，守护与晨曦能力没有强迫他的意愿。'
      : combat.encounterId === 'DREAM_STEALER_DISPUTE'
      ? '成年纸箱房值守马洛仍然活着，在原私人庭院自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，当前念头窃取已结束，没有强迫他的投降意愿，也没有永久删除思想或夺走能力。'
      : combat.encounterId === 'TRAVELER_DISPUTE'
      ? '成年仓库守门人贝兰仍然活着，在原私人厅自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，短旅行与继承原记录没有强迫他的意愿。'
      : combat.encounterId === 'GATEKEEPER_DISPUTE'
      ? '成年旧纪念院看守洛克仍然活着，在原私人庭院自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，冥界门与同一原灰羽短助没有强迫他的意愿，没有放逐洛克、收押他的灵体或额外招灵。' : combat.encounterId === 'PRIEST_OF_LIGHT_DISPUTE'
      ? '普通门房凯恩仍然活着，在原私人庭院自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，圣光与继承短吟没有强迫他的意愿，也没有把普通活人判成邪恶或亡灵。' : combat.encounterId === 'OCEAN_SINGER_DISPUTE'
      ? '码头管事布伦仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，短促歌声没有强迫他的意愿，也没有可靠隔绝友军的保证。' : combat.encounterId === 'MYSTICISM_MAGISTER_DISPUTE'
      ? '罗文仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，有限闪光没有强迫他的意愿。' : combat.encounterId === 'SPIRIT_WARLOCK_DISPUTE'
      ? '奥林仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，原灵协助与继承梦境没有强迫他的意愿。' : combat.encounterId === 'CRIMSON_SCHOLAR_DISPUTE'
      ? '西德仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，有限枷锁或自身月光重组没有强迫他的意愿。' : combat.encounterId === 'ASTRONOMER_DISPUTE'
      ? '霍伯仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，短时专注没有读心或强迫他的意愿。' : combat.encounterId === 'DREAMWALKER_DISPUTE'
      ? '马斯仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，有限催眠没有强迫他的意愿，也没有把清醒者拖入梦境。' : combat.encounterId === 'REAPER_DISPUTE'
      ? '维克仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，短弱点窗口与有限火焰没有强迫他的意愿。' : combat.encounterId === 'MARIONETTIST_DISPUTE'
      ? '多恩仍然活着，自行停止抵抗并放下同一原短棍投降。尚未秘偶化；原身体、健康、精神与伤势保留，后续捕获必须另行花费约20秒及约280秒并明确确认死亡。' : combat.encounterId === 'BIOLOGIST_DISPUTE'
      ? '洛恩仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，观察与生命支持没有改写他的意愿，温室原苗始终留在原处。' : combat.encounterId === 'JUDGE_DISPUTE'
      ? '埃文仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，权威与有限禁令没有强迫真话、认罪或服从。' : combat.encounterId === 'CORRUPTION_BARON_DISPUTE'
      ? '沃恩仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，有限扭曲与贿赂没有改写他的长期意愿，已赠原物不返还。' : combat.encounterId === 'CALAMITY_PRIEST_DISPUTE'
      ? '杜兰仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，精神风暴没有强迫供述或服从。' : combat.encounterId === 'ZOMBIE_DISPUTE'
      ? '里德仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，没有被灵体或寒冷强迫服从。' : combat.encounterId === 'DEMON_DISPUTE'
      ? '莫顿仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，恶魔能力没有控制他的情绪或意愿。' : combat.encounterId === 'ROSE_BISHOP_DISPUTE'
      ? '维恩仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，血肉能力没有改写他的意愿。' : combat.encounterId === 'SCROLL_PROFESSOR_DISPUTE'
      ? '卡尔仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，卷轴没有改写他的意愿。' : combat.encounterId === 'STAR_MYSTIC_DISPUTE'
      ? '成年普通空院看守布莱斯仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，星光牢笼没有改写他的意愿。' : combat.encounterId === 'PLEASURE_DISPUTE'
      ? '马伦仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，丝缚或魅惑没有改写他的意愿。' : combat.encounterId === 'DAWN_PALADIN_DISPUTE'
      ? '罗尔德仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，晨曦能力不改写意愿。' : combat.encounterId === 'FIRE_THIEF_DISPUTE'
      ? '贝林仍然活着，自行停止抵抗并放下自己的原普通短棍；暂窃没有强迫他投降，原棍所有权不变。' : combat.encounterId === 'RECORDER_DISPUTE'
      ? '弥尔仍然活着，自行停止抵抗并放下自己的原普通短棍投降；记录没有强迫他服从。' : combat.encounterId === 'SPIRIT_GUIDE_DISPUTE'
      ? '迪恩仍然活着，自行停止抵抗并放下自己的原普通短棍投降；没有被亡者之语强迫服从。' : combat.encounterId === 'NOTARY_DISPUTE'
      ? '布伦仍然活着，停止抵抗并放下自己的原普通短棍投降；未被迫签署契约。' : combat.encounterId === 'WIND_BLESSED_DISPUTE'
      ? '鲁恩仍然活着，停止抵抗并放下自己的原普通短棍投降。' : combat.encounterId === 'POLYMATH_DISPUTE'
      ? '伊恩仍然活着，停止抵抗并放下自己的原普通短棍投降。' : combat.encounterId === 'SOOTHER_DISPUTE'
      ? '阿兰仍然活着，停止抵抗并放下自己的原普通短棍投降。' : combat.encounterId === 'POTION_PROFESSOR_DISPUTE'
      ? '艾文仍然活着，停止抵抗并放下自己的原普通短棍投降。' : combat.encounterId === 'ARTISAN_DISPUTE'
      ? '德文仍然活着，停止抵抗并放下自己的原普通短棍投降。' : combat.encounterId === 'CONSPIRATOR_DISPUTE'
      ? '奥伦仍然活着，停止抵抗并放下原短棍投降。' : combat.encounterId === 'FACELESS_DISPUTE'
      ? '达恩仍然活着，停止抵抗并放下原短棍投降。' : combat.encounterId === 'MARAUDER_DISPUTE'
      ? '塞蒙仍然活着，停止抵抗并投降。' : combat.encounterId === 'NIGHTMARE_DISPUTE'
      ? '持棍凯尔仍然活着，放下短棍投降。' : combat.encounterId === 'MIDNIGHT_DISPUTE'
      ? '持棍贺恩仍然活着，放下短棍投降。' : combat.encounterId === 'SLEEPLESS_WATCH'
      ? '持棍拉夫仍然活着，放下短棍投降。' : combat.encounterId === 'VAMPIRE_DISPUTE'
      ? '布鲁克仍然活着，放下短棍投降。' : combat.encounterId === 'PSYCHOLOGIST_DISPUTE'
      ? '布莱斯仍然活着，放下短棍投降。' : combat.encounterId === 'HYPNOTIST_DISPUTE'
      ? '罗温仍然活着，自行放下原短棍、停止抵抗并投降；没有成为受控者。' : combat.encounterId === 'PYROMANIAC_DISPUTE'
      ? '短棍阻拦者哈恩仍然活着，放下短棍投降。' : combat.encounterId === 'CLOWN_RESCUE'
      ? '勒索者仍然活着，放下短棍投降。' : combat.encounterId === 'MAGICIAN_DISPUTE'
      ? '堵住剧场后巷的莫里仍然活着，放下短棍投降。' : combat.encounterId === 'HUNTER_CARGO'
      ? '拦路者仍然活着，放下短棍投降。' : combat.encounterId === 'PROVOKER_DISPUTE'
      ? '威斯仍然活着，放下短棍投降。' : '携铃者仍然活着，放下短棍与箱子投降。';
    return finish('ENEMY_SURRENDERED');
  }
  return finish('CONTINUE');
}
